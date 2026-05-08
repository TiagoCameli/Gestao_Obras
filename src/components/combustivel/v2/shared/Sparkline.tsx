// Sparkline minimalista em SVG puro — 60×24 default. Sem deps, sem
// tooltip. Pra hover-detail, use um chart maior.

interface Props {
  data: number[];
  width?: number;
  height?: number;
  /** Cor da linha. CSS var ou hex. */
  color?: string;
  /** Cor da área translúcida abaixo da linha. */
  fill?: string;
  className?: string;
}

export default function Sparkline({
  data,
  width = 60,
  height = 24,
  color = 'var(--color-accent)',
  fill = 'var(--color-accent-soft)',
  className,
}: Props) {
  if (data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L${(points[points.length - 1]![0]).toFixed(1)},${height} L0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <path d={areaPath} fill={fill} stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
