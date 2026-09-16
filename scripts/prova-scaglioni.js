// Il cielo calcolato a scaglioni deve essere lo stesso di prima.
//
// Due pezzi del planetario hanno smesso di fare tutto il loro lavoro dentro
// a un fotogramma solo — il giro degli astri (`skyAggiornaOggetti`, §7.2 di
// `app.js`) e le comete con gli asteroidi (`corpiMinoriVisibili`, §5 di
// `corpi-minori.js`) — e lavorano invece per qualche millisecondo per volta,
// cedendo il turno al disegno. È il rimedio alla segnalazione «la camera si
// muove a scatti»: quei due giri costavano decine di millisecondi tutti
// insieme, cioè due o tre fotogrammi persi ogni secondo su un telefono
// lento, e un fotogramma perso ogni secondo non si legge come «è lento», si
// legge come «scatta».
//
// Il guaio di un lavoro a scaglioni è che si giudica malissimo a occhio: un
// elenco di astri sbagliato è un cielo perfettamente plausibile, solo che
// Saturno è dov'era mezzo secondo fa — e se lo scaglione cadesse nel punto
// sbagliato metà elenco racconterebbe un istante e metà un altro, che a
// guardarlo è ancora un cielo. Il giudice è quindi l'aritmetica: le due
// strade, a scaglioni e tutta in un colpo, devono dare **gli stessi
// numeri**. È la stessa garanzia che il §20 di `verifica.html` chiede
// all'acqua e `scripts/prova-transiti.js` alla scansione delle stazioni.
//
//     npm install playwright-core astronomy-engine
//     node scripts/prova-scaglioni.js

const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROMIUM = process.env.CHROMIUM ||
  '/opt/pw-browsers/chromium/chrome-linux/chrome';
const RADICE = path.join(__dirname, '..');
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

function leggiAstronomy() {
  const posti = [
    process.env.ASTRONOMY_JS,
    path.join(RADICE, 'node_modules', 'astronomy-engine', 'astronomy.browser.min.js')
  ].filter(Boolean);
  for (const p of posti) if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  throw new Error('Astronomy Engine non trovata: npm install astronomy-engine');
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

(async () => {
  await new Promise(r => server.listen(8131, r));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const contesto = await browser.newContext({ serviceWorkers: 'block',
    viewport: { width: 412, height: 915 } });
  const pagina = await contesto.newPage();
  const eccezioni = [];
  pagina.on('pageerror', e => eccezioni.push(e.message));

  await pagina.route('**cdn.tailwindcss.com**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**cdn.jsdelivr.net**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pagina.route('**/astronomy.browser.min.js', r =>
    r.fulfill({ body: leggiAstronomy(), contentType: 'text/javascript' }));
  // La rete non c'entra con questa prova, e una richiesta che pende sposta i
  // tempi: si chiude tutto quello che non serve.
  for (const p of ['**/api.open-meteo.com/**', '**/air-quality-api.open-meteo.com/**',
    '**/services.swpc.noaa.gov/**', '**/celestrak.org/**', '**ipapi**', '**ipwho**',
    '**geojs**', '**overpass**', '**elevation**', '**amazonaws**', '**adsb**',
    '**nominatim**', '**bigdatacloud**']) await pagina.route(p, r => r.abort());

  await pagina.goto('http://localhost:8131/index.html', { waitUntil: 'networkidle', timeout: 30000 });
  await pagina.evaluate(() => {
    localStorage.setItem('astrocalendario_posizione',
      JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
    localStorage.setItem('astrocal_lingua', 'it');
  });
  await pagina.reload({ waitUntil: 'networkidle' });
  await pagina.waitForTimeout(1500);
  await pagina.evaluate(() => { mostraVista('cielo'); });
  await pagina.waitForTimeout(4000);

  let ko = 0;
  const ok = (n, c, x) => {
    console.log((c ? '  ok        ' : '  FALLITO   ') + n + (x ? '   — ' + x : ''));
    if (!c) ko++;
  };

  // --- gli astri ---------------------------------------------------------
  console.log('\n— il giro degli astri —');

  // Il giro si spezza quando finisce il tempo dello scaglione, e su un
  // computer da scrivania diciassette corpi ci stanno dentro tutti: per
  // provare la macchina bisogna rallentarla, e allora si rallenta la
  // libreria — un millesimo di secondo per corpo, che è quello che costa
  // davvero su un telefono di quattro anni fa.
  await pagina.addInitScript(() => { window.__rallentaAstri = 0; });
  const astri = await pagina.evaluate(async () => {
    // Una notte, così in cielo c'è qualcosa
    const ora = new Date(); const notte = new Date(ora); notte.setHours(23, 30, 0, 0);
    skyImpostaOffsetTempo((notte - ora) / 1000);

    // (1) la strada di sempre: `forza` fa tutto in un colpo
    skyAggiornaOggetti(true);
    const intero = sky.oggetti.map(o => [o.id, o.az, o.alt, o.mag, o.ra, o.dec]);
    const lavoroDopoForza = sky.lavoroAstri;

    // (2) la strada a scaglioni, col freno addosso: un corpo per volta
    // costa più di tutto lo scaglione, quindi il giro si spezza per forza.
    const equatoreVero = Astronomy.Equator;
    Astronomy.Equator = function (...a) {
      const fine = performance.now() + 1;
      while (performance.now() < fine) { /* il tempo che ci mette un telefono */ }
      return equatoreVero.apply(this, a);
    };
    sky.prossimoCalcolo = 0;
    const elencoPrima = sky.oggetti;
    let giri = 0, restatoFermo = true, sostituitoAMeta = false;
    while (giri < 200) {
      skyAggiornaOggetti(false);
      giri++;
      if (!sky.lavoroAstri) break;
      // Finché il giro è a metà, in scena deve esserci ancora l'elenco di
      // prima — mai uno mezzo vecchio e mezzo nuovo.
      if (sky.oggetti !== elencoPrima) { restatoFermo = false; sostituitoAMeta = true; }
      sky.prossimoCalcolo = 0;
    }
    Astronomy.Equator = equatoreVero;
    const aScaglioni = sky.oggetti.map(o => [o.id, o.az, o.alt, o.mag, o.ra, o.dec]);

    return {
      quanti: intero.length,
      giri,
      restatoFermo,
      sostituitoAMeta,
      lavoroDopoForza,
      uguali: JSON.stringify(intero) === JSON.stringify(aScaglioni),
      primoDiverso: intero.findIndex((v, i) =>
        JSON.stringify(v) !== JSON.stringify(aScaglioni[i]))
    };
  });

  ok('il giro forzato riempie l\'elenco tutto in un colpo',
    astri.quanti > 5 && astri.lavoroDopoForza === null,
    `${astri.quanti} astri, nessun lavoro lasciato a metà`);
  ok('a scaglioni ci vuole più di un fotogramma', astri.giri > 1, `${astri.giri} giri`);
  ok('le due strade danno gli stessi numeri', astri.uguali,
    astri.uguali ? 'cifra per cifra' : `primo diverso all'indice ${astri.primoDiverso}`);

  // L'elenco in scena non deve mai essere mezzo vecchio e mezzo nuovo: finché
  // il giro nuovo non è completo si continua a mostrare quello di prima. È la
  // differenza fra un cielo di due fotogrammi fa e un collage di due istanti.
  ok('mentre il giro è a metà resta in scena l\'elenco di prima',
    astri.restatoFermo,
    astri.sostituitoAMeta ? 'elenco sostituito a metà' : 'nessun elenco parziale disegnato');

  // Cambiare posto butta il giro cominciato: metà elenco calcolato da qui e
  // metà da mille chilometri più in là non è il cielo di nessuno dei due.
  const altrove = await pagina.evaluate(async () => {
    const equatoreVero = Astronomy.Equator;
    Astronomy.Equator = function (...a) {
      const fine = performance.now() + 1;
      while (performance.now() < fine) { /* il freno */ }
      return equatoreVero.apply(this, a);
    };
    skyAggiornaOggetti(true);
    sky.prossimoCalcolo = 0;
    skyAggiornaOggetti(false);
    const aMeta = sky.lavoroAstri ? sky.lavoroAstri.i : -1;
    const ossPrima = sky.observer;
    sky.observer = new Astronomy.Observer(69.65, 18.96, 10);   // Tromsø
    skyAggiornaOggetti(false);
    const ricominciato = !!(sky.lavoroAstri && sky.lavoroAstri.oss === sky.observer);
    Astronomy.Equator = equatoreVero;
    sky.observer = ossPrima;
    skyAggiornaOggetti(true);
    return { aMeta, ricominciato };
  });
  ok('un giro cominciato altrove si butta invece di finirlo',
    altrove.aMeta > 0 && altrove.ricominciato,
    `fermo al corpo ${altrove.aMeta}, poi ricominciato dal punto nuovo`);

  // --- le comete e gli asteroidi -----------------------------------------
  console.log('\n— le comete e gli asteroidi —');

  const corpi = await pagina.evaluate(async () => {
    sky.mostraCorpiMinori = true;
    // Si riparte da zero e si gira finché l'elenco non è completo
    let giri = 0;
    const primo = corpiMinoriVisibili();
    while (giri < 300) {
      const e = corpiMinoriVisibili();
      giri++;
      if (e.length && e !== primo) break;
      if (!e.length && giri > 200) break;
    }
    const elenco = corpiMinoriVisibili();
    return {
      giri,
      quanti: elenco.length,
      // Tutti allo stesso istante: un elenco in cui il primo corpo è di mezzo
      // secondo prima dell'ultimo non è un cielo, è un collage.
      tuttiCoiCampi: elenco.every(c =>
        typeof c.az === 'number' && typeof c.alt === 'number' &&
        typeof c.mag === 'number' && c.nome && c.disegno),
      ordinati: elenco.every((c, i) => i === 0 || elenco[i - 1].mag <= c.mag),
      sottoIlLimite: elenco.every(c => c.mag <= 12.5)
    };
  });

  ok('l\'elenco arriva, e non in un fotogramma solo', corpi.quanti > 0 && corpi.giri > 1,
    `${corpi.quanti} corpi in ${corpi.giri} giri`);
  ok('ogni voce porta tutto quello che serve a disegnarla', corpi.tuttiCoiCampi);
  ok('l\'elenco resta ordinato per magnitudine', corpi.ordinati);
  ok('non entra niente sotto il limite utile', corpi.sottoIlLimite);

  // IL DIFETTO CHE QUESTA PROVA ESISTE PER PRENDERE.
  //
  // La cache di prima si teneva l'`offsetTempoSec` e voleva che fosse
  // identico. Col playback acceso quell'offset cambia a ogni fotogramma,
  // quindi la cache non prendeva **mai**: sessanta corpi rifatti da capo
  // sessanta volte al secondo, con Keplero dentro. E il sintomo non era un
  // errore — era il cielo che scatta.
  const conPlayback = await pagina.evaluate(async () => {
    sky.mostraCorpiMinori = true;
    corpiMinoriVisibili();
    let giri = 0;
    while (sky.lavoroAstri || giri < 40) { corpiMinoriVisibili(); if (++giri > 400) break; }

    // Si simula il playback. L'orologio del planetario NON si sposta
    // scrivendo `sky.offsetTempoSec`: quello è una lettura derivata, e
    // `skyAdesso()` lo riscrive da `sky.istanteSimulatoMs` a ogni chiamata.
    // A muoverlo davvero è `skyImpostaOffsetTempo`, ed è la stessa riga che
    // il playback esegue a ogni fotogramma — cioè il caso in cui la cache
    // di prima non prendeva mai.
    const partenza = sky.offsetTempoSec || 0;
    let lavori = 0, nelGiro = 0, peggiore = 0;
    const origPasso = window.corpiPasso;
    // Il freno: su un computer da scrivania sessantuno corpi ci stanno
    // dentro allo scaglione tutti insieme, e la macchina non si mette mai
    // alla prova. Mezzo millesimo per corpo è quello che costano su un
    // telefono, ed è lì che lo scaglione deve mordere.
    window.corpiPasso = function (...a) {
      lavori++; nelGiro++;
      const fine = performance.now() + 0.5;
      while (performance.now() < fine) { /* il tempo di un telefono */ }
      return origPasso.apply(this, a);
    };
    for (let i = 0; i < 60; i++) {
      skyImpostaOffsetTempo(partenza + i * 60);   // un minuto di cielo per fotogramma
      nelGiro = 0;
      corpiMinoriVisibili();
      if (nelGiro > peggiore) peggiore = nelGiro;
    }
    window.corpiPasso = origPasso;
    skyImpostaOffsetTempo(partenza);
    return { lavori, peggiore, corpiInCatalogo: corpiMinoriTutti().length };
  });
  const senzaCache = conPlayback.corpiInCatalogo * 60;
  ok('col playback non si rifà tutto a ogni fotogramma',
    conPlayback.lavori < senzaCache / 2,
    `${conPlayback.lavori} corpi calcolati in 60 fotogrammi, contro i ${senzaCache} della regola di prima`);
  // È QUESTA la prova che risponde alla segnalazione. Il totale conta poco:
  // quello che si vede è il **fotogramma peggiore**, e prima il peggiore era
  // il catalogo intero — sessantuno corpi con Keplero dentro, tutti fra un
  // disegno e l'altro. Adesso nessun fotogramma si prende più di uno
  // scaglione, e il resto lo finisce quello dopo.
  ok('nessun fotogramma si fa tutto il catalogo da solo',
    conPlayback.peggiore < conPlayback.corpiInCatalogo,
    `il fotogramma peggiore ne calcola ${conPlayback.peggiore} su ${conPlayback.corpiInCatalogo}`);

  // E un salto vero nel tempo la cache la deve invece buttare: una posizione
  // di stamattina, stasera, non vale niente.
  const salto = await pagina.evaluate(async () => {
    sky.mostraCorpiMinori = true;
    const partenza = sky.offsetTempoSec || 0;
    let giri = 0;
    while (giri++ < 600) { corpiMinoriVisibili(); if (!corpiLavoro) break; }
    const prima = corpiMinoriVisibili().map(c => ({ nome: c.nome, az: c.az, alt: c.alt }));
    skyImpostaOffsetTempo(partenza + 90 * 86400);   // tre mesi più in là
    giri = 0;
    while (giri++ < 600) { corpiMinoriVisibili(); if (!corpiLavoro) break; }
    const dopo = corpiMinoriVisibili().map(c => ({ nome: c.nome, az: c.az, alt: c.alt }));
    skyImpostaOffsetTempo(partenza);
    const coppie = prima.filter(a => dopo.some(b => b.nome === a.nome));
    return {
      cambiato: coppie.length > 0,
      mosso: coppie.some(a => {
        const b = dopo.find(x => x.nome === a.nome);
        return Math.abs(b.az - a.az) > 0.5 || Math.abs(b.alt - a.alt) > 0.5;
      })
    };
  });
  ok('tre mesi più in là le posizioni sono altre', salto.cambiato && salto.mosso);

  ok('nessuna eccezione dalla pagina', eccezioni.length === 0, eccezioni.join(' | '));

  console.log(ko ? `\n${ko} prove fallite\n` : '\nTutte le prove sono verdi\n');
  await browser.close();
  server.close();
  process.exit(ko ? 1 : 0);
})();
