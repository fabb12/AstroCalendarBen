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
  const STUDIO_AMBIENTI = ['sistema', 'pianeta', 'terra_luna', 'cielo'];
  const STUDIO_ZOOM = { lontano: 0.75, normale: 1, vicino: 1.7 };
  const STUDIO_FOV = { lontano: 60, normale: 18, vicino: 3 };
  const STUDIO_QUANDO = ['inizio', 'meta', 'fine', 'tutto'];
  const STUDIO_TIPI = ['umore', 'guarda', 'muovi', 'torna', 'anima', 'scala', 'effetto', 'occhiolino', 'nascondi'];
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
      anima: { animazione: 'jump', volte: 0 }, scala: { scala: 1.6, quando: 'inizio' },
      effetto: { effetto: 'sparkles', dove: '', grandezza: 1, colore: '' }, occhiolino: {}, nascondi: { quando: 'fine' }
    }[tipo] || {};
    return Object.assign(base, di, campi);
  }
  function studioNuovoMomento(campi = {}) {
    return Object.assign({ id: nuovoId('m'), chi: '', testo: '', umore: '', durata: 0, azioni: [] }, campi);
  }
  function studioNuovaScena(campi = {}) {
    return Object.assign({
      id: nuovoId('s'), ambiente: 'sistema', fuoco: 'Jupiter', zoom: 'normale',
      data: '', ora: '21:00', giorni: 0, presenti: [], momenti: [studioNuovoMomento()]
    }, campi);
  }
  function studioNuovoProgetto(campi = {}) {
    return Object.assign({
      v: 1, id: nuovoId('p'), titolo: '', scopo: 'libera', obiettivo: '',
      cast: ['Moon', 'Earth'], scene: [studioNuovaScena({ ambiente: 'terra_luna' })], demoChiave: null
    }, campi);
  }
  // Chi è davvero in scena: quelli scelti, o tutto il cast; mai qualcuno
  // che non è più nel cast.
  function studioPresenti(progetto, scena) {
    const scelti = (scena.presenti || []).filter(id => progetto.cast.includes(id));
    return scelti.length ? scelti : progetto.cast.slice();
  }
  // Un progetto letto da un file o dall'archivio: si tiene solo quello che
  // il modello conosce, coi tipi giusti. Un file rotto non rompe lo Studio.
  function studioRipulisci(p) {
    if (!p || typeof p !== 'object') throw new Error(t('studio.err.file') || 'file');
    const testo = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
    const tra = (v, ammessi, di) => ammessi.includes(v) ? v : di;
    const numero = (v, a, b, di) => Number.isFinite(Number(v)) ? Math.max(a, Math.min(b, Number(v))) : di;
    const ids = v => Array.isArray(v) ? v.filter(x => typeof x === 'string' && /^[\w :.-]{1,40}$/.test(x)).slice(0, 24) : [];
    const pulito = studioNuovoProgetto({
      id: typeof p.id === 'string' ? p.id.slice(0, 30) : nuovoId('p'),
      titolo: testo(p.titolo, 120), scopo: tra(p.scopo, Object.keys(STUDIO_SCOPI), 'libera'),
      obiettivo: testo(p.obiettivo, 300), cast: ids(p.cast),
      demoChiave: typeof p.demoChiave === 'string' && p.demoChiave.startsWith('utente-') ? p.demoChiave : null
    });
    pulito.scene = (Array.isArray(p.scene) ? p.scene : []).slice(0, 40).map(sc => studioNuovaScena({
      ambiente: tra(sc && sc.ambiente, STUDIO_AMBIENTI, 'sistema'), fuoco: testo(sc && sc.fuoco, 40) || 'Jupiter',
      zoom: tra(sc && sc.zoom, Object.keys(STUDIO_ZOOM), 'normale'),
      data: /^\d{4}-\d{2}-\d{2}$/.test(sc && sc.data) ? sc.data : '', ora: /^\d{2}:\d{2}$/.test(sc && sc.ora) ? sc.ora : '21:00',
      giorni: numero(sc && sc.giorni, 0, 1000, 0), presenti: ids(sc && sc.presenti),
      momenti: (Array.isArray(sc && sc.momenti) ? sc.momenti : []).slice(0, 60).map(m => studioNuovoMomento({
        chi: testo(m && m.chi, 40), testo: testo(m && m.testo, 400), umore: testo(m && m.umore, 20),
        durata: numero(m && m.durata, 0, 120, 0),
        azioni: (Array.isArray(m && m.azioni) ? m.azioni : []).slice(0, 30)
          .filter(a => a && STUDIO_TIPI.includes(a.tipo))
          .map(a => studioNuovaAzione(a.tipo, {
            chi: testo(a.chi, 40), quando: tra(a.quando, STUDIO_QUANDO, 'inizio'),
            umore: testo(a.umore, 20) || undefined, oggetto: testo(a.oggetto, 40) || undefined,
            verso: testo(a.verso, 40), lato: tra(a.lato, ['auto', 'left', 'right', 'above', 'below', 'front', 'behind'], 'auto'),
            percorso: testo(a.percorso, 20) || 'arc', animazione: testo(a.animazione, 20) || 'jump',
            volte: numero(a.volte, 0, 20, 0), scala: numero(a.scala, 0.2, 6, 1.6),
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
  function studioDurata(momento) {
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
  function righeAzione(az, vista, presenti) {
    const chi = az.chi;
    const inScena = id => presenti.includes(id);
    const tre = vista === 'solar_system_3d';
    switch (az.tipo) {
      case 'umore':
        if (!inScena(chi) || !az.umore) return '';
        return `character_expression { target: ${virgolette(chi)}, expression: ${virgolette(az.umore)}${ripresa(az, false)} }`;
      case 'guarda':
        if (!inScena(chi)) return '';
        return `character_look_at { target: ${virgolette(chi)}, object: ${virgolette(az.oggetto || 'viewer')}${ripresa(az, false)} }`;
      case 'occhiolino':
        if (!inScena(chi)) return '';
        return `character_blink { target: ${virgolette(chi)}${ripresa(az, false)} }`;
      case 'nascondi':
        if (!inScena(chi)) return '';
        return `character_hide { target: ${virgolette(chi)}${ripresa(az, false)} }`;
      case 'muovi':
        if (!tre || !inScena(chi) || !az.verso || az.verso === chi) return '';
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
      case 'effetto': {
        if (!az.effetto) return '';
        const luoghi = ['center', 'left', 'right', 'top', 'bottom'];
        const dove = az.dove || chi || '';
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
    const scene = progetto.scene.map((sc, i) => ({ sc, i })).filter(x => opz.scena === undefined || x.i === opz.scena);
    for (const { sc } of scene) {
      const presenti = studioPresenti(progetto, sc);
      const vista = sc.ambiente === 'cielo' ? 'planetarium_view' : 'solar_system_3d';
      const momenti = sc.momenti.length ? sc.momenti : [studioNuovoMomento()];
      const durate = momenti.map(studioDurata);
      const totale = durate.reduce((a, b) => a + b, 0) || 1;
      let trascorso = 0;
      if (opz.scena === undefined && !prima) righe.push('');
      momenti.forEach((m, k) => {
        const az = [];
        // Il quando: all'inizio della scena, o un pezzo del tempo che scorre
        if (sc.giorni > 0) {
          const da = isoDi(sc.data, sc.ora, sc.giorni * trascorso / totale);
          const a = isoDi(sc.data, sc.ora, sc.giorni * (trascorso + durate[k]) / totale);
          if (da && a && da !== a) az.push(`date_range { from: ${virgolette(da)}, to: ${virgolette(a)} }`);
        } else if (k === 0 && sc.data) {
          const iso = isoDi(sc.data, sc.ora);
          if (iso) az.push(`set_date { iso: ${virgolette(iso)} }`);
        }
        trascorso += durate[k];
        // La camera
        if (vista === 'planetarium_view') {
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
          const riga = righeAzione(a, vista, presenti);
          if (riga) az.push(riga);
          if (a.tipo === 'umore' && a.chi && a.umore) umori.set(a.chi, a.umore);
        }
        if (parla) az.push(`character_speak { target: ${virgolette(m.chi)}, text: ${virgolette(unaRiga(m.testo).slice(0, 400))} }`);
        righe.push(`  scene ${vista} {`);
        righe.push(`    duration: ${durate[k]}s;`);
        for (const a of az) righe.push(`    action: ${a};`);
        righe.push('  }');
        prima = false;
      });
    }
    righe.push('}');
    return righe.join('\n');
  }
  function studioDurataTotale(progetto) {
    return progetto.scene.reduce((n, sc) => n + sc.momenti.reduce((m, x) => m + studioDurata(x), 0), 0);
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

  const STUDIO_UMORI = ['happy', 'excited', 'surprised', 'worried', 'sad', 'thinking', 'sleepy', 'neutral'];
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
      sleepy: [['anima', { animazione: 'wobble' }]]
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
    const testo = fase === 'fine' && unaRiga(progetto.obiettivo)
      ? t('studio.bozza.scopo', { obiettivo: unaRiga(progetto.obiettivo) })
      : t('studio.bozza.' + fase + (altro ? 'Altro' : ''), { nome, altro });
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
          if (trova(s, 'torna')) azione('torna', { percorso: percorso === 'arc' ? 'arc' : percorso, quando: quando || 'tutto' });
          else if (trova(s, 'muovi') && (oggetto || luogo)) azione('muovi', { verso: oggetto || luogo, percorso, quando: quando || 'tutto' });
          for (const a of ['jump', 'bounce', 'shake', 'nod', 'spin', 'pulse', 'dance', 'wobble'])
            if (trova(s, 'anima.' + a)) { azione('anima', { animazione: a, volte: numero }); break; }
          if (trova(s, 'grande')) azione('scala', { scala: 1.8 });
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
    const nome = id => !id ? '' : ['center', 'left', 'right', 'top', 'bottom', 'viewer'].includes(id) ? t('studio.luogo.' + id) : (S().nome ? S().nome(id) : id);
    const dati = {
      chi: nome(a.chi), verso: nome(a.verso), oggetto: nome(a.oggetto), dove: nome(a.dove || a.chi),
      umore: t('storie.espressione.' + a.umore), animazione: t('storie.animazione.' + a.animazione),
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

  const studio = {
    progetti: [], progetto: null, radice: null, sceltaScena: 0, capito: null, esito: '', copioneAperto: false, salvaTimer: 0
  };

  function salvaPresto() {
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

  function disegnaAzione(az, base, presenti, scena) {
    const riga = h('div', { class: 'studio-azione' });
    const p = base + '.';
    riga.append(selettore(p + 'chi', az.chi, opzioniPersonaggi(presenti, az.tipo === 'effetto'), { 'aria-label': t('studio.chi') }));
    riga.append(selettore(p + 'tipo', az.tipo, STUDIO_TIPI.map(x => [x, t('studio.tipo.' + x)]), { 'aria-label': t('studio.cosaFa') }));
    const tre = scena.ambiente !== 'cielo';
    const altri = studio.progetto.cast.concat(['Sun', 'Moon', 'Earth', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'])
      .filter((x, i, a) => a.indexOf(x) === i);
    const luoghi = ['center', 'left', 'right', 'top', 'bottom'];
    if (az.tipo === 'umore') riga.append(selettore(p + 'umore', az.umore, opzioniUmori(false), { 'aria-label': t('storie.espressioneEtichetta') }));
    if (az.tipo === 'guarda') riga.append(selettore(p + 'oggetto', az.oggetto, [['viewer', t('studio.luogo.viewer')]].concat(opzioniPersonaggi(altri.filter(x => x !== az.chi))), { 'aria-label': t('studio.verso') }));
    if (az.tipo === 'muovi') {
      riga.append(selettore(p + 'verso', az.verso, [['', t('studio.scegli')]].concat(opzioniPersonaggi(altri.filter(x => x !== az.chi)), luoghi.map(l => [l, t('studio.luogo.' + l)])), { 'aria-label': t('studio.verso') }));
      riga.append(selettore(p + 'percorso', az.percorso, (S().STOR_PERCORSI || []).map(x => [x, t('storie.percorso.' + x)]), { 'aria-label': t('studio.percorso') }));
      if (az.verso && !luoghi.includes(az.verso))
        riga.append(selettore(p + 'lato', az.lato, (S().STOR_LATI || []).map(x => [x, t('studio.lato.' + x)]), { 'aria-label': t('studio.lato') }));
    }
    if (az.tipo === 'torna') riga.append(selettore(p + 'percorso', az.percorso, (S().STOR_PERCORSI || []).map(x => [x, t('storie.percorso.' + x)]), { 'aria-label': t('studio.percorso') }));
    if (az.tipo === 'anima') {
      riga.append(selettore(p + 'animazione', az.animazione, (S().STOR_ANIMAZIONI || []).map(x => [x, t('storie.animazione.' + x)]), { 'aria-label': t('studio.animazione') }));
      riga.append(selettore(p + 'volte', String(az.volte || 0), [['0', t('studio.volteAuto')], ...[1, 2, 3, 4, 5, 6].map(n => [String(n), t('studio.volte', { n })])], { 'aria-label': t('studio.quanteVolte') }));
    }
    if (az.tipo === 'scala') riga.append(selettore(p + 'scala', String(az.scala), [['0.4', t('studio.scala.minuscolo')], ['0.7', t('studio.scala.piccolo')], ['1', t('studio.scala.normale')], ['1.6', t('studio.scala.grande')], ['2.5', t('studio.scala.enorme')]], { 'aria-label': t('studio.misura') }));
    if (az.tipo === 'effetto') {
      riga.append(selettore(p + 'effetto', az.effetto, Object.keys(S().STOR_EFFETTI || {}).map(x => [x, t('storie.effetto.' + x)]), { 'aria-label': t('studio.effetto') }));
      riga.append(selettore(p + 'dove', az.dove, [['', t('studio.suChi')]].concat(opzioniPersonaggi(altri), luoghi.map(l => [l, t('studio.luogo.' + l)])), { 'aria-label': t('studio.dove') }));
      riga.append(selettore(p + 'grandezza', String(az.grandezza || 1), [['0.6', t('studio.scala.piccolo')], ['1', t('studio.scala.normale')], ['1.8', t('studio.scala.grande')], ['3', t('studio.scala.enorme')]], { 'aria-label': t('studio.misura') }));
      riga.append(h('input', { type: 'color', value: az.colore || '#ffd23f', dataset: { campo: p + 'colore' }, 'aria-label': t('studio.colore'), class: 'studio-colore' }));
    }
    riga.append(selettore(p + 'quando', az.quando, opzioniQuando(), { 'aria-label': t('studio.quando') }));
    if (!tre && (az.tipo === 'muovi' || az.tipo === 'torna')) riga.append(h('span', { class: 'studio-avviso' }, t('studio.soloIn3d')));
    riga.append(h('button', { type: 'button', class: 'tasto-cielo studio-x', dataset: { fai: 'togliAzione', dove: base }, 'aria-label': t('studio.togli') }, '×'));
    return riga;
  }

  function disegnaMomento(m, i, k, scena) {
    const base = `scene.${i}.momenti.${k}`;
    const presenti = studioPresenti(studio.progetto, scena);
    const box = h('article', { class: 'studio-momento' });
    const testa = h('div', { class: 'studio-riga' },
      h('span', { class: 'studio-numero' }, t('studio.momento', { n: k + 1 })),
      h('label', { class: 'storie-campo' }, h('span', {}, t('studio.chiParla')), selettore(base + '.chi', m.chi, opzioniPersonaggi(presenti, true))),
      h('label', { class: 'storie-campo' }, h('span', {}, t('storie.espressioneEtichetta')), selettore(base + '.umore', m.umore, opzioniUmori(true))),
      h('label', { class: 'storie-campo studio-corto' }, h('span', {}, t('studio.durata')),
        h('input', { type: 'number', min: '0', max: '120', step: '1', value: String(m.durata || ''), placeholder: t('studio.auto'), dataset: { campo: base + '.durata', numero: '1' } })),
      h('div', { class: 'studio-spinta' }),
      h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'su', dove: base }, 'aria-label': t('studio.su') }, '↑'),
      h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'giu', dove: base }, 'aria-label': t('studio.giu') }, '↓'),
      h('button', { type: 'button', class: 'tasto-cielo studio-x', dataset: { fai: 'togliMomento', dove: base }, 'aria-label': t('studio.togli') }, '×'));
    const testo = h('textarea', { rows: '2', maxlength: '400', dataset: { campo: base + '.testo' }, placeholder: t('studio.testoAiuto', { nome: m.chi ? nome(m.chi) : '…' }), 'aria-label': t('studio.battuta') });
    testo.value = m.testo || '';
    const parole = unaRiga(m.testo) ? unaRiga(m.testo).split(' ').length : 0;
    const contatore = h('span', { class: 'studio-contatore' + (parole > STUDIO_PAROLE_BAMBINI ? ' troppo' : '') }, t('studio.parole', { n: parole }));
    const aiutoTesto = h('div', { class: 'studio-riga' }, contatore,
      h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'umoreDalTesto', dove: base } }, t('studio.umoreDalTesto')));
    const azioni = h('div', { class: 'studio-azioni' });
    (m.azioni || []).forEach((az, j) => azioni.append(disegnaAzione(az, `${base}.azioni.${j}`, presenti, scena)));
    const aggiungi = h('div', { class: 'studio-riga' },
      selettore('', '', [['', t('studio.aggiungiAzione')]].concat(STUDIO_TIPI.map(x => [x, t('studio.tipo.' + x)])), { dataset: { aggiungi: base }, 'aria-label': t('studio.aggiungiAzione') }));
    const idee = studioIdeeAzioni(studio.progetto, scena, m);
    if (idee.length) {
      const fila = h('div', { class: 'studio-idee', role: 'group', 'aria-label': t('studio.idee') }, h('span', { class: 'studio-idee-titolo' }, t('studio.idee')));
      idee.forEach((a, j) => fila.append(h('button', { type: 'button', class: 'studio-idea', dataset: { fai: 'idea', dove: base, idea: String(j) } }, '+ ' + studioDescriviAzione(a))));
      aggiungi.append(fila);
    }
    box.append(testa, testo, aiutoTesto, azioni, aggiungi);
    return box;
  }

  function disegnaScena(sc, i) {
    const base = `scene.${i}`;
    const presenti = studioPresenti(studio.progetto, sc);
    const card = h('section', { class: 'studio-scena', 'aria-label': t('studio.scena', { n: i + 1 }) });
    const fuochi = sc.ambiente === 'cielo' ? STUDIO_FUOCHI_CIELO : STUDIO_FUOCHI_3D;
    const testa = h('div', { class: 'studio-riga studio-scena-testa' },
      h('h5', { class: 'studio-scena-titolo' }, t('studio.scena', { n: i + 1 })),
      h('label', { class: 'storie-campo' }, h('span', {}, t('studio.ambiente')),
        selettore(base + '.ambiente', sc.ambiente, STUDIO_AMBIENTI.map(a => [a, t('studio.ambiente.' + a)]))),
      (sc.ambiente === 'pianeta' || sc.ambiente === 'cielo') ? h('label', { class: 'storie-campo' }, h('span', {}, t('studio.fuoco')),
        selettore(base + '.fuoco', fuochi.includes(sc.fuoco) ? sc.fuoco : fuochi[0], fuochi.map(f => [f, nome(f)]))) : null,
      h('label', { class: 'storie-campo' }, h('span', {}, t('studio.inquadratura')),
        selettore(base + '.zoom', sc.zoom, Object.keys(STUDIO_ZOOM).map(z => [z, t('studio.zoom.' + z)]))),
      h('label', { class: 'storie-campo' }, h('span', {}, t('studio.giorno')), h('input', { type: 'date', value: sc.data, dataset: { campo: base + '.data' } })),
      h('label', { class: 'storie-campo studio-corto' }, h('span', {}, t('studio.ora')), h('input', { type: 'time', value: sc.ora, dataset: { campo: base + '.ora' } })),
      h('label', { class: 'storie-campo studio-corto' }, h('span', {}, t('studio.giorni')),
        h('input', { type: 'number', min: '0', max: '1000', step: '1', value: String(sc.giorni || 0), dataset: { campo: base + '.giorni', numero: '1' } })));
    const comandi = h('div', { class: 'studio-riga' },
      h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'ambienteAdatto', dove: base } }, t('studio.ambienteAdatto')),
      h('button', { type: 'button', class: 'tasto-cielo tasto-primario', dataset: { fai: 'provaScena', dove: base }, 'data-storia-prova': '' }, t('studio.provaScena')),
      h('div', { class: 'studio-spinta' }),
      h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'su', dove: base }, 'aria-label': t('studio.su') }, '↑'),
      h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'giu', dove: base }, 'aria-label': t('studio.giu') }, '↓'),
      h('button', { type: 'button', class: 'tasto-cielo studio-x', dataset: { fai: 'togliScena', dove: base }, 'aria-label': t('studio.togli') }, '×'));
    const chips = h('div', { class: 'studio-chips', role: 'group', 'aria-label': t('studio.inScena') }, h('span', { class: 'studio-idee-titolo' }, t('studio.inScena')));
    for (const id of studio.progetto.cast) {
      const acceso = presenti.includes(id);
      chips.append(h('label', { class: 'studio-chip' + (acceso ? ' acceso' : '') },
        h('input', { type: 'checkbox', checked: acceso, dataset: { presente: base, id } }), nome(id)));
    }
    const momenti = h('div', { class: 'studio-momenti' });
    sc.momenti.forEach((m, k) => momenti.append(disegnaMomento(m, i, k, sc)));
    const piede = h('div', { class: 'studio-riga' },
      h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'nuovoMomento', dove: base } }, t('studio.aggiungiMomento')),
      h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'prossimoMomento', dove: base } }, t('studio.prossimoMomento')));
    card.append(testa, comandi, chips, momenti, piede);
    return card;
  }

  function disegna() {
    const r = studio.radice;
    if (!r || !studio.progetto) return;
    const attivo = document.activeElement;
    const fuoco = attivo && r.contains(attivo) ? (attivo.dataset.campo || attivo.dataset.fai && attivo.dataset.fai + '|' + attivo.dataset.dove) : null;
    const p = studio.progetto;
    const pezzi = [];
    // Il progetto
    const elenco = selettore('', p.id, studio.progetti.map(x => [x.id, x.titolo || t('studio.senzaTitolo')]), { id: 'studio-progetti', 'aria-label': t('studio.progetti') });
    if (!studio.progetti.some(x => x.id === p.id)) elenco.prepend(new Option(p.titolo || t('studio.senzaTitolo'), p.id));
    elenco.value = p.id;
    pezzi.push(h('div', { class: 'studio-blocco studio-barra' },
      h('label', { class: 'storie-campo' }, h('span', {}, t('studio.progetti')), elenco),
      h('div', { class: 'demo-azioni' },
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'nuovo' } }, t('studio.nuovo')),
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'duplica' } }, t('studio.duplica')),
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'elimina' } }, t('studio.elimina')),
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'esporta' } }, t('studio.esporta')),
        h('label', { class: 'tasto-cielo demo-importa-tasto', for: 'studio-importa' }, t('studio.importa')),
        h('input', { id: 'studio-importa', class: 'demo-file-nascosto', type: 'file', accept: '.json,application/json' }))));
    // 1. Lo scopo
    const obiettivo = h('textarea', { rows: '2', maxlength: '300', dataset: { campo: 'obiettivo' }, placeholder: t('studio.obiettivoAiuto') });
    obiettivo.value = p.obiettivo || '';
    pezzi.push(h('div', { class: 'studio-blocco' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.passo1')),
      h('p', { class: 'demo-opzioni-nota' }, t('studio.passo1Aiuto')),
      h('div', { class: 'studio-riga' },
        h('label', { class: 'storie-campo' }, h('span', {}, t('studio.scopo')),
          selettore('', p.scopo, Object.keys(STUDIO_SCOPI).map(k => [k, t('studio.scopo.' + k + '.nome')]), { id: 'studio-scopo' })),
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'modello' } }, t('studio.usaModello'))),
      h('p', { class: 'demo-opzioni-nota studio-modello-descrizione' }, t('studio.scopo.' + p.scopo + '.descrizione')),
      h('label', { class: 'storie-campo studio-largo' }, h('span', {}, t('studio.titolo')),
        h('input', { type: 'text', maxlength: '120', value: p.titolo, dataset: { campo: 'titolo' }, placeholder: t('studio.titoloAiuto') })),
      h('label', { class: 'storie-campo studio-largo' }, h('span', {}, t('studio.obiettivo')), obiettivo)));
    // 2. I personaggi
    const cast = h('div', { class: 'studio-cast' });
    for (const id of Object.keys(S().STOR_PERSONAGGI || {})) {
      const prof = S().profilo ? S().profilo(id) : {};
      const acceso = p.cast.includes(id);
      cast.append(h('label', { class: 'studio-personaggio' + (acceso ? ' acceso' : '') },
        h('input', { type: 'checkbox', checked: acceso, dataset: { cast: id } }),
        h('span', { class: 'studio-pallino', style: 'background:' + (prof.pelle || '#cbd5e1') }),
        h('span', { class: 'studio-personaggio-testo' }, h('strong', { style: 'color:' + (prof.sottotitolo || '#fff') }, nome(id)),
          h('small', {}, S().personalita ? S().personalita(id) : ''))));
    }
    pezzi.push(h('div', { class: 'studio-blocco' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.passo2')),
      h('p', { class: 'demo-opzioni-nota' }, t('studio.passo2Aiuto')), cast));
    // 3. Le scene
    const scene = h('div', { class: 'studio-scene' });
    p.scene.forEach((sc, i) => scene.append(disegnaScena(sc, i)));
    pezzi.push(h('div', { class: 'studio-blocco' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.passo3')),
      h('p', { class: 'demo-opzioni-nota' }, t('studio.passo3Aiuto')), scene,
      h('div', { class: 'demo-azioni' }, h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'nuovaScena' } }, t('studio.aggiungiScena')))));
    // 4. A parole
    const parole = h('textarea', { id: 'studio-parole', rows: '3', placeholder: t('studio.paroleAiuto'), 'aria-label': t('studio.passo4') });
    const dove = selettore('', String(Math.min(studio.sceltaScena, p.scene.length - 1)), p.scene.map((_, i) => [String(i), t('studio.scena', { n: i + 1 })]), { id: 'studio-parole-scena', 'aria-label': t('studio.inQualeScena') });
    const capito = h('ul', { class: 'studio-capito', 'aria-live': 'polite' });
    if (studio.capito) {
      for (const o of studio.capito.ops) capito.append(h('li', { class: 'ok' }, o.op === 'battuta' ? t('studio.capitoBattuta', { chi: nome(o.chi), testo: o.testo }) : studioDescriviAzione(o.azione)));
      for (const f of studio.capito.nonCapite) capito.append(h('li', { class: 'no' }, t('studio.nonCapito', { frase: f })));
    }
    pezzi.push(h('div', { class: 'studio-blocco' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.passo4')),
      h('p', { class: 'demo-opzioni-nota' }, t('studio.passo4Aiuto')), parole,
      h('div', { class: 'studio-riga' }, dove, h('button', { type: 'button', class: 'tasto-cielo tasto-primario', dataset: { fai: 'capisci' } }, t('studio.fallo'))),
      capito));
    // 5. Il controllo
    const consigli = h('ul', { class: 'studio-consigli', id: 'studio-consigli' });
    pezzi.push(h('div', { class: 'studio-blocco' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.passo5')), consigli));
    // 6. Guarda e salva
    const copione = h('pre', { id: 'studio-copione', class: 'storie-codice', tabindex: '0', hidden: !studio.copioneAperto });
    pezzi.push(h('div', { class: 'studio-blocco' },
      h('h4', { class: 'storie-sottotitolo' }, t('studio.passo6')),
      h('div', { class: 'demo-azioni' },
        h('button', { type: 'button', class: 'demo-avvia-principale storia-avvia', dataset: { fai: 'guarda' }, 'data-storia-prova': '' }, t('studio.guarda')),
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'salvaDemo' } }, t('studio.salvaDemo')),
        h('button', { type: 'button', class: 'tasto-cielo', dataset: { fai: 'copione' }, 'aria-expanded': String(studio.copioneAperto), 'aria-controls': 'studio-copione' }, t('studio.mostraCopione'))),
      h('p', { id: 'studio-esito', class: 'demo-opzioni-nota', role: 'status', 'aria-live': 'polite' }, studio.esito), copione));
    r.replaceChildren(...pezzi);
    aggiornaVivi();
    if (fuoco) {
      const [fai, dove] = fuoco.split('|');
      const el = dove !== undefined ? r.querySelector(`[data-fai="${fai}"][data-dove="${dove}"]`) : r.querySelector(`[data-campo="${CSS.escape(fuoco)}"]`);
      if (el) el.focus();
    }
  }
  // Quello che cambia a ogni lettera: il controllo, il copione, i contatori
  function aggiornaVivi() {
    const r = studio.radice;
    if (!r) return;
    const lista = r.querySelector('#studio-consigli');
    if (lista) {
      const valida = radice.AstroDemo && typeof radice.AstroDemo.valida === 'function' ? radice.AstroDemo.valida : null;
      const consigli = studioConsigli(studio.progetto, valida);
      lista.replaceChildren(...consigli.map(c => h('li', { class: c.ok ? 'ok' : 'no' }, h('span', { class: 'studio-segno', 'aria-hidden': 'true' }, c.ok ? '✓' : '!'), c.testo)));
      lista.append(h('li', { class: 'info' }, t('studio.durataTotale', { n: studioDurataTotale(studio.progetto) })));
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
    studio.sceltaScena = 0; studio.capito = null; studio.esito = '';
    salvaPresto();
    disegna();
  }

  // Le operazioni dei bottoni
  function fai(nomeOp, dove, el) {
    const p = studio.progetto;
    const contenitore = percorso => { const parti = percorso.split('.'); const i = Number(parti.pop()); return { lista: leggi(parti.join('.')), i }; };
    switch (nomeOp) {
      case 'nuovo': apri(studioNuovoProgetto()); return;
      case 'duplica': { const c = copia(p); c.id = nuovoId('p'); c.titolo = t('studio.copiaDi', { titolo: p.titolo || t('studio.senzaTitolo') }); c.demoChiave = null; apri(c); return; }
      case 'elimina':
        if (!radice.confirm || radice.confirm(t('studio.confermaElimina'))) {
          studio.progetti = studio.progetti.filter(x => x.id !== p.id);
          studioSalvaTutti(studio.progetti);
          apri(studio.progetti[0] || studioNuovoProgetto());
        }
        return;
      case 'esporta': {
        const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: (unaRiga(p.titolo) || 'storia').replace(/[^\w-]+/g, '_').slice(0, 40) + '.storia.json' });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        return;
      }
      case 'modello': {
        const scopo = studio.radice.querySelector('#studio-scopo').value;
        const vuoto = !p.scene.some(sc => sc.momenti.some(m => unaRiga(m.testo)));
        if (vuoto || !radice.confirm || radice.confirm(t('studio.confermaModello'))) {
          const nuovo = studioDaModello(scopo);
          nuovo.id = p.id; nuovo.demoChiave = p.demoChiave;
          apri(nuovo);
        }
        return;
      }
      case 'nuovaScena': {
        const ultima = p.scene[p.scene.length - 1];
        p.scene.push(studioNuovaScena(ultima ? { ambiente: ultima.ambiente, fuoco: ultima.fuoco, zoom: ultima.zoom, presenti: ultima.presenti.slice() } : {}));
        break;
      }
      case 'togliScena': { const { lista, i } = contenitore(dove); if (lista.length > 1) lista.splice(i, 1); break; }
      case 'nuovoMomento': leggi(dove).momenti.push(studioNuovoMomento()); break;
      case 'prossimoMomento': { const sc = leggi(dove); sc.momenti.push(studioProssimoMomento(p, sc)); break; }
      case 'togliMomento': { const { lista, i } = contenitore(dove); lista.splice(i, 1); if (!lista.length) lista.push(studioNuovoMomento()); break; }
      case 'togliAzione': { const { lista, i } = contenitore(dove); lista.splice(i, 1); break; }
      case 'su': case 'giu': {
        const { lista, i } = contenitore(dove);
        const j = nomeOp === 'su' ? i - 1 : i + 1;
        if (j >= 0 && j < lista.length) [lista[i], lista[j]] = [lista[j], lista[i]];
        break;
      }
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
        const testo = studio.radice.querySelector('#studio-parole').value;
        const i = Number(studio.radice.querySelector('#studio-parole-scena').value) || 0;
        studio.sceltaScena = i;
        studio.capito = studioCapisci(testo, p);
        studioApplica(p, i, studio.capito.ops);
        if (studio.capito.ops.length) studio.radice.querySelector('#studio-parole').value = '';
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
      if (el.id === 'studio-scopo') { studio.progetto.scopo = el.value; salvaPresto(); disegna(); return; }
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
      if (el.dataset.aggiungi) {
        const m = leggi(el.dataset.aggiungi);
        const sc = studio.progetto.scene[Number(el.dataset.aggiungi.split('.')[1])];
        if (m && el.value) m.azioni.push(studioNuovaAzione(el.value, { chi: m.chi || studioPresenti(studio.progetto, sc)[0] || '' }));
        salvaPresto(); disegna();
        return;
      }
      if (el.dataset.cast) {
        const id = el.dataset.cast, cast = studio.progetto.cast;
        if (el.checked && !cast.includes(id)) cast.push(id);
        if (!el.checked && cast.length > 1) studio.progetto.cast = cast.filter(x => x !== id);
        salvaPresto(); disegna();
        return;
      }
      if (el.dataset.presente) {
        const sc = leggi(el.dataset.presente);
        let lista = studioPresenti(studio.progetto, sc);
        if (el.checked && !lista.includes(el.dataset.id)) lista.push(el.dataset.id);
        if (!el.checked) lista = lista.filter(x => x !== el.dataset.id);
        // Almeno uno in scena: togliere l'ultimo li rimetterebbe tutti
        if (lista.length) sc.presenti = lista;
        salvaPresto(); disegna();
        return;
      }
      if (el.dataset.campo) {
        let v = el.value;
        if (el.dataset.numero) v = Math.max(0, Number(v) || 0);
        if (/\.(volte|scala|grandezza)$/.test(el.dataset.campo)) v = Number(v) || 0;
        const campo = el.dataset.campo;
        if (/\.tipo$/.test(campo)) {
          // Un'azione che cambia tipo riparte dai valori di serie del tipo nuovo
          const vecchia = leggi(campo.replace(/\.tipo$/, ''));
          Object.assign(vecchia, studioNuovaAzione(v, { id: vecchia.id, chi: vecchia.chi }));
        } else scrivi(campo, v);
        salvaPresto();
        // Solo una scelta cambia i campi da mostrare. Ridisegnare dopo un
        // campo di testo o di numero vorrebbe dire rifare la pagina proprio
        // mentre il dito sta premendo il bottone accanto: il clic si perde.
        if (el.tagName === 'SELECT') disegna();
        else aggiornaVivi();
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
    get progetto() { return studio.progetto; }, ridisegna: () => disegna()
  };
  radice.StudioStorie = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
