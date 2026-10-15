import { Link } from "react-router-dom";
import { BadgeCheck, Building2, Video, CalendarClock } from "lucide-react";
import { PageShell } from "@/components/landing/PageShell";
import { PageMeta } from "@/components/landing/PageMeta";
import { Hero } from "@/components/marketing/Hero";
import { Photo } from "@/components/marketing/Photo";
import { Steps } from "@/components/marketing/Steps";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { CtaBand } from "@/components/marketing/CtaBand";
import { Reveal } from "@/components/marketing/Reveal";
import { mkButton } from "@/components/marketing/buttons";
import { DOCTOR_FAQS } from "@/components/marketing/faqs";

const POINTS = [
  { icon: BadgeCheck, title: "Verified licence", text: "We check your licence against the council that issued it, so patients know you're qualified." },
  { icon: Building2, title: "One or more hospitals", text: "Work with one hospital or several, from the same account." },
  { icon: Video, title: "Video visits and paperwork", text: "See patients by video, and write consultation notes, prescriptions and letters in one place." },
  { icon: CalendarClock, title: "Your availability", text: "You set the days and hours you work, and whether you take video or in-person visits." },
];

export default function Doctors() {
  return (
    <PageShell>
      <PageMeta
        title="For doctors: practise with more reach | HealingNet"
        description="Get your licence verified, work with one or more Nigerian hospitals, and see patients by video or in person. Free for doctors."
      />
      <Hero
        eyebrow="For doctors"
        title="Practise with more reach"
        subtitle="See patients in person and by video, across one or more hospitals, with your licence verified."
        media={<Photo id="doctor-portrait" priority sizes="(min-width: 1024px) 460px, 92vw" className="mx-auto aspect-[4/5] max-w-md rounded-[2rem] lg:max-w-none" />}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/signup?role=doctor" className={mkButton({ size: "lg" })}>Join as a doctor</Link>
          <Link to="/faq#doctors" className={mkButton({ variant: "secondary", size: "lg" })}>Read the FAQ</Link>
        </div>
      </Hero>

      <section className="mk-section bg-muted/60" aria-labelledby="doctor-points-title">
        <div className="mk-container">
          <Reveal className="mb-10 max-w-2xl">
            <h2 id="doctor-points-title">Built around how you work</h2>
          </Reveal>
          <ul className="grid gap-5 sm:grid-cols-2">
            {POINTS.map((p, i) => (
              <Reveal as="li" key={p.title} delay={(i % 2) * 80} className="mk-card flex gap-4 p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><p.icon className="h-5 w-5" aria-hidden /></span>
                <div>
                  <h3 className="mb-1">{p.title}</h3>
                  <p className="text-base text-muted-foreground">{p.text}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <Steps
        title="How to get started"
        steps={[
          { title: "Sign up", text: "Create your doctor account. It's free." },
          { title: "Verify your licence", text: "Add your licence details and we check them with the issuing council." },
          { title: "Join a hospital", text: "A hospital invites you. Accept, and you join its team." },
          { title: "See patients", text: "Patients book you in person or by video, at the times you set." },
        ]}
      />

      <section className="mk-section pt-0" aria-labelledby="doctors-faq-title">
        <Reveal className="mk-container max-w-3xl">
          <h2 id="doctors-faq-title" className="mb-8">Questions from doctors</h2>
          <FaqAccordion items={DOCTOR_FAQS} idPrefix="doctors" />
        </Reveal>
      </section>

      <CtaBand
        title="Ready to see more patients?"
        text="Create your free doctor account and get your licence verified."
        primary={{ label: "Join as a doctor", to: "/signup?role=doctor" }}
        secondary={null}
      />
    </PageShell>
  );
}
