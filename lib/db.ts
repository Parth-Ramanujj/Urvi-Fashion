import "server-only";
import fs from "node:fs";
import path from "node:path";
import { migrate, processWaitlist } from "./retention-core";
import { buildBlankSeed, buildSeed } from "./seed";
import type { DB } from "./types";

// shortcut: single-process JSON document store (sync writes, atomic rename). Swap this module for Postgres/Prisma
// when running more than one server instance; every read/write in the app goes through db()/mutate().
// DATA_DIR lets one codebase run several white-label stores side by side, each with its own data folder.
const DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
const FILE = path.join(DIR, "db.json");
const g = globalThis as unknown as { __db?: DB };

export function db(): DB {
  if (!g.__db) {
    if (fs.existsSync(FILE)) { g.__db = JSON.parse(fs.readFileSync(FILE, "utf8")) as DB; if (migrate(g.__db)) persist(); }
    else { g.__db = process.env.DEMO_DATA === "false" ? buildBlankSeed() : buildSeed(); migrate(g.__db); persist(); }
  }
  return g.__db;
}

function persist() {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(g.__db));
  fs.renameSync(tmp, FILE);
}

/** Run a synchronous change against the store and persist it. On throw, reload from disk so partial edits are discarded. */
export function mutate<T>(fn: (d: DB) => T): T {
  const d = db();
  try {
    const r = fn(d);
    processWaitlist(d); // any write that restocks a variant (admin edit, cancel, return) alerts waiting customers
    persist();
    return r;
  } catch (e) {
    g.__db = undefined;
    throw e;
  }
}

export function resetDb() {
  g.__db = buildSeed();
  migrate(g.__db);
  persist();
}

export const UPLOAD_DIR = path.join(DIR, "uploads");
