(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function layout(s,mesh){
 const L=s.slen||30,h=clamp(L*.018,2.4,14),organic=[1,2,4,8,15,17,21].includes(s.race),target=L<100?L*.12:-L*.16;
 let best=-Infinity,point=[target,0,0];
 // Use broad upward-facing hull triangles, avoiding antenna tips and free space.
 if(mesh?.v&&mesh?.i)for(let j=0;j<mesh.i.length;j+=3){const vs=[0,1,2].map(k=>Array.from(mesh.v.slice(mesh.i[j+k]*3,mesh.i[j+k]*3+3))),[a,b,c]=vs,u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],area=Math.hypot(...n);if(area<h*h*.08||Math.abs(n[1])/area<.65)continue;const p=a.map((x,i)=>(x+b[i]+c[i])/3);if(p[1]<0||Math.abs(p[2])>Math.max(h*2,(s.meta?.beam||L*.3)*.18))continue;const score=p[1]-.025*Math.abs(p[0]-target)-.04*Math.abs(p[2]);if(score>best){best=score;point=p;}}
 if(best===-Infinity&&mesh?.v?.length){let top=0;for(let i=3;i<mesh.v.length;i+=3)if(mesh.v[i+1]>mesh.v[top+1])top=i;point=Array.from(mesh.v.slice(top,top+3));}
 return {center:point,h,organic};
}
const rgb=hex=>(hex.match(/\w\w/g)||['88','88','88']).slice(0,3).map(x=>parseInt(x,16)/255);
function room(r){const out=[],H=r.h,[X,Y,Z]=r.center,col=r.organic?[.23,.26,.24]:[.13,.18,.22],trim=r.organic?[.43,.39,.31]:[.38,.44,.47];
 const tri=(a,b,c,color)=>{for(const p of [a,b,c])out.push(X+p[0]*H,Y+p[1]*H,Z+p[2]*H,...color);};
 const box=(x,y,z,w,h,d,color)=>{const v=Array.from({length:8},(_,i)=>[x+((i&1)?1:-1)*w/2,y+((i&2)?1:-1)*h/2,z+((i&4)?1:-1)*d/2]);for(const [a,b,c,d] of [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]]){tri(v[a],v[b],v[c],color);tri(v[a],v[c],v[d],color);}};
 box(0,.04,0,3.3,.12,2.1,col);box(0,1.05,0,3.2,.1,2.05,col);
 for(const x of [-1.5,1.5])for(const z of [-1,1])box(x,.56,z,.065,1,.065,trim);
 for(const z of [-1,1]){box(0,.28,z,3.1,.35,.065,col);box(0,.8,z,3.1,.035,.04,trim);}
 box(-.5,.27,0,.45,.45,.55,trim);box(-.68,.55,0,.1,.5,.55,col);
 box(.65,.33,0,.36,.38,1.35,col);box(.64,.53,0,.4,.035,1.25,r.organic?[.15,.24,.18]:[.08,.14,.18]);
 for(let i=0;i<5;i++)box(.7,.56,-.46+i*.23,.18,.018,.13,[.48,.68,.68]);
 if(r.organic)for(let i=0;i<5;i++)box(-.8+i*.4,1.1,0,.1,.12,1.85,trim);
 return out;
}
function glass(r){const out=[],H=r.h,c=r.organic?[.32,.46,.35]:[.30,.55,.63];const quad=(a,b,c0,d)=>{for(const v of [a,b,c0,a,c0,d])out.push(...v.map((x,i)=>r.center[i]+x*H),...c);};
 for(const z of [-1,1])quad([-1.5,.46,z],[1.5,.46,z],[1.5,1.02,z],[-1.5,1.02,z]);
 for(const x of [-1.5,1.5])quad([x,.14,-1],[x,.14,1],[x,1.02,1],[x,1.02,-1]);return out;}
function crew(r,profile,state,time,geometry){const faces=geometry(profile,state,time),points=faces.flatMap(f=>f.v),lo=Math.min(...points.map(p=>p[1])),hi=Math.max(...points.map(p=>p[1])),scale=Math.min(r.h*.72/Math.max(1,hi-lo),r.h*1.4/Math.max(1,...points.map(p=>Math.abs(p[0])*2)),r.h*1.4/Math.max(1,...points.map(p=>Math.abs(p[2])*2))),out=[],yaw=Math.sin(time*.45)*.13,cy=Math.cos(yaw),sy=Math.sin(yaw);
 for(const f of faces){const color=rgb(f.col);for(const p of f.v){const x=p[0]*cy+p[2]*sy,z=p[2]*cy-p[0]*sy;out.push(r.center[0]+z*scale-r.h*.15,r.center[1]+(p[1]-lo)*scale+r.h*.18,r.center[2]-x*scale,...color);}}return out;}
function createRenderer(gl){const shader=(type,text)=>{const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,`#version 300 es
layout(location=0)in vec3 a;layout(location=1)in vec3 c;uniform mat4 vp;uniform vec3 origin;uniform vec3 ax;uniform float angle;uniform vec2 yaw;out vec3 color;out vec3 local;void main(){vec3 q=a*cos(angle)+cross(ax,a)*sin(angle)+ax*dot(ax,a)*(1.-cos(angle));q=vec3(q.x*yaw.x-q.z*yaw.y,q.y,q.x*yaw.y+q.z*yaw.x);local=q;color=c;gl_Position=vp*vec4(q+origin,1.);}`));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,`#version 300 es
precision highp float;in vec3 color;in vec3 local;uniform float opacity;out vec4 frag;void main(){vec3 n=normalize(cross(dFdx(local),dFdy(local)));float light=.62+.38*abs(dot(n,normalize(vec3(.4,.8,.3))));frag=vec4(color*light,opacity);}`));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));const names=['vp','origin','ax','angle','yaw','opacity'],u=Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(p,n)])),cache=new Map();
 function drop(entry){gl.deleteVertexArray(entry.vao);gl.deleteBuffer(entry.buffer);}
 function draw(candidates,m,time,poseOf,profiles,geometry,pilot,talking){gl.useProgram(p);gl.uniformMatrix4fv(u.vp,false,m);const ids=new Set(candidates.map(s=>s.id));for(const [id,entry]of cache)if(!ids.has(id)||entry.ship!==candidates.find(s=>s.id===id)){drop(entry);cache.delete(id);}
 for(const s of candidates){let entry=cache.get(s.id);if(!entry){entry={ship:s,vao:gl.createVertexArray(),buffer:gl.createBuffer(),next:0};cache.set(s.id,entry);}gl.bindVertexArray(entry.vao);gl.bindBuffer(gl.ARRAY_BUFFER,entry.buffer);if(time>=entry.next||entry.profileSeed!==profiles(s).seed){let data=room(s.interior);if(s.id!==pilot)data=data.concat(crew(s.interior,profiles(s),{fear:s.ai?.fear||0,hull:s.hp/s.hpMax,talking:s.id===talking},time,geometry));entry.opaque=data.length/6;data=data.concat(glass(s.interior));gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);entry.count=data.length/6;entry.next=time+.1;entry.profileSeed=profiles(s).seed;}gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);const pose=poseOf(s,time);gl.uniform3f(u.origin,s.x,s.y,s.z);gl.uniform3fv(u.ax,pose.ax);gl.uniform1f(u.angle,pose.ang);gl.uniform2f(u.yaw,Math.cos(s.yaw),Math.sin(s.yaw));gl.uniform1f(u.opacity,1);gl.drawArrays(gl.TRIANGLES,0,entry.opaque);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.uniform1f(u.opacity,.10);gl.drawArrays(gl.TRIANGLES,entry.opaque,entry.count-entry.opaque);gl.depthMask(true);gl.disable(gl.BLEND);}
 }
 return {draw,dispose(){for(const e of cache.values())drop(e);cache.clear();}};
}
const api={layout,room,crew,createRenderer};if(typeof module!=='undefined')module.exports=api;else root.ArmadaInteriors=api;
})(typeof window!=='undefined'?window:globalThis);
