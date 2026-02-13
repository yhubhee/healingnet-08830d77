const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { query, queryOne } = require('../config/database');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { first_name, last_name, email, password, phone } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const existing = await queryOne('SELECT id FROM patients WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const result = await query(
      'INSERT INTO patients (first_name, last_name, email, password_hash, phone) VALUES (?, ?, ?, ?, ?)',
      [first_name, last_name, email, password_hash, phone || null]
    );

    req.session.patient_id = result.insertId;
    req.session.firstname = first_name;

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      patient: { id: result.insertId, first_name, last_name, email },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const patient = await queryOne('SELECT * FROM patients WHERE email = ?', [email]);
    if (!patient) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const valid = await bcrypt.compare(password, patient.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    req.session.patient_id = patient.id;
    req.session.firstname = patient.first_name;

    res.json({
      success: true,
      message: 'Login successful.',
      patient: {
        id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        email: patient.email,
        profile_image: patient.profile_image,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed.' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out.' });
  });
});

// GET /api/auth/me - Current session
router.get('/me', (req, res) => {
  if (!req.session || !req.session.patient_id) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }
  res.json({
    success: true,
    patient_id: req.session.patient_id,
    firstname: req.session.firstname,
  });
});

module.exports = router;
