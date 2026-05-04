import { ReactNode } from "react";
import { DoctorSidebar } from "@/components/doctor/DoctorSidebar";

export function DoctorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      <DoctorSidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
