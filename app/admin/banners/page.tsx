import { db } from "@/lib/db";
import { PageTitle } from "../_ui";
import BannerEditor from "./BannerEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Banners" };

export default function BannersPage() {
  return (
    <div>
      <PageTitle title="Hero banners"><p className="w-full text-sm text-zinc-500">The rotating banners at the top of the home page. Up to 8; inactive banners stay saved but hidden.</p></PageTitle>
      <BannerEditor initial={db().banners} />
    </div>
  );
}
