import { Illustration, fill, type IllustrationProps } from "./Illustration";

/** Step 1: tell us what's wrong (a phone with a chat). */
export function TellUsIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <circle cx="80" cy="64" r="48" fill={fill.soft} stroke="none" />
      <rect x="56" y="18" width="48" height="90" rx="10" fill={fill.card} />
      <path d="M72 26h16" />
      <rect x="63" y="38" width="30" height="12" rx="6" fill={fill.mid} stroke="none" />
      <rect x="67" y="56" width="30" height="12" rx="6" fill={fill.accent} stroke="none" />
      <rect x="63" y="74" width="22" height="12" rx="6" fill={fill.mid} stroke="none" />
      <circle cx="80" cy="98" r="3" fill="currentColor" stroke="none" />
      <path d="M116 34c6 3 9 9 9 15M120 26c10 5 15 14 15 24" opacity="0.6" />
    </Illustration>
  );
}

/** Step 2: choose a hospital and doctor (a map pin over a hospital). */
export function ChooseIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <circle cx="80" cy="64" r="48" fill={fill.soft} stroke="none" />
      <path d="M30 104h100" />
      <rect x="46" y="54" width="68" height="50" rx="6" fill={fill.card} />
      <rect x="70" y="80" width="20" height="24" rx="3" fill={fill.mid} />
      <rect x="54" y="64" width="10" height="10" rx="2" />
      <rect x="96" y="64" width="10" height="10" rx="2" />
      <path d="M80 62v10M75 67h10" stroke={fill.accent} strokeWidth={3} />
      <path d="M118 14c-9 0-16 7-16 16 0 12 16 26 16 26s16-14 16-26c0-9-7-16-16-16z" fill={fill.card} />
      <circle cx="118" cy="30" r="5" fill={fill.accent} stroke="none" />
    </Illustration>
  );
}

/** Step 3: meet in person or by video (a video screen with a doctor). */
export function MeetIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <circle cx="80" cy="64" r="48" fill={fill.soft} stroke="none" />
      <rect x="28" y="26" width="104" height="70" rx="10" fill={fill.card} />
      <circle cx="80" cy="54" r="12" fill={fill.mid} />
      <path d="M58 90c3-12 12-18 22-18s19 6 22 18" fill={fill.mid} />
      <path d="M74 72l6 8 6-8" />
      <rect x="104" y="34" width="20" height="16" rx="4" fill={fill.sand} />
      <path d="M62 106h36M80 96v10" />
      <circle cx="116" cy="84" r="5" fill={fill.accent} stroke="none" />
    </Illustration>
  );
}
