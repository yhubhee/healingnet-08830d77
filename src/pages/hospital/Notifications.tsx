import { HospitalLayout } from "@/layouts/HospitalLayout";
import { CheckCircle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { useHospitalNotifications, useRealtimeNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useHospitalId } from "@/hooks/useHospitalData";
import { useNotificationSound } from "@/hooks/useNotificationSound";

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

export default function HospitalNotifications() {
  useRealtimeNotifications();
  const { data: notifications = [], isLoading } = useHospitalNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const { data: hospitalId } = useHospitalId();
  const { playSound } = useNotificationSound();

  useEffect(() => {
    const callInNotif = notifications.find((n: any) => n.type === "call_in" && !n.is_read);
    if (callInNotif) {
      playSound();
    }
  }, [notifications, playSound]);

  return (
    <HospitalLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold mb-1">Notifications</h1>
          <p className="text-muted-foreground">Hospital alerts, updates, and system notifications</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => hospitalId && markAllRead.mutate(hospitalId)} disabled={markAllRead.isPending}>
          <CheckCircle className="h-4 w-4 mr-2" />Mark all read
        </Button>
      </div>
      {isLoading ? <div className="text-center p-8 text-muted-foreground">Loading...</div> : (
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">No notifications</div>
          ) : notifications.map((n: any) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markRead.mutate(n.id)}
              className={cn("bg-card border rounded-xl p-5 flex gap-4 items-start transition-colors cursor-pointer", n.is_read ? "border-border" : "border-primary/50 bg-primary/5")}
            >
              <span className="text-xl">{typeIcons[n.type] || "📌"}</span>
              <div className="flex-1">
                <h4 className="font-heading font-bold text-sm">{n.title}</h4>
                <p className="text-sm text-muted-foreground">{n.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.is_read && <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-1" />}
            </div>
          ))}
        </div>
      )}
    </HospitalLayout>
  );
}
