import type { ProviderId } from "@/lib/revenue/types";
import { integrationTool } from "@/lib/integrations/catalog";
import { apiPath } from "@/lib/utils";
import { INTEGRATION_LOGOS } from "@/lib/integrations/logos";
export default function IntegrationLogo({ provider, large = false }: { provider: ProviderId; large?: boolean }) {
  const tool = integrationTool(provider)!;
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-2xl border border-black/[.04] ${large ? "h-16 w-16 p-3" : "h-12 w-12 p-2.5"}`} style={{ backgroundColor: `${tool.color}0c` }}>
    <img src={apiPath(`/integrations/${INTEGRATION_LOGOS[provider]}`)} alt="" className="h-full w-full object-contain" />
  </span>;
}
