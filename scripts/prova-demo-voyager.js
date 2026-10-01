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
    ok(scene.length === 18, 'Diciotto scene');
    // Le tre scene della scala cosmica (v400): stessa vista 3D, ma il quadro
    // è quello di scala-cosmica.js e il Grand Tour è spento
    const COSMICHE = [13, 14, 15];
    for (let i = 0; i < scene.length; i++) {
      for (const u of (process.env.VOYAGER_TUTTE ? [0.05, 0.5, 0.95] : [0.6])) {
        await pagina.evaluate(([i, u]) => { AstroDemo.vaiAScena(i, u); AstroDemo.pausa(); }, [i, u]);
        await attendiFotogrammi();
        await pagina.waitForTimeout(250);
        await attendiFotogrammi();
        const stato = await pagina.evaluate(() => {
          const fuori = { aperto: sol.aperto, tour: !!sol.grandTour, sonde: [],
            cosmo: typeof cosmAttivo === 'function' && cosmAttivo() };
          if (sol.aperto && sol.grandTour) {
            sol.sonde.forEach(s => { if (sol.grandTour.sonde.includes(s.id) && s.partita && s.schermo)
              fuori.sonde.push({ id: s.id, px: s.schermo.px, py: s.schermo.py, L: sol.L, H: sol.H }); });
            // L'antenna guarda la Terra: il versore dalla sonda alla Terra
            fuori.misura = solMisuraModelloVoyager();
          }
          return fuori;
        });
        if (COSMICHE.includes(i)) {
          ok(stato.aperto && stato.cosmo, `Scena ${i + 1}: la vista 3D mostra la scala cosmica`);
        } else if (scene[i] === 'solar_system_3d') {
          ok(!stato.cosmo, `Scena ${i + 1}: niente scala cosmica`);
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
      const s = sol.sonde.find(x => x.id === 'voyager2'), t = sol.pianeti.find(x => x.id === 'Earth');
      return { r: t.rDisegno, modello: solMisuraModelloVoyager(s), corto: Math.min(sol.L, sol.H) };
    });
    ok(lancio.r > 20 && lancio.modello < lancio.r * 0.3, `Al lancio la sonda è piccola accanto alla Terra (${lancio.modello.toFixed(1)} px contro ${Math.round(lancio.r)})`);
    // --- 2-ter. Le riprese del lancio e del sorpasso (v399) ------------------
    // Il lancio si gioca in quattro riprese dentro alla stessa frase: prima
    // Voyager 2 il 20 agosto, poi Voyager 1 il 5 settembre, poi tutte e due
    // nel quadro. La sonda esce dall'aria nella ripresa sua: si scorre la
    // scena in avanti, a passi, e si guarda quando la distanza dalla Terra
    // passa i 6471 km — e che in quel momento la sonda e il bordo della Terra
    // siano nel quadro.
    const riprese = await pagina.evaluate(() => {
      const fuori = {};
      const misura = id => {
        const s = sol.sonde.find(x => x.id === id), t = sol.pianeti.find(x => x.id === 'Earth');
        solLeggiPosizioni(skyAdesso());
        return { km: Math.hypot(s.pos.x - t.pos.x, s.pos.y - t.pos.y, s.pos.z - t.pos.z) * SOL_UA_KM };
      };
      AstroDemo.vaiAScena(3, 0.07); AstroDemo.pausa();
      fuori.primaRipresa = { sonde: sol.grandTour.sonde.slice(), mese: skyAdesso().getUTCMonth(), giorno: skyAdesso().getUTCDate(),
        aria: !!sol.grandTour.atmosfera };
      for (const [id, da, a] of [['voyager2', 0, 0.15], ['voyager1', 0.15, 0.4]]) {
        let prima = null;
        for (let k = 0; k <= 80; k++) {
          const u = da + (a - da) * k / 80;
          AstroDemo.vaiAScena(3, u); AstroDemo.pausa();
          const m = misura(id);
          if (prima !== null && prima < 6471 && m.km >= 6471) { fuori[id] = { u, rel: (u - da) / (a - da) }; break; }
          prima = m.km;
        }
      }
      AstroDemo.vaiAScena(3, 0.58); AstroDemo.pausa();
      fuori.tutte = sol.grandTour.sonde.slice();
      return fuori;
    });
    ok(riprese.primaRipresa.sonde.join() === 'voyager2' && riprese.primaRipresa.mese === 7 && riprese.primaRipresa.giorno === 20 &&
      riprese.primaRipresa.aria, 'Prima ripresa: parte Voyager 2, il 20 agosto, con l\'aria disegnata');
    for (const id of ['voyager2', 'voyager1'])
      ok(riprese[id] && riprese[id].rel > 0.02 && riprese[id].rel < 0.6,
        `${id} esce dall'atmosfera dentro alla sua ripresa (${riprese[id] ? Math.round(riprese[id].rel * 100) : '—'}%)`);
    await pagina.evaluate(u => { AstroDemo.vaiAScena(3, u); AstroDemo.pausa(); }, riprese.voyager1 ? riprese.voyager1.u : 0.25);
    await attendiFotogrammi(); await pagina.waitForTimeout(150); await attendiFotogrammi();
    const uscita = await pagina.evaluate(() => {
      const s = sol.sonde.find(x => x.id === 'voyager1'), t = sol.pianeti.find(x => x.id === 'Earth');
      return { L: sol.L, H: sol.H, sx: s.schermo.px, sy: s.schermo.py, tx: t.schermo.px, ty: t.schermo.py, r: t.rDisegno,
        lampo: !!(sol.grandTour.uscite && sol.grandTour.uscite.voyager1 && sol.grandTour.uscite.voyager1.t0 !== null) };
    });
    ok(uscita.sx > 0 && uscita.sy > 0 && uscita.sx < uscita.L && uscita.sy < uscita.H && uscita.r > 0.15 * Math.min(uscita.L, uscita.H),
      'All\'uscita dall\'aria la Voyager 1 è nel quadro, e la Terra è grande');
    ok(Math.abs(Math.hypot(uscita.sx - uscita.tx, uscita.sy - uscita.ty) - uscita.r) < 0.25 * uscita.r,
      'La sonda esce dal bordo del disco (la camera guarda di traverso alla sua strada)');
    await foto('lancio-uscita');
    await pagina.evaluate(() => { AstroDemo.vaiAScena(3, 0.6); AstroDemo.pausa(); });
    await attendiFotogrammi(); await pagina.waitForTimeout(150); await attendiFotogrammi();
    const coppia = await pagina.evaluate(() => sol.sonde.filter(s => ['voyager1', 'voyager2'].includes(s.id))
      .map(s => ({ id: s.id, px: s.schermo.px, py: s.schermo.py, L: sol.L, H: sol.H })));
    ok(riprese.tutte.length === 2 && coppia.length === 2 && coppia.every(s => s.px > 0 && s.py > 0 && s.px < s.L && s.py < s.H) &&
      Math.hypot(coppia[0].px - coppia[1].px, coppia[0].py - coppia[1].py) > 0.25 * coppia[0].L,
      'Dopo i due lanci tutte e due le sonde sono nel quadro, ben separate');
    await foto('lancio-coppia');
    // Il sorpasso: il giorno lo cercano le posizioni del viaggio, ed è quello
    // dei libri (15 dicembre 1977); nella scena cade quando la voce lo dice,
    // con la camera stretta sulle due sonde.
    const sorpasso = await pagina.evaluate(() => {
      const ms = solSorpassoVoyager();
      let u = null;
      for (let k = 0; k <= 300; k++) {
        AstroDemo.vaiAScena(4, k / 300); AstroDemo.pausa();
        if (+skyAdesso() >= ms) { u = k / 300; break; }
      }
      return { data: new Date(ms).toISOString().slice(0, 10), u };
    });
    ok(sorpasso.data === '1977-12-15', `Il sorpasso cade il 15 dicembre 1977 (${sorpasso.data})`);
    ok(sorpasso.u > 0.4 && sorpasso.u < 0.62, `Nella scena il sorpasso arriva a metà frase (${sorpasso.u})`);
    await pagina.evaluate(u => { AstroDemo.vaiAScena(4, u); AstroDemo.pausa(); }, sorpasso.u + 0.02);
    await attendiFotogrammi(); await pagina.waitForTimeout(150); await attendiFotogrammi();
    const gara = await pagina.evaluate(() => ({ gara: !!sol.grandTour.gara, L: sol.L, H: sol.H,
      sonde: sol.sonde.map(s => ({ px: s.schermo.px, py: s.schermo.py })) }));
    const dSonde = Math.hypot(gara.sonde[0].px - gara.sonde[1].px, gara.sonde[0].py - gara.sonde[1].py);
    ok(gara.gara && gara.sonde.every(s => s.px > 0 && s.py > 0 && s.px < gara.L && s.py < gara.H) && dSonde > 40,
      `Al sorpasso le due sonde sono nel quadro, da vicino (${Math.round(dSonde)} px fra loro)`);
    await foto('sorpasso');
    // La cronologia: un tocco mostra i comandi con la pista (una tacca per
    // scena), e la durata è un'opzione (qui due secondi). Toccando la pista
    // a metà si salta lì.
    await pagina.evaluate(() => { AstroDemo.impostaOpzioni({ durataComandiSec: 2 }); AstroDemo.riprendi(); });
    await pagina.mouse.click(Math.round(larghezza / 2), Math.round(altezza / 3));
    const cronologia = await pagina.evaluate(() => {
      const p = document.getElementById('demo-controlli');
      return { visibile: p.classList.contains('visibile'), pezzi: p.querySelectorAll('.demo-cronologia-pezzo').length,
        testo: p.querySelector('.demo-cronologia-testa').textContent };
    });
    ok(cronologia.visibile && cronologia.pezzi === 18 && /5 di 18/.test(cronologia.testo),
      `Il tocco mostra i comandi con la cronologia (${cronologia.testo})`);
    await foto('cronologia');
    const salto = await pagina.evaluate(() => {
      const pista = document.querySelector('.demo-cronologia-pista'), r = pista.getBoundingClientRect();
      pista.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width * 0.5, clientY: r.top + r.height / 2 }));
      return AstroDemo.scena;
    });
    ok(salto >= 6 && salto <= 11, `Toccando la pista a metà si salta a metà del racconto (scena ${salto + 1})`);
    await pagina.waitForTimeout(2600);
    ok(await pagina.evaluate(() => !document.getElementById('demo-controlli').classList.contains('visibile')),
      'Dopo la durata scelta i comandi si ritirano');
    await pagina.evaluate(() => { AstroDemo.impostaOpzioni({ durataComandiSec: 5 }); AstroDemo.pausa(); });
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

    // --- 2-quater. La scala cosmica (v400) -----------------------------------
    // Tre domande, e sono quelle che a occhio si sbagliano: le sonde di oggi
    // sono nel quadro con la loro distanza scritta accanto; gli anni corrono
    // davvero (e non oltre quanto la scena dichiara); e in fondo alla scena
    // della scala il loro viaggio intero è più piccolo di un pixel.
    const cosmo = async (i, u) => {
      await pagina.evaluate(([i, u]) => { AstroDemo.vaiAScena(i, u); AstroDemo.pausa(); }, [i, u]);
      await attendiFotogrammi(); await pagina.waitForTimeout(150); await attendiFotogrammi();
      return pagina.evaluate(() => {
        const cam = cosm.cam, m = cosmMisuraSonda('voyager1', cosmIstante());
        return { L: cosm.L, anni: cosm.anni, sonde: cosm.schermo.sonde.map(s => ({ id: s.id, x: s.x, y: s.y })),
          W: sol.L, H: sol.H, pxViaggio: m.dalSole * cam.s, dalSole: m.dalSole, dallaTerra: m.dallaTerra,
          terra: m.terraNota, evidenza: cosm.evidenza, riga: !!cosm.schermo.riga };
      });
    };
    let c = await cosmo(13, 0.9);
    ok(c.sonde.length === 2 && c.sonde.every(s => s.x > 0 && s.y > 0 && s.x < c.W && s.y < c.H),
      'Scala cosmica, oggi: le due sonde sono nel quadro');
    ok(c.terra && c.dalSole > 165 && c.dalSole < 200 && Math.abs(c.dallaTerra - c.dalSole) < 1.1,
      `Scala cosmica, oggi: Voyager 1 a ${c.dalSole.toFixed(1)} UA dal Sole e ${c.dallaTerra.toFixed(1)} dalla Terra`);
    ok(c.riga, 'Scala cosmica: la riga delle distanze è disegnata');
    await foto('cosmo-oggi');
    c = await cosmo(14, 0.999);
    ok(c.anni > 41000 && c.anni <= 42000, `Scala cosmica, il futuro: gli anni arrivano a ${Math.round(c.anni)}`);
    ok(c.dalSole > 140000 && c.dalSole < 160000, `Fra 42.000 anni Voyager 1 è a ${Math.round(c.dalSole)} UA (oltre la nube di Oort)`);
    ok(c.sonde.length === 2 && c.sonde.every(s => s.x > 0 && s.y > 0 && s.x < c.W && s.y < c.H), 'Il futuro: le sonde restano nel quadro');
    await foto('cosmo-futuro');
    c = await cosmo(15, 0.5);
    ok(c.evidenza, `Scala cosmica: a metà della salita c'è una struttura accesa (${c.evidenza})`);
    c = await cosmo(15, 0.999);
    ok(c.L > 15.3, `Scala cosmica: la scena finisce sull'universo osservabile (L = ${c.L.toFixed(2)})`);
    ok(c.pxViaggio < 1e-6, `Su quella scala il viaggio delle Voyager è meno di un pixel (${c.pxViaggio.toExponential(1)} px)`);
    await foto('cosmo-universo');

    // --- 3. Le Voyager nel cielo di stasera ---------------------------------
    await pagina.evaluate(() => { AstroDemo.vaiAScena(16, 0.95); AstroDemo.pausa(); });
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
    ok(await pagina.evaluate(() => !cosmAttivo() && !cosm.regia), 'La scala cosmica si spegne con la demo');
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
