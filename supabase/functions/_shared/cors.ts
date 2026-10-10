// CORS with an explicit allowlist (ALLOWED_ORIGINS, comma-separated).
// The request Origin is echoed back only when it is on the list; there is no "*".
import { optionalEnv } from "./clients.ts";

let cached: string[] | undefined;

function allowedOrigins(): string[] {
  cached ??= (optionalEnv("allowedOrigins") ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter((o) => o.length > 0);
  return cached;
}

export function isAllowedOrigin(origin: string | null): boolean {
  return !!origin && allowedOrigins().includes(origin);
}

export function corsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  const origin = req.headers.get("Origin");
  if (isAllowedOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin!;
  return headers;
}

/** Answers a CORS preflight, or returns null for any other method. */
export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  const allowed = isAllowedOrigin(req.headers.get("Origin"));
  return new Response(null, { status: allowed ? 204 : 403, headers: corsHeaders(req) });
}
