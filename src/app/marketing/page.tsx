import type { Metadata } from "next";
import MarketingLanding from "@/components/MarketingLanding";

export const metadata: Metadata = {
  metadataBase: new URL("https://refreshqueue.com"),
  title: "Sales Coach AI — Find missed opportunities on every call",
  description:
    "Open-source AI sales coaching and call evaluation. Transcribe calls, score them against stage-aware talk-tracks, and coach reps — self-host free or run hosted on refreshqueue.com.",
  alternates: { canonical: "/" },
};

export default function MarketingPage() {
  return <MarketingLanding />;
}
