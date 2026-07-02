import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { statusLabel, statusClass } from "@/lib/assessments";
import {
  updateAssessmentAction,
  setArchivedAction,
  deleteAssessmentAction,
} from "@/actions/assessments";
import { AssessmentForm } from "../AssessmentForm";

function toDateInput(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;

  const a = await prisma.assessment.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } } },
  });
  if (!a || a.organizationId !== session.orgId) notFound();

  const canDelete = hasRole(session.role, "ADMIN");
  const boundUpdate = updateAssessmentAction.bind(null, a.id);

  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            <Link href="/dashboard/assessments">Assessments</Link> / {a.clientName}
          </p>
          <h1 style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {a.clientName}
            <span className={`status-badge ${statusClass(a.status)}`}>{statusLabel(a.status)}</span>
            {a.archivedAt && <span className="status-badge status-draft">Archived</span>}
          </h1>
          <p className="muted" style={{ fontSize: "0.82rem" }}>
            Created by {a.createdBy?.name ?? "—"} · updated {new Date(a.updatedAt).toISOString().slice(0, 10)}
          </p>
        </div>
        <div className="form-actions" style={{ marginTop: 0 }}>
          <form action={setArchivedAction}>
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="archive" value={a.archivedAt ? "0" : "1"} />
            <button className="btn btn-secondary" type="submit">{a.archivedAt ? "Unarchive" : "Archive"}</button>
          </form>
          {canDelete && (
            <form action={deleteAssessmentAction}>
              <input type="hidden" name="id" value={a.id} />
              <button className="btn btn-danger" type="submit">Delete</button>
            </form>
          )}
        </div>
      </div>

      <AssessmentForm
        action={boundUpdate}
        submitLabel="Save changes"
        cancelHref="/dashboard/assessments"
        values={{
          clientName: a.clientName,
          type: a.type,
          status: a.status,
          scope: a.scope,
          startDate: toDateInput(a.startDate),
          endDate: toDateInput(a.endDate),
          leadConsultant: a.leadConsultant,
          executiveSummary: a.executiveSummary,
          notes: a.notes,
        }}
      />
    </>
  );
}
