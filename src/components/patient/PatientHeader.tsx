import { Bell } from "lucide-react";
import { usePatientProfile } from "@/hooks/usePatientData";

export function PatientHeader() {
  const { data: profile } = usePatientProfile();
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-4 lg:px-8 h-16">
        <div className="lg:ml-0 ml-12">
          <p className="text-sm text-muted-foreground">Welcome back,</p>
          <p className="font-heading font-bold">{profile ? `${profile.first_name} ${profile.last_name}` : "Patient"}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative w-10 h-10 rounded-lg hover:bg-card transition-colors flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
            {profile?.first_name?.[0] || "P"}
          </div>
        </div>
      </div>
    </header>
  );
}
