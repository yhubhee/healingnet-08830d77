import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar as CalendarIcon, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Availability {
  day_of_week: number;
  start_time: string;
  end_time: string;
  accepts_virtual: boolean;
  accepts_in_person: boolean;
  hospital_id: string | null;
}

interface Props {
  doctorId: string;
  doctorName: string;
  visitType: "in-person" | "telemedicine";
  hospitalId?: string | null;
  triageLevel: string;
  selectedDate: Date | null;
  selectedTime: string | null;
  onSelect: (date: Date, time: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

const SLOT_MIN = 30;

function generateSlots(start: string, end: string) {
  const out: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let t = sh * 60 + sm;
  const max = eh * 60 + em;
  while (t + SLOT_MIN <= max) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
    t += SLOT_MIN;
  }
  return out;
}

export function TriageStep7_5DateTimeStep({
  doctorId, doctorName, visitType, hospitalId, triageLevel,
  selectedDate, selectedTime, onSelect, onBack, onContinue,
}: Props) {
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [date, setDate] = useState<Date | null>(selectedDate);
  const [time, setTime] = useState<string | null>(selectedTime);

  // urgency window (days from today)
  const maxDays = triageLevel?.startsWith("emergency") ? 1
    : triageLevel === "consultation_24" ? 2
    : triageLevel === "consultation" ? 7
    : 30;

  useEffect(() => {
    (async () => {
      setLoadingAvail(true);
      let q = supabase.from("doctor_availability").select("*").eq("doctor_id", doctorId).eq("is_available", true);
      const { data } = await q;
      const filtered = (data || []).filter((r: any) => {
        if (visitType === "telemedicine") return r.accepts_virtual;
        if (!r.accepts_in_person) return false;
        if (hospitalId && r.hospital_id && r.hospital_id !== hospitalId) return false;
        return true;
      });
      setAvailability(filtered as any);
      setLoadingAvail(false);
    })();
  }, [doctorId, visitType, hospitalId]);

  useEffect(() => {
    if (!date) return;
    (async () => {
      setLoadingSlots(true);
      const iso = format(date, "yyyy-MM-dd");
      const { data } = await supabase
        .from("patient_appointments")
        .select("requested_time, status")
        .eq("doctor_id", doctorId)
        .eq("requested_date", iso)
        .in("status", ["pending", "accepted", "confirmed"]);
      setBookedTimes((data || []).map((a: any) => (a.requested_time || "").slice(0, 5)).filter(Boolean));
      setLoadingSlots(false);
    })();
  }, [date, doctorId]);

  const availableDows = useMemo(() => new Set(availability.map((a) => a.day_of_week)), [availability]);

  const todayMidnight = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const disabledDay = (d: Date) => {
    if (d < todayMidnight) return true;
    const diffDays = Math.floor((d.getTime() - todayMidnight.getTime()) / 864e5);
    if (diffDays > maxDays) return true;
    return !availableDows.has(d.getDay());
  };

  const slots = useMemo(() => {
    if (!date) return [];
    const dow = date.getDay();
    const rows = availability.filter((a) => a.day_of_week === dow);
    const merged = new Set<string>();
    rows.forEach((r) => generateSlots(r.start_time.slice(0, 5), r.end_time.slice(0, 5)).forEach((s) => merged.add(s)));
    return Array.from(merged).sort();
  }, [date, availability]);

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="font-heading font-bold mb-1">Pick a date & time</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Choose an available slot with Dr. {doctorName}. Booked times are disabled.
      </p>

      {loadingAvail ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Loader2 className="w-4 h-4 animate-spin" />Loading availability…</div>
      ) : availability.length === 0 ? (
        <div className="p-4 rounded-lg bg-warning/10 text-warning text-sm mb-4">
          This doctor hasn't published availability for {visitType === "telemedicine" ? "online" : "in-person"} visits yet.
          You can still request a booking — the doctor will confirm a time.
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="w-4 h-4 mr-2" />
                {date ? format(date, "EEE, MMM d, yyyy") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date || undefined}
                onSelect={(d) => { setDate(d || null); setTime(null); }}
                disabled={disabledDay}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground mt-1">
            Based on triage urgency, booking is open up to {maxDays} day{maxDays === 1 ? "" : "s"} ahead.
          </p>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Time</label>
          {!date ? (
            <div className="text-sm text-muted-foreground p-3 border border-dashed border-border rounded-lg">Pick a date first.</div>
          ) : loadingSlots ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading slots…</div>
          ) : slots.length === 0 ? (
            <div className="text-sm text-muted-foreground p-3 border border-dashed border-border rounded-lg">No slots on this day. Try another date.</div>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {slots.map((s) => {
                const taken = bookedTimes.includes(s);
                const selected = time === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={taken}
                    onClick={() => setTime(s)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm border transition-colors flex items-center gap-1",
                      taken && "opacity-40 line-through cursor-not-allowed",
                      !taken && !selected && "border-border hover:border-primary",
                      selected && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    <Clock className="w-3 h-3" />{s}{taken && <span className="text-[10px] ml-1">taken</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
        <Button
          disabled={!date || !time}
          onClick={() => date && time && (onSelect(date, time), onContinue())}
        >Continue</Button>
      </div>
    </div>
  );
}
