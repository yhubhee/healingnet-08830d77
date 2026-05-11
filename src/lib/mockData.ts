// Hardcoded mock data for Patient and Doctor portals

export const mockPatientAppointments = [
  { id: "a1", doctor: "Dr. Adaobi Okonkwo", specialty: "Cardiology", hospital: "Lagos University Teaching Hospital", date: "2026-05-14", time: "10:30", status: "accepted", type: "In-person", reason: "Follow-up: hypertension review" },
  { id: "a2", doctor: "Dr. Tunde Bakare", specialty: "General Practice", hospital: "Reddington Hospital", date: "2026-05-20", time: "14:00", status: "pending", type: "Telemedicine", reason: "Persistent cough for 5 days" },
  { id: "a3", doctor: "Dr. Ngozi Eze", specialty: "Dermatology", hospital: "St. Nicholas Hospital", date: "2026-04-22", time: "09:15", status: "completed", type: "In-person", reason: "Skin rash assessment" },
  { id: "a4", doctor: "Dr. Yusuf Bello", specialty: "Orthopedics", hospital: "National Hospital Abuja", date: "2026-04-01", time: "11:00", status: "completed", type: "In-person", reason: "Knee pain after exercise" },
  { id: "a5", doctor: "Dr. Chioma Nwosu", specialty: "ENT", hospital: "Lagoon Hospitals", date: "2026-03-18", time: "15:30", status: "cancelled", type: "In-person", reason: "Ear infection" },
];

export const mockPatientPrescriptions = [
  { id: "p1", drug: "Amlodipine 10mg", dosage: "1 tablet", frequency: "Once daily", duration: "30 days", refillsLeft: 2, prescribedBy: "Dr. Adaobi Okonkwo", date: "2026-04-22", status: "active", instructions: "Take in the morning with water" },
  { id: "p2", drug: "Metformin 500mg", dosage: "1 tablet", frequency: "Twice daily", duration: "60 days", refillsLeft: 5, prescribedBy: "Dr. Tunde Bakare", date: "2026-04-10", status: "active", instructions: "Take with meals" },
  { id: "p3", drug: "Vitamin D3 1000IU", dosage: "1 capsule", frequency: "Once daily", duration: "90 days", refillsLeft: 0, prescribedBy: "Dr. Ngozi Eze", date: "2026-03-15", status: "active", instructions: "Take with breakfast" },
  { id: "p4", drug: "Amoxicillin 500mg", dosage: "1 capsule", frequency: "Three times daily", duration: "7 days", refillsLeft: 0, prescribedBy: "Dr. Yusuf Bello", date: "2026-02-28", status: "completed", instructions: "Complete full course" },
];

export const mockPatientLabResults = [
  { id: "l1", name: "Full Blood Count (FBC)", date: "2026-04-22", orderedBy: "Dr. Adaobi Okonkwo", hospital: "LUTH", abnormal: false, tests: [
    { name: "Hemoglobin", value: "13.5", unit: "g/dL", range: "12.0–16.0", abnormal: false },
    { name: "WBC", value: "7.2", unit: "x10⁹/L", range: "4.0–11.0", abnormal: false },
    { name: "Platelets", value: "250", unit: "x10⁹/L", range: "150–400", abnormal: false },
  ]},
  { id: "l2", name: "Lipid Profile", date: "2026-04-22", orderedBy: "Dr. Adaobi Okonkwo", hospital: "LUTH", abnormal: true, tests: [
    { name: "Total Cholesterol", value: "245", unit: "mg/dL", range: "<200", abnormal: true },
    { name: "LDL", value: "165", unit: "mg/dL", range: "<130", abnormal: true },
    { name: "HDL", value: "42", unit: "mg/dL", range: ">40", abnormal: false },
    { name: "Triglycerides", value: "180", unit: "mg/dL", range: "<150", abnormal: true },
  ]},
  { id: "l3", name: "Fasting Blood Sugar", date: "2026-04-10", orderedBy: "Dr. Tunde Bakare", hospital: "Reddington", abnormal: false, tests: [
    { name: "FBS", value: "92", unit: "mg/dL", range: "70–100", abnormal: false },
  ]},
  { id: "l4", name: "Malaria Parasite Test", date: "2026-03-02", orderedBy: "Dr. Yusuf Bello", hospital: "National Hospital Abuja", abnormal: false, tests: [
    { name: "MP", value: "Negative", unit: "", range: "Negative", abnormal: false },
  ]},
];

export const mockMedicalRecords = [
  { id: "r1", date: "2026-04-22", type: "consultation", title: "Cardiology Follow-up", doctor: "Dr. Adaobi Okonkwo", summary: "BP well controlled at 128/82. Continue Amlodipine. Lifestyle counselling reinforced." },
  { id: "r2", date: "2026-04-10", type: "diagnosis", title: "Type 2 Diabetes Mellitus (managed)", doctor: "Dr. Tunde Bakare", summary: "HbA1c 6.7%. Metformin titrated. 3-month review." },
  { id: "r3", date: "2026-03-15", type: "vitals", title: "Routine Vitals Check", doctor: "Nurse Folake A.", summary: "BP 130/85, Pulse 78, Temp 36.7°C, SpO₂ 98%, Weight 78kg." },
  { id: "r4", date: "2026-02-28", type: "prescription", title: "Antibiotic Course Issued", doctor: "Dr. Yusuf Bello", summary: "Amoxicillin 500mg TDS x 7 days for sinusitis." },
  { id: "r5", date: "2025-11-12", type: "immunization", title: "Yellow Fever Vaccine", doctor: "Dr. Ngozi Eze", summary: "Single dose administered. Valid lifetime. Certificate issued." },
  { id: "r6", date: "2025-09-01", type: "consultation", title: "Annual Physical", doctor: "Dr. Tunde Bakare", summary: "Generally well. Mild hypertension noted; follow-up scheduled." },
];

export const mockMessageThreads = [
  { id: "t1", with: "Dr. Adaobi Okonkwo", role: "Cardiologist", lastMessage: "Your BP readings look good. Keep it up.", time: "10:42", unread: 0, online: true,
    messages: [
      { from: "doctor", body: "Hello Mara, how are you feeling this week?", time: "Yesterday 09:10" },
      { from: "me", body: "Much better doctor. BP has been around 128/82 in the mornings.", time: "Yesterday 09:14" },
      { from: "doctor", body: "Your BP readings look good. Keep it up.", time: "Today 10:42" },
    ]},
  { id: "t2", with: "Dr. Tunde Bakare", role: "GP", lastMessage: "Please send a photo of the rash.", time: "Yesterday", unread: 2, online: false,
    messages: [
      { from: "me", body: "Doctor, the rash on my arm hasn't gone away.", time: "Yesterday 14:30" },
      { from: "doctor", body: "Please send a photo of the rash.", time: "Yesterday 14:35" },
    ]},
  { id: "t3", with: "Reddington Pharmacy", role: "Pharmacy", lastMessage: "Your refill is ready for pickup.", time: "May 8", unread: 0, online: true,
    messages: [
      { from: "doctor", body: "Your refill is ready for pickup.", time: "May 8 11:00" },
    ]},
];

export const mockPatientProfile = {
  firstName: "Mara",
  lastName: "Obi",
  email: "mara.obi@example.com",
  phone: "+234 803 555 0144",
  dob: "1991-06-12",
  gender: "Female",
  bloodGroup: "O+",
  genotype: "AS",
  address: "12 Awolowo Road, Ikoyi, Lagos",
  state: "Lagos",
  city: "Lagos",
  allergies: ["Penicillin", "Peanuts"],
  chronic: ["Hypertension"],
  emergencyName: "Chinedu Obi (Brother)",
  emergencyPhone: "+234 803 555 0177",
  insurer: "AXA Mansard NHIS",
  insuranceNo: "NHIS-LAG-2241983",
};

// ---------- Doctor mock data ----------

export const mockDoctorTodayAppointments = [
  { id: "da1", patient: "Yusuf Bello", time: "09:00", reason: "Chest pain — follow-up", status: "in_progress", age: 54, gender: "M" },
  { id: "da2", patient: "Ngozi Eze", time: "09:45", reason: "BP review", status: "waiting", age: 47, gender: "F" },
  { id: "da3", patient: "Emeka Nwankwo", time: "10:30", reason: "Palpitations", status: "scheduled", age: 38, gender: "M" },
  { id: "da4", patient: "Folake Adebayo", time: "11:15", reason: "Echo result review", status: "scheduled", age: 62, gender: "F" },
  { id: "da5", patient: "Ibrahim Musa", time: "13:00", reason: "Telemedicine — refill", status: "scheduled", age: 41, gender: "M" },
];

export const mockDoctorPatients = [
  { id: "dp1", name: "Yusuf Bello", age: 54, gender: "M", lastVisit: "2026-05-11", conditions: ["Hypertension", "Hyperlipidemia"], phone: "+234 803 111 2233" },
  { id: "dp2", name: "Ngozi Eze", age: 47, gender: "F", lastVisit: "2026-05-10", conditions: ["Diabetes T2"], phone: "+234 805 222 3344" },
  { id: "dp3", name: "Mara Obi", age: 34, gender: "F", lastVisit: "2026-04-22", conditions: ["Hypertension"], phone: "+234 803 555 0144" },
  { id: "dp4", name: "Emeka Nwankwo", age: 38, gender: "M", lastVisit: "2026-04-18", conditions: ["Anxiety"], phone: "+234 802 444 5566" },
  { id: "dp5", name: "Folake Adebayo", age: 62, gender: "F", lastVisit: "2026-04-12", conditions: ["CHF", "AFib"], phone: "+234 808 666 7788" },
  { id: "dp6", name: "Ibrahim Musa", age: 41, gender: "M", lastVisit: "2026-03-30", conditions: ["Asthma"], phone: "+234 809 777 8899" },
];

export const mockDoctorPrescriptions = [
  { id: "drx1", patient: "Yusuf Bello", drug: "Amlodipine 10mg", frequency: "Once daily", duration: "30 days", date: "2026-05-11", status: "active" },
  { id: "drx2", patient: "Ngozi Eze", drug: "Metformin 500mg", frequency: "Twice daily", duration: "60 days", date: "2026-05-10", status: "active" },
  { id: "drx3", patient: "Mara Obi", drug: "Amlodipine 10mg", frequency: "Once daily", duration: "30 days", date: "2026-04-22", status: "active" },
  { id: "drx4", patient: "Folake Adebayo", drug: "Furosemide 40mg", frequency: "Once daily", duration: "30 days", date: "2026-04-12", status: "active" },
  { id: "drx5", patient: "Ibrahim Musa", drug: "Salbutamol Inhaler", frequency: "PRN", duration: "Ongoing", date: "2026-03-30", status: "completed" },
];

export const mockDoctorLabOrders = [
  { id: "dlo1", patient: "Yusuf Bello", test: "Lipid Profile", ordered: "2026-05-11", status: "pending", priority: "routine" },
  { id: "dlo2", patient: "Ngozi Eze", test: "HbA1c", ordered: "2026-05-10", status: "in_progress", priority: "routine" },
  { id: "dlo3", patient: "Mara Obi", test: "Full Blood Count", ordered: "2026-04-22", status: "completed", priority: "routine", result: "Normal" },
  { id: "dlo4", patient: "Folake Adebayo", test: "Echocardiogram", ordered: "2026-04-12", status: "completed", priority: "urgent", result: "Mild LV dysfunction" },
];

export const mockDoctorConsultRequests = [
  { id: "dc1", patient: "Aisha Bello", hospital: "St. Nicholas Hospital", reason: "Second opinion: arrhythmia management", urgency: "moderate", type: "virtual", requested: "2026-05-12", fee: 25000 },
  { id: "dc2", patient: "John Adeyemi", hospital: "Reddington Hospital", reason: "Pre-op cardiac clearance", urgency: "urgent", type: "virtual", requested: "2026-05-13", fee: 35000 },
  { id: "dc3", patient: "Grace Okafor", hospital: "Lagoon Hospitals", reason: "Echo interpretation", urgency: "routine", type: "report", requested: "2026-05-15", fee: 15000 },
];
