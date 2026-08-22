# Task Corrente

Niente in corso.

## Ultimo lavoro chiuso — il planetario fermo al ritorno, e la grana che scivolava

Due segnalazioni da telefono, tutt'e due nel planetario.

### 1. «Esco dall'app, torno, e il planetario è bloccato»

**La causa.** Non era un'eccezione (per quella c'è già il `try` di
`skyCiclo`, §12 di CLAUDE.md): è che la `requestAnimationFrame` chiesta prima
di uscire **non viene mai chiamata**. Un browser da telefono, quando la
pagina va in secondo piano, la congela e ne butta le rAF in attesa; al
ritorno la pagina riprende dov'era, ma quella chiamata non arriva più.
`sky.raf` continua a tenere il suo numero, quindi da dentro il codice il
ciclo *risulta acceso*: è morto e si dichiara vivo, e nessuno lo riaccende.
Il `visibilitychange` che c'era non bastava, e non poteva: su iOS, passando a
un'altra app o bloccando lo schermo, al ritorno spesso non arriva affatto.

**La cura** — nuova §**7.4-quinquies** in `app.js`. Non si aspettano più gli
avvisi, si guardano i fatti: un **battito** (`sky.battito`) scritto a ogni
fotogramma e una **sentinella** che ogni secondo controlla che non sia
vecchio (`skyVigilaCicli`, `SKY_BATTITO_MS` 1000, `SKY_CICLO_FERMO_MS` 1500).
`pageshow`, `focus`, `resume` e la visibilità restano agganciati, ma solo per
ripartire *subito* invece che entro un secondo. Tre cose che non sono
dettagli:

- chi non ha mai battuto **non** si accende: una finestra segna `aperto`
  prima di misurare la tela, e partirle davanti vuol dire disegnare su misure
  che non ci sono ancora;
- chi ha **prestato** il ciclo a un'altra vista si segna `sky.cicloPrestato`
  (`skyPrestaIlCiclo`/`skyRestituisciIlCiclo`, che hanno preso il posto dei
  due `!!sky.raf` copiati in `apriSistemaSolare` e nella lezione), se no la
  sentinella riaccenderebbe il cielo sotto al Sistema Solare;
- ripartendo, `dt` e playback ripartono da zero, e si richiede il wake lock
  che il sistema aveva rilasciato.

La stessa rete vale per le altre tele che si animano da sole: vista 3D,
lezione dell'eclittica, simulazione, e i banchi della Didattica attraverso
`didatticaVigila()` (in `didattica.js`, che ha il ciclo in un altro file).

**Provata nell'app vera** con Chromium: aperto il planetario, simulato il
guasto esatto (`cancelAnimationFrame(sky.raf)` lasciando `sky.raf` col suo
numero) e verificato che entro due secondi il ciclo riparte e continua a
battere.

### 2. «Zummando, la texture del terreno scivola sopra al paesaggio»

**La causa.** La grana era scritta in funzione della focale: misura
`focale/900` e fase `azimut × focale`. Sulla carta è giusto — una trama
agganciata al terreno deve ingrandirsi con lui — ma qui il campo va da 180° a
un quarto di grado, cioè la focale cambia di settecento volte. Guardando a
sud-ovest (azimut 225°, quasi quattro radianti) bastano trenta pixel di
focale per spostare la fase di una piastrella intera: a ogni pizzicata la
trama strisciava di traverso mentre il paesaggio sotto stava fermo.

**La cura.** La fase non si ricalcola dall'angolo assoluto, si **segue**:
`skyGranaScorrimento` somma a ogni fotogramma di quanto il terreno è
scivolato sullo schermo (`Δangolo × focale`, col giro del nord normalizzato).
Girandosi la grana si muove insieme al terreno esattamente come prima;
zummando l'angolo non cambia, quindi lo spostamento è **zero**. La misura non
segue più l'ingrandimento (`SKY_GRANA_SCALA`). Prove nel §22 di
`verifica.html`, e misurato anche nell'app vera: da 45° a 2° la fase si
sposta di 0,0000 pixel.

## Da sapere — `verifica.html` si ferma al §15, e non per colpa di questo lavoro

Sul commit di partenza (015321b), aprendo `verifica.html` il blocco «Chi si
vede e chi no» del §15 fallisce e poi solleva un `TypeError`, che essendo in
uno `<script>` unico porta via **tutto quello che viene dopo**: i §16–§22 non
girano affatto e la pagina resta a «In corso…».

La causa è che `cimeVisibili()` a un certo punto ha cominciato a **rifare**
azimut e distanza di ogni vetta da `lat`/`lon` (per far scorrere le etichette
col paesaggio senza riscaricare niente), mentre quel pezzo di prova dà alle
vette `lat: 0, lon: 0` con `km`/`az` scritti a mano — e per giunta la pagina
non definisce `luogoCorrente`, quindi `terrenoLuogo()` torna `null` e
`cimeVisibili()` esce subito con un elenco vuoto: `viste[0].nome` esplode.

Per rimetterlo in piedi servono due cose: uno stub di `luogoCorrente` (da
togliere in fondo al blocco, come già si fa con `primaStato`/`primaTerreno`) e
delle `lat`/`lon` vere per le vette finte, calcolate dal luogo di prova. Sono
quattro elenchi di vette da rifare, tutti dentro al §15. **Non è stato fatto
qui**: le prove di questo lavoro sono state verificate su una copia con il
§15 saltato, e lì passano tutte e 527.
