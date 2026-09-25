// La Galleria, dall'apertura alla riapertura, in un Chromium vero.
//
//     npm install playwright-core
//     node scripts/prova-galleria.js
//
// Le cose che questa prova esiste per fare sono quasi tutte **assenze**, e le
// assenze non falliscono: una galleria che richiede la cartella somiglia a
// una galleria prudente, una miniatura nera somiglia a un video che sta
// caricando, un video sparito a schermo intero somiglia a uno schermo nero,
// un object URL mai revocato non si vede affatto. Il giudice quindi non è
// l'occhio: si contano i dialoghi, i pixel, i rettangoli e gli indirizzi vivi.
//
// La cartella è finta (un oggetto con i metodi di un
// FileSystemDirectoryHandle) perché un selettore di file vero una prova non
// lo può aprire; i filmati e le immagini invece sono **veri**, registrati qui
// col MediaRecorder da una tela, come nascono quelli dell'app.
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..');
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const PORTA = 8097;

const server = http.createServer((req, res) => {
  const nome = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(RADICE, nome === '/' ? 'index.html' : nome);
  if (!file.startsWith(RADICE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPI[path.extname(file)] || 'text/plain' });
  res.end(fs.readFileSync(file));
});

let falliti = 0;
function ok(nome, esito, dettaglio) {
  console.log(`${esito ? 'ok' : 'FALLITO'} — ${nome}${dettaglio !== undefined ? ' ' + JSON.stringify(dettaglio) : ''}`);
  if (!esito) falliti += 1;
}

// Gli strumenti della prova, messi nella pagina una volta sola: i file veri,
// la cartella finta, il conto degli object URL vivi e degli ascoltatori.
function strumenti() {
  window.__prova = {};
  const P = window.__prova;

  // Gli object URL: quali sono vivi adesso.
  P.vivi = new Set();
  const crea = URL.createObjectURL.bind(URL);
  const revoca = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = b => { const u = crea(b); P.vivi.add(u); return u; };
  URL.revokeObjectURL = u => { P.vivi.delete(u); revoca(u); };
  // Quelli vivi che non sono scaricamenti: uno scaricamento tiene il suo
  // indirizzo per un minuto apposta (Safari lo legge dopo il clic).
  P.viviVeri = () => [...P.vivi].filter(u => !galleria.scaricamenti.has(u));

  // Gli scaricamenti: si registrano invece di partire.
  P.scaricati = [];
  const veroClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) { P.scaricati.push(this.download); return; }
    return veroClick.call(this);
  };

  // Gli ascoltatori aggiunti a finestra e documento.
  P.ascolti = 0;
  for (const bersaglio of [window, document]) {
    const vero = bersaglio.addEventListener.bind(bersaglio);
    bersaglio.addEventListener = (...a) => { P.ascolti += 1; return vero(...a); };
  }

  P.dorme = ms => new Promise(r => setTimeout(r, ms));

  // Un filmato vero: la tela che cambia colore, registrata.
  P.filmato = async (l, h, colori = ['#cc6622', '#2266cc']) => {
    const tela = document.createElement('canvas');
    tela.width = l; tela.height = h;
    const c = tela.getContext('2d');
    const pezzi = [];
    const reg = new MediaRecorder(tela.captureStream(15), { mimeType: 'video/webm' });
    reg.ondataavailable = e => { if (e.data.size) pezzi.push(e.data); };
    const fine = new Promise(r => { reg.onstop = r; });
    reg.start();
    for (let i = 0; i < 16; i += 1) {
      c.fillStyle = colori[i % colori.length];
      c.fillRect(0, 0, l, h);
      c.fillStyle = '#ffffff';
      c.fillRect(i * 4 % l, 10, 20, 20);
      await P.dorme(45);
    }
    reg.stop();
    await fine;
    return new Blob(pezzi, { type: 'video/webm' });
  };

  P.immagine = (l, h) => new Promise(r => {
    const tela = document.createElement('canvas');
    tela.width = l; tela.height = h;
    const c = tela.getContext('2d');
    c.fillStyle = '#3a7'; c.fillRect(0, 0, l, h);
    c.fillStyle = '#fff'; c.fillRect(l / 4, h / 4, l / 2, h / 2);
    tela.toBlob(r, 'image/png');
  });

  // La cartella finta. `file` è una Map nome → File. `permesso` dice cosa
  // risponde il browser; `leggibile` se leggere funziona davvero.
  P.cartella = (nome, file, opz = {}) => {
    const stato = {
      permesso: opz.permesso || 'granted',
      risposta: opz.risposta || 'granted',
      sparita: !!opz.sparita,
      richieste: 0,
      verifiche: 0,
      senzaQuery: !!opz.senzaQuery,
      lenta: opz.lenta || 0
    };
    const errore = nomeErrore => { const e = new Error(nomeErrore); e.name = nomeErrore; return e; };
    const handle = {
      name: nome,
      kind: 'directory',
      __stato: stato,
      async *entries() {
        if (stato.sparita) throw errore('NotFoundError');
        if (stato.permesso !== 'granted') throw errore('NotAllowedError');
        for (const [n, f] of file) {
          if (stato.lenta) await P.dorme(stato.lenta);
          yield [n, { kind: 'file', getFile: async () => {
            if (f === 'rotto') throw errore('NotReadableError');
            return f;
          } }];
        }
      },
      getFileHandle: async (n) => ({
        createWritable: async () => ({ write: async b => { file.set(n, new File([b], n, { type: b.type })); }, close: async () => {} })
      }),
      removeEntry: async n => { file.delete(n); }
    };
    if (!stato.senzaQuery) {
      handle.queryPermission = async () => { stato.verifiche += 1; return stato.permesso; };
      handle.requestPermission = async () => {
        stato.richieste += 1;
        if (stato.risposta === 'granted') stato.permesso = 'granted';
        return stato.risposta;
      };
    }
    return handle;
  };

  // Rimette la galleria come dopo un riavvio con questa cartella salvata.
  P.riavvia = (handle, scelta = { voluta: true, nome: handle ? handle.name : '' }) => {
    videoChiudiGalleria();
    videoCartella = handle;
    videoSceltaCartella = scelta;
    videoCartellaAutorizzata = false;
    videoScritturaAutorizzata = false;
    videoPermessoRifiutato = false;
    videoPronto = Promise.resolve();
  };

  P.selettoreChiamato = 0;
  window.showDirectoryPicker = async () => { P.selettoreChiamato += 1; throw Object.assign(new Error('no'), { name: 'AbortError' }); };

  P.nomiSchede = () => [...document.querySelectorAll('#galleria-elenco .galleria-video')].map(s => s.dataset.nome);
  P.aspettaMiniature = async (ms = 20000) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      const schede = [...document.querySelectorAll('#galleria-elenco .galleria-video')];
      const finite = schede.every(s => {
        const img = s.querySelector('.galleria-miniatura-img');
        return (img && !img.hidden) || s.classList.contains('galleria-senza-anteprima') ||
          s.classList.contains('galleria-non-supportato');
      });
      if (schede.length && finite) return true;
      await P.dorme(100);
    }
    return false;
  };
  // Il rettangolo del contenuto dentro a un media «contain».
  P.contenuto = media => {
    const r = media.getBoundingClientRect();
    const nl = media.videoWidth || media.naturalWidth, nh = media.videoHeight || media.naturalHeight;
    if (!nl || !nh) return null;
    const k = Math.min(r.width / nl, r.height / nh);
    const l = nl * k, h = nh * k;
    return { x: r.left + (r.width - l) / 2, y: r.top + (r.height - h) / 2, l, h, rapporto: l / h, vero: nl / nh };
  };
}

(async () => {
  await new Promise(resolve => server.listen(PORTA, resolve));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  try {
    const contesto = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1000, height: 760 } });
    const pagina = await contesto.newPage();
    const erroriPagina = [];
    pagina.on('pageerror', e => erroriPagina.push(String(e)));
    await pagina.addInitScript(() => { try { localStorage.astrocal_lingua = 'it'; } catch (e) {} });
    await pagina.route('**/*', rotta => {
      const url = rotta.request().url();
      if (url.startsWith(`http://localhost:${PORTA}/`)) return rotta.continue();
      return rotta.abort();
    });
    await pagina.goto(`http://localhost:${PORTA}/index.html`, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => typeof videoApriGalleria === 'function' && typeof astroI18n === 'object');
    await pagina.evaluate(strumenti);
    await pagina.evaluate(async () => { await videoPronto; });

    // I file veri, una volta sola.
    await pagina.evaluate(async () => {
      const P = window.__prova;
      P.orizzontale = new File([await P.filmato(320, 180)], 'orizzontale.webm', { type: 'video/webm', lastModified: Date.now() - 3000 });
      P.verticale = new File([await P.filmato(180, 320, ['#22aa44', '#aa2244'])], 'verticale.webm', { type: '', lastModified: Date.now() - 2000 });
      P.foto = new File([await P.immagine(300, 200)], 'foto.png', { type: 'image/png', lastModified: Date.now() - 1000 });
      P.rotto = new File([new Uint8Array(4000).map((_, i) => (i * 37) % 251)], 'rotto.webm', { type: 'video/webm', lastModified: Date.now() - 4000 });
    });

    // ---------------------------------------------------------------------
    // 1. La cartella già configurata, col permesso che il browser ricorda.
    const conPermesso = await pagina.evaluate(async () => {
      const P = window.__prova;
      const file = new Map([['orizzontale.webm', P.orizzontale], ['foto.png', P.foto], ['note.txt', new File(['x'], 'note.txt')]]);
      const h = P.cartella('I miei video', file);
      P.riavvia(h);
      P.selettoreChiamato = 0;
      await videoApriGalleria();
      const prima = {
        stato: videoStatoCartella,
        sceltaIniziale: !document.getElementById('galleria-scelta-iniziale').classList.contains('hidden'),
        riconnetti: !document.getElementById('galleria-riconnetti').classList.contains('hidden'),
        tastoScegli: document.getElementById('galleria-scegli-cartella').textContent,
        schede: P.nomiSchede()
      };
      videoChiudiGalleria();
      await videoApriGalleria();
      const riaperta = P.nomiSchede();
      return { ...prima, riaperta, richieste: h.__stato.richieste, selettore: P.selettoreChiamato };
    });
    ok('una cartella con permesso si apre direttamente, senza nessun dialogo',
      conPermesso.stato === 'collegata' && !conPermesso.sceltaIniziale && !conPermesso.riconnetti &&
      conPermesso.richieste === 0 && conPermesso.selettore === 0, conPermesso);
    ok('la cartella mostra video e immagini e ignora il resto, anche riaprendo',
      conPermesso.schede.join() === 'foto.png,orizzontale.webm' && conPermesso.riaperta.join() === 'foto.png,orizzontale.webm',
      conPermesso.schede);
    ok('con la cartella collegata il tasto è «Cambia cartella», non «Scegli»',
      conPermesso.tastoScegli === 'Cambia cartella', conPermesso.tastoScegli);

    // 2. Dopo un riavvio il browser è tornato a «prompt»: si chiede il solo
    // permesso, una volta, dentro al tocco che apre — mai il selettore.
    const rinnovo = await pagina.evaluate(async () => {
      const P = window.__prova;
      const h = P.cartella('Ricordata', new Map([['orizzontale.webm', P.orizzontale]]), { permesso: 'prompt' });
      P.riavvia(h);
      P.selettoreChiamato = 0;
      await videoApriGalleria();
      const dopo = { stato: videoStatoCartella, schede: P.nomiSchede(), richieste: h.__stato.richieste };
      videoChiudiGalleria();
      await videoApriGalleria();
      await videoApriGalleria(); // una seconda chiamata a finestra aperta non rifà niente
      return { ...dopo, richiesteRiaprendo: h.__stato.richieste, selettore: P.selettoreChiamato };
    });
    ok('permesso da rinnovare: un solo consenso, nessun selettore, e poi la cartella si legge',
      rinnovo.stato === 'collegata' && rinnovo.richieste === 1 && rinnovo.richiesteRiaprendo === 1 &&
      rinnovo.selettore === 0 && rinnovo.schede.join() === 'orizzontale.webm', rinnovo);

    // 3. Permesso negato: resta l'archivio, compare «Consenti l'accesso», e
    // la galleria non lo richiede da sola a ogni apertura.
    const negato = await pagina.evaluate(async () => {
      const P = window.__prova;
      await videoDB('video', 'readwrite', s => s.put({ id: 'archivio.webm', nome: 'archivio.webm', tipo: 'video/webm',
        blob: P.orizzontale, creato: 1000, durata: 2, cartellaNome: '' }));
      const h = P.cartella('Negata', new Map([['orizzontale.webm', P.orizzontale]]), { permesso: 'prompt', risposta: 'denied' });
      P.riavvia(h);
      await videoApriGalleria();
      const esito = {
        stato: videoStatoCartella,
        riconnetti: !document.getElementById('galleria-riconnetti').classList.contains('hidden'),
        schede: P.nomiSchede(),
        richieste: h.__stato.richieste
      };
      videoChiudiGalleria();
      await videoApriGalleria();
      esito.richiesteRiaprendo = h.__stato.richieste;
      h.__stato.risposta = 'granted';
      await videoRiconnettiCartella();
      esito.dopoConsenso = { stato: videoStatoCartella, richieste: h.__stato.richieste, schede: P.nomiSchede() };
      videoChiudiGalleria();
      return esito;
    });
    ok('permesso negato: archivio visibile, tasto «Consenti», nessuna richiesta ripetuta da sola',
      negato.stato === 'negata' && negato.riconnetti && negato.schede.includes('archivio.webm') &&
      negato.richieste === 1 && negato.richiesteRiaprendo === 1, negato);
    ok('«Consenti l’accesso» chiede il permesso e mostra la cartella',
      negato.dopoConsenso.stato === 'collegata' && negato.dopoConsenso.richieste === 2 &&
      negato.dopoConsenso.schede.includes('orizzontale.webm'), negato.dopoConsenso);

    // 4. La cartella spostata o eliminata: allora sì, va riscelta.
    const persa = await pagina.evaluate(async () => {
      const P = window.__prova;
      const h = P.cartella('Sparita', new Map(), { sparita: true });
      P.riavvia(h);
      await videoApriGalleria();
      const r = {
        stato: videoStatoCartella,
        tasto: document.getElementById('galleria-scegli-cartella').textContent,
        visibile: !document.getElementById('galleria-scegli-cartella').classList.contains('hidden'),
        richieste: h.__stato.richieste,
        schede: P.nomiSchede()
      };
      videoChiudiGalleria();
      return r;
    });
    ok('una cartella sparita si dice tale e offre «Scegli di nuovo», senza chiedere permessi',
      persa.stato === 'persa' && persa.visibile && persa.tasto === 'Scegli di nuovo' && persa.richieste === 0 &&
      persa.schede.includes('archivio.webm'), persa);

    // 5. Un browser senza queryPermission, dove leggere però funziona.
    const senzaQuery = await pagina.evaluate(async () => {
      const P = window.__prova;
      const h = P.cartella('Senza query', new Map([['foto.png', P.foto]]), { senzaQuery: true });
      P.riavvia(h);
      await videoApriGalleria();
      const r = { stato: videoStatoCartella, schede: P.nomiSchede() };
      videoChiudiGalleria();
      return r;
    });
    ok('senza queryPermission la cartella leggibile si apre lo stesso',
      senzaQuery.stato === 'collegata' && senzaQuery.schede.includes('foto.png'), senzaQuery);

    // 6. Mai decisa, e browser senza selettore.
    const stati = await pagina.evaluate(async () => {
      const P = window.__prova;
      P.riavvia(null, null);
      await videoApriGalleria();
      const maiDecisa = { stato: videoStatoCartella,
        sceltaIniziale: !document.getElementById('galleria-scelta-iniziale').classList.contains('hidden') };
      videoChiudiGalleria();
      const selettore = window.showDirectoryPicker;
      delete window.showDirectoryPicker;
      P.riavvia(null, null);
      await videoApriGalleria();
      const nonSupportata = { stato: videoStatoCartella,
        sceltaIniziale: !document.getElementById('galleria-scelta-iniziale').classList.contains('hidden') };
      videoChiudiGalleria();
      window.showDirectoryPicker = selettore;
      return { maiDecisa, nonSupportata };
    });
    ok('mai decisa: la domanda iniziale; senza selettore: nessuna domanda che non si può soddisfare',
      stati.maiDecisa.stato === 'nessuna' && stati.maiDecisa.sceltaIniziale &&
      stati.nonSupportata.stato === 'non-supportata' && !stati.nonSupportata.sceltaIniziale, stati);

    // ---------------------------------------------------------------------
    // 7. Le miniature, con file veri: dipinte, non nere, fatte una per volta,
    // senza lettori nascosti che restano, e ricordate su disco.
    const miniature = await pagina.evaluate(async () => {
      const P = window.__prova;
      await videoDB('video', 'readwrite', s => s.clear());
      await videoDB('anteprime', 'readwrite', s => s.clear());
      videoAnteprime.clear();
      const file = new Map([
        ['orizzontale.webm', P.orizzontale], ['verticale.webm', P.verticale],
        ['foto.png', P.foto], ['rotto.webm', P.rotto], ['sparisce.webm', 'rotto']
      ]);
      P.file = file;
      P.h = P.cartella('Cielo', file);
      P.riavvia(P.h);
      let insieme = 0, massimo = 0;
      const veraVideo = videoAnteprimaVideo;
      videoAnteprimaVideo = async el => {
        insieme += 1; massimo = Math.max(massimo, insieme);
        try { return await veraVideo(el); } finally { insieme -= 1; }
      };
      await videoApriGalleria();
      const finite = await P.aspettaMiniature();
      videoAnteprimaVideo = veraVideo;
      const luce = src => new Promise(r => {
        const img = new Image();
        img.onload = () => {
          const t = document.createElement('canvas');
          t.width = img.naturalWidth; t.height = img.naturalHeight;
          const c = t.getContext('2d'); c.drawImage(img, 0, 0);
          const d = c.getImageData(0, 0, t.width, t.height).data;
          let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
          r({ l: t.width, h: t.height, medio: Math.round(s / (d.length / 4)) });
        };
        img.onerror = () => r(null);
        img.src = src;
      });
      const schede = {};
      for (const s of document.querySelectorAll('#galleria-elenco .galleria-video')) {
        const img = s.querySelector('.galleria-miniatura-img');
        schede[s.dataset.nome] = {
          visibile: !img.hidden,
          segno: !s.querySelector('.galleria-miniatura-segno').hidden,
          senza: s.classList.contains('galleria-senza-anteprima'),
          pixel: !img.hidden ? await luce(img.src) : null
        };
      }
      const chiavi = new Set(await videoDB('anteprime', 'readonly', s => s.getAllKeys()));
      const salvate = galleria.elementi.filter(e => chiavi.has(videoChiaveAnteprima(e)));
      const servizio = document.querySelectorAll('.galleria-lettore-servizio').length;
      const messaggio = document.getElementById('galleria-stato').textContent;
      // Riaprendo con la memoria svuotata, le miniature tornano dal disco:
      // nessun filmato si decodifica una seconda volta.
      videoChiudiGalleria();
      videoAnteprime.clear();
      let decodifiche = 0;
      videoAnteprimaVideo = async el => { decodifiche += 1; return veraVideo(el); };
      await videoApriGalleria();
      await P.aspettaMiniature();
      videoAnteprimaVideo = veraVideo;
      return { finite, massimo, schede, salvate: salvate.length, servizio, messaggio, decodificheRiaprendo: decodifiche };
    });
    const s7 = miniature.schede;
    ok('le miniature dei video sono fotogrammi dipinti, orizzontali e verticali',
      miniature.finite && s7['orizzontale.webm'].visibile && s7['verticale.webm'].visibile &&
      s7['orizzontale.webm'].pixel.l > s7['orizzontale.webm'].pixel.h &&
      s7['verticale.webm'].pixel.h > s7['verticale.webm'].pixel.l &&
      s7['orizzontale.webm'].pixel.medio > 20 && s7['verticale.webm'].pixel.medio > 20, s7);
    ok('anche le immagini hanno la loro miniatura', s7['foto.png'].visibile && s7['foto.png'].pixel.medio > 20, s7['foto.png']);
    ok('un file corrotto ha il segno di ripiego e non blocca gli altri',
      s7['rotto.webm'].senza && s7['rotto.webm'].segno && !s7['rotto.webm'].visibile, s7['rotto.webm']);
    ok('un file che non si lascia leggere viene saltato e lo si dice',
      !('sparisce.webm' in s7) && /1 file/.test(miniature.messaggio), miniature.messaggio);
    ok('le miniature si fanno una per volta, e nessun lettore di servizio resta nel documento',
      miniature.massimo === 1 && miniature.servizio === 0, { massimo: miniature.massimo, servizio: miniature.servizio });
    ok('le miniature (e il «no» di un file corrotto) restano su disco: la riapertura non ridecodifica niente',
      miniature.salvate === 4 && miniature.decodificheRiaprendo === 0,
      { salvate: miniature.salvate, decodifiche: miniature.decodificheRiaprendo });

    // 8. Il controllo periodico non ricrea le schede se niente è cambiato, e
    // vede un file nuovo quando arriva.
    const periodico = await pagina.evaluate(async () => {
      const P = window.__prova;
      const prima = document.querySelector('#galleria-elenco .galleria-video');
      prima.dataset.segno = 'originale';
      await P.dorme(VIDEO_SINCRONIA_MS + 400);
      const stessa = document.querySelector('#galleria-elenco .galleria-video');
      P.file.set('nuovo.png', new File([await P.immagine(100, 100)], 'nuovo.png', { type: 'image/png', lastModified: Date.now() }));
      await P.dorme(VIDEO_SINCRONIA_MS + 400);
      return { stessaScheda: stessa === prima && stessa.dataset.segno === 'originale', nomi: P.nomiSchede() };
    });
    ok('il controllo periodico non ridisegna niente se niente cambia, e vede i file nuovi',
      periodico.stessaScheda && periodico.nomi[0] === 'nuovo.png', periodico);

    // ---------------------------------------------------------------------
    // 9. Il visualizzatore: immagine e video, misure vere, un solo indirizzo.
    const visore = await pagina.evaluate(async () => {
      const P = window.__prova;
      P.file.delete('nuovo.png');
      galleria.firma = null;
      await videoRenderGalleria();
      const indice = nome => galleria.elementi.findIndex(e => e.nome === nome);
      document.querySelector(`#galleria-elenco .galleria-video[data-nome="foto.png"] .galleria-miniatura`).click();
      await P.dorme(300);
      const palco = document.getElementById('galleria-visore-palco');
      const img = palco.querySelector('img.visore-media');
      const rImg = P.contenuto(img);
      const pr = palco.getBoundingClientRect();
      const urlImmagine = img.src;
      videoVisoreMostra(indice('orizzontale.webm'));
      const video = palco.querySelector('video.visore-media');
      await new Promise(r => { if (video.readyState >= 2) r(); else video.addEventListener('loadeddata', r, { once: true }); });
      const rVideo = P.contenuto(video);
      const vivi = P.viviVeri();
      return {
        aperto: videoVisoreAperto(),
        galleriaAperta: galleria.aperta,
        img: { tag: img && img.tagName, rapporto: rImg.rapporto, vero: rImg.vero, dentro: rImg.l <= pr.width + 1 && rImg.h <= pr.height + 1 && rImg.l > 0 },
        video: { rapporto: rVideo.rapporto, vero: rVideo.vero, l: rVideo.l, h: rVideo.h, fit: getComputedStyle(video).objectFit },
        immagineRevocata: !P.vivi.has(urlImmagine),
        vivi: vivi.length,
        viviSonoIlVideo: vivi.length === 1 && vivi[0] === video.src,
        posizione: document.getElementById('galleria-visore-posizione').textContent,
        prec: document.getElementById('galleria-visore-prec').disabled,
        condividi: !document.getElementById('galleria-visore-condividi').hidden
      };
    });
    ok('il visualizzatore apre immagini e video col loro rapporto d’aspetto, interi',
      visore.aperto && visore.img.tag === 'IMG' && Math.abs(visore.img.rapporto - visore.img.vero) < 0.02 && visore.img.dentro &&
      Math.abs(visore.video.rapporto - visore.video.vero) < 0.02 && visore.video.l > 0 && visore.video.fit === 'contain', visore);
    ok('passando al video, l’indirizzo dell’immagine è revocato: ne vive uno solo, quello in uso',
      visore.immagineRevocata && visore.viviSonoIlVideo, visore);

    // 10. Lo schermo intero del contenitore, e il video orizzontale su un
    // telefono in verticale: resta intero e dentro allo schermo, anche
    // girando il telefono mentre è a schermo intero.
    const geometria = async () => pagina.evaluate(() => {
      const P = window.__prova;
      const v = document.getElementById('galleria-visore');
      const media = document.querySelector('#galleria-visore-palco .visore-media');
      const c = P.contenuto(media);
      const vw = window.innerWidth, vh = window.innerHeight;
      return {
        pieno: document.fullscreenElement === v, classe: v.classList.contains('visore-pieno'),
        vw, vh, c,
        dentro: !!c && c.l > 0 && c.h > 0 && c.x >= -1 && c.y >= -1 && c.x + c.l <= vw + 1 && c.y + c.h <= vh + 1,
        rapportoOk: !!c && Math.abs(c.rapporto - c.vero) < 0.02,
        // Usa lo spazio: tocca almeno un lato dello schermo.
        pienoLato: !!c && (c.l >= vw - 2 || c.h >= vh - 60)
      };
    });
    await pagina.setViewportSize({ width: 360, height: 640 });
    await pagina.waitForTimeout(150);
    await pagina.click('#galleria-visore-pieno');
    await pagina.waitForTimeout(400);
    const orizzInVerticale = await geometria();
    ok('lo schermo intero va al contenitore del visualizzatore', orizzInVerticale.pieno && orizzInVerticale.classe, orizzInVerticale);
    ok('video orizzontale su schermo verticale a schermo intero: visibile, intero, largo quanto lo schermo',
      orizzInVerticale.dentro && orizzInVerticale.rapportoOk && orizzInVerticale.c.l >= 358, orizzInVerticale.c);
    await pagina.setViewportSize({ width: 640, height: 360 });
    await pagina.waitForTimeout(400);
    const dopoRotazione = await geometria();
    ok('girando il telefono a schermo intero il video si riadatta e resta dentro',
      dopoRotazione.pieno && dopoRotazione.dentro && dopoRotazione.rapportoOk && dopoRotazione.c.h >= 358, dopoRotazione.c);
    // Il video verticale su uno schermo orizzontale.
    await pagina.evaluate(async () => {
      videoVisoreMostra(galleria.elementi.findIndex(e => e.nome === 'verticale.webm'));
      const v = document.querySelector('#galleria-visore-palco video');
      await new Promise(r => { if (v.readyState >= 2) r(); else v.addEventListener('loadeddata', r, { once: true }); });
    });
    const vertInOrizz = await geometria();
    ok('video verticale su schermo orizzontale: intero e alto quanto lo schermo',
      vertInOrizz.dentro && vertInOrizz.rapportoOk && vertInOrizz.c.h >= 358 && vertInOrizz.c.l < 300, vertInOrizz.c);
    // L'immagine a schermo intero, poi l'uscita.
    await pagina.evaluate(async () => {
      videoVisoreMostra(galleria.elementi.findIndex(e => e.nome === 'foto.png'));
      await window.__prova.dorme(200);
    });
    const immaginePiena = await geometria();
    ok('anche un’immagine a schermo intero resta intera e centrata',
      immaginePiena.pieno && immaginePiena.dentro && immaginePiena.rapportoOk && immaginePiena.pienoLato, immaginePiena.c);
    await pagina.evaluate(() => document.exitFullscreen());
    await pagina.waitForTimeout(300);
    const uscito = await pagina.evaluate(() => ({
      pieno: !!document.fullscreenElement,
      classe: document.getElementById('galleria-visore').classList.contains('visore-pieno'),
      etichetta: document.getElementById('galleria-visore-pieno').getAttribute('aria-label'),
      aperto: videoVisoreAperto()
    }));
    ok('uscendo dallo schermo intero il visualizzatore resta aperto e il tasto torna a «Schermo intero»',
      !uscito.pieno && !uscito.classe && uscito.aperto && uscito.etichetta === 'Schermo intero', uscito);
    // Uscire dal visualizzatore mentre si è a schermo intero esce anche da lì.
    await pagina.click('#galleria-visore-pieno');
    await pagina.waitForTimeout(300);
    await pagina.evaluate(() => videoVisoreChiudi());
    await pagina.waitForTimeout(300);
    const chiusoDalPieno = await pagina.evaluate(() => ({ pieno: !!document.fullscreenElement, aperto: videoVisoreAperto(), vivi: window.__prova.viviVeri().length }));
    ok('chiudere il visualizzatore a schermo intero esce dal pieno schermo e libera il media',
      !chiusoDalPieno.pieno && !chiusoDalPieno.aperto && chiusoDalPieno.vivi === 0, chiusoDalPieno);

    // Il ripiego CSS (iPhone: niente API sugli elementi) per un'immagine.
    const ripiego = await pagina.evaluate(async () => {
      const P = window.__prova;
      videoVisoreApri(galleria.elementi.findIndex(e => e.nome === 'foto.png'));
      await P.dorme(150);
      const v = document.getElementById('galleria-visore');
      const vero = v.requestFullscreen, veroWebkit = v.webkitRequestFullscreen;
      v.requestFullscreen = undefined;
      v.webkitRequestFullscreen = undefined;
      await videoVisoreEntraPieno();
      const dentro = { classe: v.classList.contains('visore-pieno'), immersivo: visore.immersivo };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const dopoEsc = { classe: v.classList.contains('visore-pieno'), aperto: videoVisoreAperto() };
      v.requestFullscreen = vero;
      v.webkitRequestFullscreen = veroWebkit;
      videoVisoreChiudi();
      return { dentro, dopoEsc };
    });
    ok('senza API di schermo intero c’è il ripiego, ed Esc esce da lui prima che dal visualizzatore',
      ripiego.dentro.classe && ripiego.dentro.immersivo && !ripiego.dopoEsc.classe && ripiego.dopoEsc.aperto, ripiego);

    // 11. Tastiera: frecce, Esc che chiude prima il visualizzatore e poi la
    // galleria.
    await pagina.setViewportSize({ width: 1000, height: 760 });
    const tastiera = await pagina.evaluate(async () => {
      const P = window.__prova;
      const premi = key => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      videoVisoreApri(0);
      await P.dorme(50);
      const nomi = [document.getElementById('galleria-visore-nome').textContent];
      premi('ArrowRight'); nomi.push(document.getElementById('galleria-visore-nome').textContent);
      premi('ArrowRight'); nomi.push(document.getElementById('galleria-visore-nome').textContent);
      premi('ArrowLeft'); nomi.push(document.getElementById('galleria-visore-nome').textContent);
      const prec0 = (() => { videoVisoreMostra(0); return document.getElementById('galleria-visore-prec').disabled; })();
      premi('ArrowLeft'); const restaPrimo = document.getElementById('galleria-visore-nome').textContent === galleria.elementi[0].nome;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      const dopoPrimo = { visore: videoVisoreAperto(), galleria: !document.getElementById('modale-galleria').classList.contains('hidden') };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      const dopoSecondo = { galleria: !document.getElementById('modale-galleria').classList.contains('hidden') };
      return { nomi, prec0, restaPrimo, dopoPrimo, dopoSecondo, attesi: galleria.elementi.slice(0, 3).map(e => e.nome) };
    });
    ok('le frecce scorrono gli elementi e si fermano ai capi',
      tastiera.nomi[1] === tastiera.attesi[1] && tastiera.nomi[2] === tastiera.attesi[2] &&
      tastiera.nomi[3] === tastiera.attesi[1] && tastiera.prec0 && tastiera.restaPrimo, tastiera);
    ok('Esc chiude prima il visualizzatore, poi la galleria',
      !tastiera.dopoPrimo.visore && tastiera.dopoPrimo.galleria && !tastiera.dopoSecondo.galleria, tastiera);

    // ---------------------------------------------------------------------
    // 12. La condivisione: supportata, non supportata, annullata, fallita.
    const condivisione = await pagina.evaluate(async () => {
      const P = window.__prova;
      await videoApriGalleria();
      await P.aspettaMiniature();
      const el = galleria.elementi.find(e => e.nome === 'verticale.webm');
      const esiti = {};
      let passato = null;
      const imposta = (puo, share) => {
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: puo });
        Object.defineProperty(navigator, 'share', { configurable: true, value: share });
      };
      imposta(d => !!(d.files && d.files.length === 1), async d => { passato = d; });
      esiti.supportata = await videoCondividiSalvato(el);
      const file = passato && passato.files[0];
      esiti.file = file && { nome: file.name, tipo: file.type, peso: file.size, soloFile: !('url' in passato) && !('text' in passato) };
      // Un file dall'archivio col tipo già giusto: si passa quello, non una copia.
      const archivio = { nome: 'dall-archivio.webm', tipo: 'video/webm', blob: P.orizzontale };
      const originale = new File([P.orizzontale], 'dall-archivio.webm', { type: 'video/webm' });
      archivio.blob = originale;
      await videoCondividiSalvato(archivio);
      esiti.stessoFile = passato.files[0] === originale;

      P.scaricati.length = 0;
      document.getElementById('galleria-stato').textContent = '';
      imposta(() => false, async () => { throw new Error('non doveva'); });
      esiti.nonSupportata = await videoCondividiSalvato(el);
      esiti.scaricatoNonSupportata = P.scaricati.slice();
      esiti.messaggioNonSupportata = document.getElementById('galleria-stato').textContent;
      // Il visualizzatore nasconde il tasto dove non serve.
      videoVisoreApri(galleria.elementi.indexOf(el));
      esiti.tastoNascosto = document.getElementById('galleria-visore-condividi').hidden;
      videoVisoreChiudi();

      P.scaricati.length = 0;
      document.getElementById('galleria-stato').textContent = '';
      imposta(() => true, async () => { throw Object.assign(new Error('chiuso'), { name: 'AbortError' }); });
      esiti.annullata = await videoCondividiSalvato(el);
      esiti.annullataMessaggio = document.getElementById('galleria-stato').textContent;
      esiti.annullataScaricati = P.scaricati.length;

      imposta(() => true, async () => { throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }); });
      esiti.errore = await videoCondividiSalvato(el);
      esiti.erroreMessaggio = document.getElementById('galleria-stato').textContent;
      esiti.erroreScaricati = P.scaricati.length;
      delete navigator.canShare; delete navigator.share;
      return esiti;
    });
    ok('condivisione supportata: passa il File con nome e tipo giusti, e nient’altro',
      condivisione.supportata === 'condiviso' && condivisione.file && condivisione.file.nome === 'verticale.webm' &&
      condivisione.file.tipo === 'video/webm' && condivisione.file.peso > 1000 && condivisione.file.soloFile, condivisione);
    ok('un File che ha già nome e tipo giusti si condivide così com’è', condivisione.stessoFile, condivisione.stessoFile);
    ok('condivisione non supportata: si scarica il file e lo si dice, e il tasto non compare',
      condivisione.nonSupportata === 'non-supportata' && condivisione.scaricatoNonSupportata.join() === 'verticale.webm' &&
      /scaricato/.test(condivisione.messaggioNonSupportata) && condivisione.tastoNascosto, condivisione);
    ok('annullare il pannello non è un errore: nessun messaggio, nessuno scaricamento',
      condivisione.annullata === 'annullata' && condivisione.annullataMessaggio === '' && condivisione.annullataScaricati === 0, condivisione);
    ok('un errore vero di condivisione si dice, col suo motivo',
      condivisione.errore === 'errore' && /Permission denied/.test(condivisione.erroreMessaggio) && condivisione.erroreScaricati === 0, condivisione);

    // ---------------------------------------------------------------------
    // 13. File corrotto nel visualizzatore.
    const corrotto = await pagina.evaluate(async () => {
      const P = window.__prova;
      videoVisoreApri(galleria.elementi.findIndex(e => e.nome === 'rotto.webm'));
      const t0 = performance.now();
      while (performance.now() - t0 < 5000 && !document.querySelector('#galleria-visore-palco .visore-guasto')) await P.dorme(50);
      const guasto = document.querySelector('#galleria-visore-palco .visore-guasto');
      const r = { guasto: !!guasto, testo: guasto && guasto.textContent, scarica: !!(guasto && guasto.querySelector('button')) };
      videoVisoreScorri(-1);
      r.dopoAvanti = !document.querySelector('#galleria-visore-palco .visore-guasto');
      videoVisoreChiudi();
      return r;
    });
    ok('un video corrotto si dice tale nel visualizzatore, con lo scaricamento, e non blocca il resto',
      corrotto.guasto && /danneggiato/.test(corrotto.testo) && corrotto.scarica && corrotto.dopoAvanti, corrotto);

    // 14. Cambio rapido fra media: mai due indirizzi vivi, e l'ultimo vince.
    const rapido = await pagina.evaluate(async () => {
      const P = window.__prova;
      videoVisoreApri(0);
      for (let i = 0; i < 12; i += 1) videoVisoreMostra(i % galleria.elementi.length);
      const vivi = P.viviVeri().length;
      const media = document.querySelectorAll('#galleria-visore-palco .visore-media').length;
      await P.dorme(400);
      const nome = document.getElementById('galleria-visore-nome').textContent;
      videoVisoreChiudi();
      return { vivi, media, nome, atteso: galleria.elementi[11 % galleria.elementi.length].nome, dopo: P.viviVeri().length };
    });
    ok('cambiando media in fretta resta un solo media e un solo indirizzo, e chiudendo nessuno',
      rapido.vivi === 1 && rapido.media === 1 && rapido.nome === rapido.atteso && rapido.dopo === 0, rapido);

    // 15. Aperture e chiusure ripetute: niente ascoltatori nuovi, niente
    // indirizzi, lettori o schede che restano; e una chiusura a metà
    // caricamento non disegna niente dopo.
    const ripetute = await pagina.evaluate(async () => {
      const P = window.__prova;
      const ascoltiPrima = P.ascolti;
      for (let i = 0; i < 5; i += 1) {
        await videoApriGalleria();
        videoVisoreApri(0);
        await P.dorme(30);
        videoVisoreScorri(1);
        videoVisoreChiudi();
        videoChiudiGalleria();
      }
      await P.dorme(300);
      const dopoChiusure = {
        ascoltiNuovi: P.ascolti - ascoltiPrima,
        vivi: P.viviVeri().length,
        servizio: document.querySelectorAll('.galleria-lettore-servizio').length,
        schede: document.querySelectorAll('#galleria-elenco > *').length,
        videoNelVisore: document.querySelectorAll('#galleria-visore video').length,
        timer: galleria.timer
      };
      // Aprire e chiudere subito, mentre la cartella è lenta a leggersi.
      P.h.__stato.lenta = 60;
      const apertura = videoApriGalleria();
      videoChiudiGalleria();
      await apertura;
      await galleria.corsa;
      await P.dorme(600);
      P.h.__stato.lenta = 0;
      const dopoCorsa = { schede: document.querySelectorAll('#galleria-elenco > *').length, aperta: galleria.aperta };
      // Chiamare l'avvio una seconda volta non raddoppia gli ascolti.
      const primaAvvio = P.ascolti;
      await videoInizializza();
      return { dopoChiusure, dopoCorsa, ascoltiAvvio: P.ascolti - primaAvvio };
    });
    ok('cinque aperture e chiusure non lasciano ascoltatori, indirizzi, lettori o timer',
      ripetute.dopoChiusure.ascoltiNuovi === 0 && ripetute.dopoChiusure.vivi === 0 &&
      ripetute.dopoChiusure.servizio === 0 && ripetute.dopoChiusure.schede === 0 &&
      ripetute.dopoChiusure.videoNelVisore === 0 && ripetute.dopoChiusure.timer === 0 && ripetute.ascoltiAvvio === 0, ripetute);
    ok('una galleria chiusa a metà caricamento non si riempie dopo',
      ripetute.dopoCorsa.schede === 0 && !ripetute.dopoCorsa.aperta, ripetute.dopoCorsa);

    // 16. La cartella cambiata durante una scansione: vince la nuova.
    const cambio = await pagina.evaluate(async () => {
      const P = window.__prova;
      P.h.__stato.lenta = 0;
      P.riavvia(P.h);
      await videoApriGalleria();
      const nuova = P.cartella('Nuova', new Map([['foto.png', P.foto]]));
      P.h.__stato.lenta = 80;
      galleria.firma = null;
      const corsa = videoRenderGalleria();
      await P.dorme(120);
      videoCartella = nuova;
      videoCartellaAutorizzata = true;
      await corsa;
      const nomi = P.nomiSchede();
      P.h.__stato.lenta = 0;
      videoChiudiGalleria();
      return nomi;
    });
    ok('se la cartella cambia durante la lettura, si mostra quella nuova',
      cambio.join() === 'foto.png', cambio);

    // 17. Le cose che c'erano prima e restano: il «Nuovo», il play che lo
    // toglie, la durata di serie delle registrazioni.
    const ancora = await pagina.evaluate(async () => {
      const P = window.__prova;
      P.riavvia(null, { voluta: false, nome: '' });
      await videoDB('video', 'readwrite', s => s.clear());
      videoVisti = { nomi: new Set(), dalla: Date.now() - 1000 };
      await videoDB('video', 'readwrite', s => s.put({ id: 'stanotte.webm', nome: 'stanotte.webm', tipo: 'video/webm',
        blob: P.orizzontale, creato: Date.now(), durata: 4, cartellaNome: '' }));
      await videoDB('video', 'readwrite', s => s.put({ id: 'vecchio.webm', nome: 'vecchio.webm', tipo: 'video/webm',
        blob: P.orizzontale, creato: 5000, durata: 4, cartellaNome: '' }));
      await videoApriGalleria();
      const nuovi = [...document.querySelectorAll('#galleria-elenco .galleria-nuovo')].map(n => n.closest('.galleria-video').dataset.nome);
      videoVisoreApri(galleria.elementi.findIndex(e => e.nome === 'stanotte.webm'));
      document.querySelector('#galleria-visore-palco video').dispatchEvent(new Event('play'));
      const tolto = !document.querySelector('#galleria-elenco .galleria-nuovo');
      videoVisoreChiudi();
      galleria.firma = null;
      await videoRenderGalleria();
      const dopoRidisegno = document.querySelectorAll('#galleria-elenco .galleria-nuovo').length;
      videoChiudiGalleria();
      return { nuovi, tolto, dopoRidisegno, durata: sky.reg.durataSec,
        durataImpostazioni: !!document.querySelector('[data-durata-reg="15"].attiva') };
    });
    ok('il video di stanotte è marcato «Nuovo», guardarlo lo toglie e un ridisegno non lo riporta',
      ancora.nuovi.join() === 'stanotte.webm' && ancora.tolto && ancora.dopoRidisegno === 0, ancora);
    ok('15 secondi è la durata predefinita e compare nelle impostazioni',
      ancora.durata === 15 && ancora.durataImpostazioni, ancora);

    // 18. Il percorso reale, coi clic veri: apertura → cartella →
    // miniature → media → schermo intero → rotazione → condivisione →
    // chiusura → riapertura.
    await pagina.setViewportSize({ width: 390, height: 780 });
    await pagina.evaluate(async () => {
      const P = window.__prova;
      const h = P.cartella('Percorso', new Map([['orizzontale.webm', P.orizzontale], ['foto.png', P.foto]]), { permesso: 'prompt' });
      P.percorso = h;
      P.riavvia(h);
      await videoDB('video', 'readwrite', st => st.clear());
      document.getElementById('galleria-stato').textContent = '';
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async d => { window.__prova.condiviso = d.files[0].name; } });
    });
    await pagina.click('#btn-galleria');
    await pagina.waitForFunction(() => document.querySelectorAll('#galleria-elenco .galleria-video').length === 2);
    await pagina.evaluate(() => window.__prova.aspettaMiniature());
    await pagina.click('#galleria-elenco .galleria-video[data-nome="orizzontale.webm"] .galleria-miniatura');
    await pagina.waitForFunction(() => { const v = document.querySelector('#galleria-visore-palco video'); return v && v.readyState >= 2; });
    await pagina.click('#galleria-visore-pieno');
    await pagina.waitForTimeout(300);
    await pagina.setViewportSize({ width: 780, height: 390 });
    await pagina.waitForTimeout(300);
    const percorsoGeo = await geometria();
    await pagina.mouse.move(100, 100);
    await pagina.click('#galleria-visore-condividi');
    await pagina.waitForTimeout(100);
    await pagina.keyboard.press('Escape'); // esce dallo schermo intero
    await pagina.waitForTimeout(300);
    await pagina.keyboard.press('Escape'); // chiude il visualizzatore
    await pagina.waitForTimeout(100);
    await pagina.keyboard.press('Escape'); // chiude la galleria
    await pagina.waitForTimeout(100);
    const primaRiapertura = await pagina.evaluate(() => ({
      galleria: !document.getElementById('modale-galleria').classList.contains('hidden'),
      visore: videoVisoreAperto(), vivi: window.__prova.viviVeri().length
    }));
    await pagina.click('#btn-galleria');
    await pagina.waitForFunction(() => document.querySelectorAll('#galleria-elenco .galleria-video').length === 2);
    const percorso = await pagina.evaluate(() => ({
      richieste: window.__prova.percorso.__stato.richieste,
      selettore: window.__prova.selettoreChiamato,
      condiviso: window.__prova.condiviso,
      stato: videoStatoCartella
    }));
    await pagina.evaluate(() => { delete navigator.canShare; delete navigator.share; videoChiudiGalleria(); });
    ok('percorso reale: il video resta intero a schermo intero dopo la rotazione',
      percorsoGeo.pieno && percorsoGeo.dentro && percorsoGeo.rapportoOk, percorsoGeo);
    ok('percorso reale: condivisione, tre Esc che chiudono nell’ordine, nessun indirizzo vivo',
      percorso.condiviso === 'orizzontale.webm' && !primaRiapertura.galleria && !primaRiapertura.visore && primaRiapertura.vivi === 0,
      { percorso, primaRiapertura });
    ok('percorso reale: un solo consenso in tutto, nessun selettore, e la riapertura legge la cartella',
      percorso.richieste === 1 && percorso.selettore === 0 && percorso.stato === 'collegata', percorso);

    ok('nessun errore nella pagina', erroriPagina.length === 0, erroriPagina);
    await contesto.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (falliti) { console.log(`\n${falliti} prove fallite`); process.exitCode = 1; }
  else console.log('\ntutte le prove della galleria sono passate');
})().catch(errore => {
  console.error(errore);
  server.close();
  process.exitCode = 1;
});
