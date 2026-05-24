const donorModel = require('../models/donor.model');

const financeAdminRoles = ['Finance Officer', 'NGO Admin'];
const validDonorTypes = ['NGO', 'Corporate Sponsor', 'Individual Philanthropist'];

async function getSummary(req, res) {
  try {
    const summary = await donorModel.getSummary();
    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error('getSummary error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function getAll(req, res) {
  try {
    const { search, type, country, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const { total, rows } = await donorModel.getAllDonors({
      search,
      type,
      country,
      limit: Number(limit),
      offset,
    });

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      total_pages: Math.ceil(total / Number(limit)),
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('getAll donors error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function getById(req, res) {
  try {
    const donor = await donorModel.getDonorById(req.params.id);
    if (!donor) {
      return res.status(404).json({ success: false, message: 'Donor not found.' });
    }
    return res.status(200).json({ success: true, data: donor });
  } catch (error) {
    console.error('getById donor error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function getDonorDonations(req, res) {
  try {
    const donations = await donorModel.getDonorDonations(req.params.id);
    return res.status(200).json({ success: true, count: donations.length, data: donations });
  } catch (error) {
    console.error('getDonorDonations error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function create(req, res) {
  try {
    const { donor_name, type, email, contact, country = 'Pakistan' } = req.body;

    if (!donor_name || !type || !email) {
      return res.status(400).json({
        success: false,
        message: 'donor_name, type, and email are required.',
      });
    }

    if (!validDonorTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Must be: ${validDonorTypes.join(', ')}`,
      });
    }

    const existing = await donorModel.getDonorByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered to another donor.' });
    }

    const donor_id = await donorModel.createDonor({ donor_name, type, email, contact, country });
    return res.status(201).json({
      success: true,
      message: 'Donor registered successfully.',
      data: { donor_id, donor_name, type, email, country, contact: contact || '' },
    });
  } catch (error) {
    console.error('create donor error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function update(req, res) {
  try {
    const donor = await donorModel.getDonorById(req.params.id);
    if (!donor) {
      return res.status(404).json({ success: false, message: 'Donor not found.' });
    }

    if (req.body.email && req.body.email !== donor.email) {
      const existing = await donorModel.getDonorByEmail(req.body.email, req.params.id);
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email already in use.' });
      }
    }

    if (req.body.type && !validDonorTypes.includes(req.body.type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Must be: ${validDonorTypes.join(', ')}`,
      });
    }

    const updated = await donorModel.updateDonor(req.params.id, req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    return res.status(200).json({ success: true, message: 'Donor updated successfully.' });
  } catch (error) {
    console.error('update donor error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function remove(req, res) {
  try {
    const donor = await donorModel.getDonorById(req.params.id);
    if (!donor) {
      return res.status(404).json({ success: false, message: 'Donor not found.' });
    }

    const donationCount = await donorModel.countDonorDonations(req.params.id);
    if (donationCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete donor with ${donationCount} existing donation record(s). Archive instead.`,
      });
    }

    await donorModel.deleteDonor(req.params.id);
    return res.status(200).json({ success: true, message: 'Donor deleted successfully.' });
  } catch (error) {
    console.error('delete donor error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function getReport(req, res) {
  try {
    const report = await donorModel.getReport();
    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error('getReport error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = {
  getSummary,
  getAll,
  getById,
  getDonorDonations,
  create,
  update,
  remove,
  getReport,
};
