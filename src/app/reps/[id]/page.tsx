import { withWorkspacePage } from "@/lib/workspace";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getRepById } from "@/lib/db/service";
import RepDetailClient from "./RepDetailClient";

export const dynamic = "force-dynamic";

async function RepDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const data = await getRepById(id);
  if (!data.rep) notFound();

  return (
    <RepDetailClient
      params={params}
      initial={{
        rep: data.rep,
        calls: data.calls,
        snapshot: data.snapshot,
        talkTrack: data.talkTrack,
      }}
    />
  );
}

export default withWorkspacePage(RepDetailPage, { admin: true });
