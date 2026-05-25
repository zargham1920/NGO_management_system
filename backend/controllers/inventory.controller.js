const { pool } = require('../config/db');

// ─── Helper: derive status from quantity ──────────────────────────────────────
function calcStatus(quantity) {
  if (quantity === 0) return 'Out of Stock';
  if (quantity < 10)  return 'Low Stock';
  return 'In Stock';
}

// ─── API 1: GET /api/inventory/summary ───────────────────────────────────────
async function getSummary(req, res) {
  try {
    const [[summary]] = await pool.query(`
      SELECT
        COALESCE(SUM(quantity), 0)              AS total_items_warehoused,
        COUNT(DISTINCT category)                AS active_categories,
        SUM(quantity = 0)                       AS out_of_stock_count,
        SUM(quantity > 0 AND quantity < 10)     AS low_stock_count,
        SUM(quantity >= 10)                     AS in_stock_count
      FROM Inventory
    `);

    // Critical threshold warning = items that are low OR out of stock
    summary.critical_threshold =
      Number(summary.low_stock_count) + Number(summary.out_of_stock_count);

    return res.status(200).json({ success: true, data: summary });
  } catch (err) {
    console.error('inventory getSummary error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 2: GET /api/inventory (list + filters + pagination) ─────────────────
async function getAll(req, res) {
  try {
    const { search, category, status, project_id, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where  = ['1=1'];
    let params = [];

    if (search)     { where.push('i.item_name LIKE ?'); params.push(`%${search}%`); }
    if (category)   { where.push('i.category = ?');     params.push(category); }
    if (status)     { where.push('i.status = ?');       params.push(status); }
    if (project_id) { where.push('i.project_id = ?');  params.push(project_id); }

    const whereStr = where.join(' AND ');

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM Inventory i WHERE ${whereStr}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT
         i.item_id, i.item_name, i.quantity, i.category, i.status,
         i.project_id,
         CASE
           WHEN p.project_name IS NOT NULL
           THEN CONCAT(p.project_name, ' (', l.district, ')')
           ELSE 'None - General Reserve'
         END AS assigned_project
       FROM Inventory i
       LEFT JOIN Project  p ON p.project_id  = i.project_id
       LEFT JOIN Location l ON l.location_id = p.location_id
       WHERE ${whereStr}
       ORDER BY
         CASE i.status
           WHEN 'Out of Stock' THEN 1
           WHEN 'Low Stock'    THEN 2
           ELSE 3
         END,
         i.item_name ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    return res.status(200).json({
      success: true,
      total,
      page:        parseInt(page),
      total_pages: Math.ceil(total / parseInt(limit)),
      count:       rows.length,
      data:        rows,
    });
  } catch (err) {
    console.error('inventory getAll error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 3: GET /api/inventory/:id (single item detail) ──────────────────────
async function getById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         i.*,
         CASE
           WHEN p.project_name IS NOT NULL
           THEN CONCAT(p.project_name, ' (', l.district, ')')
           ELSE 'None - General Reserve'
         END                                     AS assigned_project,
         COUNT(ad.distribution_id)               AS times_distributed,
         COALESCE(SUM(ad.quantity_given), 0)     AS total_quantity_distributed
       FROM Inventory i
       LEFT JOIN Project          p  ON p.project_id  = i.project_id
       LEFT JOIN Location         l  ON l.location_id = p.location_id
       LEFT JOIN Aid_Distribution ad ON ad.item_id    = i.item_id
       WHERE i.item_id = ?
       GROUP BY i.item_id`,
      [req.params.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Item not found.' });

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('inventory getById error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 4: POST /api/inventory (add new item) ───────────────────────────────
async function create(req, res) {
  try {
    const { item_name, category, quantity, project_id } = req.body;

    if (!item_name || !category || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'item_name, category, and quantity are required.',
      });
    }

    if (parseInt(quantity) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity cannot be negative.',
      });
    }

    const validCategories = ['Water', 'Medical', 'Education', 'Infrastructure'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Use: ${validCategories.join(', ')}`,
      });
    }

    // Validate project if provided
    if (project_id) {
      const [proj] = await pool.query(
        'SELECT project_id FROM Project WHERE project_id = ?',
        [project_id]
      );
      if (proj.length === 0)
        return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // Auto-calculate status — never trust frontend for this
    const qty    = parseInt(quantity);
    const status = calcStatus(qty);

    const [result] = await pool.query(
      `INSERT INTO Inventory (project_id, item_name, quantity, category, status)
       VALUES (?, ?, ?, ?, ?)`,
      [project_id || null, item_name, qty, category, status]
    );

    return res.status(201).json({
      success: true,
      message: 'Item added to inventory successfully.',
      data:    { item_id: result.insertId, item_name, category, quantity: qty, status },
    });
  } catch (err) {
    console.error('inventory create error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 5: PUT /api/inventory/:id (update item details) ─────────────────────
// Updates item_name, category, project_id, or quantity.
// Status is ALWAYS recalculated — frontend never sends it.
async function update(req, res) {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT * FROM Inventory WHERE item_id = ?',
      [id]
    );
    if (existing.length === 0)
      return res.status(404).json({ success: false, message: 'Item not found.' });

    const { item_name, category, project_id, quantity } = req.body;

    // Validate quantity if provided
    if (quantity !== undefined && parseInt(quantity) < 0) {
      return res.status(400).json({ success: false, message: 'Quantity cannot be negative.' });
    }

    // Validate category if provided
    if (category !== undefined) {
      const validCategories = ['Water', 'Medical', 'Education', 'Infrastructure'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Use: ${validCategories.join(', ')}`,
        });
      }
    }

    // Recalculate status from the effective quantity
    const newQty = quantity !== undefined ? parseInt(quantity) : existing[0].quantity;
    const status = calcStatus(newQty);

    const allowedFields = ['item_name', 'category', 'project_id', 'quantity'];
    const updates = allowedFields
      .filter(f => req.body[f] !== undefined)
      .map(f => `${f} = ?`);
    const values = allowedFields
      .filter(f => req.body[f] !== undefined)
      .map(f => req.body[f]);

    // Always append status recalculation
    updates.push('status = ?');
    values.push(status);

    // If only status would change (no real field sent), reject
    if (updates.length === 1) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    await pool.query(
      `UPDATE Inventory SET ${updates.join(', ')} WHERE item_id = ?`,
      [...values, id]
    );

    return res.status(200).json({
      success: true,
      message: 'Item updated. Status recalculated.',
      data:    { item_id: parseInt(id), new_quantity: newQty, status },
    });
  } catch (err) {
    console.error('inventory update error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 6: PATCH /api/inventory/:id/adjust (stock quantity only) ────────────
// This is what the "Modify Levels" button calls.
async function adjustStock(req, res) {
  try {
    const { id } = req.params;
    const { quantity, reason } = req.body;

    if (quantity === undefined || parseInt(quantity) < 0) {
      return res.status(400).json({
        success: false,
        message: 'quantity is required and must be >= 0.',
      });
    }

    const [existing] = await pool.query(
      'SELECT item_id, item_name, quantity FROM Inventory WHERE item_id = ?',
      [id]
    );
    if (existing.length === 0)
      return res.status(404).json({ success: false, message: 'Item not found.' });

    const oldQty = existing[0].quantity;
    const newQty = parseInt(quantity);
    const status = calcStatus(newQty);

    await pool.query(
      'UPDATE Inventory SET quantity = ?, status = ? WHERE item_id = ?',
      [newQty, status, id]
    );

    return res.status(200).json({
      success: true,
      message: `Stock adjusted for "${existing[0].item_name}".`,
      data: {
        item_id:           parseInt(id),
        previous_quantity: oldQty,
        new_quantity:      newQty,
        status,
        reason:            reason || 'Manual adjustment',
      },
    });
  } catch (err) {
    console.error('inventory adjustStock error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 7: DELETE /api/inventory/:id (guard delete) ─────────────────────────
// Blocks deletion if the item has any Aid_Distribution history.
async function remove(req, res) {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT item_id, item_name FROM Inventory WHERE item_id = ?',
      [id]
    );
    if (existing.length === 0)
      return res.status(404).json({ success: false, message: 'Item not found.' });

    // Block delete if item has distribution history
    const [distributions] = await pool.query(
      'SELECT distribution_id FROM Aid_Distribution WHERE item_id = ?',
      [id]
    );
    if (distributions.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete "${existing[0].item_name}". It has ${distributions.length} aid distribution record(s). Set quantity to 0 instead.`,
      });
    }

    await pool.query('DELETE FROM Inventory WHERE item_id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: `"${existing[0].item_name}" removed from inventory.`,
    });
  } catch (err) {
    console.error('inventory remove error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 8: GET /api/inventory/low-stock ─────────────────────────────────────
// Supports optional ?threshold=N (default 10). Used by dashboard alert chips.
async function getLowStock(req, res) {
  try {
    const threshold = parseInt(req.query.threshold) || 10;

    const [rows] = await pool.query(
      `SELECT
         i.item_id, i.item_name, i.quantity, i.category, i.status,
         CASE
           WHEN p.project_name IS NOT NULL
           THEN CONCAT(p.project_name, ' (', l.district, ')')
           ELSE 'General Reserve'
         END AS assigned_project
       FROM Inventory i
       LEFT JOIN Project  p ON p.project_id  = i.project_id
       LEFT JOIN Location l ON l.location_id = p.location_id
       WHERE i.quantity < ?
       ORDER BY i.quantity ASC`,
      [threshold]
    );

    return res.status(200).json({
      success:   true,
      threshold,
      count:     rows.length,
      data:      rows,
    });
  } catch (err) {
    console.error('inventory getLowStock error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 9: GET /api/inventory/by-project/:projectId ─────────────────────────
async function getByProject(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         i.item_id, i.item_name, i.quantity, i.category, i.status,
         COALESCE(SUM(ad.quantity_given), 0) AS total_distributed,
         COUNT(ad.distribution_id)           AS distribution_events
       FROM Inventory i
       LEFT JOIN Aid_Distribution ad ON ad.item_id = i.item_id
       WHERE i.project_id = ?
       GROUP BY i.item_id
       ORDER BY
         CASE i.status
           WHEN 'Out of Stock' THEN 1
           WHEN 'Low Stock'    THEN 2
           ELSE 3
         END,
         i.item_name ASC`,
      [req.params.projectId]
    );

    return res.status(200).json({
      success: true,
      count:   rows.length,
      data:    rows,
    });
  } catch (err) {
    console.error('inventory getByProject error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API 10: GET /api/inventory/categories ───────────────────────────────────
// Returns static valid category list + live counts/totals from DB.
async function getCategories(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT category, COUNT(*) AS item_count, SUM(quantity) AS total_units
       FROM Inventory
       GROUP BY category
       ORDER BY category`
    );

    return res.status(200).json({
      success:          true,
      valid_categories: ['Water', 'Medical', 'Education', 'Infrastructure'],
      data:             rows,
    });
  } catch (err) {
    console.error('inventory getCategories error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── Legacy: GET /api/inventory/dropdown (kept for Module 7 dispatch form) ───
// Returns items with quantity > 0 for use in the dispatch form selector.
async function getDropdown(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT item_id, item_name, category, quantity
       FROM Inventory
       WHERE quantity > 0
       ORDER BY item_name ASC`
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('inventory getDropdown error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = {
  getSummary,
  getAll,
  getById,
  create,
  update,
  adjustStock,
  remove,
  getLowStock,
  getByProject,
  getCategories,
  getDropdown,
};
