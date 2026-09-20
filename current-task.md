# Correzione del rilievo a forte zoom — da verificare visivamente

Il disegno Canvas 2D in `rilievo.js` si fermava a una colonna ogni 0,5°.
Riducendo il FOV, ogni tratto diventava quindi largo centinaia di pixel.
Le tessere DEM erano già campionate con interpolazione bilineare.

La correzione permette passi frazionari della griglia, vincolati alla
dimensione in pixel, e restringe il lavoro al cono visibile. Il tetto di
4096 colonne dirada l'intero arco senza tagliarlo, anche vicino al nadir.
La maglia si legge con una bilineare periodica in azimut e bloccata agli
anelli estremi. Le normali sono condivise per nodo, interpolate e
rinormalizzate; il cache si invalida quando cambiano le quote. Anche il
dithering interpola fra colonne, senza troncare gli indici frazionari.

Verifiche: `scripts/prova-rilievo-zoom.js`, 10 gruppi numerici e 15 viste
con geometria di proiezione estratta da `app.js` e un contesto Canvas che
rifiuta coordinate non finite. Eseguiti nel runtime JavaScript della
sessione con i sorgenti in memoria: l'avvio dei processi locali è fallito.
Non sono stati eseguiti Chromium, la suite completa o misure FPS reali.

Prima del merge:
- Aprire una zona montuosa, scendere da 60° a 0,25° guardando i pendii.
- Attraversare 0°/360° e le soglie LOD durante pan e zoom.
- Verificare campo 180°, vista verso il nadir e movimento GPS.
- Controllare prestazioni e memoria su telefono, incluse nuove quote DEM.
- Aggiornare la cache del service worker al rilascio, secondo la procedura
  del progetto.

Non aggiunge dettaglio geografico oltre la risoluzione delle quote:
affina e interpola la superficie esistente.
