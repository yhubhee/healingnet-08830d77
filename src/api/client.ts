import { supabase } from "@/integrations/supabase/client";

/**
 * The single place in the app that knows how to reach the backend.
 *
 * Everything above this file (src/api/*, hooks, components) speaks in domain
 * objects only. If the backend transport ever changes — e.g. an Express server
 * in front of the database — only this file changes.
 */

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type BackendError = { message?: string; code?: string; details?: string } | null;

/** Normalizes a backend error into an ApiError, or returns the data. */
export function unwrap<T>(result: { data: T; error: BackendError }): T {
  if (result.error) {
    const code = result.error.code;
    // Postgres/PostgREST permission + not-found codes mapped to HTTP-ish status
    const status =
      code === "42501" || code === "PGRST301" ? 403 :
      code === "PGRST116" ? 404 :
      code === "23505" ? 409 :
      code === "23502" || code === "23514" ? 400 :
      500;
    throw new ApiError(result.error.message || "Request failed", status, code);
  }
  return result.data;
}

/** Low-level backend handle. Only modules inside src/api may import this. */
export const backend = supabase;

/** Resolves the currently authenticated user id, or throws. */
export async function requireUserId(): Promise<string> {
  const { data } = await backend.auth.getUser();
  if (!data.user) throw new ApiError("Not authenticated", 401);
  return data.user.id;
}

/** Resolves the currently authenticated user id, or null when signed out. */
export async function getUserId(): Promise<string | null> {
  const { data } = await backend.auth.getUser();
  return data.user?.id ?? null;
}
