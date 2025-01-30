const { Category, Transaction } = require('../models');

const categoryController = {
    // Create category
    create: async (req, res) => {
        try {
            const { name, type } = req.body;
            const category = await Category.create({ name, type });
            res.status(201).json(category);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Get all categories
    getAll: async (req, res) => {
        try {
            const categories = await Category.findAll();
            res.json(categories);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Get category by ID
    getById: async (req, res) => {
        try {
            const category = await Category.findByPk(req.params.id);
            if (!category) {
                return res.status(404).json({ message: 'Category not found' });
            }
            res.json(category);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Update category
    update: async (req, res) => {
        try {
            const { name, type } = req.body;
            const category = await Category.findByPk(req.params.id);
            if (!category) {
                return res.status(404).json({ message: 'Category not found' });
            }
            await category.update({ name, type });
            res.json(category);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Delete category
    delete: async (req, res) => {
        try {
            const categoryId = req.params.id;
            
            // First check if category exists
            const category = await Category.findOne({
                where: { 
                    id: categoryId,
                }
            });

            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: 'Category not found'
                });
            }

            // Check if category has transactions
            const transactionCount = await Transaction.count({
                where: { CategoryId: categoryId }
            });

            if (transactionCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete category with existing transactions. Please reassign or delete the transactions first.'
                });
            }

            // If no transactions, proceed with deletion
            await category.destroy();

            res.json({
                success: true,
                message: 'Category deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting category:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Get categories by type
    getByType: async (req, res) => {
        try {
            const { type } = req.params;
            
            // Validate type parameter
            if (!['income', 'expense'].includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid category type. Must be either "income" or "expense"'
                });
            }

            const categories = await Category.findAll({
                where: { type },
                order: [['name', 'ASC']] // Optional: sort by name
            });

            res.json({
                success: true,
                data: categories
            });
        } catch (error) {
            console.error('Error fetching categories by type:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};

module.exports = categoryController; 