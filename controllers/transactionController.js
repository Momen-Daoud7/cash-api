const { Transaction, Category, Person, Payment } = require('../models');
const { parseUserInput } = require('../services/aiService');
const { Op } = require('sequelize');
const sequelize = require('sequelize');

// Utility function to get date range based on period or custom dates
const getDateRange = (period, startDate, endDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    switch (period) {
        case 'today':
            return {
                [Op.gte]: today,
                [Op.lt]: tomorrow
            };
        case 'yesterday':
            return {
                [Op.gte]: yesterday,
                [Op.lt]: today
            };
        case 'month':
            return {
                [Op.gte]: monthStart,
                [Op.lte]: monthEnd
            };
        default:
            if (startDate && endDate) {
                return {
                    [Op.gte]: new Date(startDate),
                    [Op.lte]: new Date(endDate)
                };
            }
            return {}; // No date filter if no period or dates specified
    }
};

// Create transaction with natural language input
const create = async (req, res) => {
    try {
        const { 
            type,
            categoryId,
            personId,
            input,
            date 
        } = req.body;

        // First parse the natural language input
        const parsedData = await parseUserInput(input, { type });

        // Validate category exists if provided
        if (categoryId) {
            const category = await Category.findByPk(categoryId);
            if (!category) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Category not found' 
                });
            }
        }

        // Validate person exists if it's a debt
        if (type === 'debt' && !personId) {
            return res.status(400).json({
                success: false,
                message: 'Person is required for debt transactions'
            });
        }

        // Create the transaction
        const transaction = await Transaction.create({
            type,
            amount: parsedData.amount,
            description: parsedData.description,
            CategoryId: categoryId,
            PersonId: personId,
            date: date || new Date(),
            debtType: parsedData.debtType,
            UserId: req.user.id
        });

        // Fetch the complete transaction with relations
        const completeTransaction = await Transaction.findByPk(transaction.id, {
            include: [
                {
                    model: Category,
                    attributes: ['name', 'type']
                },
                {
                    model: Person,
                    attributes: ['name']
                }
            ]
        });

        res.status(201).json({
            success: true,
            data: {
                id: completeTransaction.id,
                type: completeTransaction.type,
                amount: completeTransaction.amount,
                description: completeTransaction.description,
                category: completeTransaction.Category?.name,
                person: completeTransaction.Person?.name,
                date: completeTransaction.date,
                debtType: completeTransaction.debtType
            }
        });

    } catch (error) {
        console.error('Transaction Processing Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};



// Get all transactions
const getAll = async (req, res) => {
    try {
        const transactions = await Transaction.findAll({
            where: { UserId: req.user.id },
            include: [
                {
                    model: Category,
                    attributes: ['name', 'type']
                },
                {
                    model: Person,
                    attributes: ['name']
                }
            ],
            order: [['date', 'DESC']]
        });

        res.json({
            success: true,
            data: transactions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get debts summary
const getDebts = async (req, res) => {
    try {
        const debts = await Transaction.findAll({
            where: {
                type: 'debt',
                UserId: req.user.id
            },
            include: [{
                model: Person,
                attributes: ['id', 'name']
            }],
            order: [['date', 'DESC']]
        });

        // Group debts by person
        const groupedDebts = debts.reduce((acc, debt) => {
            const personId = debt.Person?.id;
            if (!personId) return acc;

            if (!acc[personId]) {
                acc[personId] = {
                    person: debt.Person.name,
                    borrowed: 0,
                    lent: 0
                };
            }

            if (debt.debtType === 'borrowed') {
                acc[personId].borrowed += parseFloat(debt.amount);
            } else {
                acc[personId].lent += parseFloat(debt.amount);
            }

            return acc;
        }, {});

        res.json({
            success: true,
            data: {
                details: debts,
                summary: groupedDebts
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Update transaction
const update = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, type, amount, categoryId, personId, debtType, status } = req.body;

        // Find the transaction
        const transaction = await Transaction.findOne({
            where: { 
                id,
                UserId: req.user.id
            }
        });

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Prepare update object
        const updateData = {
            date,
            type,
            amount
        };

        // Handle debt-specific updates
        if (type === 'debt') {
            if (!personId) {
                return res.status(400).json({
                    success: false,
                    message: 'Person ID is required for debt transactions'
                });
            }
            updateData.PersonId = personId;
            updateData.debtType = debtType;
            updateData.paymentStatus = status;
        }
        // Handle expense/income updates
        else if (type === 'expense' || type === 'income') {
            if (!categoryId) {
                return res.status(400).json({
                    success: false,
                    message: 'Category ID is required for expense/income transactions'
                });
            }
            updateData.CategoryId = categoryId;
        }

        // Update the transaction
        await transaction.update(updateData);

        // Fetch updated transaction with associations
        const updatedTransaction = await Transaction.findOne({
            where: { id },
            include: [
                {
                    model: Person,
                    attributes: ['id', 'name']
                },
                {
                    model: Category,
                    attributes: ['id', 'name']
                },
                {
                    model: Payment,
                    as: 'Payments',
                    attributes: ['id', 'amount']
                }
            ]
        });

        // Calculate partial payments for debt transactions
        let responseData = {
            ...updatedTransaction.toJSON()
        };

        if (type === 'debt') {
            const partial_payment = updatedTransaction.Payments ? 
                updatedTransaction.Payments.reduce((sum, payment) => sum + Number(payment.amount), 0) : 0;
            
            responseData.partial_payment = partial_payment;
            responseData.remaining_amount = Number(amount) - partial_payment;
        }

        res.json({
            success: true,
            message: 'Transaction updated successfully',
            data: responseData
        });

    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete transaction
const deleteTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        
        const transaction = await Transaction.findOne({
            where: { 
                id,
                UserId: req.user.id
            }
        });

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        await transaction.destroy();

        res.json({
            success: true,
            message: 'Transaction deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get all income transactions
const getIncomes = async (req, res) => {
    try {
        const { period, startDate, endDate } = req.query;
        const dateFilter = getDateRange(period, startDate, endDate);

        const incomes = await Transaction.findAll({
            where: {
                type: 'income',
                userId: req.user.id,
                date: dateFilter
            },
            include: [Category],
            order: [['date', 'DESC']]
        });

        // Calculate total
        const total = incomes.reduce((sum, income) => sum + Number(income.amount), 0);

        res.json({
            success: true,
            data: incomes,
            total,
            period: period || 'all',
            dateRange: {
                start: startDate || 'none',
                end: endDate || 'none'
            }
        });
    } catch (error) {
        console.error('Error fetching incomes:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all expense transactions
const getExpenses = async (req, res) => {
    try {
        const { period, startDate, endDate } = req.query;
        const dateFilter = getDateRange(period, startDate, endDate);

        const expenses = await Transaction.findAll({
            where: {
                type: 'expense',
                userId: req.user.id,
                date: dateFilter
            },
            include: [Category],
            order: [['date', 'DESC']]
        });

        const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

        res.json({
            success: true,
            data: expenses,
            total,
            period: period || 'all',
            dateRange: {
                start: startDate || 'none',
                end: endDate || 'none'
            }
        });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get borrowed debts
const getBorrowedDebts = async (req, res) => {
    try {
        const { period, startDate, endDate } = req.query;
        let dateFilter = {};
        
        if (period || (startDate && endDate)) {
            dateFilter = getDateRange(period, startDate, endDate);
        }

        const debts = await Transaction.findAll({
            where: {
                type: 'debt',
                debtType: 'borrowed',
                UserId: req.user.id,
                ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
            },
            include: [
                {
                    model: Person,
                    attributes: ['id', 'name']
                },
                {
                    model: Payment,
                    as: 'Payments',
                    attributes: ['amount']
                }
            ],
            order: [['date', 'DESC']]
        });

        // Calculate totals
        let totalBorrowed = 0;
        let totalPaid = 0;

        const formattedDebts = debts.map(debt => {
            const partial_payment = debt.Payments ? 
                debt.Payments.reduce((sum, payment) => sum + Number(payment.amount), 0) : 0;

            totalBorrowed += Number(debt.amount);
            totalPaid += partial_payment;

            return {
                id: debt.id,
                amount: Number(debt.amount),
                type: debt.type,
                debtType: debt.debtType,
                date: debt.date,
                description: debt.description,
                paymentStatus: debt.paymentStatus,
                Person: debt.Person,
                partial_payment: partial_payment,
                remaining_amount: Number(debt.amount) - partial_payment,
                createdAt: debt.createdAt,
                updatedAt: debt.updatedAt
            };
        });

        res.json({
            success: true,
            data: formattedDebts,
            summary: {
                total_borrowed: totalBorrowed,
                total_paid: totalPaid,
                total_remaining: totalBorrowed - totalPaid
            },
            period: period || 'all',
            dateRange: {
                start: startDate || 'none',
                end: endDate || 'none'
            }
        });

    } catch (error) {
        console.error('Error fetching borrowed debts:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get lent debts
const getLentDebts = async (req, res) => {
    try {
        const { period, startDate, endDate } = req.query;
        let dateFilter = {};
        
        if (period || (startDate && endDate)) {
            dateFilter = getDateRange(period, startDate, endDate);
        }

        const debts = await Transaction.findAll({
            where: {
                type: 'debt',
                debtType: 'lent',
                UserId: req.user.id,
                ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
            },
            include: [
                {
                    model: Person,
                    attributes: ['id', 'name']
                },
                {
                    model: Payment,
                    as: 'Payments',
                    attributes: ['amount']
                }
            ],
            order: [['date', 'DESC']]
        });

        // Calculate totals
        let totalLent = 0;
        let totalPaid = 0;

        const formattedDebts = debts.map(debt => {
            const partial_payment = debt.Payments ? 
                debt.Payments.reduce((sum, payment) => sum + Number(payment.amount), 0) : 0;

            totalLent += Number(debt.amount);
            totalPaid += partial_payment;

            return {
                id: debt.id,
                amount: Number(debt.amount),
                type: debt.type,
                debtType: debt.debtType,
                date: debt.date,
                description: debt.description,
                paymentStatus: debt.paymentStatus,
                Person: debt.Person,
                partial_payment: partial_payment,
                remaining_amount: Number(debt.amount) - partial_payment,
                createdAt: debt.createdAt,
                updatedAt: debt.updatedAt
            };
        });

        res.json({
            success: true,
            data: formattedDebts,
            summary: {
                total_lent: totalLent,
                total_paid: totalPaid,
                total_remaining: totalLent - totalPaid
            },
            period: period || 'all',
            dateRange: {
                start: startDate || 'none',
                end: endDate || 'none'
            }
        });

    } catch (error) {
        console.error('Error fetching lent debts:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getAllDebts = async (req, res) => {
    try {
        const { period } = req.query;
        
        const whereClause = {
            type: 'debt',
            UserId: req.user.id
        };

        if (period) {
            const dateFilter = getDateRange(period, null, null);
            if (dateFilter) {
                whereClause.date = dateFilter;
            }
        }

        const debts = await Transaction.findAll({
            where: whereClause,
            include: [
                {
                    model: Person,
                    attributes: ['id', 'name']
                },
                {
                    model: Payment,
                    as: 'Payments',
                    attributes: ['amount']
                }
            ],
            order: [['date', 'DESC']]
        });

        // Separate arrays for borrowed and lent debts
        const borrowedDebts = [];
        const lentDebts = [];

        // Calculate totals and status counts
        let totalBorrowed = 0;
        let totalLent = 0;
        let totalBorrowedPaid = 0;
        let totalLentPaid = 0;

        // Payment status counters for borrowed
        let borrowedPaidCount = 0;
        let borrowedUnpaidCount = 0;
        let borrowedPartialCount = 0;

        // Payment status counters for lent
        let lentPaidCount = 0;
        let lentUnpaidCount = 0;
        let lentPartialCount = 0;

        debts.forEach(debt => {
            const partial_payment = debt.Payments ? 
                debt.Payments.reduce((sum, payment) => sum + Number(payment.amount), 0) : 0;

            const formattedDebt = {
                id: debt.id,
                amount: Number(debt.amount),
                type: debt.type,
                debtType: debt.debtType,
                date: debt.date,
                description: debt.description,
                paymentStatus: debt.paymentStatus,
                Person: debt.Person,
                partial_payment: partial_payment,
                remaining_amount: Number(debt.amount) - partial_payment,
                createdAt: debt.createdAt,
                updatedAt: debt.updatedAt
            };

            if (debt.debtType === 'borrowed') {
                borrowedDebts.push(formattedDebt);
                totalBorrowed += Number(debt.amount);
                totalBorrowedPaid += partial_payment;

                // Update borrowed status counts
                if (debt.paymentStatus === 'paid') {
                    borrowedPaidCount++;
                } else if (debt.paymentStatus === 'unpaid') {
                    borrowedUnpaidCount++;
                } else if (debt.paymentStatus === 'partial') {
                    borrowedPartialCount++;
                }
            } else if (debt.debtType === 'lent') {
                lentDebts.push(formattedDebt);
                totalLent += Number(debt.amount);
                totalLentPaid += partial_payment;

                // Update lent status counts
                if (debt.paymentStatus === 'paid') {
                    lentPaidCount++;
                } else if (debt.paymentStatus === 'unpaid') {
                    lentUnpaidCount++;
                } else if (debt.paymentStatus === 'partial') {
                    lentPartialCount++;
                }
            }
        });

        res.json({
            success: true,
            data: {
                borrowed: borrowedDebts,
                lent: lentDebts
            },
            summary: {
                borrowed: {
                    total: totalBorrowed,
                    paid: totalBorrowedPaid,
                    remaining: totalBorrowed - totalBorrowedPaid,
                    status: {
                        paid: borrowedPaidCount,
                        unpaid: borrowedUnpaidCount,
                        partial: borrowedPartialCount,
                        total: borrowedDebts.length
                    }
                },
                lent: {
                    total: totalLent,
                    paid: totalLentPaid,
                    remaining: totalLent - totalLentPaid,
                    status: {
                        paid: lentPaidCount,
                        unpaid: lentUnpaidCount,
                        partial: lentPartialCount,
                        total: lentDebts.length
                    }
                }
            },
            filters: {
                period: period || 'all'
            }
        });

    } catch (error) {
        console.error('Error fetching all debts:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getDebtsSummary = async (req, res) => {
    try {
        const debts = await Transaction.findAll({
            where: {
                type: 'debt',
                userId: req.user.id
            },
            attributes: [
                'debtType',
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                [sequelize.fn('SUM', sequelize.col('amount')), 'total']
            ],
            group: ['debtType', 'status']
        });

        // Process and format the summary
        const summary = {
            borrowed: {
                total: "0.00",
                paid: "0.00",
                unpaid: "0.00",
                count: { total: 0, paid: 0, unpaid: 0 }
            },
            lent: {
                total: "0.00",
                paid: "0.00",
                unpaid: "0.00",
                count: { total: 0, paid: 0, unpaid: 0 }
            }
        };

        debts.forEach(debt => {
            const type = debt.debtType;
            const status = debt.status;
            const amount = parseFloat(debt.getDataValue('total') || 0);
            const count = parseInt(debt.getDataValue('count') || 0);

            summary[type].total = (parseFloat(summary[type].total) + amount).toFixed(2);
            summary[type][status] = amount.toFixed(2);
            summary[type].count.total += count;
            summary[type].count[status] = count;
        });

        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Error fetching debts summary:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getDebtById = async (req, res) => {
    try {
        const debt = await Transaction.findOne({
            where: {
                id: req.params.id,
                type: 'debt',
                userId: req.user.id
            },
            include: [{
                model: Person,
                attributes: ['id', 'name']
            }]
        });

        if (!debt) {
            return res.status(404).json({
                success: false,
                message: 'Debt not found'
            });
        }

        res.json({
            success: true,
            data: debt
        });
    } catch (error) {
        console.error('Error fetching debt:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateDebtStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const debt = await Transaction.findOne({
            where: {
                id: req.params.id,
                type: 'debt',
                userId: req.user.id
            },
            include: [{
                model: Person,
                attributes: ['id', 'name']
            }]
        });

        if (!debt) {
            return res.status(404).json({
                success: false,
                message: 'Debt not found'
            });
        }

        if (!['paid', 'unpaid'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        await debt.update({ status });

        res.json({
            success: true,
            data: debt
        });
    } catch (error) {
        console.error('Error updating debt status:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    create,
    getAll,
    getDebts,
    update,
    delete: deleteTransaction, // renamed because 'delete' is a reserved word
    getIncomes,
    getExpenses,
    getBorrowedDebts,
    getLentDebts,
    getAllDebts,
    getDebtsSummary,
    getDebtById,
    updateDebtStatus
}; 