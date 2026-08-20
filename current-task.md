# Task Corrente

Planetario, schermata minimalista — **fatto**, niente in sospeso.

Cosa è cambiato (branch `claude/planetario-schermata-minimalista-lvbiv0`):

- **Le linguette dei gruppi sono solo icone**: sei tondi da 36px (34 sul
  telefono) con orologio, calendario, occhio, cursori, bussola e stella. Il
  nome resta nel `title` e in `.nome-gruppo`, nascosta alla vista ma non a chi
  legge con lo schermo. Entrano tutte anche su un telefono da 320px senza
  scorrere.
- **La posizione dice solo il nome**: «Milano», e basta. Via l'etichetta
  «Posizione attuale», la provenienza del dato, la precisione e il «solo qui»
  del luogo di sola visita — quest'ultimo adesso è il colore azzurro del nome
  (`.lettura-stato.altrove`). Tutto il dettaglio resta nel `title`
  (`skyStatoEsteso`). `#skymap-stato` è uscito dall'elenco delle letture
  monospaziate in cima a `style.css`: il monospazio faceva sembrare il nome di
  una città una matricola.
- **La bussola: cono azzurro al posto della scritta «FOV»**. Il cono è il
  campo inquadrato in quel momento, aperto dal centro verso l'alto (la
  direzione della vista). Minimo 4° (a 0,25° sarebbe meno di un pixel),
  massimo 168° (se no a 180° è un disco), gradiente chiaro al centro perché
  lì sotto ci sono i gradi dell'azimut. Il campo in cifre resta solo
  nell'`aria-label` della bussola.
- `--zona-alta-cielo` rifatto (128px / 108px sul telefono) e `CACHE_NAME` a
  `astrocal-v115`.

Non toccati di proposito: la barra del tempo in fondo e i comandi appoggiati
sull'angolo destro della mappa (schermo intero, inseguimento, registrazione,
zoom). Non sono decorazione: toglierli vuol dire togliere delle funzioni, non
alleggerire la grafica. Se si vuole ridurre anche quelli, la strada è
`.comandi-mappa-cielo` in `style.css` e `#cielo-tempo` in `index.html`.
