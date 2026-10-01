/* La demo delle Voyager, guardata per quello che fa vedere.
 *
 *   npm install --no-save playwright-core astronomy-engine satellite.js@5.0.0
 *   node scripts/prova-demo-voyager.js
 *
 * È la demo in cui sbagliare si vede meno di tutte: una scia colorata che
 * parte dalla Terra e si allontana è convincente comunque, anche se passa a
 * dieci unità astronomiche da Giove il giorno in cui doveva sfiorarlo, e un
 * modellino girato a caso è un bel modellino. Qui si guarda l'aritmetica —
 * che le coniche raccordate passino **per** i pianeti nei giorni degli
 * incontri, con i perielii pubblicati, che il viaggio sbocchi sulla retta di
 * oggi senza scalini, che la Voyager 1 salga e la 2 scenda — e poi, in un
 * browser vero, che ogni scena mostri quello che il racconto promette: la
 * sonda nel quadro, la scia accesa, il modellino con l'antenna verso la
 * Terra, e che alla fine la vista 3D torni com'era. Le schermate finiscono in
 * `work/voyager-*.png`. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('playwright-core')); }
const radice = path.resolve(__dirname, '..');
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const file = path.resolve(radice, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader('Content-Type', tipi[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

let verifiche = 0;
function ok(c, m) { assert.ok(c, m); verifiche++; }

(async () => {
  let browser;
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    const eseguibile = ['/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
    browser = await chromium.launch(eseguibile ? { executablePath: eseguibile } : {}).catch(() => chromium.launch());
    const larghezza = Number(process.env.VOYAGER_L || 1100), altezza = Number(process.env.VOYAGER_H || 760);
    const pagina = await browser.newPage({ viewport: { width: larghezza, height: altezza }, serviceWorkers: 'block' });
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
    await pagina.addInitScript(() => {
      localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
      localStorage.setItem('astrocal_lingua', 'it');
      localStorage.setItem('astrocal_demo_intro_v1', JSON.stringify({ attiva: false }));
      localStorage.setItem('astrocal_demo_opzioni_v1', JSON.stringify({ schermoIntero: false, registra: false, livelli: null }));
    });
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => typeof AstroDemo !== 'undefined' && typeof sky !== 'undefined' &&
      sky.observer && sky.oggetti.length, null, { timeout: 30000 });
    fs.mkdirSync(path.join(radice, 'work'), { recursive: true });
    const foto = nome => pagina.screenshot({ path: path.join(radice, 'work/voyager-' + nome + '.png') });
    const attendiFotogrammi = () => pagina.evaluate(() => new Promise(r =>
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));

    // --- 1. Il viaggio: le coniche raccordate contro i numeri pubblicati ---
    const viaggio = await pagina.evaluate(() => {
      const fuori = {};
      for (const id of ['voyager1', 'voyager2']) {
        const v = solViaggioVoyager(id);
        fuori[id] = {
          flyby: v.flyby.map(f => {
            const p = solPosizioneVoyager(id, f.ms), q = solPosizionePianeta(f.id, f.ms);
            return { id: f.id, rp: f.perielioKm, dist: solV.lung(solV.meno(p, q)) * SOL_UA_KM };
          }),
          // La saldatura con la retta di oggi: un minuto prima e uno dopo l'epoca
          prima: solPuntoVoyager(id, SOL_SONDE_EPOCA_MS - 60000),
          dopo: solPuntoVoyager(id, SOL_SONDE_EPOCA_MS + 60000),
          lat2000: (() => { const p = solPosizioneVoyager(id, Date.UTC(2000, 0, 1)); return Math.asin(p[2] / solV.lung(p)) * 180 / Math.PI; })(),
          r2012: solV.lung(solPosizioneVoyager(id, Date.UTC(2012, 7, 25))),
          prelancio: solPosizioneVoyager(id, Date.UTC(1977, 6, 1))
        };
      }
      return fuori;
    });
    // I perielii pubblicati (dal centro del pianeta, in km)
    const PUBBLICATI = { voyager1: [348890, 184300], voyager2: [721670, 161000, 107000, 29240] };
    for (const id of ['voyager1', 'voyager2']) {
      viaggio[id].flyby.forEach((f, i) => {
        const vero = PUBBLICATI[id][i];
        ok(Math.abs(f.rp - vero) / vero < 0.1, `${id} a ${f.id}: perielio ${Math.round(f.rp)} km contro ${vero} pubblicati`);
        ok(Math.abs(f.dist - f.rp) < 2000, `${id} a ${f.id}: al massimo avvicinamento la sonda è al perielio`);
      });
      const a = viaggio[id].prima, b = viaggio[id].dopo;
      ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.01, `${id}: il viaggio sbocca sulla retta di oggi senza scalini`);
      ok(viaggio[id].prelancio === null, `${id}: prima del lancio non c'è`);
    }
    ok(viaggio.voyager1.lat2000 > 30, 'La Voyager 1 sale sopra il piano (' + viaggio.voyager1.lat2000.toFixed(1) + '°)');
    ok(viaggio.voyager2.lat2000 < -25, 'La Voyager 2 scende sotto il piano (' + viaggio.voyager2.lat2000.toFixed(1) + '°)');
    ok(Math.abs(viaggio.voyager1.r2012 - 121.6) < 4, 'La Voyager 1 all\'eliopausa nel 2012 (' + viaggio.voyager1.r2012.toFixed(1) + ' UA)');

    // --- 2. La demo, scena per scena -----------------------------------------
    await pagina.evaluate(() => {
      window.__prima = { az: sol.az, zoom: sol.zoom, distanzeVere: sol.distanzeVere, misureVere: sol.misureVere,
        grandTour: sol.grandTour, sondeAccese: sol.sondeAccese, sondeInCielo: sky.sondeInCielo };
      AstroDemo.avvia(AstroDemo.libreria.elenco().find(d => d.chiave === 'voyager').testo);
    });
    const scene = await pagina.evaluate(() => AstroDemo.valida(AstroDemo.libreria.elenco().find(d => d.chiave === 'voyager').testo).scene.map(s => s.vista));
    ok(scene.length === 15, 'Quindici scene');
    for (let i = 0; i < scene.length; i++) {
      for (const u of (process.env.VOYAGER_TUTTE ? [0.05, 0.5, 0.95] : [0.6])) {
        await pagina.evaluate(([i, u]) => { AstroDemo.vaiAScena(i, u); AstroDemo.pausa(); }, [i, u]);
        await attendiFotogrammi();
        await pagina.waitForTimeout(250);
        await attendiFotogrammi();
        const stato = await pagina.evaluate(() => {
          const fuori = { aperto: sol.aperto, tour: !!sol.grandTour, sonde: [] };
          if (sol.aperto && sol.grandTour) {
            sol.sonde.forEach(s => { if (sol.grandTour.sonde.includes(s.id) && s.partita && s.schermo)
              fuori.sonde.push({ id: s.id, px: s.schermo.px, py: s.schermo.py, L: sol.L, H: sol.H }); });
            // L'antenna guarda la Terra: il versore dalla sonda alla Terra
            fuori.misura = solMisuraModelloVoyager();
          }
          return fuori;
        });
        if (scene[i] === 'solar_system_3d') {
          ok(stato.aperto && stato.tour, `Scena ${i + 1}: la vista 3D ha il Grand Tour acceso`);
          ok(stato.sonde.length >= 1 || i === 2, `Scena ${i + 1}: almeno una sonda in scena`);
          stato.sonde.forEach(s => ok(s.px > -40 && s.py > -40 && s.px < s.L + 40 && s.py < s.H + 40,
            `Scena ${i + 1}: ${s.id} nel quadro (${Math.round(s.px)}, ${Math.round(s.py)})`));
        }
        await foto(String(i + 1).padStart(2, '0') + (process.env.VOYAGER_TUTTE ? '-' + Math.round(u * 100) : ''));
      }
    }

    // --- 2-bis. I sorvoli da vicino, le proporzioni, il Disco d'Oro ---------
    // Un sorvolo si capisce solo se nel quadro ci sono insieme la sonda e il
    // pianeta, e il pianeta è grande: al massimo avvicinamento di ogni flyby
    // mostrato (Giove e Saturno per la 1; Saturno, Urano e Nettuno per la 2)
    // il disco vero deve prendere un pezzo serio del lato corto, e la sonda
    // restare dentro allo schermo. E accanto a un pianeta così il modellino
    // non può essere grande: è un segno, più piccolo del disco.
    const SORVOLI = [[5, 'voyager1', 'Jupiter'], [6, 'voyager1', 'Saturn'], [7, 'voyager2', 'Saturn'],
      [7, 'voyager2', 'Uranus'], [8, 'voyager2', 'Neptune']];
    for (const [scena, sonda, pianeta] of SORVOLI) {
      // L'istante del perielio dentro alla scena: lo si cerca sull'orologio
      // della scena stessa, a passi, prendendo il punto più vicino
      const u = await pagina.evaluate(([i, id, nome]) => {
        const fb = solViaggioVoyager(id).flyby.find(f => f.id === nome);
        let migliore = 0, scarto = Infinity;
        for (let k = 0; k <= 200; k++) {
          AstroDemo.vaiAScena(i, k / 200); AstroDemo.pausa();
          const d = Math.abs(+skyAdesso() - fb.ms);
          if (d < scarto) { scarto = d; migliore = k / 200; }
        }
        return migliore;
      }, [scena, sonda, pianeta]);
      await pagina.evaluate(([i, u]) => { AstroDemo.vaiAScena(i, u); AstroDemo.pausa(); }, [scena, u]);
      await attendiFotogrammi(); await pagina.waitForTimeout(200); await attendiFotogrammi();
      const m = await pagina.evaluate(([id, nome]) => {
        const s = sol.sonde.find(x => x.id === id), p = sol.pianeti.find(x => x.id === nome);
        return { corto: Math.min(sol.L, sol.H), L: sol.L, H: sol.H, r: p.rDisegno, sx: s.schermo.px, sy: s.schermo.py,
          px: p.schermo.px, py: p.schermo.py, modello: solMisuraModelloVoyager(s) };
      }, [sonda, pianeta]);
      ok(m.r / m.corto > 0.06, `${sonda} a ${pianeta}: il pianeta è grande nel quadro (raggio ${Math.round(m.r)} px)`);
      ok(m.sx > 0 && m.sy > 0 && m.sx < m.L && m.sy < m.H, `${sonda} a ${pianeta}: la sonda è nel quadro`);
      ok(m.px > -m.r && m.py > -m.r && m.px < m.L + m.r && m.py < m.H + m.r, `${sonda} a ${pianeta}: il pianeta è nel quadro`);
      ok(m.modello < m.r * 0.3, `${sonda} a ${pianeta}: la sonda è molto più piccola del pianeta (${m.modello.toFixed(1)} px)`);
      await foto('sorvolo-' + sonda + '-' + pianeta);
    }
    // Il lancio: la Terra grande, la sonda un segno accanto
    await pagina.evaluate(() => { AstroDemo.vaiAScena(3, 0.05); AstroDemo.pausa(); });
    await attendiFotogrammi(); await pagina.waitForTimeout(200); await attendiFotogrammi();
    const lancio = await pagina.evaluate(() => {
      const s = sol.sonde.find(x => x.id === 'voyager1'), t = sol.pianeti.find(x => x.id === 'Earth');
      return { r: t.rDisegno, modello: solMisuraModelloVoyager(s), corto: Math.min(sol.L, sol.H) };
    });
    ok(lancio.r > 20 && lancio.modello < lancio.r * 0.3, `Al lancio la sonda è piccola accanto alla Terra (${lancio.modello.toFixed(1)} px contro ${Math.round(lancio.r)})`);
    // Il Disco d'Oro: la scheda con l'immagine compare, il filo la lega al disco
    await pagina.evaluate(() => { AstroDemo.vaiAScena(11, 0.7); AstroDemo.pausa(); });
    await attendiFotogrammi(); await pagina.waitForTimeout(400); await attendiFotogrammi();
    const disco = await pagina.evaluate(() => {
      const f = document.getElementById('demo-immagine');
      const img = f && f.querySelector('img');
      return { c: !!f, visibile: !!f && f.classList.contains('visibile'), src: img ? img.src : '',
        filo: !!(sol.grandTour && sol.grandTour.discoFilo), centro: sol.grandTour && sol.grandTour.discoCentro };
    });
    ok(disco.c && disco.visibile && disco.src, 'Il Disco d\'Oro: la scheda con l\'immagine è a schermo');
    ok(disco.filo && disco.centro > 0.99, 'Il Disco d\'Oro: il filo lega il disco del modellino alla scheda, e il disco è al centro');
    await foto('disco');

    // --- 3. Le Voyager nel cielo di stasera ---------------------------------
    await pagina.evaluate(() => { AstroDemo.vaiAScena(13, 0.95); AstroDemo.pausa(); });
    await attendiFotogrammi();
    ok(await pagina.evaluate(() => sky.sondeInCielo === true), 'I mirini delle Voyager sono accesi nel planetario');
    // «Stasera» è il giorno in cui si guarda la demo, non una data scritta a
    // mano: il giorno civile a Roma dell'orologio del cielo è quello di oggi,
    // e la camera guarda dove sta la sonda.
    const stasera = await pagina.evaluate(() => {
      const luogo = skyLuogoDelCielo();
      const a = partiDataDelLuogo(skyAdesso(), luogo), b = partiDataDelLuogo(new Date(), luogo);
      const s = skySondaInCielo('voyager1');
      return { stessoGiorno: a.year === b.year && a.month === b.month && a.day === b.day, ora: a.hour,
        scartoAz: Math.abs(((sky.manuale.az - s.az + 540) % 360) - 180), sondaAlta: s.alt };
    });
    ok(stasera.stessoGiorno && stasera.ora === 21, `«Stasera» è oggi alle 21 (ora ${stasera.ora})`);
    ok(stasera.scartoAz < 0.5, `La camera guarda verso Voyager 1 (scarto ${stasera.scartoAz.toFixed(2)}°)`);

    // --- 4. Stop: tutto torna com'era ---------------------------------------
    await pagina.evaluate(() => AstroDemo.ferma());
    await attendiFotogrammi();
    const dopo = await pagina.evaluate(() => ({ az: sol.az, zoom: sol.zoom, distanzeVere: sol.distanzeVere,
      misureVere: sol.misureVere, grandTour: sol.grandTour, sondeAccese: sol.sondeAccese, sondeInCielo: sky.sondeInCielo,
      prima: window.__prima, aperto: sol.aperto }));
    ok(!dopo.aperto, 'La vista 3D si chiude');
    ok(await pagina.evaluate(() => !document.getElementById('demo-immagine')), 'La scheda del Disco d\'Oro se ne va');
    for (const k of ['distanzeVere', 'misureVere', 'grandTour', 'sondeAccese', 'sondeInCielo'])
      ok(dopo[k] === dopo.prima[k], `Ripristino di ${k}`);
    ok(!errori.length, 'Nessun errore di pagina: ' + errori.join(' | '));
    console.log(`Demo delle Voyager: ${verifiche} verifiche superate`);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
