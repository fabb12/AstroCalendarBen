#!/usr/bin/env node
/* L'intro comune delle demo, e la demo delle aurore nella sua versione lunga.
 *
 *   npm install --no-save playwright astronomy-engine
 *   node scripts/prova-demo-intro.js
 *
 * Un'intro si giudica a occhio peggio di quanto sembri: un velo nero che
 * resta sullo schermo mezzo secondo di troppo si legge come «l'app si è
 * piantata», un titolo che esce dal bordo di un telefono girato non lo nota
 * chi la prova sul computer, un logo deformato del dieci per cento sembra
 * giusto a chi l'ha disegnato. E la prima scena che parte sotto al nero —
 * con la sua voce — è un difetto che non si vede affatto: si sente. Qui si
 * misurano le cose: quando parte la prima scena, cosa resta nel documento
 * dopo Stop, Esc o un errore, le proporzioni del logo, i bordi del titolo. */
'use strict';
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const radice = path.resolve(__dirname, '..');
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
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

// Un logo largo il doppio che alto, trasparente ai bordi: se esce quadrato o
// col fondo pieno, la prova lo vede.
const LOGO_LARGO = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">' +
  '<rect x="20" y="20" width="360" height="160" rx="30" fill="#ff7a00"/></svg>';
const DEMO_BREVE = "define_demo breve { scene planetarium_view { duration: 2s; action: point_view { az: 120, alt: 25 }; } " +
  "scene planetarium_view { duration: 2s; action: set_fov { degrees: 30 }; } }";

(async () => {
  let browser;
  const lancia = () => chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    browser = await lancia();
    fs.mkdirSync(path.join(radice, 'work'), { recursive: true });

    async function nuovaPagina(opz = {}) {
      const contesto = await browser.newContext({ viewport: opz.viewport || { width: 1200, height: 800 },
        serviceWorkers: 'block', reducedMotion: opz.ridotto ? 'reduce' : 'no-preference', hasTouch: !!opz.tocco });
      const pagina = await contesto.newPage();
      const errori = [];
      pagina.on('pageerror', e => errori.push(e.message));
      await pagina.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith(origine)) return route.continue();
        if (url.includes('astronomy.browser.min.js'))
          return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(require.resolve('astronomy-engine').replace(/astronomy\.js$/, 'astronomy.browser.min.js')) });
        return route.abort();
      });
      await pagina.addInitScript(intro => {
        if (!sessionStorage.getItem('__preparata')) {
          sessionStorage.setItem('__preparata', '1');
          localStorage.setItem('astrocalendario_posizione', JSON.stringify({ lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale' }));
          localStorage.setItem('astrocal_lingua', 'it');
          localStorage.setItem('astrocal_demo_opzioni_v1', JSON.stringify({ musicaDemo: false, vistaPulita: true }));
          if (intro) localStorage.setItem('astrocal_demo_intro_v1', JSON.stringify(intro));
        }
        // La sintesi del dispositivo, finta, che annota quando comincia a parlare.
        window.__voce = [];
        window.speechSynthesis.speak = u => {
          window.__voce.push({ testo: u.text, quando: performance.now() });
          setTimeout(() => { if (u.onstart) u.onstart(); }, 5);
          setTimeout(() => { if (u.onend) u.onend(); }, window.__durataVoce || 300);
        };
        window.speechSynthesis.cancel = () => {};
        // Nessuna voce elencata: un oggetto finto assegnato a `utterance.voice`
        // solleva, e la frase finirebbe nel solo testo senza passare di qui.
        window.speechSynthesis.getVoices = () => [];
      }, opz.intro || null);
      await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
      await pagina.waitForFunction(() => typeof AstroDemo !== 'undefined' && typeof AstroDemoIntro !== 'undefined' &&
        sky.observer && sky.oggetti.length, null, { timeout: 30000 });
      await pagina.evaluate(() => AstroDemoIntro.pronto);
      return { pagina, contesto, errori };
    }
    const velo = p => p.evaluate(() => {
      const v = document.querySelectorAll('.demo-intro-schermo');
      if (!v.length) return null;
      const el = v[0], r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const img = el.querySelector('.demo-intro-logo'), t = el.querySelector('.demo-intro-titolo');
      const ri = img.getBoundingClientRect(), rt = t.getBoundingClientRect();
      return { quanti: v.length, fase: el.dataset.fase, sfondo: cs.backgroundColor, z: Number(cs.zIndex),
        l: r.width, h: r.height, vw: innerWidth, vh: innerHeight,
        genitore: el.parentElement === document.body ? 'body' : el.parentElement.id || el.parentElement.className,
        logo: { src: img.getAttribute('src'), l: ri.width, h: ri.height, top: ri.top, bottom: ri.bottom, left: ri.left, right: ri.right,
          nl: img.naturalWidth, nh: img.naturalHeight, opacita: Number(getComputedStyle(img).opacity), nascosto: img.hidden },
        titolo: { testo: t.textContent, nascosto: t.hidden, top: rt.top, bottom: rt.bottom, left: rt.left, right: rt.right,
          scroll: t.scrollWidth > t.clientWidth + 1, corpo: parseFloat(getComputedStyle(t).fontSize),
          opacita: Number(getComputedStyle(t).opacity), misura: t.dataset.misura } };
    });
    const pulito = p => p.evaluate(() => !document.querySelector('.demo-intro-schermo') && !AstroDemoIntro.attiva);

    // ------------------------------------------------------------------
    const { pagina, errori } = await nuovaPagina();

    await prova('l’intro è accesa di serie, dura tre secondi, col logo e il titolo predefiniti', async () => {
      const o = await pagina.evaluate(() => ({ imp: AstroDemoIntro.impostazioni(), logo: AstroDemoIntro.statoLogo(),
        titolo: AstroDemoIntro.titoloDaMostrare() }));
      assert.equal(o.imp.attiva, true);
      assert.equal(o.imp.durataSec, 3);
      assert.equal(o.imp.mostraTitolo, true);
      assert.equal(o.logo.personale, false);
      assert.equal(o.logo.url, 'demo-logo-256.jpg');
      assert.equal(o.titolo, 'AstroCalendario di Ben');
    });

    await prova('l’intro compare prima della prima scena, nera, sopra la pagina ma sotto ai comandi', async () => {
      await pagina.evaluate(t => AstroDemo.avvia(t), DEMO_BREVE);
      const v = await velo(pagina);
      const s = await pagina.evaluate(() => ({ intro: AstroDemo.intro, stato: AstroDemo.stato, voce: window.__voce.length,
        zComandi: Number(getComputedStyle(document.getElementById('demo-controlli')).zIndex) }));
      assert.ok(v, 'il velo c’è');
      assert.equal(v.quanti, 1);
      assert.equal(v.sfondo, 'rgb(0, 0, 0)');
      assert.ok(Math.abs(v.l - v.vw) < 1 && Math.abs(v.h - v.vh) < 1, 'copre tutto il riquadro');
      assert.ok(v.z < s.zComandi, 'Stop resta raggiungibile sopra all’intro');
      assert.equal(s.intro, true); assert.equal(s.stato, 'attivo');
      assert.equal(s.voce, 0, 'nessuna voce durante l’intro');
      assert.equal(v.logo.src, 'demo-logo-256.jpg');
      assert.equal(v.titolo.testo, 'AstroCalendario di Ben');
      await pagina.waitForTimeout(1500);
      await pagina.screenshot({ path: path.join(radice, 'work/intro-desktop.png') });
      const meta = await velo(pagina);
      assert.ok(meta.logo.opacita > 0.9 && meta.titolo.opacita > 0.9, 'a metà intro logo e titolo sono in vista');
      assert.ok(await pagina.evaluate(() => AstroDemo.intro && AstroDemo.scena === 0), 'a metà la prima scena non è ancora partita');
      await pagina.evaluate(() => AstroDemo.ferma());
    });

    await prova('la prima scena parte a tre secondi, non prima: sincronia fra intro e prima scena', async () => {
      await pagina.evaluate(() => { window.__voce.length = 0; sky.manuale.az = 0; });
      const inizio = await pagina.evaluate(t => {
        window.__primaScena = null;
        const guarda = () => {
          if (!AstroDemo.inCorso) return;
          if (!AstroDemo.intro && window.__primaScena === null) window.__primaScena = performance.now();
          else requestAnimationFrame(guarda);
        };
        const t0 = performance.now();
        AstroDemo.avvia("define_demo sincro { scene planetarium_view { duration: 3s; action: narrate { text: 'Prima frase' }; action: point_view { az: 120, alt: 25 }; } }");
        requestAnimationFrame(guarda);
        return t0;
      });
      await pagina.waitForFunction(() => window.__primaScena !== null, null, { timeout: 8000 });
      const r = await pagina.evaluate(() => ({ prima: window.__primaScena, voce: window.__voce.map(v => v.quando),
        az: sky.manuale.az }));
      const ritardo = r.prima - inizio;
      assert.ok(ritardo >= 2950 && ritardo < 3400, `la prima scena parte dopo l’intro (${ritardo.toFixed(0)} ms)`);
      await pagina.waitForFunction(() => window.__voce.length > 0, null, { timeout: 3000 });
      const voce = await pagina.evaluate(() => window.__voce[0].quando);
      assert.ok(voce >= r.prima - 1, 'la voce della prima scena parte con la scena, non sotto al nero');
      assert.equal(await pagina.evaluate(() => sky.manuale.az), 120, 'e la prima scena ha fatto il suo lavoro');
      // Il nero se ne va con una dissolvenza breve, e poi sparisce del tutto.
      await pagina.waitForFunction(() => !document.querySelector('.demo-intro-schermo'), null, { timeout: 2000 });
      await pagina.evaluate(() => AstroDemo.ferma());
      assert.ok(await pulito(pagina));
    });

    await prova('Stop, Esc, un errore, la fine: nessun velo residuo', async () => {
      for (const [nome, ferma] of [
        ['Stop', () => pagina.evaluate(() => AstroDemo.ferma())],
        ['Esc', () => pagina.keyboard.press('Escape')],
        ['tasto Termina', () => pagina.evaluate(() => document.querySelector('#demo-controlli [data-azione="stop"]').click())]
      ]) {
        await pagina.evaluate(t => AstroDemo.avvia(t), DEMO_BREVE);
        await pagina.waitForTimeout(400);
        assert.ok(await velo(pagina), nome + ': c’è l’intro');
        await ferma();
        assert.ok(await pulito(pagina), nome + ': nessun velo dopo');
        assert.equal(await pagina.evaluate(() => AstroDemo.stato), 'fermo', nome);
      }
      // Un errore nella prima scena, all'uscita dall'intro.
      await pagina.evaluate(() => AstroDemo.registra('prova_intro_guasto', {
        crea() { throw new Error('guasto controllato'); } }));
      await pagina.evaluate(() => AstroDemo.avvia("define_demo guasto { scene planetarium_view { duration: 1s; action: prova_intro_guasto { }; } }"));
      await pagina.waitForFunction(() => AstroDemo.stato === 'errore', null, { timeout: 6000 });
      assert.ok(await pulito(pagina), 'errore: nessun velo residuo');
      // La vista che cambia sotto ai piedi durante l'intro ferma la demo.
      await pagina.evaluate(t => AstroDemo.avvia(t), DEMO_BREVE);
      await pagina.waitForTimeout(300);
      await pagina.evaluate(() => mostraVista('stasera'));
      await pagina.waitForFunction(() => AstroDemo.stato === 'fermo', null, { timeout: 3000 });
      assert.ok(await pulito(pagina), 'cambio di vista: nessun velo residuo');
      // Fine naturale.
      await pagina.evaluate(t => AstroDemo.avvia(t), DEMO_BREVE);
      await pagina.waitForFunction(() => AstroDemo.stato === 'completato', null, { timeout: 12000 });
      assert.ok(await pulito(pagina), 'fine: nessun velo residuo');
    });

    await prova('Ricomincia fa ripartire l’intro, e un salto di scena la chiude', async () => {
      await pagina.evaluate(t => AstroDemo.avvia(t), DEMO_BREVE);
      await pagina.waitForFunction(() => !AstroDemo.intro, null, { timeout: 6000 });
      await pagina.evaluate(() => document.querySelector('#demo-controlli [data-azione="riavvia"]').click());
      assert.equal(await pagina.evaluate(() => AstroDemo.intro), true, 'Ricomincia: di nuovo l’intro');
      assert.equal((await velo(pagina)).quanti, 1, 'un velo solo');
      await pagina.evaluate(() => AstroDemo.vaiAScena(1));
      assert.ok(await pulito(pagina), 'il salto toglie il velo');
      assert.equal(await pagina.evaluate(() => AstroDemo.scena), 1);
      await pagina.evaluate(() => AstroDemo.ferma());
    });

    await prova('la pausa ferma anche l’intro', async () => {
      await pagina.evaluate(t => AstroDemo.avvia(t), DEMO_BREVE);
      await pagina.waitForTimeout(500);
      await pagina.evaluate(() => AstroDemo.pausa());
      await pagina.waitForTimeout(3500);
      assert.equal(await pagina.evaluate(() => AstroDemo.intro), true, 'in pausa l’intro non finisce');
      await pagina.evaluate(() => AstroDemo.riprendi());
      await pagina.waitForFunction(() => !AstroDemo.intro, null, { timeout: 4000 });
      await pagina.evaluate(() => AstroDemo.ferma());
    });

    await prova('si può spegnere: la demo parte subito dalla prima scena', async () => {
      await pagina.evaluate(() => AstroDemoIntro.imposta({ attiva: false }));
      await pagina.evaluate(t => AstroDemo.avvia(t), DEMO_BREVE);
      assert.equal(await velo(pagina), null);
      assert.equal(await pagina.evaluate(() => AstroDemo.intro), false);
      await pagina.evaluate(() => AstroDemo.ferma());
      await pagina.evaluate(() => AstroDemoIntro.imposta({ attiva: true }));
    });

    await prova('durata scelta: due secondi sono due secondi', async () => {
      await pagina.evaluate(() => AstroDemoIntro.imposta({ durataSec: 2 }));
      const t0 = await pagina.evaluate(t => { AstroDemo.avvia(t); return performance.now(); }, DEMO_BREVE);
      await pagina.waitForFunction(() => !AstroDemo.intro, null, { timeout: 5000 });
      const dt = await pagina.evaluate(() => performance.now()) - t0;
      assert.ok(dt >= 1950 && dt < 2600, `due secondi (${dt.toFixed(0)} ms)`);
      await pagina.evaluate(() => AstroDemo.ferma());
      // Fuori dall'intervallo si tosa, e un valore illeggibile torna a tre.
      const o = await pagina.evaluate(() => [AstroDemoIntro.imposta({ durataSec: 99 }).durataSec,
        AstroDemoIntro.imposta({ durataSec: 0.2 }).durataSec, AstroDemoIntro.imposta({ durataSec: 'x' }).durataSec]);
      assert.deepEqual(o, [10, 1, 3]);
    });

    await prova('il titolo: personalizzato, persistente, nascosto e ripristinato', async () => {
      await pagina.evaluate(() => AstroDemoIntro.imposta({ titolo: 'Serata al circolo', mostraTitolo: true }));
      await pagina.reload({ waitUntil: 'domcontentloaded' });
      await pagina.waitForFunction(() => typeof AstroDemoIntro !== 'undefined' && sky.observer && sky.oggetti.length, null, { timeout: 30000 });
      assert.equal(await pagina.evaluate(() => AstroDemoIntro.titoloDaMostrare()), 'Serata al circolo', 'sopravvive al ricaricamento');
      await pagina.evaluate(t => AstroDemo.avvia(t), DEMO_BREVE);
      assert.equal((await velo(pagina)).titolo.testo, 'Serata al circolo');
      await pagina.evaluate(() => AstroDemo.ferma());
      await pagina.evaluate(() => AstroDemoIntro.imposta({ mostraTitolo: false }));
      await pagina.evaluate(t => AstroDemo.avvia(t), DEMO_BREVE);
      const v = await velo(pagina);
      assert.equal(v.titolo.nascosto, true, 'titolo nascosto');
      assert.equal(v.logo.nascosto, false, 'il logo resta');
      await pagina.evaluate(() => AstroDemo.ferma());
      await pagina.evaluate(() => { AstroDemoIntro.imposta({ mostraTitolo: true }); AstroDemoIntro.ripristinaTitolo(); });
      assert.equal(await pagina.evaluate(() => AstroDemoIntro.titoloDaMostrare()), 'AstroCalendario di Ben');
      assert.equal(await pagina.evaluate(() => AstroDemoIntro.impostazioni().titolo), null, 'torna a seguire la lingua');
    });

    await prova('il logo: sostituito, persistente, non deformato, e ripristinato', async () => {
      await pagina.evaluate(() => mostraVista('demo'));
      await pagina.locator('#demo-intro-logo-file').setInputFiles({ name: 'largo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(LOGO_LARGO) });
      await pagina.waitForFunction(() => AstroDemoIntro.statoLogo().personale, null, { timeout: 5000 });
      const stato = await pagina.evaluate(() => ({ l: AstroDemoIntro.statoLogo(), testo: document.getElementById('demo-intro-logo-stato').textContent,
        mini: document.getElementById('demo-intro-logo-miniatura').getAttribute('src'),
        riquadro: document.querySelector('#demo-intro-anteprima .demo-intro-logo').getAttribute('src') }));
      assert.equal(stato.l.nome, 'largo.svg');
      assert.match(stato.testo, /largo\.svg/);
      assert.equal(stato.mini, stato.l.url, 'la miniatura mostra il logo nuovo');
      assert.equal(stato.riquadro, stato.l.url, 'e anche l’anteprima');
      await pagina.reload({ waitUntil: 'domcontentloaded' });
      await pagina.waitForFunction(() => typeof AstroDemoIntro !== 'undefined' && sky.observer && sky.oggetti.length, null, { timeout: 30000 });
      await pagina.evaluate(() => AstroDemoIntro.pronto);
      const dopo = await pagina.evaluate(() => AstroDemoIntro.statoLogo());
      assert.equal(dopo.personale, true, 'sopravvive al ricaricamento');
      assert.equal(dopo.nome, 'largo.svg');
      // Logo e titolo insieme, e le proporzioni del file.
      await pagina.evaluate(() => AstroDemoIntro.imposta({ titolo: 'Notte delle aurore' }));
      await pagina.evaluate(t => AstroDemo.avvia(t), DEMO_BREVE);
      await pagina.waitForTimeout(1300);
      const v = await velo(pagina);
      assert.ok(v.logo.src.startsWith('blob:'), 'l’intro usa il logo personale');
      assert.equal(v.titolo.testo, 'Notte delle aurore');
      assert.ok(Math.abs(v.logo.l / v.logo.h - 2) < 0.03, `proporzioni del file conservate (${(v.logo.l / v.logo.h).toFixed(3)})`);
      assert.ok(v.logo.bottom <= v.titolo.top + 0.5, 'titolo e logo non si sovrappongono');
      await pagina.screenshot({ path: path.join(radice, 'work/intro-logo-titolo.png') });
      // Trasparenza: agli angoli del logo (fuori dal rettangolo arancione) si vede il nero.
      const angolo = await pagina.evaluate(async () => {
        const img = document.querySelector('.demo-intro-schermo .demo-intro-logo');
        const c = document.createElement('canvas'); c.width = 400; c.height = 200;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0, 400, 200);
        return [x.getImageData(4, 4, 1, 1).data[3], x.getImageData(200, 100, 1, 1).data[3]];
      });
      assert.deepEqual(angolo, [0, 255], 'la trasparenza del file resta');
      await pagina.evaluate(() => AstroDemo.ferma());
      // Ripristino.
      await pagina.evaluate(() => mostraVista('demo'));
      await pagina.locator('#demo-intro-logo-ripristina').click();
      await pagina.waitForFunction(() => !AstroDemoIntro.statoLogo().personale, null, { timeout: 5000 });
      assert.equal(await pagina.evaluate(() => document.getElementById('demo-intro-logo-miniatura').getAttribute('src')), 'demo-logo-256.jpg');
      await pagina.reload({ waitUntil: 'domcontentloaded' });
      await pagina.waitForFunction(() => typeof AstroDemoIntro !== 'undefined', null, { timeout: 30000 });
      await pagina.evaluate(() => AstroDemoIntro.pronto);
      assert.equal(await pagina.evaluate(() => AstroDemoIntro.statoLogo().personale), false, 'il ripristino resta');
    });

    await prova('un file che non è un logo non toglie quello di prima', async () => {
      await pagina.waitForFunction(() => sky.observer && sky.oggetti.length, null, { timeout: 30000 });
      await pagina.evaluate(() => mostraVista('demo'));
      await pagina.locator('#demo-intro-logo-file').setInputFiles({ name: 'largo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(LOGO_LARGO) });
      await pagina.waitForFunction(() => AstroDemoIntro.statoLogo().personale, null, { timeout: 5000 });
      const prima = await pagina.evaluate(() => AstroDemoIntro.statoLogo().url);
      for (const [nome, tipo, dati] of [['rotto.png', 'image/png', Buffer.from('non sono un png')],
        ['testo.txt', 'text/plain', Buffer.from('ciao')]]) {
        await pagina.locator('#demo-intro-logo-file').setInputFiles({ name: nome, mimeType: tipo, buffer: dati });
        await pagina.waitForFunction(() => /resta quello di prima/.test(document.getElementById('demo-intro-logo-stato').textContent), null, { timeout: 5000 });
        assert.equal(await pagina.evaluate(() => AstroDemoIntro.statoLogo().url), prima, nome + ': il logo di prima resta');
      }
      await pagina.evaluate(() => AstroDemoIntro.ripristinaLogo());
    });

    await prova('un logo salvato che non si legge più torna al predefinito', async () => {
      await pagina.evaluate(() => new Promise((ok, no) => {
        const r = indexedDB.open('astrocal_demo_intro', 1);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('file')) r.result.createObjectStore('file'); };
        r.onsuccess = () => {
          const tx = r.result.transaction('file', 'readwrite');
          tx.objectStore('file').put({ blob: new Blob(['guasto'], { type: 'image/png' }), nome: 'guasto.png' }, 'logo');
          tx.oncomplete = () => { r.result.close(); ok(); }; tx.onerror = () => no(tx.error);
        };
        r.onerror = () => no(r.error);
      }));
      await pagina.reload({ waitUntil: 'domcontentloaded' });
      await pagina.waitForFunction(() => typeof AstroDemoIntro !== 'undefined' && sky.observer && sky.oggetti.length, null, { timeout: 30000 });
      await pagina.evaluate(() => AstroDemoIntro.pronto);
      const l = await pagina.evaluate(() => AstroDemoIntro.statoLogo());
      assert.equal(l.personale, false); assert.equal(l.url, 'demo-logo-256.jpg'); assert.equal(l.stato, 'guasto');
      await pagina.evaluate(t => AstroDemo.avvia(t), DEMO_BREVE);
      assert.equal((await velo(pagina)).logo.src, 'demo-logo-256.jpg', 'l’intro usa il predefinito');
      await pagina.evaluate(() => AstroDemo.ferma());
    });

    await prova('la pagina Demo: gruppo «Intro delle Demo», comandi e anteprima coerenti', async () => {
      await pagina.evaluate(() => mostraVista('demo'));
      const g = await pagina.evaluate(() => {
        const sez = document.querySelector('.demo-gruppo-intro');
        const titolo = sez.querySelector('.demo-gruppo-titolo').textContent.replace(/\s+/g, ' ').trim();
        const ids = ['demo-intro-attiva', 'demo-intro-durata', 'demo-intro-prova', 'demo-intro-logo-miniatura',
          'demo-intro-logo-file', 'demo-intro-logo-ripristina', 'demo-intro-titolo', 'demo-intro-mostra-titolo', 'demo-intro-titolo-ripristina'];
        return { titolo, tutti: ids.every(id => sez.contains(document.getElementById(id))),
          durata: document.getElementById('demo-intro-durata').value, valore: document.getElementById('demo-intro-durata-valore').textContent };
      });
      assert.equal(g.titolo, '4 Intro delle Demo');
      assert.ok(g.tutti, 'tutti i comandi nel gruppo');
      assert.equal(g.durata, '3'); assert.equal(g.valore, '3 s');
      // Il titolo scritto nel campo compare subito nell'anteprima, e resta.
      await pagina.locator('#demo-intro-titolo').fill('Planetario del lunedì');
      assert.equal(await pagina.evaluate(() => document.querySelector('#demo-intro-anteprima .demo-intro-titolo').textContent), 'Planetario del lunedì');
      await pagina.locator('#demo-intro-mostra-titolo').uncheck();
      assert.equal(await pagina.evaluate(() => document.querySelector('#demo-intro-anteprima .demo-intro-titolo').hidden), true);
      assert.equal(await pagina.evaluate(() => document.getElementById('demo-intro-titolo').disabled), true);
      await pagina.locator('#demo-intro-mostra-titolo').check();
      await pagina.locator('#demo-intro-titolo-ripristina').click();
      assert.equal(await pagina.inputValue('#demo-intro-titolo'), 'AstroCalendario di Ben');
      await pagina.locator('#demo-intro-durata').fill('5');
      assert.equal(await pagina.evaluate(() => AstroDemoIntro.impostazioni().durataSec), 5);
      assert.equal(await pagina.evaluate(() => document.getElementById('demo-intro-durata-valore').textContent), '5 s');
      await pagina.locator('#demo-intro-attiva').uncheck();
      assert.equal(await pagina.evaluate(() => AstroDemoIntro.impostazioni().attiva), false);
      await pagina.locator('#demo-intro-attiva').check();
      await pagina.evaluate(() => AstroDemoIntro.imposta({ durataSec: 3 }));
      // L'anteprima nel riquadro è la stessa impaginazione dello schermo intero, in scala.
      const r = await pagina.evaluate(() => {
        const q = document.getElementById('demo-intro-anteprima'), rq = q.getBoundingClientRect();
        const img = q.querySelector('.demo-intro-logo').getBoundingClientRect(), t = q.querySelector('.demo-intro-titolo').getBoundingClientRect();
        return { rapporto: rq.width / rq.height, sfondo: getComputedStyle(q).backgroundColor,
          dentro: img.top >= rq.top && img.bottom <= t.top + 0.5 && t.bottom <= rq.bottom && t.left >= rq.left && t.right <= rq.right };
      });
      assert.ok(Math.abs(r.rapporto - 16 / 9) < 0.02 && r.sfondo === 'rgb(0, 0, 0)' && r.dentro, 'riquadro 16:9 nero, logo sopra il titolo');
      await pagina.locator('.demo-intro-anteprima-guscio').screenshot({ path: path.join(radice, 'work/intro-anteprima-riquadro.png') });
      // L'anteprima completa: si apre, dura quanto l'intro, si chiude da sé o con Esc.
      await pagina.locator('#demo-intro-prova').click();
      assert.ok(await pagina.evaluate(() => !!document.querySelector('.demo-intro-anteprima-completa')));
      await pagina.keyboard.press('Escape');
      assert.ok(await pagina.evaluate(() => !document.querySelector('.demo-intro-anteprima-completa')), 'Esc chiude l’anteprima');
      assert.equal(await pagina.evaluate(() => vistaAttuale), 'demo', 'e non tocca nient’altro');
      await pagina.locator('#demo-intro-prova').click();
      await pagina.waitForFunction(() => !document.querySelector('.demo-intro-anteprima-completa'), null, { timeout: 5000 });
    });

    await prova('schermo intero: il velo è dentro al documento a schermo intero, e non ne esce', async () => {
      await pagina.evaluate(() => AstroDemo.impostaOpzioni({ schermoIntero: true }));
      await pagina.evaluate(() => mostraVista('demo'));
      await pagina.locator('#demo-avvia').click();
      await pagina.waitForTimeout(300);
      const v = await velo(pagina);
      const fs1 = await pagina.evaluate(() => document.fullscreenElement === document.documentElement);
      assert.ok(v && v.genitore === 'body' && fs1, 'velo dentro al documento a schermo intero');
      await pagina.waitForFunction(() => !AstroDemo.intro, null, { timeout: 6000 });
      assert.equal(await pagina.evaluate(() => document.fullscreenElement === document.documentElement), true,
        'finita l’intro, il pieno schermo resta');
      await pagina.evaluate(() => AstroDemo.ferma());
      await pagina.evaluate(() => AstroDemo.impostaOpzioni({ schermoIntero: false }));
      assert.ok(await pulito(pagina));
    });

    assert.deepEqual(errori, [], 'nessun errore nella pagina');
    await pagina.context().close();

    // ------------------------------------------------------------------
    // Telefono: dritto, girato, titolo lungo; movimento ridotto.
    const LUNGO = 'Una serata sotto le stelle del nord, con gli amici del circolo astronomico e una tazza di tè caldo in mano';
    for (const [nome, viewport] of [['telefono-dritto', { width: 360, height: 640 }], ['telefono-girato', { width: 640, height: 360 }],
      ['tablet', { width: 820, height: 1180 }]]) {
      await prova(`${nome}: logo e titolo lungo dentro allo schermo, senza tagli né sovrapposizioni`, async () => {
        const { pagina: p, contesto, errori: e } = await nuovaPagina({ viewport, tocco: true, intro: { titolo: LUNGO } });
        await p.evaluate(t => AstroDemo.avvia(t), DEMO_BREVE);
        await p.waitForTimeout(1300);
        const v = await velo(p);
        assert.equal(v.titolo.testo, LUNGO);
        assert.equal(v.titolo.misura, 'lungo');
        assert.ok(v.titolo.left >= 0 && v.titolo.right <= v.vw && v.titolo.top >= 0 && v.titolo.bottom <= v.vh, 'titolo dentro');
        assert.ok(!v.titolo.scroll, 'nessuna parola esce dalla riga');
        assert.ok(v.logo.top >= 0 && v.logo.bottom <= v.titolo.top + 0.5, 'logo sopra al titolo, senza sovrapporsi');
        assert.ok(v.logo.h <= v.vh * 0.46 && v.logo.l <= v.vw * 0.66, 'il logo non si prende lo schermo');
        assert.ok(Math.abs(v.logo.l / v.logo.h - v.logo.nl / v.logo.nh) < 0.02, 'logo non deformato');
        assert.ok(v.titolo.corpo >= 14, `titolo leggibile (${v.titolo.corpo}px)`);
        await p.screenshot({ path: path.join(radice, `work/intro-${nome}.png`) });
        await p.evaluate(() => AstroDemo.ferma());
        assert.ok(await pulito(p));
        assert.deepEqual(e, []);
        await contesto.close();
      });
    }

    await prova('movimento ridotto: comparsa statica, nessuna animazione, stessa durata', async () => {
      const { pagina: p, contesto, errori: e } = await nuovaPagina({ ridotto: true });
      const t0 = await p.evaluate(t => { AstroDemo.avvia(t); return performance.now(); }, DEMO_BREVE);
      const v = await velo(p);
      const trasforma = await p.evaluate(() => {
        const el = document.querySelector('.demo-intro-schermo');
        return { statica: el.classList.contains('demo-intro-statica'), t: getComputedStyle(el.querySelector('.demo-intro-logo')).transform,
          transizione: getComputedStyle(el).transitionDuration };
      });
      assert.ok(v.logo.opacita === 1 && v.titolo.opacita === 1, 'logo e titolo subito in vista');
      assert.ok(trasforma.statica && trasforma.t === 'none' && parseFloat(trasforma.transizione) < 0.01, 'niente movimento ' + JSON.stringify(trasforma));
      await p.waitForFunction(() => !AstroDemo.intro, null, { timeout: 6000 });
      const dt = await p.evaluate(() => performance.now()) - t0;
      assert.ok(dt >= 2950, 'la durata resta quella');
      assert.ok(await p.evaluate(() => !document.querySelector('.demo-intro-schermo')), 'il velo se ne va subito, senza dissolvenza');
      await p.evaluate(() => AstroDemo.ferma());
      assert.deepEqual(e, []);
      await contesto.close();
    });

    // ------------------------------------------------------------------
    // La demo delle aurore, nella versione lunga.
    await prova('aurore: la struttura del racconto, dal Sole al congedo', async () => {
      const { pagina: p, contesto, errori: e } = await nuovaPagina({ intro: { attiva: false } });
      const demo = await p.evaluate(() => {
        const d = AstroDemoMotore.analizza(AstroDemo.libreria.elenco().find(x => x.chiave === 'aurora_boreale').testo);
        return d.scene.map(s => ({ vista: s.vista, durata: s.durata,
          capitolo: (s.azioni.find(a => a.comando === 'aurora_lesson') || {}).parametri,
          narra: s.azioni.find(a => a.comando === 'narrate').parametri.id,
          testo: astroI18n.t(s.azioni.find(a => a.comando === 'narrate').parametri.id) }));
      });
      assert.equal(demo.length, 11, 'undici scene');
      assert.ok(demo.reduce((n, s) => n + s.durata, 0) >= 150000, 'più lunga di prima: almeno due minuti e mezzo');
      assert.equal(demo[0].vista, 'planetarium_view', 'si comincia dal Sole');
      assert.deepEqual(demo.slice(1, 8).map(s => s.capitolo.chapter),
        ['vento', 'vento', 'scudo', 'scudo', 'scarica', 'anello', 'taglio'], 'viaggio, scudo, coda, anello, colori');
      assert.deepEqual(demo.slice(8).map(s => s.vista), ['planetarium_view', 'planetarium_view', 'planetarium_view'], 'e poi da terra');
      assert.ok(demo.every(s => s.testo && !s.testo.startsWith('demo.')), 'ogni scena ha la sua frase');
      assert.ok(/Sole/.test(demo[0].testo) && /vento solare/.test(demo[1].testo) && /magnetosfera/.test(demo[3].testo) &&
        /verde/.test(demo[7].testo) && /rosso/.test(demo[7].testo) && /Helsinki/.test(demo[8].testo), 'le frasi dicono quello che si vede');
      // Il Sole è in quadro e ingrandito.
      await p.evaluate(() => AstroDemo.avvia(AstroDemo.libreria.elenco().find(d => d.chiave === 'aurora_boreale').testo));
      await p.evaluate(() => AstroDemo.vaiAScena(0, 0.95));
      await p.waitForTimeout(400);
      const sole = await p.evaluate(() => {
        skyAggiornaOggetti(true); skyDisegna();
        const o = sky.oggetti.find(x => x.id === 'Sun');
        const q = o && skyProietta(skyVettore(o.az, o.alt), sky.ultimaBase, sky.ultimaFocale);
        return { vista: vistaAttuale, fov: sky.fov, dentro: !!(q && q.davanti && Math.abs(q.px - sky.larghezza / 2) < 30 && Math.abs(q.py - sky.altezza / 2) < 30),
          alt: o && o.alt, lat: sky.observer.latitude };
      });
      assert.ok(sole.vista === 'cielo' && sole.fov < 3 && sole.dentro && sole.alt > 0, 'scena 1: il Sole al centro, sopra l’orizzonte, ingrandito');
      await p.screenshot({ path: path.join(radice, 'work/aurora-1-sole.png') });
      // Il taglio: il quadro dei colori, col luogo e il Kp scelti, a schermo intero.
      await p.evaluate(() => AstroDemo.vaiAScena(7, 0.5));
      await p.waitForTimeout(500);
      const taglio = await p.evaluate(() => ({ f: didDemo.fotografa(), pieno: !!document.querySelector('.did-pieno-ripiego #did-aur-taglio'),
        tela: didDemo.tela() && didDemo.tela().id }));
      assert.equal(taglio.f.quadro, 'taglio'); assert.equal(taglio.f.luogo, 'reykjavik'); assert.equal(taglio.f.kpTaglio, 5);
      assert.ok(taglio.pieno && taglio.tela === 'did-aur-taglio', 'il taglio a schermo intero, e si registra lui');
      await p.screenshot({ path: path.join(radice, 'work/aurora-8-colori.png') });
      await p.evaluate(() => AstroDemo.ferma());
      const dopo = await p.evaluate(() => didDemo.fotografa());
      assert.equal(dopo.luogo, 'casa', 'il luogo del banco torna com’era');
      assert.equal(dopo.kpTaglio, 6, 'e il suo Kp');
      assert.deepEqual(e, []);
      await contesto.close();
    });

    await prova('aurore: la narrazione non si taglia — ogni scena aspetta la fine della voce', async () => {
      const { pagina: p, contesto, errori: e } = await nuovaPagina({ intro: { attiva: false } });
      // Una voce lenta: ogni frase dura più della sua scena.
      await p.evaluate(() => { window.__durataVoce = 2600; });
      await p.evaluate(() => AstroDemo.avvia("define_demo lenta { scene planetarium_view { duration: 1s; action: narrate { id: 'demo.narr.aurora_boreale.1' }; } " +
        "scene planetarium_view { duration: 1s; action: narrate { id: 'demo.narr.aurora_boreale.11' }; } }"));
      await p.waitForTimeout(1800);
      const meta = await p.evaluate(() => ({ scena: AstroDemo.scena, stato: AstroDemo.stato,
        testo: document.querySelector('#demo-sottotitoli .narrazione-testo') && document.querySelector('#demo-sottotitoli .narrazione-testo').textContent }));
      assert.equal(meta.scena, 0, 'la scena aspetta la voce oltre la sua durata');
      assert.match(meta.testo || '', /Centocinquanta/, 'e il testo resta in vista');
      await p.waitForFunction(() => AstroDemo.scena === 1, null, { timeout: 5000 });
      const voce = await p.evaluate(() => window.__voce.map(v => v.testo));
      assert.equal(voce.length, 2);
      assert.match(voce[0], /Centocinquanta milioni/); assert.match(voce[1], /l'abbiamo vista brillare/);
      await p.waitForFunction(() => AstroDemo.stato === 'completato', null, { timeout: 6000 });
      assert.deepEqual(e, []);
      await contesto.close();
    });

    console.log(`\nIntro delle demo: ${passate} prove superate`);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
