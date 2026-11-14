"""Probe Z-Anatomy naming and landmark bounds.
Run: blender -b --disable-autoexec <Startup.blend> --python scripts/blender/probe_zanatomy.py -- <out.txt>"""
import bpy, sys, re
from mathutils import Vector
from collections import Counter

out = open(sys.argv[sys.argv.index('--') + 1], 'w', encoding='utf-8')
def p(*a): print(*a, file=out)

def wb(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(v.x for v in pts), min(v.y for v in pts), min(v.z for v in pts)))
    hi = Vector((max(v.x for v in pts), max(v.y for v in pts), max(v.z for v in pts)))
    return lo, hi

def fmt(v): return '(' + ', '.join(f'{x:.3f}' for x in v) + ')'

top = {c.name: c for c in bpy.context.scene.collection.children}
for name, c in top.items():
    meshes = [o for o in c.all_objects if o.type == 'MESH']
    p(f'== {name}: {len(meshes)} meshes')
    p('   suffixes:', Counter(re.sub(r'^.*?(\.[a-z]+|\.\d+)?$', r'\1', o.name) for o in meshes).most_common(6))
    p('   sample:', [o.name for o in meshes[:25]])
    p('   hidden:', sum(1 for o in meshes if o.hide_get() or o.hide_render), ' with modifiers:', sum(1 for o in meshes if o.modifiers))
    mats = Counter(s.material.name for o in meshes[:400] for s in o.material_slots if s.material)
    p('   materials:', mats.most_common(10))

keys = ['humerus', 'radius', 'ulna', 'femur', 'tibia', 'patella', 'sternum', 'hip bone', 'frontal bone', 'occipital bone', 'talus',
        'clavicle', 'scapula', 'sacrum', 'heart', 'lung', 'liver', 'stomach', 'kidney', 'pancreas', 'brain', 'cerebrum', 'eyeball',
        'small intestine', 'large intestine', 'colon', 'spleen', 'cochlea', 'semicircular', 'deltoid', 'biceps', 'quadriceps', 'rectus femoris',
        'gastrocnemius', 'pectoralis major', 'trapezius', 'latissimus', 'gluteus maximus', 'rectus abdominis', 'phalan', 'metacarp']
p('\n== landmarks (name: lo -> hi, verts)')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for k in keys:
    hits = [o for o in meshes if k in o.name.lower()][:6]
    for o in hits:
        lo, hi = wb(o)
        p(f'{k:18s} | {o.name:40s} | {fmt(lo)} -> {fmt(hi)} | v={len(o.data.vertices)} | coll={o.users_collection[0].name if o.users_collection else "-"}')
out.close()
print('PROBE DONE')
