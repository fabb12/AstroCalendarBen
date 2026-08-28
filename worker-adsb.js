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

// --- Chi puo' bussare -------------------------------------------------
// Rimandare indietro qualunque `Origin` (com'era) vuol dire pubblicare un
// proxy ADS-B gratuito per chiunque ne trovi l'indirizzo: la quota
// Cloudflare e i limiti dei quattro feed li paga chi ha creato il Worker, e
// il giorno che una rete mette in castigo questo indirizzo il cielo si
// svuota per il sito vero. L'elenco sta qui in chiaro e si allarga con la
// variabile d'ambiente `ORIGINI_AMMESSE` (nomi separati da virgola), cosi'
// chi rilancia il progetto altrove non deve toccare il codice.
//
// Due permessi non sono una svista. Le richieste **senza** `Origin` passano:
// sono quelle della barra degli indirizzi e di curl, cioe' l'unico modo di
// provare il Worker appena distribuito — e non sono richieste cross-site, che
// e' l'unica cosa da cui il CORS difenda. E `localhost` passa a qualunque
// porta, se no lo sviluppo in locale non vedrebbe mai un aereo.
const ORIGINI_AMMESSE = [
  'https://fabb12.github.io'
];

function elencoOrigini(env) {
  const extra = String((env && env.ORIGINI_AMMESSE) || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return ORIGINI_AMMESSE.concat(extra);
}

function originePermessa(origine, env) {
  if (!origine) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine)) return true;
  return elencoOrigini(env).indexOf(origine) !== -1;
}

function cors(request, env) {
  const origine = request.headers.get('Origin');
  const testa = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
  // L'intestazione si scrive solo per chi e' ammesso: negarla e' proprio il
  // modo in cui il browser rifiuta la risposta.
  if (origine && originePermessa(origine, env)) testa['Access-Control-Allow-Origin'] = origine;
  else if (!origine) testa['Access-Control-Allow-Origin'] = '*';
  return testa;
}

export default {
  async fetch(request, env) {
    const headers = cors(request, env);
    if (!originePermessa(request.headers.get('Origin'), env)) {
      return Response.json({ error: 'origine non ammessa' }, { status: 403, headers });
    }
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
