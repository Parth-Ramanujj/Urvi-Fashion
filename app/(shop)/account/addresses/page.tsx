import { pageUser } from "@/lib/auth";
import Addresses from "./Addresses";

export const metadata = { title: "Saved addresses" };

export default async function Page() {
  const u = await pageUser("/account/addresses");
  return <Addresses addresses={u.addresses} />;
}
