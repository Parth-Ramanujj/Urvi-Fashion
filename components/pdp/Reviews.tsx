"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BadgeCheck, Camera, Star, X } from "lucide-react";
import { addReview } from "@/lib/actions";
import type { Review } from "@/lib/types";
import { useApp } from "../Providers";
import { Modal, Stars } from "../ui";

export default function Reviews({ productId, rating, count, reviews, canReview, purchased, title }: { productId: string; rating: number; count: number; reviews: Review[]; canReview: boolean; purchased: boolean; title: string }) {
  const path = usePathname();
  const [filter, setFilter] = useState<number | "photos" | null>(null);
  const [writing, setWriting] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [shown, setShown] = useState(6);
  // Histogram is scaled from the sample of written reviews to the total rating count.
  const hist = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => r.rating === s).length }));
  const list = reviews.filter((r) => filter === null || (filter === "photos" ? r.photos.length > 0 : r.rating === filter));
  const allPhotos = reviews.flatMap((r) => r.photos);

  return (
    <section id="reviews" className="mt-16 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        {canReview ? <button onClick={() => setWriting(true)} className="btn-ghost">Write a review</button> : <Link href={`/login?next=${encodeURIComponent(path)}`} className="btn-ghost">Log in to review</Link>}
      </div>
      <div className="mt-6 grid gap-8 md:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-4"><span className="text-5xl font-bold">{rating.toFixed(1)}</span><div><Stars value={rating} size={18} /><p className="mt-1 text-sm text-zinc-500">{count.toLocaleString()} ratings</p></div></div>
          <div className="space-y-1.5">
            {hist.map(({ s, n }) => (
              <button key={s} onClick={() => setFilter(filter === s ? null : s)} className={`flex w-full items-center gap-2 rounded-lg px-1 text-sm transition ${filter === s ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}>
                <span className="w-6 text-left">{s}★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${reviews.length ? (n / reviews.length) * 100 : 0}%` }} /></span>
                <span className="w-8 text-right text-xs text-zinc-500">{n}</span>
              </button>
            ))}
          </div>
          {allPhotos.length > 0 && (
            <div><p className="label">Customer photos</p><div className="grid grid-cols-4 gap-1.5">{allPhotos.slice(0, 8).map((ph) => <button key={ph} onClick={() => setViewer(ph)} className="aspect-square overflow-hidden rounded-lg">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={ph} alt="Customer photo" className="h-full w-full object-cover" /></button>)}</div></div>
          )}
        </div>
        <div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button onClick={() => setFilter(null)} className={`chip text-xs ${filter === null ? "chip-on" : ""}`}>All ({reviews.length})</button>
            <button onClick={() => setFilter("photos")} className={`chip text-xs ${filter === "photos" ? "chip-on" : ""}`}><Camera className="size-3" />With photos</button>
          </div>
          {list.length === 0 && <p className="py-8 text-center text-sm text-zinc-500">No reviews here yet.</p>}
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {list.slice(0, shown).map((r) => (
              <li key={r.id} className="py-5">
                <div className="flex items-center gap-2"><span className={`badge ${r.rating >= 4 ? "bg-emerald-600" : r.rating === 3 ? "bg-amber-500" : "bg-red-500"} text-white`}>{r.rating} ★</span><p className="font-semibold">{r.title}</p></div>
                <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{r.body}</p>
                {r.photos.length > 0 && <div className="mt-3 flex gap-2">{r.photos.map((ph) => <button key={ph} onClick={() => setViewer(ph)} className="size-20 overflow-hidden rounded-xl">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={ph} alt="Review photo" className="h-full w-full object-cover" /></button>)}</div>}
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{r.name}</span>
                  {r.verified && <span className="flex items-center gap-1 text-emerald-600"><BadgeCheck className="size-3.5" />Verified buyer</span>}
                  {r.size && <span>Size bought: {r.size}</span>}
                  <span suppressHydrationWarning>{new Date(r.createdAt).toLocaleDateString()}</span>
                </p>
              </li>
            ))}
          </ul>
          {list.length > shown && <button onClick={() => setShown((s) => s + 6)} className="btn-ghost mt-2">Show more reviews</button>}
        </div>
      </div>
      <Modal open={writing} onClose={() => setWriting(false)} title="Write a review"><ReviewForm productId={productId} purchased={purchased} onDone={() => setWriting(false)} /></Modal>
      {viewer && (
        <div className="fixed inset-0 z-[80] grid animate-fade-in place-items-center bg-black/90 p-4" onClick={() => setViewer(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" aria-label="Close"><X className="size-5" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewer} alt="Customer photo" className="max-h-[85vh] max-w-full rounded-2xl" />
        </div>
      )}
    </section>
  );
}

function ReviewForm({ productId, purchased, onDone }: { productId: string; purchased: boolean; onDone: () => void }) {
  const { toast } = useApp();
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, start] = useTransition();
  const submit = (fd: FormData) => {
    fd.set("productId", productId); fd.set("rating", String(stars));
    fd.delete("photos"); files.forEach((f) => fd.append("photos", f));
    start(async () => {
      const r = await addReview(fd);
      if (!r.ok) return toast(r.error, "err");
      toast("Thanks! Your review is live."); onDone(); router.refresh();
    });
  };
  return (
    <form action={submit} className="space-y-4">
      {purchased && <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"><BadgeCheck className="size-4" />You bought this — your review gets a Verified buyer tag.</p>}
      <div className="flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <button type="button" key={i} onMouseEnter={() => setHover(i)} onClick={() => setStars(i)} role="radio" aria-checked={stars === i} aria-label={`${i} stars`}>
            <Star className={`size-9 transition ${(hover || stars) >= i ? "scale-110 fill-amber-400 text-amber-400" : "text-zinc-300"}`} />
          </button>
        ))}
      </div>
      <label className="block"><span className="label">Headline</span><input name="title" className="input" maxLength={80} placeholder="Sum it up in a few words" /></label>
      <label className="block"><span className="label">Your review</span><textarea name="body" required minLength={10} maxLength={1500} rows={4} className="input" placeholder="How was the fit, fabric and colour?" /></label>
      <div>
        <span className="label">Photos (up to 4)</span>
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative size-20 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white" aria-label="Remove photo"><X className="size-3" /></button>
            </div>
          ))}
          {files.length < 4 && (
            <label className="grid size-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-zinc-300 text-zinc-400 hover:border-zinc-500 dark:border-zinc-700">
              <Camera className="size-6" />
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 4))} />
            </label>
          )}
        </div>
      </div>
      <button disabled={pending || !stars} className="btn-primary w-full">{pending ? "Posting…" : "Post review"}</button>
    </form>
  );
}
