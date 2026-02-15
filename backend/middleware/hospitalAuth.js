// Hospital staff JWT-based auth middleware (aligned with patient/doctor JWT pattern)
const { sign, verify } = require('jsonwebtoken');
const { query } = require('../config/database');

// Create hospital staff JWT token
const createHospitalToken = (staff) => {
  const hospitalToken = sign(
    {
      staff_id: staff.id || staff.staff_id,
      hospital_id: staff.hospital_id,
      staff_role: staff.role,
      staff_name: `${staff.first_name} ${staff.last_name}`.trim(),
    },
    process.env.HOSPITAL_JWT_SECRET || 'hospital-jwt-secret-change-me',
    { expiresIn: process.env.HOSPITAL_JWT_EXPIRES_IN || '24h' }
  );
  return hospitalToken;
};

// Validate hospital staff token
const requireHospitalAuth = (req, res, next) => {
  const hospitalToken = req.cookies['hospital-Token'];

  if (!hospitalToken) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Hospital staff login required.' });
  }

  // Check blacklist
  const checkBlacklist = `SELECT * FROM token_blacklist WHERE token = ?`;
  query(checkBlacklist, [hospitalToken])
    .then((result) => {
      if (result && result.length > 0) {
        return res.status(401).json({ success: false, message: 'Session invalidated. Please log in again.' });
      }

      try {
        const decoded = verify(hospitalToken, process.env.HOSPITAL_JWT_SECRET || 'hospital-jwt-secret-change-me');
        req.authenticated = true;
        req.user = decoded;
        req.staffId = decoded.staff_id;
        req.hospitalId = decoded.hospital_id;
        req.staffRole = decoded.staff_role;
        return next();
      } catch (err) {
        console.log('Hospital token verification error:', err.message);
        return res.status(401).json({ success: false, message: 'Invalid token. Please log in again.' });
      }
    })
    .catch((err) => {
      console.error('Token blacklist check error:', err);
      // Continue with verification even if blacklist check fails
      try {
        const decoded = verify(hospitalToken, process.env.HOSPITAL_JWT_SECRET || 'hospital-jwt-secret-change-me');
        req.authenticated = true;
        req.user = decoded;
        req.staffId = decoded.staff_id;
        req.hospitalId = decoded.hospital_id;
        req.staffRole = decoded.staff_role;
        return next();
      } catch (verifyErr) {
        return res.status(401).json({ success: false, message: 'Invalid token.' });
      }
    });
};

// Require admin/manager role
const requireHospitalAdmin = (req, res, next) => {
  const hospitalToken = req.cookies['hospital-Token'];

  if (!hospitalToken) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  try {
    const decoded = verify(hospitalToken, process.env.HOSPITAL_JWT_SECRET || 'hospital-jwt-secret-change-me');
    if (!['admin', 'manager'].includes(decoded.staff_role)) {
      return res.status(403).json({ success: false, message: 'Admin or manager access required.' });
    }
    req.authenticated = true;
    req.user = decoded;
    req.staffId = decoded.staff_id;
    req.hospitalId = decoded.hospital_id;
    req.staffRole = decoded.staff_role;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

module.exports = { createHospitalToken, requireHospitalAuth, requireHospitalAdmin };
