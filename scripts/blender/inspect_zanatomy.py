"""Dump the structure of the Z-Anatomy .blend (collections, mesh counts, bounds) to JSON.
Run: blender -b --disable-autoexec <Startup.blend> --python scripts/blender/inspect_zanatomy.py -- <out.json>"""
import bpy, sys, json
from mathutils import Vector

out = sys.argv[sys.argv.index('--') + 1]

def coll_info(c, depth=0):
    meshes = [o for o in c.objects if o.type == 'MESH']
    verts = sum(len(o.data.vertices) for o in meshes)
    d = {'name': c.name, 'objects': len(c.objects), 'meshes': len(meshes), 'verts': verts,
         'sample': [o.name for o in meshes[:12]], 'children': []}
    if depth < 4:
        d['children'] = [coll_info(ch, depth + 1) for ch in c.children]
    return d

allm = [o for o in bpy.data.objects if o.type == 'MESH']
lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
for o in allm:
    for corner in o.bound_box:
        w = o.matrix_world @ Vector(corner)
        lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
info = {
    'scenes': [s.name for s in bpy.data.scenes],
    'n_mesh_objects': len(allm),
    'total_verts': sum(len(o.data.vertices) for o in allm),
    'bounds': [list(lo), list(hi)],
    'unit_scale': bpy.context.scene.unit_settings.scale_length,
    'materials': len(bpy.data.materials),
    'images': [i.name for i in bpy.data.images][:40],
    'tree': coll_info(bpy.context.scene.collection),
}
with open(out, 'w', encoding='utf-8') as f:
    json.dump(info, f, indent=1, ensure_ascii=False)
print('WROTE', out)
