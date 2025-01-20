const { sequelize } = require('../config/db');
const Category = require('./Category');
const Transaction = require('./Transaction');
const Person = require('./Person');
const User = require('./User');

// Define associations
Category.hasMany(Transaction);
Transaction.belongsTo(Category);

Person.hasMany(Transaction);
Transaction.belongsTo(Person);

// Add user associations if needed
User.hasMany(Transaction);
Transaction.belongsTo(User);

module.exports = {
    Category,
    Transaction,
    Person,
    User
}; 