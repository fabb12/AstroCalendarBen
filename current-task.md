# Task Corrente

**Niente in corso.**

L'ultimo lavoro chiuso: **le curiosità delle schede**.

La scheda completa di un astro — il ⓘ del fumetto — rispondeva benissimo a
tre domande: dov'è, quanto è luminoso, quando sorge. Non rispondeva alla
quarta, che è quella per cui uno ha toccato lo schermo: **e allora?**
«Rasalhague, magnitudine 2,08, a 33° sopra l'orizzonte» è esatto e non dice
niente.

Adesso sotto ai numeri c'è un riquadro «Curiosità»: il motore sta in
`curiosita.js` (prefisso `cur`, ~290 righe) e il testo nei due dizionari
sotto `curiosita.*`, **552 voci per lingua**. Copertura: i nove corpi del
Sistema Solare e le tre stazioni, **226 stelle** con un nome proprio (tutte
quelle fino alla magnitudine 3,0 più una settantina di celebri più deboli),
**tutte e 88** le figure, **tutti e 132** gli oggetti del catalogo del cielo
profondo, ventidue fra comete e asteroidi, e i cinque ripieghi di specie.
Ci passano due schede: quella del planetario (`skySchedaHtml`) e la pagina
dell'atlante (`costSchedaHtml`).

Tre scelte che vale la pena conoscere prima di metterci mano.

**Niente frasi generiche.** Il difetto tipico di un pezzo così non è un
conto sbagliato: è una curiosità che vale per tutte le stelle, e quindi per
nessuna — dopo tre oggetti si smette di leggere il riquadro, che è peggio di
non averlo. Per stelle, pianeti e figure non c'è nessun ripiego: o si ha
qualcosa di vero da dire di *quell'* oggetto, o il riquadro non compare. Il
ripiego esiste in due soli posti, dove la frase generica è invece
l'informazione giusta: la specie del cielo profondo (cinque parole chiuse) e
la specie di un corpo minore.

**Gli slug sono derivati dai nomi, non scritti a mano.** Il prezzo è che una
curiosità scritta per una stella che nel catalogo si chiama in un altro modo
non comparirà mai, e il sintomo è identico a «niente da dire» — per questo
c'è `scripts/prova-curiosita.js`, che confronta gli slug del dizionario con
i nomi veri di `dati-stelle.js`, `dati-profondo.js`,
`dati-costellazioni.js`, `dati-corpi-minori.js`, `SKY_CORPI` e `SATELLITI`,
nei due versi.

**Lo stato delle varianti sta in `cur.varianti` e non nel documento.** La
scheda del planetario si riscrive da capo una volta al secondo: appoggiando
l'indice a un nodo, «raccontamene un'altra» sembrerebbe funzionare e un
secondo dopo la storia tornerebbe quella di prima. È la prova che chiude il
banco in Chromium.

`node scripts/prova-curiosita.js` — 27 prove, 0 fallite (le ultime sei in un
browser vero). `node scripts/prova-i18n.js`, `node scripts/prova-lingua.js` e
`node scripts/prova-fumetto.js` restano ai loro rossi di prima, identici al
ramo: due chiavi orfane della vista 3D, il nome di un oggetto profondo che la
sonda della lingua legge come italiano («h Per»), la fotografia di riserva di
Wikipedia che dipende dalla rete.

`CACHE_NAME` è a `astrocal-v347`.
