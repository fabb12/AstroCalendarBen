'use strict';
// node scripts/prova-riserve-rete.js — nessuna API esterna viene interrogata.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const leggi = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const app = leggi('app.js'), terreno = leggi('terreno.js'), aerei = leggi('aerei.js');
const meteoCodice = app.slice(app.indexOf('const meteoReteCode'), app.indexOf('let fusoRichieste'));
const rasterCodice = terreno.slice(terreno.indexOf('const terrenoRasterCache'), terreno.indexOf('// =====================================================================\n// 5.'));
const memoria = new Map();
const storage = { getItem: k => memoria.get(k) || null, setItem: (k, v) => memoria.set(k, v) };
function contesto(extra = {}) {
  return vm.createContext({ console, URL, Response, AbortController, setTimeout, clearTimeout,
    localStorage: storage, ...extra });
}
function funzione(s, nome) {
  const inizio = s.indexOf('function ' + nome + '(');
  const fine = s.indexOf('\n  }', inizio);
  return s.slice(inizio, fine + 4);
}
(async () => {
  let richieste = 0;
  const c = contesto({ fetch: async () => {
    richieste++;
    return new Response('{}', { status: 429, headers: { 'Retry-After': '3600' } });
  } });
  vm.runInContext(meteoCodice, c);
  await Promise.allSettled(Array.from({ length: 12 }, (_, i) => c.meteoFetch('https://api.open-meteo.com/v1/forecast?q=' + i)));
  assert.equal(richieste, 1, 'Un solo 429 per tutte le viste in coda');
  const pausa = JSON.parse(memoria.get('astrocal_meteo_pausa_api.open-meteo.com'));
  assert.ok(pausa.fino >= Date.now() + 3590000, 'Retry-After rispettato');
  const reload = contesto({ fetch: async () => { richieste++; return new Response('{}'); } });
  vm.runInContext(meteoCodice, reload);
  await assert.rejects(reload.meteoFetch('https://api.open-meteo.com/v1/forecast'));
  assert.equal(richieste, 1, 'La ricarica non aggira la pausa');
  memoria.clear();
  const buono = contesto({ fetch: async () => { richieste++; return new Response('{"ok":true}'); } });
  vm.runInContext(meteoCodice, buono);
  const rs = await Promise.all([buono.meteoFetch('https://api.open-meteo.com/a'), buono.meteoFetch('https://api.open-meteo.com/a')]);
  assert.equal(richieste, 2, 'Richieste uguali deduplicate');
  assert.deepEqual(await rs[0].json(), await rs[1].json(), 'Corpi leggibili indipendentemente');
  memoria.clear();
  const offline = contesto({ fetch: async () => { throw new TypeError('Failed to fetch'); } });
  vm.runInContext(meteoCodice, offline);
  await assert.rejects(offline.meteoFetch('https://api.open-meteo.com/a'));
  assert.ok(JSON.parse(memoria.get('astrocal_meteo_pausa_api.open-meteo.com')).fino > Date.now());

  let immagini = 0, attive = 0, massimo = 0, guasta = false;
  class Immagine {
    constructor() { this.naturalWidth = this.naturalHeight = 256; }
    set src(url) {
      if (!url) return;
      immagini++; attive++; massimo = Math.max(massimo, attive);
      setTimeout(() => { attive--; if (guasta) this.onerror(); else this.onload(); }, 1);
    }
  }
  const pixel = new Uint8ClampedArray(256 * 256 * 4);
  for (let i = 0; i < pixel.length; i += 4) { pixel[i] = 128; pixel[i + 1] = 100; pixel[i + 3] = 255; }
  const raster = contesto({ Image: Immagine, document: { createElement: () => ({ getContext: () => ({
    drawImage() {}, getImageData: () => ({ data: pixel })
  }) }) }, TERRENO_TENTATIVI: 2, terrenoRiprovabile: () => true,
  terrenoInFila: async () => { throw Object.assign(new Error('quote esaurite'), { porteChiuse: true }); } });
  vm.runInContext(rasterCodice, raster);
  const punti = Array.from({ length: 20 }, () => ({ lat: 47.3668, lon: 8.5498 }));
  const quote = await raster.terrenoQuoteInsistendo(punti, 0);
  assert.ok(quote.every(q => Math.abs(q - 100) < 1e-6), 'API esaurite: quote dal DEM');
  assert.equal(immagini, 1, 'Tessera condivisa tra tutti i punti');
  await raster.terrenoQuoteRaster(Array.from({ length: 12 }, (_, i) => ({ lat: 40, lon: i * 2 })));
  assert.ok(massimo <= 3, 'Al massimo tre PNG insieme');
  await raster.terrenoQuoteRaster([{ lat: 0, lon: 180 }, { lat: 0, lon: -180 }]);
  await assert.rejects(raster.terrenoQuoteRaster([{ lat: 89, lon: 0 }]));
  guasta = true;
  const prima = immagini;
  await assert.rejects(raster.terrenoQuoteRaster([{ lat: -35, lon: 33 }]));
  await assert.rejects(raster.terrenoQuoteRaster([{ lat: -35, lon: 33 }]));
  assert.equal(immagini, prima + 1, 'Tessera guasta non richiesta in ciclo');

  const adsb = contesto({ window: {}, avvisaSeManca() {}, urlProxy: () => '',
    providersPredefiniti: [{ nome: 'diretta' }], providersPonte: () => [{ nome: 'ponte' }],
    interpretaAdsbExchange() {}, salute: new Map([['ponte', { penaleFino: Date.now() + 60000 }]]) });
  vm.runInContext(funzione(aerei, 'providersDisponibili') + '\n' + funzione(aerei, 'ordinaPerSalute'), adsb);
  assert.equal(adsb.providersDisponibili().length, 1);
  assert.equal(adsb.providersDisponibili()[0].nome, 'ponte', 'Niente chiamate dirette senza CORS');
  assert.equal(adsb.ordinaPerSalute(adsb.providersDisponibili()).length, 0, 'Porte in pausa saltate');

  memoria.clear();
  const nuvole = contesto({ luogoCorrente: () => ({ lat: 47.36, lon: 8.55 }), meteoFetch: async () => { throw new Error('429'); } });
  vm.runInContext(leggi('meteo-astro.js'), nuvole);
  storage.setItem('astrocal_nuvole_ultima', JSON.stringify({ lat: 47.36, lon: 8.55, quando: 1,
    ore: [{ ms: Date.now(), totale: 70 }] }));
  const cached = await nuvole.meteoCaricaNuvoleCielo(true);
  assert.equal(cached.quando, 1, 'Fallback non ringiovanisce la previsione');
  assert.equal(cached.ore[0].totale, 70);
  nuvole.luogoCorrente = () => ({ lat: 0, lon: 0 });
  assert.equal(await nuvole.meteoCaricaNuvoleCielo(true), null, 'Niente nuvole del luogo precedente');
  console.log('OK: pause meteo, Retry-After, reload, deduplica, offline, DEM, limiti PNG, antimeridiano, ADS-B, cache nuvole e cambio luogo');
})().catch(e => { console.error(e); process.exitCode = 1; });
