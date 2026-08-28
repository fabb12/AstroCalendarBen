# Task Corrente

Niente in corso.

## Ultimo intervento completato

Gli **spicchi d'acqua** accanto ai laghi, e i laghi che non avevano la forma
che hanno sulla carta (segnalato sul Lago di Lugano). Le cause erano sei, e
tutte della stessa famiglia: si rispondeva «per banda» a domande che sono
dello **specchio d'acqua**.

- `terreno.js` §12 — ogni banda si porta dietro il **corpo**, cioè di che
  specchio è (`ACQUE_VERSIONE` 5: la tupla passa da quattro posti a cinque, e
  chi aveva bande salvate se le riscarica). Da lì:
  - `acqueQuoteDeiCorpi()`: **una quota per lago**, non una per banda. Con la
    griglia a centocinquanta metri di passo, due colonne contigue prendevano
    campioni diversi — misurato su un ramo largo trecento metri, sette quote
    per un lago solo — e dove la banda era corta il ripiego pescava sulla
    riva, che può risultare sopra l'occhio: quella colonna spariva del tutto,
    lasciando un buco a spicchio in mezzo all'acqua. I **corsi d'acqua** non
    hanno un dentro a cui chiedere, e infatti per loro contano solo i campioni
    che li abbracciano e il suolo sotto i piedi.
  - il **taglio dell'occlusione** si cerca invece di prenderlo dov'era caduto
    uno di dodici campioni equispaziati: i campioni si mettono dove il dato
    cambia (la cresta davanti è una scala a diciotto gradini) e il passaggio
    si stringe per bisezione. Da 75 m di errore medio a 0,8, e costa **meno**
    di prima (4,7 ms contro 6,0 su una scena di laghi).
  - il **taglio spaiato** — la riva di là oltre il raggio di ricerca — si
    chiude sul limite invece che a `+200 m`, contro quello che il suo stesso
    commento diceva. Era la scheggia a punta sul bordo dei laghi grandi.
  - la **corda dei corsi d'acqua** è quella esatta (`largo / (2·sen)`, senza
    il pavimento a 0,12 sul seno): l'entrata cade a distanza negativa solo se
    ci si sta davvero dentro. Prima un fiume di sbieco a un centinaio di metri
    risultava cominciare ai piedi, cioè disegnato dal nadir in su.
  - `acqueQueryOverpass` dà alle **relazioni** un `out` e un tetto propri.
    Con un `out` solo si stampano prima tutte le vie, e in una provincia di
    laghi il tetto se lo prendono loro: i laghi grandi — che sono relazioni —
    non arrivavano affatto. Le relazioni ci sono adesso anche nella query
    corta di ripiego.
- `app.js` — `skyAcqueStrisce` lega le bande **per specchio**, pretende una
  sovrapposizione vera e rompe la striscia sulle discontinuità
  (`SKY_ACQUA_SALTO`): dove un promontorio biforca la veduta la striscia
  finisce e ne cominciano due, invece di trascinare un bordo di chilometri in
  mezzo grado. E `skyAcquaStriscia` allarga ogni striscia di un quarto di
  grado per parte — una colonna è una **cella** — se no fra due strisce
  contigue resterebbe mezzo grado di fessura.
- Prove nuove nel §20 di `verifica.html`, ognuna col suo contro-esempio sul
  conto di prima (95 in quella sezione).

Cache PWA portata ad `astrocal-v216`.
