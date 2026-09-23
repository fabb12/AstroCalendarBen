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
    await pagina.locator('#imp-tab-btn-demo').click();
    const builtins = await pagina.evaluate(() => AstroDemo.libreria.elenco().filter(d => d.solaLettura).map(d => {
      const demo = AstroDemo.valida(d.testo);
      return { chiave: d.chiave, scene: demo.scene.length, durata: demo.scene.reduce((n, s) => n + s.durata, 0) };
    }));
    assert.deepEqual(builtins.map(d => d.chiave),
      ['eclisse_tour', 'eclisse_lunare', 'aurora_boreale', 'allineamento_pianeti']);
    assert.deepEqual(builtins.map(d => d.durata), [30000, 24000, 20000, 22000]);
    assert.equal(await pagina.locator('#demo-elenco option').count(), builtins.length);
    for (const d of builtins) {
      await pagina.locator('#demo-elenco').selectOption(d.chiave);
      assert.equal(await pagina.locator('#demo-editor').getAttribute('readonly'), '');
      assert.equal(await pagina.locator('#demo-elimina').isDisabled(), true);
      assert.match(await pagina.locator('#demo-info').innerText(), new RegExp(d.scene + ' scene'));
      assert.ok((await pagina.locator('#demo-info').innerText()).length > 85, 'Descrizione built-in: ' + d.chiave);
    }
    await pagina.evaluate(() => astroI18n.impostaLingua('en'));
    assert.match(await pagina.locator('#demo-elenco option[value="eclisse_lunare"]').innerText(), /Total lunar eclipse/);
    await pagina.evaluate(() => astroI18n.impostaLingua('it'));
    await pagina.locator('#demo-elenco').selectOption('eclisse_tour');
    assert.equal(await pagina.locator('#cielo-comandi #demo-avvia').count(), 0);
    assert.equal(await pagina.locator('#demo-editor').getAttribute('readonly'), '');
    assert.equal(await pagina.locator('#demo-elimina').isDisabled(), true);
    assert.match(await pagina.locator('#demo-info').innerText(), /3 scene.*30 s/);
    await pagina.locator('#demo-duplica').click();
    const testoBase = await pagina.locator('#demo-editor').inputValue();
    await pagina.locator('#demo-editor').fill(testoBase.replace('18:00', '25:00'));
    assert.equal(await pagina.locator('#demo-salva').isDisabled(), true);
    await pagina.locator('#demo-editor').fill(testoBase.replace('10s;', '10s'));
    assert.match(await pagina.locator('#demo-validazione').innerText(), /riga \d+, colonna \d+/);
    await pagina.locator('#demo-editor').fill(testoBase.replace('eclisse_tour', 'mia_demo'));
    for (const snippet of ['planetarium_view', 'transition', 'solar_system_3d', 'timelapse', 'highlight_object', 'center_target', 'orbit_object', 'zoom_view']) {
      await pagina.locator('#demo-snippet').selectOption(snippet);
      await pagina.locator('#demo-inserisci').click();
      assert.equal(await pagina.locator('#demo-editor').getAttribute('aria-invalid'), 'false', snippet);
    }
    await pagina.locator('#demo-salva').click();
    assert.match(await pagina.locator('#demo-esito').innerText(), /salvato/);
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
    pagina.once('dialog', dialog => dialog.accept());
    await pagina.locator('#demo-elimina').click();
    assert.equal(await pagina.locator('#demo-elenco option').count(), builtins.length + 1);
    // L'errore di quota è visibile e lascia intatta la bozza.
    await pagina.locator('#demo-elenco').selectOption(chiaveUtente);
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
      const prima = { quando: +skyAdesso(), target: sky.target, fov: sky.fov, telefono: sky.seguiTelefono };
      skyMostraGruppo('astri');
      return prima;
    });
    await pagina.locator('#demo-avvia').click();
    assert.equal(await pagina.locator('#modale-impostazioni').isVisible(), false);
    await pagina.waitForTimeout(700);
    assert.equal(await pagina.evaluate(() => AstroDemo.stato), 'attivo');
    assert.equal(await pagina.evaluate(() => document.getElementById('cielo-comandi').dataset.gruppoAttivo), '');
    assert.equal(await pagina.locator('.gruppo-comandi.gruppo-attivo').count(), 0, 'Il menu del planetario è chiuso durante la demo');
    assert.equal(await pagina.evaluate(() => sky.target), 'Venus');
    assert.equal(await pagina.evaluate(() => AstroDemo.evidenza('Venus')), 5);
    const oraCielo = await pagina.evaluate(() => partiDataDelLuogo(skyAdesso(), skyLuogoDelCielo()).hour);
    assert.ok(oraCielo >= 18 && oraCielo < 22);
    await pagina.evaluate(() => AstroDemo.pausa());
    const pausaCielo = await pagina.evaluate(() => +skyAdesso());
    await pagina.waitForTimeout(350);
    assert.equal(await pagina.evaluate(() => +skyAdesso()), pausaCielo);
    await pagina.evaluate(() => AstroDemo.riprendi());
    await pagina.waitForFunction(() => solVolo.attivo, null, { timeout: 15000 });
    await pagina.waitForTimeout(300);
    await pagina.evaluate(() => AstroDemo.pausa());
    const posaVolo = await pagina.evaluate(() => document.getElementById('sol-transizione-tela').toDataURL());
    await pagina.waitForTimeout(400);
    assert.equal(await pagina.evaluate(() => document.getElementById('sol-transizione-tela').toDataURL()), posaVolo, 'Volo fermo in pausa');
    assert.equal(await pagina.evaluate(() => solVolo.raf), 0, 'Nessun secondo orologio del volo');
    await pagina.evaluate(() => AstroDemo.riprendi());
    await pagina.waitForFunction(() => sol.vicino, null, { timeout: 8000 });
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
      const p = solVicPunto(solOmbraLunareSuTerra(skyAdesso()).centro);
      return { x: p.px, y: p.py, L: sol.L, H: sol.H };
    });
    assert.ok(Math.abs(centro.x - centro.L / 2) < 2 && Math.abs(centro.y - centro.H / 2) < 2, 'Ombra centrata');
    fs.mkdirSync(path.join(radice, 'work'), { recursive: true });
    await pagina.screenshot({ path: path.join(radice, 'work/demo-eclisse.png') });
    await pagina.evaluate(() => AstroDemo.riprendi());
    await pagina.waitForFunction(() => AstroDemo.stato === 'completato', null, { timeout: 20000 });
    const dopo = await pagina.evaluate(() => ({
      quando: +skyAdesso(), target: sky.target, fov: sky.fov, telefono: sky.seguiTelefono,
      aperto: sol.aperto, evidenza: AstroDemo.evidenza('Venus')
    }));
    assert.deepEqual({ quando: dopo.quando, target: dopo.target, fov: dopo.fov, telefono: dopo.telefono }, originale);
    assert.equal(dopo.aperto, false); assert.equal(dopo.evidenza, 1);
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
    // Escape, click esterno e cambio scheda mantengono il contratto di ripristino.
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
    await pagina.evaluate(() => AstroDemo.avvia());
    await pagina.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
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
        'simulate_aurora { kp: 10 }'
      ]) {
        try { AstroDemo.valida('define_demo nonvalida { scene planetarium_view { duration: 1s; action: ' + comando + '; }}');
          throw new Error('Comando non valido accettato: ' + comando);
        } catch (e) { if (e.message.startsWith('Comando non valido accettato')) throw e; }
      }
      return prima;
    });
    for (const [chiave, data, lat, lon] of [
      ['eclisse_lunare', '2028-12-31T15:45:00', 43.0618, 141.3545],
      ['aurora_boreale', '2027-01-15T20:00:00', 69.6492, 18.9553],
      ['allineamento_pianeti', '2028-10-21T12:45:00', 32.2226, -110.9747]
    ]) {
      await pagina.locator('#btn-impostazioni').click();
      await pagina.locator('#imp-tab-btn-demo').click();
      await pagina.locator('#demo-elenco').selectOption(chiave);
      await pagina.locator('#demo-avvia').click();
      const durante = await pagina.evaluate(() => ({ stato: AstroDemo.stato, tempo: skyAdesso().toISOString(),
        lat: sky.observer.latitude, lon: sky.observer.longitude, aurora: [aur.acceso, aur.kpSimulato] }));
      assert.equal(durante.stato, 'attivo', chiave);
      assert.ok(durante.tempo.startsWith(data), chiave + ': istante astronomico');
      assert.ok(Math.abs(durante.lat - lat) < 0.0001 && Math.abs(durante.lon - lon) < 0.0001,
        chiave + ': coordinate temporanee');
      if (chiave === 'aurora_boreale') assert.deepEqual(durante.aurora, [true, 5]);
      if (chiave === 'eclisse_lunare') {
        const reale = await pagina.evaluate(() => {
          const evento = Astronomy.SearchLunarEclipse(new Date('2028-12-01T00:00:00Z'));
          const q = Astronomy.Equator('Moon', evento.peak.date, sky.observer, true, true);
          return { kind: evento.kind, data: evento.peak.date.toISOString(),
            alt: Astronomy.Horizon(evento.peak.date, sky.observer, q.ra, q.dec, 'normal').altitude };
        });
        assert.equal(reale.kind, 'total');
        assert.ok(reale.data.startsWith('2028-12-31T16:51') && reale.alt > 0);
      }
      if (chiave === 'allineamento_pianeti') {
        const altezze = await pagina.evaluate(() => Object.fromEntries(
          ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter'].map(nome => {
            const q = Astronomy.Equator(nome, skyAdesso(), sky.observer, true, true);
            return [nome, Astronomy.Horizon(skyAdesso(), sky.observer, q.ra, q.dec, 'normal').altitude];
          })));
        assert.ok(altezze.Sun < -6 && ['Mercury', 'Venus', 'Mars', 'Jupiter'].every(n => altezze[n] > 5),
          'Quattro pianeti realmente sopra l’orizzonte prima dell’alba');
      }
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
    assert.ok(await pagina.locator('#demo-editor').isVisible());
    await pagina.screenshot({ path: path.join(radice, 'work/demo-impostazioni.png') });
    assert.deepEqual(errori, [], 'Nessuna eccezione browser');
    console.log('Demo browser: planetario, volo, ombra, orbita, pausa, stop e ripristino verificati');
  } finally {
    if (browser) await browser.close();
    await new Promise(r => server.close(r));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
