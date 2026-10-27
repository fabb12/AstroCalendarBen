// =====================================================================
// AstroCalendario per computer — il server locale
// =====================================================================
//
// La finestra di Electron non apre `index.html` da `file://` né da uno
// schema inventato (`app://`): lo chiede a un piccolo server HTTP che gira
// dentro al programma, solo sull'interfaccia di loopback.
//
// Perché un server e non `file://`. Da `file://` il service worker non si
// registra, `fetch` dei file locali è vietata (i dizionari sono `.js` apposta,
// ma l'audio delle voci e le storie dello Studio si leggono con `fetch`) e
// l'origine è «null»: ogni servizio che guarda l'origine risponde di no.
//
// Perché non `app://`. Funzionerebbe tutto dentro la finestra, ma il proxy
// ADS-B (`worker-adsb.js`, `originePermessa`) accetta solo le origini del
// sito e quelle di `localhost`: con `app://astrocal` gli aerei avrebbero
// risposto 403. `http://localhost` invece è già nella lista, è un contesto
// sicuro per il browser (fotocamera, sensori, service worker) e Google lo
// accetta come origine di un client OAuth (YouTube).
//
// La porta è fissa (`PORTA_PREFERITA`) per una ragione precisa: l'origine
// comprende la porta, e `localStorage` e IndexedDB — il diario, gli eventi
// personali, le storie dello Studio — sono legati all'origine. Una porta
// diversa a ogni avvio vorrebbe dire ripartire ogni volta da un'app vuota.
// Solo se è occupata da qualcun altro si prova la successiva, e il programma
// lo dice (`main.js`).
//
// Questo file non usa Electron: lo prova `scripts/prova-desktop.js` con node.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA_PREFERITA = 47231;
const TENTATIVI_PORTA = 10;

const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream'
};

function tipoDi(file) {
  return TIPI[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

// Da un URL a un file dentro `radice`, oppure null. Il controllo sul
// prefisso è quello che impedisce a `/../../` di uscire dalla cartella
// dell'app: il server ascolta solo su loopback, ma una pagina qualunque
// aperta nel browser dello stesso computer può comunque chiamarlo.
function fileDaPercorso(radice, percorsoUrl) {
  let p;
  try { p = decodeURIComponent(String(percorsoUrl || '/').split('?')[0].split('#')[0]); }
  catch (e) { return null; }
  if (p.indexOf('\0') !== -1) return null;
  if (p.endsWith('/')) p += 'index.html';
  const base = path.resolve(radice);
  const file = path.resolve(base, '.' + path.posix.normalize('/' + p));
  if (file !== base && !file.startsWith(base + path.sep)) return null;
  return file;
}

// `Range` serve all'audio e ai filmati: senza la risposta 206 Chromium non
// sa saltare dentro un brano e il cursore delle voci della demo resta fermo.
function intervallo(testata, dimensione) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(testata || '').trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let inizio, fine;
  if (m[1] === '') {
    const coda = Math.min(parseInt(m[2], 10), dimensione);
    inizio = dimensione - coda;
    fine = dimensione - 1;
  } else {
    inizio = parseInt(m[1], 10);
    fine = m[2] === '' ? dimensione - 1 : Math.min(parseInt(m[2], 10), dimensione - 1);
  }
  if (!(inizio >= 0) || inizio > fine || inizio >= dimensione) return false;
  return { inizio, fine };
}

function gestore(radice) {
  return (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }
    const file = fileDaPercorso(radice, req.url);
    if (!file) { res.writeHead(400); res.end(); return; }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404');
        return;
      }
      const testa = {
        'Content-Type': tipoDi(file),
        'Accept-Ranges': 'bytes',
        // I file sono sul disco accanto al programma: niente da guadagnare
        // a farli tenere alla cache HTTP, e un aggiornamento del programma
        // deve vedersi subito. Alla cache per l'uso senza rete pensa già il
        // service worker, come nel browser.
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      };
      const r = intervallo(req.headers.range, st.size);
      if (r === false) {
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
        res.end();
        return;
      }
      let inizio = 0, fine = st.size - 1, stato = 200;
      if (r) {
        inizio = r.inizio; fine = r.fine; stato = 206;
        testa['Content-Range'] = `bytes ${inizio}-${fine}/${st.size}`;
      }
      testa['Content-Length'] = st.size ? fine - inizio + 1 : 0;
      res.writeHead(stato, testa);
      if (req.method === 'HEAD' || !st.size) { res.end(); return; }
      const flusso = fs.createReadStream(file, { start: inizio, end: fine });
      flusso.on('error', () => res.destroy());
      flusso.pipe(res);
    });
  };
}

// Ascolta su 127.0.0.1 e ::1 alla porta preferita, o alla prima libera
// dopo. Tutte e due perché la finestra apre `localhost`, e Chromium prova
// prima l'indirizzo IPv6: se su ::1 a quella porta rispondesse un altro
// programma, la finestra mostrerebbe lui. Un computer senza IPv6 risponde
// EADDRNOTAVAIL (o EAFNOSUPPORT) e si va avanti col solo IPv4.
// Risolve con { server, porta, origine, cambiata }; `server.close()` chiude
// tutti e due.
function ascolta(gestisci, porta, indirizzo) {
  return new Promise((risolvi, rifiuta) => {
    const s = http.createServer(gestisci);
    s.once('error', rifiuta);
    s.listen(porta, indirizzo, () => { s.removeAllListeners('error'); risolvi(s); });
  });
}

async function avvia(radice, opzioni) {
  const o = Object.assign({ porta: PORTA_PREFERITA, tentativi: TENTATIVI_PORTA }, opzioni);
  const gestisci = gestore(radice);
  let ultimo = null;
  for (let porta = o.porta; porta < o.porta + o.tentativi; porta++) {
    let v4;
    try { v4 = await ascolta(gestisci, porta, '127.0.0.1'); }
    catch (err) { ultimo = err; if (err.code === 'EADDRINUSE' || err.code === 'EACCES') continue; throw err; }
    const vera = v4.address().port;
    let v6 = null;
    try { v6 = await ascolta(gestisci, vera, '::1'); }
    catch (err) {
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        ultimo = err;
        await new Promise(r => v4.close(r));
        if (o.porta === 0) throw err;
        continue;
      }
      // Niente IPv6 su questo computer: basta il 127.0.0.1.
    }
    const server = {
      close(cb) {
        let restano = v6 ? 2 : 1;
        const fatto = () => { if (--restano === 0 && cb) cb(); };
        v4.close(fatto);
        if (v6) v6.close(fatto);
      }
    };
    return { server, porta: vera, origine: `http://localhost:${vera}`, cambiata: vera !== o.porta };
  }
  throw ultimo || new Error('nessuna porta libera');
}

module.exports = { avvia, fileDaPercorso, intervallo, tipoDi, PORTA_PREFERITA };
