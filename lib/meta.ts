import "server-only";
import { createHash } from "node:crypto";
import { phoneDigits } from "./automation-core";
import { rawIntegrations } from "./integration-settings";

/*
 * Meta (Facebook/Instagram) Conversions API + Marketing API helpers.
 * Tokens are optional: every function throws a readable MetaError when the
 * matching credential is missing, so the admin UI can show setup instructions.
 */

export class MetaError extends Error {
  code: number;
  constructor(message: string, code = 0) {
    super(message);
    this.name = "MetaError";
    this.code = code;
  }
}

export interface MetaCampaign {
  id: string;
  name?: string;
  status?: string;
  objective?: string;
  daily_budget?: string;
  created_time?: string;
  [key: string]: unknown;
}

export interface MetaInsight {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  reach?: string;
  actions?: { action_type: string; value: string }[];
  [key: string]: unknown;
}

export function metaConfig() {
  const s = rawIntegrations().meta;
  const acct = s.adAccountId.trim();
  return {
    enabled: s.enabled,
    pixelId: s.pixelId.trim(),
    capiToken: s.capiToken,
    adsToken: s.adsToken,
    adAccountId: acct && !acct.startsWith("act_") ? `act_${acct}` : acct,
    pageId: s.pageId.trim(),
    testEventCode: s.testEventCode.trim(),
    version: (process.env.META_API_VERSION || "v21.0").trim(),
  };
}

export const metaPixelConfigured = () => {
  const c = metaConfig();
  return !!c.pixelId && !!c.capiToken;
};
export const metaAdsConfigured = () => {
  const c = metaConfig();
  return !!c.adsToken && !!c.adAccountId;
};

const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

async function graph<T>(path: string, init: { token: string; method?: "GET" | "POST"; query?: Record<string, string>; body?: unknown }): Promise<T> {
  const c = metaConfig();
  const q = new URLSearchParams({ ...(init.query ?? {}), access_token: init.token });
  const url = `https://graph.facebook.com/${c.version}/${path.replace(/^\/+/, "")}?${q}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: init.body ? { "content-type": "application/json" } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new MetaError("Could not reach the Meta Graph API.", 0);
  }
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const err = (data as { error?: { message?: string; code?: number } } | null)?.error;
    throw new MetaError(err?.message || `Meta API error (${res.status})`, err?.code ?? res.status);
  }
  return data as T;
}

export interface MetaEventInput {
  eventId: string;
  value?: number;
  currency?: string;
  email?: string;
  phone?: string;
  productIds?: string[];
  contents?: { id: string; quantity: number; item_price: number }[];
  orderId?: string;
  sourceUrl?: string;
  clientIp?: string;
  userAgent?: string;
  fbc?: string;
  fbp?: string;
}

/** Send any standard event to the Conversions API (Purchase, ViewContent, AddToCart...). */
export async function sendMetaEvent(eventName: string, input: MetaEventInput): Promise<{ events_received?: number }> {
  const c = metaConfig();
  if (!c.enabled) throw new MetaError("Meta tracking is switched off in Admin → CRM → Settings.", 0);
  if (!c.pixelId) throw new MetaError("Add your Meta Pixel id in Admin → CRM → Settings.", 0);
  if (!c.capiToken) throw new MetaError("Add a Meta Conversions API token in Admin → CRM → Settings.", 0);
  const phone = phoneDigits(input.phone, "91");
  const user_data: Record<string, unknown> = {
    em: input.email ? [sha256(input.email)] : undefined,
    ph: phone ? [sha256(phone)] : undefined,
    client_ip_address: input.clientIp || undefined,
    client_user_agent: input.userAgent || undefined,
    fbc: input.fbc || undefined,
    fbp: input.fbp || undefined,
  };
  for (const k of Object.keys(user_data)) if (user_data[k] === undefined) delete user_data[k];
  const custom_data: Record<string, unknown> = {
    currency: input.currency || "INR",
    value: input.value,
    order_id: input.orderId || undefined,
    content_type: "product",
    content_ids: input.productIds?.length ? input.productIds : undefined,
    contents: input.contents?.length ? input.contents : undefined,
  };
  for (const k of Object.keys(custom_data)) if (custom_data[k] === undefined) delete custom_data[k];
  return graph<{ events_received?: number }>(`${c.pixelId}/events`, {
    token: c.capiToken,
    method: "POST",
    body: {
      data: [{
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.sourceUrl || undefined,
        user_data,
        custom_data,
      }],
      test_event_code: c.testEventCode || undefined,
    },
  });
}

/** Check the Pixel + CAPI token without sending an event. */
export async function testMetaPixel(): Promise<{ id: string; name?: string }> {
  const c = metaConfig();
  if (!c.pixelId || !c.capiToken) throw new MetaError("Add both a Pixel id and a Conversions API token first.", 0);
  return graph<{ id: string; name?: string }>(c.pixelId, { token: c.capiToken, query: { fields: "id,name" } });
}

export async function metaInsights(datePreset = "last_30d"): Promise<MetaInsight | null> {
  const c = metaConfig();
  if (!c.adsToken || !c.adAccountId) throw new MetaError("Add a Meta ads token and ad account id first.", 0);
  const data = await graph<{ data?: MetaInsight[] }>(`${c.adAccountId}/insights`, {
    token: c.adsToken,
    query: { fields: "spend,impressions,clicks,ctr,cpc,reach,actions", date_preset: datePreset },
  });
  return data.data?.[0] ?? null;
}

export async function metaCampaigns(limit = 25): Promise<MetaCampaign[]> {
  const c = metaConfig();
  if (!c.adsToken || !c.adAccountId) throw new MetaError("Add a Meta ads token and ad account id first.", 0);
  const data = await graph<{ data?: MetaCampaign[] }>(`${c.adAccountId}/campaigns`, {
    token: c.adsToken,
    query: { fields: "id,name,status,objective,daily_budget,created_time", limit: String(Math.min(100, Math.max(1, limit))) },
  });
  return data.data ?? [];
}

/** Creates a PAUSED campaign so nothing can spend before the admin reviews it in Ads Manager. */
export async function createMetaCampaign(input: { name: string; objective?: string; dailyBudget?: number }): Promise<{ id: string }> {
  const c = metaConfig();
  if (!c.adsToken || !c.adAccountId) throw new MetaError("Add a Meta ads token and ad account id first.", 0);
  const budget = Number(input.dailyBudget ?? 0);
  return graph<{ id: string }>(`${c.adAccountId}/campaigns`, {
    token: c.adsToken,
    method: "POST",
    body: {
      name: input.name,
      objective: input.objective || "OUTCOME_SALES",
      status: "PAUSED",
      special_ad_categories: [],
      ...(budget > 0 ? { daily_budget: Math.round(budget * 100) } : {}),
    },
  });
}
