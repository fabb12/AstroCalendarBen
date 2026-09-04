/* Il gestore delle lingue, senza browser.
 * ======================================
 *
 * Le prove che non hanno bisogno di un documento: il registro, la lettura di
 * un messaggio, il plurale, il ripiego, i formati. Girano in un `vm` con un
 * DOM finto ridotto all'osso, e servono per essere veloci — mezzo secondo,
 * nessuna dipendenza da installare — così si possono lanciare a ogni modifica.
 *
 *     node scripts/prova-i18n.js
 *
 * Quello che qui **non** si può provare è tutto ciò che dipende
 * dall'impaginazione: l'indice dei nodi, il ridisegno delle viste, quanto
 * costa un cambio lingua, e la sola domanda che conta davvero — se sullo
 * schermo resta dell'italiano. Per quelle c'è `scripts/prova-lingua.js`, che
 * apre l'applicazione in un Chromium vero.
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.join(__dirname, '..');

// --- Un DOM finto, quanto basta a far partire il gestore ------------------
//
// `avvia()` installa il bottone, apre il sorvegliante e indicizza il body: qui
// non c'è nulla di tutto questo, e le tre chiamate devono cadere nel vuoto
// senza sollevare. È anche una prova: il gestore non deve pretendere un
// documento vero per rispondere a `t()`.
function elementoFinto(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    childNodes: [], attributes: [], dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
    isConnected: true, firstElementChild: null,
    hasAttribute: () => false, getAttribute: () => null, setAttribute() {}, removeAttribute() {},
    matches: () => false, querySelectorAll: () => [], appendChild() {}, addEventListener() {}
  };
}
const body = elementoFinto('body');
const document = {
  readyState: 'complete',
  body,
  documentElement: { lang: '', dataset: {} },
  title: '',
  addEventListener() {}, dispatchEvent() {},
  querySelector: () => null,
  getElementById: () => null,
  createElement: (tag) => elementoFinto(tag),
  createTextNode: (t) => ({ nodeType: 3, nodeValue: t })
};

const contesto = {
  window: {}, document,
  navigator: { languages: ['it-IT'], language: 'it-IT' },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  console, Intl, Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
  CustomEvent: function CustomEvent(nome, opz) { this.type = nome; Object.assign(this, opz); },
  MutationObserver: function MutationObserver() { this.observe = () => {}; this.disconnect = () => {}; },
  Promise, AbortController, fetch: () => Promise.reject(new Error('niente rete nelle prove')),
  setTimeout, clearTimeout
};
contesto.globalThis = contesto;

// I dizionari si caricano come li carica index.html: prima loro, poi il gestore.
for (const file of ['lingue/it.js', 'lingue/en.js', 'i18n.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(RADICE, file), 'utf8'), contesto, { filename: file });
}
const i18n = contesto.window.astroI18n;

let ko = 0;
function prova(nome, corpo) {
  try { corpo(); console.log('  ok        ' + nome); }
  catch (errore) { console.log('  FALLITO   ' + nome + '\n              ' + errore.message); ko++; }
}

// =========================================================================
console.log('\n— i dizionari, e il registro —');

prova('le due lingue sono registrate', () => {
  // Le liste che arrivano dal `vm` hanno il prototipo di *quel* realm, quindi
  // `deepStrictEqual` le rifiuta anche identiche: si copiano qui prima.
  assert.deepStrictEqual([...i18n.getSupportedLanguages()], ['it', 'en']);
});
prova("si parte dall'italiano", () => {
  assert.strictEqual(i18n.getLanguage(), 'it');
  assert.strictEqual(i18n.getLocale(), 'it-IT');
});
prova('i due dizionari hanno le stesse chiavi', () => {
  const it = Object.keys(contesto.window.ASTRO_DIZIONARI.it.messaggi);
  const en = Object.keys(contesto.window.ASTRO_DIZIONARI.en.messaggi);
  const senzaEn = it.filter(k => !en.includes(k));
  const senzaIt = en.filter(k => !it.includes(k));
  assert.deepStrictEqual(senzaEn, [], `${senzaEn.length} chiavi senza inglese: ${senzaEn.slice(0, 5)}`);
  assert.deepStrictEqual(senzaIt, [], `${senzaIt.length} chiavi senza italiano: ${senzaIt.slice(0, 5)}`);
  assert.ok(it.length > 800, `solo ${it.length} chiavi`);
});
prova('i segnaposto sono gli stessi nelle due lingue', () => {
  // Se una traduzione perde un `{n}`, il numero sparisce dallo schermo senza
  // che niente lo dica: è il difetto di traduzione più silenzioso che ci sia.
  const it = contesto.window.ASTRO_DIZIONARI.it.messaggi;
  const en = contesto.window.ASTRO_DIZIONARI.en.messaggi;
  const segnaposti = (v) => {
    const testi = typeof v === 'string' ? [v] : Object.values(v || {});
    const trovati = new Set();
    for (const t of testi) for (const m of String(t).matchAll(/\{([\w.-]+)\}/g)) trovati.add(m[1]);
    return [...trovati].sort();
  };
  const guai = [];
  for (const [chiave, valore] of Object.entries(it)) {
    const a = segnaposti(valore).join(','), b = segnaposti(en[chiave]).join(',');
    if (a !== b) guai.push(`${chiave}: it{${a}} ≠ en{${b}}`);
  }
  assert.deepStrictEqual(guai, [], guai.slice(0, 6).join(' | '));
});

// =========================================================================
console.log('\n— la lettura di un messaggio —');

prova('una chiave si legge', () => {
  assert.strictEqual(i18n.t('ui.chiudi'), 'Chiudi');
});
prova('i segnaposto si sostituiscono', () => {
  i18n.setLanguage('it');
  assert.strictEqual(i18n.t('stasera.puntiSu100', { n: 87 }), '87 su 100');
});
prova('un segnaposto senza valore resta scritto', () => {
  // Meglio `{n}` sullo schermo che «undefined»: si vede e si corregge.
  assert.strictEqual(i18n.t('stasera.puntiSu100'), '{n} su 100');
});
prova('il numero prende il separatore della lingua', () => {
  // Cinque cifre e non quattro, di proposito: in italiano un numero di
  // quattro cifre **non** porta il separatore (5800, non 5.800) mentre in
  // inglese sì (5,800). È la regola CLDR, `Intl` la applica, e provarla su
  // 5800 vorrebbe dire scrivere una prova che pretende un italiano sbagliato.
  i18n.setLanguage('it');
  const italiano = i18n.t('scheda.kelvinInSuperficie', { k: 15800 });
  i18n.setLanguage('en');
  const inglese = i18n.t('scheda.kelvinInSuperficie', { k: 15800 });
  assert.ok(italiano.includes('15.800'), italiano);
  assert.ok(inglese.includes('15,800'), inglese);
});
prova('e in italiano quattro cifre restano senza separatore', () => {
  // La conseguenza da conoscere: la frase della stella dice «5800 gradi» e
  // quella del Sole accanto deve dire «5800» anche lei, se no nella stessa
  // riga si leggono due modi di scrivere lo stesso numero.
  i18n.setLanguage('it');
  assert.ok(i18n.t('scheda.kelvinInSuperficie', { k: 5800 }).includes('5800'));
  assert.ok(i18n.t('scheda.ilSoleNeHa').includes('5800'));
  assert.ok(!i18n.t('scheda.ilSoleNeHa').includes('5.800'));
});

// =========================================================================
console.log('\n— il plurale —');

prova('«fra 1 giorno» e «fra 3 giorni»', () => {
  i18n.setLanguage('it');
  assert.strictEqual(i18n.t('tempo.fraGiorni', { n: 1 }), 'fra 1 giorno');
  assert.strictEqual(i18n.t('tempo.fraGiorni', { n: 3 }), 'fra 3 giorni');
});
prova('«in 1 day» e «in 3 days»', () => {
  i18n.setLanguage('en');
  assert.strictEqual(i18n.t('tempo.fraGiorni', { n: 1 }), 'in 1 day');
  assert.strictEqual(i18n.t('tempo.fraGiorni', { n: 3 }), 'in 3 days');
});
prova('senza numero si prende la forma plurale', () => {
  assert.strictEqual(i18n.t('tempo.fraGiorni'), 'in {n} days');
});

// =========================================================================
console.log('\n— il ripiego —');

prova('una chiave che non esiste restituisce il suo nome', () => {
  assert.strictEqual(i18n.t('non.esiste.per.niente'), 'non.esiste.per.niente');
});
prova('e non solleva con dei valori', () => {
  assert.strictEqual(i18n.t('non.esiste.nemmeno', { n: 3 }), 'non.esiste.nemmeno');
});
prova('una chiave vuota non solleva', () => {
  assert.strictEqual(i18n.t(''), '');
  assert.strictEqual(i18n.t(null), '');
  assert.strictEqual(i18n.t(undefined), '');
});
prova('una lingua nuova ripiega sulla base', () => {
  i18n.registraLingua('fr', {
    locale: 'fr-FR', nome: 'Français', manifest: 'manifest-fr.json',
    messaggi: { 'lingua.cambio': 'Passer en {lingua}', 'prova.sola': 'Bonjour {name}' }
  });
  i18n.setLanguage('fr');
  assert.strictEqual(i18n.getLocale(), 'fr-FR');
  assert.strictEqual(i18n.t('prova.sola', { name: 'Ada' }), 'Bonjour Ada');
  // `ui.chiudi` in francese non c'è: viene l'italiano, non un buco.
  assert.strictEqual(i18n.t('ui.chiudi'), 'Chiudi');
});
prova('le mancanti finiscono nel rapporto, una volta per chiave', () => {
  const elenco = i18n.mancanti().map(v => v.chiave);
  assert.ok(elenco.includes('non.esiste.per.niente'), elenco.slice(0, 5).join(', '));
  assert.strictEqual(new Set(elenco).size, elenco.length, 'chiavi ripetute nel rapporto');
});
prova('esiste() distingue una chiave vera da una inventata', () => {
  assert.strictEqual(i18n.esiste('ui.chiudi'), true);
  assert.strictEqual(i18n.esiste('non.esiste.per.niente'), false);
});
prova('un codice lingua storto viene rifiutato', () => {
  // Il `TypeError` viene dal realm del `vm`: si guarda il nome, non il
  // prototipo, che qui non può combaciare.
  assert.throws(() => i18n.registraLingua('non valido!', {}),
    (e) => e.name === 'TypeError' && /Codice lingua non valido/.test(e.message));
});
prova('una lingua sconosciuta ricade sulla base', () => {
  assert.strictEqual(i18n.setLanguage('zz'), 'it');
});

// =========================================================================
console.log('\n— i conti alla rovescia e i formati —');

const MINUTO = 60000, ORA = 3600000, GIORNO = 86400000;
prova('la precisione si adatta alla distanza', () => {
  i18n.setLanguage('it');
  assert.strictEqual(i18n.quantoManca(2000), 'fra pochi istanti');
  assert.strictEqual(i18n.quantoManca(42000), 'fra 42 secondi');
  assert.strictEqual(i18n.quantoManca(25 * MINUTO), 'fra 25 minuti');
  assert.strictEqual(i18n.quantoManca(2.25 * ORA), 'fra 2 h 15 min');
  assert.strictEqual(i18n.quantoManca(3 * GIORNO), 'fra 3 giorni');
  assert.strictEqual(i18n.quantoManca(200 * GIORNO), 'fra 7 mesi');
  assert.strictEqual(i18n.quantoManca(4.5 * 365.25 * GIORNO), 'fra 4 anni e 6 mesi');
});
prova('i secondi si dicono solo sotto i dieci minuti', () => {
  // Sapere che mancano «due ore e quindici» è utile; «due ore, quindici
  // minuti e otto secondi» è una cifra da leggere per niente.
  assert.ok(/s$/.test(i18n.quantoManca(5 * MINUTO + 8000)));
  assert.strictEqual(i18n.quantoManca(25 * MINUTO + 8000), 'fra 25 minuti');
});
prova('il passato e l’adesso', () => {
  assert.strictEqual(i18n.quantoManca(0), 'passato');
  assert.strictEqual(i18n.quantoManca(-1000, { codaMs: 5000 }), 'adesso');
  assert.strictEqual(i18n.quantoManca(-9000, { codaMs: 5000 }), 'passato');
});
prova('un valore che non è un numero non solleva', () => {
  assert.strictEqual(i18n.quantoManca(NaN), '');
  assert.strictEqual(i18n.quantoManca(Infinity), '');
  assert.strictEqual(i18n.quantoManca('boh'), '');
});
prova('lo scarto porta il verso', () => {
  assert.strictEqual(i18n.scartoTempo(3 * GIORNO + 4 * ORA), 'fra 3 g 4 h');
  assert.strictEqual(i18n.scartoTempo(-(3 * GIORNO + 4 * ORA)), '3 g 4 h fa');
  assert.strictEqual(i18n.scartoTempo(0), 'adesso');
});
prova("l'ovest non è «O» in inglese", () => {
  i18n.setLanguage('it');
  assert.strictEqual(i18n.siglaPunto(270), 'O');
  assert.strictEqual(i18n.nomePunto(270), 'ovest');
  i18n.setLanguage('en');
  assert.strictEqual(i18n.siglaPunto(270), 'W');
  assert.strictEqual(i18n.nomePunto(270), 'west');
});
prova('la rosa gira senza salti attorno al nord', () => {
  assert.strictEqual(i18n.siglaPunto(0), 'N');
  assert.strictEqual(i18n.siglaPunto(360), 'N');
  assert.strictEqual(i18n.siglaPunto(-10), 'N');
  assert.strictEqual(i18n.siglaPunto(350), 'N');
  assert.strictEqual(i18n.siglaPunto(90), 'E');
});

// =========================================================================
console.log('\n— gli ascoltatori —');

prova('vengono chiamati, e si staccano', () => {
  let quante = 0;
  const stacca = i18n.alCambio(() => quante++);
  i18n.setLanguage('it');
  i18n.setLanguage('en');
  assert.strictEqual(quante, 2);
  stacca();
  i18n.setLanguage('it');
  assert.strictEqual(quante, 2);
});
prova('uno che cade non ferma gli altri', () => {
  let secondo = false;
  const a = i18n.alCambio(() => { throw new Error('di proposito'); });
  const b = i18n.alCambio(() => { secondo = true; });
  i18n.setLanguage('en');
  a(); b();
  assert.strictEqual(secondo, true);
});

// =========================================================================
console.log(ko === 0 ? '\n✓ tutte le prove passate' : `\n✗ ${ko} prove fallite`);
process.exit(ko === 0 ? 0 : 1);
