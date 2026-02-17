const express = require('express');
const router = express.Router();
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');
const { query, queryOne } = require('../../config/database');

// GET /hospital/surgery - Render EJS
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { status, date } = req.query;
    let sql = `
      SELECT s.*, CONCAT(p.firstname, ' ', p.lastname) AS patient_name, p.date_of_birth, p.gender,
             CONCAT(d1.first_name, ' ', d1.last_name) AS surgeon_name, d1.specialty,
             CONCAT(d2.first_name, ' ', d2.last_name) AS anaesthetist_name
      FROM surgery_records s
      JOIN patients p ON s.patient_id = p.patient_id
      JOIN doctors d1 ON s.surgeon_id = d1.doctor_id
      LEFT JOIN doctors d2 ON s.anaesthetist_id = d2.doctor_id
      WHERE s.hospital_id = ?
    `;
    const params = [req.hospitalId];
    if (status) { sql += ' AND s.status = ?'; params.push(status); }
    if (date) { sql += ' AND s.scheduled_date = ?'; params.push(date); }
    sql += ' ORDER BY s.scheduled_date ASC, s.scheduled_time ASC';
    const records = await query(sql, params);

    const [stats] = await query(`
      SELECT 
        SUM(scheduled_date = CURDATE()) AS today,
        SUM(status = 'completed' AND YEARWEEK(scheduled_date) = YEARWEEK(CURDATE())) AS completed_week,
        SUM(status IN ('scheduled','prep')) AS pending,
        SUM(status = 'recovery') AS post_op
      FROM surgery_records WHERE hospital_id = ?
    `, [req.hospitalId]);

    res.render('hospital/surgery', { records, stats: stats || {} });
  } catch (err) {
    console.error('Surgery error:', err);
    res.status(500).send('<div class="error-message"><h2>Failed to load surgery</h2><p>' + err.message + '</p></div>');
  }
});

// POST /hospital/surgery
router.post('/', requireHospitalAuth, async (req, res) => {
  try {
    const { patient_id, surgeon_id, anaesthetist_id, procedure_name, procedure_type, theatre_number, anaesthesia_type, scheduled_date, scheduled_time, pre_op_diagnosis, notes } = req.body;
    if (!patient_id || !surgeon_id || !procedure_name || !scheduled_date || !scheduled_time) return res.status(400).json({ success: false, message: 'Required fields missing.' });
    const result = await query(
      `INSERT INTO surgery_records (hospital_id, patient_id, surgeon_id, anaesthetist_id, procedure_name, procedure_type, theatre_number, anaesthesia_type, scheduled_date, scheduled_time, pre_op_diagnosis, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.hospitalId, patient_id, surgeon_id, anaesthetist_id || null, procedure_name, procedure_type || 'elective', theatre_number || null, anaesthesia_type || 'general', scheduled_date, scheduled_time, pre_op_diagnosis || null, notes || null]
    );
    res.status(201).json({ success: true, id: result.insertId, message: 'Surgery scheduled.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /hospital/surgery/:id/status
router.put('/:id/status', requireHospitalAuth, async (req, res) => {
  try {
    const { status, post_op_diagnosis, operative_findings, complications, blood_loss_ml, post_op_instructions } = req.body;
    const updates = ['status = ?'];
    const params = [status];
    if (status === 'in_progress') updates.push('actual_start = NOW()');
    if (status === 'completed' || status === 'recovery') updates.push('actual_end = NOW()');
    if (post_op_diagnosis) { updates.push('post_op_diagnosis = ?'); params.push(post_op_diagnosis); }
    if (operative_findings) { updates.push('operative_findings = ?'); params.push(operative_findings); }
    if (complications) { updates.push('complications = ?'); params.push(complications); }
    if (blood_loss_ml !== undefined) { updates.push('blood_loss_ml = ?'); params.push(blood_loss_ml); }
    if (post_op_instructions) { updates.push('post_op_instructions = ?'); params.push(post_op_instructions); }
    params.push(req.params.id, req.hospitalId);
    await query(`UPDATE surgery_records SET ${updates.join(', ')} WHERE id = ? AND hospital_id = ?`, params);
    res.json({ success: true, message: 'Surgery status updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;