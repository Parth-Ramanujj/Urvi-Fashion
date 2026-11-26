"use client";
import { useState } from "react";
import { Camera, Plus, Send, ThumbsUp, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui";
import { publishSocialPost, removeArthaSocialRule, saveSocialRule, toggleArthaSocialRule } from "@/lib/integration-actions";
import { useAct } from "../_ui";
import type { CrmAccount, CrmPost, CrmRule } from "./types";

const platformIcon = (p?: string) => (p === "facebook" ? ThumbsUp : p === "instagram" ? Camera : Send);

export function SocialPanel({ data }: { data: { accounts: CrmAccount[]; rules: CrmRule[]; posts: CrmPost[] } }) {
  const [openRule, setOpenRule] = useState(false);
  const [openPost, setOpenPost] = useState(false);
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="text-lg font-semibold">Connected accounts</h2><p className="text-xs text-zinc-500">Instagram, Facebook and other channels connected to Artha.</p></div>
        </div>
        {data.accounts.length === 0 ? <p className="card p-6 text-center text-sm text-zinc-500">No social accounts found. Connect them in Artha → Social Automation.</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.accounts.map((a) => {
              const Icon = platformIcon(a.platform);
              return (
                <div key={a.id} className="card flex items-center gap-3 p-4">
                  <span className="grid size-10 place-items-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"><Icon className="size-5" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold">{a.accountName || a.username || a.id}</p><p className="text-xs capitalize text-zinc-500">{a.platform || "social"}{a.enabled === false ? " · disabled" : ""}</p></div>
                  <span className={`badge ${a.enabled === false ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"}`}>{a.enabled === false ? "off" : "live"}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="text-lg font-semibold">Comment & DM rules</h2><p className="text-xs text-zinc-500">Artha answers comments/DMs matching these rules. Toggle them without leaving the store admin.</p></div>
          <button onClick={() => setOpenRule(true)} className="btn-primary px-3 py-1.5 text-xs"><Plus className="size-3.5" />New social rule</button>
        </div>
        {data.rules.length === 0 ? <p className="card p-6 text-center text-sm text-zinc-500">No social rules yet.</p> : (
          <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.rules.map((r) => <SocialRuleRow key={r.id} rule={r} />)}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="text-lg font-semibold">Posts</h2><p className="text-xs text-zinc-500">Drafts, scheduled and published posts managed by Artha.</p></div>
          <button onClick={() => setOpenPost(true)} className="btn-ghost px-3 py-1.5 text-xs"><Plus className="size-3.5" />Create post</button>
        </div>
        {data.posts.length === 0 ? <p className="card p-6 text-center text-sm text-zinc-500">No posts yet.</p> : (
          <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.posts.slice(0, 20).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <span className="badge bg-zinc-100 capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{p.platform || "post"}</span>
                <p className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">{p.caption || "(no caption)"}</p>
                <span className="text-xs text-zinc-500">{p.scheduledAt ? new Date(p.scheduledAt).toLocaleString("en-IN") : ""}</span>
                <span className="badge bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{p.status || "draft"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal open={openRule} onClose={() => setOpenRule(false)} title="New social auto-reply rule">
        <SocialRuleForm onDone={() => setOpenRule(false)} />
      </Modal>
      <Modal open={openPost} onClose={() => setOpenPost(false)} title="Create social post">
        <PostForm onDone={() => setOpenPost(false)} />
      </Modal>
    </div>
  );
}

function SocialRuleRow({ rule }: { rule: CrmRule }) {
  const { pending, act } = useAct();
  return (
    <div className="flex flex-wrap items-center gap-3 p-3">
      <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" role="switch" checked={rule.enabled !== false} disabled={pending} onChange={(e) => act(() => toggleArthaSocialRule(rule.id, e.target.checked), e.target.checked ? "Rule enabled" : "Rule disabled")} className="size-5 accent-brand-500" /></label>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{rule.name || rule.id} <span className="text-xs capitalize text-zinc-500">· {rule.platform || "all"}</span></p>
        <p className="truncate text-xs text-zinc-500">{(rule.keywords ?? []).join(", ")} → {(rule.replyTemplates ?? [])[0] || "—"}</p>
      </div>
      <button disabled={pending} onClick={() => act(() => removeArthaSocialRule(rule.id), "Rule deleted")} className="btn-ghost px-2 py-1 text-xs text-rose-600"><Trash2 className="size-3.5" /></button>
    </div>
  );
}

function SocialRuleForm({ onDone }: { onDone: () => void }) {
  const { pending, act } = useAct();
  const [f, setF] = useState({ name: "", platform: "all", keywords: "price, cost, how much", reply: "Hi {username}! We've sent you the details in DM ✨", autoDm: true, autoDmTemplate: "Hi {username}! Here is the link: {{link}}", enabled: true });
  return (
    <form onSubmit={(e) => { e.preventDefault(); act(() => saveSocialRule({ name: f.name, platform: f.platform as never, keywords: f.keywords.split(",").map((k) => k.trim()).filter(Boolean), replyTemplates: [f.reply], autoDm: f.autoDm, autoDmTemplate: f.autoDmTemplate, enabled: f.enabled }), "Social rule created", onDone); }} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">Name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="input" required placeholder="Price question" /></label>
        <label><span className="label">Platform</span><select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} className="input"><option value="all">All</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="youtube">YouTube</option></select></label>
      </div>
      <label className="block"><span className="label">Keywords (comma separated)</span><input value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} className="input" required /></label>
      <label className="block"><span className="label">Public reply</span><textarea value={f.reply} onChange={(e) => setF({ ...f, reply: e.target.value })} rows={2} className="input" required /></label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.autoDm} onChange={(e) => setF({ ...f, autoDm: e.target.checked })} />Also send a DM</label>
      {f.autoDm && <label className="block"><span className="label">DM template</span><textarea value={f.autoDmTemplate} onChange={(e) => setF({ ...f, autoDmTemplate: e.target.value })} rows={2} className="input" /></label>}
      <button disabled={pending} className="btn-brand w-full">{pending ? "Creating…" : "Create rule"}</button>
    </form>
  );
}

function PostForm({ onDone }: { onDone: () => void }) {
  const { pending, act } = useAct();
  const [f, setF] = useState({ platform: "instagram", caption: "", mediaUrl: "", publishNow: false });
  return (
    <form onSubmit={(e) => { e.preventDefault(); act(() => publishSocialPost({ platform: f.platform as never, caption: f.caption, mediaUrl: f.mediaUrl || undefined, publishNow: f.publishNow }), "Post created", onDone); }} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">Platform</span><select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} className="input"><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="youtube">YouTube</option><option value="x">X</option><option value="linkedin">LinkedIn</option></select></label>
        <label className="flex items-end gap-2 pb-2 text-xs"><input type="checkbox" checked={f.publishNow} onChange={(e) => setF({ ...f, publishNow: e.target.checked })} />Publish immediately (otherwise saves a draft)</label>
      </div>
      <label className="block"><span className="label">Caption</span><textarea value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} rows={4} maxLength={2200} className="input" required /></label>
      <label className="block"><span className="label">Media URL (public HTTPS image/video)</span><input value={f.mediaUrl} onChange={(e) => setF({ ...f, mediaUrl: e.target.value })} className="input" placeholder="https://…" /></label>
      <button disabled={pending} className="btn-brand w-full">{pending ? "Creating…" : "Create post"}</button>
    </form>
  );
}
