"""
Tiny Glade style zone — procedural scene builder (Blender 4.4, EEVEE Next).

Single source of truth for the zone: terrain, pond, aqueduct bridge, castle,
path, rocks, trees (billboard leaf cards with spherical custom normals),
ducks, lily pads, camera and sun. It:

  1. generates the leaf-clump textures   -> ../tiny_glade/textures/*.png
  2. builds + animates the Blender scene -> blender/tiny_glade.blend
  3. exports geometry for Godot          -> ../tiny_glade/models/tiny_glade_geo.glb
  4. (optional) renders a still          -> blender/renders/preview_blender.png

Run (from this folder):
  /Applications/Blender.app/Contents/MacOS/Blender -b -P build_tiny_glade.py            # build + export
  /Applications/Blender.app/Contents/MacOS/Blender -b -P build_tiny_glade.py -- render  # + render still

Coordinates: Blender Z-up, camera looks north (+Y). glTF export turns this
into Godot's Y-up / -Z forward automatically.
"""

import bpy, bmesh, math, os, random, sys
import numpy as np
from mathutils import Vector, Matrix, Euler, noise

HERE = os.path.dirname(os.path.abspath(__file__))
ZONE = os.path.normpath(os.path.join(HERE, "..", "tiny_glade"))
TEX_DIR = os.path.join(ZONE, "textures")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

RNG = random.Random(7)

# --------------------------------------------------------------------------
# Layout (metres). Everything else is derived from these.
# --------------------------------------------------------------------------
WATER_Z = -0.6
POND_C = Vector((-4.8, -2.4))
POND_R = (8.6, 5.4)
BRIDGE_A = Vector((-13.8, 6.4))      # far / castle end
BRIDGE_B = Vector((10.2, -6.0))      # near / right end
DECK_Z = 2.2
RAMP_LEN = 3.6                       # cobbled ramps down from each bridge end
BRIDGE_W = 2.2
CASTLE_C = Vector((-4.2, 14.8))
CHANNEL = (Vector((-0.4, 1.4)), Vector((7.4, -2.6)), 1.15)
CAM_POS = Vector((3.2, -20.5, 15.2))
CAM_TARGET = Vector((-2.2, 5.4, -0.4))
SUN_ELEV, SUN_AZIM = math.radians(27), math.radians(38)   # azimuth from +Y toward +X

# sRGB-ish palette (converted to linear where stored as vertex colour)
PAL = {
    "orange": (0.86, 0.50, 0.24), "rust": (0.72, 0.36, 0.19),
    "ochre":  (0.84, 0.68, 0.32), "lime": (0.66, 0.70, 0.30),
    "green":  (0.40, 0.60, 0.27), "sage": (0.50, 0.64, 0.38),
    "peach":  (0.90, 0.60, 0.36),
}

# (x, y, height, canopy radius, palette, kind)
TREES = [
    # foreground right, big + blurred
    (9.6, -10.2, 8.6, 3.9, "orange", "tree"), (17.0, -2.6, 8.8, 3.3, "orange", "tree"),
    (15.6, -11.6, 7.2, 2.8, "rust", "tree"),
    # foreground bush right under the camera (heavily defocused)
    (2.2, -12.4, 3.6, 2.6, "sage", "bush"),
    # left flank
    (-19.8, 2.6, 6.2, 2.9, "orange", "tree"), (-19.4, 11.2, 5.6, 2.5, "lime", "tree"),
    (-21.5, 13.0, 6.6, 2.8, "orange", "tree"), (-15.6, 15.6, 5.2, 2.3, "ochre", "tree"),
    (-12.4, 18.6, 3.2, 2.2, "ochre", "bush"), (-24.5, -4.0, 6.0, 3.0, "rust", "tree"),
    (-22.0, -10.5, 5.6, 2.8, "orange", "tree"), (-26.5, 6.8, 6.4, 2.8, "peach", "tree"),
    # behind the castle
    (-9.4, 21.4, 6.4, 2.5, "orange", "tree"), (-1.6, 21.6, 5.8, 2.4, "green", "tree"),
    (2.6, 18.6, 6.6, 2.4, "green", "tree"), (4.8, 23.4, 4.4, 1.9, "green", "tree"),
    # right middle
    (7.0, 10.8, 6.2, 2.6, "orange", "tree"), (13.2, 20.8, 6.4, 2.4, "orange", "tree"),
    (17.5, 18.6, 6.8, 2.6, "peach", "tree"), (10.8, 25.5, 5.8, 2.3, "green", "tree"),
    (21.5, 25.0, 6.0, 2.4, "sage", "tree"), (21.0, 8.4, 6.6, 2.7, "lime", "tree"),
    (25.0, 14.5, 7.0, 2.8, "orange", "tree"),
]
# distant tree line (fades into haze)
_r = random.Random(11)
for i in range(30):
    x = -42 + i * 2.9 + _r.uniform(-1.2, 1.2)
    y = _r.uniform(29, 44)
    if abs(x) < 7 and y < 32:
        y += 5
    TREES.append((x, y, _r.uniform(5.5, 8.0), _r.uniform(2.2, 3.0),
                  _r.choice(["orange", "rust", "green", "lime", "ochre", "sage", "orange"]), "far"))

SHEEP = [((-2.6, -8.2), 0.4), ((-1.0, -8.7), -0.3)]
DUCKS = [(-10.5, -1.0), (-6.4, 0.6), (-8.5, -5.4)]


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def srgb_to_lin(c):
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


def pond_sdf(x, y):
    p = Vector((x, y)) - POND_C
    a = math.atan2(p.y, p.x)
    r = 1 + 0.12 * math.sin(3 * a + 0.5) + 0.07 * math.sin(5 * a + 1.7) + 0.05 * math.sin(2 * a - 0.8)
    q = math.hypot(p.x / POND_R[0], p.y / POND_R[1])
    return (q - r) * min(POND_R) * 1.1


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length, t


def path_points(n=40):
    """Cobbled path: bridge far end -> castle gate (cubic bezier)."""
    u = (BRIDGE_B - BRIDGE_A).normalized()
    p0 = BRIDGE_A - u * (RAMP_LEN + 0.6)          # starts at the foot of the far ramp
    p1, p2, p3 = Vector((-15.0, 11.6)), Vector((-8.6, 12.4)), CASTLE_C + Vector((0.2, -1.2))
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append(((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3)
    return pts


PATH = path_points()


def path_dist(p):
    return min(seg_dist(p, PATH[i], PATH[i + 1])[0] for i in range(len(PATH) - 1))


def ground_h(x, y):
    """Analytic ground height (before pond carving)."""
    v = Vector((x * 0.045, y * 0.045, 0.3))
    h = 0.35 + 0.55 * noise.noise(v) + 0.22 * noise.noise(Vector((x * 0.12, y * 0.12, 4.1))) \
        + 0.06 * noise.noise(Vector((x * 0.45, y * 0.45, 9.3)))
    # gentle rise into the distance, castle mound, bridge abutment mounds
    h += 0.018 * max(0.0, y - 8)
    h += 1.25 * math.exp(-((x - CASTLE_C.x) ** 2 + (y - CASTLE_C.y) ** 2) / 55.0)
    h += 1.55 * math.exp(-((x - BRIDGE_A.x) ** 2 + (y - BRIDGE_A.y) ** 2) / 16.0)
    h += 1.9 * math.exp(-((x - BRIDGE_B.x) ** 2 + (y - BRIDGE_B.y) ** 2) / 11.0)
    h = max(h, WATER_Z + 0.45)
    return h


def terrain_h(x, y):
    h = ground_h(x, y)
    d = pond_sdf(x, y)
    s = 1.0 - smoothstep(0.0, 3.2, d)
    bed = WATER_Z - 0.22 - 1.1 * smoothstep(0.0, 5.0, -d)
    h = h * (1 - s) + bed * s
    # grassy lip that overhangs the water a little
    h += 0.16 * math.exp(-((d - 0.9) / 0.6) ** 2)
    # dry sunken channel running under the bridge's right half
    cd, _ = seg_dist(Vector((x, y)), CHANNEL[0], CHANNEL[1])
    c = 1.0 - smoothstep(CHANNEL[2] * 0.4, CHANNEL[2] * 1.6, cd)
    h = h * (1 - c) + (WATER_Z + 0.2) * c
    return h


def new_obj(name, mesh, coll=None, parent=None):
    ob = bpy.data.objects.new(name, mesh)
    (coll or EXPORT).objects.link(ob)
    if parent:
        ob.parent = parent
    return ob


def bm_to_obj(bm, name, mat, coll=None, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if isinstance(mat, (list, tuple)):
        for m in mat:
            me.materials.append(m)
    elif mat:
        me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = smooth
    return new_obj(name, me, coll)


def add_box(bm, center, size, rot_z=0.0, mat_index=0):
    r = bmesh.ops.create_cube(bm, size=1.0)
    m = Matrix.Translation(center) @ Matrix.Rotation(rot_z, 4, 'Z') @ Matrix.Diagonal((*size, 1))
    bmesh.ops.transform(bm, matrix=m, verts=r["verts"])
    for f in {f for v in r["verts"] for f in v.link_faces}:
        f.material_index = mat_index
    return r["verts"]


def add_cyl(bm, center, r1, r2, h, segs=24, mat_index=0, cap=True):
    r = bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=segs,
                              radius1=r1, radius2=r2, depth=h, calc_uvs=True)
    bmesh.ops.translate(bm, vec=center + Vector((0, 0, h / 2)), verts=r["verts"])
    for f in {f for v in r["verts"] for f in v.link_faces}:
        f.material_index = mat_index
    return r["verts"]


def apply_modifiers(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    old = ob.data
    ob.data = me
    bpy.data.meshes.remove(old)


def soften(ob, voxel=0.09, amp=0.07, scale=1.1, fine_amp=0.02):
    """Hand-built look: voxel-remesh (unions overlapping parts, rounds every hard edge
    a little and gives an even mesh to deform), then push the surface around with two
    octaves of world-space noise so silhouettes wobble. Materials are preserved."""
    mats = list(ob.data.materials)
    rm = ob.modifiers.new("remesh", 'REMESH')
    rm.mode, rm.voxel_size, rm.use_smooth_shade = 'VOXEL', voxel, True
    for i, (a, sc) in enumerate(((amp, scale), (fine_amp, scale * 0.22))):
        tex = bpy.data.textures.new(f"wobble_{ob.name}_{i}", 'CLOUDS')
        tex.noise_scale, tex.noise_depth = sc, 2
        d = ob.modifiers.new(f"wobble{i}", 'DISPLACE')
        d.texture, d.texture_coords, d.strength, d.mid_level = tex, 'GLOBAL', a, 0.5
    apply_modifiers(ob)
    if not ob.data.materials:
        for m in mats:
            ob.data.materials.append(m)
    for p in ob.data.polygons:
        p.use_smooth = True


# --------------------------------------------------------------------------
# Leaf textures (numpy painter)
# --------------------------------------------------------------------------
def paint_leaf_clump(path, seed, size=512, n=120, single=False):
    rng = np.random.default_rng(seed)
    S = size * 2
    rgb = np.zeros((S, S, 3), np.float32)
    a = np.zeros((S, S), np.float32)
    ys, xs = np.mgrid[0:S, 0:S]
    X = (xs + 0.5) / S * 2 - 1
    Y = (ys + 0.5) / S * 2 - 1
    leaves = []
    if single:
        leaves.append((0.0, 0.0, math.pi / 2, 0.86, 0.36, 1.0, 0.0))
    else:
        for _ in range(n):
            rr = 0.74 * math.sqrt(rng.random()) ** 0.8
            th = rng.random() * math.tau
            cx, cy = rr * math.cos(th), rr * math.sin(th) * 0.92
            ang = th + rng.normal(0, 0.55) if rr > 0.12 else rng.random() * math.tau
            L = rng.uniform(0.15, 0.23)
            W = L * rng.uniform(0.40, 0.52)
            val = rng.uniform(0.70, 1.0) * (0.72 + 0.28 * min(1, rr / 0.7))
            hue = rng.normal(0, 0.05)
            leaves.append((cx, cy, ang, L, W, val, hue))
        leaves.sort(key=lambda l: math.hypot(l[0], l[1]) + 0.25 * l[1])   # inner/lower first
    for cx, cy, ang, L, W, val, hue in leaves:
        pad = L + 0.02
        x0, x1 = int(max(0, (cx - pad + 1) / 2 * S)), int(min(S, (cx + pad + 1) / 2 * S) + 1)
        y0, y1 = int(max(0, (cy - pad + 1) / 2 * S)), int(min(S, (cy + pad + 1) / 2 * S) + 1)
        sx, sy = X[y0:y1, x0:x1] - cx, Y[y0:y1, x0:x1] - cy
        c, s = math.cos(ang), math.sin(ang)
        u = (sx * c + sy * s) / L
        v = (-sx * s + sy * c) / W
        # asymmetric leaf: round base, pointed tip
        prof = np.clip(1 - u * u, 0, 1) ** 0.75 * (1 - 0.35 * np.clip(u, 0, 1))
        m = (np.abs(v) < prof) & (np.abs(u) < 1)
        shade = val * (0.86 + 0.14 * u) * (1 - 0.18 * np.exp(-(v * 7) ** 2))
        shade = shade * (0.9 + 0.1 * np.abs(v))
        col = np.stack([shade * (1 + hue), shade, shade * (1 - hue) * 0.94], -1)
        rgb[y0:y1, x0:x1][m] = col[m]
        a[y0:y1, x0:x1][m] = 1.0
    # 2x2 box downsample (premultiplied) then bleed colour into empty texels
    rgb = (rgb * a[..., None]).reshape(size, 2, size, 2, 3).mean((1, 3))
    a = a.reshape(size, 2, size, 2).mean((1, 3))
    mean = rgb[a > 0.5].mean(0) / max(1e-4, a[a > 0.5].mean())
    rgb = np.where(a[..., None] > 1e-4, rgb / np.maximum(a[..., None], 1e-4), mean)
    img = np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1)
    name = os.path.basename(path)
    im = bpy.data.images.get(name) or bpy.data.images.new(name, size, size, alpha=True)
    im.pixels.foreach_set(img[::-1].reshape(-1).astype(np.float32))  # blender rows start at bottom
    im.filepath_raw = path
    im.file_format = 'PNG'
    im.save()
    return im


# --------------------------------------------------------------------------
# Materials (Blender side). Godot swaps these for its own shaders by name.
# --------------------------------------------------------------------------
def mat_new(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (600, 0)
    return m, nt, out


def mat_simple(name, color, rough=0.8, sss=0.0):
    m, nt, out = mat_new(name)
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (*srgb_to_lin(color), 1)
    b.inputs["Roughness"].default_value = rough
    if sss:
        b.inputs["Subsurface Weight"].default_value = sss
        b.inputs["Subsurface Radius"].default_value = (0.3, 0.2, 0.15)
    nt.links.new(b.outputs[0], out.inputs[0])
    m.diffuse_color = (*srgb_to_lin(color), 1)
    return m


def N(nt, kind, loc, **inputs):
    n = nt.nodes.new(kind)
    n.location = loc
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def ramp(nt, loc, stops):
    r = nt.nodes.new("ShaderNodeValToRGB")
    r.location = loc
    els = r.color_ramp.elements
    while len(els) > len(stops):
        els.remove(els[-1])
    while len(els) < len(stops):
        els.new(0.5)
    for e, (pos, col) in zip(els, stops):
        e.position = pos
        e.color = (*srgb_to_lin(col), 1)
    return r


def mat_terrain():
    m, nt, out = mat_new("TG_Terrain")
    L = nt.links
    b = N(nt, "ShaderNodeBsdfPrincipled", (300, 0), Roughness=0.95)
    b.inputs["Specular IOR Level"].default_value = 0.2
    ca = nt.nodes.new("ShaderNodeVertexColor"); ca.layer_name = "Col"; ca.location = (-900, -300)
    sep = N(nt, "ShaderNodeSeparateColor", (-700, -300)); L.new(ca.outputs[0], sep.inputs[0])
    tc = nt.nodes.new("ShaderNodeTexCoord"); tc.location = (-1200, 200)
    n1 = N(nt, "ShaderNodeTexNoise", (-900, 200), Scale=0.08, Detail=3.0, Roughness=0.55)
    L.new(tc.outputs["Object"], n1.inputs["Vector"])
    g = ramp(nt, (-650, 200), [(0.30, (0.34, 0.48, 0.24)), (0.52, (0.46, 0.60, 0.30)), (0.72, (0.62, 0.68, 0.36))])
    L.new(n1.outputs["Fac"], g.inputs[0])
    dirt = N(nt, "ShaderNodeMix", (-300, 100)); dirt.data_type = 'RGBA'
    dirt.inputs["B"].default_value = (*srgb_to_lin((0.42, 0.33, 0.24)), 1)
    L.new(sep.outputs[2], dirt.inputs["Factor"]); L.new(g.outputs[0], dirt.inputs["A"])
    L.new(dirt.outputs["Result"], b.inputs["Base Color"])
    L.new(b.outputs[0], out.inputs[0])
    return m


def mat_stone(name, base, dark, scale=1.6, mortar=0.035):
    m, nt, out = mat_new(name)
    L = nt.links
    b = N(nt, "ShaderNodeBsdfPrincipled", (300, 0), Roughness=0.9)
    tc = nt.nodes.new("ShaderNodeTexCoord"); tc.location = (-1300, 0)
    sep = N(nt, "ShaderNodeSeparateXYZ", (-1100, 0)); L.new(tc.outputs["Object"], sep.inputs[0])
    add = N(nt, "ShaderNodeMath", (-900, 100)); add.operation = 'ADD'
    L.new(sep.outputs[0], add.inputs[0]); L.new(sep.outputs[1], add.inputs[1])
    cmb = N(nt, "ShaderNodeCombineXYZ", (-700, 0))
    L.new(add.outputs[0], cmb.inputs[0]); L.new(sep.outputs[2], cmb.inputs[1])
    br = N(nt, "ShaderNodeTexBrick", (-450, 0), Scale=scale, **{"Mortar Size": mortar, "Bias": 0.0})
    br.inputs["Color1"].default_value = (*srgb_to_lin(base), 1)
    br.inputs["Color2"].default_value = (*srgb_to_lin(dark), 1)
    br.inputs["Mortar"].default_value = (*srgb_to_lin(tuple(c * 0.62 for c in dark)), 1)
    br.inputs["Brick Width"].default_value = 0.55
    br.inputs["Row Height"].default_value = 0.26
    br.offset = 0.5
    L.new(cmb.outputs[0], br.inputs["Vector"])
    L.new(br.outputs["Color"], b.inputs["Base Color"])
    bump = N(nt, "ShaderNodeBump", (0, -250), Strength=0.35)
    inv = N(nt, "ShaderNodeMath", (-200, -250)); inv.operation = 'SUBTRACT'
    inv.inputs[0].default_value = 1.0; L.new(br.outputs["Fac"], inv.inputs[1])
    L.new(inv.outputs[0], bump.inputs["Height"]); L.new(bump.outputs[0], b.inputs["Normal"])
    L.new(b.outputs[0], out.inputs[0])
    m.diffuse_color = (*srgb_to_lin(base), 1)
    return m


def mat_water():
    m, nt, out = mat_new("TG_Water")
    L = nt.links
    b = N(nt, "ShaderNodeBsdfPrincipled", (300, 0), Roughness=0.04, IOR=1.33)
    ca = nt.nodes.new("ShaderNodeVertexColor"); ca.layer_name = "Col"; ca.location = (-700, 100)
    sep = N(nt, "ShaderNodeSeparateColor", (-500, 100)); L.new(ca.outputs[0], sep.inputs[0])
    r = ramp(nt, (-250, 100), [(0.0, (0.40, 0.44, 0.40)), (0.12, (0.22, 0.27, 0.34)), (0.6, (0.12, 0.15, 0.24))])
    L.new(sep.outputs[0], r.inputs[0]); L.new(r.outputs[0], b.inputs["Base Color"])
    tc = nt.nodes.new("ShaderNodeTexCoord"); tc.location = (-900, -300)
    nz = N(nt, "ShaderNodeTexNoise", (-500, -300), Scale=1.6, Detail=4.0)
    nz.noise_dimensions = '4D'
    L.new(tc.outputs["Object"], nz.inputs["Vector"])
    fc = nz.inputs["W"].driver_add("default_value")
    fc.driver.expression = "frame / 90"
    bump = N(nt, "ShaderNodeBump", (0, -300), Strength=0.08)
    L.new(nz.outputs["Fac"], bump.inputs["Height"]); L.new(bump.outputs[0], b.inputs["Normal"])
    L.new(b.outputs[0], out.inputs[0])
    return m


def mat_leaves(name, img):
    m, nt, out = mat_new(name)
    L = nt.links
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img; tex.location = (-700, 0)
    ca = nt.nodes.new("ShaderNodeVertexColor"); ca.layer_name = "Col"; ca.location = (-700, -300)
    mul = N(nt, "ShaderNodeMix", (-350, 0)); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'
    mul.inputs["Factor"].default_value = 1.0
    L.new(tex.outputs["Color"], mul.inputs["A"]); L.new(ca.outputs["Color"], mul.inputs["B"])
    diff = N(nt, "ShaderNodeBsdfDiffuse", (0, 100))
    tr = N(nt, "ShaderNodeBsdfTranslucent", (0, -50))
    L.new(mul.outputs["Result"], diff.inputs["Color"]); L.new(mul.outputs["Result"], tr.inputs["Color"])
    mix = N(nt, "ShaderNodeMixShader", (200, 0), Fac=0.3)
    L.new(diff.outputs[0], mix.inputs[1]); L.new(tr.outputs[0], mix.inputs[2])
    tp = N(nt, "ShaderNodeBsdfTransparent", (200, 150))
    gt = N(nt, "ShaderNodeMath", (0, 250)); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.45
    L.new(tex.outputs["Alpha"], gt.inputs[0])
    am = N(nt, "ShaderNodeMixShader", (400, 0))
    L.new(gt.outputs[0], am.inputs[0]); L.new(tp.outputs[0], am.inputs[1]); L.new(mix.outputs[0], am.inputs[2])
    L.new(am.outputs[0], out.inputs[0])
    m.surface_render_method = 'DITHERED'
    m.use_transparent_shadow = True
    m.use_backface_culling = False
    return m


def mat_grass():
    m, nt, out = mat_new("TG_GrassBlade")
    L = nt.links
    tc = nt.nodes.new("ShaderNodeTexCoord"); tc.location = (-900, 0)
    sep = N(nt, "ShaderNodeSeparateXYZ", (-700, 0)); L.new(tc.outputs["UV"], sep.inputs[0])
    pi = nt.nodes.new("ShaderNodeParticleInfo"); pi.location = (-900, -250)
    geo = nt.nodes.new("ShaderNodeNewGeometry"); geo.location = (-1100, -450)
    nz = N(nt, "ShaderNodeTexNoise", (-900, -450), Scale=0.08, Detail=2.0)
    L.new(geo.outputs["Position"], nz.inputs["Vector"])
    base = ramp(nt, (-600, -350), [(0.3, (0.30, 0.44, 0.20)), (0.55, (0.40, 0.56, 0.26)), (0.75, (0.54, 0.62, 0.30))])
    L.new(nz.outputs["Fac"], base.inputs[0])
    tip = N(nt, "ShaderNodeMix", (-300, -150)); tip.data_type = 'RGBA'
    L.new(sep.outputs[1], tip.inputs["Factor"]); L.new(base.outputs[0], tip.inputs["A"])
    tipc = ramp(nt, (-600, -600), [(0.0, (0.60, 0.70, 0.38)), (1.0, (0.76, 0.76, 0.46))])
    L.new(pi.outputs["Random"], tipc.inputs[0]); L.new(tipc.outputs[0], tip.inputs["B"])
    dk = N(nt, "ShaderNodeMix", (-100, -150)); dk.data_type = 'RGBA'; dk.blend_type = 'MULTIPLY'
    pw = N(nt, "ShaderNodeMath", (-300, 100)); pw.operation = 'POWER'; pw.inputs[1].default_value = 0.6
    L.new(sep.outputs[1], pw.inputs[0])
    L.new(tip.outputs["Result"], dk.inputs["A"])
    ao = N(nt, "ShaderNodeMapRange", (-100, 100)); ao.inputs["To Min"].default_value = 0.55
    L.new(pw.outputs[0], ao.inputs[0])
    dk.inputs["Factor"].default_value = 1.0
    cmb = N(nt, "ShaderNodeCombineColor", (50, 100))
    for i in range(3):
        L.new(ao.outputs[0], cmb.inputs[i])
    L.new(cmb.outputs[0], dk.inputs["B"])
    diff = N(nt, "ShaderNodeBsdfDiffuse", (200, 100)); tr = N(nt, "ShaderNodeBsdfTranslucent", (200, -50))
    L.new(dk.outputs["Result"], diff.inputs["Color"]); L.new(dk.outputs["Result"], tr.inputs["Color"])
    mix = N(nt, "ShaderNodeMixShader", (400, 0), Fac=0.25)
    L.new(diff.outputs[0], mix.inputs[1]); L.new(tr.outputs[0], mix.inputs[2])
    L.new(mix.outputs[0], out.inputs[0])
    m.use_backface_culling = False
    return m


# --------------------------------------------------------------------------
# Scene reset
# --------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "TinyGlade"
EXPORT = bpy.data.collections.new("Export"); scene.collection.children.link(EXPORT)
LIB = bpy.data.collections.new("InstanceSources"); scene.collection.children.link(LIB)

os.makedirs(TEX_DIR, exist_ok=True)
leaf_a = paint_leaf_clump(os.path.join(TEX_DIR, "leaf_clump_a.png"), 3)
leaf_b = paint_leaf_clump(os.path.join(TEX_DIR, "leaf_clump_b.png"), 17, n=90)
paint_leaf_clump(os.path.join(TEX_DIR, "leaf_single.png"), 5, size=128, single=True)

M = {
    "terrain": mat_terrain(),
    "water": mat_water(),
    "stone": mat_stone("TG_Stone", (0.86, 0.70, 0.52), (0.80, 0.56, 0.44)),
    "castle": mat_stone("TG_CastleStone", (0.86, 0.72, 0.56), (0.78, 0.58, 0.46), scale=2.2),
    "cobble": mat_stone("TG_Cobble", (0.82, 0.78, 0.70), (0.72, 0.68, 0.62), scale=5.0, mortar=0.05),
    "roof": mat_simple("TG_Roof", (0.70, 0.40, 0.22), 0.75),
    "wood": mat_simple("TG_Wood", (0.36, 0.23, 0.15), 0.8),
    "dark": mat_simple("TG_Opening", (0.10, 0.08, 0.07), 1.0),
    "rock": mat_simple("TG_Rock", (0.46, 0.46, 0.48), 0.85),
    "bark": mat_simple("TG_Bark", (0.20, 0.15, 0.12), 0.9),
    "leaves_a": mat_leaves("TG_Leaves", leaf_a),
    "leaves_b": mat_leaves("TG_LeavesB", leaf_b),
    "wool": mat_simple("TG_Wool", (0.95, 0.93, 0.88), 1.0, sss=0.25),
    "skin": mat_simple("TG_SheepFace", (0.20, 0.18, 0.17), 0.8),
    "duck_body": mat_simple("TG_DuckBody", (0.52, 0.40, 0.30), 0.7),
    "duck_head": mat_simple("TG_DuckHead", (0.14, 0.36, 0.22), 0.4),
    "beak": mat_simple("TG_Beak", (0.95, 0.66, 0.20), 0.5),
    "lily": mat_simple("TG_LilyPad", (0.46, 0.62, 0.30), 0.6),
    "lilyflower": mat_simple("TG_LilyFlower", (0.98, 0.80, 0.86), 0.6),
    "grass": mat_grass(),
}

# --------------------------------------------------------------------------
# Terrain (vertex colours: R grass density, G flower density, B dirt/wet)
# --------------------------------------------------------------------------
def build_terrain():
    X0, X1, Y0, Y1, step = -60.0, 60.0, -32.0, 66.0, 0.5
    nx, ny = int((X1 - X0) / step) + 1, int((Y1 - Y0) / step) + 1
    verts, cols, faces = [], [], []
    for j in range(ny):
        y = Y0 + j * step
        for i in range(nx):
            x = X0 + i * step
            z = terrain_h(x, y)
            verts.append((x, y, z))
            d = pond_sdf(x, y)
            p = Vector((x, y))
            pd = path_dist(p)
            cd, _ = seg_dist(p, CHANNEL[0], CHANNEL[1])
            wet = 1 - smoothstep(-0.2, 0.6, z - WATER_Z)
            dirt = max(1 - smoothstep(0.9, 2.0, pd), (1 - smoothstep(0.0, CHANNEL[2] * 0.9, cd)) * 0.9, wet)
            grass = (1 - smoothstep(0.05, 0.25, WATER_Z + 0.08 - z)) * smoothstep(1.1, 1.8, pd) * (1 - 0.7 * (1 - smoothstep(0.0, CHANNEL[2] * 0.8, cd)))
            fl = max(0.0, noise.noise(Vector((x * 0.13, y * 0.13, 2.2))) * 1.6 + 0.25) * grass
            cols.append((grass, min(1.0, fl), dirt, 1.0))
    for j in range(ny - 1):
        for i in range(nx - 1):
            a = j * nx + i
            faces.append((a, a + 1, a + nx + 1, a + nx))
    me = bpy.data.meshes.new("Terrain")
    me.from_pydata(verts, [], faces)
    ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    ca.data.foreach_set("color", np.array(cols, np.float32).ravel())
    me.color_attributes.active_color = ca
    me.materials.append(M["terrain"])
    for p in me.polygons:
        p.use_smooth = True
    ob = new_obj("Terrain", me)
    vg_g = ob.vertex_groups.new(name="grass")
    vg_f = ob.vertex_groups.new(name="flowers")
    cam2 = Vector((CAM_POS.x, CAM_POS.y))
    for idx, (v, c) in enumerate(zip(verts, cols)):
        dist = (Vector((v[0], v[1])) - cam2).length
        near = 1.0 - smoothstep(26, 60, dist)
        if c[0] * near > 0.01:
            vg_g.add([idx], c[0] * near, 'REPLACE')
        if c[1] * near > 0.01:
            vg_f.add([idx], c[1] * near, 'REPLACE')
    return ob


def build_water():
    step = 0.35
    X0, X1 = POND_C.x - POND_R[0] * 1.4, POND_C.x + POND_R[0] * 1.4
    Y0, Y1 = POND_C.y - POND_R[1] * 1.5, POND_C.y + POND_R[1] * 1.5
    bm = bmesh.new()
    nx, ny = int((X1 - X0) / step) + 1, int((Y1 - Y0) / step) + 1
    grid = {}
    for j in range(ny):
        for i in range(nx):
            x, y = X0 + i * step, Y0 + j * step
            if pond_sdf(x, y) < 2.2:
                grid[(i, j)] = bm.verts.new((x, y, WATER_Z))
    for (i, j), v in list(grid.items()):
        q = [grid.get((i, j)), grid.get((i + 1, j)), grid.get((i + 1, j + 1)), grid.get((i, j + 1))]
        if all(q):
            bm.faces.new(q)
    ob = bm_to_obj(bm, "Water", M["water"], smooth=True)
    me = ob.data
    ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    data = []
    for v in me.vertices:
        depth = max(0.0, WATER_Z - terrain_h(v.co.x, v.co.y))
        data += [min(1.0, depth / 1.4), 0, 0, 1]
    ca.data.foreach_set("color", data)
    me.color_attributes.active_color = ca
    return ob


# --------------------------------------------------------------------------
# Aqueduct bridge
# --------------------------------------------------------------------------
def build_bridge():
    d = BRIDGE_B - BRIDGE_A
    length, ang = d.length, math.atan2(d.y, d.x)
    mid = (BRIDGE_A + BRIDGE_B) / 2
    base_z = -2.4
    bm = bmesh.new()
    add_box(bm, Vector((0, 0, (DECK_Z + base_z) / 2)), (length, BRIDGE_W, DECK_Z - base_z))
    body = bm_to_obj(bm, "Bridge", M["stone"])
    # arch cutters: half-cylinder + box below
    cut_coll = bpy.data.collections.new("BridgeCutters"); scene.collection.children.link(cut_coll)
    n_arch, span, r = 10, 2.25, 0.82
    spring_z = 0.55
    start = -span * (n_arch - 1) / 2 + 0.6
    for k in range(n_arch):
        x = start + k * span
        cb = bmesh.new()
        v = add_cyl(cb, Vector((0, 0, 0)), r, r, BRIDGE_W + 1.0, segs=28)
        bmesh.ops.rotate(cb, verts=v, cent=Vector((0, 0, (BRIDGE_W + 1.0) / 2)), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
        bmesh.ops.translate(cb, verts=v, vec=Vector((x, 0, spring_z - (BRIDGE_W + 1.0) / 2)))
        add_box(cb, Vector((x, 0, (spring_z + base_z - 1) / 2)), (2 * r, BRIDGE_W + 1.0, spring_z - base_z + 1))
        c = bm_to_obj(cb, f"ArchCut{k}", None, coll=cut_coll)
        c.hide_render = True
    mod = body.modifiers.new("arches", 'BOOLEAN')
    mod.operation, mod.operand_type, mod.solver = 'DIFFERENCE', 'COLLECTION', 'EXACT'
    mod.collection = cut_coll
    apply_modifiers(body)
    for o in list(cut_coll.objects):
        bpy.data.objects.remove(o)
    bpy.data.collections.remove(cut_coll)

    # cornice, parapets with merlons, keystones -> joined into the bridge mesh
    bm = bmesh.new()
    bm.from_mesh(body.data)
    add_box(bm, Vector((0, 0, DECK_Z - 0.08)), (length + 0.1, BRIDGE_W + 0.24, 0.16))
    for side in (-1, 1):
        y = side * (BRIDGE_W / 2 - 0.12)
        add_box(bm, Vector((0, y, DECK_Z + 0.16)), (length, 0.26, 0.34))
        n_m = int(length / 1.5)
        for k in range(n_m):
            x = -length / 2 + 0.35 + k * (length - 0.7) / (n_m - 1)
            add_box(bm, Vector((x, y, DECK_Z + 0.42)), (0.5, 0.3, 0.2 + RNG.uniform(-0.03, 0.03)))
    for k in range(n_arch):
        x = start + k * span
        add_box(bm, Vector((x, 0, spring_z + r + 0.1)), (0.32, BRIDGE_W + 0.04, 0.32))
    # a few loose stones fallen onto the deck
    bm.to_mesh(body.data)
    bm.free()
    body.location = (mid.x, mid.y, 0)
    body.rotation_euler = (0, 0, ang)
    soften(body, voxel=0.09, amp=0.09, scale=1.4)
    # deck cobbles
    bm = bmesh.new()
    add_box(bm, Vector((0, 0, DECK_Z + 0.01)), (length - 0.3, BRIDGE_W - 0.55, 0.04))
    deck = bm_to_obj(bm, "BridgeDeck", M["cobble"])
    deck.location, deck.rotation_euler = body.location, body.rotation_euler
    build_ramps()
    return body


def build_ramps():
    """Stone ramps with a cobbled surface sloping from each deck end to the ground, plus an
    invisible smooth walkway (deck + ramps) that Godot uses for the player's physics, riding
    just above the noise-softened stone so there are no lips to snag on."""
    u3 = (BRIDGE_B - BRIDGE_A).normalized()
    n2 = Vector((-u3.y, u3.x))
    stone, cob, walk = bmesh.new(), bmesh.new(), bmesh.new()

    def hexa(bm, top_a, top_b, half_w, bottom):
        (pa, za), (pb, zb) = top_a, top_b
        v = [bm.verts.new((*(pa + n2 * s * half_w), za)) for s in (-1, 1)] + \
            [bm.verts.new((*(pb + n2 * s * half_w), zb)) for s in (1, -1)]
        w = [bm.verts.new((x.co.x, x.co.y, bottom)) for x in v]
        bm.faces.new(v)
        bm.faces.new(list(reversed(w)))
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((v[j], v[i], w[i], w[j]))

    lift = 0.13
    for end, sgn in ((BRIDGE_A, -1), (BRIDGE_B, 1)):
        foot = end + u3 * sgn * RAMP_LEN
        fz = terrain_h(foot.x, foot.y) - 0.08
        slope = (DECK_Z - fz) / RAMP_LEN
        start = end - u3 * sgn * 0.3                       # tuck into the bridge end
        hexa(stone, (start, DECK_Z), (foot, fz), BRIDGE_W / 2, min(fz, DECK_Z) - 2.5)
        hexa(cob, (start, DECK_Z + 0.03), (foot, fz + 0.03), BRIDGE_W / 2 - 0.3, min(fz, DECK_Z) - 0.2)
        past = foot + u3 * sgn * 0.8                       # bury the walkway end in the ground
        hexa(walk, (end, DECK_Z + lift), (foot, fz + lift), BRIDGE_W / 2 - 0.1, fz - 0.6)
        hexa(walk, (foot, fz + lift), (past, fz - slope * 0.8 + lift), BRIDGE_W / 2 - 0.1, fz - 1.0)
    hexa(walk, (BRIDGE_A, DECK_Z + lift), (BRIDGE_B, DECK_Z + lift), BRIDGE_W / 2 - 0.3, DECK_Z - 0.3)
    for bm in (stone, cob, walk):
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ramps = bm_to_obj(stone, "BridgeRamps", M["stone"])
    soften(ramps, voxel=0.09, amp=0.06, scale=1.4)
    bm_to_obj(cob, "BridgeRampDeck", M["cobble"])
    bm_to_obj(walk, "WalkCollision", None)


# --------------------------------------------------------------------------
# Castle
# --------------------------------------------------------------------------
def build_castle():
    C = CASTLE_C
    rot = math.radians(-16)
    R = Matrix.Rotation(rot, 3, 'Z')
    t1 = C + (R @ Vector((-3.1, 0.7, 0))).to_2d()
    t2 = C + (R @ Vector((3.0, -0.5, 0))).to_2d()
    gz = min(terrain_h(*t1), terrain_h(*t2), terrain_h(*C)) - 0.4
    towers = [(t1, 1.65, 7.2, 3.5), (t2, 1.45, 5.8, 3.1)]
    bm = bmesh.new()
    wbm = bmesh.new()
    roofs = []
    for tp, r, h, rh in towers:
        add_cyl(bm, Vector((tp.x, tp.y, gz)), r * 1.06, r, h, segs=28)
        add_cyl(bm, Vector((tp.x, tp.y, gz + h - 0.05)), r * 1.12, r * 1.12, 0.22, segs=28)
        roofs.append((tp, r * 1.22, gz + h + 0.12, rh))
        # windows
        for wz in (h * 0.55, h * 0.8):
            a = -math.pi / 2 + rot + RNG.uniform(-0.3, 0.3)
            wp = Vector((tp.x + math.cos(a) * (r + 0.02), tp.y + math.sin(a) * (r + 0.02), gz + wz))
            add_box(wbm, wp, (0.3, 0.3, 0.62), rot_z=a)
    body = bm_to_obj(bm, "Castle", M["castle"])
    soften(body, voxel=0.08, amp=0.09, scale=1.3)
    bm_to_obj(wbm, "CastleWindows", M["dark"])
    # wall between the towers, pierced by a simple Roman (semicircular) arch.
    wall_len = (t2 - t1).length
    wa = math.atan2((t2 - t1).y, (t2 - t1).x)
    wc = (t1 + t2) / 2
    wh = 4.2
    # Built directly (no booleans): two piers + a closed spandrel block whose
    # underside follows the semicircle.
    L_w, T = wall_len - 1.2, 1.0
    arch_r, spring = 1.3, 2.1          # opening 2.6 m wide, crown at 3.4 m
    bm = bmesh.new()
    pier = (L_w / 2 - arch_r)
    for sx in (-1, 1):
        add_box(bm, Vector((sx * (arch_r + pier / 2), 0, wh / 2)), (pier, T, wh))
    n = 24
    fr, bk = [], []
    for i in range(n + 1):
        th = math.pi * (1 - i / n)
        x, z = arch_r * math.cos(th), spring + arch_r * math.sin(th)
        fr.append((bm.verts.new((x, -T / 2, z)), bm.verts.new((x, -T / 2, wh))))
        bk.append((bm.verts.new((x, T / 2, z)), bm.verts.new((x, T / 2, wh))))
    for i in range(n):
        bm.faces.new((fr[i][0], fr[i + 1][0], fr[i + 1][1], fr[i][1]))      # front spandrel
        bm.faces.new((bk[i][1], bk[i + 1][1], bk[i + 1][0], bk[i][0]))      # back spandrel
        bm.faces.new((bk[i][0], bk[i + 1][0], fr[i + 1][0], fr[i][0]))      # intrados
        bm.faces.new((fr[i][1], fr[i + 1][1], bk[i + 1][1], bk[i][1]))      # top
    for i in (0, n):
        bm.faces.new((fr[i][0], fr[i][1], bk[i][1], bk[i][0]))              # end caps
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    # cornice + keystone
    add_box(bm, Vector((0, 0, wh + 0.08)), (wall_len - 1.0, 1.2, 0.16))
    add_box(bm, Vector((0, 0, spring + arch_r + 0.12)), (0.38, 1.06, 0.42))
    wall = bm_to_obj(bm, "CastleArch", M["castle"])
    wall.location, wall.rotation_euler = (wc.x, wc.y, gz), (0, 0, wa)
    soften(wall, voxel=0.07, amp=0.07, scale=1.1)
    # conical roofs (separate objects so Godot can find their centres)
    for i, (tp, r, z, rh) in enumerate(roofs):
        bm = bmesh.new()
        add_cyl(bm, Vector((0, 0, 0)), r, 0.02, rh, segs=32)
        # hand-made cone: slightly sagging flanks and a tip that leans
        lean = Vector((RNG.uniform(-1, 1), RNG.uniform(-1, 1), 0)).normalized() * 0.22
        for v in bm.verts:
            t = v.co.z / rh
            v.co += lean * t * t
            v.co.xy *= 1 - 0.07 * math.sin(t * math.pi)
        ob = bm_to_obj(bm, f"Roof{i}", M["roof"], smooth=True)
        ob.location = (tp.x, tp.y, z)
        soften(ob, voxel=0.07, amp=0.1, scale=0.9, fine_amp=0.025)
    return t1, t2, gz


def build_path():
    bm = bmesh.new()
    prev = None
    rows = []
    for i, p in enumerate(PATH):
        a = PATH[min(i + 1, len(PATH) - 1)] - PATH[max(i - 1, 0)]
        nrm = Vector((-a.y, a.x)).normalized()
        w = 1.35 + 0.25 * math.sin(i * 0.7)
        row = []
        for s in (-1.0, -0.5, 0.0, 0.5, 1.0):
            q = p + nrm * s * w
            row.append(bm.verts.new((q.x, q.y, max(terrain_h(q.x, q.y), ground_h(q.x, q.y) - 0.3) + 0.06)))
        rows.append(row)
    for a, b in zip(rows, rows[1:]):
        for k in range(4):
            bm.faces.new((a[k], a[k + 1], b[k + 1], b[k]))
    return bm_to_obj(bm, "Path", M["cobble"], smooth=True)


def rock_mesh(bm, center, scale, rot, seed, cube=False):
    if cube:
        v = add_box(bm, Vector((0, 0, 0)), (1, 1, 1))
        bmesh.ops.bevel(bm, geom=[e for e in bm.edges if e.verts[0] in v and e.verts[1] in v],
                        offset=0.08, segments=2, affect='EDGES')
        v = [x for x in bm.verts if x.tag is False and (x.co.length < 1.2)]
    r = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.5) if not cube else None
    verts = r["verts"] if r else v
    for x in verts:
        if not cube:
            x.co *= 1 + 0.22 * noise.noise(x.co * 2.3 + Vector((seed, seed * 0.3, 0)))
    m = Matrix.Translation(center) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1))
    bmesh.ops.transform(bm, matrix=m, verts=verts)


def build_rocks():
    bm = bmesh.new()
    rng = random.Random(3)
    # shoreline boulders (west side)
    for k in range(10):
        a = math.radians(120 + k * 14 + rng.uniform(-6, 6))
        p = POND_C + Vector((math.cos(a) * POND_R[0] * 1.02, math.sin(a) * POND_R[1] * 1.02))
        s = rng.uniform(0.35, 0.75)
        rock_mesh(bm, Vector((p.x, p.y, terrain_h(p.x, p.y) + s * 0.15)), (s * 1.3, s, s * 0.8),
                  (0, 0, rng.random() * 6), k)
    ob = bm_to_obj(bm, "Rocks", M["rock"], smooth=True)
    # rubble blocks along the channel
    bm = bmesh.new()
    for k in range(11):
        t = rng.uniform(0.1, 0.95)
        p = CHANNEL[0].lerp(CHANNEL[1], t) + Vector((rng.uniform(-1.4, 1.4), rng.uniform(-1.4, 1.4)))
        s = rng.uniform(0.28, 0.55)
        vs = add_box(bm, Vector((p.x, p.y, terrain_h(p.x, p.y) + s * 0.3)), (s * 1.2, s, s * 0.85),
                     rot_z=rng.random() * 3)
        bmesh.ops.rotate(bm, verts=vs, cent=Vector((p.x, p.y, terrain_h(p.x, p.y))),
                         matrix=Euler((rng.uniform(-.3, .3), rng.uniform(-.3, .3), 0)).to_matrix())
    bm_to_obj(bm, "Rubble", M["rock"])
    return ob


# --------------------------------------------------------------------------
# Trees: bent trunk + leaf-card canopy with spherical custom normals
# --------------------------------------------------------------------------
def tube(bm, pts, radii, segs=7):
    rings = []
    for i, (p, r) in enumerate(zip(pts, radii)):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = t.orthogonal().normalized()
        b = t.cross(a)
        rings.append([bm.verts.new(p + (a * math.cos(k / segs * math.tau) + b * math.sin(k / segs * math.tau)) * r)
                      for k in range(segs)])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(segs):
            bm.faces.new((r0[k], r0[(k + 1) % segs], r1[(k + 1) % segs], r1[k]))


def build_tree(idx, x, y, h, cr, pal, kind):
    rng = random.Random(1000 + idx)
    gz = terrain_h(x, y)
    trunk_h = h - cr * 1.45 if kind != "bush" else 0.4
    top = Vector((x + rng.uniform(-0.6, 0.6), y + rng.uniform(-0.6, 0.6), gz + max(trunk_h, 0.4)))
    C = top + Vector((0, 0, cr * (0.55 if kind != "bush" else 0.35)))
    # trunk
    bm = bmesh.new()
    if kind != "bush":
        pts, rad = [], []
        n = 6
        base_r = 0.16 + 0.03 * h
        bend = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * 0.35
        for i in range(n + 1):
            t = i / n
            p = Vector((x, y, gz - 0.3)).lerp(top, t) + bend * math.sin(t * math.pi)
            pts.append(p)
            rad.append(base_r * (1.55 - 0.55 * t) if i == 0 else base_r * (1 - 0.45 * t))
        tube(bm, pts, rad)
        for k in range(rng.randint(2, 3)):
            s = pts[rng.randint(3, 4)]
            e = C + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.2, 0.6))) * cr * 0.6
            tube(bm, [s, s.lerp(e, 0.5) + Vector((0, 0, 0.2)), e], [base_r * 0.5, base_r * 0.35, 0.03], segs=5)
        trunk = bm_to_obj(bm, f"Trunk{idx}", M["bark"], smooth=True)
    else:
        bm.free()
    # canopy blobs
    blobs = [(C, cr * 0.8)]
    for _ in range(rng.randint(3, 6)):
        off = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.55, 0.8))) * cr * 0.55
        blobs.append((C + off, cr * rng.uniform(0.45, 0.7)))
    base_col = Vector(PAL[pal])
    n_cards = int((cr ** 2) * (10 if kind != "far" else 6))
    cam_dir = None
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    card_normals = []
    colors = []
    for c in range(n_cards):
        bc, br = blobs[rng.randrange(len(blobs))]
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized()
        p = bc + d * br * (0.5 + 0.5 * rng.random() ** 0.5)
        n_out = (0.7 * (p - C).normalized() + 0.3 * (p - bc).normalized() + Vector((0, 0, 0.22))).normalized()
        to_cam = (CAM_POS - p).normalized()
        f = n_out.lerp(to_cam, 0.55).normalized()
        a = f.orthogonal().normalized()
        b = f.cross(a)
        roll = rng.random() * math.tau
        a, b = a * math.cos(roll) + b * math.sin(roll), -a * math.sin(roll) + b * math.cos(roll)
        s = rng.uniform(0.9, 1.4) * (1.35 if kind == "far" else 1.0) * (0.9 + 0.12 * cr)
        vs = [bm.verts.new(p + (a * u + b * v) * s * 0.5) for u, v in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        face = bm.faces.new(vs)
        for loop, (u, v) in zip(face.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop[uv].uv = (u, v)
        face.material_index = 0 if rng.random() < 0.6 else 1
        # tint: per-card jitter + baked occlusion (inner/lower cards darker)
        depth = min(1.0, (p - C).length / cr)
        low = smoothstep(-cr, cr * 0.6, p.z - C.z)
        ao = 0.66 + 0.22 * depth + 0.12 * low
        jit = Vector((rng.uniform(-.06, .06), rng.uniform(-.05, .05), rng.uniform(-.04, .04)))
        col = Vector([max(0, min(1, (base_col[i] + jit[i]))) for i in range(3)])
        colors.append((*srgb_to_lin(col * ao), 1.0))
        card_normals.append(n_out)
    ob = bm_to_obj(bm, f"Canopy{idx}", [M["leaves_a"], M["leaves_b"]], smooth=True)
    me = ob.data
    ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'CORNER')
    loop_cols, loop_nrm = [], []
    for poly in me.polygons:
        for li in poly.loop_indices:
            loop_cols.append(colors[poly.index])
            # per-vertex spherical normal (smooth across the whole crown)
            v = me.vertices[me.loops[li].vertex_index].co
            nn = (0.75 * (v - C).normalized() + 0.25 * card_normals[poly.index] + Vector((0, 0, 0.18))).normalized()
            loop_nrm.append(nn)
    ca.data.foreach_set("color", np.array(loop_cols, np.float32).ravel())
    me.color_attributes.active_color = ca
    me.normals_split_custom_set(loop_nrm)
    return ob


# --------------------------------------------------------------------------
# Critters + lily pads
# --------------------------------------------------------------------------
def lumpy_sphere(bm, center, scale, lump=0.1, freq=4.0, subdiv=3, seed=0.0):
    r = bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    for v in r["verts"]:
        v.co *= 1 + lump * noise.noise(v.co * freq + Vector((seed, 0, 0)))
    bmesh.ops.transform(bm, matrix=Matrix.Translation(center) @ Matrix.Diagonal((*scale, 1)), verts=r["verts"])
    return r["verts"]


def build_sheep(i, pos, yaw):
    x, y = pos
    z = terrain_h(x, y)
    root = bpy.data.objects.new(f"Sheep{i}", None)
    EXPORT.objects.link(root)
    root.location, root.rotation_euler = (x, y, z), (0, 0, yaw)
    bm = bmesh.new()
    lumpy_sphere(bm, Vector((0, 0, 0.52)), (0.52, 0.36, 0.33), lump=0.13, freq=5, seed=i * 3)
    body = bm_to_obj(bm, f"Sheep{i}Body", M["wool"], smooth=True)
    body.parent = root
    bm = bmesh.new()
    for lx in (-0.28, 0.28):
        for ly in (-0.16, 0.16):
            add_cyl(bm, Vector((lx, ly, 0.0)), 0.05, 0.045, 0.34, segs=6)
    legs = bm_to_obj(bm, f"Sheep{i}Legs", M["skin"], smooth=True)
    legs.parent = root
    # head pivots at the neck so Godot/Blender can make it graze
    head = bpy.data.objects.new(f"Sheep{i}Head", None)
    EXPORT.objects.link(head)
    head.parent, head.location = root, (0.46, 0, 0.62)
    bm = bmesh.new()
    lumpy_sphere(bm, Vector((0.14, 0, -0.05)), (0.17, 0.11, 0.12), lump=0.02, subdiv=2)
    for s in (-1, 1):
        lumpy_sphere(bm, Vector((0.06, s * 0.12, 0.03)), (0.07, 0.03, 0.03), lump=0, subdiv=1)
    face = bm_to_obj(bm, f"Sheep{i}Face", M["skin"], smooth=True)
    face.parent = head
    bm = bmesh.new()
    lumpy_sphere(bm, Vector((0.04, 0, 0.07)), (0.12, 0.13, 0.09), lump=0.12, freq=7, subdiv=2)
    tuft = bm_to_obj(bm, f"Sheep{i}Tuft", M["wool"], smooth=True)
    tuft.parent = head
    return root, head


def build_duck(i, pos):
    root = bpy.data.objects.new(f"Duck{i}", None)
    EXPORT.objects.link(root)
    root.location = (pos[0], pos[1], WATER_Z)
    bm = bmesh.new()
    lumpy_sphere(bm, Vector((0, 0, 0.05)), (0.22, 0.12, 0.09), lump=0.0, subdiv=2)
    lumpy_sphere(bm, Vector((-0.17, 0, 0.1)), (0.08, 0.06, 0.05), lump=0.0, subdiv=1)
    b = bm_to_obj(bm, f"Duck{i}Body", M["duck_body"], smooth=True); b.parent = root
    bm = bmesh.new()
    lumpy_sphere(bm, Vector((0.16, 0, 0.2)), (0.065, 0.06, 0.065), lump=0.0, subdiv=2)
    h = bm_to_obj(bm, f"Duck{i}Head", M["duck_head"], smooth=True); h.parent = root
    bm = bmesh.new()
    lumpy_sphere(bm, Vector((0.24, 0, 0.19)), (0.05, 0.025, 0.015), lump=0.0, subdiv=1)
    k = bm_to_obj(bm, f"Duck{i}Beak", M["beak"], smooth=True); k.parent = root
    return root


def build_lilies():
    bm = bmesh.new()
    fl = bmesh.new()
    rng = random.Random(21)
    clusters = [(POND_C + Vector((-4.8, 1.8)), 18, 2.2), (POND_C + Vector((-2.0, 3.0)), 6, 1.2),
                (POND_C + Vector((3.0, -3.2)), 4, 0.9)]
    for c, n, spread in clusters:
        for _ in range(n):
            p = c + Vector((rng.gauss(0, spread * 0.6), rng.gauss(0, spread * 0.45)))
            if pond_sdf(p.x, p.y) > -0.6:
                continue
            r = rng.uniform(0.16, 0.3)
            a0 = rng.random() * math.tau
            ctr = bm.verts.new((p.x, p.y, WATER_Z + 0.012))
            ring = []
            for k in range(19):
                a = a0 + 0.35 + k / 18 * (math.tau - 0.7)
                ring.append(bm.verts.new((p.x + math.cos(a) * r, p.y + math.sin(a) * r, WATER_Z + 0.012)))
            for k in range(18):
                bm.faces.new((ctr, ring[k], ring[k + 1]))
            if rng.random() < 0.18:
                lumpy_sphere(fl, Vector((p.x, p.y, WATER_Z + 0.05)), (0.07, 0.07, 0.05), lump=0.3, freq=9, subdiv=1)
    bm_to_obj(bm, "LilyPads", M["lily"], smooth=True)
    bm_to_obj(fl, "LilyFlowers", M["lilyflower"], smooth=True)


# --------------------------------------------------------------------------
# Grass / flower instance sources (Blender render only — Godot scatters its own)
# --------------------------------------------------------------------------
def grass_clump():
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    rng = random.Random(5)
    for b in range(9):
        a = rng.random() * math.tau
        off = Vector((math.cos(a), math.sin(a), 0)) * rng.uniform(0, 0.08)
        lean = Vector((math.cos(a), math.sin(a), 0)) * rng.uniform(0.05, 0.18)
        h = rng.uniform(0.18, 0.34)
        w = rng.uniform(0.02, 0.032)
        side = Vector((-math.sin(a + 1.2), math.cos(a + 1.2), 0))
        rows = []
        for s in range(4):
            t = s / 3
            c = off + lean * t * t + Vector((0, 0, h * t))
            ww = w * (1 - t) + 0.002
            rows.append((bm.verts.new(c - side * ww), bm.verts.new(c + side * ww), t))
        for (a0, a1, t0), (b0, b1, t1) in zip(rows, rows[1:]):
            f = bm.faces.new((a0, a1, b1, b0))
            for loop, v in zip(f.loops, (t0, t0, t1, t1)):
                loop[uv].uv = (0.5, v)
    return bm_to_obj(bm, "GrassClump", M["grass"], coll=LIB, smooth=True)


def flower(name, color):
    bm = bmesh.new()
    add_cyl(bm, Vector((0, 0, 0)), 0.006, 0.004, 0.16, segs=4)
    for k in range(5):
        a = k / 5 * math.tau
        lumpy_sphere(bm, Vector((math.cos(a) * 0.028, math.sin(a) * 0.028, 0.165)), (0.026, 0.018, 0.006), lump=0, subdiv=1)
    ob = bm_to_obj(bm, name, mat_simple("TG_" + name, color, 0.6), coll=LIB, smooth=True)
    return ob


def scatter(terrain):
    """Geometry-nodes scatter of grass clumps + flowers, density from vertex groups."""
    clump = grass_clump()
    fcoll = bpy.data.collections.new("Flowers")
    LIB.children.link(fcoll)
    for n, c in (("FlowerBlue", (0.52, 0.62, 0.98)), ("FlowerWhite", (0.96, 0.95, 0.92)),
                 ("FlowerPink", (0.98, 0.66, 0.76)), ("FlowerBlue2", (0.62, 0.66, 0.95)),
                 ("FlowerRed", (0.96, 0.42, 0.28))):
        o = flower(n, c)
        LIB.objects.unlink(o)
        fcoll.objects.link(o)
    LIB.hide_render = True
    ng = bpy.data.node_groups.new("TG_Scatter", 'GeometryNodeTree')
    ng.interface.new_socket("Geometry", in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket("Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')
    nd, L = ng.nodes, ng.links
    gi, go = nd.new("NodeGroupInput"), nd.new("NodeGroupOutput")
    join = nd.new("GeometryNodeJoinGeometry")
    L.new(gi.outputs[0], join.inputs[0])

    def layer(group, density, inst_socket_src, seed, smin, smax, pick=False):
        dist = nd.new("GeometryNodeDistributePointsOnFaces")
        dist.distribute_method = 'RANDOM'
        dist.inputs["Density"].default_value = density
        dist.inputs["Seed"].default_value = seed
        na = nd.new("GeometryNodeInputNamedAttribute"); na.data_type = 'FLOAT'
        na.inputs["Name"].default_value = group
        L.new(gi.outputs[0], dist.inputs["Mesh"])
        mul = nd.new("ShaderNodeMath"); mul.operation = 'MULTIPLY'
        mul.inputs[1].default_value = density
        L.new(na.outputs["Attribute"], mul.inputs[0])
        L.new(mul.outputs[0], dist.inputs["Density"])
        inst = nd.new("GeometryNodeInstanceOnPoints")
        L.new(dist.outputs["Points"], inst.inputs["Points"])
        L.new(inst_socket_src, inst.inputs["Instance"])
        rot = nd.new("FunctionNodeRandomValue"); rot.data_type = 'FLOAT_VECTOR'
        rot.inputs[1].default_value = (0, 0, 6.283)
        rot.inputs["Seed"].default_value = seed + 1
        L.new(rot.outputs[0], inst.inputs["Rotation"])
        sc = nd.new("FunctionNodeRandomValue"); sc.data_type = 'FLOAT'
        sc.inputs[2].default_value, sc.inputs[3].default_value = smin, smax
        sc.inputs["Seed"].default_value = seed + 2
        L.new(sc.outputs[1], inst.inputs["Scale"])
        if pick:
            inst.inputs["Pick Instance"].default_value = True
            ri = nd.new("FunctionNodeRandomValue"); ri.data_type = 'INT'
            ri.inputs[4].default_value, ri.inputs[5].default_value = 0, 4
            ri.inputs["Seed"].default_value = seed + 3
            L.new(ri.outputs[2], inst.inputs["Instance Index"])
        L.new(inst.outputs[0], join.inputs[0])

    oi = nd.new("GeometryNodeObjectInfo"); oi.inputs["Object"].default_value = clump
    oi.transform_space = 'ORIGINAL'
    layer("grass", 38.0, oi.outputs["Geometry"], 4, 0.7, 1.35)
    ci = nd.new("GeometryNodeCollectionInfo"); ci.inputs["Collection"].default_value = fcoll
    ci.inputs["Separate Children"].default_value = True
    ci.inputs["Reset Children"].default_value = True
    layer("flowers", 9.0, ci.outputs["Instances"], 9, 1.3, 2.1, pick=True)
    L.new(join.outputs[0], go.inputs[0])
    mod = terrain.modifiers.new("Scatter", 'NODES')
    mod.node_group = ng


# --------------------------------------------------------------------------
# Camera, sun, world, render
# --------------------------------------------------------------------------
def sun_dir():
    """Direction the light travels (from sun toward ground)."""
    toward_sun = Vector((math.sin(SUN_AZIM) * math.cos(SUN_ELEV), math.cos(SUN_AZIM) * math.cos(SUN_ELEV), math.sin(SUN_ELEV)))
    return -toward_sun


def build_camera_light():
    cd = bpy.data.cameras.new("Camera")
    cd.lens, cd.sensor_width = 24, 36
    cd.clip_start, cd.clip_end = 0.3, 400
    cam = new_obj("Camera", cd)
    cam.location = CAM_POS
    cam.rotation_euler = (CAM_TARGET - CAM_POS).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    focus = bpy.data.objects.new("CameraFocus", None)
    scene.collection.objects.link(focus)
    focus.location = (-1.0, 1.0, 1.0)
    cd.dof.use_dof, cd.dof.focus_object, cd.dof.aperture_fstop = True, focus, 0.05
    cd.dof.aperture_blades, cd.dof.aperture_ratio = 7, 1.0
    # slow cinematic drift, 10s loop
    for f, off in ((1, (0, 0, 0)), (120, (1.6, 1.2, -0.5)), (240, (0, 0, 0))):
        cam.location = CAM_POS + Vector(off)
        cam.rotation_euler = (CAM_TARGET - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_euler", frame=f)
    cam.location = CAM_POS
    cam.rotation_euler = (CAM_TARGET - CAM_POS).to_track_quat('-Z', 'Y').to_euler()

    ld = bpy.data.lights.new("Sun", 'SUN')
    ld.energy = 9.0
    ld.color = (1.0, 0.82, 0.60)
    ld.angle = math.radians(2.2)
    sun = new_obj("Sun", ld)
    sun.rotation_euler = sun_dir().to_track_quat('-Z', 'Y').to_euler()
    return cam, sun


def build_world():
    w = bpy.data.worlds.new("TG_World")
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    L = nt.links
    out = nt.nodes.new("ShaderNodeOutputWorld"); out.location = (600, 0)
    lp = nt.nodes.new("ShaderNodeLightPath"); lp.location = (-600, 300)
    tc = nt.nodes.new("ShaderNodeTexCoord"); tc.location = (-900, 0)
    sep = N(nt, "ShaderNodeSeparateXYZ", (-700, 0)); L.new(tc.outputs["Generated"], sep.inputs[0])
    r = ramp(nt, (-450, 0), [(0.45, (0.80, 0.80, 0.74)), (0.55, (0.82, 0.86, 0.90)), (0.9, (0.52, 0.66, 0.88))])
    L.new(sep.outputs[2], r.inputs[0])
    bg = N(nt, "ShaderNodeBackground", (0, 0), Strength=0.8)
    L.new(r.outputs[0], bg.inputs["Color"])
    L.new(bg.outputs[0], out.inputs["Surface"])
    # bounded haze volume (an infinite world volume goes black in EEVEE Next)
    hm = bpy.data.materials.new("TG_Haze"); hm.use_nodes = True
    hn = hm.node_tree; hn.nodes.clear()
    ho = hn.nodes.new("ShaderNodeOutputMaterial")
    hv = N(hn, "ShaderNodeVolumePrincipled", (0, 0), Density=0.0028, Anisotropy=0.6)
    hv.inputs["Color"].default_value = (0.86, 0.9, 1.0, 1)
    hn.links.new(hv.outputs[0], ho.inputs["Volume"])
    bm = bmesh.new()
    add_box(bm, Vector((0, 22, 6)), (130, 110, 24))
    haze = bm_to_obj(bm, "HazeVolume", hm, coll=scene.collection)


def setup_render():
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
    scene.render.fps = 24
    scene.frame_start, scene.frame_end = 1, 240
    ee = scene.eevee
    ee.taa_render_samples = 48
    for k, v in (("use_raytracing", True), ("ray_tracing_method", 'SCREEN'), ("use_shadows", True),
                 ("shadow_ray_count", 2), ("shadow_step_count", 8), ("use_volumetric_shadows", True),
                 ("volumetric_tile_size", '4'), ("volumetric_end", 120.0), ("fast_gi_method", 'GLOBAL_ILLUMINATION'),
                 ("use_gtao", True), ("gtao_distance", 1.2), ("use_bloom", True)):
        try:
            setattr(ee, k, v)
        except Exception:
            pass
    try:
        ee.ray_tracing_options.resolution_scale = '1'
    except Exception:
        pass
    vs = scene.view_settings
    vs.view_transform = 'AgX'
    for look in ('AgX - Base Contrast', 'None'):
        try:
            vs.look = look
            break
        except Exception:
            pass
    vs.exposure = 0.15
    # compositor: soft bloom + warm lift
    scene.use_nodes = True
    nt = scene.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new("CompositorNodeRLayers")
    gl = nt.nodes.new("CompositorNodeGlare")
    gl.glare_type, gl.quality, gl.mix, gl.threshold, gl.size = 'FOG_GLOW', 'HIGH', -0.75, 0.9, 8
    cb = nt.nodes.new("CompositorNodeColorBalance")
    cb.correction_method = 'LIFT_GAMMA_GAIN'
    cb.lift = (1.02, 1.01, 1.03)
    cb.gain = (1.03, 1.0, 0.95)
    comp = nt.nodes.new("CompositorNodeComposite")
    nt.links.new(rl.outputs["Image"], gl.inputs["Image"])
    nt.links.new(gl.outputs["Image"], cb.inputs["Image"])
    nt.links.new(cb.outputs["Image"], comp.inputs["Image"])


def animate(sheep, ducks, trees):
    # sheep graze: head dips and rises (cyclic)
    for i, (root, head) in enumerate(sheep):
        for f, rot in ((1, 0.15), (40 + i * 10, 0.9), (90 + i * 10, 0.95), (130, 0.15), (240, 0.15)):
            head.rotation_euler = (0, rot, 0)
            head.keyframe_insert("rotation_euler", frame=f)
    # ducks paddle on little ellipses
    for i, d in enumerate(ducks):
        c = Vector(d.location)
        rx, ry, ph = 1.6 + i * 0.4, 1.0 + i * 0.3, i * 2.1
        for k in range(13):
            t = k / 12
            a = ph + t * math.tau
            d.location = c + Vector((math.cos(a) * rx - rx * math.cos(ph), math.sin(a) * ry - ry * math.sin(ph), 0))
            d.rotation_euler = (0, 0, math.atan2(math.cos(a) * ry, -math.sin(a) * rx))
            d.keyframe_insert("location", frame=1 + t * 240)
            d.keyframe_insert("rotation_euler", frame=1 + t * 240)
    # trees sway with noise modifiers on their canopies
    for ob in trees:
        ob.keyframe_insert("rotation_euler", frame=1)
        for ax in (0, 1):
            fc = ob.animation_data.action.fcurves.find("rotation_euler", index=ax)
            m = fc.modifiers.new('NOISE')
            m.scale, m.strength, m.phase = 40, 0.02, random.random() * 100


# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------
terrain = build_terrain()
build_water()
build_bridge()
build_castle()
build_path()
build_rocks()
build_lilies()
tree_objs = []
for i, t in enumerate(TREES):
    tree_objs.append(build_tree(i, *t))
# bushes hugging the castle and bridge ends
for j, (x, y, r, pal) in enumerate(((-7.4, 13.2, 0.9, "green"), (-0.6, 12.6, 0.8, "sage"),
                                     (-13.0, 4.6, 0.8, "lime"), (9.4, -4.6, 0.9, "green"),
                                     (-16.0, 6.5, 1.0, "sage"))):
    tree_objs.append(build_tree(200 + j, x, y, 0.0, r, pal, "bush"))
ducks = [build_duck(i, p) for i, p in enumerate(DUCKS)]
cam, sun = build_camera_light()
build_world()
setup_render()

animate([], ducks, [])

# ---- export geometry for Godot (before particles; they don't export) ----
glb = os.path.join(ZONE, "models", "tiny_glade_geo.glb")
os.makedirs(os.path.dirname(glb), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in EXPORT.all_objects:
    o.select_set(True)
kw = dict(filepath=glb, export_format='GLB', use_selection=True, export_apply=True,
          export_cameras=True, export_lights=True, export_animations=False,
          export_normals=True, export_texcoords=True, export_materials='EXPORT', export_image_format='NONE')
try:
    bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
except TypeError:
    bpy.ops.export_scene.gltf(**kw, export_colors=True)
print("exported", glb)

scatter(terrain)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "tiny_glade.blend"))

if "render" in ARGS:
    scene.render.filepath = os.path.join(HERE, "renders", "preview_blender.png")
    if "fast" in ARGS:
        scene.render.resolution_percentage = 50
        scene.eevee.taa_render_samples = 16
    bpy.ops.render.render(write_still=True)
    print("rendered", scene.render.filepath)
