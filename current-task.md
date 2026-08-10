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

## Cosa si sta facendo

Seguito diretto della vista "vicino alla Terra" nel Sistema Solare 3D
(vedi commit precedenti su questo branch): l'utente ha chiesto di potersi
avvicinare molto di più alla Terra con lo zoom, e di migliorare la sua
texture perché avvicinandosi si veda meglio invece di restare una macchia
sfocata.

## A che punto siamo

- [x] `SOL_ZOOM_MAX` (60, invariato) e `SOL_ZOOM_MAX_TERRA` (900, nuovo):
      `solImpostaZoom()` usa il secondo tetto solo mentre `sol.centratoTerra`
      è vero — il tetto basso esiste per non far mangiare al Sole l'orbita di
      Mercurio nella vista d'insieme, un problema che vicino alla Terra non
      c'è (il Sole è fuori dallo schermo).
- [x] `solCrescitaTerra()` + `SOL_CRESCITA_TERRA_MAX` (60): fa crescere SOLO
      la Terra, quando `centratoTerra` è vero, senza il tetto di
      `solCrescita()` (pensato per il Sole, condiviso da tutti i corpi).
      `solRaggioCorpo()` sceglie fra le due in base a `centratoTerra` e
      `p.id === 'Earth'`.
- [x] `skyLatoTela()`: tetto della tela dipinta alzato da `dispositivoAttuale
      === 'telefono' ? 256 : 512` a `quanto(256, 512, 1024)` — sopra i 512 px
      il disco vero (adesso può arrivare a ~230 px di raggio) superava la
      tela e veniva ricopiato più grande di quanto fosse stata dipinta, cioè
      sfocato.
- [x] `skyDipingiTerra()` arricchita: `SKY_ISOLE_TERRA` (isole visibili solo
      da vicino), `skyDipingiCosta()` (bordo frastagliato con macchie più
      piccole intorno al cerchio liscio, più due o tre zone larghe e sfumate
      dentro il continente per un rilievo che non sia tinta piatta — **non**
      tanti granelli piccoli: le trasparenze del canvas si sommano, e il primo
      tentativo con tanti granelli dava un continente a pois), velo
      atmosferico sul bordo del disco (il filo azzurro delle fotografie
      vere). Rimossa `skyTerraSotto` (era della versione a granelli, non
      serve più: la grana adesso si dipinge dentro allo stesso spazio locale
      già proiettato del continente, non cercando "che continente c'è sotto
      a questo punto a caso").
- [x] Verificato in browser (Playwright, stessa procedura delle prove
      precedenti — CDN di astronomy-engine bloccato in sandbox, scaricato da
      npm e servito in locale solo per la prova): zoom arriva davvero a 900
      mentre centrati sulla Terra e torna a tosare a 60 appena si esce; la
      texture isolata (fuori dal ritaglio giorno/notte, `skyPelle` chiamata
      a mano a 900 px) mostra coste frastagliate, isole, rilievo a zone e
      velo atmosferico senza l'effetto "a pois" dei tentativi precedenti;
      nessun errore JavaScript.
- [x] `CACHE_NAME` incrementato a `astrocal-v86`, riga aggiunta a
      `CLAUDE.md` §12.
- [x] Commit e push su `claude/token-optimization-solar-system-crbzv3`
      (PR #108).

**Niente in corso oltre a questo.**

## File toccati

- `app.js` (sezione 7.3.2 per la faccia della Terra, sezione 7.7 per zoom
  e crescita)
- `CLAUDE.md` (tabella "Dove guardare per…", §12)
- `sw.js` (`CACHE_NAME`)
