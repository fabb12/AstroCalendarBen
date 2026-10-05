# Niente in corso

Ultimo lavoro (v411): i personaggi delle Storie cosmiche e lo Studio (`STORIE.md`, §Lei e lui, §I corpi, §Lo Studio).

- Gli occhi sono l'apertura fra le palpebre (`storAperturaOcchio`): niente più palpebre color pelle «a occhiali» né la virgola scura in cima all'iride che da lontano sembrava una seconda pupilla (era il tratto della palpebra a occhio spalancato, più la crocetta accanto al riflesso). Espressioni più marcate e tre nuove: `laughing`, `love`, `angry`.
- Lei e lui (`genere`): ciglia lunghe, sopracciglia sottili, labbra (e l'ombretto a Venere) per lei; sopracciglia folte, baffi e barba per lui (Giove barba bianca, Saturno baffi a manubrio, Nettuno barba a onde, Marte pizzetto, il Sole baffi folti).
- I corpi (`sagoma`, `disegnaCorpo`): la Voyager è una sonda con la parabola, la ISS/Tiangong/Hubble hanno i loro pannelli, gli asteroidi sono sassi, le comete hanno chioma e coda, i pianeti il loro disegno. Nel planetario il corpo sta sull'astro (accanto col filo solo se lì non c'entra); nella 3D sonde e stazioni hanno il corpo disegnato, e `storInScena` fa disegnare a `solDisegna` una sonda o un mondo minore spenti se sono in scena.
- Lo Studio a figurine: idee come schede, personaggi come figurine, chi parla e la faccia si toccano, azioni come etichette, «Scrivi a parole» in ogni scena, inquadratura e data chiuse, controllo in una riga.
- Prove: `prova-storie.js` (53), `prova-storie-browser.js` (57), `prova-demo-pagina.js` (22), `prova-demo.js`, `prova-guida.js`, `prova-lingua.js`, `prova-i18n.js`, `controlla-i18n.js --patto`.
- Già rotta prima di questo lavoro (non toccata): `prova-sistema3d.js` si ferma a «si toccano, si trovano…» con `ReferenceError: SOL_LUNE is not defined`, identica sul codice di prima.
