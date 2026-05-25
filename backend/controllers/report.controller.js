const { pool } = require('../config/db');

// ─── GET /api/reports/financial ───────────────────────────────────────────────
async function getFinancialSummary(req, res) {
  try {
    const [[summary]] = await pool.query(`
      SELECT
        COALESCE(SUM(d.amount), 0)                                    AS total_donations,
        COALESCE(SUM(CASE WHEN d.status='Received' THEN d.amount END), 0) AS received,
        COALESCE(SUM(CASE WHEN d.status='Pending'  THEN d.amount END), 0) AS pending,
        COUNT(DISTINCT d.donor_id)                                    AS unique_donors,
        COUNT(d.donation_id)                                          AS total_transactions
      FROM Donation d
    `);

    const [[spendSummary]] = await pool.query(`
      SELECT
        COALESCE(SUM(budget_used), 0)  AS total_spent,
        COALESCE(SUM(budget), 0)       AS total_budgeted,
        COUNT(*)                       AS total_projects
      FROM Project
    `);

    const [byMonth] = await pool.query(`
      SELECT
        DATE_FORMAT(donation_date, '%Y-%m') AS month,
        COUNT(*)                             AS count,
        SUM(amount)                          AS total
      FROM Donation
      GROUP BY DATE_FORMAT(donation_date, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `);

    const [byType] = await pool.query(`
      SELECT type, COUNT(*) AS count, SUM(amount) AS total
      FROM Donation
      GROUP BY type
    `);

    return res.json({
      success: true,
      data: {
        summary: { ...summary, ...spendSummary },
        by_month: byMonth,
        by_type:  byType,
      },
    });
  } catch (err) {
    console.error('getFinancialSummary error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── GET /api/reports/donor-impact ────────────────────────────────────────────
async function getDonorImpact(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        dn.donor_id,
        dn.donor_name,
        dn.type AS donor_type,
        COUNT(DISTINCT d.donation_id)          AS donations_made,
        COALESCE(SUM(d.amount), 0)             AS total_contributed,
        COUNT(DISTINCT da.project_id)          AS projects_funded,
        COUNT(DISTINCT ad.beneficiary_id)      AS beneficiaries_impacted
      FROM Donor dn
      LEFT JOIN Donation d              ON d.donor_id        = dn.donor_id
      LEFT JOIN Donation_Allocation da  ON da.donation_id    = d.donation_id
      LEFT JOIN Aid_Distribution ad     ON ad.project_id     = da.project_id
      GROUP BY dn.donor_id
      ORDER BY total_contributed DESC
    `);

    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('getDonorImpact error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── GET /api/reports/beneficiaries ───────────────────────────────────────────
async function getBeneficiaryReport(req, res) {
  try {
    const [[summary]] = await pool.query(`
      SELECT
        COUNT(*)                          AS total_beneficiaries,
        SUM(status = 'approved')          AS approved,
        SUM(status = 'pending')           AS pending,
        AVG(age)                          AS avg_age,
        AVG(household_size)               AS avg_household_size
      FROM Beneficiary
    `);

    const [byRegion] = await pool.query(`
      SELECT l.region, l.district, COUNT(b.beneficiary_id) AS count
      FROM Beneficiary b
      LEFT JOIN Location l ON l.location_id = b.location_id
      GROUP BY l.region, l.district
      ORDER BY count DESC
    `);

    const [topNeeds] = await pool.query(`
      SELECT
        b.beneficiary_id, b.name, b.cnic, b.age, b.household_size,
        l.village_name, l.district,
        COUNT(ad.distribution_id)            AS times_aided,
        COALESCE(SUM(ad.quantity_given), 0)  AS total_units_received
      FROM Beneficiary b
      LEFT JOIN Location l          ON l.location_id   = b.location_id
      LEFT JOIN Aid_Distribution ad ON ad.beneficiary_id = b.beneficiary_id
      GROUP BY b.beneficiary_id
      ORDER BY times_aided DESC
      LIMIT 20
    `);

    return res.json({
      success: true,
      data: { summary, by_region: byRegion, top_beneficiaries: topNeeds },
    });
  } catch (err) {
    console.error('getBeneficiaryReport error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── GET /api/reports/inventory ───────────────────────────────────────────────
async function getInventoryReport(req, res) {
  try {
    const [[summary]] = await pool.query(`
      SELECT
        COUNT(*)                          AS total_items,
        SUM(quantity)                     AS total_units,
        SUM(status = 'In Stock')          AS in_stock,
        SUM(status = 'Low Stock')         AS low_stock,
        SUM(status = 'Out of Stock')      AS out_of_stock,
        COUNT(DISTINCT category)          AS categories
      FROM Inventory
    `);

    const [byCategory] = await pool.query(`
      SELECT category,
             COUNT(*)     AS item_count,
             SUM(quantity) AS total_units,
             SUM(status = 'Low Stock') + SUM(status = 'Out of Stock') AS alerts
      FROM Inventory
      GROUP BY category
    `);

    const [lowStock] = await pool.query(`
      SELECT i.item_id, i.item_name, i.category, i.quantity, i.status,
             COALESCE(p.project_name, 'General Reserve') AS project_name,
             COALESCE(SUM(ad.quantity_given), 0)         AS total_distributed
      FROM Inventory i
      LEFT JOIN Project          p  ON p.project_id  = i.project_id
      LEFT JOIN Aid_Distribution ad ON ad.item_id    = i.item_id
      WHERE i.quantity < 10
      GROUP BY i.item_id
      ORDER BY i.quantity ASC
    `);

    return res.json({
      success: true,
      data: { summary, by_category: byCategory, low_stock_items: lowStock },
    });
  } catch (err) {
    console.error('getInventoryReport error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── GET /api/reports/projects ────────────────────────────────────────────────
async function getProjectReport(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        p.project_id, p.project_name, p.sector, p.status,
        p.start_date, p.end_date,
        p.budget, p.budget_used,
        ROUND((p.budget_used / NULLIF(p.budget,0)) * 100, 1) AS utilization_pct,
        l.village_name, l.district, l.region,
        COUNT(DISTINCT ad.distribution_id)  AS distributions,
        COUNT(DISTINCT ad.beneficiary_id)   AS beneficiaries_reached,
        COUNT(DISTINCT pv.volunteer_id)      AS volunteers_deployed,
        COALESCE(SUM(ad.quantity_given), 0) AS units_distributed
      FROM Project p
      LEFT JOIN Location          l  ON l.location_id  = p.location_id
      LEFT JOIN Aid_Distribution  ad ON ad.project_id  = p.project_id
      LEFT JOIN Project_Volunteer pv ON pv.project_id  = p.project_id
      GROUP BY p.project_id
      ORDER BY p.project_id DESC
    `);

    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('getProjectReport error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── GET /api/reports/distributions ──────────────────────────────────────────
async function getDistributionReport(req, res) {
  try {
    const { from_date, to_date } = req.query;

    let where  = ['1=1'];
    let params = [];
    if (from_date) { where.push('ad.distribution_date >= ?'); params.push(from_date); }
    if (to_date)   { where.push('ad.distribution_date <= ?'); params.push(to_date); }
    const whereStr = where.join(' AND ');

    const [[summary]] = await pool.query(
      `SELECT COUNT(*) AS total_events, COALESCE(SUM(ad.quantity_given),0) AS total_units,
              COUNT(DISTINCT ad.beneficiary_id) AS beneficiaries, COUNT(DISTINCT ad.project_id) AS projects
       FROM Aid_Distribution ad WHERE ${whereStr}`,
      params
    );

    const [byItem] = await pool.query(
      `SELECT i.item_name, i.category,
              COUNT(ad.distribution_id)  AS events,
              SUM(ad.quantity_given)     AS total_given
       FROM Aid_Distribution ad
       JOIN Inventory i ON i.item_id = ad.item_id
       WHERE ${whereStr}
       GROUP BY i.item_id ORDER BY total_given DESC`,
      params
    );

    const [byProject] = await pool.query(
      `SELECT p.project_name, p.sector,
              COUNT(ad.distribution_id)              AS events,
              SUM(ad.quantity_given)                  AS total_given,
              COUNT(DISTINCT ad.beneficiary_id)       AS beneficiaries
       FROM Aid_Distribution ad
       JOIN Project p ON p.project_id = ad.project_id
       WHERE ${whereStr}
       GROUP BY p.project_id ORDER BY total_given DESC`,
      params
    );

    return res.json({
      success: true,
      data: { summary, by_item: byItem, by_project: byProject },
    });
  } catch (err) {
    console.error('getDistributionReport error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = {
  getFinancialSummary,
  getDonorImpact,
  getBeneficiaryReport,
  getInventoryReport,
  getProjectReport,
  getDistributionReport,
};
