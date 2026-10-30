"""Remove textos e logo das fotos de topo (Início, Serviços, Agendar) por inpainting, preservando a fotografia.
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
def goldmask(c, vmin=90):
    b,g,r=[c[...,i].astype(np.float32) for i in range(3)]
    v=c.max(axis=2).astype(np.float32)
    gold=(v>vmin)&(r>g)&(g>b)&((r-b)>40)
    red=(r>80)&(r>g*1.8)&(r>b*1.8)
    return (gold|red).astype(np.uint8)
def brightmask(c, thr=150):
    v=c.max(axis=2)
    return (v>thr).astype(np.uint8)
def build(path, y0, y1, items, out, radius=6):
    img=cv2.imread(path)[y0:y1].copy()
    H,W=img.shape[:2]
    mask=np.zeros((H,W),np.uint8)
    for kind,(x0,yy0,x1,yy1),extra in items:
        yy0-=y0; yy1-=y0
        yy0=max(yy0,0); yy1=min(yy1,H)
        sub=img[yy0:yy1,x0:x1]
        if kind=='crest':
            m=goldmask(sub)
            m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(11,11)))
            n,lab=cv2.connectedComponents(m)
            keep=np.zeros_like(m)
            for i in range(1,n):
                if (lab==i).sum()>300: keep[lab==i]=1
            m=ndi.binary_fill_holes(keep).astype(np.uint8)
            m=cv2.dilate(m,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(9,9)))
        elif kind=='text':
            m=brightmask(sub, extra or 120)
            m=cv2.dilate(m,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)))
        elif kind=='gold':
            m=goldmask(sub, extra or 70)
            m=cv2.dilate(m,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)))
        elif kind=='box':
            m=np.ones(sub.shape[:2],np.uint8)
        mask[yy0:yy1,x0:x1]|=m
    res=cv2.inpaint(img,mask*255,radius,cv2.INPAINT_TELEA)
    cv2.imwrite(out,res)
    vis=img.copy(); vis[mask>0]=(0,255,0)
    cv2.imwrite(str(DEBUG/(pathlib.Path(out).stem+'_mask.jpg')),vis)
    return res
# HOME photo: crop y 75..880
build(str(REF/'home.jpg'),76,880,[
 ('crest',(40,76,212,195),None),
 ('text',(45,636,360,664),110),
 ('text',(40,665,460,840),130),
 ('text',(40,840,640,876),130),
],str(ASSETS/'hero_home.jpg'))
# SERVICOS photo y 0..505
build(str(REF/'servicos.jpg'),0,505,[
 ('box',(28,26,94,90),None),
 ('crest',(78,28,318,268),None),
 ('gold',(38,258,100,272),60),
 ('text',(38,280,390,305),100),
 ('text',(36,310,495,452),130),
 ('text',(36,455,400,495),130),
],str(ASSETS/'hero_servicos.jpg'))
# AGENDAR photo y 0..470
build(str(REF/'agendar.jpg'),0,470,[
 ('box',(24,46,100,122),None),
 ('crest',(268,18,488,238),None),
 ('text',(35,252,320,305),100),
 ('gold',(36,308,118,322),60),
 ('text',(35,322,410,462),130),
],str(ASSETS/'hero_agendar.jpg'))
