const express = require('express');
const router = express.Router();
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');
const { query, queryOne } = require('../../config/database');

// GET /hospital/marketplace - Render EJS
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { specialty, type, limit = 20 } = req.query;
    let sql = `
      SELECT dm.*, d.first_name, d.last_name, d.specialty, d.sub_specialty,
             d.qualification, d.years_experience, d.rating, d.total_reviews,
             d.profile_image_url AS profile_image, d.accepts_virtual, d.accepts_in_person,
             d.doctor_id,
             h.name AS home_hospital_name, h.city AS home_city
      FROM doctor_marketplace dm
      JOIN doctors d ON dm.doctor_id = d.doctor_id
      LEFT JOIN hospitals h ON dm.home_hospital_id = h.hospital_id
      WHERE dm.is_available_for_external = TRUE
        AND dm.current_external_hours < dm.max_external_hours_per_week
    `;
    const params = [];
    if (specialty) {
      sql += ' AND (d.specialty = ? OR d.sub_specialty = ?)';
      params.push(specialty, specialty);
    }
    if (type === 'virtual') sql += ' AND d.accepts_virtual = TRUE';
    else if (type === 'in_person') sql += ' AND d.accepts_in_person = TRUE';
    sql += ' ORDER BY d.rating DESC, d.total_reviews DESC LIMIT ?';
    params.push(parseInt(limit));

    const doctors = await query(sql, params);
    res.render('hospital/marketplace', { doctors });
  } catch (err) {
    console.error('Marketplace error:', err);
    res.status(500).send('<div class="error-message"><h2>Failed to load marketplace</h2><p>' + err.message + '</p></div>');
  }
});

// POST /hospital/marketplace/request
router.post('/request', requireHospitalAuth, async (req, res) => {
  try {
    const { doctor_id, patient_id, specialty_needed, urgency, request_type, reason, patient_summary, preferred_date, preferred_time } = req.body;
    if (!doctor_id || !patient_id || !reason) return res.status(400).json({ success: false, message: 'Doctor, patient, and reason required.' });

    const marketplace = await queryOne('SELECT * FROM doctor_marketplace WHERE doctor_id = ? AND is_available_for_external = TRUE', [doctor_id]);
    if (!marketplace) return res.status(404).json({ success: false, message: 'Doctor not available.' });

    const fee = request_type === 'virtual' ? marketplace.external_virtual_fee : marketplace.external_consultation_fee;
    const result = await query(
      `INSERT INTO consultation_requests 
       (requesting_hospital_id, doctor_id, patient_id, specialty_needed, urgency, request_type, reason, patient_summary, preferred_date, preferred_time, fee_agreed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.hospitalId, doctor_id, patient_id, specialty_needed || null, urgency || 'moderate', request_type || 'virtual', reason, patient_summary || null, preferred_date || null, preferred_time || null, fee]
    );

    await query(`INSERT INTO notifications (doctor_id, type, title, message) VALUES (?, 'appointment', 'External Consultation Request', ?)`,
      [doctor_id, `A hospital has requested your consultation. Urgency: ${urgency || 'moderate'}.`]);

    res.status(201).json({ success: true, request_id: result.insertId, message: 'Request sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /hospital/marketplace/requests
router.get('/requests', requireHospitalAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT cr.*, d.first_name AS doctor_first_name, d.last_name AS doctor_last_name,
             d.specialty, d.profile_image_url AS doctor_image,
             p.firstname AS patient_first_name, p.lastname AS patient_last_name
      FROM consultation_requests cr
      JOIN doctors d ON cr.doctor_id = d.doctor_id
      JOIN patients p ON cr.patient_id = p.patient_id
      WHERE cr.requesting_hospital_id = ?
    `;
    const params = [req.hospitalId];
    if (status) { sql += ' AND cr.status = ?'; params.push(status); }
    sql += ' ORDER BY cr.created_at DESC';
    const requests = await query(sql, params);
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /hospital/marketplace/requests/:id
router.put('/requests/:id', requireHospitalAuth, async (req, res) => {
  try {
    const { status, meeting_link, doctor_notes } = req.body;
    const updates = [];
    const params = [];
    if (status) { updates.push('status = ?'); params.push(status); }
    if (meeting_link) { updates.push('meeting_link = ?'); params.push(meeting_link); }
    if (doctor_notes) { updates.push('doctor_notes = ?'); params.push(doctor_notes); }
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields.' });
    params.push(req.params.id);
    await query(`UPDATE consultation_requests SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;