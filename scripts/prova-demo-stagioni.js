/* La demo dei solstizi e degli equinozi in un browser vero.
 *   npm install --no-save playwright-core astronomy-engine satellite.js@5.0.0
 *   node scripts/prova-demo-stagioni.js
 *
 * La domanda che questo banco esiste per fare è quella che a occhio non si
 * può fare: **una demo delle stagioni sbagliata è bella lo stesso**. Un asse
 * inclinato dalla parte opposta al Sole al solstizio di giugno è un disegno
 * perfettamente convincente — solo che racconta l'inverno. Un cartello che
 * dice «21 giugno» sopra a un cielo di dicembre si legge come un cartello.
 * Il giudice è quindi la geometria: al solstizio di giugno l'asse punta
 * verso il Sole (asse·Sole ≈ +sen 23,4°), a dicembre dalla parte opposta,
 * agli equinozi di lato (≈ 0); lungo un anno la sua direzione non cambia;
 * a gennaio la Terra è più vicina che a luglio; a Roma il giorno dura più
 * di quindici ore a giugno, poco più di nove a dicembre, circa dodici
 * all'equinozio, e a Tromsø il Sole di giugno non tramonta. In coda: che
 * Stop rimetta tutto com'era — l'asse spento, gli archi spenti, il cartello
 * nascosto, il luogo e l'orologio di prima. Le schermate vanno in
 * `work/stagioni-*.png`. */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('playwright-core')); }
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const radice = path.resolve(__dirname, '..');
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const nome = req.url.split('?')[0];
  const file = path.resolve(radice, '.' + decodeURIComponent(nome === '/' ? '/index.html' : nome));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader('Content-Type', tipi[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
let verifiche = 0;
const ok = (c, m) => { assert.ok(c, m); verifiche++; console.log('  ok  ' + m); };

(async () => {
  let browser;
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    // Il Chromium già installato sulla macchina, se c'è: evita di scaricarne uno.
    const CHROMIUM = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : '');
    browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
    // `STAGIONI_TELEFONO=1` rifà tutto su uno schermo da telefono (360×640).
    const telefono = process.env.STAGIONI_TELEFONO === '1';
    const pagina = await browser.newPage({ viewport: telefono ? { width: 360, height: 640 } : { width: 1100, height: 760 },
      serviceWorkers: 'block', ...(telefono ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    const errori = [];
    pagina.on('pageerror', e => errori.push(e.message));
    await pagina.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(origine)) return route.continue();
      if (url.includes('astronomy.browser.min.js'))
        return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(require.resolve('astronomy-engine').replace(/astronomy\.js$/, 'astronomy.browser.min.js')) });
      return route.abort();
    });
    await pagina.addInitScript(() => {
      localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
      localStorage.setItem('astrocal_lingua', 'it');
      localStorage.setItem('astrocal_demo_intro_v1', JSON.stringify({ attiva: false }));
      localStorage.setItem('astrocal_demo_opzioni_v1', JSON.stringify({ vistaPulita: true, musicaDemo: false }));
    });
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => typeof AstroDemo !== 'undefined' && typeof sky !== 'undefined' && sky.observer && sky.oggetti.length, null, { timeout: 30000 });
    await pagina.evaluate(() => mostraVista('cielo'));
    await pagina.waitForTimeout(300);
    const prima = await pagina.evaluate(() => ({ luogo: sky.luogoVista, offset: Math.round(sky.offsetTempoSec || 0) }));

    const testo = await pagina.evaluate(() => AstroDemo.libreria.elenco().find(d => d.chiave === 'solstizi_equinozi').testo);
    await pagina.evaluate(t => AstroDemo.avvia(t), testo);
    ok(await pagina.evaluate(() => AstroDemo.stato === 'attivo'), 'la demo parte');

    // Salta a una scena, aspetta qualche fotogramma e legge lo stato che conta.
    async function scena(i, u = 0.5, nome) {
      await pagina.evaluate(([i, u]) => AstroDemo.vaiAScena(i, u), [i, u]);
      await pagina.waitForTimeout(700);
      const dati = await pagina.evaluate(() => {
        const c = document.getElementById('demo-cartello');
        const r = c.getBoundingClientRect();
        const terra = sol.terra;
        const s = terra ? solVersoIlSole(terra) : null;
        const assi = solAssiVista();
        return {
          vista: vistaAttuale, sol: sol.aperto, asse: sol.evidenziaAsse,
          archi: sky.archiSole ? sky.archiSole.date.slice() : null,
          cartello: !c.hidden && r.width > 40 && r.height > 20 && r.top >= 0 ? c.innerText : '',
          cartelloDentro: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
          asseSole: terra && s ? skyDot(terra.asse, s) : null,
          asseVettore: terra ? terra.asse.slice(0, 3) : null,
          soleSchermoX: s ? skyDot(s, assi.destra) : null,
          distanzaUa: terra ? terra.r : null,
          stato: AstroDemo.stato
        };
      });
      if (nome) await pagina.screenshot({ path: path.join(radice, 'work', 'stagioni-' + (telefono ? 'telefono-' : '') + nome + '.png') });
      return dati;
    }

    let d = await scena(0, 0.5, '01-roma');
    ok(d.vista === 'cielo' && /21 giugno 2027/.test(d.cartello) && /Roma/i.test(d.cartello), 'scena 1: cartello con la data e il luogo');
    ok(d.cartelloDentro, 'il cartello sta dentro allo schermo');

    d = await scena(2, 0.9, '03-asse');
    ok(d.sol && d.asse && d.asse.parallelo === 41.9, 'scena 3: vista 3D con l’asse e il parallelo di Roma');
    ok(Math.abs(Math.acos(d.asseVettore[2]) * 180 / Math.PI - 23.44) < 0.1, 'l’asse è inclinato di 23,4° sulla perpendicolare all’orbita');
    ok(/L’asse inclinato/i.test(d.cartello), 'il cartello dice di cosa parla la scena');

    const anno = [];
    for (const u of [0.05, 0.3, 0.54, 0.8]) anno.push(await scena(3, u, u === 0.3 ? '04-anno' : null));
    const coseno = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    ok(anno.every(x => coseno(x.asseVettore, anno[0].asseVettore) > 0.99999), 'lungo l’anno l’asse non cambia direzione');
    ok(anno[2].distanzaUa < anno[0].distanzaUa - 0.025, 'a gennaio la Terra è più vicina al Sole che a luglio');
    ok(/milioni di km dal Sole/.test(anno[2].cartello) && /gennaio 2028/.test(anno[2].cartello), 'il cartello segue la data e dice la distanza');

    d = await scena(4, 0.02, '05-giugno');
    ok(d.asseSole > 0.39 && d.asseSole < 0.4, 'solstizio di giugno: il polo nord è inclinato verso il Sole');
    ok(d.soleSchermoX < -0.95, 'solstizio di giugno: il Sole è a sinistra dello schermo');
    ok(/21 giugno 2027/.test(d.cartello) && /Solstizio d’estate/i.test(d.cartello), 'solstizio di giugno: la data giusta sul cartello');
    await scena(4, 0.9, '05-giugno-fine');

    d = await scena(6, 0.02, '07-dicembre');
    ok(d.asseSole < -0.39 && d.asseSole > -0.4, 'solstizio di dicembre: il polo nord guarda dalla parte opposta');
    ok(d.soleSchermoX < -0.95, 'solstizio di dicembre: stessa camera, il Sole ancora a sinistra');
    ok(/22 dicembre 2027/.test(d.cartello), 'solstizio di dicembre: la data giusta sul cartello');

    d = await scena(7, 0.5, '08-marzo');
    ok(Math.abs(d.asseSole) < 0.01, 'equinozio di marzo: nessun emisfero verso il Sole');
    ok(/20 marzo 2028/.test(d.cartello), 'equinozio di marzo: la data giusta');
    d = await scena(8, 0.5, '09-settembre');
    ok(Math.abs(d.asseSole) < 0.01, 'equinozio di settembre: nessun emisfero verso il Sole');
    ok(/22 settembre 2028/.test(d.cartello), 'equinozio di settembre: la data giusta');

    await scena(9, 0.06, '10-roma-giugno-alba');
    d = await scena(9, 0.5, '10-roma-giugno');
    ok(d.vista === 'cielo' && !d.sol && d.asse === null, 'di nuovo nel planetario, e l’asse della 3D si spegne');
    ok(d.archi && d.archi.length === 1, 'l’arco di giugno è disegnato');
    ok(/Giorno di 15 h/.test(d.cartello) && /Alba/.test(d.cartello) && /Sole a mezzogiorno a 72°/.test(d.cartello),
      'Roma a giugno: più di quindici ore di giorno e il Sole a 72°');
    d = await scena(10, 0.5, '11-roma-dicembre');
    ok(d.archi.length === 2 && /Giorno di 9 h/.test(d.cartello) && /a 25°/.test(d.cartello), 'Roma a dicembre: nove ore e il Sole a 25°');
    d = await scena(11, 0.5, '12-roma-equinozio');
    ok(d.archi.length === 3 && /Giorno di 12 h/.test(d.cartello) && /a 48°/.test(d.cartello), 'Roma all’equinozio: dodici ore e il Sole a 48°');
    // Gli archi sono tre, con tre colori diversi, e il culmine sta dove dice la geometria.
    const archi = await pagina.evaluate(() => (sky.archiSole.archi || []).map(a => ({ colore: a.colore, alt: a.culmine.alt })));
    ok(new Set(archi.map(a => a.colore)).size === 3, 'tre archi, tre colori');
    ok(Math.abs(archi[0].alt - 71.5) < 0.3 && Math.abs(archi[1].alt - 48) < 0.5 && Math.abs(archi[2].alt - 24.7) < 0.3,
      'le altezze a mezzogiorno sono quelle vere (71,5°, 48°, 24,7°)');
    await scena(12, 0.8, '13-confronto');
    d = await scena(13, 0.5, '14-tromso');
    ok(/non tramonta/.test(d.cartello), 'Tromsø a giugno: il Sole non tramonta');
    d = await scena(15, 0.5, '16-riepilogo');
    ok(d.sol && d.asse && /Riepilogo/i.test(d.cartello), 'il riepilogo torna nella 3D con l’asse');

    // In inglese il cartello parla inglese.
    await pagina.evaluate(() => astroI18n.impostaLingua('en'));
    d = await scena(4, 0.1);
    ok(/June 2027/.test(d.cartello) && /June solstice/i.test(d.cartello), 'in inglese il cartello è in inglese');
    await pagina.evaluate(() => astroI18n.impostaLingua('it'));

    await pagina.evaluate(() => AstroDemo.ferma());
    await pagina.waitForTimeout(400);
    const dopo = await pagina.evaluate(() => ({
      luogo: sky.luogoVista, offset: Math.round(sky.offsetTempoSec || 0), asse: sol.evidenziaAsse,
      archi: sky.archiSole, cartello: document.getElementById('demo-cartello').hidden, sol: sol.aperto, stato: AstroDemo.stato
    }));
    ok(dopo.stato === 'fermo' && !dopo.sol && dopo.asse === null && !dopo.archi && dopo.cartello, 'Stop spegne asse, archi e cartello');
    ok(JSON.stringify(dopo.luogo) === JSON.stringify(prima.luogo) && Math.abs(dopo.offset - prima.offset) < 5,
      'Stop rimette luogo e orologio di prima');
    ok(!errori.length, 'nessun errore nella pagina' + (errori.length ? ': ' + errori.join(' | ') : ''));
    console.log(`\nDemo delle stagioni: ${verifiche} verifiche superate`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})();
