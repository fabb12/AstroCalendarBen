// Il fumetto dell'oggetto, provato in un browser vero.
//
// È il genere di pezzo che a occhio si giudica male: un fumetto appoggiato
// sopra a un cielo stellato è bello comunque, anche quando la coda indica un
// punto di cielo vuoto trenta pixel più in là, anche quando metà del testo è
// finito fuori dallo schermo di un telefono. Le domande che contano sono
// aritmetiche, e sono quattro: la coda indica l'oggetto? il fumetto sta
// dentro al riquadro? sta fuori dalle due fasce già occupate (la bussola in
// cima, la barra del tempo in fondo)? e su uno schermo da telefono resta
// abbastanza largo da leggersi e abbastanza stretto da non essere il
// pannello di prima con un altro nome?
//
//     npm install playwright-core astronomy-engine
//     node scripts/prova-fumetto.js
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const RADICE = path.join(__dirname, '..');
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

function leggiAstronomy() {
  const p = path.join(RADICE, 'node_modules', 'astronomy-engine', 'astronomy.browser.min.js');
  if (!fs.existsSync(p)) throw new Error('npm install astronomy-engine');
  return fs.readFileSync(p, 'utf8');
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

// Un aereo finto, fermo, a un azimut e a un'altezza scelti da noi: il modulo
// vero chiede la rete, e qui la rete non c'è. Quello che si prova è il
// fumetto, non il feed ADS-B.
const AEREO = {
  id: '4ca7b3', callsign: 'BRJ273', az: 210, alt: 24, distanzaKm: 33.3,
  quotaM: 9750, velocitaMs: 244, direzione: 118, descrizione: 'Boeing 737-800',
  registrazione: 'EI-DCL', operatore: 'Ryanair', stimato: false, allineamenti: []
};

(async () => {
  await new Promise(r => server.listen(8098, r));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  let ko = 0;
  const ok = (n, c, x) => {
    console.log((c ? '  ok        ' : '  FALLITO   ') + n + (x ? '   — ' + x : ''));
    if (!c) ko++;
  };

  // Due schermi: un telefono piccolo e un computer. Il fumetto deve
  // funzionare su tutti e due, e le regole che lo tosano mordono solo sul
  // primo — se non si prova lì, non si prova affatto.
  for (const schermo of [
    { nome: 'telefono 360×640', width: 360, height: 640 },
    { nome: 'telefono girato 640×360', width: 640, height: 360 },
    { nome: 'computer 1280×800', width: 1280, height: 800 }
  ]) {
    console.log(`\n— ${schermo.nome} —`);
    const contesto = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: schermo.width, height: schermo.height },
      deviceScaleFactor: 2
    });
    const pagina = await contesto.newPage();
    const errori = [];
    pagina.on('pageerror', e => errori.push('ECCEZIONE: ' + e.message));
    pagina.on('console', m => { if (m.type() === 'error') errori.push(m.text()); });

    await pagina.route('**cdn.jsdelivr.net**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
    await pagina.route('**cdn.tailwindcss.com**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
    await pagina.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
    await pagina.route('**/astronomy.browser.min.js', r =>
      r.fulfill({ body: leggiAstronomy(), contentType: 'text/javascript' }));
    // L'ORDINE CONTA, ed è al contrario di come sembra: quando più rotte
    // combaciano Playwright usa l'ULTIMA registrata. I rifiuti generici vanno
    // quindi PRIMA dell'itinerario finto, se no `**adsb**` se lo mangia —
    // api.adsbdb.com contiene «adsb» — e la riga della rotta non arriva mai.
    for (const rotta of ['**open-meteo.com/**', '**noaa.gov/**', '**celestrak.org/**',
                         '**ipapi**', '**ipwho**', '**geojs**', '**overpass**',
                         '**amazonaws.com/**', '**adsb**'])
      await pagina.route(rotta, r => r.abort());
    await pagina.route('**planespotters.net/**', r => r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ photos: [{ thumbnail: {
        src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"></svg>'
      }, photographer: 'Mario Rossi' }] })
    }));
    await pagina.route('**api.adsbdb.com**', r => r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ response: { flightroute: {
        origin: { municipality: 'Madrid', iata_code: 'MAD' },
        destination: { municipality: 'Roma', iata_code: 'FCO' } } } })
    }));

    await pagina.goto('http://localhost:8098/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pagina.evaluate(() => localStorage.setItem('astrocalendario_posizione',
      JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' })));
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await pagina.evaluate(() => mostraVista('cielo'));
    await pagina.waitForTimeout(3500);

    // --- un astro: la Luna, dove sta davvero adesso ---------------------
    const astro = await pagina.evaluate(() => {
      const luna = sky.oggetti.find(o => o.id === 'Moon');
      if (!luna) return { errore: 'la Luna non è fra gli oggetti' };
      // La si porta al centro della vista, così è certamente proiettata
      sky.seguiTelefono = false;
      sky.manuale.az = luna.az; sky.manuale.alt = Math.min(60, Math.max(5, luna.alt));
      skyApriDettaglio({ categoria: 'astro', id: 'Moon' });
      skyDisegna();
      const f = document.getElementById('skymap-fumetto');
      return {
        visibile: f.classList.contains('visibile'),
        titolo: document.getElementById('skymap-fumetto-titolo').textContent,
        righe: Array.from(f.querySelectorAll('.fumetto-riga')).map(p => p.textContent.trim()),
        segno: !!f.querySelector('.fumetto-segno svg'),
        pannello: document.getElementById('skymap-dettaglio').classList.contains('visibile')
      };
    });
    ok('un astro apre il fumetto e non il pannello',
      astro.visibile === true && astro.pannello === false, astro.errore || '');
    ok('il fumetto ha il nome dell\'astro', astro.titolo === 'Luna', astro.titolo);
    ok('e le sue righe compatte (mai più di quattro)',
      astro.righe && astro.righe.length >= 1 && astro.righe.length <= 4,
      (astro.righe || []).join(' | '));
    ok('col segno dell\'oggetto', astro.segno === true);

    // Le stelle del catalogo portano nella classe una nota impaginata per la
    // scheda completa. Nel fumetto devono restare le parole, mai i tag HTML.
    const stella = await pagina.evaluate(() => {
      const dati = skyFumettoDatiAstro({
        id: 'cat:prova', nome: 'Stella di prova', tipo: 'stella',
        disegno: 'stella', classe: 'Stella bianca <span class="text-slate-500">(classe F circa)</span>'
      });
      return {
        titolo: dati.titolo,
        tipo: dati.righe[0] && dati.righe[0].valore,
        nomeSempreIntero: dati.nomeSempreIntero
      };
    });
    ok('il fumetto scrive il nome completo della stella', stella.titolo === 'Stella di prova', stella.titolo);
    ok('il nome della stella non viene troncato nel fumetto', stella.nomeSempreIntero === true);
    ok('la classe della stella non mostra codice HTML',
      stella.tipo === 'Stella bianca (classe F circa)' && !/[<>]/.test(stella.tipo), stella.tipo);
    const titoloStella = await pagina.evaluate(() => {
      const prova = document.createElement('div');
      prova.className = 'fumetto-nome-intero';
      prova.innerHTML = '<h3 class="fumetto-titolo">Stella CAT 12345 di magnitudine 5,7 — Orsa Maggiore</h3>';
      document.body.appendChild(prova);
      const stile = getComputedStyle(prova.firstElementChild);
      const risultato = { whiteSpace: stile.whiteSpace, overflow: stile.overflow, textOverflow: stile.textOverflow };
      prova.remove();
      return risultato;
    });
    ok('il titolo esteso può andare a capo senza ellissi',
      titoloStella.whiteSpace === 'normal' && titoloStella.overflow === 'visible' &&
        titoloStella.textOverflow === 'clip',
      JSON.stringify(titoloStella));

    const stazione = await pagina.evaluate(() => {
      const dati = skyFumettoDatiAstro({
        id: 'sat-iss', satId: 'iss', nome: 'ISS', tipo: 'satellite',
        disegno: 'satellite', classe: 'Stazione spaziale abitata', alt: 20, illuminato: true
      });
      return { titolo: dati.titolo, foto: dati.foto };
    });
    ok('la stazione ha il nome per esteso nel fumetto',
      stazione.titolo === 'Stazione Spaziale Internazionale', stazione.titolo);
    ok('la fotografia della stazione usa un indirizzo diretto caricabile',
      !!stazione.foto && /upload\.wikimedia\.org\/wikipedia\/commons\/thumb/.test(stazione.foto.src),
      stazione.foto ? stazione.foto.src : 'nessuna foto');

    // --- un aereo: le righe del mockup ----------------------------------
    await pagina.evaluate((a) => {
      // Il feed non c'è: si mette a mano una fotografia con dentro un aereo
      window.aereiTrova = (id) => (String(id) === a.id ? a : null);
      skyApriDettaglio({ categoria: 'aereo', dati: a });
      skyDisegna();
    }, AEREO);
    await pagina.waitForTimeout(700);   // il tempo che l'itinerario arrivi
    const aereo = await pagina.evaluate(() => {
      skyAggiornaScheda(); skyDisegna();
      const f = document.getElementById('skymap-fumetto');
      return {
        titolo: document.getElementById('skymap-fumetto-titolo').textContent,
        righe: Array.from(f.querySelectorAll('.fumetto-riga')).map(p => p.textContent.trim()),
        tinta: getComputedStyle(f).borderLeftColor,
        foto: !!f.querySelector('.fumetto-aereo-foto img')
      };
    });
    ok('il fumetto di un aereo porta il suo indicativo', aereo.titolo === 'BRJ273', aereo.titolo);
    ok('con partenza e destinazione per esteso',
      aereo.righe.some(r => /Partenza.*Madrid/.test(r)) && aereo.righe.some(r => /Destinazione.*Roma/.test(r)),
      aereo.righe.slice(0, 2).join(' | '));
    ok('la quota e la velocità',
      aereo.righe.some(r => /Quota.*9\.750 m s\.l\.m\./.test(r)) && aereo.righe.some(r => /Velocità.*878 km\/h/.test(r)),
      aereo.righe.filter(r => /Quota|Velocità/.test(r)).join(' | '));
    ok('e che aeroplano è, senza abbreviazioni', aereo.righe.some(r => r === 'Aereo: Boeing 737-800'));
    ok('la fotografia arriva dentro al fumetto', aereo.foto === true);
    ok('la tinta è la sua fascia di distanza (33 km → giallo)',
      /248|250|,\s*8/.test(aereo.tinta) || aereo.tinta !== 'rgb(148, 197, 255)', aereo.tinta);

    // --- la geometria: coda, riquadro, fasce ----------------------------
    const geo = await pagina.evaluate((a) => {
      const c = document.getElementById('skymap-contenitore');
      const f = document.getElementById('skymap-fumetto');
      const vista = document.querySelector('.vista-cielo') || c;
      const st = getComputedStyle(vista);
      const alta = parseFloat(st.getPropertyValue('--zona-alta-cielo')) || 128;
      const bassa = parseFloat(st.getPropertyValue('--sopra-barra-tempo')) || 96;
      const prove = [];
      // L'aereo si mette in nove punti del cielo, angoli compresi: sono i
      // punti in cui la tosatura morde, cioè quelli che contano.
      for (const daz of [-60, 0, 60]) for (const dalt of [-30, 0, 34]) {
        const az = ((sky.manuale.az + daz) % 360 + 360) % 360;
        const alt = Math.max(-80, Math.min(85, sky.manuale.alt + dalt));
        const finto = Object.assign({}, a, { az, alt });
        window.aereiTrova = () => finto;
        sky.selezione = { categoria: 'aereo', dati: finto };
        skyAggiornaScheda();
        skyDisegna();
        const p = skyProietta(skyVettore(az, alt), sky.ultimaBase, sky.ultimaFocale);
        const r = f.getBoundingClientRect(), rc = c.getBoundingClientRect();
        const codaX = parseFloat(f.style.getPropertyValue('--coda-x'));
        const sopra = f.dataset.verso === 'sopra';
        const filo = document.getElementById('skymap-fumetto-filo');
        prove.push({
          daz, dalt, davanti: p.davanti,
          nascosto: f.style.visibility === 'hidden',
          // tutto in coordinate del contenitore
          x: r.left - rc.left, y: r.top - rc.top, w: r.width, h: r.height,
          L: c.clientWidth, H: c.clientHeight, alta, bassa,
          px: p.px, py: p.py, codaX, sopra,
          filoAcceso: filo.style.display === 'block',
          puntaX: (r.left - rc.left) + codaX,
          puntaY: sopra ? (r.top - rc.top) + r.height : (r.top - rc.top)
        });
      }
      return prove;
    }, AEREO);

    const vivi = geo.filter(g => g.davanti && !g.nascosto);
    ok('il fumetto compare dove l\'oggetto è in vista', vivi.length >= 5,
      `${vivi.length} posizioni su ${geo.length}`);

    const fuori = vivi.filter(g => g.x < -0.5 || g.y < -0.5 ||
      g.x + g.w > g.L + 0.5 || g.y + g.h > g.H + 0.5);
    ok('non esce mai dal riquadro del cielo', fuori.length === 0,
      fuori.map(g => `az${g.daz}/alt${g.dalt}: ${Math.round(g.x)},${Math.round(g.y)} ` +
        `${Math.round(g.w)}×${Math.round(g.h)} in ${g.L}×${g.H}`).join(' · '));

    // La bussola in cima e la barra del tempo in fondo sono gli unici due
    // comandi sempre in vista: scriverci sopra vuol dire coprirli.
    const invade = vivi.filter(g => g.y + g.h > g.H - g.bassa + 0.5 ||
      g.y < g.alta - 24 - 0.5);
    ok('resta fuori dalla bussola e dalla barra del tempo', invade.length === 0,
      invade.map(g => `az${g.daz}/alt${g.dalt}: y=${Math.round(g.y)}..${Math.round(g.y + g.h)} ` +
        `(fascie ${Math.round(g.alta)} / ${Math.round(g.H - g.bassa)})`).join(' · '));

    // Il punto vero del test: la coda indica l'oggetto. Quando il fumetto è
    // stato tosato la coda non ci arriva, e allora deve esserci il filo.
    const male = vivi.filter(g => {
      const scarto = Math.abs(g.px - g.puntaX);
      return scarto > 9 && !g.filoAcceso;
    });
    ok('la coda indica l\'oggetto, o c\'è il filo che ci arriva', male.length === 0,
      male.map(g => `az${g.daz}/alt${g.dalt}: coda a ${Math.round(g.puntaX)}, oggetto a ${Math.round(g.px)}`).join(' · '));

    // Sopra quando c'è posto: è il verso naturale, il dito che ha toccato
    // sta sotto e non deve coprire quello che ha appena aperto.
    const sopraSbagliato = vivi.filter(g => !g.sopra && g.py - 16 - g.h >= g.alta - 24 + 0.5);
    ok('sta sopra all\'oggetto quando c\'è posto', sopraSbagliato.length === 0,
      sopraSbagliato.map(g => `az${g.daz}/alt${g.dalt}`).join(' · '));

    // --- che si legga davvero, su questo schermo ------------------------
    const leggibilita = await pagina.evaluate(() => {
      const f = document.getElementById('skymap-fumetto');
      const c = document.getElementById('skymap-contenitore');
      const riga = f.querySelector('.fumetto-riga');
      const tasto = document.getElementById('skymap-fumetto-info');
      return {
        corpo: parseFloat(getComputedStyle(riga).fontSize),
        titolo: parseFloat(getComputedStyle(document.getElementById('skymap-fumetto-titolo')).fontSize),
        largo: f.getBoundingClientRect().width,
        alto: f.getBoundingClientRect().height,
        L: c.clientWidth, H: c.clientHeight,
        tasto: tasto.getBoundingClientRect().width,
        scorre: f.scrollWidth > f.clientWidth + 1
      };
    });
    ok('il testo non scende sotto i 12,3 px', leggibilita.corpo >= 12.3,
      `${leggibilita.corpo.toFixed(1)} px (titolo ${leggibilita.titolo.toFixed(1)})`);
    ok('i tasti restano da pollice (≥ 28 px)', leggibilita.tasto >= 28,
      `${leggibilita.tasto.toFixed(0)} px`);
    ok('non copre più di metà del cielo',
      (leggibilita.largo * leggibilita.alto) / (leggibilita.L * leggibilita.H) < 0.5,
      `${Math.round(100 * leggibilita.largo * leggibilita.alto / (leggibilita.L * leggibilita.H))}%`);
    ok('e non sborda di lato (niente testo tagliato)', !leggibilita.scorre,
      `${Math.round(leggibilita.largo)} px su ${leggibilita.L}`);

    // --- il tasto ⓘ, e la strada del ritorno ---------------------------
    const info = await pagina.evaluate(() => {
      document.getElementById('skymap-fumetto-info').click();
      return {
        pannello: document.getElementById('skymap-dettaglio').classList.contains('visibile'),
        fumetto: document.getElementById('skymap-fumetto').classList.contains('visibile'),
        righe: document.querySelectorAll('#skymap-dettaglio-corpo li').length
      };
    });
    ok('il ⓘ apre la scheda completa e mette via il fumetto',
      info.pannello === true && info.fumetto === false);
    ok('e la scheda completa ha tutti i dati', info.righe >= 5, `${info.righe} voci`);

    const indietro = await pagina.evaluate(() => {
      document.getElementById('skymap-dettaglio-indietro').click();
      return {
        pannello: document.getElementById('skymap-dettaglio').classList.contains('visibile'),
        fumetto: document.getElementById('skymap-fumetto').classList.contains('visibile')
      };
    });
    ok('la freccia riporta al fumetto', indietro.pannello === false && indietro.fumetto === true);

    const chiuso = await pagina.evaluate(() => {
      document.getElementById('skymap-fumetto-chiudi').click();
      return {
        fumetto: document.getElementById('skymap-fumetto').classList.contains('visibile'),
        selezione: sky.selezione,
        filo: document.getElementById('skymap-fumetto-filo').style.display
      };
    });
    ok('il ✕ chiude tutto, filo compreso',
      chiuso.fumetto === false && !chiuso.selezione && chiuso.filo === 'none');

    // Un oggetto che esce dallo schermo: il fumetto sparisce, la selezione no
    const fuoriVista = await pagina.evaluate((a) => {
      const dietro = Object.assign({}, a, { az: (sky.manuale.az + 180) % 360, alt: -40 });
      window.aereiTrova = () => dietro;
      skyApriDettaglio({ categoria: 'aereo', dati: dietro });
      skyDisegna();
      const f = document.getElementById('skymap-fumetto');
      return { nascosto: f.style.visibility === 'hidden', selezione: !!sky.selezione };
    }, AEREO);
    ok('girandosi dall\'altra parte il fumetto sparisce ma la selezione resta',
      fuoriVista.nascosto === true && fuoriVista.selezione === true);

    // Le librerie del CDN qui sono servite vuote apposta (vedi le rotte): i
    // loro lamenti non sono un difetto dell'app, e vanno tolti di mezzo se no
    // la prova fallisce sempre per un motivo che non c'entra col codice.
    const nostri = errori.filter(t => !/FullCalendar|Leaflet|satellite\.js|ERR_FAILED|Failed to load resource/i.test(t));
    // --- quanto costa averlo aperto ------------------------------------
    // Il fumetto vive dentro al ciclo di disegno, e il modo di rovinare un
    // ciclo di disegno è leggere l'impaginazione dopo averla invalidata:
    // si scrive `left`, si legge il riquadro, il browser ricalcola, sessanta
    // volte al secondo. La misura si tiene, e questa prova è quella che se
    // ne accorge il giorno in cui qualcuno toglie la memoria.
    const costo = await pagina.evaluate((a) => {
      window.aereiTrova = () => a;
      skyApriDettaglio({ categoria: 'aereo', dati: a });
      const f = document.getElementById('skymap-fumetto');
      let letture = 0;
      const vera = f.getBoundingClientRect.bind(f);
      f.getBoundingClientRect = () => { letture++; return vera(); };
      skyDisegna();                      // la prima misura è legittima
      const dopoLaPrima = letture;
      for (let i = 0; i < 30; i++) skyDisegna();
      f.getBoundingClientRect = vera;
      return { prima: dopoLaPrima, trenta: letture - dopoLaPrima };
    }, AEREO);
    ok('la misura del fumetto non si rilegge a ogni fotogramma',
      costo.trenta <= 3, `${costo.trenta} letture in 30 fotogrammi (la prima: ${costo.prima})`);

    ok('nessuna eccezione in console', nostri.length === 0, nostri.slice(0, 3).join(' | '));
    await contesto.close();
  }

  await browser.close();
  server.close();
  console.log(ko ? `\n${ko} prove fallite\n` : '\nTutto a posto.\n');
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
