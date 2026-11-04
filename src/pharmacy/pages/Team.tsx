import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/common/QueryState";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { fmtDate, useMyPharmacy } from "@/lib/pharmacy";

type Member = {
  id: string; user_id: string; first_name: string; last_name: string; role: "owner" | "pharmacist" | "assistant";
  pcn_reg_no: string | null; licence_expiry: string | null; verification_status: string; is_active: boolean;
};

const ROLE: Record<Member["role"], string> = { owner: "Owner", pharmacist: "Pharmacist", assistant: "Assistant" };

function badge(m: Member) {
  if (!m.is_active) return { text: "Turned off", cls: "bg-muted text-muted-foreground" };
  if (m.role === "assistant" || !m.pcn_reg_no) return { text: "No PCN needed", cls: "bg-muted text-muted-foreground" };
  if (m.licence_expiry && new Date(m.licence_expiry + "T23:59:59") < new Date()) return { text: "Licence expired", cls: "bg-destructive/15 text-destructive" };
  if (m.verification_status === "approved") return { text: "Verified", cls: "bg-success/15 text-success" };
  if (m.verification_status === "rejected") return { text: "Not verified", cls: "bg-destructive/15 text-destructive" };
  return { text: "Being checked", cls: "bg-warning/15 text-warning" };
}

export default function PharmacyTeam() {
  const qc = useQueryClient();
  const { data: me } = useMyPharmacy();
  const pid = me?.pharmacy.id;
  const isOwner = me?.member.role === "owner";
  const code = me?.pharmacy.join_code;

  const { data = [], isLoading, isError, error, refetch } = useQuery({
    enabled: !!pid,
    queryKey: ["pharmacy", "team", pid],
    queryFn: async () => {
      const { data, error } = await supabase.from("pharmacy_members")
        .select("id, user_id, first_name, last_name, role, pcn_reg_no, licence_expiry, verification_status, is_active")
        .eq("pharmacy_id", pid!).order("created_at");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
    meta: { inlineError: true },
  });

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch {
      toast.error("Couldn't copy. Select the code and copy it yourself.");
    }
  }

  async function setActive(m: Member, active: boolean) {
    const { error } = await supabase.rpc("pharmacy_set_member_active", { p_member_id: m.id, p_active: active });
    if (error) return toast.error(friendlyError(error));
    toast.success(active ? `${m.first_name} is turned back on` : `${m.first_name} is turned off`);
    qc.invalidateQueries({ queryKey: ["pharmacy", "team"] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="mb-1 font-heading text-2xl font-bold">Team</h1>
        <p className="text-sm text-muted-foreground">Everyone who works at {me?.pharmacy.name ?? "this pharmacy"} on HealingNet.</p>
      </div>

      {isOwner && code && (
        <section className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-medium">Share this code with your pharmacists</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-card px-3 py-2 font-mono text-xl font-bold tracking-widest" data-testid="join-code">{code}</code>
            <Button variant="outline" onClick={copy}><Copy className="h-4 w-4" aria-hidden />Copy</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">They choose “Pharmacist joining a pharmacy” when they sign up and enter this code.</p>
        </section>
      )}

      <QueryState isLoading={isLoading || !pid} isError={isError} error={error} onRetry={() => refetch()} isEmpty={data.length === 0} emptyMessage="No team members yet.">
        <ul className="space-y-2">
          {data.map((m) => {
            const b = badge(m);
            const self = m.id === me?.member.id;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{`${m.first_name} ${m.last_name}`.trim()}{self ? " (you)" : ""}</p>
                  <p className="text-sm text-muted-foreground">
                    {ROLE[m.role]}{m.pcn_reg_no ? ` · PCN ${m.pcn_reg_no}` : ""}{m.licence_expiry ? ` · licence to ${fmtDate(m.licence_expiry)}` : ""}
                  </p>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", b.cls)}>{b.text}</span>
                {isOwner && !self && (
                  <Button size="sm" variant="outline" onClick={() => setActive(m, !m.is_active)}>{m.is_active ? "Turn off" : "Turn on"}</Button>
                )}
              </li>
            );
          })}
        </ul>
      </QueryState>
    </div>
  );
}
