import { useEffect, useRef, useState, useCallback, createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

/** Core consultation record + patient + linked appointment. */
export function useConsultationCore(id?: string) {
  return useQuery({
    enabled: !!id,
    queryKey: ["consultation", id, "core"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("consultations")
        .select("*, patients:patient_id(id,first_name,last_name,gender,date_of_birth,blood_group,genotype,insurance_provider,insurance_policy_number,phone,user_id), patient_appointments:appointment_id(id,meeting_link,is_telemedicine,reason)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useConsultationRow(table: "consultation_history" | "consultation_examinations", id?: string) {
  return useQuery({
    enabled: !!id,
    queryKey: ["consultation", id, table],
    queryFn: async () => {
      const { data, error } = await sb.from(table).select("*").eq("consultation_id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Name + role of the person who pre-recorded a section (if not the doctor). */
export function useRecorderName(userId?: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["recorder", userId],
    queryFn: async () => {
      const { data } = await sb.from("hospital_staff").select("first_name,last_name,role").eq("user_id", userId).maybeSingle();
      return data as { first_name: string; last_name: string; role: string } | null;
    },
  });
}

export function useTreatmentItems(id?: string) {
  return useQuery({
    enabled: !!id,
    queryKey: ["consultation", id, "treatment"],
    queryFn: async () => {
      const { data, error } = await sb.from("consultation_treatment_items").select("*").eq("consultation_id", id).order("line_no");
      if (error) throw error;
      return data || [];
    },
  });
}

/** Lab orders + diagnostic requests for this consultation, refreshed live. */
export function useInvestigations(id?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`consult-inv-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lab_result_tests" }, () =>
        qc.invalidateQueries({ queryKey: ["consultation", id, "investigations"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "diagnostic_requests", filter: `consultation_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["consultation", id, "investigations"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  return useQuery({
    enabled: !!id,
    queryKey: ["consultation", id, "investigations"],
    queryFn: async () => {
      const [labs, dx] = await Promise.all([
        sb.from("lab_results")
          .select("id,status,priority,created_at, lab_result_tests(id,test_name,status,result_value,unit,reference_range,is_abnormal, lab_result_parameters(id,parameter_name,result_value,unit_snapshot,ref_range_snapshot,flag,sort_order))")
          .eq("consultation_id", id).order("created_at"),
        sb.from("diagnostic_requests").select("*").eq("consultation_id", id).order("ordered_at"),
      ]);
      if (labs.error) throw labs.error;
      if (dx.error) throw dx.error;
      return { labs: labs.data || [], requests: dx.data || [] };
    },
  });
}

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

/**
 * Debounced autosave. Saves ~1.5s after the last change, retries every 5s on
 * failure, and never discards the form value.
 */
export function useAutosave<T>(value: T, save: (v: T) => Promise<void>, opts: { enabled: boolean; delay?: number }) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const lastSaved = useRef<string | null>(null);
  const timer = useRef<number>();
  const saveRef = useRef(save);
  saveRef.current = save;
  const valueRef = useRef(value);
  valueRef.current = value;
  const serial = JSON.stringify(value);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const current = JSON.stringify(valueRef.current);
    if (current === lastSaved.current) return;
    setStatus("saving");
    try {
      await saveRef.current(valueRef.current);
      lastSaved.current = current;
      setSavedAt(new Date());
      setStatus(JSON.stringify(valueRef.current) === current ? "saved" : "dirty");
    } catch {
      setStatus("error");
      timer.current = window.setTimeout(flush, 5000);
    }
  }, []);

  /** Mark the loaded server value as the baseline so it isn't re-saved. */
  const setBaseline = useCallback((v: T) => { lastSaved.current = JSON.stringify(v); }, []);

  useEffect(() => {
    if (!opts.enabled || lastSaved.current === null || serial === lastSaved.current) return;
    setStatus("dirty");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, opts.delay ?? 1500);
    return () => window.clearTimeout(timer.current);
  }, [serial, opts.enabled, opts.delay, flush]);

  return { status, savedAt, flush, setBaseline };
}

/** Lets each card report its save status to the page-level indicator. */
export const SaveRegistryContext = createContext<(key: string, s: SaveStatus, at: Date | null) => void>(() => {});
export function useReportSave(key: string, status: SaveStatus, savedAt: Date | null) {
  const report = useContext(SaveRegistryContext);
  useEffect(() => { report(key, status, savedAt); }, [key, status, savedAt, report]);
}

export function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return a;
}
