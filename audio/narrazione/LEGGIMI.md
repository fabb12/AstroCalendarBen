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
  storie/<personaggio>/it/  …/en/   le battute delle Storie cosmiche
  storie/COPIONE.md    cosa dice ogni personaggio e come si chiamano i file
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

## Le voci dei personaggi delle Storie cosmiche

Qui non si tocca il manifest a mano: **ogni personaggio ha una cartella**, e
per cambiargli voce basta cambiare i file che ci stanno dentro.

```
audio/narrazione/storie/
  COPIONE.md                 le battute di tutti, coi nomi dei file e lo stato
  voci-elevenlabs.json       (facoltativo) l'ID della voce ElevenLabs di ognuno
  luna/it/storia_luna-1.mp3  la prima battuta della Luna, in italiano
  luna/en/storia_luna-1.mp3  la stessa, in inglese
  terra/it/…   sole/it/…   betelgeuse/it/…
```

### A mano (genero su ElevenLabs e carico)

1. Apri `storie/COPIONE.md`: per ogni personaggio c'è la cartella, e per ogni
   battuta il **nome del file**, il testo da far dire, lo stato (pronta,
   manca, da rifare) e quanto può durare al massimo.
2. Su ElevenLabs scegli una voce per quel personaggio e genera le sue
   battute copiando il testo **così com'è** (la stessa voce per tutte le
   battute dello stesso personaggio).
3. Salva ogni MP3 col nome del copione nella cartella del personaggio, per
   esempio `audio/narrazione/storie/luna/it/storia_luna-1.mp3`.
4. **Dalla pagina di GitHub** (Add file → Upload files, dentro alla cartella
   del personaggio): non c'è altro da fare. Il workflow «Voci delle storie»
   aggiorna manifest e copione con un commit suo, e la pubblicazione fa lo
   stesso conto per conto suo — anche il nome della cache del service
   worker cambia da solo, così chi ha l'app installata scarica le voci
   nuove. Se un nome di file è sbagliato, il workflow diventa rosso e il log
   dice quale.

   **In locale**, invece, lancia

   ```
   node scripts/voci-storie.js
   ```

   Scrive da solo le righe del manifest (fra i segnalibri «INIZIO/FINE STORIE
   COSMICHE»), con l'impronta del testo, e riscrive il copione. Ti dice anche
   se un file ha un nome che non è una battuta, se sta nella cartella di un
   altro personaggio, o se dura più della sua scena (verrebbe tagliato).
5. In locale, fai il commit di file audio, `manifest.js` e `COPIONE.md`
   (incrementando la versione, `CACHE_NAME` in `sw.js` e `config.js`, come
   per ogni modifica).

**Cambiare la voce a un personaggio** = sovrascrivere i suoi file con quelli
nuovi e rilanciare lo script. **Togliergliela** = cancellare i suoi file e
rilanciare: le sue battute tornano alla sintesi vocale. Gli altri personaggi
non cambiano. Si possono mischiare: la Luna con ElevenLabs e il Sole ancora
con la sintesi va benissimo.

### Diretto da ElevenLabs (senza scaricare a mano)

Se hai una chiave API di ElevenLabs, lo script può chiedere lui le battute:

1. In `storie/voci-elevenlabs.json` scrivi l'ID della voce (il «Voice ID»
   della libreria ElevenLabs) nel campo `voce` del personaggio. Per una voce
   diversa in inglese: `"voce": { "it": "…", "en": "…" }`. Le `impostazioni`
   (generali o del personaggio: `stability`, `similarity_boost`, `style`,
   `speed`…) passano così come sono a ElevenLabs.
2. Lancia, con la chiave **nell'ambiente** (mai scritta nel repository):

   ```
   ELEVENLABS_API_KEY=… node scripts/voci-storie.js --genera luna
   ELEVENLABS_API_KEY=… node scripts/voci-storie.js --genera luna --lingua en
   ELEVENLABS_API_KEY=… node scripts/voci-storie.js --genera luna --rifai   # dopo aver cambiato voce
   node scripts/voci-storie.js --genera luna --prova                        # dice solo cosa farebbe
   ```

   Senza `--rifai` genera solo le battute che mancano o che sono «da rifare».
   Alla fine aggiorna manifest e copione da solo. Il personaggio si chiama
   col nome della cartella (`luna`, `sagittario-a`) o col nome nel codice
   (`Moon`).

### Se il testo di una battuta cambia

L'audio vecchio smette di suonare (dire una frase diversa da quella scritta
sotto è peggio della sintesi) e il copione lo segna **da rifare**: si rigenera
quella battuta e si rilancia lo script. `node scripts/controlla-narrazione.js`
segnala anche un file aggiunto senza aver lanciato lo script.

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
