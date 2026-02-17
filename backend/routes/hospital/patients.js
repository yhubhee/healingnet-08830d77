const express = require('express');
const router = express.Router();
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');
const { query, queryOne } = require('../../config/database');

// GET /hospital/patients - Render patients list EJS
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { search, status, plan, insurance, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT DISTINCT p.patient_id, p.firstname, p.lastname, p.email, p.phone,
             p.date_of_birth, p.gender, p.blood_type, p.genotype, p.profile_img,
             p.insurance_provider, p.insurance_number, p.organization_id, p.status,
             p.medical_conditions, p.allergies, p.address, p.national_id,
             p.emergency_contact_name, p.emergency_contact_phone
      FROM patients p
      LEFT JOIN patient_checkins pc ON p.patient_id = pc.patient_id AND pc.hospital_id = ?
      LEFT JOIN appointments a ON p.patient_id = a.patient_id
      WHERE (pc.hospital_id = ? OR a.doctor_id IN (SELECT doctor_id FROM hospital_doctors WHERE hospital_id = ?))
    `;
    const params = [req.hospitalId, req.hospitalId, req.hospitalId];

    if (search) {
      sql += ' AND (p.firstname LIKE ? OR p.lastname LIKE ? OR p.email LIKE ? OR p.phone LIKE ? OR p.national_id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }
    if (status) { sql += ' AND p.status = ?'; params.push(status); }
    if (insurance === 'none') sql += ' AND (p.insurance_provider IS NULL OR p.insurance_provider = "")';
    else if (insurance) { sql += ' AND p.insurance_provider LIKE ?'; params.push(`%${insurance}%`); }
    if (plan === 'individual') sql += ' AND (p.organization_id IS NULL OR p.organization_id = 0)';
    else if (plan === 'organization' || plan === 'family') sql += ' AND p.organization_id IS NOT NULL AND p.organization_id > 0';

    sql += ' ORDER BY p.lastname ASC, p.firstname ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const patients = await query(sql, params);

    const [stats] = await query(`
      SELECT 
        COUNT(DISTINCT p.patient_id) AS total,
        SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN p.organization_id IS NOT NULL AND p.organization_id > 0 THEN 1 ELSE 0 END) AS under_org,
        SUM(CASE WHEN p.insurance_provider IS NOT NULL AND p.insurance_provider != '' THEN 1 ELSE 0 END) AS insured
      FROM patients p
      LEFT JOIN patient_checkins pc ON p.patient_id = pc.patient_id AND pc.hospital_id = ?
      WHERE pc.hospital_id = ?
    `, [req.hospitalId, req.hospitalId]);

    res.render('hospital/patients', { patients, stats: stats || {} });
  } catch (err) {
    console.error('Patients list error:', err);
    res.status(500).send('<div class="error-message"><h2>Failed to load patients</h2><p>' + err.message + '</p></div>');
  }
});

// GET /hospital/patients/api/search - JSON search for header
router.get('/api/search', requireHospitalAuth, async (req, res) => {
  try {
    const { search, limit = 5 } = req.query;
    let sql = `
      SELECT DISTINCT p.patient_id, p.firstname, p.lastname, p.email, p.phone
      FROM patients p
      JOIN patient_checkins pc ON p.patient_id = pc.patient_id
      WHERE pc.hospital_id = ?
    `;
    const params = [req.hospitalId];
    if (search) {
      sql += ' AND (p.firstname LIKE ? OR p.lastname LIKE ? OR p.email LIKE ? OR p.phone LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    sql += ' LIMIT ?';
    params.push(parseInt(limit));
    const patients = await query(sql, params);
    res.json({ success: true, patients });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /hospital/patients/:id - Render patient detail EJS
router.get('/:id', requireHospitalAuth, async (req, res) => {
  try {
    const patient = await queryOne('SELECT * FROM patients WHERE patient_id = ?', [req.params.id]);
    if (!patient) return res.status(404).send('<div class="error-message"><h2>Patient not found</h2></div>');
    delete patient.password;

    const [appointments, prescriptions, emrEntries, labResults, billingHistory, referrals, insuranceClaims] = await Promise.all([
      query(`SELECT a.*, CONCAT(d.first_name, ' ', d.last_name) AS doctor_name, d.specialty
             FROM appointments a JOIN doctors d ON a.doctor_id = d.doctor_id
             WHERE a.patient_id = ? ORDER BY a.appointment_date DESC LIMIT 20`, [req.params.id]),
      query(`SELECT pr.*, CONCAT(d.first_name, ' ', d.last_name) AS doctor_name, d.specialty
             FROM prescriptions pr JOIN doctors d ON pr.doctor_id = d.doctor_id
             WHERE pr.patient_id = ? ORDER BY pr.created_at DESC LIMIT 20`, [req.params.id]),
      query(`SELECT e.*, CONCAT(d.first_name, ' ', d.last_name) AS doctor_name
             FROM emr_entries e LEFT JOIN doctors d ON e.doctor_id = d.doctor_id
             WHERE e.patient_id = ? ORDER BY e.created_at DESC LIMIT 20`, [req.params.id]),
      query(`SELECT h.*, CONCAT(d.first_name, ' ', d.last_name) AS doctor_name
             FROM lab_result_headers h LEFT JOIN doctors d ON h.ordered_by = d.doctor_id
             WHERE h.patient_id = ? ORDER BY h.reported_at DESC LIMIT 20`, [req.params.id]),
      query(`SELECT hb.* FROM hospital_billing hb
             WHERE hb.patient_id = ? AND hb.hospital_id = ? ORDER BY hb.created_at DESC LIMIT 20`,
        [req.params.id, req.hospitalId]),
      query(`SELECT hr.*, CONCAT(d1.first_name, ' ', d1.last_name) AS referring_doctor,
                    CONCAT(d2.first_name, ' ', d2.last_name) AS referred_to_doctor
             FROM hospital_referrals hr
             LEFT JOIN doctors d1 ON hr.referring_doctor_id = d1.doctor_id
             LEFT JOIN doctors d2 ON hr.referred_to_doctor_id = d2.doctor_id
             WHERE hr.patient_id = ? ORDER BY hr.created_at DESC`, [req.params.id]),
      query(`SELECT ic.* FROM insurance_claims ic
             WHERE ic.patient_id = ? AND ic.hospital_id = ? ORDER BY ic.created_at DESC`, [req.params.id, req.hospitalId]),
    ]);

    res.render('hospital/patient-detail', {
      patient, appointments, prescriptions, emr_entries: emrEntries,
      lab_results: labResults, billing: billingHistory, referrals, insurance_claims: insuranceClaims
    });
  } catch (err) {
    console.error('Patient details error:', err);
    res.status(500).send('<div class="error-message"><h2>Failed to load patient</h2><p>' + err.message + '</p></div>');
  }
});

// POST /hospital/patients
router.post('/', requireHospitalAuth, async (req, res) => {
  try {
    const { firstname, lastname, phone, email, gender, date_of_birth, blood_type, genotype,
      national_id, address, insurance_provider, insurance_number, organization_id,
      emergency_contact_name, emergency_contact_phone, medical_conditions, allergies, password } = req.body;

    if (!firstname || !lastname || !email) return res.status(400).json({ success: false, message: 'First name, last name, and email required.' });

    const existing = await queryOne('SELECT patient_id FROM patients WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ success: false, message: 'Email already registered.' });

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password || 'healingnet123', 12);

    const result = await query(
      `INSERT INTO patients (firstname, lastname, phone, email, gender, date_of_birth, blood_type, genotype,
       national_id, address, insurance_provider, insurance_number, organization_id,
       emergency_contact_name, emergency_contact_phone, medical_conditions, allergies, password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [firstname, lastname, phone || null, email, gender || null, date_of_birth || null,
       blood_type || null, genotype || null, national_id || null, address || null,
       insurance_provider || null, insurance_number || null, organization_id || null,
       emergency_contact_name || null, emergency_contact_phone || null,
       medical_conditions || null, allergies || null, hashedPassword]
    );

    res.status(201).json({ success: true, patient_id: result.insertId, message: 'Patient registered.' });
  } catch (err) {
    console.error('Register patient error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;