import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Pill, FlaskConical, FileText, Calendar, MessageSquare, User, Award, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewPrescriptionDialog } from "@/components/doctor/NewPrescriptionDialog";
import { OrderLabTestDialog } from "@/components/doctor/OrderLabTestDialog";
import { AddEmrNoteDialog } from "@/components/doctor/AddEmrNoteDialog";
import { IssueLetterDialog, LETTER_TYPES } from "@/components/doctor/IssueLetterDialog";
import { useState } from "react";

export default function DoctorPatientDetail() {
  const { id } = useParams();
  const [fulfilLetter, setFulfilLetter] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    enabled: !!id,
    queryKey: ["doctor", "patient-detail", id],
    queryFn: async () => {
      const [patient, appts, rx, labs, emr] = await Promise.all([
        supabase.from("patients").select("*").eq("id", id!).maybeSingle(),
        supabase.from("patient_appointments").select("*").eq("patient_id", id!).order("requested_date", { ascending: false }),
        supabase.from("prescriptions").select("*").eq("patient_id", id!).order("created_at", { ascending: false }),
        supabase.from("lab_results").select("*").eq("patient_id", id!).order("created_at", { ascending: false }),
        supabase.from("emr_entries").select("*").eq("patient_id", id!).order("created_at", { ascending: false }),
      ]);
      return { patient: patient.data, appts: appts.data || [], rx: rx.data || [], labs: labs.data || [], emr: emr.data || [] };
    },
  });

  const { data: pendingLetters = [] } = useQuery({
    enabled: !!id,
    queryKey: ["pending-letters", id],
    queryFn: async () => {
      const { data } = await supabase.from("patient_letters" as any)
        .select("*").eq("patient_id", id!).eq("status", "pending")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  if (isLoading) return <DoctorLayout><div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div></DoctorLayout>;
  if (!data?.patient) return <DoctorLayout><div className="text-muted-foreground">Patient not found.</div></DoctorLayout>;

  const p = data.patient;
  return (
    <DoctorLayout>
      <Link to="/doctor/patients" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4"><ArrowLeft className="w-4 h-4" />My Patients</Link>
      <div className="bg-card border border-border rounded-xl p-5 mb-5 flex items-center gap-4 flex-wrap">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground flex items-center justify-center text-xl font-bold">{p.first_name?.[0]}{p.last_name?.[0]}</div>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-heading font-bold">{p.first_name} {p.last_name}</h1>
          <p className="text-sm text-muted-foreground">{p.gender || "—"} • {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : "DOB unknown"} • {p.phone || "no phone"}</p>
          <p className="text-xs text-muted-foreground mt-1">Genotype: {p.genotype || "—"} • Blood: {p.blood_group || "—"}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <NewPrescriptionDialog patientId={p.id} trigger={<Button variant="outline" size="sm"><Pill className="w-4 h-4" />Rx</Button>} />
          <OrderLabTestDialog patientId={p.id} trigger={<Button variant="outline" size="sm"><FlaskConical className="w-4 h-4" />Lab</Button>} />
          <AddEmrNoteDialog patientId={p.id} trigger={<Button variant="outline" size="sm"><FileText className="w-4 h-4" />Note</Button>} />
          <IssueLetterDialog patientId={p.id} trigger={<Button variant="outline" size="sm"><Award className="w-4 h-4" />Letter</Button>} />
          {p.user_id && <Link to={`/doctor/messages?to=${p.user_id}`}><Button size="sm"><MessageSquare className="w-4 h-4" />Message</Button></Link>}
        </div>
      </div>

      {pendingLetters.length > 0 && (
        <div className="bg-warning/5 border border-warning/30 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Inbox className="w-4 h-4 text-warning" />
            <h3 className="font-heading font-bold text-sm">Pending letter requests ({pendingLetters.length})</h3>
          </div>
          <div className="space-y-2">
            {pendingLetters.map((l) => {
              const def = LETTER_TYPES.find((t) => t.value === l.letter_type);
              return (
                <div key={l.id} className="bg-card border border-border rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{def?.label || l.letter_type}</span>
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">Pending</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</span>
                    </div>
                    {l.body && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{l.body}</p>}
                  </div>
                  <Button size="sm" onClick={() => setFulfilLetter(l)}>Fulfil</Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <IssueLetterDialog
        patientId={p.id}
        existingLetter={fulfilLetter}
        open={!!fulfilLetter}
        onOpenChange={(o) => !o && setFulfilLetter(null)}
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><User className="w-4 h-4 mr-1" />Overview</TabsTrigger>
          <TabsTrigger value="history"><Calendar className="w-4 h-4 mr-1" />History</TabsTrigger>
          <TabsTrigger value="emr"><FileText className="w-4 h-4 mr-1" />EMR</TabsTrigger>
          <TabsTrigger value="rx"><Pill className="w-4 h-4 mr-1" />Prescriptions</TabsTrigger>
          <TabsTrigger value="labs"><FlaskConical className="w-4 h-4 mr-1" />Labs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid md:grid-cols-2 gap-4">
          <InfoCard title="Contact">
            <Row label="Email" value={p.email} /><Row label="Phone" value={p.phone} /><Row label="Address" value={p.address} /><Row label="City" value={p.city} />
          </InfoCard>
          <InfoCard title="Emergency contact">
            <Row label="Name" value={p.emergency_contact_name} /><Row label="Phone" value={p.emergency_contact_phone} />
          </InfoCard>
          <InfoCard title="Insurance">
            <Row label="Provider" value={p.insurance_provider} /><Row label="Policy #" value={p.insurance_policy_number} />
          </InfoCard>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {data.appts.length === 0 ? <Empty msg="No appointments." /> :
            <div className="space-y-2">{data.appts.map((a: any) => (
              <div key={a.id} className="bg-card border border-border rounded-lg p-3 text-sm flex justify-between items-center">
                <div><div className="font-medium">{new Date(a.requested_date).toDateString()} {a.requested_time?.slice(0, 5)}</div><div className="text-xs text-muted-foreground">{a.reason || "—"}</div></div>
                <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-muted">{a.status}</span>
              </div>))}</div>}
        </TabsContent>

        <TabsContent value="emr" className="mt-4">
          {data.emr.length === 0 ? <Empty msg="No EMR entries." /> :
            <div className="space-y-2">{data.emr.map((e: any) => (
              <div key={e.id} className="bg-card border border-border rounded-lg p-3 text-sm">
                <div className="flex justify-between"><span className="font-medium">{e.title}</span><span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</span></div>
                <div className="text-xs text-muted-foreground capitalize">{e.entry_type}</div>
                {e.content && <p className="mt-1">{e.content}</p>}
              </div>))}</div>}
        </TabsContent>

        <TabsContent value="rx" className="mt-4">
          {data.rx.length === 0 ? <Empty msg="No prescriptions." /> :
            <div className="space-y-2">{data.rx.map((r: any) => (
              <div key={r.id} className="bg-card border border-border rounded-lg p-3 text-sm flex justify-between">
                <div><div className="font-medium">{r.drug_name}</div><div className="text-xs text-muted-foreground">{r.dosage} • {r.frequency} • {r.duration}</div></div>
                <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-muted h-fit">{r.status}</span>
              </div>))}</div>}
        </TabsContent>

        <TabsContent value="labs" className="mt-4">
          {data.labs.length === 0 ? <Empty msg="No lab orders." /> :
            <div className="space-y-2">{data.labs.map((l: any) => (
              <div key={l.id} className="bg-card border border-border rounded-lg p-3 text-sm flex justify-between">
                <div><div className="font-medium">Lab #{l.id.slice(0, 8)}</div><div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</div></div>
                <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-muted h-fit">{l.status}</span>
              </div>))}</div>}
        </TabsContent>
      </Tabs>
    </DoctorLayout>
  );
}

function InfoCard({ title, children }: any) { return <div className="bg-card border border-border rounded-xl p-4"><h3 className="font-heading font-bold mb-2 text-sm">{title}</h3><div className="space-y-1">{children}</div></div>; }
function Row({ label, value }: { label: string; value: any }) { return <div className="flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right">{value || "—"}</span></div>; }
function Empty({ msg }: { msg: string }) { return <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">{msg}</div>; }
