# TD10 Machine Learning Module

This directory contains the Python scripts that handle the machine learning aspects of TD10.

## Overview

The ML module is responsible for:

1. Training predictive models based on historical financial data
2. Generating trading signals based on trained models
3. Communicating results back to the Node.js backend

## Files

- `train_model.py`: Fetches historical data and trains an ML model
- `generate_signal.py`: Uses a trained model to generate trading signals
- `python_interface.js`: Node.js interface for spawning Python processes
- `requirements.txt`: Python dependencies

## Model Training

The training process:

1. Fetches historical price data from Financial Modeling Prep API
2. Processes the data to create features (moving averages, volatility, etc.)
3. Trains a Linear Regression model to predict the next day's price
4. Evaluates model performance (MSE, R-squared)
5. Saves the trained model and metadata as a pickle file

Example command:
```bash
python train_model.py --model_id 123 --symbol AAPL --api_key YOUR_FMP_API_KEY --window_size 14 --days 365
```

## Signal Generation

The signal generation process:

1. Loads a previously trained model
2. Fetches the latest price data for the target symbol
3. Processes the data to create the same features used in training
4. Uses the model to predict the next price
5. Generates a trading signal (BUY/SELL/NEUTRAL) based on the prediction
6. Calculates a confidence score for the signal

Example command:
```bash
python generate_signal.py --model_id 123 --symbol AAPL --api_key YOUR_FMP_API_KEY --threshold 0.01
```

## Node.js Integration

The Python scripts are designed to be called from Node.js using the `spawn` function from the `child_process` module. The scripts communicate with Node.js using JSON-formatted strings:

1. Node.js spawns a Python process with the required arguments
2. Python script performs its task and prints a JSON-formatted result to stdout
3. Node.js captures the stdout output and parses the JSON result

This architecture allows for clean separation between the Node.js backend and the Python ML functionality, while enabling efficient communication between the two.

## Dependencies

Install the required Python packages using:
```bash
pip install -r requirements.txt
```

- numpy: Numerical operations
- pandas: Data manipulation
- scikit-learn: Machine learning algorithms
- requests: HTTP requests for API calls
- matplotlib: Visualization (for future enhancements)
- joblib: Model serialization alternative 