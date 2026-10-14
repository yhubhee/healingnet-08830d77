import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { PatientSidebar } from "@/components/patient/PatientSidebar";
import { PatientHeader } from "@/components/patient/PatientHeader";
import { DataErrorBanner } from "@/components/ui/data-error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { usePatientProfile } from "@/hooks/usePatientData";
import { missingPatientFields } from "@/lib/patientProfile";

// Reachable while the profile is incomplete. Triage stays open so nobody is kept from
// checking urgent symptoms by a form.
const ALLOWED_WHEN_INCOMPLETE = ["/patient/complete-profile", "/patient/profile", "/patient/settings", "/patient/triage"];

function ProfileGate({ children }: { children: ReactNode }) {
  const { data: profile, isLoading } = usePatientProfile();
  const { pathname } = useLocation();
  if (isLoading) return <div className="space-y-3" aria-busy="true" aria-label="Loading"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-40 rounded-xl" /></div>;
  if (profile && missingPatientFields(profile).length > 0 && !ALLOWED_WHEN_INCOMPLETE.includes(pathname)) {
    return <Navigate to="/patient/complete-profile" replace />;
  }
  return <>{children}</>;
}

export function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PatientSidebar />
      <div className="lg:ml-64">
        <PatientHeader />
        <main className="p-4 lg:p-8">
          <DataErrorBanner />
          <ProfileGate>{children}</ProfileGate>
        </main>
      </div>
    </div>
  );
}
