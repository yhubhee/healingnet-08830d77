import { LandingNav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { About } from "@/components/landing/About";
import { Audiences } from "@/components/landing/Audiences";
import { Services } from "@/components/landing/Services";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { Contact } from "@/components/landing/Contact";
import { LandingFooter } from "@/components/landing/Footer";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main>
        <Hero />
        <About />
        <Audiences />
        <Services />
        <Features />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <Contact />
      </main>
      <LandingFooter />
    </div>
  );
}
