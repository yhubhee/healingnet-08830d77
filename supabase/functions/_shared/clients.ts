// Supabase clients and the single list of environment variable names used by
// every edge function. If a deployment exposes a key under a different name,
// change it here only.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * Environment variable names. Where several names are listed, the first one
 * that is set wins (legacy Supabase key names first, then the newer
 * publishable/secret key names - confirm which ones the project injects).
 */
const ENV_NAMES = {
  supabaseUrl: ["SUPABASE_URL"],
  supabaseAnonKey: ["SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"],
  supabaseServiceKey: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"],
  allowedOrigins: ["ALLOWED_ORIGINS"],
  appUrl: ["APP_URL"],
  paystackSecretKey: ["PAYSTACK_SECRET_KEY"],
  dailyApiKey: ["DAILY_API_KEY"],
  gmailUser: ["GMAIL_USER"],
  gmailAppPassword: ["GMAIL_APP_PASSWORD"],
  internalFunctionSecret: ["INTERNAL_FUNCTION_SECRET"],
  anthropicApiKey: ["ANTHROPIC_API_KEY"],
} as const;

export type EnvKey = keyof typeof ENV_NAMES;

/** Thrown when a required setting is missing. The message names the variable, never its value. */
export class ConfigError extends Error {
  constructor(key: EnvKey) {
    super(`Missing configuration: ${ENV_NAMES[key].join(" or ")}`);
    this.name = "ConfigError";
  }
}

export function optionalEnv(key: EnvKey): string | undefined {
  for (const name of ENV_NAMES[key]) {
    const value = Deno.env.get(name);
    if (value && value.trim() !== "") return value.trim();
  }
  return undefined;
}

export function env(key: EnvKey): string {
  const value = optionalEnv(key);
  if (!value) throw new ConfigError(key);
  return value;
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/**
 * Client that acts as the caller: publishable/anon key plus the caller's
 * Authorization header, so RLS and auth.uid() apply.
 */
export function userClient(req: Request): SupabaseClient {
  return createClient(env("supabaseUrl"), env("supabaseAnonKey"), {
    ...clientOptions,
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
}

let service: SupabaseClient | undefined;

/** Service-role client. Bypasses RLS: only use it after the caller has been authorised. */
export function serviceClient(): SupabaseClient {
  service ??= createClient(env("supabaseUrl"), env("supabaseServiceKey"), clientOptions);
  return service;
}
