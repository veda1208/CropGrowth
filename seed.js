require('dotenv').config();
const mongoose = require('mongoose');
const { ensureSeedData } = require('./utils/seedData');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cropgrowth';

async function runSeed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for seeding...');
    await ensureSeedData();
    console.log('🌱 Database seed complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

runSeed();
