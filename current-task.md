# Task Corrente

Niente in corso.

## Ultimo lavoro chiuso — «il planetario si blocca, il terreno scompare e non funziona più nulla»

Branch `claude/planetario-unlock-terrain-bug-6y9ny2`.

Non era un blocco dell'app: era **un fotogramma che non finiva**. La riga che
rimette il ciclo in coda è l'ultima di `skyCiclo()`, quindi un'eccezione
sollevata mentre si disegna non salta un fotogramma — li salta tutti, per
sempre. Sullo schermo resta il disegno interrotto a metà (il cielo sì, il
terreno no, perché il conto si ferma lì in mezzo) e non risponde più niente:
né il dito, né la barra del tempo, né i tasti, che ridisegnano tutti dal
ciclo. Sembra esattamente quello che è stato segnalato, e guardando lo schermo
non c'è modo di capirlo.

### Il banco di prova

Da qui la rete verso Open-Meteo e Overpass è chiusa, e **senza terreno vero il
difetto non esiste**. Rifatto il mondo finto della sessione scorsa (Playwright
+ Chromium, `index.html` da un server locale, Astronomy Engine da un file,
quote e Overpass serviti da una sola funzione di quota): valle a 500 m,
montagne a nord fino a 2.300, un lago e un fiume a ovest, **il mare a sud** — è
servito ad avere anche l'acqua salata nel giro. Poi un setaccio: si spegne il
ciclo e si chiama `skyDisegna` a mano su **31.552 viste** (17 campi × 29
altezze × 8 azimut × 8 ore), raccogliendo le eccezioni per messaggio. Prima
delle correzioni ne uscivano due famiglie; dopo, zero.

### Le due eccezioni

1. **A forte zoom sull'orizzonte** (`skyFermateSuolo`, nuova della scorsa
   sessione). Le fermate del gradiente del suolo si misurano proiettandole, e
   a 0,25° di campo la rampa disegnata è un quarto di schermo: da 0,2° di
   depressione in giù ci finiscono oltre tutte. La riga che le teneva crescenti
   — `Math.max(ultimo + 1e-4, tosato)` — stava **sopra** alla tosatura: la
   prima fuori rampa usciva a 1, la seconda a 1,0001, e `addColorStop` fuori
   dallo zero-uno non sistema niente, solleva un'eccezione. Adesso si tosa per
   ultimo e fermate uguali si accettano: sono depressioni che cadono fuori dal
   riquadro, e un gradino lì non lo vede nessuno.
2. **Guardando dritto in su** (`skyCerchioOrizzonte`, difetto vecchio quanto la
   proiezione stereografica e visibile solo col terreno acceso). Il nadir è
   l'antipodo del centro della vista, e l'antipodo va all'infinito: allo zenit
   `c` vale uno tondo e la formula divide per zero. Basta trascinare il cielo
   fino in cima, dove l'altezza si ferma a novanta esatti, e
   `createRadialGradient` con un raggio infinito solleva un'eccezione. Adesso
   il nadir si tosa a `SKY_NADIR_SCHERMI` (otto) schermate: provato pixel per
   pixel, fino a settanta gradi di elevazione la tosatura non morde affatto, e
   sopra cambia solo in meglio — col nadir vero le fermate misurate finivano
   tutte sotto lo 0,02 e il gradiente ripiegava sulle frazioni.

### E la rete, che è la parte che conta

Il corpo di `skyCiclo` sta dentro a un `try` e la rAF si rimette in coda
comunque; `skyGuastoFotogramma` lo scrive nella console **una volta sola** per
messaggio (un errore di disegno si ripete sessanta volte al secondo) e il
conto si azzera al primo fotogramma che riesce. Stessa rete in `solCiclo`, che
mentre la vista 3D è aperta è quello che fa camminare l'orologio del
planetario. Provato: con trenta fotogrammi di fila che sollevano
un'eccezione, il ciclo continua e riprende da solo appena il guasto finisce.
Il `try` non sostituisce le correzioni — rende un difetto un fotogramma
sbagliato invece che una vista morta.

### Come è stato provato

- Il setaccio delle 31.552 viste: zero eccezioni (prima, due famiglie, la
  seconda in 1.088 viste).
- `verifica.html`: **582 prove passate**, comprese le 10 nuove in coda al §22
  (le fermate del suolo col caso vero misurato, i casi degeneri, il nadir allo
  zenit e la tosatura che non morde dove si guarda il paesaggio).
- Nel browser vero: le sei viste che rompevano il fotogramma disegnano tutte,
  e il panorama normale è pixel per pixel quello di prima.

`sw.js` a `astrocal-v124`.

### Quello che resta, e che non era nel compito

`simCiclo` (la simulazione) e il ciclo dei banchi della Didattica hanno la
stessa forma — la rAF rimessa in coda per ultima — e quindi la stessa
fragilità. Non sono stati toccati: lì non risulta nessun guasto, e il compito
era il planetario. Se un giorno una di quelle viste «si blocca», il primo
posto da guardare è questo.
