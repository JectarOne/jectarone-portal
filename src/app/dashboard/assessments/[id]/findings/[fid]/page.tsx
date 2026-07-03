import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { label, FINDING_STATUSES, isClosed } from "@/lib/findings";
import { isOverdue, daysUntilDue } from "@/lib/sla";
import { renderMarkdown } from "@/lib/markdown";
import { storageConfigured, presignDownload } from "@/lib/storage";
import { SeverityBadge, FindingStatusBadge, RiskMatrix } from "@/components/findings-ui";
import {
  updateFindingAction, setFindingArchivedAction, deleteFindingAction,
  changeStatusAction, assignFindingAction, setDueDateAction, acceptRiskAction,
} from "@/actions/findings";
import { addEvidenceAction, deleteEvidenceAction } from "@/actions/evidence";
import { addCommentAction, editCommentAction } from "@/actions/comments";
import { FindingForm } from "../FindingForm";
import { EvidenceForm } from "./EvidenceForm";
import { EvidenceUploader } from "./EvidenceUploader";
import { CommentForm } from "./CommentForm";
import { CommentItem } from "./CommentItem";
import { AcceptRiskForm } from "./AcceptRiskForm";

function fmtBytes(n: number | null): string {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function dt(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "—";
}
function dateInput(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export default async function FindingDetailPage({ params }: { params: Promise<{ id: string; fid: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { id, fid } = await params;

  const f = await prisma.finding.findUnique({
    where: { id: fid },
    include: {
      createdBy: { select: { name: true } },
      assignee: { select: { name: true } },
      acceptedRiskBy: { select: { name: true } },
      evidence: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
    },
  });
  if (!f || f.organizationId !== session.orgId || f.assessmentId !== id) notFound();

  const [assets, members, comments, timeline] = await Promise.all([
    prisma.asset.findMany({ where: { organizationId: session.orgId, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.membership.findMany({ where: { organizationId: session.orgId }, include: { user: { select: { id: true, name: true } } } }),
    prisma.findingComment.findMany({ where: { findingId: fid, deletedAt: null }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } }),
    prisma.activityLog.findMany({ where: { organizationId: session.orgId, findingId: fid }, orderBy: { createdAt: "asc" }, include: { user: { select: { name: true } } } }),
  ]);

  const canWrite = hasRole(session.role, "MEMBER");
  const canDelete = hasRole(session.role, "ADMIN");

  // Presigned image previews (short-lived) when storage is configured.
  const storeOn = storageConfigured();
  const previews: Record<string, string> = {};
  if (storeOn) {
    for (const ev of f.evidence) {
      if (ev.storageKey && ev.mimeType.startsWith("image/")) {
        previews[ev.id] = await presignDownload(ev.storageKey);
      }
    }
  }
  const overdue = isOverdue(f.dueDate, f.status);
  const dLeft = daysUntilDue(f.dueDate);

  const boundUpdate = updateFindingAction.bind(null, f.id);
  const boundAddEvidence = addEvidenceAction.bind(null, f.id);
  const boundStatus = changeStatusAction.bind(null, f.id);
  const boundAssign = assignFindingAction.bind(null, f.id);
  const boundDue = setDueDateAction.bind(null, f.id);
  const boundAccept = acceptRiskAction.bind(null, f.id);
  const boundAddComment = addCommentAction.bind(null, f.id);

  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            <Link href="/dashboard/assessments">Assessments</Link> /{" "}
            <Link href={`/dashboard/assessments/${id}`}>Assessment</Link> / Finding
          </p>
          <h1 style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            {f.title}
            <SeverityBadge severity={f.severity} />
            <FindingStatusBadge status={f.status} />
            {overdue && <span className="badge risk-critical">Overdue</span>}
            {f.archivedAt && <span className="badge fstatus-archived">Archived</span>}
          </h1>
          <p className="muted" style={{ fontSize: "0.82rem" }}>
            Created by {f.createdBy?.name ?? "—"} · updated {dateInput(f.updatedAt)}
          </p>
        </div>
        {canWrite && (
          <div className="form-actions" style={{ marginTop: 0 }}>
            <form action={setFindingArchivedAction}>
              <input type="hidden" name="id" value={f.id} />
              <input type="hidden" name="archive" value={f.archivedAt ? "0" : "1"} />
              <button className="btn btn-secondary" type="submit">{f.archivedAt ? "Restore" : "Archive"}</button>
            </form>
            {canDelete && (
              <form action={deleteFindingAction}>
                <input type="hidden" name="id" value={f.id} />
                <button className="btn btn-danger" type="submit">Delete</button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Workflow: status / assignee / SLA */}
      <div className="grid grid-3">
        <div className="card">
          <h3 className="sub">Status</h3>
          {canWrite ? (
            <form action={boundStatus} className="inline-form">
              <select name="status" defaultValue={FINDING_STATUSES.includes(f.status as never) ? f.status : "Open"}>
                {FINDING_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </select>
              <button className="btn btn-secondary" type="submit">Update</button>
            </form>
          ) : <FindingStatusBadge status={f.status} />}
        </div>
        <div className="card">
          <h3 className="sub">Assignee</h3>
          {canWrite ? (
            <form action={boundAssign} className="inline-form">
              <select name="assigneeId" defaultValue={f.assigneeId ?? ""}>
                <option value="">— Unassigned —</option>
                {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
              </select>
              <button className="btn btn-secondary" type="submit">Assign</button>
            </form>
          ) : <p>{f.assignee?.name ?? "Unassigned"}</p>}
        </div>
        <div className="card">
          <h3 className="sub">Due date {overdue && <span className="badge risk-critical">Overdue</span>}</h3>
          {canWrite ? (
            <form action={boundDue} className="inline-form">
              <input type="date" name="dueDate" defaultValue={dateInput(f.dueDate)} />
              <button className="btn btn-secondary" type="submit">Set</button>
            </form>
          ) : <p>{dateInput(f.dueDate) || "—"}</p>}
          <p className="muted" style={{ fontSize: "0.78rem", marginTop: "0.4rem" }}>
            {f.dueDate ? (isClosed(f.status) ? "Closed" : dLeft !== null ? (dLeft < 0 ? `${-dLeft} day(s) overdue` : `${dLeft} day(s) left`) : "") : "No SLA (set by severity)"}
            {f.slaOverridden ? " · manual" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-2-1">
        <div className="card">
          <h3 className="sub">Risk</h3>
          <RiskMatrix likelihood={f.likelihood} impact={f.impact} />
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.6rem" }}>Likelihood {label(f.likelihood)} × Impact {label(f.impact)}</p>
        </div>
        <div className="card">
          <h3 className="sub">Classification</h3>
          <dl className="kv">
            <dt>CVSS</dt><dd>{f.cvssScore ?? "—"}{f.cvssVector ? ` · ${f.cvssVector}` : ""}</dd>
            <dt>OWASP</dt><dd>{f.owaspCategory ?? "—"}</dd>
            <dt>CWE</dt><dd>{f.cwe ?? "—"}</dd>
            <dt>MITRE</dt><dd>{f.mitreTechnique ?? "—"}</dd>
            <dt>Asset</dt><dd>{f.affectedAsset ?? "—"}{f.affectedAssetType ? ` (${label(f.affectedAssetType)})` : ""}</dd>
          </dl>
        </div>
      </div>

      {/* Risk acceptance */}
      <div className="section-head"><h2>Risk acceptance</h2></div>
      <div className="card">
        {f.status === "AcceptedRisk" ? (
          <>
            <dl className="kv">
              <dt>Accepted by</dt><dd>{f.acceptedRiskBy?.name ?? "—"}</dd>
              <dt>When</dt><dd>{dt(f.acceptedRiskAt)}</dd>
              <dt>Expires</dt><dd>{dateInput(f.acceptedRiskUntil) || "No expiry"}</dd>
              <dt>Justification</dt><dd>{f.acceptedRiskReason ?? "—"}</dd>
            </dl>
            {canWrite && (
              <form action={boundStatus} style={{ marginTop: "0.8rem" }}>
                <input type="hidden" name="status" value="Open" />
                <button className="btn btn-secondary" type="submit">Reopen</button>
              </form>
            )}
          </>
        ) : canWrite ? (
          <AcceptRiskForm action={boundAccept} />
        ) : <p className="muted">This finding is not currently an accepted risk.</p>}
      </div>

      {/* Evidence */}
      <div className="section-head"><h2>Evidence <span className="count">{f.evidence.length}</span></h2></div>
      <div className="card">
        {f.evidence.length > 0 && (
          <table className="table">
            <thead><tr><th>File</th><th>Type</th><th>Size</th><th>Added by</th><th></th></tr></thead>
            <tbody>
              {f.evidence.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- presigned, short-lived external S3 URL; next/image is impractical here */}
                      {previews[ev.id] && <img className="evidence-thumb" src={previews[ev.id]} alt={ev.filename} />}
                      <div>
                        <strong>{ev.filename}</strong>
                        {ev.note && <div className="muted" style={{ fontSize: "0.78rem" }}>{ev.note}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="muted">{ev.mimeType}</td>
                  <td className="muted">{fmtBytes(ev.sizeBytes)}</td>
                  <td className="muted">{ev.uploadedBy?.name ?? "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {ev.storageKey && (
                      <a className="btn btn-secondary" href={`/api/v1/evidence/${ev.id}`} target="_blank" rel="noopener noreferrer" style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem", marginRight: canWrite ? "0.4rem" : 0 }}>Download</a>
                    )}
                    {canWrite && (
                      <form action={deleteEvidenceAction} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={ev.id} />
                        <button className="btn btn-danger" type="submit" style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}>Remove</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canWrite && (
          <div style={{ marginTop: f.evidence.length ? "1rem" : 0 }}>
            {storeOn
              ? <EvidenceUploader findingId={f.id} />
              : <>
                  <EvidenceForm action={boundAddEvidence} />
                  <p className="muted" style={{ fontSize: "0.76rem", marginTop: "0.4rem" }}>
                    File storage is not configured — recording metadata only. Set S3 env vars to enable real uploads.
                  </p>
                </>}
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="section-head"><h2>Comments <span className="count">{comments.length}</span></h2></div>
      <div className="card">
        {comments.length === 0 && <p className="muted" style={{ marginBottom: canWrite ? "1rem" : 0 }}>No comments yet.</p>}
        {comments.map((c) => (
          <CommentItem
            key={c.id}
            id={c.id}
            authorName={c.author?.name ?? "Unknown"}
            when={dt(c.createdAt)}
            edited={!!c.editedAt}
            html={renderMarkdown(c.body)}
            raw={c.body}
            canModify={c.authorId === session.userId || canDelete}
            editAction={editCommentAction.bind(null, c.id)}
          />
        ))}
        {canWrite && <div style={{ marginTop: comments.length ? "1rem" : 0 }}><CommentForm action={boundAddComment} /></div>}
      </div>

      {/* Timeline */}
      <div className="section-head"><h2>Timeline</h2></div>
      <div className="card">
        {timeline.length === 0 ? <div className="empty">No events yet.</div> : (
          <ul className="activity">
            {timeline.map((ev) => (
              <li key={ev.id}>
                <span className="act-action">{ev.action}</span>
                {ev.detail && <span className="act-detail"> — {ev.detail}</span>}
                <span className="act-meta">{ev.user?.name ?? "system"} · {dt(ev.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Edit */}
      {canWrite && (
        <>
          <div className="section-head"><h2>Edit finding</h2></div>
          <FindingForm
            action={boundUpdate}
            submitLabel="Save changes"
            cancelHref={`/dashboard/assessments/${id}`}
            values={{
              title: f.title, description: f.description, technicalDetails: f.technicalDetails,
              businessImpact: f.businessImpact, remediation: f.remediation, verificationSteps: f.verificationSteps,
              severity: f.severity, likelihood: f.likelihood, impact: f.impact,
              cvssScore: f.cvssScore, cvssVector: f.cvssVector, cwe: f.cwe,
              owaspCategory: f.owaspCategory, mitreTechnique: f.mitreTechnique,
              affectedAsset: f.affectedAsset, affectedAssetType: f.affectedAssetType, assetId: f.assetId,
            }}
            assets={assets}
          />
        </>
      )}
    </>
  );
}
