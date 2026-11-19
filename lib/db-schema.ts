import "server-only";
import type mysql from "mysql2/promise";
import { COLLECTIONS } from "./store-diff";

/*
 * MySQL schema, relationships and versioned migrations.
 * Records are stored one row per record (full record in `data` JSON). Relationship columns are STORED generated
 * columns extracted from that JSON, so they can never drift from the record, and real FOREIGN KEYs sit on them:
 * MySQL itself rejects orphans (e.g. an order for a user that doesn't exist).
 */

type Q = Pick<mysql.PoolConnection, "query">;
export const TABLES = [...Object.values(COLLECTIONS).map(([t]) => t), "settings"];

/** child.column (from JSON path) → parent.id. ON DELETE RESTRICT: parents with children can't be deleted. */
export const RELATIONS = [
  { table: "orders", column: "user_id", path: "$.userId", ref: "users", label: "Order → customer" },
  { table: "orders", column: "delivery_partner_id", path: "$.deliveryPartnerId", ref: "users", label: "Order → delivery partner" },
  { table: "users", column: "referred_by", path: "$.referredBy", ref: "users", label: "Customer → referrer" },
  { table: "reviews", column: "product_id", path: "$.productId", ref: "products", label: "Review → product" },
  { table: "reviews", column: "user_id", path: "$.userId", ref: "users", label: "Review → customer" },
  { table: "waitlist", column: "product_id", path: "$.productId", ref: "products", label: "Back-in-stock alert → product" },
  { table: "waitlist", column: "user_id", path: "$.userId", ref: "users", label: "Back-in-stock alert → customer" },
  { table: "memberships", column: "user_id", path: "$.userId", ref: "users", label: "Membership purchase → customer" },
  { table: "tickets", column: "user_id", path: "$.userId", ref: "users", label: "Support ticket → customer" },
  { table: "coin_ledger", column: "user_id", path: "$.userId", ref: "users", label: "Coin entry → customer" },
  { table: "coin_ledger", column: "order_id", path: "$.orderId", ref: "orders", label: "Coin entry → order" },
  { table: "notifications", column: "user_id", path: "$.userId", ref: "users", label: "Notification → customer (empty = everyone)" },
] as const;

// JSON null and missing keys both become SQL NULL (JSON_UNQUOTE of a JSON null would be the string 'null').
const jsonCol = (path: string, type = "VARCHAR(190)") => `${type} AS (NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '${path}')), 'null')) STORED`;

const BASE_EXTRA: Record<string, string> = {
  users: `, email VARCHAR(190) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.email'))) STORED, phone VARCHAR(20) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.phone'))) STORED,
    role VARCHAR(20) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.role'))) STORED, UNIQUE KEY uq_users_email (email), KEY ix_users_phone (phone)`,
  products: `, slug VARCHAR(190) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.slug'))) STORED, name VARCHAR(190) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.name'))) STORED, UNIQUE KEY uq_products_slug (slug)`,
  orders: `, ref VARCHAR(40) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.ref'))) STORED, user_id VARCHAR(64) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.userId'))) STORED,
    status VARCHAR(30) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.status'))) STORED, total DECIMAL(12,2) AS (JSON_EXTRACT(data, '$.totals.total')) STORED,
    created_at BIGINT AS (JSON_EXTRACT(data, '$.createdAt')) STORED, UNIQUE KEY uq_orders_ref (ref), KEY ix_orders_user (user_id), KEY ix_orders_status (status)`,
};

async function exists(q: Q, sql: string, args: unknown[]) {
  const [rows] = await q.query<mysql.RowDataPacket[]>(sql, args);
  return rows.length > 0;
}
const hasColumn = (q: Q, t: string, c: string) => exists(q, "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?", [t, c]);
const hasConstraint = (q: Q, t: string, n: string) => exists(q, "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?", [t, n]);

/** Rows whose relationship column points at a missing parent, per relation. */
export async function orphans(q: Q) {
  const out: { label: string; table: string; column: string; count: number; sample: string[] }[] = [];
  for (const r of RELATIONS) {
    if (!(await hasColumn(q, r.table, r.column))) continue;
    const [rows] = await q.query<mysql.RowDataPacket[]>(
      `SELECT c.id FROM \`${r.table}\` c LEFT JOIN \`${r.ref}\` p ON p.id = c.\`${r.column}\` WHERE c.\`${r.column}\` IS NOT NULL AND p.id IS NULL LIMIT 5`);
    const [[{ n }]] = await q.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) n FROM \`${r.table}\` c LEFT JOIN \`${r.ref}\` p ON p.id = c.\`${r.column}\` WHERE c.\`${r.column}\` IS NOT NULL AND p.id IS NULL`);
    out.push({ label: r.label, table: r.table, column: r.column, count: Number(n), sample: rows.map((x) => x.id) });
  }
  return out;
}

/** Ordered, append-only. Each step is idempotent so a migration interrupted halfway can simply run again. */
export const MIGRATIONS: { version: number; name: string; up: (q: Q) => Promise<void> }[] = [
  {
    version: 1, name: "base tables",
    async up(q) {
      await q.query("CREATE TABLE IF NOT EXISTS store_meta (id TINYINT PRIMARY KEY, version BIGINT NOT NULL) ENGINE=InnoDB");
      await q.query("INSERT IGNORE INTO store_meta (id, version) VALUES (1, 0)");
      for (const t of TABLES) {
        await q.query(`CREATE TABLE IF NOT EXISTS \`${t}\` (id VARCHAR(190) NOT NULL PRIMARY KEY, pos INT NOT NULL, data JSON NOT NULL${BASE_EXTRA[t] ?? ""}, KEY ix_${t}_pos (pos))
          ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      }
    },
  },
  {
    version: 2, name: "relationship columns",
    async up(q) {
      for (const r of RELATIONS) {
        if (await hasColumn(q, r.table, r.column)) continue; // orders.user_id already exists from v1
        await q.query(`ALTER TABLE \`${r.table}\` ADD COLUMN \`${r.column}\` ${jsonCol(r.path)}, ADD KEY ix_${r.table}_${r.column} (\`${r.column}\`)`);
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
        await q.query(`ALTER TABLE \`${r.table}\` ADD CONSTRAINT \`${name}\` FOREIGN KEY (\`${r.column}\`) REFERENCES \`${r.ref}\` (id) ON DELETE RESTRICT ON UPDATE RESTRICT`);
      }
    },
  },
  {
    version: 4, name: "reporting views",
    async up(q) {
      await q.query(`CREATE OR REPLACE VIEW v_order_items AS
        SELECT o.id AS order_id, o.ref, o.user_id, o.status, o.created_at, i.product_id, i.sku, i.name, i.color, i.size, i.qty, i.price, i.mrp, i.qty * i.price AS line_total
        FROM orders o, JSON_TABLE(o.data, '$.items[*]' COLUMNS (
          product_id VARCHAR(190) PATH '$.productId', sku VARCHAR(190) PATH '$.sku', name VARCHAR(190) PATH '$.name', color VARCHAR(60) PATH '$.color',
          size VARCHAR(10) PATH '$.size', qty INT PATH '$.qty', price DECIMAL(12,2) PATH '$.price', mrp DECIMAL(12,2) PATH '$.mrp')) i`);
      await q.query(`CREATE OR REPLACE VIEW v_product_variants AS
        SELECT p.id AS product_id, p.slug, p.name, v.sku, v.color, v.size, v.stock, COALESCE(v.price, JSON_EXTRACT(p.data, '$.price')) AS price
        FROM products p, JSON_TABLE(p.data, '$.variants[*]' COLUMNS (
          sku VARCHAR(190) PATH '$.sku', color VARCHAR(60) PATH '$.color', size VARCHAR(10) PATH '$.size', stock INT PATH '$.stock', price DECIMAL(12,2) PATH '$.price')) v`);
      await q.query(`CREATE OR REPLACE VIEW v_low_stock AS SELECT * FROM v_product_variants WHERE stock <= 3`);
      await q.query(`CREATE OR REPLACE VIEW v_customer_summary AS
        SELECT u.id AS user_id, u.email, u.phone, JSON_UNQUOTE(JSON_EXTRACT(u.data, '$.name')) AS name, JSON_EXTRACT(u.data, '$.coins') AS coins,
          COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS total_spent, FROM_UNIXTIME(MAX(o.created_at) / 1000) AS last_order_at
        FROM users u LEFT JOIN orders o ON o.user_id = u.id AND o.status NOT IN ('cancelled', 'returned')
        WHERE u.role = 'customer' GROUP BY u.id`);
      await q.query(`CREATE OR REPLACE VIEW v_daily_sales AS
        SELECT DATE(FROM_UNIXTIME(created_at / 1000)) AS day, COUNT(*) AS orders, SUM(total) AS revenue
        FROM orders WHERE status NOT IN ('cancelled', 'returned') GROUP BY day`);
    },
  },
];

/** Apply pending migrations, once, even if several server processes start together. */
export async function runMigrations(pool: mysql.Pool) {
  const conn = await pool.getConnection();
  try {
    const [[lock]] = await conn.query<mysql.RowDataPacket[]>("SELECT GET_LOCK('store_migrations', 120) AS ok");
    if (Number(lock.ok) !== 1) throw new Error("Timed out waiting for another server to finish database migrations");
    await conn.query("CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY, name VARCHAR(100) NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
    const [done] = await conn.query<mysql.RowDataPacket[]>("SELECT version FROM schema_migrations");
    const applied = new Set(done.map((r) => Number(r.version)));
    for (const m of MIGRATIONS) {
      if (applied.has(m.version)) continue;
      await m.up(conn); // DDL auto-commits in MySQL, hence idempotent steps instead of a transaction
      await conn.query("INSERT INTO schema_migrations (version, name) VALUES (?, ?)", [m.version, m.name]);
      console.log(`[db] migration ${m.version} applied: ${m.name}`);
    }
  } finally {
    await conn.query("SELECT RELEASE_LOCK('store_migrations')").catch(() => {});
    conn.release();
  }
}
