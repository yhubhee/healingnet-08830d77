import { notificationTarget, screenForUrl } from "../shared/links";
import {
  checkDocumentFile, DOCUMENT_TYPES, documentAllowed, documentFolder, documentMime, documentPath, documentsFor, dueDay, dueDayTime, EMPTY_FILE,
  explainVerify, fileSizeText, MAX_DOCUMENT_BYTES, photoTarget, TOO_LARGE, unlockedActive, verifyBanner, verifyState, WRONG_TYPE,
} from "../shared/verification";

const ME = "11111111-1111-4111-8111-111111111111";
const TOBI = "22222222-2222-4222-8222-222222222222";
const ADA = "33333333-3333-4333-8333-333333333333";
const FILE = "44444444-4444-4444-8444-444444444444";
// Tuesday 17 November 2026, 2:30 pm in Lagos.
const DUE = "2026-11-17T13:30:00Z";

const member = (over: Record<string, unknown> = {}) => ({
  patient_id: TOBI, first_name: "Tobi", verification_status: "unverified", verification_due_at: DUE, access_ok: true, last_reject_reason: null, ...over,
});

describe("verification status → wording, for every state", () => {
  it("verified", () => {
    expect(verifyState(member({ verification_status: "verified" }))).toEqual(
      { kind: "verified", label: "Verified", tone: "success", locked: false, canUpload: false, action: null });
  });

  it("pending: being checked, and still open on a first document", () => {
    expect(verifyState(member({ verification_status: "pending" }))).toMatchObject({ kind: "pending", label: "Being checked", locked: false, canUpload: false });
  });

  it("pending after a rejection and past the date: being checked, but locked", () => {
    expect(verifyState(member({ verification_status: "pending", access_ok: false })))
      .toMatchObject({ kind: "pending", label: "Being checked (locked until accepted)", locked: true, canUpload: false });
  });

  it("unverified before the date: the day to verify by, in warning style", () => {
    expect(verifyState(member())).toEqual(
      { kind: "due", label: "Verify by Tue 17 Nov", tone: "warning", locked: false, canUpload: true, action: "Verify" });
  });

  it("unverified after the date: locked", () => {
    expect(verifyState(member({ access_ok: false }))).toEqual(
      { kind: "locked", label: "Locked: upload a document", tone: "danger", locked: true, canUpload: true, action: "Upload a document" });
  });

  it("rejected: the reviewer's reason, and Upload another", () => {
    expect(verifyState(member({ verification_status: "rejected", access_ok: false, last_reject_reason: "The document is unclear or cut off" }))).toEqual(
      { kind: "rejected", label: "Not accepted: The document is unclear or cut off", tone: "danger", locked: true, canUpload: true, action: "Upload another" });
    expect(verifyState(member({ verification_status: "rejected", access_ok: false })).label).toBe("Not accepted");
  });

  it("a member from before the update (no fields yet) reads as needing a document, never as verified", () => {
    const state = verifyState({ first_name: "Tobi" });
    expect(state.kind).toBe("due");
    expect(state.label).toBe("Verify now");
  });

  it("the deadline's day and time are given in Lagos time", () => {
    expect(dueDay(DUE)).toBe("Tue 17 Nov");
    expect(dueDayTime(DUE)).toBe("Tue 17 Nov, 2:30 pm");
    expect(dueDayTime("2026-11-17T23:05:00Z")).toBe("Wed 18 Nov, 12:05 am"); // just past midnight in Lagos
    expect(dueDayTime("2026-11-17T11:00:00Z")).toBe("Tue 17 Nov, 12:00 pm");
    expect(dueDay(null)).toBe("");
    expect(dueDayTime("nonsense")).toBe("");
  });

  it("the explanation names the member", () => {
    expect(explainVerify("Tobi")).toBe("To protect Tobi's health records, show us a document that proves how you're related. A HealingNet team member checks it, usually within 2 working days. Send it within 3 days of adding Tobi, or Tobi is locked until you do.");
  });
});

describe("Home banner and the active person", () => {
  it("names the member and the day while they are unverified", () => {
    expect(verifyBanner([member()])).toEqual({ patientId: TOBI, text: "Verify Tobi by Tue 17 Nov to keep managing their care.", locked: false });
  });

  it("says locked, and puts locked members first", () => {
    const banner = verifyBanner([member(), member({ patient_id: ADA, first_name: "Ada", access_ok: false })]);
    expect(banner).toEqual({ patientId: ADA, text: "Ada is locked. Upload a document to unlock.", locked: true });
    expect(verifyBanner([member({ verification_status: "rejected", access_ok: false })])?.text).toBe("Tobi's document was not accepted. Upload another to unlock.");
  });

  it("the nearest date comes first", () => {
    const banner = verifyBanner([member({ verification_due_at: "2026-11-19T10:00:00Z" }), member({ patient_id: ADA, first_name: "Ada", verification_due_at: "2026-11-16T10:00:00Z" })]);
    expect(banner?.patientId).toBe(ADA);
  });

  it("no banner when everyone is verified or being checked", () => {
    expect(verifyBanner([member({ verification_status: "verified" }), member({ patient_id: ADA, verification_status: "pending" })])).toBeNull();
    expect(verifyBanner([])).toBeNull();
  });

  it("a locked member cannot stay the active person", () => {
    const family = [member({ access_ok: false }), member({ patient_id: ADA, first_name: "Ada" })];
    expect(unlockedActive(TOBI, family)).toBeNull();
    expect(unlockedActive(ADA, family)).toBe(ADA);
    expect(unlockedActive(null, family)).toBeNull();
    expect(unlockedActive(TOBI, undefined)).toBe(TOBI); // the list is not known yet: keep the choice
  });
});

describe("allowed documents per relationship (the same table as the database)", () => {
  // private.family_document_allowed, written out.
  const DATABASE: Record<string, string[]> = {
    birth_certificate: ["child", "parent", "sibling", "grandchild", "grandparent"],
    marriage_certificate: ["spouse"],
    adoption_order: ["child", "grandchild"],
    guardianship_order: ["child", "grandchild", "sibling", "other"],
    sworn_affidavit: ["child", "parent", "spouse", "sibling", "grandparent", "grandchild", "other"],
  };
  const RELATIONSHIPS = ["child", "parent", "spouse", "sibling", "grandparent", "grandchild", "other"];

  it("matches the database for every document and relationship", () => {
    expect(DOCUMENT_TYPES.map((d) => d.value).sort()).toEqual(Object.keys(DATABASE).sort());
    for (const [type, allowed] of Object.entries(DATABASE)) {
      for (const r of RELATIONSHIPS) expect(`${type}/${r}:${documentAllowed(r, type)}`).toBe(`${type}/${r}:${allowed.includes(r)}`);
    }
  });

  it("lists only the documents for that relationship, in plain words", () => {
    expect(documentsFor("spouse").map((d) => d.label)).toEqual([
      "Marriage certificate (registry, church, mosque or customary)", "Sworn affidavit of relationship from a court"]);
    expect(documentsFor("child").map((d) => d.value)).toEqual(["birth_certificate", "adoption_order", "guardianship_order", "sworn_affidavit"]);
    expect(documentsFor("parent").map((d) => d.value)).toEqual(["birth_certificate", "sworn_affidavit"]);
    expect(documentsFor("other").map((d) => d.value)).toEqual(["guardianship_order", "sworn_affidavit"]);
    expect(documentsFor("unknown").map((d) => d.value)).toEqual(["sworn_affidavit"]);
    expect(documentAllowed("child", "passport")).toBe(false);
  });
});

describe("photo size and type checks", () => {
  it("accepts PDF, JPEG, PNG, WEBP and HEIC up to 5 MB", () => {
    for (const mimeType of ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"]) {
      expect(checkDocumentFile({ size: MAX_DOCUMENT_BYTES, mimeType })).toBeNull();
    }
    expect(checkDocumentFile({ size: 1200, mimeType: "image/jpg" })).toBeNull();
  });

  it("refuses anything over 5 MB with a clear message", () => {
    expect(checkDocumentFile({ size: MAX_DOCUMENT_BYTES + 1, mimeType: "application/pdf" })).toBe(TOO_LARGE);
    expect(TOO_LARGE).toContain("5 MB");
  });

  it("refuses other types and empty files", () => {
    expect(checkDocumentFile({ size: 10, mimeType: "application/msword", name: "cert.doc" })).toBe(WRONG_TYPE);
    expect(checkDocumentFile({ size: 10, mimeType: "video/mp4" })).toBe(WRONG_TYPE);
    expect(checkDocumentFile({ size: 10, mimeType: "text/html", name: "page.pdf" })).toBe(WRONG_TYPE); // the reported type wins over the name
    expect(checkDocumentFile({ size: 10 })).toBe(WRONG_TYPE);
    expect(checkDocumentFile({ size: 0, mimeType: "application/pdf" })).toBe(EMPTY_FILE);
  });

  it("falls back to the file name when the phone reports no type", () => {
    expect(documentMime(null, "Birth Certificate.PDF")).toBe("application/pdf");
    expect(documentMime("application/octet-stream", "scan.jpeg")).toBe("image/jpeg");
    expect(documentMime("", "notes.txt")).toBeNull();
  });

  it("photos are shrunk to 2000 px on the long side, keeping their shape", () => {
    expect(photoTarget(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(photoTarget(3024, 4032)).toEqual({ width: 1500, height: 2000 });
    expect(photoTarget(2000, 1200)).toBeNull();
    expect(photoTarget(800, 600)).toBeNull();
    expect(photoTarget(0, 0)).toBeNull();
  });

  it("files go in the guardian's own folder for that member, under a random name", () => {
    expect(documentPath(ME, TOBI, FILE.toUpperCase(), "image/jpeg")).toBe(`${ME}/${TOBI}/${FILE}.jpg`);
    expect(documentPath(ME, TOBI, FILE, "application/pdf")).toBe(`${ME}/${TOBI}/${FILE}.pdf`);
    expect(documentFolder(ME, TOBI)).toBe(`${ME}/${TOBI}`);
    expect(() => documentPath(ME, "../other", FILE, "image/jpeg")).toThrow();
    expect(() => documentPath(ME, TOBI, "birth certificate", "image/jpeg")).toThrow();
    expect(() => documentPath(ME, TOBI, FILE, "image/gif")).toThrow();
  });

  it("sizes are shown plainly", () => {
    expect(fileSizeText(300)).toBe("1 KB");
    expect(fileSizeText(350 * 1024)).toBe("350 KB");
    expect(fileSizeText(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});

describe("family notifications open the Family screen", () => {
  it("by type and by the website's path", () => {
    expect(notificationTarget({ type: "family", url: "/patient/settings/family" })).toEqual({ pathname: "/family" });
    expect(notificationTarget({ type: "family" })).toEqual({ pathname: "/family" });
    expect(screenForUrl("/patient/settings/family")).toBe("/family");
    expect(screenForUrl("https://example.com/patient/settings/family?x=1")).toBe("/family");
    expect(screenForUrl("/patient/settings")).toBe("/(tabs)");
  });
});
