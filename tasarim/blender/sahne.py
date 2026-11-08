# Not Defteri — gerçekçi defter ve klasör deneme kareleri (Blender 5.2, başsız).
#
# Çalıştırma:
#   "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b -P sahne.py -- <cikti_klasoru> [nesne] [renk]
#   nesne: defter | klasor      renk: #rrggbb (kapak rengi)
#
# Bu yalnızca yön denemesi. Onay gelirse uygulama için katmanlı çıktı alınacak:
# beyaz kapaklı gölgelendirme + kapak UV geçişi + gölge; uygulama kullanıcının kapak
# rengini/görselini bu katmanlarla birleştirecek.

import bpy, sys, math, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
CIKTI = argv[0] if argv else os.path.join(os.path.dirname(__file__), "kareler")
NESNE = argv[1] if len(argv) > 1 else "defter"
RENK = argv[2] if len(argv) > 2 else "#172a45"
os.makedirs(CIKTI, exist_ok=True)


def lin(hex_):
    """sRGB hex -> doğrusal RGBA."""
    h = hex_.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda v: v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)


# ---------- sahneyi sıfırla ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.eevee.taa_render_samples = int(os.environ.get("ORNEK", "32"))
for ad, deger in (("use_raytracing", True), ("use_shadows", True), ("use_fast_gi", True),
                  ("fast_gi_distance", 0.6), ("shadow_ray_count", 3), ("shadow_step_count", 12)):
    try:
        setattr(sc.eevee, ad, deger)
    except Exception:
        pass
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
sc.render.resolution_x = int(os.environ.get("BOYUT", "700"))
sc.render.resolution_y = int(os.environ.get("BOYUT", "700"))
sc.render.film_transparent = False
sc.render.image_settings.file_format = "PNG"

# ---------- dünya ----------
dunya = bpy.data.worlds.new("dunya")
sc.world = dunya
dunya.use_nodes = True
arka = dunya.node_tree.nodes["Background"]
arka.inputs[0].default_value = lin("#efe9e6")
arka.inputs[1].default_value = 0.3


def malzeme(ad, renk, puruz=0.6, parlak=0.0, kabartma=None):
    m = bpy.data.materials.new(ad)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = renk
    p.inputs["Roughness"].default_value = puruz
    if "Specular IOR Level" in p.inputs:
        p.inputs["Specular IOR Level"].default_value = 0.35
    if parlak and "Coat Weight" in p.inputs:
        p.inputs["Coat Weight"].default_value = parlak
        p.inputs["Coat Roughness"].default_value = 0.35
    if kabartma:
        # Pürüzlülük yer yer değişsin: düz plastik değil, elle tutulmuş mukavva.
        pn = nt.nodes.new("ShaderNodeTexNoise")
        pn.inputs["Scale"].default_value = 6
        pr = nt.nodes.new("ShaderNodeMapRange")
        pr.inputs["To Min"].default_value = puruz - 0.08
        pr.inputs["To Max"].default_value = puruz + 0.08
        nt.links.new(pn.outputs["Fac"], pr.inputs["Value"])
        nt.links.new(pr.outputs["Result"], p.inputs["Roughness"])
        # Kâğıt kaplı mukavva dokusu: çok ince gürültü kabartması.
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = kabartma[0]
        tex.inputs["Detail"].default_value = 6
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = kabartma[1]
        bump.inputs["Distance"].default_value = 0.002
        nt.links.new(tex.outputs["Fac"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return m


def sayfa_kenari_malzemesi():
    """Sayfa bloğu: krem kâğıt, kalınlık boyunca ince yaprak çizgileri."""
    m = bpy.data.materials.new("sayfalar")
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Roughness"].default_value = 0.85
    koord = nt.nodes.new("ShaderNodeTexCoord")
    ayir = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(koord.outputs["Object"], ayir.inputs[0])
    dalga = nt.nodes.new("ShaderNodeTexWave")
    dalga.wave_type = "BANDS"
    dalga.bands_direction = "Y"
    dalga.inputs["Scale"].default_value = 260
    dalga.inputs["Distortion"].default_value = 1.2
    dalga.inputs["Detail"].default_value = 2
    nt.links.new(koord.outputs["Object"], dalga.inputs["Vector"])
    rampa = nt.nodes.new("ShaderNodeValToRGB")
    rampa.color_ramp.elements[0].color = lin("#e9e1d3")
    rampa.color_ramp.elements[1].color = lin("#fbf7ef")
    nt.links.new(dalga.outputs["Fac"], rampa.inputs["Fac"])
    nt.links.new(rampa.outputs["Color"], p.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    bump.inputs["Distance"].default_value = 0.0015
    nt.links.new(dalga.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return m


def kutu(ad, boyut, konum, mat, pah=0.004, parca=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=konum)
    o = bpy.context.active_object
    o.name = ad
    o.scale = boyut
    bpy.ops.object.transform_apply(scale=True)
    if pah:
        b = o.modifiers.new("pah", "BEVEL")
        b.width = pah
        b.segments = parca
        b.limit_method = "ANGLE"
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return o


def ebeveyn(cocuklar, ad):
    bos = bpy.data.objects.new(ad, None)
    sc.collection.objects.link(bos)
    for c in cocuklar:
        c.parent = bos
    return bos


# ---------- zemin: masa rengi, arkada yumuşak kavisli fon ----------
zemin_mat = malzeme("zemin", lin("#ece6e3"), puruz=0.9)
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
zemin = bpy.context.active_object
zemin.data.materials.append(zemin_mat)
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 4, 0), rotation=(math.radians(90), 0, 0))
fon = bpy.context.active_object
fon.data.materials.append(zemin_mat)

# ---------- nesneler ----------
G, Y = 1.0, 1.35          # en, boy (uygulamadaki kapak oranı 100/135)
kapak_mat = malzeme("kapak", lin(RENK), puruz=0.62, kabartma=(900, 0.06))
parcalar = []

if NESNE == "defter":
    T_kapak = 0.016           # mukavva kalınlığı
    T_sayfa = 0.105           # sayfa bloğu
    T = T_sayfa + 2 * T_kapak
    # Ön ve arka kapak (sırttan biraz taşmıyor, sayfaların üç yanından 6 mm taşıyor)
    on = kutu("on_kapak", (G, T_kapak, Y), (G / 2, -T / 2 + T_kapak / 2, Y / 2), kapak_mat, pah=0.005)
    arka_k = kutu("arka_kapak", (G, T_kapak, Y), (G / 2, T / 2 - T_kapak / 2, Y / 2), kapak_mat, pah=0.005)
    # Sayfa bloğu
    pay = 0.012
    sayfa = kutu("sayfalar", (G - pay - 0.01, T_sayfa - 0.002, Y - 2 * pay), (0.01 + (G - pay - 0.01) / 2, 0, Y / 2), sayfa_kenari_malzemesi(), pah=0.0015, parca=2)
    # Yuvarlak sırt
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=T / 2, depth=Y, location=(0.0, 0, Y / 2))
    sirt = bpy.context.active_object
    sirt.scale = (0.55, 1, 1)
    bpy.ops.object.transform_apply(scale=True)
    sirt.data.materials.append(kapak_mat)
    bpy.ops.object.shade_smooth()
    # Sırtla ön kapak arasındaki menteşe oluğu (gerçek ciltlerdeki ince çukur)
    oluk_mat = malzeme("oluk", tuple(c * 0.6 for c in lin(RENK)[:3]) + (1,), puruz=0.7)
    oluk = kutu("oluk", (0.006, 0.004, Y + 0.002), (0.045, -T / 2 - 0.0005, Y / 2), oluk_mat, pah=0.0015, parca=2)
    parcalar = [on, arka_k, sayfa, sirt, oluk]
    obje = ebeveyn(parcalar, "defter")
    obje.rotation_euler = (0, 0, math.radians(float(os.environ.get("ACI", "-30"))))
    obje.location = (-0.42, 0, 0)
    hedef = Vector((0.0, 0, Y * 0.47))

else:  # klasör: sert dosya klasörü, sekmeli arka panel, içinden kâğıtlar görünüyor
    T_panel = 0.012
    arka_y = Y
    on_y = Y * 0.9
    kagit_mat = malzeme("kagit", lin("#fbf8f2"), puruz=0.85, kabartma=(600, 0.04))
    arka_p = kutu("arka_panel", (G, T_panel, arka_y), (G / 2, 0.05, arka_y / 2), kapak_mat, pah=0.004)
    # Sekme: arka panelin sol üstünde
    sekme = kutu("sekme", (0.36, T_panel, 0.09), (0.26, 0.05, arka_y + 0.04), kapak_mat, pah=0.02, parca=6)
    # Kâğıtlar: hafif kaymış, üstten taşıyor
    k1 = kutu("kagit1", (G * 0.94, 0.002, Y * 0.96), (G / 2 + 0.01, 0.025, Y * 0.96 / 2 + 0.01), kagit_mat, pah=0.0005, parca=1)
    k1.rotation_euler = (0, math.radians(-1.6), 0)
    k2 = kutu("kagit2", (G * 0.92, 0.002, Y * 0.93), (G / 2 + 0.03, 0.015, Y * 0.93 / 2 + 0.005), kagit_mat, pah=0.0005, parca=1)
    k2.rotation_euler = (0, math.radians(1.2), 0)
    # İçeride bir defter (laciverti değil, krem kapak) — klasörün dolu olduğu hissi
    ic_mat = malzeme("ic_defter", lin("#d8cfc4"), puruz=0.7)
    ic = kutu("ic_defter", (G * 0.8, 0.02, Y * 0.98), (G * 0.48, 0.0, Y * 0.98 / 2), ic_mat, pah=0.004)
    # Ön panel: biraz kısa, hafif açık
    on_p = kutu("on_panel", (G, T_panel, on_y), (G / 2, -0.035, on_y / 2), kapak_mat, pah=0.004)
    # Alt kenarından menteşe gibi öne açılsın
    sc.cursor.location = (G / 2, -0.035, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.075, depth=0.2, location=(G / 2, -0.035, on_y), rotation=(math.radians(90), 0, 0))
    oyuk = bpy.context.active_object
    bo = on_p.modifiers.new("oyuk", "BOOLEAN")
    bo.object = oyuk
    bo.operation = "DIFFERENCE"
    on_p.modifiers.move(len(on_p.modifiers) - 1, 0)
    oyuk.hide_render = True
    oyuk.hide_viewport = True
    # Oyuk n-genleri yumuşak gölgelendirmede çapraz leke bırakıyordu; panel zaten düz.
    bpy.context.view_layer.objects.active = on_p
    on_p.select_set(True)
    bpy.ops.object.shade_flat()
    on_p.rotation_euler = (math.radians(4), 0, 0)
    # Ön paneldeki parmak oyuğu (yarım daire)
    parcalar = [arka_p, sekme, k1, k2, ic, on_p, oyuk]
    obje = ebeveyn(parcalar, "klasor")
    obje.rotation_euler = (0, 0, math.radians(float(os.environ.get("ACI", "-22"))))
    obje.location = (-0.45, 0, 0)
    hedef = Vector((0.0, 0, Y * 0.5))

# ---------- ışık ----------
def isik(ad, enerji, konum, boyut, renk=(1, 1, 1)):
    d = bpy.data.lights.new(ad, "AREA")
    d.energy = enerji
    d.size = boyut
    d.color = renk
    o = bpy.data.objects.new(ad, d)
    sc.collection.objects.link(o)
    o.location = konum
    yon = (hedef - Vector(konum)).normalized()
    o.rotation_euler = yon.to_track_quat("-Z", "Y").to_euler()
    return o

isik("anahtar", 150, (-2.4, -1.6, 3.2), 0.9, (1.0, 0.97, 0.93))
isik("dolgu", 28, (3.0, -2.6, 1.4), 3.0, (0.92, 0.95, 1.0))
isik("kenar", 70, (1.2, 2.0, 2.6), 1.0)

# ---------- kamera ----------
kam_d = bpy.data.cameras.new("kamera")
kam_d.lens = 85
kam = bpy.data.objects.new("kamera", kam_d)
sc.collection.objects.link(kam)
kam.location = (0.25, -4.3, 2.05)
yon = (hedef - kam.location).normalized()
kam.rotation_euler = yon.to_track_quat("-Z", "Y").to_euler()
sc.camera = kam

ad = f"{NESNE}_{RENK.lstrip('#')}_{os.environ.get('ACI', 'v')}.png"
sc.render.filepath = os.path.join(CIKTI, ad)
bpy.ops.render.render(write_still=True)
print("YAZILDI", sc.render.filepath)
