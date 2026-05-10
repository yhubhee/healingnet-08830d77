## Plan: Dedicated marketing pages with detailed content

Right now the landing page is a single long scroll with anchor sections (`#about`, `#services`, etc.). You want **real, dedicated pages** that explain each topic in depth — the problem it solves, how HealingNet solves it, and how it's applied in a Nigerian hospital context.

### What gets built

Six new full pages, each with its own route, hero, deep content sections, and CTA. All share the existing `LandingNav` + `LandingFooter` so navigation feels consistent.

| Route | Page | Focus |
|---|---|---|
| `/` | Landing (existing, trimmed) | Keep as marketing home — Hero + brief teasers + CTA. Remove duplicated long sections that now live on dedicated pages. |
| `/about` | About | Story, mission, the Nigerian healthcare problems we tackle, our approach, team values, by-the-numbers. |
| `/services` | Services | Each of the 12 modules explained: **Problem → Solution → How it's applied**. Grouped by Hospitals / Doctors / Patients. |
| `/features` | Features | Cross-cutting platform capabilities: real-time queue, AI triage, role-based access, NHIS/HMO billing, analytics, multi-portal sync, offline-tolerant flows. |
| `/pricing` | Pricing | Existing pricing block + detailed plan comparison table, FAQ on billing, "what counts as a staff seat", upgrade path. |
| `/faq` | FAQ | Expanded Q&A grouped by category (Security, Billing, Setup, Patients, Integrations). |
| `/contact` | Contact | Contact info, office (Lagos), email/phone, working hours, sales vs support routing, simple contact form (writes to a `contact_messages` table). |

### Content depth per service (example shape)

For each module on `/services` we'll write a self-contained block like:

```text
Patient Queue
─────────────
The problem: In most Nigerian hospitals patients sit on benches for
hours with no visibility into where they are in line. Staff manage
order on paper, leading to disputes and missed patients.

How HealingNet solves it: A live, shared digital queue. Front-desk
checks patients in, the system auto-routes to the right doctor by
specialty/urgency, and every screen shows current position in real time.

How it's applied: Receptionist taps "Check In" → patient gets a number
→ doctor sees their queue update instantly → patient (or family) can
track status from the patient portal or a waiting-room display.
```

Same structure for: EMR, Billing, Lab, Pharmacy, Maternity, Surgery, Insurance/HMO, Telemedicine, Doctor Marketplace, Analytics, Bed Management, Staff Management, AI Triage.

### Navigation changes

- `Nav.tsx`: change anchor links (`#about`, `#services`, …) to `<Link>` routes (`/about`, `/services`, …). Highlight active route.
- `Footer.tsx`: same swap from anchors to routes.
- Mobile menu: add a hamburger sheet (currently `md:flex` only).

### Routing

- Add 6 new routes in `src/App.tsx` under the public section, each rendering the same shell (`LandingNav` + page + `LandingFooter`).
- Add SEO `<title>` and `<meta description>` per page using a small `<PageMeta>` helper (no extra deps).

### Contact form (lightweight)

- New table `contact_messages (id, name, email, subject, message, created_at)` with RLS allowing anonymous inserts only.
- Form posts via Supabase client; success → toast + reset.
- Internal viewing of messages is out of scope this round (we can add a hospital-admin inbox later).

### Out of scope

- Blog / case studies / careers pages
- Live chat widget
- Translations (English only)
- Payment processing on `/pricing` (still "Contact sales" / signup CTA)
- Any changes to hospital/doctor/patient portals

### Files touched

**New**
- `src/pages/About.tsx`, `Services.tsx`, `Features.tsx`, `Pricing.tsx`, `FAQ.tsx`, `Contact.tsx`
- `src/components/landing/PageHero.tsx` (shared page header)
- `src/components/landing/PageMeta.tsx` (title/description)
- `src/components/landing/MobileMenu.tsx`
- `supabase/migrations/<ts>_contact_messages.sql`

**Edited**
- `src/App.tsx` (routes)
- `src/components/landing/Nav.tsx` + `Footer.tsx` (route links, mobile menu)
- `src/pages/Landing.tsx` (trim duplicated sections, keep Hero + condensed teasers + CTA)

**Removed/inlined**
- The standalone section components (`About.tsx`, `Services.tsx`, `Contact.tsx` under `components/landing/`) get superseded by the new full pages and can be deleted or kept as small teaser variants on the home page — I'll keep slim teaser versions on `/` and put the full content on the dedicated pages.
