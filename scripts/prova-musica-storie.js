#!/usr/bin/env node
/* La musica di sottofondo delle Storie cosmiche (v440):
 *
 *   node scripts/prova-musica-storie.js
 *
 * Il comando `story_music` (storie-cosmiche.js) col suo controllo e col suo
 * lettore (una traccia che continua non riparte, una lasciata riprende, la
 * colonna sonora della demo tace, Stop spegne tutto, il file caricato suona
 * prima di essere pubblicato); il copione dello Studio (la traccia della
 * storia, quella di una scena, il silenzio, e nessuna richiesta doppia); e il
 * giro intero di una traccia caricata: IndexedDB, commit sul repository (un
 * GitHub finto, come in `prova-storie-repo.js`), l'altro dispositivo che la
 * trova, e una traccia sostituita che toglie dal repository quella vecchia. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const RADICE = path.resolve(__dirname, '..');
const leggi = f => fs.readFileSync(path.join(RADICE, f), 'utf8');
const REPO = 'prova/astro', RAMO = 'main', TOKEN = 'segreto';
const shaGit = buf => crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + buf.length + '\0'), buf])).digest('hex');

// --- Il GitHub finto, con le cartelle -----------------------------------------
const gh = {
  oggetti: new Map(), testa: '', scritture: 0,
  sha: o => crypto.createHash('sha1').update(JSON.stringify(o) + Math.random()).digest('hex'),
  albero(sha) { return new Map(this.oggetti.get(sha).voci); },
  tutto() { return this.albero(this.oggetti.get(this.testa).tree); },
  file(percorso) { const b = this.tutto().get(percorso); return b ? this.oggetti.get(b).contenuto : null; }
};
{
  gh.oggetti.set('b0', { contenuto: Buffer.from('ciao\n') });
  const t0 = gh.sha('t0'); gh.oggetti.set(t0, { voci: [['README.md', 'b0']] });
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
  const intest = op.headers || {};
  if (u.hostname === 'raw.githubusercontent.com') return risposta(404, {});
  const base = '/repos/' + REPO;
  assert.ok(u.pathname.startsWith(base), u.pathname);
  const via = decodeURIComponent(u.pathname.slice(base.length));
  const corpo = op.body ? JSON.parse(op.body) : null;
  if (metodo !== 'GET' && intest.Authorization !== 'Bearer ' + TOKEN) return risposta(401, { message: 'Bad credentials' });
  if (metodo === 'GET' && via.startsWith('/contents/')) {
    const dove = via.slice('/contents/'.length);
    const tutto = gh.tutto();
    if (tutto.has(dove)) {
      const sha = tutto.get(dove);
      return intest.Accept === 'application/vnd.github.raw+json'
        ? risposta(200, null, gh.oggetti.get(sha).contenuto.toString('utf8'))
        : risposta(200, { type: 'file', name: path.basename(dove), path: dove, sha });
    }
    const figli = new Map();
    for (const [p, sha] of tutto) if (p.startsWith(dove + '/')) {
      const resto = p.slice(dove.length + 1), nome = resto.split('/')[0];
      figli.set(nome, resto.includes('/') ? { type: 'dir', name: nome, path: dove + '/' + nome, sha: 'd' } : { type: 'file', name: nome, path: p, sha });
    }
    return figli.size ? risposta(200, [...figli.values()]) : risposta(404, {});
  }
  if (metodo === 'GET' && via === '/git/ref/heads/' + RAMO) return risposta(200, { object: { sha: gh.testa } });
  if (metodo === 'GET' && via.startsWith('/git/commits/')) return risposta(200, { tree: { sha: gh.oggetti.get(via.slice(13)).tree } });
  if (metodo === 'POST' && via === '/git/blobs') {
    const buf = corpo.encoding === 'base64' ? Buffer.from(corpo.content, 'base64') : Buffer.from(corpo.content, 'utf8');
    const sha = shaGit(buf);
    gh.oggetti.set(sha, { contenuto: buf });
    return risposta(201, { sha });
  }
  if (metodo === 'POST' && via === '/git/trees') {
    const voci = gh.albero(corpo.base_tree);
    for (const v of corpo.tree) { if (v.sha === null) voci.delete(v.path); else voci.set(v.path, v.sha); }
    const sha = gh.sha(corpo); gh.oggetti.set(sha, { voci: [...voci] });
    return risposta(201, { sha });
  }
  if (metodo === 'POST' && via === '/git/commits') {
    const sha = gh.sha(corpo); gh.oggetti.set(sha, { tree: corpo.tree, parents: corpo.parents });
    return risposta(201, { sha });
  }
  if (metodo === 'PATCH' && via === '/git/refs/heads/' + RAMO) {
    if (gh.oggetti.get(corpo.sha).parents[0] !== gh.testa) return risposta(422, { message: 'Update is not a fast forward' });
    gh.testa = corpo.sha; gh.scritture++;
    return risposta(200, { object: { sha: corpo.sha } });
  }
  throw new Error('chiamata non prevista: ' + metodo + ' ' + via);
}

// --- IndexedDB e Audio finti, quanto basta ------------------------------------
function indexedDBFinto() {
  const basi = new Map();
  return {
    open(nome) {
      const r = {};
      setTimeout(() => {
        const nuova = !basi.has(nome);
        if (nuova) basi.set(nome, new Map());
        const scaffali = basi.get(nome);
        const db = {
          objectStoreNames: { contains: n => scaffali.has(n) },
          createObjectStore: n => { scaffali.set(n, new Map()); },
          close() {},
          transaction(n) {
            const tx = {};
            const st = scaffali.get(n);
            const req = valore => { const q = { result: valore }; return q; };
            tx.objectStore = () => ({
              put: (v, k) => { st.set(k, v); return req(k); },
              get: k => req(st.get(k)),
              delete: k => { st.delete(k); return req(undefined); },
              openCursor() {
                const voci = [...st.entries()];
                const q = { result: null };
                let i = 0;
                const avanti = () => setTimeout(() => {
                  q.result = i < voci.length ? { key: voci[i][0], value: voci[i][1], continue() { i++; avanti(); } } : null;
                  if (q.onsuccess) q.onsuccess();
                  if (!q.result) setTimeout(() => tx.oncomplete && tx.oncomplete());
                });
                avanti();
                q.inCursore = true;
                return q;
              }
            });
            // Le operazioni semplici finiscono subito; il cursore chiude da sé
            setTimeout(() => { if (!tx.cursore && tx.oncomplete) tx.oncomplete(); });
            const os = tx.objectStore;
            tx.objectStore = x => { const s = os(x); const oc = s.openCursor; s.openCursor = () => { tx.cursore = true; return oc(); }; return s; };
            return tx;
          }
        };
        r.result = db;
        if (nuova && r.onupgradeneeded) r.onupgradeneeded();
        if (r.onsuccess) r.onsuccess();
      });
      return r;
    }
  };
}
const suonati = [];
class AudioFinto {
  constructor(src) { this.paused = true; this.volume = 1; this.loop = false; this.currentTime = 0; this.duration = 42.5; if (src) this.src = src; }
  set src(v) { this._src = v; setTimeout(() => this.onloadedmetadata && this.onloadedmetadata()); }
  get src() { return this._src; }
  play() { this.paused = false; suonati.push(this._src); return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute() { this._src = ''; }
  load() {}
  addEventListener() {}
}

// --- I dispositivi ------------------------------------------------------------
let orologio = Date.parse('2026-10-07T10:00:00Z');
function dispositivo(token) {
  const memoria = new Map();
  const localStorage = { getItem: k => memoria.has(k) ? memoria.get(k) : null, setItem: (k, v) => memoria.set(k, String(v)), removeItem: k => memoria.delete(k) };
  const ctx = {
    console, localStorage, fetch: fetchFinto, URL, TextEncoder, crypto: globalThis.crypto, btoa, setTimeout, clearTimeout,
    setInterval, clearInterval, Blob, File, Audio: AudioFinto, indexedDB: indexedDBFinto(),
    Date: class extends Date { static now() { return orologio; } }, Promise, JSON, Math, Uint8Array
  };
  ctx.globalThis = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['lingue/it.js', 'lingue/en.js', 'musica/catalogo.js']) vm.runInContext(leggi(f), ctx);
  const DIZ = ctx.window.ASTRO_DIZIONARI;
  ctx.astroI18n = {
    esiste: k => typeof DIZ.it.messaggi[k] === 'string',
    t: (k, d = {}) => String(DIZ.it.messaggi[k] || k).replace(/\{(\w+)\}/g, (m, x) => x in d ? String(d[x]) : m),
    lingua: () => 'it'
  };
  vm.runInContext(leggi('storie-cosmiche.js'), ctx);
  vm.runInContext(leggi('demo-libreria.js'), ctx);
  ctx.AstroDemo = { libreria: ctx.AstroDemoLibreria.crea(localStorage, [], () => true), inCorso: false, opzioni: {} };
  ctx.musicaDemoSospendi = s => { ctx.sospesa = s; };
  vm.runInContext(leggi('storie-studio.js'), ctx);
  localStorage.setItem('astrocal_storie_repo_v1', JSON.stringify({ repo: REPO, ramo: RAMO, token: token || '' }));
  const St = ctx.StudioStorie, Sc = ctx.StorieCosmiche;
  return {
    ctx, St, Sc,
    progetti: () => JSON.parse(localStorage.getItem(St.CHIAVE) || '[]'),
    salva(p) {
      p.demoChiave = ctx.AstroDemo.libreria.salva(St.copione(p), p.demoChiave || undefined);
      p.aggiornato = ++orologio;
      const tutti = this.progetti().filter(x => x.id !== p.id);
      localStorage.setItem(St.CHIAVE, JSON.stringify([p, ...tutti]));
      return St.sincronizza({ spingi: true, titolo: p.titolo });
    }
  };
}
const aspetta = ms => new Promise(r => setTimeout(r, ms));

const prove = [];
const prova = (nome, fn) => prove.push([nome, fn]);
const A = dispositivo(TOKEN), B = dispositivo(TOKEN);
const verifica = (d, p) => d.Sc.comandi.story_music.verifica(p);
const righe = testo => testo.split('\n').filter(r => /story_music/.test(r)).map(r => r.trim());

prova('story_music accetta un file del sito o off, e rifiuta il resto', () => {
  verifica(A, { src: 'off' });
  verifica(A, { src: 'musica/Observing_the_Zenith.mp3', volume: 0.3 });
  verifica(A, { src: 'audio/storie-musica/pabc/scena-s12.ogg?v=0123abcd' });
  for (const src of ['https://altro.sito/x.mp3', 'audio/../index.html', 'audio/x.exe', 'musica/a.mp3?v=zz', '', undefined])
    assert.throws(() => verifica(A, { src }), /story_music/, String(src));
  assert.throws(() => verifica(A, { src: 'off', volume: 2 }));
  assert.throws(() => verifica(A, { src: 'off', colore: 1 }));
});

prova('il copione chiede la musica solo quando cambia', () => {
  const p = A.St.daModello('fasi');
  while (p.scene.length < 4) p.scene.push(A.St.nuovaScena({ ambiente: 'terra_luna', momenti: [A.St.nuovoMomento(), A.St.nuovoMomento()] }));
  p.scene[0].momenti.push(A.St.nuovoMomento());
  p.musica = { tipo: 'catalogo', id: 'Europa1', volume: 0.4 };
  p.scene[1].musicaModo = 'silenzio';
  p.scene[3].musicaModo = 'propria';
  p.scene[3].musica = { tipo: 'file', nome: 'tema.ogg', est: 'ogg', sha: 'a'.repeat(40), durata: 30000, volume: 0.5 };
  const tutte = righe(A.St.copione(p));
  assert.deepEqual(tutte, [
    "action: story_music { src: 'musica/Tracing_the_Seven_Sisters.mp3', volume: 0.4 };",
    'action: story_music { src: off };',
    "action: story_music { src: 'musica/Tracing_the_Seven_Sisters.mp3', volume: 0.4 };",
    `action: story_music { src: 'audio/storie-musica/${p.id}/scena-${p.scene[3].id}.ogg?v=aaaaaaaaaa', volume: 0.5 };`
  ]);
  // la prova di una scena sola ha la sua musica; senza musica, nessuna riga
  assert.equal(righe(A.St.copione(p, { scena: 1 })).length, 0);
  assert.equal(righe(A.St.copione(p, { scena: 2 })).length, 1);
  assert.equal(righe(A.St.copione(Object.assign({}, p, { musica: null, scene: p.scene.slice(0, 3) }))).length, 0);
  // e ogni riga supera il controllo del comando
  for (const r of righe(A.St.copione(p))) {
    const corpo = r.replace(/^action: story_music \{ /, '').replace(/ \};$/, '');
    const src = /src: '([^']+)'/.exec(corpo); const vol = /volume: ([\d.]+)/.exec(corpo);
    verifica(A, { src: src ? src[1] : 'off', volume: vol ? Number(vol[1]) : undefined });
  }
});

prova('un progetto riletto tiene la musica, e butta quella rotta', () => {
  const p = A.St.daModello('fasi');
  p.musica = { tipo: 'catalogo', id: 'Grilli', volume: 7 };
  p.scene[0].musicaModo = 'propria';
  p.scene[0].musica = { tipo: 'file', nome: 'x', est: 'exe', sha: 'zz' };
  const r = A.St.ripulisci(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(JSON.parse(JSON.stringify(r.musica)), { tipo: 'catalogo', id: 'Grilli', volume: 1 });
  assert.equal(r.scene[0].musica, null);
  assert.equal(r.scene[0].musicaModo, 'propria');
  assert.equal(A.St.ripulisci({ scene: [{}] }).scene[0].musicaModo, 'storia');
});

prova('il lettore: continua, riprende, tace la demo, si spegne con lo Stop', async () => {
  const S = A.Sc, d = A.ctx.AstroDemo;
  d.inCorso = true;
  S.musicaLocale('audio/storie-musica/p1/storia.mp3', 'blob:locale-1');
  S.musica('audio/storie-musica/p1/storia.mp3?v=0123456789', 0.4);
  assert.equal(suonati.at(-1), 'blob:locale-1', 'il file caricato e non pubblicato suona da qui');
  assert.equal(A.ctx.sospesa, true, 'la colonna sonora della demo tace');
  const n = suonati.length;
  S.musica('audio/storie-musica/p1/storia.mp3?v=0123456789', 0.4);
  assert.equal(suonati.length, n, 'la stessa traccia non riparte');
  S.musica('musica/grilli.mp3', 0.3);
  assert.equal(S.musicaInCorso.src, 'musica/grilli.mp3');
  S.musica('off');
  assert.equal(S.musicaInCorso, null);
  await aspetta(300);
  d.opzioni = { musicaDemo: false };
  assert.equal(S.musica('musica/grilli.mp3', 0.3), false, 'con la musica delle demo spenta tace');
  d.opzioni = {};
  S.musica('musica/grilli.mp3', 0.3);
  await aspetta(400);
  assert.ok(S.musicaInCorso.suona);
  d.inCorso = false;
  await aspetta(300);
  assert.equal(S.musicaInCorso, null, 'a demo finita la vigilanza la spegne');
  assert.equal(A.ctx.sospesa, false);
});

let storia;
prova('una traccia caricata va nel commit della storia, e suona dall\'altro dispositivo', async () => {
  storia = A.St.daModello('fasi');
  storia.titolo = 'Con la musica';
  A.St.apri(storia);
  const byte = Buffer.from('ID3 musica finta '.repeat(40));
  await A.St.caricaMusica('storia', new File([byte], 'Tema Lunare.mp3', { type: 'audio/mpeg' }));
  assert.equal(storia.musica.tipo, 'file');
  assert.equal(storia.musica.sha, shaGit(byte));
  assert.equal(storia.musica.durata, 42500);
  const percorso = `audio/storie-musica/${storia.id}/storia.mp3`;
  assert.equal(righe(A.St.copione(storia))[0], `action: story_music { src: '${percorso}?v=${shaGit(byte).slice(0, 10)}', volume: 0.35 };`);
  // e una per la seconda scena
  storia.scene.push(A.St.nuovaScena({ ambiente: 'sistema' }));
  await A.St.caricaMusica('scene.' + (storia.scene.length - 1), new File([Buffer.from('OggS scena')], 'scena.ogg', { type: 'audio/ogg' }));
  const ultima = storia.scene[storia.scene.length - 1];
  assert.equal(ultima.musicaModo, 'propria');
  const prima = gh.scritture;
  const msg = await A.salva(storia);
  assert.match(msg, /Salvata nel repository/);
  assert.equal(gh.scritture, prima + 1, 'un commit solo');
  assert.deepEqual(gh.file(percorso), byte);
  assert.equal(gh.file(`audio/storie-musica/${storia.id}/scena-${ultima.id}.ogg`).toString(), 'OggS scena');
  // l'altro dispositivo trova la storia con la musica, e il copione la chiede
  await B.St.sincronizza();
  const suB = B.progetti().find(p => p.id === storia.id);
  assert.equal(suB.musica.sha, storia.musica.sha);
  assert.match(B.St.copione(B.St.ripulisci(suB)), new RegExp(percorso.replace(/[.?]/g, '\\$&')));
  // salvarla di nuovo non ricarica niente
  assert.match(await A.St.sincronizza({ spingi: true }), /già aggiornato/);
});

// In Node lo Studio non ha l'interfaccia: ogni giro rilegge i progetti
// dall'archivio, e quello aperto diventa la copia riletta
const corrente = () => { storia = A.St.progetto; return storia; };

prova('una traccia sostituita toglie dal repository quella vecchia, e B non cancella quella di A', async () => {
  corrente();
  const vecchia = `audio/storie-musica/${storia.id}/storia.mp3`;
  await A.St.caricaMusica('storia', new File([Buffer.from('OggS nuova')], 'nuova.ogg', { type: 'audio/ogg' }));
  await A.salva(storia);   // quella che porta la traccia nuova
  assert.equal(gh.file(vecchia), null, 'la vecchia è rimasta');
  assert.equal(gh.file(`audio/storie-musica/${storia.id}/storia.ogg`).toString(), 'OggS nuova');
  // B non ha i file di A nel browser, ma la storia li vuole: restano
  const altra = B.St.daModello('giganti'); altra.titolo = 'Da B';
  await B.salva(altra);
  assert.equal(gh.file(`audio/storie-musica/${storia.id}/storia.ogg`).toString(), 'OggS nuova');
});

prova('togliere la musica di una scena la toglie anche dal repository', async () => {
  A.St.apri(corrente());
  const i = storia.scene.length - 1, sc = storia.scene[i];
  A.St.togliMusica('scene.' + i);
  assert.equal(sc.musica, null);
  assert.equal(sc.musicaModo, 'storia');
  await A.salva(storia);
  assert.equal(gh.file(`audio/storie-musica/${storia.id}/scena-${sc.id}.ogg`), null);
  // una traccia dell'app al posto del file: niente da caricare
  A.St.apri(corrente());
  A.St.sceltaMusica('storia', 'cat:Encelado1');
  assert.deepEqual(JSON.parse(JSON.stringify(storia.musica)), { tipo: 'catalogo', id: 'Encelado1', volume: 0.35 });
  await A.salva(storia);
  assert.equal(gh.file(`audio/storie-musica/${storia.id}/storia.ogg`), null);
  assert.equal(gh.file('README.md').toString(), 'ciao\n', 'il resto del repository resta');
});

// --- v444: i suoni da file e ElevenLabs ----------------------------------------

prova('sound accetta un rumore sintetizzato o un file del sito, e rifiuta il resto', () => {
  const v = p => A.Sc.comandi.sound.verifica(p);
  v({ type: 'drumroll', volume: 0.6 });
  v({ src: 'audio/storie-musica/pabc/suono-a1b2c3d.mp3?v=0123abcdef', volume: 1.5 });
  for (const p of [{}, { src: 'https://altro.sito/x.mp3' }, { src: 'audio/../x.mp3' }, { src: 'audio/x.exe' }, { type: 'nonce' }, { src: 'audio/a.mp3', volume: 3 }])
    assert.throws(() => v(p), JSON.stringify(p));
});

prova('il suono da file suona dal blob locale durante la storia, e lo Stop lo ferma', () => {
  const S = A.Sc, d = A.ctx.AstroDemo;
  d.inCorso = true; d.opzioni = {};
  S.musicaLocale('audio/storie-musica/p9/suono-a1.mp3', 'blob:suono-1');
  S.comandi.sound.crea({ src: 'audio/storie-musica/p9/suono-a1.mp3?v=0123456789' });
  assert.equal(suonati.at(-1), 'blob:suono-1');
  d.opzioni = { effettiSonori: false };
  const n = suonati.length;
  S.comandi.sound.crea({ src: 'audio/storie-musica/p9/suono-a1.mp3' });
  assert.equal(suonati.length, n, 'con gli effetti sonori spenti tace');
  d.opzioni = {}; d.inCorso = false;
  S.zittisci();
});

prova('l\'azione Suono: copione, riletta, nel commit e via dal repository quando si toglie', async () => {
  const p = A.St.daModello('fasi');
  p.titolo = 'Coi suoni';
  A.St.apri(p);
  const m = p.scene[0].momenti[0];
  const az = A.St.nuovaAzione('suono', { quando: 'meta' });
  m.azioni.push(az);
  // sintetizzato: la riga che il motore conosce già
  assert.match(A.St.copione(p), new RegExp(`action: sound \\{ type: tada, shot_from: 0.45 \\};`));
  // da file (generato o caricato): nella cartella della musica della storia
  const byte = Buffer.from('ID3 razzo che parte '.repeat(20));
  assert.equal(await A.St.caricaSuono('scene.0.momenti.0.azioni.' + (m.azioni.length - 1), new File([byte], 'razzo.mp3', { type: 'audio/mpeg' })), true);
  assert.equal(az.fonte, 'file');
  assert.equal(az.file.sha, shaGit(byte));
  const percorso = `audio/storie-musica/${p.id}/suono-${az.id}.mp3`;
  const riga = A.St.copione(p).split('\n').find(r => /action: sound \{ src/.test(r)).trim();
  assert.equal(riga, `action: sound { src: '${percorso}?v=${shaGit(byte).slice(0, 10)}', shot_from: 0.45 };`);
  A.Sc.comandi.sound.verifica({ src: `${percorso}?v=${shaGit(byte).slice(0, 10)}` });
  // riletto da un file: il suono resta, un file rotto torna sintetizzato
  const riletto = A.St.ripulisci(JSON.parse(JSON.stringify(p)));
  const az2 = riletto.scene[0].momenti[0].azioni.find(a => a.tipo === 'suono');
  assert.equal(az2.fonte, 'file'); assert.equal(az2.file.sha, az.file.sha);
  const rotto = A.St.ripulisci(JSON.parse(JSON.stringify(p).replace(az.file.sha, 'zz')));
  assert.equal(rotto.scene[0].momenti[0].azioni.find(a => a.tipo === 'suono').fonte, 'sintesi');
  await A.salva(p);
  assert.deepEqual(gh.file(percorso), byte);
  // tolta l'azione, il file se ne va al salvataggio dopo
  const q = A.St.progetto;
  q.scene[0].momenti[0].azioni = q.scene[0].momenti[0].azioni.filter(a => a.tipo !== 'suono');
  await A.salva(q);
  assert.equal(gh.file(percorso), null);
});

prova('ElevenLabs: il testo con la regia, le voci lette dalle API, i filtri e la scelta nel progetto', () => {
  const St = A.St;
  const m = St.nuovoMomento({ chi: 'Moon', testo: '  Oh no,   guardate in su! ', umore: 'worried' });
  assert.equal(St.testoPerVoce(m, 'eleven_v3'), '[nervous] Oh no, guardate in su!');
  assert.equal(St.testoPerVoce(m, 'eleven_multilingual_v2'), 'Oh no, guardate in su!');
  assert.equal(St.testoPerVoce(St.nuovoMomento({ testo: '[whispers] Psst!', umore: 'happy' }), 'eleven_v3'), '[whispers] Psst!', 'un tag scritto a mano vince');
  assert.equal(St.testoPerVoce(St.nuovoMomento({ testo: '[whispers] Psst!' }), 'eleven_flash_v2_5'), 'Psst!');
  for (const u of Object.keys(A.Sc.STOR_ESPRESSIONI)) if (u !== 'neutral') assert.ok(St.ELEVEN_TAG_UMORE[u], 'manca il tag di ' + u);
  // una voce della libreria e una dell'account
  const lib = St.voceDaEleven({ voice_id: 'AbCdEf1234567890', public_owner_id: 'own1', name: 'Giulia', gender: 'female', accent: 'standard', age: 'young', language: 'it',
    description: 'Calda', preview_url: 'https://x.io/a.mp3', verified_languages: [{ language: 'it', preview_url: 'https://x.io/it.mp3' }] }, 'it');
  assert.deepEqual(JSON.parse(JSON.stringify(lib)), { id: 'AbCdEf1234567890', nome: 'Giulia', proprietario: 'own1', genere: 'f', accento: 'standard', eta: 'young',
    lingue: ['it'], descrizione: 'Calda', anteprima: 'https://x.io/it.mp3', mia: false });
  const mia = St.voceDaEleven({ voice_id: 'Zz9876543210', name: 'Marco', labels: { gender: 'male', language: 'it' }, preview_url: 'https://x.io/m.mp3' }, 'it');
  assert.equal(mia.genere, 'm'); assert.equal(mia.mia, true);
  const en = St.voceDaEleven({ voice_id: 'Ee1111111111', name: 'Rachel', labels: { gender: 'female', language: 'en' } }, 'it');
  assert.equal(St.voceDaEleven({ voice_id: 'x' }, 'it'), null, 'un ID storto non passa');
  assert.deepEqual(St.filtraVoci([lib, mia, en], { lingua: 'it', genere: 'f' }).map(v => v.nome), ['Giulia']);
  assert.deepEqual(St.filtraVoci([lib, mia, en], { lingua: '', genere: 'f' }).map(v => v.nome), ['Giulia', 'Rachel']);
  assert.deepEqual(St.filtraVoci([lib, mia, en], { cerca: 'calda' }).map(v => v.nome), ['Giulia']);
  // la voce scelta sta nel progetto, e una rotta si butta
  const p = St.ripulisci({ titolo: 'x', cast: ['Moon'], voci: { Moon: { id: 'AbCdEf1234567890', nome: 'Giulia', anteprima: 'https://x.io/it.mp3', genere: 'f' },
    Earth: { id: 'no' }, Sun: { id: 'Zz9876543210', anteprima: 'javascript:alert(1)' } }, scene: [] });
  assert.deepEqual(Object.keys(p.voci), ['Moon', 'Sun']);
  assert.equal(p.voci.Sun.anteprima, '');
  assert.equal(St.voceDi(p, 'Moon').nome, 'Giulia');
});

(async () => {
  let ok = 0;
  for (const [nome, fn] of prove) {
    try { await fn(); ok++; console.log('  ok  ' + nome); }
    catch (e) { console.log('  NO  ' + nome + '\n      ' + (e && e.stack || e)); process.exitCode = 1; }
  }
  console.log(`\n${ok} passate, ${prove.length - ok} fallite (musica delle storie)`);
  process.exit(process.exitCode || 0);
})();
