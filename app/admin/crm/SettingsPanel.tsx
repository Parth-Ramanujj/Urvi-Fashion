"use client";
import { useState } from "react";
import { Copy, Link2, Send, Trash2, Webhook } from "lucide-react";
import { useApp } from "@/components/Providers";
import { registerArthaWebhook, removeArthaWebhook, saveIntegrationSettings, sendWhatsAppTest, testArthaConnection } from "@/lib/integration-actions";
import { useAct } from "../_ui";
import type { CrmData } from "./types";

const n = (v: string) => (v === "" ? 0 : Number(v));

export function SettingsPanel({ data }: { data: CrmData }) {
  const { settings } = data;
  const { toast } = useApp();
  const { pending, act } = useAct();
  const [f, setF] = useState({
    whatsapp: {
      enabled: settings.whatsapp.enabled,
      baseUrl: settings.whatsapp.baseUrl,
      apiKey: "",
      sessionId: settings.whatsapp.sessionId,
      webhookSecret: "",
      autoReply: settings.whatsapp.autoReply,
      defaultCountryCode: settings.whatsapp.defaultCountryCode,
    },
    social: { ...settings.social },
    meta: {
      enabled: settings.meta.enabled,
      pixelId: settings.meta.pixelId,
      capiToken: "",
      adsToken: "",
      adAccountId: settings.meta.adAccountId,
      pageId: settings.meta.pageId,
      testEventCode: settings.meta.testEventCode,
    },
  });
  const [test, setTest] = useState({ phone: "", text: "Hi! This is a test message from the store admin." });
  const webhookUrl = settings.webhookUrl;

  return (
    <div className="space-y-8">
      <form onSubmit={(e) => { e.preventDefault(); act(() => saveIntegrationSettings({ ...f, whatsapp: { ...f.whatsapp, rules: settings.whatsapp.rules }, automations: settings.automations }), "Integration settings saved"); }} className="space-y-6">
        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="font-semibold">WhatsApp · Artha</h2><p className="text-xs text-zinc-500">API key and session id stay on the server; the browser only sees a mask.</p></div>
            <span className={`badge ${settings.whatsapp.configured ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"}`}>{settings.whatsapp.configured ? "configured" : "not configured"}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="label">Base URL</span><input value={f.whatsapp.baseUrl} onChange={(e) => setF({ ...f, whatsapp: { ...f.whatsapp, baseUrl: e.target.value } })} className="input" placeholder="https://artha-qniz.onrender.com" required /></label>
            <label><span className="label">Session id</span><input value={f.whatsapp.sessionId} onChange={(e) => setF({ ...f, whatsapp: { ...f.whatsapp, sessionId: e.target.value } })} className="input" placeholder="d6755839-…" /></label>
            <label><span className="label">API key {settings.whatsapp.apiKeyMasked && <span className="text-zinc-400">({settings.whatsapp.apiKeyMasked})</span>}</span><input value={f.whatsapp.apiKey} onChange={(e) => setF({ ...f, whatsapp: { ...f.whatsapp, apiKey: e.target.value } })} className="input" placeholder={settings.whatsapp.apiKeyMasked ? "Leave blank to keep current key" : "test12345-openwa"} autoComplete="off" /></label>
            <label><span className="label">Webhook secret {settings.whatsapp.webhookSecretSet && <span className="text-zinc-400">(set)</span>}</span><input value={f.whatsapp.webhookSecret} onChange={(e) => setF({ ...f, whatsapp: { ...f.whatsapp, webhookSecret: e.target.value } })} className="input" placeholder={settings.whatsapp.webhookSecretSet ? "Leave blank to keep current secret" : "Optional HMAC secret"} autoComplete="off" /></label>
            <label><span className="label">Country code</span><input value={f.whatsapp.defaultCountryCode} onChange={(e) => setF({ ...f, whatsapp: { ...f.whatsapp, defaultCountryCode: e.target.value } })} className="input" placeholder="91" /></label>
            <div className="flex flex-wrap items-end gap-4 pb-1 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={f.whatsapp.enabled} onChange={(e) => setF({ ...f, whatsapp: { ...f.whatsapp, enabled: e.target.checked } })} className="size-4 accent-brand-500" />WhatsApp enabled</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={f.whatsapp.autoReply} onChange={(e) => setF({ ...f, whatsapp: { ...f.whatsapp, autoReply: e.target.checked } })} className="size-4 accent-brand-500" />Auto-reply</label>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => act(testArthaConnection, undefined, (r) => toast(`${r.count} session${r.count === 1 ? "" : "s"} found`))} className="btn-ghost px-3 py-1.5 text-xs">Test connection</button>
            <a href="https://artha-qniz.onrender.com/api/docs" target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1.5 text-xs">Artha API docs</a>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Social automation</h2>
          <p className="mb-3 text-xs text-zinc-500">Artha already answers Instagram/Facebook comments and DMs. These switches only control the store admin’s own default DM fallback.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.social.enabled} onChange={(e) => setF({ ...f, social: { ...f.social, enabled: e.target.checked } })} className="size-4 accent-brand-500" />Social enabled</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.social.autoReply} onChange={(e) => setF({ ...f, social: { ...f.social, autoReply: e.target.checked } })} className="size-4 accent-brand-500" />Fallback auto-reply</label>
            <label className="sm:col-span-2"><span className="label">Fallback reply</span><textarea value={f.social.defaultReply} onChange={(e) => setF({ ...f, social: { ...f.social, defaultReply: e.target.value } })} rows={2} className="input" /></label>
          </div>
        </section>

        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="font-semibold">Meta Pixel & Ads</h2><p className="text-xs text-zinc-500">Purchase events use the Conversions API; campaign creation is always paused.</p></div>
            <span className={`badge ${settings.meta.capiConfigured ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>{settings.meta.capiConfigured ? "pixel ready" : "pixel not set"}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.meta.enabled} onChange={(e) => setF({ ...f, meta: { ...f.meta, enabled: e.target.checked } })} className="size-4 accent-brand-500" />Meta tracking enabled</label>
            <label><span className="label">Pixel id</span><input value={f.meta.pixelId} onChange={(e) => setF({ ...f, meta: { ...f.meta, pixelId: e.target.value } })} className="input" placeholder="1234567890" /></label>
            <label><span className="label">Conversions API token {settings.meta.capiConfigured && <span className="text-zinc-400">(set)</span>}</span><input value={f.meta.capiToken} onChange={(e) => setF({ ...f, meta: { ...f.meta, capiToken: e.target.value } })} className="input" placeholder={settings.meta.capiConfigured ? "Leave blank to keep current token" : "CAPI token"} autoComplete="off" /></label>
            <label><span className="label">Ads token {settings.meta.adsConfigured && <span className="text-zinc-400">(set)</span>}</span><input value={f.meta.adsToken} onChange={(e) => setF({ ...f, meta: { ...f.meta, adsToken: e.target.value } })} className="input" placeholder={settings.meta.adsConfigured ? "Leave blank to keep current token" : "Marketing API token"} autoComplete="off" /></label>
            <label><span className="label">Ad account id</span><input value={f.meta.adAccountId} onChange={(e) => setF({ ...f, meta: { ...f.meta, adAccountId: e.target.value } })} className="input" placeholder="act_1234567890" /></label>
            <label><span className="label">Page id</span><input value={f.meta.pageId} onChange={(e) => setF({ ...f, meta: { ...f.meta, pageId: e.target.value } })} className="input" placeholder="Facebook Page id" /></label>
            <label><span className="label">Test event code (optional)</span><input value={f.meta.testEventCode} onChange={(e) => setF({ ...f, meta: { ...f.meta, testEventCode: e.target.value } })} className="input" placeholder="TEST12345" /></label>
          </div>
        </section>

        <button disabled={pending} className="btn-brand w-full sm:w-auto">{pending ? "Saving…" : "Save integration settings"}</button>
      </form>

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-semibold">Inbound webhook</h2><p className="text-xs text-zinc-500">Artha calls this URL for inbound messages so auto-replies and CRM logs work.</p></div>
          <button disabled={pending} onClick={() => act(registerArthaWebhook, "Webhook registered")} className="btn-primary px-3 py-1.5 text-xs"><Webhook className="size-3.5" />Register webhook</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <Link2 className="size-4 shrink-0 text-zinc-400" />
          <code className="min-w-0 flex-1 break-all text-xs">{webhookUrl}</code>
          <button onClick={() => { void navigator.clipboard?.writeText(webhookUrl); toast("Webhook URL copied"); }} className="btn-ghost px-2 py-1 text-xs"><Copy className="size-3.5" />Copy</button>
        </div>
        {!webhookUrl.startsWith("http") && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Set APP_URL in the environment to your public site URL, otherwise Artha cannot reach localhost.</p>}
        {data.webhooks.length > 0 && (
          <ul className="mt-3 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {data.webhooks.map((w) => (
              <li key={w.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-xs">{w.url}</span>
                <span className="badge bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{w.active === false ? "inactive" : "active"}</span>
                <button disabled={pending} onClick={() => act(() => removeArthaWebhook(w.id), "Webhook removed")} className="btn-ghost px-2 py-1 text-xs text-rose-600"><Trash2 className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Send a test WhatsApp</h2>
        <p className="mb-3 text-xs text-zinc-500">Sends immediately through the configured Artha session and logs it in the CRM.</p>
        <form onSubmit={(e) => { e.preventDefault(); act(() => sendWhatsAppTest(test.phone, test.text), "Test message sent", () => setTest({ ...test, text: "" })); }} className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
          <label><span className="label">Phone</span><input value={test.phone} onChange={(e) => setTest({ ...test, phone: e.target.value })} className="input" placeholder="9876543210" required /></label>
          <label><span className="label">Message</span><input value={test.text} onChange={(e) => setTest({ ...test, text: e.target.value })} className="input" required /></label>
          <button disabled={pending} className="btn-brand px-4 py-2 text-sm"><Send className="size-4" />Send</button>
        </form>
      </section>
    </div>
  );
}
