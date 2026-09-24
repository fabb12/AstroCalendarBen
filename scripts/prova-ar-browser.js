#!/usr/bin/env node
'use strict';
/* La realtà aumentata in un browser vero: etichette e allineamento a mano.
 *
 *     npm install playwright-core astronomy-engine
 *     node scripts/prova-ar-browser.js
 *
 * `scripts/prova-ar-calibrazione.js` prova i conti: che il dito porti
 * l'oggetto sotto di sé e tutto il cielo con lui. Qui si prova quello che i
 * conti non vedono, e che si guasta in silenzio:
 *
 *   - che con la fotocamera accesa gli astri **non** si ridisegnino (una
 *     seconda Luna sopra quella vera è la cosa che questa modifica esiste per
 *     togliere) e che al loro posto ci siano i nomi;
 *   - che il percorso dell'interfaccia sia percorribile per davvero: il
 *     tasto «Allinea», la scelta dell'oggetto, il tocco sul velo col mirino
 *     sollevato, il pannello dell'esito, «Annulla»;
 *   - che su un telefono dritto e girato il pannello stia dentro lo schermo,
 *     sopra alla barra del tempo, coi tasti abbastanza grandi per un pollice.
 *
 * La fotocamera e i sensori non ci sono (Chromium senza testa): si finge lo
 * stream e si usa la vista a mano, che è la stessa proiezione.
 */

const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Il Chromium dell'ambiente se c'è, se no quello che Playwright si è
// scaricato da sé (in CI): la stessa scelta di `prova-rilievo-zoom.js`.
const CHROMIUM = process.env.CHROMIUM || [
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
].find(p => fs.existsSync(p));
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

(async () => {
  await new Promise(r => server.listen(8097, r));
  const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  let ko = 0;
  const ok = (n, c, x) => {
    console.log((c ? '  ok        ' : '  FALLITO   ') + n + (x ? '   — ' + x : ''));
    if (!c) ko++;
  };

  for (const schermo of [
    { nome: 'telefono 360×640', width: 360, height: 640 },
    { nome: 'telefono girato 640×360', width: 640, height: 360 },
    { nome: 'computer 1280×800', width: 1280, height: 800 }
  ]) {
    console.log(`\n— ${schermo.nome} —`);
    const contesto = await browser.newContext({
      serviceWorkers: 'block', viewport: { width: schermo.width, height: schermo.height },
      deviceScaleFactor: 2, hasTouch: schermo.width < 1000
    });
    const pagina = await contesto.newPage();
    const errori = [];
    pagina.on('pageerror', e => errori.push('ECCEZIONE: ' + e.message));
    for (const rotta of ['**cdn.jsdelivr.net**', '**fonts.googleapis.com**'])
      await pagina.route(rotta, r => r.fulfill({ body: '', contentType: 'text/javascript' }));
    for (const rotta of ['**open-meteo.com/**', '**noaa.gov/**', '**celestrak.org/**', '**ipapi**',
                         '**ipwho**', '**geojs**', '**overpass**', '**amazonaws.com/**', '**adsb**',
                         '**bigdatacloud**', '**nominatim**'])
      await pagina.route(rotta, r => r.abort());
    await pagina.route('**/astronomy.browser.min.js', r =>
      r.fulfill({ body: leggiAstronomy(), contentType: 'text/javascript' }));

    await pagina.goto('http://localhost:8097/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pagina.evaluate(() => {
      localStorage.setItem('astrocalendario_posizione',
        JSON.stringify({ lat: 45.81, lon: 9.08, nome: 'Como', fonte: 'manuale' }));
      localStorage.setItem('astrocal_lingua', 'it');
    });
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await pagina.evaluate(() => mostraVista('cielo'));
    await pagina.waitForTimeout(3000);

    // La scena: la vista puntata a sud-ovest, una vetta e un aereo finti lì
    // davanti, una stella e un pianeta finti in cielo. Finti perché la
    // prova non deve dipendere dall'ora in cui gira: la Luna, alle tre del
    // pomeriggio, è dall'altra parte del cielo.
    const scena = await pagina.evaluate(() => {
      sky.seguiTelefono = false;
      sky.manuale.az = 220; sky.manuale.alt = 12;
      window.cimeVisibili = () => [{ nome: 'Monte Prova', quota: 1900, km: 21, az: 214, alt: 4 }];
      window.cittaVicine = () => [];
      AereiADS_B.stato.visibile = false;
      AereiADS_B.stato.aerei = [{ id: 'fff001', callsign: 'TST001', az: 226, alt: 16,
        distanzaKm: 14, quotaM: 5200, lat: 45.7, lon: 8.95, ultimaLettura: Date.now() / 1000 }];
      AereiADS_B.aereoCieloOra = (a) => a;
      // Gli astri di adesso non si toccano: se ne aggiunge uno a mano, e lo
      // si rimette ogni volta che il giro degli astri lo toglierebbe.
      window.__astroFinto = { id: 'Jupiter', tipo: 'pianeta', nome: 'Giove', az: 232, alt: 20, mag: -2.4,
        colore: '#fcd34d', disegno: 'pianeta' };
      const metti = () => {
        sky.oggetti = (sky.oggetti || []).filter(o => o.id !== 'Jupiter').concat([window.__astroFinto]);
      };
      window.__mettiAstro = metti;
      const giroVero = window.skyAggiornaOggetti;
      window.skyAggiornaOggetti = function () { const r = giroVero.apply(this, arguments); metti(); return r; };
      metti();
      sky.luceCielo = 0.02;
      return { L: sky.larghezza, H: sky.altezza };
    });

    // --- Senza fotocamera: gli astri si disegnano come sempre --------------
    const conta = await pagina.evaluate(() => {
      const vero = window.skyDisegnaAstro;
      let tipi = [];
      window.skyDisegnaAstro = function (ctx, b, f, o) { tipi.push(o.tipo); return vero.apply(this, arguments); };
      window.__mettiAstro();
      skyDisegna();
      const senza = tipi.slice();
      // Con la fotocamera: uno stream finto basta al disegno.
      tipi = [];
      sky.camera = { getTracks: () => [], finto: true };
      if (!visAttivo()) visAvvia();
      window.__mettiAstro();
      skyDisegna();
      const con = tipi.slice();
      window.skyDisegnaAstro = vero;
      const etichette = Visione.stato.etichette.map(p => ({ id: p.voce.id, genere: p.voce.genere,
        nome: p.voce.nome, messo: !!p.rett, px: p.voce.px, py: p.voce.py, rett: p.rett }));
      return { senza, con, etichette };
    });
    ok('senza fotocamera il pianeta si disegna', conta.senza.includes('pianeta'));
    ok('con la fotocamera nessun astro reale si ridisegna',
      !conta.con.some(t => ['sole', 'luna', 'pianeta', 'stella'].includes(t)), conta.con.join(','));
    const nomi = conta.etichette.filter(e => e.messo).map(e => e.nome);
    ok('al suo posto c\'è il nome del pianeta', nomi.includes('Giove'), nomi.join(', '));
    ok('l\'aereo è nominato col suo identificativo', nomi.some(n => n === 'TST001'), nomi.join(', '));
    ok('la vetta è nominata', nomi.includes('Monte Prova'), nomi.join(', '));
    const dentro = conta.etichette.filter(e => e.messo).every(e =>
      e.rett.x0 >= 0 && e.rett.x1 <= scena.L && e.rett.y0 >= 0 && e.rett.y1 <= scena.H);
    ok('ogni etichetta sta dentro al riquadro', dentro);
    const messe = conta.etichette.filter(e => e.messo);
    let sovrapposte = 0;
    for (let i = 0; i < messe.length; i++) for (let j = i + 1; j < messe.length; j++) {
      const a = messe[i].rett, b = messe[j].rett;
      if (a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0) sovrapposte++;
    }
    ok('nessuna etichetta si sovrappone a un\'altra', sovrapposte === 0, String(sovrapposte));

    // --- Il percorso dell'allineamento a mano ------------------------------
    const tasto = await pagina.evaluate(() => {
      visAggiornaHud();
      const t = document.getElementById('ar-allinea');
      const r = t.getBoundingClientRect();
      return { visibile: !t.classList.contains('hidden') && r.width > 0, h: r.height };
    });
    ok('con la realtà aumentata accesa il tasto «Allinea» c\'è', tasto.visibile);
    ok('ed è abbastanza alto per un pollice', tasto.h >= 28, String(tasto.h));

    await pagina.click('#ar-allinea');
    const scegli = await pagina.evaluate(() => {
      const p = document.getElementById('ar-calibra');
      return {
        aperto: !p.hidden, fase: p.dataset.fase,
        velo: !document.getElementById('ar-calibra-velo').hidden,
        scelte: Array.from(p.querySelectorAll('.ar-calibra-scelta')).map(b => b.textContent)
      };
    });
    ok('il pannello si apre sulla scelta dell\'oggetto', scegli.aperto && scegli.fase === 'scegli');
    ok('il velo prende i tocchi', scegli.velo);
    ok('fra le scelte c\'è Giove, l\'aereo e la vetta',
      ['Giove', 'TST001', 'Monte Prova'].every(n => scegli.scelte.includes(n)), scegli.scelte.join(', '));

    const geom = await pagina.evaluate(() => {
      const p = document.getElementById('ar-calibra').getBoundingClientRect();
      const barra = document.getElementById('cielo-tempo');
      const b = barra ? barra.getBoundingClientRect() : null;
      const tasti = Array.from(document.querySelectorAll('#ar-calibra .ar-calibra-tasto'))
        .map(x => x.getBoundingClientRect().height);
      return { p: { top: p.top, bottom: p.bottom, left: p.left, right: p.right },
        barraTop: b ? b.top : null, W: innerWidth, H: innerHeight, tastoMin: Math.min(...tasti) };
    });
    ok('il pannello sta dentro lo schermo', geom.p.left >= 0 && geom.p.right <= geom.W && geom.p.top >= 0,
      JSON.stringify(geom.p));
    ok('e sopra alla barra del tempo', geom.barraTop === null || geom.p.bottom <= geom.barraTop + 1,
      `${geom.p.bottom} / ${geom.barraTop}`);
    ok('coi tasti da pollice', geom.tastoMin >= 28, String(geom.tastoMin));

    // Si sceglie Giove col suo nome.
    await pagina.evaluate(() => {
      Array.from(document.querySelectorAll('#ar-calibra .ar-calibra-scelta'))
        .find(b => b.textContent === 'Giove').click();
    });
    const tocca = await pagina.evaluate(() => ({
      fase: document.getElementById('ar-calibra').dataset.fase,
      riga: document.querySelector('#ar-calibra .ar-calibra-riga').textContent
    }));
    ok('scelto l\'oggetto, il pannello dice di toccare dove lo si vede', tocca.fase === 'tocca' &&
      /Giove/.test(tocca.riga), tocca.riga);

    // Il dito tocca un grado e mezzo più in là di dove Giove è disegnato:
    // è lì che lo si vede davvero. Col mouse il mirino è sul puntatore.
    const bersaglio = await pagina.evaluate(() => {
      window.__mettiAstro();
      const base = sky.ultimaBase, f = sky.ultimaFocale;
      const disegnato = skyProietta(skyVettore(232, 20), base, f);
      const reale = skyProietta(skyVettore(233.5, 19.4), base, f);
      const tela = document.getElementById('skymap-canvas').getBoundingClientRect();
      const sx = tela.width / sky.larghezza, sy = tela.height / sky.altezza;
      return { x: tela.left + reale.px * sx, y: tela.top + reale.py * sy,
        disegnato, reale, dist: Math.hypot(reale.px - disegnato.px, reale.py - disegnato.py) };
    });
    await pagina.mouse.move(bersaglio.x, bersaglio.y);
    await pagina.mouse.down();
    const mira = await pagina.evaluate(() => Visione.stato.calibra.puntatore);
    await pagina.mouse.up();
    ok('mentre il dito è giù il mirino segue il puntatore', !!mira);
    const fatto = await pagina.evaluate(() => ({
      fase: document.getElementById('ar-calibra').dataset.fase,
      riga: document.querySelector('#ar-calibra .ar-calibra-riga').textContent,
      manuale: visManuale(),
      pillola: document.querySelector('#ar-stato .ar-stato-testo').textContent,
      tastoManuale: document.getElementById('ar-allinea').dataset.manuale,
      velo: !document.getElementById('ar-calibra-velo').hidden
    }));
    ok('dopo il tocco l\'allineamento è applicato e lo si dice', fatto.fase === 'fatto' &&
      /Giove/.test(fatto.riga), fatto.riga);
    ok('lo scarto raccontato è quello indicato', fatto.manuale && Math.abs(fatto.manuale.gradi - 1.62) < 0.3,
      fatto.manuale && fatto.manuale.gradi.toFixed(2));
    ok('la pillola dice su cosa si è allineati', /Giove/.test(fatto.pillola), fatto.pillola);
    ok('il tasto porta il segno dell\'allineamento a mano', fatto.tastoManuale === 'si');
    ok('e il cielo torna a rispondere al dito', !fatto.velo);

    // «Annulla»: la correzione torna com'era.
    await pagina.evaluate(() => {
      document.querySelector('#ar-calibra [data-ar-calibra="annulla"]').click();
    });
    const annullato = await pagina.evaluate(() => ({
      manuale: visManuale(), correzione: Visione.stato.correzione,
      fase: document.getElementById('ar-calibra').dataset.fase
    }));
    ok('«Annulla» toglie l\'allineamento a mano', !annullato.manuale && annullato.correzione === null);
    ok('e torna alla scelta, per rifarlo', annullato.fase === 'scegli');

    // Col dito: un tocco svelto e fermo conta dov'è il dito; tenuto giù e
    // trascinato, conta il mirino — che sta un pollice sopra al polpastrello.
    if (schermo.width < 1000) {
      await pagina.evaluate(() => {
        Array.from(document.querySelectorAll('#ar-calibra .ar-calibra-scelta'))
          .find(b => b.textContent === 'Giove').click();
      });
      await pagina.touchscreen.tap(bersaglio.x, bersaglio.y);
      const tap = await pagina.evaluate(() => visManuale());
      ok('col dito, un tocco svelto conta dove sta il dito',
        tap && Math.abs(tap.gradi - 1.62) < 0.3, tap && tap.gradi.toFixed(2));
      await pagina.evaluate(() => document.querySelector('#ar-calibra [data-ar-calibra="rifai"]').click());
      const rifai = await pagina.evaluate(() => ({
        fase: document.getElementById('ar-calibra').dataset.fase, manuale: visManuale()
      }));
      ok('«Rifai» toglie l\'ultimo e torna a indicare lo stesso oggetto', rifai.fase === 'tocca' && !rifai.manuale);
      // Tenuto giù: pointerdown, attesa, pointerup, tutti col tipo «touch».
      const lungo = await pagina.evaluate(async (b) => {
        const velo = document.getElementById('ar-calibra-velo');
        const ev = (tipo) => new PointerEvent(tipo, { bubbles: true, cancelable: true, pointerId: 7,
          pointerType: 'touch', clientX: b.x, clientY: b.y + 64 });
        velo.dispatchEvent(ev('pointerdown'));
        const mira = Object.assign({}, Visione.stato.calibra.puntatore);
        await new Promise(r => setTimeout(r, 400));
        velo.dispatchEvent(ev('pointerup'));
        return { mira, manuale: visManuale() };
      }, bersaglio);
      ok('tenendo giù il dito il mirino sta sopra al polpastrello',
        lungo.mira && lungo.mira.ditoY - lungo.mira.py > 40, JSON.stringify(lungo.mira));
      ok('e sollevandolo conta il mirino, non il dito',
        lungo.manuale && Math.abs(lungo.manuale.gradi - 1.62) < 0.3, lungo.manuale && lungo.manuale.gradi.toFixed(2));
      await pagina.evaluate(() => { while (visAnnullaCalibrazione()) { /* tutto via */ } });
    }

    // Chiudere, e spegnere la fotocamera, lascia tutto pulito.
    await pagina.evaluate(() => document.querySelector('#ar-calibra [data-ar-calibra="chiudi"]').click());
    const chiuso = await pagina.evaluate(() => ({
      pannello: document.getElementById('ar-calibra').hidden,
      velo: document.getElementById('ar-calibra-velo').hidden
    }));
    ok('«Chiudi» chiude pannello e velo', chiuso.pannello && chiuso.velo);

    ok('nessuna eccezione', errori.length === 0, errori.slice(0, 3).join(' | '));
    await contesto.close();
  }

  await browser.close();
  server.close();
  console.log(ko ? `\n${ko} prove fallite` : '\ntutte le prove passate');
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
