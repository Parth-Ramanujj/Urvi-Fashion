import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Support from "./Support";

export const metadata = { title: "Help & support" };

export default async function Page() {
  const u = await pageUser("/account/support");
  const tickets = db().tickets.filter((t) => t.userId === u.id).sort((a, b) => b.createdAt - a.createdAt);
  const refs = db().orders.filter((o) => o.userId === u.id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 10).map((o) => o.ref);
  return <Support tickets={tickets} orderRefs={refs} />;
}
