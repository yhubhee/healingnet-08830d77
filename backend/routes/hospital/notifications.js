const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../../config/database');
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');

// ==========================================
// GET /api/hospital/notifications — List notifications
// ==========================================
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { type, status, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM hospital_notifications WHERE hospital_id = ?';
    const params = [req.hospitalId];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (status === 'unread') {
      sql += ' AND is_read = FALSE';
    }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) AS total');
    const unreadSql = 'SELECT COUNT(*) AS count FROM hospital_notifications WHERE hospital_id = ? AND is_read = FALSE';

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [notifications, [{ total }], [{ count: unread_count }]] = await Promise.all([
      query(sql, params),
      query(countSql, params.slice(0, -2)),
      query(unreadSql, [req.hospitalId])
    ]);

    const typeCounts = await query(
      'SELECT type, COUNT(*) AS count FROM hospital_notifications WHERE hospital_id = ? GROUP BY type',
      [req.hospitalId]
    );

    res.json({
      success: true,
      notifications,
      unread_count: unread_count,
      total,
      type_counts: typeCounts.reduce((acc, r) => { acc[r.type] = r.count; return acc; }, {}),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Get hospital notifications error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// PUT /api/hospital/notifications/read-all — Mark all as read (before /:id)
// ==========================================
router.put('/read-all', requireHospitalAuth, async (req, res) => {
  try {
    await query(
      'UPDATE hospital_notifications SET is_read = TRUE WHERE hospital_id = ? AND is_read = FALSE',
      [req.hospitalId]
    );
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// PUT /api/hospital/notifications/:id/read — Mark single as read
// ==========================================
router.put('/:id/read', requireHospitalAuth, async (req, res) => {
  try {
    await query(
      'UPDATE hospital_notifications SET is_read = TRUE WHERE id = ? AND hospital_id = ?',
      [req.params.id, req.hospitalId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// DELETE /api/hospital/notifications/clear-read — Clear all read (before /:id)
// ==========================================
router.delete('/clear-read', requireHospitalAuth, async (req, res) => {
  try {
    await query(
      'DELETE FROM hospital_notifications WHERE hospital_id = ? AND is_read = TRUE',
      [req.hospitalId]
    );
    res.json({ success: true, message: 'Read notifications cleared.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// DELETE /api/hospital/notifications/:id — Delete notification
// ==========================================
router.delete('/:id', requireHospitalAuth, async (req, res) => {
  try {
    await query(
      'DELETE FROM hospital_notifications WHERE id = ? AND hospital_id = ?',
      [req.params.id, req.hospitalId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
