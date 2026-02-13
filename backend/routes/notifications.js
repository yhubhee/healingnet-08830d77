const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { query, queryOne } = require('../config/database');

// GET /api/notifications - Get patient notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const { type, unread_only, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM notifications WHERE patient_id = ?';
    const params = [req.patientId];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (unread_only === 'true') {
      sql += ' AND is_read = FALSE';
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const notifications = await query(sql, params);

    // Unread count
    const [{ count }] = await query(
      'SELECT COUNT(*) AS count FROM notifications WHERE patient_id = ? AND is_read = FALSE',
      [req.patientId]
    );

    res.json({ success: true, notifications, unread_count: count });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/notifications/:id/read - Mark as read
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND patient_id = ?',
      [req.params.id, req.patientId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE patient_id = ? AND is_read = FALSE',
      [req.patientId]
    );
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/notifications/:id - Dismiss notification
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await query(
      'DELETE FROM notifications WHERE id = ? AND patient_id = ?',
      [req.params.id, req.patientId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
