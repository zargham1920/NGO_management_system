const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/stats', authMiddleware.verifyToken, dashboardController.getStats);
router.get('/recent-distributions', authMiddleware.verifyToken, dashboardController.getRecentDistributions);
router.get('/budget-summary', authMiddleware.verifyToken, dashboardController.getBudgetSummary);
router.get('/activity', authMiddleware.verifyToken, dashboardController.getActivity);
router.get('/coverage', authMiddleware.verifyToken, dashboardController.getCoverage);

module.exports = router;
