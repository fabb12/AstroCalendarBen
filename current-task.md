# Niente in corso

Ultimo lavoro (v414): la vita delle stelle nelle Storie cosmiche (`STORIE.md`, §La vita delle stelle).

- Sagome nuove (`storie-cosmiche.js` §6-quater): `gigante_rossa`, `nana_bianca`, `supernova`, `buco_nero`, `buco_bianco`; famiglia `buco`.
- Personaggi: Betelgeuse (`Star7`, anche nel planetario; nella carta al `luogo` `betelgeuse`), la supernova del Granchio (`supernova`, a `crab_nebula`), Sirio B (`sirius_b`), Sagittario A* (`sgr_a`), il buco bianco (`white_hole`, `cosmo: 'idea'`: galleggia davanti alla carta, non viaggia e non si raggiunge, `demo.err.ideaFerma`). I luoghi nuovi sono in `COSM_LUOGHI_STORIE` (`scala-cosmica.js`), senza paletto disegnato.
- `character_become { target, shape }` (`STOR_VESTI`: `red_giant`, `white_dwarf`, `supernova`, `black_hole`, `self`): un personaggio diventa un'altra cosa col suo volto. Nello Studio è l'azione «Diventa…», anche a parole; modello nuovo «Che cos'è un buco nero?» (`buchi`). Snippet nell'editor.
- La storia «Che fine fanno le stelle?» (`storia_stelle`, 24 scene, 278 s, voce di sintesi): da Orione (Roma, 13/12/2026 alle 22) alla scala cosmica e ritorno.
- Corretto: nella scala cosmica chi è fuori dal quadro porta sempre il suo corpo (il Sole appena partiti dalla Terra era un occhio gigante sul bordo, anche nella «macchina del tempo»).
- Prove: `prova-storie.js` (62), `prova-storie-browser.js` (65), `prova-demo.js`, `prova-demo-pagina.js` (22), `prova-scala-cosmica.js` (155), `prova-guida.js`, `prova-lingua.js`, `prova-i18n.js`, `controlla-i18n.js --patto`. `scripts/giro-storia.js` fa girare una storia intera con le schermate in `work/` (non è una prova: serve a guardarla).
- `prova-demo-browser.js`: l'elenco delle demo predefinite e delle durate non conosceva ancora `storia_tempo` (v413): aggiornato con le due storie. Si ferma comunque più avanti, a «La demo lascia invariato lo stato dello schermo intero», identica sul codice di prima (non toccata).
- Già rotta prima (v411, non toccata): `prova-sistema3d.js` con `SOL_LUNE is not defined`.
