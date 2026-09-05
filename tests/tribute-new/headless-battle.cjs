/* Executes the page's real setup, forge, combat and frame functions. WebGL and
   DOM calls are inert. The procedural forge supplies real hull dimensions,
   mounts and classes; tessellation is replaced by boxes for fast physics runs.
   This is a simulation test, not a browser or GPU rendering test. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const AI = require('../../armada-battle-ai-new.js');
const html = fs.readFileSync(path.join(__dirname, '../../armada-war-tribute-new.html'), 'utf8');
const source = html.slice(html.indexOf('\n<script>\n') + 10, html.lastIndexOf('</script>'));
new vm.Script(source, {filename: 'armada-war-tribute.html'});

function loadBattle() {
  const elements = new Map(), jobs = [], blobs = new Map();
  const noop = () => {};
  const gl = new Proxy({}, {get: (o, k) => {
    if (k in o) return o[k];
    if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
    if (k.startsWith('create') || k === 'getUniformLocation') return () => ({});
    if (/^[A-Z_0-9]+$/.test(k)) return 1;
    return noop;
  }});
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const e = {id, style: {setProperty: noop}, classList: {add:noop,remove:noop,toggle:noop,contains:()=>false},
      value:'',dataset:{},innerHTML:'',textContent:'',width:1280,height:720,addEventListener:noop,
      appendChild:noop,setAttribute:noop,querySelectorAll:()=>[],querySelector:()=>null,
      getContext:()=>gl,getBoundingClientRect:()=>({width:1280,height:720,left:0,top:0}),
      closest:()=>null,setPointerCapture:noop,releasePointerCapture:noop};
    elements.set(id,e);return e;
  }
  const storage = {getItem:()=>null,setItem:noop};
  const context = vm.createContext({console,ArmadaBattleAI:AI,performance:{now:()=>0},
    document:{getElementById:element,querySelectorAll:s=>s==='script'?[{textContent:source}]:[],
      querySelector:s=>s==='script'?{textContent:source}:element(s),createElement:()=>element('new'),
      documentElement:element('html'),body:element('body'),head:element('head')},
    location:{hostname:'localhost',protocol:'http:',search:'',pathname:'/'},
    localStorage:storage,sessionStorage:storage,URLSearchParams,
    navigator:{hardwareConcurrency:3},innerWidth:1280,innerHeight:720,devicePixelRatio:1,
    addEventListener:noop,requestAnimationFrame:noop,cancelAnimationFrame:noop,
    setTimeout:noop,clearTimeout:noop,setInterval:noop,clearInterval:noop,
    matchMedia:()=>({matches:false,addEventListener:noop}),
    Blob:class {constructor(parts){this.source=parts.join('');}},
    URL:{createObjectURL:b=>{const id='blob:'+blobs.size;blobs.set(id,b.source);return id;},revokeObjectURL:noop},
    Worker:class {constructor(url){this.source=blobs.get(url);}postMessage(data){jobs.push({worker:this,data});}terminate(){}},
  });
  context.window = context;
  vm.runInContext(source, context, {filename:'armada-war-tribute.html'});
  const run = code => vm.runInContext(code,context);
  const workerContexts = new Map();
  function flush() {
    while(jobs.length) {
      const {worker,data} = jobs.shift();
      let ctx = workerContexts.get(worker);
      if (!ctx) {
        ctx = vm.createContext({console,postMessage:out=>worker.onmessage({data:out})});
        vm.runInContext(worker.source,ctx);
        vm.runInContext(`packMesh=function(ship,c){
          const bb=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]],v=new Float32Array(24);
          for(const part of ship.parts)for(const [p,r] of partExtents(part))for(let d=0;d<3;d++){
            bb[0][d]=Math.min(bb[0][d],p[d]-r);bb[1][d]=Math.max(bb[1][d],p[d]+r);
          }
          if(!Number.isFinite(bb[0][0])){bb[0]=ship.bb[0];bb[1]=ship.bb[1];}
          for(let i=0;i<8;i++)for(let d=0;d<3;d++)v[i*3+d]=bb[(i>>d)&1][d]-c[d];
          return {v,i:new Uint32Array([0,1,2,1,3,2,4,6,5,5,6,7]),tris:4};
        };`,ctx);
        workerContexts.set(worker,ctx);
      }
      ctx.input = data;
      vm.runInContext('onmessage({data:input})',ctx);
    }
  }
  function start(a,b,seed=42,size=48,allies=[-1,-1]) {
    run(`pickMain=[${a},${b}];pickAlly=${JSON.stringify(allies)};perFleet=${size};warSeed=${seed};startWar(false);`);
    flush();
    return run('ships.length');
  }
  function step(seconds) {
    for(let i=0;i<Math.round(seconds*30);i++){
      run('battleTime+=1/30;simStep(battleTime,1/30);introStep(battleTime,1/30);');
      if(jobs.length)flush();
    }
  }
  return {run,start,step,flush,context,elements};
}
module.exports = {loadBattle};
if(require.main===module){
  const b=loadBattle();console.log('ships',b.start(0,1));b.step(10);
  console.log(b.run('({time:battleTime,counts,actions:battleAI.stats.actions})'));
}
