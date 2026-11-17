/* Poker Lab — desenho das cartas (SVG). Baralho clássico: papel marfim, preto e vermelho,
   índice nos cantos, naipes grandes e disposição tradicional dos naipes; figuras com moldura e coroa. */
"use strict";
const CARD_SUIT_NAME=['espadas','copas','ouros','paus'];
const CARD_SERIF="Georgia,'Times New Roman',serif";

/* posições dos naipes (viewBox 100x140): colunas L/C/R e linhas; naipes da metade de baixo vão de cabeça para baixo */
const PIPX={L:35,C:50,R:65};
const PIPS={
  2:[['C',34],['C',106]],
  3:[['C',34],['C',70],['C',106]],
  4:[['L',34],['R',34],['L',106],['R',106]],
  5:[['L',34],['R',34],['C',70],['L',106],['R',106]],
  6:[['L',34],['R',34],['L',70],['R',70],['L',106],['R',106]],
  7:[['L',34],['R',34],['C',52],['L',70],['R',70],['L',106],['R',106]],
  8:[['L',34],['R',34],['C',52],['L',70],['R',70],['C',88],['L',106],['R',106]],
  9:[['L',34],['R',34],['L',57],['R',57],['C',70],['L',83],['R',83],['L',106],['R',106]],
  10:[['L',34],['R',34],['C',46],['L',57],['R',57],['L',83],['R',83],['C',94],['L',106],['R',106]],
};
const pipUse=(s,x,y,size,flip)=>`<use href="#su${s}" x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}"${flip?` transform="rotate(180 ${x} ${y})"`:''}/>`;

/* coroas: K = coroa de três pontas, Q = tiara com joia, J = pluma */
const CROWN={
  13:'<path d="M-13 6 L-15 -8 L-6 -1 L0 -11 L6 -1 L15 -8 L13 6 Z"/><rect x="-13" y="8" width="26" height="4" rx="1"/>',
  12:'<path d="M-13 6 Q-14 -6 -8 -8 Q-4 -2 0 -10 Q4 -2 8 -8 Q14 -6 13 6 Z"/><circle cx="0" cy="-12.500" r="2.200"/><rect x="-13" y="8" width="26" height="4" rx="1"/>',
  11:'<path d="M-10 10 Q-14 -6 6 -12 Q-2 -4 2 2 Q8 -2 12 -8 Q12 6 -2 11 Z"/><rect x="-10" y="11" width="20" height="3" rx="1"/>',
};

function cardSVG(c){
  const r=rk(c), s=su(c), lab=RDISP(r), face=r>=11&&r<=13;
  const idx=(rot)=>`<g${rot?' transform="rotate(180 50 70)"':''}>`
    +`<text x="15" y="29" text-anchor="middle" font-family="${CARD_SERIF}" font-weight="700" font-size="${lab==='10'?25:29}" ${lab==='10'?'textLength="23" lengthAdjust="spacingAndGlyphs"':''}>${lab}</text>`
    +pipUse(s,15,43,13)+`</g>`;
  let body;
  if(face){
    body=`<rect x="25" y="27" width="50" height="86" rx="4" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".55" stroke-width="1.200"/>`
      +`<rect x="29" y="31" width="42" height="78" rx="2" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width=".8"/>`
      +`<g transform="translate(50 45)">${CROWN[r]}</g>`
      +`<text x="50" y="85" text-anchor="middle" font-family="${CARD_SERIF}" font-weight="700" font-size="46">${lab}</text>`
      +pipUse(s,50,100,14,false);
  } else if(r===14){
    body=pipUse(s,50,72,62);
  } else {
    body=PIPS[r].map(([col,y])=>pipUse(s,PIPX[col],y,r<=3?24:21,y>70)).join('');
  }
  /* versão "mini" (cartas pequenas): só valor e naipe, bem grandes */
  const mini=`<g class="mini"><text x="50" y="64" text-anchor="middle" font-family="${CARD_SERIF}" font-weight="700" font-size="${lab==='10'?58:68}" ${lab==='10'?'textLength="64" lengthAdjust="spacingAndGlyphs"':''}>${lab}</text>${pipUse(s,50,104,40)}</g>`;
  return `<svg viewBox="0 0 100 140" aria-hidden="true" focusable="false">`
    +`<rect class="paper" x=".5" y=".5" width="99" height="139" rx="7"/>`
    +`<g class="full">${idx(false)}${idx(true)}${body}</g>${mini}</svg>`;
}
const CARD_CACHE={};
function cardHTML(c,hidden,sm){
  const z=sm?' sm':'';
  if(hidden) return `<div class="card back${z}"><svg viewBox="0 0 100 140" aria-hidden="true" focusable="false"><use href="#cb"/></svg></div>`;
  return CARD_CACHE[c]?`<div class="card s${su(c)}${z}" role="img" aria-label="${RDISP(rk(c))} de ${CARD_SUIT_NAME[su(c)]}">${CARD_CACHE[c]}</div>`
    :(CARD_CACHE[c]=cardSVG(c),cardHTML(c,hidden,sm));
}
