# Task Corrente

Il colore dell'acqua (mare, laghi, fiumi) e gli spicchi sull'orizzonte —
**fatto**, niente in sospeso.

Branch `claude/water-color-realistic-e337qw`.

## Cos'era

Le due cose segnalate — «verso l'orizzonte il mare ha sfumature verdi» e
«a volte ci sono degli spicchi come artefatti grafici» — erano **lo stesso
difetto**, e non stava nel colore dell'acqua.

`skyDisegnaSpiagge` (aggiunta il 17 agosto) stendeva il velo di sabbia con
forza uguale alla **frazione di mare** — che in mare aperto vale uno — e lo
disegnava **dopo** `skyDisegnaMare`, contro le istruzioni scritte nel suo
stesso commento due righe più sopra. Risultato: il 93% di sabbia
(`rgb(192,190,172)`) steso sopra all'acqua invece che accanto, cioè il mare
color kaki dall'orizzonte fino a venticinque gradi sotto; e siccome ogni
trapezio ha una sua opacità sola, quel kaki si leggeva **a spicchi** con gli
spigoli netti.

Il colore dell'acqua non c'entrava: passando in rassegna l'altezza del Sole
da −18° a +45° e la depressione da 0° a 90°, il blu batte il verde sempre
(margine minimo nove livelli su 255). La correzione «sposta il verde verso
il blu» che era stata messa dentro a `skyMareColore` per rincorrere il
sintomo **non è mai entrata in funzione nemmeno una volta**: era ferma lì a
rischiare di spegnere il rosso di un tramonto vero.

## Cos'è cambiato

- **`skyDisegnaSpiagge`**: si disegna **prima** dell'acqua (così il mare le
  passa sopra per quanta acqua c'è) e la forza è una **campana sulla costa**,
  `skyForzaSpiaggia(m) = 4·m·(1−m)`: zero al largo, zero nell'entroterra,
  massima dove le due si toccano. Il residuo visibile è `α·4m(1−m)·(1−m)`,
  che ha il picco a `m ≈ 0,34` — una striscia chiara appoggiata sulla riva.
  Il velo scende `SKY_SPIAGGIA_PROFONDITA` (8°) invece dei 25 della velatura
  di montagna: una battigia è una riga. Passo dei trapezi dimezzato (0,5°/1°)
  perché la sabbia è chiara su fondo scuro e lì due opacità contigue si
  leggono come due spicchi. Niente più taglio secco a `mare ≤ 0,05`: quello
  toglieva il *trapezio*, non il colore, e lasciava un gradino verticale
  sulla riva. Il risparmio che quel taglio dava resta, ma separato: si legge
  sempre la forza (una lettura di array) e si proietta solo dove il velo si
  disegna davvero.
- **`skyMareFresnel`**: il tetto non è più `Math.min(0,6, …)`. Schlick supera
  il sessanta per cento già 5,5° sotto l'orizzonte, quindi il taglio netto
  rendeva **piatta** tutta quella fascia — che dalla battigia contiene i nove
  decimi del mare visibile — con uno spigolo dove il taglio smetteva di
  mordere. Adesso è una compressione morbida, `f / (1 + f·(1/RMAX − 1))`:
  identità ai piedi, esattamente `SKY_MARE_RIFLESSO_MAX` a filo d'orizzonte,
  e in mezzo una rampa vera (60% → 42% nei primi sei gradi).
- **Le due velature del suolo** (montagna e battigia) sono adesso tutt'e due
  **prima** del mare: sono terra, e l'acqua ci va sopra.
- Tolta `skyMareAzzurraOrizzonte`; commenti di `SKY_MARE_ACQUA` rifatti (la
  diagnosi che c'era scritta era sbagliata).
- `CACHE_NAME` → `astrocal-v116`.

## verifica.html — un guasto trovato per strada

**Il §19 non girava più, e con lui il §19-bis e il §20.** La pagina non
carica `app.js`, ma il commit del 17 agosto ci aveva messo dentro
`SKY_MARE_ACQUA.giorno[2] > …` senza guardia: ReferenceError, e in uno
`<script>` unico un errore porta via tutto quello che viene dopo. Non si
vedeva, perché una prova sparita non fallisce — semplicemente non compare.
Ora le costanti che servono sono dichiarate lì in chiaro, accanto alle prove
che le usano.

Prove nuove nel §19: il colore a tappeto (aria → cielo → Fresnel → acqua, su
ogni ora e ogni depressione, mare e acqua dolce), la rampa di Fresnel senza
tratti fermi nei primi sei gradi, e la battigia (zero al largo, zero
nell'entroterra, residuo zero sull'acqua piena, picco sulla riva) col
contro-esempio del conto di prima.

**Stato: 491 prove, 0 fallite**, verificate in Chromium headless su tutti e
ventuno i paragrafi.
