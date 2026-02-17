const express = require('express');
const router = express.Router();
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');
const { query } = require('../../config/database');

function formatNaira(amount) {
  const n = Number(amount) || 0;
  if (n >= 1000000) return '₦' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '₦' + (n / 1000).toFixed(0) + 'K';
  return '₦' + n.toLocaleString();
}

// GET /hospital/analytics - Render analytics EJS
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const startDate = from || today;
    const endDate = to || today;

    const [patientFlow] = await query(
      `SELECT 
        COUNT(*) AS total_patients,
        SUM(checkin_type = 'pre_booked') AS pre_booked,
        SUM(checkin_type = 'walk_in') AS walk_ins,
        SUM(status = 'completed') AS completed,
        SUM(status = 'no_show') AS no_shows,
        AVG(TIMESTAMPDIFF(MINUTE, checkin_time, COALESCE(consultation_start, NOW()))) AS avg_wait_minutes
       FROM patient_checkins 
       WHERE hospital_id = ? AND DATE(checkin_time) BETWEEN ? AND ?`,
      [req.hospitalId, startDate, endDate]
    );

    const [revenue] = await query(
      `SELECT 
        COALESCE(SUM(total), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) AS collected,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN total ELSE 0 END), 0) AS pending,
        COUNT(*) AS total_transactions
       FROM hospital_billing 
       WHERE hospital_id = ? AND DATE(created_at) BETWEEN ? AND ?`,
      [req.hospitalId, startDate, endDate]
    );

    const doctorUtil = await query(
      `SELECT d.first_name, d.last_name, d.specialty, hd.employment_type,
              COUNT(pc.id) AS patients_seen,
              AVG(TIMESTAMPDIFF(MINUTE, pc.consultation_start, pc.consultation_end)) AS avg_consultation_mins
       FROM hospital_doctors hd
       JOIN doctors d ON hd.doctor_id = d.doctor_id
       LEFT JOIN patient_checkins pc ON pc.assigned_doctor_id = d.doctor_id 
         AND pc.hospital_id = ? AND DATE(pc.checkin_time) BETWEEN ? AND ?
       WHERE hd.hospital_id = ? AND hd.is_active = TRUE
       GROUP BY d.doctor_id
       ORDER BY patients_seen DESC`,
      [req.hospitalId, startDate, endDate, req.hospitalId]
    );

    const [doctorCounts] = await query(
      `SELECT 
        COUNT(*) AS total,
        SUM(employment_type = 'full_time') AS full_time,
        SUM(employment_type = 'visiting_consultant') AS visiting,
        SUM(employment_type = 'locum') AS locum
       FROM hospital_doctors WHERE hospital_id = ? AND is_active = TRUE`,
      [req.hospitalId]
    );

    res.render('hospital/analytics', {
      patient_flow: patientFlow || {},
      revenue: revenue || {},
      doctor_utilization: doctorUtil || [],
      doctor_counts: doctorCounts || {},
      formatNaira
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).send('<div class="error-message"><h2>Failed to load analytics</h2><p>' + err.message + '</p></div>');
  }
});

// Keep JSON sub-endpoints for charts
router.get('/revenue-trend', requireHospitalAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const trend = await query(
      `SELECT DATE(created_at) AS date, COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS transactions
       FROM hospital_billing WHERE hospital_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at) ORDER BY date ASC`,
      [req.hospitalId, parseInt(days)]
    );
    res.json({ success: true, trend });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/patient-trend', requireHospitalAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const trend = await query(
      `SELECT DATE(checkin_time) AS date, COUNT(*) AS patients,
              SUM(checkin_type = 'walk_in') AS walk_ins, SUM(checkin_type = 'pre_booked') AS pre_booked
       FROM patient_checkins WHERE hospital_id = ? AND checkin_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(checkin_time) ORDER BY date ASC`,
      [req.hospitalId, parseInt(days)]
    );
    res.json({ success: true, trend });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/department-stats', requireHospitalAuth, async (req, res) => {
  try {
    const stats = await query(
      `SELECT department, COUNT(*) AS total_patients, SUM(status = 'completed') AS completed,
              AVG(TIMESTAMPDIFF(MINUTE, checkin_time, COALESCE(consultation_start, NOW()))) AS avg_wait
       FROM patient_checkins WHERE hospital_id = ? AND department IS NOT NULL AND DATE(checkin_time) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY department ORDER BY total_patients DESC`,
      [req.hospitalId]
    );
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/top-diagnoses', requireHospitalAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const diagnoses = await query(
      `SELECT diagnosis, COUNT(*) AS count FROM emr_entries 
       WHERE hospital_id = ? AND entry_type = 'diagnosis' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY diagnosis ORDER BY count DESC LIMIT 10`,
      [req.hospitalId, parseInt(days)]
    );
    res.json({ success: true, diagnoses });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/hourly-flow', requireHospitalAuth, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const flow = await query(
      `SELECT HOUR(checkin_time) AS hour, COUNT(*) AS patients
       FROM patient_checkins WHERE hospital_id = ? AND checkin_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY HOUR(checkin_time) ORDER BY hour ASC`,
      [req.hospitalId, parseInt(days)]
    );
    res.json({ success: true, flow });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
