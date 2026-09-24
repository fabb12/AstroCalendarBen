# Gli audio registrati della narrazione

Qui stanno le voci registrate che la narrazione (`narrazione.js`) suona al
posto della sintesi vocale. Sono facoltative: senza nessun file le demo e
Missione Cielo parlano con la sintesi (il ponte Edge-TTS se è configurato,
poi la voce del dispositivo) e, se il dispositivo non può parlare, mostrano
il testo e vanno avanti.

## Come sono ordinate

```
audio/narrazione/
  manifest.js          l'elenco: ID → file, per lingua
  demo/it/  demo/en/   le scene delle demo automatizzate
  missione/it/  missione/en/   Missione Cielo
```

Una cartella per funzionalità e, dentro, una per lingua. Il nome del file è
libero; conviene ricalcare l'ID (`eclisse_tour-1.mp3` per
`demo.narr.eclisse_tour.1`).

## Aggiungere un audio

1. Registra la frase **esattamente** come è scritta nel dizionario
   (`lingue/it.js` o `lingue/en.js`, alla chiave che fa da ID). Formati:
   `.mp3`, `.ogg`, `.opus`, `.m4a`, `.aac`, `.wav`, `.webm`. L'MP3 va bene
   dappertutto, Safari compreso.
2. Copia il file nella cartella giusta.
3. Aggiungi una riga a `manifest.js`:

   ```js
   'demo.narr.eclisse_tour.1': {
     it: { file: 'demo/it/eclisse_tour-1.mp3', impronta: '1a2b3c4d' },
     en: { file: 'demo/en/eclisse_tour-1.mp3', impronta: '5e6f7a8b' }
   },
   ```

   La forma breve `it: 'demo/it/eclisse_tour-1.mp3'` vale uguale, ma senza
   impronta un audio rimasto indietro rispetto al testo continua a suonare.
4. Stampa le impronte e controlla tutto:

   ```
   node scripts/controlla-narrazione.js --impronte
   node scripts/controlla-narrazione.js
   ```

Niente da toccare nel service worker: legge questo stesso manifest e mette in
cache tutti i file elencati all'installazione, quindi dopo la prima apertura
gli audio valgono anche offline. Ricorda però di incrementare `CACHE_NAME` in
`sw.js` (e la versione in `config.js`), come per ogni modifica, se no chi ha
già installato l'app non li scarica.

## Che cosa si può registrare

- **Le scene delle demo**: le chiavi `demo.narr.<demo>.<scena>`. Una frase
  per scena, e deve stare nella durata della scena: la narrazione si ferma
  al cambio di scena invece di accavallarsi con la frase dopo.
  `controlla-narrazione.js` lo verifica.
- **Missione Cielo**: i pezzi **fissi** del dizionario, sotto le loro chiavi
  complete — gli enigmi (`missione.gioco.enigma.oggetto.<slug>`), le
  esultanze (`missione.gioco.evviva.<n>`), gli aneddoti. Non serve sapere in
  quale frase finiscono: la narrazione riconosce da sola il loro testo dentro
  all'indizio composto e suona il file solo per quel pezzo, lasciando il resto
  (la direzione, l'ora, il nome) alla sintesi.
- **Non** si registrano i testi con segnaposto (`{nome}`, `{dove}`): cambiano
  ogni volta, e il controllo li rifiuta.

## Se qualcosa non va

Un file che manca, che non si decodifica o che il browser non lascia suonare
non ferma niente: quella frase passa alla sintesi, e il file mancante o
rotto non si richiede più fino al prossimo avvio. La console lo scrive una
volta sola. Nelle Impostazioni → Osservazione → Narrazione la riga di stato
dice quanti audio registrati ha la lingua corrente, e «Usa solo la sintesi
vocale» li ignora tutti.

Verifica di avere i diritti per distribuire le registrazioni aggiunte al
repository.
