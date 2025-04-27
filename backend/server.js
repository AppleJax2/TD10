require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Connect to Database
connectDB();

const app = express();

// Init Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json({ extended: false })); // Allow parsing of JSON request bodies

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/models', require('./routes/models'));
app.use('/api/data', require('./routes/data'));

// Basic route for testing
app.get('/', (req, res) => res.send('TD10 API Running'));

const PORT = process.env.PORT || 5001; // Use Render's port or default to 5001

app.listen(PORT, () => console.log(`Server started on port ${PORT}`)); 