// Admin console shell: collapsible sidebar, top bar, and a bottom tab bar on mobile.
//   ≥1024px  sidebar expanded (collapsible to icons)
//   768–1023 sidebar collapsed to icons by default
//   <768px   sidebar is an off-canvas sheet + bottom tab bar
import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { ChevronRight, LogOut, Menu, Moon, MoreHorizontal, RefreshCw, Sun, UserRound } from "lucide-react";
import logo from "@/assets/healingnet-logo.png";
import { useAuth, signOut } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset, SidebarMenu,
  SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useOverview } from "./api";
import { BOTTOM_TABS, NAV, navFor } from "./nav";
import { GlobalSearch } from "./components/GlobalSearch";
import { HospitalDetailPanel } from "./components/HospitalDetailPanel";
import { DoctorDetailPanel } from "./components/DoctorDetailPanel";
import { useDetail } from "./components/detail-state";

const DESKTOP = "(min-width: 1024px)";

function isActive(pathname: string, to: string) {
  return to === "/admin" ? pathname === "/admin" || pathname === "/admin/" : pathname.startsWith(to);
}

function Count({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cn("rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-4 text-destructive-foreground tabular-nums", className)}>
      {n > 99 ? "99+" : n}
      <span className="sr-only"> waiting</span>
    </span>
  );
}

function AdminSidebar() {
  const { pathname } = useLocation();
  const { data } = useOverview();
  const { setOpenMobile, isMobile } = useSidebar();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/admin" className="flex items-center gap-2 rounded-lg p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring" onClick={() => isMobile && setOpenMobile(false)}>
          <img src={logo} alt="" className="h-7 w-7 shrink-0 object-contain" />
          <span className="truncate font-heading text-base font-bold group-data-[collapsible=icon]:hidden">HealingNet <span className="text-sidebar-primary">Admin</span></span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const n = data && item.badge ? item.badge(data) : 0;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive(pathname, item.to)} tooltip={n ? `${item.label} (${n})` : item.label}>
                      <NavLink to={item.to} end={item.to === "/admin"} onClick={() => isMobile && setOpenMobile(false)}>
                        <item.icon aria-hidden />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {n > 0 && (
                      <SidebarMenuBadge className="rounded-full bg-destructive/15 text-destructive tabular-nums" aria-label={`${n} waiting`}>
                        {n > 99 ? "99+" : n}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

/** "Updated 12s ago": the oldest data among the admin queries on screen, plus a refresh button. */
function Freshness() {
  const qc = useQueryClient();
  const fetching = useIsFetching({ queryKey: ["admin"] }) > 0;
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);
  const times = qc.getQueryCache().findAll({ queryKey: ["admin"], type: "active" })
    .map((q) => q.state.dataUpdatedAt).filter((t) => t > 0);
  const oldest = times.length ? Math.min(...times) : 0;
  const secs = oldest ? Math.max(0, Math.round((Date.now() - oldest) / 1000)) : null;
  const label = secs == null ? "" : secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)} min ago`;

  return (
    <div className="flex items-center gap-1">
      <span className="hidden text-xs text-muted-foreground tabular-nums xl:inline" aria-live="off">
        {fetching ? "Updating…" : label && `Updated ${label}`}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost" size="icon" aria-label={label ? `Refresh (updated ${label})` : "Refresh"}
            onClick={() => qc.invalidateQueries({ queryKey: ["admin"], refetchType: "active" })}
          >
            <RefreshCw className={cn("h-4 w-4", fetching && "animate-spin")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label ? `Updated ${label} · Refresh` : "Refresh"}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function UserMenu() {
  const { user } = useAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2" aria-label="Account menu">
          <UserRound className="h-4 w-4" />
          <span className="hidden max-w-[12rem] truncate text-sm lg:inline">{user?.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut()}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TopBar() {
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const section = navFor(pathname);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
      {isMobile ? (
        <Button variant="ghost" size="icon" onClick={() => setOpenMobile(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></Button>
      ) : (
        <SidebarTrigger aria-label="Collapse or expand sidebar" />
      )}
      <div className="min-w-0 flex-1">
        <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <Link to="/admin" className="hover:text-foreground">Admin</Link>
          {section.to !== "/admin" && <><ChevronRight className="h-3 w-3" aria-hidden /><span aria-current="page">{section.label}</span></>}
        </nav>
        <h1 className="truncate font-heading text-lg font-bold leading-tight">{section.label}</h1>
      </div>
      <GlobalSearch />
      <Freshness />
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}

function BottomTabs() {
  const { pathname } = useLocation();
  const { data } = useOverview();
  const { setOpenMobile } = useSidebar();
  const tabs = BOTTOM_TABS.map((to) => NAV.find((n) => n.to === to)!);
  const moreActive = !tabs.some((t) => isActive(pathname, t.to));
  const moreCount = data ? data.inbox.contact_unhandled : 0;
  return (
    <nav aria-label="Main sections" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = isActive(pathname, t.to);
          const n = data && t.badge ? t.badge(data) : 0;
          return (
            <li key={t.to}>
              <NavLink
                to={t.to} end={t.to === "/admin"} aria-current={active ? "page" : undefined}
                className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active ? "text-primary" : "text-muted-foreground")}
              >
                <span className="relative">
                  <t.icon className="h-5 w-5" aria-hidden />
                  <Count n={n} className="absolute -right-3 -top-1.5" />
                </span>
                {t.short ?? t.label}
              </NavLink>
            </li>
          );
        })}
        <li>
          <button
            type="button" onClick={() => setOpenMobile(true)}
            className={cn("relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              moreActive ? "text-primary" : "text-muted-foreground")}
          >
            <span className="relative">
              <MoreHorizontal className="h-5 w-5" aria-hidden />
              <Count n={moreCount} className="absolute -right-3 -top-1.5" />
            </span>
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}

function GlobalDetails() {
  const { hospitalId, doctorId, close } = useDetail();
  return (
    <>
      <HospitalDetailPanel id={hospitalId} onClose={close} />
      <DoctorDetailPanel id={doctorId} onClose={close} />
    </>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(() => typeof window === "undefined" || window.matchMedia(DESKTOP).matches);
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP);
    const onChange = () => setOpen(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <AdminSidebar />
      {/* SidebarInset renders the page <main>. */}
      <SidebarInset className="min-w-0">
        <TopBar />
        <div id="admin-main" className="mx-auto w-full max-w-[1400px] flex-1 p-4 pb-24 sm:p-6 md:pb-8 lg:p-8">
          {children}
        </div>
        <BottomTabs />
      </SidebarInset>
      <GlobalDetails />
    </SidebarProvider>
  );
}
