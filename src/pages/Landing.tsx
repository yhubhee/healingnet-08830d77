import { lazy, Suspense } from "react";
import { Video } from "lucide-react";
import { PageShell } from "@/components/landing/PageShell";
import { PageMeta } from "@/components/landing/PageMeta";
import { Hero } from "@/components/marketing/Hero";
import { CareSearch } from "@/components/marketing/CareSearch";
import { ReasonChips } from "@/components/marketing/ReasonChips";
import { Photo } from "@/components/marketing/Photo";
import { SITE_URL, SUPPORT_EMAIL } from "@/components/marketing/content";

// Everything below the reason chips arrives in a second chunk, after the hero has rendered.
const HomeSections = lazy(() => import("@/components/marketing/HomeSections"));

// Structured data for search engines. Only facts the site states elsewhere.
const ORGANIZATION_LD = {
  "@context": "https://schema.org",
  "@type": "MedicalOrganization",
  name: "HealingNet",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  image: `${SITE_URL}/og-image.png`,
  description: "Telemedicine and hospital software for Nigeria: video and in-person visits with licence-checked doctors, and an EMR for hospitals.",
  email: SUPPORT_EMAIL,
  areaServed: { "@type": "Country", name: "Nigeria" },
};

export default function Landing() {
  return (
    <PageShell>
      <PageMeta
        title="HealingNet: see a trusted doctor today, from anywhere in Nigeria"
        description="Book video or in-person visits with licence-checked doctors at hospitals near you. Free for patients. Pay in naira."
        jsonLd={ORGANIZATION_LD}
      />

      <Hero
        eyebrow="Healthcare for every Nigerian"
        title="See a trusted doctor today, from anywhere."
        subtitle="Book video or in-person visits with licence-checked doctors at hospitals near you. Pay in naira."
        media={
          <div className="relative mx-auto max-w-md lg:max-w-none">
            <Photo id="hero-patient-phone" priority sizes="(min-width: 1024px) 460px, (min-width: 640px) 28rem, 92vw" className="aspect-[4/5] rounded-[2rem]" />
            {/* A UI chip, built in HTML: shows what a booked visit looks like. */}
            <div className="absolute -left-3 bottom-8 flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur sm:-left-8">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Video className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-sm leading-tight">
                <span className="block font-semibold">Dr. A. · Video visit</span>
                <span className="text-muted-foreground">Today, 10:30</span>
              </span>
            </div>
          </div>
        }
      >
        <CareSearch />
        <p className="mt-4 text-sm text-muted-foreground">Free for patients · Licence-checked doctors · Your data stays private</p>
      </Hero>

      <ReasonChips />

      <Suspense fallback={<div className="min-h-[60vh]" aria-hidden />}>
        <HomeSections />
      </Suspense>
    </PageShell>
  );
}
