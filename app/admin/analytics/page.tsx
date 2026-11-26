import { db } from "@/lib/db";
import { PageTitle } from "../_ui";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  const d = db();
  const events = d.analytics ?? [];
  const orders = d.orders.map((o) => ({
    id: o.id,
    status: o.status,
    total: o.totals.total,
    createdAt: o.createdAt,
    userId: o.userId,
  }));

  return (
    <div className="space-y-6">
      <PageTitle title="Live Analytics">
        <p className="w-full text-sm text-zinc-500">Track every user action from login and browsing to bag, checkout, orders, and returns.</p>
      </PageTitle>
      <AnalyticsClient events={events} orders={orders} />
    </div>
  );
}
