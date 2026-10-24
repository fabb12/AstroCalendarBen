/* Una storia dello Studio (da `storie-studio/storie.json`), in tempo vero, in
 * un Chromium senza rete: come `giro-storia.js`, ma il copione si fa con
 * `StudioStorie.copione` dal progetto salvato sul repository. Una schermata
 * per ogni battuta (`work/studio-<id>-NN.png`) e, per ognuna, chi parla e
 * chi è disegnato, dove e quanto grande: serve a **guardare** che chi parla
 * si veda sempre.
 *
 *   npm install --no-save playwright-core astronomy-engine satellite.js@5.0.0
 *   PROGETTO=p7jc37qd node scripts/giro-studio.js
 *
 * Variabili: PROGETTO (l'id della storia), DSL (un copione da un file, al
 * posto della storia: per guardare una scena sola), SCENE (le sole scene del copione
 * da fotografare, «3,10,12»), DOPO (ms dopo l'inizio della scena, di serie
 * 1500; più valori separati da virgole per più schermate), L e H. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('playwright-core')); }
const radice = path.resolve(__dirname, '..');
const id = process.env.PROGETTO || 'p7jc37qd';
const fileDsl = process.env.DSL ? path.resolve(process.env.DSL) : null;
const progetto = fileDsl ? null : JSON.parse(fs.readFileSync(path.join(radice, 'storie-studio/storie.json'), 'utf8')).storie.find(p => p.id === id);
if (!fileDsl && !progetto) { console.error('Nessuna storia', id); process.exit(1); }
const nome = fileDsl ? path.basename(fileDsl).replace(/\.[^.]*$/, '') : 'studio-' + id;
fs.mkdirSync(path.join(radice, 'work'), { recursive: true });
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.webm': 'audio/webm' };
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
  const browser = await chromium.launch(Object.assign(eseguibile ? { executablePath: eseguibile } : {}, { args: ['--autoplay-policy=no-user-gesture-required'] }));
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
  // gli avvisi dell'app (un errore di una scena della demo arriva da lì)
  await pagina.addInitScript(() => { window.__avvisi = []; const orig = () => window.skyAvviso; let fatto = false;
    const aggancia = () => { if (fatto || typeof window.skyAvviso !== 'function') return; fatto = true; const f = window.skyAvviso; window.skyAvviso = function (...a) { window.__avvisi.push(a.slice(0, 2).join(': ')); return f.apply(this, a); }; };
    document.addEventListener('DOMContentLoaded', aggancia); setTimeout(aggancia, 3000); void orig; });
  await pagina.addInitScript(() => {
    localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
    localStorage.setItem('astrocal_lingua', 'it');
    localStorage.setItem('astrocal_demo_intro_v1', JSON.stringify({ attiva: false }));
    localStorage.setItem('astrocal_demo_opzioni_v1', JSON.stringify({ schermoIntero: false, registra: false, livelli: null }));
  });
  await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
  await pagina.waitForFunction(() => typeof AstroDemo !== 'undefined' && typeof StorieCosmiche !== 'undefined' && typeof StudioStorie !== 'undefined' && sky.observer && sky.oggetti.length, null, { timeout: 30000 });
  const testo = fileDsl ? fs.readFileSync(fileDsl, 'utf8') : await pagina.evaluate(p => StudioStorie.copione(StudioStorie.ripulisci ? (StudioStorie.ripulisci(p) || p) : p), progetto);
  if (!fileDsl) fs.writeFileSync(path.join(radice, 'work', `${nome}.dsl`), testo);
  const err = await pagina.evaluate(async t => { try { const r = AstroDemo.avvia(t); if (r && r.then) await Promise.race([r, new Promise(ok => setTimeout(ok, 1500))]); return AstroDemo.inCorso ? null : (document.querySelector('#demo-errore, .demo-errore') || {}).textContent || 'la demo non è partita'; } catch (e) { return String(e && e.message || e); } }, testo);
  if (err) console.log('avvio:', err);
  const solo = process.env.SCENE ? process.env.SCENE.split(',').map(Number) : null;
  const dopo = String(process.env.DOPO || '1500').split(',').map(Number);
  let visto = -1;
  const t0 = Date.now();
  while (Date.now() - t0 < 900000) {
    const st = await pagina.evaluate(() => ({ i: AstroDemo.scena, attiva: AstroDemo.inCorso }));
    if (!st.attiva) break;
    if (st.i !== visto) {
      visto = st.i;
      const inizio = Date.now();
      for (let k = 0; k < dopo.length; k++) {
        const resta = dopo[k] - (Date.now() - inizio);
        if (resta > 0) await pagina.waitForTimeout(resta);
        const ora = await pagina.evaluate(() => AstroDemo.inCorso ? AstroDemo.scena : -1);
        if (ora !== visto) break;
        const d = await pagina.evaluate(() => ({ parla: (() => { try { const v = narrazione.voce(); return v && v.personaggio || ''; } catch (_) { return ''; } })(),
          dis: StorieCosmiche.disegnati.map(x => `${x.id}:${x.vista}${x.corpo ? '/' + x.corpo : ''}${x.fuori ? '/FUORI' : ''} @${Math.round(x.x)},${Math.round(x.y)} R${Math.round(x.R)}`) }));
        console.log('scena', visto, '+' + dopo[k], 'parla=' + d.parla, JSON.stringify(d.dis));
        if (!solo || solo.includes(visto)) await pagina.screenshot({ path: path.join(radice, 'work', `${nome}-${String(visto).padStart(2, '0')}${dopo.length > 1 ? '-' + k : ''}.png`) });
      }
    }
    await pagina.waitForTimeout(150);
  }
  console.log('avvisi:', JSON.stringify(await pagina.evaluate(() => window.__avvisi || [])));
  console.log('errori:', errori.length ? errori.join(' | ') : 'nessuno', ' durata', Math.round((Date.now() - t0) / 1000), 's');
  await browser.close(); server.close();
})();
