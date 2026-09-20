// URL del Worker ADS-B di questa installazione, iniettato dal deploy oppure
// impostato qui. Lasciandolo vuoto si provano direttamente i feed ADS-B.
window.ADSB_PROXY_URL = window.ADSB_PROXY_URL || '';

// Endpoint HTTP del ponte Edge-TTS. Deve accettare POST JSON e restituire
// direttamente audio (MP3/OGG/WAV), oppure JSON con `url` o `audio` base64.
// Vuoto = la narrazione ripiega sulla voce installata nel dispositivo.
window.EDGE_TTS_API_URL = window.EDGE_TTS_API_URL || '';


// Informazioni della copia locale. Durante il deploy GitHub Actions le
// sostituisce con versione della cache, numero della build, commit e data UTC.
window.ASTROCAL_BUILD = window.ASTROCAL_BUILD || Object.freeze({
  version: 'v357',
  build: '',
  commit: '',
  builtAt: ''
});
