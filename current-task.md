# Task Corrente

Niente in corso.

## Ultimo lavoro chiuso — la vista 3D del Sistema Solare: il disegno che non si vedeva, e l'interfaccia ridotta all'osso

Branch `claude/solar-system-3d-planetarium-gqp2au`.

### 1. «Aperta dal planetario a tutto schermo non si vede il grafico, solo la scheda»

Non era il disegno: era l'ordine di impilamento, e i due pezzi erano stati
scritti in due momenti diversi senza sapere l'uno dell'altro. Col cielo a tutto
schermo la **finestra** viene traslocata dentro `#skymap-contenitore` (§7.5-bis)
e ci sta a `z-index: 1400`; il **guscio** ci si appende anche lui
(`solRipiegoSchermo`, §7.7-bis) ma col suo z-index di sempre, **80**. Diventati
fratelli nello stesso contesto, vinceva il velo della finestra: restavano il
pannello coi comandi e il buio, e la tela stava sotto — cioè si vedeva tutto
tranne la cosa per cui la finestra si era aperta.

Una riga di CSS: `#skymap-contenitore > .sol-guscio.sol-schermo-pieno { z-index: 1500 }`.

Provato nel browser vero (Playwright + Chromium, con Astronomy Engine servito da
un file perché da qui i CDN sono chiusi): `elementFromPoint` al centro della tela
adesso risponde `sol-canvas`, e la tela è disegnata.

### 2. L'interfaccia, ridotta a tre segni

Da quando la finestra si apre a tutto schermo, la fila di comandi sotto alla
tela è un posto che non si vede mai. È andata via tutta, e con lei la tabella
degli otto pianeti. Restano:

- a sinistra `.sol-viste`, **tre tondi con la sola icona** (`[data-sol-quadro]`):
  Da qui, Tutto, Terra e Luna. Non sono impostazioni, sono tre risposte a «cosa
  sto guardando», e per questo sono l'unica cosa sempre in vista;
- a destra i comandi del guardare (⛶, ⟲, ⚙, −, +), e dietro al ⚙ il pannellino
  `#sol-opzioni` con le due manopole di secondo piano: **Distanze**
  (compresse/reali) e **Dimensioni** (ingrandite/reali).

Usciti: i tre punti di vista (la scena si gira col dito, ed è *il* gesto di
questa vista), «Pianeti interni», le altezze ×10, i nodi, le due fasce di sassi
(restano accese, che è come le si vuole quasi sempre), i chip del passo (stanno
nel pannello del tempo, che è quello del planetario in prestito) e l'elenco dei
pianeti. Con loro sono spariti `SOL_VISTE`, `solImpostaVista`, `solElencoHtml`,
`solRigaTabella`.

Da sapere per chi ci rimette mano: `solAggiornaTasti` **non cerca più dentro a
`#modale-sistema`**. Col planetario a tutto schermo il guscio esce dalla
finestra, quindi i tasti appoggiati sulla scena — che sono ormai tutti quelli
che contano — non sono più dentro al modale, e con la selezione di prima
sarebbero rimasti spenti per sempre. Stessa cura per `.sol-suggerimento`.

### 3. Il banco Terra e Luna: niente scheda, e i due corpi che si vedono

La scheda che compariva entrando nel banco è via: lì il disegno **è** il
discorso, e un pannello appoggiato sopra copriva proprio la Luna accanto al
bersaglio. Quello che diceva sta adesso in fondo alla scena, in due righe
(`solRaccontoVicino` + `SOL_VIC_VERDETTI`): il verdetto («Eclissi totale di
Luna», oppure «Stavolta niente · il bersaglio è mancato di N km») e la misura di
sempre. Per uscire dal banco ci sono i tre tondi.

E i due corpi si vedono: `SOL_VIC_INGRANDIMENTO = 3`. A scala vera, con l'orbita
intera nel quadro, la Terra è un dischetto di otto pixel di raggio e la Luna un
puntino di due — la scena è esatta e non si legge. L'ingrandimento è
**trasversale e basta**: `k` moltiplica il raggio che `solRaggioUmbra` e
`solRaggioPenombra` *restituiscono*, non quello che ricevono, quindi le distanze
lungo l'asse — e con esse gli apici, cioè il punto in cui ogni cono si chiude —
restano vere. Ingrandendo anche la lunghezza, l'ombra della Terra diventerebbe
un tubo che non si chiude più e quella della Luna arriverebbe quaggiù ogni mese:
sparirebbe la ragione per cui le eclissi totali di Sole sono rare.

Cosa resta storto, ed è scritto anche nel commento: con l'ombra tre volte più
larga qualche Luna piena la sfiora sul disegno pur restandone fuori davvero
(ombra piena da 4.600 a 13.800 km di raggio, contro i 34.000 km di scarto
massimo). Per questo il **verdetto** resta calcolato sui raggi veri
(`solStatoEclissi`), e chi vuole il disegno esatto ha «Dimensioni reali» dietro
al ⚙.

### Quello che non si è potuto fare

Su un telefono in verticale il banco resta una striscia sottile in mezzo a molto
nero: l'orbita intera sta in trecento pixel, e lì nemmeno il ×3 fa una Luna
grande — per farla grande davvero servirebbe un ingrandimento che coprirebbe
buona parte dello scarto della Luna, cioè direbbe che le eclissi capitano molto
più spesso di così. Chi ha bisogno di vedere meglio gira il telefono (la scena
si prende lo schermo da sé, §0-bis) o si avvicina col pizzico.
