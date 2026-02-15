const express = require('express');
const router = express.Router();
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');
const { query, queryOne } = require('../../config/database');

// GET /api/hospital/maternity - List maternity records
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { status, risk_level } = req.query;
    let sql = `
      SELECT m.*, CONCAT(p.firstname, ' ', p.lastname) AS patient_name, p.date_of_birth, p.phone,
             CONCAT(d.first_name, ' ', d.last_name) AS doctor_name
      FROM maternity_records m
      JOIN patients p ON m.patient_id = p.patient_id
      LEFT JOIN doctors d ON m.doctor_id = d.doctor_id
      WHERE m.hospital_id = ?
    `;
    const params = [req.hospitalId];

    if (status) { sql += ' AND m.status = ?'; params.push(status); }
    if (risk_level) { sql += ' AND m.risk_level = ?'; params.push(risk_level); }

    sql += ' ORDER BY m.edd ASC';
    const records = await query(sql, params);

    const [stats] = await query(`
      SELECT COUNT(*) AS total,
        SUM(status IN ('anc_registered','active_anc')) AS active_anc,
        SUM(status = 'delivered') AS delivered_this_month,
        SUM(risk_level = 'high') AS high_risk,
        SUM(status = 'postnatal') AS postnatal
      FROM maternity_records WHERE hospital_id = ?
    `, [req.hospitalId]);

    res.json({ success: true, records, stats });
  } catch (err) {
    console.error('Maternity error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/hospital/maternity - Create maternity record
router.post('/', requireHospitalAuth, async (req, res) => {
  try {
    const { patient_id, doctor_id, lmp_date, edd, gestational_age_weeks, gravida, para,
            risk_level, blood_group, genotype, hiv_status, hepatitis_b, notes } = req.body;

    if (!patient_id) {
      return res.status(400).json({ success: false, message: 'Patient ID required.' });
    }

    const result = await query(
      `INSERT INTO maternity_records (hospital_id, patient_id, doctor_id, lmp_date, edd, gestational_age_weeks,
       gravida, para, risk_level, blood_group, genotype, hiv_status, hepatitis_b, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.hospitalId, patient_id, doctor_id || null, lmp_date || null, edd || null,
       gestational_age_weeks || null, gravida || 1, para || 0, risk_level || 'low',
       blood_group || null, genotype || null, hiv_status || 'unknown', hepatitis_b || 'unknown', notes || null]
    );

    res.status(201).json({ success: true, id: result.insertId, message: 'Maternity record created.' });
  } catch (err) {
    console.error('Create maternity error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/hospital/maternity/:id - Update maternity record
router.put('/:id', requireHospitalAuth, async (req, res) => {
  try {
    const allowedFields = ['status', 'risk_level', 'gestational_age_weeks', 'delivery_date', 'delivery_type',
      'baby_weight', 'baby_gender', 'apgar_score', 'complications', 'notes', 'doctor_id'];
    const updates = [];
    const params = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) { updates.push(`${field} = ?`); params.push(req.body[field]); }
    }
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update.' });

    params.push(req.params.id, req.hospitalId);
    await query(`UPDATE maternity_records SET ${updates.join(', ')} WHERE id = ? AND hospital_id = ?`, params);
    res.json({ success: true, message: 'Maternity record updated.' });
  } catch (err) {
    console.error('Update maternity error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
