# Niente in corso

Ultimo lavoro: la demo **Solstizi ed equinozi** (`solstizi_equinozi`, v382).

- 16 scene, 292 s, in `demo-predefiniti.js`; testi `demo.narr.solstizi_equinozi.1–16`
  e cartelli `demo.cartello.*` nei due dizionari; tabella e note in `DEMO.md`
  (§«La demo delle stagioni della v382»), righe nella guida (cap. 10, IT e EN).
- Azioni nuove in `demo.js`: `date_card`, `date_range`, `earth_axis`, `sun_paths`,
  `track_azimuth`, `sun_az` di `camera_3d`, e i quattro eventi delle stagioni in
  `event_window`. Disegni in `app.js`: `solDisegnaAsseTerra` e `skyDisegnaArchiSole`.
- Prova nuova: `scripts/prova-demo-stagioni.js` (anche `STAGIONI_TELEFONO=1`), aggiunta
  al workflow `verifica-demo.yml`.
- Nessun MP3 registrato per le sedici frasi: parla la sintesi.
- Preesistente, non toccato: in `prova-demo-intro.js` fallisce «aurore: la narrazione
  non si taglia» anche sul codice di partenza.
