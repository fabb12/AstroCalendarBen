# Task Corrente

«Ingrandendo, nel planetario spariscono tutte le stelle» — **fatto**, niente
in sospeso.

Branch `claude/planetario-stelle-fov-bug-jtvht9`.

## Cos'era

«Ogni tanto, nella sezione planetario, se modifico il fov scompaiono tutte le
stelle. Verifica.»

Verificato per davvero, guidando il planetario vero in un browser (Chromium
via Playwright, l'app servita in locale con Astronomy Engine preso da npm
perché in quella rete il CDN non risponde): rotellina, pizzico a due dita,
tasti + e −, telefono girato, qualche centinaio di gesti a caso, contando a
ogni passo quante stelle finiscono **davvero** dentro allo schermo.

Nessun NaN, nessuna eccezione, `cat.versoriOra` mai azzerato: il difetto non
era un guasto di stato. Era il conto della magnitudine limite, e si vede tutto
in questa tabella (cielo di periferia, sei direzioni diverse):

```
campo 60°   → 649, 671, 616, 538, 717, 399 stelle
campo 15°   → 124, 143, 116, 152, 233,  87
campo  4°   →   6,  14,   6,  17,  19,   5
campo  2°   →   1,   5,   3,   6,   6,   0
campo  1°   →   0,   1,   2,   0,   1,   0
campo 0,25° →   0,   0,   0,   0,   0,   0
```

Il guadagno dello zoom vale fino a **tre** magnitudini, quindi il limite
saliva a 8,6 — ma la stella più debole di questo catalogo è la **7,0**.
Chiedere l'ottava non faceva comparire nessuna stella: faceva solo credere al
disegno di avere tre magnitudini di margine (quindi di disegnare stelle
«molto sopra la soglia», cioè piccole e anonime) mentre lo schermo si svuotava
per geometria. Il «ogni tanto» è la sesta colonna: dipende da dove si punta.

## Cosa si è fatto (`catalogo.js` §5 e §6)

1. **Il limite si ferma dove finisce il catalogo.** `catMagnitudineVoluta()`
   è quella che si vorrebbe, `catProfonditaCatalogo()` fin dove si arriva,
   `catMagnitudineLimite()` il minimo dei due e `catOltreIlCatalogo()` la
   differenza.
2. **L'avanzo va al raggio.** Senza, tosare il limite avrebbe *rimpicciolito*
   le poche superstiti proprio dove restano sole: `limite + oltre` è di nuovo
   la magnitudine che lo zoom aveva chiesto, e il disegno non si accorge della
   tosatura (provato a tappeto, scarto 0,0 px).
3. **Sotto i 6° si è dentro all'oculare**: le stelle si disegnano tutte a una
   a una, con l'alone e il nome. Cinque puntini da un pixel in mezzo al nero
   si leggono come polvere sul vetro.
4. **Lo si dice**, una volta per sessione (`catDilloCheIlCatalogoFinisce`,
   come lo `skyAvviso` del tremolio della mano).

Tre trappole trovate strada facendo, tutte con la loro prova nel §3-bis:
le **140 stelle esattamente alla magnitudine 7,00** (arrotondamento al
decimo: l'ultima riga del catalogo è la più affollata, e con l'avanzo sommato
dopo il confronto con lo zero sparivano tutte); `catServeSecondoLivello()`,
che deve guardare la magnitudine *voluta*, se no il file delle stelle deboli
non si chiede più; e `catLimiteProfondo()`, che non va tosato alla settima
magnitudine delle stelle — sarebbe stato lo stesso difetto spostato sulle
nebuline fra la 10,5 e la 11.

## Quello che resta vero, e non è un difetto

A un quarto di grado di campo il cielo **è** vuoto, e non c'è codice che possa
riempirlo: di stelle più luminose della settima, in un ritaglio così, non ce
n'è. Per averne servirebbe un catalogo più profondo (HYG arriva alla nona:
centoventimila stelle, due megabyte e passa) — è una scelta di prodotto, non
una correzione, e non è stata fatta.

## Prove

`verifica.html` §3-bis, nove prove nuove. Tutto il banco: **528 passate, 0
fallite**.
