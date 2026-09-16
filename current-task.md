# Task Corrente

**Niente in corso.**

L'ultimo lavoro chiuso: la galleria non chiede più la cartella e il permesso a
ogni apertura (§12 di `CLAUDE.md`, voce «La galleria chiede la cartella e il
permesso a ogni apertura»). In una riga: l'apertura **controlla** il permesso
invece di richiederlo, la risposta sulla cartella si ricorda in
`CHIAVE_VIDEO_CARTELLA`, e lo spazio si chiede persistente perché l'handle non
venga sfrattato insieme ai video.

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 347 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js`. Il tetto è 347, che è
il totale di adesso (era 352: cinque frasi della galleria sono passate ai
dizionari).

## Lo stato delle prove

Verdi: `prova-galleria.js` (6 su 6, fra cui il conto dei dialoghi),
`prova-lingua.js`, `controlla-i18n.js --patto`.

Rosse e **preesistenti**, verificate sull'albero pulito (`git stash`, stesso
conto prima e dopo):

- `prova-i18n.js`: 1 fallita, due chiavi orfane `sol.azione.insieme` e
  `sol.azione.giraIntorno`. Identica prima dell'intervento.
