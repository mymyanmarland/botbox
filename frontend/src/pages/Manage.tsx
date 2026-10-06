import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, friendlyError, type BotInfo, type BotStats } from "../api";
import { PERSONAS, useLang, type TKey } from "../i18n";
import { Alert, Btn, Card, CopyBtn, Field, Input, ProgressBar, Select, Spinner, StatusPill, Textarea, Toggle } from "../components/ui";

export function Manage() {
  const { t } = useLang();
  const { secret = "" } = useParams<{ secret: string }>();
  const navigate = useNavigate();

  const [bot, setBot] = useState<BotInfo | null>(null);
  const [stats, setStats] = useState<BotStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  // edit form
  const [personaId, setPersonaId] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [allowedUsers, setAllowedUsers] = useState("");
  const [imageEnabled, setImageEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [newSecret, setNewSecret] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!secret) return;
    setLoading(true);
    setError("");
    try {
      const [b, s] = await Promise.all([api.getBot(secret), api.getStats(secret)]);
      setBot(b);
      setStats(s);
      setPersonaId(b.persona_id ?? "friendly");
      setCustomPrompt(b.custom_prompt ?? "");
      setBaseUrl(b.base_url);
      setModel(b.model);
      setAllowedUsers(b.allowed_users ?? "");
      setImageEnabled(!!b.image_model);
    } catch (e) {
      setError(friendlyError(e, t));
    } finally {
      setLoading(false);
    }
  }, [secret, t]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshStatus = async (fn: () => Promise<unknown>) => {
    setActionBusy(true);
    try {
      await fn();
      const b = await api.getBot(secret);
      setBot(b);
      const s = await api.getStats(secret);
      setStats(s);
    } catch (e) {
      setError(friendlyError(e, t));
    } finally {
      setActionBusy(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveMsg("");
    setError("");
    try {
      const body: Record<string, unknown> = {
        persona_id: personaId,
        custom_prompt: customPrompt.trim() || null,
        base_url: baseUrl.trim(),
        model: model.trim(),
        allowed_users: allowedUsers.trim(),
        image_model: imageEnabled ? "grok-imagine-image-2.0" : null,
      };
      if (apiKey.trim()) body.api_key = apiKey.trim();
      await api.updateBot(secret, body);
      setApiKey("");
      setSaveMsg(t("m.saved"));
      const b = await api.getBot(secret);
      setBot(b);
    } catch (e) {
      setError(friendlyError(e, t));
    } finally {
      setSaving(false);
    }
  };

  const rotate = async () => {
    if (!window.confirm(t("m.rotate.confirm"))) return;
    setActionBusy(true);
    try {
      const r = await api.rotateSecret(secret);
      setNewSecret(r.manage_secret);
      window.scrollTo(0, document.body.scrollHeight);
    } catch (e) {
      setError(friendlyError(e, t));
    } finally {
      setActionBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t("m.delete.confirm"))) return;
    setDeleting(true);
    try {
      await api.deleteBot(secret);
      navigate("/");
    } catch (e) {
      setError(friendlyError(e, t));
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted">
        <Spinner /> {t("m.loading")}
      </div>
    );
  }

  if (error && !bot) {
    return (
      <div className="mx-auto max-w-xl py-16">
        <Alert kind="error">❌ {t("m.notfound")}</Alert>
        <div className="mt-6 text-center">
          <Link to="/">
            <Btn variant="ghost">← {t("nav.home")}</Btn>
          </Link>
        </div>
      </div>
    );
  }

  if (!bot) return null;

  const newManageUrl = newSecret
    ? `${window.location.origin}${window.location.pathname}#/manage/${newSecret}`
    : "";

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-8 sm:py-10">
      {/* Header */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">@{bot.username}</h2>
            <p className="text-sm text-muted">{bot.name}</p>
          </div>
          <StatusPill status={bot.status} />
        </div>
        <div className="mt-4 flex gap-2">
          {bot.status === "running" ? (
            <Btn variant="ghost" onClick={() => refreshStatus(() => api.stopBot(secret))} disabled={actionBusy}>
              {actionBusy ? <Spinner /> : "⏸"} {t("m.stop")}
            </Btn>
          ) : (
            <Btn onClick={() => refreshStatus(() => api.startBot(secret))} disabled={actionBusy}>
              {actionBusy ? <Spinner /> : "▶"} {t("m.start")}
            </Btn>
          )}
          <a href={`https://t.me/${bot.username}`} target="_blank" rel="noreferrer">
            <Btn variant="soft">💬 Telegram</Btn>
          </a>
        </div>
      </Card>

      {error && (
        <Alert kind="error">❌ {error}</Alert>
      )}

      {/* Stats */}
      {stats && (
        <Card>
          <h3 className="mb-4 text-[16px] font-bold">📊 {t("m.stats")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 text-center backdrop-blur">
              <p className="text-2xl font-extrabold text-white">{stats.total_messages}</p>
              <p className="mt-1 text-[13px] text-zinc-500">{t("m.total")}</p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 text-center backdrop-blur">
              <p className="text-2xl font-extrabold text-white">{stats.today_messages}</p>
              <p className="mt-1 text-[13px] text-zinc-500">{t("m.today")}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-[13px] font-semibold">
              <span className="text-muted">{t("m.limit")}</span>
              <span>
                {stats.today_messages}/{stats.limit}
              </span>
            </div>
            <ProgressBar value={stats.today_messages} max={stats.limit} />
          </div>
        </Card>
      )}

      {/* Edit */}
      <Card className="space-y-4">
        <h3 className="text-[16px] font-bold">✏️ {t("m.edit")}</h3>
        <Field label={t("m.persona")}>
          <Select value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji} {t(`persona.${p.id}.name` as TKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("m.custom_prompt")}>
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={t("m.custom_prompt.ph")}
            rows={4}
          />
        </Field>
        <Field label={t("s3.base_url")}>
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="font-mono text-sm" />
        </Field>
        <Field label={t("s3.api_key")} hint={t("m.key_note")}>
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            autoComplete="off"
            placeholder="••••••••"
            className="font-mono text-sm"
          />
        </Field>
        <Field label={t("s3.model")}>
          <Input value={model} onChange={(e) => setModel(e.target.value)} className="font-mono text-sm" />
        </Field>
        <Field label={t("m.allowed_users")} hint={t("m.allowed_users.hint")}>
          <Input
            value={allowedUsers}
            onChange={(e) => setAllowedUsers(e.target.value)}
            placeholder={t("m.allowed_users.ph")}
            className="font-mono text-sm"
          />
        </Field>
        <Field label={t("s3.image_model")} hint={t("s3.image_model.hint")}>
          <div className="flex items-center gap-3">
            <Toggle checked={imageEnabled} onChange={setImageEnabled} label={t("s3.image_model")} />
            <span className="font-mono text-sm text-white/70">grok-imagine-image-2.0</span>
          </div>
        </Field>
        {saveMsg && <Alert kind="success">{saveMsg}</Alert>}
        <Btn onClick={save} disabled={saving}>
          {saving ? <Spinner /> : "💾"} {saving ? t("m.saving") : t("m.save")}
        </Btn>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-500/30 bg-red-500/[0.04]">
        <h3 className="text-[16px] font-bold text-red-300">⚠️ {t("m.danger")}</h3>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Btn variant="ghost" onClick={rotate} disabled={actionBusy}>
            🔄 {t("m.rotate")}
          </Btn>
          <Btn variant="danger" onClick={remove} disabled={deleting}>
            {deleting ? <Spinner /> : "🗑"} {deleting ? t("m.deleting") : t("m.delete")}
          </Btn>
        </div>
        {newSecret && (
          <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] p-4 backdrop-blur">
            <p className="mb-2 text-[13px] font-bold text-amber-200">{t("m.newlink")}</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[12px] text-zinc-300">
                {newManageUrl}
              </code>
              <CopyBtn text={newManageUrl} />
            </div>
            <p className="mt-2 text-[12px] text-amber-200/80">{t("done.warn")}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
