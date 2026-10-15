export interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

/**
 * Real, consented testimonials only. Renders nothing until it is given some,
 * so it can sit on a page now and switch on later.
 */
export function Testimonials({ items = [] }: { items?: Testimonial[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mk-section" aria-labelledby="testimonials-title">
      <div className="mk-container">
        <h2 id="testimonials-title" className="mb-10">What people say</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((t) => (
            <figure key={t.name} className="mk-card p-6">
              <blockquote className="text-base">“{t.quote}”</blockquote>
              <figcaption className="mt-4 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{t.name}</span>, {t.role}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
