/* Le stazioni nelle Storie cosmiche, e le scritte spente (v423).
 *
 *   npm install --no-save playwright-core astronomy-engine satellite.js@5.0.0
 *   node scripts/prova-stazioni-storie.js
 *
 * Il caso reale: una storia faceva parlare la ISS nella vista 3D e la voce
 * partiva, ma la stazione non c'era — senza un TLE fresco (offline, o una
 * data lontana) la scena non la disegnava, e nel banco Terra e Luna le
 * stazioni non esistevano proprio. Qui la pagina è **senza rete**, quindi
 * senza TLE: le stazioni devono comparire lo stesso, sull'orbita di
 * riserva, nella scena grande e nel banco. E con l'opzione `scritteStorie`
 * spenta (di serie) la tela della 3D non deve scrivere niente. */
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
  const url = req.url.split('?')[0];
  const file = path.resolve(radice, '.' + decodeURIComponent(url === '/' ? '/index.html' : url));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', tipi[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

let verifiche = 0;
function ok(c, m) { assert.ok(c, m); verifiche++; console.log('  ok  ' + m); }

// La sintesi finta: una frase dura quanto le sue parole, e finisce
function sintesiFinta() {
  const voce = {
    corrente: null, timer: [],
    getVoices: () => [{ name: 'Finta', lang: 'it-IT', default: true, localService: true }],
    addEventListener() {},
    speak(u) {
      voce.cancel(); voce.corrente = u;
      const n = (u.text.match(/\S+/g) || []).length;
      voce.timer.push(setTimeout(() => u.onstart && u.onstart(), 20));
      voce.timer.push(setTimeout(() => { if (voce.corrente === u) { voce.corrente = null; u.onend && u.onend(); } }, 60 + n * 330));
    },
    cancel() { voce.timer.forEach(clearTimeout); voce.timer = []; const u = voce.corrente; voce.corrente = null; if (u && u.onerror) u.onerror({ error: 'interrupted' }); }
  };
  Object.defineProperty(window, 'speechSynthesis', { value: voce, configurable: true });
  // Conta le scritte della tela della 3D
  window.__scritte = [];
  const fill = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (t, ...r) {
    if (this.canvas && this.canvas.id === 'sol-canvas') window.__scritte.push(String(t));
    return fill.call(this, t, ...r);
  };
}

const STORIA = `define_demo 'stazioni' {
  scene planetarium_view { duration: 1s; action: set_date { iso: '2031-03-10T21:00:00Z' }; }
  scene solar_system_3d { duration: 12s;
    action: camera_3d { scene: system, focus: 'Earth' };
    action: character_show { target: 'ISS', expression: 'happy' };
    action: character_speak { target: 'ISS', text: 'Ciao! Sono la Stazione Spaziale e giro attorno alla Terra ogni novanta minuti.' };
  }
  scene solar_system_3d { duration: 12s;
    action: camera_3d { scene: earth_moon, focus: 'Earth' };
    action: character_show { target: 'ISS' };
    action: character_show { target: 'Tiangong' };
    action: character_speak { target: 'Tiangong', text: 'E io sono Tiangong, la stazione cinese, qui vicino alla Terra e alla Luna.' };
  }
}`;

(async () => {
  let browser;
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    const eseguibile = ['/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
    browser = await chromium.launch(eseguibile ? { executablePath: eseguibile } : {}).catch(() => chromium.launch());
    fs.mkdirSync(path.join(radice, 'work'), { recursive: true });

    async function apri(opzioni) {
      const pagina = await browser.newPage({ viewport: { width: 1100, height: 760 }, serviceWorkers: 'block' });
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
      await pagina.addInitScript(sintesiFinta);
      await pagina.addInitScript(o => {
        localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
        localStorage.setItem('astrocal_lingua', 'it');
        localStorage.setItem('astrocal_demo_intro_v1', JSON.stringify({ attiva: false }));
        localStorage.setItem('astrocal_demo_opzioni_v1', JSON.stringify(Object.assign({ schermoIntero: false, registra: false, livelli: null }, o)));
      }, opzioni || {});
      await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
      await pagina.waitForFunction(() => typeof AstroDemo !== 'undefined' && typeof StorieCosmiche !== 'undefined' &&
        sky.observer && sky.oggetti.length, null, { timeout: 30000 });
      return { pagina, errori };
    }
    const attendi = (pagina, n = 8) => pagina.evaluate(n => new Promise(r => {
      let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f);
    }), n);

    console.log('\n— le stazioni parlano e si vedono, senza TLE —');
    {
      const { pagina, errori } = await apri();
      const nomiPrima = await pagina.evaluate(() => sky.mostraNomi);
      ok(await pagina.evaluate(() => AstroDemo.opzioni.scritteStorie === false), 'di serie le scritte delle storie sono spente');
      await pagina.evaluate(t => AstroDemo.avvia(t), STORIA);
      await pagina.waitForFunction(() => sol.aperto && AstroDemo.scena === 1 && StorieCosmiche.attivi > 0, null, { timeout: 15000 });
      await attendi(pagina, 20);
      const grande = await pagina.evaluate(() => ({
        tle: SATELLITI.some(s => s.id === 'iss' && satTle.iss),
        riserva: (sol.satelliti.find(s => s.id === 'iss') || {}).riserva,
        schermo: sol.satSchermo.map(s => s.id),
        volto: StorieCosmiche.disegnati.filter(d => d.id === 'iss').map(d => d.vista),
        senza: AstroDemo.senzaScritte, nomi: sky.mostraNomi
      }));
      ok(!grande.tle && grande.riserva === true, 'senza rete la ISS è sull\'orbita di riserva');
      ok(grande.schermo.includes('iss') && !grande.schermo.includes('css'), 'nella scena grande si disegna la ISS della storia (non le altre): ' + grande.schermo.join(','));
      ok(grande.volto.includes('sistema'), 'la ISS che parla ha il suo corpo nella 3D');
      ok(grande.senza && grande.nomi === false, 'durante la storia le scritte sono spente, anche i nomi del planetario');
      await pagina.evaluate(() => { window.__scritte = []; });
      await attendi(pagina, 10);
      // Il cartello del luogo («Il Sistema Solare», v430) è della storia,
      // come i sottotitoli: resta anche con le scritte spente
      const delCartello = await pagina.evaluate(() => [astroI18n.t('cosmo.pianeti.nome'), astroI18n.t('cosmo.terraLuna.nome')]);
      const scritte = (await pagina.evaluate(() => window.__scritte.slice())).filter(x => !delCartello.includes(x));
      ok(!scritte.length, 'la tela della 3D non scrive niente: ' + (scritte.slice(0, 5).join(' | ') || 'nessuna scritta'));
      await pagina.screenshot({ path: path.join(radice, 'work/stazioni-storia-sistema.png') });

      await pagina.evaluate(() => AstroDemo.vaiAScena(2, 0.05));
      await pagina.waitForFunction(() => sol.vicino && AstroDemo.scena === 2 && StorieCosmiche.attivi > 1, null, { timeout: 15000 });
      await attendi(pagina, 20);
      const banco = await pagina.evaluate(() => ({
        schermo: sol.satSchermo.map(s => ({ id: s.id, px: s.px, py: s.py })),
        volti: StorieCosmiche.disegnati.map(d => d.id + ':' + d.vista),
        terra: (sol.vicCorpi || []).find(c => c.id === 'Earth')
      }));
      const ids = banco.schermo.map(s => s.id);
      ok(ids.includes('iss') && ids.includes('css'), 'nel banco Terra e Luna ci sono le stazioni: ' + ids.join(','));
      ok(banco.volti.includes('css:vicino') && banco.volti.includes('iss:vicino'), 'e hanno il loro corpo: ' + banco.volti.join(','));
      const t = banco.terra.schermo;
      const fuori = banco.schermo.every(s => Math.hypot(s.px - t.px, s.py - t.py) > banco.terra.rDisegno);
      ok(fuori, 'le stazioni stanno fuori dal globo disegnato');
      await pagina.evaluate(() => { window.__scritte = []; });
      await attendi(pagina, 10);
      const scritteBanco = (await pagina.evaluate(() => window.__scritte.slice())).filter(x => !delCartello.includes(x));
      ok(!scritteBanco.length, 'anche il banco non scrive niente: ' + (scritteBanco.slice(0, 5).join(' | ') || 'nessuna scritta'));
      await pagina.screenshot({ path: path.join(radice, 'work/stazioni-storia-vicino.png') });

      await pagina.evaluate(() => AstroDemo.ferma());
      await attendi(pagina, 4);
      ok(await pagina.evaluate(n => !AstroDemo.senzaScritte && sky.mostraNomi === n, nomiPrima), 'finita la storia, i nomi tornano com\'erano');
      ok(!errori.length, 'nessun errore di pagina: ' + errori.join(' | '));
      await pagina.close();
    }

    console.log('\n— con le scritte accese —');
    {
      const { pagina, errori } = await apri({ scritteStorie: true });
      await pagina.evaluate(t => AstroDemo.avvia(t), STORIA);
      await pagina.waitForFunction(() => sol.aperto && AstroDemo.scena === 1 && StorieCosmiche.attivi > 0, null, { timeout: 15000 });
      await pagina.evaluate(() => { window.__scritte = []; });
      await attendi(pagina, 10);
      const r = await pagina.evaluate(() => ({ senza: AstroDemo.senzaScritte, n: window.__scritte.length }));
      ok(!r.senza && r.n > 0, 'con l\'opzione accesa la 3D scrive i suoi nomi: ' + r.n);
      await pagina.evaluate(() => AstroDemo.ferma());
      ok(!errori.length, 'nessun errore di pagina: ' + errori.join(' | '));
      await pagina.close();
    }

    console.log('\n— fuori dalle storie —');
    {
      const { pagina, errori } = await apri();
      await pagina.evaluate(() => AstroDemo.avvia(`define_demo 'senza' {
  scene solar_system_3d { duration: 6s; action: camera_3d { scene: system, focus: 'Earth' }; }
}`));
      await pagina.waitForFunction(() => sol.aperto, null, { timeout: 15000 });
      await pagina.evaluate(() => { window.__scritte = []; });
      await attendi(pagina, 10);
      const r = await pagina.evaluate(() => ({ senza: AstroDemo.senzaScritte, n: window.__scritte.length,
        stazioni: sol.satSchermo.length }));
      ok(!r.senza && r.n > 0, 'una demo senza personaggi tiene le sue scritte: ' + r.n);
      ok(r.stazioni === 0, 'e senza TLE non inventa stazioni');
      await pagina.evaluate(() => AstroDemo.ferma());
      ok(!errori.length, 'nessun errore di pagina: ' + errori.join(' | '));
      await pagina.close();
    }

    console.log(`\nStazioni e scritte nelle storie: ${verifiche} verifiche superate`);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
