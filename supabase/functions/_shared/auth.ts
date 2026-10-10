// Verifies the caller's JWT in code (independent of the gateway's verify_jwt).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { userClient } from "./clients.ts";
import { HttpError } from "./http.ts";

export interface AuthedUser {
  id: string;
  email: string | null;
}

/**
 * Returns the signed-in user and a client that acts as them (RLS applies).
 * Throws 401 when the token is missing, invalid, expired, or not a user token
 * (e.g. the bare anon key).
 */
export async function requireUser(req: Request): Promise<{ user: AuthedUser; client: SupabaseClient }> {
  const header = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) throw new HttpError(401, "Unauthorized");

  const client = userClient(req);
  const { data, error } = await client.auth.getUser(match[1]);
  if (error || !data?.user?.id) throw new HttpError(401, "Unauthorized");

  return { user: { id: data.user.id, email: data.user.email ?? null }, client };
}
