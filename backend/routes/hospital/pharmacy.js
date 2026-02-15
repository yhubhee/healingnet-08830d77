const express = require('express');
const router = express.Router();
const { requireHospitalAuth } = require('../../middleware/hospitalAuth');
const { query } = require('../../config/database');

// GET /api/hospital/pharmacy - Pending prescriptions & dispensing
router.get('/', requireHospitalAuth, async (req, res) => {
  try {
    const { tab } = req.query; // pending, dispensed, inventory, low_stock

    // Pending prescriptions (from patients checked in at this hospital)
    const prescriptions = await query(`
      SELECT pr.*, CONCAT(p.firstname, ' ', p.lastname) AS patient_name,
             CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
             pd.id AS dispensing_id, pd.payment_status AS dispense_payment_status,
             pd.dispensed_at
      FROM prescriptions pr
      JOIN patients p ON pr.patient_id = p.patient_id
      JOIN doctors d ON pr.doctor_id = d.doctor_id
      LEFT JOIN pharmacy_dispensing pd ON pd.prescription_id = pr.prescription_id AND pd.hospital_id = ?
      WHERE pr.patient_id IN (
        SELECT DISTINCT patient_id FROM patient_checkins WHERE hospital_id = ?
      )
      ORDER BY pr.created_at DESC LIMIT 50
    `, [req.hospitalId, req.hospitalId]);

    // Inventory
    const inventory = await query(`
      SELECT * FROM pharmacy_inventory WHERE hospital_id = ? ORDER BY drug_name ASC
    `, [req.hospitalId]);

    // Low stock
    const lowStock = inventory.filter(i => i.quantity_in_stock <= i.reorder_level);

    const stats = {
      total_prescriptions: prescriptions.length,
      pending: prescriptions.filter(p => !p.dispensing_id).length,
      dispensed: prescriptions.filter(p => p.dispensing_id).length,
      low_stock_count: lowStock.length,
    };

    res.json({ success: true, prescriptions, inventory, low_stock: lowStock, stats });
  } catch (err) {
    console.error('Pharmacy error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/hospital/pharmacy/dispense - Dispense a prescription
router.post('/dispense', requireHospitalAuth, async (req, res) => {
  try {
    const { prescription_id, patient_id, drug_name, dosage, quantity_dispensed, drug_id, payment_status, notes } = req.body;

    if (!patient_id || !drug_name) {
      return res.status(400).json({ success: false, message: 'Patient and drug required.' });
    }

    const result = await query(
      `INSERT INTO pharmacy_dispensing (hospital_id, patient_id, prescription_id, drug_id, drug_name, dosage,
       quantity_dispensed, dispensed_by, payment_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.hospitalId, patient_id, prescription_id || null, drug_id || null, drug_name,
       dosage || null, quantity_dispensed || 1, req.staffId, payment_status || 'pending', notes || null]
    );

    // Update inventory
    if (drug_id && quantity_dispensed) {
      await query('UPDATE pharmacy_inventory SET quantity_in_stock = quantity_in_stock - ? WHERE id = ? AND hospital_id = ?',
        [quantity_dispensed, drug_id, req.hospitalId]);
    }

    res.status(201).json({ success: true, id: result.insertId, message: 'Drug dispensed.' });
  } catch (err) {
    console.error('Dispense error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/hospital/pharmacy/inventory - Add inventory item
router.post('/inventory', requireHospitalAuth, async (req, res) => {
  try {
    const { drug_name, generic_name, category, dosage_form, strength, quantity_in_stock,
            reorder_level, unit_price, supplier, batch_number, expiry_date, location } = req.body;

    if (!drug_name) return res.status(400).json({ success: false, message: 'Drug name required.' });

    const result = await query(
      `INSERT INTO pharmacy_inventory (hospital_id, drug_name, generic_name, category, dosage_form, strength,
       quantity_in_stock, reorder_level, unit_price, supplier, batch_number, expiry_date, location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.hospitalId, drug_name, generic_name || null, category || null, dosage_form || 'tablet',
       strength || null, quantity_in_stock || 0, reorder_level || 50, unit_price || null,
       supplier || null, batch_number || null, expiry_date || null, location || null]
    );

    res.status(201).json({ success: true, id: result.insertId, message: 'Item added.' });
  } catch (err) {
    console.error('Add inventory error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
