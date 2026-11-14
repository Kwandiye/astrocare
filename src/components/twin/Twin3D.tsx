'use client';
import { Suspense, useEffect, useMemo, useRef, useState, Component, type ReactNode } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, AdaptiveDpr, Html, useGLTF, Grid } from '@react-three/drei';
import { ProceduralTwin, ZoneLabel, type ZoneVisual } from './ProceduralTwin';
import { Twin2D } from './Twin2D';
import { useHealthStore, nextLayer, type LayerMode } from '@/store/useHealthStore';import { loadBodyGeometry } from '@/lib/bodyModel';
import { loadAnatomy, type AnatomyPart } from '@/lib/anatomyModel';
import { ZONE_IDS, ZONE_SYSTEM, type TriageStatus, type ZoneId, type ZoneState } from '@/types/health';
import { ZONES, ZONE_ANCHORS } from '@/data/zones';
import { STATUS_META } from '@/lib/status';

// framed so the 1.75 m body fills the panel height (fov 32° at 3.25 m ≈ 1.86 m visible)
const HOME = { pos: [0, 0.95, 3.25] as const, target: [0, 0.88, 0] as const };

function layerVisible(mode: LayerMode, layer: string) {
  if (mode === 'all') return true;
  if (mode === 'skin') return layer === 'aura';
  if (mode === 'organs') return layer === 'organ';
  if (mode === 'skeleton') return layer === 'skeleton';
  return layer === 'muscle';
}

/** Layer that shows a zone when it is selected while hidden. */
const LAYER_FOR: Record<string, LayerMode> = { organ: 'organs', skeleton: 'skeleton', muscle: 'muscles', aura: 'skin' };

export function zoneLabelText(z: ZoneState): string {
  const worst = [...z.metrics].filter((m) => m.status !== 'green').sort((a, b) => (b.status === 'red' ? 1 : 0) - (a.status === 'red' ? 1 : 0))[0];
  if (!worst) return ZONES[z.zoneId].name;
  const val = Number.isInteger(worst.value) ? worst.value : worst.value.toFixed(1);
  const arrow = worst.zScore != null ? (worst.zScore > 0 ? '↑' : '↓') : '';
  const pct = worst.deviationPct != null ? ` ${worst.deviationPct > 0 ? '+' : ''}${Math.round(worst.deviationPct)}%` : '';
  void pct;
  return `${worst.label.replace('Resting ', '').replace(' (hip/spine)', '').replace(' today', '')} ${val} ${worst.unit} ${arrow}`.trim();
}

/** Optional GLB model with the same zone ids. Falls back to the procedural twin if missing. */
function GlbTwin({ url, visuals, onSelect, onHover }: { url: string; visuals: Record<ZoneId, ZoneVisual>; onSelect: (z: ZoneId) => void; onHover: (z: ZoneId | null) => void }) {
  const { scene } = useGLTF(url, true);
  const mats = useMemo(() => {
    const out = {} as Record<string, THREE.MeshStandardMaterial>;
    scene.traverse((o) => {
      const id = (o.userData?.zone_id ?? o.name) as ZoneId;
      if ((o as THREE.Mesh).isMesh && ZONE_IDS.includes(id)) {
        const m = new THREE.MeshStandardMaterial({ transparent: true });
        (o as THREE.Mesh).material = m;
        out[o.uuid] = m;
        o.userData.zone_id = id;
      }
    });
    return out;
  }, [scene]);
  useEffect(() => {
    scene.traverse((o) => {
      const m = mats[o.uuid];
      if (!m) return;
      const vis = visuals[o.userData.zone_id as ZoneId];
      const c = vis.status === 'green' ? '#22C55E' : STATUS_META[vis.status].color;
      m.color.set(c); m.emissive.set(c);
      m.emissiveIntensity = vis.status === 'red' ? 1.1 : vis.status === 'yellow' ? 0.55 : 0.18;
      m.opacity = vis.opacity * 0.85;
      o.visible = vis.visible;
    });
  }, [scene, mats, visuals]);
  return (
    <primitive object={scene}
      onClick={(e: { object: THREE.Object3D; stopPropagation: () => void }) => { e.stopPropagation(); const id = e.object.userData.zone_id; if (id) onSelect(id); }}
      onPointerOver={(e: { object: THREE.Object3D }) => onHover(e.object.userData.zone_id ?? null)}
      onPointerOut={() => onHover(null)} />
  );
}

/** Lives inside <Canvas> after <CameraControls>, so the controls ref is ready when the effect runs. */
/** Back-of-body zones are approached from behind when selected. */
const BACK_ZONES: ZoneId[] = ['spine', 'kidneys'];

function CameraRig({ controls, selectedZone, side }: { controls: React.RefObject<CameraControls>; selectedZone: ZoneId | null; side: 'front' | 'back' }) {
  const inited = useRef(0);
  const s = side === 'back' ? -1 : 1;
  // Re-assert the home framing during the first frames (controls may finish initialising after mount).
  useFrame(() => {
    const c = controls.current;
    if (!c || inited.current > 5 || selectedZone) return;
    inited.current++;
    c.setLookAt(HOME.pos[0], HOME.pos[1], HOME.pos[2] * s, ...HOME.target, false);
  });
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (selectedZone) {
      const [x, y, z] = ZONE_ANCHORS[selectedZone];
      const wide = selectedZone === 'skin_immune' || selectedZone === 'muscles_legs' || selectedZone === 'skeleton_lower' || selectedZone === 'muscles_arms';
      const dir = side === 'back' || BACK_ZONES.includes(selectedZone) ? -1 : 1;
      c.setLookAt(x * 0.6, y + 0.05, z + dir * (wide ? 2.0 : 0.95), x, wide ? Math.max(0.8, y) : y, z, true);
    } else {
      c.setLookAt(HOME.pos[0], HOME.pos[1], HOME.pos[2] * s, ...HOME.target, true);
    }
  }, [selectedZone, controls, side]);
  return null;
}

class CanvasBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('[twin] 3D failed, using 2D fallback', e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export function Twin3D({ zoneStatus, zones, sky }: { zoneStatus: Record<ZoneId, TriageStatus>; zones: Record<ZoneId, ZoneState>; sky: [string, string] }) {
  const selectedZone = useHealthStore((s) => s.selectedZone);
  const hovered = useHealthStore((s) => s.hoveredZone);
  const layerMode = useHealthStore((s) => s.layerMode);
  const systemFilter = useHealthStore((s) => s.systemFilter);
  const highlight = useHealthStore((s) => s.highlightZones);
  const viewSide = useHealthStore((s) => s.viewSide);
  const painPick = useHealthStore((s) => s.painPick);
  const selectZone = useHealthStore((s) => s.selectZone);
  const set = useHealthStore((s) => s.set);
  const controls = useRef<CameraControls>(null);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [webgl, setWebgl] = useState(true);
  const [body, setBody] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => { setWebgl(hasWebGL()); }, []);
  const [anatomy, setAnatomy] = useState<AnatomyPart[] | null>(null);
  useEffect(() => {
    // user-supplied body mesh (FBX); the twin keeps its primitive shell if it is missing or fails to parse
    let alive = true;
    loadBodyGeometry().then((g) => { if (alive) setBody(g); }).catch((e) => console.warn('[twin] body mesh unavailable', e));
    // detailed anatomy (Z-Anatomy GLB); falls back to the primitive organs if missing
    loadAnatomy().then((p) => { if (alive) setAnatomy(p); }).catch((e) => console.warn('[twin] anatomy model unavailable', e));
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    // selecting a zone hidden by the current layer switches to the layer that shows it
    if (!selectedZone || layerVisible(layerMode, ZONES[selectedZone].layer)) return;
    set({ layerMode: LAYER_FOR[ZONES[selectedZone].layer] });
  }, [selectedZone, layerMode, set]);
  useEffect(() => {
    // Swap in the Blender GLB automatically when it exists.
    fetch('/models/astronaut_twin.glb', { method: 'HEAD' }).then((r) => {
      if (r.ok && (r.headers.get('content-type') ?? '').includes('model')) setGlbUrl('/models/astronaut_twin.glb');
    }).catch(() => undefined);
  }, []);

  const visuals = useMemo(() => {
    const out = {} as Record<ZoneId, ZoneVisual>;
    for (const z of ZONE_IDS) {
      let opacity = 1;
      if (selectedZone && z !== selectedZone) opacity = 0.18;
      if (systemFilter && ZONE_SYSTEM[z] !== systemFilter) opacity = Math.min(opacity, 0.2);
      if (highlight.length && !highlight.includes(z)) opacity = Math.min(opacity, 0.2);
      out[z] = { status: zoneStatus[z], opacity, visible: layerVisible(layerMode, ZONES[z].layer), highlighted: hovered === z || highlight.includes(z) };
    }
    return out;
  }, [zoneStatus, selectedZone, systemFilter, highlight, layerMode, hovered]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'Escape') selectZone(null);
      if (e.key === 'l' || e.key === 'L') { const s = useHealthStore.getState(); s.set({ layerMode: nextLayer(s.layerMode), selectedZone: null }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectZone]);

  const onSelect = (z: ZoneId) => selectZone(z);
  const onHover = (z: ZoneId | null) => set({ hoveredZone: z });
  const onPeel = () => set({ layerMode: nextLayer(layerMode), selectedZone: null });

  // in skin view abnormal zones glow through the skin, so their labels stay visible too
  const labelZones = ZONE_IDS.filter((z) => zoneStatus[z] !== 'green' && zoneStatus[z] !== 'stale'
    && (visuals[z].visible || (layerMode === 'skin' && !!body)) && (!selectedZone || selectedZone === z));

  const fallback = <Twin2D zoneStatus={zoneStatus} onSelect={onSelect} selected={selectedZone} />;
  if (!webgl) return fallback;

  return (
    <div className="relative h-full w-full">
      <CanvasBoundary fallback={fallback}>
        <Canvas camera={{ position: [...HOME.pos], fov: 32, near: 0.05, far: 50 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}
          onPointerMissed={() => { if (!painPick) selectZone(null); }}>
          <AdaptiveDpr />
          <ambientLight intensity={0.55} />
          <directionalLight position={[2, 3, 4]} intensity={1.1} />
          <directionalLight position={[-2, 1.5, -2]} intensity={0.35} />
          <CameraControls ref={controls} minDistance={0.4} maxDistance={6} smoothTime={0.6} />
          <CameraRig controls={controls} selectedZone={selectedZone} side={viewSide} />
          {/* subtle floor for spatial orientation */}
          <Grid position={[0, 0.001, 0]} args={[6, 6]} cellSize={0.1} cellThickness={0.5} cellColor="#17223A" sectionSize={0.5} sectionThickness={0.8}
            sectionColor="#1F2D47" fadeDistance={3.2} fadeStrength={2.5} infiniteGrid followCamera={false} raycast={() => null} />
          <Suspense fallback={<Html center><div className="text-xs text-slate-400">Loading 3D body…</div></Html>}>
            {glbUrl
              ? <GlbTwin url={glbUrl} visuals={visuals} onSelect={onSelect} onHover={onHover} />
              : <ProceduralTwin visuals={visuals} onSelect={onSelect} onHover={onHover} shellOpacity={selectedZone ? 0.45 : 1}
                  layerMode={layerMode} body={body} onPeel={onPeel} painPick={painPick} anatomy={anatomy} />}
          </Suspense>
          {labelZones.map((z) => <ZoneLabel key={z} position={ZONE_ANCHORS[z]} status={zoneStatus[z]} text={zoneLabelText(zones[z])} />)}
          {hovered && !labelZones.includes(hovered) && (
            <Html position={ZONE_ANCHORS[hovered]} center style={{ pointerEvents: 'none' }}>
              <div className="whitespace-nowrap rounded-lg bg-[#1B2738]/95 px-2.5 py-1 text-xs text-slate-100 shadow-lg" style={{ transform: 'translate(60px,-20px)' }}>
                {ZONES[hovered].name} <span style={{ color: STATUS_META[zoneStatus[hovered]].color }}>· {STATUS_META[zoneStatus[hovered]].label}</span>
              </div>
            </Html>
          )}
        </Canvas>
      </CanvasBoundary>
    </div>
  );
}
