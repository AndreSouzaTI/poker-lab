/* Poker Lab — efeitos sonoros sintetizados com Web Audio API (sem arquivos de áudio).
   Timbres suaves: tudo passa por um filtro passa-baixa + compressor leve, com ataques arredondados. */
"use strict";
const AU={ctx:null,on:true,vol:.6,unlocked:false,bus:null};
try{const a=JSON.parse(localStorage.getItem('pokerlab-audio'));if(a){AU.on=a.on;AU.vol=a.vol;}}catch(e){}
function ac(){if(!AU.unlocked||!AU.on)return null;
  if(!AU.ctx){
    const c=AU.ctx=new(window.AudioContext||window.webkitAudioContext)();
    const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=5200; lp.Q.value=.5;       // tira o brilho "estridente"
    const comp=c.createDynamicsCompressor(); comp.threshold.value=-20; comp.ratio.value=3; comp.attack.value=.005; comp.release.value=.15;
    const out=c.createGain(); out.gain.value=.8;
    lp.connect(comp); comp.connect(out); out.connect(c.destination); AU.bus=lp;
  }
  if(AU.ctx.state==='suspended')AU.ctx.resume(); return AU.ctx;}

/* ruído filtrado com ataque suave e queda natural */
function noise(dur,freq,q,gain,when=0,type='bandpass',att=.006){const c=ac();if(!c)return;const t=c.currentTime+when;
  const n=Math.ceil(c.sampleRate*dur),buf=c.createBuffer(1,n,c.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,1.6);
  const s=c.createBufferSource();s.buffer=buf;const f=c.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;
  const g=c.createGain();g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(gain*AU.vol,t+att);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(f).connect(g).connect(AU.bus);s.start(t);}
/* tom puro com ataque arredondado */
function tone(freq,dur,type,gain,when=0,slide,att=.012){const c=ac();if(!c)return;const t=c.currentTime+when;
  const o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+dur);
  const g=c.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain*AU.vol,t+att);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g).connect(AU.bus);o.start(t);o.stop(t+dur+.03);}
/* "toc" de ficha de cerâmica: pancada curta com ressonâncias amortecidas */
function clack(when=0,vol=1){const f=1500+Math.random()*700;
  tone(f,.07,'sine',.16*vol,when,f*.8,.002);
  tone(f*1.52,.05,'sine',.07*vol,when,undefined,.002);
  noise(.035,3000,.8,.14*vol,when,'lowpass',.002);}

const SFX={
  /* carta deslizando no feltro */
  deal:(w=0)=>{noise(.11,2200,.7,.32,w,'bandpass',.02);noise(.06,900,.6,.12,w+.015,'lowpass',.01);},
  /* carta virada: roçar + leve toque na mesa */
  flip:(w=0)=>{noise(.09,2000,.8,.28,w,'bandpass',.015);noise(.05,500,.8,.2,w+.07,'lowpass',.004);tone(210,.05,'sine',.12,w+.07,150,.003);},
  /* fichas: poucos toques irregulares */
  chips:(w=0,n=3)=>{let x=w;for(let k=0;k<n;k++){clack(x,.7+Math.random()*.5);x+=.045+Math.random()*.05;}},
  /* check: duas batidinhas com o nó dos dedos na mesa */
  check:()=>{[0,.12].forEach(w=>{tone(150,.1,'sine',.34,w,95,.004);noise(.05,500,.9,.2,w,'lowpass',.003);});},
  /* fold: carta arrastada para o monte */
  fold:()=>{noise(.2,1500,.6,.26,0,'bandpass',.04);noise(.12,700,.7,.1,.06,'lowpass',.02);},
  /* all-in: avalanche de fichas + batida grave suave */
  allin:()=>{SFX.chips(0,9);tone(95,.45,'sine',.2,.02,60,.03);},
  /* sua vez: sino suave de duas notas */
  turn:()=>{tone(660,.5,'sine',.13,0,undefined,.02);tone(990,.7,'sine',.07,.09,undefined,.02);},
  /* vitória: sino caloroso, notas espaçadas + fichas */
  win:()=>{[523,659,784].forEach((f,i)=>{tone(f,.9,'sine',.13,i*.12,undefined,.015);tone(f*2,.5,'sine',.035,i*.12,undefined,.015);});SFX.chips(.4,5);},
  lose:()=>{tone(330,.5,'sine',.1,0,undefined,.02);tone(262,.8,'sine',.1,.2,undefined,.02);},
  pot:()=>SFX.chips(0,5),
  /* contagem regressiva: toque de madeira, discreto */
  tick:()=>{tone(880,.07,'sine',.09,0,undefined,.003);noise(.02,1800,1,.05,0,'lowpass',.002);},
  /* tempo esgotado: duas notas graves, sem serrilhado */
  timeout:()=>{tone(247,.35,'sine',.16,0,undefined,.01);tone(185,.6,'sine',.16,.2,undefined,.01);},
  /* eliminação / explosão do troféu: estouro surdo, não agudo */
  boom:(w=0)=>{noise(.45,320+Math.random()*180,.6,.3,w,'lowpass',.01);tone(110,.4,'sine',.22,w,45,.008);noise(.2,2200,.8,.07,w+.05,'lowpass',.01);},
  /* top 3: sinos em arpejo, longos e suaves */
  fanfare:()=>{[523,659,784,1047,1319].forEach((f,i)=>{tone(f,1.1,'sine',.12,i*.16,undefined,.02);tone(f*2,.6,'sine',.03,i*.16,undefined,.02);});SFX.chips(.9,8);},
};
function unlockAudio(){if(AU.unlocked)return;AU.unlocked=true;ac();}
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,unlockAudio,{once:false,capture:true}));
