# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 353 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js` — le eclissi (la mappa
dell'ombra, le eclissi di casa, quelle lunari), le simulazioni e gli avvisi del
planetario. Il tetto resta a 362.

## Ultimo intervento completato

**La bussola del planetario: lettere grandi, i due numeri fuori dal
quadrante.**
Richiesta: «fai la bussola del planetario più chiara e immediata, le lettere
dei punti cardinali devono essere più grosse e leggibili, aggiungi il grado
dell'angolo del campo di vista (FOV), sistema anche l'angolo della bussola e
mettilo dove si vede bene, rendila pulita e chiara.»

### 1. Il difetto, misurato

Il quadrante teneva **quattro cose sovrapposte** in ottantadue pixel: la rosa
che gira, il cono azzurro dell'inquadratura, l'ago, e in mezzo due righe di
testo. Le misure, prese nel browser:

- le lettere dei punti cardinali uscivano a **11,5px** (la N) e **9px**
  (E/S/O) — sotto a un cono semitrasparente e sopra a un fondo che cambia;
- l'azimut a **11,5px** e la sigla del punto a **7,2px**, cioè scritta e non
  leggibile, per giunta appoggiata su un quadrante che ruota;
- il campo visivo in cifre **non c'era affatto**: lo diceva solo l'apertura
  del cono, che risponde a «largo o stretto?» e non a «quanto?».

### 2. La cura: la bussola è in due pezzi

Sopra il **quadrante**, che adesso è soltanto disegno — niente testo in mezzo,
quindi le lettere si sono prese lo spazio che i numeri lasciavano libero e
l'ago è diventato una freccia intera che passa per il perno, come su una
bussola da tavolo. Sotto una **pillola ferma e opaca** coi due numeri: a
sinistra dove si guarda (`128° SE`, in giallo come l'indice che lo indica), a
destra quanto cielo si inquadra (`45°`, in azzurro come il cono, con il cono
stesso in miniatura al posto dell'etichetta). Un numero da leggere vuole un
fondo fermo; un'apertura da guardare no.

Misurato dopo: la N esce a **15,8px** e le altre a **13,2** (+37%), l'azimut a
11,8px su fondo pieno e la sigla a 9,6px.

### 3. Le tre cose che non sono estetica

1. **Le lettere restano dritte.** La rosa gira di −az e si portava dietro
   anche loro: su una rosa di carta è così, e finché erano alte nove pixel non
   se ne accorgeva nessuno — ma guardando a sud la E diventa una «Ǝ», cioè
   l'opposto di quello per cui sono state ingrandite. Ogni lettera disfa la
   rotazione **attorno al proprio punto** (`sky.bussolaSigle`, quattro nodi
   cercati una volta sola e riscritti solo quando l'angolo cambia davvero).
2. **Le sigle sono nel dizionario** (`punto.sigla.*`): erano scritte a mano
   nell'HTML, e in inglese il quadrante diceva «O» al posto di «W». Provato:
   adesso `NESW`.
3. **Girati, i numeri vanno di fianco e non sotto.** Su un telefono
   orizzontale il cielo è alto un terzo, e la pillola sotto al quadrante
   portava il blocco a 147px, cioè diciannove oltre `--zona-alta-cielo` —
   dove passa la scheda dell'oggetto. Di fianco, il blocco è alto quanto il
   quadrante (126px) e la fascia torna quella di sempre.

### 4. I due contro-esempi trovati misurando

- **Riservare posto alla pillola nella barra dei comandi era peggio del
  male**: la pillola è larga 111px contro gli 88 del quadrante, e portando il
  `padding-right` a 126px la barra andava a capo su un telefono — due righe di
  comandi per fare spazio a una cosa che non ci passa accanto (la pillola sta
  più in basso dei tondi delle linguette). Il posto riservato è quello del
  solo quadrante, com'era prima.
- **`--zona-alta-cielo` a schermo intero**: lì la bussola torna nel flusso, e
  il valore dichiarato (128px) era già sbagliato prima di questo lavoro — 146
  veri. Adesso c'è una riga di `:has()` che lo porta a 176/152 quando il
  contenitore è a schermo intero, e la legge anche `skyFasceCielo()`, che
  cerca la misura su `.vista-cielo`. Resta approssimato — e scritto nel
  commento — il caso del telefono stretto a schermo intero, dove la barra dei
  comandi va a capo per conto suo.

### 5. Provato

- In un Chromium vero su tre schermi (360×640, 640×360 con `pointer: coarse`,
  1280×800): misure dei corpi, larghezze, che le linguette non vadano a capo
  né si mettano a scorrere, la fascia in cima con e senza schermo intero, e le
  sigle dopo il cambio lingua.
- `node scripts/prova-fumetto.js`: **stesse due prove rosse di prima dello
  stesso identico valore** (`fascie 128 / 152` e `128 / 634`), cioè nessuna
  regressione — sono due difetti preesistenti del fumetto, non della bussola.
- `node scripts/prova-lingua.js`: tutte le prove passate.
- `node scripts/controlla-i18n.js --patto`: 362, dentro al tetto.
- `CACHE_NAME` portato a `astrocal-v280`.
