# Niente in corso

Ultimo lavoro chiuso: **l'inseguimento a rilevazioni degli aerei nella realtà
aumentata** — «l'allineamento fra l'etichetta AR e l'aereo reale è impreciso».

## Il conto, prima di cercare altrove

`visione.js` raddrizza il **cielo** e lo fa bene: misura l'errore di bussola
sugli astri e da lì in poi lo porta avanti il giroscopio. Quello che resta fra
l'etichetta di un aereo e il suo aereo vero non è però un errore di bussola —
è l'errore della propagazione ADS-B, ed è **di quell'aereo** — e quel modulo lo
cura già con le ancore (§9). La cura è giusta; quello che non reggeva sono due
numeri.

**La cadenza.** Quel motore guarda l'immagine dodici volte al secondo nel caso
migliore (`VIS_CADENZA_MS` 80 ms, per giunta strozzato a un fotogramma su sei
da `VIS_FRAME_PASSO`), e fra una misura e l'altra l'ancora è **ferma**. Il
giroscopio porta avanti l'assetto, cioè il cielo; l'aereo no, perché l'aereo
nel mondo non sta fermo. Un aereo vicino attraversa il cielo a quasi tre gradi
al secondo: in un dodicesimo di secondo sono due decimi di grado, e a ogni
misura l'etichetta fa un saltino. Il sintomo non è «è spostata», è **«balla»**.

**La risoluzione.** Quel motore lavora su un fotogramma ridotto a trentamila
pixel, ed è la scelta giusta per gli astri — la Luna è un disco di mezzo grado
e il centroide pesato porta la misura sotto al pixel comunque. Per un aereo no:
un aeroplano di linea con quaranta metri di apertura, a dieci chilometri, è
largo **due decimi di grado**, cioè a due virgola sei pixel per grado del
fotogramma ridotto **sei centesimi di pixel**. Non è una macchia debole: non
c'è proprio. Nel fotogramma nativo (trenta pixel per grado) lo stesso aereo è
largo sei pixel, ed è una sagoma che si rileva benissimo.

## La cura: `inseguimento.js`, prefisso `ins`

Guardare in piccolo, ma da vicino e spesso. La pipeline è quella chiesta:

    ritaglio (§5) → rilevazione (§3) ─┐
                                      ├→ Kalman (§4) → ancora (§9)
                    flusso ottico (§2)┘

- **Il ritaglio (ROI)** si prende dal fotogramma **nativo**, 192×192 attorno a
  dove il cielo calcolato mette l'aereo. Il conto che rende sostenibile tutto
  il resto: sono l'**uno e mezzo per cento** dei pixel di un fotogramma
  1920×1280, e a parità di pixel letti si guarda l'aereo a dieci volte la
  risoluzione angolare di prima. 192 e non 256 perché a trenta pixel per grado
  coprono sei gradi e mezzo, cioè sette volte l'errore a regime: 256 si paga e
  non si usa.
- **La rilevazione** è un filtro adattato (fondo locale con somma integrale,
  residuo, componente connessa, baricentro pesato), col **segno** dichiarato —
  di giorno un aereo è una sagoma scura e chi cerca solo il chiaro non lo trova
  mai — e coi filtri di forma che tengono fuori nuvole e fili di luce.
- **Il flusso ottico** è un Lucas-Kanade piramidale scritto a mano (tre
  livelli, finestra 11×11, campionamento bilineare), su una griglia di nove
  punti con mediana robusta e **controllo avanti-indietro**. Gira diciannove
  fotogrammi su venti; rilevare costa un millisecondo, inseguire un decimo.
- **Il filtro** è un Kalman a velocità costante, due filtri a una dimensione
  invece di uno a due (con rumori diagonali è **esatto**, non una
  scorciatoia). Non leviga: **continua** — fra due misure la previsione si
  muove con la velocità appena misurata, ed è quella riga a togliere il
  saltino.

**Il filo di sfondo.** Il file è insieme lo script della pagina e quello del
worker, e sceglie guardando se `window` esiste: è l'unico modo di farlo senza
un bundler, e questa applicazione non ne ha. Dal filo principale esce solo il
ritaglio (`createImageBitmap` col rettangolo, lavoro della GPU, e l'immagine si
**trasferisce** invece di copiarla). Da `file://` il worker non si apre e si
ripiega sul filo principale con le stesse funzioni, per un millisecondo a
fotogramma.

**YOLO non c'è di serie, e il suo posto c'è per intero** (§7). Il formato non
c'entra — TFLite e CoreML sono nativi, in un browser le strade sono ONNX
Runtime Web o TF.js. C'entrano tre numeri: sei megabyte di modello più tre di
runtime su un'app che ne pesa quattro; ottanta-duecento millisecondi per
inferenza, cioè una pausa di dodici fotogrammi a ogni rilevazione; e soprattutto
la resa — la classe «airplane» di COCO è fatta di aeroplani grandi nel quadro,
mentre qui il bersaglio è una sagoma di sei pixel che a 320×320 ne diventa uno.
Il rivelatore è quindi **scambiabile** (`insRivelatori`), la strada di YOLO è
scritta, si accende con `INS_MODELLO_URL` in `config.js`, si carica a richiesta
e solo nel worker, e quando non trova niente **ripiega** sul rivelatore del §3
invece di rispondere «niente».

## Quattro difetti trovati misurando, che a occhio non si vedevano

1. **La soglia dell'autovalore non può essere una costante.** Su cielo vuoto i
   gradienti non sono zero: sono rumore, e con la differenza centrata la loro
   varianza vale mezzo sigma quadro. Con σ di tre livelli quella media vale
   quattro e mezzo, cioè **otto volte** la soglia fissa di 0,55: il cielo vuoto
   passava e il flusso ottico inseguiva la grana del sensore, un pixel e mezzo
   per fotogramma in direzioni a caso. La soglia si scrive adesso in scarti
   tipici (`INS_LK_AUTOVALORE_SIGMA`), e lo scarto tipico lo misura già il
   rivelatore: si porta avanti nella memoria della traccia.
2. **Il controllo avanti-indietro ereditava il seme dell'andata**, quindi al
   ritorno partiva dalla parte opposta di dove doveva arrivare e bocciava le
   corse **buone**. Misurato: attraversando un salto di trenta pixel si perdeva
   un fotogramma su venti, e precisamente quello del salto.
3. **Il filtro riceveva un incremento e lo trattava da scarto assoluto.**
   `a.az` non è la posizione del feed: è quella del feed più l'ancora, perché
   `ancoraVista` gliel'ha già sommata. A convergenza lo scarto vale zero, il
   filtro riporta l'ancora a zero, l'etichetta torna dov'era e riparte —
   un'oscillazione lenta che si legge come un'etichetta che respira. Si
   risomma l'ancora applicata, letta da `visAncoraAereo`, che è la stessa porta
   che il disegno interroga: così non c'è una seconda contabilità da tenere
   allineata.
4. **Il contro-esempio del seme non era quello che veniva in mente.** Finché la
   previsione insegue bene l'aereo la patch resta centrata su di lui e il
   flusso ottico ce la fa anche col seme azzerato: la prima versione della
   prova era verde in tutt'e due i casi, cioè non provava niente. Quello che il
   seme copre è il **salto** della previsione quando arriva una lettura ADS-B
   nuova, ed è su quello che il contro-esempio morde.

## Prove

- `node scripts/prova-inseguimento.js` (nuovo, e in CI) — **42 su 42**, mezzo
  secondo, senza browser né dipendenze. Dieci famiglie, tre col loro
  contro-esempio.
- `node scripts/prova-verifica.js` — **1.307 verdi, 6 rosse, le stesse sei
  prima e dopo** (tre sull'acqua rasente, una sulla camera che insegue, due sul
  raggio fisso della realtà aumentata).
- `node scripts/prova-nel-browser.js` — le stesse quattro rosse di prima, e si
  interrompe su `solDisegnaVicino` come già faceva.
- `node scripts/controlla-i18n.js --patto` e `node scripts/prova-i18n.js`
  falliscono **identici all'albero pulito** (347 cablate contro un tetto di
  346, e una chiave orfana): sono rossi di prima, e `inseguimento.js` non
  aggiunge nessuna stringa da leggere.

## Quello che resta da fare

**Il numero vero non è stato misurato su un telefono.** Tutto quello che c'è
scritto qui sopra è aritmetica e scene sintetiche: quanto l'etichetta stia
davvero addosso all'aereo si vede solo puntando la fotocamera su un cielo con
un aereo dentro, e quella misura qui non si poteva fare. Le due cose da
guardare quando la si farà sono `insStato()` — se `worker` è falso si sta
girando sul filo principale, e allora il costo va guardato — e `insTracce()`,
dove un `modo` che resta su `rilevato` vuol dire che il flusso ottico non sta
mai tenendo, cioè che le tracce si perdono e si rifanno a ogni giro.

**Le costanti sono ragionate, non tarate.** `INS_LATO_PATCH`,
`INS_PASSO_RILEVA`, `INS_KALMAN_ACCEL` e i due rumori di misura escono da conti
scritti in chiaro (e il §10 del banco li controlla contro quei conti), ma
nessuno di loro è stato mosso guardando un aereo vero. Il primo da rivedere è
`INS_KALMAN_ACCEL`: se l'etichetta risultasse ancora molle, è lui.

**Il campo visivo dell'obiettivo resta una stima.** Il ritaglio della patch
passa per `sky.larghezza`/`sky.altezza` e per la geometria del «cover», che
sono esatte; ma quanti gradi valga un pixel lo decide ancora la taratura di
`visione.js` §8. Un obiettivo grandangolare tarato male non sposta la patch —
la patch segue la proiezione — però allarga l'errore che il filtro deve
assorbire.
