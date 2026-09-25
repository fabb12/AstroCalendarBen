#!/usr/bin/env node
/* La pagina Demo, il menu raggruppato e il comportamento della demo in corso.
 *
 *   npm install --no-save playwright astronomy-engine
 *   node scripts/prova-demo-pagina.js
 *
 * Le domande sono quelle che a occhio non si giudicano: un comando che
 * compare fuori dalla demo, un'icona che non si disegna, un tocco che ferma
 * la regia, un pieno schermo che lampeggia fra una vista e l'altra, una
 * musica che non torna com'era, un sottotitolo che sparisce a metà frase. */
'use strict';
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const radice = path.resolve(__dirname, '..');
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.resolve(radice, '.' + (url === '/' ? '/index.html' : url));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader('Content-Type', tipi[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

let passate = 0;
async function prova(nome, fn) {
  try { await fn(); passate++; console.log('  ok       ' + nome); }
  catch (e) { console.log('  FALLITA  ' + nome); throw e; }
}

(async () => {
  let browser;
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const pagina = await browser.newPage({ viewport: { width: 1200, height: 820 }, serviceWorkers: 'block' });
    const errori = [];
    pagina.on('pageerror', e => errori.push(e.message));
    await pagina.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(origine)) return route.continue();
      if (url.includes('astronomy.browser.min.js'))
        return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(require.resolve('astronomy-engine').replace(/astronomy\.js$/, 'astronomy.browser.min.js')) });
      return route.abort();
    });
    await pagina.addInitScript(() => {
      localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
      localStorage.setItem('astrocal_lingua', 'it');
      // La sintesi del dispositivo, finta: un Chromium senza testa non ha voci.
      const detti = [];
      window.__detti = detti;
      window.speechSynthesis.speak = u => {
        detti.push(u.text);
        setTimeout(() => { if (u.onstart) u.onstart(); }, 5);
        // Una frase lunga: dura più del ritiro dei comandi (sei secondi).
        setTimeout(() => { if (u.onend) u.onend(); }, 9000);
      };
      window.speechSynthesis.cancel = () => {};
      window.speechSynthesis.getVoices = () => [{ lang: 'it-IT', name: 'Finta', localService: true }];
    });
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => typeof AstroDemo !== 'undefined' && typeof sky !== 'undefined' &&
      sky.observer && sky.oggetti.length, null, { timeout: 30000 });

    console.log('\n— il menu —');
    await prova('Mese, Agenda e Diario stanno sotto una voce sola; Demo è una voce principale', async () => {
      const voci = await pagina.evaluate(() => [...document.querySelectorAll('.nav-principale .voce-menu')].map(b => b.id));
      assert.deepEqual(voci, ['btn-vista-stasera', 'btn-vista-gruppo-calendario', 'btn-vista-skymap',
        'btn-vista-telescopio', 'btn-vista-didattica', 'btn-vista-demo']);
      for (const id of ['btn-vista-calendario', 'btn-vista-agenda', 'btn-vista-diario'])
        assert.equal(await pagina.locator('#sottonav-calendario #' + id).count(), 1, id);
    });
    await prova('la voce Calendario apre il gruppo e la sottosezione attiva si vede', async () => {
      assert.equal(await pagina.locator('#sottonav-calendario').isVisible(), false, 'fuori dal gruppo la barra non c\'è');
      await pagina.locator('#btn-vista-gruppo-calendario').click();
      assert.equal(await pagina.evaluate(() => vistaAttuale), 'calendario');
      assert.equal(await pagina.locator('#sottonav-calendario').isVisible(), true);
      await pagina.locator('#btn-vista-agenda').click();
      const s = await pagina.evaluate(() => ({
        vista: vistaAttuale,
        gruppo: document.getElementById('btn-vista-gruppo-calendario').classList.contains('attiva'),
        corrente: document.getElementById('btn-vista-gruppo-calendario').getAttribute('aria-current'),
        selezionate: [...document.querySelectorAll('#sottonav-calendario [role="tab"]')].map(b => b.getAttribute('aria-selected'))
      }));
      assert.deepEqual(s, { vista: 'agenda', gruppo: true, corrente: 'page', selezionate: ['false', 'true', 'false'] });
    });
    await prova('le frecce scorrono le sottosezioni, e la voce ricorda l\'ultima', async () => {
      await pagina.locator('#btn-vista-agenda').focus();
      await pagina.keyboard.press('ArrowRight');
      assert.equal(await pagina.evaluate(() => vistaAttuale), 'diario');
      assert.equal(await pagina.evaluate(() => document.activeElement.id), 'btn-vista-diario');
      await pagina.locator('#btn-vista-stasera').click();
      assert.equal(await pagina.locator('#sottonav-calendario').isVisible(), false);
      await pagina.locator('#btn-vista-gruppo-calendario').click();
      assert.equal(await pagina.evaluate(() => vistaAttuale), 'diario');
    });
    await prova('su un telefono il menu ha sei voci e nessuna sborda', async () => {
      await pagina.setViewportSize({ width: 360, height: 740 });
      const m = await pagina.evaluate(() => {
        const nav = document.querySelector('.nav-principale');
        return { sborda: nav.scrollWidth > nav.clientWidth + 1, largo: window.innerWidth,
          attive: [...nav.querySelectorAll('.voce-menu.attiva')].length,
          barra: document.getElementById('sottonav-calendario').getBoundingClientRect().width };
      });
      assert.ok(!m.sborda && m.largo === 360 && m.attive === 1 && m.barra <= 360, JSON.stringify(m));
      await pagina.setViewportSize({ width: 1200, height: 820 });
    });

    console.log('\n— la pagina Demo —');
    await prova('le opzioni delle demo non sono più nelle Impostazioni né in Osservazione', async () => {
      assert.equal(await pagina.locator('#imp-tab-btn-demo, #imp-tab-demo').count(), 0);
      const dentro = await pagina.evaluate(() => {
        const m = document.getElementById('modale-impostazioni');
        return ['demo-avvia', 'demo-elenco', 'demo-opz-schermo', 'demo-opz-vista-pulita', 'demo-opz-registra',
          'demo-opz-registra-audio', 'demo-opz-musica-traccia', 'demo-livelli', 'imp-narrazione-attiva', 'imp-narrazione-volume',
          'imp-narrazione-testo', 'imp-narrazione-solo-tts'].filter(id => m.querySelector('#' + id));
      });
      assert.deepEqual(dentro, []);
      // Nessun id duplicato fra la pagina e il resto del documento.
      const doppi = await pagina.evaluate(() => {
        const visti = new Map();
        document.querySelectorAll('[id]').forEach(el => visti.set(el.id, (visti.get(el.id) || 0) + 1));
        return [...visti].filter(([, n]) => n > 1).map(([id]) => id);
      });
      assert.deepEqual(doppi, []);
    });
    await prova('la pagina ha i cinque gruppi, nell\'ordine, e un\'azione principale', async () => {
      await pagina.locator('#btn-vista-demo').click();
      const p = await pagina.evaluate(() => {
        const v = document.getElementById('vista-demo');
        const titoli = [...v.querySelectorAll('.demo-gruppo-titolo')].map(t => t.textContent.replace(/\s+/g, ' ').trim());
        const gruppoDi = id => { const el = document.getElementById(id); const g = el && el.closest('.demo-gruppo');
          return g ? g.querySelector('.demo-gruppo-titolo').textContent.replace(/\s+/g, ' ').trim() : null; };
        const avvia = document.getElementById('demo-avvia').getBoundingClientRect();
        const secondario = document.getElementById('demo-duplica').getBoundingClientRect();
        return { titoli, h2: v.querySelector('h2').textContent.trim(),
          avvia: gruppoDi('demo-avvia'), schermo: gruppoDi('demo-opz-schermo'), pulita: gruppoDi('demo-opz-vista-pulita'),
          narr: gruppoDi('imp-narrazione-attiva'), musica: gruppoDi('demo-opz-musica-eclissi'),
          registra: gruppoDi('demo-opz-registra'), audio: gruppoDi('demo-opz-registra-audio'), livelli: gruppoDi('demo-livelli'),
          avviaPiu: avvia.height > secondario.height && avvia.width > secondario.width * 2,
          etichette: [...v.querySelectorAll('input[type="checkbox"]')].every(c => c.labels && c.labels.length === 1),
          attiva: document.getElementById('btn-vista-demo').getAttribute('aria-current') };
      });
      assert.equal(p.h2, 'Demo automatizzate');
      assert.deepEqual(p.titoli, ['1 Demo da eseguire', '2 Presentazione', '3 Registrazione', '4 Narrazione e audio', '5 Elementi del Planetario']);
      assert.equal(p.avvia, '1 Demo da eseguire');
      assert.equal(p.schermo, '2 Presentazione'); assert.equal(p.pulita, '2 Presentazione');
      assert.equal(p.registra, '3 Registrazione'); assert.equal(p.audio, '3 Registrazione');
      assert.equal(p.narr, '4 Narrazione e audio'); assert.equal(p.musica, '4 Narrazione e audio');
      assert.equal(p.livelli, '5 Elementi del Planetario');
      assert.ok(p.avviaPiu, 'Avvia demo più evidente dei tasti secondari');
      assert.ok(p.etichette, 'ogni casella ha la sua etichetta');
      assert.equal(p.attiva, 'page');
    });
    await prova('«Registra anche l\'audio» dipende da «Registra un filmato», e la preferenza resta', async () => {
      await pagina.evaluate(() => AstroDemo.impostaOpzioni({ registra: false, registraAudio: true }));
      await pagina.evaluate(() => mostraVista('demo'));
      const audio = pagina.locator('#demo-opz-registra-audio');
      assert.equal(await audio.isDisabled(), true);
      assert.equal(await audio.isChecked(), false, 'spenta, non mostra una registrazione del solo audio');
      assert.equal(await pagina.evaluate(() => document.getElementById('demo-opz-registra-audio-gruppo').classList.contains('spenta')), true);
      await pagina.locator('#demo-opz-registra').check();
      assert.equal(await audio.isDisabled(), false);
      assert.equal(await audio.isChecked(), true, 'torna con la preferenza salvata');
      await audio.uncheck();
      await pagina.locator('#demo-opz-registra').uncheck();
      assert.equal(await audio.isDisabled(), true);
      await pagina.locator('#demo-opz-registra').check();
      assert.equal(await audio.isChecked(), false, 'ricorda anche il no');
      await pagina.locator('#demo-opz-registra').uncheck();
      await pagina.evaluate(() => AstroDemo.impostaOpzioni({ registraAudio: true }));
    });
    await prova('la musica della demo offre le tracce del catalogo e usa un toggle', async () => {
      const musica = pagina.locator('#demo-opz-musica-eclissi');
      const selettore = pagina.locator('#demo-opz-musica-traccia');
      await musica.check();
      const dati = await pagina.evaluate(() => ({
        opzioni: [...document.querySelectorAll('#demo-opz-musica-traccia option')].map(o => o.value + '|' + o.textContent),
        catalogo: (window.ASTRO_TRACCE_MUSICALI || []).map(t => t.id + '|' + t.nome),
        misura: (() => {
          const el = document.getElementById('demo-opz-musica-eclissi').getBoundingClientRect();
          return { w: el.width, h: el.height };
        })()
      }));
      assert.deepEqual(dati.opzioni, dati.catalogo);
      assert.ok(dati.misura.w >= 40 && dati.misura.h >= 22, 'il checkbox è presentato come toggle');
      await selettore.selectOption('Europa1');
      assert.equal(await pagina.evaluate(() => AstroDemo.opzioni.musicaEclissiTraccia), 'Europa1');
      await musica.uncheck();
      assert.equal(await selettore.isDisabled(), true);
      await musica.check();
      assert.equal(await selettore.isDisabled(), false);
    });
    await prova('il paesaggio spaziale generato non c\'è più', async () => {
      const opzioni = await pagina.evaluate(() => [...document.querySelectorAll('#imp-musica-traccia option')].map(o => o.value + '|' + o.textContent));
      assert.ok(opzioni.length >= 1 && opzioni.every(o => !/generat/i.test(o)), opzioni.join(','));
      assert.ok(opzioni.some(o => o.startsWith('Encelado1|')), 'le altre tracce restano');
      const scelta = await pagina.evaluate(() => { localStorage.setItem('astrocalendario_musica_traccia', 'generata'); return musicaIdScelta(); });
      assert.notEqual(scelta, 'generata', 'una preferenza vecchia torna a una traccia vera');
      assert.equal(await pagina.evaluate(() => astroI18n.esiste('ui.musica-generata')), false);
    });

    console.log('\n— i comandi della demo —');
    const tour = "define_demo prova_comandi { scene planetarium_view { duration: 20s; action: zoom_fov { from: 60, to: 10 }; " +
      "action: narrate { text: 'Una frase lunga, che la voce dice per nove secondi mentre la scena prosegue piano.' }; } " +
      "scene planetarium_view { duration: 20s; action: narrate { text: 'La seconda frase, che deve prendere il posto della prima.' }; } }";
    await prova('fuori dalla demo i comandi non ci sono; durante sì', async () => {
      assert.equal(await pagina.evaluate(() => getComputedStyle(document.getElementById('demo-controlli')).display), 'none');
      await pagina.evaluate(t => { AstroDemo.impostaOpzioni({ vistaPulita: true, registra: false }); AstroDemo.avvia(t); }, tour);
      assert.equal(await pagina.evaluate(() => document.getElementById('demo-controlli').hidden), false);
      await pagina.mouse.click(600, 300);
      await pagina.waitForTimeout(250);
      assert.equal(await pagina.locator('#demo-controlli').isVisible(), true);
    });
    await prova('Pausa/Riprendi: icona giusta, stato, tempo fermo e ripartito', async () => {
      const prima = await pagina.evaluate(() => { const b = document.querySelector('#demo-controlli [data-azione="pausa"]');
        return { rect: b.querySelectorAll('svg rect').length, w: b.querySelector('svg').getBoundingClientRect().width }; });
      assert.deepEqual(prima, { rect: 2, w: 22 });
      await pagina.locator('#demo-controlli [data-azione="pausa"]').click();
      const t0 = await pagina.evaluate(() => AstroDemo.stato + ':' + document.querySelector('#demo-controlli [data-azione="riprendi"]').getAttribute('aria-label'));
      assert.equal(t0, 'pausa:Riprendi');
      const fov = await pagina.evaluate(() => sky.fov);
      await pagina.waitForTimeout(400);
      assert.equal(await pagina.evaluate(() => sky.fov), fov, 'in pausa la regia è ferma');
      await pagina.locator('#demo-controlli [data-azione="riprendi"]').click();
      assert.equal(await pagina.evaluate(() => AstroDemo.stato), 'attivo');
    });
    await prova('usare i comandi non ferma né la regia né la voce', async () => {
      const a = await pagina.evaluate(() => ({ fov: sky.fov, voce: narrazione.stato() && narrazione.stato().id !== undefined }));
      await pagina.locator('#demo-controlli').hover();
      await pagina.locator('#demo-controlli [data-azione="pausa"]').focus();
      await pagina.waitForTimeout(500);
      const b = await pagina.evaluate(() => ({ fov: sky.fov, stato: AstroDemo.stato, voce: !!narrazione.stato() }));
      assert.ok(b.fov < a.fov && b.stato === 'attivo' && b.voce, JSON.stringify([a, b]));
      await pagina.evaluate(() => document.activeElement.blur());
      await pagina.mouse.move(5, 400);
    });
    await prova('il sottotitolo resta per tutta la frase anche quando i comandi si ritirano', async () => {
      await pagina.waitForTimeout(6400);
      const s = await pagina.evaluate(() => {
        const f = document.getElementById('demo-sottotitoli');
        const r = f.getBoundingClientRect();
        return { comandi: getComputedStyle(document.getElementById('demo-controlli')).visibility,
          visibile: !f.hidden && getComputedStyle(f).display !== 'none', testo: f.textContent,
          dentroAiComandi: !!document.querySelector('#demo-controlli #narrazione-testo'),
          alto: r.height, largo: r.width, schermoAlto: innerHeight, schermoLargo: innerWidth,
          tagliato: f.scrollHeight > f.clientHeight + 1 };
      });
      assert.equal(s.comandi, 'hidden', 'i comandi si sono ritirati');
      assert.ok(s.visibile && /nove secondi/.test(s.testo) && !s.dentroAiComandi, JSON.stringify(s));
      assert.ok(s.alto < s.schermoAlto * 0.35 && s.largo < s.schermoLargo * 0.8 && !s.tagliato, 'sottotitolo integrato: ' + JSON.stringify(s));
    });
    await prova('la frase della scena dopo sostituisce la prima, senza sovrapporsi', async () => {
      await pagina.evaluate(() => AstroDemo.vaiAScena(1));
      await pagina.waitForTimeout(100);
      const s = await pagina.evaluate(() => ({ nodi: document.querySelectorAll('.narrazione-testo').length,
        testo: document.getElementById('demo-sottotitoli').textContent }));
      assert.equal(s.nodi, 1); assert.match(s.testo, /seconda frase/); assert.doesNotMatch(s.testo, /nove secondi/);
      await pagina.evaluate(() => AstroDemo.ferma());
      assert.equal(await pagina.evaluate(() => document.getElementById('demo-sottotitoli').hidden), true);
      assert.equal(await pagina.evaluate(() => getComputedStyle(document.getElementById('demo-controlli')).display), 'none');
    });

    console.log('\n— la camera a mano —');
    await prova('planetario: trascinare prende la camera, un tocco no, e la demo continua', async () => {
      await pagina.evaluate(() => AstroDemo.avvia("define_demo cam { scene planetarium_view { duration: 20s; action: point_view { az: 120, alt: 25 }; action: timelapse { start: 20:00, end: 23:00 }; } }"));
      await pagina.waitForTimeout(200);
      const tela = await pagina.locator('#skymap-canvas').boundingBox();
      await pagina.mouse.click(tela.x + tela.width / 2, tela.y + tela.height / 2);
      await pagina.waitForTimeout(150);
      assert.equal(await pagina.evaluate(() => Math.round(sky.manuale.az)), 120, 'un tocco non cede la camera');
      await pagina.mouse.move(tela.x + tela.width * 0.3, tela.y + tela.height * 0.4);
      await pagina.mouse.down();
      await pagina.mouse.move(tela.x + tela.width * 0.5, tela.y + tela.height * 0.4, { steps: 5 });
      await pagina.mouse.up();
      const t1 = await pagina.evaluate(() => +skyAdesso());
      await pagina.waitForTimeout(500);
      const s = await pagina.evaluate(() => ({ az: sky.manuale.az, stato: AstroDemo.stato, t: +skyAdesso() }));
      assert.ok(Math.abs(s.az - 120) > 3, 'la regia non riporta indietro la camera: ' + s.az);
      assert.equal(s.stato, 'attivo');
      assert.ok(s.t > t1, 'l\'orologio della demo cammina');
      await pagina.mouse.wheel(0, 300);
      await pagina.waitForTimeout(300);
      assert.equal(await pagina.evaluate(() => AstroDemo.stato), 'attivo');
      await pagina.evaluate(() => AstroDemo.ferma());
    });
    await prova('vista 3D: girare col dito non viene annullato dalla regia', async () => {
      await pagina.evaluate(() => AstroDemo.avvia("define_demo cam3d { scene solar_system_3d { duration: 20s; action: camera_3d { scene: system, focus: 'Sun', orbit: 90, elev_from: 30, elev_to: 60 }; } }"));
      await pagina.waitForFunction(() => sol.aperto && sol.canvas && sol.canvas.width > 0, null, { timeout: 10000 });
      await pagina.waitForTimeout(300);
      const tela = await pagina.locator('#sol-canvas').boundingBox();
      await pagina.mouse.move(tela.x + tela.width * 0.4, tela.y + tela.height * 0.5);
      await pagina.mouse.down();
      await pagina.mouse.move(tela.x + tela.width * 0.7, tela.y + tela.height * 0.5, { steps: 6 });
      await pagina.mouse.up();
      // Il dito lascia un'inerzia (è della vista 3D, non della regia): si
      // aspetta che si spenga, poi la camera non deve più muoversi.
      await pagina.waitForFunction(() => !sol.inerzia, null, { timeout: 5000 });
      await pagina.waitForTimeout(300);
      const a = await pagina.evaluate(() => ({ az: sol.az, elev: sol.elevVoluta }));
      await pagina.waitForTimeout(900);
      const b = await pagina.evaluate(() => ({ az: sol.az, elev: sol.elevVoluta, stato: AstroDemo.stato }));
      assert.ok(Math.abs(b.az - a.az) < 0.02 && Math.abs(b.elev - a.elev) < 0.5 && b.stato === 'attivo', JSON.stringify([a, b]));
      await pagina.evaluate(() => AstroDemo.ferma());
    });

    console.log('\n— il pieno schermo —');
    await prova('dal planetario alla 3D e ritorno: sempre a schermo intero, senza uscite né lampeggi', async () => {
      await pagina.evaluate(() => mostraVista('demo'));
      await pagina.evaluate(() => {
        window.__schermo = [];
        document.addEventListener('fullscreenchange', () => window.__schermo.push(document.fullscreenElement ? 'dentro' : 'fuori'));
        AstroDemo.impostaOpzioni({ schermoIntero: true, vistaPulita: true });
      });
      await pagina.locator('#demo-elenco').selectOption('eclisse_tour');
      await pagina.locator('#demo-avvia').click();
      await pagina.waitForFunction(() => document.fullscreenElement === document.documentElement, null, { timeout: 5000 });
      // Il salto a una scena 3D: nello stesso turno la finestra dev'essere
      // già dentro al riquadro del cielo e il guscio a schermo pieno.
      const salto = await pagina.evaluate(() => {
        AstroDemo.vaiAScena(3);
        const guscio = document.getElementById('sol-guscio');
        const cont = document.getElementById('skymap-contenitore');
        return { dentro: cont.contains(document.getElementById('modale-sistema')) || cont.contains(guscio),
          pieno: solSchermoIntero, nativo: document.fullscreenElement === document.documentElement };
      });
      assert.deepEqual(salto, { dentro: true, pieno: true, nativo: true });
      await pagina.waitForTimeout(500);
      // Dal volo alla scena 3D vera, poi di nuovo il cielo, poi ancora la 3D.
      for (const [scena, attesa] of [[4, 'sol.aperto'], [6, '!sol.aperto'], [4, 'sol.aperto'], [0, '!sol.aperto']]) {
        const subito = await pagina.evaluate(i => {
          AstroDemo.vaiAScena(i);
          const cont = document.getElementById('skymap-contenitore');
          return { nativo: document.fullscreenElement === document.documentElement, cielo: sky.schermoIntero,
            sol: !sol.aperto || (solSchermoIntero && cont.contains(document.getElementById('sol-guscio'))) };
        }, scena);
        assert.deepEqual(subito, { nativo: true, cielo: true, sol: true }, 'scena ' + scena);
        await pagina.waitForFunction(attesa, null, { timeout: 5000 });
        await pagina.waitForTimeout(250);
      }
      const s = await pagina.evaluate(() => ({ eventi: window.__schermo, nativo: document.fullscreenElement === document.documentElement,
        cielo: sky.schermoIntero, stato: AstroDemo.stato }));
      assert.deepEqual(s.eventi, ['dentro'], 'un solo ingresso, nessuna uscita: ' + s.eventi.join(','));
      assert.ok(s.nativo && s.cielo && s.stato === 'attivo', JSON.stringify(s));
    });

    console.log('\n— la musica delle eclissi —');
    await prova('la traccia scelta suona al 30% durante la demo, il sottofondo di prima viene messo in pausa', async () => {
      // Il sottofondo della persona suona una traccia diversa, a volume suo.
      await pagina.evaluate(() => {
        AstroDemo.ferma(); AstroDemo.impostaOpzioni({
          schermoIntero: false, musicaEclissi: true, musicaEclissiTraccia: 'Europa1'
        });
        localStorage.setItem('astrocalendario_musica_traccia', 'Giapeto1');
        fermaMusicaSpaziale(); musicaVolume = 0.4; avviaMusicaSpaziale();
      });
      await pagina.waitForFunction(() => musicaSpaziale && !musicaSpaziale.audio.paused, null, { timeout: 5000 });
      const prima = await pagina.evaluate(() => musicaDemoStato().sottofondo);
      assert.equal(prima.traccia, 'Giapeto1'); assert.equal(prima.suonava, true);
      await pagina.evaluate(() => AstroDemo.avvia(AstroDemo.libreria.elenco().find(d => d.chiave === 'eclisse_lunare').testo));
      await pagina.waitForFunction(() => musicaDemoStato().demo && musicaDemoStato().demo.suona, null, { timeout: 5000 });
      const durante = await pagina.evaluate(() => musicaDemoStato());
      assert.equal(durante.demo.id, 'Europa1');
      assert.ok(Math.abs(durante.demo.volume - 0.09) < 1e-9, '30% sulla scala del cursore');
      assert.equal(durante.sottofondo.suonava, false, 'nessuna sovrapposizione');
      await pagina.keyboard.press('Escape');
      await pagina.waitForTimeout(200);
      const dopo = await pagina.evaluate(() => musicaDemoStato());
      assert.equal(dopo.demo, null);
      assert.deepEqual([dopo.sottofondo.traccia, dopo.sottofondo.volume, dopo.sottofondo.suonava],
        [prima.traccia, prima.volume, true], 'Esc: tutto com\'era');
    });
    await prova('Stop e fine ripristinano; un sottofondo in pausa resta in pausa', async () => {
      await pagina.evaluate(() => musicaSpaziale.audio.pause());
      await pagina.evaluate(() => AstroDemo.avvia(AstroDemo.libreria.elenco().find(d => d.chiave === 'eclisse_tour').testo));
      assert.ok(await pagina.evaluate(() => !!musicaDemoStato().demo));
      await pagina.mouse.click(600, 300);
      await pagina.locator('#demo-controlli [data-azione="stop"]').click();
      const s = await pagina.evaluate(() => musicaDemoStato());
      assert.equal(s.demo, null); assert.equal(s.sottofondo.suonava, false); assert.equal(s.sottofondo.traccia, 'Giapeto1');
    });
    await prova('una demo che non è un\'eclisse non cambia la musica, e un errore la ripristina', async () => {
      await pagina.evaluate(() => AstroDemo.avvia(AstroDemo.libreria.elenco().find(d => d.chiave === 'allineamento_pianeti').testo));
      assert.equal(await pagina.evaluate(() => musicaDemoStato().demo), null);
      await pagina.evaluate(() => AstroDemo.ferma());
      await pagina.evaluate(() => musicaSpaziale.audio.play());
      await pagina.evaluate(() => {
        AstroDemo.registra('guasto_musica', { crea() { throw new Error('guasto controllato'); } });
        AstroDemo.avvia("define_demo eclisse_guasta { scene planetarium_view { duration: 1s; action: guasto_musica { x: 1 }; } }");
      });
      const s = await pagina.evaluate(() => ({ stato: AstroDemo.stato, m: musicaDemoStato() }));
      assert.equal(s.stato, 'errore'); assert.equal(s.m.demo, null); assert.equal(s.m.sottofondo.suonava, true);
      await pagina.evaluate(() => { skyAvviso('demo', ''); fermaMusicaSpaziale(); });
    });

    assert.deepEqual(errori, [], 'Nessuna eccezione nella pagina');
    console.log('\n✓ ' + passate + ' prove passate');
  } finally {
    if (browser) await browser.close();
    await new Promise(r => server.close(r));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
