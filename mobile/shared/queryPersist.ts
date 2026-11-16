// The saved (offline) data, one entry per query, and everything about it that can be
// worked out without the phone: what an entry looks like, which entries are still good,
// and reading the single blob that versions up to 0.3 kept.
//
// 0.3 saved every list for every person as one value and encrypted it in JavaScript each
// time any list refreshed, which froze the app. From 0.4 each query is its own entry in a
// store that encrypts natively (lib/cacheStore.ts), so a Visits refresh rewrites only Visits.
import { isUpcoming, type Appointment } from "./appointments";
import type { VisitsData } from "./visits";
import { VISITS_PAGE } from "./visits";

/** The small part of an encrypted key-value store this needs (MMKV, or a Map in tests). */
export interface SyncStore {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
  clear(): void;
}

export type SavedKey = readonly unknown[];

/** One saved query: its key, its data, when it was fetched, and the cache version that wrote it. */
export interface SavedQuery { k: SavedKey; d: unknown; t: number; v: string }

/**
 * Bump when the shape of any saved query changes. Entries written by another version are
 * dropped (they are only a copy of what the server holds).
 */
export const CACHE_VERSION = "0.4";
export const ENTRY_PREFIX = "q:";
export const MIGRATED_FLAG = "meta:migrated-0.3";
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Only these queries are saved to the device: the profile (and whether this is a patient
 * account), the family list, visits, prescription documents (with the code for the QR, but
 * never the doctor's signature image), the home summary, the "Your health" overview, lab
 * results and medical records. Everything else is fetched fresh. The per-person ones carry
 * the patient id in their key (shared/keys.ts), so each person's saved data is kept apart;
 * sign-out removes all of it.
 */
export const PERSISTED_QUERIES = ["role", "profile", "family", "appointments", "rx-documents", "home-summary", "health-overview", "lab-results", "emr", "care"] as const;

export function shouldPersistQuery(queryKey: SavedKey, status: string): boolean {
  return status === "success" && (PERSISTED_QUERIES as readonly string[]).includes(String(queryKey[0]));
}

export const entryId = (queryHash: string) => ENTRY_PREFIX + queryHash;

/** The same hash TanStack Query gives a key made of strings, numbers and null. */
export const hashKey = (key: SavedKey) => JSON.stringify(key);

/** The doctor's signature image is never saved: the QR screen fetches it when it opens. */
function withoutSignatures(key: SavedKey, data: unknown): unknown {
  if (key[0] !== "rx-documents" || !Array.isArray(data)) return data;
  return data.map((doc) => {
    if (!doc || typeof doc !== "object" || !("signature_data" in doc)) return doc;
    const { signature_data: _dropped, ...rest } = doc as Record<string, unknown>;
    return rest;
  });
}

export function encodeEntry(key: SavedKey, data: unknown, updatedAt: number, version = CACHE_VERSION): string {
  const entry: SavedQuery = { k: key, d: withoutSignatures(key, data), t: updatedAt, v: version };
  return JSON.stringify(entry);
}

export function decodeEntry(raw: string | undefined, now: number, version = CACHE_VERSION, maxAge = WEEK_MS): SavedQuery | null {
  if (!raw) return null;
  try {
    const e = JSON.parse(raw) as Partial<SavedQuery> | null;
    if (!e || !Array.isArray(e.k) || typeof e.t !== "number" || e.v !== version || e.d === undefined) return null;
    if (now - e.t > maxAge || !shouldPersistQuery(e.k, "success")) return null;
    return { k: e.k, d: e.d, t: e.t, v: e.v };
  } catch {
    return null;
  }
}

/** Every saved query that is still good. Anything old, unreadable or no longer saved is deleted on the way. */
export function readEntries(store: SyncStore, now: number, version = CACHE_VERSION, maxAge = WEEK_MS): SavedQuery[] {
  const out: SavedQuery[] = [];
  for (const id of store.keys()) {
    if (!id.startsWith(ENTRY_PREFIX)) continue;
    const entry = decodeEntry(store.getString(id), now, version, maxAge);
    if (entry) out.push(entry);
    else store.remove(id);
  }
  return out;
}

/** Removes every saved query (sign-out, account deletion). Flags that are not data stay. */
export function clearEntries(store: SyncStore): void {
  for (const id of store.keys()) if (id.startsWith(ENTRY_PREFIX)) store.remove(id);
}

// ---- The 0.3 blob -------------------------------------------------------------------------
interface OldQuery { queryKey?: unknown; state?: { data?: unknown; dataUpdatedAt?: unknown; status?: unknown } }

/** 0.3 kept every visit in one list; 0.4 keeps the open ones and the latest 30 past ones. */
function visitsFromOldList(list: unknown[]): VisitsData {
  const rows = list.filter((a): a is Appointment => !!a && typeof a === "object" && typeof (a as Appointment).id === "string")
    .map((a) => ({ ...a, review: a.review ?? null }));
  const upcoming = rows.filter(isUpcoming)
    .sort((a, b) => `${a.requested_date} ${a.requested_time ?? ""}`.localeCompare(`${b.requested_date} ${b.requested_time ?? ""}`));
  const past = rows.filter((a) => !isUpcoming(a))
    .sort((a, b) => `${b.requested_date} ${b.requested_time ?? ""}`.localeCompare(`${a.requested_date} ${a.requested_time ?? ""}`));
  return { upcoming, past: past.slice(0, VISITS_PAGE), has_more_past: past.length > VISITS_PAGE };
}

/**
 * Turns the single saved blob from 0.3 into 0.4 entries, so the first start after the
 * update still opens with data while offline. Unreadable or expired input gives nothing.
 */
export function entriesFromOldBlob(raw: string | null | undefined, now: number, maxAge = WEEK_MS): SavedQuery[] {
  if (!raw) return [];
  let queries: OldQuery[];
  try {
    const blob = JSON.parse(raw) as { timestamp?: unknown; clientState?: { queries?: unknown } } | null;
    if (!blob || typeof blob.timestamp !== "number" || now - blob.timestamp > maxAge) return [];
    queries = Array.isArray(blob.clientState?.queries) ? (blob.clientState!.queries as OldQuery[]) : [];
  } catch {
    return [];
  }
  const out: SavedQuery[] = [];
  for (const q of queries) {
    const key = q?.queryKey;
    const state = q?.state;
    if (!Array.isArray(key) || !state || state.data === undefined || typeof state.dataUpdatedAt !== "number") continue;
    if (!shouldPersistQuery(key, String(state.status)) || now - state.dataUpdatedAt > maxAge) continue;
    let data = state.data;
    if (key[0] === "appointments") {
      if (!Array.isArray(data)) continue;
      data = visitsFromOldList(data);
    }
    out.push({ k: key, d: withoutSignatures(key, data), t: state.dataUpdatedAt, v: CACHE_VERSION });
  }
  return out;
}

export interface MigrateDeps {
  store: SyncStore;
  /** Reads and decrypts the 0.3 blob; null when there is none. */
  readOld: () => Promise<string | null>;
  /** Deletes the 0.3 blob and its key. */
  deleteOld: () => Promise<void>;
  now: number;
}

/**
 * First start of 0.4: read the old blob once if it exists, write its queries as entries,
 * then delete it. Runs once; a failure still deletes the old blob so it is never read again.
 */
export async function migrateOldCache({ store, readOld, deleteOld, now }: MigrateDeps): Promise<number> {
  if (store.getString(MIGRATED_FLAG)) return 0;
  let moved = 0;
  try {
    for (const entry of entriesFromOldBlob(await readOld(), now)) {
      const id = entryId(hashKey(entry.k));
      // Anything 0.4 already saved is newer than the blob.
      if (store.getString(id) === undefined) { store.set(id, JSON.stringify(entry)); moved++; }
    }
  } catch { /* nothing usable in the old blob */ }
  try { await deleteOld(); } catch { /* tried; it is ignored from now on */ }
  store.set(MIGRATED_FLAG, "1");
  return moved;
}

// ---- Saving -------------------------------------------------------------------------------
export interface SaverQuery { queryKey: SavedKey; queryHash: string; state: { status: string; data: unknown; dataUpdatedAt: number } }

export interface SaverDeps {
  store: SyncStore;
  /** Looks a query up by hash when it is time to write it. */
  find: (queryHash: string) => SaverQuery | undefined;
  /** Runs `work` later, when the app is idle. */
  schedule: (work: () => void) => void;
  /** Development: called with the query's first key part and how long the write took. */
  onWrite?: (name: string, ms: number, bytes: number) => void;
  now?: () => number;
}

/**
 * Writes changed queries one entry at a time, later (never in the middle of a tap or a
 * tab change): `changed` only notes the query, the scheduled flush does the writing.
 */
export function createQuerySaver({ store, find, schedule, onWrite, now = Date.now }: SaverDeps) {
  const dirty = new Set<string>();
  let scheduled = false;
  let stopped = false;

  function flush(): void {
    scheduled = false;
    const hashes = [...dirty];
    dirty.clear();
    if (stopped) return;
    for (const hash of hashes) {
      const q = find(hash);
      if (!q || !shouldPersistQuery(q.queryKey, q.state.status) || q.state.data === undefined) continue;
      const started = now();
      const text = encodeEntry(q.queryKey, q.state.data, q.state.dataUpdatedAt);
      try { store.set(entryId(hash), text); } catch { /* a save that fails is fetched again next time */ }
      onWrite?.(String(q.queryKey[0]), now() - started, text.length);
    }
  }

  return {
    /** A query got new data. */
    changed(q: Pick<SaverQuery, "queryKey" | "queryHash">): void {
      if (stopped || !shouldPersistQuery(q.queryKey, "success")) return;
      dirty.add(q.queryHash);
      if (!scheduled) { scheduled = true; schedule(flush); }
    },
    /** A query was removed from memory (a family member removed, or sign-out). */
    removed(q: Pick<SaverQuery, "queryHash">): void {
      dirty.delete(q.queryHash);
      try { store.remove(entryId(q.queryHash)); } catch { /* cleared at sign-out anyway */ }
    },
    /** Writes what is waiting now (the app is going to the background). */
    flush,
    /** Sign-out: nothing waiting is written, and nothing new is saved until `resume`. */
    stop(): void { stopped = true; dirty.clear(); },
    resume(): void { stopped = false; },
    waiting: () => dirty.size,
  };
}
