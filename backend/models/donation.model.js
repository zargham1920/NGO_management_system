const { pool } = require('../config/db');

async function getAllDonations({ donor_id, status, type, from_date, to_date, limit, offset }) {
  const where = ['1=1'];
  const params = [];

  if (donor_id) {
    where.push('d.donor_id = ?');
    params.push(donor_id);
  }
  if (status) {
    where.push('d.status = ?');
    params.push(status);
  }
  if (type) {
    where.push('d.type = ?');
    params.push(type);
  }
  if (from_date) {
    where.push('d.donation_date >= ?');
    params.push(from_date);
  }
  if (to_date) {
    where.push('d.donation_date <= ?');
    params.push(to_date);
  }

  const whereClause = where.join(' AND ');

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM Donation d WHERE ${whereClause}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT
       d.donation_id,
       d.amount,
       d.donation_date,
       d.type,
       d.status,
       dn.donor_id,
       dn.donor_name,
       dn.email,
       dn.country,
       COALESCE(SUM(da.allocated_amount), 0) AS allocated_amount,
       COALESCE(GROUP_CONCAT(DISTINCT p.project_name SEPARATOR ', '), '') AS allocated_to
     FROM Donation d
     JOIN Donor dn ON dn.donor_id = d.donor_id
     LEFT JOIN Donation_Allocation da ON da.donation_id = d.donation_id
     LEFT JOIN Project p ON p.project_id = da.project_id
     WHERE ${whereClause}
     GROUP BY d.donation_id
     ORDER BY d.donation_date DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { total: Number(total), rows };
}

async function getDonationById(id) {
  const [rows] = await pool.query(
    `SELECT
       d.donation_id,
       d.donor_id,
       d.amount,
       d.donation_date,
       d.type,
       d.status,
       dn.donor_name,
       dn.email,
       dn.country
     FROM Donation d
     JOIN Donor dn ON dn.donor_id = d.donor_id
     WHERE d.donation_id = ?`,
    [id]
  );
  return rows[0];
}

async function getDonationAllocations(donationId) {
  const [rows] = await pool.query(
    `SELECT
       da.allocation_id,
       da.allocated_amount,
       da.allocation_date,
       da.purpose,
       p.project_id,
       p.project_name,
       p.sector,
       p.status AS project_status
     FROM Donation_Allocation da
     JOIN Project p ON p.project_id = da.project_id
     WHERE da.donation_id = ?
     ORDER BY da.allocation_date DESC`,
    [donationId]
  );
  return rows;
}

async function findDonorById(id, conn = pool) {
  const [rows] = await conn.query('SELECT donor_id FROM Donor WHERE donor_id = ?', [id]);
  return rows[0];
}

async function findProjectById(id, conn = pool) {
  const [rows] = await conn.query('SELECT project_id FROM Project WHERE project_id = ?', [id]);
  return rows[0];
}

async function findDonationById(id, conn = pool) {
  const [rows] = await conn.query('SELECT donation_id, amount FROM Donation WHERE donation_id = ?', [id]);
  return rows[0];
}

async function sumAllocatedAmount(donationId, conn = pool) {
  const [rows] = await conn.query(
    'SELECT COALESCE(SUM(allocated_amount), 0) AS already_allocated FROM Donation_Allocation WHERE donation_id = ?',
    [donationId]
  );
  return Number(rows[0].already_allocated || 0);
}

async function insertDonation({ donor_id, amount, donation_date, type, status }, conn = pool) {
  const [result] = await conn.query(
    'INSERT INTO Donation (donor_id, amount, donation_date, type, status) VALUES (?, ?, ?, ?, ?)',
    [donor_id, amount, donation_date, type, status]
  );
  return result.insertId;
}

async function insertAllocation({ donation_id, project_id, allocated_amount, allocation_date, purpose }, conn = pool) {
  await conn.query(
    'INSERT INTO Donation_Allocation (donation_id, project_id, allocated_amount, allocation_date, purpose) VALUES (?, ?, ?, ?, ?)',
    [donation_id, project_id, allocated_amount, allocation_date, purpose || null]
  );
}

async function updateDonationStatus(donationId, status, conn = pool) {
  await conn.query('UPDATE Donation SET status = ? WHERE donation_id = ?', [status, donationId]);
}

module.exports = {
  getAllDonations,
  getDonationById,
  getDonationAllocations,
  findDonorById,
  findProjectById,
  findDonationById,
  sumAllocatedAmount,
  insertDonation,
  insertAllocation,
  updateDonationStatus,
};
