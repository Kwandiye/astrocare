'use client';
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { AnatomyPart } from '@/lib/anatomyModel';
import type { LayerMode } from '@/store/useHealthStore';
import type { TriageStatus, ZoneId } from '@/types/health';
import type { ZoneVisual } from './ProceduralTwin';
import { STATUS_META } from '@/lib/status';

/** Which anatomy layers each view shows, and how opaque they are. */
function layerOpacity(mode: LayerMode, layer: AnatomyPart['layer']): number {
  if (mode === 'muscles') return layer === 'muscle' ? 1 : 0;
  if (mode === 'organs') return layer === 'organ' ? 1 : 0;
  if (mode === 'skeleton') return layer === 'bone' ? 1 : 0;
  if (mode === 'all') return layer === 'organ' ? 0.95 : layer === 'bone' ? 0.38 : 0;
  return 0; // skin view: everything is under the skin
}

const WHITE = new THREE.Color('#ffffff');

function Part({ part, mode, visual, onSelect, onHover, onPeel }: {
  part: AnatomyPart; mode: LayerMode; visual: ZoneVisual | null;
  onSelect: (z: ZoneId) => void; onHover: (z: ZoneId | null) => void; onPeel: () => void;
}) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, transparent: true, opacity: 0 }), []);
  const ref = useRef<THREE.Mesh>(null);
  const pulse = useRef<number | null>(null);
  const prev = useRef<TriageStatus | undefined>(visual?.status);
  const status: TriageStatus = visual?.status ?? 'green';
  useEffect(() => {
    if (status === 'red' && prev.current !== 'red') pulse.current = performance.now();
    prev.current = status;
  }, [status]);

  const alarm = status === 'yellow' || status === 'red';
  const tint = useMemo(() => new THREE.Color(alarm ? STATUS_META[status].color : '#ffffff'), [alarm, status]);
  const base = layerOpacity(mode, part.layer);
  const target = base * (visual?.opacity ?? 1);
  const clickable = base > 0 && part.zone !== 'muscles_other';

  useFrame(() => {
    mat.opacity += (target - mat.opacity) * 0.14;
    // abnormal zones keep their anatomy but are washed with the status colour + a soft glow
    mat.color.copy(WHITE).lerp(tint, alarm ? (status === 'red' ? 0.55 : 0.45) : 0);
    mat.emissive.copy(alarm ? tint : WHITE);
    let e = alarm ? (status === 'red' ? 0.32 : 0.2) : visual?.highlighted ? 0.12 : 0;
    if (pulse.current !== null) {
      const t = (performance.now() - pulse.current) / 1200;
      if (t >= 1) pulse.current = null; else e += Math.sin(t * Math.PI) * 0.6;
    }
    mat.emissiveIntensity = e;
    mat.depthWrite = mat.opacity > 0.9;
    if (ref.current) ref.current.visible = mat.opacity > 0.02;
  });

  const handlers = base > 0 ? {
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (clickable) onSelect(part.zone as ZoneId); else onPeel(); },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); if (clickable) onHover(part.zone as ZoneId); document.body.style.cursor = clickable ? 'pointer' : 'zoom-in'; },
    onPointerOut: () => { onHover(null); document.body.style.cursor = 'auto'; },
  } : {};

  return <mesh ref={ref} geometry={part.geometry} material={mat} name={`${part.layer}__${part.zone}`} renderOrder={part.layer === 'bone' ? 1 : 2} {...handlers} />;
}

/** Detailed muscles / organs / skeleton from the Z-Anatomy GLB, coloured by zone status. */
export function AnatomyLayers({ parts, mode, visuals, onSelect, onHover, onPeel }: {
  parts: AnatomyPart[]; mode: LayerMode; visuals: Record<ZoneId, ZoneVisual>;
  onSelect: (z: ZoneId) => void; onHover: (z: ZoneId | null) => void; onPeel: () => void;
}) {
  return (
    <group>
      {parts.map((p) => (
        <Part key={`${p.layer}:${p.zone}`} part={p} mode={mode} visual={p.zone === 'muscles_other' ? null : visuals[p.zone]}
          onSelect={onSelect} onHover={onHover} onPeel={onPeel} />
      ))}
    </group>
  );
}
