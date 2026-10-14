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

    // L'eclisse solare (eclisse_tour) è stata riscritta nella v377: i sette
    // audio registrati per il testo di prima restano in demo/it/ ma non si
    // suonano più — l'impronta non tornerebbe. Finché non si registrano le
    // undici frasi nuove, la demo parla con la sintesi vocale.

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
    },
    // ─────────────────────────────────────────────
    // Eclisse solare
    // ─────────────────────────────────────────────

    'demo.narr.eclisse_tour.1': {
      it: {
        file: 'demo/it/eclisse_tour-1.mp3',
        impronta: 'd42f16a9'
      }
    },

    'demo.narr.eclisse_tour.2': {
      it: {
        file: 'demo/it/eclisse_tour-2.mp3',
        impronta: '3a8fe512'
      }
    },

    'demo.narr.eclisse_tour.3': {
      it: {
        file: 'demo/it/eclisse_tour-3.mp3',
        impronta: '975394e9'
      }
    },

    'demo.narr.eclisse_tour.4': {
      it: {
        file: 'demo/it/eclisse_tour-4.mp3',
        impronta: '67aa285f'
      }
    },

    'demo.narr.eclisse_tour.5': {
      it: {
        file: 'demo/it/eclisse_tour-5.mp3',
        impronta: '232bb222'
      }
    },

    'demo.narr.eclisse_tour.6': {
      it: {
        file: 'demo/it/eclisse_tour-6.mp3',
        impronta: '60a67ae1'
      }
    },

    'demo.narr.eclisse_tour.7': {
      it: {
        file: 'demo/it/eclisse_tour-7.mp3',
        impronta: 'f569dedc'
      }
    },

    'demo.narr.eclisse_tour.8': {
      it: {
        file: 'demo/it/eclisse_tour-8.mp3',
        impronta: '342659c5'
      }
    },

    'demo.narr.eclisse_tour.9': {
      it: {
        file: 'demo/it/eclisse_tour-9.mp3',
        impronta: '8bf63ecb'
      }
    },

    'demo.narr.eclisse_tour.10': {
      it: {
        file: 'demo/it/eclisse_tour-10.mp3',
        impronta: 'fa277e08'
      }
    },

    'demo.narr.eclisse_tour.11': {
      it: {
        file: 'demo/it/eclisse_tour-11.mp3',
        impronta: '994e6fd3'
      }
    },
    // ─────────────────────────────────────────────
    // Solstizi ed equinozi
    // ─────────────────────────────────────────────

    'demo.narr.solstizi_equinozi.1': {
      it: {
        file: 'demo/it/solstizi_equinozi-1.mp3',
        impronta: 'a5f6d8dd'
      }
    },

    'demo.narr.solstizi_equinozi.2': {
      it: {
        file: 'demo/it/solstizi_equinozi-2.mp3',
        impronta: 'd0386bb1'
      }
    },

    'demo.narr.solstizi_equinozi.3': {
      it: {
        file: 'demo/it/solstizi_equinozi-3.mp3',
        impronta: 'f022bde6'
      }
    },

    'demo.narr.solstizi_equinozi.4': {
      it: {
        file: 'demo/it/solstizi_equinozi-4.mp3',
        impronta: '4d78f3a4'
      }
    },

    'demo.narr.solstizi_equinozi.5': {
      it: {
        file: 'demo/it/solstizi_equinozi-5.mp3',
        impronta: 'baa20c13'
      }
    },

    'demo.narr.solstizi_equinozi.6': {
      it: {
        file: 'demo/it/solstizi_equinozi-6.mp3',
        impronta: 'a2d3912f'
      }
    },

    'demo.narr.solstizi_equinozi.7': {
      it: {
        file: 'demo/it/solstizi_equinozi-7.mp3',
        impronta: '72d967b9'
      }
    },

    'demo.narr.solstizi_equinozi.8': {
      it: {
        file: 'demo/it/solstizi_equinozi-8.mp3',
        impronta: 'b2d79f37'
      }
    },

    'demo.narr.solstizi_equinozi.9': {
      it: {
        file: 'demo/it/solstizi_equinozi-9.mp3',
        impronta: '1c924174'
      }
    },

    'demo.narr.solstizi_equinozi.10': {
      it: {
        file: 'demo/it/solstizi_equinozi-10.mp3',
        impronta: 'c902f95b'
      }
    },

    'demo.narr.solstizi_equinozi.11': {
      it: {
        file: 'demo/it/solstizi_equinozi-11.mp3',
        impronta: 'a45d548d'
      }
    },

    'demo.narr.solstizi_equinozi.12': {
      it: {
        file: 'demo/it/solstizi_equinozi-12.mp3',
        impronta: 'dbeedc9f'
      }
    },

    'demo.narr.solstizi_equinozi.13': {
      it: {
        file: 'demo/it/solstizi_equinozi-13.mp3',
        impronta: 'd480bbd2'
      }
    },

    'demo.narr.solstizi_equinozi.14': {
      it: {
        file: 'demo/it/solstizi_equinozi-14.mp3',
        impronta: '0b03195f'
      }
    },

    'demo.narr.solstizi_equinozi.15': {
      it: {
        file: 'demo/it/solstizi_equinozi-15.mp3',
        impronta: '480934c4'
      }
    },

    'demo.narr.solstizi_equinozi.16': {
      it: {
        file: 'demo/it/solstizi_equinozi-16.mp3',
        impronta: '3a7878b7'
      }
    },
    // ─────────────────────────────────────────────
    // Voyager
    // ─────────────────────────────────────────────

    'demo.narr.voyager.1': {
      it: {
        file: 'demo/it/voyager-1.mp3',
        impronta: '3e952e1b'
      }
    },

    'demo.narr.voyager.2': {
      it: {
        file: 'demo/it/voyager-2.mp3',
        impronta: 'dbc9638f'
      }
    },

    'demo.narr.voyager.3': {
      it: {
        file: 'demo/it/voyager-3.mp3',
        impronta: '791775b0'
      }
    },

    'demo.narr.voyager.4': {
      it: {
        file: 'demo/it/voyager-4.mp3',
        impronta: 'fde086e7'
      }
    },

    'demo.narr.voyager.5': {
      it: {
        file: 'demo/it/voyager-5.mp3',
        impronta: 'a2df3650'
      }
    },

    'demo.narr.voyager.6': {
      it: {
        file: 'demo/it/voyager-6.mp3',
        impronta: 'db566e6d'
      }
    },

    'demo.narr.voyager.7': {
      it: {
        file: 'demo/it/voyager-7.mp3',
        impronta: 'a0767ead'
      }
    },

    'demo.narr.voyager.8': {
      it: {
        file: 'demo/it/voyager-8.mp3',
        impronta: '32e5ff23'
      }
    },

    'demo.narr.voyager.9': {
      it: {
        file: 'demo/it/voyager-9.mp3',
        impronta: 'f1ad9cf3'
      }
    },

    'demo.narr.voyager.10': {
      it: {
        file: 'demo/it/voyager-10.mp3',
        impronta: 'faaa7d92'
      }
    },

    'demo.narr.voyager.11': {
      it: {
        file: 'demo/it/voyager-11.mp3',
        impronta: '355715bb'
      }
    },

    'demo.narr.voyager.12': {
      it: {
        file: 'demo/it/voyager-12.mp3',
        impronta: '72f153d6'
      }
    },

    'demo.narr.voyager.13': {
      it: {
        file: 'demo/it/voyager-13.mp3',
        impronta: '25f92a9a'
      }
    },

    'demo.narr.voyager.14': {
      it: {
        file: 'demo/it/voyager-14.mp3',
        impronta: '64191e28'
      }
    },

    'demo.narr.voyager.15': {
      it: {
        file: 'demo/it/voyager-15.mp3',
        impronta: 'e3a4cea9'
      }
    },
    // ─────────────────────────────────────────────
    // Universo
    // ─────────────────────────────────────────────

    'demo.narr.universo.1': {
      it: {
        file: 'demo/it/universo-1.mp3',
        impronta: '9dc4a4aa'
      }
    },

    'demo.narr.universo.2': {
      it: {
        file: 'demo/it/universo-2.mp3',
        impronta: '52d057ea'
      }
    },

    'demo.narr.universo.3': {
      it: {
        file: 'demo/it/universo-3.mp3',
        impronta: 'f928dad2'
      }
    },

    'demo.narr.universo.4': {
      it: {
        file: 'demo/it/universo-4.mp3',
        impronta: '688f8b5a'
      }
    },

    'demo.narr.universo.5': {
      it: {
        file: 'demo/it/universo-5.mp3',
        impronta: '94580f19'
      }
    },

    'demo.narr.universo.6': {
      it: {
        file: 'demo/it/universo-6.mp3',
        impronta: '89a174e6'
      }
    },

    'demo.narr.universo.7': {
      it: {
        file: 'demo/it/universo-7.mp3',
        impronta: '3b755964'
      }
    },

    'demo.narr.universo.8': {
      it: {
        file: 'demo/it/universo-8.mp3',
        impronta: '2870a48b'
      }
    },

    'demo.narr.universo.9': {
      it: {
        file: 'demo/it/universo-9.mp3',
        impronta: 'f36c15b8'
      }
    },

    'demo.narr.universo.10': {
      it: {
        file: 'demo/it/universo-10.mp3',
        impronta: 'da6cbb3c'
      }
    },

    'demo.narr.universo.11': {
      it: {
        file: 'demo/it/universo-11.mp3',
        impronta: 'ec9b7574'
      }
    },

    'demo.narr.universo.12': {
      it: {
        file: 'demo/it/universo-12.mp3',
        impronta: '5489f0c3'
      }
    },

    'demo.narr.universo.13': {
      it: {
        file: 'demo/it/universo-13.mp3',
        impronta: 'c4e03262'
      }
    },

    'demo.narr.universo.14': {
      it: {
        file: 'demo/it/universo-14.mp3',
        impronta: '287121b9'
      }
    },

    'demo.narr.universo.15': {
      it: {
        file: 'demo/it/universo-15.mp3',
        impronta: '27b5ae3d'
      }
    },

    'demo.narr.universo.16': {
      it: {
        file: 'demo/it/universo-16.mp3',
        impronta: '9555cd42'
      }
    },

    'demo.narr.universo.17': {
      it: {
        file: 'demo/it/universo-17.mp3',
        impronta: 'daa13138'
      }
    },
    // Le battute delle Storie cosmiche: una cartella per personaggio,
    // storie/<nome>/<lingua>/. Non si scrivono a mano: le aggiunge
    // `node scripts/voci-storie.js` leggendo le cartelle (LEGGIMI.md).
    // ── INIZIO STORIE COSMICHE: da qui a FINE lo scrive scripts/voci-storie.js, non toccare ──

    // Luna — storie/luna/
    'demo.narr.storia_luna.1': {
      it: { file: 'storie/luna/it/storia_luna-1.mp3', impronta: 'dd32df5a', firma: '924b2b32b8' }
    },

    'demo.narr.storia_luna.2': {
      it: { file: 'storie/luna/it/storia_luna-2.mp3', impronta: '266de7ec', firma: '3ede855254' }
    },

    'demo.narr.storia_luna.5': {
      it: { file: 'storie/luna/it/storia_luna-5.mp3', impronta: 'e75019b0', firma: 'a1c9c657a7' }
    },

    'demo.narr.storia_luna.8': {
      it: { file: 'storie/luna/it/storia_luna-8.mp3', impronta: '0f693c1b', firma: '1d5082a5f8' }
    },

    'studio.studio_cosa_e_la_gravita.2': {
      it: { file: 'storie/luna/it/studio_cosa_e_la_gravita-2.mp3', impronta: 'be7e5c66', firma: 'd7f88ec9ee', testo: "Ciao Terra, mi chiedevo, perché orbito intorno a te?" }
    },

    'studio.studio_cosa_e_la_gravita.1': {
      it: { file: 'storie/luna/it/studio_cosa_e_la_gravita-1.mp3', impronta: '64994de1', firma: '313954399e', testo: "Smettila!!!" }
    },

    // Terra — storie/terra/
    'demo.narr.storia_luna.3': {
      it: { file: 'storie/terra/it/storia_luna-3.mp3', impronta: 'dab87ab6', firma: '6a2a22e7e2' }
    },

    'demo.narr.storia_luna.4': {
      it: { file: 'storie/terra/it/storia_luna-4.mp3', impronta: 'cf7acecd', firma: 'bd7ab53174' }
    },

    'demo.narr.storia_luna.7': {
      it: { file: 'storie/terra/it/storia_luna-7.mp3', impronta: '866c6b03', firma: 'a67f8c3f95' }
    },

    'studio.studio_cosa_e_la_gravita.4': {
      it: { file: 'storie/terra/it/studio_cosa_e_la_gravita-4.mp3', impronta: 'b1ad1131', firma: '3275b71661', testo: "Sei solo una luna!!" }
    },

    'studio.studio_cosa_e_la_gravita.5': {
      it: { file: 'storie/terra/it/studio_cosa_e_la_gravita-5.mp3', impronta: 'd98309bb', firma: 'c7187f3542', testo: "ah ah ah!!!" }
    },

    'studio.studio_cosa_e_la_gravita.6': {
      it: { file: 'storie/terra/it/studio_cosa_e_la_gravita-6.mp3', impronta: 'bb51ba43', firma: '9c9b19f77f', testo: "oh no! adesso cosa faccio?" }
    },

    // Sole — storie/sole/
    'demo.narr.storia_luna.6': {
      it: { file: 'storie/sole/it/storia_luna-6.mp3', impronta: '1c864e11', firma: 'a395b7f118' }
    },

    // Gargantua — storie/gargantua/
    'demo.narr.storia_interstellar.13': {
      it: { file: 'storie/gargantua/it/storia_interstellar-13.mp3', impronta: '4eac0c39', firma: '83bcfeecf0' }
    },

    'demo.narr.storia_interstellar.49': {
      it: { file: 'storie/gargantua/it/storia_interstellar-49.mp3', impronta: '39913ce6', firma: '3d28281165' }
    },

    // Cooper — storie/cooper/
    'demo.narr.storia_interstellar.1': {
      it: { file: 'storie/cooper/it/storia_interstellar-1.mp3', impronta: '13a8e771', firma: '5678d73604' }
    },

    'demo.narr.storia_interstellar.9': {
      it: { file: 'storie/cooper/it/storia_interstellar-9.mp3', impronta: 'b117017b', firma: '65855a1570' }
    },

    'demo.narr.storia_interstellar.12': {
      it: { file: 'storie/cooper/it/storia_interstellar-12.mp3', impronta: 'dc41a5cf', firma: '72ee18606f' }
    },

    'demo.narr.storia_interstellar.19': {
      it: { file: 'storie/cooper/it/storia_interstellar-19.mp3', impronta: '66039458', firma: '021e7459a0' }
    },

    'demo.narr.storia_interstellar.24': {
      it: { file: 'storie/cooper/it/storia_interstellar-24.mp3', impronta: '0b7dd8a1', firma: '3284dcdf95' }
    },

    'demo.narr.storia_interstellar.27': {
      it: { file: 'storie/cooper/it/storia_interstellar-27.mp3', impronta: '4b900949', firma: '7b68762117' }
    },

    'demo.narr.storia_interstellar.31': {
      it: { file: 'storie/cooper/it/storia_interstellar-31.mp3', impronta: '62469d56', firma: '095ef48478' }
    },

    'demo.narr.storia_interstellar.33': {
      it: { file: 'storie/cooper/it/storia_interstellar-33.mp3', impronta: '804ce14d', firma: 'fde3e9cdec' }
    },

    'demo.narr.storia_interstellar.40': {
      it: { file: 'storie/cooper/it/storia_interstellar-40.mp3', impronta: '6523d68f', firma: 'fcad34e09c' }
    },

    'demo.narr.storia_interstellar.43': {
      it: { file: 'storie/cooper/it/storia_interstellar-43.mp3', impronta: '8dd37378', firma: '00d5a397d1' }
    },

    'demo.narr.storia_interstellar.44': {
      it: { file: 'storie/cooper/it/storia_interstellar-44.mp3', impronta: 'a4c80dc8', firma: '0ca5ed1ec7' }
    },

    'demo.narr.storia_interstellar.45': {
      it: { file: 'storie/cooper/it/storia_interstellar-45.mp3', impronta: 'de670d0a', firma: '0822da5691' }
    },

    'demo.narr.storia_interstellar.50': {
      it: { file: 'storie/cooper/it/storia_interstellar-50.mp3', impronta: '724f5881', firma: '176f8f849a' }
    },

    // Romilly — storie/romilly/
    'demo.narr.storia_interstellar.2': {
      it: { file: 'storie/romilly/it/storia_interstellar-2.mp3', impronta: '7b7034bf', firma: '4656f24467' }
    },

    'demo.narr.storia_interstellar.4': {
      it: { file: 'storie/romilly/it/storia_interstellar-4.mp3', impronta: 'bd46ab41', firma: 'ce5403a78e' }
    },

    'demo.narr.storia_interstellar.18': {
      it: { file: 'storie/romilly/it/storia_interstellar-18.mp3', impronta: '3ebf2c65', firma: '4264c86ae4' }
    },

    'demo.narr.storia_interstellar.28': {
      it: { file: 'storie/romilly/it/storia_interstellar-28.mp3', impronta: '68409eef', firma: '1d8c773493' }
    },

    // Amelia Brand — storie/amelia-brand/
    'demo.narr.storia_interstellar.3': {
      it: { file: 'storie/amelia-brand/it/storia_interstellar-3.mp3', impronta: 'ae5e8dcc', firma: 'f7612986ab' }
    },

    'demo.narr.storia_interstellar.10': {
      it: { file: 'storie/amelia-brand/it/storia_interstellar-10.mp3', impronta: '3c8d5245', firma: 'c9bd495a19' }
    },

    'demo.narr.storia_interstellar.15': {
      it: { file: 'storie/amelia-brand/it/storia_interstellar-15.mp3', impronta: 'b04d4568', firma: '9a19e4d91d' }
    },

    'demo.narr.storia_interstellar.23': {
      it: { file: 'storie/amelia-brand/it/storia_interstellar-23.mp3', impronta: '1665cc11', firma: '036af1ab3c' }
    },

    'demo.narr.storia_interstellar.29': {
      it: { file: 'storie/amelia-brand/it/storia_interstellar-29.mp3', impronta: '60fcbff0', firma: '32a0fa30c9' }
    },

    'demo.narr.storia_interstellar.32': {
      it: { file: 'storie/amelia-brand/it/storia_interstellar-32.mp3', impronta: '0351a0fa', firma: '8e21fda16d' }
    },

    'demo.narr.storia_interstellar.42': {
      it: { file: 'storie/amelia-brand/it/storia_interstellar-42.mp3', impronta: '1e72b05c', firma: 'dfa7637d8e' }
    },

    'demo.narr.storia_interstellar.46': {
      it: { file: 'storie/amelia-brand/it/storia_interstellar-46.mp3', impronta: 'b12c2219', firma: '68d1aa704d' }
    },

    'demo.narr.storia_interstellar.48': {
      it: { file: 'storie/amelia-brand/it/storia_interstellar-48.mp3', impronta: 'fca4228c', firma: '89bc6072a1' }
    },

    // TARS — storie/tars/
    'demo.narr.storia_interstellar.8': {
      it: { file: 'storie/tars/it/storia_interstellar-8.mp3', impronta: 'eddd2d91', firma: '060c289f52' }
    },

    'demo.narr.storia_interstellar.37': {
      it: { file: 'storie/tars/it/storia_interstellar-37.mp3', impronta: '21871271', firma: '9f57e5cf7e' }
    },

    'demo.narr.storia_interstellar.41': {
      it: { file: 'storie/tars/it/storia_interstellar-41.mp3', impronta: 'b7c56627', firma: 'bd52b4d798' }
    },

    'demo.narr.storia_interstellar.47': {
      it: { file: 'storie/tars/it/storia_interstellar-47.mp3', impronta: '04829db5', firma: '7a52e040b0' }
    },

    // Doyle — storie/doyle/
    'demo.narr.storia_interstellar.11': {
      it: { file: 'storie/doyle/it/storia_interstellar-11.mp3', impronta: '406f0d1d', firma: '1c4bbaa957' }
    },

    'demo.narr.storia_interstellar.25': {
      it: { file: 'storie/doyle/it/storia_interstellar-25.mp3', impronta: '208d630f', firma: '2e3cdef6cc' }
    },

    // Pianeta di Miller — storie/pianeta-di-miller/
    'demo.narr.storia_interstellar.20': {
      it: { file: 'storie/pianeta-di-miller/it/storia_interstellar-20.mp3', impronta: '486c5e18', firma: 'a1f9cc8353' }
    },

    // CASE — storie/case/
    'demo.narr.storia_interstellar.26': {
      it: { file: 'storie/case/it/storia_interstellar-26.mp3', impronta: 'eae828aa', firma: '79eb8ba85c' }
    },

    'demo.narr.storia_interstellar.39': {
      it: { file: 'storie/case/it/storia_interstellar-39.mp3', impronta: 'e6ebb76e', firma: '49e1b6829b' }
    },

    // Murph — storie/murph/
    'demo.narr.storia_interstellar.30': {
      it: { file: 'storie/murph/it/storia_interstellar-30.mp3', impronta: '664fb937', firma: 'f1f7f508ec' }
    },

    // Pianeta di Mann — storie/pianeta-di-mann/
    'demo.narr.storia_interstellar.34': {
      it: { file: 'storie/pianeta-di-mann/it/storia_interstellar-34.mp3', impronta: 'bb3bd17c', firma: '5950327b06' }
    },

    // Dottor Mann — storie/dottor-mann/
    'demo.narr.storia_interstellar.35': {
      it: { file: 'storie/dottor-mann/it/storia_interstellar-35.mp3', impronta: 'be0cabb1', firma: 'c3c516eb90' }
    },

    'demo.narr.storia_interstellar.36': {
      it: { file: 'storie/dottor-mann/it/storia_interstellar-36.mp3', impronta: 'f96072eb', firma: '7fd78df1c0' }
    },

    'demo.narr.storia_interstellar.38': {
      it: { file: 'storie/dottor-mann/it/storia_interstellar-38.mp3', impronta: '6149c9ed', firma: '57bf0e3029' }
    },

    // hubble — storie/hubble/
    'studio.studio_cosa_e_la_gravita.7': {
      it: { file: 'storie/hubble/it/studio_cosa_e_la_gravita-7.mp3', impronta: '808b37ae', firma: '4b36217b39', testo: "esatto, perchè ci trattieni?" }
    },

    // iss — storie/iss/
    'studio.studio_cosa_e_la_gravita.8': {
      it: { file: 'storie/iss/it/studio_cosa_e_la_gravita-8.mp3', impronta: '3973dac1', firma: '88d874f638', testo: "ci dobbiamo ribellare!" }
    },

    // css — storie/css/
    'studio.studio_cosa_e_la_gravita.9': {
      it: { file: 'storie/tiangong/it/studio_cosa_e_la_gravita-9.mp3', impronta: 'a0f96b63', firma: '385e1ec2fd', testo: "giusto!" }
    },

    // Sedna — storie/sedna/
    'studio.studio_cosa_e_la_gravita.24': {
      it: { file: 'storie/sedna/it/studio_cosa_e_la_gravita-24.mp3', impronta: 'fd80a4be', firma: '064d2342c6', testo: "Ehm, scusa Terra, hai finito?" }
    },

    // ── FINE STORIE COSMICHE ──
  }
};