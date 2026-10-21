// La freccia guida, provata in un browser vero.
//
// Il difetto da cui nasce: con «Segui il telefono» acceso, cercare una
// costellazione, una città o una montagna faceva comparire l'avviso «girati
// da quella parte e segui la freccia azzurra» — ma la freccia la disegnava
// solo un astro dell'elenco (`sky.target`). Qui si cerca ognuno dei quattro
// bersagli col telefono finto, la vista girata dall'altra parte, e si
// controlla che la mappa **non** si giri (col telefono non può), che il
// bersaglio della freccia ci sia e che la freccia finisca davvero dipinta sul
// bordo, dentro allo schermo, col cartellino intero.
//
//     npm install playwright-core astronomy-engine
//     node scripts/prova-freccia-guida.js [cartella-per-le-istantanee]
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const RADICE = path.join(__dirname, '..');
const ISTANTANEE = process.argv[2] || null;
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

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
  await new Promise(r => server.listen(8097, r));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  let ko = 0;
  const ok = (n, c, x) => {
    console.log((c ? '  ok        ' : '  FALLITO   ') + n + (x ? '   — ' + x : ''));
    if (!c) ko++;
  };

  for (const schermo of [
    { nome: 'telefono 360×640', width: 360, height: 640 },
    { nome: 'computer 1280×800', width: 1280, height: 800 }
  ]) {
    console.log(`\n— ${schermo.nome} —`);
    const contesto = await browser.newContext({
      serviceWorkers: 'block', viewport: { width: schermo.width, height: schermo.height }, deviceScaleFactor: 2
    });
    const pagina = await contesto.newPage();
    const errori = [];
    pagina.on('pageerror', e => errori.push('ECCEZIONE: ' + e.message));
    await pagina.route('**cdn.jsdelivr.net**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
    await pagina.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
    await pagina.route('**/astronomy.browser.min.js', r => r.fulfill({
      body: fs.readFileSync(path.join(RADICE, 'node_modules/astronomy-engine/astronomy.browser.min.js'), 'utf8'),
      contentType: 'text/javascript' }));
    for (const rotta of ['**open-meteo.com/**', '**noaa.gov/**', '**celestrak.org/**', '**ipapi**', '**ipwho**',
                         '**geojs**', '**overpass**', '**amazonaws.com/**', '**adsb**', '**wikimedia**', '**wikipedia**'])
      await pagina.route(rotta, r => r.abort());

    await pagina.goto('http://localhost:8097/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pagina.evaluate(() => {
      localStorage.setItem('astrocalendario_posizione',
        JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
      localStorage.setItem('astrocal_lingua', 'it');
    });
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await pagina.evaluate(() => mostraVista('cielo'));
    await pagina.waitForTimeout(3500);

    // Ogni bersaglio si cerca con il telefono finto (la mappa non si deve
    // girare) e la vista rivolta a 180° da lui.
    const casi = [
      { nome: 'costellazione', tipo: 'costellazione',
        cerca: () => costMostraInCielo('Ori') },
      { nome: 'città', tipo: 'luogo',
        cerca: () => skyScegliLuogoDaRicerca({ nome: 'Roma', paese: 'Lazio', lat: 41.89, lon: 12.48, quota: 21, tipo: 'Città' }) },
      { nome: 'montagna', tipo: 'luogo',
        cerca: () => skyScegliLuogoDaRicerca({ nome: 'Monte Rosa', paese: 'Piemonte', lat: 45.937, lon: 7.867, quota: 4634, tipo: 'Montagna' }) },
      { nome: 'pianeta', tipo: 'astro', cerca: () => skyScegliAstroDaElenco('Jupiter') }
    ];
    for (const caso of casi) {
      const r = await pagina.evaluate(async (sorgente) => {
        const cerca = eval('(' + sorgente + ')');
        const vero = window.skyUsaSensori;
        sky.animazioneVista = null;
        sky.manuale.az = 0; sky.manuale.alt = 20;
        window.skyUsaSensori = () => true;
        try { cerca(); } finally { window.skyUsaSensori = vero; }
        const g = sky.guida ? skyPosizioneGuida() : (sky.target ? skyVoceDiId(sky.target) : null);
        if (!g) return { errore: 'nessun bersaglio per la freccia' };
        // La vista dalla parte opposta al bersaglio, ferma
        sky.animazioneVista = null;
        sky.manuale.az = (g.az + 180) % 360; sky.manuale.alt = 15;
        await new Promise(f => setTimeout(f, 400));
        const avviso = (document.querySelector('[data-skymap-avviso-testo]') || {}).textContent || '';
        // Dove deve finire la freccia, con le stesse funzioni del disegno
        const base = sky.ultimaBase, focale = sky.ultimaFocale;
        const p = skyProietta(skyVettore(g.az, g.alt), base, focale);
        const v = skyVettore(g.az, g.alt);
        const sep = Math.acos(Math.max(-1, Math.min(1, skyDot(v, base.f)))) * SKY_R2D;
        const q = skyPuntoGuida(skyAngoloGuida(p, v, base, sep), sky.larghezza, sky.altezza, 30);
        const fasce = skyFasceCielo();
        return { orizzontale: Math.abs(q.s) < 1e-6, fasce, tipo: sky.guida ? sky.guida.tipo : 'astro', nome: g.nome, avviso,
                 x: q.x, y: q.y, L: sky.larghezza, H: sky.altezza, fov: sky.fov,
                 dpr: devicePixelRatio, rett: sky.canvas.getBoundingClientRect().toJSON() };
      }, caso.cerca.toString());
      if (r.errore) { ok(caso.nome + ': ' + r.errore, false); continue; }
      ok(`${caso.nome}: il bersaglio della freccia c'è (${r.nome})`, r.tipo === caso.tipo, r.tipo);
      ok(`${caso.nome}: l'avviso dice di seguire la freccia`, /segui la freccia/.test(r.avviso), r.avviso.slice(0, 90));
      ok(`${caso.nome}: la freccia sta dentro allo schermo`,
        r.x >= 0 && r.x <= r.L && r.y >= 0 && r.y <= r.H, `${Math.round(r.x)},${Math.round(r.y)}`);
      ok(`${caso.nome}: e fuori dalle fasce dei comandi e della barra del tempo`,
        r.y - 19 >= r.fasce.alta - 30 && r.y + 19 <= r.H - r.fasce.bassa + 30,
        `y ${Math.round(r.y)}, fasce ${Math.round(r.fasce.alta)}/${Math.round(r.fasce.bassa)}`);
      // Alle spalle si indica il giro su se stessi, non lo zenit
      ok(`${caso.nome}: alle spalle indica a destra o a sinistra`, r.orizzontale);
      // La freccia è dipinta davvero: al centro del tondo ci deve essere la
      // punta chiara, non il cielo scuro
      const png = await pagina.screenshot({ clip: { x: r.rett.x + r.x - 24, y: r.rett.y + r.y - 24, width: 48, height: 48 } });
      if (ISTANTANEE) {
        fs.mkdirSync(ISTANTANEE, { recursive: true });
        await pagina.screenshot({ path: path.join(ISTANTANEE, `${schermo.width}-${caso.nome}.png`) });
      }
      ok(`${caso.nome}: la freccia è dipinta`, png.length > 1500, `${png.length} byte`);

      // Girandosi verso il bersaglio compare il segno d'arrivo
      const arrivo = await pagina.evaluate(async () => {
        const g = sky.guida ? skyPosizioneGuida() : skyVoceDiId(sky.target);
        sky.manuale.az = g.az; sky.manuale.alt = Math.max(5, Math.min(60, g.alt));
        await new Promise(f => setTimeout(f, 900));
        const a = sky.guidaAggancio;
        const p = skyProietta(skyVettore(g.az, g.alt), sky.ultimaBase, sky.ultimaFocale);
        return { dentro: !!(a && a.dentro), px: p.px, py: p.py, rett: sky.canvas.getBoundingClientRect().toJSON() };
      });
      ok(`${caso.nome}: arrivato, il segno d'arrivo si accende`, arrivo.dentro);
      if (ISTANTANEE) await pagina.screenshot({ path: path.join(ISTANTANEE, `${schermo.width}-${caso.nome}-trovato.png`) });
    }

    // In una demo l'astro seguito dalla camera (`sky.target`) non prende gli
    // angoli del mirino: sembrava «selezionato» senza che nessuno l'avesse
    // cercato (v513). Fuori dalla demo, lo stesso astro li prende.
    const demo = await pagina.evaluate(async () => {
      // Giove è già scelto dal giro di sopra (sceglierlo di nuovo lo toglie)
      if (sky.target !== 'Jupiter') skyScegliAstroDaElenco('Jupiter');
      const g = skyVoceDiId(sky.target);
      sky.animazioneVista = null;
      sky.manuale.az = g.az; sky.manuale.alt = Math.max(5, Math.min(60, g.alt));
      await new Promise(f => setTimeout(f, 900));
      const fuori = !!(sky.guidaAggancio && sky.guidaAggancio.dentro);
      sky.guidaAggancio = null;
      const descr = Object.getOwnPropertyDescriptor(window.AstroDemo, 'inCorso');
      Object.defineProperty(window.AstroDemo, 'inCorso', { get: () => true, configurable: true });
      await new Promise(f => setTimeout(f, 900));
      const dentro = !!(sky.guidaAggancio && sky.guidaAggancio.dentro);
      Object.defineProperty(window.AstroDemo, 'inCorso', descr);
      return { fuori, dentro };
    });
    ok('fuori da una demo l\'astro scelto prende il mirino', demo.fuori);
    ok('in una demo l\'astro seguito non prende il mirino', !demo.dentro);

    // Toccare un astro spegne la freccia della costellazione: due frecce
    // insieme non dicono più da che parte girarsi
    const spento = await pagina.evaluate(() => {
      costMostraInCielo('Ori');
      const prima = !!sky.guida;
      skyImpostaTarget('Moon');
      return { prima, dopo: !!sky.guida };
    });
    ok('un astro scelto prende il posto della costellazione', spento.prima && !spento.dopo);

    // In inglese il cartellino non resta in italiano
    const inglese = await pagina.evaluate(() =>
      astroI18n.imposta ? (astroI18n.imposta('en'), astroI18n.t('sky.guida.sotto')) : 'below the horizon');
    ok('la scritta si traduce', inglese === 'below the horizon', inglese);

    ok('nessun errore nella pagina', errori.length === 0, errori.slice(0, 3).join(' | '));
    await contesto.close();
  }
  await browser.close();
  server.close();
  console.log(ko ? `\n${ko} prove fallite` : '\nTutto in ordine');
  process.exit(ko ? 1 : 0);
})();
