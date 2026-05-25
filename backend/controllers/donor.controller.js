const donorModel = require('../models/donor.model');
const { pool }   = require('../config/db');

// ─── DONOR CRUD ──────────────────────────────────────────────────────────────

// GET /api/donors?search=&type=&page=&limit=
exports.getAll = async (req, res) => {
  try {
    const { search, type, page = 1, limit = 15 } = req.query;
    const result = await donorModel.getAll({ page, limit, search, type });
    res.json({
      success:     true,
      total:       result.total,
      page:        parseInt(page),
      total_pages: Math.ceil(result.total / parseInt(limit)),
      count:       result.rows.length,
      data:        result.rows,
    });
  } catch (err) {
    console.error('getAll donors error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/donors/:id
exports.getById = async (req, res) => {
  try {
    const donor = await donorModel.getById(req.params.id);
    if (!donor)
      return res.status(404).json({ success: false, message: 'Donor not found.' });

    const donationHistory = await donorModel.getDonationHistory(req.params.id);
    res.json({ success: true, data: { ...donor, donations: donationHistory } });
  } catch (err) {
    console.error('getById donor error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/donors
exports.create = async (req, res) => {
  try {
    const { donor_name, name, contact, type, email } = req.body;
    const finalName = donor_name || name;

    if (!finalName)
      return res.status(400).json({ success: false, message: 'donor_name is required.' });

    // Prevent duplicate emails
    if (email) {
      const existing = await donorModel.findByEmail(email);
      if (existing)
        return res.status(409).json({ success: false, message: 'A donor with this email already exists.' });
    }

    const donorId = await donorModel.create({
      donor_name: finalName,
      contact,
      type: type || 'Individual',
      email: email || '',
    });

    res.status(201).json({
      success: true,
      message: 'Donor added successfully.',
      data: { donor_id: donorId },
    });
  } catch (err) {
    console.error('create donor error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/donors/:id
exports.update = async (req, res) => {
  try {
    const existing = await donorModel.getById(req.params.id);
    if (!existing)
      return res.status(404).json({ success: false, message: 'Donor not found.' });

    const { donor_name, name, contact, type, email } = req.body;
    const finalName = donor_name || name;

    // If email changed, check uniqueness
    if (email && email !== existing.email) {
      const emailTaken = await donorModel.findByEmail(email);
      if (emailTaken)
        return res.status(409).json({ success: false, message: 'A donor with this email already exists.' });
    }

    const updated = await donorModel.update(req.params.id, {
      donor_name: finalName || existing.donor_name,
      contact:    contact   ?? existing.contact,
      type:       type      || existing.type,
      email:      email     ?? existing.email,
    });

    if (!updated)
      return res.status(404).json({ success: false, message: 'Donor not found.' });

    res.json({ success: true, message: 'Donor updated successfully.' });
  } catch (err) {
    console.error('update donor error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/donors/:id
exports.delete = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    await connection.beginTransaction();

    const existing = await donorModel.getById(id);
    if (!existing) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Donor not found.' });
    }

    // 1. Find all donations of this donor
    const [donations] = await connection.query('SELECT donation_id FROM Donation WHERE donor_id = ?', [id]);

    for (const donation of donations) {
      const donId = donation.donation_id;
      
      // Get allocations for this donation and reverse budgets
      const [allocations] = await connection.query(
        'SELECT project_id, allocated_amount FROM Donation_Allocation WHERE donation_id = ?',
        [donId]
      );
      for (const alloc of allocations) {
        await connection.query(
          'UPDATE Project SET budget_used = budget_used - ? WHERE project_id = ?',
          [alloc.allocated_amount, alloc.project_id]
        );
      }
      
      // Delete allocations
      await connection.query('DELETE FROM Donation_Allocation WHERE donation_id = ?', [donId]);
      
      // Delete donation
      await connection.query('DELETE FROM Donation WHERE donation_id = ?', [donId]);
    }

    // 2. Delete the donor
    await connection.query('DELETE FROM Donor WHERE donor_id = ?', [id]);

    await connection.commit();
    res.json({ success: true, message: `Donor "${existing.donor_name}" and associated donations removed.` });
  } catch (err) {
    await connection.rollback();
    console.error('delete donor error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    connection.release();
  }
};

// ─── DONATION ENDPOINTS ───────────────────────────────────────────────────────

// GET /api/donations?donor_id=&status=&from_date=&to_date=&page=&limit=
exports.getDonations = async (req, res) => {
  try {
    const { donor_id, status, type, from_date, to_date, page = 1, limit = 15 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where  = ['1=1'];
    let params = [];

    if (donor_id)  { where.push('d.donor_id = ?');             params.push(donor_id); }
    if (status)    { where.push('d.status = ?');               params.push(status); }
    if (type)      { where.push('d.type = ?');                 params.push(type); }
    if (from_date) { where.push('d.donation_date >= ?');       params.push(from_date); }
    if (to_date)   { where.push('d.donation_date <= ?');       params.push(to_date); }

    const whereStr = where.join(' AND ');

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM Donation d WHERE ${whereStr}`, params
    );

    const [rows] = await pool.query(
      `SELECT d.*, dn.donor_name
       FROM Donation d
       JOIN Donor dn ON d.donor_id = dn.donor_id
       WHERE ${whereStr}
       ORDER BY d.donation_date DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success:     true,
      total,
      page:        parseInt(page),
      total_pages: Math.ceil(total / parseInt(limit)),
      count:       rows.length,
      data:        rows,
    });
  } catch (err) {
    console.error('getDonations error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/donations
exports.createDonation = async (req, res) => {
  try {
    const { donor_id, amount, donation_date, type, status } = req.body;

    if (!donor_id || !amount)
      return res.status(400).json({ success: false, message: 'donor_id and amount are required.' });

    if (parseFloat(amount) <= 0)
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0.' });

    // Confirm donor exists
    const donor = await donorModel.getById(donor_id);
    if (!donor)
      return res.status(404).json({ success: false, message: 'Donor not found.' });

    const [result] = await pool.query(
      'INSERT INTO Donation (donor_id, amount, donation_date, type, status) VALUES (?, ?, ?, ?, ?)',
      [donor_id, parseFloat(amount), donation_date || new Date().toISOString().split('T')[0], type || 'Cash', status || 'Received']
    );

    res.status(201).json({
      success: true,
      message: 'Donation recorded successfully.',
      data: { donation_id: result.insertId },
    });
  } catch (err) {
    console.error('createDonation error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/donations/:id
exports.updateDonation = async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query('SELECT * FROM Donation WHERE donation_id = ?', [id]);
    if (existing.length === 0)
      return res.status(404).json({ success: false, message: 'Donation not found.' });

    const { donor_id, amount, donation_date, type, status } = req.body;
    const d = existing[0];

    await pool.query(
      'UPDATE Donation SET donor_id=?, amount=?, donation_date=?, type=?, status=? WHERE donation_id=?',
      [donor_id || d.donor_id, amount ?? d.amount, donation_date || d.donation_date, type || d.type, status || d.status, id]
    );

    res.json({ success: true, message: 'Donation updated successfully.' });
  } catch (err) {
    console.error('updateDonation error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/donations/:id
exports.deleteDonation = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    await connection.beginTransaction();

    const [existing] = await connection.query('SELECT * FROM Donation WHERE donation_id = ?', [id]);
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Donation not found.' });
    }

    // 1. Get allocations and reverse the budgets on projects
    const [allocations] = await connection.query(
      'SELECT project_id, allocated_amount FROM Donation_Allocation WHERE donation_id = ?',
      [id]
    );

    for (const alloc of allocations) {
      await connection.query(
        'UPDATE Project SET budget_used = budget_used - ? WHERE project_id = ?',
        [alloc.allocated_amount, alloc.project_id]
      );
    }

    // 2. Delete the allocations
    await connection.query('DELETE FROM Donation_Allocation WHERE donation_id = ?', [id]);

    // 3. Delete the donation
    await connection.query('DELETE FROM Donation WHERE donation_id = ?', [id]);

    await connection.commit();
    res.json({ success: true, message: 'Donation deleted.' });
  } catch (err) {
    await connection.rollback();
    console.error('deleteDonation error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    connection.release();
  }
};

// POST /api/donations/:id/allocate
exports.allocateDonation = async (req, res) => {
  try {
    const { id } = req.params;
    const { project_id, allocated_amount, allocation_date, purpose } = req.body;

    if (!project_id || !allocated_amount)
      return res.status(400).json({ success: false, message: 'project_id and allocated_amount are required.' });

    const [donation] = await pool.query('SELECT * FROM Donation WHERE donation_id = ?', [id]);
    if (donation.length === 0)
      return res.status(404).json({ success: false, message: 'Donation not found.' });

    const [project] = await pool.query('SELECT project_id FROM Project WHERE project_id = ?', [project_id]);
    if (project.length === 0)
      return res.status(404).json({ success: false, message: 'Project not found.' });

    const [result] = await pool.query(
      'INSERT INTO Donation_Allocation (donation_id, project_id, allocated_amount, allocation_date, purpose) VALUES (?, ?, ?, ?, ?)',
      [id, project_id, parseFloat(allocated_amount), allocation_date || new Date().toISOString().split('T')[0], purpose || '']
    );

    // Update budget_used on the project
    await pool.query(
      'UPDATE Project SET budget_used = budget_used + ? WHERE project_id = ?',
      [parseFloat(allocated_amount), project_id]
    );

    res.status(201).json({
      success: true,
      message: 'Donation allocated to project.',
      data: { allocation_id: result.insertId },
    });
  } catch (err) {
    console.error('allocateDonation error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/donations/stats
exports.getDonationStats = async (req, res) => {
  try {
    const [[stats]] = await pool.query(`
      SELECT
        COUNT(DISTINCT donor_id)    AS total_donors,
        COUNT(*)                    AS total_donations,
        COALESCE(SUM(amount), 0)    AS total_amount,
        COALESCE(AVG(amount), 0)    AS avg_donation,
        SUM(status = 'Received')    AS received_count,
        SUM(status = 'Pending')     AS pending_count,
        SUM(amount * (status = 'Received')) AS received_amount
      FROM Donation
    `);
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('getDonationStats error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
