const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/beneficiary.controller');
const verifyToken = require('../middleware/auth.middleware');
const allowRoles = require('../middleware/role.middleware');

router.get('/summary', verifyToken, ctrl.getSummary);
router.get('/export', verifyToken, allowRoles('NGO Admin'), ctrl.exportCSV);
router.get('/', verifyToken, ctrl.getAll);
router.get('/:id', verifyToken, ctrl.getById);
router.get('/:id/aid-history', verifyToken, ctrl.getAidHistory);
router.get('/:id/stats', verifyToken, ctrl.getStats);
router.get('/:id/family', verifyToken, ctrl.getFamily);
router.post('/', verifyToken, allowRoles('NGO Admin', 'Field Worker'), ctrl.create);
router.put('/:id', verifyToken, allowRoles('NGO Admin', 'Field Worker'), ctrl.update);
router.delete('/:id', verifyToken, allowRoles('NGO Admin'), ctrl.softDelete);

module.exports = router;
