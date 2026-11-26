"use server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { segmentCustomers, SEGMENTS, type Segment } from "@/app/admin/retention/segments";
import {
  DEFAULT_AUTOMATION_DEFS,
  phoneDigits,
  queueMessage,
  renderTemplate,
  storeUrl,
  type QueueMessageInput,
} from "./automation-core";
import {
  ArthaError,
  arthaConfig,
  broadcastSocial,
  clearArthaCache,
  createSocialPost,
  createSocialRule,
  createWebhook,
  deleteSocialRule,
  deleteWebhook,
  listSessions,
  replySocial,
  sendWhatsAppText,
  socialAccounts,
  socialInbox,
  socialPosts,
  socialRules,
  toggleSocialRule,
} from "./artha";
import { requireUser } from "./auth";
import { newId } from "./crypto";
import { mutate } from "./db";
import { deliverInBackground, runIntegrationCron } from "./integrations";
import { appBaseUrl, integrationView, rawIntegrations } from "./integration-settings";
import { createMetaCampaign, MetaError, testMetaPixel } from "./meta";
import { fail, run, saveUpload, str } from "./server-utils";
import type { Automation, AutomationKey, IntegrationMessage, IntegrationSettings, WhatsAppAutoReplyRule } from "./types";

export interface IntegrationSettingsInput {
  whatsapp: Omit<IntegrationSettings["whatsapp"], "apiKey" | "webhookSecret"> & { apiKey?: string; webhookSecret?: string };
  social: IntegrationSettings["social"];
  meta: Omit<IntegrationSettings["meta"], "capiToken" | "adsToken"> & { capiToken?: string; adsToken?: string };
  automations: Automation[];
}

const bool = (v: unknown) => v === true;
const int = (v: unknown, min: number, max: number, label: string) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) fail(`${label} must be between ${min} and ${max}`);
  return Math.round(n);
};
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], label: string): T => {
  const v = str(value, 40) as T;
  if (!allowed.includes(v)) fail(`Choose a valid ${label}`);
  return v;
};
const httpUrl = (value: unknown): string => {
  const u = str(value, 500);
  if (u && !/^https?:\/\//i.test(u)) fail("Media URL must start with http:// or https://");
  return u;
};

async function external<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ArthaError || e instanceof MetaError) fail(e.message);
    fail(e instanceof Error ? e.message : "The external service request failed");
  }
}

function cleanRules(input: unknown, current: WhatsAppAutoReplyRule[]): WhatsAppAutoReplyRule[] {
  if (!Array.isArray(input)) return current;
  const rules = input.slice(0, 25).map((raw) => {
    const r = (raw ?? {}) as Partial<WhatsAppAutoReplyRule>;
    const id = str(r.id, 30).toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const name = str(r.name, 50);
    if (!id || id.length < 2) fail("Every auto-reply rule needs an id (2+ letters/numbers)");
    if (!name) fail("Every auto-reply rule needs a name");
    const keywords = (Array.isArray(r.keywords) ? r.keywords : []).map((k) => str(k, 50)).filter(Boolean).slice(0, 25);
    if (!keywords.length) fail(`Add at least one keyword for "${name}"`);
    const reply = str(r.reply, 1200);
    if (reply.length < 2) fail(`Add a reply for "${name}"`);
    return { id, name, enabled: bool(r.enabled), keywords, reply, oncePerDay: bool(r.oncePerDay) };
  });
  if (new Set(rules.map((r) => r.id)).size !== rules.length) fail("Auto-reply rule ids must be unique");
  return rules;
}

export async function saveIntegrationSettings(input: IntegrationSettingsInput) {
  return run(async () => {
    await requireUser("admin");
    const current = rawIntegrations();
    const w = input.whatsapp;
    const baseUrl = (str(w.baseUrl, 200) || current.whatsapp.baseUrl).replace(/\/+$/, "");
    if (!/^https:\/\//i.test(baseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseUrl)) {
      fail("Artha base URL must be HTTPS (localhost HTTP is allowed for development)");
    }
    const country = str(w.defaultCountryCode, 4).replace(/\D/g, "") || "91";
    const apiKey = str(w.apiKey, 400) || current.whatsapp.apiKey;
    const webhookSecret = str(w.webhookSecret, 200) || current.whatsapp.webhookSecret;
    const sessionId = str(w.sessionId, 120);
    if (sessionId && !/^[a-zA-Z0-9_-]{3,120}$/.test(sessionId)) fail("Session id looks invalid");
    const rules = cleanRules(w.rules, current.whatsapp.rules);

    const social = input.social ?? current.social;
    const defaultReply = str(social.defaultReply, 600) || current.social.defaultReply;
    const accounts = (Array.isArray(social.accounts) ? social.accounts : []).map((a) => str(a, 120)).filter(Boolean).slice(0, 30);

    const m = input.meta ?? current.meta;
    const pixelId = str(m.pixelId, 40).replace(/\D/g, "");
    const adAccountId = str(m.adAccountId, 60).replace(/^act_/, "");
    const capiToken = str(m.capiToken, 500) || current.meta.capiToken;
    const adsToken = str(m.adsToken, 500) || current.meta.adsToken;

    const previous = new Map(current.automations.map((a) => [a.key, a]));
    const incoming = Array.isArray(input.automations) ? input.automations : current.automations;
    const automations: Automation[] = DEFAULT_AUTOMATION_DEFS.map((def) => {
      const fromInput = incoming.find((a) => a.key === def.key);
      const prev = previous.get(def.key);
      const template = str(fromInput?.template ?? prev?.template ?? def.template, 1500) || def.template;
      return {
        ...def,
        id: def.key,
        enabled: fromInput ? bool(fromInput.enabled) : !!prev?.enabled,
        delayMinutes: int(fromInput?.delayMinutes ?? prev?.delayMinutes ?? def.delayMinutes, 0, 10_080, `${def.name} delay`),
        template,
        sent: prev?.sent,
        lastRunAt: prev?.lastRunAt,
      };
    });

    await mutate((d) => {
      d.integrations = {
        whatsapp: {
          enabled: bool(w.enabled),
          baseUrl,
          apiKey,
          sessionId,
          webhookSecret,
          autoReply: bool(w.autoReply),
          defaultCountryCode: country,
          rules,
        },
        social: { enabled: bool(social.enabled), autoReply: bool(social.autoReply), defaultReply, accounts },
        meta: {
          enabled: bool(m.enabled),
          pixelId,
          capiToken,
          adsToken,
          adAccountId,
          pageId: str(m.pageId, 60),
          testEventCode: str(m.testEventCode, 40),
        },
        automations,
        lastSyncAt: current.lastSyncAt,
        lastWebhookAt: current.lastWebhookAt,
        updatedAt: Date.now(),
      };
    });
    clearArthaCache();
    revalidatePath("/admin/crm");
    revalidatePath("/", "layout");
    return integrationView();
  });
}

export async function saveAutomation(input: { key: AutomationKey; enabled: boolean; delayMinutes: number; template: string }) {
  return run(async () => {
    await requireUser("admin");
    if (!DEFAULT_AUTOMATION_DEFS.some((a) => a.key === input.key)) fail("Unknown automation");
    const template = str(input.template, 1500);
    if (template.length < 3) fail("Write a message template");
    const delayMinutes = int(input.delayMinutes, 0, 10_080, "Delay");
    await mutate((d) => {
      const s = rawIntegrations();
      const a = s.automations.find((x) => x.key === input.key);
      if (!a) fail("Automation not found");
      a!.enabled = !!input.enabled;
      a!.template = template;
      a!.delayMinutes = delayMinutes;
      d.integrations = { ...s, updatedAt: Date.now() };
    });
    revalidatePath("/admin/crm");
    return { ok: true };
  });
}

export async function saveAutoReplyRule(rule: WhatsAppAutoReplyRule) {
  return run(async () => {
    await requireUser("admin");
    const [clean] = cleanRules([rule], []);
    if (!clean) fail("Invalid auto-reply rule");
    await mutate((d) => {
      const s = rawIntegrations();
      const rules = s.whatsapp.rules.filter((r) => r.id !== clean!.id);
      rules.push(clean!);
      d.integrations = { ...s, whatsapp: { ...s.whatsapp, rules }, updatedAt: Date.now() };
    });
    revalidatePath("/admin/crm");
    return clean;
  });
}

export async function removeAutoReplyRule(id: string) {
  return run(async () => {
    await requireUser("admin");
    await mutate((d) => {
      const s = rawIntegrations();
      const rules = s.whatsapp.rules.filter((r) => r.id !== str(id, 30));
      d.integrations = { ...s, whatsapp: { ...s.whatsapp, rules }, updatedAt: Date.now() };
    });
    revalidatePath("/admin/crm");
    return { ok: true };
  });
}

export async function sendWhatsAppChat(to: string, text: string) {
  return run(async () => {
    await requireUser("admin");
    if (!arthaConfig().configured) fail("Add the Artha API key and session id first");
    const raw = str(to, 120);
    const chatId = raw.includes("@") ? raw : `${phoneDigits(raw, rawIntegrations().whatsapp.defaultCountryCode)}@c.us`;
    if (!/^[0-9]{6,20}@(c|g)\.us$/i.test(chatId)) fail("Enter a valid phone number or WhatsApp chat id");
    const body = str(text, 1200);
    if (!body) fail("Write a message to send");
    const res = await external(() => sendWhatsAppText(chatId, body));
    await mutate((d) => {
      const msg = queueMessage(d, { channel: "whatsapp", to: chatId.replace(/@c\.us$/i, ""), body, status: "sent", providerId: res.id });
      msg.sentAt = Date.now();
    });
    revalidatePath("/admin/crm");
    return { id: res.id };
  });
}

export async function testArthaConnection() {
  return run(async () => {
    await requireUser("admin");
    const sessions = await external(listSessions);
    return {
      count: sessions.length,
      sessions: sessions.map((s) => ({ id: s.id, name: s.name, status: s.status, phone: s.phone, engineType: s.engineType })),
    };
  });
}

export async function syncArthaNow() {
  return run(async () => {
    await requireUser("admin");
    clearArthaCache();
    const results = await Promise.allSettled([listSessions(), socialAccounts(), socialRules(), socialPosts(), socialInbox()]);
    const value = <T>(i: number): T[] => (results[i].status === "fulfilled" ? (results[i].value as T[]) : []);
    const errors = results.flatMap((r) => (r.status === "rejected" ? [r.reason instanceof Error ? r.reason.message : "Request failed"] : []));
    await mutate((d) => {
      d.integrations = { ...rawIntegrations(), lastSyncAt: Date.now() };
    });
    revalidatePath("/admin/crm");
    return {
      sessions: value(0).length,
      accounts: value(1).length,
      rules: value(2).length,
      posts: value(3).length,
      threads: value(4).length,
      errors,
    };
  });
}

export async function registerArthaWebhook() {
  return run(async () => {
    await requireUser("admin");
    const s = rawIntegrations();
    if (!s.whatsapp.apiKey || !s.whatsapp.sessionId) fail("Add the Artha API key and session id first");
    const base = appBaseUrl();
    if (!base) fail("Set APP_URL to your public site URL before registering the webhook");
    if (process.env.NODE_ENV === "production" && !/^https:\/\//i.test(base)) fail("APP_URL must be a public HTTPS URL in production");
    const secret = s.whatsapp.webhookSecret || randomBytes(16).toString("hex");
    if (!s.whatsapp.webhookSecret) {
      await mutate((d) => {
        d.integrations = { ...rawIntegrations(), whatsapp: { ...rawIntegrations().whatsapp, webhookSecret: secret } };
      });
    }
    const url = `${base}/api/integrations/artha/webhook?token=${encodeURIComponent(secret)}`;
    const hook = await external(() => createWebhook({ url, secret }));
    revalidatePath("/admin/crm");
    return hook;
  });
}

export async function removeArthaWebhook(id: string) {
  return run(async () => {
    await requireUser("admin");
    await external(() => deleteWebhook(str(id, 80)));
    clearArthaCache();
    revalidatePath("/admin/crm");
    return { deleted: true };
  });
}

export async function sendWhatsAppTest(phone: string, text: string) {
  return run(async () => {
    await requireUser("admin");
    const s = rawIntegrations();
    if (!arthaConfig().configured) fail("Add the Artha API key and session id first");
    const digits = phoneDigits(phone, s.whatsapp.defaultCountryCode);
    if (digits.length < 10 || digits.length > 15) fail("Enter a valid phone number with country code");
    const body = str(text, 1000);
    if (!body) fail("Write a message to send");
    const res = await external(() => sendWhatsAppText(`${digits}@c.us`, body));
    await mutate((d) => {
      const msg = queueMessage(d, { channel: "whatsapp", to: digits, body, status: "sent", providerId: res.id });
      msg.sentAt = Date.now();
    });
    revalidatePath("/admin/crm");
    return { id: res.id, to: `+${digits}` };
  });
}

export async function sendWhatsAppToCustomer(userId: string, text: string) {
  return run(async () => {
    await requireUser("admin");
    const s = rawIntegrations();
    if (!arthaConfig().configured) fail("Add the Artha API key and session id first");
    const body = str(text, 1200);
    if (body.length < 1) fail("Write a message to send");
    const queued = await mutate((d) => {
      const u = d.users.find((x) => x.id === str(userId, 40));
      if (!u) fail("Customer not found");
      if (u!.crm?.whatsappOptIn === false) fail("This customer opted out of WhatsApp messages");
      const digits = phoneDigits(u!.phone, s.whatsapp.defaultCountryCode);
      if (digits.length < 10 || digits.length > 15) fail("This customer does not have a valid phone number");
      u!.crm ??= { whatsappOptIn: true };
      u!.crm.lastContactedAt = Date.now();
      queueMessage(d, { channel: "whatsapp", to: digits, userId: u!.id, body, automation: "manual", status: "queued" });
      return 1;
    });
    deliverInBackground();
    revalidatePath("/admin/crm");
    revalidatePath(`/admin/customers/${userId}`);
    return { queued };
  });
}

export async function retryIntegrationMessage(id: string) {
  return run(async () => {
    await requireUser("admin");
    const ok = await mutate((d) => {
      const m = (d.integrationMessages ?? []).find((x) => x.id === str(id, 60));
      if (!m || m.channel !== "whatsapp" || m.direction !== "out") fail("WhatsApp message not found");
      if (m!.status === "sent") fail("This message was already sent");
      m!.status = "queued";
      m!.error = undefined;
      m!.claimedAt = undefined;
      return true;
    });
    deliverInBackground();
    revalidatePath("/admin/crm");
    return { ok };
  });
}

export async function updateCrmProfile(userId: string, input: { whatsappOptIn?: boolean; leadTemp?: "hot" | "warm" | "cold" | ""; tags?: string[]; note?: string; source?: string }) {
  return run(async () => {
    const me = await requireUser("admin");
    const id = str(userId, 40);
    const tags = (Array.isArray(input.tags) ? input.tags : []).map((t) => str(t, 30)).filter(Boolean).slice(0, 20);
    const note = str(input.note, 1000);
    await mutate((d) => {
      const u = d.users.find((x) => x.id === id);
      if (!u) fail("Customer not found");
      u!.crm ??= { whatsappOptIn: true };
      if (input.whatsappOptIn !== undefined) u!.crm.whatsappOptIn = !!input.whatsappOptIn;
      if (input.leadTemp !== undefined) {
        u!.crm.leadTemp = ["hot", "warm", "cold"].includes(input.leadTemp) ? (input.leadTemp as "hot" | "warm" | "cold") : undefined;
      }
      if (input.tags !== undefined) u!.crm.tags = tags;
      if (input.source !== undefined) u!.crm.source = str(input.source, 40) || undefined;
      if (note) {
        u!.crm.notes ??= [];
        u!.crm.notes.unshift({ id: newId(6), body: note, at: Date.now(), by: me.name });
        if (u!.crm.notes.length > 50) u!.crm.notes.length = 50;
      }
    });
    revalidatePath("/admin/crm");
    revalidatePath(`/admin/customers/${id}`);
    return { ok: true };
  });
}

export async function sendSegmentWhatsApp(input: { segment: Segment; message: string; confirm: boolean }) {
  return run(async () => {
    await requireUser("admin");
    if (!input.confirm) fail("Tick the confirmation box before sending");
    if (!(input.segment in SEGMENTS)) fail("Choose a segment");
    const message = str(input.message, 1200);
    if (message.length < 3) fail("Write a message");
    const s = rawIntegrations();
    if (!arthaConfig().configured) fail("Add the Artha API key and session id first");
    const sent = await mutate((d) => {
      const customers = segmentCustomers(d).filter((c) => c.segment === input.segment).slice(0, 500);
      let n = 0;
      for (const c of customers) {
        const u = c.user;
        if (u.crm?.whatsappOptIn === false) continue;
        const digits = phoneDigits(u.phone, s.whatsapp.defaultCountryCode);
        if (!digits) continue;
        const body = renderTemplate(message, { name: u.name, first: u.name.split(" ")[0], brand: d.brand?.name ?? "", link: storeUrl("/shop") });
        if (!body) continue;
        queueMessage(d, { channel: "whatsapp", to: digits, userId: u.id, body, automation: `segment:${input.segment}`, status: "queued" });
        d.notifications.push({ id: newId(), userId: u.id, title: "A message from us", body: body.slice(0, 240), href: "/shop", createdAt: Date.now(), readBy: [] });
        n++;
      }
      if (!n) fail("No reachable customers in this segment (need a phone and WhatsApp opt-in)");
      d.campaigns.unshift({ id: newId(), title: "WhatsApp campaign", body: message, href: "/shop", audience: `${SEGMENTS[input.segment].label} (WhatsApp)`, sentAt: Date.now(), reach: n });
      return n;
    });
    deliverInBackground();
    revalidatePath("/admin/crm");
    revalidatePath("/admin/marketing");
    return { sent };
  });
}

export async function sendBulkNumbersWhatsApp(input: { numbers: string; message: string; confirm: boolean }) {
  return run(async () => {
    await requireUser("admin");
    if (!input.confirm) fail("Tick the confirmation box before sending");
    const message = str(input.message, 1500);
    if (message.length < 3) fail("Write a message");
    const s = rawIntegrations();
    if (!arthaConfig().configured) fail("Add the Artha API key and session id first");
    const rawList = String(input.numbers ?? "").split(/[\n,;|\t]+/).map((x) => x.trim()).filter(Boolean);
    const unique = [...new Set(rawList.map((n) => phoneDigits(n, s.whatsapp.defaultCountryCode)).filter((d) => d.length >= 10))].slice(0, 500);
    if (!unique.length) fail("No valid 10-digit phone numbers found");
    const sent = await mutate((d) => {
      const body = renderTemplate(message, { name: "Friend", first: "there", brand: d.brand?.name ?? "", link: storeUrl("/shop") });
      for (const digits of unique) {
        queueMessage(d, { channel: "whatsapp", to: digits, body, automation: "bulk:upload", status: "queued" });
      }
      d.campaigns.unshift({ id: newId(), title: "WhatsApp bulk list", body: message, href: "/shop", audience: `${unique.length} uploaded numbers`, sentAt: Date.now(), reach: unique.length });
      return unique.length;
    });
    deliverInBackground();
    revalidatePath("/admin/crm");
    return { sent };
  });
}

export async function sendProductCampaignWhatsApp(input: {
  productIds: string[];
  audience: "all" | "hot" | "warm" | "cold" | "numbers";
  numbers?: string;
  message: string;
  confirm: boolean;
}) {
  return run(async () => {
    await requireUser("admin");
    if (!input.confirm) fail("Tick the confirmation box before sending");
    const message = str(input.message, 1500);
    if (message.length < 3) fail("Write a message");
    const s = rawIntegrations();
    if (!arthaConfig().configured) fail("Add the Artha API key and session id first");
    const now = Date.now();
    const sent = await mutate((d) => {
      const firstProd = d.products.find((p) => input.productIds.includes(p.id));
      const link = storeUrl(firstProd ? `/product/${firstProd.slug}` : "/shop");
      if (input.audience === "numbers") {
        const rawList = String(input.numbers ?? "").split(/[\n,;|\t]+/).map((x) => x.trim()).filter(Boolean);
        const unique = [...new Set(rawList.map((n) => phoneDigits(n, s.whatsapp.defaultCountryCode)).filter((x) => x.length >= 10))].slice(0, 500);
        if (!unique.length) fail("No valid 10-digit phone numbers found");
        const body = renderTemplate(message, { name: "Friend", first: "there", brand: d.brand?.name ?? "", link });
        for (const digits of unique) queueMessage(d, { channel: "whatsapp", to: digits, body, automation: "product_campaign", status: "queued" });
        d.campaigns.unshift({ id: newId(), title: "New stock WhatsApp", body: message, href: firstProd ? `/product/${firstProd.slug}` : "/shop", audience: `${unique.length} uploaded numbers`, sentAt: now, reach: unique.length });
        return unique.length;
      }

      const segs = segmentCustomers(d);
      const targets = segs.filter((c) => {
        if (input.audience === "all") return true;
        const autoTemp = c.user.crm?.leadTemp
          ?? ((c.lastOrderAt && now - c.lastOrderAt < 14 * 86_400_000) || (c.user.crm?.lastInboundAt && now - c.user.crm.lastInboundAt < 7 * 86_400_000) || c.segment === "vip"
            ? "hot"
            : now - c.user.lastActiveAt < 30 * 86_400_000
              ? "warm"
              : "cold");
        return autoTemp === input.audience;
      }).slice(0, 500);

      let n = 0;
      for (const c of targets) {
        const u = c.user;
        if (u.crm?.whatsappOptIn === false) continue;
        const digits = phoneDigits(u.phone, s.whatsapp.defaultCountryCode);
        if (!digits) continue;
        const body = renderTemplate(message, { name: u.name, first: u.name.split(" ")[0], brand: d.brand?.name ?? "", link });
        queueMessage(d, { channel: "whatsapp", to: digits, userId: u.id, body, automation: `product:${input.audience}`, status: "queued" });
        n++;
      }
      if (!n) fail("No reachable customers found for this audience");
      d.campaigns.unshift({ id: newId(), title: "New stock WhatsApp", body: message, href: firstProd ? `/product/${firstProd.slug}` : "/shop", audience: `${input.audience.toUpperCase()} leads (${n})`, sentAt: now, reach: n });
      return n;
    });
    deliverInBackground();
    revalidatePath("/admin/crm");
    revalidatePath("/admin/marketing");
    return { sent };
  });
}

export async function quickConnectSocialAccount(input: { platform: "instagram" | "facebook"; handle: string }) {
  return run(async () => {
    await requireUser("admin");
    const handle = str(input.handle, 80).replace(/^@+/, "");
    if (handle.length < 2) fail("Enter your Instagram or Facebook username");
    const label = `${input.platform}:${handle}`;
    await mutate((d) => {
      const s = rawIntegrations();
      const accounts = s.social.accounts.includes(label) ? s.social.accounts : [...s.social.accounts, label];
      d.integrations = {
        ...s,
        social: { ...s.social, enabled: true, accounts },
        updatedAt: Date.now(),
      };
    });
    revalidatePath("/admin/crm");
    return { label };
  });
}

export async function uploadPostMedia(form: FormData) {
  return run(async () => {
    await requireUser("admin");
    const url = await saveUpload(form.get("file"));
    if (!url) fail("Choose an image to upload");
    const base = appBaseUrl();
    const fullUrl = url.startsWith("http") ? url : (base ? `${base}${url}` : url);
    return { url: fullUrl };
  });
}

export async function runCronNow() {
  return run(async () => {
    await requireUser("admin");
    const result = await runIntegrationCron();
    revalidatePath("/admin/crm");
    return result;
  });
}

/* ---------------- Social ---------------- */
export async function replySocialMessage(input: { accountId: string; threadId: string; platform: "instagram" | "facebook"; text: string }) {
  return run(async () => {
    await requireUser("admin");
    const platform = oneOf(input.platform, ["instagram", "facebook"] as const, "platform");
    const accountId = str(input.accountId, 120);
    const threadId = str(input.threadId, 200);
    if (!accountId || !threadId) fail("Choose a conversation first");
    const text = str(input.text, 2000);
    if (!text) fail("Write a reply");
    await external(() => replySocial(accountId, threadId, text));
    await mutate((d) => {
      queueMessage(d, { channel: platform, direction: "out", to: threadId, body: text, status: "sent", accountId, threadId });
    });
    revalidatePath("/admin/crm");
    return { sent: true };
  });
}

export async function broadcastSocialMessages(input: { platform: "instagram" | "facebook"; text: string; confirm: boolean }) {
  return run(async () => {
    await requireUser("admin");
    if (!input.confirm) fail("Tick the confirmation box before broadcasting");
    const platform = oneOf(input.platform, ["instagram", "facebook"] as const, "platform");
    const text = str(input.text, 2000);
    if (text.length < 3) fail("Write a message");
    const result = await external(() => broadcastSocial(platform, text));
    await mutate((d) => {
      queueMessage(d, { channel: platform, direction: "out", body: text, status: "sent", accountId: "broadcast" });
    });
    revalidatePath("/admin/crm");
    return result;
  });
}

export async function saveSocialRule(input: {
  name: string; platform?: "all" | "instagram" | "facebook" | "youtube"; appliesTo?: "comments" | "dms" | "both";
  matchType?: "contains" | "exact" | "regex" | "all"; keywords: string[]; replyTemplates: string[];
  autoLike?: boolean; autoDm?: boolean; autoDmTemplate?: string; enabled?: boolean;
}) {
  return run(async () => {
    await requireUser("admin");
    const name = str(input.name, 60);
    const platform = oneOf(input.platform ?? "all", ["all", "instagram", "facebook", "youtube"] as const, "platform");
    const appliesTo = oneOf(input.appliesTo ?? "both", ["comments", "dms", "both"] as const, "applies-to");
    const matchType = oneOf(input.matchType ?? "contains", ["contains", "exact", "regex", "all"] as const, "match type");
    const keywords = (Array.isArray(input.keywords) ? input.keywords : []).map((k) => str(k, 50)).filter(Boolean).slice(0, 25);
    const replies = (Array.isArray(input.replyTemplates) ? input.replyTemplates : []).map((r) => str(r, 800)).filter(Boolean).slice(0, 10);
    const autoDmTemplate = str(input.autoDmTemplate, 800);
    if (!name) fail("Give the rule a name");
    if (!keywords.length) fail("Add at least one keyword");
    if (!replies.length) fail("Add at least one reply");
    const result = await external(() => createSocialRule({ ...input, name, platform, appliesTo, matchType, keywords, replyTemplates: replies, autoDmTemplate: autoDmTemplate || undefined }));
    clearArthaCache();
    revalidatePath("/admin/crm");
    return result;
  });
}

export async function toggleArthaSocialRule(id: string, enabled: boolean) {
  return run(async () => {
    await requireUser("admin");
    const result = await external(() => toggleSocialRule(str(id, 120), !!enabled));
    clearArthaCache();
    revalidatePath("/admin/crm");
    return result;
  });
}

export async function removeArthaSocialRule(id: string) {
  return run(async () => {
    await requireUser("admin");
    const result = await external(() => deleteSocialRule(str(id, 120)));
    clearArthaCache();
    revalidatePath("/admin/crm");
    return result;
  });
}

export async function publishSocialPost(input: {
  platform: "instagram" | "facebook" | "youtube" | "x" | "linkedin";
  caption: string; mediaUrl?: string; mediaType?: "IMAGE" | "VIDEO"; scheduledAt?: string; publishNow?: boolean;
}) {
  return run(async () => {
    await requireUser("admin");
    const platform = oneOf(input.platform, ["instagram", "facebook", "youtube", "x", "linkedin"] as const, "platform");
    const caption = str(input.caption, 2200);
    if (caption.length < 2) fail("Write a caption");
    const mediaUrl = httpUrl(input.mediaUrl);
    const mediaType = input.mediaType ? oneOf(input.mediaType, ["IMAGE", "VIDEO"] as const, "media type") : undefined;
    let scheduledAt: string | undefined;
    if (input.scheduledAt) {
      const at = Date.parse(input.scheduledAt);
      if (!Number.isFinite(at)) fail("Enter a valid schedule time");
      scheduledAt = new Date(at).toISOString();
    }
    const result = await external(() => createSocialPost({ ...input, platform, caption, mediaUrl: mediaUrl || undefined, mediaType, scheduledAt }));
    clearArthaCache();
    revalidatePath("/admin/crm");
    return result;
  });
}

/* ---------------- Meta ---------------- */
export async function testMetaConnection() {
  return run(async () => {
    await requireUser("admin");
    return external(testMetaPixel);
  });
}

export async function createMetaCampaignAction(input: { name: string; objective?: string; dailyBudget?: number }) {
  return run(async () => {
    await requireUser("admin");
    const name = str(input.name, 120);
    if (name.length < 3) fail("Give the campaign a name");
    const objective = oneOf(input.objective ?? "OUTCOME_SALES", ["OUTCOME_SALES", "OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "OUTCOME_AWARENESS"] as const, "objective");
    const budget = Number(input.dailyBudget ?? 0);
    if (!Number.isFinite(budget) || budget < 0 || budget > 10_000_000) fail("Enter a valid daily budget");
    return external(() => createMetaCampaign({ name, objective, dailyBudget: budget }));
  });
}

/* ---------------- Shared types ---------------- */
export type IntegrationMessageRow = IntegrationMessage;
export type AutomationRow = Automation;
export type AutomationKeyName = AutomationKey;
export type QueueInput = QueueMessageInput;
