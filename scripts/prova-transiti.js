// I transiti in un browser vero — `transiti.js`, e le due cose che nessun
// banco senza browser può giudicare.
//
// Il §31 di `verifica.html` guarda i conti: il minimo raffinato al
// millisecondo, l'arco che arriva all'orizzonte, il cono d'incertezza. Sono
// numeri, e i numeri si provano senza aprire niente. Ma due cose di questo
// lavoro **sono pixel**, e sui pixel un conto non dice niente:
//
//   1. **L'ordine del disegno.** Un aereo che transita sul Sole, prima, ci
//      finiva dietro: `aereiDisegna` girava insieme all'aurora, cioè prima
//      degli astri, e il disco del Sole gli passava sopra. La geometria era
//      giusta, la previsione era giusta, e sullo schermo non si vedeva
//      niente — il che è esattamente il modo in cui questo difetto è
//      sopravvissuto. La sola prova che lo prende è **leggere il pixel** al
//      centro del Sole con l'aereo davanti: chiaro è sbagliato, scuro è
//      giusto.
//   2. **Il modellino delle stazioni.** Un rombo e una ISS coi pannelli, a
//      colpo d'occhio, sono tutti e due «un segno sul cielo». La differenza
//      si misura andando a guardare se c'è vernice **dove il rombo non
//      arriva** (in punta a un pannello) e se non ce n'è **dove il rombo
//      arriverebbe** (a mezz'aria fra il traliccio e la punta).
//
// Serve, una volta sola:
//     npm install playwright-core astronomy-engine
//     node scripts/prova-transiti.js
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

// satellite.js serve per davvero, e non è un dettaglio: senza il globale
// `satellite` tutta la parte delle stazioni esce alla prima riga — e le
// prove passerebbero guardando il nulla, che è il modo peggiore di essere
// verdi.
function leggiSatellite() {
  const p = path.join(RADICE, 'node_modules', 'satellite.js', 'dist', 'satellite.min.js');
  if (!fs.existsSync(p)) throw new Error('npm install satellite.js@5.0.0');
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

(async () => {
  await new Promise(r => server.listen(8101, r));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const contesto = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  const pagina = await contesto.newPage();

  const errori = [];
  pagina.on('pageerror', e => errori.push('ECCEZIONE: ' + e.message));
  pagina.on('console', m => { if (m.type() === 'error') errori.push(m.text()); });

  // L'ordine conta: quando più rotte combaciano vince l'ultima registrata,
  // quindi il catch-all su jsdelivr va prima di Astronomy Engine.
  await pagina.route('**cdn.tailwindcss.com**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**cdn.jsdelivr.net**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pagina.route('**/astronomy.browser.min.js', r =>
    r.fulfill({ body: leggiAstronomy(), contentType: 'text/javascript' }));
  await pagina.route('**/satellite.min.js', r =>
    r.fulfill({ body: leggiSatellite(), contentType: 'text/javascript' }));
  await pagina.route('**open-meteo.com/**', r => r.abort());
  await pagina.route('**noaa.gov/**', r => r.abort());
  await pagina.route('**celestrak.org/**', r => r.abort());
  await pagina.route('**overpass**', r => r.abort());
  await pagina.route('**adsb**', r => r.abort());
  await pagina.route('**ipapi**', r => r.abort());
  await pagina.route('**ipwho**', r => r.abort());
  await pagina.route('**geojs**', r => r.abort());
  await pagina.route('**amazonaws.com/**', r => r.abort());

  await pagina.goto('http://localhost:8101/index.html', { waitUntil: 'networkidle', timeout: 40000 });
  await pagina.evaluate(() => localStorage.setItem('astrocalendario_posizione',
    JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' })));
  await pagina.reload({ waitUntil: 'networkidle' });
  await pagina.waitForTimeout(2000);

  let ko = 0;
  const ok = (n, c, x) => { console.log((c ? '  ok        ' : '  FALLITO   ') + n + (x ? '   — ' + x : '')); if (!c) ko++; };

  // Il planetario aperto, e il punto di vista portato dove il Sole è allo
  // **zenit**: è l'unico modo di rendere questa prova indipendente dall'ora
  // in cui la si lancia. Il punto sub-solare si ricava dall'ascensione retta
  // del Sole e dal tempo siderale — la stessa aritmetica di una carta
  // nautica — e da lì il Sole è alto novanta gradi qualunque sia l'ora.
  const dove = await pagina.evaluate(() => {
    mostraVista('cielo');
    const t = Astronomy.MakeTime(new Date());
    const equ = Astronomy.Equator('Sun', t, sky.observer, true, true);
    const gst = Astronomy.SiderealTime(t);
    let lon = (equ.ra - gst) * 15;
    while (lon > 180) lon -= 360;
    while (lon < -180) lon += 360;
    // Quarantacinque gradi a sud del punto sub-solare: il Sole resta sul
    // meridiano e sta a **quarantacinque gradi** di altezza. Non allo zenit,
    // che è il caso degenere — lì nessun aereo può stare davanti al Sole (a
    // distanza zero l'elevazione tende a novanta e non ci arriva mai), e la
    // bisezione finirebbe sul suo estremo senza dirlo.
    const lat = Math.max(-89, Math.min(89, equ.dec - 45));
    skyImpostaLuogoVista(lat, lon, 'sotto il Sole');
    skyAggiornaOggetti(true);
    const sole = sky.oggetti.find(o => o.id === 'Sun');
    return { lat, lon, altSole: sole ? sole.alt : null, azSole: sole ? sole.az : null };
  });
  console.log(`\n— il Sole a mezz'altezza di ${dove.lat.toFixed(2)}°, ${dove.lon.toFixed(2)}° —`);
  ok('il punto scelto mette il Sole a mezz\'altezza, dove lo si guarda davvero',
    dove.altSole !== null && dove.altSole > 40 && dove.altSole < 50,
    `${dove.altSole && dove.altSole.toFixed(2)}° verso ${dove.azSole && dove.azSole.toFixed(0)}°`);

  console.log('\n— 1. l\'ordine del disegno: chi sta davanti al Sole —');

  // Un aereo messo esattamente sulla direzione del Sole. La distanza al
  // suolo si trova per bisezione con la stessa `coordinateCielo` del modulo:
  // così l'aereo finisce sull'astro al primo d'arco, e la prova non dipende
  // da una formula ricopiata qui dentro.
  const pixel = await pagina.evaluate(() => {
    const api = window.AereiADS_B;
    const obs = api.osservatore();
    const sole = sky.oggetti.find(o => o.id === 'Sun');

    // La vista puntata sul Sole, campo stretto: il disco è grande e il
    // pixel centrale è inequivocabile.
    //
    // La direzione di sguardo sta in `sky.manuale`, non in `sky.az`: quello
    // è l'azimut *letto* nell'interfaccia, e scriverlo non muove niente —
    // il disegno passa da `skyBase()`, che legge `sky.manuale`. Scriverlo e
    // basta lasciava il centro dello schermo sul cielo azzurro, cioè faceva
    // fallire la prova per un motivo che non c'entrava col codice provato.
    if (typeof skyFermaMovimenti === 'function') skyFermaMovimenti();
    sky.usaSensori = false;
    sky.manuale.az = sole.az;
    sky.manuale.alt = sole.alt;
    sky.fov = 3; sky.fovVoluto = 3;
    sky.animazioneVista = null;

    function aereoA(kmSuolo, bearing) {
      // Un punto a `kmSuolo` di distanza in quella direzione: si usa la
      // propagazione del modulo con una velocità di comodo.
      const finto = { lat: obs.lat, lon: obs.lon, quotaM: 10000, velocitaMs: 1000,
                      direzione: bearing, salitaMs: 0 };
      const p = api.posizioneFutura(finto, kmSuolo);
      return { ...p, velocitaMs: 250, direzione: bearing, salitaMs: 0,
               id: 'test1', callsign: 'PROVA', ultimaLettura: Date.now() / 1000 };
    }
    // Bisezione sulla distanza al suolo finché l'elevazione combacia con
    // quella del Sole.
    let a = 0.01, b = 300;
    for (let i = 0; i < 60; i++) {
      const m = (a + b) / 2;
      const c = api.coordinateCielo(aereoA(m, sole.az), obs);
      if (c.alt > sole.alt) a = m; else b = m;
    }
    const aereo = aereoA((a + b) / 2, sole.az);
    const controllo = api.coordinateCielo(aereo, obs);

    // Lo si mette nello stato del modulo come se fosse arrivato dal feed.
    // `ultimoCentro` compreso: senza, `centroAltrove()` risponde «sì» —
    // il suo scarto vale `Infinity` finché nessuna richiesta ha detto da
    // dove è stata chiesta la fotografia — e `aereiDisegna` esce alla
    // prima riga senza disegnare niente. È la guardia giusta nell'app e la
    // trappola giusta in un banco che il feed non ce l'ha.
    api.stato.aerei = api.arricchisci([aereo], obs);
    api.stato.ultimoCentro = { lat: obs.lat, lon: obs.lon };
    api.stato.visibile = true;
    api.stato.dati = true;
    api.stato.ultimoSuccesso = Date.now();

    skyDisegna();
    const ctx = sky.ctx || (sky.canvas && sky.canvas.getContext('2d'));
    const cx = Math.round(sky.larghezza / 2), cy = Math.round(sky.altezza / 2);
    const conAereo = Array.from(ctx.getImageData(cx, cy, 1, 1).data);

    // E adesso senza: stesso fotogramma, stesso Sole, nessun aereo davanti.
    api.stato.aerei = [];
    skyDisegna();
    const senzaAereo = Array.from(ctx.getImageData(cx, cy, 1, 1).data);

    return {
      scartoDalSole: Math.abs(controllo.alt - sole.alt),
      distanzaKm: controllo.distanzaKm,
      vista: { az: sky.az, alt: sky.alt, fov: sky.fov },
      sole: { az: sole.az, alt: sole.alt },
      conAereo, senzaAereo
    };
  });

  const luce = p => (p[0] + p[1] + p[2]) / 3;
  ok('l\'aereo di prova è appoggiato sul Sole al primo d\'arco',
    pixel.scartoDalSole < 0.02, `scarto ${(pixel.scartoDalSole * 60).toFixed(2)}′, a ${pixel.distanzaKm.toFixed(1)} km`);
  ok('senza aereo il centro del Sole è pieno di luce',
    luce(pixel.senzaAereo) > 180, `${luce(pixel.senzaAereo).toFixed(0)}/255`);
  ok('con l\'aereo davanti quel pixel diventa una silhouette',
    luce(pixel.conAereo) < 60,
    `${luce(pixel.conAereo).toFixed(0)}/255 contro ${luce(pixel.senzaAereo).toFixed(0)} senza`);
  ok('…ed è nero, non il colore della fascia di distanza',
    Math.max.apply(null, pixel.conAereo.slice(0, 3)) < 60,
    `rgb(${pixel.conAereo.slice(0, 3).join(',')})`);

  console.log('\n— 2. il modellino delle stazioni spaziali —');

  const modello = await pagina.evaluate(() => {
    // Una tela di servizio: qui si guarda il disegno di `skyDisegnaStazione`
    // e nient'altro, senza il cielo attorno.
    const tela = document.createElement('canvas');
    tela.width = 200; tela.height = 200;
    const ctx = tela.getContext('2d');
    const iss = { satId: 'iss', tipo: 'satellite', colore: '#93c5fd', illuminato: true };
    const leggi = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data);

    // Grande: il modellino. r = 20, quindi l'unità del disegno è 12,4 px.
    ctx.clearRect(0, 0, 200, 200);
    skyDisegnaStazione(ctx, 100, 100, 20, iss, null, 600);
    const puntaPannello = leggi(108, 100 + 1.42 * 12.4);   // in punta a un pannello
    const dentroIlRombo = leggi(118, 100);                  // dove il rombo arriverebbe

    // Piccolo: sotto la soglia si torna al rombo, che a cinque pixel dice
    // ancora qualcosa mentre un modellino sarebbe una macchia.
    ctx.clearRect(0, 0, 200, 200);
    skyDisegnaStazione(ctx, 100, 100, 5, iss, null, 600);
    const romboCentro = leggi(100, 100);
    const romboFuori = leggi(100, 100 + 1.42 * 12.4);

    // La silhouette: con un disco luminoso registrato sotto, il modellino
    // diventa nero. È lo stesso conto degli aerei.
    ctx.clearRect(0, 0, 200, 200);
    skyRegistraDisco({ id: 'Sun', tipo: 'sole' }, { px: 100, py: 100 }, 60);
    skyDisegnaStazione(ctx, 100, 100, 20, iss, null, 600);
    const inControluce = leggi(100, 100);

    return { puntaPannello, dentroIlRombo, romboCentro, romboFuori, inControluce };
  });

  const dipinto = p => p[3] > 40;
  ok('a venti pixel la stazione ha i pannelli dove il rombo non arriva',
    dipinto(modello.puntaPannello), `alfa ${modello.puntaPannello[3]}`);
  ok('…e non ha vernice dove il rombo l\'avrebbe messa',
    !dipinto(modello.dentroIlRombo), `alfa ${modello.dentroIlRombo[3]}`);
  ok('a cinque pixel torna il rombo, che a quella misura dice di più',
    dipinto(modello.romboCentro) && !dipinto(modello.romboFuori),
    `centro ${modello.romboCentro[3]}, fuori ${modello.romboFuori[3]}`);
  ok('sopra a un disco luminoso il modellino è una silhouette nera',
    dipinto(modello.inControluce) && Math.max.apply(null, modello.inControluce.slice(0, 3)) < 40,
    `rgb(${modello.inControluce.slice(0, 3).join(',')})`);

  console.log('\n— 3. l\'avviso a schermo —');

  const avviso = await pagina.evaluate(() => {
    const T = window.Transiti;
    const ora = Date.now();
    T.stato.eventi = [{
      genere: 'stazione', chiave: 'prova-iss', oggettoId: 'iss', oggettoNome: 'ISS',
      astroId: 'Sun', astroNome: 'Sole', astroTipo: 'sole',
      quando: ora + 195000, separazione: 0.02, raggioAstro: 0.266, bersaglio: 0.266,
      transito: true, centralita: 0.08, contattoInizio: ora + 194600, contattoFine: ora + 195400,
      durataMs: 800, az: 212, alt: 43, distanzaKm: 520, incertezzaSec: 0.2, tleGiorni: 1.5
    }];
    tranAggiornaAvviso();
    const el = document.getElementById('transito-avviso');
    const dopo = {
      visibile: !el.classList.contains('hidden'),
      titolo: el.querySelector('[data-transito-titolo]').textContent,
      quando: el.querySelector('[data-transito-quando]').textContent,
      nota: el.querySelector('[data-transito-nota]').textContent,
      genere: el.dataset.genere
    };
    // Chiudere è una risposta, non un rinvio.
    el.querySelector('[data-transito-chiudi]').click();
    dopo.dopoLaChiusura = !document.getElementById('transito-avviso').classList.contains('hidden');
    T.stato.eventi = [];
    T.stato.scartato = {};
    return dopo;
  });
  ok('l\'avviso compare sul cielo', avviso.visibile);
  ok('…dice chi passa davanti a chi', /ISS/.test(avviso.titolo) && /Sole/.test(avviso.titolo), avviso.titolo);
  ok('…e quanto manca, in minuti e secondi', avviso.quando === 'fra 3 min 15 s', avviso.quando);
  ok('…con dove guardare, quanto dura e con che tolleranza',
    /SO/.test(avviso.nota) && /0\.8 s/.test(avviso.nota) && /±/.test(avviso.nota), avviso.nota);
  ok('chiudendolo se ne va e non torna', !avviso.dopoLaChiusura);

  console.log('\n— 4. il motore, dall\'aereo all\'avviso —');

  const motore = await pagina.evaluate(() => {
    const api = window.AereiADS_B, T = window.Transiti;
    const obs = api.osservatore();
    const sole = sky.oggetti.find(o => o.id === 'Sun');
    const ora = Date.now();

    // Un aereo che fra un minuto sarà esattamente davanti al Sole: lo si
    // costruisce all'indietro — prima la posizione del transito, poi la si
    // riporta indietro di sessanta secondi lungo la sua stessa rotta.
    function aereoA(kmSuolo, bearing) {
      const finto = { lat: obs.lat, lon: obs.lon, quotaM: 10000, velocitaMs: 1000,
                      direzione: bearing, salitaMs: 0 };
      return api.posizioneFutura(finto, kmSuolo);
    }
    let a = 0.01, b = 300;
    for (let i = 0; i < 60; i++) {
      const m = (a + b) / 2;
      const c = api.coordinateCielo({ ...aereoA(m, sole.az), quotaM: 10000 }, obs);
      if (c.alt > sole.alt) a = m; else b = m;
    }
    const alTransito = { ...aereoA((a + b) / 2, sole.az), quotaM: 10000,
                         velocitaMs: 250, direzione: (sole.az + 90) % 360, salitaMs: 0 };
    // Indietro di sessanta secondi: stessa rotta, tempo negativo.
    const partenza = api.posizioneFutura(alTransito, -60);
    const aereo = { ...partenza, velocitaMs: 250, direzione: (sole.az + 90) % 360, salitaMs: 0,
                    id: 'test2', callsign: 'TRANSITO', ultimaLettura: ora / 1000 };

    api.stato.aerei = api.arricchisci([aereo], obs);
    T.stato.tabelle = null; T.stato.finestraTabelle = null;
    const trovati = T.tranScanAerei(ora);
    const suSole = trovati.filter(e => e.astroId === 'Sun');
    api.stato.aerei = [];
    return {
      quanti: trovati.length,
      suSole: suSole.length,
      fraQuanto: suSole.length ? (suSole[0].quando - ora) / 1000 : null,
      transito: suSole.length ? suSole[0].transito : null,
      separazione: suSole.length ? suSole[0].separazione : null,
      durata: suSole.length ? suSole[0].durataMs : null,
      incertezza: suSole.length ? suSole[0].incertezza : null,
      arco: suSole.length ? suSole[0].arco.durataMin : null,
      merita: suSole.length ? T.tranMeritaAvviso(suSole[0], ora) : null
    };
  });
  ok('il motore trova il transito sul Sole', motore.suSole === 1,
    `${motore.quanti} avvicinamenti in tutto`);
  ok('…fra un minuto, come costruito', motore.fraQuanto !== null && Math.abs(motore.fraQuanto - 60) < 1.5,
    motore.fraQuanto !== null ? `fra ${motore.fraQuanto.toFixed(2)} s` : '');
  ok('…e lo chiama transito, non sfioramento',
    motore.transito === true && motore.separazione < 0.266,
    motore.separazione !== null ? `separazione ${(motore.separazione * 60).toFixed(2)}′` : '');
  ok('sa dire quanto dura', motore.durata !== null && motore.durata > 0 && motore.durata < 60000,
    motore.durata !== null ? `${(motore.durata / 1000).toFixed(2)} s` : '');
  ok('l\'arco calcolato va ben oltre i cinque minuti di prima',
    motore.arco !== null && motore.arco > 10, motore.arco !== null ? `${motore.arco.toFixed(1)} minuti` : '');
  ok('e a un minuto di preavviso l\'avviso si può dare',
    motore.merita === true,
    motore.incertezza !== null ? `cono di mira ${motore.incertezza.toFixed(2)}°` : '');

  console.log('\n— 5. i TLE delle due stazioni —');
  const stazioni = await pagina.evaluate(() => {
    const T = window.Transiti;
    // Un TLE vero della ISS, messo in memoria come se fosse appena arrivato
    // da Celestrak: qui la rete è staccata di proposito, e quello che si
    // vuole provare è la **decodifica**, non lo scaricamento.
    // L'epoca si scrive **di oggi**: SGP4 propaga volentieri anche di due
    // anni, ma quello che ne esce non è più un'orbita — è un modello
    // interpolato fuori dal suo dominio, e la stazione non si affaccia più
    // sull'orizzonte. Una prova che gira su un TLE vecchio di due anni non
    // fallisce: non trova niente, che è peggio.
    const oggi = new Date();
    const aa = String(oggi.getUTCFullYear() % 100).padStart(2, '0');
    const gg = Math.floor((oggi - Date.UTC(oggi.getUTCFullYear(), 0, 0)) / 86400000);
    const tle = {
      riga1: `1 25544U 98067A   ${aa}${String(gg).padStart(3, '0')}.50000000  .00016717  00000+0  30777-3 0  9993`,
      riga2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.49309239 33333',
      quando: Date.now()
    };
    localStorage.setItem('astrocalendario_tle_iss', JSON.stringify(tle));
    satTle.iss = tle;
    delete satRecCache.iss;
    const sat = satelliteDaId('iss');
    const rec = satRecDi(sat);
    const luogo = skyLuogoDelCielo();
    const camp = T.tranStazioneCampionatore(sat, luogo);
    const p = camp ? camp(Date.now()) : null;
    return {
      quante: T.tranStazioni().length,
      nomi: T.tranStazioni().map(s => s.nome),
      rec: !!rec,
      posizione: p ? { az: p.az, alt: p.alt, km: p.km } : null,
      errore: T.tranErroreTle(sat)
    };
  });
  ok('si gestiscono due stazioni, la ISS e Tiangong',
    stazioni.quante === 2, stazioni.nomi.join(' e '));
  ok('il TLE si decodifica in parametri orbitali', stazioni.rec);
  ok('…e da lì esce una posizione in cielo',
    stazioni.posizione && Number.isFinite(stazioni.posizione.az) &&
    Number.isFinite(stazioni.posizione.alt) && stazioni.posizione.km > 300,
    stazioni.posizione ? `az ${stazioni.posizione.az.toFixed(1)}°, alt ${stazioni.posizione.alt.toFixed(1)}°, ` +
      `${Math.round(stazioni.posizione.km)} km` : 'nessuna');
  ok('e l\'età del TLE si traduce in una tolleranza sull\'orario',
    stazioni.errore && Number.isFinite(stazioni.errore.secondi),
    stazioni.errore ? `${stazioni.errore.giorni.toFixed(2)} giorni → ±${stazioni.errore.secondi.toFixed(2)} s` : '');

  console.log('\n— 6. il lavoro a scaglioni: le due strade devono coincidere —');

  // La scansione delle stazioni costava **trecentotredici millisecondi** in
  // un blocco solo: venti fotogrammi persi ogni due minuti. Adesso è una
  // coda di compiti che cede il turno al browser ogni mezzo fotogramma —
  // la stessa cura del tracciamento dei raggi delle acque in terreno.js.
  //
  // La cosa da provare non è che sia più veloce (non lo è: è la stessa
  // aritmetica), è che le **due strade diano gli stessi numeri**. Se
  // divergessero, i transiti sarebbero giusti sul computer di chi li ha
  // scritti e sbagliati su un telefono lento, dove gli scaglioni cadono in
  // punti diversi — che è esattamente il genere di difetto che non si vede
  // mai in prova e si vede sempre in mano a qualcun altro.
  const scaglioni = await pagina.evaluate(async () => {
    const T = window.Transiti;
    // Una finestra che comincia davvero su un passaggio: cercarla è meglio
    // che sperarci, se no le due strade concorderebbero sul nulla.
    const camp = T.tranStazioneCampionatore(satelliteDaId('iss'), skyLuogoDelCielo());
    let inizio = Date.now();
    for (let i = 0; i < 24 * 60; i++) {
      const p = camp(Date.now() + i * 60000);
      if (p && p.alt > 5) { inizio = Date.now() + i * 60000 - 10 * 60000; break; }
    }

    const pulisci = () => { T.stato.tabelle = null; T.stato.finestraTabelle = null; };
    const chiave = e => [e.oggettoId, e.astroId, Math.round(e.quando), e.transito,
                         e.separazione.toFixed(6)].join('|');

    // Un giorno intero, sei finestre di quattro ore. Confrontare una
    // finestra sola rischia di confrontare due volte il nulla: un
    // avvicinamento della ISS a meno di un grado da un astro luminoso,
    // da un punto fisso della Terra, non capita a ogni passaggio.
    let uguali = true, totale = 0, finestre = 0;
    const diffe = [];
    let pezzi = 0, pezzoMax = 0, inizioPezzo = 0;
    const durate = [];
    const veroIdle = window.skyQuandoLibero;

    for (let f = 0; f < 6; f++) {
      const t0 = inizio + f * 4 * 3600 * 1000;
      pulisci();
      const tuttoInUnColpo = T.tranScanStazioni(t0);
      pulisci();
      inizioPezzo = performance.now();
      // La misura del pezzo va presa **solo sul lavoro**, non sull'attesa:
      // fra uno scaglione e il successivo il browser disegna i suoi
      // fotogrammi e il `setTimeout` ha il suo scatto minimo, e sommandoli si
      // misurerebbe la pausa invece del conto. Ci si è già cascati una volta,
      // e il numero che ne usciva (ventitré millisecondi) parlava del ciclo
      // di disegno del planetario, non di questa coda.
      window.skyQuandoLibero = fn => {
        pezzi++;
        durate.push(performance.now() - inizioPezzo);
        pezzoMax = Math.max(pezzoMax, performance.now() - inizioPezzo);
        setTimeout(() => { inizioPezzo = performance.now(); fn(); }, 0);
      };
      const aScaglioni = await new Promise(risolvi =>
        T.tranLavoroStazioni(t0, e => {
          durate.push(performance.now() - inizioPezzo);
          pezzoMax = Math.max(pezzoMax, performance.now() - inizioPezzo);
          risolvi(e);
        }, { scaglioneMs: 1 }));
      window.skyQuandoLibero = veroIdle;

      finestre++;
      totale += tuttoInUnColpo.length;
      if (tuttoInUnColpo.length !== aScaglioni.length ||
          tuttoInUnColpo.map(chiave).sort().join(';') !== aScaglioni.map(chiave).sort().join(';')) {
        uguali = false;
        diffe.push({ f, unColpo: tuttoInUnColpo.map(chiave), scaglioni: aScaglioni.map(chiave) });
      }
    }
    const ordinate = durate.slice().sort((a, b) => a - b);
    return { pezzi, pezzoMax, uguali, totale, finestre, diffe,
      mediana: ordinate[Math.floor(ordinate.length / 2)] || 0,
      lunghi: ordinate.slice(-6).reverse().map(x => +x.toFixed(1)) };
  });
  ok('la coda si spezza davvero in più scaglioni', scaglioni.pezzi > 3,
    `${scaglioni.pezzi} scaglioni, il più lungo ${scaglioni.pezzoMax.toFixed(1)} ms`);
  // Il numero che descrive la coda è il pezzo **tipico**, non il più lungo.
  // La granularità è un compito — una tabella di un astro, o un passaggio
  // intero di una stazione — e misurata vale quattro millisecondi e mezzo:
  // un quarto di fotogramma. Il massimo balla fra i dieci e i trenta da una
  // corsa all'altra e non dipende da questo codice: è il raccoglitore di
  // rifiuti che passa (le tabelle allocano qualche migliaio di terne) dentro
  // a un browser che nel frattempo sta disegnando il planetario. Metterci un
  // limite stretto vorrebbe dire una prova che fallisce a caso, cioè una
  // prova che si impara a ignorare.
  ok('il pezzo tipico della coda sta sotto un quarto di fotogramma',
    scaglioni.mediana < 8,
    `mediana ${scaglioni.mediana.toFixed(1)} ms su ${scaglioni.pezzi} scaglioni`);
  ok('…e nessuno arriva a bloccare più di tre fotogrammi',
    scaglioni.pezzoMax < 50,
    `il più lungo ${scaglioni.pezzoMax.toFixed(1)} ms — i sei più lunghi: ${scaglioni.lunghi.join(', ')}`);
  ok('e le due strade trovano esattamente le stesse cose', scaglioni.uguali,
    `${scaglioni.totale} avvicinamenti su ${scaglioni.finestre} finestre di quattro ore`);
  if (!scaglioni.uguali) console.log('  differenze: ' + JSON.stringify(scaglioni.diffe));
  if (!scaglioni.totale) {
    console.log('  nota      in questa giornata la ISS non è passata a meno di un grado da nessun');
    console.log('            astro luminoso: le due strade hanno concordato sul nulla, che è vero');
    console.log('            ma dice meno. Il confronto forte sui numeri sta nel §31 di verifica.html.');
  }

  if (errori.length) {
    console.log('\nerrori in console:');
    errori.slice(0, 12).forEach(e => console.log('  ' + e));
  }
  console.log(`\n${ko ? ko + ' PROVE FALLITE' : 'tutte le prove sono passate'}`);

  await browser.close();
  server.close();
  process.exit(ko === 0 ? 0 : 1);
})();
