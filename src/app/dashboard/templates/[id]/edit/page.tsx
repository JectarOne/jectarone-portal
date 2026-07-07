import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { updateTemplateAction } from "@/actions/templates";
import { TemplateForm } from "../../TemplateForm";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  if (!hasRole(session.role, "MEMBER")) redirect("/dashboard/templates");
  const { id } = await params;

  const t = await prisma.findingTemplate.findUnique({ where: { id } });
  // Only org-owned templates are editable; built-ins (organizationId null) are read-only.
  if (!t || t.organizationId !== session.orgId) notFound();

  const bound = updateTemplateAction.bind(null, id);

  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            <Link href="/dashboard/templates">Templates</Link> / Edit
          </p>
          <h1>Edit template</h1>
        </div>
      </div>
      <TemplateForm action={bound} values={t} submitLabel="Save changes" cancelHref="/dashboard/templates" />
    </>
  );
}
