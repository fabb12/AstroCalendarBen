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
for (const nome of ['skyDisegnaAbitati', 'skyAbitatoVisto', 'skyAbitatoChiave',
                    'skyLontananzaCitta']) {
  const m = app.match(new RegExp('^function ' + nome + '\\([\\s\\S]*?^\\}', 'm'));
  assert.ok(m, 'non trovo ' + nome + ' in app.js');
  run(m[0]);
}
for (const cost of ['SKY_ABITATO_CRESTA_PX', 'SKY_ABITATO_CRESTA_MIN', 'SKY_ABITATO_CRESTA_MAX',
                    'SKY_ABITATO_FOSCHIA', 'SKY_ABITATO_VELO_MIN', 'SKY_ABITATO_PUNTO_MIN',
                    'SKY_ABITATO_PUNTO_MAX', 'SKY_ABITATO_TINTA_FREDDA',
                    'SKY_ABITATO_PASSO_PX', 'SKY_ABITATO_LUCI_MIN',
                    'SKY_ABITATO_LETTO_ALFA', 'SKY_CITTA_LUCE_MAX', 'SKY_FOSCHIA_KM']) {
  const m = app.match(new RegExp('^const ' + cost + ' = [^;]+;', 'm'));
  assert.ok(m, 'non trovo ' + cost);
  run(m[0]);
}
run(app.match(/^const SKY_ABITATO_TINTE = \[[\s\S]*?^\];/m)[0]);
run('let skyAbitatiVisti = null;');
run('const SKY_D2R = Math.PI / 180;');

// Il planetario finto: una proiezione gnomonica che basta e avanza — qui
// non si giudica *dove* finiscono i pixel, si giudica **quali** luci
// arrivano a essere disegnate e con che altezza.
run(`
  var sky = { larghezza: 1000, altezza: 700, luceCielo: 0, fov: 60 };
  var skyCrestaFinta = 0;
  // Dove guarda il planetario finto: le luci fuori dal riquadro non si
  // disegnano, ed è giusto — ma una prova che non punta il paese non prova
  // niente, e lo fa in silenzio.
  var skyAzVista = 90;
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
    return { davanti: true, d: 1, px: 500 + s * k, py: 350 - v.alt * k,
             az: v.az, alt: v.alt };
  }
  function skyScalaLocale() { return 1; }
  function skyCrestaDisegnataEntro(az, km) { return skyCrestaFinta; }
  function telaFinta() {
    const punti = [];
    return { punti,
      save() { this._liv++; }, restore() { this._liv--; },
      translate() {}, scale() {}, beginPath() {},
      fill() {}, set fillStyle(v) { this._f = v; }, get fillStyle() { return this._f; },
      set globalCompositeOperation(v) {}, get globalCompositeOperation() { return ''; },
      createRadialGradient: () => ({ addColorStop() {} }),
      // Le luci si disegnano dentro al primo save() della funzione, il
      // letto di luce dentro a un secondo: contando solo il primo livello
      // si contano i puntini e non la macchia che ci sta sotto.
      _liv: 0,
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

prova('ingrandendo il tappeto non sparisce col terreno', () => {
  // Il terreno si fa trasparente per lasciar vedere gli astri, ma un paese
  // sul crinale è **il** motivo per cui uno ingrandisce sull'orizzonte.
  assert.ok(run('SKY_ABITATO_VELO_MIN') >= 0.2);
  const ab = posto(PAESI, 800, 300).filter(a => a.nome === 'Vicino');
  ctx.__ab = ab;
  run('cittaAbitatiVista = __ab; skyCrestaFinta = -90; sky.luceCielo = 0;');
  run('__tela = telaFinta(); skyDisegnaAbitati(__tela, {}, 300, null, 0.12);');
  assert.ok(run('__tela.punti').length > 0, 'a terreno quasi trasparente spariscono tutte');
});

console.log('\n' + passate + ' passate, ' + fallite + ' fallite');
process.exit(fallite ? 1 : 0);
