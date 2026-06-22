import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DoctorInvitations() {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadInvitations();
  }, []);

  async function loadInvitations() {
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

      if (!doctor) {
        toast.error("Doctor profile not found");
        return;
      }

      const { data } = await supabase
        .from("hospital_doctors")
        .select(`
          id,
          status,
          employment_type,
          department,
          salary,
          commission_rate,
          created_at,
          hospitals(name, city, phone),
          hospital_id
        `)
        .eq("doctor_id", doctor.id)
        .order("created_at", { ascending: false });

      setInvitations(data || []);
    } catch (err: any) {
      toast.error("Failed to load invitations");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(invitationId: string, hospitalId: string) {
    try {
      const { error } = await supabase
        .from("hospital_doctors")
        .update({ status: "active" })
        .eq("id", invitationId);

      if (error) throw error;

      const { data: hospital } = await supabase
        .from("hospitals")
        .select("name")
        .eq("id", hospitalId)
        .single();

      const { data: admin } = await supabase
        .from("hospital_staff")
        .select("email")
        .eq("hospital_id", hospitalId)
        .eq("role", "admin")
        .limit(1)
        .single();

      fetch(new URL("/functions/v1/send-doctor-notification", import.meta.env.VITE_SUPABASE_URL).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId,
          doctorName: "A doctor",
          action: "added",
          adminEmail: admin?.email || "",
          details: `Dr. accepted assignment at ${hospital?.name}`,
        }),
      }).catch(() => {});

      toast.success("Invitation accepted!");
      loadInvitations();
    } catch (err: any) {
      toast.error("Failed to accept invitation");
    }
  }

  async function handleDecline(invitationId: string) {
    try {
      const { error } = await supabase
        .from("hospital_doctors")
        .update({ status: "declined" })
        .eq("id", invitationId);

      if (error) throw error;
      toast.success("Invitation declined");
      loadInvitations();
    } catch (err: any) {
      toast.error("Failed to decline invitation");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading invitations...</p>
      </div>
    );
  }

  const pending = invitations.filter((i) => i.status === "pending");
  const accepted = invitations.filter((i) => i.status === "active");
  const declined = invitations.filter((i) => i.status === "declined");

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Hospital Invitations</h1>
          <p className="text-muted-foreground">
            Manage your hospital assignments and invitations
          </p>
        </div>

        {pending.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Pending Invitations ({pending.length})
            </h2>
            {pending.map((inv) => (
              <Card key={inv.id} className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{inv.hospitals.name}</CardTitle>
                      <CardDescription>
                        {inv.hospitals.city} • {inv.hospitals.phone}
                      </CardDescription>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                      Awaiting Response
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Employment</p>
                      <p className="font-medium capitalize">
                        {inv.employment_type.replace("_", " ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Department</p>
                      <p className="font-medium">{inv.department || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Salary</p>
                      <p className="font-medium">₦{inv.salary?.toLocaleString() || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Commission</p>
                      <p className="font-medium">{inv.commission_rate || 0}%</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleDecline(inv.id)}
                    >
                      Decline
                    </Button>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleAccept(inv.id, inv.hospital_id)}
                    >
                      Accept
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        )}

        {accepted.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Accepted ({accepted.length})
            </h2>
            {accepted.map((inv) => (
              <Card key={inv.id} className="border-green-200 bg-green-50">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{inv.hospitals.name}</CardTitle>
                      <CardDescription>
                        {inv.hospitals.city} • {inv.hospitals.phone}
                      </CardDescription>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded-full">
                      Active
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Employment</p>
                      <p className="font-medium capitalize">
                        {inv.employment_type.replace("_", " ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Department</p>
                      <p className="font-medium">{inv.department || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Salary</p>
                      <p className="font-medium">₦{inv.salary?.toLocaleString() || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Commission</p>
                      <p className="font-medium">{inv.commission_rate || 0}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        )}

        {declined.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Declined ({declined.length})
            </h2>
            {declined.map((inv) => (
              <Card key={inv.id} className="border-red-200 bg-red-50 opacity-75">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{inv.hospitals.name}</CardTitle>
                      <CardDescription>
                        {inv.hospitals.city} • {inv.hospitals.phone}
                      </CardDescription>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 bg-red-100 text-red-700 rounded-full">
                      Declined
                    </span>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </section>
        )}

        {invitations.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No invitations yet</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
