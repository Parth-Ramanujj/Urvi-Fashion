import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { palette } from "@/lib/brand";
import { UPLOAD_DIR } from "@/lib/db";
import { getBrand } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

/** The brand's uploaded icon as a data URL (PNG/JPEG only — what the image renderer supports), else null. */
function uploadedIcon(src?: string) {
  const name = src?.match(/^\/api\/files\/([\w-]+\.(png|jpg))$/)?.[1];
  if (!name) return null;
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) return null;
  return `data:image/${name.endsWith("png") ? "png" : "jpeg"};base64,${fs.readFileSync(file).toString("base64")}`;
}

// URLs carry ?v=<iconVersion> (see manifest/layout), so the long cache is safe: a rebrand changes the URL.
// App icon / favicon for the current brand: the uploaded square icon, or the first letter of the store name on the brand colour.
export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (![32, 180, 192, 512].includes(size)) return new Response("Not found", { status: 404 });
  const b = getBrand();
  const p = palette(b.primary);
  const img = uploadedIcon(b.icon);
  return new ImageResponse(
    img ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={img} width={size} height={size} style={{ objectFit: "cover" }} alt="" />
    ) : (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${p[500]}, ${p[800]})` }}>
        <div style={{ display: "flex", alignItems: "baseline", color: "white", fontSize: size * 0.62, fontWeight: 800 }}>
          {(b.name.trim()[0] ?? "S").toUpperCase()}
          {b.wordmarkDot && <span style={{ color: p[200] }}>.</span>}
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
