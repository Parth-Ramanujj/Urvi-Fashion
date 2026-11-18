import { getBrand } from "@/lib/server-utils";
import { PageTitle } from "../_ui";
import BrandForm from "./BrandForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Branding" };

export default function BrandingPage() {
  return (
    <div>
      <PageTitle title="Branding"><p className="w-full text-sm text-zinc-500">White-label the whole store: name, logo, app icon, colours, fonts, contact and invoice details.</p></PageTitle>
      <BrandForm initial={getBrand()} />
    </div>
  );
}
