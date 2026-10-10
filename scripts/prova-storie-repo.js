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
 * un ramo andato avanti nel frattempo fa riprovare invece di perdere dati.
 * v475: due dispositivi sulla stessa storia si fondono (scene, battute,
 * cast) invece di cancellarsi; chi scrive nel mezzo di un salvataggio resta;
 * il salvataggio automatico manda solo le storie salvate e cambiate. */
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
  file(percorso, commit) {
    const blob = this.albero(this.oggetti.get(commit || this.testa).tree).get(percorso);
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
  if (metodo === 'GET' && via.startsWith('/contents/') && gh.mentreLeggo && via.endsWith(gh.mentreLeggo.percorso)) {
    const fai = gh.mentreLeggo.fai; gh.mentreLeggo = null; fai();
  }
  if (metodo === 'GET' && via.startsWith('/contents/')) {
    // il ramo, o un commit preciso (v475: si legge al commit che farà da genitore)
    const rif = u.searchParams.get('ref');
    assert.ok(rif === RAMO || gh.oggetti.has(rif), 'ref sconosciuto: ' + rif);
    const f = gh.file(via.slice('/contents/'.length), rif === RAMO ? '' : rif);
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

// --- v475: due dispositivi sulla stessa storia -----------------------------
// Un commit fatto «da fuori» (un altro dispositivo, a mano) con il file delle
// storie cambiato da `cambia`
function scriveUnAltro(cambia) {
  const file = JSON.parse(gh.file(A.St.FILE_CONDIVISE));
  cambia(file);
  const blob = gh.sha('blob'); gh.oggetti.set(blob, { contenuto: JSON.stringify(file, null, 2) + '\n' });
  const voci = gh.albero(gh.oggetti.get(gh.testa).tree); voci.set(A.St.FILE_CONDIVISE, blob);
  const albero = gh.sha('albero'); gh.oggetti.set(albero, { voci: [...voci] });
  const c = gh.sha('commit'); gh.oggetti.set(c, { tree: albero, parents: [gh.testa] });
  gh.testa = c; gh.scritture++;
}
const sulRepo = id => JSON.parse(gh.file(A.St.FILE_CONDIVISE)).storie.find(s => s.id === id);
const E = dispositivo(TOKEN), F = dispositivo(TOKEN);
let comune;

prova('v475: il telefono con la storia vecchia non cancella le scene nuove del computer', async () => {
  comune = E.St.daModello('fasi'); comune.titolo = 'Fasi, insieme';
  await E.salva(comune);
  await F.St.sincronizza();
  // il computer (E) aggiunge una scena e corregge una battuta
  const pe = E.progetti().find(x => x.id === comune.id);
  const nuova = E.St.nuovaScena({ fuoco: 'Moon' }); nuova.momenti[0].testo = 'Scena scritta dal computer';
  pe.scene.push(nuova);
  pe.scene[0].momenti[0].testo = 'Prima battuta corretta dal computer';
  await E.salva(pe);
  // il telefono (F), senza aver riletto, cambia solo il titolo e salva
  const pf = F.progetti().find(x => x.id === comune.id);
  pf.titolo = 'Fasi, dal telefono';
  const msg = await F.salva(pf);
  assert.match(msg, /Unite le modifiche/);
  const r = sulRepo(comune.id);
  assert.equal(r.titolo, 'Fasi, dal telefono');
  assert.ok(r.scene.some(sc => sc.id === nuova.id), 'la scena del computer è sparita');
  assert.equal(r.scene[0].momenti[0].testo, 'Prima battuta corretta dal computer');
  assert.equal(r.scene[r.scene.length - 1].id, nuova.id, 'la scena nuova resta in fondo');
  // e il computer, rileggendo, ha tutto senza aver fatto niente
  await E.St.sincronizza();
  const qui = E.progetti().find(x => x.id === comune.id);
  assert.equal(qui.titolo, 'Fasi, dal telefono');
  assert.ok(qui.scene.some(sc => sc.id === nuova.id));
  assert.ok(E.demo().find(d => d.chiave === qui.demoChiave).testo.length > 0);
});

prova('v475: la stessa battuta cambiata da tutte e due: vince la modifica più recente, il resto si somma', async () => {
  const pe = E.progetti().find(x => x.id === comune.id);
  const pf = F.progetti().find(x => x.id === comune.id);
  pe.scene[0].momenti[0].testo = 'dal computer, prima';
  pe.obiettivo = 'obiettivo dal computer';
  pe.aggiornato = ++orologio;
  E.localStorage.setItem(E.St.CHIAVE, JSON.stringify(E.progetti().map(x => x.id === pe.id ? pe : x)));
  pf.scene[0].momenti[0].testo = 'dal telefono, dopo';
  pf.cast.push('Mars');
  await E.salva(pe);
  const msg = await F.salva(pf);
  assert.match(msg, /tenuta la modifica più recente/);
  const r = sulRepo(comune.id);
  assert.equal(r.scene[0].momenti[0].testo, 'dal telefono, dopo');
  assert.equal(r.obiettivo, 'obiettivo dal computer');
  assert.ok(r.cast.includes('Mars'));
});

prova('v475: una scena tolta da una parte e un\'altra ritoccata dall\'altra', async () => {
  await E.St.sincronizza(); await F.St.sincronizza();
  const pe = E.progetti().find(x => x.id === comune.id);
  const pf = F.progetti().find(x => x.id === comune.id);
  const via = pe.scene[1].id, tocca = pe.scene[0].id;
  pe.scene.splice(1, 1);
  await E.salva(pe);
  pf.scene.find(sc => sc.id === tocca).momenti[0].testo = 'ritoccata dal telefono';
  await F.salva(pf);
  const r = sulRepo(comune.id);
  assert.ok(!r.scene.some(sc => sc.id === via), 'la scena tolta è tornata');
  assert.equal(r.scene.find(sc => sc.id === tocca).momenti[0].testo, 'ritoccata dal telefono');
});

prova('v475: un orologio indietro non fa perdere la modifica', async () => {
  await E.St.sincronizza(); await F.St.sincronizza();
  const pf = F.progetti().find(x => x.id === comune.id);
  const base = pf.aggiornato;
  pf.titolo = 'Dal telefono con l\'orologio indietro';
  // come se il telefono segnasse dieci minuti prima della versione del computer
  pf.aggiornato = base - 10 * 60 * 1000;
  F.localStorage.setItem(F.St.CHIAVE, JSON.stringify(F.progetti().map(x => x.id === pf.id ? pf : x)));
  await F.St.sincronizza({ spingi: true });
  assert.equal(sulRepo(comune.id).titolo, 'Dal telefono con l\'orologio indietro');
});

prova('v475: chi scrive mentre si salva non viene cancellato (il commit nasce sopra la versione letta)', async () => {
  await E.St.sincronizza();
  const altra = F.St.daModello('libera'); altra.titolo = 'Arrivata nel mezzo';
  altra.demoChiave = 'utente-mezzo'; altra.aggiornato = ++orologio;
  // un altro dispositivo scrive proprio mentre E prepara i suoi file
  gh.mentreLeggo = { percorso: 'storie-studio.json', fai: () => scriveUnAltro(f => f.storie.push(JSON.parse(JSON.stringify(altra)))) };
  const pe = E.progetti().find(x => x.id === comune.id);
  pe.obiettivo = 'scritto mentre un altro scriveva';
  const msg = await E.salva(pe);
  assert.match(msg, /Salvata nel repository/);
  assert.ok(sulRepo(altra.id), 'la storia scritta nel mezzo è sparita');
  assert.equal(sulRepo(comune.id).obiettivo, 'scritto mentre un altro scriveva');
  assert.ok(E.progetti().some(x => x.id === altra.id), 'e il computer l\'ha presa');
});

prova('v475: il salvataggio automatico manda le modifiche delle storie salvate, non le bozze', async () => {
  await F.St.sincronizza();
  const prima = gh.scritture;
  // niente di nuovo: legge e basta
  await F.St.autoSalva();
  assert.equal(gh.scritture, prima);
  const pf = F.progetti().find(x => x.id === comune.id);
  pf.titolo = 'Salvata da sé';
  pf.aggiornato = ++orologio;
  const bozza = F.St.nuovoProgetto({ titolo: 'bozza del telefono' });
  F.localStorage.setItem(F.St.CHIAVE, JSON.stringify([bozza, ...F.progetti().map(x => x.id === pf.id ? pf : x)]));
  assert.equal(F.St.daMandare(F.progetti(), JSON.parse(F.localStorage.getItem(F.St.CHIAVE_BASI))).length, 1);
  const msg = await F.St.autoSalva();
  assert.match(msg, /Salvata nel repository/);
  assert.equal(gh.scritture, prima + 1);
  assert.equal(sulRepo(comune.id).titolo, 'Salvata da sé');
  assert.ok(!JSON.parse(gh.file(A.St.FILE_CONDIVISE)).storie.some(s => s.titolo === 'bozza del telefono'));
  // la demo di qui segue la storia
  assert.match(F.demo().find(d => d.chiave === pf.demoChiave).testo, /Salvata da sé/);
  // e spento non fa niente
  F.localStorage.setItem('astrocal_storie_repo_v1', JSON.stringify({ repo: REPO, ramo: RAMO, token: TOKEN, auto: false }));
  pf.titolo = 'non parte'; pf.aggiornato = ++orologio;
  F.localStorage.setItem(F.St.CHIAVE, JSON.stringify(F.progetti().map(x => x.id === pf.id ? pf : x)));
  assert.equal(await F.St.autoSalva(), '');
  assert.equal(sulRepo(comune.id).titolo, 'Salvata da sé');
});

prova('v475: la fusione a tre vie, da sola', () => {
  const f = E.St.fondi;
  const b = { a: 1, l: [{ id: 'x', t: 1 }, { id: 'y', t: 1 }], c: ['Moon'] };
  const l = { a: 2, l: [{ id: 'x', t: 1 }, { id: 'y', t: 1 }, { id: 'z', t: 1 }], c: ['Moon', 'Mars'] };
  const r = { a: 1, l: [{ id: 'y', t: 2 }, { id: 'x', t: 1 }], c: ['Moon', 'Venus'] };
  const conto = { n: 0 };
  const v = JSON.parse(JSON.stringify(f(b, l, r, true, conto)));
  assert.deepEqual(v, { a: 2, l: [{ id: 'y', t: 2 }, { id: 'x', t: 1 }, { id: 'z', t: 1 }], c: ['Moon', 'Venus', 'Mars'] });
  assert.equal(conto.n, 0);
  const c2 = { n: 0 };
  assert.equal(f({ t: 'a' }, { t: 'b' }, { t: 'c' }, false, c2).t, 'c');
  assert.equal(c2.n, 1);
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
