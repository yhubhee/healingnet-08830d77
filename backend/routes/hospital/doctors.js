const express = require('express');
const router = express.Router();
const { requireHospitalAuth, requireHospitalAdmin } = require('../../middleware/hospitalAuth');
const { query, queryOne } = require('../../config/database');

// GET /hospital/doctors - Render doctors EJS
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { type, department, status } = req.query;
    let sql = `
      SELECT hd.*, d.first_name, d.last_name, d.email, d.phone, d.specialty, 
             d.sub_specialty, d.qualification, d.years_experience, d.rating, 
             d.profile_image_url, d.is_available, d.accepts_virtual,
             hd.employment_type, hd.is_active, hd.department AS hd_department
      FROM hospital_doctors hd
      JOIN doctors d ON hd.doctor_id = d.doctor_id
      WHERE hd.hospital_id = ?
    `;
    const params = [req.hospitalId];

    if (type) { sql += ' AND hd.employment_type = ?'; params.push(type); }
    if (department) { sql += ' AND hd.department = ?'; params.push(department); }
    if (status === 'active') sql += ' AND hd.is_active = TRUE';
    else if (status === 'inactive') sql += ' AND hd.is_active = FALSE';

    sql += ' ORDER BY d.last_name ASC';
    const doctors = await query(sql, params);

    res.render('hospital/doctors', { doctors });
  } catch (err) {
    console.error('List doctors error:', err);
    res.status(500).send('<div class="error-message"><h2>Failed to load doctors</h2><p>' + err.message + '</p></div>');
  }
});

// GET /hospital/doctors/api/search - JSON search for header
router.get('/api/search', requireHospitalAuth, async (req, res) => {
  try {
    const { search, limit = 5 } = req.query;
    let sql = `
      SELECT d.first_name, d.last_name, d.specialty, d.doctor_id
      FROM hospital_doctors hd
      JOIN doctors d ON hd.doctor_id = d.doctor_id
      WHERE hd.hospital_id = ?
    `;
    const params = [req.hospitalId];
    if (search) {
      sql += ' AND (d.first_name LIKE ? OR d.last_name LIKE ? OR d.specialty LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    sql += ' LIMIT ?';
    params.push(parseInt(limit));
    const doctors = await query(sql, params);
    res.json({ success: true, doctors });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /hospital/doctors
router.post('/', requireHospitalAdmin, async (req, res) => {
  try {
    const { doctor_id, employment_type, department, contract_start, contract_end, salary, commission_rate, notes } = req.body;
    if (!doctor_id || !employment_type) return res.status(400).json({ success: false, message: 'Doctor ID and employment type required.' });

    const doctor = await queryOne('SELECT doctor_id FROM doctors WHERE doctor_id = ?', [doctor_id]);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' });

    const existing = await queryOne('SELECT id FROM hospital_doctors WHERE hospital_id = ? AND doctor_id = ?', [req.hospitalId, doctor_id]);
    if (existing) return res.status(409).json({ success: false, message: 'Doctor already assigned.' });

    await query(
      `INSERT INTO hospital_doctors (hospital_id, doctor_id, employment_type, department, contract_start, contract_end, salary, commission_rate, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.hospitalId, doctor_id, employment_type, department || null, contract_start || null, contract_end || null, salary || null, commission_rate || 0, notes || null]
    );

    if (employment_type === 'full_time') {
      await query('UPDATE doctors SET hospital_id = ? WHERE doctor_id = ?', [req.hospitalId, doctor_id]);
    }

    res.status(201).json({ success: true, message: 'Doctor added to hospital.' });
  } catch (err) {
    console.error('Add doctor error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /hospital/doctors/:id
router.put('/:id', requireHospitalAdmin, async (req, res) => {
  try {
    const { employment_type, department, contract_start, contract_end, salary, commission_rate, is_active, notes } = req.body;
    const assignment = await queryOne('SELECT * FROM hospital_doctors WHERE id = ? AND hospital_id = ?', [req.params.id, req.hospitalId]);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });

    const updates = [];
    const params = [];
    if (employment_type) { updates.push('employment_type = ?'); params.push(employment_type); }
    if (department !== undefined) { updates.push('department = ?'); params.push(department); }
    if (contract_start) { updates.push('contract_start = ?'); params.push(contract_start); }
    if (contract_end) { updates.push('contract_end = ?'); params.push(contract_end); }
    if (salary !== undefined) { updates.push('salary = ?'); params.push(salary); }
    if (commission_rate !== undefined) { updates.push('commission_rate = ?'); params.push(commission_rate); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update.' });

    params.push(req.params.id);
    await query(`UPDATE hospital_doctors SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Doctor assignment updated.' });
  } catch (err) {
    console.error('Update doctor error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /hospital/doctors/:id
router.delete('/:id', requireHospitalAdmin, async (req, res) => {
  try {
    const assignment = await queryOne('SELECT * FROM hospital_doctors WHERE id = ? AND hospital_id = ?', [req.params.id, req.hospitalId]);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });

    await query('DELETE FROM hospital_doctors WHERE id = ?', [req.params.id]);
    if (assignment.employment_type === 'full_time') {
      await query('UPDATE doctors SET hospital_id = NULL WHERE doctor_id = ? AND hospital_id = ?', [assignment.doctor_id, req.hospitalId]);
    }
    res.json({ success: true, message: 'Doctor removed from hospital.' });
  } catch (err) {
    console.error('Remove doctor error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;