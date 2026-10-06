// Tornando dalla prova scena lo Studio conserva la posizione di lettura.
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
    for (const larghezza of [1100, 390]) {
      await pagina.setViewportSize({ width: larghezza, height: 800 });
      await pagina.evaluate(() => {
        AstroDemo.impostaOpzioni({ schermoIntero: false, registra: false, musicaDemo: false });
        narrazione.impostaPreferenze({ attiva: false, testo: false });
        mostraVista('demo'); demoMostraScheda('demo-scheda-storie');
        for (const sc of StudioStorie.progetto.scene) {
          sc.momenti = [sc.momenti[0]];
          sc.momenti[0].durata = 1;
          sc.momenti[0].testo = '';
        }
        StudioStorie.ridisegna();
      });
      const bottone = pagina.locator('[data-fai="provaScena"]').last();
      await bottone.scrollIntoViewIfNeeded();
      const prima = await pagina.evaluate(() => window.scrollY);
      assert.ok(prima > 300, 'La prova parte davvero da una pagina scorsa');
      await bottone.click();
      await pagina.waitForFunction(() => vistaAttuale !== 'demo');
      await pagina.waitForFunction(() => AstroDemo.stato === 'completato', null, { timeout: 30000 });
      await pagina.waitForFunction(y => vistaAttuale === 'demo' && Math.abs(window.scrollY - y) < 2, prima);
      assert.equal(await pagina.locator('#demo-scheda-storie').getAttribute('aria-selected'), 'true');
      await bottone.click();
      await pagina.waitForFunction(() => vistaAttuale !== 'demo');
      await pagina.evaluate(() => AstroDemo.ferma());
      await pagina.waitForFunction(y => vistaAttuale === 'demo' && Math.abs(window.scrollY - y) < 2, prima);
    }
    console.log('Ritorno alla scena: posizione e scheda conservate a fine prova e Stop, su desktop e telefono.');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
