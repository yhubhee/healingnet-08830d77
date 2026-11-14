import { QueryClient } from "@tanstack/react-query";
import { clearLocalData, PERSISTED_QUERIES, shouldPersistQuery } from "../lib/cache";
import { createEncryptedStorage, type KeyValueStore } from "../lib/encryptedStorage";
import {
  CACHE_VERSION, clearEntries, createQuerySaver, decodeEntry, encodeEntry, entriesFromOldBlob, entryId, hashKey, MIGRATED_FLAG, migrateOldCache,
  readEntries, WEEK_MS, type SaverQuery, type SyncStore,
} from "../shared/queryPersist";

function memoryStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => { map.set(k, v); },
    removeItem: async (k) => { map.delete(k); },
  };
}

function makeStorage() {
  const keys = memoryStore();
  const values = memoryStore();
  let seed = 7;
  const storage = createEncryptedStorage({
    keys, values,
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 31 + 11) % 251)),
  });
  return { keys, values, storage };
}


describe("what is saved for offline use", () => {
  it("saves only the profile, the family list, visits, prescription documents, the home summary, the health overview, lab results and records", () => {
    expect([...PERSISTED_QUERIES].sort()).toEqual(["appointments", "emr", "family", "health-overview", "home-summary", "lab-results", "profile", "role", "rx-documents"]);
    expect(shouldPersistQuery(["health-overview", "p1"], "success")).toBe(true);
    expect(shouldPersistQuery(["lab-results", "p1"], "success")).toBe(true);
    expect(shouldPersistQuery(["emr", "p1"], "success")).toBe(true);
    expect(shouldPersistQuery(["appointments", "p1"], "success")).toBe(true);
    expect(shouldPersistQuery(["rx-documents", "p1"], "success")).toBe(true);
    expect(shouldPersistQuery(["profile", "u1"], "success")).toBe(true);
    expect(shouldPersistQuery(["home-summary", "u1"], "success")).toBe(true);
  });

  it("does not save anything else, or anything that failed", () => {
    for (const key of ["rx-document", "notifications", "rx-requests", "notification-prefs", "booking", "pharmacy-directory", "reschedule", "messages", "letters", "visit-reviews"]) {
      expect(shouldPersistQuery([key, "x"], "success")).toBe(false);
    }
    expect(shouldPersistQuery(["appointments", "p1"], "error")).toBe(false);
    expect(shouldPersistQuery(["appointments", "p1"], "pending")).toBe(false);
  });
});

describe("encrypted storage", () => {
  it("returns what was stored, and never keeps it readable", async () => {
    const { keys, values, storage } = makeStorage();
    const secret = JSON.stringify({ blood_group: "O+", note: "Ünïcödé ₦ text", long: "x".repeat(5000) });
    await storage.setItem("k", secret);
    expect(await storage.getItem("k")).toBe(secret);
    const raw = values.map.get("k")!;
    expect(raw).not.toContain("blood_group");
    expect(raw).toMatch(/^[0-9a-f]+$/);
    expect(keys.map.get("k")).toHaveLength(64); // a 256-bit key, kept in the secure store
  });

  it("uses a new key each time and forgets on remove", async () => {
    const { keys, storage, values } = makeStorage();
    await storage.setItem("k", "one");
    const first = keys.map.get("k");
    await storage.setItem("k", "two");
    expect(keys.map.get("k")).not.toBe(first);
    await storage.removeItem("k");
    expect(await storage.getItem("k")).toBeNull();
    expect(keys.map.size + values.map.size).toBe(0);
  });

  it("returns nothing when the key is gone", async () => {
    const { keys, storage } = makeStorage();
    await storage.setItem("k", "value");
    keys.map.clear();
    expect(await storage.getItem("k")).toBeNull();
  });
});

function syncStore(): SyncStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getString: (k) => map.get(k),
    set: (k, v) => { map.set(k, v); },
    remove: (k) => { map.delete(k); },
    keys: () => [...map.keys()],
    clear: () => map.clear(),
  };
}

const NOW = 1_800_000_000_000;

describe("sign-out clears the offline cache", () => {
  function signedInState() {
    const store = syncStore();
    const session = new Map<string, string>([["sb-session", JSON.stringify({ access_token: "t" })]]);
    const queryClient = new QueryClient();
    queryClient.setQueryData(["appointments", "p1"], { upcoming: [{ id: "a1", reason: "private" }], past: [], has_more_past: false });
    queryClient.setQueryData(["rx-documents", "p1"], [{ code: "HN-AAAAA-BBBBB" }]);
    queryClient.setQueryData(["profile", "u1"], { first_name: "Ada" });
    store.set(entryId(hashKey(["appointments", "p1"])), encodeEntry(["appointments", "p1"], { upcoming: [], past: [], has_more_past: false }, NOW));
    store.set(entryId(hashKey(["profile", "u1"])), encodeEntry(["profile", "u1"], { first_name: "Ada" }, NOW));
    store.set(MIGRATED_FLAG, "1");
    return { store, session, queryClient };
  }
  const saved = (store: { map: Map<string, string> }) => [...store.map.keys()].filter((k) => k.startsWith("q:"));

  it("removes the push registration, the data in memory, the saved data and the session", async () => {
    const { store, session, queryClient } = signedInState();
    const order: string[] = [];
    await clearLocalData({
      queryClient, clearSaved: () => clearEntries(store),
      unregisterPush: async () => { order.push("push"); },
      endSession: async () => { order.push("session"); session.delete("sb-session"); },
    });
    // Push goes first: unregistering needs the session that is about to be removed.
    expect(order).toEqual(["push", "session"]);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(queryClient.getQueryData(["appointments", "p1"])).toBeUndefined();
    expect(saved(store)).toEqual([]);
    expect(session.size).toBe(0);
    // The "already moved the 0.3 data" note is not data and stays.
    expect(store.getString(MIGRATED_FLAG)).toBe("1");
    queryClient.clear();
  });

  it("still clears everything when the network steps fail (signing out offline)", async () => {
    const { store, queryClient } = signedInState();
    await clearLocalData({
      queryClient, clearSaved: () => clearEntries(store),
      unregisterPush: async () => { throw new Error("Network request failed"); },
      endSession: async () => { throw new Error("Network request failed"); },
    });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(saved(store)).toEqual([]);
    queryClient.clear();
  });

  it("removes data that a late save wrote back while signing out", async () => {
    const { store, queryClient } = signedInState();
    await clearLocalData({
      queryClient, clearSaved: () => clearEntries(store),
      unregisterPush: async () => {},
      endSession: async () => { store.set(entryId("late"), "written by a save that was already running"); },
    });
    expect(saved(store)).toEqual([]);
    queryClient.clear();
  });
});

describe("one saved entry per query", () => {
  it("reads back what was saved, with its key and time", () => {
    const store = syncStore();
    store.set(entryId(hashKey(["lab-results", "p1"])), encodeEntry(["lab-results", "p1"], [{ id: "l1" }], NOW - 1000));
    expect(readEntries(store, NOW)).toEqual([{ k: ["lab-results", "p1"], d: [{ id: "l1" }], t: NOW - 1000, v: CACHE_VERSION }]);
  });

  it("drops entries that are over a week old, from another version, unreadable or no longer saved", () => {
    const store = syncStore();
    store.set(entryId("old"), encodeEntry(["emr", "p1"], [], NOW - WEEK_MS - 1));
    store.set(entryId("other-version"), encodeEntry(["emr", "p2"], [], NOW, "0.3"));
    store.set(entryId("broken"), "{not json");
    store.set(entryId("not-saved-now"), encodeEntry(["visit-reviews", "p1"], {}, NOW));
    store.set(entryId("good"), encodeEntry(["emr", "p3"], [], NOW));
    expect(readEntries(store, NOW).map((e) => e.k)).toEqual([["emr", "p3"]]);
    expect([...store.map.keys()]).toEqual([entryId("good")]);
  });

  it("never saves the doctor's signature image", () => {
    const text = encodeEntry(["rx-documents", "p1"], [{ document_id: "d1", code: "HN-AAAAA-BBBBB", signature_data: "data:image/png;base64,AAAA" }], NOW);
    expect(text).not.toContain("signature_data");
    expect(text).not.toContain("base64");
    expect(decodeEntry(text, NOW)?.d).toEqual([{ document_id: "d1", code: "HN-AAAAA-BBBBB" }]);
  });
});

describe("saving happens later, one query at a time", () => {
  function setup() {
    const store = syncStore();
    const queries = new Map<string, SaverQuery>();
    const scheduled: (() => void)[] = [];
    const writes: string[] = [];
    const saver = createQuerySaver({
      store, find: (hash) => queries.get(hash), schedule: (work) => scheduled.push(work),
      onWrite: (name) => writes.push(name), now: () => NOW,
    });
    const query = (key: unknown[], data: unknown, status = "success"): SaverQuery => {
      const q = { queryKey: key, queryHash: hashKey(key), state: { status, data, dataUpdatedAt: NOW } };
      queries.set(q.queryHash, q);
      return q;
    };
    return { store, saver, scheduled, writes, query };
  }

  it("a change is only noted; nothing is written until the scheduled moment", () => {
    const { store, saver, scheduled, query } = setup();
    saver.changed(query(["appointments", "p1"], { upcoming: [], past: [], has_more_past: false }));
    expect(store.map.size).toBe(0);
    expect(scheduled).toHaveLength(1);
    scheduled[0]();
    expect([...store.map.keys()]).toEqual([entryId(hashKey(["appointments", "p1"]))]);
  });

  it("a Visits refresh rewrites only Visits", () => {
    const { store, saver, scheduled, writes, query } = setup();
    saver.changed(query(["appointments", "p1"], { upcoming: [], past: [], has_more_past: false }));
    saver.changed(query(["lab-results", "p1"], []));
    scheduled[0]();
    const labsBefore = store.getString(entryId(hashKey(["lab-results", "p1"])));
    writes.length = 0;
    saver.changed(query(["appointments", "p1"], { upcoming: [{ id: "a1" }], past: [], has_more_past: false }));
    scheduled[1]();
    expect(writes).toEqual(["appointments"]);
    expect(store.getString(entryId(hashKey(["lab-results", "p1"])))).toBe(labsBefore);
  });

  it("many changes before the save make one write each", () => {
    const { saver, scheduled, writes, query } = setup();
    const q = query(["home-summary", "u1"], { unreadCount: 1, updates: [] });
    saver.changed(q); saver.changed(q); saver.changed(q);
    expect(scheduled).toHaveLength(1);
    scheduled[0]();
    expect(writes).toEqual(["home-summary"]);
  });

  it("does not save queries outside the list, or ones that failed", () => {
    const { store, saver, scheduled, query } = setup();
    saver.changed(query(["notifications", "u1"], []));
    saver.changed(query(["rx-document", "d1"], { signature_data: "x" }));
    expect(scheduled).toHaveLength(0);
    saver.changed(query(["emr", "p1"], undefined, "error"));
    scheduled[0]?.();
    expect(store.map.size).toBe(0);
  });

  it("a removed query's entry is deleted", () => {
    const { store, saver, scheduled, query } = setup();
    const q = query(["emr", "p9"], []);
    saver.changed(q);
    scheduled[0]();
    saver.removed(q);
    expect(store.map.size).toBe(0);
  });

  it("after sign-out starts, nothing that was waiting is written", () => {
    const { store, saver, scheduled, query } = setup();
    saver.changed(query(["profile", "u1"], { first_name: "Ada" }));
    saver.stop();
    scheduled[0]();
    expect(store.map.size).toBe(0);
    saver.resume();
    saver.changed(query(["profile", "u2"], { first_name: "Bola" }));
    scheduled[1]();
    expect(store.map.size).toBe(1);
  });
});

describe("moving the 0.3 saved data across", () => {
  const visit = (id: string, status: string, date: string) => ({
    id, patient_id: "p1", doctor_id: null, hospital_id: null, requested_date: date, requested_time: "09:00", status,
    reason: null, is_telemedicine: false, decline_reason: null, doctors: null, hospitals: null,
  });
  const oldBlob = (queries: { queryKey: unknown[]; state: { data: unknown; dataUpdatedAt: number; status: string } }[], timestamp = NOW - 5000) =>
    JSON.stringify({ buster: "0.3.0", timestamp, clientState: { mutations: [], queries: queries.map((q) => ({ ...q, queryHash: JSON.stringify(q.queryKey) })) } });
  const state = (data: unknown, status = "success") => ({ data, dataUpdatedAt: NOW - 6000, status });

  it("turns the old list of every visit into open visits plus the latest 30 past ones", () => {
    const past = Array.from({ length: 40 }, (_, i) => visit(`c${i}`, "completed", `2026-${String(1 + (i % 9)).padStart(2, "0")}-${String(10 + (i % 18)).padStart(2, "0")}`));
    const entries = entriesFromOldBlob(oldBlob([{ queryKey: ["appointments", "p1"], state: state([visit("u2", "confirmed", "2026-12-05"), ...past, visit("u1", "pending", "2026-12-01")]) }]), NOW);
    expect(entries).toHaveLength(1);
    const data = entries[0].d as { upcoming: { id: string }[]; past: { id: string; requested_date: string }[]; has_more_past: boolean };
    expect(data.upcoming.map((a) => a.id)).toEqual(["u1", "u2"]);
    expect(data.past).toHaveLength(30);
    expect(data.has_more_past).toBe(true);
    const dates = data.past.map((a) => a.requested_date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(entries[0].t).toBe(NOW - 6000);
  });

  it("drops signature images and anything that is not saved in 0.4", () => {
    const entries = entriesFromOldBlob(oldBlob([
      { queryKey: ["rx-documents", "p1"], state: state([{ document_id: "d1", signature_data: "data:image/png;base64,AAAA" }]) },
      { queryKey: ["profile", "u1"], state: state({ first_name: "Ada" }) },
      { queryKey: ["visit-reviews", "p1"], state: state({}) },
      { queryKey: ["emr", "p1"], state: state(undefined, "pending") },
    ]), NOW);
    expect(entries.map((e) => e.k[0])).toEqual(["rx-documents", "profile"]);
    expect(JSON.stringify(entries)).not.toContain("signature_data");
  });

  it("gives nothing for a missing, broken or week-old blob", () => {
    expect(entriesFromOldBlob(null, NOW)).toEqual([]);
    expect(entriesFromOldBlob("not json", NOW)).toEqual([]);
    expect(entriesFromOldBlob(oldBlob([{ queryKey: ["profile", "u1"], state: state({}) }], NOW - WEEK_MS - 1), NOW)).toEqual([]);
  });

  it("runs once: reads the old blob, writes entries, deletes the blob", async () => {
    const store = syncStore();
    let old: string | null = oldBlob([{ queryKey: ["profile", "u1"], state: state({ first_name: "Ada" }) }, { queryKey: ["lab-results", "p1"], state: state([{ id: "l1" }]) }]);
    let reads = 0;
    const deps = { store, now: NOW, readOld: async () => { reads++; return old; }, deleteOld: async () => { old = null; } };
    expect(await migrateOldCache(deps)).toBe(2);
    expect(old).toBeNull();
    expect(readEntries(store, NOW).map((e) => e.k[0]).sort()).toEqual(["lab-results", "profile"]);
    expect(await migrateOldCache(deps)).toBe(0);
    expect(reads).toBe(1);
  });

  it("keeps what 0.4 already saved, and still deletes the blob when it cannot be read", async () => {
    const store = syncStore();
    store.set(entryId(hashKey(["profile", "u1"])), encodeEntry(["profile", "u1"], { first_name: "Newer" }, NOW));
    let deleted = 0;
    await migrateOldCache({ store, now: NOW, readOld: async () => oldBlob([{ queryKey: ["profile", "u1"], state: state({ first_name: "Older" }) }]), deleteOld: async () => { deleted++; } });
    expect((readEntries(store, NOW)[0].d as { first_name: string }).first_name).toBe("Newer");
    const other = syncStore();
    await migrateOldCache({ store: other, now: NOW, readOld: async () => { throw new Error("no key"); }, deleteOld: async () => { deleted++; } });
    expect(deleted).toBe(2);
    expect(other.getString(MIGRATED_FLAG)).toBe("1");
  });
});
