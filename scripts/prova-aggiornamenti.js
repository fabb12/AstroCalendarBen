// Ciclo reale dei service worker: prima installazione, attesa, rinvio,
// conferma, riavvio e aggiornamento attivato da un'altra scheda.
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const radice = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(radice, 'app.js'), 'utf8');
const gestione = app.slice(app.indexOf('function registraSW() {'), app.indexOf('// =====================================================================', app.indexOf('function registraSW() {')));
const dizionario = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(radice, 'lingue/it.js'), 'utf8'), dizionario);
const testi = dizionario.window.ASTRO_DIZIONARI.it.messaggi;
let versione = 1, erroreRete = false;
const pagina = () => `<!doctype html><html><head><meta charset="utf-8"></head><body>
<h1>Prova aggiornamenti</h1><textarea id="battuta"></textarea>
<script>
const messaggi = ${JSON.stringify(testi)};
const astroI18n = { t:k=>messaggi[k], applica:el=>el.querySelectorAll('[data-i18n]').forEach(n=>n.textContent=messaggi[n.dataset.i18n]) };
const StudioStorie = { preparaAggiornamento() {
  if (window.microfono) return { ok:false, motivo:'microfono' };
  localStorage.setItem('battuta', document.getElementById('battuta').value);
  return { ok:true };
}};
document.getElementById('battuta').value = localStorage.getItem('battuta') || '';
localStorage.setItem('caricamenti', String(Number(localStorage.getItem('caricamenti') || 0) + 1));
${gestione}
registraSW();
</script></body></html>`;
const server = http.createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.url === '/sw.js') {
    if (erroreRete) { res.writeHead(503); res.end(); return; }
    // Mantiene il ciclo install/activate/message/fetch del worker vero;
    // riduce solo il catalogo di download ai file della pagina di prova.
    const sw = fs.readFileSync(path.join(radice, 'sw.js'), 'utf8')
      .replace(/const CACHE_NAME = '[^']+';/, `const CACHE_NAME = 'astrocal-prova-${versione}';`)
      .replace(/const ASSETS = \[[\s\S]*?\];/, "const ASSETS = ['./', './index.html'];")
      .replace(/const LIBRERIE = \[[\s\S]*?\];/, 'const LIBRERIE = [];');
    res.setHeader('Content-Type', 'text/javascript'); res.end(sw); return;
  }
  if (req.url === '/audio/narrazione/manifest.js') {
    res.setHeader('Content-Type', 'text/javascript'); res.end('self.ASTRO_NARRAZIONE_MANIFEST = {voci:{}};'); return;
  }
  res.setHeader('Content-Type', 'text/html'); res.end(pagina());
});
(async () => {
  let browser;
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
    const contesto = await browser.newContext();
    const p = await contesto.newPage();
    await p.goto(origine);
    await p.waitForFunction(() => !!navigator.serviceWorker.controller);
    assert.equal(await p.locator('#aggiornamento-app[open]').count(), 0, 'La prima installazione non chiede aggiornamenti');
    const caricamenti = () => p.evaluate(() => Number(localStorage.getItem('caricamenti')));
    assert.equal(await caricamenti(), 1);
    versione = 2;
    await p.evaluate(() => window.dispatchEvent(new Event('online')));
    const dialogo = p.locator('#aggiornamento-app');
    await dialogo.waitFor({ state: 'visible' });
    assert.match(await dialogo.innerText(), /nuova versione/);
    assert.equal(await p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting.state), 'installed');
    assert.ok((await p.evaluate(() => caches.keys())).includes('astrocal-prova-1'), 'La cache corrente rimane fino alla conferma');
    await dialogo.locator('[data-dopo]').click();
    assert.equal(await caricamenti(), 1, 'Rimandare non ricarica');
    await p.evaluate(() => window.dispatchEvent(new Event('focus')));
    assert.equal(await dialogo.isVisible(), false, 'Nessuna domanda ripetuta sullo stesso aggiornamento');
    await p.reload();
    await dialogo.waitFor({ state: 'visible' });
    await p.evaluate(() => { document.getElementById('battuta').value = 'La battuta da conservare'; });
    await p.evaluate(() => { window.microfono = true; });
    await dialogo.locator('[data-aggiorna]').click();
    assert.match(await dialogo.locator('[data-stato]').innerText(), /dettatura/);
    assert.equal(await caricamenti(), 2, 'Il microfono attivo impedisce un reload prematuro');
    await p.evaluate(() => { window.microfono = false; });
    await Promise.all([p.waitForEvent('load'), dialogo.locator('[data-aggiorna]').click()]);
    await p.waitForFunction(() => !!navigator.serviceWorker.controller);
    assert.equal(await caricamenti(), 3, 'Una conferma causa un solo reload');
    assert.equal(await p.locator('#battuta').inputValue(), 'La battuta da conservare');
    assert.equal(await dialogo.count(), 0);
    assert.deepEqual(await p.evaluate(() => caches.keys()), ['astrocal-prova-2']);
    // L'assenza di rete non è un aggiornamento e non blocca la pagina.
    erroreRete = true;
    await p.evaluate(async () => { try { await (await navigator.serviceWorker.ready).update(); } catch (_) {} });
    assert.equal(await dialogo.count(), 0);
    erroreRete = false;
    const altra = await contesto.newPage();
    await altra.goto(origine);
    versione = 3;
    await p.evaluate(async () => (await navigator.serviceWorker.ready).update());
    await dialogo.waitFor({ state: 'visible' });
    await dialogo.locator('[data-dopo]').click();
    const prima = await caricamenti();
    await altra.reload();
    await altra.locator('#aggiornamento-app').waitFor({ state: 'visible' });
    await Promise.all([altra.waitForEvent('load'), altra.locator('[data-aggiorna]').click()]);
    // L'altra scheda non viene ricaricata senza il consenso di chi ci scrive.
    await dialogo.waitFor({ state: 'visible' });
    assert.equal(await caricamenti(), prima + 2, 'Solo reload esplicito e conferma nell’altra scheda');
    await dialogo.locator('[data-dopo]').click();
    await p.locator('#battuta').fill('Continua il lavoro');
    assert.equal(await p.locator('#battuta').inputValue(), 'Continua il lavoro');
    console.log('Aggiornamenti: worker reale, prima installazione, cache, rinvio, attesa già presente, consenso, salvataggio, microfono, reload singolo, rete assente e due schede verificati.');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
