import { PatientLayout } from "@/layouts/PatientLayout";
import { usePatientMessages } from "@/hooks/usePatientData";

export default function PatientMessages() {
  const { data: msgs = [], isLoading } = usePatientMessages();
  return (
    <PatientLayout>
      <div className="mb-6"><h1 className="text-2xl font-heading font-bold">Messages</h1><p className="text-muted-foreground">Conversations with your care team</p></div>
      {isLoading ? <p className="text-muted-foreground p-8 text-center">Loading…</p> :
        msgs.length === 0 ? <p className="text-muted-foreground p-8 text-center">No messages yet</p> :
        <div className="space-y-3">{msgs.map((m: any) => (
          <div key={m.id} className="bg-card border border-border rounded-xl p-5">
            <div className="flex justify-between mb-1">
              <h4 className="font-heading font-bold">{m.subject || "(no subject)"}</h4>
              <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</span>
            </div>
            <p className="text-sm">{m.body}</p>
          </div>
        ))}</div>}
    </PatientLayout>
  );
}
