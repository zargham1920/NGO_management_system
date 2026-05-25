const { pool } = require('../config/db');

// ─── Helper: recalculate Inventory status from quantity ───────────────────────
function calcInventoryStatus(quantity) {
  if (quantity === 0) return 'Out of Stock';
  if (quantity < 10)  return 'Low Stock';
  return 'In Stock';
}

// ─── API 1: GET /api/distributions/summary ───────────────────────────────────
// KPI chips for the Aid Distribution view header
async function getSummary(req, res) {
  try {
    const [[summary]] = await pool.query(`
      SELECT
        COUNT(*)                                          AS total_distributions,
        COUNT(DISTINCT ad.beneficiary_id)                AS unique_beneficiaries_served,
        COALESCE(SUM(ad.quantity_given), 0)              AS total_units_dispatched,
        COUNT(DISTINCT ad.project_id)                    AS projects_involved,
        COUNT(DISTINCT ad.item_id)                       AS unique_items_distributed,
        SUM(ad.distribution_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS distributions_this_month
      FROM Aid_Distribution ad
    `);

    return res.status(200).json({ success: true, data: summary });
  } catch (err) {
    console.error('distributions getSummary error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 2: POST /api/distributions (Record Aid Distribution — TRANSACTION) ──
// CRITICAL: Uses MySQL transaction to atomically:
//   1. INSERT Aid_Distribution record
//   2. DEDUCT quantity from Inventory
//   3. UPDATE Inventory.status
// Both rollback if either fails.
async function create(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      project_id,
      beneficiary_id,
      item_id,
      quantity_given,
      notes,
      distribution_date,  // optional — defaults to today if omitted
    } = req.body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!project_id || !beneficiary_id || !item_id || !quantity_given) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'project_id, beneficiary_id, item_id, and quantity_given are all required.',
      });
    }

    const qtyNum = parseInt(quantity_given);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'quantity_given must be a positive integer.',
      });
    }

    // ── Lock the inventory row to prevent race conditions ─────────────────────
    const [[item]] = await conn.query(
      'SELECT item_id, item_name, quantity, category FROM Inventory WHERE item_id = ? FOR UPDATE',
      [item_id]
    );
    if (!item) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, message: 'Inventory item not found.' });
    }
    if (item.quantity < qtyNum) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${item.quantity} units, Requested: ${qtyNum} units.`,
      });
    }

    // ── Validate beneficiary ──────────────────────────────────────────────────
    const [benRows] = await conn.query(
      'SELECT beneficiary_id, name FROM Beneficiary WHERE beneficiary_id = ?',
      [beneficiary_id]
    );
    if (benRows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
    }

    // ── Validate project ──────────────────────────────────────────────────────
    const [projRows] = await conn.query(
      'SELECT project_id, project_name FROM Project WHERE project_id = ?',
      [project_id]
    );
    if (projRows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // ── INSERT Aid_Distribution ───────────────────────────────────────────────
    const distDate = distribution_date || new Date().toISOString().slice(0, 10);

    const [result] = await conn.query(
      `INSERT INTO Aid_Distribution
         (project_id, beneficiary_id, item_id, distribution_date, quantity_given, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [project_id, beneficiary_id, item_id, distDate, qtyNum, notes || null]
    );

    // ── DEDUCT from Inventory + recalculate status ────────────────────────────
    const newQuantity = item.quantity - qtyNum;
    const newStatus   = calcInventoryStatus(newQuantity);

    await conn.query(
      'UPDATE Inventory SET quantity = ?, status = ? WHERE item_id = ?',
      [newQuantity, newStatus, item_id]
    );

    await conn.commit();
    conn.release();

    return res.status(201).json({
      success: true,
      message: `Aid distribution recorded. Inventory updated for "${item.item_name}".`,
      data: {
        distribution_id:   result.insertId,
        item_name:         item.item_name,
        beneficiary_name:  benRows[0].name,
        project_name:      projRows[0].project_name,
        quantity_given:    qtyNum,
        distribution_date: distDate,
        remaining_stock:   newQuantity,
        inventory_status:  newStatus,
      },
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    conn.release();
    console.error('distributions create error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 3: GET /api/distributions (List + Filters + Pagination) ──────────────
// Filters: project_id, beneficiary_id, item_id, category, from_date, to_date
async function getAll(req, res) {
  try {
    const {
      project_id, beneficiary_id, item_id, category,
      from_date, to_date,
      page = 1, limit = 10,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where  = ['1=1'];
    let params = [];

    if (project_id)    { where.push('ad.project_id = ?');           params.push(project_id); }
    if (beneficiary_id){ where.push('ad.beneficiary_id = ?');        params.push(beneficiary_id); }
    if (item_id)       { where.push('ad.item_id = ?');               params.push(item_id); }
    if (category)      { where.push('i.category = ?');               params.push(category); }
    if (from_date)     { where.push('ad.distribution_date >= ?');    params.push(from_date); }
    if (to_date)       { where.push('ad.distribution_date <= ?');    params.push(to_date); }

    const whereStr = where.join(' AND ');

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM Aid_Distribution ad
       JOIN Inventory   i ON i.item_id        = ad.item_id
       WHERE ${whereStr}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT
         ad.distribution_id,
         ad.distribution_date,
         ad.quantity_given,
         ad.notes,
         b.beneficiary_id,
         b.name       AS beneficiary_name,
         b.cnic,
         i.item_id,
         i.item_name,
         i.category,
         p.project_id,
         p.project_name,
         l.village_name,
         l.district
       FROM Aid_Distribution ad
       JOIN Beneficiary b ON b.beneficiary_id = ad.beneficiary_id
       JOIN Inventory   i ON i.item_id        = ad.item_id
       JOIN Project     p ON p.project_id     = ad.project_id
       LEFT JOIN Location l ON l.location_id  = b.location_id
       WHERE ${whereStr}
       ORDER BY ad.distribution_date DESC, ad.distribution_id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    return res.status(200).json({
      success:     true,
      total,
      page:        parseInt(page),
      total_pages: Math.ceil(total / parseInt(limit)),
      count:       rows.length,
      data:        rows,
    });
  } catch (err) {
    console.error('distributions getAll error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 4: GET /api/distributions/:id (Single Record Detail) ────────────────
async function getById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         ad.*,
         b.name        AS beneficiary_name,
         b.cnic,
         b.age,
         b.household_size,
         i.item_name,
         i.category,
         i.quantity    AS current_stock,
         i.status      AS current_inventory_status,
         p.project_name,
         p.sector,
         l.village_name,
         l.district,
         l.region
       FROM Aid_Distribution ad
       JOIN Beneficiary b ON b.beneficiary_id = ad.beneficiary_id
       JOIN Inventory   i ON i.item_id        = ad.item_id
       JOIN Project     p ON p.project_id     = ad.project_id
       LEFT JOIN Location l ON l.location_id  = b.location_id
       WHERE ad.distribution_id = ?`,
      [req.params.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Distribution record not found.' });

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('distributions getById error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 5: GET /api/distributions/recent (Dashboard feed) ───────────────────
// ?days=N (default 7) ?limit=N (default 20)
async function getRecent(req, res) {
  try {
    const days  = parseInt(req.query.days)  || 7;
    const limit = parseInt(req.query.limit) || 20;

    const [rows] = await pool.query(
      `SELECT
         ad.distribution_id,
         ad.distribution_date,
         ad.quantity_given,
         ad.notes,
         b.beneficiary_id,
         b.name     AS beneficiary_name,
         i.item_id,
         i.item_name,
         i.category,
         p.project_id,
         p.project_name,
         l.village_name,
         l.district
       FROM Aid_Distribution ad
       JOIN Beneficiary b ON b.beneficiary_id = ad.beneficiary_id
       JOIN Inventory   i ON i.item_id        = ad.item_id
       JOIN Project     p ON p.project_id     = ad.project_id
       LEFT JOIN Location l ON l.location_id  = b.location_id
       WHERE ad.distribution_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ORDER BY ad.distribution_date DESC, ad.distribution_id DESC
       LIMIT ?`,
      [days, limit]
    );

    return res.status(200).json({
      success: true,
      days,
      count:   rows.length,
      data:    rows,
    });
  } catch (err) {
    console.error('distributions getRecent error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 6: GET /api/distributions/beneficiary/:beneficiaryId ────────────────
// Full aid history for a single beneficiary
async function getByBeneficiary(req, res) {
  try {
    const { beneficiaryId } = req.params;

    // Confirm beneficiary exists
    const [[ben]] = await pool.query(
      'SELECT beneficiary_id, name, cnic FROM Beneficiary WHERE beneficiary_id = ?',
      [beneficiaryId]
    );
    if (!ben)
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });

    const [rows] = await pool.query(
      `SELECT
         ad.distribution_id,
         ad.distribution_date,
         ad.quantity_given,
         ad.notes,
         i.item_id,
         i.item_name,
         i.category,
         p.project_id,
         p.project_name,
         l.village_name,
         l.district
       FROM Aid_Distribution ad
       JOIN Inventory   i ON i.item_id    = ad.item_id
       JOIN Project     p ON p.project_id = ad.project_id
       LEFT JOIN Location l ON l.location_id = p.location_id
       WHERE ad.beneficiary_id = ?
       ORDER BY ad.distribution_date DESC`,
      [beneficiaryId]
    );

    // Quick aggregate stats
    const totalUnits = rows.reduce((sum, r) => sum + Number(r.quantity_given), 0);

    return res.status(200).json({
      success:      true,
      beneficiary:  { beneficiary_id: ben.beneficiary_id, name: ben.name, cnic: ben.cnic },
      total_events: rows.length,
      total_units_received: totalUnits,
      data:         rows,
    });
  } catch (err) {
    console.error('distributions getByBeneficiary error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 7: GET /api/distributions/by-project/:projectId ─────────────────────
// All distributions for a specific project, with aggregate stats
async function getByProject(req, res) {
  try {
    const { projectId } = req.params;

    // Confirm project exists
    const [[proj]] = await pool.query(
      'SELECT project_id, project_name FROM Project WHERE project_id = ?',
      [projectId]
    );
    if (!proj)
      return res.status(404).json({ success: false, message: 'Project not found.' });

    const [rows] = await pool.query(
      `SELECT
         ad.distribution_id,
         ad.distribution_date,
         ad.quantity_given,
         ad.notes,
         b.beneficiary_id,
         b.name     AS beneficiary_name,
         b.cnic,
         i.item_id,
         i.item_name,
         i.category
       FROM Aid_Distribution ad
       JOIN Beneficiary b ON b.beneficiary_id = ad.beneficiary_id
       JOIN Inventory   i ON i.item_id        = ad.item_id
       WHERE ad.project_id = ?
       ORDER BY ad.distribution_date DESC`,
      [projectId]
    );

    const totalUnits       = rows.reduce((sum, r) => sum + Number(r.quantity_given), 0);
    const uniqueBeneficiaries = new Set(rows.map(r => r.beneficiary_id)).size;

    return res.status(200).json({
      success:               true,
      project:               { project_id: proj.project_id, project_name: proj.project_name },
      total_events:          rows.length,
      total_units_dispatched: totalUnits,
      unique_beneficiaries:  uniqueBeneficiaries,
      data:                  rows,
    });
  } catch (err) {
    console.error('distributions getByProject error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 8: DELETE /api/distributions/:id (Admin only — with stock reversal) ─
// Reverses the inventory deduction when a distribution record is deleted.
// This is a TRANSACTION: delete record + restore Inventory quantity atomically.
async function remove(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;

    // Fetch the distribution record first
    const [[dist]] = await conn.query(
      'SELECT distribution_id, item_id, quantity_given FROM Aid_Distribution WHERE distribution_id = ?',
      [id]
    );
    if (!dist) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, message: 'Distribution record not found.' });
    }

    // Lock and fetch inventory row
    const [[item]] = await conn.query(
      'SELECT item_id, item_name, quantity FROM Inventory WHERE item_id = ? FOR UPDATE',
      [dist.item_id]
    );

    // Delete the distribution record
    await conn.query(
      'DELETE FROM Aid_Distribution WHERE distribution_id = ?',
      [id]
    );

    // Restore the deducted quantity if inventory item still exists
    if (item) {
      const restoredQty = item.quantity + Number(dist.quantity_given);
      const newStatus   = calcInventoryStatus(restoredQty);

      await conn.query(
        'UPDATE Inventory SET quantity = ?, status = ? WHERE item_id = ?',
        [restoredQty, newStatus, dist.item_id]
      );
    }

    await conn.commit();
    conn.release();

    return res.status(200).json({
      success: true,
      message: `Distribution record #${id} deleted. Inventory quantity restored.`,
      data: item
        ? {
            item_id:          dist.item_id,
            item_name:        item.item_name,
            restored_units:   Number(dist.quantity_given),
            new_stock:        item.quantity + Number(dist.quantity_given),
            inventory_status: calcInventoryStatus(item.quantity + Number(dist.quantity_given)),
          }
        : null,
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    conn.release();
    console.error('distributions remove error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = {
  getSummary,
  create,
  getAll,
  getById,
  getRecent,
  getByBeneficiary,
  getByProject,
  remove,
};
