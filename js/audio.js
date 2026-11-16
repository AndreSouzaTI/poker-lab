/* Poker Lab — efeitos sonoros sintetizados com Web Audio API (sem arquivos de áudio). */
"use strict";
/* ============ SONS (sintetizados, sem arquivos) ============ */
const AU={ctx:null,on:true,vol:.6,unlocked:false};
try{const a=JSON.parse(localStorage.getItem('pokerlab-audio'));if(a){AU.on=a.on;AU.vol=a.vol;}}catch(e){}
function ac(){if(!AU.unlocked||!AU.on)return null;
  if(!AU.ctx)AU.ctx=new(window.AudioContext||window.webkitAudioContext)();
  if(AU.ctx.state==='suspended')AU.ctx.resume(); return AU.ctx;}
function noise(dur,freq,q,gain,when=0){const c=ac();if(!c)return;const t=c.currentTime+when;
  const buf=c.createBuffer(1,Math.ceil(c.sampleRate*dur),c.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
  const s=c.createBufferSource();s.buffer=buf;const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=freq;f.Q.value=q;
  const g=c.createGain();g.gain.setValueAtTime(gain*AU.vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(f).connect(g).connect(c.destination);s.start(t);}
function tone(freq,dur,type,gain,when=0,slide){const c=ac();if(!c)return;const t=c.currentTime+when;
  const o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+dur);
  const g=c.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain*AU.vol,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g).connect(c.destination);o.start(t);o.stop(t+dur+.02);}
const SFX={
  deal:(w=0)=>{noise(.08,3200,1.1,.55,w);noise(.04,6000,2,.25,w+.02);},
  flip:(w=0)=>{noise(.07,2400,1,.5,w);noise(.05,1300,2.5,.35,w+.05);},
  chips:(w=0,n=3)=>{for(let k=0;k<n;k++){const x=w+k*.05+Math.random()*.02;tone(2600+Math.random()*1200,.06,'triangle',.13,x);noise(.03,5200,4,.22,x);}},
  check:()=>{tone(170,.08,'sine',.6);noise(.03,600,2,.3);tone(170,.08,'sine',.6,.13);noise(.03,600,2,.3,.13);},
  fold:()=>{noise(.22,800,.6,.35);noise(.15,1600,1,.15,.05);},
  allin:()=>{SFX.chips(0,8);tone(110,.5,'sawtooth',.08,0,70);},
  turn:()=>{tone(880,.16,'sine',.22);tone(1320,.3,'sine',.18,.12);},
  win:()=>{[523,659,784,1047].forEach((f,i)=>tone(f,.28,'triangle',.2,i*.1));SFX.chips(.35,6);},
  lose:()=>{tone(392,.25,'sine',.18);tone(311,.4,'sine',.18,.22);},
  pot:()=>SFX.chips(0,5),
};
function unlockAudio(){if(AU.unlocked)return;AU.unlocked=true;ac();}
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,unlockAudio,{once:false,capture:true}));

