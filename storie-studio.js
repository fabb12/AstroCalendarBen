/* storie-studio.js — Lo Studio delle Storie cosmiche: gli strumenti per
 * crearle senza scrivere il DSL.
 *
 * Una storia, qui, è un **progetto** fatto di cose che chi scrive pensa
 * davvero: uno scopo (che cosa deve capire chi guarda), dei personaggi,
 * delle scene (dove siamo, quando, chi c'è) e dentro a ogni scena dei
 * **momenti** — chi parla, che cosa dice, con che faccia — con le azioni che
 * accadono intanto: un astro che vola verso un altro, uno che salta, un botto.
 * Il copione (il DSL delle demo, `DEMO.md`, `STORIE.md`) lo scrive lo Studio,
 * un momento per scena perché il motore vuole **una battuta per scena**.
 *
 * Quattro aiuti, perché il foglio bianco è la parte difficile:
 *   - i **modelli per scopo** (`STUDIO_SCOPI`): le fasi della Luna, i
 *     giganti, le stagioni, un viaggio, un'avventura — una storia intera da
 *     cambiare, non da riempire;
 *   - i **suggerimenti**: l'ambiente adatto ai personaggi in scena, la
 *     faccia giusta per una frase, le azioni che stanno bene con quella
 *     faccia e quelle parole, il prossimo momento (chi parla e una bozza);
 *   - i **comandi a parole**: «Marte vola verso Giove facendo un giro»,
 *     «Giove dice: Benvenuto!», «esplosione su Saturno» (`studioCapisci`);
 *   - il **controllo dello scopo** (`studioConsigli`): tutti parlano? la
 *     prima battuta apre una domanda, l'ultima la chiude? le frasi sono da
 *     bambini? il copione è valido?
 *
 * I progetti stanno in `localStorage` (`astrocal_storie_progetti_v1`); «Salva
 * nelle mie demo» mette il copione nella libreria delle demo, dove si può
 * anche esportare. Lo Studio vive nella linguetta «Storie cosmiche» della
 * pagina Demo (§8, `studioSchede`). Tutti i testi nei dizionari (`studio.*`).
 *
 * Prefisso `studio`. Si carica dopo `storie-cosmiche.js` e
 * `demo-impostazioni.js`; nelle prove Node (`scripts/prova-storie.js`) si
 * usano le funzioni pure di §2–§5. */
(function (radice) {
  'use strict';

  // ===================================================================
  // 1. Gli strumenti di base
  // ===================================================================

  const CHIAVE = 'astrocal_storie_progetti_v1';
  const S = () => radice.StorieCosmiche || {};
  const haI18n = () => !!(radice.astroI18n && typeof radice.astroI18n.t === 'function');
  const t = (k, d) => {
    if (!haI18n()) return k;
    if (typeof radice.astroI18n.esiste === 'function' && !radice.astroI18n.esiste(k)) return '';
    return radice.astroI18n.t(k, d);
  };
  const nuovoId = p => p + Math.random().toString(36).slice(2, 9);
  const copia = o => JSON.parse(JSON.stringify(o));
  // I corpi che la camera 3D sa inquadrare attorno al Sole, e quelli che
  // sa tenere al centro da vicino (demo.js, `corpiSistema` e `FUOCHI_SISTEMA`)
  const STUDIO_INQUADRABILI = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
  const STUDIO_FUOCHI_3D = ['Earth', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
  const STUDIO_FUOCHI_CIELO = ['Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
  const STUDIO_AMBIENTI = ['sistema', 'pianeta', 'terra_luna', 'cielo', 'cosmo'];
  /* La scala cosmica (v412, scala-cosmica.js): le tappe a cui la camera può
   * andare, con la scala a cui ognuna si inquadra (il logaritmo di metà del
   * lato corto, in UA: `Math.log10(vista)` di `COSM_STRUTTURE`), e i luoghi
   * dell'universo verso cui un personaggio può viaggiare, con la loro
   * distanza vera (anni luce) da cui si ricava la scala che li inquadra (la
   * stessa regola di `cosmLuogo`). Tenuti qui, e non letti dalla carta,
   * perché il copione esca uguale anche senza la scala cosmica caricata (le
   * prove Node). */
  const STUDIO_AL = 63241.077, STUDIO_KM_UA = 149597870.7;
  const STUDIO_TAPPE_COSMO = {
    earth: Math.log10(6371 / STUDIO_KM_UA * 2.3), earth_moon: Math.log10(384400 / STUDIO_KM_UA * 1.32),
    inner_planets: Math.log10(1.95), planets: Math.log10(37), kuiper: Math.log10(64), heliopause: Math.log10(230),
    oort: Math.log10(128000), local_cloud: Math.log10(28 * STUDIO_AL), local_bubble: Math.log10(700 * STUDIO_AL),
    orion_arm: Math.log10(6500 * STUDIO_AL), milky_way: Math.log10(62000 * STUDIO_AL), local_group: Math.log10(6.2e6 * STUDIO_AL),
    virgo: Math.log10(72e6 * STUDIO_AL), laniakea: Math.log10(330e6 * STUDIO_AL), universe: Math.log10(56e9 * STUDIO_AL)
  };
  const STUDIO_SEGNI_COSMO = {
    alpha_centauri: 4.37, sirius: 8.6, orion_nebula: 1344, galactic_center: 26000, lmc: 160000, smc: 200000,
    andromeda: 2.54e6, triangulum: 2.73e6, virgo_cluster: 54e6, great_attractor: 250e6,
    // v414: i due luoghi delle storie sulle stelle (`COSM_LUOGHI_STORIE`)
    betelgeuse: 548, crab_nebula: 6500
  };
  // I nomi a schermo: quelli della scala cosmica (`cosmo.*` nei dizionari)
  const STUDIO_NOMI_TAPPE = {
    earth: 'terra', earth_moon: 'terraLuna', inner_planets: 'pianetiInterni', planets: 'pianeti', kuiper: 'kuiper',
    heliopause: 'eliopausa', oort: 'oort', local_cloud: 'mezzoLocale', local_bubble: 'bollaLocale', orion_arm: 'braccioOrione',
    milky_way: 'viaLattea', local_group: 'gruppoLocale', virgo: 'vergine', laniakea: 'laniakea', universe: 'universo'
  };
  const STUDIO_NOMI_SEGNI = {
    alpha_centauri: 'alfaCen', sirius: 'sirio', orion_nebula: 'orione', galactic_center: 'centro', lmc: 'gnm', smc: 'pnm',
    andromeda: 'm31', triangulum: 'm33', virgo_cluster: 'ammassoVergine', great_attractor: 'grandeAttrattore',
    betelgeuse: 'betelgeuse', crab_nebula: 'granchio'
  };
  const luogoCosmo = v => typeof v === 'string' && (v in STUDIO_TAPPE_COSMO || v in STUDIO_SEGNI_COSMO);
  // La scala che inquadra un luogo (o un personaggio dell'universo, al suo luogo)
  function studioLCosmo(v) {
    const prof = S().STOR_PERSONAGGI && S().STOR_PERSONAGGI[v];
    if (prof && (prof.cosmo || prof.luogo)) v = prof.cosmo || prof.luogo;
    if (v in STUDIO_TAPPE_COSMO) return STUDIO_TAPPE_COSMO[v];
    if (v in STUDIO_SEGNI_COSMO) return Math.log10(Math.max(STUDIO_SEGNI_COSMO[v] * 1.7, 6) * STUDIO_AL);
    return null;
  }
  function nomeLuogo(v) {
    if (v in STUDIO_NOMI_TAPPE) return t('cosmo.' + STUDIO_NOMI_TAPPE[v] + '.nome') || v;
    if (v in STUDIO_NOMI_SEGNI) return t('cosmo.etichetta.' + STUDIO_NOMI_SEGNI[v]) || v;
    return v;
  }
  // La tappa più vicina a una scala: è di lei che parla un fatto
  function studioTappaVicina(L) {
    let meglio = 'planets', d = Infinity;
    for (const [k, v] of Object.entries(STUDIO_TAPPE_COSMO)) if (Math.abs(v - L) < d) { d = Math.abs(v - L); meglio = k; }
    return meglio;
  }
  // Chi vive solo nella scala cosmica (la Via Lattea, Andromeda, Sirio…)
  const soloCosmo = id => !!(S().STOR_PERSONAGGI && S().STOR_PERSONAGGI[id] && S().STOR_PERSONAGGI[id].cosmo);
  const STUDIO_ZOOM = { lontano: 0.75, normale: 1, vicino: 1.7 };
  const STUDIO_FOV = { lontano: 60, normale: 18, vicino: 3 };
  const STUDIO_QUANDO = ['inizio', 'meta', 'fine', 'tutto'];
  const STUDIO_TIPI = ['umore', 'guarda', 'muovi', 'torna', 'anima', 'scala', 'diventa', 'effetto', 'occhiolino', 'nascondi'];
  // Che cosa può diventare un personaggio (v414, `character_become`): le
  // vesti di `STOR_VESTI`, tenute qui per lo stesso motivo delle tappe
  const STUDIO_FORME = ['red_giant', 'white_dwarf', 'supernova', 'black_hole', 'self'];
  // Il nome che le battute di una storia dello Studio hanno nei file delle
  // voci (`studio_la_luna-3.mp3`): lo stesso controllo di `scripts/voci-storie.js`
  const STUDIO_VOCE_CHIAVE = /^studio_[a-z0-9_]{1,40}$/;
  const STUDIO_PAROLE_BAMBINI = 25;     // oltre, una battuta è lunga per un bambino
  const STUDIO_DURATA_IDEALE = [30, 240];

  // ===================================================================
  // 2. Il modello: progetto, scena, momento, azione
  // ===================================================================

  function studioNuovaAzione(tipo, campi = {}) {
    const base = { id: nuovoId('a'), tipo, chi: '', quando: 'inizio' };
    const di = {
      umore: { umore: 'happy' }, guarda: { oggetto: 'viewer' },
      muovi: { verso: '', lato: 'auto', percorso: 'arc', quando: 'tutto' }, torna: { percorso: 'arc', quando: 'tutto' },
      anima: { animazione: 'jump', volte: 0 }, scala: { scala: 1.6, quando: 'inizio' }, diventa: { forma: 'red_giant', quando: 'tutto' },
      effetto: { effetto: 'sparkles', dove: '', grandezza: 1, colore: '' }, occhiolino: {}, nascondi: { quando: 'fine' }
    }[tipo] || {};
    return Object.assign(base, di, campi);
  }
  function studioNuovoMomento(campi = {}) {
    return Object.assign({ id: nuovoId('m'), chi: '', testo: '', umore: '', durata: 0, voce: 0, audio: null, azioni: [] }, campi);
  }
  /* La camera di una scena (v431): automatica (va da chi parla e dai botti),
   * sempre stretta su chi parla, su un personaggio solo, che gira attorno a
   * un personaggio (o a chi parla), o ferma sulla camera della scena. Prima
   * c'era solo la casella `cameraViva`: spenta vuol dire ancora «ferma». */
  const STUDIO_CAMERE = ['auto', 'parla', 'vicino', 'giro', 'ferma'];
  function studioCameraDi(sc) {
    const c = sc && STUDIO_CAMERE.includes(sc.camera) ? sc.camera : 'auto';
    return c === 'auto' && sc && sc.cameraViva === false ? 'ferma' : c;
  }
  // La riga `story_camera` della scena, o niente se la regia è quella di serie
  function studioRigaCamera(sc, presenti) {
    const modo = studioCameraDi(sc);
    const chi = sc.cameraChi && presenti.includes(sc.cameraChi) ? sc.cameraChi : '';
    if (modo === 'ferma') return 'story_camera { mode: wide }';
    if (modo === 'parla') return 'story_camera { mode: speaker }';
    if (modo === 'vicino') {
      const su = chi || presenti[0];
      return su ? `story_camera { mode: close, target: ${virgolette(su)} }` : null;
    }
    if (modo === 'giro') return chi ? `story_camera { mode: orbit, target: ${virgolette(chi)} }` : 'story_camera { mode: orbit }';
    return null;
  }
  function studioNuovaScena(campi = {}) {
    return Object.assign({
      id: nuovoId('s'), ambiente: 'sistema', fuoco: 'Jupiter', zoom: 'normale',
      data: '', ora: '21:00', giorni: 0, cartello: false, cameraViva: true, camera: 'auto', cameraChi: '', cosmoDa: 'planets', cosmoA: 'milky_way', presenti: [], momenti: [studioNuovoMomento()]
    }, campi);
  }
  function studioNuovoProgetto(campi = {}) {
    return Object.assign({
      v: 1, id: nuovoId('p'), titolo: '', scopo: 'libera', obiettivo: '',
      cast: ['Moon', 'Earth'], scene: [studioNuovaScena({ ambiente: 'terra_luna' })], demoChiave: null,
      voceChiave: null, voceProssima: 1, aggiornato: 0, lingua: '',
      // v430: la domanda finale al pubblico (§4-bis). Dalla v432 è
      // facoltativa: spenta di serie, la accende chi scrive la storia
      domanda: studioNuovaDomanda()
    }, campi);
  }
  function studioNuovaDomanda(campi = {}) {
    return Object.assign({ attiva: false, modo: 'auto', tipo: 'auto', testo: '', a: '', b: '', chi: '' }, campi);
  }
  // Chi è davvero in scena: quelli scelti, o tutto il cast; mai qualcuno
  // che non è più nel cast.
  function studioPresenti(progetto, scena) {
    // la Via Lattea e Andromeda stanno solo nella scala cosmica
    const qui = id => progetto.cast.includes(id) && (scena.ambiente === 'cosmo' || !soloCosmo(id));
    const scelti = (scena.presenti || []).filter(qui);
    return scelti.length ? scelti : progetto.cast.filter(qui);
  }
  // Un progetto letto da un file o dall'archivio: si tiene solo quello che
  // il modello conosce, coi tipi giusti. Un file rotto non rompe lo Studio.
  function studioRipulisci(p) {
    if (!p || typeof p !== 'object') throw new Error(t('studio.err.file') || 'file');
    const testo = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
    const tra = (v, ammessi, di) => ammessi.includes(v) ? v : di;
    const numero = (v, a, b, di) => Number.isFinite(Number(v)) ? Math.max(a, Math.min(b, Number(v))) : di;
    // v424: scene, momenti e azioni tengono il loro id, perché la stessa
    // storia letta due volte (dal repository, da un altro dispositivo) sia
    // lo stesso file e non un commit nuovo a ogni giro
    const idDi = (v, pre) => typeof v === 'string' && /^[a-z][a-z0-9]{1,15}$/.test(v) ? v : nuovoId(pre);
    const ids = v => Array.isArray(v) ? v.filter(x => typeof x === 'string' && /^[\w :.-]{1,40}$/.test(x)).slice(0, 24) : [];
    const pulito = studioNuovoProgetto({
      id: typeof p.id === 'string' ? p.id.slice(0, 30) : nuovoId('p'),
      titolo: testo(p.titolo, 120), scopo: tra(p.scopo, Object.keys(STUDIO_SCOPI), 'libera'),
      obiettivo: testo(p.obiettivo, 300), cast: ids(p.cast),
      demoChiave: typeof p.demoChiave === 'string' && p.demoChiave.startsWith('utente-') ? p.demoChiave : null,
      voceChiave: typeof p.voceChiave === 'string' && STUDIO_VOCE_CHIAVE.test(p.voceChiave) ? p.voceChiave : null,
      voceProssima: Math.floor(numero(p.voceProssima, 1, 100000, 1)),
      // v424: quando è stato toccato l'ultima volta (chi vince fra due
      // dispositivi) e la lingua delle sue battute nel file delle voci
      aggiornato: Math.floor(numero(p.aggiornato, 0, 1e13, 0)), lingua: p.lingua === 'en' || p.lingua === 'it' ? p.lingua : '',
      domanda: studioNuovaDomanda(p.domanda && typeof p.domanda === 'object' ? {
        // (le copie di prima della v432 non hanno `attiva`: restano senza domanda)
        attiva: p.domanda.attiva === true,
        modo: tra(p.domanda.modo, ['auto', 'sempre', 'mai'], 'auto'),
        tipo: tra(p.domanda.tipo, ['auto', 'ragione', 'sonda', 'fiducia', 'esplora', 'ab', 'previsione', 'protagonista'], 'auto'),
        testo: testo(p.domanda.testo, 200), a: testo(p.domanda.a, 60), b: testo(p.domanda.b, 60), chi: testo(p.domanda.chi, 40)
      } : {})
    });
    pulito.scene = (Array.isArray(p.scene) ? p.scene : []).slice(0, 40).map(sc => studioNuovaScena({
      id: idDi(sc && sc.id, 's'), ambiente: tra(sc && sc.ambiente, STUDIO_AMBIENTI, 'sistema'), fuoco: testo(sc && sc.fuoco, 40) || 'Jupiter',
      zoom: tra(sc && sc.zoom, Object.keys(STUDIO_ZOOM), 'normale'),
      data: /^\d{4}-\d{2}-\d{2}$/.test(sc && sc.data) ? sc.data : '', ora: /^\d{2}:\d{2}$/.test(sc && sc.ora) ? sc.ora : '21:00',
      giorni: numero(sc && sc.giorni, 0, 1000, 0), cartello: !!(sc && sc.cartello), cameraViva: !(sc && sc.cameraViva === false), presenti: ids(sc && sc.presenti),
      camera: tra(sc && sc.camera, STUDIO_CAMERE, sc && sc.cameraViva === false ? 'ferma' : 'auto'), cameraChi: testo(sc && sc.cameraChi, 40),
      cosmoDa: tra(sc && sc.cosmoDa, Object.keys(STUDIO_TAPPE_COSMO), 'planets'), cosmoA: tra(sc && sc.cosmoA, Object.keys(STUDIO_TAPPE_COSMO), 'milky_way'),
      momenti: (Array.isArray(sc && sc.momenti) ? sc.momenti : []).slice(0, 60).map(m => studioNuovoMomento({
        id: idDi(m && m.id, 'm'), chi: testo(m && m.chi, 40), testo: testo(m && m.testo, 400), umore: testo(m && m.umore, 20),
        durata: numero(m && m.durata, 0, 120, 0), voce: Math.floor(numero(m && m.voce, 0, 100000, 0)),
        audio: m && m.audio && Number(m.audio.durata) > 0 && /^[0-9a-f]{8}$/.test(m.audio.impronta)
          ? { durata: numero(m.audio.durata, 1, 120000, 1), impronta: m.audio.impronta, nome: testo(m.audio.nome, 80) } : null,
        azioni: (Array.isArray(m && m.azioni) ? m.azioni : []).slice(0, 30)
          .filter(a => a && STUDIO_TIPI.includes(a.tipo))
          .map(a => studioNuovaAzione(a.tipo, {
            id: idDi(a.id, 'a'), chi: testo(a.chi, 40), quando: tra(a.quando, STUDIO_QUANDO, 'inizio'),
            umore: testo(a.umore, 20) || undefined, oggetto: testo(a.oggetto, 40) || undefined,
            verso: testo(a.verso, 40), lato: tra(a.lato, ['auto', 'left', 'right', 'above', 'below', 'front', 'behind'], 'auto'),
            percorso: testo(a.percorso, 20) || 'arc', animazione: testo(a.animazione, 20) || 'jump',
            volte: numero(a.volte, 0, 20, 0), scala: numero(a.scala, 0.2, 6, 1.6), forma: tra(a.forma, STUDIO_FORME, 'red_giant'),
            effetto: testo(a.effetto, 20) || 'sparkles', dove: testo(a.dove, 40),
            grandezza: numero(a.grandezza, 0.2, 5, 1), colore: /^#[0-9a-f]{6}$/i.test(a.colore || '') ? a.colore : ''
          }))
      }))
    }));
    if (!pulito.scene.length) pulito.scene.push(studioNuovaScena());
    return pulito;
  }

  // ===================================================================
  // 3. I modelli per scopo
  // ===================================================================

  /* Ogni modello è una storia intera, corta, che funziona così com'è e che
   * insegna una cosa vera; i testi sono nei dizionari
   * (`studio.tpl.<scopo>.<n>`), presi nella lingua di adesso quando si
   * sceglie il modello — da lì in poi sono di chi scrive. `a` sono le
   * azioni del momento, nella forma di `studioNuovaAzione`. */
  const M = (chi, n, umore, a = []) => ({ chi, n, umore, a });
  const STUDIO_SCOPI = {
    libera: { cast: ['Moon', 'Earth'], scene: [
      { ambiente: 'terra_luna', momenti: [M('Moon', 1, 'happy', [['anima', { chi: 'Moon', animazione: 'jump' }]])] }
    ] },
    fasi: { cast: ['Moon', 'Earth', 'Sun'], scene: [
      { ambiente: 'cielo', fuoco: 'Moon', zoom: 'vicino', data: '2026-12-13', ora: '18:30', presenti: ['Moon'], momenti: [
        M('Moon', 1, 'worried', [['anima', { chi: 'Moon', animazione: 'shake' }]])
      ] },
      { ambiente: 'terra_luna', momenti: [
        M('Earth', 2, 'happy', [['guarda', { chi: 'Moon', oggetto: 'Earth' }]]),
        M('Sun', 3, 'happy', [['effetto', { effetto: 'glow', dove: 'Sun' }]])
      ] },
      { ambiente: 'terra_luna', giorni: 11, data: '2026-12-13', ora: '18:30', momenti: [
        M('Moon', 4, 'surprised', [['umore', { chi: 'Moon', umore: 'happy', quando: 'fine' }]]),
        M('Moon', 5, 'excited', [['anima', { chi: 'Moon', animazione: 'jump' }], ['effetto', { effetto: 'sparkles', dove: 'Moon', quando: 'meta' }]])
      ] }
    ] },
    giganti: { cast: ['Jupiter', 'Saturn', 'Sun'], scene: [
      { ambiente: 'sistema', presenti: ['Jupiter', 'Saturn'], momenti: [
        M('Jupiter', 1, 'excited', [['scala', { chi: 'Jupiter', scala: 1.5 }], ['anima', { chi: 'Jupiter', animazione: 'pulse', quando: 'meta' }]]),
        M('Saturn', 2, 'happy', [['anima', { chi: 'Saturn', animazione: 'wobble' }]])
      ] },
      { ambiente: 'sistema', presenti: ['Jupiter', 'Saturn'], momenti: [
        M('Jupiter', 3, 'thinking', [['muovi', { chi: 'Saturn', verso: 'Jupiter', percorso: 'arc' }]]),
        M('Saturn', 4, 'surprised', [['effetto', { effetto: 'shockwave', dove: 'Jupiter', quando: 'meta' }]])
      ] },
      { ambiente: 'sistema', giorni: 1000, momenti: [
        M('Sun', 5, 'happy', [['torna', { chi: 'Saturn' }], ['scala', { chi: 'Jupiter', scala: 1 }]])
      ] }
    ] },
    stagioni: { cast: ['Earth', 'Sun'], scene: [
      { ambiente: 'pianeta', fuoco: 'Earth', presenti: ['Earth'], momenti: [
        M('Earth', 1, 'thinking', [['anima', { chi: 'Earth', animazione: 'nod' }]])
      ] },
      { ambiente: 'sistema', momenti: [
        M('Sun', 2, 'happy', [['effetto', { effetto: 'glow', dove: 'Sun' }]]),
        M('Earth', 3, 'surprised', [['effetto', { effetto: 'sparkles', dove: 'Earth', quando: 'fine' }]])
      ] },
      { ambiente: 'sistema', giorni: 182, data: '2027-06-21', ora: '12:00', momenti: [
        M('Earth', 4, 'happy', [['anima', { chi: 'Earth', animazione: 'dance', quando: 'fine' }]])
      ] }
    ] },
    viaggio: { cast: ['Mars', 'Jupiter', 'Saturn'], scene: [
      { ambiente: 'sistema', momenti: [
        M('Mars', 1, 'excited', [['anima', { chi: 'Mars', animazione: 'jump' }]]),
        M('Mars', 2, 'happy', [['muovi', { chi: 'Mars', verso: 'Jupiter', percorso: 'arc' }]]),
        M('Jupiter', 3, 'happy', [['anima', { chi: 'Jupiter', animazione: 'nod' }]]),
        M('Mars', 4, 'excited', [['muovi', { chi: 'Mars', verso: 'Saturn', percorso: 'loop' }]]),
        M('Saturn', 5, 'happy', [['effetto', { effetto: 'confetti', dove: 'Saturn' }]]),
        M('Mars', 6, 'happy', [['torna', { chi: 'Mars', percorso: 'hop' }]])
      ] }
    ] },
    avventura: { cast: ['Mars', 'Jupiter'], scene: [
      { ambiente: 'sistema', presenti: ['Mars', 'Jupiter'], zoom: 'vicino', momenti: [
        M('Mars', 1, 'excited', [['muovi', { chi: 'Mars', verso: 'Jupiter', percorso: 'straight' }]]),
        M('Jupiter', 2, 'surprised', [['effetto', { effetto: 'explosion', dove: 'Jupiter', quando: 'meta' }], ['anima', { chi: 'Mars', animazione: 'shake', quando: 'meta' }]]),
        M('Mars', 3, 'worried', [['effetto', { effetto: 'smoke', dove: 'Mars' }]]),
        M('Jupiter', 4, 'happy', [['effetto', { effetto: 'fireworks', dove: 'Jupiter', quando: 'meta' }]]),
        M('Mars', 5, 'happy', [['torna', { chi: 'Mars' }], ['effetto', { effetto: 'hearts', dove: 'Jupiter', quando: 'meta' }]])
      ] }
    ] },
    /* Nella scala cosmica (v412). La camera si allontana di scena in scena,
     * alla misura vera, e i personaggi stanno dove stanno davvero: la Voyager
     * fuori dal quadro dei pianeti, poi un puntino col Sole e la Terra, poi
     * niente rispetto alla Via Lattea. La storia è costruita su quello che la
     * carta mostra, e non dice niente che la carta smentisca. */
    universo: { cast: ['Earth', 'voyager1', 'milky_way'], scene: [
      { ambiente: 'cosmo', da: 'earth_moon', a: 'planets', presenti: ['Earth', 'voyager1'], momenti: [
        M('Earth', 1, 'thinking', [['guarda', { chi: 'Earth', oggetto: 'voyager1' }]]),
        M('voyager1', 2, 'excited', [['anima', { chi: 'voyager1', animazione: 'bounce' }]])
      ] },
      { ambiente: 'cosmo', da: 'heliopause', a: 'oort', presenti: ['Earth', 'voyager1'], momenti: [
        M('voyager1', 3, 'happy', [['effetto', { effetto: 'shockwave', dove: 'voyager1', quando: 'meta' }]]),
        M('Earth', 4, 'surprised', []),
        M('voyager1', 5, 'laughing', [['muovi', { chi: 'voyager1', verso: 'oort', percorso: 'arc' }]])
      ] },
      { ambiente: 'cosmo', da: 'local_bubble', a: 'milky_way', momenti: [
        M('milky_way', 6, 'happy', [['effetto', { effetto: 'sparkles', dove: 'milky_way', quando: 'meta' }]]),
        M('Earth', 7, 'worried', [['anima', { chi: 'Earth', animazione: 'shake' }]]),
        M('milky_way', 8, 'laughing', [['torna', { chi: 'voyager1' }]])
      ] },
      { ambiente: 'cosmo', da: 'local_group', a: 'universe', momenti: [
        M('milky_way', 9, 'thinking', []),
        M('Earth', 10, 'love', [['effetto', { effetto: 'hearts', dove: 'Earth', quando: 'meta' }]])
      ] }
    ] },
    andromeda: { cast: ['milky_way', 'andromeda', 'Sun'], scene: [
      { ambiente: 'cosmo', da: 'milky_way', a: 'local_group', presenti: ['milky_way', 'andromeda'], momenti: [
        M('milky_way', 1, 'surprised', [['guarda', { chi: 'milky_way', oggetto: 'andromeda' }]]),
        M('andromeda', 2, 'love', [['effetto', { effetto: 'hearts', dove: 'andromeda', quando: 'meta' }]]),
        M('milky_way', 3, 'worried', [['anima', { chi: 'milky_way', animazione: 'shake' }]])
      ] },
      { ambiente: 'cosmo', da: 'local_group', a: 'local_group', momenti: [
        M('Sun', 4, 'laughing', [['anima', { chi: 'Sun', animazione: 'jump' }]]),
        M('andromeda', 5, 'happy', [['muovi', { chi: 'andromeda', verso: 'milky_way', percorso: 'spiral' }]]),
        M('milky_way', 6, 'love', [['effetto', { effetto: 'fireworks', dove: 'milky_way', quando: 'meta' }]])
      ] }
    ] },
    /* Buchi neri e buchi bianchi (v414). Il Sole prova a fare il buco nero
     * (`diventa`), e Sagittario A* gli spiega che è troppo leggero; il buco
     * bianco, che non ha un posto sulla carta, ammette di essere un'idea. */
    buchi: { cast: ['Sun', 'sgr_a', 'white_hole'], scene: [
      { ambiente: 'cosmo', da: 'inner_planets', a: 'local_bubble', presenti: ['Sun'], momenti: [
        M('Sun', 1, 'thinking', [['anima', { chi: 'Sun', animazione: 'wobble', quando: 'meta' }]])
      ] },
      { ambiente: 'cosmo', da: 'orion_arm', a: 'milky_way', presenti: ['Sun', 'sgr_a'], momenti: [
        M('sgr_a', 2, 'happy', [['effetto', { effetto: 'glow', dove: 'sgr_a', quando: 'meta' }]]),
        M('Sun', 3, 'excited', [['diventa', { chi: 'Sun', forma: 'black_hole' }]]),
        M('sgr_a', 4, 'laughing', [['diventa', { chi: 'Sun', forma: 'self', quando: 'fine' }]])
      ] },
      { ambiente: 'cosmo', da: 'milky_way', a: 'milky_way', presenti: ['sgr_a', 'white_hole'], momenti: [
        M('white_hole', 5, 'excited', [['effetto', { effetto: 'flash', dove: 'center' }]]),
        M('sgr_a', 6, 'surprised', [['guarda', { chi: 'sgr_a', oggetto: 'white_hole' }]]),
        M('white_hole', 7, 'thinking', [['umore', { chi: 'white_hole', umore: 'laughing', quando: 'fine' }]])
      ] }
    ] }
  };

  function studioDaModello(scopo) {
    const m = STUDIO_SCOPI[scopo] || STUDIO_SCOPI.libera;
    const chiave = STUDIO_SCOPI[scopo] ? scopo : 'libera';
    const p = studioNuovoProgetto({
      scopo: chiave, titolo: t('studio.scopo.' + chiave + '.titolo'), obiettivo: t('studio.scopo.' + chiave + '.obiettivo'),
      cast: m.cast.slice()
    });
    p.scene = m.scene.map(sc => studioNuovaScena({
      ambiente: sc.ambiente, fuoco: sc.fuoco || (sc.ambiente === 'cielo' ? 'Moon' : 'Jupiter'), zoom: sc.zoom || 'normale',
      cosmoDa: sc.da || 'planets', cosmoA: sc.a || 'milky_way',
      data: sc.data || '', ora: sc.ora || '21:00', giorni: sc.giorni || 0, presenti: (sc.presenti || []).slice(),
      momenti: sc.momenti.map(x => studioNuovoMomento({
        chi: x.chi, umore: x.umore, testo: t('studio.tpl.' + chiave + '.' + x.n),
        azioni: x.a.map(([tipo, campi]) => studioNuovaAzione(tipo, Object.assign({ chi: x.chi }, campi)))
      }))
    }));
    return p;
  }

  // ===================================================================
  // 4. Il copione: dal progetto al DSL
  // ===================================================================

  const virgolette = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  const unaRiga = s => String(s || '').replace(/\s+/g, ' ').trim();
  // La riga di una data locale (giorno e ora scritti da chi crea) in UTC,
  // come la vuole `set_date`
  function isoDi(data, ora, piuGiorni = 0) {
    const giorno = /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : new Date().toISOString().slice(0, 10);
    const d = new Date(giorno + 'T' + (/^\d{2}:\d{2}$/.test(ora) ? ora : '21:00') + ':00');
    if (!Number.isFinite(+d)) return null;
    return new Date(+d + piuGiorni * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  // Quanto dura un momento: la sua battuta detta con calma, più un respiro.
  // La scena aspetta comunque la fine della voce: questo è il minimo.
  /* La voce caricata a mano (v422): il momento dura quanto lei più un
   * respiro, così la scena dopo non la taglia e non resta un silenzio
   * lungo. Le azioni del momento (un viaggio, un salto) e i giorni che
   * passano sono frazioni della scena: si stringono o si allungano con lei,
   * e restano a tempo con la voce. Una durata scritta a mano più lunga
   * vince (chi vuole una pausa dopo la battuta); più corta no, taglierebbe. */
  const STUDIO_RESPIRO = 0.6;
  // La stessa impronta della narrazione (`narrImpronta`, FNV-1a sul testo
  // normalizzato): dice se la voce è stata caricata per il testo di adesso
  function studioImpronta(testo) {
    let x = 0x811c9dc5;
    const s = String(testo == null ? '' : testo).replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim();
    for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
    return x.toString(16).padStart(8, '0');
  }
  const testoDetto = m => unaRiga(m && m.testo).slice(0, 400);
  function studioVoceValida(m) {
    return !!(m && m.audio && m.audio.durata > 0 && testoDetto(m) && m.audio.impronta === studioImpronta(testoDetto(m)));
  }
  function studioDurata(momento) {
    if (studioVoceValida(momento))
      return Math.max(3, Math.ceil(momento.audio.durata / 1000 + STUDIO_RESPIRO), momento.durata > 0 ? Math.round(momento.durata) : 0);
    if (momento.durata > 0) return Math.round(momento.durata);
    const testo = unaRiga(momento.testo);
    const viaggi = (momento.azioni || []).some(a => a.tipo === 'muovi' || a.tipo === 'torna');
    if (!testo) return viaggi ? 6 : 4;
    const ritmo = typeof S().ritmo === 'function' ? S().ritmo(testo).totale : testo.split(/\s+/).length * 0.42;
    return Math.max(viaggi ? 6 : 4, Math.ceil(ritmo * 1.12 + 1.6));
  }
  // La frazione di scena di un'azione: le azioni che durano (un viaggio, un
  // salto, una crescita) prendono un tratto, quelle istantanee un punto.
  const TRATTI = { inizio: [0, 0.45], meta: [0.3, 0.75], fine: [0.6, 1], tutto: [0, 1] };
  const PUNTI = { inizio: 0, meta: 0.45, fine: 0.75, tutto: 0 };
  function ripresa(azione, durevole) {
    const q = azione.quando || 'inizio';
    if (durevole) {
      const [a, b] = TRATTI[q] || TRATTI.inizio;
      return (a > 0 ? ', shot_from: ' + a : '') + (b < 1 ? ', shot_to: ' + b : '');
    }
    const a = PUNTI[q] || 0;
    return a > 0 ? ', shot_from: ' + a : '';
  }
  function numeroDsl(n) { return String(Math.round(n * 100) / 100); }

  // Le righe di una sola azione, o '' se in questa vista non si può fare
  function righeAzione(az, vista, presenti, cosmo) {
    const chi = az.chi;
    const inScena = id => presenti.includes(id);
    const tre = vista === 'solar_system_3d';
    switch (az.tipo) {
      case 'umore':
        if (!inScena(chi) || !az.umore) return '';
        return `character_expression { target: ${virgolette(chi)}, expression: ${virgolette(az.umore)}${ripresa(az, false)} }`;
      case 'guarda':
        if (!inScena(chi)) return '';
        if (!cosmo && luogoCosmo(az.oggetto) && !S().STOR_PERSONAGGI?.[az.oggetto]) return '';
        return `character_look_at { target: ${virgolette(chi)}, object: ${virgolette(az.oggetto || 'viewer')}${ripresa(az, false)} }`;
      case 'occhiolino':
        if (!inScena(chi)) return '';
        return `character_blink { target: ${virgolette(chi)}${ripresa(az, false)} }`;
      case 'nascondi':
        if (!inScena(chi)) return '';
        return `character_hide { target: ${virgolette(chi)}${ripresa(az, false)} }`;
      case 'muovi':
        if (!tre || !inScena(chi) || !az.verso || az.verso === chi) return '';
        // nella scala cosmica le mete sono i luoghi dell'universo e gli altri
        // personaggi; fuori, i luoghi dell'universo non esistono
        if (!cosmo && luogoCosmo(az.verso) && !S().STOR_PERSONAGGI?.[az.verso]) return '';
        if (cosmo && ['center', 'left', 'right', 'top', 'bottom'].includes(az.verso)) return '';
        return `character_move { target: ${virgolette(chi)}, to: ${virgolette(az.verso)}` +
          (az.lato && az.lato !== 'auto' ? `, side: ${az.lato}` : '') +
          (az.percorso ? `, path: ${az.percorso}` : '') + ripresa(az, true) + ' }';
      case 'torna':
        if (!tre || !inScena(chi)) return '';
        return `character_return { target: ${virgolette(chi)}${az.percorso ? ', path: ' + az.percorso : ''}${ripresa(az, true)} }`;
      case 'anima':
        if (!inScena(chi) || !az.animazione) return '';
        return `character_animate { target: ${virgolette(chi)}, animation: ${az.animazione}` +
          (az.volte > 0 ? ', times: ' + Math.round(az.volte) : '') + ripresa(az, true) + ' }';
      case 'scala':
        if (!inScena(chi)) return '';
        return `character_scale { target: ${virgolette(chi)}, scale: ${numeroDsl(az.scala || 1)}${ripresa(az, true)} }`;
      case 'diventa':
        if (!inScena(chi) || !STUDIO_FORME.includes(az.forma)) return '';
        return `character_become { target: ${virgolette(chi)}, shape: ${az.forma}${ripresa(az, true)} }`;
      case 'effetto': {
        if (!az.effetto) return '';
        const luoghi = ['center', 'left', 'right', 'top', 'bottom'];
        const dove = az.dove || chi || '';
        if (!cosmo && luogoCosmo(dove) && !S().STOR_PERSONAGGI?.[dove]) return '';
        const posto = !dove ? '' : luoghi.includes(dove) ? `, at: ${dove}` : `, target: ${virgolette(dove)}`;
        return `effect { type: ${az.effetto}${posto}` + (az.grandezza && az.grandezza !== 1 ? ', size: ' + numeroDsl(az.grandezza) : '') +
          (az.colore ? `, color: ${virgolette(az.colore)}` : '') + ripresa(az, false) + ' }';
      }
    }
    return '';
  }

  /* Il copione intero (o di una scena sola, per provarla). Ogni momento
   * diventa una scena del DSL: la camera riprende da dove era rimasta (le
   * elevazioni continuano), le facce dei personaggi si portano dietro da un
   * momento all'altro, i giorni che passano si dividono fra i momenti della
   * scena in proporzione alla loro durata. Le azioni che la vista non sa
   * fare (un viaggio nel planetario) si saltano: lo dice il controllo. */
  function studioCopione(progetto, opz = {}) {
    const righe = [];
    const titolo = unaRiga(progetto.titolo) || t('studio.senzaTitolo') || 'storia';
    righe.push(`define_demo ${virgolette(titolo.slice(0, 80))} {`);
    righe.push('  // ' + (t('studio.copione.fatto') || 'Studio delle storie'));
    if (unaRiga(progetto.obiettivo)) righe.push('  // ' + unaRiga(progetto.obiettivo).slice(0, 200));
    const umori = new Map();
    for (const id of progetto.cast) umori.set(id, (S().profilo ? S().profilo(id).espressione : '') || 'neutral');
    let elev = 34, prima = true;
    // Dove eravamo alla fine: la vista, la camera, chi era in scena (per la domanda)
    let fine = null;
    const scene = progetto.scene.map((sc, i) => ({ sc, i })).filter(x => opz.scena === undefined || x.i === opz.scena);
    for (const { sc } of scene) {
      const presenti = studioPresenti(progetto, sc);
      const vista = sc.ambiente === 'cielo' ? 'planetarium_view' : 'solar_system_3d';
      const momenti = sc.momenti.length ? sc.momenti : [studioNuovoMomento()];
      const durate = momenti.map(studioDurata);
      const totale = durate.reduce((a, b) => a + b, 0) || 1;
      const cosmo = sc.ambiente === 'cosmo' ? studioViaggioCosmo(sc, momenti, durate) : null;
      let trascorso = 0;
      if (opz.scena === undefined && !prima) righe.push('');
      momenti.forEach((m, k) => {
        const az = [];
        // Il quando: all'inizio della scena, o un pezzo del tempo che scorre
        if (sc.giorni > 0 && !cosmo) {
          const da = isoDi(sc.data, sc.ora, sc.giorni * trascorso / totale);
          const a = isoDi(sc.data, sc.ora, sc.giorni * (trascorso + durate[k]) / totale);
          if (da && a && da !== a) az.push(`date_range { from: ${virgolette(da)}, to: ${virgolette(a)} }`);
        } else if (k === 0 && sc.data) {
          const iso = isoDi(sc.data, sc.ora);
          if (iso) az.push(`set_date { iso: ${virgolette(iso)} }`);
        }
        trascorso += durate[k];
        // La data e il luogo a schermo (v414): solo se chi scrive li chiede
        if (sc.cartello) az.push('date_card { date: show, time: show, place: show }');
        // La regia (v416, scelta per scena dalla v431): di serie la camera va
        // vicino a chi parla e ai botti; se no quella che la scena ha scelto
        const rigaCamera = studioRigaCamera(sc, presenti);
        if (rigaCamera) az.push(rigaCamera);
        // La camera
        if (cosmo) {
          const [La, Lb] = cosmo[k];
          if (k === 0 && elev < 60) elev = 62;   // la carta si guarda un po' dall'alto
          az.push(`cosmic_scale { from: ${numeroUA(La)}, to: ${numeroUA(Lb)}, orbit: 14, elev_from: ${elev}, elev_to: ${Math.min(80, elev + 3)} }`);
          elev = Math.min(80, elev + 3) >= 80 ? 62 : Math.min(80, elev + 3);
        } else if (vista === 'planetarium_view') {
          const fuoco = STUDIO_FUOCHI_CIELO.includes(sc.fuoco) ? sc.fuoco : (presenti.find(id => STUDIO_FUOCHI_CIELO.includes(id)) || 'Moon');
          az.push(`center_target { target: ${virgolette(fuoco)} }`);
          az.push(`set_fov { degrees: ${STUDIO_FOV[sc.zoom] || 18} }`);
        } else {
          const z = STUDIO_ZOOM[sc.zoom] || 1;
          const elev2 = Math.min(72, elev + 3);
          const zoom = z !== 1 ? `, zoom_from: ${z}, zoom_to: ${z}` : '';
          if (sc.ambiente === 'terra_luna') {
            az.push(`camera_3d { scene: earth_moon, focus: 'Earth-Moon', orbit: 8, elev_from: ${elev}, elev_to: ${elev2}${zoom} }`);
          } else if (sc.ambiente === 'pianeta') {
            const fuoco = STUDIO_FUOCHI_3D.includes(sc.fuoco) ? sc.fuoco : 'Jupiter';
            az.push(`camera_3d { scene: system, focus: ${virgolette(fuoco)}, orbit: 8, elev_from: ${elev}, elev_to: ${elev2}${zoom} }`);
          } else {
            let quadro = presenti.map(id => id === 'Moon' ? 'Earth' : id).filter(id => STUDIO_INQUADRABILI.includes(id));
            // I viaggi verso un pianeta fuori dal cast: anche lui nel quadro
            for (const a of m.azioni || []) if (a.tipo === 'muovi' && STUDIO_INQUADRABILI.includes(a.verso)) quadro.push(a.verso);
            quadro = [...new Set(quadro)];
            if (!quadro.length) quadro = ['Earth', 'Mars', 'Jupiter'];
            az.push(`camera_3d { scene: system, focus: 'Sun', frame: ${virgolette(quadro.join(','))}, orbit: 6, elev_from: ${elev}, elev_to: ${elev2}${zoom} }`);
          }
          elev = elev2 >= 72 ? 34 : elev2;
        }
        // I personaggi: chi parla con la faccia del momento, gli altri con
        // quella che avevano
        const parla = m.chi && presenti.includes(m.chi) && unaRiga(m.testo);
        if (m.chi && m.umore) umori.set(m.chi, m.umore);
        for (const id of presenti) {
          const espr = umori.get(id) || 'neutral';
          az.push(`character_show { target: ${virgolette(id)}, expression: ${virgolette(espr)} }`);
        }
        for (const a of m.azioni || []) {
          const riga = righeAzione(a, vista, presenti, !!cosmo);
          if (riga) az.push(riga);
          if (a.tipo === 'umore' && a.chi && a.umore) umori.set(a.chi, a.umore);
        }
        if (parla) az.push(`character_speak { target: ${virgolette(m.chi)}, text: ${virgolette(unaRiga(m.testo).slice(0, 400))} }`);
        righe.push(`  scene ${vista} {`);
        righe.push(`    duration: ${durate[k]}s;`);
        for (const a of az) righe.push(`    action: ${a};`);
        righe.push('  }');
        prima = false;
        fine = { vista, presenti, cosmo: !!cosmo, sc,
          camera: az.filter(a => /^(camera_3d|cosmic_scale|center_target|set_fov|story_camera)\b/.test(a))
            .map(a => a.startsWith('cosmic_scale') && cosmo ? a.replace(/from: [^,]+/, 'from: ' + numeroUA(cosmo[k][1])) : a) };
      });
    }
    // La domanda al pubblico (v430, §4-bis): una scena in più, ferma, con il
    // cartello e chi la pone che la dice. Solo nel copione intero.
    const domanda = opz.scena === undefined && fine ? studioDomandaFinale(progetto) : null;
    if (domanda) {
      const qui = id => progetto.cast.includes(id) && (fine.sc.ambiente === 'cosmo' || !soloCosmo(id));
      const presenti = fine.presenti.slice();
      let chi = qui(domanda.chi) ? domanda.chi : presenti[0];
      if (chi && !presenti.includes(chi)) presenti.push(chi);
      const detta = t('studio.domanda.detta', { domanda: domanda.testo }) || domanda.testo;
      const durata = studioDurata(studioNuovoMomento({ testo: detta })) + 3;
      righe.push('');
      righe.push(`  scene ${fine.vista} {`);
      righe.push(`    duration: ${durata}s;`);
      for (const a of fine.camera) righe.push(`    action: ${a};`);
      for (const id of presenti) {
        const espr = id === chi ? 'excited' : umori.get(id) || 'neutral';
        righe.push(`    action: character_show { target: ${virgolette(id)}, expression: ${virgolette(espr)} };`);
      }
      if (chi) righe.push(`    action: character_look_at { target: ${virgolette(chi)}, object: 'viewer' };`);
      righe.push(`    action: story_question { text: ${virgolette(domanda.testo)}` + (domanda.a ? `, a: ${virgolette(domanda.a)}` : '') +
        (domanda.b ? `, b: ${virgolette(domanda.b)}` : '') + `, kind: ${domanda.kind}` + (chi ? `, from: ${virgolette(chi)}` : '') + ' };');
      if (chi) righe.push(`    action: character_speak { target: ${virgolette(chi)}, text: ${virgolette(detta.slice(0, 400))} };`);
      righe.push('  }');
    }
    righe.push('}');
    return righe.join('\n');
  }
  /* Il viaggio della camera in una scena della scala cosmica: da una tappa
   * all'altra, diviso fra i momenti in proporzione alla loro durata con una
   * curva morbida (parte piano e arriva piano), così più momenti di fila
   * sono un volo solo. Se in un momento un personaggio parte verso un luogo
   * dell'universo, la camera di quel momento va a inquadrare la meta: chi
   * viaggia verso Andromeda non deve uscire dal quadro. Restituisce, per
   * ogni momento, la scala d'inizio e di fine. */
  function studioViaggioCosmo(sc, momenti, durate) {
    const La = STUDIO_TAPPE_COSMO[sc.cosmoDa] ?? STUDIO_TAPPE_COSMO.planets;
    const Lb = STUDIO_TAPPE_COSMO[sc.cosmoA] ?? La;
    const totale = durate.reduce((a, b) => a + b, 0) || 1;
    const liscio = u => u * u * (3 - 2 * u);
    let fatto = 0, prima = La;
    return momenti.map((m, k) => {
      fatto += durate[k];
      let fine = La + (Lb - La) * liscio(fatto / totale);
      const viaggio = (m.azioni || []).find(a => a.tipo === 'muovi' && studioLCosmo(a.verso) !== null);
      if (viaggio) fine = studioLCosmo(viaggio.verso);
      const coppia = [prima, fine];
      prima = fine;
      return coppia;
    });
  }
  // Una scala come numero di UA per `cosmic_scale` (metà del lato corto),
  // con quattro cifre buone e senza notazione esponenziale
  function numeroUA(L) {
    const v = Number(Math.pow(10, L).toPrecision(4));
    return v >= 1e-6 ? String(v) : '0.000001';
  }

  function studioDurataTotale(progetto) {
    return progetto.scene.reduce((n, sc) => n + sc.momenti.reduce((m, x) => m + studioDurata(x), 0), 0);
  }

  // ===================================================================
  // 4-bis. La domanda finale al pubblico (v430)
  // ===================================================================

  /* Un episodio può chiudersi con una domanda a chi guarda — «Chi ha
   * ragione?», «Dove dovrebbe andare la sonda?», «Di chi ti fideresti?»,
   * «Quale oggetto celeste dovremmo esplorare?», una scelta fra A e B, una
   * previsione, il protagonista del prossimo Short. Non c'è sempre: nasce
   * **da quello che è successo** nell'episodio (chi ha litigato, chi è
   * partito e per dove, chi è diventato un'altra cosa, chi è rimasto zitto),
   * e quando non è successo niente che valga una domanda la storia finisce
   * senza. Chi scrive può chiederla sempre, mai, sceglierne il tipo o
   * scriverla a mano.
   *
   * `studioDomandaFinale` è una funzione pura: legge gli eventi
   * (`studioFattiEpisodio`), dà un punteggio a ogni tipo e tiene il
   * migliore; sotto `STUDIO_DOMANDA_SOGLIA`, in modo automatico, non c'è
   * domanda. Il copione la mette in una scena in più, dopo l'ultima, con il
   * cartello `story_question` e chi la pone che la dice. */
  const STUDIO_TIPI_DOMANDA = ['ragione', 'sonda', 'fiducia', 'esplora', 'ab', 'previsione', 'protagonista'];
  const STUDIO_MODI_DOMANDA = ['auto', 'sempre', 'mai'];
  const STUDIO_KIND_DOMANDA = { ragione: 'who_is_right', sonda: 'probe', fiducia: 'trust', esplora: 'explore', ab: 'choice',
    previsione: 'prediction', protagonista: 'next_star' };
  const STUDIO_DOMANDA_SOGLIA = 2;
  const UMORI_DURI = ['angry', 'annoyed', 'bully'];
  const UMORI_GENTILI = ['happy', 'love', 'excited', 'laughing', 'thinking', 'neutral'];
  const POSTI_SCHERMO = ['center', 'left', 'right', 'top', 'bottom', 'orbit', 'viewer'];
  // Le vesti che vengono dopo una veste, per la previsione: la vita vera
  // delle stelle (una gigante rossa come il Sole diventa una nana bianca;
  // una stella molto più pesante esplode e può lasciare un buco nero)
  const STUDIO_DOPO_VESTE = { red_giant: ['white_dwarf', 'supernova'], supernova: ['black_hole', 'white_dwarf'],
    white_dwarf: ['white_dwarf', 'black_hole'], black_hole: ['white_dwarf', 'black_hole'] };
  const nomeQualunque = id => !id ? '' : luogoCosmo(id) && !(S().STOR_PERSONAGGI && S().STOR_PERSONAGGI[id]) ? nomeLuogo(id)
    : S().nome ? S().nome(id) : id;
  const eSonda = id => !!(S().profilo && S().profilo(id).famiglia === 'sonda');
  const eMacchina = id => !!(S().profilo && ['sonda', 'stazione'].includes(S().profilo(id).famiglia));

  // Quello che è successo nell'episodio, in ordine. Funzione pura.
  function studioFattiEpisodio(progetto) {
    const f = { battute: [], parlato: new Map(), umori: new Map(), mete: [], viaggi: new Map(), vesti: [], presenti: new Set(),
      litigi: [], nominati: [], luoghi: [], partenze: [] };
    const tutti = Object.keys(S().STOR_PERSONAGGI || {});
    let prima = null;
    for (const sc of progetto.scene) {
      studioPresenti(progetto, sc).forEach(id => f.presenti.add(id));
      if (sc.ambiente === 'cosmo' && sc.cosmoA && !f.luoghi.includes(sc.cosmoA)) f.luoghi.push(sc.cosmoA);
      for (const m of sc.momenti) {
        const testo = unaRiga(m.testo);
        if (m.chi && testo) {
          const umore = m.umore || studioUmoreDalTesto(testo) || '';
          const b = { chi: m.chi, testo, umore };
          f.battute.push(b);
          f.parlato.set(m.chi, (f.parlato.get(m.chi) || 0) + 1);
          if (umore) f.umori.set(m.chi, umore);
          // Un litigio: chi risponde a un altro con un «no», un «sbagli»,
          // un «invece», o con la faccia dura
          if (prima && prima.chi !== m.chi && (trova(normalizza(testo), 'disaccordo') || UMORI_DURI.includes(umore)))
            f.litigi.push([prima.chi, m.chi]);
          // Chi è nominato: con la maiuscola, perché «io» non è Io e «sole»
          // in «sole parole» non è il Sole (la normalizzazione tiene le posizioni)
          // (e «Io sono…» a inizio frase non è la luna: `studio.parole.pronomi`)
          const norm = normalizza(testo);
          for (const n of personaggiNelTesto(norm, tutti)) {
            const iniziale = testo.charAt(n.pos);
            if (parole('pronomi').includes(norm.slice(n.pos, n.fine))) continue;
            if (n.id !== m.chi && iniziale !== iniziale.toLowerCase() && !f.nominati.includes(n.id)) f.nominati.push(n.id);
          }
          prima = b;
        }
        for (const a of m.azioni || []) {
          if (a.tipo === 'umore' && a.chi && a.umore) f.umori.set(a.chi, a.umore);
          if (a.tipo === 'muovi' && a.chi && a.verso && !POSTI_SCHERMO.includes(a.verso)) {
            if (!f.mete.includes(a.verso)) f.mete.push(a.verso);
            f.viaggi.delete(a.chi); f.viaggi.set(a.chi, a.verso);
            f.partenze.push([a.chi, a.verso]);
          }
          if (a.tipo === 'torna' && a.chi) f.viaggi.delete(a.chi);
          if (a.tipo === 'diventa' && a.chi) f.vesti.push({ chi: a.chi, forma: a.forma });
        }
      }
    }
    return f;
  }

  // I candidati, uno per tipo (o null), col loro punteggio
  function candidatiDomanda(progetto, f) {
    const c = {};
    const parlanti = [...f.parlato.keys()];
    const protagonista = parlanti.slice().sort((a, b) => f.parlato.get(b) - f.parlato.get(a))[0] || progetto.cast[0] || '';
    const terzo = coppia => [...f.presenti].find(id => !coppia.includes(id) && f.parlato.has(id)) || coppia[1];
    const voce = (tipo, punteggio, dati, chi, a, b) => ({ tipo, punteggio, dati, chi: chi || protagonista, a: a || '', b: b || '' });
    // Chi ha ragione: l'ultimo litigio, o due che chiudono con facce opposte
    const litigio = f.litigi[f.litigi.length - 1];
    const duri = parlanti.filter(id => UMORI_DURI.includes(f.umori.get(id)));
    const gentili = parlanti.filter(id => UMORI_GENTILI.includes(f.umori.get(id)) || !f.umori.get(id));
    const coppiaUmori = duri.length && gentili.find(id => id !== duri[0]) ? [duri[0], gentili.find(id => id !== duri[0])] : null;
    const coppiaRagione = litigio || coppiaUmori;
    if (coppiaRagione) {
      const [x, y] = coppiaRagione;
      c.ragione = voce('ragione', litigio ? 3 : 2.2, { a: nomeQualunque(x), b: nomeQualunque(y) }, terzo(coppiaRagione), nomeQualunque(x), nomeQualunque(y));
    }
    // Dove dovrebbe andare la sonda: le mete viste e chi è stato nominato
    const sonda = [...f.presenti].find(eSonda) || progetto.cast.find(eSonda);
    if (sonda) {
      const mete = [...new Set(f.mete.concat(f.nominati, [...f.presenti]))]
        .filter(id => id !== sonda && !eMacchina(id) && !POSTI_SCHERMO.includes(id));
      const riserva = ['Jupiter', 'Saturn', 'Neptune', 'Mars', 'Pluto'].filter(id => !mete.includes(id));
      const [a, b] = mete.concat(riserva);
      c.sonda = voce('sonda', f.viaggi.has(sonda) || f.mete.length ? 3 : 2.4,
        { sonda: nomeQualunque(sonda), a: nomeQualunque(a), b: nomeQualunque(b) }, sonda, nomeQualunque(a), nomeQualunque(b));
    }
    // Di chi ti fideresti: un bullo (o un infastidito) contro uno gentile
    const bullo = parlanti.find(id => ['bully', 'annoyed'].includes(f.umori.get(id)));
    const buono = bullo && gentili.find(id => id !== bullo);
    if (bullo && buono) c.fiducia = voce('fiducia', 2.6, { a: nomeQualunque(buono), b: nomeQualunque(bullo) }, terzo([buono, bullo]),
      nomeQualunque(buono), nomeQualunque(bullo));
    else if (parlanti.length >= 2 && f.litigi.length) {
      const [x, y] = f.litigi[f.litigi.length - 1];
      c.fiducia = voce('fiducia', 1.6, { a: nomeQualunque(x), b: nomeQualunque(y) }, terzo([x, y]), nomeQualunque(x), nomeQualunque(y));
    }
    // Quale oggetto celeste esplorare: dove si è andati, i luoghi della carta,
    // chi è stato nominato
    const oggetti = [...new Set(f.mete.concat(f.luoghi, f.nominati))].filter(id => !eMacchina(id));
    const esplorabili = oggetti.length >= 2 ? oggetti : [...new Set(oggetti.concat([...f.presenti].filter(id => !eMacchina(id))))];
    if (esplorabili.length >= 2) {
      const [a, b] = esplorabili.slice(-2);
      c.esplora = voce('esplora', oggetti.length >= 2 ? 2.2 : 1.4, { a: nomeQualunque(a), b: nomeQualunque(b) }, protagonista,
        nomeQualunque(a), nomeQualunque(b));
    }
    // A o B: chi è partito avrebbe potuto restare
    const [viaggiatore, meta] = [...f.viaggi.entries()].pop() || [];
    const ultimoViaggio = viaggiatore ? [viaggiatore, meta] : null;
    const partenza = ultimoViaggio || f.partenze[f.partenze.length - 1];
    if (partenza) {
      const [chi, dove] = partenza;
      const a = t('studio.domanda.scelta.vai', { meta: nomeQualunque(dove) }), b = t('studio.domanda.scelta.resta');
      c.ab = voce('ab', 1.8, { chi: nomeQualunque(chi), meta: nomeQualunque(dove) }, chi, a, b);
    }
    // La previsione: dopo una veste, che cosa viene; dopo un viaggio senza
    // ritorno, se tornerà a casa
    const veste = f.vesti.filter(v => v.forma !== 'self').pop();
    if (veste && STUDIO_DOPO_VESTE[veste.forma]) {
      const [x, y] = STUDIO_DOPO_VESTE[veste.forma].map(v => t('storie.veste.' + v));   // la fine della sua vita
      c.previsione = voce('previsione', 2.8, { chi: nomeQualunque(veste.chi), a: x, b: y }, veste.chi, x, y);
    } else if (ultimoViaggio) {
      const a = t('studio.domanda.scelta.torna'), b = t('studio.domanda.scelta.restaLa', { meta: nomeQualunque(ultimoViaggio[1]) });
      c.previsione = voce('previsione', 2, { chi: nomeQualunque(ultimoViaggio[0]), a, b }, ultimoViaggio[0], a, b);
      c.previsione.variante = 'Viaggio';
    }
    // Il protagonista del prossimo Short: chi è stato zitto, chi è stato
    // nominato senza esserci, poi chi ha parlato meno
    const zitti = [...f.presenti].filter(id => !f.parlato.has(id) && id !== protagonista);
    const fuori = f.nominati.filter(id => !f.presenti.has(id) && S().STOR_PERSONAGGI && S().STOR_PERSONAGGI[id]);
    const pochi = parlanti.filter(id => id !== protagonista).sort((a, b) => f.parlato.get(a) - f.parlato.get(b));
    const nuovi = [...new Set(zitti.concat(fuori, pochi))];
    if (nuovi.length >= 2) {
      const [a, b] = nuovi;
      c.protagonista = voce('protagonista', zitti.length || fuori.length ? 2 : 1, { a: nomeQualunque(a), b: nomeQualunque(b) }, protagonista,
        nomeQualunque(a), nomeQualunque(b));
    }
    return c;
  }

  /* La domanda di un progetto, o null. `{ tipo, kind, testo, a, b, chi,
   * punteggio, scritta }`: `scritta` quando l'ha scritta chi crea la storia. */
  function studioDomandaFinale(progetto) {
    const d = progetto.domanda || {};
    const modo = STUDIO_MODI_DOMANDA.includes(d.modo) ? d.modo : 'auto';
    // v432: la domanda è facoltativa, e c'è solo se chi scrive la accende
    if (d.attiva !== true || modo === 'mai') return null;
    const f = studioFattiEpisodio(progetto);
    const protagonista = [...f.parlato.keys()].sort((a, b) => f.parlato.get(b) - f.parlato.get(a))[0] || progetto.cast[0] || '';
    // Scritta a mano: vince sempre, con le scelte scritte accanto
    if (unaRiga(d.testo)) {
      const tipo = STUDIO_TIPI_DOMANDA.includes(d.tipo) ? d.tipo : 'ab';
      return { tipo, kind: STUDIO_KIND_DOMANDA[tipo], testo: unaRiga(d.testo).slice(0, 200), a: unaRiga(d.a).slice(0, 60),
        b: unaRiga(d.b).slice(0, 60), chi: progetto.cast.includes(d.chi) ? d.chi : protagonista, punteggio: Infinity, scritta: true };
    }
    if (f.battute.length < 2 && modo === 'auto') return null;
    const c = candidatiDomanda(progetto, f);
    let scelto = null;
    if (STUDIO_TIPI_DOMANDA.includes(d.tipo)) scelto = c[d.tipo] || null;
    else for (const tipo of STUDIO_TIPI_DOMANDA) if (c[tipo] && (!scelto || c[tipo].punteggio > scelto.punteggio)) scelto = c[tipo];
    if (!scelto || (modo === 'auto' && scelto.punteggio < STUDIO_DOMANDA_SOGLIA)) return null;
    const testo = t('studio.domanda.tpl.' + scelto.tipo + (scelto.variante || ''), scelto.dati);
    if (!testo) return null;
    return { tipo: scelto.tipo, kind: STUDIO_KIND_DOMANDA[scelto.tipo], testo: testo.slice(0, 200), a: scelto.a.slice(0, 60),
      b: scelto.b.slice(0, 60), chi: scelto.chi || protagonista, punteggio: scelto.punteggio, scritta: false };
  }

  // ===================================================================
  // 5. Gli aiuti: suggerimenti, comandi a parole, controllo dello scopo
  // ===================================================================

  // Le parole chiave stanno nei dizionari, separate da virgole; si usano
  // **tutte le lingue insieme**, così chi scrive in inglese con l'app in
  // italiano viene capito lo stesso.
  function normalizza(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'");
  }
  function dizionari() {
    const d = radice.ASTRO_DIZIONARI || (radice.window && radice.window.ASTRO_DIZIONARI) || {};
    return Object.values(d).filter(x => x && x.messaggi);
  }
  const cacheParole = new Map();
  function parole(chiave) {
    if (cacheParole.has(chiave)) return cacheParole.get(chiave);
    const tutte = new Set();
    for (const d of dizionari()) {
      const v = d.messaggi['studio.parole.' + chiave];
      if (typeof v === 'string') v.split(',').map(x => normalizza(x).trim()).filter(Boolean).forEach(x => tutte.add(x));
    }
    const elenco = [...tutte].sort((a, b) => b.length - a.length);
    cacheParole.set(chiave, elenco);
    return elenco;
  }
  /* La prima parola dell'elenco che compare nel testo, con la sua
   * posizione. Una voce che finisce con `*` è una radice («esplo*» prende
   * esplode, esplosione, explosion); le altre sono parole intere — «va»
   * non deve trovarsi dentro a «vanitosa». */
  function trova(testo, chiave) {
    let meglio = null;
    for (const voce of parole(chiave)) {
      const radiceSola = voce.endsWith('*');
      const p = radiceSola ? voce.slice(0, -1) : voce;
      if (!p) continue;
      const re = new RegExp('(^|[^a-z])' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (radiceSola ? '' : '(?![a-z])'));
      const m = re.exec(testo);
      const pos = m ? m.index + m[1].length : -1;
      // a pari posizione vince la più lunga: «oh no» prima di «oh»
      if (m && (!meglio || pos < meglio.pos || (pos === meglio.pos && p.length > meglio.parola.length))) meglio = { parola: p, pos };
    }
    return meglio;
  }

  // I luoghi dell'universo che si possono nominare a parole (quelli che sono
  // anche personaggi — la Via Lattea, Andromeda, Sirio — si trovano per nome)
  const STUDIO_POSTI_PAROLE = ['oort', 'kuiper', 'heliopause', 'galactic_center', 'orion_nebula', 'lmc', 'smc', 'triangulum',
    'virgo_cluster', 'great_attractor', 'laniakea', 'universe', 'local_group', 'local_bubble', 'orion_arm', 'local_cloud',
    'inner_planets', 'planets'];
  const STUDIO_UMORI = ['laughing', 'love', 'angry', 'bully', 'annoyed', 'happy', 'excited', 'surprised', 'worried', 'sad', 'thinking', 'sleepy', 'neutral'];
  /* La faccia giusta per una frase: le parole dell'umore prima, poi la
   * punteggiatura. Non è un'analisi del sentimento, ed è dichiarato: è un
   * suggerimento da accettare o cambiare. */
  function studioUmoreDalTesto(testo) {
    const s = normalizza(testo);
    if (!s.trim()) return null;
    let meglio = null;
    for (const u of STUDIO_UMORI) {
      const x = trova(s, 'umore.' + u);
      if (x && (!meglio || x.pos < meglio.pos || (x.pos === meglio.pos && x.parola.length > meglio.lun)))
        meglio = { umore: u, pos: x.pos, lun: x.parola.length };
    }
    if (meglio) return meglio.umore;
    const esclamativi = (s.match(/!/g) || []).length;
    if (/\?/.test(s)) return 'thinking';
    if (esclamativi >= 2) return 'excited';
    if (esclamativi === 1) return 'happy';
    return 'neutral';
  }

  /* Le idee per le azioni di un momento: dalle parole della battuta (un
   * «boom» chiede un'esplosione, «andiamo» un viaggio) e dalla faccia. Al
   * più sei, senza doppioni, e mai una che il momento ha già. */
  function studioIdeeAzioni(progetto, scena, momento) {
    const s = normalizza(momento.testo);
    const chi = momento.chi || studioPresenti(progetto, scena)[0] || '';
    const altri = studioPresenti(progetto, scena).filter(id => id !== chi);
    const idee = [];
    const metti = (tipo, campi) => idee.push(studioNuovaAzione(tipo, Object.assign({ chi }, campi)));
    const tre = scena.ambiente !== 'cielo';
    const effetti = { esplosione: 'explosion', festa: 'fireworks', amore: 'hearts', fulmine: 'lightning', luce: 'glow',
      cadente: 'shooting_star', fumo: 'smoke', urto: 'shockwave', scintille: 'sparkles', coriandoli: 'confetti', lampo: 'flash' };
    for (const [chiave, effetto] of Object.entries(effetti))
      if (trova(s, 'effetto.' + chiave)) metti('effetto', { effetto, dove: effetto === 'flash' ? 'center' : chi, quando: 'meta' });
    // Nell'universo, un luogo nominato è una meta: «andiamo fino alla nube di Oort»
    if (scena.ambiente === 'cosmo') {
      const posto = STUDIO_POSTI_PAROLE.find(k => trova(s, 'posto.' + k));
      if (posto) metti('muovi', { verso: posto, percorso: 'arc' });
    }
    if (tre && altri.length && trova(s, 'muovi')) metti('muovi', { verso: altri[0], percorso: 'arc' });
    if (tre && trova(s, 'torna')) metti('torna', {});
    if (trova(s, 'grande')) metti('scala', { scala: 1.8 });
    if (trova(s, 'piccolo')) metti('scala', { scala: 0.6 });
    if (trova(s, 'saluto')) metti('anima', { animazione: 'nod' });
    const umore = momento.umore || studioUmoreDalTesto(momento.testo) || '';
    const perUmore = {
      happy: [['anima', { animazione: 'jump' }], ['effetto', { effetto: 'sparkles' }]],
      excited: [['anima', { animazione: 'dance' }], ['effetto', { effetto: 'confetti' }]],
      surprised: [['anima', { animazione: 'wobble' }], ['effetto', { effetto: 'shockwave' }]],
      worried: [['anima', { animazione: 'shake' }]],
      sad: [['scala', { scala: 0.8 }]],
      thinking: [['anima', { animazione: 'nod' }]],
      sleepy: [['anima', { animazione: 'wobble' }]],
      laughing: [['anima', { animazione: 'bounce' }], ['effetto', { effetto: 'confetti' }]],
      love: [['effetto', { effetto: 'hearts' }], ['anima', { animazione: 'pulse' }]],
      angry: [['anima', { animazione: 'shake' }], ['effetto', { effetto: 'smoke' }]],
      annoyed: [['anima', { animazione: 'shake' }]],
      bully: [['scala', { scala: 1.3 }], ['anima', { animazione: 'pulse' }]]
    }[umore] || [];
    for (const [tipo, campi] of perUmore) metti(tipo, Object.assign({ dove: tipo === 'effetto' ? chi : '' }, campi));
    if (altri.length) metti('guarda', { oggetto: altri[0] });
    const firma = a => [a.tipo, a.chi, a.animazione, a.effetto, a.verso, a.scala].join('|');
    const gia = new Set((momento.azioni || []).map(firma));
    const viste = new Set();
    return idee.filter(a => { const f = firma(a); if (gia.has(f) || viste.has(f)) return false; viste.add(f); return true; }).slice(0, 6);
  }

  // L'ambiente adatto a chi è in scena
  function studioAmbientePer(presenti) {
    const p = presenti || [];
    if (p.some(soloCosmo)) return { ambiente: 'cosmo' };
    if (p.length && p.every(id => id === 'Moon' || id === 'Earth' || id === 'Sun') && p.includes('Moon')) return { ambiente: 'terra_luna' };
    if (p.some(id => /^Star\d/.test(id))) return { ambiente: 'cielo', fuoco: p.find(id => STUDIO_FUOCHI_CIELO.includes(id)) || 'Moon' };
    const pianeti = p.filter(id => STUDIO_INQUADRABILI.includes(id));
    if (pianeti.length === 1 && STUDIO_FUOCHI_3D.includes(pianeti[0])) return { ambiente: 'pianeta', fuoco: pianeti[0] };
    return { ambiente: 'sistema' };
  }

  /* Il momento dopo: parla qualcuno che non ha appena parlato (a turno fra
   * chi è in scena), con una bozza adatta al punto della storia — il
   * principio presenta e domanda, il mezzo risponde, la fine ricorda lo
   * scopo. */
  function studioProssimoMomento(progetto, scena) {
    const presenti = studioPresenti(progetto, scena);
    const tutti = progetto.scene.flatMap(sc => sc.momenti);
    const ultimo = [...scena.momenti].reverse().find(m => m.chi) || [...tutti].reverse().find(m => m.chi);
    const parlati = new Set(tutti.filter(m => m.chi && m.testo).map(m => m.chi));
    let chi = presenti.find(id => !parlati.has(id) && (!ultimo || id !== ultimo.chi)) ||
      presenti.find(id => !ultimo || id !== ultimo.chi) || presenti[0] || '';
    const nome = chi && S().nome ? S().nome(chi) : chi;
    const altro = ultimo && ultimo.chi && ultimo.chi !== chi && S().nome ? S().nome(ultimo.chi) : '';
    const posto = tutti.length;
    const fase = posto <= 1 ? 'inizio' : (progetto.scene.indexOf(scena) === progetto.scene.length - 1 && posto >= 3 ? 'fine' : 'mezzo');
    // Nella scala cosmica, a metà storia, la bozza è un fatto vero della
    // tappa a cui la camera sta arrivando: è la carta a suggerire che cosa dire
    let fatto = '';
    if (scena.ambiente === 'cosmo' && fase === 'mezzo') {
      const n = scena.momenti.length + 1;
      const durate = scena.momenti.map(studioDurata).concat(6);
      const tappe = studioViaggioCosmo(scena, scena.momenti.concat(studioNuovoMomento()), durate);
      fatto = t('studio.fatto.' + studioTappaVicina(tappe[n - 1][1]));
    }
    const testo = fatto || (fase === 'fine' && unaRiga(progetto.obiettivo)
      ? t('studio.bozza.scopo', { obiettivo: unaRiga(progetto.obiettivo) })
      : t('studio.bozza.' + fase + (altro ? 'Altro' : ''), { nome, altro }));
    const umore = studioUmoreDalTesto(testo) || '';
    return studioNuovoMomento({ chi, testo, umore: fase === 'inizio' ? 'happy' : umore });
  }

  // I nomi con cui si può chiamare un personaggio, in tutte le lingue
  function nomiDi(id) {
    const nomi = new Set([normalizza(id)]);
    for (const d of dizionari()) {
      for (const k of ['corpo.' + id, 'studio.alias.' + id]) {
        const v = d.messaggi[k];
        if (typeof v === 'string') v.split(',').forEach(x => { const n = normalizza(x).trim(); if (n) nomi.add(n); });
      }
    }
    if (S().nome) nomi.add(normalizza(S().nome(id)));
    const p = S().STOR_PERSONAGGI && S().STOR_PERSONAGGI[id];
    if (p && p.alias) p.alias.forEach(a => nomi.add(normalizza(a)));
    return [...nomi].filter(n => n.length >= 2);
  }
  function personaggiNelTesto(s, candidati) {
    const trovati = [];
    for (const id of candidati) {
      for (const n of nomiDi(id)) {
        const re = new RegExp('(^|[^a-z0-9])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-z0-9])');
        const m = re.exec(s);
        if (m) { trovati.push({ id, pos: m.index + m[1].length, fine: m.index + m[1].length + n.length }); break; }
      }
    }
    return trovati.sort((a, b) => a.pos - b.pos);
  }

  /* I comandi a parole. Una riga (o una frase) alla volta:
   *   «Giove: Benvenuto!» / «Giove dice: Benvenuto!»   → un momento nuovo
   *   «Marte vola verso Giove facendo un giro»         → un viaggio (loop)
   *   «Marte torna a casa», «Saturno salta tre volte»,
   *   «Giove diventa grande», «la Luna è triste»,
   *   «esplosione su Saturno», «Luna guarda la Terra», «alla fine …»
   * Restituisce le operazioni capite e le frasi non capite: è
   * `studioApplica` a metterle nel progetto. Funzione pura. */
  function studioCapisci(testo, progetto) {
    const candidati = [...new Set(progetto.cast.concat(Object.keys((S().STOR_PERSONAGGI) || {})))];
    const ops = [], nonCapite = [];
    const righe = String(testo || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
    for (const riga of righe) {
      // Una battuta: il nome, poi «dice» o i due punti, poi le parole
      const nr = normalizza(riga);
      const chiDice = personaggiNelTesto(nr, candidati)[0];
      const dice = trova(nr, 'dice');
      const duePunti = riga.indexOf(':');
      if (chiDice && ((duePunti > 0 && normalizza(riga.slice(0, duePunti)).trim().length <= chiDice.fine + 12 &&
          chiDice.pos < duePunti) || (dice && dice.pos >= chiDice.fine && dice.pos - chiDice.fine < 6))) {
        let resto = duePunti > 0 && chiDice.pos < duePunti ? riga.slice(duePunti + 1) : riga.slice(dice.pos + dice.parola.length);
        resto = resto.replace(/^[\s:,]+/, '').replace(/^["«“']+|["»”']+$/g, '').trim();
        if (resto) { ops.push({ op: 'battuta', chi: chiDice.id, testo: resto.slice(0, 400), umore: studioUmoreDalTesto(resto) }); continue; }
      }
      const frasi = riga.split(/(?<=[.;!?])\s+|\s+(?:e poi|poi|then|and then)\s+/i).map(x => x.trim()).filter(Boolean);
      for (const frase of frasi) {
        const s = normalizza(frase);
        const chi = personaggiNelTesto(s, candidati);
        const soggetto = chi[0] ? chi[0].id : '';
        const oggetto = chi[1] ? chi[1].id : '';
        const quando = trova(s, 'quando.fine') ? 'fine' : trova(s, 'quando.meta') ? 'meta' : trova(s, 'quando.inizio') ? 'inizio' : null;
        const numero = (() => {
          const m = /(\d+)\s*(?:volt|times|giri|turns)/.exec(s);
          if (m) return Number(m[1]);
          for (const [n, k] of [[2, 'due'], [3, 'tre'], [4, 'quattro'], [5, 'cinque']]) if (trova(s, 'numero.' + k)) return n;
          return 0;
        })();
        let capita = false;
        const azione = (tipo, campi) => { ops.push({ op: 'azione', azione: studioNuovaAzione(tipo, Object.assign({ chi: soggetto }, campi, quando ? { quando } : {})) }); capita = true; };
        // Gli effetti per primi: «Marte esplode» è un botto, non un viaggio
        const effetti = { esplosione: 'explosion', urto: 'shockwave', lampo: 'flash', scintille: 'sparkles', festa: 'fireworks',
          fumo: 'smoke', amore: 'hearts', fulmine: 'lightning', cadente: 'shooting_star', luce: 'glow', coriandoli: 'confetti' };
        for (const [chiave, effetto] of Object.entries(effetti)) {
          if (trova(s, 'effetto.' + chiave)) {
            const sopra = oggetto || soggetto;
            azione('effetto', { effetto, dove: effetto === 'flash' ? 'center' : (sopra || 'center'), quando: quando || 'inizio' });
            break;
          }
        }
        if (soggetto) {
          const percorso = trova(s, 'percorso.loop') ? 'loop' : trova(s, 'percorso.hop') ? 'hop' : trova(s, 'percorso.spiral') ? 'spiral' :
            trova(s, 'percorso.zigzag') ? 'zigzag' : trova(s, 'percorso.teleport') ? 'teleport' : trova(s, 'percorso.straight') ? 'straight' : 'arc';
          const luogo = trova(s, 'luogo.center') ? 'center' : trova(s, 'luogo.left') ? 'left' : trova(s, 'luogo.right') ? 'right' :
            trova(s, 'luogo.top') ? 'top' : trova(s, 'luogo.bottom') ? 'bottom' : '';
          // I luoghi dell'universo: «Voyager va verso la nube di Oort»
          let posto = '', piuPresto = Infinity;
          for (const k of STUDIO_POSTI_PAROLE) { const x = trova(s, 'posto.' + k); if (x && x.pos < piuPresto) { piuPresto = x.pos; posto = k; } }
          // «Il Sole diventa una gigante rossa», «il Sole torna com'era»
          // (v414): la veste vince sul viaggio e sulla misura, che hanno
          // parole in comune («si gonfia», «torna»)
          const forma = STUDIO_FORME.find(f => trova(s, 'veste.' + f));
          if (forma) azione('diventa', { forma, quando: quando || 'tutto' });
          else if (trova(s, 'torna')) azione('torna', { percorso: percorso === 'arc' ? 'arc' : percorso, quando: quando || 'tutto' });
          else if (trova(s, 'muovi') && (oggetto || posto || luogo)) azione('muovi', { verso: oggetto || posto || luogo, percorso, quando: quando || 'tutto' });
          for (const a of ['jump', 'bounce', 'shake', 'nod', 'spin', 'pulse', 'dance', 'wobble'])
            if (trova(s, 'anima.' + a)) { azione('anima', { animazione: a, volte: numero }); break; }
          if (forma) { /* la misura la porta la veste */ }
          else if (trova(s, 'grande')) azione('scala', { scala: 1.8 });
          else if (trova(s, 'piccolo')) azione('scala', { scala: 0.55 });
          else if (trova(s, 'normale')) azione('scala', { scala: 1 });
          if (trova(s, 'guarda')) azione('guarda', { oggetto: oggetto || 'viewer' });
          if (trova(s, 'occhiolino')) azione('occhiolino', {});
          if (trova(s, 'nascondi')) azione('nascondi', {});
          for (const u of STUDIO_UMORI) if (trova(s, 'umore.' + u)) { azione('umore', { umore: u }); break; }
        }
        if (!capita) nonCapite.push(frase);
      }
    }
    return { ops, nonCapite };
  }
  // Mette nel progetto quello che `studioCapisci` ha capito: una battuta
  // apre un momento nuovo, le azioni vanno nell'ultimo momento.
  function studioApplica(progetto, indiceScena, ops) {
    const scena = progetto.scene[indiceScena] || progetto.scene[progetto.scene.length - 1];
    if (!scena) return [];
    const fatte = [];
    let momento = scena.momenti[scena.momenti.length - 1];
    for (const o of ops) {
      const chi = o.op === 'battuta' ? o.chi : o.azione.chi;
      if (chi && !progetto.cast.includes(chi)) progetto.cast.push(chi);
      if (chi && scena.presenti.length && !scena.presenti.includes(chi)) scena.presenti.push(chi);
      if (o.op === 'battuta') {
        if (momento && !momento.testo && !momento.chi) Object.assign(momento, { chi: o.chi, testo: o.testo, umore: o.umore || '' });
        else { momento = studioNuovoMomento({ chi: o.chi, testo: o.testo, umore: o.umore || '' }); scena.momenti.push(momento); }
      } else {
        if (!momento) { momento = studioNuovoMomento(); scena.momenti.push(momento); }
        if (o.azione.tipo === 'muovi' && o.azione.verso && !['center', 'left', 'right', 'top', 'bottom'].includes(o.azione.verso) &&
            !progetto.cast.includes(o.azione.verso)) progetto.cast.push(o.azione.verso);
        momento.azioni.push(o.azione);
      }
      fatte.push(o);
    }
    return fatte;
  }

  // La frase che descrive un'azione, per la lista di «Ho capito» e per le idee
  function studioDescriviAzione(a) {
    const nome = id => !id ? '' : ['center', 'left', 'right', 'top', 'bottom', 'viewer'].includes(id) ? t('studio.luogo.' + id)
      : luogoCosmo(id) && !(S().STOR_PERSONAGGI && S().STOR_PERSONAGGI[id]) ? nomeLuogo(id) : (S().nome ? S().nome(id) : id);
    const dati = {
      chi: nome(a.chi), verso: nome(a.verso), oggetto: nome(a.oggetto), dove: nome(a.dove || a.chi),
      umore: t('storie.espressione.' + a.umore), animazione: t('storie.animazione.' + a.animazione), forma: t('storie.veste.' + a.forma),
      percorso: t('storie.percorso.' + a.percorso), effetto: t('storie.effetto.' + a.effetto),
      scala: (() => { try { return new Intl.NumberFormat(haI18n() && radice.astroI18n.locale ? radice.astroI18n.locale() : 'it-IT').format(a.scala); } catch (_) { return String(a.scala); } })()
    };
    return t('studio.descrivi.' + a.tipo, dati);
  }

  /* Il controllo dello scopo: le cose che fanno funzionare una storia per
   * bambini, una per riga, con ✓ o con il consiglio. `valida` è il
   * validatore delle demo (se c'è): il copione deve anche partire. */
  function studioConsigli(progetto, valida) {
    const c = [];
    const metti = (ok, chiave, dati) => c.push({ ok, chiave, testo: t('studio.consiglio.' + chiave + (ok ? '.ok' : ''), dati) });
    const momenti = progetto.scene.flatMap(sc => sc.momenti.map(m => ({ m, sc })));
    const battute = momenti.filter(x => x.m.chi && unaRiga(x.m.testo));
    metti(!!unaRiga(progetto.titolo), 'titolo');
    metti(!!unaRiga(progetto.obiettivo), 'obiettivo');
    const muti = progetto.cast.filter(id => !battute.some(x => x.m.chi === id));
    metti(!muti.length && progetto.cast.length > 0, 'tutti', { nomi: muti.map(id => S().nome ? S().nome(id) : id).join(', ') });
    const prime = battute.slice(0, 2).map(x => x.m.testo).join(' ');
    metti(/\?/.test(prime), 'domanda');
    const parole = s => normalizza(s).split(/[^a-z0-9]+/).filter(w => w.length >= 5);
    const chiave = new Set(parole(progetto.obiettivo));
    const ultima = battute.length ? battute[battute.length - 1].m.testo : '';
    metti(!chiave.size || parole(ultima).some(w => chiave.has(w) || [...chiave].some(k => k.slice(0, 5) === w.slice(0, 5))), 'chiusura');
    const lunghe = battute.filter(x => unaRiga(x.m.testo).split(' ').length > STUDIO_PAROLE_BAMBINI);
    metti(!lunghe.length, 'brevi', { n: lunghe.length, max: STUDIO_PAROLE_BAMBINI });
    const durata = studioDurataTotale(progetto);
    metti(durata >= STUDIO_DURATA_IDEALE[0] && durata <= STUDIO_DURATA_IDEALE[1], 'durata',
      { n: durata, min: STUDIO_DURATA_IDEALE[0], max: STUDIO_DURATA_IDEALE[1] });
    const impossibili = momenti.filter(x => x.sc.ambiente === 'cielo' && x.m.azioni.some(a => a.tipo === 'muovi' || a.tipo === 'torna'));
    metti(!impossibili.length, 'viaggi', { n: impossibili.length });
    const vuote = momenti.filter(x => !unaRiga(x.m.testo) && !x.m.azioni.length);
    metti(!vuote.length, 'vuoti', { n: vuote.length });
    /* Le due cose che fanno ricordare una storia (v412). L'emozione: qualcuno
     * cambia faccia — si parte preoccupati, sorpresi, curiosi e si arriva
     * contenti; una storia con una faccia sola è un elenco. La meraviglia:
     * almeno un numero vero o un confronto («più grande della Terra», «due
     * milioni e mezzo di anni luce»), che è quello che un bambino racconta a
     * cena. Sono controlli a parole, dichiarati: suggerimenti, non giudizi. */
    const facce = new Set();
    for (const { m } of momenti) {
      if (m.umore) facce.add(m.umore);
      for (const a of m.azioni || []) if (a.tipo === 'umore' && a.umore) facce.add(a.umore);
    }
    metti(facce.size >= 2, 'emozione');
    const meraviglia = battute.some(x => /\d/.test(x.m.testo) || trova(normalizza(x.m.testo), 'meraviglia'));
    metti(meraviglia, 'meraviglia');
    if (typeof valida === 'function') {
      let errore = '';
      try { valida(studioCopione(progetto)); } catch (e) { errore = e.message; }
      metti(!errore, 'copione', { errore });
    }
    return c;
  }

  // ===================================================================
  // 6. L'archivio dei progetti
  // ===================================================================

  function archivio() {
    try { return radice.localStorage || null; } catch (_) { return null; }
  }
  function studioCaricaTutti() {
    const a = archivio();
    if (!a) return [];
    try {
      const dati = JSON.parse(a.getItem(CHIAVE) || '[]');
      return Array.isArray(dati) ? dati.map(p => { try { return studioRipulisci(p); } catch (_) { return null; } }).filter(Boolean) : [];
    } catch (_) { return []; }
  }
  function studioSalvaTutti(progetti) {
    const a = archivio();
    if (!a) return false;
    try { a.setItem(CHIAVE, JSON.stringify(progetti)); return true; } catch (_) { return false; }
  }

  /* Il file delle voci (v421). Le battute delle storie scritte qui non stanno
   * nei dizionari: sono testo di chi scrive, e vivono solo in questo browser.
   * Chi voleva dar loro una voce registrata non trovava le battute nel
   * copione delle voci (`audio/narrazione/storie/COPIONE.md`), e cancellare
   * una scena lasciava lì la regia e l'audio di prima. Adesso ogni «Salva
   * nelle mie demo» e ogni «Elimina» rifanno la fotografia delle storie
   * salvate (`astrocal_storie_voci_v1`), e da lì `storie-studio.json`, che va
   * in `audio/narrazione/storie/`: `scripts/voci-storie.js` (anche dal
   * workflow, quando il file arriva su GitHub) aggiunge al copione, alla
   * regia e al manifest le battute nuove e toglie quelle che non ci sono più,
   * con i loro audio.
   *
   * Ogni battuta ha un numero che non cambia (`voce` del momento), dato la
   * prima volta che si salva: togliere una scena non rinumera le altre, e i
   * loro audio restano giusti. Il file dice **tutte** le storie salvate in
   * questo browser: quello che non c'è più si cancella. */
  const CHIAVE_VOCI = 'astrocal_storie_voci_v1';
  const FILE_VOCI = 'storie-studio.json';
  function studioChiaveVoci(titolo, prese) {
    const radiceNome = 'studio_' + (unaRiga(titolo).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30).replace(/_+$/, '') || 'storia');
    let chiave = radiceNome, n = 2;
    while (prese.has(chiave)) chiave = radiceNome + '_' + n++;
    return chiave;
  }
  /* Le battute di un progetto come le dice il copione (`studioCopione`):
   * una per momento, solo se chi parla è in scena e ha qualcosa da dire, con
   * la scena del DSL in cui cade (un momento è una scena) e la sua durata.
   * Dà il numero ai momenti che non l'hanno e il nome alla storia, quindi
   * cambia il progetto: va salvato dopo. `prese` sono i nomi delle altre
   * storie, perché due storie con lo stesso titolo non si mescolino. */
  function studioVociStoria(progetto, lingua, prese = new Set()) {
    if (!progetto.voceChiave || prese.has(progetto.voceChiave)) progetto.voceChiave = studioChiaveVoci(progetto.titolo, prese);
    const usati = new Set();
    for (const sc of progetto.scene) for (const m of sc.momenti) {
      if (m.voce > 0 && !usati.has(m.voce)) usati.add(m.voce);
      else m.voce = 0;
    }
    let prossima = Math.max(progetto.voceProssima || 1, ...[...usati].map(n => n + 1));
    const battute = [];
    let scena = 0;
    for (const sc of progetto.scene) {
      const presenti = studioPresenti(progetto, sc);
      const momenti = sc.momenti.length ? sc.momenti : [studioNuovoMomento()];
      for (const m of momenti) {
        scena++;
        const testo = unaRiga(m.testo).slice(0, 400);
        if (!m.chi || !presenti.includes(m.chi) || !testo) continue;
        if (!m.voce) m.voce = prossima++;
        battute.push({ n: m.voce, chi: m.chi, testo, umore: m.umore || '', scena, durata: Math.round(studioDurata(m) * 1000) });
      }
    }
    progetto.voceProssima = prossima;
    return {
      chiave: progetto.voceChiave, progetto: progetto.id, titolo: unaRiga(progetto.titolo).slice(0, 120),
      lingua: lingua === 'en' ? 'en' : 'it', battute
    };
  }
  function studioVociCarica() {
    const a = archivio();
    try {
      const dati = JSON.parse((a && a.getItem(CHIAVE_VOCI)) || '{}');
      return dati && typeof dati === 'object' && !Array.isArray(dati) ? dati : {};
    } catch (_) { return {}; }
  }
  function studioVociSalva(fotografie) {
    const a = archivio();
    try { if (a) a.setItem(CHIAVE_VOCI, JSON.stringify(fotografie)); } catch (_) { /* resta quella di prima */ }
  }
  // Il contenuto di `storie-studio.json`, nell'ordine dei nomi (un file che
  // non cambia se le storie non cambiano: niente commit inutili)
  function studioFileVoci(fotografie) {
    const storie = Object.values(fotografie).filter(f => f && STUDIO_VOCE_CHIAVE.test(f.chiave) && Array.isArray(f.battute))
      .sort((a, b) => a.chiave < b.chiave ? -1 : a.chiave > b.chiave ? 1 : 0)
      .map(f => ({ chiave: f.chiave, titolo: f.titolo, lingua: f.lingua, battute: f.battute }));
    return JSON.stringify({
      _leggimi: 'Le battute delle storie fatte nello Studio delle storie, scritto dallo Studio (Altro → File delle voci). ' +
        'Va in audio/narrazione/storie/: scripts/voci-storie.js le mette nel copione, nella regia e nel manifest, e toglie quelle che non ci sono più, audio compresi. Non modificarlo a mano.',
      v: 1, storie
    }, null, 2) + '\n';
  }
  const linguaStudio = () => {
    const l = haI18n() && typeof radice.astroI18n.lingua === 'function' ? radice.astroI18n.lingua() : 'it';
    return String(l || 'it').toLowerCase().startsWith('en') ? 'en' : 'it';
  };

  /* Dove scriverlo. Sui browser che lo sanno fare (Chrome, Edge) si sceglie
   * una volta la cartella del progetto, e da lì ogni salvataggio riscrive il
   * file da solo: la cartella si ricorda in IndexedDB (una maniglia di
   * cartella non entra in `localStorage`). Altrove, e quando la cartella non
   * è collegata, il bottone scarica il file. */
  const DB_VOCI = 'astrocal-studio-voci';
  // Due scaffali: la maniglia della cartella e (v422) gli audio caricati a
  // mano per le battute, `<progetto>|<numero della battuta>` → { blob, … }
  function dbVoci(fai2, scaffale = 'maniglie') {
    return new Promise((si, no) => {
      if (typeof indexedDB === 'undefined') { no(new Error('indexedDB')); return; }
      let r;
      try { r = indexedDB.open(DB_VOCI, 2); } catch (e) { no(e); return; }
      r.onupgradeneeded = () => {
        for (const n of ['maniglie', 'audio']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n);
      };
      r.onerror = () => no(r.error || new Error('indexedDB'));
      r.onsuccess = () => {
        const db = r.result;
        let tx, q;
        // Una maniglia che non si può copiare (`put`) lancia qui dentro, fuori
        // dalla promessa: senza questo, chi aspetta aspetterebbe per sempre
        try { tx = db.transaction(scaffale, 'readwrite'); q = fai2(tx.objectStore(scaffale)); }
        catch (e) { db.close(); no(e); return; }
        tx.oncomplete = () => { db.close(); si(q && q.result); };
        tx.onerror = () => { db.close(); no(tx.error || new Error('indexedDB')); };
      };
    });
  }
  const cartellaSalvata = () => dbVoci(s => s.get('cartella')).catch(() => null);
  // Chi sceglie la radice del progetto (o `audio/`, o `narrazione/`) arriva
  // lo stesso a `audio/narrazione/storie/`
  async function cartellaDelleVoci(scelta) {
    const scendi = async (dir, nomi) => {
      let d = dir;
      for (const n of nomi) d = await d.getDirectoryHandle(n);
      return d;
    };
    for (const strada of [['audio', 'narrazione', 'storie'], ['narrazione', 'storie'], ['storie']]) {
      try { return await scendi(scelta, strada); } catch (_) { /* la prossima */ }
    }
    return scelta;
  }
  function scaricaVoci(testo) {
    const blob = new Blob([testo], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: FILE_VOCI });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  /* Scrive il file. `chiedi`: dal bottone, si può aprire la scelta della
   * cartella (o scaricare); dopo un salvataggio, solo se la cartella è già
   * collegata. Restituisce come è andata: 'scritto', 'scaricato', 'nessuna'. */
  async function studioScriviVoci(chiedi) {
    const testo = studioFileVoci(studioVociCarica());
    const sa = typeof radice.showDirectoryPicker === 'function';
    let cartella = sa ? await cartellaSalvata() : null;
    if (cartella) {
      let permesso = 'denied';
      try {
        permesso = await cartella.queryPermission({ mode: 'readwrite' });
        if (permesso !== 'granted') permesso = await cartella.requestPermission({ mode: 'readwrite' });
      } catch (_) { permesso = 'denied'; }
      if (permesso !== 'granted') cartella = null;
    }
    if (!cartella && chiedi && sa) {
      try {
        const scelta = await radice.showDirectoryPicker({ id: 'astrocal-voci', mode: 'readwrite' });
        cartella = await cartellaDelleVoci(scelta);
        await dbVoci(s => s.put(cartella, 'cartella')).catch(() => null);
      } catch (e) {
        if (e && e.name === 'AbortError') return 'annullato';
        cartella = null;
      }
    }
    if (cartella) {
      const scriviFile = async (dir, nome, dati) => {
        const f = await dir.getFileHandle(nome, { create: true });
        const w = await f.createWritable();
        await w.write(dati);
        await w.close();
      };
      await scriviFile(cartella, FILE_VOCI, testo);
      // Le voci caricate nello Studio, ognuna nella cartella del suo
      // personaggio e col nome del copione: dopo il commit suonano per tutti
      for (const v of await vociDaScrivere()) {
        try {
          let dir = cartella;
          for (const n of [v.cartella, v.lingua]) dir = await dir.getDirectoryHandle(n, { create: true });
          await scriviFile(dir, v.nome, v.blob);
        } catch (_) { /* una voce che non si scrive non ferma le altre */ }
      }
      return 'scritto';
    }
    if (chiedi) { scaricaVoci(testo); return 'scaricato'; }
    return 'nessuna';
  }
  // Le fotografie da rifare dopo un salvataggio o una cancellazione, e il file
  function aggiornaVoci({ salvata, tolta, chiedi }) {
    const foto = studioVociCarica();
    for (const [k, f] of Object.entries(foto)) {
      const id = f && f.progetto;
      if (!f || (tolta && id === tolta) || (salvata && id === salvata.id)) delete foto[k];
    }
    if (salvata) {
      const prese = new Set(Object.keys(foto));
      for (const altro of studio.progetti) if (altro.id !== salvata.id && altro.voceChiave) prese.add(altro.voceChiave);
      salvata.lingua = linguaStudio();
      const f = studioVociStoria(salvata, salvata.lingua, prese);
      foto[f.chiave] = f;
    }
    studioVociSalva(foto);
    const storie = Object.keys(foto).length;
    const battute = Object.values(foto).reduce((n, f) => n + f.battute.length, 0);
    return studioScriviVoci(chiedi).then(come => {
      if (come === 'scritto') return t('studio.voci.scritto', { storie, battute });
      if (come === 'scaricato') return t('studio.voci.scaricato', { storie, battute });
      return '';
    }).catch(e => t('studio.voci.errore', { errore: e && e.message || String(e) }));
  }

  /* Le voci caricate a mano (v422). Per ogni battuta si può caricare il suo
   * file audio: resta in questo browser (IndexedDB, scaffale `audio`), suona
   * al posto della sintesi (`narrazione.voceLocale`, riconosciuta dal
   * testo: vale anche per la storia salvata nelle demo) e la durata del
   * momento la segue (`studioDurata`). Con la cartella del progetto
   * collegata, «File delle voci» la scrive anche nel progetto, nella
   * cartella del personaggio e col nome del copione. */
  const STUDIO_AUDIO_MAX = 10 * 1024 * 1024;
  const STUDIO_ESTENSIONI = /\.(mp3|wav|ogg|oga|opus|m4a|aac|webm)$/i;
  const vociCaricate = new Map();         // `<progetto>|<n>` → { url, testo }
  const chiaveAudio = (pid, n) => pid + '|' + n;
  function registraVoce(k, testo, url) {
    const prima = vociCaricate.get(k);
    const narr = radice.narrazione;
    if (prima) {
      if (narr && narr.voceLocale) narr.voceLocale(prima.testo, '');
      if (prima.url && typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(prima.url);
      vociCaricate.delete(k);
    }
    if (url) {
      vociCaricate.set(k, { url, testo });
      if (narr && narr.voceLocale) narr.voceLocale(testo, url);
    }
  }
  // Tutti i record dello scaffale, con la loro chiave
  function tutteLeVoci() {
    const trovate = [];
    return dbVoci(st => {
      const c = st.openCursor();
      c.onsuccess = () => { const x = c.result; if (x) { trovate.push({ chiave: x.key, rec: x.value }); x.continue(); } };
      return null;
    }, 'audio').then(() => trovate, () => []);
  }
  // La durata vera del file: dall'elemento audio, o decodificandolo (un
  // webm registrato dal telefono dice «Infinity» all'elemento)
  function misuraDurata(blob) {
    return new Promise(si => {
      let finito = false;
      const fine = v => { if (!finito) { finito = true; si(v > 0 && Number.isFinite(v) ? Math.round(v * 1000) : 0); } };
      const decodifica = () => {
        const C = radice.AudioContext || radice.webkitAudioContext;
        if (!C || !blob.arrayBuffer) { fine(0); return; }
        const ctx = new C();
        blob.arrayBuffer().then(b => ctx.decodeAudioData(b)).then(a => fine(a.duration), () => fine(0))
          .finally(() => { try { ctx.close(); } catch (_) { /* niente */ } });
      };
      if (typeof Audio === 'undefined') { decodifica(); return; }
      const a = new Audio();
      const url = URL.createObjectURL(blob);
      a.preload = 'metadata';
      a.onloadedmetadata = () => { const d = a.duration; URL.revokeObjectURL(url); if (Number.isFinite(d) && d > 0) fine(d); else decodifica(); };
      a.onerror = () => { URL.revokeObjectURL(url); decodifica(); };
      setTimeout(() => { if (!finito) decodifica(); }, 6000);
      a.src = url;
    });
  }
  async function caricaVoce(dove, file) {
    const p = studio.progetto, m = leggi(dove);
    if (!m || !file) return;
    if (file.size > STUDIO_AUDIO_MAX) { esito(t('studio.voce.troppoGrande')); return; }
    if (!/^audio\//.test(file.type || '') && !STUDIO_ESTENSIONI.test(file.name || '')) { esito(t('studio.voce.nonAudio')); return; }
    const testo = testoDetto(m);
    if (!m.chi || !testo) { esito(t('studio.voce.primaIlTesto')); return; }
    const durata = await misuraDurata(file);
    if (!durata) { esito(t('studio.voce.nonAudio')); return; }
    if (!m.voce) {
      const usati = p.scene.flatMap(sc => sc.momenti.map(x => x.voce || 0));
      m.voce = Math.max(p.voceProssima || 1, ...usati.map(n => n + 1));
      p.voceProssima = m.voce + 1;
    }
    const k = chiaveAudio(p.id, m.voce);
    try { await dbVoci(st => st.put({ blob: file, nome: file.name || '', tipo: file.type || '', durata, testo }, k), 'audio'); }
    catch (e) { esito(t('studio.voci.errore', { errore: e && e.message || String(e) })); return; }
    registraVoce(k, testo, URL.createObjectURL(file));
    m.audio = { durata, impronta: studioImpronta(testo), nome: String(file.name || '').slice(0, 80) };
    salvaPresto();
    disegna();
    const caricata = t('studio.voce.caricata', { secondi: secondiDi(durata), durata: studioDurata(m) });
    esito(caricata);
    // v424: l'audio va subito anche sul repository (§6b), nella cartella del
    // personaggio, perché suoni dagli altri dispositivi; una storia mai
    // salvata ce lo manda al primo «Salva nelle mie demo»
    if (!condivisa(p)) { esito(caricata + ' ' + t('studio.repo.audioDopo')); return; }
    if (!studioRepoImpostazioni().token) { esito(caricata + ' ' + t('studio.repo.senzaToken')); return; }
    esito(caricata + ' ' + t('studio.repo.inCorso'));
    const msg = await aggiornaVoci({ salvata: p, chiedi: false });
    salvaPresto();
    esito(caricata + ' ' + (msg ? msg + ' ' : '') + await studioSincronizza({ spingi: true, titolo: p.titolo }));
  }
  function togliVoce(m) {
    if (!m || !m.voce) { if (m) m.audio = null; return; }
    const k = chiaveAudio(studio.progetto.id, m.voce);
    registraVoce(k, '', '');
    dbVoci(st => st.delete(k), 'audio').catch(() => null);
    m.audio = null;
  }
  let anteprima = null;
  function ascoltaVoce(m) {
    const v = m && m.voce && vociCaricate.get(chiaveAudio(studio.progetto.id, m.voce));
    if (anteprima) { try { anteprima.pause(); } catch (_) { /* niente */ } }
    if (!v || typeof Audio === 'undefined') return;
    anteprima = new Audio(v.url);
    anteprima.play().catch(() => null);
  }
  const secondiDi = ms => (Math.round(ms / 100) / 10).toLocaleString(linguaStudio() === 'en' ? 'en' : 'it');
  /* All'avvio: le voci di tutte le storie tornano a suonare; quelle di
   * momenti o storie che non ci sono più si buttano (lo spazio del browser
   * non è infinito). */
  async function studioRiprendiVoci() {
    const vive = new Map();
    for (const p of studio.progetti) for (const sc of p.scene) for (const m of sc.momenti) if (m.voce && m.audio) vive.set(chiaveAudio(p.id, m.voce), m);
    for (const { chiave, rec } of await tutteLeVoci()) {
      if (!vive.has(chiave) || !rec || !rec.blob) { dbVoci(st => st.delete(chiave), 'audio').catch(() => null); continue; }
      registraVoce(chiave, rec.testo, URL.createObjectURL(rec.blob));
    }
  }
  // Una storia duplicata si porta dietro le sue voci
  async function copiaVoci(da, a) {
    for (const { chiave, rec } of await tutteLeVoci()) {
      if (!String(chiave).startsWith(da + '|')) continue;
      const k = a + chiave.slice(da.length);
      await dbVoci(st => st.put(rec, k), 'audio').catch(() => null);
      registraVoce(k, rec.testo, URL.createObjectURL(rec.blob));
    }
  }
  function cancellaVoci(pid) {
    tutteLeVoci().then(tutte => {
      for (const { chiave } of tutte) if (String(chiave).startsWith(pid + '|')) {
        registraVoce(chiave, '', '');
        dbVoci(st => st.delete(chiave), 'audio').catch(() => null);
      }
    });
  }
  // Il nome italiano di un personaggio, da cui la sua cartella delle voci:
  // la stessa strada di `nomeDi` in scripts/voci-storie.js
  function cartellaPersonaggio(id) {
    const diz = (radice.ASTRO_DIZIONARI && radice.ASTRO_DIZIONARI.it && radice.ASTRO_DIZIONARI.it.messaggi) || {};
    const pg = (S().STOR_PERSONAGGI || {})[id] || {};
    const nomeIt = (pg.nome && diz[pg.nome]) || diz['corpo.' + id] || diz['storie.nome.' + id] || nome(id);
    return String(nomeIt).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'senza-nome';
  }
  // Le voci da mettere nel progetto: solo delle storie del file, e solo
  // se il testo della battuta è ancora quello per cui sono state caricate
  async function vociDaScrivere() {
    const foto = studioVociCarica();
    const tutte = new Map((await tutteLeVoci()).map(x => [x.chiave, x.rec]));
    const fuori = [];
    for (const f of Object.values(foto)) for (const b of f.battute || []) {
      const rec = tutte.get(chiaveAudio(f.progetto, b.n));
      if (!rec || !rec.blob || unaRiga(rec.testo) !== unaRiga(b.testo)) continue;
      const est = (STUDIO_ESTENSIONI.exec(rec.nome || '') || [, /wav/.test(rec.tipo) ? 'wav' : /ogg/.test(rec.tipo) ? 'ogg' : 'mp3'])[1].toLowerCase();
      fuori.push({ cartella: cartellaPersonaggio(b.chi), lingua: f.lingua, nome: `${f.chiave}-${b.n}.${est}`, blob: rec.blob });
    }
    return fuori;
  }

  // ===================================================================
  // 6b. Le storie sul repository (v424)
  // ===================================================================

  /* Una storia scritta sul computer non si vedeva dal telefono: progetti,
   * demo e voci vivevano solo nel browser che li aveva fatti. Adesso le
   * storie **salvate** («Salva nelle mie demo») stanno anche nel repository
   * GitHub del sito, in `storie-studio/storie.json`, e ogni dispositivo che
   * apre l'app le legge da lì e le mette fra le sue (progetto e demo).
   *
   * Leggere non chiede niente: il repository è pubblico, e l'API dei
   * contenuti risponde subito (la pubblicazione su Pages ci mette qualche
   * minuto, e il file pubblicato starebbe nella cache del service worker).
   * Scrivere vuole un token di GitHub (fine-grained, «Contents: Read and
   * write» su questo solo repository) scritto una volta in «Altro →
   * Repository GitHub»: resta in questo browser e non entra nel backup.
   *
   * Un salvataggio è **un commit solo** (API Git: blob, albero, commit,
   * ramo) con tre cose: le storie, il file delle voci
   * (`audio/narrazione/storie/storie-studio.json`, §6, che fa partire il
   * workflow delle voci) e gli audio caricati a mano nelle battute. Prima di
   * scrivere si rilegge e si unisce: fra due dispositivi vince la versione
   * toccata per ultima di ogni storia (`aggiornato`), e una storia eliminata
   * lascia una lapide (`eliminati`) perché non torni dall'altro. Se nel
   * frattempo qualcun altro ha scritto, il ramo rifiuta e si riprova. */
  const CHIAVE_REPO = 'astrocal_storie_repo_v1';
  const CHIAVE_ELIMINATI = 'astrocal_storie_eliminati_v1';
  const FILE_CONDIVISE = 'storie-studio/storie.json';
  const PERCORSO_VOCI = 'audio/narrazione/storie/' + FILE_VOCI;
  const REPO_DI_SERIE = 'fabb12/AstroCalendarBen';
  const REPO_VALIDO = /^[\w.-]{1,100}\/[\w.-]{1,100}$/;
  const RAMO_VALIDO = /^[\w./-]{1,100}$/;
  const STUDIO_REPO_AUDIO_MAX = 40 * 1024 * 1024;

  // Il repository di questo sito: quello scritto in config.js, o quello che
  // dice l'indirizzo di Pages (`<proprietario>.github.io/<repository>/`)
  function studioRepoDiSerie(luogo) {
    if (typeof radice.STORIE_REPO === 'string' && REPO_VALIDO.test(radice.STORIE_REPO)) return radice.STORIE_REPO;
    const m = luogo && /^([\w-]+)\.github\.io$/i.exec(luogo.hostname || '');
    const pezzo = luogo && String(luogo.pathname || '').split('/').filter(Boolean)[0];
    if (m && pezzo && REPO_VALIDO.test(m[1] + '/' + pezzo)) return m[1] + '/' + pezzo;
    return REPO_DI_SERIE;
  }
  function studioRepoImpostazioni() {
    let salvate = {};
    try { salvate = JSON.parse((archivio() && archivio().getItem(CHIAVE_REPO)) || '{}') || {}; } catch (_) { salvate = {}; }
    return {
      repo: REPO_VALIDO.test(salvate.repo || '') ? salvate.repo : studioRepoDiSerie(radice.location),
      ramo: RAMO_VALIDO.test(salvate.ramo || '') ? salvate.ramo : 'main',
      token: typeof salvate.token === 'string' ? salvate.token.trim() : ''
    };
  }
  function studioRepoSalvaImpostazioni(imp) {
    const a = archivio();
    try { if (a) a.setItem(CHIAVE_REPO, JSON.stringify({ repo: imp.repo, ramo: imp.ramo, token: imp.token || '' })); return true; }
    catch (_) { return false; }
  }
  function eliminatiCarica() {
    try {
      const d = JSON.parse((archivio() && archivio().getItem(CHIAVE_ELIMINATI)) || '{}');
      return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
    } catch (_) { return {}; }
  }
  function eliminatiSalva(e) {
    try { if (archivio()) archivio().setItem(CHIAVE_ELIMINATI, JSON.stringify(e)); } catch (_) { /* resta la lapide di prima */ }
  }
  // Le lapidi, pulite: un id e un istante
  function lapidi(e) {
    const fuori = {};
    if (e && typeof e === 'object' && !Array.isArray(e))
      for (const [id, q] of Object.entries(e)) if (/^[\w-]{1,30}$/.test(id) && Number.isFinite(Number(q)) && Number(q) > 0) fuori[id] = Math.floor(Number(q));
    return fuori;
  }
  // Quali storie vanno sul repository: quelle salvate nelle demo
  const condivisa = p => !!(p && p.demoChiave);

  // Il contenuto di `storie-studio/storie.json`, in un ordine fisso (lo
  // stesso file per le stesse storie: niente commit inutili)
  function studioFileCondivise(progetti, eliminati) {
    const storie = progetti.filter(condivisa).map(copia).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const e = lapidi(eliminati), ordinati = {};
    for (const k of Object.keys(e).sort()) ordinati[k] = e[k];
    return JSON.stringify({
      _leggimi: 'Le storie salvate nello Studio delle storie, scritte dall\'app (Studio → Altro → Repository GitHub) e lette da ogni dispositivo. Non modificarlo a mano.',
      v: 1, storie, eliminati: ordinati
    }, null, 2) + '\n';
  }
  // E il contrario: un file rotto vale come vuoto, una storia rotta si salta
  function studioLeggiCondivise(testo) {
    let d = null;
    try { d = JSON.parse(testo); } catch (_) { d = null; }
    if (!d || typeof d !== 'object') return { progetti: [], eliminati: {} };
    const progetti = (Array.isArray(d.storie) ? d.storie : [])
      .map(p => { try { return studioRipulisci(p); } catch (_) { return null; } })
      .filter(p => p && p.demoChiave);
    return { progetti, eliminati: lapidi(d.eliminati) };
  }
  /* L'unione di quello che c'è qui con quello del repository. Di ogni
   * storia vince la versione toccata per ultima; una lapide più recente
   * dell'ultima modifica la toglie. Le bozze mai salvate (senza demo) non
   * si toccano. `arrivati`: storie nuove o più fresche dal repository;
   * `tolti`: storie di qui eliminate altrove. */
  function studioUnisci(locali, eliminatiLocali, remoto) {
    const eliminati = lapidi(eliminatiLocali);
    for (const [id, q] of Object.entries(lapidi(remoto && remoto.eliminati))) eliminati[id] = Math.max(eliminati[id] || 0, q);
    const progetti = locali.slice();
    const arrivati = [], tolti = [];
    for (const r of (remoto && remoto.progetti) || []) {
      if ((eliminati[r.id] || 0) >= (r.aggiornato || 0)) continue;
      const i = progetti.findIndex(p => p.id === r.id);
      if (i < 0) { progetti.push(r); arrivati.push(r); }
      else if ((r.aggiornato || 0) > (progetti[i].aggiornato || 0)) { progetti[i] = r; arrivati.push(r); }
    }
    for (let i = progetti.length - 1; i >= 0; i--) {
      const p = progetti[i];
      if (condivisa(p) && eliminati[p.id] && (p.aggiornato || 0) <= eliminati[p.id]) { tolti.push(p); progetti.splice(i, 1); }
    }
    return { progetti, eliminati, arrivati, tolti };
  }

  // Lo SHA di un blob come lo calcola git, per non ricaricare un audio
  // che sul repository c'è già uguale
  async function shaBlob(byte) {
    const testa = new TextEncoder().encode('blob ' + byte.length + '\0');
    const tutto = new Uint8Array(testa.length + byte.length);
    tutto.set(testa); tutto.set(byte, testa.length);
    const h2 = new Uint8Array(await crypto.subtle.digest('SHA-1', tutto));
    return Array.from(h2, b => b.toString(16).padStart(2, '0')).join('');
  }
  function base64Di(byte) {
    let s = '';
    for (let i = 0; i < byte.length; i += 0x8000) s += String.fromCharCode.apply(null, byte.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const percorsoUrl = percorso => percorso.split('/').map(encodeURIComponent).join('/');

  // Una chiamata all'API di GitHub. `null` per un 404 (il file non c'è
  // ancora), un errore con lo stato per il resto.
  async function gh(imp, metodo, percorso, corpo, accetta) {
    const intest = { Accept: accetta || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (imp.token) intest.Authorization = 'Bearer ' + imp.token;
    if (corpo !== undefined) intest['Content-Type'] = 'application/json';
    const r = await fetch('https://api.github.com/repos/' + imp.repo + percorso, {
      method: metodo, headers: intest, cache: 'no-store', body: corpo === undefined ? undefined : JSON.stringify(corpo)
    });
    if (r.status === 404) return null;
    if (!r.ok) {
      let dett = '';
      try { dett = (await r.json()).message || ''; } catch (_) { /* senza spiegazione */ }
      const e = new Error((r.status === 401 ? t('studio.repo.errToken') : r.status === 403 ? t('studio.repo.errPermesso') : '') || ('GitHub ' + r.status + (dett ? ': ' + dett : '')));
      e.stato = r.status;
      throw e;
    }
    return accetta === 'application/vnd.github.raw+json' ? r.text() : r.json();
  }
  const leggiFile = (imp, percorso) => gh(imp, 'GET', '/contents/' + percorsoUrl(percorso) + '?ref=' + encodeURIComponent(imp.ramo), undefined, 'application/vnd.github.raw+json');

  // Il repository, letto: dall'API (fresca), e se non risponde (limite di
  // richieste senza token) dal file grezzo
  async function leggiRemoto(imp) {
    try {
      const testo = await leggiFile(imp, FILE_CONDIVISE);
      return testo === null ? { progetti: [], eliminati: {} } : studioLeggiCondivise(testo);
    } catch (e) {
      if (imp.token) throw e;
      const r = await fetch('https://raw.githubusercontent.com/' + imp.repo + '/' + percorsoUrl(imp.ramo) + '/' + FILE_CONDIVISE + '?t=' + Date.now(), { cache: 'no-store' });
      if (r.status === 404) return { progetti: [], eliminati: {} };
      if (!r.ok) throw e;
      return studioLeggiCondivise(await r.text());
    }
  }

  // Quello che arriva entra nello Studio e nella libreria delle demo
  function applicaUnione(u) {
    const lib = radice.AstroDemo && radice.AstroDemo.libreria;
    const foto = studioVociCarica();
    const togliFoto = id => { for (const [k, f] of Object.entries(foto)) if (!f || f.progetto === id) delete foto[k]; };
    // La demo di una storia eliminata altrove resta, come resta sul
    // dispositivo che l'ha eliminata (§7, «Elimina» toglie solo il progetto)
    for (const p of u.tolti) {
      cancellaVoci(p.id);
      togliFoto(p.id);
    }
    for (const p of u.arrivati) {
      try {
        if (lib && typeof lib.metti === 'function') lib.metti(p.demoChiave, studioCopione(p));
      } catch (_) { /* un copione che il motore di qui non accetta: resta il progetto */ }
      togliFoto(p.id);
      const prese = new Set(Object.keys(foto));
      const f = studioVociStoria(p, p.lingua || linguaStudio(), prese);
      foto[f.chiave] = f;
    }
    studioVociSalva(foto);
    studio.progetti = u.progetti;
    studioSalvaTutti(studio.progetti);
    eliminatiSalva(u.eliminati);
    if (studio.progetto) {
      const ora = studio.progetti.find(p => p.id === studio.progetto.id);
      if (ora) studio.progetto = ora;
      else if (u.tolti.some(p => p.id === studio.progetto.id)) studio.progetto = studio.progetti[0] || studioNuovoProgetto();
    }
    if (u.arrivati.length || u.tolti.length) {
      if (typeof radice.demoPaginaRicarica === 'function') { try { radice.demoPaginaRicarica(); } catch (_) { /* la pagina Demo si rifà quando si apre */ } }
      disegna();
    }
  }

  // Un commit solo con tutti i file cambiati; `false` se il ramo nel
  // frattempo è andato avanti (si riprova da capo)
  async function scriviCommit(imp, file, messaggio) {
    const ref = await gh(imp, 'GET', '/git/ref/heads/' + percorsoUrl(imp.ramo));
    if (!ref) throw new Error(t('studio.repo.errRamo', { ramo: imp.ramo }));
    const base = await gh(imp, 'GET', '/git/commits/' + ref.object.sha);
    const albero = [];
    for (const f of file) {
      const blob = await gh(imp, 'POST', '/git/blobs', f.testo !== undefined
        ? { content: f.testo, encoding: 'utf-8' } : { content: base64Di(f.byte), encoding: 'base64' });
      albero.push({ path: f.percorso, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const nuovo = await gh(imp, 'POST', '/git/trees', { base_tree: base.tree.sha, tree: albero });
    const commit = await gh(imp, 'POST', '/git/commits', { message: messaggio, tree: nuovo.sha, parents: [ref.object.sha] });
    try { await gh(imp, 'PATCH', '/git/refs/heads/' + percorsoUrl(imp.ramo), { sha: commit.sha, force: false }); }
    catch (e) { if (e.stato === 422 || e.stato === 409) return false; throw e; }
    return true;
  }

  // I file da scrivere: solo quelli che sul repository non sono già così
  async function fileDaScrivere(imp) {
    const fuori = [];
    const storie = studioFileCondivise(studio.progetti, eliminatiCarica());
    if (await leggiFile(imp, FILE_CONDIVISE) !== storie) fuori.push({ percorso: FILE_CONDIVISE, testo: storie });
    const voci = studioFileVoci(studioVociCarica());
    if (await leggiFile(imp, PERCORSO_VOCI) !== voci) fuori.push({ percorso: PERCORSO_VOCI, testo: voci });
    const cartelle = new Map();
    let peso = 0;
    for (const v of await vociDaScrivere()) {
      const dir = 'audio/narrazione/storie/' + v.cartella + '/' + v.lingua;
      if (!cartelle.has(dir)) {
        let elenco = null;
        try { elenco = await gh(imp, 'GET', '/contents/' + percorsoUrl(dir) + '?ref=' + encodeURIComponent(imp.ramo)); } catch (_) { elenco = null; }
        cartelle.set(dir, new Map((Array.isArray(elenco) ? elenco : []).map(x => [x.name, x.sha])));
      }
      const byte = new Uint8Array(await v.blob.arrayBuffer());
      if (cartelle.get(dir).get(v.nome) === await shaBlob(byte)) continue;
      if ((peso += byte.length) > STUDIO_REPO_AUDIO_MAX) break;   // il resto al prossimo salvataggio
      fuori.push({ percorso: dir + '/' + v.nome, byte });
    }
    return fuori;
  }

  /* Il giro intero: leggi, unisci, e (`spingi`, con un token) scrivi.
   * Restituisce la frase per chi guarda. Uno alla volta: un salvataggio che
   * arriva durante un giro aspetta la fine e ne fa uno suo. */
  let giroInCorso = Promise.resolve();
  function studioSincronizza({ spingi = false, titolo = '' } = {}) {
    const giro = giroInCorso.then(() => sincronizzaOra(spingi, titolo));
    giroInCorso = giro.catch(() => null);
    return giro;
  }
  async function sincronizzaOra(spingi, titolo) {
    if (typeof fetch !== 'function') return '';
    const imp = studioRepoImpostazioni();
    // Senza l'interfaccia (le prove Node) l'archivio non è ancora stato letto
    if (!studio.radice) studio.progetti = studioCaricaTutti();
    try {
      for (let prova = 0; prova < 3; prova++) {
        const u = studioUnisci(studio.progetti, eliminatiCarica(), await leggiRemoto(imp));
        applicaUnione(u);
        const arrivo = u.arrivati.length || u.tolti.length ? t('studio.repo.arrivate', { n: u.arrivati.length, tolte: u.tolti.length }) + ' ' : '';
        if (!spingi) return arrivo;
        if (!imp.token) return arrivo + t('studio.repo.senzaToken');
        const file = await fileDaScrivere(imp);
        if (!file.length) return arrivo + t('studio.repo.giaAPosto');
        const msg = 'Storie dello Studio: ' + (unaRiga(titolo) || 'aggiornamento').slice(0, 72);
        if (await scriviCommit(imp, file, msg)) return arrivo + t('studio.repo.scritto', { file: file.length, repo: imp.repo });
      }
      return t('studio.repo.errOccupato');
    } catch (e) {
      return t('studio.repo.errore', { errore: e && e.message || String(e) });
    }
  }

  // ===================================================================
  // 7. L'interfaccia
  // ===================================================================

  /* Un elemento in una riga: `h('button', { class: 'x', onclick }, testo)`.
   * Si costruisce tutto col DOM, mai con innerHTML: i testi vengono da chi
   * scrive la storia, e così restano testo. */
  function h(tag, attributi, ...figli) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attributi || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const f of figli.flat()) if (f !== null && f !== undefined && f !== false) el.append(f instanceof Node ? f : document.createTextNode(String(f)));
    return el;
  }
  function selettore(campo, valore, opzioni, extra = {}) {
    const s = h('select', Object.assign({ dataset: { campo } }, extra));
    for (const [v, testo] of opzioni) s.append(new Option(testo, v));
    s.value = valore === undefined || valore === null ? '' : valore;
    return s;
  }
  const nome = id => S().nome ? S().nome(id) : id;

  /* Le figurine: il ritratto di un personaggio con una faccia, dipinto una
   * volta sola (`StorieCosmiche.ritratto`) e tenuto come immagine. Lo
   * Studio ne mostra tante — il cast, chi parla, le facce da scegliere — e
   * ridipingerle a ogni ridisegno vorrebbe dire centinaia di volti per un
   * clic. */
  const figurine = new Map();
  function figurina(id, espressione, px, classe) {
    const chiave = id + '|' + (espressione || '') + '|' + px;
    let url = figurine.get(chiave);
    if (url === undefined) {
      url = '';
      try {
        const tela = document.createElement('canvas');
        if (S().ritratto && S().ritratto(tela, id, espressione, { larghezza: px, altezza: px, palco: false, misura: px <= 40 ? 0.54 : 0.44 })) url = tela.toDataURL('image/png');
      } catch (_) { url = ''; }
      figurine.set(chiave, url);
    }
    const prof = S().profilo ? S().profilo(id) : {};
    return url ? h('img', { class: 'studio-figurina ' + (classe || ''), src: url, width: String(px), height: String(px), alt: '' })
      : h('span', { class: 'studio-figurina studio-pallino ' + (classe || ''), style: 'background:' + (prof.pelle || '#cbd5e1'), 'aria-hidden': 'true' });
  }
  // Un'icona disegnata dell'app (DISEGNI, app.js): un SVG fisso, non testo
  // di chi scrive, quindi qui `innerHTML` è sicuro
  function iconaSvg(id, px) {
    const f = typeof radice.icona === 'function' ? radice.icona : (typeof icona === 'function' ? icona : null);
    if (!f) return null;
    const t2 = document.createElement('template');
    t2.innerHTML = f(id, px || 18);
    return t2.content.firstElementChild;
  }

  const studio = {
    progetti: [], progetto: null, radice: null, capito: null, capitoScena: -1, esito: '', copioneAperto: false,
    salvaTimer: 0, aperta: null, repoAperto: false
  };

  // `tocca`: è una modifica (e non solo un'apertura), quindi il progetto
  // diventa il più recente fra i dispositivi (§6b)
  function salvaPresto(tocca = true) {
    if (tocca && studio.progetto) studio.progetto.aggiornato = Date.now();
    clearTimeout(studio.salvaTimer);
    studio.salvaTimer = setTimeout(() => {
      const i = studio.progetti.findIndex(p => p.id === studio.progetto.id);
      if (i >= 0) studio.progetti[i] = studio.progetto; else studio.progetti.unshift(studio.progetto);
      studioSalvaTutti(studio.progetti);
    }, 250);
  }

  // Un campo è un percorso nel progetto: `scene.0.momenti.2.testo`
  function leggi(percorso) { return percorso.split('.').reduce((o, k) => o == null ? o : o[k], studio.progetto); }
  function scrivi(percorso, valore) {
    const parti = percorso.split('.'), ultimo = parti.pop();
    const o = parti.reduce((x, k) => x == null ? x : x[k], studio.progetto);
    if (o) o[ultimo] = valore;
  }

  function opzioniPersonaggi(elenco, conNessuno) {
    const o = elenco.map(id => [id, nome(id)]);
    if (conNessuno) o.unshift(['', t('studio.nessuno')]);
    return o;
  }
  const opzioniUmori = conVuoto => (conVuoto ? [['', '—']] : []).concat(Object.keys(S().STOR_ESPRESSIONI || {}).map(k => [k, t('storie.espressione.' + k) || k]));
  const opzioniQuando = () => STUDIO_QUANDO.map(q => [q, t('studio.quando.' + q)]);
  // Un bottone che si accende e si spegne (una scelta fra tante)
  const scelta = (acceso, attr, ...figli) => h('button', Object.assign({ type: 'button', 'aria-pressed': String(!!acceso) }, attr), ...figli);

  // L'editor di un'azione: solo i campi del suo tipo, in una riga
  function disegnaAzione(az, base, presenti, scena) {
    const riga = h('div', { class: 'studio-azione' });
    const p = base + '.';
    if (az.tipo !== 'effetto' || az.chi) riga.append(selettore(p + 'chi', az.chi, opzioniPersonaggi(presenti, az.tipo === 'effetto'), { 'aria-label': t('studio.chi') }));
    const tre = scena.ambiente !== 'cielo';
    const cosmo = scena.ambiente === 'cosmo';
    const altri = studio.progetto.cast.concat(['Sun', 'Moon', 'Earth', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'])
      .filter((x, i, a) => a.indexOf(x) === i && (cosmo || !soloCosmo(x)));
    // Nell'universo le mete sono i suoi luoghi; altrove, i posti dello schermo
    const luoghi = cosmo ? Object.keys(STUDIO_SEGNI_COSMO).concat(Object.keys(STUDIO_TAPPE_COSMO))
      .filter(x => !(S().STOR_PERSONAGGI && S().STOR_PERSONAGGI[x])) : ['center', 'left', 'right', 'top', 'bottom'];
    const nomeDi = l => cosmo ? nomeLuogo(l) : t('studio.luogo.' + l);
    if (az.tipo === 'umore') riga.append(selettore(p + 'umore', az.umore, opzioniUmori(false), { 'aria-label': t('storie.espressioneEtichetta') }));
    if (az.tipo === 'guarda') riga.append(selettore(p + 'oggetto', az.oggetto, [['viewer', t('studio.luogo.viewer')]].concat(opzioniPersonaggi(altri.filter(x => x !== az.chi)),
      cosmo ? luoghi.map(l => [l, nomeDi(l)]) : []), { 'aria-label': t('studio.verso') }));
    if (az.tipo === 'muovi') {
      riga.append(selettore(p + 'verso', az.verso, [['', t('studio.scegli')]].concat(opzioniPersonaggi(altri.filter(x => x !== az.chi)), luoghi.map(l => [l, nomeDi(l)])), { 'aria-label': t('studio.verso') }));
      riga.append(selettore(p + 'percorso', az.percorso, (S().STOR_PERCORSI || []).map(x => [x, t('storie.percorso.' + x)]), { 'aria-label': t('studio.percorso') }));
      if (az.verso && !luoghi.includes(az.verso) && !cosmo)
        riga.append(selettore(p + 'lato', az.lato, (S().STOR_LATI || []).map(x => [x, t('studio.lato.' + x)]), { 'aria-label': t('studio.lato') }));
    }
    if (az.tipo === 'torna') riga.append(selettore(p + 'percorso', az.percorso, (S().STOR_PERCORSI || []).map(x => [x, t('storie.percorso.' + x)]), { 'aria-label': t('studio.percorso') }));
    if (az.tipo === 'anima') {
      riga.append(selettore(p + 'animazione', az.animazione, (S().STOR_ANIMAZIONI || []).map(x => [x, t('storie.animazione.' + x)]), { 'aria-label': t('studio.animazione') }));
      riga.append(selettore(p + 'volte', String(az.volte || 0), [['0', t('studio.volteAuto')], ...[1, 2, 3, 4, 5, 6].map(n => [String(n), t('studio.volte', { n })])], { 'aria-label': t('studio.quanteVolte') }));
    }
    if (az.tipo === 'diventa') riga.append(selettore(p + 'forma', az.forma, STUDIO_FORME.map(x => [x, t('storie.veste.' + x)]), { 'aria-label': t('studio.forma') }));
    if (az.tipo === 'scala') riga.append(selettore(p + 'scala', String(az.scala), [['0.4', t('studio.scala.minuscolo')], ['0.7', t('studio.scala.piccolo')], ['1', t('studio.scala.normale')], ['1.6', t('studio.scala.grande')], ['2.5', t('studio.scala.enorme')]], { 'aria-label': t('studio.misura') }));
    if (az.tipo === 'effetto') {
      riga.append(selettore(p + 'effetto', az.effetto, Object.keys(S().STOR_EFFETTI || {}).map(x => [x, t('storie.effetto.' + x)]), { 'aria-label': t('studio.effetto') }));
      riga.append(selettore(p + 'dove', az.dove, [['', t('studio.suChi')]].concat(opzioniPersonaggi(altri), luoghi.map(l => [l, nomeDi(l)])), { 'aria-label': t('studio.dove') }));
      riga.append(selettore(p + 'grandezza', String(az.grandezza || 1), [['0.6', t('studio.scala.piccolo')], ['1', t('studio.scala.normale')], ['1.8', t('studio.scala.grande')], ['3', t('studio.scala.enorme')]], { 'aria-label': t('studio.misura') }));
      riga.append(h('input', { type: 'color', value: az.colore || '#ffd23f', dataset: { campo: p + 'colore' }, 'aria-label': t('studio.colore'), class: 'studio-colore' }));
    }
    riga.append(selettore(p + 'quando', az.quando, opzioniQuando(), { 'aria-label': t('studio.quando') }));
    if (!tre && (az.tipo === 'muovi' || az.tipo === 'torna')) riga.append(h('span', { class: 'studio-avviso' }, t('studio.soloIn3d')));
    riga.append(h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'apriAzione', dove: '' } }, t('studio.ui.fatto')));
    return riga;
  }

  /* Un momento è una battuta del copione, come in un fumetto: la figurina
   * di chi parla con la sua faccia, il fumetto con le parole, sotto le
   * facce da toccare e quello che succede intanto (etichette che si aprono
   * per cambiarle). Niente menu per le scelte di tutti i giorni: chi parla
   * e con che faccia si scelgono toccando un volto. */
  function disegnaMomento(m, i, k, scena) {
    const base = `scene.${i}.momenti.${k}`;
    const presenti = studioPresenti(studio.progetto, scena);
    const box = h('article', { class: 'studio-momento', 'aria-label': t('studio.momento', { n: k + 1 }) });
    const umore = m.umore || (m.chi && S().profilo ? S().profilo(m.chi).espressione : 'neutral');
    // Chi parla: le figurine di chi è in scena (e «nessuno», per un momento di sole azioni)
    const chi = h('div', { class: 'studio-chi', role: 'group', 'aria-label': t('studio.chiParla') },
      h('span', { class: 'studio-etichetta' }, t('studio.chiParla')));
    for (const id of presenti) {
      chi.append(scelta(m.chi === id, { class: 'studio-chi-tasto', dataset: { fai: 'chi', dove: base, id }, title: nome(id) },
        figurina(id, m.chi === id ? umore : '', 30), h('span', {}, nome(id))));
    }
    chi.append(scelta(!m.chi, { class: 'studio-chi-tasto studio-nessuno', dataset: { fai: 'chi', dove: base, id: '' } }, t('studio.ui.soloAzioni')));
    const strumenti = h('div', { class: 'studio-strumenti' },
      h('label', { class: 'studio-secondi' }, h('span', {}, t('studio.durata')),
        h('input', { type: 'number', min: '0', max: '120', step: '1', value: String(m.durata || ''), placeholder: t('studio.auto'), dataset: { campo: base + '.durata', numero: '1' } })),
      h('button', { type: 'button', class: 'tasto-cielo studio-mini', dataset: { fai: 'su', dove: base }, 'aria-label': t('studio.su'), title: t('studio.su') }, '↑'),
      h('button', { type: 'button', class: 'tasto-cielo studio-mini', dataset: { fai: 'giu', dove: base }, 'aria-label': t('studio.giu'), title: t('studio.giu') }, '↓'),
      h('button', { type: 'button', class: 'tasto-cielo studio-mini studio-x', dataset: { fai: 'togliMomento', dove: base }, 'aria-label': t('studio.togli'), title: t('studio.togli') }, '×'));
    box.append(h('div', { class: 'studio-momento-testa' }, h('span', { class: 'studio-numero' }, String(k + 1)), chi, strumenti));
    // Il fumetto: la figurina grande e le parole
    if (m.chi) {
      const testo = h('textarea', { rows: '2', maxlength: '400', dataset: { campo: base + '.testo' }, placeholder: t('studio.testoAiuto', { nome: nome(m.chi) }), 'aria-label': t('studio.battuta') });
      testo.value = m.testo || '';
      const parole = unaRiga(m.testo) ? unaRiga(m.testo).split(' ').length : 0;
      box.append(h('div', { class: 'studio-fumetto' },
        figurina(m.chi, umore, 64, 'studio-chi-grande'),
        h('div', { class: 'studio-nuvola' }, testo,
          h('span', { class: 'studio-contatore' + (parole > STUDIO_PAROLE_BAMBINI ? ' troppo' : '') }, t('studio.parole', { n: parole })))));
      box.append(disegnaVoce(m, base));
      // Le facce: un volto per espressione, del personaggio che parla
      const facce = h('div', { class: 'studio-facce', role: 'group', 'aria-label': t('storie.espressioneEtichetta') },
        h('span', { class: 'studio-etichetta' }, t('studio.ui.faccia')));
      const lei = S().profilo && S().profilo(m.chi).genere === 'f';
      for (const e of Object.keys(S().STOR_ESPRESSIONI || {})) {
        // «Sorpresa» per la Luna, «Sorpreso» per Marte
        const nomeE = (lei && t('storie.espressioneLei.' + e)) || t('storie.espressione.' + e) || e;
        facce.append(scelta(umore === e && !!m.umore, { class: 'studio-faccia', dataset: { fai: 'umore', dove: base, valore: e }, title: nomeE, 'aria-label': nomeE },
          figurina(m.chi, e, 34), h('span', {}, nomeE)));
      }
      facce.append(h('button', { type: 'button', class: 'studio-idea', dataset: { fai: 'umoreDalTesto', dove: base }, title: t('studio.umoreDalTesto') }, t('studio.ui.dalTesto')));
      box.append(facce);
    }
    // Intanto: le azioni come etichette; quella aperta mostra i suoi campi
    const intanto = h('div', { class: 'studio-intanto' }, h('span', { class: 'studio-etichetta' }, t('studio.ui.intanto')));
    (m.azioni || []).forEach((az, j) => {
      const dove = `${base}.azioni.${j}`;
      const aperta = studio.aperta === az.id;
      const etichetta = h('span', { class: 'studio-azione-chip' + (aperta ? ' aperta' : '') },
        h('button', { type: 'button', class: 'studio-azione-testo', dataset: { fai: 'apriAzione', dove: az.id }, 'aria-expanded': String(aperta) },
          studioDescriviAzione(az), h('small', {}, ' · ' + t('studio.quando.' + az.quando))),
        h('button', { type: 'button', class: 'studio-azione-x', dataset: { fai: 'togliAzione', dove }, 'aria-label': t('studio.togli'), title: t('studio.togli') }, '×'));
      intanto.append(etichetta);
      if (aperta) intanto.append(disegnaAzione(az, dove, presenti, scena));
    });
    // Aggiungi: un bottone per tipo, e le idee adatte a parole e faccia
    const aggiungi = h('div', { class: 'studio-aggiungi', role: 'group', 'aria-label': t('studio.ui.aggiungi') },
      h('span', { class: 'studio-etichetta' }, t('studio.ui.aggiungi')));
    for (const tipo of STUDIO_TIPI) {
      if (scena.ambiente === 'cielo' && (tipo === 'muovi' || tipo === 'torna')) continue;
      aggiungi.append(h('button', { type: 'button', class: 'studio-tipo', dataset: { fai: 'aggiungiTipo', dove: base, tipo } }, '+ ' + t('studio.tipo.' + tipo)));
    }
    const idee = studioIdeeAzioni(studio.progetto, scena, m);
    if (idee.length) {
      const fila = h('div', { class: 'studio-idee', role: 'group', 'aria-label': t('studio.idee') }, h('span', { class: 'studio-etichetta' }, t('studio.idee')));
      idee.forEach((a, j) => fila.append(h('button', { type: 'button', class: 'studio-idea', dataset: { fai: 'idea', dove: base, idea: String(j) } }, '+ ' + studioDescriviAzione(a))));
      box.append(intanto, fila, aggiungi);
    } else box.append(intanto, aggiungi);
    return box;
  }

  // La voce della battuta: carica un file, ascoltalo, toglilo. Accanto, quanto
  // dura e quanto dura il momento per lei; o l'avviso se il testo è cambiato.
  function disegnaVoce(m, base) {
    const id = 'studio-voce-' + base.replace(/\./g, '-');
    const riga = h('div', { class: 'studio-voce', role: 'group', 'aria-label': t('studio.voce.titolo') },
      h('span', { class: 'studio-etichetta' }, t('studio.voce.titolo')),
      h('label', { class: 'tasto-cielo studio-mini-testo', for: id, title: t('studio.voce.aiuto') }, m.audio ? t('studio.voce.cambia') : t('studio.voce.carica')),
      h('input', { id, class: 'demo-file-nascosto', type: 'file', accept: 'audio/*,.mp3,.wav,.ogg,.m4a,.opus,.webm', dataset: { voce: base } }));
    if (m.audio) {
      const valida = studioVoceValida(m);
      riga.append(
        h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'ascoltaVoce', dove: base } }, t('studio.voce.ascolta')),
        h('button', { type: 'button', class: 'tasto-cielo studio-mini-testo', dataset: { fai: 'togliVoce', dove: base } }, t('studio.voce.togli')),
        h('small', { class: 'studio-voce-stato' + (valida ? '' : ' troppo') }, valida
          ? t('studio.voce.pronta', { secondi: secondiDi(m.audio.durata), durata: studioDurata(m) })
          : t('studio.voce.vecchia')));
    }
    return riga;
  }

  function disegnaScena(sc, i) {
    const base = `scene.${i}`;
    const presenti = studioPresenti(studio.progetto, sc);
    const card = h('section', { class: 'studio-scena', 'aria-label': t('studio.scena', { n: i + 1 }) });
    // Dove siamo: quattro bottoni, uno per ambiente
    const ambienti = h('div', { class: 'studio-ambienti', role: 'group', 'aria-label': t('studio.ambiente') });
    for (const a of STUDIO_AMBIENTI)
      ambienti.append(scelta(sc.ambiente === a, { class: 'studio-ambiente', dataset: { fai: 'ambiente', dove: base, valore: a } }, t('studio.ambiente.' + a)));
    card.append(h('div', { class: 'studio-scena-testa' },
      h('h5', { class: 'studio-scena-titolo' }, t('studio.scena', { n: i + 1 })),
      ambienti,
      h('div', { class: 'studio-strumenti' },
        h('button', { type: 'button', class: 'tasto-cielo tasto-primario', dataset: { fai: 'provaScena', dove: base }, 'data-storia-prova': '' }, iconaSvg('gioca', 16), ' ', t('studio.provaScena')),
        h('button', { type: 'button', class: 'tasto-cielo studio-mini', dataset: { fai: 'su', dove: base }, 'aria-label': t('studio.su'), title: t('studio.su') }, '↑'),
        h('button', { type: 'button', class: 'tasto-cielo studio-mini', dataset: { fai: 'giu', dove: base }, 'aria-label': t('studio.giu'), title: t('studio.giu') }, '↓'),
        h('button', { type: 'button', class: 'tasto-cielo studio-mini studio-x', dataset: { fai: 'togliScena', dove: base }, 'aria-label': t('studio.togli'), title: t('studio.togli') }, '×'))));
    // Chi c'è: le figurine del cast, da accendere e spegnere
    const chips = h('div', { class: 'studio-chips', role: 'group', 'aria-label': t('studio.inScena') }, h('span', { class: 'studio-etichetta' }, t('studio.inScena')));
    for (const id of studio.progetto.cast) {
      const acceso = presenti.includes(id);
      chips.append(scelta(acceso, { class: 'studio-chip', dataset: { fai: 'presente', dove: base, id } }, figurina(id, '', 22), nome(id)));
    }
    card.append(chips);
    // Nell'universo: da quale tappa a quale va la camera, in tutta la scena
    const cosmo = sc.ambiente === 'cosmo';
    if (cosmo) {
      const tappe = Object.keys(STUDIO_TAPPE_COSMO).map(k => [k, nomeLuogo(k)]);
      card.append(h('div', { class: 'studio-viaggio' },
        h('span', { class: 'studio-etichetta' }, t('studio.ui.viaggio')),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.ui.da')), selettore(base + '.cosmoDa', sc.cosmoDa, tappe)),
        h('span', { class: 'studio-freccia', 'aria-hidden': 'true' }, '→'),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.ui.a')), selettore(base + '.cosmoA', sc.cosmoA, tappe)),
        h('small', { class: 'studio-viaggio-nota' }, t('studio.ui.viaggioNota'))));
    }
    // Inquadratura e data: chiuse di serie, perché di solito vanno bene così
    const fuochi = sc.ambiente === 'cielo' ? STUDIO_FUOCHI_CIELO : STUDIO_FUOCHI_3D;
    const dettagli = h('details', { class: 'studio-dettagli' },
      h('summary', {}, t(cosmo ? 'studio.ui.data' : 'studio.ui.doveQuando'), h('small', {}, ' · ' + riassuntoScena(sc))),
      h('div', { class: 'studio-riga' },
        (sc.ambiente === 'pianeta' || sc.ambiente === 'cielo') ? h('label', { class: 'storie-campo' }, h('span', {}, t('studio.fuoco')),
          selettore(base + '.fuoco', fuochi.includes(sc.fuoco) ? sc.fuoco : fuochi[0], fuochi.map(f => [f, nome(f)]))) : null,
        cosmo ? null : h('label', { class: 'storie-campo' }, h('span', {}, t('studio.inquadratura')),
          selettore(base + '.zoom', sc.zoom, Object.keys(STUDIO_ZOOM).map(z => [z, t('studio.zoom.' + z)]))),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.giorno')), h('input', { type: 'date', value: sc.data, dataset: { campo: base + '.data' } })),
        h('label', { class: 'storie-campo studio-corto' }, h('span', {}, t('studio.ora')), h('input', { type: 'time', value: sc.ora, dataset: { campo: base + '.ora' } })),
        cosmo ? null : h('label', { class: 'storie-campo studio-corto' }, h('span', {}, t('studio.giorni')),
          h('input', { type: 'number', min: '0', max: '1000', step: '1', value: String(sc.giorni || 0), dataset: { campo: base + '.giorni', numero: '1' } })),
        h('label', { class: 'storie-campo studio-spunta' }, h('input', { type: 'checkbox', checked: !!sc.cartello, dataset: { campo: base + '.cartello' } }),
          h('span', {}, t('studio.mostraCartello'))),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.camera')),
          selettore(base + '.camera', studioCameraDi(sc), STUDIO_CAMERE.map(c => [c, t('studio.camera.' + c)]))),
        (studioCameraDi(sc) === 'vicino' || studioCameraDi(sc) === 'giro') ? h('label', { class: 'storie-campo' }, h('span', {}, t('studio.cameraChi')),
          selettore(base + '.cameraChi', presenti.includes(sc.cameraChi) ? sc.cameraChi : '',
            (studioCameraDi(sc) === 'giro' ? [['', t('studio.cameraChi.parla')]] : [['', t('studio.cameraChi.primo')]])
              .concat(presenti.map(id => [id, nome(id)])))) : null,
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'ambienteAdatto', dove: base } }, t('studio.ambienteAdatto'))));
    if (studio.dettagliAperti && studio.dettagliAperti.has(sc.id)) dettagli.open = true;
    dettagli.addEventListener('toggle', () => {
      studio.dettagliAperti = studio.dettagliAperti || new Set();
      if (dettagli.open) studio.dettagliAperti.add(sc.id); else studio.dettagliAperti.delete(sc.id);
    });
    card.append(dettagli);
    const momenti = h('div', { class: 'studio-momenti' });
    sc.momenti.forEach((m, k) => momenti.append(disegnaMomento(m, i, k, sc)));
    card.append(momenti);
    // In fondo alla scena: una battuta nuova, il suggerimento, e «scrivi a parole»
    const parole = h('input', { type: 'text', class: 'studio-parole', dataset: { parole: base }, placeholder: t(cosmo ? 'studio.ui.paroleAiutoCosmo' : 'studio.paroleAiuto'), 'aria-label': t('studio.passo4'),
      value: studio.paroleResto && studio.paroleResto.dove === base ? studio.paroleResto.testo : undefined });
    const capito = h('ul', { class: 'studio-capito', 'aria-live': 'polite' });
    if (studio.capito && studio.capitoScena === i) {
      for (const o of studio.capito.ops) capito.append(h('li', { class: 'ok' }, o.op === 'battuta' ? t('studio.capitoBattuta', { chi: nome(o.chi), testo: o.testo }) : studioDescriviAzione(o.azione)));
      for (const f of studio.capito.nonCapite) capito.append(h('li', { class: 'no' }, t('studio.nonCapito', { frase: f })));
    }
    card.append(h('div', { class: 'studio-piede' },
      h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'nuovoMomento', dove: base } }, '+ ' + t('studio.aggiungiMomento')),
      h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'prossimoMomento', dove: base } }, t('studio.prossimoMomento'))),
      h('div', { class: 'studio-a-parole' },
        h('span', { class: 'studio-etichetta' }, t('studio.passo4')), parole,
        h('button', { type: 'button', class: 'tasto-cielo tasto-primario', dataset: { fai: 'capisci', dove: base } }, t('studio.fallo'))),
      capito);
    return card;
  }
  // «Normale · 13 dic 2026, 18:30 · 11 giorni»: la riga della scena chiusa
  function riassuntoScena(sc) {
    const pezzi = sc.ambiente === 'cosmo' ? [] : [t('studio.zoom.' + sc.zoom)];
    if (sc.data) {
      try {
        const loc = haI18n() && radice.astroI18n.locale ? radice.astroI18n.locale() : 'it-IT';
        pezzi.push(new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(sc.data + 'T12:00:00')) + ', ' + sc.ora);
      } catch (_) { pezzi.push(sc.data); }
    } else pezzi.push(t('studio.ui.oggi'));
    if (sc.giorni > 0 && sc.ambiente !== 'cosmo') pezzi.push(t('studio.ui.giorniPassano', { n: sc.giorni }));
    if (sc.cartello) pezzi.push(t('studio.ui.conCartello'));
    const camera = studioCameraDi(sc);
    if (camera !== 'auto') pezzi.push(t('studio.ui.camera.' + camera));
    return pezzi.join(' · ');
  }

  // Le impostazioni del repository (§6b): dove, quale ramo, il token
  function pannelloRepo() {
    const imp = studioRepoImpostazioni();
    return h('div', { id: 'studio-repo', class: 'studio-repo' },
      h('p', { class: 'demo-opzioni-nota' }, t('studio.repo.aiuto')),
      h('div', { class: 'studio-riga' },
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.repo.repository')),
          h('input', { id: 'studio-repo-nome', type: 'text', value: imp.repo, autocomplete: 'off', spellcheck: 'false' })),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.repo.ramo')),
          h('input', { id: 'studio-repo-ramo', type: 'text', value: imp.ramo, autocomplete: 'off', spellcheck: 'false' }))),
      h('label', { class: 'storie-campo' }, h('span', {}, t('studio.repo.token')),
        h('input', { id: 'studio-repo-token', type: 'password', value: imp.token, autocomplete: 'off', placeholder: 'github_pat_…' })),
      h('p', { class: 'demo-opzioni-nota' }, t('studio.repo.tokenAiuto')),
      h('div', { class: 'demo-azioni' },
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'repoSalva' } }, t('studio.repo.salva')),
        imp.token ? h('button', { type: 'button', class: 'tasto-cielo studio-pericolo', dataset: { fai: 'repoDimentica' } }, t('studio.repo.dimentica')) : null));
  }

  function disegna() {
    const r = studio.radice;
    if (!r || !studio.progetto) return;
    const attivo = document.activeElement;
    const fuoco = attivo && r.contains(attivo) ? (attivo.dataset.campo || attivo.dataset.parole && 'parole|' + attivo.dataset.parole ||
      attivo.dataset.fai && attivo.dataset.fai + '|' + attivo.dataset.dove + '|' + (attivo.dataset.id || attivo.dataset.valore || attivo.dataset.tipo || '')) : null;
    const p = studio.progetto;
    const pezzi = [];
    // La barra: quale storia, una nuova, guarda e salva; il resto in «Altro»
    const elenco = selettore('', p.id, studio.progetti.map(x => [x.id, x.titolo || t('studio.senzaTitolo')]), { id: 'studio-progetti', 'aria-label': t('studio.progetti') });
    if (!studio.progetti.some(x => x.id === p.id)) elenco.prepend(new Option(p.titolo || t('studio.senzaTitolo'), p.id));
    elenco.value = p.id;
    const altro = h('details', { class: 'studio-altro' },
      h('summary', { class: 'tasto-cielo' }, t('studio.ui.altro')),
      h('div', { class: 'studio-altro-menu' },
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'duplica' } }, t('studio.duplica')),
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'esporta' } }, t('studio.esporta')),
        h('label', { class: 'tasto-cielo demo-importa-tasto', for: 'studio-importa' }, t('studio.importa')),
        h('input', { id: 'studio-importa', class: 'demo-file-nascosto', type: 'file', accept: '.json,application/json' }),
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'copione' }, 'aria-expanded': String(studio.copioneAperto), 'aria-controls': 'studio-copione' }, t('studio.mostraCopione')),
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'fileVoci' }, title: t('studio.voci.aiuto') }, t('studio.voci.file')),
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'repo' }, 'aria-expanded': String(!!studio.repoAperto), 'aria-controls': 'studio-repo' }, t('studio.repo.titolo')),
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'sincronizza' } }, t('studio.repo.sincronizza')),
        h('button', { type: 'button', class: 'tasto-cielo studio-pericolo', dataset: { fai: 'elimina' } }, t('studio.elimina'))));
    pezzi.push(h('div', { class: 'studio-blocco studio-barra' },
      h('label', { class: 'storie-campo studio-barra-scelta' }, h('span', {}, t('studio.progetti')), elenco),
      h('div', { class: 'studio-barra-tasti' },
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'nuovo' } }, '+ ' + t('studio.nuovo')),
        h('button', { type: 'button', class: 'demo-avvia-principale storia-avvia', dataset: { fai: 'guarda' }, 'data-storia-prova': '' }, iconaSvg('gioca', 18), ' ', t('studio.guarda')),
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'salvaDemo' } }, t('studio.salvaDemo')),
        altro),
      h('p', { id: 'studio-esito', class: 'demo-opzioni-nota', role: 'status', 'aria-live': 'polite' }, studio.esito),
      studio.repoAperto ? pannelloRepo() : null,
      h('pre', { id: 'studio-copione', class: 'storie-codice', tabindex: '0', hidden: !studio.copioneAperto })));
    // 1. L'idea: le storie pronte come schede da toccare
    const idee = h('div', { class: 'studio-idee-pronte', role: 'group', 'aria-label': t('studio.passo1') });
    for (const k of Object.keys(STUDIO_SCOPI)) {
      const cast = STUDIO_SCOPI[k].cast;
      idee.append(scelta(p.scopo === k, { class: 'studio-idea-pronta', dataset: { fai: 'modello', valore: k } },
        h('span', { class: 'studio-idea-volti', 'aria-hidden': 'true' }, cast.slice(0, 3).map(id => figurina(id, '', 30))),
        h('strong', {}, t('studio.scopo.' + k + '.nome')),
        h('small', {}, t('studio.scopo.' + k + '.descrizione'))));
    }
    const obiettivo = h('textarea', { rows: '2', maxlength: '300', dataset: { campo: 'obiettivo' }, placeholder: t('studio.obiettivoAiuto') });
    obiettivo.value = p.obiettivo || '';
    pezzi.push(h('div', { class: 'studio-blocco' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.passo1')),
      h('p', { class: 'demo-opzioni-nota' }, t('studio.passo1Aiuto')),
      idee,
      h('div', { class: 'studio-riga studio-titoli' },
        h('label', { class: 'storie-campo studio-largo' }, h('span', {}, t('studio.titolo')),
          h('input', { type: 'text', maxlength: '120', value: p.titolo, dataset: { campo: 'titolo' }, placeholder: t('studio.titoloAiuto') })),
        h('label', { class: 'storie-campo studio-largo' }, h('span', {}, t('studio.obiettivo')), obiettivo))));
    // 2. Chi recita: le figurine, divise in tre famiglie
    const gruppi = { pianeti: [], lune: [], macchine: [], universo: [] };
    for (const id of Object.keys(S().STOR_PERSONAGGI || {})) {
      const f = S().profilo ? S().profilo(id).famiglia : 'pianeta';
      (soloCosmo(id) ? gruppi.universo : f === 'stazione' || f === 'sonda' ? gruppi.macchine : f === 'luna' || f === 'nano' ? gruppi.lune : gruppi.pianeti).push(id);
    }
    const cast = h('div', { class: 'studio-cast-gruppi' });
    for (const [g, ids] of Object.entries(gruppi)) {
      if (!ids.length) continue;
      const fila = h('div', { class: 'studio-cast' });
      for (const id of ids) {
        const prof = S().profilo ? S().profilo(id) : {};
        const acceso = p.cast.includes(id);
        fila.append(scelta(acceso, { class: 'studio-personaggio', dataset: { fai: 'cast', id } },
          figurina(id, '', 48),
          h('span', { class: 'studio-personaggio-testo' },
            h('strong', { style: 'color:' + (prof.sottotitolo || '#fff') }, nome(id),
              h('small', { class: 'studio-genere' }, ' · ' + t('studio.ui.genere.' + (prof.genere === 'f' ? 'f' : 'm')))),
            h('small', { title: S().tratto ? S().tratto(id) : '' }, S().personalita ? S().personalita(id) : ''))));
      }
      cast.append(h('div', { class: 'studio-cast-gruppo' }, h('h5', { class: 'studio-gruppo-titolo' }, t('studio.ui.gruppo.' + g)), fila));
    }
    pezzi.push(h('div', { class: 'studio-blocco' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.passo2'), h('small', { class: 'studio-conta' }, ' · ' + t('studio.ui.nelCast', { n: p.cast.length }))),
      h('p', { class: 'demo-opzioni-nota' }, t('studio.passo2Aiuto')), cast));
    // 3. Il copione: le scene
    const scene = h('div', { class: 'studio-scene' });
    p.scene.forEach((sc, i) => scene.append(disegnaScena(sc, i)));
    pezzi.push(h('div', { class: 'studio-blocco' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.passo3')),
      h('p', { class: 'demo-opzioni-nota' }, t('studio.passo3Aiuto')), scene,
      h('div', { class: 'demo-azioni' }, h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'nuovaScena' } }, '+ ' + t('studio.aggiungiScena')))));
    // La domanda finale al pubblico (v430, §4-bis): quando, che tipo, e chi
    // vuole la scrive a mano; sotto, la domanda che la storia farà davvero
    pezzi.push(disegnaDomanda(p));
    // 4. Il controllo, chiuso in una riga quando è tutto a posto
    const consigli = h('ul', { class: 'studio-consigli', id: 'studio-consigli' });
    pezzi.push(h('details', { class: 'studio-blocco studio-controllo', id: 'studio-controllo' },
      h('summary', {}, h('span', { class: 'storie-sottotitolo' }, t('studio.passo5')), h('span', { class: 'studio-controllo-esito', id: 'studio-controllo-esito' })),
      consigli));
    // 5. Guarda e salva, anche in fondo
    pezzi.push(h('div', { class: 'studio-blocco' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.passo6')),
      h('div', { class: 'demo-azioni' },
        h('button', { type: 'button', class: 'demo-avvia-principale storia-avvia', dataset: { fai: 'guarda' }, 'data-storia-prova': '' }, iconaSvg('gioca', 18), ' ', t('studio.guarda')),
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'salvaDemo' } }, t('studio.salvaDemo')))));
    r.replaceChildren(...pezzi);
    aggiornaVivi();
    if (fuoco) {
      const [fai, dove, extra] = fuoco.split('|');
      let el = null;
      if (fai === 'parole') el = r.querySelector(`[data-parole="${CSS.escape(dove)}"]`);
      else if (dove !== undefined) {
        const tutti = Array.from(r.querySelectorAll(`[data-fai="${CSS.escape(fai)}"]`)).filter(x => (x.dataset.dove || 'undefined') === dove);
        el = tutti.find(x => (x.dataset.id || x.dataset.valore || x.dataset.tipo || '') === extra) || tutti[0] || null;
      } else el = r.querySelector(`[data-campo="${CSS.escape(fuoco)}"]`);
      if (el) el.focus();
    }
  }
  function disegnaDomanda(p) {
    const d = p.domanda || (p.domanda = studioNuovaDomanda());
    const modi = STUDIO_MODI_DOMANDA.map(m => [m, t('studio.domanda.modo.' + m)]);
    const tipi = ['auto'].concat(STUDIO_TIPI_DOMANDA).map(k => [k, t('studio.domanda.tipo.' + k)]);
    const accesa = d.attiva === true;
    const spunta = h('label', { class: 'storie-campo studio-spunta' },
      h('input', { type: 'checkbox', checked: accesa, dataset: { campo: 'domanda.attiva' } }),
      h('span', {}, t('studio.domanda.attiva')));
    if (!accesa) {
      return h('div', { class: 'studio-blocco studio-domanda' },
        h('h4', { class: 'storie-sottotitolo' }, t('studio.domanda.titolo')),
        h('p', { class: 'demo-opzioni-nota' }, t('studio.domanda.aiuto')),
        spunta,
        h('p', { class: 'studio-domanda-anteprima', id: 'studio-domanda-anteprima', role: 'status', 'aria-live': 'polite' }));
    }
    const campi = [
      spunta,
      h('div', { class: 'studio-riga' },
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.domanda.modo')), selettore('domanda.modo', d.modo, modi)),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.domanda.tipo')), selettore('domanda.tipo', d.tipo, tipi, { disabled: d.modo === 'mai' })),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.domanda.chi')),
          selettore('domanda.chi', d.chi, [['', t('studio.domanda.chiAuto')]].concat(opzioniPersonaggi(p.cast)), { disabled: d.modo === 'mai' })))
    ];
    if (d.modo !== 'mai') {
      campi.push(h('div', { class: 'studio-riga' },
        h('label', { class: 'storie-campo studio-largo' }, h('span', {}, t('studio.domanda.scrivi')),
          h('input', { type: 'text', maxlength: '200', value: d.testo, dataset: { campo: 'domanda.testo' }, placeholder: t('studio.domanda.scriviAiuto') })),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.domanda.a')),
          h('input', { type: 'text', maxlength: '60', value: d.a, dataset: { campo: 'domanda.a' } })),
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.domanda.b')),
          h('input', { type: 'text', maxlength: '60', value: d.b, dataset: { campo: 'domanda.b' } }))));
      campi.push(h('div', { class: 'demo-azioni' },
        unaRiga(d.testo)
          ? h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'domandaTogli' } }, t('studio.domanda.togli'))
          : h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'domandaUsa' } }, t('studio.domanda.usa'))));
    }
    return h('div', { class: 'studio-blocco studio-domanda' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.domanda.titolo')),
      h('p', { class: 'demo-opzioni-nota' }, t('studio.domanda.aiuto')),
      ...campi,
      h('p', { class: 'studio-domanda-anteprima', id: 'studio-domanda-anteprima', role: 'status', 'aria-live': 'polite' }));
  }
  // La domanda che la storia farà, a parole, sotto ai campi
  function anteprimaDomanda(el, p) {
    const d = studioDomandaFinale(p);
    if (!d) { el.replaceChildren(t(!p.domanda || p.domanda.attiva !== true || p.domanda.modo === 'mai' ? 'studio.domanda.spenta' : 'studio.domanda.nessuna')); return; }
    const scelte = [d.a, d.b].filter(Boolean);
    el.replaceChildren(t('studio.domanda.sara'), ' ',
      h('strong', {}, (d.chi ? nome(d.chi) + ': ' : '') + '«' + d.testo + '»'),
      scelte.length ? h('span', { class: 'studio-domanda-scelte' }, ' ', scelte.map((x, i) => (i ? 'B' : 'A') + ' · ' + x).join('   ')) : null);
  }
  // Quello che cambia a ogni lettera: il controllo, il copione, i contatori
  function aggiornaVivi() {
    const r = studio.radice;
    if (!r) return;
    const anteprima = r.querySelector('#studio-domanda-anteprima');
    if (anteprima) anteprimaDomanda(anteprima, studio.progetto);
    const lista = r.querySelector('#studio-consigli');
    if (lista) {
      const valida = radice.AstroDemo && typeof radice.AstroDemo.valida === 'function' ? radice.AstroDemo.valida : null;
      const consigli = studioConsigli(studio.progetto, valida);
      lista.replaceChildren(...consigli.map(c => h('li', { class: c.ok ? 'ok' : 'no' }, h('span', { class: 'studio-segno', 'aria-hidden': 'true' }, c.ok ? '✓' : '!'), c.testo)));
      lista.append(h('li', { class: 'info' }, t('studio.durataTotale', { n: studioDurataTotale(studio.progetto) })));
      const da = consigli.filter(c => !c.ok).length;
      const esitoEl = r.querySelector('#studio-controllo-esito');
      if (esitoEl) {
        esitoEl.textContent = da ? t('studio.ui.consigli', { n: da }) : t('studio.ui.tuttoBene');
        esitoEl.classList.toggle('no', da > 0);
      }
    }
    const pre = r.querySelector('#studio-copione');
    if (pre && !pre.hidden) pre.textContent = studioCopione(studio.progetto);
  }
  function esito(msg) {
    studio.esito = msg || '';
    const el = studio.radice && studio.radice.querySelector('#studio-esito');
    if (el) el.textContent = studio.esito;
  }

  function avvia(testo) {
    try {
      if (radice.StorieCosmiche && radice.StorieCosmiche.chiudiAnteprima) radice.StorieCosmiche.chiudiAnteprima();
      radice.AstroDemo.avvia(testo);
      esito('');
    } catch (e) { esito(e.message); }
  }
  function apri(progetto) {
    studio.progetto = progetto;
    studio.capito = null; studio.capitoScena = -1; studio.esito = ''; studio.aperta = null;
    salvaPresto(false);
    disegna();
  }

  // Le operazioni dei bottoni
  function fai(nomeOp, dove, el) {
    const p = studio.progetto;
    const contenitore = percorso => { const parti = percorso.split('.'); const i = Number(parti.pop()); return { lista: leggi(parti.join('.')), i }; };
    switch (nomeOp) {
      case 'nuovo': apri(studioNuovoProgetto()); return;
      // La domanda proposta dalla storia diventa testo da modificare; e si
      // torna a quella della storia svuotando i campi
      case 'domandaUsa': {
        const d = studioDomandaFinale(Object.assign({}, p, { domanda: Object.assign({}, p.domanda, { attiva: true, modo: 'sempre', testo: '' }) }));
        if (d) Object.assign(p.domanda, { testo: d.testo, a: d.a, b: d.b, chi: d.chi, tipo: d.tipo });
        salvaPresto(); disegna(); return;
      }
      case 'domandaTogli': Object.assign(p.domanda, { testo: '', a: '', b: '' }); salvaPresto(); disegna(); return;
      case 'duplica': { const c = copia(p); c.id = nuovoId('p'); c.titolo = t('studio.copiaDi', { titolo: p.titolo || t('studio.senzaTitolo') }); c.demoChiave = null; c.voceChiave = null; copiaVoci(p.id, c.id); apri(c); return; }
      case 'elimina':
        if (!radice.confirm || radice.confirm(t('studio.confermaElimina'))) {
          studio.progetti = studio.progetti.filter(x => x.id !== p.id);
          studioSalvaTutti(studio.progetti);
          // Una lapide, perché dagli altri dispositivi non torni (§6b)
          if (condivisa(p)) { const e = eliminatiCarica(); e[p.id] = Math.max(Date.now(), (p.aggiornato || 0) + 1); eliminatiSalva(e); }
          apri(studio.progetti[0] || studioNuovoProgetto());
          cancellaVoci(p.id);
          // Le sue battute escono dal file delle voci (se la cartella è
          // collegata) e la storia dal repository
          aggiornaVoci({ tolta: p.id, chiedi: false })
            .then(msg => condivisa(p) ? studioSincronizza({ spingi: true, titolo: p.titolo }).then(r2 => (msg ? msg + ' ' : '') + r2) : msg)
            .then(msg => { if (msg || p.demoChiave) esito(msg || t('studio.voci.ricorda')); });
        }
        return;
      case 'fileVoci':
        // Le storie salvate prima del file delle voci entrano la prima volta
        if (p.demoChiave && !Object.values(studioVociCarica()).some(f => f && f.progetto === p.id)) {
          aggiornaVoci({ salvata: p, chiedi: true }).then(msg => { salvaPresto(); esito(msg); });
        } else aggiornaVoci({ chiedi: true }).then(msg => esito(msg));
        return;
      case 'esporta': {
        const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: (unaRiga(p.titolo) || 'storia').replace(/[^\w-]+/g, '_').slice(0, 40) + '.storia.json' });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        return;
      }
      case 'modello': {
        const scopo = el.dataset.valore;
        if (!STUDIO_SCOPI[scopo]) return;
        const vuoto = !p.scene.some(sc => sc.momenti.some(m => unaRiga(m.testo)));
        if (vuoto || !radice.confirm || radice.confirm(t('studio.confermaModello'))) {
          const nuovo = studioDaModello(scopo);
          nuovo.id = p.id; nuovo.demoChiave = p.demoChiave; nuovo.aggiornato = Date.now();
          apri(nuovo);
        }
        return;
      }
      case 'cast': {
        const id = el.dataset.id;
        if (!p.cast.includes(id)) p.cast.push(id);
        else if (p.cast.length > 1) p.cast = p.cast.filter(x => x !== id);
        break;
      }
      case 'presente': {
        const sc = leggi(dove);
        let lista = studioPresenti(p, sc);
        const id = el.dataset.id;
        lista = lista.includes(id) ? lista.filter(x => x !== id) : lista.concat(id);
        // Almeno uno in scena: togliere l'ultimo li rimetterebbe tutti
        if (lista.length) sc.presenti = lista;
        break;
      }
      case 'ambiente': {
        const sc = leggi(dove);
        sc.ambiente = el.dataset.valore;
        if (sc.ambiente === 'cielo' && !STUDIO_FUOCHI_CIELO.includes(sc.fuoco)) sc.fuoco = studioPresenti(p, sc).find(id => STUDIO_FUOCHI_CIELO.includes(id)) || 'Moon';
        if (sc.ambiente === 'pianeta' && !STUDIO_FUOCHI_3D.includes(sc.fuoco)) sc.fuoco = studioPresenti(p, sc).find(id => STUDIO_FUOCHI_3D.includes(id)) || 'Jupiter';
        break;
      }
      case 'chi': {
        const m = leggi(dove);
        m.chi = el.dataset.id || '';
        break;
      }
      case 'umore': {
        const m = leggi(dove);
        m.umore = m.umore === el.dataset.valore ? '' : el.dataset.valore;
        break;
      }
      case 'aggiungiTipo': {
        const m = leggi(dove);
        const sc = p.scene[Number(dove.split('.')[1])];
        const az = studioNuovaAzione(el.dataset.tipo, { chi: m.chi || studioPresenti(p, sc)[0] || '' });
        if (az.tipo === 'muovi') az.verso = studioPresenti(p, sc).find(id => id !== az.chi) || '';
        m.azioni.push(az);
        studio.aperta = az.id;
        break;
      }
      case 'apriAzione': studio.aperta = dove && studio.aperta !== dove ? dove : null; break;
      case 'nuovaScena': {
        const ultima = p.scene[p.scene.length - 1];
        p.scene.push(studioNuovaScena(ultima ? { ambiente: ultima.ambiente, fuoco: ultima.fuoco, zoom: ultima.zoom, presenti: ultima.presenti.slice(), momenti: [] } : {}));
        const nuova = p.scene[p.scene.length - 1];
        nuova.momenti.push(studioProssimoMomento(p, nuova));
        break;
      }
      case 'togliScena': { const { lista, i } = contenitore(dove); if (lista.length > 1) lista.splice(i, 1); break; }
      case 'nuovoMomento': {
        const sc = leggi(dove);
        const ultimo = sc.momenti[sc.momenti.length - 1];
        const presenti = studioPresenti(p, sc);
        // parla di serie chi non ha appena parlato
        const chi = presenti.find(id => !ultimo || id !== ultimo.chi) || presenti[0] || '';
        sc.momenti.push(studioNuovoMomento({ chi }));
        break;
      }
      case 'prossimoMomento': { const sc = leggi(dove); sc.momenti.push(studioProssimoMomento(p, sc)); break; }
      case 'togliMomento': { const { lista, i } = contenitore(dove); lista.splice(i, 1); if (!lista.length) lista.push(studioNuovoMomento()); break; }
      case 'togliAzione': { const { lista, i } = contenitore(dove); lista.splice(i, 1); break; }
      case 'su': case 'giu': {
        const { lista, i } = contenitore(dove);
        const j = nomeOp === 'su' ? i - 1 : i + 1;
        if (j >= 0 && j < lista.length) [lista[i], lista[j]] = [lista[j], lista[i]];
        break;
      }
      case 'repo': studio.repoAperto = !studio.repoAperto; disegna(); return;
      case 'repoSalva': case 'repoDimentica': {
        const val = id => { const x = studio.radice.querySelector('#' + id); return x ? x.value.trim() : ''; };
        const imp = { repo: val('studio-repo-nome'), ramo: val('studio-repo-ramo') || 'main', token: nomeOp === 'repoDimentica' ? '' : val('studio-repo-token') };
        if (!REPO_VALIDO.test(imp.repo) || !RAMO_VALIDO.test(imp.ramo)) { esito(t('studio.repo.errNome')); return; }
        if (!studioRepoSalvaImpostazioni(imp)) { esito(t('studio.repo.errore', { errore: 'localStorage' })); return; }
        studio.repoAperto = nomeOp === 'repoSalva' ? false : studio.repoAperto;
        disegna();
        if (nomeOp === 'repoDimentica') { esito(t('studio.repo.dimenticato')); return; }
        esito(t('studio.repo.inCorso'));
        studioSincronizza({ spingi: !!imp.token, titolo: '' }).then(msg => esito(msg || t('studio.repo.giaAPosto')));
        return;
      }
      case 'sincronizza':
        esito(t('studio.repo.inCorso'));
        studioSincronizza({ spingi: true, titolo: p.titolo }).then(msg => esito(msg || t('studio.repo.giaAPosto')));
        return;
      case 'ascoltaVoce': ascoltaVoce(leggi(dove)); return;
      case 'togliVoce': togliVoce(leggi(dove)); break;
      case 'umoreDalTesto': { const m = leggi(dove); const u = studioUmoreDalTesto(m.testo); if (u) m.umore = u; break; }
      case 'idea': {
        const m = leggi(dove);
        const parti = dove.split('.');
        const sc = p.scene[Number(parti[1])];
        const idea = studioIdeeAzioni(p, sc, m)[Number(el.dataset.idea)];
        if (idea) m.azioni.push(idea);
        break;
      }
      case 'ambienteAdatto': {
        const sc = leggi(dove);
        Object.assign(sc, studioAmbientePer(studioPresenti(p, sc)));
        break;
      }
      case 'provaScena': avvia(studioCopione(p, { scena: Number(dove.split('.')[1]) })); return;
      case 'guarda': avvia(studioCopione(p)); return;
      case 'copione': studio.copioneAperto = !studio.copioneAperto; break;
      case 'capisci': {
        const campo = studio.radice.querySelector(`[data-parole="${CSS.escape(dove)}"]`);
        const testo = campo ? campo.value : '';
        const i = Number(dove.split('.')[1]) || 0;
        studio.capitoScena = i;
        studio.capito = studioCapisci(testo, p);
        studioApplica(p, i, studio.capito.ops);
        // Quello che non ha capito resta scritto, da correggere
        studio.paroleResto = studio.capito.ops.length ? null : { dove, testo };
        break;
      }
      case 'salvaDemo': {
        try {
          const lib = radice.AstroDemo.libreria;
          const testo = studioCopione(p);
          let chiave = p.demoChiave;
          try { chiave = lib.salva(testo, chiave || undefined); }
          catch (e) { if (chiave) chiave = lib.salva(testo); else throw e; }   // la demo era stata cancellata
          p.demoChiave = chiave;
          if (typeof radice.demoPaginaRicarica === 'function') radice.demoPaginaRicarica(chiave);
          studio.esito = t('studio.salvata');
          // Le battute nel file delle voci: numeri e nome della storia
          // entrano nel progetto, che si salva subito sotto
          const salvato = studio.esito;
          // Poi sul repository, perché si veda dagli altri dispositivi (§6b):
          // il progetto deve essere già nell'archivio quando il giro lo legge
          aggiornaVoci({ salvata: p, chiedi: false })
            .then(msg => {
              const i = studio.progetti.findIndex(x => x.id === p.id);
              if (i >= 0) studio.progetti[i] = p; else studio.progetti.unshift(p);
              studioSalvaTutti(studio.progetti);
              const prima = salvato + ' ' + (msg || (studioRepoImpostazioni().token ? '' : t('studio.voci.ricorda')));
              esito(prima + ' ' + t('studio.repo.inCorso'));
              return studioSincronizza({ spingi: true, titolo: p.titolo }).then(r2 => esito(prima + ' ' + r2));
            });
        } catch (e) { studio.esito = e.message; }
        break;
      }
      default: return;
    }
    salvaPresto();
    disegna();
  }

  function collega(r) {
    r.addEventListener('click', e => {
      const b = e.target.closest('[data-fai]');
      if (b && r.contains(b)) fai(b.dataset.fai, b.dataset.dove, b);
    });
    // «Scrivi a parole»: Invio è come «Fallo!»
    r.addEventListener('keydown', e => {
      const el = e.target;
      if (e.key === 'Enter' && el.dataset && el.dataset.parole && el.value.trim()) { e.preventDefault(); fai('capisci', el.dataset.parole, el); }
    });
    r.addEventListener('input', e => {
      const el = e.target;
      if (!el.dataset || !el.dataset.campo || el.tagName === 'SELECT') return;
      if (el.type === 'checkbox' || el.type === 'date' || el.type === 'time' || el.type === 'color') return;
      let v = el.value;
      if (el.dataset.numero) v = Math.max(0, Number(v) || 0);
      scrivi(el.dataset.campo, v);
      salvaPresto();
      // Il contatore delle parole senza ridisegnare (il cursore resta dov'è)
      if (/\.testo$/.test(el.dataset.campo)) {
        const c = el.parentElement && el.parentElement.querySelector('.studio-contatore');
        const n = unaRiga(el.value) ? unaRiga(el.value).split(' ').length : 0;
        if (c) { c.textContent = t('studio.parole', { n }); c.classList.toggle('troppo', n > STUDIO_PAROLE_BAMBINI); }
      }
      aggiornaVivi();
    });
    r.addEventListener('change', e => {
      const el = e.target;
      if (el.id === 'studio-progetti') {
        const scelto = studio.progetti.find(x => x.id === el.value);
        if (scelto) apri(scelto);
        return;
      }
      // La voce di una battuta: un file audio, misurato e tenuto nel browser
      if (el.dataset && el.dataset.voce) {
        const file = el.files && el.files[0];
        if (file) caricaVoce(el.dataset.voce, file).finally(() => { el.value = ''; });
        return;
      }
      if (el.id === 'studio-importa') {
        const file = el.files && el.files[0];
        if (!file) return;
        file.text().then(testo => {
          const p = studioRipulisci(JSON.parse(testo));
          p.id = nuovoId('p'); p.demoChiave = null;
          apri(p);
        }).catch(() => esito(t('studio.err.file'))).finally(() => { el.value = ''; });
        return;
      }
      if (el.dataset.campo) {
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (el.dataset.numero) v = Math.max(0, Number(v) || 0);
        if (/\.(volte|scala|grandezza)$/.test(el.dataset.campo)) v = Number(v) || 0;
        scrivi(el.dataset.campo, v);
        // La camera scelta dal menu decide anche la vecchia casella, che le
        // copie salvate prima della v431 leggono ancora
        if (/\.camera$/.test(el.dataset.campo)) {
          const sc = leggi(el.dataset.campo.replace(/\.camera$/, ''));
          if (sc) sc.cameraViva = v !== 'ferma';
        }
        salvaPresto();
        // Solo una scelta cambia i campi da mostrare. Ridisegnare dopo un
        // campo di testo o di numero vorrebbe dire rifare la pagina proprio
        // mentre il dito sta premendo il bottone accanto: il clic si perde.
        // La data e l'ora cambiano soltanto il riassunto della scena.
        if (el.tagName === 'SELECT' || el.dataset.campo === 'domanda.attiva') disegna();
        else {
          aggiornaVivi();
          const det = el.closest('.studio-dettagli');
          const sc = det && leggi(el.dataset.campo.split('.').slice(0, 2).join('.'));
          const piccolo = det && det.querySelector('summary small');
          if (sc && piccolo) piccolo.textContent = ' · ' + riassuntoScena(sc);
        }
      }
    });
  }

  // ===================================================================
  // 8. Le due linguette della pagina Demo
  // ===================================================================

  /* La pagina Demo era una colonna sola di sette gruppi: le storie stavano
   * in fondo, dopo le impostazioni dell'audio. Adesso sono una linguetta a
   * parte, «Storie cosmiche», con le storie pronte, l'anteprima e lo Studio.
   * La scelta si ricorda (per questo dispositivo). */
  const CHIAVE_SCHEDA = 'astrocal_demo_scheda_v1';
  function studioSchede() {
    const barra = document.getElementById('demo-schede');
    if (!barra) return;
    const schede = Array.from(barra.querySelectorAll('[role="tab"]'));
    const mostra = (id, fuoco) => {
      for (const s of schede) {
        const acceso = s.id === id;
        s.setAttribute('aria-selected', String(acceso));
        s.tabIndex = acceso ? 0 : -1;
        s.classList.toggle('attiva', acceso);
        const pannello = document.getElementById(s.getAttribute('aria-controls'));
        if (pannello) pannello.hidden = !acceso;
      }
      try { radice.localStorage.setItem(CHIAVE_SCHEDA, id); } catch (_) { /* senza memoria si riparte dalla prima */ }
      if (fuoco) document.getElementById(id).focus();
      if (id === 'demo-scheda-storie' && studio.radice && !studio.radice.childElementCount) disegna();
    };
    barra.addEventListener('click', e => { const s = e.target.closest('[role="tab"]'); if (s) mostra(s.id, false); });
    barra.addEventListener('keydown', e => {
      const i = schede.indexOf(document.activeElement);
      if (i < 0) return;
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % schede.length;
      if (e.key === 'ArrowLeft') j = (i - 1 + schede.length) % schede.length;
      if (e.key === 'Home') j = 0;
      if (e.key === 'End') j = schede.length - 1;
      if (j !== null) { e.preventDefault(); mostra(schede[j].id, true); }
    });
    let iniziale = 'demo-scheda-demo';
    try { const v = radice.localStorage.getItem(CHIAVE_SCHEDA); if (schede.some(s => s.id === v)) iniziale = v; } catch (_) { /* di serie */ }
    // Chi arriva da un link di una demo vuole la prima linguetta
    if (/[?#&]demo=/.test(String(radice.location && radice.location.href))) iniziale = 'demo-scheda-demo';
    mostra(iniziale, false);
    radice.demoMostraScheda = id => mostra(id, false);
  }

  function studioAvvia() {
    if (typeof document === 'undefined') return;
    studioSchede();
    const r = document.getElementById('studio-radice');
    if (!r) return;
    studio.radice = r;
    studio.progetti = studioCaricaTutti();
    studio.progetto = studio.progetti[0] || studioDaModello('fasi');
    collega(r);
    disegna();
    studioRiprendiVoci().catch(() => null);
    // Le storie salvate dagli altri dispositivi (§6b), in silenzio se non
    // arriva niente: senza rete resta quello che c'è qui
    studioSincronizza({ spingi: false }).then(msg => { if (msg && !studio.esito) esito(msg); }).catch(() => null);
    if (haI18n() && typeof radice.astroI18n.alCambio === 'function') radice.astroI18n.alCambio(() => { cacheParole.clear(); disegna(); });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', studioAvvia, { once: true });
    else studioAvvia();
  }

  // ===================================================================
  // 9. Fuori
  // ===================================================================

  const api = {
    STUDIO_SCOPI, STUDIO_AMBIENTI, STUDIO_TIPI, CHIAVE,
    nuovoProgetto: studioNuovoProgetto, nuovaScena: studioNuovaScena, nuovoMomento: studioNuovoMomento, nuovaAzione: studioNuovaAzione,
    daModello: studioDaModello, copione: studioCopione, durata: studioDurata, durataTotale: studioDurataTotale,
    umoreDalTesto: studioUmoreDalTesto, ideeAzioni: studioIdeeAzioni, ambientePer: studioAmbientePer,
    prossimoMomento: studioProssimoMomento, capisci: studioCapisci, applica: studioApplica, consigli: studioConsigli,
    descriviAzione: studioDescriviAzione, ripulisci: studioRipulisci, presenti: studioPresenti,
    unisci: studioUnisci, fileCondivise: studioFileCondivise, leggiCondivise: studioLeggiCondivise, repoDiSerie: studioRepoDiSerie,
    sincronizza: studioSincronizza, FILE_CONDIVISE,
    domandaFinale: studioDomandaFinale, fattiEpisodio: studioFattiEpisodio, nuovaDomanda: studioNuovaDomanda,
    STUDIO_TIPI_DOMANDA, STUDIO_MODI_DOMANDA, STUDIO_KIND_DOMANDA,
    vociStoria: studioVociStoria, impronta: studioImpronta, voceValida: studioVoceValida, fileVoci: studioFileVoci, chiaveVoci: studioChiaveVoci, CHIAVE_VOCI,
    get progetto() { return studio.progetto; }, ridisegna: () => disegna()
  };
  radice.StudioStorie = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
