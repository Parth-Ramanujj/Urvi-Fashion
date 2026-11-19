// Maps the in-memory store (DB object) to MySQL rows and computes the minimal set of row changes after a mutate().
// Pure (no I/O) so it can be unit-checked in scripts/selfcheck.ts.
import type { DB } from "./types.ts";

/** Collection → [MySQL table, key field]. Every collection is stored one row per record, in array order (pos). */
export const COLLECTIONS = {
  users: ["users", "id"], products: ["products", "id"], orders: ["orders", "id"], reviews: ["reviews", "id"],
  coupons: ["coupons", "code"], banners: ["banners", "id"], notifications: ["notifications", "id"], campaigns: ["campaigns", "id"],
  tickets: ["tickets", "id"], otps: ["otps", "phone"], coinLedger: ["coin_ledger", "id"], waitlist: ["waitlist", "id"], memberships: ["memberships", "id"],
} as const satisfies Partial<Record<keyof DB, readonly [string, string]>>;
/** Single-value settings, stored as rows of the `settings` table. */
export const SETTINGS = ["version", "secret", "retention", "delivery", "brand"] as const satisfies readonly (keyof DB)[];

export type Row = { id: string; pos: number; json: string };
/** table → id → "pos\u0000json": what MySQL currently holds (as of the last commit). */
export type Snapshot = Map<string, Map<string, string>>;
export type Change = { table: string; upserts: Row[]; deletes: string[] };

/** Every row the DB object maps to, grouped by table. */
export function toRows(d: DB): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const [coll, [table, key]] of Object.entries(COLLECTIONS)) {
    const list = ((d as unknown as Record<string, Record<string, unknown>[]>)[coll] ?? []);
    out.set(table, list.map((doc, pos) => ({ id: String(doc[key]), pos, json: JSON.stringify(doc) })));
  }
  out.set("settings", SETTINGS.filter((k) => d[k] !== undefined).map((k, pos) => ({ id: k, pos, json: JSON.stringify(d[k]) })));
  return out;
}

const cell = (r: Row) => `${r.pos}\u0000${r.json}`;

export function snapshotOf(rows: Map<string, Row[]>): Snapshot {
  return new Map([...rows].map(([t, rs]) => [t, new Map(rs.map((r) => [r.id, cell(r)]))]));
}

/** Rows to insert/update (new, edited or moved) and ids to delete, per table. Throws on duplicate keys within a table. */
export function diff(prev: Snapshot, d: DB): { changes: Change[]; next: Snapshot } {
  const rows = toRows(d);
  const changes: Change[] = [];
  for (const [table, rs] of rows) {
    const old = prev.get(table) ?? new Map<string, string>();
    const seen = new Set<string>();
    const upserts: Row[] = [];
    for (const r of rs) {
      if (seen.has(r.id)) throw new Error(`Duplicate key "${r.id}" in ${table}`);
      seen.add(r.id);
      if (old.get(r.id) !== cell(r)) upserts.push(r);
    }
    const deletes = [...old.keys()].filter((id) => !seen.has(id));
    if (upserts.length || deletes.length) changes.push({ table, upserts, deletes });
  }
  return { changes, next: snapshotOf(rows) };
}

/** Rebuild the DB object from rows (as loaded from MySQL, or from a snapshot after a failed write). */
export function fromRows(rows: Map<string, { id: string; data: unknown }[]>): DB {
  const d: Record<string, unknown> = {};
  for (const [coll, [table]] of Object.entries(COLLECTIONS)) d[coll] = (rows.get(table) ?? []).map((r) => r.data);
  for (const r of rows.get("settings") ?? []) d[r.id] = r.data;
  return d as unknown as DB;
}

export function fromSnapshot(s: Snapshot): DB {
  return fromRows(new Map([...s].map(([t, m]) => [t, [...m].map(([id, c]) => ({ id, data: JSON.parse(c.slice(c.indexOf("\u0000") + 1)) }))])));
}

/**
 * Order of SQL operations that satisfies foreign keys: inserts/updates parents before children (COLLECTIONS order:
 * users, products, orders before the tables pointing at them), deletes children before parents (reverse order).
 */
export function writePlan(changes: Change[]) {
  const rank = (t: string) => { const i = Object.values(COLLECTIONS).findIndex(([name]) => name === t); return i < 0 ? 99 : i; };
  const sorted = [...changes].sort((a, b) => rank(a.table) - rank(b.table));
  return [
    ...sorted.filter((c) => c.upserts.length).map((c) => ({ op: "upsert" as const, table: c.table, rows: c.upserts })),
    ...sorted.reverse().filter((c) => c.deletes.length).map((c) => ({ op: "delete" as const, table: c.table, ids: c.deletes })),
  ];
}
