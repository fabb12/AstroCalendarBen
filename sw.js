const CACHE_NAME = 'astrocal-v73';

// File dell'app: senza questi non parte nulla
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './telescopio.js',
  './catalogo.js',
  './costellazioni.js',
  './corpi-minori.js',
  './pianifica.js',
  './terreno.js',
  './meteo-astro.js',
  './aurora-polare.js',
  './eventi-extra.js',
  './ui-nuova.js',
  './didattica.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

// I file dei cataloghi — dati-stelle.js, dati-stelle-deboli.js,
// dati-costellazioni.js, dati-profondo.js, dati-corpi-minori.js — NON
// stanno in ASSETS, ed è una scelta: sono quattrocento kilobyte, e
// metterli lì vorrebbe dire scaricarli all'installazione anche a chi il
// planetario non lo aprirà mai.
//
// Non serve elencarli da nessuna parte: se li chiede catalogo.js quando
// servono, e la regola qui sotto — «tutto quello che viene da questa
// stessa origine, conservalo» — li mette in cache appena passano. Da
// quel momento ci sono anche in campo, senza rete.

// Librerie esterne: vanno messe in cache anche loro, altrimenti l'app
// installata si apre "rotta" quando non c'è rete (proprio di notte, in campo).
const LIBRERIE = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
  'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/dist/satellite.min.js'
];

// Servizi che deducono la posizione dall'indirizzo IP: sono lo strato di
// ripiego quando il GPS non risponde, e una risposta vecchia di cache
// racconterebbe dove eri, non dove sei.
const SERVIZI_POSIZIONE = ['ipapi.co', 'ipwho.is', 'get.geojs.io'];

// Host le cui risposte salviamo man mano che arrivano (librerie, tessere mappa)
const HOST_DA_CONSERVARE = [
  'cdn.jsdelivr.net',
  'cdn.tailwindcss.com',
  'unpkg.com',
  'tile.openstreetmap.org',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(ASSETS);
        // Le librerie esterne possono fallire (rete lenta, CDN giù):
        // le scarichiamo una per una senza far fallire tutta l'installazione.
        await Promise.all(LIBRERIE.map(url =>
          cache.add(new Request(url, { mode: 'cors' })).catch(() => {})
        ));
      })
      .then(() => self.skipWaiting())
  );
});

// Elimina le cache vecchie così i nuovi file sostituiscono quelli obsoleti
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function daConservare(url) {
  return HOST_DA_CONSERVARE.some(h => url.hostname === h || url.hostname.endsWith('.' + h));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  // Meteo, dati orbitali dei satelliti e servizi di posizione devono essere
  // freschi: mai dalla cache. Se la rete non c'è, l'app mostra il valore
  // salvato in localStorage — e per la posizione resta la scelta a mano.
  // Attenzione: senza questa deviazione la risposta di ripiego sarebbe
  // index.html, cioè una pagina HTML servita al posto di un JSON.
  // Il meteo da astronomo passa dagli stessi host di open-meteo (compreso
  // air-quality-api), quindi è già coperto. Il tempo dello spazio del
  // NOAA no, e una tempesta magnetica di ieri è la peggiore delle
  // informazioni vecchie: dice «guarda a nord» la sera in cui non c'è
  // niente da vedere.
  if (url.hostname.includes('open-meteo.com') ||
      url.hostname.includes('celestrak') ||
      url.hostname.includes('services.swpc.noaa.gov') ||
      SERVIZI_POSIZIONE.some(h => url.hostname === h)) {
    e.respondWith(fetch(req).catch(() => new Response('', { status: 504 })));
    return;
  }

  e.respondWith(
    caches.match(req).then(risposta => {
      if (risposta) return risposta;
      return fetch(req).then(rete => {
        // Conserviamo le risposte valide delle librerie esterne per l'uso offline
        if (rete && rete.status === 200 && (url.origin === self.location.origin || daConservare(url))) {
          const copia = rete.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copia)).catch(() => {});
        }
        return rete;
      }).catch(() => ripiego(req));
    })
  );
});

// Che cosa rispondere quando una richiesta non si può soddisfare.
//
// La risposta ovvia — «rimando index.html, così almeno l'app si apre» —
// è giusta soltanto per la navigazione, cioè quando è il browser a
// chiedere una PAGINA. Per tutto il resto è un disastro silenzioso: il
// browser chiede astronomy.browser.min.js, si sente rispondere 200 con
// dentro dell'HTML, prova a interpretarlo come codice e muore su
// «Unexpected token '<'». L'utente vede un'app rotta senza capire
// perché, e nella console c'è un errore di sintassi in un file che di
// errori di sintassi non ne ha.
//
// Succedeva davvero: basta essere senza rete la prima volta che si apre
// l'app installata, quando le librerie del CDN non sono ancora in cache.
// Un 504 onesto, invece, fa fallire il caricamento di quello script e
// basta — e i moduli che sanno vivere senza (il catalogo del cielo, i
// corpi minori) continuano a funzionare.
function ripiego(req) {
  if (req.mode === 'navigate') {
    return caches.match('./index.html').then(r => r || new Response(
      '<!doctype html><meta charset="utf-8"><title>Senza rete</title>' +
      '<p style="font:16px system-ui;padding:2rem">Non riesco ad aprire l\'app e non ne ho una copia salvata. Riprova quando c\'è rete.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
  }
  return new Response('', { status: 504, statusText: 'Non disponibile senza rete' });
}
