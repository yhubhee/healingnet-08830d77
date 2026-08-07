import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, CheckCircle, Clock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DoctorLayout } from "@/layouts/DoctorLayout";
import {
  useUserNotifications,
  useRealtimeUserNotifications,
  useMarkUserNotificationRead,
  useMarkAllUserNotificationsRead,
  useDeleteUserNotification,
  NOTIFICATION_ICONS,
} from "@/hooks/useUserNotifications";

interface Invitation {
  id: string;
  status: string;
  created_at: string;
  hospital_name?: string;
}

export default function DoctorNotifications() {
  useRealtimeUserNotifications();
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useUserNotifications();
  const markRead = useMarkUserNotificationRead();
  const markAll = useMarkAllUserNotificationsRead();
  const remove = useDeleteUserNotification();
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: doctor } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (!doctor) return;
      const { data } = await supabase
        .from("hospital_doctors")
        .select("id, status, created_at, hospitals(name)")
        .eq("doctor_id", doctor.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      setInvitations(
        (data || []).map((inv: any) => ({
          id: inv.id,
          status: inv.status,
          created_at: inv.created_at,
          hospital_name: inv.hospitals?.name,
        }))
      );
    })();
  }, []);

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <DoctorLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-heading font-bold">Notifications</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              {invitations.length > 0 && (
                <span className="font-semibold text-warning">
                  {invitations.length} pending invitation{invitations.length > 1 ? "s" : ""} •{" "}
                </span>
              )}
              {unread > 0 ? `${unread} unread` : "You're all caught up"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={unread === 0 || markAll.isPending}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        </div>

        {invitations.map((inv) => (
          <Card key={inv.id} className="border-warning/40 bg-warning/5">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full p-2 mt-1 bg-warning/15">
                  <Clock className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <CardTitle className="text-base">Hospital invitation pending</CardTitle>
                  <CardDescription className="mt-1">
                    You have a pending invitation from {inv.hospital_name || "a hospital"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/doctor/invitations")}>
                View &amp; respond to invitation
              </Button>
            </CardContent>
          </Card>
        ))}

        {isLoading ? (
          <div className="text-center p-8 text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No notifications yet</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
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
      </div>
    </DoctorLayout>
  );
}
