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

## I nomi delle montagne sull'orizzonte, rifatti alla PeakFinder

- [x] **Le vette giuste.** L'ostacolo di una punta non è più la cresta
      *intera* di quella direzione (che comprende le montagne dietro di lei,
      cioè lo sfondo su cui la si vede) ma solo il terreno che le sta
      **davanti**: `terreno.fronti` (48 direzioni × 12 distanze, la cresta
      accumulata fino a lì) e `terrenoCrestaDavanti(az, km)` in `terreno.js`
      §8. Le quote grezze si salvano in `localStorage`; i profili salvati
      prima non ce le hanno e ripiegano sul confronto di prima.
- [x] **Niente doppioni**: due nodi OSM per lo stesso dente (`Monte Alben` /
      `Cima Alben Ovest`) si nominano una volta sola — `CIME_VICINE_AZ_GRADI`.
- [x] **Etichette inclinate** (`skyNomiCime` in `app.js`): nome + quota su una
      pillola girata di −48°, appesa a un filo verticale che scende sulla
      punta, col triangolino sulla vetta. Il filo si allunga finché l'etichetta
      trova posto, quindi si impilano di sbieco: da 6 nomi si è passati a
      `quanto(10, 13, 16)`. La prova di sovrapposizione è il teorema degli assi
      separatori (`skyRettiSiToccano`), condivisa con i nomi dei paesi.
- [x] **I due raggi nelle Impostazioni** (§9-bis di `terreno.js`, prefisso
      `raggi`; UI `#imp-raggi` costruita da `costruisciRaggiOrizzonte()` in
      `ui-nuova.js`): montagne 15–200 km (di serie 80), paesi 10–150 km (di
      serie 90). Il raggio finisce dentro al salvataggio: uno più stretto di
      quello chiesto si butta, uno più largo si tiene e si taglia.
- [x] **Le vette nascono spente** e la scelta si ricorda
      (`raggi.nomiMonti`); finché sono spente `cimeCarica` non chiede niente
      a Overpass.
- [x] I nomi delle vette si vedono a qualunque ingrandimento (prima
      sparivano sotto i 10° di campo, insieme agli aloni delle città).
- [x] Nuova chiave di backup `astrocalendario_raggi_orizzonte`.
- [x] `CACHE_NAME` → `astrocal-v91`, `CLAUDE.md` aggiornata, §15 di
      `verifica.html` allargato.

**Nota sul banco di prova**: le prove nuove del §15 girano sulla geometria di
`terreno.js` e sono state verificate a mano; `verifica.html` per intero vuole
la rete (astronomy-engine dal CDN), che nell'ambiente in cui è stato scritto
questo lavoro non c'era.

Niente in sospeso.
