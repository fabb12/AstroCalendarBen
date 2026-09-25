// URL del Worker ADS-B di questa installazione, iniettato dal deploy oppure
// impostato qui. Lasciandolo vuoto si usano i ponti CORS di riserva.
window.ADSB_PROXY_URL = window.ADSB_PROXY_URL || '';

// Endpoint HTTP del ponte Edge-TTS. Deve accettare POST JSON e restituire
// direttamente audio (MP3/OGG/WAV), oppure JSON con `url` o `audio` base64.
// Vuoto = la narrazione ripiega sulla voce installata nel dispositivo.
window.EDGE_TTS_API_URL = window.EDGE_TTS_API_URL || '';

// Il modello neurale per il riconoscimento degli aerei nella realtà
// aumentata (§7 di `inseguimento.js`). Vuoto — ed è il caso di serie — vuol
// dire che a rilevare è il filtro adattato del §3, che a questa scala è
// quello che funziona: il bersaglio è una sagoma di sei pixel contro un
// cielo uniforme, e un convoluzionale addestrato su COCO quella cosa lì non
// la vede.
//
// Chi ne ha uno addestrato sulle **sue** immagini lo metta qui: un ONNX di
// YOLOv8 o YOLO11 esportato senza opzioni (ingresso `[1,3,320,320]`, uscita
// `[1,4+classi,ancore]`). Si carica a richiesta e solo dentro al worker, e
// se non si apre si torna al rivelatore di sempre — dicendolo una volta
// sola, non a ogni fotogramma.
//
// Prima di accenderlo vale la pena leggere il cappello di `inseguimento.js`:
// sono sei megabyte di modello più tre di runtime, su un'app che ne pesa
// quattro, per un'inferenza che su un telefono di fascia media costa da
// ottanta a duecento millisecondi — cioè una pausa di dodici fotogrammi a
// ogni rilevazione.
window.INS_MODELLO_URL = window.INS_MODELLO_URL || '';
// Il runtime con cui aprirlo. Si cambia solo per servirlo da sé invece che
// dal CDN, che è quello che serve per farlo funzionare offline.
window.INS_ORT_URL = window.INS_ORT_URL || '';


// Informazioni della copia locale. `version` e `builtAt` vanno aggiornati
// insieme a CACHE_NAME in sw.js a ogni modifica. Durante il deploy GitHub
// Actions li sostituisce con versione della cache, numero della build, commit
// e data UTC effettiva della pubblicazione.
window.ASTROCAL_BUILD = window.ASTROCAL_BUILD || Object.freeze({
  version: 'v374',
  build: '',
  commit: '',
  builtAt: '2026-09-25T14:12:42.000Z'
});
