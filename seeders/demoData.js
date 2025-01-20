const { User, Category, Person, Transaction } = require('../models');
const bcrypt = require('bcrypt');

async function seedDatabase() {
    try {
        // Create demo user
        const hashedPassword = await bcrypt.hash('123456', 10);
        // const user = await User.create({
        //     name: 'أحمد محمد',
        //     email: 'ahmed@example.com',
        //     password: hashedPassword
        // });

        // Create categories
        const incomeCategories = await Category.bulkCreate([
            { id: 1, name: 'راتب', type: 'income', UserId: 1 },
            { id: 2, name: 'عمل حر', type: 'income', UserId: 1 },
            { id: 3, name: 'استثمار', type: 'income', UserId: 1 },
            { id: 4, name: 'هدية', type: 'income', UserId: 1 },
            { id: 5, name: 'مكافأة', type: 'income', UserId: 1 }
        ], { updateOnDuplicate: ['name', 'type'] });

        const expenseCategories = await Category.bulkCreate([
            { name: 'طعام', type: 'expense' },
            { name: 'مواصلات', type: 'expense' },
            { name: 'إيجار', type: 'expense' },
            { name: 'فواتير', type: 'expense' },
            { name: 'تسوق', type: 'expense' },
            { name: 'صحة', type: 'expense' },
            { name: 'تعليم', type: 'expense' },
            { name: 'ترفيه', type: 'expense' }
        ]);

        // Create people
        const people = await Person.bulkCreate([
            { name: 'محمد علي', UserId:     1 },
            { name: 'فاطمة أحمد', UserId: 1 },
            { name: 'عمر حسن', UserId: 1 },
            { name: 'زينب محمود', UserId: 1 },
            { name: 'خالد إبراهيم', UserId: 1 }
        ]);

        // Helper function to generate random date within last 3 months
        const getRandomDate = () => {
            const end = new Date();
            const start = new Date();
            start.setMonth(start.getMonth() - 3);
            return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
        };

        // Create income transactions
        const incomeTransactions = [];
        for (let i = 0; i < 20; i++) {
            incomeTransactions.push({
                amount: Math.floor(Math.random() * 5000) + 1000,
                type: 'income',
                date: getRandomDate(),
                description: 'دخل شهر ' + (Math.floor(Math.random() * 3) + 1),
                CategoryId: incomeCategories[Math.floor(Math.random() * incomeCategories.length)].id,
                UserId: 1,
                status: null  // Will be set to null automatically
            });
        }
        await Transaction.bulkCreate(incomeTransactions);

        // Create expense transactions
        const expenseTransactions = [];
        for (let i = 0; i < 30; i++) {
            expenseTransactions.push({
                amount: Math.floor(Math.random() * 1000) + 100,
                type: 'expense',
                date: getRandomDate(),
                description: 'مصروف يومي',
                CategoryId: expenseCategories[Math.floor(Math.random() * expenseCategories.length)].id,
                UserId: 1,
                status: null 
            });
        }
        await Transaction.bulkCreate(expenseTransactions);

        // Create debt transactions
        const debtTypes = ['borrowed', 'lent'];
        const debtDescriptions = {
            borrowed: ['قرض شخصي', 'سلفة', 'دين مؤقت'],
            lent: ['إقراض صديق', 'سلفة لزميل', 'دين لقريب']
        };

        const debtTransactions = [];
        for (let i = 0; i < 15; i++) {
            const debtType = debtTypes[Math.floor(Math.random() * 2)];
            debtTransactions.push({
                amount: Math.floor(Math.random() * 2000) + 500,
                type: 'debt',
                debtType: debtType,
                status: Math.random() > 0.7 ? 'paid' : 'unpaid',  // Required for debt
                date: getRandomDate(),
                description: debtDescriptions[debtType][Math.floor(Math.random() * 3)],
                PersonId: people[Math.floor(Math.random() * people.length)].id,
                UserId: 1
            });
        }
        await Transaction.bulkCreate(debtTransactions);

        console.log('Database seeded successfully!');
        console.log('Demo user credentials:');
        console.log('Email: ahmed@example.com');
        console.log('Password: 123456');

    } catch (error) {
        console.error('Error seeding database:', error);
    }
}

// Run the seeder
seedDatabase(); 