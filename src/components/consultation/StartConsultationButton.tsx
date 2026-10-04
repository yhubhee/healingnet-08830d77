import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Play, RotateCcw, FileText } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

/** Map of appointment_id -> consultation status ("in_progress" | "submitted"). */
export function useConsultationStatus(appointmentIds: string[]) {
  const ids = [...new Set(appointmentIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: ["doctor", "consultation-status", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await sb.from("consultations").select("id, appointment_id, submitted_at").in("appointment_id", ids);
      if (error) throw error;
      const m: Record<string, { id: string; submitted: boolean }> = {};
      for (const c of data || []) {
        const prev = m[c.appointment_id];
        if (!prev || (prev.submitted && !c.submitted_at)) m[c.appointment_id] = { id: c.id, submitted: !!c.submitted_at };
      }
      return m;
    },
  });
}

export function StartConsultationButton({ appointment, status, size, className }: { appointment: any; status?: { id: string; submitted: boolean }; size?: "sm" | "default"; className?: string }) {
  const [busy, setBusy] = useState(false);
  const label = !status ? "Start consultation" : status.submitted ? "View consultation" : "Resume consultation";
  const Icon = !status ? Play : status.submitted ? FileText : RotateCcw;
  return (
    <Button size={size} variant={status?.submitted ? "outline" : "default"} disabled={busy} className={className} onClick={async (e) => {
      e.stopPropagation();
      if (status) return window.location.assign(`/doctor/consultation/${status.id}`);
      setBusy(true);
      const { data, error } = await sb.rpc("start_consultation", { p_patient_id: appointment.patient_id, p_appointment_id: appointment.id });
      setBusy(false);
      if (error) return toast.error(error.message);
      window.location.assign(`/doctor/consultation/${data}`);
    }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}{label}</Button>
  );
}
