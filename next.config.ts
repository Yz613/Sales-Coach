import type { NextConfig } from "next";

import path from "path";
import { APP_BASE_PATH } from "./src/lib/public-path";

// Publishable key must be present at build time so the client bundle and SSR
// tree both wrap the app in <ClerkProvider>. Falls back to the same public
// value already committed in wrangler.jsonc vars.
const clerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ||
  "pk_live_Y2xlcmsucmVmcmVzaHF1ZXVlLmNvbSQ";

const nextConfig: NextConfig = {
  basePath: "/app",
  env: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/app/sign-in",
    NEXT_PUBLIC_CLERK_SIGN_UP_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "/app/sign-up",
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL || "/app",
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL || "/app",
  },
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingRoot: path.resolve(__dirname),
  // Next middleware matchers are scoped to `basePath`, so apex /calls and
  // /favicon.ico never hit `src/middleware.ts`. Config redirects with
  // `basePath: false` run at the Next routing layer instead.
  async redirects() {
    return [
      {
        source: "/calls",
        destination: `${APP_BASE_PATH}/calls`,
        permanent: true,
        basePath: false,
      },
      {
        source: "/calls/:path*",
        destination: `${APP_BASE_PATH}/calls/:path*`,
        permanent: true,
        basePath: false,
      },
      {
        source: "/favicon.ico",
        destination: `${APP_BASE_PATH}/icon.svg`,
        permanent: true,
        basePath: false,
      },
      {
        source: "/icon.svg",
        destination: `${APP_BASE_PATH}/icon.svg`,
        permanent: true,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;

if (process.env.NODE_ENV === "development") {
  import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
}
