const mongoose = require('mongoose');

const ModelSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    type: {
        type: String,
        required: true,
        enum: ['regression', 'classification']
    },
    symbol: {
        type: String,
        required: true
    },
    parameters: {
        type: Object,
        default: {}
    },
    features: {
        type: [String],
        default: []
    },
    target: {
        type: String
    },
    status: {
        type: String,
        enum: ['new', 'training', 'trained', 'error'],
        default: 'new'
    },
    error: {
        type: String
    },
    artifacts: {
        file: String,
        createdAt: Date
    },
    metrics: {
        type: Object,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastTrained: {
        type: Date
    }
});

module.exports = mongoose.model('model', ModelSchema); 