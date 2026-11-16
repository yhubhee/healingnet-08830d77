// Scan to check in, for the patient pages: the lookup after scanning, checking in, today's
// place in the queue (refreshed every 30 seconds while a page shows it) and leaving the queue.
// Same database functions and wording as the app (mobile/lib/checkin.ts).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseLookup, parseStatuses, type CheckinLookup, type CheckinStatus } from "@/lib/checkin";
import { useActivePatientId } from "./usePatientData";

export const checkinStatusKey = (pid: string | undefined) => ["patient-checkin-status", pid] as const;

export function useCheckinLookup(token: string | null) {
  const pid = useActivePatientId();
  return useQuery({
    queryKey: ["patient-checkin-lookup", token, pid],
    enabled: !!token && !!pid,
    retry: false,
    meta: { inlineError: true },
    queryFn: async (): Promise<CheckinLookup> => {
      const { data, error } = await supabase.rpc("checkin_lookup", { p_token: token!, p_patient_id: pid! });
      if (error) throw error;
      const lookup = parseLookup(data);
      if (!lookup) throw new Error("This check-in code is not valid. Ask the front desk for help.");
      return lookup;
    },
  });
}

/** Today's check-ins for the person on screen. `live` refreshes every 30 seconds. */
export function useMyCheckins(live = false) {
  const pid = useActivePatientId();
  return useQuery({
    queryKey: checkinStatusKey(pid),
    enabled: !!pid,
    refetchInterval: live ? 30_000 : false,
    refetchOnWindowFocus: true,
    meta: { inlineError: true },
    queryFn: async (): Promise<CheckinStatus[]> => {
      const { data, error } = await supabase.rpc("my_checkin_status", { p_patient_id: pid! });
      if (error) throw error;
      return parseStatuses(data);
    },
  });
}

export function useSelfCheckIn() {
  const qc = useQueryClient();
  const pid = useActivePatientId();
  return useMutation({
    mutationFn: async ({ token, reason }: { token: string; reason: string }) => {
      const { data, error } = await supabase.rpc("self_check_in", { p_token: token, p_patient_id: pid!, p_reason: reason.trim() || undefined });
      if (error) throw error;
      return data as { checkin_id?: string; already?: boolean } | null;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient-checkin-status"] }),
  });
}

export function useCancelCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (checkinId: string) => {
      const { error } = await supabase.rpc("cancel_my_checkin", { p_checkin_id: checkinId });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["patient-checkin-status"] }),
  });
}

/** A bookable hospital's address and pin, by id (patients read hospitals through bookable_hospitals). */
export function useHospitalPlace(hospitalId: string | null | undefined) {
  return useQuery({
    queryKey: ["hospital-place", hospitalId],
    enabled: !!hospitalId,
    staleTime: 10 * 60_000,
    meta: { inlineError: true },
    queryFn: async () => {
      const { data, error } = await supabase.rpc("bookable_hospitals", {});
      if (error) throw error;
      return (data ?? []).find((h) => h.id === hospitalId) ?? null;
    },
  });
}
