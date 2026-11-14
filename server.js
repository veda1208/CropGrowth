require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const cropsAndKbRoutes = require('./routes/cropsAndKb');
const recommendationRoutes = require('./routes/recommendations');
const adminRoutes = require('./routes/admin');
const { ensureSeedData } = require('./utils/seedData');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cropgrowth';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from ./public
app.use(express.static(path.join(__dirname, 'public')));

// API Routes (Matching Problem Statement 14 Route Design)
app.use('/api/auth', authRoutes);
app.use('/api', cropsAndKbRoutes); // /api/crops and /api/kb
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/admin', adminRoutes);

// Health-check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Fallback to frontend index.html for SPA navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Connect to MongoDB and start server
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log(`✅ Connected to MongoDB at ${MONGO_URI}`);
    await ensureSeedData();
    app.listen(PORT, () => {
      console.log(`🚀 CropGrowth Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
