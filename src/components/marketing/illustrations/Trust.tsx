import { Illustration, fill, type IllustrationProps } from "./Illustration";

// Small spot illustrations for the trust tiles (viewBox 64x64).
const vb = "0 0 64 64";

/** Licence checked: a certificate with a tick. */
export function LicenceIllustration(props: IllustrationProps) {
  return (
    <Illustration viewBox={vb} {...props}>
      <circle cx="32" cy="32" r="28" fill={fill.soft} stroke="none" />
      <rect x="16" y="14" width="32" height="36" rx="5" fill={fill.card} />
      <path d="M23 24h18M23 31h12" />
      <circle cx="42" cy="44" r="9" fill={fill.primary} stroke="none" />
      <path d="M38 44l3 3 5-6" stroke={fill.card} />
    </Illustration>
  );
}

/** Pay in naira: a card with the naira sign. */
export function NairaIllustration(props: IllustrationProps) {
  return (
    <Illustration viewBox={vb} {...props}>
      <circle cx="32" cy="32" r="28" fill={fill.soft} stroke="none" />
      <rect x="12" y="20" width="40" height="26" rx="5" fill={fill.card} />
      <path d="M12 28h40" />
      <path d="M22 36v8M22 36l8 8v-8M19 39h14M19 42h14" strokeWidth={2} />
      <circle cx="44" cy="40" r="3" fill={fill.accent} stroke="none" />
    </Illustration>
  );
}

/** Share codes: a padlock with a short code. */
export function ShareCodeIllustration(props: IllustrationProps) {
  return (
    <Illustration viewBox={vb} {...props}>
      <circle cx="32" cy="32" r="28" fill={fill.soft} stroke="none" />
      <path d="M23 28v-6a9 9 0 0118 0v6" />
      <rect x="16" y="28" width="32" height="22" rx="5" fill={fill.card} />
      <circle cx="25" cy="39" r="2" fill="currentColor" stroke="none" />
      <circle cx="32" cy="39" r="2" fill="currentColor" stroke="none" />
      <circle cx="39" cy="39" r="2" fill={fill.accent} stroke="none" />
    </Illustration>
  );
}

/** Works in the browser: a phone with a globe. */
export function BrowserIllustration(props: IllustrationProps) {
  return (
    <Illustration viewBox={vb} {...props}>
      <circle cx="32" cy="32" r="28" fill={fill.soft} stroke="none" />
      <rect x="21" y="10" width="22" height="44" rx="5" fill={fill.card} />
      <circle cx="32" cy="31" r="7" />
      <path d="M25 31h14M32 24c3 4 3 10 0 14M32 24c-3 4-3 10 0 14" strokeWidth={1.8} />
      <path d="M29 48h6" />
    </Illustration>
  );
}

/** Data protection: a shield with a tick. */
export function ShieldIllustration(props: IllustrationProps) {
  return (
    <Illustration viewBox={vb} {...props}>
      <circle cx="32" cy="32" r="28" fill={fill.soft} stroke="none" />
      <path d="M32 10l17 6v13c0 11-7 19-17 24-10-5-17-13-17-24V16l17-6z" fill={fill.card} />
      <path d="M25 32l5 5 9-10" />
    </Illustration>
  );
}

/** Triage: a compass pointing the way. */
export function CompassIllustration(props: IllustrationProps) {
  return (
    <Illustration viewBox={vb} {...props}>
      <circle cx="32" cy="32" r="28" fill={fill.soft} stroke="none" />
      <circle cx="32" cy="32" r="18" fill={fill.card} />
      <path d="M38 26l-4 10-8 2 4-10 8-2z" fill={fill.accent} strokeWidth={2} />
      <circle cx="32" cy="32" r="1.5" fill="currentColor" stroke="none" />
    </Illustration>
  );
}

/** Video and in-person: a camera and a building. */
export function VisitsIllustration(props: IllustrationProps) {
  return (
    <Illustration viewBox={vb} {...props}>
      <circle cx="32" cy="32" r="28" fill={fill.soft} stroke="none" />
      <rect x="10" y="22" width="24" height="18" rx="4" fill={fill.card} />
      <path d="M34 28l7-4v14l-7-4" />
      <rect x="38" y="34" width="16" height="16" rx="3" fill={fill.card} />
      <path d="M46 38v8M42 42h8" stroke={fill.accent} />
    </Illustration>
  );
}
