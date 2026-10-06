import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { useLang } from "../i18n";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a10]";

export function Btn({
  children,
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "soft" }) {
  const styles =
    variant === "primary"
      ? "bg-gradient-to-b from-[#f43f52] to-[#c11124] text-white shadow-[0_0_24px_rgba(225,29,46,0.38),inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_0_36px_rgba(225,29,46,0.55),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 border border-white/10"
      : variant === "danger"
        ? "bg-red-600/90 text-white border border-red-400/30 shadow-[0_0_18px_rgba(220,38,38,0.3)] hover:bg-red-500"
        : variant === "soft"
          ? "border border-brand/30 bg-brand/[0.14] text-rose-200 backdrop-blur hover:bg-brand/[0.24] hover:border-brand/50"
          : "border border-white/[0.12] bg-white/[0.05] text-zinc-100 backdrop-blur-xl hover:bg-white/[0.1] hover:border-white/[0.2]";
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${focusRing} ${styles} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.09] bg-white/[0.045] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.42)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-300">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[13px] leading-relaxed text-zinc-500">{hint}</span>}
    </label>
  );
}

const inputBase = `w-full rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-3 text-[15px] text-zinc-100 backdrop-blur transition placeholder:text-zinc-500 hover:border-white/[0.16] focus:border-brand/60 focus:ring-2 focus:ring-brand/25 outline-none disabled:opacity-50`;

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} resize-y ${props.className ?? ""}`} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${inputBase} appearance-none pr-10 [&>option]:bg-zinc-900 [&>option]:text-zinc-100 ${props.className ?? ""}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.9rem center",
      }}
    >
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${focusRing} ${
        checked ? "bg-brand" : "bg-white/15"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function Alert({ kind, children }: { kind: "error" | "success" | "warn"; children: ReactNode }) {
  const styles =
    kind === "error"
      ? "border-red-500/30 bg-red-500/[0.1] text-red-200"
      : kind === "success"
        ? "border-emerald-500/30 bg-emerald-500/[0.1] text-emerald-200"
        : "border-amber-500/30 bg-amber-500/[0.1] text-amber-200";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm backdrop-blur-xl ${styles}`}>{children}</div>
  );
}

export function CopyBtn({ text }: { text: string }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-2 text-[13px] font-semibold text-zinc-200 backdrop-blur transition hover:bg-white/[0.12] active:scale-95 ${focusRing}`}
    >
      {copied ? t("done.copied") : t("done.copy")}
    </button>
  );
}

export function StatusPill({ status }: { status: "running" | "stopped" }) {
  const { t } = useLang();
  const running = status === "running";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold backdrop-blur-xl ${
        running
          ? "border-emerald-400/30 bg-emerald-500/[0.12] text-emerald-200"
          : "border-white/[0.12] bg-white/[0.05] text-zinc-400"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${running ? "bg-emerald-400 text-emerald-400 animate-pulse-dot" : "bg-zinc-500"}`}
      />
      {running ? t("m.running") : t("m.stopped")}
    </span>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.07]">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          pct >= 90
            ? "bg-gradient-to-r from-amber-400 to-red-500"
            : "bg-gradient-to-r from-[#f43f52] to-[#ff7a5c] shadow-[0_0_12px_rgba(225,29,46,0.5)]"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
