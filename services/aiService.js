const parseUserInput = async (input, context) => { 
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: "system",
                        content: `You are an Arabic financial parser specialized in transactions and debts.
                        Extract amount as a number and description in Arabic from the input.
                        For debt transactions, determine if the money was borrowed or lent based on Arabic context clues.

                        Rules for debt detection:
                        - Words like "استلفت", "اقترضت", "أخذت قرض" indicate BORROWED money
                        - Words like "أقرضت", "سلفت", "أعطيت" indicate LENT money
                        
                        Example inputs and outputs:
                        Input: "استلفت ٥ آلاف من محمد"
                        Output: { "amount": 5000, "description": "محمد", "debtType": "borrowed" }
                        
                        Input: "أقرضت أحمد ٢٠٠ دينار"
                        Output: { "amount": 200, "description": "أحمد", "debtType": "lent" }
                        
                        Input: "صرفت ١٠٠ دينار على البقالة"
                        Output: { "amount": 100, "description": "البقالة" }

                        Return ONLY a JSON object in this format:
                        {
                            "amount": number,
                            "description": "Arabic description",
                            "debtType": "borrowed" or "lent" (only for debt transactions)
                        }`
                    },
                    {
                        role: "user",
                        content: input
                    }
                ],
                model: "mixtral-8x7b-32768",
                temperature: 0.1,
                response_format: { "type": "json_object" }
            })
        });

        if (!response.ok) {
            throw new Error(`AI API error: ${response.status}`);
        } 

        const data = await response.json();
        const parsedContent = JSON.parse(data.choices[0].message.content);

        return {
            amount: parsedContent.amount,
            description: parsedContent.description,
            debtType: parsedContent.debtType // Will be undefined for non-debt transactions
        };

    } catch (error) {
        console.error('AI Service Error:', error);
        throw new Error(`AI parsing error: ${error.message}`);
    }
};

module.exports = { parseUserInput }; 