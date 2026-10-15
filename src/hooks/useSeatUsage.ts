import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Team seats for the staff screen. EMR Essentials (and the free trial) allows 25 team
 * members: active staff + active doctors + pending invitations. seatLimit null = unlimited
 * (Telemedicine Suite).
 */
export interface SeatUsage { activeStaff: number; activeDoctors: number; pendingInvites: number; used: number; seatLimit: number | null }

export const SEAT_QUERY_KEY = "seat-usage";

export function useSeatUsage(hospitalId: string | undefined) {
  return useQuery({
    queryKey: [SEAT_QUERY_KEY, hospitalId],
    enabled: !!hospitalId,
    queryFn: async (): Promise<SeatUsage> => {
      const { data, error } = await supabase.rpc("hospital_seat_usage", { _hospital_id: hospitalId! });
      if (error) throw error;
      const r = data?.[0];
      const activeStaff = r?.active_staff ?? 0, activeDoctors = r?.active_doctors ?? 0, pendingInvites = r?.pending_invites ?? 0;
      return { activeStaff, activeDoctors, pendingInvites, used: activeStaff + activeDoctors + pendingInvites, seatLimit: r?.seat_limit ?? null };
    },
  });
}

/** True when the database refused an addition because the plan's team limit is reached. */
export function isSeatLimitError(error: unknown): boolean {
  return (error as { hint?: string } | null)?.hint === "staff_limit_reached";
}
