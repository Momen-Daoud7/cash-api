const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authenticate } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authenticate);

// Debt specific routes
router.get('/debts', transactionController.getAllDebts);
router.get('/debts/summary', transactionController.getDebtsSummary);
router.get('/debts/borrowed', transactionController.getBorrowedDebts);
router.get('/debts/lent', transactionController.getLentDebts);
router.get('/debts/:id', transactionController.getDebtById);
router.patch('/debts/:id/status', transactionController.updateDebtStatus);
// router.get('/debts/borrowed', transactionController.getBorrowedDebts);
// router.get('/debts/lent', transactionController.getLentDebts);

// Existing routes
router.get('/incomes', transactionController.getIncomes);
router.get('/expenses', transactionController.getExpenses);
router.post('/', transactionController.create);
router.get('/', transactionController.getAll);
router.patch('/:id', transactionController.update);
router.delete('/:id', transactionController.delete);

module.exports = router;  