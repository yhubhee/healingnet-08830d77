import { test as base, expect, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { authFile, creds, SUPABASE_KEY, SUPABASE_URL, type Role } from "./env";

// ---------------------------------------------------------------------------
// Cross-cutting checks, attached to every page a test opens.
// ---------------------------------------------------------------------------
type Issue = { kind: string; detail: string; url: string };

// Noise from the browser or third parties, not from the app.
const IGNORED_CONSOLE = [
  /Download the React DevTools/i,
  /React Router Future Flag Warning/i,
  /\[vite\]/i,
];

export function watchPage(page: Page, issues: Issue[]) {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    issues.push({ kind: "console error", detail: text.slice(0, 400), url: page.url() });
  });
  page.on("pageerror", (err) => issues.push({ kind: "page error", detail: String(err).slice(0, 400), url: page.url() }));
  page.on("response", (res) => {
    if (!SUPABASE_URL || !res.url().startsWith(SUPABASE_URL) || res.status() < 400) return;
    issues.push({ kind: `supabase ${res.status()}`, detail: `${res.request().method()} ${res.url().replace(SUPABASE_URL, "").slice(0, 200)}`, url: page.url() });
  });
}

/** Layout and text checks for the page as it is now. */
export async function checkPage(page: Page, issues: Issue[]) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - doc.clientWidth;
    const text = document.body.innerText || "";
    const bad = text.match(/(^|[^\w-])(undefined|NaN|null)(?![\w-])/g);
    return { overflow, bad: bad ? Array.from(new Set(bad.map((s) => s.trim()))) : [] };
  });
  if (r.overflow > 1) issues.push({ kind: "horizontal scroll", detail: `${r.overflow}px wider than the viewport`, url: page.url() });
  if (r.bad.length) issues.push({ kind: "bad text", detail: `Shows ${r.bad.join(", ")}`, url: page.url() });
}

/** Go to a route, wait for it to settle, and run the page checks. */
export async function visit(page: Page, issues: Issue[], route: string) {
  await page.goto(route);
  await expect(page.locator("main, #root").first()).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  // Give lazy routes and queries a moment to finish rendering.
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15_000 }).catch(() => {});
  await checkPage(page, issues);
}

function report(issues: Issue[], testInfo: TestInfo) {
  if (!issues.length) return;
  const unique = Array.from(new Map(issues.map((i) => [`${i.kind}|${i.detail}|${new URL(i.url).pathname}`, i])).values());
  testInfo.annotations.push(...unique.map((i) => ({ type: i.kind, description: `${new URL(i.url).pathname}: ${i.detail}` })));
  expect.soft(unique.map((i) => `${i.kind} on ${new URL(i.url).pathname}: ${i.detail}`), "cross-cutting page checks").toEqual([]);
}

// ---------------------------------------------------------------------------
// Database access as the signed-in test user (publishable key + their password;
// exactly what the browser can do, never the service role).
// ---------------------------------------------------------------------------
const clients = new Map<Role, Promise<SupabaseClient>>();
export function db(role: Role): Promise<SupabaseClient> {
  if (!clients.has(role)) {
    clients.set(role, (async () => {
      const c = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await c.auth.signInWithPassword(creds(role));
      if (error) throw new Error(`DB sign-in failed for ${role}: ${error.message}`);
      return c;
    })());
  }
  return clients.get(role)!;
}

// ---------------------------------------------------------------------------
// Ledger of everything the tests create, for e2e/cleanup.md.
// ---------------------------------------------------------------------------
const LEDGER = path.join("e2e", "results", "created.jsonl");
export function recordCreated(table: string, id: string | null | undefined, note: string) {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.appendFileSync(LEDGER, JSON.stringify({ table, id: id ?? "(not found)", note, at: new Date().toISOString() }) + "\n");
}

/** A short tag unique to this run, so text created by different runs never collides. */
export const RUN = process.env.E2E_RUN_ID || (process.env.E2E_RUN_ID = Date.now().toString(36).slice(-6));
export const e2e = (text: string) => `[E2E] ${text} ${RUN}`;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
type Fixtures = {
  issues: Issue[];
  /** A page signed in as the given role, with the page checks attached. */
  as: (role: Role) => Promise<Page>;
};

export const test = base.extend<Fixtures>({
  issues: async ({}, use, testInfo) => {
    const issues: Issue[] = [];
    await use(issues);
    report(issues, testInfo);
  },
  as: async ({ browser, issues }, use, testInfo) => {
    const contexts: BrowserContext[] = [];
    const pages = new Map<Role, Page>();
    await use(async (role) => {
      if (pages.has(role)) return pages.get(role)!;
      // Playwright traces every context made from `browser` (trace: retain-on-failure).
      const ctx = await newContext(browser, role, testInfo);
      contexts.push(ctx);
      const page = await ctx.newPage();
      watchPage(page, issues);
      pages.set(role, page);
      return page;
    });
    // Failure screenshots and traces cover these contexts too (see playwright.config.ts).
    for (const c of contexts) await c.close();
  },
});

async function newContext(browser: Browser, role: Role, testInfo: TestInfo) {
  const use = testInfo.project.use;
  return browser.newContext({
    storageState: authFile(role),
    viewport: use.viewport,
    hasTouch: use.hasTouch,
    baseURL: use.baseURL,
    timezoneId: use.timezoneId,
    permissions: [],
  });
}

export const isMobile = (testInfo: TestInfo) => (testInfo.project.use.viewport?.width ?? 1280) < 600;
export { expect };
