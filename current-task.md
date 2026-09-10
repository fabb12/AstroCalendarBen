# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 352 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js` — le eclissi (la mappa
dell'ombra, le eclissi di casa, quelle lunari), le simulazioni e gli avvisi del
planetario. Il tetto resta a 362.

Resta rossa, ed era rossa anche prima, una prova di `scripts/prova-i18n.js`:
undici chiavi orfane (`visione.*`, `ui.fotocamera`, `ui.vai-al-mese` e altre
due), tutte fuori da Missione Cielo.

## Ultimo intervento completato

**Missione Cielo: si sceglie cosa cercare, i bersagli si sorteggiano, la
soluzione è un tasto e la voce ha un tono per ogni momento della caccia.**

Sei cose, e la prima è quella che teneva in piedi tutte le altre.

**Cosa si va a cercare** (§1, `MISS_GENERI`). Cinque caselle — pianeti,
stelle, galassie, costellazioni, stazioni — ed è un **filtro secco** e non
una preferenza da pesare: il punteggio premia giustamente quello che si
trova più facilmente, quindi «stasera voglio galassie» messo su quella
bilancia perdeva sempre contro l'altezza e la magnitudine, e chi lo aveva
chiesto si ritrovava la Luna, Giove e due costellazioni. Cioè una missione
perfettamente sensata: quella di qualcun altro. I cinque generi sono le
cinque cose che una persona nomina guardando in su e non le famiglie del
catalogo; gli eventi del calendario passano sempre, perché sono
appuntamenti; e un elenco vuoto vuol dire *tutti* e non *nessuno*.

**Il sorteggio** (§2, `missCaso` e `missPescaPesato`). La scelta era un
argmax, e dallo stesso balcone alla stessa ora le posizioni sono identiche:
la missione era la stessa ogni sera. Non si vede guardando *una* missione —
cinque bersagli sensati sono cinque bersagli sensati — e si vede benissimo
alla terza sera. Adesso ogni tappa si pesca con peso `exp((punti −
migliore)/T)`: il migliore vince spesso e non vince sempre. Il generatore è
**seminato**, e non per le prove: la stessa missione si ridisegna decine di
volte, e con `Math.random` in mezzo ogni ridisegno sarebbe una serata nuova.

**La soluzione** (§6). Il terzo aiuto rivelava e centrava: si chiedeva un
indizio e ci si ritrovava la risposta, cioè la caccia finiva senza che
nessuno l'avesse decisa. Adesso i tre indizi sono tre indizi, e sotto al
terzo compare un tasto ambra che dice cosa fa. Il pannello zero si chiama
**Enigma** e non più «Indizio 1 di 3», che prometteva tre indizi quando
quelli veri erano due.

**La configurazione**, da milleotto pixel a ottocentottantanove su un
telefono da 360 — con in più la domanda dei generi. Tre blocchi (la serata,
la caccia, i dettagli richiudibili), la nota del gradino una sola invece di
tre cartoline, le etichette accorciate.

**La voce.** Due voci per lingua: quelle espressive (Isabella, Jenny)
accettano gli stili, e da lì vengono l'enigma detto piano, la scoperta su di
giri e la resa sottovoce. Più le pause sulla punteggiatura e un ripiego
locale che smette di preferire `localService` — cioè la vecchia voce
concatenativa — alle Neural moderne.

**Il registro dei bambini** copre adesso anche il gioco vero e proprio:
indizi, scoperta, soluzione, difficoltà, titolo finale. E «Salto
nell'iperspazio» è tornato «Salto».

**Prove.** `scripts/prova-missione.js` è a **147 verdi su 147** (106 motore +
41 browser), da 91 su 93. Le due rosse erano rosse da prima e per la stessa
ragione: cercavano un tasto `data-miss-azione="aiuto"` che non esiste più da
quando gli indizi si sfogliano con le frecce, e la prima si portava dietro
**tutta la sezione dell'aiuto progressivo**, che non girava affatto. Nella
stessa passata è tornato a girare `scripts/prova-missione-stati.js`, che
moriva a metà su un finto elemento del documento senza `removeAttribute`.
Verdi anche `prova-missione-interattiva.js`, `prova-lingua.js` (zero errori
in console) e `controlla-i18n.js --patto`.

Cache PWA a `astrocal-v300`.
