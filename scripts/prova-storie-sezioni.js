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
      // v447: i passi 1 e 2 in linguette; le figurine del cast in quella della loro famiglia
      const passo2 = pagina.locator('#vista-demo .studio-blocco').nth(2);
      assert.equal(await passo2.locator('.studio-personaggio').count(), 0);
      const nelCast = await passo2.locator('.studio-cast-chip').count();
      assert.ok(nelCast >= 1);
      await passo2.locator('[data-fai="schedaPasso"][data-valore="pianeti"]').click();
      const fuori = passo2.locator('.studio-personaggio[aria-pressed="false"]').first();
      await fuori.click();
      assert.equal(await passo2.locator('.studio-cast-chip').count(), nelCast + 1);
      assert.equal(await passo2.locator('[data-fai="schedaPasso"][data-valore="pianeti"]').getAttribute('aria-expanded'), 'true');
      await passo2.locator('.studio-cast-chip [data-fai="cast"]').last().click();
      assert.equal(await passo2.locator('.studio-cast-chip').count(), nelCast);
      await passo2.locator('[data-fai="schedaPasso"][data-valore="pianeti"]').click();
      assert.equal(await passo2.locator('.studio-personaggio').count(), 0);
      const passo1 = pagina.locator('#vista-demo .studio-blocco').nth(1);
      await passo1.locator('[data-fai="schedaPasso"][data-valore="titolo"]').click();
      assert.equal(await passo1.locator('input[data-campo="titolo"]').count(), 1);
      await passo1.locator('[data-fai="schedaPasso"][data-valore="titolo"]').click();
      const scene = pagina.locator('.studio-scena');
      assert.ok(await scene.count() > 1);
      assert.equal(await pagina.locator('.studio-scena[open]').count(), 0);
      const prima = scene.first();
      const seconda = scene.nth(1);
      await prima.locator(':scope > summary').click();
      assert.equal(await prima.locator('[data-fai="provaScena"]').isVisible(), true);
      assert.equal(await seconda.locator('[data-fai="provaScena"]').isVisible(), false);
      // v446: l'ambiente sta nella linguetta «Dove», chiusa di serie
      assert.equal(await prima.locator('[data-fai="ambiente"]').count(), 0);
      await prima.locator('[data-fai="schedaScena"][data-valore="dove"]').click();
      // Una modifica ricostruisce la scheda senza richiuderla, linguetta compresa.
      await prima.locator('[data-fai="ambiente"][data-valore="cielo"]').click();
      assert.equal(await pagina.locator('.studio-scena[open]').count(), 1);
      assert.equal(await prima.locator('[data-fai="schedaScena"][data-valore="dove"]').getAttribute('aria-expanded'), 'true');
      await prima.locator('[data-fai="schedaScena"][data-valore="dove"]').click();
      assert.equal(await prima.locator('[data-fai="ambiente"]').count(), 0);
      // I momenti sono righe chiuse; uno si apre, e la linguetta della faccia mostra i volti
      const riga = prima.locator('[data-fai="apriMomento"]').first();
      assert.equal(await prima.locator('.studio-momento textarea').count(), 0);
      await riga.click();
      assert.equal(await prima.locator('.studio-momento.aperto').count(), 1);
      assert.equal(await prima.locator('.studio-faccia').count(), 0);
      const faccia = prima.locator('.studio-momento.aperto [data-fai="schedaMomento"][data-valore="faccia"]');
      if (await faccia.count()) { await faccia.click(); assert.ok(await prima.locator('.studio-faccia').count() > 3); await faccia.click(); }
      await prima.locator('.studio-momento.aperto [data-fai="schedaMomento"][data-valore="azioni"]').click();
      assert.ok(await prima.locator('.studio-famiglia [data-fai="aggiungiTipo"]').count() >= 8);
      await prima.locator('.studio-momento.aperto [data-fai="schedaMomento"][data-valore="azioni"]').click();
      // un altro momento chiude il primo
      if (await prima.locator('[data-fai="apriMomento"]').count() > 1) {
        await prima.locator('[data-fai="apriMomento"]').nth(1).click();
        assert.equal(await prima.locator('.studio-momento.aperto').count(), 1);
      }
      await prima.locator('.studio-momento.aperto [data-fai="apriMomento"]').click();
      assert.equal(await prima.locator('.studio-momento.aperto').count(), 0);
      // niente si allarga oltre lo schermo
      assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'nessuno scorrimento di lato');
      await seconda.locator(':scope > summary').focus();
      await pagina.keyboard.press('Enter');
      assert.equal(await pagina.locator('.studio-scena[open]').count(), 2);
      await seconda.locator(':scope > summary').click();
      await prima.locator(':scope > summary').click();
      await pagina.evaluate(() => StudioStorie.ridisegna());
      assert.equal(await pagina.locator('.studio-scena[open]').count(), 0);
      // v464: una scena fra la prima e la seconda, e un momento fra due battute
      const idScene = () => pagina.evaluate(() => StudioStorie.progetto.scene.map(sc => sc.id));
      const primaDi = await idScene();
      assert.equal(await pagina.locator('[data-fai="inserisciScena"]').count(), primaDi.length);
      await pagina.locator('[data-fai="inserisciScena"][data-valore="1"]').click();
      const dopo = await idScene();
      assert.equal(dopo.length, primaDi.length + 1);
      assert.equal(dopo[0], primaDi[0]);
      assert.equal(dopo[2], primaDi[1], 'la seconda scena di prima è scivolata al terzo posto');
      const inMezzo = pagina.locator('.studio-scena').nth(1);
      assert.equal(await inMezzo.getAttribute('open'), '', 'la scena inserita si apre');
      assert.equal(await inMezzo.locator('.studio-momento.aperto').count(), 1, 'col suo primo momento aperto');
      const nuovaSc = await pagina.evaluate(() => { const p = StudioStorie.progetto; return { amb: p.scene[1].ambiente, vicina: p.scene[0].ambiente, n: p.scene[1].momenti.length }; });
      assert.equal(nuovaSc.amb, nuovaSc.vicina, 'prende l\'ambiente della scena di sopra');
      assert.equal(nuovaSc.n, 1);
      // un secondo momento in fondo, poi uno in mezzo ai due
      await inMezzo.locator('[data-fai="nuovoMomento"]').click();
      const momenti = () => pagina.evaluate(() => StudioStorie.progetto.scene[1].momenti.map(m => ({ id: m.id, chi: m.chi })));
      const due = await momenti();
      assert.equal(due.length, 2);
      assert.equal(await inMezzo.locator('[data-fai="inserisciMomento"]').count(), 1);
      await inMezzo.locator('[data-fai="inserisciMomento"]').click();
      const tre = await momenti();
      assert.equal(tre.length, 3);
      assert.deepEqual([tre[0].id, tre[2].id], [due[0].id, due[1].id], 'il momento nuovo sta in mezzo');
      assert.equal(await inMezzo.locator('.studio-momento.aperto').getAttribute('data-momento'), tre[1].id, 'ed è quello aperto');
      if (tre[1].chi) assert.equal(await pagina.evaluate(() => document.activeElement && document.activeElement.tagName), 'TEXTAREA', 'col cursore nella battuta');
      if (await pagina.evaluate(() => StudioStorie.presenti(StudioStorie.progetto, StudioStorie.progetto.scene[1]).length) > 1)
        assert.notEqual(tre[1].chi, tre[0].chi, 'non parla di nuovo chi ha appena parlato');
      assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'nessuno scorrimento di lato col «+»');
      // si rimette com'era
      await pagina.evaluate(() => { const p = StudioStorie.progetto; p.scene.splice(1, 1); StudioStorie.ridisegna(); });
    }
    console.log('Scene compresse: apertura, chiusura, tastiera, stato dopo modifica e scene e momenti inseriti in mezzo verificati su desktop e telefono.');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
