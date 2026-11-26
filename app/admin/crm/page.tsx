import {
  arthaConfig,
  conversations,
  listSessions,
  listWebhooks,
  socialAccounts,
  socialInbox,
  socialPosts,
  socialRules,
  statsOverview,
  waAds,
  wallet,
} from "@/lib/artha";
import { db } from "@/lib/db";
import { integrationView } from "@/lib/integration-settings";
import { metaAdsConfigured, metaCampaigns, metaInsights } from "@/lib/meta";
import { unitPrice } from "@/lib/pricing";
import { segmentCustomers } from "../retention/segments";
import { PageTitle } from "../_ui";
import { CrmUI } from "./CrmUI";
import type { CrmAccount, CrmConversation, CrmData, CrmPost, CrmRule, CrmThread, LeadTemp } from "./types";

export const dynamic = "force-dynamic";
export const metadata = { title: "CRM & WhatsApp" };

const asStrings = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v) as unknown;
      if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
    } catch {}
    return v ? [v] : [];
  }
  return [];
};
const text = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const val = <T,>(r: PromiseSettledResult<T>, fallback: T): T => (r.status === "fulfilled" ? r.value : fallback);

export default async function CrmPage() {
  const d = db();
  const settings = integrationView();
  const rows = segmentCustomers(d);
  const now = Date.now();
  const autoLead = (c: (typeof rows)[number]): LeadTemp => {
    if (c.user.crm?.leadTemp) return c.user.crm.leadTemp;
    const recentOrder = c.lastOrderAt && now - c.lastOrderAt < 14 * 86_400_000;
    const recentInbound = c.user.crm?.lastInboundAt && now - c.user.crm.lastInboundAt < 7 * 86_400_000;
    const recentCart = c.user.cart?.items.length && now - c.user.cart.updatedAt < 7 * 86_400_000;
    if (recentOrder || recentInbound || recentCart || c.segment === "vip") return "hot";
    const activeRecently = now - c.user.lastActiveAt < 30 * 86_400_000 || (c.lastOrderAt && now - c.lastOrderAt < 60 * 86_400_000);
    if (activeRecently) return "warm";
    return "cold";
  };

  const customers = rows.map((c) => ({
    id: c.user.id,
    name: c.user.name,
    email: c.user.email,
    phone: c.user.phone,
    segment: c.segment,
    leadTemp: autoLead(c),
    isManualLead: !!c.user.crm?.leadTemp,
    orders: c.orders,
    spend: c.spend,
    lastOrderAt: c.lastOrderAt,
    tier: { name: c.tier.name, color: c.tier.color },
    whatsappOptIn: c.user.crm?.whatsappOptIn !== false,
    tags: c.user.crm?.tags ?? [],
    lastContactedAt: c.user.crm?.lastContactedAt,
    lastInboundAt: c.user.crm?.lastInboundAt,
    noteCount: c.user.crm?.notes?.length ?? 0,
  })).sort((a, b) => b.spend - a.spend);

  const products = d.products
    .filter((p) => p.active)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 100)
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      brand: p.brand,
      category: p.category,
      price: unitPrice(p),
      mrp: p.mrp,
      image: p.colors[0]?.images[0] ?? "",
      isNew: now - p.createdAt < 14 * 86_400_000,
    }));

  const messages = (d.integrationMessages ?? []).slice(0, 100);
  const errors: string[] = [];

  let sessions: CrmData["sessions"] = [];
  let webhooks: CrmData["webhooks"] = [];
  let accounts: CrmAccount[] = [];
  let rules: CrmRule[] = [];
  let posts: CrmPost[] = [];
  let threads: CrmThread[] = [];
  let conversationRows: CrmConversation[] = [];
  let stats: unknown = null;
  let walletData: unknown = null;
  let adsData: unknown = null;

  if (arthaConfig().configured) {
    const labels = ["Sessions", "Webhooks", "Social accounts", "Social rules", "Posts", "Social inbox", "Conversations", "Stats", "Wallet", "WhatsApp ads"];
    const results = await Promise.allSettled([
      listSessions(),
      listWebhooks(),
      socialAccounts(),
      socialRules(),
      socialPosts(),
      socialInbox(),
      conversations(30),
      statsOverview(),
      wallet(),
      waAds(),
    ]);
    results.forEach((r, i) => { if (r.status === "rejected") errors.push(`${labels[i]}: ${r.reason instanceof Error ? r.reason.message : "failed"}`); });

    sessions = val(results[0], []).map((s) => ({ id: s.id, name: s.name, status: s.status, phone: s.phone, engineType: s.engineType }));
    webhooks = val(results[1], []).map((w) => ({ id: w.id, url: w.url, events: w.events, active: w.active }));
    accounts = val(results[2], []).map((a) => ({
      id: String(a.id),
      platform: text(a.platform),
      accountName: text(a.accountName) ?? text(a.username),
      username: text(a.username),
      enabled: typeof a.enabled === "boolean" ? a.enabled : undefined,
    }));
    rules = val(results[3], []).map((r) => ({
      id: String(r.id),
      name: text(r.name),
      platform: text(r.platform),
      keywords: asStrings(r.keywords),
      replyTemplates: asStrings(r.replyTemplates),
      enabled: typeof r.enabled === "boolean" ? r.enabled : undefined,
    }));
    posts = val(results[4], []).map((p) => ({
      id: String(p.id),
      platform: text(p.platform),
      caption: text(p.caption),
      status: text(p.status),
      scheduledAt: text(p.scheduledAt),
    }));
    threads = val(results[5], []).map((t) => ({
      accountId: text(t.accountId),
      threadId: text(t.threadId),
      id: text(t.id),
      platform: text(t.platform),
      username: text(t.username),
      name: text(t.name),
      lastMessage: text(t.lastMessage),
      updatedAt: text(t.updatedAt),
    }));
    conversationRows = val(results[6], []).map((c, i) => ({
      id: text(c.id) ?? String(i),
      chatId: text(c.chatId),
      contactName: text(c.contactName),
      phone: text(c.phone),
      status: text(c.status),
      lastMessage: text(c.lastMessage),
    }));
    stats = val(results[7], null);
    walletData = val(results[8], null);
    adsData = val(results[9], null);
  } else {
    errors.push("Artha is not configured yet — add the API key and session id in the Settings tab.");
  }

  let metaInsight: CrmData["meta"]["insight"] = null;
  let metaCampaignRows: CrmData["meta"]["campaigns"] = [];
  const metaConfigured = settings.meta.enabled && metaAdsConfigured();
  if (metaConfigured) {
    const [insight, campaigns] = await Promise.allSettled([metaInsights(), metaCampaigns()]);
    if (insight.status === "fulfilled") metaInsight = insight.value;
    else errors.push(`Meta insights: ${insight.reason instanceof Error ? insight.reason.message : "failed"}`);
    if (campaigns.status === "fulfilled") metaCampaignRows = campaigns.value.map((c) => ({ id: c.id, name: c.name, status: c.status, objective: c.objective, daily_budget: c.daily_budget }));
    else errors.push(`Meta campaigns: ${campaigns.reason instanceof Error ? campaigns.reason.message : "failed"}`);
  }

  const data: CrmData = {
    settings,
    customers,
    products,
    messages,
    sessions,
    webhooks,
    accounts,
    rules,
    posts,
    threads,
    conversations: conversationRows,
    stats,
    wallet: walletData,
    waAds: adsData,
    meta: { insight: metaInsight, campaigns: metaCampaignRows, configured: metaConfigured },
    errors,
  };

  return (
    <div>
      <PageTitle title="CRM & WhatsApp">
        <span className={`badge ${settings.whatsapp.configured ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"}`}>
          {settings.whatsapp.configured ? "WhatsApp connected" : "WhatsApp not configured"}
        </span>
      </PageTitle>
      <CrmUI data={data} />
    </div>
  );
}
