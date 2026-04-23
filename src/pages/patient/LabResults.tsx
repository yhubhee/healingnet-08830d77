import { PatientLayout } from "@/layouts/PatientLayout";
import { usePatientLabResults } from "@/hooks/usePatientData";

export default function PatientLabResults() {
  const { data: labs = [], isLoading } = usePatientLabResults();
  return (
    <PatientLayout>
      <div className="mb-6"><h1 className="text-2xl font-heading font-bold">Lab Results</h1><p className="text-muted-foreground">Your test results</p></div>
      {isLoading ? <p className="text-muted-foreground p-8 text-center">Loading…</p> :
        labs.length === 0 ? <p className="text-muted-foreground p-8 text-center">No lab results yet</p> :
        <div className="space-y-3">{labs.map((l: any) => (
          <div key={l.id} className="bg-card border border-border rounded-xl p-5">
            <div className="flex justify-between mb-3">
              <div>
                <h4 className="font-heading font-bold">{l.hospitals?.name}</h4>
                <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-primary/15 text-primary">{l.status}</span>
            </div>
            {l.lab_result_tests?.length > 0 && (
              <table className="w-full text-sm">
                <thead><tr className="text-muted-foreground"><th className="text-left py-1">Test</th><th className="text-left py-1">Result</th><th className="text-left py-1">Range</th></tr></thead>
                <tbody>{l.lab_result_tests.map((t: any) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="py-1.5">{t.test_name}</td>
                    <td className={t.is_abnormal ? "text-destructive font-semibold" : ""}>{t.result_value} {t.unit}</td>
                    <td className="text-muted-foreground">{t.reference_range}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        ))}</div>}
    </PatientLayout>
  );
}
