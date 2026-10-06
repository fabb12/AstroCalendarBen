#!/usr/bin/env node
/* Le storie dello Studio sul repository (v424, storie-studio.js §6b):
 *
 *   node scripts/prova-storie-repo.js
 *
 * Due «dispositivi» (due contesti con il loro localStorage) e un GitHub
 * finto in memoria, con l'API dei contenuti e quella Git (blob, albero,
 * commit, ramo). Una storia salvata dal primo deve comparire nel secondo,
 * con la sua demo; la versione toccata per ultima vince; un'eliminazione
 * arriva anche all'altro e non torna indietro; senza token si legge e basta;
 * un ramo andato avanti nel frattempo fa riprovare invece di perdere dati. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const RADICE = path.resolve(__dirname, '..');
const leggi = f => fs.readFileSync(path.join(RADICE, f), 'utf8');
const REPO = 'prova/astro', RAMO = 'main', TOKEN = 'segreto';

// --- Il GitHub finto ----------------------------------------------------------
const gh = {
  oggetti: new Map(), testa: '', chiamate: [], scritture: 0, rifiutaProssima: false,
  sha: o => crypto.createHash('sha1').update(JSON.stringify(o) + Math.random()).digest('hex'),
  albero(sha) { return new Map(this.oggetti.get(sha).voci); },
  file(percorso) {
    const blob = this.albero(this.oggetti.get(this.testa).tree).get(percorso);
    return blob ? this.oggetti.get(blob).contenuto : null;
  }
};
{
  const t0 = gh.sha('t0'); gh.oggetti.set(t0, { voci: [['README.md', 'b0']] });
  gh.oggetti.set('b0', { contenuto: 'ciao\n' });
  const c0 = gh.sha('c0'); gh.oggetti.set(c0, { tree: t0, parents: [] });
  gh.testa = c0;
}
const risposta = (status, corpo, testo) => ({
  status, ok: status >= 200 && status < 300,
  json: async () => corpo, text: async () => testo !== undefined ? testo : JSON.stringify(corpo)
});
async function fetchFinto(url, op = {}) {
  const u = new URL(url);
  const metodo = op.method || 'GET';
  const auth = op.headers && op.headers.Authorization;
  gh.chiamate.push(metodo + ' ' + u.pathname);
  if (u.hostname === 'raw.githubusercontent.com') return risposta(404, {});
  assert.equal(u.hostname, 'api.github.com');
  const base = '/repos/' + REPO;
  assert.ok(u.pathname.startsWith(base), u.pathname);
  const via = decodeURIComponent(u.pathname.slice(base.length));
  const corpo = op.body ? JSON.parse(op.body) : null;
  if (metodo !== 'GET' && auth !== 'Bearer ' + TOKEN) return risposta(401, { message: 'Bad credentials' });
  if (metodo === 'GET' && via.startsWith('/contents/')) {
    assert.equal(u.searchParams.get('ref'), RAMO);
    const f = gh.file(via.slice('/contents/'.length));
    return f === null ? risposta(404, {}) : risposta(200, null, f);
  }
  if (metodo === 'GET' && via === '/git/ref/heads/' + RAMO) return risposta(200, { object: { sha: gh.testa } });
  if (metodo === 'GET' && via.startsWith('/git/commits/')) return risposta(200, { tree: { sha: gh.oggetti.get(via.slice(13)).tree } });
  if (metodo === 'POST' && via === '/git/blobs') {
    const sha = gh.sha(corpo);
    gh.oggetti.set(sha, { contenuto: corpo.encoding === 'base64' ? Buffer.from(corpo.content, 'base64').toString('utf8') : corpo.content });
    return risposta(201, { sha });
  }
  if (metodo === 'POST' && via === '/git/trees') {
    const voci = gh.albero(corpo.base_tree);
    for (const v of corpo.tree) voci.set(v.path, v.sha);
    const sha = gh.sha(corpo); gh.oggetti.set(sha, { voci: [...voci] });
    return risposta(201, { sha });
  }
  if (metodo === 'POST' && via === '/git/commits') {
    const sha = gh.sha(corpo); gh.oggetti.set(sha, { tree: corpo.tree, parents: corpo.parents });
    return risposta(201, { sha });
  }
  if (metodo === 'PATCH' && via === '/git/refs/heads/' + RAMO) {
    const c = gh.oggetti.get(corpo.sha);
    if (gh.rifiutaProssima) {
      // qualcun altro scrive un attimo prima: il ramo va avanti
      gh.rifiutaProssima = false;
      const altro = gh.sha('altro'); gh.oggetti.set(altro, { tree: gh.oggetti.get(gh.testa).tree, parents: [gh.testa] });
      gh.testa = altro;
    }
    if (c.parents[0] !== gh.testa) return risposta(422, { message: 'Update is not a fast forward' });
    gh.testa = corpo.sha; gh.scritture++;
    return risposta(200, { object: { sha: corpo.sha } });
  }
  throw new Error('chiamata non prevista: ' + metodo + ' ' + via);
}

// --- I dispositivi ------------------------------------------------------------
let orologio = Date.parse('2026-10-06T10:00:00Z');
function dispositivo(token) {
  const memoria = new Map();
  const localStorage = { getItem: k => memoria.has(k) ? memoria.get(k) : null, setItem: (k, v) => memoria.set(k, String(v)), removeItem: k => memoria.delete(k) };
  const ctx = {
    console, localStorage, fetch: fetchFinto, URL, TextEncoder, crypto: globalThis.crypto, btoa, setTimeout, clearTimeout,
    Date: class extends Date { static now() { return orologio; } }, Promise, JSON, Math
  };
  ctx.globalThis = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['lingue/it.js', 'lingue/en.js']) vm.runInContext(leggi(f), ctx);
  const DIZ = ctx.window.ASTRO_DIZIONARI;
  ctx.astroI18n = {
    esiste: k => typeof DIZ.it.messaggi[k] === 'string',
    t: (k, d = {}) => String(DIZ.it.messaggi[k] || k).replace(/\{(\w+)\}/g, (m, x) => x in d ? String(d[x]) : m),
    lingua: () => 'it'
  };
  vm.runInContext(leggi('storie-cosmiche.js'), ctx);
  vm.runInContext(leggi('demo-libreria.js'), ctx);
  ctx.AstroDemo = { libreria: ctx.AstroDemoLibreria.crea(localStorage, [], () => true) };
  vm.runInContext(leggi('storie-studio.js'), ctx);
  localStorage.setItem('astrocal_storie_repo_v1', JSON.stringify({ repo: REPO, ramo: RAMO, token: token || '' }));
  const St = ctx.StudioStorie;
  return {
    ctx, St, localStorage,
    progetti: () => JSON.parse(localStorage.getItem(St.CHIAVE) || '[]'),
    demo: () => JSON.parse(localStorage.getItem(ctx.AstroDemoLibreria.CHIAVE) || '[]'),
    // Come fa «Salva nelle mie demo»: la demo, poi il progetto, poi il giro
    salva(p) {
      p.demoChiave = ctx.AstroDemo.libreria.salva(St.copione(p), p.demoChiave || undefined);
      p.aggiornato = ++orologio;
      const tutti = this.progetti().filter(x => x.id !== p.id);
      localStorage.setItem(St.CHIAVE, JSON.stringify([p, ...tutti]));
      return St.sincronizza({ spingi: true, titolo: p.titolo });
    }
  };
}

const prove = [];
const prova = (nome, fn) => prove.push([nome, fn]);

const A = dispositivo(TOKEN), B = dispositivo(TOKEN), C = dispositivo('');
let storia;

prova('il repository di serie viene dall\'indirizzo di Pages', () => {
  assert.equal(A.St.repoDiSerie({ hostname: 'fabb12.github.io', pathname: '/AstroCalendarBen/index.html' }), 'fabb12/AstroCalendarBen');
  assert.equal(A.St.repoDiSerie({ hostname: 'localhost', pathname: '/' }), 'fabb12/AstroCalendarBen');
});

prova('una storia salvata dal primo dispositivo va sul repository in un commit solo', async () => {
  storia = A.St.daModello('fasi');
  storia.titolo = 'La Luna che cambia';
  const msg = await A.salva(storia);
  assert.match(msg, /Salvata nel repository/);
  assert.equal(gh.scritture, 1);
  const file = JSON.parse(gh.file(A.St.FILE_CONDIVISE));
  assert.equal(file.storie.length, 1);
  assert.equal(file.storie[0].titolo, 'La Luna che cambia');
  assert.ok(gh.file('audio/narrazione/storie/storie-studio.json'), 'manca il file delle voci');
  assert.equal(gh.file('README.md'), 'ciao\n', 'il resto del repository resta');
});

prova('salvarla di nuovo senza cambiare niente non fa commit', async () => {
  const msg = await A.St.sincronizza({ spingi: true });
  assert.match(msg, /già aggiornato/);
  assert.equal(gh.scritture, 1);
});

prova('il secondo dispositivo la trova, con la sua demo', async () => {
  const msg = await B.St.sincronizza({ spingi: false });
  assert.match(msg, /storie nuove o aggiornate 1/);
  const p = B.progetti();
  assert.equal(p.length, 1);
  assert.equal(p[0].titolo, 'La Luna che cambia');
  assert.ok(B.demo().some(d => d.chiave === p[0].demoChiave), 'la demo non c\'è');
});

prova('senza token si legge, e scrivere chiede il token', async () => {
  const msg = await C.St.sincronizza({ spingi: true });
  assert.equal(C.progetti().length, 1);
  assert.match(msg, /token/);
  assert.equal(gh.scritture, 1);
});

prova('vince la versione toccata per ultima', async () => {
  const p = B.progetti()[0];
  p.titolo = 'La Luna, dal telefono';
  await B.salva(p);
  await A.St.sincronizza();
  assert.equal(A.progetti()[0].titolo, 'La Luna, dal telefono');
  // e una più vecchia non scavalca quella nuova
  const vecchia = JSON.parse(JSON.stringify(storia)); vecchia.titolo = 'vecchia'; vecchia.aggiornato = 5;
  const u = A.St.unisci(A.progetti(), {}, { progetti: [A.St.ripulisci(vecchia)], eliminati: {} });
  assert.equal(u.progetti[0].titolo, 'La Luna, dal telefono');
  assert.equal(u.arrivati.length, 0);
});

prova('le storie di due dispositivi si sommano', async () => {
  const altra = B.St.daModello('giganti'); altra.titolo = 'I giganti';
  await B.salva(altra);
  const terza = A.St.daModello('libera'); terza.titolo = 'Dal computer';
  await A.salva(terza);
  const titoli = JSON.parse(gh.file(A.St.FILE_CONDIVISE)).storie.map(s => s.titolo).sort();
  assert.deepEqual(titoli, ['Dal computer', 'I giganti', 'La Luna, dal telefono']);
});

prova('un ramo andato avanti nel frattempo fa riprovare, senza perdere niente', async () => {
  const p = A.progetti().find(x => x.titolo === 'Dal computer');
  p.titolo = 'Dal computer, ritoccata';
  gh.rifiutaProssima = true;
  const prima = gh.scritture;
  const msg = await A.salva(p);
  assert.match(msg, /Salvata nel repository/);
  assert.equal(gh.scritture, prima + 1);
  assert.ok(JSON.parse(gh.file(A.St.FILE_CONDIVISE)).storie.some(s => s.titolo === 'Dal computer, ritoccata'));
});

prova('una storia eliminata sparisce anche dall\'altro, e non torna', async () => {
  await B.St.sincronizza();
  const via = A.progetti().find(x => x.titolo === 'I giganti');
  // come fa «Elimina»: via dall'archivio, una lapide, il giro
  A.localStorage.setItem(A.St.CHIAVE, JSON.stringify(A.progetti().filter(x => x.id !== via.id)));
  A.localStorage.setItem('astrocal_storie_eliminati_v1', JSON.stringify({ [via.id]: ++orologio }));
  await A.St.sincronizza({ spingi: true });
  const file = JSON.parse(gh.file(A.St.FILE_CONDIVISE));
  assert.ok(!file.storie.some(s => s.id === via.id));
  assert.ok(file.eliminati[via.id] > 0);
  const msg = await B.St.sincronizza({ spingi: true });
  assert.match(msg, /tolte 1/);
  assert.ok(!B.progetti().some(x => x.id === via.id), 'è ancora sul secondo');
  assert.ok(!JSON.parse(gh.file(A.St.FILE_CONDIVISE)).storie.some(s => s.id === via.id), 'il secondo l\'ha rimessa');
});

prova('le bozze mai salvate restano sul dispositivo', async () => {
  const bozza = A.St.nuovoProgetto({ titolo: 'bozza' });
  A.localStorage.setItem(A.St.CHIAVE, JSON.stringify([bozza, ...A.progetti()]));
  await A.St.sincronizza({ spingi: true });
  assert.ok(!JSON.parse(gh.file(A.St.FILE_CONDIVISE)).storie.some(s => s.titolo === 'bozza'));
  assert.ok(A.progetti().some(s => s.titolo === 'bozza'));
});

prova('un token sbagliato lo dice, e non rompe niente', async () => {
  const D = dispositivo('sbagliato');
  const msg = await D.St.sincronizza({ spingi: true });
  assert.match(msg, /token non è valido/);
  assert.ok(D.progetti().length >= 2, 'ha comunque letto le storie');
});

prova('un file rotto sul repository vale come vuoto', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(A.St.leggiCondivise('{ rotto'))), { progetti: [], eliminati: {} });
  const r = A.St.leggiCondivise(JSON.stringify({ storie: [{ id: 'x', titolo: 'senza demo' }, null], eliminati: { y: 'no', z: 3 } }));
  assert.equal(r.progetti.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(r.eliminati)), { z: 3 });
});

(async () => {
  let fallite = 0;
  for (const [nome, fn] of prove) {
    try { await fn(); console.log('  ok  ' + nome); }
    catch (e) { fallite++; console.log('  NO  ' + nome + '\n      ' + (e && e.stack || e)); }
  }
  console.log(`\n${prove.length - fallite} passate, ${fallite} fallite (storie sul repository)`);
  process.exit(fallite ? 1 : 0);
})();
