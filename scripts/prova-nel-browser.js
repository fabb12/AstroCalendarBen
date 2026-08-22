const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Carica index.html in un browser vero e guarda cosa succede.
//
// È la prova che nessun banco di prova senza browser può dare: qui i file
// si caricano nell'ordine di index.html, gli script si parlano davvero, e
// un errore di caricamento salta fuori come salterebbe fuori all'utente.
//
// Serve, una volta sola:
//     npm install playwright-core
//     npx playwright install chromium      (o CHROMIUM=/percorso/a/chrome)
//
// Poi:
//     node scripts/prova-nel-browser.js
//
// Le librerie del CDN non si scaricano: Astronomy Engine viene servita da
// node_modules (npm install astronomy-engine) e le altre sono finte, così
// la prova riguarda il nostro codice e non la rete.

const CHROMIUM = process.env.CHROMIUM ||
  '/opt/pw-browsers/chromium/chrome-linux/chrome';

// Astronomy Engine: prima da node_modules, poi da dove dice ASTRONOMY_JS
function leggiAstronomy() {
  const posti = [
    process.env.ASTRONOMY_JS,
    path.join(__dirname, '..', 'node_modules', 'astronomy-engine', 'astronomy.browser.min.js'),
    '/tmp/package/astronomy.browser.min.js'
  ].filter(Boolean);
  for (const p of posti) if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  throw new Error('Astronomy Engine non trovata: npm install astronomy-engine, oppure ASTRONOMY_JS=/percorso/astronomy.browser.min.js');
}


const RADICE = path.join(__dirname, '..');
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

// I file dell'app vanno serviti da un server vero: con file:// il
// service worker non parte e i moduli caricati a mano falliscono.
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
  await new Promise(r => server.listen(8099, r));
  const browser = await chromium.launch({ executablePath: CHROMIUM });

  // Il service worker qui va spento, e per un motivo preciso: le sue
  // richieste non passano dalle rotte di Playwright, quindi andrebbe a
  // cercare le librerie sul CDN vero — che da questa macchina non si
  // raggiunge — e servirebbe il suo ripiego al posto loro. Finiremmo a
  // provare il comportamento offline del service worker invece del
  // codice dell'app. Quello si prova a parte.
  const contesto = await browser.newContext({ serviceWorkers: 'block' });
  const pagina = await contesto.newPage();

  const errori = [], avvisi = [], rete = [];
  pagina.on('console', m => {
    if (m.type() === 'error') errori.push(m.text());
    if (m.type() === 'warning') avvisi.push(m.text());
  });
  pagina.on('pageerror', e => errori.push('ECCEZIONE: ' + e.message));
  pagina.on('requestfailed', r => rete.push(r.url().replace('http://localhost:8099', '') + ' — ' + (r.failure() || {}).errorText));

  // Le librerie dal CDN qui non si raggiungono: le serviamo da locale,
  // così la prova riguarda il nostro codice e non la rete.
  //
  // L'ORDINE CONTA, ed è al contrario di come sembra: quando più rotte
  // combaciano, Playwright usa l'ULTIMA registrata. Il catch-all su
  // jsdelivr va quindi messo per primo, o si mangia Astronomy Engine e
  // tutta la prova fallisce per un motivo che non c'entra col codice.
  await pagina.route('**cdn.tailwindcss.com**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**cdn.jsdelivr.net**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pagina.route('**/astronomy.browser.min.js', r =>
    r.fulfill({ body: leggiAstronomy(), contentType: 'text/javascript' }));
  await pagina.route('**/api.open-meteo.com/**', r => r.abort());
  await pagina.route('**/air-quality-api.open-meteo.com/**', r => r.abort());
  await pagina.route('**/services.swpc.noaa.gov/**', r => r.abort());
  await pagina.route('**/celestrak.org/**', r => r.abort());
  await pagina.route('**ipapi**', r => r.abort());
  await pagina.route('**ipwho**', r => r.abort());
  await pagina.route('**geojs**', r => r.abort());

  console.log('\n— caricamento della pagina —');
  await pagina.goto('http://localhost:8099/index.html', { waitUntil: 'networkidle', timeout: 30000 });

  // Una posizione fissa, così i conti hanno un luogo
  await pagina.evaluate(() => {
    localStorage.setItem('astrocalendario_posizione',
      JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
  });
  await pagina.reload({ waitUntil: 'networkidle' });
  await pagina.waitForTimeout(2500);

  let ko = 0;
  const ok = (n, c, x) => { console.log((c ? '  ok        ' : '  FALLITO   ') + n + (x ? '   — ' + x : '')); if (!c) ko++; };

  // --- i moduli ci sono? ---
  const moduli = await pagina.evaluate(() => ({
    catalogo: typeof catCarica === 'function',
    corpi: typeof luneDiGiove === 'function',
    pianifica: typeof migliorDiStanotte === 'function',
    meteo: typeof caricaMeteoAstro === 'function',
    eventi: typeof aggiungiEventiExtra === 'function',
    eventiCalcolati: typeof eventiCalcolati !== 'undefined' ? eventiCalcolati.length : -1
  }));
  console.log('\n— i moduli nuovi —');
  Object.entries(moduli).forEach(([k, v]) => {
    if (k === 'eventiCalcolati') return;
    ok(`${k}.js caricato`, v === true);
  });
  ok('il calendario si è calcolato', moduli.eventiCalcolati > 0, `${moduli.eventiCalcolati} eventi`);

  // --- i nuovi eventi sono entrati? ---
  const tipi = await pagina.evaluate(() => {
    const cerca = t => eventiCalcolati.filter(e => e.titolo.includes(t)).length;
    return {
      superlune: cerca('Superluna') + cerca('Microluna'),
      opposizioni: cerca("all'opposizione"),
      venere: cerca('massimo splendore'),
      transiti: cerca('Transito di'),
      comete: cerca('Cometa'),
      esempi: eventiCalcolati.filter(e =>
        /Superluna|opposizione|splendore|Transito di|Cometa/.test(e.titolo))
        .slice(0, 6).map(e => e.dataTesto + ' — ' + e.titolo)
    };
  });
  console.log('\n— gli eventi nuovi nel calendario —');
  ok('superlune e microlune', tipi.superlune > 0, `${tipi.superlune}`);
  ok('opposizioni dei pianeti', tipi.opposizioni > 0, `${tipi.opposizioni}`);
  ok('massimo splendore di Venere', tipi.venere > 0, `${tipi.venere}`);
  console.log(`              transiti sul Sole entro l'orizzonte del calendario: ${tipi.transiti} (il prossimo di Mercurio e nel 2032, oltre)`);
  console.log(`              comete al massimo: ${tipi.comete}`);
  tipi.esempi.forEach(e => console.log('                ' + e));

  // --- il planetario, coi cataloghi ---
  console.log('\n— il planetario —');
  await pagina.evaluate(() => mostraVista('cielo'));
  await pagina.waitForTimeout(4000);

  const cielo = await pagina.evaluate(() => ({
    stato: typeof cat !== 'undefined' ? cat.stato : 'niente',
    stelle: typeof cat !== 'undefined' ? cat.quante : 0,
    figure: typeof cat !== 'undefined' && cat.figure ? cat.figure.length : 0,
    profondo: typeof cat !== 'undefined' && cat.profondo ? cat.profondo.length : 0,
    elenco: typeof skyElenco === 'function' ? skyElenco().length : 0,
    corpiMinori: typeof corpiMinori !== 'undefined' ? corpiMinori.stato : 'niente',
    limite: typeof catMagnitudineLimite === 'function' ? catMagnitudineLimite() : null
  }));
  const disegniCostellazioni = await pagina.evaluate(() => {
    const tasto = document.getElementById('skymap-btn-arte');
    return {
      attivi: typeof cost !== 'undefined' ? cost.arte : null,
      tastoAttivo: tasto ? tasto.classList.contains('attiva') : null,
      premuto: tasto ? tasto.getAttribute('aria-pressed') : null
    };
  });
  ok('i cataloghi sono arrivati', cielo.stato === 'pronto', cielo.stato);
  ok('cinquemila stelle', cielo.stelle >= 5044, `${cielo.stelle}`);
  ok('ottantanove figure', cielo.figure === 89);
  ok('centoquarantadue oggetti profondi', cielo.profondo === 142);
  ok('i corpi minori sono arrivati', cielo.corpiMinori === 'pronto', cielo.corpiMinori);
  ok("l'elenco degli astri si è arricchito", cielo.elenco > 150, `${cielo.elenco} voci`);
  ok('i disegni delle costellazioni partono spenti',
    disegniCostellazioni.attivi === false &&
      disegniCostellazioni.tastoAttivo === false &&
      disegniCostellazioni.premuto === 'false');
  console.log(`              magnitudine limite adesso: ${cielo.limite && cielo.limite.toFixed(1)}`);

  // --- il ciclo di disegno regge? ---
  const fps = await pagina.evaluate(() => new Promise(risolvi => {
    let n = 0; const t0 = performance.now();
    const conta = () => { n++; performance.now() - t0 < 2000 ? requestAnimationFrame(conta) : risolvi(n / 2); };
    requestAnimationFrame(conta);
  }));
  ok('il cielo gira fluido', fps > 30, `${fps.toFixed(0)} fotogrammi al secondo con tutto acceso`);

  // --- l'ombra lunare non cambia quando si ingrandisce ---
  // Questa prova usa il disegno vero di app.js su tele reali. Il difetto che
  // ha motivato la correzione si vedeva soltanto avvicinandosi alla Luna:
  // quindi non basta controllare la formula del colore, bisogna anche
  // verificare che la conversione angoli → pixel e il gradiente del canvas
  // conservino gli stessi toni a raggi molto diversi.
  const ombraLunare = await pagina.evaluate(() => {
    const s = { gamma: 0.62, umbra: 0.70, penombra: 1.25, rL: 0.25, pa: 0 };
    const ang = {
      nord: [1, 0, 0], est: [0, 1, 0],
      schermo: () => 0
    };
    const punti = [-0.75, 0, 0.75];
    const dipingi = (r) => {
      const margine = 3, lato = Math.ceil(r * 2 + margine * 2);
      const tela = document.createElement('canvas');
      tela.width = tela.height = lato;
      const ctx = tela.getContext('2d', { willReadFrequently: true });
      ctx.translate(r + margine, r + margine);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      skyDisegnaOmbraLunare(ctx, r, { ombraTerra: s }, ang);
      return punti.map(x => Array.from(ctx.getImageData(
        Math.round(r + margine + x * r), Math.round(r + margine), 1, 1).data.slice(0, 3)));
    };
    const raggi = [28, 160, 1000], campioni = raggi.map(dipingi);
    let scarto = 0;
    for (let i = 1; i < campioni.length; i++) {
      for (let p = 0; p < punti.length; p++) {
        for (let c = 0; c < 3; c++) scarto = Math.max(scarto, Math.abs(campioni[i][p][c] - campioni[0][p][c]));
      }
    }
    return { raggi, campioni, scarto };
  });
  ok('sfumature dell’eclissi invarianti ingrandendo la Luna',
    ombraLunare.scarto <= 4,
    `raggi ${ombraLunare.raggi.join(' → ')} px, scarto massimo ${ombraLunare.scarto}/255`);

  // --- le lune di Giove ---
  const giove = await pagina.evaluate(() => {
    const r = luneDiGioveRacconto(new Date());
    return r ? { fila: r.fila, quante: r.lune.length } : null;
  });
  ok('le lune di Giove si calcolano', giove && giove.quante === 4, giove && giove.fila);

  // --- la pianificazione ---
  const migliori = await pagina.evaluate(() => {
    const m = migliorDiStanotte(5);
    return m.map(x => `${x.nome} (${x.punti}) — ${x.motivi[0]}`);
  });
  ok('i migliori di stanotte', migliori.length > 0, `${migliori.length} proposte`);
  migliori.forEach(m => console.log('                ' + m));

  // --- la griglia del meteo, senza rete ---
  const griglia = await pagina.evaluate(() => {
    try { return meteoGrigliaHtml(24).slice(0, 60); } catch (e) { return 'ECCEZIONE: ' + e.message; }
  });
  ok('la griglia meteo non esplode senza previsioni', !griglia.startsWith('ECCEZIONE'), griglia.slice(0, 50));

  // --- l'interfaccia nuova è davvero a schermo? ---
  console.log('\n— l\'interfaccia —');
  await pagina.evaluate(() => mostraVista('stasera'));
  await pagina.waitForTimeout(1500);
  const ui = await pagina.evaluate(() => {
    const t = id => { const e = document.getElementById(id); return e ? (e.textContent||'').trim().length : -1; };
    document.getElementById('btn-impostazioni').click();
    return {
      migliori: document.querySelectorAll('#stasera-migliori .riga-migliore').length,
      sottotitolo: (document.getElementById('migliori-sottotitolo')||{}).textContent || '',
      grigliaMeteo: t('meteo-astro-griglia'),
      cieloScelta: document.querySelectorAll('#imp-cielo-scelta .tasto-cielo-casa').length,
      orizzonte: document.querySelectorAll('#imp-orizzonte input').length,
      notaCielo: (document.getElementById('imp-cielo-nota')||{}).textContent || ''
    };
  });
  ok('i migliori di stanotte sono a schermo', ui.migliori > 0, `${ui.migliori} righe`);
  ok('il sottotitolo racconta la notte', ui.sottotitolo.length > 10, ui.sottotitolo);
  ok('la scala di Bortle è nelle impostazioni', ui.cieloScelta === 6, `${ui.cieloScelta} tacche`);
  ok('il profilo degli ostacoli ha sedici settori', ui.orizzonte === 16, `${ui.orizzonte}`);
  console.log('              ' + ui.notaCielo);

  // --- la scheda dell'oggetto: lune di Giove e curva della notte ---
  await pagina.evaluate(() => { document.getElementById('btn-chiudi-impostazioni').click(); mostraVista('cielo'); });
  await pagina.waitForTimeout(2500);
  const scheda = await pagina.evaluate(() => {
    sky.selezione = { categoria: 'astro', id: 'Jupiter' };
    const p = document.getElementById('pannello-dettaglio') || document.querySelector('.pannello-dettaglio');
    if (p) p.classList.add('visibile');
    skyAggiornaScheda && skyAggiornaScheda();
    return {
      lune: !!document.getElementById('scheda-lune-giove'),
      curva: !!document.getElementById('scheda-curva-notte'),
      fila: (document.querySelector('.fila-lune')||{}).textContent || '',
      racconto: (document.getElementById('scheda-curva-testo')||{}).textContent || ''
    };
  });
  ok('la scheda di Giove mostra le sue lune', scheda.lune, scheda.fila);
  ok('e la curva della notte', scheda.curva, scheda.racconto);

  console.log('\n— errori in console —');
  const veri = errori.filter(e => !/favicon|manifest|Failed to load resource|navigator.vibrate|FullCalendar/i.test(e));
  if (veri.length) { veri.slice(0, 10).forEach(e => console.log('  ✗ ' + e.slice(0, 160))); ko += veri.length; }
  else console.log('  nessuno');

  const reteVera = rete.filter(r => !/open-meteo|swpc|celestrak|ipapi|ipwho|geojs|favicon/.test(r));
  if (reteVera.length) { console.log('\n— richieste fallite —'); reteVera.slice(0, 8).forEach(r => console.log('  ✗ ' + r)); ko += reteVera.length; }

  await browser.close();
  server.close();
  console.log(ko ? `\n${ko} PROBLEMI\n` : '\nTutto a posto.\n');
  process.exit(ko ? 1 : 0);
})();
