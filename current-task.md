# Task Corrente

**Niente in corso.**

Resta aperto, come prima, il lavoro di fondo sulla traduzione inglese di
`app.js`: 352 stringhe cablate contate da
`node scripts/controlla-i18n.js --lista --file app.js`. Il tetto è 352, che è
il totale di adesso.

## Lo stato delle prove

Verdi: `prova-abitati.js` (56), `prova-missione.js --solo-motore` (158),
`controlla-i18n.js --patto`, `controlla-collisioni.js`.

Rosse e **preesistenti**, verificate sull'albero pulito (`git stash`, stesso
conto prima e dopo):

- `prova-i18n.js`: 1 fallita, un modulo che non si carica in questo
  contenitore. Identica prima dell'intervento.
- Non rieseguite qui (vogliono i CDN, che da questo contenitore non si
  raggiungono — `cdn.jsdelivr.net` risponde `connect_rejected`):
  `prova-lingua.js`, `prova-fumetto.js`, `prova-stazioni.js`,
  `prova-sistema3d.js`, `prova-volo.js`, `verifica.html`. Restano le quattro
  di `prova-missione.js` nel browser, le due di `prova-sistema3d.js` e quelle
  del §20 e §28 di `verifica.html`, tutte preesistenti.

Nota per chi rilancia le prove nel browser qui dentro: il Chromium di
Playwright sta in `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, quindi
va passato `CHROMIUM=...`; e `playwright-core` va installato a mano
(`npm install playwright-core`), perché il repo non ha `node_modules`.

## Ultimo intervento completato

**Le città di giorno, e la gerarchia fra una città e i suoi quartieri.**

La metà diurna dell'abitato c'era già — la macchia del costruito col suo
perimetro — e sopra di lei una grana di quadratini tutti uguali: piatti,
della stessa misura, dello stesso grigio. Da lontano bastava; ingrandendo si
leggeva per quello che era, una texture. Quello che mancava a quei
quadratini non era il colore ma **l'altezza**.

- **Gli edifici hanno metri** (`cittaLuciDi`, `cittaPianiTipici`,
  `cittaFronteM` in §11-ter di `terreno.js`): altezza in piani dal logaritmo
  degli abitanti, col centro più alto della periferia, e un fronte che cresce
  coi piani. La cima è `terrenoAngolo(quota + h)` come la cima di una
  montagna, quindi **la prospettiva viene gratis**. Più il **campanile**, che
  è il doppio più alto delle case e ha la guglia a triangolo: è la prima cosa
  che si riconosce di un paese.
- **Il disegno** (`skyDisegnaCasePaese`, `skyAbitatoMuro` in `app.js`): tre
  gradini decisi **per edificio** — chiazza col colore del suo tetto sotto
  1,7 px, parete e tetto sopra. Quanto si vede del tetto è geometria
  (`profondità · sen d`), e la parete è chiara col Sole alle spalle.
- **La gerarchia**: la specie OSM si tiene invece di buttarla
  (`CITTA_PARTI`, `CITTA_RANGHI`, `cittaPadreDi`), la query ha **tre `out`**
  invece di uno, e un quartiere si nomina solo quando è largo abbastanza
  sullo schermo (`SKY_CITTA_PARTE_QUOTA`) — quindi zummando indietro resta la
  città e avvicinandosi si aprono i rioni. Due passate, nei nomi e fra gli
  abitati disegnati, perché le parti non consumino i posti degli interi.

Due difetti trovati dalle prove mentre le scrivevo, tutti e due muti:
`skyDisegnaMacchiaAbitato` usciva quando il **perimetro** era coperto,
cancellando un paese di cui si vedevano benissimo i tetti sopra il dosso
(`skyAbitatoSporgeQualcosa`); e un rione, stando più vicino della sua città,
**prenotava il posto** del nome prima di lei.

Il costo: misurato su una scena vera (cinque abitati, 468 case)
**1,03 → 1,11 ms** per fotogramma, l'otto per cento in più con dentro la
terza dimensione. Ci sono volute tre cure, tutte a vista invariata: le
vernici tre per paese invece di due per casa, le case fuori dal riquadro
scartate prima della seconda proiezione, e l'altezza **ricavata** invece di
riproiettata.

Ventiquattro prove nuove nei §7 e §8 di `scripts/prova-abitati.js` (56 in
tutto), e al planetario finto del banco è stata aggiunta l'elevazione della
vista: senza, un paese guardato da un monte cade fuori dal riquadro e la
prova misura uno schermo vuoto. Cache **v341**. Toccati: `terreno.js`,
`app.js`, `scripts/prova-abitati.js`, `sw.js`, `CLAUDE.md`.
