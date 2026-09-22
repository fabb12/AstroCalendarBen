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
    const originale = await pagina.evaluate(() => {
      skyFermaPlayback();
      skyImpostaOffsetTempo((Date.parse('2026-09-22T19:00:00Z') - Date.now()) / 1000, { fluido: true });
      const prima = { quando: +skyAdesso(), target: sky.target, fov: sky.fov, telefono: sky.seguiTelefono };
      document.getElementById('demo-avvia').click();
      return prima;
    });
    await pagina.waitForTimeout(700);
    assert.equal(await pagina.evaluate(() => AstroDemo.stato), 'attivo');
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
    assert.deepEqual(errori, [], 'Nessuna eccezione browser');
    console.log('Demo browser: planetario, volo, ombra, orbita, pausa, stop e ripristino verificati');
  } finally {
    if (browser) await browser.close();
    await new Promise(r => server.close(r));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
