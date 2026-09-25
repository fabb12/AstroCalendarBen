/* La regia delle demo, guardata per quello che fa vedere.
 *
 *   npm install --no-save playwright@1.56.1 astronomy-engine satellite.js@5.0.0
 *   node scripts/prova-demo-regia.js
 *
 * Una demo sbagliata è quasi sempre una demo *bella*: un Sole con sopra una
 * Luna che non si muove, una Terra con un'ombra ferma, una camera che gira
 * attorno al niente. Qui non si guarda se «funziona», si guarda se succede
 * quello che il racconto promette: la Luna che si avvicina al Sole e poi se
 * ne va, l'ombra che corre sulla Terra, la Luna che attraversa il cono,
 * i pianeti tutti nel quadro mentre la camera scende sul piano, la ISS che
 * attraversa il cielo nello stesso intervallo in cui la si vede da fuori.
 * E poi le opzioni (schermo intero, registrazione, elementi del planetario,
 * avvisi zitti) e che alla fine tutto torni com'era. Le schermate finiscono
 * in `work/regia-*.png`. */
'use strict';
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const radice = path.resolve(__dirname, '..');
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const file = path.resolve(radice, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader('Content-Type', tipi[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

// Un TLE della ISS con l'epoca di oggi: la prova non ha la rete, e un TLE
// vecchio verrebbe giustamente rifiutato dalla vista 3D.
function tleDiOggi() {
  const somma = riga => {
    let n = 0;
    for (const ch of riga.slice(0, 68)) n += ch === '-' ? 1 : (/\d/.test(ch) ? Number(ch) : 0);
    return riga.slice(0, 68) + (n % 10);
  };
  const ora = new Date();
  const inizio = Date.UTC(ora.getUTCFullYear(), 0, 1);
  const giorno = (ora.getTime() - inizio) / 86400000 + 1;
  const epoca = String(ora.getUTCFullYear() % 100).padStart(2, '0') + giorno.toFixed(8).padStart(12, '0');
  const r1 = '1 25544U 98067A   ' + epoca + '  .00016717  00000-0  30209-3 0  9990';
  const r2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50377579 12340';
  return { riga1: somma(r1), riga2: somma(r2) };
}

let verifiche = 0;
function ok(c, m) { assert.ok(c, m); verifiche++; }

(async () => {
  let browser;
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch();
    const pagina = await browser.newPage({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
    const errori = [];
    pagina.on('pageerror', e => errori.push(e.message));
    await pagina.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(origine)) return route.continue();
      if (url.includes('astronomy.browser.min.js'))
        return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(require.resolve('astronomy-engine').replace(/astronomy\.js$/, 'astronomy.browser.min.js')) });
      if (url.includes('satellite.min.js'))
        return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(path.dirname(require.resolve('satellite.js/package.json')), 'dist/satellite.min.js')) });
      return route.abort();
    });
    await pagina.addInitScript(() => {
      localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
      localStorage.setItem('astrocal_lingua', 'it');
      // Simula preferenze salvate prima dell'aggiunta delle due nuove opzioni:
      // le chiavi mancanti devono migrare ai valori predefiniti attivi.
      localStorage.setItem('astrocal_demo_opzioni_v1', JSON.stringify({
        schermoIntero: false, registra: false, livelli: null
      }));
    });
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => typeof AstroDemo !== 'undefined' && typeof sky !== 'undefined' &&
      sky.observer && sky.oggetti.length, null, { timeout: 30000 });
    fs.mkdirSync(path.join(radice, 'work'), { recursive: true });
    const foto = nome => pagina.screenshot({ path: path.join(radice, 'work/regia-' + nome + '.png') });
    const salta = (i, u) => pagina.evaluate(([i, u]) => { AstroDemo.vaiAScena(i, u); AstroDemo.pausa(); }, [i, u]);
    const attendiFotogrammi = () => pagina.evaluate(() => new Promise(r =>
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));

    // --- 1. Le Impostazioni: linguetta attiva, rotellina, azione principale
    await pagina.locator('#btn-impostazioni').click();
    await pagina.locator('#imp-tab-btn-demo').click();
    await pagina.waitForTimeout(400); // le linguette hanno una transizione di colore
    const ui = await pagina.evaluate(() => {
      const attiva = getComputedStyle(document.getElementById('imp-tab-btn-demo'));
      const altra = getComputedStyle(document.getElementById('imp-tab-btn-dati'));
      const barra = getComputedStyle(document.getElementById('imp-tab-btn-demo'), '::after');
      const avvia = document.getElementById('demo-avvia');
      const sa = getComputedStyle(avvia);
      const secondario = getComputedStyle(document.getElementById('demo-duplica'));
      const ingranaggio = document.querySelector('#btn-impostazioni svg path');
      return {
        fondoAttiva: attiva.backgroundColor, fondoAltra: altra.backgroundColor,
        coloreAttiva: attiva.color, coloreAltra: altra.color, barra: barra.backgroundColor,
        barraAlta: parseFloat(barra.height),
        avviaFondo: sa.backgroundImage, avviaAlto: avvia.getBoundingClientRect().height,
        avviaLargo: avvia.getBoundingClientRect().width,
        secondarioLargo: document.getElementById('demo-duplica').getBoundingClientRect().width,
        secondarioFondo: secondario.backgroundImage,
        ingranaggio: ingranaggio && ingranaggio.getAttribute('d'),
        etichetta: document.getElementById('btn-impostazioni').getAttribute('aria-label'),
        livelli: document.querySelectorAll('#demo-livelli input[data-livello]').length,
        schermo: !!document.getElementById('demo-opz-schermo'),
        registra: !!document.getElementById('demo-opz-registra')
      };
    });
    ok(ui.fondoAttiva !== ui.fondoAltra && ui.coloreAttiva !== ui.coloreAltra, 'La linguetta attiva ha fondo e colore propri');
    ok(ui.barra !== 'rgba(0, 0, 0, 0)' && ui.barraAlta >= 3, 'Barra dell’accento sotto la linguetta attiva');
    ok(/gradient/.test(ui.avviaFondo) && ui.avviaAlto >= 50, 'Avvia demo è un tasto pieno e alto');
    ok(ui.avviaLargo > ui.secondarioLargo * 1.5 && !/gradient/.test(ui.secondarioFondo), 'Avvia domina sui tasti secondari');
    ok(ui.ingranaggio && ui.ingranaggio.startsWith('M12.22 2h-.44'), 'Icona a rotellina');
    ok(ui.etichetta === 'Impostazioni', 'La rotellina ha il suo nome accessibile');
    ok(ui.schermo && ui.registra && ui.livelli >= 20, 'Opzioni e ' + ui.livelli + ' elementi del planetario');
    // I nomi degli elementi vengono dai tasti veri, e seguono la lingua
    const nomi = await pagina.evaluate(() => AstroDemo.livelli().map(l => l.nome));
    ok(nomi.includes('Pianeti') && nomi.includes('Via Lattea') && nomi.includes('Reticolo'), 'Nomi dagli interruttori');
    await foto('impostazioni');
    await pagina.keyboard.press('Escape');

    // --- 2. Eclisse di Sole: la Luna attraversa davvero il disco
    const separazione = () => pagina.evaluate(() => {
      skyAggiornaOggetti(true);
      const s = sky.oggetti.find(o => o.id === 'Sun'), l = sky.oggetti.find(o => o.id === 'Moon');
      const v = (o) => skyVettore(o.az, o.alt);
      const a = v(s), b = v(l);
      return Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180 / Math.PI;
    });
    const prima = await pagina.evaluate(() => ({ offset: Math.round(skyAdesso() - Date.now()), fov: sky.fov, luogo: sky.luogoVista,
      griglia: sky.mostraGriglia, nomi: sky.mostraNomi, vista: vistaAttuale }));
    await pagina.evaluate(() => AstroDemo.avvia(AstroDemo.libreria.elenco().find(d => d.chiave === 'eclisse_tour').testo));
    await salta(1, 0); const s0 = await separazione();
    await salta(1, 0.5); const s1 = await separazione(); await attendiFotogrammi(); await foto('eclisse-sole-avvicina');
    await salta(1, 1); const s2 = await separazione();
    ok(s0 > 0.5 && s1 < s0 && s2 < 0.02, `La Luna scivola sul Sole: ${s0.toFixed(3)}° → ${s1.toFixed(3)}° → ${s2.toFixed(3)}°`);
    ok(await pagina.evaluate(() => sky.fov) < 2, 'Campo stretto: il disco si vede');
    // La geometria da fuori: Terra e Luna in fila, camera che gira
    await salta(4, 0); const g0 = await pagina.evaluate(() => ({ az: sol.az, vicino: sol.vicino, zoom: sol.zoom }));
    await salta(4, 1); const g1 = await pagina.evaluate(() => ({ az: sol.az, elev: sol.elev }));
    await attendiFotogrammi(); await foto('eclisse-sole-geometria');
    ok(g0.vicino && Math.abs(g1.az - g0.az) > 0.3, 'La camera gira attorno a Terra e Luna');
    // L'ombra sulla Terra: zoom che si stringe, ombra che corre
    const ombra = u => pagina.evaluate(async u => {
      AstroDemo.vaiAScena(5, u); AstroDemo.pausa();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const o = solOmbraLunareSuTerra(skyAdesso());
      solMisura();
      const terra = solVicPunto([0, 0, 0]);
      return { zoom: sol.zoom, centro: o && o.centro, px: terra.px - sol.L / 2, py: terra.py - sol.H / 2 };
    }, u);
    const o0 = await ombra(0.05), o1 = await ombra(0.5);
    await foto('eclisse-sole-ombra');
    const o2 = await ombra(0.95);
    ok(o2.zoom > o0.zoom * 4, 'Ci si avvicina alla Terra: zoom ×' + (o2.zoom / o0.zoom).toFixed(1));
    ok(Math.abs(o1.px) < 2 && Math.abs(o1.py) < 2, 'La Terra resta al centro');
    ok(o0.centro && o1.centro && Math.hypot(o1.centro[0] - o0.centro[0], o1.centro[1] - o0.centro[1], o1.centro[2] - o0.centro[2]) > 1000,
      'L’ombra si sposta di migliaia di km sulla Terra');
    // Di nuovo in cielo: la Luna se ne va, e il Sole torna intero
    await salta(6, 1); const sFine = await separazione();
    await attendiFotogrammi(); await foto('eclisse-sole-fine');
    ok(sFine > 0.54, 'Fine: il passaggio è concluso (' + sFine.toFixed(3) + '°)');
    ok(await pagina.evaluate(() => !sol.aperto && vistaAttuale === 'cielo'), 'Si torna al planetario');
    await pagina.evaluate(() => AstroDemo.ferma());
    const dopo = await pagina.evaluate(() => ({ offset: Math.round(skyAdesso() - Date.now()), fov: sky.fov, luogo: sky.luogoVista,
      griglia: sky.mostraGriglia, nomi: sky.mostraNomi, vista: vistaAttuale }));
    assert.deepEqual(dopo, prima); verifiche++;

    // --- 3. Eclisse di Luna: la Luna entra nell'ombra, e da fuori attraversa il cono
    await pagina.evaluate(() => AstroDemo.avvia(AstroDemo.libreria.elenco().find(d => d.chiave === 'eclisse_lunare').testo));
    const luceLuna = u => pagina.evaluate(u => {
      AstroDemo.vaiAScena(1, u); AstroDemo.pausa(); skyAggiornaOggetti(true);
      const l = sky.oggetti.find(o => o.id === 'Moon');
      return l && l.ombraTerra ? l.ombraTerra.luce : 1;
    }, u);
    const l0 = await luceLuna(0), l1 = await luceLuna(1);
    await attendiFotogrammi(); await foto('eclisse-luna-cielo');
    ok(l0 > 0.65 && l1 < 0.35 && l1 < l0 / 3, `La Luna si spegne entrando nell'ombra: ${l0.toFixed(2)} → ${l1.toFixed(2)}`);
    const tipi3d = [];
    for (const u of [0, 0.3, 0.55, 0.8, 1]) {
      tipi3d.push(await pagina.evaluate(u => { AstroDemo.vaiAScena(4, u); AstroDemo.pausa();
        return solStatoEclissi(skyAdesso()).tipo; }, u));
      if (u === 0.55) { await attendiFotogrammi(); await foto('eclisse-luna-cono'); }
    }
    ok(tipi3d.includes('lunare-totale'), '3D: la Luna è dentro al cono: ' + tipi3d.join(','));
    ok(new Set(tipi3d).size >= 2 && tipi3d[0] !== 'lunare-totale' && tipi3d[4] !== 'lunare-totale',
      '3D: la Luna entra ed esce dal cono');
    await salta(5, 1);
    const l2 = await pagina.evaluate(() => { skyAggiornaOggetti(true); const l = sky.oggetti.find(o => o.id === 'Moon'); return l.ombraTerra ? l.ombraTerra.luce : 1; });
    ok(l2 > 0.9, 'Di nuovo in cielo: la Luna è uscita dall’ombra');
    await pagina.evaluate(() => AstroDemo.ferma());

    // L'ombra della Luna ingrandita resta sfumata su un telefono: il colore
    // disegnato su una riga deve seguire la legge vera punto per punto.
    const ombraZoom = await pagina.evaluate(() => {
      // Una geometria d'eclissi scritta a mano: l'orlo dell'ombra piena a
      // 350 px da sinistra, la Luna larga 3000 px (mezzo grado di campo su
      // un telefono), e la riga che attraversa il turchese e il rame.
      const s = { umbra: 0.7, penombra: 1.3, gamma: 0.6, rL: 0.26, pa: 0 };
      const r = 1500, perGrado = r / s.rL;
      const tela = document.createElement('canvas'); tela.width = 390; tela.height = 700;
      const ctx = tela.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, tela.width, tela.height);
      const cxOmbra = -s.gamma * perGrado, orlo = cxOmbra + s.umbra * perGrado;
      const x0 = 350 - orlo;
      ctx.save(); ctx.translate(x0, 350);
      skyDisegnaOmbraLunare(ctx, r, { ombraTerra: s }, { nord: [0, 1, 0], est: [1, 0, 0], schermo: () => Math.PI });
      ctx.restore();
      const riga = ctx.getImageData(0, 350, 390, 1).data;
      const vero = x => skyEclisseColore(s, Math.abs(x - x0 - cxOmbra) / perGrado);
      let errMax = 0;
      for (let x = 0; x < 390; x += 3) {
        const c = vero(x);
        errMax = Math.max(errMax, Math.abs(riga[x * 4] - c[0] * 255), Math.abs(riga[x * 4 + 1] - c[1] * 255));
      }
      const salto = Math.abs(riga[389 * 4 + 1] - riga[1]), saltoVero = Math.abs(vero(389)[1] - vero(0)[1]) * 255;
      return { errMax, salto, saltoVero };
    });
    ok(ombraZoom.errMax < 10 && ombraZoom.saltoVero > 20 && Math.abs(ombraZoom.salto - ombraZoom.saltoVero) < 10,
      `Ombra ingrandita fedele: errore ${ombraZoom.errMax.toFixed(1)} livelli, salto ${ombraZoom.salto} su ${ombraZoom.saltoVero.toFixed(0)}`);

    // --- 4. Aurora: il banco a schermo intero, poi il cielo verso nord
    await pagina.evaluate(() => AstroDemo.avvia(AstroDemo.libreria.elenco().find(d => d.chiave === 'aurora_boreale').testo));
    await salta(0, 0.5);
    const aur0 = await pagina.evaluate(() => ({ vista: vistaAttuale, pieno: !!document.querySelector('.did-pieno-ripiego'),
      quadro: didDemo.fotografa().quadro, t: didDemo.fotografa().t }));
    ok(aur0.vista === 'didattica' && aur0.pieno && aur0.quadro === 'vento', 'Aurora: banco didattico a schermo intero');
    await attendiFotogrammi(); await foto('aurora-vento');
    const camera = async (i, u) => { await salta(i, u); return pagina.evaluate(() => didDemo.fotografa()); };
    const c0 = await camera(1, 0), c1 = await camera(1, 1);
    ok(c0.quadro === 'scudo' && Math.abs(c1.cam.az - c0.cam.az) > 100, 'La camera gira attorno alla Terra');
    const z0 = await camera(2, 0), z1 = await camera(2, 1);
    await attendiFotogrammi(); await foto('aurora-scudo');
    ok(z1.zoomDemo > z0.zoomDemo * 1.5, 'Lo scudo da vicino');
    ok((await camera(3, 0.5)).quadro === 'scarica' && (await camera(4, 0.5)).quadro === 'anello', 'Scarica, poi anello');
    await attendiFotogrammi(); await foto('aurora-anello');
    await salta(5, 0.9); await salta(6, 0.5); await attendiFotogrammi();
    const cielo = await pagina.evaluate(() => {
      // Si guarda la luce: il verde del cielo con l'aurora accesa e spenta,
      // sulla stessa tela e nello stesso istante. Contare punti proiettati
      // non basta — erano «nel quadro» anche quando da Tromsø l'ovale stava
      // alle spalle di chi guardava, e sullo schermo non c'era niente.
      const verde = () => {
        skyDisegna();
        const c = sky.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, Math.round(c.height * 0.6)).data;
        let somma = 0;
        for (let i = 0; i < d.length; i += 16) somma += Math.max(0, d[i + 1] - d[i]);
        return somma / (d.length / 16);
      };
      const con = verde(); aur.acceso = false; const senza = verde(); aur.acceso = true;
      return { vista: vistaAttuale, az: sky.manuale.az, acceso: aur.acceso, kp: aur.kpSimulato, con, senza,
        pieno: !!document.querySelector('.did-pieno-ripiego') };
    });
    await foto('aurora-cielo');
    ok(cielo.vista === 'cielo' && !cielo.pieno && cielo.az === 0 && cielo.acceso && cielo.kp === 5, 'Cielo di Helsinki verso nord');
    ok(cielo.con > cielo.senza * 1.6 && cielo.con - cielo.senza > 4, `L'aurora si vede verso nord: verde ${cielo.senza.toFixed(1)} → ${cielo.con.toFixed(1)}`);
    await pagina.evaluate(() => AstroDemo.ferma());
    ok(await pagina.evaluate(() => !document.querySelector('.did-pieno-ripiego') && vistaAttuale === 'cielo' &&
      didDemo.fotografa().zoomDemo === 1), 'Banco didattico ripristinato');

    // --- 5. Corteo dei pianeti: da fuori, tutti nel quadro mentre la camera scende
    await pagina.evaluate(() => AstroDemo.avvia(AstroDemo.libreria.elenco().find(d => d.chiave === 'allineamento_pianeti').testo));
    const pianeti3d = async u => { await salta(3, u); return pagina.evaluate(async () => {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      solMisura();
      const dentro = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter'].filter(id => {
        const p = sol.pianeti.find(x => x.id === id);
        const q = p && solProietta(solScena(p.pos));
        return q && q.px > 0 && q.px < sol.L && q.py > 0 && q.py < sol.H;
      });
      return { elev: sol.elev, az: sol.az, dentro };
    }); };
    const p0 = await pianeti3d(0); await attendiFotogrammi(); await foto('pianeti-alto');
    const p1 = await pianeti3d(1); await foto('pianeti-taglio');
    ok(p0.elev > 70 && p1.elev < 20 && Math.abs(p1.az - p0.az) > 1, 'Dall’alto al piano, girando');
    ok(p0.dentro.length === 5 && p1.dentro.length === 5, 'Tutti e cinque nel quadro: ' + p0.dentro + ' / ' + p1.dentro);
    await pagina.evaluate(() => AstroDemo.ferma());

    // --- 6. ISS: lo stesso passaggio in cielo e da fuori
    await pagina.evaluate(t => { satTle.iss = Object.assign({ quando: Date.now() }, t); }, tleDiOggi());
    await pagina.evaluate(() => AstroDemo.avvia(AstroDemo.libreria.elenco().find(d => d.chiave === 'passaggio_iss').testo));
    ok(await pagina.evaluate(() => AstroDemo.stato) === 'attivo', 'Demo ISS avviata coi dati orbitali');
    const iss = async (i, u) => { await salta(i, u); return pagina.evaluate(async () => {
      skyAggiornaOggetti(true);
      // Il giro degli astri lavora a scaglioni: si aspetta che l'elenco sia
      // quello dell'istante chiesto.
      await new Promise(r => setTimeout(r, 400));
      const o = sky.oggetti.find(x => x.id === 'sat-iss');
      const p = o && skyProietta(skyVettore(o.az, o.alt), sky.ultimaBase, sky.ultimaFocale);
      return { t: +skyAdesso(), alt: o && o.alt, px: p && p.px, py: p && p.py,
        dentro: !!(p && p.davanti && p.px >= 0 && p.px <= sky.larghezza && p.py >= 0 && p.py <= sky.altezza),
        sol: sol.aperto, satelliti: (sol.satelliti || []).map(s => s.id) };
    }); };
    const i0 = await iss(0, 0.2), i1 = await iss(0, 0.5); await foto('iss-cielo');
    const i2 = await iss(0, 0.8);
    ok(i1.alt > 10 && i1.dentro, 'La ISS è alta e nel quadro a metà passaggio');
    ok(Math.hypot(i2.px - i0.px, i2.py - i0.py) > 100, 'La ISS attraversa il cielo di ' + Math.round(Math.hypot(i2.px - i0.px, i2.py - i0.py)) + ' px');
    const a0 = await pagina.evaluate(() => { AstroDemo.vaiAScena(0, 0); AstroDemo.pausa(); return +skyAdesso(); });
    const b0 = await pagina.evaluate(() => { AstroDemo.vaiAScena(2, 0); AstroDemo.pausa(); return +skyAdesso(); });
    const b1 = await pagina.evaluate(() => { AstroDemo.vaiAScena(2, 1); AstroDemo.pausa(); return +skyAdesso(); });
    const a1 = await pagina.evaluate(() => { AstroDemo.vaiAScena(0, 1); AstroDemo.pausa(); return +skyAdesso(); });
    ok(Math.abs(a0 - b0) < 1000 && Math.abs(a1 - b1) < 1000, 'Planetario e 3D: lo stesso intervallo di tempo');
    const i3 = await iss(2, 0.5); await attendiFotogrammi(); await foto('iss-3d');
    ok(i3.sol && i3.satelliti.includes('iss') && await pagina.evaluate(() => sol.perno === 'Earth'), '3D: la ISS attorno alla Terra');
    await pagina.evaluate(() => AstroDemo.ferma());

    // --- 7. Le opzioni: vista pulita, elementi, schermo intero e registrazione
    const brevi = "define_demo breve { scene planetarium_view { duration: 1500ms; action: set_fov { degrees: 50 }; }" +
      " scene solar_system_3d { duration: 1500ms; action: camera_3d { scene: system, focus: 'Earth', orbit: 30 }; } }";

    // Le preferenze salvate dalla versione precedente non contenevano le due
    // nuove chiavi: entrambe devono comunque partire attive, anche nel pannello.
    await pagina.locator('#btn-impostazioni').click();
    await pagina.locator('#imp-tab-btn-demo').click();
    const nuoveDefault = await pagina.evaluate(() => ({
      pulita: AstroDemo.opzioni.vistaPulita,
      audio: AstroDemo.opzioni.registraAudio,
      pulitaUi: document.getElementById('demo-opz-vista-pulita').checked,
      audioUi: document.getElementById('demo-opz-registra-audio').checked
    }));
    ok(nuoveDefault.pulita && nuoveDefault.audio && nuoveDefault.pulitaUi && nuoveDefault.audioUi,
      'Le nuove opzioni sono attive di default anche con preferenze vecchie');
    await pagina.locator('#demo-opz-vista-pulita').uncheck();
    await pagina.locator('#demo-opz-registra-audio').uncheck();
    const nuoveSalvate = await pagina.evaluate(() => JSON.parse(localStorage.getItem('astrocal_demo_opzioni_v1')));
    ok(nuoveSalvate.vistaPulita === false && nuoveSalvate.registraAudio === false,
      'Le nuove opzioni si salvano insieme alle preferenze Demo');
    await pagina.locator('#demo-opz-vista-pulita').check();
    await pagina.locator('#demo-opz-registra-audio').check();
    await pagina.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
    await pagina.locator('#btn-chiudi-impostazioni').click();

    // La vista pulita nasconde il chrome senza alterarne lo stato. Lasciamo
    // apposta aperta la scheda Visualizzazione e un avviso già presente.
    const primaOpz = await pagina.evaluate(() => {
      skyMostraGruppo('vista');
      skyAvviso('prova', 'Prima della demo');
      return {
        griglia: sky.mostraGriglia, nomi: sky.mostraNomi,
        vl: sky.mostraViaLattea, profondo: sky.mostraProfondo,
        gruppo: document.getElementById('cielo-comandi').dataset.gruppoAttivo,
        avviso: sky.avvisi.prova || ''
      };
    });
    await pagina.evaluate(() => AstroDemo.impostaOpzioni({
      livelli: { griglia: false, nomi: false, viaLattea: false, profondo: true }
    }));
    await pagina.evaluate(t => AstroDemo.avvia(t), brevi);
    const durante = await pagina.evaluate(() => {
      skyAvviso('nuovo', 'Non dovrei vedermi');
      return {
        griglia: sky.mostraGriglia, nomi: sky.mostraNomi,
        vl: sky.mostraViaLattea, profondo: sky.mostraProfondo,
        gruppo: document.getElementById('cielo-comandi').dataset.gruppoAttivo,
        avviso: sky.avvisi.prova || '', nuovo: sky.avvisi.nuovo || '',
        pulita: document.body.classList.contains('demo-vista-pulita'),
        header: getComputedStyle(document.querySelector('.testata-app')).visibility,
        chrome: getComputedStyle(document.getElementById('cielo-comandi')).visibility,
        controlli: getComputedStyle(document.getElementById('demo-controlli')).visibility
      };
    });
    ok(!durante.griglia && !durante.nomi && !durante.vl && durante.profondo,
      'Gli elementi scelti valgono durante la demo');
    ok(durante.pulita && durante.header === 'hidden' && durante.chrome === 'hidden' &&
      durante.controlli === 'visible', 'Vista pulita: chrome nascosto, controlli essenziali visibili');
    ok(durante.gruppo === primaOpz.gruppo && durante.avviso === primaOpz.avviso && durante.nuovo === '',
      'Vista pulita non distrugge pannelli/avvisi e sopprime quelli nuovi');
    await pagina.evaluate(() => AstroDemo.ferma());
    const dopoOpz = await pagina.evaluate(() => ({
      griglia: sky.mostraGriglia, nomi: sky.mostraNomi,
      vl: sky.mostraViaLattea, profondo: sky.mostraProfondo,
      gruppo: document.getElementById('cielo-comandi').dataset.gruppoAttivo,
      avviso: sky.avvisi.prova || '',
      pulita: document.body.classList.contains('demo-vista-pulita'),
      header: getComputedStyle(document.querySelector('.testata-app')).visibility
    }));
    assert.deepEqual(
      { griglia: dopoOpz.griglia, nomi: dopoOpz.nomi, vl: dopoOpz.vl, profondo: dopoOpz.profondo },
      { griglia: primaOpz.griglia, nomi: primaOpz.nomi, vl: primaOpz.vl, profondo: primaOpz.profondo }
    ); verifiche++;
    ok(dopoOpz.gruppo === primaOpz.gruppo && dopoOpz.avviso === primaOpz.avviso &&
      !dopoOpz.pulita && dopoOpz.header !== 'hidden',
      'Stop ripristina esattamente lo stato UI precedente');
    await pagina.evaluate(() => {
      skyAvviso('prova', '');
      skyMostraGruppo('');
      AstroDemo.impostaOpzioni({ livelli: null });
    });

    // Anche un errore in ingresso scena deve rimuovere sempre la vista pulita.
    await pagina.evaluate(() => {
      AstroDemo.registra('prova_errore', { crea() { throw new Error('guasto controllato'); } });
      AstroDemo.avvia("define_demo guasto { scene planetarium_view { duration: 1s; action: prova_errore { text: 'x' }; } }");
    });
    ok(await pagina.evaluate(() => AstroDemo.stato === 'errore' &&
      !document.body.classList.contains('demo-vista-pulita') &&
      getComputedStyle(document.querySelector('.testata-app')).visibility !== 'hidden'),
      'Errore: vista pulita e interfaccia ripristinate');
    await pagina.evaluate(() => skyAvviso('demo', ''));

    // Schermo intero: si avvia dalla finestra Impostazioni e, dopo Esc, deve
    // ricomparire anche la stessa finestra che c'era prima della demo.
    await pagina.locator('#btn-impostazioni').click();
    await pagina.locator('#imp-tab-btn-demo').click();
    await pagina.locator('#demo-opz-schermo').check();
    await pagina.locator('#demo-elenco').selectOption('allineamento_pianeti');
    await pagina.locator('#demo-avvia').click();
    await pagina.waitForFunction(() => document.fullscreenElement === document.documentElement, null, { timeout: 5000 });
    const pieno = await pagina.evaluate(() => ({ finto: sky.fintoSchermoIntero, cielo: sky.schermoIntero }));
    ok(pieno.finto && pieno.cielo, 'Demo a schermo intero: documento e cielo');
    await pagina.evaluate(() => AstroDemo.vaiAScena(3));
    await pagina.waitForTimeout(300);
    ok(await pagina.evaluate(() => document.fullscreenElement === document.documentElement && solSchermoIntero),
      'Il passaggio alla 3D non esce dallo schermo intero');
    await pagina.keyboard.press('Escape');
    await pagina.waitForFunction(() => AstroDemo.stato === 'fermo' && !document.fullscreenElement, null, { timeout: 5000 });
    ok(await pagina.evaluate(() => !sky.schermoIntero && !sky.fintoSchermoIntero && !solSchermoIntero),
      'Esc: schermo intero ripristinato');
    ok(await pagina.evaluate(() => !document.getElementById('modale-impostazioni').classList.contains('hidden')),
      'Esc ripristina anche la finestra Impostazioni aperta prima della demo');
    await pagina.evaluate(() => {
      document.getElementById('modale-impostazioni').classList.add('hidden');
      AstroDemo.impostaOpzioni({ schermoIntero: false });
    });

    // Con l'audio disattivato la registrazione Demo deve avere soltanto video.
    const regPrima = await pagina.evaluate(() => {
      skyMostraGruppo('vista');
      return sky.reg.durataSec;
    });
    const clipMuto = "define_demo clip_muto { scene planetarium_view { duration: 700ms; action: set_fov { degrees: 50 }; } }";
    await pagina.evaluate(() => AstroDemo.impostaOpzioni({ registra: true, registraAudio: false }));
    await pagina.evaluate(t => AstroDemo.avvia(t), clipMuto);
    await pagina.waitForFunction(() => sky.reg.attiva && sky.reg.flusso, null, { timeout: 5000 });
    ok(await pagina.evaluate(() => sky.reg.flusso.getAudioTracks().length === 0),
      'Registra anche l’audio spento: il MediaRecorder resta senza audio');
    await pagina.waitForFunction(() => AstroDemo.stato === 'completato', null, { timeout: 10000 });
    await pagina.waitForFunction(() => sky.reg.esito && sky.reg.esito.blob.size > 500, null, { timeout: 10000 });
    ok(await pagina.evaluate(() => document.getElementById('cielo-comandi').dataset.gruppoAttivo === 'vista'),
      'La registrazione Demo non chiude il pannello che era aperto prima');
    await pagina.evaluate(() => skyRegChiudiPannello());

    // Con l'audio attivo il MediaRecorder riceve una sola traccia condivisa.
    // Una fineNarrazione più lunga della duration verifica anche che il video
    // rimanga in corso fino alla voce; pausa/ripresa non deve duplicarla.
    await pagina.evaluate(() => {
      AstroDemo.registra('attesa_narrazione', {
        crea() { return { fineNarrazione: new Promise(r => setTimeout(r, 1100)) }; }
      });
      AstroDemo.impostaOpzioni({ registra: true, registraAudio: true });
    });
    const clipVoce = "define_demo clip_voce { scene planetarium_view { duration: 200ms; action: attesa_narrazione { text: 'x' }; } }";
    await pagina.evaluate(t => AstroDemo.avvia(t), clipVoce);
    await pagina.waitForFunction(() => sky.reg.attiva && sky.reg.flusso, null, { timeout: 5000 });
    const conAudio = await pagina.evaluate(() => {
      const tracce = sky.reg.flusso.getAudioTracks();
      window.__tracciaDemoAudio = tracce[0] || null;
      return { n: tracce.length, cattura: narrazione.catturaStato() };
    });
    ok(conAudio.n === 1 && conAudio.cattura.attiva && conAudio.cattura.tracce === 1,
      'Audio acceso: una sola traccia della narrazione nel MediaRecorder');
    await pagina.evaluate(() => AstroDemo.pausa());
    await pagina.waitForTimeout(180);
    ok(await pagina.evaluate(() => sky.reg.flusso.getAudioTracks().length === 1 &&
      window.__tracciaDemoAudio && window.__tracciaDemoAudio.readyState === 'live'),
      'Pausa: la traccia audio resta unica e viva');
    await pagina.evaluate(() => AstroDemo.riprendi());
    await pagina.waitForFunction(() => AstroDemo.stato === 'completato', null, { timeout: 10000 });
    await pagina.waitForFunction(() => sky.reg.esito && sky.reg.esito.blob.size > 500, null, { timeout: 10000 });
    const reg = await pagina.evaluate(() => ({
      sorgente: sky.reg.sorgente, durata: sky.reg.durataSec,
      reale: sky.reg.durataReale, vista: vistaAttuale,
      cattura: narrazione.catturaStato(),
      traccia: window.__tracciaDemoAudio && window.__tracciaDemoAudio.readyState
    }));
    ok(reg.sorgente === null && reg.durata === regPrima && reg.vista === 'cielo' &&
      reg.reale > 1 && !reg.cattura.attiva && reg.traccia === 'ended',
      'Filmato sincronizzato con narrazione lunga (' + reg.reale.toFixed(1) + ' s) e stream audio chiuso');
    await pagina.evaluate(() => {
      AstroDemo.impostaOpzioni({ registra: false, registraAudio: true });
      skyRegChiudiPannello();
      skyMostraGruppo('');
    });

    // Movimento ridotto: la camera 3D non gira, il tempo sì
    await pagina.emulateMedia({ reducedMotion: 'reduce' });
    const ridotto = await pagina.evaluate(t => {
      AstroDemo.avvia(t); AstroDemo.vaiAScena(1, 0); AstroDemo.pausa(); const a = sol.az;
      AstroDemo.vaiAScena(1, 1); AstroDemo.pausa(); const b = sol.az; AstroDemo.ferma(); return [a, b];
    }, brevi);
    ok(ridotto[0] === ridotto[1], 'Movimento ridotto: nessuna orbita decorativa');
    await pagina.emulateMedia({ reducedMotion: 'no-preference' });

    // Su un telefono la scheda delle demo non sborda, e Avvia resta in vista
    await pagina.setViewportSize({ width: 360, height: 740 });
    await pagina.locator('#btn-impostazioni').click();
    await pagina.locator('#imp-tab-btn-demo').click();
    const mobile = await pagina.evaluate(() => {
      const p = document.getElementById('imp-tab-demo');
      const a = document.getElementById('demo-avvia').getBoundingClientRect();
      return { sborda: p.scrollWidth > p.clientWidth + 1, largo: a.width };
    });
    ok(!mobile.sborda && mobile.largo > 250, 'Mobile: nessuno sbordo, Avvia largo ' + Math.round(mobile.largo) + ' px');
    await foto('impostazioni-mobile');

    assert.deepEqual(errori, [], 'Nessuna eccezione browser'); verifiche++;
    console.log('Regia delle demo: ' + verifiche + ' verifiche superate');
  } finally {
    if (browser) await browser.close();
    await new Promise(r => server.close(r));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
