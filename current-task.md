# Niente in corso

Ultimo lavoro: la narrazione centralizzata per demo e Missione Cielo (v370).

- `narrazione.js`: una voce sola (audio registrato → Edge-TTS/voce del
  dispositivo → solo testo), ID stabili = chiavi del dizionario, manifest in
  `audio/narrazione/manifest.js`, cartelle `demo|missione` × `it|en`,
  service worker che mette in cache gli audio del manifest.
- Demo: azione `narrate` in ogni scena dei cinque tour (`demo.narr.*`), pausa
  e ripresa passate dal motore (`segnala`), Esc/Stop/fine/riavvio chiudono la
  voce con la scena.
- Missione Cielo: `missRacconta` passa dalla narrazione (canale `missione`),
  la sua pipeline Edge/Web Speech privata è stata tolta.
- Impostazioni → Osservazione → Narrazione (attiva, volume, testo, solo TTS,
  prova).
- Prove: `prova-narrazione.js`, `controlla-narrazione.js`,
  `prova-narrazione-browser.js` nuove; `prova-demo*.js`, `prova-i18n.js`,
  `prova-lingua.js`, `prova-guida.js` verdi. `prova-missione.js` nel browser
  ha 6 fallimenti **preesistenti** (guida nella 3D, 640×360), identici prima
  di questo lavoro.
- Nessun audio registrato è ancora nel repository: il manifest è vuoto.
