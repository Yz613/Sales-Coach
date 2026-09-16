import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import SiteChrome from "@/components/SiteChrome";
import { getServerAuth } from "@/lib/auth";
import { toAppPath } from "@/lib/public-path";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Sales Coach AI — B2B Sales Management & Progression",
    template: "%s",
  },
  description: SITE_DESCRIPTION,
  robots: { index: false, follow: true },
  icons: {
    icon: [{ url: toAppPath("/icon.svg"), type: "image/svg+xml" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const auth = await getServerAuth();
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

  return (
    <html lang="en" className="dark scroll-smooth" suppressHydrationWarning>
      <body className="min-h-screen bg-[#070a12] text-slate-100 antialiased selection:bg-blue-600 selection:text-white relative overflow-x-hidden" suppressHydrationWarning>
        {/* Atmospheric ambient lighting for glass refraction */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent blur-[120px] rounded-full" />
          <div className="absolute top-1/3 -right-40 w-[600px] h-[500px] bg-indigo-900/10 blur-[140px] rounded-full" />
          <div className="absolute top-2/3 -left-40 w-[600px] h-[500px] bg-blue-900/10 blur-[140px] rounded-full" />
        </div>
        <AuthProvider
          initialRole={auth.role}
          publishableKey={publishableKey}
          initialUser={
            auth.userId ? { id: auth.userId, email: auth.email, name: auth.name } : null
          }
        >
          <SiteChrome>{children}</SiteChrome>
        </AuthProvider>
      </body>
    </html>
  );
}
