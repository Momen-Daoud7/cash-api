const { Transaction, Category, Person } = require('../models');
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
        const updates = req.body;
        
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

        await transaction.update(updates);

        res.json({
            success: true,
            data: transaction
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
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
        const dateFilter = getDateRange(period, startDate, endDate);

        console.log('Query Parameters:', {
            period,
            startDate,
            endDate,
            dateFilter,
            userId: req.user.id
        });

        const borrowedDebts = await Transaction.findAll({
            where: {
                type: 'debt',
                debtType: 'borrowed',
                UserId: req.user.id,
                date: dateFilter
            },
            include: [{
                model: Person,
                attributes: ['id', 'name']
            }],
            order: [['date', 'DESC']]
        });

        console.log('Found Borrowed Debts:', borrowedDebts);

        const total = borrowedDebts.reduce((sum, debt) => sum + Number(debt.amount), 0);

        res.json({
            success: true,
            data: borrowedDebts,
            total,
            period: period || 'all',
            dateRange: {
                start: startDate || 'none',
                end: endDate || 'none'
            }
        });
    } catch (error) {
        console.error('Error fetching borrowed debts:', error);
        console.error('Full error object:', JSON.stringify(error, null, 2));
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
        const dateFilter = getDateRange(period, startDate, endDate);

        console.log('Query Parameters:', {
            period,
            startDate,
            endDate,
            dateFilter,
            userId: req.user.id
        });

        const lentDebts = await Transaction.findAll({
            where: {
                type: 'debt',
                debtType: 'lent',
                UserId: req.user.id,
                date: dateFilter
            },
            include: [{
                model: Person,
                attributes: ['id', 'name']
            }],
            order: [['date', 'DESC']]
        });

        console.log('Found Lent Debts:', lentDebts);

        const total = lentDebts.reduce((sum, debt) => sum + Number(debt.amount), 0);

        res.json({
            success: true,
            data: lentDebts,
            total,
            period: period || 'all',
            dateRange: {
                start: startDate || 'none',
                end: endDate || 'none'
            }
        });
    } catch (error) {
        console.error('Error fetching lent debts:', error);
        console.error('Full error object:', JSON.stringify(error, null, 2));
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getAllDebts = async (req, res) => {
    try {
        const { status, type, search } = req.query;
        
        // Base where condition
        const whereCondition = {
            type: 'debt',
            userId: req.user.id
        };

        // Add status filter if provided
        if (status) {
            whereCondition.status = status;
        }

        // Add debt type filter if provided
        if (type) {
            whereCondition.debtType = type;
        }

        // Include person with search condition if provided
        const includeCondition = {
            model: Person,
            attributes: ['id', 'name']
        };

        if (search) {
            includeCondition.where = {
                name: {
                    [Op.iLike]: `%${search}%`
                }
            };
        }

        const debts = await Transaction.findAll({
            where: whereCondition,
            include: [includeCondition],
            order: [['date', 'DESC']]
        });

        // Group debts by type
        const groupedDebts = {
            borrowed: debts.filter(debt => debt.debtType === 'borrowed'),
            lent: debts.filter(debt => debt.debtType === 'lent')
        };

        res.json({
            success: true,
            data: groupedDebts
        });
    } catch (error) {
        console.error('Error fetching debts:', error);
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