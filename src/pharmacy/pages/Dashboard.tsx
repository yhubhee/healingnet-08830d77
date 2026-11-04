import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, PackageCheck, ScanLine, CalendarCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyPharmacy, OPEN_REQUEST } from "@/lib/pharmacy";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export default function PharmacyDashboard() {
  const { data: me } = useMyPharmacy();
  const pid = me?.pharmacy.id;
  const { data: stats, isError, refetch } = useQuery({
    enabled: !!pid,
    queryKey: ["pharmacy", "requests", "dashboard", pid],
    queryFn: async () => {
      const [open, today, month] = await Promise.all([
        supabase.from("rx_pharmacy_requests").select("id", { count: "exact", head: true }).eq("pharmacy_id", pid!).in("status", OPEN_REQUEST),
        supabase.from("rx_dispenses").select("id", { count: "exact", head: true }).eq("pharmacy_id", pid!).gte("dispensed_at", startOfToday()),
        supabase.from("rx_pharmacy_requests").select("id", { count: "exact", head: true }).eq("pharmacy_id", pid!).eq("status", "collected").gte("collected_at", startOfMonth()),
      ]);
      const e = open.error || today.error || month.error;
      if (e) throw e;
      return { open: open.count ?? 0, today: today.count ?? 0, month: month.count ?? 0 };
    },
    refetchInterval: 30_000,
    meta: { inlineError: true },
  });

  const cards = [
    { label: "Open requests", value: stats?.open, icon: ClipboardList, to: "/pharmacy/requests" },
    { label: "Dispensed today", value: stats?.today, icon: PackageCheck, to: "/pharmacy/history" },
    { label: "Collected this month", value: stats?.month, icon: CalendarCheck, to: "/pharmacy/requests?tab=done" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Hello{me?.member.first_name ? `, ${me.member.first_name}` : ""}</h1>
        <p className="text-sm text-muted-foreground">{me?.pharmacy.name}{me?.pharmacy.city ? `, ${me.pharmacy.city}` : ""}</p>
      </div>

      <Link to="/verify" className="flex min-h-24 items-center justify-center gap-4 rounded-2xl bg-primary p-6 text-center text-primary-foreground shadow-lg transition-opacity hover:opacity-90">
        <ScanLine className="h-9 w-9 shrink-0" aria-hidden />
        <span className="font-heading text-xl font-bold">Scan or enter a prescription code</span>
      </Link>

      {isError ? (
        <p className="text-sm text-muted-foreground">Couldn't load your numbers. <button className="font-semibold text-primary underline" onClick={() => refetch()}>Try again</button></p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <Link key={c.label} to={c.to} className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50">
              <c.icon className="mb-2 h-5 w-5 text-primary" aria-hidden />
              <p className="font-heading text-3xl font-bold">{c.value ?? "–"}</p>
              <p className="text-sm text-muted-foreground">{c.label}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
