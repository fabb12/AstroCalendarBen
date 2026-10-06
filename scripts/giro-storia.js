/* Una storia intera, in tempo vero, in un Chromium senza rete: una
 * schermata poco dopo l'inizio di ogni scena (`work/<storia>-NN.png`) e, per
 * ognuna, chi è disegnato, dove e con che corpo. Non è una prova con le
 * verifiche: è il modo di **guardare** una storia lunga prima di
 * pubblicarla (v414: le scene della scala cosmica in cui un personaggio
 * cadeva sotto ai sottotitoli si sono viste così).
 *
 *   npm install --no-save playwright-core astronomy-engine satellite.js@5.0.0
 *   STORIA=storia_stelle node scripts/giro-storia.js
 *
 * Variabili: STORIA (di serie storia_stelle), LINGUA (it, en), SCENE (le
 * sole scene da fotografare, «3,10,12»), DOPO (ms dopo l'inizio della
 * scena, di serie 4200), L e H (la finestra). */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('playwright-core')); }
const radice = path.resolve(__dirname, '..');
const storia = process.env.STORIA || 'storia_stelle';
fs.mkdirSync(path.join(radice, 'work'), { recursive: true });
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const file = path.resolve(radice, '.' + decodeURIComponent(url === '/' ? '/index.html' : url));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', tipi[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
function sintesiFinta() {
  class Frase { constructor(t) { this.text = t; this.lang = ''; } }
  const voce = { corrente: null, timer: [], getVoices: () => [{ name: 'Finta', lang: 'it-IT', default: true, localService: true }], addEventListener() {},
    speak(u) { voce.cancel(); voce.corrente = u; const n = u.text.split(/\s+/).length;
      voce.timer.push(setTimeout(() => u.onstart && u.onstart(), 20));
      voce.timer.push(setTimeout(() => { if (voce.corrente === u) { voce.corrente = null; u.onend && u.onend(); } }, 60 + n * 300)); },
    cancel() { voce.timer.forEach(clearTimeout); voce.timer = []; const u = voce.corrente; voce.corrente = null; if (u && u.onerror) u.onerror({ error: 'interrupted' }); } };
  Object.defineProperty(window, 'speechSynthesis', { value: voce, configurable: true });
  window.SpeechSynthesisUtterance = Frase;
}
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origine = 'http://127.0.0.1:' + server.address().port;
  const eseguibile = ['/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
  const browser = await chromium.launch(eseguibile ? { executablePath: eseguibile } : {});
  const lingua = process.env.LINGUA || 'it';
  const pagina = await browser.newPage({ viewport: { width: Number(process.env.L || 1100), height: Number(process.env.H || 760) }, serviceWorkers: 'block' });
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
  await pagina.addInitScript(l => {
    localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
    localStorage.setItem('astrocal_lingua', l);
    localStorage.setItem('astrocal_demo_intro_v1', JSON.stringify({ attiva: false }));
    localStorage.setItem('astrocal_demo_opzioni_v1', JSON.stringify({ schermoIntero: false, registra: false, livelli: null }));
  }, lingua);
  await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
  await pagina.waitForFunction(() => typeof AstroDemo !== 'undefined' && typeof StorieCosmiche !== 'undefined' && sky.observer && sky.oggetti.length, null, { timeout: 30000 });
  const testo = await pagina.evaluate(k => AstroDemo.libreria.elenco().find(d => d.chiave === k).testo, storia);
  await pagina.evaluate(t => AstroDemo.avvia(t), testo);
  const solo = process.env.SCENE ? process.env.SCENE.split(',').map(Number) : null;
  let visto = -1;
  const t0 = Date.now();
  while (Date.now() - t0 < 600000) {
    const st = await pagina.evaluate(() => ({ i: AstroDemo.scena, attiva: AstroDemo.inCorso }));
    if (!st.attiva) break;
    if (st.i !== visto) {
      visto = st.i;
      await pagina.waitForTimeout(Number(process.env.DOPO || 4200));
      const d = await pagina.evaluate(() => StorieCosmiche.disegnati.map(x => `${x.id}:${x.vista}${x.corpo ? '/' + x.corpo : ''}${x.fuori ? '/fuori' : ''}${x.idea ? '/idea' : ''}${x.veste ? '/' + x.veste : ''} @${Math.round(x.x)},${Math.round(x.y)} R${Math.round(x.R)}`));
      console.log('scena', visto, JSON.stringify(d));
      if (!solo || solo.includes(visto)) await pagina.screenshot({ path: path.join(radice, 'work', `${storia}-${String(visto).padStart(2, '0')}${lingua === 'it' ? '' : '-' + lingua}.png`) });
    }
    await pagina.waitForTimeout(250);
  }
  console.log('errori:', errori.length ? errori.join(' | ') : 'nessuno', ' durata', Math.round((Date.now() - t0) / 1000), 's');
  await browser.close(); server.close();
})();
