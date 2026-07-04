import { MetricSkeletons, TableSkeleton, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <div className="topbar">
        <div><Skeleton className="sk-line" style={{ width: "160px", height: "1.4rem" }} /></div>
      </div>
      <MetricSkeletons count={5} />
      <div style={{ height: "0.9rem" }} />
      <MetricSkeletons count={5} />
      <div className="grid grid-2" style={{ marginTop: "1rem" }}>
        <TableSkeleton rows={5} />
        <TableSkeleton rows={5} />
      </div>
    </>
  );
}
