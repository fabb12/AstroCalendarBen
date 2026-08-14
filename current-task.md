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

## L'orizzonte a singhiozzo — fatto

Aprendo il planetario i nomi delle montagne comparivano, sparivano, dopo
qualche secondo ricomparivano mentre il profilo si affinava, e sparivano di
nuovo. Non era un problema delle vette: era il terreno.

`terrenoDisponibile()` chiedeva `stato === 'pronto'`, cioè **che non ci fosse
una richiesta in volo**. Ma quello stato torna a «in-corso» tre volte nella
vita normale di un posto:

- dopo il **giro grosso** (`terrenoApplica(..., ancoraInCorso)`) — che il
  profilo ce l'ha già, ed è esattamente il momento in cui si dovrebbe
  cominciare a disegnarlo. Per come stavano le cose non lo usava nessuno,
  mentre la riga di stato diceva «l'orizzonte qui sopra è già quello vero»;
- quattro secondi dopo l'apertura, quando un **salvataggio parziale** si
  completa da solo (`terreno.completatoPer`);
- a ogni **tentativo automatico** dopo un guaio (`TERRENO_RIPROVE_MS`).

Ogni volta l'app buttava un profilo che aveva già in mano: l'orizzonte tornava
quello finto per una decina di secondi, e i nomi delle montagne — che senza
terreno non hanno più niente che li nasconda — si riaccendevano tutti insieme
(ottanta vette invece delle sei che spuntano davvero) per poi sparire di nuovo
alla fine dello scarico.

- [x] `terrenoDisponibile()` guarda **se il profilo c'è**, non lo stato della
      richiesta. `terrenoAltezza` passa da lì invece di rifare il controllo.
- [x] `terrenoScordaProfilo()`: a buttare il profilo è **solo** un cambio di
      luogo, e lo fa `terrenoCarica` quando il posto nuovo è più lontano di
      `TERRENO_RAGGIO_VALIDO_KM` — le colline di Genova disegnate a Bolzano
      sono peggio di nessuna collina, perché sembrano vere.
- [x] `terrenoInArrivo()` + `cimeVisibili()`: finché il terreno **sta
      arrivando** e non c'è ancora niente, nessuna vetta si nomina. Dare
      l'elenco intero e poi rimangiarsene metà è il singhiozzo; se invece il
      terreno non arriverà più (spento, o la rete ha detto di no) si torna a
      nominare quello che spunta, come sempre.
- [x] Le righe di stato non mentono più: `cimeTesto()` distingue «aspetto la
      forma del terreno» da «restano tutte dietro alla prima cresta», e
      `terrenoMotivoGuaio()` non dice «resta l'orizzonte disegnato» quando
      sullo schermo ci sono le colline vere.
- [x] Cinque prove nuove nel §15 di `verifica.html` (tutte e 276 passano).
      L'A/B fuori dal browser dice com'era e com'è: prima
      `finto → finto → vero → finto → vero` con l'elenco delle vette che
      sbatteva fra 2 e 1 a ogni passaggio, adesso una transizione sola e poi
      fermo.

Niente altro in corso.
