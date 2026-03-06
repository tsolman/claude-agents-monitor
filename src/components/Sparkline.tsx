import { useRef, useState, useEffect } from 'react';

interface SparklineProps {
  data: number[];
  height?: number;
  color?: string;
  fillColor?: string;
  label?: string;
  currentValue?: string;
}

export function Sparkline({
  data,
  height = 40,
  color = '#3fb950',
  fillColor,
  label,
  currentValue,
}: SparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setWidth(Math.round(w));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (data.length < 2) {
    return (
      <div
        ref={containerRef}
        className="flex w-full items-center justify-center font-mono text-[10px] text-white/15"
        style={{ height }}
      >
        awaiting data...
      </div>
    );
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Generate smooth cubic bezier path
  const coords = data.map((value, i) => ({
    x: padding + (i / (data.length - 1)) * chartWidth,
    y: padding + chartHeight - ((value - min) / range) * chartHeight,
  }));

  let linePath = `M ${coords[0].x},${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpx = (prev.x + curr.x) / 2;
    linePath += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
  }

  const fillPath = `${linePath} L ${padding + chartWidth},${padding + chartHeight} L ${padding},${padding + chartHeight} Z`;

  const fill = fillColor || `${color}10`;
  const lastPoint = coords[coords.length - 1];

  return (
    <div ref={containerRef} className="w-full">
      {(label || currentValue) && (
        <div className="mb-1.5 flex items-baseline justify-between">
          {label && (
            <span className="text-[11px] font-medium uppercase tracking-widest text-white/25">
              {label}
            </span>
          )}
          {currentValue && (
            <span className="metric-value text-sm" style={{ color }}>
              {currentValue}
            </span>
          )}
        </div>
      )}
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <defs>
          <linearGradient
            id={`grad-${color.replace('#', '')}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path
          d={fillPath}
          fill={`url(#grad-${color.replace('#', '')})`}
        />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />
        {/* Current value dot */}
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={3}
          fill={color}
          opacity={0.9}
        />
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={6}
          fill={color}
          opacity={0.15}
        />
      </svg>
    </div>
  );
}
