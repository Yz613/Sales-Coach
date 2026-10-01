import type { Metadata } from "next";
import MarketingLanding from "@/components/MarketingLanding";

export const metadata: Metadata = {
  metadataBase: new URL("https://refreshqueue.com"),
  title: "Sales Coach — Open-source Gong alternative",
  description:
    "Open-source sales coaching and conversation intelligence. Search calls, save clips, import HubSpot and Fathom, and score stage talk-tracks. Run locally with your own model keys, or use a hosted plan.",
  alternates: { canonical: "/" },
};

export default function MarketingPage() {
  return <MarketingLanding />;
}
