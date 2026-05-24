const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@umeedrdms.org';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@1234';

async function seedAdmin() {
  try {
    const [rows] = await pool.query('SELECT user_id FROM Users WHERE email = ?', [ADMIN_EMAIL]);
    if (rows.length > 0) {
      return;
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await pool.query(
      'INSERT INTO Users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
      ['NGO Admin', ADMIN_EMAIL, hashedPassword, 'NGO Admin', 'approved']
    );
    console.log(`Seeded admin user: ${ADMIN_EMAIL}`);
  } catch (error) {
    console.error('seedAdmin error:', error.message);
  }
}

module.exports = {
  seedAdmin,
};
