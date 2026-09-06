(function(root){
'use strict';
function createVoice(env,onStatus=()=>{}){
 const synth=env.speechSynthesis;let enabled=false,generation=0,current=null,watchdog=null;
 const supported=!!(synth&&env.SpeechSynthesisUtterance);
 const stop=()=>{generation++;if(watchdog)env.clearTimeout(watchdog);watchdog=null;current=null;if(synth)synth.cancel();};
 function speak(name,line){
  if(!enabled||!line)return false;
  if(!supported){onStatus('unavailable');return false;}
  stop();const id=generation,utterance=new env.SpeechSynthesisUtterance(line);current=utterance;
  let hash=0;for(const c of name)hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;
  const voices=synth.getVoices().filter(v=>/^en(?:[-_]|$)/i.test(v.lang));
  if(voices.length)utterance.voice=voices[hash%voices.length];
  utterance.lang='en-US';utterance.volume=1;utterance.rate=.93;utterance.pitch=.85+(hash%5)*.07;
  utterance.onstart=()=>{if(id!==generation)return;if(watchdog)env.clearTimeout(watchdog);watchdog=null;onStatus('speaking');};
  utterance.onend=()=>{if(id!==generation)return;current=null;if(watchdog)env.clearTimeout(watchdog);watchdog=null;onStatus('ready');};
  utterance.onerror=()=>{if(id!==generation)return;if(watchdog)env.clearTimeout(watchdog);watchdog=null;current=null;onStatus('unavailable');};
  onStatus('starting');watchdog=env.setTimeout(()=>{if(id===generation)onStatus('unavailable');},5000);
  try{synth.resume();synth.speak(utterance);return true;}catch{stop();onStatus('unavailable');return false;}
 }
 return {speak,stop,setEnabled(value){enabled=value;stop();onStatus(value?(supported?'ready':'unavailable'):'muted');},get supported(){return supported;}};
}
if(typeof module!=='undefined')module.exports={createVoice};else root.StoryVoice={createVoice};
})(typeof window!=='undefined'?window:globalThis);
