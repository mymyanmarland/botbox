// BotBox logo — a cute little robot head.
export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={className}>
      <defs>
        <linearGradient id="botbox-logo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff5c6c" />
          <stop offset="100%" stopColor="#c11124" />
        </linearGradient>
      </defs>
      {/* squircle */}
      <rect x="1.5" y="1.5" width="61" height="61" rx="17" fill="url(#botbox-logo-bg)" />
      <ellipse cx="22" cy="12" rx="14" ry="7" fill="#ffffff" opacity="0.16" />
      {/* antenna */}
      <line x1="32" y1="21" x2="32" y2="12.5" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
      {/* heart tip */}
      <path
        d="M32 13 C27.5 9.5 24 7 24 4.2 C24 2.2 25.8 1 27.8 1 C29.8 1 31.2 2.2 32 3.6 C32.8 2.2 34.2 1 36.2 1 C38.2 1 40 2.2 40 4.2 C40 7 36.5 9.5 32 13 Z"
        fill="#ffffff"
      />
      {/* head */}
      <rect x="13" y="21" width="38" height="31" rx="14" fill="#fff8f2" />
      {/* eyes */}
      <circle cx="24.5" cy="35" r="5.5" fill="#33333d" />
      <circle cx="39.5" cy="35" r="5.5" fill="#33333d" />
      <circle cx="26.3" cy="33.2" r="1.7" fill="#ffffff" />
      <circle cx="41.3" cy="33.2" r="1.7" fill="#ffffff" />
      {/* blush */}
      <ellipse cx="18.3" cy="42" rx="4" ry="2.8" fill="#ff9eb0" opacity="0.85" />
      <ellipse cx="45.7" cy="42" rx="4" ry="2.8" fill="#ff9eb0" opacity="0.85" />
      {/* smile */}
      <path d="M27.5 42.5 Q32 47.5 36.5 42.5" stroke="#33333d" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
