"""Static clay-view contact sheet of actual forge triangles, no GPU or simulation."""
import json,math,sys
from PIL import Image,ImageDraw
models=json.load(open(sys.argv[1]));cols=int(sys.argv[3]) if len(sys.argv)>3 else 3;w=540;h=350
im=Image.new('RGB',(cols*w,math.ceil(len(models)/cols)*h),(19,24,31));d=ImageDraw.Draw(im)
for k,m in enumerate(models):
 x0=(k%cols)*w;y0=(k//cols)*h;tris=m['t'];tris=list(tris.values()) if isinstance(tris,dict) else tris;pts=list(zip(tris[::3],tris[1::3],tris[2::3]))
 # Orthographic oblique: +X right, +Y up, bow/side and dorsal silhouette.
 def project(p):
  x,y,z=p;return (.82*x+.57*z,-.38*x+.82*y+.55*z,.47*x+.57*y-.67*z)
 pp=[project(p) for p in pts];lo=[min(p[j] for p in pp) for j in range(2)];hi=[max(p[j] for p in pp) for j in range(2)]
 scale=min((w-40)/max(hi[0]-lo[0],1),(h-70)/max(hi[1]-lo[1],1))
 screen=[(x0+w/2+(p[0]-(lo[0]+hi[0])/2)*scale,y0+h/2+10-(p[1]-(lo[1]+hi[1])/2)*scale,p[2]) for p in pp]
 faces=[]
 for i in range(0,len(pts),3):
  a,b,c=pts[i:i+3];u=[b[j]-a[j] for j in range(3)];v=[c[j]-a[j] for j in range(3)];n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];mag=math.sqrt(sum(t*t for t in n)) or 1
  if sum(n[j]*[.47,.57,-.67][j] for j in range(3))<0:n=[-t for t in n]
  shade=.25+.68*max(0,sum(n[j]*[.3,.88,-.36][j] for j in range(3))/mag)
  color=tuple(int(c*shade) for c in (190,202,209));faces.append((sum(p[2] for p in screen[i:i+3]),[(p[0],p[1]) for p in screen[i:i+3]],color))
 for _,p,c in sorted(faces,key=lambda x:x[0]):d.polygon(p,fill=c)
 d.text((x0+14,y0+10),m['meta'].get('klass','model'),fill=(230,235,240))
 d.text((x0+14,y0+27),f"{m['call']} | {len(tris)//9:,} triangles",fill=(130,155,170))
im.save(sys.argv[2]);print(sys.argv[2])
