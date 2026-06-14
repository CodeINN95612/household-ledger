interface SparklineBadgeProps {
  values: number[];
  /** Highlight the last 3 points in a warning color */
  creep?: boolean;
  width?: number;
  height?: number;
}

/** Inline SVG sparkline for trend data. Zero-dependency, CSS-only colors. */
export function SparklineBadge({ values, creep = false, width = 72, height = 28 }: SparklineBadgeProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return [x, y] as [number, number];
  });

  // Split into normal and creep (last 3) segments
  const splitAt = creep ? Math.max(0, values.length - 3) : values.length;
  const normalPoints = points.slice(0, splitAt + 1);
  const creepPoints = creep ? points.slice(splitAt) : [];

  function toPolyline(pts: [number, number][]): string {
    return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="inline-block align-middle"
    >
      {normalPoints.length >= 2 && (
        <polyline
          points={toPolyline(normalPoints)}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted"
        />
      )}
      {creepPoints.length >= 2 && (
        <polyline
          points={toPolyline(creepPoints)}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-owes"
        />
      )}
      {/* Last point dot */}
      {points.length > 0 && (() => {
        const [lx, ly] = points[points.length - 1];
        return (
          <circle
            cx={lx}
            cy={ly}
            r="2"
            className={creep ? "fill-owes" : "fill-muted"}
          />
        );
      })()}
    </svg>
  );
}
