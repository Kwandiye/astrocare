'use client';
import * as THREE from 'three';

/**
 * Loads the user-supplied body mesh (public/models/astronaut_body.fbx) and normalises it into the twin frame:
 * metres, y-up, feet at y=0, head top at BODY_HEIGHT, centred on x, torso centred on z, facing +z.
 * The anatomy in ProceduralTwin (joints, organs, bones) was fitted to this frame (see scripts/fbxinfo.mjs).
 *
 * Adds a per-vertex `aRegion` attribute used by the muscle layer: 0 = torso/head, 1 = arms, 2 = legs & back.
 */
export const BODY_URL = '/models/astronaut_body.fbx';
export const BODY_HEIGHT = 1.755;
const Z_OFFSET = 0.075; // torso centre of this model sits at z ≈ −0.075 after scaling

export const REGION = { torso: 0, arms: 1, legsBack: 2 } as const;

/** Boundary between torso and the (A-pose) arm at height y, in |x| metres. */
function armBoundary(y: number) {
  if (y >= 1.25) return 0.185;
  if (y >= 0.95) return 0.185 + ((1.25 - y) / 0.3) * 0.035;
  return 0.3;
}

export function regionOf(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  if (y > 0.76 && y < 1.47 && ax > armBoundary(y)) return REGION.arms;
  if (y < 0.86) return REGION.legsBack;
  if (z < -0.045 && y < 1.45) return REGION.legsBack; // back muscles
  return REGION.torso;
}

let cache: Promise<THREE.BufferGeometry> | null = null;

export function loadBodyGeometry(url = BODY_URL): Promise<THREE.BufferGeometry> {
  if (cache) return cache;
  cache = (async () => {
    const [{ FBXLoader }, { mergeGeometries, mergeVertices }] = await Promise.all([
      import('three/examples/jsm/loaders/FBXLoader.js'),
      import('three/examples/jsm/utils/BufferGeometryUtils.js'),
    ]);
    const root = await new FBXLoader().loadAsync(url);
    root.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', m.geometry.getAttribute('position').clone());
      if (m.geometry.index) g.setIndex(m.geometry.index.clone());
      g.applyMatrix4(m.matrixWorld);
      parts.push(g);
    });
    if (!parts.length) throw new Error('FBX has no meshes');
    let geo = parts.length === 1 ? parts[0] : mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;

    geo.computeBoundingBox();
    const b = geo.boundingBox!;
    const s = BODY_HEIGHT / (b.max.y - b.min.y);
    geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, 0);
    geo.scale(s, s, s);
    geo.translate(0, 0, Z_OFFSET);

    // weld split vertices so normals are smooth (needed for the muscle inset and the Fresnel rim)
    geo = mergeVertices(geo, 1e-5);
    geo.computeVertexNormals();

    const pos = geo.getAttribute('position');
    const region = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) region[i] = regionOf(pos.getX(i), pos.getY(i), pos.getZ(i));
    geo.setAttribute('aRegion', new THREE.BufferAttribute(region, 1));
    geo.computeBoundingSphere();
    return geo;
  })();
  cache.catch(() => { cache = null; });
  return cache;
}
