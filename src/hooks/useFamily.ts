// Family profiles on the website: who the patient pages are showing ("Me" or a family
// member), the family list, adding and removing. Row security lets a guardian read and
// change a family member's data as a patient does their own, so pages ask by patient id.
// Same rules and wording as the app (mobile/lib/family.ts).
import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lagosToday } from "@/lib/dates";
import { addFamilyArgs, personForNotification, resolveActive, type FamilyForm, type FamilyMember } from "@/lib/family";
import { activePerson, useActivePersonId } from "./useActivePerson";
import { usePatientProfile } from "./usePatientData";

export { activePerson, useActivePersonId };

// ---- The family list ---------------------------------------------------------------------
async function fetchFamily(): Promise<FamilyMember[]> {
  const [family, links] = await Promise.all([
    supabase.rpc("my_family"),
    // Only to know whether an adult's permission was recorded (for the "is an adult" note).
    supabase.from("patient_guardians").select("patient_id, consent_confirmed_at"),
  ]);
  if (family.error) throw family.error;
  const permission = new Map((links.data ?? []).map((l) => [l.patient_id, !!l.consent_confirmed_at]));
  return (family.data ?? []).map((m) => ({ ...m, has_permission: links.error ? undefined : permission.get(m.patient_id) ?? false }));
}

export const familyKey = ["patient-family"] as const;

export function useFamily() {
  const { data: own } = usePatientProfile();
  return useQuery({ queryKey: familyKey, queryFn: fetchFamily, enabled: !!own?.id, staleTime: 60_000 });
}

/**
 * The person the patient pages are showing. `patient` is their patients row and `patientId`
 * their id: the signed-in patient's own, or the chosen family member's. Every per-person
 * query uses this id in its key, so two people's data never share a cache entry.
 */
export function useActivePatient() {
  const own = usePatientProfile();
  const activeId = useActivePersonId();
  const family = useFamily();
  const ownId = own.data?.id ?? null;
  const isMe = !activeId || activeId === ownId;
  const member = isMe ? null : family.data?.find((m) => m.patient_id === activeId) ?? null;
  const memberRow = useQuery({
    queryKey: ["patient-profile", "member", activeId],
    enabled: !isMe && !!ownId,
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").eq("id", activeId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return {
    isMe,
    patientId: isMe ? ownId : activeId,
    ownPatientId: ownId,
    patient: isMe ? own.data ?? null : memberRow.data ?? null,
    isLoading: own.isLoading || (!isMe && memberRow.isLoading),
    member,
    /** The family member's first name; null for Me. */
    firstName: isMe ? null : member?.first_name ?? "Family member",
    label: isMe ? "Me" : member?.first_name ?? "Family member",
    family: family.data ?? [],
    refetchPatient: () => (isMe ? own.refetch() : memberRow.refetch()),
  };
}

/** Mounted once in the patient header: someone removed from the family falls back to Me. */
export function useKeepActivePersonValid() {
  const activeId = useActivePersonId();
  const family = useFamily();
  useEffect(() => {
    if (!family.isSuccess) return;
    const next = resolveActive(activeId, family.data);
    if (next !== activeId) activePerson.set(next);
  }, [activeId, family.isSuccess, family.data]);
}

export function useAddFamilyMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: FamilyForm): Promise<string> => {
      const { data, error } = await supabase.rpc("add_family_member", addFamilyArgs(form, lagosToday()));
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: familyKey }),
  });
}

export function useRemoveFamilyMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patientId: string): Promise<{ held_by_hospitals: boolean }> => {
      const { data, error } = await supabase.rpc("remove_family_member", { p_patient_id: patientId });
      if (error) throw error;
      return { held_by_hospitals: (data as { held_by_hospitals?: unknown } | null)?.held_by_hospitals === true };
    },
    onSuccess: (_result, patientId) => {
      if (activePerson.get() === patientId) activePerson.set(null);
      qc.removeQueries({ predicate: (q) => q.queryKey.includes(patientId) });
      qc.invalidateQueries({ queryKey: familyKey });
    },
  });
}

/**
 * Before a notification's page opens: if it is about someone other than the person on
 * screen, switch to them and say so ("Showing Tobi").
 */
export function useShowPersonFor() {
  const qc = useQueryClient();
  const { data: own } = usePatientProfile();
  const ownId = own?.id ?? null;
  return useCallback(async (subjectId: string | null | undefined): Promise<void> => {
    if (!subjectId || !ownId) return;
    try {
      let family = qc.getQueryData<FamilyMember[]>(familyKey);
      if (subjectId !== ownId && !family?.some((m) => m.patient_id === subjectId)) {
        family = await qc.fetchQuery({ queryKey: familyKey, queryFn: fetchFamily });
      }
      const next = personForNotification(subjectId, activePerson.get(), ownId, (family ?? []).map((m) => m.patient_id));
      if (next === undefined) return;
      activePerson.set(next);
      const name = next === null ? null : family?.find((m) => m.patient_id === next)?.first_name;
      toast.info(next === null ? "Showing your own records" : `Showing ${name ?? "your family member"}`);
    } catch { /* stay with the person on screen */ }
  }, [qc, ownId]);
}
