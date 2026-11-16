// Care plans in the app: my_care() for the person on screen (saved for offline), ticking an
// item, and keeping the phone's own reminders in step with every plan in the family.
// Nothing here logs a title, a date or a name.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { parseCare, planCareAlerts, type CareData } from "@/shared/care";
import type { FamilyMember } from "@/shared/family";
import { familyKey } from "@/shared/keys";
import { queryClient } from "./query";
import { careNotificationArrived, setCarePlans } from "./reminders";
import { usePatient, useSession } from "./session";
import { supabase } from "./supabase";

export const careKey = (patientId: string | null | undefined) => ["care", patientId ?? null] as const;

async function fetchCare(patientId: string): Promise<CareData> {
  const { data, error } = await supabase.rpc("my_care", { p_patient_id: patientId });
  if (error) throw error;
  return parseCare(data);
}

/** The care plan of the person on screen. */
export function useCare() {
  const { patientId } = usePatient();
  return useQuery({ queryKey: careKey(patientId), enabled: !!patientId, queryFn: () => fetchCare(patientId!) });
}

/** The patient ticks a test, medicine, to-do or instruction (the database refuses visits). */
export function useSetCareItemDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.rpc("set_care_item_done", { p_item_id: id, p_done: done });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["care"] }),
  });
}

// ---- Reminders on the phone ---------------------------------------------------------------
const SYNC_EVERY_MS = 10 * 60_000;

/**
 * Mounted once for a signed-in patient. Works out the phone's care reminders:
 *   - whenever a care plan in the cache changes (opening Care, ticking an item, a hospital
 *     change arriving), for that person;
 *   - when the app opens or comes back (at most every 10 minutes), for the patient and
 *     every family member whose records are open, so a child's plan reminds too;
 *   - and drops the alert a server notification has already covered.
 * Sign-out cancels everything (cancelAllReminders).
 */
export function useCareSync(active: boolean) {
  const { userId, patientId: ownId } = useSession();
  const last = useRef(0);

  useEffect(() => {
    if (!active || !ownId) return;
    const family = () => (queryClient.getQueryData<FamilyMember[]>(familyKey(userId)) ?? []).filter((m) => m.access_ok !== false);
    const who = (patientId: string) => {
      if (patientId === ownId) return { patientId: null as string | null };
      const m = family().find((f) => f.patient_id === patientId);
      return m ? { patientId, person: m.first_name } : null;
    };

    // 1. A plan in the cache changed.
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const q = event.query;
      if (event.type !== "updated" || q.queryKey[0] !== "care" || q.state.status !== "success") return;
      const id = q.queryKey[1];
      const person = typeof id === "string" ? who(id) : null;
      if (!person || !q.state.data) return;
      setCarePlans([{ patientId: person.patientId, alerts: planCareAlerts(q.state.data as CareData, new Date(), person) }]).catch(() => {});
    });

    // 2. Everyone's plans, on open and on return.
    const all = async () => {
      if (Date.now() - last.current < SYNC_EVERY_MS) return;
      last.current = Date.now();
      try {
        const people = [ownId, ...family().map((m) => m.patient_id)];
        await Promise.all(people.map((id) => queryClient.fetchQuery({ queryKey: careKey(id), queryFn: () => fetchCare(id), staleTime: 60_000 }).catch(() => null)));
        // 3. Server notifications from the last day that this phone may have missed while closed.
        const since = new Date(Date.now() - 26 * 3_600_000).toISOString();
        const { data } = await supabase.from("user_notifications").select("reference_id, created_at").eq("type", "care").gte("created_at", since).limit(50);
        for (const n of data ?? []) if (n.reference_id) await careNotificationArrived(n.reference_id, new Date(n.created_at));
      } catch { /* offline: the saved alerts stay as they are */ }
    };
    all();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") all(); });
    return () => { unsubscribe(); sub.remove(); };
  }, [active, ownId, userId]);
}
