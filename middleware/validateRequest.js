const validateRequest = (req, res, next) => {
    try {
        // Log the raw request body for debugging
        console.log('Raw request body:', req.body);
        
        // Check if required fields exist
        const { type, input } = req.body;
        
        if (!type || !input) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['type', 'input']
            });
        }

        // Validate type
        const validTypes = ['income', 'expense', 'debit'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                error: 'Invalid type',
                validTypes
            });
        }

        next();
    } catch (error) {
        console.error('Request validation error:', error);
        res.status(400).json({
            error: 'Invalid request format',
            message: error.message
        });
    }
};

module.exports = validateRequest; 