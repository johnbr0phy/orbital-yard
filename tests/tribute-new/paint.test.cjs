const test=require('node:test'),assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
test('all eighteen families and featured classes receive finite, distinct hull and trim',()=>{
 const b=loadBattle();const paints=b.run(`Array.from({length:18},(_,race)=>hullFinish({race,meta:buildHero(race,42).meta}))`);
 assert.equal(new Set(paints.map(p=>p.color.join(','))).size,18);
 for(const p of paints){assert.ok([...p.color,...p.trim,...p.accent,p.gloss,p.seed,p.pattern,p.surface].every(Number.isFinite));assert.ok(p.gloss>0&&p.pattern>=0);assert.notDeepEqual(p.color,p.trim);}
});
test('mixed convoy and fighter class identities override their family paint',()=>{
 const b=loadBattle(),paint=(race,klass)=>b.run(`hullFinish({race:${race},meta:{klass:${JSON.stringify(klass)}}})`);
 assert.equal(paint(5,'TIE ADVANCED X1').pattern,5);assert.ok(paint(5,'TIE/LN').trim.every(v=>v<.1));
 assert.notDeepEqual(paint(13,'MONDOSHAWAN').color,paint(13,'TAXI CAB').color);
 assert.equal(paint(13,'TAXI CAB').pattern,9);assert.equal(paint(13,'POLICE').surface,0);
 assert.notDeepEqual(paint(6,'A-WING').color,paint(6,'Y-WING').color);
});
test('disabled hull and subsequent fragments retain paint and original aspect',()=>{
 const b=loadBattle();b.start(5,6,915,12,[-1,-1]);b.run(`endIntro();var cap=ships.find(s=>s.hulls);cap.destroyMode='disabled';kill(cap,4);var hulk=wrecks.find(w=>w.src===cap.id);var paintBefore=JSON.stringify(hulk.paint);damageDebris(hulk,200,5,[hulk.x,hulk.y,hulk.z]);`);
 assert.ok(b.run('debrisQueue.length>0&&debrisQueue.every(w=>JSON.stringify(w.paint)===paintBefore&&w.paintAspect.every(Number.isFinite)&&w.paintLength===hulk.paintLength)'));
});
