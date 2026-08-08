import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHospitalId } from "./useHospitalData";

/** The signed-in hospital staff member, with their hospital. */
export function useHospitalProfile() {
  return useQuery({
    queryKey: ["hospital-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("hospital_staff")
        .select("id, first_name, last_name, role, department, hospital_id, hospitals(name)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export interface SearchResult {
  id: string;
  kind: "patient" | "doctor" | "lab";
  title: string;
  subtitle?: string;
  url: string;
}

/** Cross-module search for the hospital header. */
export function useHospitalSearch(term: string) {
  const { data: hospitalId } = useHospitalId();
  const q = term.trim();

  return useQuery({
    queryKey: ["hospital-search", hospitalId, q],
    enabled: q.length >= 2,
    queryFn: async (): Promise<SearchResult[]> => {
      const like = `%${q}%`;
      const [patients, doctors, labs] = await Promise.all([
        supabase
          .from("patients")
          .select("id, first_name, last_name, phone, email")
          .or(`first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
          .limit(5),
        supabase
          .from("doctors")
          .select("id, first_name, last_name, specialty")
          .or(`first_name.ilike.${like},last_name.ilike.${like},specialty.ilike.${like}`)
          .limit(5),
        supabase
          .from("lab_results")
          .select("id, status, created_at, patients(first_name, last_name)")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const results: SearchResult[] = [];

      (patients.data ?? []).forEach((p: any) => results.push({
        id: p.id,
        kind: "patient",
        title: `${p.first_name} ${p.last_name}`,
        subtitle: p.phone || p.email || "Patient",
        url: "/hospital/patients",
      }));

      (doctors.data ?? []).forEach((d: any) => results.push({
        id: d.id,
        kind: "doctor",
        title: `Dr. ${d.first_name} ${d.last_name}`,
        subtitle: d.specialty || "Doctor",
        url: "/hospital/doctors",
      }));

      (labs.data ?? [])
        .filter((l: any) => {
          const name = `${l.patients?.first_name ?? ""} ${l.patients?.last_name ?? ""}`.toLowerCase();
          return name.includes(q.toLowerCase());
        })
        .slice(0, 5)
        .forEach((l: any) => results.push({
          id: l.id,
          kind: "lab",
          title: `Lab order — ${l.patients?.first_name ?? ""} ${l.patients?.last_name ?? ""}`.trim(),
          subtitle: `${l.status} · ${new Date(l.created_at).toLocaleDateString()}`,
          url: "/hospital/lab",
        }));

      return results;
    },
  });
}
