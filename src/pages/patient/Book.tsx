// /patient/book: book an appointment, hospital first. ?specialty= pre-fills the specialty.
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { BookingFlow } from "@/components/booking/BookingFlow";

export default function PatientBook() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  return (
    <PatientLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><CalendarPlus className="w-6 h-6 text-primary" aria-hidden />Book an appointment</h1>
        <p className="text-sm text-muted-foreground mb-5">Choose a hospital, then a doctor and a time. Not sure who to see? Try the triage assistant first.</p>
        <BookingFlow specialty={params.get("specialty")} onExit={() => navigate(-1)} />
      </div>
    </PatientLayout>
  );
}
