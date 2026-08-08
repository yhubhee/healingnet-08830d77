import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePatientProfile } from "@/hooks/usePatientData";
import {
  useUserNotifications,
  useRealtimeUserNotifications,
  useMarkUserNotificationRead,
  NOTIFICATION_ICONS,
} from "@/hooks/useUserNotifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function PatientHeader() {
  const { data: profile } = usePatientProfile();
  const navigate = useNavigate();
  useRealtimeUserNotifications();
  const { data: notifications = [] } = useUserNotifications();
  const markRead = useMarkUserNotificationRead();

  const unread = notifications.filter((n) => !n.is_read);
  const recent = notifications.slice(0, 4);

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-4 lg:px-8 h-16">
        <div className="lg:ml-0 ml-12">
          <p className="text-sm text-muted-foreground">Welcome back,</p>
          <p className="font-heading font-bold">{profile ? `${profile.first_name} ${profile.last_name}` : "Patient"}</p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative w-10 h-10 rounded-lg hover:bg-card transition-colors flex items-center justify-center">
                <Bell className="w-5 h-5" />
                {unread.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {unread.length > 9 ? "9+" : unread.length}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifications
                {unread.length > 0 && <span className="text-xs text-primary">{unread.length} new</span>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {recent.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">No notifications</div>
              ) : (
                recent.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className={cn("notification-item flex flex-col items-start gap-1 py-3 cursor-pointer", !n.is_read && "bg-primary/5")}
                    onClick={() => {
                      if (!n.is_read) markRead.mutate(n.id);
                      if (n.action_url) navigate(n.action_url);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>{NOTIFICATION_ICONS[n.type] || "📌"}</span>
                      <p className={cn("font-medium text-sm", !n.is_read && "text-primary")}>{n.title}</p>
                    </div>
                    {n.message && <p className="text-xs text-muted-foreground">{n.message}</p>}
                    <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="notification-item justify-center text-primary cursor-pointer"
                onClick={() => navigate("/patient/notifications")}
              >
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
            {profile?.first_name?.[0] || "P"}
          </div>
        </div>
      </div>
    </header>
  );
}
