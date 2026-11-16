/* Poker Lab — Torneio (MTT): estrutura de blinds, mesas, simulação das outras mesas,
   quebra/balanceamento de mesas, bolha, premiação e mesa final. */
"use strict";

/* [small blind, big blind, ante (BB ante: pago pelo big blind)] */
const LEVELS=[[50,100,0],[75,150,0],[100,200,200],[150,300,300],[200,400,400],[250,500,500],[300,600,600],[400,800,800],
  [500,1000,1000],[600,1200,1200],[800,1600,1600],[1000,2000,2000],[1500,3000,3000],[2000,4000,4000],[2500,5000,5000],
  [3000,6000,6000],[4000,8000,8000],[5000,10000,10000],[6000,12000,12000],[8000,16000,16000],[10000,20000,20000],
  [15000,30000,30000],[20000,40000,40000],[30000,60000,60000],[40000,80000,80000],[50000,100000,100000]];
const T_START=10000, BUYIN=100;
const NICKS=['Rafa_Nuts','ThiagoAA','Mineiro','Bruninho','LucasGTO','DaniShark','Carioca','Japa','Gaúcho','Paulista','ReiDoBlefe',
  'Marcelinho','Tatá','ZéDoRiver','Pedrão','Fefê','Baiano','Cearense','Nandinho','LuMaster','Gabi_3bet','Vini','Duda','Bia_Allin',
  'Caio','Leozin','Matheus_K','Juju','Renatão','Paulinha','Edu_Fish','Guto','Nina','Rodrigo','Carlão','Toninho','Lari','Felipe_F',
  'Kaká','Dudu','Manu','Serginho','Alemão','Polaco','Magrão','Tiago_T','Biel','Jessé','Camila','Rogério','Lipe','Diogo','Teté',
  'Marcão','Chico','Vavá','Nando','Bete','Zeca','Hugo','Ítalo','Otávio','Sabrina','Wesley','Yuri','Neto','Pri','Igor','Mel','Davi','Luan'];

const T={active:false,players:[],tables:[],field:0,hpl:8,level:0,inLevel:0,payouts:[],paid:0,elim:[],
  heroOut:false,finished:false,fast:false,flags:{},
  remaining(){return this.players.filter(p=>!p.out).length;},
  avgStack(){return this.field*T_START/Math.max(1,this.remaining());}};

const fmt=n=>Math.round(n).toLocaleString('pt-BR');
const money=n=>'$'+fmt(n);
function shuffled(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function emptySeat(){return {empty:true,name:'',stack:0,hole:[],bet:0,total:0,folded:true,allIn:false,acted:true,lastAction:''};}

function payoutTable(field){
  const paid=field<=6?2:field<=18?3:Math.round(field*.14), pool=field*BUYIN;
  const w=[...Array(paid)].map((_,k)=>1/(k+1)), sw=w.reduce((a,b)=>a+b,0);
  const pr=w.map(x=>Math.floor(pool*x/sw)); pr[0]+=pool-pr.reduce((a,b)=>a+b,0); return pr;
}
function setLevel(){const L=LEVELS[Math.min(T.level,LEVELS.length-1)]; SBL=L[0]; BB=L[1]; ANTE=L[2];}
function nextLevelTxt(){const L=LEVELS[Math.min(T.level+1,LEVELS.length-1)]; return `${fmt(L[0])}/${fmt(L[1])}${L[2]?' ('+fmt(L[2])+')':''}`;}

function startTournament(field,hpl){
  S.handNo++; S.handOver=true; clearTimeout(S.autoT);
  if(S.game==='cash'){S.cashSeats=S.players; hero.cashStack=hero.stack;}
  S.game='mtt';
  Object.assign(T,{active:true,field,hpl,level:0,inLevel:0,elim:[],heroOut:false,finished:false,fast:false,flags:{},
    payouts:payoutTable(field),movedHero:false,bustBy:null});
  T.paid=T.payouts.length;
  const names=shuffled(NICKS); while(names.length<field) names.push('Jogador'+names.length);
  hero.stack=T_START; hero.out=false; hero.place=0;
  const bots=[...Array(field-1)].map((_,k)=>{const cfg=randomProfile();return {name:names[k],cfg,style:cfg.style,stack:T_START,out:false};});
  T.players=[hero,...bots];
  S.players=[hero,...bots.slice(0,5)]; while(S.players.length<N) S.players.push(emptySeat());
  T.tables=[]; const rest=bots.slice(5);
  for(let k=0;k<rest.length;k+=6) T.tables.push({id:T.tables.length+2,seats:rest.slice(k,k+6),btn:Math.floor(Math.random()*6)});
  S.dealer=Math.floor(Math.random()*N); setLevel();
  $('#log').innerHTML='';
  log(`🏆 <b>Torneio começou!</b> ${field} jogadores, ${T.tables.length+1} mesas, ${fmt(T_START)} fichas (${T_START/BB} BB). Premiação: ${T.paid} lugares.`);
  syncGameUI(); startHand();
}
function leaveTournament(){
  S.handNo++; S.handOver=true; clearTimeout(S.autoT);
  T.active=false; S.game='cash'; BB=2; SBL=1; ANTE=0;
  S.players=S.cashSeats||S.players; hero.stack=hero.cashStack||START; hero.out=false;
  syncGameUI(); startHand();
}

function eliminate(p,where){
  const place=T.remaining(); p.out=true; p.place=place; p.prize=T.payouts[place-1]||0;
  T.elim.unshift({name:p.name,place,prize:p.prize});
  if(!T.fast&&(where==='hero'||place<=T.paid+3)) log(`💀 <b>${p.name}</b> foi eliminado em <b>${place}º</b>${p.prize?` e leva ${money(p.prize)}`:''}${where==='hero'?'':` (mesa ${where})`}.`);
}

/* Simula uma mão de uma mesa que não é a sua (modelo estatístico rápido, com cartas reais nos all-ins). */
function skill(p){return {reg:.55,lag:.55,nit:.5,fish:.42,maniac:.45}[Object.keys(PROFILES).find(k=>PROFILES[k]===p.cfg)]||.5;}
function simTableHand(t){
  const ps=t.seats.filter(Boolean); if(ps.length<2) return;
  t.btn=(t.btn+1)%ps.length; const n=ps.length;
  const sb=n===2?ps[t.btn]:ps[(t.btn+1)%n], bb=n===2?ps[(t.btn+1)%n]:ps[(t.btn+2)%n];
  let pot=0; const take=(p,a)=>{a=Math.min(a,p.stack);p.stack-=a;pot+=a;return a;};
  take(bb,ANTE); take(sb,SBL); take(bb,BB);
  const alive=ps.filter(p=>p.stack>0), r=Math.random(); let winner;
  const clash=(a,b)=>{const amt=Math.min(a.stack,b.stack); take(a,amt); take(b,amt);
    const d=shuffled([...Array(52).keys()]), bd=d.slice(4,9), ea=evaluate([d[0],d[1],...bd]).v, eb=evaluate([d[2],d[3],...bd]).v;
    return ea>eb?a:eb>ea?b:(Math.random()<.5?a:b);};
  const shorts=alive.filter(p=>p.stack<=12*BB);
  if(alive.length<2) winner=ps.find(p=>p.stack>0)||ps[0];
  else if(shorts.length&&r<.3){
    const sh=shorts[Math.floor(Math.random()*shorts.length)];
    const caller=shuffled(alive.filter(p=>p!==sh)).find(p=>Math.random()<(p.stack>sh.stack*2?.33:.18)*(p.cfg.call||1));
    winner=caller?clash(sh,caller):sh;
  } else if(r<.36){ const [a,b]=shuffled(alive); winner=clash(a,b); }
  else if(r<.75){ winner=alive[Math.floor(Math.random()*alive.length)]; }
  else { const [a,b]=shuffled(alive); const size=Math.round(BB*(2+Math.random()*10)*(.5+Math.random()));
    take(a,Math.min(size,Math.floor(a.stack*.5))); take(b,Math.min(size,Math.floor(b.stack*.5)));
    winner=Math.random()<skill(a)/(skill(a)+skill(b))?a:b; }
  winner.stack+=pot;
  ps.filter(p=>p.stack<=0).sort((a,b)=>a.stack-b.stack).forEach(p=>{eliminate(p,t.id);t.seats[t.seats.indexOf(p)]=null;});
}

/* ---------- quebra e balanceamento de mesas ---------- */
const heroCount=()=>S.players.filter(p=>!p.empty).length;
function tableList(){const L=T.tables.map(t=>({t,n:t.seats.filter(Boolean).length})); if(!T.heroOut) L.push({t:'hero',n:heroCount()}); return L;}
function addTo(t,p){ if(t==='hero'){const i=S.players.findIndex(x=>x.empty); S.players[i]=p;} else t.seats[t.seats.indexOf(null)]=p; }
function removeFrom(t,p){ if(t==='hero') S.players[S.players.indexOf(p)]=emptySeat(); else t.seats[t.seats.indexOf(p)]=null; }
function balance(){
  const need=Math.ceil(T.remaining()/6);
  while(T.tables.length&&tableList().length>need){
    const br=T.tables.slice().sort((a,b)=>a.seats.filter(Boolean).length-b.seats.filter(Boolean).length)[0];
    T.tables.splice(T.tables.indexOf(br),1);
    br.seats.filter(Boolean).forEach(p=>{const tg=tableList().filter(x=>x.n<6).sort((a,b)=>a.n-b.n)[0]; if(!tg) return; addTo(tg.t,p);
      if(tg.t==='hero'&&!T.fast) log(`🪑 <b>${p.name}</b> (${fmt(p.stack)}) chegou da mesa ${br.id} e sentou na sua mesa.`);});
    if(!T.fast) log(`🔨 Mesa ${br.id} foi quebrada. Restam ${tableList().length} mesa(s).`);
  }
  for(let k=0;k<30;k++){
    const L=tableList().sort((a,b)=>a.n-b.n); if(L.length<2) break;
    const lo=L[0], hi=L[L.length-1]; if(hi.n-lo.n<2) break;
    const pool=hi.t==='hero'?S.players.filter(p=>!p.empty&&!p.isHero):hi.t.seats.filter(Boolean);
    const p=pool[Math.floor(Math.random()*pool.length)]; removeFrom(hi.t,p); addTo(lo.t,p);
    if(!T.fast&&lo.t==='hero') log(`🪑 <b>${p.name}</b> (${fmt(p.stack)}) foi movido para a sua mesa (balanceamento).`);
    if(!T.fast&&hi.t==='hero') log(`🪑 <b>${p.name}</b> foi movido da sua mesa para a mesa ${lo.t.id} (balanceamento).`);
  }
}

/* ---------- depois de cada mão da sua mesa ---------- */
function tourneyAfterHand(){
  const busted=S.players.filter(p=>!p.empty&&p.stack<=0).sort((a,b)=>a.startStack-b.startStack);
  busted.forEach(p=>{ eliminate(p,'hero');
    if(p.isHero){T.heroOut=true; const w=S.players.find(x=>x.winner); T.bustBy=w?`${w.name}${w.handDesc?' ('+w.handDesc+')':''}`:'';}
    else S.players[S.players.indexOf(p)]=emptySeat(); });
  T.tables.forEach(simTableHand);
  T.inLevel++;
  if(T.inLevel>=T.hpl){T.level++;T.inLevel=0;setLevel();
    log(`⏫ <b>Nível ${T.level+1}</b>: blinds ${fmt(SBL)}/${fmt(BB)}${ANTE?` · ante ${fmt(ANTE)} (BB ante)`:''}`); $('#msg').textContent=`Blinds subiram: ${fmt(SBL)}/${fmt(BB)}`;}
  balance(); announce();
  if(T.remaining()===1) finishTournament();
  renderTourney();
  if(T.heroOut||T.finished) setTimeout(showResult,900);
}
function announce(){
  const R=T.remaining(), f=T.flags;
  if(!f.bubble&&R===T.paid+1){f.bubble=true; log(`🫧 <b>BOLHA!</b> O próximo eliminado sai sem prêmio. Hora do ICM: stacks médios devem evitar all-ins marginais.`); $('#msg').textContent='🫧 Bolha! O próximo a cair não ganha nada.';}
  if(!f.itm&&R<=T.paid){f.itm=true; log(`💰 <b>A bolha estourou!</b> Todos os ${R} restantes estão na premiação (ITM).`); $('#msg').textContent='💰 Bolha estourou: você está ITM!'; if(!T.heroOut) SFX.win();}
  if(!f.ft&&!T.heroOut&&T.tables.length===0&&R>1&&R<=6){f.ft=true; log(`🏆 <b>MESA FINAL!</b> ${R} jogadores disputando ${money(T.payouts[0])}.`); $('#msg').textContent='🏆 MESA FINAL!';}
}
function finishTournament(){
  const w=T.players.find(p=>!p.out); if(w){w.place=1;w.prize=T.payouts[0];w.out=true;T.elim.unshift({name:w.name,place:1,prize:w.prize});}
  T.finished=true; if(!T.fast) log(`🥇 <b>${w.name}</b> é o campeão e leva ${money(w.prize)}!`);
}
function recordResult(){
  if(T.recorded) return; T.recorded=true;
  ST.tourneys=ST.tourneys||[]; ST.tourneys.unshift({field:T.field,place:hero.place,prize:hero.prize||0,d:Date.now()});
  ST.tourneys=ST.tourneys.slice(0,50); saveStats();
}
function simulateToEnd(){
  if(!T.movedHero){const bots=S.players.filter(p=>!p.empty&&!p.isHero);
    if(bots.length) T.tables.push({id:1,seats:[...bots,...Array(6-bots.length).fill(null)],btn:0});
    S.players=S.players.map(p=>p.isHero?p:emptySeat()); T.movedHero=true;}
  T.fast=true; let g=0;
  while(T.remaining()>1&&g++<100000){T.tables.forEach(simTableHand); T.inLevel++; if(T.inLevel>=T.hpl){T.level++;T.inLevel=0;setLevel();} balance();}
  finishTournament(); T.fast=false; renderTourney(); showResult();
}

/* ---------- interface do torneio ---------- */
function mZone(m){return m>=20?['Verde','var(--green)','Jogue normal: todas as opções abertas.']:m>=10?['Amarela','#d29922','Comece a perder mãos especulativas (pares baixos, suited connectors).']:
  m>=6?['Laranja','#f0883e','Fase de re-shove: pressione com all-ins sobre aumentos.']:m>=1?['Vermelha','var(--red)','Push/fold: all-in ou fold. Não dê limp nem aumento pequeno.']:['Morta','var(--red)','Qualquer mão decente é all-in.'];}
function renderTourney(){
  const el=$('#tpanel'); if(!T.active){el.style.display='none';return;} el.style.display='';
  const R=T.remaining(), alive=T.players.filter(p=>!p.out).sort((a,b)=>b.stack-a.stack);
  const rank=alive.indexOf(hero)+1, avg=T.avgStack(), M=hero.stack/(SBL+BB+ANTE), [zn,zc,zt]=mZone(M);
  const status=T.finished?'🏁 Torneio encerrado':T.heroOut?`❌ Você saiu em ${hero.place}º`:R<=T.paid?'💰 ITM: você está na premiação!':R===T.paid+1?'🫧 BOLHA':`Faltam ${R-T.paid} eliminações para a premiação`;
  let h=`<div class="kv"><b>${status}</b></div>
  <div class="grid" style="margin-top:6px">
    <div class="kv"><span>Nível</span><b>${T.level+1}</b></div>
    <div class="kv"><span>Blinds</span><b>${fmt(SBL)}/${fmt(BB)}${ANTE?' ('+fmt(ANTE)+')':''}</b></div>
    <div class="kv"><span>Próximo</span><b>${nextLevelTxt()}</b></div>
    <div class="kv"><span>Sobe em</span><b>${T.hpl-T.inLevel} mão(s)</b></div>
    <div class="kv"><span>Jogadores</span><b>${R}/${T.field}</b></div>
    <div class="kv"><span>Mesas</span><b>${tableList().length}</b></div>
    <div class="kv"><span>Sua posição</span><b>${T.heroOut?hero.place+'º':rank+'º'}</b></div>
    <div class="kv"><span>Stack médio</span><b>${fmt(avg)} (${(avg/BB).toFixed(0)} BB)</b></div></div>`;
  if(!T.heroOut) h+=`<div class="kv" style="margin-top:6px" title="M = seu stack ÷ (SB + BB + antes): quantas voltas você aguenta sem jogar"><span>Seu M (Harrington)</span><b style="color:${zc}">${M.toFixed(1)} · zona ${zn}</b></div><div class="muted" style="font-size:12px">${zt}</div>`;
  h+=`<h4>💰 Premiação (${T.paid} lugares · total ${money(T.field*BUYIN)})</h4><div>${T.payouts.map((v,k)=>`<span class="tag ${hero.place===k+1?'good':''}">${k+1}º ${money(v)}</span>`).join('')}</div>`;
  h+=`<h4>📈 Líderes em fichas</h4><ol class="l">${alive.slice(0,5).map(p=>`<li>${p.isHero?'<b>Você</b>':p.name} — ${fmt(p.stack)} <span class="muted">(${(p.stack/BB).toFixed(0)} BB)</span></li>`).join('')}</ol>`;
  if(T.elim.length) h+=`<h4>💀 Últimas eliminações</h4><ul class="l">${T.elim.slice(0,5).map(e=>`<li>${e.place}º ${e.name}${e.prize?' · '+money(e.prize):''}</li>`).join('')}</ul>`;
  const tt=ST.tourneys||[]; if(tt.length){const itm=tt.filter(x=>x.prize>0).length, roi=tt.reduce((a,x)=>a+x.prize-BUYIN,0);
    h+=`<h4>🗂️ Seus torneios</h4><div class="grid"><div class="kv"><span>Jogados</span><b>${tt.length}</b></div><div class="kv"><span>ITM</span><b>${Math.round(itm/tt.length*100)}%</b></div>
    <div class="kv"><span>Melhor</span><b>${Math.min(...tt.map(x=>x.place))}º</b></div><div class="kv"><span>Lucro</span><b style="color:${roi>=0?'var(--green)':'var(--red)'}">${roi>=0?'+':''}${money(roi)}</b></div></div>`;}
  $('#tbody').innerHTML=h;
  $('.felt .brand').textContent=`TORNEIO · NÍVEL ${T.level+1} · ${fmt(SBL)}/${fmt(BB)}${ANTE?' ('+fmt(ANTE)+')':''}`;
}
function showResult(){
  if(!T.active) return; recordResult();
  const champ=T.players.find(p=>p.place===1);
  let h=hero.place===1?`<h2 style="color:var(--gold);margin:4px 0">🥇 VOCÊ É O CAMPEÃO!</h2>`:`<h2 style="margin:4px 0">Você terminou em <span style="color:var(--gold)">${hero.place}º</span> de ${T.field}</h2>`;
  h+=`<div>${hero.prize?`💰 Prêmio: <b style="color:var(--green)">${money(hero.prize)}</b> (buy-in ${money(BUYIN)})`:'Sem prêmio desta vez — faltou pouco? Veja no histórico o que aconteceu.'}</div>`;
  if(T.bustBy&&hero.place>1) h+=`<div class="muted">Eliminado por ${T.bustBy}.</div>`;
  if(!T.finished) h+=`<p>O torneio continua com <b>${T.remaining()}</b> jogadores.</p>`;
  else{ h+=`<p>🏆 Campeão: <b>${champ?champ.name:''}</b></p><h4>Classificação final</h4><ol class="l">${T.elim.filter(e=>e.place<=Math.max(T.paid,6)).sort((a,b)=>a.place-b.place).map(e=>`<li>${e.name===hero.name?'<b>Você</b>':e.name}${e.prize?' — '+money(e.prize):''}</li>`).join('')}</ol>`;}
  $('#rbody').innerHTML=h; $('#bSimEnd').style.display=T.finished?'none':'';
  if(!$('#rdlg').open) $('#rdlg').showModal();
}
