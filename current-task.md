# Task Corrente

Niente in corso.

## Ultimo intervento completato

**Le montagne sembrano montagne, e i fiumi si vedono** (`rilievo.js` §1 e §9,
`app.js` — il blocco dell'acqua della §7.3.2). La richiesta era in due parti:
il rilievo doveva distinguere le montagne lontane dalle vicine, avere il
colore che una montagna ha nell'immaginario di chiunque — un po' di bianco in
cima, bruno e verde sotto — una trama credibile e un contrasto che le separi a
colpo d'occhio; e i laghi e i fiumi dovevano avere una forma nel posto giusto e
smettere di traballare sotto lo zoom.

### Le montagne

Prima erano di **un colore solo** — il suolo di `SKY_PAESAGGI`, schiarito
fetta per fetta — e la forma la raccontavano il chiaroscuro e i contorni.
Adesso ci sono due veli sopra a quel fondo, e fanno due mestieri diversi:

* **Il colore della quota** (§`RIL_QUOTE`, steso *prima* del chiaroscuro, che
  deve poterlo scolpire). La fascia si sceglie sulla quota **divisa per la
  linea della neve** — `rilNeveDa`, latitudine più stagione — e le fasce sono
  agganciate al **limite del bosco**, non spalmate uniformemente: al primo
  tentativo lo erano, e da un paese di fondovalle a milleduecento metri il
  prato sotto i piedi veniva color paglia mentre le creste in fondo restavano
  verdi, cioè la prospettiva aerea al contrario. Il limite si sfrangia di
  `RIL_QUOTA_FRANGIA_M`, se no la neve comincerebbe alla stessa quota su tutto
  il panorama e sarebbe una curva di livello.

* **Il velo dell'aria** (`RIL_VELO_ARIA`), la prospettiva aerea, steso per
  ultimo sulle stesse quattordici fette che hanno dipinto il fondo. L'opacità è
  **proporzionale a `rilLontananza`** e non a una sua potenza, e non è una
  taratura: quella cifra *è* l'opacità della colonna d'aria. Il primo tentativo
  la elevava al cubo per caricare il fondo della veduta; sembra una buona idea
  finché non si guarda dove cadono le fette, che dividono in parti uguali la
  foschia — col cubo l'ultimo passo valeva quasi tre volte gli altri, e il
  banco l'ha misurato in quarantotto livelli su 255.

La cosa più utile che è venuta fuori, però, è **da dove venivano le righe
verticali** — quelle per cui la montagna sembrava una tenda a righe. Non erano
chiaroscuro: erano **copertura**. Spegnendo del tutto il chiaroscuro (tutti i
livelli dello stesso colore) le righe restavano. Le cause, in ordine di peso:

1. `RIL_STRISCIA_SBORDO` era un pixel e mezzo, per non lasciare la cucitura fra
   due corse consecutive. Ma le corse dello stesso livello stanno in un
   tracciato solo e non si sommano; fra livelli diversi sono due `stroke()` e
   lì la sovrapposizione si somma davvero — quindici livelli su 255, contro
   l'uno e mezzo della cucitura che si voleva evitare. E capita una volta per
   **cambio di livello**, quindi una colonna che cambia venti volte diventa
   sistematicamente più chiara di quella accanto che ne cambia due. Adesso è
   zero.
2. Il buco all'occlusione: quando un nodo spariva dietro a quello davanti si
   spegneva `ok`, e il nodo che riemergeva non disegnava nessuna striscia —
   restava una fascia di schermo senza chiaroscuro per ogni rottura. Adesso
   `ok` resta acceso (flag `rotto`) e la striscia si tira dal crinale al nodo
   che riemerge: è la faccia che si rialza, ed è tutta lì dentro.
3. La granatura, che al primo tentativo era ancorata al **nodo della maglia** e
   quindi peggiorava le cose: le colonne disegnate non sono i nodi. Adesso è
   ancorata al terreno (`RIL_GRANA_M`, metri veri).
4. Il primo piano: `RIL_VICINO_*` da 70/250 a 110/420 e `RIL_PIEGA_M` da 60 a
   170 metri — una derivata seconda su due celle scarse è rumore, e con sei
   livelli di forza quel rumore vale quattro livelli **per colonna**. E la
   pendenza in azimut adesso è centrata invece che in avanti.

### L'acqua

* **Il tremolio sotto lo zoom** aveva due cause e nessuna si vede in un
  fotogramma fermo. La colonna si disegnava all'azimut *continuo*
  (`centro − mezzo + i·passo`), che scorre a ogni pizzicata mentre i dati
  restano quelli del campione più vicino: a metà passo l'indice scatta e le
  rive saltano. Adesso si disegna all'azimut **del campione**. E la griglia
  dell'onda era misurata in pixel con le colonne scelte per indice: sette pixel
  di pizzicata e *tutte* scivolavano di un campione. Adesso è a potenze di due
  con isteresi, che è la stessa cura di `rilPassoColonne`.
* **I fiumi** si ripiegavano su una linea da un pixel — senza colore
  dell'acqua, senza rive, senza foschia. La forma vera a quella scala non c'è,
  il posto sì: `skyAcquaAllargaSottili` allarga la striscia a `SKY_ACQUA_MIN_PX`
  attorno alla sua **mezzeria**, e da lì in poi è acqua come tutte le altre. La
  larghezza prestata si paga in opacità.

### Il banco

964 prove verdi (erano 927), tutte le nuove falliscono sul codice di prima.
`scripts/prova-verifica.js` è nuovo: fa girare `verifica.html` in un browser
vero e riporta le rosse, senza doverlo aprire a mano.

Da sapere, perché è costato tempo: le due prove `Esc chiude una finestra
comune` e `Esc chiude anche la scheda oculare` di `scripts/prova-nel-browser.js`
sono **rosse anche su `main`** — non c'entrano con questo lavoro.
