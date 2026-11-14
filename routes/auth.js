const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register - Register new farmer / user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, location } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must contain at least 6 characters.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: String(name).trim(),
      email: cleanEmail,
      passwordHash,
      phone: phone ? String(phone).trim() : '',
      location: location ? String(location).trim() : '',
      role: 'user',
      disabled: false
    });

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        location: user.location,
        role: user.role,
        disabled: user.disabled,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error during registration.' });
  }
});

// POST /api/auth/login - Login user or admin/agronomist
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({ error: 'Email or password is incorrect for this account type.' });
    }

    // Check role match if frontend specifies role ('user' vs 'admin')
    if (role) {
      const isUserAdmin = user.role === 'admin' || user.role === 'agronomist';
      const requestedAdmin = role === 'admin' || role === 'agronomist';
      if (isUserAdmin !== requestedAdmin) {
        return res.status(401).json({ error: 'Email or password is incorrect for this account type.' });
      }
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Email or password is incorrect for this account type.' });
    }
    if (user.disabled) {
      return res.status(403).json({ error: 'This farmer account is disabled. Please contact the administrator.' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        location: user.location,
        role: user.role === 'agronomist' ? 'admin' : user.role,
        disabled: user.disabled,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error during login.' });
  }
});

// GET /api/auth/me - Get current logged-in user
router.get('/me', authenticate, async (req, res) => {
  const user = req.user;
  res.json({
    user: {
      id: user._id,
      userId: user.userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      location: user.location,
      role: user.role === 'agronomist' ? 'admin' : user.role,
      disabled: user.disabled,
      createdAt: user.createdAt
    }
  });
});

module.exports = router;
