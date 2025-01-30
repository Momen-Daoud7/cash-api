const { Transaction, Payment, Person } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');

const paymentController = {
    // Get all payments for a debt
    getAllPayments: async (req, res) => {
        try {
            const { debtId } = req.params;
            const payments = await Payment.findAll({
                where: { debtId },
                order: [['paymentDate', 'DESC']],
                attributes: [
                    ['id', 'id'],
                    ['debtId', 'debt_id'],
                    ['amount', 'amount'],
                    ['paymentDate', 'payment_date'],
                    ['notes', 'notes'],
                    ['createdAt', 'created_at']
                ]
            });

            res.json({
                success: true,
                data: payments
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Add new payment
    addPayment: async (req, res) => {
        const t = await sequelize.transaction();
        try {
            const { debtId } = req.params;
            const { amount, payment_date, notes } = req.body;

            const debt = await Transaction.findByPk(debtId);
            if (!debt) {
                return res.status(404).json({
                    success: false,
                    message: 'Debt not found'
                });
            }

            const payment = await Payment.create({
                debtId,
                amount,
                paymentDate: payment_date,
                notes
            }, { transaction: t });

            const totalPaid = await Payment.sum('amount', {
                where: { debtId }
            }) + Number(amount);

            const status = totalPaid >= debt.amount ? 'paid' : 
                          totalPaid > 0 ? 'partial' : 'unpaid';
            
            await debt.update({ paymentStatus: status }, { transaction: t });

            await t.commit();

            res.status(201).json({
                success: true,
                data: {
                    id: payment.id,
                    debt_id: payment.debtId,
                    amount: payment.amount,
                    payment_date: payment.paymentDate,
                    notes: payment.notes,
                    created_at: payment.createdAt
                }
            });
        } catch (error) {
            await t.rollback();
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Update payment
    updatePayment: async (req, res) => {
        const t = await sequelize.transaction();
        try {
            const { debtId, id } = req.params;
            const { amount, payment_date, notes } = req.body;

            const payment = await Payment.findOne({
                where: { id, debtId }
            });

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: 'Payment not found'
                });
            }

            await payment.update({
                amount,
                paymentDate: payment_date,
                notes
            }, { transaction: t });

            // Recalculate debt status
            const debt = await Transaction.findByPk(debtId);
            const totalPaid = await Payment.sum('amount', {
                where: { debtId }
            });

            const status = totalPaid >= debt.amount ? 'paid' : 
                          totalPaid > 0 ? 'partial' : 'unpaid';
            
            await debt.update({ paymentStatus: status }, { transaction: t });

            await t.commit();

            res.json({
                success: true,
                data: {
                    id: payment.id,
                    debt_id: payment.debtId,
                    amount: payment.amount,
                    payment_date: payment.paymentDate,
                    notes: payment.notes,
                    created_at: payment.createdAt
                }
            });
        } catch (error) {
            await t.rollback();
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Delete payment
    deletePayment: async (req, res) => {
        const t = await sequelize.transaction();
        try {
            const { debtId, id } = req.params;

            // Get the debt and all its payments before deletion
            const debt = await Transaction.findOne({
                where: { id: debtId },
                include: [{
                    model: Payment,
                    as: 'Payments',
                    attributes: ['id', 'amount']
                }]
            });

            if (!debt) {
                return res.status(404).json({
                    success: false,
                    message: 'Debt not found'
                });
            }

            // Find the payment to be deleted
            const paymentToDelete = debt.Payments.find(p => p.id === Number(id));
            if (!paymentToDelete) {
                return res.status(404).json({
                    success: false,
                    message: 'Payment not found'
                });
            }

            // Delete the payment
            await Payment.destroy({
                where: {
                    id: id,
                    debtId: debtId
                },
                transaction: t
            });

            // Calculate new total paid amount excluding the deleted payment
            const newTotalPaid = debt.Payments
                .filter(p => p.id !== Number(id))
                .reduce((sum, payment) => sum + Number(payment.amount), 0);

            // Update debt status based on new total
            let newStatus;
            if (newTotalPaid === 0) {
                newStatus = 'unpaid';
            } else if (newTotalPaid >= Number(debt.amount)) {
                newStatus = 'paid';
            } else {
                newStatus = 'partial';
            }

            // Update debt status
            await debt.update({ 
                paymentStatus: newStatus 
            }, { transaction: t });

            await t.commit();

            res.json({
                success: true,
                message: `Payment deleted successfully. Debt status updated to ${newStatus}`,
                data: {
                    debtId: debtId,
                    newStatus: newStatus,
                    totalPaid: newTotalPaid,
                    remaining: Number(debt.amount) - newTotalPaid
                }
            });

        } catch (error) {
            await t.rollback();
            console.error('Error deleting payment:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Get debt summary
    getDebtSummary: async (req, res) => {
        try {
            const { debtId } = req.params;
            const debt = await Transaction.findOne({
                where: { id: debtId },
                include: [{
                    model: Payment,
                    attributes: [
                        'id',
                        'amount',
                        ['paymentDate', 'payment_date'],
                        'notes'
                    ]
                }]
            });

            if (!debt) {
                return res.status(404).json({
                    success: false,
                    message: 'Debt not found'
                });
            }

            const totalPaid = debt.Payments.reduce((sum, payment) => 
                sum + Number(payment.amount), 0);

            res.json({
                success: true,
                data: {
                    id: debt.id,
                    total_amount: debt.amount,
                    paid_amount: totalPaid,
                    remaining_amount: debt.amount - totalPaid,
                    status: debt.paymentStatus,
                    payments: debt.Payments
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Get payments by date range
    getPaymentsByDateRange: async (req, res) => {
        try {
            const { start_date, end_date } = req.query;
            
            const payments = await Payment.findAll({
                include: [{
                    model: Transaction,
                    include: [{
                        model: Person,
                        attributes: ['name']
                    }],
                    where: {
                        type: 'debt'
                    },
                    attributes: ['debtType']
                }],
                where: {
                    paymentDate: {
                        [Op.between]: [start_date, end_date]
                    }
                }
            });

            const totalPayments = payments.reduce((sum, payment) => 
                sum + Number(payment.amount), 0);

            const formattedPayments = payments.map(payment => ({
                date: payment.paymentDate,
                amount: payment.amount,
                debt_type: payment.Transaction.debtType,
                person_name: payment.Transaction.Person.name
            }));

            res.json({
                success: true,
                data: {
                    total_payments: totalPayments,
                    payments: formattedPayments
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};

module.exports = paymentController; 