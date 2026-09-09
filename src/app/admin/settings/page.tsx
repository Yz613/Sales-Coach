import { requireAdmin } from "@/lib/auth";
import AdminSettingsForm from "@/components/AdminSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  return <AdminSettingsForm />;
}
