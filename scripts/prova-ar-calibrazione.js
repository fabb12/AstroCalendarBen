#!/usr/bin/env node
'use strict';
/* L'allineamento a mano e le etichette della realtà aumentata —
 * `visione.js` §12 e §13.
 *
 *     node scripts/prova-ar-calibrazione.js
 *
 * Mezzo secondo, senza browser e senza dipendenze.
 *
 * ────────────────────────────────────────────────────────────────────────
 * PERCHÉ QUESTO BANCO ESISTE
 *
 * Un'etichetta appoggiata accanto alla Luna vera e una appoggiata un grado
 * più in là sono, sullo schermo, la stessa cosa: tutt'e due dicono «Luna», e
 * nessuno guardando il telefono dice «questa rotazione ha il segno girato».
 * L'allineamento a mano ha in più un difetto suo, che è il peggiore: se il
 * conto è sbagliato **sembra funzionare lo stesso** sull'oggetto scelto — il
 * dito l'ha messo lì — e sbaglia tutto il resto del cielo, che è proprio la
 * parte che doveva raddrizzare.
 *
 * Il giudice è quindi una scena di cui si conosce la verità: una posa vera
 * del telefono, una bussola sbagliata di un errore **noto**, e il dito che
 * tocca dove l'oggetto sta davvero. Si pretende che dopo il tocco:
 *
 *   - l'oggetto scelto finisca sotto il dito, al decimo di pixel;
 *   - gli altri oggetti migliorino insieme a lui (con un punto solo quanto
 *     la geometria permette, con due del tutto — rollio compreso);
 *   - girando il telefono l'allineamento resti, senza rimisurare niente;
 *   - «Annulla» rimetta le cose esattamente com'erano;
 *   - un aereo corregga sé stesso quando l'assetto è già noto, e l'assetto
 *     quando non lo è;
 *   - il riconoscimento automatico non si riprenda l'allineamento dato a
 *     mano con una misura che lo tradisce.
 *
 * E per le etichette: che stiano dove la proiezione mette le cose, che non
 * compaia quello che da qui non si vede (sotto l'orizzonte, dietro alla
 * collina, fuori dal riquadro, le stelle di giorno), che non si stampino
 * una sull'altra né sul segno di un'altra cosa, e che non saltino da una
 * parte all'altra fra un fotogramma e il successivo.
 */

const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const radice = path.resolve(__dirname, '..');
const D2R = Math.PI / 180, R2D = 180 / Math.PI;

// ---------------------------------------------------------------------
// Il mondo finto: il planetario ridotto a quello che §12 e §13 leggono
// ---------------------------------------------------------------------

let orologio = 10000;
const L = 390, H = 780, FOCALE = 380;

// La proiezione della fotocamera è rettilinea (§`skyProietta` col campo
// dettato dall'obiettivo): le stesse due formule di app.js, copiate.
function skyVettore(az, alt) {
  const a = az * D2R, h = alt * D2R;
  return [Math.sin(a) * Math.cos(h), Math.cos(a) * Math.cos(h), Math.sin(h)];
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function skyProietta(v, base, focale) {
  const d = dot(v, base.f), x = dot(v, base.r), y = dot(v, base.u);
  const davanti = d > 0.001;
  return { davanti, px: davanti ? L / 2 + focale * x / d : 0, py: davanti ? H / 2 - focale * y / d : 0, x, y, d };
}
function skyDirezione(px, py, base, focale) {
  const X = (px - L / 2) / focale, Y = (H / 2 - py) / focale;
  const n = Math.hypot(X, Y, 1);
  const x = X / n, y = Y / n, d = 1 / n;
  return [0, 1, 2].map(i => x * base.r[i] + y * base.u[i] + d * base.f[i]);
}

const sky = {
  larghezza: L, altezza: H, camera: true, luceCielo: 0.02,
  oggetti: [], ultimaBase: null, ultimaFocale: FOCALE
};
const aerei = { stato: { aerei: [], visibile: false } };
aerei.aereoCieloOra = (a) => a;
let cime = [], citta = [], cresteDavanti = {};
let scordate = [];

const finestra = {};
const contesto = vm.createContext({
  console, window: finestra,
  performance: { now: () => orologio },
  Math, Float32Array, Float64Array, Int32Array, Uint8ClampedArray, Uint8Array, Map, Set, Object, Array,
  isFinite, Number, String, JSON, Date,
  sky, skyVettore, skyProietta, skyDirezione,
  AereiADS_B: aerei,
  cimeVisibili: () => cime,
  cittaVicine: () => citta,
  cittaQuotaPunto: (lat) => (lat > 45.9 ? 200 : 120),
  cimeQuotaOcchio: () => 300,
  terrenoAngolo: (quota, occhio, km) => Math.atan2(quota - occhio, km * 1000) * R2D,
  terrenoCrestaDavanti: (az) => (cresteDavanti[az] !== undefined ? cresteDavanti[az] : -5),
  terrenoDisponibile: () => true,
  terrenoAltezza: (az) => (az > 300 ? 8 : 0.5),
  insScordaTraccia: (id) => { scordate.push(id); return true; },
  astroI18n: { t: (k, v) => (v ? k + ' ' + JSON.stringify(v) : k) }
});
vm.runInContext(fs.readFileSync(path.join(radice, 'visione.js'), 'utf8'), contesto);
const V = finestra.Visione;
assert.ok(V && V.visCalibraManuale, 'visione.js non ha registrato le funzioni di §12 e §13');
const S = V.stato;

// ---------------------------------------------------------------------
// Il giudice
// ---------------------------------------------------------------------

let passate = 0, fallite = 0;
const rosse = [];
function prova(nome, fn) {
  try { fn(); passate++; }
  catch (e) { fallite++; rosse.push(nome + '\n      ' + (e && e.message ? e.message : e)); }
}

// ---------------------------------------------------------------------
// La scena: una posa vera, una bussola sbagliata, gli oggetti veri
// ---------------------------------------------------------------------

function rot(asse, gradi) { return V.rodrigues(asse.map(x => x * gradi * D2R)); }
function applicaBase(R, b) { return { f: V.applica(R, b.f), r: V.applica(R, b.r), u: V.applica(R, b.u) }; }
function posaVera(az, alt, rollio = 0) {
  const f = skyVettore(az, alt);
  const r0 = [Math.cos(az * D2R), -Math.sin(az * D2R), 0];
  const u0 = [
    f[1] * r0[2] - f[2] * r0[1], f[2] * r0[0] - f[0] * r0[2], f[0] * r0[1] - f[1] * r0[0]
  ];
  const R = rot(f, rollio);
  return { f, r: V.applica(R, r0), u: V.applica(R, u0) };
}

// L'errore dei sensori: dodici gradi di bussola (attorno alla verticale),
// due di beccheggio e uno di rollio. Composti, sono una rotazione qualunque
// — che un punto solo non può togliere tutta, e due sì.
const ERRORE = V.moltiplica(rot([0, 0, 1], 12), V.moltiplica(rot([1, 0, 0], 2), rot([0, 1, 0], 1)));
const sensori = (b) => applicaBase(ERRORE, b);
// Quello che il planetario disegna: la posa dei sensori, raddrizzata da
// quello che `visione.js` sa in questo momento.
const disegnata = (vera) => V.correggi(sensori(vera));

function azzera() {
  S.attivo = true; S.acceso = true;
  S.correzione = null; S.correzioneQuando = 0;
  S.puntiManuali = []; S.manuale = null; S.storiaManuale = [];
  S.ancore = new Map(); S.miraAstri = 0; S.agganciato = false;
  S.postiEtichette = new Map();
  scordate = [];
}

const LUNA = { id: 'Moon', tipo: 'luna', nome: 'Luna', az: 150, alt: 32, diametroKm: 3474, distanzaKm: 384400 };
const GIOVE = { id: 'Jupiter', tipo: 'pianeta', nome: 'Giove', az: 178, alt: 40, mag: -2.3 };
const VEGA = { id: 'Star3', tipo: 'stella', nome: 'Vega', az: 138, alt: 50, mag: 0.03 };
const SATURNO_SOTTO = { id: 'Saturn', tipo: 'pianeta', nome: 'Saturno', az: 160, alt: -4, mag: 0.6 };
const MARTE_DIETRO = { id: 'Mars', tipo: 'pianeta', nome: 'Marte', az: 320, alt: 5, mag: 0.9 };
sky.oggetti = [LUNA, GIOVE, VEGA, SATURNO_SOTTO, MARTE_DIETRO];

const vettoreDi = (o) => skyVettore(o.az, o.alt);
// Dove l'oggetto sta **davvero** sullo schermo: la posa vera, senza errore.
const vero = (o, posa) => skyProietta(vettoreDi(o), posa, FOCALE);
const disegnato = (o, posa) => skyProietta(vettoreDi(o), disegnata(posa), FOCALE);
const scartoPx = (o, posa) => {
  const a = vero(o, posa), b = disegnato(o, posa);
  return Math.hypot(a.px - b.px, a.py - b.py);
};

const POSA = posaVera(160, 38, 3);

// ---------------------------------------------------------------------
// 1. Il tocco: l'oggetto scelto finisce sotto al dito
// ---------------------------------------------------------------------

prova('senza allineamento la scena è storta di decine di pixel (la premessa)', () => {
  azzera();
  assert.ok(scartoPx(LUNA, POSA) > 60, `la Luna disegnata dista ${scartoPx(LUNA, POSA).toFixed(1)} px dalla vera`);
  assert.ok(scartoPx(GIOVE, POSA) > 60);
});

prova('un tocco sulla Luna vera porta la Luna disegnata sotto al dito', () => {
  azzera();
  const dito = vero(LUNA, POSA);
  const esito = V.visCalibraManuale('Moon', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  assert.ok(esito.ok, JSON.stringify(esito));
  assert.equal(esito.modo, 'assetto');
  assert.ok(scartoPx(LUNA, POSA) < 0.1, `scarto ${scartoPx(LUNA, POSA)} px`);
  assert.equal(S.manuale.id, 'Moon');
});

prova('con un punto solo gli altri oggetti migliorano insieme (non è un\'etichetta spostata)', () => {
  azzera();
  const prima = scartoPx(GIOVE, POSA);
  const dito = vero(LUNA, POSA);
  V.visCalibraManuale('Moon', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  const dopo = scartoPx(GIOVE, POSA);
  const vega = scartoPx(VEGA, POSA);
  assert.ok(dopo < prima * 0.25, `Giove: ${prima.toFixed(1)} → ${dopo.toFixed(1)} px`);
  assert.ok(vega < 30, `Vega resta a ${vega.toFixed(1)} px`);
});

prova('contro-esempio: spostare solo l\'etichetta scelta lascia gli altri dov\'erano', () => {
  // È il difetto che §13 esiste per non fare: una correzione del solo
  // marker. Si simula lasciando la correzione ferma: Giove resta storto.
  azzera();
  assert.ok(scartoPx(GIOVE, POSA) > 60);
});

prova('un secondo punto toglie anche il rollio: tutto il cielo torna al posto', () => {
  azzera();
  let dito = vero(LUNA, POSA);
  V.visCalibraManuale('Moon', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  dito = vero(GIOVE, POSA);
  const e = V.visCalibraManuale('Jupiter', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  assert.ok(e.ok);
  for (const o of [LUNA, GIOVE, VEGA]) {
    assert.ok(scartoPx(o, POSA) < 0.6, `${o.nome}: ${scartoPx(o, POSA).toFixed(2)} px`);
  }
  // E la correzione trovata è l'inversa esatta dell'errore dei sensori.
  const resto = V.angoloDi(V.moltiplica(S.correzione, ERRORE));
  assert.ok(resto < 0.05, `resta ${resto.toFixed(3)}°`);
});

prova('un punto vecchio che non si accorda col nuovo si butta invece di storcere', () => {
  azzera();
  // Un primo punto dato male: la Luna indicata cinque gradi più in là.
  const falsa = skyProietta(skyVettore(LUNA.az + 5, LUNA.alt), POSA, FOCALE);
  V.visCalibraManuale('Moon', falsa.px, falsa.py, { base: disegnata(POSA), focale: FOCALE });
  const dito = vero(GIOVE, POSA);
  V.visCalibraManuale('Jupiter', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  assert.ok(scartoPx(GIOVE, POSA) < 0.1, 'il punto appena dato deve tornare esatto');
  assert.equal(V.visPuntiManualiVivi().length, 1);
});

prova('un tocco a più di sessanta gradi dall\'oggetto non è lo stesso oggetto', () => {
  azzera();
  const lontano = skyProietta(skyVettore(LUNA.az + 70, LUNA.alt), sensori(POSA), FOCALE);
  const p = lontano.davanti ? lontano : { px: 5, py: 5 };
  const e = V.visCalibraManuale('Moon', p.px, p.py, {
    base: disegnata(POSA), focale: FOCALE,
    voce: { id: 'Moon', genere: 'luna', nome: 'Luna', vettore: skyVettore(LUNA.az + 70 + 3, LUNA.alt - 60) }
  });
  assert.equal(e.ok, false);
  assert.equal(e.motivo, 'lontano');
  assert.equal(S.correzione, null);
  assert.equal(S.storiaManuale.length, 0);
});

// ---------------------------------------------------------------------
// 2. Dopo il tocco: girando il telefono l'allineamento resta
// ---------------------------------------------------------------------

prova('girando il telefono di 35° la Luna resta sotto l\'etichetta senza rimisurare niente', () => {
  azzera();
  let dito = vero(LUNA, POSA);
  V.visCalibraManuale('Moon', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  dito = vero(GIOVE, POSA);
  V.visCalibraManuale('Jupiter', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  for (const [az, alt, rollio] of [[140, 30, -8], [175, 45, 10], [150, 20, 0]]) {
    const altra = posaVera(az, alt, rollio);
    assert.ok(scartoPx(LUNA, altra) < 0.6, `posa ${az}/${alt}: ${scartoPx(LUNA, altra).toFixed(2)} px`);
    assert.ok(scartoPx(VEGA, altra) < 0.6);
  }
});

prova('con un punto solo, dopo una rotazione, l\'oggetto scelto resta agganciato', () => {
  azzera();
  const dito = vero(LUNA, POSA);
  V.visCalibraManuale('Moon', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  const altra = posaVera(130, 25, -5);
  assert.ok(scartoPx(LUNA, altra) < 0.6, `${scartoPx(LUNA, altra).toFixed(2)} px`);
});

prova('l\'allineamento a mano non scade coi tre minuti delle misure automatiche', () => {
  azzera();
  const dito = vero(LUNA, POSA);
  V.visCalibraManuale('Moon', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  orologio += 5 * 60 * 1000;
  assert.ok(V.correzioneViva(), 'dopo cinque minuti deve esserci ancora');
  orologio += 40 * 60 * 1000;
  assert.equal(V.correzioneViva(), null, 'dopo tre quarti d\'ora il ferro attorno è un altro');
});

// ---------------------------------------------------------------------
// 3. Il riconoscimento automatico, tenuto a bada
// ---------------------------------------------------------------------

prova('una misura automatica che tradisce i punti dati a mano viene riconosciuta', () => {
  azzera();
  const dito = vero(LUNA, POSA);
  V.visCalibraManuale('Moon', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  const C = S.correzione;
  assert.equal(V.visViolaPuntiManuali(V.moltiplica(rot([0, 0, 1], 3), C)), true, 'tre gradi la tradiscono');
  assert.equal(V.visViolaPuntiManuali(V.moltiplica(rot([0, 0, 1], 0.1), C)), false, 'un decimo la raffina');
});

prova('l\'oggetto scelto entra fra i candidati anche se le regole di sempre lo lascerebbero fuori', () => {
  azzera();
  const DENEB = { id: 'Star7', tipo: 'stella', nome: 'Deneb', az: 150, alt: 45, mag: 1.25 };
  sky.oggetti = [LUNA, GIOVE, VEGA, DENEB];
  const dito = vero(DENEB, POSA);
  V.visCalibraManuale('Star7', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  const candidati = [];
  V.visCandidatoBloccato(candidati, disegnata(POSA), FOCALE);
  assert.equal(candidati.length, 1);
  assert.equal(candidati[0].id, 'Star7');
  assert.equal(candidati[0].polarita, 1);
  const gia = [{ id: 'Star7', peso: 0.85 }];
  V.visCandidatoBloccato(gia, disegnata(POSA), FOCALE);
  assert.equal(gia.length, 1);
  assert.ok(gia[0].peso >= 1.8, 'se c\'è già, pesa di più');
  sky.oggetti = [LUNA, GIOVE, VEGA, SATURNO_SOTTO, MARTE_DIETRO];
});

// ---------------------------------------------------------------------
// 4. Annulla e rifai
// ---------------------------------------------------------------------

prova('«Annulla» rimette la correzione esattamente com\'era, un passo per volta', () => {
  azzera();
  let dito = vero(LUNA, POSA);
  V.visCalibraManuale('Moon', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  const dopoUno = S.correzione.map(r => r.slice());
  dito = vero(GIOVE, POSA);
  V.visCalibraManuale('Jupiter', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  assert.ok(V.visAnnullaCalibrazione());
  assert.deepEqual(S.correzione, dopoUno);
  assert.equal(S.manuale.id, 'Moon');
  assert.ok(V.visAnnullaCalibrazione());
  assert.equal(S.correzione, null);
  assert.equal(S.manuale, null);
  assert.equal(V.visAnnullaCalibrazione(), false, 'niente da annullare');
});

prova('rifare dopo un annulla riporta allo stesso allineamento', () => {
  azzera();
  const dito = vero(LUNA, POSA);
  V.visCalibraManuale('Moon', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  const C = S.correzione.map(r => r.slice());
  V.visAnnullaCalibrazione();
  V.visCalibraManuale('Moon', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  assert.ok(V.angoloDi(V.moltiplica(S.correzione, [[C[0][0], C[1][0], C[2][0]], [C[0][1], C[1][1], C[2][1]], [C[0][2], C[1][2], C[2][2]]])) < 1e-6);
});

// ---------------------------------------------------------------------
// 5. Gli aerei: il loro errore è loro
// ---------------------------------------------------------------------

const AEREO = { id: 'abc123', callsign: 'AZA123', az: 165, alt: 20, distanzaKm: 18, quotaM: 7300 };

prova('con l\'assetto già noto, toccare un aereo corregge la sua ancora e non il cielo', () => {
  azzera();
  aerei.stato.aerei = [AEREO];
  let dito = vero(LUNA, POSA);
  V.visCalibraManuale('Moon', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  dito = vero(GIOVE, POSA);
  V.visCalibraManuale('Jupiter', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  const C = S.correzione.map(r => r.slice());
  // L'aereo vero sta un grado e mezzo più in là di dove il feed lo mette.
  const veroAereo = skyProietta(skyVettore(AEREO.az + 1.5, AEREO.alt - 0.6), POSA, FOCALE);
  const e = V.visCalibraManuale('aereo:abc123', veroAereo.px, veroAereo.py, { base: disegnata(POSA), focale: FOCALE });
  assert.ok(e.ok);
  assert.equal(e.modo, 'ancora');
  assert.deepEqual(S.correzione, C, 'il cielo non si tocca');
  const anc = S.ancore.get('abc123');
  assert.ok(Math.abs(anc.dAz - 1.5) < 0.05 && Math.abs(anc.dAlt + 0.6) < 0.05, JSON.stringify(anc));
  assert.deepEqual(scordate, ['abc123'], 'la traccia dell\'inseguitore va dimenticata');
  // E il disegno lo porta sotto al dito: la posizione del feed più l'ancora.
  const qui = skyProietta(skyVettore(AEREO.az + anc.dAz, AEREO.alt + anc.dAlt), disegnata(POSA), FOCALE);
  assert.ok(Math.hypot(qui.px - veroAereo.px, qui.py - veroAereo.py) < 0.5);
  // Con l'assetto noto solo a metà (un punto), l'ancora si prende anche il
  // resto dell'errore: l'etichetta deve comunque finire dove si è toccato.
  azzera();
  dito = vero(LUNA, POSA);
  V.visCalibraManuale('Moon', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  const e2 = V.visCalibraManuale('aereo:abc123', veroAereo.px, veroAereo.py, { base: disegnata(POSA), focale: FOCALE });
  assert.equal(e2.modo, 'ancora');
  const a2 = S.ancore.get('abc123');
  const qui2 = skyProietta(skyVettore(AEREO.az + a2.dAz, AEREO.alt + a2.dAlt), disegnata(POSA), FOCALE);
  assert.ok(Math.hypot(qui2.px - veroAereo.px, qui2.py - veroAereo.py) < 0.5);
  aerei.stato.aerei = [];
});

prova('senza assetto noto (di giorno, niente astri), l\'aereo corregge l\'assetto', () => {
  azzera();
  aerei.stato.aerei = [AEREO];
  const veroAereo = skyProietta(skyVettore(AEREO.az, AEREO.alt), POSA, FOCALE);
  const e = V.visCalibraManuale('aereo:abc123', veroAereo.px, veroAereo.py, { base: disegnata(POSA), focale: FOCALE });
  assert.ok(e.ok);
  assert.equal(e.modo, 'assetto');
  const quiAereo = skyProietta(skyVettore(AEREO.az, AEREO.alt), disegnata(POSA), FOCALE);
  assert.ok(Math.hypot(quiAereo.px - veroAereo.px, quiAereo.py - veroAereo.py) < 0.1);
  assert.ok(scartoPx(LUNA, POSA) < 25, 'e la Luna, che non si è toccata, migliora con lui');
  aerei.stato.aerei = [];
});

// ---------------------------------------------------------------------
// 6. Le etichette: chi si nomina e dove
// ---------------------------------------------------------------------

function voci(posa, opz) {
  return V.visVociRealta(disegnata(posa), FOCALE, opz || {});
}

prova('si nominano la Luna, Giove e Vega, ognuno sulla sua proiezione', () => {
  azzera();
  const vv = voci(POSA);
  for (const o of [LUNA, GIOVE, VEGA]) {
    const v = vv.find(x => x.id === o.id);
    assert.ok(v, o.nome + ' manca');
    const p = disegnato(o, POSA);
    assert.ok(Math.hypot(v.px - p.px, v.py - p.py) < 1e-6);
  }
});

prova('non si nominano le cose che da qui non si vedono', () => {
  azzera();
  const ids = voci(POSA).map(v => v.id);
  assert.ok(!ids.includes('Saturn'), 'Saturno è sotto l\'orizzonte');
  assert.ok(!ids.includes('Mars'), 'Marte è dietro alla collina (cresta a 8° da quella parte)');
  const dietro = posaVera(340, 10, 0);
  assert.ok(!voci(dietro).some(v => v.id === 'Moon'), 'la Luna fuori dal riquadro non si nomina');
});

prova('di giorno le stelle no, la Luna sì', () => {
  azzera();
  sky.luceCielo = 0.8;
  const ids = voci(POSA).map(v => v.id);
  sky.luceCielo = 0.02;
  assert.ok(ids.includes('Moon'));
  assert.ok(!ids.includes('Star3'));
  assert.ok(!ids.includes('Jupiter'), 'Giove a -2,3 di giorno non si vede a occhio');
});

prova('dopo l\'allineamento l\'etichetta della Luna sta sulla Luna vera', () => {
  azzera();
  const dito = vero(LUNA, POSA);
  V.visCalibraManuale('Moon', dito.px, dito.py, { base: disegnata(POSA), focale: FOCALE });
  const v = voci(POSA).find(x => x.id === 'Moon');
  assert.ok(Math.hypot(v.px - dito.px, v.py - dito.py) < 0.1);
});

prova('gli aerei si nominano con identificativo e dati, e solo se lo strato non li nomina già', () => {
  azzera();
  aerei.stato.aerei = [AEREO, { id: 'lontano', callsign: 'XX9', az: 160, alt: 3, distanzaKm: 140 }];
  let vv = voci(POSA);
  const a = vv.find(v => v.genere === 'aereo');
  assert.ok(a && a.nome === 'AZA123', 'l\'aereo vicino c\'è col suo nominativo');
  assert.ok(/7300/.test(a.dettaglio) && /18/.test(a.dettaglio), a.dettaglio);
  assert.ok(!vv.some(v => v.id === 'aereo:lontano'), 'a 140 km non è pertinente');
  aerei.stato.visibile = true;
  vv = voci(POSA);
  assert.ok(!vv.some(v => v.genere === 'aereo'), 'con lo strato acceso li nomina aerei.js');
  assert.ok(V.visVociRealta(disegnata(POSA), FOCALE, { aerei: true }).some(v => v.genere === 'aereo'),
    'ma per allineare a mano si possono scegliere lo stesso');
  aerei.stato.visibile = false;
  aerei.stato.aerei = [];
});

prova('le vette stanno sulla loro punta, i paesi alla loro quota (sotto l\'orizzonte)', () => {
  azzera();
  cime = [{ nome: 'Monte Prova', quota: 1800, km: 22, az: 158, alt: 3.2 }];
  citta = [
    { nome: 'Borgo', lat: 45.8, lon: 9.1, km: 6, az: 162, abitanti: 3000 },
    { nome: 'Nascosto', lat: 45.8, lon: 9.2, km: 9, az: 170, abitanti: 5000 }
  ];
  cresteDavanti = { 170: 2 };
  const vv = voci(posaVera(162, 5, 0));
  const m = vv.find(v => v.genere === 'cima');
  const pm = skyProietta(skyVettore(158, 3.2), disegnata(posaVera(162, 5, 0)), FOCALE);
  assert.ok(m && Math.hypot(m.px - pm.px, m.py - pm.py) < 1e-6, 'la vetta sulla sua punta');
  const b = vv.find(v => v.nome === 'Borgo');
  assert.ok(b, 'il paese in vista c\'è');
  const altAtteso = Math.atan2(120 - 300, 6000) * R2D;
  assert.ok(Math.abs(b.alt - altAtteso) < 1e-9 && b.alt < 0, `alt ${b.alt}`);
  assert.ok(!vv.some(v => v.nome === 'Nascosto'), 'il paese dietro alla collina no');
  assert.ok(!V.visOggettiCalibrabili(disegnata(posaVera(162, 5, 0)), FOCALE).some(v => v.genere === 'citta'),
    'un paese è largo chilometri: non si indica col dito');
  cime = []; citta = []; cresteDavanti = {};
});

// ---------------------------------------------------------------------
// 7. L'impaginazione
// ---------------------------------------------------------------------

const misura = (t) => t.length * 6.5;
const tocca = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

function affollate() {
  const vv = [{ id: 'Moon', genere: 'luna', nome: 'Luna', px: 200, py: 300, rPx: 4, priorita: 10 }];
  for (let i = 0; i < 25; i++) {
    vv.push({ id: 's' + i, genere: 'stella', nome: 'Stella' + i, px: 150 + (i % 5) * 22, py: 270 + Math.floor(i / 5) * 16, rPx: 0, priorita: 3, mag: 1 + i / 10 });
  }
  return vv;
}

prova('nessuna etichetta si stampa su un\'altra né sul segno di un\'altra cosa', () => {
  const posti = V.visImpaginaEtichette(affollate(), L, H, misura, { alto: 60 });
  const messi = posti.filter(p => p.rett);
  for (let i = 0; i < messi.length; i++) {
    for (let j = i + 1; j < messi.length; j++) assert.ok(!tocca(messi[i].rett, messi[j].rett), 'due etichette si toccano');
    for (const p of posti) {
      if (p === messi[i]) continue;
      const r = V.visRaggioSegno(p.voce);
      const segno = { x0: p.voce.px - r, y0: p.voce.py - r, x1: p.voce.px + r, y1: p.voce.py + r };
      // Il segno di chi conta quanto o più di lei non si copre mai; quello di
      // chi conta meno solo quando non c'è altro posto (la seconda passata).
      if (p.voce.priorita >= messi[i].voce.priorita) {
        assert.ok(!tocca(messi[i].rett, segno), `${messi[i].voce.nome} copre il segno di ${p.voce.nome}`);
      }
    }
  }
  assert.ok(messi.length < posti.length, 'con venticinque stelle ammucchiate qualcuna deve cedere il posto');
  // Le stelle, fra loro, non si coprono mai il segno.
  const stelle = messi.filter(p => p.voce.genere === 'stella');
  stelle.forEach(p => posti.forEach(q => {
    if (q === p) return;
    const r = V.visRaggioSegno(q.voce);
    assert.ok(!tocca(p.rett, { x0: q.voce.px - r, y0: q.voce.py - r, x1: q.voce.px + r, y1: q.voce.py + r }));
  }));
});

prova('la Luna ha sempre il suo nome, anche in mezzo alle stelle', () => {
  const posti = V.visImpaginaEtichette(affollate(), L, H, misura, { alto: 60 });
  assert.ok(posti.find(p => p.voce.id === 'Moon').rett);
});

prova('niente esce dal riquadro né entra nella fascia della bussola', () => {
  const vv = [
    { id: 'a', genere: 'pianeta', nome: 'Giove', px: L - 3, py: 400, rPx: 0, priorita: 8 },
    { id: 'b', genere: 'pianeta', nome: 'Venere', px: 180, py: 64, rPx: 0, priorita: 8 },
    { id: 'c', genere: 'cima', nome: 'Monte', px: 100, py: H - 4, rPx: 0, priorita: 5 }
  ];
  V.visImpaginaEtichette(vv, L, H, misura, { alto: 60 }).forEach(p => {
    if (!p.rett) return;
    assert.ok(p.rett.x0 >= 2 && p.rett.x1 <= L - 2 && p.rett.y0 >= 62 && p.rett.y1 <= H - 2, JSON.stringify(p.rett));
  });
  const giove = V.visImpaginaEtichette(vv, L, H, misura, { alto: 60 }).find(p => p.voce.id === 'a');
  assert.equal(giove.rett.posto, 'sinistra', 'sul bordo destro il nome va a sinistra');
});

prova('un nome non salta da una parte all\'altra fra un fotogramma e il successivo', () => {
  const memoria = new Map();
  const base = [{ id: 'j', genere: 'pianeta', nome: 'Giove', px: 200, py: 300, rPx: 0, priorita: 8 }];
  // Un vicino costringe Giove a sinistra…
  const primo = V.visImpaginaEtichette(base.concat([{ id: 'x', genere: 'stella', nome: 'X', px: 222, py: 300, rPx: 0, priorita: 9 }]), L, H, misura, { memoria });
  assert.equal(primo.find(p => p.voce.id === 'j').rett.posto, 'sinistra');
  // …e quando il vicino se ne va, a sinistra resta.
  const dopo = V.visImpaginaEtichette(base, L, H, misura, { memoria });
  assert.equal(dopo.find(p => p.voce.id === 'j').rett.posto, 'sinistra');
});

prova('i nomi del paesaggio vanno sopra la cosa, quelli degli astri accanto', () => {
  const posti = V.visImpaginaEtichette([
    { id: 'm', genere: 'cima', nome: 'Monte', px: 150, py: 500, rPx: 0, priorita: 5 },
    { id: 'l', genere: 'luna', nome: 'Luna', px: 150, py: 200, rPx: 3, priorita: 10 }
  ], L, H, misura, {});
  assert.equal(posti.find(p => p.voce.id === 'm').rett.posto, 'sopra');
  assert.equal(posti.find(p => p.voce.id === 'l').rett.posto, 'destra');
});

// ---------------------------------------------------------------------

console.log(`\nprova-ar-calibrazione: ${passate} passate, ${fallite} fallite`);
if (rosse.length) {
  console.log('\n  ✗ ' + rosse.join('\n  ✗ '));
  process.exit(1);
}
