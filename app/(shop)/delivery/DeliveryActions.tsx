"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCircle2, Truck } from "lucide-react";
import { useApp } from "@/components/Providers";
import { deliveryUpdate } from "@/lib/admin-actions";

export default function DeliveryActions({ id, status, cod }: { id: string; status: string; cod: boolean }) {
  const { toast } = useApp();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = status === "shipped" ? "out_for_delivery" : "delivered";
  const go = () => {
    if (next === "delivered" && !confirm(cod ? "Confirm cash collected and package handed over?" : "Confirm package handed over?")) return;
    start(async () => {
      const r = await deliveryUpdate(id, next);
      if (!r.ok) return toast(r.error, "err");
      toast(next === "delivered" ? "Marked delivered" : "Customer notified — you're on the way");
      router.refresh();
    });
  };
  return (
    <button disabled={pending} onClick={go} className={`mt-3 w-full ${next === "delivered" ? "btn-brand" : "btn-primary"}`}>
      {next === "delivered" ? <><CheckCircle2 className="size-4" />Mark delivered{cod && " · cash collected"}</> : <><Truck className="size-4" />Start — out for delivery</>}
    </button>
  );
}
