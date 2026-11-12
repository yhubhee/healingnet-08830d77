// Reads what Supabase puts on a link back into the app (healingnet://auth-callback or
// healingnet://reset-password): a one-time code, tokens, or an error.

export interface AuthLink {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
}

export function parseAuthLink(url: string | null | undefined): AuthLink {
  const out: AuthLink = { code: null, accessToken: null, refreshToken: null, error: null };
  if (!url) return out;
  const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  const beforeHash = url.split("#")[0];
  const query = beforeHash.includes("?") ? beforeHash.slice(beforeHash.indexOf("?") + 1) : "";
  const read = (part: string) => {
    for (const pair of part.split("&")) {
      if (!pair) continue;
      const i = pair.indexOf("=");
      const key = decodeURIComponent(i < 0 ? pair : pair.slice(0, i));
      let value = i < 0 ? "" : pair.slice(i + 1).replace(/\+/g, " ");
      try { value = decodeURIComponent(value); } catch { /* keep the raw value */ }
      if (key === "code") out.code = value;
      else if (key === "access_token") out.accessToken = value;
      else if (key === "refresh_token") out.refreshToken = value;
      else if (key === "error_description") out.error = value;
      else if (key === "error" && !out.error) out.error = value;
    }
  };
  read(query);
  read(hash);
  return out;
}
