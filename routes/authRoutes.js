const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Public routes
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.getCurrentUser);
router.post('/register', authController.registerCustomer);

// Admin routes
router.post('/staff', isAdmin, authController.createStaff);
router.get('/staff', isAdmin, authController.getAllStaff);
router.put('/staff/:id/reset-password', isAdmin, authController.resetPassword);
router.put('/staff/:id/toggle-lock', isAdmin, authController.toggleAccountLock);

module.exports = router;
