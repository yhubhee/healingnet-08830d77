import { Link } from "react-router-dom";
import { Phone } from "lucide-react";
import { Logo } from "./Logo";
import { FOOTER_SPECIALTIES, SUPPORT_EMAIL, bookPath } from "./content";
import { useCareLink } from "./useCareLink";

const COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: "Patients",
    links: [
      { label: "For patients", to: "/patients" },
      { label: "Check your symptoms", to: "/patient/triage" },
      { label: "Book a visit", to: "/patient/book" },
      { label: "Create free account", to: "/signup" },
    ],
  },
  {
    title: "Providers",
    links: [
      { label: "For hospitals", to: "/hospitals" },
      { label: "For doctors", to: "/doctors" },
      { label: "Pricing", to: "/pricing" },
      { label: "Book a demo", to: "/contact?topic=demo" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Help & legal",
    links: [
      { label: "FAQ", to: "/faq" },
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
      { label: "Log in", to: "/login" },
    ],
  },
];

export function MarketingFooter() {
  const { linkProps } = useCareLink();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-muted/60 text-[0.95rem]">
      <div className="mk-container py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.3fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-muted-foreground">Trusted doctors and hospitals, online and in person, across Nigeria.</p>
            <p className="mt-4 text-muted-foreground">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline-offset-4 hover:text-foreground hover:underline">{SUPPORT_EMAIL}</a>
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="mb-3 font-body text-sm font-bold uppercase tracking-wider text-foreground">{col.title}</h2>
              <ul className="space-y-1">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      {...(l.to.startsWith("/patient/") ? linkProps(l.to) : { to: l.to })}
                      className="inline-flex min-h-11 items-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline md:min-h-9"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <nav aria-label="Find a specialist" className="mt-12 border-t border-border pt-8">
          <h2 className="mb-3 font-body text-sm font-bold uppercase tracking-wider text-foreground">Find a specialist</h2>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {FOOTER_SPECIALTIES.map((s) => (
              <li key={s.label}>
                <Link {...linkProps(bookPath(s.value))} className="inline-flex min-h-11 items-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline md:min-h-9">
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p className="flex items-center gap-2 text-foreground">
            <Phone className="h-4 w-4 text-primary" aria-hidden />
            <span>In an emergency, call <a href="tel:112" className="font-bold underline underline-offset-4">112</a>.</span>
          </p>
          <p>© {year} HealingNet</p>
          {/* Social links go here once HealingNet has official accounts. Left empty on purpose: no dead links. */}
          <div aria-hidden className="hidden md:block md:w-24" />
        </div>
      </div>
    </footer>
  );
}
