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

## L'orizzonte delle montagne, fatto come PeakFinder

Quattro cose, tutte fatte:

- [x] **Le vette giuste.** La cernita non passa più dal profilo del terreno
      (campionato ogni 7°30′ e interpolato: alla direzione della vetta dice la
      mescolanza dei due settori vicini) ma dalla **linea di vista** —
      `cimeControlla()` in `terreno.js` §11 campiona il DEM sulla retta che
      porta alla punta, dodici punti, e l'angolo più alto è quello che copre.
      Cinque richieste una volta per luogo, e i due numeri che ne escono
      (`bloccoQuota`, `bloccoKm`) stanno nel salvato. Da lì la **sporgenza**,
      che è quella che decide quali nomi scrivere quando non c'è posto.
- [x] **I raggi nelle Impostazioni.** `terreno.js` §1-bis (`dintorni()`,
      `dintorniImposta()`, chiave `astrocalendario_dintorni`), riquadro
      «L'orizzonte attorno a te» costruito da `costruisciDintorni()` in
      `ui-nuova.js`. Cambiare un raggio butta l'elenco salvato e lo richiede.
- [x] **I nomi spenti di serie.** `cime.acceso` nasce da `dintorni()`, e
      `cimeCarica` a nomi spenti non fa nemmeno la richiesta.
- [x] **La visualizzazione.** Scritte inclinate di 52° col gambo verticale che
      scende alla punta e lo scaletto quando due si darebbero fastidio
      (`skyNomiCime` in `app.js`): da sei nomi al massimo a `quanto(9, 13, 16)`.
      E le punte vere rimesse **dentro** al profilo disegnato (`cimeAltezza()`
      → quarto contendente di `skyAltezzaOrizzonte`, e `skyMorsoCresta` non le
      morde), così il crinale ha le sue cime dove uno le vede.

Verifica: §15 di `verifica.html` (215 prove, tutte passate) e le due prove nel
browser (`node scripts/prova-nel-browser.js`, con `CHROMIUM=` se serve).

Niente in sospeso.
