const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config/config');

// Initialize Express app
const app = express();

// Connect to MongoDB
mongoose.connect(config.db.uri, config.db.options)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

// Logging middleware in development
if (config.server.env === 'development') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/models', require('./routes/models'));
app.use('/api/data', require('./routes/data'));

// Serve static assets in production
if (config.server.env === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  // Serve the index.html file
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'dist', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app; 