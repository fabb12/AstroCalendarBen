# Task Corrente

L'acqua vicina — quella su cui si sta o che si ha a pochi metri — **fatto**,
niente in sospeso.

Branch `claude/planetario-acqua-mancante-ksry5a`.

## Cos'era

«Quando sono vicino, o dentro, a un lago o a un fiume l'acqua non viene
mostrata e neanche la forma del lago e del fiume.»

Quattro difetti diversi, tutti con lo stesso sintomo — e il sintomo è il
peggiore che ci sia, perché un'acqua che non si disegna **non fallisce**:
semplicemente non c'è, e non lascia traccia da nessuna parte. Riprodotti
tutti con un banco a parte che monta un terreno finto coerente con la forma
dell'acqua e chiama le funzioni vere di `terreno.js`.

1. **La quota presa sulla riva** (`acqueQuotaDi`, `terreno.js` §12). Uno
   specchio più stretto dei centocinquanta metri della griglia non ha nessun
   campione dentro di sé — cioè tutti i fiumi, tutti i laghetti e **sempre**
   quello che si ha davanti alle scarpe. Il ripiego prendeva il campione più
   vicino, che non è sull'acqua: è la sponda di là. Su una riva che sale quel
   numero sta *sopra* l'occhio, e `acqueVisibili` scartava la banda come
   «acqua più in alto di chi guarda». Misurato: un fiume largo 60 m a 40 m di
   distanza, con la sponda che sale di 60 m/km, spariva del tutto.
2. **Il fiume sotto i piedi** (`acqueFiumeAddosso`, nuova). Zero bande in
   tutte e 720 le direzioni. Due cause che si sommavano: i raggi partono
   dall'origine e una retta che passa per l'origine non la si taglia a
   distanza positiva, e i lati si provano solo contro i raggi compresi fra i
   loro estremi — che stando in mezzo sono mezzo giro e non tutto.
3. **L'occlusione teneva un tratto solo** (`acqueVisibili`). Camminava dalla
   riva lontana verso quella vicina e si fermava al primo punto coperto: è il
   caso del lago in conca, di cui si vede la metà lontana. Trovando invece
   coperta la riva **lontana** — un promontorio a metà lago, il dosso oltre
   l'ansa — usciva al primo passo e buttava via la banda intera, cioè l'acqua
   che uno ha davanti spariva per colpa di qualcosa che le sta dietro.
4. **L'arco dell'orizzonte** (`skyArcoOrizzonteInVista`, `app.js`). L'acqua
   non sta sulla riga dell'orizzonte: ci sta sotto. Guardando in giù con un
   campo di 60° bastava abbassare la vista di una cinquantina di gradi perché
   la riga uscisse dallo schermo, la funzione rispondesse «non è in vista» e
   sparissero insieme il mare e tutti i laghi — proprio nell'inquadratura in
   cui sono l'unica cosa che c'è.

## Cos'è cambiato

- **`acqueQuotaDi`**: senza campioni dentro allo specchio il ripiego è il
  **minimo dei due campioni che lo abbracciano** (non quello più vicino), più
  il suolo sotto i piedi quando lo specchio comincia dentro al primo anello.
  Di uno specchio d'acqua si sa una cosa sola: che è la cosa più bassa lì
  attorno.
- **`acqueVisibili`**: una banda che comincia ai piedi la quota non la chiede
  affatto (`terreno.quota`, che per chi sta dentro a un lago
  `acqueAllineaOcchio` ha già portato al pelo dell'acqua); e l'occlusione
  tiene **tutti** i tratti scoperti invece di uno — un lago diviso da un
  promontorio sono due strisce, che è quello che si vede. Passi da 8 a 12
  (`ACQUE_OCCLUSIONE_PASSI`), perché adesso conta anche dove i tratti
  cominciano.
- **`acqueFiumeAddosso`** (nuova, `terreno.js` §12): se la distanza dall'asse
  del corso è meno di mezza larghezza, a trenta metri un fiume è **dritto** —
  bastano il suo asse e la sua larghezza, e per ogni direzione l'acqua
  comincia ai piedi e finisce dove il raggio esce dalla striscia. Non si segna
  fra i `sommersi`, che sono dei soli poligoni e spostano l'occhio al pelo
  dell'acqua: chi sta su un ponte è alto quanto il ponte.
- **`skyArcoAcquaInVista`** (nuova, `app.js` §7.3.2), usata dal mare e dai
  laghi al posto di `skyArcoOrizzonteInVista`. Non è solo un sì al posto di un
  no: è **un'altra misura**. L'altra dà la larghezza del cono sulla riga
  dell'orizzonte, ma scendendo verso il nadir i meridiani si stringono e uno
  schermo largo si mangia molti più azimut — al nadir, tutti. È
  `asin(sin σ / cos a)`, e quando il rapporto supera l'unità il polo è dentro
  al cono. Con la misura sbagliata, guardando in giù dentro a un lago
  restavano due spicchi di prato negli angoli in basso dello schermo.
- **`ACQUE_VERSIONE` da 2 a 3**: chi aveva già delle bande salvate in un posto
  attraversato da un fiume se le teneva senza la banda che comincia dalle
  scarpe.

## Come si è verificato

- `verifica.html` §20: **501 prove, tutte passate** (le 489 di prima più 12
  nuove sull'acqua vicina). Le nuove falliscono sul codice di prima.
- Il planetario vero, guidato da fuori con un terreno e delle acque finte:
  dentro a un lago guardando in giù di 30° lo schermo è tutto acqua con la
  riva lontana in cima (prima: due spicchi di prato negli angoli); su un fiume
  di 70 m guardando in giù di 40° l'acqua c'è, con la sua etichetta (prima:
  niente).
