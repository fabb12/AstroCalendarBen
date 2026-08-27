# Task Corrente

Niente in corso.

## Ultimo intervento completato

Il paesaggio col GPS acceso in movimento. Prima, oltre i due chilometri il
profilo del terreno veniva buttato **prima** di avere il sostituto: per i
secondi dello scarico tornava l'orizzonte finto e sparivano i nomi delle
montagne — e a novanta all'ora quei due chilometri si fanno ogni minuto e
mezzo, quindi capitava di continuo. In più la posizione arrivava a gradini di
centocinquanta metri (la soglia del filtro, giusta per il cielo e sbagliata
per il terreno) e la quota dell'occhio restava quella del punto di partenza.

- `terreno.js` §**6-bis**: la velocità condivisa (`terrenoSegnaFix`,
  `terrenoInMoto`), il **punto vivo** che porta avanti l'ultimo fix grezzo per
  chi disegna (`terrenoPuntoDaDisegnare`), i raggi che crescono con la
  velocità, il profilo che si butta solo per un salto vero e lo scarico che si
  rinvia invece di ripetersi.
- Vette e paesi: raggio di validità in viaggio, geometria rifatta dal punto in
  cui si è, e — la causa più insidiosa — non spariscono più tutti insieme
  quando *una* richiesta a Overpass fallisce.
- Le acque si ri-rasterizzano dai bordi che si hanno già, senza rete.
- `rilievo.js` §**8-bis**: la camera cammina sul terreno (la quota dell'occhio
  segue il suolo sotto i piedi), la maglia si ricentra ogni sessanta metri
  perché ricostruirla non costa rete, e la traslazione è bilineare invece che
  al nodo più vicino.
- Prove nuove nel §28 di `verifica.html` (801 in tutto).

Cache PWA portata ad `astrocal-v215`.
