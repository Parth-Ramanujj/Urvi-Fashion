"use client";
import { useApp } from "@/components/Providers";

export default function CopyButton({ text, children }: { text: string; children: React.ReactNode }) {
  const { toast } = useApp();
  return <button onClick={() => navigator.clipboard.writeText(text).then(() => toast("Copied"), () => toast("Couldn't copy", "err"))} className="btn-ghost px-3 py-2" aria-label="Copy order reference">{children}</button>;
}
