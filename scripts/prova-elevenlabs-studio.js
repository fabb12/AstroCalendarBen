#!/usr/bin/env node
/* ElevenLabs nello Studio delle storie (v444), nel browser vero:
 *
 *   node scripts/prova-elevenlabs-studio.js
 *
 * Un ElevenLabs finto (le rotte di Playwright su api.elevenlabs.io) e il giro
 * intero di chi scrive una storia: la chiave in Impostazioni → ElevenLabs (verificata
 * coi crediti), la scelta della voce di un personaggio dalla libreria in
 * italiano e del suo genere, l'anteprima, la prova con la sua battuta, la
 * voce scelta; «Genera» su una battuta con la proposta da ascoltare e «Usa
 * questa»; «Genera le mancanti»; un'azione Suono e la musica della storia
 * generate da una descrizione. Poi la stessa pagina a larghezza di telefono,
 * senza righe che escono di lato. La chiave deve partire solo nell'intestazione
 * `xi-api-key`, e solo verso ElevenLabs. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
let pw;
try { pw = require('playwright-core'); } catch (_) { pw = require('playwright'); }

const radice = path.resolve(__dirname, '..');
const CHIAVE = 'sk_prova_1234567890';
// Un secondo di silenzio in WAV: il browser lo misura e lo suona
function wav(secondi = 1) {
  const n = Math.round(8000 * secondi), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  return b;
}
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

const prove = [];
const prova = (nome, fn) => prove.push([nome, fn]);

(async () => {
  let browser;
  const richieste = [];
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    browser = await pw.chromium.launch({ executablePath: chromiumVero(), args: ['--autoplay-policy=no-user-gesture-required'] });
    const pagina = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 1100, height: 900 } });
    pagina.setDefaultTimeout(Number(process.env.ATTESA) || 30000);
    if (process.env.DEBUG) pagina.on('console', m => console.log('console:', m.text()));
    const errori = [];
    pagina.on('pageerror', e => errori.push(e.message));
    await pagina.route('**/*', async r => {
      const url = r.request().url();
      if (url.startsWith(origine)) return r.continue();
      if (url.includes('astronomy.browser.min.js')) return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(radice, 'node_modules/astronomy-engine/astronomy.browser.min.js')) });
      const u = new URL(url);
      if (u.hostname === 'anteprime.test') { richieste.push({ anteprima: u.pathname }); return r.fulfill({ contentType: 'audio/wav', body: wav(0.5) }); }
      if (u.hostname !== 'api.elevenlabs.io') return r.abort();
      const intest = r.request().headers();
      const corpo = r.request().postData() ? JSON.parse(r.request().postData()) : null;
      richieste.push({ metodo: r.request().method(), via: u.pathname, q: Object.fromEntries(u.searchParams), chiave: intest['xi-api-key'], corpo });
      const cors = { 'access-control-allow-origin': '*' };
      if (intest['xi-api-key'] !== CHIAVE) return r.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: JSON.stringify({ detail: { status: 'invalid_api_key', message: 'Invalid API key' } }) });
      const json = o => r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
      if (u.pathname === '/v1/user/subscription') return json({ character_count: 1200, character_limit: 30000, tier: 'starter' });
      if (u.pathname === '/v1/shared-voices') {
        const g = u.searchParams.get('gender');
        return json({ has_more: u.searchParams.get('page') === '0', voices: [
          { voice_id: 'Lib' + (g || 'x') + 'Voce0001', public_owner_id: 'prop1', name: g === 'female' ? 'Giulia' : 'Marco', gender: g, accent: 'standard', age: 'young', language: 'it',
            description: 'Calda e luminosa', preview_url: 'https://anteprime.test/' + g + '.mp3' },
          { voice_id: 'Lib' + (g || 'x') + 'Voce0002' + u.searchParams.get('page'), public_owner_id: 'prop2', name: 'Seconda ' + u.searchParams.get('page'), gender: g, language: 'it', preview_url: 'https://anteprime.test/b.mp3' }] });
      }
      if (u.pathname === '/v2/voices') return json({ has_more: false, voices: [{ voice_id: 'MiaVoce00001', name: 'La mia voce', labels: { gender: 'female', language: 'it' }, preview_url: 'https://anteprime.test/mia.mp3' }] });
      // la seconda voce della libreria: la chiave non può aggiungerla (v445)
      if (u.pathname.startsWith('/v1/voices/add/prop2/')) return r.fulfill({ status: 403, headers: cors, contentType: 'application/json', body: JSON.stringify({ detail: { message: 'missing_permissions voices_write' } }) });
      if (u.pathname.startsWith('/v1/voices/add/')) return json({ voice_id: 'Aggiunta' + u.pathname.split('/').pop().slice(0, 12) });
      if (u.pathname.startsWith('/v1/text-to-speech/') || u.pathname === '/v1/sound-generation' || u.pathname === '/v1/music')
        return r.fulfill({ status: 200, headers: cors, contentType: 'audio/wav', body: wav(u.pathname === '/v1/music' ? 3 : 1.2) });
      return r.fulfill({ status: 404, headers: cors, body: '{}' });
    });
    await pagina.addInitScript(() => {
      localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
      localStorage.setItem('astrocal_demo_intro_v1', JSON.stringify({ attiva: false }));
      localStorage.setItem('astrocal_lingua', 'it');
      // ogni audio che parte, per sapere che cosa si è ascoltato
      window.__suonati = [];
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__suonati.push(this.src); return play.call(this).catch(() => null); };
    });
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => window.StudioStorie && window.StorieCosmiche && window.AstroDemo && window.mostraVista);
    await pagina.evaluate(() => { mostraVista('demo'); demoMostraScheda('demo-scheda-storie'); });
    // v447: le voci dei personaggi stanno nella loro linguetta del passo 2
    await pagina.locator('[data-fai="schedaPasso"][data-dove="cast"][data-valore="voci"]').click();
    await pagina.waitForSelector('#studio-voci-pg');
    const ultima = () => richieste[richieste.length - 1];
    const esito = () => pagina.locator('#studio-esito').textContent();
    const progetto = () => pagina.evaluate(() => JSON.parse(JSON.stringify(StudioStorie.progetto)));
    const pg = await pagina.evaluate(() => StudioStorie.progetto.cast.find(id => StorieCosmiche.profilo(id).genere === 'f') || StudioStorie.progetto.cast[0]);
    const genere = await pagina.evaluate(id => StorieCosmiche.profilo(id).genere, pg);

    prova('senza chiave: l\'invito a collegare ElevenLabs, e nessuna richiesta', async () => {
      assert.equal(await pagina.locator('#studio-voci-pg [data-fai="elPannello"]').count(), 1);
      assert.equal(await pagina.locator('[data-fai="elGeneraVoce"]').count(), 0);
      assert.equal(richieste.length, 0);
    });

    prova('la chiave: salvata, verificata coi crediti, mai fuori da xi-api-key', async () => {
      await pagina.locator('#studio-voci-pg [data-fai="elPannello"]').click();
      await pagina.fill('#studio-el-chiave', 'sbagliata');
      await pagina.locator('[data-fai="elSalva"]').click();
      await pagina.waitForFunction(() => /non è valida/.test(document.getElementById('studio-eleven').textContent), null, { timeout: 8000 });
      await pagina.fill('#studio-el-chiave', CHIAVE);
      await pagina.locator('[data-fai="elSalva"]').click();
      await pagina.waitForFunction(() => /Crediti rimasti: 28/.test(document.getElementById('studio-eleven').textContent));
      assert.equal(ultima().via, '/v1/user/subscription');
      const salvata = await pagina.evaluate(() => JSON.parse(localStorage.getItem('astrocal_elevenlabs_v1')));
      assert.equal(salvata.chiave, CHIAVE);
      assert.equal(salvata.modello, 'eleven_v3');
      assert.ok(!(await pagina.evaluate(() => localStorage.getItem('astrocal_storie_progetti_v1') || '')).includes(CHIAVE), 'la chiave nel progetto');
    });

    prova('la voce del personaggio: libreria in italiano col suo genere, anteprima, prova, scelta', async () => {
      await pagina.locator(`[data-fai="elScegli"][data-id="${pg}"]`).click();
      await pagina.waitForSelector('.studio-el-voce');
      const cerca = richieste.filter(x => x.via === '/v1/shared-voices').pop();
      assert.equal(cerca.q.language, 'it');
      assert.equal(cerca.q.gender, genere === 'f' ? 'female' : 'male');
      assert.equal(await pagina.locator('.studio-el-voce').count(), 2);
      // altre voci: la pagina dopo si aggiunge
      await pagina.locator('[data-fai="elAltre"]').click();
      await pagina.waitForFunction(() => document.querySelectorAll('.studio-el-voce').length === 3);
      // il filtro del genere rifà la ricerca
      await pagina.locator('[data-el-filtro="genere"]').selectOption(genere === 'f' ? 'm' : 'f');
      await pagina.waitForFunction(() => !document.querySelector('.studio-el-voci[aria-busy="true"]'));
      assert.equal(richieste.filter(x => x.via === '/v1/shared-voices').pop().q.gender, genere === 'f' ? 'male' : 'female');
      await pagina.locator('[data-el-filtro="genere"]').selectOption(genere === 'f' ? 'f' : 'm');
      await pagina.waitForFunction(() => !document.querySelector('.studio-el-voci[aria-busy="true"]') && document.querySelectorAll('.studio-el-voce').length === 2);
      // le mie voci
      await pagina.locator('[data-el-filtro="fonte"]').selectOption('mie');
      await pagina.waitForFunction(() => /La mia voce|Nessuna voce/.test(document.querySelector('.studio-el-scelta').textContent));
      await pagina.locator('[data-el-filtro="fonte"]').selectOption('libreria');
      await pagina.waitForFunction(() => document.querySelectorAll('.studio-el-voce').length === 2);
      // FOTO=cartella: le fotografie della scelta, per guardarla
      if (process.env.FOTO) await pagina.locator('#studio-voci-pg').screenshot({ path: path.join(process.env.FOTO, 'voci-scelta.png') });
      // anteprima: il campione di ElevenLabs
      await pagina.locator('.studio-el-voce [data-fai="elAnteprima"]').first().click();
      await pagina.waitForFunction(() => window.__suonati.some(s => s.startsWith('https://anteprime.test/')));
      // prova: la prima battuta del personaggio, con la regia della faccia
      await pagina.locator('.studio-el-voce [data-fai="elProva"]').first().click();
      await pagina.waitForFunction(() => /Ecco «/.test(document.getElementById('studio-esito').textContent));
      const tts = richieste.filter(x => (x.via || '').startsWith('/v1/text-to-speech/')).pop();
      const p = await progetto();
      const prima = p.scene.flatMap(sc => sc.momenti).find(m => m.chi === pg && m.testo.trim());
      assert.ok(tts.corpo.text.endsWith(prima.testo.replace(/\s+/g, ' ').trim()), tts.corpo.text);
      assert.equal(tts.corpo.model_id, 'eleven_v3');
      assert.ok([0, 0.5, 1].includes(tts.corpo.voice_settings.stability));
      assert.ok(richieste.some(x => (x.via || '').startsWith('/v1/voices/add/prop1/')), 'la voce della libreria entra nell\'account');
      // scelta
      await pagina.locator('.studio-el-voce [data-fai="elScegliVoce"]').first().click();
      await pagina.waitForFunction(() => !document.querySelector('.studio-el-scelta'));
      const dopo = await progetto();
      assert.match(dopo.voci[pg].id, /^Aggiunta/);
      assert.equal(dopo.voci[pg].genere, genere === 'f' ? 'f' : 'm');
      assert.match(await esito(), /ora parla con la voce/);
      // di serie anche per le storie nuove
      assert.ok(await pagina.evaluate(id => !!JSON.parse(localStorage.getItem('astrocal_storie_voci_pg_v1'))[id], pg));
    });

    // v446: il momento si apre toccando la sua riga, e la voce sta nella sua linguetta
    const apriLinguetta = async (base, scheda) => {
      const riga = pagina.locator(`[data-fai="apriMomento"][data-dove="${base}"]`);
      if ((await riga.getAttribute('aria-expanded')) !== 'true') await riga.click();
      const l = pagina.locator(`[data-fai="schedaMomento"][data-dove="${base}"][data-valore="${scheda}"]`);
      if ((await l.getAttribute('aria-expanded')) !== 'true') await l.click();
    };
    const apriSchedaScena = async (scena, scheda) => {
      const l = scena.locator(`[data-fai="schedaScena"][data-valore="${scheda}"]`);
      if ((await l.getAttribute('aria-expanded')) !== 'true') await l.click();
    };

    prova('una battuta: Genera, la proposta si ascolta, Usa questa la mette alla battuta', async () => {
      const p = await progetto();
      let si = -1, mk = -1;
      p.scene.some((sc, i) => sc.momenti.some((m, k) => { if (m.chi === pg && m.testo.trim()) { si = i; mk = k; return true; } return false; }));
      const base = `scene.${si}.momenti.${mk}`;
      const scena = pagina.locator('.studio-scena').nth(si);
      if (!(await scena.evaluate(e => e.open))) await scena.locator(':scope > summary').click();
      await apriLinguetta(base, 'voce');
      const n = richieste.length;
      await pagina.locator(`[data-fai="elGeneraVoce"][data-dove="${base}"]`).click();
      await pagina.waitForSelector(`[data-fai="elUsa"][data-dove="${base}"]`);
      assert.ok(richieste.slice(n).some(x => x.via === '/v1/text-to-speech/' + p.voci[pg].id));
      assert.ok(await pagina.evaluate(() => window.__suonati.some(s => s.startsWith('blob:'))), 'la proposta parte in ascolto');
      await pagina.locator(`[data-fai="elUsa"][data-dove="${base}"]`).click();
      await pagina.waitForFunction(b => { const m = b.split('.').reduce((o, k) => o[k], StudioStorie.progetto); return m.audio && m.audio.durata > 1000; }, base);
      assert.equal(await pagina.locator(`[data-fai="elUsa"][data-dove="${base}"]`).count(), 0, 'la proposta usata se ne va');
      assert.match(await esito(), /Voce caricata/);
      if (process.env.FOTO) await pagina.locator(`[data-fai="elGeneraVoce"][data-dove="${base}"]`).locator('xpath=ancestor::article[1]').screenshot({ path: path.join(process.env.FOTO, 'battuta.png') });
    });

    prova('l\'intonazione: la faccia e il tono vanno a ElevenLabs come tag, e cambiarli chiede di rigenerare (v449)', async () => {
      const p = await progetto();
      let si = -1, mk = -1;
      p.scene.some((sc, i) => sc.momenti.some((m, k) => { if (m.chi === pg && m.testo.trim() && m.audio) { si = i; mk = k; return true; } return false; }));
      const base = `scene.${si}.momenti.${mk}`;
      await apriLinguetta(base, 'voce');
      const invio = pagina.locator('.studio-tono-invio code');
      const faccia = await pagina.evaluate(b => StudioStorie.facciaParlata(StudioStorie.progetto, b.split('.').reduce((o, k) => o[k], StudioStorie.progetto)), base);
      const tagFaccia = await pagina.evaluate(f => StudioStorie.ELEVEN_TAG_UMORE[f] || '', faccia);
      if (tagFaccia) assert.ok((await invio.textContent()).startsWith('[' + tagFaccia + ']'), 'la faccia che ha mentre parla');
      assert.equal(await pagina.locator('.studio-voce-stato', { hasText: 'altra intonazione' }).count(), 0);
      await pagina.locator(`[data-fai="tono"][data-dove="${base}"][data-valore="whispers"]`).click();
      assert.equal(await pagina.locator(`[data-fai="tono"][data-dove="${base}"][data-valore="whispers"]`).getAttribute('aria-pressed'), 'true');
      assert.match(await invio.textContent(), /\[whispers\]/);
      assert.equal(await pagina.locator('.studio-voce-stato', { hasText: 'altra intonazione' }).count(), 1, 'l\'audio di prima è da rifare');
      const n = richieste.length;
      await pagina.locator(`[data-fai="elGeneraVoce"][data-dove="${base}"]`).click();
      await pagina.waitForSelector(`[data-fai="elUsa"][data-dove="${base}"]`);
      const tts = richieste.slice(n).find(x => (x.via || '').startsWith('/v1/text-to-speech/'));
      assert.equal(tts.corpo.text, (await invio.textContent()).trim(), 'parte proprio il testo mostrato');
      assert.match(tts.corpo.text, tagFaccia ? new RegExp('^\\[' + tagFaccia + '\\] \\[whispers\\] ') : /^\[whispers\] /);
      await pagina.locator(`[data-fai="elUsa"][data-dove="${base}"]`).click();
      await pagina.waitForFunction(b => { const m = b.split('.').reduce((o, k) => o[k], StudioStorie.progetto); return m.audio && /whispers/.test(m.audio.tag || ''); }, base);
      assert.equal(await pagina.locator('.studio-voce-stato', { hasText: 'altra intonazione' }).count(), 0);
    });

    prova('le impostazioni: un pannello a parte con Questa storia, Sincronizza ed ElevenLabs (v449)', async () => {
      const tasto = pagina.locator('.studio-barra-tasti [data-fai="impostazioni"]');
      if ((await tasto.getAttribute('aria-expanded')) === 'true') await tasto.click();
      assert.equal(await pagina.locator('#studio-impostazioni').count(), 0);
      await tasto.click();
      assert.equal(await pagina.locator('#studio-impostazioni [data-fai="impScheda"]').count(), 3);
      await pagina.locator('[data-fai="impScheda"][data-valore="storia"]').click();
      for (const f of ['esporta', 'duplica', 'copione', 'fileVoci', 'elimina']) assert.equal(await pagina.locator(`#studio-impostazioni [data-fai="${f}"]`).count(), 1, f);
      assert.equal(await pagina.locator('#studio-impostazioni label[for="studio-importa"]').count(), 1);
      assert.equal(await pagina.locator('#studio-impostazioni .studio-imp-pericolo [data-fai="elimina"]').count(), 1, 'elimina sta a parte');
      await pagina.locator('[data-fai="impScheda"][data-valore="repo"]').click();
      assert.equal(await pagina.locator('#studio-impostazioni [data-fai="sincronizza"]').count(), 1);
      assert.equal(await pagina.locator('#studio-impostazioni #studio-repo-token').count(), 1);
      assert.match(await pagina.locator('#studio-impostazioni .studio-imp-stato').textContent(), /token|Collegato/);
      await pagina.locator('[data-fai="impScheda"][data-valore="el"]').click();
      assert.equal(await pagina.locator('#studio-impostazioni #studio-el-chiave').inputValue(), CHIAVE);
      assert.match(await pagina.locator('[data-fai="impScheda"][data-valore="el"]').textContent(), /collegato/);
      await pagina.locator('#studio-impostazioni .studio-imp-testa [data-fai="impostazioni"]').click();
      assert.equal(await pagina.locator('#studio-impostazioni').count(), 0);
    });

    prova('Genera le mancanti: tutte le battute del personaggio, una dopo l\'altra', async () => {
      const mancano = (await progetto()).scene.flatMap(sc => sc.momenti).filter(m => m.chi === pg && m.testo.trim() && !m.audio).length;
      const n = richieste.length;
      if (mancano) {
        await pagina.locator(`[data-fai="elMancanti"][data-id="${pg}"]`).click();
        await pagina.waitForFunction(() => /Battute generate/.test(document.getElementById('studio-esito').textContent), null, { timeout: 30000 });
      }
      assert.equal(richieste.slice(n).filter(x => (x.via || '').startsWith('/v1/text-to-speech/')).length, mancano);
      assert.equal((await progetto()).scene.flatMap(sc => sc.momenti).filter(m => m.chi === pg && m.testo.trim() && !m.audio).length, 0);
      assert.equal(await pagina.locator(`[data-fai="elMancanti"][data-id="${pg}"]`).count(), 0);
    });

    prova('un\'azione Suono generata da una descrizione entra nel copione', async () => {
      const scena = pagina.locator('.studio-scena').first();
      if (!(await scena.evaluate(e => e.open))) await scena.locator(':scope > summary').click();
      await apriLinguetta('scene.0.momenti.0', 'azioni');
      await scena.locator('[data-fai="aggiungiTipo"][data-tipo="suono"]').first().click();
      const campo = pagina.locator('.studio-azione input[data-campo$=".richiesta"]');
      await campo.fill('un razzo che parte');
      await pagina.locator('.studio-azione [data-fai="elSuono"]').click();
      await pagina.waitForSelector('.studio-azione [data-fai="elUsa"]');
      const sg = richieste.filter(x => x.via === '/v1/sound-generation').pop();
      assert.equal(sg.corpo.text, 'un razzo che parte');
      await pagina.locator('.studio-azione [data-fai="elUsa"]').click();
      await pagina.waitForFunction(() => /Suono caricato/.test(document.getElementById('studio-esito').textContent));
      const copione = await pagina.evaluate(() => StudioStorie.copione(StudioStorie.progetto));
      assert.match(copione, /action: sound \{ src: 'audio\/storie-musica\/[\w-]+\/suono-a\w+\.mp3\?v=[0-9a-f]{10}' \};/);
      // e la demo lo accetta
      const errori = await pagina.evaluate(c => { try { AstroDemo.valida(c); return ''; } catch (e) { return e.message; } }, copione);
      assert.equal(errori, '');
    });

    prova('la musica della storia generata da una descrizione', async () => {
      const testo = pagina.locator('input[data-el-musica="storia"][data-el-campo="testo"]');
      await testo.fill('arpa e archi, dolce');
      await pagina.locator('input[data-el-musica="storia"][data-el-campo="secondi"]').fill('30');
      await pagina.locator('[data-fai="elMusica"][data-dove="storia"]').click();
      await pagina.waitForSelector('[data-fai="elUsa"][data-dove="storia"]');
      const mu = richieste.filter(x => x.via === '/v1/music').pop();
      assert.deepEqual(mu.corpo, { prompt: 'arpa e archi, dolce', music_length_ms: 30000 });
      await pagina.locator('[data-fai="elUsa"][data-dove="storia"]').click();
      await pagina.waitForFunction(() => StudioStorie.progetto.musica && StudioStorie.progetto.musica.tipo === 'file');
    });

    // v445: dove sta una battuta di un personaggio
    const battutaDi = async id => {
      const p = await progetto();
      for (let i = 0; i < p.scene.length; i++) for (let k = 0; k < p.scene[i].momenti.length; k++) {
        const m = p.scene[i].momenti[k];
        if (m.chi === id && m.testo.trim()) return { i, k, base: `scene.${i}.momenti.${k}`, sid: p.scene[i].id };
      }
      return null;
    };
    const apriScena = async i => {
      const scena = pagina.locator('.studio-scena').nth(i);
      if (!(await scena.evaluate(e => e.open))) await scena.locator(':scope > summary').click();
      return scena;
    };

    prova('dalla battuta senza voce: la scelta si apre lì sotto, e può valere solo per la scena', async () => {
      const altro = await pagina.evaluate(pg => StudioStorie.progetto.cast.find(id => id !== pg && StudioStorie.progetto.scene.some(sc => sc.momenti.some(m => m.chi === id && m.testo.trim()))), pg);
      assert.ok(altro, 'serve un secondo personaggio che parla');
      const b = await battutaDi(altro);
      await apriScena(b.i);
      await apriLinguetta(b.base, 'voce');
      const tasto = pagina.locator(`[data-fai="elGeneraVoce"][data-dove="${b.base}"]`);
      assert.match(await tasto.textContent(), /Scegli la voce/);
      await tasto.click();
      // la scelta nasce dentro la riga della voce di quella battuta, non al passo 2
      const qui = pagina.locator(`.studio-voce:has([data-dove="${b.base}"]) .studio-el-scelta`);
      await qui.waitFor();
      assert.equal(await pagina.locator('#studio-voci-pg .studio-el-scelta').count(), 0);
      await qui.locator('.studio-el-voce').first().waitFor();
      await qui.locator('[data-el-ambito]').selectOption(b.sid);
      await qui.locator('.studio-el-voce [data-fai="elScegliVoce"]').first().click();
      await pagina.waitForFunction(() => !document.querySelector('.studio-el-scelta'));
      const p = await progetto();
      assert.ok(p.scene[b.i].voci[altro], 'la voce sta nella scena');
      assert.ok(!p.voci[altro], 'e non in tutta la storia');
      // il messaggio è accanto alla battuta, e il tasto ora genera con quella voce
      assert.match(await pagina.locator(`.studio-voce:has([data-dove="${b.base}"]) .studio-el-nota`).textContent(), /Nella scena \d+/);
      assert.match(await pagina.locator(`[data-fai="elGeneraVoce"][data-dove="${b.base}"]`).textContent(), /Genera con/);
    });

    prova('voce cambiata solo in una scena: le battute di lì la usano, e quelle vecchie sono da rifare', async () => {
      const b = await battutaDi(pg);
      const scena = await apriScena(b.i);
      const prima = (await progetto()).voci[pg].id;
      await apriSchedaScena(scena, 'suoni');
      await scena.locator(`[data-fai="elScegliScena"][data-id="${pg}"]`).click();
      const pannello = scena.locator('.studio-voci-scena .studio-el-scelta');
      await pannello.locator('.studio-el-voce').first().waitFor();
      assert.match(await pannello.textContent(), /solo nella scena/);
      if (process.env.FOTO) await scena.locator('.studio-voci-scena').screenshot({ path: path.join(process.env.FOTO, 'voci-scena.png') });
      // la seconda voce: l'account non può aggiungerla, ma la scelta resta
      await pannello.locator('.studio-el-voce [data-fai="elScegliVoce"]').nth(1).click();
      await pagina.waitForFunction(() => !document.querySelector('.studio-el-scelta'));
      const p = await progetto();
      const sua = p.scene[b.i].voci[pg];
      assert.ok(sua && sua.id !== prima, 'la voce della scena');
      assert.equal(p.voci[pg].id, prima, 'la storia tiene la sua');
      assert.match(await scena.locator('.studio-voci-scena .studio-el-nota').textContent(), /non sono riuscito ad aggiungerla.*voices_write/);
      // la battuta generata con l'altra voce ora è da rifare
      assert.match(await scena.locator('.studio-voci-scena').textContent(), /solo in questa scena/);
      await scena.locator(`[data-fai="elMancantiScena"][data-id="${pg}"]`).click();
      await pagina.waitForFunction(() => /Battute generate/.test(document.getElementById('studio-esito').textContent));
      const tts = richieste.filter(x => (x.via || '').startsWith('/v1/text-to-speech/')).pop();
      assert.equal(tts.via, '/v1/text-to-speech/' + sua.id);
      const m = (await progetto()).scene[b.i].momenti[b.k];
      assert.equal(m.audio.voce, sua.id);
      // e si torna a quella della storia
      await scena.locator(`[data-fai="elTornaStoria"][data-id="${pg}"]`).click();
      assert.ok(!(await progetto()).scene[b.i].voci[pg]);
      assert.match(await scena.locator('.studio-voci-scena').textContent(), /quella della storia/);
    });

    prova('la chiave è andata solo a ElevenLabs, nell\'intestazione', async () => {
      const api = richieste.filter(x => x.via);
      assert.ok(api.length > 5);
      for (const x of api) {
        assert.ok(x.chiave === CHIAVE || x.chiave === 'sbagliata', x.via);
        assert.ok(!JSON.stringify(x.q).includes(CHIAVE) && !JSON.stringify(x.corpo || '').includes(CHIAVE));
      }
    });

    prova('al telefono: niente righe che escono di lato, la scelta della voce compresa', async () => {
      await pagina.setViewportSize({ width: 390, height: 800 });
      await pagina.locator(`[data-fai="elScegli"][data-id="${pg}"]`).click();
      await pagina.waitForSelector('.studio-el-voce');
      const largo = await pagina.evaluate(() => {
        const r = document.getElementById('studio-radice');
        const fuori = [...r.querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.right > window.innerWidth + 1; });
        return { scorre: document.documentElement.scrollWidth > window.innerWidth + 1, fuori: fuori.slice(0, 5).map(e => e.className || e.tagName) };
      });
      assert.equal(largo.scorre, false, JSON.stringify(largo));
      assert.deepEqual(largo.fuori, []);
      if (process.env.FOTO) await pagina.locator('#studio-voci-pg').screenshot({ path: path.join(process.env.FOTO, 'telefono.png') });
    });

    let ok = 0;
    for (const [nome, fn] of prove) {
      try { await fn(); ok++; console.log('  ok  ' + nome); }
      catch (e) { console.log('  NO  ' + nome + '\n      ' + (e && e.stack || e).split('\n').slice(0, 4).join('\n      ')); process.exitCode = 1; }
    }
    if (errori.length) { console.log('  errori della pagina:\n    ' + errori.join('\n    ')); process.exitCode = 1; }
    console.log(`\n${ok} passate, ${prove.length - ok} fallite (ElevenLabs nello Studio)`);
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
