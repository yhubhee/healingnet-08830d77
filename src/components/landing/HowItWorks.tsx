const steps = [
  { n: "01", title: "Sign up your hospital", desc: "Create your admin account and choose your plan in under 2 minutes." },
  { n: "02", title: "Configure your hospital", desc: "Add wards, departments, doctors & customize your workflow." },
  { n: "03", title: "Onboard your team", desc: "Invite staff, assign roles, and start serving patients today." },
];

export function HowItWorks() {
  return (
    <section className="py-20 container mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3">Live in 3 simple steps</h2>
      </div>
      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {steps.map((s) => (
          <div key={s.n} className="relative bg-card border border-border rounded-2xl p-8">
            <div className="text-5xl font-heading font-bold text-primary/20 mb-4">{s.n}</div>
            <h3 className="text-lg font-heading font-bold mb-2">{s.title}</h3>
            <p className="text-sm text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
