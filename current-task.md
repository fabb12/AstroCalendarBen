# Task Corrente

Niente in corso.

## Ultimo lavoro finito — i nomi delle vette vicine

Chiesto: verificare perché i nomi delle cime non compaiono quando le cime
sono molto vicine alla posizione attuale.

### La risposta

Non è un problema di dati e non è la cernita di `cimeVisibili()`. Le vette
vicine arrivano da Overpass (l'anello dei 25 km le prende tutte, senza filtro
sulla quota), passano l'occlusione senza fatica — `terrenoCrestaDavanti` si
ferma all'85% della loro distanza, e per un pendio che sale il fianco davanti
sta sempre sotto alla punta — e finiscono in cima all'elenco, perché
`cimeVisibili` lo ordina per altezza apparente decrescente.

Si perdevano **nell'impaginazione**, in `skyNomiCime` (app.js §, blocco «I nomi
delle montagne»). L'etichetta è una striscia inclinata di 48°, e il cielo che
le serve sopra non è il filo — dodici pixel — ma tre quarti della propria
lunghezza. Misurato con le metriche vere di Chromium sul carattere dell'app:
«Monte Bianco 4808 m» a corpo 12 è larga 121 px, cioè vuole **106 px di
franchigia** sopra la punta; «Grigna Settentrionale» ne vuole 141.

Il ciclo che allungava il filo poteva andare in una direzione sola:

```js
if (ay + sin * largo < 4) break;   // sin = sin(-48°) = -0,743
```

Per una punta disegnata in quella fascia la condizione era vera già al primo
tentativo (`t = 0`), il ciclo usciva, e il `if (!messa) continue;` buttava via
la vetta — senza consumare nemmeno uno dei posti di `skyCimeMaxNomi()`, quindi
senza lasciare traccia da nessuna parte.

E la punta disegnata in cima allo schermo è sempre **quella qui davanti**: è
vicina, quindi è alta. Restavano nominate le lontane, che stanno rasenti
all'orizzonte. Cioè spariva esattamente il monte di cui uno chiede il nome.

Quanto costava, misurato facendo girare la funzione vera in Chromium con
vette finte e la terna di `skyBase()`:

| schermo | campo | vista su | sparivano |
|---|---|---|---|
| telefono in piedi (360×625) | 60° | orizzonte | tutte sopra i **20°** apparenti |
| telefono in piedi | 30° | +10° | tutte sopra i ~**17°** |
| telefono girato (740×280) | 60° | +8° | tutte sopra i ~**7°** |

Venti gradi apparenti sono un monte settecento metri più alto a due
chilometri: la collina dietro casa.

### La cura

`prova(verso)` in `skyNomiCime`: si prova il lato buono e poi l'altro. Quando
sopra non c'è posto l'etichetta si appende **sotto** la punta, con
l'inclinazione ribaltata — è la stessa figura specchiata, quindi le etichette
di sotto restano parallele fra loro e continuano a impacchettarsi come quelle
di sopra, che è tutto il motivo per cui sono inclinate.

Provare **tutti e due** i lati e non solo quello preferito non è un di più: col
solo ribaltamento le vette vicine si prendevano il cielo che prima era di
quelle di mezza distanza, e nella prova a 60° sull'orizzonte «Punta Media»
perdeva il nome che aveva. Sarebbe stata la stessa perdita di prima, spostata
di qualche pixel.

`verso` e `incl` viaggiano dentro a `poste`: li usano il filo (che si ferma
dentro alla pillola dal lato da cui arriva) e la `ctx.rotate` finale.

Dopo: ogni vetta che ha la punta dentro alla tela prende il suo nome, in tutte
e nove le combinazioni di campo e inclinazione provate. Le sole che restano
mute sono quelle con la punta fuori dallo schermo, che è come dev'essere.

### Quello che non è stato fatto, e perché

Nessuna prova in `verifica.html`: quella pagina non carica `app.js` (§16 e §15
provano `costellazioni.js` e `terreno.js`), e questa è geometria di
impaginazione che vive tutta lì. Aggiungercelo vorrebbe dire mettere `app.js`
in quella pagina accanto agli altri moduli, che è un cambio di struttura più
grande della correzione. La verifica è stata fatta caricando `app.js` in una
pagina vuota con Playwright e chiamando `skyNomiCime` per davvero — funziona
senza errori, quindi la strada esiste, se un giorno vale la pena aprirla.
