import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";

/** The signed-out route into the patient app: sign-up, carrying `next` (see src/lib/safeNext.ts). */
const signupHref = (path: string) => `/signup?next=${encodeURIComponent(path)}`;

// Last answer, shared by every link (it sets their hrefs). Clicks always re-check,
// so signing in or out elsewhere is picked up.
let signedIn: boolean | null = null;
let pending: Promise<boolean> | null = null;
const listeners = new Set<(v: boolean) => void>();

/**
 * Is there a session? Loads the Supabase client only when asked (on hover, focus
 * or click), so it stays out of the public pages' first load. With no saved
 * session token at all, it answers without loading Supabase.
 */
function checkSignedIn(): Promise<boolean> {
  if (!pending) {
    pending = (async () => {
      let hasToken = true;
      try {
        // Inside an editor preview frame the session lives elsewhere; ask Supabase.
        const framed = window.parent !== window;
        hasToken = framed || Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k));
      } catch {
        /* storage unavailable: ask Supabase */
      }
      if (!hasToken) return false;
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      return !!data.session?.user;
    })()
      .catch(() => false)
      .then((v) => {
        signedIn = v;
        pending = null;
        listeners.forEach((l) => l(v));
        return v;
      });
  }
  return pending;
}

/**
 * Links into the patient app from the public site. Signed-in visitors go straight
 * there; signed-out visitors go to sign-up, which carries `next` through to their
 * first login (see src/lib/safeNext.ts).
 *
 * `linkProps(path)` is for <Link>: the href is the sign-up route until the session
 * is known, and the click goes to the right place either way. `go(path)` is for code.
 */
export function useCareLink() {
  const navigate = useNavigate();
  const [user, setUser] = useState(signedIn);

  useEffect(() => {
    listeners.add(setUser);
    return () => void listeners.delete(setUser);
  }, []);

  const go = useCallback(
    async (path: string) => navigate((await checkSignedIn()) ? path : signupHref(path)),
    [navigate],
  );

  const linkProps = useCallback(
    (path: string) => ({
      to: user ? path : signupHref(path),
      onPointerEnter: () => void checkSignedIn(),
      onFocus: () => void checkSignedIn(),
      onClick: (e: MouseEvent<HTMLAnchorElement>) => {
        // New tab, new window and so on: let the browser use the href.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        void go(path);
      },
    }),
    [user, go],
  );

  return { linkProps, go };
}
