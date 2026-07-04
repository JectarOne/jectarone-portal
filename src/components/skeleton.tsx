// Presentational loading skeletons (no client JS needed).

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** A grid of metric-card skeletons. */
export function MetricSkeletons({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-5" role="status" aria-label="Loading metrics">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sk-card">
          <Skeleton className="sk-line" style={{ width: "50%" }} />
          <Skeleton className="sk-metric" />
        </div>
      ))}
    </div>
  );
}

/** A card containing several full-width row skeletons (table/list placeholder). */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="sk-card" role="status" aria-label="Loading">
      <Skeleton className="sk-line" style={{ width: "30%", marginBottom: "1rem" }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="sk-row" />
      ))}
    </div>
  );
}

/** Standard page loading state: a title bar + a table skeleton. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <>
      <div className="topbar">
        <div>
          <Skeleton className="sk-line" style={{ width: "160px", height: "1.4rem" }} />
        </div>
      </div>
      <TableSkeleton rows={rows} />
    </>
  );
}
