#!/usr/bin/env node
/* La presentazione dell'app (v524) e i pezzi nuovi del motore che le servono,
 * nel browser vero, senza rete (Overpass e ADS-B finti, librerie da
 * node_modules):
 *
 *   npm install --no-save playwright-core astronomy-engine satellite.js@5.0.0 leaflet@1.9.4 fullcalendar@6.1.15
 *   node scripts/prova-demo-presentazione.js
 *
 * Si prova: la validazione (`app_view` vuole `page_show`, solo un ospite su
 * una pagina in HTML, livelli e pagine sconosciuti, `set_date { now }`,
 * `set_location { home }`); le schermate vere — il calendario col mese e il
 * filtro, l'agenda, la mappa dell'eclissi del 2027, il banco della didattica
 * in marcia, Stasera — con Astro Ben disegnato sulla tela sovrapposta e la
 * vista pulita spenta; il paesaggio di Cortina coi livelli accesi, le
 * scritte e l'ora vera, e tutto rimesso com'era alla scena dopo; lo Stop che
 * ripristina pagina, mese, filtro, livelli e luogo; la proposta della
 * presentazione al primo accesso. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
let pw;
try { pw = require('playwright-core'); } catch (_) { pw = require('playwright'); }

const radice = path.resolve(__dirname, '..');
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
  try { return path.dirname(require.resolve(nome + '/package.json')); } catch (_) { return null; }
}
function chromiumVero() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  for (const c of ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'])
    if (fs.existsSync(c)) return c;
  return undefined;
}
// Overpass finto: le vette e i paesi attorno a Cortina d'Ampezzo
function overpassFinto(corpo) {
  const el = [];
  if (/peak/.test(corpo)) for (const [n, la, lo, q] of [['Tofana di Mezzo', 46.5833, 12.0667, 3244], ['Becco di Mezzodì', 46.5189, 12.0425, 2603],
    ['Cinque Torri', 46.5083, 12.0408, 2361], ['Nuvolau', 46.5219, 12.0378, 2574], ['Cristallo', 46.5747, 12.2347, 3221]])
    el.push({ type: 'node', id: el.length + 1, lat: la, lon: lo, tags: { name: n, ele: String(q), natural: 'peak' } });
  if (/place/.test(corpo)) for (const [n, la, lo, t] of [["Cortina d'Ampezzo", 46.5405, 12.1357, 'town'], ['Pocol', 46.5222, 12.1119, 'village']])
    el.push({ type: 'node', id: 100 + el.length, lat: la, lon: lo, tags: { name: n, place: t, population: '1000' } });
  return { version: 0.6, elements: el };
}
// ADS-B finto: quattro aerei di linea sopra le Dolomiti
const AEREI = [
  { hex: '4b1814', flight: 'SWR1234 ', lat: 46.62, lon: 12.40, alt_baro: 36000, gs: 440, track: 250, t: 'A320', seen_pos: 1 },
  { hex: '3c6444', flight: 'DLH7NA  ', lat: 46.40, lon: 11.90, alt_baro: 38000, gs: 470, track: 95, t: 'A321', seen_pos: 1 },
  { hex: '440123', flight: 'AUA612  ', lat: 46.75, lon: 12.00, alt_baro: 34000, gs: 450, track: 160, t: 'E195', seen_pos: 2 },
  { hex: '4ca7b5', flight: 'RYR2PX  ', lat: 46.30, lon: 12.35, alt_baro: 37000, gs: 460, track: 20, t: 'B738', seen_pos: 1 }
];

const prove = [];
const prova = (nome, fn) => prove.push([nome, fn]);

(async () => {
  let browser, passate = 0, fallite = 0;
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    browser = await pw.chromium.launch({ executablePath: chromiumVero() });
    const pagina = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 1100, height: 760 } });
    pagina.setDefaultTimeout(Number(process.env.ATTESA) || 60000);
    const errori = [];
    pagina.on('pageerror', e => errori.push(e.message));
    const libreria = (nome, file, tipo) => ({ contentType: tipo, body: fs.readFileSync(path.join(pacchetto(nome), file)) });
    await pagina.route('**/*', async r => {
      const url = r.request().url();
      if (url.startsWith(origine)) return r.continue();
      if (url.includes('astronomy.browser.min.js')) return r.fulfill(libreria('astronomy-engine', 'astronomy.browser.min.js', 'text/javascript'));
      if (url.includes('satellite.min.js')) return r.fulfill(libreria('satellite.js', 'dist/satellite.min.js', 'text/javascript'));
      if (url.includes('fullcalendar') && pacchetto('fullcalendar')) return r.fulfill(libreria('fullcalendar', 'index.global.min.js', 'text/javascript'));
      if (url.includes('leaflet.js') && pacchetto('leaflet')) return r.fulfill(libreria('leaflet', 'dist/leaflet.js', 'text/javascript'));
      if (url.includes('leaflet.css') && pacchetto('leaflet')) return r.fulfill(libreria('leaflet', 'dist/leaflet.css', 'text/css'));
      if (/overpass/.test(url)) {
        let corpo = '';
        try { corpo = r.request().postData() || decodeURIComponent(url); } catch (_) { /* niente */ }
        return r.fulfill({ contentType: 'application/json', body: JSON.stringify(overpassFinto(corpo)) });
      }
      if (/api\.(adsb\.lol|airplanes\.live|adsb\.one)|opendata\.adsb\.fi/.test(url))
        return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ac: AEREI, now: Date.now() }) });
      return r.abort();
    });
    await pagina.addInitScript(() => {
      localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
      localStorage.setItem('astrocal_lingua', 'it');
      localStorage.setItem('astrocal_demo_intro_v1', JSON.stringify({ attiva: false }));
      localStorage.setItem('astrocal_demo_opzioni_v1', JSON.stringify({ schermoIntero: false, registra: false, livelli: null }));
      const voce = { corrente: null, timer: [], getVoices: () => [{ name: 'Finta', lang: 'it-IT', default: true, localService: true }], addEventListener() {},
        speak(u) { voce.cancel(); voce.corrente = u;
          voce.timer.push(setTimeout(() => u.onstart && u.onstart(), 20));
          voce.timer.push(setTimeout(() => { if (voce.corrente === u) { voce.corrente = null; u.onend && u.onend(); } }, 60 + u.text.split(/\s+/).length * 300)); },
        cancel() { voce.timer.forEach(clearTimeout); voce.timer = []; const u = voce.corrente; voce.corrente = null; if (u && u.onerror) u.onerror({ error: 'interrupted' }); } };
      Object.defineProperty(window, 'speechSynthesis', { value: voce, configurable: true });
      window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ''; } };
    });
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => window.AstroDemo && window.StorieCosmiche && sky.observer && sky.oggetti.length, null, { timeout: 60000 });
    const testo = await pagina.evaluate(() => AstroDemo.libreria.elenco().find(d => d.chiave === 'presentazione').testo);
    const scenaDi = async (i, f = 0.08) => { await pagina.evaluate(([i, f]) => AstroDemo.vaiAScena(i, f), [i, f]); await pagina.evaluate(() => AstroDemo.pausa()); await pagina.waitForTimeout(900); };
    // quanti pixel disegnati ci sono sulla tela di Ben
    const pixelBen = () => pagina.evaluate(() => {
      const t = document.getElementById('demo-ospiti-tela');
      if (!t || !t.width) return 0;
      const d = t.getContext('2d').getImageData(0, 0, t.width, t.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 40) n++;
      return n;
    });

    prova('la presentazione è la prima predefinita, valida, e la pagina Demo la propone di serie', async () => {
      const r = await pagina.evaluate(() => {
        const d = AstroDemo.libreria.elenco();
        const demo = AstroDemo.valida(d[0].testo);
        return { prima: d[0].chiave, scene: demo.scene.map(s => s.vista), scelta: document.getElementById('demo-elenco').value };
      });
      assert.equal(r.prima, 'presentazione');
      assert.equal(r.scelta, 'presentazione');
      for (const v of ['app_view', 'didactic_view', 'eclipse_map', 'planetarium_view', 'solar_system_3d', 'transition'])
        assert.ok(r.scene.includes(v), 'ha una scena ' + v);
    });

    prova('la validazione: pagine, banchi, livelli, ospiti, ora vera e casa', async () => {
      const prova1 = async (corpo) => pagina.evaluate(c => { try { AstroDemo.valida("define_demo x {\n" + c + "\n}"); return ''; } catch (e) { return e.message; } }, corpo);
      assert.match(await prova1("scene app_view { duration: 5s; action: narrate { text: 'a' }; }"), /page_show/);
      assert.match(await prova1("scene planetarium_view { duration: 5s; action: page_show { page: calendar }; }"), /app_view/);
      assert.match(await prova1("scene app_view { duration: 5s; action: page_show { page: cucina }; }"), /tonight, calendar, agenda/);
      assert.match(await prova1("scene app_view { duration: 5s; action: page_show { page: tonight, month: '2027-08' }; }"), /month/);
      assert.match(await prova1("scene app_view { duration: 5s; action: page_show { page: calendar, filter: pizze }; }"), /filter/);
      assert.match(await prova1("scene app_view { duration: 5s; action: page_show { page: calendar }; action: character_show { target: 'Saturn' }; }"), /ospite/);
      assert.equal(await prova1("scene app_view { duration: 5s; action: page_show { page: calendar, month: '2027-08', filter: eclissi, focus: grid }; action: character_show { target: 'astro_ben', at: bottom_right, scale: 0.55 }; action: character_speak { target: 'astro_ben', text: 'Ciao' }; }"), '');
      assert.match(await prova1("scene didactic_view { duration: 5s; action: didactic_bench { lab: cucina }; }"), /retro, keplero/);
      assert.match(await prova1("scene app_view { duration: 5s; action: page_show { page: agenda }; action: didactic_bench { lab: retro }; }"), /didactic_view/);
      assert.match(await prova1("scene planetarium_view { duration: 5s; action: show_layers { on: 'cime,draghi' }; }"), /terreno/);
      assert.match(await prova1("scene app_view { duration: 5s; action: page_show { page: agenda }; action: show_layers { on: 'cime' }; }"), /planetarium_view/);
      assert.equal(await prova1("scene planetarium_view { duration: 5s; action: set_date { now: show }; action: set_location { home: show }; action: show_layers { on: 'cime,aerei', labels: show }; }"), '');
      assert.match(await prova1("scene planetarium_view { duration: 5s; action: set_date { now: yes }; }"), /now/);
    });

    prova('il calendario vero: agosto 2027, solo le eclissi, con Ben sovrapposto e l\'interfaccia in vista', async () => {
      await pagina.evaluate(t => AstroDemo.avvia(t), testo);
      await scenaDi(3, 0.1);
      const r = await pagina.evaluate(() => ({
        vista: vistaAttuale, filtro: filtroCategoria, mese: meseSelezionato, pulita: document.body.classList.contains('demo-vista-pulita'),
        vera: document.body.classList.contains('demo-pagina-vera'), eclissi: !!document.querySelector('#calendario-griglia .fc-event'),
        tela: !!document.getElementById('demo-ospiti-tela'), scorso: window.scrollY
      }));
      assert.equal(r.vista, 'calendario');
      assert.equal(r.filtro, 'eclissi');
      assert.deepEqual(r.mese, { anno: 2027, mese: 7 });
      assert.equal(r.pulita, false, 'la vista pulita nasconderebbe proprio i filtri');
      assert.equal(r.vera, true);
      assert.ok(r.eclissi, 'l\'eclissi del 2 agosto è nella griglia');
      assert.ok(r.tela, 'c\'è la tela di chi racconta');
      assert.ok(await pixelBen() > 50, 'Astro Ben è disegnato sopra al calendario');
      // la seconda ripresa: l'agenda con la scheda
      await scenaDi(3, 0.75);
      const a = await pagina.evaluate(() => ({ vista: vistaAttuale, scheda: (document.querySelector('article[data-evento-id]') || {}).textContent || '' }));
      assert.equal(a.vista, 'agenda');
      assert.match(a.scheda, /Eclissi Solare Totale/);
    });

    prova('la mappa dell\'ombra è quella del 2 agosto 2027, con Ben', async () => {
      await scenaDi(4, 0.3);
      const r = await pagina.evaluate(() => ({ aperta: typeof eclRegiaAttiva === 'function' && eclRegiaAttiva(), quando: skyAdesso().toISOString() }));
      assert.ok(r.aperta, 'la regia della mappa è aperta');
      assert.match(r.quando, /^2027-08-02T/, 'l\'orologio è sull\'eclissi del 2027: ' + r.quando);
      assert.ok(await pixelBen() > 50, 'Ben anche sulla mappa');
    });

    prova('la didattica: il banco del moto retrogrado in marcia, poi Keplero; la marcia si ferma con la scena', async () => {
      await scenaDi(9, 0.1);
      const r = await pagina.evaluate(() => ({ vista: vistaAttuale, retro: !document.getElementById('did-lab-retro').classList.contains('hidden'),
        marcia: document.getElementById('did-retro-play').getAttribute('aria-pressed') }));
      assert.equal(r.vista, 'didattica');
      assert.ok(r.retro, 'il banco del moto retrogrado è aperto');
      assert.equal(r.marcia, 'true', 'e cammina');
      assert.ok(await pixelBen() > 50, 'Ben sopra al banco');
      await scenaDi(9, 0.8);
      const k = await pagina.evaluate(() => ({ kep: !document.getElementById('did-lab-keplero').classList.contains('hidden'),
        marcia: document.getElementById('did-kep-play').getAttribute('aria-pressed') }));
      assert.ok(k.kep, 'poi le leggi di Keplero');
      assert.equal(k.marcia, 'true');
      await scenaDi(10, 0.1);
      assert.equal(await pagina.evaluate(() => document.getElementById('did-kep-play').getAttribute('aria-pressed')), 'false', 'finita la scena, il banco si ferma');
      await scenaDi(12, 0.1);
      assert.equal(await pagina.locator('#demo-ospiti-tela').count(), 0, 'nel planetario la tela sovrapposta se ne va');
    });

    // v528: perché c'è l'aurora, col banco delle aurore (il vento solare,
    // poi lo scudo magnetico e l'anello), con Ben sopra
    prova('la lezione delle aurore: il vento solare, poi la magnetosfera e l\'anello, con Ben', async () => {
      await scenaDi(10, 0.4);
      const v = await pagina.evaluate(() => ({ vista: vistaAttuale, banco: !document.getElementById('did-lab-aurora').classList.contains('hidden') }));
      assert.equal(v.vista, 'didattica');
      assert.ok(v.banco, 'il banco delle aurore è aperto');
      assert.ok(await pixelBen() > 50, 'Ben sopra al vento solare');
      await scenaDi(11, 0.8);
      assert.ok(await pixelBen() > 50, 'e sopra all\'anello');
    });

    // v528: nel decollo la tela del volo copre la 3D, e Ben, disegnato dalla
    // 3D, spariva mentre parlava: ora sta sulla tela sovrapposta
    prova('il decollo: Ben resta sullo schermo sopra al volo, e la 3D non lo ripete', async () => {
      await scenaDi(6, 0.3);
      const r = await pagina.evaluate(() => ({ tela: !!document.getElementById('demo-ospiti-tela'), suTela: StorieCosmiche.stato.ospitiSuTela }));
      assert.ok(r.tela, 'c\'è la tela sovrapposta');
      assert.equal(r.suTela, true, 'le viste sotto non disegnano gli ospiti');
      assert.ok(await pixelBen() > 50, 'Ben è disegnato');
      await scenaDi(7, 0.2);
      assert.equal(await pagina.evaluate(() => StorieCosmiche.stato.ospitiSuTela), false, 'nella 3D Ben torna a disegnarlo la 3D');
    });

    // v528: il telescopio sulla linguetta che lo fa puntare, e il diario
    prova('Stasera, il telescopio sulla linguetta «Punta» (poi com\'era), il diario', async () => {
      const prima = await pagina.evaluate(() => tel.pannello);
      await scenaDi(13, 0.8);
      assert.equal(await pagina.evaluate(() => ({ v: vistaAttuale, p: tel.pannello })).then(x => x.v + '/' + x.p), 'telescopio/punta');
      await scenaDi(14, 0.3);
      assert.equal(await pagina.evaluate(() => vistaAttuale), 'diario');
      assert.equal(await pagina.evaluate(() => tel.pannello), prima, 'la linguetta torna quella di prima');
      // in pausa chi rientra in scena resta trasparente (l'entrata segue
      // l'orologio delle storie): un attimo di marcia, poi si conta
      await pagina.evaluate(() => AstroDemo.riprendi());
      await pagina.waitForTimeout(900);
      assert.ok(await pixelBen() > 50, 'Ben sopra al diario');
      await pagina.evaluate(() => AstroDemo.pausa());
    });

    prova('Cortina: livelli accesi, scritte e ora vera per la scena; poi tutto come prima', async () => {
      // spenti prima, per vedere che la scena li accende e poi li rimette
      await pagina.evaluate(() => { AstroDemo.ferma(); });
      await pagina.waitForTimeout(500);
      await pagina.evaluate(() => { if (cime.acceso) cimeAlterna(); if (AereiADS_B.stato.visibile) aereiImpostaAccesi(false); });
      await pagina.evaluate(t => AstroDemo.avvia(t), testo);
      await scenaDi(2, 0.1);
      const r = await pagina.evaluate(() => ({ cime: cime.acceso, aerei: AereiADS_B.stato.visibile, scritte: !AstroDemo.senzaScritte,
        reale: sky.modalitaTempo, luogo: skyLuogoDelCielo().nome }));
      assert.equal(r.luogo, "Cortina d'Ampezzo");
      assert.ok(r.cime && r.aerei, 'monti e aerei accesi');
      assert.ok(r.scritte, 'le scritte, spente nelle storie, qui servono');
      assert.equal(r.reale, 'reale', 'gli aerei in diretta vogliono l\'ora vera');
      await scenaDi(3, 0.1);
      const d = await pagina.evaluate(() => ({ cime: cime.acceso, aerei: AereiADS_B.stato.visibile, senza: AstroDemo.senzaScritte }));
      assert.equal(d.cime, false, 'finita la scena, i monti tornano spenti');
      assert.equal(d.aerei, false);
      assert.equal(d.senza, true, 'e le scritte di nuovo spente');
    });

    // v528: il paesaggio di Cortina viaggia con l'app (dati-paesaggi-demo.js):
    // qui Open-Meteo non risponde (la rotta lo interrompe) e il terreno di
    // casa resta a metà, eppure a Cortina orizzonte e vette ci sono subito
    prova('Cortina senza rete: il profilo e le vette pronte, coi nomi sul crinale', async () => {
      await pagina.evaluate(() => { AstroDemo.ferma(); });
      await pagina.waitForTimeout(400);
      await pagina.evaluate(t => AstroDemo.avvia(t), testo);
      await pagina.waitForTimeout(800);
      await scenaDi(2, 0.2);
      await pagina.waitForTimeout(800);
      const r = await pagina.evaluate(() => ({ stato: terreno.stato, misurate: terreno.misurate, alto: Math.max(...terreno.profilo),
        vette: cimeVisibili().map(c => c.nome), puntate: cimeVisibili().filter(c => skyPuntaDisegnata(c)).length }));
      assert.equal(r.stato, 'pronto');
      assert.equal(r.misurate, 120, 'il profilo intero');
      assert.ok(r.alto > 15, 'le Tofane salgono sopra i 15°: ' + r.alto.toFixed(1));
      assert.ok(r.vette.includes('Tofana di Mezzo'), 'le vette vere: ' + r.vette.join(', '));
      assert.ok(r.puntate >= 3, 'e i nomi si appendono al crinale disegnato: ' + r.puntate);
      // fuori dalla demo l'elenco corto non vale: si riscarica quello intero
      await pagina.evaluate(() => AstroDemo.ferma());
      await pagina.waitForTimeout(400);
      assert.equal(await pagina.evaluate(() => cimeLeggiSalvate(46.5405, 12.1357)), null, 'l\'elenco della demo non resta a chi visita Cortina');
      await pagina.evaluate(t => AstroDemo.avvia(t), testo);
      await pagina.waitForTimeout(500);
    });

    // v528: a Cortina lo sguardo fa il giro dell'orizzonte, poi va agli aerei
    // e ne apre il fumetto (che aereo è, quota, velocità), visibile anche con
    // la vista pulita; finita la scena il fumetto si chiude
    prova('Cortina: il giro dell\'orizzonte, poi il fumetto di un aereo col suo modello', async () => {
      const az = [];
      for (const f of [0.02, 0.12, 0.22, 0.32]) {
        await scenaDi(2, f);
        az.push(await pagina.evaluate(() => sky.manuale.az));
      }
      const giro = az.slice(1).reduce((t, x, i) => t + ((x - az[i] + 360) % 360), 0);
      assert.ok(giro > 200, 'lo sguardo gira tutt\'attorno: ' + az.map(x => x.toFixed(0)).join(' → '));
      await scenaDi(2, 0.6);
      await pagina.evaluate(() => AstroDemo.riprendi());
      await pagina.waitForFunction(() => document.getElementById('skymap-fumetto').classList.contains('visibile'), null, { timeout: 15000 });
      const r = await pagina.evaluate(() => {
        const f = document.getElementById('skymap-fumetto');
        return { cat: sky.selezione && sky.selezione.categoria, testo: f.textContent, visibile: getComputedStyle(f).visibility };
      });
      await pagina.evaluate(() => AstroDemo.pausa());
      assert.equal(r.cat, 'aereo');
      assert.match(r.testo, /A32[01]|E195|B738/, 'il fumetto dice che aereo è: ' + r.testo.slice(0, 80));
      assert.equal(r.visibile, 'visible', 'la vista pulita non lo nasconde');
      await scenaDi(3, 0.1);
      assert.equal(await pagina.evaluate(() => document.getElementById('skymap-fumetto').classList.contains('visibile')), false, 'finita la scena il fumetto si chiude');
    });

    prova('il finale torna al cielo di casa; lo Stop rimette pagina, mese, filtro e luogo', async () => {
      await scenaDi(15, 0.2);
      assert.equal(await pagina.evaluate(() => skyLuogoDelCielo().nome), 'Milano', 'set_location { home } riporta a casa');
      await pagina.evaluate(() => AstroDemo.ferma());
      await pagina.waitForTimeout(800);
      const r = await pagina.evaluate(() => ({ filtro: filtroCategoria, mese: meseSelezionato, tela: !!document.getElementById('demo-ospiti-tela'),
        classi: ['demo-in-corso', 'demo-vista-pulita', 'demo-pagina-vera'].filter(c => document.body.classList.contains(c)), luogo: skyLuogoDelCielo().nome }));
      assert.equal(r.filtro, 'tutti');
      assert.equal(r.mese, null);
      assert.equal(r.tela, false);
      assert.deepEqual(r.classi, []);
      assert.equal(r.luogo, 'Milano');
    });

    prova('al primo accesso si propone la presentazione (non al browser delle prove, se non la chiede)', async () => {
      assert.equal(await pagina.locator('#benvenuto-demo').count(), 0, 'sotto Playwright non compare da sola');
      await pagina.evaluate(() => localStorage.removeItem(demoBenvenuto.CHIAVE));
      await pagina.evaluate(() => demoBenvenuto.proponi({ forza: true }));
      await pagina.waitForSelector('#benvenuto-demo [data-benvenuto="guarda"]');
      assert.match(await pagina.locator('#benvenuto-demo').textContent(), /Astro Ben/);
      await pagina.click('#benvenuto-demo [data-benvenuto="dopo"]');
      assert.equal(await pagina.locator('#benvenuto-demo').count(), 0);
      assert.equal(JSON.parse(await pagina.evaluate(() => localStorage.getItem(demoBenvenuto.CHIAVE))).come, 'dopo');
      await pagina.evaluate(() => demoBenvenuto.proponi({ forza: true }));
      await pagina.click('#benvenuto-demo [data-benvenuto="guarda"]');
      await pagina.waitForTimeout(600);
      assert.equal(await pagina.evaluate(() => AstroDemo.inCorso), true, '«Guarda la demo» la fa partire');
      assert.equal(await pagina.evaluate(() => document.getElementById('demo-elenco').value), 'presentazione');
      await pagina.evaluate(() => AstroDemo.ferma());
    });

    for (const [nome, fn] of prove) {
      try { await fn(); passate++; console.log('  ok       ' + nome); }
      catch (e) { fallite++; console.log('  FALLITA  ' + nome + '\n           ' + String(e && e.stack || e).split('\n').slice(0, 4).join('\n           ')); }
    }
    if (errori.length) { fallite++; console.log('  FALLITA  errori nella pagina: ' + errori.join(' | ')); }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(`\n${passate} passate, ${fallite} fallite (presentazione)`);
  process.exitCode = fallite ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
