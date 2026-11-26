"use client";
import { useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Modal } from "@/components/ui";
import { bulkImportProducts } from "@/lib/admin-actions";
import { useAct } from "../_ui";

const TEMPLATE = `name,brand,category,subcategory,kind,fabric,mrp,price,sizes,colors,stock,description,image_url
Cotton Crew Tee,Urvi,men,T-Shirts,tee,Cotton,999,599,S|M|L|XL,Black:#1c1c1e|White:#f3f2ec,25,Soft breathable cotton tee,
Floral Midi Dress,Urvi,women,Dresses,dress,Viscose,2499,1499,XS|S|M|L,Rose:#d9828f|Navy:#1f2a44,15,Lightweight everyday midi dress,
`;

export default function BulkImport() {
  const [open, setOpen] = useState(false);
  const [errs, setErrs] = useState<string[]>([]);
  const { pending, act } = useAct();

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "products-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErrs([]);
    const text = await f.text();
    act(() => bulkImportProducts(text), undefined, (r) => {
      setErrs(r.errors);
      if (!r.errors.length) setOpen(false);
    });
  };

  return (
    <>
      <button onClick={() => { setErrs([]); setOpen(true); }} className="btn-ghost"><FileSpreadsheet className="size-4" />Bulk import CSV</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Bulk import products (CSV)">
        <div className="space-y-4 text-sm">
          <p className="text-zinc-600 dark:text-zinc-400">
            Upload a CSV file from Excel or Google Sheets to add hundreds of products at once.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadTemplate} className="btn-ghost"><Download className="size-4" />Download template</button>
            <label className={`btn-brand cursor-pointer ${pending ? "pointer-events-none opacity-50" : ""}`}>
              <Upload className="size-4" />{pending ? "Importing…" : "Upload CSV file"}
              <input type="file" accept=".csv,text/csv" hidden onChange={onFile} disabled={pending} />
            </label>
          </div>
          <p className="text-xs text-zinc-500">
            Columns: <code>name, brand, category</code> (men/women/kids/accessories/seasonal), <code>subcategory, kind, fabric, mrp, price, sizes</code> (e.g. <code>S|M|L</code>), <code>colors</code> (e.g. <code>Black:#1c1c1e|Red:#b0302f</code>), <code>stock, description, image_url</code>.
          </p>
          {errs.length > 0 && (
            <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              <p className="font-semibold">Some rows were skipped:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">{errs.map((er, i) => <li key={i}>{er}</li>)}</ul>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
