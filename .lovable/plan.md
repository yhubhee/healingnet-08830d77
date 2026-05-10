# Fix `/` route + expand landing page

## Root cause

`index.html` currently contains the entire legacy static hospital dashboard (sidebar, hardcoded "Amara Obi / Yusuf Bello / Ngozi Eze" queue, etc.) instead of being a Vite entry point. Because `index.html` is what Vite serves at `/`, the React `<Landing />` route in `App.tsx` never mounts. That's why you still see the hardcoded names.

## Changes

### 1. Rewrite `index.html` (clean React entry)
Replace the 568-line legacy markup with a standard Vite + React shell:
- Proper SEO `<title>`, meta description, OG tags for HealingNet
- Single `<div id="root"></div>` and `<script type="module" src="/src/main.tsx"></script>`
- Remove all `<link>` to deleted `/export/*.css`, all sidebar/queue/doctor markup, and the `lucide@latest` CDN script
- Keep favicon + viewport meta

Result: `/` will now render the React `<Landing />` component (already wired in `App.tsx`).

### 2. Expand the Landing page

`src/pages/Landing.tsx` currently composes: Nav, Hero, Audiences, Features, HowItWorks, Pricing, FAQ, Footer. Add:

- **`src/components/landing/About.tsx`** — "About HealingNet" section: mission, the problem in Nigerian healthcare (queue chaos, paper records, fragmented care), the solution, key stats. Anchor `#about`.
- **`src/components/landing/Services.tsx`** — Service catalog grouped by audience:
  - For Hospitals: EMR, Queue, Billing, Lab, Pharmacy, Maternity, Surgery, Insurance, Bed Mgmt, Analytics
  - For Doctors: Patient roster, e-Prescriptions, Lab orders, Teleconsult, External consult marketplace
  - For Patients: Book appointments, AI triage, Medical records, Lab results, Prescriptions refills, Messaging
  Anchor `#services`.
- **`src/components/landing/Contact.tsx`** — Simple contact block (email, phone placeholder, "Book a demo" CTA → `/signup`). Anchor `#contact`.

### 3. Update `Nav.tsx`
Add nav links: Home (`/`), About (`#about`), Services (`#services`), Features (`#features`), Pricing (`#pricing`), FAQ (`#faq`), Contact (`#contact`). Keep Login / Get Started buttons.

### 4. Update `Footer.tsx`
Add the same anchor links in footer columns so About/Services/Contact are reachable from the footer.

### 5. Update `Landing.tsx`
Compose new order: Nav → Hero → About → Audiences → Services → Features → HowItWorks → Pricing → FAQ → Contact → Footer.

## Out of scope
- No backend, schema, or hospital/doctor/patient dashboard changes.
- No real contact form submission (CTA links to signup / mailto).
- Brand colors and tokens already defined in `index.css` are reused — no design system changes.

## Files touched
- Rewrite: `index.html`
- Edit: `src/pages/Landing.tsx`, `src/components/landing/Nav.tsx`, `src/components/landing/Footer.tsx`
- Create: `src/components/landing/About.tsx`, `src/components/landing/Services.tsx`, `src/components/landing/Contact.tsx`
