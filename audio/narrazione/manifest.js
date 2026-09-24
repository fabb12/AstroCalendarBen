/* Il manifest degli audio registrati della narrazione.
 *
 * Una voce per contenuto: la chiave è l'ID stabile (quasi sempre la chiave
 * del dizionario da cui viene il testo), e dentro, per lingua, il file.
 * Chi non ha un audio non va scritto qui: la narrazione ripiega da sola
 * sulla sintesi vocale e, se manca anche quella, sul solo testo.
 *
 *   'demo.narr.eclisse_tour.1': {
 *     it: 'demo/it/eclisse_tour-1.mp3',
 *     en: { file: 'demo/en/eclisse_tour-1.mp3', impronta: '1a2b3c4d' }
 *   },
 *
 * Le due forme valgono uguale. L'`impronta` è facoltativa ma conviene: è
 * l'impronta del testo da cui l'audio è stato registrato, e se il testo del
 * dizionario cambia l'audio vecchio smette di suonare invece di dire una
 * frase diversa da quella scritta. La stampa
 * `node scripts/controlla-narrazione.js --impronte`.
 *
 * I percorsi sono relativi a `radice`, senza `..` e senza indirizzi esterni.
 * Il service worker legge questo stesso file (`importScripts`) e mette in
 * cache tutti gli audio elencati all'installazione: da lì valgono offline.
 *
 * È un file `.js` e non `.json` per la stessa ragione dei dizionari: da
 * `file://` una `fetch` di JSON è vietata. Tutto in `LEGGIMI.md`. */
(typeof globalThis !== 'undefined' ? globalThis : self).ASTRO_NARRAZIONE_MANIFEST = {
  versione: 1,
  radice: 'audio/narrazione/',

  voci: {
    'demo.narr.eclisse_tour.1': {
      it: {
        file: 'demo/it/eclisse_tour-1.mp3',
        impronta: 'adf70808'
      }
    },

    'demo.narr.eclisse_tour.2': {
      it: {
        file: 'demo/it/eclisse_tour-2.mp3',
        impronta: 'ae619c16'
      }
    },

    'demo.narr.eclisse_tour.3': {
      it: {
        file: 'demo/it/eclisse_tour-3.mp3',
        impronta: 'de80ca48'
      }
    },

    'demo.narr.eclisse_tour.4': {
      it: {
        file: 'demo/it/eclisse_tour-4.mp3',
        impronta: 'd24013d9'
      }
    },

    'demo.narr.eclisse_tour.5': {
      it: {
        file: 'demo/it/eclisse_tour-5.mp3',
        impronta: '8f4fa193'
      }
    },

    'demo.narr.eclisse_tour.6': {
      it: {
        file: 'demo/it/eclisse_tour-6.mp3',
        impronta: '59cb2e0a'
      }
    },

    'demo.narr.eclisse_tour.7': {
      it: {
        file: 'demo/it/eclisse_tour-7.mp3',
        impronta: '36f94c0f'
      }
    }
  }
};