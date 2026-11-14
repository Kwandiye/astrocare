"""
Build public/models/astronaut_anatomy.glb from the Z-Anatomy atlas (CC BY-SA 4.0, https://www.z-anatomy.com,
based on BodyParts3D © The Database Center for Life Science, CC BY-SA 2.1 JP).

Pipeline
  1. select real anatomy meshes (skip label lines .j/.i/.g, insertions, sheets), map each to an AstroCare zone
  2. re-pose: rotate arms about the shoulder and legs about the hip to match the A-pose of astronaut_body.fbx
  3. bake an anatomical colour per face into a vertex-colour attribute (muscle red / tendon white / bone ivory / organs)
  4. merge per (layer, zone), decimate to a web budget, export GLB with extras {layer, zone_id}
  5. write zone anchors (centroids) as JSON for the app, and optional preview renders

Run (Blender 4.2+/5.x):
  blender -b --disable-autoexec <Startup.blend> --python scripts/blender/build_anatomy.py -- --out public/models/astronaut_anatomy.glb [--dry] [--render DIR] [--fbx public/models/astronaut_body.fbx]
"""
import bpy, bmesh, sys, os, re, json, math, random, argparse
from mathutils import Vector, Matrix
from collections import defaultdict

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True)
ap.add_argument('--dry', action='store_true')
ap.add_argument('--render', default=None)
ap.add_argument('--fbx', default=None)
ap.add_argument('--arm-deg', type=float, default=19.0)
ap.add_argument('--leg-deg', type=float, default=7.0)
ap.add_argument('--budget', type=float, default=1.0, help='multiplier on triangle budgets')
args = ap.parse_args(argv)
random.seed(7)
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)  # so the progress file can be written from the start

# ---------------------------------------------------------------- progress (read by scripts/blender/progress.ps1)
import time
_T0 = time.time()
_PHASES = [('select', 0.05), ('bake', 0.50), ('merge', 0.15), ('decimate', 0.20), ('export', 0.10)]
def report(phase, frac=0.0):
    done = 0.0
    for name, w in _PHASES:
        if name == phase: done += w * max(0.0, min(1.0, frac)); break
        done += w
    el = time.time() - _T0
    eta = el / done - el if done > 0.02 else None
    try:
        with open(os.path.abspath(args.out) + '.progress.json', 'w') as f:
            json.dump({'phase': phase, 'pct': round(done * 100, 1), 'elapsed_s': round(el), 'eta_s': round(eta) if eta else None}, f)
    except OSError:
        pass
report('select')

# ---------------------------------------------------------------- selection
SOURCE = ['1: Skeletal system', '3: Joints', '4: Muscular system', '5: Cardiovascular system', '6: Lymphoid organs',
          '7: Nervous system & Sense organs', '8: Visceral systems']
LABEL_SUFFIX = re.compile(r'\.(j|i|g|e\d*[lr]?|o\d*[lr]?|el|er|ol|or)$')
MIN_VERTS = 30

def has(n, *keys): return any(k in n for k in keys)

def classify(o, coll):
    """-> (layer, zone) or None"""
    n = o.name.lower()
    c = centre(o)
    if coll == '1: Skeletal system':
        if has(n, 'sinus', 'tooth', 'teeth', 'incisor', 'canine', 'molar', 'premolar'): return ('bone', 'skeleton_upper') if 'sinus' not in n else None
        if has(n, 'vertebra', 'atlas', 'sacrum', 'coccyx', 'intervertebral'): return ('bone', 'spine')
        if 'patella' in n: return ('bone', 'knees')
        if c.z < 0.95 and (has(n, 'hip bone', 'femur', 'tibia', 'fibula', 'talus', 'calcane', 'navicular', 'cuboid', 'cuneiform', 'metatars', 'sesamoid')
                           or (c.z < 0.25 and has(n, 'phalan', 'phalanx'))): return ('bone', 'skeleton_lower')
        if c.z < 0.25: return ('bone', 'skeleton_lower')
        return ('bone', 'skeleton_upper')
    if coll == '3: Joints':
        if has(n, 'meniscus', 'menisci') or (has(n, 'cruciate', 'patellar ligament') and 0.35 < c.z < 0.55): return ('bone', 'knees')
        return None
    if coll == '4: Muscular system':
        if has(n, 'bursa', 'sheath', 'retinaculum', 'fascia'): return None
        # Z-Anatomy shows superficial fascia on one side only (teaching layer) — it would cover half the body
        if any(s.material and 'fascia' in s.material.name.lower() for s in o.material_slots): return None
        ax = abs(c.x)
        if ax > 0.17 and 0.6 < c.z < 1.43: return ('muscle', 'muscles_arms')
        if c.z < 0.95 or (c.y > 0.03 and c.z < 1.5): return ('muscle', 'muscles_legs')
        return ('muscle', 'muscles_other')
    if coll == '5: Cardiovascular system':
        if 0.95 < c.z < 1.40 and abs(c.x) < 0.13 and -0.15 < c.y < 0.06: return ('organ', 'heart')
        return None
    if coll == '6: Lymphoid organs':
        return ('organ', 'skin_immune') if 'spleen' in n and 'impression' not in n else None
    if coll == '7: Nervous system & Sense organs':
        if has(n, 'cochlea', 'semicircular', 'vestibul', 'labyrinth', 'utricle', 'saccule'): return ('organ', 'inner_ear')
        if has(n, 'eyeball', 'cornea', 'sclera', 'lens', 'iris', 'retina', 'vitreous'): return ('organ', 'eyes')
        if has(n, 'dura', 'falx', 'tentorium', 'arachnoid', 'pia', 'meninge', 'choroid plexus', 'nerve', 'ganglion', 'spinal', 'ventricle', 'aqueduct', 'cistern'): return None
        if c.z > 1.5 and abs(c.x) < 0.09 and -0.1 < c.y < 0.13: return ('organ', 'brain')
        return None
    if coll == '8: Visceral systems':
        if has(n, 'peritone', 'mesocolon', 'mesentery', 'omentum', 'fascia', 'ligament', 'mucosa', 'sac', 'fold', 'recess', 'pouch', 'fossa', 'tunica'): return None
        if has(n, 'lung', 'trachea', 'bronch', 'pleura'): return ('organ', 'lungs')
        if has(n, 'liver', 'gallbladder', 'gall bladder', 'bile duct'): return ('organ', 'liver')
        if 'pancrea' in n: return ('organ', 'pancreas')
        if has(n, 'kidney', 'ureter', 'urinary bladder', 'suprarenal', 'adrenal'): return ('organ', 'kidneys')
        if has(n, 'stomach', 'duoden', 'jejun', 'ileum', 'intestin', 'colon', 'caecum', 'cecum', 'rectum', 'appendix', 'oesophag', 'esophag', 'pylor', 'cardia'):
            return ('organ', 'stomach_gi')
        return None
    return None

# ---------------------------------------------------------------- colours (linear-ish sRGB tuples)
def hexc(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
ORGAN_COL = {'heart': '#9C2E28', 'lungs': '#D98C88', 'liver': '#7B2B24', 'pancreas': '#E0B07C', 'kidneys': '#8A3A30',
             'skin_immune': '#7A3346', 'brain': '#D9A9A2', 'eyes': '#ECE8DF', 'inner_ear': '#E3D2AE'}
BONE, CART, TEETH = hexc('#E4D6B8'), hexc('#CBD8D5'), hexc('#F2EEE4')
MUSCLE, TENDON = hexc('#A8443A'), hexc('#ECE4D6')

def face_colour(layer, zone, objname, matname):
    m = (matname or '').lower(); n = objname.lower()
    if layer == 'bone':
        if 'cartilage' in m or 'cartilage' in n or 'menisc' in n: return CART
        if 'teeth' in m or 'tooth' in n: return TEETH
        return BONE
    if layer == 'muscle':
        if has(m, 'tendon', 'fascia', 'aponeur') or has(n, 'tendon', 'aponeurosis', 'fascia', 'linea alba'): return TENDON
        return MUSCLE
    if zone == 'stomach_gi':
        return hexc('#D9967E') if 'stomach' in n or 'oesoph' in n or 'esoph' in n else hexc('#D3A577')
    if zone == 'lungs' and has(n, 'trachea', 'bronch'): return hexc('#E8D2C2')
    if zone == 'kidneys' and 'bladder' in n: return hexc('#C98D7A')
    if zone == 'liver' and 'gall' in n: return hexc('#5E7A3A')
    return hexc(ORGAN_COL[zone])

# ---------------------------------------------------------------- helpers
def centre(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return sum(pts, Vector()) / 8

def unhide_all():
    def walk(lc):
        lc.exclude = False; lc.hide_viewport = False
        lc.collection.hide_viewport = False; lc.collection.hide_render = False
        for ch in lc.children: walk(ch)
    walk(bpy.context.view_layer.layer_collection)
    for o in bpy.data.objects:
        o.hide_viewport = False; o.hide_render = False
        try: o.hide_set(False)
        except RuntimeError: pass

def rot_about(pivot, axis, deg):
    return Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation(-pivot)

SHOULDER = {+1: Vector((0.166, 0.04, 1.37)), -1: Vector((-0.166, 0.04, 1.37))}
HIP = {+1: Vector((0.10, 0.0, 0.91)), -1: Vector((-0.10, 0.0, 0.91))}

def pose_matrix(c):
    """Rigid re-pose for limb parts, keyed on the part's centre."""
    s = 1 if c.x >= 0 else -1
    if abs(c.x) > 0.17 and 0.6 < c.z < 1.43:                    # free upper limb
        return rot_about(SHOULDER[s], 'Y', -s * args.arm_deg)
    if c.z < 0.86 and abs(c.x) > 0.025:                          # free lower limb
        return rot_about(HIP[s], 'Y', -s * args.leg_deg)
    return Matrix.Identity(4)

# ---------------------------------------------------------------- main
unhide_all()
dg = bpy.context.evaluated_depsgraph_get()
picked, seen = [], set()
for cname in SOURCE:
    coll = bpy.data.collections.get(cname)
    if not coll: print('missing collection', cname); continue
    for o in coll.all_objects:
        if o.type != 'MESH' or o.name in seen or LABEL_SUFFIX.search(o.name.lower()): continue
        seen.add(o.name)
        if len(o.data.vertices) < MIN_VERTS: continue
        lz = classify(o, cname)
        if lz: picked.append((o, cname, lz))

stats = defaultdict(lambda: [0, 0])
for o, _, (layer, zone) in picked:
    stats[(layer, zone)][0] += 1; stats[(layer, zone)][1] += len(o.data.polygons)
print('\n=== selection')
for k in sorted(stats): print(f'{k[0]:7s} {k[1]:16s} objects={stats[k][0]:5d} faces={stats[k][1]:8d}')

if args.dry:
    unmatched = sorted({o.name for o in bpy.data.collections['8: Visceral systems'].all_objects
                        if o.type == 'MESH' and len(o.data.vertices) >= MIN_VERTS and not LABEL_SUFFIX.search(o.name.lower())}
                       - {o.name for o, _, _ in picked})
    print('unmatched visceral:', unmatched[:80])
    print('DRY DONE'); sys.exit(0)

# 1) bake each picked object into a new world-space mesh with per-corner colours, re-posed
groups = defaultdict(list)
scratch = bpy.data.collections.new('AC_build'); bpy.context.scene.collection.children.link(scratch)
for i, (o, cname, (layer, zone)) in enumerate(picked):
    ev = o.evaluated_get(dg)
    try:
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=False, depsgraph=dg)
    except RuntimeError:
        continue
    if len(me.polygons) == 0: bpy.data.meshes.remove(me); continue
    c = centre(o)
    me.transform(pose_matrix(c) @ o.matrix_world)
    mats = [s.material.name if s.material else '' for s in o.material_slots]
    attr = me.color_attributes.new(name='Col', type='BYTE_COLOR', domain='CORNER')
    jitter = 1.0 + (random.random() - 0.5) * (0.16 if layer == 'muscle' else 0.06)   # separate neighbouring muscles visually
    for p in me.polygons:
        mname = mats[p.material_index] if p.material_index < len(mats) else ''
        r, g, b = face_colour(layer, zone, o.name, mname)
        col = (min(1, r * jitter), min(1, g * jitter), min(1, b * jitter), 1.0)
        for li in p.loop_indices: attr.data[li].color = col
    me.materials.clear()
    ob = bpy.data.objects.new(f'{layer}__{zone}__{i}', me)
    scratch.objects.link(ob)
    groups[(layer, zone)].append(ob)
    if i % 50 == 0: report('bake', i / len(picked)); print('baked', i, '/', len(picked))

# drop the source scene so only our build remains
for c in list(bpy.context.scene.collection.children):
    if c != scratch: bpy.context.scene.collection.children.unlink(c)

# 2) merge per group
merged = {}
for gi, ((layer, zone), obs) in enumerate(groups.items()):
    report('merge', gi / len(groups))
    with bpy.context.temp_override(active_object=obs[0], object=obs[0], selected_objects=obs, selected_editable_objects=obs):
        bpy.ops.object.join()
    m = obs[0]; m.name = f'{layer}__{zone}'; m.data.name = m.name
    m.data.validate(clean_customdata=False)
    merged[(layer, zone)] = m

# 3) decimate to budget (triangles per layer)
BUDGET = {'muscle': 170_000, 'bone': 100_000, 'organ': 70_000}
tris = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
for li, (layer, budget) in enumerate(BUDGET.items()):
    report('decimate', li / len(BUDGET))
    obs = [o for (l, _), o in merged.items() if l == layer]
    total = sum(tris(o) for o in obs) or 1
    ratio = min(1.0, budget * args.budget / total)
    for o in obs:
        r = ratio
        if o.name == 'organ__brain': r = min(1.0, 22_000 / max(1, tris(o)))
        if r < 0.999:
            mod = o.modifiers.new('dec', 'DECIMATE'); mod.ratio = r; mod.use_collapse_triangulate = True
            with bpy.context.temp_override(active_object=o, object=o):
                bpy.ops.object.modifier_apply(modifier='dec')
        # smooth normals
        for p in o.data.polygons: p.use_smooth = True
    print(f'{layer}: {total} tris -> {sum(tris(o) for o in obs)} (ratio {ratio:.3f})')

# 4) material (vertex colours drive the look) + extras
mat = bpy.data.materials.new('Anatomy'); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes.get('Principled BSDF')
vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.55
anchors = {}
for (layer, zone), o in merged.items():
    o.data.materials.append(mat)
    o['layer'] = layer; o['zone_id'] = zone
    if layer != 'muscle' or zone != 'muscles_other':
        pts = [v.co for v in o.data.vertices]
        cen = sum(pts, Vector()) / len(pts)
        anchors.setdefault(zone, []).append((len(pts), cen))

# anchors in three.js frame (x, z, -y)
anchor_out = {}
for zone, lst in anchors.items():
    n = sum(k for k, _ in lst); cen = sum((c * k for k, c in lst), Vector()) / n
    anchor_out[zone] = [round(cen.x, 3), round(cen.z, 3), round(-cen.y, 3)]
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
with open(os.path.splitext(args.out)[0] + '.anchors.json', 'w') as f: json.dump(anchor_out, f, indent=1)

# 5) export
report('export')
bpy.ops.object.select_all(action='DESELECT')
for o in merged.values(): o.select_set(True)
kw = dict(filepath=os.path.abspath(args.out), export_format='GLB', use_selection=True, export_extras=True, export_apply=True,
          export_yup=True, export_materials='EXPORT', export_normals=True, export_texcoords=False)
for extra in ({'export_vertex_color': 'ACTIVE'}, {'export_colors': True}, {}):
    try:
        bpy.ops.export_scene.gltf(**kw, **extra); break
    except TypeError:
        continue
print('EXPORTED', args.out, os.path.getsize(args.out) // 1024, 'KB')
report('export', 1.0)

# 6) optional preview renders with the skin reference
if args.render:
    os.makedirs(args.render, exist_ok=True)
    sc = bpy.context.scene
    if args.fbx:
        bpy.ops.import_scene.fbx(filepath=os.path.abspath(args.fbx))
        skin = [o for o in bpy.context.selected_objects if o.type == 'MESH'][0]
        bpy.context.view_layer.update()
        ws = [skin.matrix_world @ Vector(c) for c in skin.bound_box]
        lo = Vector((min(v.x for v in ws), min(v.y for v in ws), min(v.z for v in ws)))
        hi = Vector((max(v.x for v in ws), max(v.y for v in ws), max(v.z for v in ws)))
        s = 1.755 / (hi.z - lo.z)
        # same normalisation as src/lib/bodyModel.ts (three: x centred, feet at 0, z += 0.075  ->  blender y -= 0.075)
        skin.matrix_world = Matrix.Translation(Vector((0, -0.075, 0))) @ Matrix.Scale(s, 4) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, 0, -lo.z))) @ skin.matrix_world
        sm = bpy.data.materials.new('SkinRef'); sm.use_nodes = True
        b = sm.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value = (0.4, 0.6, 1.0, 1)
        b.inputs['Alpha'].default_value = 0.18
        try: sm.surface_render_method = 'BLENDED'
        except Exception: sm.blend_method = 'BLEND'
        skin.data.materials.clear(); skin.data.materials.append(sm)
    sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 700, 1000
    sc.render.film_transparent = False
    world = sc.world or bpy.data.worlds.new('W'); sc.world = world
    world.use_nodes = True; world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.05, 0.07, 0.12, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    light = bpy.data.objects.new('Key', bpy.data.lights.new('Key', 'SUN')); light.data.energy = 3.5
    light.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(light)
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.95
    views = {'front': ((0, -4, 0.9), (math.radians(90), 0, 0)), 'side': ((4, 0, 0.9), (math.radians(90), 0, math.radians(90)))}
    show = {'all': None, 'muscle': 'muscle', 'bone': 'bone', 'organ': 'organ'}
    for vname, (loc, rot) in views.items():
        cam.location = loc; cam.rotation_euler = rot
        for sname, lay in show.items():
            if vname == 'side' and sname != 'all': continue
            for (l, _), o in merged.items(): o.hide_render = lay is not None and l != lay
            sc.render.filepath = os.path.join(args.render, f'{vname}_{sname}.png')
            bpy.ops.render.render(write_still=True)
    print('RENDERED', args.render)
print('BUILD DONE')
