import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { createEngagementAction } from "@/actions/engagements";
import { EngagementForm } from "../EngagementForm";

export default async function NewEngagementPage() {
  const session = await getSession();
  if (!session) return null;
  if (!hasRole(session.role, "MEMBER")) redirect("/dashboard/engagements");

  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            <Link href="/dashboard/engagements">Engagements</Link> / New
          </p>
          <h1>New engagement</h1>
        </div>
      </div>
      <EngagementForm action={createEngagementAction} submitLabel="Create engagement" cancelHref="/dashboard/engagements" />
    </>
  );
}
