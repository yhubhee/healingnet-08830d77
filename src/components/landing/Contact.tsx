import { Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function Contact() {
  return (
    <section id="contact" className="py-20 container mx-auto">
      <div className="bg-gradient-to-br from-primary/10 via-card to-info/10 border border-border rounded-3xl p-10 md:p-14">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Contact</span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2 mb-4">
              Ready to modernize your hospital?
            </h2>
            <p className="text-muted-foreground mb-6">
              Talk to our team about getting HealingNet live at your facility — or sign up and start exploring today.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/signup">Book a demo</Link></Button>
              <Button asChild size="lg" variant="outline">
                <a href="mailto:hello@healingnet.app">Email us</a>
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { icon: Mail, label: "Email", value: "hello@healingnet.app", href: "mailto:hello@healingnet.app" },
              { icon: Phone, label: "Phone", value: "+234 (0) 800 HEALING", href: "tel:+2348004325464" },
              { icon: MapPin, label: "Office", value: "Lagos, Nigeria", href: null },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-4 bg-background/60 border border-border rounded-xl p-4">
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                  <c.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</div>
                  {c.href ? (
                    <a href={c.href} className="font-medium hover:text-primary transition-colors">{c.value}</a>
                  ) : (
                    <div className="font-medium">{c.value}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
