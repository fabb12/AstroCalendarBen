# Niente in corso

Ultimo lavoro: tre demo più lunghe e più raccontate (v376).

- **Eclisse lunare** (10 scene, 178 s), **Corteo dei pianeti** (10, 173 s),
  **Passaggio della ISS** (6, 104 s): scene e testi in `demo-predefiniti.js` e
  `demo.narr.*` dei due dizionari; tabella e note in `DEMO.md`.
- `satellite_pass` accetta `from`/`to` (frazioni della finestra) e `track`
  (inseguimento a campo stretto); `set_fov`/`zoom_fov` scendono a 0,25°; con la
  vista pulita il mirino non si disegna (`skyDisegna` in `app.js`).
- Prove aggiornate agli indici nuovi: `prova-demo-regia.js` (72, con verifiche
  nuove su totalità a campo largo, primi piani, ISS inseguita, mezz'ora di
  orbita), `prova-demo-browser.js`, `prova-narrazione-browser.js`.
- Preesistente, non toccato: in `prova-demo-intro.js` fallisce «aurore: la
  narrazione non si taglia» anche sul codice di partenza; `prova-demo-pagina.js`
  e la registrazione in `prova-demo-regia.js` sono a volte instabili.
- Nessun MP3 registrato per le tre demo: parla la sintesi.
