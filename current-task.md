# Niente in corso

Ultimo lavoro: intro comune delle demo e demo delle aurore lunga (v375).

- **Intro comune**: fase del motore prima della prima scena
  (`demo-motore.js`: `contesto.intro`, `inIntro`, `chiudiIntro`), disegno,
  preferenze e logo in `demo-intro.js` (`window.AstroDemoIntro`). Preferenze in
  `astrocal_demo_intro_v1`, logo personale in IndexedDB (`astrocal_demo_intro`).
  Gruppo 4 «Intro delle Demo» nella pagina Demo (i gruppi sono sei).
- **Aurora boreale**: 11 scene, 173 s minimi, dal Sole (planetario) al banco
  delle aurore (vento, nube, scudo, coda, anello, **taglio** coi colori) al
  cielo di Helsinki. `aurora_lesson` accetta `chapter: taglio` con `place` e
  `kp`; `didDemo.taglio()` / `didDemo.luoghi()` in `didattica.js`.
- Prove: nuova `scripts/prova-demo-intro.js` (20); aggiornate
  `prova-demo.js`, `prova-demo-browser.js`, `prova-demo-regia.js`,
  `prova-demo-pagina.js`, `prova-narrazione-browser.js`, `prova-i18n.js`.
  Nelle prove vecchie l'intro è spenta dal localStorage.
- Preesistente, non toccato: in `prova-demo-pagina.js` le due prove della
  «camera a mano» falliscono anche sul codice di partenza in questo ambiente
  (il tocco al centro del cielo apre l'atlante delle costellazioni, che poi
  copre il tasto Avvia della prova del pieno schermo).
- Non provato su un telefono vero (pieno schermo nativo, IndexedDB in
  navigazione privata).
