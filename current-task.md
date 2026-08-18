# Task Corrente

Niente in corso.

## Ultimo lavoro finito — i laghi e i fiumi del planetario

Chiesto: nel planetario i laghi e i fiumi sono rappresentati male, non sono
realistici, e i nomi non si vedono.

Guardati **davvero**, non solo letti: un banco di prova apre la PWA in
Chromium con un mondo finto (un lago grande in una conca, uno a ponente per il
tramonto, un laghetto vicino, un fiume, e un modello del suolo che li
circonda), intercetta Open-Meteo e Overpass e fa le istantanee del planetario.
Senza quello, metà di quello che segue non si sarebbe visto.

### I nomi: si perdevano al terzo passo

Non era il disegno. Il nome di uno specchio d'acqua fa un viaggio lungo —
Overpass → tracciato → incroci del raggio → banda → vista → etichetta — e
`acqueTagliaUno` **non lo appendeva agli incroci**, mentre `acqueBandeDaTagli`
lo andava a cercare lì (`c.nome`, sempre `undefined`). Misurato sul banco:
286 bande con un nome dopo, **zero** prima.

È un guasto dei peggiori da vedere, perché non rompe niente: i laghi si
disegnavano uguali, e sullo schermo semplicemente non compariva nessuna
etichetta — cosa che a un posto senza laghi nominati capita davvero.

Adesso il nome viaggia appeso all'array dei tagli (`tagli.nomi`: una voce per
specchio, non una per incrocio) e si legge nell'unico punto in cui una banda
nasce. Le bande salvate in `localStorage` sono una tupla, e una tupla corta si
rilegge benissimo restando senza la cosa nuova: perciò il salvataggio adesso è
numerato (`ACQUE_VERSIONE`), se no chi aveva già aperto il planetario in un
posto si teneva dei laghi senza etichetta per sempre.

### Dove si scrive il nome

`acqueDaDisegnare` era rimasta a metà (commenti in inglese, direzione centrale
presa con min/max invece che con la media circolare, etichetta agganciata alla
riva vicina) e `skyNomiAcque` copiava il modo delle **montagne**: filo,
pillola inclinata di 48°, pallino al posto del triangolino. Non è sbagliato di
poco, è la domanda sbagliata — una vetta è un punto da indicare in mezzo a
dieci punte, uno specchio d'acqua è una superficie e il posto per il suo nome
ce l'ha dentro. Adesso il nome si scrive **sull'acqua**, orizzontale e in
corsivo come su una carta geografica, e se non ci sta non si scrive.

### Il disegno: quattro cose mancavano

1. **Il colore era piatto.** Il gradiente si costruiva fra i due *baricentri*
   dei bordi della striscia: su una striscia larga trenta gradi quei due punti
   cadono quasi nello stesso posto, e lì il canvas non dipinge niente. Adesso
   la rampa è **una per fotogramma** e vive sul cerchio dell'orizzonte come
   quella del mare.
2. **Non c'era l'aureola.** Il mare ce l'ha da un pezzo; senza, un lago col
   Sole appena sopra restava del suo grigio medio. Era la cosa più lontana dal
   vero che ci fosse in questa vista.
3. **Non c'erano le onde.** `SKY_ACQUA_CALMA` accorciava la lunghezza d'onda
   al 22%, cioè sotto ai quattro pixel apparenti sotto i quali
   `skyMarePesiDiFascia` spegne tutto. E siccome le onde di un lago restano
   comunque sotto al pixel a qualunque distanza utile, quello che si vede da
   lontano non sono le onde ma le **chiazze increspate** che il vento sposta —
   larghe centinaia di metri, cioè gradi interi: `skyAcquaVentate`.
4. **Il bordo di sotto era una riga dritta sospesa sopra la collina.**
   L'occlusione tagliava l'acqua all'angolo della cresta *misurata*, ma sullo
   schermo il dosso è disegnato più basso (il rilievo fine morde e non aggiunge
   mai). Adesso l'acqua scende fino alla cresta **disegnata**, letta da
   `skyCresteUltime` — i numeri che `skyDisegnaProfiloOrizzonte` ha appena
   finito di calcolare per il panorama, nella stessa passata.

E una cosa che non c'era affatto: il **riflesso della montagna**. Guardando
l'acqua a `dep` gradi sotto l'orizzonte si vede quello che sta a `dep` gradi
sopra — sul mare il cielo, su un lago il monte dietro. Il confine è il profilo
dei monti ribaltato, e disegnarlo come tale è la cosa che si riconosce a colpo
d'occhio in qualunque fotografia di lago.

### Costo e prove

Il disegno dell'acqua passa da 0,25 a ~0,6 ms per fotogramma (il profilo
dell'orizzonte, accanto, ne costa 1,2). Il §20 di `verifica.html` ha nove
prove in più sui nomi e sulle etichette: sul codice di prima ne falliscono
cinque.
