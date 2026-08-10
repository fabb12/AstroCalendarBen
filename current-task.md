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

Nella vista **Sistema Solare 3D** (`app.js`, sezione 7.7, stato `sol`),
aggiungere la possibilità di avvicinarsi alla Terra e girarci intorno con la
telecamera — toccandola sulla scena o nella tabella — per vedere come sono
disposti gli altri pianeti nello spazio vicino a lei in questo momento. È la
stessa domanda a cui risponde il planetario (che guarda *da* qui), vista
stavolta da fuori, con la Terra come perno invece del Sole.

## A che punto siamo

- [x] Letta la sezione 7.7 di `app.js` (righe 18672–20677): lo stato `sol`, la
      proiezione ortogonale `solProietta`/`solScena`, il perno attuale (il
      Sole nell'origine), i gesti (`solInizializzaGesti`, `solTocco`) e
      l'inquadratura d'ingresso (`solInquadraDaTerra`).
- [x] Aggiunto `sol.centratoTerra` e `solAggiornaPivotTerra()`: quando è
      attivo, a ogni fotogramma lo spostamento della scena (`panX`/`panY`)
      viene ricalcolato per tenere la Terra incollata al centro della tela.
      In proiezione ortogonale, ruotare tutto intorno al Sole e poi
      ricentrare sulla Terra è **esattamente** equivalente a ruotare la
      telecamera intorno alla Terra (la differenza è una sola traslazione,
      uguale per ogni punto della scena) — quindi il gesto di trascinamento
      che già gira la scena (`az`/`elev`) diventa da solo "gira intorno alla
      Terra", senza toccare la matematica della rotazione.
- [x] `solScegli('Earth')` chiama `solAvvicinaTerra()` al primo tocco sulla
      Terra (dalla scena o dalla riga della tabella) e `solEsciDaTerra()` se
      la si tocca di nuovo mentre si è già centrati.
- [x] Bottone nella scheda della Terra per entrare/uscire dalla vista vicina,
      con testo diverso nei due stati.
- [x] `solInquadraDaTerra()` (il tasto "Da qui" e il ⟲ paracadute) e i tasti
      "Tutto"/"Pianeti interni" spengono `centratoTerra`: sono inquadrature
      centrate sul Sole, e altrimenti il ricentraggio automatico le
      contraddirebbe a ogni fotogramma.
- [x] `apriSistemaSolare()` riparte sempre con `centratoTerra: false`.
- [x] Bump di `CACHE_NAME` in `sw.js`.
- [x] Aggiunta una riga alla tabella "Dove guardare per…" di `CLAUDE.md`.
- [x] Provato nel browser (server locale + Chromium, via Playwright: il CDN
      di astronomy-engine è bloccato in questo ambiente di sviluppo, quindi
      il pacchetto è stato scaricato da npm e servito in locale solo per la
      prova). Verificato con conti esatti sullo schermo, non solo a vista:
      toccando la Terra `centratoTerra` diventa vero e lei finisce esattamente
      al centro della tela; girando la scena — anche con un vero trascinamento
      del mouse sulla tela, non solo cambiando `sol.az` a mano — la Terra
      resta incollata al centro mentre Venere/Marte/Mercurio si spostano
      intorno a lei; ritoccando la Terra si torna alla vista d'insieme con
      `centratoTerra` di nuovo falso e l'inquadratura d'ingresso. Nessun
      errore JavaScript dall'app (solo richieste di rete bloccate dalla
      sandbox, previste e innocue).
- [ ] Commit e push su `claude/token-optimization-solar-system-crbzv3`.

## File toccati

- `app.js` (sezione 7.7, indicativamente righe 18860–20680)
- `CLAUDE.md` (tabella "Dove guardare per…", §12)
- `sw.js` (`CACHE_NAME`)
- `.github/workflows/pubblica.yml` (esclude anche questo file dal deploy)
