// URL del Worker ADS-B di questa installazione, iniettato dal deploy oppure
// impostato qui. Lasciandolo vuoto si provano direttamente i feed ADS-B.
window.ADSB_PROXY_URL = window.ADSB_PROXY_URL || '';

// Endpoint HTTPS di un servizio Edge-TTS compatibile con l'API audio di
// OpenAI (`POST`, risposta audio/mpeg). Esempio di percorso:
//   https://voce.example/api/v1/audio/speech
// La chiave resta sul proxy: non va mai inserita in questo file pubblico.
// Se non e' configurato (o la rete non risponde), Missione Cielo ripiega
// sulla sintesi vocale del dispositivo senza perdere il racconto.
window.EDGE_TTS_API_URL = window.EDGE_TTS_API_URL || '';
