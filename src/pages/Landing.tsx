import { LandingNav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Audiences } from "@/components/landing/Audiences";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { LandingFooter } from "@/components/landing/Footer";
import { PageMeta } from "@/components/landing/PageMeta";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <PageMeta title="HealingNet — Hospital Management & Telemedicine for Nigeria" description="All-in-one EMR, patient queue, billing, lab, pharmacy and telemedicine platform built for Nigerian hospitals, doctors and patients." />
      <LandingNav />
      <main>
        <Hero />
        <Audiences />
        <Features />
        <HowItWorks />
        <Pricing />

        {/* Explore-more CTA strip */}
        <section className="py-16 container mx-auto">
          <div className="bg-gradient-to-br from-primary/10 via-card to-info/10 border border-border rounded-3xl p-10 md:p-14 text-center">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3">Want to dig deeper?</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Read about our mission, see every service explained in detail, or talk to our team.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild variant="outline"><Link to="/about">About us</Link></Button>
              <Button asChild variant="outline"><Link to="/services">All services</Link></Button>
              <Button asChild variant="outline"><Link to="/features">Features</Link></Button>
              <Button asChild><Link to="/contact">Contact <ArrowRight className="w-4 h-4 ml-1.5" /></Link></Button>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
