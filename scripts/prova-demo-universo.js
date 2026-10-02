/* La demo «Dalla Terra all'universo», guardata per quello che fa vedere.
 *
 *   npm install --no-save playwright-core astronomy-engine satellite.js@5.0.0
 *   node scripts/prova-demo-universo.js
 *
 * Il difetto tipico di una demo così non si vede guardandola: una carta
 * stellata che si allarga è bella comunque, anche se a metà del viaggio la
 * scala torna indietro di una decade, se una scena comincia da una misura
 * diversa da quella a cui la precedente l'ha lasciata (uno scatto che il
 * racconto copre), o se la Via Lattea viene accesa mentre la voce parla di
 * Andromeda. Qui si guarda l'aritmetica: che ogni scena cosmica sia sulla
 * scala che dice, che la scala non scenda mai durante l'andata e risalga
 * tutta al ritorno, che due scene di fila combacino, che la struttura accesa
 * sia quella nominata, e che alla fine la vista 3D e la carta se ne vadano.
 * Le schermate finiscono in `work/universo-*.png`. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('playwright-core')); }
const radice = path.resolve(__dirname, '..');
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const file = path.resolve(radice, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader('Content-Type', tipi[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

let verifiche = 0;
function ok(c, m) { assert.ok(c, m); verifiche++; }

(async () => {
  let browser;
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    const eseguibile = ['/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
    browser = await chromium.launch(eseguibile ? { executablePath: eseguibile } : {}).catch(() => chromium.launch());
    const larghezza = Number(process.env.UNIVERSO_L || 1100), altezza = Number(process.env.UNIVERSO_H || 760);
    const pagina = await browser.newPage({ viewport: { width: larghezza, height: altezza }, serviceWorkers: 'block' });
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
      localStorage.setItem('astrocal_demo_intro_v1', JSON.stringify({ attiva: false }));
      localStorage.setItem('astrocal_demo_opzioni_v1', JSON.stringify({ schermoIntero: false, registra: false, livelli: null }));
    });
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => typeof AstroDemo !== 'undefined' && typeof sky !== 'undefined' &&
      sky.observer && sky.oggetti.length, null, { timeout: 30000 });
    fs.mkdirSync(path.join(radice, 'work'), { recursive: true });
    const foto = nome => pagina.screenshot({ path: path.join(radice, 'work/universo-' + nome + '.png') });
    const attendiFotogrammi = () => pagina.evaluate(() => new Promise(r =>
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));

    // --- 1. Il viaggio: le coniche raccordate contro i numeri pubblicati ---

    const testo = await pagina.evaluate(() => AstroDemo.libreria.elenco().find(d => d.chiave === 'universo').testo);
    const scene = await pagina.evaluate(t => AstroDemo.valida(t).scene.map(s => ({ vista: s.vista, durata: s.durata,
      cosmo: (s.azioni.find(a => a.comando === 'cosmic_scale') || {}).parametri || null })), testo);
    ok(scene.length === 16, 'Sedici scene');
    ok(scene.reduce((n, s) => n + s.durata, 0) === 380000, 'Sei minuti e venti secondi');
    ok(scene[0].vista === 'planetarium_view' && scene[15].vista === 'planetarium_view', 'Comincia e finisce sotto il cielo di casa');
    await pagina.evaluate(t => { window.__prima = { aperto: sol.aperto }; AstroDemo.avvia(t); }, testo);

    const misura = () => pagina.evaluate(() => ({ aperto: sol.aperto, cosmo: typeof cosm !== 'undefined' && cosm.attivo,
      L: typeof cosm !== 'undefined' ? cosm.L : null, evidenza: typeof cosm !== 'undefined' ? cosm.evidenza : null,
      elev: typeof cosm !== 'undefined' ? cosm.elev : null, vista: vistaAttuale,
      cartello: (document.getElementById('demo-cartello') || {}).textContent || '' }));
    const ferma = async (i, u) => {
      await pagina.evaluate(([i, u]) => { AstroDemo.vaiAScena(i, u); AstroDemo.pausa(); }, [i, u]);
      await attendiFotogrammi(); await pagina.waitForTimeout(200); await attendiFotogrammi();
      return misura();
    };
    const Ldi = id => pagina.evaluate(id => cosmLDi(id), id);
    let ultimo = null;
    for (let i = 0; i < scene.length; i++) {
      const s = scene[i];
      const a = await ferma(i, 0.02);
      const m = await ferma(i, 0.6);
      ok(m.cartello.trim().length > 3, `Scena ${i + 1}: il cartello dice dove siamo («${m.cartello.trim()}»)`);
      if (s.vista === 'solar_system_3d') ok(m.aperto, `Scena ${i + 1}: la vista 3D è aperta`);
      if (s.cosmo) {
        ok(m.cosmo, `Scena ${i + 1}: la scala cosmica è a schermo`);
        const La = await Ldi(s.cosmo.from), Lb = await Ldi(s.cosmo.to);
        ok(Math.abs(a.L - La) < 0.15, `Scena ${i + 1}: comincia da ${s.cosmo.from} (L ${a.L.toFixed(2)} contro ${La.toFixed(2)})`);
        if (ultimo !== null) ok(Math.abs(a.L - ultimo) < 0.15, `Scena ${i + 1}: riprende dalla scala in cui la precedente l'ha lasciata`);
        const z = await ferma(i, 0.999);
        ok(Math.abs(z.L - Lb) < 0.15, `Scena ${i + 1}: finisce su ${s.cosmo.to} (L ${z.L.toFixed(2)} contro ${Lb.toFixed(2)})`);
        if (s.cosmo.focus) {
          const id = await pagina.evaluate(f => cosmStrutture().find(x => x.demo === f).id, s.cosmo.focus);
          ok(m.evidenza === id, `Scena ${i + 1}: è accesa la struttura nominata (${m.evidenza})`);
        }
        // L'andata non torna mai indietro, il ritorno non torna mai avanti
        let prec = null, monotona = true;
        for (let k = 0; k <= 20; k++) {
          const L = await pagina.evaluate(([i, u]) => { AstroDemo.vaiAScena(i, u); AstroDemo.pausa(); return cosm.L; }, [i, k / 20]);
          if (prec !== null && (Lb - La) * (L - prec) < -1e-9) monotona = false;
          prec = L;
        }
        ok(monotona, `Scena ${i + 1}: la scala va sempre nello stesso verso`);
        ultimo = z.L;
        await ferma(i, 0.6);
      } else {
        if (s.vista === 'solar_system_3d') ok(!m.cosmo, `Scena ${i + 1}: la carta cosmica non è rimasta sopra ai pianeti`);
        ultimo = null;
      }
      if (s.vista === 'planetarium_view') ok(!m.aperto && m.vista === 'cielo', `Scena ${i + 1}: è il planetario`);
      await foto(String(i + 1).padStart(2, '0'));
    }
    // Dalla Terra all'universo e ritorno: quindici decade
    const Lt = await Ldi('universe'), Lp = await Ldi('planets');
    ok(Lt - Lp > 13.5, `Il viaggio attraversa ${(Lt - Lp).toFixed(1)} decade oltre i pianeti`);

    // Stop: la 3D e la carta se ne vanno
    await pagina.evaluate(() => AstroDemo.vaiAScena(12, 0.5));
    await attendiFotogrammi();
    await pagina.evaluate(() => AstroDemo.ferma());
    await attendiFotogrammi(); await pagina.waitForTimeout(100);
    const dopo = await misura();
    ok(dopo.aperto === false && !dopo.cosmo, 'Terminando, la vista 3D e la scala cosmica si chiudono');
    ok(!errori.length, 'Nessun errore di pagina: ' + errori.join(' | '));
    console.log(`Demo dalla Terra all'universo: ${verifiche} verifiche superate`);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
