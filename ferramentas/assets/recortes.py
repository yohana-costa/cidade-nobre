"""Recorta as miniaturas de serviços e categorias, gera a coroa d'água do Clube,
converte logos para WebP e cria os ícones (favicon / atalho de tela inicial).
Rode depois de crest.py, lockup.py e heroes.py (ou use extrair_todos.py).
"""
import pathlib
import numpy as np
import cv2
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[2]
REF = ROOT / 'referencias'
ASSETS = ROOT / 'assets'

sharpen = ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2)

# --- miniaturas dos 6 serviços (tela Serviços, coluna da foto em cada card) ---
s = Image.open(REF / 'servicos.jpg')
rows = {'corte': (588, 692), 'barba': (709, 816), 'penteado': (831, 938),
        'manicure': (954, 1063), 'nasal': (1077, 1185), 'sobrancelha': (1199, 1306)}
for k, (a, b) in rows.items():
    im = s.crop((34, a + 1, 210, b - 1))
    im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS).filter(sharpen)
    im.save(ASSETS / f'svc_{k}.jpg', quality=88)

# --- fotos das 3 categorias (tela Início, "Muito além do corte") ---
h = Image.open(REF / 'home.jpg')
for k, box in {'cat_cabelo': (24, 1156, 248, 1355), 'cat_barba': (270, 1156, 490, 1355),
               'cat_cuidados': (511, 1156, 734, 1355)}.items():
    im = h.crop(box)
    im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS).filter(sharpen)
    im.save(ASSETS / f'{k}.jpg', quality=88)

# --- coroa d'água do card de saldo (tela Clube) ---
c = np.asarray(Image.open(REF / 'clube.jpg').convert('RGB').crop((470, 250, 732, 440))).astype(np.float32)
lum = c.mean(axis=2)
bg = cv2.morphologyEx(lum, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
bg = cv2.GaussianBlur(bg, (0, 0), 8)
a = np.clip((lum - bg - 3) / 28, 0, 1)
a = cv2.GaussianBlur(a, (0, 0), 0.6)
rgb = np.zeros_like(c); rgb[...] = (176, 150, 112)
Image.fromarray(np.dstack([rgb, a * 255]).astype('uint8'), 'RGBA') \
    .resize((393, 285), Image.LANCZOS).save(ASSETS / 'crown_wm.webp', quality=85, method=6)

# --- logos em WebP (mais leves para embutir no HTML) ---
Image.open(ASSETS / 'crest.png').save(ASSETS / 'crest.webp', quality=90, method=6)
lk = Image.open(ASSETS / 'lockup.png')
lk.resize((lk.width * 2 // 3, lk.height * 2 // 3), Image.LANCZOS).save(ASSETS / 'lockup.webp', quality=88, method=6)

# --- favicon e ícone de atalho ---
crest = Image.open(ASSETS / 'crest.png').convert('RGBA')
for size, name, bgc in [(64, 'fav.png', None), (180, 'touch.png', (11, 11, 12, 255))]:
    canvas = Image.new('RGBA', (size, size), bgc or (0, 0, 0, 0))
    pad = int(size * 0.06) if bgc else 0
    t = crest.copy(); t.thumbnail((size - 2 * pad, size - 2 * pad), Image.LANCZOS)
    canvas.alpha_composite(t, ((size - t.width) // 2, (size - t.height) // 2))
    (canvas.convert('RGB') if bgc else canvas).save(ASSETS / name, optimize=True)

# --- recompressão das fotos de topo ---
for n in ['hero_home', 'hero_servicos', 'hero_agendar']:
    Image.open(ASSETS / f'{n}.jpg').save(ASSETS / f'{n}.jpg', quality=86)

print('recortes ok')
