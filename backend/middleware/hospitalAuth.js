// Hospital staff session-based auth middleware

const requireHospitalAuth = (req, res, next) => {
  if (!req.session || !req.session.hospital_staff_id) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Hospital staff login required.' });
  }
  req.staffId = req.session.hospital_staff_id;
  req.hospitalId = req.session.hospital_id;
  req.staffRole = req.session.staff_role;
  next();
};

const requireHospitalAdmin = (req, res, next) => {
  if (!req.session || !req.session.hospital_staff_id) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }
  if (!['admin', 'manager'].includes(req.session.staff_role)) {
    return res.status(403).json({ success: false, message: 'Admin or manager access required.' });
  }
  req.staffId = req.session.hospital_staff_id;
  req.hospitalId = req.session.hospital_id;
  req.staffRole = req.session.staff_role;
  next();
};

module.exports = { requireHospitalAuth, requireHospitalAdmin };
