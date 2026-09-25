/* Prova della demo sulle viste reali, con Astronomy Engine locale.
 * npm install --no-save playwright astronomy-engine
 * npx playwright install chromium
 * node scripts/prova-demo-browser.js */
'use strict';
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const radice = path.resolve(__dirname, '..');
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.resolve(radice, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(radice + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader('Content-Type', tipi[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  let browser;
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origine = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch();
    const pagina = await browser.newPage({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
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
      localStorage.setItem('astrocalendario_posizione', JSON.stringify({
        lat: 45.4642, lon: 9.19, nome: 'Milano', fonte: 'manuale'
      }));
      localStorage.setItem('astrocal_lingua', 'it');
    });
    await pagina.goto(origine, { waitUntil: 'domcontentloaded' });
    await pagina.waitForFunction(() => typeof AstroDemo !== 'undefined' && typeof sky !== 'undefined' && sky.observer && sky.oggetti.length, null, { timeout: 30000 });
    // Gestione reale attraverso la nuova scheda, anche con sola tastiera.
    await pagina.locator('#btn-impostazioni').click();
    const larghezzaImpostazioni = await pagina.locator('#modale-impostazioni > .pannello-modale')
      .evaluate(el => el.getBoundingClientRect().width);
    assert.ok(larghezzaImpostazioni >= 900, 'Le Impostazioni sfruttano la larghezza desktop');
    await pagina.locator('#imp-tab-btn-demo').click();
    const builtins = await pagina.evaluate(() => AstroDemo.libreria.elenco().filter(d => d.solaLettura).map(d => {
      const demo = AstroDemo.valida(d.testo);
      return { chiave: d.chiave, scene: demo.scene.length, durata: demo.scene.reduce((n, s) => n + s.durata, 0) };
    }));
    assert.deepEqual(builtins.map(d => d.chiave),
      ['eclisse_tour', 'eclisse_lunare', 'aurora_boreale', 'allineamento_pianeti', 'passaggio_iss']);
    assert.deepEqual(builtins.map(d => d.durata), [114000, 57000, 53000, 45000, 36000]);
    assert.equal(await pagina.locator('#demo-elenco option').count(), builtins.length);
    for (const d of builtins) {
      await pagina.locator('#demo-elenco').selectOption(d.chiave);
      assert.equal(await pagina.locator('#demo-editor').getAttribute('readonly'), '');
      assert.equal(await pagina.locator('#demo-editor').isVisible(), false, 'Il DSL built-in resta chiuso');
      assert.equal(await pagina.locator('#demo-elimina').isDisabled(), true);
      assert.match(await pagina.locator('#demo-info').innerText(), new RegExp(d.scene + ' scene'));
      assert.ok((await pagina.locator('#demo-descrizione').innerText()).length > 45, 'Descrizione built-in: ' + d.chiave);
    }
    await pagina.evaluate(() => astroI18n.impostaLingua('en'));
    assert.match(await pagina.locator('#demo-elenco option[value="eclisse_lunare"]').innerText(), /Total lunar eclipse/);
    await pagina.evaluate(() => astroI18n.impostaLingua('it'));
    await pagina.locator('#demo-elenco').selectOption('eclisse_tour');
    assert.equal(await pagina.locator('#cielo-comandi #demo-avvia').count(), 0);
    assert.equal(await pagina.locator('#demo-editor').getAttribute('readonly'), '');
    assert.equal(await pagina.locator('#demo-elimina').isDisabled(), true);
    assert.match(await pagina.locator('#demo-info').innerText(), /7 scene.*114 s/);
    await pagina.locator('#demo-duplica').click();
    const testoBase = await pagina.locator('#demo-editor').inputValue();
    assert.match(testoBase, /define_demo 'eclisse_tour_copia'/, 'La copia prende un nome suo');
    await pagina.locator('#demo-editor').fill(testoBase.replace('end: 17:48', 'end: 25:00'));
    assert.equal(await pagina.locator('#demo-salva').isDisabled(), true);
    await pagina.locator('#demo-editor').fill(testoBase.replace('15s;', '15s'));
    assert.match(await pagina.locator('#demo-validazione').innerText(), /riga \d+, colonna \d+/);
    // La posizione è quella dell'errore, non la fine del file.
    await pagina.locator('#demo-editor').fill(testoBase.replace('duration: 15s;', 'duration: 15s; duration: 3s;'));
    assert.match(await pagina.locator('#demo-validazione').innerText(), /Durata duplicata \(riga 4,/);
    // In inglese anche i messaggi di validazione sono in inglese.
    await pagina.evaluate(() => astroI18n.impostaLingua('en'));
    await pagina.locator('#demo-editor').fill(testoBase.replace('degrees: 1.6', 'degrees: 400'));
    assert.match(await pagina.locator('#demo-validazione').innerText(), /^Field of view expected/);
    await pagina.locator('#demo-editor').fill(testoBase.replace('15s;', '15s'));
    assert.match(await pagina.locator('#demo-validazione').innerText(), /line \d+, column \d+/);
    await pagina.evaluate(() => astroI18n.impostaLingua('it'));
    await pagina.locator('#demo-editor').fill(testoBase.replace('eclisse_tour', 'mia_demo'));
    for (const snippet of ['planetarium_view', 'transition', 'solar_system_3d', 'timelapse', 'highlight_object', 'center_target', 'set_fov', 'frame_objects', 'orbit_object', 'zoom_view', 'didactic_view', 'zoom_fov', 'event_window',
      'camera_3d', 'aurora_lesson', 'satellite_pass', 'narrate']) {
      await pagina.locator('#demo-snippet').selectOption(snippet);
      await pagina.locator('#demo-inserisci').click();
      assert.equal(await pagina.locator('#demo-editor').getAttribute('aria-invalid'), 'false', snippet);
    }
    await pagina.locator('#demo-salva').click();
    assert.match(await pagina.locator('#demo-esito').innerText(), /salvato/);
    assert.equal(await pagina.locator('#demo-editor').isVisible(), true, 'Dopo il salvataggio l’editor resta aperto');
    console.log('Demo browser: editor e snippet verificati');
    const salvato = await pagina.locator('#demo-editor').inputValue();
    const chiaveUtente = await pagina.locator('#demo-elenco').inputValue();
    await pagina.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await pagina.waitForFunction(() => typeof AstroDemo !== 'undefined');
    await pagina.evaluate(() => mostraVista('cielo'));
    await pagina.waitForFunction(() => sky.observer && sky.oggetti.length);
    await pagina.locator('#btn-impostazioni').click();
    await pagina.locator('#imp-tab-btn-demo').click();
    await pagina.locator('#demo-elenco').selectOption(chiaveUtente);
    assert.equal(await pagina.locator('#demo-editor').inputValue(), salvato);
    assert.equal(await pagina.locator('#demo-editor').isVisible(), false, 'Editor personale chiuso finché non si chiede Modifica');
    await pagina.locator('#demo-modifica').click();
    // Export e import devono conservare il testo, senza eseguire nulla.
    const downloadAtteso = pagina.waitForEvent('download');
    await pagina.locator('#demo-esporta').click();
    const download = await downloadAtteso;
    assert.match(download.suggestedFilename(), /\.astrodemo$/);
    assert.equal(fs.readFileSync(await download.path(), 'utf8'), salvato);
    await pagina.locator('#demo-importa').setInputFiles({ name: 'errore.astrodemo', mimeType: 'text/plain', buffer: Buffer.from('evil()') });
    assert.equal(await pagina.locator('#demo-editor').inputValue(), salvato);
    await pagina.waitForFunction(() => /riga/.test(document.getElementById('demo-esito').textContent));
    assert.match(await pagina.locator('#demo-esito').innerText(), /riga/);
    await pagina.locator('#demo-importa').setInputFiles({ name: 'copia.astrodemo', mimeType: 'text/plain', buffer: Buffer.from(salvato) });
    await pagina.waitForFunction(() => document.getElementById('demo-elenco').value === '');
    await pagina.locator('#demo-salva').click();
    assert.equal(await pagina.locator('#demo-elenco option').count(), builtins.length + 2);
    await pagina.locator('#demo-modifica').click();
    pagina.once('dialog', dialog => dialog.accept());
    await pagina.locator('#demo-elimina').click();
    assert.equal(await pagina.locator('#demo-elenco option').count(), builtins.length + 1);
    // L'errore di quota è visibile e lascia intatta la bozza.
    await pagina.locator('#demo-elenco').selectOption(chiaveUtente);
    await pagina.locator('#demo-modifica').click();
    await pagina.locator('#demo-editor').fill(salvato.replace('mia_demo', 'modificata'));
    await pagina.evaluate(() => { window.demoSetItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('quota-demo'); }; });
    await pagina.locator('#demo-salva').click();
    assert.match(await pagina.locator('#demo-esito').innerText(), /quota-demo/);
    await pagina.evaluate(() => { Storage.prototype.setItem = window.demoSetItem; });
    await pagina.locator('#demo-salva').click();
    assert.match(await pagina.locator('#demo-esito').innerText(), /salvato/);
    await pagina.locator('#demo-elenco').selectOption('eclisse_tour');
    console.log('Demo browser: persistenza, import/export, modifica ed eliminazione verificati');
    const originale = await pagina.evaluate(() => {
      skyFermaPlayback();
      skyImpostaOffsetTempo((Date.parse('2026-09-22T19:00:00Z') - Date.now()) / 1000, { fluido: true });
      const prima = { quando: +skyAdesso(), target: sky.target, fov: sky.fov, telefono: sky.seguiTelefono,
        schermoIntero: sky.schermoIntero };
      skyMostraGruppo('astri');
      return prima;
    });
    await pagina.locator('#demo-avvia').click();
    assert.equal(await pagina.locator('#modale-impostazioni').isVisible(), false);
    await pagina.waitForTimeout(700);
    assert.equal(await pagina.evaluate(() => AstroDemo.stato), 'attivo');
    assert.equal(await pagina.evaluate(() => sky.schermoIntero), originale.schermoIntero,
      'La demo lascia invariato lo stato dello schermo intero');
    assert.equal(await pagina.evaluate(() =>
      document.fullscreenElement === document.getElementById('skymap-contenitore') || sky.fintoSchermoIntero),
    false, 'La demo non attiva schermo intero nativo o ripiego CSS');
    assert.equal(await pagina.evaluate(() => document.getElementById('cielo-comandi').dataset.gruppoAttivo), 'astri',
      'La vista pulita conserva il pannello aperto senza cambiarne lo stato');
    assert.equal(await pagina.evaluate(() => getComputedStyle(document.getElementById('cielo-comandi')).visibility), 'hidden',
      'La vista pulita nasconde il menu del planetario durante la demo');
    assert.equal(await pagina.evaluate(() => sky.target), 'Sun');
    assert.ok((await pagina.evaluate(() => sky.fov)) < 40, 'Il campo si stringe sul Sole');
    const scenaSolare = await pagina.evaluate(() => ({
      data: skyAdesso().toISOString(), lat: sky.observer.latitude, lon: sky.observer.longitude
    }));
    assert.ok(scenaSolare.data.startsWith('2026-08-12T16:4'));
    assert.ok(Math.abs(scenaSolare.lat - 64.1466) < 0.0001 && Math.abs(scenaSolare.lon + 21.9426) < 0.0001,
      'La prima scena usa Reykjavík');
    await pagina.evaluate(() => AstroDemo.pausa());
    const pausaCielo = await pagina.evaluate(() => +skyAdesso());
    await pagina.waitForTimeout(350);
    assert.equal(await pagina.evaluate(() => +skyAdesso()), pausaCielo);
    await pagina.evaluate(() => AstroDemo.riprendi());
    await pagina.evaluate(() => AstroDemo.vaiAScena(3));
    await pagina.waitForFunction(() => solVolo.attivo, null, { timeout: 15000 });
    await pagina.waitForTimeout(300);
    await pagina.evaluate(() => AstroDemo.pausa());
    const posaVolo = await pagina.evaluate(() => document.getElementById('sol-transizione-tela').toDataURL());
    await pagina.waitForTimeout(400);
    assert.equal(await pagina.evaluate(() => document.getElementById('sol-transizione-tela').toDataURL()), posaVolo, 'Volo fermo in pausa');
    assert.equal(await pagina.evaluate(() => solVolo.raf), 0, 'Nessun secondo orologio del volo');
    await pagina.evaluate(() => AstroDemo.riprendi());
    await pagina.waitForFunction(() => sol.vicino, null, { timeout: 15000 });
    await pagina.evaluate(() => AstroDemo.vaiAScena(5));
    const eclipse = await pagina.evaluate(() => ({
      tipo: solStatoEclissi(skyAdesso()).tipo,
      ombra: !!solOmbraLunareSuTerra(skyAdesso()),
      data: skyAdesso().toISOString(), az: sol.az
    }));
    assert.ok(eclipse.ombra && eclipse.tipo !== 'niente');
    assert.ok(eclipse.data.startsWith('2026-08-12'));
    await pagina.waitForTimeout(600);
    assert.notEqual(await pagina.evaluate(() => sol.az), eclipse.az, 'Orbita in movimento');
    await pagina.evaluate(() => AstroDemo.pausa());
    const posa = await pagina.evaluate(() => sol.az);
    await pagina.waitForTimeout(350);
    assert.equal(await pagina.evaluate(() => sol.az), posa, 'Orbita ferma in pausa');
    const centro = await pagina.evaluate(() => {
      solMisura();
      const p = solVicPunto([0, 0, 0]);
      return { x: p.px, y: p.py, L: sol.L, H: sol.H };
    });
    assert.ok(Math.abs(centro.x - centro.L / 2) < 2 && Math.abs(centro.y - centro.H / 2) < 2, 'Terra al centro');
    fs.mkdirSync(path.join(radice, 'work'), { recursive: true });
    await pagina.screenshot({ path: path.join(radice, 'work/demo-eclisse-solare.png') });
    await pagina.evaluate(() => AstroDemo.riprendi());
    await pagina.waitForFunction(() => AstroDemo.stato === 'completato', null, { timeout: 45000 });
    const dopo = await pagina.evaluate(() => ({
      quando: +skyAdesso(), target: sky.target, fov: sky.fov, telefono: sky.seguiTelefono,
      aperto: sol.aperto, evidenza: AstroDemo.evidenza('Venus'), schermoIntero: sky.schermoIntero
    }));
    assert.deepEqual({ quando: dopo.quando, target: dopo.target, fov: dopo.fov, telefono: dopo.telefono,
      schermoIntero: dopo.schermoIntero }, originale);
    assert.equal(dopo.aperto, false); assert.equal(dopo.evidenza, 1);
    assert.equal(await pagina.evaluate(() => sky.schermoIntero), originale.schermoIntero,
      'La demo conserva lo stato iniziale dello schermo');
    // Una chiusura nello stesso turno dell'apertura annulla anche il callback differito.
    await pagina.evaluate(() => {
      AstroDemo.avvia("define_demo x { scene transition { duration: 5s; action: zoom_view { type: geometric, final_target: solar_system_3d }; }}");
      AstroDemo.ferma();
    });
    await pagina.waitForTimeout(150);
    assert.equal(await pagina.evaluate(() => sol.aperto || solVolo.attivo), false);
    await pagina.emulateMedia({ reducedMotion: 'reduce' });
    await pagina.evaluate(() => AstroDemo.avvia("define_demo x { scene solar_system_3d { duration: 2s; action: orbit_object { object: 'Earth-Moon', angle: 360, speed: slow }; }}"));
    await pagina.waitForTimeout(300);
    const ridotta = await pagina.evaluate(() => sol.az);
    await pagina.waitForTimeout(300);
    assert.equal(await pagina.evaluate(() => sol.az), ridotta, 'Preferenza movimento ridotto rispettata');
    await pagina.evaluate(() => AstroDemo.ferma());
    // Escape ripristina; camera e filtri restano controllabili senza fermare la demo.
    const fotografia = () => pagina.evaluate(() => ({
      manuale: { ...sky.manuale }, target: sky.target, inseguimento: sky.inseguimento,
      pianeti: sky.mostraPianeti, soleLuna: sky.mostraSoleLuna, sotto: sky.mostraSottoOrizzonte,
      fov: sky.fov, fovVoluto: sky.fovVoluto, tempo: sky.istanteSimulatoMs,
      passo: sky.passoTempoSec, playback: sky.playbackVerso, modalita: sky.modalitaTempo,
      sol: [sol.az, sol.elev, sol.zoom, sol.panX, sol.panY, sol.vicino]
    }));
    const primaStop = await fotografia();
    await pagina.evaluate(() => AstroDemo.avvia());
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.evaluate(() => AstroDemo.stato), 'fermo');
    assert.deepEqual(await fotografia(), primaStop);
    // Questo blocco prova apposta l'interazione coi controlli normali: la
    // vista pulita va quindi spenta, e la finestra Impostazioni ripristinata
    // dalla demo precedente va chiusa prima dei clic sul planetario.
    await pagina.evaluate(() => {
      AstroDemo.impostaOpzioni({ vistaPulita: false });
      document.getElementById('modale-impostazioni').classList.add('hidden');
    });
    await pagina.evaluate(() => AstroDemo.avvia("define_demo interattiva { scene planetarium_view { duration: 5s; action: point_view { az: 120, alt: 25 }; }}"));
    await pagina.locator('[data-vai-gruppo="vista"]').click();
    await pagina.locator('#scheda-vista-oggetti').click();
    await pagina.locator('#skymap-btn-pianeti').click();
    const controlloDurante = await pagina.evaluate(() => ({
      stato: AstroDemo.stato, pianeti: sky.mostraPianeti, az: sky.manuale.az
    }));
    assert.equal(controlloDurante.stato, 'attivo', 'Il controllo di visualizzazione non ferma la demo');
    assert.equal(controlloDurante.pianeti, false, 'Il filtro resta modificabile durante la demo');
    await pagina.locator('[data-vai-gruppo="vista"]').click();
    const tela = await pagina.locator('#skymap-canvas').boundingBox();
    assert.ok(tela, 'Tela del planetario disponibile');
    await pagina.mouse.move(tela.x + tela.width * 0.3, tela.y + tela.height * 0.35);
    await pagina.mouse.down();
    await pagina.mouse.move(tela.x + tela.width * 0.45, tela.y + tela.height * 0.35, { steps: 4 });
    await pagina.mouse.up();
    assert.equal(await pagina.evaluate(() => AstroDemo.stato), 'attivo', 'Il trascinamento della camera non ferma la demo');
    assert.notEqual(await pagina.evaluate(() => sky.manuale.az), controlloDurante.az, 'La camera risponde durante la demo');
    await pagina.evaluate(() => AstroDemo.ferma());
    assert.deepEqual(await fotografia(), primaStop);
    // La rotellina non passa da pointerdown: deve cedere la camera lo stesso,
    // se no set_fov rimette il suo campo a ogni fotogramma.
    await pagina.evaluate(() => AstroDemo.avvia("define_demo zoom { scene planetarium_view { duration: 5s; action: set_fov { degrees: 20 }; }}"));
    await pagina.waitForTimeout(200);
    await pagina.mouse.move(tela.x + tela.width / 2, tela.y + tela.height / 2);
    await pagina.mouse.wheel(0, 400);
    await pagina.waitForTimeout(600);
    assert.ok(await pagina.evaluate(() => sky.fovVoluto > 21), 'La rotellina cambia lo zoom durante la demo');
    assert.equal(await pagina.evaluate(() => AstroDemo.stato), 'attivo', 'La rotellina non ferma la demo');
    await pagina.evaluate(() => AstroDemo.ferma());
    assert.deepEqual(await fotografia(), primaStop, 'Dopo lo zoom manuale il ripristino è completo');
    await pagina.evaluate(() => AstroDemo.impostaOpzioni({ vistaPulita: true }));
    // L'ombra si cerca vicino alla data della demo, non sempre nel 2026.
    const ombra2027 = await pagina.evaluate(() => {
      AstroDemo.avvia("define_demo ombra { scene planetarium_view { duration: 1s; action: set_date { iso: '2027-07-20T00:00:00Z' }; action: set_fov { degrees: 20 }; }" +
        " scene solar_system_3d { duration: 5s; action: center { target: 'Eclipse Shadow' }; }}");
      return new Promise(r => setTimeout(() => {
        const esito = { data: skyAdesso().toISOString(), ombra: !!solOmbraLunareSuTerra(skyAdesso()) };
        AstroDemo.ferma(); r(esito);
      }, 1600));
    });
    assert.ok(ombra2027.data.startsWith('2027-08-02') && ombra2027.ombra, 'Eclisse del 2 agosto 2027: ' + ombra2027.data);
    assert.deepEqual(await fotografia(), primaStop);
    await pagina.evaluate(() => {
      AstroDemo.avvia();
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    assert.equal(await pagina.evaluate(() => AstroDemo.stato), 'pausa');
    await pagina.evaluate(() => AstroDemo.ferma());
    // Un'ora che salta per il cambio d'ora deve bloccare già il salvataggio.
    const civile = await pagina.evaluate(() => {
      const luogo = sky.luogoVista, ms = +skyAdesso();
      sky.luogoVista = { lat: 45.46, lon: 9.19, fuso: 'Europe/Rome' };
      skyImpostaOffsetTempo((Date.parse('2026-03-29T00:00:00Z') - Date.now()) / 1000, { fluido: true });
      let errore = '';
      try { AstroDemo.libreria.salva("define_demo dst { scene planetarium_view { duration: 1s; action: timelapse { start: 02:30, end: 04:00 }; }}"); }
      catch (e) { errore = e.message; }
      sky.luogoVista = luogo;
      skyImpostaOffsetTempo((ms - Date.now()) / 1000, { fluido: true });
      return errore;
    });
    assert.match(civile, /Ora civile inesistente/);
    const nuovo = await pagina.evaluate(() => {
      const prima = { tempo: +skyAdesso(), luogo: sky.luogoVista && { ...sky.luogoVista },
        casa: [sky.posizione.lat, sky.posizione.lon],
        lat: sky.observer.latitude, lon: sky.observer.longitude, aurora: [aur.acceso, aur.kpSimulato] };
      for (const comando of [
        "set_date { iso: '2028-02-30T12:00:00Z' }",
        "set_location { lat: 91, lon: 18, name: 'X', timezone: 'Europe/Oslo' }",
        "set_location { lat: 69, lon: 18, name: 'X', timezone: 'No/Such_Zone' }",
        'simulate_aurora { kp: 10 }',
        'set_fov { degrees: 200 }'
      ]) {
        try { AstroDemo.valida('define_demo nonvalida { scene planetarium_view { duration: 1s; action: ' + comando + '; }}');
          throw new Error('Comando non valido accettato: ' + comando);
        } catch (e) { if (e.message.startsWith('Comando non valido accettato')) throw e; }
      }
      return prima;
    });
    for (const [chiave, data, lat, lon] of [
      ['eclisse_lunare', '2028-12-31T15:0', 43.0618, 141.3545],
      ['aurora_boreale', '2027-01-15T19:00:00', 60.1699, 24.9384],
      ['allineamento_pianeti', '2028-10-21T12:45:00', 32.2226, -110.9747]
    ]) {
      await pagina.locator('#btn-impostazioni').click();
      await pagina.locator('#imp-tab-btn-demo').click();
      await pagina.locator('#demo-elenco').selectOption(chiave);
      await pagina.locator('#demo-avvia').click();
      // Il banco delle aurore apre il racconto: il cielo di Tromsø arriva
      // alla sesta scena, e ci si salta per guardarlo senza aspettare.
      const primaScena = await pagina.locator('#demo-controlli p').innerText();
      if (chiave === 'aurora_boreale') {
        assert.match(primaScena, /^Aurora boreale.* — scena 1\/7 · Didattica/, 'Aurora: prima il banco didattico');
        await pagina.evaluate(() => AstroDemo.vaiAScena(5));
      }
      if (chiave === 'eclisse_lunare') await pagina.evaluate(() => AstroDemo.vaiAScena(1));
      const durante = await pagina.evaluate(() => ({ stato: AstroDemo.stato, tempo: skyAdesso().toISOString(),
        lat: sky.observer.latitude, lon: sky.observer.longitude, aurora: [aur.acceso, aur.kpSimulato] }));
      assert.equal(durante.stato, 'attivo', chiave);
      assert.match(await pagina.locator('#demo-controlli p').innerText(),
        new RegExp('^' + { eclisse_lunare: 'Eclisse lunare', aurora_boreale: 'Aurora boreale',
          allineamento_pianeti: 'Corteo dei pianeti' }[chiave] + '.* — scena \\d/\\d · Planetario'),
        chiave + ': pannello con titolo e scena');
      assert.ok(durante.tempo.startsWith(data), chiave + ': istante astronomico');
      assert.ok(Math.abs(durante.lat - lat) < 0.0001 && Math.abs(durante.lon - lon) < 0.0001,
        chiave + ': coordinate temporanee');
      if (chiave === 'aurora_boreale') {
        assert.deepEqual(durante.aurora, [true, 5]);
        assert.ok(await pagina.evaluate(() => sky.fov) >= 59, 'Aurora a campo largo');
      }
      if (chiave === 'eclisse_lunare') {
        const reale = await pagina.evaluate(() => {
          const evento = Astronomy.SearchLunarEclipse(new Date('2028-12-01T00:00:00Z'));
          const q = Astronomy.Equator('Moon', evento.peak.date, sky.observer, true, true);
          return { kind: evento.kind, data: evento.peak.date.toISOString(),
            alt: Astronomy.Horizon(evento.peak.date, sky.observer, q.ra, q.dec, 'normal').altitude,
            fov: sky.fov, target: sky.target };
        });
        assert.equal(reale.kind, 'total');
        assert.ok(reale.data.startsWith('2028-12-31T16:51') && reale.alt > 0);
        assert.equal(reale.target, 'Moon');
        assert.ok(reale.fov <= 4, 'Luna ingrandita durante la demo');
        await pagina.screenshot({ path: path.join(radice, 'work/demo-eclisse-lunare.png') });
      }
      if (chiave === 'allineamento_pianeti') {
        const quadro = await pagina.evaluate(() => {
          skyDisegna();
          const altezze = Object.fromEntries(
            ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter'].map(nome => {
              const q = Astronomy.Equator(nome, skyAdesso(), sky.observer, true, true);
              return [nome, Astronomy.Horizon(skyAdesso(), sky.observer, q.ra, q.dec, 'normal').altitude];
            }));
          const dentro = Object.fromEntries(['Mercury', 'Venus', 'Mars', 'Jupiter'].map(nome => {
            const o = sky.oggetti.find(x => x.id === nome);
            const p = o && skyProietta(skyVettore(o.az, o.alt), sky.ultimaBase, sky.ultimaFocale);
            return [nome, !!(p && p.davanti && p.px >= 0 && p.px <= sky.larghezza && p.py >= 0 && p.py <= sky.altezza)];
          }));
          return { altezze, dentro, fov: sky.fov };
        });
        assert.ok(quadro.altezze.Sun < -6 && ['Mercury', 'Venus', 'Mars', 'Jupiter'].every(n => quadro.altezze[n] > 5),
          'Quattro pianeti realmente sopra l’orizzonte prima dell’alba');
        assert.ok(['Mercury', 'Venus', 'Mars', 'Jupiter'].filter(n => quadro.dentro[n]).length >= 3,
          'Il corteo è realmente nel quadro');
        assert.ok(quadro.fov >= 70, 'Campo largo per il corteo');
        await pagina.screenshot({ path: path.join(radice, 'work/demo-allineamento-pianeti.png') });
      }
      if (chiave === 'aurora_boreale')
        await pagina.screenshot({ path: path.join(radice, 'work/demo-aurora.png') });
      await pagina.keyboard.press('Escape');
      assert.deepEqual(await pagina.evaluate(() => ({ tempo: +skyAdesso(),
        luogo: sky.luogoVista && { ...sky.luogoVista }, casa: [sky.posizione.lat, sky.posizione.lon],
        lat: sky.observer.latitude,
        lon: sky.observer.longitude, aurora: [aur.acceso, aur.kpSimulato] })), nuovo,
      chiave + ': ripristino di data, luogo e aurora');
    }
    await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.locator('#btn-impostazioni').click();
    await pagina.locator('#imp-tab-btn-demo').click();
    assert.equal(await pagina.locator('#demo-editor').isVisible(), false, 'Editor avanzato chiuso su mobile');
    const overflow = await pagina.evaluate(() => document.getElementById('imp-tab-demo').scrollWidth <=
      document.getElementById('imp-tab-demo').clientWidth + 1);
    assert.equal(overflow, true, 'Nessun overflow orizzontale nella scheda demo');
    await pagina.locator('#demo-avanzate summary').click();
    assert.ok(await pagina.locator('#demo-editor').isVisible());
    await pagina.screenshot({ path: path.join(radice, 'work/demo-impostazioni.png') });
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.locator('#modale-impostazioni').isVisible(), false, 'Esc chiude le Impostazioni');
    assert.deepEqual(errori, [], 'Nessuna eccezione browser');
    console.log('Demo browser: planetario, volo, ombra, orbita, pausa, stop e ripristino verificati');
  } finally {
    if (browser) await browser.close();
    await new Promise(r => server.close(r));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
