// The pharmacy app (/pharmacy/*). Lazy-loaded behind RequirePharmacy.
import { Navigate, Route, Routes } from "react-router-dom";
import { PharmacyLayout } from "./PharmacyLayout";
import Dashboard from "./pages/Dashboard";
import Requests from "./pages/Requests";
import RequestDetail from "./pages/RequestDetail";
import History from "./pages/History";
import Team from "./pages/Team";
import Fees from "./pages/Fees";
import Settings from "./pages/Settings";
import { UserNotificationsList } from "@/components/common/UserNotificationsList";
import { useMyPharmacy } from "@/lib/pharmacy";

export default function PharmacyApp() {
  const { data: me } = useMyPharmacy();
  const isOwner = me?.member.role === "owner";
  return (
    <PharmacyLayout>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="requests" element={<Requests />} />
        <Route path="requests/:id" element={<RequestDetail />} />
        <Route path="history" element={<History />} />
        <Route path="team" element={<Team />} />
        <Route path="fees" element={isOwner ? <Fees /> : <Navigate to="/pharmacy" replace />} />
        <Route path="settings" element={<Settings />} />
        <Route path="notifications" element={<UserNotificationsList audience="pharmacy" />} />
        <Route path="*" element={<Navigate to="/pharmacy" replace />} />
      </Routes>
    </PharmacyLayout>
  );
}
