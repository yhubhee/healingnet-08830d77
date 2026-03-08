import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Hospital pages
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Patient Portal */}
          <Route path="/" element={<Index />} />

          {/* Hospital Portal */}
          <Route path="/hospital" element={<HospitalDashboard />} />
          <Route path="/hospital/queue" element={<HospitalQueue />} />
          <Route path="/hospital/doctors" element={<HospitalDoctors />} />
          <Route path="/hospital/patients" element={<HospitalPatients />} />
          <Route path="/hospital/billing" element={<HospitalBilling />} />
          <Route path="/hospital/emr" element={<HospitalEMR />} />
          <Route path="/hospital/lab" element={<HospitalLab />} />
          <Route path="/hospital/pharmacy" element={<HospitalPharmacy />} />
          <Route path="/hospital/surgery" element={<HospitalSurgery />} />
          <Route path="/hospital/maternity" element={<HospitalMaternity />} />
          <Route path="/hospital/referrals" element={<HospitalReferrals />} />
          <Route path="/hospital/insurance" element={<HospitalInsurance />} />
          <Route path="/hospital/analytics" element={<HospitalAnalytics />} />
          <Route path="/hospital/consultations" element={<HospitalConsultations />} />
          <Route path="/hospital/marketplace" element={<HospitalMarketplace />} />
          <Route path="/hospital/notifications" element={<HospitalNotifications />} />
          <Route path="/hospital/settings" element={<HospitalSettings />} />
          <Route path="/hospital/beds" element={<HospitalBedManagement />} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
