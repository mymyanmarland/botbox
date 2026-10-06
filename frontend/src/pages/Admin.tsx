import { useCallback, useEffect, useState } from "react";
import { adminApi, friendlyError, type AdminBot, type AdminMessage, type AdminStats } from "../api";
import { useLang } from "../i18n";
import { Alert, Btn, Card, Field, Input, Spinner, StatusPill } from "../components/ui";

type Phase = "checking" | "setup" | "login" | "dashboard";

export function Admin() {
  const { t } = useLang();
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState("");

  // setup / login form
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  // dashboard data
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [bots, setBots] = useState<AdminBot[]>([]);
  const [actionBusy, setActionBusy] = useState(false);
  const [openMsgs, setOpenMsgs] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<AdminMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setError("");
    try {
      const [s, b] = await Promise.all([adminApi.stats(), adminApi.bots()]);
      setStats(s);
      setBots(b.bots);
      setPhase("dashboard");
    } catch (e) {
      adminApi.setToken(null);
      setPhase("login");
      setError(friendlyError(e, t));
    }
  }, [t]);

  useEffect(() => {
    (async () => {
      try {
        const st = await adminApi.status();
        if (st.setupRequired) {
          setPhase("setup");
          return;
        }
        if (adminApi.hasToken()) {
          await loadDashboard();
        } else {
          setPhase("login");
        }
      } catch (e) {
        setError(friendlyError(e, t));
        setPhase("login");
      }
    })();
  }, [loadDashboard, t]);

  const doSetup = async () => {
    setError("");
    if (pw.length < 10) {
      setError(t("admin.tooshort"));
      return;
    }
    if (pw !== pw2) {
      setError(t("admin.mismatch"));
      return;
    }
    setBusy(true);
    try {
      const r = await adminApi.setup(pw);
      if (r.token) adminApi.setToken(r.token);
      setPw("");
      setPw2("");
      await loadDashboard();
    } catch (e) {
      setError(friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  };

  const doLogin = async () => {
    setError("");
    setBusy(true);
    try {
      const r = await adminApi.login(pw);
      if (r.token) adminApi.setToken(r.token);
      setPw("");
      await loadDashboard();
    } catch (e) {
      const msg = friendlyError(e, t);
      setError(/wrong password|401/i.test(msg) ? t("admin.wrong") : msg);
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    try {
      await adminApi.logout();
    } catch {
      /* ignore */
    }
    adminApi.setToken(null);
    setStats(null);
    setBots([]);
    setPhase("login");
  };

  const botAction = async (fn: () => Promise<unknown>) => {
    setActionBusy(true);
    setError("");
    try {
      await fn();
      const [s, b] = await Promise.all([adminApi.stats(), adminApi.bots()]);
      setStats(s);
      setBots(b.bots);
    } catch (e) {
      setError(friendlyError(e, t));
    } finally {
      setActionBusy(false);
    }
  };

  const removeBot = (id: number) => {
    if (!window.confirm(t("admin.delete.confirm"))) return;
    void botAction(() => adminApi.deleteBot(id));
  };

  const toggleMessages = async (id: number) => {
    if (openMsgs === id) {
      setOpenMsgs(null);
      return;
    }
    setOpenMsgs(id);
    setMsgs([]);
    setMsgsLoading(true);
    try {
      const r = await adminApi.messages(id, 50);
      setMsgs(r.messages);
    } catch (e) {
      setError(friendlyError(e, t));
    } finally {
      setMsgsLoading(false);
    }
  };

  if (phase === "checking") {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted">
        <Spinner /> {t("m.loading")}
      </div>
    );
  }

  // ---- first-run setup / login ----
  if (phase === "setup" || phase === "login") {
    const isSetup = phase === "setup";
    return (
      <div className="mx-auto max-w-md py-16 sm:py-20">
        <Card className="space-y-4">
          <div>
            <h2 className="text-xl font-extrabold">🔐 {t(isSetup ? "admin.setup.title" : "admin.login.title")}</h2>
            {isSetup && <p className="mt-1 text-sm text-zinc-500">{t("admin.setup.sub")}</p>}
          </div>
          {error && <Alert kind="error">❌ {error}</Alert>}
          <Field label={t("admin.password")}>
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={isSetup ? t("admin.password.ph") : undefined}
              autoComplete={isSetup ? "new-password" : "current-password"}
              onKeyDown={(e) => {
                if (e.key === "Enter") void (isSetup ? doSetup() : doLogin());
              }}
            />
          </Field>
          {isSetup && (
            <Field label={t("admin.confirm")}>
              <Input
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void doSetup();
                }}
              />
            </Field>
          )}
          <Btn onClick={() => void (isSetup ? doSetup() : doLogin())} disabled={busy} className="w-full">
            {busy && <Spinner />}
            {busy ? t(isSetup ? "admin.setting" : "admin.logging") : t(isSetup ? "admin.set" : "admin.login.btn")}
          </Btn>
        </Card>
      </div>
    );
  }

  // ---- dashboard ----
  return (
    <div className="mx-auto max-w-3xl space-y-5 py-8 sm:py-10">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold">🔐 {t("admin.title")}</h2>
        <Btn variant="ghost" onClick={() => void doLogout()} className="px-4 py-2 text-sm">
          {t("admin.logout")}
        </Btn>
      </div>

      {error && <Alert kind="error">❌ {error}</Alert>}

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: t("admin.stats.bots"), value: stats.botsTotal },
            { label: t("admin.stats.running"), value: stats.running },
            { label: t("admin.stats.today"), value: stats.messagesToday },
            { label: t("admin.stats.total"), value: stats.messagesTotal },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/[0.09] bg-white/[0.045] p-4 text-center shadow-[0_8px_32px_rgba(0,0,0,0.42)] backdrop-blur-xl"
            >
              <p className="text-2xl font-extrabold text-white">{s.value}</p>
              <p className="mt-1 text-[12px] text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <Card>
        <h3 className="mb-4 text-[16px] font-bold">🤖 {t("admin.bots.title")}</h3>
        {bots.length === 0 && <p className="text-sm text-zinc-500">{t("admin.empty")}</p>}
        <div className="space-y-3">
          {bots.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold text-zinc-100">
                    @{b.username || "?"} <span className="font-normal text-zinc-500">· {b.name}</span>
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[12px] text-zinc-500">
                    {b.model} · {b.base_url}
                  </p>
                  <p className="mt-0.5 text-[12px] text-zinc-500">
                    💬 {b.totalMessages} · {t("m.today")} {b.todayUsage}
                  </p>
                </div>
                <StatusPill status={b.status} />
                {b.allowed_users ? (
                  <span title={b.allowed_users} className="ml-2 inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300">
                    🔒 {b.allowed_users.split(",").length}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {b.status === "running" ? (
                  <Btn
                    variant="ghost"
                    className="px-3 py-2 text-[13px]"
                    disabled={actionBusy}
                    onClick={() => void botAction(() => adminApi.stopBot(b.id))}
                  >
                    ⏸ {t("m.stop")}
                  </Btn>
                ) : (
                  <Btn
                    className="px-3 py-2 text-[13px]"
                    disabled={actionBusy}
                    onClick={() => void botAction(() => adminApi.startBot(b.id))}
                  >
                    ▶ {t("m.start")}
                  </Btn>
                )}
                <Btn
                  variant="soft"
                  className="px-3 py-2 text-[13px]"
                  onClick={() => void toggleMessages(b.id)}
                >
                  💬 {openMsgs === b.id ? t("admin.messages.hide") : t("admin.messages")}
                </Btn>
                <Btn
                  variant="danger"
                  className="px-3 py-2 text-[13px]"
                  disabled={actionBusy}
                  onClick={() => removeBot(b.id)}
                >
                  🗑 {t("m.delete")}
                </Btn>
              </div>
              {openMsgs === b.id && (
                <div className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-white/[0.08] bg-black/30 p-3">
                  {msgsLoading && (
                    <p className="flex items-center gap-2 text-sm text-zinc-500">
                      <Spinner /> {t("m.loading")}
                    </p>
                  )}
                  {!msgsLoading && msgs.length === 0 && (
                    <p className="text-sm text-zinc-500">{t("admin.messages.empty")}</p>
                  )}
                  {msgs.map((m, i) => (
                    <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-2.5">
                      <p className="mb-1 flex items-center gap-2 text-[11px] text-zinc-500">
                        <span
                          className={`rounded px-1.5 py-0.5 font-bold ${
                            m.role === "user"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {m.role}
                        </span>
                        <span>
                          {t("admin.user")}: {m.user_id || "?"}
                        </span>
                        <span>{new Date(m.created_at).toLocaleString()}</span>
                      </p>
                      <p className="whitespace-pre-wrap break-words text-[13px] text-zinc-200">{m.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
