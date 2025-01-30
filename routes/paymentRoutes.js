const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Debt payments CRUD
router.get('/debts/:debtId/payments', paymentController.getAllPayments);
router.post('/debts/:debtId/payments', paymentController.addPayment);
router.put('/debts/:debtId/payments/:id', paymentController.updatePayment);
router.delete('/debts/:debtId/payments/:id', paymentController.deletePayment);

// Debt summary
router.get('/debts/:debtId/summary', paymentController.getDebtSummary);

// Statistics
router.get('/statistics/debts/payments', paymentController.getPaymentsByDateRange);

module.exports = router;  