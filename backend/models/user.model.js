const { pool } = require('../config/db');

async function findByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM Users WHERE email = ?', [email]);
  return rows[0];
}

async function findById(userId) {
  const [rows] = await pool.query('SELECT * FROM Users WHERE user_id = ?', [userId]);
  return rows[0];
}

async function createUser({ name, email, password, role, status = 'pending' }) {
  const [result] = await pool.query(
    'INSERT INTO Users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
    [name, email, password, role, status]
  );
  return result.insertId;
}

async function getPendingUsers() {
  const [rows] = await pool.query(
    'SELECT user_id, name, email, role, status, created_at FROM Users WHERE status = ?',
    ['pending']
  );
  return rows;
}

async function getAllUsers() {
  const [rows] = await pool.query(
    'SELECT user_id, name, email, role, status, created_at FROM Users'
  );
  return rows;
}

async function updateUserStatus(userId, status) {
  const [result] = await pool.query(
    'UPDATE Users SET status = ? WHERE user_id = ?',
    [status, userId]
  );
  return result.affectedRows;
}

async function updatePassword(userId, password) {
  const [result] = await pool.query(
    'UPDATE Users SET password = ? WHERE user_id = ?',
    [password, userId]
  );
  return result.affectedRows;
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  getPendingUsers,
  getAllUsers,
  updateUserStatus,
  updatePassword,
};
