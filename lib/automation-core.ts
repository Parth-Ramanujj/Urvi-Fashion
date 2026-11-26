// Pure helpers for the WhatsApp / social CRM: defaults, template rendering, phone normalisation,
// auto-reply matching and queueing. No I/O, so scripts/selfcheck.ts can exercise the logic.
import { randomBytes } from "node:crypto";
import type {
  Automation,
  AutomationKey,
  DB,
  IntegrationChannel,
  IntegrationMessage,
  IntegrationSettings,
  User,
  WhatsAppAutoReplyRule,
} from "./types";

const uid = () => randomBytes(9).toString("base64url");

export const DEFAULT_AUTOMATION_DEFS: Omit<Automation, "id" | "enabled">[] = [
  {
    key: "welcome",
    name: "Welcome message",
    channel: "whatsapp",
    delayMinutes: 0,
    template: "Hi {{first}}, welcome to {{brand}}! 🎉 Your account is ready. Explore new arrivals: {{link}}",
  },
  {
    key: "order_placed",
    name: "Order confirmation",
    channel: "whatsapp",
    delayMinutes: 0,
    template: "Hi {{first}}, your {{brand}} order {{orderRef}} is confirmed. Total {{orderTotal}}. We'll update you when it ships. {{link}}",
  },
  {
    key: "order_shipped",
    name: "Order shipped",
    channel: "whatsapp",
    delayMinutes: 0,
    template: "Good news {{first}}! Order {{orderRef}} has shipped. Track it here: {{link}}",
  },
  {
    key: "order_delivered",
    name: "Order delivered",
    channel: "whatsapp",
    delayMinutes: 0,
    template: "Your {{brand}} order {{orderRef}} was delivered. Hope you love it! Review your picks: {{link}}",
  },
  {
    key: "abandoned_cart",
    name: "Abandoned bag reminder",
    channel: "whatsapp",
    delayMinutes: 60,
    template: "Hi {{first}}, you left {{product}} in your bag. Complete your order before it sells out: {{link}}",
  },
  {
    key: "back_in_stock",
    name: "Back-in-stock alert",
    channel: "whatsapp",
    delayMinutes: 0,
    template: "Hi {{first}}, {{product}} ({{color}}, {{size}}) is back in stock. Grab it here: {{link}}",
  },
  {
    key: "return_update",
    name: "Return / exchange update",
    channel: "whatsapp",
    delayMinutes: 0,
    template: "Hi {{first}}, an update on order {{orderRef}}: {{status}}. {{note}}",
  },
];

export const DEFAULT_AUTO_REPLY_RULES: WhatsAppAutoReplyRule[] = [
  {
    id: "price",
    name: "Price enquiry",
    enabled: true,
    keywords: ["price", "rate", "kitna", "how much", "cost"],
    reply: "Hi {{first}}! Every product page shows the current price, offers and available sizes. Reply with the product link if you need help choosing.",
    oncePerDay: true,
  },
  {
    id: "delivery",
    name: "Delivery enquiry",
    enabled: true,
    keywords: ["delivery", "shipping", "kab", "when will", "track"],
    reply: "Standard delivery is ₹49 (free over ₹1999) and express is ₹149. You can track every order from Account → Orders.",
    oncePerDay: true,
  },
  {
    id: "size",
    name: "Size / fit help",
    enabled: true,
    keywords: ["size", "fit", "measurement", "chart"],
    reply: "Hi {{first}}! Each product page has a size chart and fit notes. Tell us your usual size and we'll help you pick.",
    oncePerDay: true,
  },
  {
    id: "human",
    name: "Talk to a human",
    enabled: true,
    keywords: ["human", "agent", "support", "help", "complaint"],
    reply: "Thanks for reaching out! Our team will reply here shortly. You can also raise a support ticket from your account.",
    oncePerDay: true,
  },
];

const defaultAutomations = (): Automation[] =>
  DEFAULT_AUTOMATION_DEFS.map((a) => ({ ...a, id: a.key, enabled: false }));

export const DEFAULT_INTEGRATIONS: IntegrationSettings = {
  whatsapp: {
    enabled: true,
    baseUrl: "https://artha-qniz.onrender.com",
    apiKey: "",
    sessionId: "",
    webhookSecret: "",
    autoReply: false,
    defaultCountryCode: "91",
    rules: DEFAULT_AUTO_REPLY_RULES,
  },
  social: {
    enabled: true,
    autoReply: false,
    defaultReply: "Thanks for your message! Our team will get back to you shortly.",
    accounts: [],
  },
  meta: {
    enabled: false,
    pixelId: "",
    capiToken: "",
    adsToken: "",
    adAccountId: "",
    pageId: "",
    testEventCode: "",
  },
  automations: defaultAutomations(),
};

/** Fill every missing field without overwriting an admin's explicit choice. */
export function mergeIntegrationDefaults(input?: Partial<IntegrationSettings> | null): IntegrationSettings {
  const d = structuredClone(DEFAULT_INTEGRATIONS);
  if (!input) return d;
  const w = input.whatsapp;
  if (w) {
    d.whatsapp = {
      ...d.whatsapp,
      ...w,
      rules: Array.isArray(w.rules) ? w.rules : d.whatsapp.rules,
    };
  }
  if (input.social) d.social = { ...d.social, ...input.social, accounts: Array.isArray(input.social.accounts) ? input.social.accounts : d.social.accounts };
  if (input.meta) d.meta = { ...d.meta, ...input.meta };
  const stored = Array.isArray(input.automations) ? input.automations : [];
  d.automations = DEFAULT_AUTOMATION_DEFS.map((def) => {
    const found = stored.find((a) => a.key === def.key);
    return found ? { ...def, ...found, id: found.id || def.key } : { ...def, id: def.key, enabled: false };
  });
  d.lastSyncAt = input.lastSyncAt;
  d.lastWebhookAt = input.lastWebhookAt;
  d.updatedAt = input.updatedAt;
  return d;
}

/** Make sure d.integrations is complete; call inside mutate() before queueing. */
export function ensureIntegrations(d: DB): IntegrationSettings {
  const merged = mergeIntegrationDefaults(d.integrations);
  d.integrations = merged;
  return merged;
}

/** Digits-only WhatsApp number: 10-digit local numbers get the store's country code. */
export function phoneDigits(raw: string | undefined | null, countryCode = "91"): string {
  let digits = String(raw ?? "").replace(/\D/g, "");
  const cc = countryCode.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = `${cc}${digits.slice(1)}`;
  if (digits.length === 10 && cc) digits = `${cc}${digits}`;
  return digits;
}

export const whatsappChatId = (raw: string | undefined | null, countryCode = "91") => {
  const digits = phoneDigits(raw, countryCode);
  return digits ? `${digits}@c.us` : "";
};

export const e164 = (raw: string | undefined | null, countryCode = "91") => {
  const digits = phoneDigits(raw, countryCode);
  return digits ? `+${digits}` : "";
};

/** Replace {{name}}, {{ first }} etc. Unknown placeholders become an empty string. */
export function renderTemplate(template: string, vars: Record<string, string | number | undefined | null>): string {
  return String(template ?? "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  }).trim();
}

/** Absolute store link when APP_URL is configured; otherwise the relative path is kept. */
export function storeUrl(path: string): string {
  const p = String(path ?? "");
  if (/^https?:\/\//i.test(p)) return p;
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  if (!base) return p;
  return `${base}${p.startsWith("/") ? "" : "/"}${p}`;
}

const norm = (s: string) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** First enabled rule whose keyword appears in the message. */
export function matchAutoReply(rules: WhatsAppAutoReplyRule[] | undefined, text: string): WhatsAppAutoReplyRule | undefined {
  const hay = norm(text);
  if (!hay) return undefined;
  return (rules ?? []).find((r) => r.enabled && (r.keywords ?? []).some((k) => norm(k) && hay.includes(norm(k))));
}

export function automationOf(settings: IntegrationSettings, key: AutomationKey): Automation | undefined {
  return settings.automations.find((a) => a.key === key);
}

export interface QueueMessageInput {
  channel: IntegrationChannel;
  direction?: "out" | "in";
  to?: string;
  from?: string;
  userId?: string;
  automation?: string;
  body: string;
  status?: IntegrationMessage["status"];
  accountId?: string;
  threadId?: string;
  providerId?: string;
}

/** Append a message to the CRM log. Call inside mutate(). */
export function queueMessage(d: DB, input: QueueMessageInput): IntegrationMessage {
  const msg: IntegrationMessage = {
    id: uid(),
    channel: input.channel,
    direction: input.direction ?? "out",
    to: input.to,
    from: input.from,
    userId: input.userId,
    automation: input.automation,
    body: String(input.body ?? "").slice(0, 4000),
    status: input.status ?? "queued",
    accountId: input.accountId,
    threadId: input.threadId,
    providerId: input.providerId,
    createdAt: Date.now(),
  };
  const list = (d.integrationMessages ??= []);
  list.unshift(msg);
  if (list.length > 2000) list.length = 2000;
  return msg;
}

/** Queue an enabled automation for a customer. Returns null when disabled, opted out or missing a phone. */
export function queueAutomation(
  d: DB,
  key: AutomationKey,
  user: Pick<User, "id" | "name" | "phone" | "crm"> | undefined,
  vars: Record<string, string | number | undefined | null> = {},
): IntegrationMessage | null {
  if (!user) return null;
  const s = ensureIntegrations(d);
  if (!s.whatsapp.enabled) return null;
  const a = automationOf(s, key);
  if (!a?.enabled) return null;
  if (user.crm?.whatsappOptIn === false) return null;
  const digits = phoneDigits(user.phone, s.whatsapp.defaultCountryCode);
  if (!digits) return null;
  const body = renderTemplate(a.template, {
    name: user.name,
    first: user.name.split(" ")[0],
    brand: d.brand?.name ?? "",
    ...vars,
  });
  if (!body) return null;
  const msg = queueMessage(d, { channel: "whatsapp", to: digits, userId: user.id, automation: key, body });
  a.lastRunAt = Date.now();
  a.sent = (a.sent ?? 0) + 1;
  return msg;
}
