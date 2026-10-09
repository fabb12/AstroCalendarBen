#!/usr/bin/env node
/* YouTube (v464, `youtube.js`), nel browser vero:
 *
 *   node scripts/prova-youtube.js
 *
 * Un Google finto (le rotte di Playwright su accounts.google.com e
 * www.googleapis.com) e il giro intero: l'ID client nelle Impostazioni
 * (sbagliato e giusto), «Collega» con la finestra di Google (finta), il nome
 * del canale; il filmato del pannello «Il tuo momento» pubblicato col
 * titolo della storia, la visibilità scelta, e la rete che cade a metà
 * caricamento (si riprende da dove YouTube dice di essere arrivato); la
 * quota finita; «Annulla»; «Registra e pubblica» dallo Studio e dalle
 * schede delle CosmoStorie; la finestra a larghezza di telefono e in
 * inglese; «Scollega». Il gettone di Google non deve mai finire in
 * `localStorage`.
 *
 * v465: il filmato si controlla prima di aprire la finestra, che ha
 * l'anteprima e dice misura e durata (un filmato vero, registrato nella
 * pagina; uno vuoto e uno rovinato non si pubblicano); le corse per YouTube
 * si registrano a risoluzione piena e senza data e luogo in basso a sinistra. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
let pw;
try { pw = require('playwright-core'); } catch (_) { pw = require('playwright'); }

const radice = path.resolve(__dirname, '..');
const CLIENT = '123456789012-provaprovaprova0123456789abcdef.apps.googleusercontent.com';
const GETTONE = 'ya29.gettone-finto';
const server = http.createServer((req, res) => {
  const file = path.resolve(radice, '.' + (req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(fs.readFileSync(file));
});
function chromiumVero() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  for (const c of ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'])
    if (fs.existsSync(c)) return c;
  return undefined;
}
// Lo script di Google finto: la finestra di consenso risponde subito col
// gettone, e si ricorda che cosa le è stato chiesto
const GIS_FINTO = `window.google = { accounts: { oauth2: {
  initTokenClient(cfg) {
    window.__ytClient = { client_id: cfg.client_id, scope: cfg.scope };
    return { requestAccessToken(o) {
      (window.__ytConsensi = window.__ytConsensi || []).push(o || {});
      if (window.__ytNega) { setTimeout(() => cfg.error_callback && cfg.error_callback({ type: 'popup_closed' }), 5); return; }
      setTimeout(() => cfg.callback({ access_token: ${JSON.stringify(GETTONE)}, expires_in: 3599, scope: cfg.scope }), 5);
    } };
  },
  hasGrantedAllScopes() { return true; },
  revoke(t, cb) { (window.__ytRevocati = window.__ytRevocati || []).push(t); if (cb) cb(); }
} } };`;

const prove = [];
const prova = (nome, fn) => prove.push([nome, fn]);

(async () => {
  let browser;
  const richieste = [];
  // come risponde il finto YouTube al caricamento: 'ripresa' (la rete cade
  // a metà la prima volta), 'quota', 'appeso' (aspetta finché non lo si
  // annulla)
  const modo = { carica: 'ripresa', primoPut: true, appeso: null };
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    browser = await pw.chromium.launch({ executablePath: chromiumVero() });
    const pagina = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 1100, height: 900 } });
    pagina.setDefaultTimeout(Number(process.env.ATTESA) || 20000);
    if (process.env.DEBUG) pagina.on('console', m => console.log('console:', m.text()));
    const errori = [];
    pagina.on('pageerror', e => errori.push(e.message));
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
      'access-control-expose-headers': 'Location, Range' };
    await pagina.route('**/*', async r => {
      const req = r.request(), url = req.url();
      if (url.startsWith(origine)) return r.continue();
      if (url.includes('astronomy.browser.min.js')) return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(radice, 'node_modules/astronomy-engine/astronomy.browser.min.js')) });
      const u = new URL(url);
      if (u.hostname === 'accounts.google.com' && u.pathname === '/gsi/client') return r.fulfill({ contentType: 'text/javascript', body: GIS_FINTO });
      if (u.hostname === 'yt3.ggpht.com') return r.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
      if (u.hostname !== 'www.googleapis.com') return r.abort();
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      const intest = req.headers();
      const voce = { metodo: req.method(), via: u.pathname, q: Object.fromEntries(u.searchParams), auth: intest.authorization, intest };
      richieste.push(voce);
      const json = (o, status = 200, extra = {}) => r.fulfill({ status, headers: Object.assign({}, cors, extra), contentType: 'application/json', body: JSON.stringify(o) });
      if (intest.authorization !== 'Bearer ' + GETTONE) return json({ error: { code: 401, message: 'Invalid Credentials', errors: [{ reason: 'authError' }] } }, 401);
      if (u.pathname === '/youtube/v3/channels')
        return json({ items: [{ id: 'UCprova', snippet: { title: 'Il canale di Ben', thumbnails: { default: { url: 'https://yt3.ggpht.com/ben.png' } } } }] });
      if (u.pathname === '/upload/youtube/v3/videos' && req.method() === 'POST') {
        voce.corpo = JSON.parse(req.postData() || '{}');
        if (modo.carica === 'quota') return json({ error: { code: 403, message: 'The request cannot be completed because you have exceeded your quota.', errors: [{ reason: 'quotaExceeded' }] } }, 403);
        modo.primoPut = true;
        return json({}, 200, { location: 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=sessione1' });
      }
      if (u.pathname === '/upload/youtube/v3/videos' && req.method() === 'PUT') {
        const corpo = req.postDataBuffer();
        voce.byte = corpo ? corpo.length : 0;
        voce.range = intest['content-range'] || '';
        // la domanda «fin dove sei arrivato?»
        if (/^bytes \*\//.test(voce.range)) return r.fulfill({ status: 308, headers: Object.assign({}, cors, { range: 'bytes=0-999' }), body: '' });
        if (modo.carica === 'appeso') { await new Promise(ok => { modo.appeso = ok; }); return r.abort().catch(() => {}); }
        if (modo.carica === 'ripresa' && modo.primoPut) { modo.primoPut = false; return r.abort('connectionreset'); }
        return json({ id: 'abcDEF12345', snippet: { title: 'Pallido puntino blu' }, status: { privacyStatus: 'unlisted' } });
      }
      return json({}, 404);
    });
    await pagina.addInitScript(() => {
      localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
      localStorage.setItem('astrocal_demo_intro_v1', JSON.stringify({ attiva: false }));
      localStorage.setItem('astrocal_lingua', 'it');
    });
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => window.StudioStorie && window.AstroDemo && window.mostraVista && typeof window.ytApriPubblica === 'function');
    const pannello = pagina.locator('#imp-youtube-corpo');
    const apriImpostazioni = async () => {
      await pagina.evaluate(() => mostraVista('stasera'));
      await pagina.click('#btn-impostazioni');
      await pagina.click('#imp-tab-btn-dati');
      await pannello.scrollIntoViewIfNeeded();
    };
    const chiudiImpostazioni = () => pagina.click('#btn-chiudi-impostazioni');
    const salvate = () => pagina.evaluate(() => JSON.parse(localStorage.getItem('astrocal_youtube_v1') || '{}'));
    // v465: un filmato vero (un secondo di tela che cambia colore, registrato
    // nella pagina come fa il registratore dell'app), perché la finestra lo
    // controlla prima di aprirsi; `guasto` = 2400 byte che non sono un
    // filmato, `vuoto` = meno di un kilobyte. Restituisce la misura in byte.
    const filmato = (titolo, guasto) => pagina.evaluate(async ({ titolo, guasto }) => {
      mostraVista('cielo');
      if (!window.__filmatoVero) window.__filmatoVero = await new Promise(ok => {
        const c = document.createElement('canvas'); c.width = 320; c.height = 180;
        const x = c.getContext('2d');
        let n = 0;
        const disegna = () => { x.fillStyle = `hsl(${(n * 12) % 360}, 70%, 40%)`; x.fillRect(0, 0, 320, 180); x.fillStyle = '#fff'; x.fillRect((n * 6) % 300, 80, 20, 20); n++; };
        disegna();
        const reg = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm' });
        const pezzi = [];
        reg.ondataavailable = e => { if (e.data.size) pezzi.push(e.data); };
        reg.onstop = () => ok(new Blob(pezzi, { type: 'video/webm' }));
        reg.start(100);
        const giro = setInterval(disegna, 33);
        setTimeout(() => { clearInterval(giro); reg.stop(); }, 1200);
      });
      const blob = guasto === 'vuoto' ? new Blob([new Uint8Array(500)], { type: 'video/webm' })
        : guasto ? new Blob([new Uint8Array(2400).fill(7)], { type: 'video/webm' }) : window.__filmatoVero;
      skyRegMostraEsito(blob, 'webm', 'video/webm', titolo);
      return blob.size;
    }, { titolo, guasto: guasto || '' });

    prova('le Impostazioni: senza ID client il tasto è spento, uno sbagliato si dice, uno giusto si salva', async () => {
      await apriImpostazioni();
      assert.equal(await pannello.locator('[data-yt="collega"]').isDisabled(), true);
      const campo = pannello.locator('input.yt-campo').first();
      await campo.fill('non-un-id');
      await campo.dispatchEvent('change');
      await pagina.waitForFunction(() => /ID client/.test(document.querySelector('#imp-youtube-corpo .yt-messaggio').textContent));
      await pannello.locator('input.yt-campo').first().fill(CLIENT);
      await pannello.locator('input.yt-campo').first().dispatchEvent('change');
      await pagina.waitForFunction(() => !document.querySelector('#imp-youtube-corpo [data-yt="collega"]').disabled);
      assert.equal((await salvate()).clientId, CLIENT);
      assert.equal(richieste.length, 0, 'niente rete prima di collegare');
    });

    prova('«Collega»: la finestra di Google col consenso, i due permessi, il nome del canale', async () => {
      await pannello.locator('[data-yt="collega"]').click();
      await pagina.waitForFunction(() => /Il canale di Ben/.test(document.getElementById('imp-youtube-corpo').textContent));
      const chiesto = await pagina.evaluate(() => ({ client: window.__ytClient, consensi: window.__ytConsensi }));
      assert.equal(chiesto.client.client_id, CLIENT);
      assert.match(chiesto.client.scope, /youtube\.upload/);
      assert.match(chiesto.client.scope, /youtube\.readonly/);
      assert.equal(chiesto.consensi[0].prompt, 'consent');
      const s = await salvate();
      assert.equal(s.collegato, true);
      assert.equal(s.canale.titolo, 'Il canale di Ben');
      assert.equal(richieste[0].via, '/youtube/v3/channels');
      const tutto = await pagina.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
      assert.ok(!tutto.includes(GETTONE), 'il gettone non va in localStorage');
      assert.equal(await pannello.locator('[data-yt="scollega"]').count(), 1);
      await chiudiImpostazioni();
    });

    prova('il filmato di una storia: titolo proposto, visibilità scelta, la rete cade e si riprende', async () => {
      const peso = await filmato('Pallido puntino blu');
      assert.ok(peso > 1000, 'un filmato vero: ' + peso);
      await pagina.evaluate(() => document.getElementById('skymap-clip-youtube').click());
      await pagina.waitForSelector('#yt-finestra');
      // v465: controllato prima di aprire, con l'anteprima e la misura vera
      assert.equal(await pagina.locator('#yt-finestra video.yt-anteprima').count(), 1, 'l\'anteprima del filmato');
      assert.match(await pagina.locator('#yt-finestra .yt-file').textContent(), /320 × 180 \(180p\) · 0:01/);
      assert.equal(await pagina.evaluate(() => [...document.querySelectorAll('#skymap-clip-anteprima video')].every(v => v.paused)), true,
        'l\'anteprima del pannello sotto si ferma');
      assert.equal(await pagina.inputValue('#yt-f-titolo'), 'Pallido puntino blu');
      assert.match(await pagina.inputValue('#yt-f-descr'), /Pallido puntino blu[\s\S]*AstroCalendario/);
      assert.match(await pagina.locator('#yt-finestra .yt-canale').textContent(), /Il canale di Ben/);
      assert.equal(await pagina.evaluate(() => document.activeElement.id), 'yt-f-titolo', 'il cursore nel titolo');
      await pagina.fill('#yt-f-titolo', 'Pallido <puntino> blu');
      await pagina.locator('[data-yt="privacy"][data-valore="unlisted"]').click();
      assert.equal(await pagina.locator('[data-yt="privacy"][data-valore="unlisted"]').getAttribute('aria-pressed'), 'true');
      await pagina.locator('[data-yt="pubblica"]').click();
      await pagina.waitForSelector('#yt-finestra [data-yt="apri"]', { timeout: 20000 });
      const apri = await pagina.getAttribute('#yt-finestra [data-yt="apri"]', 'href');
      assert.equal(apri, 'https://youtu.be/abcDEF12345');
      const post = richieste.find(x => x.metodo === 'POST');
      assert.equal(post.q.uploadType, 'resumable');
      assert.equal(post.intest['x-upload-content-length'], String(peso));
      assert.equal(post.intest['x-upload-content-type'], 'video/webm');
      assert.equal(post.corpo.snippet.title, 'Pallido puntino blu', 'le parentesi angolari che YouTube rifiuta se ne vanno');
      assert.equal(post.corpo.status.privacyStatus, 'unlisted');
      assert.equal(post.corpo.status.selfDeclaredMadeForKids, false);
      assert.ok(post.corpo.snippet.tags.includes('astronomia'));
      const put = richieste.filter(x => x.metodo === 'PUT');
      assert.equal(put.length, 3, 'il pezzo intero, la domanda, il resto');
      assert.equal(put[0].byte, peso);
      assert.equal(put[1].range, `bytes */${peso}`);
      assert.equal(put[2].range, `bytes 1000-${peso - 1}/${peso}`);
      assert.equal(put[2].byte, peso - 1000);
      const s = await salvate();
      assert.equal(s.pubblicati[0].id, 'abcDEF12345');
      assert.equal(s.privacy, 'unlisted', 'la visibilità scelta diventa quella di serie');
      assert.match(await pannello.textContent(), /Pubblicati da qui/);
      await pagina.locator('#yt-finestra [data-yt="chiudi"]').click();
      assert.equal(await pagina.locator('#yt-finestra').count(), 0);
    });

    prova('la quota finita si dice com\'è, e la finestra resta pronta a riprovare', async () => {
      modo.carica = 'quota';
      await filmato('');
      await pagina.evaluate(() => document.getElementById('skymap-clip-youtube').click());
      await pagina.waitForSelector('#yt-finestra');
      assert.equal(await pagina.inputValue('#yt-f-titolo'), 'Il cielo con AstroCalendario', 'senza storia, il titolo di serie');
      assert.equal(await pagina.locator('[data-yt="privacy"][data-valore="unlisted"]').getAttribute('aria-pressed'), 'true', 'la visibilità di serie');
      await pagina.locator('[data-yt="pubblica"]').click();
      await pagina.waitForFunction(() => /quota/.test(document.querySelector('#yt-finestra .yt-messaggio.errore')?.textContent || ''));
      assert.equal(await pagina.locator('[data-yt="pubblica"]').isDisabled(), false);
    });

    prova('«Annulla» ferma il caricamento a metà', async () => {
      modo.carica = 'appeso';
      await pagina.locator('[data-yt="pubblica"]').click();
      await pagina.waitForSelector('#yt-finestra .yt-barra');
      assert.equal(await pagina.locator('#yt-finestra [data-yt="x"]').isDisabled(), true, 'durante l\'invio la × non chiude');
      await pagina.keyboard.press('Escape');
      assert.equal(await pagina.locator('#yt-finestra').count(), 1, 'Esc non la chiude durante l\'invio');
      await pagina.locator('[data-yt="annulla"]').click();
      await pagina.waitForFunction(() => /annullato/.test(document.querySelector('#yt-finestra .yt-messaggio')?.textContent || ''));
      if (modo.appeso) modo.appeso();
      await pagina.keyboard.press('Escape');
      assert.equal(await pagina.locator('#yt-finestra').count(), 0, 'finito l\'invio, Esc la chiude');
      modo.carica = 'ripresa';
    });

    prova('lo Studio: la linguetta YouTube e «Registra e pubblica» che gira la storia registrandola', async () => {
      await pagina.evaluate(() => { mostraVista('demo'); demoMostraScheda('demo-scheda-storie'); });
      await pagina.locator('[data-fai="impostazioni"]').first().click();
      await pagina.locator('[data-fai="impScheda"][data-valore="yt"]').click();
      assert.match(await pagina.locator('[data-fai="impScheda"][data-valore="yt"]').textContent(), /collegato/);
      assert.match(await pagina.locator('#studio-impostazioni .studio-yt').textContent(), /Il canale di Ben/);
      assert.equal(await pagina.locator('#studio-impostazioni [data-fai="registraYoutube"]').count(), 1);
      // AstroDemo.avvia finto: si guarda solo con che cosa la si chiama
      await pagina.evaluate(() => {
        window.__avvii = [];
        const vera = AstroDemo.avvia;
        window.__avviaVera = vera;
        AstroDemo.avvia = (testo, una) => { window.__avvii.push({ testo: testo.slice(0, 40), una }); };
        window.__inCorsoVero = Object.getOwnPropertyDescriptor(AstroDemo, 'inCorso');
        Object.defineProperty(AstroDemo, 'inCorso', { configurable: true, get: () => true });
      });
      const titolo = await pagina.evaluate(() => StudioStorie.progetto.titolo || '');
      await pagina.locator('#vista-demo .studio-blocco:last-child [data-fai="registraYoutube"]').click();
      const avvii = await pagina.evaluate(() => window.__avvii);
      assert.equal(avvii.length, 1);
      assert.deepEqual(avvii[0].una, { registra: true, perYoutube: true, schermoIntero: true });
      assert.match(avvii[0].testo, /^define_demo/);
      // il filmato arriva: la finestra si apre da sola, col titolo della storia
      await filmato('altro');
      await pagina.waitForSelector('#yt-finestra');
      if (titolo) assert.equal(await pagina.inputValue('#yt-f-titolo'), titolo.slice(0, 100));
      await pagina.locator('#yt-finestra [data-yt="chiudi"]').click();
      // un filmato fatto dopo, a mano, non la riapre
      await filmato('a mano');
      assert.equal(await pagina.locator('#yt-finestra').count(), 0);
    });

    prova('le schede delle CosmoStorie: «YouTube» gira la storia registrandola', async () => {
      await pagina.evaluate(() => { mostraVista('demo'); demoMostraScheda('demo-scheda-storie'); });
      const tasto = pagina.locator('[data-storia-youtube]').first();
      assert.ok(await pagina.locator('[data-storia-youtube]').count() >= 1);
      await pagina.evaluate(() => { window.__avvii = []; });
      await tasto.evaluate(b => b.click());
      const avvii = await pagina.evaluate(() => window.__avvii);
      assert.equal(avvii.length, 1);
      assert.deepEqual(avvii[0].una, { registra: true, perYoutube: true, schermoIntero: true });
      // un filmato senza titolo (fatto a mano) non è quello della storia
      await filmato('');
      assert.equal(await pagina.locator('#yt-finestra').count(), 0);
      await tasto.evaluate(b => b.click());
      await filmato('Titolo dalla demo');
      await pagina.waitForSelector('#yt-finestra');
      assert.notEqual(await pagina.inputValue('#yt-f-titolo'), '');
      await pagina.locator('#yt-finestra [data-yt="chiudi"]').click();
      await pagina.evaluate(() => { AstroDemo.avvia = window.__avviaVera; Object.defineProperty(AstroDemo, 'inCorso', window.__inCorsoVero); });
    });

    prova('demo.js: le opzioni «per una volta» non restano salvate', async () => {
      const prima = await pagina.evaluate(() => AstroDemo.opzioni.registra);
      assert.equal(prima, false);
      // una demo vera, fermata subito: la registrazione accesa solo per lei
      const durante = await pagina.evaluate(() => {
        try { AstroDemo.avvia(undefined, { registra: true, schermoIntero: false }); } catch (e) { return 'errore: ' + e.message; }
        const r = AstroDemo.opzioni.registra;
        AstroDemo.ferma();
        return r;
      });
      assert.equal(durante, true);
      await pagina.waitForFunction(() => !AstroDemo.inCorso);
      assert.equal(await pagina.evaluate(() => AstroDemo.opzioni.registra), false);
      assert.equal(await pagina.evaluate(() => JSON.parse(localStorage.getItem('astrocal_demo_opzioni_v1') || '{}').registra || false), false);
      await pagina.evaluate(() => { if (sky.reg.attiva) skyRegFerma({ annulla: true }); skyRegChiudiPannello(); });
    });

    prova('un filmato vuoto o rovinato non si pubblica: la finestra lo dice, e lo si può scaricare (v465)', async () => {
      for (const [guasto, frase] of [['vuoto', /vuoto/], ['rovinato', /non si apre/]]) {
        await filmato('Rotto', guasto);
        await pagina.evaluate(() => document.getElementById('skymap-clip-youtube').click());
        await pagina.waitForSelector('#yt-finestra .yt-messaggio.errore');
        assert.match(await pagina.locator('#yt-finestra .yt-messaggio.errore').textContent(), frase);
        assert.equal(await pagina.locator('#yt-finestra [data-yt="pubblica"]').count(), 0, 'niente «Pubblica»');
        assert.equal(await pagina.locator('#yt-finestra #yt-f-titolo').count(), 0, 'niente campi');
        assert.equal(await pagina.locator('#yt-finestra video').count(), 0, 'niente anteprima');
        assert.equal(await pagina.locator('#yt-finestra [data-yt="scarica"]').count(), 1);
        await pagina.locator('#yt-finestra [data-yt="chiudi"]').click();
        assert.equal(await pagina.locator('#yt-finestra').count(), 0);
      }
    });

    prova('il filmato per YouTube: risoluzione piena, e niente data e luogo in basso a sinistra (v465)', async () => {
      const misure = await pagina.evaluate(() => ({
        normale: skyRegMisuraTela(1100, 900, 1, false), yt: skyRegMisuraTela(1100, 900, 1, true),
        ytTelefono: skyRegMisuraTela(412, 915, 2.625, true), yt4k: skyRegMisuraTela(1920, 1080, 2, true),
        ytOltre: skyRegMisuraTela(2560, 1440, 2, true), ripiego: skyRegMisuraTela(1920, 1080, 2, true, 1920),
        flusso: [skyRegBitrate(1920, 1080, true), skyRegBitrate(3840, 2160, true), skyRegBitrate(1080, 884, false)]
      }));
      assert.deepEqual(misure.normale, { larghezza: 1080, altezza: 884 }, 'il filmato da chat resta a 1080');
      assert.deepEqual(misure.yt, { larghezza: 1920, altezza: 1570 }, 'YouTube: almeno 1920 di lato lungo');
      assert.deepEqual(misure.ytTelefono, { larghezza: 1082, altezza: 2402 }, 'al telefono, i pixel veri dello schermo');
      assert.deepEqual(misure.yt4k, { larghezza: 3840, altezza: 2160 }, 'uno schermo 4K, in 4K');
      assert.deepEqual(misure.ytOltre, { larghezza: 3840, altezza: 2160 }, 'mai oltre il 4K');
      assert.deepEqual(misure.ripiego, { larghezza: 1920, altezza: 1080 });
      assert.ok(misure.flusso[0] >= 12000000 && misure.flusso[1] === 45000000 && misure.flusso[2] === 6000000, misure.flusso.join(' '));
      // la firma: sul nero, in basso a sinistra c'è scritto qualcosa solo nel filmato normale
      const firma = await pagina.evaluate(() => {
        const prova = solo => {
          const c = document.createElement('canvas'); c.width = 1920; c.height = 1080;
          const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 1920, 1080);
          skyRegFirma(x, 1920, 1080, { soloMarchio: solo });
          const acceso = (x0, y0, w, h) => { const d = x.getImageData(x0, y0, w, h).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 200) n++; return n; };
          return { sinistra: acceso(0, 900, 900, 180), destra: acceso(1300, 980, 620, 100) };
        };
        return { normale: prova(false), youtube: prova(true) };
      });
      assert.ok(firma.normale.sinistra > 200, 'la firma normale ha data e luogo: ' + firma.normale.sinistra);
      assert.equal(firma.youtube.sinistra, 0, 'per YouTube in basso a sinistra non c\'è niente');
      assert.ok(firma.youtube.destra > 50, 'resta il nome dell\'app: ' + firma.youtube.destra);
      // una demo vera, per YouTube: la tela è quella grande, poi tutto torna com'era
      const durante = await pagina.evaluate(async () => {
        try { AstroDemo.avvia(undefined, { registra: true, perYoutube: true, schermoIntero: false }); } catch (e) { return 'errore: ' + e.message; }
        for (let i = 0; i < 50 && !sky.reg.attiva; i++) await new Promise(ok => setTimeout(ok, 100));
        const r = { attiva: sky.reg.attiva, perYoutube: sky.reg.perYoutube, l: sky.reg.tela && sky.reg.tela.width, h: sky.reg.tela && sky.reg.tela.height };
        AstroDemo.ferma();
        return r;
      });
      assert.equal(durante.attiva, true, JSON.stringify(durante));
      assert.equal(durante.perYoutube, true);
      assert.ok(Math.max(durante.l, durante.h) >= 1920, 'la tela registrata: ' + durante.l + '×' + durante.h);
      await pagina.waitForFunction(() => !AstroDemo.inCorso);
      assert.equal(await pagina.evaluate(() => sky.reg.perYoutube || !!sky.reg.misura), false, 'dopo la demo, i filmati a mano sono quelli di sempre');
      await pagina.waitForTimeout(300);
      await pagina.evaluate(() => { if (sky.reg.attiva) skyRegFerma({ annulla: true }); skyRegChiudiPannello(); });
    });

    prova('al telefono e in inglese: la finestra sta nello schermo e parla la lingua scelta', async () => {
      await pagina.setViewportSize({ width: 360, height: 740 });
      await filmato('Phone');
      await pagina.evaluate(() => document.getElementById('skymap-clip-youtube').click());
      await pagina.waitForSelector('#yt-finestra');
      assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'nessuno scorrimento di lato');
      const larga = await pagina.evaluate(() => document.querySelector('#yt-finestra .yt-finestra').getBoundingClientRect().width);
      assert.ok(larga <= 360 - 16, 'col margine: ' + larga);
      await pagina.evaluate(() => astroI18n.impostaLingua('en'));
      await pagina.waitForFunction(() => /Publish on YouTube/.test(document.getElementById('yt-finestra').textContent));
      assert.equal(await pagina.inputValue('#yt-f-titolo'), 'Phone', 'il titolo scritto resta');
      assert.match(await pannello.textContent(), /Connected to the channel/);
      await pagina.evaluate(() => astroI18n.impostaLingua('it'));
      await pagina.locator('#yt-finestra [data-yt="chiudi"]').click();
      await pagina.setViewportSize({ width: 1100, height: 900 });
    });

    prova('«Scollega»: il gettone revocato, l\'account dimenticato, la pubblicazione chiede di ricollegare', async () => {
      await apriImpostazioni();
      await pannello.locator('[data-yt="scollega"]').click();
      assert.deepEqual(await pagina.evaluate(() => window.__ytRevocati), [GETTONE]);
      const s = await salvate();
      assert.equal(s.collegato, false);
      assert.equal(s.canale, null);
      assert.equal(s.clientId, CLIENT, 'l\'ID client resta');
      await chiudiImpostazioni();
      await filmato('x');
      await pagina.evaluate(() => document.getElementById('skymap-clip-youtube').click());
      await pagina.waitForSelector('#yt-finestra .yt-collega-qui [data-yt="collega"]');
      assert.equal(await pagina.locator('[data-yt="pubblica"]').isDisabled(), true);
      // e un consenso negato si dice
      await pagina.evaluate(() => { window.__ytNega = true; });
      await pagina.locator('#yt-finestra .yt-collega-qui [data-yt="collega"]').click();
      await pagina.waitForFunction(() => /chiusa prima della fine/.test(document.getElementById('yt-finestra').textContent));
      await pagina.locator('#yt-finestra [data-yt="chiudi"]').click();
    });

    let ok = 0, ko = 0;
    for (const [nome, fn] of prove) {
      try { await fn(); ok++; console.log('  ok        ' + nome); }
      catch (e) { ko++; console.log('  FALLITA   ' + nome + '\n            ' + String(e && e.stack || e).split('\n').slice(0, 4).join('\n            ')); }
    }
    if (errori.length) { ko++; console.log('  FALLITA   errori nella pagina:\n            ' + errori.join('\n            ')); }
    console.log(`\n${ok} passate, ${ko} fallite (YouTube)`);
    process.exitCode = ko ? 1 : 0;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
