const test=require('node:test'),assert=require('node:assert/strict');
const PX=require('../../armada-post-new.js');
const {loadBattle}=require('./headless-battle.cjs');

test('LOD selection has hysteresis and never flickers at the boundary',()=>{
  for(const dense of [false,true]){
    const up=dense?48:28;let level=1,changes=0;
    // A hull wobbling ±10% around the threshold keeps whatever level it has.
    for(let i=0;i<500;i++){const next=PX.lodLevel(up*(1+.1*Math.sin(i*.7)),level,dense);if(next!==level)changes++;level=next;}
    assert.equal(changes,0);
    assert.equal(PX.lodLevel(up*1.2,1,dense),0);assert.equal(PX.lodLevel(up*.8,0,dense),1);
    assert.equal(PX.lodLevel(up,0,dense),0);assert.equal(PX.lodLevel(up,1,dense),1);
  }
  assert.equal(PX.lodFade(10,10),0);assert.equal(PX.lodFade(10,10.36),1);assert.ok(PX.lodFade(10,10.2)>.5);
});

test('the page LOD path uses the same selection and crossfades both meshes',()=>{
  const b=loadBattle({modules:true});b.start(5,6,3,40);b.step(20);
  assert.equal(b.run('lodSelect(60,1,false)'),0);assert.equal(b.run('lodSelect(20,0,false)'),1);
  assert.ok(Math.abs(b.run('lodCrossfade(5,5.175)')-.5)<1e-9);
});

test('quality tiers are ordered, probe steps down on slow frames and up only with margin',()=>{
  const T=PX.ORDER.map(k=>PX.TIERS[k]);
  for(let i=1;i<T.length;i++){assert.ok(T[i].dprCap>=T[i-1].dprCap);assert.ok(T[i].msaa>=T[i-1].msaa);assert.ok(T[i].fleet>=T[i-1].fleet);assert.ok(T[i].nebula>=T[i-1].nebula);}
  const frames=ms=>Array(120).fill(ms);
  assert.equal(PX.probeVerdict('high',frames(16)),'high');
  assert.equal(PX.probeVerdict('high',frames(22)),'medium');
  assert.equal(PX.probeVerdict('high',frames(40)),'low');
  assert.equal(PX.probeVerdict('medium',frames(8)),'high');
  assert.equal(PX.probeVerdict('high',frames(8)),'high','never jumps to Ultra by itself');
  assert.equal(PX.guessTier({coarse:true,width:390}),'low');
  assert.equal(PX.guessTier({renderer:'ANGLE (Intel, Intel(R) UHD Graphics 620)'}),'medium');
  assert.equal(PX.guessTier({renderer:'ANGLE (NVIDIA GeForce RTX 3060)',cores:12}),'high');
  assert.equal(PX.guessTier({renderer:'SwiftShader'}),'low');
});

test('dynamic resolution drops on misses, climbs only when allowed, in 5% steps',()=>{
  let s=1;s=PX.nextScale(s,25,16.7,.6);assert.equal(s,.95);
  s=PX.nextScale(s,25,16.7,.6);assert.equal(s,.9);
  assert.equal(PX.nextScale(s,16.7,16.7,.6,false),.9,'blocked from climbing right after a drop');
  assert.equal(PX.nextScale(s,16.7,16.7,.6,true),.95);
  let low=1;for(let i=0;i<40;i++)low=PX.nextScale(low,90,16.7,.6);assert.equal(low,.6);
});

test('the weapons pass streams through one reused buffer and cleared scratch arrays',()=>{
  const b=loadBattle({modules:true});b.start(5,6,11,40);b.run('endIntro();lastT=1;for(let i=1;i<=60*50;i++)frame(1000+i*1000/60);');
  b.run('globalThis.__buf=streamF32;globalThis.__keys=scratchArrays.size;');
  b.run('for(let i=1;i<=60*10;i++)frame(1e6+i*1000/60);');
  assert.ok(b.run('streamF32===__buf'),'no reallocation in steady state');
  assert.equal(b.run('scratchArrays.size'),b.run('__keys'));
  assert.ok(b.run('scratchArrays.size')<=12);
  assert.ok(b.run('flashes.length')<=b.run('MAX_FLASHES'));
});
