// La mappa «Da dove guardare il cielo» del planetario, provata in un browser
// vero, col dito (telefono) e col mouse (computer).
//
// I difetti da cui nasce (v514): «Vai qua» non funzionava sempre.
//   - Toccando il segno, il fumetto si riapriva con un tasto morto: Leaflet
//     riscriveva il contenuto-stringa e l'ascoltatore `{ once: true }`
//     restava sul tasto di prima.
//   - Il fumetto poteva finire sotto alla fila «Mappa · Rilievo · Satellite»
//     o sotto ai tasti dello zoom: il dito premeva quelli.
//   - Trascinato il segno, o toccato una seconda volta, il fumetto spariva.
//   - Sul computer un clic singolo non faceva niente (serviva il doppio).
// Ogni caso sceglie un punto, preme «Vai qua» **dove è disegnato** (se sotto
// c'è un altro comando, lo dice) e controlla che il cielo si sia spostato.
//
//     npm install playwright-core astronomy-engine leaflet@1.9.4
//     node scripts/prova-luogo-mappa.js [cartella-per-le-istantanee]
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
  await new Promise(r => server.listen(8098, r));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  let ko = 0;
  const ok = (n, c, x) => {
    console.log((c ? '  ok        ' : '  FALLITO   ') + n + (x ? '   — ' + x : ''));
    if (!c) ko++;
  };

  for (const schermo of [
    { nome: 'telefono 390×800', telefono: true, width: 390, height: 800 },
    { nome: 'computer 1280×850', telefono: false, width: 1280, height: 850 }
  ]) {
    console.log(`\n— ${schermo.nome} —`);
    const telefono = schermo.telefono;
    const contesto = await browser.newContext({
      serviceWorkers: 'block', viewport: { width: schermo.width, height: schermo.height },
      hasTouch: telefono, isMobile: telefono
    });
    const pagina = await contesto.newPage();
    const errori = [];
    pagina.on('pageerror', e => errori.push('ECCEZIONE: ' + e.message));
    // Fuori rete: Leaflet e Astronomy Engine da node_modules, il resto no
    // (le tessere restano grigie, e alla prova non servono)
    await pagina.route('**/*', r => {
      const u = r.request().url();
      if (u.startsWith('http://localhost')) return r.continue();
      const l = u.match(/leaflet@1\.9\.4\/dist\/leaflet\.(js|css)$/);
      if (l) return r.fulfill({ body: fs.readFileSync(require.resolve('leaflet/dist/leaflet.' + l[1])),
                                contentType: l[1] === 'js' ? 'text/javascript' : 'text/css' });
      if (/astronomy\.browser\.min\.js$/.test(u)) return r.fulfill({
        body: fs.readFileSync(path.join(RADICE, 'node_modules/astronomy-engine/astronomy.browser.min.js')),
        contentType: 'text/javascript' });
      if (/cdn\.jsdelivr\.net/.test(u)) return r.fulfill({ body: '', contentType: /\.css/.test(u) ? 'text/css' : 'text/javascript' });
      return r.abort();
    });
    await pagina.goto('http://localhost:8098/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pagina.evaluate(() => {
      localStorage.setItem('astrocalendario_posizione',
        JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
      localStorage.setItem('astrocal_lingua', 'it');
    });
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await pagina.waitForTimeout(2500);
    await pagina.evaluate(() => mostraVista('cielo'));
    await pagina.waitForTimeout(1200);

    const tocca = (x, y) => telefono ? pagina.touchscreen.tap(x, y) : pagina.mouse.click(x, y);
    const caso = async (nome, gesto) => {
      await pagina.evaluate(() => { sky.luogoVista = null; apriMappaLuogoCielo(); });
      await pagina.waitForTimeout(500);
      const riquadro = await pagina.locator('#mappa-luogo').boundingBox();
      await gesto(riquadro);
      await pagina.waitForTimeout(450);
      const vai = pagina.locator('.luogo-vai-qua');
      const visibile = await vai.isVisible().catch(() => false);
      let sotto = null;
      if (visibile) {
        const b = await vai.boundingBox();
        const x = b.x + b.width / 2, y = b.y + b.height / 2;
        sotto = await pagina.evaluate(([x, y]) => {
          const e = document.elementFromPoint(x, y);
          return e ? (e.className || e.tagName) : null;
        }, [x, y]);
        if (ISTANTANEE) {
          fs.mkdirSync(ISTANTANEE, { recursive: true });
          await pagina.screenshot({ path: path.join(ISTANTANEE, `${telefono ? 'telefono' : 'computer'}-${nome}.png`) });
        }
        await tocca(x, y);
        await pagina.waitForTimeout(400);
      }
      const r = await pagina.evaluate(() => ({
        luogo: !!sky.luogoVista,
        chiusa: document.getElementById('modale-luogo-cielo').classList.contains('hidden')
      }));
      ok(`${nome}: «Vai qua» compare`, visibile);
      ok(`${nome}: e non sta sotto a un altro comando`, !visibile || sotto === 'luogo-vai-qua', String(sotto));
      ok(`${nome}: premuto, il cielo va lì`, r.luogo && r.chiusa);
      await pagina.evaluate(() => { if (luogoSchermoIntero) luogoEsciSchermoIntero(); chiudiMappaLuogoCielo(); });
    };

    await caso('un tocco', b => tocca(b.x + b.width * 0.35, b.y + b.height * 0.45));
    // In alto a sinistra stanno i tre fondi: il fumetto deve scendere sotto
    await caso('vicino ai fondi', b => tocca(b.x + 90, b.y + 95));
    // In alto a destra stanno lo zoom e i tasti della mappa
    await caso('vicino allo zoom', b => tocca(b.x + b.width - 70, b.y + 80));
    await caso('due punti di fila', async b => {
      await tocca(b.x + 80, b.y + 140); await pagina.waitForTimeout(500);
      await tocca(b.x + 200, b.y + 170);
    });
    await caso('segno trascinato', async b => {
      await tocca(b.x + 120, b.y + 160); await pagina.waitForTimeout(500);
      const s = await pagina.locator('.luogo-segno').boundingBox();
      await pagina.mouse.move(s.x + 15, s.y + 15); await pagina.mouse.down();
      await pagina.mouse.move(s.x + 60, s.y + 40, { steps: 8 }); await pagina.mouse.up();
    });
    // Il segno c'è già (il punto del cielo di adesso): toccarlo apre «Vai
    // qua» e il tasto risponde — era il tasto morto
    await caso('tocco sul segno', async () => {
      const s = await pagina.locator('.luogo-segno').boundingBox();
      await tocca(s.x + 15, s.y + 15);
    });
    await caso('due tocchi sul segno', async b => {
      await tocca(b.x + 150, b.y + 160); await pagina.waitForTimeout(500);
      const s = await pagina.locator('.luogo-segno').boundingBox();
      await tocca(s.x + 15, s.y + 15); await pagina.waitForTimeout(400);
      await tocca(s.x + 15, s.y + 15);
    });
    await caso('a schermo intero', async () => {
      await pagina.evaluate(() => luogoAlternaSchermoIntero()); await pagina.waitForTimeout(600);
      const c = await pagina.locator('#mappa-luogo').boundingBox();
      await tocca(c.x + 60, c.y + 130);
    });
    await caso('da una ricerca', async () => {
      await pagina.evaluate(() => luogoMappaScegli(46.0, 7.75, { centra: true, conferma: true, nome: 'Zermatt' }));
    });

    // A schermo intero la colonna di destra non sta sotto alla barra della
    // ricerca (sul telefono il tasto «Da Google Maps» copriva il «+»)
    const sovrapposti = await pagina.evaluate(async () => {
      apriMappaLuogoCielo(); luogoAlternaSchermoIntero();
      await new Promise(f => setTimeout(f, 500));
      const a = document.querySelector('.luogo-barra').getBoundingClientRect();
      const z = document.querySelector('#mappa-luogo .leaflet-control-zoom').getBoundingClientRect();
      luogoEsciSchermoIntero(); chiudiMappaLuogoCielo();
      return !(z.top >= a.bottom || z.right <= a.left || z.left >= a.right);
    });
    ok('a schermo intero lo zoom non sta sotto alla barra della ricerca', !sovrapposti);

    // Sul telefono «Guarda il cielo da qui» si vede senza scorrere
    if (telefono) {
      const tasto = await pagina.evaluate(async () => {
        apriMappaLuogoCielo(); await new Promise(f => setTimeout(f, 300));
        const r = document.getElementById('luogo-btn-usa').getBoundingClientRect();
        chiudiMappaLuogoCielo();
        return { basso: r.bottom, alto: innerHeight };
      });
      ok('«Guarda il cielo da qui» si vede senza scorrere', tasto.basso <= tasto.alto, `${Math.round(tasto.basso)} / ${tasto.alto}`);
    }

    const inglese = await pagina.evaluate(() => astroI18n.t('ui.vai-qua', {}, 'en') || '');
    ok('il tasto ha la sua scritta nei dizionari', !!inglese);
    ok('nessun errore nella pagina', errori.length === 0, errori.slice(0, 3).join(' | '));
    await contesto.close();
  }
  await browser.close();
  server.close();
  console.log(ko ? `\n${ko} prove fallite` : '\nTutto in ordine');
  process.exit(ko ? 1 : 0);
})();
