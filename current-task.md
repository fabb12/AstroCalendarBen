# Niente in corso

Ultimo lavoro (v403): il passaggio planetario ↔ vista 3D con lo zoom.

- Zoomando indietro oltre i 180° di campo si esce nello spazio (`skySpintaOltreIlCampo`).
- Zoomando sulla Terra finché riempie lo schermo si atterra nel planetario col volo al contrario (`solAtterraNelPlanetario`).
- Tolto il tasto del Sistema Solare in basso a destra sulla mappa (`#skymap-btn-sistema-mappa`).
- Prove: `node scripts/prova-passaggio-zoom.js` (verde). In `prova-volo.js` resta rossa, come prima, «e gli stessi pixel: il velo si apre su un’immagine che era già lì».
