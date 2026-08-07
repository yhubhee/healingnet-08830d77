import { PatientLayout } from "@/layouts/PatientLayout";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  useUserNotifications,
  useRealtimeUserNotifications,
  useMarkUserNotificationRead,
  useMarkAllUserNotificationsRead,
  useDeleteUserNotification,
  NOTIFICATION_ICONS,
} from "@/hooks/useUserNotifications";

export default function PatientNotifications() {
  useRealtimeUserNotifications();
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useUserNotifications();
  const markRead = useMarkUserNotificationRead();
  const markAll = useMarkAllUserNotificationsRead();
  const remove = useDeleteUserNotification();

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <PatientLayout>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notifications
          </h1>
          <p className="text-muted-foreground text-sm">
            {unread > 0 ? `${unread} unread` : "You're all caught up"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={unread === 0 || markAll.isPending}>
          <CheckCircle className="h-4 w-4 mr-2" />
          Mark all read
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center p-8 text-muted-foreground">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <Bell className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2 max-w-3xl">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                if (!n.is_read) markRead.mutate(n.id);
                if (n.action_url) navigate(n.action_url);
              }}
              className={cn(
                "bg-card border rounded-xl p-4 flex gap-4 items-start cursor-pointer transition-colors",
                n.is_read ? "border-border" : "border-primary/50 bg-primary/5"
              )}
            >
              <span className="text-xl">{NOTIFICATION_ICONS[n.type] || "📌"}</span>
              <div className="flex-1 min-w-0">
                <h4 className="font-heading font-bold text-sm">{n.title}</h4>
                {n.message && <p className="text-sm text-muted-foreground">{n.message}</p>}
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.is_read && <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-1" />}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  remove.mutate(n.id);
                }}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Delete notification"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </PatientLayout>
  );
}
