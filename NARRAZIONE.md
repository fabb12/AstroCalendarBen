# La narrazione

Una voce sola per tutta l'app: le **demo automatizzate** e **Missione Cielo**
parlano attraverso `narrazione.js` (prefisso `narr`, oggetto pubblico
`window.narrazione`). Prima Missione Cielo aveva una pipeline sua (Edge-TTS e
voce del dispositivo) e le demo nessuna; due voci separate vogliono dire due
modi di fermarsi, e il difetto che ne nasce è sempre lo stesso — due frasi
che si accavallano.

## Il contenuto

Ogni cosa detta ha:

| | |
| --- | --- |
| **ID stabile** | quasi sempre la chiave del dizionario (`demo.narr.eclisse_tour.1`, `missione.gioco.enigma.oggetto.saturno`); per i testi composti di Missione Cielo un ID descrittivo (`missione.tappa.<slug>.<momento>.<indizio>`) |
| **testo** | quello del dizionario nella lingua di adesso, oppure composto da chi parla |
| **lingua** | quella dell'app (`astroI18n.lingua()`) |
| **audio registrato** | facoltativo, dal manifest `audio/narrazione/manifest.js` |

Il manifest è un file `.js` (come i dizionari: da `file://` una `fetch` di
JSON è vietata) con una voce per ID e, dentro, un file per lingua:

```js
voci: {
  'demo.narr.eclisse_tour.1': {
    it: { file: 'demo/it/eclisse_tour-1.mp3', impronta: '1a2b3c4d' },
    en: 'demo/en/eclisse_tour-1.mp3'
  }
}
```

L'`impronta` (FNV-1a del testo normalizzato) dice per quale testo l'audio è
stato registrato: se il dizionario cambia, l'audio vecchio smette di suonare
invece di dire una frase diversa da quella scritta. Come si aggiunge un audio
è scritto in `audio/narrazione/LEGGIMI.md`.

## La scala dei ripieghi

1. **Audio registrato** — se il manifest ne ha uno per quell'ID e quella
   lingua, se il file c'è, si decodifica e il browser lo lascia suonare.
2. **Sintesi vocale** — quella che l'app aveva già: il ponte Edge-TTS se
   `EDGE_TTS_API_URL` è configurato (vedi `EDGE-TTS.md`), poi la voce del
   dispositivo (Web Speech API, scelta per nome come prima).
3. **Solo testo** — se non c'è nessuna voce, o il volume è a zero, o il
   browser la blocca, il testo resta a schermo il tempo di leggerlo e il
   racconto va avanti.

Un file che manca (404, o 504 del service worker offline) o che non si
decodifica finisce in `narr.guasti` e non si richiede più nella sessione; un
file che il browser non lascia suonare senza gesto (`NotAllowedError`) invece
no — non è colpa sua. Una voce del dispositivo che non parte entro tre
secondi si dà per muta fino al prossimo tocco (`narr.ttsMuto`), così le frasi
dopo non aspettano di nuovo tre secondi.

## I brani dentro a una frase composta

Missione Cielo non manda ID fissi: gli indizi sono composti (enigma + segno +
direzione con la bussola di stasera). La narrazione non ha bisogno di codice
frase per frase: `narrComponi` cerca nel testo i testi del dizionario che
hanno un audio nel manifest (lunghi almeno `NARR_BRANO_MIN` caratteri, senza
segnaposto) e divide la frase in pezzi — il file dove c'è, la sintesi per il
resto. I pezzi di sintesi consecutivi restano insieme.

## Il ciclo di vita

`narrazione.parla(richiesta)` restituisce una promessa (`'audio'`, `'tts'`,
`'testo'`, `'interrotta'`, `'spenta'`, `'vuota'`). Le regole:

- **una richiesta nuova ferma sempre quella di prima**, di qualunque canale:
  due voci insieme non esistono;
- `ferma(canale)` ferma solo se parla quel canale (`demo`, `missione`,
  `prova`): chiudere una scena non zittisce la prova delle Impostazioni;
- `pausa`/`riprendi`: un file si ferma e riprende da dov'era; la sintesi si
  ferma e, alla ripresa, la frase si ridice da capo (`speechSynthesis.pause`
  su Android non esiste e altrove si inceppa); il solo testo ferma il suo
  orologio;
- la scheda nascosta mette in pausa da sola, e al ritorno riprende solo ciò
  che aveva messo in pausa lei — una pausa chiesta (la demo, che aspetta
  «Riprendi») resta;
- **cambio lingua**: una richiesta che viene da un ID o da una funzione si
  ricompone nella lingua nuova e riparte (anche in pausa, restando ferma);
  una frase scritta a mano resta;
- il primo gesto sblocca l'elemento audio (iOS vuole che abbia suonato una
  volta dentro a un tocco) e la voce del dispositivo; ogni gesto rimette in
  gioco una voce data per muta.

## Le demo

Ogni scena dei tour predefiniti ha la sua azione:

```
action: narrate { id: 'demo.narr.eclisse_tour.1' };
```

e le demo personali possono scrivere il testo a mano:
`narrate { text: 'Qui la Luna tocca il Sole.' }` (al massimo 400 caratteri).
La voce vive quanto la scena: il cambio di scena, Ricomincia, Termina demo,
Esc, l'errore e la fine chiudono l'esecutore, e l'esecutore chiude la voce.
Pausa e ripresa arrivano dal motore (`contesto.pausa`/`contesto.riprendi` in
`demo-motore.js`). Il testo compare dentro al pannello della demo, che lo
porta con sé nel pieno schermo. Le frasi devono stare nella durata della
scena (due parole e mezza al secondo): `controlla-narrazione.js` lo verifica.

## Missione Cielo

`missRacconta` consegna la frase alla narrazione sul canale `missione`, con
il tono del momento della caccia (`MISS_TONI_VOCE`) e i campi in più per il
ponte Edge-TTS (`missCampiEdge`: voce espressiva, SSML con pause e nome
accentuato, stile). Il sottotitolo è spento: il testo è già nella striscia e
nel pannello. Il tasto Riascolta passa `forza: true` e parla anche a
narrazione spenta.

## Le Impostazioni

**Osservazione → Narrazione**: accesa/spenta, volume, mostra il testo, usa
solo la sintesi (ignora gli audio registrati), «Ascolta una prova» e una
riga di stato (quanti audio registrati ha la lingua corrente, che sintesi
c'è). Le scelte stanno in `astrocalendario_narrazione` (localStorage) e,
come le altre preferenze del dispositivo, non vanno nel backup.

## Offline

`sw.js` legge lo stesso manifest con `importScripts` e mette in cache tutti
gli audio elencati all'installazione, uno per volta e senza far fallire
niente. Gli audio si caricano con `fetch` (non con `src` diretto) proprio
per passare dalla cache senza richieste a intervalli; da `file://` si usa il
percorso diretto.

## Prove

```
node scripts/prova-narrazione.js             # il motore, senza browser
node scripts/controlla-narrazione.js         # manifest, ID, impronte, durate
node scripts/prova-narrazione-browser.js     # demo, Missione, Impostazioni, offline
```
