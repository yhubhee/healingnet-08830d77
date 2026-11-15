import { Link } from "react-router-dom";
import { LegalPage } from "@/components/marketing/LegalPage";
import { SUPPORT_EMAIL } from "@/components/marketing/content";

/*
 * NOTE FOR BHEE (not shown on the page): this is a DRAFT and a lawyer should review it
 * before the app goes on the Play Store. It describes what the website and the app do
 * today. Things to check with the lawyer and to confirm yourself:
 *   - the legal name and address of the company that runs HealingNet (not stated yet);
 *   - whether a Data Protection Officer must be named, and registration with the NDPC;
 *   - how long each kind of record is kept (only described in general terms below);
 *   - the name of the email delivery provider (emails are sent over SMTP; the provider is
 *     set in the server's settings, so it is not named here);
 *   - whether guardians need anything more than the tick box for adult family members;
 *   - family verification documents (birth and marriage certificates, court orders): the
 *     lawful basis for asking, how long an approved document is kept, and who on the
 *     team may open them;
 *   - speed data: whether sharing it by default (with a switch to turn it off) is acceptable.
 * It makes no claim of certification or compliance. Keep it that way unless that changes.
 * The Play Store listing links to this page, and to /delete-account.
 */
export default function Privacy() {
  const mail = <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary underline">{SUPPORT_EMAIL}</a>;
  return (
    <LegalPage
      title="Privacy policy"
      description="How HealingNet collects, uses and protects your personal and health information, on the website and in the app."
      updated="14 November 2026"
    >
      <p>This policy explains what information HealingNet collects, why, who handles it, and the choices you have. It covers the HealingNet website and the HealingNet patient app for Android.</p>

      <h2>Who we are</h2>
      <p>HealingNet is a telemedicine and hospital software service that connects patients, doctors, pharmacies and hospitals in Nigeria. You can contact us about privacy at {mail}.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email address, phone number, date of birth, sex, address, emergency contact, and your role (patient, doctor, hospital or pharmacy). A profile photo if you add one.</li>
        <li><strong>Health card:</strong> blood group, genotype, allergies and long-term conditions, if you enter them.</li>
        <li><strong>Health records from hospitals:</strong> appointments, consultation notes, prescriptions, lab results and letters that the hospitals and doctors treating you add to your record.</li>
        <li><strong>Symptom checks:</strong> the answers you give in the symptom checker and the guidance it returns. These are saved so the doctor you book can see them. The symptom checker gives guidance; it does not diagnose.</li>
        <li><strong>Messages</strong> between you and your doctor, and ratings you give after a visit or a pharmacy collection.</li>
        <li><strong>Location, only if you allow it:</strong> used to show how far hospitals are from you, and saved with a symptom check. You can use HealingNet without it.</li>
        <li><strong>Push device tokens (app):</strong> an identifier for your phone, so we can send it notifications, with the app version and whether it is Android or iPhone.</li>
        <li><strong>For doctors and pharmacists:</strong> licence details, so they can be checked.</li>
        <li><strong>For hospitals and pharmacies:</strong> organisation details, staff accounts and subscription information.</li>
        <li><strong>Payment records.</strong> Card details are entered with our payment provider, Paystack, and are not stored by HealingNet.</li>
      </ul>
      <p>The app asks for the camera and photos only to set a profile picture and to send a document that proves a family relationship, and for the calendar only when you ask it to add an appointment.</p>

      <h2>Family profiles</h2>
      <p>A patient can add family members, such as children or elderly parents, and manage their health care from their own account. If you do this:</p>
      <ul>
        <li>You enter the family member's name, date of birth, sex and how they are related to you. You can then book visits for them and see their prescriptions, lab results, records and letters.</li>
        <li>You are responsible for the information you enter about them and for acting in their interest.</li>
        <li>For anyone aged 18 or over, you must confirm that you have their permission to manage their health care on HealingNet. We record that you confirmed it and when.</li>
        <li>Children do not have their own accounts. HealingNet accounts are for adults.</li>
        <li>You can remove a family member at any time in Settings. Their open appointments are cancelled. If a hospital has treated them, that hospital keeps its medical records.</li>
      </ul>

      <h3>Proving a family relationship</h3>
      <p>A family member's health records are sensitive, so we ask you to show that you are who you say you are to them. For each family member you add, we ask for one legal document that proves the relationship: for example a birth certificate, a marriage certificate, an adoption or guardianship order, or a sworn affidavit.</p>
      <ul>
        <li><strong>Why we ask.</strong> To stop someone adding a person they have no right to act for and then reading or changing that person's health records.</li>
        <li><strong>Who sees it.</strong> Only you and HealingNet's verification team. Hospitals, doctors and pharmacies never see it. A team member opens it only to check it, through a link that stops working after 5 minutes, and every decision is recorded.</li>
        <li><strong>How it is stored.</strong> Privately, in storage that is not open to the public, in a folder that only your account and the verification team can read.</li>
        <li><strong>What happens if you do not send one.</strong> You have 3 days after adding a family member. After that, or if a document is not accepted, that family member is locked: you cannot see or change their records or book for them until a document is accepted. We tell you the reason when a document is not accepted.</li>
        <li><strong>When it is deleted.</strong> When you remove the family member, their documents are deleted, except one that is still being checked or has been approved, which is kept as the record of that check.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To provide the service: bookings, consultations, prescriptions, records, reminders and billing.</li>
        <li>To keep the service safe, including checking licences.</li>
        <li>To contact you about your account, bookings, results and payments, by email, in the app and by push notification.</li>
      </ul>
      <p>We do not sell your information, and we do not use your health information for advertising.</p>

      <h2>Speed data</h2>
      <p>To find and fix slow screens, the app and the website measure how long screens, requests and start-up take, and send us those measurements.</p>
      <ul>
        <li><strong>What it is.</strong> The kind of screen or request (for example "Visits" or "load prescriptions", never which visit or which prescription), how long it took, whether it worked, the app version, whether it was Android, iPhone or the website, and whether the phone was on Wi-Fi or mobile data.</li>
        <li><strong>What it is not.</strong> It has no personal or health information: no name, no account or record number, no address of a page with an id in it, and nothing you typed. It is not stored against your account.</li>
        <li><strong>How long we keep it.</strong> 30 days, then it is removed.</li>
        <li><strong>Turning it off.</strong> In the app, go to Me, then Settings, and turn off "Share speed data". On the website, go to Settings, then Privacy. When it is off, nothing is measured or sent.</li>
      </ul>

      <h2>Push notifications</h2>
      <p>If you allow notifications, the app tells you about things like a confirmed appointment or a ready lab result. By default the text on your lock screen is general (for example "Open HealingNet to see the details") and does not show health details. You can choose to show details, choose which kinds of alerts you get, or turn notifications off, in the app's settings. Notifications about a family member come to you; inside the app, and on the lock screen only if you chose to show details, they begin with their first name.</p>

      <h2>What is stored on your phone</h2>
      <ul>
        <li>So the app opens quickly and works without a signal, it keeps a copy of your profile, appointments, prescriptions, lab results and records on the phone. This copy is encrypted.</li>
        <li>Medicine reminders you set are kept on the phone only and are not sent to us.</li>
        <li>When you sign out or delete your account, the saved copy, the reminders and the phone's notification registration are cleared from that phone.</li>
        <li>You can turn on App lock to ask for your fingerprint, face or passcode when the app is opened.</li>
      </ul>
      <p>The website keeps your sign-in and a few preferences in your browser's storage.</p>

      <h2>Who can see your health records</h2>
      <p>Your records can be seen by you, by the hospitals and doctors caring for you, and by a pharmacy you send a prescription to (that prescription only). To share your records with another hospital, you create a one-time code that expires after 15 minutes. Information travels between your device and our servers over encrypted connections.</p>

      <h2>Companies that process data for us</h2>
      <ul>
        <li><strong>Supabase:</strong> the database, sign-in and file storage where HealingNet's information is kept.</li>
        <li><strong>Vercel:</strong> hosts the website.</li>
        <li><strong>Expo and Google Firebase:</strong> deliver push notifications to the app. They receive the phone's push token and the notification text.</li>
        <li><strong>Daily:</strong> carries video calls between you and your doctor.</li>
        <li><strong>Paystack:</strong> handles payments made by hospitals.</li>
        <li><strong>Google:</strong> if you choose "Continue with Google" to sign in.</li>
        <li>An email delivery provider, to send account and appointment emails.</li>
      </ul>
      <p>Some of these companies store or handle information outside Nigeria.</p>

      <h2>Deleting your account</h2>
      <p>You can delete your account in the app (Me, then Delete my account) or on the <Link to="/delete-account" className="font-semibold text-primary underline">delete account page</Link>. Your login, contact details, devices and notifications are deleted, and open appointments are cancelled. Family members you added are removed too. If you or a family member have been treated at a hospital on HealingNet, that hospital keeps its medical records, as it is required to; they are no longer linked to an account.</p>

      <h2>Your rights</h2>
      <p>The Nigeria Data Protection Act 2023 gives you rights over your personal information, including to see it, to have it corrected or deleted, to object to some uses of it, and to withdraw permission you have given. You can also complain to the Nigeria Data Protection Commission. To use your rights, email {mail} and we will respond as the law requires.</p>

      <h2>How long we keep information</h2>
      <p>We keep account information while your account is open. Hospitals keep medical records for as long as the law and their own obligations require. Push notification records are removed after about 30 days. Speed data is removed after 30 days. Family verification documents are kept as described under "Proving a family relationship".</p>

      <h2>Children</h2>
      <p>HealingNet is for adults aged 18 and over. Information about a child is only held when a parent or guardian adds the child as a family member, or when a hospital treats the child.</p>

      <h2>Changes</h2>
      <p>If we change this policy we'll update this page and the date above.</p>
    </LegalPage>
  );
}
