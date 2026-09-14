/* I mondi minori, le sonde e i satelliti della vista 3D, in un browser vero.
 *
 * Perché ci vuole un browser, e perché ci vuole una prova. Questa è la
 * famiglia di cose che a occhio si giudica peggio di tutte: **un puntino
 * appoggiato in mezzo a un'orbita è convincente comunque**. Nessuno, guardando
 * lo schermo, dice «questo Plutone è quindici unità astronomiche più in là del
 * vero» o «questa Voyager se ne sta andando dalla parte sbagliata»: dice
 * «bello». Un errore di segno nella conversione fra l'equatore e l'eclittica
 * gira l'anello della ISS di quarantasette gradi e continua a essere un bel
 * anello attorno alla Terra; un'unità astronomica scritta al posto di un
 * raggio terrestre mette Hubble a metà strada dalla Luna e sullo schermo si
 * legge come «un satellite un po' alto».
 *
 * Il giudice quindi non è l'occhio ma la geografia del Sistema Solare, che si
 * conosce: quanto dista Cerere, dove passa il piano dell'orbita della ISS
 * rispetto all'asse della Terra, quale delle due Voyager sta sopra il piano
 * dei pianeti. E la seconda metà è la **lingua**: la ricerca di questa
 * finestra prendeva i nomi da una tabella italiana scritta a mano, quindi in
 * inglese si leggeva «Mars» sulla scena, si scriveva «Mars» nel campo e la
 * risposta era «elemento non trovato» — il genere di difetto che chi ha
 * scritto il codice non vede mai, perché non cambia lingua.
 *
 * Serve, una volta sola:
 *     npm install playwright-core astronomy-engine satellite.js@5.0.0
 * Poi:
 *     node scripts/prova-sistema3d.js
 */
'use strict';

const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium/chrome-linux/chrome';
const RADICE = path.join(__dirname, '..');
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

function libreria(dove) {
  const f = path.join(RADICE, 'node_modules', dove);
  if (!fs.existsSync(f)) throw new Error('manca ' + dove + ': npm install playwright-core astronomy-engine satellite.js@5.0.0');
  return fs.readFileSync(f, 'utf8');
}

// Due TLE con **inclinazioni diverse e note**: 51,6° per la ISS e 28,5° per
// Hubble. Sono i due numeri con cui si prende la conversione fra l'equatore
// (dove SGP4 risponde) e l'eclittica (dove la scena disegna): un errore di
// segno sull'obliquità porta il primo a 51,6 ± 46,9 e non lo dice nessuno.
const TLE = {
  astrocalendario_tle_iss: {
    inclinazione: 51.6416,
    riga1: '1 25544U 98067A   26060.51782528  .00016717  00000-0  10270-3 0  9004',
    riga2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537'
  },
  astrocalendario_tle_css: {
    inclinazione: 41.47,
    riga1: '1 48274U 21035A   26060.50000000  .00013000  00000-0  15000-3 0  9990',
    riga2: '2 48274  41.4700 100.0000 0005000  90.0000 270.0000 15.60000000123456'
  },
  astrocalendario_tle_hubble: {
    inclinazione: 28.47,
    riga1: '1 20580U 90037B   26060.50000000  .00008000  00000-0  30000-3 0  9990',
    riga2: '2 20580  28.4700 100.0000 0002800  90.0000 270.0000 15.09000000123456'
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
const fra = (v, a, b) => typeof v === 'number' && isFinite(v) && v >= a && v <= b;

(async () => {
  await new Promise(r => server.listen(8131, r));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const contesto = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  const pagina = await contesto.newPage();
  pagina.on('pageerror', e => { console.log('  ECCEZIONE: ' + e.message); ko++; });
  pagina.on('console', m => { if (m.type() === 'error') console.log('  console.error: ' + m.text()); });

  // L'ORDINE CONTA: quando più rotte combaciano vince l'ULTIMA registrata,
  // quindi il rifiuto generico su jsdelivr va *prima* delle due librerie.
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

  await pagina.goto('http://localhost:8131/index.html', { waitUntil: 'domcontentloaded' });
  await pagina.evaluate(tle => {
    localStorage.setItem('astrocalendario_posizione',
      JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
    localStorage.setItem('astrocal_lingua', 'it');
    // Celestrak qui non si raggiunge: i TLE si mettono a mano, che è la stessa
    // strada da cui l'app li rilegge senza rete.
    Object.keys(tle).forEach(k =>
      localStorage.setItem(k, JSON.stringify({ riga1: tle[k].riga1, riga2: tle[k].riga2, quando: Date.now() })));
  }, TLE);
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(2500);

  // La finestra si apre dal planetario, che è da dove ci si arriva davvero
  await pagina.evaluate(() => { mostraVista('cielo'); });
  await pagina.waitForTimeout(1200);
  await pagina.evaluate(() => { apriSistemaSolare(); });
  await pagina.waitForTimeout(1500);

  // =====================================================================
  console.log('\n— le tre famiglie ci sono —');

  const censo = await pagina.evaluate(() => ({
    aperta: sol.aperto,
    mondi: sol.mondi.length,
    nani: sol.mondi.filter(m => m.famiglia === 'nano').length,
    sonde: sol.sonde.length,
    satelliti: sol.satelliti.length,
    orbite: sol.orbiteMondi.tracce.length,
    corpiMinori: typeof corpiMinoriTutti === 'function' ? corpiMinoriTutti().length : 0
  }));
  ok('la finestra è aperta', censo.aperta);
  ok('i mondi minori sono al loro posto', censo.mondi >= 14, censo.mondi + ' corpi');
  ok('ci sono i pianeti nani', censo.nani >= 8, censo.nani);
  ok('ognuno ha la sua orbita', censo.orbite >= 14, censo.orbite + ' orbite');
  ok('le due Voyager ci sono', censo.sonde === 2);
  ok('i tre satelliti artificiali ci sono', censo.satelliti === 3, censo.satelliti);
  ok('il file dei corpi minori è stato caricato dalla finestra',
    censo.corpiMinori > 50, censo.corpiMinori + ' corpi nel file');

  // =====================================================================
  console.log('\n— e stanno dove la geografia del Sistema Solare dice —');

  const dove = await pagina.evaluate(() => {
    const q = {};
    sol.mondi.forEach(m => { q[m.id] = { r: m.r, lat: Math.asin(m.pos.z / m.r) * 180 / Math.PI }; });
    return q;
  });
  // Distanze attuali note (2026): Cerere nella fascia, Plutone poco oltre
  // Nettuno, Eris quasi al suo afelio, Sedna vicino al perielio ma fuori da
  // tutto. Le forchette sono larghe perché è un'epoca sola di elementi, non
  // un'effemeride — ma un errore di un fattore due non ci passa.
  ok('Cerere è nella fascia principale', fra(dove.Ceres && dove.Ceres.r, 2.5, 3.05),
    dove.Ceres && dove.Ceres.r.toFixed(2) + ' UA');
  ok('Vesta è più dentro di Cerere', dove.Vesta && dove.Ceres && dove.Vesta.r < dove.Ceres.r,
    dove.Vesta && dove.Vesta.r.toFixed(2) + ' UA');
  ok('Plutone è oltre Nettuno', fra(dove.Pluto && dove.Pluto.r, 29, 50),
    dove.Pluto && dove.Pluto.r.toFixed(1) + ' UA');
  ok('Eris è il più lontano dei nani conosciuti', fra(dove.Eris && dove.Eris.r, 88, 100),
    dove.Eris && dove.Eris.r.toFixed(1) + ' UA');
  ok('Sedna sta fuori dalla fascia di Kuiper', fra(dove.Sedna && dove.Sedna.r, 78, 92),
    dove.Sedna && dove.Sedna.r.toFixed(1) + ' UA');
  ok('Chirone sta fra Saturno e Urano', fra(dove.Chiron && dove.Chiron.r, 9, 19),
    dove.Chiron && dove.Chiron.r.toFixed(1) + ' UA');
  // L'inclinazione è metà del discorso di questi mondi: Eris a quarantaquattro
  // gradi non è «un pianeta un po' storto», è un corpo che non appartiene al
  // piatto. Se la conversione dagli elementi perdesse la z, tutti starebbero
  // sull'eclittica e la scena non avrebbe niente da dire.
  const inclinazioni = await pagina.evaluate(() => {
    const q = {};
    sol.orbiteMondi.tracce.forEach(t => {
      let max = 0;
      t.punti.forEach(v => {
        const r = Math.hypot(v.x, v.y, v.z) || 1;
        max = Math.max(max, Math.abs(Math.asin(v.z / r) * 180 / Math.PI));
      });
      q[t.id] = max;
    });
    return q;
  });
  ok('l\'orbita di Eris è inclinata di quarantaquattro gradi',
    fra(inclinazioni.Eris, 42, 46), inclinazioni.Eris && inclinazioni.Eris.toFixed(1) + '°');
  ok('quella di Quaoar è quasi nel piano', fra(inclinazioni.Quaoar, 6, 10),
    inclinazioni.Quaoar && inclinazioni.Quaoar.toFixed(1) + '°');

  // Una sorgente sola per gli asteroidi del file: se `SOL_MONDI` si portasse
  // dietro una copia degli elementi di Cerere, il planetario e questa vista
  // potrebbero disegnarla in due posti diversi — ed è il difetto peggiore che
  // questo pezzo possa avere, perché ognuna delle due viste sembra giusta.
  const sorgenti = await pagina.evaluate(() => SOL_MONDI.map(m => ({
    id: m.id, dal: m.dal || null, el: !!m.el, ae: m.ae || null,
    stessoDelFile: m.dal ? solElementiMondo(m) === corpiMinoriTutti().find(c => c.nome === m.dal) : null
  })));
  ok('nessun mondo ha due sorgenti per la stessa orbita',
    sorgenti.every(m => [m.dal, m.el ? 'el' : null, m.ae].filter(Boolean).length === 1),
    sorgenti.filter(m => [m.dal, m.el ? 'el' : null, m.ae].filter(Boolean).length !== 1).map(m => m.id).join(', '));
  ok('gli asteroidi del file leggono gli elementi **dal** file',
    sorgenti.filter(m => m.dal).length >= 5 && sorgenti.filter(m => m.dal).every(m => m.stessoDelFile));

  // =====================================================================
  console.log('\n— le due Voyager: una sopra il piano e una sotto —');

  const sonde = await pagina.evaluate(() => sol.sonde.map(s => ({
    id: s.id, r: s.r, z: s.pos.z,
    lat: Math.asin(s.pos.z / s.r) * 180 / Math.PI,
    anni: s.anniDiVolo, partita: s.partita
  })));
  const v1 = sonde.find(s => s.id === 'voyager1');
  const v2 = sonde.find(s => s.id === 'voyager2');
  ok('la Voyager 1 è la più lontana di tutte', v1 && v2 && v1.r > v2.r && v1.r > 160,
    v1 && v1.r.toFixed(1) + ' UA contro ' + (v2 && v2.r.toFixed(1)));
  ok('la Voyager 1 sale sopra il piano dei pianeti', v1 && fra(v1.lat, 30, 40),
    v1 && v1.lat.toFixed(1) + '°');
  ok('la Voyager 2 scende sotto', v2 && fra(v2.lat, -52, -44), v2 && v2.lat.toFixed(1) + '°');
  // È la forma a V, cioè la ragione per cui stanno in una scena a tre
  // dimensioni invece che in un elenco: guardate a picco sono due rotte
  // qualunque, e il segno della z è tutto quello che le distingue.
  ok('le due se ne vanno da parti opposte del piano', v1 && v2 && v1.z > 0 && v2.z < 0);
  ok('sono in viaggio da quasi cinquant\'anni', v1 && fra(v1.anni, 45, 60),
    v1 && Math.floor(v1.anni) + ' anni');

  // La retta: un anno di macchina del tempo deve spostarle di tre unità
  // astronomiche e mezzo, che è la loro velocità vera — non di zero (posizione
  // congelata) e non di trenta (un fattore sbagliato).
  const passo = await pagina.evaluate(() => {
    const prima = sol.sonde.find(s => s.id === 'voyager1').r;
    skyImpostaOffsetTempo((sky.offsetTempoSec || 0) + 365.25 * 86400);
    solLeggiPosizioni(skyAdesso());
    const dopo = sol.sonde.find(s => s.id === 'voyager1').r;
    skyImpostaOffsetTempo(0);
    solLeggiPosizioni(skyAdesso());
    return dopo - prima;
  });
  ok('in un anno la Voyager 1 fa tre unità astronomiche e mezzo',
    fra(passo, 3.3, 3.8), passo.toFixed(3) + ' UA/anno');

  // =====================================================================
  console.log('\n— i satelliti attorno alla Terra —');

  const sat = await pagina.evaluate(inclinazioni => {
    // L'asse di rotazione della Terra, in coordinate eclittiche: il polo nord
    // celeste sta a 66,56° di latitudine eclittica. L'angolo fra questo asse e
    // la normale all'anello **è** l'inclinazione dell'orbita, cioè il numero
    // scritto nel TLE: è la prova della conversione fra i due sistemi.
    const e = 23.4392911 * Math.PI / 180;
    const asse = [0, Math.sin(e), Math.cos(e)];
    return sol.satelliti.map(s => {
      const a = s.anello || [];
      // La normale al piano dell'orbita da due campioni lontani fra loro
      let n = [0, 0, 0];
      if (a.length > 10) {
        const p = a[0], q = a[Math.floor(a.length / 4)];
        n = [p.y * q.z - p.z * q.y, p.z * q.x - p.x * q.z, p.x * q.y - p.y * q.x];
        const d = Math.hypot(n[0], n[1], n[2]) || 1;
        n = [n[0] / d, n[1] / d, n[2] / d];
      }
      const cos = Math.abs(n[0] * asse[0] + n[1] * asse[1] + n[2] * asse[2]);
      return {
        id: s.id, quota: s.quotaKm, periodo: s.periodoMin,
        modulo: Math.hypot(s.u.x, s.u.y, s.u.z),
        punti: a.length,
        inclinazione: Math.acos(Math.min(1, cos)) * 180 / Math.PI,
        attesa: inclinazioni[s.id]
      };
    });
  }, { iss: TLE.astrocalendario_tle_iss.inclinazione, css: TLE.astrocalendario_tle_css.inclinazione,
       hubble: TLE.astrocalendario_tle_hubble.inclinazione });
  ok('ogni satellite ha il suo anello campionato', sat.every(s => s.punti > 40),
    sat.map(s => s.id + ':' + s.punti).join(' '));
  ok('le direzioni sono versori', sat.every(s => Math.abs(s.modulo - 1) < 1e-9));
  ok('le quote sono quelle di un\'orbita bassa', sat.every(s => fra(s.quota, 300, 700)),
    sat.map(s => s.id + ':' + Math.round(s.quota) + 'km').join(' '));
  sat.forEach(s => ok(`il piano dell'orbita di ${s.id} è inclinato come dice il suo TLE`,
    Math.abs(s.inclinazione - s.attesa) < 1.5,
    s.inclinazione.toFixed(2) + '° contro ' + s.attesa + '°'));
  // Il contro-esempio scritto in chiaro: senza la rotazione all'eclittica
  // l'anello della ISS risulterebbe inclinato di quarantadue gradi invece di
  // cinquantuno e mezzo, e sullo schermo sarebbe un anello perfettamente
  // plausibile attorno a un pianeta perfettamente plausibile.
  const senzaRotazione = await pagina.evaluate(() => {
    const e = 23.4392911 * Math.PI / 180;
    const asse = [0, Math.sin(e), Math.cos(e)];
    const rec = satRecDi(satelliteDaId('iss'));
    const pv1 = satellite.propagate(rec, new Date());
    const pv2 = satellite.propagate(rec, new Date(Date.now() + 20 * 60000));
    const p = pv1.position, q = pv2.position;
    const n = [p.y * q.z - p.z * q.y, p.z * q.x - p.x * q.z, p.x * q.y - p.y * q.x];
    const d = Math.hypot(n[0], n[1], n[2]) || 1;
    const cos = Math.abs((n[0] * asse[0] + n[1] * asse[1] + n[2] * asse[2]) / d);
    return Math.acos(Math.min(1, cos)) * 180 / Math.PI;
  });
  ok('e senza quella rotazione il numero sarebbe un altro',
    Math.abs(senzaRotazione - TLE.astrocalendario_tle_iss.inclinazione) > 3,
    senzaRotazione.toFixed(2) + '° invece di ' + TLE.astrocalendario_tle_iss.inclinazione + '°');

  // Il TLE vecchio: SGP4 con elementi di un mese fa mette la ISS a mezzo giro
  // da dov'è, e un pallino sbagliato è peggio di nessun pallino.
  const tleVecchio = await pagina.evaluate(() => {
    const vero = satTle.iss;
    satTle.iss = Object.assign({}, vero, { quando: Date.now() - 40 * 86400000 });
    const p = solVersoreSatellite(satelliteDaId('iss'), new Date(), Astronomy.MakeTime(new Date()));
    satTle.iss = vero;
    return p;
  });
  ok('con un TLE di quaranta giorni fa non si disegna niente', tleVecchio === null);

  // =====================================================================
  console.log('\n— si toccano, si trovano, e la scheda li racconta —');

  const scelta = await pagina.evaluate(() => {
    const esito = solInquadraRicerca('Pluto');
    const html = document.getElementById('sol-scheda').innerHTML;
    return { esito, scelto: sol.scelto, perno: sol.perno, html };
  });
  ok('cercare Plutone lo inquadra', scelta.esito && scelta.scelto === 'Pluto');
  ok('e la sua scheda dice che è un pianeta nano',
    /Pianeta nano/.test(scelta.html) && /Plutone/.test(scelta.html));

  const satellite3d = await pagina.evaluate(async () => {
    const esito = solInquadraRicerca('iss');
    sol.zoom = sol.zoomVoluto;     // la scivolata dura mezzo secondo: qui si salta
    solDisegna();
    const terra = sol.pianeti.find(p => p.id === 'Earth');
    return {
      esito, scelto: sol.scelto, perno: sol.perno,
      raggioTerra: terra ? terra.rDisegno : 0,
      disegnati: sol.satSchermo.length,
      html: document.getElementById('sol-scheda').innerHTML
    };
  });
  ok('cercare la ISS porta la telecamera dalla Terra',
    satellite3d.esito && satellite3d.perno === 'Earth' && satellite3d.scelto === 'iss');
  ok('e a quel punto la Terra è abbastanza grande da portare un anello',
    satellite3d.raggioTerra > 16, Math.round(satellite3d.raggioTerra) + ' px di raggio');
  ok('i satelliti si disegnano davvero', satellite3d.disegnati > 0,
    satellite3d.disegnati + ' su 3');
  ok('la scheda della ISS dice quota e periodo',
    /Quota/.test(satellite3d.html) && /Stazione spaziale/.test(satellite3d.html));

  // Il tocco: un nome che si legge sullo schermo e non si può toccare è una
  // promessa non mantenuta, ed è il caso in cui uno *vuole* sapere che cos'è
  // quel puntino là in fondo.
  const tocco = await pagina.evaluate(() => {
    solInquadraRicerca('Eris');
    sol.zoom = sol.zoomVoluto;
    solDisegna();
    const e = sol.mondi.find(m => m.id === 'Eris');
    if (!e || !e.schermo) return null;
    const r = sol.canvas.getBoundingClientRect();
    sol.scelto = null;
    solTocco({ clientX: r.left + e.schermo.px, clientY: r.top + e.schermo.py });
    return sol.scelto;
  });
  ok('toccando un pianeta nano lo si sceglie', tocco === 'Eris', String(tocco));

  // Scegliere non e' uno zoom mascherato: conserva esattamente la scala che
  // l'utente ha composto e cambia soltanto il perno attorno a cui ruota la
  // camera. Vale per un mondo naturale e per ciascun oggetto artificiale.
  const selezioneCamera = await pagina.evaluate(() => {
    const risultati = [];
    ['Mars', 'iss', 'css', 'hubble'].forEach((id, i) => {
      sol.zoom = 3.25 + i;
      sol.zoomVoluto = sol.zoom;
      const prima = { zoom: sol.zoom, zoomVoluto: sol.zoomVoluto };
      solScegli(id);
      risultati.push({
        id, perno: sol.perno,
        zoom: sol.zoom, zoomVoluto: sol.zoomVoluto,
        invariato: sol.zoom === prima.zoom && sol.zoomVoluto === prima.zoomVoluto
      });
    });
    return risultati;
  });
  ok('selezionare un corpo cambia il centro ma non lo zoom',
    selezioneCamera.every(v => v.perno === v.id && v.invariato),
    selezioneCamera.map(v => `${v.id}: ${v.zoom}/${v.zoomVoluto}`).join(', '));

  const tagliaSatelliti = await pagina.evaluate(() => {
    solInquadraRicerca('iss');
    sol.zoom = sol.zoomVoluto;
    solDisegna();
    return sol.satSchermo.map(s => ({ id: s.id, r: s.r }));
  });
  ok('ISS, Tiangong e Hubble hanno pallini artificiali piu grandi',
    tagliaSatelliti.length === 3 && tagliaSatelliti.every(s => s.r >= 5),
    tagliaSatelliti.map(s => `${s.id}: ${s.r}px`).join(', '));

  // =====================================================================
  console.log('\n— la ricerca parla la lingua scelta —');

  const italiano = await pagina.evaluate(() => ({
    lingua: astroI18n.lingua(),
    suggerimenti: [...document.querySelectorAll('#sol-elementi option')].map(o => o.value),
    nettuno: solIdDaRicerca('Nettuno'),
    plutone: solIdDaRicerca('Plutone'),
    cerere: solIdDaRicerca('Cerere'),
    igea: solIdDaRicerca('Igea'),
    mezzoNome: solIdDaRicerca('nett'),
    voyager: solIdDaRicerca('Voyager 1'),
    iss: solIdDaRicerca('iss'),
    hubble: solIdDaRicerca('Hubble'),
    inventato: solIdDaRicerca('Pippo')
  }));
  ok('in italiano i suggerimenti sono in italiano',
    italiano.suggerimenti.includes('Nettuno') && italiano.suggerimenti.includes('Plutone'),
    italiano.suggerimenti.length + ' voci');
  ok('e comprendono i mondi minori, le sonde e i satelliti',
    ['Cerere', 'Eris', 'Voyager 1', 'ISS', 'Hubble'].every(n => italiano.suggerimenti.includes(n)));
  ok('i nomi italiani si trovano',
    italiano.nettuno === 'Neptune' && italiano.plutone === 'Pluto' &&
    italiano.cerere === 'Ceres' && italiano.igea === 'Hygiea');
  ok('mezzo nome basta', italiano.mezzoNome === 'Neptune');
  ok('le sonde e i satelliti si trovano per nome',
    italiano.voyager === 'voyager1' && italiano.iss === 'iss' && italiano.hubble === 'hubble');
  ok('e quello che non c\'è non si trova', italiano.inventato === null);

  const inglese = await pagina.evaluate(async () => {
    await astroI18n.impostaLingua('en');
    return {
      lingua: astroI18n.lingua(),
      suggerimenti: [...document.querySelectorAll('#sol-elementi option')].map(o => o.value),
      neptune: solIdDaRicerca('Neptune'),
      pluto: solIdDaRicerca('Pluto'),
      dwarf: solIdDaRicerca('Ceres'),
      // Chi ha imparato i nomi in italiano non deve indovinare come si
      // chiamano qui: la lingua decide cosa si **legge**, non cosa si può
      // scrivere.
      nettuno: solIdDaRicerca('Nettuno'),
      nonTrovato: astroI18n.t('sol.ricerca.nonTrovato'),
      scheda: (() => { solInquadraRicerca('Pluto'); return document.getElementById('sol-scheda').innerHTML; })()
    };
  });
  ok('cambiando lingua i suggerimenti si rifanno',
    inglese.suggerimenti.includes('Neptune') && !inglese.suggerimenti.includes('Nettuno'),
    inglese.suggerimenti.slice(0, 4).join(', '));
  ok('i nomi inglesi si trovano', inglese.neptune === 'Neptune' && inglese.pluto === 'Pluto' &&
    inglese.dwarf === 'Ceres');
  ok('e quelli italiani continuano a funzionare', inglese.nettuno === 'Neptune');
  ok('il messaggio di «non trovato» è tradotto', !/trovato/.test(inglese.nonTrovato),
    inglese.nonTrovato);
  ok('e la scheda di un mondo minore pure',
    /Dwarf planet/.test(inglese.scheda) && !/Pianeta nano/.test(inglese.scheda));
  await pagina.evaluate(() => astroI18n.impostaLingua('it'));

  // =====================================================================
  console.log('\n— i due interruttori —');

  const spegni = await pagina.evaluate(() => {
    // Si torna prima dalla Terra: la prova di sopra ha portato la telecamera a
    // novanta unità astronomiche per guardare Eris, e da lassù i satelliti non
    // si disegnano — giustamente, ed è quello che la loro soglia promette.
    solInquadraRicerca('iss');
    sol.zoom = sol.zoomVoluto;
    sol.mondiAccesi = false;
    sol.sondeAccese = false;
    solDisegna();
    const senza = { satelliti: sol.satSchermo.length };
    sol.mondiAccesi = true;
    sol.sondeAccese = true;
    solDisegna();
    return { senza, con: { satelliti: sol.satSchermo.length } };
  });
  ok('spegnendo le cose nostre i satelliti non si disegnano', spegni.senza.satelliti === 0);
  ok('e riaccendendole tornano', spegni.con.satelliti > 0);

  // Nessuna eccezione nel fotogramma, con tutto acceso e a tre inquadrature
  // diverse: è la rete che tiene insieme tutto il resto — un'eccezione dentro
  // a `solDisegna` non salta un fotogramma, li salta tutti (§7.4-quinquies).
  const fotogrammi = await pagina.evaluate(() => {
    let caduti = 0;
    [0.4, 4, 40].forEach(z => {
      try {
        sol.zoom = sol.zoomVoluto = z;
        sol.elev = 22; sol.az = 1.2;
        solDisegna();
      } catch (e) { caduti++; }
    });
    return caduti;
  });
  ok('il fotogramma non cade a nessun ingrandimento', fotogrammi === 0);

  console.log(ko ? `\n✗ ${ko} prove fallite` : '\n✓ tutte le prove passate');
  await browser.close();
  server.close();
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
