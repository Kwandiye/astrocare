'use client';
import * as THREE from 'three';
import type { ZoneId } from '@/types/health';

/**
 * Detailed anatomy (muscles, organs, skeleton) built by scripts/blender/build_anatomy.py from the
 * Z-Anatomy atlas (CC BY-SA 4.0, z-anatomy.com; geometry from BodyParts3D, DBCLS, CC BY-SA 2.1 JP).
 * One mesh per (layer, zone) with anatomical vertex colours; fitted to astronaut_body.fbx in the twin frame.
 */
export const ANATOMY_URL = '/models/astronaut_anatomy.glb';
export type AnatomyLayer = 'muscle' | 'organ' | 'bone';
export interface AnatomyPart { layer: AnatomyLayer; zone: ZoneId | 'muscles_other'; geometry: THREE.BufferGeometry }

let cache: Promise<AnatomyPart[]> | null = null;

export function loadAnatomy(url = ANATOMY_URL): Promise<AnatomyPart[]> {
  if (cache) return cache;
  cache = (async () => {
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok) throw new Error(`anatomy model missing (${head.status})`);
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(url);
    gltf.scene.updateMatrixWorld(true);
    const parts: AnatomyPart[] = [];
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // extras live on the node (or its parent for multi-primitive meshes)
      const ud = { ...(m.parent?.userData ?? {}), ...m.userData };
      const [layerFromName, zoneFromName] = (m.name || m.parent?.name || '').split('__');
      const layer = (ud.layer ?? layerFromName) as AnatomyLayer;
      const zone = (ud.zone_id ?? zoneFromName) as AnatomyPart['zone'];
      if (!layer || !zone) return;
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      g.computeBoundingSphere();
      parts.push({ layer, zone, geometry: g });
    });
    if (!parts.length) throw new Error('anatomy model has no tagged meshes');
    return parts;
  })();
  cache.catch(() => { cache = null; });
  return cache;
}
