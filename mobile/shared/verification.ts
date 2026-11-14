// Family verification: the guardian shows a legal document that proves how they are related
// to each family member, and a HealingNet team member checks it. Everything here can be
// worked out without the phone or the network: which documents fit which relationship (the
// same table as the database), the wording for every state, and the file checks.
// The website's copy is src/lib/verification.ts.

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

/** The verification part of a my_family() row. */
export interface Verifiable {
  first_name: string;
  verification_status?: string | null;
  verification_due_at?: string | null;
  /** False when the member is locked: nothing of theirs can be read or booked until a document is accepted. */
  access_ok?: boolean | null;
  last_reject_reason?: string | null;
}

// ---- Documents ----------------------------------------------------------------------------
export type DocumentType = "birth_certificate" | "marriage_certificate" | "adoption_order" | "guardianship_order" | "sworn_affidavit";

/** Which documents prove which relationship. Same table as private.family_document_allowed. */
export const DOCUMENT_TYPES: { value: DocumentType; label: string; short: string; relationships: readonly string[] | "any" }[] = [
  { value: "birth_certificate", label: "Birth certificate (National Population Commission or hospital)", short: "Birth certificate",
    relationships: ["child", "parent", "sibling", "grandchild", "grandparent"] },
  { value: "marriage_certificate", label: "Marriage certificate (registry, church, mosque or customary)", short: "Marriage certificate",
    relationships: ["spouse"] },
  { value: "adoption_order", label: "Adoption order", short: "Adoption order", relationships: ["child", "grandchild"] },
  { value: "guardianship_order", label: "Court guardianship order", short: "Court guardianship order",
    relationships: ["child", "grandchild", "sibling", "other"] },
  { value: "sworn_affidavit", label: "Sworn affidavit of relationship from a court", short: "Sworn affidavit", relationships: "any" },
];

export const documentAllowed = (relationship: string | null | undefined, type: string): boolean => {
  const doc = DOCUMENT_TYPES.find((d) => d.value === type);
  return !!doc && (doc.relationships === "any" || doc.relationships.includes(String(relationship ?? "")));
};

/** Only the documents allowed for this relationship, in plain words. */
export const documentsFor = (relationship: string | null | undefined) =>
  DOCUMENT_TYPES.filter((d) => documentAllowed(relationship, d.value)).map(({ value, label }) => ({ value, label }));

export const documentLabel = (type: string | null | undefined) => DOCUMENT_TYPES.find((d) => d.value === type)?.short ?? "Document";

// ---- Files --------------------------------------------------------------------------------
export const DOCUMENT_BUCKET = "family-documents";
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTO_SIDE = 2000;
export const PHOTO_QUALITY = 0.8;
export const DOCUMENT_MIME: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic",
};
/** For a file chooser: images and PDF. */
export const DOCUMENT_ACCEPT = Object.keys(DOCUMENT_MIME);

export const TOO_LARGE = "That file is over 5 MB. Choose a smaller file, or take a photo of the document instead.";
export const WRONG_TYPE = "Choose a photo (JPEG, PNG, WEBP or HEIC) or a PDF.";
export const EMPTY_FILE = "That file is empty. Choose another.";

const BY_EXTENSION: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic" };

/** The file's type from what the phone or browser reported, or from its name when it reported nothing. */
export function documentMime(mimeType: string | null | undefined, name?: string | null): string | null {
  const reported = String(mimeType ?? "").toLowerCase().split(";")[0].trim();
  if (reported === "image/jpg") return "image/jpeg";
  if (reported in DOCUMENT_MIME) return reported;
  if (reported && reported !== "application/octet-stream") return null;
  const ext = /\.([a-z0-9]+)$/i.exec(String(name ?? ""))?.[1]?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? null;
}

/** Null when the file can be sent; otherwise the message to show. */
export function checkDocumentFile(file: { size?: number | null; mimeType?: string | null; name?: string | null }): string | null {
  if (!documentMime(file.mimeType, file.name)) return WRONG_TYPE;
  if (file.size === 0) return EMPTY_FILE;
  if (typeof file.size === "number" && file.size > MAX_DOCUMENT_BYTES) return TOO_LARGE;
  return null;
}

/** The size to shrink a photo to (longest side at most 2000 px), or null when it is small enough. */
export function photoTarget(width: number, height: number, maxSide = MAX_PHOTO_SIDE): { width: number; height: number } | null {
  const longest = Math.max(width, height);
  if (!(longest > maxSide) || !(width > 0) || !(height > 0)) return null;
  const scale = maxSide / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** family-documents/<user id>/<member patient id>/<random uuid>.<ext> */
export function documentPath(userId: string, memberId: string, random: string, mime: string): string {
  const ext = DOCUMENT_MIME[mime];
  if (!UUID.test(userId) || !UUID.test(memberId) || !UUID.test(random) || !ext) throw new Error("Upload the document again");
  return `${userId}/${memberId}/${random.toLowerCase()}.${ext}`;
}

/** The member's folder, for removing their files when they are removed from the family. */
export const documentFolder = (userId: string, memberId: string) => `${userId}/${memberId}`;

export function fileSizeText(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !(bytes >= 0)) return "";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- Wording ------------------------------------------------------------------------------
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function lagos(iso: string | null | undefined): Date | null {
  const ms = Date.parse(String(iso ?? ""));
  return Number.isNaN(ms) ? null : new Date(ms + 3600_000);
}

/** "Tue 17 Nov" (Lagos time). */
export function dueDay(iso: string | null | undefined): string {
  const d = lagos(iso);
  return d ? `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` : "";
}

/** "Tue 17 Nov, 2:30 pm" (Lagos time): the exact moment the member is locked. */
export function dueDayTime(iso: string | null | undefined): string {
  const d = lagos(iso);
  if (!d) return "";
  const h = d.getUTCHours();
  return `${dueDay(iso)}, ${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export type VerifyKind = "verified" | "pending" | "due" | "locked" | "rejected";
export type VerifyTone = "success" | "neutral" | "warning" | "danger";

export interface VerifyState {
  kind: VerifyKind;
  /** Always shown as words next to an icon, never colour alone. */
  label: string;
  tone: VerifyTone;
  /** Nothing of this member's can be opened until a document is accepted. */
  locked: boolean;
  /** A document can be sent now (or another one). */
  canUpload: boolean;
  /** The button that opens the Verify screen; null when there is nothing to do. */
  action: string | null;
}

/** The one state a member is in, with its wording. */
export function verifyState(m: Verifiable): VerifyState {
  const status = m.verification_status ?? "unverified";
  const locked = m.access_ok === false;
  if (status === "verified") return { kind: "verified", label: "Verified", tone: "success", locked: false, canUpload: false, action: null };
  if (status === "rejected") {
    const reason = (m.last_reject_reason ?? "").trim();
    return { kind: "rejected", label: reason ? `Not accepted: ${reason}` : "Not accepted", tone: "danger", locked: true, canUpload: true, action: "Upload another" };
  }
  if (status === "pending") {
    // A first document keeps the member open while it is checked; after a rejection they stay locked until it is accepted.
    return { kind: "pending", label: locked ? "Being checked (locked until accepted)" : "Being checked", tone: "neutral", locked, canUpload: false, action: "See status" };
  }
  if (locked) return { kind: "locked", label: "Locked: upload a document", tone: "danger", locked: true, canUpload: true, action: "Upload a document" };
  const day = dueDay(m.verification_due_at);
  return { kind: "due", label: day ? `Verify by ${day}` : "Verify now", tone: "warning", locked: false, canUpload: true, action: "Verify" };
}

export const explainVerify = (firstName: string) =>
  `To protect ${firstName}'s health records, show us a document that proves how you're related. A HealingNet team member checks it, usually within 2 working days. Send it within 3 days of adding ${firstName}, or ${firstName} is locked until you do.`;

export const DOCUMENT_PRIVACY = "Only you and HealingNet's verification team can see this document.";

export const lockedToast = (firstName: string) => `${firstName} is locked until a document is accepted. Showing your own records.`;

export interface VerifyBanner { patientId: string; text: string; locked: boolean }

/**
 * Home's banner: shown while any member still needs a document (not yet sent, locked, or
 * not accepted). The most urgent member is named: locked ones first, then the nearest date.
 */
export function verifyBanner(family: readonly (Verifiable & { patient_id: string })[]): VerifyBanner | null {
  const needing = family.map((m) => ({ m, s: verifyState(m) })).filter(({ s }) => s.canUpload);
  if (needing.length === 0) return null;
  const due = (m: Verifiable) => Date.parse(m.verification_due_at ?? "") || Number.MAX_SAFE_INTEGER;
  needing.sort((a, b) => Number(b.s.locked) - Number(a.s.locked) || due(a.m) - due(b.m));
  const { m, s } = needing[0];
  const name = m.first_name;
  const text = s.kind === "rejected" ? `${name}'s document was not accepted. Upload another to unlock.`
    : s.locked ? `${name} is locked. Upload a document to unlock.`
    : `Verify ${name} by ${dueDay(m.verification_due_at) || "the deadline"} to keep managing their care.`;
  return { patientId: m.patient_id, text, locked: s.locked };
}

/** Who to show: a locked member cannot be the active person, so the app falls back to Me (null). */
export function unlockedActive(activeId: string | null, family: readonly (Verifiable & { patient_id: string })[] | undefined): string | null {
  if (!activeId || !family) return activeId;
  const m = family.find((x) => x.patient_id === activeId);
  return m && m.access_ok === false ? null : activeId;
}
