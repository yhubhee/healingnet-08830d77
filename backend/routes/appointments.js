const express = require('express');
const router = express.Router();
const { requireAuth, requireDoctor } = require('../middleware/auth');
const { query, queryOne } = require('../config/database');

// ==========================================
// GET /api/appointments/doctors - Find doctors (post-triage)
// Supports: specialty filter, virtual/in_person, proximity sort
// ==========================================
router.get('/doctors', requireAuth, async (req, res) => {
  try {
    const { specialty, type, lat, lng, limit = 20 } = req.query;

    let sql = `
      SELECT d.*, h.name AS hospital_name, h.address AS hospital_address,
             h.city AS hospital_city, h.latitude AS hospital_lat, h.longitude AS hospital_lng
    `;

    // If patient coords provided, calculate distance (Haversine)
    if (lat && lng) {
      sql += `,
        (6371 * ACOS(
          COS(RADIANS(?)) * COS(RADIANS(h.latitude)) *
          COS(RADIANS(h.longitude) - RADIANS(?)) +
          SIN(RADIANS(?)) * SIN(RADIANS(h.latitude))
        )) AS distance_km
      `;
    }

    sql += ' FROM doctors d LEFT JOIN hospitals h ON d.hospital_id = h.id WHERE d.is_available = TRUE';

    const params = [];
    if (lat && lng) {
      params.push(parseFloat(lat), parseFloat(lng), parseFloat(lat));
    }

    if (specialty) {
      sql += ' AND (d.specialty = ? OR d.sub_specialty = ?)';
      params.push(specialty, specialty);
    }

    if (type === 'virtual') {
      sql += ' AND d.accepts_virtual = TRUE';
    } else if (type === 'in_person') {
      sql += ' AND d.accepts_in_person = TRUE';
    }

    // Sort: in-person → closest first, virtual → rating first
    if (type === 'in_person' && lat && lng) {
      sql += ' ORDER BY distance_km ASC';
    } else {
      sql += ' ORDER BY d.rating DESC, d.total_reviews DESC';
    }

    sql += ' LIMIT ?';
    params.push(parseInt(limit));

    const doctors = await query(sql, params);

    res.json({ success: true, doctors });
  } catch (err) {
    console.error('Find doctors error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// GET /api/appointments/doctors/:id/slots - Available time slots
// ==========================================
router.get('/doctors/:id/slots', requireAuth, async (req, res) => {
  try {
    const { date } = req.query;
    const doctorId = req.params.id;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required (YYYY-MM-DD).' });
    }

    const dayOfWeek = new Date(date).getDay();

    // Get doctor's availability for this day
    const availability = await query(
      'SELECT * FROM doctor_availability WHERE doctor_id = ? AND day_of_week = ? AND is_active = TRUE',
      [doctorId, dayOfWeek]
    );

    if (availability.length === 0) {
      return res.json({ success: true, slots: [], message: 'Doctor not available on this day.' });
    }

    // Get existing appointments for this date
    const booked = await query(
      `SELECT appointment_time FROM appointments 
       WHERE doctor_id = ? AND appointment_date = ? AND status NOT IN ('cancelled', 'rejected')`,
      [doctorId, date]
    );
    const bookedTimes = new Set(booked.map(a => a.appointment_time.substring(0, 5)));

    // Generate available slots
    const slots = [];
    for (const avail of availability) {
      const start = timeToMinutes(avail.start_time);
      const end = timeToMinutes(avail.end_time);
      const duration = avail.slot_duration;

      for (let t = start; t + duration <= end; t += duration) {
        const timeStr = minutesToTime(t);
        if (!bookedTimes.has(timeStr)) {
          slots.push({
            time: timeStr,
            available: true,
          });
        }
      }
    }

    res.json({ success: true, slots });
  } catch (err) {
    console.error('Slots error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// POST /api/appointments/book - Book an appointment
// ==========================================
router.post('/book', requireAuth, async (req, res) => {
  try {
    const { doctor_id, triage_session_id, appointment_type, appointment_date, appointment_time, reason } = req.body;

    if (!doctor_id || !appointment_type || !appointment_date || !appointment_time) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // Check doctor exists
    const doctor = await queryOne('SELECT * FROM doctors WHERE id = ?', [doctor_id]);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    // Check slot availability
    const existing = await queryOne(
      `SELECT id FROM appointments 
       WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? 
       AND status NOT IN ('cancelled', 'rejected')`,
      [doctor_id, appointment_date, appointment_time]
    );
    if (existing) {
      return res.status(409).json({ success: false, message: 'This time slot is already booked.' });
    }

    // Calculate end time (default 30 min)
    const startMin = timeToMinutes(appointment_time);
    const endTime = minutesToTime(startMin + 30);

    const result = await query(
      `INSERT INTO appointments 
       (patient_id, doctor_id, triage_session_id, appointment_type, appointment_date, appointment_time, end_time, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [req.patientId, doctor_id, triage_session_id || null, appointment_type, appointment_date, appointment_time, endTime, reason || null]
    );

    // Create notification for doctor
    await query(
      `INSERT INTO notifications (doctor_id, type, title, message) 
       VALUES (?, 'appointment', 'New Appointment Request', ?)`,
      [doctor_id, `A patient has booked a ${appointment_type} appointment on ${appointment_date} at ${appointment_time}.`]
    );

    // Create notification for patient
    await query(
      `INSERT INTO notifications (patient_id, type, title, message) 
       VALUES (?, 'appointment', 'Appointment Booked', ?)`,
      [req.patientId, `Your ${appointment_type} appointment with Dr. ${doctor.last_name} on ${appointment_date} at ${appointment_time} is pending confirmation.`]
    );

    res.status(201).json({
      success: true,
      appointment_id: result.insertId,
      message: 'Appointment booked successfully. Awaiting doctor confirmation.',
    });
  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// GET /api/appointments - Patient's appointments
// ==========================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT a.*, 
             d.first_name AS doctor_first_name, d.last_name AS doctor_last_name,
             d.specialty, d.profile_image AS doctor_image,
             h.name AS hospital_name
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN hospitals h ON d.hospital_id = h.id
      WHERE a.patient_id = ?
    `;
    const params = [req.patientId];

    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const appointments = await query(sql, params);

    // Total count
    let countSql = 'SELECT COUNT(*) AS total FROM appointments WHERE patient_id = ?';
    const countParams = [req.patientId];
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    const [{ total }] = await query(countSql, countParams);

    res.json({ success: true, appointments, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Get appointments error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// GET /api/appointments/:id - Single appointment
// ==========================================
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const appointment = await queryOne(
      `SELECT a.*, 
              d.first_name AS doctor_first_name, d.last_name AS doctor_last_name,
              d.specialty, d.profile_image AS doctor_image, d.consultation_fee, d.virtual_fee,
              h.name AS hospital_name, h.address AS hospital_address,
              t.ai_summary, t.ai_urgency, t.symptoms AS triage_symptoms
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       LEFT JOIN hospitals h ON d.hospital_id = h.id
       LEFT JOIN triage_sessions t ON a.triage_session_id = t.id
       WHERE a.id = ? AND a.patient_id = ?`,
      [req.params.id, req.patientId]
    );

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    res.json({ success: true, appointment });
  } catch (err) {
    console.error('Get appointment error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// PUT /api/appointments/:id/cancel - Cancel appointment
// ==========================================
router.put('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const appointment = await queryOne(
      "SELECT * FROM appointments WHERE id = ? AND patient_id = ? AND status IN ('pending', 'accepted')",
      [req.params.id, req.patientId]
    );

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found or cannot be cancelled.' });
    }

    await query(
      "UPDATE appointments SET status = 'cancelled', cancellation_reason = ? WHERE id = ?",
      [reason || null, req.params.id]
    );

    // Notify doctor
    await query(
      `INSERT INTO notifications (doctor_id, type, title, message)
       VALUES (?, 'appointment', 'Appointment Cancelled', ?)`,
      [appointment.doctor_id, `Patient cancelled their appointment on ${appointment.appointment_date}.`]
    );

    res.json({ success: true, message: 'Appointment cancelled.' });
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// PUT /api/appointments/:id/status - Doctor updates status
// ==========================================
router.put('/:id/status', requireDoctor, async (req, res) => {
  try {
    const { status, meeting_link, notes } = req.body;
    const validStatuses = ['accepted', 'rejected', 'completed', 'no_show'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const appointment = await queryOne(
      'SELECT * FROM appointments WHERE id = ? AND doctor_id = ?',
      [req.params.id, req.doctorId]
    );

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const updates = ['status = ?'];
    const params = [status];

    if (meeting_link) {
      updates.push('meeting_link = ?');
      params.push(meeting_link);
    }
    if (notes) {
      updates.push('notes = ?');
      params.push(notes);
    }

    params.push(req.params.id);
    await query(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`, params);

    // Notify patient
    const statusMessages = {
      accepted: 'Your appointment has been confirmed!',
      rejected: 'Your appointment request was declined.',
      completed: 'Your appointment has been marked as completed.',
    };
    if (statusMessages[status]) {
      await query(
        `INSERT INTO notifications (patient_id, type, title, message)
         VALUES (?, 'appointment', ?, ?)`,
        [appointment.patient_id, `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}`, statusMessages[status]]
      );
    }

    res.json({ success: true, message: `Appointment ${status}.` });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// Helpers
// ==========================================
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

module.exports = router;
