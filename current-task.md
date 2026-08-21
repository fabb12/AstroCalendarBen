# Task Corrente

Niente in corso.

## Ultimo lavoro chiuso — «ingrandendo sulla Luna eclissata sparisce tutto»

Branch `claude/lunar-eclipse-zoom-shading-2snjwb`.

La segnalazione: «nel planetario, nell'eclissi di Luna, se ingrandisco troppo
sulla Luna le sfumature e la conseguenza dell'eclissi scompaiono».

### Dove **non** era (e vale la pena saperlo)

**Nell'ombra no.** È la prima cosa che si va a guardare, ed è tempo perso:
`gamma`, `umbra`, `penombra` e `rL` sono angoli geocentrici, il disegno li
divide per `rL` e li moltiplica per il raggio in pixel, quindi il colore di un
punto della Luna è lo **stesso a qualunque campo**. Misurato nel browser vero
(Playwright, `index.html`, un'eclissi totale, undici campi da 40° a 0,25°): lo
stesso punto del disco dà gli stessi valori RGB a ±1 livello, e il fattore per
cui l'ombra moltiplica la faccia è identico a tutti gli ingrandimenti. Adesso
c'è anche una prova scritta, in coda al §21 di `verifica.html`, fatta col conto
vero dei pixel e non con una tautologia.

### Dov'era

**Nella faccia.** Al campo minimo (0,25°) la Luna è disegnata *più larga dello
schermo*: su un telefono da 420 punti a due pixel per punto sono 2.600 pixel
veri. `skyLatoTela` aveva il tetto a **256** sul telefono, quindi quei 2.600
pixel venivano da una tela dieci volte più piccola. Sotto l'ombra della Terra,
che moltiplica la faccia per un terzo (e per un decimo nel verde e nel blu), di
quel poco contrasto rimasto non restava niente: **un campo marrone uniforme**,
senza mari, senza crateri, senza gradiente. Ed è esattamente quello che si
vede negli screenshot di prima.

### Cosa è cambiato (`app.js` §7.3.2)

1. **`skyLatoTela`** — tetto unico `SKY_TELA_LATO_MAX = 1024`, non più
   `quanto(256, 512, 1024)`. I due numeri che lo scelgono sono misurati, non
   scelti a naso: 1024 costa un decimo di secondo a dipingere e quattro
   megabyte a tenere, 2048 costa quattro decimi — e quella pausa capita
   *mentre si sta ingrandendo*, che è l'unico istante in cui si vede.
   L'ingrandimento della tela passa da ×10,2 a ×2,5.
2. **`skyTelePixelMax` + il potatore di `skyPelle`** — la cache aveva solo un
   tetto sul *numero* (fino a 180 tele). Con tele da quattro megabyte sarebbero
   settecento megabyte, quindi adesso c'è anche un bilancio in pixel
   (`quanto(6, 16, 24)` milioni) e si butta la più vecchia finché tornano
   tutt'e due i conti — mai quella appena dipinta.
3. **`skyLunaDettaglioFine`** (nuova) — il pennello riceve il lato della tela
   (`pennello(c, lato)`) e aggiunge una generazione di crateri e di grana a
   ogni raddoppio sopra ai 256. Tre cose non sono arbitrarie: la **legge di
   potenza** (dimezzando la taglia se ne trovano tre volte tanti — con un
   numero fisso, guardando un quinto del disco, sotto gli occhi ne restava una
   quindicina), il **contrasto più alto** dei crateri di sempre (0,5 contro
   0,16: un rilievo appena accennato moltiplicato per un terzo non esiste più)
   e il **primo giro alla taglia di sempre e non alla metà** — sono loro la
   misura che riempie lo schermo quando la Luna è più larga dello schermo.
   Fino a 256 di tela non fa niente, quindi **la Luna a campo largo è quella
   di prima pixel per pixel**.

### Come è stato provato

- `verifica.html`: **541 prove passate**, incluse le dodici nuove del §21-bis
  e quella in coda al §21.
- Nel browser vero, telefono (420×820, dpr 2) e computer (1200×900): il primo
  disegno a ogni nuova taglia costa al massimo ~108 ms (una volta sola per
  taglia), i fotogrammi dopo 1,3 ms, e la cache non supera i 5,3 MB.
- Screenshot a 20°, 5°, 1,5°, 0,5° e 0,25° in totalità, in parziale e su una
  Luna piena senza eclissi: a 0,25° si vede una superficie craterizzata sotto
  il rame, non più una campitura.
- Vista 3D aperta e chiusa (usa le stesse tele): nessun errore.

`sw.js` a `astrocal-v122`.
