const { pool } = require('../config/db'); // ← Fixed: destructure pool

const donorModel = {
  getAll: async ({ page = 1, limit = 10, search = '', type = '' } = {}) => {
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where  = ['1=1'];
    let params = [];

    if (search) { where.push('(d.donor_name LIKE ? OR d.email LIKE ? OR d.contact LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (type)   { where.push('d.type = ?'); params.push(type); }

    const whereStr = where.join(' AND ');

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM Donor d WHERE ${whereStr}`, params
    );

    const [rows] = await pool.query(
      `SELECT d.*,
              COUNT(DISTINCT dn.donation_id)     AS donation_count,
              COALESCE(SUM(dn.amount), 0)         AS total_donated
       FROM Donor d
       LEFT JOIN Donation dn ON d.donor_id = dn.donor_id
       WHERE ${whereStr}
       GROUP BY d.donor_id
       ORDER BY d.donor_id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    return { total, rows };
  },

  getById: async (donorId) => {
    const [rows] = await pool.query(
      `SELECT d.*,
              COUNT(DISTINCT dn.donation_id)     AS donation_count,
              COALESCE(SUM(dn.amount), 0)         AS total_donated
       FROM Donor d
       LEFT JOIN Donation dn ON d.donor_id = dn.donor_id
       WHERE d.donor_id = ?
       GROUP BY d.donor_id`,
      [donorId]
    );
    return rows[0] || null;
  },

  findByEmail: async (email) => {
    const [rows] = await pool.query('SELECT donor_id FROM Donor WHERE email = ?', [email]);
    return rows[0] || null;
  },

  create: async ({ donor_name, contact, type, email }) => {
    const [result] = await pool.query(
      'INSERT INTO Donor (donor_name, contact, type, email) VALUES (?, ?, ?, ?)',
      [donor_name, contact || '', type || 'Individual', email || '']
    );
    return result.insertId;
  },

  update: async (donorId, { donor_name, contact, type, email }) => {
    const [result] = await pool.query(
      'UPDATE Donor SET donor_name=?, contact=?, type=?, email=? WHERE donor_id=?',
      [donor_name, contact || '', type || 'Individual', email || '', donorId]
    );
    return result.affectedRows > 0;
  },

  delete: async (donorId) => {
    const [result] = await pool.query('DELETE FROM Donor WHERE donor_id = ?', [donorId]);
    return result.affectedRows > 0;
  },

  getDonationHistory: async (donorId) => {
    const [rows] = await pool.query(
      'SELECT * FROM Donation WHERE donor_id = ? ORDER BY donation_date DESC',
      [donorId]
    );
    return rows;
  },
};

module.exports = donorModel;
