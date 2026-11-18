"use client";
import { Download } from "lucide-react";

export default function PrintButton() {
  return <button onClick={() => window.print()} className="btn-primary"><Download className="size-4" />Download PDF</button>;
}
