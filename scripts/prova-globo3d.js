/* Il globo della vista 3D: girando attorno a un corpo se ne vede un'altra
 * parte della superficie, con la luce del Sole che resta dov'è.
 *
 * Era la segnalazione «nel Sistema Solare 3D, girando la camera attorno a un
 * pianeta o a una luna la superficie resta ferma e si muove solo la luce». A
 * occhio il difetto si vede solo muovendosi, e un fotogramma fermo è sempre
 * convincente: per questo qui non si giudica una figura, si misurano le
 * cose che devono essere vere.
 *
 *  - Il motore (`skyGloboCampiona`): guardando un corpo esattamente dal
 *    centro di una delle sei facce si deve ritrovare quella faccia; guardando
 *    fra due facce, quello che dipingerebbe il pennello da lì.
 *  - Il verso: spostando la camera verso est le macchie scivolano a sinistra.
 *  - I poli: da sopra il polo nord di Marte si vede la calotta al centro, e
 *    le bande di Giove viste dal polo sono cerchi.
 *  - La Luna: dalla Terra si vede la faccia nota (i mari), da dietro la
 *    faccia nascosta (niente mari) — col meridiano zero vero dell'IAU.
 *  - La scena: girando la camera attorno a Giove e alla Luna la tela cambia.
 *
 * Serve, una volta sola:
 *     npm install playwright-core astronomy-engine satellite.js@5.0.0
 * Poi:
 *     node scripts/prova-globo3d.js
 */
'use strict';

const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROMIUM = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium/chrome-linux/chrome') ? '/opt/pw-browsers/chromium/chrome-linux/chrome' : '/opt/pw-browsers/chromium');
const RADICE = path.join(__dirname, '..');
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

function libreria(dove) {
  const f = path.join(RADICE, 'node_modules', dove);
  if (!fs.existsSync(f)) throw new Error('manca ' + dove + ': npm install playwright-core astronomy-engine satellite.js@5.0.0');
  return fs.readFileSync(f, 'utf8');
}

const server = http.createServer((req, res) => {
  const nome = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(RADICE, nome === '/' ? 'index.html' : nome);
  if (!f.startsWith(RADICE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPI[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
});

let ko = 0;
const ok = (n, c, x) => {
  console.log((c ? '  ok        ' : '  FALLITO   ') + n + (x ? '   — ' + x : ''));
  if (!c) ko++;
};

(async () => {
  await new Promise(r => server.listen(8137, r));
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const contesto = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  const pagina = await contesto.newPage();
  pagina.on('pageerror', e => { console.log('  ECCEZIONE: ' + e.message); ko++; });

  await pagina.route('**cdn.tailwindcss.com**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**cdn.jsdelivr.net**', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await pagina.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pagina.route('**/astronomy.browser.min.js', r =>
    r.fulfill({ body: libreria('astronomy-engine/astronomy.browser.min.js'), contentType: 'text/javascript' }));
  await pagina.route('**/satellite.min.js', r =>
    r.fulfill({ body: libreria('satellite.js/dist/satellite.min.js'), contentType: 'text/javascript' }));
  ['**open-meteo.com/**', '**noaa.gov/**', '**celestrak.org/**', '**overpass**',
   '**amazonaws**', '**ipapi**', '**ipwho**', '**geojs**', '**upload.wikimedia.org/**',
   '**bigdatacloud**', '**nominatim**', '**adsb**'].forEach(u => pagina.route(u, r => r.abort()));

  await pagina.goto('http://localhost:8137/index.html', { waitUntil: 'domcontentloaded' });
  await pagina.evaluate(() => {
    localStorage.setItem('astrocalendario_posizione',
      JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
    localStorage.setItem('astrocal_lingua', 'it');
  });
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(2000);

  // Gli attrezzi, dentro la pagina: un globo visto da (lon, lat) con il
  // nord in alto, e il disco che dipingerebbe il pennello da lì.
  await pagina.evaluate(() => {
    window.__assiDa = (lon, lat) => {
      const l = lon * Math.PI / 180, b = lat * Math.PI / 180;
      return {
        R: [-Math.sin(l), Math.cos(l), 0],
        U: [-Math.sin(b) * Math.cos(l), -Math.sin(b) * Math.sin(l), Math.cos(b)],
        V: [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)]
      };
    };
    window.__globo = (chiave, pennello, lato, lon, lat) => {
      const memo = skyGloboFacce(chiave, lato, pennello);
      const a = __assiDa(lon, lat);
      const out = new Uint8ClampedArray(lato * lato * 4);
      skyGloboCampiona(out, lato, memo, a.R, a.U, a.V);
      return out;
    };
    window.__pennello = (pennello, lato, lon, lat) => {
      const t = document.createElement('canvas');
      t.width = t.height = lato;
      const c = t.getContext('2d', { willReadFrequently: true });
      c.translate(lato / 2, lato / 2); c.scale(lato / 2, lato / 2); c.lineWidth = 0.008;
      const prima = [skyLongitudineCentrale, skyLatitudineCentrale, skyGloboVero];
      skyLongitudineCentrale = lon; skyLatitudineCentrale = lat; skyGloboVero = true;
      try { pennello(c, lato); } finally { [skyLongitudineCentrale, skyLatitudineCentrale, skyGloboVero] = prima; }
      return c.getImageData(0, 0, lato, lato).data;
    };
    // Scarto medio (0–255) fra due immagini, dentro un cerchio di raggio `q`
    window.__scarto = (a, b, lato, q) => {
      let s = 0, n = 0;
      const h = lato / 2;
      for (let j = 0; j < lato; j++) for (let i = 0; i < lato; i++) {
        const x = (i + 0.5) / h - 1, y = (j + 0.5) / h - 1;
        if (x * x + y * y > q * q) continue;
        const o = (j * lato + i) * 4;
        s += (Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2])) / 3;
        n++;
      }
      return s / Math.max(1, n);
    };
    // La luminosità media in un cerchietto (x, y in raggi, centro del disco 0,0)
    window.__luce = (d, lato, x0, y0, q) => {
      let s = 0, n = 0;
      const h = lato / 2;
      for (let j = 0; j < lato; j++) for (let i = 0; i < lato; i++) {
        const x = (i + 0.5) / h - 1, y = (j + 0.5) / h - 1;
        if ((x - x0) ** 2 + (y - y0) ** 2 > q * q) continue;
        const o = (j * lato + i) * 4;
        s += (d[o] + d[o + 1] + d[o + 2]) / 3; n++;
      }
      return s / Math.max(1, n);
    };
  });

  console.log('\n— il motore: sei facce e il conto pixel per pixel —');
  const motore = await pagina.evaluate(() => {
    const lato = 256;
    const p = SKY_FACCE.Moon;
    const daFaccia = __globo('prova:Moon', p, lato, 0, 0);
    const pennello0 = __pennello(p, lato, 0, 0);
    const daPolo = __globo('prova:Moon', p, lato, 0, 90);
    const pennelloPolo = __pennello(p, lato, 0, 90);
    const fra = __globo('prova:Moon', p, lato, 45, 20);
    const pennelloFra = __pennello(p, lato, 45, 20);
    const lontano = __pennello(p, lato, 160, -10);
    return {
      centro: __scarto(daFaccia, pennello0, lato, 0.6),
      polo: __scarto(daPolo, pennelloPolo, lato, 0.6),
      fra: __scarto(fra, pennelloFra, lato, 0.85),
      altro: __scarto(fra, lontano, lato, 0.85)
    };
  });
  ok('guardando dal centro di una faccia si ritrova quella faccia', motore.centro < 3, motore.centro.toFixed(2) + ' livelli');
  ok('anche dal polo', motore.polo < 3, motore.polo.toFixed(2) + ' livelli');
  ok('guardando fra due facce si vede quello che il pennello dipinge da lì (le cuciture combaciano)',
    motore.fra < 6 && motore.fra * 3 < motore.altro,
    `${motore.fra.toFixed(2)} livelli, contro ${motore.altro.toFixed(2)} di un'altra faccia`);

  console.log('\n— il verso: andando a est la superficie scivola a sinistra —');
  const verso = await pagina.evaluate(() => {
    const lato = 256;
    const a = __globo('prova:Moon', SKY_FACCE.Moon, lato, 0, 0);
    const b = __globo('prova:Moon', SKY_FACCE.Moon, lato, 8, 0);
    // Di quanti pixel si sposta la riga di mezzo? Si prova lo spostamento che
    // fa combaciare meglio le due righe centrali.
    const riga = (d, j) => { const r = []; for (let i = 0; i < lato; i++) { const o = (j * lato + i) * 4; r.push(d[o] + d[o + 1] + d[o + 2]); } return r; };
    let migliore = 0, minimo = Infinity;
    for (let sp = -30; sp <= 30; sp++) {
      let s = 0, n = 0;
      for (let j = 100; j < 156; j += 4) {
        const ra = riga(a, j), rb = riga(b, j);
        for (let i = 80; i < 176; i++) { s += Math.abs(ra[i] - rb[i - sp]); n++; }
      }
      if (s / n < minimo) { minimo = s / n; migliore = sp; }
    }
    return migliore;
  });
  // 8° al centro di un disco da 128 px di raggio sono 128·sin 8° ≈ 18 px
  // lo spostamento `sp` che fa combaciare: positivo = quello che stava in `i` ora sta in `i − sp`, cioè più a sinistra
  ok("8° di camera verso est spostano la superficie di ~18 px verso sinistra", verso >= 14 && verso <= 22, verso + " px");

  console.log('\n— i poli si vedono —');
  const poli = await pagina.evaluate(() => {
    const lato = 256;
    const marteSopra = __globo('prova:Mars', SKY_FACCE.Mars, lato, 30, 90);
    const marteFianco = __globo('prova:Mars', SKY_FACCE.Mars, lato, 30, 0);
    const gioveSopra = __globo('prova:Jupiter', SKY_FACCE.Jupiter, lato, 0, 90);
    // Le bande da sopra il polo sono cerchi: sullo stesso raggio (mezzo
    // disco) le quattro direzioni hanno la stessa luce, a meno dei festoni
    const giro = [[0.5, 0], [0, 0.5], [-0.5, 0], [0, -0.5]].map(([x, y]) => __luce(gioveSopra, lato, x, y, 0.04));
    const raggi = [0.12, 0.3, 0.5, 0.7].map(q => __luce(gioveSopra, lato, q, 0, 0.04));
    return {
      calotta: __luce(marteSopra, lato, 0, 0, 0.1),
      equatore: __luce(marteFianco, lato, 0, 0, 0.1),
      giro, raggi
    };
  });
  ok('sopra il polo nord di Marte, al centro c\'è la calotta bianca', poli.calotta > 200 && poli.calotta > poli.equatore + 50,
    `${poli.calotta.toFixed(0)} contro ${poli.equatore.toFixed(0)} all'equatore`);
  const giroMin = Math.min(...poli.giro), giroMax = Math.max(...poli.giro);
  const raggiMin = Math.min(...poli.raggi), raggiMax = Math.max(...poli.raggi);
  ok('le bande di Giove viste dal polo sono cerchi (stessa luce attorno, diversa andando in fuori)',
    giroMax - giroMin < 25 && raggiMax - raggiMin > 25,
    `attorno ${giroMin.toFixed(0)}–${giroMax.toFixed(0)}, in fuori ${raggiMin.toFixed(0)}–${raggiMax.toFixed(0)}`);

  console.log('\n— la Luna: dalla Terra la faccia nota, da dietro quella nascosta —');
  await pagina.evaluate(() => { mostraVista('cielo'); });
  await pagina.waitForTimeout(800);
  await pagina.evaluate(() => { apriSistemaSolare(); });
  // il volo d'ingresso dura più di cinque secondi, e finché copre la scena
  // il ciclo non la ridisegna
  await pagina.waitForTimeout(7000);
  const luna = await pagina.evaluate(() => {
    const quando = new Date(sol.istante || Date.now());
    const telaio = solTelaioDaAsse(solAsseLuna(quando));
    const g = Astronomy.Ecliptic(Astronomy.GeoMoon(Astronomy.MakeTime(quando))).vec;
    const d = Math.hypot(g.x, g.y, g.z);
    const versoTerra = [-g.x / d, -g.y / d, -g.z / d];
    const lon = Math.atan2(skyDot(versoTerra, telaio.est), skyDot(versoTerra, telaio.primo)) * 180 / Math.PI;
    const lat = Math.asin(skyDot(versoTerra, telaio.nord)) * 180 / Math.PI;
    const lib = Astronomy.Libration(Astronomy.MakeTime(quando));
    const lato = 256;
    const vicina = __globo('prova:Moon', SKY_FACCE.Moon, lato, lon, lat);
    const lontana = __globo('prova:Moon', SKY_FACCE.Moon, lato, lon + 180, -lat);
    return {
      lon, lat, libLon: lib.elon, libLat: lib.elat,
      vicina: __luce(vicina, lato, 0, 0, 0.8), lontana: __luce(lontana, lato, 0, 0, 0.8)
    };
  });
  ok('il punto sotto la Terra è la libration vera', Math.abs(luna.lon - luna.libLon) < 0.5 && Math.abs(luna.lat - luna.libLat) < 0.5,
    `${luna.lon.toFixed(2)}°, ${luna.lat.toFixed(2)}° contro ${luna.libLon.toFixed(2)}°, ${luna.libLat.toFixed(2)}°`);
  ok('la faccia verso la Terra ha i mari, quella nascosta no (è più chiara)', luna.lontana > luna.vicina + 8,
    `${luna.vicina.toFixed(0)} contro ${luna.lontana.toFixed(0)}`);

  console.log('\n— nella scena: girando la camera la superficie cambia —');
  const scena = await pagina.evaluate(async () => {
    const risultati = {};
    const firma = (chiave) => {
      const v = skyGloboViste.get(chiave);
      if (!v) return null;
      const d = v.ctx.getImageData(0, 0, v.tela.width, v.tela.height).data;
      return { lato: v.tela.width, d: Array.from(d) };
    };
    for (const [id, chiave] of [['Jupiter', 'faccia:Jupiter'], ['Moon', 'faccia:Moon']]) {
      solScegli(id);
      solImpostaZoom(Number.MAX_SAFE_INTEGER);
      sol.zoom = sol.zoomVoluto;
      // si lascia finire l'avvicinamento, che muove la camera da sé
      await new Promise(r => setTimeout(r, 3000));
      sol.elev = sol.elevVoluta = 10;
      solDisegna();
      const t0 = performance.now();
      solDisegna();
      const tempo = performance.now() - t0;
      const fermo = () => new Promise(r => setTimeout(r, 300));
      await fermo(); solDisegna();
      const a = firma(chiave);
      sol.az += 50 * Math.PI / 180;
      solDisegna();
      // appena mossa la camera, il disco si ricampiona a mezza misura…
      const inMoto = firma(chiave);
      await fermo(); solDisegna();
      // …e fermata torna piena
      const b = firma(chiave);
      sol.elev = sol.elevVoluta = 80;
      solDisegna();
      await fermo(); solDisegna();
      const c = firma(chiave);
      let ab = 0, ac = 0, n = 0;
      if (a && b && c && a.lato === b.lato && a.lato === c.lato) {
        for (let i = 0; i < a.d.length; i += 4) {
          if (a.d[i + 3] < 250) continue;
          ab += Math.abs(a.d[i] - b.d[i]); ac += Math.abs(a.d[i] - c.d[i]); n++;
        }
      }
      risultati[id] = { c: !!(a && b && c), lato: a && a.lato, latoMoto: inMoto && inMoto.lato,
        ab: ab / Math.max(1, n), ac: ac / Math.max(1, n), tempo };
    }
    return risultati;
  });
  ['Jupiter', 'Moon'].forEach(id => {
    const r = scena[id];
    ok(`${id}: la vista 3D disegna il globo`, r.c, r.lato + ' px');
    ok(`${id}: girando la camera di 50° la superficie cambia`, r.ab > 6, r.ab.toFixed(1) + ' livelli');
    ok(`${id}: salendo verso il polo la superficie cambia`, r.ac > 6, r.ac.toFixed(1) + ' livelli');
    ok(`${id}: mentre la camera gira il disco è a mezza misura, poi torna pieno`, r.latoMoto === 512 && r.lato === 1024,
      `${r.latoMoto} poi ${r.lato}`);
  });

  console.log('\n— il prezzo —');
  const tempi = await pagina.evaluate(() => {
    const misura = (lato) => {
      const memo = skyGloboFacce('faccia:Moon', Math.min(lato, skyGloboLatoMax()), SKY_FACCE.Moon);
      const out = new Uint8ClampedArray(lato * lato * 4);
      const a = __assiDa(33, 12);
      const t0 = performance.now();
      for (let i = 0; i < 5; i++) skyGloboCampiona(out, lato, memo, a.R, a.U, a.V);
      return (performance.now() - t0) / 5;
    };
    const t0 = performance.now();
    skyGloboFacce('prova:Jupiter512', 512, SKY_FACCE.Jupiter);
    const dipinto = performance.now() - t0;
    return { l512: misura(512), l1024: misura(1024), dipinto };
  });
  ok('ricampionare un disco da 512 px costa pochi millisecondi', tempi.l512 < 25, tempi.l512.toFixed(1) + ' ms');
  ok('e uno da 1024 resta sotto un fotogramma lento', tempi.l1024 < 90, tempi.l1024.toFixed(1) + ' ms');
  console.log('  (dipingere le sei facce di Giove a 512 px: ' + tempi.dipinto.toFixed(0) + ' ms, una volta sola)');

  console.log('\n— il planetario resta quello di prima —');
  const cielo = await pagina.evaluate(() => {
    const f = skyFacciaDi({ id: 'Moon' }, 40);
    return { ok: !!f, globo: skyGloboVero, lat: skyLatitudineCentrale, lon: skyLongitudineCentrale };
  });
  ok('la faccia del planetario si dipinge ancora, e lo stato del pennello è tornato a zero',
    cielo.ok && !cielo.globo && cielo.lat === 0 && cielo.lon === 0);

  await browser.close();
  server.close();
  console.log(ko ? `\n${ko} prove fallite` : '\nTutto a posto.');
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
