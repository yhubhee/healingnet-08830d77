// Sign-in helpers: Google, and finishing a link that comes back into the app.
import * as WebBrowser from "expo-web-browser";
import { parseAuthLink } from "@/shared/authLinks";
import { AUTH_CALLBACK } from "./env";
import { supabase } from "./supabase";

// A code can arrive twice (from the in-app browser and as a deep link); use it once.
const usedCodes = new Set<string>();

export type AuthLinkResult = "signed-in" | "nothing" | { error: string };

/** Turns the code or tokens on a returning link into a session. */
export async function finishAuthLink(url: string | null | undefined): Promise<AuthLinkResult> {
  const link = parseAuthLink(url);
  if (link.error) return { error: link.error };
  if (link.code) {
    if (usedCodes.has(link.code)) return "nothing";
    usedCodes.add(link.code);
    const { error } = await supabase.auth.exchangeCodeForSession(link.code);
    return error ? { error: error.message } : "signed-in";
  }
  if (link.accessToken && link.refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
    return error ? { error: error.message } : "signed-in";
  }
  return "nothing";
}

/** Google sign-in in the system browser, returning to healingnet://auth-callback. */
export async function signInWithGoogle(): Promise<"signed-in" | "cancelled" | { error: string }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: AUTH_CALLBACK, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return { error: error?.message ?? "Could not start Google sign-in" };
  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_CALLBACK);
  if (result.type !== "success") return "cancelled";
  const done = await finishAuthLink(result.url);
  if (done === "signed-in") return "signed-in";
  if (done === "nothing") {
    // The deep-link screen may have used the code first.
    const { data: s } = await supabase.auth.getSession();
    return s.session ? "signed-in" : "cancelled";
  }
  return done;
}

/** Same wording as the website's sign-up page. */
export function signupErrorMessage(message?: string): string {
  if (message && /already (registered|exists)/i.test(message)) return "An account with this email already exists. Try signing in instead.";
  if (message && /password/i.test(message)) return "Choose a stronger password (at least 6 characters).";
  return "We couldn't create your account. Please check your details and try again.";
}
