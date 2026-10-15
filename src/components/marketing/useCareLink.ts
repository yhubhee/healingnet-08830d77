import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Links into the patient app from the public site. Signed-in visitors go straight
 * there; signed-out visitors go to sign-up, which carries `next` through to their
 * first login (see src/lib/safeNext.ts).
 */
export function useCareLink() {
  const { user } = useAuth();
  return useCallback(
    (path: string) => (user ? path : `/signup?next=${encodeURIComponent(path)}`),
    [user],
  );
}
