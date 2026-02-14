require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// Middleware
// ==========================================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'healingnet-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// ==========================================
// API Routes
// ==========================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/triage', require('./routes/triage'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/notifications', require('./routes/notifications'));

// Hospital routes
app.use('/api/hospital/auth', require('./routes/hospital/auth'));
app.use('/api/hospital/doctors', require('./routes/hospital/doctors'));
app.use('/api/hospital/marketplace', require('./routes/hospital/marketplace'));
app.use('/api/hospital/queue', require('./routes/hospital/queue'));
app.use('/api/hospital/emr', require('./routes/hospital/emr'));
app.use('/api/hospital/billing', require('./routes/hospital/billing'));
app.use('/api/hospital/analytics', require('./routes/hospital/analytics'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==========================================
// Start Server
// ==========================================
app.listen(PORT, () => {
  console.log(`HealingNet server running on port ${PORT}`);
});

module.exports = app;
