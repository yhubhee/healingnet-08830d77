// Scan to check in: the lookup after scanning, checking in, today's place in the queue and
// leaving it. Same database functions as the website (src/hooks/useCheckin.ts). Nothing
// here logs a code, a hospital or a person.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseLookup, parseStatuses, type CheckinLookup, type CheckinStatus } from "@/shared/checkin";
import { usePatient } from "./session";
import { supabase } from "./supabase";

export const checkinStatusKey = (patientId: string | null) => ["checkin-status", patientId] as const;

export function useCheckinLookup(token: string | null) {
  const { patientId } = usePatient();
  return useQuery({
    queryKey: ["checkin-lookup", token, patientId],
    enabled: !!token && !!patientId,
    retry: false,
    gcTime: 0,
    queryFn: async (): Promise<CheckinLookup> => {
      const { data, error } = await supabase.rpc("checkin_lookup", { p_token: token!, p_patient_id: patientId! });
      if (error) throw error;
      const lookup = parseLookup(data);
      if (!lookup) throw new Error("This check-in code is not valid. Ask the front desk for help.");
      return lookup;
    },
  });
}

/** Today's check-ins for the person on screen. `everyMs` refreshes while a screen shows them. */
export function useMyCheckins(everyMs?: number) {
  const { patientId } = usePatient();
  return useQuery({
    queryKey: checkinStatusKey(patientId),
    enabled: !!patientId,
    refetchInterval: everyMs ?? false,
    staleTime: 20_000,
    queryFn: async (): Promise<CheckinStatus[]> => {
      const { data, error } = await supabase.rpc("my_checkin_status", { p_patient_id: patientId! });
      if (error) throw error;
      return parseStatuses(data);
    },
  });
}

export function useSelfCheckIn() {
  const qc = useQueryClient();
  const { patientId } = usePatient();
  return useMutation({
    mutationFn: async ({ token, reason }: { token: string; reason: string }) => {
      const { error } = await supabase.rpc("self_check_in", { p_token: token, p_patient_id: patientId!, p_reason: reason.trim() || undefined });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checkin-status"] }),
  });
}

export function useCancelCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (checkinId: string) => {
      const { error } = await supabase.rpc("cancel_my_checkin", { p_checkin_id: checkinId });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["checkin-status"] }),
  });
}

/** A bookable hospital's address and pin, by id. */
export function useHospitalPlace(hospitalId: string | null | undefined) {
  return useQuery({
    queryKey: ["hospital-place", hospitalId],
    enabled: !!hospitalId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("bookable_hospitals", {});
      if (error) throw error;
      return (data ?? []).find((h) => h.id === hospitalId) ?? null;
    },
  });
}
