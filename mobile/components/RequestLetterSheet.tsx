// Request a letter (src/components/patient/RequestLetterDialog.tsx): the same three fields
// (letter type, preferred doctor, reason) and the same insert into patient_letters with
// status "pending". The request then shows in the list as waiting for the doctor.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/shared/errors";
import { ANY_DOCTOR, LETTER_REQUEST_NEEDS_REASON, LETTER_REQUEST_SENT, LETTER_TYPES, letterRequestRow } from "@/shared/records";
import { space } from "@/theme";
import { Field, SelectField, Sheet } from "./form";
import { useToast } from "./toast";
import { Button, Notice } from "./ui";

export function RequestLetterSheet({ visible, patientId, onClose }: { visible: boolean; patientId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const online = useOnline();
  const [letterType, setLetterType] = useState<string>(LETTER_TYPES[0].value);
  const [doctorId, setDoctorId] = useState<string>(ANY_DOCTOR);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible) { setLetterType(LETTER_TYPES[0].value); setDoctorId(ANY_DOCTOR); setNotes(""); } }, [visible]);

  // Doctors the patient has previously seen (appointments and records), as on the website.
  const doctors = useQuery({
    queryKey: ["letter-doctors", patientId],
    enabled: visible && !!patientId,
    queryFn: async () => {
      const [appts, emr] = await Promise.all([
        supabase.from("patient_appointments").select("doctor_id").eq("patient_id", patientId!),
        supabase.from("emr_entries").select("doctor_id").eq("patient_id", patientId!),
      ]);
      const ids = [...new Set([...(appts.data ?? []), ...(emr.data ?? [])].map((r) => r.doctor_id).filter((v): v is string => !!v))];
      if (ids.length === 0) return [];
      const { data } = await supabase.from("doctors").select("id, first_name, last_name, specialty").in("id", ids);
      return data ?? [];
    },
  });

  async function submit() {
    if (!patientId) return;
    if (!notes.trim()) return toast.error(LETTER_REQUEST_NEEDS_REASON);
    setSaving(true);
    try {
      let hospitalId: string | null = null;
      if (doctorId !== ANY_DOCTOR) {
        // The hospital where the patient last saw this doctor (patients can't read hospital_doctors).
        const { data: appt } = await supabase.from("patient_appointments").select("hospital_id")
          .eq("patient_id", patientId).eq("doctor_id", doctorId).order("requested_date", { ascending: false }).limit(1).maybeSingle();
        hospitalId = appt?.hospital_id ?? null;
      }
      const { error } = await supabase.from("patient_letters").insert(letterRequestRow({ patientId, doctorId, hospitalId, letterType, notes, now: new Date() }));
      if (error) throw error;
      toast.success(LETTER_REQUEST_SENT);
      await qc.invalidateQueries({ queryKey: ["letters"] });
      onClose();
    } catch (e) {
      toast.error(friendlyError(e, "Could not submit request"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Request a letter"
      footer={
        <>
          {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
          <Button label={saving ? "Submitting…" : "Submit request"} onPress={submit} loading={saving} disabled={!online} disabledReason={OFFLINE_ACTION} />
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </>
      }>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.lg }}>
        <SelectField label="Letter type" value={letterType} onChange={setLetterType} options={LETTER_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        <SelectField label="Preferred doctor (optional)" value={doctorId} onChange={setDoctorId}
          options={[
            { value: ANY_DOCTOR, label: "Any available doctor" },
            ...(doctors.data ?? []).map((d) => ({ value: d.id, label: `Dr. ${d.first_name} ${d.last_name}${d.specialty ? ` — ${d.specialty}` : ""}` })),
          ]} />
        <Field label="Reason / notes" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 140 }}
          placeholder="Why you need this letter, dates, employer / school name, any other details…" />
      </ScrollView>
    </Sheet>
  );
}
