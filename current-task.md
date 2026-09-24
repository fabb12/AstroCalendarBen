# Niente in corso

Ultimo lavoro: la realtà aumentata nomina invece di ridisegnare, e si può
allineare a mano (v371).

- `visione.js` §12: con la fotocamera accesa Sole, Luna, pianeti, stelle e
  stazioni non si ridisegnano; segno sottile + nome per astri, stelle del
  catalogo, aerei (se lo strato di `aerei.js` è spento), vette e paesi, solo
  se davvero visibili da qui; impaginazione pura `visImpaginaEtichette`.
- `visione.js` §13: allineamento a mano (tasto `#ar-allinea`, pannello
  `#ar-calibra`): scegli l'oggetto, tocca dove lo vedi; rotazione del mondo
  (1 punto = rotazione minima, 2+ = Wahba col rollio), aerei su ancora o
  assetto, riconoscimento automatico tenuto a bada, annulla/rifai.
- Ganci: `aereoCieloOra` in `aerei.js`, `insScordaTraccia` in
  `inseguimento.js`, `etichetteAR`/`SKY_AR_SOLO_NOME` in `app.js`.
- Prove nuove: `prova-ar-calibrazione.js` (27) e `prova-ar-browser.js`
  (tre schermi), verdi e in CI. `prova-inseguimento.js`, `prova-i18n.js`,
  `controlla-i18n.js --patto`, `controlla-collisioni.js` verdi;
  `prova-verifica.js` ha 6 rosse **preesistenti**, identiche senza modifiche.
- Non provato su un telefono vero (sensori e fotocamera reali).
