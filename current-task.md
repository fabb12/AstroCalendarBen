# Task Corrente

**Niente in corso.**

L'ultimo lavoro chiuso: eliminato il triangolino che il mirino giallo lasciava
attaccato al poligono del terreno attraversando l'orizzonte. `clearRect()`
cancella i pixel ma, come `save()`/`restore()`, non il tracciato corrente del
canvas: ora sia il mirino sia il suo arco di sosta concludono esplicitamente il
proprio tracciato, prima che il fotogramma successivo possa riempirlo.

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
