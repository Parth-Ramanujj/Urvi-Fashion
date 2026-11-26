import "server-only";
import type { Pool, PoolClient } from "pg";
import { COLLECTIONS } from "./store-diff";

/*
 * PostgreSQL schema, relationships and versioned migrations (Render-ready).
 * Records are stored one row per record (full record in `data` JSONB). Relationship columns are STORED generated
 * columns extracted from that JSONB, so they can never drift from the record, and real FOREIGN KEYs sit on them:
 * PostgreSQL itself rejects orphans (e.g. an order for a user that doesn't exist).
 */

export type Q = Pick<Pool | PoolClient, "query">;
export const TABLES = [...Object.values(COLLECTIONS).map(([t]) => t), "settings"];

/** child.column (from JSON key) → parent.id. ON DELETE RESTRICT: parents with children can't be deleted. */
export const RELATIONS = [
  { table: "orders", column: "user_id", key: "userId", ref: "users", label: "Order → customer" },
  { table: "orders", column: "delivery_partner_id", key: "deliveryPartnerId", ref: "users", label: "Order → delivery partner" },
  { table: "users", column: "referred_by", key: "referredBy", ref: "users", label: "Customer → referrer" },
  { table: "reviews", column: "product_id", key: "productId", ref: "products", label: "Review → product" },
  { table: "reviews", column: "user_id", key: "userId", ref: "users", label: "Review → customer" },
  { table: "waitlist", column: "product_id", key: "productId", ref: "products", label: "Back-in-stock alert → product" },
  { table: "waitlist", column: "user_id", key: "userId", ref: "users", label: "Back-in-stock alert → customer" },
  { table: "memberships", column: "user_id", key: "userId", ref: "users", label: "Membership purchase → customer" },
  { table: "tickets", column: "user_id", key: "userId", ref: "users", label: "Support ticket → customer" },
  { table: "coin_ledger", column: "user_id", key: "userId", ref: "users", label: "Coin entry → customer" },
  { table: "coin_ledger", column: "order_id", key: "orderId", ref: "orders", label: "Coin entry → order" },
  { table: "notifications", column: "user_id", key: "userId", ref: "users", label: "Notification → customer (empty = everyone)" },
] as const;

const BASE_EXTRA: Record<string, string> = {
  users: `, email VARCHAR(190) GENERATED ALWAYS AS (data->>'email') STORED,
    phone VARCHAR(20) GENERATED ALWAYS AS (data->>'phone') STORED,
    role VARCHAR(20) GENERATED ALWAYS AS (data->>'role') STORED,
    CONSTRAINT uq_users_email UNIQUE (email)`,
  products: `, slug VARCHAR(190) GENERATED ALWAYS AS (data->>'slug') STORED,
    name VARCHAR(190) GENERATED ALWAYS AS (data->>'name') STORED,
    CONSTRAINT uq_products_slug UNIQUE (slug)`,
  orders: `, ref VARCHAR(40) GENERATED ALWAYS AS (data->>'ref') STORED,
    user_id VARCHAR(64) GENERATED ALWAYS AS (data->>'userId') STORED,
    status VARCHAR(30) GENERATED ALWAYS AS (data->>'status') STORED,
    total NUMERIC(12,2) GENERATED ALWAYS AS ((data->'totals'->>'total')::NUMERIC(12,2)) STORED,
    created_at BIGINT GENERATED ALWAYS AS ((data->>'createdAt')::BIGINT) STORED,
    CONSTRAINT uq_orders_ref UNIQUE (ref)`,
  integrationMessages: `, user_id VARCHAR(190) GENERATED ALWAYS AS (NULLIF(data->>'userId', 'null')) STORED,
    channel VARCHAR(20) GENERATED ALWAYS AS (data->>'channel') STORED,
    status VARCHAR(20) GENERATED ALWAYS AS (data->>'status') STORED,
    created_at BIGINT GENERATED ALWAYS AS ((data->>'createdAt')::BIGINT) STORED`,
};

const BASE_INDEXES: Record<string, string[]> = {
  users: [`CREATE INDEX IF NOT EXISTS ix_users_phone ON users (phone)`],
  orders: [
    `CREATE INDEX IF NOT EXISTS ix_orders_user ON orders (user_id)`,
    `CREATE INDEX IF NOT EXISTS ix_orders_status ON orders (status)`,
  ],
  integrationMessages: [
    `CREATE INDEX IF NOT EXISTS ix_integration_messages_user ON integration_messages (user_id)`,
    `CREATE INDEX IF NOT EXISTS ix_integration_messages_status ON integration_messages (status)`,
    `CREATE INDEX IF NOT EXISTS ix_integration_messages_created ON integration_messages (created_at)`,
  ],
};

async function exists(q: Q, sql: string, args: unknown[]) {
  const { rows } = await q.query(sql, args);
  return rows.length > 0;
}
const hasColumn = (q: Q, t: string, c: string) =>
  exists(q, "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2", [t, c]);
const hasConstraint = (q: Q, t: string, n: string) =>
  exists(q, "SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = $1 AND constraint_name = $2", [t, n]);

/** Rows whose relationship column points at a missing parent, per relation. */
export async function orphans(q: Q) {
  const out: { label: string; table: string; column: string; count: number; sample: string[] }[] = [];
  for (const r of RELATIONS) {
    if (!(await hasColumn(q, r.table, r.column))) continue;
    const { rows } = await q.query<{ id: string }>(
      `SELECT c.id FROM "${r.table}" c LEFT JOIN "${r.ref}" p ON p.id = c."${r.column}" WHERE c."${r.column}" IS NOT NULL AND p.id IS NULL LIMIT 5`,
    );
    const { rows: cnt } = await q.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM "${r.table}" c LEFT JOIN "${r.ref}" p ON p.id = c."${r.column}" WHERE c."${r.column}" IS NOT NULL AND p.id IS NULL`,
    );
    out.push({ label: r.label, table: r.table, column: r.column, count: Number(cnt[0]?.n ?? 0), sample: rows.map((x) => x.id) });
  }
  return out;
}

/** Ordered, append-only. Each step is idempotent so a migration interrupted halfway can simply run again. */
export const MIGRATIONS: { version: number; name: string; up: (q: Q) => Promise<void> }[] = [
  {
    version: 1, name: "base tables",
    async up(q) {
      await q.query("CREATE TABLE IF NOT EXISTS store_meta (id SMALLINT PRIMARY KEY, version BIGINT NOT NULL)");
      await q.query("INSERT INTO store_meta (id, version) VALUES (1, 0) ON CONFLICT (id) DO NOTHING");
      for (const t of TABLES) {
        await q.query(`CREATE TABLE IF NOT EXISTS "${t}" (id VARCHAR(190) NOT NULL PRIMARY KEY, pos INT NOT NULL, data JSONB NOT NULL${BASE_EXTRA[t] ?? ""})`);
        await q.query(`CREATE INDEX IF NOT EXISTS "ix_${t}_pos" ON "${t}" (pos)`);
        for (const ix of BASE_INDEXES[t] ?? []) await q.query(ix);
      }
    },
  },
  {
    version: 2, name: "relationship columns",
    async up(q) {
      for (const r of RELATIONS) {
        if (!(await hasColumn(q, r.table, r.column))) {
          await q.query(`ALTER TABLE "${r.table}" ADD COLUMN "${r.column}" VARCHAR(190) GENERATED ALWAYS AS (NULLIF(data->>'${r.key}', 'null')) STORED`);
        }
        await q.query(`CREATE INDEX IF NOT EXISTS "ix_${r.table}_${r.column}" ON "${r.table}" ("${r.column}")`);
      }
    },
  },
  {
    version: 3, name: "foreign keys",
    async up(q) {
      const bad = (await orphans(q)).filter((o) => o.count > 0);
      if (bad.length) {
        throw new Error(`Cannot add foreign keys: orphan rows found — ${bad.map((o) => `${o.table}.${o.column}: ${o.count} (e.g. ${o.sample.join(", ")})`).join("; ")}. Fix or delete these rows, then restart.`);
      }
      for (const r of RELATIONS) {
        const name = `fk_${r.table}_${r.column}`;
        if (await hasConstraint(q, r.table, name)) continue;
        await q.query(`ALTER TABLE "${r.table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${r.column}") REFERENCES "${r.ref}" (id) ON DELETE RESTRICT ON UPDATE RESTRICT`);
      }
    },
  },
  {
    version: 4, name: "reporting views",
    async up(q) {
      await q.query(`CREATE OR REPLACE VIEW v_order_items AS
        SELECT o.id AS order_id, o.ref, o.user_id, o.status, o.created_at,
          i->>'productId' AS product_id, i->>'sku' AS sku, i->>'name' AS name, i->>'color' AS color,
          i->>'size' AS size, (i->>'qty')::INT AS qty, (i->>'price')::NUMERIC(12,2) AS price,
          (i->>'mrp')::NUMERIC(12,2) AS mrp, ((i->>'qty')::INT * (i->>'price')::NUMERIC(12,2)) AS line_total
        FROM orders o, jsonb_array_elements(o.data->'items') AS i`);
      await q.query(`CREATE OR REPLACE VIEW v_product_variants AS
        SELECT p.id AS product_id, p.slug, p.name,
          v->>'sku' AS sku, v->>'color' AS color, v->>'size' AS size,
          (v->>'stock')::INT AS stock, COALESCE((v->>'price')::NUMERIC(12,2), (p.data->>'price')::NUMERIC(12,2)) AS price
        FROM products p, jsonb_array_elements(p.data->'variants') AS v`);
      await q.query(`CREATE OR REPLACE VIEW v_low_stock AS SELECT * FROM v_product_variants WHERE stock <= 3`);
      await q.query(`CREATE OR REPLACE VIEW v_customer_summary AS
        SELECT u.id AS user_id, u.email, u.phone, u.data->>'name' AS name, (u.data->>'coins')::INT AS coins,
          COUNT(o.id)::INT AS orders, COALESCE(SUM(o.total), 0) AS total_spent, to_timestamp(MAX(o.created_at) / 1000.0) AS last_order_at
        FROM users u LEFT JOIN orders o ON o.user_id = u.id AND o.status NOT IN ('cancelled', 'returned')
        WHERE u.role = 'customer' GROUP BY u.id`);
      await q.query(`CREATE OR REPLACE VIEW v_daily_sales AS
        SELECT DATE(to_timestamp(created_at / 1000.0)) AS day, COUNT(*)::INT AS orders, SUM(total) AS revenue
        FROM orders WHERE status NOT IN ('cancelled', 'returned') GROUP BY day`);
    },
  },
  {
    version: 5, name: "whatsapp / social CRM",
    async up(q) {
      await q.query(`CREATE TABLE IF NOT EXISTS "integration_messages" (id VARCHAR(190) NOT NULL PRIMARY KEY, pos INT NOT NULL, data JSONB NOT NULL${BASE_EXTRA.integrationMessages ?? ""})`);
      const cols: [string, string, string][] = [
        ["user_id", "VARCHAR(190)", "NULLIF(data->>'userId', 'null')"],
        ["channel", "VARCHAR(20)", "data->>'channel'"],
        ["status", "VARCHAR(20)", "data->>'status'"],
        ["created_at", "BIGINT", "(data->>'createdAt')::BIGINT"],
      ];
      for (const [column, type, expr] of cols) {
        if (!(await hasColumn(q, "integration_messages", column))) {
          await q.query(`ALTER TABLE "integration_messages" ADD COLUMN "${column}" ${type} GENERATED ALWAYS AS (${expr}) STORED`);
        }
      }
      for (const ix of BASE_INDEXES.integrationMessages ?? []) await q.query(ix);
    },
  },
];

/** Apply pending migrations, once, even if several server processes start together. */
export async function runMigrations(pool: Pool) {
  const conn = await pool.connect();
  try {
    await conn.query("SELECT pg_advisory_lock(739201)");
    await conn.query("CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY, name VARCHAR(100) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    const { rows: done } = await conn.query<{ version: number }>("SELECT version FROM schema_migrations");
    const applied = new Set(done.map((r) => Number(r.version)));
    for (const m of MIGRATIONS) {
      if (applied.has(m.version)) continue;
      await m.up(conn);
      await conn.query("INSERT INTO schema_migrations (version, name) VALUES ($1, $2)", [m.version, m.name]);
      console.log(`[db] migration ${m.version} applied: ${m.name}`);
    }
  } finally {
    await conn.query("SELECT pg_advisory_unlock(739201)").catch(() => {});
    conn.release();
  }
}
