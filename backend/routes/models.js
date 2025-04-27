const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const auth = require('../middleware/auth'); // Import auth middleware
const Model = require('../models/Model');

// @route   GET /api/models
// @desc    Get all models for the logged-in user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const models = await Model.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(models);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/models
// @desc    Create a new model
// @access  Private
router.post('/', auth, async (req, res) => {
    const { name, description, type, parameters, features, target } = req.body;

    // Basic validation
    if (!name || !type) {
        return res.status(400).json({ msg: 'Please provide model name and type' });
    }

    try {
        const newModel = new Model({
            userId: req.user.id, // Associate model with logged-in user
            name,
            description,
            type,
            parameters,
            features,
            target,
            status: 'new', // Initial status
        });

        const model = await newModel.save();
        res.json(model);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/models/:id
// @desc    Get a specific model by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        const model = await Model.findOne({ _id: req.params.id, userId: req.user.id });
        if (!model) {
            return res.status(404).json({ msg: 'Model not found' });
        }
        res.json(model);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Model not found' });
        }
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/models/:id
// @desc    Delete a model
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const model = await Model.findOne({ _id: req.params.id, userId: req.user.id });

        if (!model) {
            return res.status(404).json({ msg: 'Model not found' });
        }

        // Check user authorization
        if (model.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        await model.deleteOne(); // Use deleteOne() on the document

        res.json({ msg: 'Model removed' });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Model not found' });
        }
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/models/:id/train
// @desc    Train a specific model
// @access  Private
router.post('/:id/train', auth, async (req, res) => {
    // TODO: Implement model training logic
    // 1. Find model by ID and ensure it belongs to the user
    // 2. Update model status to 'training'
    // 3. Spawn Python child process (later)
    // 4. Handle process output/errors (later)
    // 5. Update model status to 'trained' or 'error' (later)
    console.log(`Training requested for model ID: ${req.params.id} by user: ${req.user.id}`);
    // For now, just confirm the route is hit
    try {
        const model = await Model.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { status: 'training' }, // Temporarily set to training
            { new: true }
        );
        if (!model) {
            return res.status(404).json({ msg: 'Model not found or user not authorized' });
        }
        // In a real scenario, we'd start the async training here.
        // For now, simulate completion immediately for testing.
        setTimeout(async () => {
            try {
                await Model.findByIdAndUpdate(req.params.id, { status: 'trained', lastTrained: new Date() });
                console.log(`Simulated training complete for model ${req.params.id}`);
            } catch (err) {
                console.error(`Error updating model status after simulated training for ${req.params.id}:`, err);
                // Optionally set status back to 'error' or 'new'
                await Model.findByIdAndUpdate(req.params.id, { status: 'error' });
            }
        }, 3000); // Simulate 3 second training

        res.json({ msg: 'Model training started (simulated)', model });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Model not found' });
        }
        res.status(500).send('Server Error');
    }
});

module.exports = router; 