const express = require('express');
const router = express.Router();
const personController = require('../controllers/personController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get all persons
router.get('/', personController.getAll);

// Create person
router.post('/', personController.create);

// Update person
router.put('/:id', personController.update);

// Delete person
router.delete('/:id', personController.delete);

module.exports = router; 