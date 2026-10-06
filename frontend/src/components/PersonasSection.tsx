import { useState } from "react";
import { Link } from "react-router-dom";
import { PERSONAS, useLang, type TKey } from "../i18n";
import { Btn } from "./ui";

const FEATURED = ["lover", "seller", "programmer", "doctor", "teacher", "poet", "astrologer", "comedian"];

export function PersonasSection() {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const featured = FEATURED.map((id) => PERSONAS.find((p) => p.id === id)).filter(
    (p): p is (typeof PERSONAS)[number] => !!p,
  );
  const rest = PERSONAS.filter((p) => !FEATURED.includes(p.id));
  const marquee = [...PERSONAS, ...PERSONAS];

  return (
    <section className="relative py-10">
      {/* header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/[0.12] px-4 py-1.5 text-[13px] font-bold text-rose-200 backdrop-blur-xl">
          🎭 {PERSONAS.length} {t("personas.count")}
        </span>
        <h2 className="text-gradient mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t("personas.title")}
        </h2>
        <p className="mt-2 text-zinc-400">{t("personas.sub")}</p>
      </div>

      {/* infinite marquee of all personas */}
      <div className="relative mt-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="animate-marquee flex w-max gap-3 hover:[animation-play-state:paused]">
          {marquee.map((p, i) => (
            <span
              key={`${p.id}-${i}`}
              className="flex shrink-0 items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.04] px-4 py-2 text-sm text-zinc-200 backdrop-blur transition hover:border-brand/50 hover:bg-brand/[0.12]"
            >
              <span className="text-lg">{p.emoji}</span>
              {t(`persona.${p.id}.name` as TKey)}
            </span>
          ))}
        </div>
      </div>

      {/* featured cards */}
      <p className="mt-10 text-center text-sm font-bold uppercase tracking-widest text-zinc-500">
        {t("personas.featured")}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {featured.map((p, i) => (
          <div
            key={p.id}
            className="group relative animate-fade-up overflow-hidden rounded-3xl border border-white/[0.09] bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 text-center backdrop-blur-xl transition duration-300 hover:-translate-y-1.5 hover:border-brand/50 hover:shadow-[0_12px_48px_rgba(225,29,46,0.22)]"
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            <div className="absolute -top-12 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full bg-brand/25 blur-2xl opacity-0 transition duration-300 group-hover:opacity-100" />
            <div className="relative text-5xl drop-shadow-[0_0_18px_rgba(225,29,46,0.45)] transition duration-300 group-hover:scale-110">
              {p.emoji}
            </div>
            <h3 className="relative mt-3 text-[16px] font-bold text-white">
              {t(`persona.${p.id}.name` as TKey)}
            </h3>
            <p className="relative mt-1.5 text-[13px] leading-relaxed text-zinc-400">
              {t(`persona.${p.id}.desc` as TKey)}
            </p>
          </div>
        ))}
      </div>

      {/* expander for the rest */}
      <div className="mt-6 text-center">
        <Btn variant="ghost" onClick={() => setExpanded((v) => !v)} className="px-6">
          {expanded
            ? t("personas.show_less")
            : t("personas.show_all").replace("{n}", String(rest.length))}
          <span className={`ml-2 inline-block transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}>
            ▾
          </span>
        </Btn>
      </div>
      {expanded && (
        <div className="mt-6 animate-fade-up">
          <p className="mb-4 text-center text-sm font-bold uppercase tracking-widest text-zinc-500">
            {t("personas.all")}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {rest.map((p) => (
              <div
                key={p.id}
                title={t(`persona.${p.id}.desc` as TKey)}
                className="flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 backdrop-blur transition hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand/[0.08]"
              >
                <span className="shrink-0 text-2xl">{p.emoji}</span>
                <span className="truncate text-[13px] font-bold text-zinc-200">
                  {t(`persona.${p.id}.name` as TKey)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link to="/build">
          <Btn className="px-8">{t("hero.cta")} →</Btn>
        </Link>
      </div>
    </section>
  );
}
