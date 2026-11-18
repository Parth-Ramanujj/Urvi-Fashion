import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // review photos + product image uploads go through server actions
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
