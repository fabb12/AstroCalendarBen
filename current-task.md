# Task Corrente

Niente in corso.

## Ultimo intervento completato

Corretto il planetario visto **dall'alto**: la riga dell'orizzonte che taglia
il panorama e la fascia di colore che scorreva sul paesaggio muovendo il
pitch.

Erano due facce dello stesso patto sbagliato. Il rilievo dipingeva un fondo
opaco **solo sopra la riga dell'orizzonte** e lasciava tutto il resto al
gradiente del suolo di `skyGradienteTerreno`, che è scritto in gradi di
depressione — «un grado sotto la riga è a novanta metri», vero con l'occhio a
un metro e sessanta da terra e falso di tre ordini di grandezza da una cima.
Da lassù il panorama intero, creste a sessanta chilometri comprese, veniva
dipinto col colore del prato sotto le scarpe; e siccome le fermate di quel
gradiente sono orizzontali sullo schermo mentre l'orizzonte stereografico è
un arco, il passaggio fra il colore lontano e quello vicino cadeva su una
riga dritta che non seguiva niente di quello che si vedeva.

- `rilievo.js`: il rilievo si dipinge il **suo** fondo, sopra e sotto la riga,
  a `RIL_FONDI` (14) fette di distanza ricavate dalle creste parziali
  (`rilFondoAnelli`, `rilievo.fronte`). Le fette sono massimi accumulati,
  quindi le strisce si toccano senza sovrapporsi e lo schermo si paga una
  volta sola. Da `rilColoreDiFetta` è uscito l'annerimento delle fette vicine:
  faceva le veci del velo di occlusione, e sommandocisi il terreno ai piedi
  usciva un terzo più scuro. `rilTracciaSagoma` è la sagoma, ora condivisa.
- `app.js`: `skyVeloOcclusione` / `skyDisegnaOcclusioneSuolo` stendono
  sull'occlusione d'ambiente la stessa legge di `SKY_SUOLO_NADIR_BUIO`, cifra
  per cifra, ritagliata alla sagoma del rilievo; `skyDisegnaLineaOrizzonte`
  spezza la riga dello zero dove la cresta **disegnata** le passa davanti
  (`SKY_ORIZZONTE_COPERTO`, un terzo dell'opacità), e solo col terreno vero;
  la grana del suolo si ritaglia alla sagoma del rilievo invece che alla
  parte sotto la riga.

Misurato in Chromium headless con le quote vere: al livello del mare il
terreno resta entro il dieci per cento di prima e la discesa verso i piedi c'è
tutta; da 2 600 m il panorama ha di nuovo i piani. Il rilievo costa da mezzo
millisecondo a un millisecondo in più per fotogramma (mediana su quaranta
fotogrammi, headless senza GPU): sono le quattordici strisce di fondo al posto
delle dieci fette di prima.

Trovato per strada, e corretto: in `verifica.html` **dal §9 in giù non girava
più niente**. Il §8 chiama `skyArcoAcquaInVista`, che sta in `app.js` — e
questa pagina `app.js` non lo carica: `ReferenceError`, e in uno `<script>`
unico l'errore si porta via tutte le sezioni successive. Le tre funzioni degli
archi sono adesso copiate nel blocco degli stub in cima. La pagina intera
passa: 715 prove, nessuna fallita.

Prove nuove nel §25 di `verifica.html`; cache PWA portata a `astrocal-v149`.
