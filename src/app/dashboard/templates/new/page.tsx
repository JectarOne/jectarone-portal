import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { createTemplateAction } from "@/actions/templates";
import { TemplateForm } from "../TemplateForm";

export default async function NewTemplatePage() {
  const session = await getSession();
  if (!session) return null;
  if (!hasRole(session.role, "MEMBER")) redirect("/dashboard/templates");

  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            <Link href="/dashboard/templates">Templates</Link> / New
          </p>
          <h1>New template</h1>
        </div>
      </div>
      <TemplateForm action={createTemplateAction} submitLabel="Create template" cancelHref="/dashboard/templates" />
    </>
  );
}
