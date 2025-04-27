const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const auth = require('../middleware/auth'); // Import auth middleware

// @route   GET api/data/price
// @desc    Get price data for a symbol (placeholder)
// @access  Private
router.get('/price', auth, async (req, res) => {
  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ msg: 'Symbol query parameter is required' });
  }

  try {
    // TODO: Implement actual FMP API call here
    // const apiKey = process.env.FMP_API_KEY;
    // const url = `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${apiKey}`;
    // const response = await axios.get(url);
    // const priceData = response.data; 

    console.log(`Fetching price for symbol: ${symbol} (placeholder)`);
    // Placeholder data
    const placeholderData = [
      { timestamp: Date.now() - 100000, price: Math.random() * 100 + 100 },
      { timestamp: Date.now(), price: Math.random() * 100 + 105 }
    ];

    res.json(placeholderData); 

  } catch (err) {
    console.error(`Error fetching price data for ${symbol}:`, err.message);
    // Handle FMP API errors specifically if possible
    // if (err.response) { 
    //   res.status(err.response.status).json({ msg: `FMP API Error: ${err.response.data}`});
    // } else {
         res.status(500).send('Server Error');
    // }
  }
});

// Placeholder for Signal Generation Route (to be implemented later)
// @route   GET api/data/signal?modelId=...&symbol=...
// @desc    Generate trading signal based on model and current data
// @access  Private 
// Note: This might live under /api/models/:id/signal instead as per design doc
router.get('/signal', auth, async (req, res) => {
    const { modelId, symbol } = req.query;

    if (!modelId || !symbol) {
        return res.status(400).json({ msg: 'modelId and symbol query parameters are required' });
    }

    try {
        // TODO:
        // 1. Fetch model details (maybe not needed if script handles it)
        // 2. Fetch latest price data for symbol (or maybe it's passed in?)
        // 3. Spawn Python predict_signal.py script with modelId/symbol/data
        // 4. Parse script output (e.g., BUY/SELL/HOLD, confidence)

        console.log(`Generating signal for model: ${modelId}, symbol: ${symbol} (placeholder)`);
        
        // Placeholder response
        const signals = ['BUY', 'SELL', 'NEUTRAL'];
        const randomSignal = signals[Math.floor(Math.random() * signals.length)];
        res.json({ 
            modelId,
            symbol,
            timestamp: Date.now(),
            signal: randomSignal,
            confidence: Math.random().toFixed(2)
        });

    } catch (err) {
        console.error(`Error generating signal for model ${modelId}, symbol ${symbol}:`, err.message);
        res.status(500).send('Server Error');
    }
});

// TODO: Add route for historical data fetching later (/api/data/historical/:symbol)

module.exports = router; 