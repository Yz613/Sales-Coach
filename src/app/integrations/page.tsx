import type { Metadata } from "next";
import IntegrationsMarketing from "@/components/IntegrationsMarketing";
import { PUBLIC_INTEGRATION_COUNT } from "@/lib/publicIntegrations";

export const metadata: Metadata = {
  metadataBase: new URL("https://refreshqueue.com"),
  title: "Integrations — Sales Coach",
  description: `${PUBLIC_INTEGRATION_COUNT} Sales Coach integrations for meetings, CRM, calendars, tasks, chat, and automation. Request one that is missing.`,
  alternates: { canonical: "/integrations" },
};

export default function IntegrationsPage() {
  return <IntegrationsMarketing />;
}
