// Inline-SVG charts — no dependencies, server-component friendly, themed via
// CSS variables so they follow light/dark mode. Colors are passed by the caller.

export type Segment = { label: string; value: number; color: string };

/** Horizontal labelled bars (severity/status distributions, assets by risk). */
export function BarsH({ items }: { items: Segment[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="chart-bars" role="img" aria-label="Bar chart">
      {items.map((it) => (
        <div key={it.label} className="chart-bar-row">
          <span className="chart-bar-label">{it.label}</span>
          <span className="chart-bar-track">
            <span className="chart-bar-fill" style={{ width: `${(it.value / max) * 100}%`, background: it.color }} />
          </span>
          <span className="chart-bar-val">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Donut chart with a centered label. */
export function Donut({
  segments, size = 148, thickness = 20, centerLabel, centerSub, ariaLabel, total: totalProp,
}: {
  segments: Segment[]; size?: number; thickness?: number; centerLabel?: string; centerSub?: string; ariaLabel?: string; total?: number;
}) {
  const total = totalProp ?? segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={ariaLabel ?? "Donut chart"} className="donut">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
      {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
        const dash = (s.value / total) * circ;
        const el = (
          <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        );
        offset += dash;
        return el;
      })}
      {centerLabel && <text x="50%" y="49%" textAnchor="middle" className="donut-center">{centerLabel}</text>}
      {centerSub && <text x="50%" y="63%" textAnchor="middle" className="donut-sub">{centerSub}</text>}
    </svg>
  );
}

/** Area/line chart for a time series (findings over time). */
export function AreaLine({
  points, height = 120, color = "var(--accent)", ariaLabel,
}: {
  points: { label: string; value: number }[]; height?: number; color?: string; ariaLabel?: string;
}) {
  const w = 320, pad = 8;
  const max = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;
  const step = n > 1 ? (w - 2 * pad) / (n - 1) : 0;
  const xy = (i: number, v: number): [number, number] => [pad + i * step, height - pad - (v / max) * (height - 2 * pad)];
  const line = points.map((p, i) => xy(i, p.value)).map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = n > 1 ? `${line} L${(pad + (n - 1) * step).toFixed(1)} ${height - pad} L${pad} ${height - pad} Z` : "";
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label={ariaLabel ?? "Time series"} className="arealine">
      {area && <path d={area} fill={color} opacity="0.15" />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => {
        const [x, y] = xy(i, p.value);
        return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />;
      })}
    </svg>
  );
}

/** Small legend row for donut/bar categories. */
export function Legend({ items }: { items: Segment[] }) {
  return (
    <ul className="chart-legend">
      {items.map((it) => (
        <li key={it.label}>
          <span className="chart-legend-dot" style={{ background: it.color }} />
          <span className="chart-legend-label">{it.label}</span>
          <span className="chart-legend-val">{it.value}</span>
        </li>
      ))}
    </ul>
  );
}
