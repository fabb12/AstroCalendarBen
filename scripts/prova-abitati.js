#!/usr/bin/env node
'use strict';
// Gli abitati nel planetario — `cittaAbitati()` in `terreno.js` e
// `skyDisegnaAbitati()` in `app.js`.
//
// Questa famiglia si giudica a occhio peggio di quasi tutte le altre, e per
// una ragione che vale la pena scrivere: **qualunque manciata di puntini
// arancioni appoggiata sotto l'orizzonte somiglia a un paese**. Nessuno,
// guardando lo schermo, dice «questo abitato è largo il doppio del vero» o
// «queste luci stanno cinquanta metri sopra il campanile»: dice «carino».
// Un errore di segno nella quota mette il paese sopra la linea
// dell'orizzonte e continua a essere una bella macchia di luci; una cresta
// letta con la distanza sbagliata lo cancella del tutto, e un paese
// cancellato è identico a un paese che da qui non si vede.
//
// Il giudice quindi non è l'occhio ma l'aritmetica, e le domande sono
// cinque: il paese sta dove dice la geometria, è largo quanto la sua
// larghezza vera diviso la sua distanza, le sue luci non ballano fra una
// lettura e l'altra, la collina davanti lo taglia dove lo taglia davvero, e
// il nome si appende al paese e non alla montagna che gli sta dietro.

const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
let passate = 0, fallite = 0;
function prova(nome, fn) {
  try { fn(); passate++; console.log('  ok  ' + nome); }
  catch (e) { fallite++; console.log('  NO  ' + nome + '\n      ' + e.message); }
}

// --- Il documento finto ------------------------------------------------
const saved = new Map();
function element() {
  return { innerHTML: '', textContent: '', dataset: {}, style: {},
    classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    hasAttribute: () => false, querySelectorAll: () => [], querySelector: () => null,
    addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    closest: () => null,
    getBoundingClientRect: () => ({ width: 0, height: 0, left: 0, top: 0 }),
    getContext: () => null };
}

const QUI = { lat: 45.8100, lon: 9.0800, nome: 'Qui' };

const ctx = vm.createContext({
  console, Date, setTimeout, clearTimeout, AbortController,
  fetch: () => Promise.reject(new Error('senza rete')),
  window: {},
  document: { body: element(), createElement: () => element(),
    getElementById: () => element(), querySelector: () => null,
    querySelectorAll: () => [], addEventListener() {} },
  localStorage: { getItem: k => saved.get(k) || null,
    setItem: (k, v) => saved.set(k, v), removeItem: k => saved.delete(k) },
  astroI18n: { lingua: 'it', t: k => k, esiste: () => true, numero: n => String(n) },
  luogoCorrente: () => QUI,
  requestIdleCallback: f => setTimeout(f, 0)
});
const run = s => vm.runInContext(s, ctx);
run(fs.readFileSync(path.join(root, 'terreno.js'), 'utf8'));

// --- Il pezzo di `app.js` che disegna, senza pixel ---------------------
//
// `skyDisegnaAbitati` non si prova guardando: si prova contando **quali**
// luci arrivano alla vernice e a che altezza. Il contesto finto registra
// ogni cerchio invece di dipingerlo, e l'occlusione contro la cresta
// diventa un numero.
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
for (const nome of ['skyDisegnaAbitati', 'skyDisegnaLuciAbitato',
                    'skyDisegnaMacchiaAbitato', 'skyDisegnaCasePaese',
                    'skyAbitatoMuro', 'skyAbitatoSporgeQualcosa',
                    'skyClipSopraLaCresta',
                    'skyAbitatoVisto', 'skyAbitatoChiave', 'skyMescolaColore',
                    'skyRgba', 'skyLontananzaCitta', 'skyOpacitaTerreno',
                    // I nomi: la gerarchia del §8 si prova sulla funzione
                    // vera, se no si proverebbe una sua copia.
                    'skyNomiCitta', 'skyCittaDaDisegnare', 'skyProspettivaCitta',
                    'skyCittaMaxNomi', 'skyCittaCorpoRango', 'skyParteSiNomina',
                    'skyRettOrientato', 'skyRettAppoggiato', 'skyRettiSiToccano',
                    'skyPostoLibero']) {
  const m = app.match(new RegExp('^function ' + nome + '\\([\\s\\S]*?^\\}', 'm'));
  assert.ok(m, 'non trovo ' + nome + ' in app.js');
  run(m[0]);
}
for (const cost of ['SKY_ABITATO_CRESTA_PX', 'SKY_ABITATO_CRESTA_MIN', 'SKY_ABITATO_CRESTA_MAX',
                    'SKY_ABITATO_FOSCHIA', 'SKY_ABITATO_VELO_MIN',
                    'SKY_ABITATO_FOV_PIENO', 'SKY_ABITATO_FOV_SPENTO',
                    'SKY_ABITATO_PUNTO_MIN',
                    'SKY_ABITATO_PUNTO_MAX', 'SKY_ABITATO_TINTA_FREDDA',
                    'SKY_ABITATO_PASSO_PX', 'SKY_ABITATO_LUCI_MIN',
                    'SKY_ABITATO_ALFA', 'SKY_ABITATO_ORLO_ALFA',
                    'SKY_ABITATO_TETTI_ALFA', 'SKY_ABITATO_FOSCHIA_TINTA',
                    'SKY_ABITATO_TETTI_PX', 'SKY_ABITATO_CLIP_ALTO',
                    'SKY_ABITATO_LETTO_ALFA', 'SKY_ABITATO_PARTE_ALFA',
                    'SKY_ABITATO_VOLUME_PX', 'SKY_ABITATO_MURO_ALFA',
                    'SKY_ABITATO_TETTO_ALFA', 'SKY_ABITATO_TEGOLA_QUOTA',
                    'SKY_ABITATO_TORRE_PX', 'SKY_ABITATO_GUGLIA',
                    'SKY_CITTA_LUCE_MAX', 'SKY_FOSCHIA_KM',
                    'SKY_CITTA_MAX_NOMI', 'SKY_CITTA_MAX_NOMI_ZOOM',
                    'SKY_CITTA_FOSCHIA_TINTA', 'SKY_CITTA_INDICATO_VELO',
                    'SKY_CITTA_INDICATO_ALONE', 'SKY_CITTA_KM_CORPO',
                    'SKY_CITTA_KM_VELO', 'SKY_CITTA_KM_SEP', 'SKY_CITTA_KM_FOV',
                    'SKY_CITTA_PARTE_QUOTA', 'SKY_FONT_ETICHETTE']) {
  const m = app.match(new RegExp('^const ' + cost + ' = [^;]+;', 'm'));
  assert.ok(m, 'non trovo ' + cost);
  run(m[0]);
}
run(app.match(/^const SKY_ABITATO_TINTE = \[[\s\S]*?^\];/m)[0]);
for (const c of ['SKY_CITTA_ZOOM_FOV', 'SKY_CITTA_RANGO_CORPO',
                 'SKY_CITTA_MIRINO_QUANTO']) {
  run(app.match(new RegExp('^const ' + c + ' = \\[[^\\]]*\\];', 'm'))[0]);
}
for (const c of ['SKY_CITTA_VICINO', 'SKY_CITTA_LONTANO']) {
  run(app.match(new RegExp('^const ' + c + '\\s*= \\{[^}]*\\};', 'm'))[0]);
}
run(app.match(/^const SKY_NOMI_ORIZZONTE = \{[\s\S]*?^\};/m)[0]);
for (const c of ['SKY_ABITATO_SUOLO', 'SKY_ABITATO_ORLO', 'SKY_ABITATO_TETTI',
                 'SKY_ABITATO_MURO_LUCE', 'SKY_ABITATO_MURO_OMBRA',
                 'SKY_ABITATO_TEGOLA', 'SKY_ABITATO_LAMIERA']) {
  run(app.match(new RegExp('^const ' + c + ' = \\[[^\\]]*\\];', 'm'))[0]);
}
run('let skyAbitatiVisti = null;');
run('const SKY_D2R = Math.PI / 180;');

// Il planetario finto: una proiezione gnomonica che basta e avanza — qui
// non si giudica *dove* finiscono i pixel, si giudica **quali** luci
// arrivano a essere disegnate e con che altezza.
run(`
  var sky = { larghezza: 1000, altezza: 700, luceCielo: 0, fov: 60,
              atmosfera: true, mostraNomi: true, ariaOra: null,
              etichetteLuogo: [] };
  var skyCrestaFinta = 0;
  // Dove guarda il planetario finto: le luci fuori dal riquadro non si
  // disegnano, ed è giusto — ma una prova che non punta il paese non prova
  // niente, e lo fa in silenzio.
  var skyAzVista = 90;
  // E **dove** in altezza. Serve per la stessa ragione dell'azimut: un
  // paese guardato da un monte sta quindici gradi sotto la linea
  // dell'orizzonte, cioè mille pixel sotto il bordo del riquadro, e una
  // prova che continua a puntare l'orizzonte diventa verde (o rossa) per
  // un motivo che col paese non c'entra niente.
  var skyAltVista = 0;
  function skyVettore(az, alt) {
    const a = az * SKY_D2R, h = alt * SKY_D2R;
    return { az, alt, x: Math.cos(h) * Math.sin(a), y: Math.cos(h) * Math.cos(a), z: Math.sin(h) };
  }
  function skyProietta(v, base, focale) {
    // Una gnomonica piatta con la stessa scala che il modulo si calcola da
    // sé (focale × gradi): così ingrandire, qui dentro, vuol dire davvero
    // ingrandire.
    const s = ((v.az - skyAzVista) % 360 + 540) % 360 - 180;
    const k = focale * SKY_D2R;
    return { davanti: true, d: 1, px: 500 + s * k,
             py: 350 - (v.alt - skyAltVista) * k,
             az: v.az, alt: v.alt };
  }
  function skyScalaLocale() { return 1; }
  // Da che parte viene la luce. Sul banco si dichiara, perché qui non si
  // giudica il colore di una parete: si giudica **quali** case arrivano
  // alla vernice e a che altezza.
  var skyLuceFinta = { az: 270, forza: 0.8, calda: [255, 240, 208], fredda: [96, 128, 176] };
  function skyLucePaesaggio() { return skyLuceFinta; }
  // Il computer: qui le misure del dispositivo non sono in discussione.
  function quanto(tel, tab, pc) { return pc; }
  // La cresta disegnata a cui un nome si appende quando il paese è coperto.
  var skyQuotaFinta = -1;
  function skyQuotaDisegnata(az, km) { return skyQuotaFinta; }
  // Le scritte si registrano invece di dipingerle: di un nome qui interessa
  // **che** sia stato scritto, con che corpo e dove — non come è antialiasato.
  var skyScritte = [];
  function skyScrittaConAlone(ctx, testo, x, y) {
    skyScritte.push({ testo, x, y, font: ctx.font });
  }
  function skyCrestaDisegnataEntro(az, km) { return skyCrestaFinta; }
  function telaFinta() {
    const punti = [], forme = [];
    let corrente = null;
    return { punti, forme,
      // Le luci si disegnano dentro al primo save() della funzione, il
      // letto di luce dentro a un secondo: contando solo il primo livello
      // si contano i puntini e non la macchia che ci sta sotto.
      _liv: 0, _f: '', _s: '',
      save() { this._liv++; }, restore() { this._liv--; },
      translate() {}, scale() {},
      set fillStyle(v) { this._f = v; }, get fillStyle() { return this._f; },
      set strokeStyle(v) { this._s = v; }, get strokeStyle() { return this._s; },
      set globalCompositeOperation(v) {}, get globalCompositeOperation() { return ''; },
      set lineWidth(v) {}, get lineWidth() { return 1; },
      set lineJoin(v) {}, get lineJoin() { return ''; },
      // Un carattere a larghezza fissa: qui non si misura un font, si
      // misura se due etichette si contendono lo stesso posto — e per
      // quella domanda una larghezza proporzionale al corpo basta e
      // avanza, ed è anche l'unica riproducibile senza un browser.
      _font: '',
      set font(v) { this._font = v; }, get font() { return this._font; },
      set textBaseline(v) {}, get textBaseline() { return ''; },
      set textAlign(v) {}, get textAlign() { return ''; },
      set globalAlpha(v) {}, get globalAlpha() { return 1; },
      measureText(t) {
        const m = /(\d+(?:\.\d+)?)px/.exec(this._font);
        return { width: String(t).length * (m ? +m[1] : 12) * 0.55 };
      },
      createRadialGradient: () => ({ addColorStop() {} }),
      // I tracciati si registrano per quello che ne viene fatto: un fill e
      // uno stroke sono la macchia e il suo perimetro, un clip e' il
      // ritaglio contro la collina. Contarli tutti insieme non direbbe
      // niente.
      beginPath() { corrente = []; },
      moveTo(x, y) { if (corrente) corrente.push({ x, y }); },
      lineTo(x, y) { if (corrente) corrente.push({ x, y }); },
      closePath() {},
      fill() { forme.push({ tipo: 'fill', punti: (corrente || []).slice(), stile: this._f }); },
      stroke() { forme.push({ tipo: 'stroke', punti: (corrente || []).slice(), stile: this._s }); },
      clip() { forme.push({ tipo: 'clip', punti: (corrente || []).slice() }); },
      fillRect(x, y, w, h) { forme.push({ tipo: 'rect', x, y, w, h, stile: this._f }); },
      arc(x, y, r) { if (this._liv === 1) punti.push({ x, y, r }); } };
  }
`);

// --- Il posto e i suoi paesi ------------------------------------------
//
// Il terreno vero non c'è (nessuna rete), quindi la quota la mettiamo noi:
// è esattamente la strada che il modulo usa quando le tessere non ci sono.
function posto(paesi, quotaOcchio, quotaSuolo) {
  // `citta` e `raggi` sono dichiarati con `const` dentro al modulo: non
  // stanno sull'oggetto globale, e si raggiungono solo eseguendo del codice
  // nel loro stesso scope.
  ctx.__paesi = paesi;
  run(`citta.acceso = true;
       citta.lat = ${QUI.lat}; citta.lon = ${QUI.lon};
       citta.grezze = __paesi; citta.fonte = 'prova'; citta.stato = 'pronto';
       citta.elenco = cittaPrepara(citta.grezze, ${QUI.lat}, ${QUI.lon}, null);
       citta.vistaChiave = cittaChiaveVista(${QUI.lat}, ${QUI.lon});`);
  // Le due fonti delle quote e il punto da cui si guarda, sostituiti:
  // qui non si prova il modello del suolo, si prova la geometria.
  ctx.rilQuotaSuolo = () => null;
  ctx.rilQuotaGrigliaSotto = () => quotaSuolo;
  ctx.terrenoPuntoDaDisegnare = () => QUI;
  ctx.cimeQuotaOcchio = () => quotaOcchio;
  ctx.terrenoDisponibile = () => false;
  // Le forme si tengono per paese: senza svuotarle, una prova che cambia
  // il modello del suolo si ritroverebbe le quote di quella prima.
  run('cittaAbitatiChiave = null; cittaForme.clear();');
  return run('cittaAbitati()');
}

// Un paese a dieci chilometri esatti verso est, e uno lontano a nord.
const KM = 1 / 111.195;
const PAESI = [
  { nome: 'Vicino', lat: QUI.lat, lon: QUI.lon + 10 * KM / Math.cos(QUI.lat * Math.PI / 180),
    abitanti: 12000 },
  { nome: 'Lontano', lat: QUI.lat + 30 * KM, lon: QUI.lon, abitanti: 90000 }
];

console.log('\n§1 — dove sta il paese');

prova('il paese a est è a est, e alla sua distanza', () => {
  const ab = posto(PAESI, 800, 300);
  const v = ab.find(a => a.nome === 'Vicino');
  assert.ok(v, 'il paese vicino non è fra gli abitati');
  assert.ok(Math.abs(v.az - 90) < 0.5, 'azimut ' + v.az.toFixed(2));
  assert.ok(Math.abs(v.km - 10) < 0.1, 'distanza ' + v.km.toFixed(2));
});

prova('un paese cinquecento metri più in basso sta SOTTO la linea dell\'orizzonte', () => {
  const ab = posto(PAESI, 800, 300);
  const v = ab.find(a => a.nome === 'Vicino');
  // atan(500/10000) sono 2,86 gradi, meno il rigonfiamento della Terra.
  assert.ok(v.altAlto < 0, 'il tetto del paese è a ' + v.altAlto.toFixed(2) + '°, cioè sopra la linea');
  assert.ok(v.altAlto > -4 && v.altBasso > -4.5,
    'troppo in basso: ' + v.altAlto.toFixed(2) + ' / ' + v.altBasso.toFixed(2));
});

prova('un paese più in alto di chi guarda sta sopra la linea', () => {
  const ab = posto(PAESI, 200, 900);
  const v = ab.find(a => a.nome === 'Vicino');
  assert.ok(v.altAlto > 2, 'altezza ' + v.altAlto.toFixed(2));
});

prova('la larghezza è quella vera divisa la distanza', () => {
  const ab = posto(PAESI, 800, 300);
  const v = ab.find(a => a.nome === 'Vicino');
  // Il raggio dell'abitato per dodicimila abitanti, letto dalla stessa
  // funzione che lo dichiara: il semiangolo non può che essere il suo
  // arcotangente, e il sorteggio delle luci ci sta dentro.
  const r = run('cittaRaggioAbitatoKm(12000)');
  const atteso = Math.atan2(r, v.km) * 180 / Math.PI;
  assert.ok(v.semiAz <= atteso * 1.25,
    'semiampiezza ' + v.semiAz.toFixed(3) + '° contro un raggio da ' + atteso.toFixed(3) + '°');
  assert.ok(v.semiAz > atteso * 0.3, 'troppo stretto: ' + v.semiAz.toFixed(3));
});

prova('più lontano è, più stretto viene', () => {
  const ab = posto(PAESI, 800, 300);
  const vicino = ab.find(a => a.nome === 'Vicino');
  const lontano = ab.find(a => a.nome === 'Lontano');
  assert.ok(lontano, 'il paese lontano non c\'è');
  // Novantamila abitanti sono un abitato quasi tre volte più largo di
  // dodicimila, e sta tre volte più in là: deve venire comunque più stretto
  // di quello vicino? No — deve venire più stretto **del suo stesso raggio
  // visto da dieci chilometri**, che è la domanda vera.
  const rL = run('cittaRaggioAbitatoKm(90000)');
  assert.ok(lontano.semiAz < Math.atan2(rL, 10) * 180 / Math.PI,
    'a trenta chilometri non si è ristretto');
});

console.log('\n§2 — le luci non ballano');

prova('due letture di fila danno le stesse identiche luci', () => {
  const a = posto(PAESI, 800, 300).find(x => x.nome === 'Vicino');
  const b = posto(PAESI, 800, 300).find(x => x.nome === 'Vicino');
  assert.equal(a.luci.length, b.luci.length);
  for (let i = 0; i < a.luci.length; i++) {
    assert.ok(Math.abs(a.luci[i].az - b.luci[i].az) < 1e-9 &&
      Math.abs(a.luci[i].alt - b.luci[i].alt) < 1e-9, 'la luce ' + i + ' si è spostata');
  }
});

prova('paesi diversi hanno luci diverse', () => {
  const ab = posto(PAESI, 800, 300);
  const a = ab[0].luci.map(l => l.scarto).join(',');
  const b = ab[1].luci.map(l => l.scarto).join(',');
  assert.notEqual(a, b);
});

prova('una città ha più luci di un paese', () => {
  assert.ok(run('cittaQuanteLuci(150000)') > run('cittaQuanteLuci(2000)') * 3);
  assert.ok(run('cittaQuanteLuci(2000)') >= run('CITTA_LUCI_MIN'));
  assert.ok(run('cittaQuanteLuci(9000000)') <= run('CITTA_LUCI_MAX'));
});

prova('senza nessuna quota il paese non si disegna affatto', () => {
  // Appoggiarlo a zero vorrebbe dire rimetterlo sulla linea dell'orizzonte,
  // che è il posto in cui un paese non sta quasi mai: meglio la sola cupola.
  const ab = posto(PAESI, 800, null);
  assert.equal(ab.length, 0);
});

prova('oltre il raggio massimo resta la sola cupola', () => {
  const max = run('CITTA_ABITATO_KM_MAX');
  const via = [{ nome: 'Fuori', lat: QUI.lat + (max + 12) * KM, lon: QUI.lon, abitanti: 400000 }];
  // Il raggio di ricerca deve arrivarci, se no lo scarta prima `cittaPrepara`.
  run(`raggi.citta = ${Math.round(max + 30)};`);
  const ab = posto(via, 800, 300);
  assert.equal(ab.filter(a => a.nome === 'Fuori').length, 0);
  run('raggi.citta = 90;');
});

prova('le quote del suolo si leggono una volta per paese, non a ogni passo', () => {
  // Muoversi non sposta un paese: il sorteggio delle sue luci e le loro
  // quote non dipendono da dove si guarda. Rileggerle a ogni fix del GPS
  // sarebbe qualche migliaio di letture del modello del suolo al secondo,
  // per un risultato identico.
  let letture = 0;
  posto(PAESI, 800, 300);
  ctx.rilQuotaGrigliaSotto = () => { letture++; return 300; };
  run('cittaForme.clear(); cittaAbitatiChiave = null; cittaAbitati();');
  const prime = letture;
  assert.ok(prime > 0, 'non ha letto nessuna quota');
  // Undici metri più in là: la chiave della vista cambia, la forma no.
  ctx.terrenoPuntoDaDisegnare = () => ({ lat: QUI.lat + 0.0003, lon: QUI.lon, nome: 'Qui' });
  run('cittaAbitatiChiave = null; cittaAbitati();');
  assert.equal(letture, prime, 'ha riletto ' + (letture - prime) + ' quote per uno spostamento');
  ctx.terrenoPuntoDaDisegnare = () => QUI;
});

prova('un terreno nuovo rifà le forme', () => {
  let letture = 0;
  posto(PAESI, 800, 300);
  ctx.rilQuotaGrigliaSotto = () => { letture++; return 300; };
  run('cittaForme.clear(); cittaAbitatiChiave = null; cittaAbitati();');
  const prime = letture;
  run('terreno.quando = Date.now() + 1; cittaAbitatiChiave = null; cittaAbitati();');
  assert.ok(letture > prime, 'con un modello del suolo nuovo le quote restano quelle vecchie');
  run('terreno.quando = 0;');
});

console.log('\n§3 — la collina davanti');

// La chiave della memoria resta quella vera — l'ha appena scritta `posto()`
// chiamando `cittaAbitati()` —: si sostituisce solo l'elenco, se no il
// disegno se lo ricalcola e si ritrova dentro anche i paesi che la prova
// aveva messo da parte.
function disegnaCon(ab, cresta, luce, focale) {
  ctx.__ab = ab;
  run('cittaAbitatiVista = __ab;');
  run(`skyCrestaFinta = ${cresta}; sky.luceCielo = ${luce === undefined ? 0 : luce};`);
  run('__tela = telaFinta();');
  run(`skyDisegnaAbitati(__tela, {}, ${focale === undefined ? 900 : focale}, null, 1);`);
  return run('__tela.punti');
}

// Le stesse condizioni, ma restituendo i tracciati invece dei cerchi: e'
// quello che serve alla macchia del costruito, che poligono e'.
function forme(ab, cresta, luce, focale) {
  disegnaCon(ab, cresta, luce, focale);
  return run('__tela.forme');
}

// La **macchia** fra i riempimenti, cioè il poligono che ha esattamente i
// punti del perimetro. Contare i `fill` in blocco non basta più da quando
// in mezzo alle case c'è il campanile, la cui guglia è un riempimento come
// un altro: un triangolo di tre punti verrebbe scambiato per un secondo
// paese, e la prova fallirebbe per un motivo che col paese non c'entra.
function macchie(f, ab) {
  return f.filter(x => x.tipo === 'fill' && x.punti.length === ab.bordo.length);
}

prova('senza niente davanti si disegna quello che da qui si risolve', () => {
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  const punti = disegnaCon(ab, -90);
  assert.ok(punti.length >= run('SKY_ABITATO_LUCI_MIN'), 'disegnate ' + punti.length);
  assert.ok(punti.length <= ab[0].luci.length, 'più luci del serbatoio');
});

prova('ingrandendo se ne aggiungono, e quelle di prima non si spostano', () => {
  // È la stessa proprietà di annidamento del passo delle colonne
  // dell'acqua: senza, a ogni pizzicata l'intero paese scivolerebbe.
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  const poche = disegnaCon(ab, -90, 0, 400);
  const tante = disegnaCon(ab, -90, 0, 4000);
  assert.ok(tante.length > poche.length,
    'a campo stretto non se ne aggiunge nessuna (' + poche.length + ' → ' + tante.length + ')');
  assert.ok(tante.length <= ab[0].luci.length);
  // Le prime `poche` del serbatoio devono essere le stesse: la scala cambia,
  // l'insieme no.
  for (let i = 0; i < poche.length; i++) {
    const a = (poche[i].x - 500) / (400 * Math.PI / 180);
    const b = (tante[i].x - 500) / (4000 * Math.PI / 180);
    assert.ok(Math.abs(a - b) < 1e-9, 'la luce ' + i + ' non è la stessa');
  }
});

prova('una cresta più alta del paese lo cancella', () => {
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  const punti = disegnaCon(ab, ab[0].altAlto + 0.5);
  assert.equal(punti.length, 0);
});

prova('una cresta a metà paese ne lascia la metà di sopra', () => {
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  const meta = (ab[0].altAlto + ab[0].altBasso) / 2;
  const quante = disegnaCon(ab, -90).length;      // quante se ne risolvono da qui
  const punti = disegnaCon(ab, meta);
  const sopra = ab[0].luci.slice(0, quante).filter(l => l.alt >= meta).length;
  assert.equal(punti.length, sopra, 'disegnate ' + punti.length + ' contro ' + sopra);
  assert.ok(sopra > 0 && sopra < quante, 'il banco non taglia niente');
});

prova('di giorno le luci non si disegnano', () => {
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  assert.equal(disegnaCon(ab, -90, 0.9).length, 0);
  assert.ok(disegnaCon(ab, -90, 0).length > 0);
});

console.log('\n§4 — il nome si appende al paese');

prova('dopo il disegno il paese sa dove ha il suo punto più alto', () => {
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  const quante = disegnaCon(ab, -90).length;
  const visto = run(`skyAbitatoVisto(${ab[0].lat}, ${ab[0].lon})`);
  assert.ok(visto, 'nessun abitato registrato');
  // Il punto più alto **fra quelli disegnati**, non fra quelli del
  // serbatoio: se le luci di sopra sono dietro a una cresta, il nome deve
  // stare sulle luci che si vedono e non sulla collina che le copre.
  const cima = Math.max(...ab[0].luci.slice(0, quante).map(l => l.alt));
  assert.ok(Math.abs(visto.alt - cima) < 1e-9,
    'aggancio a ' + visto.alt.toFixed(3) + ' invece che a ' + cima.toFixed(3));
});

prova('un paese coperto non lascia nessun aggancio: il nome torna alla cresta', () => {
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  disegnaCon(ab, ab[0].altAlto + 0.5);
  assert.equal(run(`skyAbitatoVisto(${ab[0].lat}, ${ab[0].lon})`), null);
});

prova('la chiave è il punto e non il nome', () => {
  // Due «San Martino» in due valli diverse: appendere il nome dell'uno alle
  // luci dell'altro resterebbe perfettamente plausibile sullo schermo.
  const a = run('skyAbitatoChiave(45.81, 9.08)');
  const b = run('skyAbitatoChiave(46.20, 9.40)');
  assert.notEqual(a, b);
});

console.log('\n§5 — la prospettiva aerea è la stessa dei nomi');

prova('le luci sbiadiscono con la stessa legge del nome che ci sta sopra', () => {
  // Se le due divergessero si vedrebbe come un difetto: un nome nitido
  // appoggiato a un paese che l'aria ha già cancellato.
  const vicino = run('skyLontananzaCitta(2)');
  const lontano = run('skyLontananzaCitta(45)');
  assert.ok(lontano > vicino && lontano <= 1 && vicino >= 0);
  const foschia = run('SKY_ABITATO_FOSCHIA');
  assert.ok(1 - lontano * foschia > 0, 'a quarantacinque chilometri non resta niente');
  assert.ok(1 - lontano * foschia < 1 - vicino * foschia);
});

prova('ingrandendo non spariscono né il terreno né il tappeto di luci', () => {
  // Lo zoom cambia la scala, non la visibilità: il rilievo serve proprio a
  // capire se un astro è dietro il crinale. Si prova la funzione vera agli
  // estremi, poi si passa quel valore fino alla vernice degli abitati.
  const fovPrima = run('sky.fov');
  for (const fov of [180, 30, 5, 1.5, 0.25]) {
    run(`sky.fov = ${fov}`);
    assert.equal(run('skyOpacitaTerreno()'), 1, `opacità a ${fov}°`);
  }
  run(`sky.fov = ${fovPrima}`);
  assert.ok(run('SKY_ABITATO_VELO_MIN') >= 0.2);
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  ctx.__ab = ab;
  run('cittaAbitatiVista = __ab; skyCrestaFinta = -90; sky.luceCielo = 0;');
  run('__tela = telaFinta(); skyDisegnaAbitati(__tela, {}, 300, null, skyOpacitaTerreno());');
  assert.ok(run('__tela.punti').length > 0, 'col terreno scompaiono tutte');
});

console.log('\n§6 — di giorno il paese si vede lo stesso');

prova('il perimetro contiene tutte le luci', () => {
  // È l'invariante che tiene insieme le due metà: di giorno si disegna il
  // bordo, di notte le lampade, e al crepuscolo si vedono insieme — una
  // lampada fuori dal bordo che di giorno la conteneva è una casa fuori dal
  // suo paese. Il giudice è un punto-dentro-poligono vero, non un confronto
  // di raggi: fra due vertici il bordo è una corda, e una corda passa più
  // dentro dell'arco.
  const M = 111195;
  const dentro = (px, py, poly) => {
    let d = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if ((yi > py) !== (yj > py) &&
          px < (xj - xi) * (py - yi) / (yj - yi) + xi) d = !d;
    }
    return d;
  };
  for (const nome of ['Vicino', 'Lontano']) {
    const forma = run(`cittaFormaDi(citta.elenco.find(c => c.nome === ${JSON.stringify(nome)}))`);
    const c = ctx.__paesi.find(x => x.nome === nome);
    const cos = Math.cos(c.lat * Math.PI / 180);
    const metri = (o) => ({ x: (o.lon - c.lon) * M * cos, y: (o.lat - c.lat) * M });
    const poly = forma.bordo.map(metri);
    assert.ok(poly.length >= 3, nome + ' non ha perimetro');
    let fuori = 0;
    for (const l of forma.luci) {
      const q = metri(l);
      if (!dentro(q.x, q.y, poly)) fuori++;
    }
    assert.equal(fuori, 0, nome + ': ' + fuori + ' luci su ' + forma.luci.length + ' fuori dal perimetro');
  }
});

prova('il perimetro non è un cerchio', () => {
  // Un'ellisse perfetta si legge subito per quello che è, un disegno.
  const a = posto(PAESI, 800, 300)[0];
  const M = 111195, cos = Math.cos(a.lat * Math.PI / 180);
  const forma = run(`cittaFormaDi(citta.elenco.find(c => c.nome === ${JSON.stringify(a.nome)}))`);
  const r = forma.bordo.map(b =>
    Math.hypot((b.lat - a.lat) * M, (b.lon - a.lon) * M * cos));
  const medio = r.reduce((x, y) => x + y, 0) / r.length;
  const scarto = Math.sqrt(r.reduce((x, y) => x + (y - medio) ** 2, 0) / r.length) / medio;
  assert.ok(scarto > 0.04, 'bordo troppo regolare: scarto ' + (scarto * 100).toFixed(1) + '%');
});

prova('di giorno si disegnano la macchia e il suo bordo, e nessuna luce', () => {
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  const f = forme(ab, -90, 0.9);
  assert.equal(run('__tela.punti').length, 0, 'di giorno si accendono le lampade');
  const riempimenti = macchie(f, ab[0]);
  const contorni = f.filter(x => x.tipo === 'stroke');
  assert.equal(riempimenti.length, 1, 'macchie disegnate: ' + riempimenti.length);
  assert.equal(contorni.length, 1, 'perimetri disegnati: ' + contorni.length);
  assert.equal(riempimenti[0].punti.length, ab[0].bordo.length,
    'il poligono non ha i punti del perimetro');
});

prova('di notte si accendono le luci e la macchia non si disegna', () => {
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  const f = forme(ab, -90, 0);
  assert.ok(run('__tela.punti').length > 0, 'di notte non si accende niente');
  assert.equal(f.filter(x => x.tipo === 'stroke').length, 0,
    'di notte si disegna il contorno del costruito');
});

prova('al crepuscolo si vedono tutte e due', () => {
  const meta = run('SKY_CITTA_LUCE_MAX') / 2;
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  const f = forme(ab, -90, meta);
  assert.ok(run('__tela.punti').length > 0, 'nessuna luce a mezza luce');
  assert.ok(f.some(x => x.tipo === 'stroke'), 'nessun perimetro a mezza luce');
});

prova('di giorno il nome si appende al paese', () => {
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  disegnaCon(ab, -90, 0.9);
  const visto = run(`skyAbitatoVisto(${ab[0].lat}, ${ab[0].lon})`);
  assert.ok(visto, 'nessun aggancio di giorno');
  // L'aggancio è il punto più alto di quello che si è **disegnato**, e da
  // quando le case sono volumi quel punto è un tetto e non il prato: il
  // suolo del paese sta più in basso, e un nome appoggiato lì galleggia a
  // mezz'altezza delle case che dovrebbe nominare.
  const suolo = Math.max(...ab[0].bordo.map(b => b.alt));
  const tetto = Math.max(...ab[0].luci.map(l => l.altCima),
    ab[0].torre ? ab[0].torre.altCima : -90);
  assert.ok(visto.alt > suolo,
    'il nome sta sul prato: ' + visto.alt.toFixed(3) + ' contro ' + suolo.toFixed(3));
  assert.ok(visto.alt <= tetto + 1e-9,
    'il nome sta sopra al tetto più alto: ' + visto.alt.toFixed(3));
});

prova('una cresta più alta del paese lo copre anche di giorno', () => {
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  const f = forme(ab, ab[0].altAlto + 0.5, 0.9);
  assert.equal(f.filter(x => x.tipo === 'fill' || x.tipo === 'stroke').length, 0,
    'la macchia si disegna sopra alla collina che la copre');
  assert.equal(run(`skyAbitatoVisto(${ab[0].lat}, ${ab[0].lon})`), null);
});

prova('la collina davanti ritaglia la macchia invece di tosarla via', () => {
  // Con una cresta a metà paese il poligono si disegna comunque — intero —
  // e a togliergli la parte nascosta è il **ritaglio**: è la differenza fra
  // un bordo frastagliato dove spunta il dosso e un paese che sparisce.
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  const meta = (ab[0].altAlto + ab[0].altBasso) / 2;
  const f = forme(ab, meta, 0.9);
  assert.equal(macchie(f, ab[0]).length, 1, 'la macchia non si disegna');
  const clip = f.filter(x => x.tipo === 'clip');
  assert.equal(clip.length, 1, 'ritagli: ' + clip.length);
  assert.ok(clip[0].punti.length >= 6, 'il ritaglio non è una fascia');
});

prova('senza terreno non si ritaglia niente', () => {
  // Quando la cresta non c'è non c'è nemmeno niente che copra: ritagliare
  // vorrebbe dire inventarsi una collina.
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  run('skyCrestaFinta = null;');
  ctx.__ab = ab;
  run('cittaAbitatiVista = __ab; sky.luceCielo = 0.9; __tela = telaFinta();');
  run('skyDisegnaAbitati(__tela, {}, 900, null, 1);');
  const f = run('__tela.forme');
  assert.equal(f.filter(x => x.tipo === 'clip').length, 0, 'ritaglia senza terreno');
  assert.equal(macchie(f, ab[0]).length, 1, 'non disegna la macchia');
  run('skyCrestaFinta = 0;');
});

prova('i tetti si disegnano solo quando si risolvono', () => {
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  const stretto = forme(ab, -90, 0.9, 40).filter(x => x.tipo === 'rect').length;
  const largo = forme(ab, -90, 0.9, 4000).filter(x => x.tipo === 'rect').length;
  assert.equal(stretto, 0, 'a campo largo disegna ' + stretto + ' tetti');
  assert.ok(largo > 10, 'ingrandendo i tetti restano ' + largo);
});



// --- §7. Le case stanno in piedi --------------------------------------
//
// I quadratini piatti di prima erano già «più realistici» di una macchia
// sola, e questo è il punto: **qualunque** mucchio di rettangolini
// appoggiato su un pendio somiglia a un paese. Nessuno, guardando lo
// schermo, dice «questa casa è alta il doppio del vero» o «questa parete
// prende il sole dalla parte sbagliata» — dice «carino». Un tetto dipinto
// controluce è ancora una bella immagine; un edificio alto tre volte
// tanto fa un paese di grattacieli che si legge come un paese di
// grattacieli e non come un errore.
//
// Il giudice è quindi l'aritmetica, e le domande sono quelle che una
// figura non può fare: l'altezza sullo schermo è quella che la geometria
// impone? cala come la distanza? il centro è più alto della periferia? il
// tetto si apre guardando dall'alto e si chiude guardando dal piano? la
// parete cambia colore girando il Sole?

console.log('\n§7 — le case stanno in piedi');

// I rettangoli disegnati, che sono le pareti e i tetti: la tela finta li
// registra come `rect` e non li mescola con i poligoni.
function mattoni(ab, cresta, luce, focale) {
  return forme(ab, cresta, luce, focale).filter(x => x.tipo === 'rect');
}

// La scala del planetario finto: `skyProietta` mette `py = 350 - alt·k`,
// quindi un grado vale `focale · π/180` pixel e un'altezza in pixel si
// riconverte in gradi dividendo per quello.
const GRADI_PX = f => (f === undefined ? 900 : f) * Math.PI / 180;

prova('un edificio è alto sullo schermo quanto la geometria impone', () => {
  const ab = posto(PAESI, 300, 300).filter(a => a.nome === 'Vicino');
  const l = ab[0].luci[0];
  assert.ok(l.h === undefined, 'la luce non deve portare i metri fino al disegno');
  // La cima e la base sono due `terrenoAngolo` con la stessa distanza:
  // la loro differenza è l'altezza dell'edificio vista da qui.
  const atteso = l.altCima - l.alt;
  assert.ok(atteso > 0, 'la cima non sta sopra la base: ' + atteso);
  // Un edificio a dieci chilometri alto fra i sei e i trenta metri sta fra
  // questi due angoli — è il controllo che i metri non siano diventati
  // chilometri per strada, che è l'errore che nessuno vede sullo schermo.
  const metri = atteso * Math.PI / 180 * l.km * 1000;
  assert.ok(metri > 4 && metri < 40, 'altezza in metri: ' + metri.toFixed(1));
});

prova('lo stesso paese, due volte più lontano, ha case due volte più basse', () => {
  const vicino = posto([{ nome: 'A', lat: QUI.lat, lon: QUI.lon + 5 * KM / Math.cos(QUI.lat * Math.PI / 180), abitanti: 12000 }], 300, 300);
  const lontano = posto([{ nome: 'A', lat: QUI.lat, lon: QUI.lon + 10 * KM / Math.cos(QUI.lat * Math.PI / 180), abitanti: 12000 }], 300, 300);
  // Lo stesso paese: le stesse case, perché il seme viene dalle coordinate…
  // che però qui cambiano. Si confrontano allora le mediane, che di un
  // paese di uguali abitanti sono la stessa cosa a meno del sorteggio.
  const med = ab => {
    const v = ab[0].luci.map(l => l.altCima - l.alt).sort((a, b) => a - b);
    return v[v.length >> 1];
  };
  const r = med(vicino) / med(lontano);
  assert.ok(r > 1.6 && r < 2.5, 'rapporto delle altezze: ' + r.toFixed(2));
});

prova('il centro è più alto della periferia', () => {
  const ab = posto([{ nome: 'Grande', lat: QUI.lat + 8 * KM, lon: QUI.lon, abitanti: 150000 }], 300, 300);
  const luci = ab[0].luci;
  // La distanza dal centro dell'abitato, in gradi di scarto: il sorteggio
  // mette il nucleo principale nel mezzo.
  const dentro = luci.filter(l => Math.abs(l.scarto) < ab[0].semiAz * 0.35);
  const fuori = luci.filter(l => Math.abs(l.scarto) > ab[0].semiAz * 0.7);
  assert.ok(dentro.length > 3 && fuori.length > 3,
    'campioni: ' + dentro.length + '/' + fuori.length);
  const media = v => v.reduce((s, l) => s + (l.altCima - l.alt), 0) / v.length;
  assert.ok(media(dentro) > media(fuori) * 1.15,
    'centro ' + media(dentro).toFixed(4) + ' contro periferia ' + media(fuori).toFixed(4));
});

prova('una città ha case più alte di un paese', () => {
  const dieci = 10 * KM / Math.cos(QUI.lat * Math.PI / 180);
  const alt = ab => {
    const v = ab[0].luci.map(l => l.altCima - l.alt).sort((a, b) => a - b);
    return v[v.length >> 1];
  };
  const paese = posto([{ nome: 'P', lat: QUI.lat, lon: QUI.lon + dieci, abitanti: 900 }], 300, 300);
  const citta = posto([{ nome: 'C', lat: QUI.lat, lon: QUI.lon + dieci, abitanti: 400000 }], 300, 300);
  assert.ok(alt(citta) > alt(paese) * 1.7,
    'paese ' + alt(paese).toFixed(4) + ' contro città ' + alt(citta).toFixed(4));
});

prova('sotto la soglia un edificio è una chiazza e non un volume', () => {
  // A campo largo un edificio è mezzo pixel: disegnarne la parete **e** il
  // tetto vuol dire due mezzi pixel uno sopra l'altro, cioè il doppio del
  // costo per una macchia più sporca di un quadratino solo.
  const ab = posto(PAESI, 300, 300).filter(a => a.nome === 'Vicino');
  // Le due focali sono quelle vere del planetario: 300 è un grandangolo,
  // 4000 è il campo di un binocolo. La misura che conta è una sola, e la
  // porta la geometria: una casa di quindici metri a dieci chilometri è
  // alta cinque centesimi di grado, quindi finché un grado non vale
  // trentacinque pixel quella casa **è** un punto.
  const larghi = mattoni(ab, -90, 0.9, 4000);
  const stretti = mattoni(ab, -90, 0.9, 300);
  assert.ok(stretti.length > 0, 'a campo largo non disegna niente');
  // A campo largo ogni casa è **un** rettangolo (la chiazza, col colore del
  // suo tetto); ingrandendo ne diventano due, la parete e il tetto.
  assert.ok(larghi.length > stretti.length * 1.4,
    'rettangoli: ' + stretti.length + ' a campo largo, ' + larghi.length + ' ingranditi');
  const quadrati = stretti.filter(r => Math.abs(r.w - r.h) < 1e-9);
  assert.equal(quadrati.length, stretti.length,
    'a campo largo qualcosa è già un volume');
});

prova('ingrandendo compaiono i volumi e le case non si spostano', () => {
  const ab = posto(PAESI, 300, 300).filter(a => a.nome === 'Vicino');
  const centro = r => r.x + r.w / 2;
  const a = mattoni(ab, -90, 0.9, 400).map(centro).sort((x, y) => x - y);
  const b = mattoni(ab, -90, 0.9, 900).map(centro).sort((x, y) => x - y);
  // Il planetario finto scala i pixel colla focale, quindi si confrontano
  // gli **azimut**: (px − 500) / k + azVista.
  const az = (v, f) => v.map(x => (x - 500) / GRADI_PX(f));
  const A = az(a, 400), B = az(b, 900);
  assert.ok(B.length >= A.length, 'ingrandendo se ne perdono');
  // Ogni casa del campo largo ha la sua gemella in quello stretto, allo
  // stesso azimut: le prime del serbatoio sono sempre le stesse.
  for (const x of A) {
    assert.ok(B.some(y => Math.abs(y - x) < 1e-6),
      'una casa si è spostata di azimut: ' + x.toFixed(6));
  }
});

prova('la cresta taglia sulla cima, non sulla base', () => {
  // Una casa la cui gronda spunta dietro al dosso **si vede**, ed è proprio
  // così che si vede un paese in una conca: tagliando sulla base sparirebbe
  // tutto il primo filare.
  const ab = posto(PAESI, 300, 300).filter(a => a.nome === 'Vicino');
  const l = ab[0].luci.slice(0, 40).sort((a, b) => b.altCima - a.altCima)[0];
  // Una cresta fra la base e la cima di quella casa.
  const meta = (l.alt + l.altCima) / 2;
  const con = mattoni(ab, meta, 0.9, 4000);
  assert.ok(con.length > 0, 'con la cresta a mezza casa non si disegna niente');
  // Alzandola sopra la cima più alta non resta nessun mattone.
  const cima = Math.max(...ab[0].luci.map(x => x.altCima),
    ab[0].torre ? ab[0].torre.altCima : -90);
  assert.equal(mattoni(ab, cima + 0.05, 0.9, 4000).length, 0,
    'una cresta sopra tutte le cime lascia dei mattoni');
});

prova('il tetto si apre guardando dall\'alto e si chiude dal piano', () => {
  // È geometria e non una scelta: un tetto è orizzontale, quindi guardato
  // di taglio non si vede e guardato dall'alto si proietta. Il
  // contro-esempio è una falda dichiarata, che dalla pianura disegnerebbe
  // dei tetti che da lì non si vedono.
  const paese = [{ nome: 'Sotto', lat: QUI.lat, lon: QUI.lon + 3 * KM / Math.cos(QUI.lat * Math.PI / 180), abitanti: 12000 }];
  // Dal piano: occhio e suolo alla stessa quota, il paese è sull'orizzonte.
  const abPiano = posto(paese, 300, 300);
  run(`skyAltVista = ${(abPiano[0].altAlto + abPiano[0].altBasso) / 2};`);
  const piano = mattoni(abPiano, -90, 0.9, 4000);
  // Da un monte: ottocento metri sopra, il paese sta molto sotto la linea —
  // e ci si punta la vista, se no casca fuori dal riquadro e la prova
  // misura un riquadro vuoto.
  const abMonte = posto(paese, 1100, 300);
  run(`skyAltVista = ${(abMonte[0].altAlto + abMonte[0].altBasso) / 2};`);
  const monte = mattoni(abMonte, -90, 0.9, 4000);
  run('skyAltVista = 0;');
  const largo = v => v.reduce((s, r) => s + r.h, 0) / Math.max(1, v.length);
  assert.ok(piano.length > 0 && monte.length > 0, 'niente disegnato');
  // Dall'alto l'ingombro verticale di ogni casa è maggiore, perché ci si
  // aggiunge il tetto che dal piano non c'era.
  assert.ok(monte.length > piano.length,
    'dall\'alto non compare nessun tetto: ' + piano.length + ' → ' + monte.length);
});

prova('la parete cambia faccia girando il Sole', () => {
  const ab = posto(PAESI, 300, 300).filter(a => a.nome === 'Vicino');
  // Il paese è a est (azimut 90). Sole a est: controluce, pareti in ombra.
  run('skyLuceFinta = { az: 90, forza: 1 };');
  const controluce = forme(ab, -90, 0.9, 4000).filter(x => x.tipo === 'rect');
  // Sole a ovest: il Sole è alle spalle e le pareti sono in piena luce.
  run('skyLuceFinta = { az: 270, forza: 1 };');
  const inLuce = forme(ab, -90, 0.9, 4000).filter(x => x.tipo === 'rect');
  const chiaro = v => {
    // Dalla stringa `rgba(r, g, b, a)` si legge il rosso, che fra i due
    // grigi dell'intonaco è quello che si muove di più.
    const m = v.map(r => +String(r.stile).match(/rgba?\((\d+)/)[1]);
    return m.reduce((s, x) => s + x, 0) / m.length;
  };
  assert.ok(chiaro(inLuce) > chiaro(controluce) + 12,
    'controluce ' + chiaro(controluce).toFixed(1) + ' contro sole ' + chiaro(inLuce).toFixed(1));
  // Senza nessun astro non si inventa una faccia illuminata: resta il
  // grigio del controluce, che è quello di una giornata coperta.
  run('skyLuceFinta = null;');
  const coperto = forme(ab, -90, 0.9, 4000).filter(x => x.tipo === 'rect');
  assert.ok(chiaro(coperto) <= chiaro(controluce) + 1,
    'senza Sole si illumina qualcosa: ' + chiaro(coperto).toFixed(1));
  run('skyLuceFinta = { az: 270, forza: 0.8 };');
});

prova('il campanile spunta sopra le case, con la sua guglia', () => {
  const ab = posto(PAESI, 300, 300).filter(a => a.nome === 'Vicino');
  const t = ab[0].torre;
  assert.ok(t, 'il paese non ha un campanile');
  const suo = t.altCima - t.alt;
  const case_ = ab[0].luci.map(l => l.altCima - l.alt).sort((a, b) => b - a);
  assert.ok(suo > case_[0], 'il campanile non è il più alto: ' +
    suo.toFixed(4) + ' contro ' + case_[0].toFixed(4));
  // La guglia è un triangolo: tre punti, e sta **sopra** al fusto.
  const f = forme(ab, -90, 0.9, 4000);
  const tri = f.filter(x => x.tipo === 'fill' && x.punti.length === 3);
  assert.equal(tri.length, 1, 'guglie disegnate: ' + tri.length);
  const cima = Math.min(...tri[0].punti.map(p => p.y));
  const base = Math.max(...tri[0].punti.map(p => p.y));
  assert.ok(base > cima, 'la guglia non ha altezza');
  // La punta è una sola, la base due: è un triangolo isoscele in piedi.
  const inCima = tri[0].punti.filter(p => Math.abs(p.y - cima) < 1e-9);
  assert.equal(inCima.length, 1, 'la guglia ha la punta in giù');
});



prova('le vernici sono tre per paese, non due per casa', () => {
  // Un banco di prova non è un cronometro — la stessa pagina su due
  // macchine darebbe due numeri diversi — quindi non si misura il tempo: si
  // misura l'**aritmetica** da cui quel tempo dipende. Ogni
  // `skyRgba(skyMescolaColore(...))` è una mescola e una stringa nuova, e
  // farne due per edificio voleva dire settecento stringhe per un paese
  // ingrandito a ogni fotogramma: misurato, era metà del costo di questa
  // funzione. Nessuna delle vernici dipende dalla singola casa, quindi il
  // numero di stili diversi che arrivano alla tela è **limitato** e non
  // cresce col numero delle case.
  const ab = posto(PAESI, 300, 300).filter(a => a.nome === 'Vicino');
  const m = mattoni(ab, -90, 0.9, 4000);
  assert.ok(m.length > 30, 'troppe poche case per giudicare: ' + m.length);
  const stili = new Set(m.map(r => r.stile));
  assert.ok(stili.size <= 5, 'stili diversi: ' + stili.size + ' su ' + m.length + ' case');
});

prova('le case fuori dal riquadro non si disegnano', () => {
  // A forte ingrandimento di un paese si vede un pezzo, non tutto: pagare
  // per intero anche le case che stanno fuori dallo schermo è lavoro che
  // non cambia un pixel. Si guarda in una direzione in cui il paese non
  // c'è, e si pretende che non arrivi niente alla vernice.
  const ab = posto(PAESI, 300, 300).filter(a => a.nome === 'Vicino');
  const dentro = mattoni(ab, -90, 0.9, 4000);
  assert.ok(dentro.length > 0, 'puntando il paese non si disegna niente');
  // Il paese è a est ed è largo sei gradi: girando la vista di venti gradi
  // non ne resta in quadro nemmeno la periferia (a questa scala un grado
  // vale settanta pixel, e lo schermo è largo mille).
  run('skyAzVista = 110;');
  const fuori = mattoni(ab, -90, 0.9, 4000);
  run('skyAzVista = 90;');
  assert.equal(fuori.length, 0, 'disegna ' + fuori.length + ' case fuori dallo schermo');
});

prova('allo zoom estremo gli abitati non diventano blocchi a tutto schermo', () => {
  const ab = posto(PAESI, 300, 300).filter(a => a.nome === 'Vicino');

  // A tre gradi il paese e i suoi edifici sono ancora leggibili.
  run('sky.fov = SKY_ABITATO_FOV_PIENO;');
  assert.ok(forme(ab, -90, 0.9, 4000).length > 0,
    'gli abitati spariscono prima dello zoom estremo');

  // Sotto un grado e mezzo la geometria sintetica non contiene dettaglio
  // aggiuntivo: proiettarla produceva i rettangoli e le bande della
  // segnalazione. Il terreno reale resta disegnato da rilievo.js.
  run('sky.fov = SKY_ABITATO_FOV_SPENTO;');
  assert.equal(forme(ab, -90, 0.9, 4000).length, 0,
    'restano sagome di edifici allo zoom estremo');
  assert.equal(run('skyAbitatiVisti'), null,
    'resta un aggancio invisibile per il nome del paese');

  run('sky.fov = 60;');
});

// --- §8. La città, e poi i suoi quartieri -----------------------------
//
// Un quartiere è la cosa più facile da nominare male, perché il nome
// sbagliato **non sembra sbagliato**: «Navigli» scritto sopra all'orizzonte
// di Milano è un nome vero, in un posto vero, e chi guarda non ha modo di
// sapere che al suo posto ci sarebbe dovuto essere «Milano». Il sintomo,
// se si sbaglia, non è un errore: è una carta geografica letta alla scala
// di un'altra — tutti i nomi giusti, nessuno alla scala giusta.
//
// E la forza non basta a decidere: un quartiere sta per definizione più
// vicino della città che lo contiene, quindi in una classifica di abitanti
// diviso distanza al quadrato i rioni battono la città **sempre**. La
// misura giusta è quanto largo viene sullo schermo, ed è quella che si
// prova qui — insieme al contro-esempio, cioè cosa sceglierebbe una
// passata sola.

console.log('\n§8 — la città, e poi i suoi quartieri');

// Una città con tre quartieri dentro e un paese vero accanto. Le distanze
// sono quelle di una periferia: la città a dodici chilometri, i suoi rioni
// dentro di lei, il paese a sei.
const EST = KM / Math.cos(QUI.lat * Math.PI / 180);
// Gli scostamenti laterali sono quelli veri di una città grande (un
// chilometro e mezzo fra un quartiere e l'altro) e non una comodità: con i
// rioni tutti addosso al centro le loro etichette si contenderebbero la
// stessa fascia di cielo a prescindere dalla gerarchia, e la prova
// misurerebbe l'impacchettamento invece della regola.
const CITTA_PROVA = [
  { nome: 'Cittagrande', lat: QUI.lat, lon: QUI.lon + 12 * EST,
    abitanti: 400000, specie: 'city' },
  { nome: 'Rione Uno', lat: QUI.lat + 1.6 * KM, lon: QUI.lon + 11.8 * EST,
    abitanti: 26000, specie: 'suburb' },
  { nome: 'Rione Due', lat: QUI.lat - 1.6 * KM, lon: QUI.lon + 11.8 * EST,
    abitanti: 24000, specie: 'suburb' },
  { nome: 'Rione Tre', lat: QUI.lat - 3.4 * KM, lon: QUI.lon + 12 * EST,
    abitanti: 9000, specie: 'quarter' },
  { nome: 'Paesello', lat: QUI.lat + 3 * KM, lon: QUI.lon + 6 * EST,
    abitanti: 3000, specie: 'village' }
];

// I nomi scritti davvero, a un dato campo visivo. `skyNomiCitta` è quella
// vera: le scritte si registrano invece di dipingerle.
function nomiA(fov, paesi) {
  ctx.__paesi = paesi || CITTA_PROVA;
  run(`citta.acceso = true; citta.grezze = __paesi;
       citta.stato = 'pronto'; citta.fonte = 'prova';
       citta.elenco = cittaPrepara(citta.grezze, ${QUI.lat}, ${QUI.lon}, null);
       citta.vistaChiave = cittaChiaveVista(${QUI.lat}, ${QUI.lon});`);
  ctx.terrenoPuntoDaDisegnare = () => QUI;
  run(`sky.fov = ${fov}; sky.luceCielo = 0.9; skyScritte = [];
       skyAbitatiVisti = null; __tela = telaFinta();
       skyNomiCitta(__tela, {}, 900, []);`);
  return run('skyScritte');
}

const scritto = (nomi, chi) => nomi.some(s => s.testo === chi);
const corpoDi = (nomi, chi) => {
  const v = nomi.find(s => s.testo === chi);
  return v ? +(/(\d+(?:\.\d+)?)px/.exec(v.font) || [0, 0])[1] : 0;
};

prova('un quartiere si riconosce come parte, e sa di chi è', () => {
  posto(CITTA_PROVA, 300, 300);
  const el = run('citta.elenco');
  const uno = el.find(c => c.nome === 'Rione Uno');
  const grande = el.find(c => c.nome === 'Cittagrande');
  const paese = el.find(c => c.nome === 'Paesello');
  assert.ok(uno.parte, 'il rione non è riconosciuto come parte');
  assert.equal(uno.padre, 'Cittagrande', 'padre: ' + uno.padre);
  assert.ok(!grande.parte, 'la città è una parte');
  assert.equal(grande.padre, null, 'la città ha un padre');
  assert.ok(!paese.parte, 'un paese vero è una parte');
});

prova('un quartiere lontano da ogni città non è di nessuno', () => {
  // Capita, e capita spesso: un `suburb` mappato in mezzo alla campagna, o
  // la cui città sta fuori dal raggio della ricerca. Dedurgli un padre
  // qualunque vorrebbe dire scriverlo sotto al nome sbagliato.
  const orfano = [{ nome: 'Sperduto', lat: QUI.lat + 9 * KM, lon: QUI.lon,
                    abitanti: 20000, specie: 'suburb' }].concat(CITTA_PROVA);
  posto(orfano, 300, 300);
  const c = run('citta.elenco').find(x => x.nome === 'Sperduto');
  assert.ok(c.parte, 'non è una parte');
  assert.equal(c.padre, null, 'padre inventato: ' + c.padre);
});

prova('a grandangolo si legge la città e non i suoi rioni', () => {
  const nomi = nomiA(70);
  assert.ok(scritto(nomi, 'Cittagrande'), 'la città non è nominata');
  assert.ok(scritto(nomi, 'Paesello'), 'il paese vero non è nominato');
  for (const r of ['Rione Uno', 'Rione Due', 'Rione Tre']) {
    assert.ok(!scritto(nomi, r), r + ' è nominato a settanta gradi di campo');
  }
});

prova('il contro-esempio: la forza mette i rioni davanti ai paesi veri', () => {
  // La regola di prima, coi numeri. Contro la **città** la forza non
  // sbaglia — gli abitanti contano alla 1,2, e quattrocentomila battono
  // ventiseimila anche da tre volte più lontano. Sbaglia contro i **paesi**:
  // un rione di una città vicina batte un paese vero di qualche migliaio di
  // anime, quindi con una passata sola i posti di un grandangolo se li
  // prendono i rioni e dall'orizzonte spariscono i paesi — che sono gli
  // unici nomi che a quella scala ci sia senso leggere.
  posto(CITTA_PROVA, 300, 300);
  const el = run('citta.elenco');
  const dove = nome => el.findIndex(c => c.nome === nome);
  assert.ok(dove('Rione Uno') < dove('Paesello'),
    'i rioni non battono i paesi in forza');
  assert.ok(dove('Cittagrande') < dove('Rione Uno'),
    'la città non batte i suoi rioni in forza');
  // E il secondo mezzo del difetto: i rioni stanno **addosso** alla città,
  // quindi anche quando la città vince la scelta può perdere la
  // prenotazione del posto — sono più vicini, e il posto lo prende chi sta
  // davanti. È per questo che nel `sort` la gerarchia viene prima della
  // distanza.
  const nomi = nomiA(8);
  assert.ok(scritto(nomi, 'Cittagrande'),
    'il nome della città l\'ha preso un suo rione');
});

prova('ingrandendo i quartieri compaiono, e la città resta', () => {
  const nomi = nomiA(8);
  assert.ok(scritto(nomi, 'Rione Uno'), 'a otto gradi i rioni non compaiono');
  assert.ok(scritto(nomi, 'Cittagrande'),
    'ingrandendo la città perde il suo nome');
});

prova('avvicinandosi un quartiere compare, a campo fermo', () => {
  // La soglia non è lo zoom: è la larghezza apparente. Lo stesso rione,
  // allo stesso campo visivo, si nomina da vicino e non da lontano — che è
  // quello che succede arrivando in una città in macchina.
  const lontano = [{ nome: 'Rione', lat: QUI.lat, lon: QUI.lon + 40 * EST,
                     abitanti: 26000, specie: 'suburb' }];
  const vicino = [{ nome: 'Rione', lat: QUI.lat, lon: QUI.lon + 3 * EST,
                    abitanti: 26000, specie: 'suburb' }];
  assert.ok(!scritto(nomiA(45, lontano), 'Rione'),
    'un rione a quaranta chilometri si nomina a quarantacinque gradi');
  assert.ok(scritto(nomiA(45, vicino), 'Rione'),
    'un rione a tre chilometri non si nomina');
});

prova('il nome di una città è più grande di quello di un suo rione', () => {
  const nomi = nomiA(8);
  const grande = corpoDi(nomi, 'Cittagrande');
  const rione = corpoDi(nomi, 'Rione Uno');
  assert.ok(grande > 0 && rione > 0, 'corpi: ' + grande + ' / ' + rione);
  assert.ok(grande > rione * 1.15,
    'città ' + grande.toFixed(1) + ' contro rione ' + rione.toFixed(1));
});

prova('su un rione il numero dei chilometri non si scrive', () => {
  // È la stessa distanza della sua città, scritta una seconda volta a tre
  // centimetri di distanza. A campo stretto tutti gli **abitati** ce l'hanno.
  const nomi = nomiA(20);
  assert.ok(nomi.some(s => / km$/.test(s.testo)), 'nessun numero scritto');
  const dopo = (chi) => {
    const i = nomi.findIndex(s => s.testo === chi);
    return i >= 0 && i + 1 < nomi.length && / km$/.test(nomi[i + 1].testo);
  };
  assert.ok(dopo('Cittagrande'), 'la città non porta la sua distanza');
  if (scritto(nomi, 'Rione Uno')) {
    assert.ok(!dopo('Rione Uno'), 'il rione porta la distanza della sua città');
  }
});

prova('un quartiere non disegna il perimetro del costruito', () => {
  // Quel contorno è «dove finisce il costruito e ricomincia la campagna», e
  // un rione non ha quel confine: tirarlo vuol dire una riga in mezzo alle
  // case dove non finisce niente.
  const ab = posto(CITTA_PROVA, 300, 300);
  const rione = ab.filter(a => a.nome === 'Rione Uno');
  const grande = ab.filter(a => a.nome === 'Cittagrande');
  assert.ok(rione.length && grande.length, 'gli abitati di prova non ci sono');
  assert.equal(forme(rione, -90, 0.9).filter(x => x.tipo === 'stroke').length, 0,
    'il rione disegna un perimetro');
  assert.equal(forme(grande, -90, 0.9).filter(x => x.tipo === 'stroke').length, 1,
    'la città non disegna il suo perimetro');
});

prova('un quartiere copre meno della città che lo contiene', () => {
  // Due fondi a opacità piena uno sopra l'altro fanno una chiazza più scura
  // al centro di ogni abitato grande, cioè un alone attorno a niente.
  const ab = posto(CITTA_PROVA, 300, 300);
  const alfa = nome => {
    const a = ab.filter(x => x.nome === nome);
    const m = macchie(forme(a, -90, 0.9), a[0]);
    return +/rgba?\([^)]*,\s*([\d.]+)\)/.exec(m[0].stile)[1];
  };
  assert.ok(alfa('Rione Uno') < alfa('Cittagrande') * 0.6,
    'rione ' + alfa('Rione Uno') + ' contro città ' + alfa('Cittagrande'));
});

prova('i quartieri non rubano il posto ai paesi fra quelli disegnati', () => {
  // Il tetto degli abitati disegnati è quattordici, e i rioni stanno più
  // vicini: con un tetto solo, arrivando in una città i suoi rioni se li
  // prendevano tutti e i paesi attorno sparivano insieme.
  const molti = [];
  for (let i = 0; i < 20; i++) {
    molti.push({ nome: 'Rione ' + i, abitanti: 26000, specie: 'suburb',
      lat: QUI.lat + (i % 5 - 2) * 0.4 * KM,
      lon: QUI.lon + (12 + (i % 3) * 0.4) * EST });
  }
  molti.push({ nome: 'Cittagrande', lat: QUI.lat, lon: QUI.lon + 12 * EST,
    abitanti: 400000, specie: 'city' });
  for (let i = 0; i < 6; i++) {
    molti.push({ nome: 'Paese ' + i, abitanti: 5000, specie: 'village',
      lat: QUI.lat + (3 + i) * KM, lon: QUI.lon + 3 * EST });
  }
  const ab = posto(molti, 300, 300);
  const paesi = ab.filter(a => !a.parte).length;
  const parti = ab.filter(a => a.parte).length;
  assert.ok(paesi >= 7, 'abitati interi disegnati: ' + paesi);
  assert.ok(parti > 0 && parti <= run('CITTA_PARTI_MAX'),
    'parti disegnate: ' + parti);
});

prova('un salvataggio senza specie non produce nessun quartiere', () => {
  // Chi ha già dei paesi in `localStorage` se li tiene: `cittaEParte` di
  // niente risponde «no», e quei nodi tornano a essere abitati autonomi —
  // che è come erano trattati il giorno in cui sono stati salvati.
  const vecchi = CITTA_PROVA.map(c => ({ nome: c.nome, lat: c.lat, lon: c.lon,
    abitanti: c.abitanti }));
  posto(vecchi, 300, 300);
  const el = run('citta.elenco');
  assert.equal(el.filter(c => c.parte).length, 0, 'inventa delle parti');
  for (const c of el) assert.equal(c.rango, 2, 'rango inventato: ' + c.rango);
});

console.log('\n' + passate + ' passate, ' + fallite + ' fallite');
process.exit(fallite ? 1 : 0);
