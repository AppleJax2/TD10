#!/usr/bin/env python3
import os
import sys
import json
import argparse
import pickle
import numpy as np
import pandas as pd
import requests
from datetime import datetime, timedelta
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Generate trading signals using a trained model')
    parser.add_argument('--model_id', required=True, help='ID of the trained model to use')
    parser.add_argument('--symbol', required=True, help='Stock symbol to generate signals for')
    parser.add_argument('--api_key', required=True, help='FMP API key')
    parser.add_argument('--window_size', type=int, default=14, help='Window size for feature generation')
    parser.add_argument('--model_dir', default='../models/artifacts', help='Directory with model artifacts')
    parser.add_argument('--threshold', type=float, default=0.01, help='Signal threshold (percentage change)')
    
    return parser.parse_args()

def load_model(model_id, model_dir):
    """Load a trained model from a pickle file."""
    logger.info(f"Loading model {model_id} from {model_dir}")
    
    model_file = os.path.join(model_dir, f"model_{model_id}.pkl")
    
    if not os.path.exists(model_file):
        logger.error(f"Model file not found: {model_file}")
        return None
    
    try:
        with open(model_file, 'rb') as f:
            model_data = pickle.load(f)
        
        logger.info(f"Model loaded successfully: {model_id}")
        return model_data
    
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        return None

def fetch_recent_data(symbol, api_key, days=30):
    """Fetch recent price data from Financial Modeling Prep API."""
    logger.info(f"Fetching recent data for {symbol} for the past {days} days")
    
    url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{symbol}?apikey={api_key}&serietype=line"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        data = response.json()
        
        if "historical" not in data:
            logger.error(f"No historical data found for {symbol}")
            return None
            
        # Convert to DataFrame
        df = pd.DataFrame(data["historical"])
        
        # Ensure data is sorted by date (oldest to newest)
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date')
        
        # Keep only the last 'days' days of data
        if len(df) > days:
            df = df.tail(days)
            
        return df
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching data: {e}")
        return None

def prepare_features(df, window_size=14):
    """Prepare features for signal generation."""
    logger.info(f"Preparing features with window size {window_size}")
    
    # Make a copy to avoid modifying the original
    data = df.copy()
    
    # Basic features (same as in training)
    data['return'] = data['close'].pct_change()
    data['log_return'] = np.log(data['close'] / data['close'].shift(1))
    
    # Moving averages
    data['ma5'] = data['close'].rolling(window=5).mean()
    data['ma10'] = data['close'].rolling(window=10).mean()
    data['ma20'] = data['close'].rolling(window=20).mean()
    
    # Price difference from moving averages
    data['close_ma5_diff'] = data['close'] - data['ma5']
    data['close_ma10_diff'] = data['close'] - data['ma10']
    data['close_ma20_diff'] = data['close'] - data['ma20']
    
    # Volatility (standard deviation of returns)
    data['volatility'] = data['return'].rolling(window=window_size).std()
    
    # Drop rows with NaN values
    data = data.dropna()
    
    return data

def generate_signal(model_data, data, threshold=0.01):
    """Generate trading signals based on model predictions."""
    logger.info("Generating trading signals")
    
    # Extract model and feature columns from model_data
    model = model_data['model']
    feature_columns = model_data['feature_columns']
    
    # Last row of data will be used for prediction
    latest_data = data.iloc[-1]
    features = latest_data[feature_columns].values.reshape(1, -1)
    
    # Get the current price
    current_price = latest_data['close']
    
    # Make prediction for next day's price
    predicted_price = model.predict(features)[0]
    
    # Calculate predicted percent change
    percent_change = (predicted_price - current_price) / current_price
    
    # Determine signal direction based on threshold
    if percent_change > threshold:
        direction = 'BUY'
        confidence = min(percent_change / (threshold * 2), 1.0)
    elif percent_change < -threshold:
        direction = 'SELL'
        confidence = min(abs(percent_change) / (threshold * 2), 1.0)
    else:
        direction = 'NEUTRAL'
        confidence = 1.0 - (abs(percent_change) / threshold)
    
    # Create signal object
    signal = {
        'timestamp': datetime.now().isoformat(),
        'symbol': data['symbol'].iloc[0] if 'symbol' in data.columns else None,
        'current_price': float(current_price),
        'predicted_price': float(predicted_price),
        'percent_change': float(percent_change),
        'direction': direction,
        'confidence': float(confidence),
        'threshold_used': threshold
    }
    
    logger.info(f"Signal generated: {direction} with {confidence:.2f} confidence")
    
    return signal

def main():
    """Main function to generate trading signals."""
    try:
        # Parse command line arguments
        args = parse_args()
        
        # Load the trained model
        model_data = load_model(args.model_id, args.model_dir)
        if model_data is None:
            logger.error("Failed to load model. Exiting.")
            sys.exit(1)
        
        # Fetch recent data
        df = fetch_recent_data(args.symbol, args.api_key)
        if df is None:
            logger.error("Failed to fetch recent data. Exiting.")
            sys.exit(1)
        
        # Add symbol column if not present
        if 'symbol' not in df.columns:
            df['symbol'] = args.symbol
        
        logger.info(f"Successfully fetched {len(df)} days of recent data for {args.symbol}")
        
        # Prepare features
        data = prepare_features(df, args.window_size)
        if len(data) == 0:
            logger.error("No valid data points after feature preparation. Exiting.")
            sys.exit(1)
            
        logger.info(f"Prepared features with {len(data)} valid data points")
        
        # Generate signal
        signal = generate_signal(model_data, data, args.threshold)
        
        # Output signal as JSON
        result = {
            'status': 'success',
            'model_id': args.model_id,
            'signal': signal
        }
        
        print(json.dumps(result))
        logger.info(f"Signal generation completed successfully for {args.symbol}")
        
    except Exception as e:
        # Handle unexpected errors
        error_msg = {
            'status': 'error',
            'error': str(e)
        }
        print(json.dumps(error_msg))
        logger.error(f"Error during signal generation: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 