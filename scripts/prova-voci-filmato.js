#!/usr/bin/env node
/* Le voci del filmato (v478, `voci-filmato.js`), nel browser vero:
 *
 *   npm install --no-save playwright-core astronomy-engine satellite.js@5.0.0 \
 *     onnxruntime-web@1.18.0 @diffusionstudio/piper-wasm@1.0.0
 *   node scripts/prova-voci-filmato.js
 *
 * La voce di sistema del dispositivo non entra nel filmato: prima di
 * registrare per YouTube le battute che la userebbero diventano file, con
 * ElevenLabs (finto: le rotte di Playwright su api.elevenlabs.io) o con
 * Piper. Di Piper girano veri il motore (onnxruntime-web) e il fonemizzatore
 * (espeak-ng in wasm), dai pacchetti npm al posto di jsdelivr; il modello
 * della voce no (Hugging Face non si raggiunge da qui): la sessione del
 * modello è finta e restituisce un tono lungo quanto i fonemi.
 *
 * Si prova: quali battute vanno generate (non quelle con un audio
 * registrato), la finestra coi caratteri da spendere, una voce diversa per
 * personaggio e del suo genere, la voce scelta nello Studio che vince, le
 * voci già fatte che non si rifanno, i crediti finiti a metà e «le altre con
 * Piper», il tono di un bambino più alto, una storia senza sintesi che parte
 * subito, e la prova vera: una storia registrata col registratore dell'app,
 * con la voce di sistema muta, ha la voce nel file. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
let pw;
try { pw = require('playwright-core'); } catch (_) { pw = require('playwright'); }

const radice = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(radice, '.' + (req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.mp3') ? 'audio/mpeg' : 'text/html');
  res.end(fs.readFileSync(file));
});
function chromiumVero() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  for (const c of ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome', '/opt/pw-browsers/chromium'])
    if (fs.existsSync(c)) return c;
  return undefined;
}
// Un WAV con un tono, come risposta di ElevenLabs
function wavTono(secondi = 0.8, hz = 330, frequenza = 22050) {
  const n = Math.round(secondi * frequenza), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(frequenza, 24); b.writeUInt32LE(frequenza * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * i / frequenza) * 12000), 44 + i * 2);
  return b;
}
// dove sta un pacchetto (alcuni non lasciano risolvere il loro package.json)
function pacchetto(nome) {
  const qui = path.join(radice, 'node_modules', nome);
  if (fs.existsSync(path.join(qui, 'package.json'))) return qui;
  try { return path.dirname(require.resolve(nome + '/package.json')); } catch (_) { return null; }
}
const ORT = pacchetto('onnxruntime-web'), FONEMI = pacchetto('@diffusionstudio/piper-wasm');

const prove = [];
const prova = (nome, fn) => prove.push([nome, fn]);

(async () => {
  let browser, passate = 0, fallite = 0;
  const eleven = { richieste: [], crediti: Infinity };
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    browser = await pw.chromium.launch({ executablePath: chromiumVero(), args: ['--autoplay-policy=no-user-gesture-required'] });
    const pagina = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 1100, height: 900 } });
    pagina.setDefaultTimeout(Number(process.env.ATTESA) || 30000);
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
      // il motore di Piper dai pacchetti npm
      let m = /^\/npm\/onnxruntime-web@1\.18\.0\/dist\/(.+)$/.exec(u.pathname);
      if (u.hostname === 'cdn.jsdelivr.net' && m && ORT) {
        const f = path.join(ORT, 'dist', m[1]);
        return fs.existsSync(f) ? r.fulfill({ headers: cors, contentType: f.endsWith('.wasm') ? 'application/wasm' : 'text/javascript', body: fs.readFileSync(f) }) : r.fulfill({ status: 404, headers: cors, body: '' });
      }
      m = /^\/npm\/@diffusionstudio\/piper-wasm@1\.0\.0\/build\/(.+)$/.exec(u.pathname);
      if (u.hostname === 'cdn.jsdelivr.net' && m && FONEMI) {
        const f = path.join(FONEMI, 'build', m[1]);
        return r.fulfill({ headers: cors, contentType: f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream', body: fs.readFileSync(f) });
      }
      // i modelli: la configurazione vera di una voce, e un file che fa da modello
      if (u.hostname === 'huggingface.co') {
        if (u.pathname.endsWith('.onnx.json')) {
          const it = u.pathname.includes('it_IT');
          return r.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({
            audio: { sample_rate: 22050 }, espeak: { voice: it ? 'it' : 'en-us' }, inference: { noise_scale: 0.667, length_scale: 1, noise_w: 0.8 }, num_speakers: 1 }) });
        }
        if (u.pathname.endsWith('.onnx')) return r.fulfill({ headers: Object.assign({ 'content-length': '2048' }, cors), contentType: 'application/octet-stream', body: Buffer.alloc(2048, 1) });
        return r.fulfill({ status: 404, headers: cors, body: '' });
      }
      if (u.hostname === 'api.elevenlabs.io') {
        if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
        const json = (o, status = 200) => r.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
        if (u.pathname === '/v2/voices') return json({ voices: [
          { voice_id: 'VoceDonnaUno0001', labels: { gender: 'female' } }, { voice_id: 'VoceUomoUno00001', labels: { gender: 'male' } },
          { voice_id: 'VoceDonnaDue0002', labels: { gender: 'female' } }, { voice_id: 'VoceUomoDue00002', labels: { gender: 'male' } },
          { voice_id: 'VoceDonnaTre0003', labels: { gender: 'female' } }, { voice_id: 'VoceUomoTre00003', labels: { gender: 'male' } }] });
        const t = /^\/v1\/text-to-speech\/([A-Za-z0-9]+)$/.exec(u.pathname);
        if (t && req.method() === 'POST') {
          const corpo = JSON.parse(req.postData() || '{}');
          eleven.richieste.push({ voce: t[1], testo: corpo.text, modello: corpo.model_id, chiave: req.headers()['xi-api-key'] });
          if (eleven.crediti <= 0) return json({ detail: { status: 'quota_exceeded', message: 'quota exceeded' } }, 401);
          eleven.crediti--;
          return r.fulfill({ headers: cors, contentType: 'audio/wav', body: wavTono() });
        }
        return json({}, 404);
      }
      if (u.hostname === 'accounts.google.com') return r.fulfill({ contentType: 'text/javascript', body: 'window.google = { accounts: { oauth2: { initTokenClient() { return { requestAccessToken() {} }; } } } };' });
      return r.abort();
    });
    await pagina.addInitScript(() => {
      localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
      localStorage.setItem('astrocal_demo_intro_v1', JSON.stringify({ attiva: false }));
      localStorage.setItem('astrocal_lingua', 'it');
      // La voce di sistema: parla (i tempi ci sono) ma non fa suono, come
      // per il registratore quella vera
      const voce = { corrente: null, timer: [], getVoices: () => [{ name: 'Finta', lang: 'it-IT', default: true, localService: true }], addEventListener() {},
        speak(u) { voce.cancel(); voce.corrente = u; (window.__sintesi = window.__sintesi || []).push(u.text); const n = u.text.split(/\s+/).length;
          voce.timer.push(setTimeout(() => u.onstart && u.onstart(), 20));
          voce.timer.push(setTimeout(() => { if (voce.corrente === u) { voce.corrente = null; u.onend && u.onend(); } }, 60 + n * 250)); },
        cancel() { voce.timer.forEach(clearTimeout); voce.timer = []; const u = voce.corrente; voce.corrente = null; if (u && u.onerror) u.onerror({ error: 'interrupted' }); } };
      Object.defineProperty(window, 'speechSynthesis', { value: voce, configurable: true });
      window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ''; } };
    });
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => window.VociFilmato && window.StudioStorie && window.AstroDemo && window.StorieCosmiche && typeof window.ytRegistraEPubblica === 'function' && sky.observer && sky.oggetti.length);
    const testoDi = chiave => pagina.evaluate(k => AstroDemo.libreria.elenco().find(d => d.chiave === k).testo, chiave);
    // AstroDemo.avvia finto: si guarda solo con che cosa la si chiama
    // (e la dà per partita: una demo che non parte si riprende le voci)
    const avviaFinto = () => pagina.evaluate(() => {
      window.__avvii = [];
      if (!window.__avviaVera) {
        window.__avviaVera = AstroDemo.avvia;
        window.__inCorsoVero = Object.getOwnPropertyDescriptor(AstroDemo, 'inCorso');
      }
      AstroDemo.avvia = (testo, una) => { window.__avvii.push({ testo: testo.slice(0, 40), una, voci: VociFilmato.stato.urls.length }); };
      Object.defineProperty(AstroDemo, 'inCorso', { configurable: true, get: () => true });
    });
    const avviaVero = () => pagina.evaluate(() => {
      if (window.__avviaVera) { AstroDemo.avvia = window.__avviaVera; Object.defineProperty(AstroDemo, 'inCorso', window.__inCorsoVero); }
    });
    const svuota = () => pagina.evaluate(() => new Promise(ok => { const r = indexedDB.deleteDatabase(VociFilmato.VFILM_DB); r.onsuccess = r.onerror = r.onblocked = () => ok(); }));
    const youtube = chiave => pagina.evaluate(k => { mostraVista('demo'); demoMostraScheda('demo-scheda-storie'); document.querySelector(`[data-storia-youtube="${k}"]`).click(); }, chiave);
    const mettiChiave = c => pagina.evaluate(c => { if (c) localStorage.setItem('astrocal_elevenlabs_v1', JSON.stringify({ chiave: c, modello: 'eleven_v3', stabilita: 0.5 })); else localStorage.removeItem('astrocal_elevenlabs_v1'); VociFilmato.stato.vociEleven = null; }, c);

    prova('le battute da generare: quelle che andrebbero alla sintesi, non quelle con un audio registrato', async () => {
      const luna = await pagina.evaluate(t => VociFilmato.battute(t), await testoDi('storia_luna'));
      const tempo = await pagina.evaluate(t => VociFilmato.battute(t), await testoDi('storia_tempo'));
      const puntino = await pagina.evaluate(t => VociFilmato.battute(t), await testoDi('storia_puntino'));
      assert.equal(luna.length, 0, 'la storia della Luna ha le voci registrate: ' + JSON.stringify(luna.slice(0, 2)));
      assert.ok(tempo.length >= 10, 'la macchina del tempo parla con la sintesi: ' + tempo.length);
      assert.ok(tempo.every(b => b.testo && typeof b.chi === 'string'));
      assert.ok(new Set(tempo.map(b => b.chi)).has('andromeda'), 'col personaggio che le dice');
      assert.equal(puntino.length, 0, 'la storia cantata non usa la sintesi');
      // a narrazione spenta non parla nessuno
      const spenta = await pagina.evaluate(t => { const p = narrazione.preferenze(); narrazione.impostaPreferenze ? narrazione.impostaPreferenze({ attiva: false }) : null;
        const n = VociFilmato.battute(t).length; if (narrazione.impostaPreferenze) narrazione.impostaPreferenze({ attiva: p.attiva }); return n; }, await testoDi('storia_tempo'));
      assert.equal(spenta, 0);
    });

    prova('una storia senza sintesi parte subito, senza la finestra', async () => {
      await avviaFinto();
      await youtube('storia_puntino');
      assert.equal(await pagina.locator('#vfilm-finestra').count(), 0);
      const avvii = await pagina.evaluate(() => window.__avvii);
      assert.equal(avvii.length, 1);
      assert.deepEqual(avvii[0].una, { registra: true, registraAudio: true, perYoutube: true, schermoIntero: true });
    });

    prova('ElevenLabs: la finestra dice i caratteri, una voce per personaggio e del suo genere, poi «Registra e pubblica»', async () => {
      await svuota(); await mettiChiave('chiave-finta'); await avviaFinto();
      eleven.richieste.length = 0;
      const battute = await pagina.evaluate(t => VociFilmato.battute(t), await testoDi('storia_tempo'));
      const caratteri = battute.reduce((n, b) => n + b.testo.length, 0);
      await youtube('storia_tempo');
      await pagina.waitForSelector('#vfilm-finestra [data-vfilm="eleven"]');
      assert.equal((await pagina.evaluate(() => window.__avvii)).length, 0, 'non parte prima delle voci');
      // i numeri come li scrive il dizionario: 1.581 (Node non sempre li sa scrivere così)
      const num = String(caratteri).replace(/\B(?=(\d{3})+(?!\d))/g, '\\.?');
      assert.match(await pagina.locator('#vfilm-finestra').textContent(), new RegExp(battute.length + ' battute \\(' + num + ' caratteri\\)'));
      assert.match(await pagina.locator('#vfilm-finestra [data-vfilm="eleven"]').textContent(), new RegExp('circa ' + num + ' caratteri'));
      await pagina.click('#vfilm-finestra [data-vfilm="eleven"]');
      await pagina.waitForSelector('#vfilm-finestra [data-vfilm="registra"]');
      assert.match(await pagina.locator('#vfilm-finestra').textContent(), new RegExp('Pronte tutte le ' + battute.length + ' voci'));
      assert.equal(eleven.richieste.length, battute.length, 'una richiesta per battuta');
      assert.ok(eleven.richieste.every(r => r.chiave === 'chiave-finta' && r.modello === 'eleven_v3'));
      // una voce per personaggio, diverse fra loro, del genere giusto
      const perChi = new Map();
      for (const r of eleven.richieste) { const b = battute.find(x => x.testo === r.testo); if (!perChi.has(b.chi)) perChi.set(b.chi, new Set()); perChi.get(b.chi).add(r.voce); }
      for (const [, v] of perChi) assert.equal(v.size, 1, 'un personaggio, una voce');
      const voci = [...perChi.values()].map(v => [...v][0]);
      const generi = await pagina.evaluate(ids => ids.map(id => StorieCosmiche.profilo(id).genere === 'm' ? 'm' : 'f'), [...perChi.keys()]);
      voci.forEach((v, i) => assert.equal(/Donna/.test(v) ? 'f' : 'm', generi[i], [...perChi.keys()][i] + ' ha la voce del suo genere'));
      // diverse finché ce ne sono (tre per genere nell'account finto), poi a giro
      for (const g of ['f', 'm']) {
        const sue = voci.filter((_, i) => generi[i] === g);
        assert.equal(new Set(sue).size, Math.min(sue.length, 3), 'personaggi diversi, voci diverse: ' + voci.join(','));
      }
      await pagina.click('#vfilm-finestra [data-vfilm="registra"]');
      const avvii = await pagina.evaluate(() => window.__avvii);
      assert.equal(avvii.length, 1);
      assert.deepEqual(avvii[0].una, { registra: true, registraAudio: true, perYoutube: true, schermoIntero: true });
      assert.equal(avvii[0].voci, battute.length, 'le voci prestate alla narrazione prima di partire');
      assert.equal(await pagina.locator('#vfilm-finestra').count(), 0);
      // la narrazione le suona al posto della sintesi
      const pezzo = battute[0].testo;
      const esito = await pagina.evaluate(async testo => { window.__sintesi = []; const e = await narrazione.parla({ canale: 'prova', testo }); return { e, sintesi: window.__sintesi.length }; }, pezzo);
      assert.equal(esito.e, 'audio', 'dal file: ' + JSON.stringify(esito));
      assert.equal(esito.sintesi, 0, 'la voce di sistema tace');
      // finita la registrazione, tornano a casa
      await pagina.evaluate(() => ytDopoRegistrazione(null));
      assert.equal(await pagina.evaluate(() => VociFilmato.stato.urls.length), 0);
      const dopo = await pagina.evaluate(async testo => { window.__sintesi = []; await narrazione.parla({ canale: 'prova', testo }); return window.__sintesi.length; }, pezzo);
      assert.equal(dopo, 1, 'fuori dalla registrazione parla la voce di sempre');
    });

    prova('la seconda volta le voci sono già pronte: niente crediti', async () => {
      await avviaFinto();
      eleven.richieste.length = 0;
      await youtube('storia_tempo');
      await pagina.waitForSelector('#vfilm-finestra [data-vfilm="eleven"]');
      await pagina.waitForFunction(() => /già pronte/.test(document.querySelector('#vfilm-finestra [data-vfilm="eleven"]').textContent));
      assert.match(await pagina.locator('#vfilm-finestra [data-vfilm="eleven"]').textContent(), /circa 0 caratteri/);
      await pagina.click('#vfilm-finestra [data-vfilm="eleven"]');
      await pagina.waitForSelector('#vfilm-finestra [data-vfilm="registra"]');
      assert.equal(eleven.richieste.length, 0);
      await pagina.click('#vfilm-finestra [data-vfilm="annulla"]');
      assert.equal((await pagina.evaluate(() => window.__avvii)).length, 0, '«Annulla» non registra');
    });

    prova('la voce scelta nello Studio per il personaggio vince', async () => {
      const scelte = await pagina.evaluate(t => {
        const b = VociFilmato.battute(t);
        const v = VociFilmato.scegliVociEleven(b, [{ id: 'VoceDonnaUno0001', genere: 'f' }, { id: 'VoceUomoUno00001', genere: 'm' }], id => id === 'Moon' ? { id: 'VoceDelloStudio1' } : null);
        return Object.fromEntries(v);
      }, await testoDi('storia_tempo'));
      assert.equal(scelte.Moon, 'VoceDelloStudio1');
      assert.notEqual(scelte.andromeda, 'VoceDelloStudio1');
    });

    prova('i crediti finiscono a metà: le pronte restano, le altre con Piper', async () => {
      await svuota(); await mettiChiave('chiave-finta'); await avviaFinto();
      eleven.richieste.length = 0; eleven.crediti = 3;
      await youtube('storia_tempo');
      await pagina.click('#vfilm-finestra [data-vfilm="eleven"]');
      await pagina.waitForSelector('#vfilm-finestra [data-vfilm="altrePiper"]');
      assert.match(await pagina.locator('#vfilm-finestra').textContent(), /3 voci pronte/);
      assert.match(await pagina.locator('#vfilm-finestra .vfilm-errore').textContent(), /crediti|chiave/i);
      assert.equal(eleven.richieste.length, 4, 'si ferma al primo rifiuto');
      eleven.crediti = Infinity;
      await pagina.click('#vfilm-finestra [data-vfilm="annulla"]');
    });

    if (ORT && FONEMI) {
      prova('Piper: il motore vero e i fonemi veri di espeak-ng', async () => {
        const fonemi = await pagina.evaluate(async () => {
          await VociFilmato.piperPronto([]);
          return { it: await VociFilmato.fonemi('Ciao, sono la Luna.', 'it'), en: await VociFilmato.fonemi('Hello, I am the Moon.', 'en-us'), ort: !!(window.ort && ort.InferenceSession) };
        });
        assert.ok(fonemi.ort, 'onnxruntime caricato');
        assert.ok(Array.isArray(fonemi.it) && fonemi.it.length > 10, 'fonemi italiani: ' + JSON.stringify(fonemi.it).slice(0, 80));
        assert.ok(Array.isArray(fonemi.en) && fonemi.en.length > 10);
        assert.notDeepEqual(fonemi.it, fonemi.en);
      });
      prova('Piper senza chiave: la finestra lo propone, genera WAV, e il bambino ha la voce più alta', async () => {
        await svuota(); await mettiChiave(''); await avviaFinto();
        // la sessione del modello è finta: un tono lungo quanto i fonemi
        await pagina.evaluate(() => {
          window.__sessioni = [];
          ort.InferenceSession.create = async () => ({ run: async feeds => {
            const n = Number(feeds.input.dims[1]), scala = feeds.scales.data[1];
            window.__sessioni.push({ fonemi: n, scala });
            const d = new Float32Array(Math.round(n * 256 * scala));
            for (let i = 0; i < d.length; i++) d[i] = Math.sin(i / 8) * 0.4;
            return { output: { data: d } };
          } });
          VociFilmato.stato.piper.modelli.clear();
        });
        await youtube('storia_einstein');
        await pagina.waitForSelector('#vfilm-finestra [data-vfilm="piper"]');
        assert.equal(await pagina.locator('#vfilm-finestra [data-vfilm="eleven"]').count(), 0, 'senza chiave, niente ElevenLabs');
        assert.match(await pagina.locator('#vfilm-finestra').textContent(), /chiave nello Studio/);
        assert.match(await pagina.locator('#vfilm-finestra [data-vfilm="piper"]').textContent(), /scarica circa \d+ MB/);
        await pagina.click('#vfilm-finestra [data-vfilm="piper"]');
        await pagina.waitForSelector('#vfilm-finestra [data-vfilm="registra"]', { timeout: 120000 });
        assert.match(await pagina.locator('#vfilm-finestra').textContent(), /Pronte tutte le \d+ voci/);
        const ben = await pagina.evaluate(async () => {
          const b = VociFilmato.battute(AstroDemo.libreria.elenco().find(d => d.chiave === 'storia_einstein').testo);
          const una = b.find(x => x.chi === 'astro_ben'), lui = b.find(x => x.chi === 'einstein');
          const leggi = async x => { const k = VociFilmato.chiave('piper', x, 'it');
            const rec = await new Promise(ok => { const r = indexedDB.open(VociFilmato.VFILM_DB); r.onsuccess = () => { const q = r.result.transaction('voci').objectStore('voci').get(k); q.onsuccess = () => { ok(q.result); r.result.close(); }; }; });
            const dv = new DataView(await rec.blob.arrayBuffer());
            return { frequenza: dv.getUint32(24, true), tipo: rec.blob.type, voce: rec.voce };
          };
          return { ben: await leggi(una), einstein: await leggi(lui) };
        });
        assert.equal(ben.ben.tipo, 'audio/wav');
        assert.match(ben.ben.voce, /riccardo/, 'un bambino, la voce maschile');
        assert.ok(ben.ben.frequenza > ben.einstein.frequenza * 1.2, 'Astro Ben più alto di Einstein: ' + ben.ben.frequenza + ' contro ' + ben.einstein.frequenza);
        await pagina.click('#vfilm-finestra [data-vfilm="registra"]');
        assert.equal((await pagina.evaluate(() => window.__avvii)).length, 1);
        await pagina.evaluate(() => ytDopoRegistrazione(null));
      });
    }

    prova('la prova vera: la storia registrata ha la voce nel file, anche con la voce di sistema muta', async () => {
      await svuota(); await mettiChiave('chiave-finta'); await avviaVero();
      eleven.richieste.length = 0;
      const testo = `define_demo 'prova_voci_filmato' {
  scene solar_system_3d {
    duration: 3s;
    action: camera_3d { scene: system, focus: 'Sun' };
    action: character_show { target: 'Moon', expression: 'happy' };
    action: character_speak { target: 'Moon', text: 'Ciao a tutti, questa battuta deve sentirsi nel filmato.' };
  }
}`;
      await pagina.evaluate(t => { window.__sintesi = []; ytRegistraEPubblica(t, 'Prova delle voci'); }, testo);
      await pagina.click('#vfilm-finestra [data-vfilm="eleven"]');
      await pagina.click('#vfilm-finestra [data-vfilm="registra"]');
      // il picco della presa, finché la registrazione va
      await pagina.evaluate(() => { window.__picco = 0; window.__guardia = setInterval(() => { const s = narrazione.catturaStato(); if (s.picco > window.__picco) window.__picco = s.picco; }, 50); });
      await pagina.waitForSelector('#yt-finestra', { timeout: 60000 });
      const durante = await pagina.evaluate(() => { clearInterval(window.__guardia); return { picco: window.__picco, sintesi: (window.__sintesi || []).length }; });
      assert.ok(durante.picco > 0.01, 'la voce passa nella presa: ' + JSON.stringify(durante));
      assert.equal(durante.sintesi, 0, 'e la voce di sistema non ha parlato');
      assert.match(await pagina.locator('#yt-finestra .yt-file').textContent(), /con l'audio/);
      assert.equal(await pagina.locator('#yt-finestra .yt-senza-audio').count(), 0, 'la finestra non dice «muto»');
      const suono = await pagina.evaluate(async () => {
        const buf = await new AudioContext().decodeAudioData(await sky.reg.esito.blob.arrayBuffer());
        const d = buf.getChannelData(0); let picco = 0;
        for (let i = 0; i < d.length; i++) picco = Math.max(picco, Math.abs(d[i]));
        return picco;
      });
      // la voce finta è un tono a 0,37; musica e rumori della storia, senza voce, restano sotto 0,05
      assert.ok(suono > 0.2, 'il file registrato ha la voce: picco ' + suono);
      assert.equal(await pagina.evaluate(() => VociFilmato.stato.urls.length), 0, 'e dopo le voci tornano a casa');
      await pagina.locator('#yt-finestra [data-yt="chiudi"]').click();
      await pagina.evaluate(() => skyRegChiudiPannello && skyRegChiudiPannello());
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
  console.log(`\n${passate} passate, ${fallite} fallite (voci del filmato)`);
  process.exitCode = fallite ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
