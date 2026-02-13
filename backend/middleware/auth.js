// Session-based auth middleware

const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.patient_id) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
  }
  req.patientId = req.session.patient_id;
  next();
};

const requireDoctor = (req, res, next) => {
  if (!req.session || !req.session.doctor_id) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Doctor access required.' });
  }
  req.doctorId = req.session.doctor_id;
  next();
};

module.exports = { requireAuth, requireDoctor };
