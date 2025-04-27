const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const auth = require('../middleware/auth'); // Import auth middleware
const axios = require('axios');
const config = require('../config/config');

// Cache for financial data
const cache = {
  historical: {},   // Format: { symbol: { data, timestamp } }
  realtime: {}      // Format: { symbol: { data, timestamp } }
};

// Cache expiration time (in milliseconds)
const CACHE_EXPIRY = {
  historical: 24 * 60 * 60 * 1000,  // 24 hours for historical data
  realtime: 60 * 1000               // 1 minute for real-time data
};

/**
 * Check if cached data is valid
 * @param {Object} cachedData - The cached data object
 * @param {number} expiryTime - Cache expiry time in milliseconds
 * @returns {boolean} - Whether the cache is valid
 */
function isCacheValid(cachedData, expiryTime) {
  if (!cachedData || !cachedData.timestamp) return false;
  const now = Date.now();
  return (now - cachedData.timestamp) < expiryTime;
}

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

/**
 * @route   GET /api/data/historical/:symbol
 * @desc    Get historical data for a symbol
 * @access  Private
 */
router.get('/historical/:symbol', auth, async (req, res) => {
  const { symbol } = req.params;
  const { days = 365 } = req.query;
  
  try {
    // Check cache first
    if (cache.historical[symbol] && isCacheValid(cache.historical[symbol], CACHE_EXPIRY.historical)) {
      return res.json(cache.historical[symbol].data);
    }
    
    // Fetch data from Financial Modeling Prep API
    const response = await axios.get(
      `${config.fmp.baseUrl}/historical-price-full/${symbol}`,
      {
        params: {
          apikey: config.fmp.apiKey,
          serietype: 'line',
          from: (() => {
            const date = new Date();
            date.setDate(date.getDate() - parseInt(days));
            return date.toISOString().split('T')[0];
          })()
        }
      }
    );
    
    // Update cache
    cache.historical[symbol] = {
      data: response.data,
      timestamp: Date.now()
    };
    
    res.json(response.data);
  } catch (err) {
    console.error(`Error fetching historical data for ${symbol}:`, err.message);
    res.status(500).json({ message: 'Error fetching historical data' });
  }
});

/**
 * @route   GET /api/data/realtime/:symbol
 * @desc    Get real-time data for a symbol
 * @access  Private
 */
router.get('/realtime/:symbol', auth, async (req, res) => {
  const { symbol } = req.params;
  
  try {
    // Check cache first
    if (cache.realtime[symbol] && isCacheValid(cache.realtime[symbol], CACHE_EXPIRY.realtime)) {
      return res.json(cache.realtime[symbol].data);
    }
    
    // Fetch data from Financial Modeling Prep API
    const response = await axios.get(
      `${config.fmp.baseUrl}/quote/${symbol}`,
      {
        params: {
          apikey: config.fmp.apiKey
        }
      }
    );
    
    // Update cache
    cache.realtime[symbol] = {
      data: response.data,
      timestamp: Date.now()
    };
    
    res.json(response.data);
  } catch (err) {
    console.error(`Error fetching real-time data for ${symbol}:`, err.message);
    res.status(500).json({ message: 'Error fetching real-time data' });
  }
});

/**
 * @route   GET /api/data/search
 * @desc    Search for symbols
 * @access  Private
 */
router.get('/search', auth, async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ message: 'Query parameter is required' });
  }
  
  try {
    const response = await axios.get(
      `${config.fmp.baseUrl}/search`,
      {
        params: {
          query,
          limit: 10,
          apikey: config.fmp.apiKey
        }
      }
    );
    
    res.json(response.data);
  } catch (err) {
    console.error(`Error searching for symbols with query "${query}":`, err.message);
    res.status(500).json({ message: 'Error searching for symbols' });
  }
});

module.exports = router; 