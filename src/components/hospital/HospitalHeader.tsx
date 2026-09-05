import { Bell, Search, ChevronDown, Building2, User, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { signOut } from "@/hooks/useAuth";
import { useHospitalNotifications, useRealtimeNotifications, useMarkNotificationRead } from "@/hooks/useHospitalData";
import { useHospitalProfile, useHospitalSearch } from "@/hooks/useHospitalSearch";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  patient: "Patient",
  doctor: "Doctor",
  lab: "Lab",
};

export function HospitalHeader() {
  const navigate = useNavigate();
  useRealtimeNotifications();
  const { data: notifications = [] } = useHospitalNotifications();
  const markRead = useMarkNotificationRead();
  const { playSound } = useNotificationSound();
  const { data: profile } = useHospitalProfile();

  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const { data: results = [], isFetching } = useHospitalSearch(debounced);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 300);
    return () => clearTimeout(t);
  }, [term]);

  const unread = notifications.filter((n: any) => !n.is_read);
  const recentNotifs = notifications.slice(0, 3);

  useEffect(() => {
    const callInNotif = unread.find((n: any) => n.type === "call_in");
    if (callInNotif) {
      playSound();
    }
  }, [unread, playSound]);

  const staffName = profile ? `${profile.first_name} ${profile.last_name}` : "Hospital Staff";
  const staffRole = profile?.role
    ? profile.role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : "Staff";
  const hospitalName = profile?.hospitals?.name;

  return (
    <header className="sticky top-0 z-30 h-16 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between h-full px-4 lg:px-8 gap-3">
        <div className="hidden md:flex items-center flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patients, doctors, lab orders..."
              value={term}
              onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              className="pl-10 pr-9 bg-card border-border focus-visible:ring-primary"
            />
            {term && (
              <button
                type="button"
                onClick={() => { setTerm(""); setDebounced(""); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {open && debounced.length >= 2 && (
              <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-border bg-popover shadow-lg overflow-hidden z-50">
                {isFetching ? (
                  <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                  </div>
                ) : results.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No matches for “{debounced}”</div>
                ) : (
                  <ul className="max-h-80 overflow-y-auto py-1">
                    {results.map((r) => (
                      <li key={`${r.kind}-${r.id}`}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { navigate(r.url); setOpen(false); setTerm(""); setDebounced(""); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{r.title}</span>
                            <Badge variant="secondary" className="text-[10px] shrink-0">{KIND_LABEL[r.kind]}</Badge>
                          </div>
                          {r.subtitle && <p className="text-xs opacity-70 truncate">{r.subtitle}</p>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unread.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive border-0">
                    {unread.length > 9 ? "9+" : unread.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifications
                {unread.length > 0 && <Badge variant="secondary" className="text-xs">{unread.length} new</Badge>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {recentNotifs.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">No notifications</div>
              ) : recentNotifs.map((n: any) => {
                const typeIcons: Record<string, string> = {
                  checkin: "🟢",
                  call_in: "☎️",
                  lab: "🔬",
                  pharmacy: "💊",
                  billing: "💳",
                  consultation: "📋",
                  emergency: "🚨",
                  system: "⚙️"
                };
                return (
                  <DropdownMenuItem
                    key={n.id}
                    className={cn("notification-item flex flex-col items-start gap-1 py-3 cursor-pointer", !n.is_read && "bg-primary/5")}
                    onClick={() => !n.is_read && markRead.mutate(n.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{typeIcons[n.type] || "📌"}</span>
                      <p className={cn("font-medium text-sm", !n.is_read && "text-primary")}>{n.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                    <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleTimeString()}</span>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="notification-item text-center text-primary cursor-pointer justify-center"
                onClick={() => navigate("/hospital/notifications")}
              >
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-3 px-2">
                <Avatar className="h-9 w-9 border-2 border-primary/30">
                  <AvatarFallback className="bg-info/20 text-info font-medium">
                    {profile ? `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}` : <Building2 className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:flex flex-col items-start">
                  <span className="text-sm font-medium">{staffName}</span>
                  <span className="text-xs text-muted-foreground">
                    {staffRole}{hospitalName ? ` · ${hospitalName}` : ""}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 hidden lg:block text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span>{staffName}</span>
                <span className="text-xs font-normal text-muted-foreground">{hospitalName ?? "Hospital account"}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/hospital/settings")} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Hospital Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/hospital/doctors")} className="cursor-pointer">
                Staff Management
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/hospital/settings")} className="cursor-pointer">
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void signOut()} className="cursor-pointer text-destructive">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
