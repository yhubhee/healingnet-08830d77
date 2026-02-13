const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { query, queryOne } = require('../config/database');

// ==========================================
// POST /api/triage/start - Start a triage session
// ==========================================
router.post('/start', requireAuth, async (req, res) => {
  try {
    const { symptoms, additional_notes } = req.body;

    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one symptom is required.' });
    }

    const result = await query(
      `INSERT INTO triage_sessions (patient_id, symptoms, additional_notes, status) 
       VALUES (?, ?, ?, 'in_progress')`,
      [req.patientId, JSON.stringify(symptoms), additional_notes || null]
    );

    res.status(201).json({
      success: true,
      triage_id: result.insertId,
      message: 'Triage session started.',
      next_step: 'assessment',
    });
  } catch (err) {
    console.error('Triage start error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// PUT /api/triage/:id/assess - Submit assessment answers
// ==========================================
router.put('/:id/assess', requireAuth, async (req, res) => {
  try {
    const { severity, duration, medical_history } = req.body;
    const triageId = req.params.id;

    // Verify ownership
    const session = await queryOne(
      'SELECT * FROM triage_sessions WHERE id = ? AND patient_id = ?',
      [triageId, req.patientId]
    );
    if (!session) {
      return res.status(404).json({ success: false, message: 'Triage session not found.' });
    }

    // AI triage logic — determine urgency & recommended specialty
    const symptoms = JSON.parse(session.symptoms);
    const { urgency, specialty, summary } = generateTriageSummary(symptoms, severity, duration, medical_history);

    await query(
      `UPDATE triage_sessions 
       SET severity = ?, duration = ?, medical_history = ?, 
           ai_summary = ?, ai_urgency = ?, ai_recommended_specialty = ?, status = 'completed'
       WHERE id = ?`,
      [severity, duration, JSON.stringify(medical_history || {}), summary, urgency, specialty, triageId]
    );

    res.json({
      success: true,
      triage: {
        id: triageId,
        urgency,
        specialty,
        summary,
        severity,
      },
    });
  } catch (err) {
    console.error('Triage assess error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// GET /api/triage/:id - Get triage session details
// ==========================================
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const session = await queryOne(
      'SELECT * FROM triage_sessions WHERE id = ? AND patient_id = ?',
      [req.params.id, req.patientId]
    );
    if (!session) {
      return res.status(404).json({ success: false, message: 'Triage session not found.' });
    }

    res.json({ success: true, triage: session });
  } catch (err) {
    console.error('Triage get error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// AI Triage Summary Generator (rule-based)
// Replace with actual AI/ML service in production
// ==========================================
function generateTriageSummary(symptoms, severity, duration, medicalHistory) {
  const symptomList = symptoms.map(s => (typeof s === 'string' ? s : s.name || s.label)).join(', ');

  // Specialty mapping
  const specialtyMap = {
    'headache': 'Neurology',
    'migraine': 'Neurology',
    'chest pain': 'Cardiology',
    'heart palpitations': 'Cardiology',
    'breathing difficulty': 'Pulmonology',
    'cough': 'Pulmonology',
    'stomach pain': 'Gastroenterology',
    'nausea': 'Gastroenterology',
    'joint pain': 'Orthopedics',
    'back pain': 'Orthopedics',
    'skin rash': 'Dermatology',
    'fever': 'General Practice',
    'fatigue': 'General Practice',
    'anxiety': 'Psychiatry',
    'depression': 'Psychiatry',
    'eye pain': 'Ophthalmology',
    'blurred vision': 'Ophthalmology',
    'ear pain': 'ENT',
    'sore throat': 'ENT',
    'toothache': 'Dentistry',
  };

  const lowerSymptoms = symptoms.map(s => (typeof s === 'string' ? s : s.name || '').toLowerCase());
  let specialty = 'General Practice';
  for (const symptom of lowerSymptoms) {
    if (specialtyMap[symptom]) {
      specialty = specialtyMap[symptom];
      break;
    }
  }

  // Urgency
  let urgency = 'low';
  if (severity >= 8) urgency = 'urgent';
  else if (severity >= 6) urgency = 'high';
  else if (severity >= 4) urgency = 'moderate';

  const emergencySymptoms = ['chest pain', 'breathing difficulty', 'severe bleeding', 'loss of consciousness'];
  if (lowerSymptoms.some(s => emergencySymptoms.includes(s))) {
    urgency = 'urgent';
  }

  const summary = `Patient reports ${symptomList} with severity ${severity}/10, lasting ${duration || 'unspecified'}. ` +
    `Based on symptoms, a ${specialty} consultation is recommended. Urgency: ${urgency}.` +
    (medicalHistory?.conditions ? ` Pre-existing conditions: ${medicalHistory.conditions}.` : '');

  return { urgency, specialty, summary };
}

module.exports = router;
