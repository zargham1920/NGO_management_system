const { pool } = require('../backend/config/db');


async function run() {
  console.log('--- STARTING SCHEMA MIGRATION FOR VOLUNTEER MODULE ---');
  try {
    // 1. Alter Volunteer table
    console.log('Altering Volunteer table...');
    // We check if volunteer_name exists first before renaming
    const [cols] = await pool.query('DESCRIBE Volunteer');
    const hasVolunteerName = cols.some(c => c.Field === 'volunteer_name');
    const hasContact = cols.some(c => c.Field === 'contact');
    const hasEmail = cols.some(c => c.Field === 'email');
    const hasAddress = cols.some(c => c.Field === 'address');

    if (hasVolunteerName) {
      await pool.query('ALTER TABLE Volunteer CHANGE COLUMN volunteer_name name VARCHAR(100) NOT NULL');
      console.log('  -> Renamed volunteer_name to name');
    }
    if (hasContact) {
      await pool.query('ALTER TABLE Volunteer CHANGE COLUMN contact phone VARCHAR(50) NOT NULL');
      console.log('  -> Renamed contact to phone');
    }
    if (!hasEmail) {
      await pool.query('ALTER TABLE Volunteer ADD COLUMN email VARCHAR(150) NULL');
      console.log('  -> Added email column');
    }
    if (!hasAddress) {
      await pool.query('ALTER TABLE Volunteer ADD COLUMN address TEXT NULL');
      console.log('  -> Added address column');
    }
    
    // Make location_id nullable
    await pool.query('ALTER TABLE Volunteer MODIFY COLUMN location_id INT NULL');
    console.log('  -> Made location_id nullable');

    // 2. Alter Project_Volunteer table
    console.log('Altering Project_Volunteer table...');
    const [pvCols] = await pool.query('DESCRIBE Project_Volunteer');
    const hasProjVolId = pvCols.some(c => c.Field === 'proj_vol_id');
    const hasRole = pvCols.some(c => c.Field === 'role');
    const hasAssignedDate = pvCols.some(c => c.Field === 'assigned_date');

    if (hasProjVolId) {
      await pool.query('ALTER TABLE Project_Volunteer CHANGE COLUMN proj_vol_id pv_id INT AUTO_INCREMENT');
      console.log('  -> Renamed proj_vol_id to pv_id');
    }
    if (hasRole) {
      await pool.query('ALTER TABLE Project_Volunteer CHANGE COLUMN role role_in_project VARCHAR(100) NULL');
      console.log('  -> Renamed role to role_in_project');
    }
    if (!hasAssignedDate) {
      await pool.query('ALTER TABLE Project_Volunteer ADD COLUMN assigned_date DATE NULL');
      console.log('  -> Added assigned_date column');
    }

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

run();
