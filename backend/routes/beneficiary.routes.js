const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/beneficiary.controller');
const { verifyToken, authorize } = require('../middleware/auth.middleware');

const adminFieldWorker = ['NGO Admin', 'Field Worker'];
const adminOnly        = ['NGO Admin'];

router.get('/',    verifyToken, ctrl.getAll);
router.get('/:id', verifyToken, ctrl.getById);
router.post('/',   verifyToken, authorize(...adminFieldWorker), ctrl.create);
router.put('/:id', verifyToken, authorize(...adminFieldWorker), ctrl.update);
router.delete('/:id', verifyToken, authorize(...adminOnly), ctrl.delete);

module.exports = router;
