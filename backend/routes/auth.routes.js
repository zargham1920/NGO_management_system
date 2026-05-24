const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const allowRoles = require('../middleware/role.middleware');
const validators = require('../validators/auth.validator');

router.post('/register', validators.validateRegister, authController.register);
router.post('/login', validators.validateLogin, authController.login);
router.get('/roles', authController.getRoles);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', validators.validateResetPassword, authController.resetPassword);
router.post('/logout', authMiddleware.verifyToken, authController.logout);
router.get('/me', authMiddleware.verifyToken, authController.getMe);
router.patch('/change-password', authMiddleware.verifyToken, validators.validateChangePassword, authController.changePassword);
router.get('/pending', authMiddleware.verifyToken, allowRoles('NGO Admin'), authController.getPendingUsers);
router.get('/all-users', authMiddleware.verifyToken, allowRoles('NGO Admin'), authController.getAllUsers);
router.patch('/approve/:userId', authMiddleware.verifyToken, allowRoles('NGO Admin'), authController.approveUser);
router.patch('/reject/:userId', authMiddleware.verifyToken, allowRoles('NGO Admin'), authController.rejectUser);

module.exports = router;
