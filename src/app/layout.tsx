import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import AuthProvider from "@/components/AuthProvider";
import { getServerAuth } from "@/lib/auth";
import { toAppPath } from "@/lib/public-path";

export const metadata: Metadata = {
  title: "Sales Coach AI — B2B Sales Management & Progression",
  description: "Executive AI Sales Manager for evaluating call blocking & tackling, Sandler qualification, and rep pipeline progression.",
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-[#070a12] text-slate-100 antialiased selection:bg-blue-600 selection:text-white relative overflow-x-hidden" suppressHydrationWarning>
        {/* Atmospheric ambient lighting for glass refraction */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent blur-[120px] rounded-full" />
          <div className="absolute top-1/3 -right-40 w-[600px] h-[500px] bg-indigo-900/10 blur-[140px] rounded-full" />
          <div className="absolute top-2/3 -left-40 w-[600px] h-[500px] bg-blue-900/10 blur-[140px] rounded-full" />
        </div>
        <AuthProvider initialRole={auth.role} publishableKey={publishableKey}>
          <Navigation />
          <main className="mx-auto max-w-[1600px] w-full px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
