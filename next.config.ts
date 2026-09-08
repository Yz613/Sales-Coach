import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  basePath: "/app",
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;

if (process.env.NODE_ENV === "development") {
  import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
}
