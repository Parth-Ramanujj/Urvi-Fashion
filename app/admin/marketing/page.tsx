import { db } from "@/lib/db";
import { flashActive } from "@/lib/pricing";
import { PageTitle } from "../_ui";
import { CampaignComposer, CouponManager, FlashSaleManager } from "./Marketing";

export default function MarketingPage() {
  const d = db();
  const now = Date.now();
  const products = d.products.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, brand: p.brand, image: p.colors[0].images[0], price: p.price, flash: flashActive(p, now) ? p.flashSale : null }));
  return (
    <div className="space-y-8">
      <PageTitle title="Marketing" />
      <CouponManager coupons={d.coupons} now={now} />
      <FlashSaleManager products={products} />
      <CampaignComposer campaigns={d.campaigns.slice(0, 20)} />
    </div>
  );
}
