import { Illustration, fill, type IllustrationProps } from "./Illustration";

/** 404: a page resting under a blanket with a thermometer ("This page took a sick day"). */
export function SickDayIllustration(props: IllustrationProps) {
  return (
    <Illustration viewBox="0 0 200 150" {...props}>
      <ellipse cx="100" cy="132" rx="78" ry="8" fill={fill.soft} stroke="none" />
      <rect x="40" y="70" width="120" height="58" rx="14" fill={fill.sand} />
      <rect x="62" y="22" width="76" height="72" rx="10" fill={fill.card} />
      <path d="M84 50c2-3 6-3 8 0M108 50c2-3 6-3 8 0" />
      <path d="M92 68c5-3 11-3 16 0" />
      <path d="M40 92c20-10 40-10 60 0s40 10 60 0v22a14 14 0 01-14 14H54a14 14 0 01-14-14V92z" fill={fill.mid} />
      <rect x="128" y="56" width="8" height="34" rx="4" transform="rotate(35 132 73)" fill={fill.card} />
      <circle cx="141" cy="86" r="6" fill={fill.accent} stroke="none" />
      <path d="M150 24l6-6M158 34h8M146 14v-6" opacity="0.6" />
    </Illustration>
  );
}

/** Empty states: an open folder. */
export function EmptyIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <circle cx="80" cy="64" r="44" fill={fill.soft} stroke="none" />
      <path d="M40 44h26l8 8h46v46a6 6 0 01-6 6H46a6 6 0 01-6-6V44z" fill={fill.card} />
      <path d="M40 62h80" />
      <circle cx="112" cy="36" r="5" fill={fill.accent} stroke="none" />
    </Illustration>
  );
}

/** Fallback for a photo slot whose download failed: a calm consultation scene. */
export function CareIllustration(props: IllustrationProps) {
  return (
    <Illustration viewBox="0 0 160 120" {...props}>
      <rect x="0" y="0" width="160" height="120" fill={fill.sand} stroke="none" />
      <circle cx="80" cy="60" r="44" fill={fill.soft} stroke="none" />
      <circle cx="62" cy="48" r="10" fill={fill.card} />
      <path d="M46 86c2-12 9-18 16-18s14 6 16 18" fill={fill.card} />
      <circle cx="100" cy="48" r="10" fill={fill.mid} />
      <path d="M84 86c2-12 9-18 16-18s14 6 16 18" fill={fill.mid} />
      <path d="M94 74c0 6 12 6 12 0" />
      <circle cx="120" cy="30" r="5" fill={fill.accent} stroke="none" />
    </Illustration>
  );
}
