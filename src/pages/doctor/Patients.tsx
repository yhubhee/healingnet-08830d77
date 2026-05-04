import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useDoctorId, useDoctorEmrEntries } from "@/hooks/useHospitalData";

export default function DoctorPatients() {
  const { data: docId } = useDoctorId();
  const { data: emr = [] } = useDoctorEmrEntries(docId);
  const patients = Array.from(new Map(emr.map((e: any) => [e.patient_id, e.patients])).values());
  return (
    <DoctorLayout>
      <h1 className="text-2xl font-heading font-bold mb-6">My Patients</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {patients.length === 0 ? <p className="text-muted-foreground">No patients yet</p> :
          patients.map((p: any, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <h4 className="font-heading font-bold">{p?.first_name} {p?.last_name}</h4>
            </div>
          ))}
      </div>
    </DoctorLayout>
  );
}
