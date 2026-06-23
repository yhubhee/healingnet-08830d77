import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DoctorLayout } from "@/layouts/DoctorLayout";

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
        toast({ title: "Doctor profile not found", variant: "destructive" });
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
      toast({ title: "Failed to load invitations", variant: "destructive" });
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(invitationId: string) {
    try {
      console.log("Accepting invitation:", invitationId);
      const { error } = await supabase
        .from("hospital_doctors")
        .update({ status: "active" })
        .eq("id", invitationId);

      if (error) {
        console.error("Update error:", error);
        throw error;
      }

      console.log("Invitation accepted successfully, reloading...");
      toast({ title: "Invitation accepted!" });
      await loadInvitations();
      console.log("Invitations reloaded:", invitations);
    } catch (err: any) {
      console.error("handleAccept error:", err);
      toast({ title: "Failed to accept invitation", variant: "destructive" });
    }
  }

  async function handleDecline(invitationId: string) {
    try {
      console.log("Declining invitation:", invitationId);
      const { error } = await supabase
        .from("hospital_doctors")
        .update({ status: "declined" })
        .eq("id", invitationId);

      if (error) {
        console.error("Update error:", error);
        throw error;
      }

      console.log("Invitation declined successfully, reloading...");
      toast({ title: "Invitation declined" });
      await loadInvitations();
      console.log("Invitations reloaded:", invitations);
    } catch (err: any) {
      console.error("handleDecline error:", err);
      toast({ title: "Failed to decline invitation", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <DoctorLayout>
        <div className="flex items-center justify-center p-12">
          <p className="text-muted-foreground">Loading invitations...</p>
        </div>
      </DoctorLayout>
    );
  }

  const pending = invitations.filter((i) => i.status === "pending");
  const accepted = invitations.filter((i) => i.status === "active");
  const declined = invitations.filter((i) => i.status === "declined");

  return (
    <DoctorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Hospital Invitations</h1>
          <p className="text-muted-foreground">
            Manage your hospital assignments and invitations
          </p>
        </div>

        {pending.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Pending Invitations ({pending.length})
            </h2>
            {pending.map((inv) => (
              <Card key={inv.id} className="border-yellow-300 bg-yellow-100">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-slate-900">{inv.hospitals.name}</CardTitle>
                      <CardDescription className="text-slate-700">
                        {inv.hospitals.city} • {inv.hospitals.phone}
                      </CardDescription>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 bg-yellow-200 text-yellow-900 rounded-full">
                      Awaiting Response
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-700 font-medium">Employment</p>
                      <p className="font-semibold text-slate-900 capitalize">
                        {inv.employment_type.replace("_", " ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-700 font-medium">Department</p>
                      <p className="font-semibold text-slate-900">{inv.department || "—"}</p>
                    </div>
                    <div>
                      <p className="text-slate-700 font-medium">Salary</p>
                      <p className="font-semibold text-slate-900">₦{inv.salary?.toLocaleString() || "—"}</p>
                    </div>
                    <div>
                      <p className="text-slate-700 font-medium">Commission</p>
                      <p className="font-semibold text-slate-900">{inv.commission_rate || 0}%</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button
                      className="flex-1 bg-slate-700 hover:bg-slate-800 text-white"
                      onClick={() => handleDecline(inv.id)}
                    >
                      Decline
                    </Button>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleAccept(inv.id)}
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
              <CheckCircle className="h-5 w-5 text-green-600" />
              Accepted ({accepted.length})
            </h2>
            {accepted.map((inv) => (
              <Card key={inv.id} className="border-green-300 bg-green-100">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-slate-900">{inv.hospitals.name}</CardTitle>
                      <CardDescription className="text-slate-700">
                        {inv.hospitals.city} • {inv.hospitals.phone}
                      </CardDescription>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 bg-green-200 text-green-900 rounded-full">
                      Active
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-700 font-medium">Employment</p>
                      <p className="font-semibold text-slate-900 capitalize">
                        {inv.employment_type.replace("_", " ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-700 font-medium">Department</p>
                      <p className="font-semibold text-slate-900">{inv.department || "—"}</p>
                    </div>
                    <div>
                      <p className="text-slate-700 font-medium">Salary</p>
                      <p className="font-semibold text-slate-900">₦{inv.salary?.toLocaleString() || "—"}</p>
                    </div>
                    <div>
                      <p className="text-slate-700 font-medium">Commission</p>
                      <p className="font-semibold text-slate-900">{inv.commission_rate || 0}%</p>
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
              <XCircle className="h-5 w-5 text-red-600" />
              Declined ({declined.length})
            </h2>
            {declined.map((inv) => (
              <Card key={inv.id} className="border-red-300 bg-red-100">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-slate-900">{inv.hospitals.name}</CardTitle>
                      <CardDescription className="text-slate-700">
                        {inv.hospitals.city} • {inv.hospitals.phone}
                      </CardDescription>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 bg-red-200 text-red-900 rounded-full">
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
    </DoctorLayout>
  );
}
