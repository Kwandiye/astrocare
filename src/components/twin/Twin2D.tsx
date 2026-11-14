'use client';
import { ZONE_IDS, type TriageStatus, type ZoneId } from '@/types/health';
import { STATUS_META } from '@/lib/status';
import { ZONES } from '@/data/zones';

/** 2D SVG twin — fallback for weak devices / no WebGL, and the mini twin in the crew view. Same zone ids. */
const SHAPES: Record<ZoneId, { cx: number; cy: number; rx: number; ry: number }[]> = {
  brain: [{ cx: 100, cy: 34, rx: 17, ry: 13 }],
  eyes: [{ cx: 93, cy: 44, rx: 3.5, ry: 3 }, { cx: 107, cy: 44, rx: 3.5, ry: 3 }],
  inner_ear: [{ cx: 82, cy: 46, rx: 3, ry: 4 }, { cx: 118, cy: 46, rx: 3, ry: 4 }],
  lungs: [{ cx: 86, cy: 108, rx: 12, ry: 22 }, { cx: 114, cy: 108, rx: 12, ry: 22 }],
  heart: [{ cx: 104, cy: 116, rx: 8, ry: 9 }],
  liver: [{ cx: 88, cy: 140, rx: 14, ry: 7 }],
  stomach_gi: [{ cx: 110, cy: 144, rx: 9, ry: 6 }, { cx: 100, cy: 166, rx: 15, ry: 9 }],
  pancreas: [{ cx: 101, cy: 152, rx: 9, ry: 3 }],
  kidneys: [{ cx: 84, cy: 156, rx: 4, ry: 7 }, { cx: 116, cy: 156, rx: 4, ry: 7 }],
  spine: [{ cx: 100, cy: 130, rx: 3, ry: 46 }],
  skeleton_upper: [{ cx: 100, cy: 82, rx: 30, ry: 3 }],
  skeleton_lower: [{ cx: 100, cy: 188, rx: 22, ry: 8 }],
  knees: [{ cx: 88, cy: 262, rx: 6, ry: 6 }, { cx: 112, cy: 262, rx: 6, ry: 6 }],
  muscles_arms: [{ cx: 58, cy: 120, rx: 7, ry: 26 }, { cx: 142, cy: 120, rx: 7, ry: 26 }],
  muscles_legs: [{ cx: 88, cy: 228, rx: 9, ry: 26 }, { cx: 112, cy: 228, rx: 9, ry: 26 }, { cx: 88, cy: 296, rx: 7, ry: 20 }, { cx: 112, cy: 296, rx: 7, ry: 20 }],
  skin_immune: [{ cx: 100, cy: 338, rx: 46, ry: 6 }],
};

export function Twin2D({ zoneStatus, onSelect, selected, compact = false }: { zoneStatus: Record<ZoneId, TriageStatus>; onSelect?: (z: ZoneId) => void; selected?: ZoneId | null; compact?: boolean }) {
  const aura = zoneStatus.skin_immune;
  return (
    <svg viewBox="0 0 200 350" className="h-full w-full" role="img" aria-label="2D body map">
      <defs>
        <filter id="glow2d"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      {/* body outline */}
      <g fill="rgba(56,189,248,0.06)" stroke={aura === 'green' ? 'rgba(56,189,248,0.6)' : STATUS_META[aura].color} strokeWidth={aura === 'green' ? 1 : 2}>
        <ellipse cx={100} cy={40} rx={22} ry={26} />
        <rect x={70} y={70} width={60} height={110} rx={24} />
        <rect x={74} y={170} width={52} height={30} rx={14} />
        <rect x={48} y={78} width={18} height={100} rx={9} transform="rotate(8 57 78)" />
        <rect x={134} y={78} width={18} height={100} rx={9} transform="rotate(-8 143 78)" />
        <rect x={78} y={195} width={20} height={135} rx={10} />
        <rect x={102} y={195} width={20} height={135} rx={10} />
      </g>
      {ZONE_IDS.map((z) => {
        const st = zoneStatus[z];
        const color = st === 'green' ? '#22C55E' : STATUS_META[st].color;
        const dim = selected && selected !== z;
        return (
          <g key={z} role={onSelect ? 'button' : undefined} tabIndex={onSelect && !compact ? 0 : -1} aria-label={`${ZONES[z].name}: ${STATUS_META[st].label}`}
            onClick={() => onSelect?.(z)} onKeyDown={(e) => { if (e.key === 'Enter') onSelect?.(z); }}
            style={{ cursor: onSelect ? 'pointer' : 'default', opacity: dim ? 0.25 : 1 }}>
            {SHAPES[z].map((s, i) => (
              <g key={i}>
                {st === 'red' && <ellipse {...s} rx={s.rx + 4} ry={s.ry + 4} fill={color} opacity={0.45} filter="url(#glow2d)" />}
                <ellipse {...s} fill={color} fillOpacity={st === 'green' ? 0.35 : 0.85} stroke={st === 'green' ? 'none' : color} strokeWidth={1.5} />
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
