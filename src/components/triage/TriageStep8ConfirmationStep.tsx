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
}: Props) {
  const nav = useNavigate();
  const [confirming, setConfirming] = useState(false);

  async function confirmBooking() {
    if (!patient) return;
    setConfirming(true);

    try {
      // Calculate appointment date based on triage level
      const offsetDays =
        triageLevel.startsWith("emergency") ? 0
          : triageLevel === "consultation_24" ? 1
          : triageLevel === "consultation" ? 3
          : 7;
      const date = new Date(Date.now() + offsetDays * 864e5);

      // First: Create appointment
      const { data: appointmentData, error: appointmentError } = await supabase
        .from("patient_appointments")
        .insert({
          patient_id: patient.id,
          doctor_id: doctorId,
          hospital_id: visitType === "in-person" ? hospitalId : null,
          requested_date: date.toISOString().slice(0, 10),
          reason: `[AI Nurse] ${specialty} • ${triageLabel}`,
          status: "pending",
          is_telemedicine: visitType === "telemedicine",
        } as any)
        .select("id")
        .single();

      if (appointmentError) throw appointmentError;

      const appointmentId = appointmentData?.id;

      // Second: Create Daily room for telemedicine (if needed)
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

  const estimatedWait = triageLevel.startsWith("emergency") ? "Immediate" :
    triageLevel === "consultation_24" ? "Within 24 hours" :
    triageLevel === "consultation" ? "Within 3 days" : "Within 7 days";

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="font-heading font-bold mb-1">Step 8 of 8 — Confirm booking</h2>
      <p className="text-sm text-muted-foreground mb-4">Review your appointment details before confirming.</p>

      <div className="space-y-4 mb-6">
        {/* Triage Level */}
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground mb-1">Triage Assessment</div>
          <div className="font-heading font-bold text-sm">{triageLabel}</div>
          <div className="text-xs text-muted-foreground mt-1">Estimated wait: {estimatedWait}</div>
        </div>

        {/* Doctor */}
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground mb-1">Doctor</div>
          <div className="font-heading font-bold text-sm">Dr. {doctorName}</div>
          <div className="text-xs text-muted-foreground mt-1">{specialty}</div>
        </div>

        {/* Visit Type */}
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 mb-1">
            {visitType === "telemedicine" ? (
              <Video className="w-4 h-4 text-primary" />
            ) : (
              <Hospital className="w-4 h-4 text-primary" />
            )}
            <div className="text-xs text-muted-foreground">Visit Type</div>
          </div>
          <div className="font-heading font-bold text-sm capitalize">
            {visitType === "telemedicine" ? "Online Consultation" : "In-Person at Hospital"}
          </div>
        </div>

        {/* Hospital (if in-person) */}
        {visitType === "in-person" && hospitalName && (
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground mb-1">Hospital Location</div>
            <div className="font-heading font-bold text-sm">{hospitalName}</div>
          </div>
        )}
      </div>

      <button
        onClick={confirmBooking}
        disabled={confirming}
        className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {confirming ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Booking…
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" /> Confirm Booking
          </>
        )}
      </button>
    </div>
  );
}
