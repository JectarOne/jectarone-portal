// Vertical activity timeline. Presentational; server-component friendly.

export type TimelineItem = { action: string; detail?: string | null; user?: string | null; when: string; href?: string };

function human(action: string): string {
  const map: Record<string, string> = {
    "finding.created": "Finding created",
    "finding.edited": "Finding edited",
    "finding.status_changed": "Status changed",
    "finding.severity_changed": "Severity changed",
    "finding.assigned": "Finding assigned",
    "finding.archived": "Finding archived",
    "finding.deleted": "Finding deleted",
    "finding.risk_accepted": "Risk accepted",
    "comment.added": "Comment added",
    "evidence.added": "Evidence added",
    "evidence.deleted": "Evidence deleted",
    "evidence.downloaded": "Evidence downloaded",
    "report.generated": "Report generated",
    "security.password_changed": "Password changed",
    "security.session_revoked": "Session revoked",
    "security.sessions_revoked_all": "All other sessions revoked",
    "org.renamed": "Organization renamed",
    "apitoken.created": "API token created",
    "apitoken.revoked": "API token revoked",
  };
  return map[action] ?? action;
}

function dotClass(action: string): string {
  if (action.includes("created") || action.includes("added")) return "t-create";
  if (action.includes("resolved") || action.includes("verified")) return "t-resolve";
  if (action.includes("deleted") || action.includes("archived")) return "t-remove";
  if (action.includes("status") || action.includes("severity")) return "t-change";
  if (action.includes("comment")) return "t-comment";
  return "t-default";
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <div className="empty">No activity yet.</div>;
  return (
    <ol className="timeline">
      {items.map((it, i) => (
        <li key={i} className="timeline-item">
          <span className={`timeline-dot ${dotClass(it.action)}`} aria-hidden="true" />
          <div className="timeline-body">
            <span className="timeline-action">{human(it.action)}</span>
            {it.detail && <span className="timeline-detail"> — {it.detail}</span>}
            <div className="timeline-meta">{it.user ?? "system"} · {it.when}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
