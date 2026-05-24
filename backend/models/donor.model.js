const { pool } = require('../config/db');

async function getSummary() {
  const [rows] = await pool.query(`
    SELECT
      COUNT(DISTINCT dn.donor_id) AS total_donors,
      COALESCE(SUM(CASE WHEN d.status != 'Pending' THEN d.amount ELSE 0 END), 0) AS total_capital_raised,
      COALESCE(SUM(CASE WHEN d.status = 'Received' THEN d.amount ELSE 0 END), 0) AS unallocated_pipeline
    FROM Donor dn
    LEFT JOIN Donation d ON d.donor_id = dn.donor_id
  `);
  return rows[0];
}

async function getAllDonors({ search, type, country, limit, offset }) {
  const where = ['1=1'];
  const params = [];

  if (search) {
    where.push('(dn.donor_name LIKE ? OR dn.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (type) {
    where.push('dn.type = ?');
    params.push(type);
  }
  if (country) {
    where.push('dn.country = ?');
    params.push(country);
  }

  const whereClause = where.join(' AND ');

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM Donor dn WHERE ${whereClause}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT
       dn.donor_id,
       dn.donor_name,
       dn.type,
       dn.email,
       dn.contact,
       dn.country,
       COALESCE(SUM(d.amount), 0) AS total_committed
     FROM Donor dn
     LEFT JOIN Donation d ON d.donor_id = dn.donor_id
     WHERE ${whereClause}
     GROUP BY dn.donor_id
     ORDER BY total_committed DESC, dn.donor_name ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { total: Number(total), rows };
}

async function getDonorById(id) {
  const [rows] = await pool.query(
    `SELECT
       dn.donor_id,
       dn.donor_name,
       dn.type,
       dn.email,
       dn.contact,
       dn.country,
       COALESCE(SUM(d.amount), 0) AS total_contributed,
       COUNT(d.donation_id) AS donation_count
     FROM Donor dn
     LEFT JOIN Donation d ON d.donor_id = dn.donor_id
     WHERE dn.donor_id = ?
     GROUP BY dn.donor_id`,
    [id]
  );
  return rows[0];
}

async function getDonorDonations(donorId) {
  const [rows] = await pool.query(
    `SELECT
       d.donation_id,
       d.amount,
       d.donation_date,
       d.type,
       d.status,
       COALESCE(GROUP_CONCAT(DISTINCT p.project_name SEPARATOR ', '), '') AS allocated_projects,
       COALESCE(SUM(da.allocated_amount), 0) AS allocated_amount,
       COALESCE(GROUP_CONCAT(DISTINCT da.purpose SEPARATOR '; '), '') AS purposes
     FROM Donation d
     LEFT JOIN Donation_Allocation da ON da.donation_id = d.donation_id
     LEFT JOIN Project p ON p.project_id = da.project_id
     WHERE d.donor_id = ?
     GROUP BY d.donation_id
     ORDER BY d.donation_date DESC`,
    [donorId]
  );
  return rows;
}

async function getDonorByEmail(email, excludeId = null) {
  const params = [email];
  let query = 'SELECT donor_id FROM Donor WHERE email = ?';
  if (excludeId) {
    query += ' AND donor_id != ?';
    params.push(excludeId);
  }
  const [rows] = await pool.query(query, params);
  return rows[0];
}

async function createDonor({ donor_name, type, email, contact, country }) {
  const [result] = await pool.query(
    'INSERT INTO Donor (donor_name, type, email, contact, country) VALUES (?, ?, ?, ?, ?)',
    [donor_name, type, email, contact || '', country || 'Pakistan']
  );
  return result.insertId;
}

async function updateDonor(id, fields) {
  const columns = [];
  const values = [];
  const allowed = ['donor_name', 'type', 'email', 'contact', 'country'];

  allowed.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      columns.push(`${key} = ?`);
      values.push(fields[key]);
    }
  });

  if (columns.length === 0) {
    return false;
  }

  await pool.query(`UPDATE Donor SET ${columns.join(', ')} WHERE donor_id = ?`, [...values, id]);
  return true;
}

async function deleteDonor(id) {
  await pool.query('DELETE FROM Donor WHERE donor_id = ?', [id]);
}

async function countDonorDonations(id) {
  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM Donation WHERE donor_id = ?', [id]);
  return rows[0].count;
}

async function getReport() {
  const [topDonors] = await pool.query(`
    SELECT
      dn.donor_id,
      dn.donor_name,
      dn.type,
      dn.country,
      COUNT(d.donation_id) AS total_donations,
      COALESCE(SUM(d.amount), 0) AS total_amount,
      MAX(d.donation_date) AS last_donation_date
    FROM Donor dn
    LEFT JOIN Donation d ON d.donor_id = dn.donor_id
    GROUP BY dn.donor_id
    ORDER BY total_amount DESC
    LIMIT 10
  `);

  const [byType] = await pool.query(`
    SELECT type, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
    FROM Donation
    GROUP BY type
  `);

  const [monthly] = await pool.query(`
    SELECT
      DATE_FORMAT(donation_date, '%Y-%m') AS month,
      COUNT(*) AS count,
      COALESCE(SUM(amount), 0) AS total
    FROM Donation
    WHERE donation_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
    GROUP BY month
    ORDER BY month ASC
  `);

  const [[allocationSplit]] = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'Allocated' THEN amount ELSE 0 END), 0) AS allocated,
      COALESCE(SUM(CASE WHEN status = 'Received' THEN amount ELSE 0 END), 0) AS unallocated,
      COALESCE(SUM(CASE WHEN status = 'Partial' THEN amount ELSE 0 END), 0) AS partial
    FROM Donation
  `);

  return { topDonors, byType, monthly, allocationSplit };
}

module.exports = {
  getSummary,
  getAllDonors,
  getDonorById,
  getDonorDonations,
  getDonorByEmail,
  createDonor,
  updateDonor,
  deleteDonor,
  countDonorDonations,
  getReport,
};
