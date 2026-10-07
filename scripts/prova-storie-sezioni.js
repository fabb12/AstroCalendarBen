// Le scene iniziano chiuse e conservano le aperture durante le modifiche.
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
    for (const width of [1100, 390]) {
      await pagina.setViewportSize({ width, height: 800 });
      await pagina.evaluate(() => { mostraVista('demo'); demoMostraScheda('demo-scheda-storie'); });
      const scene = pagina.locator('.studio-scena');
      assert.ok(await scene.count() > 1);
      assert.equal(await pagina.locator('.studio-scena[open]').count(), 0);
      const prima = scene.first();
      const seconda = scene.nth(1);
      await prima.locator(':scope > summary').click();
      assert.equal(await prima.locator('[data-fai="provaScena"]').isVisible(), true);
      assert.equal(await seconda.locator('[data-fai="provaScena"]').isVisible(), false);
      // Una modifica ricostruisce la scheda senza richiuderla.
      await prima.locator('[data-fai="ambiente"][data-valore="cielo"]').click();
      assert.equal(await pagina.locator('.studio-scena[open]').count(), 1);
      await seconda.locator(':scope > summary').focus();
      await pagina.keyboard.press('Enter');
      assert.equal(await pagina.locator('.studio-scena[open]').count(), 2);
      await seconda.locator(':scope > summary').click();
      await prima.locator(':scope > summary').click();
      await pagina.evaluate(() => StudioStorie.ridisegna());
      assert.equal(await pagina.locator('.studio-scena[open]').count(), 0);
    }
    console.log('Scene compresse: apertura, chiusura, tastiera e stato dopo modifica verificati su desktop e telefono.');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
