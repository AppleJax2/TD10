require('dotenv').config();

module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || 'development',
  },
  
  // Database configuration
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/td10',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  
  // JWT authentication
  jwt: {
    secret: process.env.JWT_SECRET || 'development_secret_key',
    expiresIn: '7d'
  },
  
  // Financial Modeling Prep API
  fmp: {
    apiKey: process.env.FMP_API_KEY,
    baseUrl: 'https://financialmodelingprep.com/api/v3'
  },
  
  // Python integration settings
  python: {
    pythonPath: process.env.PYTHON_PATH || 'python', // Path to Python executable
    scriptDir: process.env.PYTHON_SCRIPT_DIR || './ml',
    timeout: {
      train: 5 * 60 * 1000, // 5 minutes for training
      signal: 30 * 1000     // 30 seconds for signal generation
    }
  },
  
  // Model settings
  models: {
    artifactsDir: process.env.MODEL_ARTIFACTS_DIR || './models/artifacts'
  }
}; 