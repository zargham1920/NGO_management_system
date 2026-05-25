const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/donor.controller');
const { verifyToken, authorize } = require('../middleware/auth.middleware');

const allRoles          = ['NGO Admin', 'Field Worker', 'Finance Officer', 'Auditor'];
const adminFinance      = ['NGO Admin', 'Finance Officer'];
const adminOnly         = ['NGO Admin'];

// Donor CRUD
router.get('/',    verifyToken, ctrl.getAll);
router.get('/:id', verifyToken, ctrl.getById);
router.post('/',   verifyToken, authorize(...adminFinance), ctrl.create);
router.put('/:id', verifyToken, authorize(...adminFinance), ctrl.update);
router.delete('/:id', verifyToken, authorize(...adminOnly), ctrl.delete);

module.exports = router;
