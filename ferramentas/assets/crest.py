"""Extrai o brasão (logo vertical) da tela de Serviços com fundo transparente.
Parte do kit de extração de assets da Cidade Nobre. Rode a partir da raiz do projeto:
    python3 ferramentas/assets/extrair_todos.py
"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
REF = ROOT / 'referencias'          # telas de referência aprovadas
ASSETS = ROOT / 'assets'            # saída usada pelo protótipo
DEBUG = ROOT / 'build' / 'debug'    # máscaras e recortes intermediários (conferência visual)
DEBUG.mkdir(parents=True, exist_ok=True)
import cv2, numpy as np
from scipy import ndimage as ndi
src = cv2.imread(str(REF/'servicos.jpg'))
x0,y0,x1,y1 = 75,28,318,268
c = src[y0:y1, x0:x1].copy()
hsv = cv2.cvtColor(c, cv2.COLOR_BGR2HSV)
H,S,V = [hsv[...,i].astype(np.float32) for i in range(3)]
b,g,r = [c[...,i].astype(np.float32) for i in range(3)]
gold = (V>95) & (r>g) & (g>b) & ((r-b)>40)
red = (r>90) & (r>g*1.8) & (r>b*1.8)
m = (gold|red).astype(np.uint8)
# keep largest connected component region after closing
k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(9,9))
mc = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k)
n,lab = cv2.connectedComponents(mc)
sizes = [(lab==i).sum() for i in range(1,n)]
print('components', sorted(sizes)[-6:])
keep = np.zeros_like(mc)
for i,s in enumerate(sizes,1):
    if s>400: keep[lab==i]=1
filled = ndi.binary_fill_holes(keep).astype(np.uint8)
cv2.imwrite(str(DEBUG/'mask_raw.png'), filled*255)
cv2.imwrite(str(DEBUG/'crest_src.png'), c)
# alpha
k2 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5))
a = cv2.dilate(filled*255, k2)
a = cv2.GaussianBlur(a.astype(np.float32),(0,0),1.2)
# trim to bbox
ys,xs = np.where(a>8)
yA,yB,xA,xB = ys.min(),ys.max()+1,xs.min(),xs.max()+1
c2 = c[yA:yB,xA:xB]; a2 = a[yA:yB,xA:xB]
S=3
up = cv2.resize(c2,None,fx=S,fy=S,interpolation=cv2.INTER_LANCZOS4)
blur = cv2.GaussianBlur(up,(0,0),2.0)
up = cv2.addWeighted(up,1.5,blur,-0.5,0)
aup = cv2.resize(a2,None,fx=S,fy=S,interpolation=cv2.INTER_CUBIC)
rgba = np.dstack([up, np.clip(aup,0,255).astype(np.uint8)])
cv2.imwrite(str(ASSETS/'crest.png'), rgba)
print('crest size', rgba.shape)
