import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Calendar, Users, Pill, FlaskConical, MessageSquare, User, LogOut, Heart, Settings, Mail } from "lucide-react";
import { signOut } from "@/hooks/useAuth";
import { useDoctor, useDoctorBadges } from "@/hooks/useDoctor";
import { cn } from "@/lib/utils";

export function DoctorSidebar() {
  const { pathname } = useLocation();
  const { data: ctx } = useDoctor();
  const { data: badges } = useDoctorBadges(ctx?.doctor?.id, ctx?.user?.id);

  const items = [
    { label: "Dashboard", path: "/doctor", icon: LayoutDashboard },
    { label: "Appointments", path: "/doctor/appointments", icon: Calendar, badge: badges?.appointments },
    { label: "My Patients", path: "/doctor/patients", icon: Users },
    { label: "Prescriptions", path: "/doctor/prescriptions", icon: Pill },
    { label: "Lab Orders", path: "/doctor/lab-orders", icon: FlaskConical },
    { label: "Consultations", path: "/doctor/consultations", icon: MessageSquare, badge: badges?.consultations },
    { label: "Messages", path: "/doctor/messages", icon: Mail, badge: badges?.messages },
    { label: "Profile", path: "/doctor/profile", icon: User },
    { label: "Settings", path: "/doctor/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 h-screen md:h-auto md:min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center">
          <Heart className="w-4 h-4 text-primary-foreground" fill="currentColor" />
        </div>
        <div><div className="font-heading font-bold text-sm">HealingNet</div><div className="text-xs text-muted-foreground">Doctor Portal</div></div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map((it) => {
          const active = pathname === it.path || (it.path !== "/doctor" && pathname.startsWith(it.path));
          return (
            <NavLink key={it.path} to={it.path} end={it.path === "/doctor"}
              className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors", active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent")}>
              <it.icon className="w-4 h-4" /><span className="flex-1">{it.label}</span>
              {it.badge ? <span className={cn("text-xs rounded-full px-1.5 min-w-[18px] text-center", active ? "bg-primary-foreground/20" : "bg-primary text-primary-foreground")}>{it.badge}</span> : null}
            </NavLink>
          );
        })}
      </nav>
      <button onClick={signOut} className="m-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent">
        <LogOut className="w-4 h-4" />Sign out
      </button>
    </aside>
  );
}
