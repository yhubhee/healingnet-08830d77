// Family profiles: the list, adding and removing, each member's next visit, and switching
// to the person a notification is about. Row security lets a guardian read and change a
// family member's data exactly as a patient does their own, so everything else in the app
// simply asks by patient id (lib/session.tsx usePatient). Names are never logged.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { useToast } from "@/components/toast";
import { UPCOMING_STATUSES } from "@/shared/appointments";
import { lagosToday } from "@/shared/dates";
import { addFamilyArgs, personForNotification, resolveActive, type FamilyForm, type FamilyMember } from "@/shared/family";
import { familyKey, familyNextKey } from "@/shared/keys";
import { activePerson, useActivePersonId } from "./activePerson";
import { unlockedActive, lockedToast } from "@/shared/verification";
import { removeRemindersFor } from "./reminders";
import { removeMemberDocuments } from "./verification";
import { useSession } from "./session";
import { supabase } from "./supabase";

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

/** The signed-in patient's family members. Saved on the phone, so the switcher works offline. */
export function useFamily() {
  const { userId, kind } = useSession();
  return useQuery({
    queryKey: familyKey(userId),
    enabled: !!userId && kind === "patient",
    queryFn: fetchFamily,
    staleTime: 60_000,
  });
}

/** Who the app is showing, with the name to print: "Me", or the family member. */
export function useActivePerson() {
  const { patientId: ownId } = useSession();
  const activeId = useActivePersonId();
  const family = useFamily();
  const isMe = !activeId || activeId === ownId;
  const member = isMe ? null : family.data?.find((m) => m.patient_id === activeId) ?? null;
  return {
    isMe,
    patientId: isMe ? ownId : activeId,
    member,
    /** The family member's first name; null for Me. */
    firstName: isMe ? null : member?.first_name ?? "Family member",
    label: isMe ? "Me" : member?.first_name ?? "Family member",
    family: family.data ?? [],
  };
}

/**
 * Mounted once for a signed-in patient: someone removed from the family (here or on another
 * device) falls back to Me, and so does someone who has become locked (no document sent in
 * time, or the document was not accepted), with a message saying why.
 */
export function useKeepActivePersonValid(active: boolean) {
  const activeId = useActivePersonId();
  const family = useFamily();
  const toast = useToast();
  useEffect(() => {
    if (!active || !family.isSuccess) return;
    const present = resolveActive(activeId, family.data);
    const next = unlockedActive(present, family.data);
    if (next === activeId) return;
    if (present && next === null) {
      const name = family.data.find((m) => m.patient_id === present)?.first_name;
      toast.info(lockedToast(name ?? "This family member"));
    }
    activePerson.set(next);
  }, [active, activeId, family.isSuccess, family.data, toast]);
}

export function useAddFamilyMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: FamilyForm): Promise<string> => {
      const { data, error } = await supabase.rpc("add_family_member", addFamilyArgs(form, lagosToday()));
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["family"] }),
  });
}

export function useRemoveFamilyMember() {
  const qc = useQueryClient();
  const { userId } = useSession();
  return useMutation({
    mutationFn: async (patientId: string): Promise<{ held_by_hospitals: boolean }> => {
      const { data, error } = await supabase.rpc("remove_family_member", { p_patient_id: patientId });
      if (error) throw error;
      return { held_by_hospitals: (data as { held_by_hospitals?: unknown } | null)?.held_by_hospitals === true };
    },
    onSuccess: async (_result, patientId) => {
      if (activePerson.get() === patientId) activePerson.set(null);
      // Nothing of theirs stays on the phone: their medicine reminders and their saved lists.
      await removeRemindersFor(patientId);
      // Their verification documents go too (not awaited; ones under review are kept by the database).
      removeMemberDocuments(userId, patientId);
      qc.removeQueries({ predicate: (q) => q.queryKey.includes(patientId) });
      qc.invalidateQueries({ queryKey: ["family"] });
      qc.invalidateQueries({ queryKey: ["family-next"] });
    },
  });
}

export interface NextVisit { date: string; time: string | null; status: string }

/** Each person's next visit, by patient id, for Home's Family row. */
export function useFamilyNext(patientIds: string[]) {
  const { userId } = useSession();
  const ids = [...patientIds].sort();
  return useQuery({
    queryKey: [...familyNextKey(userId), ids.join(",")],
    enabled: !!userId && ids.length > 0,
    queryFn: async (): Promise<Record<string, NextVisit>> => {
      const { data, error } = await supabase.from("patient_appointments")
        .select("patient_id, requested_date, requested_time, status")
        .in("patient_id", ids).in("status", UPCOMING_STATUSES).gte("requested_date", lagosToday())
        .order("requested_date", { ascending: true }).order("requested_time", { ascending: true }).limit(200);
      if (error) throw error;
      const out: Record<string, NextVisit> = {};
      (data ?? []).forEach((a) => { if (!out[a.patient_id]) out[a.patient_id] = { date: a.requested_date, time: a.requested_time, status: a.status }; });
      return out;
    },
  });
}

/**
 * For a notification that is about to be opened: if it is about someone other than the
 * person on screen, switch to them first and say so ("Showing Tobi"). A push only carries
 * the notification's id, so the person is looked up from it; if that fails (offline), the
 * app stays as it is.
 */
export function useShowPersonFor() {
  const qc = useQueryClient();
  const toast = useToast();
  const { userId, patientId: ownId } = useSession();
  const latest = useRef({ userId, ownId });
  latest.current = { userId, ownId };

  return useCallback(async (n: { subjectId?: string | null; notificationId?: string | null }): Promise<void> => {
    try {
      const { userId: uid, ownId: own } = latest.current;
      let subject = n.subjectId;
      if (subject === undefined && n.notificationId) {
        const { data } = await supabase.from("user_notifications").select("subject_patient_id").eq("id", n.notificationId).maybeSingle();
        subject = data?.subject_patient_id;
      }
      if (!subject) return;
      // A reminder kept on the phone for the signed-in patient's own plan.
      if (subject === "me") subject = own;
      if (!subject) return;
      let family = qc.getQueryData<FamilyMember[]>(familyKey(uid));
      // Someone added on another device is not in the saved list yet: read the list again.
      if (subject !== own && !family?.some((m) => m.patient_id === subject)) {
        family = await qc.fetchQuery({ queryKey: familyKey(uid), queryFn: fetchFamily });
      }
      // A locked member's records cannot be opened: stay with the person on screen.
      const open = (family ?? []).filter((m) => m.access_ok !== false).map((m) => m.patient_id);
      const next = personForNotification(subject, activePerson.get(), own, open);
      if (next === undefined) return;
      activePerson.set(next);
      const name = next === null ? null : family?.find((m) => m.patient_id === next)?.first_name;
      toast.info(next === null ? "Showing your own records" : `Showing ${name ?? "your family member"}`);
    } catch { /* stay with the person on screen */ }
  }, [qc, toast]);
}
