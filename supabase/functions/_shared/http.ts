// Request/response helpers shared by every function: JSON responses with CORS,
// a size-limited JSON body reader with zod validation, and a handler wrapper
// that turns errors into generic messages (details go to the logs only).
import { z } from "npm:zod@3.23.8";
import { ConfigError } from "./clients.ts";
import { corsHeaders, preflight } from "./cors.ts";

export { z };

export const MAX_BODY_BYTES = 64 * 1024;

/** An error whose status and message are safe to show the browser. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly publicMessage: string,
    /** Logged server-side only. Must not contain secrets or patient data. */
    readonly detail?: string,
  ) {
    super(publicMessage);
    this.name = "HttpError";
  }
}

export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/** Name and message of an error, trimmed, for logs. */
export function describeError(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 300);
  if (e && typeof e === "object" && "message" in e) {
    const o = e as { code?: unknown; message?: unknown };
    return `${String(o.code ?? "error")}: ${String(o.message)}`.slice(0, 300);
  }
  return "unknown error";
}

/** Reads the raw body as text, refusing anything larger than maxBytes. */
export async function readTextLimited(req: Request, maxBytes = MAX_BODY_BYTES): Promise<string> {
  const declared = Number(req.headers.get("Content-Length") ?? "0");
  if (declared > maxBytes) throw new HttpError(413, "Request too large");
  if (!req.body) return "";

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "Request too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Reads and validates a JSON body. Validation errors are not echoed back. */
export async function readJson<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
  maxBytes = MAX_BODY_BYTES,
): Promise<z.output<S>> {
  const text = await readTextLimited(req, maxBytes);
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "Invalid request");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".") || "(body)").join(", ");
    throw new HttpError(400, "Invalid request", `validation failed: ${fields}`);
  }
  return parsed.data;
}

export const uuid = () => z.string().uuid();

/**
 * Wraps a POST handler: answers preflight, rejects other methods, and maps
 * errors to generic JSON responses.
 */
export function handle(fn: string, handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const pre = preflight(req);
    if (pre) return pre;
    if (req.method !== "POST") return json(req, 405, { error: "Method not allowed" });
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) {
        if (e.detail) console.error(`[${fn}] ${e.status}: ${e.detail}`);
        return json(req, e.status, { error: e.publicMessage });
      }
      if (e instanceof ConfigError) {
        console.error(`[${fn}] ${e.message}`);
        return json(req, 500, { error: "Service is not configured" });
      }
      console.error(`[${fn}] unexpected error: ${describeError(e)}`);
      return json(req, 500, { error: "Something went wrong. Please try again." });
    }
  };
}
