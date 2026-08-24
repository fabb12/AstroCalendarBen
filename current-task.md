# Task Corrente

Niente in corso.

## Ultimo intervento completato

Tolti i poligoni di terreno che comparivano sul cielo **a campo estremo con la
camera alzata**. Era una regressione dell'intervento precedente (il fondo del
rilievo a fette di distanza, `astrocal-v149`).

Il fondo a fette e la sagoma chiudevano ogni curva del terreno «giù fino al
fondo del riquadro». È la chiusura giusta finché l'orizzonte attraversa lo
schermo da parte a parte, ed è quella che c'era. Ma alzando la camera a 180°
l'orizzonte ci sta tutto dentro, e con lui ogni curva diventa un **anello**:
tirare una riga dal bordo di un anello che gira attorno al centro dello
schermo fino al bordo di sotto fa un poligono che si attraversa da solo, e con
la regola `nonzero` una parte si riempie e una no. Sul cielo restavano fasce
verticali di terra coi bordi netti, e il resto della volta celeste dipinto di
verde.

- `rilievo.js`: `RIL_ANELLO_GRADI` (270°) dice quando le curve si chiudono, e
  `skyCerchioOrizzonte` da che parte sta la terra — **fuori** dall'anello
  guardando in su (riquadro meno anello, pari-dispari), **dentro** guardando
  in giù (lì al centro dello schermo c'è il nadir). `rilTracciaSagoma`
  restituisce la regola di riempimento invece di un sì/no, come fa
  `skyTracciaSuolo`; la fetta più vicina si chiude allo stesso modo.
- `app.js`: i due che usano la sagoma — il velo dell'occlusione e la grana —
  usano la regola restituita invece di dare per scontata la `nonzero`.

La soglia sull'arco non è una taratura fine: sotto i sessanta gradi di
elevazione le due chiusure danno lo stesso disegno (i capi dell'arco cascano
fuori dal riquadro ai lati) e si separano solo quando l'anello circonda lo
schermo per davvero. Verificato in Chromium headless su sette inquadrature —
elevazione da −70° a +88°, campo da 50° a 180° — con le quote vere; le viste
normali non cambiano di un pixel. Prove nuove nel §25 di `verifica.html`, che
registra il tracciato e poi gli chiede se il cielo gli è finito dentro, col
contro-esempio della chiusura di prima. La pagina passa intera: 723 prove,
nessuna fallita. Cache PWA portata a `astrocal-v150`.
