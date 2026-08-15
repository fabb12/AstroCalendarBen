# Task Corrente

Calendario e Sistema Solare 3D, sei cose in un giro solo.

- **Calendario**: selettore di **intervallo di date** (vista Mese e vista Agenda), che
  calcola gli eventi di tutti i mesi che tocca — **senza tetto ai mesi**: si
  calcolano a scaglioni (`calcolaMesiAScaglioni`) cedendo il turno al browser,
  con la riga di stato che dice a che punto è e gli eventi che compaiono mano
  a mano; dieci anni sono nove secondi con la pagina viva. Filtra l'agenda e
  tinge i giorni nella griglia. `sincronizzaCalendario` ricarica dentro a un
  `batchRendering`: senza, i millequattrocento eventi di dieci anni volevano
  dodici secondi solo per entrare nella griglia. Gli eventi
  nella griglia adesso portano l'icona della categoria e il titolo su una riga
  colorata (`contenutoEventoGriglia`), invece del pallino grigio di prima.
- **Orbita della Luna** nella scena grande della 3D, alla stessa distanza
  esagerata con cui è disegnata la Luna (`solDisegnaOrbitaLuna`).
- **Terra più realistica**: le coste vere di `SKY_MONDO` anche nella faccia
  dipinta, acqua bassa attorno alle coste, banchisa artica sfumata, nuvole in
  fasce, riflesso del Sole sull'acqua, filo caldo del tramonto e velo d'aria
  acceso solo dal lato del giorno.
- **Cono d'ombra in primo piano** nel banco Terra e Luna: riempimento sotto ai
  corpi, contorno sopra.
- **Perno della telecamera su qualunque corpo** (`sol.perno`): toccando un
  pianeta o la Luna, quello va al centro e ci si gira attorno. Valeva solo per
  la Terra.
- **Tempo unificato** fra planetario e 3D: un solo passo (`SKY_PASSI_TEMPO`,
  chip in tutt'e due i posti) e una sola velocità di riproduzione (il playback
  del planetario, coi tasti − / + anche sulla barra della 3D).

Provato in Chromium headless: nessun errore di pagina, calendario/agenda/3D/
banco Terra e Luna verificati a schermo.

[x] Completato.
