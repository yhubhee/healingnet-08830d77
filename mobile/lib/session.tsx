// Who is signed in: the session, the kind of account, and the patient profile.
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Tables } from "@/shared/database";
import { isConfigured } from "./env";
import { clearEverything } from "./query";
import { accountKind, type AccountKind } from "./roles";
import { supabase, watchAppStateForAuth } from "./supabase";

export type PatientProfile = Tables<"patients">;

interface SessionValue {
  /** False until the saved session has been read from the device. */
  ready: boolean;
  session: Session | null;
  userId: string | null;
  kind: AccountKind | undefined;
  kindError: unknown;
  profile: PatientProfile | null | undefined;
  profileError: unknown;
  /** True while the account kind or profile is still unknown (no saved copy either). */
  resolving: boolean;
  retry: () => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export const profileKey = (userId: string | null | undefined) => ["profile", userId ?? "none"] as const;

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(!isConfigured);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    watchAppStateForAuth();
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data: d }) => {
      setSession(d.session);
      setReady(true);
    }).catch(() => setReady(true));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const kindQuery = useQuery({
    queryKey: ["role", userId],
    enabled: !!userId,
    queryFn: () => accountKind(userId!),
    staleTime: 5 * 60_000,
  });

  const profileQuery = useQuery({
    queryKey: profileKey(userId),
    enabled: !!userId && kindQuery.data === "patient",
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").eq("user_id", userId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const signOut = useCallback(async () => {
    await clearEverything();
    setSession(null);
  }, []);

  const retry = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["role"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  }, [qc]);

  const value = useMemo<SessionValue>(() => {
    const kind = kindQuery.data;
    const profile = profileQuery.data;
    const resolving = !!userId && (kind === undefined ? !kindQuery.isError : kind === "patient" && profile === undefined && !profileQuery.isError);
    return {
      ready, session, userId, kind,
      kindError: kind === undefined ? kindQuery.error : null,
      profile,
      profileError: profile === undefined ? profileQuery.error : null,
      resolving, retry, signOut,
    };
  }, [ready, session, userId, kindQuery.data, kindQuery.isError, kindQuery.error, profileQuery.data, profileQuery.isError, profileQuery.error, retry, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}

/** The signed-in patient's profile row. Screens inside the tabs always have one. */
export function usePatient() {
  const { profile, userId } = useSession();
  return { profile: profile ?? null, patientId: profile?.id ?? null, userId };
}
