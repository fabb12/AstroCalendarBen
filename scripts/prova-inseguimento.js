#!/usr/bin/env node
'use strict';
/* L'inseguimento a rilevazioni degli aerei — `inseguimento.js`.
 *
 *     node scripts/prova-inseguimento.js
 *
 * Mezzo secondo, senza browser e senza dipendenze.
 *
 * ────────────────────────────────────────────────────────────────────────
 * PERCHÉ QUESTO BANCO ESISTE
 *
 * La domanda che questo pezzo di codice fa fare è una sola, ed è quella che
 * guardando lo schermo non si può fare: **un'etichetta che insegue e una che
 * deriva sono la stessa immagine**. Un riquadro appoggiato sopra a un aereo,
 * che si sposta con lui, è convincente comunque — anche se in realtà si sta
 * agganciando alla nuvola dietro, anche se la sua posizione è quella di tre
 * fotogrammi fa, anche se il filtro lo sta portando via di un decimo di
 * grado al secondo. Nessuno, guardando il telefono, dice «questo flusso
 * ottico ha perso il bersaglio al fotogramma quaranta»: dice «carino», e il
 * giorno in cui l'etichetta finisce dieci gradi più in là dà la colpa alla
 * bussola.
 *
 * I difetti di questa famiglia hanno tutti la stessa forma: **non
 * falliscono**. Il flusso ottico su cielo vuoto non solleva niente,
 * restituisce un numero; una piramide confrontata con sé stessa non solleva
 * niente, restituisce zero — cioè una traccia perfettamente immobile sopra
 * un aereo che si muove; un filtro che riceve un incremento al posto di uno
 * scarto assoluto non solleva niente, converge a zero e fa respirare
 * l'etichetta. Tre modi diversi di avere ragione sullo schermo e torto nei
 * numeri.
 *
 * Il giudice è quindi una scena sintetica di cui si conosce la verità: si
 * costruisce una patch, la si sposta di una quantità **nota**, e si pretende
 * che il motore ritrovi quella quantità. Dove una regola è stata cambiata,
 * accanto alla prova c'è il **contro-esempio**, cioè la regola di prima
 * applicata alla stessa scena: una misura che non fallisce su com'era prima
 * non sta provando niente.
 */

const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const radice = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------
// Il minimo indispensabile perché il file si carichi
// ---------------------------------------------------------------------
//
// `inseguimento.js` è insieme lo script della pagina e quello del worker, e
// sceglie guardando `window`. Qui si dà un `window` finto, quindi prende il
// ramo della pagina — che al caricamento non tocca il documento: registra le
// sue funzioni e basta. Il worker non si apre (lo fa `insAvvia`, che qui non
// chiama nessuno), quindi tutto gira su questo filo, con le stesse funzioni.

let orologio = 1000;
const finestra = {};
const contesto = vm.createContext({
  console,
  window: finestra,
  performance: { now: () => orologio },
  Math, Float32Array, Float64Array, Int32Array, Uint8ClampedArray, Map, Set, Object, Array,
  isFinite, Number, String, JSON,
  setTimeout, clearTimeout
});
vm.runInContext(fs.readFileSync(path.join(radice, 'inseguimento.js'), 'utf8'), contesto);
const I = finestra.Inseguimento;
assert.ok(I, 'inseguimento.js non ha registrato le sue funzioni pure');

// ---------------------------------------------------------------------
// Il giudice
// ---------------------------------------------------------------------

let passate = 0, fallite = 0;
const rosse = [];
function prova(nome, fn) {
  try { fn(); passate++; }
  catch (e) { fallite++; rosse.push(nome + '\n      ' + (e && e.message ? e.message : e)); }
}
function sezione(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

// ---------------------------------------------------------------------
// Le scene sintetiche
// ---------------------------------------------------------------------

// Un generatore seminato: un banco che si comporta diversamente a ogni giro
// è un banco che si impara a ignorare.
function dado(seme) {
  let s = seme >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Una patch di cielo con dentro una sagoma gaussiana. `ampiezza` negativa =
// sagoma scura contro il cielo chiaro, che è il caso diurno.
function patch(L, H, opz) {
  const o = opz || {};
  const fondo = o.fondo !== undefined ? o.fondo : 120;
  const rumore = o.rumore !== undefined ? o.rumore : 0;
  const r = dado(o.seme || 7);
  const a = new Float32Array(L * H);
  for (let i = 0; i < L * H; i++) {
    // Due uniformi sommate fanno una triangolare: basta e avanza per
    // simulare la grana di un sensore, e lo scarto tipico è noto.
    a[i] = fondo + (r() + r() - 1) * rumore * 1.73;
  }
  const macchie = o.macchie || (o.cx !== undefined
    ? [{ cx: o.cx, cy: o.cy, sigma: o.sigma || 2, ampiezza: o.ampiezza !== undefined ? o.ampiezza : 90 }]
    : []);
  for (const m of macchie) {
    const raggio = Math.ceil(m.sigma * 3.5);
    for (let y = Math.max(0, Math.floor(m.cy - raggio)); y <= Math.min(H - 1, Math.ceil(m.cy + raggio)); y++) {
      for (let x = Math.max(0, Math.floor(m.cx - raggio)); x <= Math.min(L - 1, Math.ceil(m.cx + raggio)); x++) {
        const d2 = (x + 0.5 - m.cx) ** 2 + (y + 0.5 - m.cy) ** 2;
        a[y * L + x] += m.ampiezza * Math.exp(-d2 / (2 * m.sigma * m.sigma));
      }
    }
  }
  return a;
}

let contatoreChiavi = 0;
function piramide(a, L, H) {
  return I.insPiramide(a, L, H, I.INS_LK_LIVELLI, 'prova' + (contatoreChiavi++));
}

// ---------------------------------------------------------------------
sezione('§1. Il flusso ottico ritrova uno spostamento noto');
// ---------------------------------------------------------------------
//
// È la prova che tutto il resto dà per scontata, ed è quella che un occhio
// non può fare: uno spostamento di due pixel e sette decimi disegnato sullo
// schermo è identico a uno di tre.

const L = 96, H = 96;

prova('uno spostamento intero si ritrova al centesimo di pixel', () => {
  const A = patch(L, H, { cx: 48, cy: 48, sigma: 2.2, ampiezza: 110, rumore: 0.8, seme: 11 });
  const B = patch(L, H, { cx: 52, cy: 45, sigma: 2.2, ampiezza: 110, rumore: 0.8, seme: 11 });
  const f = I.insLucasKanadePunto(piramide(A, L, H), piramide(B, L, H), 48, 48, {});
  assert.ok(f, 'il flusso ottico non ha trovato niente su una macchia forte');
  assert.ok(Math.abs(f.dx - 4) < 0.25, 'dx = ' + f.dx.toFixed(3) + ', atteso 4');
  assert.ok(Math.abs(f.dy + 3) < 0.25, 'dy = ' + f.dy.toFixed(3) + ', atteso −3');
});

prova('e uno sotto il pixel pure: è quello che serve, e un intero non basterebbe', () => {
  // Mezzo pixel, a trenta pixel per grado, è un sessantesimo di grado. Se il
  // metodo arrotondasse all'intero l'etichetta salterebbe di quello a ogni
  // fotogramma: è il difetto per cui la §2 del modulo campiona bilineare.
  const A = patch(L, H, { cx: 48, cy: 48, sigma: 2.2, ampiezza: 110, rumore: 0.5, seme: 3 });
  const B = patch(L, H, { cx: 48.6, cy: 48.35, sigma: 2.2, ampiezza: 110, rumore: 0.5, seme: 3 });
  const f = I.insLucasKanadePunto(piramide(A, L, H), piramide(B, L, H), 48, 48, {});
  assert.ok(f, 'niente');
  assert.ok(Math.abs(f.dx - 0.6) < 0.2, 'dx = ' + f.dx.toFixed(3) + ', atteso 0,6');
  assert.ok(Math.abs(f.dy - 0.35) < 0.2, 'dy = ' + f.dy.toFixed(3) + ', atteso 0,35');
});

prova('il campionamento bilineare è la riga da cui dipende il sub-pixel', () => {
  // Il contro-esempio della riga qui sopra, fatto sulla funzione: fra due
  // nodi il campionamento deve dire una cosa diversa da tutti e due, se no
  // il residuo è costante a tratti, il suo gradiente è zero e il passo
  // calcolato è zero — cioè il metodo non converge affatto.
  const a = new Float32Array([0, 10, 0, 20, 0, 0, 0, 0, 0]);
  const v = I.insCampiona(a, 3, 3, 0.5, 0);
  assert.ok(Math.abs(v - 5) < 1e-6, 'a metà fra 0 e 10 deve dare 5, ha dato ' + v);
  const w = I.insCampiona(a, 3, 3, 0.25, 0);
  assert.ok(Math.abs(w - 2.5) < 1e-6, 'a un quarto deve dare 2,5, ha dato ' + w);
});

// ---------------------------------------------------------------------
sezione('§2. Quando il flusso ottico deve arrendersi');
// ---------------------------------------------------------------------
//
// La famiglia che conta di più, perché il difetto non lascia traccia: su
// cielo vuoto il metodo **non fallisce**, restituisce un numero, e quel
// numero muove il riquadro.

prova('su cielo vuoto e rumoroso non si insegue niente', () => {
  const A = patch(L, H, { rumore: 3, seme: 21 });
  const B = patch(L, H, { rumore: 3, seme: 22 });
  const soglia = I.INS_LK_AUTOVALORE_SIGMA * 3 * 3;
  const f = I.insLucasKanadePunto(piramide(A, L, H), piramide(B, L, H), 48, 48,
    { autovaloreMin: soglia });
  assert.equal(f, null, 'ha inseguito la grana del sensore');
});

prova('CONTRO-ESEMPIO: con la soglia fissa di prima, il cielo vuoto passava', () => {
  // È il conto del §1 del modulo: con la differenza centrata la varianza del
  // gradiente su rumore vale mezzo sigma quadro, cioè 4,5 con σ = 3 — otto
  // volte la soglia fissa di 0,55. Il metodo si metteva a inseguire la
  // grana, e il sintomo era un riquadro che se ne andava piano per conto suo.
  const A = patch(L, H, { rumore: 3, seme: 21 });
  const B = patch(L, H, { rumore: 3, seme: 22 });
  const f = I.insLucasKanadePunto(piramide(A, L, H), piramide(B, L, H), 48, 48,
    { autovaloreMin: I.INS_LK_AUTOVALORE_MIN });
  assert.ok(f !== null, 'il contro-esempio non riproduce il difetto: la prova sopra non prova niente');
  assert.ok(Math.hypot(f.dx, f.dy) > 0.2,
    'la deriva misurata è ' + Math.hypot(f.dx, f.dy).toFixed(2) + ' px, troppo piccola per essere il difetto');
});

prova('la soglia in sigma lascia passare una sagoma vera dentro allo stesso rumore', () => {
  // L'altra metà: una soglia che rifiuta tutto è comoda e inutile.
  const A = patch(L, H, { cx: 48, cy: 48, sigma: 2.2, ampiezza: 90, rumore: 3, seme: 31 });
  const B = patch(L, H, { cx: 50, cy: 49, sigma: 2.2, ampiezza: 90, rumore: 3, seme: 31 });
  const f = I.insLucasKanadePunto(piramide(A, L, H), piramide(B, L, H), 48, 48,
    { autovaloreMin: I.INS_LK_AUTOVALORE_SIGMA * 9 });
  assert.ok(f, 'ha rifiutato una sagoma vera');
  assert.ok(Math.abs(f.dx - 2) < 0.4 && Math.abs(f.dy - 1) < 0.4,
    'dx,dy = ' + f.dx.toFixed(2) + ',' + f.dy.toFixed(2));
});

prova('il controllo avanti-indietro prende il bersaglio perduto', () => {
  // La scena: la sagoma c'era, e al fotogramma dopo non c'è più (è passata
  // dietro a una nuvola). Quello che resta nella finestra è un'altra cosa —
  // qui un gradiente di nuvola — e il flusso ottico ci si aggancia. Senza
  // il controllo, il riquadro parte dietro a lei.
  const A = patch(L, H, { cx: 48, cy: 48, sigma: 2.2, ampiezza: 110, rumore: 1, seme: 41 });
  const B = patch(L, H, { rumore: 1, seme: 41 });
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) B[y * L + x] += x * 0.9;
  const r = I.insFlussoRiquadro(piramide(A, L, H), piramide(B, L, H),
    { x: 48, y: 48, w: 8, h: 8 }, {});
  assert.equal(r, null, 'ha inseguito qualcosa che non era la sagoma');
});

prova('…e non lo prende quando il bersaglio c\'è ancora', () => {
  const A = patch(L, H, { cx: 48, cy: 48, sigma: 2.2, ampiezza: 110, rumore: 1, seme: 51 });
  const B = patch(L, H, { cx: 50.4, cy: 46.2, sigma: 2.2, ampiezza: 110, rumore: 1, seme: 51 });
  const r = I.insFlussoRiquadro(piramide(A, L, H), piramide(B, L, H),
    { x: 48, y: 48, w: 8, h: 8 }, {});
  assert.ok(r, 'ha buttato via una corsa buona');
  assert.ok(Math.abs(r.dx - 2.4) < 0.35 && Math.abs(r.dy + 1.8) < 0.35,
    'dx,dy = ' + r.dx.toFixed(2) + ',' + r.dy.toFixed(2) + ', attesi 2,4 e −1,8');
  assert.ok(r.punti >= I.INS_LK_PUNTI_MIN, 'solo ' + r.punti + ' punti sopravvissuti');
});

// ---------------------------------------------------------------------
sezione('§3. Il seme: perché senza giroscopio non si insegue niente');
// ---------------------------------------------------------------------
//
// È il conto del §6 del modulo, e vale la pena provarlo invece che sperarlo:
// a trenta gradi al secondo, su un fotogramma da sessanta al secondo, il
// mondo scivola di venticinque pixel — fuori portata anche con la piramide.

prova('venticinque pixel di mano: senza seme non si trova, col seme sì', () => {
  const G = 128;
  const A = patch(G, G, { cx: 64, cy: 64, sigma: 2.2, ampiezza: 110, rumore: 1, seme: 61 });
  const B = patch(G, G, { cx: 64 + 25, cy: 64 + 8, sigma: 2.2, ampiezza: 110, rumore: 1, seme: 61 });
  const pa = piramide(A, G, G), pb = piramide(B, G, G);

  const cieco = I.insLucasKanadePunto(pa, pb, 64, 64, {});
  const sbagliatoDi = cieco ? Math.hypot(cieco.dx - 25, cieco.dy - 8) : Infinity;
  assert.ok(sbagliatoDi > 5,
    'senza seme ha trovato lo spostamento (sbagliato di ' + sbagliatoDi.toFixed(1) +
    ' px): il contro-esempio non morde, e allora la prova sotto non prova niente');

  const conSeme = I.insLucasKanadePunto(pa, pb, 64, 64, { semeX: 24, semeY: 7 });
  assert.ok(conSeme, 'col seme non ha trovato niente');
  assert.ok(Math.abs(conSeme.dx - 25) < 0.5 && Math.abs(conSeme.dy - 8) < 0.5,
    'col seme: ' + conSeme.dx.toFixed(2) + ',' + conSeme.dy.toFixed(2) + ', attesi 25 e 8');
});

// ---------------------------------------------------------------------
sezione('§4. Il rivelatore: la sagoma dentro alla patch');
// ---------------------------------------------------------------------

prova('una lucina notturna: il centro esce sotto il mezzo pixel', () => {
  const a = patch(L, H, { fondo: 20, cx: 40.3, cy: 61.8, sigma: 1.8, ampiezza: 120, rumore: 2, seme: 71 });
  const m = I.insRilevaSagoma(a, L, H, { attesaX: 48, attesaY: 48, gate: 40, polarita: 1 });
  assert.ok(m, 'non ha trovato la lucina');
  assert.ok(Math.abs(m.x - 40.3) < 0.5 && Math.abs(m.y - 61.8) < 0.5,
    'centro = ' + m.x.toFixed(2) + ',' + m.y.toFixed(2) + ', atteso 40,3 e 61,8');
  assert.equal(m.segno, 1, 'una lucina deve avere segno positivo');
});

prova('una sagoma diurna: scura contro il cielo chiaro, e si trova uguale', () => {
  // È il caso della segnalazione, ed è quello che un rivelatore che cerca
  // solo il chiaro non trova mai — senza dirlo, perché il sintomo è identico
  // a «qui non c'è niente».
  const a = patch(L, H, { fondo: 190, cx: 55.4, cy: 39.1, sigma: 1.6, ampiezza: -85, rumore: 2, seme: 81 });
  const m = I.insRilevaSagoma(a, L, H, { attesaX: 48, attesaY: 48, gate: 40, polarita: -1 });
  assert.ok(m, 'non ha trovato la sagoma scura');
  assert.ok(Math.abs(m.x - 55.4) < 0.5 && Math.abs(m.y - 39.1) < 0.5,
    'centro = ' + m.x.toFixed(2) + ',' + m.y.toFixed(2));
  assert.equal(m.segno, -1, 'una sagoma controluce deve avere segno negativo');
});

prova('la polarità dichiarata scarta il verso sbagliato', () => {
  const a = patch(L, H, { fondo: 190, cx: 55, cy: 39, sigma: 1.6, ampiezza: -85, rumore: 2, seme: 81 });
  const m = I.insRilevaSagoma(a, L, H, { attesaX: 48, attesaY: 48, gate: 40, polarita: 1 });
  assert.equal(m, null, 'cercando il chiaro ha trovato una sagoma scura');
});

prova('una nuvola non è un aereo: troppo grande', () => {
  const a = patch(L, H, { fondo: 60, cx: 48, cy: 48, sigma: 14, ampiezza: 70, rumore: 1.5, seme: 91 });
  const m = I.insRilevaSagoma(a, L, H, { attesaX: 48, attesaY: 48, gate: 40, polarita: 1 });
  assert.equal(m, null, 'si è agganciato a una macchia da ' + (m && m.area) + ' pixel');
});

prova('un filo di luce non è un aereo: troppo allungato', () => {
  const a = patch(L, H, { fondo: 60, rumore: 1.2, seme: 101 });
  for (let x = 20; x < 76; x++) { a[48 * L + x] += 100; a[49 * L + x] += 80; }
  const m = I.insRilevaSagoma(a, L, H, { attesaX: 48, attesaY: 48, gate: 40, polarita: 1 });
  assert.equal(m, null, 'si è agganciato a una riga');
});

prova('fra due sagome vince quella prevista, ma non a qualunque costo', () => {
  // Due metà della stessa regola. La prima: a parità di forza vince la
  // vicina, se no basta un altro aereo in quadro per portare via la traccia.
  const vicino = patch(L, H, {
    fondo: 30, rumore: 1.5, seme: 111,
    macchie: [{ cx: 50, cy: 47, sigma: 1.8, ampiezza: 90 },
              { cx: 20, cy: 20, sigma: 1.8, ampiezza: 95 }]
  });
  const m1 = I.insRilevaSagoma(vicino, L, H, { attesaX: 48, attesaY: 48, gate: 42, polarita: 1 });
  assert.ok(m1 && Math.hypot(m1.x - 50, m1.y - 47) < 2,
    'ha scelto la lontana pur essendo quasi uguale');

  // La seconda: una molto più forte vince anche se sta più in là, se no una
  // previsione sbagliata di dieci gradi inchioderebbe la traccia su una
  // macchia qualunque.
  const forte = patch(L, H, {
    fondo: 30, rumore: 1.5, seme: 112,
    macchie: [{ cx: 50, cy: 47, sigma: 1.8, ampiezza: 25 },
              { cx: 20, cy: 20, sigma: 1.8, ampiezza: 160 }]
  });
  const m2 = I.insRilevaSagoma(forte, L, H, { attesaX: 48, attesaY: 48, gate: 42, polarita: 1 });
  assert.ok(m2 && Math.hypot(m2.x - 20, m2.y - 20) < 2,
    'non ha scelto quella sei volte più forte');
});

prova('chi tocca il bordo della patch si scarta', () => {
  // Il baricentro di una macchia tagliata è il baricentro della parte che si
  // vede, cioè un numero plausibile e sbagliato — e sbagliato sempre nella
  // stessa direzione, quindi il filtro non lo media via.
  const a = patch(L, H, { fondo: 30, cx: 1, cy: 48, sigma: 2.4, ampiezza: 120, rumore: 1.2, seme: 121 });
  const m = I.insRilevaSagoma(a, L, H, { attesaX: 10, attesaY: 48, gate: 45, polarita: 1 });
  assert.equal(m, null, 'ha centroidato una macchia tagliata dal bordo');
});

prova('fuori dal cancello non si guarda', () => {
  const a = patch(L, H, { fondo: 30, cx: 10, cy: 10, sigma: 1.8, ampiezza: 140, rumore: 1.2, seme: 131 });
  const m = I.insRilevaSagoma(a, L, H, { attesaX: 70, attesaY: 70, gate: 12, polarita: 1 });
  assert.equal(m, null, 'ha preso una macchia a ottantacinque pixel dal cancello');
});

// ---------------------------------------------------------------------
sezione('§5. Lo scarto tipico, e la sorgente forte che lo falsava');
// ---------------------------------------------------------------------

prova('una sorgente sfondata non alza lo scarto tipico del cielo', () => {
  // La lezione è quella del §3 di `visione.js` in un'altra veste: la scala
  // dell'istogramma **non** si prende dal massimo. Con una sagoma forte
  // dentro al campione il fondo scala va a centinaia di livelli, la mediana
  // casca tutta nella prima casella, e quello che esce è mezza casella
  // travestita da misura — cioè una soglia che nasconde tutto il resto.
  const pulito = patch(L, H, { fondo: 40, rumore: 2.5, seme: 141 });
  const conLuna = patch(L, H, { fondo: 40, rumore: 2.5, seme: 141, cx: 48, cy: 48, sigma: 6, ampiezza: 210 });
  const r1 = I.insResiduo(pulito, L, H, I.INS_FONDO_RAGGIO, new Float32Array(L * H));
  const r2 = I.insResiduo(conLuna, L, H, I.INS_FONDO_RAGGIO, new Float32Array(L * H));
  const s1 = I.insScartoTipico(r1, L, H);
  const s2 = I.insScartoTipico(r2, L, H);
  assert.ok(s2 < s1 * 1.6,
    'con la sorgente in quadro lo scarto tipico passa da ' + s1.toFixed(2) + ' a ' + s2.toFixed(2));
});

prova('e una stellina accanto alla sorgente forte si trova lo stesso', () => {
  const a = patch(L, H, {
    fondo: 40, rumore: 2.5, seme: 151,
    macchie: [{ cx: 30, cy: 30, sigma: 6, ampiezza: 210 },
              { cx: 62, cy: 62, sigma: 1.6, ampiezza: 34 }]
  });
  const m = I.insRilevaSagoma(a, L, H, { attesaX: 62, attesaY: 62, gate: 14, polarita: 1 });
  assert.ok(m, 'la sorgente forte ha alzato la soglia e nascosto la debole');
  assert.ok(Math.hypot(m.x - 62, m.y - 62) < 2, 'centro = ' + m.x.toFixed(1) + ',' + m.y.toFixed(1));
});

// ---------------------------------------------------------------------
sezione('§6. Il filtro: inseguire, continuare, rifiutare');
// ---------------------------------------------------------------------

prova('un bersaglio a velocità costante viene inseguito senza ritardo', () => {
  // Tre gradi al secondo è un aereo vicino: è il caso che conta.
  const f = I.insFiltroNuovo(0, 0);
  const dt = 1 / 20;
  let vero = 0;
  for (let i = 0; i < 60; i++) {
    vero += 3 * dt;
    I.insFiltroPrevedi(f, dt);
    I.insFiltroCorreggi(f, vero, 0, I.INS_KALMAN_R_RILEVATO);
  }
  assert.ok(Math.abs(f.x.x - vero) < 0.05,
    'dopo tre secondi il filtro è a ' + f.x.x.toFixed(3) + ' e il vero è ' + vero.toFixed(3));
  assert.ok(Math.abs(f.x.v - 3) < 0.4,
    'la velocità stimata è ' + f.x.v.toFixed(2) + ' invece di 3 gradi al secondo');
});

prova('fra due misure la previsione **continua**: è la riga che toglie il saltino', () => {
  // È la ragione per cui il filtro tiene una velocità. Senza, fra una
  // rilevazione e l'altra l'etichetta resta ferma e poi salta: a tre gradi
  // al secondo, con venti misure al secondo, sono quindici centesimi di
  // grado di scatto a ogni misura.
  const f = I.insFiltroNuovo(0, 0);
  const dt = 1 / 20;
  let vero = 0;
  for (let i = 0; i < 40; i++) {
    vero += 3 * dt;
    I.insFiltroPrevedi(f, dt);
    I.insFiltroCorreggi(f, vero, 0, I.INS_KALMAN_R_RILEVATO);
  }
  const prima = f.x.x;
  I.insFiltroPrevedi(f, 0.1);     // un decimo di secondo senza misure
  assert.ok(f.x.x - prima > 0.2,
    'in un decimo di secondo la previsione si è mossa di ' + (f.x.x - prima).toFixed(3) +
    ' gradi invece dei tre decimi che l\'aereo percorre');
});

prova('un salto vero si assorbe in poche misure', () => {
  // Quando arriva una lettura ADS-B nuova l'errore di propagazione cambia di
  // colpo: il filtro deve inseguirlo, non levigarlo via.
  const f = I.insFiltroNuovo(0, 0);
  const dt = 1 / 20;
  for (let i = 0; i < 30; i++) { I.insFiltroPrevedi(f, dt); I.insFiltroCorreggi(f, 0, 0, I.INS_KALMAN_R_RILEVATO); }
  for (let i = 0; i < 12; i++) { I.insFiltroPrevedi(f, dt); I.insFiltroCorreggi(f, 1.2, 0, I.INS_KALMAN_R_RILEVATO); }
  assert.ok(Math.abs(f.x.x - 1.2) < 0.25,
    'dopo dodici misure il filtro è a ' + f.x.x.toFixed(3) + ' invece che a 1,2');
});

prova('una misura assurda si rifiuta, e lo si **dice**', () => {
  // Il valore di ritorno non è un ornamento: una misura rifiutata è una
  // perdita, e tre perdite sono una traccia da rifare. Ingoiarla in silenzio
  // vorrebbe dire una traccia che si dichiara viva mentre non misura più
  // niente — cioè un'etichetta ferma sopra un aereo che se n'è andato.
  const f = I.insFiltroNuovo(0, 0);
  const preso = I.insFiltroCorreggi(f, I.INS_INNOVAZIONE_MAX + 1, 0, I.INS_KALMAN_R_RILEVATO);
  assert.equal(preso, false, 'ha accettato una misura fuori dal cancello');
  assert.ok(Math.abs(f.x.x) < 1e-9, 'e per giunta l\'ha usata: lo stato è ' + f.x.x);
});

prova('una rilevazione pesa più di una corsa di flusso ottico', () => {
  // Due filtri identici, la stessa misura, due rumori dichiarati diversi:
  // quello che crede alla rilevazione deve muoversi di più. È tutto il
  // motivo per cui il modo viaggia fino a qui.
  const a = I.insFiltroNuovo(0, 0), b = I.insFiltroNuovo(0, 0);
  I.insFiltroPrevedi(a, 0.05); I.insFiltroPrevedi(b, 0.05);
  I.insFiltroCorreggi(a, 1, 0, I.INS_KALMAN_R_RILEVATO);
  I.insFiltroCorreggi(b, 1, 0, I.INS_KALMAN_R_INSEGUITO);
  assert.ok(a.x.x > b.x.x,
    'rilevato ' + a.x.x.toFixed(4) + ' contro inseguito ' + b.x.x.toFixed(4));
});

// ---------------------------------------------------------------------
sezione('§7. Il ritaglio, e il rimappaggio che non si deve sbagliare');
// ---------------------------------------------------------------------

const video = { videoWidth: 1920, videoHeight: 1080 };

prova('la geometria del «cover» è quella del video, non quella dello schermo', () => {
  // Uno schermo di telefono ritto sopra a un fotogramma orizzontale: il
  // video si ingrandisce finché copre, e di lui si vede una colonna stretta.
  const g = I.insGeometriaVideo(video, 400, 800);
  assert.ok(Math.abs(g.sh - 1080) < 1e-6, 'in altezza si deve vedere tutto: sh = ' + g.sh);
  assert.ok(Math.abs(g.sw - 540) < 0.5, 'in larghezza se ne vede 540: sw = ' + g.sw.toFixed(1));
  assert.ok(Math.abs(g.sx - 690) < 0.5, 'il ritaglio è centrato: sx = ' + g.sx.toFixed(1));
  assert.ok(g.perPixel > 1, 'il video è più fitto dello schermo: perPixel = ' + g.perPixel.toFixed(3));
});

prova('dal riquadro alla patch e ritorno: l\'andata e il ritorno si chiudono', () => {
  // È la riga per cui il rimappaggio non si sbaglia: una sola funzione per
  // ogni verso, e qui si controlla che siano l'una l'inversa dell'altra. Un
  // fattore sbagliato qui non fallisce: sposta ogni etichetta della stessa
  // quantità, cioè si legge come un errore di bussola.
  const g = I.insGeometriaVideo(video, 400, 800);
  for (const [px, py] of [[200, 400], [40, 90], [360, 700]]) {
    const r = I.insRettangoloPatch(g, px, py, 192);
    assert.ok(r, 'nessun ritaglio per ' + px + ',' + py);
    const centro = I.insPatchAlRiquadro(g, r, r.lato / 2 - r.spostataX, r.lato / 2 - r.spostataY);
    assert.ok(Math.hypot(centro.px - px, centro.py - py) < 1.0,
      'andata e ritorno: ' + centro.px.toFixed(1) + ',' + centro.py.toFixed(1) +
      ' invece di ' + px + ',' + py);
  }
});

prova('la patch non esce mai dal ritaglio visibile, e dice di quanto si è spostata', () => {
  // Un ritaglio mezzo fuori il browser lo riempie di trasparente, e quei
  // pixel neri entrano nella stima del fondo: la falsano esattamente dove
  // serve che sia giusta. E lo **spostamento** va dichiarato, se no il
  // centro della patch non è il centro che si era chiesto e tutte le
  // distanze dal cancello sono sbagliate di quello scarto.
  const g = I.insGeometriaVideo(video, 400, 800);
  const r = I.insRettangoloPatch(g, 5, 400, 192);
  assert.ok(r, 'ha rifiutato un punto che sta dentro al riquadro');
  assert.ok(r.x >= Math.ceil(g.sx) - 1e-6, 'la patch esce a sinistra: x = ' + r.x + ', bordo = ' + g.sx);
  assert.ok(r.x + r.lato <= Math.floor(g.sx + g.sw) + 1e-6, 'la patch esce a destra');
  assert.ok(r.spostataX > 0, 'si è spostata e non lo dice: spostataX = ' + r.spostataX);
  const centro = I.insPatchAlRiquadro(g, r, r.lato / 2 - r.spostataX, r.lato / 2 - r.spostataY);
  assert.ok(Math.abs(centro.px - 5) < 1.0,
    'col correttivo il centro chiesto torna: ' + centro.px.toFixed(2));
});

prova('su un fotogramma piccolo la patch si tosa invece di prendersi mezza immagine', () => {
  const g = I.insGeometriaVideo({ videoWidth: 320, videoHeight: 240 }, 400, 800);
  const r = I.insRettangoloPatch(g, 200, 400, 192);
  if (r) {
    assert.ok(r.lato <= Math.floor(240 * I.INS_PATCH_QUOTA_MAX) + 1e-6,
      'lato = ' + r.lato + ', tetto = ' + Math.floor(240 * I.INS_PATCH_QUOTA_MAX));
  }
});

// ---------------------------------------------------------------------
sezione('§8. La pipeline intera: rileva, insegui, e la patch che scorre');
// ---------------------------------------------------------------------
//
// È la prova che tiene insieme i pezzi, ed è l'unica che prenda il difetto
// del §6 del modulo: il riquadro tenuto in memoria è nelle coordinate della
// patch di **prima**, e la patch si sposta a ogni fotogramma. Chi si dimentica
// lo scorrimento non ottiene un errore: ottiene una traccia che si perde
// appena l'aereo comincia a muoversi, cioè proprio quando serve.

// La scena: un aereo che vola, una mano che si muove, e una patch che
// insegue la **previsione** — non l'aereo. Sono tre movimenti diversi, e
// tenerli separati è tutto il punto.
//
//   camera   quanto il mondo scivola sotto la camera, per fotogramma
//   aereo    quanto l'aereo si sposta per conto suo
//   errore   di quanto la previsione sbaglia, cioè dove finisce il centro
//            della patch rispetto all'aereo vero
//
// Da lì escono i tre numeri che il modulo si passa: il ritaglio segue la
// previsione, lo scorrimento è la differenza fra due ritagli, e il seme del
// giroscopio è il movimento della sola camera.
function recita(id, fotogrammi, opz) {
  const o = opz || {};
  const G = o.G || 192;
  const camera = o.camera || { x: 0, y: 0 };
  const aereo = o.aereo || { x: 1.5, y: 0.7 };
  const errore = o.errore || (() => ({ x: 0, y: 0 }));
  const seme = o.seme !== false;

  let veroX = 1000, veroY = 700;                 // l'aereo, in pixel del video
  let rettPrec = null;
  const esiti = [];
  I.insScorda(id);

  for (let i = 0; i < fotogrammi; i++) {
    if (i > 0) { veroX += camera.x + aereo.x; veroY += camera.y + aereo.y; }
    const e = errore(i);
    // Il centro della patch è la **previsione**, non l'aereo.
    const rett = { x: Math.round(veroX + e.x - G / 2), y: Math.round(veroY + e.y - G / 2) };
    // Dove l'aereo casca dentro a questa patch:
    const cx = veroX - rett.x, cy = veroY - rett.y;
    const a = patch(G, G, {
      fondo: 35, cx, cy, sigma: 2, ampiezza: 100, rumore: 2, seme: (o.dado || 200) + i
    });
    const scorrimento = rettPrec ? { x: rettPrec.x - rett.x, y: rettPrec.y - rett.y } : { x: 0, y: 0 };
    const esito = I.insLavora({
      tipo: 'patch', id, L: G, H: G, rileva: i === 0,
      semeX: seme ? scorrimento.x + camera.x : 0,
      semeY: seme ? scorrimento.y + camera.y : 0,
      opzioni: { attesaX: G / 2, attesaY: G / 2, gate: G * 0.45, polarita: 1 }
    }, a);
    esiti.push({ i, esito, cx, cy, scarto: esito ? Math.hypot(esito.x - cx, esito.y - cy) : Infinity });
    rettPrec = rett;
  }
  I.insScorda(id);
  return esiti;
}

prova('venti fotogrammi: si rileva una volta, si insegue diciannove, e non si sbaglia mai', () => {
  const r = recita('PROVA1', 20, { camera: { x: 6, y: -3 } });
  const persi = r.filter(e => !e.esito).length;
  const rilevati = r.filter(e => e.esito && e.esito.modo === 'rilevato').length;
  const inseguiti = r.filter(e => e.esito && e.esito.modo === 'inseguito').length;
  const peggio = Math.max(...r.map(e => e.scarto));
  assert.equal(persi, 0, persi + ' fotogrammi persi su venti');
  assert.equal(rilevati, 1, 'ha rilevato ' + rilevati + ' volte invece di una');
  assert.equal(inseguiti, 19, 'ha inseguito ' + inseguiti + ' volte invece di diciannove');
  assert.ok(peggio < 1.5, 'il fotogramma peggiore sbaglia di ' + peggio.toFixed(2) + ' px');
});

prova('la previsione salta — arriva una lettura ADS-B — e il seme la copre', () => {
  // È il caso in cui il seme serve davvero, e vale la pena scrivere perché
  // **non** è quello che verrebbe in mente. Finché la previsione insegue
  // bene l'aereo, la patch resta centrata su di lui e fra due fotogrammi il
  // bersaglio non si sposta quasi: lì il flusso ottico ce la farebbe anche a
  // occhi chiusi, e infatti la prova qui sotto col seme azzerato passa.
  //
  // Quello che non copre è il **salto**. Quando arriva una lettura ADS-B
  // nuova la posizione propagata cambia di colpo — è la ragione per cui il
  // filtro del §4 dichiara un rumore di processo generoso — e con lei salta
  // il centro della patch. Trenta pixel in un fotogramma: il bersaglio si
  // ritrova trenta pixel più in là nelle coordinate della patch, che è fuori
  // dalla portata della piramide. Il seme quel salto lo sa esattamente,
  // perché è la differenza fra i due ritagli.
  const salto = (i) => (i < 10 ? { x: 0, y: 0 } : { x: 30, y: 14 });
  const r = recita('PROVA2', 20, { camera: { x: 6, y: -3 }, errore: salto, dado: 700 });
  const guai = r.filter(e => !e.esito || e.scarto > 1.5).length;
  assert.equal(guai, 0, guai + ' fotogrammi persi o sbagliati attraversando il salto');
});

prova('CONTRO-ESEMPIO: senza il seme, lo stesso salto porta via la traccia', () => {
  // La stessa scena, col seme azzerato. Se questa prova non fallisse, quella
  // sopra non starebbe provando il seme.
  const salto = (i) => (i < 10 ? { x: 0, y: 0 } : { x: 30, y: 14 });
  const r = recita('PROVA3', 20, { camera: { x: 6, y: -3 }, errore: salto, seme: false, dado: 700 });
  const guai = r.filter(e => !e.esito || e.scarto > 1.5).length;
  assert.ok(guai > 0,
    'senza seme la traccia attraversa il salto indenne: il contro-esempio non morde');
});

prova('un cambio di misura della patch fa rilevare da capo invece di confrontare griglie diverse', () => {
  // Due piramidi di misura diversa si confrontano lo stesso e danno numeri,
  // ed è il modo peggiore di sbagliare.
  I.insScorda('PROVA3');
  const a1 = patch(128, 128, { fondo: 35, cx: 64, cy: 64, sigma: 2, ampiezza: 100, rumore: 1.5, seme: 401 });
  const e1 = I.insLavora({ tipo: 'patch', id: 'PROVA3', L: 128, H: 128, rileva: true, semeX: 0, semeY: 0,
    opzioni: { attesaX: 64, attesaY: 64, gate: 50, polarita: 1 } }, a1);
  assert.ok(e1 && e1.modo === 'rilevato');
  const a2 = patch(96, 96, { fondo: 35, cx: 48, cy: 48, sigma: 2, ampiezza: 100, rumore: 1.5, seme: 402 });
  const e2 = I.insLavora({ tipo: 'patch', id: 'PROVA3', L: 96, H: 96, rileva: false, semeX: 0, semeY: 0,
    opzioni: { attesaX: 48, attesaY: 48, gate: 40, polarita: 1 } }, a2);
  assert.ok(e2, 'niente');
  assert.equal(e2.modo, 'rilevato', 'ha inseguito fra due patch di misura diversa');
  I.insScorda('PROVA3');
});

prova('quando l\'aereo esce di scena la sua memoria se ne va con lui', () => {
  // Due piramidi da trentasettemila numeri per traccia sono trecento
  // kilobyte: in una serata sotto una rotta trafficata passano centinaia di
  // aerei, e senza questa riga restano tutti in memoria.
  const G = 96;
  const a = patch(G, G, { fondo: 35, cx: 48, cy: 48, sigma: 2, ampiezza: 100, rumore: 1.5, seme: 501 });
  const m = { tipo: 'patch', id: 'PROVA4', L: G, H: G, rileva: true, semeX: 0, semeY: 0,
    opzioni: { attesaX: 48, attesaY: 48, gate: 40, polarita: 1 } };
  I.insLavora(m, a);
  const e1 = I.insLavora(Object.assign({}, m, { rileva: false }), a);
  assert.ok(e1 && e1.modo === 'inseguito', 'la memoria non c\'era');
  I.insScorda('PROVA4');
  const e2 = I.insLavora(Object.assign({}, m, { rileva: false }), a);
  assert.ok(e2 && e2.modo === 'rilevato', 'la memoria è sopravvissuta allo scordare');
});

prova('la piramide di prima è una COPIA, non un riferimento', () => {
  // È il difetto che non fallisce: le scorte si riusano, quindi tenendo un
  // riferimento si confronterebbe il fotogramma con sé stesso — e il flusso
  // ottico su due immagini identiche non solleva niente, restituisce zero.
  // Cioè una traccia perfettamente immobile sopra un aereo che si muove.
  const G = 96;
  I.insScorda('PROVA5');
  const m = (rileva) => ({ tipo: 'patch', id: 'PROVA5', L: G, H: G, rileva, semeX: 0, semeY: 0,
    opzioni: { attesaX: 48, attesaY: 48, gate: 40, polarita: 1 } });
  const a0 = patch(G, G, { fondo: 35, cx: 48, cy: 48, sigma: 2, ampiezza: 100, rumore: 1.5, seme: 601 });
  I.insLavora(m(true), a0);
  const a1 = patch(G, G, { fondo: 35, cx: 50.5, cy: 49.2, sigma: 2, ampiezza: 100, rumore: 1.5, seme: 601 });
  const e = I.insLavora(m(false), a1);
  assert.ok(e, 'niente');
  assert.ok(Math.hypot(e.x - 50.5, e.y - 49.2) < 1.2,
    'il riquadro è a ' + e.x.toFixed(2) + ',' + e.y.toFixed(2) + ' invece che a 50,5 e 49,2');
  assert.ok(Math.hypot(e.x - 48, e.y - 48) > 1.0,
    'non si è mosso affatto: la piramide di prima era un riferimento alla stessa memoria');
  I.insScorda('PROVA5');
});

// ---------------------------------------------------------------------
sezione('§9. Il rivelatore neurale: la decodifica, che è tutto quello che si può provare senza modello');
// ---------------------------------------------------------------------

prova('il riquadro esce dalle bande e torna nelle coordinate della patch', () => {
  // Il ridimensionamento con le bande è invertibile, e sbagliarne il verso
  // non fallisce: sposta ogni riquadro dello stesso offset, cioè si legge
  // come un errore di puntamento.
  const lato = 320, L = 192, H = 192;
  const prep = { scala: lato / L, ox: 0, oy: 0 };
  const ancore = 3, classi = 80, canali = 4 + classi;
  const u = new Float32Array(canali * ancore);
  // Un'ancora sola con fiducia alta, al centro del modello.
  u[0 * ancore + 1] = 160;     // cx nel modello
  u[1 * ancore + 1] = 120;     // cy
  u[2 * ancore + 1] = 20;      // w
  u[3 * ancore + 1] = 10;      // h
  u[(4 + 4) * ancore + 1] = 0.9;  // «airplane»
  const box = I.insYoloLeggi(u, [1, canali, ancore], prep, { attesaX: 96, attesaY: 96, gate: 80 });
  assert.ok(box, 'non ha decodificato niente');
  assert.ok(Math.abs(box.x - 96) < 0.01, 'x = ' + box.x + ', atteso 96');
  assert.ok(Math.abs(box.y - 72) < 0.01, 'y = ' + box.y + ', atteso 72');
  assert.ok(Math.abs(box.w - 12) < 0.01, 'w = ' + box.w + ', atteso 12');
});

prova('sotto la fiducia, e fuori dal cancello, non si decodifica niente', () => {
  const lato = 320, L = 192;
  const prep = { scala: lato / L, ox: 0, oy: 0 };
  const ancore = 2, canali = 84;
  const debole = new Float32Array(canali * ancore);
  debole[0 * ancore + 0] = 160; debole[1 * ancore + 0] = 160;
  debole[(4 + 4) * ancore + 0] = 0.05;
  assert.equal(I.insYoloLeggi(debole, [1, canali, ancore], prep, { attesaX: 96, attesaY: 96, gate: 80 }), null,
    'ha accettato una fiducia del cinque per cento');

  const lontano = new Float32Array(canali * ancore);
  lontano[0 * ancore + 0] = 10; lontano[1 * ancore + 0] = 10;
  lontano[(4 + 4) * ancore + 0] = 0.9;
  assert.equal(I.insYoloLeggi(lontano, [1, canali, ancore], prep, { attesaX: 96, attesaY: 96, gate: 20 }), null,
    'ha accettato un riquadro fuori dal cancello');
});

prova('la classe che si legge è «airplane» e non un\'altra', () => {
  // COCO ha ottanta classi e la quarta è l'aeroplano. Leggere la sbagliata
  // non fallisce: fa riconoscere gli uccelli, o le barche.
  const prep = { scala: 320 / 192, ox: 0, oy: 0 };
  const ancore = 1, canali = 84;
  const u = new Float32Array(canali * ancore);
  u[0] = 160; u[ancore] = 160;
  u[(4 + 14) * ancore] = 0.95;   // un'altra classe qualunque
  assert.equal(I.insYoloLeggi(u, [1, canali, ancore], prep, { attesaX: 96, attesaY: 96, gate: 90 }), null,
    'ha accettato una classe che non è l\'aeroplano');
});

// ---------------------------------------------------------------------
sezione('§10. Le costanti, e i conti che le giustificano');
// ---------------------------------------------------------------------

prova('la patch è una frazione minuscola del fotogramma', () => {
  // È il conto che rende sostenibile tutta la pipeline: si guarda l'aereo a
  // dieci volte la risoluzione angolare di `visione.js` leggendo l'uno e
  // mezzo per cento dei pixel di un fotogramma.
  const pixelPatch = I.INS_LATO_PATCH * I.INS_LATO_PATCH;
  const pixelFotogramma = 1920 * 1280;
  const quota = pixelPatch / pixelFotogramma;
  assert.ok(quota < 0.02, 'la patch è il ' + (quota * 100).toFixed(1) + '% del fotogramma');
});

prova('la patch copre molto più dell\'errore a regime, e molto meno del cancello largo', () => {
  // Sei gradi e mezzo a trenta pixel per grado: sette volte l'errore che
  // resta dopo il filtro, e un terzo del cancello che `visione.js` usa per
  // agganciare la prima volta — che è giusto, perché il primo aggancio lo fa
  // lui sul fotogramma ridotto.
  const pixelPerGrado = 1080 / 36;   // un obiettivo da 65° sul lato lungo
  const gradiPatch = I.INS_LATO_PATCH / pixelPerGrado;
  assert.ok(gradiPatch > 4 && gradiPatch < 10,
    'la patch copre ' + gradiPatch.toFixed(1) + ' gradi');
  assert.ok(gradiPatch > I.INS_INNOVAZIONE_MAX * 2,
    'la patch (' + gradiPatch.toFixed(1) + '°) deve contenere il cancello del filtro (' +
    I.INS_INNOVAZIONE_MAX + '°)');
});

prova('venti fotogrammi fra due rilevazioni sono un grado di aereo vicino', () => {
  // È il numero che rende lecito inseguire invece di rilevare: il flusso
  // ottico non deve mai coprire più di un grado alla volta.
  const gradiAlSecondo = 3;         // un aereo a cinque chilometri
  const secondi = I.INS_PASSO_RILEVA / 60;
  assert.ok(gradiAlSecondo * secondi < 1.5,
    'fra due rilevazioni l\'aereo percorre ' + (gradiAlSecondo * secondi).toFixed(2) + ' gradi');
});

prova('oltre la distanza massima un aereo è due pixel, e due pixel non si inseguono', () => {
  const aperturaM = 40;
  const km = I.INS_DISTANZA_MAX_KM;
  const gradi = (aperturaM / (km * 1000)) * (180 / Math.PI);
  const pixel = gradi * (1080 / 36);
  assert.ok(pixel < 4,
    'a ' + km + ' km un aereo è largo ' + pixel.toFixed(1) + ' pixel: la soglia è troppo generosa');
  assert.ok(pixel > 1,
    'a ' + km + ' km un aereo è largo ' + pixel.toFixed(1) + ' pixel: la soglia è troppo stretta');
});

prova('le conferme e le perdite sono asimmetriche, come devono essere', () => {
  assert.ok(I.INS_PERDITE_MAX >= I.INS_CONFERME,
    'un aggancio che si accende e si spegne è peggio di nessun aggancio');
});

// ---------------------------------------------------------------------
console.log('');
if (fallite) {
  console.log('\x1b[31m' + fallite + ' rosse\x1b[0m su ' + (passate + fallite));
  rosse.forEach(r => console.log('  \x1b[31m✗\x1b[0m ' + r));
  process.exit(1);
}
console.log('\x1b[32m' + passate + ' su ' + passate + ', tutte verdi\x1b[0m');
