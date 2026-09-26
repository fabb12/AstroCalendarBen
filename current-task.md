# Niente in corso

Ultimo lavoro: la demo dell'**eclisse di Sole** (`eclisse_tour`, v383).

- Mappa del cono d'ombra: i continenti non comparivano durante la demo (la regia
  rifaceva `setView` a ogni passo e Leaflet buttava le tessere). Cura in
  `_eclRegiaSposta` (`app.js`), prova con tessere lente in `prova-demo-regia.js`.
- 3D: scena 8 (-62 → -46,2) il cono che arriva, scena 9 (-46 → +47,3) addosso alla
  Terra con l'ombra dall'inizio alla fine; `solDisegnaOmbraDellaLuna` ha il segno
  minimo della totalità e la strada della totalità (`solStradaTotalita`).
- Testi `demo.narr.eclisse_tour.1–11` riscritti (it/en), descrizione aggiornata.
- Preesistente, non toccato: in `prova-demo-pagina.js` fallisce «planetario:
  trascinare prende la camera…» anche sul codice di partenza.
