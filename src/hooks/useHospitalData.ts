import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

// Helper to get hospital_id from current user
async function getHospitalId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.rpc("get_user_hospital_id", { _user_id: user.id });
  return data as string | null;
}

export function useHospitalId() {
  return useQuery({
    queryKey: ["hospital-id"],
    queryFn: getHospitalId,
    staleTime: 1000 * 60 * 30,
  });
}

// Generic mutation helper
export function useEntityMutation(table: string, queryKey: string) {
  const qc = useQueryClient();
  return {
    create: useMutation({
      mutationFn: async (values: any) => {
        const { data, error } = await supabase.from(table as any).insert(values).select().maybeSingle();
        if (error) throw error;
        return data;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    }),
    update: useMutation({
      mutationFn: async ({ id, ...values }: { id: string; [k: string]: any }) => {
        const { error } = await supabase.from(table as any).update(values).eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    }),
  };
}

// ---- PATIENTS ----
export function usePatients() {
  return useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- PATIENT CHECKINS (Queue) ----
export function usePatientCheckins() {
  return useQuery({
    queryKey: ["patient-checkins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_checkins")
        .select("*, patients(first_name, last_name, gender, date_of_birth), doctors:assigned_doctor_id(first_name, last_name)")
        .order("queue_number", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useRealtimeCheckins() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("realtime-checkins")
      .on("postgres_changes", { event: "*", schema: "public", table: "patient_checkins" }, () => {
        queryClient.invalidateQueries({ queryKey: ["patient-checkins"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);
}

export function useUpdateCheckin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("patient_checkins").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patient-checkins"] }),
  });
}

// ---- DOCTORS ----
export function useDoctors() {
  return useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });
}

export function useHospitalDoctors() {
  return useQuery({
    queryKey: ["hospital-doctors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospital_doctors")
        .select("*, doctors(first_name, last_name, specialty, rating, years_experience, is_available)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- EMR ----
export function useEmrEntries() {
  return useQuery({
    queryKey: ["emr-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emr_entries")
        .select("*, patients(first_name, last_name), doctors:doctor_id(first_name, last_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- LAB ----
export function useLabResults() {
  return useQuery({
    queryKey: ["lab-results"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_results")
        .select("*, patients(first_name, last_name), doctors:ordered_by(first_name, last_name), lab_result_tests(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- PHARMACY ----
export function usePharmacyInventory() {
  return useQuery({
    queryKey: ["pharmacy-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy_inventory")
        .select("*")
        .order("drug_name");
      if (error) throw error;
      return data;
    },
  });
}

export function usePharmacyDispensing() {
  return useQuery({
    queryKey: ["pharmacy-dispensing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy_dispensing")
        .select("*, patients(first_name, last_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- BILLING ----
export function useHospitalBilling() {
  return useQuery({
    queryKey: ["hospital-billing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospital_billing")
        .select("*, patients(first_name, last_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- SURGERY ----
export function useSurgeryRecords() {
  return useQuery({
    queryKey: ["surgery-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surgery_records")
        .select("*, patients(first_name, last_name), doctors:surgeon_id(first_name, last_name)")
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

// ---- MATERNITY ----
export function useMaternityRecords() {
  return useQuery({
    queryKey: ["maternity-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maternity_records")
        .select("*, patients(first_name, last_name, blood_group), doctors:doctor_id(first_name, last_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- REFERRALS ----
export function useHospitalReferrals() {
  return useQuery({
    queryKey: ["hospital-referrals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospital_referrals")
        .select("*, patients(first_name, last_name), referring_doctor:referring_doctor_id(first_name, last_name), referred_to_doctor:referred_to_doctor_id(first_name, last_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- INSURANCE ----
export function useInsuranceClaims() {
  return useQuery({
    queryKey: ["insurance-claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insurance_claims")
        .select("*, patients(first_name, last_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- CONSULTATION REQUESTS ----
export function useConsultationRequests() {
  return useQuery({
    queryKey: ["consultation-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultation_requests")
        .select("*, patients(first_name, last_name), doctors(first_name, last_name, specialty)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- MARKETPLACE ----
export function useDoctorMarketplace() {
  return useQuery({
    queryKey: ["doctor-marketplace"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_marketplace")
        .select("*, doctors(first_name, last_name, specialty, rating, years_experience)")
        .eq("is_available_for_external", true);
      if (error) throw error;
      return data;
    },
  });
}

// ---- NOTIFICATIONS ----
export function useHospitalNotifications() {
  return useQuery({
    queryKey: ["hospital-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospital_notifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useRealtimeNotifications() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("realtime-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "hospital_notifications" }, () => {
        queryClient.invalidateQueries({ queryKey: ["hospital-notifications"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hospital_notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hospital-notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hospitalId: string) => {
      const { error } = await supabase.from("hospital_notifications").update({ is_read: true }).eq("hospital_id", hospitalId).eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hospital-notifications"] }),
  });
}

// ---- HOSPITAL INFO ----
export function useHospitalInfo() {
  return useQuery({
    queryKey: ["hospital-info"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospitals")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// ---- WARDS & BEDS ----
export function useHospitalWards() {
  return useQuery({
    queryKey: ["hospital-wards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospital_wards" as any)
        .select("*")
        .order("ward_name");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useHospitalBeds() {
  return useQuery({
    queryKey: ["hospital-beds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospital_beds" as any)
        .select("*, patients(first_name, last_name)")
        .order("bed_number");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useRealtimeBeds() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("realtime-beds")
      .on("postgres_changes", { event: "*", schema: "public", table: "hospital_beds" }, () => {
        queryClient.invalidateQueries({ queryKey: ["hospital-beds"] });
        queryClient.invalidateQueries({ queryKey: ["hospital-wards"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);
}

// ---- STAFF ----
export function useHospitalStaff() {
  return useQuery({
    queryKey: ["hospital-staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospital_staff")
        .select("*")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });
}

// ---- SUBSCRIPTION ----
export function useHospitalSubscription() {
  return useQuery({
    queryKey: ["hospital-subscription"],
    queryFn: async () => {
      const { data: hid } = await supabase.rpc("get_user_hospital_id", { _user_id: (await supabase.auth.getUser()).data.user!.id });
      if (!hid) return null;
      const { data } = await supabase.from("hospital_subscriptions" as any).select("*").eq("hospital_id", hid).order("started_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });
}

// ---- DOCTOR PORTAL ----
export function useDoctorId() {
  return useQuery({
    queryKey: ["doctor-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.rpc("get_user_doctor_id", { _user_id: user.id });
      return data as string | null;
    },
  });
}

export function useDoctorAppointments(doctorId?: string | null) {
  return useQuery({
    enabled: !!doctorId,
    queryKey: ["doctor-appointments", doctorId],
    queryFn: async () => {
      const { data, error } = await supabase.from("patient_appointments" as any)
        .select("*, patients(first_name, last_name, phone)")
        .eq("doctor_id", doctorId).order("requested_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useDoctorPrescriptions(doctorId?: string | null) {
  return useQuery({
    enabled: !!doctorId,
    queryKey: ["doctor-prescriptions", doctorId],
    queryFn: async () => {
      const { data, error } = await supabase.from("prescriptions" as any)
        .select("*, patients(first_name, last_name)")
        .eq("doctor_id", doctorId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useDoctorEmrEntries(doctorId?: string | null) {
  return useQuery({
    enabled: !!doctorId,
    queryKey: ["doctor-emr", doctorId],
    queryFn: async () => {
      const { data, error } = await supabase.from("emr_entries")
        .select("*, patients(first_name, last_name)")
        .eq("doctor_id", doctorId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useDoctorConsultations(doctorId?: string | null) {
  return useQuery({
    enabled: !!doctorId,
    queryKey: ["doctor-consults", doctorId],
    queryFn: async () => {
      const { data, error } = await supabase.from("consultation_requests")
        .select("*, patients(first_name, last_name)")
        .eq("doctor_id", doctorId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useDoctorProfile(doctorId?: string | null) {
  return useQuery({
    enabled: !!doctorId,
    queryKey: ["doctor-profile", doctorId],
    queryFn: async () => {
      const { data, error } = await supabase.from("doctors").select("*").eq("id", doctorId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
