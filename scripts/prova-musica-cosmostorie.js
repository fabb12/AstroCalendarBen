#!/usr/bin/env node
/* La musica di sottofondo delle CosmoStorie e le scelte in categorie (v496),
 * nella pagina vera, in un Chromium senza rete.
 *
 *   npm install --no-save playwright-core astronomy-engine satellite.js@5.0.0
 *   node scripts/prova-musica-cosmostorie.js
 *
 * Chi usa l'app metteva una musica (una traccia dell'app o una generata)
 * a una CosmoStoria modificata nello Studio, e dalla scheda la storia
 * partiva senza: la scheda suona il copione salvato come demo, e il cambio
 * di musica non lo riscriveva. Poi: una musica generata deve restare, da
 * scegliere anche dopo (anche dopo aver ricaricato la pagina), e i
 * personaggi e le espressioni si scelgono per categorie. */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('playwright-core')); }
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const radice = path.resolve(__dirname, '..');
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.resolve(radice, '.' + (url === '/' ? '/index.html' : url));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', tipi[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

let passate = 0;
async function prova(nome, fn) {
  try { await fn(); passate++; console.log('  ok       ' + nome); }
  catch (e) { console.log('  FALLITA  ' + nome); throw e; }
}

(async () => {
  let browser;
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    const eseguibile = ['/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
    browser = await chromium.launch(eseguibile ? { executablePath: eseguibile } : {});
    const contesto = await browser.newContext({ viewport: { width: 1200, height: 860 }, serviceWorkers: 'block' });
    const pagina = await contesto.newPage();
    const errori = [];
    pagina.on('pageerror', e => errori.push(e.message));
    // le conferme si accettano tutte (si prova anche quella rifiutata, sotto)
    let rispostaConferma = true;
    const conferme = [];
    pagina.on('dialog', d => { conferme.push(d.message()); return rispostaConferma ? d.accept() : d.dismiss(); });
    await pagina.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(origine)) return route.continue();
      if (url.includes('astronomy.browser.min.js'))
        return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(require.resolve('astronomy-engine').replace(/astronomy\.js$/, 'astronomy.browser.min.js')) });
      if (url.includes('satellite.js') && url.endsWith('.js'))
        return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(require.resolve('satellite.js/dist/satellite.min.js')) });
      return route.abort();
    });
    await pagina.addInitScript(() => {
      if (!sessionStorage.getItem('gia')) {
        sessionStorage.setItem('gia', '1');
        localStorage.clear();
        localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
        localStorage.setItem('astrocal_lingua', 'it');
      }
    });
    const apri = async () => {
      await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
      await pagina.waitForFunction(() => typeof StorieCosmiche !== 'undefined' && typeof StudioStorie !== 'undefined' &&
        typeof AstroDemo !== 'undefined' && document.querySelector('#storie-elenco .storia-scheda'), null, { timeout: 30000 });
      await pagina.evaluate(() => { mostraVista('demo'); if (typeof demoMostraScheda === 'function') demoMostraScheda('demo-scheda-storie'); });
    };
    await apri();

    await prova('una traccia scelta nello Studio arriva alla scheda della CosmoStoria', async () => {
      const r = await pagina.evaluate(async () => {
        const st = AstroDemo.libreria.elenco().find(x => x.storia && !x.progetto && x.chiave === 'storia_interstellar1')
          || AstroDemo.libreria.elenco().find(x => x.storia && !x.progetto);
        StudioStorie.modificaStoria({ chiave: st.chiave, testo: st.testo, titolo: 'Prova', cast: '' });
        await new Promise(r => setTimeout(r, 400));
        const prima = StudioStorie.ufficiali().find(u => u.sostituisce === st.chiave);
        StudioStorie.sceltaMusica('storia', 'cat:Europa1');
        await new Promise(r => setTimeout(r, 900));
        const dopo = StudioStorie.ufficiali().find(u => u.sostituisce === st.chiave);
        const demo = AstroDemo.libreria.elenco().find(d => d.chiave === StudioStorie.progetto.demoChiave);
        return { chiave: st.chiave, prima: prima && prima.testo.includes('Tracing_the_Seven_Sisters'),
          dopo: dopo && dopo.testo.includes("story_music { src: 'musica/Tracing_the_Seven_Sisters.mp3'"),
          demo: demo && demo.testo.includes('Tracing_the_Seven_Sisters') };
      });
      assert.equal(r.prima, false);
      assert.equal(r.dopo, true, 'la scheda suona il copione con la musica');
      assert.equal(r.demo, true, 'la demo salvata ha la musica');
    });

    await prova('una musica generata resta fra le generate e si sceglie anche dopo', async () => {
      const r = await pagina.evaluate(async () => {
        // un WAV di un secondo, muto
        const n = 8000, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
        const scrivi = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        scrivi(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); scrivi(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
        v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
        scrivi(36, 'data'); v.setUint32(40, n * 2, true);
        const file = new File([buf], 'musica-elevenlabs.mp3', { type: 'audio/wav' });
        const id = await StudioStorie.conservaGenerata(file, 'Musica epica spaziale, archi lenti e cori lontani');
        const doppia = await StudioStorie.conservaGenerata(file, 'la stessa');
        StudioStorie.ridisegna();
        const opzioni = [...document.querySelectorAll('[data-musica-scelta="storia"] option')].map(o => [o.value, o.textContent]);
        const sceneOpz = [...document.querySelectorAll('[data-musica-scelta^="scene."] option')].filter(o => o.value === 'gen:' + id).length;
        StudioStorie.sceltaMusica('storia', 'gen:' + id);
        for (let i = 0; i < 40 && !(StudioStorie.progetto.musica && StudioStorie.progetto.musica.tipo === 'file'); i++) await new Promise(r => setTimeout(r, 100));
        await new Promise(r => setTimeout(r, 900));
        const mu = StudioStorie.progetto.musica;
        const u = StudioStorie.ufficiali().find(x => x.progetto === StudioStorie.progetto.id);
        return { id, doppia, generate: StudioStorie.musicheGenerate, opzione: opzioni.find(o => o[0] === 'gen:' + id), sceneOpz,
          mu, testo: u && /story_music \{ src: 'audio\/storie-musica\/[^']+\/storia\.mp3\?v=/.test(u.testo),
          elenco: document.querySelectorAll('.studio-generate li').length };
      });
      assert.ok(r.id);
      assert.equal(r.doppia, null, 'la stessa musica non entra due volte');
      assert.equal(r.generate.length, 1);
      assert.match(r.opzione[1], /Generata: Musica epica spaziale archi lenti e/);
      assert.equal(r.mu.tipo, 'file');
      assert.equal(r.testo, true, 'la CosmoStoria suona la musica generata');
      assert.equal(r.elenco, 1);
      await apri();
      const dopo = await pagina.evaluate(async () => {
        for (let i = 0; i < 50 && !StudioStorie.musicheGenerate.length; i++) await new Promise(r => setTimeout(r, 100));
        return StudioStorie.musicheGenerate.map(g => g.nome);
      });
      assert.deepEqual(dopo, ['Musica epica spaziale archi lenti e']);
    });

    await prova('i personaggi e le espressioni si scelgono per categorie', async () => {
      const r = await pagina.evaluate(() => {
        const ids = Object.keys(StorieCosmiche.STOR_PERSONAGGI);
        const gruppi = {};
        for (const id of ids) (gruppi[StudioStorie.gruppoCast(id)] = gruppi[StudioStorie.gruppoCast(id)] || []).push(id);
        const facce = StudioStorie.facceInFamiglie();
        const tutte = facce.flatMap(([, el]) => el);
        return { gruppi, sconosciuti: Object.keys(gruppi).filter(g => !StudioStorie.STUDIO_GRUPPI_CAST.includes(g)),
          facce: facce.map(([f]) => f), tutte: tutte.length, uniche: new Set(tutte).size,
          espressioni: Object.keys(StorieCosmiche.STOR_ESPRESSIONI).length };
      });
      assert.deepEqual(r.sconosciuti, []);
      assert.ok(r.gruppi.scienziati.includes('galileo') && r.gruppi.antichi.includes('plato') && r.gruppi.astronauti.includes('armstrong'));
      assert.ok(r.gruppi.interstellar.includes('cooper') && r.gruppi.interstellar.includes('tars') && r.gruppi.lune.includes('Moon'));
      assert.ok(r.gruppi.narratori.includes('astro_ben') && !r.gruppi.narratori.includes('galileo'));
      assert.deepEqual(r.facce, ['allegre', 'calme', 'stupore', 'tristi']);
      assert.equal(r.tutte, r.espressioni);
      assert.equal(r.uniche, r.espressioni);
      // nella pagina: la linguetta degli scienziati, e le facce di un momento in famiglie
      await pagina.locator('[data-fai="schedaPasso"][data-valore="scienziati"]').first().click();
      assert.ok(await pagina.locator('.studio-personaggio[data-id="galileo"]').count() > 0);
      const facceDom = await pagina.evaluate(async () => {
        const b = document.querySelector('[data-fai="schedaMomento"][data-valore="faccia"]');
        if (!b) return -1;
        b.click();
        await new Promise(r => setTimeout(r, 100));
        return document.querySelectorAll('.studio-facce-famiglie > .studio-famiglia').length;
      });
      assert.ok(facceDom === -1 || facceDom === 4, 'facce in quattro famiglie: ' + facceDom);
    });

    assert.deepEqual(errori, []);
    console.log(`\n${passate} prove passate`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})();
