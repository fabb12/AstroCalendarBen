/* Il volo dal planetario al Sistema Solare, in un browser vero.
 *
 * Perché ci vuole una prova, e perché ci vuole un browser. Questa è la
 * famiglia di cose che a occhio si giudica peggio di tutte: **un'animazione
 * plausibile e un'animazione giusta sono la stessa immagine**. Cinque
 * secondi di stelle e di azzurro sono belli comunque — anche se la camera
 * parte da una posa che non è quella da cui si stava guardando, anche se
 * l'ultimo fotogramma del velo mette la Terra sessanta pixel più in là di
 * dove la scena la disegnerà, anche se in mezzo c'è un secondo e mezzo di
 * schermo nero. Nessuno, guardando, dice «qui la tangente ha il segno
 * sbagliato»: dice «bello», oppure «non so, scatta un po'».
 *
 * Il giudice quindi non è l'occhio ma l'aritmetica, e le domande sono
 * quattro, tutte cose che una figura non mostra:
 *
 *   **I due capi combaciano?** L'ultimo fotogramma del velo e il primo della
 *   scena devono essere la stessa Terra: stesso centro, stesso raggio, e
 *   quasi gli stessi pixel. È la promessa dell'intero pezzo — se salta, il
 *   volo finisce con lo scatto che doveva togliere.
 *
 *   **C'è sempre qualcosa da vedere?** Il difetto peggiore di questo genere
 *   di cose non è un errore, è il **vuoto**: un tratto in cui il pianeta è
 *   uscito dal quadro e non è ancora tornato, e sullo schermo restano
 *   quattro stelle. Non fallisce niente, e si legge come «si è piantato».
 *
 *   **Si muove senza scatti?** Si campiona fitto e si guarda quanto cambia
 *   l'immagine da un fotogramma al successivo: un salto è un passo che vale
 *   molte volte i suoi vicini.
 *
 *   **La geometria è quella giusta?** Col contro-esempio scritto in chiaro,
 *   cioè il difetto vero che questa prova ha preso: tosando l'angolo a
 *   `π/2 − ε` invece di tosare la tangente, l'**esterno** di un cerchio —
 *   che è come si scrive «sono per terra e la Terra è il pavimento» —
 *   diventa un disco grande come mezza galassia, e il pianeta sparisce.
 *
 * Serve, una volta sola:
 *     npm install playwright-core astronomy-engine satellite.js@5.0.0
 * Poi:
 *     node scripts/prova-volo.js
 */
'use strict';

const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium/chrome-linux/chrome';
const RADICE = path.join(__dirname, '..');
const PORTA = 8147;
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
  const contesto = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  const pagina = await contesto.newPage();
  pagina.on('pageerror', e => { console.log('  ECCEZIONE: ' + e.message); ko++; });
  pagina.on('console', m => {
    const t = m.text();
    // I rifiuti di rete sono voluti: qui non si esce.
    if (m.type() === 'error' && !/Failed to load resource|net::/.test(t)) console.log('  console.error: ' + t);
  });

  // L'ORDINE CONTA: quando più rotte combaciano vince l'ULTIMA registrata.
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

  // ------------------------------------------------------------------ //
  titolo('si parte da dove si stava guardando');
  await apriIlCielo(pagina);
  const posaCielo = await pagina.evaluate(() => ({
    alt: Math.asin(Math.max(-1, Math.min(1, sky.ultimaBase.f[2]))) * 180 / Math.PI,
    focale: sky.ultimaFocale, H: sky.altezza
  }));
  await pagina.evaluate(() => { apriSistemaSolare(); });
  await pagina.waitForTimeout(300);

  const avvio = await pagina.evaluate(() => ({
    attivo: solVolo.attivo, foto: !!solVolo.foto, alt0: solVolo.alt0,
    F0: solVolo.F0, F1: solVolo.F1, rFine: solVolo.rFine, q0: solVolo.q0,
    H: solVolo.H, L: solVolo.L,
    velo: getComputedStyle(document.getElementById('sol-transizione')).display
  }));
  ok('il volo parte davvero', avvio.attivo && avvio.velo === 'block');
  ok('la fotografia del planetario è stata presa', avvio.foto);
  ok('e la camera parte dalla posa vera del cielo',
    Math.abs(avvio.alt0 - posaCielo.alt) < 0.6,
    `volo ${avvio.alt0.toFixed(1)}° · cielo ${posaCielo.alt.toFixed(1)}°`);
  // Il campo di partenza è quello del planetario riportato a questa tela: se
  // divergessero, appena il conto prende il posto della fotografia si
  // vedrebbe uno scatto di zoom.
  const F0atteso = posaCielo.focale * (avvio.H / posaCielo.H);
  ok('e col campo del planetario, non con uno suo',
    Math.abs(avvio.F0 - F0atteso) < 1,
    `${avvio.F0.toFixed(0)} contro ${F0atteso.toFixed(0)} px`);

  const c = await corsa(pagina, 240);
  const mezzaH = c[0].H / 2;

  // ------------------------------------------------------------------ //
  titolo('la geometria: la Terra è il pavimento, poi diventa un corpo');
  ok('a quota zero il pianeta è **fuori** dal cerchio, non dentro',
    c[0].esterno, 'è come si scrive «sono per terra»');
  ok('e a fine volo è un disco',
    !c[c.length - 1].esterno && !c[c.length - 1].retta);
  // Il contro-esempio, cioè il difetto vero: tosando l'angolo invece della
  // tangente il segno si perde, e l'esterno diventa un disco enorme.
  const sbagliato = await pagina.evaluate(() => {
    const p = solVoloPosa(0);
    const quasi = Math.PI / 2 - 0.002;
    const t = e => Math.tan(Math.max(-quasi, Math.min(quasi, e)));
    const r1 = 2 * p.F * t((p.beta - p.rho) / 2);
    const r2 = 2 * p.F * t((p.beta + p.rho) / 2);
    return { esterno: r2 < r1, rc: Math.abs(r2 - r1) / 2 };
  });
  ok('col vecchio taglio sull’angolo la stessa posa dava un disco, non l’esterno',
    !sbagliato.esterno && sbagliato.rc > 1e5,
    `raggio ${Math.round(sbagliato.rc).toLocaleString('it-IT')} px`);
  // L'angolo fra l'asse e il centro della Terra non può essere negativo, e a
  // fine volo dev'essere zero esatto: è quello che mette il pianeta al centro.
  ok('l’angolo verso la Terra non va mai sotto zero', c.every(f => f.beta >= 0));
  ok('e all’arrivo vale zero, cioè la Terra è nel mirino',
    c[c.length - 1].beta < 1e-9);
  // La quota cresce sempre: una camera che scende a metà volo è un errore
  // che a occhio si legge come «ha esitato».
  let sale = true;
  for (let i = 1; i < c.length; i++) if (c[i].h < c[i - 1].h - 1e-6) sale = false;
  ok('la quota cresce sempre, senza ripensamenti', sale,
    `da ${c[0].h.toFixed(1)} a ${Math.round(c[c.length - 1].h).toLocaleString('it-IT')} km`);
  ok('si esce dall’atmosfera a metà strada circa',
    c.find(f => f.h > 100).u > 0.35 && c.find(f => f.h > 100).u < 0.55,
    `la linea di Kármán a u=${c.find(f => f.h > 100).u.toFixed(2)}`);

  // ------------------------------------------------------------------ //
  titolo('la camera si alza, e poi si gira verso la Terra');
  // Il primo tratto è quello che la richiesta descrive: il naso in su, il
  // suolo che scivola giù dal bordo. Lo si misura sul **bordo del mondo**,
  // che è la sola cosa che si vede muoversi.
  const alto = c.reduce((a, f) => f.vicino > a.vicino ? f : a, c[0]);
  ok('nel primo terzo il bordo del mondo scende: la camera si è alzata',
    alto.u > 0.12 && alto.u < 0.42 && alto.vicino > c[0].vicino + mezzaH * 0.25,
    `massimo a u=${alto.u.toFixed(2)}, ${Math.round(alto.vicino)} px sotto al centro`);
  // E poi risale fino a passare sopra al centro: è la camera che si è girata.
  ok('e da lì risale fino a stare sopra al centro: la camera si è girata',
    c[c.length - 1].vicino < 0,
    `arriva a ${Math.round(c[c.length - 1].vicino)} px`);
  // L'angolo del beccheggio dice la stessa cosa in gradi.
  const bMax = Math.max(...c.map(f => f.beta)) * 180 / Math.PI;
  ok('in gradi: la camera arriva a guardare ben sopra l’orizzonte',
    bMax - 90 > 30, `${(bMax - 90).toFixed(0)}° sopra l’orizzonte`);

  // ------------------------------------------------------------------ //
  titolo('non c’è nessun fotogramma vuoto');
  // È il difetto che non fallisce: il pianeta è uscito dal quadro e non è
  // ancora tornato, e sullo schermo restano quattro stelle. Si misura
  // contando i fotogrammi in cui non c'è **niente** dentro al riquadro — né
  // il bordo del pianeta, né la fotografia che ancora regge.
  const fotoViva = f => f.u < 0.50;   // la dissolvenza finisce lì (SOL_VOLO_FOTO_A)
  const vuoti = c.filter(f => !fotoViva(f) && f.vicino > mezzaH);
  ok('mai lo schermo senza pianeta e senza fotografia', vuoti.length === 0,
    vuoti.length ? `${vuoti.length} fotogrammi su ${c.length}` : 'nessuno');
  // E nemmeno quasi: il lembo non deve stare appiccicato al bordo per troppo.
  const rasenti = c.filter(f => f.vicino > mezzaH * 0.92 && f.vicino <= mezzaH).length / c.length;
  ok('e il lembo non resta appeso al bordo per mezzo volo', rasenti < 0.30,
    `${Math.round(rasenti * 100)}% della corsa`);

  // ------------------------------------------------------------------ //
  titolo('il movimento è liscio: nessun passo vale il doppio dei vicini');
  // Uno scatto è un passo che vale molte volte i suoi vicini. Si guarda il
  // bordo del mondo, che è la cosa che l'occhio segue, e si confronta ogni
  // passo con la mediana di tutti.
  const passi = [];
  for (let i = 1; i < c.length; i++) passi.push(Math.abs(c[i].vicino - c[i - 1].vicino));
  const ordinati = passi.slice().sort((a, b) => a - b);
  const mediana = ordinati[Math.floor(ordinati.length / 2)];
  const peggio = Math.max(...passi);
  ok('il bordo del mondo si muove senza salti', peggio < Math.max(6, mediana * 9),
    `peggiore ${peggio.toFixed(1)} px, mediana ${mediana.toFixed(1)} px`);
  // Gli estremi devono essere fermi: si parte da fermi e si arriva da fermi,
  // se no il velo si apre su una scena che ha ancora della velocità addosso.
  ok('si parte fermi', passi[0] < mediana * 1.2, `${passi[0].toFixed(2)} px`);
  ok('e si arriva fermi', passi[passi.length - 1] < mediana * 1.2,
    `${passi[passi.length - 1].toFixed(2)} px`);
  // Lo stesso per il raggio del disco — ma **solo da quando è un disco che
  // si vede**. Attraversando il mezzo giro il cerchio passa per l'infinito, e
  // lì «il raggio» non è una grandezza dello schermo: vale ventimila pixel su
  // una tela che ne ha settecento, e cala del centoventotto per cento a
  // fotogramma senza che sullo schermo si muova niente — quello che si vede è
  // il bordo vicino, e quello è già stato misurato qui sopra.
  const diag = Math.hypot(c[0].L, c[0].H);
  const dR = [];
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1], b = c[i];
    if (a.retta || b.retta || a.esterno || b.esterno) continue;
    if (a.rc > diag * 2 || b.rc > diag * 2) continue;
    dR.push(Math.abs(b.rc - a.rc) / Math.max(1, b.rc));
  }
  ok('e il disco si rimpicciolisce sempre della stessa frazione',
    dR.length > 40 && Math.max(...dR) < 0.16,
    `al più il ${(Math.max(...dR) * 100).toFixed(1)}% per passo, su ${dR.length} fotogrammi`);

  // ------------------------------------------------------------------ //
  titolo('il velo d’aria sul lembo');
  // Dentro all'atmosfera non c'è nessuna riga da disegnare: il bagliore è il
  // cielo. Fuori sì, e si assottiglia allontanandosi — se non lo facesse
  // sarebbe un anello di vernice attorno al disco.
  const dentro = c.filter(f => f.h < 60);
  ok('dentro all’aria il lembo non è un oggetto a sé',
    dentro.every(f => f.rhoAria > 89.3 * Math.PI / 180));
  const fuoriAria = c.filter(f => f.h > 400);
  ok('appena fuori invece c’è, ed è spesso',
    fuoriAria[0].banda > 3, `${fuoriAria[0].banda.toFixed(1)} px a ${Math.round(fuoriAria[0].h)} km`);
  ok('e si assottiglia allontanandosi',
    fuoriAria[fuoriAria.length - 1].banda < fuoriAria[0].banda / 4,
    `${fuoriAria[fuoriAria.length - 1].banda.toFixed(1)} px all’arrivo`);

  // ------------------------------------------------------------------ //
  titolo('i due capi combaciano');
  // La promessa del pezzo. L'ultimo fotogramma del velo e la Terra della
  // scena devono essere la stessa cosa: stesso centro, stesso raggio.
  const capi = await pagina.evaluate(() => {
    const p = solVoloPosa(1);
    const c = solVoloCerchio(p, p.rho);
    solDisegna();
    const terra = sol.pianeti.find(x => x.id === 'Earth');
    return {
      veloR: c.rc, veloX: solVolo.L / 2, veloY: solVolo.H / 2 + c.dc,
      scenaR: terra.rDisegno, scenaX: terra.schermo.px, scenaY: terra.schermo.py
    };
  });
  ok('stesso raggio', Math.abs(capi.veloR - capi.scenaR) < 0.5,
    `${capi.veloR.toFixed(1)} contro ${capi.scenaR.toFixed(1)} px`);
  ok('stesso centro',
    Math.hypot(capi.veloX - capi.scenaX, capi.veloY - capi.scenaY) < 0.6,
    `scarto ${Math.hypot(capi.veloX - capi.scenaX, capi.veloY - capi.scenaY).toFixed(2)} px`);

  // E gli **stessi pixel**, che è la domanda vera: la Terra del velo la
  // disegna la funzione della scena, quindi sul disco le due immagini devono
  // coincidere. Si guarda dentro al disco e basta: fuori la scena aggiunge
  // l'anello dell'orbita lunare, la riga del piano dell'eclittica e i nomi,
  // che non sono uno scarto ma il **diagramma che si apre** — è quello che
  // l'ultima dissolvenza serve a far entrare.
  const diff = await pagina.evaluate(() => {
    const t = document.getElementById('sol-transizione-tela');
    const dpr = window.devicePixelRatio || 1;
    solVoloDisegna(1);
    const terra = sol.pianeti.find(x => x.id === 'Earth');
    const r = terra.rDisegno;
    const lato = Math.round(2 * r * dpr);
    const x = Math.round((solVolo.L / 2 - r) * dpr), y = Math.round((solVolo.H / 2 - r) * dpr);
    const A = t.getContext('2d').getImageData(x, y, lato, lato).data;
    solDisegna();
    const B = sol.ctx.getImageData(x, y, lato, lato).data;
    const dentro = (r * 0.92 * dpr) ** 2;
    let somma = 0, quanti = 0, peggio = 0;
    for (let i = 0; i < A.length; i += 4) {
      const px = (i / 4) % lato - lato / 2, py = Math.floor((i / 4) / lato) - lato / 2;
      if (px * px + py * py > dentro) continue;
      const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
      somma += d; quanti++;
      if (d / 3 > peggio) peggio = d / 3;
    }
    return { medio: somma / (quanti * 3), peggio, quanti };
  });
  ok('e gli stessi pixel: il velo si apre su un’immagine che era già lì',
    diff.medio < 1 && diff.peggio < 24,
    `scarto medio ${diff.medio.toFixed(2)}, peggiore ${diff.peggio.toFixed(0)} su 255 (${diff.quanti} pixel)`);

  // ------------------------------------------------------------------ //
  titolo('sotto al velo pieno la scena non disegna a vuoto');
  // Due tele che si ridisegnano insieme su un telefono si sentono, ed è lo
  // stesso motivo per cui aprendo questa finestra il ciclo del cielo si mette
  // in pausa. Ma l'errore ha due versi molto diversi: risparmiare di troppo
  // vuol dire aprire il velo su una tela vuota, e allora la risposta dev'essere
  // pessimista dappertutto tranne che nel caso certo.
  const copre = await pagina.evaluate(() => {
    const ponte = document.getElementById('sol-transizione');
    const prima = { attivo: solVolo.attivo, op: ponte.style.opacity, copre: solVoloCoprente() };
    ponte.style.opacity = '0.6';
    const aprendo = solVoloCoprente();
    ponte.style.opacity = prima.op;
    solVolo.attivo = false;
    const spento = solVoloCoprente();
    solVolo.attivo = prima.attivo;
    return { pieno: prima.copre, aprendo, spento };
  });
  ok('col velo pieno la scena si ferma', copre.pieno);
  ok('appena comincia ad aprirsi riparte', !copre.aprendo);
  ok('e se il volo cade, riparte comunque', !copre.spento);
  // La prova che conta: quando il velo si apre, sotto c'è un'immagine viva.
  // Si azzera la tela della scena e si guarda che il ciclo la ridisegni entro
  // qualche fotogramma dalla fine del volo.
  await pagina.evaluate(() => { solVoloChiudi(); sol.ctx.clearRect(0, 0, sol.L, sol.H); });
  await pagina.waitForTimeout(250);
  const viva = await pagina.evaluate(() => {
    const d = sol.ctx.getImageData(0, 0, sol.L, sol.H).data;
    let acceso = 0;
    for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) acceso++;
    return acceso;
  });
  ok('e finito il volo la scena è di nuovo viva', viva > 100, `${viva} campioni dipinti`);

  // ------------------------------------------------------------------ //
  titolo('il velo si toglie sempre');
  // Un velo acceso è una scena che non si vede più: è il guasto peggiore che
  // questo pezzo possa avere, e non somiglia a un'animazione rotta —
  // somiglia a una finestra che non si apre.
  await pagina.evaluate(() => { solVoloChiudi(); });
  const dopo = await pagina.evaluate(() => ({
    display: getComputedStyle(document.getElementById('sol-transizione')).display,
    attivo: solVolo.attivo, raf: solVolo.raf
  }));
  ok('chiuso a mano, il velo se ne va', dopo.display === 'none' && !dopo.attivo && !dopo.raf);

  // Chiudendo la finestra a metà volo il velo non deve sopravviverle.
  await pagina.evaluate(() => { chiudiSistemaSolare(); });
  await pagina.waitForTimeout(200);
  await pagina.evaluate(() => { apriSistemaSolare(); });
  await pagina.waitForTimeout(400);
  const vivo = await pagina.evaluate(() => solVolo.attivo);
  await pagina.evaluate(() => { chiudiSistemaSolare(); });
  await pagina.waitForTimeout(200);
  const spento = await pagina.evaluate(() => ({
    attivo: solVolo.attivo, raf: solVolo.raf,
    display: getComputedStyle(document.getElementById('sol-transizione')).display
  }));
  ok('e chiudendo la finestra a metà volo, pure', vivo && !spento.attivo && !spento.raf);
  ok('senza lasciare un fotogramma appeso', spento.display === 'none');

  // Il volo si può rifare: si entra e si esce da questa finestra parecchie
  // volte in una serata, e un'animazione che gira una volta sola è peggio di
  // una che non gira affatto.
  await pagina.evaluate(() => { apriSistemaSolare(); });
  await pagina.waitForTimeout(400);
  ok('e la volta dopo riparte', await pagina.evaluate(() => solVolo.attivo));
  await pagina.evaluate(() => { chiudiSistemaSolare(); });

  // ------------------------------------------------------------------ //
  titolo('chi ha chiesto meno movimento');
  const ridotto = await contesto.newPage();
  ridotto.on('pageerror', e => { console.log('  ECCEZIONE: ' + e.message); ko++; });
  await ridotto.emulateMedia({ reducedMotion: 'reduce' });
  await ridotto.route('**cdn.tailwindcss.com**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await ridotto.route('**cdn.jsdelivr.net**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await ridotto.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ridotto.route('**/astronomy.browser.min.js', r =>
    r.fulfill({ body: libreria('astronomy-engine/astronomy.browser.min.js'), contentType: 'text/javascript' }));
  await ridotto.route('**/satellite.min.js', r =>
    r.fulfill({ body: libreria('satellite.js/dist/satellite.min.js'), contentType: 'text/javascript' }));
  ['**open-meteo.com/**', '**noaa.gov/**', '**celestrak.org/**', '**overpass**',
   '**amazonaws**', '**ipapi**', '**ipwho**', '**geojs**', '**upload.wikimedia.org/**',
   '**bigdatacloud**', '**nominatim**', '**adsb**'].forEach(u => ridotto.route(u, r => r.abort()));
  await ridotto.goto(`http://localhost:${PORTA}/index.html`, { waitUntil: 'domcontentloaded' });
  await ridotto.waitForTimeout(2200);
  await ridotto.evaluate(() => { mostraVista('cielo'); });
  await ridotto.waitForTimeout(900);
  await ridotto.evaluate(() => { apriSistemaSolare(); });
  await ridotto.waitForTimeout(300);
  ok('nessun volo: un cambio di scala non chiesto è la cosa da non fare',
    !(await ridotto.evaluate(() => solVolo.attivo)));
  await ridotto.waitForTimeout(700);
  ok('e il velo si apre lo stesso, subito',
    (await ridotto.evaluate(() =>
      getComputedStyle(document.getElementById('sol-transizione')).display)) === 'none');
  await ridotto.close();

  // ------------------------------------------------------------------ //
  titolo('e solo nel passaggio per cui esiste');
  // Il volo racconta una salita dal cielo osservato da terra e finisce con
  // la Terra al centro: fuori dal passaggio planetario → vista da fuori è
  // sbagliato due volte, perché da terra non ci si stava e perché la scena
  // arriva altrove. Sono tre porte diverse, e tutte e tre devono trovare la
  // dissolvenza corta.
  await pagina.evaluate(() => { mostraVista('stasera'); });
  await pagina.waitForTimeout(600);
  await pagina.evaluate(() => { apriSistemaSolare(); });
  await pagina.waitForTimeout(250);
  ok('da un’altra vista non si vola', !(await pagina.evaluate(() => solVolo.attivo)));
  await pagina.waitForTimeout(600);
  ok('e il velo si apre subito lo stesso',
    (await pagina.evaluate(() =>
      getComputedStyle(document.getElementById('sol-transizione')).display)) === 'none');
  await pagina.evaluate(() => { chiudiSistemaSolare(); });

  await apriIlCielo(pagina);
  await pagina.evaluate(() => { apriSistemaSolare({ senzaVolo: true }); });
  await pagina.waitForTimeout(250);
  ok('chi lo rifiuta esplicitamente non vola',
    !(await pagina.evaluate(() => solVolo.attivo)));
  await pagina.evaluate(() => { chiudiSistemaSolare(); });
  await pagina.waitForTimeout(200);

  /* E chi arriva con un'inquadratura sua **vola lo stesso**, ed è la
   * segnalazione che ha rifatto questo pezzo: per un periodo una tappa di
   * Missione Cielo che si gioca nella vista 3D si prendeva la dissolvenza
   * corta, perché la sua cornice non è quella su cui il volo atterra. Ma le
   * due non sono alternative: sono in fila. Si atterra sulla Terra, che è
   * dove l'incastro è esatto, e la cornice del bersaglio arriva **dopo**,
   * quando il velo si è aperto. Si controllano tutte e due le metà: che il
   * volo parta davvero, e che l'inquadratura non venga applicata prima
   * (se lo fosse, il tuffo non arriverebbe mai addosso alla Terra e
   * l'ultimo fotogramma del velo sarebbe uno scarto). */
  await apriIlCielo(pagina);
  await pagina.evaluate(() => {
    window.__inquadraFatta = 0;
    apriSistemaSolare({ inquadra: () => { window.__inquadraFatta++; } });
  });
  await pagina.waitForTimeout(250);
  ok('una tappa di Missione Cielo vola, e la sua cornice aspetta la fine',
    (await pagina.evaluate(() => solVolo.attivo && window.__inquadraFatta === 0)));
  await pagina.waitForTimeout(6800);   // SOL_VOLO_MS più il paracadute
  ok('…e appena il velo si apre la cornice arriva, una volta sola',
    (await pagina.evaluate(() => window.__inquadraFatta)) === 1);
  await pagina.evaluate(() => { chiudiSistemaSolare(); delete window.__inquadraFatta; });
  await pagina.waitForTimeout(200);

  // Col planetario puntato su un pianeta si entra nel quadro d'insieme: la
  // Terra non finisce al centro, quindi il volo non avrebbe dove atterrare.
  await apriIlCielo(pagina);
  await pagina.evaluate(() => { sky.target = 'Jupiter'; apriSistemaSolare(); });
  await pagina.waitForTimeout(250);
  ok('e con un pianeta scelto nemmeno: la Terra non arriva al centro',
    !(await pagina.evaluate(() => solVolo.attivo)));
  await pagina.evaluate(() => { chiudiSistemaSolare(); sky.target = null; });
  await pagina.waitForTimeout(200);

  // ------------------------------------------------------------------ //
  titolo('su un telefono');
  // La misura d'arrivo è in **pixel** e non in frazioni di schermo, quindi
  // su una tela piccola la Terra occupa molto di più: l'incastro dei due capi
  // non può darsi per scontato solo perché tiene su un monitor.
  await pagina.setViewportSize({ width: 360, height: 640 });
  await pagina.waitForTimeout(500);
  await apriIlCielo(pagina);
  await pagina.evaluate(() => { apriSistemaSolare(); });
  await pagina.waitForTimeout(350);
  const tel = await pagina.evaluate(() => {
    if (solVolo.raf) cancelAnimationFrame(solVolo.raf);
    solVolo.raf = 0;
    if (solVolo.timer) clearTimeout(solVolo.timer);
    const p = solVoloPosa(1);
    const c = solVoloCerchio(p, p.rho);
    solDisegna();
    const t = sol.pianeti.find(x => x.id === 'Earth');
    const meta = solVoloPosa(0.5);
    return {
      attivo: solVolo.attivo, L: solVolo.L, H: solVolo.H,
      dR: Math.abs(c.rc - t.rDisegno),
      dC: Math.hypot(solVolo.L / 2 - t.schermo.px, solVolo.H / 2 + c.dc - t.schermo.py),
      metaVicino: solVoloCerchio(meta, meta.rho).vicino
    };
  });
  ok('si vola anche qui', tel.attivo, `tela ${tel.L}×${tel.H}`);
  ok('e i due capi combaciano lo stesso', tel.dR < 0.5 && tel.dC < 0.6,
    `raggio ${tel.dR.toFixed(2)} px, centro ${tel.dC.toFixed(2)} px`);
  ok('e a metà volo il pianeta è dentro al quadro, non sotto al bordo',
    tel.metaVicino < tel.H / 2, `bordo a ${Math.round(tel.metaVicino)} px, mezza tela ${tel.H / 2}`);
  await pagina.evaluate(() => { chiudiSistemaSolare(); });

  console.log(ko ? `\n✗ ${ko} prove fallite` : '\n✓ tutte le prove passate');
  await browser.close();
  server.close();
  process.exit(ko ? 1 : 0);
})();
