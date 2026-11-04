// Admin data layer for the pharmacy network. Reads and writes go through admin_* functions,
// except two lists no function returns: a pharmacy's fee rows (pharmacy_fees) and its team
// (pharmacy_members). Both are read-only for admins under row-level security.
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw error;
  return data as T;
}
const meta = { inlineError: true };

export interface QueuePharmacy {
  id: string; name: string; address: string | null; city: string | null; state: string | null; phone: string | null; email: string | null;
  premises_licence_no: string | null; premises_licence_expiry: string | null; superintendent_name: string | null; superintendent_pcn_no: string | null;
  verification_status: string; review_note: string | null; is_listed: boolean; paused_reason: string | null; created_at: string;
}
export interface QueuePharmacist {
  id: string; pharmacy_id: string; pharmacy_name: string; first_name: string; last_name: string; email: string | null; phone: string | null;
  role: "owner" | "pharmacist" | "assistant"; pcn_reg_no: string | null; licence_expiry: string | null; created_at: string;
}
export interface PharmacyQueue {
  pharmacies: QueuePharmacy[];
  members: QueuePharmacist[];
  open_reports: number;
  paused: { id: string; name: string; reason: string | null }[];
}
export interface PharmacyRow extends QueuePharmacy {
  members: number; requests_30d: number; collected_30d: number; fees_accrued_kobo: number;
}
export interface PharmacyFee { id: string; request_id: string; amount_kobo: number; status: FeeStatus; note: string | null; created_at: string }
export type FeeStatus = "accrued" | "waived" | "invoiced" | "paid";
export interface PharmacyMember {
  id: string; first_name: string; last_name: string; role: string; pcn_reg_no: string | null; licence_expiry: string | null;
  verification_status: string; is_active: boolean;
}
export interface MedicineCheck {
  id: string; patient_id: string; prescription_id: string | null; pharmacy_id: string | null; pharmacy_name: string | null;
  drug_name: string | null; batch_number: string | null; nafdac_no: string | null; result: "not_found" | "suspected_fake" | "genuine";
  details: string | null; status: "open" | "reviewed" | "closed"; admin_note: string | null; created_at: string;
}
export interface FeeSettings { fee_kobo: number; billing_enabled: boolean; updated_at: string | null }

export const pkeys = {
  queue: ["admin", "pharmacy-queue"] as const,
  list: ["admin", "pharmacies"] as const,
  fees: (id: string) => ["admin", "pharmacy-fees", id] as const,
  members: (id: string) => ["admin", "pharmacy-members", id] as const,
  checks: ["admin", "medicine-checks"] as const,
  feeSettings: ["admin", "pharmacy-fee-settings"] as const,
};
export const PHARMACY_PAGE = 25;

export async function fetchPharmacyQueue() {
  return call<PharmacyQueue>("admin_pharmacy_queue");
}
export function usePharmacyQueue() {
  return useQuery({ queryKey: pkeys.queue, queryFn: fetchPharmacyQueue, meta, refetchInterval: 60_000 });
}

export function usePharmacies(f: { status?: string; search?: string; page: number }) {
  return useQuery({
    queryKey: [...pkeys.list, f],
    queryFn: async () => (await call<PharmacyRow[] | null>("admin_list_pharmacies", {
      p_status: f.status || null, p_search: f.search || null, p_limit: PHARMACY_PAGE, p_offset: (f.page - 1) * PHARMACY_PAGE,
    })) ?? [],
    placeholderData: keepPreviousData,
    meta,
  });
}

export function usePharmacyFees(id: string | null) {
  return useQuery({
    enabled: !!id,
    queryKey: pkeys.fees(id ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase.from("pharmacy_fees").select("id, request_id, amount_kobo, status, note, created_at")
        .eq("pharmacy_id", id!).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as PharmacyFee[];
    },
    meta,
  });
}

export function usePharmacyMembers(id: string | null) {
  return useQuery({
    enabled: !!id,
    queryKey: pkeys.members(id ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase.from("pharmacy_members")
        .select("id, first_name, last_name, role, pcn_reg_no, licence_expiry, verification_status, is_active")
        .eq("pharmacy_id", id!).order("created_at");
      if (error) throw error;
      return (data ?? []) as PharmacyMember[];
    },
    meta,
  });
}

export function useMedicineChecks(status: string) {
  return useQuery({
    queryKey: [...pkeys.checks, status],
    queryFn: async () => (await call<MedicineCheck[] | null>("admin_list_medicine_checks", { p_status: status || null, p_limit: 100, p_offset: 0 })) ?? [],
    meta,
  });
}

export function useFeeSettings() {
  return useQuery({ queryKey: pkeys.feeSettings, queryFn: () => call<FeeSettings>("admin_pharmacy_fee_settings"), meta });
}

function useAdminMutation<V>(fn: (v: V) => Promise<unknown>, related: QueryKey[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      for (const k of [...related, ["admin", "overview"], ["admin", "audit"]]) qc.invalidateQueries({ queryKey: k });
    },
  });
}

export function useReviewPharmacy() {
  return useAdminMutation(
    (v: { id: string; approve: boolean; note?: string }) => call("admin_review_pharmacy", { p_pharmacy_id: v.id, p_approve: v.approve, p_note: v.note ?? null }),
    [pkeys.queue, pkeys.list],
  );
}
export function useReviewPharmacist() {
  return useAdminMutation(
    (v: { id: string; approve: boolean; note?: string }) => call("admin_review_pharmacist", { p_member_id: v.id, p_approve: v.approve, p_note: v.note ?? null }),
    [pkeys.queue, pkeys.list, ["admin", "pharmacy-members"]],
  );
}
export function useSetPharmacyStatus() {
  return useAdminMutation(
    (v: { id: string; status: "approved" | "suspended"; listed: boolean; reason?: string }) =>
      call("admin_set_pharmacy_status", { p_pharmacy_id: v.id, p_status: v.status, p_listed: v.listed, p_reason: v.reason ?? null }),
    [pkeys.queue, pkeys.list],
  );
}
export function useResolveMedicineCheck() {
  return useAdminMutation(
    (v: { id: string; status: "reviewed" | "closed"; note?: string }) => call("admin_resolve_medicine_check", { p_check_id: v.id, p_status: v.status, p_note: v.note ?? null }),
    [pkeys.checks, pkeys.queue],
  );
}
export function useSetFeeSettings() {
  return useAdminMutation(
    (v: { fee_kobo?: number; billing_enabled?: boolean }) =>
      call<FeeSettings>("admin_pharmacy_fee_settings", { p_fee_kobo: v.fee_kobo ?? null, p_billing_enabled: v.billing_enabled ?? null }),
    [pkeys.feeSettings],
  );
}
export function useSetFeeStatus() {
  return useAdminMutation(
    (v: { id: string; pharmacyId: string; status: FeeStatus; note?: string }) =>
      call("admin_set_pharmacy_fee_status", { p_fee_id: v.id, p_status: v.status, p_note: v.note ?? null }),
    [["admin", "pharmacy-fees"], pkeys.list],
  );
}
