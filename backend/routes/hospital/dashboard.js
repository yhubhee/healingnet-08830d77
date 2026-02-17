const express = require('express');
const router = express.Router();
const { query } = require('../../config/database');
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');

// ==========================================
// Helper functions for EJS templates
// ==========================================
function formatNaira(amount) {
  const n = Number(amount) || 0;
  if (n >= 1000000) return '₦' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '₦' + (n / 1000).toFixed(0) + 'K';
  return '₦' + n.toLocaleString();
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + ' min ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

function statusLabel(status) {
  return (status || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function statusClass(status) {
  const map = { waiting: 'status-waiting', checked_in: 'status-checked-in', in_consultation: 'status-in-consultation', completed: 'status-completed' };
  return map[status] || '';
}

// ==========================================
// GET /api/hospital/dashboard
// Render dashboard as EJS HTML partial
// ==========================================
router.get('/', requireHospitalAuth, async (req, res) => {
  const hid = req.hospitalId;
  const today = new Date().toISOString().slice(0, 10);
  const todayStr = new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  try {
    const [
      patientStats,
      doctorStats,
      revenueStats,
      consultStats,
      queueRows,
      doctorRows,
      consultationRows,
      billingRows,
      recentActivity
    ] = await Promise.all([
      // 1. Patient stats today
      query(`
        SELECT
          COUNT(*) AS total,
          SUM(status IN ('waiting','checked_in')) AS waiting,
          SUM(status = 'in_consultation') AS in_consultation,
          SUM(status = 'completed') AS completed,
          SUM(checkin_type = 'walk_in') AS walk_in,
          SUM(checkin_type = 'pre_booked') AS pre_booked
        FROM patient_checkins
        WHERE hospital_id = ? AND DATE(checkin_time) = ?
      `, [hid, today]),

      // 2. Doctor stats
      query(`
        SELECT
          COUNT(*) AS total,
          SUM(employment_type = 'full_time') AS full_time,
          SUM(employment_type = 'visiting_consultant') AS visiting,
          SUM(employment_type = 'locum') AS locum,
          SUM(is_active = 1) AS active
        FROM hospital_doctors
        WHERE hospital_id = ? AND is_active = 1
      `, [hid]),

      // 3. Revenue today
      query(`
        SELECT
          COALESCE(SUM(total), 0) AS total_revenue,
          COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) AS collected,
          COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN total ELSE 0 END), 0) AS pending,
          COUNT(*) AS bill_count
        FROM hospital_billing
        WHERE hospital_id = ? AND DATE(created_at) = ?
      `, [hid, today]),

      // 4. External consultation stats
      query(`
        SELECT
          COUNT(*) AS total,
          SUM(status = 'pending') AS pending,
          SUM(status = 'accepted') AS accepted,
          SUM(status = 'completed') AS completed
        FROM consultation_requests
        WHERE requesting_hospital_id = ? AND DATE(created_at) >= DATE_SUB(?, INTERVAL 7 DAY)
      `, [hid, today]),

      // 5. Live queue (top 8)
      query(`
        SELECT pc.id, pc.queue_number, pc.status, pc.priority, pc.checkin_type, pc.department,
               pc.checkin_time,
               p.firstname, p.lastname
        FROM patient_checkins pc
        JOIN patients p ON pc.patient_id = p.patient_id
        WHERE pc.hospital_id = ? AND DATE(pc.checkin_time) = ?
          AND pc.status NOT IN ('completed', 'no_show', 'cancelled')
        ORDER BY
          FIELD(pc.priority, 'emergency', 'priority', 'normal'),
          pc.queue_number ASC
        LIMIT 8
      `, [hid, today]),

      // 6. Doctor overview (active doctors with details)
      query(`
        SELECT hd.employment_type, hd.is_active,
               d.first_name, d.last_name, d.specialty, d.profile_image_url, d.doctor_id
        FROM hospital_doctors hd
        JOIN doctors d ON hd.doctor_id = d.doctor_id
        WHERE hd.hospital_id = ? AND hd.is_active = 1
        ORDER BY hd.employment_type ASC
        LIMIT 8
      `, [hid]),

      // 7. Recent consultation requests
      query(`
        SELECT cr.id, cr.status, cr.urgency, cr.request_type, cr.reason, cr.created_at,
               cr.meeting_link, cr.preferred_date, cr.preferred_time,
               d.first_name AS doc_first, d.last_name AS doc_last, d.specialty,
               p.firstname AS pat_first, p.lastname AS pat_last
        FROM consultation_requests cr
        JOIN doctors d ON cr.doctor_id = d.doctor_id
        JOIN patients p ON cr.patient_id = p.patient_id
        WHERE cr.requesting_hospital_id = ?
        ORDER BY cr.created_at DESC
        LIMIT 4
      `, [hid]),

      // 8. Recent billing
      query(`
        SELECT hb.id, hb.description, hb.total, hb.payment_status, hb.billing_type,
               hb.created_at,
               p.firstname, p.lastname
        FROM hospital_billing hb
        JOIN patients p ON hb.patient_id = p.patient_id
        WHERE hb.hospital_id = ?
        ORDER BY hb.created_at DESC
        LIMIT 6
      `, [hid]),

      // 9. Recent activity feed
      query(`
        (SELECT 'checkin' AS type, CONCAT(p.firstname, ' ', p.lastname) AS title,
                CONCAT(pc.checkin_type, ' - ', pc.department) AS detail,
                pc.created_at AS time
         FROM patient_checkins pc
         JOIN patients p ON pc.patient_id = p.patient_id
         WHERE pc.hospital_id = ? ORDER BY pc.created_at DESC LIMIT 3)
        UNION ALL
        (SELECT 'billing' AS type, CONCAT(p.firstname, ' ', p.lastname) AS title,
                CONCAT(hb.description, ' - ₦', FORMAT(hb.total, 0)) AS detail,
                hb.created_at AS time
         FROM hospital_billing hb
         JOIN patients p ON hb.patient_id = p.patient_id
         WHERE hb.hospital_id = ? ORDER BY hb.created_at DESC LIMIT 3)
        UNION ALL
        (SELECT 'emr' AS type, CONCAT(p.firstname, ' ', p.lastname) AS title,
                CONCAT(e.entry_type, ': ', e.title) AS detail,
                e.created_at AS time
         FROM emr_entries e
         JOIN patients p ON e.patient_id = p.patient_id
         WHERE e.hospital_id = ? ORDER BY e.created_at DESC LIMIT 3)
        ORDER BY time DESC LIMIT 8
      `, [hid, hid, hid])
    ]);

    // Get hospital info
    const hospitalInfo = await query(`
      SELECT hs.first_name, hs.last_name, hs.role, hs.hospital_id
      FROM hospital_staff hs WHERE hs.id = ?
    `, [req.staffId]);

    // Count waiting patients for sidebar badge
    const waitingCount = patientStats[0]?.waiting || 0;

    res.render('hospital/dashboard', {
      todayStr,
      patients: patientStats[0] || {},
      doctors_stats: doctorStats[0] || {},
      revenue: revenueStats[0] || {},
      consults: consultStats[0] || {},
      queue: queueRows || [],
      doctors_list: doctorRows || [],
      consultations: consultationRows || [],
      billing: billingRows || [],
      activity: recentActivity || [],
      hospital: hospitalInfo[0] || { first_name: 'Admin', role: 'admin' },
      queue_waiting: waitingCount,
      // Helper functions
      formatNaira,
      timeAgo,
      statusLabel,
      statusClass
    });
  } catch (err) {
    console.error('Dashboard data error:', err);
    res.status(500).send('<div class="error-message"><h2>Failed to load dashboard</h2><p>' + err.message + '</p></div>');
  }
});

// ==========================================
// GET /api/hospital/dashboard/profile
// Lightweight endpoint for header profile info
// ==========================================
router.get('/profile', requireHospitalAuth, async (req, res) => {
  try {
    const rows = await query(`
      SELECT first_name, last_name, role FROM hospital_staff WHERE id = ?
    `, [req.staffId]);
    const staff = rows[0] || { first_name: 'Admin', role: 'admin' };
    res.json({ success: true, first_name: staff.first_name, last_name: staff.last_name, role: staff.role });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
});

module.exports = router;
