import type { Metadata } from "next";
import DemoFrame from "@/components/demo/DemoFrame";
import DemoPageContent from "@/components/demo/DemoPageContent";
import type { DemoTab } from "@/components/demo/DemoWorkspaceTabs";

export const metadata: Metadata = {
  metadataBase: new URL("https://refreshqueue.com"),
  title: "Sample workspace — Sales Coach",
  description:
    "Read a fictional sales workspace with call transcripts, rubric scorecards, coaching notes, dashboards, deals, forecasts, and trackers. No signup.",
  alternates: { canonical: "/demo" },
};

export default async function DemoIndexPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const initialTab = (params?.tab as DemoTab) || "calls";

  return (
    <DemoFrame>
      <DemoPageContent initialTab={initialTab} />
    </DemoFrame>
  );
}
