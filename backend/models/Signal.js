const mongoose = require('mongoose');

const SignalSchema = new mongoose.Schema({
    modelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'model',
        required: true
    },
    symbol: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    value: {
        type: Number,
        required: true
    },
    direction: {
        type: String,
        enum: ['BUY', 'SELL', 'NEUTRAL'],
        required: true
    },
    confidence: {
        type: Number,
        min: 0,
        max: 1,
        required: true
    },
    currentPrice: {
        type: Number,
        required: true
    },
    predictedPrice: {
        type: Number,
        required: true
    }
});

module.exports = mongoose.model('signal', SignalSchema); 