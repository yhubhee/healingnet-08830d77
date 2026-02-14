const express = require('express');
const router = express.Router();
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');
const { query, queryOne } = require('../../config/database');

// GET /api/hospital/billing - List bills
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { status, type, from, to, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT hb.*, p.first_name AS patient_first_name, p.last_name AS patient_last_name
      FROM hospital_billing hb
      JOIN patients p ON hb.patient_id = p.id
      WHERE hb.hospital_id = ?
    `;
    const params = [req.hospitalId];

    if (status) { sql += ' AND hb.payment_status = ?'; params.push(status); }
    if (type) { sql += ' AND hb.billing_type = ?'; params.push(type); }
    if (from) { sql += ' AND hb.created_at >= ?'; params.push(from); }
    if (to) { sql += ' AND hb.created_at <= ?'; params.push(to + ' 23:59:59'); }

    sql += ' ORDER BY hb.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const bills = await query(sql, params);

    // Totals
    let totalSql = `
      SELECT 
        COUNT(*) AS total_count,
        COALESCE(SUM(total), 0) AS total_billed,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN total ELSE 0 END), 0) AS total_pending
      FROM hospital_billing WHERE hospital_id = ?
    `;
    const totalParams = [req.hospitalId];
    if (from) { totalSql += ' AND created_at >= ?'; totalParams.push(from); }
    if (to) { totalSql += ' AND created_at <= ?'; totalParams.push(to + ' 23:59:59'); }

    const [totals] = await query(totalSql, totalParams);

    res.json({ success: true, bills, totals, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Billing error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/hospital/billing - Create bill
router.post('/', requireHospitalAuth, async (req, res) => {
  try {
    const { patient_id, appointment_id, consultation_request_id, checkin_id, billing_type, description, amount, discount, tax, payment_method, insurance_provider, insurance_policy_number } = req.body;

    if (!patient_id || !billing_type || !amount) {
      return res.status(400).json({ success: false, message: 'Patient, billing type, and amount required.' });
    }

    const total = parseFloat(amount) - parseFloat(discount || 0) + parseFloat(tax || 0);

    const result = await query(
      `INSERT INTO hospital_billing 
       (hospital_id, patient_id, appointment_id, consultation_request_id, checkin_id, billing_type, description, amount, discount, tax, total, payment_method, insurance_provider, insurance_policy_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.hospitalId, patient_id, appointment_id || null, consultation_request_id || null, checkin_id || null, billing_type, description || null, amount, discount || 0, tax || 0, total, payment_method || 'cash', insurance_provider || null, insurance_policy_number || null]
    );

    res.status(201).json({ success: true, bill_id: result.insertId, total, message: 'Bill created.' });
  } catch (err) {
    console.error('Create bill error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/hospital/billing/:id/pay - Mark as paid
router.put('/:id/pay', requireHospitalAuth, async (req, res) => {
  try {
    const { payment_method } = req.body;
    await query(
      "UPDATE hospital_billing SET payment_status = 'paid', payment_method = ?, paid_at = NOW() WHERE id = ? AND hospital_id = ?",
      [payment_method || 'cash', req.params.id, req.hospitalId]
    );
    res.json({ success: true, message: 'Bill marked as paid.' });
  } catch (err) {
    console.error('Pay bill error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
