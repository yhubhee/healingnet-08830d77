import { Link } from "react-router-dom";
import { CreditCard, ShieldCheck, Smartphone } from "lucide-react";
import { PageShell } from "@/components/landing/PageShell";
import { PageMeta } from "@/components/landing/PageMeta";
import { Hero } from "@/components/marketing/Hero";
import { Photo } from "@/components/marketing/Photo";
import { SplitFeature } from "@/components/marketing/SplitFeature";
import { Steps } from "@/components/marketing/Steps";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { CtaBand } from "@/components/marketing/CtaBand";
import { Reveal } from "@/components/marketing/Reveal";
import { mkButton } from "@/components/marketing/buttons";
import { useCareLink } from "@/components/marketing/useCareLink";
import { PATIENT_FAQS } from "@/components/marketing/faqs";
import { EMERGENCY_LINE } from "@/components/marketing/content";
import { TellUsIllustration, ChooseIllustration, MeetIllustration } from "@/components/marketing/illustrations";

/** HTML stand-in for a payment confirmation (no provider branding, no real amounts). */
function PaymentCard() {
  return (
    <div className="mk-card mx-auto max-w-sm p-6 shadow-lg shadow-[hsl(192_45%_12%/0.06)]" aria-hidden>
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><CreditCard className="h-5 w-5" /></span>
        <div>
          <div className="font-semibold">Pay for your visit</div>
          <div className="text-sm text-muted-foreground">In naira, through Paystack</div>
        </div>
      </div>
      <div className="space-y-3 rounded-2xl bg-muted p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span className="font-semibold">Naira (₦)</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Checkout</span><span className="font-semibold">Secure, encrypted</span></div>
      </div>
      <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-success"><ShieldCheck className="h-4 w-4" />Payment confirmed</div>
    </div>
  );
}

export default function Patients() {
  const { linkProps } = useCareLink();
  return (
    <PageShell>
      <PageMeta
        title="For patients: video and in-person visits | HealingNet"
        description="See licence-checked doctors by video or in person, check your symptoms, keep your records in one place and pay in naira. Free for patients."
      />
      <Hero
        eyebrow="For patients"
        title="Care that fits your day"
        subtitle="Book a doctor in minutes, see them by video or in person, and keep your records in one place. Free for patients."
        media={<Photo id="mother-baby" priority sizes="(min-width: 1024px) 460px, 92vw" className="mx-auto aspect-[4/5] max-w-md rounded-[2rem] lg:max-w-none" />}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/signup" className={mkButton({ size: "lg" })}>Create free account</Link>
          <Link {...linkProps("/patient/triage")} className={mkButton({ variant: "secondary", size: "lg" })}>Check your symptoms</Link>
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Smartphone className="h-4 w-4" aria-hidden />Works in your phone's browser. No app to download.</p>
      </Hero>

      <SplitFeature id="video" photo="video-doctor" eyebrow="Video visits" title="See a doctor from home">
        <p>Join a video call on your phone. No travel, no waiting room.</p>
        <p>Video visits are available at hospitals that offer them. When you book, you'll see which hospitals do.</p>
      </SplitFeature>

      <SplitFeature id="in-person" photo="inperson-clinic" eyebrow="In-person visits" title="Book a hospital near you" reverse className="bg-muted/60">
        <p>Choose a verified hospital, pick a doctor or any available one, and choose a time that suits you.</p>
      </SplitFeature>

      <SplitFeature id="triage" photo="triage-phone" eyebrow="Triage assistant" title="Not sure who to see?">
        <p>Answer a few questions about how you feel. The triage assistant suggests the right kind of doctor and how soon to be seen.</p>
        <p className="rounded-2xl border border-border bg-card p-4 text-foreground">
          <strong>It helps you decide where to go. It is not a diagnosis.</strong> {EMERGENCY_LINE}
        </p>
      </SplitFeature>

      <SplitFeature id="records" photo="records-laptop" eyebrow="Your records" title="Your health, in one place" reverse className="bg-muted/60">
        <p>See your notes, prescriptions, lab results and letters whenever you need them.</p>
        <p>To share your records with another hospital, give it a one-time share code. The code expires after 15 minutes.</p>
      </SplitFeature>

      <SplitFeature id="payments" media={<PaymentCard />} eyebrow="Payments" title="Pay securely in naira">
        <p>Payments go through Paystack, in naira. Using HealingNet costs patients nothing.</p>
      </SplitFeature>

      <Steps
        title="Get care in three steps"
        className="bg-muted/60"
        steps={[
          { title: "Tell us what's wrong", text: <>Start with the triage assistant, or go straight to booking if you know who you need. {EMERGENCY_LINE}</>, illustration: TellUsIllustration },
          { title: "Choose a hospital and doctor", text: "Pick a verified hospital near you, then a doctor and a time.", illustration: ChooseIllustration },
          { title: "Meet in person or by video", text: "Go to the hospital, or join the video call from your phone.", illustration: MeetIllustration },
        ]}
      />

      <section className="mk-section" aria-labelledby="patients-faq-title">
        <Reveal className="mk-container max-w-3xl">
          <h2 id="patients-faq-title" className="mb-8">Questions from patients</h2>
          <FaqAccordion items={PATIENT_FAQS} idPrefix="patients" />
        </Reveal>
      </section>

      <CtaBand />
    </PageShell>
  );
}
