/* Le Storie cosmiche in un Chromium vero.
 *
 *   npm install --no-save playwright-core astronomy-engine satellite.js@5.0.0
 *   node scripts/prova-storie-browser.js
 *
 * Il motore lo prova `prova-storie.js`; qui si guarda quello che solo una
 * pagina vera può dire. Che il volto stia **sull'astro disegnato** (e non
 * dove un'altra proiezione lo metterebbe), nel planetario e nella 3D; che la
 * bocca si muova solo per chi parla e per tutt'e tre le strade del segnale —
 * l'ampiezza di un audio registrato (Web Audio), i confini di una sintesi
 * finta che li manda, e il ritmo del solo testo; che pausa, salto e stop
 * ripuliscano; che un astro fuori quadro non abbia volto; che i volti finiscano
 * nei pixel della tela (e quindi nel filmato); che l'inglese sia inglese; che
 * il telefono tenga i dischi grafici dentro lo schermo; e che tutto questo
 * succeda senza rete. Le schermate vanno in `work/storie-*.png`. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('playwright-core')); }
const radice = path.resolve(__dirname, '..');
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

// Un WAV vero, due secondi e mezzo, con l'ampiezza che sale e scende tre
// volte al secondo: è quello che deve far aprire e chiudere la bocca.
function wavParlato() {
  const sr = 16000, n = Math.round(sr * 2.5), dati = Buffer.alloc(44 + n * 2);
  dati.write('RIFF', 0); dati.writeUInt32LE(36 + n * 2, 4); dati.write('WAVE', 8); dati.write('fmt ', 12);
  dati.writeUInt32LE(16, 16); dati.writeUInt16LE(1, 20); dati.writeUInt16LE(1, 22); dati.writeUInt32LE(sr, 24);
  dati.writeUInt32LE(sr * 2, 28); dati.writeUInt16LE(2, 32); dati.writeUInt16LE(16, 34); dati.write('data', 36);
  dati.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / sr, inviluppo = Math.max(0, Math.sin(Math.PI * 3 * t));
    dati.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 220 * t) * inviluppo * 0.6 * 32767), 44 + i * 2);
  }
  return dati;
}
const WAV = wavParlato();

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/audio/narrazione/demo/it/storia-prova.wav') { res.setHeader('Content-Type', 'audio/wav'); res.end(WAV); return; }
  const file = path.resolve(radice, '.' + decodeURIComponent(url === '/' ? '/index.html' : url));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', tipi[path.extname(file)] || 'application/octet-stream');
  let corpo = fs.readFileSync(file);
  // Il manifest con un audio registrato per la prima battuta del pilota
  if (url === '/audio/narrazione/manifest.js' && process.env.STORIE_AUDIO !== '0')
    corpo = Buffer.from(corpo.toString() + "\n;(function(){var m=globalThis.ASTRO_NARRAZIONE_MANIFEST||window.ASTRO_NARRAZIONE_MANIFEST;" +
      "m.voci['demo.narr.storia_luna.1']={it:'demo/it/storia-prova.wav'};})();");
  res.end(corpo);
});

let verifiche = 0;
function ok(c, m) { assert.ok(c, m); verifiche++; console.log('  ok  ' + m); }

// La sintesi finta: parla «davvero» (start, confini di parola, end) a un
// ritmo da sintesi, così la bocca ha i confini da seguire.
function sintesiFinta() {
  const frasi = [];
  class Frase { constructor(t) { this.text = t; this.lang = ''; } }
  const voce = {
    corrente: null, timer: [],
    getVoices: () => [{ name: 'Finta Neural', lang: 'it-IT', default: true, localService: true }, { name: 'Fake', lang: 'en-US' }],
    addEventListener() {},
    speak(u) {
      voce.cancel(); voce.corrente = u; frasi.push(u.text);
      const parole = [...u.text.matchAll(/\S+/g)];
      voce.timer.push(setTimeout(() => u.onstart && u.onstart(), 20));
      parole.forEach((m, i) => voce.timer.push(setTimeout(() => {
        if (voce.corrente === u && u.onboundary) u.onboundary({ charIndex: m.index, charLength: m[0].length, name: 'word' });
      }, 30 + i * 330)));
      voce.timer.push(setTimeout(() => { if (voce.corrente === u) { voce.corrente = null; u.onend && u.onend(); } }, 60 + parole.length * 330));
    },
    cancel() { voce.timer.forEach(clearTimeout); voce.timer = []; const u = voce.corrente; voce.corrente = null; if (u && u.onerror) u.onerror({ error: 'interrupted' }); }
  };
  Object.defineProperty(window, 'speechSynthesis', { value: voce, configurable: true });
  window.SpeechSynthesisUtterance = Frase;
  window.__frasi = frasi;
}

(async () => {
  let browser;
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    const eseguibile = ['/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
    const opzioni = { args: ['--autoplay-policy=no-user-gesture-required'] };
    browser = await chromium.launch(eseguibile ? Object.assign({ executablePath: eseguibile }, opzioni) : opzioni)
      .catch(() => chromium.launch(opzioni));
    fs.mkdirSync(path.join(radice, 'work'), { recursive: true });

    async function apri({ larghezza = 1100, altezza = 760, lingua = 'it', ridotto = false } = {}) {
      const pagina = await browser.newPage({ viewport: { width: larghezza, height: altezza }, serviceWorkers: 'block',
        reducedMotion: ridotto ? 'reduce' : 'no-preference' });
      const errori = [], esterne = [];
      pagina.on('pageerror', e => errori.push(e.message));
      // Offline: niente esce dalla pagina, tranne le due librerie servite da qui
      await pagina.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith(origine)) return route.continue();
        if (url.includes('astronomy.browser.min.js'))
          return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(require.resolve('astronomy-engine').replace(/astronomy\.js$/, 'astronomy.browser.min.js')) });
        if (url.includes('satellite.min.js'))
          return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(path.dirname(require.resolve('satellite.js/package.json')), 'dist/satellite.min.js')) });
        esterne.push(url);
        return route.abort();
      });
      await pagina.addInitScript(sintesiFinta);
      await pagina.addInitScript(l => {
        localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
        localStorage.setItem('astrocal_lingua', l);
        localStorage.setItem('astrocal_demo_intro_v1', JSON.stringify({ attiva: false }));
        localStorage.setItem('astrocal_demo_opzioni_v1', JSON.stringify({ schermoIntero: false, registra: false, livelli: null }));
      }, lingua);
      await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
      await pagina.waitForFunction(() => typeof AstroDemo !== 'undefined' && typeof StorieCosmiche !== 'undefined' &&
        sky.observer && sky.oggetti.length, null, { timeout: 30000 });
      return { pagina, errori, esterne };
    }
    const fotogrammi = (pagina, n = 3) => pagina.evaluate(n => new Promise(r => {
      let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f);
    }), n);
    const testoStoria = (pagina, chiave) => pagina.evaluate(k => AstroDemo.libreria.elenco().find(d => d.chiave === k).testo, chiave);
    const disegnati = pagina => pagina.evaluate(() => StorieCosmiche.disegnati);
    // Campiona i volti per `ms`, un fotogramma ogni tanto
    const campiona = (pagina, ms) => pagina.evaluate(ms => new Promise(r => {
      const out = []; const fine = performance.now() + ms;
      const f = () => { out.push({ t: performance.now(), d: StorieCosmiche.disegnati, v: narrazione.voce() }); if (performance.now() < fine) requestAnimationFrame(f); else r(out); };
      requestAnimationFrame(f);
    }), ms);

    // ================================================================
    console.log('\n— la sezione della pagina Demo —');
    {
      const { pagina, errori } = await apri();
      await pagina.evaluate(() => mostraVista('demo'));
      // Le storie hanno la loro linguetta (v409)
      await pagina.click('#demo-scheda-storie');
      await fotogrammi(pagina, 4);
      const schede = await pagina.$$eval('#storie-elenco .storia-scheda', s => s.map(x => ({
        titolo: x.querySelector('.storia-titolo').textContent, cast: x.querySelectorAll('.storia-cast li').length,
        tasto: !!x.querySelector('[data-storia-avvia]') })));
      ok(schede.length >= 2 && schede.every(s => s.titolo && s.cast >= 3 && s.tasto), 'le storie hanno scheda, personaggi e tasto');
      ok(/La Luna ha perso un pezzo/.test(schede.map(s => s.titolo).join()), 'c\'è l\'episodio pilota');
      await pagina.evaluate(() => document.getElementById('storie-tela').scrollIntoView());
      await pagina.waitForFunction(() => StorieCosmiche.stato.anteprima, null, { timeout: 5000 });
      await fotogrammi(pagina, 6);
      ok((await disegnati(pagina)).some(d => d.id === 'Moon' && d.vista === 'anteprima'), 'l\'anteprima disegna il volto scelto');
      await pagina.selectOption('#storie-espressione', 'surprised');
      await fotogrammi(pagina, 3);
      ok((await disegnati(pagina))[0].espressione === 'surprised', 'l\'espressione dell\'anteprima segue la scelta');
      await pagina.click('#storie-parla');
      await pagina.waitForFunction(() => StorieCosmiche.parlante === 'Moon' && narrazione.voce().parla, null, { timeout: 5000 });
      const prova = await campiona(pagina, 1200);
      ok(prova.some(c => c.d[0] && c.d[0].parla && c.d[0].apertura > 0.1), 'nell\'anteprima il personaggio parla e muove la bocca');
      ok(await pagina.$eval('#storie-tela', t => getComputedStyle(t).pointerEvents === 'none'), 'la tela decorativa non prende i tocchi');
      await pagina.evaluate(() => mostraVista('stasera'));
      await fotogrammi(pagina, 3);
      ok(await pagina.evaluate(() => !StorieCosmiche.stato.anteprima && StorieCosmiche.attivi === 0), 'uscendo dalla pagina l\'anteprima si spegne');
      ok(!errori.length, 'nessun errore di pagina: ' + errori.join(' | '));
      await pagina.close();
    }

    // ================================================================
    console.log('\n— l\'episodio pilota —');
    {
      const { pagina, errori, esterne } = await apri();
      const testo = await testoStoria(pagina, 'storia_luna');
      await pagina.evaluate(t => { narrazione.preparaAnalisi(); AstroDemo.avvia(t); }, testo);
      await pagina.waitForTimeout(600);
      // Scena 1: la Luna sulla sua falce, nel planetario, con l'audio registrato
      const s1 = await campiona(pagina, 1800);
      const luna = s1.map(c => c.d.find(d => d.id === 'Moon')).filter(Boolean);
      ok(luna.length > 10 && luna.every(d => d.vista === 'cielo'), 'la Luna ha il volto nel planetario');
      const astro = await pagina.evaluate(() => { const o = sky.oggetti.find(x => x.id === 'Moon'); const p = skyProietta(skyVettore(o.az, o.alt), sky.ultimaBase, sky.ultimaFocale); return p; });
      const ultimo = luna[luna.length - 1];
      ok(Math.hypot(ultimo.astro.x - astro.px, ultimo.astro.y - astro.py) < 2.5, 'il volto sta sulla Luna disegnata, con la stessa proiezione');
      // A metà dello zoom la Luna è ancora piccola: il volto sta nel disco
      // grafico accanto. Il corpo non cresce mai.
      ok(ultimo.addosso ? ultimo.R <= ultimo.astro.r : ultimo.astro.r * 0.8 < 22,
        'il volto sta sul disco quando c\'è posto, se no accanto: la Luna non si ingrandisce');
      ok(s1.some(c => c.v.fase === 'audio' && typeof c.v.livello === 'number'), 'l\'audio registrato passa dal grafo Web Audio');
      const viaAmpiezza = luna.filter(d => d.parla && d.via === 'ampiezza');
      ok(viaAmpiezza.length > 5, 'la bocca segue l\'ampiezza dell\'audio');
      const aperture = viaAmpiezza.map(d => d.apertura);
      ok(Math.max(...aperture) > 0.6 && Math.min(...aperture) < 0.15, 'si apre sulle sillabe forti e si chiude fra l\'una e l\'altra');
      ok(await pagina.$eval('#demo-sottotitoli .narrazione-chi', e => e.textContent.trim() === 'Luna'), 'il sottotitolo dice il nome di chi parla');
      ok(await pagina.evaluate(() => StorieCosmiche.profilo('Moon').espressione) && luna[0].espressione === 'worried', 'la Luna è preoccupata');
      await pagina.screenshot({ path: path.join(radice, 'work/storie-1.png') });

      // Pausa: la voce si ferma, la bocca si chiude, le palpebre si fermano
      await pagina.evaluate(() => AstroDemo.pausa());
      await fotogrammi(pagina, 4);
      const orologio = await pagina.evaluate(() => StorieCosmiche.stato.orologio);
      const inPausa = await campiona(pagina, 600);
      ok(inPausa.every(c => c.d.every(d => !d.parla && d.apertura === 0)), 'in pausa nessuna bocca si muove');
      ok(await pagina.evaluate(o => StorieCosmiche.stato.orologio === o, orologio), 'in pausa l\'orologio della storia è fermo');
      // Fuori quadro: la camera si gira dall'altra parte e il volto se ne va
      await pagina.evaluate(() => { const o = sky.oggetti.find(x => x.id === 'Moon'); sky.target = null; sky.inseguimento = false;
        sky.manuale.az = (o.az + 180) % 360; sky.manuale.alt = 30; });
      await fotogrammi(pagina, 4);
      ok(!(await disegnati(pagina)).some(d => d.id === 'Moon'), 'una Luna fuori quadro non ha volto');
      await pagina.evaluate(() => { const o = sky.oggetti.find(x => x.id === 'Moon'); sky.manuale.az = o.az; sky.manuale.alt = o.alt; });
      await fotogrammi(pagina, 4);
      // I pixel: il volto è sulla tela (quindi nel filmato), e se ne va con lui
      const pixel = await pagina.evaluate(() => {
        const d = StorieCosmiche.disegnati.find(x => x.id === 'Moon');
        const ctx = sky.canvas.getContext('2d'), dpr = sky.canvas.width / sky.larghezza;
        const leggi = () => Array.from(ctx.getImageData(Math.round((d.x - d.R) * dpr), Math.round((d.y - d.R) * dpr),
          Math.round(d.R * 2 * dpr), Math.round(d.R * 2 * dpr)).data);
        // il filmato: il registratore prende la tela quando il fotogramma è finito
        let nelFilmato = null;
        const vera = window.skyRegComponi;
        window.skyRegComponi = () => { nelFilmato = leggi(); };
        sky.reg.attiva = true; sky.reg.avvio = performance.now(); sky.reg.durataSec = 60;
        skyDisegna();
        sky.reg.attiva = false; window.skyRegComponi = vera;
        const con = leggi();
        const salvati = new Map(StorieCosmiche.stato.personaggi);
        StorieCosmiche.stato.personaggi.clear();
        skyDisegna();
        const senza = leggi();
        for (const [k, v] of salvati) StorieCosmiche.stato.personaggi.set(k, v);
        skyDisegna();
        let diversi = 0, bianchi = 0, nelFilm = 0;
        for (let i = 0; i < con.length; i += 4) {
          if (Math.abs(con[i] - senza[i]) + Math.abs(con[i + 1] - senza[i + 1]) + Math.abs(con[i + 2] - senza[i + 2]) > 60) diversi++;
          if (con[i] > 235 && con[i + 1] > 235 && con[i + 2] > 235) bianchi++;
          if (nelFilmato && Math.abs(nelFilmato[i] - con[i]) < 4) nelFilm++;
        }
        return { diversi, bianchi, totale: con.length / 4, nelFilm };
      });
      ok(pixel.diversi > pixel.totale * 0.03, `il volto cambia i pixel della tela (${pixel.diversi} su ${pixel.totale})`);
      ok(pixel.bianchi > 20, 'si vedono il bianco degli occhi e i riflessi');
      ok(pixel.nelFilm > pixel.totale * 0.95, 'lo stesso volto arriva al registratore del filmato');
      await pagina.evaluate(() => AstroDemo.riprendi());
      // Scena 2, a campo fermo di 2,6°: la Luna è abbastanza grande da avere il volto addosso
      await pagina.evaluate(() => AstroDemo.vaiAScena(1, 0.3));
      await fotogrammi(pagina, 6);
      const addosso = (await disegnati(pagina)).find(d => d.id === 'Moon');
      ok(addosso && addosso.addosso && addosso.R <= addosso.astro.r, 'ingrandita, la Luna ha il volto sulla sua falce');

      // Il dialogo nella 3D: la Terra parla (sintesi finta coi confini), la Luna la guarda
      await pagina.evaluate(() => AstroDemo.vaiAScena(3, 0));
      await pagina.waitForTimeout(500);
      const s4 = await campiona(pagina, 2200);
      const vicino = s4.filter(c => c.d.length >= 2);
      ok(vicino.length > 10 && vicino.every(c => c.d.every(d => d.vista === 'vicino')), 'Terra e Luna hanno il volto nel banco Terra e Luna');
      const terra = vicino.map(c => c.d.find(d => d.id === 'Earth'));
      const lunaAscolta = vicino.map(c => c.d.find(d => d.id === 'Moon'));
      // Dalla v408 la battuta ha anche l'audio registrato (audio/narrazione/demo/it/storia_luna-4.mp3):
      // dove c'è, la bocca segue l'ampiezza del file; dove manca, i confini della sintesi.
      ok(terra.some(d => d.parla && (d.via === 'confini' || d.via === 'ampiezza') && d.apertura > 0.1),
        'la Terra parla e la bocca segue la voce (ampiezza del file o confini della sintesi)');
      ok(lunaAscolta.every(d => !d.parla && d.apertura === 0), 'la Luna tiene la bocca chiusa');
      const versoTerra = lunaAscolta.filter((d, i) => {
        const t = terra[i]; const dx = t.x - d.x, dy = t.y - d.y, n = Math.hypot(dx, dy);
        return n > 0 && (d.sguardo.x * dx + d.sguardo.y * dy) / n > 0.3;
      });
      ok(versoTerra.length > vicino.length * 0.6, 'e guarda la Terra mentre parla');
      ok(await pagina.evaluate(() => {
        const d = StorieCosmiche.disegnati.find(x => x.id === 'Moon');
        const v = sol.vicCorpi.find(c => c.id === 'Moon');
        return Math.hypot(d.astro.x - v.schermo.px, d.astro.y - v.schermo.py) < 1;
      }), 'il volto (o il suo filo) è attaccato alla Luna dove la 3D l\'ha proiettata');
      ok(await pagina.$eval('#demo-sottotitoli .narrazione-chi', e => e.textContent.trim() === 'Terra'), 'il sottotitolo passa alla Terra');
      // Con l'audio registrato (v408) le battute non passano più dalla sintesi finta
      ok(await pagina.evaluate(() => window.__frasi.length >= 1 || !!narrVoceManifest('demo.narr.storia_luna.4', 'it')),
        'una sola voce: le battute arrivano alla sintesi finta, o all\'audio registrato');
      await pagina.screenshot({ path: path.join(radice, 'work/storie-4.png') });

      // Salto: i personaggi della scena d'arrivo, e solo loro
      await pagina.evaluate(() => AstroDemo.vaiAScena(5, 0.2));
      await pagina.waitForTimeout(500);
      await fotogrammi(pagina, 4);
      ok(await pagina.evaluate(() => [...StorieCosmiche.stato.personaggi.keys()].sort().join()) === 'Earth,Moon,Sun', 'salto: il cast della scena del Sole');
      ok(await pagina.evaluate(() => StorieCosmiche.parlante === 'Sun'), 'parla il Sole');
      await pagina.screenshot({ path: path.join(radice, 'work/storie-6.png') });
      await pagina.evaluate(() => AstroDemo.vaiAScena(0, 0.1));
      await pagina.waitForTimeout(400);
      ok(await pagina.evaluate(() => [...StorieCosmiche.stato.personaggi.keys()].join()) === 'Moon', 'riavvio: di nuovo la sola Luna');
      // Il 3D si ripulisce: alla scena del planetario la finestra è chiusa
      ok(await pagina.evaluate(() => !sol.aperto), 'tornando al planetario la 3D è chiusa');

      // Stop: niente volti, niente voce, niente sottotitolo
      await pagina.evaluate(() => AstroDemo.ferma());
      await fotogrammi(pagina, 3);
      ok(await pagina.evaluate(() => StorieCosmiche.attivi === 0 && StorieCosmiche.parlante === null && !narrazione.stato()),
        'stop: nessun personaggio, nessuna voce');
      ok(await pagina.evaluate(() => { const s = document.querySelector('.narrazione-testo'); return !s || s.hidden; }), 'stop: il sottotitolo se ne va');
      ok(await pagina.evaluate(() => StorieCosmiche.disegnati.length === 0 || (skyDisegna(), StorieCosmiche.disegnati.length === 0)),
        'fuori dalla storia il planetario non disegna volti');
      ok(!errori.length, 'nessun errore di pagina: ' + errori.join(' | '));
      ok(esterne.every(u => !/storie|narrazione|demo/i.test(u)), 'offline: nessuna richiesta esterna serve alle storie');
      await pagina.close();
    }

    // ================================================================
    console.log('\n— senza voce: il ritmo del testo —');
    {
      const { pagina, errori } = await apri();
      await pagina.evaluate(() => narrazione.impostaPreferenze({ attiva: false }));
      const testo = await testoStoria(pagina, 'storia_luna');
      await pagina.evaluate(t => { AstroDemo.avvia(t); AstroDemo.vaiAScena(1, 0); }, testo);
      await pagina.waitForTimeout(300);
      const s = await campiona(pagina, 2000);
      const luna = s.map(c => c.d.find(d => d.id === 'Moon')).filter(Boolean);
      ok(s.every(c => c.v.fase === 'testo' || !c.v.parla), 'narrazione spenta: nessuna voce, solo il testo');
      ok(luna.some(d => d.parla && d.via === 'ritmo' && d.apertura > 0.2) && luna.some(d => d.apertura === 0),
        'la bocca va al ritmo del testo, con le pause');
      ok(await pagina.$eval('#demo-sottotitoli .narrazione-chi', e => e.textContent.trim() === 'Luna'), 'e il sottotitolo col nome resta');
      await pagina.evaluate(() => AstroDemo.ferma());
      await pagina.evaluate(() => narrazione.impostaPreferenze({ attiva: true }));
      ok(!errori.length, 'nessun errore di pagina: ' + errori.join(' | '));
      await pagina.close();
    }

    // ================================================================
    console.log('\n— in inglese —');
    {
      const { pagina, errori } = await apri({ lingua: 'en' });
      const testo = await testoStoria(pagina, 'storia_luna');
      await pagina.evaluate(t => AstroDemo.avvia(t), testo);
      await pagina.waitForTimeout(700);
      const sub = await pagina.$eval('#demo-sottotitoli', e => ({ chi: e.querySelector('.narrazione-chi').textContent, frase: e.querySelector('.narrazione-frase').textContent }));
      ok(sub.chi === 'Moon' && /piece of me is missing/.test(sub.frase), 'il nome e la battuta sono in inglese');
      await pagina.evaluate(() => AstroDemo.vaiAScena(1, 0));
      await pagina.waitForTimeout(300);
      ok(await pagina.evaluate(() => window.__frasi.some(f => /Where did it go/.test(f))), 'la sintesi dice la battuta inglese');
      await pagina.evaluate(() => AstroDemo.ferma());
      ok(!errori.length, 'nessun errore di pagina: ' + errori.join(' | '));
      await pagina.close();
    }

    // ================================================================
    console.log('\n— sul telefono, e col movimento ridotto —');
    {
      const { pagina, errori } = await apri({ larghezza: 360, altezza: 640, ridotto: true });
      ok(await pagina.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'movimento ridotto attivo');
      const testo = await testoStoria(pagina, 'storia_giganti');
      await pagina.evaluate(t => AstroDemo.avvia(t), testo);
      await pagina.waitForTimeout(700);
      await fotogrammi(pagina, 4);
      const d = await disegnati(pagina);
      ok(d.length >= 2 && d.every(x => x.vista === 'sistema'), 'Giove e Saturno hanno il volto nella vista 3D');
      const L = await pagina.evaluate(() => sol.L), H = await pagina.evaluate(() => sol.H);
      ok(d.every(x => x.x - x.R >= 0 && x.x + x.R <= L && x.y - x.R >= 0 && x.y + x.R <= H), 'i volti stanno dentro lo schermo del telefono');
      ok(d.filter(x => !x.addosso).every(x => x.R >= 28), 'i dischi grafici restano leggibili (almeno 28 px)');
      ok(await pagina.evaluate(() => StorieCosmiche.stato.ridotto), 'il modulo sa del movimento ridotto');
      const piani = await pagina.evaluate(() => sol.pianeti.filter(p => ['Jupiter', 'Saturn'].includes(p.id)).map(p => ({ id: p.id, r: p.rDisegno, x: p.schermo.px, y: p.schermo.py })));
      for (const p of piani) {
        const v = d.find(x => x.id === p.id);
        if (v) ok(Math.abs(v.astro.r - p.r) < 1e-6 && Math.hypot(v.astro.x - p.x, v.astro.y - p.y) < 1, `${p.id}: il corpo resta della sua misura, il volto lo indica`);
      }
      await pagina.screenshot({ path: path.join(radice, 'work/storie-telefono.png') });
      await pagina.evaluate(() => AstroDemo.ferma());
      ok(!errori.length, 'nessun errore di pagina: ' + errori.join(' | '));
      await pagina.close();
    }

    // ================================================================
    console.log('\n— nella scala cosmica (v412) —');
    {
      const { pagina, errori } = await apri();
      // La storia dello Studio «Quanto è grande l'universo?»: i personaggi
      // al loro posto vero sulla carta, e chi è fuori dal quadro sul bordo
      await pagina.evaluate(() => AstroDemo.avvia(StudioStorie.copione(StudioStorie.daModello('universo'))));
      await pagina.waitForFunction(() => typeof cosm !== 'undefined' && cosm.attivo && StorieCosmiche.disegnati.length >= 2, null, { timeout: 10000 });
      // in pausa la camera sta ferma: si confronta lo stesso fotogramma
      await pagina.evaluate(() => AstroDemo.pausa());
      await fotogrammi(pagina, 4);
      const d = await disegnati(pagina);
      ok(d.every(x => x.vista === 'cosmo'), 'i volti si disegnano sulla carta della scala cosmica');
      const terra = d.find(x => x.id === 'Earth'), voy = d.find(x => x.id === 'voyager1');
      ok(terra && voy && voy.corpo === 'voyager', 'la Terra e la Voyager, col suo corpo di sonda');
      // la Terra è dove la carta la disegna (stessa proiezione)
      const vero = await pagina.evaluate(() => { const q = cosm.cam.p(cosmDove('Earth')); return { x: q.x, y: q.y }; });
      ok(Math.hypot(terra.astro.x - vero.x, terra.astro.y - vero.y) < 1.5, 'la Terra sta al suo posto vero sulla carta');
      ok(voy.fuori, 'alla scala della Luna la Voyager è fuori dal quadro: sul bordo, con la freccia');
      const pixel = await pagina.evaluate(() => {
        const c = sol.canvas.getContext('2d'), dpr = sol.canvas.width / sol.L;
        const t = StorieCosmiche.disegnati.find(x => x.id === 'Earth');
        const px = c.getImageData(Math.round(t.x * dpr) - 4, Math.round(t.y * dpr) - 4, 8, 8).data;
        let n = 0; for (let i = 0; i < px.length; i += 4) n += px[i] + px[i + 1] + px[i + 2];
        return n;
      });
      ok(pixel > 2000, 'il volto finisce nei pixel della tela (e quindi nel filmato)');
      // più avanti la camera è alla scala della Via Lattea, e lei c'è
      await pagina.evaluate(() => { AstroDemo.riprendi(); AstroDemo.vaiAScena(5, 0.5); });
      await pagina.waitForFunction(() => StorieCosmiche.disegnati.some(x => x.id === 'milky_way'), null, { timeout: 10000 });
      ok((await disegnati(pagina)).find(x => x.id === 'milky_way').corpo === 'galassia', 'la Via Lattea, a spirale, nella sua scena');
      await pagina.evaluate(() => AstroDemo.ferma());
      await fotogrammi(pagina, 3);
      ok(await pagina.evaluate(() => StorieCosmiche.attivi === 0), 'fermata la storia, la carta resta senza volti');
      ok(!errori.length, 'nessun errore di pagina: ' + errori.join(' | '));
      await pagina.close();
    }

    console.log('\n— le altre demo non cambiano —');
    {
      const { pagina, errori } = await apri();
      const esito = await pagina.evaluate(() => {
        const altre = AstroDemo.libreria.elenco().filter(d => !d.storia);
        for (const d of altre) AstroDemo.valida(d.testo);
        return { n: altre.length, conVolti: altre.filter(d => /character_/.test(d.testo)).length };
      });
      ok(esito.n >= 8 && esito.conVolti === 0, `le ${esito.n} demo di prima si validano e non hanno personaggi`);
      await pagina.evaluate(() => { const d = AstroDemo.libreria.elenco().find(x => x.chiave === 'allineamento_pianeti'); AstroDemo.avvia(d.testo); });
      await pagina.waitForTimeout(800);
      await fotogrammi(pagina, 4);
      ok(await pagina.evaluate(() => StorieCosmiche.attivi === 0 && StorieCosmiche.disegnati.length === 0), 'in una demo normale nessun volto');
      await pagina.evaluate(() => AstroDemo.ferma());
      ok(!errori.length, 'nessun errore di pagina: ' + errori.join(' | '));
      await pagina.close();
    }

    console.log('\n— il cartello: la data e il luogo solo se chiesti (v414) —');
    {
      const { pagina, errori } = await apri();
      const cartello = async righe => {
        await pagina.evaluate(r => AstroDemo.avvia(`define_demo 'cartello' {
  scene planetarium_view { duration: 20s; action: set_date { iso: '2026-12-13T21:00:00Z' }; action: date_card { ${r} }; }
}`), righe);
        await pagina.waitForTimeout(400);
        const testo = await pagina.evaluate(() => { const c = document.getElementById('demo-cartello'); return c && !c.hidden ? c.innerText : ''; });
        await pagina.evaluate(() => AstroDemo.ferma());
        return testo;
      };
      const solo = await cartello("label: 'demo.cartello.storia_stelle.sole'");
      ok(/4,6 miliardi/i.test(solo) && !/2026/.test(solo) && !/Milano/.test(solo), 'di serie il cartello dice solo la sua scritta: ' + JSON.stringify(solo));
      const tutto = await cartello("label: 'demo.cartello.storia_stelle.sole', date: show, time: show, place: show");
      ok(/13 dicembre 2026/i.test(tutto) && /Milano/.test(tutto) && /\d{1,2}:\d{2}/.test(tutto), 'con date, time e place il cartello dice data, ora e luogo: ' + JSON.stringify(tutto));
      const luogo = await cartello("text: 'Qui', place: show");
      ok(/Milano/.test(luogo) && !/:/.test(luogo) && !/2026/.test(luogo), 'il luogo da solo, senza ora né data: ' + JSON.stringify(luogo));
      ok(!errori.length, 'nessun errore di pagina: ' + errori.join(' | '));
      await pagina.close();
    }

    // ================================================================
    console.log('\n— la regia e i rumori (v416) —');
    {
      const { pagina, errori } = await apri();
      await pagina.evaluate(() => AstroDemo.avvia(`define_demo 'regia' {
  scene planetarium_view { duration: 1s; action: set_date { iso: '2026-12-13T21:00:00Z' }; }
  scene solar_system_3d { duration: 14s;
    action: camera_3d { scene: system, focus: 'Sun', frame: 'Earth,Mars,Jupiter' };
    action: character_show { target: 'Jupiter', expression: 'happy' };
    action: character_show { target: 'Mars' };
    action: character_speak { target: 'Jupiter', text: 'Ciao bambini! Sono Giove, il più grande di tutti i pianeti, e oggi vi racconto una storia bellissima.' };
    action: effect { type: explosion, target: 'Mars', shot_from: 0.55 };
  }
}`));
      await pagina.waitForFunction(() => sol.aperto && StorieCosmiche.parlante === 'Jupiter' && StorieCosmiche.regia.k > 1.5, null, { timeout: 15000 });
      await pagina.waitForTimeout(1500);
      const r = await pagina.evaluate(() => StorieCosmiche.regia);
      ok(['parla', 'dialogo'].includes(r.motivo) && r.k > 1.5 && r.vista === 'sistema', `chi parla è in primo piano: ${r.motivo}, ×${r.k.toFixed(2)}`);
      // Nei pixel veri della tela: dove la lente porta il volto di Giove ci
      // sono il bianco degli occhi e l'inchiostro
      const pixel = await pagina.evaluate(() => {
        const d = StorieCosmiche.stato.ultimiDisegnati.find(x => x.id === 'Jupiter');
        const g = d.geom, occ = g.occhi[0];
        const a = StorieCosmiche.lenteSchermo(occ.cx - occ.rx, occ.cy - occ.ry), b = StorieCosmiche.lenteSchermo(occ.cx + occ.rx, occ.cy + occ.ry);
        const dpr = sol.ctx.canvas.width / sol.L;
        const x0 = Math.round(a.x * dpr), y0 = Math.round(a.y * dpr), w = Math.max(2, Math.round((b.x - a.x) * dpr)), h = Math.max(2, Math.round((b.y - a.y) * dpr));
        const dati = sol.ctx.getImageData(x0, y0, w, h).data;
        let bianchi = 0, scuri = 0;
        for (let i = 0; i < dati.length; i += 4) {
          const l = (dati[i] + dati[i + 1] + dati[i + 2]) / 3;
          if (l > 215) bianchi++; if (l < 60) scuri++;
        }
        const occhiSchermo = StorieCosmiche.lenteSchermo((g.occhi[0].cx + g.occhi[1].cx) / 2, (g.occhi[0].cy + g.occhi[1].cy) / 2);
        return { bianchi, scuri, tot: dati.length / 4, w: w / dpr, occhi: occhiSchermo, L: sol.L, H: sol.H };
      });
      ok(pixel.bianchi > pixel.tot * 0.08 && pixel.scuri > 3, `l'occhio ingrandito è nei pixel: ${pixel.bianchi} chiari e ${pixel.scuri} scuri su ${pixel.tot}`);
      ok(pixel.w > 14, 'un occhio largo ' + pixel.w.toFixed(1) + ' px sullo schermo');
      ok(pixel.occhi.x > 0 && pixel.occhi.x < pixel.L && pixel.occhi.y > 0 && pixel.occhi.y < pixel.H * 0.68,
        `gli occhi stanno nel quadro, sopra ai sottotitoli: ${pixel.occhi.x.toFixed(0)}, ${pixel.occhi.y.toFixed(0)}`);
      await pagina.screenshot({ path: path.join(radice, 'work/storie-regia-parla.png') });
      // Il botto: la camera va a guardarlo
      await pagina.evaluate(() => AstroDemo.vaiAScena(1, 0.54));
      await pagina.waitForFunction(() => StorieCosmiche.regia.motivo === 'effetto', null, { timeout: 8000 });
      await pagina.waitForTimeout(450);
      ok(await pagina.evaluate(() => StorieCosmiche.regia.k > 1.2), 'il botto è inquadrato da vicino');
      await pagina.screenshot({ path: path.join(radice, 'work/storie-regia-botto.png') });
      // La persona prende la camera: la lente si toglie
      await pagina.evaluate(() => AstroDemo.vaiAScena(1, 0.1));
      await pagina.mouse.move(500, 300); await pagina.mouse.down(); await pagina.mouse.move(560, 330, { steps: 4 }); await pagina.mouse.up();
      await pagina.waitForTimeout(1800);
      ok(await pagina.evaluate(() => AstroDemo.cameraManuale && StorieCosmiche.regia.k < 1.05), 'la camera presa a mano: la regia le lascia il quadro');
      await pagina.evaluate(() => AstroDemo.ferma());
      await fotogrammi(pagina, 3);
      ok(await pagina.evaluate(() => StorieCosmiche.regia.k === 1 && StorieCosmiche.attivi === 0), 'finita la storia, niente lente');
      // I rumori, resi davvero da un contesto audio fuori linea
      const suoni = await pagina.evaluate(async () => {
        const out = {};
        for (const nome of StorieCosmiche.STOR_SUONI) {
          const a = new OfflineAudioContext(1, 22050 * 4, 22050);
          const ok = StorieCosmiche.suona(nome, { contesto: a, uscita: a.destination, forza: true });
          const b = await a.startRendering();
          const c = b.getChannelData(0);
          let somma = 0, picco = 0;
          for (let i = 0; i < c.length; i++) { somma += c[i] * c[i]; picco = Math.max(picco, Math.abs(c[i])); }
          out[nome] = { ok, rms: Math.sqrt(somma / c.length), picco };
        }
        return out;
      });
      const muti = Object.entries(suoni).filter(([, s]) => !s.ok || !(s.rms > 0.002)).map(([n]) => n);
      ok(!muti.length, 'ogni rumore suona davvero: ' + (muti.join(', ') || Object.keys(suoni).length + ' rumori'));
      const forti = Object.entries(suoni).filter(([, s]) => s.picco > 1.5).map(([n, s]) => n + ' ' + s.picco.toFixed(2));
      ok(!forti.length, 'nessun rumore esagera: ' + (forti.join(', ') || 'tutti sotto 1,5'));
      ok(!errori.length, 'nessun errore di pagina: ' + errori.join(' | '));
      await pagina.close();
    }

    console.log(`\nStorie cosmiche nel browser: ${verifiche} verifiche superate`);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
