const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/distribution.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const allowRoles = require('../middleware/role.middleware');

const allRoles         = ['NGO Admin', 'Field Worker', 'Finance Officer', 'Auditor'];
const adminFieldWorker = ['NGO Admin', 'Field Worker'];
const adminOnly        = ['NGO Admin'];

// ── IMPORTANT: named/specific routes MUST come BEFORE /:id ──────────────────

// GET  /api/distributions/summary                → KPI chips (all roles)
router.get('/summary',                    verifyToken, allowRoles(...allRoles),         ctrl.getSummary);

// GET  /api/distributions/recent                 → dashboard feed (all roles)
router.get('/recent',                     verifyToken, allowRoles(...allRoles),         ctrl.getRecent);

// GET  /api/distributions/beneficiary/:id        → aid history per beneficiary (all roles)
router.get('/beneficiary/:beneficiaryId', verifyToken, allowRoles(...allRoles),         ctrl.getByBeneficiary);

// GET  /api/distributions/by-project/:projectId  → all distributions for a project (all roles)
router.get('/by-project/:projectId',      verifyToken, allowRoles(...allRoles),         ctrl.getByProject);

// GET  /api/distributions                        → list + filters + pagination (all roles)
router.get('/',                           verifyToken, allowRoles(...allRoles),         ctrl.getAll);

// GET  /api/distributions/:id                    → single distribution detail (all roles)
router.get('/:id',                        verifyToken, allowRoles(...allRoles),         ctrl.getById);

// POST /api/distributions                        → record distribution (Admin + Field Worker)
// TRANSACTION: INSERT Aid_Distribution + DEDUCT Inventory quantity
router.post('/',                          verifyToken, allowRoles(...adminFieldWorker),  ctrl.create);

// DELETE /api/distributions/:id                  → delete + restore stock (Admin only)
// TRANSACTION: DELETE record + RESTORE Inventory quantity
router.delete('/:id',                     verifyToken, allowRoles(...adminOnly),         ctrl.remove);

module.exports = router;
