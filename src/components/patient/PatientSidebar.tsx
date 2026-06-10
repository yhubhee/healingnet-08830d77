import { useState } from "react";
import { NavLink, useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Calendar, Pill, FlaskConical, FileText, MessageSquare, User, Settings, LogOut, Menu, X, Heart, Stethoscope, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut } from "@/hooks/useAuth";

const links = [
  { label: "Dashboard", path: "/patient", icon: LayoutDashboard, end: true },
  { label: "AI Triage", path: "/patient/triage", icon: Stethoscope },
  { label: "Appointments", path: "/patient/appointments", icon: Calendar },
  { label: "Prescriptions", path: "/patient/prescriptions", icon: Pill },
  { label: "Lab Results", path: "/patient/lab-results", icon: FlaskConical },
  { label: "Medical Records", path: "/patient/medical-records", icon: FileText },
  { label: "My Letters & Reports", path: "/patient/letters", icon: Award },
  { label: "Messages", path: "/patient/messages", icon: MessageSquare },
  { label: "Profile", path: "/patient/profile", icon: User },
  { label: "Settings", path: "/patient/settings", icon: Settings },
];

export function PatientSidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  return (
    <>
      <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50 lg:hidden" onClick={() => setOpen(!open)}>
        {open ? <X /> : <Menu />}
      </Button>
      {open && <div className="fixed inset-0 bg-background/80 z-40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn(
        "fixed top-0 left-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <Link to="/patient" className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary-foreground" fill="currentColor" />
          </div>
          <div>
            <h1 className="font-heading font-bold">HealingNet</h1>
            <p className="text-xs text-muted-foreground">Patient Portal</p>
          </div>
        </Link>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
          {links.map((l) => (
            <NavLink key={l.path} to={l.path} end={l.end} onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all hover:bg-sidebar-accent hover:text-primary",
                location.pathname === l.path ? "bg-primary/10 text-primary" : "text-muted-foreground"
              )}>
              <l.icon className="h-5 w-5" /><span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button onClick={signOut} className="flex items-center gap-3 px-4 py-2.5 rounded-lg w-full font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-destructive transition-colors">
            <LogOut className="h-5 w-5" /><span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
