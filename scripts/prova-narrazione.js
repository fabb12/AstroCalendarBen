#!/usr/bin/env node
/* La narrazione, senza browser: mezzo secondo.
 *
 *   node scripts/prova-narrazione.js
 *
 * Il difetto tipico di una voce non è una frase sbagliata: è una frase che
 * **non si sente** — un file che manca, un audio rotto, un browser che non
 * lascia parlare — e che somiglia in tutto a «qui non c'era niente da dire».
 * Oppure due frasi che si accavallano, che a occhio non si vedono affatto.
 * Quindi qui non si ascolta niente: si finge il mondo (l'orologio, la rete,
 * l'elemento audio, la sintesi del dispositivo) e si conta chi ha parlato,
 * con che cosa e quando. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const RADICE = path.resolve(__dirname, '..');
let passate = 0, fallite = 0;
const prove = [];
function prova(nome, fn) { prove.push([nome, fn]); }

// ---------------------------------------------------------------------
// Il mondo finto
// ---------------------------------------------------------------------
function creaMondo(opz = {}) {
  let adesso = 0, prossimo = 1;
  const timer = new Map();
  const setTimeout = (f, ms) => { const id = prossimo++; timer.set(id, { t: adesso + Math.max(0, ms || 0), f }); return id; };
  const clearTimeout = id => timer.delete(id);
  const svuota = () => new Promise(r => setImmediate(r));
  async function avanza(ms) {
    const fine = adesso + ms;
    await svuota(); await svuota();
    for (;;) {
      let scelto = null;
      for (const [id, x] of timer) if (x.t <= fine && (!scelto || x.t < scelto[1].t)) scelto = [id, x];
      if (!scelto) break;
      timer.delete(scelto[0]); adesso = scelto[1].t; scelto[1].f();
      await svuota(); await svuota();
    }
    adesso = fine;
    await svuota(); await svuota();
  }

  // Il documento: quel tanto che serve al sottotitolo e ai tasti.
  class Nodo {
    constructor(tag) { this.tagName = tag; this.figli = []; this.parentElement = null; this.hidden = false;
      this.classi = new Set(); this.attributi = {}; this.textContent = '';
      this.classList = { toggle: (c, v) => { if (v) this.classi.add(c); else this.classi.delete(c); },
        add: c => this.classi.add(c), remove: c => this.classi.delete(c), contains: c => this.classi.has(c) };
      this.ascoltatori = {}; }
    set className(v) { this.classi = new Set(String(v).split(/\s+/).filter(Boolean)); }
    setAttribute(k, v) { this.attributi[k] = v; }
    append(n) { if (n.parentElement) n.parentElement.figli = n.parentElement.figli.filter(x => x !== n); n.parentElement = this; this.figli.push(n); }
    prepend(n) { if (n.parentElement) n.parentElement.figli = n.parentElement.figli.filter(x => x !== n); n.parentElement = this; this.figli.unshift(n); }
    addEventListener(t, f) { (this.ascoltatori[t] = this.ascoltatori[t] || []).push(f); }
  }
  const ascoltatoriDoc = {};
  const document = {
    readyState: 'complete', hidden: false, fullscreenElement: null, activeElement: null,
    body: new Nodo('body'), documentElement: new Nodo('html'),
    createElement: tag => new Nodo(tag),
    getElementById: () => null,
    addEventListener: (t, f) => { (ascoltatoriDoc[t] = ascoltatoriDoc[t] || []).push(f); }
  };
  const lancia = t => (ascoltatoriDoc[t] || []).forEach(f => f({ type: t }));

  // La rete: indirizzo → risposta.
  const rete = new Map();
  const chiesti = [];
  const blob = new Map();
  let prossimoBlob = 1;
  async function fetch(url, init) {
    chiesti.push({ url, init });
    const r = rete.get(url);
    if (!r) return { ok: false, status: 404, headers: { get: () => '' }, blob: async () => ({ size: 0, type: '' }) };
    if (r.errore) throw new TypeError('Failed to fetch');
    return { ok: r.status === 200, status: r.status, headers: { get: () => r.tipo || 'audio/mpeg' },
      blob: async () => ({ size: r.size, type: r.tipo || 'audio/mpeg', da: url }), json: async () => r.json };
  }
  const URLFinto = { createObjectURL(b) { const u = 'blob:' + (prossimoBlob++); blob.set(u, b.da); return u; },
    revokeObjectURL(u) { blob.delete(u); } };

  // L'elemento audio: un file «corrotto» non si decodifica, uno «bloccato»
  // il browser non lo lascia suonare senza un gesto.
  const suonati = [];
  const audioStato = { bloccato: false, corrotti: new Set(), durata: 1000 };
  class Audio {
    constructor() { this._src = ''; this.volume = 1; this.muted = false; this.fine = null; this.resta = 0; this.suona = false; }
    set src(v) { this._src = v; clearTimeout(this.fine); this.suona = false; this.resta = audioStato.durata; }
    get src() { return this._src; }
    removeAttribute() { this._src = ''; clearTimeout(this.fine); this.suona = false; }
    load() {}
    play() {
      const origine = blob.get(this._src) || this._src;
      if (this._src.startsWith('data:audio/wav')) return Promise.resolve();
      if (audioStato.bloccato) return Promise.reject(Object.assign(new Error('bloccato'), { name: 'NotAllowedError' }));
      if (audioStato.corrotti.has(origine)) { setTimeout(() => this.onerror && this.onerror(), 5); return Promise.resolve(); }
      this.suona = true; this.partito = adesso;
      // Una ripresa dopo la pausa non è un file suonato di nuovo.
      if (this.resta === audioStato.durata) suonati.push({ origine, volume: this.volume });
      setTimeout(() => this.onplaying && this.onplaying(), 1);
      this.fine = setTimeout(() => { this.suona = false; this.onended && this.onended(); }, this.resta);
      return Promise.resolve();
    }
    pause() { if (this.suona) { clearTimeout(this.fine); this.resta -= adesso - this.partito; this.suona = false; } }
  }

  // La sintesi del dispositivo: parla cento millisecondi a parola.
  const detti = [];
  const voce = { muta: false, corrente: null, cancellazioni: 0 };
  const speechSynthesis = {
    getVoices: () => [{ lang: 'it-IT', name: 'Alice', localService: true }, { lang: 'it-IT', name: 'Federica (Enhanced)', localService: true },
      { lang: 'en-US', name: 'Samantha', localService: true }],
    speak(u) {
      if (!u.text.trim()) return;
      if (voce.corrente) this.cancel();
      voce.corrente = u;
      if (voce.muta) return;
      detti.push({ testo: u.text, lang: u.lang, volume: u.volume, voce: u.voice && u.voice.name, a: adesso });
      setTimeout(() => { if (voce.corrente === u) u.onstart && u.onstart(); }, 10);
      u._fine = setTimeout(() => { if (voce.corrente === u) { voce.corrente = null; u.onend && u.onend(); } },
        u.text.split(/\s+/).length * 100);
    },
    cancel() {
      voce.cancellazioni++;
      const u = voce.corrente; voce.corrente = null;
      if (u) { clearTimeout(u._fine); u.onerror && u.onerror({ error: 'interrupted' }); }
    },
    addEventListener() {}
  };
  class SpeechSynthesisUtterance { constructor(t) { this.text = t; this.volume = 1; } }

  // Le lingue.
  const dizionari = {
    it: { messaggi: {
      'demo.narr.prova.1': 'La Luna sta per toccare il Sole, e il cielo si spegne.',
      'missione.gioco.enigma.oggetto.saturno': 'Porto un anello e non mi sono mai sposato.',
      'missione.gioco.evviva.1': 'Evviva! L\'hai trovato!',
      'missione.gioco.dove.x': 'Guarda verso {dove}, a metà cielo.',
      'narrazione.testoProva': 'Questa è la voce.'
    } },
    en: { messaggi: {
      'demo.narr.prova.1': 'The Moon is about to touch the Sun, and the sky goes dark.',
      'narrazione.testoProva': 'This is the voice.'
    } }
  };
  const i18n = { lingua: 'it', ascolta: [] };
  const astroI18n = {
    lingua: () => i18n.lingua,
    esiste: k => k in dizionari[i18n.lingua].messaggi || k in dizionari.it.messaggi,
    t: (k, d) => String(dizionari[i18n.lingua].messaggi[k] || dizionari.it.messaggi[k] || k)
      .replace(/\{(\w+)\}/g, (m, x) => d && x in d ? d[x] : m),
    alCambio: f => i18n.ascolta.push(f)
  };
  const cambiaLingua = l => { i18n.lingua = l; i18n.ascolta.forEach(f => f(l)); };

  const memoria = new Map(opz.memoria || []);
  const localStorage = { getItem: k => memoria.has(k) ? memoria.get(k) : null, setItem: (k, v) => memoria.set(k, String(v)) };

  const window = { ASTRO_DIZIONARI: dizionari, EDGE_TTS_API_URL: opz.edge || '',
    ASTRO_NARRAZIONE_MANIFEST: opz.manifest || { radice: 'audio/narrazione/', voci: {} } };
  const contesto = {
    window, document, localStorage, fetch, URL: URLFinto, Audio, astroI18n, navigator: { onLine: true },
    setTimeout, clearTimeout, console: { warn: () => {}, log: console.log, error: console.error },
    Promise, Math, Date: { now: () => adesso }, JSON, Object, String, Number, Map, Set, Array, RegExp, Error, TypeError,
    AbortController: class { constructor() { this.signal = {}; } abort() { this.abortito = true; } }
  };
  if (opz.voce !== false) { contesto.speechSynthesis = speechSynthesis; contesto.SpeechSynthesisUtterance = SpeechSynthesisUtterance; }
  if (opz.senzaAudio) delete contesto.Audio;
  window.window = window;
  vm.createContext(contesto);
  vm.runInContext(fs.readFileSync(path.join(RADICE, 'narrazione.js'), 'utf8') + '\n;globalThis.__n = narrazione;', contesto);
  const n = contesto.__n;
  const sottotitolo = () => document.body.figli.find(x => x.attributi && x.textContent !== undefined && x.classi.has('narrazione-testo'));
  return { n, avanza, rete, chiesti, suonati, audioStato, detti, voce, cambiaLingua, window, document, lancia,
    memoria, sottotitolo, adesso: () => adesso };
}

const MANIFEST = {
  radice: 'audio/narrazione/',
  voci: {
    'demo.narr.prova.1': { it: 'demo/it/prova-1.mp3', en: 'demo/en/prova-1.mp3' },
    'missione.gioco.enigma.oggetto.saturno': { it: 'missione/it/enigma-saturno.mp3' },
    'missione.gioco.dove.x': { it: 'missione/it/dove.mp3' },
    'fuori': { it: '../../segreti.mp3' }
  }
};
const FILE = u => ({ status: 200, size: 4096, tipo: 'audio/mpeg' });
function conFile(m, ...nomi) { for (const f of nomi) m.rete.set('audio/narrazione/' + f, FILE()); return m; }

// ---------------------------------------------------------------------
// 1. Il manifest e la composizione
// ---------------------------------------------------------------------
prova('senza manifest il testo è un pezzo solo, di sintesi', () => {
  const m = creaMondo();
  assert.deepEqual(JSON.parse(JSON.stringify(m.n.componi('x', 'Ciao a tutti', 'it'))), [{ testo: 'Ciao a tutti' }]);
});

prova('un ID con un audio registrato diventa un pezzo solo, dal file', () => {
  const m = creaMondo({ manifest: MANIFEST });
  const p = m.n.componi('demo.narr.prova.1', 'La Luna sta per toccare il Sole, e il cielo si spegne.', 'it');
  assert.equal(p.length, 1);
  assert.equal(p[0].audio, 'audio/narrazione/demo/it/prova-1.mp3');
  assert.equal(m.n.componi('demo.narr.prova.1', 'The Moon…', 'en')[0].audio, 'audio/narrazione/demo/en/prova-1.mp3');
});

prova('un brano registrato si riconosce dentro a una frase composta', () => {
  const m = creaMondo({ manifest: MANIFEST });
  const p = m.n.componi('missione.tappa.saturno.enigma.0',
    'Evviva! Porto un anello e non mi sono mai sposato. Cercami verso sud.', 'it');
  assert.deepEqual(JSON.parse(JSON.stringify(p.map(x => [x.testo, !!x.audio]))), [
    ['Evviva!', false], ['Porto un anello e non mi sono mai sposato.', true], ['Cercami verso sud.', false]]);
});

prova('un testo con segnaposto non si registra: non si cerca mai', () => {
  const m = creaMondo({ manifest: MANIFEST });
  const p = m.n.componi('y', 'Guarda verso {dove}, a metà cielo.', 'it');
  assert.equal(p.length, 1); assert.equal(p[0].audio, undefined);
});

prova('un percorso che esce dalla cartella non vale', () => {
  const m = creaMondo({ manifest: MANIFEST });
  assert.equal(m.n.componi('fuori', 'qualunque cosa detta', 'it')[0].audio, undefined);
});

prova('l’impronta: un audio registrato per un altro testo non suona', () => {
  const testo = 'La Luna sta per toccare il Sole, e il cielo si spegne.';
  const buono = creaMondo({ manifest: { radice: 'a/', voci: { 'demo.narr.prova.1': { it: { file: 'x.mp3', impronta: 0 } } } } });
  const impronta = buono.n.impronta(testo);
  assert.match(impronta, /^[0-9a-f]{8}$/);
  assert.equal(buono.n.impronta('  La Luna sta per toccare il Sole,\n e il cielo si spegne. '), impronta, 'gli spazi non contano');
  const giusto = creaMondo({ manifest: { radice: 'a/', voci: { 'demo.narr.prova.1': { it: { file: 'x.mp3', impronta } } } } });
  assert.ok(giusto.n.componi('demo.narr.prova.1', testo, 'it')[0].audio);
  const vecchio = creaMondo({ manifest: { radice: 'a/', voci: { 'demo.narr.prova.1': { it: { file: 'x.mp3', impronta: 'deadbeef' } } } } });
  assert.equal(vecchio.n.componi('demo.narr.prova.1', testo, 'it')[0].audio, undefined);
});

prova('il manifest vero si legge e ogni percorso è valido', () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RADICE, 'audio/narrazione/manifest.js'), 'utf8'), ctx);
  const m = ctx.ASTRO_NARRAZIONE_MANIFEST;
  assert.equal(m.versione, 1); assert.equal(typeof m.voci, 'object');
  const mondo = creaMondo({ manifest: m });
  for (const [id, voce] of Object.entries(m.voci)) for (const l of Object.keys(voce))
    assert.ok(mondo.n.componi(id, 'x'.repeat(20), l), id);
});

// ---------------------------------------------------------------------
// 2. La scala dei ripieghi
// ---------------------------------------------------------------------
prova('1. l’audio registrato, se c’è, e nessuna sintesi', async () => {
  const m = conFile(creaMondo({ manifest: MANIFEST }), 'demo/it/prova-1.mp3');
  const esito = m.n.parla({ canale: 'demo', id: 'demo.narr.prova.1' });
  await m.avanza(10);
  assert.equal(m.sottotitolo().textContent, 'La Luna sta per toccare il Sole, e il cielo si spegne.');
  assert.equal(m.sottotitolo().hidden, false);
  await m.avanza(2000);
  assert.equal(await esito, 'audio');
  assert.equal(m.suonati.length, 1); assert.equal(m.suonati[0].origine, 'audio/narrazione/demo/it/prova-1.mp3');
  assert.equal(m.detti.length, 0);
});

prova('file mancante: si passa alla sintesi, e non lo si richiede più', async () => {
  const m = creaMondo({ manifest: MANIFEST });
  let e = m.n.parla({ canale: 'demo', id: 'demo.narr.prova.1' });
  await m.avanza(3000);
  assert.equal(await e, 'tts');
  assert.equal(m.detti.length, 1);
  assert.equal(m.n.guasti()['audio/narrazione/demo/it/prova-1.mp3'], 'mancante');
  const prima = m.chiesti.length;
  e = m.n.parla({ canale: 'demo', id: 'demo.narr.prova.1' });
  await m.avanza(3000);
  assert.equal(await e, 'tts'); assert.equal(m.chiesti.length, prima, 'un file mancante non si richiede a ogni scena');
});

prova('file corrotto: non si decodifica, si passa alla sintesi', async () => {
  const m = conFile(creaMondo({ manifest: MANIFEST }), 'demo/it/prova-1.mp3');
  m.audioStato.corrotti.add('audio/narrazione/demo/it/prova-1.mp3');
  const e = m.n.parla({ canale: 'demo', id: 'demo.narr.prova.1' });
  await m.avanza(3000);
  assert.equal(await e, 'tts');
  assert.equal(m.n.guasti()['audio/narrazione/demo/it/prova-1.mp3'], 'corrotto');
});

prova('file troppo piccolo o pagina d’errore: corrotto, senza nemmeno provarlo', async () => {
  const m = creaMondo({ manifest: MANIFEST });
  m.rete.set('audio/narrazione/demo/it/prova-1.mp3', { status: 200, size: 20, tipo: 'text/html' });
  const e = m.n.parla({ canale: 'demo', id: 'demo.narr.prova.1' });
  await m.avanza(3000);
  assert.equal(await e, 'tts'); assert.equal(m.suonati.length, 0);
});

prova('il browser non lascia suonare: sintesi, ma il file non è guasto', async () => {
  const m = conFile(creaMondo({ manifest: MANIFEST }), 'demo/it/prova-1.mp3');
  m.audioStato.bloccato = true;
  const e = m.n.parla({ canale: 'demo', id: 'demo.narr.prova.1' });
  await m.avanza(3000);
  assert.equal(await e, 'tts');
  assert.equal(m.n.guasti()['audio/narrazione/demo/it/prova-1.mp3'], undefined);
});

prova('solo sintesi: gli audio registrati non si chiedono affatto', async () => {
  const m = conFile(creaMondo({ manifest: MANIFEST }), 'demo/it/prova-1.mp3');
  m.n.impostaPreferenze({ soloTts: true });
  const e = m.n.parla({ canale: 'demo', id: 'demo.narr.prova.1' });
  await m.avanza(3000);
  assert.equal(await e, 'tts'); assert.equal(m.chiesti.length, 0);
});

prova('3. senza sintesi il testo resta a schermo il tempo di leggerlo', async () => {
  const m = creaMondo({ voce: false });
  const e = m.n.parla({ canale: 'demo', testo: 'Una frase di sette parole da leggere.' });
  await m.avanza(1000);
  assert.equal(m.sottotitolo().hidden, false);
  assert.equal(m.n.stato().fase, 'testo');
  await m.avanza(2000);
  assert.equal(await e, 'testo');
});

prova('la sintesi che non parte (autoplay) si dà per muta fino al prossimo gesto', async () => {
  const m = creaMondo();
  m.voce.muta = true;
  let e = m.n.parla({ canale: 'demo', testo: 'Prima frase.' });
  await m.avanza(3100);
  assert.equal(m.n.stato().fase, 'testo', 'dopo tre secondi di silenzio resta il testo');
  await m.avanza(3000); assert.equal(await e, 'testo');
  const t0 = m.adesso();
  e = m.n.parla({ canale: 'demo', testo: 'Seconda frase.' });
  await m.avanza(5);
  assert.equal(m.n.stato().fase, 'testo', 'la seconda non aspetta di nuovo tre secondi');
  await m.avanza(3000); await e;
  m.voce.muta = false;
  m.lancia('pointerdown');
  e = m.n.parla({ canale: 'demo', testo: 'Terza frase.' });
  await m.avanza(1000);
  assert.equal(await e, 'tts', 'un tocco rimette in gioco la voce');
  assert.ok(m.adesso() > t0);
});

prova('la voce del dispositivo sceglie per nome, e la lingua è quella dell’app', async () => {
  const m = creaMondo();
  const e = m.n.parla({ canale: 'demo', testo: 'Ciao cielo.' });
  await m.avanza(500); await e;
  assert.equal(m.detti[0].voce, 'Federica (Enhanced)'); assert.equal(m.detti[0].lang, 'it-IT');
});

prova('il ponte Edge-TTS va prima della voce del dispositivo, coi campi di chi parla', async () => {
  const m = creaMondo({ edge: 'https://tts.example/v1' });
  m.rete.set('https://tts.example/v1', { status: 200, size: 8000, tipo: 'audio/mpeg' });
  const e = m.n.parla({ canale: 'missione', testo: 'Ciao cielo.', tono: { ritmo: '-5%', tono: '0Hz' },
    edge: (frase, lingua) => ({ voice: 'it-IT-IsabellaNeural', ssml: '<speak>' + frase + '</speak>' }) });
  await m.avanza(2000);
  assert.equal(await e, 'tts');
  const corpo = JSON.parse(m.chiesti[0].init.body);
  assert.equal(corpo.voice, 'it-IT-IsabellaNeural'); assert.equal(corpo.rate, '-5%');
  assert.equal(corpo.ssml, '<speak>Ciao cielo.</speak>'); assert.equal(corpo.text, 'Ciao cielo.');
  assert.equal(m.detti.length, 0);
});

prova('il ponte guasto non tiene in ostaggio la voce del dispositivo', async () => {
  const m = creaMondo({ edge: 'https://tts.example/v1' });
  m.rete.set('https://tts.example/v1', { status: 503 });
  const e = m.n.parla({ canale: 'missione', testo: 'Ciao cielo.' });
  await m.avanza(1000);
  assert.equal(await e, 'tts'); assert.equal(m.detti.length, 1);
});

prova('un brano registrato dentro a una frase: sintesi, file, sintesi — in ordine', async () => {
  const m = conFile(creaMondo({ manifest: MANIFEST }), 'missione/it/enigma-saturno.mp3');
  const e = m.n.parla({ canale: 'missione', testo: 'Evviva! Porto un anello e non mi sono mai sposato. Cercami verso sud.' });
  await m.avanza(5000);
  assert.equal(await e, 'audio');
  assert.deepEqual(m.detti.map(d => d.testo), ['Evviva!', 'Cercami verso sud.']);
  assert.equal(m.suonati.length, 1);
  assert.ok(m.detti[0].a < m.detti[1].a);
});

// ---------------------------------------------------------------------
// 3. Nessuna sovrapposizione, pausa, ripresa
// ---------------------------------------------------------------------
prova('una frase nuova ferma quella di prima: mai due voci insieme', async () => {
  const m = creaMondo();
  const a = m.n.parla({ canale: 'demo', testo: 'Una frase abbastanza lunga da essere ancora in corso.' });
  await m.avanza(200);
  const b = m.n.parla({ canale: 'missione', testo: 'Seconda.' });
  assert.equal(await a, 'interrotta');
  await m.avanza(1000);
  assert.equal(await b, 'tts');
  assert.equal(m.voce.corrente, null);
});

prova('fermare un canale non zittisce l’altro', async () => {
  const m = creaMondo();
  const a = m.n.parla({ canale: 'prova', testo: 'Una prova delle impostazioni.' });
  await m.avanza(50);
  assert.equal(m.n.ferma('demo'), false);
  assert.equal(m.n.stato().canale, 'prova');
  assert.equal(m.n.ferma('prova'), true);
  assert.equal(await a, 'interrotta');
  assert.equal(m.n.stato(), null); assert.equal(m.sottotitolo().hidden, true);
});

prova('pausa e ripresa di un audio: riprende da dove era, senza ricominciare', async () => {
  const m = conFile(creaMondo({ manifest: MANIFEST }), 'demo/it/prova-1.mp3');
  const e = m.n.parla({ canale: 'demo', id: 'demo.narr.prova.1' });
  await m.avanza(400);
  m.n.pausa('demo');
  assert.equal(m.n.stato().pausa, true);
  await m.avanza(5000);
  assert.equal(m.n.stato().fase, 'audio', 'in pausa non finisce');
  m.n.riprendi('demo');
  await m.avanza(700);
  assert.equal(await e, 'audio');
  assert.equal(m.suonati.length, 1, 'lo stesso file, non una seconda volta');
});

prova('pausa di una sintesi: la frase si ridice da capo alla ripresa', async () => {
  const m = creaMondo();
  const e = m.n.parla({ canale: 'demo', testo: 'Quattro parole da dire.' });
  await m.avanza(150);
  m.n.pausa('demo');
  await m.avanza(3000);
  assert.equal(m.detti.length, 1);
  m.n.riprendi('demo');
  await m.avanza(1000);
  assert.equal(await e, 'tts');
  assert.deepEqual([...m.detti.map(d => d.testo)], ['Quattro parole da dire.', 'Quattro parole da dire.']);
});

prova('pausa col solo testo: l’orologio della lettura si ferma', async () => {
  const m = creaMondo({ voce: false });
  let fatto = false;
  m.n.parla({ canale: 'demo', testo: 'Tre parole qui.' }).then(() => { fatto = true; });
  await m.avanza(1000);
  m.n.pausa('demo');
  await m.avanza(10000);
  assert.equal(fatto, false);
  m.n.riprendi('demo');
  await m.avanza(1600);
  assert.equal(fatto, true);
});

prova('la scheda nascosta ferma la voce e la fa ripartire; una pausa chiesta resta', async () => {
  const m = creaMondo();
  m.n.parla({ canale: 'missione', testo: 'Una frase qualunque da dire piano.' });
  await m.avanza(100);
  m.document.hidden = true; m.lancia('visibilitychange');
  assert.equal(m.n.stato().pausa, true);
  m.document.hidden = false; m.lancia('visibilitychange');
  assert.equal(m.n.stato().pausa, false);
  m.document.hidden = true; m.lancia('visibilitychange');
  m.n.pausa('missione');   // chi l'ha chiesta per conto suo (la demo)
  m.document.hidden = false; m.lancia('visibilitychange');
  assert.equal(m.n.stato().pausa, true);
});

// ---------------------------------------------------------------------
// 4. Lingua e preferenze
// ---------------------------------------------------------------------
prova('cambio lingua: una chiave si ridice nella lingua nuova, una frase scritta a mano no', async () => {
  const m = creaMondo();
  m.n.parla({ canale: 'demo', id: 'demo.narr.prova.1' });
  await m.avanza(100);
  m.cambiaLingua('en');
  await m.avanza(50);
  assert.equal(m.n.stato().testo, 'The Moon is about to touch the Sun, and the sky goes dark.');
  assert.equal(m.detti.at(-1).lang, 'en-US');
  m.n.parla({ canale: 'demo', testo: 'Una frase mia.' });
  await m.avanza(20);
  m.cambiaLingua('it');
  assert.equal(m.n.stato().testo, 'Una frase mia.');
});

prova('cambio lingua in pausa: il testo si aggiorna e la voce resta ferma', async () => {
  const m = creaMondo();
  m.n.parla({ canale: 'demo', id: 'demo.narr.prova.1' });
  await m.avanza(100); m.n.pausa('demo');
  const quanti = m.detti.length;
  m.cambiaLingua('en'); await m.avanza(2000);
  assert.equal(m.n.stato().pausa, true);
  assert.match(m.sottotitolo().textContent, /The Moon/);
  assert.equal(m.detti.length, quanti);
});

prova('narrazione spenta: niente voce e niente testo; «Ascolta» parla lo stesso', async () => {
  const m = creaMondo();
  m.n.impostaPreferenze({ attiva: false });
  assert.equal(await m.n.parla({ canale: 'demo', testo: 'Niente.' }), 'spenta');
  assert.equal(m.detti.length, 0);
  const e = m.n.parla({ canale: 'missione', testo: 'Un gesto esplicito.', forza: true });
  await m.avanza(1000);
  assert.equal(await e, 'tts');
});

prova('spegnere a metà frase la ferma', async () => {
  const m = creaMondo();
  const e = m.n.parla({ canale: 'demo', testo: 'Una frase lunga che non finirà mai di essere detta.' });
  await m.avanza(100);
  m.n.impostaPreferenze({ attiva: false });
  assert.equal(await e, 'interrotta');
});

prova('volume: vale per il file e per la sintesi; a zero resta il solo testo', async () => {
  const m = conFile(creaMondo({ manifest: MANIFEST }), 'demo/it/prova-1.mp3');
  m.n.impostaPreferenze({ volume: 0.4 });
  let e = m.n.parla({ canale: 'demo', id: 'demo.narr.prova.1' }); await m.avanza(2000); await e;
  assert.equal(m.suonati[0].volume, 0.4);
  e = m.n.parla({ canale: 'demo', testo: 'Ciao.' }); await m.avanza(500); await e;
  assert.equal(m.detti[0].volume, 0.4);
  m.n.impostaPreferenze({ volume: 0 });
  e = m.n.parla({ canale: 'demo', testo: 'Ciao.' }); await m.avanza(3000);
  assert.equal(await e, 'testo'); assert.equal(m.detti.length, 1);
});

prova('mostra testo spento: la voce parla e il sottotitolo non c’è', async () => {
  const m = creaMondo();
  m.n.impostaPreferenze({ testo: false });
  const e = m.n.parla({ canale: 'demo', testo: 'Ciao.' }); await m.avanza(500);
  assert.equal(await e, 'tts');
  assert.ok(!m.sottotitolo() || m.sottotitolo().hidden);
});

prova('chi ha il testo già a schermo non riceve il sottotitolo', async () => {
  const m = creaMondo();
  m.n.parla({ canale: 'missione', testo: 'Ciao.', sottotitolo: false });
  await m.avanza(10);
  assert.ok(!m.sottotitolo() || m.sottotitolo().hidden);
});

prova('le preferenze si salvano, e un salvataggio illeggibile non rompe niente', () => {
  const m = creaMondo();
  m.n.impostaPreferenze({ volume: 0.3, testo: false, soloTts: true });
  const salvato = JSON.parse(m.memoria.get('astrocalendario_narrazione'));
  assert.deepEqual(salvato, { attiva: true, volume: 0.3, testo: false, soloTts: true });
  const rotto = creaMondo({ memoria: [['astrocalendario_narrazione', '{rotto']] });
  assert.deepEqual(JSON.parse(JSON.stringify(rotto.n.preferenze())), { attiva: true, volume: 0.9, testo: true, soloTts: false });
  const fuori = creaMondo({ memoria: [['astrocalendario_narrazione', '{"volume":7}']] });
  assert.equal(fuori.n.preferenze().volume, 1);
});

prova('senza elemento audio (un browser vecchio) si va in sintesi', async () => {
  const m = conFile(creaMondo({ manifest: MANIFEST, senzaAudio: true }), 'demo/it/prova-1.mp3');
  const e = m.n.parla({ canale: 'demo', id: 'demo.narr.prova.1' });
  await m.avanza(3000);
  assert.equal(await e, 'tts');
});

// ---------------------------------------------------------------------
(async () => {
  for (const [nome, fn] of prove) {
    try { await fn(); passate++; console.log('  ok        ' + nome); }
    catch (e) { fallite++; console.log('  FALLITA   ' + nome + '\n            ' + (e && e.stack || e)); }
  }
  console.log(`\n${passate} passate, ${fallite} fallite (narrazione)`);
  process.exit(fallite ? 1 : 0);
})();
