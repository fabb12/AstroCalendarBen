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

## L'orizzonte a tre strati, e i comandi sopra il cielo

- [x] **Il terreno si disegna a tre profondità vere**, non a tre copie
      rimpicciolite della stessa sagoma: primo piano (entro 4 km), piano
      intermedio (entro 16), sfondo (tutto). Le tre altezze vengono da
      `terrenoCrestaEntro(az, km)` (`terreno.js` §8, che adesso è la
      funzione sotto a `terrenoCrestaDavanti`) e da `skyStratiOrizzonte()`
      in `app.js`. Essendo massimi accumulati sono per costruzione una
      sopra l'altra: disegnate dallo sfondo in avanti, **la collina qui
      davanti copre davvero la catena dietro**.
- [x] `skyMorsoCresta` è diventata `skyCresteDelleColonne(col)`: calcola
      tutte e tre le altezze in una passata e le **taglia** una sull'altra
      (`tetto`), se no una sella scavata nel piano intermedio lo faceva
      scendere sotto al primo piano e le due creste si intrecciavano.
- [x] Ostacoli dichiarati a mano e alberi (`skyAddossoAllOcchio`) si
      sommano al primo piano, non allo sfondo. Senza terreno vero restano
      i piani finti di prima, identici (il campo `quota` di
      `SKY_CRESTE_PIANI`).
- [x] **Le etichette delle vette partono dal loro strato**
      (`SKY_CIME_FILO_STRATO`, `skyStratoDiCima(km)`, stesse soglie del
      disegno): una collina vicina rasente alla punta, una cima lontana in
      alto sopra al crinale. `SKY_CIME_VELO_STRATO` le sbiadisce con la
      distanza, come le creste.
- [x] **Bussola fissa in alto a destra** (`#skymap-bussola`,
      `skyAggiornaBussola()`): quadrante che gira, indice giallo della
      vista, N ambrato, gradi in mezzo. Lo stato (Nord geografico /
      magnetico / vista a dito) lo dice l'aspetto, via `data-modo`.
- [x] **Mirino centrale giallo** (`skyDisegnaMirino`, era grigio e si
      perdeva), stesso giallo dell'indice della bussola.
- [x] **Letture compattate**: due righe corte a sinistra. Via da sopra il
      cielo «Nord vero», la declinazione magnetica e «bussola relativa» —
      il dettaglio esteso è nel `title` (`skyStatoEsteso()`), e la
      precisione della posizione ricompare da sola quando è larga.
- [x] `CACHE_NAME` → `astrocal-v92`, `CLAUDE.md` aggiornata, §15 di
      `verifica.html` allargato con le tre bande.

**Banco di prova**: `verifica.html` gira tutto — 219 prove passate, comprese
le tre nuove. L'ordinamento delle tre bande e il ripiego senza terreno vero
sono stati provati anche a parte, e il disegno guardato a schermo (il
planetario con un DEM sintetico: i tre piani si vedono, e quello davanti
copre).

Niente in sospeso.
