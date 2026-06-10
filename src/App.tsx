import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import About from "./pages/About";
import Services from "./pages/Services";
import FeaturesPage from "./pages/Features";
import PricingPage from "./pages/Pricing";
import FAQPage from "./pages/FAQ";
import ContactPage from "./pages/Contact";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { RequirePlan } from "./components/auth/RequirePlan";

import HospitalDashboard from "./pages/hospital/Dashboard";
import HospitalQueue from "./pages/hospital/Queue";
import HospitalDoctors from "./pages/hospital/Doctors";
import HospitalPatients from "./pages/hospital/Patients";
import HospitalBilling from "./pages/hospital/Billing";
import HospitalEMR from "./pages/hospital/EMR";
import HospitalLab from "./pages/hospital/Lab";
import HospitalPharmacy from "./pages/hospital/Pharmacy";
import HospitalSurgery from "./pages/hospital/Surgery";
import HospitalMaternity from "./pages/hospital/Maternity";
import HospitalReferrals from "./pages/hospital/Referrals";
import HospitalInsurance from "./pages/hospital/Insurance";
import HospitalAnalytics from "./pages/hospital/Analytics";
import HospitalConsultations from "./pages/hospital/Consultations";
import HospitalMarketplace from "./pages/hospital/Marketplace";
import HospitalNotifications from "./pages/hospital/Notifications";
import HospitalSettings from "./pages/hospital/Settings";
import HospitalBedManagement from "./pages/hospital/BedManagement";

import PatientDashboard from "./pages/patient/Dashboard";
import PatientAppointments from "./pages/patient/Appointments";
import PatientPrescriptions from "./pages/patient/Prescriptions";
import PatientLabResults from "./pages/patient/LabResults";
import PatientMedicalRecords from "./pages/patient/MedicalRecords";
import PatientMessages from "./pages/patient/Messages";
import PatientLetters from "./pages/patient/Letters";
import PatientProfile from "./pages/patient/Profile";
import PatientSettings from "./pages/patient/Settings";
import PatientTriage from "./pages/patient/Triage";

import DoctorDashboard from "./pages/doctor/Dashboard";
import DoctorAppointments from "./pages/doctor/Appointments";
import DoctorPatients from "./pages/doctor/Patients";
import DoctorPrescriptions from "./pages/doctor/Prescriptions";
import DoctorLabOrders from "./pages/doctor/LabOrders";
import DoctorConsultations from "./pages/doctor/Consultations";
import DoctorProfile from "./pages/doctor/Profile";
import DoctorVerification from "./pages/doctor/Verification";
import DoctorSettings from "./pages/doctor/Settings";
import DoctorMessages from "./pages/doctor/Messages";
import DoctorPatientDetail from "./pages/doctor/PatientDetail";
import VideoConsult from "./pages/VideoConsult";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Patient Portal */}
          <Route path="/patient" element={<ProtectedRoute><PatientDashboard /></ProtectedRoute>} />
          <Route path="/patient/appointments" element={<ProtectedRoute><PatientAppointments /></ProtectedRoute>} />
          <Route path="/patient/prescriptions" element={<ProtectedRoute><PatientPrescriptions /></ProtectedRoute>} />
          <Route path="/patient/lab-results" element={<ProtectedRoute><PatientLabResults /></ProtectedRoute>} />
          <Route path="/patient/medical-records" element={<ProtectedRoute><PatientMedicalRecords /></ProtectedRoute>} />
          <Route path="/patient/letters" element={<ProtectedRoute><PatientLetters /></ProtectedRoute>} />
          <Route path="/patient/messages" element={<ProtectedRoute><PatientMessages /></ProtectedRoute>} />
          <Route path="/patient/profile" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
          <Route path="/patient/settings" element={<ProtectedRoute><PatientSettings /></ProtectedRoute>} />
          <Route path="/patient/triage" element={<ProtectedRoute><PatientTriage /></ProtectedRoute>} />

          <Route path="/consult/:id" element={<ProtectedRoute><VideoConsult /></ProtectedRoute>} />


          {/* Doctor Portal */}
          <Route path="/doctor" element={<ProtectedRoute><DoctorDashboard /></ProtectedRoute>} />
          <Route path="/doctor/appointments" element={<ProtectedRoute><DoctorAppointments /></ProtectedRoute>} />
          <Route path="/doctor/patients" element={<ProtectedRoute><DoctorPatients /></ProtectedRoute>} />
          <Route path="/doctor/patients/:id" element={<ProtectedRoute><DoctorPatientDetail /></ProtectedRoute>} />
          <Route path="/doctor/messages" element={<ProtectedRoute><DoctorMessages /></ProtectedRoute>} />
          <Route path="/doctor/prescriptions" element={<ProtectedRoute><DoctorPrescriptions /></ProtectedRoute>} />
          <Route path="/doctor/lab-orders" element={<ProtectedRoute><DoctorLabOrders /></ProtectedRoute>} />
          <Route path="/doctor/consultations" element={<ProtectedRoute><DoctorConsultations /></ProtectedRoute>} />
          <Route path="/doctor/profile" element={<ProtectedRoute><DoctorProfile /></ProtectedRoute>} />
          <Route path="/doctor/verification" element={<ProtectedRoute><DoctorVerification /></ProtectedRoute>} />
          <Route path="/doctor/settings" element={<ProtectedRoute><DoctorSettings /></ProtectedRoute>} />

          {/* Hospital Portal */}
          <Route path="/hospital" element={<ProtectedRoute><HospitalDashboard /></ProtectedRoute>} />
          <Route path="/hospital/queue" element={<ProtectedRoute><HospitalQueue /></ProtectedRoute>} />
          <Route path="/hospital/doctors" element={<ProtectedRoute><HospitalDoctors /></ProtectedRoute>} />
          <Route path="/hospital/patients" element={<ProtectedRoute><HospitalPatients /></ProtectedRoute>} />
          <Route path="/hospital/billing" element={<ProtectedRoute><HospitalBilling /></ProtectedRoute>} />
          <Route path="/hospital/emr" element={<ProtectedRoute><HospitalEMR /></ProtectedRoute>} />
          <Route path="/hospital/lab" element={<ProtectedRoute><HospitalLab /></ProtectedRoute>} />
          <Route path="/hospital/pharmacy" element={<ProtectedRoute><HospitalPharmacy /></ProtectedRoute>} />
          <Route path="/hospital/surgery" element={<ProtectedRoute><HospitalSurgery /></ProtectedRoute>} />
          <Route path="/hospital/maternity" element={<ProtectedRoute><HospitalMaternity /></ProtectedRoute>} />
          <Route path="/hospital/referrals" element={<ProtectedRoute><HospitalReferrals /></ProtectedRoute>} />
          <Route path="/hospital/insurance" element={<ProtectedRoute><HospitalInsurance /></ProtectedRoute>} />
          <Route path="/hospital/analytics" element={<ProtectedRoute><HospitalAnalytics /></ProtectedRoute>} />
          <Route path="/hospital/consultations" element={<ProtectedRoute><RequirePlan plan="telemedicine"><HospitalConsultations /></RequirePlan></ProtectedRoute>} />
          <Route path="/hospital/marketplace" element={<ProtectedRoute><RequirePlan plan="telemedicine"><HospitalMarketplace /></RequirePlan></ProtectedRoute>} />
          <Route path="/hospital/notifications" element={<ProtectedRoute><HospitalNotifications /></ProtectedRoute>} />
          <Route path="/hospital/settings" element={<ProtectedRoute><HospitalSettings /></ProtectedRoute>} />
          <Route path="/hospital/beds" element={<ProtectedRoute><HospitalBedManagement /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
