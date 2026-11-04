import {
  Activity, CreditCard, Gauge, HeartPulse, Hospital, LayoutDashboard, Mail, Pill, ScrollText, ShieldAlert, ShieldCheck, Stethoscope,
  type LucideIcon,
} from "lucide-react";
import type { Overview } from "./api";

export interface NavItem {
  to: string;
  label: string;
  short?: string;
  icon: LucideIcon;
  badge?: (o: Overview) => number;
}

export const NAV: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  {
    to: "/admin/verifications", label: "Verifications", short: "Verify", icon: ShieldCheck,
    badge: (o) => o.inbox.verifications_pending + (o.inbox.pharmacies_pending ?? 0) + (o.inbox.pharmacists_pending ?? 0),
  },
  { to: "/admin/hospitals", label: "Hospitals", icon: Hospital },
  { to: "/admin/doctors", label: "Doctors", icon: Stethoscope },
  { to: "/admin/pharmacies", label: "Pharmacies", icon: Pill },
  { to: "/admin/medicine-reports", label: "Medicine reports", short: "Reports", icon: ShieldAlert, badge: (o) => o.inbox.medicine_reports_open ?? 0 },
  { to: "/admin/payments", label: "Payments", icon: CreditCard, badge: (o) => o.inbox.refunds_needed },
  { to: "/admin/activity", label: "Activity", icon: Activity },
  { to: "/admin/health", label: "System health", icon: HeartPulse },
  { to: "/admin/messages", label: "Messages", icon: Mail, badge: (o) => o.inbox.contact_unhandled },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText },
];

/** The four sections in the mobile bottom tab bar. */
export const BOTTOM_TABS = ["/admin", "/admin/verifications", "/admin/hospitals", "/admin/payments"];

export const navFor = (pathname: string) =>
  NAV.find((n) => n.to !== "/admin" && pathname.startsWith(n.to)) ?? NAV[0];

export const ConsoleIcon = Gauge;
