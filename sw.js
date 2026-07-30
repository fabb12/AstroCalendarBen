const CACHE_NAME = 'astrocal-v27';

// File dell'app: senza questi non parte nulla
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './telescopio.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

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
  if (url.hostname.includes('open-meteo.com') ||
      url.hostname.includes('celestrak') ||
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
      }).catch(() => caches.match('./index.html'));
    })
  );
});
