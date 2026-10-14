// Data layer for the admin console. Every read and write goes through an admin_* database
// function: they check platform-admin rights, aggregate on the server and never return
// patient names or clinical data. Do not add direct table queries here.
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Types (mirror the JSON built in supabase/migrations/20261014100000_admin_console.sql)
// ---------------------------------------------------------------------------
export interface Overview {
  generated_at: string;
  hospitals: {
    total: number; pending: number; approved: number; rejected: number; suspended: number;
    trialing: number; trials_ending_7d: number; paid_emr: number; paid_telemedicine: number;
    lapsed: number; new_7d: number; new_30d: number;
  };
  doctors: { total: number; pending: number; approved: number; unverified: number; rejected: number; new_7d: number; new_30d: number };
  patients: { total: number; app_users: number; new_7d: number; new_30d: number };
  payments: {
    revenue_30d_kobo: number; subscription_revenue_30d_kobo: number; success_30d: number;
    failed_30d: number; stuck_pending: number; refunds_needed: number;
  };
  mrr_kobo: number;
  activity: {
    checkins_7d: number; appointments_7d: number; consultations_7d: number; triage_7d: number;
    triage_emergency_7d: number; consult_requests_7d: number; calls_7d: number; live_calls: number;
  };
  inbox: { verifications_pending: number; refunds_needed: number; contact_unhandled: number };
}

export const METRICS = [
  "checkins", "appointments", "consultations", "consult_requests", "calls", "triage", "triage_emergency",
  "signups_hospitals", "signups_doctors", "signups_patients", "revenue_naira", "payments_failed",
] as const;
export type Metric = (typeof METRICS)[number];
export interface SeriesPoint { day: string; value: number }

export interface Contact { name: string; email: string | null; phone: string | null }

export interface QueueHospital {
  id: string; name: string; email: string | null; phone: string | null; address: string | null;
  city: string | null; state: string | null; license_number: string | null; created_at: string;
  subscription_status: string; active_plan: string; contact: Contact | null; patients_registered: number;
}

export interface Practice { name?: string; city?: string; role?: string; from?: string; to?: string }
export interface Reference { name?: string; hospital?: string; phone?: string }

export interface QueueDoctor {
  id: string; user_id: string | null; name: string; email: string | null; phone: string | null;
  specialty: string | null; years_experience: number | null; license_number: string | null;
  license_council: string | null; license_expiry: string | null; current_practice: Practice | null;
  reference_contact: Reference | null; credential_documents: Record<string, string> | null;
  verification_submitted_at: string | null; created_at: string;
}

export type PlanState = "emr" | "telemedicine" | "trialing" | "lapsed" | "none";

export interface HospitalRow {
  id: string; name: string; email: string | null; phone: string | null; city: string | null; state: string | null;
  verification_status: string; is_active: boolean; plan_state: PlanState; active_plan: string;
  subscription_status: string; trial_ends_at: string | null; plan_expires_at: string | null; created_at: string;
  staff: number; doctors: number; patients: number;
}

export interface AuditEntry { action: string; details: Record<string, unknown> | null; created_at: string; admin_email: string | null }

export interface HospitalDetail {
  hospital: {
    id: string; name: string; email: string | null; phone: string | null; address: string | null;
    city: string | null; state: string | null; license_number: string | null; logo_url: string | null;
    verification_status: string; verification_notes: string | null; verified_at: string | null;
    is_active: boolean; subscription_status: string; active_plan: string;
    trial_ends_at: string | null; plan_expires_at: string | null; created_at: string;
  };
  admins: (Contact & { role: string })[];
  counts: { staff: number; doctors: number; patients: number; checkins_30d: number; appointments_30d: number; consultations_30d: number };
  subscriptions: { plan: string; status: string; billing_cycle: string | null; started_at: string; expires_at: string | null }[];
  payments: { id: string; purpose: string; amount: number; status: string; paystack_reference: string | null; created_at: string; paid_at: string | null; review: string | null }[];
  audit: AuditEntry[];
}

export interface DoctorRow {
  id: string; name: string; email: string | null; phone: string | null; specialty: string | null;
  years_experience: number | null; verification_status: string; license_number: string | null;
  license_council: string | null; license_expiry: string | null; verification_submitted_at: string | null;
  verification_reviewed_at: string | null; is_available: boolean | null; created_at: string; hospitals: number;
}

export interface DoctorDetail {
  doctor: {
    id: string; first_name: string; last_name: string; email: string | null; phone: string | null;
    specialty: string | null; years_experience: number | null; bio: string | null;
    license_number: string | null; license_council: string | null; license_expiry: string | null;
    current_practice: Practice | null; reference_contact: Reference | null;
    credential_documents: Record<string, string> | null; verification_status: string;
    verification_rejection_reason: string | null; verification_submitted_at: string | null;
    verification_reviewed_at: string | null; is_available: boolean | null; created_at: string;
  };
  hospitals: { id: string; name: string; status: string; is_active: boolean }[];
  counts: { consultations_30d: number; consult_requests_30d: number };
  audit: AuditEntry[];
}

export interface PaymentRow {
  id: string; hospital_id: string | null; hospital_name: string | null; purpose: string; plan: string | null;
  billing_cycle: string | null; amount: number; currency: string | null; status: string; channel: string | null;
  paystack_reference: string | null; created_at: string; paid_at: string | null; review: string | null;
  review_note: string | null; payer_type: "patient" | "consultation" | "hospital";
}

export interface Health {
  generated_at: string;
  function_usage_24h: Record<string, number>;
  payments_pending_over_1h: number; payments_failed_24h: number; calls_open_over_4h: number;
  share_code_failures_24h: number; staff_invites_pending: number; doctor_licences_expiring_30d: number;
  doctor_licences_expired: number; plans_expiring_7d: number; database_size_mb: number;
}

export interface EmailQueue {
  pending: number;
  sent_24h: number;
  failed_7d: number;
  oldest_pending_minutes: number | null;
  recent_failures: { template: string; attempts: number; last_error: string | null; created_at: string }[];
}

export interface ContactMessage { id: string; name: string; email: string; subject: string | null; message: string; created_at: string; handled_at: string | null }

export interface AuditRow extends AuditEntry { id: string; target_type: string; target_id: string | null; target_name: string | null }

export interface Paged<T> { total: number; rows: T[] }

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------
// The generated types describe these functions as returning Json; the interfaces above give them shape.
const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw error;
  return data as T;
}

const nul = (v: string | null | undefined) => (v ? v : null);
const meta = { inlineError: true };

export const keys = {
  overview: ["admin", "overview"] as const,
  series: (metric: Metric, days: number) => ["admin", "timeseries", metric, days] as const,
  queue: ["admin", "verification-queue"] as const,
  hospitals: ["admin", "hospitals"] as const,
  hospital: (id: string) => ["admin", "hospital", id] as const,
  doctors: ["admin", "doctors"] as const,
  doctor: (id: string) => ["admin", "doctor", id] as const,
  payments: ["admin", "payments"] as const,
  health: ["admin", "health"] as const,
  emailQueue: ["admin", "email-queue"] as const,
  messages: ["admin", "messages"] as const,
  audit: ["admin", "audit"] as const,
};

const live = { refetchInterval: 60_000, refetchOnWindowFocus: true } as const;

export function useOverview() {
  return useQuery({ queryKey: keys.overview, queryFn: () => call<Overview>("admin_overview"), meta, ...live });
}

export async function fetchSeries(metric: Metric, days: number): Promise<SeriesPoint[]> {
  const rows = await call<{ day: string; value: number | string }[]>("admin_timeseries", { p_metric: metric, p_days: days });
  return (rows ?? []).map((r) => ({ day: r.day, value: Number(r.value) || 0 }));
}

export function useVerificationQueue() {
  return useQuery({
    queryKey: keys.queue,
    queryFn: () => call<{ hospitals: QueueHospital[]; doctors: QueueDoctor[] }>("admin_verification_queue"),
    meta,
  });
}

export function useHospitals(f: { search?: string; status?: string; plan?: string; page: number }) {
  return useQuery({
    queryKey: [...keys.hospitals, f],
    queryFn: () =>
      call<Paged<HospitalRow>>("admin_list_hospitals", {
        p_search: nul(f.search), p_status: nul(f.status), p_plan: nul(f.plan),
        p_limit: PAGE_SIZE, p_offset: (f.page - 1) * PAGE_SIZE,
      }),
    meta,
    placeholderData: keepPreviousData,
  });
}

export function useHospitalDetail(id: string | null) {
  return useQuery({
    queryKey: keys.hospital(id ?? ""),
    queryFn: () => call<HospitalDetail>("admin_hospital_detail", { p_hospital_id: id }),
    enabled: !!id,
    meta,
  });
}

export function useDoctors(f: { search?: string; status?: string; page: number }) {
  return useQuery({
    queryKey: [...keys.doctors, f],
    queryFn: () =>
      call<Paged<DoctorRow>>("admin_list_doctors", {
        p_search: nul(f.search), p_status: nul(f.status), p_limit: PAGE_SIZE, p_offset: (f.page - 1) * PAGE_SIZE,
      }),
    meta,
    placeholderData: keepPreviousData,
  });
}

export function useDoctorDetail(id: string | null) {
  return useQuery({
    queryKey: keys.doctor(id ?? ""),
    queryFn: () => call<DoctorDetail>("admin_doctor_detail", { p_doctor_id: id }),
    enabled: !!id,
    meta,
  });
}

export function usePayments(f: { status?: string; purpose?: string; review?: string; search?: string; page: number }) {
  return useQuery({
    queryKey: [...keys.payments, f],
    queryFn: () =>
      call<Paged<PaymentRow> & { total_success_kobo: number }>("admin_list_payments", {
        p_status: nul(f.status), p_purpose: nul(f.purpose), p_review: nul(f.review), p_search: nul(f.search),
        p_limit: PAGE_SIZE, p_offset: (f.page - 1) * PAGE_SIZE,
      }),
    meta,
    placeholderData: keepPreviousData,
  });
}

export function useHealth() {
  return useQuery({ queryKey: keys.health, queryFn: () => call<Health>("admin_system_health"), meta, ...live });
}

export function useEmailQueue() {
  return useQuery({ queryKey: keys.emailQueue, queryFn: () => call<EmailQueue>("admin_email_queue"), meta, ...live });
}

export function useMessages(f: { handled: boolean; page: number }) {
  return useQuery({
    queryKey: [...keys.messages, f],
    queryFn: () =>
      call<Paged<ContactMessage>>("admin_list_contact_messages", {
        p_handled: f.handled, p_limit: PAGE_SIZE, p_offset: (f.page - 1) * PAGE_SIZE,
      }),
    meta,
    placeholderData: keepPreviousData,
  });
}

export function useAudit(page: number) {
  return useQuery({
    queryKey: [...keys.audit, page],
    queryFn: () => call<Paged<AuditRow>>("admin_list_audit", { p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    meta,
    placeholderData: keepPreviousData,
  });
}

// Small searches for the ⌘K palette.
export async function quickSearch(q: string) {
  const [h, d] = await Promise.all([
    call<Paged<HospitalRow>>("admin_list_hospitals", { p_search: q, p_limit: 6, p_offset: 0 }),
    call<Paged<DoctorRow>>("admin_list_doctors", { p_search: q, p_limit: 6, p_offset: 0 }),
  ]);
  return { hospitals: h.rows, doctors: d.rows };
}

// ---------------------------------------------------------------------------
// Actions. Each one invalidates the related lists, the overview and the audit log.
// ---------------------------------------------------------------------------
function useAdminMutation<V>(fn: (v: V) => Promise<unknown>, related: QueryKey[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      for (const k of [...related, keys.overview, keys.audit]) qc.invalidateQueries({ queryKey: k });
    },
  });
}

export function useReviewHospital() {
  return useAdminMutation(
    (v: { id: string; approve: boolean; notes?: string }) =>
      call("admin_review_hospital", { p_hospital_id: v.id, p_approve: v.approve, p_notes: v.notes ?? null }),
    [keys.queue, keys.hospitals, ["admin", "hospital"]],
  );
}

export function useReviewDoctor() {
  return useAdminMutation(
    (v: { id: string; approve: boolean; reason?: string }) =>
      call("admin_review_doctor", { p_doctor_id: v.id, p_approve: v.approve, p_reason: v.reason ?? null }),
    [keys.queue, keys.doctors, ["admin", "doctor"]],
  );
}

export function useSetHospitalActive() {
  return useAdminMutation(
    (v: { id: string; active: boolean; reason?: string }) =>
      call("admin_set_hospital_active", { p_hospital_id: v.id, p_active: v.active, p_reason: v.reason ?? null }),
    [keys.hospitals, ["admin", "hospital"]],
  );
}

export function useExtendTrial() {
  return useAdminMutation(
    (v: { id: string; days: number; reason: string }) =>
      call<string>("admin_extend_trial", { p_hospital_id: v.id, p_days: v.days, p_reason: v.reason }),
    [keys.hospitals, ["admin", "hospital"], keys.health],
  );
}

export function useResolveRefund() {
  return useAdminMutation(
    (v: { id: string; note: string }) => call("admin_resolve_refund", { p_payment_id: v.id, p_note: v.note }),
    [keys.payments, ["admin", "hospital"]],
  );
}

export function useMarkContactHandled() {
  return useAdminMutation(
    (v: { id: string; handled: boolean }) => call("admin_mark_contact_handled", { p_id: v.id, p_handled: v.handled }),
    [keys.messages],
  );
}

// Credential documents: the only direct access, a 60-second signed URL from the
// doctor-credentials bucket (its policy allows platform admins).
export async function signedCredentialUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("doctor-credentials").createSignedUrl(path, 60);
  if (error || !data) throw error ?? new Error("Could not open the document");
  return data.signedUrl;
}
