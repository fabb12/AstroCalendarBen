#!/usr/bin/env node
/* La narrazione in un browser vero.
 *
 *   npm install --no-save playwright astronomy-engine satellite.js@5.0.0
 *   node scripts/prova-narrazione-browser.js
 *
 * `prova-narrazione.js` guarda la macchina con un mondo finto; qui si guarda
 * che la macchina sia davvero attaccata ai suoi due clienti — le demo e
 * Missione Cielo — e al service worker. La sintesi del dispositivo è
 * sostituita da una finta che annota: un Chromium senza testa non ha voci, e
 * una prova che dipende dalle voci installate sulla macchina di turno è una
 * prova che dice cose diverse su due macchine. Gli audio registrati invece
 * sono veri: tre WAV generati qui — uno buono, uno che non c'è, uno rotto —
 * serviti da un manifest di prova al posto di quello del repository. */
'use strict';
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const radice = path.resolve(__dirname, '..');
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.wav': 'audio/wav', '.json': 'application/json', '.ttf': 'font/ttf' };

// Un WAV vero: seicento millisecondi di La, abbastanza da essere «in corso»
// quando la prova guarda.
function wav(secondi = 0.6, hz = 440) {
  const campioni = Math.round(8000 * secondi), dati = Buffer.alloc(campioni * 2);
  for (let i = 0; i < campioni; i++) dati.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * i / 8000) * 6000), i * 2);
  const t = Buffer.alloc(44);
  t.write('RIFF', 0); t.writeUInt32LE(36 + dati.length, 4); t.write('WAVE', 8); t.write('fmt ', 12);
  t.writeUInt32LE(16, 16); t.writeUInt16LE(1, 20); t.writeUInt16LE(1, 22); t.writeUInt32LE(8000, 24);
  t.writeUInt32LE(16000, 28); t.writeUInt16LE(2, 32); t.writeUInt16LE(16, 34); t.write('data', 36); t.writeUInt32LE(dati.length, 40);
  return Buffer.concat([t, dati]);
}

const messaggi = (() => {
  const w = {}; const vm = require('node:vm'); const ctx = { window: w }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(radice, 'lingue/it.js'), 'utf8'), ctx);
  return w.ASTRO_DIZIONARI.it.messaggi;
})();
// Un enigma vero del dizionario, per provare che un brano registrato si
// riconosce dentro a una frase composta di Missione Cielo.
const chiaveEnigma = Object.keys(messaggi).find(k => k.startsWith('missione.gioco.enigma.oggetto.') &&
  typeof messaggi[k] === 'string' && !/\{\w+\}/.test(messaggi[k]) && messaggi[k].length > 30);

const MANIFEST_PROVA = `self.ASTRO_NARRAZIONE_MANIFEST = { versione: 1, radice: 'audio/narrazione/', voci: {
  'demo.narr.eclisse_tour.1': { it: 'demo/it/prova-buona.wav', en: 'demo/en/prova-buona.wav' },
  'demo.narr.eclisse_tour.2': { it: 'demo/it/prova-che-manca.wav' },
  'demo.narr.eclisse_tour.3': { it: 'demo/it/prova-rotta.wav' },
  ${JSON.stringify(chiaveEnigma)}: { it: 'missione/it/prova-enigma.wav' }
} };`;
const SOSTITUTI = new Map([
  ['/audio/narrazione/manifest.js', { tipo: 'text/javascript', corpo: MANIFEST_PROVA }],
  ['/audio/narrazione/demo/it/prova-buona.wav', { tipo: 'audio/wav', corpo: wav(1.2) }],
  ['/audio/narrazione/demo/en/prova-buona.wav', { tipo: 'audio/wav', corpo: wav(1.2, 330) }],
  // Byte a caso con l'estensione giusta: il browser non lo decodifica.
  ['/audio/narrazione/demo/it/prova-rotta.wav', { tipo: 'audio/wav', corpo: Buffer.from('RIFF'.repeat(40) + 'rotto'.repeat(50)) }],
  ['/audio/narrazione/missione/it/prova-enigma.wav', { tipo: 'audio/wav', corpo: wav(0.8, 520) }]
]);
const libreria = { 'astronomy.browser.min.js': () => fs.readFileSync(require.resolve('astronomy-engine').replace(/astronomy\.js$/, 'astronomy.browser.min.js')),
  'satellite.min.js': () => fs.readFileSync(path.join(path.dirname(require.resolve('satellite.js/package.json')), 'dist/satellite.min.js')) };

const server = http.createServer((req, res) => {
  const via = decodeURIComponent(req.url.split('?')[0]);
  const s = SOSTITUTI.get(via);
  if (s) { res.writeHead(200, { 'Content-Type': s.tipo, 'Cache-Control': 'no-store' }); res.end(s.corpo); return; }
  const file = path.resolve(radice, '.' + (via === '/' ? '/index.html' : via));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': tipi[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

// La sintesi finta: parla ottanta millisecondi a parola e annota tutto.
function voceFinta() {
  const reg = window.__voce = { detti: [], annullati: 0, attiva: null, sovrapposte: 0 };
  class SpeechSynthesisUtterance { constructor(t) { this.text = t; this.volume = 1; } }
  const s = {
    getVoices: () => [{ lang: 'it-IT', name: 'Alice' }, { lang: 'en-US', name: 'Samantha' }],
    speak(u) {
      if (!u.text.trim()) return;
      if (reg.attiva) this.cancel();
      reg.attiva = u; reg.detti.push({ testo: u.text, lang: u.lang, volume: u.volume });
      setTimeout(() => { if (reg.attiva === u && u.onstart) u.onstart(); }, 20);
      u._t = setTimeout(() => { if (reg.attiva === u) { reg.attiva = null; if (u.onend) u.onend(); } },
        600 + 80 * u.text.split(/\s+/).length);
    },
    cancel() {
      reg.annullati++;
      const u = reg.attiva; reg.attiva = null;
      if (u) { clearTimeout(u._t); if (u.onerror) u.onerror({ error: 'interrupted' }); }
    },
    addEventListener() {}, pause() {}, resume() {}
  };
  Object.defineProperty(window, 'speechSynthesis', { value: s, configurable: true });
  window.SpeechSynthesisUtterance = SpeechSynthesisUtterance;
  // Una voce e un file insieme sono la sovrapposizione che non deve esistere.
  setInterval(() => {
    const st = window.narrazione && window.narrazione.stato();
    if (st && st.fase === 'audio' && reg.attiva) reg.sovrapposte++;
  }, 15);
}

let passate = 0;
async function prova(nome, fn) { await fn(); passate++; console.log('  ok        ' + nome); }

async function apri(browser, origine, opz = {}) {
  const contesto = await browser.newContext({ viewport: { width: 1100, height: 800 },
    serviceWorkers: opz.sw ? 'allow' : 'block' });
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on('pageerror', e => errori.push(e.message));
  await pagina.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origine)) return route.continue();
    for (const [nome, corpo] of Object.entries(libreria))
      if (url.includes(nome)) return route.fulfill({ contentType: 'text/javascript', body: corpo() });
    return route.abort();
  });
  await pagina.addInitScript(voceFinta);
  await pagina.addInitScript(p => {
    localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
    localStorage.setItem('astrocal_lingua', 'it');
    // L'intro comune ha un banco suo (prova-demo-intro.js): qui si misurano
    // le scene subito dopo l'avvio, e i tre secondi di nero si saltano.
    localStorage.setItem('astrocal_demo_intro_v1', JSON.stringify({ attiva: false }));
    if (p) localStorage.setItem('astrocalendario_narrazione', JSON.stringify(p));
  }, opz.preferenze || null);
  await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
  await pagina.waitForFunction(() => typeof AstroDemo !== 'undefined' && typeof narrazione === 'object' &&
    typeof sky !== 'undefined' && sky.observer && sky.oggetti.length, null, { timeout: 30000 });
  return { contesto, pagina, errori };
}

const stato = p => p.evaluate(() => narrazione.stato());
const aspetta = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 8000, polling: 20 });

(async () => {
  let browser;
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

    // -----------------------------------------------------------------
    console.log('\n— la pagina Demo (Narrazione e audio) —');
    {
      const { contesto, pagina, errori } = await apri(browser, origine);
      await prova('i quattro comandi ci sono e dicono lo stato di serie', async () => {
        // La Narrazione si è spostata dalle Impostazioni alla pagina Demo.
        assert.equal(await pagina.locator('#modale-impostazioni #imp-narrazione-attiva').count(), 0);
        await pagina.locator('#btn-vista-demo').click();
        assert.equal(await pagina.locator('#vista-demo #imp-narrazione-attiva').count(), 1);
        assert.equal(await pagina.locator('#imp-narrazione-attiva').isChecked(), true);
        assert.equal(await pagina.locator('#imp-narrazione-volume').inputValue(), '90');
        assert.equal(await pagina.locator('#imp-narrazione-testo').isChecked(), true);
        assert.equal(await pagina.locator('#imp-narrazione-solo-tts').isChecked(), false);
        assert.match(await pagina.locator('#imp-narrazione-stato').innerText(), /Audio registrati in questa lingua: 4/);
      });
      await prova('cambiarli li salva, e spegnere disattiva gli altri tre', async () => {
        await pagina.locator('#imp-narrazione-volume').fill('35');
        await pagina.locator('#imp-narrazione-solo-tts').check();
        await pagina.locator('#imp-narrazione-testo').uncheck();
        let p = await pagina.evaluate(() => JSON.parse(localStorage.getItem('astrocalendario_narrazione')));
        assert.deepEqual(p, { attiva: true, volume: 0.35, testo: false, soloTts: true });
        assert.equal(await pagina.locator('#imp-narrazione-volume-valore').innerText(), '35%');
        await pagina.locator('#imp-narrazione-attiva').uncheck();
        assert.equal(await pagina.locator('#imp-narrazione-volume').isDisabled(), true);
        p = await pagina.evaluate(() => JSON.parse(localStorage.getItem('astrocalendario_narrazione')));
        assert.equal(p.attiva, false);
      });
      await prova('«Ascolta una prova» parla anche a narrazione spenta: è un gesto', async () => {
        await pagina.locator('#imp-narrazione-prova').click();
        await aspetta(pagina, () => window.__voce.detti.some(d => /voce che racconterà/.test(d.testo)));
        assert.equal((await pagina.evaluate(() => window.__voce.detti.at(-1))).volume, 0.35);
      });
      await prova('la riga di stato e i nomi seguono la lingua', async () => {
        await pagina.evaluate(() => astroI18n.impostaLingua('en'));
        assert.match(await pagina.locator('#imp-narrazione-stato').innerText(), /Recordings in this language: 1/);
        assert.match(await pagina.locator('label[for="imp-narrazione-testo"]').innerText(), /Show the narration text/);
        await pagina.evaluate(() => astroI18n.impostaLingua('it'));
      });
      assert.deepEqual(errori, []);
      await contesto.close();
    }

    // -----------------------------------------------------------------
    console.log('\n— una demo narrata —');
    {
      const { contesto, pagina, errori } = await apri(browser, origine);
      await pagina.evaluate(() => AstroDemo.avvia(AstroDemoPredefiniti[0].testo));

      await prova('scena 1: l’audio registrato, col testo nella fascia dei sottotitoli', async () => {
        const s = await stato(pagina);
        assert.equal(s.canale, 'demo'); assert.equal(s.id, 'demo.narr.eclisse_tour.1');
        await aspetta(pagina, () => narrazione.stato() && narrazione.stato().fase === 'audio');
        const testo = await pagina.locator('#demo-sottotitoli #narrazione-testo');
        assert.equal(await pagina.locator('#demo-controlli #narrazione-testo').count(), 0,
          'il testo non sta più dentro ai comandi, che si ritirano');
        assert.equal(await testo.isVisible(), true);
        assert.match(await testo.innerText(), /Reykjavík, 12 agosto 2026/);
        assert.equal(await pagina.evaluate(() => window.__voce.detti.length), 0, 'con l’audio buono la sintesi tace');
      });
      await prova('scena 2: il file manca, parla la sintesi — e il file non si richiede più', async () => {
        await pagina.evaluate(() => AstroDemo.vaiAScena(1));
        await aspetta(pagina, () => window.__voce.detti.some(d => /Un'ora in dodici secondi/.test(d.testo)));
        const g = await pagina.evaluate(() => narrazione.guasti());
        assert.equal(g['audio/narrazione/demo/it/prova-che-manca.wav'], 'mancante');
      });
      await prova('scena 3: il file è rotto, parla la sintesi', async () => {
        await pagina.evaluate(() => AstroDemo.vaiAScena(2));
        await aspetta(pagina, () => window.__voce.detti.some(d => /Totalità/.test(d.testo)));
        const g = await pagina.evaluate(() => narrazione.guasti());
        assert.equal(g['audio/narrazione/demo/it/prova-rotta.wav'], 'corrotto');
      });
      await prova('pausa: la voce si ferma col racconto, e riparte con lui', async () => {
        await pagina.evaluate(() => AstroDemo.vaiAScena(5));
        await aspetta(pagina, () => narrazione.stato() && narrazione.stato().fase === 'tts' && window.__voce.attiva);
        await pagina.evaluate(() => AstroDemo.pausa());
        assert.equal((await stato(pagina)).pausa, true);
        assert.equal(await pagina.evaluate(() => window.__voce.attiva), null);
        assert.match(await pagina.locator('#narrazione-testo').getAttribute('class'), /in-pausa/);
        const prima = await pagina.evaluate(() => window.__voce.detti.length);
        await pagina.waitForTimeout(600);
        assert.equal(await pagina.evaluate(() => window.__voce.detti.length), prima, 'in pausa non parla nessuno');
        await pagina.evaluate(() => AstroDemo.riprendi());
        await aspetta(pagina, n => window.__voce.detti.length > n, prima);
        assert.match(await pagina.evaluate(() => window.__voce.detti.at(-1).testo), /l'ombra della Luna corre sulla Terra/);
      });
      await prova('scheda nascosta: la demo va in pausa e la voce con lei', async () => {
        await pagina.evaluate(() => {
          Object.defineProperty(document, 'hidden', { value: true, configurable: true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        assert.equal(await pagina.evaluate(() => AstroDemo.stato), 'pausa');
        assert.equal((await stato(pagina)).pausa, true);
        await pagina.evaluate(() => {
          Object.defineProperty(document, 'hidden', { value: false, configurable: true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        assert.equal((await stato(pagina)).pausa, true, 'resta in pausa finché non si preme Riprendi');
        await pagina.evaluate(() => AstroDemo.riprendi());
        assert.equal((await stato(pagina)).pausa, false);
      });
      await prova('cambio lingua a metà scena: la frase si ridice in inglese', async () => {
        await pagina.evaluate(() => astroI18n.impostaLingua('en'));
        await aspetta(pagina, () => window.__voce.detti.at(-1).lang === 'en-US');
        assert.match(await pagina.locator('#narrazione-testo').innerText(), /Moon's shadow races/);
        await pagina.evaluate(() => astroI18n.impostaLingua('it'));
      });
      await prova('cambio scena: la frase di prima si ferma, nessuna sovrapposizione', async () => {
        await pagina.evaluate(() => AstroDemo.vaiAScena(6));
        await aspetta(pagina, () => window.__voce.detti.some(d => /Di nuovo a Reykjavík/.test(d.testo)));
        assert.equal((await stato(pagina)).id, 'demo.narr.eclisse_tour.7');
        assert.equal(await pagina.evaluate(() => window.__voce.sovrapposte), 0);
      });
      await prova('un salto di scena a demo in pausa non fa ripartire la voce', async () => {
        await pagina.evaluate(() => AstroDemo.pausa());
        const prima = await pagina.evaluate(() => window.__voce.detti.length);
        await pagina.evaluate(() => AstroDemo.vaiAScena(4));
        await pagina.waitForTimeout(400);
        const s = await stato(pagina);
        assert.equal(s.id, 'demo.narr.eclisse_tour.5'); assert.equal(s.pausa, true);
        assert.equal(await pagina.evaluate(() => window.__voce.detti.length), prima);
        assert.match(await pagina.locator('#narrazione-testo').innerText(), /Sole, Luna e Terra sono in fila/);
        await pagina.evaluate(() => AstroDemo.riprendi());
        await aspetta(pagina, () => window.__voce.detti.some(d => /Sole, Luna e Terra sono in fila/.test(d.testo)));
      });
      await prova('Esc: la demo si ferma, la voce tace e il testo sparisce', async () => {
        await pagina.keyboard.press('Escape');
        assert.equal(await pagina.evaluate(() => AstroDemo.stato), 'fermo');
        assert.equal(await stato(pagina), null);
        assert.equal(await pagina.evaluate(() => window.__voce.attiva), null);
        assert.equal(await pagina.locator('#narrazione-testo').isVisible(), false);
      });
      await prova('Ricomincia: di nuovo la prima scena, una voce sola', async () => {
        await pagina.evaluate(() => AstroDemo.avvia(AstroDemoPredefiniti[2].testo));
        await aspetta(pagina, () => window.__voce.detti.some(d => /Centocinquanta milioni di chilometri/.test(d.testo)));
        await pagina.evaluate(() => AstroDemo.vaiAScena(3));
        await pagina.mouse.click(12, 12);
        await pagina.locator('#demo-controlli [data-azione="riavvia"]').click();
        const s = await stato(pagina);
        assert.equal(s.id, 'demo.narr.aurora_boreale.1');
        assert.equal(await pagina.evaluate(() => window.__voce.sovrapposte), 0);
      });
      await prova('Stop: tace', async () => {
        await pagina.mouse.click(12, 12);
        await pagina.locator('#demo-controlli [data-azione="stop"]').click();
        assert.equal(await stato(pagina), null);
      });
      await prova('fine della demo: l’ultima frase si chiude con lei', async () => {
        await pagina.evaluate(() => AstroDemo.avvia(AstroDemoPredefiniti[3].testo));
        await pagina.evaluate(() => AstroDemo.vaiAScena(4, 0.98));
        await aspetta(pagina, () => AstroDemo.stato === 'completato');
        assert.equal(await stato(pagina), null);
        assert.equal(await pagina.evaluate(() => window.__voce.attiva), null);
      });
      assert.deepEqual(errori, []);
      await contesto.close();
    }

    // -----------------------------------------------------------------
    console.log('\n— le preferenze durante la demo —');
    {
      const spenta = await apri(browser, origine, { preferenze: { attiva: false, volume: 0.9, testo: true, soloTts: false } });
      await prova('narrazione spenta: la demo va, senza voce e senza testo', async () => {
        await spenta.pagina.evaluate(() => AstroDemo.avvia(AstroDemoPredefiniti[0].testo));
        await spenta.pagina.waitForTimeout(400);
        assert.equal(await stato(spenta.pagina), null);
        assert.equal(await spenta.pagina.evaluate(() => window.__voce.detti.length), 0);
        assert.equal(await spenta.pagina.evaluate(() => AstroDemo.stato), 'attivo');
        await spenta.pagina.evaluate(() => AstroDemo.ferma());
      });
      await spenta.contesto.close();
      const solo = await apri(browser, origine, { preferenze: { attiva: true, volume: 0.9, testo: false, soloTts: true } });
      await prova('solo sintesi e testo nascosto: parla la sintesi anche dove c’è il file', async () => {
        await solo.pagina.evaluate(() => AstroDemo.avvia(AstroDemoPredefiniti[0].testo));
        await aspetta(solo.pagina, () => window.__voce.detti.some(d => /Reykjavík, 12 agosto/.test(d.testo)));
        assert.equal(await solo.pagina.locator('#narrazione-testo').isVisible(), false);
        await solo.pagina.evaluate(() => AstroDemo.ferma());
      });
      await solo.contesto.close();
      const muta = await apri(browser, origine, { preferenze: { attiva: true, volume: 0, testo: true, soloTts: true } });
      await prova('senza voce il racconto continua col solo testo', async () => {
        await muta.pagina.evaluate(() => AstroDemo.avvia(AstroDemoPredefiniti[0].testo));
        await aspetta(muta.pagina, () => narrazione.stato() && narrazione.stato().fase === 'testo');
        assert.equal(await muta.pagina.locator('#narrazione-testo').isVisible(), true);
        assert.equal(await muta.pagina.evaluate(() => window.__voce.detti.length), 0);
        await muta.pagina.evaluate(() => AstroDemo.ferma());
      });
      await muta.contesto.close();
    }

    // -----------------------------------------------------------------
    console.log('\n— Missione Cielo —');
    {
      const { contesto, pagina, errori } = await apri(browser, origine);
      await prova('la voce della caccia passa dalla stessa narrazione, senza sottotitolo', async () => {
        await pagina.evaluate(() => { missRacconta(() => 'Guarda verso sud, a metà cielo.', missTonoVoce('indizio'), { id: 'missione.prova' }); });
        const s = await stato(pagina);
        assert.equal(s.canale, 'missione'); assert.equal(s.id, 'missione.prova');
        await aspetta(pagina, () => window.__voce.detti.some(d => /Guarda verso sud/.test(d.testo)));
        assert.equal(await pagina.locator('#narrazione-testo').isVisible(), false);
      });
      await prova('un enigma registrato dentro a un indizio composto: sintesi, file, sintesi', async () => {
        const esito = await pagina.evaluate(async enigma => {
          window.__voce.detti.length = 0;
          const fatto = missRacconta(() => 'Prima tappa. ' + enigma + ' Guarda verso sud.', missTonoVoce('enigma'), { id: 'missione.prova2' });
          const pezzi = narrazione.stato().pezzi;
          return { pezzi, esito: await fatto, detti: window.__voce.detti.map(d => d.testo) };
        }, messaggi[chiaveEnigma]);
        assert.deepEqual(esito.pezzi.map(p => !!p.audio), [false, true, false]);
        assert.equal(esito.esito, true);
        assert.deepEqual(esito.detti, ['Prima tappa.', 'Guarda verso sud.']);
      });
      await prova('fermare la caccia zittisce la sua voce e non tocca le altre', async () => {
        await pagina.evaluate(() => { missRacconta('Una frase della caccia da interrompere adesso.', missTonoVoce('indizio')); });
        await pagina.evaluate(() => missFermaVoce());
        assert.equal(await stato(pagina), null);
        await pagina.evaluate(() => narrazione.parla({ canale: 'prova', testo: 'Una prova.' }));
        await pagina.evaluate(() => missFermaVoce());
        assert.equal((await stato(pagina)).canale, 'prova');
      });
      await prova('Missione Cielo non ha più una voce sua', async () => {
        const nomi = await pagina.evaluate(() => ['missRaccontaConEdge', 'missRaccontaLocale', 'missScegliVoceLocale']
          .filter(n => typeof window[n] === 'function'));
        assert.deepEqual(nomi, []);
      });
      assert.deepEqual(errori, []);
      await contesto.close();
    }

    // -----------------------------------------------------------------
    console.log('\n— offline —');
    {
      const { contesto, pagina, errori } = await apri(browser, origine, { sw: true });
      await prova('il service worker mette in cache gli audio del manifest, e li serve senza rete', async () => {
        await pagina.evaluate(() => navigator.serviceWorker.ready);
        await pagina.waitForFunction(async () => {
          const c = await caches.keys();
          if (!c.length) return false;
          return !!(await caches.match(new URL('audio/narrazione/demo/it/prova-buona.wav', location.href).href));
        }, null, { timeout: 20000, polling: 200 });
        const assente = await pagina.evaluate(async () =>
          !!(await caches.match(new URL('audio/narrazione/demo/it/prova-che-manca.wav', location.href).href)));
        assert.equal(assente, false, 'un file che manca non blocca l’installazione');
        assert.ok(await pagina.evaluate(async () => !!(await caches.match(new URL('narrazione.js', location.href).href))));
        await pagina.reload({ waitUntil: 'domcontentloaded' });
        await pagina.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
        await contesto.setOffline(true);
        const r = await pagina.evaluate(async () => {
          const x = await fetch('audio/narrazione/demo/it/prova-buona.wav');
          return { ok: x.ok, size: (await x.blob()).size };
        });
        assert.equal(r.ok, true); assert.ok(r.size > 1000);
        await contesto.setOffline(false);
      });
      assert.deepEqual(errori, []);
      await contesto.close();
    }

    console.log(`\n${passate} passate, 0 fallite (narrazione nel browser)`);
  } catch (e) {
    console.error('\nFALLITA:', e && e.stack || e);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})();
