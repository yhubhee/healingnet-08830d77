import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ClipboardList, Heart, History, Home, LogOut, Menu, Receipt, ScanLine, Settings, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/hooks/useAuth";
import { useUserNotifications, useRealtimeUserNotifications } from "@/hooks/useUserNotifications";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useMyPharmacy } from "@/lib/pharmacy";
import { PharmacyStatusBanner } from "./components/StatusBanner";

type Item = { label: string; path: string; icon: typeof Home; end?: boolean; badge?: number; external?: boolean };

/** Open 'sent' requests for this pharmacy, kept live (Realtime + 30 s refetch). */
export function useNewRequestCount(pharmacyId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!pharmacyId) return;
    const ch = supabase
      .channel(`pharmacy-requests-${pharmacyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rx_pharmacy_requests", filter: `pharmacy_id=eq.${pharmacyId}` },
        () => qc.invalidateQueries({ queryKey: ["pharmacy", "requests"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pharmacyId, qc]);
  return useQuery({
    enabled: !!pharmacyId,
    queryKey: ["pharmacy", "requests", "new-count", pharmacyId],
    queryFn: async () => {
      const { count, error } = await supabase.from("rx_pharmacy_requests").select("id", { count: "exact", head: true })
        .eq("pharmacy_id", pharmacyId!).eq("status", "sent");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30_000,
    meta: { inlineError: true },
  });
}

export function PharmacyLayout({ children, banner = true }: { children: ReactNode; banner?: boolean }) {
  const { data: me } = useMyPharmacy();
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  useRealtimeUserNotifications();
  const { data: notes = [] } = useUserNotifications("pharmacy");
  const unread = notes.filter((n) => !n.is_read).length;
  const { data: newCount = 0 } = useNewRequestCount(me?.pharmacy.id);
  const isOwner = me?.member.role === "owner";

  const items: Item[] = [
    { label: "Dashboard", path: "/pharmacy", icon: Home, end: true },
    { label: "Requests", path: "/pharmacy/requests", icon: ClipboardList, badge: newCount },
    { label: "Verify a code", path: "/verify", icon: ScanLine, external: true },
    { label: "History", path: "/pharmacy/history", icon: History },
    { label: "Team", path: "/pharmacy/team", icon: Users },
    ...(isOwner ? [{ label: "Fees", path: "/pharmacy/fees", icon: Receipt }] : []),
    { label: "Notifications", path: "/pharmacy/notifications", icon: Bell, badge: unread },
    { label: "Settings", path: "/pharmacy/settings", icon: Settings },
  ];
  const isActive = (it: Item) => (it.end ? pathname === it.path : pathname === it.path || pathname.startsWith(it.path + "/"));

  const bottom: Item[] = [items[0], items[1], { ...items[2], label: "Scan" }, items[3]];
  const moreItems = items.filter((it) => !bottom.some((b) => b.path === it.path));

  const navLink = (it: Item, onClick?: () => void) => (
    <NavLink key={it.path} to={it.path} end={it.end} onClick={onClick}
      className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        isActive(it) ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent")}>
      <it.icon className="h-4 w-4" aria-hidden /><span className="flex-1">{it.label}</span>
      {it.badge ? <span className="min-w-[20px] rounded-full bg-primary px-1.5 text-center text-xs text-primary-foreground ring-1 ring-primary-foreground/30">{it.badge}</span> : null}
    </NavLink>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <Link to="/pharmacy" className="flex items-center gap-2 border-b border-sidebar-border p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-info">
            <Heart className="h-4 w-4 text-primary-foreground" fill="currentColor" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-heading text-sm font-bold">HealingNet</span>
            <span className="block truncate text-xs text-muted-foreground">{me?.pharmacy.name ?? "Pharmacy"}</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Pharmacy">{items.map((it) => navLink(it))}</nav>
        <button onClick={signOut} className="m-3 flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" aria-hidden />Sign out
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center gap-2 border-b border-border bg-sidebar px-4 py-3 md:hidden">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-info">
            <Heart className="h-3.5 w-3.5 text-primary-foreground" fill="currentColor" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate font-heading text-sm font-bold">{me?.pharmacy.name ?? "Pharmacy"}</span>
          <Link to="/pharmacy/notifications" className="relative flex h-11 w-11 items-center justify-center" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
            <Bell className="h-5 w-5" aria-hidden />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />}
          </Link>
        </header>

        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">
          {banner && me && <PharmacyStatusBanner me={me} />}
          {children}
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-sidebar md:hidden" aria-label="Pharmacy">
        {bottom.map((it) => (
          <NavLink key={it.path} to={it.path} end={it.end}
            className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]", isActive(it) ? "text-primary" : "text-muted-foreground")}>
            <it.icon className="h-5 w-5" aria-hidden />{it.label}
            {it.badge ? <span className="absolute right-[22%] top-1.5 min-w-[18px] rounded-full bg-primary px-1 text-center text-[10px] text-primary-foreground">{it.badge}</span> : null}
          </NavLink>
        ))}
        <button onClick={() => setMore(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground">
          <Menu className="h-5 w-5" aria-hidden />More
        </button>
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="bg-sidebar">
          <SheetTitle className="mb-2 text-base">More</SheetTitle>
          <nav className="space-y-1">{moreItems.map((it) => navLink(it, () => setMore(false)))}</nav>
          <button onClick={signOut} className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" aria-hidden />Sign out
          </button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
