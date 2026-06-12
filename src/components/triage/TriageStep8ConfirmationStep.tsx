import { CheckCircle2, Loader2, Hospital, Video, Calendar as CalIcon, Clock } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface Props {
  patient: any;
  triageLevel: string;
  triageLabel: string;
  specialty: string;
  doctorId: string;
  doctorName: string;
  visitType: "in-person" | "telemedicine";
  hospitalId?: string;
  hospitalName?: string;
  selectedDate: Date | null;
  selectedTime: string | null;
  onBack: () => void;
}

export function TriageStep8ConfirmationStep({
  patient,
  triageLevel,
  triageLabel,
  specialty,
  doctorId,
  doctorName,
  visitType,
  hospitalId,
  hospitalName,
  selectedDate,
  selectedTime,
  onBack,
}: Props) {
  const nav = useNavigate();
  const [confirming, setConfirming] = useState(false);

  async function confirmBooking() {
    if (!patient || !selectedDate || !selectedTime) {
      toast.error("Please pick a date and time first.");
      return;
    }
    setConfirming(true);

    try {
      const { data: appointmentData, error: appointmentError } = await supabase
        .from("patient_appointments")
        .insert({
          patient_id: patient.id,
          doctor_id: doctorId,
          hospital_id: visitType === "in-person" ? hospitalId : null,
          requested_date: format(selectedDate, "yyyy-MM-dd"),
          requested_time: selectedTime,
          reason: `[AI Nurse] ${specialty} • ${triageLabel}`,
          status: "pending",
          is_telemedicine: visitType === "telemedicine",
        } as any)
        .select("id")
        .single();

      if (appointmentError) {
        if ((appointmentError as any).code === "23505") {
          throw new Error("That slot was just booked — please choose another time.");
        }
        throw appointmentError;
      }

      const appointmentId = appointmentData?.id;

      if (visitType === "telemedicine") {
        const { error: roomError } = await supabase.functions.invoke("daily-room", {
          body: {
            action: "create",
            appointment_id: appointmentId,
            doctor_name: `Dr. ${doctorName}`,
            patient_name: patient.first_name,
          },
        });

        if (roomError) {
          throw new Error("Failed to create video room: " + (roomError.message || "Unknown error"));
        }
      }

      toast.success("Appointment booked successfully!");
      nav("/patient/appointments");
    } catch (error: any) {
      toast.error(error.message || "Booking failed");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="font-heading font-bold mb-1">Confirm booking</h2>
      <p className="text-sm text-muted-foreground mb-4">Review your appointment details before confirming.</p>

      <div className="space-y-4 mb-6">
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground mb-1">Triage Assessment</div>
          <div className="font-heading font-bold text-sm">{triageLabel}</div>
        </div>

        <div className="p-4 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground mb-1">Doctor</div>
          <div className="font-heading font-bold text-sm">Dr. {doctorName}</div>
          <div className="text-xs text-muted-foreground mt-1">{specialty}</div>
        </div>

        <div className="p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 mb-1">
            {visitType === "telemedicine" ? <Video className="w-4 h-4 text-primary" /> : <Hospital className="w-4 h-4 text-primary" />}
            <div className="text-xs text-muted-foreground">Visit Type</div>
          </div>
          <div className="font-heading font-bold text-sm">
            {visitType === "telemedicine" ? "Online Consultation" : "In-Person at Hospital"}
          </div>
        </div>

        {visitType === "in-person" && hospitalName && (
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground mb-1">Hospital Location</div>
            <div className="font-heading font-bold text-sm">{hospitalName}</div>
          </div>
        )}

        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1"><CalIcon className="w-3 h-3" />Date</div>
            <div className="font-heading font-bold text-sm">{selectedDate ? format(selectedDate, "EEE, MMM d, yyyy") : "—"}</div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1"><Clock className="w-3 h-3" />Time</div>
            <div className="font-heading font-bold text-sm">{selectedTime || "—"}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="px-4 py-3 rounded-lg border border-border text-sm">Back</button>
        <button
          onClick={confirmBooking}
          disabled={confirming || !selectedDate || !selectedTime}
          className="flex-1 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {confirming ? <><Loader2 className="w-4 h-4 animate-spin" /> Booking…</> : <><CheckCircle2 className="w-4 h-4" /> Confirm Booking</>}
        </button>
      </div>
    </div>
  );
}

