import { parseAuthLink } from "../shared/authLinks";
import { consultUrl, screenForUrl, verifyUrl, webPage } from "../shared/links";

describe("notification URL → app screen", () => {
  it("opens Visits for appointment links", () => {
    expect(screenForUrl("/patient/appointments")).toBe("/(tabs)/visits");
    expect(screenForUrl("/patient/appointments/")).toBe("/(tabs)/visits");
    expect(screenForUrl("/patient/appointments?tab=upcoming")).toBe("/(tabs)/visits");
    expect(screenForUrl("https://healingnet-08830d77.vercel.app/patient/appointments")).toBe("/(tabs)/visits");
  });

  it("opens Prescriptions for prescription links", () => {
    expect(screenForUrl("/patient/prescriptions")).toBe("/prescriptions");
    expect(screenForUrl("/patient/prescriptions/abc/print")).toBe("/prescriptions");
    expect(screenForUrl("/patient/prescriptions#rx")).toBe("/prescriptions");
  });

  it("opens the 0.2 screens: lab results, records, letters and messages", () => {
    expect(screenForUrl("/patient/lab-results")).toBe("/lab-results");
    expect(screenForUrl("/patient/lab-results/123")).toBe("/lab-results");
    expect(screenForUrl("/patient/records")).toBe("/records");
    expect(screenForUrl("/patient/medical-records")).toBe("/records");
    expect(screenForUrl("/patient/letters")).toBe("/letters");
    expect(screenForUrl("https://healingnet-08830d77.vercel.app/patient/letters?id=1")).toBe("/letters");
    expect(screenForUrl("/patient/messages")).toBe("/(tabs)/messages");
    expect(screenForUrl("/patient/messages/")).toBe("/(tabs)/messages");
  });

  it("opens Home for anything unknown", () => {
    for (const url of ["/patient/lab-resultsX", "/patient/triage", "/doctor/messages", "/doctor/appointments", "/patient/appointmentsX", "/", "", "   ", null, undefined, 42, { url: "/patient/appointments" }, "javascript:alert(1)", "https://evil.example/x"]) {
      expect(screenForUrl(url)).toBe("/(tabs)");
    }
  });
});

describe("QR content builder", () => {
  it("points at the website's verify page for the code", () => {
    expect(verifyUrl("https://healingnet-08830d77.vercel.app", "HN-7K4P2-9QWXZ")).toBe("https://healingnet-08830d77.vercel.app/verify/HN-7K4P2-9QWXZ");
  });
  it("ignores a trailing slash on the website address", () => {
    expect(verifyUrl("https://example.org/", "HN-AAAAA-BBBBB")).toBe("https://example.org/verify/HN-AAAAA-BBBBB");
  });
  it("escapes unusual characters in a code", () => {
    expect(verifyUrl("https://example.org", "A B/C?")).toBe("https://example.org/verify/A%20B%2FC%3F");
  });
});

describe("website hand-offs", () => {
  it("builds website pages and the video-visit page", () => {
    expect(webPage("https://example.org/", "/patient/messages")).toBe("https://example.org/patient/messages");
    expect(webPage("https://example.org", "terms")).toBe("https://example.org/terms");
    expect(consultUrl("https://example.org", "abc-123")).toBe("https://example.org/consult/abc-123?mode=appointment");
  });
});

describe("links back into the app", () => {
  it("reads a one-time code", () => {
    expect(parseAuthLink("healingnet://auth-callback?code=abc123").code).toBe("abc123");
  });
  it("reads tokens after the #", () => {
    const link = parseAuthLink("healingnet://reset-password#access_token=AT&refresh_token=RT&type=recovery");
    expect([link.accessToken, link.refreshToken]).toEqual(["AT", "RT"]);
  });
  it("reads an error", () => {
    expect(parseAuthLink("healingnet://reset-password?error=access_denied&error_description=Email+link+is+invalid+or+has+expired").error).toBe("Email link is invalid or has expired");
  });
  it("copes with nothing", () => {
    expect(parseAuthLink(null)).toEqual({ code: null, accessToken: null, refreshToken: null, error: null });
    expect(parseAuthLink("healingnet://auth-callback").code).toBeNull();
  });
});
