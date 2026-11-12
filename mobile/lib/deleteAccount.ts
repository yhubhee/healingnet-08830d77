// Calls the delete-account edge function with the signed-in person's own token.
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";
import { supabase } from "./supabase";

export interface DeleteResult { deleted: boolean; held_by_hospitals: boolean }

export async function deleteMyAccount(): Promise<DeleteResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    throw new Error("Network problem. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as Partial<DeleteResult> & { error?: string };
  if (!res.ok || !body.deleted) throw new Error(body.error || "We couldn't delete your account. Please try again.");
  return { deleted: true, held_by_hospitals: !!body.held_by_hospitals };
}
