// Hospital side of maternity and surgery records: one record with the patient's profile,
// antenatal visits, and the care plan the patient sees. Row security decides who may read
// and write; the database fills in the hospital and patient on visits and care items.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

const PATIENT = "patients(first_name, last_name, date_of_birth, phone, blood_group, genotype)";
type Person = { first_name: string; last_name: string } | null;
type PatientBits = { first_name: string; last_name: string; date_of_birth: string | null; phone: string | null; blood_group: string | null; genotype: string | null } | null;

export type MaternityRecord = Tables<"maternity_records"> & { patients: PatientBits; doctors: Person };
export type SurgeryRecord = Tables<"surgery_records"> & { patients: PatientBits; doctors: Person; anaesthetist: Person };
export type MaternityVisit = Tables<"maternity_visits">;
export type CarePlanItem = Tables<"care_plan_items">;
export type CareSource = "maternity" | "surgery";

export function useMaternityRecord(id: string | undefined) {
  return useQuery({
    queryKey: ["maternity-record", id],
    enabled: !!id,
    queryFn: async (): Promise<MaternityRecord | null> => {
      const { data, error } = await supabase.from("maternity_records")
        .select(`*, ${PATIENT}, doctors:doctor_id(first_name, last_name)`).eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as unknown as MaternityRecord | null;
    },
  });
}

export function useUpdateMaternity(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: TablesUpdate<"maternity_records">) => {
      const { error } = await supabase.from("maternity_records").update(patch).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maternity-record", id] }); qc.invalidateQueries({ queryKey: ["maternity-records"] }); },
  });
}

export function useMaternityVisits(recordId: string | undefined) {
  return useQuery({
    queryKey: ["maternity-visits", recordId],
    enabled: !!recordId,
    queryFn: async (): Promise<MaternityVisit[]> => {
      const { data, error } = await supabase.from("maternity_visits").select("*").eq("maternity_record_id", recordId!).order("visit_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type VisitInput = Pick<TablesInsert<"maternity_visits">,
  "visit_date" | "gestational_weeks" | "bp_systolic" | "bp_diastolic" | "weight_kg" | "fundal_height_cm" | "fetal_heart_rate" | "presentation" | "urine_protein" | "oedema" | "notes" | "next_visit_date">;

export function useRecordVisit(recordId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (visit: VisitInput) => {
      // hospital_id and patient_id are filled in by the database from the pregnancy record.
      const { error } = await supabase.from("maternity_visits").insert({ ...visit, maternity_record_id: recordId! } as TablesInsert<"maternity_visits">);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maternity-visits", recordId] }),
  });
}

export function useDeleteVisit(recordId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (visitId: string) => {
      const { error } = await supabase.from("maternity_visits").delete().eq("id", visitId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maternity-visits", recordId] }),
  });
}

export function useSurgeryRecord(id: string | undefined) {
  return useQuery({
    queryKey: ["surgery-record", id],
    enabled: !!id,
    queryFn: async (): Promise<SurgeryRecord | null> => {
      const { data, error } = await supabase.from("surgery_records")
        .select(`*, ${PATIENT}, doctors:surgeon_id(first_name, last_name), anaesthetist:anaesthetist_id(first_name, last_name)`).eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as unknown as SurgeryRecord | null;
    },
  });
}

export function useUpdateSurgery(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: TablesUpdate<"surgery_records">) => {
      const { error } = await supabase.from("surgery_records").update(patch).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["surgery-record", id] }); qc.invalidateQueries({ queryKey: ["surgery-records"] }); },
  });
}

// ---- Care plan ----------------------------------------------------------------------------
export const careItemsKey = (source: CareSource, id: string | undefined) => ["care-plan-items", source, id] as const;

export function useCareItems(source: CareSource, id: string | undefined) {
  return useQuery({
    queryKey: careItemsKey(source, id),
    enabled: !!id,
    queryFn: async (): Promise<CarePlanItem[]> => {
      const { data, error } = await supabase.from("care_plan_items").select("*").eq("source_type", source).eq("source_id", id!)
        .order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface CareItemInput { kind: string; title: string; details: string | null; due_at: string | null; remind: boolean }

export function useCareItemActions(source: CareSource, id: string | undefined) {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: careItemsKey(source, id) });
  return {
    add: useMutation({
      mutationFn: async (item: CareItemInput) => {
        const { error } = await supabase.from("care_plan_items").insert({ ...item, source_type: source, source_id: id! } as TablesInsert<"care_plan_items">);
        if (error) throw error;
      },
      onSuccess: done,
    }),
    update: useMutation({
      mutationFn: async ({ itemId, ...patch }: Partial<CareItemInput> & { itemId: string; status?: "open" | "done" | "cancelled" }) => {
        const { error } = await supabase.from("care_plan_items").update(patch).eq("id", itemId);
        if (error) throw error;
      },
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: async (itemId: string) => {
        const { error } = await supabase.from("care_plan_items").delete().eq("id", itemId);
        if (error) throw error;
      },
      onSuccess: done,
    }),
    standardSchedule: useMutation({
      mutationFn: async () => {
        const { data, error } = await supabase.rpc("add_standard_anc_schedule", { p_maternity_record_id: id! });
        if (error) throw error;
        return (data as number | null) ?? 0;
      },
      onSuccess: done,
    }),
  };
}
