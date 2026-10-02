/*
 * Il passaggio fra planetario e vista 3D fatto con lo zoom (v403).
 *
 *   npm install playwright-core astronomy-engine satellite.js@5.0.0
 *   node scripts/prova-passaggio-zoom.js
 *
 * Allontanandosi oltre i 180° di campo il planetario esce nello spazio
 * (`skySpintaOltreIlCampo`); avvicinandosi alla Terra finché riempie lo
 * schermo la vista 3D atterra nel planetario (`solAtterraNelPlanetario`), col
 * volo d'ingresso percorso all'indietro. Si prova su un monitor e su un
 * telefono, perché la soglia dell'atterraggio è una frazione della tela.
 */
'use strict';

const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium/chrome-linux/chrome';
const RADICE = path.join(__dirname, '..');
const PORTA = 8163;
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

function libreria(dove) {
  const f = path.join(RADICE, 'node_modules', dove);
  if (!fs.existsSync(f)) throw new Error('manca ' + dove + ': npm install playwright-core astronomy-engine satellite.js@5.0.0');
  return fs.readFileSync(f, 'utf8');
}

const server = http.createServer((req, res) => {
  const nome = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(RADICE, nome === '/' ? 'index.html' : nome);
  if (!f.startsWith(RADICE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPI[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
});

let ko = 0;
const ok = (n, c, x) => {
  console.log((c ? '  ok        ' : '  FALLITO   ') + n + (x ? '   — ' + x : ''));
  if (!c) ko++;
};
const titolo = t => console.log('\n— ' + t + ' —');

async function apriIlCielo(pagina) {
  await pagina.evaluate(() => { mostraVista('cielo'); });
  await pagina.waitForTimeout(1400);
}

// La corsa del volo, campionata fitta e **ferma**: si spegne il ciclo e si
// chiede il fotogramma che si vuole. Un cronometro qui non servirebbe a
// niente — la stessa corsa su due macchine dà due cadenze diverse — mentre
// la geometria è la stessa dappertutto.
async function corsa(pagina, passi) {
  return pagina.evaluate(n => {
    if (solVolo.raf) cancelAnimationFrame(solVolo.raf);
    solVolo.raf = 0;
    if (solVolo.timer) clearTimeout(solVolo.timer);
    const fuori = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const p = solVoloPosa(u);
      const c = solVoloCerchio(p, p.rho);
      const a = solVoloCerchio(p, p.rhoAria);
      fuori.push({
        u, h: p.h, rho: p.rho, rhoAria: p.rhoAria, beta: p.beta, F: p.F, buio: p.buio,
        esterno: !!c.esterno, retta: !!c.retta, rc: c.rc, dc: c.dc, vicino: c.vicino,
        banda: Math.abs(c.vicino - a.vicino), H: solVolo.H, L: solVolo.L
      });
    }
    return fuori;
  }, passi);
}


(async () => {
  await new Promise(r => server.listen(PORTA, r));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  for (const viewport of [{ width: 1280, height: 800 }, { width: 360, height: 640 }]) {
  titolo('schermo ' + viewport.width + '×' + viewport.height);
  const contesto = await browser.newContext({ serviceWorkers: 'block', viewport });
  const pagina = await contesto.newPage();
  pagina.on('pageerror', e => { console.log('  ECCEZIONE: ' + e.message); ko++; });
  await pagina.route('**cdn.tailwindcss.com**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**cdn.jsdelivr.net**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pagina.route('**/astronomy.browser.min.js', r =>
    r.fulfill({ body: libreria('astronomy-engine/astronomy.browser.min.js'), contentType: 'text/javascript' }));
  await pagina.route('**/satellite.min.js', r =>
    r.fulfill({ body: libreria('satellite.js/dist/satellite.min.js'), contentType: 'text/javascript' }));
  ['**open-meteo.com/**', '**noaa.gov/**', '**celestrak.org/**', '**overpass**',
   '**amazonaws**', '**ipapi**', '**ipwho**', '**geojs**', '**upload.wikimedia.org/**',
   '**bigdatacloud**', '**nominatim**', '**adsb**'].forEach(u => pagina.route(u, r => r.abort()));
  await pagina.goto(`http://localhost:${PORTA}/index.html`, { waitUntil: 'domcontentloaded' });
  await pagina.evaluate(() => {
    localStorage.setItem('astrocalendario_posizione',
      JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
    localStorage.setItem('astrocal_lingua', 'it');
  });
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(2500);
  await apriIlCielo(pagina);

  ok('il tasto del Sistema Solare in basso a destra non c’è più',
    await pagina.evaluate(() => !document.getElementById('skymap-btn-sistema-mappa')));

  // Rotellina indietro sul cielo: prima arriva a 180°, poi esce
  const box = await pagina.evaluate(() => { const r = sky.canvas.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await pagina.mouse.move(box.x, box.y);
  for (let i = 0; i < 30; i++) {
    await pagina.mouse.wheel(0, 400);
    await pagina.waitForTimeout(40);
    if (await pagina.evaluate(() => sol.aperto)) break;
  }
  const dopoRotella = await pagina.evaluate(() => ({ aperto: sol.aperto, fov: sky.fov }));
  ok('allontanandosi oltre i 180° si esce nello spazio', dopoRotella.aperto, 'campo ' + dopoRotella.fov.toFixed(1) + '°');
  ok('…e ci si esce solo a campo già al massimo', dopoRotella.fov > 179, dopoRotella.fov.toFixed(1));

  // Pochi scatti di rotellina sotto al massimo non bastano
  await pagina.evaluate(() => { chiudiSistemaSolare(); skyImpostaFov(60); });
  await pagina.waitForTimeout(400);
  await pagina.mouse.wheel(0, 300);
  await pagina.waitForTimeout(300);
  ok('a campo normale lo zoom indietro resta nel planetario', await pagina.evaluate(() => !sol.aperto && sky.fovVoluto < 180));

  // Il − portato oltre il tetto
  await pagina.evaluate(() => skyImpostaFov(180));
  await pagina.waitForTimeout(100);
  await pagina.evaluate(() => document.getElementById('skymap-zoom-out').click());
  await pagina.waitForTimeout(100);
  ok('anche il tasto − al massimo porta nello spazio', await pagina.evaluate(() => sol.aperto));

  // Lascio finire il volo d'ingresso
  await pagina.waitForTimeout(7000);
  const prima = await pagina.evaluate(() => ({ perno: sol.perno, zoom: sol.zoom, volo: solVolo.attivo }));
  ok('si arriva addosso alla Terra', prima.perno === 'Earth' && !prima.volo, JSON.stringify(prima));

  // Zoom avanti sulla Terra col tasto +
  for (let i = 0; i < 30; i++) {
    await pagina.evaluate(() => document.getElementById('sol-zoom-piu').click());
    await pagina.waitForTimeout(120);
    if (await pagina.evaluate(() => solVolo.attivo || !sol.aperto)) break;
  }
  const inVolo = await pagina.evaluate(() => {
    const t = sol.pianeti.find(p => p.id === 'Earth');
    return { volo: solVolo.attivo, r: solRaggioCorpo(t), lato: Math.min(sol.L, sol.H) };
  });
  ok('avvicinandosi alla Terra parte l’atterraggio', inVolo.volo, 'raggio ' + inVolo.r.toFixed(0) + ' su lato ' + inVolo.lato);
  // A metà il velo copre la scena
  await pagina.waitForTimeout(1500);
  ok('a metà discesa il velo copre la scena', await pagina.evaluate(() =>
    document.getElementById('sol-transizione').style.opacity === '1' && sol.aperto));
  await pagina.waitForTimeout(3500);
  const fine = await pagina.evaluate(() => ({
    aperto: sol.aperto, vista: vistaAttuale, volo: solVolo.attivo,
    velo: document.getElementById('sol-transizione').classList.contains('in-volo'),
    fov: sky.fovVoluto, gira: !!sky.raf
  }));
  ok('si atterra nel planetario', !fine.aperto && fine.vista === 'cielo' && !fine.volo && !fine.velo, JSON.stringify(fine));
  ok('…che si stringe su una vista normale', fine.fov <= 100, fine.fov);
  ok('…e il cielo ricomincia a girare', fine.gira);

  // E di nuovo fuori: il passaggio si può rifare
  await pagina.evaluate(() => skyImpostaFov(180));
  await pagina.mouse.move(box.x, box.y);
  for (let i = 0; i < 30; i++) {
    await pagina.mouse.wheel(0, 400);
    await pagina.waitForTimeout(40);
    if (await pagina.evaluate(() => sol.aperto)) break;
  }
  ok('e si può uscire di nuovo', await pagina.evaluate(() => sol.aperto));
  await contesto.close();
  }
  await browser.close();
  server.close();
  console.log(ko ? '\n✗ ' + ko + ' prove fallite' : '\n✓ tutte le prove passate');
  process.exit(ko ? 1 : 0);
})();
