# Compito in corso

Questo file non è documentazione del progetto (quella è `CLAUDE.md`): è
l'appunto di **cosa si sta facendo adesso**. Serve a chi riprende una sessione
— umano o Claude — per non dover rileggere la chat né riesplorare il codice da
zero solo per capire a che punto si era rimasti. Non fa build, non viene
pubblicato (`pubblica.yml` lo esclude come CLAUDE.md), e non ha una struttura
fissa: basta che dica *cosa*, *a che punto* e *cosa manca*.

**Convenzione**: a inizio di un compito nuovo si riscrive da capo (non si
accumula la storia — quella sta nei commit). A compito finito e pubblicato si
lascia una riga sola: «Niente in corso». Le spunte `[x]`/`[ ]` sono lo stato,
non un verbale.

---

## La conformazione del terreno, come su PeakFinder

- [x] **Il terreno si misura più fitto**: da 48 direzioni × 12 distanze a
      **120 × 18** (`TERRENO_DIREZIONI`, `TERRENO_DISTANZE`). A 7°30′ di
      passo, con un campo di sessanta gradi finivano otto campioni sullo
      schermo: una spezzata, non un crinale. A 3° ne finiscono venti. Le
      richieste passano da 6 a 24, a gruppi di quattro
      (`TERRENO_RICHIESTE_INSIEME`) con la percentuale nella riga di stato;
      restano una volta sola per luogo, poi `localStorage`. I profili
      salvati vecchi non passano `terrenoPostoValido` e si riscaricano da sé.
- [x] **`terrenoFronti` tiene i valori grezzi**, cioè anche sotto zero dove il
      terreno sta più in basso dell'occhio. `terrenoCrestaEntro` li tosa in
      lettura, quindi per tutto il resto dell'app non cambia niente. Nuova
      `terrenoFrontiA(az, buffer)`: la riga intera in un colpo, che è quello
      che chiede il disegno per ogni colonna dello schermo.
- [x] **L'orizzonte si disegna a piani veri, non a tre.** `skyPianiOrizzonte()`
      dà una banda per ogni fetta di `TERRENO_DISTANZE`; ognuna si disegna come
      **striscia** (dalla sua cresta alla cresta di quella davanti), quindi lo
      schermo si dipinge una volta sola comunque siano tante. Chi non alza
      l'orizzonte non si disegna, e oltre `SKY_CRESTE_MAX_QUANTO` si tengono le
      più imponenti — mai l'ultima, che deve coincidere con
      `skyAltezzaOrizzonte`.
- [x] **Il panorama prosegue sotto la linea dell'orizzonte** (`col.fondo`,
      `SKY_CONCA_MIN`): da una cima le dorsali che scendono a valle erano
      semplicemente assenti, e sotto la linea c'era una campitura nera. I sei
      gradi di franchigia sono sottratti e non confrontati, così in pianura il
      fondo resta esattamente zero e il suolo con la sua grana è quello di
      prima, pixel per pixel.
- [x] **Il filo di luce solo sui crinali veri** (`q.cima`): un crinale è dove
      la fetta successiva non alza più l'orizzonte, cioè è finita dietro.
      Segnando il bordo di ogni banda veniva fuori una carta a curve di
      livello — un pendio liscio attraversa comunque dieci fette. La sagoma
      più esterna non sbiadisce mai: è l'unica con il cielo dietro.
- [x] **I nomi delle montagne agganciati alla punta disegnata**
      (`skyPuntaDisegnata`, `skyQuotaDisegnata`). La quota di OpenStreetMap non
      è il punto in cui il crinale finisce sullo schermo — il rilievo fine
      morde, il DEM ha novanta metri di passo, la vetta cade fra due
      direzioni — e mezzo grado bastava a far galleggiare il triangolino. Ora
      si cerca il massimo della cresta **disegnata** in mezzo passo di griglia
      attorno alla vetta. Stessa cura per il trattino dei nomi dei paesi.
- [x] `CACHE_NAME` → `astrocal-v93`, `CLAUDE.md` aggiornata, §10 e §15 di
      `verifica.html` resi indipendenti dalla griglia (gli indici e le soglie
      si ricavano da `TERRENO_PASSO_AZ`: erano scritti a mano per i settori da
      7°30′ e fallivano su una griglia diversa pur essendo il codice giusto).

**Banco di prova**: `verifica.html` gira tutto, **223 prove passate**,
comprese tre nuove su `terrenoFrontiA`.

Il disegno è stato guardato davvero, non dedotto: Chromium headless che apre
`index.html` con un DEM sintetico (pianura con la catena in fondo, cima con le
dorsali che scendono, mare, campo stretto, e il caso senza terreno vero), con
gli scatti a confronto prima/dopo. Da una cima il «prima» è una campitura nera
e il «dopo» sono le dorsali. Costo per fotogramma misurato con e senza il
profilo: **+0,7 ms** in pianura e **+1,5 ms** da una cima, in software
rendering senza GPU — e da una cima il vecchio non disegnava niente.

**Non fatto, e va detto**: sotto la linea dell'orizzonte le dorsali sono
campiture con il loro filo di luce, ma la grana e la velatura di paesaggio
restano quelle del suolo unico che c'era prima. Farle seguire i piani vorrebbe
dire rifare `skyDisegnaGranaTerreno` e `skyDisegnaVeloPaesaggio` per striscia,
ed è un compito a sé.
