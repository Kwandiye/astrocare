'use client';
import { useId } from 'react';
import { STATUS_META } from '@/lib/status';
import type { TriageStatus } from '@/types/health';

export function StatusBadge({ status, size = 'sm', label }: { status: TriageStatus; size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  const cls = size === 'lg' ? 'text-sm px-3 py-1 gap-1.5' : size === 'md' ? 'text-xs px-2.5 py-1 gap-1.5' : 'text-[11px] px-2 py-0.5 gap-1';
  const icon = size === 'lg' ? 16 : size === 'md' ? 13 : 12;
  return (
    <span className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${cls}`} style={{ color: m.color, background: m.bg }}>
      <Icon size={icon} aria-hidden />
      {label ?? m.label}
    </span>
  );
}

export function StatusDot({ status, size = 8 }: { status: TriageStatus; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: STATUS_META[status].color }} aria-label={STATUS_META[status].label} />;
}

export function Panel({ children, className = '', title, icon, right, pad = true }: {
  children: React.ReactNode; className?: string; title?: React.ReactNode; icon?: React.ReactNode; right?: React.ReactNode; pad?: boolean;
}) {
  return (
    <section className={`card rounded-card ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-2 px-4 pb-1 pt-3.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">{icon}{title}</h2>
          {right}
        </header>
      )}
      <div className={pad ? 'px-4 pb-4 pt-2' : ''}>{children}</div>
    </section>
  );
}

/** Small trend line with a soft area fill and an optional baseline band. */
export function Sparkline({ values, color = '#38BDF8', width = 100, height = 28, band, fluid = false }: { values: number[]; color?: string; width?: number; height?: number; band?: [number, number]; fluid?: boolean }) {
  const id = useId().replace(/:/g, '');
  if (values.length < 2) return <svg width={fluid ? '100%' : width} height={height} aria-hidden />;
  const lo = Math.min(...values, band?.[0] ?? Infinity);
  const hi = Math.max(...values, band?.[1] ?? -Infinity);
  const span = hi - lo || 1;
  const pad = 3;
  const x = (i: number) => (i / (values.length - 1)) * (width - 4) + 2;
  const y = (v: number) => height - pad - ((v - lo) / span) * (height - 2 * pad);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values[values.length - 1];
  return (
    <svg width={fluid ? '100%' : width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio={fluid ? 'none' : undefined} aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {band && <rect x={0} width={width} y={y(band[1])} height={Math.max(1, y(band[0]) - y(band[1]))} fill="#94A3B8" opacity={0.08} rx={2} />}
      <path d={`${d} L${x(values.length - 1)},${height} L${x(0)},${height} Z`} fill={`url(#g${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {!fluid && <circle cx={x(values.length - 1)} cy={y(last)} r={2.5} fill={color} />}
    </svg>
  );
}
