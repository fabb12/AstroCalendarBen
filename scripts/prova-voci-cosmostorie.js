#!/usr/bin/env node
/* Le voci di una CosmoStoria con un tocco (v482, `voci-filmato.js` §8–9),
 * nel browser vero, con un ElevenLabs finto (le rotte di Playwright su
 * api.elevenlabs.io, con una piccola libreria di voci descritte):
 *
 *   npm install --no-save playwright-core astronomy-engine satellite.js@5.0.0
 *   node scripts/prova-voci-cosmostorie.js
 *
 * Si prova: il tasto sulla scheda senza chiave (dice dove metterla); con la
 * chiave il casting da solo (Cooper la voce calda e roca, TARS quella
 * asciutta, Gargantua la profonda, Brand una voce di donna giovane; mai due
 * personaggi con la stessa voce; la voce aggiunta all'account), le battute
 * con la regia di regia-voci.json (i tag), la narrazione che le suona al
 * posto della sintesi anche fuori dal filmato, la seconda volta senza
 * crediti, «Un'altra voce» che rifà solo le battute di quel personaggio,
 * «Togli queste voci», e le funzioni pure del voto e del carattere. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const http = require('node:http');
let pw;
try { pw = require('playwright-core'); } catch (_) { pw = require('playwright'); }

const radice = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(radice, '.' + (req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html');
  // v488: dalla v487 «Interstellar 1» ha le voci vere sul repository (le
  // ha fatte chi usa l'app), e le battute registrate non vanno più a
  // ElevenLabs: TARS non aveva più niente da dire, Cooper solo le due
  // battute nuove. Le prove sono sul tasto, non su quelle voci: la pagina
  // le riceve senza, come la storia era quando le prove sono nate.
  if (file === path.join(radice, 'audio/narrazione/manifest.js')) {
    res.end(fs.readFileSync(file, 'utf8').replace(/\n    'demo\.narr\.storia_interstellar\.\d+': \{\n(?:      .*\n)+?    \},\n/g, '\n'));
    return;
  }
  res.end(fs.readFileSync(file));
});
function chromiumVero() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  for (const c of ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome', '/opt/pw-browsers/chromium'])
    if (fs.existsSync(c)) return c;
  return undefined;
}
function wavTono(secondi = 0.6, hz = 330, frequenza = 22050) {
  const n = Math.round(secondi * frequenza), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(frequenza, 24); b.writeUInt32LE(frequenza * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * i / frequenza) * 12000), 44 + i * 2);
  return b;
}
function pacchetto(nome) {
  const qui = path.join(radice, 'node_modules', nome);
  if (fs.existsSync(path.join(qui, 'package.json'))) return qui;
  try { return path.dirname(require.resolve(nome + '/package.json')); } catch (_) { return null; }
}
// La libreria finta: voci con genere, età e descrizione, in italiano
const v = (id, gender, age, description, extra) => Object.assign({ voice_id: id, public_owner_id: 'prop' + id, name: id, gender, age, language: 'it',
  description, use_case: 'characters_animation', cloned_by_count: 100, preview_url: 'https://anteprime.finte/' + id + '.mp3' }, extra || {});
const LIBRERIA = [
  v('UomoCaldoRoco01', 'male', 'middle_aged', 'warm raspy deep voice, calm and confident'),
  v('UomoRoboto00001', 'male', 'middle_aged', 'dry deadpan robotic voice, calm'),
  v('UomoProfondo001', 'male', 'old', 'very deep slow mysterious dark resonant voice'),
  v('UomoGentile0001', 'male', 'middle_aged', 'gentle soft calm british voice'),
  v('UomoBrusco00001', 'male', 'middle_aged', 'gruff firm deep voice'),
  v('UomoRuvido00001', 'male', 'middle_aged', 'gruff rough voice', { cloned_by_count: 10 }),
  v('UomoSuadente001', 'male', 'middle_aged', 'smooth charming calm voice'),
  v('UomoNeutro00001', 'male', 'middle_aged', 'calm neutral flat voice'),
  v('UomoFreddo00001', 'male', 'old', 'cold deep slow whisper'),
  v('UomoQualunque01', 'male', 'young', 'energetic upbeat promo voice', { use_case: 'advertisement', cloned_by_count: 90000 }),
  v('DonnaChiara0001', 'female', 'young', 'clear warm confident emotional voice'),
  v('DonnaCalda00001', 'female', 'young', 'emotional warm clear soft voice'),
  v('DonnaMorbida001', 'female', 'middle_aged', 'soft calm mysterious breathy voice'),
  v('DonnaPubblic001', 'female', 'middle_aged', 'news anchor voice', { use_case: 'news', cloned_by_count: 80000 })
];

const prove = [];
const prova = (nome, fn) => prove.push([nome, fn]);

(async () => {
  let browser, passate = 0, fallite = 0;
  const eleven = { tts: [], aggiunte: [], ricerche: 0 };
  const GH = { repo: 'prova/astro', token: 'segreto', testa: 'c0', n: 0, commit: 0, file: new Map(), blob: new Map(), albero: [] };
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    browser = await pw.chromium.launch({ executablePath: chromiumVero(), args: ['--autoplay-policy=no-user-gesture-required'] });
    const pagina = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 1100, height: 900 } });
    pagina.setDefaultTimeout(Number(process.env.ATTESA) || 60000);
    if (process.env.DEBUG) pagina.on('console', m => console.log('console:', m.text()));
    const errori = [];
    pagina.on('pageerror', e => errori.push(e.message));
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    await pagina.route('**/*', async r => {
      const req = r.request(), url = req.url();
      if (url.startsWith(origine)) return r.continue();
      if (url.includes('astronomy.browser.min.js')) return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(radice, 'node_modules/astronomy-engine/astronomy.browser.min.js')) });
      if (url.includes('satellite.min.js')) return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(pacchetto('satellite.js'), 'dist/satellite.min.js')) });
      const u = new URL(url);
      // v483: un GitHub finto, quanto basta per un commit con le voci
      if (u.hostname === 'api.github.com' && u.pathname.startsWith('/repos/' + GH.repo)) {
        if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: Object.assign({}, cors, { 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' }) });
        const json = (o, status = 200) => r.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
        const via = decodeURIComponent(u.pathname.slice(('/repos/' + GH.repo).length));
        const corpo = req.postData() ? JSON.parse(req.postData()) : null;
        if (req.method() !== 'GET' && (req.headers().authorization || '') !== 'Bearer ' + GH.token) return json({ message: 'Bad credentials' }, 401);
        if (req.method() === 'GET' && via === '') return json({ full_name: GH.repo });
        if (req.method() === 'GET' && via === '/git/ref/heads/main') return json({ object: { sha: GH.testa } });
        if (req.method() === 'GET' && via.startsWith('/git/commits/')) return json({ tree: { sha: 't-' + via.slice(13) } });
        if (req.method() === 'GET' && via.startsWith('/contents/')) {
          const dove = via.slice('/contents/'.length);
          if (GH.file.has(dove)) return r.fulfill({ status: 200, headers: cors, body: GH.file.get(dove).buf });
          const figli = [...GH.file].filter(([p]) => p.startsWith(dove + '/') && !p.slice(dove.length + 1).includes('/'))
            .map(([p, x]) => ({ type: 'file', name: p.slice(dove.length + 1), path: p, sha: x.sha }));
          return figli.length ? json(figli) : json({ message: 'Not Found' }, 404);
        }
        if (req.method() === 'POST' && via === '/git/blobs') {
          const buf = Buffer.from(corpo.content, corpo.encoding === 'base64' ? 'base64' : 'utf8');
          const sha = crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + buf.length + '\0'), buf])).digest('hex');
          GH.blob.set(sha, buf);
          return json({ sha }, 201);
        }
        if (req.method() === 'POST' && via === '/git/trees') { GH.albero = corpo.tree; return json({ sha: 'albero' }, 201); }
        if (req.method() === 'POST' && via === '/git/commits') return json({ sha: 'c' + (++GH.n) }, 201);
        if (req.method() === 'PATCH' && via === '/git/refs/heads/main') {
          for (const v of GH.albero) { if (v.sha === null) GH.file.delete(v.path); else GH.file.set(v.path, { sha: v.sha, buf: GH.blob.get(v.sha) }); }
          GH.testa = corpo.sha; GH.commit++;
          return json({ object: { sha: corpo.sha } });
        }
        return json({ message: 'Not Found' }, 404);
      }
      if (u.hostname === 'api.elevenlabs.io') {
        if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
        const json = (o, status = 200) => r.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
        if (u.pathname === '/v1/shared-voices') {
          eleven.ricerche++;
          const q = u.searchParams;
          const voci = LIBRERIA.filter(x => (!q.get('gender') || x.gender === q.get('gender')) && (!q.get('age') || x.age === q.get('age')) &&
            (!q.get('language') || x.language === q.get('language')) && (!q.get('search') || x.description.includes(q.get('search'))));
          return json({ voices: voci, has_more: false });
        }
        const add = /^\/v1\/voices\/add\/([^/]+)\/([^/]+)$/.exec(u.pathname);
        if (add && req.method() === 'POST') { eleven.aggiunte.push(add[2]); return json({ voice_id: add[2] }); }
        if (u.pathname === '/v2/voices') return json({ voices: [] });
        const t = /^\/v1\/text-to-speech\/([A-Za-z0-9]+)$/.exec(u.pathname);
        if (t && req.method() === 'POST') {
          const corpo = JSON.parse(req.postData() || '{}');
          eleven.tts.push({ voce: t[1], testo: corpo.text, modello: corpo.model_id });
          return r.fulfill({ headers: cors, contentType: 'audio/wav', body: wavTono() });
        }
        return json({}, 404);
      }
      return r.abort();
    });
    await pagina.addInitScript(() => {
      localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
      localStorage.setItem('astrocal_demo_intro_v1', JSON.stringify({ attiva: false }));
      localStorage.setItem('astrocal_lingua', 'it');
      const voce = { corrente: null, timer: [], getVoices: () => [{ name: 'Finta', lang: 'it-IT', default: true, localService: true }], addEventListener() {},
        speak(u) { voce.cancel(); voce.corrente = u; (window.__sintesi = window.__sintesi || []).push(u.text);
          voce.timer.push(setTimeout(() => u.onstart && u.onstart(), 20));
          voce.timer.push(setTimeout(() => { if (voce.corrente === u) { voce.corrente = null; u.onend && u.onend(); } }, 300)); },
        cancel() { voce.timer.forEach(clearTimeout); voce.timer = []; const u = voce.corrente; voce.corrente = null; if (u && u.onerror) u.onerror({ error: 'interrupted' }); } };
      Object.defineProperty(window, 'speechSynthesis', { value: voce, configurable: true });
      window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ''; } };
    });
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => window.VociFilmato && window.StudioStorie && window.AstroDemo && window.StorieCosmiche && sky.observer && sky.oggetti.length);
    const mettiChiave = c => pagina.evaluate(c => { if (c) localStorage.setItem('astrocal_elevenlabs_v1', JSON.stringify({ chiave: c, modello: 'eleven_v3', stabilita: 0.5 })); else localStorage.removeItem('astrocal_elevenlabs_v1'); }, c);
    const tasto = () => pagina.evaluate(() => { mostraVista('demo'); demoMostraScheda('demo-scheda-storie'); document.querySelector('[data-storia-voci="storia_interstellar"]').click(); });
    const battute = await pagina.evaluate(() => VociFilmato.battute(AstroDemo.libreria.elenco().find(d => d.chiave === 'storia_interstellar').testo));

    prova('ogni CosmoStoria ha il tasto «Voci ElevenLabs»; senza chiave dice dove metterla', async () => {
      await pagina.evaluate(() => { mostraVista('demo'); demoMostraScheda('demo-scheda-storie'); });
      const n = await pagina.locator('[data-storia-voci]').count();
      const schede = await pagina.locator('.storia-scheda').count();
      assert.equal(n, schede, 'un tasto per scheda');
      await mettiChiave(null);
      await tasto();
      await pagina.waitForSelector('#vcast-finestra [data-vcast="chiave"]');
      assert.match(await pagina.locator('#vcast-finestra').textContent(), /Impostazioni → ElevenLabs/);
      assert.equal(eleven.tts.length + eleven.ricerche, 0, 'senza chiave non parte niente');
      await pagina.click('#vcast-finestra [data-vcast="chiave"]');
      assert.equal(await pagina.locator('#vcast-finestra').count(), 0);
      await pagina.waitForSelector('#studio-impostazioni');
    });

    prova('un tocco: la voce giusta per ognuno, mai due uguali, e tutte le battute con la regia', async () => {
      await mettiChiave('chiave-finta');
      eleven.tts.length = 0; eleven.aggiunte.length = 0;
      await tasto();
      await pagina.waitForSelector('#vcast-finestra [data-vcast="guarda"]', { timeout: 120000 });
      assert.match(await pagina.locator('#vcast-finestra').textContent(), new RegExp('Pronte tutte le ' + battute.length + ' voci'));
      if (process.env.FOTO) await pagina.screenshot({ path: process.env.FOTO });
      assert.equal(eleven.tts.length, battute.length, 'una richiesta per battuta');
      assert.ok(eleven.tts.every(r => r.modello === 'eleven_v3'));
      const cast = await pagina.evaluate(() => JSON.parse(localStorage.getItem('astrocal_voci_cast_v1')).it);
      const voceDi = id => cast[id] && cast[id].id;
      assert.equal(voceDi('cooper'), 'UomoCaldoRoco01', 'Cooper: la voce calda e roca');
      assert.equal(voceDi('tars'), 'UomoRoboto00001', 'TARS: la voce asciutta da robot');
      assert.equal(voceDi('gargantua'), 'UomoProfondo001', 'Gargantua: la voce profondissima');
      assert.equal(voceDi('romilly'), 'UomoGentile0001', 'Romilly: la voce gentile');
      assert.ok(['DonnaChiara0001', 'DonnaCalda00001'].includes(voceDi('brand')), 'Brand: una voce di donna giovane e chiara');
      assert.ok(['DonnaChiara0001', 'DonnaCalda00001'].includes(voceDi('murph')), 'Murph: una voce di donna giovane e calda');
      assert.equal(voceDi('miller_planet'), 'DonnaMorbida001', 'il pianeta di Miller: morbida e misteriosa');
      const chi = [...new Set(battute.map(b => b.chi))];
      const voci = chi.map(voceDi);
      assert.ok(voci.every(Boolean), 'tutti hanno una voce: ' + JSON.stringify(cast));
      assert.equal(new Set(voci).size, voci.length, 'nessuno ha la voce di un altro: ' + voci.join(','));
      assert.ok(!voci.includes('UomoQualunque01') && !voci.includes('DonnaPubblic001'), 'le voci da pubblicità non vincono per i clic');
      assert.equal(new Set(eleven.aggiunte).size, voci.length, 'ogni voce della libreria aggiunta all\'account');
      // ogni battuta con la voce del suo personaggio e la sua regia
      for (const r of eleven.tts) {
        const nudo = r.testo.replace(/\[[^\]]*\]\s*/g, '').replace(/\s+/g, ' ').trim();
        const b = battute.find(x => x.testo === nudo);
        assert.ok(b, 'il testo è quello della battuta: ' + r.testo);
        assert.equal(r.voce, voceDi(b.chi));
      }
      const prima = eleven.tts.find(r => /Due anni di viaggio/.test(r.testo));
      assert.equal(prima.testo, '[in awe] Due anni di viaggio, ed eccolo: Saturno. [whispers] E lì, accanto agli anelli, c\'è una porta che nessun essere umano ha mai attraversato.');
      assert.ok(eleven.tts.every(r => /^\[/.test(r.testo)), 'tutte con i tag');
      // v483: senza token restano qui, e la finestra lo dice
      await pagina.waitForSelector('#vcast-finestra [data-vcast="collega"]');
      assert.match(await pagina.locator('#vcast-finestra .vcast-repo').textContent(), /restano su questo dispositivo/);
      const perRepo = await pagina.evaluate(() => VociFilmato.vociPerRepository());
      assert.equal(perRepo.length, battute.filter(b => /^demo\.narr\.storia_interstellar\.\d+$/.test(b.id)).length, 'ogni battuta sa dove andare');
      assert.ok(perRepo.every(x => x.chi && x.lingua === 'it'));
    });

    prova('la narrazione le suona sempre, anche fuori dal filmato', async () => {
      const n = await pagina.evaluate(() => VociFilmato.caricaVociStorie());
      assert.equal(n, battute.length);
      const esito = await pagina.evaluate(async testo => { window.__sintesi = []; const e = await narrazione.parla({ canale: 'prova', testo }); return { e, sintesi: window.__sintesi.length }; }, battute[0].testo);
      assert.equal(esito.e, 'audio', JSON.stringify(esito));
      assert.equal(esito.sintesi, 0, 'la voce di sistema tace');
      // e lo Studio conosce le voci scelte (dopo quelle scelte a mano)
      const studio = await pagina.evaluate(() => StudioStorie.voceDi(null, 'cooper'));
      assert.equal(studio && studio.id, 'UomoCaldoRoco01');
    });

    prova('la seconda volta niente crediti: le voci sono già pronte', async () => {
      eleven.tts.length = 0;
      await pagina.click('#vcast-finestra [data-vcast="chiudi"]');
      await tasto();
      await pagina.waitForSelector('#vcast-finestra [data-vcast="guarda"]', { timeout: 120000 });
      assert.equal(eleven.tts.length, 0);
      assert.match(await pagina.locator('#vcast-finestra').textContent(), /\(0 caratteri spesi adesso\)/);
    });

    // v483: col token le voci partono subito, una volta sola, nelle cartelle dei personaggi
    const repoFinito = () => pagina.waitForFunction(() => { const x = document.querySelector('#vcast-finestra .vcast-repo'); return x && !/Salvo le voci/.test(x.textContent); }, null, { timeout: 120000 });
    prova('col token le voci vanno sul repository, nella cartella di ogni personaggio, e gli altri dispositivi le sentono', async () => {
      await pagina.click('#vcast-finestra [data-vcast="chiudi"]');
      await pagina.evaluate(g => localStorage.setItem('astrocal_storie_repo_v1', JSON.stringify({ repo: g.repo, ramo: 'main', token: g.token })), GH);
      eleven.tts.length = 0;
      await tasto();
      await pagina.waitForSelector('#vcast-finestra [data-vcast="guarda"]', { timeout: 120000 });
      await repoFinito();
      const testo = await pagina.locator('#vcast-finestra .vcast-repo').textContent();
      assert.match(testo, /Salvata nel repository prova\/astro/, testo);
      assert.match(testo, /ripubblicato/);
      assert.equal(eleven.tts.length, 0, 'nessun credito speso per mandarle');
      const conId = battute.filter(b => /^demo\.narr\.storia_interstellar\.\d+$/.test(b.id));
      const voci = [...GH.file.keys()].filter(p => /storia_interstellar-\d+\.wav$/.test(p));
      assert.equal(voci.length, conId.length, 'una voce per battuta: ' + voci.length);
      const cooper = conId.find(b => b.chi === 'cooper');
      assert.ok(GH.file.has('audio/narrazione/storie/cooper/it/' + cooper.id.replace(/^demo\.narr\./, '').replace(/\.(\d+)$/, '-$1') + '.wav'), 'Cooper nella sua cartella');
      assert.equal(await pagina.evaluate(() => VociFilmato.vociInAttesa()), 0, 'segnate come mandate');
      const commit = GH.commit;
      await pagina.evaluate(() => StudioStorie.sincronizza({ spingi: true }));
      assert.equal(GH.commit, commit, 'non ripartono');
    });

    prova('«Un\'altra voce» cambia voce a un personaggio e rifà solo le sue battute', async () => {
      eleven.tts.length = 0;
      const sue = battute.filter(b => b.chi === 'doyle').length;
      await pagina.click('#vcast-finestra [data-vcast-chi="doyle"] [data-vcast="altra"]');
      await pagina.waitForSelector('#vcast-finestra [data-vcast="guarda"]', { timeout: 60000 });
      assert.equal(eleven.tts.length, sue, 'solo le battute di Doyle');
      const cast = await pagina.evaluate(() => JSON.parse(localStorage.getItem('astrocal_voci_cast_v1')).it);
      assert.notEqual(cast.doyle.id, 'UomoBrusco00001');
      const altri = Object.entries(cast).filter(([k]) => k !== 'doyle').map(([, x]) => x.id);
      assert.ok(!altri.includes(cast.doyle.id), 'non ruba la voce di un altro');
      assert.ok(eleven.tts.every(r => r.voce === cast.doyle.id));
      await repoFinito();
    });

    prova('«Togli queste voci»: la storia torna alla voce di prima', async () => {
      await pagina.click('#vcast-finestra [data-vcast="togli"]');
      await pagina.waitForFunction(() => /Voci tolte/.test(document.querySelector('#vcast-finestra .yt-file').textContent));
      assert.equal(await pagina.evaluate(() => VociFilmato.vociDellaStoria('storia_interstellar', 'it')), 0);
      const esito = await pagina.evaluate(async testo => { window.__sintesi = []; await narrazione.parla({ canale: 'prova', testo }); return window.__sintesi.length; }, battute[0].testo);
      assert.equal(esito, 1, 'di nuovo la sintesi');
      // v483: e via anche dal repository
      await pagina.waitForFunction(() => !JSON.parse(localStorage.getItem('astrocal_voci_cosmo_tolte_v1') || '[]').length, null, { timeout: 60000 });
      assert.deepEqual([...GH.file.keys()].filter(p => /storia_interstellar-/.test(p)), [], 'le voci tolte restavano sul repository');
      await pagina.click('#vcast-finestra [data-vcast="chiudi"]');
    });

    /* v487: chi usa l'app aveva fatto le voci di «Interstellar 1» sullo
     * smartphone e salvato: sul PC la storia parlava con la voce di sistema.
     * Sul repository non era arrivato nessun audio. Le voci erano state fatte
     * con la v482, che nel record non scriveva la battuta (`id`, `chi`): il
     * giro della v483 le scartava tutte, per sempre. Qui tre voci così (una
     * fatta dalla scheda di una copia dello Studio, con la sua chiave), e una
     * battuta che sul repository ha già una voce, rifatta altrove. */
    prova('le voci fatte prima della v483 (senza la battuta nel record) partono anche loro, e non vanno sopra a una rifatta altrove', async () => {
      const cooper = battute.filter(b => b.chi === 'cooper' && /^demo\.narr\.storia_interstellar\.\d+$/.test(b.id)).slice(0, 3);
      assert.equal(cooper.length, 3);
      const nome = b => 'audio/narrazione/storie/cooper/it/' + b.id.replace(/^demo\.narr\./, '').replace(/\.(\d+)$/, '-$1');
      const altrove = Buffer.from('voce rifatta su un altro dispositivo');
      const shaAltrove = crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + altrove.length + '\0'), altrove])).digest('hex');
      GH.file.set(nome(cooper[2]) + '.mp3', { sha: shaAltrove, buf: altrove });
      await pagina.evaluate(async ({ cooper, wav }) => {
        const blob = new Blob([new Uint8Array(wav)], { type: 'audio/wav' });
        await new Promise((ok, ko) => {
          const r = indexedDB.open(VociFilmato.VFILM_DB, 1);
          r.onupgradeneeded = () => r.result.createObjectStore('voci');
          r.onerror = () => ko(r.error);
          r.onsuccess = () => {
            const tr = r.result.transaction('voci', 'readwrite'), st = tr.objectStore('voci');
            cooper.forEach((b, i) => st.put({ blob, voce: 'UomoCaldoRoco01', testo: b.testo, motore: 'eleven', inviato: b.testo, quando: Date.now(),
              sempre: true, storia: i === 1 ? 'utente-copia-di-interstellar' : 'storia_interstellar', lingua: 'it' }, VociFilmato.chiave('eleven', b, 'it')));
            tr.oncomplete = () => { r.result.close(); ok(); };
            tr.onerror = () => ko(tr.error);
          };
        });
      }, { cooper, wav: [...wavTono(0.3, 440)] });
      assert.equal(await pagina.evaluate(() => VociFilmato.vociInAttesa()), 3, 'tutte e tre da mandare: prima restavano qui per sempre');
      await pagina.evaluate(() => StudioStorie.sincronizza({ spingi: true }));
      assert.ok(GH.file.has(nome(cooper[0]) + '.wav'), 'la voce della CosmoStoria è nella cartella di Cooper');
      assert.ok(GH.file.has(nome(cooper[1]) + '.wav'), 'anche quella fatta dalla scheda della copia (stesso testo)');
      assert.equal(GH.file.get(nome(cooper[2]) + '.mp3').sha, shaAltrove, 'la voce rifatta altrove resta');
      assert.ok(!GH.file.has(nome(cooper[2]) + '.wav'));
      assert.equal(await pagina.evaluate(() => VociFilmato.vociInAttesa()), 0, 'e non ripartono');
      const commit = GH.commit;
      await pagina.evaluate(() => StudioStorie.sincronizza({ spingi: true }));
      assert.equal(GH.commit, commit);
      // la storia le suona ancora qui, e «Togli» non toglie dal repository quella di un altro
      await pagina.evaluate(() => VociFilmato.togliVociStoria('storia_interstellar'));
      await pagina.evaluate(() => StudioStorie.sincronizza({ spingi: true }));
      assert.equal(GH.file.get(nome(cooper[2]) + '.mp3').sha, shaAltrove, '«Togli» lascia la voce dell\'altro dispositivo');
      assert.ok(!GH.file.has(nome(cooper[0]) + '.wav'), '«Togli» toglie quella mandata da qui');
    });

    /* v488: «Interstellar 1» ha otto battute nuove in mezzo, e le battute si
     * numerano in ordine di scena: la 5 di prima è la 8. Una voce fatta su un
     * altro dispositivo e non ancora mandata ricorda il numero vecchio: non
     * deve finire sul file della battuta che adesso ha quel numero. */
    prova('una voce col numero di prima della rinumerazione va sulla battuta del suo testo, non su quella del numero', async () => {
      const cooper = battute.filter(b => b.chi === 'cooper' && /^demo\.narr\.storia_interstellar\.\d+$/.test(b.id)).slice(3, 6);
      assert.equal(cooper.length, 3);
      const nome = b => 'audio/narrazione/storie/cooper/it/' + b.id.replace(/^demo\.narr\./, '').replace(/\.(\d+)$/, '-$1');
      for (const b of cooper) for (const est of ['.mp3', '.wav']) GH.file.delete(nome(b) + est);
      await pagina.evaluate(async ({ cooper, wav }) => {
        const blob = new Blob([new Uint8Array(wav)], { type: 'audio/wav' });
        await new Promise((ok, ko) => {
          const r = indexedDB.open(VociFilmato.VFILM_DB, 1);
          r.onupgradeneeded = () => r.result.createObjectStore('voci');
          r.onerror = () => ko(r.error);
          r.onsuccess = () => {
            const tr = r.result.transaction('voci', 'readwrite'), st = tr.objectStore('voci');
            const rec = (testo, id) => ({ blob, voce: 'UomoCaldoRoco01', testo, motore: 'eleven', inviato: testo, quando: Date.now(),
              sempre: true, storia: 'storia_interstellar', lingua: 'it', id, chi: 'cooper' });
            // il testo della prima col numero della seconda (il numero di prima)
            st.put(rec(cooper[0].testo, cooper[1].id), VociFilmato.chiave('eleven', cooper[0], 'it'));
            // un testo che nessuna battuta dice più, col numero della terza
            const via = Object.assign({}, cooper[2], { testo: 'Una frase che non c\'è più.' });
            st.put(rec(via.testo, cooper[2].id), VociFilmato.chiave('eleven', via, 'it'));
            tr.oncomplete = () => { r.result.close(); ok(); };
            tr.onerror = () => ko(tr.error);
          };
        });
      }, { cooper, wav: [...wavTono(0.3, 330)] });
      assert.equal(await pagina.evaluate(() => VociFilmato.vociInAttesa()), 1, 'parte solo quella che ha ancora una battuta');
      await pagina.evaluate(() => StudioStorie.sincronizza({ spingi: true }));
      assert.ok(GH.file.has(nome(cooper[0]) + '.wav'), 'la voce va sulla battuta del suo testo');
      assert.ok(!GH.file.has(nome(cooper[1]) + '.wav'), 'e non su quella che adesso ha il suo numero di prima');
      assert.ok(!GH.file.has(nome(cooper[2]) + '.wav'), 'quella senza più battuta resta qui');
      assert.equal(await pagina.evaluate(() => VociFilmato.vociInAttesa()), 0);
      const esito = await pagina.evaluate(async testo => { await VociFilmato.caricaVociStorie(); window.__sintesi = []; await narrazione.parla({ canale: 'prova', testo }); return window.__sintesi.length; }, 'Una frase che non c\'è più.');
      assert.equal(esito, 0, 'e suona ancora, dal testo');
      await pagina.evaluate(() => VociFilmato.togliVociStoria('storia_interstellar'));
    });

    // v524: dalla pagina Demo, con una demo senza personaggi e senza voci
    // registrate (la ISS): le battute di
    // `narrate` hanno il narratore, e il narratore ha la sua voce
    prova('dalla pagina Demo: «Voci ElevenLabs» dà una voce anche al narratore', async () => {
      await mettiChiave('chiave-finta');
      await pagina.evaluate(() => { const x = document.querySelector('#vcast-finestra [data-vcast="chiudi"]'); if (x) x.click(); });
      eleven.tts.length = 0;
      const attese = await pagina.evaluate(() => VociFilmato.battute(AstroDemo.libreria.elenco().find(d => d.chiave === 'passaggio_iss').testo));
      assert.ok(attese.length > 0 && attese.every(b => !b.chi), 'le battute della demo sono del narratore');
      await pagina.evaluate(() => { mostraVista('demo'); demoMostraScheda('demo-scheda-demo'); });
      await pagina.selectOption('#demo-elenco', 'passaggio_iss');
      await pagina.click('#demo-voci');
      await pagina.waitForSelector('#vcast-finestra [data-vcast="guarda"]', { timeout: 120000 });
      const riga = pagina.locator('#vcast-finestra [data-vcast-chi="narratore"]');
      assert.equal(await riga.count(), 1, 'una riga per il narratore');
      assert.match(await riga.textContent(), /Narratore/);
      const cast = await pagina.evaluate(() => JSON.parse(localStorage.getItem('astrocal_voci_cast_v1')).it);
      assert.ok(cast.narratore && /^Donna/.test(cast.narratore.id), 'la voce narrante è di donna: ' + JSON.stringify(cast.narratore));
      assert.equal(eleven.tts.length, attese.length, 'una richiesta per battuta');
      assert.ok(eleven.tts.every(r => r.voce === cast.narratore.id), 'tutte con la voce del narratore');
      const esito = await pagina.evaluate(async testo => { window.__sintesi = []; const e = await narrazione.parla({ canale: 'prova', testo }); return { e, sintesi: window.__sintesi.length }; }, attese[0].testo);
      assert.equal(esito.e, 'audio', 'e la narrazione la suona al posto della sintesi');
      await pagina.click('#vcast-finestra [data-vcast="togli"]');
      await pagina.click('#vcast-finestra [data-vcast="chiudi"]');
    });

    prova('il voto e il carattere (funzioni pure)', async () => {
      const r = await pagina.evaluate(() => {
        const V = VociFilmato;
        const ben = V.carattere('astro_ben', StorieCosmiche.profilo('astro_ben'), '');
        const buco = V.carattere('sgr_a', StorieCosmiche.profilo('sgr_a'), 'Lui. Il gigante buono: voce bassissima, lenta, calma e profonda');
        const caldo = { name: 'A', gender: 'male', age: 'middle_aged', description: 'warm raspy deep', use_case: 'narrative_story' };
        const pubb = { name: 'B', gender: 'male', age: 'young', description: 'upbeat', use_case: 'advertisement', cloned_by_count: 1e6 };
        const donna = { name: 'C', gender: 'female', age: 'middle_aged', description: 'warm raspy deep' };
        const cooper = V.carattere('cooper', StorieCosmiche.profilo('cooper'), '');
        return { ben, buco, caldo: V.votoVoce(caldo, cooper, 'it'), pubb: V.votoVoce(pubb, cooper, 'it'), donna: V.votoVoce(donna, cooper, 'it'),
          regia: V.testoConRegia({ testo: 'Ciao.', id: '', faccia: 'happy' }, 'it', null, 'eleven_v3'),
          nudo: V.testoConRegia({ testo: 'Ciao.', id: '', faccia: 'happy' }, 'it', null, 'eleven_multilingual_v2') };
      });
      assert.equal(r.ben.eta, 'young'); assert.ok(r.ben.parole.includes('child'));
      assert.equal(r.buco.eta, 'old'); assert.ok(r.buco.parole.includes('deep') && r.buco.parole.includes('calm'));
      assert.ok(r.caldo > r.pubb, 'la voce giusta batte quella famosa: ' + r.caldo + ' / ' + r.pubb);
      assert.ok(r.donna < r.caldo - 5, 'il genere sbagliato perde');
      assert.equal(r.regia, '[happy] Ciao.');
      assert.equal(r.nudo, 'Ciao.', 'senza v3 il testo nudo');
    });

    for (const [nome, fn] of prove) {
      try { await fn(); passate++; console.log('  ok       ' + nome); }
      catch (e) { fallite++; console.log('  FALLITA  ' + nome + '\n           ' + String(e && e.stack || e).split('\n').slice(0, 4).join('\n           ')); }
    }
    if (errori.length) { fallite++; console.log('  FALLITA  errori nella pagina: ' + errori.join(' | ')); }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(`\n${passate} passate, ${fallite} fallite (voci delle CosmoStorie)`);
  process.exitCode = fallite ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
