import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RefreshQueue — Monday call queue for sales managers",
    template: "%s · RefreshQueue",
  },
  description:
    "Every Monday, the calls that leaked the most pipeline. RefreshQueue ranks folded conversations, tags the failure mode, and briefs the next fix. The coaching desk sits behind a login.",
  metadataBase: new URL("https://refreshqueue.com"),
  openGraph: {
    title: "RefreshQueue — Monday call queue for sales managers",
    description:
      "Ranked by the calls that actually folded — not talk-time percent, not a sentiment score, not a dashboard you forget to open.",
    url: "https://refreshqueue.com",
    siteName: "RefreshQueue",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
