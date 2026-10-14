#!/usr/bin/env node
/* Rinominare, modificare ed eliminare le CosmoStorie, e le storie in
 * cantiere nello Studio (v484), nella pagina vera, in un Chromium senza rete.
 *
 *   npm install --no-save playwright-core astronomy-engine satellite.js@5.0.0
 *   node scripts/prova-cosmostorie-gestione.js
 *
 * Chi usa l'app ha chiesto di poter cambiare il nome alle CosmoStorie, di
 * modificarle e di cancellarle, e anche le storie in cantiere. Le domande
 * sono quelle che a occhio si sbagliano: una storia pronta «eliminata» che
 * torna al ricaricamento, una versione modificata che compare accanto
 * all'originale invece che al suo posto, un nome nuovo che si perde, una
 * storia in cantiere eliminata che resta nello Studio. */
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
    const schede = () => pagina.evaluate(() => [...document.querySelectorAll('#storie-elenco .storia-scheda')].map(s => ({
      chiave: s.dataset.storia, titolo: s.querySelector('.storia-titolo').textContent,
      segno: (s.querySelector('.storia-tua') || {}).textContent || '',
      tasti: [...s.querySelectorAll('.demo-azioni button')].map(b => Object.keys(b.dataset)[0])
    })));
    const prima = await schede();
    const tante = prima.length;

    await prova('ogni scheda ha Rinomina ed Elimina, le storie pronte anche Modifica; c\'è la Parte 2 di Interstellar', async () => {
      assert.ok(tante >= 8, 'schede: ' + tante);
      for (const s of prima) {
        assert.ok(s.tasti.includes('storiaRinomina') && s.tasti.includes('storiaElimina'), s.chiave + ': ' + s.tasti.join(','));
        assert.ok(s.tasti.includes('storiaModifica'), s.chiave + ' si modifica');
      }
      const i1 = prima.findIndex(s => s.chiave === 'storia_interstellar'), i2 = prima.findIndex(s => s.chiave === 'storia_interstellar2');
      assert.ok(i1 >= 0 && i2 === i1 + 1, 'la Parte 2 subito dopo la Parte 1');
      assert.match(prima[i1].titolo, /Interstellar 1/);
      assert.match(prima[i2].titolo, /Interstellar 2: il tesseratto/);
    });

    await prova('Rinomina una storia pronta: il nome nuovo resta dopo il ricaricamento, e «Nome originale» lo rimette', async () => {
      await pagina.click('[data-storia-rinomina="storia_luna"]');
      await pagina.fill('.storia-scheda[data-storia="storia_luna"] .storia-rinomina input[name="titolo"]', 'La Luna di Ben');
      await pagina.fill('.storia-scheda[data-storia="storia_luna"] .storia-rinomina textarea', 'La mia storia preferita.');
      await pagina.click('.storia-scheda[data-storia="storia_luna"] .storia-rinomina button[type="submit"]');
      let s = (await schede()).find(x => x.chiave === 'storia_luna');
      assert.equal(s.titolo, 'La Luna di Ben');
      assert.equal(s.segno, 'Nome tuo');
      assert.equal(await pagina.textContent('#storia-trama-storia_luna'), 'La mia storia preferita.');
      await apri();
      s = (await schede()).find(x => x.chiave === 'storia_luna');
      assert.equal(s.titolo, 'La Luna di Ben', 'dopo il ricaricamento');
      // i comandi della scheda usano il nome nuovo (il titolo per YouTube)
      await pagina.click('[data-storia-rinomina="storia_luna"]');
      await pagina.click('[data-storia-nome-originale="storia_luna"]');
      s = (await schede()).find(x => x.chiave === 'storia_luna');
      assert.match(s.titolo, /CosmoStorie · /);
      assert.equal(s.segno, '');
    });

    await prova('Elimina una storia pronta: sparisce, anche dopo il ricaricamento; «Rimetti» la riporta al suo posto', async () => {
      rispostaConferma = false;
      await pagina.click('[data-storia-elimina="storia_giganti"]');
      assert.ok((await schede()).some(x => x.chiave === 'storia_giganti'), 'rifiutata la conferma, resta');
      rispostaConferma = true;
      await pagina.click('[data-storia-elimina="storia_giganti"]');
      assert.ok(!(await schede()).some(x => x.chiave === 'storia_giganti'));
      assert.match(conferme[conferme.length - 1], /Togliere «CosmoStorie · /);
      await apri();
      assert.ok(!(await schede()).some(x => x.chiave === 'storia_giganti'), 'resta tolta');
      assert.match(await pagina.textContent('.storie-nascoste summary'), /CosmoStorie nascoste \(1\)/);
      // l'esempio del DSL resta (lo prende dalle storie pronte, nascoste o no)
      assert.match(await pagina.textContent('#storie-codice'), /storia_giganti/);
      await pagina.evaluate(() => { document.querySelector('.storie-nascoste').open = true; });
      await pagina.click('[data-storia-rimetti="storia_giganti"]');
      const dopo = await schede();
      assert.equal(dopo.length, tante);
      assert.equal(dopo.findIndex(x => x.chiave === 'storia_giganti'), prima.findIndex(x => x.chiave === 'storia_giganti'), 'allo stesso posto');
      assert.equal(await pagina.$('.storie-nascoste'), null);
    });

    await prova('Modifica una storia pronta: lo Studio la apre col suo nome, e fra le schede prende il posto dell\'originale', async () => {
      await pagina.click('[data-storia-modifica="storia_interstellar2"]');
      await pagina.waitForFunction(() => StudioStorie.progetto && StudioStorie.progetto.sostituisce === 'storia_interstellar2');
      const p = await pagina.evaluate(() => ({ titolo: StudioStorie.progetto.titolo, ufficiale: StudioStorie.progetto.ufficiale,
        momenti: StudioStorie.progetto.scene.reduce((n, sc) => n + sc.momenti.length, 0) }));
      assert.equal(p.titolo, 'Interstellar 2: il tesseratto');
      assert.equal(p.ufficiale, true);
      assert.equal(p.momenti, 43, 'le 43 scene, una per momento');
      await pagina.waitForFunction(() => /versione/.test((document.querySelector('#studio-radice .demo-opzioni-nota') || {}).textContent || ''));
      const dopo = await schede();
      assert.equal(dopo.length, tante, 'nessuna scheda in più');
      const i = dopo.findIndex(x => x.segno === 'Modificata da te');
      assert.equal(i, prima.findIndex(x => x.chiave === 'storia_interstellar2'), 'al posto dell\'originale');
      assert.ok(!dopo.some(x => x.chiave === 'storia_interstellar2'), 'l\'originale non c\'è');
      assert.ok(dopo[i].tasti.includes('storiaRipristina') && dopo[i].tasti.includes('storiaStudio'));
      // la seconda volta riapre la stessa versione, non ne fa un'altra
      const id = await pagina.evaluate(() => StudioStorie.progetto.id);
      await pagina.evaluate(() => StudioStorie.apri(StudioStorie.progetto));
      await pagina.evaluate(() => StudioStorie.modificaStoria(AstroDemo.libreria.elenco().find(d => d.chiave === 'storia_interstellar2')));
      assert.equal(await pagina.evaluate(() => StudioStorie.progetto.id), id);
      // Rinomina sulla scheda della versione: cambia il progetto
      const chiave = dopo[i].chiave;
      await pagina.click(`[data-storia-rinomina="${chiave}"]`);
      await pagina.fill(`.storia-scheda[data-storia="${chiave}"] .storia-rinomina input[name="titolo"]`, 'Il tesseratto di Murph');
      await pagina.click(`.storia-scheda[data-storia="${chiave}"] .storia-rinomina button[type="submit"]`);
      assert.equal(await pagina.evaluate(i => StudioStorie.ufficiali().find(u => u.progetto === i).titolo, id), 'Il tesseratto di Murph');
      assert.ok((await schede()).some(x => x.titolo === 'Il tesseratto di Murph'));
      // «Torna all'originale»: la versione se ne va, l'originale torna al suo posto
      await pagina.click(`[data-storia-ripristina="${id}"]`);
      const ancora = await schede();
      assert.equal(ancora.length, tante);
      assert.equal(ancora.findIndex(x => x.chiave === 'storia_interstellar2'), prima.findIndex(x => x.chiave === 'storia_interstellar2'));
      assert.ok(!(await pagina.evaluate(i => StudioStorie.ufficiali().some(u => u.progetto === i), id)));
    });

    await prova('Elimina una versione modificata: se ne va lei, e l\'originale finisce fra le nascoste', async () => {
      await pagina.click('[data-storia-modifica="storia_einstein"]');
      await pagina.waitForFunction(() => StudioStorie.progetto && StudioStorie.progetto.sostituisce === 'storia_einstein');
      const chiave = (await schede()).find(x => x.segno === 'Modificata da te').chiave;
      await pagina.click(`[data-storia-elimina="${chiave}"]`);
      const dopo = await schede();
      assert.equal(dopo.length, tante - 1);
      assert.ok(!dopo.some(x => x.chiave === 'storia_einstein' || x.segno === 'Modificata da te'));
      assert.equal(await pagina.evaluate(() => StudioStorie.ufficiali().length), 0);
      // con due nascoste c'è anche «Rimettile tutte»
      await pagina.click('[data-storia-elimina="storia_luna"]');
      await pagina.evaluate(() => { document.querySelector('.storie-nascoste').open = true; });
      assert.match(await pagina.textContent('.storie-nascoste summary'), /\(2\)/);
      await pagina.click('[data-storia-rimetti="*"]');
      assert.equal((await schede()).length, tante);
      assert.equal(await pagina.$('.storie-nascoste'), null);
    });

    await prova('le storie in cantiere: compaiono sotto alle schede, si rinominano, si aprono e si eliminano', async () => {
      const id = await pagina.evaluate(() => {
        document.querySelector('#studio-radice [data-fai="nuovo"]').click();
        const campo = document.querySelector('#studio-radice input[data-campo="titolo"]');
        return StudioStorie.progetto.id;
      });
      await pagina.evaluate(i => { StudioStorie.rinomina(i, 'Una storia mia', 'Prova'); }, id);
      await pagina.waitForSelector(`.storia-cantiere[data-cantiere="${id}"]`);
      assert.match(await pagina.textContent('.storie-cantiere h4'), /In cantiere nello Studio \(\d+\)/);
      assert.equal(await pagina.textContent(`.storia-cantiere[data-cantiere="${id}"] .storia-titolo`), 'Una storia mia');
      await pagina.click(`[data-cantiere-rinomina="${id}"]`);
      await pagina.fill(`.storia-cantiere[data-cantiere="${id}"] .storia-rinomina input[name="titolo"]`, 'Il viaggio di Zaira');
      await pagina.click(`.storia-cantiere[data-cantiere="${id}"] .storia-rinomina button[type="submit"]`);
      assert.equal(await pagina.textContent(`.storia-cantiere[data-cantiere="${id}"] .storia-titolo`), 'Il viaggio di Zaira');
      assert.equal(await pagina.evaluate(i => StudioStorie.inCantiere().find(c => c.id === i).titolo, id), 'Il viaggio di Zaira');
      // aprila nello Studio da un'altra
      await pagina.evaluate(() => document.querySelector('#studio-radice [data-fai="nuovo"]').click());
      await pagina.click(`.storia-cantiere[data-cantiere="${id}"] [data-storia-studio="${id}"]`);
      assert.equal(await pagina.evaluate(() => StudioStorie.progetto.id), id);
      // ed eliminala: dallo Studio se ne va, anche dopo il ricaricamento
      await pagina.click(`[data-cantiere-elimina="${id}"]`);
      assert.match(conferme[conferme.length - 1], /Eliminare per sempre «Il viaggio di Zaira»/);
      assert.equal(await pagina.$(`.storia-cantiere[data-cantiere="${id}"]`), null);
      assert.ok(!(await pagina.evaluate(i => StudioStorie.inCantiere().some(c => c.id === i), id)));
      assert.notEqual(await pagina.evaluate(() => StudioStorie.progetto.id), id, 'lo Studio apre un\'altra storia');
      await pagina.waitForTimeout(400);
      await apri();
      assert.ok(!(await pagina.evaluate(i => StudioStorie.inCantiere().some(c => c.id === i), id)), 'resta eliminata');
    });

    await prova('una storia dello Studio messa fra le CosmoStorie si rinomina e si elimina dalla sua scheda', async () => {
      const id = await pagina.evaluate(() => {
        document.querySelector('#studio-radice [data-fai="nuovo"]').click();
        const p = StudioStorie.progetto;
        StudioStorie.rinomina(p.id, 'Storia ufficiale', '');
        document.querySelector('#studio-radice [data-fai="pubblica"]').click();
        return p.id;
      });
      await pagina.waitForFunction(i => StudioStorie.ufficiali().some(u => u.progetto === i), id);
      const s = (await schede()).find(x => x.titolo === 'Storia ufficiale');
      assert.ok(s && s.segno === 'Dallo Studio');
      assert.ok(!s.tasti.includes('storiaModifica') && s.tasti.includes('storiaStudio'));
      await pagina.click(`[data-storia-elimina="${s.chiave}"]`);
      assert.match(conferme[conferme.length - 1], /Eliminare per sempre «Storia ufficiale»/);
      assert.ok(!(await schede()).some(x => x.titolo === 'Storia ufficiale'));
      assert.ok(!(await pagina.evaluate(i => StudioStorie.ufficiali().some(u => u.progetto === i), id)));
    });

    await prova('in inglese: i tasti e i nomi delle due parti di Interstellar', async () => {
      await pagina.evaluate(() => astroI18n.impostaLingua('en'));
      await pagina.waitForFunction(() => /Rename/.test(document.querySelector('[data-storia-rinomina]').textContent));
      const s = await schede();
      assert.match(s.find(x => x.chiave === 'storia_interstellar2').titolo, /Interstellar 2: the tesseract/);
      assert.equal(await pagina.textContent('[data-storia-modifica="storia_luna"]'), 'Edit');
      assert.equal(await pagina.textContent('[data-storia-elimina="storia_luna"]'), 'Delete');
      await pagina.evaluate(() => astroI18n.impostaLingua('it'));
    });

    assert.deepEqual(errori, [], 'errori nella pagina: ' + errori.join(' | '));
    console.log(`\n${passate} passate (CosmoStorie: rinominare, modificare, eliminare)`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})();
