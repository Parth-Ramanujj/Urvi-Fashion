import type { ArtKind, Measurements } from "./types";

// Garment body-measurement charts in cm. Kids sizes reuse the adult letters but map to kid measurements.
type Chart = { cols: string[]; rows: Record<string, number[]>; key: keyof Measurements };
const TOPS: Chart = { cols: ["Chest", "Waist", "Length"], key: "chest", rows: { XS: [84, 72, 66], S: [90, 78, 68], M: [96, 84, 70], L: [102, 90, 72], XL: [108, 96, 74], XXL: [116, 104, 76] } };
const BOTTOMS: Chart = { cols: ["Waist", "Hips", "Inseam"], key: "waist", rows: { XS: [68, 88, 76], S: [74, 94, 78], M: [80, 100, 80], L: [86, 106, 81], XL: [92, 112, 82], XXL: [100, 120, 82] } };
const DRESS: Chart = { cols: ["Bust", "Waist", "Hips"], key: "chest", rows: { XS: [80, 62, 86], S: [86, 68, 92], M: [92, 74, 98], L: [98, 80, 104], XL: [104, 86, 110], XXL: [112, 94, 118] } };
const KIDS: Chart = { cols: ["Age", "Chest", "Height"], key: "height", rows: { XS: [4, 56, 104], S: [6, 60, 116], M: [8, 64, 128], L: [10, 68, 140] } };

export function chartFor(kind: ArtKind, kids = false): Chart | null {
  if (kids) return KIDS;
  if (["pants", "shorts", "skirt"].includes(kind)) return BOTTOMS;
  if (kind === "dress") return DRESS;
  if (["tee", "shirt", "hoodie", "jacket"].includes(kind)) return TOPS;
  return null;
}

/** Smallest size whose garment measurement covers the body measurement plus fit ease. */
export function recommendSize(kind: ArtKind, m: Measurements, kids = false) {
  const c = chartFor(kind, kids);
  const v = c && m[c.key];
  if (!c || typeof v !== "number") return null;
  const idx = c.key === "height" ? 2 : 0;
  const ease = c.key === "height" ? 0 : m.fit === "slim" ? -2 : m.fit === "relaxed" ? 4 : 0;
  return Object.entries(c.rows).find(([, r]) => r[idx] >= v + ease)?.[0] ?? Object.keys(c.rows).at(-1)!;
}
