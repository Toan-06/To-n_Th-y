const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/error.middleware');

// Load env vars from root directory
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// Route files
const auth = require('./routes/auth.routes');
const services = require('./routes/service.routes');
const bookings = require('./routes/booking.routes');
const reviews = require('./routes/review.routes');
const messages = require('./routes/message.routes');
const preferences = require('./routes/preference.routes');

// Mount routers
app.use('/api/auth', auth);
app.use('/api/services', services);
app.use('/api/bookings', bookings);
app.use('/api/reviews', reviews);
app.use('/api/messages', messages);
app.use('/api/preferences', preferences);

// Root endpoint
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Error Middleware (must be after routers)
app.use(errorHandler);

const PORT = process.env.API_PORT || 5000;

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
