// "Who is this for?" on the website: the person the patient pages are showing. null means
// "Me" (the signed-in patient); otherwise a family member's patient id. Saved in this
// browser, and reset to "Me" at sign-out.
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createActivePersonStore, cleanPersonId } from "@/lib/activePerson";

const STORAGE_KEY = "hn.active-person";
// Storage can be blocked (private windows, strict settings): the choice then lasts for the visit only.
function readSaved(): string | null {
  try { return cleanPersonId(window.localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}
function writeSaved(id: string | null) {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch { /* not saved; still works for this visit */ }
}

export const activePerson = createActivePersonStore(writeSaved);
activePerson.init(readSaved());
// Signing out always goes back to "Me", so the next person on this browser starts clean.
supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") activePerson.reset(); });

/** The active family member's patient id, or null for "Me". */
export const useActivePersonId = () => useSyncExternalStore(activePerson.subscribe, activePerson.get, () => null);

