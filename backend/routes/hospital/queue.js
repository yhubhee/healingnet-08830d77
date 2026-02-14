const express = require('express');
const router = express.Router();
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');
const { query, queryOne } = require('../../config/database');

// GET /api/hospital/queue - Today's patient queue
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { date, status, department } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let sql = `
      SELECT pc.*, p.first_name, p.last_name, p.phone, p.date_of_birth, p.gender,
             p.blood_group, p.profile_image AS patient_image,
             d.first_name AS doctor_first_name, d.last_name AS doctor_last_name, d.specialty,
             a.appointment_type, a.reason AS appointment_reason
      FROM patient_checkins pc
      JOIN patients p ON pc.patient_id = p.id
      LEFT JOIN doctors d ON pc.assigned_doctor_id = d.id
      LEFT JOIN appointments a ON pc.appointment_id = a.id
      WHERE pc.hospital_id = ? AND DATE(pc.checkin_time) = ?
    `;
    const params = [req.hospitalId, targetDate];

    if (status) { sql += ' AND pc.status = ?'; params.push(status); }
    if (department) { sql += ' AND pc.department = ?'; params.push(department); }

    sql += ' ORDER BY pc.priority DESC, pc.queue_number ASC';
    const queue = await query(sql, params);

    // Get stats
    const [stats] = await query(
      `SELECT 
        COUNT(*) AS total,
        SUM(status = 'checked_in' OR status = 'waiting') AS waiting,
        SUM(status = 'in_consultation') AS in_consultation,
        SUM(status = 'completed') AS completed,
        SUM(checkin_type = 'walk_in') AS walk_ins,
        SUM(checkin_type = 'pre_booked') AS pre_booked
       FROM patient_checkins WHERE hospital_id = ? AND DATE(checkin_time) = ?`,
      [req.hospitalId, targetDate]
    );

    res.json({ success: true, queue, stats });
  } catch (err) {
    console.error('Queue error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/hospital/queue/checkin - Check in a patient
router.post('/checkin', requireHospitalAuth, async (req, res) => {
  try {
    const { patient_id, appointment_id, checkin_type, department, priority, assigned_doctor_id, notes } = req.body;

    if (!patient_id) {
      return res.status(400).json({ success: false, message: 'Patient ID required.' });
    }

    // Generate queue number
    const today = new Date().toISOString().split('T')[0];
    const [{ max_queue }] = await query(
      'SELECT COALESCE(MAX(queue_number), 0) AS max_queue FROM patient_checkins WHERE hospital_id = ? AND DATE(checkin_time) = ?',
      [req.hospitalId, today]
    );

    const result = await query(
      `INSERT INTO patient_checkins 
       (hospital_id, patient_id, appointment_id, checkin_type, queue_number, department, priority, assigned_doctor_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.hospitalId, patient_id, appointment_id || null, checkin_type || 'walk_in', max_queue + 1, department || null, priority || 'normal', assigned_doctor_id || null, notes || null]
    );

    // If pre-booked, update appointment status
    if (appointment_id) {
      await query("UPDATE appointments SET status = 'accepted' WHERE id = ? AND status = 'pending'", [appointment_id]);
    }

    res.status(201).json({ success: true, checkin_id: result.insertId, queue_number: max_queue + 1, message: 'Patient checked in.' });
  } catch (err) {
    console.error('Checkin error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/hospital/queue/:id/status - Update check-in status
router.put('/:id/status', requireHospitalAuth, async (req, res) => {
  try {
    const { status, vitals } = req.body;
    const validStatuses = ['waiting', 'in_consultation', 'completed', 'no_show', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const updates = ['status = ?'];
    const params = [status];

    if (status === 'in_consultation') {
      updates.push('consultation_start = NOW()');
    } else if (status === 'completed') {
      updates.push('consultation_end = NOW()');
    }
    if (vitals) {
      updates.push('vitals = ?');
      params.push(JSON.stringify(vitals));
    }

    params.push(req.params.id);
    await query(`UPDATE patient_checkins SET ${updates.join(', ')} WHERE id = ? AND hospital_id = ${req.hospitalId}`, params);

    res.json({ success: true, message: `Patient status updated to ${status}.` });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/hospital/queue/auto-checkin - Auto check-in from online booking
router.post('/auto-checkin', requireHospitalAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Find today's pre-booked appointments that haven't been checked in
    const appointments = await query(
      `SELECT a.*, p.first_name, p.last_name 
       FROM appointments a 
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE d.hospital_id = ? AND a.appointment_date = ? 
         AND a.status IN ('pending', 'accepted') AND a.appointment_type = 'in_person'
         AND a.id NOT IN (SELECT COALESCE(appointment_id, 0) FROM patient_checkins WHERE hospital_id = ? AND DATE(checkin_time) = ?)`,
      [req.hospitalId, today, req.hospitalId, today]
    );

    let checkedIn = 0;
    for (const appt of appointments) {
      const [{ max_queue }] = await query(
        'SELECT COALESCE(MAX(queue_number), 0) AS max_queue FROM patient_checkins WHERE hospital_id = ? AND DATE(checkin_time) = ?',
        [req.hospitalId, today]
      );

      await query(
        `INSERT INTO patient_checkins (hospital_id, patient_id, appointment_id, checkin_type, queue_number, assigned_doctor_id, status)
         VALUES (?, ?, ?, 'pre_booked', ?, ?, 'checked_in')`,
        [req.hospitalId, appt.patient_id, appt.id, max_queue + 1, appt.doctor_id]
      );
      checkedIn++;
    }

    res.json({ success: true, checked_in: checkedIn, message: `${checkedIn} patients auto-checked in.` });
  } catch (err) {
    console.error('Auto checkin error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
