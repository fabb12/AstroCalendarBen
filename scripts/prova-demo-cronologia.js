/* La barra (cronologia) della demo: clic, salti da un capo all'altro,
 * trascinamento del pallino, pausa. Nessuna demo deve fermarsi per un salto
 * (v515: la Voyager si fermava saltando dal lancio all'ultima scena).
 * npm install --no-save playwright-core playwright astronomy-engine satellite.js@5.0.0
 * node scripts/prova-demo-cronologia.js   (SOLO=voyager,universo per alcune) */
'use strict';
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const radice = path.resolve(__dirname, '..');
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const file = path.resolve(radice, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', tipi[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origine = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
  const pagina = await browser.newPage({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
  const errori = [];
  pagina.on('pageerror', e => errori.push(e.message));
  await pagina.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origine)) return route.continue();
    if (url.includes('astronomy.browser.min.js'))
      return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(require.resolve('astronomy-engine').replace(/astronomy\.js$/, 'astronomy.browser.min.js')) });
    if (url.includes('satellite'))
      return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(radice, 'node_modules/satellite.js/dist/satellite.min.js')) });
    return route.abort();
  });
  await pagina.addInitScript(() => {
    localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
    localStorage.setItem('astrocal_lingua', 'it');
  });
  await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
  await pagina.waitForFunction(() => typeof AstroDemo !== 'undefined' && typeof sky !== 'undefined' && sky.observer && sky.oggetti.length, null, { timeout: 30000 });
  await pagina.evaluate(() => {
    const v = window.skyAvviso;
    window.skyAvviso = function (c, m, ...r) { if (c === 'demo') window.__avvisoDemo = m; return v.call(this, c, m, ...r); };
  });
  const tutte = await pagina.evaluate(() => AstroDemo.libreria.elenco().filter(d => d.solaLettura).map(d => d.chiave));
  const chiavi = process.env.SOLO ? process.env.SOLO.split(',') : tutte;
  let cadute = 0, provate = 0;
  const caso = (cond, msg) => { if (!cond) { cadute++; console.log('  CADUTA: ' + msg); } };
  const stato = () => pagina.evaluate(() => ({ stato: AstroDemo.stato, scena: AstroDemo.scena, t: AstroDemo.tempo, avviso: window.__avvisoDemo || '' }));
  const mostra = async () => {
    await pagina.mouse.move(20, 20);
    await pagina.evaluate(() => document.querySelector('.demo-controlli').dispatchEvent(new PointerEvent('pointerenter')));
    return pagina.locator('.demo-cronologia-pista').boundingBox();
  };
  const durate = k => pagina.evaluate(k => AstroDemo.valida(AstroDemo.libreria.elenco().find(x => x.chiave === k).testo).scene.map(s => s.durata), k);
  const scenaDi = (d, f) => { let r = f * d.reduce((a, b) => a + b, 0), i = 0; while (i < d.length - 1 && r >= d[i]) { r -= d[i]; i++; } return i; };
  for (const chiave of chiavi) {
    await pagina.evaluate(() => { window.__avvisoDemo = ''; });
    await pagina.evaluate(k => AstroDemo.avvia(AstroDemo.libreria.elenco().find(x => x.chiave === k).testo), chiave);
    await pagina.waitForTimeout(800);
    const s0 = await stato();
    if (s0.stato !== 'attivo') { console.log(chiave, 'non parte qui (' + s0.avviso + '): saltata'); continue; }
    provate++;
    const d = await durate(chiave);
    // 1. clic in giro per la pista, con i salti da un capo all'altro
    for (const f of [0.5, 0.1, 0.9, 0.3, 0.7, 0.02, 0.98, 0.4, 0.995, 0.01]) {
      const box = await mostra();
      caso(box, chiave + ': pista invisibile');
      if (!box) break;
      await pagina.mouse.click(box.x + box.width * f, box.y + box.height / 2);
      await pagina.waitForTimeout(350);
      const s = await stato();
      // in fondo all'ultima scena la demo può finire da sola: è la sua fine
      if (f > 0.99 && s.stato === 'completato') break;
      caso(s.stato === 'attivo', chiave + ' clic a ' + f + ': ' + JSON.stringify(s));
      if (s.stato !== 'attivo') break;
      caso(s.scena === scenaDi(d, Math.min(0.999, f)) || f > 0.99, chiave + ' clic a ' + f + ': scena ' + s.scena + ' invece di ' + scenaDi(d, f));
    }
    if ((await stato()).stato === 'completato') {
      await pagina.evaluate(k => AstroDemo.avvia(AstroDemo.libreria.elenco().find(x => x.chiave === k).testo), chiave);
      await pagina.waitForTimeout(500);
    }
    if ((await stato()).stato !== 'attivo') { await pagina.evaluate(() => AstroDemo.ferma()); continue; }
    // 2. trascinamento: durante, la scena non cambia; lasciando, un salto solo
    {
      const box = await mostra();
      await pagina.mouse.click(box.x + box.width * 0.15, box.y + box.height / 2);
      await pagina.waitForTimeout(300);
      const prima = await stato();
      await pagina.mouse.move(box.x + box.width * 0.15, box.y + box.height / 2);
      await pagina.mouse.down();
      for (let k = 1; k <= 10; k++) {
        await pagina.mouse.move(box.x + box.width * (0.15 + 0.06 * k), box.y + box.height / 2 + (k % 3) * 25, { steps: 2 });
        await pagina.waitForTimeout(40);
      }
      const durante = await pagina.evaluate(() => ({ scena: AstroDemo.scena, pomello: parseFloat(document.querySelector('.demo-cronologia-pomello').style.left),
        visibili: document.querySelector('.demo-controlli').classList.contains('visibile') }));
      // la scena può finire da sé mentre si trascina, ma non saltare al pallino
      caso(durante.scena === prima.scena || durante.scena === prima.scena + 1,
        chiave + ': la scena salta durante il trascinamento (' + prima.scena + ' → ' + durante.scena + ')');
      caso(Math.abs(durante.pomello - 75) < 2, chiave + ': pallino a ' + durante.pomello + '% invece di 75%');
      caso(durante.visibili, chiave + ': comandi spariti trascinando');
      await pagina.mouse.move(box.x + box.width * 0.8, box.y - 60);   // fuori dalla pista: conta la x
      await pagina.mouse.up();
      await pagina.waitForTimeout(400);
      const dopo = await stato();
      caso(dopo.stato === 'attivo', chiave + ' dopo il trascinamento: ' + JSON.stringify(dopo));
      caso(dopo.scena === scenaDi(d, 0.8), chiave + ': lasciato a 0.8, scena ' + dopo.scena + ' invece di ' + scenaDi(d, 0.8));
      const tot = d.reduce((a, b) => a + b, 0);
      caso(Math.abs(dopo.t - 0.8 * tot) < 2500 || dopo.t > 0.8 * tot, chiave + ': tempo ' + dopo.t + ' invece di ~' + 0.8 * tot);
    }
    // 3. in pausa, un salto fa ripartire
    await pagina.evaluate(() => AstroDemo.pausa());
    {
      const box = await mostra();
      await pagina.mouse.click(box.x + box.width * 0.33, box.y + box.height / 2);
      await pagina.waitForTimeout(300);
      const s = await stato();
      caso(s.stato === 'attivo', chiave + ': in pausa il salto non riparte (' + s.stato + ')');
    }
    console.log(chiave, (await stato()).stato);
    await pagina.evaluate(() => AstroDemo.ferma());
    await pagina.waitForTimeout(300);
  }
  // 4. i comandi restano a schermo mentre si tiene il pallino oltre il ritiro
  {
    await pagina.evaluate(k => AstroDemo.avvia(AstroDemo.libreria.elenco().find(x => x.chiave === k).testo), chiavi.find(k => k !== 'passaggio_iss'));
    await pagina.waitForTimeout(500);
    const box = await mostra();
    await pagina.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
    await pagina.mouse.down();
    await pagina.waitForTimeout(6500);
    caso(await pagina.evaluate(() => document.querySelector('.demo-controlli').classList.contains('visibile')), 'comandi ritirati col pallino in mano');
    await pagina.mouse.up();
    await pagina.evaluate(() => AstroDemo.ferma());
  }
  caso(errori.length === 0, 'errori nella pagina: ' + errori.join(' | '));
  console.log(cadute ? cadute + ' cadute' : 'tutto bene (' + provate + ' demo)');
  if (cadute) process.exitCode = 1;
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
