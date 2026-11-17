/* Poker Lab — lobby (tela de entrada): nome, cash ou torneio, mesa, blinds e modo de aprendizado. */
"use strict";
(function(){
  const KEY='pokerlab-lobby', lb=$('#lobby');
  const L=Object.assign({name:'',game:'cash',seats:6,stake:0,esc:15,field:36,speed:10,clock:30,mode:'learn',style:S.coachStyle||'tag'},(()=>{try{return JSON.parse(localStorage.getItem(KEY))||{};}catch(e){return {};}})());
  if(!COACH_STYLES[L.style]) L.style='tag';
  let started=false;

  const HINT={cash:'Mesa contínua, sem fim: jogue quantas mãos quiser. Quem quebra faz recompra.',
              mtt:'Do primeiro nível até a mesa final, com ante, bolha e premiação (fictícia).',
              treino:'Só jogar contra as IAs, sem ajuda na tela.',
              learn:'O coach explica cada decisão: posição, odds, outs e a jogada ideal.'};
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(L));}catch(e){}};

  function paint(){
    const mark=(id,key)=>document.querySelectorAll(`#${id} button`).forEach(b=>{const on=String(L[key])===b.dataset.v; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on);});
    mark('lbGame','game'); mark('lbSeats','seats'); mark('lbMode','mode');
    $('#lbCash').hidden=L.game!=='cash'; $('#lbMtt').hidden=L.game!=='mtt'; $('#lbStyleWrap').hidden=L.mode!=='learn';
    $('#lbGameHint').textContent=HINT[L.game]; $('#lbModeHint').textContent=HINT[L.mode];
    $('#lbStake').innerHTML=CASH_LEVELS.slice(0,9).map((l,k)=>`<option value="${k}">${fmt(l[0])}/${fmt(l[1])} · stack ${fmt(l[1]*100)}</option>`).join('');
    $('#lbStake').value=String(Math.min(L.stake,8)); $('#lbEsc').value=String(L.esc);
    const f=FIELDS[L.seats]; if(!f.some(x=>x[0]===L.field)) L.field=f[2][0];
    $('#lbField').innerHTML=f.map(([v,t])=>`<option value="${v}">${t}</option>`).join(''); $('#lbField').value=String(L.field);
    $('#lbSpeed').value=String(L.speed); $('#lbClock').value=String(L.clock); $('#lbStyle').value=L.style;
    const best=ST.tourneys&&ST.tourneys.length?Math.min(...ST.tourneys.map(t=>t.place)):0;
    $('#lbStats').textContent=ST.hands?`Você já jogou ${ST.hands} mãos${ST.tourneys&&ST.tourneys.length?` e ${ST.tourneys.length} torneio(s) (melhor: ${best}º)`:''}.`:'Primeira vez aqui? Escolha acima e toque em Jogar.';
  }
  function open(){
    paint(); $('#lbName').value=L.name; $('#lbBack').style.display=started?'':'none';
    $('#lbPlay').textContent=started?'Começar novo jogo ▶':'Jogar ▶';
    if(!lb.open) lb.showModal(); $('#lbPlay').focus({preventScroll:true}); lb.scrollTop=0;
  }

  /* escolhas */
  [['lbGame','game'],['lbSeats','seats'],['lbMode','mode']].forEach(([id,key])=>{
    $('#'+id).addEventListener('click',e=>{const v=e.target.closest('button')?.dataset.v; if(!v) return; L[key]=key==='seats'?+v:v; paint();});});
  $('#lbName').addEventListener('input',e=>{L.name=e.target.value;});
  $('#lbStake').onchange=e=>{L.stake=+e.target.value;};
  $('#lbEsc').onchange=e=>{L.esc=+e.target.value;};
  $('#lbField').onchange=e=>{L.field=+e.target.value;};
  $('#lbSpeed').onchange=e=>{L.speed=+e.target.value;};
  $('#lbClock').onchange=e=>{L.clock=+e.target.value;};
  $('#lbStyle').onchange=e=>{L.style=e.target.value;};

  function begin(){
    L.name=$('#lbName').value.trim().slice(0,14); save();
    hero.name=L.name||'Você';
    S.mode=L.mode; document.querySelectorAll('#modeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.m===L.mode)); document.body.classList.toggle('treino',L.mode==='treino');
    S.coachStyle=L.style; $('#coachStyle').value=L.style; try{localStorage.setItem('pokerlab-style',L.style);}catch(e){} renderStyleInfo();
    S.handNo++; S.handOver=true; clearTimeout(S.autoT); started=true; S.sitOut=false; $('#sitOut').checked=false;
    if(L.game==='cash'){
      if(S.game==='mtt'){T.active=false; S.game='cash';}
      CASH.esc=L.esc>0; if(L.esc>0) CASH.hpl=L.esc; CASH.inLv=0; setCashLevel(L.stake);
      buildCashTable(L.seats); try{localStorage.setItem('pokerlab-seats',N);localStorage.setItem('pokerlab-cashesc',L.esc);}catch(e){}
      $('#tableSize').value=String(N); $('#tSeats').value=String(N); fillFields();
      $('#log').innerHTML=''; syncGameUI(); startHand();
    } else {
      $('#tSeats').value=String(L.seats); fillFields(); $('#tClock').value=String(L.clock); startTournament(L.field,L.speed,L.seats);
    }
  }
  $('#lbForm').addEventListener('submit',e=>{
    e.preventDefault();
    if(started&&S.game==='mtt'&&T.active&&!T.heroOut&&!T.finished&&!confirm('Começar um novo jogo? O torneio atual será encerrado.')) return;
    lb.close(); begin();
  });
  $('#lbBack').onclick=()=>lb.close();
  lb.addEventListener('cancel',e=>{if(!started) e.preventDefault();});   // na primeira vez, é preciso escolher
  $('#bLobby').onclick=open;

  /* mesa de fundo (vazia) enquanto o lobby está aberto */
  S.players.forEach(p=>Object.assign(p,{hole:[],bet:0,total:0,ante:0,folded:false,allIn:false,acted:false,lastAction:'',startStack:p.stack}));
  render(); open();
  window.__LB=L;
})();
