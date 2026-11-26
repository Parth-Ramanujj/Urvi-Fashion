"use client";
import { useRef, useState } from "react";
import { Calendar, Camera, ExternalLink, ImagePlus, Plus, Send, Sparkles, ThumbsUp, Trash2, Upload, Wand2 } from "lucide-react";
import { Modal } from "@/components/ui";
import { useApp } from "@/components/Providers";
import {
  publishSocialPost,
  quickConnectSocialAccount,
  removeArthaSocialRule,
  saveSocialRule,
  toggleArthaSocialRule,
  uploadPostMedia,
} from "@/lib/integration-actions";
import { useAct } from "../_ui";
import type { CrmData, CrmProduct, CrmRule } from "./types";

const platformIcon = (p?: string) => (p === "facebook" ? ThumbsUp : p === "instagram" ? Camera : Send);

export function SocialPanel({ data }: { data: CrmData }) {
  const [openRule, setOpenRule] = useState(false);
  const [openPost, setOpenPost] = useState(false);
  const [quickHandle, setQuickHandle] = useState("");
  const [quickPlatform, setQuickPlatform] = useState<"instagram" | "facebook">("instagram");
  const { pending, act } = useAct();
  const arthaSocialUrl = `${data.settings.whatsapp.baseUrl.replace(/\/+$/, "")}/social-automation`;
  const quickAccounts = data.settings.social.accounts;

  return (
    <div className="space-y-8">
      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Easy social connect (Instagram & Facebook)</h2>
            <p className="text-xs text-zinc-500">Connect your Instagram handle in seconds without manual Meta API setup, or link via Artha 1-click OAuth.</p>
          </div>
          <a href={arthaSocialUrl} target="_blank" rel="noreferrer" className="btn-primary px-3 py-1.5 text-xs">
            <ExternalLink className="size-3.5" />1-Click Artha Instagram Connect
          </a>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            act(() => quickConnectSocialAccount({ platform: quickPlatform, handle: quickHandle }), "Account linked!", () => setQuickHandle(""));
          }}
          className="flex flex-wrap items-center gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900/50"
        >
          <select value={quickPlatform} onChange={(e) => setQuickPlatform(e.target.value as "instagram" | "facebook")} className="input w-auto py-1.5 text-xs">
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
          </select>
          <input value={quickHandle} onChange={(e) => setQuickHandle(e.target.value)} placeholder="@your_shop_handle" className="input min-w-48 flex-1 py-1.5 text-xs" required />
          <button disabled={pending} className="btn-brand px-3 py-1.5 text-xs">Quick Link Handle</button>
        </form>

        {(data.accounts.length > 0 || quickAccounts.length > 0) ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.accounts.map((a) => {
              const Icon = platformIcon(a.platform);
              return (
                <div key={a.id} className="card flex items-center gap-3 p-3.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-300"><Icon className="size-4" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{a.accountName || a.username || a.id}</p><p className="text-xs capitalize text-zinc-500">{a.platform || "social"} · Artha API</p></div>
                  <span className={`badge ${a.enabled === false ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"}`}>{a.enabled === false ? "off" : "live"}</span>
                </div>
              );
            })}
            {quickAccounts.map((acc) => {
              const [plat, handle] = acc.includes(":") ? acc.split(":", 2) : ["instagram", acc];
              const Icon = platformIcon(plat);
              return (
                <div key={acc} className="card flex items-center gap-3 p-3.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"><Icon className="size-4" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">@{handle}</p><p className="text-xs capitalize text-zinc-500">{plat} · Quick linked</p></div>
                  <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">linked</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">No accounts linked yet. Enter your @handle above or click 1-Click Artha Instagram Connect.</p>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Instagram comments & DM auto-reply</h2>
            <p className="text-xs text-zinc-500">Automatically reply to comments (e.g. &ldquo;price&rdquo;, &ldquo;link&rdquo;) and send a DM with your product link.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={pending}
              onClick={() => act(() => saveSocialRule({
                name: "IG Comment Price → Auto DM",
                platform: "instagram",
                appliesTo: "comments",
                matchType: "contains",
                keywords: ["price", "pp", "rate", "link", "details"],
                replyTemplates: ["Sent you the price & link in DM! Check your inbox ✨"],
                autoLike: true,
                autoDm: true,
                autoDmTemplate: "Hi {username}! Thanks for commenting ❤️ Here is our collection link: {{link}}",
                enabled: true,
              }), "Instagram comment auto-reply created")}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              + IG Comment Preset
            </button>
            <button onClick={() => setOpenRule(true)} className="btn-primary px-3 py-1.5 text-xs"><Plus className="size-3.5" />New rule</button>
          </div>
        </div>
        {data.rules.length === 0 ? <p className="card p-6 text-center text-sm text-zinc-500">No social auto-reply rules yet. Click &ldquo;+ IG Comment Preset&rdquo; to add one in 1 click.</p> : (
          <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.rules.map((r) => <SocialRuleRow key={r.id} rule={r} />)}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">AI content studio & scheduled posts</h2>
            <p className="text-xs text-zinc-500">Generate promotional images & captions with AI, then publish now or schedule for later.</p>
          </div>
          <button onClick={() => setOpenPost(true)} className="btn-brand px-3 py-1.5 text-xs"><Sparkles className="size-3.5" />Create AI / Scheduled Post</button>
        </div>
        {data.posts.length === 0 ? <p className="card p-6 text-center text-sm text-zinc-500">No scheduled or published posts yet.</p> : (
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

      <Modal open={openRule} onClose={() => setOpenRule(false)} title="New Instagram / Social auto-reply rule">
        <SocialRuleForm onDone={() => setOpenRule(false)} />
      </Modal>
      <Modal open={openPost} onClose={() => setOpenPost(false)} title="AI Content Studio & Schedule Post" wide>
        <PostForm products={data.products} brandName={data.settings.whatsapp ? "Our Store" : "Store"} onDone={() => setOpenPost(false)} />
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
  const [f, setF] = useState({ name: "", platform: "instagram", appliesTo: "both", keywords: "price, cost, how much, link", reply: "Hi {username}! We've sent you the details in DM ✨", autoLike: true, autoDm: true, autoDmTemplate: "Hi {username}! Here is the link: {{link}}", enabled: true });
  return (
    <form onSubmit={(e) => { e.preventDefault(); act(() => saveSocialRule({ name: f.name, platform: f.platform as never, appliesTo: f.appliesTo as never, keywords: f.keywords.split(",").map((k) => k.trim()).filter(Boolean), replyTemplates: [f.reply], autoLike: f.autoLike, autoDm: f.autoDm, autoDmTemplate: f.autoDmTemplate, enabled: f.enabled }), "Social rule created", onDone); }} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label><span className="label">Name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="input" required placeholder="Price question" /></label>
        <label><span className="label">Platform</span><select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} className="input"><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="all">All</option><option value="youtube">YouTube</option></select></label>
        <label><span className="label">Applies to</span><select value={f.appliesTo} onChange={(e) => setF({ ...f, appliesTo: e.target.value })} className="input"><option value="both">Comments & DMs</option><option value="comments">Comments only</option><option value="dms">DMs only</option></select></label>
      </div>
      <label className="block"><span className="label">Keywords (comma separated)</span><input value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} className="input" required /></label>
      <label className="block"><span className="label">Auto-reply message</span><textarea value={f.reply} onChange={(e) => setF({ ...f, reply: e.target.value })} rows={2} className="input" required /></label>
      <div className="flex flex-wrap gap-4 text-xs">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.autoLike} onChange={(e) => setF({ ...f, autoLike: e.target.checked })} />Auto-like comment</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.autoDm} onChange={(e) => setF({ ...f, autoDm: e.target.checked })} />Also send a DM</label>
      </div>
      {f.autoDm && <label className="block"><span className="label">DM template</span><textarea value={f.autoDmTemplate} onChange={(e) => setF({ ...f, autoDmTemplate: e.target.value })} rows={2} className="input" /></label>}
      <button disabled={pending} className="btn-brand w-full">{pending ? "Creating…" : "Create rule"}</button>
    </form>
  );
}

function PostForm({ products, brandName, onDone }: { products: CrmProduct[]; brandName: string; onDone: () => void }) {
  const { pending, act } = useAct();
  const { toast } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [f, setF] = useState({ platform: "instagram", caption: "", mediaUrl: "", scheduledAt: "", publishNow: false });
  const [selectedProdId, setSelectedProdId] = useState(products[0]?.id ?? "");
  const [tone, setTone] = useState<"trendy" | "festive" | "minimal" | "gujarati">("trendy");
  const [generatingImg, setGeneratingImg] = useState(false);

  const selectedProd = products.find((p) => p.id === selectedProdId);

  const generateCaption = () => {
    const p = selectedProd;
    const off = p && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
    const title = p ? p.name : "New Arrival Collection";
    const priceLine = p ? `₹${p.price}${off > 0 ? ` (${off}% OFF!)` : ""}` : "Special Launch Offer";
    let cap = "";
    if (tone === "trendy") cap = `✨ NEW DROP ALERT ✨\n\nUpgrade your wardrobe with ${title} — now at ${priceLine}!\n\n💬 Comment "LINK" or "PRICE" below & we'll DM you directly!\n\n#NewArrival #FashionIndia #TrendingStyle #ShopNow #OOTD`;
    else if (tone === "festive") cap = `🪔 FESTIVE SPECIAL 🪔\n\nShine bright this season with ${title} ✨\nSpecial Price: ${priceLine}\n\nLimited stock! Comment "PRICE" to grab yours before it's gone 🛍️\n\n#FestiveWear #EthnicFashion #IndianWear #SaleAlert`;
    else if (tone === "gujarati") cap = `🌟 નવું કલેક્શન આવી ગયું છે! 🌟\n\n${title} — માત્ર ${priceLine} માં!\n\nઓર્ડર કરવા માટે નીચે "PRICE" કોમેન્ટ કરો અથવા DM કરો 📩\n\n#NewCollection #GujaratFashion #ShopLocal #Trending`;
    else cap = `${title}.\nAvailable now for ${priceLine}.\n\nComment "LINK" for direct checkout.`;
    setF((prev) => ({ ...prev, caption: cap }));
    toast("AI caption generated!");
  };

  const generatePosterImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setGeneratingImg(true);
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = 1080;
      canvas.height = 1080;
      const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
      grad.addColorStop(0, "#18181b");
      grad.addColorStop(0.5, "#3f1d38");
      grad.addColorStop(1, "#7c2d12");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1080);

      // Decorative card
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(70, 70, 940, 940);

      const p = selectedProd;
      const off = p && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;

      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p?.isNew ? "NEW ARRIVAL" : "FEATURED STYLE", 540, 220);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 68px sans-serif";
      const name = (p?.name ?? brandName).slice(0, 26);
      ctx.fillText(name, 540, 440);

      if (p) {
        ctx.fillStyle = "#34d399";
        ctx.font = "bold 86px sans-serif";
        ctx.fillText(`₹${p.price}`, 540, 580);
        if (off > 0) {
          ctx.fillStyle = "#f43f5e";
          ctx.fillRect(390, 640, 300, 76);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 40px sans-serif";
          ctx.fillText(`${off}% OFF`, 540, 692);
        }
      }

      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "34px sans-serif";
      ctx.fillText("Comment 'PRICE' to get the link in DM!", 540, 880);

      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) return;
      const fd = new FormData();
      fd.append("file", new File([blob], "ai-promo.png", { type: "image/png" }));
      const r = await uploadPostMedia(fd);
      if (!r.ok) { toast(r.error, "err"); return; }
      setF((prev) => ({ ...prev, mediaUrl: r.data.url }));
      toast("AI promo image generated & attached!");
    } finally {
      setGeneratingImg(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); act(() => publishSocialPost({ platform: f.platform as never, caption: f.caption, mediaUrl: f.mediaUrl || undefined, scheduledAt: !f.publishNow && f.scheduledAt ? new Date(f.scheduledAt).toISOString() : undefined, publishNow: f.publishNow }), f.publishNow ? "Published!" : f.scheduledAt ? "Post scheduled!" : "Draft saved", onDone); }} className="space-y-4">
      <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-3 dark:border-brand-900/40 dark:bg-brand-950/20">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300"><Wand2 className="size-3.5" />AI Content & Poster Generator</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <select value={selectedProdId} onChange={(e) => setSelectedProdId(e.target.value)} className="input py-1.5 text-xs sm:col-span-2">
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>)}
          </select>
          <select value={tone} onChange={(e) => setTone(e.target.value as never)} className="input py-1.5 text-xs">
            <option value="trendy">Trendy Tone</option>
            <option value="festive">Festive Tone</option>
            <option value="gujarati">Gujarati Tone</option>
            <option value="minimal">Minimal Tone</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={generateCaption} className="btn-primary px-3 py-1.5 text-xs"><Sparkles className="size-3.5" />Generate AI Caption</button>
          <button type="button" disabled={generatingImg} onClick={generatePosterImage} className="btn-ghost px-3 py-1.5 text-xs"><ImagePlus className="size-3.5" />{generatingImg ? "Generating…" : "Generate AI Promo Image"}</button>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">Platform</span><select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} className="input"><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="youtube">YouTube</option><option value="x">X</option><option value="linkedin">LinkedIn</option></select></label>
        <label><span className="label flex items-center gap-1"><Calendar className="size-3" />Schedule date & time</span><input type="datetime-local" disabled={f.publishNow} value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} className="input" /></label>
      </div>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.publishNow} onChange={(e) => setF({ ...f, publishNow: e.target.checked })} />Publish immediately (uncheck to schedule or save draft)</label>
      <label className="block"><span className="label">Caption</span><textarea value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} rows={4} maxLength={2200} className="input" required /></label>
      <div className="space-y-1.5">
        <span className="label">Media URL (or upload / generate above)</span>
        <div className="flex gap-2">
          <input value={f.mediaUrl} onChange={(e) => setF({ ...f, mediaUrl: e.target.value })} className="input flex-1" placeholder="https://…" />
          <label className="btn-ghost cursor-pointer px-3 text-xs">
            <Upload className="size-3.5" />Upload
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fd = new FormData(); fd.append("file", file);
              const r = await uploadPostMedia(fd);
              if (r.ok) { setF((prev) => ({ ...prev, mediaUrl: r.data.url })); toast("Image uploaded!"); }
              else toast(r.error, "err");
            }} />
          </label>
        </div>
      </div>
      <button disabled={pending} className="btn-brand w-full">{pending ? "Saving…" : f.publishNow ? "Publish Now" : f.scheduledAt ? "Schedule Post" : "Save Draft"}</button>
    </form>
  );
}
