import type { IntegrationMessage, IntegrationView } from "@/lib/types";
import type { Segment } from "../retention/segments";

export interface CrmCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  segment: Segment;
  orders: number;
  spend: number;
  lastOrderAt: number | null;
  tier: { name: string; color: string };
  whatsappOptIn: boolean;
  tags: string[];
  lastContactedAt?: number;
  lastInboundAt?: number;
  noteCount: number;
}

export interface CrmSession { id: string; name?: string; status?: string; phone?: string | null; engineType?: string | null }
export interface CrmWebhook { id: string; url: string; events?: string[]; active?: boolean }
export interface CrmAccount { id: string; platform?: string; accountName?: string; username?: string; enabled?: boolean }
export interface CrmRule { id: string; name?: string; platform?: string; keywords?: string[]; replyTemplates?: string[]; enabled?: boolean }
export interface CrmPost { id: string; platform?: string; caption?: string; status?: string; scheduledAt?: string }
export interface CrmThread { accountId?: string; threadId?: string; id?: string; platform?: string; username?: string; name?: string; lastMessage?: string; updatedAt?: string }
export interface CrmConversation { id: string; chatId?: string; contactName?: string; phone?: string; status?: string; lastMessage?: string }
export interface CrmMetaCampaign { id: string; name?: string; status?: string; objective?: string; daily_budget?: string }
export interface CrmMetaInsight { spend?: string; impressions?: string; clicks?: string; ctr?: string; cpc?: string; reach?: string }

export interface CrmData {
  settings: IntegrationView;
  customers: CrmCustomer[];
  messages: IntegrationMessage[];
  sessions: CrmSession[];
  webhooks: CrmWebhook[];
  accounts: CrmAccount[];
  rules: CrmRule[];
  posts: CrmPost[];
  threads: CrmThread[];
  conversations: CrmConversation[];
  stats: unknown;
  wallet: unknown;
  waAds: unknown;
  meta: { insight: CrmMetaInsight | null; campaigns: CrmMetaCampaign[]; configured: boolean };
  errors: string[];
}
