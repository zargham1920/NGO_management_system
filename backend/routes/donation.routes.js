const express = require('express');
const router = express.Router();
const donationController = require('../controllers/donation.controller');
const authMiddleware = require('../middleware/auth.middleware');
const allowRoles = require('../middleware/role.middleware');

const financeAdmin = ['Finance Officer', 'NGO Admin'];

router.get('/', authMiddleware.verifyToken, allowRoles(...financeAdmin), donationController.getAll);
router.post('/', authMiddleware.verifyToken, allowRoles(...financeAdmin), donationController.create);
router.get('/:id', authMiddleware.verifyToken, allowRoles(...financeAdmin), donationController.getById);
router.get('/:id/allocations', authMiddleware.verifyToken, allowRoles(...financeAdmin), donationController.getAllocations);
router.post('/:id/allocations', authMiddleware.verifyToken, allowRoles(...financeAdmin), donationController.addAllocation);

module.exports = router;
