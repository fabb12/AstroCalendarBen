# Niente in corso

Ultimo lavoro chiuso: **il planetario che va a scatti, e l'INP da mezzo
secondo** — una segnalazione sola, con dentro un difetto vero e una svista di
progetto.

Il banco di prova sta nello scratchpad della sessione e non nel repository: un
Chromium vero con un paesaggio sintetico (un lago fra i monti, tipo Lugano) e
le quote generate da una funzione, così la scena è nota e ripetibile. Le
tessere del rilievo sono PNG in formato terrarium generati in Node. Due
trappole del banco, che valgono per chiunque ne scriva un altro: la rotta di
`cdn.jsdelivr.net` va registrata **prima** di quella di Astronomy Engine (fra
due rotte di Playwright che combaciano vince l'ultima registrata, ed è la
stessa lezione di `prova-fumetto.js`), e il **service worker va bloccato**
(`serviceWorkers: 'block'`), se no traveste ogni richiesta di quote in un 504
sintetico e il terreno non arriva mai — cioè si misura una scena senza
montagne credendo di misurarne una con le montagne.

**(1) Il gestore del puntatore non c'entra.** Costa microsecondi. L'INP è il
*fotogramma successivo*, ed è per questo che anche i tasti della tastiera —
che con la mappa non hanno niente a che vedere — misuravano trecento
millisecondi.

**(2) Il costo non è JavaScript.** Tutto `skyDisegna` costa tre millisecondi
di conto; il fotogramma ne durava settantatré. Il resto è rasterizzazione, e a
dipingere è il terreno: **sette passate sopra alla stessa superficie**. A un
milione di pixel di tela il terreno valeva 57 ms dei 73; a quattro milioni il
fotogramma durava 218 ms, cioè cinque al secondo.

**(3) Il budget che doveva impedirlo guardava la cosa sbagliata**
(`rilAggiornaBudget`). `performance.now()` attorno alle chiamate del canvas
misura quanto ci mette il browser a *registrarle*, non a dipingerle:
`rilievo.ultimo.ms` diceva 3,4 millisecondi su un fotogramma da cinquanta, e
il termostato concludeva che andava tutto bene. Adesso legge `sky.fotogrammaMs`
— ma solo mentre la montagna si ridipinge **di fila**, se no il fattore sale e
scende da solo a camera ferma (diradare cambia il disegno, cioè *provoca* la
ridipintura successiva).

**(4) E le sue manopole tiravano la corda sbagliata.** Portando le strisce del
chiaroscuro da 4.310 a 380 il fotogramma passava da 51 a 33: sono meno, ma
coprono gli stessi pixel. Quello che conta è la superficie, non le primitive.

La cura è in `app.js`, §«La tela del terreno»: il fondo del suolo, il rilievo
e l'occlusione d'ambiente si dipingono su una tela di servizio e da lì si
ricopiano, finché la posa, l'ora e la maglia non cambiano; e mentre la camera
si muove — l'unico momento in cui la copia non vale, e anche l'unico in cui il
dettaglio fine non lo guarda nessuno — la tela si dipinge più piccola
(`SKY_TERRENO_SCALE`). Fuori dalla copia restano l'acqua (le onde camminano
con l'orologio da polso, e costano due millisecondi sui quaranta) e la grana,
che si stende in `overlay` e guarda il colore che ha sotto.

Misurato, stessa scena: **fermi 73,8 → 28,2 ms, trascinando 73,3 → 44,1** a un
milione di pixel; **218 → 107 e 218 → 147** a quattro milioni. E la prova che
conta, fatta nella stessa pagina sullo stesso fotogramma: ricopiare la tela
contro dipingere di fila dà lo 0,148% dei pixel diversi con uno scarto medio
di 1,1 livelli su 255 — è l'arrotondamento della composizione «sorgente
sopra», che è associativa, ed è il motivo per cui l'opacità del terreno va
messa **dentro** su ogni strato e la copia stesa piena.

`node scripts/prova-verifica.js` — 1.291 verdi, 6 rosse, **le stesse sei prima
e dopo** (tre sull'acqua rasente, una sulla camera che insegue, due sul raggio
fisso della realtà aumentata). `node scripts/prova-abitati.js` — 56 su 56.
`node scripts/prova-nel-browser.js` dà esattamente lo stesso esito di prima
(si interrompe su `solDisegnaVicino`, che non c'entra con questo lavoro).

**Quello che resta da fare**, con i numeri già in mano: tolto il terreno, il
fotogramma torna al pavimento del refresh, quindi il prossimo guadagno non è
più lì. Le due strade rimaste sono la **ricopiatura anche del cielo** (stelle
e Via Lattea cambiano solo con la posa e con l'ora, esattamente come la
montagna) e il **ritaglio della copia**: oggi si ricopia tutta la tela a ogni
fotogramma, e a quattro milioni di pixel quella ricopiatura da sola vale una
decina di millisecondi.
