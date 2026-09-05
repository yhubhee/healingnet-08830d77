import { ReactNode } from "react";
import { PatientSidebar } from "@/components/patient/PatientSidebar";
import { PatientHeader } from "@/components/patient/PatientHeader";
import { DataErrorBanner } from "@/components/ui/data-error-banner";

export function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PatientSidebar />
      <div className="lg:ml-64">
        <PatientHeader />
        <main className="p-4 lg:p-8">
          <DataErrorBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
