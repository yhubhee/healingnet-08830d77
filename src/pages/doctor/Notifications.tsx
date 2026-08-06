import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Bell, CheckCircle, Clock, AlertCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DoctorLayout } from "@/layouts/DoctorLayout";

interface Notification {
  id: string;
  type: "invitation" | "hospital" | "system";
  title: string;
  message: string;
  hospital_name?: string;
  status?: "pending" | "active" | "declined";
  is_read: boolean;
  created_at: string;
  invitation_id?: string;
}

export default function DoctorNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: doctor } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!doctor) return;

      // Get pending invitations
      const { data: invitations } = await supabase
        .from("hospital_doctors")
        .select(`
          id,
          status,
          created_at,
          hospitals(name)
        `)
        .eq("doctor_id", doctor.id)
        .order("created_at", { ascending: false });

      // Get hospital notifications (from hospitals they work at)
      const { data: hospitalData } = await supabase
        .from("hospital_doctors")
        .select("hospital_id")
        .eq("doctor_id", doctor.id)
        .eq("is_active", true);

      const hospitalIds = hospitalData?.map((hd) => hd.hospital_id) || [];

      let hospitalNotifications: any[] = [];
      if (hospitalIds.length > 0) {
        const { data } = await supabase
          .from("hospital_notifications")
          .select("*")
          .in("hospital_id", hospitalIds)
          .order("created_at", { ascending: false });
        hospitalNotifications = data || [];
      }

      // Transform invitations to notifications
      const invitationNotifications: Notification[] = (invitations || []).map((inv) => ({
        id: inv.id,
        type: "invitation",
        title:
          inv.status === "pending"
            ? "Hospital Invitation Pending"
            : inv.status === "active"
              ? "Hospital Assignment Active"
              : "Hospital Invitation Declined",
        message:
          inv.status === "pending"
            ? `You have a pending invitation from ${inv.hospitals?.name || "a hospital"}`
            : inv.status === "active"
              ? `You are now assigned to ${inv.hospitals?.name || "a hospital"}`
              : `You declined the invitation from ${inv.hospitals?.name || "a hospital"}`,
        hospital_name: inv.hospitals?.name,
        status: inv.status as "pending" | "active" | "declined",
        is_read: false,
        created_at: inv.created_at,
        invitation_id: inv.id,
      }));

      // Transform hospital notifications
      const hospitalNotifsFormatted: Notification[] = (hospitalNotifications || []).map((hn) => ({
        id: hn.id,
        type: "hospital",
        title: hn.title,
        message: hn.message,
        is_read: hn.is_read,
        created_at: hn.created_at,
      }));

      // Combine and sort
      const allNotifications = [...invitationNotifications, ...hospitalNotifsFormatted].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(allNotifications);
    } catch (err) {
      console.error("Error loading notifications:", err);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteNotification(id: string) {
    try {
      await supabase.from("hospital_notifications").delete().eq("id", id);
      setNotifications(notifications.filter((n) => n.id !== id));
      toast.success("Notification deleted");
    } catch (err) {
      toast.error("Failed to delete notification");
    }
  }

  const pendingCount = notifications.filter((n) => n.type === "invitation" && n.status === "pending").length;

  if (loading) {
    return (
      <DoctorLayout>
        <div className="flex items-center justify-center p-12">
          <p className="text-muted-foreground">Loading notifications...</p>
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Notifications</h1>
          </div>
          <p className="text-muted-foreground">
            {pendingCount > 0 && (
              <span className="font-semibold text-warning">
                {pendingCount} pending invitation{pendingCount > 1 ? "s" : ""} •
              </span>
            )}
            {notifications.length} total notifications
          </p>
        </div>

        {notifications.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No notifications yet</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <Card
                key={notif.id}
                className={cn(
                  "border transition-colors",
                  notif.type === "invitation" && notif.status === "pending"
                    ? "border-yellow-200 bg-yellow-50"
                    : notif.type === "invitation" && notif.status === "active"
                      ? "border-green-200 bg-green-50"
                      : "hover:border-primary"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "rounded-full p-2 mt-1",
                          notif.type === "invitation" && notif.status === "pending"
                            ? "bg-yellow-100"
                            : notif.type === "invitation" && notif.status === "active"
                              ? "bg-green-100"
                              : "bg-blue-100"
                        )}
                      >
                        {notif.type === "invitation" && notif.status === "pending" ? (
                          <Clock className="h-4 w-4 text-yellow-700" />
                        ) : notif.type === "invitation" && notif.status === "active" ? (
                          <CheckCircle className="h-4 w-4 text-green-700" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-blue-700" />
                        )}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{notif.title}</CardTitle>
                        <CardDescription className="mt-1">{notif.message}</CardDescription>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(notif.created_at).toLocaleDateString()} •{" "}
                          {new Date(notif.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNotification(notif.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                {notif.type === "invitation" && notif.status === "pending" && notif.invitation_id && (
                  <CardContent>
                    <div className="text-sm">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => window.location.href = "/doctor/invitations"}
                      >
                        View & Respond to Invitation
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}
