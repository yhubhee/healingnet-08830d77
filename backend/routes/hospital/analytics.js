const express = require('express');
const router = express.Router();
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');
const { query } = require('../../config/database');

// GET /api/hospital/analytics/overview - Dashboard stats
router.get('/overview', requireHospitalAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const startDate = from || today;
    const endDate = to || today;

    // Patient flow
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

    // Revenue
    const [revenue] = await query(
      `SELECT 
        COALESCE(SUM(total), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) AS collected,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN total ELSE 0 END), 0) AS pending,
        COALESCE(SUM(CASE WHEN billing_type = 'external_consultation' THEN total ELSE 0 END), 0) AS external_revenue
       FROM hospital_billing 
       WHERE hospital_id = ? AND DATE(created_at) BETWEEN ? AND ?`,
      [req.hospitalId, startDate, endDate]
    );

    // Doctor utilization
    const doctorUtil = await query(
      `SELECT d.first_name, d.last_name, d.specialty, hd.employment_type,
              COUNT(pc.id) AS patients_seen,
              AVG(TIMESTAMPDIFF(MINUTE, pc.consultation_start, pc.consultation_end)) AS avg_consultation_mins
       FROM hospital_doctors hd
       JOIN doctors d ON hd.doctor_id = d.id
       LEFT JOIN patient_checkins pc ON pc.assigned_doctor_id = d.id 
         AND pc.hospital_id = ? AND DATE(pc.checkin_time) BETWEEN ? AND ?
       WHERE hd.hospital_id = ? AND hd.is_active = TRUE
       GROUP BY d.id
       ORDER BY patients_seen DESC`,
      [req.hospitalId, startDate, endDate, req.hospitalId]
    );

    // Active doctors count
    const [doctorCounts] = await query(
      `SELECT 
        COUNT(*) AS total,
        SUM(employment_type = 'full_time') AS full_time,
        SUM(employment_type = 'visiting_consultant') AS visiting,
        SUM(employment_type = 'locum') AS locum
       FROM hospital_doctors WHERE hospital_id = ? AND is_active = TRUE`,
      [req.hospitalId]
    );

    res.json({
      success: true,
      patient_flow: patientFlow,
      revenue,
      doctor_utilization: doctorUtil,
      doctor_counts: doctorCounts,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/hospital/analytics/revenue-trend - Daily revenue trend
router.get('/revenue-trend', requireHospitalAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const trend = await query(
      `SELECT DATE(created_at) AS date, 
              COALESCE(SUM(total), 0) AS revenue,
              COUNT(*) AS transactions
       FROM hospital_billing 
       WHERE hospital_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [req.hospitalId, parseInt(days)]
    );

    res.json({ success: true, trend });
  } catch (err) {
    console.error('Revenue trend error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/hospital/analytics/department-stats
router.get('/department-stats', requireHospitalAuth, async (req, res) => {
  try {
    const stats = await query(
      `SELECT department, COUNT(*) AS total_patients,
              SUM(status = 'completed') AS completed,
              AVG(TIMESTAMPDIFF(MINUTE, checkin_time, COALESCE(consultation_start, NOW()))) AS avg_wait
       FROM patient_checkins 
       WHERE hospital_id = ? AND department IS NOT NULL AND DATE(checkin_time) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY department
       ORDER BY total_patients DESC`,
      [req.hospitalId]
    );

    res.json({ success: true, stats });
  } catch (err) {
    console.error('Department stats error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
