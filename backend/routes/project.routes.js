const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/project.controller');
const { verifyToken, authorize } = require('../middleware/auth.middleware');

const allRoles  = ['NGO Admin', 'Field Worker', 'Finance Officer', 'Auditor'];
const adminOnly = ['NGO Admin'];

router.get('/summary',       verifyToken, ctrl.getSummary);
router.get('/budget-summary',verifyToken, ctrl.getBudgetSummary);
router.get('/locations',     verifyToken, ctrl.getLocations);
router.get('/',              verifyToken, ctrl.getAll);
router.get('/:id',           verifyToken, ctrl.getById);
router.post('/',             verifyToken, authorize(...adminOnly), ctrl.create);
router.put('/:id',           verifyToken, authorize(...adminOnly), ctrl.update);
router.delete('/:id',        verifyToken, authorize(...adminOnly), ctrl.remove);

module.exports = router;
