# Niente in corso

Ultimo lavoro: revisione completa della Galleria (v375).

- Cartella: `videoVerificaCartella` prova a leggere, chiede il solo permesso
  dentro al tocco che apre (una volta per sessione), fa riscegliere solo una
  cartella sparita. Otto stati in `videoStatoCartella`.
- Schede con miniatura (niente più un `<video>` per scheda), miniature
  ricordate in IndexedDB (negozio `anteprime`, DB versione 2).
- Visualizzatore unico `#galleria-visore`: geometria tutta CSS, schermo intero
  sul contenitore, un solo object URL alla volta, tastiera e strisciata.
- Condivisione del `File` vero, con annullamento / errore / non supportata.
- Prove: `scripts/prova-galleria.js` riscritta (44 controlli, file veri).
- Non provato su un telefono vero (permessi persistenti di Chrome Android,
  `webkitEnterFullscreen` su iPhone).
