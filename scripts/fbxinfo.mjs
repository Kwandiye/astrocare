// Dev helper: prints landmarks of public/models/astronaut_body.fbx after normalising to the twin frame
// (feet at y=0, head top at TARGET_H, centred on x, facing +z). Usage: node scripts/fbxinfo.mjs <file.fbx>
import fs from 'node:fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

globalThis.window = { innerWidth: 1, innerHeight: 1 };
const TARGET_H = 1.755;
const buf = fs.readFileSync(process.argv[2]);
const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
obj.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(obj);
const s = TARGET_H / (box.max.y - box.min.y);
const pts = [];
obj.traverse((o) => {
  if (!o.isMesh) return;
  const p = o.geometry.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); pts.push([(v.x - (box.min.x + box.max.x) / 2) * s, (v.y - box.min.y) * s, v.z * s]); }
});
console.log('scale', s, 'offset', -(box.min.x + box.max.x) / 2 * s, -box.min.y * s);
const f = (n) => n.toFixed(3);
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const step = 0.025;
for (let y = 0; y < TARGET_H; y += step) {
  const sl = pts.filter((p) => p[1] >= y && p[1] < y + step);
  if (!sl.length) continue;
  // split into connected x-runs (torso / legs / arms) using 1 cm bins on positive side
  const bins = new Map();
  for (const p of sl) if (p[0] >= 0) { const k = Math.floor(p[0] / 0.01); (bins.get(k) ?? bins.set(k, []).get(k)).push(p); }
  const keys = [...bins.keys()].sort((a, b) => a - b);
  const runs = []; let cur = [];
  for (const k of keys) { if (cur.length && k - cur[cur.length - 1] > 1) { runs.push(cur); cur = []; } cur.push(k); }
  if (cur.length) runs.push(cur);
  const desc = runs.map((r) => {
    const ps = r.flatMap((k) => bins.get(k));
    const zs = ps.map((p) => p[2]);
    return `[x ${f(r[0] / 100)}..${f((r[r.length - 1] + 1) / 100)} z ${f(Math.min(...zs))}..${f(Math.max(...zs))} c(${f(mean(ps.map((p) => p[0])))},${f(mean(zs))})]`;
  }).join(' ');
  console.log(f(y), desc);
}
