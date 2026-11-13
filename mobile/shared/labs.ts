// Lab results (src/pages/patient/LabResults.tsx): the row shapes, the words for a value
// that is outside its reference range, and the printable report.
import { fmtLongDate } from "./dates";

export interface LabParameter {
  id: string;
  parameter_name: string;
  result_value: string | null;
  unit_snapshot: string | null;
  ref_range_snapshot: string | null;
  /** 'normal' | 'low' | 'high' | 'abnormal' | 'unknown' (set by the lab). */
  flag: string | null;
  sort_order: number | null;
}
export interface LabTest {
  id: string;
  test_name: string;
  category_name: string | null;
  lab_result_parameters: LabParameter[] | null;
}
export interface LabResult {
  id: string;
  created_at: string;
  status: string | null;
  notes: string | null;
  hospitals: { name: string } | null;
  lab_result_tests: LabTest[] | null;
}

export type RangeWord = "High" | "Low" | "Outside the normal range" | "Normal";

const num = (s: string | null | undefined): number | null => {
  const t = (s ?? "").trim().replace(/,/g, "");
  return /^[-+]?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};

/** "3.5 - 5.0", "3.5–5.0", "3.5 to 5", "< 5", "≤ 200", "> 40", "up to 40" -> the limits. */
export function parseRange(range: string | null | undefined): { min: number | null; max: number | null } | null {
  const r = (range ?? "").trim().replace(/,/g, "");
  if (!r) return null;
  const n = "([-+]?\\d+(?:\\.\\d+)?)";
  let m = new RegExp(`^${n}\\s*(?:-|–|—|to)\\s*${n}(?:\\s|$)`, "i").exec(r);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  m = new RegExp(`^(?:<|≤|<=|up to|below|less than)\\s*${n}`, "i").exec(r);
  if (m) return { min: null, max: Number(m[1]) };
  m = new RegExp(`^(?:>|≥|>=|above|over|more than)\\s*${n}`, "i").exec(r);
  if (m) return { min: Number(m[1]), max: null };
  return null;
}

/**
 * Whether a value is inside its reference range, in words. The lab's own flag wins; when
 * the lab left none, a plain number is compared with a plain range. Returns null when
 * there is nothing to judge by, so the screen shows no label rather than a guess.
 */
export function rangeWord(p: Pick<LabParameter, "flag" | "result_value" | "ref_range_snapshot">): RangeWord | null {
  const flag = (p.flag ?? "").trim().toLowerCase();
  if (flag === "high") return "High";
  if (flag === "low") return "Low";
  if (flag === "abnormal") return "Outside the normal range";
  if (flag === "normal") return "Normal";
  const value = num(p.result_value);
  const range = parseRange(p.ref_range_snapshot);
  if (value === null || !range) return null;
  if (range.min !== null && value < range.min) return "Low";
  if (range.max !== null && value > range.max) return "High";
  return "Normal";
}

/** The word with an arrow in front, so the reading is clear without colour. */
export const rangeLabel = (w: RangeWord): string => (w === "High" ? "▲ High" : w === "Low" ? "▼ Low" : w);

export const isOutOfRange = (w: RangeWord | null) => w !== null && w !== "Normal";

export const sortedParameters = (t: LabTest): LabParameter[] =>
  [...(t.lab_result_parameters ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

export const labTests = (r: LabResult): LabTest[] => r.lab_result_tests ?? [];
export const labTitle = (r: LabResult): string => labTests(r).map((t) => t.test_name).filter(Boolean).join(", ") || `Lab order #${r.id.slice(0, 8)}`;
export const labIsReady = (r: LabResult) => r.status === "completed" || r.status === "final";

/** "Ready", "Ready · 2 outside the normal range" or the stage it is at. */
export function labStatusText(r: LabResult): string {
  if (!labIsReady(r)) {
    return { pending: "Waiting for the lab", ordered: "Ordered", processing: "In the lab", in_progress: "In the lab" }[r.status ?? "pending"] ?? "In the lab";
  }
  const out = labTests(r).flatMap(sortedParameters).filter((p) => isOutOfRange(rangeWord(p))).length;
  return out === 0 ? "Ready" : `Ready · ${out} outside the normal range`;
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** The report as a printable page (same content as the website's lab report download). */
export function labHtml(r: LabResult, patientName: string): string {
  const tests = labTests(r).map((t) => {
    const rows = sortedParameters(t).map((p) => {
      const word = rangeWord(p);
      return `<tr><td>${esc(p.parameter_name)}</td><td><strong>${esc(p.result_value ?? "—")}</strong> ${esc(p.unit_snapshot ?? "")}</td><td>${esc(p.ref_range_snapshot || "—")}</td><td${isOutOfRange(word) ? ' class="out"' : ""}>${esc(word ?? "—")}</td></tr>`;
    }).join("");
    return `<h2>${esc(t.test_name)}${t.category_name ? ` <span class="label">${esc(t.category_name)}</span>` : ""}</h2>
    <table><thead><tr><th>Test</th><th>Result</th><th>Reference range</th><th>Reading</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No results entered yet.</td></tr>'}</tbody></table>`;
  }).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lab report</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #171717; background: #fff; margin: 0; }
  h1 { font-size: 20px; margin: 0; } h2 { font-size: 15px; margin: 18px 0 4px; } p { margin: 0; }
  .head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #171717; padding-bottom: 14px; }
  .right { text-align: right; }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #737373; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; text-align: left; }
  th { font-size: 11px; text-transform: uppercase; color: #737373; font-weight: 500; border-bottom: 1px solid #a3a3a3; padding: 6px 8px 6px 0; }
  td { vertical-align: top; border-bottom: 1px solid #e5e5e5; padding: 8px 8px 8px 0; }
  .out { font-weight: 700; text-decoration: underline; }
  footer { margin-top: 18px; border-top: 1px solid #d4d4d4; padding-top: 10px; font-size: 11px; color: #525252; }
</style></head>
<body>
  <div class="head">
    <div><h1>${esc(r.hospitals?.name || "Hospital")}</h1><p class="label">Laboratory report</p></div>
    <div class="right"><p class="label">Date</p><p><strong>${esc(fmtLongDate(r.created_at))}</strong></p><p>Order #${esc(r.id.slice(0, 8))}</p></div>
  </div>
  <p style="margin-top:12px"><span class="label">Patient</span> <strong>${esc(patientName || "—")}</strong></p>
  ${tests || "<p>No test entries yet.</p>"}
  ${r.notes ? `<h2>Notes</h2><p>${esc(r.notes)}</p>` : ""}
  <footer>Shared from the HealingNet app. Readings marked High, Low or Outside the normal range should be discussed with your doctor.</footer>
</body></html>`;
}
