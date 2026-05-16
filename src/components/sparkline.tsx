export function Sparkline({
  values,
  width = 560,
  height = 120,
  ticks = 4,
}: {
  values: number[];
  width?: number;
  height?: number;
  ticks?: number;
}) {
  if (values.length === 0) return null;
  const pad = { top: 14, right: 24, bottom: 22, left: 0 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const step = innerW / Math.max(values.length - 1, 1);

  const points = values.map((v, i) => {
    const x = pad.left + i * step;
    const y = pad.top + innerH - ((v - min) / range) * innerH;
    return { x, y, v };
  });

  const path = points
    .map((p, i, arr) => {
      if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      const prev = arr[i - 1];
      const cpx = (prev.x + p.x) / 2;
      return ` Q ${cpx.toFixed(1)} ${prev.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    })
    .join("");

  const areaPath = `${path} L ${points[points.length - 1].x.toFixed(1)} ${(pad.top + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(pad.top + innerH).toFixed(1)} Z`;
  const tickValues = Array.from({ length: ticks }, (_, i) => min + (range * i) / (ticks - 1));

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
      aria-hidden
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {tickValues.map((_, i) => {
        const y = pad.top + innerH - (i / (ticks - 1)) * innerH;
        return (
          <line
            key={i}
            x1={pad.left}
            x2={pad.left + innerW}
            y1={y}
            y2={y}
            stroke="var(--bone)"
            strokeDasharray="2 4"
            strokeWidth="0.75"
          />
        );
      })}

      <path d={areaPath} fill="url(#spark-fill)" />
      <path
        d={path}
        stroke="var(--accent)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={4}
        fill="var(--accent)"
      />
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={9}
        fill="var(--accent)"
        opacity={0.18}
      />
    </svg>
  );
}

export function RetentionRing({
  retained,
  size = 132,
  thickness = 12,
}: {
  retained: number;
  size?: number;
  thickness?: number;
}) {
  const r = (size - thickness) / 2;
  const c = Math.PI * 2 * r;
  const offset = c * (1 - retained);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--bone)"
        strokeWidth={thickness}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={thickness}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
