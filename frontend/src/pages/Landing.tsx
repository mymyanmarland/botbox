import { useState } from "react";
import { Link } from "react-router-dom";
import { useLang, type TKey } from "../i18n";
import { Btn, Card } from "../components/ui";
import { BotMascot, HeroBackdrop } from "../components/HeroArt";
import { PersonasSection } from "../components/PersonasSection";
import { FeaturesSection } from "../components/FeaturesSection";

const STEPS = [
  { n: "1", t: "steps.1.t" as TKey, d: "steps.1.d" as TKey, emoji: "🔑" },
  { n: "2", t: "steps.2.t" as TKey, d: "steps.2.d" as TKey, emoji: "🎭" },
  { n: "3", t: "steps.3.t" as TKey, d: "steps.3.d" as TKey, emoji: "🚀" },
];

const FAQS = [1, 2, 3, 4, 5, 6].map((n) => ({
  q: `faq.${n}.q` as TKey,
  a: `faq.${n}.a` as TKey,
}));

const CHAT = [
  { from: "bot" as const, text: "မင်္ဂလာပါ! ဘာကူညီပေးရမလဲ? 🌸", delay: "0.3s" },
  { from: "user" as const, text: "ဒီအင်္ကျီဈေးဘယ်လောက်?", delay: "1.1s" },
  { from: "bot" as const, text: "၂၅,၀၀၀ ကျပ်ပါ! ဒီနေ့မှာရင် ပို့ခ free နော် 🛍️", delay: "1.9s" },
];

export function Landing() {
  const { t } = useLang();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div>
      {/* Hero */}
      <section className="relative animate-fade-up overflow-hidden py-12 text-center sm:py-20">
        <HeroBackdrop />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/[0.12] px-4 py-1.5 text-[13px] font-bold text-rose-200 backdrop-blur-xl">
          🤖 {t("hero.badge")}
        </span>
        <h1 className="text-gradient mx-auto mt-6 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          {t("hero.title")}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-zinc-400">{t("hero.sub")}</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/build">
            <Btn className="w-64 px-8 py-3.5 text-base sm:w-auto">{t("hero.cta")} →</Btn>
          </Link>
          <a href="#how">
            <Btn variant="ghost" className="w-64 px-8 py-3.5 text-base sm:w-auto">
              {t("hero.cta2")}
            </Btn>
          </a>
        </div>

        {/* animated glass chat mock */}
        <div className="relative mx-auto mt-14 max-w-sm">
          <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-b from-brand/[0.14] to-transparent blur-2xl" />
          <div className="glass relative animate-float rounded-3xl p-4 text-left">
            <div className="mb-3 flex items-center gap-2.5 border-b border-white/[0.08] pb-3">
              <BotMascot size={40} />
              <div>
                <p className="text-sm font-bold text-white">@my_shop_bot</p>
                <p className="flex items-center gap-1 text-xs text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-emerald-400 text-emerald-400" />
                  online
                </p>
              </div>
            </div>
            <div className="space-y-2.5 text-sm">
              {CHAT.map((m, i) =>
                m.from === "bot" ? (
                  <div
                    key={i}
                    className="max-w-[85%] animate-msg-in rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.07] px-3.5 py-2.5 text-zinc-100 backdrop-blur"
                    style={{ animationDelay: m.delay }}
                  >
                    {m.text}
                  </div>
                ) : (
                  <div
                    key={i}
                    className="ml-auto max-w-[80%] animate-msg-in rounded-2xl rounded-br-md bg-gradient-to-b from-[#f43f52] to-[#c11124] px-3.5 py-2.5 text-white shadow-[0_4px_16px_rgba(225,29,46,0.35)]"
                    style={{ animationDelay: m.delay }}
                  >
                    {m.text}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 py-10">
        <h2 className="text-center text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {t("steps.title")}
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <Card key={s.n} className="group relative text-center transition duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_8px_40px_rgba(225,29,46,0.18)]">
              <span className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-[#f43f52] to-[#c11124] text-sm font-extrabold text-white shadow-[0_0_16px_rgba(225,29,46,0.5)]">
                {s.n}
              </span>
              <div className="text-4xl drop-shadow-[0_0_12px_rgba(225,29,46,0.35)]">{s.emoji}</div>
              <h3 className="mt-3 text-[17px] font-bold text-white">{t(s.t)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{t(s.d)}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <FeaturesSection />

      {/* Personas */}
      <PersonasSection />

      {/* FAQ */}
      <section className="mx-auto max-w-2xl py-10">
        <h2 className="text-center text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {t("faq.title")}
        </h2>
        <div className="mt-6 space-y-3">
          {FAQS.map((f, i) => {
            const open = openFaq === i;
            return (
              <div
                key={i}
                className={`overflow-hidden rounded-2xl border backdrop-blur-xl transition ${
                  open ? "border-brand/40 bg-white/[0.06]" : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16]"
                }`}
              >
                <button
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-[15px] font-bold text-zinc-100"
                >
                  {t(f.q)}
                  <span
                    className={`shrink-0 text-xl text-rose-400 transition-transform duration-300 ${open ? "rotate-45" : ""}`}
                  >
                    +
                  </span>
                </button>
                {open && (
                  <p className="border-t border-white/[0.08] px-5 py-4 text-sm leading-relaxed text-zinc-400">
                    {t(f.a)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
