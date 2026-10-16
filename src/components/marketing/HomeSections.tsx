// The home page below the reason chips. Loaded as its own chunk so the hero
// renders sooner on slow phones.
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, KeyRound, Lock } from "lucide-react";
import { Steps } from "./Steps";
import { ServiceCard } from "./ServiceCard";
import { SplitFeature } from "./SplitFeature";
import { ProviderBand } from "./ProviderBand";
import { TrustGrid } from "./TrustGrid";
import { FaqAccordion } from "./FaqAccordion";
import { CtaBand } from "./CtaBand";
import { Testimonials } from "./Testimonials";
import { Reveal } from "./Reveal";
import { mkButton } from "./buttons";
import { HOME_FAQS } from "./faqs";
import { EMERGENCY_LINE } from "./content";
import { TellUsIllustration, ChooseIllustration, MeetIllustration } from "./illustrations";

const SERVICES = [
  { photo: "video-doctor", title: "Video consultations", text: "See a doctor from home on your phone, at hospitals that offer video visits.", to: "/patients#video" },
  { photo: "inperson-clinic", title: "Book in-person visits", text: "Pick a verified hospital near you, choose a doctor and a time.", to: "/patients#in-person" },
  { photo: "triage-phone", title: "Triage assistant", text: "Answer a few questions and get pointed to the right kind of doctor.", to: "/patients#triage" },
  { photo: "records-laptop", title: "Your health records", text: "Notes, prescriptions, lab results and letters, all in one place.", to: "/patients#records" },
];

export default function HomeSections() {
  return (
    <>
        <Steps
          id="how-it-works"
          title="How it works"
          steps={[
            { title: "Tell us what's wrong", text: <>Our triage assistant asks a few questions and suggests the right specialty and how soon to be seen. {EMERGENCY_LINE}</>, illustration: TellUsIllustration },
            { title: "Choose a hospital and doctor", text: "See verified hospitals near you and the doctors who work there, then pick a time.", illustration: ChooseIllustration },
            { title: "Meet in person or by video", text: "Visit the hospital, or join a video call from your phone where the hospital offers it.", illustration: MeetIllustration },
          ]}
        />

        <section className="mk-section pt-0" aria-labelledby="services-title">
          <div className="mk-container">
            <Reveal className="mb-10 max-w-2xl">
              <h2 id="services-title">Care in the way that suits you</h2>
            </Reveal>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map((s, i) => (
                <Reveal as="li" key={s.title} delay={i * 80}>
                  <ServiceCard {...s} />
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        <SplitFeature
          photo="privacy-phone"
          eyebrow="Privacy"
          title="Your records, your control"
          reverse
        >
          <p>Your health information belongs to you. We keep it encrypted and share it only when you say so.</p>
          <ul className="space-y-3 pt-2 text-foreground">
            <li className="flex gap-3"><Lock className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />Records are encrypted.</li>
            <li className="flex gap-3"><KeyRound className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />Share them with a one-time code that expires in 15 minutes.</li>
            <li className="flex gap-3"><ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />Built to follow the Nigeria Data Protection Act 2023.</li>
          </ul>
        </SplitFeature>

        <ProviderBand />

        <TrustGrid />

        {/* Switches on when real, consented testimonials are added. */}
        <Testimonials />

        <section className="mk-section" aria-labelledby="pricing-teaser-title">
          <div className="mk-container">
            <Reveal className="grid gap-8 rounded-3xl border border-border bg-card p-8 md:grid-cols-[1.4fr_1fr] md:items-center md:p-12">
              <div>
                <h2 id="pricing-teaser-title">Free for patients. Simple plans for hospitals.</h2>
                <p className="mt-4 text-muted-foreground">Patients never pay to use HealingNet. Hospitals choose EMR Essentials or the Telemedicine Suite, priced in naira.</p>
              </div>
              <div className="flex flex-col gap-3">
                <Link to="/signup?role=hospital" className={mkButton({ size: "lg" })}>Start 30-day free trial</Link>
                <Link to="/pricing" className={mkButton({ variant: "secondary", size: "lg" })}>See pricing <ArrowRight aria-hidden /></Link>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="mk-section pt-0" aria-labelledby="home-faq-title">
          <div className="mk-container max-w-3xl">
            <Reveal>
              <h2 id="home-faq-title" className="mb-8">Questions people ask</h2>
              <FaqAccordion items={HOME_FAQS} idPrefix="home" />
              <Link to="/faq" className="mt-6 inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline">
                See all questions <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Reveal>
          </div>
        </section>

        <CtaBand />
    </>
  );
}
