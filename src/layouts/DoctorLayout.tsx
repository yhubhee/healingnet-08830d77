import { ReactNode } from "react";
import { DoctorSidebar } from "@/components/doctor/DoctorSidebar";
import { VerificationGate } from "@/components/doctor/VerificationGate";

export function DoctorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      <DoctorSidebar />
      <main className="flex-1 overflow-auto p-6">
        <VerificationGate>{children}</VerificationGate>
      </main>
    </div>
  );
}
