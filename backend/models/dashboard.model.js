const { pool } = require('../config/db');

async function getDashboardSummary() {
  const [rows] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM Beneficiary) AS totalBeneficiaries,
      IFNULL((SELECT SUM(amount) FROM Donation), 0) AS totalFundsRaised,
      (SELECT COUNT(*) FROM Project WHERE LOWER(status) IN ('active','ongoing','approved','in progress','in-progress')) AS activeProjects,
      (SELECT COUNT(*) FROM Inventory WHERE quantity < 10 OR LOWER(status) LIKE '%low%') AS lowInventory
  `);
  return rows[0] || { totalBeneficiaries: 0, totalFundsRaised: 0, activeProjects: 0, lowInventory: 0 };
}

async function getProjectBudgets() {
  const [rows] = await pool.query(
    `SELECT project_id, project_name, budget, budget_used, status FROM Project ORDER BY project_id ASC LIMIT 10`
  );
  return rows;
}

async function getRecentAidDistributions() {
  const [rows] = await pool.query(`
    SELECT
      a.distribution_id,
      b.name AS beneficiary_name,
      l.village_name AS village,
      i.item_name,
      p.project_name,
      DATE_FORMAT(a.distribution_date, '%d %b %Y') AS date,
      CASE
        WHEN LOWER(a.notes) LIKE '%delay%' THEN 'Delayed'
        WHEN LOWER(a.notes) LIKE '%scheduled%' THEN 'Scheduled'
        ELSE 'Delivered'
      END AS status
    FROM Aid_Distribution a
    LEFT JOIN Beneficiary b ON a.beneficiary_id = b.beneficiary_id
    LEFT JOIN Project p ON a.project_id = p.project_id
    LEFT JOIN Inventory i ON a.item_id = i.item_id
    LEFT JOIN Location l ON b.location_id = l.location_id
    ORDER BY a.distribution_date DESC
    LIMIT 6
  `);
  return rows;
}

async function getCoverageByRegion() {
  const [rows] = await pool.query(`
    SELECT
      region,
      COUNT(DISTINCT l.location_id) AS locations,
      COUNT(DISTINCT b.beneficiary_id) AS beneficiaries
    FROM Location l
    LEFT JOIN Beneficiary b ON b.location_id = l.location_id
    GROUP BY region
    ORDER BY COUNT(DISTINCT l.location_id) DESC
    LIMIT 5
  `);
  return rows;
}

async function getActivityFeed() {
  const [rows] = await pool.query(`
    SELECT activity_type, title, description, event_date, meta
    FROM (
      SELECT 'beneficiary' AS activity_type,
        b.name AS title,
        CONCAT('Registered as new beneficiary in ', l.village_name, '.') AS description,
        NULL AS meta,
        DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS event_date,
        1 AS sort_order
      FROM Beneficiary b
      LEFT JOIN Location l ON b.location_id = l.location_id
      UNION ALL
      SELECT 'donation',
        CONCAT('Donation #', d.donation_id),
        CONCAT('Donation of ₨', FORMAT(d.amount, 0), ' received for ', COALESCE(p.project_name, 'general operations'), '.'),
        NULL,
        d.donation_date,
        2
      FROM Donation d
      LEFT JOIN Donation_Allocation da ON da.donation_id = d.donation_id
      LEFT JOIN Project p ON da.project_id = p.project_id
      UNION ALL
      SELECT 'distribution',
        CONCAT('Aid distribution #', a.distribution_id),
        CONCAT('Distributed ', COALESCE(i.item_name, 'items'), ' to ', COALESCE(b.name, 'beneficiary'), '.'),
        NULL,
        a.distribution_date,
        3
      FROM Aid_Distribution a
      LEFT JOIN Beneficiary b ON a.beneficiary_id = b.beneficiary_id
      LEFT JOIN Inventory i ON a.item_id = i.item_id
    ) AS feed
    ORDER BY event_date DESC
    LIMIT 6
  `);
  return rows.map((row) => ({
    type: row.activity_type,
    title: row.title,
    description: row.description,
    date: row.event_date,
    meta: row.meta,
  }));
}

module.exports = {
  getDashboardSummary,
  getProjectBudgets,
  getRecentAidDistributions,
  getCoverageByRegion,
  getActivityFeed,
};
