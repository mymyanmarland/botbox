// Production builds use relative URLs (same-origin, nginx proxies /api).
// Local `npm run dev` defaults to the backend on :4000 unless overridden.
const BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? "http://localhost:4000" : "");

export interface ValidateTokenRes {
  ok: boolean;
  name?: string;
  username?: string;
  error?: string;
}

export interface ProbeRes {
  ok: boolean;
  error?: string;
}

export interface CreateBotRes {
  ok?: boolean;
  bot_id: string;
  username: string;
  manage_secret: string;
  error?: string;
}

export interface BotInfo {
  id: string;
  name: string;
  username: string;
  status: "running" | "stopped";
  persona_id: string | null;
  custom_prompt: string | null;
  base_url: string;
  model: string;
  key_masked: string;
  allowed_users: string;
  image_model: string;
  created_at: string;
}

export interface BotStats {
  total_messages: number;
  today_messages: number;
  limit: number;
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError("network");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `HTTP ${res.status}`;
    throw new ApiError(msg);
  }
  return data as T;
}

export const api = {
  health: () => req<{ ok: boolean }>("/api/health"),
  validateToken: (token: string) =>
    req<ValidateTokenRes>("/api/bots/validate-token", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  probe: (base_url: string, api_key: string, model: string) =>
    req<ProbeRes>("/api/bots/probe", {
      method: "POST",
      body: JSON.stringify({ base_url, api_key, model }),
    }),
  createBot: (body: {
    token: string;
    persona_id?: string;
    custom_prompt?: string;
    base_url: string;
    api_key: string;
    model: string;
    image_model?: string;
  }) => req<CreateBotRes>("/api/bots", { method: "POST", body: JSON.stringify(body) }),
  getBot: (secret: string) => req<BotInfo>(`/api/bots/${encodeURIComponent(secret)}`),
  updateBot: (secret: string, body: Record<string, unknown>) =>
    req<{ ok: boolean }>(`/api/bots/${encodeURIComponent(secret)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  startBot: (secret: string) =>
    req<{ ok: boolean }>(`/api/bots/${encodeURIComponent(secret)}/start`, { method: "POST" }),
  stopBot: (secret: string) =>
    req<{ ok: boolean }>(`/api/bots/${encodeURIComponent(secret)}/stop`, { method: "POST" }),
  rotateSecret: (secret: string) =>
    req<{ manage_secret: string }>(`/api/bots/${encodeURIComponent(secret)}/rotate`, { method: "POST" }),
  deleteBot: (secret: string) =>
    req<{ ok: boolean }>(`/api/bots/${encodeURIComponent(secret)}/delete`, { method: "POST" }),
  getStats: (secret: string) => req<BotStats>(`/api/bots/${encodeURIComponent(secret)}/stats`),
  listModels: (base_url: string, api_key: string) =>
    req<{ ok: boolean; models?: string[]; error?: string }>("/api/bots/models", {
      method: "POST",
      body: JSON.stringify({ base_url, api_key }),
    }),
};

export function friendlyError(e: unknown, t: (k: "err.network" | "err.generic") => string): string {
  if (e instanceof ApiError) {
    if (e.message === "network") return t("err.network");
    return e.message;
  }
  return t("err.generic");
}

// ---- Owner admin panel ----
const ADMIN_TOKEN_KEY = "botbox_admin_token";

function adminHeaders(): Record<string, string> {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function adminReq<T>(path: string, init?: RequestInit): Promise<T> {
  return req<T>(path, {
    ...init,
    headers: { ...adminHeaders(), ...((init && init.headers) || {}) },
  });
}

export interface AdminBot {
  id: number;
  name: string | null;
  username: string | null;
  persona_id: string;
  model: string;
  base_url: string;
  status: "running" | "stopped";
  created_at: number;
  totalMessages: number;
  todayUsage: number;
  allowed_users: string;
  image_model: string | null;
}

export interface AdminStats {
  botsTotal: number;
  running: number;
  messagesToday: number;
  messagesTotal: number;
}

export interface AdminMessage {
  user_id: string;
  role: string;
  content: string;
  created_at: number;
}

export const adminApi = {
  hasToken: () => !!localStorage.getItem(ADMIN_TOKEN_KEY),
  setToken: (t: string | null) => {
    if (t) localStorage.setItem(ADMIN_TOKEN_KEY, t);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  },
  status: () => req<{ setupRequired: boolean }>("/api/admin/status"),
  setup: (password: string) =>
    req<{ ok: boolean; token?: string; error?: string }>("/api/admin/setup", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  login: (password: string) =>
    req<{ ok: boolean; token?: string; error?: string }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: () => adminReq<{ ok: boolean }>("/api/admin/logout", { method: "POST" }),
  stats: () => adminReq<{ ok: boolean } & AdminStats>("/api/admin/stats"),
  bots: () => adminReq<{ ok: boolean; bots: AdminBot[] }>("/api/admin/bots"),
  startBot: (id: number) =>
    adminReq<{ ok: boolean; error?: string }>(`/api/admin/bots/${id}/start`, { method: "POST" }),
  stopBot: (id: number) =>
    adminReq<{ ok: boolean; error?: string }>(`/api/admin/bots/${id}/stop`, { method: "POST" }),
  deleteBot: (id: number) =>
    adminReq<{ ok: boolean; error?: string }>(`/api/admin/bots/${id}`, { method: "DELETE" }),
  messages: (id: number, limit = 50) =>
    adminReq<{ ok: boolean; messages: AdminMessage[] }>(
      `/api/admin/bots/${id}/messages?limit=${limit}`
    ),
};
