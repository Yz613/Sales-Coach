import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Sales Coach AI — B2B Sales Management & Progression",
  description: "Executive AI Sales Manager for evaluating call blocking & tackling, Sandler qualification, and rep pipeline progression.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#2563eb",
              colorBackground: "#0f172a",
              colorInputBackground: "#020617",
              colorInputText: "#f8fafc",
              colorText: "#e2e8f0",
              colorTextSecondary: "#94a3b8",
              colorNeutral: "#64748b",
              borderRadius: "0.5rem",
            },
          }}
        >
          <Navigation />
          <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </ClerkProvider>
      </body>
    </html>
  );
}