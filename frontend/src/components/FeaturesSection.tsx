import { Link } from "react-router-dom";
import { useLang, type TKey } from "../i18n";
import { Btn } from "./ui";

const NODES = [
  { emoji: "🎭", key: "feat.personas.t" as TKey },
  { emoji: "🖼️", key: "feat.imagine.t" as TKey },
  { emoji: "🔒", key: "feat.allowlist.t" as TKey },
  { emoji: "🧠", key: "feat.memory.t" as TKey },
  { emoji: "🛡️", key: "feat.admin.t" as TKey },
];

const CARDS = [
  { emoji: "🎭", t: "feat.personas.t" as TKey, d: "feat.personas.d" as TKey },
  { emoji: "🖼️", t: "feat.imagine.t" as TKey, d: "feat.imagine.d" as TKey },
  { emoji: "🔒", t: "feat.allowlist.t" as TKey, d: "feat.allowlist.d" as TKey },
  { emoji: "🧠", t: "feat.memory.t" as TKey, d: "feat.memory.d" as TKey },
  { emoji: "🛡️", t: "feat.admin.t" as TKey, d: "feat.admin.d" as TKey },
  { emoji: "⚡", t: "feat.fast.t" as TKey, d: "feat.fast.d" as TKey },
];

const STARS = [
  { x: 60, y: 40, d: "0s" },
  { x: 240, y: 250, d: "1.1s" },
  { x: 520, y: 36, d: "0.5s" },
  { x: 780, y: 260, d: "1.8s" },
  { x: 980, y: 44, d: "0.9s" },
  { x: 1140, y: 240, d: "2.2s" },
];

function FeatureBanner() {
  const { t } = useLang();
  return (
    <svg viewBox="0 0 1200 320" className="w-full" aria-hidden>
      <defs>
        <linearGradient id="featflow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e11d2e" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#ff5c6c" />
          <stop offset="100%" stopColor="#e11d2e" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="1192" height="312" rx="28" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.09)" />
      {STARS.map((s, i) => (
        <path
          key={i}
          className="svg-origin animate-twinkle"
          style={{ animationDelay: s.d }}
          transform={`translate(${s.x} ${s.y})`}
          d="M0 -7 C1.5 -2 2 -1.5 7 0 C2 1.5 1.5 2 0 7 C-1.5 2 -2 1.5 -7 0 C-2 -1.5 -1.5 -2 0 -7 Z"
          fill="#fda4af"
        />
      ))}
      {/* flowing line */}
      <line
        x1="90"
        y1="150"
        x2="1110"
        y2="150"
        stroke="url(#featflow)"
        strokeWidth="3.5"
        strokeDasharray="12 12"
        strokeLinecap="round"
        className="animate-dashflow"
      />
      {NODES.map((n, i) => {
        const x = 140 + i * 230;
        return (
          <g key={n.key}>
            <circle cx={x} cy="150" r="36" fill="none" stroke="#e11d2e" strokeWidth="2" className="ping-ring" style={{ animationDelay: `${i * 0.5}s` }} />
            <circle cx={x} cy="150" r="36" fill="#14141d" stroke="#e11d2e" strokeOpacity="0.7" strokeWidth="2" />
            <text x={x} y="163" textAnchor="middle" fontSize="34">
              {n.emoji}
            </text>
            <text x={x} y="222" textAnchor="middle" fontSize="16" fontWeight="700" fill="#f4f4f5">
              {t(n.key)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function FeaturesSection() {
  const { t } = useLang();
  return (
    <section className="py-10">
      <div className="text-center">
        <h2 className="text-gradient text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t("features.title")}
        </h2>
        <p className="mt-2 text-zinc-400">{t("features.sub")}</p>
      </div>

      {/* animated banner */}
      <div className="relative mt-8">
        <div className="absolute -inset-4 rounded-[36px] bg-gradient-to-b from-brand/[0.1] to-transparent blur-2xl" />
        <div className="glass relative overflow-hidden rounded-[28px] p-2 sm:p-4">
          <FeatureBanner />
        </div>
      </div>

      {/* cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c, i) => (
          <div
            key={c.t}
            className="group relative animate-fade-up overflow-hidden rounded-3xl border border-white/[0.09] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_8px_40px_rgba(225,29,46,0.16)]"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand/20 blur-2xl opacity-0 transition duration-300 group-hover:opacity-100" />
            <div className="relative text-4xl drop-shadow-[0_0_14px_rgba(225,29,46,0.4)] transition duration-300 group-hover:scale-110">
              {c.emoji}
            </div>
            <h3 className="relative mt-3 text-[16px] font-bold text-white">{t(c.t)}</h3>
            <p className="relative mt-1.5 text-sm leading-relaxed text-zinc-400">{t(c.d)}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link to="/build">
          <Btn className="px-8">{t("hero.cta")} →</Btn>
        </Link>
      </div>
    </section>
  );
}
