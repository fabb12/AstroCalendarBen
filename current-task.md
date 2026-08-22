# Task Corrente

Niente in corso.

## Ultimo lavoro chiuso — il planetario che si fermava a metà fotogramma

**Il sintomo.** Nel planetario sparivano i profili delle montagne *e* gli
astri: niente Sole, niente Luna, niente pianeti, niente cielo profondo.
Restavano il fondo del cielo e il campo di stelle del catalogo.

**La causa.** Il commit «Rendi il terreno fedele e uniforme» (077da54) aveva
tolto il blocco del rilievo fine delle creste, e con lui la costante
`SKY_RUVIDEZZA`. Ma `skyColonnaCresta()` continuava a leggerla, tre righe più
sotto: `ReferenceError: SKY_RUVIDEZZA is not defined`, sollevato dentro
`skyDisegnaProfiloOrizzonte` → `skyDisegnaTerreno` → `skyDisegna`.

È il guasto descritto in CLAUDE.md §12 alla voce «Il planetario si blocca»:
un'eccezione mentre si disegna non salta un pixel, tronca il **fotogramma**.
E l'ordine di `skyDisegna` spiega esattamente cosa si vedeva e cosa no —
sfondo, Via Lattea e stelle di catalogo vengono **prima** del terreno e
c'erano; terreno, nomi dell'orizzonte, cielo profondo, comete, tracce e
soprattutto il ciclo di `skyDisegnaAstro` (Sole, Luna, pianeti, satelliti)
vengono **dopo**, e non venivano mai raggiunti. Il `try` di `skyCiclo`
rimetteva la rAF in coda, quindi l'app non sembrava bloccata: sembrava che
metà del cielo non ci fosse più.

**La cura.** `app.js` è tornato alla versione di a837f4e, cioè allo stato
precedente al commit che l'ha rotto: torna il rilievo fine delle creste
(`SKY_RILIEVO`, `SKY_RUVIDEZZA`, `SKY_MORSO_MAX_GRADI`), torna la grana del
terreno (`skyGrana`, `skyDisegnaGranaTerreno`) e torna la profondità
variabile del cappello delle dorsali. La sfumatura continua del suolo
introdotta da a837f4e resta com'era: quel commit non c'entrava col guasto.

La cache PWA è stata portata ad `astrocal-v132`.

**Da sapere se si riprova la strada del «terreno uniforme».** L'idea di
togliere il rumore procedurale è legittima, ma va fatta per intero: chi
toglie `SKY_RUVIDEZZA` deve togliere anche il campo `ruvido` di
`skyColonnaCresta` (e `col.ruvido`/`banda.ruvido` in `skyCresteDelleColonne`),
se no resta un riferimento penzolante che non si vede leggendo il diff.
Un `grep` del nome cancellato prima di chiudere lo avrebbe trovato in un
secondo.
