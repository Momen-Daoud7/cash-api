const express = require('express');
const cors = require('cors');
require('dotenv').config();

const userRoutes = require('./routes/userRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const personRoutes = require('./routes/personRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const { connectDB } = require('./config/db');

const app = express();




connectDB()
// Middleware 

app.use(cors());
app.use(express.json()); 

// Routes
app.use('/api/auth', userRoutes);
app.use('/api', paymentRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes); 
app.use('/api/persons', personRoutes);


// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!'
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});  