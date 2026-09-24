#!/usr/bin/env node
/* Il manifest degli audio della narrazione, e i testi delle demo.
 *
 *   node scripts/controlla-narrazione.js             # controlla
 *   node scripts/controlla-narrazione.js --impronte  # stampa le impronte da incollare
 *
 * Tre cose che a orecchio non si sentono, perché il sintomo di tutte e tre è
 * il silenzio o la sintesi al posto dell'audio — cioè una narrazione che
 * funziona lo stesso:
 *
 *   - un audio scritto nel manifest che non c'è, o sta nel posto sbagliato;
 *   - un audio registrato per un testo che nel dizionario è poi cambiato
 *     (l'impronta non torna: suonerebbe una frase diversa da quella scritta);
 *   - un ID che il dizionario non conosce.
 *
 * E una quarta, che riguarda le demo: una frase più lunga della sua scena
 * viene tagliata al cambio di scena — la voce non si accavalla mai con la
 * frase dopo, quindi quella di prima si ferma a metà. Si controlla che ogni
 * frase stia nella durata della sua scena a un passo di parlato tranquillo. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RADICE = path.resolve(__dirname, '..');
const leggi = f => fs.readFileSync(path.join(RADICE, f), 'utf8');
const ctx = { window: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(leggi('lingue/it.js'), ctx);
vm.runInContext(leggi('lingue/en.js'), ctx);
vm.runInContext(leggi('audio/narrazione/manifest.js'), ctx);
const dizionari = ctx.window.ASTRO_DIZIONARI;
const manifest = ctx.ASTRO_NARRAZIONE_MANIFEST;
const { analizza } = require('../demo-motore.js');
const predefiniti = require('../demo-predefiniti.js');

// La stessa impronta di `narrImpronta` (FNV-1a sul testo normalizzato).
function normalizza(s) { return String(s == null ? '' : s).replace(/­/g, '').replace(/\s+/g, ' ').trim(); }
function impronta(testo) {
  let h = 0x811c9dc5;
  const s = normalizza(testo);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const ESTENSIONI = /\.(mp3|ogg|oga|opus|m4a|aac|wav|webm)$/i;
const valido = p => typeof p === 'string' && ESTENSIONI.test(p) && !/^[a-z]+:|^\/|\\|(^|\/)\.\.(\/|$)/i.test(p);
// Parlato tranquillo: due parole e mezza al secondo, più un pelo di margine
// per la pausa di partenza della sintesi.
const PAROLE_AL_SECONDO = 2.5;

const errori = [], avvisi = [];
const radice = String(manifest.radice || 'audio/narrazione/').replace(/\/?$/, '/');

if (process.argv.includes('--impronte')) {
  for (const [id, voce] of Object.entries(manifest.voci || {})) {
    for (const [lingua, x] of Object.entries(voce)) {
      const testo = (typeof x === 'object' && x.testo) || (dizionari[lingua] && dizionari[lingua].messaggi[id]);
      console.log(`${id} [${lingua}] impronta: '${testo ? impronta(testo) : '??? testo non trovato'}'`);
    }
  }
  process.exit(0);
}

// 1. Il manifest
if (manifest.versione !== 1) errori.push('manifest: versione attesa 1');
for (const [id, voce] of Object.entries(manifest.voci || {})) {
  for (const [lingua, x] of Object.entries(voce || {})) {
    if (!dizionari[lingua]) { errori.push(`${id}: lingua sconosciuta «${lingua}»`); continue; }
    const file = typeof x === 'string' ? x : x && x.file;
    if (!valido(file)) { errori.push(`${id} [${lingua}]: percorso non valido «${file}»`); continue; }
    const cartella = file.split('/').slice(0, 2).join('/');
    if (!/^(demo|missione)\/(it|en)$/.test(cartella) || !file.startsWith(cartella.split('/')[0] + '/' + lingua + '/'))
      avvisi.push(`${id} [${lingua}]: «${file}» non sta in <funzione>/${lingua}/`);
    const vero = path.join(RADICE, radice, file);
    if (!fs.existsSync(vero)) errori.push(`${id} [${lingua}]: manca il file ${radice}${file}`);
    else if (fs.statSync(vero).size < 64) errori.push(`${id} [${lingua}]: ${radice}${file} è troppo piccolo per essere un audio`);
    const testo = (typeof x === 'object' && x.testo) || dizionari[lingua].messaggi[id];
    if (typeof testo !== 'string') avvisi.push(`${id} [${lingua}]: nessun testo nel dizionario — suonerà solo se richiesto per ID`);
    else if (/\{\w+\}/.test(testo)) errori.push(`${id} [${lingua}]: il testo ha segnaposto, non si può registrare una volta per tutte`);
    else if (typeof x === 'object' && x.impronta && x.impronta !== impronta(testo))
      errori.push(`${id} [${lingua}]: l'impronta non torna — il testo è cambiato dopo la registrazione`);
    else if (typeof x !== 'object' || !x.impronta) avvisi.push(`${id} [${lingua}]: senza impronta (--impronte per stamparla)`);
  }
}

// 2. Le demo: ogni scena ha la sua narrazione, in tutte e due le lingue, e ci sta.
let scene = 0;
for (const d of predefiniti) {
  const demo = analizza(d.testo);
  demo.scene.forEach((s, i) => {
    scene++;
    const narra = s.azioni.filter(a => a.comando === 'narrate');
    if (narra.length !== 1) { errori.push(`${d.chiave} scena ${i + 1}: ${narra.length} narrazioni invece di una`); return; }
    const id = narra[0].parametri.id;
    for (const lingua of Object.keys(dizionari)) {
      const testo = dizionari[lingua].messaggi[id];
      if (typeof testo !== 'string') { errori.push(`${id}: manca in ${lingua}`); continue; }
      const parole = normalizza(testo).split(' ').length;
      const tetto = Math.floor(s.durata / 1000 * PAROLE_AL_SECONDO);
      if (parole > tetto) errori.push(`${id} [${lingua}]: ${parole} parole in ${s.durata / 1000} s (al massimo ${tetto})`);
    }
  });
}

for (const a of avvisi) console.log('  avviso   ' + a);
for (const e of errori) console.log('  ERRORE   ' + e);
const audio = Object.values(manifest.voci || {}).reduce((n, v) => n + Object.keys(v || {}).length, 0);
console.log(`\nManifest: ${audio} audio registrati · demo: ${scene} scene narrate · ${errori.length} errori, ${avvisi.length} avvisi`);
process.exit(errori.length ? 1 : 0);
