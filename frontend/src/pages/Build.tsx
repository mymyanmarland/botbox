import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, friendlyError } from "../api";
import { MODEL_SUGGESTIONS, PERSONAS, useLang, type PersonaId, type TKey } from "../i18n";
import { Alert, Btn, Card, CopyBtn, Field, Input, Select, Spinner, Textarea, Toggle } from "../components/ui";

const DEFAULT_BASE_URL = "https://sapi.zly168.cn/v1";

type ProbeState = "idle" | "probing" | "ok" | "fail";

function StepDots({ step, t }: { step: number; t: (k: TKey) => string }) {
  const labels = [t("build.step1"), t("build.step2"), t("build.step3")];
  return (
    <div className="mb-8 flex items-center justify-center gap-2 sm:gap-3">
      {labels.map((l, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={l} className="flex items-center gap-2 sm:gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold transition ${
                  done
                    ? "border border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                    : active
                      ? "bg-gradient-to-b from-[#f43f52] to-[#c11124] text-white shadow-[0_0_18px_rgba(225,29,46,0.55)]"
                      : "border border-white/[0.1] bg-white/[0.05] text-zinc-500"
                }`}
              >
                {done ? "✓" : n}
              </span>
              <span className={`text-[11px] font-semibold sm:text-xs ${active ? "text-rose-300" : "text-zinc-500"}`}>
                {l}
              </span>
            </div>
            {n < 3 && <div className={`mb-6 h-0.5 w-8 sm:w-16 ${done ? "bg-emerald-500/60" : "bg-white/[0.1]"}`} />}
          </div>
        );
      })}
    </div>
  );
}

export function Build() {
  const { t } = useLang();
  const [step, setStep] = useState(1);

  // Step 1
  const [token, setToken] = useState("");
  const [tokenInfo, setTokenInfo] = useState<{ name: string; username: string } | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [validating, setValidating] = useState(false);

  // Step 2
  const [personaId, setPersonaId] = useState<PersonaId>("friendly");
  const [customPrompt, setCustomPrompt] = useState("");

  // Step 3
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [imageEnabled, setImageEnabled] = useState(false);
  const [probe, setProbe] = useState<ProbeState>("idle");
  const [probeError, setProbeError] = useState("");
  const [modelMode, setModelMode] = useState<"text" | "select">("text");
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");

  // Deploy
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState("");
  const [done, setDone] = useState<{ username: string; manageSecret: string; warning?: string } | null>(null);

  const validateToken = async () => {
    if (!token.trim() || validating) return;
    setValidating(true);
    setTokenError("");
    setTokenInfo(null);
    try {
      const r = await api.validateToken(token.trim());
      if (r.ok && r.name && r.username) {
        setTokenInfo({ name: r.name, username: r.username });
      } else {
        setTokenError(r.error || t("s1.fail"));
      }
    } catch (e) {
      setTokenError(friendlyError(e, t));
    } finally {
      setValidating(false);
    }
  };

  const probeKey = async () => {
    if (!baseUrl.trim() || !apiKey.trim() || !model.trim() || probe === "probing") return;
    setProbe("probing");
    setProbeError("");
    try {
      const r = await api.probe(baseUrl.trim(), apiKey.trim(), model.trim());
      if (r.ok) {
        setProbe("ok");
      } else {
        setProbe("fail");
        setProbeError(r.error || t("s3.probe.fail"));
      }
    } catch (e) {
      setProbe("fail");
      setProbeError(friendlyError(e, t));
    }
  };

  const loadModels = async () => {
    if (!baseUrl.trim() || !apiKey.trim() || modelsLoading) return;
    setModelsLoading(true);
    setModelsError("");
    try {
      const r = await api.listModels(baseUrl.trim(), apiKey.trim());
      if (r.ok && r.models && r.models.length > 0) {
        setModels(r.models);
        setModelMode("select");
        setModel(r.models[0]);
        setProbe("idle");
      } else {
        setModelsError(r.error || t("s3.models.fail"));
      }
    } catch (e) {
      setModelsError(friendlyError(e, t));
    } finally {
      setModelsLoading(false);
    }
  };

  const deploy = async () => {
    if (deploying) return;
    setDeploying(true);
    setDeployError("");
    try {
      const r = await api.createBot({
        token: token.trim(),
        persona_id: personaId,
        custom_prompt: customPrompt.trim() || undefined,
        base_url: baseUrl.trim(),
        api_key: apiKey.trim(),
        model: model.trim(),
        image_model: imageEnabled ? "grok-imagine-image-2.0" : undefined,
      });
      // The backend returns manage_secret even when the Telegram poller failed
      // to start — never lose the link: show the success screen with a warning.
      if (r.manage_secret) {
        setDone({
          username: r.username,
          manageSecret: r.manage_secret,
          warning: r.ok === false ? r.error || "deploy failed" : undefined,
        });
        window.scrollTo(0, 0);
        return;
      }
      if (r.ok === false) throw new ApiError(r.error || "deploy failed");
      setDone({ username: r.username, manageSecret: r.manage_secret });
      window.scrollTo(0, 0);
    } catch (e) {
      setDeployError(friendlyError(e, t));
    } finally {
      setDeploying(false);
    }
  };

  if (done) {
    const manageUrl = `${window.location.origin}${window.location.pathname}#/manage/${done.manageSecret}`;
    return (
      <div className="mx-auto max-w-xl py-10 sm:py-14">
        <Card className="text-center">
          <h2 className="text-2xl font-extrabold">{t("done.title")}</h2>
          <p className="mt-2 text-muted">@{done.username}</p>
          <div className="mt-6">
            <a href={`https://t.me/${done.username}`} target="_blank" rel="noreferrer">
              <Btn className="w-full">💬 {t("done.chat")}</Btn>
            </a>
          </div>
          <div className="mt-6 rounded-xl border border-white/[0.09] bg-white/[0.04] p-4 text-left backdrop-blur">
            <p className="mb-2 text-[13px] font-bold text-zinc-200">{t("done.manage.label")}</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[12px] text-zinc-300">
                {manageUrl}
              </code>
              <CopyBtn text={manageUrl} />
            </div>
          </div>
          <Alert kind="warn">
            <span className="text-[13px]">{t("done.warn")}</span>
          </Alert>
          {done.warning && (
            <Alert kind="error">
              <span className="text-[13px]">
                {t("done.startwarn")}: {done.warning}
              </span>
            </Alert>
          )}
          <Link to="/" className="mt-6 inline-block">
            <Btn variant="ghost">{t("done.home")}</Btn>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-8 sm:py-12">
      <h2 className="mb-6 text-center text-2xl font-extrabold tracking-tight sm:text-3xl">{t("build.title")}</h2>
      <StepDots step={step} t={t} />

      {step === 1 && (
        <Card className="space-y-5">
          <h3 className="text-lg font-bold">{t("s1.title")}</h3>
          <Field label={t("s1.label")} hint={t("s1.hint")}>
            <div className="flex gap-2">
              <Input
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setTokenInfo(null);
                  setTokenError("");
                }}
                placeholder={t("s1.ph")}
                type="password"
                autoComplete="off"
                className="font-mono"
              />
              <Btn variant="soft" onClick={validateToken} disabled={!token.trim() || validating} className="shrink-0">
                {validating ? <Spinner /> : t("s1.validate")}
              </Btn>
            </div>
          </Field>
          {tokenInfo && (
            <Alert kind="success">
              ✅ {t("s1.ok")}: <b>{tokenInfo.name}</b> (@{tokenInfo.username})
            </Alert>
          )}
          {tokenError && <Alert kind="error">❌ {tokenError}</Alert>}
          <div className="flex justify-end">
            <Btn onClick={() => tokenInfo && setStep(2)} disabled={!tokenInfo}>
              {t("build.next")} →
            </Btn>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-5">
          <h3 className="text-lg font-bold">{t("s2.title")}</h3>
          <div className="grid grid-cols-2 gap-3">
            {PERSONAS.map((p) => {
              const active = personaId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPersonaId(p.id)}
                  className={`rounded-2xl border-2 p-4 text-center backdrop-blur transition active:scale-[0.98] ${
                    active
                      ? "border-brand/70 bg-brand/[0.14] shadow-[0_0_24px_rgba(225,29,46,0.25)]"
                      : "border-white/[0.09] bg-white/[0.03] hover:border-white/[0.22] hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="text-3xl">{p.emoji}</div>
                  <p className="mt-2 text-sm font-bold">{t(`persona.${p.id}.name` as TKey)}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">
                    {t(`persona.${p.id}.desc` as TKey)}
                  </p>
                </button>
              );
            })}
          </div>
          <Field label={t("s2.custom.label")} hint={t("s2.custom.note")}>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={t("s2.custom.ph")}
              rows={4}
            />
          </Field>
          <div className="flex justify-between">
            <Btn variant="ghost" onClick={() => setStep(1)}>
              ← {t("build.back")}
            </Btn>
            <Btn onClick={() => setStep(3)}>{t("build.next")} →</Btn>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-5">
          <h3 className="text-lg font-bold">{t("s3.title")}</h3>
          <Field label={t("s3.base_url")}>
            <Input
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setProbe("idle");
              }}
              placeholder={DEFAULT_BASE_URL}
              className="font-mono text-sm"
            />
          </Field>
          <Field label={t("s3.api_key")}>
            <Input
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setProbe("idle");
              }}
              placeholder={t("s3.api_key.ph")}
              type="password"
              autoComplete="off"
              className="font-mono text-sm"
            />
          </Field>
          <Field label={t("s3.model")}>
            {modelMode === "select" ? (
              <div className="flex gap-2">
                <Select
                  value={model}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setModelMode("text");
                      setModel("");
                    } else {
                      setModel(e.target.value);
                    }
                    setProbe("idle");
                  }}
                  className="font-mono text-sm"
                >
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="__custom__">{t("s3.models.custom")}</option>
                </Select>
                <Btn variant="soft" onClick={loadModels} disabled={modelsLoading} title={t("s3.models.load")}>
                  {modelsLoading ? <Spinner /> : "↻"}
                </Btn>
              </div>
            ) : (
              <>
                <Input
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setProbe("idle");
                  }}
                  placeholder={t("s3.model.ph")}
                  list="model-suggestions"
                  className="font-mono text-sm"
                />
                <datalist id="model-suggestions">
                  {MODEL_SUGGESTIONS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <div className="mt-2">
                  <Btn
                    variant="soft"
                    onClick={loadModels}
                    disabled={!baseUrl.trim() || !apiKey.trim() || modelsLoading}
                  >
                    {modelsLoading ? <Spinner /> : "📋"}{" "}
                    {modelsLoading ? t("s3.models.loading") : t("s3.models.load")}
                  </Btn>
                  {modelsError && (
                    <div className="mt-2">
                      <Alert kind="error">❌ {modelsError}</Alert>
                    </div>
                  )}
                </div>
              </>
            )}
          </Field>
          <Field label={t("s3.image_model")} hint={t("s3.image_model.hint")}>
            <div className="flex items-center gap-3">
              <Toggle checked={imageEnabled} onChange={setImageEnabled} label={t("s3.image_model")} />
              <span className="font-mono text-sm text-white/70">grok-imagine-image-2.0</span>
            </div>
          </Field>

          <div>
            <Btn
              variant="soft"
              onClick={probeKey}
              disabled={!baseUrl.trim() || !apiKey.trim() || !model.trim() || probe === "probing"}
            >
              {probe === "probing" ? <Spinner /> : "🔍"} {probe === "probing" ? t("s3.probing") : t("s3.probe")}
            </Btn>
            {probe === "ok" && (
              <div className="mt-3">
                <Alert kind="success">{t("s3.probe.ok")}</Alert>
              </div>
            )}
            {probe === "fail" && (
              <div className="mt-3">
                <Alert kind="error">❌ {probeError || t("s3.probe.fail")}</Alert>
              </div>
            )}
          </div>

          {deployError && <Alert kind="error">❌ {deployError}</Alert>}

          <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
            <Btn variant="ghost" onClick={() => setStep(2)}>
              ← {t("build.back")}
            </Btn>
            <Btn
              onClick={deploy}
              disabled={deploying || !baseUrl.trim() || !apiKey.trim() || !model.trim()}
              className="sm:min-w-48"
            >
              {deploying ? <Spinner /> : "🚀"} {deploying ? t("build.deploying") : t("build.deploy")}
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}
