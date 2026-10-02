import type { ProviderId } from "@/lib/revenue/types";
import { integrationTool } from "@/lib/integrations/catalog";
import { apiPath } from "@/lib/utils";
import { CalendarDays, MessageSquare, PhoneCall, ListTodo } from "lucide-react";

const EXTENSIONS: Partial<Record<ProviderId, string>> = { fathom: "png", fireflies: "png", tldv: "png", gong: "svg", close: "png", hubspot: "svg", pipedrive: "png", attio: "ico", zapier: "svg", make: "svg" };
export default function IntegrationLogo({ provider, large = false }: { provider: ProviderId; large?: boolean }) {
  const tool = integrationTool(provider)!; const extension = EXTENSIONS[provider];
  const Icon = tool.category === "Tasks" ? ListTodo : tool.category === "Notifications" ? MessageSquare : provider === "aircall" ? PhoneCall : CalendarDays;
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-2xl border border-black/[.04] ${large ? "h-16 w-16 p-3" : "h-12 w-12 p-2.5"}`} style={{ backgroundColor: `${tool.color}0c` }}>
    {extension ? <img src={apiPath(`/integrations/${provider}.${extension}`)} alt="" className="h-full w-full object-contain" /> : <Icon className="h-full w-full" color={tool.color} strokeWidth={1.8} />}
  </span>;
}
