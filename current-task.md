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
sono **quattro quadri**, uno per domanda, ognuno con la sua scala, e una
manopola sola: quanto è girata la Terra.

- [x] **«Perché tramonta»** — il globo. Il Sole sta fermo, la Terra gira, e la
      manopola è l'**angolo orario**: l'altezza del Sole è una conseguenza.
      Giorno e notte disegnati per quello che sono (il cerchio massimo
      perpendicolare al Sole, con gli estremi presi in chiuso sul bordo del
      disco), **coste vere** (`TRAM_MONDO`, poligoni in lon/lat: prima erano
      le dieci macchie tonde di `SKY_TERRE`, che su un globo grande mezzo
      schermo si leggono per quello che sono), luci delle città, l'anello
      arancione dell'aria vista di taglio. Si gira col dito.
- [x] **«Quanta aria»** — a scala vera, curvatura compresa: 8,4 km di fascia
      contro i più di trecento che la luce si mangia rasente. Il cammino
      disegnato è `X × 8,4` km e **non** la corda geometrica (le due
      differiscono del 6%, e il quadro promette che il trattino ci sta dentro
      *esattamente* X volte). I trattini azzurri che escono di lato sono il
      blu che se ne va — ed è quello a fare il cielo azzurro.
- [x] **«Che colore ha»** — il cielo da una diffusione sola più l'ozono, il
      disco alla misura vera schiacciato dalla rifrazione differenziale, e
      accanto dov'è il Sole per davvero: sotto l'orizzonte.
- [x] **«E su Marte?»** — gli stessi due cieli, stessa ora, stessa scala
      angolare, stessa funzione di disegno. Lì diffonde la polvere invece
      delle molecole: estingue senza guardare il colore, ridiffonde con un
      picco in avanti più stretto nel blu, e il ferro il blu se lo mangia.
      Risultato rovesciato: color paglia di giorno, azzurro attorno al Sole
      al tramonto.
- [x] **Il Sole si prende col dito** in tutti i quadri, e a muoversi è sempre
      `tram.ora`: nessun quadro può raccontare un'ora diversa dagli altri.
- [x] **Pieno schermo** (⛶) su tutte le tele del banco, barra del tempo
      compresa.
- [x] Latitudine scegliibile (casa tua, equatore, Tromsø) con la declinazione
      vera di oggi: da Tromsø il Sole non sale mai sopra 35°.
- [x] **§17 di `verifica.html`** — 40 prove: rifrazione (e la sua inversa, che
      fuori dal suo dominio deve fermarsi invece di impazzire), massa d'aria,
      il cammino disegnato contro il numero scritto, λ⁻⁴, l'andata e ritorno
      fra ora e altezza a quattro latitudini, le effemeridi vere, e le quattro
      risposte del confronto con Marte. Passano tutte e 271.

Niente altro in corso.
