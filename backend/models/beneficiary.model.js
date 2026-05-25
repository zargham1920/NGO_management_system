const { pool } = require('../config/db'); // ← Fixed: destructure pool

const beneficiaryModel = {
  getAll: async ({ page = 1, limit = 20, search = '', status = '', location_id = '' } = {}) => {
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where  = ['1=1'];
    let params = [];

    if (search)      { where.push('(b.name LIKE ? OR b.cnic LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    if (status)      { where.push('b.status = ?');       params.push(status); }
    if (location_id) { where.push('b.location_id = ?'); params.push(location_id); }

    const whereStr = where.join(' AND ');

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM Beneficiary b WHERE ${whereStr}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT b.*, l.village_name, l.district, l.region
       FROM Beneficiary b
       LEFT JOIN Location l ON b.location_id = l.location_id
       WHERE ${whereStr}
       ORDER BY b.beneficiary_id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    return { total, rows };
  },

  getById: async (beneficiaryId) => {
    const [rows] = await pool.query(
      `SELECT b.*, l.village_name, l.district, l.region
       FROM Beneficiary b
       LEFT JOIN Location l ON b.location_id = l.location_id
       WHERE b.beneficiary_id = ?`,
      [beneficiaryId]
    );
    return rows[0] || null;
  },

  findByCnic: async (cnic) => {
    const [rows] = await pool.query('SELECT beneficiary_id FROM Beneficiary WHERE cnic = ?', [cnic]);
    return rows[0] || null;
  },

  create: async ({ name, cnic, age, household_size, income_source, location_id, needs, status }) => {
    const [result] = await pool.query(
      `INSERT INTO Beneficiary
         (name, cnic, age, household_size, income_source, location_id, needs, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, cnic, age || 0, household_size || 1, income_source || '', location_id || null, needs || '', status || 'approved']
    );
    return result.insertId;
  },

  update: async (beneficiaryId, { name, cnic, age, household_size, income_source, location_id, needs, status }) => {
    const [result] = await pool.query(
      `UPDATE Beneficiary
       SET name=?, cnic=?, age=?, household_size=?, income_source=?, location_id=?, needs=?, status=?
       WHERE beneficiary_id=?`,
      [name, cnic, age, household_size, income_source, location_id, needs, status, beneficiaryId]
    );
    return result.affectedRows > 0;
  },

  delete: async (beneficiaryId) => {
    const [result] = await pool.query('DELETE FROM Beneficiary WHERE beneficiary_id = ?', [beneficiaryId]);
    return result.affectedRows > 0;
  },
};

module.exports = beneficiaryModel;
