const { pool } = require('../config/db');

async function createToken(userId, token, expires) {
  const [result] = await pool.query(
    'INSERT INTO RefreshTokens (user_id, token, expires) VALUES (?, ?, ?)',
    [userId, token, expires]
  );
  return result.insertId;
}

async function findByToken(token) {
  const [rows] = await pool.query('SELECT * FROM RefreshTokens WHERE token = ?', [token]);
  return rows[0];
}

async function deleteToken(token) {
  const [result] = await pool.query('DELETE FROM RefreshTokens WHERE token = ?', [token]);
  return result.affectedRows;
}

async function deleteTokensByUser(userId) {
  const [result] = await pool.query('DELETE FROM RefreshTokens WHERE user_id = ?', [userId]);
  return result.affectedRows;
}

module.exports = {
  createToken,
  findByToken,
  deleteToken,
  deleteTokensByUser,
};
