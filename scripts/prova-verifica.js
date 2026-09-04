// Fa girare `verifica.html` in un browser vero e riporta le prove rosse.
//
// Il banco è una pagina che si controlla da sé: qui non si aggiunge nessuna
// prova, si guarda soltanto il suo esito senza dover aprire un browser a
// mano. Le librerie del CDN sono finte come in `prova-nel-browser.js` —
// Astronomy Engine viene da `node_modules` — così l'esito parla del nostro
// codice e non della rete.
//
//     npm install playwright-core astronomy-engine
//     node scripts/prova-verifica.js
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
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
  const f = path.join(RADICE, nome === '/' ? 'verifica.html' : nome);
  if (!f.startsWith(RADICE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPI[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise(r => server.listen(8098, r));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const contesto = await browser.newContext({ serviceWorkers: 'block' });
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on('pageerror', e => errori.push('ECCEZIONE: ' + e.message));
  pagina.on('console', m => { if (m.type() === 'error') errori.push(m.text()); });

  await pagina.route('**cdn.jsdelivr.net**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**cdn.tailwindcss.com**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pagina.route('**/astronomy.browser.min.js', r =>
    r.fulfill({ body: leggiAstronomy(), contentType: 'text/javascript' }));

  await pagina.goto('http://localhost:8098/verifica.html', { waitUntil: 'networkidle', timeout: 60000 });
  await pagina.waitForTimeout(6000);

  const esito = await pagina.evaluate(() => ({
    passate: typeof passate !== 'undefined' ? passate : -1,
    fallite: typeof fallite !== 'undefined' ? fallite : -1,
    rosse: Array.from(document.querySelectorAll('.prova.ko')).map(n => n.textContent.trim())
  }));

  console.log(`prove verdi: ${esito.passate}   rosse: ${esito.fallite}`);
  esito.rosse.forEach(r => console.log('  ✗ ' + r));
  if (errori.length) {
    console.log('\nerrori in console:');
    errori.slice(0, 20).forEach(e => console.log('  ' + e));
  }

  await browser.close();
  server.close();
  process.exit(esito.fallite === 0 && !errori.length ? 0 : 1);
})();
