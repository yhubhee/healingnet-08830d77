import { useState } from "react";
import { PageShell } from "@/components/landing/PageShell";
import { PageHero } from "@/components/landing/PageHero";
import { PageMeta } from "@/components/landing/PageMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, MapPin, Clock, MessageSquare, HeadphonesIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast({ title: "Missing info", description: "Name, email and message are required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("contact_messages").insert({
      name: form.name,
      email: form.email,
      subject: form.subject || null,
      message: form.message,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Couldn't send", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Message sent", description: "Thanks — we'll get back to you within one business day." });
    setForm({ name: "", email: "", subject: "", message: "" });
  }

  return (
    <PageShell>
      <PageMeta title="Contact HealingNet — Talk to our team" description="Get in touch with HealingNet. Email, phone, office address and a contact form for sales, support and partnership inquiries." />
      <PageHero
        eyebrow="Contact"
        title="We'd love to hear from you."
        subtitle="Sales, support, partnerships, press — whatever the reason, drop us a line and someone will be in touch within one business day."
      />

      <section className="py-16 container mx-auto">
        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1 space-y-4">
            {[
              { icon: Mail, label: "Email", value: "hello@healingnet.app", href: "mailto:hello@healingnet.app" },
              { icon: Phone, label: "Phone", value: "+234 (0) 800 HEALING", href: "tel:+2348004325464" },
              { icon: MapPin, label: "Office", value: "Lagos, Nigeria", href: null },
              { icon: Clock, label: "Hours", value: "Mon–Fri, 9am–6pm WAT", href: null },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-4 bg-card border border-border rounded-xl p-4">
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <c.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</div>
                  {c.href ? (
                    <a href={c.href} className="font-medium hover:text-primary transition-colors block truncate">{c.value}</a>
                  ) : (
                    <div className="font-medium">{c.value}</div>
                  )}
                </div>
              </div>
            ))}

            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span><span className="font-semibold">Sales:</span> sales@healingnet.app</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <HeadphonesIcon className="w-4 h-4 text-primary" />
                <span><span className="font-semibold">Support:</span> support@healingnet.app</span>
              </div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 md:p-8 space-y-5">
            <h2 className="text-2xl font-heading font-bold">Send us a message</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your full name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@hospital.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="What's this about?" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">Message *</Label>
              <Textarea id="message" rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us a bit about your hospital and what you're looking for…" />
            </div>
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? "Sending…" : "Send message"}
            </Button>
          </form>
        </div>
      </section>
    </PageShell>
  );
}
