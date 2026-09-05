# Where the three dashboards are still unfinished

I went through every page of the hospital, doctor and patient dashboards. The good news: almost everything is wired to real data — there are no fake/demo lists left anywhere. The gaps are these.

## Confirmed problems

**Hospital dashboard**
- Log out does not work. Both the "Log out" item in the top-right profile menu and the "Logout" button at the bottom of the side menu do nothing when clicked. Hospital staff currently have no way to sign out.
- The side menu has a "Teleconsultation" item that leads to a page that does not exist — clicking it shows the "page not found" screen. The working page is "Consultations".
- "Upgrade to Telemedicine" in Settings only shows a "Contact Sales" message. Now that paid plans and Paystack are live, it should start a real upgrade payment.
- Most list pages (patients, beds, lab, insurance, maternity, surgery, referrals, queue, staff table in settings) turn into a sideways-scrolling table on a phone. Billing and Pharmacy already have proper phone-friendly cards; the rest do not.

**Doctor dashboard**
- The patients list and prescriptions list also scroll sideways on a phone instead of showing cards.
- Most pages show nothing at all while data is loading, so the screen looks empty for a moment before filling in.

**Patient dashboard**
- The lab results table has no phone layout and can overflow the screen edge.
- Loading behaviour is inconsistent — medical records shows a spinner, the other pages show nothing.

**All three dashboards**
- Nothing anywhere handles a failed request. If the backend blocks or fails a read, the page shows "no records yet" — identical to genuinely having no data. This is why past access problems were hard to spot, and it will hide the next one too.

## Proposed fix order

1. Hospital log out (both places) and remove/redirect the dead Teleconsultation menu item.
2. A shared "couldn't load this" state, applied across the pages of all three dashboards, so a blocked or failed read is visible instead of looking empty.
3. Consistent loading placeholders on the pages that currently show nothing.
4. Phone-friendly card layouts for the remaining tables, matching the pattern already used in Billing and Pharmacy.
5. Wire "Upgrade to Telemedicine" to the existing Paystack checkout instead of the Contact Sales message.

## Technical notes

- `HospitalHeader.tsx:209` and `HospitalSidebar.tsx:295` need the `signOut` handler used by the doctor/patient shells.
- `HospitalSidebar.tsx:82` points at `/hospital/teleconsult`, unregistered in `App.tsx`; `/hospital/consultations` is the real route (plan-gated).
- Add a `QueryState` wrapper component (loading skeleton + error card with retry) and use `isError`/`error` from the existing React Query hooks — `isError` is currently used in zero files.
- Mobile pattern to copy: `hidden lg:block` table + `lg:hidden` card list, as in `Billing.tsx:73` and `Pharmacy.tsx:60`.
- Upgrade flow can reuse `paystack-initialize` with `purpose: 'subscription'` and the existing `/hospital/confirming-payment` page.

Out of scope: new features, schema changes, pricing changes.
