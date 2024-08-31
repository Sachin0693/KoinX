const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const path = require("path");

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/cryptoDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Define a schema and model for storing transactions and Ethereum prices
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

// Etherscan API Key
const ETHERSCAN_API_KEY = 'ANB3VHCQ778IJVI6UZEF3KRVPBX3TAGK2T'; // Replace with your actual Etherscan API key

/**
 * Task 1: Fetch transactions using Etherscan API
 * API Route: /api/transactions/:address
 * Input: Ethereum address (passed as a URL parameter)
 * Output: List of transactions for the address
 */
app.get('/api/transactions/:address', async (req, res) => {
    const { address } = req.params;

    try {
        // Fetch transactions from Etherscan API
        const response = await axios.get(
            `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`
        );

        const transactions = response.data.result;

        // Save the fetched transactions in MongoDB
        const transactionData = new Transaction({
            address: address,
            transactions: transactions,
        });

        await transactionData.save();

        // Return the transactions in the API response
        res.json(transactions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching transactions' });
    }
});

/**
 * Task 2: Fetch Ethereum price every 10 minutes
 */
const fetchEthereumPrice = async () => {
    try {
        const response = await axios.get(
            'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=inr'
        );
        const price = response.data.ethereum.inr;

        // Save the price in MongoDB
        const priceData = new Price({ price });
        await priceData.save();

        console.log(`Fetched Ethereum price: ₹${price}`);
    } catch (error) {
        console.error('Error fetching Ethereum price:', error);
    }
};

// Schedule fetching Ethereum price every 10 minutes
setInterval(fetchEthereumPrice, 10 * 60 * 1000); // 10 minutes

/**
 * Task 3: Calculate total expenses for a user and get the current price of Ethereum
 * API Route: /api/expenses/:address
 * Input: Ethereum address (passed as a URL parameter)
 * Output: Total expenses and current price of Ethereum
 */
app.get('/api/expenses/:address', async (req, res) => {
    const { address } = req.params;

    try {
        // Fetch transactions from MongoDB
        const transactionData = await Transaction.findOne({ address });

        if (!transactionData) {
            return res.status(404).json({ error: 'No transactions found for this address' });
        }

        // Calculate total expenses
        const transactions = transactionData.transactions;
        let totalExpenses = 0;

        transactions.forEach(transaction => {
            const gasUsed = transaction.gasUsed;
            const gasPrice = transaction.gasPrice;
            const expense = (gasUsed * gasPrice) / 1e18; // Expense calculation
            totalExpenses += expense;
        });

        // Get the latest Ethereum price from MongoDB
        const latestPriceData = await Price.findOne().sort({ timestamp: -1 });

        if (!latestPriceData) {
            return res.status(404).json({ error: 'Ethereum price data not found' });
        }

        const currentPrice = latestPriceData.price;

        // Return total expenses and current price of Ethereum
        res.json({
            address,
            totalExpenses: totalExpenses.toFixed(6), // Format to 6 decimal places
            currentPrice: currentPrice,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while calculating expenses' });
    }
});

// Start the Server
app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
    fetchEthereumPrice(); // Initial fetch on server start
});
