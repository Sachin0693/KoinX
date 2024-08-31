const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect('mongodb://localhost:27017/cryptoDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const transactionSchema = new mongoose.Schema({
    address: String,
    transactions: Array,
});

const priceSchema = new mongoose.Schema({
    price: Number,
    timestamp: { type: Date, default: Date.now },
});

const Transaction = mongoose.model('Transaction', transactionSchema);
const Price = mongoose.model('Price', priceSchema);

const ETHERSCAN_API_KEY = 'ANB3VHCQ778IJVI6UZEF3KRVPBX3TAGK2T'; 

app.get('/api/transactions/:address', async (req, res) => {
    const { address } = req.params;

    try {
        const response = await axios.get(
            `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`
        );

        const transactions = response.data.result;

        const transactionData = new Transaction({
            address: address,
            transactions: transactions,
        });

        await transactionData.save();
        res.json(transactions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching transactions' });
    }
});

const fetchEthereumPrice = async () => {
    try {
        const response = await axios.get(
            'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=inr'
        );
        const price = response.data.ethereum.inr;

        const priceData = new Price({ price });
        await priceData.save();

        console.log(`Fetched Ethereum price: ₹${price}`);
    } catch (error) {
        console.error('Error fetching Ethereum price:', error);
    }
};

setInterval(fetchEthereumPrice, 10 * 60 * 1000); 

app.get('/api/expenses/:address', async (req, res) => {
    const { address } = req.params;

    try {
        const transactionData = await Transaction.findOne({ address });

        if (!transactionData) {
            return res.status(404).json({ error: 'No transactions found for this address' });
        }
        const transactions = transactionData.transactions;
        let totalExpenses = 0;

        transactions.forEach(transaction => {
            const gasUsed = transaction.gasUsed;
            const gasPrice = transaction.gasPrice;
            const expense = (gasUsed * gasPrice) / 1e18; 
            totalExpenses += expense;
        });

        const latestPriceData = await Price.findOne().sort({ timestamp: -1 });

        if (!latestPriceData) {
            return res.status(404).json({ error: 'Ethereum price data not found' });
        }

        const currentPrice = latestPriceData.price;
        res.json({
            address,
            totalExpenses: totalExpenses.toFixed(6),
            currentPrice: currentPrice,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while calculating expenses' });
    }
});

app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
    fetchEthereumPrice(); 
});

// for transactions use link : http://localhost:3000/api/transactions/0xce94e5621a5f7068253c42558c147480f38b5e0d ;
// for expenses use link : http://localhost:3000/api/expenses/0xce94e5621a5f7068253c42558c147480f38b5e0d
