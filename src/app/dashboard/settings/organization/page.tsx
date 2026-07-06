import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { OrgForm } from "./OrgForm";

export default async function OrgSettingsPage() {
  const session = await getSession();
  if (!session) return null;
  return <OrgForm name={session.organization.name} slug={session.organization.slug} canEdit={hasRole(session.role, "ADMIN")} />;
}
