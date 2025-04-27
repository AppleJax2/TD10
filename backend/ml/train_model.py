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
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Train a trading model')
    parser.add_argument('--model_id', required=True, help='Unique ID for the model')
    parser.add_argument('--symbol', required=True, help='Stock symbol to train on')
    parser.add_argument('--window_size', type=int, default=14, help='Window size for feature generation')
    parser.add_argument('--api_key', required=True, help='FMP API key')
    parser.add_argument('--days', type=int, default=365, help='Number of days of historical data')
    parser.add_argument('--output_dir', default='../models/artifacts', help='Directory to save model artifacts')
    
    return parser.parse_args()

def fetch_historical_data(symbol, api_key, days=365):
    """Fetch historical price data from Financial Modeling Prep API."""
    logger.info(f"Fetching historical data for {symbol} for the past {days} days")
    
    url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{symbol}?apikey={api_key}&serietype=line"
    
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an exception for HTTP errors
        
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
    """Prepare features for the model."""
    logger.info(f"Preparing features with window size {window_size}")
    
    # Make a copy to avoid modifying the original
    data = df.copy()
    
    # Basic features
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
    
    # Target: Next day's closing price
    data['target'] = data['close'].shift(-1)
    
    # Drop rows with NaN values
    data = data.dropna()
    
    return data

def train_model(data, window_size=14):
    """Train a linear regression model to predict next day's closing price."""
    logger.info("Training the model")
    
    # Features: previous window_size days of price data and derived features
    feature_columns = ['close', 'return', 'log_return', 
                      'ma5', 'ma10', 'ma20', 
                      'close_ma5_diff', 'close_ma10_diff', 'close_ma20_diff',
                      'volatility']
    
    X = data[feature_columns].values
    y = data['target'].values
    
    # Split data into training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)
    
    # Create and train the model
    model = LinearRegression()
    model.fit(X_train, y_train)
    
    # Evaluate the model
    y_pred = model.predict(X_test)
    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    logger.info(f"Model evaluation - MSE: {mse:.4f}, R²: {r2:.4f}")
    
    return model, mse, r2, feature_columns

def save_model(model, model_id, feature_columns, metrics, output_dir):
    """Save the trained model and metadata to a file."""
    logger.info(f"Saving model {model_id} to {output_dir}")
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Define the model file path
    model_file = os.path.join(output_dir, f"model_{model_id}.pkl")
    
    # Create a dictionary with the model and metadata
    model_data = {
        'model': model,
        'feature_columns': feature_columns,
        'metrics': metrics,
        'created_at': datetime.now().isoformat()
    }
    
    # Save the model to a pickle file
    with open(model_file, 'wb') as f:
        pickle.dump(model_data, f)
    
    return model_file

def main():
    """Main function to train and save the model."""
    try:
        # Parse command line arguments
        args = parse_args()
        
        # Fetch historical data
        df = fetch_historical_data(args.symbol, args.api_key, args.days)
        if df is None:
            logger.error("Failed to fetch historical data. Exiting.")
            sys.exit(1)
        
        logger.info(f"Successfully fetched {len(df)} days of historical data for {args.symbol}")
        
        # Prepare features
        data = prepare_features(df, args.window_size)
        logger.info(f"Prepared features with {len(data)} valid data points")
        
        # Train the model
        model, mse, r2, feature_columns = train_model(data, args.window_size)
        
        # Prepare metrics
        metrics = {
            'mse': float(mse),  # Convert numpy float to Python float for JSON serialization
            'r2': float(r2),
            'training_data_points': len(data)
        }
        
        # Save the model
        model_file = save_model(model, args.model_id, feature_columns, metrics, args.output_dir)
        
        # Output success message and metrics as JSON
        result = {
            'status': 'success',
            'model_id': args.model_id,
            'symbol': args.symbol,
            'model_file': model_file,
            'metrics': metrics
        }
        
        print(json.dumps(result))
        logger.info(f"Model training completed successfully for {args.symbol}")
        
    except Exception as e:
        # Handle unexpected errors
        error_msg = {
            'status': 'error',
            'error': str(e)
        }
        print(json.dumps(error_msg))
        logger.error(f"Error during model training: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 