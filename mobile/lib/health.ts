// Lab results, medical records and letters: the same tables and filters as the website's
// LabResults.tsx, MedicalRecords.tsx and Letters.tsx, selecting only what the screens show.
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useCallback } from "react";
import type { LabResult } from "@/shared/labs";
import type { EmrEntry, Letter } from "@/shared/records";
import { usePatient } from "./session";
import { supabase } from "./supabase";

/** Saved for offline use. */
export function useLabResults() {
  const { patientId } = usePatient();
  return useQuery({
    queryKey: ["lab-results", patientId],
    enabled: !!patientId,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<LabResult[]> => {
      const { data, error } = await supabase.from("lab_results")
        .select("id, created_at, status, notes, patient_viewed_at, hospitals(name), lab_result_tests(id, test_name, category_name, lab_result_parameters(id, parameter_name, result_value, unit_snapshot, ref_range_snapshot, flag, sort_order))")
        .eq("patient_id", patientId!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LabResult[];
    },
  });
}

/**
 * Records the patient's first look at a finished result. The database keeps only the first
 * time, so calling it again changes nothing. "New" is cleared here straight away; if the
 * call did not get through (offline), the next refresh shows "New" again and opening the
 * result tries once more.
 */
export function useMarkLabViewed() {
  const { patientId } = usePatient();
  const qc = useQueryClient();
  return useCallback((id: string) => {
    const now = new Date().toISOString();
    qc.setQueryData<LabResult[]>(["lab-results", patientId], (old) =>
      old?.map((r) => (r.id === id && !r.patient_viewed_at ? { ...r, patient_viewed_at: now } : r)));
    supabase.rpc("mark_lab_result_viewed", { p_lab_result_id: id }).then(() => {}, () => {});
  }, [patientId, qc]);
}

/** Saved for offline use. Read-only. */
export function useRecords() {
  const { patientId } = usePatient();
  return useQuery({
    queryKey: ["emr", patientId],
    enabled: !!patientId,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<EmrEntry[]> => {
      const { data, error } = await supabase.from("emr_entries")
        .select("id, entry_type, title, content, created_at, vital_data, doctors(first_name, last_name), hospitals(name)")
        .eq("patient_id", patientId!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EmrEntry[];
    },
  });
}

export function useLetters() {
  const { patientId } = usePatient();
  return useQuery({
    queryKey: ["letters", patientId],
    enabled: !!patientId,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Letter[]> => {
      const { data, error } = await supabase.from("patient_letters")
        .select("id, letter_type, title, body, status, issued_at, valid_until, pdf_url, doctors(first_name, last_name, specialty), hospitals(name, address)")
        .eq("patient_id", patientId!).order("issued_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Letter[];
    },
  });
}

// ---- Share as PDF -----------------------------------------------------------------------
/** Turns a printable page into a PDF and opens the phone's share sheet. */
export async function sharePdf(html: string, dialogTitle: string): Promise<"shared" | "unavailable"> {
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) return "unavailable";
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle });
  return "shared";
}
