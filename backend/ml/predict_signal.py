import sys
import json
import pandas as pd
from datetime import datetime

def calculate_moving_average(data, window):
    """Calculates the moving average for a given window."""
    if len(data) < window:
        return None
    return sum(data[-window:]) / window

def generate_signal(short_ma, long_ma, previous_short_ma, previous_long_ma):
    """Generates buy/sell/neutral signal based on MA crossover."""
    if short_ma is None or long_ma is None or previous_short_ma is None or previous_long_ma is None:
        return "neutral" # Not enough data or MAs couldn't be calculated

    # Bullish Crossover: Short MA crosses above Long MA
    if previous_short_ma <= previous_long_ma and short_ma > long_ma:
        return "buy"
    # Bearish Crossover: Short MA crosses below Long MA
    elif previous_short_ma >= previous_long_ma and short_ma < long_ma:
        return "sell"
    else:
        return "neutral"

def main():
    try:
        input_data = json.load(sys.stdin)

        model_artifacts = input_data.get("model", {}).get("artifacts", {})
        price_data_list = input_data.get("data", [])

        if not model_artifacts or not price_data_list:
            raise ValueError("Missing model artifacts or price data in input")

        short_window = model_artifacts.get("short_window")
        long_window = model_artifacts.get("long_window")

        if not isinstance(short_window, int) or not isinstance(long_window, int) or short_window <= 0 or long_window <= 0 or short_window >= long_window:
             raise ValueError(f"Invalid MA window sizes: short={short_window}, long={long_window}")

        if len(price_data_list) < long_window + 1:
             raise ValueError(f"Insufficient price data. Need at least {long_window + 1} points, got {len(price_data_list)}")

        # Assuming price_data_list is sorted chronologically, newest last
        # Extract closing prices
        closing_prices = [item['close'] for item in price_data_list]

        # --- Calculate MAs for the latest point ---
        latest_short_ma = calculate_moving_average(closing_prices, short_window)
        latest_long_ma = calculate_moving_average(closing_prices, long_window)

        # --- Calculate MAs for the previous point (needed for crossover detection) ---
        previous_prices = closing_prices[:-1]
        previous_short_ma = calculate_moving_average(previous_prices, short_window)
        previous_long_ma = calculate_moving_average(previous_prices, long_window)


        # --- Generate Signal ---
        signal_direction = generate_signal(latest_short_ma, latest_long_ma, previous_short_ma, previous_long_ma)

        # --- Prepare Output ---
        latest_timestamp = price_data_list[-1].get("date", datetime.utcnow().isoformat()) # Use provided date or current time
        latest_price = closing_prices[-1]

        # Simple confidence placeholder - could be refined later
        confidence = 0.8 if signal_direction != "neutral" else 0.5

        result = {
            "timestamp": latest_timestamp,
            "value": latest_price, # Using latest price as the 'value' for context
            "direction": signal_direction,
            "confidence": confidence,
            "debug_info": { # Optional: for easier debugging in Node.js
                "short_ma": latest_short_ma,
                "long_ma": latest_long_ma,
                "prev_short_ma": previous_short_ma,
                "prev_long_ma": previous_long_ma
            }
        }

        print(json.dumps(result))

    except Exception as e:
        # Log error to stderr for Node.js to potentially capture
        print(f"Error in predict_signal.py: {e}", file=sys.stderr)
        # Output a neutral signal with error info in case of failure
        error_result = {
            "timestamp": datetime.utcnow().isoformat(),
            "value": None,
            "direction": "neutral",
            "confidence": 0.0,
            "error": str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1) # Indicate failure


if __name__ == "__main__":
    main() 