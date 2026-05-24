const { pool } = require('../config/db');

async function getStats() {
  const [rows] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM Beneficiary WHERE status = 'Active') AS total_beneficiaries,
      (SELECT COALESCE(SUM(amount), 0) FROM Donation 
       WHERE status != 'Pending' AND YEAR(donation_date) = YEAR(CURDATE())) AS total_funds_pkr,
      (SELECT COUNT(*) FROM Project WHERE status = 'Active') AS active_projects,
      (SELECT COUNT(*) FROM Inventory WHERE quantity < 10) AS low_inventory_count,
      (SELECT COUNT(*) FROM Volunteer) AS available_volunteers,
      (SELECT COUNT(*) FROM Aid_Distribution 
       WHERE MONTH(distribution_date) = MONTH(CURDATE()) 
         AND YEAR(distribution_date) = YEAR(CURDATE())) AS distributions_this_month
  `);
  return rows[0];
}

async function getRecentDistributions() {
  const [rows] = await pool.query(`
    SELECT
      ad.distribution_id,
      ad.distribution_date,
      ad.quantity_given,
      'Delivered' AS status,
      b.beneficiary_id,
      b.name AS beneficiary_name,
      b.cnic,
      i.item_name,
      i.category,
      p.project_name,
      l.village_name,
      l.district
    FROM Aid_Distribution ad
    LEFT JOIN Beneficiary b ON ad.beneficiary_id = b.beneficiary_id
    LEFT JOIN Inventory i ON ad.item_id = i.item_id
    LEFT JOIN Project p ON ad.project_id = p.project_id
    LEFT JOIN Location l ON b.location_id = l.location_id
    WHERE ad.distribution_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    ORDER BY ad.distribution_date DESC
    LIMIT 20
  `);
  return rows;
}

async function getBudgetSummary() {
  const [rows] = await pool.query(`
    SELECT
      p.project_id,
      p.project_name,
      p.sector,
      p.status AS db_status,
      p.budget,
      p.budget_used,
      ROUND(
        CASE WHEN p.budget > 0
             THEN (p.budget_used / p.budget) * 100
             ELSE 0 END, 1
      ) AS usage_percent,
      l.village_name,
      l.district
    FROM Project p
    JOIN Location l ON p.location_id = l.location_id
    ORDER BY usage_percent DESC
  `);
  return rows;
}

async function getRecentActivity() {
  const [beneficiaries] = await pool.query(`
    SELECT
      'beneficiary' AS type,
      'green' AS dot_color,
      b.beneficiary_id AS record_id,
      CONCAT(b.name, ' registered as new beneficiary in ', l.village_name, ' village.')
        AS description,
      CURDATE() AS created_at
    FROM Beneficiary b
    LEFT JOIN Location l ON b.location_id = l.location_id
    LIMIT 20
  `);

  const [donations] = await pool.query(`
    SELECT
      'donation' AS type,
      'amber' AS dot_color,
      d.donation_id AS record_id,
      CONCAT('Donation of ₨', FORMAT(d.amount, 0), ' received from ', dn.donor_name, '.')
        AS description,
      d.donation_date AS created_at
    FROM Donation d
    LEFT JOIN Donor dn ON d.donor_id = dn.donor_id
    LIMIT 20
  `);

  const [volunteers] = await pool.query(`
    SELECT
      'volunteer' AS type,
      'blue' AS dot_color,
      pv.proj_vol_id AS record_id,
      CONCAT(v.volunteer_name, ' assigned to ', p.project_name, ', ', l.district, '.')
        AS description,
      CURDATE() AS created_at
    FROM Project_Volunteer pv
    LEFT JOIN Volunteer v ON pv.volunteer_id = v.volunteer_id
    LEFT JOIN Project p ON pv.project_id = p.project_id
    LEFT JOIN Location l ON p.location_id = l.location_id
    LIMIT 20
  `);

  const [lowStock] = await pool.query(`
    SELECT
      'inventory' AS type,
      'red' AS dot_color,
      i.item_id AS record_id,
      CONCAT(i.item_name, ' stock dropped below minimum threshold.')
        AS description,
      CURDATE() AS created_at
    FROM Inventory i
    WHERE i.quantity < 10
    LIMIT 20
  `);

  const all = [...beneficiaries, ...donations, ...volunteers, ...lowStock]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);

  return all;
}

async function getCoverage() {
  const [regions] = await pool.query(`
    SELECT
      l.region,
      l.district,
      COUNT(DISTINCT l.location_id) AS village_count,
      COUNT(DISTINCT p.project_id) AS active_projects,
      COUNT(DISTINCT b.beneficiary_id) AS total_beneficiaries
    FROM Location l
    LEFT JOIN Project p ON l.location_id = p.location_id AND p.status = 'Active'
    LEFT JOIN Beneficiary b ON l.location_id = b.location_id AND b.status = 'Active'
    GROUP BY l.region, l.district
    ORDER BY l.region ASC
  `);

  const [villages] = await pool.query(`
    SELECT
      l.location_id,
      l.village_name,
      l.district,
      l.region,
      l.population,
      COUNT(DISTINCT b.beneficiary_id) AS beneficiary_count,
      COUNT(DISTINCT p.project_id) AS project_count
    FROM Location l
    LEFT JOIN Beneficiary b ON l.location_id = b.location_id AND b.status = 'Active'
    LEFT JOIN Project p ON l.location_id = p.location_id AND p.status = 'Active'
    GROUP BY l.location_id, l.village_name, l.district, l.region, l.population
    ORDER BY l.region, l.village_name ASC
  `);

  return { regions, villages };
}

module.exports = {
  getStats,
  getRecentDistributions,
  getBudgetSummary,
  getRecentActivity,
  getCoverage,
};
