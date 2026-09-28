#!/usr/bin/env node
'use strict';

// Prova senza rete del percorso che deve restare disponibile anche quando il
// proxy non ha segreti OpenSky. Il guasto reale era fuori dalle prove del
// client: `aerei.js` funzionava, ma il Worker escludeva proprio l'unica fonte
// anonima quando le quattro reti di comunita' rifiutavano l'IP serverless.
const fs = require('fs');
const vm = require('vm');

const sorgente = fs.readFileSync(require.resolve('../worker-adsb.js'), 'utf8')
  .replace('export default proxy;', '')
  .replace(/if \(typeof Deno !== 'undefined'[\s\S]*$/, '') +
  '\n;globalThis.__workerAdsb = { proxy, fontiDi, openSkyConfigurato };';

let richiestaOpenSky = null;
const fetchFinta = async (url, opzioni = {}) => {
  if (String(url).startsWith('https://opensky-network.org/api/states/all?')) {
    richiestaOpenSky = { url: String(url), opzioni };
    return new Response(JSON.stringify({ states: [
      ['abc123', 'TEST123 ', null, 1770000000, 1770000001, 9.19, 45.46,
        10000, false, 220, 180, 0, null, 10100, '7000']
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response('rifiutato', { status: 403 });
};

const contesto = vm.createContext({
  console, fetch: fetchFinta, Request, Response, URL, URLSearchParams,
  AbortController, setTimeout, clearTimeout, Date, Math, JSON, btoa
});
vm.runInContext(sorgente, contesto, { filename: 'worker-adsb.js' });

(async () => {
  const worker = contesto.__workerAdsb;
  const fonti = worker.fontiDi({});
  if (worker.openSkyConfigurato({})) throw new Error('OpenSky vuoto risulta autenticato');
  if (!fonti.some(f => f.nome === 'OpenSky')) throw new Error('OpenSky anonimo escluso dalla corsa');

  const risposta = await worker.proxy.fetch(new Request(
    'https://proxy.example/api/adsb?lat=45.4642&lon=9.1900&dist=50'
  ), {});
  const corpo = await risposta.json();
  if (risposta.status !== 200 || !Array.isArray(corpo.ac) || corpo.ac.length !== 1) {
    throw new Error(`risposta ADS-B inattesa: ${risposta.status} ${JSON.stringify(corpo)}`);
  }
  const headers = richiestaOpenSky && richiestaOpenSky.opzioni.headers;
  if (!headers || Object.prototype.hasOwnProperty.call(headers, 'Authorization')) {
    throw new Error('la richiesta anonima contiene Authorization');
  }
  if (risposta.headers.get('X-ADSB-Fonte') !== 'OpenSky') {
    throw new Error('la risposta non dichiara OpenSky come fonte');
  }
  console.log('ok  OpenSky resta disponibile senza segreti e senza intestazione Authorization');
})().catch(errore => {
  console.error(errore);
  process.exitCode = 1;
});
