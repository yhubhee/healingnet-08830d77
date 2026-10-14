// /doctor/hospitals: every hospital this doctor is linked to, with invite responses.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Check, CircleSlash, Clock, Loader2, X } from "lucide-react";
import { DoctorLayout } from "@/layouts/DoctorLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyError } from "@/lib/errors";
import { fmtLongDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useDoctor } from "@/hooks/useDoctor";

interface Link {
  id: string;
  status: string;
  is_active: boolean;
  department: string | null;
  employment_type: string | null;
  contract_start: string | null;
  created_at: string;
  updated_at: string;
  hospitals: { name: string; city: string | null; state: string | null; logo_url: string | null } | null;
}

type State = "active" | "invited" | "ended";
const stateOf = (l: Link): State => (l.status === "pending" ? "invited" : l.status === "active" && l.is_active ? "active" : "ended");

const BADGE: Record<State, { label: string; cls: string; icon: typeof Check }> = {
  active: { label: "Active", cls: "bg-success/10 text-success border-success/30", icon: Check },
  invited: { label: "Invited (pending)", cls: "bg-warning/10 text-warning border-warning/30", icon: Clock },
  ended: { label: "Ended", cls: "bg-muted text-muted-foreground border-border", icon: CircleSlash },
};

const titleCase = (s: string | null) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null);

export default function DoctorHospitals() {
  const qc = useQueryClient();
  const { data: ctx } = useDoctor();
  const doctorId = ctx?.doctor?.id;
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["doctor", "hospital-links", doctorId],
    enabled: !!doctorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospital_doctors")
        .select("id, status, is_active, department, employment_type, contract_start, created_at, updated_at, hospitals(name, city, state, logo_url)")
        .eq("doctor_id", doctorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Link[];
    },
  });

  const respond = async (l: Link, accept: boolean) => {
    setBusy(l.id);
    const { error } = await supabase.rpc("respond_to_invitation", { p_link_id: l.id, p_accept: accept });
    setBusy(null);
    if (error) { toast.error(accept ? "Couldn't accept the invitation" : "Couldn't decline the invitation", { description: error.message || friendlyError(error) }); return; }
    toast.success(accept ? `You've joined ${l.hospitals?.name ?? "the hospital"}` : "Invitation declined");
    qc.invalidateQueries({ queryKey: ["doctor"] });
  };

  const rows = q.data ?? [];
  const order: State[] = ["invited", "active", "ended"];
  const sorted = [...rows].sort((a, b) => order.indexOf(stateOf(a)) - order.indexOf(stateOf(b)));

  return (
    <DoctorLayout>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-heading font-bold">My hospitals</h1>
        <p className="text-sm text-muted-foreground mb-5">Hospitals you work with on HealingNet, and invitations waiting for your answer.</p>

        {q.isLoading || !doctorId ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        ) : q.isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm">
            Couldn't load your hospitals. <Button variant="link" className="px-1" onClick={() => q.refetch()}>Retry</Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <Building2 className="w-8 h-8 mx-auto text-muted-foreground mb-2" aria-hidden />
            <p className="text-sm text-muted-foreground">You're not linked to any hospital yet. Hospitals invite doctors from their dashboard.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {sorted.map((l) => {
              const s = stateOf(l);
              const b = BADGE[s];
              const h = l.hospitals;
              return (
                <li key={l.id} className={cn("bg-card border rounded-xl p-4", s === "invited" ? "border-warning/40" : "border-border")}>
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 shrink-0 rounded-lg bg-muted overflow-hidden flex items-center justify-center">
                      {h?.logo_url ? <img src={h.logo_url} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-6 h-6 text-muted-foreground" aria-hidden />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-heading font-bold truncate">{h?.name ?? "Hospital"}</h2>
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", b.cls)}><b.icon className="w-3 h-3" aria-hidden />{b.label}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{[h?.city, h?.state].filter(Boolean).join(", ") || "Location not set"}</p>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                        <div><dt className="text-xs text-muted-foreground">Department</dt><dd>{l.department || "—"}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Employment</dt><dd>{titleCase(l.employment_type) || "—"}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">{s === "invited" ? "Invited" : "Joined"}</dt><dd>{fmtLongDate(s === "invited" ? l.created_at : l.contract_start || l.updated_at)}</dd></div>
                      </dl>
                    </div>
                  </div>
                  {s === "invited" && (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <p className="text-xs text-muted-foreground sm:mr-auto sm:self-center">Accepting lets this hospital book you and share its patients' records with you.</p>
                      <Button variant="outline" disabled={busy === l.id} onClick={() => respond(l, false)}><X className="w-4 h-4 mr-1" />Decline</Button>
                      <Button disabled={busy === l.id} onClick={() => respond(l, true)}>{busy === l.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}Accept</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DoctorLayout>
  );
}
