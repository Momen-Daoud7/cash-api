const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql',
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 60000,
            idle: 10000
        },
        dialectOptions: { 
            connectTimeout: 60000,
            // SSL configuration if      by Hostinger
            ssl: {
                rejectUnauthorized: false
            }
        }
    }
);

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to Hostinger MySQL database');
        
        // Sync models
        await sequelize.sync({ alter: true });
        console.log('Models synchronized'); 
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        process.exit(1);
    }
};

module.exports = { sequelize, connectDB };
