// Contratto Web Speech simulato, battute e salvataggio esercitati nella vera UI.
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
    await pagina.addInitScript(() => {
      localStorage.setItem('astrocal_lingua', 'it');
      class Riconoscimento {
        constructor() { window.__riconoscimenti = (window.__riconoscimenti || []); window.__riconoscimenti.push(this); }
        start() { this.avviato = true; }
        stop() { this.fermato = true; }
        abort() { this.annullato = true; }
        risultato(testo, finale = true, indice = 0) {
          const r = [{ transcript: testo }]; r.isFinal = finale;
          const risultati = Array.from({ length: indice }, () => ({ isFinal: true })); risultati.push(r);
          this.onresult && this.onresult({ resultIndex: indice, results: risultati });
        }
      }
      window.SpeechRecognition = Riconoscimento;
    });
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => window.StudioStorie);
    await pagina.evaluate(() => { mostraVista('demo'); demoMostraScheda('demo-scheda-storie'); });
    const scena = pagina.locator('.studio-scena').first();
    await scena.locator(':scope > summary').click();
    await scena.locator('[data-fai="apriMomento"]').first().click();
    const campo = scena.locator('.studio-momento.aperto textarea[data-campo]');
    const detta = scena.locator('[data-fai="dettaBattuta"]');
    const stato = scena.locator('[data-dettatura-stato]');
    // Senza modifiche, la memoria bloccata non impedisce un aggiornamento.
    await pagina.evaluate(() => {
      window.__scriviStorage = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v) { if (k === StudioStorie.CHIAVE) throw new Error('Piena'); return __scriviStorage.call(this, k, v); };
    });
    assert.equal(await pagina.evaluate(() => StudioStorie.preparaAggiornamento().ok), true);
    await campo.fill('Da conservare');
    assert.equal(await pagina.evaluate(() => StudioStorie.preparaAggiornamento().motivo), 'salvataggio');
    assert.equal(await pagina.evaluate(() => StudioStorie.preparaAggiornamento().ok), false);
    await pagina.evaluate(() => { Storage.prototype.setItem = __scriviStorage; });
    assert.equal(await pagina.evaluate(() => StudioStorie.preparaAggiornamento().ok), true);
    await campo.fill('Ciao amico');
    await campo.evaluate(el => el.setSelectionRange(5, 10));
    await detta.click();
    assert.equal(await detta.getAttribute('aria-pressed'), 'true');
    assert.equal(await pagina.evaluate(() => StudioStorie.preparaAggiornamento().motivo), 'microfono');
    await pagina.evaluate(() => {
      const r = __riconoscimenti.at(-1); window.__lingua = r.lang;
      r.risultato('Luna', false);
    });
    assert.match(await stato.innerText(), /Luna/);
    assert.equal(await campo.inputValue(), 'Ciao amico', 'Il parziale non sovrascrive la battuta');
    await pagina.evaluate(() => __riconoscimenti.at(-1).risultato('Luna'));
    assert.equal(await campo.inputValue(), 'Ciao Luna');
    await pagina.evaluate(() => __riconoscimenti.at(-1).risultato('Luna'));
    assert.equal(await campo.inputValue(), 'Ciao Luna', 'Un risultato ripetuto non duplica le parole');
    await pagina.evaluate(() => __riconoscimenti.at(-1).risultato('come stai?', true, 1));
    assert.equal(await campo.inputValue(), 'Ciao Luna come stai?');
    await detta.click();
    await pagina.evaluate(() => { const r = __riconoscimenti.at(-1); r.risultato('Benissimo', true, 2); r.onend(); });
    assert.equal(await campo.inputValue(), 'Ciao Luna come stai? Benissimo');
    assert.equal(await detta.getAttribute('aria-pressed'), 'false');
    assert.equal(await pagina.evaluate(() => StudioStorie.preparaAggiornamento().ok), true);
    assert.equal(await pagina.evaluate(() => JSON.parse(localStorage.getItem(StudioStorie.CHIAVE))[0].scene[0].momenti[0].testo), 'Ciao Luna come stai? Benissimo');
    await detta.click();
    await pagina.evaluate(() => __riconoscimenti.at(-1).onerror({ error: 'not-allowed' }));
    assert.match(await stato.innerText(), /permess|microfono/i);
    assert.equal(await campo.inputValue(), 'Ciao Luna come stai? Benissimo');
    await detta.click();
    await pagina.evaluate(() => __riconoscimenti.at(-1).onerror({ error: 'network' }));
    assert.match(await stato.innerText(), /connessione/);
    // Digitare durante la dettatura interrompe la sessione senza sovrascritture.
    await detta.click();
    await campo.fill('Correzione manuale');
    assert.equal(await detta.getAttribute('aria-pressed'), 'false');
    assert.equal(await pagina.evaluate(() => __riconoscimenti.at(-1).annullato), true);
    // Il limite non tronca il testo già presente a destra del cursore.
    await campo.fill('x'.repeat(595) + 'FINE');
    await campo.evaluate(el => el.setSelectionRange(595, 595));
    await detta.click();
    await pagina.evaluate(() => __riconoscimenti.at(-1).risultato('parole troppo lunghe'));
    assert.equal((await campo.inputValue()).length, 600);
    assert.ok((await campo.inputValue()).endsWith('FINE'));
    assert.match(await stato.innerText(), /600/);
    await pagina.setViewportSize({ width: 390, height: 800 });
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Dettatura leggibile sul telefono');
    // Ridisegnare invalida i callback e impedisce di scrivere in un'altra battuta.
    await campo.fill('Testo sicuro');
    await detta.click();
    await pagina.evaluate(() => { window.__ritardo = __riconoscimenti.at(-1).onresult; StudioStorie.ridisegna(); });
    await pagina.evaluate(() => { const r = [{ transcript: 'non inserire' }]; r.isFinal = true; __ritardo({ resultIndex: 0, results: [r] }); });
    assert.equal(await campo.inputValue(), 'Testo sicuro');
    await pagina.evaluate(() => { window.webkitSpeechRecognition = window.SpeechRecognition; delete window.SpeechRecognition; astroI18n.impostaLingua('en'); });
    await detta.click();
    assert.match(await pagina.evaluate(() => __riconoscimenti.at(-1).lang), /^en/);
    await pagina.evaluate(() => mostraVista('agenda'));
    assert.equal(await pagina.evaluate(() => __riconoscimenti.at(-1).annullato), true);
    await pagina.evaluate(() => { mostraVista('demo'); delete window.SpeechRecognition; delete window.webkitSpeechRecognition; StudioStorie.ridisegna(); });
    assert.equal(await detta.isDisabled(), true);
    assert.match(await stato.innerText(), /unavailable/);
    console.log('Dettatura: parziali/finali, cursore, duplicati, Stop, errori, limite, salvataggio, lingua, callback tardivi, cambio pagina e browser non supportato verificati.');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
