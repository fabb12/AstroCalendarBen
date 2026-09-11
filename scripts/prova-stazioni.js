/* «Vai al planetario» da una previsione di passaggio, in un browser vero.
 *
 * Perché ci vuole un browser: quello che questo tasto promette non è un
 * numero, è uno **stato del planetario** — l'orologio portato sull'istante
 * del passaggio, la mappa puntata dove sarà la stazione a quell'istante, e
 * l'inseguimento acceso perché non ci scappi via. Le tre cose vivono in
 * `sky`, e ci arrivano passando per `mostraVista`, `apriSkymap`,
 * `skyAggiornaOggetti` e il ciclo di disegno: fuori dalla pagina non c'è
 * niente da guardare.
 *
 * E soprattutto: a occhio questo tasto si giudica malissimo. Un planetario
 * aperto su un cielo stellato è convincente comunque, anche puntato
 * duecento gradi più in là della stazione — e chi guarda non ha modo di
 * sapere che quel pezzo di cielo non è quello giusto. Il difetto vero,
 * misurato qui sotto, era esattamente questo: le posizioni si leggevano
 * **prima** di rifarle per l'ora nuova, quindi la mappa si centrava su dove
 * la stazione stava un istante fa. Per un pianeta non si vedrebbe; una
 * stazione fa **un grado al secondo**.
 *
 * Serve, una volta sola:
 *     npm install playwright-core astronomy-engine satellite.js@5.0.0
 * Poi:
 *     node scripts/prova-stazioni.js
 */
'use strict';

const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROMIUM = process.env.CHROMIUM ||
  '/opt/pw-browsers/chromium/chrome-linux/chrome';
const RADICE = path.join(__dirname, '..');
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

function libreria(dove) {
  const f = path.join(RADICE, 'node_modules', dove);
  if (!fs.existsSync(f)) throw new Error('manca ' + dove + ': npm install playwright-core astronomy-engine satellite.js@5.0.0');
  return fs.readFileSync(f, 'utf8');
}

// Un TLE vero della ISS, e uno plausibile per la Tiangong. Non serve che
// siano di oggi: questa prova confronta i conti dell'app con sé stessi —
// «la mappa è puntata dove l'app dice che sta la stazione?» — non con
// l'orbita reale, che è materia di `verifica.html`.
const TLE = {
  astrocalendario_tle_iss: {
    riga1: '1 25544U 98067A   26060.51782528  .00016717  00000-0  10270-3 0  9004',
    riga2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537'
  },
  astrocalendario_tle_css: {
    riga1: '1 48274U 21035A   26060.50000000  .00013000  00000-0  15000-3 0  9990',
    riga2: '2 48274  41.4700 100.0000 0005000  90.0000 270.0000 15.60000000123456'
  }
};

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

// Lo scarto fra due azimut, sul giro: attraversando il nord la differenza
// grezza vale trecentocinquantotto gradi e non due.
const scartoAz = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

(async () => {
  await new Promise(r => server.listen(8126, r));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const contesto = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  const pagina = await contesto.newPage();
  pagina.on('pageerror', e => { console.log('  ECCEZIONE: ' + e.message); ko++; });

  // Le librerie del CDN da locale, la rete spenta: la prova riguarda il
  // nostro codice. L'ORDINE CONTA — quando più rotte combaciano vince
  // l'ULTIMA registrata, quindi il catch-all su jsdelivr va per primo o si
  // mangia satellite.js e non c'è più nessun passaggio da provare.
  await pagina.route('**cdn.tailwindcss.com**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**cdn.jsdelivr.net**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pagina.route('**/astronomy.browser.min.js', r =>
    r.fulfill({ body: libreria('astronomy-engine/astronomy.browser.min.js'), contentType: 'text/javascript' }));
  await pagina.route('**/satellite.min.js', r =>
    r.fulfill({ body: libreria('satellite.js/dist/satellite.min.js'), contentType: 'text/javascript' }));
  ['**open-meteo.com/**', '**noaa.gov/**', '**celestrak.org/**', '**overpass**',
   '**amazonaws**', '**ipapi**', '**ipwho**', '**geojs**', '**upload.wikimedia.org/**']
    .forEach(u => pagina.route(u, r => r.abort()));

  await pagina.goto('http://localhost:8126/index.html', { waitUntil: 'domcontentloaded' });
  await pagina.evaluate(tle => {
    localStorage.setItem('astrocalendario_posizione',
      JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
    // Le attese di questa prova sono in italiano, e senza una preferenza
    // salvata su una macchina di CI arriverebbe l'inglese.
    localStorage.setItem('astrocal_lingua', 'it');
    // Celestrak qui non si raggiunge: i dati orbitali si mettono a mano,
    // che è la stessa strada da cui l'app li rilegge senza rete.
    Object.keys(tle).forEach(k =>
      localStorage.setItem(k, JSON.stringify(Object.assign({ quando: Date.now() }, tle[k]))));
  }, TLE);
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(3000);

  // --- il tasto di un passaggio previsto -------------------------------
  console.log('\n— «Vai al planetario» da un passaggio previsto —');

  const passaggio = await pagina.evaluate(async () => {
    await aggiornaPassaggiSatelliti();
    const lista = passaggiVisibiliOrdinati();
    const p = lista.length ? lista[0] : Object.values(satPassaggi || {}).flat()[0];
    return p ? { satId: p.satId, culmine: p.culmine.getTime(), az: p.azCulmine, alt: p.elevazioneMax } : null;
  });
  ok('c\'è un passaggio da provare', !!passaggio,
    passaggio ? passaggio.satId + ', culmine a ' + new Date(passaggio.culmine).toISOString() : '');
  if (!passaggio) { await browser.close(); server.close(); process.exit(1); }

  const eventiStazioni = await pagina.evaluate(() => eventiCalcolati
    .filter(e => e.categoria === 'stazioni')
    .map(e => ({
      id: e.id, satId: e.stazione && e.stazione.satId,
      visibile: e.stazione && e.stazione.visibile,
      illuminata: e.stazione && e.stazione.illuminata,
      alBuio: e.stazione && e.stazione.alBuio,
      strumento: strumentoEvento(e)
    })));
  ok('i passaggi entrano negli eventi da osservare', eventiStazioni.length > 0,
    `${eventiStazioni.length} eventi`);
  ok('negli eventi entrano solo passaggi illuminati e col cielo buio',
    eventiStazioni.every(e => e.visibile && e.illuminata && e.alBuio));
  ok('ISS e Tiangong sono eventi a occhio nudo',
    eventiStazioni.every(e => e.strumento === 'occhio'));

  const stato = () => pagina.evaluate(() => {
    const o = skyVoceDiId(sky.target);
    return {
      vista: vistaAttuale,
      offsetSec: sky.offsetTempoSec,
      modalita: sky.modalitaTempo,
      target: sky.target,
      inseguimento: sky.inseguimento,
      seguiTelefono: sky.seguiTelefono,
      mostraSatelliti: sky.mostraSatelliti,
      oggetto: o && typeof o.az === 'number' ? { az: o.az, alt: o.alt } : null,
      vistaAz: sky.manuale.az,
      vistaAlt: sky.manuale.alt,
      avviso: (document.getElementById('skymap-avviso') || {}).textContent || ''
    };
  });

  // Si parte da Stasera, che è da dove il tasto si preme davvero — e non è
  // un dettaglio: `mostraVista('cielo')`, arrivando da un'altra vista,
  // riporta l'orologio al tempo reale. Provando il tasto col planetario già
  // davanti quella riga non gira, e la prova diventa cieca proprio sul
  // difetto che deve prendere.
  await pagina.evaluate(q => {
    mostraVista('stasera');
    vaiAlPassaggioSatellite(q.satId, q.culmine);
  }, passaggio);
  await pagina.waitForTimeout(900);
  let s = await stato();

  ok('apre il planetario', s.vista === 'cielo', s.vista);
  ok('l\'orologio va sul culmine',
    Math.abs(s.offsetSec - Math.round((passaggio.culmine - Date.now()) / 1000)) <= 5,
    `${Math.round(s.offsetSec)} s di scarto dal tempo reale`);
  ok('la stazione è il bersaglio', s.target === 'sat-' + passaggio.satId, String(s.target));
  ok('l\'inseguimento è acceso da sé', s.inseguimento === true);
  ok('il filtro delle stazioni è acceso', s.mostraSatelliti === true);
  ok('la stazione è in cielo a quell\'istante', !!s.oggetto,
    s.oggetto ? `az ${s.oggetto.az.toFixed(1)}° alt ${s.oggetto.alt.toFixed(1)}°` : 'assente');
  if (s.oggetto) {
    ok('la mappa è puntata su di lei',
      scartoAz(s.vistaAz, s.oggetto.az) < 1.5 && Math.abs(s.vistaAlt - s.oggetto.alt) < 1.5,
      `${scartoAz(s.vistaAz, s.oggetto.az).toFixed(2)}° in azimut, ${Math.abs(s.vistaAlt - s.oggetto.alt).toFixed(2)}° in altezza`);
    // Il numero che conta: la posizione dev'essere quella del **culmine**,
    // cioè quella scritta nella scheda di Stasera, non quella di adesso.
    ok('ed è la posizione del culmine, non quella di adesso',
      scartoAz(s.oggetto.az, passaggio.az) < 12 && Math.abs(s.oggetto.alt - passaggio.alt) < 12,
      `la scheda diceva az ${passaggio.az.toFixed(1)}°, alt ${passaggio.alt.toFixed(1)}°`);
  }
  ok('e lo dice a chi guarda', /verso|orizzonte|orbitali/i.test(s.avviso), s.avviso.slice(0, 100));

  // --- l'inseguimento serve proprio a questo -----------------------------
  console.log('\n— l\'inseguimento tiene il centro mentre il tempo cammina —');
  const dopo = await pagina.evaluate(() => {
    skyImpostaOffsetTempo(sky.offsetTempoSec + 60);
    return new Promise(r => setTimeout(() => {
      const o = skyVoceDiId(sky.target);
      r({ az: o ? o.az : null, alt: o ? o.alt : null, vAz: sky.manuale.az, vAlt: sky.manuale.alt });
    }, 300));
  });
  ok('un minuto dopo è ancora al centro',
    dopo.az != null && scartoAz(dopo.vAz, dopo.az) < 1.5 && Math.abs(dopo.vAlt - dopo.alt) < 1.5,
    dopo.az == null ? 'stazione assente' : `${scartoAz(dopo.vAz, dopo.az).toFixed(2)}° di scarto`);

  // --- «Dov'è ora»: lo stesso tasto, con l'orologio di adesso -----------
  console.log('\n— «Dov\'è ora» —');
  await pagina.evaluate(satId => {
    mostraVista('stasera');
    cercaSatelliteNelCielo(satId);
  }, passaggio.satId);
  await pagina.waitForTimeout(500);
  s = await stato();
  ok('l\'orologio torna al tempo reale', Math.abs(s.offsetSec) < 2 && s.modalita === 'reale',
    `${s.offsetSec} s, modalità ${s.modalita}`);
  ok('la stazione resta il bersaglio, inseguita',
    s.target === 'sat-' + passaggio.satId && s.inseguimento === true);

  // --- la seconda volta, col planetario già aperto -----------------------
  //   È il caso vero, ed è quello in cui il difetto viveva: alla **prima**
  //   apertura `apriSkymap` rifà da sé le posizioni e il centraggio veniva
  //   giusto per caso; tornando a Stasera e ripremendo il tasto, `apriSkymap`
  //   esce subito e restava la posizione dell'ora di prima.
  console.log('\n— di nuovo, col planetario già aperto —');
  await pagina.evaluate(q => vaiAlPassaggioSatellite(q.satId, q.culmine), passaggio);
  await pagina.waitForTimeout(700);
  s = await stato();
  ok('la mappa è puntata sulla stazione anche adesso',
    !!s.oggetto && scartoAz(s.vistaAz, s.oggetto.az) < 1.5 && Math.abs(s.vistaAlt - s.oggetto.alt) < 1.5,
    s.oggetto ? `${scartoAz(s.vistaAz, s.oggetto.az).toFixed(2)}° di scarto` : 'stazione assente');

  // --- con la bussola accesa la vista si sgancia -------------------------
  //   Con «Segui il telefono» acceso la direzione la decide la bussola:
  //   nessun centraggio vale, e l'inseguimento non ha niente da guidare.
  console.log('\n— con la bussola accesa la vista si sgancia da sé —');
  const sganciata = await pagina.evaluate(q => {
    sky.sensori = true;
    sky.seguiTelefono = true;
    skyBussola.euleri = { alpha: 30, beta: 60, gamma: 0 };
    skyBussola.quandoE = performance.now();
    skyBussola.eulAssoluti = true;
    if (!skyUsaSensori()) return { pronta: false };
    vaiAlPassaggioSatellite(q.satId, q.culmine);
    return new Promise(r => setTimeout(() => r({
      pronta: true, segui: sky.seguiTelefono, insegue: sky.inseguimento
    }), 400));
  }, passaggio);
  ok('i sensori risultano davvero attivi', sganciata.pronta === true);
  ok('«Segui il telefono» si spegne', sganciata.segui === false);
  ok('e l\'inseguimento resta acceso', sganciata.insegue === true);

  console.log(ko ? `\n✗ ${ko} prove fallite` : '\n✓ tutte le prove passate');
  await browser.close();
  server.close();
  process.exit(ko ? 1 : 0);
})();
