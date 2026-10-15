import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { mkButton } from "./buttons";

const LINKS = [
  { label: "For patients", to: "/patients" },
  { label: "For hospitals", to: "/hospitals" },
  { label: "For doctors", to: "/doctors" },
  { label: "Pricing", to: "/pricing" },
  { label: "About", to: "/about" },
];

/** Sticky, blurred header. Below lg the links move into a full-screen menu. */
export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close on navigation.
  useEffect(() => setOpen(false), [pathname]);

  // While open: lock page scroll, trap focus inside the menu, close on Esc.
  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const toggle = toggleRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(menu?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    focusables()[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      toggle?.focus();
    };
  }, [open]);

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mk-container flex h-16 items-center justify-between gap-4 md:h-20">
        <Logo />
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1 text-[0.95rem]">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex min-h-11 items-center rounded-full px-4 font-medium transition-colors",
                      isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                    )
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className={cn(mkButton({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>Log in</Link>
          <Link to="/signup" className={cn(mkButton({ size: "sm" }), "hidden sm:inline-flex")}>Get started</Link>
          <button
            ref={toggleRef}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-muted lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-6 w-6" aria-hidden />
          </button>
        </div>
      </div>
    </header>

      {/* Outside <header>: its backdrop-filter would trap a fixed child inside it. */}
      {open && (
        <div
          id="mobile-menu"
          ref={menuRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden"
        >
          <div className="mk-container flex h-16 items-center justify-between md:h-20">
            <Logo onClick={() => setOpen(false)} />
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <X className="h-6 w-6" aria-hidden />
            </button>
          </div>
          <nav aria-label="Mobile" className="mk-container flex-1 overflow-y-auto pb-8 pt-4">
            <ul className="space-y-1">
              {LINKS.map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    className={({ isActive }) =>
                      cn("flex min-h-14 items-center border-b border-border font-display text-2xl", isActive ? "text-primary" : "text-foreground")
                    }
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <NavLink to="/faq" className="flex min-h-14 items-center border-b border-border font-display text-2xl">FAQ</NavLink>
              </li>
              <li>
                <NavLink to="/contact" className="flex min-h-14 items-center border-b border-border font-display text-2xl">Contact</NavLink>
              </li>
            </ul>
            <div className="mt-8 grid gap-3">
              <Link to="/signup" className={mkButton({ size: "lg" })}>Get started</Link>
              <Link to="/login" className={mkButton({ variant: "secondary", size: "lg" })}>Log in</Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
