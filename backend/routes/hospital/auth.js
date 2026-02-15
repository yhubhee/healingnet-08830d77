const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { verify, decode } = require('jsonwebtoken');
const { query, queryOne } = require('../../config/database');
const { createHospitalToken, requireHospitalAuth } = require('../../middleware/hospitalAuth');

// POST /api/hospital/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required.' });
    }

    const staff = await queryOne(
      `SELECT s.*, h.name AS hospital_name FROM hospital_staff s 
       JOIN hospitals h ON s.hospital_id = h.id 
       WHERE s.email = ? AND s.is_active = TRUE`,
      [email]
    );

    if (!staff) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const valid = await bcrypt.compare(password, staff.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Create JWT token
    const token = createHospitalToken(staff);

    // Set cookie
    res.cookie('hospital-Token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Update last login
    await query('UPDATE hospital_staff SET last_login = NOW() WHERE id = ?', [staff.id]);

    res.json({
      success: true,
      staff: {
        id: staff.id,
        first_name: staff.first_name,
        last_name: staff.last_name,
        email: staff.email,
        role: staff.role,
        hospital_id: staff.hospital_id,
        hospital_name: staff.hospital_name,
        profile_image: staff.profile_image,
      },
    });
  } catch (err) {
    console.error('Hospital login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/hospital/auth/register-staff
router.post('/register-staff', requireHospitalAuth, async (req, res) => {
  try {
    const { first_name, last_name, email, password, phone, role } = req.body;
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const existing = await queryOne('SELECT id FROM hospital_staff WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO hospital_staff (hospital_id, first_name, last_name, email, password_hash, phone, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.hospitalId, first_name, last_name, email, password_hash, phone || null, role || 'receptionist']
    );

    res.status(201).json({ success: true, staff_id: result.insertId, message: 'Staff registered.' });
  } catch (err) {
    console.error('Register staff error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/hospital/auth/me - Current session check
router.get('/me', requireHospitalAuth, async (req, res) => {
  try {
    const staff = await queryOne(
      `SELECT s.id, s.first_name, s.last_name, s.email, s.role, s.hospital_id, s.profile_image, s.department,
              h.name AS hospital_name
       FROM hospital_staff s
       JOIN hospitals h ON s.hospital_id = h.id
       WHERE s.id = ?`,
      [req.staffId]
    );

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found.' });
    }

    res.json({ success: true, staff });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/hospital/auth/logout
router.post('/logout', (req, res) => {
  const token = req.cookies['hospital-Token'];

  if (token) {
    try {
      const decoded = decode(token);
      const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 86400000);

      // Add to blacklist
      query('INSERT INTO token_blacklist (token, expires_at) VALUES (?, ?)', [token, expiresAt])
        .catch(err => console.error('Error blacklisting hospital token:', err));
    } catch (e) {
      // Continue even if decode fails
    }

    res.clearCookie('hospital-Token', { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  }

  res.json({ success: true, message: 'Logged out.' });
});

module.exports = router;
