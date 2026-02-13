const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { query, queryOne } = require('../config/database');

// GET /api/profile - Get patient profile
router.get('/', requireAuth, async (req, res) => {
  try {
    const patient = await queryOne(
      `SELECT id, first_name, last_name, email, phone, date_of_birth, gender, blood_group, genotype,
              address, city, state, country, profile_image, emergency_contact_name, emergency_contact_phone,
              allergies, chronic_conditions, created_at
       FROM patients WHERE id = ?`,
      [req.patientId]
    );

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    res.json({ success: true, patient });
  } catch (err) {
    console.error('Profile get error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/profile - Update patient profile
router.put('/', requireAuth, async (req, res) => {
  try {
    const allowedFields = [
      'first_name', 'last_name', 'phone', 'date_of_birth', 'gender', 'blood_group', 'genotype',
      'address', 'city', 'state', 'country', 'emergency_contact_name', 'emergency_contact_phone',
      'allergies', 'chronic_conditions',
    ];

    const updates = [];
    const params = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(req.patientId);
    await query(`UPDATE patients SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'Profile updated.' });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
