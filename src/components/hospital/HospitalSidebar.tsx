import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Clock,
  Baby,
  Scissors,
  Share2,
  ShieldCheck,
  UserCheck,
  List,
  Search,
  Send,
  FileText,
  Microscope,
  Pill,
  CreditCard,
  BarChart3,
  Video,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Heart,
  ChevronDown,
  BriefcaseMedical,
  Building2,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavGroup {
  label: string;
  icon: any;
  children: { label: string; path: string; icon: any; badge?: number }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Patients",
    icon: Users,
    children: [
      { label: "All Patients", path: "/hospital/patients", icon: List },
      { label: "Patient Queue", path: "/hospital/queue", icon: Clock, badge: 12 },
      { label: "Maternity", path: "/hospital/maternity", icon: Baby },
      { label: "Surgery", path: "/hospital/surgery", icon: Scissors },
      { label: "Referrals", path: "/hospital/referrals", icon: Share2 },
      { label: "Insurance/HMO", path: "/hospital/insurance", icon: ShieldCheck },
    ],
  },
  {
    label: "Doctors",
    icon: UserCheck,
    children: [
      { label: "Manage Doctors", path: "/hospital/doctors", icon: List },
      { label: "Doctor Marketplace", path: "/hospital/marketplace", icon: Search },
      { label: "Consultation Requests", path: "/hospital/consultations", icon: Send },
    ],
  },
  {
    label: "Services",
    icon: BriefcaseMedical,
    children: [
      { label: "Laboratory", path: "/hospital/lab", icon: Microscope },
      { label: "Pharmacy", path: "/hospital/pharmacy", icon: Pill },
    ],
  },
];

const directLinks = [
  { label: "Dashboard", path: "/hospital", icon: LayoutDashboard },
  { label: "EMR Records", path: "/hospital/emr", icon: FileText },
  { label: "Billing & Revenue", path: "/hospital/billing", icon: CreditCard },
  { label: "Analytics", path: "/hospital/analytics", icon: BarChart3 },
  { label: "Teleconsultation", path: "/hospital/teleconsult", icon: Video },
  { label: "Notifications", path: "/hospital/notifications", icon: Bell },
];

export function HospitalSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>(["Patients", "Doctors"]);
  const location = useLocation();

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out overflow-hidden flex flex-col",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border shrink-0">
          <div className="w-10 h-10 rounded-xl gradient-info flex items-center justify-center animate-pulse-glow">
            <Building2 className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">HealingNet</h1>
            <p className="text-xs text-muted-foreground">Hospital Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin">
          {/* Dashboard */}
          <NavLink
            to="/hospital"
            end
            onClick={() => setIsOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 mb-1",
              "hover:bg-sidebar-accent hover:text-primary",
              isActive("/hospital")
                ? "bg-primary/10 text-primary border-l-4 border-primary"
                : "text-muted-foreground"
            )}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard</span>
          </NavLink>

          {/* Groups */}
          {navGroups.map((group) => {
            const isGroupOpen = openGroups.includes(group.label);
            const hasActiveChild = group.children.some((c) => isActive(c.path));

            return (
              <div key={group.label} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 w-full text-left",
                    "hover:bg-sidebar-accent hover:text-primary",
                    hasActiveChild ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <group.icon className="h-5 w-5" />
                  <span className="flex-1">{group.label}</span>
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform duration-200", isGroupOpen && "rotate-180")}
                  />
                </button>
                {isGroupOpen && (
                  <div className="ml-4 pl-4 border-l border-sidebar-border space-y-0.5 mt-0.5">
                    {group.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                          "hover:bg-sidebar-accent hover:text-primary",
                          isActive(child.path)
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground"
                        )}
                      >
                        <child.icon className="h-4 w-4" />
                        <span className="flex-1">{child.label}</span>
                        {child.badge && (
                          <span className="bg-destructive text-destructive-foreground text-xs font-bold px-1.5 py-0.5 rounded-full">
                            {child.badge}
                          </span>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Direct links */}
          <NavLink
            to="/hospital/emr"
            onClick={() => setIsOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 mb-1",
              "hover:bg-sidebar-accent hover:text-primary",
              isActive("/hospital/emr") ? "bg-primary/10 text-primary border-l-4 border-primary" : "text-muted-foreground"
            )}
          >
            <FileText className="h-5 w-5" />
            <span>EMR Records</span>
          </NavLink>

          <NavLink
            to="/hospital/billing"
            onClick={() => setIsOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 mb-1",
              "hover:bg-sidebar-accent hover:text-primary",
              isActive("/hospital/billing") ? "bg-primary/10 text-primary border-l-4 border-primary" : "text-muted-foreground"
            )}
          >
            <CreditCard className="h-5 w-5" />
            <span>Billing & Revenue</span>
          </NavLink>

          <NavLink
            to="/hospital/analytics"
            onClick={() => setIsOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 mb-1",
              "hover:bg-sidebar-accent hover:text-primary",
              isActive("/hospital/analytics") ? "bg-primary/10 text-primary border-l-4 border-primary" : "text-muted-foreground"
            )}
          >
            <BarChart3 className="h-5 w-5" />
            <span>Analytics</span>
          </NavLink>

          <NavLink
            to="/hospital/notifications"
            onClick={() => setIsOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 mb-1",
              "hover:bg-sidebar-accent hover:text-primary",
              isActive("/hospital/notifications") ? "bg-primary/10 text-primary border-l-4 border-primary" : "text-muted-foreground"
            )}
          >
            <Bell className="h-5 w-5" />
            <span>Notifications</span>
          </NavLink>
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-sidebar-border shrink-0 space-y-0.5">
          <NavLink
            to="/hospital/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-primary transition-all duration-200"
          >
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </NavLink>
          <NavLink
            to="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-primary transition-all duration-200"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Patient Portal</span>
          </NavLink>
          <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-destructive transition-all duration-200 w-full">
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
