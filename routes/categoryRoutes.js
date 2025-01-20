const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);  

// Get all categories
router.get('/', categoryController.getAll);

// Get categories by type
router.get('/type/:type', categoryController.getByType);

// Create category
router.post('/', categoryController.create);

// Update category
router.put('/:id', categoryController.update);

// Delete category
router.delete('/:id', categoryController.delete);

module.exports = router; 