// The in-app video call: which addresses the call's WebView may load, and which pages may
// use the camera and microphone. Everything else opens in the phone's browser.

export const DAILY_DOMAIN = "daily.co";

function parse(url: unknown): { scheme: string; host: string } | null {
  if (typeof url !== "string") return null;
  const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i.exec(url.trim());
  if (!m) return null;
  const authority = m[2];
  // "user@host" tricks are refused outright.
  if (authority.includes("@") || authority.includes("\\")) return null;
  return { scheme: m[1].toLowerCase(), host: authority.replace(/:\d+$/, "").toLowerCase() };
}

/** The Daily domain itself or one of its subdomains (the room is at <name>.daily.co), over https. */
export function isDailyUrl(url: unknown): boolean {
  const u = parse(url);
  return !!u && u.scheme === "https" && (u.host === DAILY_DOMAIN || u.host.endsWith(`.${DAILY_DOMAIN}`));
}

function isOurSite(url: unknown, webUrl: string): boolean {
  const u = parse(url); const ours = parse(webUrl);
  return !!u && !!ours && u.scheme === "https" && u.host === ours.host;
}

/** The call page may only move within Daily and our own website. */
export function callMayNavigate(url: unknown, webUrl: string): boolean {
  if (typeof url === "string" && /^about:(blank|srcdoc)$/i.test(url.trim())) return true;
  return isDailyUrl(url) || isOurSite(url, webUrl);
}

/** Something else was tapped (a link in the chat): open it in the browser, if it is a web link at all. */
export function opensInBrowser(url: unknown): boolean {
  const u = parse(url);
  return !!u && (u.scheme === "https" || u.scheme === "http");
}

/** The camera and microphone are granted to Daily's pages only. */
export const mayUseCamera = (origin: unknown) => isDailyUrl(origin);

/** The room address with the meeting token, as Daily's own page expects it. */
export function callPageUrl(roomUrl: string, token: string): string | null {
  if (!isDailyUrl(roomUrl) || !token) return null;
  return `${roomUrl}${roomUrl.includes("?") ? "&" : "?"}t=${encodeURIComponent(token)}`;
}
