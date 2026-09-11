// Quanto costano le nuvole, in millisecondi per fotogramma.
//
//     npm install playwright-core astronomy-engine
//     node scripts/prova-nuvole.js
//
// Esiste per un difetto che nessun'altra prova di questo progetto poteva
// prendere, ed è quello che si scopre tardi e male. Da quando i banchi stanno
// su un piano e il vento li porta (§2-ter di `meteo-astro.js`) sono il triplo
// di prima e cambiano misura mentre si avvicinano: al primo tentativo la
// cache degli sprite sfondava il suo tetto in pixel e ricostruiva due sagome
// sfocate a ogni fotogramma. Misurato: **24,7 ms per fotogramma** contro gli
// 0,07 di prima, cioè trecentocinquanta volte tanto — e sullo schermo di chi
// l'ha scritto non si vedeva niente, perché il difetto non è un pixel storto
// ma un cielo che va a quindici fotogrammi al secondo su un telefono.
//
// Le prove del banco (`verifica.html` §33) dicono che le nuvole vanno **dove
// devono andare**; questa dice che ci vanno **senza far arrancare il
// planetario**, ed è una domanda che si può fare solo a un browser vero, con
// un canvas vero e la cache che si riempie davvero.
//
// Da sapere prima di leggere i numeri: qui il disegno è a software (niente
// GPU), quindi i millisecondi assoluti sono molto più alti che su un
// telefono. Quello che conta è il **rapporto** — fra prima e dopo, e fra il
// regime e il transitorio di una pizzicata.
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const RADICE = path.join(__dirname, '..');
const PORTA = 8101;
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

// I tetti. Sono larghi di proposito — su una macchina che disegna a software
// la misura balla — ma il difetto vero stava venti volte oltre.
const TETTO_REGIME = 1.5;      // ms per fotogramma, a cielo fermo
const TETTO_PIZZICATA = 2.5;   // ms per fotogramma, in media, mentre si zooma
const TETTO_PEGGIORE = 12;     // ms, il fotogramma peggiore di una pizzicata

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
function prova(nome, condizione, dettaglio) {
  condizione ? passate++ : fallite++;
  console.log(`  ${condizione ? 'ok     ' : 'FALLITO'}  ${nome}${dettaglio ? '   — ' + dettaglio : ''}`);
}

(async () => {
  await new Promise(r => server.listen(PORTA, r));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const contesto = await browser.newContext({ serviceWorkers: 'block',
    viewport: { width: 900, height: 700 } });
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on('pageerror', e => errori.push(e.message));

  const astronomy = path.join(RADICE, 'node_modules/astronomy-engine/astronomy.browser.min.js');
  if (!fs.existsSync(astronomy)) throw new Error('npm install astronomy-engine');
  await pagina.route('**/astronomy.browser.min.js', r =>
    r.fulfill({ body: fs.readFileSync(astronomy, 'utf8'), contentType: 'text/javascript' }));
  await pagina.route('**cdn.tailwindcss.com**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  // Nessuna rete vera: la previsione la mettiamo noi, così il conto parla del
  // disegno e non di quanto ci mette Open-Meteo a rispondere.
  await pagina.route('**open-meteo.com**', r => r.fulfill({ body: '{}', contentType: 'application/json' }));
  await pagina.route('**celestrak**', r => r.fulfill({ body: '', contentType: 'text/plain' }));
  await pagina.route('**overpass**', r => r.fulfill({ body: '{"elements":[]}', contentType: 'application/json' }));

  await pagina.goto(`http://localhost:${PORTA}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pagina.waitForTimeout(2500);

  const esito = await pagina.evaluate(() => {
    sky.posizione = { lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'utente' };
    if (typeof skyAggiornaOsservatore === 'function') skyAggiornaOsservatore();
    mostraVista('cielo');
    if (typeof apriSkymap === 'function') apriSkymap();
    sky.nuvole = true; sky.atmosfera = true;
    const luogo = skyLuogoDelCielo();
    if (!luogo || !sky.ctx) return { errore: 'niente luogo o niente tela' };

    // Un cielo coperto per bene, che è il caso peggiore: più copertura, più
    // banchi, più sagome da tenere in memoria.
    const T0 = Date.now() - 3 * 3600000;
    const ore = Array.from({ length: 48 }, (_, i) => ({
      ms: T0 + i * 3600000, totale: 62, basse: 58, medie: 45, alte: 38,
      vento: 30, ventoDa: 250, pioggia: 10, getto: 150, gettoDa: 280 }));
    meteoNuvoleCache.set(`${Number(luogo.lat).toFixed(2)},${Number(luogo.lon).toFixed(2)}`,
      { lat: luogo.lat, lon: luogo.lon, quando: Date.now(), ore });

    // Il ciclo del planetario gira per conto suo e falserebbe la misura: qui
    // si cronometra una funzione, non un'applicazione.
    if (typeof skySpegniCiclo === 'function') skySpegniCiclo();
    window.skyVigilaCicli = () => {};

    const ctx = sky.ctx;
    let banchi = 0;
    const veroBanco = window.meteoDipingiBancoNuvoloso;
    window.meteoDipingiBancoNuvoloso = function (...a) { banchi++; return veroBanco.apply(null, a); };
    const pulisci = () => {
      meteoNuvoleSprite.clear(); meteoNuvoleLuce.clear(); meteoNuvoleNube.clear();
      meteoNuvoleSpritePixel = 0;
    };
    const out = { campi: {} };

    for (const fov of [30, 60, 120, 180]) {
      sky.fov = fov;
      const base = skyBase(), F = skyFocale();
      // Ogni campo parte da una cache vuota e la si scalda per bene: quello
      // che si misura è il regime, non il primo arrivo.
      pulisci();
      for (let i = 0; i < 260; i++) meteoDisegnaNuvole(ctx, base, F, { luce: 0.8 });
      banchi = 0;
      const t0 = performance.now();
      for (let i = 0; i < 60; i++) meteoDisegnaNuvole(ctx, base, F, { luce: 0.8 });
      out.campi[fov] = { ms: (performance.now() - t0) / 60, banchi: banchi / 60,
        sprite: meteoNuvoleSprite.size, mpx: meteoNuvoleSpritePixel / 1e6 };
    }

    // La pizzicata, che è il transitorio vero: il campo scivola da 60° a 25°
    // in un secondo e **ogni** banco attraversa i gradini del raggio. È lì che
    // la cache degli sprite, se è fatta male, si mette a ricostruire tutto.
    pulisci();
    sky.fov = 60;
    for (let i = 0; i < 260; i++) meteoDisegnaNuvole(ctx, skyBase(), skyFocale(), { luce: 0.8 });
    let peggiore = 0, somma = 0;
    for (let i = 0; i < 60; i++) {
      sky.fov = 60 - (60 - 25) * i / 59;
      const base = skyBase(), F = skyFocale();
      const t = performance.now();
      meteoDisegnaNuvole(ctx, base, F, { luce: 0.8 });
      const dt = performance.now() - t;
      peggiore = Math.max(peggiore, dt); somma += dt;
    }
    out.pizzicata = { peggiore, media: somma / 60 };
    out.tettoPixel = METEO_NUVOLE_SPRITE_PIXEL_MAX / 1e6;
    window.meteoDipingiBancoNuvoloso = veroBanco;
    return out;
  });

  if (esito.errore) {
    console.log('non si è potuto misurare: ' + esito.errore);
    await browser.close(); server.close(); process.exit(1);
  }

  console.log('Il costo delle nuvole, a cielo fermo:');
  for (const [fov, c] of Object.entries(esito.campi)) {
    prova(`a ${fov}° di campo il fotogramma sta sotto il millisecondo e mezzo`,
      c.ms < TETTO_REGIME,
      `${c.ms.toFixed(2)} ms, ${c.banchi.toFixed(0)} banchi, ${c.sprite} sprite, ${c.mpx.toFixed(1)} Mpx`);
    // Se la memoria degli sprite è al tetto, la cache sta buttando via roba
    // che le serve fra un fotogramma e l'altro: è il difetto di sopra.
    prova(`…e la cache degli sprite non sfonda il suo tetto`,
      c.mpx < esito.tettoPixel * 0.9, `${c.mpx.toFixed(1)} su ${esito.tettoPixel} Mpx`);
  }
  console.log('E mentre si pizzica:');
  prova('la media di una pizzicata resta bassa', esito.pizzicata.media < TETTO_PIZZICATA,
    `${esito.pizzicata.media.toFixed(2)} ms per fotogramma`);
  prova('e nemmeno il fotogramma peggiore va fuori scala',
    esito.pizzicata.peggiore < TETTO_PEGGIORE, `${esito.pizzicata.peggiore.toFixed(2)} ms`);

  if (errori.length) {
    console.log('\nerrori in console:');
    errori.slice(0, 10).forEach(e => console.log('  ' + e));
  }
  console.log(`\nverdi: ${passate}   rosse: ${fallite}`);
  await browser.close();
  server.close();
  process.exit(fallite ? 1 : 0);
})();
