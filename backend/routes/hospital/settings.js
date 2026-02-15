const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../../config/database');
const { requireHospitalAuth, requireHospitalAdmin } = require('../../middleware/hospitalAuth');

// ==========================================
// Hospital Profile
// ==========================================

// GET /api/hospital/settings/profile
router.get('/profile', requireHospitalAuth, async (req, res) => {
  try {
    const hospital = await queryOne('SELECT * FROM hospitals WHERE hospital_id = ?', [req.hospitalId]);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found.' });
    res.json({ success: true, hospital });
  } catch (err) {
    console.error('Get hospital profile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/hospital/settings/profile
router.put('/profile', requireHospitalAdmin, async (req, res) => {
  try {
    const { name, address, phone, email, logo_url, website, operating_hours, description } = req.body;
    await query(
      `UPDATE hospitals SET name=?, address=?, phone=?, email=?, logo_url=?, website=?, operating_hours=?, description=? WHERE hospital_id=?`,
      [name, address, phone, email, logo_url || null, website || null, operating_hours || null, description || null, req.hospitalId]
    );
    res.json({ success: true, message: 'Hospital profile updated.' });
  } catch (err) {
    console.error('Update hospital profile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// Staff Roles
// ==========================================

// GET /api/hospital/settings/staff
router.get('/staff', requireHospitalAuth, async (req, res) => {
  try {
    const staff = await query(
      'SELECT id, first_name, last_name, email, phone, role, department, is_active, created_at FROM hospital_staff WHERE hospital_id = ? ORDER BY created_at DESC',
      [req.hospitalId]
    );
    res.json({ success: true, staff });
  } catch (err) {
    console.error('Get staff error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/hospital/settings/staff
router.post('/staff', requireHospitalAdmin, async (req, res) => {
  try {
    const { first_name, last_name, email, password, phone, role, department } = req.body;
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'First name, last name, email, and password are required.' });
    }
    const existing = await queryOne('SELECT id FROM hospital_staff WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ success: false, message: 'Email already registered.' });

    const password_hash = await bcrypt.hash(password, 10);
    await query(
      'INSERT INTO hospital_staff (hospital_id, first_name, last_name, email, password_hash, phone, role, department) VALUES (?,?,?,?,?,?,?,?)',
      [req.hospitalId, first_name, last_name, email, password_hash, phone || null, role || 'receptionist', department || null]
    );
    res.json({ success: true, message: 'Staff member added.' });
  } catch (err) {
    console.error('Add staff error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/hospital/settings/staff/:id/role
router.put('/staff/:id/role', requireHospitalAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'receptionist', 'nurse', 'lab_tech', 'pharmacist', 'manager', 'medical_officer'];
    if (!validRoles.includes(role)) return res.status(400).json({ success: false, message: 'Invalid role.' });

    await query('UPDATE hospital_staff SET role=? WHERE id=? AND hospital_id=?', [role, req.params.id, req.hospitalId]);
    res.json({ success: true, message: 'Role updated.' });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/hospital/settings/staff/:id/status
router.put('/staff/:id/status', requireHospitalAdmin, async (req, res) => {
  try {
    const { is_active } = req.body;
    await query('UPDATE hospital_staff SET is_active=? WHERE id=? AND hospital_id=?', [is_active ? 1 : 0, req.params.id, req.hospitalId]);
    res.json({ success: true, message: 'Status updated.' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// Departments
// ==========================================

// GET /api/hospital/settings/departments
router.get('/departments', requireHospitalAuth, async (req, res) => {
  try {
    const staffDepts = await query(
      `SELECT department AS name, COUNT(*) AS staff_count FROM hospital_staff WHERE hospital_id=? AND department IS NOT NULL AND department != '' GROUP BY department`,
      [req.hospitalId]
    );
    const doctorDepts = await query(
      `SELECT department AS name, COUNT(*) AS doctor_count FROM hospital_doctors WHERE hospital_id=? AND department IS NOT NULL AND department != '' GROUP BY department`,
      [req.hospitalId]
    );
    // Merge
    const deptMap = {};
    staffDepts.forEach(d => { deptMap[d.name] = { name: d.name, staff_count: d.staff_count, doctor_count: 0 }; });
    doctorDepts.forEach(d => {
      if (deptMap[d.name]) deptMap[d.name].doctor_count = d.doctor_count;
      else deptMap[d.name] = { name: d.name, staff_count: 0, doctor_count: d.doctor_count };
    });
    res.json({ success: true, departments: Object.values(deptMap) });
  } catch (err) {
    console.error('Get departments error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// Notification Preferences
// ==========================================

const DEFAULT_PREFS = [
  { key: 'new_checkin', label: 'New Patient Check-ins' },
  { key: 'appointment_reminder', label: 'Appointment Reminders' },
  { key: 'low_stock', label: 'Low Stock Pharmacy Alerts' },
  { key: 'lab_result', label: 'Lab Result Completion' },
  { key: 'billing_overdue', label: 'Billing Overdue' },
  { key: 'referral_update', label: 'Referral Updates' },
  { key: 'emergency_alert', label: 'Emergency Alerts' },
];

// GET /api/hospital/settings/notifications
router.get('/notifications', requireHospitalAuth, async (req, res) => {
  try {
    const rows = await query('SELECT pref_key, enabled FROM hospital_notification_preferences WHERE hospital_id=?', [req.hospitalId]);
    const prefMap = {};
    rows.forEach(r => { prefMap[r.pref_key] = !!r.enabled; });
    // Fill defaults
    const prefs = DEFAULT_PREFS.map(p => ({ key: p.key, label: p.label, enabled: prefMap[p.key] !== undefined ? prefMap[p.key] : true }));
    res.json({ success: true, preferences: prefs });
  } catch (err) {
    console.error('Get notification prefs error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/hospital/settings/notifications
router.put('/notifications', requireHospitalAdmin, async (req, res) => {
  try {
    const { preferences } = req.body; // [{ key, enabled }]
    if (!Array.isArray(preferences)) return res.status(400).json({ success: false, message: 'Invalid data.' });

    for (const pref of preferences) {
      await query(
        'INSERT INTO hospital_notification_preferences (hospital_id, pref_key, enabled) VALUES (?,?,?) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled)',
        [req.hospitalId, pref.key, pref.enabled ? 1 : 0]
      );
    }
    res.json({ success: true, message: 'Notification preferences updated.' });
  } catch (err) {
    console.error('Update notification prefs error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
