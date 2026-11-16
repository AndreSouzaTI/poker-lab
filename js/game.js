/* Poker Lab — estado da mesa, fluxo das apostas, IA dos bots, coach e interface. */
"use strict";
const $=s=>document.querySelector(s);

/* ============ ESTADO ============ */
const BOTS=[
  {name:'Rocha',style:'Tight-Passivo ("nit")',open:1.5,agg:.12,bluff:.03,call:.06,tip:'Só entra com mãos fortes. Se ele aposta alto, respeite.'},
  {name:'Tubarão',style:'Tight-Agressivo (TAG)',open:0,agg:.55,bluff:.12,call:.02,tip:'Estilo vencedor: poucas mãos, muita agressividade.'},
  {name:'Maníaco',style:'Loose-Agressivo (LAG)',open:-2,agg:.75,bluff:.28,call:-.03,tip:'Aposta e blefa muito. Pague mais "leve" contra ele.'},
  {name:'Peixe',style:'Calling station (Loose-Passivo)',open:-3,agg:.06,bluff:.02,call:-.1,tip:'Paga tudo, quase nunca blefa. Aposte por valor; NÃO blefe.'},
  {name:'Professor',style:'Equilibrado (estilo GTO)',open:0,agg:.4,bluff:.1,call:0,tip:'Joga balanceado; difícil de ler.'},
];
const SEATPOS=[[50,87],[9,64],[15,20],[50,8],[85,20],[91,64]];
let S={players:[],dealer:Math.floor(Math.random()*N),board:[],deck:[],street:0,currentBet:0,minRaise:BB,toAct:-1,raises:0,handOver:true,handNo:0,mode:'learn',xray:false,showdown:false,pfAggr:-1,bbI:0,rec:null,decisions:[]};
S.players.push({name:'Você',isHero:true,stack:START});
BOTS.forEach(b=>S.players.push({name:b.name,style:b.style,cfg:b,stack:START}));
const hero=S.players[0];
const STREET=['Pré-flop','Flop','Turn','River'];
const next=i=>(i+1)%N;
const posName=i=>['BTN','SB','BB','UTG','MP','CO'][(i-S.dealer+N)%N];
const potTotal=()=>S.players.reduce((a,p)=>a+p.total,0);
const liveP=()=>S.players.filter(p=>!p.folded);
const delay=()=>+$('#speed').value;

let ST;
function freshStats(){return {hands:0,won:0,net:0,vpip:0,pfr:0,sd:0,sdWon:0,dec:0,good:0,mist:{},byHand:{},losses:[]};}
try{ST=JSON.parse(localStorage.getItem('pokerlab-stats'))||freshStats();}catch(e){ST=freshStats();}
function saveStats(){try{localStorage.setItem('pokerlab-stats',JSON.stringify(ST));}catch(e){}}

function log(h){const d=document.createElement('div');d.innerHTML=h;const L=$('#log');L.prepend(d);while(L.children.length>80)L.lastChild.remove();}

/* ============ FLUXO DA MÃO ============ */
function startHand(){
  clearTimeout(S.autoT);
  S.handNo++; S.handOver=false; S.showdown=false; S.board=[]; S.street=0; S.raises=0; S.pfAggr=-1; S.decisions=[]; S.rec=null;
  S.players.forEach(p=>{
    if(p.stack<=0){ p.stack=START; log(`<b>${p.name}</b> fez recompra (rebuy) de ${START}.`); if(p.isHero) ST.net-=0; }
    Object.assign(p,{hole:[],bet:0,total:0,folded:false,allIn:false,acted:false,lastAction:'',winner:false,handDesc:'',startStack:p.stack,vp:false,pr:false});
  });
  S.dealer=next(S.dealer);
  const sb=next(S.dealer), bb=next(sb); S.bbI=bb;
  S.deck=[...Array(52).keys()]; for(let i=51;i>0;i--){const j=Math.floor(Math.random()*(i+1));[S.deck[i],S.deck[j]]=[S.deck[j],S.deck[i]];}
  for(let r=0;r<2;r++) for(let k=1;k<=N;k++){ S.players[(S.dealer+k)%N].hole.push(S.deck.pop()); SFX.deal((r*N+k-1)*.07); }
  SFX.chips(.9,2);
  post(sb,SBL); post(bb,BB); S.players[sb].lastAction='SB '+SBL; S.players[bb].lastAction='BB '+BB;
  S.currentBet=BB; S.minRaise=BB; S.toAct=next(bb);
  $('#log').innerHTML=''; log(`<b>Mão #${S.handNo}</b> — Você está no <b>${posName(0)}</b> com <b>${notation(hero.hole).replace(/T/g,'10')}</b>`);
  $('#msg').textContent=''; $('#beat').style.display='none';
  loop();
}
function post(i,a){const p=S.players[i];a=Math.min(a,p.stack);p.stack-=a;p.bet+=a;p.total+=a;if(p.stack===0)p.allIn=true;}
function roundComplete(){
  const can=S.players.filter(p=>!p.folded&&!p.allIn);
  if(can.length===0) return true;
  if(can.length===1) return can[0].bet>=S.currentBet;
  return can.every(p=>p.acted&&p.bet===S.currentBet);
}
function loop(){
  if(S.handOver) return;
  const live=liveP();
  if(live.length===1) return winUncontested(live[0]);
  if(roundComplete()){ const hid=S.handNo; render(); setTimeout(()=>{if(hid===S.handNo&&!S.handOver)nextStreet();},Math.max(350,delay()*.8)); return; }
  const p=S.players[S.toAct];
  if(p.folded||p.allIn){S.toAct=next(S.toAct);return loop();}
  if(p.isHero){ S.rec=advise(); render(); renderCoach(); SFX.turn(); return; }
  render();
  const hid=S.handNo;
  setTimeout(()=>{ if(hid!==S.handNo||S.handOver) return; act(p,botDecide(p)); },delay());
}
function act(p,d){
  const i=S.players.indexOf(p), toCall=S.currentBet-p.bet;
  if(d.type==='check'&&toCall>0) d={type:'call'};
  if(d.type==='call'&&toCall===0) d={type:'check'};
  if(d.type==='raise'){
    const maxTo=p.bet+p.stack, minTo=S.currentBet+S.minRaise;
    let to=Math.min(Math.round(d.to),maxTo); if(to<minTo) to=Math.min(minTo,maxTo);
    if(to<=S.currentBet) d={type:toCall>0?'call':'check'}; else d.to=to;
  }
  if(d.type==='fold'){p.folded=true;p.lastAction='Fold';}
  else if(d.type==='check'){p.lastAction='Check';}
  else if(d.type==='call'){post(i,toCall);p.lastAction=p.allIn?'All-in '+p.total:'Call '+p.bet; if(S.street===0)p.vp=true;}
  else { const to=d.to, by=to-S.currentBet, wasBet=S.currentBet===0;
    if(by>=S.minRaise) S.minRaise=by;
    post(i,to-p.bet); S.currentBet=to; S.raises++;
    S.players.forEach(o=>{if(o!==p)o.acted=false;});
    p.lastAction=(p.allIn?'ALL-IN ':'')+(wasBet?'Aposta ':'Aumenta p/ ')+to;
    if(S.street===0){p.vp=true;p.pr=true;S.pfAggr=i;}
  }
  p.acted=true;
  if(d.type==='fold') SFX.fold(); else if(d.type==='check') SFX.check(); else if(p.allIn) SFX.allin(); else SFX.chips(0,d.type==='raise'?5:3);
  let tip='';
  if(S.mode==='learn'&&!p.isHero){
    if(d.type==='raise'&&S.street===0&&S.raises===2) tip=' <i>(3-bet: re-aumento, range forte ou blefe)</i>';
    else if(d.type==='raise'&&S.street===0&&['UTG','MP'].includes(posName(i))) tip=' <i>(aumento de posição inicial = mão forte)</i>';
    else if(d.type==='raise'&&S.street===1&&S.pfAggr===i) tip=' <i>(c-bet: continuação de quem aumentou no pré)</i>';
  }
  log(`<b>${p.name}</b> <span class="muted">[${posName(i)}]</span>: ${p.lastAction}${tip}`);
  S.toAct=next(i);
  loop();
}
function nextStreet(){
  S.players.forEach(p=>{p.bet=0;p.acted=false;if(!p.folded&&!p.allIn)p.lastAction='';});
  S.currentBet=0;S.minRaise=BB;S.raises=0;
  if(S.street===3) return showdown();
  S.street++; S.deck.pop();
  const n=S.street===1?3:1; for(let k=0;k<n;k++){ S.board.push(S.deck.pop()); SFX.flip(k*.12); }
  log(`— <b>${STREET[S.street]}</b>: ${S.board.map(cardTxt).join(' ')}`);
  let i=next(S.dealer); while(S.players[i].folded||S.players[i].allIn){i=next(i); if(i===next(S.dealer))break;}
  S.toAct=i; loop();
}
function winUncontested(p){
  const pot=potTotal(); p.stack+=pot; p.winner=true; S.handOver=true;
  $('#msg').textContent=`${p.name} leva ${pot} (todos desistiram)`;
  log(`🏆 <b>${p.name}</b> ganha ${pot} sem showdown.`);
  endHand(false);
}
function showdown(){
  S.handOver=true; S.showdown=true;
  const live=liveP(); live.forEach(p=>{p.ev=evaluate(p.hole.concat(S.board));p.handDesc=describe(p.ev);});
  const levels=[...new Set(S.players.map(p=>p.total).filter(t=>t>0))].sort((a,b)=>a-b);
  let prev=0; const msgs=[];
  for(const L of levels){
    let amt=0; S.players.forEach(p=>amt+=Math.max(0,Math.min(p.total,L)-prev));
    let elig=live.filter(p=>p.total>=L); if(!elig.length) elig=live;
    prev=L; if(amt<=0) continue;
    const best=Math.max(...elig.map(p=>p.ev.v)), w=elig.filter(p=>p.ev.v===best);
    const share=Math.floor(amt/w.length); w.forEach((p,k)=>{p.stack+=share+(k===0?amt-share*w.length:0);p.winner=true;});
    msgs.push(`${w.map(p=>p.name).join(' & ')} ${w.length>1?'dividem':'ganha'} ${amt} com ${w[0].handDesc}`);
  }
  live.forEach(p=>log(`👁 <b>${p.name}</b>: ${p.hole.map(cardTxt).join(' ')} → ${p.handDesc}`));
  msgs.forEach(m=>log('🏆 '+m));
  $('#msg').textContent=msgs.join(' · ');
  endHand(true);
}
function endHand(sd){
  const net=hero.stack-hero.startStack, nm=notation(hero.hole);
  setTimeout(()=>{ if(hero.winner) SFX.win(); else if(net<0&&!hero.folded) SFX.lose(); else SFX.pot(); },250);
  ST.hands++; ST.net+=net; if(net>0)ST.won++; if(hero.vp)ST.vpip++; if(hero.pr)ST.pfr++;
  ST.byHand[nm]=(ST.byHand[nm]||0)+net/BB;
  if(sd&&!hero.folded){ST.sd++; if(hero.winner)ST.sdWon++;
    else{const w=S.players.filter(p=>p.winner)[0];
      ST.losses.unshift(`Perdeu ${(-net/BB).toFixed(0)} BB com <b>${hero.handDesc}</b> (${nm}) para ${w.name} — <b>${w.handDesc}</b>`);
      ST.losses=ST.losses.slice(0,8);}}
  saveStats(); render(); renderReview(net,sd);
  if($('#auto').checked) S.autoT=setTimeout(startHand,S.mode==='learn'?4500:2200);
}

/* ============ IA DOS BOTS ============ */
function limpers(){return S.players.filter((p,i)=>!p.folded&&i!==S.bbI&&p.bet===BB&&S.raises===0).length;}
function botDecide(p){
  const i=S.players.indexOf(p), toCall=S.currentBet-p.bet, pot=potTotal(), st=p.cfg, r=Math.random;
  const raiseTo=t=>({type:'raise',to:t});
  if(S.street===0){
    const ch=chen(p.hole)+(r()*2-1), pos=posName(i), th=OPEN_TH[pos]+st.open;
    if(S.raises===0){
      if(ch>=th) return raiseTo(BB*(2.5+Math.round(r()))+limpers()*BB);
      if(toCall===0) return {type:'check'};
      if(ch>=th-2&&(pos==='SB'||st.call<0)&&r()<.5) return {type:'call'};
      return {type:'fold'};
    }
    if(S.raises===1){
      if(ch>=12-st.agg*3) return raiseTo(S.currentBet*3);
      if(ch>=th+2||(isPair(p.hole)&&toCall<=p.stack*.1)||(pos==='BB'&&ch>=th+1)) return {type:'call'};
      return {type:'fold'};
    }
    if(ch>=14) return raiseTo(S.currentBet*2.4);
    if(ch>=11-st.agg) return {type:'call'};
    return {type:'fold'};
  }
  const opp=liveP().length-1, eq=equity(p.hole,S.board,opp,400);
  if(toCall===0){
    if(eq>.7){ if(r()<.12) return {type:'check'}; return raiseTo(pot*(.55+r()*.25)); }
    if(eq>.5&&r()<.3+st.agg*.5) return raiseTo(pot*(.4+r()*.25));
    if(r()<st.bluff) return raiseTo(pot*(.45+r()*.3));
    return {type:'check'};
  }
  const odds=toCall/(pot+toCall);
  if(eq>.78&&r()<.35+st.agg*.6) return raiseTo(S.currentBet+(pot+toCall)*.75);
  if(eq>=odds+st.call) return {type:'call'};
  if(r()<st.bluff*.3&&S.street<3) return raiseTo(S.currentBet*2.5);
  return {type:'fold'};
}

/* ============ COACH ============ */
function inPosition(i){const ord=j=>(j-S.dealer+N-1)%N; return liveP().every(p=>ord(S.players.indexOf(p))<=ord(i));}
function preflopAdvice(){
  const p=hero,pos=posName(0),ch=chen(p.hole),nm=notation(p.hole).replace(/T/g,'10'),toCall=S.currentBet-p.bet,th=OPEN_TH[pos],lp=limpers(),pair=isPair(p.hole),late=pos==='BTN'||pos==='CO',maxTo=p.bet+p.stack;
  let a,ok,title,why,size;
  if(S.raises===0){
    if(ch>=th||(pos==='BB'&&ch>=9)){size=Math.min(maxTo,Math.round(BB*(pos==='BB'||pos==='SB'?3:2.5)+lp*BB));a='raise';ok=['raise'];
      title=`AUMENTE para ${size} (open-raise)`;
      why=`${nm} (Chen ${ch}) está no range de abertura do ${pos} (mínimo ${th}). Tamanho padrão: 2,5–3 BB${lp?` + 1 BB por limper (${lp})`:''}. Entrar aumentando dá iniciativa e chance de ganhar sem showdown.`;}
    else if(toCall===0){a='check';ok=['check'];title='CHECK (veja o flop de graça)';why='Você está no BB e ninguém aumentou. Sua mão não é forte para aumentar: veja o flop sem pagar nada.';}
    else if(pos==='SB'&&ch>=th-2&&lp===0){a='call';ok=['call','fold'];title='Completar (limp) ou fold';why='No SB você já pôs meia aposta. Com mão marginal, completar é aceitável, mas vai jogar fora de posição.';}
    else{a='fold';ok=['fold'];title='DESISTA (fold)';why=`${nm} (Chen ${ch}) está abaixo do range do ${pos} (precisa ${th}+). Evite "limpar" (só pagar o BB): é o erro mais caro de iniciante.`;}
  } else if(S.raises===1){
    if(ch>=12||(ch>=10&&late)){size=Math.min(maxTo,Math.round(S.currentBet*(late?3:3.5)));a='raise';ok=ch>=12?['raise']:['raise','call'];
      title=`3-BET para ~${size}`;why=`Alguém aumentou e ${nm} é forte o bastante para re-aumentar (3-bet). ${late?'Em posição, ~3x':'Fora de posição, ~3,5–4x'} o aumento.`;}
    else if(ch>=th+2||(pos==='BB'&&ch>=th)||(pair&&toCall<=p.stack*.08)){a='call';ok=['call'];title=`PAGUE ${Math.min(toCall,p.stack)} (call)`;
      why=pair&&ch<th+2?'<b>Set mining</b>: com par pequeno você paga barato esperando a trinca (~12% no flop). Regra 15-20x: só vale se as fichas efetivas forem ≥15x o valor pago.':`Mão boa para pagar o aumento e ver o flop${pos==='BB'?' (o BB tem desconto: já pôs 1 BB)':''}.`;}
    else{a='fold';ok=['fold'];title='DESISTA (fold)';why=`Contra um aumento o range precisa ser mais forte. ${nm} (Chen ${ch}) não basta aqui.`;}
  } else {
    if(ch>=14){a='raise';ok=['raise','call'];size=Math.min(maxTo,Math.round(S.currentBet*2.4));title='4-BET / ALL-IN';why=`${nm} é premium (QQ+, AKs). Contra re-aumentos, pressão máxima.`;}
    else if(ch>=10){a='call';ok=['call','fold'];title='Call (ou fold) — cuidado';why='Houve 3-bet: o range do vilão é muito forte. Pagar é aceitável com mãos fortes, não premium.';}
    else{a='fold';ok=['fold'];title='DESISTA (fold)';why='Pote re-aumentado (3-bet+). Só continue com mãos muito fortes.';}
  }
  return {action:a,ok,title,why,size};
}
function advise(){
  const p=hero, opp=liveP().length-1, toCall=S.currentBet-p.bet, pot=potTotal(), maxTo=p.bet+p.stack;
  const eqRaw=equity(p.hole,S.board,opp,S.street===0?1200:2000);
  const eq=toCall>0&&S.street>0?eqRaw*.85:eqRaw;
  const odds=toCall>0?Math.min(toCall,p.stack)/(pot+Math.min(toCall,p.stack)):0;
  const outs=calcOuts(p.hole,S.board), ip=inPosition(0), aggr=S.pfAggr===0;
  let r;
  if(S.street===0) r=preflopAdvice();
  else{
    let a,ok,title,why,size;
    if(toCall===0){
      if(eq>=.65){a='raise';ok=['raise'];size=Math.round(pot*.66);title=`APOSTE ~${size} (2/3 do pote) — value bet`;why=`Você está à frente de muitas mãos (${pct(eq)}). Aposte para ser pago por mãos piores e não dar carta grátis.`;}
      else if(eq>=.5){a='raise';ok=['raise','check'];size=Math.round(pot*.5);title=`Aposte ~${size} (1/2 pote) ou check`;why='Mão razoável: aposta média por valor fino/proteção. Contra vários oponentes, check também é ok.';}
      else if(outs&&outs.total>=8&&(ip||aggr)){a='raise';ok=['raise','check'];size=Math.round(pot*.5);title=`SEMI-BLEFE de ~${size} (1/2 pote)`;why=`Você tem projeto com ${outs.total} outs. Apostando pode ganhar agora (todos desistem) OU completar a mão depois.`;}
      else if(aggr&&S.street===1&&opp===1&&eq>=.3){a='raise';ok=['raise','check'];size=Math.max(BB,Math.round(pot*.33));title=`C-BET de ~${size} (1/3 pote) ou check`;why='Você foi o agressor pré-flop (tem a iniciativa). Contra 1 oponente, uma continuation bet pequena ganha muitos potes.';}
      else{a='check';ok=['check'];title='CHECK (passe a vez)';why='Mão fraca/marginal: veja a próxima carta de graça. Não infle o pote sem mão.';}
    } else {
      if(eq>=.72){a='raise';ok=['raise','call'];size=Math.min(maxTo,Math.round(S.currentBet*3));title=`AUMENTE para ~${size} (raise)`;why=`Mão muito forte (~${pct(eq)}). Aumente para construir o pote.`;}
      else if(eq>=odds+.05){a='call';ok=eq>=.6?['call','raise']:['call'];title=`PAGUE ${Math.min(toCall,p.stack)} (call)`;why=`Você precisa de ${pct(odds)} de equidade e tem ~${pct(eq)}. O call é lucrativo no longo prazo (+EV).`;}
      else if(eq>=odds-.06&&outs&&outs.total>=8){a='call';ok=['call','fold'];title='Call marginal (odds implícitas)';why=`Está um pouco abaixo (${pct(eq)} vs ${pct(odds)}), mas se completar o projeto pode ganhar mais fichas depois (odds implícitas).`;}
      else{a='fold';ok=['fold'];title='DESISTA (fold)';why=`Precisa de ${pct(odds)} de equidade para pagar, mas tem só ~${pct(eq)}. Pagar aqui perde fichas no longo prazo (−EV).`;}
    }
    r={action:a,ok,title,why,size};
  }
  Object.assign(r,{eq,eqRaw,odds,toCall,pot,outs,ip,opp});
  return r;
}
function renderCoach(){
  const r=S.rec; if(!r) return;
  const p=hero, pos=posName(0), ev=S.board.length?evaluate(p.hole.concat(S.board)):null;
  let h=`<h4>📍 Sua posição: ${pos} ${r.ip&&S.street>0?'(em posição ✓)':S.street>0?'(fora de posição)':''}</h4><div>${POSINFO[pos]}</div>`;
  const nm=notation(p.hole), nick=NICK[nm]||NICK[nm.slice(0,2)];
  h+=`<h4>🃏 Sua mão</h4>`;
  if(S.street===0){const ch=chen(p.hole),[tn,tc]=tier(ch);
    h+=`<div><b>${nm.replace(/T/g,'10')}</b> ${nick?'— '+nick:''}</div><div>${handClass(p.hole).map(x=>`<span class="tag">${x}</span>`).join('')}<span class="tag ${tc}">${tn} · Chen ${ch}</span></div>`;}
  else{h+=`<div><b>${describe(ev)}</b> <span class="muted">(${CAT[ev.cat]})</span></div><ul class="l">${relHand(p.hole,S.board,ev).map(x=>`<li>${x}</li>`).join('')}</ul>`;
    h+=`<h4>🌊 Textura da mesa</h4><div>${texture(S.board).map(x=>`<span class="tag">${x}</span>`).join('')}</div>`;}
  h+=`<h4>📈 Equidade & Pot odds</h4>
    <div class="kv"><span>Equidade vs ${r.opp} mão(s) aleatória(s)</span><b>${pct(r.eqRaw)}</b></div><div class="bar"><i style="width:${r.eqRaw*100}%"></i></div>`;
  if(r.eq!==r.eqRaw) h+=`<div class="kv"><span>Ajustada ao range de quem apostou</span><b>${pct(r.eq)}</b></div>`;
  if(r.toCall>0) h+=`<div class="kv"><span>Pot odds: paga ${Math.min(r.toCall,hero.stack)} p/ ganhar ${r.pot}</span><b>precisa ${pct(r.odds)}</b></div><div class="bar odds"><i style="width:${r.odds*100}%"></i></div>`;
  else h+=`<div class="muted">Ninguém apostou: você pode dar check grátis.</div>`;
  if(r.outs&&r.outs.total){const g=Object.entries(r.outs.groups).sort((a,b)=>b[0]-a[0]).map(([c,cs])=>`<span class="tag">${cs.length} p/ ${CAT[c]}</span>`).join('');
    const mult=S.street===1?'×4 (2 cartas) ≈ '+Math.min(100,r.outs.total*4)+'% até o river · ×2 ≈ '+r.outs.total*2+'% só no turn':'×2 ≈ '+r.outs.total*2+'% no river';
    h+=`<h4>🎯 Outs: ${r.outs.total}</h4><div>${g}</div><div class="muted">Regra do 4 e 2: ${r.outs.total} outs ${mult}</div>`;}
  const cls=r.action==='fold'?'f':r.action==='raise'?'':'c';
  h+=`<h4>✅ Jogada recomendada</h4><div class="rec ${cls}"><div class="t">${r.title}</div><div>${r.why}</div></div>`;
  const vil=liveP().filter(x=>!x.isHero).map(x=>`<li><b>${x.name}</b> (${x.style}): ${x.cfg.tip}</li>`).join('');
  h+=`<h4>🧠 Leitura dos adversários na mão</h4><ul class="l">${vil}</ul>`;
  $('#coachBody').innerHTML=h;
  if(S.board.length>=3){const b=beatAnalysis(p.hole,S.board);
    const rows=Object.entries(b.byCat).sort((a,b)=>b[0]-a[0]).map(([c,o])=>`<li><b>${CAT[c]}</b> — ${o.n} combos: <span class="muted">${summarizeLabels(o.labels).slice(0,6).join(', ')}</span></li>`).join('');
    $('#beatBody').innerHTML=`<div class="kv"><span>Combinações possíveis do vilão</span><b>${b.tot}</b></div>
      <div class="kv"><span>Te batem</span><b style="color:var(--red)">${b.beat} (${pct(b.beat/b.tot)})</b></div>
      <div class="kv"><span>Empatam</span><b>${b.tie}</b></div>
      ${b.beat?`<ul class="l">${rows}</ul>`:'<div style="color:var(--green);font-weight:700">Você tem a NUTS (a melhor mão possível agora)!</div>'}
      <div class="muted">"Qualquer Kx" = qualquer mão com um K.</div>`;
    $('#beat').style.display='';}
}
function renderReview(net,sd){
  if(S.mode!=='learn') return;
  let h=`<h4>📋 Resumo da mão #${S.handNo}</h4><div>Resultado: <b style="color:${net>=0?'var(--green)':'var(--red)'}">${net>=0?'+':''}${net} (${(net/BB).toFixed(1)} BB)</b></div>`;
  if(S.decisions.length){h+='<ul class="l">'+S.decisions.map(d=>`<li>${d.good?'✅':'❌'} <b>${STREET[d.street]}</b>: você fez <b>${d.did}</b> — coach: ${d.rec}</li>`).join('')+'</ul>';}
  else h+='<div class="muted">Você não precisou decidir nesta mão.</div>';
  if(sd) h+=`<div class="muted">No showdown, compare as mãos no histórico para entender o que venceu.</div>`;
  h+=`<div class="muted" style="margin-top:6px">Clique em "Próxima mão" quando estiver pronto.</div>`;
  $('#coachBody').innerHTML=h;
}
function mistakeLabel(rec,did,street){
  const pre=street===0?'Pré-flop':'Pós-flop';
  if(did==='fold'&&rec==='check') return 'Fold quando podia dar check grátis';
  if(did==='fold') return `${pre}: desistiu de mão jogável (fold demais)`;
  if(did==='call'&&rec==='fold') return `${pre}: pagou sem mão/sem odds (call ruim)`;
  if((did==='call'||did==='check')&&rec==='raise') return `${pre}: passivo com mão forte (faltou apostar/aumentar)`;
  if(did==='raise'&&rec==='fold') return `${pre}: aumentou com mão fraca`;
  if(did==='raise') return `${pre}: apostou/aumentou sem necessidade`;
  if(did==='call'&&rec==='check') return `${pre}: completou o blind sem necessidade`;
  return `${pre}: outra divergência`;
}
const DIDTXT={fold:'Fold',check:'Check',call:'Call',raise:'Aposta/Aumento'};
function heroAct(type,to){
  if(S.handOver||S.toAct!==0) return;
  const r=S.rec;
  if(r){const good=r.ok.includes(type); ST.dec++; if(good)ST.good++; else{const l=mistakeLabel(r.action,type,S.street);ST.mist[l]=(ST.mist[l]||0)+1;}
    S.decisions.push({street:S.street,did:DIDTXT[type],rec:r.title,good}); saveStats();}
  S.rec=null; act(hero,{type,to});
}

/* ============ RENDER ============ */
function cardTxt(c){return `<b style="color:${su(c)===1||su(c)===2?'#ff7b72':'#e6edf3'}">${RDISP(rk(c))}${SUITS[su(c)]}</b>`;}
function cardHTML(c,hidden,sm){if(hidden) return `<div class="card back ${sm?'sm':''}"></div>`;
  return `<div class="card ${su(c)===1||su(c)===2?'red':''} ${sm?'sm':''}"><span>${RDISP(rk(c))}</span><b>${SUITS[su(c)]}</b></div>`;}
function render(){
  let h='';
  S.players.forEach((p,i)=>{const [x,y]=SEATPOS[i];
    const show=p.isHero||(S.xray&&S.mode==='learn')||(S.showdown&&!p.folded);
    const cards=(p.hole||[]).length&&!(p.folded&&!p.isHero)?p.hole.map(c=>cardHTML(c,!show,!p.isHero)).join(''):'';
    h+=`<div class="seat ${p.folded?'folded':''} ${S.toAct===i&&!S.handOver?'turn':''} ${p.winner?'win':''}" style="left:${x}%;top:${y}%">
      <div class="cards">${cards}</div>
      <div class="box">${i===S.dealer?'<div class="dealer">D</div>':''}<div class="pos">${posName(i)}</div>
        <div class="nm">${p.name}</div><div class="st">${p.stack} <small>(${Math.round(p.stack/BB)} BB)</small></div>
        ${!p.isHero&&S.mode==='learn'?`<div class="sty">${p.style}</div>`:''}
        ${p.handDesc&&S.showdown&&!p.folded?`<div class="hd">${p.handDesc}</div>`:''}
        <div class="act">${p.lastAction||''}</div></div></div>`;
    if(p.bet>0){const bx=x+(50-x)*.45,by=y+(46-y)*.45;h+=`<div class="chip" style="left:${bx}%;top:${by}%">${p.bet}</div>`;}
  });
  $('#seats').innerHTML=h;
  let b=S.board.map(c=>cardHTML(c)).join(''); for(let k=S.board.length;k<5;k++) b+='<div class="slot"></div>';
  $('#board').innerHTML=b; $('#pot').textContent='Pote: '+potTotal();
  updateControls(); renderStats();
}
function heroTurn(){return !S.handOver&&S.toAct===0&&!hero.folded&&!hero.allIn&&S.rec;}
function updateControls(){
  const on=heroTurn(), toCall=S.currentBet-hero.bet, pot=potTotal(), maxTo=hero.bet+hero.stack, minTo=Math.min(S.currentBet+S.minRaise,maxTo);
  const othersCanAct=S.players.some(p=>!p.isHero&&!p.folded&&!p.allIn);
  $('#bFold').disabled=!on;
  $('#bCall').disabled=!on;
  $('#bCall').innerHTML=(toCall>0?(toCall>=hero.stack?`All-in ${hero.stack}`:`Pagar ${toCall}`):'Check')+'<kbd>C</kbd>';
  const canRaise=on&&hero.stack>toCall&&othersCanAct;
  $('#bRaise').disabled=!canRaise; $('#rng').disabled=!canRaise; $('#amt').disabled=!canRaise;
  $('#bNext').disabled=!S.handOver;
  if(on){
    const rng=$('#rng'); rng.min=minTo; rng.max=maxTo;
    let v=S.rec&&S.rec.size&&S.mode==='learn'?S.rec.size:minTo; v=Math.max(minTo,Math.min(maxTo,v));
    if(S._ctlFor!==S.handNo+'-'+S.street+'-'+S.currentBet){rng.value=v;$('#amt').value=v;S._ctlFor=S.handNo+'-'+S.street+'-'+S.currentBet;}
    setRaiseLabel();
    const pre=[];
    if(S.street===0&&S.raises===0) pre.push(['2,5 BB',BB*2.5],['3 BB',BB*3],['4 BB',BB*4]);
    else if(S.street===0) pre.push(['3x',S.currentBet*3],['4x',S.currentBet*4]);
    else pre.push(['1/3 pote',S.currentBet+(pot+toCall)/3],['1/2 pote',S.currentBet+(pot+toCall)/2],['3/4 pote',S.currentBet+(pot+toCall)*.75],['Pote',S.currentBet+pot+toCall]);
    pre.push(['All-in',maxTo]);
    $('#presets').innerHTML=pre.map(([l,val])=>`<button class="btn pre" data-v="${Math.max(minTo,Math.min(maxTo,Math.round(val)))}" ${canRaise?'':'disabled'}>${l}</button>`).join('');
    let inf=`Sua vez · Pote <b>${pot}</b>`+(toCall>0?` · Para pagar <b>${Math.min(toCall,hero.stack)}</b>`:'');
    if(S.mode==='learn'&&S.rec){inf+=` · Equidade <b>${pct(S.rec.eq)}</b>`+(toCall>0?` vs pot odds <b>${pct(S.rec.odds)}</b>`:'');}
    $('#ctlInfo').innerHTML=inf;
  } else {
    $('#presets').innerHTML='';
    $('#ctlInfo').innerHTML=S.handOver?'Mão encerrada.':hero.folded?'Você desistiu desta mão. Observe como os outros jogam.':`Aguardando ${S.players[S.toAct]?S.players[S.toAct].name:''}…`;
  }
}
function setRaiseLabel(){const v=+$('#amt').value, maxTo=hero.bet+hero.stack;
  $('#bRaise').innerHTML=(v>=maxTo?'ALL-IN ':S.currentBet===0?'Apostar ':'Aumentar p/ ')+v+'<kbd>R</kbd>';}
function renderStats(){
  const s=ST, pc=(a,b)=>b?Math.round(a/b*100)+'%':'—';
  const bb100=s.hands?(s.net/BB/s.hands*100).toFixed(1):'—';
  let h=`<div class="grid">
    <div class="kv"><span>Mãos</span><b>${s.hands}</b></div>
    <div class="kv"><span>Ganhas</span><b>${s.won} (${pc(s.won,s.hands)})</b></div>
    <div class="kv"><span>Saldo</span><b style="color:${s.net>=0?'var(--green)':'var(--red)'}">${s.net>=0?'+':''}${(s.net/BB).toFixed(1)} BB</b></div>
    <div class="kv"><span>BB/100</span><b>${bb100}</b></div>
    <div class="kv" title="% de mãos em que você pôs dinheiro voluntariamente no pré-flop"><span>VPIP</span><b>${pc(s.vpip,s.hands)}</b></div>
    <div class="kv" title="% de mãos em que você aumentou no pré-flop"><span>PFR</span><b>${pc(s.pfr,s.hands)}</b></div>
    <div class="kv"><span>Showdowns ganhos</span><b>${s.sdWon}/${s.sd}</b></div>
    <div class="kv"><span>Acerto vs coach</span><b>${pc(s.good,s.dec)}</b></div></div>`;
  h+=`<div class="muted" style="font-size:12px;margin-top:4px">Referência de jogador vencedor 6-max: VPIP 20–28%, PFR 16–22%.</div>`;
  const m=Object.entries(s.mist).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if(m.length) h+=`<h4>⚠️ Onde você está errando</h4><ul class="l">${m.map(([k,v])=>`<li>${k} <span class="tag bad">${v}x</span></li>`).join('')}</ul>`;
  const bh=Object.entries(s.byHand).filter(([,v])=>v<0).sort((a,b)=>a[1]-b[1]).slice(0,5);
  if(bh.length) h+=`<h4>💸 Mãos iniciais que mais te custaram</h4><div>${bh.map(([k,v])=>`<span class="tag bad">${k.replace(/T/g,'10')}: ${v.toFixed(1)} BB</span>`).join('')}</div>`;
  const gh=Object.entries(s.byHand).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if(gh.length) h+=`<h4>💰 Mãos que mais te deram lucro</h4><div>${gh.map(([k,v])=>`<span class="tag good">${k.replace(/T/g,'10')}: +${v.toFixed(1)} BB</span>`).join('')}</div>`;
  if(s.losses.length) h+=`<h4>❌ Últimos showdowns perdidos</h4><ul class="l">${s.losses.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  $('#stats').innerHTML=h;
}

/* ============ GLOSSÁRIO ============ */
const RANKING=[['Royal Flush','A-K-Q-J-10 do mesmo naipe. A mão perfeita.'],['Straight Flush','5 em sequência do mesmo naipe.'],['Quadra (four of a kind, "poker")','4 cartas iguais.'],['Full House ("full")','Trinca + par.'],['Flush ("cor")','5 cartas do mesmo naipe.'],['Sequência (straight)','5 cartas em sequência (A pode ser baixo: A-2-3-4-5 = "wheel/roda").'],['Trinca (trips / set)','3 cartas iguais. SET = par na mão + 1 na mesa; TRIPS = 1 na mão + par na mesa.'],['Dois Pares','Dois pares diferentes.'],['Um Par','Duas cartas iguais.'],['Carta Alta (high card)','Nenhuma combinação: vale a maior carta.']];
const GLOSS=[['Blinds (SB/BB)','Apostas obrigatórias antes das cartas. Aqui: SB=1, BB=2.'],['Button (BTN / Dealer)','Melhor posição: age por último pós-flop.'],['UTG, MP/Hijack, CO','Posições da primeira à última antes do botão.'],['Em posição (IP) / fora (OOP)','IP = agir depois do adversário (vantagem de informação).'],['Pré-flop, Flop, Turn, River','As 4 rodadas de apostas: 0, 3, 4 e 5 cartas na mesa.'],['Check','Passar a vez sem apostar (só se ninguém apostou).'],['Bet / Raise','Apostar / aumentar a aposta de alguém.'],['Call','Pagar a aposta.'],['Fold','Desistir da mão.'],['Limp','Só pagar o BB no pré-flop sem aumentar. Geralmente ruim.'],['Open-raise','Primeiro aumento no pré-flop.'],['3-bet / 4-bet','Re-aumento / re-re-aumento.'],['C-bet (continuation bet)','Aposta no flop de quem aumentou no pré-flop.'],['Value bet','Aposta para ser pago por mãos piores.'],['Blefe','Apostar com mão fraca para fazer o outro desistir.'],['Semi-blefe','Apostar com um projeto: pode ganhar agora OU completar depois.'],['Slowplay','Jogar passivo com mão monstro para enganar.'],['Draw (projeto)','Mão que precisa de carta: flush draw (9 outs), open-ended (8), gutshot (4).'],['Outs','Cartas que melhoram sua mão para provavelmente vencer.'],['Regra do 4 e 2','Outs ×4 no flop (até o river) ou ×2 com 1 carta para vir = % aproximada.'],['Equidade (equity)','Sua % de chance de ganhar o pote no showdown.'],['Pot odds','Quanto você paga ÷ (pote + o que paga). Se equidade > pot odds → call lucrativo.'],['Odds implícitas','Fichas extras que você espera ganhar se completar o projeto.'],['+EV / −EV','Jogada lucrativa / perdedora no longo prazo.'],['Kicker','Carta lateral que desempata mãos iguais.'],['Top pair / Overpair','Par com a maior carta da mesa / par de mão maior que a mesa.'],['Nuts','A melhor mão possível naquele momento.'],['Board seco / molhado','Mesa com poucos / muitos projetos possíveis.'],['Range','Conjunto de mãos que um jogador pode ter.'],['VPIP / PFR','% de mãos jogadas / % de mãos aumentadas no pré-flop.'],['Showdown','Quando as cartas são mostradas no final.'],['Side pot','Pote paralelo quando alguém está all-in com menos fichas.'],['Tilt','Jogar mal por emoção após perder.'],['Nit / TAG / LAG / Calling station','Perfis: muito tight / tight-agressivo / loose-agressivo / paga tudo.'],['Chen','Fórmula de pontos para medir força da mão inicial (usada pelo coach).']];
$('#glossBody').innerHTML=`<h3 style="color:var(--gold)">🏆 Ranking (da mais forte para a mais fraca)</h3><table class="rk">${RANKING.map((r,i)=>`<tr><td>${i+1}</td><td><b>${r[0]}</b></td><td class="muted">${r[1]}</td></tr>`).join('')}</table>
<h3 style="color:var(--gold);margin-top:16px">📖 Termos</h3><dl>${GLOSS.map(g=>`<dt>${g[0]}</dt><dd>${g[1]}</dd>`).join('')}</dl>`;

/* ============ EVENTOS ============ */
const dlg=$('#dlg');
$('#bGloss').onclick=()=>dlg.showModal();
$('#bFold').onclick=()=>heroAct('fold');
$('#bCall').onclick=()=>heroAct(S.currentBet-hero.bet>0?'call':'check');
$('#bRaise').onclick=()=>heroAct('raise',+$('#amt').value);
$('#bNext').onclick=()=>{if(S.handOver)startHand();};
$('#rng').oninput=e=>{$('#amt').value=e.target.value;setRaiseLabel();};
$('#amt').oninput=e=>{$('#rng').value=e.target.value;setRaiseLabel();};
$('#presets').onclick=e=>{const v=e.target.dataset.v;if(v){$('#amt').value=v;$('#rng').value=v;setRaiseLabel();}};
$('#xray').onchange=e=>{S.xray=e.target.checked;render();};
$('#bReset').onclick=()=>{if(confirm('Zerar todas as estatísticas?')){ST=freshStats();saveStats();renderStats();}};
$('#modeSeg').onclick=e=>{const m=e.target.dataset.m;if(!m)return;S.mode=m;
  document.querySelectorAll('#modeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  document.body.classList.toggle('treino',m==='treino'); render(); if(heroTurn()) renderCoach();};
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'&&e.target.type==='number') return;
  const k=e.key.toLowerCase();
  if(k==='f'&&!$('#bFold').disabled) $('#bFold').click();
  else if(k==='c'&&!$('#bCall').disabled) $('#bCall').click();
  else if(k==='r'&&!$('#bRaise').disabled) $('#bRaise').click();
  else if((k===' '||k==='enter')&&S.handOver&&!dlg.open){e.preventDefault();startHand();}
});
function saveAudio(){try{localStorage.setItem('pokerlab-audio',JSON.stringify({on:AU.on,vol:AU.vol}));}catch(e){}}
function syncSnd(){$('#bSnd').textContent=AU.on?'🔊':'🔇';$('#vol').value=AU.vol;}
$('#bSnd').onclick=()=>{AU.on=!AU.on;saveAudio();syncSnd();if(AU.on)SFX.chips(0,3);};
$('#vol').oninput=e=>{AU.vol=+e.target.value;saveAudio();};
$('#vol').onchange=()=>SFX.chips(0,3);
syncSnd();
window.__S=S; window.__AU=AU;
startHand();
