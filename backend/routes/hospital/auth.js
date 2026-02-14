const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../../config/database');
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');

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

    // Set session
    req.session.hospital_staff_id = staff.id;
    req.session.hospital_id = staff.hospital_id;
    req.session.staff_role = staff.role;

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

// POST /api/hospital/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out.' });
  });
});

module.exports = router;
