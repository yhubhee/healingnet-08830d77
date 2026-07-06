import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Props {
  appointment: any;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
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

export function RescheduleAppointmentDialog({ appointment, trigger, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [availability, setAvailability] = useState<any[]>([]);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingReschedule, setSavingReschedule] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (!open || !appointment?.doctor_id) return;

    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("doctor_availability")
        .select("*")
        .eq("doctor_id", appointment.doctor_id)
        .eq("is_available", true);

      const filtered = (data || []).filter((r: any) => {
        if (appointment.is_telemedicine) return r.accepts_virtual;
        if (!r.accepts_in_person) return false;
        if (appointment.hospital_id && r.hospital_id && r.hospital_id !== appointment.hospital_id) return false;
        return true;
      });

      setAvailability(filtered);
      setLoading(false);
    })();
  }, [open, appointment]);

  useEffect(() => {
    if (!date || !appointment?.doctor_id) return;

    (async () => {
      const iso = format(date, "yyyy-MM-dd");
      const { data } = await supabase
        .from("patient_appointments")
        .select("requested_time, status")
        .eq("doctor_id", appointment.doctor_id)
        .eq("requested_date", iso)
        .in("status", ["pending", "accepted", "confirmed"])
        .neq("id", appointment.id);

      setBookedTimes((data || []).map((a: any) => (a.requested_time || "").slice(0, 5)).filter(Boolean));
    })();
  }, [date, appointment]);

  const availableDows = useMemo(() => new Set(availability.map((a) => a.day_of_week)), [availability]);

  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const disabledDay = (d: Date) => {
    if (d < todayMidnight) return true;
    const diffDays = Math.floor((d.getTime() - todayMidnight.getTime()) / 864e5);
    if (diffDays > 60) return true;
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

  async function handleReschedule() {
    if (!date || !time) {
      toast({ title: "Please select both date and time", variant: "destructive" });
      return;
    }

    setSavingReschedule(true);
    const iso = format(date, "yyyy-MM-dd");

    const { error } = await supabase
      .from("patient_appointments")
      .update({ requested_date: iso, requested_time: time })
      .eq("id", appointment.id);

    setSavingReschedule(false);

    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Appointment rescheduled successfully" });
    qc.invalidateQueries({ queryKey: ["patient", "appointments"] });
    qc.invalidateQueries({ queryKey: ["doctor", "appointments"] });
    setOpen(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline" size="sm">Reschedule</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading availability…
            </div>
          ) : availability.length === 0 ? (
            <div className="p-4 rounded-lg bg-warning/10 text-warning text-sm">
              This doctor hasn't published availability yet.
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">New Date</label>
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
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {date && (
                <div>
                  <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">New Time</label>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {slots.length === 0 ? (
                      <p className="text-xs text-muted-foreground col-span-3">No available slots for this date</p>
                    ) : (
                      slots.map((slot) => (
                        <Button
                          key={slot}
                          variant={time === slot ? "default" : "outline"}
                          size="sm"
                          onClick={() => setTime(slot)}
                          disabled={bookedTimes.includes(slot)}
                          className="text-xs"
                        >
                          {slot}
                        </Button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {date && time && (
                <div className="p-3 bg-muted/30 rounded-lg text-sm">
                  <div className="text-xs text-muted-foreground mb-1">Selected:</div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-primary" />
                    <span>{format(date, "EEE, MMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-4 h-4 text-primary" />
                    <span>{time}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleReschedule} disabled={savingReschedule || !date || !time}>
                  {savingReschedule ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Reschedule
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
