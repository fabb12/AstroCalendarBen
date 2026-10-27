#!/usr/bin/env node
/* Il paesaggio di Cortina d'Ampezzo per la presentazione (v528), già fatto:
 * `dati-paesaggi-demo.js`.
 *
 * Perché esiste. La presentazione parla delle Dolomiti «ognuna col suo
 * nome» davanti a un orizzonte che quasi sempre era liscio: il profilo di un
 * posto nuovo sono ventiquattro richieste di quote, più Overpass per vette e
 * paesi, e a 40 secondi dall'avvio (quando arriva la scena) non c'erano
 * ancora — offline non arrivano mai. Così il profilo, le vette e i paesi di
 * Cortina viaggiano con l'app: `demo.js` (`preparaPaesaggi`) li mette
 * nell'archivio del terreno quando la presentazione parte, se lì non c'è già
 * un profilo scaricato davvero.
 *
 * Le quote vengono dalle stesse tessere «terrarium» del rilievo (AWS Terrain
 * Tiles), ma a zoom 12 (circa 25 m al pixel a questa latitudine) invece del
 * 9 della riserva di `terrenoQuoteRaster`; il profilo lo monta il codice
 * dell'app (`terrenoCostruisci`), con le sue distanze e direzioni. Le vette:
 * nome e quota dalle carte, posizione cercata sul rilievo (la cima più vicina
 * a quella scritta qui che arriva alla sua quota), così il nome cade sulla
 * punta vera.
 *
 *   npm install --no-save playwright-core astronomy-engine satellite.js@5.0.0
 *   node scripts/costruisci-paesaggi-demo.js
 *
 * Vuole la rete verso s3.amazonaws.com. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
let pw;
try { pw = require('playwright-core'); } catch (_) { pw = require('playwright'); }

const radice = path.resolve(__dirname, '..');

// Cortina d'Ampezzo, dov'è messa la scena (le coordinate di `set_location`)
const LUOGHI = [{
  chiave: 'cortina', nome: "Cortina d'Ampezzo", lat: 46.5405, lon: 12.1357,
  // nome, lat, lon (approssimate: il punto più alto vicino lo trova il rilievo), quota dalle carte
  cime: [
    ['Tofana di Mezzo', 46.5510, 12.0650, 3244], ['Tofana di Dentro', 46.5567, 12.0634, 3238],
    ['Tofana di Rozes', 46.5372, 12.0502, 3225], ['Monte Cristallo', 46.5757, 12.1994, 3221],
    ['Sorapiss', 46.5066, 12.2102, 3205], ['Antelao', 46.4521, 12.2606, 3264],
    ['Pomagagnon', 46.5743, 12.1400, 2450], ['Croda da Lago', 46.4803, 12.0983, 2701],
    ['Nuvolau', 46.4959, 12.0450, 2574], ['Averau', 46.5020, 12.0375, 2649],
    ['Lagazuoi', 46.5295, 12.0053, 2835], ['Faloria', 46.5274, 12.1822, 2343],
    ['Croda Rossa d\'Ampezzo', 46.6344, 12.1434, 3146], ['Monte Pelmo', 46.4185, 12.1341, 3168]
  ],
  // nome, lat, lon, abitanti, specie (come le salva `cittaSalva`)
  citta: [
    ["Cortina d'Ampezzo", 46.5405, 12.1357, 5800, 'town'], ['Pocol', 46.5297, 12.1053, 120, 'village'],
    ['Fiames', 46.5689, 12.1342, 80, 'hamlet'], ['Zuel', 46.5194, 12.1278, 150, 'hamlet'],
    ['San Vito di Cadore', 46.4569, 12.2061, 1800, 'village']
  ]
}];

const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const file = path.resolve(radice, '.' + decodeURIComponent(url === '/' ? '/index.html' : url));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', tipi[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
function pacchetto(nome) {
  const qui = path.join(radice, 'node_modules', nome);
  if (fs.existsSync(path.join(qui, 'package.json'))) return qui;
  return path.dirname(require.resolve(nome + '/package.json'));
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origine = 'http://127.0.0.1:' + server.address().port;
  const exe = ['/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
  const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
  try {
    const pagina = await browser.newPage({ serviceWorkers: 'block' });
    await pagina.route('**/*', r => {
      const url = r.request().url();
      if (url.startsWith(origine) || url.startsWith('https://s3.amazonaws.com/elevation-tiles-prod/')) return r.continue();
      if (url.includes('astronomy.browser.min.js'))
        return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(pacchetto('astronomy-engine'), 'astronomy.browser.min.js')) });
      return r.abort();
    });
    await pagina.addInitScript(() => localStorage.setItem('astrocal_lingua', 'it'));
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => typeof terrenoCostruisci === 'function' && typeof terrenoMonta === 'function', null, { timeout: 60000 });
    const fatti = [];
    for (const luogo of LUOGHI) {
      const r = await pagina.evaluate(async luogo => {
        const Z = 12, N = 256 * 2 ** Z, tessere = new Map();
        const tessera = (x, y) => {
          const k = x + '/' + y;
          if (!tessere.has(k)) tessere.set(k, new Promise((ok, no) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onerror = () => no(new Error('tessera ' + k));
            img.onload = () => {
              const t = document.createElement('canvas');
              t.width = t.height = 256;
              const c = t.getContext('2d', { willReadFrequently: true });
              c.drawImage(img, 0, 0);
              const d = c.getImageData(0, 0, 256, 256).data, q = new Float32Array(65536);
              for (let i = 0; i < q.length; i++) q[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
              ok(q);
            };
            img.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;
          }));
          return tessere.get(k);
        };
        const pixel = async (x, y) => (await tessera(Math.floor(x / 256), Math.floor(y / 256)))[(y % 256) * 256 + (x % 256)];
        const quota = async (lat, lon) => {
          const la = lat * Math.PI / 180;
          const x = (lon + 180) / 360 * N - 0.5, y = (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * N - 0.5;
          const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
          const [a, b, c, d] = await Promise.all([pixel(x0, y0), pixel(x0 + 1, y0), pixel(x0, y0 + 1), pixel(x0 + 1, y0 + 1)]);
          return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
        };
        // l'app chiede le quote a questa funzione: qui rispondono le tessere a zoom 12
        window.terrenoQuoteInsistendo = punti => Promise.all(punti.map(p => quota(p.lat, p.lon)));
        const { dati } = await terrenoCostruisci(luogo.lat, luogo.lon);
        // Le vette: le coordinate scritte qui vengono dai massimi del rilievo a
        // zoom 13 (v528), e si riallineano a quello a zoom 12. Fra i punti
        // del rilievo entro 600 m che arrivano quasi alla quota delle carte
        // (il rilievo a 25 m smussa le punte) si prende il più vicino, e da
        // lì si sale fino alla cima; se nessuno ci arriva, il più alto.
        const cime = [];
        for (const [nome, la0, lo0, q] of luogo.cime) {
          const passo = 0.0004, griglia = [];
          for (let i = -15; i <= 15; i++) for (let j = -22; j <= 22; j++) {
            const la = la0 + i * passo, lo = lo0 + j * passo, km = terrenoDistanzaKm(la0, lo0, la, lo);
            if (km <= 0.6) griglia.push({ la, lo, km });
          }
          const quote = await Promise.all(griglia.map(g => quota(g.la, g.lo)));
          griglia.forEach((g, i) => { g.v = quote[i]; });
          const alti = griglia.filter(g => g.v >= q - 200).sort((a, b) => a.km - b.km);
          let p = alti[0] || griglia.reduce((m, g) => (g.v > m.v ? g : m));
          // in salita fino alla cima, a passi di 15 m
          for (let giri = 0; giri < 200; giri++) {
            let meglio = p;
            for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
              const la = p.la + di * 0.00014, lo = p.lo + dj * 0.0002, v = await quota(la, lo);
              if (v > meglio.v) meglio = { la, lo, v };
            }
            if (meglio === p) break;
            p = meglio;
          }
          cime.push({ n: nome, a: +p.la.toFixed(4), o: +p.lo.toFixed(4), q, rilievo: Math.round(p.v),
            spostata: Math.round(terrenoDistanzaKm(la0, lo0, p.la, p.lo) * 1000) });
        }
        return { dati, cime };
      }, luogo);
      for (const c of r.cime) {
        console.log(`  ${c.n.padEnd(24)} carte ${c.q} m · rilievo ${c.rilievo} m · ${c.a}, ${c.o} (a ${c.spostata} m da quella scritta)`);
        if (Math.abs(c.rilievo - c.q) > 150) console.warn(`  ATTENZIONE: ${c.n} sul rilievo è ${c.rilievo} m, sulle carte ${c.q} m`);
        delete c.rilievo; delete c.spostata;
      }
      const d = r.dati;
      console.log(`${luogo.nome}: quota ${Math.round(d.quota)} m, ${d.misurate} direzioni misurate, orizzonte più alto ${Math.max(...d.creste).toFixed(1)}°`);
      fatti.push({
        chiave: luogo.chiave, nome: luogo.nome, lat: luogo.lat, lon: luogo.lon,
        terreno: { quota: Math.round(d.quota), quotaStimata: !!d.quotaStimata, creste: d.creste.map(v => +v.toFixed(2)),
          tipi: Array.from(d.tipi), quote: d.quote.map(v => (v === null ? null : Math.round(v))), avute: d.avute.slice().sort((a, b) => a - b), misurate: d.misurate },
        cime: r.cime,
        citta: luogo.citta.map(([n, a, o, p, s]) => ({ n, a, o, p, s }))
      });
    }
    const testa = `/* Generato da scripts/costruisci-paesaggi-demo.js: non modificare a mano.
 * I paesaggi già fatti della presentazione (v528): profilo dell'orizzonte,
 * vette e paesi, nella forma dell'archivio del terreno (terreno.js §6).
 * Quote: AWS Terrain Tiles (terrarium, zoom 12; fonti in
 * https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
 * Vette e paesi: © OpenStreetMap contributors (ODbL). */
`;
    fs.writeFileSync(path.join(radice, 'dati-paesaggi-demo.js'), testa + 'window.DATI_PAESAGGI_DEMO = ' + JSON.stringify(fatti) + ';\n');
    console.log('scritto dati-paesaggi-demo.js');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
