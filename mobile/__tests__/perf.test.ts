import {
  cleanPerfName, createPerfQueue, createTimedFetch, PERF_BATCH, PERF_MAX_WAITING, requestName, screenName, screenStart, slowLine,
  type PerfEvent,
} from "../shared/perf";

const UUID = "3f2b8c1e-9a4d-4e7b-8f10-2c5d6e7f8a9b";
const event = (over: Partial<PerfEvent> = {}): PerfEvent => ({
  occurred_at: "2026-11-14T10:00:00.000Z", platform: "android", app_version: "0.4.0", kind: "screen",
  name: "/(tabs)/visits", duration_ms: 120, ok: true, network: "wifi", ...over,
});

describe("names never carry ids or query strings", () => {
  it("keeps route patterns as they are", () => {
    expect(screenName("/(tabs)/visits")).toBe("/(tabs)/visits");
    expect(screenName("/lab-results/[id]")).toBe("/lab-results/[id]");
    expect(screenName("/admin/hospitals/:id")).toBe("/admin/hospitals/:id");
    expect(screenName("/(tabs)/visits", true)).toBe("/(tabs)/visits:network");
  });

  it("replaces ids, share codes and long numbers, and drops the query string", () => {
    expect(cleanPerfName(`/lab-results/${UUID}`)).toBe("/lab-results/:id");
    expect(cleanPerfName(`/lab-results/${UUID.toUpperCase()}?tab=2#top`)).toBe("/lab-results/:id");
    expect(cleanPerfName("/share/HN-AB12C-9ZX8Q")).toBe("/share/:code");
    expect(cleanPerfName("/verify/08031234567")).toBe("/verify/:n");
    expect(cleanPerfName("/visits?join=abc&token=secret")).toBe("/visits");
  });

  it("refuses anything that is not a plain name", () => {
    expect(cleanPerfName("")).toBeNull();
    expect(cleanPerfName(null)).toBeNull();
    expect(cleanPerfName("Tobi Okafor")).toBeNull();
    expect(cleanPerfName("/search/blood pressure")).toBeNull();
    expect(cleanPerfName("a@b.com")).toBeNull();
  });

  it("names requests by type and target only", () => {
    const base = "https://abc.supabase.co";
    expect(requestName(`${base}/rest/v1/patient_appointments?patient_id=eq.${UUID}&select=*`)).toBe("rest:patient_appointments");
    expect(requestName(`${base}/rest/v1/rpc/my_visits`)).toBe("rpc:my_visits");
    expect(requestName(`${base}/functions/v1/daily-room`)).toBe("fn:daily-room");
    expect(requestName(`${base}/auth/v1/token?grant_type=refresh_token`)).toBe("auth:token");
    expect(requestName(`${base}/storage/v1/object/family-documents/${UUID}/${UUID}/x.jpg`)).toBe("storage:family-documents");
    expect(requestName(`${base}/storage/v1/object/sign/family-documents/${UUID}/x.pdf`)).toBe("storage:family-documents");
    expect(requestName(`${base}/storage/v1/object/list/avatars`)).toBe("storage:avatars");
    expect(requestName(`${base}/storage/v1/object/public/avatars/${UUID}.png?v=3`)).toBe("storage:avatars");
    expect(requestName("https://example.com/anything")).toBeNull();
    expect(requestName(undefined)).toBeNull();
  });

  it("no request name can contain an id, an email or a query string", () => {
    for (const url of [
      `https://x.supabase.co/rest/v1/patients?id=eq.${UUID}&email=eq.a@b.com`,
      `https://x.supabase.co/rest/v1/rpc/rx_document?p_document_id=${UUID}`,
      `https://x.supabase.co/storage/v1/object/family-documents/${UUID}/${UUID}/${UUID}.pdf?token=eyJhbGciOi`,
    ]) {
      const name = requestName(url)!;
      expect(name).not.toMatch(/[?=@]/);
      expect(name).not.toContain(UUID);
      expect(name).not.toContain("eyJ");
    }
  });

  it("the slow line holds a name and a time, nothing else", () => {
    expect(slowLine(event({ duration_ms: 3412.4 }))).toBe("[speed] slow screen /(tabs)/visits 3412 ms on wifi");
    expect(slowLine(event({ kind: "request", name: "rpc:my_visits", duration_ms: 1500, ok: false, network: "cellular" })))
      .toBe("[speed] slow request rpc:my_visits 1500 ms (failed) on cellular");
  });
});

describe("batching", () => {
  function setup(over: { enabled?: () => boolean; canSend?: () => boolean; send?: (e: PerfEvent[]) => Promise<boolean> } = {}) {
    const sent: PerfEvent[][] = [];
    const lines: string[] = [];
    const queue = createPerfQueue({
      send: over.send ?? (async (e) => { sent.push(e); return true; }),
      enabled: over.enabled ?? (() => true),
      canSend: over.canSend ?? (() => true),
      devLog: (l) => lines.push(l),
    });
    return { queue, sent, lines };
  }

  it("sends at most 50 at a time", async () => {
    const { queue, sent } = setup();
    for (let i = 0; i < 120; i++) queue.record(event({ duration_ms: i }));
    await queue.flush(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(PERF_BATCH);
    expect(sent[0][0].duration_ms).toBe(0); // oldest first
    expect(queue.waiting()).toBe(70);
    await queue.flush(5);
    expect(sent.map((b) => b.length)).toEqual([50, 50, 20]);
    expect(queue.waiting()).toBe(0);
  });

  it("keeps at most 300 waiting and drops the oldest", async () => {
    const batches: PerfEvent[][] = [];
    let can = false;
    const { queue } = setup({ canSend: () => can, send: async (e) => { batches.push(e); return true; } });
    for (let i = 0; i < 340; i++) queue.record(event({ duration_ms: i }));
    expect(queue.waiting()).toBe(PERF_MAX_WAITING);
    can = true;
    await queue.flush(1);
    expect(batches[0][0].duration_ms).toBe(40); // 0 to 39 were dropped
  });

  it("records nothing while the switch is off", async () => {
    let on = false;
    const { queue, sent } = setup({ enabled: () => on });
    queue.record(event());
    expect(queue.waiting()).toBe(0);
    on = true;
    queue.record(event());
    on = false; // turned off before the next send: what was waiting is forgotten
    await queue.flush();
    expect(sent).toHaveLength(0);
    expect(queue.waiting()).toBe(0);
  });

  it("waits while offline or signed out, and keeps the events after a failed send", async () => {
    let can = false;
    let ok = false;
    const sent: PerfEvent[][] = [];
    const { queue } = setup({ canSend: () => can, send: async (e) => { sent.push(e); return ok; } });
    queue.record(event());
    await queue.flush();
    expect(sent).toHaveLength(0);
    can = true;
    await queue.flush();
    expect(queue.waiting()).toBe(1); // the send failed: still waiting
    ok = true;
    await queue.flush();
    expect(queue.waiting()).toBe(0);
  });

  it("a send that throws is swallowed", async () => {
    const { queue } = setup({ send: async () => { throw new Error("network"); } });
    queue.record(event());
    await expect(queue.flush()).resolves.toBeUndefined();
    expect(queue.waiting()).toBe(1);
  });

  it("cleans names on the way in and refuses bad ones", () => {
    const { queue, lines } = setup({ canSend: () => false });
    queue.record(event({ name: "Tobi Okafor" }));
    queue.record(event({ name: "rpc:log_perf_events", kind: "request" }));
    queue.record(event({ duration_ms: -5 }));
    queue.record(event({ duration_ms: Number.NaN }));
    expect(queue.waiting()).toBe(0);
    queue.record(event({ name: `/lab-results/${UUID}`, duration_ms: 900 }));
    expect(queue.waiting()).toBe(1);
    expect(lines).toEqual(["[speed] slow screen /lab-results/:id 900 ms on wifi"]);
  });
});

describe("the timing fetch", () => {
  function setup(response: { ok: boolean; status: number } | Error) {
    const calls: unknown[][] = [];
    const recorded: { name: string; duration_ms: number; ok: boolean; http_status: number }[] = [];
    let clock = 1000;
    const timed = createTimedFetch({
      fetch: (async (...args: unknown[]) => { calls.push(args); clock += 250; if (response instanceof Error) throw response; return response; }) as unknown as typeof fetch,
      now: () => clock,
      record: (e) => recorded.push(e),
    });
    return { timed, calls, recorded };
  }

  it("times a request and passes it through untouched", async () => {
    const { timed, calls, recorded } = setup({ ok: true, status: 200 });
    const init = { method: "POST", body: "{}" };
    const res = await timed("https://x.supabase.co/rest/v1/rpc/my_visits", init);
    expect(res).toEqual({ ok: true, status: 200 });
    expect(calls[0]).toEqual(["https://x.supabase.co/rest/v1/rpc/my_visits", init]);
    expect(recorded).toEqual([{ name: "rpc:my_visits", duration_ms: 250, ok: true, http_status: 200 }]);
  });

  it("never times log_perf_events itself", async () => {
    const { timed, calls, recorded } = setup({ ok: true, status: 200 });
    await timed("https://x.supabase.co/rest/v1/rpc/log_perf_events", { method: "POST" });
    expect(calls).toHaveLength(1);
    expect(recorded).toHaveLength(0);
  });

  it("records failures and still throws them", async () => {
    const failing = setup(new Error("Network request failed"));
    await expect(failing.timed("https://x.supabase.co/rest/v1/patients?id=eq.1")).rejects.toThrow("Network request failed");
    expect(failing.recorded).toEqual([{ name: "rest:patients", duration_ms: 250, ok: false, http_status: 0 }]);
    const denied = setup({ ok: false, status: 403 });
    await denied.timed(new URL("https://x.supabase.co/rest/v1/rpc/my_family"));
    expect(denied.recorded[0]).toMatchObject({ name: "rpc:my_family", ok: false, http_status: 403 });
  });

  it("leaves other requests alone", async () => {
    const { timed, recorded } = setup({ ok: true, status: 200 });
    await timed("https://exp.host/--/api/v2/push/send");
    expect(recorded).toHaveLength(0);
  });
});

describe("where a screen's timing starts", () => {
  it("uses the tap when it was recent, otherwise when the screen took focus", () => {
    expect(screenStart(1000, 1200)).toBe(1000);
    expect(screenStart(1000, 9000)).toBe(9000); // an old tap: a deep link or a notification opened it
    expect(screenStart(0, 500)).toBe(500);
    expect(screenStart(600, 500)).toBe(500);
  });
});
