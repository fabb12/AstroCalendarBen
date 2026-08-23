# Task Corrente

Niente in corso.

## Ultimo intervento completato

Corretto il rilievo che, al FOV massimo e alzando molto la camera, poteva
richiudere il proprio tracciato attraverso il canvas e coprire il cielo.

`skyArcoOrizzonteInVista()` usa per prudenza il cerchio che circoscrive il
riquadro. A 180° e con pitch alto quel cerchio includeva anche il meridiano
opposto alla camera, benché la sua proiezione fosse migliaia di pixel fuori
dal rettangolo. `rilArcoInVista()` ora restringe l'arco ai punti
dell'orizzonte che cadono nel canvas reale, con il margine necessario alle
montagne, e non arriva mai alla cucitura dei 180°.

Aggiunta in `verifica.html` la regressione con camera a 55°; cache PWA portata
a `astrocal-v145`.
