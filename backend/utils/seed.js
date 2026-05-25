const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@umeedrdms.org';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@1234';

async function seedAdmin() {
  try {
    // Ensure RefreshTokens table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS RefreshTokens (
        token_id   INT PRIMARY KEY AUTO_INCREMENT,
        user_id    INT NOT NULL,
        token      VARCHAR(255) NOT NULL,
        expires    BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
      )
    `);

    // Ensure Volunteer table exists (may not be in original schema)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Volunteer (
        volunteer_id INT PRIMARY KEY AUTO_INCREMENT,
        name         VARCHAR(150) NOT NULL,
        email        VARCHAR(150),
        phone        VARCHAR(30),
        skills       TEXT,
        availability VARCHAR(50) DEFAULT 'Available',
        address      TEXT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure Project_Volunteer join table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Project_Volunteer (
        pv_id            INT PRIMARY KEY AUTO_INCREMENT,
        volunteer_id     INT NOT NULL,
        project_id       INT NOT NULL,
        role_in_project  VARCHAR(100) DEFAULT 'General',
        assigned_date    DATE,
        FOREIGN KEY (volunteer_id) REFERENCES Volunteer(volunteer_id) ON DELETE CASCADE,
        FOREIGN KEY (project_id)   REFERENCES Project(project_id)     ON DELETE CASCADE,
        UNIQUE KEY uq_vol_proj (volunteer_id, project_id)
      )
    `);

    const [rows] = await pool.query('SELECT user_id FROM Users WHERE email = ?', [ADMIN_EMAIL]);
    if (rows.length > 0) return; // Admin already seeded

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await pool.query(
      'INSERT INTO Users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
      ['NGO Admin', ADMIN_EMAIL, hashedPassword, 'NGO Admin', 'approved']
    );
    console.log(`✅ Seeded admin user: ${ADMIN_EMAIL}`);
  } catch (error) {
    console.error('seedAdmin error:', error.message);
  }
}

async function seedDummyData() {
  try {
    const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM Location');
    if (count > 0) return; // Already seeded

    // ── Locations ─────────────────────────────────────────────────────────────
    const [loc1] = await pool.query(
      'INSERT INTO Location (village_name, district, region, population) VALUES (?, ?, ?, ?)',
      ['Haji Bux', 'Tharparkar', 'Sindh', 5200]
    );
    const [loc2] = await pool.query(
      'INSERT INTO Location (village_name, district, region, population) VALUES (?, ?, ?, ?)',
      ['Mirpur', 'Thatta', 'Sindh', 4100]
    );
    const [loc3] = await pool.query(
      'INSERT INTO Location (village_name, district, region, population) VALUES (?, ?, ?, ?)',
      ['Zarghun', 'Quetta', 'Balochistan', 6200]
    );

    // ── Donors ────────────────────────────────────────────────────────────────
    const [donor1] = await pool.query(
      'INSERT INTO Donor (donor_name, contact, type, email) VALUES (?, ?, ?, ?)',
      ['Umeed Trust', '0300-1111111', 'Private', 'trust@umeed.org']
    );
    const [donor2] = await pool.query(
      'INSERT INTO Donor (donor_name, contact, type, email) VALUES (?, ?, ?, ?)',
      ['Global Relief', '0300-2222222', 'Corporate', 'relief@global.org']
    );
    const [donor3] = await pool.query(
      'INSERT INTO Donor (donor_name, contact, type, email) VALUES (?, ?, ?, ?)',
      ['Community Fund', '0300-3333333', 'Government', 'fund@community.org']
    );

    // ── Projects ──────────────────────────────────────────────────────────────
    const [proj1] = await pool.query(
      'INSERT INTO Project (location_id, project_name, sector, start_date, end_date, budget, budget_used, status) VALUES (?,?,?,?,?,?,?,?)',
      [loc1.insertId, 'Water Supply 2026', 'Water', '2026-01-15', '2026-12-31', 450000, 180000, 'Active']
    );
    const [proj2] = await pool.query(
      'INSERT INTO Project (location_id, project_name, sector, start_date, end_date, budget, budget_used, status) VALUES (?,?,?,?,?,?,?,?)',
      [loc2.insertId, 'Food Security', 'Nutrition', '2026-02-01', '2026-11-30', 320000, 250000, 'Ongoing']
    );
    const [proj3] = await pool.query(
      'INSERT INTO Project (location_id, project_name, sector, start_date, end_date, budget, budget_used, status) VALUES (?,?,?,?,?,?,?,?)',
      [loc3.insertId, 'Child Education', 'Education', '2026-03-01', '2027-02-28', 260000, 95000, 'Active']
    );

    // ── Donations ─────────────────────────────────────────────────────────────
    const [don1] = await pool.query(
      'INSERT INTO Donation (donor_id, amount, donation_date, type, status) VALUES (?,?,?,?,?)',
      [donor1.insertId, 250000, '2026-03-18', 'Cash', 'Received']
    );
    const [don2] = await pool.query(
      'INSERT INTO Donation (donor_id, amount, donation_date, type, status) VALUES (?,?,?,?,?)',
      [donor2.insertId, 140000, '2026-04-05', 'Cash', 'Received']
    );
    const [don3] = await pool.query(
      'INSERT INTO Donation (donor_id, amount, donation_date, type, status) VALUES (?,?,?,?,?)',
      [donor3.insertId, 320000, '2026-05-08', 'Goods', 'Pending']
    );

    // ── Donation Allocations ──────────────────────────────────────────────────
    await pool.query(
      'INSERT INTO Donation_Allocation (donation_id, project_id, allocated_amount, allocation_date, purpose) VALUES (?,?,?,?,?)',
      [don1.insertId, proj1.insertId, 180000, '2026-03-20', 'Water filter distribution']
    );
    await pool.query(
      'INSERT INTO Donation_Allocation (donation_id, project_id, allocated_amount, allocation_date, purpose) VALUES (?,?,?,?,?)',
      [don2.insertId, proj2.insertId, 140000, '2026-04-10', 'Food pack distribution']
    );
    await pool.query(
      'INSERT INTO Donation_Allocation (donation_id, project_id, allocated_amount, allocation_date, purpose) VALUES (?,?,?,?,?)',
      [don3.insertId, proj3.insertId, 95000, '2026-05-12', 'School kit purchase']
    );

    // ── Beneficiaries ─────────────────────────────────────────────────────────
    const [ben1] = await pool.query(
      'INSERT INTO Beneficiary (name, cnic, age, household_size, income_source, location_id, needs, status) VALUES (?,?,?,?,?,?,?,?)',
      ['Zahra Ali', '42101-1234567-1', 34, 7, 'Farming', loc1.insertId, 'Food and hygiene supplies', 'approved']
    );
    const [ben2] = await pool.query(
      'INSERT INTO Beneficiary (name, cnic, age, household_size, income_source, location_id, needs, status) VALUES (?,?,?,?,?,?,?,?)',
      ['Bilal Khan', '35202-7654321-5', 28, 5, 'Driver', loc2.insertId, 'Education materials', 'approved']
    );
    const [ben3] = await pool.query(
      'INSERT INTO Beneficiary (name, cnic, age, household_size, income_source, location_id, needs, status) VALUES (?,?,?,?,?,?,?,?)',
      ['Sana Rehman', '61101-5554444-7', 41, 6, 'Sewing', loc3.insertId, 'Medical support', 'approved']
    );

    // ── Inventory (correct category & status values per Module 6 spec) ────────
    const [item1] = await pool.query(
      'INSERT INTO Inventory (project_id, item_name, quantity, category, status) VALUES (?,?,?,?,?)',
      [proj1.insertId, 'Solar Powered Water Pumps', 42, 'Water', 'In Stock']
    );
    const [item2] = await pool.query(
      'INSERT INTO Inventory (project_id, item_name, quantity, category, status) VALUES (?,?,?,?,?)',
      [proj2.insertId, 'Primary Textbook Collections', 4, 'Education', 'Low Stock']
    );
    const [item3] = await pool.query(
      'INSERT INTO Inventory (project_id, item_name, quantity, category, status) VALUES (?,?,?,?,?)',
      [proj3.insertId, 'Emergency First Aid Kits', 18, 'Medical', 'In Stock']
    );
    const [item4] = await pool.query(
      'INSERT INTO Inventory (project_id, item_name, quantity, category, status) VALUES (?,?,?,?,?)',
      [proj1.insertId, 'Heavy Duty Infrastructure Tents', 0, 'Infrastructure', 'Out of Stock']
    );

    // ── Aid Distributions ─────────────────────────────────────────────────────
    await pool.query(
      'INSERT INTO Aid_Distribution (project_id, beneficiary_id, item_id, distribution_date, quantity_given, notes) VALUES (?,?,?,?,?,?)',
      [proj1.insertId, ben1.insertId, item1.insertId, '2026-05-15', 4, 'Delivered on schedule']
    );
    await pool.query(
      'INSERT INTO Aid_Distribution (project_id, beneficiary_id, item_id, distribution_date, quantity_given, notes) VALUES (?,?,?,?,?,?)',
      [proj2.insertId, ben2.insertId, item2.insertId, '2026-05-18', 2, 'Scheduled delivery']
    );
    await pool.query(
      'INSERT INTO Aid_Distribution (project_id, beneficiary_id, item_id, distribution_date, quantity_given, notes) VALUES (?,?,?,?,?,?)',
      [proj3.insertId, ben3.insertId, item3.insertId, '2026-05-20', 3, 'Delivered to school']
    );

    // ── Volunteers ────────────────────────────────────────────────────────────
    const [vol1] = await pool.query(
      'INSERT INTO Volunteer (name, email, phone, skills, availability) VALUES (?,?,?,?,?)',
      ['Ahmed Raza', 'ahmed@volunteer.org', '0311-1234567', 'Medical, First Aid', 'Available']
    );
    const [vol2] = await pool.query(
      'INSERT INTO Volunteer (name, email, phone, skills, availability) VALUES (?,?,?,?,?)',
      ['Fatima Noor', 'fatima@volunteer.org', '0322-9876543', 'Education, Training', 'Available']
    );

    // Assign volunteers to projects
    await pool.query(
      'INSERT INTO Project_Volunteer (volunteer_id, project_id, role_in_project, assigned_date) VALUES (?,?,?,?)',
      [vol1.insertId, proj1.insertId, 'Medical Officer', '2026-01-20']
    );
    await pool.query(
      'INSERT INTO Project_Volunteer (volunteer_id, project_id, role_in_project, assigned_date) VALUES (?,?,?,?)',
      [vol2.insertId, proj3.insertId, 'Education Coordinator', '2026-03-05']
    );

    console.log('✅ Seeded dummy data successfully.');
  } catch (error) {
    console.error('seedDummyData error:', error.message);
  }
}

module.exports = { seedAdmin, seedDummyData };
