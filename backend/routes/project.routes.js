const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const authMiddleware = require('../middleware/auth.middleware');
const allowRoles = require('../middleware/role.middleware');

const financeAdmin = ['Finance Officer', 'NGO Admin'];

router.get('/', authMiddleware.verifyToken, allowRoles(...financeAdmin), projectController.getAll);

module.exports = router;
