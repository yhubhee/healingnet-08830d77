const express = require('express');
const router = express.Router();
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');
const { query, queryOne } = require('../../config/database');

// GET /api/hospital/emr/patients - Search patients
router.get('/patients', requireHospitalAuth, async (req, res) => {
  try {
    const { search, limit = 20 } = req.query;
    let sql = `
      SELECT DISTINCT p.id, p.first_name, p.last_name, p.email, p.phone, 
             p.date_of_birth, p.gender, p.blood_group, p.genotype, p.profile_image
      FROM patients p
      JOIN patient_checkins pc ON p.id = pc.patient_id
      WHERE pc.hospital_id = ?
    `;
    const params = [req.hospitalId];

    if (search) {
      sql += ' AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.email LIKE ? OR p.phone LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY p.last_name ASC LIMIT ?';
    params.push(parseInt(limit));

    const patients = await query(sql, params);
    res.json({ success: true, patients });
  } catch (err) {
    console.error('Search patients error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/hospital/emr/patients/:id - Full patient record
router.get('/patients/:id', requireHospitalAuth, async (req, res) => {
  try {
    const patient = await queryOne('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    // Get EMR entries
    const entries = await query(
      `SELECT e.*, d.first_name AS doctor_first_name, d.last_name AS doctor_last_name
       FROM emr_entries e LEFT JOIN doctors d ON e.doctor_id = d.id
       WHERE e.patient_id = ? ORDER BY e.created_at DESC`,
      [req.params.id]
    );

    // Get prescriptions
    const prescriptions = await query(
      `SELECT pr.*, d.first_name AS doctor_first_name, d.last_name AS doctor_last_name
       FROM prescriptions pr JOIN doctors d ON pr.doctor_id = d.id
       WHERE pr.patient_id = ? ORDER BY pr.created_at DESC LIMIT 10`,
      [req.params.id]
    );

    // Get recent appointments
    const appointments = await query(
      `SELECT a.*, d.first_name AS doctor_first_name, d.last_name AS doctor_last_name, d.specialty
       FROM appointments a JOIN doctors d ON a.doctor_id = d.id
       WHERE a.patient_id = ? ORDER BY a.appointment_date DESC LIMIT 10`,
      [req.params.id]
    );

    // Remove sensitive fields
    delete patient.password_hash;

    res.json({ success: true, patient, emr_entries: entries, prescriptions, appointments });
  } catch (err) {
    console.error('Patient record error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/hospital/emr/entries - Create EMR entry
router.post('/entries', requireHospitalAuth, async (req, res) => {
  try {
    const { patient_id, doctor_id, checkin_id, entry_type, title, content, structured_data, is_confidential } = req.body;

    if (!patient_id || !entry_type || !title) {
      return res.status(400).json({ success: false, message: 'Patient, entry type, and title required.' });
    }

    const result = await query(
      `INSERT INTO emr_entries (hospital_id, patient_id, doctor_id, checkin_id, entry_type, title, content, structured_data, is_confidential)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.hospitalId, patient_id, doctor_id || null, checkin_id || null, entry_type, title, content || null, structured_data ? JSON.stringify(structured_data) : null, is_confidential || false]
    );

    res.status(201).json({ success: true, entry_id: result.insertId, message: 'EMR entry created.' });
  } catch (err) {
    console.error('Create EMR entry error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/hospital/emr/entries/:id - Update EMR entry
router.put('/entries/:id', requireHospitalAuth, async (req, res) => {
  try {
    const { title, content, structured_data, is_confidential } = req.body;
    const updates = [];
    const params = [];

    if (title) { updates.push('title = ?'); params.push(title); }
    if (content !== undefined) { updates.push('content = ?'); params.push(content); }
    if (structured_data) { updates.push('structured_data = ?'); params.push(JSON.stringify(structured_data)); }
    if (is_confidential !== undefined) { updates.push('is_confidential = ?'); params.push(is_confidential); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(req.params.id, req.hospitalId);
    await query(`UPDATE emr_entries SET ${updates.join(', ')} WHERE id = ? AND hospital_id = ?`, params);

    res.json({ success: true, message: 'EMR entry updated.' });
  } catch (err) {
    console.error('Update EMR entry error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
