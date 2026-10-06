#!/usr/bin/env node
/* Le voci delle storie dello Studio (v421), dal salvataggio ai file:
 *
 *   node scripts/prova-voci-studio.js
 *
 * Lo Studio scrive `storie-studio.json` (in Node, con le sue funzioni pure);
 * `scripts/voci-storie.js`, lanciato su una **copia** del progetto in una
 * cartella temporanea, deve mettere le battute nel copione, nella regia e
 * nel manifest; togliendo una scena (e poi la storia intera) devono sparire
 * le battute, la loro regia, le righe del manifest e gli audio. Il progetto
 * vero non si tocca. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const RADICE = path.resolve(__dirname, '..');

// --- Lo Studio in Node, coi dizionari veri ----------------------------------
const ctxDiz = { window: {} }; ctxDiz.globalThis = ctxDiz; vm.createContext(ctxDiz);
for (const f of ['lingue/it.js', 'lingue/en.js']) vm.runInContext(fs.readFileSync(path.join(RADICE, f), 'utf8'), ctxDiz);
const DIZ = ctxDiz.window.ASTRO_DIZIONARI;
globalThis.astroI18n = {
  esiste: k => typeof DIZ.it.messaggi[k] === 'string',
  t: (k, d = {}) => String(DIZ.it.messaggi[k] || k).replace(/\{(\w+)\}/g, (m, x) => x in d ? String(d[x]) : m),
  lingua: () => 'it'
};
require('../storie-cosmiche.js');
const St = require('../storie-studio.js');

// --- La copia del progetto ----------------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voci-studio-'));
for (const f of ['lingue/it.js', 'lingue/en.js', 'storie-cosmiche.js', 'demo-motore.js', 'demo-predefiniti.js', 'app.js',
  'scripts/voci-storie.js', 'audio/narrazione/manifest.js']) {
  fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
  fs.copyFileSync(path.join(RADICE, f), path.join(tmp, f));
}
fs.cpSync(path.join(RADICE, 'audio/narrazione/storie'), path.join(tmp, 'audio/narrazione/storie'), { recursive: true });
const STORIE = path.join(tmp, 'audio/narrazione/storie');
const leggiT = f => fs.readFileSync(path.join(tmp, f), 'utf8');
const regiaPrima = JSON.parse(leggiT('audio/narrazione/storie/regia-voci.json'));
function voci(...arg) {
  return execFileSync(process.execPath, [path.join(tmp, 'scripts/voci-storie.js'), ...arg], { encoding: 'utf8' });
}
function manifest() {
  const ctx = {}; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(leggiT('audio/narrazione/manifest.js'), ctx);
  return ctx.ASTRO_NARRAZIONE_MANIFEST;
}
const audioFinto = () => Buffer.alloc(400, 0);

let fatte = 0;
function prova(nome, fn) {
  try { fn(); fatte++; console.log('  ok  ' + nome); }
  catch (e) { console.log('  NO  ' + nome + '\n      ' + e.message); process.exitCode = 1; }
}

// --- Una storia dello Studio: due scene, tre battute ---------------------------
const p = St.nuovoProgetto({ titolo: 'La Luna e Marte!', cast: ['Moon', 'Mars'] });
p.scene = [
  St.nuovaScena({ ambiente: 'sistema', momenti: [
    St.nuovoMomento({ chi: 'Moon', testo: 'Ciao Marte, come stai?', umore: 'happy' }),
    St.nuovoMomento({ chi: 'Mars', testo: 'Ho freddo, sono lontano dal Sole.', umore: 'sad' })] }),
  St.nuovaScena({ ambiente: 'sistema', momenti: [
    St.nuovoMomento({ chi: 'Moon', testo: 'Allora vieni più vicino!', umore: 'excited' }),
    St.nuovoMomento({ chi: 'Mars', testo: '' })] })   // un momento muto non è una battuta
];
let foto = {};
function salva(progetto) {
  for (const k of Object.keys(foto)) if (foto[k].progetto === progetto.id) delete foto[k];
  const f = St.vociStoria(progetto, 'it', new Set(Object.keys(foto)));
  foto[f.chiave] = f;
  fs.writeFileSync(path.join(STORIE, 'storie-studio.json'), St.fileVoci(foto));
  return f;
}

console.log('Le voci delle storie dello Studio\n');
const f1 = salva(p);

prova('lo Studio dà un nome alla storia e un numero a ogni battuta', () => {
  assert.equal(f1.chiave, 'studio_la_luna_e_marte');
  assert.deepEqual(f1.battute.map(b => b.n), [1, 2, 3]);
  assert.deepEqual(f1.battute.map(b => b.scena), [1, 2, 3]);
  assert.equal(p.voceProssima, 4);
  assert.ok(f1.battute.every(b => b.durata >= 4000), 'durata in millisecondi');
  // Ricaricato dall'archivio, il progetto tiene i numeri
  const r = St.ripulisci(JSON.parse(JSON.stringify(p)));
  assert.equal(r.voceChiave, 'studio_la_luna_e_marte');
  assert.deepEqual(r.scene.flatMap(sc => sc.momenti.map(m => m.voce)), [1, 2, 3, 0]);
});

prova('una voce caricata decide la durata del momento, finché il testo è quello', () => {
  const m = St.nuovoMomento({ chi: 'Moon', testo: 'Ciao   Marte, come stai?' });
  const senza = St.durata(m);
  m.audio = { durata: 7300, impronta: St.impronta('Ciao Marte, come stai?'), nome: 'luna.mp3' };
  assert.ok(St.voceValida(m));
  assert.equal(St.durata(m), 8, 'la voce più un respiro');
  m.durata = 12;
  assert.equal(St.durata(m), 12, 'una pausa scritta a mano più lunga resta');
  m.durata = 2;
  assert.equal(St.durata(m), 8, 'più corta no: taglierebbe la voce');
  m.durata = 0;
  // Nel copione la scena dura quanto la voce
  const pr = St.nuovoProgetto({ cast: ['Moon'], scene: [St.nuovaScena({ ambiente: 'sistema', presenti: ['Moon'], momenti: [m] })] });
  assert.match(St.copione(pr), /duration: 8s;/);
  // Ricaricata dall'archivio, la voce resta
  assert.deepEqual(St.ripulisci(JSON.parse(JSON.stringify(pr))).scene[0].momenti[0].audio, m.audio);
  // Il testo cambia: la voce non vale più e la durata torna quella del testo
  m.testo = 'Ciao Marte!';
  assert.ok(!St.voceValida(m));
  assert.notEqual(St.durata(m), 8);
  assert.ok(senza > 0);
  // La stessa impronta della narrazione
  assert.equal(St.impronta('Oh  no! Dov’è?'), require('../narrazione.js').impronta('Oh no! Dov’è?'));
});

prova('due storie con lo stesso titolo non si mescolano', () => {
  const altra = St.nuovoProgetto({ titolo: 'La Luna e Marte!' });
  const chiave = St.vociStoria(altra, 'it', new Set(['studio_la_luna_e_marte'])).chiave;
  assert.equal(chiave, 'studio_la_luna_e_marte_2');
});

prova('lo script mette le battute nuove nel copione e nella regia', () => {
  voci();
  const copione = leggiT('audio/narrazione/storie/COPIONE.md');
  assert.match(copione, /`studio_la_luna_e_marte-1\.mp3` — manca .*Studio: La Luna e Marte!, scena 1/);
  assert.match(copione, /`studio_la_luna_e_marte-2\.mp3`/);
  assert.match(copione, /## Marte/);
  const regia = JSON.parse(leggiT('audio/narrazione/storie/regia-voci.json'));
  assert.deepEqual(regia.battute['studio.studio_la_luna_e_marte.1'].conTag, { it: '[happy] Ciao Marte, come stai?' });
  assert.equal(regia.battute['studio.studio_la_luna_e_marte.2'].emozione, 'triste');
  // Le storie pronte restano com'erano
  for (const [id, r] of Object.entries(regiaPrima.battute)) assert.deepEqual(regia.battute[id], r, id);
  assert.deepEqual(regia.personaggi, regiaPrima.personaggi);
  assert.ok(fs.existsSync(path.join(STORIE, 'marte/it/.gitkeep')), 'la cartella di Marte');
});

prova('una regia ritoccata a mano resta, finché il testo non cambia', () => {
  const file = path.join(STORIE, 'regia-voci.json');
  const regia = JSON.parse(fs.readFileSync(file, 'utf8'));
  regia.battute['studio.studio_la_luna_e_marte.1'] = { emozione: 'allegra', come: 'saltellando', conTag: { it: '[laughs] Ciao Marte, [curious] come stai?' } };
  fs.writeFileSync(file, JSON.stringify(regia, null, 2) + '\n');
  voci();
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).battute['studio.studio_la_luna_e_marte.1'].come, 'saltellando');
});

prova('un audio caricato entra nel manifest col suo testo', () => {
  for (const [chi, n] of [['luna', 1], ['marte', 2], ['luna', 3]])
    fs.writeFileSync(path.join(STORIE, `${chi}/it/studio_la_luna_e_marte-${n}.mp3`), audioFinto());
  voci();
  const m = manifest();
  const v = m.voci['studio.studio_la_luna_e_marte.2'].it;
  assert.equal(v.file, 'storie/marte/it/studio_la_luna_e_marte-2.mp3');
  assert.equal(v.testo, 'Ho freddo, sono lontano dal Sole.');
  assert.equal(v.impronta, require(path.join(tmp, 'scripts/voci-storie.js')).impronta(v.testo));
  assert.match(leggiT('audio/narrazione/storie/COPIONE.md'), /`studio_la_luna_e_marte-2\.mp3` — pronta/);
  voci('--controlla');   // tutto a posto: esce con 0
});

prova('togliere la prima scena toglie le sue battute, la regia e gli audio; le altre restano', () => {
  p.scene.splice(0, 1);
  const f = salva(p);
  assert.deepEqual(f.battute.map(b => b.n), [3], 'il numero non cambia');
  assert.throws(() => voci('--controlla'), 'prima dello script, il controllo è rosso');
  voci();
  assert.ok(!fs.existsSync(path.join(STORIE, 'luna/it/studio_la_luna_e_marte-1.mp3')));
  assert.ok(!fs.existsSync(path.join(STORIE, 'marte/it/studio_la_luna_e_marte-2.mp3')));
  assert.ok(fs.existsSync(path.join(STORIE, 'luna/it/studio_la_luna_e_marte-3.mp3')));
  const m = manifest();
  assert.ok(!m.voci['studio.studio_la_luna_e_marte.1'] && !m.voci['studio.studio_la_luna_e_marte.2']);
  assert.equal(m.voci['studio.studio_la_luna_e_marte.3'].it.testo, 'Allora vieni più vicino!');
  const regia = JSON.parse(leggiT('audio/narrazione/storie/regia-voci.json'));
  assert.ok(!regia.battute['studio.studio_la_luna_e_marte.1'] && regia.battute['studio.studio_la_luna_e_marte.3']);
  const copione = leggiT('audio/narrazione/storie/COPIONE.md');
  assert.doesNotMatch(copione, /## Marte/, 'Marte non ha più battute');
  assert.match(copione, /studio_la_luna_e_marte-3\.mp3/);
});

prova('un testo cambiato rende l\'audio «da rifare» e rifà la regia', () => {
  p.scene[0].momenti[0].testo = 'Vieni più vicino, Marte!';
  salva(p);
  voci();
  assert.match(leggiT('audio/narrazione/storie/COPIONE.md'), /studio_la_luna_e_marte-3\.mp3` — \*\*da rifare\*\*/);
  const regia = JSON.parse(leggiT('audio/narrazione/storie/regia-voci.json'));
  assert.deepEqual(regia.battute['studio.studio_la_luna_e_marte.3'].conTag, { it: '[excited] Vieni più vicino, Marte!' });
});

prova('cancellare la storia la toglie da tutto, e il resto torna com\'era', () => {
  foto = {};
  fs.writeFileSync(path.join(STORIE, 'storie-studio.json'), St.fileVoci(foto));
  voci();
  assert.ok(!fs.existsSync(path.join(STORIE, 'luna/it/studio_la_luna_e_marte-3.mp3')));
  assert.deepEqual(JSON.parse(leggiT('audio/narrazione/storie/regia-voci.json')).battute, regiaPrima.battute);
  assert.equal(leggiT('audio/narrazione/manifest.js'), fs.readFileSync(path.join(RADICE, 'audio/narrazione/manifest.js'), 'utf8'));
  assert.equal(leggiT('audio/narrazione/storie/COPIONE.md'), fs.readFileSync(path.join(RADICE, 'audio/narrazione/storie/COPIONE.md'), 'utf8'));
});

prova('un file dello Studio rotto non cancella niente, e lo dice', () => {
  // Rotto, le sue battute sembrerebbero tutte sparite: nessun audio va via
  fs.writeFileSync(path.join(STORIE, 'luna/it/studio_altra-1.mp3'), audioFinto());
  fs.writeFileSync(path.join(STORIE, 'storie-studio.json'), '{ rotto');
  let uscita = '';
  try { voci(); } catch (e) { uscita = String(e.stdout); }
  assert.match(uscita, /non è JSON valido/);
  assert.ok(fs.existsSync(path.join(STORIE, 'luna/it/studio_altra-1.mp3')));
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${fatte} prove passate${process.exitCode ? ', qualcuna NO' : ''}.`);
