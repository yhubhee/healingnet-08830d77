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

// GET /hospital/insurance - Render EJS
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { status, provider } = req.query;
    let sql = `
      SELECT ic.*, CONCAT(p.firstname, ' ', p.lastname) AS patient_name
      FROM insurance_claims ic
      JOIN patients p ON ic.patient_id = p.patient_id
      WHERE ic.hospital_id = ?
    `;
    const params = [req.hospitalId];
    if (status) { sql += ' AND ic.status = ?'; params.push(status); }
    if (provider) { sql += ' AND ic.insurance_provider LIKE ?'; params.push(`%${provider}%`); }
    sql += ' ORDER BY ic.created_at DESC';
    const claims = await query(sql, params);

    const [stats] = await query(`
      SELECT 
        COUNT(DISTINCT p.patient_id) AS insured_patients,
        COALESCE(SUM(CASE WHEN ic.status = 'approved' OR ic.status = 'paid' THEN ic.approved_amount ELSE 0 END), 0) AS approved_total,
        COALESCE(SUM(CASE WHEN ic.status IN ('submitted','under_review') THEN ic.claim_amount ELSE 0 END), 0) AS pending_total,
        COUNT(DISTINCT ic.insurance_provider) AS hmo_partners
      FROM insurance_claims ic
      JOIN patients p ON ic.patient_id = p.patient_id
      WHERE ic.hospital_id = ?
    `, [req.hospitalId]);

    res.render('hospital/insurance', { claims, stats: stats || {}, formatNaira });
  } catch (err) {
    console.error('Insurance error:', err);
    res.status(500).send('<div class="error-message"><h2>Failed to load insurance</h2><p>' + err.message + '</p></div>');
  }
});

// POST /hospital/insurance
router.post('/', requireHospitalAuth, async (req, res) => {
  try {
    const { patient_id, billing_id, insurance_provider, policy_number, claim_amount, service_description, notes } = req.body;
    if (!patient_id || !insurance_provider || !claim_amount) return res.status(400).json({ success: false, message: 'Patient, provider, and amount required.' });
    const result = await query(
      `INSERT INTO insurance_claims (hospital_id, patient_id, billing_id, insurance_provider, policy_number, claim_amount, service_description, claim_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), 'submitted', ?)`,
      [req.hospitalId, patient_id, billing_id || null, insurance_provider, policy_number || null, claim_amount, service_description || null, notes || null]
    );
    res.status(201).json({ success: true, id: result.insertId, message: 'Claim submitted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /hospital/insurance/:id
router.put('/:id', requireHospitalAuth, async (req, res) => {
  try {
    const { status, approved_amount, rejection_reason, notes } = req.body;
    const updates = [];
    const params = [];
    if (status) { updates.push('status = ?'); params.push(status); }
    if (approved_amount !== undefined) { updates.push('approved_amount = ?'); params.push(approved_amount); }
    if (rejection_reason) { updates.push('rejection_reason = ?'); params.push(rejection_reason); }
    if (notes) { updates.push('notes = ?'); params.push(notes); }
    if (status === 'paid') updates.push('paid_date = CURDATE()');
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields.' });
    params.push(req.params.id, req.hospitalId);
    await query(`UPDATE insurance_claims SET ${updates.join(', ')} WHERE id = ? AND hospital_id = ?`, params);
    res.json({ success: true, message: 'Claim updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;