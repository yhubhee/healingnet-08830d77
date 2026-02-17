const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../../config/database');
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');

// GET /hospital/notifications - Render EJS
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { type, status, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;

    // Check if JSON is requested (for header notifications)
    const wantsJson = req.query.limit && req.query.status;

    let sql = 'SELECT * FROM hospital_notifications WHERE hospital_id = ?';
    const params = [req.hospitalId];
    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (status === 'unread') sql += ' AND is_read = FALSE';

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) AS total');
    const unreadSql = 'SELECT COUNT(*) AS count FROM hospital_notifications WHERE hospital_id = ? AND is_read = FALSE';

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [notifications, countRows, unreadRows] = await Promise.all([
      query(sql, params),
      query(countSql, params.slice(0, -2)),
      query(unreadSql, [req.hospitalId])
    ]);

    const total = countRows[0]?.total || 0;
    const unread_count = unreadRows[0]?.count || 0;

    // If request comes from header (wants JSON), return JSON
    if (wantsJson || req.xhr || req.headers.accept?.includes('application/json')) {
      const typeCounts = await query('SELECT type, COUNT(*) AS count FROM hospital_notifications WHERE hospital_id = ? GROUP BY type', [req.hospitalId]);
      return res.json({
        success: true, notifications, unread_count, total,
        type_counts: typeCounts.reduce((acc, r) => { acc[r.type] = r.count; return acc; }, {}),
        page: parseInt(page), limit: parseInt(limit)
      });
    }

    // Otherwise render EJS
    res.render('hospital/notifications', { notifications, unread_count, total });
  } catch (err) {
    console.error('Get hospital notifications error:', err);
    res.status(500).send('<div class="error-message"><h2>Failed to load notifications</h2><p>' + err.message + '</p></div>');
  }
});

// PUT /hospital/notifications/read-all
router.put('/read-all', requireHospitalAuth, async (req, res) => {
  try {
    await query('UPDATE hospital_notifications SET is_read = TRUE WHERE hospital_id = ? AND is_read = FALSE', [req.hospitalId]);
    res.json({ success: true, message: 'All marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /hospital/notifications/:id/read
router.put('/:id/read', requireHospitalAuth, async (req, res) => {
  try {
    await query('UPDATE hospital_notifications SET is_read = TRUE WHERE id = ? AND hospital_id = ?', [req.params.id, req.hospitalId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /hospital/notifications/clear-read
router.delete('/clear-read', requireHospitalAuth, async (req, res) => {
  try {
    await query('DELETE FROM hospital_notifications WHERE hospital_id = ? AND is_read = TRUE', [req.hospitalId]);
    res.json({ success: true, message: 'Cleared.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /hospital/notifications/:id
router.delete('/:id', requireHospitalAuth, async (req, res) => {
  try {
    await query('DELETE FROM hospital_notifications WHERE id = ? AND hospital_id = ?', [req.params.id, req.hospitalId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
