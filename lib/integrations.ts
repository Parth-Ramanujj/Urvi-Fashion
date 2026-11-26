import "server-only";
import { createHmac } from "node:crypto";
import { after } from "next/server";
import { ensureIntegrations, matchAutoReply, phoneDigits, queueAutomation, queueMessage, renderTemplate, storeUrl } from "./automation-core";
import { ArthaError, arthaConfig, replySocial, sendWhatsAppText } from "./artha";
import { safeEqual } from "./crypto";
import { db, mutate } from "./db";
import { rawIntegrations } from "./integration-settings";
import { sendMetaEvent, type MetaEventInput } from "./meta";
import type { DB, IntegrationMessage } from "./types";

/* ---------------- Outbound delivery ---------------- */
async function claimQueued(limit: number): Promise<IntegrationMessage[]> {
  const ids = await mutate((d) => {
    const now = Date.now();
    const out: string[] = [];
    const list = d.integrationMessages ?? [];
    for (let i = list.length - 1; i >= 0 && out.length < limit; i--) {
      const m = list[i];
      if (m.channel !== "whatsapp" || m.direction !== "out") continue;
      const stale = m.status === "sending" && now - (m.claimedAt ?? 0) > 120_000;
      if (m.status !== "queued" && !stale) continue;
      m.status = "sending";
      m.claimedAt = now;
      out.push(m.id);
    }
    return out;
  });
  const d = db();
  return ids.map((id) => d.integrationMessages?.find((m) => m.id === id)).filter(Boolean) as IntegrationMessage[];
}

/** Send every claimed WhatsApp message through Artha and update its status. */
export async function deliverQueuedMessages(limit = 20): Promise<{ sent: number; failed: number; pending: number }> {
  const settings = rawIntegrations();
  if (!settings.whatsapp.enabled) return { sent: 0, failed: 0, pending: 0 };
  const cfg = arthaConfig();
  if (!cfg.configured) return { sent: 0, failed: 0, pending: 0 };
  const claimed = await claimQueued(Math.min(50, Math.max(1, limit)));
  let sent = 0, failed = 0;
  for (const m of claimed) {
    try {
      const res = await sendWhatsAppText(`${m.to}@c.us`, m.body);
      await mutate((d) => {
        const x = d.integrationMessages?.find((y) => y.id === m.id);
        if (x && x.status === "sending") {
          x.status = "sent";
          x.sentAt = Date.now();
          x.providerId = res.id || x.providerId;
          x.error = undefined;
        }
      });
      sent++;
    } catch (e) {
      const error = e instanceof ArthaError ? e.message : "Could not send WhatsApp message";
      await mutate((d) => {
        const x = d.integrationMessages?.find((y) => y.id === m.id);
        if (x && x.status === "sending") {
          x.status = "failed";
          x.error = error.slice(0, 300);
        }
      });
      failed++;
    }
  }
  return { sent, failed, pending: Math.max(0, claimed.length - sent - failed) };
}

/** Run delivery after the current response; safe to call from any server action. */
export function deliverInBackground() {
  try {
    after(async () => {
      await deliverQueuedMessages(20).catch((e) => console.error("[integrations] delivery failed", e));
    });
  } catch {
    void deliverQueuedMessages(20).catch((e) => console.error("[integrations] delivery failed", e));
  }
}

/* ---------------- Inbound webhook ---------------- */
export interface WebhookResult {
  event: string;
  inbound: boolean;
  replyQueued: boolean;
  note?: string;
}

const firstString = (values: unknown[]): string => {
  for (const v of values) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
};
const firstBool = (values: unknown[]): boolean | undefined => {
  for (const v of values) if (typeof v === "boolean") return v;
  return undefined;
};

function parsePayload(body: unknown) {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const data = (b.data && typeof b.data === "object" ? b.data : b.payload && typeof b.payload === "object" ? b.payload : b) as Record<string, unknown>;
  const message = (data.message && typeof data.message === "object" ? data.message : data.msg && typeof data.msg === "object" ? data.msg : data) as Record<string, unknown>;
  const inner = (message.message && typeof message.message === "object" ? message.message : {}) as Record<string, unknown>;
  const event = firstString([b.event, b.type, b.eventType, b.name, data.event, data.type]);
  const from = firstString([message.from, message.sender, message.chatId, message.author, data.from, data.sender, data.chatId]);
  const text = firstString([message.body, message.text, message.content, inner.text, message.caption, data.body, data.text, data.comment]);
  const id = firstString([message.id, message.messageId, data.id, data.messageId]);
  const platform = firstString([data.platform, message.platform, b.platform]).toLowerCase();
  const accountId = firstString([data.accountId, data.account_id, b.accountId]);
  const threadId = firstString([data.threadId, data.thread_id, data.conversationId, b.threadId]);
  const fromMe = firstBool([message.fromMe, message.from_me, data.fromMe]);
  return { event, from, text, id, platform, accountId, threadId, fromMe, data, message };
}

/** Verify the Artha webhook token (?token=) or an HMAC signature when a secret is configured. */
export function verifyWebhook(rawBody: string, headers: Headers, url: URL): boolean {
  const secret = rawIntegrations().whatsapp.webhookSecret;
  // Fail closed: without a configured secret anyone could forge inbound messages and auto-replies.
  if (!secret) return false;
  const token = url.searchParams.get("token");
  if (token && safeEqual(token, secret)) return true;
  const headerSecret = headers.get("x-artha-secret") || headers.get("x-webhook-secret");
  if (headerSecret && safeEqual(headerSecret, secret)) return true;
  const sig = headers.get("x-artha-signature") || headers.get("x-webhook-signature") || headers.get("x-hub-signature-256") || headers.get("x-signature");
  if (!sig) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(sig.replace(/^sha256=/i, "").trim(), expected);
}

/** Log an inbound event, update the CRM profile and queue an auto-reply when a rule matches. */
export async function processArthaWebhook(body: unknown): Promise<WebhookResult> {
  const p = parsePayload(body);
  const event = p.event || "unknown";
  const social = /social/i.test(event);

  if (social) {
    const channel = (["instagram", "facebook", "messenger", "telegram", "youtube"].includes(p.platform) ? p.platform : "system") as IntegrationMessage["channel"];
    let replyQueued = false;
    let inbound = false;
    await mutate((d) => {
      const s = ensureIntegrations(d);
      s.lastWebhookAt = Date.now();
      const duplicate = !!p.id && (d.integrationMessages ?? []).some((m) => m.direction === "in" && m.providerId === p.id && m.channel === channel);
      if (p.fromMe || duplicate) return;
      if (p.text) {
        queueMessage(d, { channel, direction: "in", from: p.accountId || p.from, body: p.text, status: "received", accountId: p.accountId, threadId: p.threadId, providerId: p.id });
        inbound = true;
      }
    });
    const s = rawIntegrations();
    if (inbound && s.social.enabled && s.social.autoReply && p.text && p.accountId && p.threadId && ["instagram", "facebook"].includes(p.platform)) {
      const reply = renderTemplate(s.social.defaultReply, { name: "", first: "", brand: db().brand?.name ?? "", link: storeUrl("/") });
      if (reply) {
        try {
          await replySocial(p.accountId, p.threadId, reply);
          await mutate((d) => {
            queueMessage(d, { channel, direction: "out", to: p.threadId, body: reply, status: "sent", accountId: p.accountId, threadId: p.threadId, automation: "social_auto_reply" });
          });
          replyQueued = true;
        } catch (e) {
          console.error("[integrations] social auto-reply failed", e);
        }
      }
    }
    return { event, inbound, replyQueued };
  }

  if (!/message\.(received|failed|ack|sent)/i.test(event)) {
    await mutate((d) => { ensureIntegrations(d).lastWebhookAt = Date.now(); });
    return { event, inbound: false, replyQueued: false };
  }

  if (/message\.(failed|ack|sent)/i.test(event) && !/received/i.test(event)) {
    await mutate((d) => {
      const m = (d.integrationMessages ?? []).find((x) => (p.id && (x.providerId === p.id || x.id === p.id)) || false);
      if (m) {
        if (/failed/i.test(event)) {
          m.status = "failed";
          m.error = firstString([p.data.error, p.data.reason, p.message.error]) || "Artha reported a delivery failure";
        } else {
          m.status = "sent";
          m.sentAt = m.sentAt ?? Date.now();
        }
      }
      ensureIntegrations(d).lastWebhookAt = Date.now();
    });
    return { event, inbound: false, replyQueued: false };
  }

  if (p.fromMe || !p.from || p.from.endsWith("@g.us") || p.from === "status@broadcast") {
    return { event, inbound: false, replyQueued: false, note: "Ignored group/self message" };
  }

  const digits = phoneDigits(p.from, rawIntegrations().whatsapp.defaultCountryCode);
  let inbound = false;
  let replyQueued = false;

  await mutate((d) => {
    const s = ensureIntegrations(d);
    s.lastWebhookAt = Date.now();
    const duplicate = !!p.id && (d.integrationMessages ?? []).some((m) => m.direction === "in" && m.providerId === p.id);
    if (duplicate) return;
    const user = d.users.find((u) => phoneDigits(u.phone, s.whatsapp.defaultCountryCode) === digits);
    if (user) {
      user.crm ??= { whatsappOptIn: true };
      user.crm.lastInboundAt = Date.now();
    }
    if (p.text) {
      queueMessage(d, {
        channel: "whatsapp",
        direction: "in",
        from: digits,
        userId: user?.id,
        body: p.text,
        status: "received",
        providerId: p.id || undefined,
      });
      inbound = true;
    }
    if (!s.whatsapp.enabled || !s.whatsapp.autoReply || !p.text) return;
    const rule = matchAutoReply(s.whatsapp.rules, p.text);
    if (!rule) return;
    const automation = `auto_reply:${rule.id}`;
    if (rule.oncePerDay) {
      const dayAgo = Date.now() - 86_400_000;
      const already = (d.integrationMessages ?? []).some((m) =>
        m.automation === automation && m.createdAt >= dayAgo && (m.userId ? m.userId === user?.id : m.to === digits),
      );
      if (already) return;
    }
    const reply = renderTemplate(rule.reply, {
      name: user?.name ?? "",
      first: user?.name.split(" ")[0] ?? "",
      brand: d.brand?.name ?? "",
      link: storeUrl("/"),
    });
    if (!reply) return;
    queueMessage(d, { channel: "whatsapp", to: digits, userId: user?.id, automation, body: reply });
    replyQueued = true;
  });

  return { event, inbound, replyQueued };
}

/* ---------------- Scheduled jobs ---------------- */
/** Queue WhatsApp reminders for abandoned bags (respects opt-outs and never duplicates). */
export async function queueAbandonedCarts(): Promise<number> {
  const s = rawIntegrations();
  const a = s.automations.find((x) => x.key === "abandoned_cart");
  if (!a?.enabled || !s.whatsapp.enabled || !s.whatsapp.apiKey || !s.whatsapp.sessionId) return 0;
  return mutate((d) => {
    if (!d.retention.abandonedCart.enabled) return 0;
    const cutoff = Date.now() - d.retention.abandonedCart.afterHours * 3_600_000;
    let n = 0;
    for (const u of d.users) {
      const c = u.cart;
      if (u.blocked || !c?.items.length || c.updatedAt > cutoff) continue;
      if (u.crm?.whatsappOptIn === false) continue;
      if (c.remindedAt && c.remindedAt >= c.updatedAt) continue;
      const already = (d.integrationMessages ?? []).some((m) => m.userId === u.id && m.automation === "abandoned_cart" && m.createdAt >= c.updatedAt);
      if (already) continue;
      const names = c.items.map((i) => i.name);
      const product = `${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2} more` : ""}`;
      if (queueAutomation(d, "abandoned_cart", u, { product, link: storeUrl("/cart") })) {
        c.remindedAt = Date.now();
        n++;
      }
    }
    return n;
  });
}

/** Protected cron entry point: queue due reminders, then flush the outbox. */
export async function runIntegrationCron() {
  const abandoned = await queueAbandonedCarts();
  const delivery = await deliverQueuedMessages(50);
  return { abandoned, ...delivery };
}

/** Fire a Meta Purchase event without delaying the order response. */
export function trackMetaPurchaseInBackground(input: MetaEventInput) {
  const send = () => sendMetaEvent("Purchase", input).catch((e) => console.error("[meta] purchase event failed", e));
  try {
    after(send);
  } catch {
    void send();
  }
}

/** Convenience used by actions that already know the customer. */
export function whatsappOptedIn(d: DB, userId: string): boolean {
  return d.users.find((u) => u.id === userId)?.crm?.whatsappOptIn !== false;
}
