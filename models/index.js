const { sequelize } = require('../config/db');
const Category = require('./Category');
const Transaction = require('./Transaction');
const Person = require('./Person');
const User = require('./User');
const Payment = require('./Payment');

// Define associations

User.hasMany(Category);
Category.belongsTo(User);

Category.hasMany(Transaction, {
    onDelete: 'RESTRICT'  // Prevent deletion if transactions exist
});
Transaction.belongsTo(Category);

// Person associations without user relationship
Person.hasMany(Transaction, {
    onDelete: 'RESTRICT'  // Prevent deletion if transactions exist
});
Transaction.belongsTo(Person);

User.hasMany(Transaction);
Transaction.belongsTo(User);

// Payment associations
Transaction.hasMany(Payment, {
    foreignKey: 'debtId',
    as: 'Payments',
    onDelete: 'CASCADE'  // When a debt is deleted, delete its payments
});
Payment.belongsTo(Transaction, {
    foreignKey: 'debtId',
    as: 'Transaction'
});

module.exports = {
    Category,
    Transaction,
    Person,
    User,
    Payment
}; 