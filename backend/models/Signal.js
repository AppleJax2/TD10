const mongoose = require('mongoose');

const SignalSchema = new mongoose.Schema({
    modelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Model',
        required: true
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    timestamp: {
        type: Date,
        required: true,
        index: true // Index for faster time-based queries
    },
    value: {
        type: Number // Could represent predicted price, signal strength, etc.
    },
    direction: {
        type: String,
        enum: ['BUY', 'SELL', 'NEUTRAL'],
        required: true
    },
    confidence: {
        type: Number, // Confidence score (e.g., 0-1)
        min: 0,
        max: 1
    }
    // Add other relevant fields if needed
});

module.exports = mongoose.model('Signal', SignalSchema); 