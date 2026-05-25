const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/report.controller');
const { verifyToken, authorize } = require('../middleware/auth.middleware');

const allRoles     = ['NGO Admin', 'Field Worker', 'Finance Officer', 'Auditor'];
const financeAudit = ['NGO Admin', 'Finance Officer', 'Auditor'];

router.get('/financial',     verifyToken, authorize(...financeAudit), ctrl.getFinancialSummary);
router.get('/donor-impact',  verifyToken, authorize(...financeAudit), ctrl.getDonorImpact);
router.get('/beneficiaries', verifyToken, ctrl.getBeneficiaryReport);
router.get('/inventory',     verifyToken, ctrl.getInventoryReport);
router.get('/projects',      verifyToken, ctrl.getProjectReport);
router.get('/distributions', verifyToken, ctrl.getDistributionReport);

module.exports = router;
