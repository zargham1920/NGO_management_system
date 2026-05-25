const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/donor.controller');
const { verifyToken, authorize } = require('../middleware/auth.middleware');

const adminFinance = ['NGO Admin', 'Finance Officer'];
const adminOnly    = ['NGO Admin'];

// GET  /api/donations/stats
router.get('/stats',       verifyToken, ctrl.getDonationStats);

// GET  /api/donations
router.get('/',            verifyToken, ctrl.getDonations);

// POST /api/donations
router.post('/',           verifyToken, authorize(...adminFinance), ctrl.createDonation);

// PUT  /api/donations/:id
router.put('/:id',         verifyToken, authorize(...adminFinance), ctrl.updateDonation);

// DELETE /api/donations/:id
router.delete('/:id',      verifyToken, authorize(...adminOnly), ctrl.deleteDonation);

// POST /api/donations/:id/allocate
router.post('/:id/allocate', verifyToken, authorize(...adminFinance), ctrl.allocateDonation);

module.exports = router;
