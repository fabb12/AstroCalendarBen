# Niente in corso

Ultimo lavoro: la demo dell'eclisse di Sole riscritta, con la mappa del cono
d'ombra (v377).

- **Eclisse solare** (11 scene, 180 s): scene in `demo-predefiniti.js`, testi
  `demo.narr.eclisse_tour.1–11` nei due dizionari; tabella e note in `DEMO.md`
  (§«L'eclisse di Sole della v377»).
- Scena nuova `eclipse_map` e azione `shadow_map` (`demo.js`), regia della mappa
  in `app.js` (`eclRegiaApri`/`eclRegiaPosa`/`eclRegiaChiudi`), stili
  `.ecl-regia` in `style.css`, frammento nell'editor (`demo-impostazioni.js`).
- I sette MP3 della versione di prima sono usciti dal manifest (il testo è
  cambiato); i file restano in `audio/narrazione/demo/it/`. Parla la sintesi
  finché non si registrano le undici frasi nuove.
- Il workflow `verifica-demo.yml` installa anche `leaflet@1.9.4`, che le prove
  della regia e della pagina servono da `node_modules`.
- Preesistente, non toccato: in `prova-demo-intro.js` fallisce «aurore: la
  narrazione non si taglia» anche sul codice di partenza; la registrazione in
  `prova-demo-regia.js` è a volte instabile.
