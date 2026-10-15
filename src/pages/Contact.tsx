import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Mail, CalendarCheck, LifeBuoy, Phone } from "lucide-react";
import { PageShell } from "@/components/landing/PageShell";
import { PageMeta } from "@/components/landing/PageMeta";
import { Hero } from "@/components/marketing/Hero";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { mkButton } from "@/components/marketing/buttons";
import { SUPPORT_EMAIL } from "@/components/marketing/content";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/errors";

// ?topic= preselects one of these. The choice only fills the existing subject field.
const TOPICS: Record<string, string> = {
  demo: "Book a demo",
  hospital: "Setting up my hospital",
  doctor: "Joining as a doctor",
  patient: "Help with my account",
  billing: "Plans and payments",
  other: "Something else",
};

export default function Contact() {
  const [params] = useSearchParams();
  const initialTopic = TOPICS[params.get("topic") ?? ""] ? (params.get("topic") as string) : "";
  const [topic, setTopic] = useState(initialTopic);
  const [form, setForm] = useState({ name: "", email: "", subject: initialTopic ? TOPICS[initialTopic] : "", message: "" });
  const [loading, setLoading] = useState(false);

  function chooseTopic(t: string) {
    setTopic(t);
    setForm((f) => ({ ...f, subject: TOPICS[t] ?? "" }));
  }

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
      toast({ title: "Couldn't send", description: friendlyError(error), variant: "destructive" });
      return;
    }
    toast({ title: "Message sent", description: "Thanks. We'll get back to you by email." });
    setForm({ name: "", email: "", subject: "", message: "" });
    setTopic("");
  }

  const field = "h-12 rounded-2xl bg-background text-base";

  return (
    <PageShell>
      <PageMeta
        title="Contact HealingNet"
        description="Book a demo for your hospital, ask about joining as a doctor, or get help with your account. Send us a message."
      />
      <Hero
        eyebrow="Contact"
        title="Talk to us"
        subtitle="Book a demo, ask a question, or get help with your account. Send a message and we'll reply by email."
      />

      <section className="pb-16 md:pb-24">
        <div className="mk-container grid gap-8 lg:grid-cols-[1fr_1.6fr]">
          <div className="space-y-4">
            {[
              { icon: CalendarCheck, title: "Hospitals", text: "Book a demo and we'll show your team around." },
              { icon: LifeBuoy, title: "Patients and doctors", text: "Questions about your account or a booking." },
            ].map((c) => (
              <div key={c.title} className="mk-card flex gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><c.icon className="h-5 w-5" aria-hidden /></span>
                <div>
                  <h2 className="font-body text-lg font-bold tracking-normal">{c.title}</h2>
                  <p className="text-base text-muted-foreground">{c.text}</p>
                </div>
              </div>
            ))}
            <div className="mk-card flex gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Mail className="h-5 w-5" aria-hidden /></span>
              <div className="min-w-0">
                <h2 className="font-body text-lg font-bold tracking-normal">Email</h2>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="break-all text-base font-semibold text-primary underline underline-offset-4">{SUPPORT_EMAIL}</a>
              </div>
            </div>
            <p className="flex gap-3 rounded-3xl border border-border bg-muted/60 p-5 text-base">
              <Phone className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span>Need urgent medical help? Don't wait for a reply: call <a href="tel:112" className="font-bold underline underline-offset-4">112</a> or go to the nearest hospital.</span>
            </p>
          </div>

          <form onSubmit={onSubmit} className="mk-card space-y-5 p-6 md:p-8" noValidate>
            <h2 className="text-[1.75rem] md:text-[2rem]">Send us a message</h2>
            <div className="space-y-1.5">
              <Label htmlFor="topic">Topic</Label>
              <select
                id="topic"
                value={topic}
                onChange={(e) => chooseTopic(e.target.value)}
                className={`${field} w-full border border-input px-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
              >
                <option value="">Choose a topic</option>
                {Object.entries(TOPICS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name (required)</Label>
                <Input id="name" required autoComplete="name" className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your full name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email (required)</Label>
                <Input id="email" type="email" required autoComplete="email" className={field} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" className={field} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="What's this about?" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">Message (required)</Label>
              <Textarea id="message" required rows={6} className="rounded-2xl bg-background text-base" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us a bit about what you need. Hospitals: your hospital's name and city helps." />
            </div>
            <p className="text-sm text-muted-foreground">Please don't include medical details in this form.</p>
            <button type="submit" className={mkButton({ size: "lg" })} disabled={loading}>
              {loading ? "Sending…" : "Send message"}
            </button>
          </form>
        </div>
      </section>
    </PageShell>
  );
}
