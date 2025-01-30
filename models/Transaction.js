const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Transaction = sequelize.define('Transaction', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('expense', 'income', 'debt'),
        allowNull: false
    },
    debtType: {
        type: DataTypes.ENUM('borrowed', 'lent'),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('paid', 'unpaid'),
        allowNull: true,  // Allow null for non-debt transactions
        defaultValue: null,
        validate: {
            isValidStatus(value) {
                if (this.type === 'debt' && !value) {
                    throw new Error('Status is required for debt transactions');
                }
                if (this.type !== 'debt' && value) {
                    throw new Error('Status should be null for non-debt transactions');
                }
            }
        }
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    paymentStatus: {
        type: DataTypes.ENUM('paid', 'unpaid', 'partial'),
        defaultValue: 'unpaid'
    }
}, {
    timestamps: true,
    tableName: 'transactions',
    hooks: {
        beforeValidate: (transaction) => {
            // Automatically set status for non-debt transactions to null
            if (transaction.type !== 'debt') {
                transaction.status = null;
            }
            // Set default status for debt transactions if not provided
            if (transaction.type === 'debt' && !transaction.status) {
                transaction.status = 'unpaid';
            }
        }
    }
});
    
module.exports = Transaction; 