const { pool } = require('../config/db');

// ─── API: GET /api/projects/summary ──────────────────────────────────────────
async function getSummary(req, res) {
  try {
    const [[summary]] = await pool.query(`
      SELECT
        COUNT(*)                                              AS total_projects,
        SUM(status IN ('Active','Ongoing'))                   AS active_projects,
        SUM(status = 'Completed')                             AS completed_projects,
        COALESCE(SUM(budget), 0)                              AS total_budget,
        COALESCE(SUM(budget_used), 0)                         AS total_spent,
        COALESCE(SUM(budget - budget_used), 0)                AS remaining_budget
      FROM Project
    `);
    return res.json({ success: true, data: summary });
  } catch (err) {
    console.error('projects getSummary error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API: GET /api/projects/locations ────────────────────────────────────────
async function getLocations(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT location_id, village_name, district, region FROM Location ORDER BY district, village_name'
    );
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('projects getLocations error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API: GET /api/projects ───────────────────────────────────────────────────
async function getAll(req, res) {
  try {
    const { search, status, sector, location_id, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where  = ['1=1'];
    let params = [];

    if (search)      { where.push('p.project_name LIKE ?');   params.push(`%${search}%`); }
    if (status)      { where.push('p.status = ?');            params.push(status); }
    if (sector)      { where.push('p.sector = ?');            params.push(sector); }
    if (location_id) { where.push('p.location_id = ?');       params.push(location_id); }

    const whereStr = where.join(' AND ');

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM Project p WHERE ${whereStr}`, params
    );

    const [rows] = await pool.query(
      `SELECT
         p.*,
         l.village_name, l.district, l.region,
         ROUND((p.budget_used / NULLIF(p.budget, 0)) * 100, 1) AS budget_utilization_pct,
         COUNT(DISTINCT ad.distribution_id)   AS distribution_count,
         COUNT(DISTINCT pv.volunteer_id)       AS volunteer_count
       FROM Project p
       LEFT JOIN Location l          ON l.location_id      = p.location_id
       LEFT JOIN Aid_Distribution ad ON ad.project_id      = p.project_id
       LEFT JOIN Project_Volunteer pv ON pv.project_id     = p.project_id
       WHERE ${whereStr}
       GROUP BY p.project_id
       ORDER BY p.project_id DESC
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
    console.error('projects getAll error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API: GET /api/projects/:id ───────────────────────────────────────────────
async function getById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         p.*,
         l.village_name, l.district, l.region, l.population,
         ROUND((p.budget_used / NULLIF(p.budget, 0)) * 100, 1) AS budget_utilization_pct,
         COUNT(DISTINCT ad.distribution_id)   AS distribution_count,
         COUNT(DISTINCT ad.beneficiary_id)    AS beneficiaries_served,
         COUNT(DISTINCT pv.volunteer_id)       AS volunteer_count
       FROM Project p
       LEFT JOIN Location l           ON l.location_id   = p.location_id
       LEFT JOIN Aid_Distribution ad  ON ad.project_id   = p.project_id
       LEFT JOIN Project_Volunteer pv ON pv.project_id   = p.project_id
       WHERE p.project_id = ?
       GROUP BY p.project_id`,
      [req.params.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Project not found.' });

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('projects getById error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API: POST /api/projects ──────────────────────────────────────────────────
async function create(req, res) {
  try {
    const { location_id, project_name, sector, start_date, end_date, budget, status } = req.body;

    if (!project_name || !sector || !start_date || !end_date || budget === undefined)
      return res.status(400).json({
        success: false,
        message: 'project_name, sector, start_date, end_date, and budget are required.',
      });

    if (parseFloat(budget) < 0)
      return res.status(400).json({ success: false, message: 'Budget cannot be negative.' });

    if (location_id) {
      const [loc] = await pool.query('SELECT location_id FROM Location WHERE location_id = ?', [location_id]);
      if (loc.length === 0)
        return res.status(404).json({ success: false, message: 'Location not found.' });
    }

    const validStatuses = ['Active', 'Ongoing', 'Completed', 'Pending', 'On Hold'];
    const finalStatus   = validStatuses.includes(status) ? status : 'Active';

    const [result] = await pool.query(
      `INSERT INTO Project (location_id, project_name, sector, start_date, end_date, budget, budget_used, status)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [location_id || null, project_name, sector, start_date, end_date, parseFloat(budget), finalStatus]
    );

    return res.status(201).json({
      success: true,
      message: 'Project created successfully.',
      data: { project_id: result.insertId },
    });
  } catch (err) {
    console.error('projects create error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API: PUT /api/projects/:id ───────────────────────────────────────────────
async function update(req, res) {
  try {
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM Project WHERE project_id = ?', [id]);
    if (existing.length === 0)
      return res.status(404).json({ success: false, message: 'Project not found.' });

    const p = existing[0];
    const {
      location_id  = p.location_id,
      project_name = p.project_name,
      sector       = p.sector,
      start_date   = p.start_date,
      end_date     = p.end_date,
      budget       = p.budget,
      budget_used  = p.budget_used,
      status       = p.status,
    } = req.body;

    await pool.query(
      `UPDATE Project
       SET location_id=?, project_name=?, sector=?, start_date=?, end_date=?, budget=?, budget_used=?, status=?
       WHERE project_id=?`,
      [location_id, project_name, sector, start_date, end_date,
       parseFloat(budget), parseFloat(budget_used), status, id]
    );

    return res.json({ success: true, message: 'Project updated.' });
  } catch (err) {
    console.error('projects update error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API: DELETE /api/projects/:id ────────────────────────────────────────────
async function remove(req, res) {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT project_id, project_name FROM Project WHERE project_id = ?', [id]
    );
    if (existing.length === 0)
      return res.status(404).json({ success: false, message: 'Project not found.' });

    // Guard: has active distributions?
    const [dists] = await pool.query(
      'SELECT distribution_id FROM Aid_Distribution WHERE project_id = ?', [id]
    );
    if (dists.length > 0)
      return res.status(409).json({
        success: false,
        message: `Cannot delete "${existing[0].project_name}". It has ${dists.length} aid distribution record(s).`,
      });

    await pool.query('DELETE FROM Project WHERE project_id = ?', [id]);
    return res.json({ success: true, message: `Project "${existing[0].project_name}" deleted.` });
  } catch (err) {
    console.error('projects remove error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── API: GET /api/projects/budget-summary ────────────────────────────────────
async function getBudgetSummary(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        project_id, project_name, sector, status,
        budget, budget_used,
        budget - budget_used                                  AS remaining,
        ROUND((budget_used / NULLIF(budget, 0)) * 100, 1)    AS utilization_pct
      FROM Project
      ORDER BY utilization_pct DESC
      LIMIT 20
    `);
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('projects getBudgetSummary error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { getSummary, getLocations, getAll, getById, create, update, remove, getBudgetSummary };
