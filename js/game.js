/* Poker Lab — estado da mesa, fluxo das apostas, bots, coach e interface. */
"use strict";
const $=s=>document.querySelector(s);

/* ============ ESTADO ============ */
const BOTS=[
  {name:'Rocha',pro:'nit',style:'Tight-Passivo ("nit")',open:1.5,agg:.12,bluff:.03,call:.06,loose:.7,tip:'Só entra com mãos fortes. Se ele aposta alto, respeite.'},
  {name:'Tubarão',pro:'reg',style:'Tight-Agressivo (TAG)',open:0,agg:.55,bluff:.12,call:.02,loose:1,tip:'Estilo vencedor: poucas mãos, muita agressividade.'},
  {name:'Maníaco',pro:'maniac',style:'Loose-Agressivo (LAG)',open:-2,agg:.75,bluff:.28,call:-.03,loose:1.6,tip:'Aposta e blefa muito. Pague mais "leve" contra ele.'},
  {name:'Peixe',pro:'fish',style:'Calling station (Loose-Passivo)',open:-3,agg:.06,bluff:.02,call:-.1,loose:1.8,tip:'Paga tudo, quase nunca blefa. Aposte por valor; NÃO blefe.'},
  {name:'Professor',pro:'lag',style:'Equilibrado (estilo GTO)',open:0,agg:.4,bluff:.1,call:0,loose:1.1,tip:'Joga balanceado; difícil de ler.'},
  {name:'Valéria',pro:'reg',style:'Tight-Agressivo (TAG)',open:.3,agg:.5,bluff:.1,call:.02,loose:1,tip:'Sólida e disciplinada. Respeite quando ela aposta forte.'},
  {name:'Beto',pro:'fish',style:'Calling station (Loose-Passivo)',open:-2.5,agg:.1,bluff:.03,call:-.08,loose:1.7,tip:'Paga demais, quase não blefa. Aposte por valor.'},
  {name:'Dona Lúcia',pro:'nit',style:'Tight-Passivo ("nit")',open:1,agg:.15,bluff:.03,call:.05,loose:.75,tip:'Só joga mãos boas. Se ela aposta, tem mão.'},
];
/* posições dos lugares (% da mesa): [x,y]; índice 0 = você, no centro de baixo, sentido horário */
const SEATPOS_WIDE={6:[[50,87],[9,64],[15,20],[50,8],[85,20],[91,64]],
  9:[[50,88],[25,82],[11,58],[13,30],[33,9],[67,9],[87,30],[89,58],[75,82]]};
const SEATPOS_TALL={6:[[50,87],[13,70],[13,30],[50,9],[87,30],[87,70]],      // mesa em pé (celular)
  9:[[50,90],[12,76],[12,54],[12,32],[34,9],[66,9],[88,32],[88,54],[88,76]]};
const MQ_PHONE=window.matchMedia('(max-width:640px)');
const seatPos=()=>(MQ_PHONE.matches?SEATPOS_TALL:SEATPOS_WIDE)[N];
MQ_PHONE.addEventListener('change',()=>{if(typeof render==='function')render();});
document.addEventListener('DOMContentLoaded',()=>{const b=document.getElementById('bMenu'),h=document.querySelector('header');
  if(b)b.addEventListener('click',()=>{const o=h.classList.toggle('open');b.setAttribute('aria-expanded',o);});});
let S={players:[],dealer:Math.floor(Math.random()*N),board:[],deck:[],street:0,currentBet:0,minRaise:BB,toAct:-1,raises:0,handOver:true,handNo:0,
  mode:'learn',game:'cash',coachStyle:'tag',xray:false,showdown:false,pfAggr:-1,lastAggr:-1,bbI:0,rec:null,decisions:[]};
try{const cs=localStorage.getItem('pokerlab-style'); if(cs&&COACH_STYLES[cs]) S.coachStyle=cs;}catch(e){}
S.players.push({name:'Você',isHero:true,stack:START});
BOTS.slice(0,N-1).forEach(b=>S.players.push({name:b.name,style:b.style,cfg:b,stack:START}));
const hero=S.players[0];
/* mesa de cash com n lugares (6 ou 9): você + os n-1 primeiros bots */
function buildCashTable(n){N=n; hero.stack=START; hero.cashStack=START;
  S.players=[hero,...BOTS.slice(0,n-1).map(b=>({name:b.name,style:b.style,cfg:b,stack:START}))];
  S.dealer=Math.floor(Math.random()*N);}
const STREET=['Pré-flop','Flop','Turn','River'];
const next=i=>(i+1)%N;
function nextOcc(i){let j=next(i);for(let k=0;k<N;k++){if(!S.players[j].empty)return j;j=next(j);}return i;}
function occFrom(start){const o=[];let j=start;for(let k=0;k<N;k++){if(!S.players[j].empty)o.push(j);j=next(j);}return o;}
const POS_BY_N={2:['BTN','BB'],3:['BTN','SB','BB'],4:['BTN','SB','BB','CO'],5:['BTN','SB','BB','MP','CO'],6:['BTN','SB','BB','UTG','MP','CO'],
  7:['BTN','SB','BB','UTG','MP','HJ','CO'],8:['BTN','SB','BB','UTG','UTG+1','MP','HJ','CO'],9:['BTN','SB','BB','UTG','UTG+1','MP','LJ','HJ','CO']};
function posName(i){if(S.players[i].empty)return '';const o=occFrom(S.dealer);return (POS_BY_N[Math.min(o.length,9)]||POS_BY_N[6])[o.indexOf(i)]||'';}
/* texto da posição, com a contagem real de jogadores que ainda agem depois de você */
function posInfo(pos){let t=POSINFO[pos]||''; const o=occFrom(S.dealer),k=o.indexOf(0);
  if(k>=3){const n=o.length-1-k+3; t=t.replace(/ainda há \d+ jogadores?/,'ainda há '+n+' jogador'+(n>1?'es':''));} return t;}
const potTotal=()=>S.players.reduce((a,p)=>a+p.total,0);
const liveP=()=>S.players.filter(p=>!p.folded);
const delay=()=>+$('#speed').value;
const coachStyle=()=>COACH_STYLES[S.coachStyle]||COACH_STYLES.tag;

let ST;
function freshStats(){return {hands:0,won:0,net:0,vpip:0,pfr:0,sd:0,sdWon:0,dec:0,good:0,mist:{},byHand:{},losses:[],tourneys:[]};}
try{ST=JSON.parse(localStorage.getItem('pokerlab-stats'))||freshStats();}catch(e){ST=freshStats();}
ST.tourneys=ST.tourneys||[];
function saveStats(){try{localStorage.setItem('pokerlab-stats',JSON.stringify(ST));}catch(e){}}

function log(h){const d=document.createElement('div');d.innerHTML=h;const L=$('#log');L.prepend(d);while(L.children.length>80)L.lastChild.remove();}

/* ============ FLUXO DA MÃO ============ */
function startHand(){
  if(S.game==='mtt'&&(T.heroOut||T.finished)) return showResult();
  clearTimeout(S.autoT);
  S.handNo++; S.handOver=false; S.showdown=false; S.board=[]; S.street=0; S.raises=0; S.pfAggr=-1; S.lastAggr=-1; S.decisions=[]; S.rec=null;
  S.players.forEach(p=>{ if(p.empty) return;
    if(S.game==='cash'&&p.stack<=0){ p.stack=START; log(`<b>${p.name}</b> fez recompra (rebuy) de ${START}.`); }
    Object.assign(p,{hole:[],bet:0,total:0,ante:0,folded:false,allIn:false,acted:false,lastAction:'',winner:false,handDesc:'',startStack:p.stack,vp:false,pr:false,range:null,rangeWhy:''});
  });
  S.dealer=nextOcc(S.dealer);
  const occ=occFrom(S.dealer), sb=occ.length===2?occ[0]:occ[1], bb=occ.length===2?occ[1]:occ[2]; S.bbI=bb;
  S.deck=[...Array(52).keys()]; for(let i=51;i>0;i--){const j=Math.floor(Math.random()*(i+1));[S.deck[i],S.deck[j]]=[S.deck[j],S.deck[i]];}
  const order=occFrom(nextOcc(S.dealer));
  for(let r=0;r<2;r++) order.forEach((i,k)=>{ S.players[i].hole.push(S.deck.pop()); SFX.deal((r*order.length+k)*.07); });
  SFX.chips(.9,2);
  if(ANTE) postAnte(bb,ANTE);
  post(sb,SBL); post(bb,BB); S.players[sb].lastAction='SB '+fmt(SBL); S.players[bb].lastAction='BB '+fmt(BB)+(ANTE?' + ante':'');
  S.currentBet=BB; S.minRaise=BB; S.toAct=nextOcc(bb);
  $('#log').innerHTML=''; log(`<b>Mão #${S.handNo}</b> — Você está no <b>${posName(0)}</b> com <b>${notation(hero.hole).replace(/T/g,'10')}</b>${S.game==='mtt'?` · blinds ${fmt(SBL)}/${fmt(BB)}${ANTE?' ante '+fmt(ANTE):''}`:''}`);
  $('#msg').textContent=''; $('#beat').style.display='none';
  renderTourney(); loop();
}
function post(i,a){const p=S.players[i];a=Math.min(a,p.stack);p.stack-=a;p.bet+=a;p.total+=a;if(p.stack===0)p.allIn=true;}
function postAnte(i,a){const p=S.players[i];a=Math.min(a,p.stack);p.stack-=a;p.total+=a;p.ante=a;if(p.stack===0)p.allIn=true;}
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
    if(to<=S.currentBet) d={type:toCall>0?'call':'check'}; else d={type:'raise',to};
  }
  noteRange(p,i,d);
  if(d.type==='fold'){p.folded=true;p.lastAction='Fold';}
  else if(d.type==='check'){p.lastAction='Check';}
  else if(d.type==='call'){post(i,toCall);p.lastAction=p.allIn?'All-in '+fmt(p.total):'Call '+fmt(p.bet); if(S.street===0)p.vp=true;}
  else { const to=d.to, by=to-S.currentBet, wasBet=S.currentBet===0;
    if(by>=S.minRaise) S.minRaise=by;
    post(i,to-p.bet); S.currentBet=to; S.raises++; S.lastAggr=i;
    S.players.forEach(o=>{if(o!==p)o.acted=false;});
    p.lastAction=(p.allIn?'ALL-IN ':'')+(wasBet?'Aposta ':'Aumenta p/ ')+fmt(to);
    if(S.street===0){p.vp=true;p.pr=true;S.pfAggr=i;}
  }
  p.acted=true;
  if(d.type==='fold') SFX.fold(); else if(d.type==='check') SFX.check(); else if(p.allIn) SFX.allin(); else SFX.chips(0,d.type==='raise'?5:3);
  let tip='';
  if(S.mode==='learn'&&!p.isHero){
    if(d.type==='raise'&&S.street===0&&p.allIn&&p.total<=15*BB) tip=' <i>(push com stack curto: range largo)</i>';
    else if(d.type==='raise'&&S.street===0&&S.raises===2) tip=' <i>(3-bet: re-aumento, range forte ou blefe)</i>';
    else if(d.type==='raise'&&S.street===0&&['UTG','UTG+1','MP','LJ'].includes(posName(i))) tip=' <i>(aumento de posição inicial = mão forte)</i>';
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
  $('#msg').textContent=`${p.name} leva ${fmt(pot)} (todos desistiram)`;
  log(`🏆 <b>${p.name}</b> ganha ${fmt(pot)} sem showdown.`);
  endHand(false);
}
function showdown(){
  S.handOver=true; S.showdown=true;
  const live=liveP(); live.forEach(p=>{p.ev=evaluate(p.hole.concat(S.board));p.handDesc=describe(p.ev);});
  const contrib=p=>p.total-(p.ante||0); let dead=S.players.reduce((a,p)=>a+(p.ante||0),0);   // ante = dinheiro morto do pote principal
  const levels=[...new Set(S.players.map(contrib).filter(t=>t>0))].sort((a,b)=>a-b);
  let prev=0; const msgs=[];
  for(const L of levels){
    let amt=dead; dead=0; S.players.forEach(p=>amt+=Math.max(0,Math.min(contrib(p),L)-prev));
    let elig=live.filter(p=>contrib(p)>=L); if(!elig.length) elig=live;
    prev=L; if(amt<=0) continue;
    const best=Math.max(...elig.map(p=>p.ev.v)), w=elig.filter(p=>p.ev.v===best);
    const share=Math.floor(amt/w.length); w.forEach((p,k)=>{p.stack+=share+(k===0?amt-share*w.length:0);p.winner=true;});
    msgs.push(`${w.map(p=>p.name).join(' & ')} ${w.length>1?'dividem':'ganha'} ${fmt(amt)} com ${w[0].handDesc}`);
  }
  live.forEach(p=>log(`👁 <b>${p.name}</b>: ${p.hole.map(cardTxt).join(' ')} → ${p.handDesc}`));
  msgs.forEach(m=>log('🏆 '+m));
  $('#msg').textContent=msgs.join(' · ');
  endHand(true);
}
function endHand(sd){
  const net=hero.stack-hero.startStack, nm=notation(hero.hole);
  setTimeout(()=>{ if(hero.winner) SFX.win(); else if(net<0&&!hero.folded) SFX.lose(); else SFX.pot(); },250);
  ST.hands++; ST.net+=net/BB*2; if(net>0)ST.won++; if(hero.vp)ST.vpip++; if(hero.pr)ST.pfr++;   // saldo guardado em "fichas de cash" (1 BB = 2)
  ST.byHand[nm]=(ST.byHand[nm]||0)+net/BB;
  if(sd&&!hero.folded){ST.sd++; if(hero.winner)ST.sdWon++;
    else{const w=S.players.filter(p=>p.winner)[0];
      ST.losses.unshift(`Perdeu ${(-net/BB).toFixed(0)} BB com <b>${hero.handDesc}</b> (${nm}) para ${w.name} — <b>${w.handDesc}</b>`);
      ST.losses=ST.losses.slice(0,8);}}
  saveStats(); renderReview(net,sd);
  if(S.game==='mtt') tourneyAfterHand();
  render();
  const over=S.game==='mtt'&&(T.heroOut||T.finished);
  if($('#auto').checked&&!over) S.autoT=setTimeout(startHand,S.mode==='learn'?4500:2200);
}

/* ============ BOTS ============ */
function limpers(){return S.players.filter((p,i)=>!p.folded&&i!==S.bbI&&p.bet===BB&&S.raises===0).length;}
function botDecide(p){
  if(S.game==='mtt'||S.proBots) return proDecide(p);
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
const R_=(a,ok,title,why,size)=>({action:a,ok,title,why,size});
function preflopAdvice(){
  const p=hero,pos=posName(0),cs=coachStyle(),nm=notation(p.hole).replace(/T/g,'10'),hp=handPct(p.hole),toCall=S.currentBet-p.bet,cost=Math.min(toCall,p.stack);
  const lp=limpers(),pair=isPair(p.hole),ip=inPosition(0),maxTo=p.bet+p.stack,pot=potTotal(),effBB=effStack(p)/BB;
  const heads=S.players.filter(x=>!x.empty).length===2, mtt=S.game==='mtt', bub=bubblePressure(p), st=`<b>${cs.name}</b>`;
  const a=S.lastAggr>=0?S.players[S.lastAggr]:null, vr=a?(a.range||.25):1;
  /* push/fold (torneio, stack curto) */
  if(mtt&&effBB<=12){
    if(S.raises===0){
      const pushP=Math.min(.85,(heads&&pos==='BTN'?.6:PUSH_PCT[pos]||.3)*10/Math.max(effBB,2)*Math.sqrt(cs.loose)*(1-bub));
      if(hp<=pushP) return R_('raise',['raise'],`ALL-IN (${fmt(maxTo)}) — push/fold`,`Você tem <b>${effBB.toFixed(1)} BB</b> efetivos. Abaixo de ~12 BB, aumentar e desistir de um re-aumento queima fichas: profissionais jogam <b>push/fold</b>. Do ${pos}, o range de push é o top ${pct(pushP)}; ${nm} está no top ${pct(hp)}.${bub>0?' Na bolha o range fica um pouco menor (ICM).':''}`,maxTo);
      if(toCall===0) return R_('check',['check'],'CHECK','Ninguém aumentou e sua mão não está no range de push: veja o flop de graça.');
      return R_('fold',['fold'],'DESISTA (fold)',`Com ${effBB.toFixed(1)} BB a regra é push ou fold. ${nm} (top ${pct(hp)}) está fora do range de push do ${pos} (top ${pct(pushP)}). Espere uma mão ou posição melhor — os blinds ainda não te obrigam.`);
    }
    const eq=equityVsRanges(p.hole,[],[vr],1500), need=cost/(pot+cost)+bub;
    if(eq>=need) return R_(toCall<p.stack?'raise':'call',toCall<p.stack?['raise','call']:['call'],toCall<p.stack?`RE-SHOVE (all-in ${fmt(maxTo)})`:`PAGUE o all-in (${fmt(cost)})`,
      `Range estimado de ${a.name}: top ${pct(vr)} (${a.rangeWhy}). Contra ele sua mão tem <b>${pct(eq)}</b> e você precisa de ${pct(need)}${bub>0?' (já somando a pressão da bolha / ICM)':''}. Lucrativo.`,maxTo);
    return R_('fold',['fold'],'DESISTA (fold)',`Contra o range de ${a.name} (top ${pct(vr)}: ${a.rangeWhy}) você tem ${pct(eq)} e precisa de ${pct(need)}${bub>0?' — na bolha, perder custa mais do que dobrar ganha (ICM)':''}.`);
  }
  const openSize=Math.min(maxTo,Math.round(BB*(mtt?2.2:2.5)+lp*BB));
  if(S.raises===0){
    if(pos==='BB'&&toCall===0){
      if(hp<=.1*cs.aggr*cs.loose||(lp&&hp<=.14*cs.loose)) return R_(cs.passive?'check':'raise',cs.passive?['check','raise']:['raise','check'],cs.passive?'CHECK (ou aumento)':`AUMENTE para ${fmt(Math.min(maxTo,BB*(3.5+lp)))} (iso-raise)`,
        cs.passive?`Como ${st}, você prefere ver o flop barato mesmo com mão boa no BB.`:`Houve limp(s) e sua mão é forte: puna os limpers com um aumento grande (iso-raise).`,Math.min(maxTo,BB*(3.5+lp)));
      return R_('check',['check'],'CHECK (veja o flop de graça)','Você está no BB e ninguém aumentou: veja o flop sem pagar nada.');
    }
    const openP=Math.min(.95,openPct(pos)*cs.loose*(heads?1.7:1)*(lp?.75:1));
    if(hp<=openP){
      if(cs.passive&&hp>.07) return R_('call',['call','raise'],`PAGUE ${fmt(cost)} (limp) ou aumente`,`Como ${st}, mãos boas mas não premium entram pagando para controlar o pote. (Um TAG aumentaria para ${fmt(openSize)}.) ${nm} é top ${pct(hp)}; seu range do ${pos} é top ${pct(openP)}.`,openSize);
      return R_('raise',['raise'],`AUMENTE para ${fmt(openSize)} (open-raise)`,`Estilo ${st}: do ${pos} você abre o top ${pct(openP)} das mãos. ${nm} é top ${pct(hp)} → open-raise de ${mtt?'2,2':'2,5'} BB${lp?' + 1 BB por limper':''}. Entrar aumentando dá iniciativa e chance de ganhar sem showdown.`,openSize);
    }
    if(pos==='SB'&&hp<=openP*1.5&&lp===0&&(cs.passive||cs.mixed)) return R_('call',['call','fold'],'Completar (limp) ou fold',`Como ${st}, no SB dá para completar mãos marginais (já tem meia aposta), mas você joga fora de posição.`);
    return R_('fold',['fold'],'DESISTA (fold)',`Estilo ${st}: do ${pos} o range é o top ${pct(openP)} e ${nm} é top ${pct(hp)}. Evite "limpar": é o erro mais caro de iniciante.`);
  }
  if(S.raises===1){
    const valueP=Math.min(vr*.33,.09)*cs.aggr, callP=Math.min(vr*(pos==='BB'?1.5:ip?1:.65),.5)*(cs.passive?1.3:1)*Math.sqrt(cs.loose);
    const tb=Math.min(maxTo,Math.round(S.currentBet*(ip?3:3.6))), rd=`${a.name} ${a.rangeWhy} (range ~top ${pct(vr)})`;
    if(hp<=valueP){
      if(cs.passive&&hp>.02) return R_('call',['call','raise'],`PAGUE ${fmt(cost)} (call)`,`${rd}. Como ${st}, você paga para controlar o pote e só re-aumenta com AA/KK. (TAG faria 3-bet para ${fmt(tb)}.)`,tb);
      return R_('raise',['raise'],`3-BET para ~${fmt(tb)}`,`${rd}. ${nm} (top ${pct(hp)}) está no seu range de 3-bet por valor. ${ip?'Em posição ~3x':'Fora de posição ~3,5x'} o aumento.`,tb);
    }
    if(isBluff3bet(p.hole)&&vr>.2&&cs.bluff>=1.2&&effBB>25) return R_('raise',['raise','call','fold'],`3-BET BLEFE para ~${fmt(tb)}`,`Estilo ${st}: ${nm} é ótimo 3-bet blefe — bloqueia mãos fortes (tem Ás/broadway) e joga bem se for pago. ${rd}: muitas mãos dele desistem.`,tb);
    if(hp<=callP&&(cost<=p.stack*.2||hp<=.04)) return R_('call',['call'],`PAGUE ${fmt(cost)} (call)`,pair&&hp>.15?`<b>Set mining</b>: par pequeno paga barato esperando a trinca (~12% no flop). Só vale se as fichas efetivas forem ≥15x o valor pago.`:`${rd}. ${nm} (top ${pct(hp)}) é bom para pagar${pos==='BB'?' (o BB tem desconto)':ip?' em posição':''}.`);
    return R_('fold',['fold'],'DESISTA (fold)',`${rd}. ${nm} (top ${pct(hp)}) está abaixo do seu range de call (top ${pct(callP)}).`);
  }
  if(hp<=.025*cs.aggr) return R_('raise',['raise','call'],'4-BET / ALL-IN',`Pote re-aumentado e ${nm} é premium (top ${pct(hp)}). Pressão máxima.`,Math.min(maxTo,Math.round(S.currentBet*2.4)));
  if(hp<=.065&&cost<=p.stack*.35) return R_('call',['call','fold'],'Call (ou fold) — cuidado','Houve 3-bet: o range do vilão é muito forte (~top 7%). Pagar é aceitável com mãos fortes, não premium.');
  return R_('fold',['fold'],'DESISTA (fold)',`Pote 3-bet+: o range adversário é ~top ${pct(vr)}. Só continue com mãos muito fortes.`);
}
function postflopAdvice(eq,odds,outs,ip,aggr,opp){
  const p=hero,cs=coachStyle(),st=`<b>${cs.name}</b>`,toCall=S.currentBet-p.bet,pot=potTotal(),maxTo=p.bet+p.stack,draw=outs&&outs.total>=8&&S.street<3;
  const valueT=cs.aggr>1.2?.62:cs.passive?.72:.65;
  if(toCall===0){
    if(eq>=valueT){ const size=Math.round(pot*.66);
      if(cs.passive) return R_('check',['check','raise'],'CHECK (controle de pote) ou aposta pequena',`Mão forte (~${pct(eq)}). Como ${st}, você controla o pote e deixa o vilão apostar. (Um TAG apostaria ~${fmt(size)} por valor.)`,Math.round(pot*.4));
      return R_('raise',['raise'],`APOSTE ~${fmt(size)} (2/3 do pote) — value bet`,`Você está à frente do range estimado (${pct(eq)}). Aposte para ser pago por mãos piores e não dar carta grátis.`,size);}
    if(eq>=.5) return cs.passive?R_('check',['check','raise'],'CHECK',`Mão razoável. Como ${st}, check e decida depois conforme a aposta.`)
      :R_('raise',['raise','check'],`Aposte ~${fmt(Math.round(pot*.5))} (1/2 pote) ou check`,'Mão razoável: aposta média por valor fino/proteção. Contra vários oponentes, check também é ok.',Math.round(pot*.5));
    if(draw&&(ip||aggr)&&!cs.passive&&cs.bluff>=.35) return R_('raise',['raise','check'],`SEMI-BLEFE de ~${fmt(Math.round(pot*.55))}`,`Você tem projeto com ${outs.total} outs. Apostando pode ganhar agora OU completar depois.${cs.bluff>=1.2?` No estilo ${st} isso é obrigatório.`:''}`,Math.round(pot*.55));
    const cbT=cs.bluff>=1.2?.2:cs.bluff<.5?.4:.3;
    if(aggr&&S.street===1&&opp===1&&eq>=cbT&&!cs.passive) return R_('raise',['raise','check'],`C-BET de ~${fmt(Math.max(BB,Math.round(pot*.33)))} (1/3 pote)`,`Você foi o agressor pré-flop (iniciativa). Contra 1 oponente, uma continuation bet pequena ganha muitos potes.${cs.bluff<.5?' Como Nit, só faça com alguma equidade.':''}`,Math.max(BB,Math.round(pot*.33)));
    if(S.street===3&&opp===1&&eq<.25&&ip&&cs.bluff>=1.2) return R_('raise',['raise','check'],`BLEFE no river ~${fmt(Math.round(pot*.66))}`,`Estilo ${st}: seu projeto falhou e você está em posição. Um blefe de 2/3 do pote faz mãos médias desistirem. Use com moderação.`,Math.round(pot*.66));
    return R_('check',['check'],'CHECK (passe a vez)','Mão fraca/marginal: veja a próxima carta de graça. Não infle o pote sem mão.');
  }
  const raiseSize=Math.min(maxTo,Math.round(S.currentBet*3));
  if(eq>=.75){ if(cs.passive) return R_('call',['call','raise'],`PAGUE ${fmt(Math.min(toCall,p.stack))} (call)`,`Mão muito forte (~${pct(eq)}). Como ${st}, você paga e deixa o vilão continuar apostando. (TAG aumentaria.)`,raiseSize);
    return R_('raise',['raise','call'],`AUMENTE para ~${fmt(raiseSize)} (raise)`,`Mão muito forte (~${pct(eq)}) contra o range estimado. Aumente para construir o pote.`,raiseSize);}
  if(eq>=odds+.03){ if(draw&&cs.aggr>1.2&&opp===1) return R_('raise',['raise','call'],`SEMI-BLEFE RAISE para ~${fmt(raiseSize)} (ou call)`,`Estilo ${st}: com ${outs.total} outs, aumentar dá duas formas de ganhar (ele desiste ou você completa).`,raiseSize);
    return R_('call',eq>=.6?['call','raise']:['call'],`PAGUE ${fmt(Math.min(toCall,p.stack))} (call)`,`Você precisa de ${pct(odds)} de equidade e tem ~${pct(eq)} contra o range estimado. Call lucrativo (+EV).`);}
  if(draw&&eq>=odds-.06) return R_('call',['call','fold'],'Call marginal (odds implícitas)',`Está um pouco abaixo (${pct(eq)} vs ${pct(odds)}), mas se completar o projeto pode ganhar mais fichas depois (odds implícitas).`);
  return R_('fold',['fold'],'DESISTA (fold)',`Precisa de ${pct(odds)} de equidade para pagar, mas tem só ~${pct(eq)} contra o range de quem apostou. Pagar aqui perde fichas no longo prazo (−EV).`);
}
function advise(){
  const p=hero, opp=liveP().length-1, toCall=S.currentBet-p.bet, pot=potTotal(), cost=Math.min(toCall,p.stack);
  const eqRaw=equity(p.hole,S.board,opp,S.street===0?800:1200);
  const eq=equityVsRanges(p.hole,S.board,oppRanges(p),S.street===0?800:1500);
  const odds=toCall>0?cost/(pot+cost)+(S.game==='mtt'&&bubblePressure(p)>0?bubblePressure(p)*.5:0):0;
  const outs=calcOuts(p.hole,S.board), ip=inPosition(0), aggr=S.pfAggr===0;
  const r=S.street===0?preflopAdvice():postflopAdvice(eq,odds,outs,ip,aggr,opp);
  return Object.assign(r,{eq,eqRaw,odds,toCall,pot,outs,ip,opp});
}
function renderCoach(){
  const r=S.rec; if(!r) return;
  const p=hero, pos=posName(0), ev=S.board.length?evaluate(p.hole.concat(S.board)):null, cs=coachStyle();
  let h=`<div class="stybox">🎭 Aprendendo a jogar como <b>${cs.name}</b> <span class="muted">· meta VPIP ${cs.vpip.join('–')}% · PFR ${cs.pfr.join('–')}%</span></div>`;
  if(S.game==='mtt'){const M=p.stack/(SBL+BB+ANTE),[zn,zc,zt]=mZone(M),bub=bubblePressure(p);
    h+=`<h4>🏆 Situação no torneio</h4><div>Stack efetivo <b>${(effStack(p)/BB).toFixed(1)} BB</b> · M <b style="color:${zc}">${M.toFixed(1)} (zona ${zn})</b></div><div class="muted">${zt}</div>`;
    if(bub>0) h+=`<div class="rec f" style="margin-top:6px"><b>🫧 Bolha / ICM:</b> perder agora custa mais do que dobrar ganha. Evite all-ins marginais; quem tem stack grande vai te pressionar.</div>`;
    else if(bub<0) h+=`<div class="rec" style="margin-top:6px"><b>🫧 Bolha:</b> você tem stack grande — pressione os stacks médios, eles não podem pagar sem mão forte.</div>`;}
  h+=`<h4>📍 Sua posição: ${pos} ${r.ip&&S.street>0?'(em posição ✓)':S.street>0?'(fora de posição)':''}</h4><div>${posInfo(pos)}</div>`;
  const nm=notation(p.hole), nick=NICK[nm]||NICK[nm.slice(0,2)];
  h+=`<h4>🃏 Sua mão</h4>`;
  if(S.street===0){const ch=chen(p.hole),[tn,tc]=tier(ch);
    h+=`<div><b>${nm.replace(/T/g,'10')}</b> ${nick?'— '+nick:''}</div><div>${handClass(p.hole).map(x=>`<span class="tag">${x}</span>`).join('')}<span class="tag ${tc}">${tn} · top ${pct(handPct(p.hole))}</span></div>`;}
  else{h+=`<div><b>${describe(ev)}</b> <span class="muted">(${CAT[ev.cat]})</span></div><ul class="l">${relHand(p.hole,S.board,ev).map(x=>`<li>${x}</li>`).join('')}</ul>`;
    h+=`<h4>🌊 Textura da mesa</h4><div>${texture(S.board).map(x=>`<span class="tag">${x}</span>`).join('')}</div>`;}
  h+=`<h4>📈 Equidade & Pot odds</h4>
    <div class="kv"><span>Contra os ranges estimados</span><b>${pct(r.eq)}</b></div><div class="bar"><i style="width:${r.eq*100}%"></i></div>
    <div class="kv muted"><span>Contra mãos aleatórias</span><span>${pct(r.eqRaw)}</span></div>`;
  if(r.toCall>0) h+=`<div class="kv"><span>Pot odds: paga ${fmt(Math.min(r.toCall,hero.stack))} p/ ganhar ${fmt(r.pot)}</span><b>precisa ${pct(r.odds)}</b></div><div class="bar odds"><i style="width:${r.odds*100}%"></i></div>`;
  else h+=`<div class="muted">Ninguém apostou: você pode dar check grátis.</div>`;
  if(r.outs&&r.outs.total){const g=Object.entries(r.outs.groups).sort((a,b)=>b[0]-a[0]).map(([c,cs2])=>`<span class="tag">${cs2.length} p/ ${CAT[c]}</span>`).join('');
    const mult=S.street===1?'×4 (2 cartas) ≈ '+Math.min(100,r.outs.total*4)+'% até o river · ×2 ≈ '+r.outs.total*2+'% só no turn':'×2 ≈ '+r.outs.total*2+'% no river';
    h+=`<h4>🎯 Outs: ${r.outs.total}</h4><div>${g}</div><div class="muted">Regra do 4 e 2: ${r.outs.total} outs ${mult}</div>`;}
  const cls=r.action==='fold'?'f':r.action==='raise'?'':'c';
  h+=`<h4>✅ Jogada recomendada (${cs.name.split(' ')[0]})</h4><div class="rec ${cls}"><div class="t">${r.title}</div><div>${r.why}</div></div>`;
  const vil=liveP().filter(x=>!x.isHero).map(x=>`<li><b>${x.name}</b> <span class="muted">(${x.style})</span> — range: ${x.range?`top ${pct(x.range)} <i>(${x.rangeWhy})</i>`:'qualquer mão'}<br><span class="muted">${x.cfg.tip}</span></li>`).join('');
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
  let h=`<h4>📋 Resumo da mão #${S.handNo}</h4><div>Resultado: <b style="color:${net>=0?'var(--green)':'var(--red)'}">${net>=0?'+':''}${fmt(net)} (${(net/BB).toFixed(1)} BB)</b></div>`;
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
  S.players.forEach((p,i)=>{const [x,y]=seatPos()[i];
    if(p.empty){h+=`<div class="seat empty" style="left:${x}%;top:${y}%"><div class="box">Lugar vazio</div></div>`;return;}
    const show=p.isHero||(S.xray&&S.mode==='learn')||(S.showdown&&!p.folded);
    const cards=(p.hole||[]).length&&!(p.folded&&!p.isHero)?p.hole.map(c=>cardHTML(c,!show,!p.isHero)).join(''):'';
    h+=`<div class="seat ${p.isHero?'hero':''} ${p.folded?'folded':''} ${S.toAct===i&&!S.handOver?'turn':''} ${p.winner?'win':''}" style="left:${x}%;top:${y}%">
      <div class="cards">${cards}</div>
      <div class="box">${i===S.dealer?'<div class="dealer">D</div>':''}<div class="pos">${posName(i)}</div>
        <div class="nm">${p.name}</div><div class="st">${fmt(p.stack)} <small>(${+(p.stack/BB).toFixed(1)} BB)</small></div>
        ${!p.isHero&&S.mode==='learn'?`<div class="sty">${p.style}</div>`:''}
        ${p.handDesc&&S.showdown&&!p.folded?`<div class="hd">${p.handDesc}</div>`:''}
        <div class="act">${p.lastAction||''}</div></div></div>`;
    if(p.bet>0){const k=MQ_PHONE.matches?.22:.45,bx=x+(50-x)*k,by=y+(46-y)*k;h+=`<div class="chip" style="left:${bx}%;top:${by}%">${fmt(p.bet)}</div>`;}
  });
  $('#seats').innerHTML=h; $('.table-wrap').classList.toggle('n9',N>6);
  let b=S.board.map(c=>cardHTML(c)).join(''); for(let k=S.board.length;k<5;k++) b+='<div class="slot"></div>';
  $('#board').innerHTML=b; $('#pot').textContent='Pote: '+fmt(potTotal());
  if(S.game==='cash') $('.felt .brand').textContent="POKER LAB · NL HOLD'EM 1/2";
  updateControls(); renderStats();
}
function heroTurn(){return !S.handOver&&S.toAct===0&&!hero.folded&&!hero.allIn&&S.rec;}
function updateControls(){
  const on=heroTurn(), toCall=S.currentBet-hero.bet, pot=potTotal(), maxTo=hero.bet+hero.stack, minTo=Math.min(S.currentBet+S.minRaise,maxTo);
  const othersCanAct=S.players.some(p=>!p.isHero&&!p.folded&&!p.allIn);
  $('#bFold').disabled=!on;
  $('#bCall').disabled=!on;
  $('#bCall').innerHTML=(toCall>0?(toCall>=hero.stack?`All-in ${fmt(hero.stack)}`:`Pagar ${fmt(toCall)}`):'Check')+'<kbd>C</kbd>';
  const canRaise=on&&hero.stack>toCall&&othersCanAct;
  $('#bRaise').disabled=!canRaise; $('#rng').disabled=!canRaise; $('#amt').disabled=!canRaise;
  const over=S.game==='mtt'&&(T.heroOut||T.finished);
  $('#bNext').disabled=!S.handOver; $('#bNext').innerHTML=over?'Ver resultado 🏆':'Próxima mão ▶ <kbd>Espaço</kbd>';
  if(on){
    const rng=$('#rng'); rng.min=minTo; rng.max=maxTo; rng.step=Math.max(1,SBL/2);
    let v=S.rec&&S.rec.size&&S.mode==='learn'?S.rec.size:minTo; v=Math.max(minTo,Math.min(maxTo,v));
    if(S._ctlFor!==S.handNo+'-'+S.street+'-'+S.currentBet){rng.value=v;$('#amt').value=v;S._ctlFor=S.handNo+'-'+S.street+'-'+S.currentBet;}
    setRaiseLabel();
    const pre=[];
    if(S.street===0&&S.raises===0) pre.push(['2,2 BB',BB*2.2],['2,5 BB',BB*2.5],['3 BB',BB*3]);
    else if(S.street===0) pre.push(['3x',S.currentBet*3],['4x',S.currentBet*4]);
    else pre.push(['1/3 pote',S.currentBet+(pot+toCall)/3],['1/2 pote',S.currentBet+(pot+toCall)/2],['3/4 pote',S.currentBet+(pot+toCall)*.75],['Pote',S.currentBet+pot+toCall]);
    pre.push(['All-in',maxTo]);
    $('#presets').innerHTML=pre.map(([l,val])=>`<button class="btn pre" data-v="${Math.max(minTo,Math.min(maxTo,Math.round(val)))}" ${canRaise?'':'disabled'}>${l}</button>`).join('');
    let inf=`Sua vez · Pote <b>${fmt(pot)}</b>`+(toCall>0?` · Para pagar <b>${fmt(Math.min(toCall,hero.stack))}</b>`:'');
    if(S.mode==='learn'&&S.rec){inf+=` · Equidade <b>${pct(S.rec.eq)}</b>`+(toCall>0?` vs pot odds <b>${pct(S.rec.odds)}</b>`:'');}
    $('#ctlInfo').innerHTML=inf;
  } else {
    $('#presets').innerHTML='';
    $('#ctlInfo').innerHTML=over?(T.heroOut?`Você foi eliminado em ${hero.place}º.`:'Torneio encerrado.'):S.handOver?'Mão encerrada.':hero.folded?'Você desistiu desta mão. Observe como os outros jogam.':`Aguardando ${S.players[S.toAct]?S.players[S.toAct].name:''}…`;
  }
}
function setRaiseLabel(){const v=+$('#amt').value, maxTo=hero.bet+hero.stack;
  $('#bRaise').innerHTML=(v>=maxTo?'ALL-IN ':S.currentBet===0?'Apostar ':'Aumentar p/ ')+fmt(v)+'<kbd>R</kbd>';}
function renderStats(){
  const s=ST, pc=(a,b)=>b?Math.round(a/b*100)+'%':'—', cs=coachStyle();
  const bb100=s.hands?(s.net/2/s.hands*100).toFixed(1):'—';
  const inRange=(v,[a,b])=>v>=a&&v<=b?'var(--green)':'#d29922';
  const vp=s.hands?Math.round(s.vpip/s.hands*100):null, pf=s.hands?Math.round(s.pfr/s.hands*100):null;
  let h=`<div class="grid">
    <div class="kv"><span>Mãos</span><b>${s.hands}</b></div>
    <div class="kv"><span>Ganhas</span><b>${s.won} (${pc(s.won,s.hands)})</b></div>
    <div class="kv"><span>Saldo</span><b style="color:${s.net>=0?'var(--green)':'var(--red)'}">${s.net>=0?'+':''}${(s.net/2).toFixed(1)} BB</b></div>
    <div class="kv"><span>BB/100</span><b>${bb100}</b></div>
    <div class="kv" title="% de mãos em que você pôs dinheiro voluntariamente no pré-flop"><span>VPIP</span><b style="color:${vp==null?'':inRange(vp,cs.vpip)}">${pc(s.vpip,s.hands)}</b></div>
    <div class="kv" title="% de mãos em que você aumentou no pré-flop"><span>PFR</span><b style="color:${pf==null?'':inRange(pf,cs.pfr)}">${pc(s.pfr,s.hands)}</b></div>
    <div class="kv"><span>Showdowns ganhos</span><b>${s.sdWon}/${s.sd}</b></div>
    <div class="kv"><span>Acerto vs coach</span><b>${pc(s.good,s.dec)}</b></div></div>`;
  h+=`<div class="muted" style="font-size:12px;margin-top:4px">Meta do estilo <b>${cs.name}</b>: VPIP ${cs.vpip.join('–')}%, PFR ${cs.pfr.join('–')}% (verde = dentro da meta).</div>`;
  const m=Object.entries(s.mist).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if(m.length) h+=`<h4>⚠️ Onde você está errando</h4><ul class="l">${m.map(([k,v])=>`<li>${k} <span class="tag bad">${v}x</span></li>`).join('')}</ul>`;
  const bh=Object.entries(s.byHand).filter(([,v])=>v<0).sort((a,b)=>a[1]-b[1]).slice(0,5);
  if(bh.length) h+=`<h4>💸 Mãos iniciais que mais te custaram</h4><div>${bh.map(([k,v])=>`<span class="tag bad">${k.replace(/T/g,'10')}: ${v.toFixed(1)} BB</span>`).join('')}</div>`;
  const gh=Object.entries(s.byHand).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if(gh.length) h+=`<h4>💰 Mãos que mais te deram lucro</h4><div>${gh.map(([k,v])=>`<span class="tag good">${k.replace(/T/g,'10')}: +${v.toFixed(1)} BB</span>`).join('')}</div>`;
  if(s.losses.length) h+=`<h4>❌ Últimos showdowns perdidos</h4><ul class="l">${s.losses.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  $('#stats').innerHTML=h;
}
function renderStyleInfo(){const cs=coachStyle(); $('#styleDesc').innerHTML=`${cs.desc} <span class="muted">Meta: VPIP ${cs.vpip.join('–')}% · PFR ${cs.pfr.join('–')}%.</span>`;}

/* ============ GLOSSÁRIO ============ */
const RANKING=[['Royal Flush','A-K-Q-J-10 do mesmo naipe. A mão perfeita.'],['Straight Flush','5 em sequência do mesmo naipe.'],['Quadra (four of a kind, "poker")','4 cartas iguais.'],['Full House ("full")','Trinca + par.'],['Flush ("cor")','5 cartas do mesmo naipe.'],['Sequência (straight)','5 cartas em sequência (A pode ser baixo: A-2-3-4-5 = "wheel/roda").'],['Trinca (trips / set)','3 cartas iguais. SET = par na mão + 1 na mesa; TRIPS = 1 na mão + par na mesa.'],['Dois Pares','Dois pares diferentes.'],['Um Par','Duas cartas iguais.'],['Carta Alta (high card)','Nenhuma combinação: vale a maior carta.']];
const GLOSS=[['Blinds (SB/BB)','Apostas obrigatórias antes das cartas. No cash: SB=1, BB=2. No torneio sobem a cada nível.'],['Ante (BB ante)','Aposta extra obrigatória que vai direto para o pote. No formato "BB ante", o big blind paga por toda a mesa.'],['Button (BTN / Dealer)','Melhor posição: age por último pós-flop.'],['UTG, MP/Hijack, CO','Posições da primeira à última antes do botão.'],['Em posição (IP) / fora (OOP)','IP = agir depois do adversário (vantagem de informação).'],['Pré-flop, Flop, Turn, River','As 4 rodadas de apostas: 0, 3, 4 e 5 cartas na mesa.'],['Check','Passar a vez sem apostar (só se ninguém apostou).'],['Bet / Raise','Apostar / aumentar a aposta de alguém.'],['Call','Pagar a aposta.'],['Fold','Desistir da mão.'],['Limp','Só pagar o BB no pré-flop sem aumentar. Geralmente ruim.'],['Open-raise','Primeiro aumento no pré-flop.'],['3-bet / 4-bet','Re-aumento / re-re-aumento.'],['C-bet (continuation bet)','Aposta no flop de quem aumentou no pré-flop.'],['Value bet','Aposta para ser pago por mãos piores.'],['Blefe','Apostar com mão fraca para fazer o outro desistir.'],['Semi-blefe','Apostar com um projeto: pode ganhar agora OU completar depois.'],['Slowplay','Jogar passivo com mão monstro para enganar.'],['Draw (projeto)','Mão que precisa de carta: flush draw (9 outs), open-ended (8), gutshot (4).'],['Outs','Cartas que melhoram sua mão para provavelmente vencer.'],['Regra do 4 e 2','Outs ×4 no flop (até o river) ou ×2 com 1 carta para vir = % aproximada.'],['Equidade (equity)','Sua % de chance de ganhar o pote no showdown.'],['Pot odds','Quanto você paga ÷ (pote + o que paga). Se equidade > pot odds → call lucrativo.'],['Odds implícitas','Fichas extras que você espera ganhar se completar o projeto.'],['+EV / −EV','Jogada lucrativa / perdedora no longo prazo.'],['Range','Conjunto de mãos que um jogador pode ter. "Top 15%" = as 15% melhores mãos iniciais.'],['Kicker','Carta lateral que desempata mãos iguais.'],['Top pair / Overpair','Par com a maior carta da mesa / par de mão maior que a mesa.'],['Nuts','A melhor mão possível naquele momento.'],['Board seco / molhado','Mesa com poucos / muitos projetos possíveis.'],['VPIP / PFR','% de mãos jogadas / % de mãos aumentadas no pré-flop.'],['Showdown','Quando as cartas são mostradas no final.'],['Side pot','Pote paralelo quando alguém está all-in com menos fichas.'],['Tilt','Jogar mal por emoção após perder.'],['Nit / TAG / LAG / Rock / Calling station','Perfis: super tight / tight-agressivo / loose-agressivo / tight-passivo / paga tudo.'],['GTO','"Game Theory Optimal": estratégia equilibrada entre valor e blefe, difícil de explorar.'],['Reg','Jogador regular, que joga sério e com frequência.'],['MTT','Torneio com várias mesas (multi-table tournament).'],['Stack efetivo','O menor stack entre você e o adversário: é o máximo que pode ser apostado entre vocês.'],['M (Harrington)','Stack ÷ (SB + BB + antes): quantas voltas você aguenta sem jogar. Zonas: verde (20+), amarela (10–20), laranja (6–10), vermelha (1–5).'],['Push / fold','Com stack curto (≤12 BB), jogar só all-in ou fold.'],['Re-shove','All-in por cima do aumento de outro jogador.'],['Bolha','Momento em que falta só 1 eliminação para todos entrarem no prêmio.'],['ITM (in the money)','Estar na zona de premiação.'],['ICM','Modelo que converte fichas em valor de prêmio: perto da bolha e na mesa final, perder fichas dói mais do que ganhar ajuda.'],['Mesa final','Os últimos jogadores do torneio reunidos em uma mesa.'],['Quebra / balanceamento de mesa','Quando sobram poucos jogadores, mesas são fechadas e jogadores mudam de mesa para equilibrar.']];
$('#glossBody').innerHTML=`<h3 style="color:var(--gold)">🏆 Ranking (da mais forte para a mais fraca)</h3><table class="rk">${RANKING.map((r,i)=>`<tr><td>${i+1}</td><td><b>${r[0]}</b></td><td class="muted">${r[1]}</td></tr>`).join('')}</table>
<h3 style="color:var(--gold);margin-top:16px">📖 Termos</h3><dl>${GLOSS.map(g=>`<dt>${g[0]}</dt><dd>${g[1]}</dd>`).join('')}</dl>`;

/* ============ EVENTOS ============ */
const dlg=$('#dlg');
function syncGameUI(){
  document.querySelectorAll('#gameSeg button').forEach(b=>b.classList.toggle('on',b.dataset.g===S.game));
  $('#tableSize').disabled=S.game==='mtt';   // no torneio os lugares vêm da janela de novo torneio
  renderTourney();
}
$('#bGloss').onclick=()=>dlg.showModal();
$('#bFold').onclick=()=>heroAct('fold');
$('#bCall').onclick=()=>heroAct(S.currentBet-hero.bet>0?'call':'check');
$('#bRaise').onclick=()=>heroAct('raise',+$('#amt').value);
$('#bNext').onclick=()=>{if(S.handOver)startHand();};
$('#rng').oninput=e=>{$('#amt').value=e.target.value;setRaiseLabel();};
$('#amt').oninput=e=>{$('#rng').value=e.target.value;setRaiseLabel();};
$('#presets').onclick=e=>{const v=e.target.dataset.v;if(v){$('#amt').value=v;$('#rng').value=v;setRaiseLabel();}};
$('#xray').onchange=e=>{S.xray=e.target.checked;render();};
$('#bReset').onclick=()=>{if(confirm('Zerar todas as estatísticas?')){ST=freshStats();saveStats();renderStats();renderTourney();}};
$('#modeSeg').onclick=e=>{const m=e.target.dataset.m;if(!m)return;S.mode=m;
  document.querySelectorAll('#modeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  document.body.classList.toggle('treino',m==='treino'); render(); if(heroTurn()) renderCoach();};
$('#coachStyle').value=S.coachStyle; renderStyleInfo();
$('#coachStyle').onchange=e=>{S.coachStyle=e.target.value;try{localStorage.setItem('pokerlab-style',S.coachStyle);}catch(x){}
  renderStyleInfo(); renderStats(); if(heroTurn()){S.rec=advise();renderCoach();updateControls();}};
$('#gameSeg').onclick=e=>{const g=e.target.dataset.g;if(!g)return;
  if(g==='mtt'){ $('#tdlg').showModal(); return; }
  if(S.game==='mtt'&&!(T.heroOut||T.finished)&&!confirm('Abandonar o torneio e voltar para o cash game?')) return;
  if(S.game==='mtt') leaveTournament();};
try{const sv=+localStorage.getItem('pokerlab-seats'); if(sv===9) buildCashTable(9);}catch(e){}
const FIELDS={6:[[6,'Sit & Go — 6 jogadores (1 mesa)'],[18,'Torneio pequeno — 18 jogadores'],[36,'Open — 36 jogadores'],[72,'Grande Open — 72 jogadores']],
  9:[[9,'Sit & Go — 9 jogadores (1 mesa)'],[27,'Torneio pequeno — 27 jogadores'],[54,'Open — 54 jogadores'],[90,'Grande Open — 90 jogadores']]};
function fillFields(){const f=FIELDS[+$('#tSeats').value]; $('#tField').innerHTML=f.map(([v,t],k)=>`<option value="${v}"${k===2?' selected':''}>${t}</option>`).join('');}
$('#tSeats').onchange=fillFields; $('#tSeats').value=String(N); fillFields();
$('#bTStart').onclick=()=>{ $('#tdlg').close(); if($('#rdlg').open) $('#rdlg').close(); startTournament(+$('#tField').value,+$('#tSpeed').value,+$('#tSeats').value); };
$('#tableSize').value=String(N);
$('#tableSize').onchange=e=>{ if(S.game==='mtt'){e.target.value=String(N);return;}
  S.handNo++; S.handOver=true; clearTimeout(S.autoT); buildCashTable(+e.target.value); try{localStorage.setItem('pokerlab-seats',N);}catch(x){} $('#tSeats').value=String(N); fillFields(); log(`🪑 Mesa de <b>${N} lugares</b>.`); startHand(); };
$('#bSimEnd').onclick=()=>simulateToEnd();
$('#bNewT').onclick=()=>{ $('#rdlg').close(); $('#tdlg').showModal(); };
$('#bToCash').onclick=()=>{ $('#rdlg').close(); leaveTournament(); };
$('#proBots').onchange=e=>{S.proBots=e.target.checked;};
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'&&e.target.type==='number') return;
  if(document.querySelector('dialog[open]')) return;
  const k=e.key.toLowerCase();
  if(k==='f'&&!$('#bFold').disabled) $('#bFold').click();
  else if(k==='c'&&!$('#bCall').disabled) $('#bCall').click();
  else if(k==='r'&&!$('#bRaise').disabled) $('#bRaise').click();
  else if((k===' '||k==='enter')&&S.handOver){e.preventDefault();startHand();}
});
function saveAudio(){try{localStorage.setItem('pokerlab-audio',JSON.stringify({on:AU.on,vol:AU.vol}));}catch(e){}}
function syncSnd(){$('#bSnd').textContent=AU.on?'🔊':'🔇';$('#vol').value=AU.vol;}
$('#bSnd').onclick=()=>{AU.on=!AU.on;saveAudio();syncSnd();if(AU.on)SFX.chips(0,3);};
$('#vol').oninput=e=>{AU.vol=+e.target.value;saveAudio();};
$('#vol').onchange=()=>SFX.chips(0,3);
syncSnd();
window.__S=S; window.__AU=AU; window.__T=T;
startHand();
