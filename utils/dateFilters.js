const { Op } = require('sequelize');
const { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays } = require('date-fns');

const getDateRange = (period, startDate, endDate) => {
    const today = new Date();

    switch (period) {
        case 'today':
            return {
                [Op.between]: [
                    startOfDay(today),
                    endOfDay(today)
                ]
            };
        case 'yesterday':
            const yesterday = subDays(today, 1);
            return {
                [Op.between]: [
                    startOfDay(yesterday),
                    endOfDay(yesterday)
                ]
            };
        case 'month':
            return {
                [Op.between]: [
                    startOfMonth(today),
                    endOfMonth(today)
                ]
            };
        case 'custom':
            if (startDate && endDate) {
                return {
                    [Op.between]: [
                        startOfDay(new Date(startDate)),
                        endOfDay(new Date(endDate))
                    ]
                };
            }
        default:
            return {}; // No date filter
    }
};

module.exports = { getDateRange }; 