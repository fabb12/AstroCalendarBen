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

## Il banco «Il Sole al tramonto», rifatto — fatto

Il banco raccontava, senza volerlo, un modello tolemaico: una Terra ferma e un
Sole che le saliva e scendeva attorno. Lo spessore dell'aria era esagerato di
un fattore mai dichiarato, e il rapporto fra il cammino di mezzogiorno e quello
rasente — che è tutta la spiegazione — non si vedeva da nessuna parte. Adesso
sono **tre quadri**, uno per domanda, ognuno con la sua scala.

- [x] **«Perché tramonta»** — il globo. Il Sole sta fermo, la Terra gira, e la
      manopola è l'**angolo orario** (`tram.ora`): l'altezza del Sole è una
      conseguenza, non un comando. Giorno e notte disegnati per quello che
      sono (il cerchio massimo perpendicolare al Sole, con gli estremi presi
      in chiuso sul bordo del disco), continenti veri, luci delle città,
      l'anello arancione dell'aria vista di taglio. Si gira col dito.
- [x] **«Quanta aria»** — a scala vera, curvatura compresa, come il taglio
      delle aurore: 8,4 km di fascia contro i più di trecento che la luce si
      mangia rasente. Il cammino disegnato è `X × 8,4` km e **non** la corda
      geometrica: il quadro promette che il trattino ci sta dentro tante volte
      quanta è la massa d'aria, e le due strade differiscono del 6%.
- [x] **«Che colore ha»** — il cielo da una diffusione sola più l'ozono, il
      disco alla misura vera schiacciato dalla rifrazione differenziale, e
      accanto dov'è il Sole per davvero: sotto l'orizzonte.
- [x] Latitudine scegliibile (casa tua, equatore, Tromsø) con la declinazione
      vera di oggi: da Tromsø il Sole non sale mai sopra 35°, e si vede.
- [x] **§17 di `verifica.html`** — 26 prove: rifrazione, massa d'aria, il
      cammino disegnato contro il numero scritto, λ⁻⁴, l'andata e ritorno fra
      ora e altezza a quattro latitudini (sole di mezzanotte e notte polare
      compresi) e il confronto con le effemeridi di Astronomy Engine.
      Passano tutte e 257 le prove del banco.

Niente altro in corso.
