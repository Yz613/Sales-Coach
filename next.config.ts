import type { NextConfig } from "next";

import path from "path";
import { APP_BASE_PATH } from "./src/lib/public-path";

// If the publishable key is available at build time, inline it. Do not inline an
// empty string — that would override the Cloudflare runtime var/secret and disable Clerk.
const clerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || "";

const nextConfig: NextConfig = {
  basePath: "/app",
  env: {
    ...(clerkPublishableKey
      ? { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey }
      : {}),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/app/sign-in",
    NEXT_PUBLIC_CLERK_SIGN_UP_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "/app/sign-up",
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL || "/app",
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL || "/app",
    NEXT_PUBLIC_CLERK_PROXY_URL: process.env.NEXT_PUBLIC_CLERK_PROXY_URL || "/app/__auth",
    NEXT_PUBLIC_CLERK_JS_URL:
      process.env.NEXT_PUBLIC_CLERK_JS_URL || "/app/__auth/npm/@clerk/clerk-js@6/dist/sdk.js",
    NEXT_PUBLIC_CLERK_UI_URL:
      process.env.NEXT_PUBLIC_CLERK_UI_URL || "/app/__auth/npm/@clerk/ui@1/dist/ui.js",
    NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED: "true",
  },
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingRoot: path.resolve(__dirname),
  // Next middleware matchers are scoped to `basePath`, so apex `/`, /pricing,
  // /calls, and /favicon.ico never hit `src/middleware.ts`. Config redirects
  // with `basePath: false` run at the Next routing layer instead.
  // Next cannot internally rewrite `/` onto `/app/*` (invalid-external-rewrite),
  // so local `next dev` / `next start` 307 to `/app/marketing`. The Cloudflare
  // worker still internally rewrites GET / so production apex URL stays `/`.
  async redirects() {
    return [
      {
        source: "/",
        destination: `${APP_BASE_PATH}/marketing`,
        permanent: false,
        basePath: false,
      },
      {
        source: "/pricing",
        destination: "/#pricing",
        permanent: true,
        basePath: false,
      },
      {
        source: "/__auth",
        destination: `${APP_BASE_PATH}/__auth`,
        permanent: false,
        basePath: false,
      },
      {
        source: "/__auth/:path*",
        destination: `${APP_BASE_PATH}/__auth/:path*`,
        permanent: false,
        basePath: false,
      },
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
