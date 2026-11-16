// Testes do motor (node --test). Cartas: id = (rank-2)*4 + naipe  (naipe: 0♠ 1♥ 2♦ 3♣)
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');

const R = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,T:10,J:11,Q:12,K:13,A:14 };
const S = { s:0, h:1, d:2, c:3 };
const c = (txt) => txt.split(' ').map(t => (R[t[0]] - 2) * 4 + S[t[1]]);
const ev = (txt) => E.evaluate(c(txt));

test('reconhece todas as categorias de mão', () => {
  assert.equal(ev('Ah Kh Qh Jh Th 2c 3d').cat, 8); // royal / straight flush
  assert.equal(ev('9s 9h 9d 9c Ks 2c 3d').cat, 7); // quadra
  assert.equal(ev('9s 9h 9d Kc Ks 2c 3d').cat, 6); // full house
  assert.equal(ev('2h 7h 9h Jh Kh As 3d').cat, 5); // flush
  assert.equal(ev('5s 6h 7d 8c 9s As 2d').cat, 4); // sequência
  assert.equal(ev('7s 7h 7d Kc 2s 4c 9d').cat, 3); // trinca
  assert.equal(ev('7s 7h Kd Kc 2s 4c 9d').cat, 2); // dois pares
  assert.equal(ev('7s 7h Kd Qc 2s 4c 9d').cat, 1); // um par
  assert.equal(ev('7s 3h Kd Qc 2s 4c 9d').cat, 0); // carta alta
});

test('wheel (A-2-3-4-5) é sequência até o 5', () => {
  const e = ev('As 2h 3d 4c 5s Kd Qh');
  assert.equal(e.cat, 4);
  assert.equal(e.ks[0], 5);
});

test('kicker desempata', () => {
  assert.ok(ev('As Kd 7h 7c 2s 3d 9h').v > ev('As Qd 7h 7c 2s 3d 9h').v);
});

test('duas trincas viram full house com a maior trinca', () => {
  const e = ev('9s 9h 9d 5c 5s 5h 2d');
  assert.equal(e.cat, 6);
  assert.deepEqual(e.ks.slice(0, 2), [9, 5]);
});

test('flush escolhe as 5 maiores do naipe', () => {
  const e = ev('2h 4h 7h 9h Jh Kh 3c');
  assert.equal(e.cat, 5);
  assert.deepEqual(e.ks, [13, 11, 9, 7, 4]);
});

test('Chen: AA=20, KK=16, 72o=-1 → abaixo de 0', () => {
  assert.equal(E.chen(c('As Ah')), 20);
  assert.equal(E.chen(c('Ks Kh')), 16);
  assert.ok(E.chen(c('7s 2h')) <= 0);
  assert.equal(E.chen(c('2s 2h')), 5);
});

test('notação de mão', () => {
  assert.equal(E.notation(c('Ks Ah')), 'AKo');
  assert.equal(E.notation(c('Ts 9s')), 'T9s');
  assert.equal(E.notation(c('Qd Qc')), 'QQ');
});

test('equidade: AA vs 1 mão aleatória fica perto de 85%', () => {
  const eq = E.equity(c('As Ah'), [], 1, 4000);
  assert.ok(eq > 0.81 && eq < 0.89, `equidade ${eq}`);
});

test('outs: flush draw no flop tem 9 outs para flush', () => {
  const o = E.calcOuts(c('Ah Kh'), c('2h 7h 9c'));
  assert.equal(o.groups[5].length, 9);
});

test('ranking das 169 mãos: 1326 combinações, AA no topo, 72o no fim', () => {
  assert.equal(E.HANDS169.length, 169);
  assert.equal(E.HANDS169.reduce((a, h) => a + h.combos, 0), 1326);
  assert.equal(E.HANDS169[0].key, 'AA');
  assert.ok(E.handPct(c('As Ah')) < 0.01);
  assert.ok(E.handPct(c('Ks Qs')) < E.handPct(c('Kd Qc')));
  assert.ok(E.handPct(c('7s 2h')) > 0.9);
});

test('rangeCombos: top 1% = AA e KK (12 combos) e respeita cartas mortas', () => {
  assert.equal(E.rangeCombos(0.009, new Set()).length, 12);
  assert.equal(E.rangeCombos(0.009, new Set(c('As'))).length, 9);
});

test('equidade contra range: KK contra só AA fica perto de 18%', () => {
  const eq = E.equityVsRanges(c('Ks Kh'), [], [0.004], 3000);
  assert.ok(eq > 0.13 && eq < 0.24, `equidade ${eq}`);
});

test('nuts: ninguém bate o royal flush', () => {
  const b = E.beatAnalysis(c('Ah Kh'), c('Qh Jh Th 2c 3d'));
  assert.equal(b.beat, 0);
});
