// Ricaricare l’app ripristina la navigazione senza riaprire anteprime temporanee.
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const radice = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(radice, '.' + (req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(fs.readFileSync(file));
});
(async () => {
  let browser;
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
    const pagina = await browser.newPage({ serviceWorkers: 'block' });
    await pagina.route('**/*', r => {
      if (r.request().url().startsWith(origine)) return r.continue();
      if (r.request().url().includes('astronomy.browser.min.js')) return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(radice, 'node_modules/astronomy-engine/astronomy.browser.min.js')) });
      return r.abort();
    });
    await pagina.addInitScript(() => localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' })));
    await pagina.addInitScript(() => localStorage.setItem('astrocal_demo_intro_v1', JSON.stringify({ attiva: false })));
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => window.narrazione && window.StorieCosmiche && window.AstroDemo);
    await pagina.waitForFunction(() => sky.observer);
    const chiave = 'astrocal_ultima_vista_v1';
    // Ogni sezione principale e ogni sottosezione del Calendario.
    for (const nome of ['agenda', 'diario', 'calendario', 'didattica', 'telescopio', 'stasera', 'demo', 'cielo']) {
      await pagina.evaluate(nome => mostraVista(nome), nome);
      await pagina.reload({ waitUntil: 'domcontentloaded' });
      await pagina.waitForFunction(nome => vistaAttuale === nome, nome);
      assert.equal(await pagina.evaluate(() => localStorage.getItem('astrocal_ultima_vista_v1')), nome);
    }
    await pagina.evaluate(() => { mostraVista('demo'); demoMostraScheda('demo-scheda-storie'); });
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => vistaAttuale === 'demo');
    assert.equal(await pagina.locator('#demo-scheda-storie').getAttribute('aria-selected'), 'true');
    await pagina.evaluate(() => {
      AstroDemo.impostaOpzioni({ schermoIntero: false, registra: false, musicaDemo: false });
      AstroDemo.avvia("define_demo prova { scene planetarium_view { duration: 20s; action: point_view { az: 120, alt: 25 }; }}");
    });
    await pagina.waitForFunction(() => vistaAttuale === 'cielo' && AstroDemo.inCorso);
    assert.equal(await pagina.evaluate(() => localStorage.getItem('astrocal_ultima_vista_v1')), 'demo');
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => vistaAttuale === 'demo');
    await pagina.goto(origine + '/?vista=agenda', { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => vistaAttuale === 'agenda');
    await pagina.evaluate(chiave => localStorage.setItem(chiave, 'vista-inesistente'), chiave);
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => vistaAttuale === 'cielo');
    await pagina.evaluate(chiave => localStorage.removeItem(chiave), chiave);
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => vistaAttuale === 'cielo');
    await pagina.addInitScript(() => {
      const leggi = Storage.prototype.getItem, scrivi = Storage.prototype.setItem;
      Storage.prototype.getItem = function(k) { if (k === 'astrocal_ultima_vista_v1') throw new Error('Memoria bloccata'); return leggi.call(this, k); };
      Storage.prototype.setItem = function(k, v) { if (k === 'astrocal_ultima_vista_v1') throw new Error('Memoria bloccata'); return scrivi.call(this, k, v); };
    });
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => vistaAttuale === 'cielo');
    await pagina.evaluate(() => mostraVista('demo'));
    assert.equal(await pagina.evaluate(() => vistaAttuale), 'demo');
    console.log('Ultima pagina: ricaricamento delle 8 viste, scheda CosmoStorie, anteprima temporanea, link condiviso e memoria assente/non valida/bloccata verificati.');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
