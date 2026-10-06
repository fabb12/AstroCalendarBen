// Le preferenze del testo valgono anche per storie, prove e scene in pausa.
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
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => window.narrazione && window.StorieCosmiche && window.AstroDemo);
    const visibile = () => pagina.locator('#narrazione-testo').isVisible();
    for (const canale of ['demo', 'prova']) {
      await pagina.evaluate(canale => {
        narrazione.impostaPreferenze({ attiva: false, testo: true });
        narrazione.parla({ canale, testo: 'Una frase abbastanza lunga per controllare i sottotitoli durante la lettura.', testoSeSpenta: true });
      }, canale);
      assert.equal(await visibile(), true);
      await pagina.evaluate(() => narrazione.impostaPreferenze({ testo: false }));
      assert.equal(await visibile(), false);
      await pagina.evaluate(() => narrazione.impostaPreferenze({ testo: true }));
      assert.equal(await visibile(), true);
    }
    await pagina.evaluate(() => {
      narrazione.impostaPreferenze({ attiva: false, testo: false });
      StorieCosmiche.parla('Moon', { testo: 'La Luna racconta una frase lunga anche nella prova di una scena.' });
    });
    assert.equal(await visibile(), false);
    await pagina.evaluate(() => narrazione.impostaPreferenze({ testo: true }));
    assert.equal(await visibile(), true);
    await pagina.evaluate(() => { narrazione.pausa('demo'); narrazione.impostaPreferenze({ testo: false }); });
    assert.equal(await visibile(), false);
    assert.equal(await pagina.locator('#imp-narrazione-testo').isEnabled(), true);
    await pagina.evaluate(() => {
      narrazione.ferma();
      narrazione.parla({ canale: 'prova', testo: 'Prova forzata', forza: true, sottotitolo: 'sempre' });
    });
    assert.equal(await visibile(), false);
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await pagina.evaluate(() => narrazione.preferenze().testo), false);
    console.log('Sottotitoli: 12 verifiche superate (demo, prove, storie, pausa, preferenze persistenti).');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
