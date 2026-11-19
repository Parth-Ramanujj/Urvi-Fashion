import "server-only";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { migrate, processWaitlist } from "./retention-core";
import { buildBlankSeed, buildSeed } from "./seed";
import { runMigrations, TABLES } from "./db-schema";
import { diff, fromRows, fromSnapshot, snapshotOf, toRows, writePlan, type Change, type Snapshot } from "./store-diff";
import type { DB } from "./types";

/*
 * Storage. Every read goes through db() (an in-memory copy) and every write through mutate().
 *  - DATABASE_URL set (production): MySQL. Each mutate() is one transaction that locks store_meta, so writes from any
 *    number of server processes are serialised; only the rows that changed are written. Other processes notice a
 *    newer version within REFRESH_MS (reads) or immediately (inside their next write).
 *  - Not set: a JSON file in DATA_DIR — fine for local dev and demos.
 * On Vercel only /tmp is writable, so the file fallback lives there (wiped on cold starts — demos only).
 */
const DIR = path.resolve(process.env.DATA_DIR || (process.env.VERCEL ? "/tmp/store-data" : path.join(process.cwd(), "data")));
const FILE = path.join(DIR, "db.json");
// shortcut: uploads are files on this server's disk; with several servers put DATA_DIR/uploads on shared storage or S3.
export const UPLOAD_DIR = path.join(DIR, "uploads");
const REFRESH_MS = 3000;

type G = { __db?: DB; __snap?: Snapshot; __ver?: number; __pool?: mysql.Pool; __chain?: Promise<unknown>; __init?: Promise<void>; __timer?: NodeJS.Timeout };
const g = globalThis as unknown as G;
const useMysql = !!process.env.DATABASE_URL;

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

/* ---------------- MySQL mode ---------------- */
function dbName() {
  const name = new URL(process.env.DATABASE_URL!).pathname.slice(1);
  if (!/^\w{1,64}$/.test(name)) throw new Error("DATABASE_URL must end with a database name, e.g. mysql://root:@127.0.0.1:3306/clothing");
  return name;
}

async function createSchema() {
  const url = new URL(process.env.DATABASE_URL!);
  const name = dbName();
  url.pathname = "/";
  const admin = await mysql.createConnection({ uri: url.toString(), charset: "utf8mb4" });
  try { await admin.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); } finally { await admin.end(); }
  const pool = mysql.createPool({ uri: process.env.DATABASE_URL, charset: "utf8mb4", connectionLimit: Number(process.env.DB_POOL_SIZE) || 10, waitForConnections: true, enableKeepAlive: true });
  pool.pool.on("connection", (c) => c.query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'"));
  await runMigrations(pool); // tables, relationship columns, foreign keys, views
  return pool;
}

type Q = Pick<mysql.PoolConnection, "query">;

async function loadSql(q: Q) {
  const rows = new Map<string, { id: string; data: unknown }[]>();
  for (const t of TABLES) {
    // Read JSON as text and parse here: the driver auto-parses MySQL JSON but not MariaDB's, and a bare string value is ambiguous.
    const [rs] = await q.query<mysql.RowDataPacket[]>(`SELECT id, CAST(data AS CHAR) AS data FROM \`${t}\` ORDER BY pos`);
    rows.set(t, rs.map((r) => ({ id: r.id, data: JSON.parse(r.data) })));
  }
  const [[meta]] = await q.query<mysql.RowDataPacket[]>("SELECT version FROM store_meta WHERE id = 1");
  g.__snap = snapshotOf(toRows(fromRows(rows))); // exactly what MySQL holds
  const d = fromRows(rows);
  migrate(d); // fills defaults for new fields; persisted with the next write
  g.__db = d;
  g.__ver = Number(meta.version);
}

async function writeChanges(q: Q, changes: Change[]) {
  for (const step of writePlan(changes)) { // parents before children for inserts, the reverse for deletes (foreign keys)
    if (step.op === "upsert") {
      for (let i = 0; i < step.rows.length; i += 200) {
        await q.query(`INSERT INTO \`${step.table}\` (id, pos, data) VALUES ? ON DUPLICATE KEY UPDATE pos = VALUES(pos), data = VALUES(data)`, [step.rows.slice(i, i + 200).map((r) => [r.id, r.pos, r.json])]);
      }
    } else {
      for (let i = 0; i < step.ids.length; i += 500) await q.query(`DELETE FROM \`${step.table}\` WHERE id IN (?)`, [step.ids.slice(i, i + 500)]);
    }
  }
}

async function initSql() {
  const pool = (g.__pool ??= await createSchema());
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[meta]] = await conn.query<mysql.RowDataPacket[]>("SELECT version FROM store_meta WHERE id = 1 FOR UPDATE");
    if (Number(meta.version) === 0) {
      // First start: import the existing JSON store if there is one (keeps current data), else seed.
      const imported = fs.existsSync(FILE);
      const start = imported ? (JSON.parse(fs.readFileSync(FILE, "utf8")) as DB) : fresh();
      migrate(start);
      await writeChanges(conn, diff(new Map(), start).changes);
      await conn.query("UPDATE store_meta SET version = 1 WHERE id = 1");
      console.log(`[db] MySQL initialised (${imported ? `imported ${FILE}` : "seeded"})`);
    }
    await conn.commit();
    await loadSql(conn);
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
  // Pick up writes made by other server processes (reads stay at most REFRESH_MS behind; writes are always current).
  g.__timer ??= setInterval(() => { void serial(refreshIfStale).catch((e) => console.error("[db] refresh failed", e)); }, REFRESH_MS);
  g.__timer.unref?.();
}

async function refreshIfStale() {
  const [[meta]] = await g.__pool!.query<mysql.RowDataPacket[]>("SELECT version FROM store_meta WHERE id = 1");
  if (Number(meta.version) !== g.__ver) await loadSql(g.__pool!);
}

async function mutateSql<T>(fn: (d: DB) => T): Promise<T> {
  const conn = await g.__pool!.getConnection();
  try {
    await conn.beginTransaction();
    const [[meta]] = await conn.query<mysql.RowDataPacket[]>("SELECT version FROM store_meta WHERE id = 1 FOR UPDATE");
    if (Number(meta.version) !== g.__ver) await loadSql(conn); // another process wrote since our last read
    const d = g.__db!;
    const r = fn(d);
    processWaitlist(d); // any write that restocks a variant (admin edit, cancel, return) alerts waiting customers
    const { changes, next } = diff(g.__snap!, d);
    if (changes.length) {
      await writeChanges(conn, changes);
      await conn.query("UPDATE store_meta SET version = version + 1 WHERE id = 1");
    }
    await conn.commit();
    g.__snap = next;
    if (changes.length) g.__ver! += 1;
    return r;
  } catch (e) {
    await conn.rollback().catch(() => {});
    if (g.__snap) g.__db = fromSnapshot(g.__snap); // discard the half-applied in-memory edit; MySQL was rolled back
    throw e;
  } finally {
    conn.release();
  }
}

/* ---------------- Public API ---------------- */

/** Writes (and background refreshes) run one at a time per process, so the shared in-memory copy is never edited concurrently. */
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = (g.__chain ?? Promise.resolve()).then(job);
  g.__chain = run.catch(() => {});
  return run;
}

/** Load the store before the server takes requests (called from instrumentation.ts). */
export function initDb() {
  return (g.__init ??= useMysql ? initSql() : Promise.resolve(loadFile()));
}

export function db(): DB {
  if (!g.__db) {
    if (useMysql) throw new Error("Database not ready: MySQL failed to load at startup. Check DATABASE_URL and that MySQL is running, then restart the server.");
    loadFile();
  }
  return g.__db!;
}

/** Apply a synchronous change and save it. If fn throws (or the save fails) nothing is saved and the in-memory copy is restored. */
export function mutate<T>(fn: (d: DB) => T): Promise<T> {
  return serial(async () => {
    if (useMysql) return mutateSql(fn);
    const d = db();
    try {
      const r = fn(d);
      processWaitlist(d);
      persistFile();
      return r;
    } catch (e) {
      g.__db = undefined; // reloads the last saved file
      throw e;
    }
  });
}

/* ---------------- Administration (Admin → Database) ---------------- */
export async function dbStatus() {
  const d = db();
  const memory = Object.fromEntries([...toRows(d)].map(([t, rs]) => [t, rs.length])) as Record<string, number>;
  if (!useMysql) {
    const st = fs.existsSync(FILE) ? fs.statSync(FILE) : null;
    return { mode: "file" as const, file: FILE, bytes: st?.size ?? 0, savedAt: st?.mtimeMs ?? 0, memory };
  }
  const q = g.__pool!;
  const url = new URL(process.env.DATABASE_URL!);
  const [[server]] = await q.query<mysql.RowDataPacket[]>("SELECT VERSION() AS version, DATABASE() AS name");
  const [[meta]] = await q.query<mysql.RowDataPacket[]>("SELECT version FROM store_meta WHERE id = 1");
  const [objects] = await q.query<mysql.RowDataPacket[]>(
    "SELECT TABLE_NAME AS name, TABLE_TYPE AS type, COALESCE(DATA_LENGTH, 0) + COALESCE(INDEX_LENGTH, 0) AS bytes FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_TYPE, TABLE_NAME");
  const tables = [];
  for (const o of objects.filter((x) => x.type === "BASE TABLE")) {
    const [[c]] = await q.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n FROM \`${o.name}\``);
    tables.push({ name: String(o.name), rows: Number(c.n), bytes: Number(o.bytes), memory: memory[o.name] });
  }
  const [fks] = await q.query<mysql.RowDataPacket[]>(
    "SELECT TABLE_NAME AS child, COLUMN_NAME AS col, REFERENCED_TABLE_NAME AS parent, CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY child, col");
  const [migrations] = await q.query<mysql.RowDataPacket[]>("SELECT version, name, applied_at FROM schema_migrations ORDER BY version");
  const { orphans } = await import("./db-schema");
  return {
    mode: "mysql" as const,
    server: String(server.version), database: String(server.name), host: `${url.hostname}:${url.port || 3306}`, user: decodeURIComponent(url.username),
    weakCredentials: url.username === "root" || !url.password, dataVersion: Number(meta.version),
    tables, views: objects.filter((x) => x.type === "VIEW").map((x) => String(x.name)),
    foreignKeys: fks.map((f) => ({ child: String(f.child), col: String(f.col), parent: String(f.parent), name: String(f.name) })),
    migrations: migrations.map((m) => ({ version: Number(m.version), name: String(m.name), appliedAt: new Date(m.applied_at).getTime() })),
    orphans: await orphans(q),
  };
}
