# Edge-TTS per Missione Cielo

Missione Cielo usa una voce **Neural Edge-TTS** quando in `config.js` è
configurato `window.EDGE_TTS_API_URL`. La PWA è statica: l'endpoint deve quindi
essere un piccolo ponte HTTP distribuito separatamente e abilitato al CORS per
l'origine dell'app.

## Contratto HTTP

La pagina invia una richiesta `POST` con `Content-Type: application/json`:

```json
{
  "text": "Giove. Guarda verso sud…",
  "voice": "it-IT-ElsaNeural",
  "locale": "it-IT",
  "rate": "-7%",
  "pitch": "-2Hz",
  "format": "audio-24khz-48kbitrate-mono-mp3"
}
```

Per l'inglese la voce richiesta è `en-US-AriaNeural`. Il ponte può rispondere
in uno di questi modi:

1. audio binario (`audio/mpeg`, `audio/ogg` o `audio/wav`);
2. JSON `{ "url": "https://…" }`;
3. JSON `{ "audio": "<base64>", "mime": "audio/mpeg" }`.

Esempio di configurazione:

```js
window.EDGE_TTS_API_URL = 'https://tts.example.net/v1/speech';
```

Su GitHub Pages si imposta invece la variabile Actions
`EDGE_TTS_API_URL` (Settings → Secrets and variables → Actions → Variables):
il workflow la valida e genera `config.js` durante la pubblicazione.

Non mettere segreti in `config.js`: tutto il JavaScript della PWA è pubblico.
Il ponte deve custodire eventuali credenziali, imporre un limite alla lunghezza
del testo e consentire soltanto le origini del progetto.

Se l'endpoint non è configurato, non risponde o il browser blocca la
riproduzione, Missione Cielo passa automaticamente alla Web Speech API del
dispositivo. In questo modo la narrazione continua a funzionare anche offline.
