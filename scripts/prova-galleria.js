// La sincronizzazione periodica della galleria non deve ricreare i lettori e
// ogni scheda deve poter passare il proprio file al pannello di condivisione.
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
      const condividi = [...document.querySelectorAll('#galleria-elenco button')]
        .find(b => b.textContent === 'Condividi');
      window.__videoCondiviso = null;
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: dati => dati.files?.length === 1 });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async dati => {
        window.__videoCondiviso = {
          nome: dati.files[0].name,
          tipo: dati.files[0].type,
          dimensione: dati.files[0].size,
          titolo: dati.title
        };
      } });
      condividi?.click();
      await new Promise(resolve => setTimeout(resolve, 0));
      prima.dataset.provaIdentita = 'lettore-originale';
      const src = prima.src;
      await new Promise(resolve => setTimeout(resolve, 2300));
      const dopo = document.querySelector('#galleria-elenco video');
      videoChiudiGalleria();

      // Un handle gia' ricordato non deve far comparire una richiesta di
      // permesso al solo ingresso in galleria. Il permesso serve invece al
      // gesto di salvataggio, e il Blob deve arrivare proprio nello scrivibile
      // della cartella scelta.
      let richiestePermesso = 0;
      let blobScritto = null;
      videoCartella = {
        name: 'video-scelti',
        queryPermission: async () => 'prompt',
        requestPermission: async () => { richiestePermesso += 1; return 'granted'; },
        getFileHandle: async () => ({
          createWritable: async () => ({
            write: async blob => { blobScritto = blob; },
            close: async () => {}
          })
        })
      };
      videoCartellaAutorizzata = false;
      await videoApriGalleria();
      const richiesteAprendo = richiestePermesso;
      const filmato = new Blob(['salvato-nella-cartella'], { type: 'video/webm' });
      const scritto = await videoScriviInCartella({ nome: 'scelto.webm', blob: filmato });
      videoChiudiGalleria();
      return {
        stessoNodo: prima === dopo,
        marcatore: dopo?.dataset.provaIdentita,
        stessoSrc: dopo?.src === src,
        condiviso: window.__videoCondiviso,
        richiesteAprendo,
        richiesteSalvando: richiestePermesso,
        scritto,
        dimensioneScritta: blobScritto?.size,
        durataPredefinita: sky.reg.durataSec,
        durataNelleImpostazioni: !!document.querySelector('[data-durata-reg="15"].attiva')
      };
    });

    const ok = esito.stessoNodo && esito.marcatore === 'lettore-originale' && esito.stessoSrc;
    console.log(`${ok ? 'ok' : 'FALLITO'} — il controllo periodico conserva il lettore video`, esito);
    if (!ok) process.exitCode = 1;
    const condivisioneOk = esito.condiviso?.nome === 'prova.webm' &&
      esito.condiviso?.tipo === 'video/webm' && esito.condiviso?.dimensione > 0;
    console.log(`${condivisioneOk ? 'ok' : 'FALLITO'} — ogni video della galleria si può condividere`, esito.condiviso);
    if (!condivisioneOk) process.exitCode = 1;
    const cartellaOk = esito.richiesteAprendo === 0 && esito.richiesteSalvando === 1 &&
      esito.scritto && esito.dimensioneScritta > 0;
    console.log(`${cartellaOk ? 'ok' : 'FALLITO'} — la cartella ricordata non richiede permesso all'apertura e riceve il video`, esito);
    if (!cartellaOk) process.exitCode = 1;
    const durataOk = esito.durataPredefinita === 15 && esito.durataNelleImpostazioni;
    console.log(`${durataOk ? 'ok' : 'FALLITO'} — 15 secondi è la durata predefinita e compare nelle impostazioni`, esito);
    if (!durataOk) process.exitCode = 1;
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
