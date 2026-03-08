import { ReactNode } from "react";
import { HospitalSidebar } from "@/components/hospital/HospitalSidebar";
import { HospitalHeader } from "@/components/hospital/HospitalHeader";

interface HospitalLayoutProps {
  children: ReactNode;
}

export function HospitalLayout({ children }: HospitalLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <HospitalSidebar />
      <div className="lg:ml-64">
        <HospitalHeader />
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
