import { PatientLayout } from "@/layouts/PatientLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePatientProfile } from "@/hooks/usePatientData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Plane, Baby, BedDouble, FileSignature, Syringe, Inbox, Plus, FlaskConical } from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { RequestLetterDialog } from "@/components/patient/RequestLetterDialog";

const TYPE_META: Record<string, { label: string; Icon: any }> = {
  fit_to_work: { label: "Fit-to-Work / Fit-to-Travel Letter", Icon: Plane },
  pregnancy_maternity: { label: "Pregnancy & Maternity Letter", Icon: Baby },
  sick_leave: { label: "Sick Leave Letter", Icon: BedDouble },
  excuse_of_duty: { label: "Excuse of Duty Letter", Icon: FileSignature },
  vaccination_record: { label: "Vaccination Record", Icon: Syringe },
  lab_report: { label: "Laboratory Report", Icon: FlaskConical },
};

const STATUS_VARIANT: Record<string, string> = {
  issued: "bg-success/10 text-success border-success/30",
  pending: "bg-warning/10 text-warning border-warning/30",
  expired: "bg-muted text-muted-foreground border-border",
};

export default function PatientLetters() {
  const { data: profile } = usePatientProfile();

  const { data: letters = [], isLoading } = useQuery({
    enabled: !!profile?.id,
    queryKey: ["patient-letters", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_letters" as any)
        .select("*, doctors(first_name, last_name, specialty), hospitals(name, address)")
        .eq("patient_id", profile!.id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  function download(l: any) {
    if (l.pdf_url) { window.open(l.pdf_url, "_blank"); return; }
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const meta = TYPE_META[l.letter_type] || { label: l.title };
      const docName = l.doctors ? `Dr. ${l.doctors.first_name} ${l.doctors.last_name}` : "Issuing Physician";
      const hospital = l.hospitals?.name || "HealingNet";
      let y = 60;
      doc.setFontSize(18); doc.setFont("helvetica", "bold");
      doc.text(hospital, 40, y); y += 22;
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      if (l.hospitals?.address) { doc.text(l.hospitals.address, 40, y); y += 16; }
      doc.setDrawColor(200); doc.line(40, y, 555, y); y += 26;
      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text(l.title || meta.label, 40, y); y += 22;
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(`Issued: ${new Date(l.issued_at).toLocaleDateString()}`, 40, y);
      if (l.valid_until) doc.text(`Valid until: ${new Date(l.valid_until).toLocaleDateString()}`, 300, y);
      y += 24;
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(l.body || "", 515);
      doc.text(lines, 40, y); y += lines.length * 14 + 40;
      doc.text("Sincerely,", 40, y); y += 36;
      doc.setFont("helvetica", "bold"); doc.text(docName, 40, y); y += 14;
      doc.setFont("helvetica", "normal");
      if (l.doctors?.specialty) doc.text(l.doctors.specialty, 40, y);
      doc.save(`${l.letter_type}-${l.id.slice(0, 8)}.pdf`);
    } catch (e: any) {
      toast.error(e.message || "Could not generate PDF");
    }
  }

  return (
    <PatientLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-primary" />My Letters & Reports</h1>
            <p className="text-sm text-muted-foreground">Official medical documents issued to you by your doctor.</p>
          </div>
          {profile?.id && (
            <RequestLetterDialog patientId={profile.id} trigger={
              <Button size="sm"><Plus className="w-4 h-4" />Request a letter</Button>
            } />
          )}
        </div>

        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

        {!isLoading && letters.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No letters or reports yet. When your doctor issues one, it will appear here.</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {letters.map((l) => {
            const meta = TYPE_META[l.letter_type] || { label: l.title, Icon: FileText };
            const Icon = meta.Icon;
            const isExpired = l.valid_until && new Date(l.valid_until) < new Date();
            const status = isExpired ? "expired" : l.status;
            return (
              <Card key={l.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-5 h-5" /></div>
                    <Badge variant="outline" className={STATUS_VARIANT[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
                  </div>
                  <CardTitle className="text-base mt-3">{meta.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="text-muted-foreground">
                    Issued {new Date(l.issued_at).toLocaleDateString()}
                    {l.valid_until && ` • Valid until ${new Date(l.valid_until).toLocaleDateString()}`}
                  </div>
                  <div>By <span className="font-medium">{l.doctors ? `Dr. ${l.doctors.first_name} ${l.doctors.last_name}` : "—"}</span></div>
                  <Button size="sm" className="w-full mt-3" onClick={() => download(l)} disabled={status === "pending"}>
                    <Download className="w-4 h-4" />Download PDF
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </PatientLayout>
  );
}
