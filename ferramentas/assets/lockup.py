"""Extrai a logo horizontal (lockup) do cabeçalho da tela do Clube com fundo transparente.
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
src = cv2.imread(str(REF/'clube.jpg'))
c = src[2:94, 178:560].astype(np.float32)
# estimate bg from corners
bgc = np.median(np.concatenate([c[:6,:].reshape(-1,3), c[-6:,:].reshape(-1,3)]),axis=0)
print('bg', bgc)
# color-to-alpha relative to bg (treat as black after subtract)
d = np.clip(c - bgc, 0, 255)
a = d.max(axis=2) / np.maximum(255-bgc.max(),1)
a = np.clip(a*1.15,0,1)
# keep red throne: red channel strong -> alpha from luminance diff works
col = np.where(a[...,None]>0.02, d/np.maximum(a[...,None],1e-3), 0)
col = np.clip(col,0,255)
S=3
col = cv2.resize(col,None,fx=S,fy=S,interpolation=cv2.INTER_LANCZOS4)
a = cv2.resize(a,None,fx=S,fy=S,interpolation=cv2.INTER_CUBIC)
blur = cv2.GaussianBlur(col,(0,0),2)
col = cv2.addWeighted(col,1.4,blur,-0.4,0)
rgba = np.dstack([np.clip(col,0,255), np.clip(a*255,0,255)]).astype(np.uint8)
ys,xs=np.where(rgba[...,3]>6)
rgba=rgba[max(ys.min()-4,0):ys.max()+5, max(xs.min()-4,0):xs.max()+5]
cv2.imwrite(str(ASSETS/'lockup.png'), rgba)
print(rgba.shape)
