// "Who is this for?": the one person the patient screens are showing. null means "Me"
// (the signed-in patient); otherwise a family member's patient id. Kept as a small store so
// screens and non-screen code (a tapped notification) read and change the same value.

export interface ActivePersonStore {
  /** null = Me. */
  get: () => string | null;
  set: (id: string | null) => void;
  /** Sign-out: back to Me, and the saved choice is removed. */
  reset: () => void;
  /** Puts the saved choice in place at start-up without saving it again. */
  init: (saved: string | null | undefined) => void;
  subscribe: (listener: () => void) => () => void;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Only a well-formed id is accepted from storage; anything else means Me. */
export const cleanPersonId = (v: unknown): string | null => (typeof v === "string" && UUID.test(v) ? v : null);

export function createActivePersonStore(save: (id: string | null) => void): ActivePersonStore {
  let current: string | null = null;
  const listeners = new Set<() => void>();
  const change = (next: string | null, persist: boolean) => {
    if (persist) save(next);
    if (next === current) return;
    current = next;
    listeners.forEach((l) => l());
  };
  return {
    get: () => current,
    set: (id) => change(cleanPersonId(id), true),
    reset: () => change(null, true),
    init: (saved) => change(cleanPersonId(saved), false),
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
