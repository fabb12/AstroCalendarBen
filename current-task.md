# Compito in corso

Questo file non è documentazione del progetto (quella è `CLAUDE.md`): è
l'appunto di **cosa si sta facendo adesso**. Serve a chi riprende una sessione
— umano o Claude — per non dover rileggere la chat né riesplorare il codice da
zero solo per capire a che punto si era rimasti. Non fa build, non viene
pubblicato (`pubblica.yml` lo esclude come CLAUDE.md), e non ha una struttura
fissa: basta che dica *cosa*, *a che punto* e *cosa manca*.

**Convenzione**: a inizio di un compito nuovo si riscrive da capo (non si
accumula la storia — quella sta nei commit). A compito finito e pubblicato si
lascia una riga sola: «Niente in corso». Le spunte `[x]`/`[]` sono lo stato,
non un verbale.

---

## Le eclissi nella vista 3D — fatto

La vista 3D del Sistema Solare diceva dove stanno i pianeti e basta. Non
sapeva niente della Terra (un pallino azzurro largo otto pixel, con dieci
macchie di continente dipinte sopra), non sapeva niente delle eclissi, e
arrivando dalla scheda di un'eclissi si apriva sulla stessa scena di sempre —
da girare finché uno capiva cosa c'entrasse.

Adesso fa quattro cose, e sono quattro sezioni nuove o rifatte di `app.js`.

- [x] **§7.7-ter, la Terra da vicino.** Sopra ai tredici pixel di raggio il
      globo smette di essere la faccia dipinta e diventa il pianeta vero: le
      coste di `SKY_MONDO`, il confine del giorno in tre veli (che è una
      fascia, non una riga), le luci delle città dentro alla notte, il puntino
      di casa e, durante un'eclissi di Sole, la macchia dell'ombra della Luna.
      Il telaio geografico non è inventato: `solTelaioTerra()` chiede alla
      libreria dov'è il polo e dov'è Greenwich in quell'istante, cioè la
      stessa catena di conti del planetario.
- [x] **L'impronta dell'ombra non è un cerchio.** Il primo tentativo
      disegnava una calotta tonda del raggio della sezione del cono, e per il
      12 agosto 2026 dava una macchia larga centotrenta chilometri invece dei
      trecento della fascia vera: la differenza è tutta obliquità, perché il
      cono arriva di sbieco. Adesso `solImprontaSuTerra()` tira un raggio per
      volta dal limbo della Luna e lo interseca con la sfera. La penombra si
      disegna col solo bordo — copre un terzo del pianeta.
- [x] **§7.7-quater, il banco «Terra e Luna».** Una scena a parte, con la
      Terra nell'origine e i chilometri al posto delle unità astronomiche, e
      **niente di ingrandito**: i due corpi, la distanza fra loro e i due coni
      d'ombra sono allo stesso metro, col righello sotto per controllarlo. È
      lì che si vede perché le eclissi non capitano tutti i mesi — cinque
      gradi di inclinazione, a trecentottantamila chilometri, sono cinque
      raggi terrestri fuori dal piano contro un'ombra larga meno di uno.
      C'è l'orbita lunare vera (sopra al piano continua, sotto tratteggiata),
      la linea dei nodi, la sezione dell'ombra alla distanza della Luna, e
      `solStatoEclissi()` che dice a parole cosa succede — o di quanto manca.
- [x] **I nodi e le inclinazioni delle altre orbite.** C'erano sempre state
      (le orbite si campionano dalle posizioni vere), ma un grado e mezzo
      disegnato è meno dello spessore della linea. Il chip «Nodi» aggiunge la
      corda fra i due nodi, i due estremi col filo a piombo e i gradi scritti
      accanto: Mercurio 7,0°, Venere 3,4°, Marte 1,8°, e la Terra niente,
      perché il piano è il suo.
- [x] **La camera si posiziona da sola sull'evento.**
      `apriSistemaSolare({ evento: id })`: un'eclissi apre il banco Terra e
      Luna con l'orologio già portato lì e il passo del tempo a un'ora, un
      evento con un pianeta protagonista apre la vista d'insieme con quel
      pianeta già scelto. Il tasto «Perché succede» sta nelle schede
      dell'agenda e nell'elenco eventi del planetario.
- [x] **Un mondo solo.** Le coste e le luci delle città stavano dentro al
      banco del tramonto di `didattica.js`. Sono passate in `app.js` §7.3.2
      (`SKY_MONDO`, `SKY_LUCI_CITTA`) e la Didattica le legge da lì: due copie
      dello stesso mondo divergono al primo ritocco.
- [x] **§18 di `verifica.html`**, trenta prove nuove (306 in tutto, tutte
      passate). Le più utili: che all'equatore il telaio geografico coincida
      con `ObserverVector` e altrove sbagli **solo** dell'ellissoide, che sei
      ore dopo mezzogiorno UT il Sole sia a ovest e non a est (il mondo non è
      specchiato — l'errore che a occhio non si vede), che il punto di massima
      eclissi del 12 agosto 2026 caschi dove dice la NASA, che la fascia di
      totalità sul terreno sia più larga della sezione del cono, e che le
      inclinazioni ricavate dai campioni tornino col catalogo.

Provato in un browser vero (Chromium headless) su tre eclissi: la totale di
Luna del 3 marzo 2026, la totale di Sole del 12 agosto 2026 e la parziale di
Luna del 28 agosto 2026, più una Luna piena qualunque di fine giugno che
l'ombra manca di quattro raggi terrestri.

Niente altro in corso.
