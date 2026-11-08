# Raf denemesi: saydam arka planlı defter ve klasör kareleri (uygulamanın rafına konacak).
#
#   blender -b -P raf.py -- <cikti.png> <nesne: defter|klasor> <renk #rrggbb> <aci> <stil: gercek|yumusak>
#
# Klasör uygulamadaki şekli izliyor (folders.js): yatay 120×90, ön kapağın sağ üstünde
# çapraz yükselen dil (sol üst kenar y=13, çapraz 58→68), içeriden iki kâğıt görünüyor.

import bpy, sys, math, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
CIKTI, NESNE, RENK, ACI, STIL = argv[0], argv[1], argv[2], float(argv[3]), argv[4]
YUMUSAK = STIL == "yumusak"


def lin(hex_):
    h = hex_.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda v: v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.eevee.taa_render_samples = 32
for ad, deger in (("use_raytracing", True), ("use_shadows", True), ("use_fast_gi", True)):
    try: setattr(sc.eevee, ad, deger)
    except Exception: pass
sc.view_settings.view_transform = "Standard"
sc.render.resolution_x = 600
sc.render.resolution_y = 600
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"

dunya = bpy.data.worlds.new("dunya"); sc.world = dunya; dunya.use_nodes = True
dunya.node_tree.nodes["Background"].inputs[0].default_value = lin("#f1ece9")
dunya.node_tree.nodes["Background"].inputs[1].default_value = 0.75 if YUMUSAK else 0.35


def malzeme(ad, renk, puruz=0.6, kabartma=None, parlak=0.0):
    m = bpy.data.materials.new(ad); m.use_nodes = True
    nt = m.node_tree; p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = renk
    p.inputs["Roughness"].default_value = puruz
    if "Specular IOR Level" in p.inputs: p.inputs["Specular IOR Level"].default_value = 0.25 if YUMUSAK else 0.4
    if parlak and "Coat Weight" in p.inputs:
        p.inputs["Coat Weight"].default_value = parlak; p.inputs["Coat Roughness"].default_value = 0.3
    if kabartma and not YUMUSAK:
        tex = nt.nodes.new("ShaderNodeTexNoise"); tex.inputs["Scale"].default_value = kabartma[0]; tex.inputs["Detail"].default_value = 6
        bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = kabartma[1]; bump.inputs["Distance"].default_value = 0.002
        nt.links.new(tex.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return m


def sayfa_malzemesi():
    m = bpy.data.materials.new("sayfalar"); m.use_nodes = True
    nt = m.node_tree; p = nt.nodes["Principled BSDF"]; p.inputs["Roughness"].default_value = 0.85
    if YUMUSAK:
        p.inputs["Base Color"].default_value = lin("#f5efe4"); return m
    koord = nt.nodes.new("ShaderNodeTexCoord")
    dalga = nt.nodes.new("ShaderNodeTexWave"); dalga.wave_type = "BANDS"; dalga.bands_direction = "Y"
    dalga.inputs["Scale"].default_value = 260; dalga.inputs["Distortion"].default_value = 1.2
    nt.links.new(koord.outputs["Object"], dalga.inputs["Vector"])
    rampa = nt.nodes.new("ShaderNodeValToRGB")
    rampa.color_ramp.elements[0].color = lin("#e9e1d3"); rampa.color_ramp.elements[1].color = lin("#fbf7ef")
    nt.links.new(dalga.outputs["Fac"], rampa.inputs["Fac"]); nt.links.new(rampa.outputs["Color"], p.inputs["Base Color"])
    return m


def kutu(ad, boyut, konum, mat, pah=0.004, parca=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=konum)
    o = bpy.context.active_object; o.name = ad; o.scale = boyut
    bpy.ops.object.transform_apply(scale=True)
    if pah:
        b = o.modifiers.new("pah", "BEVEL"); b.width = pah; b.segments = parca; b.limit_method = "ANGLE"
    o.data.materials.append(mat); bpy.ops.object.shade_smooth()
    return o


def profil(ad, noktalar, yaricaplar, kalinlik, mat, y=0.0):
    """XZ düzleminde köşeleri yuvarlatılmış çokgen; Y yönünde `kalinlik` kadar kalın."""
    yol = []
    n = len(noktalar)
    for i in range(n):
        p0, p1, p2 = Vector(noktalar[i - 1]), Vector(noktalar[i]), Vector(noktalar[(i + 1) % n])
        r = yaricaplar[i]
        a, b = (p0 - p1).normalized(), (p2 - p1).normalized()
        aci = math.acos(max(-1, min(1, a.dot(b))))
        d = r / math.tan(aci / 2) if aci > 1e-3 else 0
        s, e = p1 + a * d, p1 + b * d
        # s'den e'ye p1 köşesi kontrol noktalı ikinci derece eğri
        for k in range(9):
            t = k / 8
            q = (1 - t) ** 2 * s + 2 * (1 - t) * t * p1 + t * t * e
            yol.append((q.x, q.y))
    me = bpy.data.meshes.new(ad)
    verts = [(x, y - kalinlik / 2, z) for x, z in yol] + [(x, y + kalinlik / 2, z) for x, z in yol]
    m = len(yol)
    faces = [list(range(m))[::-1], list(range(m, 2 * m))]
    for i in range(m):
        j = (i + 1) % m
        faces.append([i, j, m + j, m + i])
    me.from_pydata(verts, [], faces); me.update()
    o = bpy.data.objects.new(ad, me); sc.collection.objects.link(o)
    o.data.materials.append(mat)
    bv = o.modifiers.new("pah", "BEVEL"); bv.width = 0.004; bv.segments = 3; bv.limit_method = "ANGLE"
    return o


renk = lin(RENK)
kapak = malzeme("kapak", renk, puruz=0.55 if YUMUSAK else 0.62, kabartma=(900, 0.06))
parcalar = []

if NESNE == "defter":
    G, Y = 1.0, 1.35
    Tk, Ts = 0.016, 0.105
    T = Ts + 2 * Tk
    on = kutu("on", (G, Tk, Y), (G / 2, -T / 2 + Tk / 2, Y / 2), kapak, pah=0.006)
    arka = kutu("arka", (G, Tk, Y), (G / 2, T / 2 - Tk / 2, Y / 2), kapak, pah=0.006)
    pay = 0.012
    sayfa = kutu("sayfa", (G - pay - 0.01, Ts - 0.002, Y - 2 * pay), (0.01 + (G - pay - 0.01) / 2, 0, Y / 2), sayfa_malzemesi(), pah=0.0015, parca=2)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=T / 2, depth=Y, location=(0, 0, Y / 2))
    sirt = bpy.context.active_object; sirt.scale = (0.55, 1, 1); bpy.ops.object.transform_apply(scale=True)
    sirt.data.materials.append(kapak); bpy.ops.object.shade_smooth()
    parcalar = [on, arka, sayfa, sirt]
    if not YUMUSAK:
        oluk = kutu("oluk", (0.006, 0.004, Y + 0.002), (0.045, -T / 2 - 0.0005, Y / 2), malzeme("oluk", tuple(c * 0.6 for c in renk[:3]) + (1,), 0.7), pah=0.0015, parca=2)
        parcalar.append(oluk)
    merkez = Vector((G / 2, 0, Y / 2))
else:
    u = 1.2 / 120          # SVG biriminden metreye
    W, H = 120 * u, 90 * u
    zz = lambda yv: H - yv * u
    arka_mat = malzeme("arka", tuple(c * 0.55 for c in renk[:3]) + (1,), 0.65)
    arka = profil("arka", [(0, zz(0)), (W, zz(0)), (W, 0), (0, 0)], [6 * u] * 4, 0.014, arka_mat, y=0.045)
    kagit1 = kutu("kagit1", (W - 38 * u, 0.003, H - 11 * u), (13 * u + (W - 38 * u) / 2, 0.025, (H - 11 * u) / 2 + 0.004), malzeme("k1", lin("#d9d2c0"), 0.85), pah=0.001, parca=1)
    kagit2 = kutu("kagit2", (W - 32 * u, 0.003, H - 17 * u), (10 * u + (W - 32 * u) / 2, 0.012, (H - 17 * u) / 2 + 0.004), malzeme("k2", lin("#f1ebdd"), 0.85), pah=0.001, parca=1)
    on_nok = [(0, zz(13)), (58 * u, zz(13)), (68 * u, zz(0)), (W, zz(0)), (W, 0), (0, 0)]
    on = profil("on", on_nok, [6 * u, 4 * u, 4 * u, 6 * u, 6 * u, 6 * u], 0.014, kapak, y=-0.01)
    # Ön kapak alt menteşesinden hafifçe öne açık
    sc.cursor.location = (0, -0.01, 0)
    bpy.context.view_layer.objects.active = on; on.select_set(True)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    on.rotation_euler = (math.radians(5), 0, 0)
    parcalar = [arka, kagit1, kagit2, on]
    merkez = Vector((W / 2, 0, H / 2))

kok = bpy.data.objects.new("kok", None); sc.collection.objects.link(kok)
kok.location = merkez
bpy.context.view_layer.update()
for p in parcalar:
    p.parent = kok
    p.matrix_parent_inverse = kok.matrix_world.inverted()   # dünyadaki yeri değişmesin
kok.rotation_euler = (0, 0, math.radians(ACI))

# Işık
def isik(enerji, konum, boyut, renk=(1, 1, 1)):
    d = bpy.data.lights.new("isik", "AREA"); d.energy = enerji; d.size = boyut; d.color = renk
    o = bpy.data.objects.new("isik", d); sc.collection.objects.link(o); o.location = konum
    o.rotation_euler = (merkez - Vector(konum)).normalized().to_track_quat("-Z", "Y").to_euler()

if YUMUSAK:
    isik(90, (-2.0, -2.6, 2.6), 4.0, (1, 0.98, 0.95)); isik(45, (2.6, -2.4, 1.4), 4.0)
else:
    isik(140, (-2.3, -1.8, 3.0), 1.0, (1, 0.97, 0.93)); isik(28, (3.0, -2.6, 1.4), 3.0, (0.92, 0.95, 1)); isik(70, (1.2, 2.0, 2.6), 1.0)

# Kamera: önden, hafif yukarıdan; nesne kareyi dolduruyor (sonra saydam kenarlar kırpılıyor)
kd = bpy.data.cameras.new("kam"); kd.lens = 120
kam = bpy.data.objects.new("kam", kd); sc.collection.objects.link(kam)
kam.location = merkez + Vector((0.0, -9.0, 1.4))
kam.rotation_euler = (merkez - kam.location).normalized().to_track_quat("-Z", "Y").to_euler()
sc.camera = kam
sc.render.filepath = CIKTI
bpy.ops.render.render(write_still=True)
print("YAZILDI", CIKTI)
