import { Link, useLocation } from "react-router-dom";
import { useLang } from "../i18n";
import { Logo } from "./Logo";

export function Layout({ children }: { children: React.ReactNode }) {
  const { lang, setLang, t } = useLang();
  const loc = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#0a0a10]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="group flex items-center gap-2.5">
            <Logo
              size={36}
              className="drop-shadow-[0_0_16px_rgba(225,29,46,0.5)] transition group-hover:drop-shadow-[0_0_24px_rgba(225,29,46,0.75)]"
            />
            <span className="leading-tight">
              <span className="block text-[16px] font-extrabold tracking-tight text-white">BotBox</span>
              <span className="block text-[11px] font-medium text-zinc-500">{t("brand.tag")}</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <nav className="mr-1 hidden items-center gap-1 sm:flex">
              <Link
                to="/"
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition hover:bg-white/[0.06] ${
                  loc.pathname === "/" ? "text-rose-400" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {t("nav.home")}
              </Link>
              <Link
                to="/build"
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition hover:bg-white/[0.06] ${
                  loc.pathname === "/build" ? "text-rose-400" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {t("nav.build")}
              </Link>
            </nav>
            <button
              onClick={() => setLang(lang === "my" ? "en" : "my")}
              className="rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-[13px] font-bold text-zinc-200 backdrop-blur transition hover:bg-white/[0.1] active:scale-95"
              aria-label="switch language"
            >
              {t("lang.toggle")}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4">{children}</div>
      </main>

      <footer className="border-t border-white/[0.08] bg-black/30 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-4 py-6 text-center">
          <p className="text-[13px] text-zinc-500">{t("footer.rights")}</p>
          <p className="text-[13px] font-semibold text-zinc-300">{t("footer.made")}</p>
          <Link to="/admin" className="mt-1 text-[12px] text-zinc-600 transition hover:text-zinc-400">
            {t("footer.admin")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
