import { QueryClient } from "@tanstack/react-query";
import { clearLocalData, PERSISTED_QUERIES, shouldPersistQuery } from "../lib/cache";
import { createEncryptedStorage, type KeyValueStore } from "../lib/encryptedStorage";

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

const CACHE_KEY = "hn.query-cache";

describe("what is saved for offline use", () => {
  it("saves only the profile, appointments, prescription documents, the home summary, lab results and records", () => {
    expect([...PERSISTED_QUERIES].sort()).toEqual(["appointments", "emr", "home-summary", "lab-results", "profile", "role", "rx-documents"]);
    expect(shouldPersistQuery(["lab-results", "p1"], "success")).toBe(true);
    expect(shouldPersistQuery(["emr", "p1"], "success")).toBe(true);
    expect(shouldPersistQuery(["appointments", "p1"], "success")).toBe(true);
    expect(shouldPersistQuery(["rx-documents", "p1"], "success")).toBe(true);
    expect(shouldPersistQuery(["profile", "u1"], "success")).toBe(true);
    expect(shouldPersistQuery(["home-summary", "u1"], "success")).toBe(true);
  });

  it("does not save anything else, or anything that failed", () => {
    for (const key of ["notifications", "rx-requests", "notification-prefs", "booking", "pharmacy-directory", "reschedule", "messages", "letters", "visit-reviews"]) {
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

describe("sign-out clears the offline cache", () => {
  async function signedInState() {
    const { keys, values, storage } = makeStorage();
    const queryClient = new QueryClient();
    queryClient.setQueryData(["appointments", "p1"], [{ id: "a1", reason: "private" }]);
    queryClient.setQueryData(["rx-documents", "p1"], [{ code: "HN-AAAAA-BBBBB" }]);
    queryClient.setQueryData(["profile", "u1"], { first_name: "Ada" });
    await storage.setItem(CACHE_KEY, JSON.stringify({ saved: "health data" }));
    await storage.setItem("sb-session", JSON.stringify({ access_token: "t" }));
    return { keys, values, storage, queryClient };
  }

  it("removes the push registration, the data in memory, the saved data and the session", async () => {
    const { keys, values, storage, queryClient } = await signedInState();
    const order: string[] = [];
    await clearLocalData({
      queryClient, storage, cacheKey: CACHE_KEY,
      unregisterPush: async () => { order.push("push"); },
      endSession: async () => { order.push("session"); await storage.removeItem("sb-session"); },
    });
    // Push goes first: unregistering needs the session that is about to be removed.
    expect(order).toEqual(["push", "session"]);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(queryClient.getQueryData(["appointments", "p1"])).toBeUndefined();
    expect(await storage.getItem(CACHE_KEY)).toBeNull();
    expect(await storage.getItem("sb-session")).toBeNull();
    expect(keys.map.size).toBe(0);
    expect(values.map.size).toBe(0);
    queryClient.clear();
  });

  it("still clears everything when the network steps fail (signing out offline)", async () => {
    const { values, storage, queryClient } = await signedInState();
    await clearLocalData({
      queryClient, storage, cacheKey: CACHE_KEY,
      unregisterPush: async () => { throw new Error("Network request failed"); },
      endSession: async () => { await storage.removeItem("sb-session"); throw new Error("Network request failed"); },
    });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(values.map.size).toBe(0);
    queryClient.clear();
  });

  it("removes data that a late save wrote back while signing out", async () => {
    const { storage, queryClient } = await signedInState();
    await clearLocalData({
      queryClient, storage, cacheKey: CACHE_KEY,
      unregisterPush: async () => {},
      endSession: async () => { await storage.setItem(CACHE_KEY, "written by a save that was already running"); },
    });
    expect(await storage.getItem(CACHE_KEY)).toBeNull();
    queryClient.clear();
  });
});
