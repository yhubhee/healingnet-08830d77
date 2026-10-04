import { supabase } from "@/integrations/supabase/client";
import { printReport, type ReportDocument } from "@/lib/reports/documents";
import { ageFromDob } from "@/hooks/useConsultation";

const sb = supabase as any;

/** Builds and prints the investigation request slip for a consultation. */
export async function printRequestSlip(consultation: any, tests: any[], requests: any[]): Promise<boolean> {
  const p = consultation.patients || {};
  const [{ data: h }, { data: d }] = await Promise.all([
    sb.from("hospitals").select("name").eq("id", consultation.hospital_id).maybeSingle(),
    sb.from("doctor_profiles").select("first_name,last_name").eq("id", consultation.doctor_id).maybeSingle().then((r: any) => r.error ? sb.from("doctors").select("first_name,last_name").eq("id", consultation.doctor_id).maybeSingle() : r),
  ]);
  const firstOrder = tests[0]?.order || requests[0] || {};
  const age = ageFromDob(p.date_of_birth);
  const activeReq = requests.filter((r) => !r.cancelled_at);
  const doc: ReportDocument = {
    hospitalName: h?.name || "Hospital",
    documentTitle: "Investigation Request",
    documentId: `REQ-${String(consultation.id).slice(0, 8).toUpperCase()}`,
    dateText: new Date().toLocaleString(),
    info: [
      { label: "Patient", value: `${p.first_name || ""} ${p.last_name || ""}` },
      { label: "Patient ID", value: `#${String(p.id || "").slice(0, 8).toUpperCase()}` },
      { label: "Age / Sex", value: [age != null ? `${age}y` : null, p.gender].filter(Boolean).join(" / ") || "—" },
      { label: "HMO", value: p.insurance_provider || "—" },
      { label: "Requesting doctor", value: d ? `Dr ${d.first_name} ${d.last_name}` : "—" },
      { label: "Priority", value: firstOrder.priority || "routine" },
      { label: "Fasting", value: firstOrder.fasting ? "Yes" : "No" },
      { label: "Bill to", value: firstOrder.bill_to || "patient" },
    ],
    sections: [
      { heading: "Laboratory", columns: ["Test", "Category", "Sample"], rows: tests.map((t) => [t.test_name, t.category_name || "—", t.sample_type || "—"]) },
      { heading: "Radiology", columns: ["Study", "Views", "Laterality"], rows: activeReq.filter((r) => r.kind === "imaging").map((r) => [r.item_name, [...(r.views || []), r.other_view].filter(Boolean).join(", ") || "—", r.laterality || "—"]) },
      { heading: "Other", columns: ["Request", "Destination"], rows: activeReq.filter((r) => r.kind !== "imaging").map((r) => [r.item_name, r.destination === "external" ? r.external_facility || "External" : "In-house"]) },
    ].filter((s) => s.rows.length),
    note: { title: "Clinical information", body: firstOrder.clinical_info || consultation.provisional_diagnosis || "—" },
    footer: "Signature: ______________________",
  };
  return printReport(doc);
}
