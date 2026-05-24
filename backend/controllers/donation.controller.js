const { pool } = require('../config/db');
const donationModel = require('../models/donation.model');

const validDonationTypes = ['Bank Transfer', 'Cash Account', 'In-Kind'];

async function getAll(req, res) {
  try {
    const {
      donor_id,
      status,
      type,
      from_date,
      to_date,
      page = 1,
      limit = 10,
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const { total, rows } = await donationModel.getAllDonations({
      donor_id,
      status,
      type,
      from_date,
      to_date,
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
    console.error('getAll donations error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function create(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      donor_id,
      amount,
      donation_date,
      type,
      project_id,
      purpose,
    } = req.body;

    if (!donor_id || !amount || !donation_date || !type) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'donor_id, amount, donation_date, and type are required.',
      });
    }

    if (!validDonationTypes.includes(type)) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: `Invalid donation type. Must be: ${validDonationTypes.join(', ')}`,
      });
    }

    const donor = await donationModel.findDonorById(donor_id, conn);
    if (!donor) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, message: 'Donor not found.' });
    }

    const normalizedProjectId = project_id ? Number(project_id) : null;
    let status = 'Received';
    if (normalizedProjectId) {
      const project = await donationModel.findProjectById(normalizedProjectId, conn);
      if (!project) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ success: false, message: 'Project not found.' });
      }
      status = 'Allocated';
    }

    const donation_id = await donationModel.insertDonation({
      donor_id,
      amount,
      donation_date,
      type,
      status,
    }, conn);

    if (normalizedProjectId) {
      await donationModel.insertAllocation({
        donation_id,
        project_id: normalizedProjectId,
        allocated_amount: amount,
        allocation_date: donation_date,
        purpose,
      }, conn);
    }

    await conn.commit();
    conn.release();

    return res.status(201).json({
      success: true,
      message: normalizedProjectId
        ? 'Donation logged and allocated to project successfully.'
        : 'Donation logged. Funds retained as unallocated reserve.',
      data: {
        donation_id,
        donor_id,
        amount,
        donation_date,
        type,
        status,
        project_id: normalizedProjectId || null,
      },
    });
  } catch (error) {
    await conn.rollback();
    conn.release();
    console.error('create donation error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function getById(req, res) {
  try {
    const donation = await donationModel.getDonationById(req.params.id);
    if (!donation) {
      return res.status(404).json({ success: false, message: 'Donation not found.' });
    }
    return res.status(200).json({ success: true, data: donation });
  } catch (error) {
    console.error('getById donation error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function getAllocations(req, res) {
  try {
    const allocations = await donationModel.getDonationAllocations(req.params.id);
    return res.status(200).json({ success: true, count: allocations.length, data: allocations });
  } catch (error) {
    console.error('getAllocations error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function addAllocation(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const donationId = Number(req.params.id);
    const { project_id, allocated_amount, allocation_date, purpose } = req.body;

    if (!project_id || !allocated_amount || !allocation_date) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'project_id, allocated_amount, allocation_date required.',
      });
    }

    const donation = await donationModel.findDonationById(donationId, conn);
    if (!donation) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, message: 'Donation not found.' });
    }

    const project = await donationModel.findProjectById(project_id, conn);
    if (!project) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const already_allocated = await donationModel.sumAllocatedAmount(donationId, conn);
    const remaining = Number(donation.amount) - Number(already_allocated);
    const allocationValue = Number(allocated_amount);

    if (allocationValue > remaining) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: `Cannot allocate ₨${allocationValue}. Only ₨${remaining.toFixed(2)} remaining.`,
      });
    }

    await donationModel.insertAllocation({
      donation_id: donationId,
      project_id,
      allocated_amount: allocationValue,
      allocation_date,
      purpose,
    }, conn);

    const newAllocated = already_allocated + allocationValue;
    const newStatus = newAllocated >= Number(donation.amount) ? 'Allocated' : 'Partial';
    await donationModel.updateDonationStatus(donationId, newStatus, conn);

    await conn.commit();
    conn.release();

    return res.status(201).json({
      success: true,
      message: `Allocation saved. Donation status updated to "${newStatus}".`,
      data: {
        donation_id: donationId,
        project_id,
        allocated_amount: allocationValue,
        remaining: Number((remaining - allocationValue).toFixed(2)),
        status: newStatus,
      },
    });
  } catch (error) {
    await conn.rollback();
    conn.release();
    console.error('addAllocation error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = {
  getAll,
  create,
  getById,
  getAllocations,
  addAllocation,
};
