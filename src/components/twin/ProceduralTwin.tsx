'use client';
import { useMemo, useRef, useEffect, createContext, useContext } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { TriageStatus, ZoneId } from '@/types/health';
import { ZONE_IDS } from '@/types/health';
import { STATUS_META } from '@/lib/status';
import { ZONE_ANCHORS } from '@/data/zones';
import { REGION } from '@/lib/bodyModel';
import type { LayerMode } from '@/store/useHealthStore';
import type { AnatomyPart } from '@/lib/anatomyModel';
import { AnatomyLayers } from './AnatomyLayers';

/**
 * Anatomical twin. Every zone is its own mesh group with the same ids as the planned GLB
 * (public/models/astronaut_twin.glb). Joints and organs are fitted to the body mesh in
 * public/models/astronaut_body.fbx (A-pose, 1.755 m). Units: metres, y-up, feet at y=0, facing +z.
 *
 * Layers (outermost first): skin → muscles → organs → skeleton → X-ray ('all').
 * Leaving the skin or muscle layer dissolves it from the head down; organ and bone groups cross-fade.
 */

type V3 = [number, number, number];
const v = (p: V3) => new THREE.Vector3(...p);

/**
 * Technical wireframe overlay shared by every mesh inside a zone group. Each organ/bone renders a faint fill
 * plus this crisp 1px wire, instead of puffy emissive volumes.
 */
const WireCtx = createContext<THREE.Material | null>(null);

/** Capsule/cylinder between two points. */
function Segment({ a, b, r, kind = 'capsule', material }: { a: V3; b: V3; r: number; kind?: 'capsule' | 'cylinder'; material: THREE.Material }) {
  const wire = useContext(WireCtx);
  const { pos, quat, len } = useMemo(() => {
    const A = v(a), B = v(b);
    const dir = B.clone().sub(A);
    const len = dir.length();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return { pos: A.add(B).multiplyScalar(0.5), quat, len };
  }, [a, b]);
  const geom = kind === 'capsule' ? <capsuleGeometry args={[r, Math.max(0.001, len - 2 * r), 3, 8]} /> : <cylinderGeometry args={[r, r, len, 8, 1, true]} />;
  return (
    <group position={pos} quaternion={quat}>
      <mesh material={material}>{geom}</mesh>
      {wire && <mesh material={wire} raycast={() => null}>{geom}</mesh>}
    </group>
  );
}

// Joint centres measured on the FBX body (left side = +x). See scripts/fbxinfo.mjs.
export const J = {
  shoulder: [0.175, 1.395, -0.03] as V3, elbow: [0.302, 1.165, -0.05] as V3, wrist: [0.43, 0.955, -0.03] as V3, hand: [0.458, 0.85, -0.005] as V3,
  hip: [0.095, 0.87, 0] as V3, knee: [0.135, 0.49, -0.005] as V3, ankle: [0.152, 0.09, -0.03] as V3, toe: [0.17, 0.025, 0.13] as V3,
};
const mirror = (p: V3): V3 => [-p[0], p[1], p[2]];
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sides = [1, -1] as const;
const side = (s: number, p: V3) => (s > 0 ? p : mirror(p));

/** Spine depth follows the measured back curve (lordosis / kyphosis). */
const SPINE_Z: [number, number][] = [[0.93, -0.05], [1.05, -0.045], [1.15, -0.055], [1.25, -0.08], [1.35, -0.09], [1.45, -0.07], [1.56, -0.035]];
function spineZ(y: number) {
  for (let i = 1; i < SPINE_Z.length; i++) {
    const [y1, z1] = SPINE_Z[i], [y0, z0] = SPINE_Z[i - 1];
    if (y <= y1) return z0 + ((y - y0) / (y1 - y0)) * (z1 - z0);
  }
  return SPINE_Z[SPINE_Z.length - 1][1];
}

/* ------------------------------------------------------------------ materials */

/** Fresnel rim hologram. Opacity eases towards `opacity` every frame. */
function useHoloMaterial(color: string, opacity: number) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    // thin silhouette line rather than a glowing volume
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.6); gl_FragColor = vec4(uColor, (0.025 + f*0.7) * uOpacity); }`,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  useEffect(() => { mat.uniforms.uColor.value.set(color); }, [mat, color]);
  useFrame(() => { mat.uniforms.uOpacity.value += (opacity - mat.uniforms.uOpacity.value) * 0.12; });
  return mat;
}

/** Lit skin / muscle surface with a top-down dissolve edge and per-region status tint. */
function makeAnatomyMaterial(kind: 'skin' | 'muscle') {
  const muscle = kind === 'muscle';
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: true, side: THREE.DoubleSide,
    uniforms: {
      uBase: { value: new THREE.Color(muscle ? '#7A3431' : '#8F8984') },
      uBase2: { value: new THREE.Color(muscle ? '#A5524B' : '#ABA49D') },
      uFiber: { value: muscle ? 1 : 0 },
      uInset: { value: muscle ? 0.0045 : 0 },
      uCut: { value: 2 },
      uOpacity: { value: 1 },
      uEdge: { value: new THREE.Color('#7DD3FC') },
      uRim: { value: new THREE.Color(muscle ? '#FCA5A5' : '#7DD3FC') },
      uTint0: { value: new THREE.Color('#ffffff') }, uAmt0: { value: 0 },
      uTint1: { value: new THREE.Color('#ffffff') }, uAmt1: { value: 0 },
      uTint2: { value: new THREE.Color('#ffffff') }, uAmt2: { value: 0 },
    },
    vertexShader: `attribute float aRegion; uniform float uInset;
      varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vR;
      void main(){
        vec3 p = position - normal * uInset; vP = p; vR = aRegion;
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uBase; uniform vec3 uBase2; uniform float uFiber; uniform float uCut; uniform float uOpacity;
      uniform vec3 uEdge; uniform vec3 uRim;
      uniform vec3 uTint0; uniform vec3 uTint1; uniform vec3 uTint2; uniform float uAmt0; uniform float uAmt1; uniform float uAmt2;
      varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vR;
      void main(){
        if (vP.y > uCut) discard;
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        vec3 col = uBase;
        if (uFiber > 0.5) {
          // fine striations; faded out where they would alias (far away / grazing angles)
          float arg = (vP.x * 0.8 + vP.z) * 900.0 + sin(vP.y * 14.0) * 3.0;
          float aa = clamp(1.0 - fwidth(arg) * 0.35, 0.0, 1.0);
          float fib = 0.5 + 0.5 * sin(arg);
          float band = 0.5 + 0.5 * sin(vP.y * 26.0 + vP.x * 7.0);
          col = mix(uBase, uBase2, 0.45 + (fib - 0.5) * 0.35 * aa + (band - 0.5) * 0.25);
        } else {
          col = mix(uBase, uBase2, 0.5 + 0.5 * n.y);
        }
        int r = int(vR + 0.5);
        vec3 tint = r == 1 ? uTint1 : (r == 2 ? uTint2 : uTint0);
        float amt = r == 1 ? uAmt1 : (r == 2 ? uAmt2 : uAmt0);
        col = mix(col, tint, amt);
        float diff = max(dot(n, normalize(vec3(0.35, 0.6, 0.75))), 0.0);
        float hemi = 0.55 + 0.45 * n.y;
        vec3 lit = col * (0.32 * hemi + 0.62 * diff);
        float rim = pow(1.0 - abs(dot(n, normalize(vV))), 3.0);
        lit += uRim * rim * 0.35 + tint * amt * 0.45;
        float edge = smoothstep(0.035, 0.0, uCut - vP.y);
        lit = mix(lit, uEdge * 1.6, edge);
        gl_FragColor = vec4(lit, uOpacity);
      }`,
  });
}

/** Moves the dissolve plane: shown → above the head, hidden → below the feet. Hides the mesh when fully dissolved. */
function useDissolve(mat: THREE.ShaderMaterial, shown: boolean, mesh: React.RefObject<THREE.Object3D>, instantShow = false) {
  const init = useRef(false);
  useFrame((_, dt) => {
    const u = mat.uniforms.uCut;
    const target = shown ? 1.9 : -0.12;
    // inner layers appear at once (the outer layer dissolving above them reveals them)
    if (!init.current || (instantShow && shown)) { u.value = target; init.current = true; }
    const d = target - u.value;
    u.value += Math.sign(d) * Math.min(Math.abs(d), Math.min(dt, 0.05) * 2.4);
    if (mesh.current) mesh.current.visible = u.value > -0.1;
  });
}

const statusTint = (st: TriageStatus) => (st === 'red' ? 0.62 : st === 'yellow' ? 0.45 : st === 'stale' ? 0.25 : 0);
const statusColor = (st: TriageStatus) => (st === 'green' ? '#22C55E' : STATUS_META[st].color);

/* ------------------------------------------------------------------ outer layers */

/** Hologram outline of the body: the FBX mesh if loaded, otherwise primitives. */
function BodyShell({ opacity, body }: { opacity: number; body: THREE.BufferGeometry | null }) {
  const m = useHoloMaterial('#38BDF8', opacity);
  if (body) return <mesh geometry={body} material={m} raycast={() => null} renderOrder={5} />;
  return (
    <group raycast={() => null}>
      <mesh position={[0, 1.645, 0.02]} scale={[0.82, 1.05, 1]} material={m} raycast={() => null}><sphereGeometry args={[0.112, 32, 24]} /></mesh>
      <Segment a={[0, 1.47, 0]} b={[0, 1.55, 0.01]} r={0.055} material={m} />
      <mesh position={[0, 1.22, -0.005]} scale={[1.15, 1, 0.82]} material={m}><capsuleGeometry args={[0.155, 0.3, 8, 24]} /></mesh>
      <mesh position={[0, 0.93, 0]} scale={[1.3, 0.85, 0.85]} material={m}><sphereGeometry args={[0.14, 24, 16]} /></mesh>
      {sides.map((s) => (
        <group key={s}>
          <Segment a={side(s, J.shoulder)} b={side(s, J.elbow)} r={0.05} material={m} />
          <Segment a={side(s, J.elbow)} b={side(s, J.wrist)} r={0.042} material={m} />
          <Segment a={side(s, J.wrist)} b={side(s, J.hand)} r={0.035} material={m} />
          <Segment a={side(s, J.hip)} b={side(s, J.knee)} r={0.078} material={m} />
          <Segment a={side(s, J.knee)} b={side(s, J.ankle)} r={0.056} material={m} />
          <Segment a={side(s, J.ankle)} b={side(s, J.toe)} r={0.04} material={m} />
        </group>
      ))}
    </group>
  );
}

function nearestZone(p: THREE.Vector3): ZoneId {
  let best: ZoneId = 'skin_immune', bd = Infinity;
  for (const z of ZONE_IDS) {
    if (z === 'skin_immune') continue;
    const [x, y, zz] = ZONE_ANCHORS[z];
    const d = (Math.abs(p.x) - Math.abs(x)) ** 2 + (p.y - y) ** 2 + (p.z - zz) ** 2 * 0.3;
    if (d < bd) { bd = d; best = z; }
  }
  return best;
}

/** Opaque skin. Click = peel to the next layer (or, in the pain check-in, pick the nearest zone). */
function SkinLayer({ body, shown, skinStatus, onPeel, onPick, painPick }: {
  body: THREE.BufferGeometry; shown: boolean; skinStatus: TriageStatus; onPeel: () => void; onPick: (z: ZoneId) => void; painPick: boolean;
}) {
  const mat = useMemo(() => makeAnatomyMaterial('skin'), []);
  const ref = useRef<THREE.Mesh>(null);
  useDissolve(mat, shown, ref);
  useEffect(() => {
    // the whole skin carries the skin/immune/radiation status as a faint tint
    for (const i of [0, 1, 2]) {
      mat.uniforms[`uTint${i}`].value.set(statusColor(skinStatus));
      mat.uniforms[`uAmt${i}`].value = statusTint(skinStatus) * 0.18;
    }
  }, [mat, skinStatus]);
  return (
    <mesh ref={ref} geometry={body} material={mat} name="skin"
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!shown) return;
        if (e.intersections.some((i) => i.object.userData.hotspotZone)) return; // let the hotspot handle it
        e.stopPropagation();
        if (painPick) onPick(nearestZone(e.point)); else onPeel();
      }}
      onPointerOver={(e) => { if (!shown) return; e.stopPropagation(); document.body.style.cursor = 'zoom-in'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }} />
  );
}

/** Écorché muscle body (FBX inset along normals). Arm and leg/back regions carry the muscle-zone status. */
function MuscleLayer({ body, shown, arms, legs, onSelect, onHover, onPeel }: {
  body: THREE.BufferGeometry; shown: boolean; arms: { status: TriageStatus; highlighted: boolean }; legs: { status: TriageStatus; highlighted: boolean };
  onSelect: (z: ZoneId) => void; onHover: (z: ZoneId | null) => void; onPeel: () => void;
}) {
  const mat = useMemo(() => makeAnatomyMaterial('muscle'), []);
  const ref = useRef<THREE.Mesh>(null);
  const lastHover = useRef<ZoneId | null>(null);
  const hover = (z: ZoneId | null) => { if (z !== lastHover.current) { lastHover.current = z; onHover(z); } };
  useDissolve(mat, shown, ref, true);
  useEffect(() => {
    const u = mat.uniforms;
    u.uTint1.value.set(arms.highlighted && arms.status === 'green' ? '#38BDF8' : statusColor(arms.status));
    u.uAmt1.value = statusTint(arms.status) + (arms.highlighted ? 0.25 : 0);
    u.uTint2.value.set(legs.highlighted && legs.status === 'green' ? '#38BDF8' : statusColor(legs.status));
    u.uAmt2.value = statusTint(legs.status) + (legs.highlighted ? 0.25 : 0);
  }, [mat, arms, legs]);
  const regionAt = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const r = e.face ? body.getAttribute('aRegion').getX(e.face.a) : 0;
    return r === REGION.arms ? 'muscles_arms' : r === REGION.legsBack ? 'muscles_legs' : null;
  };
  return (
    <mesh ref={ref} geometry={body} material={mat} name="muscles"
      onClick={(e) => { if (!shown) return; e.stopPropagation(); const z = regionAt(e); if (z) onSelect(z); else onPeel(); }}
      onPointerMove={(e) => { if (!shown) return; e.stopPropagation(); const z = regionAt(e); hover(z); document.body.style.cursor = z ? 'pointer' : 'zoom-in'; }}
      onPointerOut={() => { hover(null); document.body.style.cursor = 'auto'; }} />
  );
}

let reticleTex: THREE.Texture | null = null;
/** Clinical crosshair reticle: thin ring, centre dot, four ticks. */
function reticleTexture() {
  if (reticleTex) return reticleTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 3;
  g.beginPath(); g.arc(64, 64, 40, 0, Math.PI * 2); g.stroke();
  for (const [x1, y1, x2, y2] of [[64, 4, 64, 30], [64, 98, 64, 124], [4, 64, 30, 64], [98, 64, 124, 64]]) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  g.beginPath(); g.arc(64, 64, 4, 0, Math.PI * 2); g.fill();
  reticleTex = new THREE.CanvasTexture(c);
  reticleTex.anisotropy = 4;
  return reticleTex;
}

/** In skin view, abnormal zones are marked through the skin with a reticle. Click one to jump to that zone. */
function Hotspots({ visuals, onSelect }: { visuals: Record<ZoneId, ZoneVisual>; onSelect: (z: ZoneId) => void }) {
  const tex = useMemo(() => reticleTexture(), []);
  const zones = ZONE_IDS.filter((z) => z !== 'skin_immune' && (visuals[z].status === 'red' || visuals[z].status === 'yellow'));
  return (
    <>
      {zones.map((z) => {
        const st = visuals[z].status;
        const size = st === 'red' ? 0.11 : 0.085;
        return (
          <sprite key={z} position={ZONE_ANCHORS[z]} scale={[size, size, size]} renderOrder={10} userData={{ hotspotZone: z }}
            onClick={(e) => { e.stopPropagation(); onSelect(z); }}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
            <spriteMaterial map={tex} color={STATUS_META[st].color} transparent depthTest={false} depthWrite={false} toneMapped={false} />
          </sprite>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ zones */

export interface ZoneVisual {
  status: TriageStatus;
  opacity: number; // focus / filter dimming
  visible: boolean;
  highlighted: boolean;
}

function ZoneGroup({ id, visual, onSelect, onHover, children, raycastable = true }: {
  id: ZoneId; visual: ZoneVisual; onSelect: (z: ZoneId) => void; onHover: (z: ZoneId | null) => void;
  children: (mat: THREE.MeshStandardMaterial) => React.ReactNode; raycastable?: boolean;
}) {
  // faint fill (keeps shape readable and clickable) + crisp wire (the visual signal)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.55, metalness: 0, depthWrite: false, opacity: 0 }), []);
  const wire = useMemo(() => new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, depthWrite: false, opacity: 0, toneMapped: false }), []);
  const group = useRef<THREE.Group>(null);
  const prev = useRef<TriageStatus>(visual.status);
  const pulseStart = useRef<number | null>(null);

  useEffect(() => {
    if (visual.status === 'red' && prev.current !== 'red') pulseStart.current = performance.now();
    prev.current = visual.status;
  }, [visual.status]);

  const color = statusColor(visual.status);
  const alarm = visual.status === 'red' || visual.status === 'yellow';
  const baseEmissive = visual.status === 'red' ? 0.55 : visual.status === 'yellow' ? 0.4 : 0.12;

  useFrame(() => {
    mat.color.set(color);
    mat.emissive.set(color);
    wire.color.set(visual.highlighted && !alarm ? '#DCE6F1' : color);
    let e = baseEmissive + (visual.highlighted ? 0.25 : 0);
    let s = 1;
    if (pulseStart.current !== null) {
      // single attention pulse (1.2 s) when a zone turns RED — then steady, no blinking
      const t = (performance.now() - pulseStart.current) / 1200;
      if (t >= 1) pulseStart.current = null;
      else { const k = Math.sin(t * Math.PI); e += k * 0.9; s = 1 + k * 0.08; }
    }
    mat.emissiveIntensity = e;
    // cross-fade between layers instead of popping
    const fillTarget = visual.visible ? visual.opacity * (alarm ? 0.55 : 0.24) : 0;
    const wireTarget = visual.visible ? visual.opacity * (alarm ? 0.55 : visual.highlighted ? 0.6 : 0.12) : 0;
    mat.opacity += (fillTarget - mat.opacity) * 0.15;
    wire.opacity += (wireTarget - wire.opacity) * 0.15;
    if (group.current) {
      group.current.scale.setScalar(s);
      group.current.visible = visual.visible || wire.opacity > 0.02;
    }
  });

  const handlers = raycastable && visual.visible ? {
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(id); },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(id); document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { onHover(null); document.body.style.cursor = 'auto'; },
  } : {};

  return (
    <group ref={group} name={id} userData={{ zone_id: id }} {...handlers}>
      <WireCtx.Provider value={wire}>{children(mat)}</WireCtx.Provider>
    </group>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Organ({ mat, status, ...props }: { mat: THREE.Material; status: TriageStatus; position: V3; scale?: V3; rotation?: V3; geom: React.ReactNode }) {
  const wire = useContext(WireCtx);
  return (
    <group position={props.position} scale={props.scale} rotation={props.rotation}>
      <mesh material={mat}>{props.geom}</mesh>
      {wire && <mesh material={wire} raycast={() => null}>{props.geom}</mesh>}
    </group>
  );
}

export function ProceduralTwin({ visuals, onSelect, onHover, shellOpacity = 1, layerMode = 'all', body = null, onPeel = () => undefined, painPick = false, anatomy = null }: {
  visuals: Record<ZoneId, ZoneVisual>; onSelect: (z: ZoneId) => void; onHover: (z: ZoneId | null) => void; shellOpacity?: number;
  layerMode?: LayerMode; body?: THREE.BufferGeometry | null; onPeel?: () => void; painPick?: boolean; anatomy?: AnatomyPart[] | null;
}) {
  // with the FBX loaded, the muscle layer is the écorché body; the primitive muscles remain for X-ray mode
  const ecorche = !!body && layerMode === 'muscles';
  const G = (id: ZoneId, render: (m: THREE.MeshStandardMaterial, st: TriageStatus) => React.ReactNode, opts?: { raycastable?: boolean }) => {
    // the detailed anatomy model replaces the primitive organs/bones/muscles (the skin pedestal ring stays)
    if (anatomy && id !== 'skin_immune') return null;
    const vis = ecorche && (id === 'muscles_arms' || id === 'muscles_legs') ? { ...visuals[id], visible: false } : visuals[id];
    return (
      <ZoneGroup key={id} id={id} visual={vis} onSelect={onSelect} onHover={onHover} raycastable={opts?.raycastable}>
        {(m) => render(m, visuals[id].status)}
      </ZoneGroup>
    );
  };

  const spinePts = useMemo(() => Array.from({ length: 24 }, (_, i) => {
    const y = 0.93 + (i / 23) * 0.62;
    return [0, y, spineZ(y)] as V3;
  }), []);

  const shell = layerMode === 'skin' ? 0 : layerMode === 'muscles' ? 0.35 : shellOpacity;
  const showSkull = layerMode === 'skeleton';

  return (
    <group>
      <BodyShell opacity={shell} body={body} />
      {body && <SkinLayer body={body} shown={layerMode === 'skin'} skinStatus={visuals.skin_immune.status} onPeel={onPeel} onPick={onSelect} painPick={painPick} />}
      {anatomy && <AnatomyLayers parts={anatomy} mode={layerMode} visuals={visuals} onSelect={onSelect} onHover={onHover} onPeel={onPeel} />}
      {body && !anatomy && <MuscleLayer body={body} shown={layerMode === 'muscles'} onSelect={onSelect} onHover={onHover} onPeel={onPeel}
        arms={{ status: visuals.muscles_arms.status, highlighted: visuals.muscles_arms.highlighted }}
        legs={{ status: visuals.muscles_legs.status, highlighted: visuals.muscles_legs.highlighted }} />}
      {layerMode === 'skin' && <Hotspots visuals={visuals} onSelect={onSelect} />}

      {G('brain', (m, st) => <Organ mat={m} status={st} position={[0, 1.672, 0.012]} scale={[0.92, 0.8, 1.0]} geom={<icosahedronGeometry args={[0.078, 2]} />} />)}
      {G('eyes', (m, st) => <>
        {sides.map((s) => <Organ key={s} mat={m} status={st} position={[0.033 * s, 1.627, 0.095]} geom={<sphereGeometry args={[0.016, 16, 12]} />} />)}
      </>)}
      {G('inner_ear', (m, st) => <>
        {sides.map((s) => <Organ key={s} mat={m} status={st} position={[0.075 * s, 1.615, 0.005]} rotation={[0, Math.PI / 2, 0]} geom={<torusGeometry args={[0.013, 0.005, 8, 20]} />} />)}
      </>)}
      {G('lungs', (m, st) => <>
        <Organ mat={m} status={st} position={[0.078, 1.31, -0.005]} scale={[0.92, 1.7, 1.05]} geom={<sphereGeometry args={[0.065, 20, 16]} />} />
        <Organ mat={m} status={st} position={[-0.082, 1.31, -0.005]} scale={[0.97, 1.7, 1.05]} geom={<sphereGeometry args={[0.065, 20, 16]} />} />
      </>)}
      {G('heart', (m, st) => <Organ mat={m} status={st} position={[0.025, 1.265, 0.05]} rotation={[0, 0, -0.45]} scale={[0.9, 1.15, 0.85]} geom={<sphereGeometry args={[0.045, 20, 16]} />} />)}
      {G('liver', (m, st) => <Organ mat={m} status={st} position={[-0.065, 1.155, 0.03]} rotation={[0, 0, 0.25]} scale={[1.6, 0.7, 0.95]} geom={<sphereGeometry args={[0.056, 18, 12]} />} />)}
      {G('stomach_gi', (m, st) => <>
        <Organ mat={m} status={st} position={[0.06, 1.14, 0.04]} rotation={[0, 0, 0.6]} scale={[1.3, 0.8, 0.8]} geom={<sphereGeometry args={[0.04, 16, 12]} />} />
        <Organ mat={m} status={st} position={[0, 1.0, 0.035]} rotation={[Math.PI / 2, 0, 0]} geom={<torusGeometry args={[0.058, 0.02, 10, 24]} />} />
      </>)}
      {G('pancreas', (m, st) => <Organ mat={m} status={st} position={[0.02, 1.1, 0.0]} rotation={[0, 0, Math.PI / 2 - 0.2]} geom={<capsuleGeometry args={[0.012, 0.08, 4, 10]} />} />)}
      {G('kidneys', (m, st) => <>
        <Organ mat={m} status={st} position={[0.066, 1.1, -0.03]} scale={[0.6, 1, 0.6]} geom={<sphereGeometry args={[0.035, 16, 12]} />} />
        <Organ mat={m} status={st} position={[-0.066, 1.085, -0.03]} scale={[0.6, 1, 0.6]} geom={<sphereGeometry args={[0.035, 16, 12]} />} />
      </>)}
      {G('spine', (m, st) => <>{spinePts.map((p, i) => <Organ key={i} mat={m} status={st} position={p} geom={<cylinderGeometry args={[0.014 + i * 0.0003, 0.014 + i * 0.0003, 0.017, 10]} />} />)}</>)}
      {G('skeleton_upper', (m, st) => <>
        {showSkull && <>
          <Organ mat={m} status={st} position={[0, 1.668, 0.01]} scale={[0.96, 0.92, 1.12]} geom={<sphereGeometry args={[0.088, 24, 18]} />} />
          <Organ mat={m} status={st} position={[0, 1.572, 0.03]} rotation={[Math.PI / 2 + 0.25, 0, 0]} geom={<torusGeometry args={[0.048, 0.009, 6, 20, Math.PI]} />} />
        </>}
        {[[1.4, 0.11], [1.35, 0.125], [1.3, 0.132], [1.25, 0.132], [1.2, 0.128], [1.15, 0.12]].map(([y, r]) => (
          <Organ key={y} mat={m} status={st} position={[0, y, -0.015]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.8, 1]} geom={<torusGeometry args={[r, 0.005, 6, 32]} />} />
        ))}
        {sides.map((s) => (
          <group key={s}>
            <Segment a={[0.02 * s, 1.435, 0.055]} b={[0.165 * s, 1.43, -0.015]} r={0.008} kind="cylinder" material={m} />
            <Segment a={side(s, J.shoulder)} b={side(s, J.elbow)} r={0.013} kind="cylinder" material={m} />
            <Segment a={side(s, J.elbow)} b={side(s, J.wrist)} r={0.01} kind="cylinder" material={m} />
            <Segment a={side(s, J.wrist)} b={side(s, J.hand)} r={0.008} kind="cylinder" material={m} />
          </group>
        ))}
      </>)}
      {G('skeleton_lower', (m, st) => <>
        <Organ mat={m} status={st} position={[0, 0.92, -0.01]} rotation={[Math.PI / 2 - 0.2, 0, 0]} scale={[1.2, 0.8, 1]} geom={<torusGeometry args={[0.088, 0.018, 8, 28]} />} />
        {sides.map((s) => (
          <group key={s}>
            <Segment a={side(s, J.hip)} b={side(s, lerp3(J.hip, J.knee, 0.92))} r={0.016} kind="cylinder" material={m} />
            <Segment a={side(s, lerp3(J.knee, J.ankle, 0.08))} b={side(s, J.ankle)} r={0.012} kind="cylinder" material={m} />
            <Segment a={side(s, J.ankle)} b={side(s, J.toe)} r={0.011} kind="cylinder" material={m} />
          </group>
        ))}
      </>)}
      {G('knees', (m, st) => <>
        {sides.map((s) => <Organ key={s} mat={m} status={st} position={side(s, [J.knee[0], J.knee[1], J.knee[2] + 0.025])} geom={<sphereGeometry args={[0.033, 16, 12]} />} />)}
      </>)}
      {G('muscles_arms', (m) => <>{sides.map((s) => (
        <group key={s}>
          <Segment a={side(s, lerp3(J.shoulder, J.elbow, 0.12))} b={side(s, lerp3(J.shoulder, J.elbow, 0.85))} r={0.034} material={m} />
          <Segment a={side(s, lerp3(J.elbow, J.wrist, 0.1))} b={side(s, lerp3(J.elbow, J.wrist, 0.7))} r={0.028} material={m} />
        </group>
      ))}</>)}
      {G('muscles_legs', (m) => <>{sides.map((s) => (
        <group key={s}>
          <Segment a={side(s, lerp3(J.hip, J.knee, 0.15))} b={side(s, lerp3(J.hip, J.knee, 0.85))} r={0.055} material={m} />
          <Segment a={side(s, lerp3(J.knee, J.ankle, 0.15))} b={side(s, lerp3(J.knee, J.ankle, 0.6))} r={0.04} material={m} />
        </group>
      ))}</>)}
      {/* skin / immune / radiation: a clickable pedestal ring + (X-ray only) an aura around the body */}
      {G('skin_immune', (m, st) => <>
        {/* torus (not a flat ring): screen-space outlines break on planar geometry */}
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m}>
          <torusGeometry args={[0.42, 0.018, 10, 72]} />
        </mesh>
        {layerMode === 'all' && <AuraShell status={st} body={body} />}
      </>)}
    </group>
  );
}

function AuraShell({ status, body }: { status: TriageStatus; body: THREE.BufferGeometry | null }) {
  const m = useHoloMaterial(statusColor(status), status === 'green' ? 0.25 : 0.8);
  if (body) return <mesh geometry={body} material={m} scale={[1.05, 1.012, 1.07]} raycast={() => null} />;
  return (
    <group scale={[1.06, 1.015, 1.08]} raycast={() => null}>
      <mesh position={[0, 1.22, -0.005]} scale={[1.15, 1, 0.82]} material={m} raycast={() => null}><capsuleGeometry args={[0.155, 0.3, 8, 24]} /></mesh>
      <mesh position={[0, 1.645, 0.02]} scale={[0.82, 1.05, 1]} material={m} raycast={() => null}><sphereGeometry args={[0.112, 24, 16]} /></mesh>
    </group>
  );
}

export function ZoneLabel({ position, status, text }: { position: V3; status: TriageStatus; text: string }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <Html position={position} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      {/* anchor dot + leader line + label */}
      <svg width="40" height="22" className="absolute -left-[4px] -top-[18px] overflow-visible" aria-hidden>
        <circle cx="4" cy="18" r="3.5" fill={m.color} />
        <polyline points="6,16 18,5 40,5" fill="none" stroke={m.color} strokeOpacity="0.7" strokeWidth="1.25" />
      </svg>
      <div className="absolute left-[38px] top-[-25px] flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-xs shadow-lg"
        style={{ background: 'rgba(27,39,56,0.95)', boxShadow: `inset 2px 0 0 ${m.color}` }}>
        <Icon size={13} color={m.color} />
        <span className="num max-w-[200px] truncate text-[#F5F7FA]" title={text}>{text}</span>
      </div>
    </Html>
  );
}
