# Task Corrente

Niente in corso.

## Ultimo lavoro finito — la geometria del terreno e dell'acqua

Tre correzioni in `terreno.js`, tutte a errori che nei numeri non si vedono e
sullo schermo sì. `app.js` non è stato toccato: i tre difetti nascono tutti
nella geometria, e chi disegna legge già i valori corretti.

### 1. Il raggio che parte da dentro l'acqua (§12, `acqueTaglia`)

`acqueTaglia` tira un raggio per direzione e conta gli incroci coi bordi dei
poligoni; per accoppiarli — si entra, si esce — deve sapere **da dove parte il
raggio**, e dava per scontato che partisse da terra. Chi mette le coordinate
dentro a un lago, o in mare aperto dentro a un poligono di OSM, col primo
incrocio ci sta invece *uscendo*: tutta la parità si sposta di uno, l'acqua
sotto i piedi non si disegna e la terra oltre la riva viene disegnata come
acqua. A occhio non si vede per quello che è, perché resta plausibile.

- `acquePuntoDentro()` è il test di appartenenza (parità degli incroci di una
  semiretta verso est), fatto **una volta per specchio d'acqua** e solo se il
  suo riquadro contiene l'origine: per un posto normale sono due confronti.
- La parità si tiene **per poligono** (`c.id` sui tagli): due laghi in fila
  nella stessa direzione, o uno sotto i piedi e uno lontano, sono due parità
  diverse. In un mucchio solo la lingua di terra fra i due diventava acqua.
- Se lo specchio in cui si sta è più largo del raggio di ricerca, i suoi
  incroci vengono scartati e la direzione resta senza tagli: allora l'acqua
  arriva fin dove si guarda. Non sapere dove finisce il mare non è una ragione
  per non disegnarlo.
- `sommersi` e `limite` viaggiano appesi all'array dei tagli, perché
  `acqueBandeDaTagli(acqueTaglia(…))` è scritto così in tre posti.

### 2. La quota dell'occhio, guardando dall'acqua (§7 e §12)

La quota di casa è il termine che si **sottrae** a tutti gli angoli, quindi
sbagliarla di venti metri storta l'orizzonte intero. E si sbaglia proprio
sull'acqua: quando la richiesta del punto non arriva, la quota viene dalla
mediana dell'anello di campioni a centocinquanta metri, e in mezzo a uno
specchio più stretto di così quella mediana è la **riva** — l'acqua risulta in
una fossa e il paesaggio attorno un anfiteatro.

- `acqueQuotaSuperficie()` prende il **minimo** dell'anello più vicino (il
  minimo e non la mediana: l'acqua è la cosa più bassa che c'è lì attorno), e
  la quota misurata nel punto, se è arrivata davvero, vince su tutto — quella
  *è* la superficie, e allora non si tocca niente.
- `terrenoRimontaConQuota()` rifà creste, creste parziali, paesaggi e miscela
  dalle quote grezze che sono già in mano: scrivere solo `terreno.quota` non
  basterebbe. Nessuna richiesta in più.
- `acqueAllineaOcchio()` è chiamata sia da `terrenoApplica` sia da
  `acqueApplica`, perché i due arrivano in ordine imprevedibile, e non fa
  niente due volte.
- Una banda che comincia ai piedi prende la quota su cui si sta invece di
  chiederla alla griglia: un fiume o un laghetto non hanno nessun campione
  dentro di sé, e `acqueQuotaDi` ripiegherebbe sulla riva — che con una riva
  ripida sta sopra l'occhio, e l'acqua su cui si galleggia veniva scartata.

### 3. Gli spilli e l'asintoto (§1, §3, §5)

- `TERRENO_DISTANZA_MIN_M` (50 m) dentro `terrenoAngolo`: a distanza zero una
  `atan2` non si arrende, risponde novanta gradi — una parete verticale nata da
  una divisione per zero, e chi la riceve non ha modo di accorgersene. È metà
  di una cella del modello del suolo, e il primo campione della griglia sta a
  centocinquanta metri: non morde niente di quello che si scarica.
- `terrenoTosaSpilli()` in coda a `terrenoFronti`: un **tetto** e non una media
  — una media abbasserebbe le vette vere, che sono le sole cose che uno guarda.
  Una direzione non può stare più di `TERRENO_SPILLO_GRADI` (1,2°) sopra la più
  alta delle sue due vicine alla stessa distanza, confrontata coi valori di
  prima (se no il taglio si propaga e in un giro l'orizzonte è piatto). Una
  catena non si muove di un centesimo; la stalagmite, che per definizione le
  vicine alte non ce le ha, sparisce. Il taglio conserva la non-decrescenza in
  distanza, che è l'invariante dell'occlusione.
- Da lì viene anche che `terrenoMonta` ricavi le **creste dall'ultima colonna
  delle creste parziali** invece di rifare il massimo per conto suo: erano due
  conti gemelli, e con la tosatura in mezzo darebbero due orizzonti diversi —
  la sagoma disegnata e la cresta che decide se un astro è sorto — proprio sui
  denti, cioè dove si appendono i nomi delle montagne.
- `acqueDepressione()` è lo stesso conto con una differenza sola: tosa
  l'**angolo** (`ACQUE_DEP_MAX_GRADI`, 85°) e non la distanza, perché l'acqua
  ce l'hai davvero sotto i piedi. Ottantacinque e non novanta perché il nadir
  esatto, in stereografica, è l'antipodo del centro della vista.

### Come è stato verificato

`verifica.html` passa da **391 a 423 prove, tutte passate**: trentadue nuove
in §9 (l'asintoto), §15 (gli spilli, e l'accordo fra creste e creste parziali)
e §20 (il raggio da dentro l'acqua, e la quota dell'occhio). Nessuna prova
esistente è stata cambiata o allentata.

Nota per chi rilancia il banco in un ambiente senza rete verso jsdelivr: la
CDN di Astronomy Engine è l'unica dipendenza esterna di quella pagina, e si può
reindirizzare a una copia locale (`npm i astronomy-engine@2.1.19`) con una
`page.route` di Playwright, senza toccare `verifica.html`.
