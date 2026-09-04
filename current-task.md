# Task Corrente

Niente in corso.

## Ultimo intervento completato

**Un pannello solo per «come guardo il cielo»**, più tre cose che gli stavano
attorno: i comandi dello schermo che non si toglievano di mezzo, la slitta
dell'aurora sempre a schermo, e il sottotitolo dell'app.

### 1. «Navigazione» è entrata in «Visualizzazione»

Erano due linguette sopra la mappa e facevano la stessa domanda — *come guardo
il cielo* — spezzata in due: in «Navigazione» c'erano i punti cardinali,
«Segui il telefono», Centra, Insegui, il campo visivo e la bussola; in
«Visualizzazione» c'era tutto il resto. Chi cercava «Centra» doveva indovinare
quale delle due aprire, e il nome non aiutava.

Adesso è un pannello solo con **cinque schede**, e la prima è **Direzione**:

- **Direzione** — *Guarda verso* (N E S O Zenit), *Chi muove la vista* (Segui
  il telefono, Centra, Insegui, Campo 55°), e in fondo, ripiegata dietro a
  «Il Nord punta storto?», la bussola con la taratura sull'astro e la
  posizione. Sta per prima perché è quello che si tocca appena arrivati.
- **Schermo**, **Oggetti**, **Cielo**, **Paesaggio** come prima.

Con lei è passata **«Vista pulita»**, che in Navigazione non c'entrava niente:
toglie di mezzo quello che sta *sopra* al cielo, cioè è di famiglia col pieno
schermo e coi colori notturni. Le linguette sopra la mappa restano quattro:
Tempo, Eventi, Visualizzazione, Astri.

La cosa che non si vede leggendo il codice: le pillole delle schede hanno
`white-space: nowrap` e **non vanno a capo**. Cinque nomi su un telefono da
320 px sforavano di quattro pixel e mezzo — misurati — e il testo usciva dal
suo tondo. Sotto i 380 px la striscia si stringe al filo e il corpo scende a
0,6rem, che è l'ultimo gradino già in uso per i sette segmenti del pannello
del tempo. La soglia non è a occhio: a 0,7rem lo sforo si annulla fra i 375 e
i 390. Provata anche la via delle due righe a corpo pieno: si legge meglio, ma
la striscia è appiccicata in cima e quei trentaquattro pixel in più li paga
l'elenco dei tasti sotto — che è la cosa per cui il pannello si è aperto.

### 2. I comandi della scheda «Schermo» si tolgono di mezzo

Pieno schermo, modalità notte, hover e fotocamera adesso **chiudono il
pannello appena li si tocca**. Non è una comodità: cambiano tutti e quattro
*come si vede il cielo*, e il pannello copre metà del cielo — restando aperto
nascondeva proprio la cosa che il tocco era servito a cambiare, e per vederla
bisognava richiuderlo a mano. Sono la stessa famiglia di «Centra» e «Campo
55°», che il pannello lo chiudevano da sempre.

Due dettagli: l'hover **non** chiude niente a tasto spento (non è successo
niente, e chiudere somiglierebbe a una risposta), e la fotocamera chiude
*prima* di chiedere il permesso, che può metterci qualche secondo. Il ⛶ sulla
mappa non chiude niente perché a schermo intero i pannelli non si aprono.

### 3. L'aurora apre e chiude i suoi comandi

La slitta del Kp e la riga «cosa si vedrebbe da qui» erano **sempre** a
schermo: due terzi della scheda «Cielo» occupati da un comando che regolava
una cosa che non si stava disegnando — da queste latitudini l'ovale acceso non
disegna niente, sta sotto l'orizzonte — e da una frase che raccontava un cielo
che nessuno stava guardando. Chi arrivava lì per le nuvole doveva scorrerle
via.

Adesso l'aurora **nasce spenta**, come i nomi dei monti e i disegni delle
costellazioni, e il suo tasto fa due cose in un gesto: accende l'ovale e apre
i suoi comandi. Il comando non si può perdere — muovendo la slitta l'aurora si
accende da sé — e quando l'aurora c'è davvero non tocca all'utente
accorgersene: il riquadro della dashboard, gli eventi «aurora» del calendario
e il banco della Didattica la accendono già da sé.

### 4. Il sottotitolo

«Cosa c'è da vedere in cielo, stanotte e nei prossimi anni» (53 caratteri) →
**«Il cielo di stanotte, da casa tua»** (33). Non è solo più corto: quello di
prima veniva **tagliato dai puntini** a 1280 e a 1800 px di finestra, cioè non
si leggeva mai per intero proprio dove c'era spazio. Adesso ci sta.

### Come è stato provato

`scripts/prova-nel-browser.js` e `scripts/prova-fumetto.js` (75 prove, tutte
verdi) girano come prima — i tre guasti che restano rossi nel primo sono gli
stessi identici sul commit di partenza, controllati con `git stash`. In più,
in un browser vero: le linguette sono quattro, le schede cinque, i comandi di
Navigazione sono davvero dentro a «Direzione» e funzionano (toccare «S» gira
la vista a 180° e chiude il pannello), i quattro tasti di «Schermo» chiudono
il pannello e l'hover a tasto spento no, la slitta dell'aurora è alta 0 px a
tasto spento e 127 con l'ovale acceso, e le cinque schede stanno in una riga
senza sbordare a 320, 360 e 412 px.
