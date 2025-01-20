const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/logout', authenticate, userController.logout);

// Protected routes
router.get('/profile', authenticate, userController.getProfile);

module.exports = router; 