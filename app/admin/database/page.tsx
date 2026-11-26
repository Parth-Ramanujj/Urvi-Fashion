import { AlertTriangle, CheckCircle2, Database, Download, GitBranch, Link2, ShieldCheck } from "lucide-react";
import { hasStrongSessionSecret } from "@/lib/auth";
import { RELATIONS } from "@/lib/db-schema";
import { dbStatus } from "@/lib/db";
import { getBrand } from "@/lib/server-utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Database" };

const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const when = (t: number) => new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="card p-5"><h2 className="mb-4 flex items-center gap-2 font-semibold">{icon}{title}</h2>{children}</section>;
}

export default async function DatabasePage() {
  const s = await dbStatus();
  const backup = (
    <a href="/admin/backup" className="btn-primary"><Download className="size-4" />Download full backup (JSON)</a>
  );

  if (s.mode === "file") {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-bold">Database</h1>
        <p className="flex gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"><AlertTriangle className="size-5 shrink-0" />Running on the JSON file (no <code>DATABASE_URL</code>). Fine for development and demos. Set <code>DATABASE_URL</code> to a MySQL database for production; this file is imported automatically on first start.</p>
        <Card title="Storage" icon={<Database className="size-5" />}>
          <p className="text-sm text-zinc-500">{s.file} · {size(s.bytes)}{s.savedAt ? ` · saved ${when(s.savedAt)}` : ""}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(s.memory).map(([t, n]) => <div key={t} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50"><p className="text-xs text-zinc-500">{t}</p><p className="font-semibold">{n}</p></div>)}</div>
          <div className="mt-4">{backup}</div>
        </Card>
      </div>
    );
  }

  const orphanTotal = s.orphans.reduce((n, o) => n + o.count, 0);
  const drift = s.tables.filter((t) => t.memory !== undefined && t.memory !== t.rows);
  const fkFor = (table: string, column: string) => s.foreignKeys.find((f) => f.child === table && f.col === column);
  const weakSecret = !hasStrongSessionSecret();
  const demoHints = getBrand().showDemoLogins;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl font-bold">Database</h1><p className="text-sm text-zinc-500">{s.server} · <b>{s.database}</b> on {s.host} as {s.user} · data version {s.dataVersion}</p></div>
        {backup}
      </div>

      {(weakSecret || demoHints) && (
        <div className="space-y-2">
          {weakSecret && <p className="flex gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"><AlertTriangle className="size-5 shrink-0" /><span><b>SESSION_SECRET</b> is missing or using a placeholder. Set a 16+ character random secret in your environment variables before going live.</span></p>}
          {demoHints && <p className="flex gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"><AlertTriangle className="size-5 shrink-0" /><span>Demo login hints are visible on the login page. Turn them off in <b>Admin → Branding → Demo mode</b> before launching.</span></p>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`card flex items-center gap-3 p-4 ${orphanTotal ? "border-red-300" : ""}`}>{orphanTotal ? <AlertTriangle className="size-6 text-red-600" /> : <CheckCircle2 className="size-6 text-emerald-600" />}<div><p className="font-semibold">{orphanTotal ? `${orphanTotal} orphan rows` : "Relationships intact"}</p><p className="text-xs text-zinc-500">{s.foreignKeys.length} foreign keys enforced by MySQL</p></div></div>
        <div className={`card flex items-center gap-3 p-4 ${drift.length ? "border-amber-300" : ""}`}>{drift.length ? <AlertTriangle className="size-6 text-amber-600" /> : <CheckCircle2 className="size-6 text-emerald-600" />}<div><p className="font-semibold">{drift.length ? "Refreshing from MySQL" : "App in sync with MySQL"}</p><p className="text-xs text-zinc-500">{drift.length ? `${drift.map((t) => t.name).join(", ")} changed — reload in a few seconds` : "Row counts match the app's copy"}</p></div></div>
        <div className={`card flex items-center gap-3 p-4 ${s.weakCredentials ? "border-amber-300" : ""}`}>{s.weakCredentials ? <AlertTriangle className="size-6 text-amber-600" /> : <ShieldCheck className="size-6 text-emerald-600" />}<div><p className="font-semibold">{s.weakCredentials ? "Weak database login" : "Dedicated database user"}</p><p className="text-xs text-zinc-500">{s.weakCredentials ? "Using root or no password: create a dedicated user for production" : `Connected as ${s.user}`}</p></div></div>
      </div>

      <Card title="Tables" icon={<Database className="size-5" />}>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500"><tr><th className="py-2">Table</th><th className="py-2 text-right">Rows</th><th className="py-2 text-right">Size</th></tr></thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">{s.tables.map((t) => <tr key={t.name}><td className="py-2 font-mono">{t.name}</td><td className="py-2 text-right tabular-nums">{t.rows.toLocaleString("en-IN")}</td><td className="py-2 text-right text-zinc-500">{size(t.bytes)}</td></tr>)}</tbody>
        </table></div>
        <p className="mt-3 text-xs text-zinc-500">Reporting views (query them in phpMyAdmin like tables):</p>
        <div className="mt-1 flex flex-wrap gap-1.5">{s.views.map((v) => <code key={v} className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">{v}</code>)}</div>
      </Card>

      <Card title="Relationships" icon={<Link2 className="size-5" />}>
        <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          {RELATIONS.map((r) => {
            const fk = fkFor(r.table, r.column);
            const o = s.orphans.find((x) => x.table === r.table && x.column === r.column);
            return (
              <li key={`${r.table}.${r.column}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span><b>{r.label}</b><span className="ml-2 font-mono text-xs text-zinc-500">{r.table}.{r.column} → {r.ref}.id</span></span>
                <span className="flex items-center gap-2 text-xs">
                  {fk ? <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">FK {fk.name}</span> : <span className="badge bg-amber-100 text-amber-700">no FK</span>}
                  {o && o.count > 0 && <span className="badge bg-red-100 text-red-700" title={o.sample.join(", ")}>{o.count} orphans</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-zinc-500">All relationships are ON DELETE RESTRICT: a customer, product or order that other records point at can&apos;t be deleted by accident.</p>
      </Card>

      <Card title="Schema migrations" icon={<GitBranch className="size-5" />}>
        <ul className="space-y-1 text-sm">{s.migrations.map((m) => <li key={m.version} className="flex justify-between gap-3"><span><span className="font-mono text-zinc-500">v{m.version}</span> {m.name}</span><span className="text-xs text-zinc-500">{when(m.appliedAt)}</span></li>)}</ul>
        <p className="mt-3 text-xs text-zinc-500">Applied automatically at startup (one server at a time); new versions upgrade existing databases in place.</p>
      </Card>

      <Card title="Backups" icon={<Download className="size-5" />}>
        <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <p><b>Daily (recommended):</b> <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">mysqldump --single-transaction -u USER -p {s.database} &gt; backup.sql</code>, plus a copy of the <code>uploads</code> folder.</p>
          <p><b>Quick:</b> the button above downloads everything as JSON. It contains password hashes and the login secret, so keep it private. To restore it, put the file at <code>DATA_DIR/db.json</code> and start the app on an empty database; it is imported automatically.</p>
        </div>
      </Card>
    </div>
  );
}
