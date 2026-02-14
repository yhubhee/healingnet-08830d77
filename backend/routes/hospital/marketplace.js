const express = require('express');
const router = express.Router();
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');
const { query, queryOne } = require('../../config/database');

// GET /api/hospital/marketplace - Browse available doctors
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { specialty, type, lat, lng, limit = 20 } = req.query;

    let sql = `
      SELECT dm.*, d.first_name, d.last_name, d.specialty, d.sub_specialty,
             d.qualification, d.years_experience, d.rating, d.total_reviews,
             d.profile_image, d.accepts_virtual, d.accepts_in_person,
             h.name AS home_hospital_name, h.city AS home_city
    `;

    if (lat && lng) {
      sql += `,
        (6371 * ACOS(
          COS(RADIANS(?)) * COS(RADIANS(h.latitude)) *
          COS(RADIANS(h.longitude) - RADIANS(?)) +
          SIN(RADIANS(?)) * SIN(RADIANS(h.latitude))
        )) AS distance_km
      `;
    }

    sql += `
      FROM doctor_marketplace dm
      JOIN doctors d ON dm.doctor_id = d.id
      LEFT JOIN hospitals h ON dm.home_hospital_id = h.id
      WHERE dm.is_available_for_external = TRUE
        AND dm.current_external_hours < dm.max_external_hours_per_week
    `;

    const params = [];
    if (lat && lng) params.push(parseFloat(lat), parseFloat(lng), parseFloat(lat));

    if (specialty) {
      sql += ' AND (d.specialty = ? OR d.sub_specialty = ?)';
      params.push(specialty, specialty);
    }

    if (type === 'virtual') sql += ' AND d.accepts_virtual = TRUE';
    else if (type === 'in_person') sql += ' AND d.accepts_in_person = TRUE';

    if (type === 'in_person' && lat && lng) {
      sql += ' ORDER BY distance_km ASC';
    } else {
      sql += ' ORDER BY d.rating DESC, d.total_reviews DESC';
    }

    sql += ' LIMIT ?';
    params.push(parseInt(limit));

    const doctors = await query(sql, params);
    res.json({ success: true, doctors });
  } catch (err) {
    console.error('Marketplace error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/hospital/marketplace/request - Send consultation request
router.post('/request', requireHospitalAuth, async (req, res) => {
  try {
    const { doctor_id, patient_id, specialty_needed, urgency, request_type, reason, patient_summary, preferred_date, preferred_time } = req.body;

    if (!doctor_id || !patient_id || !reason) {
      return res.status(400).json({ success: false, message: 'Doctor, patient, and reason required.' });
    }

    // Get marketplace fee
    const marketplace = await queryOne(
      'SELECT * FROM doctor_marketplace WHERE doctor_id = ? AND is_available_for_external = TRUE',
      [doctor_id]
    );
    if (!marketplace) {
      return res.status(404).json({ success: false, message: 'Doctor not available on marketplace.' });
    }

    const fee = request_type === 'virtual' ? marketplace.external_virtual_fee : marketplace.external_consultation_fee;

    const result = await query(
      `INSERT INTO consultation_requests 
       (requesting_hospital_id, doctor_id, patient_id, specialty_needed, urgency, request_type, reason, patient_summary, preferred_date, preferred_time, fee_agreed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.hospitalId, doctor_id, patient_id, specialty_needed || null, urgency || 'moderate', request_type || 'virtual', reason, patient_summary || null, preferred_date || null, preferred_time || null, fee]
    );

    // Notify doctor
    await query(
      `INSERT INTO notifications (doctor_id, type, title, message)
       VALUES (?, 'appointment', 'External Consultation Request', ?)`,
      [doctor_id, `A hospital has requested your consultation for a patient. Urgency: ${urgency || 'moderate'}.`]
    );

    res.status(201).json({ success: true, request_id: result.insertId, message: 'Consultation request sent.' });
  } catch (err) {
    console.error('Request error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/hospital/marketplace/requests - Hospital's consultation requests
router.get('/requests', requireHospitalAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT cr.*, d.first_name AS doctor_first_name, d.last_name AS doctor_last_name,
             d.specialty, d.profile_image AS doctor_image,
             p.first_name AS patient_first_name, p.last_name AS patient_last_name
      FROM consultation_requests cr
      JOIN doctors d ON cr.doctor_id = d.id
      JOIN patients p ON cr.patient_id = p.id
      WHERE cr.requesting_hospital_id = ?
    `;
    const params = [req.hospitalId];
    if (status) { sql += ' AND cr.status = ?'; params.push(status); }
    sql += ' ORDER BY cr.created_at DESC';

    const requests = await query(sql, params);
    res.json({ success: true, requests });
  } catch (err) {
    console.error('Get requests error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/hospital/marketplace/requests/:id - Update request (for doctor response)
router.put('/requests/:id', requireHospitalAuth, async (req, res) => {
  try {
    const { status, meeting_link, doctor_notes } = req.body;
    const updates = [];
    const params = [];

    if (status) { updates.push('status = ?'); params.push(status); }
    if (meeting_link) { updates.push('meeting_link = ?'); params.push(meeting_link); }
    if (doctor_notes) { updates.push('doctor_notes = ?'); params.push(doctor_notes); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(req.params.id);
    await query(`UPDATE consultation_requests SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'Request updated.' });
  } catch (err) {
    console.error('Update request error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
