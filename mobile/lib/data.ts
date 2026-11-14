// Data hooks. Each one mirrors a query or database function the website already uses
// (same tables, same functions, same filters); the comment on each names its source.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useId, useRef } from "react";
import { realtimeFallback } from "@/shared/messages";
import type { PushPrefs, Tables } from "@/shared/database";
import type { CheckResult, PatientRequest, RxPayload } from "@/shared/pharmacy";
import { personKeys } from "@/shared/keys";
import { parseVisits, type VisitsData } from "@/shared/visits";
import { usePatient, useSession } from "./session";
import { supabase } from "./supabase";

/** Runs work once the current screen has been drawn (two frames on). Returns a cancel function. */
function afterPaint(work: () => void): () => void {
  let second = 0;
  const first = requestAnimationFrame(() => { second = requestAnimationFrame(work); });
  return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
}

// ---- Appointments (src/pages/patient/Appointments.tsx) ----------------------------------
// The patient id in every key is the active person's (lib/session.ts usePatient), and no
// query shows the previous key's rows while it loads: switching person can never show one
// person's data under another's name. Their saved data shows at once instead.
export const appointmentsKey = (patientId: string | null) => personKeys.appointments(patientId);

/**
 * One call (my_visits): every open visit and the latest 30 past ones, each with its doctor,
 * hospital and the patient's rating. `pastOffset` loads an older page of past visits.
 * Up to 0.3 this was every visit ever, then doctors and hospitals, then ratings: four requests.
 */
export async function fetchVisits(patientId: string, pastOffset = 0): Promise<VisitsData> {
  const { data, error } = await supabase.rpc("my_visits", { p_patient_id: patientId, p_past_offset: pastOffset });
  if (error) throw error;
  return parseVisits(data);
}

/** Upcoming and past visits. Saved on the phone, so the list shows at once and refreshes behind. */
export function useVisits() {
  const { patientId } = usePatient();
  return useQuery({
    queryKey: appointmentsKey(patientId),
    enabled: !!patientId,
    queryFn: () => fetchVisits(patientId!),
  });
}

/** Cancelling is a plain status change; the database decides who may do it (useCancelAppointment on the website). */
export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patient_appointments").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["appointments"] }); qc.invalidateQueries({ queryKey: ["family-next"] }); },
  });
}

/** Same update as the website's RescheduleAppointmentDialog. */
export function useRescheduleAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, date, time }: { id: string; date: string; time: string }) => {
      const { error } = await supabase.from("patient_appointments").update({ requested_date: date, requested_time: time }).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["appointments"] }); qc.invalidateQueries({ queryKey: ["family-next"] }); },
  });
}

// ---- Visit ratings (rate_appointment). Each visit carries its own rating (my_visits). ------

/** Rates a completed visit, or replaces the rating. The database checks who, what and when. */
export function useRateVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ appointmentId, rating, comment }: { appointmentId: string; rating: number; comment: string }) => {
      const { error } = await supabase.rpc("rate_appointment", { p_appointment_id: appointmentId, p_rating: rating, p_comment: comment.trim() || undefined });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["booking", "doctors"] });
    },
  });
}

// ---- Prescriptions (src/pages/patient/Prescriptions.tsx) --------------------------------
const MAX_DOCS = 40;

async function fetchRxDocuments(patientId: string): Promise<RxPayload[]> {
  const { data, error } = await supabase.from("prescriptions").select("rx_document_id, created_at")
    .eq("patient_id", patientId).not("rx_document_id", "is", null).order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  const ids = [...new Set((data ?? []).map((r) => r.rx_document_id as string))].slice(0, MAX_DOCS);
  const out = await Promise.all(ids.map(async (id) => {
    const res = await supabase.rpc("rx_document", { p_document_id: id });
    if (res.error) throw res.error;
    return res.data as unknown as RxPayload;
  }));
  return out.filter((d) => d && d.status !== "not_found")
    .sort((a, b) => +new Date(b.issued_at ?? 0) - +new Date(a.issued_at ?? 0));
}

export function useRxDocuments() {
  const { patientId } = usePatient();
  return useQuery({
    queryKey: personKeys.rxDocuments(patientId),
    enabled: !!patientId,
    queryFn: () => fetchRxDocuments(patientId!),
  });
}

/**
 * Warms the lists behind the tabs as soon as the app opens (Visits and Prescriptions), so
 * the first tap on a tab finds its data already there. Saved data that is still fresh is
 * left alone; anything older is refreshed in the background.
 */
export function usePrefetchTabs(active: boolean) {
  const qc = useQueryClient();
  const { patientId } = usePatient();
  useEffect(() => {
    if (!active || !patientId) return;
    return afterPaint(() => {
      qc.prefetchQuery({ queryKey: appointmentsKey(patientId), queryFn: () => fetchVisits(patientId) });
      qc.prefetchQuery({ queryKey: personKeys.rxDocuments(patientId), queryFn: () => fetchRxDocuments(patientId) });
    });
  }, [active, patientId, qc]);
}

export interface RxExtras {
  requests: PatientRequest[];
  reviews: Record<string, number>;
  checks: Record<string, CheckResult>;
}

export function useRxExtras() {
  const { patientId } = usePatient();
  return useQuery({
    queryKey: personKeys.rxRequests(patientId),
    enabled: !!patientId,
    queryFn: async (): Promise<RxExtras> => {
      const [req, rev, chk] = await Promise.all([
        supabase.from("rx_pharmacy_requests").select("*, pharmacies(name)").eq("patient_id", patientId!).order("created_at", { ascending: false }).limit(300),
        supabase.from("pharmacy_reviews").select("request_id, rating").eq("patient_id", patientId!),
        supabase.from("medicine_checks").select("prescription_id, result, created_at").eq("patient_id", patientId!).order("created_at", { ascending: false }).limit(500),
      ]);
      const e = req.error || rev.error || chk.error;
      if (e) throw e;
      const reviews: Record<string, number> = {};
      (rev.data ?? []).forEach((r) => { reviews[r.request_id] = r.rating; });
      const checks: Record<string, CheckResult> = {};
      (chk.data ?? []).forEach((c) => { if (c.prescription_id && !checks[c.prescription_id]) checks[c.prescription_id] = c.result as CheckResult; });
      return { requests: (req.data ?? []) as unknown as PatientRequest[], reviews, checks };
    },
  });
}

export function useRefreshRx() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["rx-requests"] });
    qc.invalidateQueries({ queryKey: ["rx-documents"] });
  };
}

// ---- Notifications (src/hooks/useUserNotifications.ts) ----------------------------------
export type UserNotification = Tables<"user_notifications">;

export function useNotifications() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async (): Promise<UserNotification[]> => {
      const { data, error } = await supabase.from("user_notifications").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface HomeSummary {
  unreadCount: number;
  /** The latest 3 unread notifications. */
  updates: Pick<UserNotification, "id" | "title" | "message" | "type" | "action_url" | "reference_id" | "created_at" | "subject_patient_id">[];
}

/** The Home screen's "Updates" and bell count, from the same notifications table. Saved for offline use. */
export function useHomeSummary() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ["home-summary", userId],
    enabled: !!userId,
    queryFn: async (): Promise<HomeSummary> => {
      const { data, error, count } = await supabase.from("user_notifications")
        .select("id, title, message, type, action_url, reference_id, created_at, subject_patient_id", { count: "exact" })
        .eq("is_read", false).order("created_at", { ascending: false }).limit(3);
      if (error) throw error;
      return { unreadCount: count ?? data?.length ?? 0, updates: data ?? [] };
    },
  });
}

function useInvalidateNotifications() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["home-summary"] });
  };
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const { userId } = useSession();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase.from("user_notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// ---- Notification preferences (push switches; table notification_preferences) -----------
export const DEFAULT_PUSH_PREFS: PushPrefs = {
  push_enabled: true,
  push_appointments: true,
  push_prescriptions: true,
  push_lab_results: true,
  push_other: true,
  push_show_details: false,
};

export function usePushPrefs() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ["notification-prefs", userId],
    enabled: !!userId,
    queryFn: async (): Promise<PushPrefs> => {
      const { data, error } = await supabase.from("notification_preferences")
        .select("push_enabled, push_appointments, push_prescriptions, push_lab_results, push_other, push_show_details")
        .eq("user_id", userId!).maybeSingle();
      if (error) throw error;
      // No row yet means the defaults (push on, details off), as in the database.
      return data ?? DEFAULT_PUSH_PREFS;
    },
  });
}

/** Creates the user's row if it doesn't exist, otherwise updates only the switches that changed. */
export function useSavePushPrefs() {
  const { userId } = useSession();
  const qc = useQueryClient();
  const key = ["notification-prefs", userId];
  return useMutation({
    mutationFn: async (patch: Partial<PushPrefs>) => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase.from("notification_preferences").upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<PushPrefs>(key);
      qc.setQueryData<PushPrefs>(key, { ...(before ?? DEFAULT_PUSH_PREFS), ...patch });
      return { before };
    },
    onError: (_e, _patch, ctx) => { if (ctx?.before) qc.setQueryData(key, ctx.before); },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

// ---- Realtime ---------------------------------------------------------------------------
/**
 * Refetches the given queries when a table changes. The subscription is opened after the
 * screen has drawn, and only while the screen is in front: a hidden tab holds no socket
 * subscription. Coming back to the screen refetches once, to catch what was missed.
 *
 * `fallbackMs`: while the live connection is down (no signal, a dropped socket), refetch on
 * this slow timer instead, and stop as soon as the connection is back. Nothing is polled
 * while Realtime is connected.
 */
export function useRealtime(
  table: string, filter: string | null | undefined, queryKeys: readonly (readonly unknown[])[], enabled = true, fallbackMs?: number,
) {
  const qc = useQueryClient();
  const instance = useId();
  const keys = JSON.stringify(queryKeys);
  const seen = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!enabled || filter === null) return;
      const invalidate = () => (JSON.parse(keys) as unknown[][]).forEach((queryKey) => qc.invalidateQueries({ queryKey }));
      if (seen.current) invalidate();
      seen.current = true;
      let channel: ReturnType<typeof supabase.channel> | null = null;
      let fallback: ReturnType<typeof setInterval> | null = null;
      const stopFallback = () => { if (fallback) { clearInterval(fallback); fallback = null; } };
      const cancel = afterPaint(() => {
        channel = supabase
          .channel(`rt-${table}-${instance}`)
          .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, invalidate)
          .subscribe((status) => {
            const next = realtimeFallback(status, fallback !== null);
            if (next === "stop") {
              stopFallback();
              invalidate(); // catch up on what arrived while disconnected
            } else if (next === "start" && fallbackMs) {
              fallback = setInterval(invalidate, fallbackMs);
            }
          });
      });
      return () => {
        cancel();
        stopFallback();
        if (channel) supabase.removeChannel(channel);
      };
    }, [table, filter, keys, enabled, instance, qc, fallbackMs]),
  );
}
