const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/volunteer.controller');
const { verifyToken, authorize } = require('../middleware/auth.middleware');

const allRoles         = ['NGO Admin', 'Field Worker', 'Finance Officer', 'Auditor'];
const adminFieldWorker = ['NGO Admin', 'Field Worker'];
const adminOnly        = ['NGO Admin'];

router.get('/by-project/:projectId', verifyToken, ctrl.getByProject);
router.get('/',                      verifyToken, ctrl.getAll);
router.get('/:id',                   verifyToken, ctrl.getById);
router.post('/',                     verifyToken, authorize(...adminFieldWorker), ctrl.create);
router.put('/:id',                   verifyToken, authorize(...adminFieldWorker), ctrl.update);
router.delete('/:id',                verifyToken, authorize(...adminOnly), ctrl.remove);
router.post('/:id/assign',           verifyToken, authorize(...adminOnly), ctrl.assignToProject);

module.exports = router;
