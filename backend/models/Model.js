const mongoose = require('mongoose');

const ModelSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Please provide a model name'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    type: {
        type: String, // e.g., 'moving_average', 'linear_regression'
        required: [true, 'Please specify a model type'],
    },
    parameters: {
        type: Object, // Store model-specific parameters (e.g., { window: 5 } for MA)
        default: {},
    },
    features: {
        type: [String], // Input features used (e.g., ['close', 'volume'])
        default: [],
    },
    target: {
        type: String, // Target variable (e.g., 'next_day_close')
    },
    status: {
        type: String,
        enum: ['new', 'training', 'trained', 'error'],
        default: 'new'
    },
    artifacts: {
        // Could store path to pickled model, performance metrics, etc.
        type: Object,
        default: {},
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastTrained: {
        type: Date
    }
});

module.exports = mongoose.model('Model', ModelSchema); 