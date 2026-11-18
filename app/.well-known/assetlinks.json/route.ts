import { getBrand } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

// Digital Asset Links: tells Android that the APK built from this site (PWABuilder/Bubblewrap TWA) belongs to it,
// so the app opens full-screen instead of falling back to a browser bar with the URL. Set in Admin → Branding.
export function GET() {
  const { packageName, sha256 } = getBrand().android ?? { packageName: "", sha256: [] };
  const body = packageName && sha256.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: sha256 } }]
    : [];
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=300" } });
}
