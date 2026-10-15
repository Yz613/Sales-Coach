import { withWorkspacePage } from "@/lib/workspace";
import McpHub from "@/components/mcp/McpHub";

export const dynamic = "force-dynamic";

async function McpPage() {
  return <McpHub />;
}

export default withWorkspacePage(McpPage, { admin: false });
