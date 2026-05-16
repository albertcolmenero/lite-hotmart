/**
 * Editorial line illustrations for empty states.
 *
 * All drawn in --ink with --ember used for a small accent (a corner,
 * a fold, a marginal note). They behave like a magazine plate, not a
 * vector-art tool generic.
 *
 * Pixel grid 160×120; rendered with `width: 100%` and a max-w in callers.
 */

type Props = { className?: string };

const stroke = "var(--ink)";
const ember = "var(--accent)";
const lichen = "var(--lichen)";

export function PosterFold({ className }: Props) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke={stroke}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* paper */}
      <path d="M28 18 H132 V102 H28 Z" fill="var(--paper)" />
      {/* horizontal fold */}
      <path d="M28 60 H132" />
      {/* corner curl */}
      <path d="M132 102 L120 102 L132 90 Z" fill="var(--stone)" />
      {/* film stamps */}
      <rect x="38" y="28" width="42" height="22" />
      <circle cx="49" cy="39" r="3" />
      <path d="M88 28 H120 M88 36 H120 M88 44 H110" stroke={lichen} />
      {/* lower band */}
      <path d="M38 72 H92" />
      <path d="M38 80 H82" stroke={lichen} />
      {/* ember dot */}
      <circle cx="118" cy="78" r="3.5" fill={ember} stroke="none" />
    </svg>
  );
}

export function StackedBooks({ className }: Props) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke={stroke}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* book 1 (back, tilted) */}
      <g transform="rotate(-4 80 90)">
        <rect x="36" y="78" width="92" height="14" fill="var(--stone)" />
        <path d="M48 78 V92 M120 78 V92" />
        <path d="M58 85 H100" stroke={lichen} />
      </g>
      {/* book 2 (middle) */}
      <rect x="30" y="60" width="100" height="14" fill="var(--paper)" />
      <path d="M44 60 V74 M114 60 V74" />
      <path d="M54 67 H106" stroke={lichen} />
      {/* book 3 (top, slim, ember spine) */}
      <rect x="42" y="42" width="76" height="14" fill="var(--paper)" />
      <rect x="42" y="42" width="6" height="14" fill={ember} stroke="none" />
      <path d="M64 49 H110" stroke={lichen} />
      {/* bookmark coming out */}
      <path d="M86 42 V32 L90 36 L94 32 V42" fill={ember} stroke={ember} />
    </svg>
  );
}

export function GraduationWave({ className }: Props) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke={stroke}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* paper wave under */}
      <path d="M16 88 Q40 76 64 86 T112 86 T144 84" stroke={lichen} />
      <path d="M16 96 Q40 84 64 94 T112 94 T144 92" stroke={lichen} />
      {/* mortarboard */}
      <path d="M40 60 L80 46 L120 60 L80 74 Z" fill="var(--paper)" />
      <path d="M80 46 V74" stroke={lichen} />
      {/* base */}
      <path d="M60 66 V76 Q60 84 80 84 Q100 84 100 76 V66" />
      {/* tassel + ember bead */}
      <path d="M120 60 L124 80" />
      <circle cx="124" cy="82" r="3.5" fill={ember} stroke="none" />
    </svg>
  );
}

export function EnvelopeOpen({ className }: Props) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke={stroke}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* envelope body */}
      <path d="M28 50 H132 V96 H28 Z" fill="var(--paper)" />
      {/* flap open */}
      <path d="M28 50 L80 26 L132 50" fill="var(--stone)" />
      {/* letter peeking */}
      <path d="M44 60 H116 V92 H44 Z" fill="var(--paper)" />
      <path d="M52 70 H108 M52 78 H100 M52 86 H88" stroke={lichen} />
      {/* ember wax seal */}
      <circle cx="80" cy="68" r="6" fill={ember} stroke="none" />
      <path d="M76 68 L80 72 L84 66" stroke="var(--paper)" strokeWidth="1.5" />
    </svg>
  );
}

export function BookmarkRibbon({ className }: Props) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke={stroke}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* page */}
      <path d="M36 18 H124 V102 H36 Z" fill="var(--paper)" />
      <path d="M50 36 H110 M50 46 H110 M50 56 H100 M50 66 H92 M50 76 H110" stroke={lichen} />
      {/* ribbon ember */}
      <path d="M96 12 H116 V44 L106 36 L96 44 Z" fill={ember} stroke={ember} />
    </svg>
  );
}

export function BarsRising({ className }: Props) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke={stroke}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* axis */}
      <path d="M28 96 H136 M28 96 V24" stroke={lichen} />
      {/* bars */}
      <rect x="42" y="80" width="14" height="16" fill="var(--stone)" />
      <rect x="64" y="68" width="14" height="28" fill="var(--stone)" />
      <rect x="86" y="54" width="14" height="42" fill="var(--paper)" />
      <rect x="108" y="38" width="14" height="58" fill={ember} stroke={ember} />
      {/* trend line */}
      <path d="M49 80 L71 68 L93 54 L115 38" stroke={stroke} />
      <circle cx="115" cy="38" r="2.5" fill={ember} stroke="none" />
    </svg>
  );
}

export function TagFolio({ className }: Props) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke={stroke}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* big tag */}
      <path d="M28 32 H92 L116 56 L92 80 H28 Z" fill="var(--paper)" />
      <circle cx="42" cy="56" r="4" />
      <path d="M52 50 H82 M52 58 H78" stroke={lichen} />
      {/* small ember tag */}
      <path d="M66 78 H110 L126 92 L110 106 H66 Z" fill={ember} stroke={ember} />
    </svg>
  );
}
