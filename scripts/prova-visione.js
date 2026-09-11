// Quanto costa la realtà aumentata, in millisecondi per giro.
//
//     npm install playwright-core astronomy-engine
//     node scripts/prova-visione.js
//
// Il motore di vista (`visione.js`) gira dodici volte al secondo dentro al
// ciclo di disegno del planetario, su un telefono che nel frattempo deve
// anche decodificare il video della fotocamera e disegnare il cielo. È
// l'unico pezzo di questa applicazione che guardi **dei pixel** invece di
// fare dei conti, e il costo non si può indovinare leggendo il codice: un
// ciclo annidato di tre righe che cerca una pezza di cinque per cinque in una
// finestra di tredici per tredici, per ventotto riferimenti, sono
// duecentotrentaseimila letture di memoria — e sul foglio sembrano tre righe.
//
// Le prove del §32 di `verifica.html` dicono che l'aggancio **trova la
// risposta giusta**; questa dice che ci arriva **in tempo**. Da sapere prima
// di leggere i numeri: qui non c'è una GPU e il browser gira a software,
// quindi i millisecondi assoluti sono più alti che su un telefono — quello
// che conta è il rapporto fra prima e dopo.
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const RADICE = path.join(__dirname, '..');
const PORTA = 8102;
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

// I tetti. Il giro intero deve stare dentro alla sua fetta di fotogramma: la
// cadenza è di ottanta millisecondi e il modulo si autolimita sopra i nove,
// quindi un giro che ne costa dodici vuol dire che il motore rallenta da sé
// fino a tre giri al secondo — cioè un aggancio che arriva tardi.
const TETTO_GIRO = 9;
const TETTO_SCENA = 4;
const TETTO_MACCHIE = 5;

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
    viewport: { width: 400, height: 760 } });
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on('pageerror', e => errori.push(e.message));

  const astronomy = path.join(RADICE, 'node_modules/astronomy-engine/astronomy.browser.min.js');
  if (!fs.existsSync(astronomy)) throw new Error('npm install astronomy-engine');
  await pagina.route('**/astronomy.browser.min.js', r =>
    r.fulfill({ body: fs.readFileSync(astronomy, 'utf8'), contentType: 'text/javascript' }));
  await pagina.route('**cdn.tailwindcss.com**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
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
    if (typeof skySpegniCiclo === 'function') skySpegniCiclo();
    window.skyVigilaCicli = () => {};
    const V = window.Visione;
    if (!V || !V.visSeguiScena) return { errore: 'il motore di vista non è esposto' };

    // La misura del fotogramma ridotto è quella vera: il modulo la ricava dal
    // riquadro del planetario con il suo bilancio di pixel.
    const L = V.visLatoRidotto(sky.larghezza, sky.altezza);
    const H = Math.max(24, Math.round(L * sky.altezza / sky.larghezza));

    // Un cielo finto, ma fatto come sono fatti quelli veri: il gradiente del
    // crepuscolo in alto, il terreno in basso — che è **metà fotogramma** e
    // che di riferimenti astronomici non ne contiene nessuno —, qualche
    // sorgente puntiforme e la grana del sensore. È lo scenario peggiore per
    // il costo: sotto l'orizzonte c'è tutto il disordine di una città.
    const seme = (n) => { let s = n | 0 || 1; return () => {
      s = Math.imul(s ^ (s >>> 16), 0x45d9f3b); s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
      return ((s ^ (s >>> 16)) >>> 0) / 4294967296; }; };
    // Dove cade l'orizzonte lo dice **la posa**, non un numero scritto a
    // mano: se l'immagine finta e la fascia calcolata non sono d'accordo si
    // misura una geometria che non esiste — e il primo tentativo, con la riga
    // a metà fotogramma e la fascia che ne prendeva il 71%, faceva filtrare
    // al rivelatore un quinto di fotogramma di terreno sinusoidale, cioè
    // centinaia di macchie che in cielo non ci sono.
    let orizzonteRiga = Math.round(H * 0.52);
    function fotogramma(dx, dy) {
      const caso = seme(12345);
      const luma = new Float32Array(L * H);
      const orizzonte = orizzonteRiga;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < L; x++) {
          let v;
          if (y < orizzonte) v = 26 + (orizzonte - y) * 0.12;       // cielo
          else v = 44 + Math.sin((x + y * 1.7) * 0.7) * 9;          // terreno
          luma[y * L + x] = v + caso() * 3;
        }
      }
      // Gli spigoli del paesaggio, che sono i riferimenti veri di notte.
      for (let i = 0; i < 30; i++) {
        const bx = Math.round(6 + caso() * (L - 12) + dx);
        const by = Math.round(orizzonte + 4 + caso() * (H - orizzonte - 10) + dy);
        for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
          const px = bx + x, py = by + y;
          if (px < 0 || px >= L || py < 0 || py >= H) continue;
          luma[py * L + px] += (x >= 0 && y >= 0) ? 55 : -25;
        }
      }
      // Gli astri.
      for (let i = 0; i < 6; i++) {
        const sx = 8 + caso() * (L - 16) + dx, sy = 6 + caso() * (orizzonte - 12) + dy;
        for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
          const px = Math.round(sx) + x, py = Math.round(sy) + y;
          if (px < 0 || px >= L || py < 0 || py >= H) continue;
          luma[py * L + px] += 120 * Math.exp(-(x * x + y * y) / 2.2);
        }
      }
      return { luma, largo: L, alto: H,
        perPixelX: sky.larghezza / L, perPixelY: sky.altezza / H };
    }

    // Si punta il telefono **verso l'orizzonte**, che è la posa peggiore per
    // il costo (metà fotogramma è terra, e la terra è piena di spigoli) e
    // quella in cui si usa la realtà aumentata per guardare un aereo. La
    // terna si costruisce a mano perché la posa dev'essere quella, non quella
    // in cui il planetario si trova ad essere.
    const D2R = Math.PI / 180;
    const verso = (az, alt) => {
      const a = az * D2R, h = alt * D2R;
      const f = [Math.cos(h) * Math.sin(a), Math.cos(h) * Math.cos(a), Math.sin(h)];
      const r = [Math.cos(a), -Math.sin(a), 0];
      return { f, r, u: [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]] };
    };
    const base = verso(120, 14);
    const focale = skyFocale();
    const out = { L, H, pixel: L * H };
    // Le due fasce, come le calcola il motore vero. Se non esistono ancora
    // (codice di prima), si misura tutto il fotogramma, che è quello che
    // faceva.
    const misure = { largo: L, alto: H,
      perPixelX: sky.larghezza / L, perPixelY: sky.altezza / H };
    const cielo = V.visFasciaCielo ? V.visFasciaCielo(base, focale, misure, V.VIS_ORIZZONTE_MARGINE) : null;
    const terra = V.visFasciaTerra ? V.visFasciaTerra(base, focale, misure, V.VIS_SCENA_SOPRA) : null;
    if (cielo && cielo.yMax >= cielo.yMin) orizzonteRiga = Math.min(H - 8, cielo.yMax);
    out.fettaCielo = cielo && cielo.yMax >= cielo.yMin ? (cielo.yMax - cielo.yMin + 1) / H : 1;

    // --- Le macchie: fondo, residuo, massimi locali, centroidi ---------
    {
      const f = fotogramma(0, 0);
      for (let i = 0; i < 30; i++) V.visRilevaMacchie(f.luma, L, H, { fascia: cielo });
      const t0 = performance.now();
      for (let i = 0; i < 60; i++) V.visRilevaMacchie(f.luma, L, H, { fascia: cielo });
      out.macchie = (performance.now() - t0) / 60;
      out.quante = V.visRilevaMacchie(f.luma, L, H, { fascia: cielo }).macchie.length;
      // Dove va il tempo, dentro al rivelatore. È la misura che ha rimesso a
      // posto le priorità: il residuo e la stima del rumore costano insieme
      // sette decimi di millisecondo, e tutto il resto sta nella cernita dei
      // picchi — cioè nel **numero di candidati**, non nel numero di pixel.
      // Ed è la ragione per cui la fascia di cielo rende molto più di quanto
      // valga la sua fetta di fotogramma: quello che toglie non sono i pixel,
      // sono i lampioni.
      if (V.visRiquadroResiduo) {
        const riq = V.visRiquadroResiduo(cielo, L, H);
        for (let i = 0; i < 20; i++) V.visResiduo(f.luma, L, H, 7, riq);
        let t1 = performance.now();
        for (let i = 0; i < 60; i++) V.visResiduo(f.luma, L, H, 7, riq);
        out.residuo = (performance.now() - t1) / 60;
        const res = V.visResiduo(f.luma, L, H, 7, riq);
        t1 = performance.now();
        for (let i = 0; i < 60; i++) V.visRumore(res, L, riq);
        out.rumore = (performance.now() - t1) / 60;
        const rum = V.visRumore(res, L, riq);
        t1 = performance.now();
        for (let i = 0; i < 60; i++) V.visRilevaMacchie(f.luma, L, H, { fascia: cielo, residuo: res, rumore: rum });
        out.picchi = (performance.now() - t1) / 60;
      }
    }

    // --- Il paesaggio: l'inseguimento delle pezze ----------------------
    //
    // Due fotogrammi che differiscono di uno spostamento della camera, che è
    // il caso normale: fra un giro e l'altro passano ottanta millisecondi e
    // la mano trema comunque.
    {
      V.stato.scena = null;
      const a = fotogramma(0, 0), b = fotogramma(3, -2);
      V.visSeguiScena(a, base, focale, terra);          // semina
      for (let i = 0; i < 10; i++) V.visSeguiScena(b, base, focale, terra);
      const t0 = performance.now();
      for (let i = 0; i < 40; i++) V.visSeguiScena(i % 2 ? a : b, base, focale, terra);
      out.scena = (performance.now() - t0) / 40;
      out.puntiScena = (V.stato.scena && V.stato.scena.punti.length) || 0;
      out.coppieScena = V.visSeguiScena(b, base, focale, terra).coppie.length;
    }

    // --- Il giro intero, come lo paga il ciclo di disegno --------------
    {
      V.stato.scena = null;
      const f = [fotogramma(0, 0), fotogramma(2, -1), fotogramma(-1, 2)];
      const uno = (k) => {
        const fot = f[k % 3];
        V.visRilevaMacchie(fot.luma, L, H, { fascia: cielo });
        V.visSeguiScena(fot, base, focale, terra);
      };
      for (let i = 0; i < 30; i++) uno(i);
      const t0 = performance.now();
      for (let i = 0; i < 40; i++) uno(i);
      out.giro = (performance.now() - t0) / 40;
    }
    return out;
  });

  if (esito.errore) {
    console.log('non si è potuto misurare: ' + esito.errore);
    await browser.close(); server.close(); process.exit(1);
  }

  console.log(`Fotogramma ridotto: ${esito.L}×${esito.H} = ${esito.pixel} pixel` +
    `, di cui cielo il ${Math.round((esito.fettaCielo || 1) * 100)}%\n`);
  if (esito.residuo !== undefined) {
    console.log(`  (dentro: residuo ${esito.residuo.toFixed(2)} ms, rumore ` +
      `${esito.rumore.toFixed(2)}, picchi e centroidi ${esito.picchi.toFixed(2)})`);
  }
  prova('le macchie: fondo, residuo, massimi e centroidi',
    esito.macchie < TETTO_MACCHIE, `${esito.macchie.toFixed(2)} ms, ${esito.quante} macchie trovate`);
  prova('il paesaggio: l\'inseguimento delle pezze',
    esito.scena < TETTO_SCENA,
    `${esito.scena.toFixed(2)} ms, ${esito.puntiScena} punti, ${esito.coppieScena} agganciati`);
  prova('il giro intero sta dentro alla sua fetta di fotogramma',
    esito.giro < TETTO_GIRO, `${esito.giro.toFixed(2)} ms (si rallenta da sé oltre ${TETTO_GIRO})`);

  if (errori.length) {
    console.log('\nerrori in console:');
    errori.slice(0, 10).forEach(e => console.log('  ' + e));
  }
  console.log(`\nverdi: ${passate}   rosse: ${fallite}`);
  await browser.close();
  server.close();
  process.exit(fallite ? 1 : 0);
})();
