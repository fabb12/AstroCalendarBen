# Niente in corso

Ultimo lavoro: l'**aggregatore ADS-B multi-fonte** (`aerei.js`, v384).

- Facciata `FontiAerei.acquisisci` (§3-quinquies): il motore non conosce le porte.
- Record normalizzati (`normalizzaLettura`) e fusi (`fondiLetture`: ICAO →
  registrazione → volo, vince la lettura più recente); raccolta delle porte già
  in volo per `FUSIONE_ATTESA_MS` dopo la prima risposta.
- Circuito per porta (`statoCircuito`), cache delle risposte e richieste gemelle
  (§3-bis), zeri sospetti (`segnaVuoto`, `vuotoIncerto`), età di ogni aereo
  (`qualitaDi`, `potaStantii`, `etaMassimaMs`), ritmo 25 s e freno dopo un 429,
  rientro immediato in primo piano (`aereiRientro`).
- OpenSky anonimo diretto come riserva in coda (passo minimo 90 s; se il browser
  lo rifiuta, penale di 12 h). Si spegne con `ADSB_OPENSKY_DIRETTO = false`.
- Worker: ADS-B Exchange facoltativo (`ADSBX_API_KEY`), `/api/fonti`,
  intestazione `X-ADSB-Fonte`.
- Pannello Aerei: sezione chiusa «Fonti dei dati».
- Prove: `node scripts/prova-adsb.js` (24 scenari, senza rete).
- Preesistenti, non toccati: 6 rosse in `verifica.html` (acqua, camera, visione),
  3 in `prova-nel-browser.js`, 2 in `prova-transiti.js`, 3 in `prova-fumetto.js`
  — identiche prima e dopo questa modifica.
