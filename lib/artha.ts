import "server-only";
import { rawIntegrations } from "./integration-settings";

/*
 * Thin server-side client for the Artha WhatsApp + social API.
 * Docs: https://artha-qniz.onrender.com/api/docs (spec at /api/docs-spec).
 * The API key never leaves the server; admin UI only receives masked values.
 */

export class ArthaError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ArthaError";
    this.status = status;
  }
}

export interface ArthaSession {
  id: string;
  name?: string;
  status?: string;
  engineType?: string | null;
  phone?: string | null;
  pushName?: string | null;
  connectedAt?: string | null;
  lastActive?: string | null;
  createdAt?: string;
  lastError?: string | null;
}

export interface ArthaWebhook {
  id: string;
  sessionId?: string;
  url: string;
  events: string[];
  active?: boolean;
  lastTriggeredAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ArthaAccount {
  id: string;
  platform?: string;
  accountName?: string;
  accountId?: string;
  username?: string;
  enabled?: boolean;
  aiAutoReply?: boolean;
  [key: string]: unknown;
}

export interface ArthaRule {
  id: string;
  name?: string;
  platform?: string;
  appliesTo?: string;
  matchType?: string;
  keywords?: string[];
  replyTemplates?: string[];
  autoDm?: boolean;
  autoDmTemplate?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface ArthaPost {
  id: string;
  platform?: string;
  caption?: string;
  status?: string;
  mediaUrl?: string;
  scheduledAt?: string;
  publishedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ArthaThread {
  accountId?: string;
  threadId?: string;
  id?: string;
  platform?: string;
  username?: string;
  name?: string;
  lastMessage?: string;
  unread?: number;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ArthaConversation {
  id: string;
  sessionId?: string;
  chatId?: string;
  contactName?: string;
  phone?: string;
  status?: string;
  lastMessage?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();
const TTL = 15_000;

export function clearArthaCache() {
  cache.clear();
}

export function arthaConfig() {
  const s = rawIntegrations().whatsapp;
  return {
    baseUrl: s.baseUrl.replace(/\/+$/, ""),
    apiKey: s.apiKey,
    sessionId: s.sessionId,
    webhookSecret: s.webhookSecret,
    configured: !!s.apiKey && !!s.sessionId,
  };
}

function errorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const d = data as Record<string, unknown>;
  const m = d.message ?? d.error ?? (d.data as Record<string, unknown> | undefined)?.message;
  if (Array.isArray(m)) return m.join(", ");
  return typeof m === "string" && m ? m : fallback;
}

async function arthaFetch<T>(path: string, init: RequestInit = {}, opts: { cacheTtl?: number } = {}): Promise<T> {
  const cfg = arthaConfig();
  if (!cfg.apiKey) throw new ArthaError("Artha API key is not configured. Add it in Admin → CRM → Settings.", 0);
  const url = `${cfg.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  const method = (init.method ?? "GET").toUpperCase();
  const key = `${method}:${url}`;
  if (method === "GET" && (opts.cacheTtl ?? TTL) > 0) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < (opts.cacheTtl ?? TTL)) return hit.data as T;
  }
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": cfg.apiKey,
        ...(init.headers ?? {}),
      },
    });
  } catch (e) {
    throw new ArthaError(e instanceof Error && e.name === "TimeoutError" ? "Artha API timed out. Try again." : "Could not reach the Artha API.", 0);
  }
  const text = await res.text().catch(() => "");
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new ArthaError(errorMessage(data, `Artha API error (${res.status})`), res.status);
  if (method !== "GET") cache.clear();
  else cache.set(key, { at: Date.now(), data });
  return data as T;
}

/** Artha sometimes wraps lists in { data: [...] } or { items: [...] }. */
export function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["data", "items", "results", "sessions", "accounts", "posts", "rules", "logs", "threads", "conversations", "contacts"]) {
      if (Array.isArray(d[k])) return d[k] as T[];
    }
  }
  return [];
}

const pickString = (data: unknown, keys: string[]): string | undefined => {
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;
  for (const k of keys) if (typeof d[k] === "string" && d[k]) return d[k] as string;
  for (const wrap of ["data", "message", "result"]) {
    const inner = d[wrap];
    if (inner && typeof inner === "object") {
      const found = pickString(inner, keys);
      if (found) return found;
    }
  }
  return undefined;
};

/* ---------------- Sessions & WhatsApp ---------------- */
export async function listSessions(): Promise<ArthaSession[]> {
  return asList<ArthaSession>(await arthaFetch<unknown>("/api/sessions?limit=50"));
}

export async function sendWhatsAppText(chatId: string, text: string, sessionId?: string): Promise<{ id?: string }> {
  const cfg = arthaConfig();
  const sid = sessionId || cfg.sessionId;
  if (!sid) throw new ArthaError("No WhatsApp session selected. Add a session id in Admin → CRM → Settings.", 0);
  const data = await arthaFetch<unknown>(`/api/sessions/${encodeURIComponent(sid)}/messages/send-text`, {
    method: "POST",
    headers: { "Idempotency-Key": `crm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` },
    body: JSON.stringify({ chatId, text: text.slice(0, 4096) }),
  });
  return { id: pickString(data, ["id", "messageId", "message_id", "waMessageId"]) };
}

export async function listWebhooks(sessionId?: string): Promise<ArthaWebhook[]> {
  const sid = sessionId || arthaConfig().sessionId;
  if (!sid) return [];
  return asList<ArthaWebhook>(await arthaFetch<unknown>(`/api/sessions/${encodeURIComponent(sid)}/webhooks`));
}

export async function createWebhook(input: { url: string; events?: string[]; secret?: string; sessionId?: string }): Promise<ArthaWebhook> {
  const sid = input.sessionId || arthaConfig().sessionId;
  if (!sid) throw new ArthaError("No WhatsApp session selected.", 0);
  return arthaFetch<ArthaWebhook>(`/api/sessions/${encodeURIComponent(sid)}/webhooks`, {
    method: "POST",
    body: JSON.stringify({
      url: input.url,
      events: input.events ?? ["message.received", "message.sent", "message.failed", "session.status", "social.message.received", "social.comment.received"],
      secret: input.secret || undefined,
      retryCount: 3,
    }),
  });
}

export async function deleteWebhook(id: string, sessionId?: string): Promise<void> {
  const sid = sessionId || arthaConfig().sessionId;
  if (!sid) throw new ArthaError("No WhatsApp session selected.", 0);
  await arthaFetch<unknown>(`/api/sessions/${encodeURIComponent(sid)}/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function testWebhook(id: string, sessionId?: string): Promise<unknown> {
  const sid = sessionId || arthaConfig().sessionId;
  if (!sid) throw new ArthaError("No WhatsApp session selected.", 0);
  return arthaFetch<unknown>(`/api/sessions/${encodeURIComponent(sid)}/webhooks/${encodeURIComponent(id)}/test`, { method: "POST" });
}

export async function sessionStats(sessionId?: string): Promise<unknown> {
  const sid = sessionId || arthaConfig().sessionId;
  if (!sid) return null;
  return arthaFetch<unknown>(`/api/stats/sessions/${encodeURIComponent(sid)}`);
}

/* ---------------- Social automation ---------------- */
export async function socialAccounts(): Promise<ArthaAccount[]> {
  return asList<ArthaAccount>(await arthaFetch<unknown>("/api/social-automation/accounts"));
}

export async function socialRules(): Promise<ArthaRule[]> {
  return asList<ArthaRule>(await arthaFetch<unknown>("/api/social-automation/rules"));
}

export async function socialPosts(): Promise<ArthaPost[]> {
  return asList<ArthaPost>(await arthaFetch<unknown>("/api/social-automation/posts"));
}

export async function socialInbox(platform?: string): Promise<ArthaThread[]> {
  const q = platform && platform !== "all" ? `?platform=${encodeURIComponent(platform)}` : "";
  return asList<ArthaThread>(await arthaFetch<unknown>(`/api/social-automation/inbox${q}`));
}

export async function socialLogs(limit = 50): Promise<unknown[]> {
  return asList<unknown>(await arthaFetch<unknown>(`/api/social-automation/logs?limit=${Math.min(200, Math.max(1, limit))}`));
}

export async function socialOverview(): Promise<unknown> {
  return arthaFetch<unknown>("/api/social-automation/overview");
}

export async function socialThread(accountId: string, threadId: string): Promise<unknown> {
  return arthaFetch<unknown>(`/api/social-automation/inbox/${encodeURIComponent(accountId)}/${encodeURIComponent(threadId)}`);
}

export async function replySocial(accountId: string, threadId: string, text: string): Promise<unknown> {
  return arthaFetch<unknown>(`/api/social-automation/inbox/${encodeURIComponent(accountId)}/${encodeURIComponent(threadId)}`, {
    method: "POST",
    body: JSON.stringify({ text: text.slice(0, 2000) }),
  });
}

export async function broadcastSocial(platform: "instagram" | "facebook", text: string): Promise<unknown> {
  return arthaFetch<unknown>("/api/social-automation/inbox/broadcast", {
    method: "POST",
    body: JSON.stringify({ platform, text: text.slice(0, 2000) }),
  });
}

export async function createSocialRule(input: {
  name: string;
  platform?: "all" | "instagram" | "facebook" | "youtube";
  appliesTo?: "comments" | "dms" | "both";
  matchType?: "contains" | "exact" | "regex" | "all";
  keywords: string[];
  replyTemplates: string[];
  autoLike?: boolean;
  autoDm?: boolean;
  autoDmTemplate?: string;
  enabled?: boolean;
}): Promise<unknown> {
  return arthaFetch<unknown>("/api/social-automation/rules", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      platform: input.platform ?? "all",
      appliesTo: input.appliesTo ?? "both",
      matchType: input.matchType ?? "contains",
      keywords: input.keywords,
      replyTemplates: input.replyTemplates,
      autoLike: !!input.autoLike,
      autoDm: !!input.autoDm,
      autoDmTemplate: input.autoDmTemplate || undefined,
      enabled: input.enabled ?? true,
    }),
  });
}

export async function toggleSocialRule(id: string, enabled: boolean): Promise<unknown> {
  return arthaFetch<unknown>(`/api/social-automation/rules/${encodeURIComponent(id)}/toggle`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export async function deleteSocialRule(id: string): Promise<unknown> {
  return arthaFetch<unknown>(`/api/social-automation/rules/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function createSocialPost(input: {
  platform: "instagram" | "facebook" | "youtube" | "x" | "linkedin";
  caption: string;
  mediaUrl?: string;
  mediaType?: "IMAGE" | "VIDEO";
  scheduledAt?: string;
  publishNow?: boolean;
  accountId?: string;
}): Promise<unknown> {
  return arthaFetch<unknown>("/api/social-automation/posts", {
    method: "POST",
    body: JSON.stringify({
      platform: input.platform,
      caption: input.caption,
      mediaUrl: input.mediaUrl || undefined,
      mediaType: input.mediaType ?? "IMAGE",
      scheduledAt: input.scheduledAt || undefined,
      publishNow: !!input.publishNow,
      accountId: input.accountId || undefined,
    }),
  });
}

/* ---------------- Business, stats & wallet ---------------- */
export async function conversations(limit = 50): Promise<ArthaConversation[]> {
  return asList<ArthaConversation>(await arthaFetch<unknown>(`/api/conversations?limit=${Math.min(100, Math.max(1, limit))}`));
}

export async function contacts(search?: string, limit = 50): Promise<unknown[]> {
  const q = new URLSearchParams({ limit: String(Math.min(100, Math.max(1, limit))) });
  if (search?.trim()) q.set("search", search.trim());
  return asList<unknown>(await arthaFetch<unknown>(`/api/contacts?${q}`));
}

export async function waAds(): Promise<unknown> {
  return arthaFetch<unknown>("/api/wa-business/ads");
}

export async function statsOverview(): Promise<unknown> {
  return arthaFetch<unknown>("/api/stats/overview");
}

export async function wallet(): Promise<unknown> {
  return arthaFetch<unknown>("/api/wallet");
}
