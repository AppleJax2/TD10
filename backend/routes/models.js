const express = require('express');
const router = express.Router();
const { ModelTrainer, SignalGenerator } = require('../ml/python_interface');
const Model = require('../models/Model');
const Signal = require('../models/Signal');
const auth = require('../middleware/auth');

// Initialize model trainer and signal generator
const modelTrainer = new ModelTrainer();
const signalGenerator = new SignalGenerator();

/**
 * @route   GET /api/models
 * @desc    Get all models for the authenticated user
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const models = await Model.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(models);
  } catch (err) {
    console.error('Error fetching models:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/models/:id
 * @desc    Get a specific model by ID
 * @access  Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const model = await Model.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!model) {
      return res.status(404).json({ message: 'Model not found' });
    }
    
    res.json(model);
  } catch (err) {
    console.error('Error fetching model:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/models
 * @desc    Create a new model
 * @access  Private
 */
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, type, parameters, features, target, symbol } = req.body;
    
    // Create a new model
    const newModel = new Model({
      userId: req.user.id,
      name,
      description,
      type,
      parameters,
      features,
      target,
      symbol,
      createdAt: Date.now()
    });
    
    // Save the model to the database
    const savedModel = await newModel.save();
    
    res.status(201).json(savedModel);
  } catch (err) {
    console.error('Error creating model:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/models/:id
 * @desc    Update a model
 * @access  Private
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, type, parameters, features, target, symbol } = req.body;
    
    // Find the model to update
    let model = await Model.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!model) {
      return res.status(404).json({ message: 'Model not found' });
    }
    
    // Update model fields
    if (name) model.name = name;
    if (description) model.description = description;
    if (type) model.type = type;
    if (parameters) model.parameters = parameters;
    if (features) model.features = features;
    if (target) model.target = target;
    if (symbol) model.symbol = symbol;
    
    // Save the updated model
    const updatedModel = await model.save();
    
    res.json(updatedModel);
  } catch (err) {
    console.error('Error updating model:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/models/:id
 * @desc    Delete a model
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    // Find the model to delete
    const model = await Model.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!model) {
      return res.status(404).json({ message: 'Model not found' });
    }
    
    // Delete the model
    await model.remove();
    
    res.json({ message: 'Model deleted' });
  } catch (err) {
    console.error('Error deleting model:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/models/:id/train
 * @desc    Train a model
 * @access  Private
 */
router.post('/:id/train', auth, async (req, res) => {
  try {
    // Find the model to train
    const model = await Model.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!model) {
      return res.status(404).json({ message: 'Model not found' });
    }
    
    // Extract parameters for training
    const { windowSize, days } = req.body;
    const params = {
      windowSize: windowSize || model.parameters.windowSize || 14,
      days: days || 365
    };
    
    // Start training
    res.status(202).json({
      message: 'Model training started',
      modelId: model._id,
      status: 'training'
    });
    
    // Update model status
    model.status = 'training';
    await model.save();
    
    try {
      // Train the model
      const result = await modelTrainer.trainModel(
        model._id.toString(),
        model.symbol,
        params
      );
      
      if (result.status === 'success') {
        // Update model with artifacts and metrics
        model.artifacts = {
          file: result.model_file,
          createdAt: new Date()
        };
        model.metrics = result.metrics;
        model.status = 'trained';
        model.lastTrained = new Date();
        
        await model.save();
      } else {
        // Handle training failure
        model.status = 'error';
        model.error = result.error || 'Unknown training error';
        await model.save();
      }
    } catch (error) {
      // Handle exceptions during training
      console.error('Error training model:', error.message);
      model.status = 'error';
      model.error = error.message;
      await model.save();
    }
  } catch (err) {
    console.error('Error initiating model training:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/models/:id/status
 * @desc    Get training status of a model
 * @access  Private
 */
router.get('/:id/status', auth, async (req, res) => {
  try {
    const model = await Model.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!model) {
      return res.status(404).json({ message: 'Model not found' });
    }
    
    res.json({
      status: model.status,
      lastTrained: model.lastTrained,
      error: model.error,
      metrics: model.metrics
    });
  } catch (err) {
    console.error('Error fetching model status:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/models/:id/signal
 * @desc    Generate a trading signal using a trained model
 * @access  Private
 */
router.post('/:id/signal', auth, async (req, res) => {
  try {
    // Find the model
    const model = await Model.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!model) {
      return res.status(404).json({ message: 'Model not found' });
    }
    
    // Check if model is trained
    if (model.status !== 'trained') {
      return res.status(400).json({ message: 'Model is not trained yet' });
    }
    
    // Extract parameters for signal generation
    const { threshold } = req.body;
    const params = {
      windowSize: model.parameters.windowSize || 14,
      threshold: threshold || 0.01
    };
    
    // Generate signal
    const result = await signalGenerator.generateSignal(
      model._id.toString(),
      model.symbol,
      params
    );
    
    if (result.status === 'success') {
      // Save the signal to the database
      const signalData = result.signal;
      
      const newSignal = new Signal({
        modelId: model._id,
        symbol: signalData.symbol || model.symbol,
        timestamp: new Date(signalData.timestamp),
        value: signalData.percent_change,
        direction: signalData.direction,
        confidence: signalData.confidence,
        currentPrice: signalData.current_price,
        predictedPrice: signalData.predicted_price
      });
      
      await newSignal.save();
      
      res.json({
        modelId: model._id,
        signal: newSignal
      });
    } else {
      res.status(500).json({ message: result.error || 'Error generating signal' });
    }
  } catch (err) {
    console.error('Error generating signal:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/models/:id/signals
 * @desc    Get all signals for a specific model
 * @access  Private
 */
router.get('/:id/signals', auth, async (req, res) => {
  try {
    // Find the model
    const model = await Model.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!model) {
      return res.status(404).json({ message: 'Model not found' });
    }
    
    // Get signals
    const signals = await Signal.find({ modelId: model._id })
      .sort({ timestamp: -1 })
      .limit(100);
    
    res.json(signals);
  } catch (err) {
    console.error('Error fetching signals:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 