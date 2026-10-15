import { LegalPage } from "@/components/marketing/LegalPage";
import { SUPPORT_EMAIL } from "@/components/marketing/content";

export default function Terms() {
  return (
    <LegalPage
      title="Terms of use"
      description="The terms for using HealingNet as a patient, doctor or hospital."
      updated="15 October 2026"
    >
      {/* DRAFT: needs legal review */}
      <p>These terms apply when you use HealingNet. By creating an account you agree to them.</p>

      <h2>Not for emergencies</h2>
      <p>HealingNet is not an emergency service. If you have a medical emergency, call 112 or go to the nearest hospital.</p>

      <h2>Medical advice</h2>
      <p>Doctors on HealingNet are responsible for the care they give. The triage assistant gives general guidance about which kind of doctor to see and how soon. It is not a diagnosis and does not replace a doctor.</p>

      <h2>Your account</h2>
      <ul>
        <li>Give accurate information and keep your password safe.</li>
        <li>Doctors must hold a valid licence and keep their details up to date.</li>
        <li>Hospitals are responsible for the staff and doctors they add to their account.</li>
      </ul>

      <h2>Hospital plans and payments</h2>
      <ul>
        <li>New hospitals get a 30-day free trial of EMR Essentials. No card is needed. When it ends, EMR features pause until the hospital subscribes. Its data is kept.</li>
        <li>The Telemedicine Suite is not part of the free trial and is paid from the start.</li>
        <li>EMR Essentials, including the trial, allows up to 25 team members. The Telemedicine Suite has no limit.</li>
        <li>Payments are made in naira through Paystack. Plans don't renew automatically.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Don't misuse HealingNet, try to access other people's information, or use it for anything unlawful.</p>

      <h2>Contact</h2>
      <p>Questions about these terms: <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary underline">{SUPPORT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
