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
    // Questa prova non parla di lingua, quindi la lingua la fissa: le sue
    // attese sono in italiano, e da quando la scelta è immediata — prima
    // aspettava la rete — su una macchina di CI arrivava l'inglese.
    await pagina.addInitScript(() => { try { localStorage.astrocal_lingua = 'it'; } catch (e) {} });
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
      const pieno = [...document.querySelectorAll('#galleria-elenco button')]
        .find(b => b.textContent === 'Schermo intero');
      let richiesteSchermoIntero = 0;
      prima.requestFullscreen = async () => { richiesteSchermoIntero += 1; };
      pieno?.click();
      await new Promise(resolve => setTimeout(resolve, 0));
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

      // Dopo un riavvio l'handle resta in IndexedDB ma il browser puo' averne
      // riportato il permesso a "prompt". Aprire la galleria non deve far
      // comparire nessun dialogo: si controlla soltanto (queryPermission) e si
      // offre il tasto «Riconnetti», che e' un clic solo e non ricomincia dal
      // selettore della cartella.
      let richiestePermesso = 0;
      let verifichePermesso = 0;
      let blobScritto = null;
      const fileRicordato = new File(['video-ricordato'], 'ricordato.webm', {
        type: 'video/webm', lastModified: 987654321
      });
      videoCartella = {
        name: 'video-scelti',
        queryPermission: async () => { verifichePermesso += 1; return 'prompt'; },
        requestPermission: async () => { richiestePermesso += 1; return 'granted'; },
        entries: async function* () {
          yield ['ricordato.webm', { kind: 'file', getFile: async () => fileRicordato }];
        },
        getFileHandle: async () => ({
          createWritable: async () => ({
            write: async blob => { blobScritto = blob; },
            close: async () => {}
          })
        })
      };
      videoCartellaAutorizzata = false;
      videoPermessoCartella = null;
      videoFirmaGalleria = null;
      videoSceltaCartella = { voluta: true, nome: 'video-scelti' };
      await videoApriGalleria();
      const richiesteAprendo = richiestePermesso;
      const sceltaIniziale = !document.getElementById('galleria-scelta-iniziale').classList.contains('hidden');
      const riconnetti = document.getElementById('galleria-riconnetti');
      const riconnettiOfferto = !riconnetti.classList.contains('hidden');
      await videoRiconnettiCartella();
      const richiesteRiconnettendo = richiestePermesso;
      const videoRicordatoVisibile = [...document.querySelectorAll('.galleria-video-nome')]
        .some(nome => nome.textContent === 'ricordato.webm');
      // Una seconda apertura, con il permesso gia' ottenuto, non deve chiedere
      // piu' niente: e' il caso di chi entra e esce dalla galleria.
      videoChiudiGalleria();
      await videoApriGalleria();
      const richiesteRiaprendo = richiestePermesso;
      const filmato = new Blob(['salvato-nella-cartella'], { type: 'video/webm' });
      const scritto = await videoScriviInCartella({ nome: 'scelto.webm', blob: filmato }, true);
      videoChiudiGalleria();
      return {
        stessoNodo: prima === dopo,
        marcatore: dopo?.dataset.provaIdentita,
        stessoSrc: dopo?.src === src,
        richiesteSchermoIntero,
        condiviso: window.__videoCondiviso,
        richiesteAprendo,
        richiesteRiconnettendo,
        richiesteRiaprendo,
        sceltaIniziale,
        riconnettiOfferto,
        richiesteSalvando: richiestePermesso,
        verifichePermesso,
        videoRicordatoVisibile,
        scritto,
        dimensioneScritta: blobScritto?.size,
        durataPredefinita: sky.reg.durataSec,
        durataNelleImpostazioni: !!document.querySelector('[data-durata-reg="15"].attiva')
      };
    });

    const ok = esito.stessoNodo && esito.marcatore === 'lettore-originale' && esito.stessoSrc;
    console.log(`${ok ? 'ok' : 'FALLITO'} — il controllo periodico conserva il lettore video`, esito);
    if (!ok) process.exitCode = 1;
    const pienoOk = esito.richiesteSchermoIntero === 1;
    console.log(`${pienoOk ? 'ok' : 'FALLITO'} — il video entra direttamente a schermo intero`, esito.richiesteSchermoIntero);
    if (!pienoOk) process.exitCode = 1;
    const condivisioneOk = esito.condiviso?.nome === 'prova.webm' &&
      esito.condiviso?.tipo === 'video/webm' && esito.condiviso?.dimensione > 0;
    console.log(`${condivisioneOk ? 'ok' : 'FALLITO'} — ogni video della galleria si può condividere`, esito.condiviso);
    if (!condivisioneOk) process.exitCode = 1;
    // Il difetto era qui: aprire la galleria faceva comparire il dialogo del
    // permesso a ogni apertura, e con la cartella dimenticata anche la domanda
    // «esistente o nuova?». Adesso l'apertura non chiede niente (zero
    // richieste), la riconnessione e' un clic solo, e chi rientra non vede piu'
    // nessun dialogo perche' il consenso resta ricordato.
    const zeroDialoghi = esito.richiesteAprendo === 0 && esito.richiesteRiconnettendo === 1 &&
      esito.richiesteRiaprendo === 1 && esito.richiesteSalvando === 1;
    console.log(`${zeroDialoghi ? 'ok' : 'FALLITO'} — aprire la galleria non chiede nessun permesso, e la riconnessione e' un clic solo`, esito);
    if (!zeroDialoghi) process.exitCode = 1;
    const cartellaOk = !esito.sceltaIniziale && esito.riconnettiOfferto &&
      esito.videoRicordatoVisibile && esito.scritto && esito.dimensioneScritta > 0;
    console.log(`${cartellaOk ? 'ok' : 'FALLITO'} — la cartella ricordata torna visibile dopo il riavvio e riceve il video`, esito);
    if (!cartellaOk) process.exitCode = 1;
    const durataOk = esito.durataPredefinita === 15 && esito.durataNelleImpostazioni;
    console.log(`${durataOk ? 'ok' : 'FALLITO'} — 15 secondi è la durata predefinita e compare nelle impostazioni`, esito);
    if (!durataOk) process.exitCode = 1;

    // Quale sia il filmato di stanotte, e perché una scheda resta nera.
    //
    // Sono due assenze, e le assenze non falliscono: una galleria di venti
    // schede tutte uguali è una galleria plausibile — nessuno, guardandola,
    // dice «manca l'etichetta di quello appena registrato» — e un rettangolo
    // nero al posto dell'anteprima somiglia a un video che sta caricando, non
    // a un video che il browser non ha nemmeno provato a decodificare perché
    // il suo object URL non porta un tipo. Il giudice quindi non è l'occhio:
    // si guarda cosa arriva alla scheda e con che tipo.
    const nuovi = await pagina.evaluate(async () => {
      videoCartella = null;
      videoFirmaGalleria = null;
      videoAnteprime.clear();
      // Il conto dei visti riparte da un istante fa: quello di prima è più
      // vecchio, quello registrato adesso è nuovo.
      videoVisti = { nomi: new Set(), dalla: Date.now() - 1000 };

      // Un file letto dalla cartella può non portare nessun tipo MIME.
      const tipoDedotto = {
        webm: videoBlobLeggibile({ nome: 'a.webm', blob: new Blob(['x'], { type: '' }) }).type,
        mp4: videoBlobLeggibile({ nome: 'a.MP4', blob: new Blob(['x'], { type: '' }) }).type,
        senzaEstensione: videoBlobLeggibile({ nome: 'a', blob: new Blob(['x'], { type: 'application/octet-stream' }) }).type,
        // Un tipo che già va bene non si tocca: rifare il Blob per niente
        // vuol dire una copia in memoria per ogni scheda.
        giaBuono: (() => {
          const b = new Blob(['x'], { type: 'video/webm' });
          return videoBlobLeggibile({ nome: 'a.webm', blob: b }) === b;
        })()
      };

      await videoDB('video', 'readwrite', store => store.put({
        id: 'stanotte.webm', nome: 'stanotte.webm', tipo: 'video/webm',
        blob: new Blob(['registrato-adesso'], { type: 'video/webm' }),
        creato: Date.now(), origine: 'cielo', durata: 4, cartellaNome: ''
      }));
      await videoDB('video', 'readwrite', store => store.put({
        id: 'senzatipo.mp4', nome: 'senzatipo.mp4', tipo: '',
        blob: new Blob(['come-arriva-dalla-cartella'], { type: '' }),
        creato: Date.now() - 5000, origine: 'cielo', durata: 0, cartellaNome: ''
      }));

      // L'anteprima si fa con un decodificatore vero, e in una prova non c'è
      // nessun filmato da decodificare: quello che si controlla qui è che il
      // poster arrivi alla scheda e che se ne faccia **una per volta** —
      // venti decodificatori accesi insieme sono la galleria che si inchioda
      // proprio mentre la si sta aprendo.
      const veraAnteprima = videoFaiAnteprima;
      let insieme = 0, massimoInsieme = 0;
      videoFaiAnteprima = async elemento => {
        insieme += 1;
        massimoInsieme = Math.max(massimoInsieme, insieme);
        await new Promise(r => setTimeout(r, 15));
        insieme -= 1;
        return `data:image/jpeg;base64,${elemento.nome.length}`;
      };
      // Con che tipo arriva al lettore il contenuto di ogni scheda.
      const veroCrea = URL.createObjectURL.bind(URL);
      const tipiAlLettore = [];
      URL.createObjectURL = b => { tipiAlLettore.push(b.type); return veroCrea(b); };

      await videoApriGalleria();
      await new Promise(r => setTimeout(r, 300));
      URL.createObjectURL = veroCrea;

      const schedeDi = () => [...document.querySelectorAll('#galleria-elenco .galleria-video')].map(s => ({
        nome: s.querySelector('.galleria-video-nome').textContent,
        nuovo: !!s.querySelector('.galleria-nuovo'),
        etichetta: (s.querySelector('.galleria-nuovo') || {}).textContent || '',
        poster: s.querySelector('video').poster
      }));
      const schede = schedeDi();

      // Guardato vuol dire premuto play.
      const scheda = [...document.querySelectorAll('#galleria-elenco .galleria-video')]
        .find(s => s.querySelector('.galleria-video-nome').textContent === 'stanotte.webm');
      scheda.querySelector('video').dispatchEvent(new Event('play'));
      const dopoIlPlay = !scheda.querySelector('.galleria-nuovo');
      const ricordato = videoLeggiVisti().nomi.has('stanotte.webm');
      // E un ridisegno non la fa tornare: la memoria è sul disco, non nel DOM.
      videoFirmaGalleria = null;
      await videoRenderGalleria();
      const dopoIlRidisegno = schedeDi().filter(s => s.nuovo).map(s => s.nome);

      videoChiudiGalleria();
      videoFaiAnteprima = veraAnteprima;
      return { tipoDedotto, schede, dopoIlPlay, ricordato, dopoIlRidisegno, massimoInsieme, tipiAlLettore };
    });

    const t = nuovi.tipoDedotto;
    const tipiOk = t.webm === 'video/webm' && t.mp4 === 'video/mp4' &&
      t.senzaEstensione === 'video/mp4' && t.giaBuono &&
      nuovi.tipiAlLettore.indexOf('video/mp4') !== -1;
    console.log(`${tipiOk ? 'ok' : 'FALLITO'} — un file senza tipo MIME arriva al lettore come filmato`, nuovi.tipoDedotto, nuovi.tipiAlLettore);
    if (!tipiOk) process.exitCode = 1;

    const posterOk = nuovi.schede.length >= 3 && nuovi.schede.every(s => /^data:image\/jpeg/.test(s.poster));
    console.log(`${posterOk ? 'ok' : 'FALLITO'} — ogni scheda riceve la sua anteprima`, nuovi.schede.map(s => `${s.nome}: ${s.poster.slice(0, 26)}`));
    if (!posterOk) process.exitCode = 1;

    const unaPerVolta = nuovi.massimoInsieme === 1;
    console.log(`${unaPerVolta ? 'ok' : 'FALLITO'} — le anteprime si fanno una per volta`, nuovi.massimoInsieme);
    if (!unaPerVolta) process.exitCode = 1;

    const perNome = Object.fromEntries(nuovi.schede.map(s => [s.nome, s]));
    const etichettaOk = perNome['stanotte.webm'] && perNome['stanotte.webm'].nuovo &&
      perNome['stanotte.webm'].etichetta === 'Nuovo' &&
      perNome['prova.webm'] && !perNome['prova.webm'].nuovo;
    console.log(`${etichettaOk ? 'ok' : 'FALLITO'} — il video di stanotte è l'unico marcato «Nuovo»`, nuovi.schede);
    if (!etichettaOk) process.exitCode = 1;

    const vistoOk = nuovi.dopoIlPlay && nuovi.ricordato &&
      nuovi.dopoIlRidisegno.indexOf('stanotte.webm') === -1;
    console.log(`${vistoOk ? 'ok' : 'FALLITO'} — guardarlo toglie l'etichetta, e un ridisegno non la riporta`, nuovi);
    if (!vistoOk) process.exitCode = 1;

    // E con un filmato vero. La prova qui sopra sostituisce il decodificatore
    // per guardare la macchina — che il poster arrivi alla scheda, una
    // decodifica per volta — e quella macchina resterebbe verde anche se il
    // fotogramma venisse nero: una tela mai dipinta è un'immagine perfetta
    // sotto ogni aspetto tranne quello che conta. Il filmato si registra
    // allora qui, con la stessa tela e lo stesso MediaRecorder da cui nascono
    // i video dell'app, e del poster si guardano i pixel.
    const anteprimaVera = await pagina.evaluate(async () => {
      const tela = document.createElement('canvas');
      tela.width = 160; tela.height = 120;
      const c = tela.getContext('2d');
      if (!window.MediaRecorder || !tela.captureStream) return { assente: true };
      const pezzi = [];
      const reg = new MediaRecorder(tela.captureStream(10), { mimeType: 'video/webm' });
      reg.ondataavailable = e => { if (e.data.size) pezzi.push(e.data); };
      const fine = new Promise(ok => { reg.onstop = ok; });
      reg.start();
      for (let i = 0; i < 14; i += 1) {
        c.fillStyle = i % 2 ? '#2266cc' : '#cc6622';
        c.fillRect(0, 0, 160, 120);
        await new Promise(ok => setTimeout(ok, 40));
      }
      reg.stop();
      await fine;
      const filmato = new Blob(pezzi, { type: 'video/webm' });
      // Senza tipo, come arriva un file letto dalla cartella su un sistema
      // che quell'estensione non la conosce.
      const senzaTipo = filmato.slice(0, filmato.size, '');
      videoAnteprime.clear();
      const poster = await videoFaiAnteprima({ nome: 'vero.webm', blob: senzaTipo, creato: Date.now() });
      const pixel = await new Promise(ok => {
        if (!poster) { ok(null); return; }
        const img = new Image();
        img.onload = () => {
          const t = document.createElement('canvas');
          t.width = img.naturalWidth; t.height = img.naturalHeight;
          const c2 = t.getContext('2d');
          c2.drawImage(img, 0, 0);
          const d = c2.getImageData(0, 0, t.width, t.height).data;
          let somma = 0;
          for (let i = 0; i < d.length; i += 4) somma += (d[i] + d[i + 1] + d[i + 2]) / 3;
          ok({ l: t.width, h: t.height, medio: somma / (d.length / 4) });
        };
        img.onerror = () => ok(null);
        img.src = poster;
      });
      return { inizio: (poster || '').slice(0, 15), lungo: (poster || '').length, pixel };
    });

    if (anteprimaVera.assente) {
      console.log('ok — (senza MediaRecorder qui: l’anteprima di un filmato vero non si può provare)');
    } else {
      const veraOk = anteprimaVera.inizio === 'data:image/jpeg' && anteprimaVera.lungo > 800 &&
        anteprimaVera.pixel && anteprimaVera.pixel.l === 160 && anteprimaVera.pixel.h === 120 &&
        anteprimaVera.pixel.medio > 10;
      console.log(`${veraOk ? 'ok' : 'FALLITO'} — l’anteprima di un filmato vero è un fotogramma dipinto`, anteprimaVera);
      if (!veraOk) process.exitCode = 1;
    }

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
