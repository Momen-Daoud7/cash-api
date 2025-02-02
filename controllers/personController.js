const { Person, Transaction } = require('../models');

const personController = {
    // Create person
    create: async (req, res) => {
        try {
            const { name } = req.body;
            const person = await Person.create({ name });
            res.status(201).json(person);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Get all persons with their debts
    getAll: async (req, res) => {
        try {
            const persons = await Person.findAll({
                include: [{
                    model: Transaction,
                    where: { type: 'debit' },
                    required: false
                }]
            });
            res.json(persons);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Get person by ID
    getById: async (req, res) => {
        try {
            const person = await Person.findByPk(req.params.id, {
                include: [{
                    model: Transaction,
                    where: { type: 'debit' },
                    required: false
                }]
            });
            if (!person) {
                return res.status(404).json({ message: 'Person not found' });
            }
            res.json(person);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Update person
    update: async (req, res) => {
        try {
            const { name } = req.body;
            const person = await Person.findByPk(req.params.id);
            if (!person) {
                return res.status(404).json({ message: 'Person not found' });
            }
            await person.update({ name });
            res.json(person);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Delete person
    delete: async (req, res) => {
        try {
            const personId = req.params.id;
            
            // First check if person exists
            const person = await Person.findOne({
                where: { id: personId }
            });

            if (!person) {
                return res.status(404).json({
                    success: false,
                    message: 'Person not found'
                });
            }

            // Check if person has transactions
            const transactionCount = await Transaction.count({
                where: { PersonId: personId }
            });

            if (transactionCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete person with existing transactions. Please reassign or delete the transactions first.'
                });
            }

            // If no transactions, proceed with deletion
            await person.destroy();

            res.json({
                success: true,
                message: 'Person deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting person:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};

module.exports = personController; 