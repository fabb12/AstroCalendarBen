# Task Corrente

«Sistema grafico Sistema Solare 3D» — **fatto**, niente in sospeso.

Branch `claude/solar-system-3d-graphic-hfrw24`.

## Cos'era chiesto

Quattro cose, tutte sulla vista 3D (§7.7 di `app.js`):

1. scheda più minimale, senza note, solo l'essenziale;
2. all'apertura, subito a tutto schermo con la barra del tempo;
3. all'apertura, zoom subito sulla Terra;
4. un tasto minimale nell'interfaccia del planetario per aprirla.

## Cos'è cambiato

**La scheda si è divisa in due, e ha cambiato posto.** Prima era un blocco
solo in fondo alla finestra — la lettura del corpo scelto *più* la tabella di
tutti e otto — e sotto ancora una nota di dodici righe. Da quando la finestra
si apre a tutto schermo, tutto quello che sta fuori dal guscio non lo vede
più nessuno. Adesso:

- `#sol-scheda` è un pannello appoggiato **sulla scena**, dentro al guscio, in
  basso a sinistra sopra alla barra del tempo. Compare toccando un corpo, se
  ne va col suo ✕ (`solChiudiScheda`, che non tocca la telecamera), e a riposo
  non c'è affatto;
- `#sol-elenco` è la fila dei pianeti, che resta giù nella finestra;
- la nota lunga non c'è più.

Dentro la scheda sono rimasti quattro numeri (dal Sole, da noi, angolo dal
Sole, quando si vede) e i due tasti. Sono usciti il tempo di volo della luce,
i milioni di chilometri e le due frasi lunghe. Stessa cura al banco Terra e
Luna: via le note in corsivo sotto ai numeri, etichette corte perché in
duecentosettanta pixel una lunga manda a capo il suo numero e raddoppia
l'altezza del pannello.

Il `bottom` della scheda **si misura** (`solAssestaScheda`, variabile
`--sol-fondo-scheda`) sulla barra del tempo vera: quella è alta diversamente
dentro alla finestra e a tutto schermo, e sotto ai 520px la slitta va a capo.
Col numero scritto a mano che avevo messo prima, sul telefono la barra si
mangiava l'ultimo tasto della scheda — quello per tornare alla vista
d'insieme, cioè il modo di uscire da dove si era finiti.

**L'apertura.** `apriSistemaSolare` chiama `solEntraSchermoIntero()` dentro
allo stesso gesto che ha aperto la finestra (fuori da un gesto il browser
rifiuta, e allora entra da sé il ripiego in CSS). Poi `solEntraSullaTerra()`:
il quadro d'insieme per un fotogramma e da lì lo zoom morbido fino a
`SOL_ENTRATA_TERRA_PX` (62 px di raggio della Terra — molto sopra ai 13 di
`SOL_TERRA_MIN_PX`, quindi si entra già vedendo le coste e le luci delle
città). Il bersaglio è in pixel e non in frazioni di schermo apposta: qui la
misura dei corpi dipende solo dallo zoom, non dalla tela, e all'apertura la
tela cambia misura due volte.

Chi arriva **con un protagonista** — un evento, o il pianeta che era scelto
nel planetario — resta nel quadro d'insieme: si è venuti a vedere dove sta
quello, e tuffarsi sulla Terra lo lascerebbe fuori dallo schermo. Il ⟲ non
torna al tuffo ma alla vista d'insieme: a tutto schermo i chip «Tutto» e
«Pianeti interni» non ci sono, e da addosso alla Terra il modo di rivedere il
sistema dev'essere a portata di un tasto.

**Il tasto nel planetario.** `#skymap-btn-sistema-mappa`, sulla mappa, in
colonna con lo schermo intero e l'inseguimento. Quello che c'era stava in
cima al pannello Astri — e a cielo pieno schermo i pannelli non si aprono, ed
è proprio lì che si vuole. Resta anche quello, non è un doppione: uno è il
comando, l'altro sta accanto ai pianeti, che è dove nasce la domanda. Il
segno è l'orbita di Lucide; la prima versione era un'ellisse con un puntino
dentro e alla misura di quei tasti si leggeva come un occhio, indistinguibile
dal bersaglio dell'inseguimento che ha sopra.

## Un difetto trovato per strada

`solEsciSchermoIntero` chiamava `document.exitFullscreen()` ogni volta che
c'era *qualcosa* a schermo intero, senza guardare cosa. Aprendo il Sistema
Solare col planetario già a tutto schermo si entra col ripiego in CSS (il
trasloco della finestra dentro al guscio del cielo, §7.5-bis, farebbe uscire
dal pieno schermo un elemento che ci è appena entrato), quindi a schermo
intero c'è ancora il **cielo**: chiudendo la finestra si buttava fuori lui, e
ci si ritrovava il planetario rimpicciolito dentro alla pagina senza aver
toccato niente di suo. Adesso il confronto è `attivo === guscio`.

## Come l'ho provato

Chromium via Playwright, l'app servita in locale con Astronomy Engine preso
da npm (in questa rete il CDN non risponde). Telefono 420×860 e computer
1280×820:

- il tasto sulla mappa c'è, è visibile, apre la finestra;
- all'apertura: `perno: 'Earth'`, zoom 67, raggio della Terra disegnato 62 px
  esatti, pieno schermo attivo, barra del tempo visibile, scheda assente,
  elenco con otto righe, nessuna nota;
- toccando Marte la scheda compare 11 px sopra alla barra, col ✕ che la manda
  via;
- banco Terra e Luna: scheda con quattro numeri e i due tasti, tutta dentro
  allo schermo;
- da un evento con pianeta (Venere): quadro d'insieme, nessun tuffo;
- da un'eclissi: banco Terra e Luna;
- col cielo già a schermo intero: ripiego in CSS, guscio appeso a
  `#skymap-contenitore`, 1280×820 — e chiudendo il cielo resta pieno schermo;
- chiusura: guscio tornato al suo posto, nessun errore in console.

Attenzione, per chi rifà queste prove: in quella rete il CDN di Tailwind è
bloccato, quindi le utility `fixed inset-0 z-50` dei modali non esistono e la
finestra si impagina in fondo alla pagina invece che sopra. Non è un difetto
dell'app — per le prove visive va iniettato un foglio di stile che rimetta
quelle tre regole.
