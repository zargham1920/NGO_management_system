const { pool } = require('../config/db');

// ─── API: GET /api/volunteers ─────────────────────────────────────────────────
async function getAll(req, res) {
  try {
    const { search, availability, skill, page = 1, limit = 15 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where  = ['1=1'];
    let params = [];

    if (search)       { where.push('(v.name LIKE ? OR v.email LIKE ? OR v.phone LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (availability) { where.push('v.availability = ?'); params.push(availability); }
    if (skill)        { where.push('v.skills LIKE ?');    params.push(`%${skill}%`); }

    const whereStr = where.join(' AND ');

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM Volunteer v WHERE ${whereStr}`, params
    );

    const [rows] = await pool.query(
      `SELECT v.*,
              COUNT(DISTINCT pv.project_id) AS projects_assigned
       FROM Volunteer v
       LEFT JOIN Project_Volunteer pv ON pv.volunteer_id = v.volunteer_id
       WHERE ${whereStr}
       GROUP BY v.volunteer_id
       ORDER BY v.volunteer_id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    return res.json({
      success:     true,
      total,
      page:        parseInt(page),
      total_pages: Math.ceil(total / parseInt(limit)),
      count:       rows.length,
      data:        rows,
    });
  } catch (err) {
    console.error('volunteers getAll error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API: GET /api/volunteers/by-project/:projectId ───────────────────────────
async function getByProject(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT v.*, pv.assigned_date, pv.role_in_project
       FROM Project_Volunteer pv
       JOIN Volunteer v ON v.volunteer_id = pv.volunteer_id
       WHERE pv.project_id = ?
       ORDER BY pv.assigned_date DESC`,
      [req.params.projectId]
    );
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('volunteers getByProject error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API: GET /api/volunteers/:id ─────────────────────────────────────────────
async function getById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT v.*,
              COUNT(DISTINCT pv.project_id) AS projects_assigned
       FROM Volunteer v
       LEFT JOIN Project_Volunteer pv ON pv.volunteer_id = v.volunteer_id
       WHERE v.volunteer_id = ?
       GROUP BY v.volunteer_id`,
      [req.params.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Volunteer not found.' });

    // Fetch their project assignments
    const [projects] = await pool.query(
      `SELECT p.project_id, p.project_name, p.status, pv.assigned_date, pv.role_in_project
       FROM Project_Volunteer pv
       JOIN Project p ON p.project_id = pv.project_id
       WHERE pv.volunteer_id = ?`,
      [req.params.id]
    );

    return res.json({ success: true, data: { ...rows[0], assignments: projects } });
  } catch (err) {
    console.error('volunteers getById error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API: POST /api/volunteers ────────────────────────────────────────────────
async function create(req, res) {
  try {
    const { name, email, phone, skills, availability, address } = req.body;

    if (!name)
      return res.status(400).json({ success: false, message: 'name is required.' });

    // Prevent duplicate email
    if (email) {
      const [existing] = await pool.query('SELECT volunteer_id FROM Volunteer WHERE email = ?', [email]);
      if (existing.length > 0)
        return res.status(409).json({ success: false, message: 'A volunteer with this email already exists.' });
    }

    const [result] = await pool.query(
      'INSERT INTO Volunteer (name, email, phone, skills, availability, address) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email || '', phone || '', skills || '', availability || 'Available', address || '']
    );

    return res.status(201).json({
      success: true,
      message: 'Volunteer registered successfully.',
      data: { volunteer_id: result.insertId },
    });
  } catch (err) {
    console.error('volunteers create error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API: PUT /api/volunteers/:id ────────────────────────────────────────────
async function update(req, res) {
  try {
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM Volunteer WHERE volunteer_id = ?', [id]);
    if (existing.length === 0)
      return res.status(404).json({ success: false, message: 'Volunteer not found.' });

    const v = existing[0];
    const { name = v.name, email = v.email, phone = v.phone, skills = v.skills, availability = v.availability, address = v.address } = req.body;

    await pool.query(
      'UPDATE Volunteer SET name=?, email=?, phone=?, skills=?, availability=?, address=? WHERE volunteer_id=?',
      [name, email, phone, skills, availability, address, id]
    );

    return res.json({ success: true, message: 'Volunteer updated.' });
  } catch (err) {
    console.error('volunteers update error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API: DELETE /api/volunteers/:id ─────────────────────────────────────────
async function remove(req, res) {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT volunteer_id, name FROM Volunteer WHERE volunteer_id = ?', [id]
    );
    if (existing.length === 0)
      return res.status(404).json({ success: false, message: 'Volunteer not found.' });

    // Remove from project assignments first (cascade safe)
    await pool.query('DELETE FROM Project_Volunteer WHERE volunteer_id = ?', [id]);
    await pool.query('DELETE FROM Volunteer WHERE volunteer_id = ?', [id]);

    return res.json({ success: true, message: `Volunteer "${existing[0].name}" removed.` });
  } catch (err) {
    console.error('volunteers remove error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API: POST /api/volunteers/:id/assign ────────────────────────────────────
async function assignToProject(req, res) {
  try {
    const { id } = req.params;
    const { project_id, role_in_project, assigned_date } = req.body;

    if (!project_id)
      return res.status(400).json({ success: false, message: 'project_id is required.' });

    const [vol] = await pool.query('SELECT volunteer_id FROM Volunteer WHERE volunteer_id = ?', [id]);
    if (vol.length === 0)
      return res.status(404).json({ success: false, message: 'Volunteer not found.' });

    const [proj] = await pool.query('SELECT project_id FROM Project WHERE project_id = ?', [project_id]);
    if (proj.length === 0)
      return res.status(404).json({ success: false, message: 'Project not found.' });

    // Check if already assigned
    const [existing] = await pool.query(
      'SELECT pv_id FROM Project_Volunteer WHERE volunteer_id = ? AND project_id = ?',
      [id, project_id]
    );
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: 'Volunteer is already assigned to this project.' });

    await pool.query(
      'INSERT INTO Project_Volunteer (volunteer_id, project_id, role_in_project, assigned_date) VALUES (?, ?, ?, ?)',
      [id, project_id, role_in_project || 'General', assigned_date || new Date().toISOString().slice(0, 10)]
    );

    return res.status(201).json({ success: true, message: 'Volunteer assigned to project.' });
  } catch (err) {
    console.error('volunteers assignToProject error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { getAll, getByProject, getById, create, update, remove, assignToProject };
