// The signed-in doctor's verification status and profile completeness.
// Refetches on window focus and whenever a user_notifications realtime event arrives
// (approval / rejection), so the portal updates without a hard reload.
import { useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Practice { name?: string; city?: string; role?: string; from?: string; to?: string }
export interface Reference { name?: string; hospital?: string; phone?: string }

export interface DoctorStatus {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  years_experience: number | null;
  bio: string | null;
  profile_image_url: string | null;
  license_number: string | null;
  license_council: string | null;
  license_expiry: string | null;
  current_practice: Practice | null;
  reference_contact: Reference | null;
  credential_documents: Record<string, string> | null;
  verification_status: "unverified" | "pending_review" | "approved" | "rejected";
  verification_rejection_reason: string | null;
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  availability_slots: number;
}

export const BIO_MIN = 50;

export type ProfileItem = "photo" | "phone" | "specialty" | "years_experience" | "bio" | "availability";

/** What an approved doctor still has to fill in before using the portal. */
export function missingProfileItems(d: DoctorStatus): ProfileItem[] {
  const out: ProfileItem[] = [];
  if (!d.profile_image_url) out.push("photo");
  if (!d.phone?.trim()) out.push("phone");
  if (!d.specialty?.trim()) out.push("specialty");
  if (d.years_experience == null) out.push("years_experience");
  if ((d.bio?.trim().length ?? 0) < BIO_MIN) out.push("bio");
  if (d.availability_slots < 1) out.push("availability");
  return out;
}

export const DOCTOR_STATUS_KEY = ["doctor", "status"] as const;

export function useDoctorStatus() {
  const qc = useQueryClient();
  const id = useId();

  useEffect(() => {
    const channel = supabase
      .channel(`doctor-status-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_notifications" }, () => {
        qc.invalidateQueries({ queryKey: DOCTOR_STATUS_KEY });
        qc.invalidateQueries({ queryKey: ["doctor", "self"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, id]);

  return useQuery({
    queryKey: DOCTOR_STATUS_KEY,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<DoctorStatus | null> => {
      const { data, error } = await supabase
        .from("my_doctor_profile")
        .select("id, first_name, last_name, email, phone, specialty, years_experience, bio, profile_image_url, license_number, license_council, license_expiry, current_practice, reference_contact, credential_documents, verification_status, verification_rejection_reason, verification_submitted_at, verification_reviewed_at")
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) return null;
      const { count, error: aErr } = await supabase
        .from("doctor_availability")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", data.id)
        .eq("is_available", true);
      if (aErr) throw aErr;
      return { ...(data as unknown as Omit<DoctorStatus, "availability_slots">), availability_slots: count ?? 0 };
    },
  });
}
