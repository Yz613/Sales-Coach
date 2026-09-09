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
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-blue-600 selection:text-white" suppressHydrationWarning>
        <AuthProvider
          initialRole={auth.role}
          publishableKey={publishableKey}
          initialUser={
            auth.userId ? { id: auth.userId, email: auth.email, name: auth.name } : null
          }
        >
          <Navigation />
          <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
