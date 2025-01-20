const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Person = sequelize.define('Person', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    }
});

module.exports = Person; 