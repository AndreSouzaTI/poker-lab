/* Poker Lab — IA "profissional": ranges por posição, leitura de ranges dos adversários,
   push/fold com stack curto, c-bet, semi-blefe, controle de SPR e pressão de bolha (ICM). */
"use strict";

/* % das mãos para abrir (open-raise) por posição — referência de regulares 6-max */
const OPEN_PCT={UTG:.17,'UTG+1':.15,MP:.21,LJ:.19,HJ:.23,CO:.28,BTN:.45,SB:.38,BB:.3};
/* mesa cheia (8-9 jogadores): quem fala primeiro abre menos */
function openPct(pos){const full=typeof S!=='undefined'&&S.players&&S.players.filter(x=>!x.empty).length>=8; return (full&&pos==='UTG')?.12:(OPEN_PCT[pos]||.25);}
/* % das mãos para all-in (push) com ~10 BB, por posição (aprox. de tabelas Nash) */
const PUSH_PCT={UTG:.14,'UTG+1':.15,MP:.18,LJ:.19,HJ:.22,CO:.26,BTN:.40,SB:.55,BB:.5};

/* Perfis dos adversários (torneio). loose = largura dos ranges, aggr = agressividade, call = vontade de pagar */
const PROFILES={
  reg:{style:'Regular TAG',loose:1,aggr:1,call:1,cbet:.7,bluff:.18,tip:'Jogador sólido: ranges certos por posição, c-bet frequente, quase nunca paga sem odds.'},
  lag:{style:'Regular LAG',loose:1.45,aggr:1.4,call:1.1,cbet:.8,bluff:.3,tip:'Abre muitas mãos e pressiona. Re-aumente mais contra ele e pague um pouco mais leve.'},
  nit:{style:'Nit',loose:.6,aggr:.8,call:.7,cbet:.5,bluff:.06,tip:'Só joga mãos fortes. Roube os blinds dele; se ele aumentar, desista sem mão forte.'},
  fish:{style:'Recreativo (peixe)',loose:1.8,aggr:.5,call:1.8,cbet:.35,bluff:.05,limp:true,tip:'Joga e paga demais. Aposte por valor e NÃO blefe.'},
  maniac:{style:'Maníaco',loose:2.2,aggr:2,call:1.3,cbet:.9,bluff:.45,tip:'Aumenta e vai all-in a toda hora. Espere mãos boas e deixe ele blefar.'},
};
function randomProfile(){const r=Math.random();
  return PROFILES[r<.42?'reg':r<.62?'lag':r<.78?'nit':r<.95?'fish':'maniac'];}

/* Estilos que o aluno pode escolher aprender (coach) */
const COACH_STYLES={
  tag:{name:'TAG (Tight-Agressivo)',loose:1,aggr:1,bluff:1,vpip:[20,25],pfr:[17,21],
    desc:'O estilo mais lucrativo para aprender: poucas mãos, jogadas com agressividade. Prefere aumentar a pagar.'},
  lag:{name:'LAG (Loose-Agressivo)',loose:1.45,aggr:1.35,bluff:1.7,vpip:[28,35],pfr:[23,29],
    desc:'Joga mais mãos e pressiona o tempo todo: 3-bets leves, c-bets e semi-blefes. Exige boa leitura pós-flop.'},
  nit:{name:'Nit (Super tight)',loose:.6,aggr:.9,bluff:.35,vpip:[12,16],pfr:[10,14],
    desc:'Só entra com mãos premium e fortes. Seguro e simples, mas previsível: os bons jogadores param de te pagar.'},
  rock:{name:'Passivo (Tight-Passivo / "Rock")',loose:.8,aggr:.45,bluff:.2,passive:true,vpip:[15,20],pfr:[6,10],
    desc:'Poucas mãos e prefere pagar e controlar o pote a apostar. Erra pouco, mas ganha menos com mãos fortes.'},
  gto:{name:'Equilibrado (estilo GTO)',loose:1.15,aggr:1.15,bluff:1.25,mixed:true,vpip:[23,28],pfr:[19,24],
    desc:'Mistura valor e blefe na proporção certa para ficar imprevisível. É como os profissionais estudam com solvers.'},
};

/* ---------- leitura de ranges (vale para bots e para o herói) ---------- */
function setRange(p,r,why){p.range=Math.min(p.range==null?1:p.range,Math.max(.01,Math.min(1,r)));p.rangeWhy=why;}
function noteRange(p,i,d){
  if(S.street!==0) return;
  const pos=posName(i), effBB=(p.stack+p.bet)/BB, loose=(p.cfg&&p.cfg.loose)||1;
  if(d.type==='raise'){
    const n=S.raises+1, allin=d.to>=p.bet+p.stack;
    if(allin&&effBB<=15) setRange(p,(PUSH_PCT[pos]||.3)*10/Math.max(effBB,2)*loose,`all-in com ${effBB.toFixed(0)} BB`);
    else if(n===1) setRange(p,openPct(pos)*loose,`abriu do ${pos}`);
    else if(n===2) setRange(p,.075*loose,'fez 3-bet');
    else setRange(p,.035,'fez 4-bet+');
  } else if(d.type==='call'){
    if(S.raises===0) setRange(p,i===S.bbI?1:.5*loose,'limp');
    else if(S.raises===1){const a=S.players[S.lastAggr];setRange(p,Math.min(.4,((a&&a.range)||.25)*1.4)*loose,'pagou o aumento');}
    else setRange(p,.06,'pagou 3-bet');
  } else if(d.type==='check') setRange(p,.85,'check no BB');
}
function oppRanges(p){return liveP().filter(o=>o!==p).map(o=>o.range==null?1:o.range);}
function effStack(p){const others=liveP().filter(o=>o!==p).map(o=>o.stack+o.bet);
  return Math.min(p.stack+p.bet,others.length?Math.max(...others):0);}
function isBluff3bet(h){const a=Math.max(rk(h[0]),rk(h[1])),b=Math.min(rk(h[0]),rk(h[1])),s=su(h[0])===su(h[1]);
  return s&&((a===14&&b<=5)||(a>=12&&b>=10));}
/* Pressão da bolha (ICM): >0 = pague menos all-ins; <0 = stack grande pode pressionar */
function bubblePressure(p){
  if(typeof T==='undefined'||!T.active) return 0;
  const R=T.remaining(), gap=R-T.paid; if(gap<=0||gap>Math.max(2,Math.ceil(T.paid*.4))) return 0;
  const rel=p.stack/T.avgStack(); return rel>1.6?-.05:rel<.45?.03:.1;
}

/* ---------- decisão do bot profissional ---------- */
function proDecide(p){
  const i=S.players.indexOf(p), pos=posName(i), toCall=S.currentBet-p.bet, pot=potTotal(), c=(p.cfg&&p.cfg.pro?PROFILES[p.cfg.pro]:p.cfg)||PROFILES.reg, r=Math.random;
  const maxTo=p.bet+p.stack, allin={type:'raise',to:maxTo}, raiseTo=t=>({type:'raise',to:t});
  const call={type:'call'}, fold={type:toCall>0?'fold':'check'};
  const effBB=effStack(p)/BB, hp=handPct(p.hole), bub=bubblePressure(p);
  const ip=inPosition(i), heads=liveP().length===2;

  if(S.street===0){
    const pushPos=heads&&pos==='BTN'?.6:(PUSH_PCT[pos]||.3);
    /* ---- stack curto: push/fold ---- */
    if(effBB<=12){
      if(S.raises===0){
        const pushP=Math.min(.85,pushPos*10/Math.max(effBB,2)*c.loose*(1-bub));
        if(hp<=pushP) return allin;
        if(toCall===0) return {type:'check'};
        if(c.limp&&hp<=.5&&r()<.4) return call;
        return fold;
      }
      const a=S.players[S.lastAggr], vr=(a&&a.range)||.3;
      const eq=equityVsRanges(p.hole,[],[vr],260), cost=Math.min(toCall,p.stack);
      const need=cost/(pot+cost)+bub-(c.call-1)*.05;
      if(eq>=need+.02) return toCall<p.stack&&effBB<=12?allin:call;
      return fold;
    }
    /* ---- ninguém aumentou ---- */
    if(S.raises===0){
      const lp=limpers();
      if(pos==='BB'&&toCall===0){ if(hp<=.1*c.aggr||(lp&&hp<=.14*c.aggr)) return raiseTo(BB*(3.5+lp)); return {type:'check'}; }
      let openP=openPct(pos)*c.loose*(heads?1.7:1); if(lp) openP*=.75;
      if(hp<=openP) return raiseTo(BB*(effBB>40?2.5:2.2)+lp*BB);
      if(c.limp&&hp<=Math.min(.7,openP*1.8)) return call;
      if(pos==='SB'&&hp<=.55&&c.limp) return call;
      return fold;
    }
    const a=S.players[S.lastAggr], vr=(a&&a.range)||.25, cost=Math.min(toCall,p.stack);
    /* ---- enfrentando 1 aumento ---- */
    if(S.raises===1){
      const valueP=Math.min(vr*.33,.09)*c.aggr;
      if(hp<=valueP) return effBB<=25?allin:raiseTo(S.currentBet*(ip?3:3.6));
      if(isBluff3bet(p.hole)&&vr>.2&&r()<.3*c.aggr&&effBB>25) return raiseTo(S.currentBet*(ip?3:3.6));
      const callP=Math.min(vr*(pos==='BB'?1.5:ip?1:.65),.5)*c.call;
      if(hp<=callP&&(cost<=p.stack*.2||hp<=.04)) return call;
      if(effBB<=25&&hp<=Math.min(vr*.6,.14)*c.aggr) return allin;          // re-shove
      return fold;
    }
    /* ---- 3-bet ou mais ---- */
    if(S.raises===2){
      if(hp<=.025*c.aggr) return effBB<=40?allin:raiseTo(S.currentBet*2.3);
      if(hp<=.065*c.call&&cost<=p.stack*.35) return call;
      const eq=equityVsRanges(p.hole,[],[vr],200); if(cost>=p.stack*.6&&eq>=cost/(pot+cost)+bub) return call;
      return fold;
    }
    if(hp<=.02) return allin;
    if(hp<=.035&&cost<=p.stack*.4) return call;
    return fold;
  }

  /* ---------- pós-flop ---------- */
  const opps=liveP().filter(o=>o!==p), eq=equityVsRanges(p.hole,S.board,oppRanges(p),240);
  const spr=p.stack/Math.max(pot,1), aggr=S.pfAggr===i, wet=texture(S.board).some(t=>/possível|Two-tone|conectada/i.test(t));
  const outs=(calcOuts(p.hole,S.board)||{total:0}).total, draw=outs>=8&&S.street<3;
  if(toCall===0){
    if(eq>.72&&spr<1.3) return allin;
    if(eq>.68){ if(c.trap!==false&&r()<.12&&S.street<3) return {type:'check'}; return raiseTo(pot*(wet?.75:.55)); }
    if(eq>.55&&r()<.55*c.aggr) return raiseTo(pot*(opps.length>1?.6:.5));
    if(aggr&&S.street===1&&opps.length===1&&r()<(wet?.5:.8)*c.cbet) return raiseTo(pot*(wet?.6:.33));
    if(draw&&r()<.5*c.aggr) return raiseTo(pot*.55);
    if(S.street===3&&opps.length===1&&eq<.25&&r()<c.bluff) return raiseTo(pot*.66);
    return {type:'check'};
  }
  const cost=Math.min(toCall,p.stack), need=cost/(pot+cost)+(bub>0?bub*.5:0);
  const eqAdj=eq*(1-.12*Math.min(1,toCall/Math.max(pot-toCall,1)));          // apostas grandes = mãos fortes
  if(eqAdj>.78){ if(spr<2) return allin; return r()<.6*c.aggr?raiseTo(S.currentBet*2.8+pot*.2):call; }
  if(eqAdj>=need-(c.call-1)*.06){ if(draw&&r()<.15*c.aggr&&opps.length===1) return raiseTo(S.currentBet*2.8); return call; }
  if(draw&&eqAdj>=need-.07) return call;
  if(S.street<3&&opps.length===1&&r()<c.bluff*.25) return raiseTo(S.currentBet*2.7);   // blefe-raise raro
  return fold;
}
