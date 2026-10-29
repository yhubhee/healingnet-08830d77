import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";

// Every list that shows an appointment, for any role.
const APPOINTMENT_KEYS = [
  ["hospital", "appointments"],
  ["hospital", "appointments-pending"],
  ["doctor", "appointments"],
  ["doctor", "open-requests"],
  ["doctor", "badges"],
  ["doctor", "dashboard"],
  ["patient", "appointments"],
  ["patient-appointments"],
];

export function useInvalidateAppointments() {
  const qc = useQueryClient();
  return () => APPOINTMENT_KEYS.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
}

// The appointment functions raise plain-English messages; show them as they are.
export function appointmentError(e: unknown): string {
  const msg = (e as any)?.message;
  if (typeof msg === "string" && msg && !/failed to fetch|network/i.test(msg)) return msg;
  return friendlyError(e);
}

export function useAssignDoctor() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: async ({ id, doctorId, accept = true }: { id: string; doctorId: string; accept?: boolean }) => {
      const { error } = await supabase.rpc("appointment_assign_doctor", { p_appointment_id: id, p_doctor_id: doctorId, p_accept: accept });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useClaimAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("appointment_claim", { p_appointment_id: id });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useRespondToAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: async ({ id, accept, reason }: { id: string; accept: boolean; reason?: string }) => {
      const { error } = await supabase.rpc("appointment_respond", { p_appointment_id: id, p_accept: accept, p_reason: reason });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

// Cancelling is a plain status change; RLS and the guard trigger decide who may do it.
export function useCancelAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patient_appointments").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}
