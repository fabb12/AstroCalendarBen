// Cloudflare Worker: proxy ADS-B controllato dal progetto. Il browser parla
// sempre con questo endpoint CORS; il Worker sceglie un feed funzionante e
// conserva per 20 secondi la fotografia per non superarne i limiti.
const FEED = [
  (lat, lon, dist) => `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${dist}`,
  (lat, lon, dist) => `https://api.adsb.lol/v2/point/${lat}/${lon}/${dist}`,
  (lat, lon, dist) => `https://api.airplanes.live/v2/point/${lat}/${lon}/${dist}`,
  (lat, lon, dist) => `https://api.adsb.one/v2/point/${lat}/${lon}/${dist}`
];

const AFFIANCA_MS = 650;
const ATTESA_FEED_MS = 6500;
const ATTESA_TOTALE_MS = 10000;

function erroreAbort() {
  const errore = new Error('richiesta annullata');
  errore.name = 'AbortError';
  return errore;
}

async function leggiFeed(creaUrl, lat, lon, dist, signal) {
  const controller = new AbortController();
  const propaga = () => controller.abort();
  signal.addEventListener('abort', propaga, { once: true });
  const timer = setTimeout(() => controller.abort(), ATTESA_FEED_MS);
  try {
    const risposta = await fetch(creaUrl(lat, lon, dist), {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'AstroCalendarBen/1.0' },
      cf: { cacheEverything: true, cacheTtl: 20 }
    });
    if (!risposta.ok) throw new Error(`feed ${risposta.status}`);
    const testo = await risposta.text();
    let dati;
    try { dati = JSON.parse(testo); } catch (_) { throw new Error('risposta non JSON'); }
    if (!Array.isArray(dati && (dati.ac || dati.aircraft))) {
      throw new Error('schema ADS-B non riconosciuto');
    }
    return testo;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', propaga);
  }
}

// Una rete sovraccarica spesso non risponde affatto. Lanciarle in fila rende
// quattro timeout un'attesa di mezzo minuto; qui vengono affiancate a breve
// distanza e la prima fotografia valida interrompe le altre.
function primaFotografia(lat, lon, dist) {
  return new Promise((resolve, reject) => {
    const regia = new AbortController();
    let prossimo = 0, inVolo = 0, finito = false;
    const errori = [];
    const totale = setTimeout(() => chiudi(null, new Error('timeout dei feed ADS-B')), ATTESA_TOTALE_MS);

    function chiudi(testo, errore) {
      if (finito) return;
      finito = true;
      clearTimeout(totale);
      regia.abort();
      if (testo !== null) resolve(testo);
      else reject(errore || errori[0] || erroreAbort());
    }
    function lancia() {
      if (finito || prossimo >= FEED.length) return;
      const feed = FEED[prossimo++];
      inVolo++;
      leggiFeed(feed, lat, lon, dist, regia.signal).then(testo => chiudi(testo)).catch(errore => {
        if (finito) return;
        errori.push(errore);
        lancia();
      }).finally(() => {
        inVolo--;
        if (!finito && prossimo >= FEED.length && inVolo === 0) chiudi(null, errori[0]);
      });
      if (prossimo < FEED.length) setTimeout(lancia, AFFIANCA_MS);
    }
    lancia();
  });
}

function cors(request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

export default {
  async fetch(request) {
    const headers = cors(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    if (url.pathname !== '/api/adsb') return new Response('Not found', { status: 404, headers });
    const lat = Number(url.searchParams.get('lat'));
    const lon = Number(url.searchParams.get('lon'));
    const dist = Math.max(1, Math.min(250, Math.ceil(Number(url.searchParams.get('dist')))));
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180 || !Number.isFinite(dist)) {
      return Response.json({ error: 'coordinate non valide' }, { status: 400, headers });
    }
    try {
      const testo = await primaFotografia(lat.toFixed(4), lon.toFixed(4), dist);
      return new Response(testo, { status: 200,
        headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=20' } });
    } catch (_) {
      return Response.json({ error: 'feed ADS-B temporaneamente non disponibili' }, { status: 503, headers });
    }
  }
};
