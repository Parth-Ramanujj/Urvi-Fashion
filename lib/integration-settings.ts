import "server-only";
import { DEFAULT_INTEGRATIONS, mergeIntegrationDefaults } from "./automation-core";
import { db } from "./db";
import type { IntegrationSettings, IntegrationView } from "./types";

const env = (key: string) => (process.env[key] ?? "").trim();

/** Settings with server-side env fallbacks applied. Never send this to the client. */
export function rawIntegrations(): IntegrationSettings {
  const stored = db().integrations;
  const s = mergeIntegrationDefaults(stored);
  const sw = stored?.whatsapp, sm = stored?.meta;
  const storedBase = (sw?.baseUrl || "").replace(/\/+$/, "");
  const envBase = env("ARTHA_API_URL").replace(/\/+$/, "");
  // A stored default URL must not shadow a custom ARTHA_API_URL; an explicit admin URL still wins.
  s.whatsapp.baseUrl = (storedBase && storedBase !== DEFAULT_INTEGRATIONS.whatsapp.baseUrl ? storedBase : envBase || DEFAULT_INTEGRATIONS.whatsapp.baseUrl).replace(/\/+$/, "");
  s.whatsapp.apiKey = sw?.apiKey || env("ARTHA_API_KEY");
  s.whatsapp.sessionId = sw?.sessionId || env("ARTHA_SESSION_ID");
  s.whatsapp.webhookSecret = sw?.webhookSecret || env("INTEGRATION_WEBHOOK_SECRET");
  s.meta.pixelId = sm?.pixelId || env("META_PIXEL_ID");
  s.meta.capiToken = sm?.capiToken || env("META_CAPI_TOKEN");
  s.meta.adsToken = sm?.adsToken || env("META_ADS_TOKEN");
  s.meta.adAccountId = sm?.adAccountId || env("META_AD_ACCOUNT_ID");
  s.meta.pageId = sm?.pageId || env("META_PAGE_ID");
  s.meta.testEventCode = sm?.testEventCode || env("META_TEST_EVENT_CODE");
  return s;
}

export const maskSecret = (v: string | undefined | null) => {
  const s = String(v ?? "");
  if (!s) return "";
  return s.length <= 6 ? "••••••" : `••••${s.slice(-4)}`;
};

export function appBaseUrl(): string {
  const direct = env("APP_URL") || env("NEXT_PUBLIC_APP_URL") || env("NEXT_PUBLIC_SITE_URL");
  if (direct) return direct.replace(/\/+$/, "");
  const vercel = env("VERCEL_URL");
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "";
}

/** Safe shape for admin client components: tokens are replaced with masks / booleans. */
export function integrationView(): IntegrationView {
  const s = rawIntegrations();
  const { apiKey, webhookSecret, ...whatsapp } = s.whatsapp;
  const { capiToken, adsToken, ...meta } = s.meta;
  return {
    whatsapp: {
      ...whatsapp,
      apiKeyMasked: maskSecret(apiKey),
      webhookSecretSet: !!webhookSecret,
      configured: !!apiKey && !!whatsapp.sessionId,
    },
    social: s.social,
    meta: { ...meta, capiConfigured: !!capiToken, adsConfigured: !!adsToken },
    automations: s.automations,
    webhookUrl: appBaseUrl() ? `${appBaseUrl()}/api/integrations/artha/webhook` : "/api/integrations/artha/webhook",
    lastSyncAt: s.lastSyncAt,
    lastWebhookAt: s.lastWebhookAt,
    updatedAt: s.updatedAt,
  };
}

/** Meta Pixel id is public by design; only expose it when tracking is switched on. */
export function metaPixelId(): string {
  const s = rawIntegrations();
  return s.meta.enabled ? s.meta.pixelId : "";
}
