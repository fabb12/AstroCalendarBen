// Cloudflare Worker: proxy ADS-B controllato dal progetto. Il browser parla
// sempre con questo endpoint CORS; il Worker sceglie una fonte funzionante e
// conserva per 20 secondi la fotografia per non superarne i limiti.
//
// PERCHE' QUESTO WORKER ESISTE, e non e' quello che sembra. La ragione
// scritta all'inizio era il CORS: GitHub Pages serve file statici e non puo'
// aggiungere `Access-Control-Allow-Origin` a una risposta altrui. Vera, ma
// non e' quella che conta. Misurando si e' scoperta una tenaglia:
//
//   - dal **browser** (IP di casa) le quattro reti di comunita' sono vive ma
//     non mandano l'intestazione CORS: il browser non puo' leggerle, mai;
//   - dal **Worker** (IP Cloudflare) il CORS non c'entra piu', ma arrivano
//     403, 403, 403 e un 429. Un Worker non ha un IP proprio: ne divide un
//     pugno con migliaia di altri, e quei progetti si difendono guardando li'.
//     Il 429 per una richiesta sola e' la firma di una quota consumata da
//     qualcun altro sullo stesso indirizzo.
//
// Nessuna delle due strade porta da nessuna parte con quelle quattro reti. Da
// qui **OpenSky Network**, che ha un'API ufficiale per uso non commerciale con
// credenziali proprie: l'identita' e' l'account, non l'indirizzo da cui esci,
// e il problema dell'IP condiviso sparisce. Ed e' la ragione vera per cui un
// Worker serve: **e' l'unico posto in cui una credenziale puo' stare senza
// finire nel browser di chiunque apra il sito.**
//
// Le quattro reti restano in coda: costano una trentina di millisecondi a
// testa, e il giorno che una cambia politica torna a funzionare da sola.

// --- Le fonti ---------------------------------------------------------
// Ogni fonte ha un **nome**, e non e' cosmesi: quando falliscono tutte,
// «feed non disponibili» e' la stessa frase per un servizio spento, per un
// 429, per uno schema cambiato e per un endpoint ritirato — cioe' per quattro
// guasti che si riparano in quattro modi diversi. Il nome viaggia fino alla
// risposta d'errore e fino alla diagnostica.
const RETI_COMUNITA = [
  { nome: 'ADSB.fi', url: (lat, lon, dist) => `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${dist}` },
  { nome: 'adsb.lol', url: (lat, lon, dist) => `https://api.adsb.lol/v2/point/${lat}/${lon}/${dist}` },
  { nome: 'Airplanes.live', url: (lat, lon, dist) => `https://api.airplanes.live/v2/point/${lat}/${lon}/${dist}` },
  { nome: 'adsb.one', url: (lat, lon, dist) => `https://api.adsb.one/v2/point/${lat}/${lon}/${dist}` }
];

const AFFIANCA_MS = 650;
const ATTESA_FEED_MS = 6500;
const ATTESA_TOTALE_MS = 12000;
// La diagnostica puo' aspettare piu' a lungo: non c'e' nessuno schermo fermo
// dall'altra parte, e una porta lenta e' un'informazione da avere.
const DIAGNOSTICA_ATTESA_MS = 12000;

// =====================================================================
// OPENSKY — la fonte con le credenziali
//   Registrarsi su opensky-network.org e creare un client API; le due
//   stringhe vanno messe come **secret** del Worker (Settings → Variables
//   and Secrets), non nel codice:
//       OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET   (OAuth2, consigliato)
//   In alternativa, per gli account che usano ancora l'autenticazione di
//   base:
//       OPENSKY_USER / OPENSKY_PASS
//   Senza nessuna delle due, OpenSky semplicemente non entra nella corsa e
//   il Worker si comporta come prima.
// =====================================================================

const OPENSKY_TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

// Il token dura mezz'ora e chiederne uno a ogni fotografia sarebbe una
// richiesta in piu' ogni quarantacinque secondi, cioe' il doppio del traffico
// per niente. L'isolato del Worker sopravvive fra una richiesta e l'altra, e
// quando non sopravvive si ripaga un token: e' una memoria di comodo, non uno
// stato su cui contare.
let tokenOpenSky = { valore: '', scade: 0 };

function openSkyConfigurato(env) {
  return !!(env && ((env.OPENSKY_CLIENT_ID && env.OPENSKY_CLIENT_SECRET) ||
    (env.OPENSKY_USER && env.OPENSKY_PASS)));
}

async function autorizzazioneOpenSky(env, signal) {
  if (env.OPENSKY_CLIENT_ID && env.OPENSKY_CLIENT_SECRET) {
    const ora = Date.now();
    // Trenta secondi di margine: un token che scade mentre la richiesta e' in
    // volo si presenta come un 401 inspiegabile.
    if (tokenOpenSky.valore && tokenOpenSky.scade > ora + 30000) return `Bearer ${tokenOpenSky.valore}`;
    const risposta = await fetch(OPENSKY_TOKEN_URL, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env.OPENSKY_CLIENT_ID,
        client_secret: env.OPENSKY_CLIENT_SECRET
      })
    });
    if (!risposta.ok) throw new Error(`token OpenSky: HTTP ${risposta.status}`);
    const dati = await risposta.json();
    if (!dati || !dati.access_token) throw new Error('token OpenSky: risposta senza access_token');
    tokenOpenSky = { valore: dati.access_token, scade: ora + (Number(dati.expires_in) || 1800) * 1000 };
    return `Bearer ${tokenOpenSky.valore}`;
  }
  return 'Basic ' + btoa(`${env.OPENSKY_USER}:${env.OPENSKY_PASS}`);
}

// OpenSky vuole un riquadro, non un cerchio. La correzione del coseno tiene
// il raggio giusto anche alle alte latitudini; il ritaglio circolare esatto
// lo fa poi `arricchisci()` nell'app, come per le altre fonti.
function riquadroOpenSky(lat, lon, distNm) {
  const km = distNm * 1.852;
  const dLat = km / 111.32;
  const dLon = km / (111.32 * Math.max(0.08, Math.cos(lat * Math.PI / 180)));
  return new URLSearchParams({
    lamin: (lat - dLat).toFixed(4), lamax: (lat + dLat).toFixed(4),
    lomin: (lon - dLon).toFixed(4), lomax: (lon + dLon).toFixed(4)
  });
}

// OpenSky parla un dialetto diverso — un array posizionale, metri e metri al
// secondo — mentre l'app sa leggere lo schema readsb (`ac`, piedi e nodi).
// La traduzione si fa **qui** e non nell'app, di proposito: cosi' il Worker
// e' una fonte sola che parla una lingua sola, e il giorno che si aggiunge la
// quinta fonte non si tocca niente dall'altra parte.
function daOpenSky(dati) {
  if (!dati || typeof dati !== 'object' || !('states' in dati)) {
    // `states` vale legittimamente `null` quando non c'e' nessuno in volo nel
    // riquadro: il segno di riconoscimento e' la **chiave**, non il contenuto.
    throw new Error('schema OpenSky non riconosciuto');
  }
  const adesso = Math.floor(Date.now() / 1000);
  const piedi = m => (Number.isFinite(m) ? Math.round(m / 0.3048) : undefined);
  const ac = (dati.states || []).map(s => {
    const visto = Number(s[4]) || Number(s[3]) || adesso;
    // `alt_baro` va lasciato **mancante** e non messo a `null` quando non
    // c'e', ed e' la differenza fra un aereo in quota e un aereo disegnato
    // sull'asfalto: chi legge fa `numero(alt_baro) ?? numero(alt_geom)`, e in
    // JavaScript `Number(null)` non e' NaN, e' **zero** — cioe' un valore
    // perfettamente finito che vince il `??` e si porta via la quota vera.
    // Con la chiave assente `Number(undefined)` e' NaN e il ripiego funziona.
    // readsb infatti non scrive mai `null` li': o un numero, o 'ground'.
    return {
      hex: s[0], flight: String(s[1] || '').trim(), r: '', t: '', desc: '', ownOp: '',
      squawk: String(s[14] || ''),
      lat: s[6], lon: s[5],
      // Si mandano tutt'e due, come fa un feed readsb vero, e chi legge
      // preferira' la barometrica: e' quello che fa gia' per le altre
      // fonti, e la coerenza vale piu' del centinaio di metri che le
      // separa. Chi un giorno volesse la geometrica la cambia di la',
      // una volta per tutte le fonti, invece che qui per una sola.
      alt_baro: s[8] ? 'ground' : piedi(s[7]),
      alt_geom: piedi(s[13]),
      gs: Number.isFinite(s[9]) ? s[9] / 0.514444 : undefined,
      track: s[10],
      baro_rate: Number.isFinite(s[11]) ? s[11] / 0.00508 : undefined,
      seen: Math.max(0, adesso - visto)
    };
  }).filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lon));
  return JSON.stringify({ ac, fonte: 'OpenSky Network' });
}

function feedOpenSky(env) {
  return {
    nome: 'OpenSky',
    async chiedi(lat, lon, dist, signal) {
      const autorizzazione = await autorizzazioneOpenSky(env, signal);
      const risposta = await fetch(
        `https://opensky-network.org/api/states/all?${riquadroOpenSky(Number(lat), Number(lon), dist)}`,
        { signal, headers: { 'Accept': 'application/json', 'Authorization': autorizzazione } }
      );
      if (risposta.status === 401 || risposta.status === 403) {
        // Un token rifiutato non si riusa: buttarlo qui vuol dire che la
        // riprova successiva ne chiede uno nuovo invece di ripetere il no.
        tokenOpenSky = { valore: '', scade: 0 };
      }
      if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`);
      return daOpenSky(await risposta.json());
    }
  };
}

// L'ordine: OpenSky davanti quando c'e' una credenziale, perche' e' l'unica
// che risponde davvero; le reti di comunita' dietro, perche' costano poco e
// un giorno potrebbero tornare.
function fontiDi(env) {
  return (openSkyConfigurato(env) ? [feedOpenSky(env)] : []).concat(RETI_COMUNITA);
}

// «signal is aborted without reason» e' il messaggio del browser per una
// richiesta che abbiamo interrotto noi, e non dice niente a chi legge. Qui si
// traduce in quello che e' successo davvero.
function motivo(errore) {
  const testo = String((errore && errore.message) || errore || 'guasto sconosciuto');
  if (errore && errore.name === 'AbortError') return 'nessuna risposta entro la scadenza';
  if (/aborted/i.test(testo)) return 'nessuna risposta entro la scadenza';
  return testo;
}

async function leggiFonte(fonte, lat, lon, dist, signal) {
  const controller = new AbortController();
  const propaga = () => controller.abort();
  signal.addEventListener('abort', propaga, { once: true });
  const timer = setTimeout(() => controller.abort(), ATTESA_FEED_MS);
  try {
    if (fonte.chiedi) return await fonte.chiedi(lat, lon, dist, controller.signal);
    const risposta = await fetch(fonte.url(lat, lon, dist), {
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
function primaFotografia(fonti, lat, lon, dist) {
  return new Promise((resolve, reject) => {
    const regia = new AbortController();
    let prossimo = 0, inVolo = 0, finito = false;
    const errori = [];
    const totale = setTimeout(() => chiudi(null, { dettagli: errori.concat(
      fonti.slice(errori.length).map(f => ({ feed: f.nome, guasto: 'nessuna risposta entro la scadenza' })))
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
      if (finito || prossimo >= fonti.length) return;
      const fonte = fonti[prossimo++];
      inVolo++;
      leggiFonte(fonte, lat, lon, dist, regia.signal).then(testo => chiudi(testo)).catch(errore => {
        if (finito) return;
        errori.push({ feed: fonte.nome, guasto: motivo(errore) });
        lancia();
      }).finally(() => {
        inVolo--;
        if (!finito && prossimo >= fonti.length && inVolo === 0) chiudi(null, { dettagli: errori });
      });
      if (prossimo < fonti.length) setTimeout(lancia, AFFIANCA_MS);
    }
    lancia();
  });
}

// --- La diagnostica ---------------------------------------------------
// `/api/diagnostica` interroga **tutte** le fonti invece di correre, e
// racconta com'e' andata a ognuna. Serve nel momento in cui il proxy risponde
// «nessun feed disponibile»: quella frase da sola non distingue un servizio
// spento da un limite di richieste, da uno schema cambiato o da una rete che
// ci ha messo in castigo — e sono quattro cose che si riparano in quattro
// modi diversi. Qui non si corre e non si abortisce niente: si aspetta ogni
// porta e si scrive cosa ha detto.
async function diagnostica(url, env) {
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  const dist = Number(url.searchParams.get('dist'));
  const la = (Number.isFinite(lat) ? lat : 45.4642).toFixed(4);
  const lo = (Number.isFinite(lon) ? lon : 9.19).toFixed(4);
  const di = Math.max(1, Math.min(250, Math.ceil(Number.isFinite(dist) ? dist : 50)));
  const fonti = fontiDi(env);

  const prove = await Promise.all(fonti.map(async fonte => {
    const inizio = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DIAGNOSTICA_ATTESA_MS);
    try {
      if (fonte.chiedi) {
        const testo = await fonte.chiedi(la, lo, di, controller.signal);
        const dati = JSON.parse(testo);
        return { feed: fonte.nome, esito: 'ok', ms: Date.now() - inizio, aerei: dati.ac.length };
      }
      const risposta = await fetch(fonte.url(la, lo, di), {
        signal: controller.signal,
        headers: { 'Accept': 'application/json', 'User-Agent': 'AstroCalendarBen/1.0' }
      });
      const testo = await risposta.text();
      const esito = { feed: fonte.nome, http: risposta.status, ms: Date.now() - inizio };
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
      return { feed: fonte.nome, esito: 'no', ms: Date.now() - inizio, guasto: motivo(errore) };
    } finally {
      clearTimeout(timer);
    }
  }));

  return {
    chiesto: { lat: la, lon: lo, dist: di, unita: 'miglia nautiche' },
    openSky: openSkyConfigurato(env) ? 'credenziali presenti' : 'nessuna credenziale configurata',
    funzionanti: prove.filter(p => p.esito === 'ok').map(p => p.feed),
    feed: prove
  };
}

// --- Chi puo' bussare -------------------------------------------------
// Rimandare indietro qualunque `Origin` (com'era) vuol dire pubblicare un
// proxy ADS-B gratuito per chiunque ne trovi l'indirizzo: la quota
// Cloudflare, i limiti delle reti e — da adesso — **la tua quota OpenSky** li
// paga chi ha creato il Worker. L'elenco sta qui in chiaro e si allarga con
// la variabile d'ambiente `ORIGINI_AMMESSE` (nomi separati da virgola), cosi'
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
      return Response.json(await diagnostica(url, env), { status: 200,
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
      const testo = await primaFotografia(fontiDi(env), lat.toFixed(4), lon.toFixed(4), dist);
      return new Response(testo, { status: 200,
        headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=20' } });
    } catch (guaio) {
      // I dettagli per fonte non sono rumore da sviluppatore: sono l'unica
      // differenza fra «riprova fra un minuto» e «quel servizio e' cambiato e
      // va sostituito», e senza di loro il 503 e' indistinguibile fra i due.
      return Response.json({
        error: 'feed ADS-B temporaneamente non disponibili',
        openSky: openSkyConfigurato(env) ? 'credenziali presenti' : 'nessuna credenziale configurata',
        dettagli: (guaio && guaio.dettagli) || [{ feed: '?', guasto: motivo(guaio) }]
      }, { status: 503, headers });
    }
  }
};
