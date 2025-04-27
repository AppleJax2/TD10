const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config/config');

/**
 * Base class for Python process execution
 */
class PythonExecutor {
  constructor() {
    this.pythonPath = config.python.pythonPath || 'python';
    this.scriptDir = path.join(__dirname);
    this.modelDir = path.join(__dirname, '..', 'models', 'artifacts');
  }

  /**
   * Execute a Python script with given arguments
   * @param {string} scriptName - Name of the Python script to execute
   * @param {Array} args - Command line arguments to pass to the script
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} - JSON result from the Python script
   */
  async executeScript(scriptName, args = [], timeout = 300000) {
    const scriptPath = path.join(this.scriptDir, scriptName);
    
    // Check if script exists
    try {
      await fs.access(scriptPath);
    } catch (error) {
      throw new Error(`Python script not found: ${scriptPath}`);
    }
    
    return new Promise((resolve, reject) => {
      const process = spawn(this.pythonPath, [scriptPath, ...args]);
      
      let stdout = '';
      let stderr = '';
      let timeoutId = null;
      
      // Set timeout if specified
      if (timeout) {
        timeoutId = setTimeout(() => {
          process.kill();
          reject(new Error(`Execution timed out after ${timeout}ms`));
        }, timeout);
      }
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);
        
        if (code !== 0) {
          return reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        }
        
        try {
          // Try to parse JSON from stdout
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          if (stdout.trim()) {
            resolve({ output: stdout.trim() });
          } else {
            reject(new Error(`Failed to parse JSON output: ${error.message}`));
          }
        }
      });
      
      process.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }
  
  /**
   * Ensure model directory exists
   * @returns {Promise<void>}
   */
  async ensureModelDir() {
    try {
      await fs.mkdir(this.modelDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}

/**
 * Class for training ML models
 */
class ModelTrainer extends PythonExecutor {
  /**
   * Train a model with given parameters
   * @param {string} modelId - Unique identifier for the model
   * @param {string} symbol - Stock symbol to train on
   * @param {Object} params - Additional training parameters
   * @returns {Promise<Object>} - Training result
   */
  async trainModel(modelId, symbol, params = {}) {
    await this.ensureModelDir();
    
    const args = [
      '--model_id', modelId,
      '--symbol', symbol,
      '--api_key', config.fmp.apiKey,
      '--output_dir', this.modelDir
    ];
    
    // Add optional parameters
    if (params.windowSize) args.push('--window_size', params.windowSize);
    if (params.days) args.push('--days', params.days);
    
    return this.executeScript('train_model.py', args);
  }
}

/**
 * Class for generating trading signals
 */
class SignalGenerator extends PythonExecutor {
  /**
   * Generate trading signals using a trained model
   * @param {string} modelId - ID of the trained model to use
   * @param {string} symbol - Stock symbol to generate signals for
   * @param {Object} params - Additional signal generation parameters
   * @returns {Promise<Object>} - Signal generation result
   */
  async generateSignal(modelId, symbol, params = {}) {
    const args = [
      '--model_id', modelId,
      '--symbol', symbol,
      '--api_key', config.fmp.apiKey,
      '--model_dir', this.modelDir
    ];
    
    // Add optional parameters
    if (params.windowSize) args.push('--window_size', params.windowSize);
    if (params.threshold) args.push('--threshold', params.threshold);
    
    return this.executeScript('generate_signal.py', args);
  }
}

module.exports = {
  ModelTrainer,
  SignalGenerator
}; 