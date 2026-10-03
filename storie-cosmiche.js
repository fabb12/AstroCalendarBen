/* storie-cosmiche.js — Le Storie cosmiche: gli astri che parlano ai bambini.
 *
 * Una Storia cosmica è una demo come le altre (`demo.js`, `DEMO.md`): stesso
 * motore, stesso orologio, stessa voce. In più, per la durata di una scena,
 * alcuni astri hanno un **volto** — due occhi grandi con l'iride, la
 * pupilla, le palpebre e i riflessi, le sopracciglia, una bocca che si muove
 * soltanto quando quel personaggio parla — e il sottotitolo dice il suo nome.
 *
 * Tre promesse, e sono la ragione per cui il file è fatto così.
 *
 *   1. **Il cielo resta vero.** Questo modulo non calcola nessuna posizione
 *      e non sposta niente: i volti si appoggiano dove i renderer esistenti
 *      hanno appena disegnato l'astro — la ricevuta di `skyDisegnaAstro` e di
 *      `corpiMinoriDisegna` nel planetario, i corpi già proiettati da
 *      `solDisegna` e da `solDisegnaVicino` nella vista 3D. Niente seconda
 *      proiezione: se la Luna è una falce, il volto sta sulla falce; se
 *      Giove è un puntino, il volto sta in un **disco grafico** accanto a lui,
 *      collegato da un filo, e il puntino resta un puntino.
 *   2. **Un livello a parte.** Si disegna sopra a tutto, alla fine del
 *      fotogramma, e solo nelle storie: fuori da una demo che lo chiede non
 *      c'è nessun volto, e `storRicevuta` esce alla prima riga.
 *   3. **I personaggi sono dati.** Un personaggio è una voce in
 *      `STOR_PERSONAGGI` (o una famiglia in `STOR_FAMIGLIE`); un'espressione è
 *      una voce in `STOR_ESPRESSIONI`; una forma della bocca una voce in
 *      `STOR_BOCCHE`. Il disegno è uno solo e legge quelle tabelle.
 *
 * La bocca (§4) segue la voce di `window.narrazione` e nessun'altra: prima
 * l'ampiezza vera dell'audio (Web Audio), poi i confini di parola della
 * sintesi, poi il ritmo del testo con le pause sulla punteggiatura. Mentre un
 * personaggio parla si muove soltanto la sua bocca; gli altri la tengono
 * chiusa e lo guardano.
 *
 * Prefisso `stor`. Si carica dopo `demo.js` (registra i suoi comandi con
 * `AstroDemo.registra`) e prima di `demo-impostazioni.js`. Tutto in
 * `STORIE.md`; prove in `scripts/prova-storie.js` (motore, senza browser) e
 * `scripts/prova-storie-browser.js`. */
(function (radice) {
  'use strict';

  // ===================================================================
  // 1. Le tabelle: espressioni, bocche, famiglie, personaggi
  // ===================================================================

  /* Un'espressione è un insieme di manopole del volto. Le unità sono
   * relative: le palpebre in frazioni dell'altezza dell'occhio (0 aperto,
   * 1 chiuso), le sopracciglia in frazioni del raggio del volto, la bocca
   * di riposo è un nome di `STOR_BOCCHE` con la sua curvatura (+ sorriso,
   * − broncio), lo sguardo una direzione (x verso destra, y verso il basso)
   * usata solo quando nessuno chiede di guardare altrove.
   *
   * Le espressioni sono **esagerate di proposito**: il pubblico sono i
   * bambini, e un volto appoggiato su una Luna larga settanta pixel si legge
   * solo se dice una cosa sola e la dice forte — come nei cartoni, dove la
   * sorpresa spalanca gli occhi a un terzo in più e le sopracciglia escono
   * quasi dalla testa. Oltre ai tratti ci sono le manopole del corpo:
   *   occhi     quanto si allargano gli occhi (1 = di serie)
   *   iride     quanto è grande l'iride (gli occhioni tristi)
   *   stelle    le pupille diventano stelle (l'entusiasmo)
   *   testa     di quanto si inclina la testa, in radianti
   *   rimbalzo  il saltello della contentezza
   *   tremito   il tremolio della paura
   *   segno     il «segno da fumetto» che accompagna il volto: scintille,
   *             esclamazione, lacrima, goccia, pensiero, zzz (§6-bis)
   *
   * Aggiungere un'espressione: una voce qui, e le due chiavi
   * `storie.espressione.<nome>` nei dizionari (le legge la pagina Demo). */
  const STOR_ESPRESSIONI = {
    neutral: {
      palpebraSu: 0.08, palpebraGiu: 0.05, pupilla: 1,
      ciglio: { alza: 0.04, inclina: 0, curva: 0.22, asimmetria: 0 },
      bocca: 'chiusa', curva: 0.22, guance: 0.3, sguardo: null
    },
    happy: {
      palpebraSu: 0.02, palpebraGiu: 0.4, pupilla: 1.12, iride: 1.05,
      ciglio: { alza: 0.3, inclina: -0.1, curva: 0.6, asimmetria: 0 },
      bocca: 'sorriso', curva: 0.85, guance: 1, sguardo: null,
      rimbalzo: 1, segno: 'scintille'
    },
    surprised: {
      palpebraSu: 0, palpebraGiu: 0, pupilla: 0.5, occhi: 1.16, iride: 0.86,
      ciglio: { alza: 0.95, inclina: 0, curva: 0.7, asimmetria: 0 },
      bocca: 'O', curva: 0, guance: 0.35, sguardo: null,
      segno: 'esclamazione'
    },
    worried: {
      palpebraSu: 0.04, palpebraGiu: 0, pupilla: 0.72, occhi: 1.06,
      ciglio: { alza: 0.38, inclina: 1, curva: 0.05, asimmetria: 0 },
      bocca: 'ondulata', curva: -0.25, guance: 0.2, sguardo: null,
      tremito: 1, segno: 'goccia'
    },
    sad: {
      palpebraSu: 0.44, palpebraGiu: 0.1, pupilla: 1.3, iride: 1.16,
      ciglio: { alza: 0.06, inclina: 1.1, curva: -0.05, asimmetria: 0 },
      bocca: 'triste', curva: -0.9, guance: 0.12, sguardo: { x: 0, y: 0.55 },
      testa: 0.13, segno: 'lacrima'
    },
    thinking: {
      palpebraSu: 0.3, palpebraGiu: 0.14, pupilla: 1,
      ciglio: { alza: 0.12, inclina: -0.3, curva: 0.25, asimmetria: 0.6 },
      bocca: 'chiusa', curva: -0.1, spostaBocca: 0.2, guance: 0.2, sguardo: { x: 0.7, y: -0.65 },
      testa: -0.15, segno: 'pensiero'
    },
    excited: {
      palpebraSu: 0, palpebraGiu: 0.12, pupilla: 1.2, occhi: 1.12, iride: 1.1, stelle: 1,
      ciglio: { alza: 0.62, inclina: -0.12, curva: 0.75, asimmetria: 0 },
      bocca: 'grande', curva: 0.95, guance: 1, sguardo: null,
      rimbalzo: 1.7, segno: 'scintille'
    },
    sleepy: {
      palpebraSu: 0.64, palpebraGiu: 0.14, pupilla: 1,
      ciglio: { alza: -0.04, inclina: 0.2, curva: 0.1, asimmetria: 0 },
      bocca: 'piccola', curva: 0, guance: 0.45, sguardo: { x: 0, y: 0.3 },
      testa: 0.12, segno: 'zzz'
    }
  };
  const STOR_ESPRESSIONE_DI_SERIE = 'neutral';

  /* Le forme della bocca, nelle unità del volto: `larg` è la mezza
   * larghezza, `aper` l'altezza dell'apertura, `tondo` quanto somiglia a un
   * cerchio (la O), `curva` la curvatura propria (il sorriso e il broncio la
   * hanno anche da chiusi), `onda` la bocca tremolante della paura. Le
   * prime cinque sono quelle del parlato. */
  const STOR_BOCCHE = {
    chiusa:   { larg: 0.17, aper: 0,    tondo: 0,    curva: 0,     onda: 0 },
    piccola:  { larg: 0.11, aper: 0.08, tondo: 0.5,  curva: 0,     onda: 0 },
    A:        { larg: 0.17, aper: 0.28, tondo: 0.25, curva: 0,     onda: 0 },
    E:        { larg: 0.23, aper: 0.13, tondo: 0,    curva: 0.12,  onda: 0 },
    O:        { larg: 0.13, aper: 0.26, tondo: 1,    curva: 0,     onda: 0 },
    sorriso:  { larg: 0.3,  aper: 0.11, tondo: 0,    curva: 0.8,   onda: 0 },
    grande:   { larg: 0.32, aper: 0.3,  tondo: 0,    curva: 0.75,  onda: 0 },
    triste:   { larg: 0.2,  aper: 0,    tondo: 0,    curva: -0.7,  onda: 0 },
    ondulata: { larg: 0.22, aper: 0,    tondo: 0,    curva: -0.15, onda: 1 }
  };
  const STOR_BOCCHE_PARLATO = ['chiusa', 'piccola', 'A', 'E', 'O'];

  /* Le famiglie: quello che un personaggio eredita se non dice altro. Un
   * oggetto che l'app conosce ma che nessuna voce di `STOR_PERSONAGGI`
   * nomina (una luna di Urano, un asteroide, la sesta stella dell'elenco)
   * parla lo stesso, con la faccia della sua famiglia. */
  const STOR_FAMIGLIE = {
    stella:   { pelle: '#fde68a', iride: '#f59e0b', sottotitolo: '#fde68a', guance: '#fb923c',
      forma: 'disco', scala: 0.8, voce: { ritmo: '-2%', tono: '2Hz' }, espressione: 'happy', personalita: 'stella' },
    pianeta:  { pelle: '#cbd5e1', iride: '#3b82f6', sottotitolo: '#e2e8f0', guance: '#f9a8d4',
      forma: 'disco', scala: 0.78, voce: { ritmo: '0%', tono: '0Hz' }, espressione: 'neutral', personalita: 'pianeta' },
    luna:     { pelle: '#e2e8f0', iride: '#64748b', sottotitolo: '#e2e8f0', guance: '#fbcfe8',
      forma: 'disco', scala: 0.8, voce: { ritmo: '4%', tono: '10Hz' }, espressione: 'neutral', personalita: 'luna' },
    nano:     { pelle: '#e3d3bd', iride: '#7c3aed', sottotitolo: '#ddd6fe', guance: '#fbcfe8',
      forma: 'disco', scala: 0.8, voce: { ritmo: '6%', tono: '14Hz' }, espressione: 'happy', personalita: 'nano' },
    asteroide:{ pelle: '#d6d3d1', iride: '#b45309', sottotitolo: '#fcd34d', guance: '#fdba74',
      forma: 'disco', scala: 0.8, voce: { ritmo: '8%', tono: '18Hz' }, espressione: 'happy', personalita: 'asteroide' },
    cometa:   { pelle: '#a7f3d0', iride: '#0d9488', sottotitolo: '#a7f3d0', guance: '#99f6e4',
      forma: 'disco', scala: 0.8, voce: { ritmo: '10%', tono: '12Hz' }, espressione: 'surprised', personalita: 'cometa' },
    stazione: { pelle: '#bfdbfe', iride: '#2563eb', sottotitolo: '#93c5fd', guance: '#bae6fd',
      forma: 'riquadro', scala: 0.8, voce: { ritmo: '6%', tono: '4Hz' }, espressione: 'happy', personalita: 'stazione' },
    sonda:    { pelle: '#fde68a', iride: '#a16207', sottotitolo: '#fcd34d', guance: '#fed7aa',
      forma: 'riquadro', scala: 0.8, voce: { ritmo: '-4%', tono: '-4Hz' }, espressione: 'thinking', personalita: 'sonda' }
  };

  /* I personaggi con un carattere loro. Ogni campo è facoltativo e vince su
   * quello della famiglia:
   *
   *   famiglia      una chiave di STOR_FAMIGLIE
   *   nome          chiave del dizionario del nome (di serie il nome che l'app
   *                 dà già a quell'oggetto: `corpo.<id>`, SOL_LUNE, …)
   *   pelle         il colore del disco grafico e delle palpebre
   *   iride         il colore degli occhi
   *   sottotitolo   il colore del nome nel sottotitolo
   *   guance        il colore del rossore (happy)
   *   forma         'disco' o 'riquadro' (quando il volto sta fuori dall'astro)
   *   scala         quanto del disco occupa il volto (0–0,95 del raggio)
   *   dx, dy        dove sta il volto rispetto al centro (in raggi)
   *   occhi         { r, distanza, alto } in frazioni del volto
   *   voce          { ritmo, tono } per la sintesi (vedi narrazione.js)
   *   espressione   quella di partenza
   *   personalita   chiave `storie.personalita.<…>` (detta nella pagina Demo)
   *   alias         gli altri nomi con cui l'app lo chiama in un'altra vista
   *
   * Aggiungere un personaggio è aggiungere una riga qui (e il suo nome nei
   * dizionari se l'app non ne ha già uno). */
  const STOR_PERSONAGGI = {
    Sun:      { famiglia: 'stella', pelle: '#fcd34d', iride: '#c2410c', sottotitolo: '#fde047', guance: '#fb923c',
      scala: 0.72, voce: { ritmo: '-8%', tono: '-10Hz' }, espressione: 'happy', personalita: 'Sun' },
    Mercury:  { famiglia: 'pianeta', pelle: '#d6d3d1', iride: '#78716c', sottotitolo: '#e7e5e4',
      voce: { ritmo: '14%', tono: '16Hz' }, espressione: 'happy', personalita: 'Mercury' },
    Venus:    { famiglia: 'pianeta', pelle: '#fde68a', iride: '#d97706', sottotitolo: '#fef08a',
      voce: { ritmo: '-2%', tono: '12Hz' }, espressione: 'happy', personalita: 'Venus' },
    Earth:    { famiglia: 'pianeta', pelle: '#7dd3fc', iride: '#15803d', sottotitolo: '#7dd3fc', guance: '#fda4af',
      voce: { ritmo: '-3%', tono: '0Hz' }, espressione: 'happy', personalita: 'Earth' },
    Moon:     { famiglia: 'luna', pelle: '#e2e8f0', iride: '#6366f1', sottotitolo: '#c7d2fe', guance: '#f9a8d4',
      voce: { ritmo: '2%', tono: '18Hz' }, espressione: 'neutral', personalita: 'Moon',
      occhi: { r: 0.28, distanza: 0.39, alto: -0.12 } },
    Mars:     { famiglia: 'pianeta', pelle: '#fca5a5', iride: '#b91c1c', sottotitolo: '#fca5a5',
      voce: { ritmo: '8%', tono: '6Hz' }, espressione: 'happy', personalita: 'Mars' },
    Jupiter:  { famiglia: 'pianeta', pelle: '#fed7aa', iride: '#9a3412', sottotitolo: '#fdba74',
      scala: 0.7, voce: { ritmo: '-10%', tono: '-14Hz' }, espressione: 'happy', personalita: 'Jupiter' },
    Saturn:   { famiglia: 'pianeta', pelle: '#fde68a', iride: '#a16207', sottotitolo: '#fde68a',
      scala: 0.7, voce: { ritmo: '-6%', tono: '-8Hz' }, espressione: 'happy', personalita: 'Saturn' },
    Uranus:   { famiglia: 'pianeta', pelle: '#a5f3fc', iride: '#0e7490', sottotitolo: '#a5f3fc',
      voce: { ritmo: '-4%', tono: '4Hz' }, espressione: 'thinking', personalita: 'Uranus' },
    Neptune:  { famiglia: 'pianeta', pelle: '#93c5fd', iride: '#1d4ed8', sottotitolo: '#93c5fd',
      voce: { ritmo: '-6%', tono: '-2Hz' }, espressione: 'neutral', personalita: 'Neptune' },
    Pluto:    { famiglia: 'nano', pelle: '#e3d3bd', iride: '#92400e', sottotitolo: '#fde68a', personalita: 'Pluto' },
    Io:       { famiglia: 'luna', pelle: '#fde68a', iride: '#ca8a04', sottotitolo: '#fde68a', espressione: 'surprised' },
    Europa:   { famiglia: 'luna', pelle: '#e0f2fe', iride: '#0284c7', sottotitolo: '#bae6fd' },
    Ganymede: { famiglia: 'luna', pelle: '#d6d3d1', iride: '#57534e', sottotitolo: '#e7e5e4' },
    Callisto: { famiglia: 'luna', pelle: '#a8a29e', iride: '#44403c', sottotitolo: '#d6d3d1' },
    Titan:    { famiglia: 'luna', pelle: '#fcd34d', iride: '#b45309', sottotitolo: '#fcd34d' },
    iss:      { famiglia: 'stazione', alias: ['sat-iss', 'ISS'], personalita: 'iss' },
    css:      { famiglia: 'stazione', alias: ['sat-css', 'Tiangong'], pelle: '#fecaca', iride: '#dc2626', sottotitolo: '#fca5a5' },
    hubble:   { famiglia: 'stazione', alias: ['sat-hubble', 'Hubble'], pelle: '#e5e7eb', iride: '#4b5563', sottotitolo: '#e5e7eb' },
    voyager1: { famiglia: 'sonda', alias: ['Voyager 1'], personalita: 'voyager' },
    voyager2: { famiglia: 'sonda', alias: ['Voyager 2'], pelle: '#fbcfe8', iride: '#be185d', sottotitolo: '#f9a8d4', personalita: 'voyager' }
  };
  const STOR_PIANETI = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

  // Le misure del disegno, in pixel CSS.
  const STOR_VOLTO_MIN_PX = 22;      // sotto questo raggio di volto, il disco grafico
  const STOR_DISCO_MIN_PX = 28;      // il disco grafico: mai più piccolo di così
  const STOR_DISCO_MAX_PX = 56;
  const STOR_ASTRO_MIN_PX = 0.5;     // sotto, l'astro non è disegnato abbastanza da indicarlo
  const STOR_MARGINE_PX = 8;
  // I tempi, in millisecondi dell'orologio della storia (fermo in pausa).
  const STOR_BATTITO_MS = { chiude: 70, tiene: 25, apre: 105 };
  const STOR_BATTITO_OGNI = [2600, 6000];          // intervallo naturale
  const STOR_BATTITO_OGNI_RIDOTTO = [5200, 9000];  // col movimento ridotto
  const STOR_TAU_ESPRESSIONE = 180;
  const STOR_TAU_SGUARDO = 110;
  const STOR_TAU_BOCCA_APRE = 34;
  const STOR_COMPARSA_MS = 560;     // il «pop» elastico con cui un volto compare
  const STOR_BOING_MS = 460;        // il rimbalzo di un cambio d'espressione
  const STOR_SACCADI_MS = [900, 2600]; // le occhiate a vuoto di chi sta fermo

  // ===================================================================
  // 2. Chi è chi: profili, nomi, oggetti dell'app
  // ===================================================================

  const haI18n = () => typeof radice.astroI18n === 'object' && radice.astroI18n &&
    typeof radice.astroI18n.esiste === 'function';
  const t = (k, d) => haI18n() && radice.astroI18n.esiste(k) ? radice.astroI18n.t(k, d) : '';
  // I globali dell'app sono dichiarazioni di primo livello (`const sky`, …):
  // non stanno su `window`, ma da qui si vedono per nome. Ognuno dietro al
  // suo `typeof`, perché nelle prove Node non c'è nessuno di loro.
  const GLOBALI = {
    sky: () => typeof sky !== 'undefined' ? sky : undefined,
    sol: () => typeof sol !== 'undefined' ? sol : undefined,
    skyAltezzaOrizzonte: () => typeof skyAltezzaOrizzonte !== 'undefined' ? skyAltezzaOrizzonte : undefined,
    skyFasceCielo: () => typeof skyFasceCielo !== 'undefined' ? skyFasceCielo : undefined,
    nomeCorpo: () => typeof nomeCorpo !== 'undefined' ? nomeCorpo : undefined,
    corpiMinori: () => typeof corpiMinori !== 'undefined' ? corpiMinori : undefined,
    SKY_ASTRI: () => typeof SKY_ASTRI !== 'undefined' ? SKY_ASTRI : undefined,
    SOL_LUNE: () => typeof SOL_LUNE !== 'undefined' ? SOL_LUNE : undefined,
    SOL_MONDI: () => typeof SOL_MONDI !== 'undefined' ? SOL_MONDI : undefined,
    SOL_SONDE: () => typeof SOL_SONDE !== 'undefined' ? SOL_SONDE : undefined,
    SATELLITI: () => typeof SATELLITI !== 'undefined' ? SATELLITI : undefined
  };
  const globale = nome => {
    if (radice[nome] !== undefined) return radice[nome];
    try { return GLOBALI[nome] ? GLOBALI[nome]() : undefined; } catch (_) { return undefined; }
  };

  // Le tabelle dell'app che dicono quali oggetti esistono. Lette con cautela:
  // nelle prove Node non ci sono, e il modulo resta usabile con le sue.
  function tabella(nome) { const v = globale(nome); return Array.isArray(v) ? v : []; }

  // Il nome con cui questo modulo chiama un oggetto, qualunque sia la vista
  // che lo ha disegnato: `sat-iss` nel planetario e `iss` nella 3D sono la
  // stessa stazione, `min:Cerere` e `Ceres` lo stesso pianeta nano.
  function storCanonico(id) {
    if (typeof id !== 'string' || !id) return '';
    if (Object.prototype.hasOwnProperty.call(STOR_PERSONAGGI, id)) return id;
    for (const [chiave, p] of Object.entries(STOR_PERSONAGGI)) if (p.alias && p.alias.includes(id)) return chiave;
    if (id.startsWith('sat-')) return id.slice(4);
    const mondo = tabella('SOL_MONDI').find(m => m.idCielo === id || m.dal === id || m.nome === id);
    if (mondo) return mondo.id;
    return id;
  }

  // Di che famiglia è un oggetto, o `null` se l'app non lo conosce.
  function storFamigliaDi(id) {
    if (STOR_PERSONAGGI[id] && STOR_PERSONAGGI[id].famiglia) return STOR_PERSONAGGI[id].famiglia;
    if (/^Star[1-9]\d*$/.test(id)) return 'stella';
    if (tabella('SOL_LUNE').some(l => l.id === id)) return 'luna';
    const mondo = tabella('SOL_MONDI').find(m => m.id === id);
    if (mondo) return mondo.famiglia === 'nano' ? 'nano' : 'asteroide';
    if (tabella('SOL_SONDE').some(s => s.id === id)) return 'sonda';
    if (tabella('SATELLITI').some(s => s.id === id)) return 'stazione';
    if (id.startsWith('min:') && id.length > 4) {
      const cm = globale('corpiMinori');
      const elenco = cm && Array.isArray(cm.elenco) ? cm.elenco.concat(cm.miei || []) : [];
      const c = elenco.find(x => x && x.nome === id.slice(4));
      return c && c.tipo === 'cometa' ? 'cometa' : 'asteroide';
    }
    return null;
  }

  // Esiste davvero? Per i corpi minori, a catalogo non ancora caricato, si
  // accetta il nome scritto bene: si saprà al disegno se c'è in cielo.
  function storOggettoNoto(id) {
    if (!id) return false;
    if (STOR_PERSONAGGI[id]) return true;
    const astri = tabella('SKY_ASTRI');
    if (/^Star\d+$/.test(id)) return astri.length ? astri.some(a => a.id === id) : /^Star[1-8]$/.test(id);
    if (astri.some(a => a.id === id)) return true;
    if (id.startsWith('min:')) {
      const cm = globale('corpiMinori');
      const elenco = cm && Array.isArray(cm.elenco) ? cm.elenco.concat(cm.miei || []) : [];
      if (!elenco.length || !cm || cm.stato !== 'pronto') return id.length > 4;
      return elenco.some(c => c && c.nome === id.slice(4));
    }
    return storFamigliaDi(id) !== null;
  }

  // Il profilo intero di un personaggio: famiglia, poi la sua riga.
  function storProfilo(target) {
    const id = storCanonico(target);
    const proprio = STOR_PERSONAGGI[id] || {};
    const famiglia = proprio.famiglia || storFamigliaDi(id) ||
      (STOR_PIANETI.includes(id) ? 'pianeta' : 'pianeta');
    const base = STOR_FAMIGLIE[famiglia] || STOR_FAMIGLIE.pianeta;
    const colore = (tabella('SOL_LUNE').find(l => l.id === id) || tabella('SOL_MONDI').find(m => m.id === id) || {}).colore;
    const p = Object.assign({}, base, colore && !proprio.pelle ? { pelle: colore } : {}, proprio);
    p.id = id; p.famiglia = famiglia;
    p.voce = Object.assign({}, base.voce, proprio.voce || {});
    p.occhi = Object.assign({ r: 0.26, distanza: 0.37, alto: -0.1 }, base.occhi || {}, proprio.occhi || {});
    p.scala = Math.max(0.3, Math.min(0.95, Number(p.scala) || 0.78));
    p.dx = Number(p.dx) || 0; p.dy = Number(p.dy) || 0;
    if (!STOR_ESPRESSIONI[p.espressione]) p.espressione = STOR_ESPRESSIONE_DI_SERIE;
    return p;
  }

  function storNome(target) {
    const p = typeof target === 'object' ? target : storProfilo(target);
    if (p.nome) { const n = t(p.nome); if (n) return n; }
    const id = p.id;
    const nomeCorpo = globale('nomeCorpo');
    if (typeof nomeCorpo === 'function' && haI18n() && radice.astroI18n.esiste('corpo.' + id)) return nomeCorpo(id);
    for (const nome of ['SKY_ASTRI', 'SOL_LUNE', 'SOL_MONDI', 'SOL_SONDE', 'SATELLITI']) {
      const x = tabella(nome).find(o => o.id === id);
      if (x && x.nome) return String(x.nome);
    }
    if (id.startsWith('min:')) return id.slice(4);
    if (p.alias && p.alias.length) return p.alias[p.alias.length - 1];
    return id;
  }

  function storPersonalita(target) {
    const p = typeof target === 'object' ? target : storProfilo(target);
    return t('storie.personalita.' + p.personalita) || '';
  }

  // ===================================================================
  // 3. Il ritmo di una frase (il terzo segnale della bocca, e la mappa
  //    carattere → tempo che serve anche agli altri due)
  // ===================================================================

  /* Una frase diventa una fila di sillabe e di pause. Non è fonetica, e non
   * vuole esserlo: è quanto basta perché la bocca si apra sulle vocali, si
   * chiuda fra una parola e l'altra e stia ferma sulle virgole e sui punti —
   * cioè perché si muova **con** la frase e non a caso. Ogni sillaba porta
   * la sua vocale (a → A, e/i → E, o/u → O) e i caratteri che copre, così
   * un confine di parola della sintesi (che dice un carattere) si traduce in
   * un tempo. Le durate sono quelle di una sintesi a passo normale; chi
   * conosce la durata vera (un file audio) scala la fila su quella. */
  const STOR_SILLABA_S = 0.19;
  const STOR_FRA_PAROLE_S = 0.035;
  const STOR_PAUSE_S = { ',': 0.22, ';': 0.26, ':': 0.3, '.': 0.42, '!': 0.42, '?': 0.42, '…': 0.5, '—': 0.24, '–': 0.2 };
  const VOCALI = 'aeiouàèéìíòóùúáäëïöüy';
  function vocaleDi(ch) {
    const c = ch.normalize ? ch.normalize('NFD')[0] : ch;
    if ('a'.includes(c)) return 'a';
    if ('ei'.includes(c) || c === 'y') return 'e';
    return 'o';
  }
  function storRitmo(testo) {
    const s = String(testo || '').toLowerCase();
    const segmenti = [];
    let t = 0, i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (STOR_PAUSE_S[ch] !== undefined) {
        // Una pausa sola anche per «!?» o «...»: si allunga, non si ripete.
        let fine = i + 1, durata = STOR_PAUSE_S[ch];
        while (fine < s.length && STOR_PAUSE_S[s[fine]] !== undefined) { durata = Math.max(durata, STOR_PAUSE_S[s[fine]]) + 0.04; fine++; }
        segmenti.push({ tipo: 'pausa', inizio: t, fine: t + durata, da: i, a: fine });
        t += durata; i = fine; continue;
      }
      if (/\s/.test(ch)) {
        let fine = i + 1;
        while (fine < s.length && /\s/.test(s[fine])) fine++;
        segmenti.push({ tipo: 'pausa', inizio: t, fine: t + STOR_FRA_PAROLE_S, da: i, a: fine, breve: true });
        t += STOR_FRA_PAROLE_S; i = fine; continue;
      }
      if (/[\p{L}\p{N}]/u.test(ch)) {
        // Una sillaba: consonanti, un gruppo di vocali, le consonanti finché
        // non comincia un'altra vocale. I numeri valgono una sillaba a cifra.
        let j = i, vocale = null;
        if (/\p{N}/u.test(ch)) { vocale = 'e'; j = i + 1; }
        else {
          while (j < s.length && /\p{L}/u.test(s[j]) && !VOCALI.includes(s[j])) j++;
          if (j < s.length && VOCALI.includes(s[j])) { vocale = vocaleDi(s[j]); while (j < s.length && VOCALI.includes(s[j])) j++; }
          let k = j;
          while (k < s.length && /\p{L}/u.test(s[k]) && !VOCALI.includes(s[k])) k++;
          // Le consonanti in coda vanno a questa sillaba solo se dopo non
          // c'è una vocale (fine parola); se no l'ultima va alla prossima.
          if (k >= s.length || !/\p{L}/u.test(s[k])) j = k;
          else if (k - j >= 2) j = k - 1;
        }
        if (j === i) j = i + 1;
        if (!vocale) { // solo consonanti (una sigla, «mmm»): una sillaba chiusa
          segmenti.push({ tipo: 'sillaba', inizio: t, fine: t + STOR_SILLABA_S * 0.6, da: i, a: j, vocale: 'e', forza: 0.35 });
          t += STOR_SILLABA_S * 0.6;
        } else {
          segmenti.push({ tipo: 'sillaba', inizio: t, fine: t + STOR_SILLABA_S, da: i, a: j, vocale, forza: 1 });
          t += STOR_SILLABA_S;
        }
        i = j; continue;
      }
      i++; // simboli che non si dicono
    }
    return { segmenti, totale: t, lunghezza: s.length };
  }

  function segmentoAl(ritmo, tempo) {
    const seg = ritmo.segmenti;
    if (!seg.length) return null;
    let a = 0, b = seg.length - 1;
    if (tempo <= seg[0].inizio) return seg[0];
    if (tempo >= seg[b].fine) return null;
    while (a < b) { const m = (a + b) >> 1; if (seg[m].fine <= tempo) a = m + 1; else b = m; }
    return seg[a];
  }
  // Il tempo (nella fila) in cui comincia il carattere `indice`.
  function storTempoDelCarattere(ritmo, indice) {
    for (const s of ritmo.segmenti) if (s.a > indice) return s.da >= indice ? s.inizio : s.inizio + (s.fine - s.inizio) * (indice - s.da) / Math.max(1, s.a - s.da);
    return ritmo.totale;
  }
  // Dove finisce la parola che comincia (o contiene) il carattere `indice`.
  function storFineParola(ritmo, indice) {
    for (const s of ritmo.segmenti) if (s.a > indice && s.tipo === 'pausa') return s.inizio;
    return ritmo.totale;
  }

  /* La forma della bocca in un istante della fila: dentro a una sillaba si
   * apre e si chiude (una mezza onda), nelle pause resta chiusa. */
  function storFormaAlTempo(ritmo, tempo) {
    const s = segmentoAl(ritmo, tempo);
    if (!s || s.tipo === 'pausa') return { forma: 'chiusa', apertura: 0, vocale: null };
    const f = (tempo - s.inizio) / Math.max(1e-6, s.fine - s.inizio);
    const apertura = Math.sin(Math.PI * Math.max(0, Math.min(1, f))) * s.forza;
    return { forma: formaDaApertura(apertura, s.vocale), apertura, vocale: s.vocale };
  }
  function formaDaApertura(apertura, vocale) {
    if (apertura < 0.1) return 'chiusa';
    if (apertura < 0.38) return 'piccola';
    return vocale === 'a' ? 'A' : vocale === 'o' ? 'O' : 'E';
  }

  /* Il segnale della voce (`narrazione.voce()`) → la forma della bocca.
   * Tre strade, nell'ordine:
   *   1. `livello` (ampiezza Web Audio): apre quanto la voce è forte; la
   *      vocale la dice il punto della frase (la posizione nel file);
   *   2. `confine` (TTS): il carattere a cui è arrivata la voce, più il tempo
   *      dall'ultimo confine, senza scavalcare la fine della parola;
   *   3. ritmo: il tempo dall'inizio (o la frazione già letta) sulla fila
   *      delle sillabe, scalato sul passo della voce.
   * Non parla → chiusa, subito. */
  function storBoccaDaSegnale(s, ritmo) {
    if (!s || !s.parla || s.pausa) return { forma: 'chiusa', apertura: 0, via: 'muta' };
    const r = ritmo || storRitmo(s.testo || '');
    const passo = 1 + (parseFloat(s.tono && s.tono.ritmo) || 0) / 100;
    let tempo = null, via = 'ritmo';
    if (s.confine && typeof s.confine.carattere === 'number') {
      const da = storTempoDelCarattere(r, s.confine.carattere);
      const fine = storFineParola(r, s.confine.carattere + Math.max(1, s.confine.lunghezza || 1));
      tempo = Math.min(Math.max(da, fine - 1e-3), da + Math.max(0, s.confine.da || 0) / 1000 * passo);
      via = 'confini';
    } else if (typeof s.progresso === 'number' && Number.isFinite(s.progresso)) {
      tempo = s.progresso * r.totale;
    } else if (typeof s.tempo === 'number' && Number.isFinite(s.tempo)) {
      tempo = s.tempo / 1000 * passo;
      // Una sintesi più lenta della stima: la fila ricomincia invece di
      // lasciare la bocca chiusa mentre la voce sta ancora parlando.
      if (r.totale > 0 && tempo >= r.totale) tempo = tempo % r.totale;
    }
    const alTempo = tempo === null ? { forma: 'piccola', apertura: 0.3, vocale: 'e' } : storFormaAlTempo(r, tempo);
    if (typeof s.livello === 'number' && Number.isFinite(s.livello)) {
      const apertura = Math.max(0, Math.min(1, (s.livello - 0.012) / 0.11));
      return { forma: formaDaApertura(apertura, alTempo.vocale || 'a'), apertura, via: 'ampiezza' };
    }
    return Object.assign({}, alTempo, { via });
  }

  // ===================================================================
  // 4. La geometria del volto (funzioni pure: la provano le prove)
  // ===================================================================

  const mix = (a, b, k) => a + (b - a) * k;
  function mescolaEspressione(a, b, k) {
    const ca = a.ciglio, cb = b.ciglio;
    const m = (campo, di) => mix(a[campo] === undefined ? di : a[campo], b[campo] === undefined ? di : b[campo], k);
    return {
      palpebraSu: mix(a.palpebraSu, b.palpebraSu, k), palpebraGiu: mix(a.palpebraGiu, b.palpebraGiu, k),
      pupilla: mix(a.pupilla, b.pupilla, k), curva: mix(a.curva, b.curva, k), guance: mix(a.guance, b.guance, k),
      spostaBocca: m('spostaBocca', 0),
      occhi: m('occhi', 1), iride: m('iride', 1), stelle: m('stelle', 0),
      testa: m('testa', 0), rimbalzo: m('rimbalzo', 0), tremito: m('tremito', 0),
      ciglio: { alza: mix(ca.alza, cb.alza, k), inclina: mix(ca.inclina, cb.inclina, k),
        curva: mix(ca.curva, cb.curva, k), asimmetria: mix(ca.asimmetria || 0, cb.asimmetria || 0, k) },
      bocca: k < 0.5 ? a.bocca : b.bocca,
      sguardo: k < 0.5 ? a.sguardo : b.sguardo,
      segno: k < 0.5 ? (a.segno || null) : (b.segno || null)
    };
  }
  function parametriEspressione(nome) {
    const e = STOR_ESPRESSIONI[nome] || STOR_ESPRESSIONI[STOR_ESPRESSIONE_DI_SERIE];
    return mescolaEspressione(e, e, 1);
  }
  function mescolaBocca(a, b, k) {
    return { larg: mix(a.larg, b.larg, k), aper: mix(a.aper, b.aper, k), tondo: mix(a.tondo, b.tondo, k),
      curva: mix(a.curva, b.curva, k), onda: mix(a.onda || 0, b.onda || 0, k) };
  }

  /* Lo sguardo verso un punto dello schermo, come vettore nel cerchio
   * unitario: direzione verso il punto, e quanto — tutto, per una cosa
   * lontana; poco, per una cosa addosso. `null` → lo spettatore (dritto). */
  function storSguardoVerso(cx, cy, R, punto) {
    if (!punto) return { x: 0, y: 0 };
    const dx = punto.x - cx, dy = punto.y - cy, d = Math.hypot(dx, dy);
    if (d < 1e-6) return { x: 0, y: 0 };
    const quanto = Math.max(0.45, Math.min(1, d / (R * 2.5)));
    return { x: dx / d * quanto, y: dy / d * quanto };
  }

  /* Il volto in un riquadro di raggio R centrato in (cx, cy). `st`:
   *   espr     i parametri dell'espressione (già mescolati)
   *   sguardo  {x, y} nel cerchio unitario
   *   battito  0 aperto … 1 chiuso
   *   bocca    {larg, aper, tondo, curva} (la forma del parlato o del riposo)
   * Restituisce le parti, e nient'altro: il disegno è in §6. */
  function storGeometria(cx, cy, R, profilo, st) {
    const o = profilo.occhi;
    const e = st.espr;
    const rx = o.r * R * Math.max(0.7, Math.min(1.3, e.occhi || 1)), ry = rx * 1.14;
    const g = st.sguardo || { x: 0, y: 0 };
    const gm = Math.hypot(g.x, g.y);
    const gx = gm > 1 ? g.x / gm : g.x, gy = gm > 1 ? g.y / gm : g.y;
    const iride = rx * Math.min(0.72, 0.6 * Math.max(0.6, e.iride || 1));
    const pupilla = Math.min(iride * 0.78, iride * 0.5 * Math.max(0.5, Math.min(1.4, e.pupilla)));
    // Quanto può correre l'iride senza uscire dall'occhio: l'ellisse è più
    // alta che larga, e il suo raggio più corto è rx.
    const corsa = Math.max(0, rx - iride - rx * 0.06);
    const battito = Math.max(0, Math.min(1, st.battito || 0));
    let su = Math.max(0, Math.min(1, e.palpebraSu)), giu = Math.max(0, Math.min(1, e.palpebraGiu));
    // Il battito porta giù la palpebra di sopra fino a toccare quella di
    // sotto (che sale appena): un occhio chiuso è una riga, non un buco.
    su = mix(su, 1 - giu * 0.4, battito);
    giu = mix(giu, giu * 0.4, battito);
    if (su + giu > 1) { const k = 1 / (su + giu); su *= k; giu *= k; }
    const occhi = [-1, 1].map(lato => {
      const ex = cx + lato * o.distanza * R, ey = cy + o.alto * R;
      const ix = ex + gx * corsa, iy = ey + gy * corsa;
      return {
        lato, cx: ex, cy: ey, rx, ry,
        iride: { x: ix, y: iy, r: iride },
        pupilla: { x: ix, y: iy, r: pupilla },
        luci: [
          { x: ix - iride * 0.33, y: iy - iride * 0.36, r: iride * 0.27 },
          { x: ix + iride * 0.32, y: iy + iride * 0.3, r: iride * 0.11 }
        ],
        // Le palpebre come quota del loro bordo
        bordoSu: ey - ry + 2 * ry * su,
        bordoGiu: ey + ry - 2 * ry * giu,
        chiusura: su + giu, giu
      };
    });
    const c = e.ciglio;
    const cigli = occhi.map(occ => {
      const asim = occ.lato < 0 ? (c.asimmetria || 0) : 0;
      const yBase = occ.cy - occ.ry - R * (0.09 + (c.alza + asim) * 0.24) - (st.alzaCigli || 0) * R * 0.07;
      // `inclina` > 0 alza l'estremo verso il naso: la faccia preoccupata
      const interno = occ.cx - occ.lato * occ.rx * 0.95, esterno = occ.cx + occ.lato * occ.rx * 1.12;
      const yInterno = yBase - c.inclina * R * 0.16, yEsterno = yBase + c.inclina * R * 0.07;
      return {
        lato: occ.lato,
        x1: interno, y1: yInterno, x2: esterno, y2: yEsterno,
        qx: (interno + esterno) / 2, qy: (yInterno + yEsterno) / 2 - c.curva * R * 0.15,
        spessore: Math.max(1.6, R * 0.07)
      };
    });
    const b = st.bocca;
    const bocca = {
      x: cx + (e.spostaBocca || 0) * R, y: cy + 0.4 * R,
      larg: b.larg * R, aper: b.aper * R, tondo: b.tondo, onda: b.onda || 0,
      // la curvatura dell'espressione resta anche parlando (si parla sorridendo)
      curva: Math.max(-1, Math.min(1, b.curva + e.curva * (b.aper > 0.04 ? 0.5 : 1)))
    };
    const guance = e.guance > 0.05 ? occhi.map(occ => ({ lato: occ.lato, x: occ.cx + occ.lato * occ.rx * 0.45, y: occ.cy + occ.ry * 1.5,
      rx: occ.rx * 0.8, ry: occ.rx * 0.46, alfa: Math.min(0.6, e.guance * 0.55), linee: e.guance > 0.6 })) : [];
    // Il nasino: una virgola d'inchiostro fra gli occhi e la bocca
    const naso = { x: cx + (e.spostaBocca || 0) * R * 0.4, y: cy + 0.2 * R, r: R * 0.045 };
    return { cx, cy, R, occhi, cigli, bocca, guance, naso, stelle: e.stelle || 0, segno: e.segno || null };
  }

  // La pupilla è dentro l'occhio? (la prova delle pupille contenute)
  function storPupillaDentro(occhio) {
    const p = occhio.pupilla;
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2;
      const x = p.x + Math.cos(a) * p.r - occhio.cx, y = p.y + Math.sin(a) * p.r - occhio.cy;
      if ((x * x) / (occhio.rx * occhio.rx) + (y * y) / (occhio.ry * occhio.ry) > 1 + 1e-9) return false;
    }
    return true;
  }

  // Il battito delle palpebre: quanto è chiuso l'occhio `dt` ms dopo l'inizio.
  function storChiusuraBattito(dt) {
    const B = STOR_BATTITO_MS;
    if (!(dt >= 0) || dt > B.chiude + B.tiene + B.apre) return 0;
    if (dt < B.chiude) { const u = dt / B.chiude; return u * u * (3 - 2 * u); }
    if (dt < B.chiude + B.tiene) return 1;
    const u = (dt - B.chiude - B.tiene) / B.apre;
    return 1 - u * u * (3 - 2 * u);
  }
  const STOR_BATTITO_DURATA = STOR_BATTITO_MS.chiude + STOR_BATTITO_MS.tiene + STOR_BATTITO_MS.apre;

  // Un generatore seminato: lo stesso personaggio batte le palpebre sempre
  // allo stesso ritmo, e due personaggi non le battono insieme.
  function seme(testo) { let h = 2166136261; for (let i = 0; i < testo.length; i++) { h ^= testo.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function dado(stato) { stato.s = (Math.imul(stato.s ^ (stato.s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return (stato.s >>> 8) / 16777216; }

  // ===================================================================
  // 5. Lo stato: chi c'è, chi parla, che ore sono nella storia
  // ===================================================================

  const stor = {
    personaggi: new Map(),     // id canonico → stato del personaggio
    parlante: null,            // { target, token } finché la sua voce è in corso
    voci: 0,                   // cresce a ogni character_speak: le promesse vecchie tacciono
    orologio: 0,               // ms della storia: fermo quando la demo è in pausa
    ultimoTic: 0,
    ricevute: new Map(),       // planetario: id → dove l'astro è stato disegnato, in questo fotogramma
    posti: new Map(),          // id → ultimo angolo del disco grafico (non salta di lato)
    ultimiDisegnati: [],       // per le prove: cosa si è disegnato l'ultima volta e dove
    anteprima: null,           // l'anteprima della pagina Demo, se è aperta
    ridotto: false
  };
  function movimentoRidotto() {
    try { return !!(radice.matchMedia && radice.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (_) { return false; }
  }
  function demoInPausa() { const d = radice.AstroDemo; return !!(d && d.stato === 'pausa'); }
  function adesso() { return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }

  // Il tempo della storia avanza solo quando la demo avanza.
  function storTic() {
    const ora = adesso();
    const dt = stor.ultimoTic ? Math.min(100, Math.max(0, ora - stor.ultimoTic)) : 0;
    stor.ultimoTic = ora;
    if (!demoInPausa()) stor.orologio += dt;
    stor.ridotto = movimentoRidotto();
    // Una demo finita (anche male) non lascia personaggi sul cielo: è la rete
    // sotto alle chiusure delle azioni, che di regola bastano da sole.
    const d = radice.AstroDemo;
    if (stor.personaggi.size && d && !d.inCorso && !stor.anteprima) storSgombra();
    return dt;
  }

  function nuovoStato(id, profilo, opz) {
    const r = { s: seme(id) || 1 };
    const espr = opz.espressione || profilo.espressione;
    return {
      id, profilo, nome: storNome(profilo),
      espressione: espr, espr: parametriEspressione(espr),
      guarda: opz.guarda || null,
      sguardo: { x: 0, y: 0 },
      bocca: Object.assign({}, STOR_BOCCHE.chiusa), apertura: 0, forma: 'chiusa',
      dado: r, fase: (seme(id) % 628) / 100, prossimoBattito: stor.orologio + 400 + dado(r) * 1800, battitoDa: -1e9,
      comparsoDa: stor.orologio, nascosto: false, congedo: 0, misura: opz.misura || 'auto',
      ultimoPunto: null, cambioDa: -1e9, segnoDa: stor.orologio, segno: null,
      saccade: { x: 0, y: 0 }, prossimaSaccade: stor.orologio + 600 + dado(r) * 1200
    };
  }

  // Compare (o resta, se c'era già: due scene di fila con lo stesso
  // personaggio non lo fanno rinascere, e il battito non riparte da capo).
  function storMostra(target, opz = {}) {
    const id = storCanonico(target);
    const profilo = storProfilo(id);
    let pg = stor.personaggi.get(id);
    if (!pg) { pg = nuovoStato(id, profilo, opz); stor.personaggi.set(id, pg); }
    else {
      pg.congedo = 0; pg.nascosto = false; pg.misura = opz.misura || 'auto';
      pg.guarda = opz.guarda || null;
      storEspressione(id, opz.espressione || profilo.espressione);
    }
    return pg;
  }
  function storEspressione(target, nome) {
    const pg = stor.personaggi.get(storCanonico(target));
    if (!pg || !STOR_ESPRESSIONI[nome]) return false;
    if (pg.espressione !== nome) pg.cambioDa = stor.orologio;
    pg.espressione = nome;
    if (stor.ridotto) pg.espr = parametriEspressione(nome);
    return true;
  }
  function storGuarda(target, oggetto) {
    const pg = stor.personaggi.get(storCanonico(target));
    if (!pg) return false;
    pg.guarda = !oggetto || oggetto === 'viewer' || oggetto === 'camera' ? null : storCanonico(oggetto);
    return true;
  }
  function storBatti(target) {
    const pg = stor.personaggi.get(storCanonico(target));
    if (!pg) return false;
    pg.battitoDa = stor.orologio;
    pg.prossimoBattito = stor.orologio + STOR_BATTITO_DURATA + 1500 + dado(pg.dado) * 2000;
    return true;
  }
  function storNascondi(target) {
    const pg = stor.personaggi.get(storCanonico(target));
    if (!pg) return false;
    pg.nascosto = true;
    if (stor.parlante && stor.parlante.target === pg.id) narrazioneFerma();
    return true;
  }
  // Il congedo di fine scena: se la scena dopo non lo rimostra **nello
  // stesso turno** (è così che il motore apre una scena dietro all'altra), il
  // personaggio se ne va. Un salto, uno Stop, un errore: stessa strada.
  let congedoInCoda = false;
  function storCongeda(target, token) {
    const pg = stor.personaggi.get(storCanonico(target));
    if (!pg || pg.token !== token) return;
    pg.congedo = token;
    if (!congedoInCoda) {
      congedoInCoda = true;
      Promise.resolve().then(() => {
        congedoInCoda = false;
        for (const [id, p] of stor.personaggi) if (p.congedo) stor.personaggi.delete(id);
        if (!stor.personaggi.size) { stor.parlante = null; stor.posti.clear(); stor.ultimiDisegnati = []; }
      });
    }
  }
  function storSgombra() {
    stor.personaggi.clear(); stor.parlante = null; stor.posti.clear(); stor.ricevute.clear();
    stor.ultimiDisegnati = [];
  }
  function narrazioneFerma() {
    const n = radice.narrazione;
    if (n && typeof n.ferma === 'function') n.ferma('demo');
    stor.parlante = null;
  }

  /* Fa parlare un personaggio con la voce di tutta l'app. Una sola voce alla
   * volta la garantisce `narrazione.parla`, che ferma qualunque frase prima
   * di cominciare; qui si tiene solo **chi** sta parlando, con un gettone:
   * la promessa di una frase interrotta non deve togliere la parola a quella
   * che le è subentrata. */
  function storParla(target, richiesta) {
    const id = storCanonico(target);
    const profilo = storProfilo(id);
    const token = ++stor.voci;
    stor.parlante = { target: id, token };
    const n = radice.narrazione;
    if (!n || typeof n.parla !== 'function') { stor.parlante = null; return { token, fine: Promise.resolve('vuota') }; }
    const fine = n.parla(Object.assign({
      canale: 'demo', personaggio: id, sottotitolo: 'sempre', testoSeSpenta: true,
      chi: { nome: storNome(profilo), colore: profilo.sottotitolo },
      tono: profilo.voce
    }, richiesta));
    // Una frase interrotta perché è cambiata la lingua riparte da capo con la
    // stessa richiesta (`narrCambioLingua`): il personaggio sta ancora
    // parlando, e la parola non gli si toglie.
    const libera = esito => {
      if (!stor.parlante || stor.parlante.token !== token) return;
      const v = typeof n.voce === 'function' ? n.voce() : null;
      const ancora = typeof n.stato === 'function' && n.stato();
      if (esito === 'interrotta' && ancora && v && v.personaggio === id) return;
      stor.parlante = null;
    };
    Promise.resolve(fine).then(libera, () => libera(''));
    return { token, fine };
  }

  // ===================================================================
  // 6. Il disegno
  // ===================================================================

  /* Lo stile: la **fiaba d'inchiostro**. Ogni tratto è un pennino indaco
   * scuro (non nero: il nero puro sopra a un cielo notturno buca la tela),
   * a spessore variabile — più grosso dove il tratto «appoggia», sottile
   * dove sfugge —, i colori sono stesure piatte con **un'ombra sola a taglio
   * netto**, come la cel animation, e dentro all'ombra c'è il **retino** dei
   * fumetti stampati: puntini che crescono verso il bordo. Sotto a ogni
   * tratto passa un alone color panna, che è quello che tiene leggibile un
   * occhio appoggiato sulla parte buia di una falce di Luna. Sono tre scelte
   * che un volto di cartone qualunque non fa insieme, e insieme fanno uno
   * stile riconoscibile: quello delle Storie cosmiche. */
  const INCHIOSTRO = '#1c1236';
  const ALONE = 'rgba(255, 248, 235, 0.62)';

  function rgba(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return `rgba(226,232,240,${a})`;
    const n = parseInt(m[1], 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function scurisci(hex, k) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#475569';
    const n = parseInt(m[1], 16);
    const c = v => Math.round(v * (1 - k)).toString(16).padStart(2, '0');
    return '#' + c(n >> 16) + c((n >> 8) & 255) + c(n & 255);
  }
  function schiarisci(hex, k) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#f8fafc';
    const n = parseInt(m[1], 16);
    const c = v => Math.round(v + (255 - v) * k).toString(16).padStart(2, '0');
    return '#' + c(n >> 16) + c((n >> 8) & 255) + c(n & 255);
  }

  /* Un tratto di pennino lungo una quadratica: largo `w0` all'attacco,
   * gonfio a metà, affilato alla fine. È la differenza fra un sopracciglio
   * di un'app e uno disegnato a mano. Restituisce il tracciato, chiuso. */
  function tracciaPennino(ctx, x1, y1, qx, qy, x2, y2, w, profilo) {
    const n = 12, sopra = [], sotto = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, v = 1 - u;
      const x = v * v * x1 + 2 * v * u * qx + u * u * x2, y = v * v * y1 + 2 * v * u * qy + u * u * y2;
      const tx = 2 * v * (qx - x1) + 2 * u * (x2 - qx), ty = 2 * v * (qy - y1) + 2 * u * (y2 - qy);
      const tl = Math.hypot(tx, ty) || 1;
      const larg = w * (profilo ? profilo(u) : 1) / 2;
      sopra.push([x - ty / tl * larg, y + tx / tl * larg]);
      sotto.push([x + ty / tl * larg, y - tx / tl * larg]);
    }
    ctx.beginPath();
    ctx.moveTo(sopra[0][0], sopra[0][1]);
    for (const [x, y] of sopra) ctx.lineTo(x, y);
    for (let i = sotto.length - 1; i >= 0; i--) ctx.lineTo(sotto[i][0], sotto[i][1]);
    ctx.closePath();
  }
  // Il profilo del sopracciglio: pieno verso il naso, affilato verso fuori
  const profiloCiglio = u => (0.55 + 0.75 * Math.sin(Math.PI * (0.12 + 0.62 * u))) * (1 - 0.72 * u * u);

  function stella(ctx, x, y, rEsterno, rInterno, punte, giro) {
    ctx.beginPath();
    for (let k = 0; k < punte * 2; k++) {
      const r = k % 2 ? rInterno : rEsterno, a = giro + k * Math.PI / punte;
      if (k) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function disegnaOcchio(ctx, occ, profilo, stelle, t) {
    const pelle = scurisci(profilo.pelle, 0.1);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(occ.cx, occ.cy, occ.rx, occ.ry, 0, 0, Math.PI * 2);
    // il bianco: lavanda in alto, dove la palpebra fa ombra, bianco al centro
    const bianco = ctx.createLinearGradient(occ.cx, occ.cy - occ.ry, occ.cx, occ.cy + occ.ry);
    bianco.addColorStop(0, '#d9dcf4'); bianco.addColorStop(0.38, '#ffffff'); bianco.addColorStop(1, '#eef1fb');
    ctx.fillStyle = bianco;
    ctx.fill();
    ctx.clip();
    if (occ.chiusura < 0.985) {
      const ir = occ.iride;
      const grad = ctx.createRadialGradient(ir.x, ir.y + ir.r * 0.35, ir.r * 0.1, ir.x, ir.y, ir.r);
      grad.addColorStop(0, schiarisci(profilo.iride, 0.55));
      grad.addColorStop(0.5, profilo.iride);
      grad.addColorStop(1, scurisci(profilo.iride, 0.5));
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(ir.x, ir.y, ir.r, 0, Math.PI * 2); ctx.fill();
      // i raggi dell'iride, a pennino: un'iride piatta è un bottone
      ctx.strokeStyle = rgba(scurisci(profilo.iride, 0.6), 0.32);
      ctx.lineWidth = Math.max(0.5, ir.r * 0.06);
      ctx.beginPath();
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2;
        ctx.moveTo(ir.x + Math.cos(a) * ir.r * 0.45, ir.y + Math.sin(a) * ir.r * 0.45);
        ctx.lineTo(ir.x + Math.cos(a) * ir.r * 0.86, ir.y + Math.sin(a) * ir.r * 0.86);
      }
      ctx.stroke();
      ctx.strokeStyle = scurisci(profilo.iride, 0.62);
      ctx.lineWidth = Math.max(0.8, ir.r * 0.13);
      ctx.beginPath(); ctx.arc(ir.x, ir.y, ir.r * 0.94, 0, Math.PI * 2); ctx.stroke();
      const pu = occ.pupilla;
      if (stelle > 0.5) {
        // l'entusiasmo: la pupilla è una stella dorata che pulsa
        const pulsa = 1 + 0.12 * Math.sin(t / 140);
        ctx.fillStyle = '#ffe066';
        stella(ctx, pu.x, pu.y, ir.r * 0.78 * pulsa, ir.r * 0.34 * pulsa, 5, -Math.PI / 2);
        ctx.fill();
        ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(0.7, ir.r * 0.08); ctx.stroke();
      } else {
        ctx.fillStyle = '#0d0820';
        ctx.beginPath(); ctx.arc(pu.x, pu.y, pu.r, 0, Math.PI * 2); ctx.fill();
      }
      // i riflessi: il grande tondo e il piccolo, più un bagliore a croce
      ctx.fillStyle = 'rgba(255,255,255,0.97)';
      for (const l of occ.luci) { ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); ctx.fill(); }
      const l0 = occ.luci[0];
      if (l0.r > 1.6) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        stella(ctx, l0.x + l0.r * 1.6, l0.y - l0.r * 0.2, l0.r * 0.7, l0.r * 0.16, 4, 0);
        ctx.fill();
      }
    }
    // L'ombra della palpebra sul bianco: è quella che dà profondità all'occhio
    const ombra = ctx.createLinearGradient(occ.cx, occ.bordoSu, occ.cx, occ.bordoSu + occ.ry * 0.5);
    ombra.addColorStop(0, 'rgba(28,18,54,0.28)'); ombra.addColorStop(1, 'rgba(28,18,54,0)');
    ctx.fillStyle = ombra;
    ctx.fillRect(occ.cx - occ.rx, occ.bordoSu, occ.rx * 2, occ.ry * 0.5);
    // Le palpebre: la pelle che scende dall'alto e sale dal basso. Quella di
    // sotto si incurva tanto più quanto più sale — gli occhi che sorridono
    // sono due mezzelune, ed è la palpebra di sotto a farle.
    ctx.fillStyle = pelle;
    const curvaP = occ.ry * 0.3;
    const curvaG = occ.ry * (0.15 + occ.giu * 1.1);
    ctx.beginPath();
    ctx.moveTo(occ.cx - occ.rx * 1.2, occ.cy - occ.ry * 1.2);
    ctx.lineTo(occ.cx + occ.rx * 1.2, occ.cy - occ.ry * 1.2);
    ctx.lineTo(occ.cx + occ.rx * 1.2, occ.bordoSu);
    ctx.quadraticCurveTo(occ.cx, occ.bordoSu + curvaP, occ.cx - occ.rx * 1.2, occ.bordoSu);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(occ.cx - occ.rx * 1.2, occ.cy + occ.ry * 1.2);
    ctx.lineTo(occ.cx + occ.rx * 1.2, occ.cy + occ.ry * 1.2);
    ctx.lineTo(occ.cx + occ.rx * 1.2, occ.bordoGiu);
    ctx.quadraticCurveTo(occ.cx, occ.bordoGiu - curvaG, occ.cx - occ.rx * 1.2, occ.bordoGiu);
    ctx.closePath(); ctx.fill();
    if (occ.giu > 0.18) {
      ctx.strokeStyle = rgba('#1c1236', 0.55);
      ctx.lineWidth = Math.max(0.8, occ.rx * 0.08);
      ctx.beginPath();
      ctx.moveTo(occ.cx - occ.rx * 1.2, occ.bordoGiu);
      ctx.quadraticCurveTo(occ.cx, occ.bordoGiu - curvaG, occ.cx + occ.rx * 1.2, occ.bordoGiu);
      ctx.stroke();
    }
    ctx.restore();
    // Il contorno a pennino: sottile sotto, grosso sopra, e la riga delle
    // ciglia sul bordo della palpebra con il colpo di coda verso l'esterno.
    ctx.save();
    ctx.strokeStyle = INCHIOSTRO;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.9, occ.rx * 0.09);
    ctx.beginPath(); ctx.ellipse(occ.cx, occ.cy, occ.rx, occ.ry, 0, 0, Math.PI); ctx.stroke();
    ctx.lineWidth = Math.max(1.3, occ.rx * 0.15);
    ctx.beginPath(); ctx.ellipse(occ.cx, occ.cy, occ.rx, occ.ry, 0, Math.PI, Math.PI * 2); ctx.stroke();
    const sopra = Math.max(occ.cy - occ.ry, Math.min(occ.cy + occ.ry, occ.bordoSu));
    const dy = sopra - occ.cy, k = Math.max(0, 1 - (dy * dy) / (occ.ry * occ.ry));
    const mezza = occ.rx * Math.sqrt(k);
    if (mezza > 0.5) {
      ctx.lineWidth = Math.max(1.5, occ.rx * 0.2);
      ctx.beginPath();
      ctx.moveTo(occ.cx - mezza, sopra);
      ctx.quadraticCurveTo(occ.cx, sopra + occ.ry * 0.3, occ.cx + mezza, sopra);
      ctx.stroke();
    }
    // Le ciglia: due colpi di pennino all'angolo esterno, sempre — anche a
    // occhio chiuso, dove sono loro a dire che quella riga è un occhio.
    const ex = occ.cx + occ.lato * Math.max(mezza, occ.rx * 0.82), ey = mezza > 0.5 ? sopra : occ.cy;
    ctx.fillStyle = INCHIOSTRO;
    for (const [lun, ang] of [[0.5, -0.55], [0.38, -0.05]]) {
      const a = occ.lato > 0 ? ang : Math.PI - ang;
      const x2 = ex + Math.cos(a) * occ.rx * lun, y2 = ey + Math.sin(a) * occ.rx * lun;
      tracciaPennino(ctx, ex, ey, (ex + x2) / 2, (ey + y2) / 2 - occ.rx * 0.06, x2, y2, Math.max(1.4, occ.rx * 0.16), u => 1 - u * 0.92);
      ctx.fill();
    }
    ctx.restore();
  }

  function disegnaBocca(ctx, b, R) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const spessore = Math.max(1.5, b.larg * 0.15);
    const angoli = b.y - b.curva * b.larg * 0.5;
    const fossette = () => {
      // le fossette agli angoli di un sorriso largo (o le pieghe del broncio)
      if (Math.abs(b.curva) < 0.45) return;
      const verso = b.curva > 0 ? -1 : 1;
      ctx.lineWidth = spessore * 0.8;
      ctx.beginPath();
      for (const lato of [-1, 1]) {
        const x = b.x + lato * b.larg, y = angoli;
        ctx.moveTo(x - lato * b.larg * 0.08, y + verso * b.larg * 0.14);
        ctx.quadraticCurveTo(x + lato * b.larg * 0.1, y, x + lato * b.larg * 0.04, y - verso * b.larg * 0.16);
      }
      ctx.stroke();
    };
    if (b.aper < Math.max(0.8, b.larg * 0.06)) {
      const riga = () => {
        ctx.beginPath();
        if (b.onda > 0.2) {
          // la bocca della paura: un'onda che trema
          const n = 16;
          for (let i = 0; i <= n; i++) {
            const u = i / n, x = b.x - b.larg + 2 * b.larg * u;
            const y = b.y - b.curva * b.larg * 0.5 * (1 - Math.pow(2 * u - 1, 2)) * -1 +
              Math.sin(u * Math.PI * 4) * b.larg * 0.12 * b.onda;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
        } else {
          ctx.moveTo(b.x - b.larg, angoli);
          ctx.quadraticCurveTo(b.x, b.y + b.curva * b.larg * 0.8, b.x + b.larg, angoli);
        }
      };
      ctx.strokeStyle = ALONE; ctx.lineWidth = spessore + 2.6; riga(); ctx.stroke();
      ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = spessore; riga(); ctx.stroke();
      fossette();
    } else {
      const traccia = () => {
        ctx.beginPath();
        if (b.tondo > 0.6) ctx.ellipse(b.x, b.y, b.larg, b.aper / 2, 0, 0, Math.PI * 2);
        else {
          const ang = b.y - b.curva * b.larg * 0.42;
          ctx.moveTo(b.x - b.larg, ang);
          ctx.quadraticCurveTo(b.x, b.y - b.aper * (0.55 - b.tondo * 0.3) + b.curva * b.larg * 0.28, b.x + b.larg, ang);
          ctx.quadraticCurveTo(b.x, b.y + b.aper * 1.25 + b.curva * b.larg * 0.5, b.x - b.larg, ang);
          ctx.closePath();
        }
      };
      traccia();
      ctx.strokeStyle = ALONE; ctx.lineWidth = spessore + 2.6; ctx.stroke();
      const fondo = ctx.createLinearGradient(b.x, b.y - b.aper, b.x, b.y + b.aper);
      fondo.addColorStop(0, '#2a0a20'); fondo.addColorStop(1, '#5c1430');
      ctx.fillStyle = fondo;
      ctx.fill();
      ctx.save(); ctx.clip();
      // la lingua, col suo riflesso, e i denti di sopra quando si apre bene
      ctx.fillStyle = '#f2577e';
      ctx.beginPath(); ctx.ellipse(b.x, b.y + b.aper * 0.7, b.larg * 0.6, b.aper * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255, 196, 214, 0.75)';
      ctx.beginPath(); ctx.ellipse(b.x - b.larg * 0.14, b.y + b.aper * 0.52, b.larg * 0.16, b.aper * 0.1, -0.3, 0, Math.PI * 2); ctx.fill();
      if (b.aper > b.larg * 0.42 && b.tondo < 0.6) {
        ctx.fillStyle = '#fffdf6';
        ctx.fillRect(b.x - b.larg, b.y - b.aper * 1.2, b.larg * 2, b.aper * 0.62 + Math.max(0, b.curva) * b.larg * 0.1);
      }
      ctx.restore();
      ctx.strokeStyle = INCHIOSTRO;
      ctx.lineWidth = spessore;
      traccia(); ctx.stroke();
      ctx.strokeStyle = INCHIOSTRO;
      fossette();
    }
    ctx.restore();
  }

  function storDisegnaVolto(ctx, geom, profilo, alfa, t) {
    ctx.save();
    ctx.globalAlpha *= alfa;
    ctx.lineCap = 'round';
    // Le guance: un rossore sfumato, e da contenti le tre lineette a pennino
    for (const g of geom.guance) {
      const r = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.rx);
      r.addColorStop(0, rgba(profilo.guance, g.alfa)); r.addColorStop(1, rgba(profilo.guance, 0));
      ctx.fillStyle = r;
      ctx.beginPath(); ctx.ellipse(g.x, g.y, g.rx, g.ry, 0, 0, Math.PI * 2); ctx.fill();
      if (g.linee) {
        ctx.strokeStyle = rgba(scurisci(profilo.guance, 0.35), 0.8);
        ctx.lineWidth = Math.max(0.9, g.rx * 0.1);
        ctx.beginPath();
        for (let k = -1; k <= 1; k++) {
          const x = g.x + k * g.rx * 0.38;
          ctx.moveTo(x + g.rx * 0.1, g.y - g.ry * 0.42); ctx.lineTo(x - g.rx * 0.1, g.y + g.ry * 0.42);
        }
        ctx.stroke();
      }
    }
    // Gli aloni color panna sotto ai tratti scuri
    for (const occ of geom.occhi) {
      ctx.strokeStyle = ALONE; ctx.lineWidth = Math.max(2.4, occ.rx * 0.36);
      ctx.beginPath(); ctx.ellipse(occ.cx, occ.cy, occ.rx, occ.ry, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (const c of geom.cigli) {
      tracciaPennino(ctx, c.x1, c.y1, c.qx, c.qy, c.x2, c.y2, c.spessore, profiloCiglio);
      ctx.strokeStyle = ALONE; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.stroke();
    }
    for (const occ of geom.occhi) disegnaOcchio(ctx, occ, profilo, geom.stelle, t);
    ctx.fillStyle = INCHIOSTRO;
    for (const c of geom.cigli) { tracciaPennino(ctx, c.x1, c.y1, c.qx, c.qy, c.x2, c.y2, c.spessore, profiloCiglio); ctx.fill(); }
    // il nasino
    const n = geom.naso;
    ctx.strokeStyle = rgba('#1c1236', 0.5); ctx.lineWidth = Math.max(0.9, n.r * 0.5);
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    disegnaBocca(ctx, geom.bocca, geom.R);
    ctx.restore();
  }

  // ===================================================================
  // 6-bis. I segni da fumetto
  // ===================================================================

  /* Il segno che accompagna un'espressione, come nei fumetti: le scintille
   * della gioia, i tre raggi della sorpresa, la lacrima che scende, la
   * goccia di sudore, le bolle del pensiero, le zeta del sonno. Le zeta sono
   * disegnate a tratti e non scritte: sono un segno, non una parola, e una
   * `fillText` qui sarebbe una scritta cablata sulla tela (I18N.md). Tutto
   * a pennino, e tutto animato sull'orologio della storia: in pausa si
   * fermano anche loro. `u` è quanto il segno è comparso (0…1). */
  function goccia(ctx, x, y, r) {
    // una goccia con la punta in su: il tondo centrato in (x, y)
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.8);
    ctx.quadraticCurveTo(x + r * 1.05, y - r * 0.55, x + r, y);
    ctx.arc(x, y, r, 0, Math.PI);
    ctx.quadraticCurveTo(x - r * 1.05, y - r * 0.55, x, y - r * 1.8);
    ctx.closePath();
  }
  function riempiAcqua(ctx, x, y, r) {
    const g = ctx.createLinearGradient(x, y - r, x, y + r * 1.5);
    g.addColorStop(0, '#e0f6ff'); g.addColorStop(1, '#3fb4f0');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(1, r * 0.22); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.05, r * 0.2, r * 0.32, -0.3, 0, Math.PI * 2); ctx.fill();
  }
  function storDisegnaSegno(ctx, geom, segno, t, u, ridotto) {
    if (!segno || u <= 0) return;
    const { cx, cy, R } = geom;
    const fermo = ridotto ? 0 : 1;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, u * 1.6);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pop = ridotto ? 1 : Math.min(1, u * 1.25) * (1 + 0.25 * Math.sin(Math.min(1, u) * Math.PI));
    if (segno === 'scintille') {
      [[-0.95, -0.85, 0], [1.02, -0.62, 1.9], [0.82, -1.08, 3.7]].forEach(([dx, dy, f]) => {
        const s = R * 0.13 * pop * (0.7 + 0.3 * Math.abs(Math.sin(t / 260 * fermo + f)));
        const x = cx + dx * R, y = cy + dy * R;
        stella(ctx, x, y, s, s * 0.32, 4, t / 900 * fermo + f);
        ctx.fillStyle = '#fff3b0'; ctx.fill();
        ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(0.9, s * 0.16); ctx.stroke();
      });
    } else if (segno === 'esclamazione') {
      const raggi = [[-0.62, 0.92, 1.22], [0, 0.98, 1.32], [0.62, 0.92, 1.22]];
      for (const passata of [0, 1]) {
        ctx.strokeStyle = passata ? INCHIOSTRO : ALONE;
        ctx.lineWidth = Math.max(1.6, R * 0.07) + (passata ? 0 : 2.6);
        ctx.beginPath();
        for (const [a0, r0, r1] of raggi) {
          const a = -Math.PI / 2 + a0 * 0.8;
          const vibra = 1 + 0.06 * Math.sin(t / 70 * fermo + a0 * 5);
          ctx.moveTo(cx + Math.cos(a) * R * r0, cy + Math.sin(a) * R * r0);
          ctx.lineTo(cx + Math.cos(a) * R * mix(r0, r1, pop) * vibra, cy + Math.sin(a) * R * mix(r0, r1, pop) * vibra);
        }
        ctx.stroke();
      }
    } else if (segno === 'lacrima') {
      const occ = geom.occhi[1];
      const ciclo = ridotto ? 0.3 : ((t / 1700) % 1);
      const r = Math.max(2, occ.rx * 0.24);
      // il velo d'acqua sul bordo della palpebra di sotto
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.9)'; ctx.lineWidth = Math.max(1.2, occ.rx * 0.12);
      ctx.beginPath(); ctx.ellipse(occ.cx, occ.cy, occ.rx * 0.92, occ.ry * 0.9, 0, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      const x = occ.cx + occ.rx * 0.7, y = occ.cy + occ.ry * 0.95 + ciclo * ciclo * R * 0.75;
      ctx.globalAlpha *= 1 - Math.pow(ciclo, 3);
      const rg = r * (0.6 + 0.4 * Math.min(1, ciclo * 4));
      goccia(ctx, x, y, rg);
      riempiAcqua(ctx, x, y, rg);
    } else if (segno === 'goccia') {
      const r = R * 0.11 * pop;
      const x = cx + R * 0.78, y = cy - R * 0.62 + Math.sin(t / 380 * fermo) * R * 0.03;
      goccia(ctx, x, y, r);
      riempiAcqua(ctx, x, y, r);
    } else if (segno === 'pensiero') {
      for (let k = 0; k < 3; k++) {
        const f = ridotto ? k / 3 : ((t / 2400 + k / 3) % 1);
        const x = cx + R * (0.75 + f * 0.45), y = cy - R * (0.75 + f * 0.65);
        const r = R * (0.05 + f * 0.11) * pop;
        ctx.globalAlpha = Math.min(1, u * 1.6) * (f < 0.15 ? f / 0.15 : f > 0.8 ? (1 - f) / 0.2 : 1);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#fbfaff'; ctx.fill();
        ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(0.9, r * 0.2); ctx.stroke();
      }
    } else if (segno === 'zzz') {
      for (let k = 0; k < 3; k++) {
        const f = ridotto ? k / 3 : ((t / 2600 + k / 3) % 1);
        const s = R * (0.08 + f * 0.1) * pop;
        const x = cx + R * (0.62 + f * 0.5) + Math.sin(f * 6) * R * 0.05, y = cy - R * (0.55 + f * 0.75);
        ctx.globalAlpha = Math.min(1, u * 1.6) * (f > 0.75 ? (1 - f) / 0.25 : Math.min(1, f * 5));
        const zeta = () => { ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.lineTo(x + s, y + s); };
        ctx.strokeStyle = ALONE; ctx.lineWidth = Math.max(1.3, s * 0.3) + 2.4; zeta(); ctx.stroke();
        ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(1.3, s * 0.3); zeta(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* L'adesivo: il disco grafico di un oggetto troppo piccolo per avere il
   * volto addosso, e il palco dell'anteprima. Un'ombra piatta spostata in
   * basso a destra (l'adesivo è *appoggiato* sul cielo), il bordo color
   * panna e il pennino attorno, la stesura piatta col taglio netto
   * dell'ombra e dentro all'ombra il retino a puntini. */
  function disegnaAdesivo(ctx, x, y, R, profilo) {
    const forma = () => {
      ctx.beginPath();
      if (profilo.forma === 'riquadro') {
        const L = R * 0.92, raggio = R * 0.34;
        ctx.moveTo(x - L + raggio, y - L);
        ctx.arcTo(x + L, y - L, x + L, y + L, raggio); ctx.arcTo(x + L, y + L, x - L, y + L, raggio);
        ctx.arcTo(x - L, y + L, x - L, y - L, raggio); ctx.arcTo(x - L, y - L, x + L, y - L, raggio);
        ctx.closePath();
      } else ctx.arc(x, y, R, 0, Math.PI * 2);
    };
    ctx.save();
    ctx.translate(R * 0.07, R * 0.1);
    forma(); ctx.fillStyle = 'rgba(12, 6, 30, 0.45)'; ctx.fill();
    ctx.restore();
    forma();
    ctx.strokeStyle = '#fff6e6'; ctx.lineWidth = Math.max(3, R * 0.16); ctx.stroke();
    ctx.fillStyle = scurisci(profilo.pelle, 0.3); ctx.fill();
    ctx.save(); ctx.clip();
    // la stesura chiara, spostata verso la luce: il resto è l'ombra
    ctx.fillStyle = profilo.pelle;
    ctx.beginPath(); ctx.arc(x - R * 0.2, y - R * 0.22, R * 1.02, 0, Math.PI * 2); ctx.fill();
    // il retino nell'ombra: puntini che crescono verso il bordo
    ctx.fillStyle = rgba(scurisci(profilo.pelle, 0.5), 0.55);
    const passo = Math.max(3, R * 0.15);
    ctx.beginPath();
    for (let py = y - R; py <= y + R; py += passo) {
      for (let px = x - R + ((Math.round((py - y) / passo) & 1) ? passo / 2 : 0); px <= x + R; px += passo) {
        const dentro = Math.hypot(px - (x - R * 0.2), py - (y - R * 0.22)) - R * 1.02;
        if (dentro < -passo * 0.3) continue;
        const r = Math.min(passo * 0.42, passo * (0.12 + Math.max(0, Math.hypot(px - x, py - y) / R - 0.55) * 0.6));
        ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    // il riflesso: una virgola bianca in alto a sinistra e un puntino
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(x - R * 0.5, y - R * 0.52, R * 0.17, R * 0.09, -0.75, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x - R * 0.24, y - R * 0.7, R * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    forma();
    ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(1.6, R * 0.055); ctx.stroke();
  }

  // Il disco grafico, col filo tratteggiato che lo lega all'astro vero: il
  // volto vive lì, e l'astro resta della sua misura vera.
  function disegnaSupporto(ctx, posto, profilo, alfa, t) {
    const { x, y, R, ax, ay, ar } = posto;
    ctx.save();
    ctx.globalAlpha *= alfa;
    const ang = Math.atan2(y - ay, x - ax);
    const anello = Math.max(ar + 3, 6) * (1 + 0.08 * Math.sin(t / 420));
    ctx.lineCap = 'round';
    for (const passata of [0, 1]) {
      ctx.strokeStyle = passata ? rgba(profilo.sottotitolo, 0.95) : 'rgba(12, 6, 30, 0.55)';
      ctx.lineWidth = passata ? 1.7 : 3.6;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(ax, ay, anello, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([2.5, 5]);
      ctx.lineDashOffset = -t / 60;
      ctx.beginPath();
      ctx.moveTo(ax + Math.cos(ang) * anello, ay + Math.sin(ang) * anello);
      ctx.lineTo(x - Math.cos(ang) * R * 1.08, y - Math.sin(ang) * R * 1.08);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Dove mettere il disco grafico: accanto all'astro, dentro lo schermo, non
  // sopra a un altro volto. L'angolo di prima vince finché va bene, così il
  // disco non salta da un lato all'altro mentre la camera si muove.
  const STOR_ANGOLI = [-45, -135, 45, 135, -90, 90, 0, 180].map(g => g * Math.PI / 180);
  function storPostoDisco(id, ax, ay, ar, R, L, H, presi, margini) {
    const m = Object.assign({ su: STOR_MARGINE_PX, giu: STOR_MARGINE_PX, lati: STOR_MARGINE_PX }, margini || {});
    const dist = ar + R + 16;
    const prova = (a, k) => {
      const x = ax + Math.cos(a) * dist * k, y = ay + Math.sin(a) * dist * k;
      if (x - R < m.lati || x + R > L - m.lati || y - R < m.su || y + R > H - m.giu) return null;
      for (const p of presi) if (Math.hypot(p.x - x, p.y - y) < p.R + R + 4) return null;
      return { x, y };
    };
    const prima = stor.posti.get(id);
    const ordine = prima !== undefined ? [prima, ...STOR_ANGOLI.filter(a => a !== prima)] : STOR_ANGOLI;
    for (const a of ordine) { const p = prova(a, 1); if (p) { stor.posti.set(id, a); return Object.assign(p, { angolo: a }); } }
    // Accanto non c'è posto: un po' più in là (il filo si allunga), e solo
    // alla fine dentro lo schermo comunque, anche sopra a un altro disco.
    for (const k of [1.8, 2.7, 3.8]) for (const a of ordine) {
      const p = prova(a, k); if (p) { stor.posti.set(id, a); return Object.assign(p, { angolo: a }); }
    }
    const a = ordine[0];
    const x = Math.max(m.lati + R, Math.min(L - m.lati - R, ax + Math.cos(a) * dist));
    const y = Math.max(m.su + R, Math.min(H - m.giu - R, ay + Math.sin(a) * dist));
    return { x, y, angolo: a };
  }

  /* La posa del volto in un istante: spostamento, rotazione e scala
   * attorno al suo centro. Sono le regole dell'animazione dei cartoni,
   * prese una per una: si compare con un «pop» che sfora e torna (una curva
   * elastica, non una dissolvenza), si respira, la contentezza saltella e la
   * paura trema, la tristezza e il pensiero piegano la testa, un cambio
   * d'espressione fa «boing» (schiaccia e allunga), e ogni sillaba allunga
   * appena la faccia in verticale. Col movimento ridotto non succede niente
   * di tutto questo. Funzione pura dello stato: la provano le prove. */
  function storPosa(pg, R, t, desDa, apertura, parla, ridotto) {
    const posa = { dx: 0, dy: 0, giro: 0, sx: 1, sy: 1 };
    if (ridotto) return posa;
    const e = pg.espr || {};
    const u = Math.max(0, Math.min(1, desDa / STOR_COMPARSA_MS));
    // fuori-indietro: 0 → oltre 1 → 1
    const c1 = 2.2, v = u - 1;
    const pop = u >= 1 ? 1 : Math.max(0, 1 + (c1 + 1) * v * v * v + c1 * v * v);
    const respiro = Math.sin(t / 950 + (pg.fase || 0)) * 0.014;
    posa.sx = pop * (1 - respiro * 0.5);
    posa.sy = pop * (1 + respiro);
    if (parla) { posa.sy += apertura * 0.07; posa.sx -= apertura * 0.035; posa.giro += Math.sin(t / 230 + (pg.fase || 0)) * 0.035 * apertura; }
    const w = (t - (pg.cambioDa || -1e9)) / STOR_BOING_MS;
    if (w >= 0 && w < 1) { const k = Math.sin(w * Math.PI * 2.5) * (1 - w) * 0.11; posa.sx += k; posa.sy -= k; }
    posa.dy -= Math.abs(Math.sin(t / 230 + (pg.fase || 0))) * R * 0.05 * (e.rimbalzo || 0);
    posa.dx += Math.sin(t * 0.11) * R * 0.014 * (e.tremito || 0);
    posa.giro += (e.testa || 0) + Math.sin(t / 1300 + (pg.fase || 0)) * 0.02;
    return posa;
  }

  /* Il disegno di tutti i personaggi su una tela, a partire da quello che il
   * renderer della vista ha già deciso: `corpi` è l'elenco di dove ogni
   * oggetto è finito (`id`, `px`, `py`, `r`, e `nascosto` quando il renderer
   * sa che è occultato). Chi è fuori schermo, nascosto o non disegnato non
   * ha volto. */
  function storDisegnaPersonaggi(ctx, vista, corpi, L, H, margini) {
    storTic();
    const disegnati = [];
    if (!stor.personaggi.size) { stor.ultimiDisegnati = disegnati; return disegnati; }
    const perId = new Map();
    for (const c of corpi) { const id = storCanonico(c.id); if (!perId.has(id)) perId.set(id, c); }
    const voce = radice.narrazione && typeof radice.narrazione.voce === 'function' ? radice.narrazione.voce() : null;
    const parlante = stor.parlante && voce && voce.personaggio === stor.parlante.target ? stor.parlante.target : null;
    const ritmi = storDisegnaPersonaggi.ritmi || (storDisegnaPersonaggi.ritmi = new Map());
    const presi = [];
    const dt = Math.max(0, stor.orologio - (stor.ultimoOrologio || stor.orologio));
    stor.ultimoOrologio = stor.orologio;
    const ridotto = stor.ridotto;
    // Il volto sta addosso o accanto? Si decide prima per tutti, così i dischi
    // grafici conoscono i volti già posati e non ci finiscono sopra.
    const piano = [];
    for (const pg of stor.personaggi.values()) {
      const c = perId.get(pg.id);
      pg.punto = null;
      if (!c || pg.nascosto || c.nascosto) continue;
      if (!(Number.isFinite(c.px) && Number.isFinite(c.py))) continue;
      if (c.px < 0 || c.py < 0 || c.px > L || c.py > H) continue;            // fuori schermo
      if (!(c.r >= STOR_ASTRO_MIN_PX)) continue;                             // troppo piccolo per indicarlo
      const p = pg.profilo;
      const Rdisco = c.r * p.scala;
      // Con un po' di isteresi: durante uno zoom il volto non deve saltare
      // avanti e indietro fra il disco e il disco grafico accanto.
      const soglia = STOR_VOLTO_MIN_PX * (pg.addossoPrima ? 0.88 : 1.1);
      const addosso = pg.misura === 'disk' || (pg.misura !== 'badge' && Rdisco >= soglia);
      pg.addossoPrima = addosso;
      pg.punto = { x: c.px, y: c.py };
      piano.push({ pg, c, addosso, Rdisco });
      if (addosso) presi.push({ x: c.px + p.dx * c.r, y: c.py + p.dy * c.r, R: Rdisco });
    }
    // Un disco grafico non deve coprire l'astro di un altro personaggio
    for (const { c } of piano) presi.push({ x: c.px, y: c.py, R: Math.max(8, c.r) });
    const Rbadge = Math.max(STOR_DISCO_MIN_PX, Math.min(STOR_DISCO_MAX_PX, Math.min(L, H) * 0.075));
    for (const posa of piano) {
      const { pg, c, addosso } = posa;
      const p = pg.profilo;
      let cx, cy, R, posto = null;
      if (addosso) { R = posa.Rdisco; cx = c.px + p.dx * c.r; cy = c.py + p.dy * c.r; }
      else {
        R = Rbadge;
        const s = storPostoDisco(pg.id, c.px, c.py, c.r, R, L, H, presi, margini);
        const ondeggia = ridotto ? 0 : Math.sin(stor.orologio / 1700 + pg.fase) * 1.2;
        cx = s.x; cy = s.y + ondeggia;
        presi.push({ x: cx, y: cy, R });
        posto = { x: cx, y: cy, R, ax: c.px, ay: c.py, ar: c.r };
      }
      // L'espressione scivola verso quella voluta; col movimento ridotto ci salta
      const voluta = parametriEspressione(pg.espressione);
      const kE = ridotto ? 1 : 1 - Math.exp(-dt / STOR_TAU_ESPRESSIONE);
      pg.espr = mescolaEspressione(pg.espr, voluta, kE);
      pg.espr.bocca = voluta.bocca; pg.espr.sguardo = voluta.sguardo; pg.espr.segno = voluta.segno;
      if (pg.segno !== (voluta.segno || null)) { pg.segno = voluta.segno || null; pg.segnoDa = stor.orologio; }
      // Lo sguardo: chi ascolta guarda chi parla; se no il suo bersaglio, poi
      // quello dell'espressione, poi lo spettatore.
      let verso = null;
      if (parlante && parlante !== pg.id) {
        const altro = stor.personaggi.get(parlante);
        if (altro && altro.punto) verso = storSguardoVerso(cx, cy, R, altro.punto);
      }
      if (!verso && pg.guarda) {
        const bersaglio = perId.get(pg.guarda);
        const altro = stor.personaggi.get(pg.guarda);
        const punto = bersaglio ? { x: bersaglio.px, y: bersaglio.py } : (altro && altro.punto) || null;
        if (punto) verso = storSguardoVerso(cx, cy, R, punto);
      }
      if (!verso) verso = pg.espr.sguardo ? { x: pg.espr.sguardo.x, y: pg.espr.sguardo.y } : { x: 0, y: 0 };
      // Le occhiate: un volto fermo che fissa sempre lo stesso punto è un
      // manichino. Ogni tanto lo sguardo scatta di poco e torna — più ampio
      // per chi non ha niente da guardare, appena accennato per chi ascolta.
      if (!ridotto) {
        if (stor.orologio >= pg.prossimaSaccade) {
          const a = dado(pg.dado) * Math.PI * 2, m = dado(pg.dado) < 0.35 ? 0 : 0.12 + dado(pg.dado) * 0.16;
          pg.saccade = { x: Math.cos(a) * m, y: Math.sin(a) * m * 0.7 };
          pg.prossimaSaccade = stor.orologio + STOR_SACCADI_MS[0] + dado(pg.dado) * (STOR_SACCADI_MS[1] - STOR_SACCADI_MS[0]);
        }
        const peso = parlante && parlante !== pg.id ? 0.4 : 1;
        verso = { x: verso.x + pg.saccade.x * peso, y: verso.y + pg.saccade.y * peso };
      }
      const kS = ridotto ? 1 : 1 - Math.exp(-dt / STOR_TAU_SGUARDO);
      pg.sguardo = { x: mix(pg.sguardo.x, verso.x, kS), y: mix(pg.sguardo.y, verso.y, kS) };
      // Il battito naturale (e quello chiesto da character_blink)
      if (stor.orologio >= pg.prossimoBattito) {
        pg.battitoDa = stor.orologio;
        const [a, b] = ridotto ? STOR_BATTITO_OGNI_RIDOTTO : STOR_BATTITO_OGNI;
        const doppio = !ridotto && dado(pg.dado) < 0.14;
        pg.prossimoBattito = stor.orologio + (doppio ? STOR_BATTITO_DURATA + 90 : a + dado(pg.dado) * (b - a));
      }
      const battito = storChiusuraBattito(stor.orologio - pg.battitoDa);
      // La bocca: si muove solo per chi parla, e si chiude subito.
      let forma;
      const staParlando = parlante === pg.id && voce && voce.parla;
      if (staParlando) {
        const chiave = voce.testo || '';
        let ritmo = ritmi.get(chiave);
        if (!ritmo) { ritmo = storRitmo(chiave); ritmi.clear(); ritmi.set(chiave, ritmo); }
        forma = storBoccaDaSegnale(voce, ritmo);
        if (ridotto) forma.apertura *= 0.7;
      } else forma = { forma: pg.espr.bocca, apertura: 0 };
      const meta = STOR_BOCCHE[forma.forma] || STOR_BOCCHE.chiusa;
      if (forma.apertura > 0) {
        const kB = 1 - Math.exp(-dt / STOR_TAU_BOCCA_APRE);
        pg.bocca = mescolaBocca(pg.bocca, meta, Math.max(kB, 0.35));
      } else pg.bocca = Object.assign({}, meta);  // chiusa subito
      pg.forma = forma.forma; pg.apertura = forma.apertura; pg.via = forma.via || '';
      // Sull'adesivo il volto sta un po' più dentro del bordo: un occhio che
      // tocca il contorno sembra uscire dal disco.
      const geom = storGeometria(cx, cy, posto ? R * 0.9 : R, p, {
        espr: pg.espr, sguardo: pg.sguardo, battito, bocca: pg.bocca,
        alzaCigli: staParlando && !ridotto ? forma.apertura : 0
      });
      const t = stor.orologio;
      const desDa = t - pg.comparsoDa;
      const alfa = ridotto ? Math.min(1, desDa / 320) : Math.min(1, desDa / (STOR_COMPARSA_MS * 0.35));
      // Il corpo del volto: comparsa elastica, respiro, rimbalzo, tremito,
      // testa inclinata, la «molla» di un cambio d'espressione e lo
      // schiacciamento delle sillabe. Si muovono i tratti (e l'adesivo), mai
      // l'astro: la Luna resta dov'è e com'è, il volto le vive sopra.
      const att = storPosa(pg, R, t, desDa, forma.apertura, staParlando, ridotto);
      ctx.save();
      ctx.translate(cx + att.dx, cy + att.dy);
      ctx.rotate(att.giro);
      ctx.scale(att.sx, att.sy);
      ctx.translate(-cx, -cy);
      if (posto) {
        ctx.restore();
        disegnaSupporto(ctx, posto, p, alfa, t);
        ctx.save();
        ctx.translate(cx + att.dx, cy + att.dy); ctx.rotate(att.giro); ctx.scale(att.sx, att.sy); ctx.translate(-cx, -cy);
        ctx.save(); ctx.globalAlpha *= alfa; disegnaAdesivo(ctx, cx, cy, R, p); ctx.restore();
      }
      storDisegnaVolto(ctx, geom, p, alfa, t);
      storDisegnaSegno(ctx, geom, pg.segno, t, Math.min(1, (t - pg.segnoDa) / 380) * alfa, ridotto);
      ctx.restore();
      disegnati.push({ id: pg.id, vista, x: cx, y: cy, R, addosso: !posto, forma: pg.forma, apertura: pg.apertura, via: pg.via,
        parla: parlante === pg.id && !!(voce && voce.parla), battito, sguardo: Object.assign({}, pg.sguardo),
        espressione: pg.espressione, astro: { x: c.px, y: c.py, r: c.r }, geom });
    }
    stor.ultimiDisegnati = disegnati;
    return disegnati;
  }

  // ===================================================================
  // 7. I ganci dei renderer
  // ===================================================================

  /* Planetario. `skyDisegnaAstro` e `corpiMinoriDisegna` lasciano qui la
   * ricevuta di ogni astro che hanno disegnato davvero (dopo i loro tagli di
   * bordo e di visibilità), con la sua posizione e il suo raggio. Senza
   * personaggi in scena si esce alla prima riga. */
  function storRicevuta(id, px, py, r, o) {
    if (!stor.personaggi.size) return;
    stor.ricevute.set(id, { id, px, py, r, az: o && o.az, alt: o && o.alt, tipo: o && o.tipo });
  }
  function storDisegnaCielo(ctx) {
    if (!stor.personaggi.size) { stor.ricevute.clear(); stor.ultimiDisegnati = []; return []; }
    const sky = globale('sky');
    const L = sky ? sky.larghezza : ctx.canvas.width, H = sky ? sky.altezza : ctx.canvas.height;
    const corpi = [];
    const luna = stor.ricevute.get('Moon');
    const orizzonte = globale('skyAltezzaOrizzonte');
    for (const c of stor.ricevute.values()) {
      let nascosto = false;
      if (typeof c.alt === 'number') {
        // sotto l'orizzonte, o dietro alla collina disegnata
        if (c.alt < 0) nascosto = true;
        else if (!(sky && sky.camera) && typeof orizzonte === 'function' && typeof c.az === 'number') {
          try { if (c.alt < orizzonte(c.az)) nascosto = true; } catch (_) { /* senza profilo, non copre */ }
        }
      }
      // La Luna sta davanti a tutto il cielo tranne le stazioni (e gli aerei)
      if (!nascosto && luna && c.id !== 'Moon' && c.tipo !== 'satellite' && Math.hypot(c.px - luna.px, c.py - luna.py) < luna.r * 0.95)
        nascosto = true;
      // Il Sole coperto da un'eclissi non mostra la faccia: lì c'è la Luna
      if (c.id === 'Sun' && sky && sky.eclisse && sky.eclisse.attiva && sky.eclisse.copertura > 0.55) nascosto = true;
      corpi.push(Object.assign({}, c, { nascosto }));
    }
    stor.ricevute.clear();
    const fasce = margini();
    return storDisegnaPersonaggi(ctx, 'cielo', corpi, L, H, fasce);
  }
  // Le fasce dello schermo dove un disco grafico non va: la bussola in cima e
  // la barra del tempo in fondo (lette dalle stesse misure del fumetto).
  function margini() {
    const f = globale('skyFasceCielo');
    try { if (typeof f === 'function') { const z = f(); if (z && Number.isFinite(z.alta)) return { su: z.alta + 6, giu: (z.bassa || 0) + 6 }; } }
    catch (_) { /* senza misure, i margini di serie */ }
    return { su: 64, giu: 96 };
  }

  /* Vista 3D. `solDisegna` (e `solDisegnaVicino` per il banco Terra e Luna)
   * passano qui i corpi che hanno appena proiettato, con la loro `vicinanza`:
   * chi ha davanti un disco più vicino che lo copre è occultato. */
  function storDisegnaSistema(ctx, scena) {
    if (!stor.personaggi.size) { stor.ultimiDisegnati = []; return []; }
    const sol = globale('sol');
    if (!sol) return [];
    const elenco = [];
    const metti = (id, px, py, r, vicinanza) => {
      if (!id || !Number.isFinite(px) || !Number.isFinite(py)) return;
      elenco.push({ id, px, py, r: Math.max(0, r || 0), vicinanza: Number.isFinite(vicinanza) ? vicinanza : 0 });
    };
    for (const p of (scena && scena.corpi) || []) {
      if (p && p.schermo) metti(p.id, p.schermo.px, p.schermo.py, p.rDisegno, p.schermo.vicinanza);
    }
    if (scena && scena.sole) metti('Sun', scena.sole.px, scena.sole.py, scena.sole.r, scena.sole.vicinanza);
    if (!sol.vicino && sol.lunaSchermo) metti('Moon', sol.lunaSchermo.px, sol.lunaSchermo.py, sol.lunaSchermo.r, sol.lunaSchermo.vicinanza);
    for (const l of sol.luneSchermo || []) metti(l.id, l.px, l.py, l.r, l.vicinanza);
    for (const s of sol.satSchermo || []) metti(s.id, s.px, s.py, s.r, s.vicinanza);
    for (const c of elenco) {
      c.nascosto = elenco.some(q => q !== c && q.vicinanza > c.vicinanza && q.r > c.r * 0.6 &&
        Math.hypot(q.px - c.px, q.py - c.py) < q.r - Math.min(c.r, q.r) * 0.25);
    }
    const giu = (sol.altaBarra || 0) + 54;
    return storDisegnaPersonaggi(ctx, sol.vicino ? 'vicino' : 'sistema', elenco, sol.L, sol.H, { su: 12, giu, lati: 64 });
  }

  // ===================================================================
  // 8. Le azioni del DSL
  // ===================================================================

  const ERR_RIPIEGHI = {
    personaggioIgnoto: 'Personaggio sconosciuto: {nome}',
    espressioneIgnota: 'Espressione sconosciuta: {nome} (ammesse: {elenco})',
    sguardoIgnoto: 'Non so dove guardare: {nome}',
    personaggioNonInScena: '{nome} deve comparire in questa scena con character_show',
    personaggioVista: 'I personaggi compaiono solo nel planetario e nella vista 3D',
    personaggioMisura: 'size vuole auto, disk o badge',
    parametroSconosciuto: 'Parametro sconosciuto: {nome}',
    narraVuota: 'character_speak vuole un id o un testo',
    narraLunga: 'Testo di narrazione troppo lungo (al massimo 400 caratteri)',
    narraId: 'Narrazione sconosciuta: {id}'
  };
  function errore(chiave, dati = {}) {
    const k = 'demo.err.' + chiave;
    const testo = haI18n() && radice.astroI18n.esiste(k) ? radice.astroI18n.t(k, dati)
      : (ERR_RIPIEGHI[chiave] || chiave).replace(/\{(\w+)\}/g, (m, x) => x in dati ? String(dati[x]) : m);
    return new Error(testo);
  }
  function richiedi(ok, chiave, dati) { if (!ok) throw errore(chiave, dati); }
  function campi(p, ammessi) {
    for (const k of Object.keys(p)) richiedi(ammessi.includes(k), 'parametroSconosciuto', { nome: k });
  }
  function bersaglio(p) {
    richiedi(typeof p.target === 'string' && p.target.trim(), 'personaggioIgnoto', { nome: String(p.target) });
    const id = storCanonico(p.target.trim());
    richiedi(storOggettoNoto(id), 'personaggioIgnoto', { nome: p.target });
    return id;
  }
  function espressione(nome) {
    richiedi(typeof nome === 'string' && Object.prototype.hasOwnProperty.call(STOR_ESPRESSIONI, nome), 'espressioneIgnota',
      { nome: String(nome), elenco: Object.keys(STOR_ESPRESSIONI).join(', ') });
    return nome;
  }
  const VISTE_PERSONAGGI = ['planetarium_view', 'solar_system_3d', 'transition'];
  function inScena(p, scena, comando) {
    if (!scena) return;
    richiedi(VISTE_PERSONAGGI.includes(scena.vista), 'personaggioVista');
    if (comando === 'character_show') return;
    const id = bersaglio(p);
    const c = scena.azioni.some(a => a.comando === 'character_show' && a.parametri &&
      typeof a.parametri.target === 'string' && storCanonico(a.parametri.target) === id);
    richiedi(c, 'personaggioNonInScena', { nome: p.target });
  }
  function guardaVerso(o) {
    if (o === undefined || o === 'viewer' || o === 'camera') return null;
    richiedi(typeof o === 'string' && storOggettoNoto(storCanonico(o)), 'sguardoIgnoto', { nome: String(o) });
    return storCanonico(o);
  }
  function statoDemo() { const d = radice.AstroDemo; return d ? d.stato : 'attivo'; }

  let gettoni = 0;
  const COMANDI = {
    character_show: {
      verifica(p, scena) {
        campi(p, ['target', 'expression', 'look', 'size']);
        bersaglio(p);
        if (p.expression !== undefined) espressione(p.expression);
        guardaVerso(p.look);
        richiedi(p.size === undefined || ['auto', 'disk', 'badge'].includes(p.size), 'personaggioMisura');
        inScena(p, scena, 'character_show');
      },
      crea(p) {
        // Una demo che comincia spegne l'anteprima della pagina: i volti di
        // una storia non si mescolano con quello di prova.
        if (stor.anteprima) storChiudiAnteprima();
        const pg = storMostra(p.target, { espressione: p.expression, guarda: guardaVerso(p.look), misura: p.size });
        const token = ++gettoni;
        pg.token = token;
        return { chiudi() { storCongeda(pg.id, token); } };
      }
    },
    character_expression: {
      verifica(p, scena) { campi(p, ['target', 'expression']); bersaglio(p); espressione(p.expression); inScena(p, scena); },
      crea(p) { storEspressione(p.target, p.expression); return {}; }
    },
    character_look_at: {
      verifica(p, scena) {
        campi(p, ['target', 'object']); bersaglio(p);
        richiedi(p.object !== undefined, 'sguardoIgnoto', { nome: '' });
        guardaVerso(p.object); inScena(p, scena);
      },
      crea(p) { storGuarda(p.target, p.object); return {}; }
    },
    character_blink: {
      verifica(p, scena) { campi(p, ['target']); bersaglio(p); inScena(p, scena); },
      crea(p) { storBatti(p.target); return {}; }
    },
    character_hide: {
      verifica(p, scena) { campi(p, ['target']); bersaglio(p); inScena(p, scena); },
      crea(p) { storNascondi(p.target); return {}; }
    },
    character_speak: {
      verifica(p, scena) {
        campi(p, ['target', 'id', 'text']);
        bersaglio(p);
        richiedi(typeof p.id === 'string' || typeof p.text === 'string', 'narraVuota');
        if (typeof p.text === 'string') richiedi(p.text.trim() && p.text.length <= 400, 'narraLunga');
        else richiedi(/^[\w.-]+$/.test(p.id) && (!haI18n() || radice.astroI18n.esiste(p.id)), 'narraId', { id: p.id });
        inScena(p, scena);
      },
      crea(p) {
        const sottotitoli = typeof document !== 'undefined' ? document.getElementById('demo-sottotitoli') : null;
        const { token, fine } = storParla(p.target, {
          id: p.id || '',
          testo: typeof p.text === 'string' ? p.text : undefined,
          ospite: sottotitoli ? () => sottotitoli : undefined
        });
        // Una scena che si apre in pausa parla in pausa
        if (statoDemo() === 'pausa' && radice.narrazione) radice.narrazione.pausa('demo');
        return {
          fineNarrazione: fine,
          chiudi() {
            if (stor.parlante && stor.parlante.token === token) stor.parlante = null;
            if (radice.narrazione) radice.narrazione.ferma('demo');
          }
        };
      }
    }
  };

  function registraComandi() {
    const d = radice.AstroDemo;
    if (!d || typeof d.registra !== 'function') return false;
    for (const [nome, comando] of Object.entries(COMANDI)) {
      try { d.registra(nome, comando); } catch (_) { /* già registrato */ }
    }
    return true;
  }

  // Avviare una storia è un gesto: è il momento giusto per chiedere al
  // browser l'ascolto dell'ampiezza della voce (vedi narrazione.js).
  if (typeof document !== 'undefined') {
    // Solo per le storie: una demo senza personaggi non ha bocche da muovere,
    // e non c'è ragione di portare la sua voce dentro al grafo audio.
    const conPersonaggi = el => {
      if (el.matches('[data-storia-avvia], [data-storia-prova]')) return true;
      const scelta = document.getElementById('demo-elenco');
      const d = scelta && storieDisponibili().find(x => x.chiave === scelta.value);
      const editor = document.getElementById('demo-editor');
      return !!d || !!(editor && /character_/.test(editor.value || ''));
    };
    document.addEventListener('click', e => {
      const tasto = e.target && e.target.closest && e.target.closest('#demo-avvia, [data-storia-avvia], [data-storia-prova]');
      if (tasto && conPersonaggi(tasto) && radice.narrazione && typeof radice.narrazione.preparaAnalisi === 'function')
        radice.narrazione.preparaAnalisi();
    }, true);
  }

  // ===================================================================
  // 9. L'anteprima della pagina Demo
  // ===================================================================

  /* Un piccolo palco nella sezione «Storie cosmiche»: un personaggio alla
   * volta, l'espressione da scegliere, «Fallo parlare». Non ha bisogno di
   * nessuna vista astronomica e funziona offline: è anche il posto in cui si
   * vede un volto da vicino prima di scriverne la storia. */
  function storAnteprima(tela, target, espressioneScelta) {
    const ctx = tela.getContext && tela.getContext('2d');
    if (!ctx) return null;
    storSgombra();
    stor.anteprima = { tela, ctx, target: storCanonico(target), raf: 0 };
    storMostra(target, { espressione: espressioneScelta || undefined, misura: 'disk' });
    const passo = () => {
      const a = stor.anteprima;
      if (!a || a.tela !== tela) return;
      if (radice.AstroDemo && radice.AstroDemo.inCorso) { storChiudiAnteprima(); return; }
      const dpr = Math.max(1, Math.min(2, radice.devicePixelRatio || 1));
      const w = tela.clientWidth || 300, h = tela.clientHeight || 180;
      if (tela.width !== Math.round(w * dpr)) { tela.width = Math.round(w * dpr); tela.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const p = storProfilo(a.target);
      const r = Math.min(w, h) * 0.36;
      // il palco: un cielo d'inchiostro con qualche stella, e l'astro come
      // adesivo — lo stesso del disco grafico, così l'anteprima è lo stile vero
      const fondo = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      fondo.addColorStop(0, '#2a1f55'); fondo.addColorStop(1, '#0d0a1f');
      ctx.fillStyle = fondo; ctx.fillRect(0, 0, w, h);
      const st = { s: 7 };
      for (let k = 0; k < 26; k++) {
        const x = dado(st) * w, y = dado(st) * h, q = 0.6 + dado(st) * 1.2;
        ctx.fillStyle = `rgba(255, 246, 220, ${0.35 + 0.4 * Math.abs(Math.sin(stor.orologio / 700 + k))})`;
        ctx.beginPath(); ctx.arc(x, y, q, 0, Math.PI * 2); ctx.fill();
      }
      disegnaAdesivo(ctx, w / 2, h / 2, r, Object.assign({}, p, { forma: 'disco' }));
      storDisegnaPersonaggi(ctx, 'anteprima', [{ id: a.target, px: w / 2, py: h / 2, r: r / p.scala * 0.92 }], w, h, { su: 0, giu: 0, lati: 0 });
      a.raf = radice.requestAnimationFrame(passo);
    };
    passo();
    return stor.anteprima;
  }
  function storChiudiAnteprima() {
    const a = stor.anteprima;
    if (!a) return;
    if (a.raf && radice.cancelAnimationFrame) radice.cancelAnimationFrame(a.raf);
    if (stor.parlante && radice.narrazione) radice.narrazione.ferma('storia-prova');
    stor.anteprima = null;
    storSgombra();
  }
  function storProvaVoce(target) {
    if (!stor.anteprima) return Promise.resolve('vuota');
    const id = storCanonico(target);
    const nome = storNome(id);
    return storParla(id, { canale: 'storia-prova', id: 'storie.prova.frase',
      testo: () => t('storie.prova.frase', { nome }) || nome, forza: true }).fine;
  }

  // ===================================================================
  // 9-bis. La sezione «Storie cosmiche» della pagina Demo
  // ===================================================================

  /* Le storie sono demo predefinite con `storia: true` (demo-predefiniti.js):
   * stanno anche nell'elenco generale, e qui hanno la loro scheda — titolo,
   * durata, personaggi con la loro personalità, «Guarda la storia» e
   * «Duplica e modifica». Sotto, l'anteprima di un personaggio e l'esempio
   * del DSL. Tutto si riscrive al cambio lingua. */
  function storieDisponibili() {
    const d = radice.AstroDemo;
    try { return d && d.libreria ? d.libreria.elenco().filter(x => x.storia) : []; } catch (_) { return []; }
  }
  function durataDi(testo) {
    try { return Math.round(radice.AstroDemoMotore.analizza(testo).scene.reduce((n, sc) => n + sc.durata, 0) / 1000); }
    catch (_) { return 0; }
  }
  function storRiempiPagina() {
    if (typeof document === 'undefined') return;
    const elenco = document.getElementById('storie-elenco');
    if (!elenco) return;
    elenco.textContent = '';
    for (const st of storieDisponibili()) {
      const scheda = document.createElement('article');
      scheda.className = 'storia-scheda';
      const titolo = document.createElement('h4');
      titolo.className = 'storia-titolo';
      titolo.textContent = t('demo.builtin.' + st.chiave + '.title') || st.chiave;
      const durata = document.createElement('span');
      durata.className = 'storia-durata';
      durata.textContent = t('storie.durata', { n: durataDi(st.testo) });
      const descr = document.createElement('p');
      descr.className = 'storia-descrizione';
      descr.textContent = t('demo.builtin.' + st.chiave + '.description');
      const cast = document.createElement('ul');
      cast.className = 'storia-cast';
      cast.setAttribute('aria-label', t('storie.cast', { nomi: '' }).replace(/[:\s]+$/, ''));
      for (const id of String(st.cast || '').split(',').map(x => x.trim()).filter(Boolean)) {
        const p = storProfilo(id);
        const li = document.createElement('li');
        const nome = document.createElement('strong');
        nome.textContent = storNome(p);
        nome.style.color = p.sottotitolo;
        li.append(nome, document.createTextNode(' — ' + storPersonalita(p)));
        cast.append(li);
      }
      const azioni = document.createElement('div');
      azioni.className = 'demo-azioni';
      const guarda = document.createElement('button');
      guarda.type = 'button'; guarda.className = 'demo-avvia-principale storia-avvia';
      guarda.dataset.storiaAvvia = st.chiave;
      guarda.textContent = t('storie.guarda');
      const duplica = document.createElement('button');
      duplica.type = 'button'; duplica.className = 'tasto-cielo';
      duplica.dataset.storiaDuplica = st.chiave;
      duplica.textContent = t('storie.duplica');
      azioni.append(guarda, duplica);
      const testa = document.createElement('div');
      testa.className = 'storia-testa';
      testa.append(titolo, durata);
      scheda.append(testa, descr, cast, azioni);
      elenco.append(scheda);
    }
    const codice = document.getElementById('storie-codice');
    const esempio = storieDisponibili().find(x => x.chiave === 'storia_giganti');
    if (codice && esempio) codice.textContent = esempio.testo;
    const scelta = document.getElementById('storie-personaggio');
    const espr = document.getElementById('storie-espressione');
    if (scelta) {
      const prima = scelta.value || 'Moon';
      scelta.textContent = '';
      for (const id of Object.keys(STOR_PERSONAGGI)) {
        const o = document.createElement('option'); o.value = id; o.textContent = storNome(id); scelta.append(o);
      }
      scelta.value = prima;
    }
    if (espr) {
      const prima = espr.value || '';
      espr.textContent = '';
      const di = document.createElement('option'); di.value = ''; di.textContent = '—'; espr.append(di);
      for (const k of Object.keys(STOR_ESPRESSIONI)) {
        const o = document.createElement('option'); o.value = k; o.textContent = t('storie.espressione.' + k) || k; espr.append(o);
      }
      espr.value = prima;
    }
  }
  function storCollegaPagina() {
    if (typeof document === 'undefined') return;
    const sezione = document.getElementById('storie-sezione');
    if (!sezione) return;
    storRiempiPagina();
    if (haI18n() && typeof radice.astroI18n.alCambio === 'function') radice.astroI18n.alCambio(storRiempiPagina);
    sezione.addEventListener('click', e => {
      const avvia = e.target.closest('[data-storia-avvia]');
      const duplica = e.target.closest('[data-storia-duplica]');
      const st = storieDisponibili().find(x => x.chiave === ((avvia || duplica) || {}).dataset?.[avvia ? 'storiaAvvia' : 'storiaDuplica']);
      if (avvia && st) {
        storChiudiAnteprima();
        try { radice.AstroDemo.avvia(st.testo); }
        catch (err) { const esito = document.getElementById('demo-esito'); if (esito) esito.textContent = err.message; }
      } else if (duplica && st) {
        const elenco = document.getElementById('demo-elenco');
        if (elenco) { elenco.value = st.chiave; elenco.dispatchEvent(new Event('change', { bubbles: true })); }
        const tasto = document.getElementById('demo-duplica');
        if (tasto) tasto.click();
        const editor = document.getElementById('demo-editor');
        if (editor && editor.scrollIntoView) editor.scrollIntoView({ block: 'center' });
      }
    });
    const tela = document.getElementById('storie-tela');
    const scelta = document.getElementById('storie-personaggio');
    const espr = document.getElementById('storie-espressione');
    const parla = document.getElementById('storie-parla');
    const visibile = () => {
      const vista = document.getElementById('vista-demo');
      return !!(tela && vista && !vista.classList.contains('hidden') && tela.offsetParent) &&
        !(radice.AstroDemo && radice.AstroDemo.inCorso);
    };
    const accendi = () => {
      if (!visibile()) { if (stor.anteprima) storChiudiAnteprima(); return; }
      if (!stor.anteprima || stor.anteprima.target !== storCanonico(scelta.value)) storAnteprima(tela, scelta.value, espr.value || undefined);
    };
    if (scelta) scelta.addEventListener('change', () => { storChiudiAnteprima(); accendi(); });
    if (espr) espr.addEventListener('change', () => {
      if (!stor.anteprima) accendi();
      const pg = stor.anteprima && stor.personaggi.get(stor.anteprima.target);
      storEspressione(scelta.value, espr.value || (pg ? pg.profilo.espressione : STOR_ESPRESSIONE_DI_SERIE));
    });
    if (parla) parla.addEventListener('click', () => { accendi(); storProvaVoce(scelta.value); });
    // L'anteprima gira solo mentre la si guarda: fuori dalla pagina Demo, o
    // con una demo in corso, si ferma (e non lascia volti sul cielo).
    if (typeof IntersectionObserver === 'function' && tela) {
      new IntersectionObserver(voci => {
        if (voci.some(v => v.isIntersecting)) accendi(); else storChiudiAnteprima();
      }).observe(tela);
    }
    const vista = document.getElementById('vista-demo');
    if (vista && typeof MutationObserver === 'function')
      new MutationObserver(() => accendi()).observe(vista, { attributes: true, attributeFilter: ['class'] });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', storCollegaPagina, { once: true });
    else storCollegaPagina();
  }

  // ===================================================================
  // 10. Fuori
  // ===================================================================

  const api = {
    STOR_ESPRESSIONI, STOR_BOCCHE, STOR_BOCCHE_PARLATO, STOR_FAMIGLIE, STOR_PERSONAGGI, STOR_BATTITO_DURATA,
    STOR_VOLTO_MIN_PX,
    canonico: storCanonico, famigliaDi: storFamigliaDi, noto: storOggettoNoto, profilo: storProfilo,
    nome: storNome, personalita: storPersonalita,
    ritmo: storRitmo, formaAlTempo: storFormaAlTempo, boccaDaSegnale: storBoccaDaSegnale,
    tempoDelCarattere: storTempoDelCarattere,
    geometria: storGeometria, posa: storPosa, pupillaDentro: storPupillaDentro, chiusuraBattito: storChiusuraBattito,
    sguardoVerso: storSguardoVerso, parametriEspressione,
    mostra: storMostra, espressione: storEspressione, guarda: storGuarda, batti: storBatti,
    nascondi: storNascondi, congeda: storCongeda, sgombra: storSgombra, parla: storParla,
    disegnaPersonaggi: storDisegnaPersonaggi, disegnaCielo: storDisegnaCielo, disegnaSistema: storDisegnaSistema,
    comandi: COMANDI, registraComandi,
    anteprima: storAnteprima, chiudiAnteprima: storChiudiAnteprima, provaVoce: storProvaVoce,
    riempiPagina: storRiempiPagina, storie: storieDisponibili,
    stato: stor,
    get attivi() { return stor.personaggi.size; },
    get disegnati() { return stor.ultimiDisegnati.map(d => Object.assign({}, d, { geom: undefined })); },
    get parlante() { return stor.parlante ? stor.parlante.target : null; }
  };
  radice.storRicevuta = storRicevuta;
  radice.storDisegnaCielo = storDisegnaCielo;
  radice.storDisegnaSistema = storDisegnaSistema;
  radice.StorieCosmiche = api;
  registraComandi();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
