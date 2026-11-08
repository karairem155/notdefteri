# Deneme karelerinden etiketli karşılaştırma tablosu yapar.
import os, sys
from PIL import Image, ImageDraw, ImageFont

KOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kareler")
SATIRLAR = [
    ("Defter", [("defter_172a45_-30.png", "A · yandan (30°)"), ("defter_172a45_-6.png", "B · önden"), ("defter_e8c6ce_-30.png", "A · gül kapak")]),
    ("Klasör", [("klasor_172a45_-22.png", "A · yandan (22°)"), ("klasor_172a45_-5.png", "B · önden"), ("klasor_c9a77c_-22.png", "A · kraft kapak")]),
]
H = 460
BAS = 54
ETIKET = 40
font_b = ImageFont.truetype("C:/Windows/Fonts/seguisb.ttf", 26)
font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 22)
tablo = Image.new("RGB", (3 * H, len(SATIRLAR) * (H + ETIKET + BAS)), (236, 230, 227))
d = ImageDraw.Draw(tablo)
y = 0
for baslik, kareler in SATIRLAR:
    d.text((18, y + 14), baslik, font=font_b, fill=(23, 42, 69))
    y += BAS
    for i, (ad, etiket) in enumerate(kareler):
        im = Image.open(os.path.join(KOK, ad)).convert("RGB").resize((H, H), Image.LANCZOS)
        tablo.paste(im, (i * H, y))
        d.text((i * H + 18, y + H + 8), etiket, font=font, fill=(75, 86, 108))
    y += H + ETIKET
cikti = os.path.join(os.path.dirname(os.path.abspath(__file__)), "blender-deneme-1.png")
tablo.save(cikti)
print(cikti)
