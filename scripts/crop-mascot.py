"""Recorta a folha de poses do mascote (7x2) em WebP com fundo transparente.

Uso: python3 scripts/crop-mascot.py design/mascot/poses-sheet.jpg apps/web/public/mascot/
Os limites das colunas e faixas abaixo valem para a folha atual (2576x1438).
Uma folha nova pede novos limites; ver docs/MASCOT.md.
"""
import sys
from PIL import Image, ImageFilter
import numpy as np
from collections import deque
src, out = sys.argv[1], sys.argv[2].rstrip("/") + "/"
names=["acenando","comemorando","sequencia","medalha","ouvindo","contente","lupa",
       "relogio","cartoes","dormindo","lendo","em-obras","boiando","bug"]
im=Image.open(src).convert("RGB"); a=np.asarray(im).astype(int); H,W,_=a.shape
bounds=[0,455,826,1158,1504,1835,2165,W]
bands=[(20,530),(900,1400)]
bg=np.median(np.concatenate([a[:15].reshape(-1,3),a[-15:].reshape(-1,3)]),axis=0)
dist=np.sqrt(((a-bg)**2).sum(axis=2))
i=0
for (y0,y1) in bands:
  for c in range(7):
    x0,x1=bounds[c],bounds[c+1]
    d=dist[y0:y1,x0:x1]
    # flood fill background from cell border: pixels with dist<TOL connected to border
    TOL=22
    h,w=d.shape; seen=np.zeros((h,w),bool); q=deque()
    for x in range(w): q.append((0,x)); q.append((h-1,x))
    for y in range(h): q.append((y,0)); q.append((y,w-1))
    while q:
      y,x=q.popleft()
      if y<0 or x<0 or y>=h or x>=w or seen[y,x] or d[y,x]>=TOL: continue
      seen[y,x]=True
      q.extend(((y+1,x),(y-1,x),(y,x+1),(y,x-1)))
    fg=~seen
    # Remove sobras dos vizinhos: componentes estreitos que encostam na lateral do recorte.
    lab=np.zeros((h,w),int); n=0
    for sy,sx in zip(*np.where(fg)):
      if lab[sy,sx]: continue
      n+=1; st=[(sy,sx)]; lab[sy,sx]=n; pts=[]
      while st:
        y,x=st.pop(); pts.append((y,x))
        for yy,xx in ((y+1,x),(y-1,x),(y,x+1),(y,x-1)):
          if 0<=yy<h and 0<=xx<w and fg[yy,xx] and not lab[yy,xx]:
            lab[yy,xx]=n; st.append((yy,xx))
      p=np.array(pts); xmin,xmax=p[:,1].min(),p[:,1].max()
      if (xmin==0 or xmax==w-1) and (xmax-xmin)<60:
        fg[p[:,0],p[:,1]]=False
    # soft edge: alpha ramps with distance near the border of bg region
    alpha=np.where(fg,255,0).astype(np.uint8)
    am=Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(1.2))
    ys,xs=np.where(fg)
    # ignore tiny specks for bbox
    by0,by1=max(ys.min()-12,0),min(ys.max()+12,h); bx0,bx1=max(xs.min()-12,0),min(xs.max()+12,w)
    rgba=Image.fromarray(a[y0:y1,x0:x1].astype(np.uint8)).convert("RGBA"); rgba.putalpha(am)
    crop=rgba.crop((bx0,by0,bx1,by1))
    crop.save(out+names[i]+".webp","WEBP",quality=88,method=6)
    print(names[i],crop.size)
    i+=1
