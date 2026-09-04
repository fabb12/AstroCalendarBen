# Task Corrente

Niente in corso.

## Ultimo intervento completato

**I transiti**: quando un aereo o una stazione spaziale passano davanti al Sole
o alla Luna, quando succede, e come si fa ad arrivarci in tempo. Un modulo
nuovo (`transiti.js`, prefisso `tran`), l'arco degli aerei esteso, l'ordine
del disegno corretto e un avviso a schermo.

### Il conto da cui nasce tutto

Il disco del Sole è largo mezzo grado. Un aereo a cinque chilometri attraversa
il cielo a quasi tre gradi al secondo, la ISS a uno: **il transito dura fra un
decimo di secondo e un secondo e mezzo**. Il codice di prima
(`aggiornaAllineamenti` in `aerei.js`) cercava gli allineamenti su **sei
campioni distanti un minuto**, e la probabilità che uno di quei sei istanti
caschi dentro alla finestra buona è meno di **una su trecento**.

Non era un filtro poco sensibile: era un filtro che non poteva funzionare. E
il sintomo — nessun avviso — è identico a «stanotte non passa niente», che è
il modo in cui questo genere di difetto resta in piedi per sempre: nessuno,
guardando lo schermo, può dire quale dei due sta vedendo.

### 1. Il modulo — `transiti.js`

Quattro scelte, e sono quelle che il file esiste per tenere in piedi.

- **Il passo si misura in gradi, non in secondi.** Si cammina lungo la
  traiettoria tenendo fisso quanto l'oggetto si sposta *in cielo* fra un
  campione e il successivo. Ne viene una proprietà che vale la pena scrivere:
  il numero dei campioni è la lunghezza angolare del cammino diviso il passo, e
  **non dipende dalla durata** — un aereo lento che striscia per il quadruplo
  del tempo percorre lo stesso arco e costa lo stesso. Vicino, dove corre, i
  passi si accorciano da soli; ed è lì che serve.
- **Il minimo si raffina, non si campiona.** Il campionamento serve solo a
  *incastrare* il momento del massimo avvicinamento fra due istanti; da lì lo
  trova una sezione aurea, che arriva al millisecondo.
- **Le due incertezze si dichiarano.** Un TLE di ieri sbaglia di un decimo di
  secondo; l'estrapolazione di un aereo a cinque minuti sbaglia di **gradi**.
  Sono due mondi diversi e un avviso che li scrivesse con la stessa faccia
  mentirebbe su uno dei due.
- **Il conto sta fuori dal fotogramma.** Misurate: la scansione degli aerei
  con quaranta aerei in cielo costa dieci millisecondi (quanto un fotogramma
  intero), quella delle stazioni ne costava **trecentotredici**. Adesso vanno
  tutt'e due in `requestIdleCallback`, e la seconda è una coda di compiti che
  cede il turno ogni mezzo fotogramma (mediana misurata: 2,6 ms).

### 2. L'arco degli aerei, e quanto ci si può credere

Cinque minuti erano la previsione **disegnata**, ed erano diventati per inerzia
anche il limite di quella **calcolata**. Ma un aereo a undici chilometri sta
sopra l'orizzonte fino a trecentosettanta chilometri: il suo arco dura
**venticinque minuti**. Adesso si campiona ogni dieci secondi nel primo minuto
(un aereo sopra la testa fa quasi duecento gradi in sessanta secondi: una corda
fra due campioni al minuto taglierebbe il cielo da parte a parte) e al minuto
da lì in poi, fermandosi dove l'aereo **tramonta davvero**, dietro l'orizzonte
vero di `terreno.js`.

La riga disegnata si assottiglia e sbiadisce oltre i cinque minuti, e non è una
sfumatura: un grado di scarto di rotta su venticinque minuti sposta l'aereo di
sei chilometri e mezzo. Quello che si vede è la fiducia che cala, non una rotta
che si conosce. Per la stessa ragione un transito d'aereo si annuncia **a un
minuto e non a cinque**: a cinque il cono d'incertezza è largo più di otto
gradi, e il disco del Sole ne è largo mezzo.

### 3. L'ordine del disegno — il difetto che rendeva inutile tutto il resto

`aereiDisegna` girava insieme all'aurora, cioè **prima** degli astri: un aereo
che transitava sul Sole ci finiva **dietro**. La geometria era giusta, la
previsione era giusta, e sullo schermo non si vedeva niente — l'unica cosa che
nessuno poteva guardare era proprio il momento previsto.

Adesso gli aerei si disegnano in fondo a `disegnaAstriPrincipali()`: sopra a
tutti gli astri e sotto al terreno. E chi ha appena disegnato il Sole o la
Luna lascia la **ricevuta** di dove il disco è finito sullo schermo
(`skyDischiAstri`), così chi ci passa davanti si disegna nero pieno e senza
contorno — un alone attorno a una cosa già nera è l'unico modo di sfocare
l'unica silhouette netta che questo cielo abbia.

Con lei sono arrivate due misure vere: un aereo a due chilometri è largo **più
del doppio del Sole** e a forte ingrandimento si disegna così, e le stazioni
hanno un **modellino** invece del rombo — a un quarto di grado di campo la ISS
è larga trentasette pixel, e disegnarci un rombo è come disegnare Saturno
senza anelli perché tanto è un puntino.

### 4. L'avviso

Sta sul cielo e non in un pannello (un pannello chiuso non avvisa nessuno), e
il tempo che manca è la cosa più grande scritta lì dentro. La riga sotto dice
dove guardare, quanto dura e con che tolleranza — un orario per una stazione,
una mira per un aereo.

### Come è stato provato

- **`verifica.html` §31**, 57 prove nuove: il conto che non torna (col
  contro-esempio dei sei campioni al minuto), il passo in gradi, la precisione
  (la separazione con l'`atan2` resta esatta a un milionesimo di grado dove
  l'`acos` risponde **zero**), gli astri interpolati misurati contro Astronomy
  Engine, e l'onestà delle due incertezze. 1138 verdi, 5 rosse — le stesse
  cinque del commit di partenza, controllate con `git stash`.
- **`scripts/prova-transiti.js`** (nuovo), 28 prove in un browser vero: sono
  le due cose che un conto non può giudicare. **Il pixel** al centro del Sole
  con l'aereo davanti (252/255 senza, 8/255 con, e nero pieno invece del
  colore della fascia), e il **modellino** delle stazioni misurato dove il
  rombo non arriva. Più l'avviso, il motore dall'aereo all'avviso, i TLE, e
  l'invariante della coda a scaglioni.
- `prova-nel-browser.js` e `prova-fumetto.js` girano come prima: gli stessi
  tre e due guasti rossi del commit di partenza, controllati con `git stash`.
  Il fotogramma non è cambiato (otto al secondo in container, uguale prima e
  dopo).

### Un difetto trovato dalle prove, e vale la pena ricordarlo

`Number.isFinite(Infinity)` risponde **falso**. Il budget «tutto in un colpo»
di `tranLavoroStazioni` ricadeva quindi sugli otto millisecondi di serie, la
coda cedeva il turno, e la versione sincrona tornava con la sua lista ancora
vuota. Era invisibile finché le tabelle degli astri erano già in memoria — il
lavoro che restava ci stava dentro a uno scaglione — e compariva solo quando
bisognava ricostruirle: a intermittenza, che è il modo peggiore. L'ha preso la
prova che confronta le due strade della coda, ed è esattamente quello per cui
c'è.
