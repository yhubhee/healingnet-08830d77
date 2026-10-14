// The avatar in the patient header: a dropdown on larger screens, a bottom sheet on mobile.
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bell, Calendar, Check, ChevronRight, Copy, LogOut, Share2, User } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth, signOut } from "@/hooks/useAuth";
import { usePatientProfile } from "@/hooks/usePatientData";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { patientCompleteness } from "@/lib/patientProfile";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/patient/profile", label: "My profile", icon: User },
  { to: "/patient/profile#share", label: "Share my records", icon: Share2 },
  { to: "/patient/appointments", label: "Appointments", icon: Calendar },
  { to: "/patient/settings", label: "Notification settings", icon: Bell },
];

function Avatar({ url, initials, size }: { url?: string | null; initials: string; size: "sm" | "lg" }) {
  return (
    <span className={cn("shrink-0 overflow-hidden rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold", size === "sm" ? "h-10 w-10" : "h-12 w-12 text-lg")}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials || "P"}
    </span>
  );
}

export function PatientAccountMenu() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { data: p } = usePatientProfile();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const name = p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : "Patient";
  const initials = `${p?.first_name?.[0] ?? ""}${p?.last_name?.[0] ?? ""}`;
  const shortId = p?.id ? p.id.slice(0, 8).toUpperCase() : null;
  const completeness = patientCompleteness(p as never);

  const copyId = () => {
    if (!shortId) return;
    navigator.clipboard?.writeText(shortId).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
      () => toast.error("Couldn't copy"),
    );
  };

  const header = (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-3">
        <Avatar url={p?.profile_image_url} initials={initials} size="lg" />
        <div className="min-w-0">
          <p className="font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
      </div>
      {shortId && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm">
          <span><span className="text-muted-foreground">Patient ID </span><span className="font-mono font-medium">{shortId}</span></span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyId(); }} aria-label={`Copy patient ID ${shortId}`}>
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}
      {p && completeness < 100 && (
        <Link to="/patient/complete-profile" onClick={() => setOpen(false)} className="block rounded-lg border border-warning/40 bg-warning/5 p-2 text-sm hover:bg-warning/10">
          <span className="flex items-center justify-between"><span>Profile {completeness}% complete</span><span className="text-primary">Complete your profile →</span></span>
          <Progress value={completeness} className="mt-1.5 h-1.5" aria-label={`Profile ${completeness}% complete`} />
        </Link>
      )}
    </div>
  );

  const trigger = (
    <button type="button" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
      <Avatar url={p?.profile_image_url} initials={initials} size="sm" />
    </button>
  );

  if (isMobile) {
    const item = (to: string, label: string, Icon: typeof User): ReactNode => (
      <Link key={to} to={to} onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 rounded-lg px-3 hover:bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden /><span className="flex-1">{label}</span><ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
      </Link>
    );
    return (
      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="pb-[env(safe-area-inset-bottom)]">
          <DrawerTitle className="sr-only">Account</DrawerTitle>
          {header}
          <nav className="border-t border-border p-2" aria-label="Account">
            {LINKS.map((l) => item(l.to, l.label, l.icon))}
            <button type="button" onClick={signOut} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-destructive hover:bg-destructive/10">
              <LogOut className="h-5 w-5" aria-hidden />Sign out
            </button>
          </nav>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        {header}
        <DropdownMenuSeparator className="my-0" />
        <div className="p-1">
          {LINKS.map((l) => (
            <DropdownMenuItem key={l.to} asChild className="notification-item cursor-pointer gap-2 py-2">
              <Link to={l.to}><l.icon className="h-4 w-4" aria-hidden />{l.label}</Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => signOut()} className="notification-item cursor-pointer gap-2 py-2 text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" aria-hidden />Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
