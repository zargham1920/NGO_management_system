const express = require('express');
const router = express.Router();
const donorController = require('../controllers/donor.controller');
const authMiddleware = require('../middleware/auth.middleware');
const allowRoles = require('../middleware/role.middleware');

const financeAdmin = ['Finance Officer', 'NGO Admin'];
const adminOnly = ['NGO Admin'];

router.get('/summary', authMiddleware.verifyToken, allowRoles(...financeAdmin), donorController.getSummary);
router.get('/report', authMiddleware.verifyToken, allowRoles('NGO Admin', 'Auditor'), donorController.getReport);
router.get('/', authMiddleware.verifyToken, allowRoles(...financeAdmin), donorController.getAll);
router.get('/:id', authMiddleware.verifyToken, allowRoles(...financeAdmin), donorController.getById);
router.get('/:id/donations', authMiddleware.verifyToken, allowRoles(...financeAdmin), donorController.getDonorDonations);
router.post('/', authMiddleware.verifyToken, allowRoles(...financeAdmin), donorController.create);
router.put('/:id', authMiddleware.verifyToken, allowRoles(...financeAdmin), donorController.update);
router.delete('/:id', authMiddleware.verifyToken, allowRoles(...adminOnly), donorController.remove);

module.exports = router;
