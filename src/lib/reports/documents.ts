import { jsPDF } from "jspdf";

/**
 * Shared clinical document builders used by the hospital, doctor and patient
 * portals so every side renders the exact same report.
 */

export type ReportRow = string[];

export type ReportSection = {
  heading?: string;
  subheading?: string;
  columns: string[];
  rows: ReportRow[];
  /** index of rows that should be highlighted as abnormal */
  abnormalRows?: number[];
};

export type ReportDocument = {
  hospitalName: string;
  documentTitle: string;
  documentId: string;
  dateText: string;
  info: { label: string; value: string }[];
  sections: ReportSection[];
  note?: { title: string; body: string } | null;
  footer?: string;
};

export function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

export function buildReportHtml(doc: ReportDocument, autoPrint = true) {
  const cell = "padding:6px 8px;border:1px solid #e5e7eb;";
  const sections = doc.sections
    .map((s) => {
      const head = s.columns
        .map((c) => `<th style="${cell}text-align:left;">${escapeHtml(c)}</th>`)
        .join("");
      const body = s.rows
        .map((r, i) => {
          const abnormal = s.abnormalRows?.includes(i);
          const style = abnormal ? `${cell}color:#b91c1c;font-weight:600;` : cell;
          return `<tr>${r.map((v) => `<td style="${style}">${escapeHtml(v)}</td>`).join("")}</tr>`;
        })
        .join("");
      return `<section style="margin-top:20px;">
        ${s.heading ? `<h3 style="margin:0 0 4px 0;font-size:14px;">${escapeHtml(s.heading)}${s.subheading ? ` — <span style="font-weight:400;color:#6b7280">${escapeHtml(s.subheading)}</span>` : ""}</h3>` : ""}
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f3f4f6;">${head}</tr></thead>
          <tbody>${body || `<tr><td style="${cell}" colspan="${s.columns.length}">No entries.</td></tr>`}</tbody>
        </table>
      </section>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(doc.documentId)} — ${escapeHtml(doc.documentTitle)}</title>
    <style>
      body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color:#111827; padding:32px; }
      .letterhead { border-bottom:2px solid #0f766e; padding-bottom:12px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:flex-end; }
      .letterhead h1 { margin:0; font-size:20px; }
      .letterhead p { margin:2px 0 0 0; font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:2px; }
      .info { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; font-size:12px; margin-bottom:12px; }
      .info label { color:#6b7280; text-transform:uppercase; letter-spacing:1px; font-size:10px; display:block; }
      .note { margin-top:24px; padding:12px; border:1px solid #e5e7eb; background:#f9fafb; font-size:12px; white-space:pre-wrap; }
      .sign { margin-top:48px; font-size:11px; color:#374151; }
      .sign span { display:inline-block; border-top:1px solid #9ca3af; padding-top:4px; min-width:220px; }
      .foot { margin-top:32px; font-size:11px; color:#6b7280; text-align:center; border-top:1px solid #e5e7eb; padding-top:12px; }
    </style></head><body>
    <div class="letterhead">
      <div><h1>${escapeHtml(doc.hospitalName)}</h1><p>${escapeHtml(doc.documentTitle)}</p></div>
      <div style="text-align:right;font-size:11px;color:#6b7280;">${escapeHtml(doc.documentId)}<br/>${escapeHtml(doc.dateText)}</div>
    </div>
    <div class="info">
      ${doc.info.map((i) => `<div><label>${escapeHtml(i.label)}</label>${escapeHtml(i.value)}</div>`).join("")}
    </div>
    ${sections}
    ${doc.note?.body?.trim() ? `<div class="note"><strong>${escapeHtml(doc.note.title)}</strong><br/>${escapeHtml(doc.note.body.trim())}</div>` : ""}
    <div class="sign"><span>Authorised signature</span></div>
    <div class="foot">${escapeHtml(doc.footer || `Official document issued by ${doc.hospitalName}.`)}</div>
    ${autoPrint ? `<script>window.onload = () => { window.print(); };</script>` : ""}
    </body></html>`;
}

/** Opens a print window with the document. Returns false when popups are blocked. */
export function printReport(doc: ReportDocument): boolean {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return false;
  win.document.write(buildReportHtml(doc));
  win.document.close();
  return true;
}

/** Renders the document into a downloadable A4 PDF. */
export function downloadReportPdf(doc: ReportDocument, fileName?: string) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const pageH = pdf.internal.pageSize.getHeight();
  const width = pdf.internal.pageSize.getWidth() - marginX * 2;
  let y = 56;

  const ensure = (needed = 16) => {
    if (y + needed > pageH - 60) {
      pdf.addPage();
      y = 56;
    }
  };

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(doc.hospitalName, marginX, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(110);
  y += 14;
  pdf.text(doc.documentTitle.toUpperCase(), marginX, y);
  pdf.text(`${doc.documentId}   ${doc.dateText}`, marginX + width, y, { align: "right" });
  y += 10;
  pdf.setDrawColor(15, 118, 110);
  pdf.setLineWidth(1.2);
  pdf.line(marginX, y, marginX + width, y);
  y += 20;

  pdf.setTextColor(20);
  pdf.setFontSize(10);
  doc.info.forEach((i, idx) => {
    const col = idx % 2;
    const x = marginX + col * (width / 2);
    if (col === 0) ensure(26);
    pdf.setTextColor(120);
    pdf.setFontSize(8);
    pdf.text(i.label.toUpperCase(), x, y);
    pdf.setTextColor(20);
    pdf.setFontSize(10);
    pdf.text(i.value || "—", x, y + 12);
    if (col === 1 || idx === doc.info.length - 1) y += 28;
  });

  doc.sections.forEach((s) => {
    ensure(50);
    y += 10;
    if (s.heading) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(s.heading + (s.subheading ? ` — ${s.subheading}` : ""), marginX, y);
      y += 14;
    }
    const colW = width / s.columns.length;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(90);
    s.columns.forEach((c, i) => pdf.text(c, marginX + i * colW, y));
    y += 4;
    pdf.setDrawColor(220);
    pdf.setLineWidth(0.5);
    pdf.line(marginX, y, marginX + width, y);
    y += 12;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(20);
    s.rows.forEach((r, ri) => {
      ensure(18);
      const abnormal = s.abnormalRows?.includes(ri);
      if (abnormal) pdf.setTextColor(185, 28, 28);
      r.forEach((v, i) => {
        const text = pdf.splitTextToSize(String(v ?? "—"), colW - 6)[0] || "—";
        pdf.text(text, marginX + i * colW, y);
      });
      if (abnormal) pdf.setTextColor(20);
      y += 15;
    });
  });

  if (doc.note?.body?.trim()) {
    ensure(60);
    y += 16;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(doc.note.title, marginX, y);
    y += 14;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.splitTextToSize(doc.note.body.trim(), width).forEach((line: string) => {
      ensure(14);
      pdf.text(line, marginX, y);
      y += 12;
    });
  }

  ensure(70);
  y += 40;
  pdf.setDrawColor(150);
  pdf.line(marginX, y, marginX + 200, y);
  pdf.setFontSize(9);
  pdf.setTextColor(90);
  pdf.text("Authorised signature", marginX, y + 12);

  pdf.save(fileName || `${doc.documentId.replace(/[^\w-]/g, "_")}.pdf`);
}

// ---------------- Domain builders ----------------

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : new Date().toLocaleDateString());

export type LabReportInput = {
  hospitalName?: string | null;
  patientName: string;
  doctorName?: string | null;
  orderId: string;
  createdAt?: string | null;
  notes?: string | null;
  tests: {
    test_name: string;
    category_name?: string | null;
    parameters: {
      parameter_name: string;
      result_value?: string | null;
      unit_snapshot?: string | null;
      ref_range_snapshot?: string | null;
      flag?: string | null;
    }[];
  }[];
};

const ABNORMAL_FLAGS = ["low", "high", "abnormal", "critical", "positive", "reactive"];

export function buildLabReportDocument(input: LabReportInput): ReportDocument {
  const labId = `LAB-${input.orderId.slice(0, 8).toUpperCase()}`;
  return {
    hospitalName: input.hospitalName || "HealingNet Hospital",
    documentTitle: "Laboratory Report",
    documentId: labId,
    dateText: fmtDate(input.createdAt),
    info: [
      { label: "Patient", value: input.patientName },
      { label: "Ordering Doctor", value: input.doctorName || "—" },
      { label: "Lab ID", value: labId },
      { label: "Report Date", value: fmtDate(input.createdAt) },
    ],
    sections: input.tests.map((t) => {
      const rows = t.parameters.map((p) => [
        p.parameter_name,
        p.result_value || "—",
        p.unit_snapshot || "",
        p.ref_range_snapshot || "",
        (p.flag || "pending").replace(/^\w/, (c) => c.toUpperCase()),
      ]);
      const abnormalRows = t.parameters
        .map((p, i) => (ABNORMAL_FLAGS.includes(String(p.flag || "").toLowerCase()) ? i : -1))
        .filter((i) => i >= 0);
      return {
        heading: t.test_name,
        subheading: t.category_name || undefined,
        columns: ["Parameter", "Result", "Unit", "Reference range", "Flag"],
        rows,
        abnormalRows,
      };
    }),
    note: input.notes ? { title: "Clinical interpretation", body: input.notes } : null,
    footer: `Official laboratory report issued by ${input.hospitalName || "HealingNet Hospital"}.`,
  };
}

export type PrescriptionReportInput = {
  hospitalName?: string | null;
  patientName: string;
  doctorName?: string | null;
  issuedAt?: string | null;
  referenceId: string;
  items: {
    drug_name: string;
    dosage?: string | null;
    frequency?: string | null;
    duration?: string | null;
    instructions?: string | null;
    refills_allowed?: number | null;
    status?: string | null;
  }[];
  notes?: string | null;
};

export function buildPrescriptionDocument(input: PrescriptionReportInput): ReportDocument {
  const rxId = `RX-${input.referenceId.slice(0, 8).toUpperCase()}`;
  return {
    hospitalName: input.hospitalName || "HealingNet Hospital",
    documentTitle: "Prescription",
    documentId: rxId,
    dateText: fmtDate(input.issuedAt),
    info: [
      { label: "Patient", value: input.patientName },
      { label: "Prescriber", value: input.doctorName ? `Dr. ${input.doctorName}` : "—" },
      { label: "Prescription ID", value: rxId },
      { label: "Date Issued", value: fmtDate(input.issuedAt) },
    ],
    sections: [
      {
        heading: "Medication",
        columns: ["Drug", "Dosage", "Frequency", "Duration", "Refills"],
        rows: input.items.map((i) => [
          i.drug_name,
          i.dosage || "—",
          i.frequency || "—",
          i.duration || "—",
          i.refills_allowed != null ? String(i.refills_allowed) : "0",
        ]),
      },
    ],
    note:
      input.notes || input.items.some((i) => i.instructions)
        ? {
            title: "Instructions",
            body:
              input.notes ||
              input.items
                .filter((i) => i.instructions)
                .map((i) => `${i.drug_name}: ${i.instructions}`)
                .join("\n"),
          }
        : null,
    footer: `Dispense as written. Issued by ${input.hospitalName || "HealingNet Hospital"}.`,
  };
}
