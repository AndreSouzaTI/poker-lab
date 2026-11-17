/* Poker Lab — motor puro: avaliador de mãos, equidade (Monte Carlo), Chen e análises.
   Sem DOM: roda no navegador e no Node (testes). */
"use strict";
const SUITS=['♠','♥','♦','♣'];
let BB=2, SBL=1, ANTE=0;          // blinds variam no torneio
const START=200; let N=6;   // N = lugares na mesa (6 ou 9)
const rk=c=>(c>>2)+2, su=c=>c&3;
const RCH=r=>({14:'A',13:'K',12:'Q',11:'J',10:'T'})[r]||String(r);
const RDISP=r=>r===10?'10':RCH(r);
const RNAME={14:'Ás',13:'Rei',12:'Dama',11:'Valete',10:'Dez',9:'Nove',8:'Oito',7:'Sete',6:'Seis',5:'Cinco',4:'Quatro',3:'Três',2:'Dois'};
const RPL={14:'Ases',13:'Reis',12:'Damas',11:'Valetes',10:'Dez',9:'Noves',8:'Oitos',7:'Setes',6:'Seis',5:'Cincos',4:'Quatros',3:'Três',2:'Dois'};
const CAT=['Carta Alta','Um Par','Dois Pares','Trinca','Sequência','Flush','Full House','Quadra','Straight Flush'];
const pct=x=>Math.round(x*100)+'%';


/* ============ AVALIADOR DE MÃOS ============ */
function straightHigh(ranks){
  const h=new Array(15).fill(false); for(const r of ranks) h[r]=true; h[1]=h[14];
  for(let t=14;t>=5;t--) if(h[t]&&h[t-1]&&h[t-2]&&h[t-3]&&h[t-4]) return t;
  return 0;
}
function mk(cat,ks){let v=cat;for(let i=0;i<5;i++) v=v*15+(ks[i]||0);return {cat,v,ks};}
function evaluate(cards){
  const cnt=new Array(15).fill(0), bySuit=[[],[],[],[]];
  for(const c of cards){cnt[rk(c)]++;bySuit[su(c)].push(rk(c));}
  let fl=null;
  for(let s=0;s<4;s++) if(bySuit[s].length>=5) fl=bySuit[s].sort((a,b)=>b-a);
  if(fl){const sf=straightHigh(fl); if(sf) return mk(8,[sf]);}
  const q=[],t=[],p=[],u=[];
  for(let r=14;r>=2;r--){ if(cnt[r]) u.push(r); if(cnt[r]===4)q.push(r); else if(cnt[r]===3)t.push(r); else if(cnt[r]===2)p.push(r); }
  if(q.length) return mk(7,[q[0],u.find(r=>r!==q[0])||0]);
  if(t.length&&(t.length>1||p.length)) return mk(6,[t[0],Math.max(t[1]||0,p[0]||0)]);
  if(fl) return mk(5,fl.slice(0,5));
  const st=straightHigh(u); if(st) return mk(4,[st]);
  if(t.length) return mk(3,[t[0],...u.filter(r=>r!==t[0]).slice(0,2)]);
  if(p.length>=2) return mk(2,[p[0],p[1],u.find(r=>r!==p[0]&&r!==p[1])||0]);
  if(p.length) return mk(1,[p[0],...u.filter(r=>r!==p[0]).slice(0,3)]);
  return mk(0,u.slice(0,5));
}
function describe(ev){const k=ev.ks;switch(ev.cat){
  case 0:return `Carta Alta (${RNAME[k[0]]})`;
  case 1:return `Par de ${RPL[k[0]]}`;
  case 2:return `Dois Pares (${RPL[k[0]]} e ${RPL[k[1]]})`;
  case 3:return `Trinca de ${RPL[k[0]]}`;
  case 4:return `Sequência até o ${RNAME[k[0]]}`;
  case 5:return `Flush com ${RNAME[k[0]]} alto`;
  case 6:return `Full House (${RPL[k[0]]} com ${RPL[k[1]]})`;
  case 7:return `Quadra de ${RPL[k[0]]}`;
  case 8:return k[0]===14?'ROYAL FLUSH!':`Straight Flush até o ${RNAME[k[0]]}`;}}

/* Monte Carlo: equidade contra N mãos aleatórias */
function equity(hole,board,nOpp,iters){
  if(nOpp<1) return 1;
  const used=new Set(hole.concat(board)), deck=[];
  for(let c=0;c<52;c++) if(!used.has(c)) deck.push(c);
  const need=5-board.length, k=need+nOpp*2; let score=0;
  for(let it=0;it<iters;it++){
    for(let i=0;i<k;i++){const j=i+Math.floor(Math.random()*(deck.length-i));const x=deck[i];deck[i]=deck[j];deck[j]=x;}
    const b=board.concat(deck.slice(0,need));
    const hv=evaluate(hole.concat(b)).v; let lose=false,ties=0;
    for(let o=0;o<nOpp;o++){const ov=evaluate([deck[need+o*2],deck[need+o*2+1]].concat(b)).v;
      if(ov>hv){lose=true;break} if(ov===hv)ties++;}
    if(!lose) score+=1/(ties+1);
  }
  return score/iters;
}

/* ============ PRÉ-FLOP ============ */
function chen(h){let a=rk(h[0]),b=rk(h[1]);if(a<b)[a,b]=[b,a];
  const base=a===14?10:a===13?8:a===12?7:a===11?6:a/2;
  if(a===b) return Math.max(Math.ceil(base*2),5);
  let s=base; if(su(h[0])===su(h[1]))s+=2;
  const g=a-b-1; s-= g===0?0:g===1?1:g===2?2:g===3?4:5;
  if(g<=1&&a<12)s+=1; return Math.ceil(s);}
const isPair=h=>rk(h[0])===rk(h[1]);
function notation(h){let a=rk(h[0]),b=rk(h[1]);if(a<b)[a,b]=[b,a];
  if(a===b) return RCH(a)+RCH(b); return RCH(a)+RCH(b)+(su(h[0])===su(h[1])?'s':'o');}
const NICK={AA:'"Foguetes" (Pocket Rockets) — a melhor mão inicial',KK:'"Cowboys" — 2ª melhor mão',QQ:'"Damas" (Ladies)',JJ:'"Hooks" (ganchos) — forte, mas difícil de jogar',TT:'"Dimes"',88:'"Bonecos de neve" (Snowmen)',22:'"Patinhos" (Ducks)',AK:'"Big Slick"',AQ:'"Big Chick"',KQ:'"Casal Real" (Royal Couple)',AJ:'"Black Jack"',K9:'"Canine"',J5:'"Jackson Five"','72o':'A PIOR mão do poker!'};
function handClass(h){const a=Math.max(rk(h[0]),rk(h[1])),b=Math.min(rk(h[0]),rk(h[1])),s=su(h[0])===su(h[1]),out=[];
  if(a===b) out.push('Par de mão (pocket pair)');
  else{ out.push(s?'Do mesmo naipe (suited)':'Naipes diferentes (offsuit)');
    if(a-b===1) out.push(s?'Suited connector':'Conectores');
    else if(a-b===2) out.push('One-gapper (1 buraco)');
    if(b>=10) out.push('Broadway (duas cartas 10+)');
    else if(a===14) out.push(`Ás com kicker ${RDISP(b)}`+(b<=9?' (kicker fraco = cuidado com mão dominada)':''));}
  return out;}
function tier(ch){return ch>=12?['Premium','good']:ch>=9?['Forte','good']:ch>=7?['Jogável','']:ch>=5?['Marginal / especulativa','']:['Fraca (lixo)','bad'];}
const OPEN_TH={UTG:9,'UTG+1':8.7,MP:8,LJ:7.7,HJ:7.4,CO:7,BTN:6,SB:7,BB:7};
const POSINFO={
  UTG:'<b>UTG (Under the Gun)</b> — o primeiro a falar no pré-flop. Posição mais difícil: ainda há 5 jogadores atrás de você. Jogue só ~15% das mãos (pares médios+, AJ+, KQ).',
  MP:'<b>MP / Hijack</b> — posição intermediária. Ainda há 4 jogadores para agir. Range de abertura ~20%.',
  'UTG+1':'<b>UTG+1</b> — segunda posição a falar. Ainda é uma posição muito cedo: há muita gente atrás de você. Jogue só ~17% das mãos.',
  LJ:'<b>LJ (Lojack)</b> — posição do meio, ainda cedo para agir. Range de abertura ~20%; evite mãos marginais.',
  HJ:'<b>HJ (Hijack)</b> — duas posições antes do Button. Range de abertura ~24%: já dá para abrir mais mãos suited e conectadas.',
  CO:'<b>CO (Cutoff)</b> — a 2ª melhor posição. Só o Button e os blinds agem depois. Abra ~28-30% e tente roubar os blinds.',
  BTN:'<b>BTN (Button / Dealer)</b> — a MELHOR posição: você age por último em todo o pós-flop (flop, turn, river). Abra ~40-45% das mãos.',
  SB:'<b>SB (Small Blind)</b> — já pôs meia aposta, mas jogará fora de posição em todas as ruas. Seja seletivo; prefira aumentar a só completar.',
  BB:'<b>BB (Big Blind)</b> — já pagou 1 BB, então tem "desconto" para defender contra aumentos. Mas joga fora de posição no pós-flop.'};

/* ============ ANÁLISES PÓS-FLOP ============ */
function texture(board){
  if(board.length<3) return [];
  const t=[], sc=[0,0,0,0]; board.forEach(c=>sc[su(c)]++);
  const ms=Math.max(...sc), rs=[...new Set(board.map(rk))].sort((a,b)=>a-b);
  if(ms>=3) t.push(`${ms===board.length?'Monotone':ms+' cartas do mesmo naipe'}: FLUSH possível`);
  else if(ms===2&&board.length<5) t.push('Two-tone: projeto de flush possível');
  if(rs.length<board.length) t.push('Mesa pareada: full house / quadra possíveis');
  let conn=false; const rr=rs.includes(14)?[1,...rs]:rs;
  for(let i=0;i+2<rr.length;i++) if(rr[i+2]-rr[i]<=4) conn=true;
  if(conn) t.push('Mesa conectada: sequências possíveis');
  if(!t.length) t.push('Board seco (dry): poucos projetos — bom para c-bet');
  return t;
}
function drawsOf(hole,board){
  const res=[], all=hole.concat(board), ev=evaluate(all);
  if(board.length>=5) return res;
  if(ev.cat<5) for(let s=0;s<4;s++){const n=all.filter(c=>su(c)===s).length;
    if(n===4&&hole.some(c=>su(c)===s)) res.push(`<b>Projeto de flush</b> (flush draw): 4 cartas de ${SUITS[s]} → 9 outs`);}
  if(ev.cat<4){const has=new Set(all.map(rk));let k=0;
    for(let r=2;r<=14;r++){if(has.has(r))continue; if(straightHigh([...has,r])) k++;}
    if(k>=2) res.push('<b>Sequência aberta</b> (open-ended / OESD) → 8 outs');
    else if(k===1) res.push('<b>Gutshot</b> (sequência "de barriga", precisa da carta do meio) → 4 outs');}
  return res;
}
function relHand(hole,board,ev){
  const out=[], hr=hole.map(rk).sort((a,b)=>b-a), br=board.map(rk).sort((a,b)=>b-a), bev=evaluate(board);
  if(ev.cat===1){const pr=ev.ks[0];
    if(bev.cat>=1&&bev.ks[0]===pr) out.push('O par está na <b>mesa</b> (todo mundo tem). Sua mão vale só pela carta alta/kicker.');
    else if(hr[0]===hr[1]) out.push(pr>br[0]?'<b>Overpair</b>: seu par de mão é maior que todas as cartas da mesa — forte.':'<b>Underpair</b>: seu par de mão está abaixo de cartas da mesa — cuidado.');
    else if(pr===br[0]) out.push(`<b>Top pair</b> (par com a maior carta da mesa), kicker ${RNAME[hr.find(r=>r!==pr)]}.`);
    else if(pr===br[br.length-1]) out.push('<b>Bottom pair</b> (par com a menor carta da mesa) — fraco.');
    else out.push('<b>Middle pair</b> (par com a carta do meio) — médio/fraco.');}
  if(ev.cat===3) out.push(hr[0]===hr[1]&&hr[0]===ev.ks[0]?'<b>SET</b>: trinca com par na mão + 1 na mesa. Muito forte e disfarçada!':(bev.cat===3?'A trinca está toda na mesa — todos têm.':'<b>TRIPS</b>: trinca usando um par da mesa. Forte, mas o kicker importa.'));
  if(ev.cat===2&&bev.cat>=1) out.push('Um dos pares é da mesa — seus "dois pares" são mais fracos do que parecem.');
  if(ev.cat>=4&&bev.cat===ev.cat) out.push('⚠️ Sua mão está na mesa: você está "jogando a mesa" (empate provável).');
  return out.concat(drawsOf(hole,board));
}
function calcOuts(hole,board){
  if(board.length<3||board.length>=5) return null;
  const cur=evaluate(hole.concat(board)), used=new Set(hole.concat(board)), g={}; let n=0;
  for(let c=0;c<52;c++){ if(used.has(c)) continue;
    const e=evaluate(hole.concat(board,[c])), be=evaluate(board.concat([c]));
    if(e.cat>cur.cat&&e.cat>be.cat){n++;(g[e.cat]=g[e.cat]||[]).push(c);} }
  return {total:n,groups:g};
}
function beatAnalysis(hole,board){
  const used=new Set(hole.concat(board)), rest=[]; for(let c=0;c<52;c++) if(!used.has(c)) rest.push(c);
  const hv=evaluate(hole.concat(board)).v; let tot=0,beat=0,tie=0; const byCat={};
  for(let i=0;i<rest.length;i++) for(let j=i+1;j<rest.length;j++){
    tot++; const a=rest[i],b=rest[j],e=evaluate([a,b].concat(board));
    if(e.v>hv){beat++; const o=byCat[e.cat]=byCat[e.cat]||{n:0,labels:{}};o.n++;
      let ra=rk(a),rb=rk(b); if(ra<rb)[ra,rb]=[rb,ra];
      const lab=(e.cat===5||e.cat===8)?`2 de ${SUITS[su(a)]}`:RCH(ra)+RCH(rb); o.labels[lab]=(o.labels[lab]||0)+1;}
    else if(e.v===hv) tie++; }
  return {tot,beat,tie,byCat};
}
function summarizeLabels(labels){
  const keys=Object.keys(labels); if(keys[0]&&keys[0].startsWith('2 de')) return keys.map(k=>'qualquer '+k);
  const freq={}; keys.forEach(k=>new Set(k.split('')).forEach(ch=>freq[ch]=(freq[ch]||0)+1));
  const out=[], left=new Set(keys);
  Object.entries(freq).sort((a,b)=>b[1]-a[1]).forEach(([ch,n])=>{ if(n>=4){ let any=false; [...left].forEach(k=>{if(k.includes(ch)){left.delete(k);any=true;}}); if(any) out.push(`qualquer ${RDISP(({A:14,K:13,Q:12,J:11,T:10})[ch]||+ch)}x`);} });
  [...left].sort((a,b)=>labels[b]-labels[a]).forEach(k=>out.push(k.includes('T')?k.split('').map(c=>c==='T'?'10':c).join('-'):k));
  return out;
}


/* ============ RANKING DAS 169 MÃOS E RANGES ============ */
// Força aproximada = equidade (%) contra 1 mão aleatória. Pares: valores conhecidos; demais: ajuste linear.
const PAIR_EQ={14:85.2,13:82.4,12:79.9,11:77.5,10:75.1,9:72.1,8:69.1,7:66.2,6:63.3,5:60.3,4:57.0,3:53.7,2:50.3};
function handScore(hi,lo,suited){
  if(hi===lo) return PAIR_EQ[hi];
  const g=hi-lo-1; let s=10.5+2.91*hi+0.945*lo+(g===0?1.5:g===1?1:g===2?.5:0);
  return suited?s+3.2:s;
}
const HANDS169=(()=>{const L=[];
  for(let hi=14;hi>=2;hi--) for(let lo=hi;lo>=2;lo--){
    if(hi===lo) L.push({key:RCH(hi)+RCH(lo),hi,lo,suited:false,pair:true,combos:6,score:handScore(hi,lo,false)});
    else{L.push({key:RCH(hi)+RCH(lo)+'s',hi,lo,suited:true,combos:4,score:handScore(hi,lo,true)});
         L.push({key:RCH(hi)+RCH(lo)+'o',hi,lo,suited:false,combos:12,score:handScore(hi,lo,false)});}}
  L.sort((a,b)=>b.score-a.score); let cum=0;
  L.forEach(h=>{h.from=cum/1326;cum+=h.combos;h.to=cum/1326;}); return L;})();
const HAND_BY_KEY=Object.fromEntries(HANDS169.map(h=>[h.key,h]));
/** Percentil da mão: 0.02 = está entre as 2% melhores. */
function handPct(hole){return HAND_BY_KEY[notation(hole)].to;}
/** Todas as combinações (pares de cartas) das mãos no top `pct`, sem cartas mortas. */
function rangeCombos(pct,dead){
  const out=[];
  for(const h of HANDS169){ if(h.from>=pct) break;
    for(let s1=0;s1<4;s1++) for(let s2=0;s2<4;s2++){
      if(h.pair){ if(s2<=s1) continue; } else if(h.suited){ if(s1!==s2) continue; } else if(s1===s2) continue;
      const a=(h.hi-2)*4+s1, b=(h.lo-2)*4+s2;
      if(!dead.has(a)&&!dead.has(b)) out.push([a,b]); } }
  return out;
}
/** Equidade (Monte Carlo) contra adversários com ranges estimados (ex.: [0.15, 1] = top 15% e qualquer mão). */
function equityVsRanges(hole,board,ranges,iters){
  if(!ranges.length) return 1;
  const dead=new Set(hole.concat(board)), lists=ranges.map(r=>rangeCombos(Math.min(1,Math.max(r,.003)),dead));
  if(lists.some(l=>!l.length)) return equity(hole,board,ranges.length,iters);
  const deck=[]; for(let c=0;c<52;c++) if(!dead.has(c)) deck.push(c);
  const need=5-board.length; let score=0,n=0;
  for(let it=0;it<iters;it++){
    const used=new Set(), opp=[]; let ok=true;
    for(const l of lists){ let got=null;
      for(let t=0;t<12;t++){const h=l[Math.floor(Math.random()*l.length)]; if(!used.has(h[0])&&!used.has(h[1])){got=h;break;}}
      if(!got){ok=false;break;} used.add(got[0]);used.add(got[1]);opp.push(got); }
    if(!ok) continue;
    const b=board.slice();
    while(b.length<board.length+need){const c=deck[Math.floor(Math.random()*deck.length)]; if(!used.has(c)){used.add(c);b.push(c);}}
    const hv=evaluate(hole.concat(b)).v; let lose=false,ties=0;
    for(const o of opp){const ov=evaluate(o.concat(b)).v; if(ov>hv){lose=true;break;} if(ov===hv)ties++;}
    n++; if(!lose) score+=1/(ties+1);
  }
  return n?score/n:equity(hole,board,ranges.length,iters);
}

if(typeof module!=="undefined"&&module.exports){module.exports={SUITS,BB,rk,su,evaluate,describe,straightHigh,equity,chen,notation,isPair,handClass,tier,texture,drawsOf,relHand,calcOuts,beatAnalysis,summarizeLabels,CAT,OPEN_TH,handScore,HANDS169,handPct,rangeCombos,equityVsRanges};}
