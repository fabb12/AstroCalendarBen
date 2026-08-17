# Task Corrente

Niente in corso.

## Ultimo lavoro finito — il paesaggio che ci metteva un'eternità

Chiesto: capire perché il caricamento dei dati ambientali (quote, laghi,
vette, paesi) ci mette tanto, e sistemarlo. La risposta è che non era **una**
lentezza: erano cinque attese messe in fila indiana, e nessuna delle cinque si
vedeva leggendo il codice da vicino, perché ognuna era la cura giusta di un
problema vero — solo pagata a un prezzo che nessuno aveva misurato.

Vale la pena tenere l'ordine in cui costavano, perché è controintuitivo.

### 1. Il freno del rubinetto era contato due volte (§4)

Chi si prendeva un 429 chiamava `terrenoFrena`, che sposta in avanti il
`liberoDa` — cioè la pausa era **già imposta a tutte** le richieste di quella
fonte — e poi dormiva *anche* per conto suo 1, 4, 11 secondi
(`TERRENO_ATTESE_MS`) prima di rimettersi in coda. Le due si sommavano in fila
indiana. Le attese esplicite non ci sono più: chi prende un no si rimette in
coda subito, e a tenere il passo è il rubinetto, che è l'unico che sa quanto il
servizio sta reggendo adesso.

### 2. Il freno si tirava una volta per richiesta, non per ondata

Sei richieste in volo si prendono sei no, che sono **la stessa notizia detta
sei volte**. Il passo veniva moltiplicato per 2,2 sei volte di fila — per
centoundici — e in due ondate era al tetto di sei secondi: per ventiquattro
richieste, due minuti e mezzo di sola attesa. Misurato con un servizio che
rifiutava una richiesta su quattro: il terreno **non arrivava mai** (28
richieste HTTP in 90 secondi, e le 24 non finivano). Adesso `terrenoFrena`
tiene un `frenatoFino` e i no della stessa ondata lo trovano già tirato.

### 3. Si girava la manopola sbagliata

Questa l'ha trovata una sonda sul rubinetto, non la lettura del codice: con un
429 su quattro, il rubinetto si assestava a 700 ms di distanza con **cinque
richieste concesse insieme e zero in volo**. Cioè teneva aperta una concorrenza
che non usava, e serializzava tutto su un buco di mezzo secondo: 25 × 700 ms
sono i 18 secondi che si misuravano, e non c'entravano né la latenza né le
riprove. Un 429 dice «troppe **insieme**», e allargare il buco fra le partenze
risponde a una domanda che nessuno ha fatto. Adesso è AIMD, come il TCP: la
concorrenza si dimezza a ogni no e cresce di uno a ogni sì, il passo si allarga
appena (1,25) e si ristringe da sé.

Da qui vengono anche tre numeri più bassi di prima e uno scritto meglio:
`TERRENO_DISTANZA_MAX_MS` a 900 ms — ricavato dal lavoro (24 richieste per un
orizzonte che si è disposti ad aspettare una ventina di secondi) e non dal gusto
—, il tetto che non può stare **sotto** al ritmo dichiarato dalla fonte (con
900 ms secchi, frenare OpenTopoData la faceva andare più veloce della richiesta
al secondo che lei stessa dichiara), e `TERRENO_NO_PER_CAMBIARE` a 5: cambiare
porta **costa**, perché le due riserve dichiarano un decimo della portata di
Open-Meteo, e con 3 no di fila si abbandonava anche una fonte che stava solo
lavorando piano (provato: 31 s → 58 s e incompleto).

### 4. Le due barriere di `terrenoCostruisci` (§5)

- **La quota di casa** aspettava davanti a tutte con un `await`. Un punto solo,
  e per giunta un punto che si sa già stimare dall'anello di campioni a 150 m.
  Adesso parte per prima ma **insieme** alle altre; se non arriva si va avanti
  con la stima, che è quello che succedeva anche prima quando quella richiesta
  falliva.
- **Il giro grosso** era separato dall'affinamento da un `Promise.all`. Una sola
  richiesta del primo giro che si riprovava teneva il rubinetto fermo — niente
  in volo, sedici richieste pronte a partire — per tutto il tempo delle sue
  riprove. La barriera non serviva: quello che il giro grosso deve garantire è
  di essere **disegnato per primo**, e per quello basta contarne i pezzi.

### 5. Le tre richieste a Overpass una dietro l'altra (§10)

`acqueCarica` si accodava a `cime.promessa`, e le vette ai paesi: la richiesta
con la query più larga e la sveglia più lunga stava dietro a tutte e due, ognuna
col suo caso peggiore. E il caso peggiore era **4× la sveglia**, perché
`overpassChiedi` provava le due istanze in fila indiana e poi la query di
ripiego rifaceva la stessa fila: 30+30+30+30, due minuti per le acque.

Il punto che rende tutto questo invisibile è che un'istanza di Overpass carica
non risponde «carico»: **tace**, e tacere consuma tutta la sveglia. Adesso c'è
un rubinetto (`overpassInFila`, due per volta a 600 ms, ognuna da un'istanza
diversa — la politesse che l'attesa in fila indiana comprava, senza pagarla in
secondi) e l'**affiancamento** dentro `overpassChiedi`: dopo 3,5 s parte anche
l'altra porta, vince chi risponde per prima, la perdente si abortisce.

### E una cosa che non era rete affatto

Il tracciamento dei raggi delle acque (`acqueTaglia`) gira **sul filo del
disegno**: finché non finisce, il planetario non disegna un fotogramma. In un
posto normale sono 40 ms; col tetto di `out geom 1200` riempito sono 800 ms su
un computer, cioè due o tre secondi di schermo fermo su un telefono — e proprio
nell'istante in cui l'acqua stava per comparire. Adesso si lavora a scaglioni
di 8 ms (`acqueTagliaAScaglioni`), e il conto è lo stesso: `acqueTagliaUno` è
una funzione sola. `acqueApplica` resta **sincrona** di proposito — a cedere il
turno è la strada di caricamento, non la posa dei risultati — e la prima
versione che la faceva `async` ha rotto sei prove del §20, che leggono
`acque.bande` nella riga dopo. Era il codice a dirlo, e aveva ragione.
Micro-ottimizzazioni in coda: le tabelle di seni e coseni non si rifanno più a
ogni chiamata (1440 funzioni trigonometriche per niente), conversione in metri e
riquadro in una passata sola, la radice quadrata del lato dei fiumi una volta
per lato invece di una per raggio. Fra l'11% e il 24% in meno.

### I numeri, misurati nell'app vera con servizi finti

| scenario | | prima | dopo |
|---|---|---|---|
| rete buona | primo orizzonte vero | 1,5 s | **0,9 s** |
| | terreno completo | 3,5 s | **2,4 s** |
| 429 su una richiesta su 4 | primo orizzonte vero | 3,3 s | **1,6 s** |
| | terreno completo | **94 s** | **6,7 s** |
| un'istanza OSM che tace 40 s | laghi e fiumi | 30,6 s | **1,1 s** |
| | paesi | 15,7 s | **3,7 s** |

Una trappola in cui sono caduto e che vale la pena non ripetere: togliendo la
barriera fra i due giri, una richiesta del giro grosso che si riprovava tornava
in coda **in fondo**, cioè dietro alle ottanta direzioni dell'affinamento. Il
totale migliorava e il primo orizzonte vero peggiorava (3,3 → 7,7 s): si era
guadagnato su tutto tranne che sull'unico numero che l'utente guarda. Da lì le
due classi di precedenza di `terrenoInFila`.

### Verifica

`verifica.html`: **467 prove passate, 0 fallite** (il baseline era 463). Le
nuove: la raffica che frena una volta e non sei, la rotazione dopo dei no di
fila, il sì in mezzo ai no che non fa abbandonare una fonte che funziona, e nel
§20 che il tracciamento a scaglioni dia **gli stessi numeri** di quello in un
colpo. Il banco ha ora un `attendi()` per le prove che devono aspettare, e il
verdetto in fondo alla pagina non si scrive più finché non sono tornate.

Provato anche nell'app vera (Chromium headless, servizi finti per quote e
Overpass, service worker escluso): planetario aperto, terreno completo
120/120 direzioni, 316 bande d'acqua, le 4 richieste Overpass spartite fra le
due istanze, nessun errore di console.
