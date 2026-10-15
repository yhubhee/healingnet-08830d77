import { Link } from "react-router-dom";
import { PageShell } from "@/components/landing/PageShell";
import { PageMeta } from "@/components/landing/PageMeta";
import { CareSearch } from "@/components/marketing/CareSearch";
import { mkButton } from "@/components/marketing/buttons";
import { useCareLink } from "@/components/marketing/useCareLink";
import { SickDayIllustration } from "@/components/marketing/illustrations";

export default function NotFound() {
  const careLink = useCareLink();
  return (
    <PageShell>
      <PageMeta title="Page not found | HealingNet" description="We couldn't find that page." noindex />
      <section className="mk-container max-w-2xl py-16 text-center md:py-24">
        <SickDayIllustration className="mx-auto mb-8 h-40 w-auto md:h-48" />
        <h1>This page took a sick day</h1>
        <p className="mt-4 text-lg text-muted-foreground">We couldn't find the page you were looking for. It may have moved, or the link may be wrong.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/" className={mkButton({ size: "lg" })}>Go to the home page</Link>
          <Link to={careLink("/patient/book")} className={mkButton({ variant: "secondary", size: "lg" })}>Book a visit</Link>
        </div>
        <CareSearch className="mt-12 text-left" />
      </section>
    </PageShell>
  );
}
