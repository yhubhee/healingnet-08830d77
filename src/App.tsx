import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
const About = lazy(() => import("./pages/About"));
const Services = lazy(() => import("./pages/Services"));
const FeaturesPage = lazy(() => import("./pages/Features"));
const PricingPage = lazy(() => import("./pages/Pricing"));
const FAQPage = lazy(() => import("./pages/FAQ"));
const ContactPage = lazy(() => import("./pages/Contact"));
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import OAuthConsent from "./pages/OAuthConsent";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { RequirePlan } from "./components/auth/RequirePlan";
import { PageLoadingFallback } from "./components/common/PageLoadingFallback";

const HospitalDashboard = lazy(() => import("./pages/hospital/Dashboard"));
const HospitalQueue = lazy(() => import("./pages/hospital/Queue"));
const HospitalDoctors = lazy(() => import("./pages/hospital/Doctors"));
const HospitalPatients = lazy(() => import("./pages/hospital/Patients"));
const HospitalBilling = lazy(() => import("./pages/hospital/Billing"));
const HospitalEMR = lazy(() => import("./pages/hospital/EMR"));
const AddEMREntry = lazy(() => import("./pages/hospital/AddEMREntry"));
const EMRTypeDetail = lazy(() => import("./pages/hospital/EMRTypeDetail"));
const HospitalLab = lazy(() => import("./pages/hospital/Lab"));
const HospitalPharmacy = lazy(() => import("./pages/hospital/Pharmacy"));
const HospitalSurgery = lazy(() => import("./pages/hospital/Surgery"));
const HospitalMaternity = lazy(() => import("./pages/hospital/Maternity"));
const HospitalReferrals = lazy(() => import("./pages/hospital/Referrals"));
const HospitalInsurance = lazy(() => import("./pages/hospital/Insurance"));
const HospitalAnalytics = lazy(() => import("./pages/hospital/Analytics"));
const HospitalConsultations = lazy(() => import("./pages/hospital/Consultations"));
const HospitalMarketplace = lazy(() => import("./pages/hospital/Marketplace"));
const HospitalNotifications = lazy(() => import("./pages/hospital/Notifications"));
const HospitalSettings = lazy(() => import("./pages/hospital/Settings"));
const HospitalBedManagement = lazy(() => import("./pages/hospital/BedManagement"));
const ConfirmingPayment = lazy(() => import("./pages/hospital/ConfirmingPayment"));

const PatientDashboard = lazy(() => import("./pages/patient/Dashboard"));
const PatientAppointments = lazy(() => import("./pages/patient/Appointments"));
const PatientPrescriptions = lazy(() => import("./pages/patient/Prescriptions"));
const PatientLabResults = lazy(() => import("./pages/patient/LabResults"));
const PatientMedicalRecords = lazy(() => import("./pages/patient/MedicalRecords"));
const PatientMessages = lazy(() => import("./pages/patient/Messages"));
const PatientLetters = lazy(() => import("./pages/patient/Letters"));
const PatientProfile = lazy(() => import("./pages/patient/Profile"));
const PatientSettings = lazy(() => import("./pages/patient/Settings"));
const PatientNotifications = lazy(() => import("./pages/patient/Notifications"));
const PatientTriage = lazy(() => import("./pages/patient/Triage"));

const DoctorDashboard = lazy(() => import("./pages/doctor/Dashboard"));
const DoctorAppointments = lazy(() => import("./pages/doctor/Appointments"));
const DoctorPatients = lazy(() => import("./pages/doctor/Patients"));
const DoctorPrescriptions = lazy(() => import("./pages/doctor/Prescriptions"));
const DoctorLabOrders = lazy(() => import("./pages/doctor/LabOrders"));
const DoctorConsultations = lazy(() => import("./pages/doctor/Consultations"));
const DoctorProfile = lazy(() => import("./pages/doctor/Profile"));
const DoctorVerification = lazy(() => import("./pages/doctor/Verification"));
const DoctorSettings = lazy(() => import("./pages/doctor/Settings"));
const DoctorMessages = lazy(() => import("./pages/doctor/Messages"));
const DoctorPatientDetail = lazy(() => import("./pages/doctor/PatientDetail"));
const DoctorInvitations = lazy(() => import("./pages/doctor/Invitations"));
const DoctorNotifications = lazy(() => import("./pages/doctor/Notifications"));
const DoctorConsultationPage = lazy(() => import("./pages/doctor/ConsultationPage"));
const VideoConsult = lazy(() => import("./pages/VideoConsult"));

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      toast.error("Couldn't load some information", {
        description: (error as { message?: string })?.message ?? "Please try again.",
      });
    },
  }),
  defaultOptions: { queries: { retry: 1 } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoadingFallback />}>
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
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

          {/* Patient Portal */}
          <Route path="/patient" element={<ProtectedRoute><PatientDashboard /></ProtectedRoute>} />
          <Route path="/patient/appointments" element={<ProtectedRoute><PatientAppointments /></ProtectedRoute>} />
          <Route path="/patient/prescriptions" element={<ProtectedRoute><PatientPrescriptions /></ProtectedRoute>} />
          <Route path="/patient/lab-results" element={<ProtectedRoute><PatientLabResults /></ProtectedRoute>} />
          <Route path="/patient/medical-records" element={<ProtectedRoute><PatientMedicalRecords /></ProtectedRoute>} />
          <Route path="/patient/letters" element={<ProtectedRoute><PatientLetters /></ProtectedRoute>} />
          <Route path="/patient/messages" element={<ProtectedRoute><PatientMessages /></ProtectedRoute>} />
          <Route path="/patient/profile" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
          <Route path="/patient/notifications" element={<ProtectedRoute><PatientNotifications /></ProtectedRoute>} />
          <Route path="/patient/settings" element={<ProtectedRoute><PatientSettings /></ProtectedRoute>} />
          <Route path="/patient/triage" element={<ProtectedRoute><PatientTriage /></ProtectedRoute>} />
          {/* Legacy deep links from older notifications */}
          <Route path="/patient/dashboard" element={<Navigate to="/patient" replace />} />
          <Route path="/doctor/dashboard" element={<Navigate to="/doctor" replace />} />

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
          <Route path="/doctor/consultation/:consultationId" element={<ProtectedRoute><DoctorConsultationPage /></ProtectedRoute>} />
          <Route path="/doctor/invitations" element={<ProtectedRoute><DoctorInvitations /></ProtectedRoute>} />
          <Route path="/doctor/notifications" element={<ProtectedRoute><DoctorNotifications /></ProtectedRoute>} />
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
          <Route path="/hospital/emr/add" element={<ProtectedRoute><AddEMREntry /></ProtectedRoute>} />
          <Route path="/hospital/emr/:type" element={<ProtectedRoute><EMRTypeDetail /></ProtectedRoute>} />
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
          <Route path="/hospital/confirming-payment" element={<ProtectedRoute><ConfirmingPayment /></ProtectedRoute>} />
          <Route path="/hospital/beds" element={<ProtectedRoute><HospitalBedManagement /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
