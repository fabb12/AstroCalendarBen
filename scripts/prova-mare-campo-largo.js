#!/usr/bin/env node
'use strict';
// Il mare a campo largo, guardato nei pixel.
//
//     npm install playwright-core astronomy-engine
//     node scripts/prova-mare-campo-largo.js
//
// La segnalazione è «oltre gli ottanta gradi di campo il mare diventa
// terreno», con una fotografia che a guardarla bene diceva una seconda cosa:
// il **cielo** era diventato piatto, senza nuvole e senza gradiente. Non era
// il rilievo a sbagliare. Su uno schermo di traverso, oltre gli ottanta gradi
// il cono della vista (misurato sulla diagonale) supera i novanta gradi di
// semiapertura, l'arco del mare diventa il giro intero, e il poligono del
// mare — il cerchio dell'orizzonte più uno spillo verso il nadir — riempiva
// il **dentro** del cerchio, che guardando in su è il cielo. Il mare vero,
// che sta fuori dal cerchio, restava al rilievo: una campitura verde a
// rettangoli sopra a dell'acqua.
//
// A occhio non si giudica — un cielo azzurro piatto e un mare azzurro sono lo
// stesso colore — quindi il giudice è la geometria: ogni pixel si riporta in
// cielo con `skyDirezione`, e si pretende che l'acqua sia dipinta **solo**
// sotto l'orizzonte e **tutta** sotto l'orizzonte dove la miscela dice mare.
// Due scene: il mare aperto, e una costa col mare **alle spalle** (è il caso
// in cui il pezzo d'acqua contiene il punto che la stereografica manda
// all'infinito, e la sua immagine è l'esterno del contorno).
//
// Il contro-esempio è la versione di `app.js` prima della cura, servita da
// `git show`: sulle stesse scene deve sbagliare, se no la prova non prova.

const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RADICE = path.join(__dirname, '..');
const CHROMIUM = process.env.CHROMIUM || [
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
].find(p => fs.existsSync(p));
const PORTA = 8107;
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

function leggiAstronomy() {
  const posti = [
    process.env.ASTRONOMY_JS,
    path.join(RADICE, 'node_modules', 'astronomy-engine', 'astronomy.browser.min.js')
  ].filter(Boolean);
  for (const p of posti) if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  throw new Error('npm install astronomy-engine');
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

let passate = 0, fallite = 0;
function prova(nome, ok, dettaglio) {
  if (ok) { passate++; console.log('  ok  ' + nome + (dettaglio ? '   — ' + dettaglio : '')); }
  else { fallite++; console.log('  NO  ' + nome + (dettaglio ? '   — ' + dettaglio : '')); }
}

// Gira dentro alla pagina. Dipinge il solo mare su una tela vuota e conta
// gli errori: acqua sopra l'orizzonte, e buchi sotto dove l'acqua ci va.
function misura({ fov, altVista, azVista, scena, W, H }) {
  const mareA = az => {
    if (scena === 'aperto') return 1;
    // Costa: mare fra 90° e 270° (a sud), terra a nord. Si guarda a nord,
    // quindi il mare sta alle spalle.
    const a = ((az % 360) + 360) % 360;
    return (a > 100 && a < 260) ? 1 : (a < 80 || a > 280 ? 0 : (a < 180 ? (a - 80) / 20 : (280 - a) / 20));
  };
  window.terrenoDisponibile = () => true;
  window.terrenoMiscela = az => ({ mare: mareA(az) });
  const salva = { w: sky.larghezza, h: sky.altezza, fov: sky.fov,
                  az: sky.manuale.az, al: sky.manuale.alt, segui: sky.seguiTelefono };
  sky.larghezza = W; sky.altezza = H; sky.fov = fov;
  sky.seguiTelefono = false;
  sky.manuale.az = azVista; sky.manuale.alt = altVista;
  sky.luceCielo = 1;
  const tela = document.createElement('canvas');
  tela.width = W; tela.height = H;
  const ctx = tela.getContext('2d', { willReadFrequently: true });
  const aria = skyAria();
  const base = skyBase();
  const focale = skyFocale();
  let eccezione = null;
  try { skyDisegnaMare(ctx, base, focale, aria); } catch (e) { eccezione = String(e); }
  const dati = ctx.getImageData(0, 0, W, H).data;
  let sopraDipinti = 0, sopra = 0, sottoVuoti = 0, sotto = 0;
  const R2D = 180 / Math.PI;
  for (let y = 0; y < H; y += 3) {
    for (let x = 0; x < W; x += 3) {
      const v = skyDirezione(x + 0.5, y + 0.5, base, focale);
      const alt = Math.asin(Math.max(-1, Math.min(1, v[2]))) * R2D;
      const az = Math.atan2(v[0], v[1]) * R2D;
      const a = dati[(y * W + x) * 4 + 3];
      if (alt > 0.5) { sopra++; if (a > 20) sopraDipinti++; }
      else if (alt < -1 && mareA(az) >= 1) { sotto++; if (a < 200) sottoVuoti++; }
    }
  }
  sky.larghezza = salva.w; sky.altezza = salva.h; sky.fov = salva.fov;
  sky.manuale.az = salva.az; sky.manuale.alt = salva.al; sky.seguiTelefono = salva.segui;
  return { eccezione, sopra, sopraDipinti, sotto, sottoVuoti };
}

(async () => {
  await new Promise(r => server.listen(PORTA, r));
  const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const contesto = await browser.newContext({ serviceWorkers: 'block' });

  async function apri(appJs) {
    const pagina = await contesto.newPage();
    await pagina.route('**cdn.tailwindcss.com**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
    await pagina.route('**cdn.jsdelivr.net**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
    await pagina.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
    await pagina.route('**/astronomy.browser.min.js', r =>
      r.fulfill({ body: leggiAstronomy(), contentType: 'text/javascript' }));
    for (const fuori of ['**open-meteo.com/**', '**overpass**', '**amazonaws**',
      '**celestrak**', '**ipapi**', '**ipwho**', '**geojs**', '**noaa**',
      '**bigdatacloud**', '**nominatim**', '**adsb**']) {
      await pagina.route(fuori, r => r.abort());
    }
    if (appJs) await pagina.route('**/app.js', r => r.fulfill({ body: appJs, contentType: 'text/javascript' }));
    await pagina.goto(`http://localhost:${PORTA}/index.html`, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await pagina.evaluate(() => {
      localStorage.setItem('astrocalendario_posizione',
        JSON.stringify({ lat: 41.2, lon: 13.57, nome: 'Gaeta', fonte: 'manuale' }));
      localStorage.setItem('astrocal_lingua', 'it');
    });
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => typeof skyDisegnaMare === 'function' &&
      typeof skyAria === 'function' && typeof Astronomy === 'object', null, { timeout: 40000 });
    await pagina.waitForTimeout(800);
    return pagina;
  }

  // Lo schermo della segnalazione è largo e basso (1580 × 450); il telefono
  // girato è la stessa forma. Si prova anche uno schermo in piedi.
  const SCHERMI = [{ W: 1580, H: 450 }, { W: 360, H: 640 }];
  const CASI = [];
  for (const s of SCHERMI) {
    for (const fov of [60, 85, 110, 150, 180]) {
      for (const altVista of [-20, 0.3, 8, 25]) {
        CASI.push({ ...s, fov, altVista, azVista: 180, scena: 'aperto' });
        CASI.push({ ...s, fov, altVista, azVista: 0, scena: 'costa' });
      }
    }
  }

  const pagina = await apri(null);
  let peggio = null, eccezioni = 0, sopraTot = 0, vuotiTot = 0, sottoTot = 0, sopraN = 0;
  for (const c of CASI) {
    const r = await pagina.evaluate(misura, c);
    if (r.eccezione) eccezioni++;
    sopraTot += r.sopraDipinti; sopraN += r.sopra; vuotiTot += r.sottoVuoti; sottoTot += r.sotto;
    const f = (r.sopraDipinti / Math.max(1, r.sopra)) + (r.sottoVuoti / Math.max(1, r.sotto));
    if (!peggio || f > peggio.f) peggio = { f, c, r };
  }
  console.log('\n— il mare, a qualunque campo —');
  prova('nessuna eccezione', eccezioni === 0, `${eccezioni} su ${CASI.length}`);
  prova('niente acqua sopra l\'orizzonte', sopraTot / Math.max(1, sopraN) < 0.002,
    `${sopraTot} pixel su ${sopraN}`);
  prova('l\'acqua copre il mare sotto l\'orizzonte', vuotiTot / Math.max(1, sottoTot) < 0.01,
    `${vuotiTot} buchi su ${sottoTot}`);
  prova('nemmeno il caso peggiore sbaglia', peggio.f < 0.03,
    `${peggio.c.scena} ${peggio.c.W}×${peggio.c.H} fov ${peggio.c.fov} alt ${peggio.c.altVista}: ` +
    `${peggio.r.sopraDipinti}/${peggio.r.sopra} sopra, ${peggio.r.sottoVuoti}/${peggio.r.sotto} buchi`);

  // Il contro-esempio: la segnalazione, com'era.
  let prima = null;
  try { prima = execSync('git show HEAD:app.js', { cwd: RADICE, maxBuffer: 1 << 28 }).toString(); }
  catch (e) { prima = null; }
  if (prima && prima !== fs.readFileSync(path.join(RADICE, 'app.js'), 'utf8')) {
    const pagina2 = await apri(prima);
    const r = await pagina2.evaluate(misura,
      { W: 1580, H: 450, fov: 85, altVista: 8, azVista: 180, scena: 'aperto' });
    console.log('\n— il contro-esempio (app.js prima della cura) —');
    prova('col conto di prima, a 85° il mare dipinge il cielo',
      r.sopraDipinti / Math.max(1, r.sopra) > 0.3,
      `${r.sopraDipinti} pixel di cielo su ${r.sopra}`);
  } else {
    console.log('\n  (contro-esempio saltato: app.js è identico a HEAD)');
  }

  console.log(`\n${passate} passate, ${fallite} fallite`);
  await browser.close();
  server.close();
  process.exit(fallite ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
