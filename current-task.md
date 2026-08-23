# Task Corrente

Niente in corso.

## Ultimo intervento completato

Rifatto il pannello **Tempo e luogo** del planetario (linguetta dell'orologio).
Era una fila di sei righe di comandi tutte uguali, alta più di quanto il cielo
possa permettersi: ora sono **due blocchi col loro titolo** — «Quando» e «Da
dove» — separati da un filo, e le righe che hanno bisogno di una parola per
dire cosa comandano ce l'hanno davanti («Passo», «Marcia»).

Cosa è cambiato, in concreto:

- **Un doppione in meno.** Il nome del posto era scritto due volte nella stessa
  schermata: in alto a sinistra sopra al cielo (`skyAggiornaStato`) e nel
  pannello (`#skymap-luogo-nome`). Il secondo è uscito, e con lui una riga:
  che il cielo sia spostato altrove lo dicono l'azzurro della lettura in alto
  e la comparsa del tasto «Torna a casa», che adesso sta nella testata del
  blocco invece che su una riga sua.
- **La lettura lunga non ripete l'istante.** `skyAggiornaTestoTempo` scriveva
  «dom 23 ago 2026, 12:09:41 · in tempo reale» accanto ai tasti del playback,
  cioè lo stesso istante che le sei caselle dicono cifra per cifra due righe
  sopra — e a metà finiva coi puntini. Ora scrive solo lo scarto e la marcia
  («fra 3 g 4 h · ▶ 1 h/s»); l'istante per esteso è nel `title`.
- **Niente più righe che sfondano.** `min-width: 0` sui blocchi e sulle testate:
  la riga della data e quella del playback non mandano a capo, e senza quello
  allargavano la griglia oltre il pannello e il pannello oltre lo schermo.
- **Su telefono** l'etichetta della riga va sopra invece che accanto (sette
  segmenti più «Passo» in 360 pixel non ci stanno), «Vai» resta in fila con le
  caselle della data invece di andare a capo da solo, e sotto i 380 pixel c'è
  l'ultima stretta (rientri e corpo) perché i sette gradini del passo entrino
  senza toccarsi.

Misurato nel browser (Chromium, `pointer: fine`): il pannello passa da 356 a
332 pixel di altezza su un telefono da 360, e da 306 a 296 su schermo largo,
senza perdere un comando.

File toccati: `index.html` (§ pannello `gruppo-tempo`), `style.css`
(`.blocco-tempo`, `.testa-blocco-tempo`, `.riga-etichettata`, media query dei
620 e dei 380 pixel), `app.js` (`skyAggiornaTestoTempo`,
`skyAggiornaLuogoVistaUI`), `sw.js` (`astrocal-v142`).
