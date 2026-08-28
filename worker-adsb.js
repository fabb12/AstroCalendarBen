// Cloudflare Worker: proxy ADS-B controllato dal progetto. Il browser parla
// sempre con questo endpoint CORS; il Worker sceglie un feed funzionante e
// conserva per 20 secondi la fotografia per non superarne i limiti.
const FEED = [
  (lat, lon, dist) => `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${dist}`,
  (lat, lon, dist) => `https://api.adsb.lol/v2/point/${lat}/${lon}/${dist}`,
  (lat, lon, dist) => `https://api.airplanes.live/v2/point/${lat}/${lon}/${dist}`,
  (lat, lon, dist) => `https://api.adsb.one/v2/point/${lat}/${lon}/${dist}`
];

function cors(request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    // Senza questa riga l'intestazione qui sotto esiste ma il browser non la
    // lascia leggere: una diagnostica cross-origin va esposta per nome.
    'Access-Control-Expose-Headers': 'X-Feed-ADSB',
    'Vary': 'Origin'
  };
}

export default {
  async fetch(request) {
    const headers = cors(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    // La rotta e' `/api/adsb`, ma la radice risponde uguale: chi incolla nel
    // pannello il solo indirizzo del Worker — che e' quello che Wrangler
    // stampa — deve vedere gli aerei, non un 404 che sembra un Worker rotto.
    if (url.pathname !== '/api/adsb' && url.pathname !== '/') {
      return new Response('Not found', { status: 404, headers });
    }
    const lat = Number(url.searchParams.get('lat'));
    const lon = Number(url.searchParams.get('lon'));
    const dist = Math.max(1, Math.min(250, Math.ceil(Number(url.searchParams.get('dist')))));
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180 || !Number.isFinite(dist)) {
      return Response.json({ error: 'coordinate non valide' }, { status: 400, headers });
    }
    for (const creaUrl of FEED) {
      try {
        const risposta = await fetch(creaUrl(lat.toFixed(4), lon.toFixed(4), dist), {
          headers: { 'Accept': 'application/json', 'User-Agent': 'AstroCalendarBen/1.0' },
          cf: { cacheEverything: true, cacheTtl: 20 }
        });
        if (!risposta.ok) continue;
        // Un 200 con dentro una pagina d'errore non e' una risposta: passata
        // cosi' com'e', il browser la leggerebbe come «zero aerei» e non
        // proverebbe la rete successiva. Riconoscere lo schema qui costa una
        // lettura e fa la stessa cernita di aerei.js §1.
        const testo = await risposta.text();
        let dati;
        try { dati = JSON.parse(testo); } catch (_) { continue; }
        if (!Array.isArray(dati && (dati.ac || dati.aircraft))) continue;
        // Quale rete ha risposto viaggia in un'intestazione: dal browser il
        // Worker e' una porta sola, e senza questa riga non c'e' modo di
        // sapere se dietro sta rispondendo adsb.fi o l'ultima delle quattro.
        return new Response(testo, { status: 200,
          headers: { ...headers, 'Content-Type': 'application/json',
            'X-Feed-ADSB': new URL(creaUrl(0, 0, 1)).hostname,
            'Cache-Control': 'public, max-age=20' } });
      } catch (_) { /* il feed seguente e' una rete indipendente */ }
    }
    return Response.json({ error: 'feed ADS-B temporaneamente non disponibili' }, { status: 503, headers });
  }
};
