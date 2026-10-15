import { LegalPage } from "@/components/marketing/LegalPage";
import { SUPPORT_EMAIL } from "@/components/marketing/content";

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy policy"
      description="How HealingNet collects, uses and protects your personal and health information."
      updated="15 October 2026"
    >
      {/* DRAFT: needs legal review */}
      <p>This policy explains what information HealingNet collects, why we collect it, and the choices you have. We built HealingNet to follow the Nigeria Data Protection Act 2023 (NDPA).</p>

      <h2>Who we are</h2>
      <p>HealingNet is a telemedicine and hospital software service that connects patients, doctors and hospitals in Nigeria. You can contact us about privacy at <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary underline">{SUPPORT_EMAIL}</a>.</p>

      <h2>What we collect</h2>
      <ul>
        <li>Account details: your name, email address, phone number and role (patient, doctor or hospital).</li>
        <li>Health information you or your care team add: symptoms, consultation notes, prescriptions, lab results and letters.</li>
        <li>For doctors: licence details, so we can check them with the issuing council.</li>
        <li>For hospitals: hospital details, staff accounts and subscription information.</li>
        <li>Payment records. Card details are handled by our payment provider, Paystack, not stored by HealingNet.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To provide the service: bookings, consultations, records and billing.</li>
        <li>To keep the service safe, including checking doctors' licences.</li>
        <li>To contact you about your account, bookings and payments.</li>
      </ul>

      <h2>Who can see your health records</h2>
      <p>Your records are encrypted. They are shared with the hospital and doctors caring for you. To share them with another hospital, you create a one-time share code that expires after 15 minutes.</p>

      <h2>Your rights</h2>
      <p>Under the NDPA you can ask to see, correct or delete your personal information, and object to some uses of it. Email us and we'll respond as the law requires.</p>

      <h2>How long we keep information</h2>
      <p>We keep medical records for as long as the law and your hospital's obligations require, and other information only as long as we need it.</p>

      <h2>Changes</h2>
      <p>If we change this policy we'll update this page and the date above.</p>
    </LegalPage>
  );
}
