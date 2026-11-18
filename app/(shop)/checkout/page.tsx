import { pageUser } from "@/lib/auth";
import Checkout from "./Checkout";

export const metadata = { title: "Checkout" };

export default async function Page() {
  const u = await pageUser("/checkout");
  return <Checkout addresses={u.addresses} />;
}
