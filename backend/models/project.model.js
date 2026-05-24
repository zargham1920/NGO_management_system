const { pool } = require('../config/db');

async function getAllProjects() {
  const [rows] = await pool.query(`
    SELECT project_id, project_name, sector, status
    FROM Project
    ORDER BY project_name ASC
  `);
  return rows;
}

module.exports = {
  getAllProjects,
};
