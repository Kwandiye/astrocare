'use client';
import { ComposedChart, Line, XAxis, YAxis, ReferenceArea, ResponsiveContainer, Tooltip, CartesianGrid, Bar } from 'recharts';
import { STATUS_META } from '@/lib/status';
import type { Point, Series } from '@/lib/series';

const AXIS = { fill: '#94A3B8', fontSize: 12 };

/** Dot only where a point is abnormal, so warnings stand out without cluttering normal stretches. */
function StatusDotShape(props: { cx?: number; cy?: number; payload?: Point }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload || payload.status === 'green') return <g />;
  return <circle cx={cx} cy={cy} r={4} fill={STATUS_META[payload.status].color} stroke="#141E2D" strokeWidth={2} />;
}

export function TrendChart({ series, second, color = '#38BDF8', height = 200, bars = false }: {
  series: Series; second?: Series; color?: string; height?: number; bars?: boolean;
}) {
  if (series.points.length === 0) {
    return <div className="flex items-center justify-center rounded-lg bg-raised/40 text-sm text-muted" style={{ height }}>Measured once a day — choose 7 days or 30 days.</div>;
  }
  const data = series.points.map((p, i) => ({ ...p, v2: second?.points[i]?.v }));
  const bl = series.baseline;
  const fmt = (v: number) => `${v} ${series.unit}`;
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.10)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={bars ? [0, 'auto'] : ['auto', 'auto']} width={44} />
          {bl && <ReferenceArea y1={bl.mean - 1.5 * bl.sd} y2={bl.mean + 1.5 * bl.sd} fill="#94A3B8" fillOpacity={0.09} ifOverflow="extendDomain" />}
          <Tooltip cursor={{ stroke: 'rgba(148,163,184,0.3)' }}
            contentStyle={{ background: '#1B2738', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12, color: '#F5F7FA' }}
            labelStyle={{ color: '#94A3B8' }}
            formatter={(v: number, name: string) => [fmt(v), name === 'v2' ? second?.label ?? '' : series.label]} />
          {bars
            ? <Bar dataKey="v" fill={color} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            : <Line dataKey="v" stroke={color} strokeWidth={2.25} dot={<StatusDotShape />} activeDot={{ r: 5 }} isAnimationActive={false} />}
          {second && <Line dataKey="v2" stroke="#7DD3FC" strokeOpacity={0.55} strokeWidth={1.75} strokeDasharray="4 3" dot={false} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RangeTabs<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-raised p-0.5" role="tablist">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${value === o.id ? 'bg-card text-ink shadow' : 'text-muted hover:text-ink'}`}>{o.label}</button>
      ))}
    </div>
  );
}
