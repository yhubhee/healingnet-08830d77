const express = require('express');
const router = express.Router();
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');
const { query } = require('../../config/database');

// GET /api/hospital/referrals
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { type, status } = req.query;
    let sql = `
      SELECT r.*, CONCAT(p.firstname, ' ', p.lastname) AS patient_name,
             CONCAT(d1.first_name, ' ', d1.last_name) AS referring_doctor, d1.specialty AS referring_specialty,
             CONCAT(d2.first_name, ' ', d2.last_name) AS referred_to_doctor, d2.specialty AS referred_specialty
      FROM hospital_referrals r
      JOIN patients p ON r.patient_id = p.patient_id
      LEFT JOIN doctors d1 ON r.referring_doctor_id = d1.doctor_id
      LEFT JOIN doctors d2 ON r.referred_to_doctor_id = d2.doctor_id
      WHERE r.hospital_id = ?
    `;
    const params = [req.hospitalId];
    if (type) { sql += ' AND r.referral_type = ?'; params.push(type); }
    if (status) { sql += ' AND r.status = ?'; params.push(status); }
    sql += ' ORDER BY r.created_at DESC';

    const referrals = await query(sql, params);

    const [stats] = await query(`
      SELECT COUNT(*) AS total,
        SUM(referral_type = 'external_incoming') AS incoming,
        SUM(referral_type = 'external_outgoing') AS outgoing,
        SUM(referral_type = 'internal') AS internal,
        SUM(status = 'completed') AS completed
      FROM hospital_referrals WHERE hospital_id = ?
    `, [req.hospitalId]);

    res.json({ success: true, referrals, stats });
  } catch (err) {
    console.error('Referrals error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/hospital/referrals
router.post('/', requireHospitalAuth, async (req, res) => {
  try {
    const { patient_id, referring_doctor_id, referred_to_doctor_id, referred_to_hospital,
            referral_type, specialty, reason, clinical_summary, urgency } = req.body;

    if (!patient_id || !referral_type || !reason) {
      return res.status(400).json({ success: false, message: 'Patient, type, and reason required.' });
    }

    const result = await query(
      `INSERT INTO hospital_referrals (hospital_id, patient_id, referring_doctor_id, referred_to_doctor_id,
       referred_to_hospital, referral_type, specialty, reason, clinical_summary, urgency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.hospitalId, patient_id, referring_doctor_id || null, referred_to_doctor_id || null,
       referred_to_hospital || null, referral_type, specialty || null, reason, clinical_summary || null, urgency || 'routine']
    );

    res.status(201).json({ success: true, id: result.insertId, message: 'Referral created.' });
  } catch (err) {
    console.error('Create referral error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/hospital/referrals/:id
router.put('/:id', requireHospitalAuth, async (req, res) => {
  try {
    const { status, feedback, appointment_date } = req.body;
    const updates = [];
    const params = [];
    if (status) { updates.push('status = ?'); params.push(status); }
    if (feedback) { updates.push('feedback = ?'); params.push(feedback); }
    if (appointment_date) { updates.push('appointment_date = ?'); params.push(appointment_date); }
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update.' });

    params.push(req.params.id, req.hospitalId);
    await query(`UPDATE hospital_referrals SET ${updates.join(', ')} WHERE id = ? AND hospital_id = ?`, params);
    res.json({ success: true, message: 'Referral updated.' });
  } catch (err) {
    console.error('Update referral error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
