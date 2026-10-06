// Animated SVG art for the landing hero: drifting glow orbs, twinkling
// stars, and a cute blinking bot mascot.
const STARS = [
  { x: 40, y: 30, s: 1.0, d: "0s" },
  { x: 120, y: 90, s: 0.7, d: "0.9s" },
  { x: 210, y: 40, s: 0.55, d: "1.7s" },
  { x: 300, y: 110, s: 0.9, d: "0.4s" },
  { x: 390, y: 55, s: 0.6, d: "2.3s" },
  { x: 480, y: 95, s: 0.8, d: "1.2s" },
  { x: 560, y: 35, s: 0.5, d: "2.8s" },
  { x: 640, y: 100, s: 0.75, d: "0.6s" },
  { x: 720, y: 45, s: 0.6, d: "2.0s" },
  { x: 790, y: 85, s: 0.9, d: "1.4s" },
];

export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* drifting glow orbs */}
      <div className="animate-drift-a absolute -top-10 left-[8%] h-64 w-64 rounded-full bg-brand/[0.16] blur-3xl" />
      <div className="animate-drift-b absolute right-[6%] top-24 h-72 w-72 rounded-full bg-fuchsia-600/[0.1] blur-3xl" />
      <div className="animate-drift-a absolute bottom-0 left-[42%] h-56 w-56 rounded-full bg-rose-500/[0.1] blur-3xl" />
      {/* twinkling stars */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 840 160"
        preserveAspectRatio="xMidYMin slice"
      >
        {STARS.map((st, i) => (
          <g
            key={i}
            className="svg-origin animate-twinkle"
            style={{ animationDelay: st.d }}
            transform={`translate(${st.x} ${st.y}) scale(${st.s})`}
          >
            <path
              d="M0 -7 C1.5 -2 2 -1.5 7 0 C2 1.5 1.5 2 0 7 C-1.5 2 -2 1.5 -7 0 C-2 -1.5 -1.5 -2 0 -7 Z"
              fill={i % 3 === 0 ? "#fda4af" : "#ffffff"}
              opacity={0.8}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

export function BotMascot({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden
      className="animate-float drop-shadow-[0_0_14px_rgba(225,29,46,0.45)]"
    >
      <defs>
        <linearGradient id="botHead" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3a46" />
          <stop offset="100%" stopColor="#17171f" />
        </linearGradient>
        <linearGradient id="botAccent" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff4d5e" />
          <stop offset="100%" stopColor="#c11124" />
        </linearGradient>
      </defs>
      {/* antenna */}
      <line x1="60" y1="18" x2="60" y2="34" stroke="#ff4d5e" strokeWidth="5" strokeLinecap="round" />
      <circle cx="60" cy="14" r="7" fill="url(#botAccent)">
        <animate attributeName="opacity" values="1;0.45;1" dur="2.4s" repeatCount="indefinite" />
      </circle>
      {/* ears */}
      <rect x="14" y="52" width="10" height="26" rx="5" fill="#2b2b35" />
      <rect x="96" y="52" width="10" height="26" rx="5" fill="#2b2b35" />
      {/* head */}
      <rect x="22" y="34" width="76" height="62" rx="22" fill="url(#botHead)" stroke="#ff4d5e" strokeOpacity="0.55" strokeWidth="2.5" />
      {/* eyes (blink) */}
      <g className="svg-origin animate-blink">
        <ellipse cx="44" cy="60" rx="8" ry="10" fill="#fff" />
        <ellipse cx="76" cy="60" rx="8" ry="10" fill="#fff" />
        <circle cx="45.5" cy="62" r="4" fill="#e11d2e" />
        <circle cx="77.5" cy="62" r="4" fill="#e11d2e" />
        <circle cx="47" cy="60.5" r="1.4" fill="#fff" />
        <circle cx="79" cy="60.5" r="1.4" fill="#fff" />
      </g>
      {/* cheeks */}
      <circle cx="34" cy="74" r="5" fill="#ff4d5e" opacity="0.35" />
      <circle cx="86" cy="74" r="5" fill="#ff4d5e" opacity="0.35" />
      {/* smile */}
      <path d="M48 78 Q60 88 72 78" stroke="#ff8fa0" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
