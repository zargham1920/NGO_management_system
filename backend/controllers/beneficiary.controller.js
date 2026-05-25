const beneficiaryModel = require('../models/beneficiary.model');

// GET /api/beneficiaries?search=&status=&location_id=&page=&limit=
exports.getAll = async (req, res) => {
  try {
    const { search, status, location_id, page = 1, limit = 15 } = req.query;
    const result = await beneficiaryModel.getAll({ page, limit, search, status, location_id });
    res.json({
      success: true,
      total:       result.total,
      page:        parseInt(page),
      total_pages: Math.ceil(result.total / parseInt(limit)),
      count:       result.rows.length,
      data:        result.rows,
    });
  } catch (err) {
    console.error('getAll beneficiaries error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/beneficiaries/:id
exports.getById = async (req, res) => {
  try {
    const beneficiary = await beneficiaryModel.getById(req.params.id);
    if (!beneficiary)
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
    res.json({ success: true, data: beneficiary });
  } catch (err) {
    console.error('getById beneficiary error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/beneficiaries
exports.create = async (req, res) => {
  try {
    const { name, cnic, age, household_size, income_source, location_id, needs, status } = req.body;

    if (!name || !cnic)
      return res.status(400).json({ success: false, message: 'name and cnic are required.' });

    // CNIC uniqueness check
    const existing = await beneficiaryModel.findByCnic(cnic);
    if (existing)
      return res.status(409).json({ success: false, message: 'A beneficiary with this CNIC already exists.' });

    const beneficiaryId = await beneficiaryModel.create({
      name, cnic, age, household_size, income_source, location_id, needs,
      status: status || 'approved',
    });

    res.status(201).json({
      success: true,
      message: 'Beneficiary registered successfully.',
      data: { beneficiary_id: beneficiaryId },
    });
  } catch (err) {
    console.error('create beneficiary error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/beneficiaries/:id
exports.update = async (req, res) => {
  try {
    const { name, cnic, age, household_size, income_source, location_id, needs, status } = req.body;

    const existing = await beneficiaryModel.getById(req.params.id);
    if (!existing)
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });

    // If CNIC is changing, check uniqueness
    if (cnic && cnic !== existing.cnic) {
      const cnicTaken = await beneficiaryModel.findByCnic(cnic);
      if (cnicTaken)
        return res.status(409).json({ success: false, message: 'This CNIC is already registered to another beneficiary.' });
    }

    const updated = await beneficiaryModel.update(req.params.id, {
      name:          name          || existing.name,
      cnic:          cnic          || existing.cnic,
      age:           age           ?? existing.age,
      household_size: household_size ?? existing.household_size,
      income_source: income_source ?? existing.income_source,
      location_id:   location_id   ?? existing.location_id,
      needs:         needs         ?? existing.needs,
      status:        status        || existing.status,
    });

    if (!updated)
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });

    res.json({ success: true, message: 'Beneficiary updated successfully.' });
  } catch (err) {
    console.error('update beneficiary error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/beneficiaries/:id
exports.delete = async (req, res) => {
  try {
    const existing = await beneficiaryModel.getById(req.params.id);
    if (!existing)
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });

    const deleted = await beneficiaryModel.delete(req.params.id);
    if (!deleted)
      return res.status(404).json({ success: false, message: 'Beneficiary not found.' });

    res.json({ success: true, message: `Beneficiary "${existing.name}" removed.` });
  } catch (err) {
    console.error('delete beneficiary error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
