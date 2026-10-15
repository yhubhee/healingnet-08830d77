import { EMERGENCY_LINE } from "./content";

export interface Faq {
  q: string;
  a: string;
}

export const PATIENT_FAQS: Faq[] = [
  { q: "Do patients pay to use HealingNet?", a: "No. Creating an account and using HealingNet is free for patients. Any charge for your visit is set by the hospital you choose." },
  { q: "Are the doctors real and qualified?", a: "Yes. A doctor's licence is checked against the council that issued it before they can see patients on HealingNet." },
  { q: "Can I see a doctor by video?", a: "Yes, at hospitals that offer video visits. When you book, you'll see which hospitals and doctors offer video and which are in person only." },
  { q: "Is the triage assistant a diagnosis?", a: `No. It asks about your symptoms and suggests the right kind of doctor and how soon to be seen. It helps you decide where to go; it is not a diagnosis. ${EMERGENCY_LINE}` },
  { q: "Do I need to download an app?", a: "No. HealingNet works in the browser on any smartphone, tablet or computer." },
  { q: "Who can see my medical records?", a: "You and the care team treating you. To share your records with another hospital, you give it a one-time share code that expires after 15 minutes." },
];

export const HOSPITAL_FAQS: Faq[] = [
  { q: "How long is the free trial?", a: "30 days, starting the day you sign up. No card is needed." },
  { q: "What's included in the trial?", a: "Everything in EMR Essentials. Video consultations, consultation requests and the doctor marketplace need the Telemedicine Suite." },
  { q: "Can I skip the trial and pay straight away?", a: "Yes. Choose the Telemedicine Suite when you sign up, or subscribe to either plan any time from Settings → Subscription. Your paid period starts on the day you pay." },
  { q: "What happens when the trial ends?", a: "Your records stay safe. EMR features pause until you subscribe, and you can subscribe at any time." },
  { q: "Is there a limit on staff?", a: "EMR Essentials, including the free trial, allows up to 25 team members. That counts staff accounts (admins, nurses, reception, lab, pharmacy, managers) and doctors linked to your hospital, plus invitations still waiting for a reply. Telemedicine Suite has no limit. If you go over 25 on Telemedicine and later move to EMR, nobody loses access, but you can't add anyone until you're back under 25." },
  { q: "When can patients find and book my hospital?", a: "After HealingNet has verified your hospital, usually within 1–2 working days. You can set up and use the EMR while you wait. This applies during the trial too." },
];

export const DOCTOR_FAQS: Faq[] = [
  { q: "How is my licence verified?", a: "You add your licence details and we check them against the council that issued your licence. You can see patients once it's verified." },
  { q: "Can I work with more than one hospital?", a: "Yes. A hospital can invite you, and you can work with one or more hospitals from the same account." },
  { q: "Who sets my availability?", a: "You do. Set the days and hours you work at each hospital, and whether you take video visits, in-person visits or both." },
  { q: "Can I do video consultations?", a: "Yes, at hospitals on the Telemedicine Suite. You can also write consultation notes, prescriptions and medical letters in HealingNet." },
  { q: "Does it cost doctors anything?", a: "No. Hospitals pay for HealingNet; doctors don't." },
];

export const PAYMENT_FAQS: Faq[] = [
  { q: "How do I pay?", a: "Payments go through Paystack, in naira. You can pay with a card or the other options Paystack shows at checkout." },
  { q: "Do I get an invoice?", a: "Your plan and its end date are shown in Settings → Subscription. If you need an invoice for your records, email us at support.healingnet@gmail.com." },
  { q: "Can we cancel?", a: "Plans don't renew automatically. Each payment covers a month or a year. If you don't renew, paid features stop at the end of that period and your records are kept." },
  { q: "Do we need a card for the free trial?", a: "No. The 30-day EMR Essentials trial starts when you sign up, with no card needed." },
  { q: "How is my data protected?", a: "Records are encrypted and shared only with the patient's consent, using one-time share codes that expire in 15 minutes. HealingNet is built to follow the Nigeria Data Protection Act 2023." },
];

/** Top five for the home page. */
export const HOME_FAQS: Faq[] = [
  PATIENT_FAQS[0],
  PATIENT_FAQS[1],
  PATIENT_FAQS[2],
  PATIENT_FAQS[3],
  HOSPITAL_FAQS[0],
];
