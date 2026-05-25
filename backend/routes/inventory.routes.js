const express     = require('express');
const router      = express.Router();
const ctrl        = require('../controllers/inventory.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const allowRoles  = require('../middleware/role.middleware');

const allRoles         = ['NGO Admin', 'Field Worker', 'Finance Officer', 'Auditor'];
const adminFieldWorker = ['NGO Admin', 'Field Worker'];
const adminOnly        = ['NGO Admin'];

// ── IMPORTANT: specific named routes MUST come BEFORE /:id ──────────────────

// GET  /api/inventory/summary       → KPI chips (all roles)
router.get('/summary',               verifyToken, allowRoles(...allRoles),         ctrl.getSummary);

// GET  /api/inventory/low-stock     → alert list (all roles)
router.get('/low-stock',             verifyToken, allowRoles(...allRoles),         ctrl.getLowStock);

// GET  /api/inventory/categories    → dropdown data (all roles)
router.get('/categories',            verifyToken, allowRoles(...allRoles),         ctrl.getCategories);

// GET  /api/inventory/dropdown      → dispatch form item selector (all roles)
router.get('/dropdown',              verifyToken, allowRoles(...allRoles),         ctrl.getDropdown);

// GET  /api/inventory/by-project/:projectId  → project inventory (all roles)
router.get('/by-project/:projectId', verifyToken, allowRoles(...allRoles),         ctrl.getByProject);

// GET  /api/inventory               → list + filters + pagination (all roles)
router.get('/',                      verifyToken, allowRoles(...allRoles),         ctrl.getAll);

// GET  /api/inventory/:id           → single item detail (all roles)
router.get('/:id',                   verifyToken, allowRoles(...allRoles),         ctrl.getById);

// POST /api/inventory               → add new item (Admin + Field Worker)
router.post('/',                     verifyToken, allowRoles(...adminFieldWorker),  ctrl.create);

// PUT  /api/inventory/:id           → update item details (Admin + Field Worker)
router.put('/:id',                   verifyToken, allowRoles(...adminFieldWorker),  ctrl.update);

// PATCH /api/inventory/:id/adjust   → stock adjustment only (Admin + Field Worker)
router.patch('/:id/adjust',          verifyToken, allowRoles(...adminFieldWorker),  ctrl.adjustStock);

// DELETE /api/inventory/:id         → guard delete (Admin only)
router.delete('/:id',                verifyToken, allowRoles(...adminOnly),         ctrl.remove);

module.exports = router;
