const express = require('express');
const router = express.Router();
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');
const { query, queryOne } = require('../../config/database');

// GET /api/hospital/consultations — List all consultation requests for this hospital
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { status, urgency, type, limit = 50 } = req.query;
    let sql = `
      SELECT cr.*,
             d.first_name AS doctor_first_name, d.last_name AS doctor_last_name,
             d.specialty AS doctor_specialty, d.profile_image AS doctor_image,
             p.firstname AS patient_firstname, p.lastname AS patient_lastname,
             p.patient_id,
             dm.home_hospital_id,
             h.name AS doctor_hospital_name
      FROM consultation_requests cr
      JOIN doctors d ON cr.doctor_id = d.doctor_id
      JOIN patients p ON cr.patient_id = p.patient_id
      LEFT JOIN doctor_marketplace dm ON dm.doctor_id = cr.doctor_id
      LEFT JOIN hospitals h ON dm.home_hospital_id = h.hospital_id
      WHERE cr.requesting_hospital_id = ?
    `;
    const params = [req.hospitalId];

    if (status) { sql += ' AND cr.status = ?'; params.push(status); }
    if (urgency) { sql += ' AND cr.urgency = ?'; params.push(urgency); }
    if (type) { sql += ' AND cr.request_type = ?'; params.push(type); }

    sql += ' ORDER BY cr.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const consultations = await query(sql, params);

    // Get summary counts
    const counts = await queryOne(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'pending') AS pending,
        SUM(status = 'accepted') AS accepted,
        SUM(status = 'completed') AS completed,
        SUM(status = 'rejected') AS rejected,
        SUM(status = 'cancelled') AS cancelled
      FROM consultation_requests WHERE requesting_hospital_id = ?
    `, [req.hospitalId]);

    res.json({ success: true, consultations, counts });
  } catch (err) {
    console.error('List consultations error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/hospital/consultations/:id — Get single consultation detail
router.get('/:id', requireHospitalAuth, async (req, res) => {
  try {
    const consultation = await queryOne(`
      SELECT cr.*,
             d.first_name AS doctor_first_name, d.last_name AS doctor_last_name,
             d.specialty AS doctor_specialty, d.profile_image AS doctor_image,
             d.email AS doctor_email, d.phone AS doctor_phone,
             p.firstname AS patient_firstname, p.lastname AS patient_lastname,
             p.email AS patient_email, p.phone AS patient_phone,
             p.date_of_birth, p.gender, p.blood_type,
             h.name AS doctor_hospital_name
      FROM consultation_requests cr
      JOIN doctors d ON cr.doctor_id = d.doctor_id
      JOIN patients p ON cr.patient_id = p.patient_id
      LEFT JOIN doctor_marketplace dm ON dm.doctor_id = cr.doctor_id
      LEFT JOIN hospitals h ON dm.home_hospital_id = h.hospital_id
      WHERE cr.id = ? AND cr.requesting_hospital_id = ?
    `, [req.params.id, req.hospitalId]);

    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Consultation request not found.' });
    }

    res.json({ success: true, consultation });
  } catch (err) {
    console.error('Get consultation error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/hospital/consultations — Create new consultation request
router.post('/', requireHospitalAuth, async (req, res) => {
  try {
    const {
      doctor_id, patient_id, specialty_needed, urgency, request_type,
      reason, patient_summary, preferred_date, preferred_time, fee_agreed
    } = req.body;

    if (!doctor_id || !patient_id || !reason) {
      return res.status(400).json({ success: false, message: 'Doctor, patient, and reason are required.' });
    }

    // Verify doctor exists and is in marketplace
    const doctor = await queryOne(
      'SELECT d.doctor_id FROM doctors d JOIN doctor_marketplace dm ON d.doctor_id = dm.doctor_id WHERE d.doctor_id = ? AND dm.is_available_for_external = TRUE',
      [doctor_id]
    );
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found or not available for external consultations.' });
    }

    // Verify patient exists
    const patient = await queryOne('SELECT patient_id FROM patients WHERE patient_id = ?', [patient_id]);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const result = await query(
      `INSERT INTO consultation_requests
       (requesting_hospital_id, doctor_id, patient_id, specialty_needed, urgency, request_type, reason, patient_summary, preferred_date, preferred_time, fee_agreed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.hospitalId, doctor_id, patient_id, specialty_needed || null, urgency || 'moderate',
       request_type || 'virtual', reason, patient_summary || null,
       preferred_date || null, preferred_time || null, fee_agreed || null]
    );

    res.status(201).json({ success: true, consultation_id: result.insertId, message: 'Consultation request sent.' });
  } catch (err) {
    console.error('Create consultation error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/hospital/consultations/:id — Update consultation request (cancel, add notes)
router.put('/:id', requireHospitalAuth, async (req, res) => {
  try {
    const existing = await queryOne(
      'SELECT * FROM consultation_requests WHERE id = ? AND requesting_hospital_id = ?',
      [req.params.id, req.hospitalId]
    );
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Consultation request not found.' });
    }

    const { status, reason, patient_summary, preferred_date, preferred_time, fee_agreed } = req.body;
    const updates = [];
    const params = [];

    // Hospital can only cancel or update details (not accept/complete — that's the doctor's side)
    if (status === 'cancelled') { updates.push('status = ?'); params.push('cancelled'); }
    if (reason) { updates.push('reason = ?'); params.push(reason); }
    if (patient_summary) { updates.push('patient_summary = ?'); params.push(patient_summary); }
    if (preferred_date) { updates.push('preferred_date = ?'); params.push(preferred_date); }
    if (preferred_time) { updates.push('preferred_time = ?'); params.push(preferred_time); }
    if (fee_agreed !== undefined) { updates.push('fee_agreed = ?'); params.push(fee_agreed); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(req.params.id);
    await query(`UPDATE consultation_requests SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'Consultation request updated.' });
  } catch (err) {
    console.error('Update consultation error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/hospital/consultations/:id — Delete a pending consultation request
router.delete('/:id', requireHospitalAuth, async (req, res) => {
  try {
    const existing = await queryOne(
      'SELECT * FROM consultation_requests WHERE id = ? AND requesting_hospital_id = ? AND status = "pending"',
      [req.params.id, req.hospitalId]
    );
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Only pending requests can be deleted.' });
    }

    await query('DELETE FROM consultation_requests WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Consultation request deleted.' });
  } catch (err) {
    console.error('Delete consultation error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
