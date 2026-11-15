// Who is signed in: the session, the kind of account, and the patient profile.
//
// Start-up never waits for the network. The session and the last role/profile check are
// read from the phone (lib/boot.ts) and the app opens on them at once. The token refresh
// and a fresh role and profile check then run in the background; only a real change
// (signed out elsewhere, not a patient, profile incomplete) moves the person.
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Tables } from "@/shared/database";
import { missingPatientFields } from "@/shared/patientProfile";
import { combineProfileChecks, type AccountCheck } from "@/shared/startup";
import { personKeys } from "@/shared/keys";
import { useActivePersonId } from "./activePerson";
import { saveAccountCheck, type Boot } from "./boot";
import { isConfigured } from "./env";
import { clearEverything } from "./query";
import { accountKind, type AccountKind } from "./roles";
import { supabase, watchAppStateForAuth } from "./supabase";

export type PatientProfile = Tables<"patients">;

interface SessionValue {
  session: Session | null;
  userId: string | null;
  /** True when the session was already on the phone at start-up (not a sign-in just now). */
  returning: boolean;
  /** From the latest check, or the saved one until that arrives. */
  kind: AccountKind | undefined;
  kindError: unknown;
  profile: PatientProfile | null | undefined;
  profileError: unknown;
  profileComplete: boolean | undefined;
  patientId: string | null;
  retry: () => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export const profileKey = (userId: string | null | undefined) => ["profile", userId ?? "none"] as const;
export const profileStatusKey = (userId: string | null | undefined) => ["profile-status", userId ?? "none"] as const;

export function SessionProvider({ children, boot }: { children: ReactNode; boot: Boot }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(boot.session);
  const [check, setCheck] = useState<AccountCheck | null>(boot.check);
  const wiping = useRef(false);

  /** Removes everything this account left on the phone. Safe to call twice. */
  const wipe = useCallback(async () => {
    if (wiping.current) return;
    wiping.current = true;
    try { await clearEverything(); } finally { wiping.current = false; }
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    watchAppStateForAuth();
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "SIGNED_OUT") {
        // Signed out here, or the session was ended elsewhere (password change, account deleted).
        setSession(null);
        setCheck(null);
        wipe();
      } else if (next) {
        setSession(next);
      }
      // An empty first event only means the token could not be refreshed yet (for example
      // offline); the stored session stays in use until the server says otherwise.
    });
    supabase.auth.getSession().then(({ data: d, error }) => {
      if (d.session) setSession(d.session);
      else if (!error) setSession(null); // nothing valid is stored after all
    }).catch(() => {});
    return () => data.subscription.unsubscribe();
  }, [wipe]);

  const userId = session?.user?.id ?? null;
  const returning = !!userId && boot.session?.user?.id === userId;
  const saved = check && check.userId === userId ? check : null;

  const kindQuery = useQuery({
    queryKey: ["role", userId],
    enabled: !!userId,
    queryFn: () => accountKind(userId!),
    staleTime: 5 * 60_000,
  });
  const kind = kindQuery.data ?? saved?.kind;

  const profileQuery = useQuery({
    queryKey: profileKey(userId),
    enabled: !!userId && kind === "patient",
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").eq("user_id", userId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const profile = profileQuery.data;
  const patientId = profile?.id ?? saved?.patientId ?? null;

  // The server's own answer (my_profile_status). The local check routes at once; if the
  // server says the profile is incomplete, the person goes to Complete profile.
  const statusQuery = useQuery({
    queryKey: profileStatusKey(userId),
    enabled: !!userId && kind === "patient",
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_profile_status");
      if (error) throw error;
      const s = (data ?? {}) as { is_patient?: unknown; complete?: unknown };
      return { isPatient: s.is_patient === true, complete: s.complete === true };
    },
  });
  const localComplete = profile !== undefined ? profile !== null && missingPatientFields(profile).length === 0 : saved?.profileComplete;
  const profileComplete = combineProfileChecks(localComplete, statusQuery.data, {
    waitForServer: !returning || !saved, serverFailed: statusQuery.isError || statusQuery.fetchStatus === "paused",
  });

  // Keep the saved check in step with the latest answers.
  const freshKind = kindQuery.data;
  useEffect(() => {
    if (!userId || freshKind === undefined) return;
    if (freshKind === "patient" && profile === undefined) return;
    if (freshKind === "patient" && profileComplete === undefined) return;
    const next: AccountCheck = {
      userId, kind: freshKind,
      profileComplete: freshKind === "patient" && profileComplete === true,
      patientId: freshKind === "patient" ? profile?.id ?? null : null,
    };
    setCheck((old) => {
      if (old && old.userId === next.userId && old.kind === next.kind && old.profileComplete === next.profileComplete && old.patientId === next.patientId) return old;
      saveAccountCheck(next);
      return next;
    });
  }, [userId, freshKind, profile, profileComplete]);

  const signOut = useCallback(async () => {
    await wipe();
    setSession(null);
    setCheck(null);
  }, [wipe]);

  const retry = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["role"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["profile-status"] });
  }, [qc]);

  const value = useMemo<SessionValue>(() => ({
    session, userId, returning, kind,
    kindError: kind === undefined ? kindQuery.error : null,
    profile,
    profileError: profileComplete === undefined ? profileQuery.error : null,
    profileComplete, patientId, retry, signOut,
  }), [session, userId, returning, kind, kindQuery.error, profile, profileQuery.error, profileComplete, patientId, retry, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}

/** One patient row by id: the signed-in patient's own, or a family member's (row security decides). */
export async function fetchPatientRow(patientId: string): Promise<PatientProfile | null> {
  const { data, error } = await supabase.from("patients").select("*").eq("id", patientId).maybeSingle();
  if (error) throw error;
  return data;
}

/** A family member's profile row. Saved on the phone like the patient's own. */
export function useMemberProfile(patientId: string | null | undefined) {
  const { userId } = useSession();
  return useQuery({
    queryKey: personKeys.memberProfile(userId, patientId),
    enabled: !!userId && !!patientId,
    queryFn: () => fetchPatientRow(patientId!),
  });
}

/**
 * The person the app is showing: "Me" (the signed-in patient) or the family member chosen
 * under "Who is this for?". `patientId` and `profile` are theirs, so every list that is
 * read by patient id follows the choice. `ownPatientId` is always the signed-in patient.
 */
export function usePatient() {
  const { profile, patientId: ownPatientId, userId } = useSession();
  const activeId = useActivePersonId();
  const isMe = !activeId || activeId === ownPatientId;
  const member = useMemberProfile(isMe ? null : activeId);
  return {
    profile: isMe ? profile ?? null : member.data ?? null,
    patientId: isMe ? ownPatientId : activeId,
    ownPatientId,
    isMe,
    userId,
  };
}
