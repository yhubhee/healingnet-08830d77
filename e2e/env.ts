// Loads .env (Supabase URL and publishable key) and .env.test (test logins) into process.env.
// Values are never printed.
import fs from "node:fs";
import path from "node:path";

function load(file: string) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

load(".env.test");
load(".env");

export type Role = "patient" | "doctor" | "hospital";
export const ROLES: Role[] = ["patient", "doctor", "hospital"];

export function creds(role: Role) {
  const email = process.env[`E2E_${role.toUpperCase()}_EMAIL`];
  const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`];
  if (!email || !password) throw new Error(`Missing E2E_${role.toUpperCase()}_EMAIL or _PASSWORD in .env.test`);
  return { email, password };
}

export const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
export const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
export const authFile = (role: Role) => path.join("e2e", ".auth", `${role}.json`);
