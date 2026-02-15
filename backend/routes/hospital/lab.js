const express = require('express');
const router = express.Router();
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');
const { query } = require('../../config/database');

// GET /api/hospital/lab - Lab orders/results
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT h.*, CONCAT(p.firstname, ' ', p.lastname) AS patient_name,
             CONCAT(d.first_name, ' ', d.last_name) AS ordered_by_name
      FROM lab_result_headers h
      JOIN patients p ON h.patient_id = p.patient_id
      LEFT JOIN doctors d ON h.ordered_by = d.doctor_id
      WHERE h.patient_id IN (
        SELECT DISTINCT patient_id FROM patient_checkins WHERE hospital_id = ?
      )
    `;
    const params = [req.hospitalId];
    if (status) { sql += ' AND h.status = ?'; params.push(status); }
    sql += ' ORDER BY h.created_at DESC LIMIT 50';

    const orders = await query(sql, params);

    // Get test values for each order
    const orderIds = orders.map(o => o.result_id);
    let testValues = [];
    if (orderIds.length > 0) {
      testValues = await query(`
        SELECT v.*, t.test_name, t.sample_type, lc.name AS category_name
        FROM lab_result_values v
        JOIN lab_tests t ON v.test_id = t.test_id
        LEFT JOIN lab_categories lc ON t.category_id = lc.category_id
        WHERE v.result_id IN (${orderIds.map(() => '?').join(',')})
      `, orderIds);
    }

    // Attach tests to orders
    const ordersWithTests = orders.map(order => ({
      ...order,
      tests: testValues.filter(t => t.result_id === order.result_id)
    }));

    const stats = {
      today: orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length,
      pending: orders.filter(o => o.status === 'draft').length,
      in_progress: orders.filter(o => o.status === 'draft').length, // draft = in progress
      completed: orders.filter(o => o.status === 'final').length,
    };

    res.json({ success: true, orders: ordersWithTests, stats });
  } catch (err) {
    console.error('Lab error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/hospital/lab/categories - Lab test categories
router.get('/categories', requireHospitalAuth, async (req, res) => {
  try {
    const categories = await query('SELECT * FROM lab_categories ORDER BY name');
    const tests = await query('SELECT * FROM lab_tests ORDER BY test_name');
    res.json({ success: true, categories, tests });
  } catch (err) {
    console.error('Lab categories error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/hospital/lab/order - Create lab order
router.post('/order', requireHospitalAuth, async (req, res) => {
  try {
    const { patient_id, ordered_by, notes } = req.body;
    if (!patient_id) return res.status(400).json({ success: false, message: 'Patient required.' });

    const result = await query(
      `INSERT INTO lab_result_headers (patient_id, ordered_by, status, notes) VALUES (?, ?, 'draft', ?)`,
      [patient_id, ordered_by || null, notes || null]
    );

    res.status(201).json({ success: true, result_id: result.insertId, message: 'Lab order created.' });
  } catch (err) {
    console.error('Create lab order error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/hospital/lab/results - Submit lab results
router.post('/results', requireHospitalAuth, async (req, res) => {
  try {
    const { result_id, results } = req.body; // results = [{test_id, result_value, unit, flag}]
    if (!result_id || !results || !results.length) {
      return res.status(400).json({ success: false, message: 'Result ID and values required.' });
    }

    for (const r of results) {
      await query(
        `INSERT INTO lab_result_values (result_id, test_id, result_value, unit, flag) VALUES (?, ?, ?, ?, ?)`,
        [result_id, r.test_id, r.result_value, r.unit || null, r.flag || null]
      );
    }

    await query(`UPDATE lab_result_headers SET status = 'final', reported_at = NOW() WHERE result_id = ?`, [result_id]);
    res.json({ success: true, message: 'Results submitted.' });
  } catch (err) {
    console.error('Submit results error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
