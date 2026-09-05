// La sincronizzazione periodica della galleria non deve ricreare i lettori:
// farlo interrompe il caricamento e riporta il video all'inizio ogni 2 secondi.
//
//     node scripts/prova-galleria.js
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..');
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const nome = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(RADICE, nome === '/' ? 'index.html' : nome);
  if (!file.startsWith(RADICE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPI[path.extname(file)] || 'text/plain' });
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(resolve => server.listen(8097, resolve));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  try {
    const contesto = await browser.newContext({ serviceWorkers: 'block' });
    const pagina = await contesto.newPage();
    await pagina.route('**/*', rotta => {
      const url = rotta.request().url();
      if (url.startsWith('http://localhost:8097/')) return rotta.continue();
      return rotta.abort();
    });
    await pagina.goto('http://localhost:8097/index.html', { waitUntil: 'domcontentloaded' });

    const esito = await pagina.evaluate(async () => {
      await videoDB('video', 'readwrite', store => store.put({
        id: 'prova.webm', nome: 'prova.webm', tipo: 'video/webm',
        blob: new Blob(['filmato-di-prova'], { type: 'video/webm' }),
        creato: 123456789, origine: 'cielo', durata: 5, cartellaNome: ''
      }));
      await videoApriGalleria();
      const prima = document.querySelector('#galleria-elenco video');
      prima.dataset.provaIdentita = 'lettore-originale';
      const src = prima.src;
      await new Promise(resolve => setTimeout(resolve, 2300));
      const dopo = document.querySelector('#galleria-elenco video');
      videoChiudiGalleria();
      return { stessoNodo: prima === dopo, marcatore: dopo?.dataset.provaIdentita, stessoSrc: dopo?.src === src };
    });

    const ok = esito.stessoNodo && esito.marcatore === 'lettore-originale' && esito.stessoSrc;
    console.log(`${ok ? 'ok' : 'FALLITO'} — il controllo periodico conserva il lettore video`, esito);
    if (!ok) process.exitCode = 1;
    await contesto.close();
  } finally {
    await browser.close();
    server.close();
  }
})().catch(errore => {
  console.error(errore);
  server.close();
  process.exitCode = 1;
});
