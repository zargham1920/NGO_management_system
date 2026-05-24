const { pool } = require('../config/db');

const beneficiaryColumnsCache = new Set();

async function loadBeneficiaryColumns() {
  if (beneficiaryColumnsCache.size > 0) return;

  const [columns] = await pool.query("SHOW COLUMNS FROM Beneficiary");
  columns.forEach((col) => beneficiaryColumnsCache.add(col.Field));
}

function parseNeeds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildCsv(rows, fields) {
  const escapeValue = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const header = fields.join(',');
  const lines = rows.map((row) => fields.map((field) => escapeValue(row[field])).join(','));
  return [header, ...lines].join('\n');
}

exports.getSummary = async (req, res) => {
  try {
    await loadBeneficiaryColumns();
    const hasCreatedAt = beneficiaryColumnsCache.has('created_at');

    const query = `
      SELECT
        COUNT(*) AS total_registered,
        SUM(status = 'Active') AS active_recipients,
        SUM(status = 'High Priority') AS high_priority,
        ${hasCreatedAt ? "SUM(MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())) AS new_this_month" : '0 AS new_this_month'}
      FROM Beneficiary
    `;

    const [rows] = await pool.query(query);
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('beneficiary.getSummary error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getAll = async (req, res) => {
  try {
    await loadBeneficiaryColumns();
    const { search, district, gender, status, need, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const where = ['1=1'];
    const params = [];

    if (search) {
      where.push('(b.name LIKE ? OR b.cnic LIKE ? OR l.village_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (district) {
      where.push('l.district = ?');
      params.push(district);
    }
    if (gender && beneficiaryColumnsCache.has('gender')) {
      where.push('b.gender = ?');
      params.push(gender);
    }
    if (status) {
      where.push('b.status = ?');
      params.push(status);
    }
    if (need) {
      where.push('b.needs LIKE ?');
      params.push(`%${need}%`);
    }

    const whereClause = where.join(' AND ');

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM Beneficiary b
       JOIN Location l ON b.location_id = l.location_id
       WHERE ${whereClause}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT
         b.beneficiary_id,
         b.name AS full_name,
         b.cnic,
         ${beneficiaryColumnsCache.has('gender') ? 'b.gender,' : "'' AS gender,"}
         b.household_size,
         b.income_source,
         b.needs,
         b.status,
         l.village_name,
         l.district,
         l.region,
         (SELECT MAX(ad.distribution_date)
          FROM Aid_Distribution ad
          WHERE ad.beneficiary_id = b.beneficiary_id) AS last_aid_date
       FROM Beneficiary b
       JOIN Location l ON b.location_id = l.location_id
       WHERE ${whereClause}
       ORDER BY b.beneficiary_id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );

    const data = rows.map((row) => ({
      ...row,
      needs: parseNeeds(row.needs),
    }));

    return res.status(200).json({
      success: true,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total_pages: Math.ceil(total / parseInt(limit, 10)),
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('beneficiary.getAll error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getById = async (req, res) => {
  try {
    await loadBeneficiaryColumns();
    const { id } = req.params;

    const selectFields = [`b.beneficiary_id`, `b.name AS full_name`, `b.cnic`, `b.household_size`, `b.income_source`, `b.needs`, `b.status`, `l.village_name`, `l.tehsil`, `l.district`, `l.region`];
    if (beneficiaryColumnsCache.has('gender')) selectFields.push('b.gender');
    if (beneficiaryColumnsCache.has('date_of_birth')) selectFields.push('b.date_of_birth');
    if (beneficiaryColumnsCache.has('marital_status')) selectFields.push('b.marital_status');
    if (beneficiaryColumnsCache.has('contact')) selectFields.push('b.contact');
    if (beneficiaryColumnsCache.has('children_count')) selectFields.push('b.children_count');
    if (beneficiaryColumnsCache.has('dependents')) selectFields.push('b.dependents');
    if (beneficiaryColumnsCache.has('monthly_income')) selectFields.push('b.monthly_income');
    if (beneficiaryColumnsCache.has('housing_type')) selectFields.push('b.housing_type');
    if (beneficiaryColumnsCache.has('gps_lat')) selectFields.push('b.gps_lat');
    if (beneficiaryColumnsCache.has('gps_lng')) selectFields.push('b.gps_lng');
    if (beneficiaryColumnsCache.has('notes')) selectFields.push('b.notes');
    if (beneficiaryColumnsCache.has('created_at')) selectFields.push('b.created_at');

    const [rows] = await pool.query(
      `SELECT ${selectFields.join(', ')}
       FROM Beneficiary b
       JOIN Location l ON b.location_id = l.location_id
       WHERE b.beneficiary_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
    }

    const result = {
      ...rows[0],
      needs: parseNeeds(rows[0].needs),
    };

    if (result.date_of_birth && !result.age) {
      const dob = new Date(result.date_of_birth);
      if (!Number.isNaN(dob.getTime())) {
        const age = new Date().getFullYear() - dob.getFullYear();
        result.age = age;
      }
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('beneficiary.getById error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getAidHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT
         ad.distribution_id,
         ad.distribution_date,
         ad.quantity_given,
         ad.status,
         ad.notes,
         i.item_name,
         i.category,
         p.project_name
       FROM Aid_Distribution ad
       JOIN Inventory i ON ad.item_id = i.item_id
       JOIN Project p ON ad.project_id = p.project_id
       WHERE ad.beneficiary_id = ?
       ORDER BY ad.distribution_date DESC`,
      [id]
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('beneficiary.getAidHistory error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const { id } = req.params;
    const [[stats]] = await pool.query(
      `SELECT
         COUNT(*) AS aid_received,
         COUNT(DISTINCT ad.project_id) AS projects_linked
       FROM Aid_Distribution ad
       WHERE ad.beneficiary_id = ?`,
      [id]
    );
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error('beneficiary.getStats error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getFamily = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT member_id, name, relation, age, status, notes
       FROM Family_Member
       WHERE beneficiary_id = ?
       ORDER BY age DESC`,
      [id]
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }
    console.error('beneficiary.getFamily error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

function normalizeFieldName(field) {
  if (field === 'full_name') return 'name';
  return field;
}

function computeAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const diff = new Date().getFullYear() - birth.getFullYear();
  return diff;
}

exports.create = async (req, res) => {
  try {
    await loadBeneficiaryColumns();
    const {
      full_name, cnic, date_of_birth, gender, marital_status, contact,
      household_size, children_count, dependents, income_source,
      monthly_income, housing_type, location_id, gps_lat, gps_lng,
      needs, notes, status = 'Active', age,
    } = req.body;

    if (!full_name || !cnic || !household_size || !income_source || !location_id) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (!cnicRegex.test(cnic)) {
      return res.status(400).json({ success: false, message: 'Invalid CNIC format. Use XXXXX-XXXXXXX-X.' });
    }

    const [existingCnic] = await pool.query('SELECT beneficiary_id FROM Beneficiary WHERE cnic = ?', [cnic]);
    if (existingCnic.length > 0) {
      return res.status(409).json({ success: false, message: 'CNIC already registered.' });
    }

    const [locationRows] = await pool.query('SELECT location_id FROM Location WHERE location_id = ?', [location_id]);
    if (locationRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid location_id.' });
    }

    const payload = {
      full_name,
      cnic,
      date_of_birth,
      gender,
      marital_status,
      contact,
      household_size,
      children_count,
      dependents,
      income_source,
      monthly_income,
      housing_type,
      location_id,
      gps_lat,
      gps_lng,
      needs: Array.isArray(needs) ? needs.join(',') : needs,
      notes,
      status,
    };

    if (beneficiaryColumnsCache.has('age')) {
      payload.age = age || computeAge(date_of_birth) || null;
    }

    const insertColumns = [];
    const insertValues = [];
    Object.entries(payload).forEach(([key, value]) => {
      const column = normalizeFieldName(key);
      if (beneficiaryColumnsCache.has(column) && value !== undefined) {
        insertColumns.push(column);
        insertValues.push(value === '' ? null : value);
      }
    });

    if (insertColumns.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid beneficiary fields provided.' });
    }

    const placeholders = insertColumns.map(() => '?').join(', ');
    const [result] = await pool.query(
      `INSERT INTO Beneficiary (${insertColumns.join(', ')}) VALUES (${placeholders})`,
      insertValues
    );

    return res.status(201).json({
      success: true,
      message: 'Beneficiary registered successfully.',
      data: { beneficiary_id: result.insertId },
    });
  } catch (error) {
    console.error('beneficiary.create error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.update = async (req, res) => {
  try {
    await loadBeneficiaryColumns();
    const { id } = req.params;
    const [existing] = await pool.query('SELECT * FROM Beneficiary WHERE beneficiary_id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
    }

    const { cnic } = req.body;
    if (cnic && cnic !== existing[0].cnic) {
      const [dup] = await pool.query(
        'SELECT beneficiary_id FROM Beneficiary WHERE cnic = ? AND beneficiary_id != ?',
        [cnic, id]
      );
      if (dup.length > 0) {
        return res.status(409).json({ success: false, message: 'CNIC already in use.' });
      }
    }

    const payload = { ...req.body };
    if (payload.needs && Array.isArray(payload.needs)) {
      payload.needs = payload.needs.join(',');
    }
    if (payload.full_name) {
      payload.name = payload.full_name;
      delete payload.full_name;
    }
    if (payload.date_of_birth && beneficiaryColumnsCache.has('age')) {
      payload.age = computeAge(payload.date_of_birth);
    }

    const updatePairs = [];
    const values = [];
    Object.entries(payload).forEach(([key, value]) => {
      const column = normalizeFieldName(key);
      if (beneficiaryColumnsCache.has(column) && value !== undefined) {
        updatePairs.push(`${column} = ?`);
        values.push(value === '' ? null : value);
      }
    });

    if (updatePairs.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid beneficiary fields provided for update.' });
    }

    await pool.query(
      `UPDATE Beneficiary SET ${updatePairs.join(', ')} WHERE beneficiary_id = ?`,
      [...values, id]
    );

    return res.status(200).json({ success: true, message: 'Beneficiary updated successfully.' });
  } catch (error) {
    console.error('beneficiary.update error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.softDelete = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT beneficiary_id, name FROM Beneficiary WHERE beneficiary_id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
    }

    await pool.query("UPDATE Beneficiary SET status = 'Inactive' WHERE beneficiary_id = ?", [id]);

    return res.status(200).json({
      success: true,
      message: `Beneficiary "${rows[0].name}" has been deactivated.`,
    });
  } catch (error) {
    console.error('beneficiary.softDelete error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.exportCSV = async (req, res) => {
  try {
    await loadBeneficiaryColumns();
    const [rows] = await pool.query(
      `SELECT
         b.beneficiary_id,
         b.name AS full_name,
         b.cnic,
         ${beneficiaryColumnsCache.has('gender') ? 'b.gender,' : "'' AS gender,"}
         b.household_size,
         b.income_source,
         b.needs,
         b.status,
         l.village_name,
         l.district,
         l.region
       FROM Beneficiary b
       JOIN Location l ON b.location_id = l.location_id
       ORDER BY b.beneficiary_id DESC`
    );

    const fields = ['beneficiary_id', 'full_name', 'cnic', 'gender', 'household_size', 'income_source', 'needs', 'status', 'village_name', 'district', 'region'];
    const csv = buildCsv(rows, fields);

    res.header('Content-Type', 'text/csv');
    res.attachment('beneficiaries.csv');
    return res.send(csv);
  } catch (error) {
    console.error('beneficiary.exportCSV error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
