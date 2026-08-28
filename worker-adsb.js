// Cloudflare Worker: proxy ADS-B controllato dal progetto. Il browser parla
// sempre con questo endpoint CORS; il Worker sceglie un feed funzionante e
// conserva per 20 secondi la fotografia per non superarne i limiti.
// Ogni feed ha un **nome**, e non e' cosmesi: quando falliscono tutti e
// quattro, «feed non disponibili» e' la stessa frase per un servizio spento,
// per un 429, per un CORS che non c'entra e per uno schema cambiato — cioe'
// per quattro guasti che si riparano in quattro modi diversi. Il nome viaggia
// fino alla risposta d'errore e fino alla diagnostica.
const FEED = [
  { nome: 'ADSB.fi', url: (lat, lon, dist) => `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${dist}` },
  { nome: 'adsb.lol', url: (lat, lon, dist) => `https://api.adsb.lol/v2/point/${lat}/${lon}/${dist}` },
  { nome: 'Airplanes.live', url: (lat, lon, dist) => `https://api.airplanes.live/v2/point/${lat}/${lon}/${dist}` },
  { nome: 'adsb.one', url: (lat, lon, dist) => `https://api.adsb.one/v2/point/${lat}/${lon}/${dist}` }
];

const AFFIANCA_MS = 650;
const ATTESA_FEED_MS = 6500;
const ATTESA_TOTALE_MS = 10000;
// La diagnostica puo' aspettare piu' a lungo: non c'e' nessuno schermo fermo
// dall'altra parte, e una porta lenta e' un'informazione da avere.
const DIAGNOSTICA_ATTESA_MS = 12000;

// «signal is aborted without reason» e' il messaggio del browser per una
// richiesta che abbiamo interrotto noi, e non dice niente a chi legge. Qui si
// traduce in quello che e' successo davvero.
function motivo(errore) {
  const testo = String((errore && errore.message) || errore || 'guasto sconosciuto');
  if (errore && errore.name === 'AbortError') return 'nessuna risposta entro la scadenza';
  if (/aborted/i.test(testo)) return 'nessuna risposta entro la scadenza';
  return testo;
}

async function leggiFeed(feed, lat, lon, dist, signal) {
  const controller = new AbortController();
  const propaga = () => controller.abort();
  signal.addEventListener('abort', propaga, { once: true });
  const timer = setTimeout(() => controller.abort(), ATTESA_FEED_MS);
  try {
    const risposta = await fetch(feed.url(lat, lon, dist), {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'AstroCalendarBen/1.0' },
      cf: { cacheEverything: true, cacheTtl: 20 }
    });
    if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`);
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
    const totale = setTimeout(() => chiudi(null, { dettagli: errori.concat(
      FEED.slice(errori.length).map(f => ({ feed: f.nome, guasto: 'nessuna risposta entro la scadenza' })))
    }), ATTESA_TOTALE_MS);

    function chiudi(testo, errore) {
      if (finito) return;
      finito = true;
      clearTimeout(totale);
      regia.abort();
      if (testo !== null) resolve(testo);
      else reject(errore || { dettagli: errori });
    }
    function lancia() {
      if (finito || prossimo >= FEED.length) return;
      const feed = FEED[prossimo++];
      inVolo++;
      leggiFeed(feed, lat, lon, dist, regia.signal).then(testo => chiudi(testo)).catch(errore => {
        if (finito) return;
        errori.push({ feed: feed.nome, guasto: motivo(errore) });
        lancia();
      }).finally(() => {
        inVolo--;
        if (!finito && prossimo >= FEED.length && inVolo === 0) chiudi(null, { dettagli: errori });
      });
      if (prossimo < FEED.length) setTimeout(lancia, AFFIANCA_MS);
    }
    lancia();
  });
}

// --- La diagnostica ---------------------------------------------------
// `/api/diagnostica` interroga **tutti** e quattro i feed invece di correre,
// e racconta com'e' andata a ognuno. Serve nel momento in cui il proxy
// risponde «nessun feed disponibile»: quella frase da sola non distingue un
// servizio spento da un limite di richieste, da uno schema cambiato o da una
// rete che ci ha messo in castigo — e sono quattro cose che si riparano in
// quattro modi diversi. Qui non si corre e non si abortisce niente: si
// aspetta ogni porta e si scrive cosa ha detto.
async function diagnostica(url) {
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  const dist = Number(url.searchParams.get('dist'));
  const la = (Number.isFinite(lat) ? lat : 45.4642).toFixed(4);
  const lo = (Number.isFinite(lon) ? lon : 9.19).toFixed(4);
  const di = Math.max(1, Math.min(250, Math.ceil(Number.isFinite(dist) ? dist : 50)));

  const prove = await Promise.all(FEED.map(async feed => {
    const inizio = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DIAGNOSTICA_ATTESA_MS);
    try {
      const risposta = await fetch(feed.url(la, lo, di), {
        signal: controller.signal,
        headers: { 'Accept': 'application/json', 'User-Agent': 'AstroCalendarBen/1.0' }
      });
      const testo = await risposta.text();
      const esito = { feed: feed.nome, http: risposta.status, ms: Date.now() - inizio };
      if (!risposta.ok) {
        // Il corpo di un errore dice quasi sempre la cosa che serve — «rate
        // limited», «api key required», una pagina di manutenzione — e
        // troncarlo tiene la risposta leggibile senza perderla.
        esito.esito = 'no';
        esito.guasto = `HTTP ${risposta.status}`;
        esito.corpo = testo.slice(0, 200);
        return esito;
      }
      let dati;
      try { dati = JSON.parse(testo); } catch (_) {
        esito.esito = 'no'; esito.guasto = 'risposta non JSON'; esito.corpo = testo.slice(0, 200);
        return esito;
      }
      const elenco = Array.isArray(dati.ac) ? dati.ac : Array.isArray(dati.aircraft) ? dati.aircraft : null;
      if (!elenco) {
        esito.esito = 'no'; esito.guasto = 'schema ADS-B non riconosciuto';
        esito.chiavi = Object.keys(dati).slice(0, 8);
        return esito;
      }
      esito.esito = 'ok';
      esito.aerei = elenco.length;
      return esito;
    } catch (errore) {
      return { feed: feed.nome, esito: 'no', ms: Date.now() - inizio, guasto: motivo(errore) };
    } finally {
      clearTimeout(timer);
    }
  }));

  return {
    chiesto: { lat: la, lon: lo, dist: di, unita: 'miglia nautiche' },
    funzionanti: prove.filter(p => p.esito === 'ok').map(p => p.feed),
    feed: prove
  };
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
    if (url.pathname === '/api/diagnostica') {
      return Response.json(await diagnostica(url), { status: 200,
        headers: { ...headers, 'Cache-Control': 'no-store' } });
    }
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
    } catch (guaio) {
      // I dettagli per feed non sono rumore da sviluppatore: sono l'unica
      // differenza fra «riprova fra un minuto» e «quel servizio e' cambiato e
      // va sostituito», e senza di loro il 503 e' indistinguibile fra i due.
      return Response.json({
        error: 'feed ADS-B temporaneamente non disponibili',
        dettagli: (guaio && guaio.dettagli) || [{ feed: '?', guasto: motivo(guaio) }]
      }, { status: 503, headers });
    }
  }
};
