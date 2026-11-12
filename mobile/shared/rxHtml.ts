// The prescription as a printable page, with the same content as the website's print page
// (src/pages/RxPrint.tsx). The app turns this HTML into a PDF to share.
import { fmtLongDate } from "./dates";
import { verifyUrl } from "./links";
import { ageGender, NOT_VALID_TEXT, prescriberName, rxStatusLabel, type RxPayload } from "./pharmacy";

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** A QR code as inline SVG, always dark on white with a quiet zone. `rows` is the module matrix. */
export function qrSvg(rows: boolean[][], size = 120): string {
  const n = rows.length;
  const margin = 4;
  const total = n + margin * 2;
  let path = "";
  rows.forEach((row, y) => row.forEach((on, x) => { if (on) path += `M${x + margin} ${y + margin}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

// Only image data URLs are allowed as a signature source.
const safeSignature = (s: string | null | undefined) => (s && /^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : null);

export function rxHtml(doc: RxPayload, webUrl: string, qrRows: boolean[][] | null): string {
  const p = doc.prescriber ?? {};
  const items = doc.items ?? [];
  const ag = ageGender(doc.patient?.date_of_birth, doc.patient?.gender);
  const signature = safeSignature(doc.signature_data);
  const origin = webUrl.replace(/\/+$/, "");

  const rows = items.map((it) => `
    <tr>
      <td><strong>${esc(it.drug_name)}</strong>${it.instructions ? `<span class="note">${esc(it.instructions)}</span>` : ""}${!it.doctor_issued ? `<span class="warn">${esc(NOT_VALID_TEXT)}</span>` : ""}</td>
      <td>${esc(it.dosage || "—")}</td>
      <td>${esc(it.frequency || "—")}</td>
      <td>${esc(it.duration || "—")}</td>
      <td>${esc(it.refills_allowed ?? 0)}</td>
    </tr>`).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prescription ${esc(doc.code)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #171717; background: #fff; margin: 0; }
  h1 { font-size: 20px; margin: 0; }
  p { margin: 0; }
  .head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #171717; padding-bottom: 14px; }
  .right { text-align: right; }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #737373; }
  .code { font-family: "Courier New", monospace; font-size: 18px; font-weight: 700; letter-spacing: .08em; }
  .row { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #d4d4d4; padding: 14px 0; }
  table { width: 100%; border-collapse: collapse; text-align: left; margin-top: 6px; }
  th { font-size: 11px; text-transform: uppercase; color: #737373; font-weight: 500; border-bottom: 1px solid #a3a3a3; padding: 6px 8px 6px 0; }
  td { vertical-align: top; border-bottom: 1px solid #e5e5e5; padding: 8px 8px 8px 0; }
  .note { display: block; font-size: 11px; font-style: italic; color: #525252; }
  .warn { display: block; font-size: 11px; font-weight: 600; color: #b45309; }
  .sign { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; border-top: 1px solid #d4d4d4; padding-top: 14px; margin-top: 14px; }
  .sign img { height: 64px; max-width: 240px; display: block; margin-bottom: 4px; }
  .line { height: 64px; width: 240px; border-bottom: 1px solid #a3a3a3; margin-bottom: 4px; }
  footer { margin-top: 18px; border-top: 1px solid #d4d4d4; padding-top: 10px; font-size: 11px; color: #525252; }
</style></head>
<body>
  <div class="head">
    <div>
      <h1>${esc(p.hospital_name || doc.hospital_name || "Hospital")}</h1>
      ${p.hospital_address ? `<p>${esc(p.hospital_address)}</p>` : ""}
      ${p.hospital_phone ? `<p>${esc(p.hospital_phone)}</p>` : ""}
    </div>
    <div class="right">
      <p class="label">Prescription</p>
      <p class="code">${esc(doc.code)}</p>
      <p>${esc(rxStatusLabel(doc))}</p>
    </div>
  </div>
  <div class="row">
    <div><p class="label">Patient</p><p><strong>${esc(doc.patient?.name || "—")}</strong></p>${ag ? `<p>${esc(ag)}</p>` : ""}</div>
    <div class="right"><p class="label">Date</p><p><strong>${esc(fmtLongDate(doc.issued_at))}</strong></p></div>
  </div>
  <p class="label" style="margin-top:14px">Rx</p>
  <table>
    <thead><tr><th>Medicine</th><th>Dose</th><th>How often</th><th>For</th><th>Refills</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sign">
    <div>
      ${signature ? `<img src="${signature}" alt="Signature of ${esc(prescriberName(p))}">` : `<div class="line"></div>`}
      <p><strong>${esc(prescriberName(p))}</strong></p>
      <p>Licence ${esc(p.licence_number || "—")}${p.licence_council ? ` · ${esc(p.licence_council)}` : ""}</p>
      ${p.practice_address ? `<p>${esc(p.practice_address)}</p>` : ""}
      ${p.phone ? `<p>${esc(p.phone)}</p>` : ""}
    </div>
    <div>${doc.code && qrRows ? qrSvg(qrRows) : ""}</div>
  </div>
  <footer>
    ${doc.status === "not_valid" ? `<p>${esc(NOT_VALID_TEXT)}.</p>` : `<p>Valid until ${esc(fmtLongDate(doc.expires_at))}. Verify at ${esc(origin)}/verify</p>`}
    <p style="margin-top:4px">Patients pay for medicine at the pharmacy counter. HealingNet never takes payment for medicine.</p>
    ${doc.code ? `<p style="margin-top:4px">${esc(verifyUrl(origin, doc.code))}</p>` : ""}
  </footer>
</body></html>`;
}
