import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { migrate, processWaitlist } from "./retention-core";
import { buildBlankSeed, buildSeed } from "./seed";
import { runMigrations, TABLES, type Q } from "./db-schema";
import { diff, fromRows, fromSnapshot, snapshotOf, toRows, writePlan, type Change, type Snapshot } from "./store-diff";
import type { DB } from "./types";

/*
 * Storage. Every read goes through db() (an in-memory copy) and every write through mutate().
 *  - DATABASE_URL set (production): PostgreSQL (Render-ready). Each mutate() is one transaction that locks store_meta,
 *    so writes from any number of server processes are serialised; only the rows that changed are written.
 *  - Not set: a JSON file in DATA_DIR — fine for local dev and demos.
 */
const DIR = path.resolve(process.env.DATA_DIR || (process.env.VERCEL ? "/tmp/store-data" : path.join(process.cwd(), "data")));
const FILE = path.join(DIR, "db.json");
export const UPLOAD_DIR = path.join(DIR, "uploads");
const REFRESH_MS = 3000;

type G = { __db?: DB; __snap?: Snapshot; __ver?: number; __pool?: Pool; __chain?: Promise<unknown>; __init?: Promise<void>; __timer?: NodeJS.Timeout };
const g = globalThis as unknown as G;
const usePg = !!process.env.DATABASE_URL;

const fresh = () => { const d = process.env.DEMO_DATA === "false" ? buildBlankSeed() : buildSeed(); migrate(d); return d; };

/* ---------------- JSON file mode ---------------- */
function persistFile() {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(g.__db));
  fs.renameSync(tmp, FILE);
}
function loadFile() {
  if (fs.existsSync(FILE)) { g.__db = JSON.parse(fs.readFileSync(FILE, "utf8")) as DB; if (migrate(g.__db)) persistFile(); }
  else { g.__db = fresh(); persistFile(); }
}

/* ---------------- PostgreSQL mode ---------------- */
function pgSsl(urlStr: string) {
  try {
    const host = new URL(urlStr).hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return undefined;
  } catch {}
  return { rejectUnauthorized: false };
}

async function createSchema() {
  const connStr = process.env.DATABASE_URL!;
  const pool = new Pool({
    connectionString: connStr,
    max: Number(process.env.DB_POOL_SIZE) || 10,
    ssl: pgSsl(connStr),
  });
  await runMigrations(pool);
  return pool;
}

async function loadSql(q: Q) {
  const rows = new Map<string, { id: string; data: unknown }[]>();
  for (const t of TABLES) {
    const { rows: rs } = await q.query<{ id: string; data: unknown }>(`SELECT id, data FROM "${t}" ORDER BY pos`);
    rows.set(t, rs.map((r) => ({ id: r.id, data: r.data })));
  }
  const { rows: meta } = await q.query<{ version: string }>("SELECT version FROM store_meta WHERE id = 1");
  g.__snap = snapshotOf(toRows(fromRows(rows)));
  const d = fromRows(rows);
  migrate(d);
  g.__db = d;
  g.__ver = Number(meta[0].version);
}

async function writeChanges(q: Q, changes: Change[]) {
  for (const step of writePlan(changes)) {
    if (step.op === "upsert") {
      for (let i = 0; i < step.rows.length; i += 200) {
        const chunk = step.rows.slice(i, i + 200);
        const vals: unknown[] = [];
        const placeholders = chunk.map((r, idx) => {
          const base = idx * 3;
          vals.push(r.id, r.pos, r.json);
          return `($${base + 1}, $${base + 2}, $${base + 3}::jsonb)`;
        }).join(", ");
        await q.query(
          `INSERT INTO "${step.table}" (id, pos, data) VALUES ${placeholders} ON CONFLICT (id) DO UPDATE SET pos = EXCLUDED.pos, data = EXCLUDED.data`,
          vals,
        );
      }
    } else {
      for (let i = 0; i < step.ids.length; i += 500) {
        await q.query(`DELETE FROM "${step.table}" WHERE id = ANY($1::text[])`, [step.ids.slice(i, i + 500)]);
      }
    }
  }
}

async function initSql() {
  const pool = (g.__pool ??= await createSchema());
  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");
    const { rows: meta } = await conn.query<{ version: string }>("SELECT version FROM store_meta WHERE id = 1 FOR UPDATE");
    if (Number(meta[0].version) === 0) {
      const imported = fs.existsSync(FILE);
      const start = imported ? (JSON.parse(fs.readFileSync(FILE, "utf8")) as DB) : fresh();
      migrate(start);
      await writeChanges(conn, diff(new Map(), start).changes);
      await conn.query("UPDATE store_meta SET version = 1 WHERE id = 1");
      console.log(`[db] PostgreSQL initialised (${imported ? `imported ${FILE}` : "seeded"})`);
    }
    await conn.query("COMMIT");
    await loadSql(conn);
  } catch (e) {
    await conn.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
  g.__timer ??= setInterval(() => { void serial(refreshIfStale).catch((e) => console.error("[db] refresh failed", e)); }, REFRESH_MS);
  g.__timer.unref?.();
}

async function refreshIfStale() {
  const { rows: meta } = await g.__pool!.query<{ version: string }>("SELECT version FROM store_meta WHERE id = 1");
  if (Number(meta[0].version) !== g.__ver) await loadSql(g.__pool!);
}

async function mutateSql<T>(fn: (d: DB) => T): Promise<T> {
  if (!g.__pool) throw new Error("Database not ready: PostgreSQL failed to load at startup. Check DATABASE_URL and restart the server.");
  const conn = await g.__pool.connect();
  try {
    await conn.query("BEGIN");
    const { rows: meta } = await conn.query<{ version: string }>("SELECT version FROM store_meta WHERE id = 1 FOR UPDATE");
    if (Number(meta[0].version) !== g.__ver) await loadSql(conn);
    const d = g.__db!;
    const r = fn(d);
    processWaitlist(d);
    const { changes, next } = diff(g.__snap!, d);
    if (changes.length) {
      await writeChanges(conn, changes);
      await conn.query("UPDATE store_meta SET version = version + 1 WHERE id = 1");
    }
    await conn.query("COMMIT");
    g.__snap = next;
    if (changes.length) g.__ver! += 1;
    return r;
  } catch (e) {
    await conn.query("ROLLBACK").catch(() => {});
    if (g.__snap) g.__db = fromSnapshot(g.__snap);
    throw e;
  } finally {
    conn.release();
  }
}

/* ---------------- Public API ---------------- */
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = (g.__chain ?? Promise.resolve()).then(job);
  g.__chain = run.catch(() => {});
  return run;
}

export function initDb() {
  return (g.__init ??= usePg ? initSql() : Promise.resolve(loadFile()));
}

export function db(): DB {
  if (!g.__db) {
    if (usePg) throw new Error("Database not ready: PostgreSQL failed to load at startup. Check DATABASE_URL and restart the server.");
    loadFile();
  }
  return g.__db!;
}

export function mutate<T>(fn: (d: DB) => T): Promise<T> {
  return serial(async () => {
    if (usePg) return mutateSql(fn);
    const d = db();
    try {
      const r = fn(d);
      processWaitlist(d);
      persistFile();
      return r;
    } catch (e) {
      g.__db = undefined;
      throw e;
    }
  });
}

/* ---------------- Administration (Admin → Database) ---------------- */
export async function dbStatus() {
  const d = db();
  const memory = Object.fromEntries([...toRows(d)].map(([t, rs]) => [t, rs.length])) as Record<string, number>;
  if (!usePg) {
    const st = fs.existsSync(FILE) ? fs.statSync(FILE) : null;
    return { mode: "file" as const, file: FILE, bytes: st?.size ?? 0, savedAt: st?.mtimeMs ?? 0, memory };
  }
  const q = g.__pool!;
  const url = new URL(process.env.DATABASE_URL!);
  const { rows: [server] } = await q.query<{ version: string; name: string }>("SELECT version() AS version, current_database() AS name");
  const { rows: [meta] } = await q.query<{ version: string }>("SELECT version FROM store_meta WHERE id = 1");
  const { rows: objects } = await q.query<{ name: string; type: string; bytes: string }>(
    `SELECT table_name AS name, table_type AS type,
       CASE WHEN table_type = 'BASE TABLE' THEN pg_total_relation_size(quote_ident(table_name)) ELSE 0 END AS bytes
     FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_type, table_name`,
  );
  const tables = [];
  for (const o of objects.filter((x) => x.type === "BASE TABLE")) {
    const { rows: [c] } = await q.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM "${o.name}"`);
    tables.push({ name: String(o.name), rows: Number(c.n), bytes: Number(o.bytes), memory: memory[o.name] });
  }
  const { rows: fks } = await q.query<{ child: string; col: string; parent: string; name: string }>(
    `SELECT tc.table_name AS child, kcu.column_name AS col, ccu.table_name AS parent, tc.constraint_name AS name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' ORDER BY child, col`,
  );
  const { rows: migrations } = await q.query<{ version: number; name: string; applied_at: string }>("SELECT version, name, applied_at FROM schema_migrations ORDER BY version");
  const { orphans } = await import("./db-schema");
  return {
    mode: "postgres" as const,
    server: String(server.version).split(",")[0], database: String(server.name), host: `${url.hostname}:${url.port || 5432}`, user: decodeURIComponent(url.username),
    weakCredentials: url.username === "postgres" && !url.password, dataVersion: Number(meta.version),
    tables, views: objects.filter((x) => x.type === "VIEW").map((x) => String(x.name)),
    foreignKeys: fks.map((f) => ({ child: String(f.child), col: String(f.col), parent: String(f.parent), name: String(f.name) })),
    migrations: migrations.map((m) => ({ version: Number(m.version), name: String(m.name), appliedAt: new Date(m.applied_at).getTime() })),
    orphans: await orphans(q),
  };
}
