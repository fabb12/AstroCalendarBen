'use strict';
// node scripts/prova-adsb.js — l'aggregatore ADS-B di `aerei.js`, senza rete.
//
// La domanda che questo banco esiste per fare è quella che a occhio non si
// può fare: **un cielo senza triangoli è identico a un cielo senza aerei**.
// Una fonte che tace, una che risponde zero per sbaglio, due fonti che danno
// lo stesso aereo in due posti, un aereo di tre minuti fa ancora propagato:
// sullo schermo sono tutti «un cielo plausibile». Qui ogni scenario ha una
// verità nota — porte finte che rispondono quello che diciamo noi — e si
// pretende che l'aggregatore la ritrovi.
//
// Il modulo gira per davvero, intero, dentro a una `vm` con un documento
// finto: nessuna copia delle funzioni, così il giorno che cambiano non c'è
// niente che resti indietro.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const codice = fs.readFileSync(path.join(__dirname, '..', 'aerei.js'), 'utf8');
const DOVE = { lat: 45.8124, lon: 9.0295 };

function nuovoMondo(opz = {}) {
  const memoria = new Map();
  const ascoltiDoc = {}, ascoltiWin = {};
  const chiamate = [];
  const mondo = {
    console, URL, URLSearchParams, Response, Headers, AbortController, setTimeout, clearTimeout,
    setInterval: () => 0, clearInterval: () => {},
    Promise, Map, Set, Math, Date, JSON, Number, String, Array, Object, Error, TypeError,
    localStorage: { getItem: k => (memoria.has(k) ? memoria.get(k) : null), setItem: (k, v) => memoria.set(k, String(v)) },
    navigator: { onLine: true },
    document: {
      hidden: false,
      getElementById: () => null,
      createElement: () => { const e = { _t: '' }; Object.defineProperty(e, 'textContent', { set(v) { e._t = v; } });
        Object.defineProperty(e, 'innerHTML', { get() { return String(e._t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); } }); return e; },
      addEventListener: (n, f) => { (ascoltiDoc[n] = ascoltiDoc[n] || []).push(f); }
    },
    astroI18n: {
      t: (k, v) => k + (v ? JSON.stringify(v) : ''),
      quantoManca: ms => `${Math.round(ms / 1000)}s`, numero: n => String(n), getLanguage: () => 'it'
    },
    skyLuogoDelCielo: () => mondo.__dove,
    raggioAerei: () => 50,
    __dove: { ...DOVE },
    fetch: async (url, init) => {
      chiamate.push(String(url));
      return mondo.__rispondi(String(url), init || {});
    },
    __rispondi: async () => new Response('{"ac":[]}'),
    ...opz
  };
  mondo.window = mondo;
  mondo.addEventListener = (n, f) => { (ascoltiWin[n] = ascoltiWin[n] || []).push(f); };
  vm.createContext(mondo);
  vm.runInContext(codice, mondo, { filename: 'aerei.js' });
  mondo.__chiamate = chiamate;
  mondo.__emettiDoc = n => (ascoltiDoc[n] || []).forEach(f => f({}));
  mondo.__emettiWin = n => (ascoltiWin[n] || []).forEach(f => f({}));
  return mondo;
}

// Una porta finta. `comportamento(n)` riceve il numero della chiamata e
// restituisce { stato, corpo, ritardo, intestazioni } oppure `'muta'`
// (non risponde mai) oppure `'cors'` (il browser la rifiuta).
function portaFinta(nome, comportamento, extra = {}) {
  let n = 0;
  return {
    nome, rete: nome, fonte: nome,
    interpreta: null, // lo mette `conInterprete`
    url: () => `https://finta.test/${encodeURIComponent(nome)}`,
    __chiedi: (segnale) => {
      const c = comportamento(++n);
      return new Promise((risolvi, rifiuta) => {
        if (c === 'muta') {
          segnale && segnale.addEventListener('abort', () => rifiuta(Object.assign(new Error('abort'), { name: 'AbortError' })));
          return;
        }
        if (c === 'cors') { setTimeout(() => rifiuta(new TypeError('Failed to fetch')), 1); return; }
        const t = setTimeout(() => risolvi(new Response(typeof c.corpo === 'string' ? c.corpo : JSON.stringify(c.corpo),
          { status: c.stato || 200, headers: c.intestazioni || {} })), c.ritardo || 1);
        segnale && segnale.addEventListener('abort', () => { clearTimeout(t); rifiuta(Object.assign(new Error('abort'), { name: 'AbortError' })); });
      });
    },
    get chiamate() { return n; },
    ...extra
  };
}

function colleghi(mondo, porte) {
  const A = mondo.AereiADS_B;
  porte.forEach(p => { p.interpreta = A.interpretaAdsbExchange; });
  mondo.__rispondi = (url, init) => {
    const p = porte.find(q => url.startsWith(q.url()));
    if (!p) return Promise.reject(new Error('porta sconosciuta ' + url));
    return p.__chiedi(init.signal);
  };
  return porte;
}

const ora = () => Date.now() / 1000;
const aereo = (hex, extra = {}) => ({ hex, flight: 'V' + hex, lat: DOVE.lat + 0.05, lon: DOVE.lon + 0.05,
  alt_baro: 30000, gs: 400, track: 90, seen_pos: 1, ...extra });
const cielo = (...ac) => ({ corpo: { ac } });

const prove = [];
function prova(nome, fn) { prove.push({ nome, fn }); }

// ---------------------------------------------------------------------------
prova('provider primario funzionante: una porta, una risposta, nessun ripiego', async () => {
  const m = nuovoMondo();
  const [a, b] = colleghi(m, [portaFinta('A', () => cielo(aereo('aaa001'), aereo('aaa002'))), portaFinta('B', () => cielo(aereo('bbb001')))]);
  const r = await m.AereiADS_B.corsaProvider([a, b], DOVE, 50, null, { affiancaMs: 200 });
  assert.equal(r.provider.nome, 'A');
  assert.equal(r.aerei.length, 2);
  assert.equal(b.chiamate, 0, 'la seconda porta non va nemmeno chiamata');
  assert.deepEqual(Array.from(r.aerei[0].fonti), ['A']);
});

prova('ripiego sul secondo provider quando il primo risponde 500', async () => {
  const m = nuovoMondo();
  const [a, b] = colleghi(m, [portaFinta('A', () => ({ stato: 500, corpo: 'guasto' })), portaFinta('B', () => cielo(aereo('bbb001')))]);
  const r = await m.AereiADS_B.corsaProvider([a, b], DOVE, 50, null, { affiancaMs: 5000 });
  assert.equal(r.provider.nome, 'B', 'chi cade lascia subito il posto, senza aspettare l’affiancamento');
  assert.ok(m.AereiADS_B.salute.get('A').penaleFino > Date.now(), 'A va in penale');
});

prova('ripiego sul terzo provider: il primo tace, il secondo dice 429', async () => {
  const m = nuovoMondo();
  const [a, b, c] = colleghi(m, [portaFinta('A', () => 'muta'), portaFinta('B', () => ({ stato: 429, corpo: '{}' })),
    portaFinta('C', () => cielo(aereo('ccc001')))]);
  const r = await m.AereiADS_B.corsaProvider([a, b, c], DOVE, 50, null, { affiancaMs: 30, attesaMs: 2000 });
  assert.equal(r.provider.nome, 'C');
  assert.equal(m.AereiADS_B.salute.get('A').noDiFila || 0, 0, 'la porta muta abortita perché ha vinto C non va in penale');
});

prova('rate limit: Retry-After rispettato, e la porta resta fuori dalla corsa successiva', async () => {
  const m = nuovoMondo();
  const [a, b] = colleghi(m, [portaFinta('A', () => ({ stato: 429, corpo: '{}', intestazioni: { 'Retry-After': '900' } })),
    portaFinta('B', () => cielo(aereo('bbb001')))]);
  await m.AereiADS_B.corsaProvider([a, b], DOVE, 50, null, { affiancaMs: 30 });
  const v = m.AereiADS_B.salute.get('A');
  assert.ok(v.penaleFino >= Date.now() + 890000, 'penale lunga quanto il Retry-After');
  assert.equal(m.AereiADS_B.statoCircuito('A'), 'aperto');
  const ordinate = m.AereiADS_B.ordinaPerSalute([a, b]);
  assert.deepEqual(ordinate.map(p => p.nome), ['B'], 'nessuna richiesta a una porta col circuito aperto');
  // E il ritmo: un 429 riparte da un gradino alto della scala, mai dal primo.
  m.AereiADS_B.stato.tentativiFalliti = 0;
  const e = Object.assign(new Error('429'), { rateLimit: true, riprovaFraMs: 120000 });
  m.AereiADS_B.pianificaProssimo(false, e);
  assert.ok(m.AereiADS_B.stato.prossimoTentativo - Date.now() >= 119000);
});

prova('timeout: la porta muta si abbandona e la corsa va avanti', async () => {
  const m = nuovoMondo();
  const [a, b] = colleghi(m, [portaFinta('A', () => 'muta'), portaFinta('B', () => ({ ...cielo(aereo('bbb001')), ritardo: 5 }))]);
  const inizio = Date.now();
  const r = await m.AereiADS_B.corsaProvider([a, b], DOVE, 50, null, { affiancaMs: 50, attesaMs: 40, corsaMs: 3000 });
  assert.equal(r.provider.nome, 'B');
  assert.ok(Date.now() - inizio < 1000);
  assert.match(m.AereiADS_B.salute.get('A').ultimoGuaio, /tempo scaduto/);
});

prova('risposta vuota sospetta: con traffico recente uno zero non chiude la corsa', async () => {
  const m = nuovoMondo();
  const [a, b] = colleghi(m, [portaFinta('A', () => cielo()), portaFinta('B', () => cielo(aereo('bbb001'), aereo('bbb002')))]);
  const r = await m.AereiADS_B.corsaProvider([a, b], DOVE, 50, null, { affiancaMs: 5000, attesi: 12 });
  assert.equal(r.provider.nome, 'B', 'la porta dopo parte subito e smentisce lo zero');
  assert.equal(r.aerei.length, 2);
  assert.equal(m.AereiADS_B.salute.get('A').vuotiDiFila, 1);
  // Il secondo zero di fila, smentito di nuovo, vale una penale.
  await m.AereiADS_B.corsaProvider([a, b], DOVE, 50, null, { affiancaMs: 5000, attesi: 12 });
  assert.ok(m.AereiADS_B.salute.get('A').penaleFino > Date.now(), 'zeri ripetuti → circuito aperto');
  // Senza traffico recente, invece, uno zero è una risposta come le altre.
  const m2 = nuovoMondo();
  const [c, d] = colleghi(m2, [portaFinta('C', () => cielo()), portaFinta('D', () => cielo(aereo('ddd001')))]);
  const r2 = await m2.AereiADS_B.corsaProvider([c, d], DOVE, 50, null, { affiancaMs: 5000 });
  assert.equal(r2.provider.nome, 'C');
  assert.equal(r2.vuoto, true);
  assert.equal(d.chiamate, 0);
});

prova('zero non smentito da nessuno: si accetta, ma si dichiara incerto', async () => {
  const m = nuovoMondo();
  const [a, b] = colleghi(m, [portaFinta('A', () => cielo()), portaFinta('B', () => ({ stato: 503, corpo: '{}' }))]);
  const r = await m.AereiADS_B.corsaProvider([a, b], DOVE, 50, null, { affiancaMs: 30, attesi: 8 });
  assert.equal(r.vuoto, true);
  assert.equal(r.vuotoIncerto, true, 'una fonte sola che dice zero dove c’era traffico è un dubbio, non un fatto');
});

prova('tutti i provider indisponibili: errore raccontato, dati di prima tenuti', async () => {
  const m = nuovoMondo();
  const A = m.AereiADS_B;
  const porte = colleghi(m, [portaFinta('A', () => ({ stato: 500, corpo: 'x' })), portaFinta('B', () => ({ stato: 502, corpo: 'x' }))]);
  m.AEREI_PROVIDERS = porte;
  A.stato.aerei = [{ id: 'abc123', lat: DOVE.lat, lon: DOVE.lon, ultimaLettura: ora() - 5, velocitaMs: 200, direzione: 0 }];
  A.stato.ultimoSuccesso = Date.now() - 30000;
  A.stato.avviato = true;
  await A.carica(true);
  assert.ok(A.stato.errore, 'l’errore c’è');
  assert.equal(A.stato.aerei.length, 1, 'l’ultima lettura resta finché è giovane');
  // Senza proxy configurato la fase è `proxyMancante`, con il proxy `errore`:
  // tutt'e due dicono «le fonti non rispondono», nessuna «cielo sgombro».
  assert.ok(['errore', 'proxyMancante'].includes(A.fase()), 'fonti giù: non «nessun aereo»');
  m.ADSB_PROXY_URL = 'https://proxy.test';
  assert.equal(A.fase(), 'errore');
  assert.notEqual(A.testoDiStato(), 'aereiStato.cieloSgombro');
});

prova('memoria delle risposte: la stessa domanda entro pochi secondi non bussa due volte', async () => {
  const m = nuovoMondo();
  const [a] = colleghi(m, [portaFinta('A', () => cielo(aereo('aaa001')))]);
  const A = m.AereiADS_B;
  await A.scarica(a, DOVE, 50, null, { cache: true });
  await A.scarica(a, DOVE, 50, null, { cache: true });
  assert.equal(a.chiamate, 1);
  await A.scarica(a, DOVE, 50, null, {});
  assert.equal(a.chiamate, 2, 'senza cache (gesto esplicito) si bussa davvero');
});

prova('richieste gemelle: due domande nello stesso istante diventano una', async () => {
  const m = nuovoMondo();
  const [a] = colleghi(m, [portaFinta('A', () => ({ ...cielo(aereo('aaa001')), ritardo: 30 }))]);
  const A = m.AereiADS_B;
  const [x, y] = await Promise.all([A.scarica(a, DOVE, 50, null), A.scarica(a, DOVE, 50, null)]);
  assert.equal(a.chiamate, 1);
  assert.equal(x.length, 1); assert.equal(y.length, 1);
  // Chi rinuncia se ne va senza portarsi via l'altro.
  const c1 = new AbortController();
  const p1 = A.scarica(a, { lat: 10, lon: 10 }, 50, c1.signal);
  const p2 = A.scarica(a, { lat: 10, lon: 10 }, 50, null);
  c1.abort();
  await assert.rejects(p1, e => e.name === 'AbortError');
  assert.equal((await p2).length, 1);
});

prova('deduplicazione: lo stesso aereo da due provider è un record solo', async () => {
  const m = nuovoMondo();
  const [a, b] = colleghi(m, [
    portaFinta('A', () => ({ ...cielo(aereo('ABC123', { r: '', t: '' })), ritardo: 5 })),
    portaFinta('B', () => ({ ...cielo(aereo('abc123', { r: 'I-TEST', t: 'A320' }), aereo('def456')), ritardo: 40 }))]);
  const r = await m.AereiADS_B.corsaProvider([a, b], DOVE, 50, null, { affiancaMs: 0, fondiMs: 500 });
  const stesso = r.aerei.filter(x => x.id === 'abc123');
  assert.equal(stesso.length, 1, 'maiuscole e minuscole non fanno due aerei');
  assert.deepEqual(Array.from(stesso[0].fonti).sort(), ['A', 'B']);
  assert.equal(stesso[0].registrazione, 'I-TEST', 'i campi descrittivi si prendono da chi li ha');
  assert.equal(r.aerei.length, 2, 'la raccolta porta anche l’aereo che solo B vedeva');
  // Registrazione come ponte: una lettura senza ICAO si attacca al suo aereo.
  const F = m.AereiADS_B.fondiLetture([
    [{ id: 'abc123', registrazione: 'I-TEST', callsign: 'AZA1', lat: 1, lon: 1, ultimaLettura: 100, fonte: 'X' }],
    [{ id: 'reg:i-test', registrazione: 'I-TEST', callsign: '', lat: 1.1, lon: 1, ultimaLettura: 105, fonte: 'Y' }]]);
  assert.equal(F.length, 1);
  assert.equal(F[0].id, 'abc123');
  assert.equal(F[0].lat, 1.1, 'vince la lettura più recente');
});

prova('scelta del dato più recente, anche contro la memoria', () => {
  const m = nuovoMondo();
  const A = m.AereiADS_B;
  const adesso = ora();
  A.stato.aerei = [{ id: 'aaa001', lat: 2, lon: 2, ultimaLettura: adesso - 2, fonte: 'M' }];
  const unito = A.unisciConLaMemoria([{ id: 'aaa001', lat: 1, lon: 1, ultimaLettura: adesso - 20, fonte: 'N' }]);
  assert.equal(unito.length, 1);
  assert.equal(unito[0].lat, 2, 'una porta in ritardo non fa tornare indietro l’aereo');
  const pari = A.fondiLetture([[{ id: 'x', lat: 5, lon: 5, ultimaLettura: 50, fonte: 'P' }],
    [{ id: 'x', lat: 6, lon: 6, ultimaLettura: 50.2, fonte: 'Q' }]]);
  assert.equal(pari[0].lat, 5, 'a pari istante vince la porta che ha vinto la corsa');
});

prova('interpolazione breve: la posizione scorre con la rotta, e l’età la dichiara', () => {
  const m = nuovoMondo();
  const A = m.AereiADS_B;
  const base = { id: 'aaa001', lat: DOVE.lat, lon: DOVE.lon, quotaM: 10000, velocitaMs: 250, direzione: 0,
    salitaMs: 0, ultimaLettura: ora() - 10 };
  const adesso = A.aereoAdesso(base, { ...DOVE, quotaM: 0 });
  const km = A.distanzaDirezione(base, adesso).km;
  assert.ok(Math.abs(km - 2.5) < 0.05, `dieci secondi a 250 m/s sono 2,5 km (erano ${km})`);
  assert.equal(adesso.qualita, 'vivo');
  assert.equal(A.aereoAdesso({ ...base, ultimaLettura: ora() - 40 }, DOVE).qualita, 'interpolato');
  assert.equal(A.aereoAdesso({ ...base, ultimaLettura: ora() - 90 }, DOVE).qualita, 'stantio');
});

prova('eliminazione dei dati stantii: oltre l’età massima un aereo esce dal cielo', () => {
  const m = nuovoMondo();
  const A = m.AereiADS_B;
  const lim = A.etaMassimaMs();
  assert.ok(lim >= A.AEREI_MEMORIA_MS);
  const giovane = { id: 'g', lat: DOVE.lat, lon: DOVE.lon, ultimaLettura: ora() - 30 };
  const vecchio = { id: 'v', lat: DOVE.lat, lon: DOVE.lon, ultimaLettura: ora() - lim / 1000 - 5 };
  assert.deepEqual(A.potaStantii([giovane, vecchio]).map(a => a.id), ['g']);
  A.stato.aerei = [giovane, vecchio];
  A.aggiornaPosizioni();
  assert.deepEqual(A.stato.aerei.map(a => a.id), ['g'], 'il ciclo di disegno pota da sé');
  // E la memoria non riporta in vita chi il feed non conferma da troppo.
  A.stato.aerei = [{ id: 'm', lat: 1, lon: 1, ultimaLettura: ora() - A.AEREI_MEMORIA_MS / 1000 - 5 }];
  assert.equal(A.unisciConLaMemoria([]).length, 0);
});

prova('cambio luogo dell’osservatore: un salto butta la fotografia e interrompe la richiesta', async () => {
  const m = nuovoMondo();
  const A = m.AereiADS_B;
  const porte = colleghi(m, [portaFinta('A', () => ({ ...cielo(aereo('aaa001')), ritardo: 200 }))]);
  m.AEREI_PROVIDERS = porte;
  A.stato.avviato = true;
  A.stato.aerei = [{ id: 'vecchio', lat: DOVE.lat, lon: DOVE.lon, ultimaLettura: ora() }];
  A.stato.ultimoCentro = { ...DOVE };
  A.stato.ultimoSuccesso = Date.now();
  const volo = A.carica(true);
  const controller = A.stato.controller;
  m.__dove = { lat: DOVE.lat + 3, lon: DOVE.lon };   // oltre 300 km: un'altra città
  m.aereiPosizioneCambiata();
  assert.equal(A.stato.aerei.length, 0, 'niente aerei del luogo di prima nel cielo nuovo');
  assert.ok(controller.signal.aborted, 'la risposta vecchia non deve ripopolare il cielo nuovo');
  await volo;
  // Uno spostamento dentro la tolleranza invece non tocca niente.
  const m2 = nuovoMondo();
  const B = m2.AereiADS_B;
  B.stato.aerei = [{ id: 'resta', lat: DOVE.lat, lon: DOVE.lon, ultimaLettura: ora() }];
  B.stato.ultimoCentro = { ...DOVE };
  B.stato.ultimoSuccesso = Date.now();
  m2.__dove = { lat: DOVE.lat + 0.005, lon: DOVE.lon };
  m2.aereiPosizioneCambiata();
  assert.equal(B.stato.aerei.length, 1);
});

prova('disattivazione degli aerei: nessuna richiesta, e quella in volo si abortisce', async () => {
  const m = nuovoMondo();
  const A = m.AereiADS_B;
  const porte = colleghi(m, [portaFinta('A', () => ({ ...cielo(aereo('aaa001')), ritardo: 200 }))]);
  m.AEREI_PROVIDERS = porte;
  A.stato.avviato = true;
  const volo = A.carica(true);
  const controller = A.stato.controller;
  m.aereiAlternaDati();          // spegne
  assert.equal(A.stato.dati, false);
  assert.ok(controller.signal.aborted);
  await volo;
  const prima = porte[0].chiamate;
  A.stato.prossimoAggiornamento = 0;
  A.battito();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(porte[0].chiamate, prima, 'a dati spenti il battito non bussa');
  assert.equal(A.salute.get('A')?.noDiFila || 0, 0, 'un abort voluto non è un guasto della porta');
});

prova('pagina in secondo piano: il battito non scarica', async () => {
  const m = nuovoMondo();
  const A = m.AereiADS_B;
  const porte = colleghi(m, [portaFinta('A', () => cielo(aereo('aaa001')))]);
  m.AEREI_PROVIDERS = porte;
  A.stato.avviato = true;
  A.stato.prossimoAggiornamento = 0;
  m.document.hidden = true;
  A.battito();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(porte[0].chiamate, 0);
});

prova('ritorno in primo piano: aggiornamento immediato, ma senza scavalcare il freno', async () => {
  const m = nuovoMondo();
  const A = m.AereiADS_B;
  const porte = colleghi(m, [portaFinta('A', () => cielo(aereo('aaa001')))]);
  m.AEREI_PROVIDERS = porte;
  m.__emettiDoc('DOMContentLoaded');
  A.stato.avviato = true;
  A.stato.ultimoSuccesso = Date.now() - 60000;
  A.stato.prossimoAggiornamento = Date.now() + 100000;   // il battito aspetterebbe
  m.document.hidden = false;
  m.__emettiDoc('visibilitychange');
  await new Promise(r => setTimeout(r, 30));
  assert.equal(porte[0].chiamate, 1, 'tornando si rinfresca subito');
  assert.equal(A.stato.aerei.length, 1);
  // Con un rinvio chiesto da una porta (429), tornare non basta a bussare.
  A.stato.ultimoSuccesso = Date.now() - 60000;
  A.stato.prossimoTentativo = Date.now() + 100000;
  m.__emettiDoc('visibilitychange');
  await new Promise(r => setTimeout(r, 30));
  assert.equal(porte[0].chiamate, 1);
});

prova('annullamento delle richieste pendenti chiudendo il planetario', async () => {
  const m = nuovoMondo();
  const A = m.AereiADS_B;
  let segnale = null;
  const porte = colleghi(m, [portaFinta('A', () => 'muta')]);
  const rispondiVero = m.__rispondi;
  m.__rispondi = (url, init) => { segnale = init.signal; return rispondiVero(url, init); };
  m.AEREI_PROVIDERS = porte;
  m.aereiAvvia();
  await new Promise(r => setTimeout(r, 10));
  assert.ok(segnale && !segnale.aborted, 'una richiesta è in volo');
  m.aereiFerma();
  await new Promise(r => setTimeout(r, 10));
  assert.ok(segnale.aborted, 'la fetch vera si interrompe');
  assert.equal(A.stato.errore, '', 'e non diventa un guasto');
});

prova('porta diretta senza CORS: messa da parte per mezza giornata, non a ogni penale', async () => {
  const m = nuovoMondo();
  const A = m.AereiADS_B;
  const [os, b] = colleghi(m, [portaFinta('OS', () => 'cors', { diretto: true }), portaFinta('B', () => cielo(aereo('bbb001')))]);
  await A.corsaProvider([os, b], DOVE, 50, null, { affiancaMs: 5000 });
  const v = A.salute.get('OS');
  assert.equal(v.bloccata, true);
  assert.ok(v.penaleFino - Date.now() > A.PENALE_BLOCCATA_MS - 5000);
  assert.equal(A.statoCircuito('OS'), 'bloccato');
});

prova('OpenSky anonimo è una riserva col suo passo minimo', () => {
  const m = nuovoMondo();
  const A = m.AereiADS_B;
  const os = A.providerOpenSky();
  assert.equal(os.riserva, true);
  const elenco = A.providersPerRichiesta(false);
  assert.equal(elenco[elenco.length - 1].nome, 'OpenSky', 'in coda, dopo i ponti');
  A.salute.set('OpenSky', { ok: 5, no: 0, noDiFila: 0, ultimoOk: Date.now(), penaleFino: 0, ultimaProva: Date.now(), vuotiDiFila: 0 });
  assert.ok(!A.providersPerRichiesta(false).some(p => p.nome === 'OpenSky'), 'dentro al passo minimo resta fuori');
  // L'interprete di OpenSky normalizza unità e identificativo.
  const r = A.interpretaOpenSky({ states: [['4B1805', 'SWR12  ', 'CH', 1, ora() - 3, 8.5, 47.4, 10000, false, 230, 45, -2, null, 10050, '1000']] })
    .map(x => A.normalizzaLettura(x, 'OpenSky'));
  assert.equal(r[0].id, '4b1805');
  assert.equal(r[0].callsign, 'SWR12');
  assert.equal(r[0].quotaM, 10050);
});

prova('normalizzazione: coordinate impossibili, istanti futuri, niente identificativi', () => {
  const m = nuovoMondo();
  const N = m.AereiADS_B.normalizzaLettura;
  assert.equal(N({ id: 'a', lat: 95, lon: 0 }, 'X'), null);
  assert.equal(N({ id: '', callsign: '', registrazione: '', lat: 1, lon: 1 }, 'X'), null);
  const futuro = N({ id: 'a', lat: 1, lon: 1, ultimaLettura: ora() + 600 }, 'X');
  assert.ok(futuro.ultimaLettura <= ora() + 1, 'un orologio avanti non fa tornare indietro l’aereo');
  const senzaIcao = N({ id: '', callsign: 'AZA123', lat: 1, lon: 1 }, 'X');
  assert.equal(senzaIcao.id, 'vol:aza123');
  const readsb = m.AereiADS_B.interpretaAdsbExchange({ ac: [{ hex: 'abc', lat: 1, lon: 1, seen: 1, seen_pos: 12 }] });
  assert.ok(Math.abs(readsb[0].ultimaLettura - (ora() - 12)) < 2, 'conta l’età della posizione, non dell’ultimo messaggio');
});

prova('carica di un giro intero: fonti, pieno, e zero incerto raccontato', async () => {
  const m = nuovoMondo();
  const A = m.AereiADS_B;
  let turno = 0;
  const porte = colleghi(m, [portaFinta('A', () => (++turno === 1 ? cielo(aereo('aaa001'), aereo('aaa002'), aereo('aaa003')) : cielo()))]);
  m.AEREI_PROVIDERS = porte;
  A.stato.avviato = true;
  await A.carica(true);
  assert.equal(A.stato.aerei.length, 3);
  assert.equal(A.stato.ultimoPieno.quanti, 3);
  await A.carica(true);
  assert.equal(A.stato.vuotoIncerto, true);
  assert.equal(A.stato.aerei.length, 3, 'uno zero incerto non cancella il cielo: la memoria tiene chi è giovane');
  assert.match(A.testoDiStato(), /^aereiStato\.normale/);
  A.stato.aerei = [];
  assert.match(A.testoDiStato(), /^aereiStato\.vuotoIncerto/);
});

prova('ritmo adattivo: più lento dopo un 429, fermo a dati spenti', () => {
  const m = nuovoMondo();
  const A = m.AereiADS_B;
  m.sky = { aperto: true };
  const normale = A.intervalloAggiornamento();
  assert.equal(normale, A.AGGIORNA_VISIBILE_MS);
  A.stato.ultimoLimite = Date.now();
  assert.equal(A.intervalloAggiornamento(), normale * 2);
  A.stato.ultimoLimite = Date.now() - A.FRENO_LIMITE_MS - 1;
  assert.equal(A.intervalloAggiornamento(), normale);
  A.stato.visibile = false;
  assert.equal(A.intervalloAggiornamento(), A.AGGIORNA_SFONDO_MS);
});

(async () => {
  let rosse = 0;
  for (const p of prove) {
    try { await p.fn(); console.log('  ok  ' + p.nome); }
    catch (e) { rosse++; console.log('  NO  ' + p.nome + '\n      ' + (e && e.stack || e).split('\n').slice(0, 3).join('\n      ')); }
  }
  console.log(rosse ? `\n${rosse} prove su ${prove.length} non passano.` : `\nTutte le ${prove.length} prove passano.`);
  process.exitCode = rosse ? 1 : 0;
  setTimeout(() => process.exit(process.exitCode), 50);
})();
