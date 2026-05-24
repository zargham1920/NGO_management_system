const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const verifyToken = require('../middleware/auth.middleware');

router.get('/', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT location_id, village_name, tehsil, district, region FROM Location ORDER BY region, district, village_name'
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('location.getAll error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
