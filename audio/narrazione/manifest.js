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
 * frase diversa da quella scritta.
 *
 * La stampa:
 * `node scripts/controlla-narrazione.js --impronte`.
 *
 * I percorsi sono relativi a `radice`, senza `..` e senza indirizzi esterni.
 * Il service worker legge questo stesso file (`importScripts`) e mette in
 * cache tutti gli audio elencati all'installazione: da lì valgono offline.
 *
 * È un file `.js` e non `.json` per la stessa ragione dei dizionari: da
 * `file://` una `fetch` di JSON è vietata. Tutto in `LEGGIMI.md`.
 */

(typeof globalThis !== 'undefined' ? globalThis : self).ASTRO_NARRAZIONE_MANIFEST = {
  versione: 1,
  radice: 'audio/narrazione/',

  voci: {

    // ─────────────────────────────────────────────
    // Eclisse solare
    // ─────────────────────────────────────────────

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
    },

    // ─────────────────────────────────────────────
    // Aurora boreale
    // ─────────────────────────────────────────────

    'demo.narr.aurora_boreale.1': {
      it: {
        file: 'demo/it/aurora_boreale-1.mp3',
        impronta: '266fb35a'
      }
    },

    'demo.narr.aurora_boreale.2': {
      it: {
        file: 'demo/it/aurora_boreale-2.mp3',
        impronta: 'cb3bdea7'
      }
    },

    'demo.narr.aurora_boreale.3': {
      it: {
        file: 'demo/it/aurora_boreale-3.mp3',
        impronta: '6ada09b0'
      }
    },

    'demo.narr.aurora_boreale.4': {
      it: {
        file: 'demo/it/aurora_boreale-4.mp3',
        impronta: 'b73cb9eb'
      }
    },

    'demo.narr.aurora_boreale.5': {
      it: {
        file: 'demo/it/aurora_boreale-5.mp3',
        impronta: '65b949f1'
      }
    },

    'demo.narr.aurora_boreale.6': {
      it: {
        file: 'demo/it/aurora_boreale-6.mp3',
        impronta: 'ee428562'
      }
    },

    'demo.narr.aurora_boreale.7': {
      it: {
        file: 'demo/it/aurora_boreale-7.mp3',
        impronta: '33875215'
      }
    },

    'demo.narr.aurora_boreale.8': {
      it: {
        file: 'demo/it/aurora_boreale-8.mp3',
        impronta: '81cf0542'
      }
    },

    'demo.narr.aurora_boreale.9': {
      it: {
        file: 'demo/it/aurora_boreale-9.mp3',
        impronta: 'f0ea0177'
      }
    },

    'demo.narr.aurora_boreale.10': {
      it: {
        file: 'demo/it/aurora_boreale-10.mp3',
        impronta: 'f59c0158'
      }
    },

    'demo.narr.aurora_boreale.11': {
      it: {
        file: 'demo/it/aurora_boreale-11.mp3',
        impronta: '952e92e3'
      }
    },

    // ─────────────────────────────────────────────
    // Allineamento pianeti
    // ─────────────────────────────────────────────

    'demo.narr.allineamento_pianeti.1': {
      it: {
        file: 'demo/it/allineamento_pianeti-1.mp3',
        impronta: '9bd328fc'
      }
    },

    'demo.narr.allineamento_pianeti.2': {
      it: {
        file: 'demo/it/allineamento_pianeti-2.mp3',
        impronta: 'b7e91b75'
      }
    },

    'demo.narr.allineamento_pianeti.3': {
      it: {
        file: 'demo/it/allineamento_pianeti-3.mp3',
        impronta: 'b48144ab'
      }
    },

    'demo.narr.allineamento_pianeti.4': {
      it: {
        file: 'demo/it/allineamento_pianeti-4.mp3',
        impronta: '420a7add'
      }
    },

    'demo.narr.allineamento_pianeti.5': {
      it: {
        file: 'demo/it/allineamento_pianeti-5.mp3',
        impronta: '112713f3'
      }
    },

    'demo.narr.allineamento_pianeti.6': {
      it: {
        file: 'demo/it/allineamento_pianeti-6.mp3',
        impronta: 'd48eb3db'
      }
    },

    'demo.narr.allineamento_pianeti.7': {
      it: {
        file: 'demo/it/allineamento_pianeti-7.mp3',
        impronta: '18785cce'
      }
    },

    'demo.narr.allineamento_pianeti.8': {
      it: {
        file: 'demo/it/allineamento_pianeti-8.mp3',
        impronta: '94d1b0b7'
      }
    },

    'demo.narr.allineamento_pianeti.9': {
      it: {
        file: 'demo/it/allineamento_pianeti-9.mp3',
        impronta: '0d780056'
      }
    },

    'demo.narr.allineamento_pianeti.10': {
      it: {
        file: 'demo/it/allineamento_pianeti-10.mp3',
        impronta: '85abc4a0'
      }
    },
    // ─────────────────────────────────────────────
    // Eclisse lunare
    // ─────────────────────────────────────────────

    'demo.narr.eclisse_lunare.1': {
      it: {
        file: 'demo/it/eclisse_lunare-1.mp3',
        impronta: 'fefb7db6'
      }
    },

    'demo.narr.eclisse_lunare.2': {
      it: {
        file: 'demo/it/eclisse_lunare-2.mp3',
        impronta: '7dc41ed0'
      }
    },

    'demo.narr.eclisse_lunare.3': {
      it: {
        file: 'demo/it/eclisse_lunare-3.mp3',
        impronta: 'f053a9b9'
      }
    },

    'demo.narr.eclisse_lunare.4': {
      it: {
        file: 'demo/it/eclisse_lunare-4.mp3',
        impronta: 'dea93d13'
      }
    },

    'demo.narr.eclisse_lunare.5': {
      it: {
        file: 'demo/it/eclisse_lunare-5.mp3',
        impronta: '2f354ad7'
      }
    },

    'demo.narr.eclisse_lunare.6': {
      it: {
        file: 'demo/it/eclisse_lunare-6.mp3',
        impronta: '99a71851'
      }
    },

    'demo.narr.eclisse_lunare.7': {
      it: {
        file: 'demo/it/eclisse_lunare-7.mp3',
        impronta: '8cf92090'
      }
    },

    'demo.narr.eclisse_lunare.8': {
      it: {
        file: 'demo/it/eclisse_lunare-8.mp3',
        impronta: 'bd68ccca'
      }
    },

    'demo.narr.eclisse_lunare.9': {
      it: {
        file: 'demo/it/eclisse_lunare-9.mp3',
        impronta: 'e638911c'
      }
    },

    'demo.narr.eclisse_lunare.10': {
      it: {
        file: 'demo/it/eclisse_lunare-10.mp3',
        impronta: '77ae456e'
      }
    }
  }
};