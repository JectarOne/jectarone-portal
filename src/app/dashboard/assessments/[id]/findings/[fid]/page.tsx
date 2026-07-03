import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { label } from "@/lib/findings";
import { SeverityBadge, FindingStatusBadge, RiskMatrix } from "@/components/findings-ui";
import { updateFindingAction, setFindingArchivedAction, deleteFindingAction } from "@/actions/findings";
import { addEvidenceAction, deleteEvidenceAction } from "@/actions/evidence";
import { FindingForm } from "../FindingForm";
import { EvidenceForm } from "./EvidenceForm";

function fmtBytes(n: number | null): string {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default async function FindingDetailPage({
  params,
}: {
  params: Promise<{ id: string; fid: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { id, fid } = await params;

  const f = await prisma.finding.findUnique({
    where: { id: fid },
    include: {
      createdBy: { select: { name: true } },
      evidence: { orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
    },
  });
  if (!f || f.organizationId !== session.orgId || f.assessmentId !== id) notFound();

  const assets = await prisma.asset.findMany({
    where: { organizationId: session.orgId, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const canDelete = hasRole(session.role, "ADMIN");
  const boundUpdate = updateFindingAction.bind(null, f.id);
  const boundAddEvidence = addEvidenceAction.bind(null, f.id);

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
            {f.archivedAt && <span className="badge fstatus-archived">Archived</span>}
          </h1>
          <p className="muted" style={{ fontSize: "0.82rem" }}>
            Created by {f.createdBy?.name ?? "—"} · updated {new Date(f.updatedAt).toISOString().slice(0, 10)}
          </p>
        </div>
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
      </div>

      <div className="grid grid-2-1">
        <div className="card">
          <h3 className="sub">Risk</h3>
          <RiskMatrix likelihood={f.likelihood} impact={f.impact} />
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.6rem" }}>
            Likelihood {label(f.likelihood)} × Impact {label(f.impact)}
          </p>
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

      {/* Evidence */}
      <div className="section-head"><h2>Evidence <span className="count">{f.evidence.length}</span></h2></div>
      <div className="card">
        {f.evidence.length > 0 && (
          <table className="table">
            <thead><tr><th>File</th><th>Type</th><th>Size</th><th>Added by</th><th></th></tr></thead>
            <tbody>
              {f.evidence.map((ev) => (
                <tr key={ev.id}>
                  <td><strong>{ev.filename}</strong>{ev.note && <div className="muted" style={{ fontSize: "0.78rem" }}>{ev.note}</div>}</td>
                  <td className="muted">{ev.mimeType}</td>
                  <td className="muted">{fmtBytes(ev.sizeBytes)}</td>
                  <td className="muted">{ev.uploadedBy?.name ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <form action={deleteEvidenceAction}>
                      <input type="hidden" name="id" value={ev.id} />
                      <button className="btn btn-danger" type="submit" style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}>Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: f.evidence.length ? "1rem" : 0 }}>
          <EvidenceForm action={boundAddEvidence} />
        </div>
      </div>

      {/* Edit */}
      <div className="section-head"><h2>Edit finding</h2></div>
      <FindingForm
        action={boundUpdate}
        submitLabel="Save changes"
        cancelHref={`/dashboard/assessments/${id}`}
        values={{
          title: f.title, description: f.description, technicalDetails: f.technicalDetails,
          businessImpact: f.businessImpact, remediation: f.remediation, verificationSteps: f.verificationSteps,
          severity: f.severity, likelihood: f.likelihood, impact: f.impact, status: f.status,
          cvssScore: f.cvssScore, cvssVector: f.cvssVector, cwe: f.cwe,
          owaspCategory: f.owaspCategory, mitreTechnique: f.mitreTechnique,
          affectedAsset: f.affectedAsset, affectedAssetType: f.affectedAssetType, assetId: f.assetId,
        }}
        assets={assets}
      />
    </>
  );
}
