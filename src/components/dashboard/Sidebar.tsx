import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Pill,
  TestTube,
  MessageSquare,
  Video,
  Star,
  Settings,
  LogOut,
  Menu,
  X,
  Heart,
  Bell,
  User,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Calendar, label: "Appointments", path: "/appointments" },
  { icon: FileText, label: "Medical Records", path: "/records" },
  { icon: Pill, label: "Prescriptions", path: "/prescriptions" },
  { icon: TestTube, label: "Lab Results", path: "/lab-results" },
  { icon: Stethoscope, label: "Find Doctors", path: "/doctors" },
  { icon: Video, label: "Teleconsultation", path: "/teleconsult" },
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: Star, label: "Reviews", path: "/reviews" },
];

const bottomItems = [
  { icon: Settings, label: "Settings", path: "/settings" },
  { icon: LogOut, label: "Logout", path: "/logout" },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl gradient-info flex items-center justify-center animate-pulse-glow">
                <Heart className="h-5 w-5 text-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-foreground">
                HealingNet
              </h1>
              <p className="text-xs text-muted-foreground">Patient Portal</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 overflow-y-auto scrollbar-thin">
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200",
                      "hover:bg-sidebar-accent hover:text-primary",
                      isActive
                        ? "bg-primary/10 text-primary border-l-4 border-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </nav>

          {/* Bottom navigation */}
          <div className="px-4 py-4 border-t border-sidebar-border">
            {bottomItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200",
                  "hover:bg-sidebar-accent hover:text-primary",
                  "text-muted-foreground",
                  item.label === "Logout" && "hover:text-destructive"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
