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
 *   1. **Il cielo di partenza è vero.** Questo modulo non calcola nessuna
 *      posizione: i volti si appoggiano dove i renderer esistenti
 *      hanno appena disegnato l'astro — la ricevuta di `skyDisegnaAstro` e di
 *      `corpiMinoriDisegna` nel planetario, i corpi già proiettati da
 *      `solDisegna` e da `solDisegnaVicino` nella vista 3D. Niente seconda
 *      proiezione: se la Luna è una falce, il volto sta sulla falce; se
 *      Giove è un puntino, nel planetario Giove porta al suo posto il suo
 *      **corpo disegnato** (dalla v411: le bande, la barba; la Voyager la
 *      sua parabola, §6-quater), e solo se lì non c'entra va accanto,
 *      collegato da un filo. Nella vista 3D, dalla
 *      v409, il personaggio è l'astro stesso: cresce per portare il volto e,
 *      se la storia lo chiede, viaggia fuori dall'orbita (§5-bis) — sempre
 *      attraverso i ganci che l'app chiama **prima** di proiettare.
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
   * quasi dalla testa. Dalla v411 la palpebra non è più una stesura del
   * colore della pelle (sopra a un pianeta vero sembrava un paio d'occhiali):
   * l'occhio è soltanto l'apertura fra le due palpebre, e le manopole dicono
   * la sua forma. Oltre ai tratti ci sono le manopole del corpo:
   *   occhi        quanto si allargano gli occhi (1 = di serie)
   *   iride        quanto è grande l'iride (gli occhioni tristi)
   *   inclinaSu    la palpebra di sopra inclinata: > 0 scende verso il naso
   *                (la rabbia), < 0 scende verso fuori (la tristezza)
   *   arcoGiu      quanto la palpebra di sotto si inarca all'insù: gli occhi
   *                che sorridono sono due mezzelune, ed è lei a farle
   *   felici       a occhi chiusi, la riga è un arco all'insù (la risata)
   *                invece della palpebra abbassata (il sonno, il battito)
   *   lucidi       gli occhi bagnati: più riflessi e un velo d'acqua
   *   stelle       le pupille diventano stelle (l'entusiasmo)
   *   cuori        le pupille diventano cuori (l'amore)
   *   rosso        il viso si arrossa (la rabbia)
   *   testa        di quanto si inclina la testa, in radianti
   *   rimbalzo     il saltello della contentezza
   *   tremito      il tremolio della paura
   *   storta       la bocca di traverso (−1…1, > 0 alza l'angolo di destra):
   *                il ghigno del bullo, la smorfia di chi è infastidito
   *   segno        il «segno da fumetto» che accompagna il volto: scintille,
   *                esclamazione, lacrima, goccia, pensiero, zzz, rabbia,
   *                cuori, sbuffo, luccichio (§6-bis)
   *
   * Aggiungere un'espressione: una voce qui, e le due chiavi
   * `storie.espressione.<nome>` nei dizionari (le legge la pagina Demo). */
  const STOR_ESPRESSIONI = {
    // v425, «più chiare ed esagerate» (chi usa l'app, col disegno della Luna
    // sorridente come modello): ogni manopola spinta più in là, le
    // sopracciglia che si muovono davvero, la bocca che dice l'umore anche a
    // riposo. Il volto di riposo non è più una riga: è un piccolo sorriso.
    neutral: {
      palpebraSu: 0.06, palpebraGiu: 0.06, pupilla: 1.05, arcoGiu: 0.2,
      ciglio: { alza: 0.18, inclina: -0.05, curva: 0.4, asimmetria: 0 },
      bocca: 'chiusa', curva: 0.7, guance: 0.55, sguardo: null
    },
    happy: {
      palpebraSu: 0, palpebraGiu: 0.24, pupilla: 1.15, iride: 1.08, arcoGiu: 0.6,
      ciglio: { alza: 0.5, inclina: -0.2, curva: 0.9, asimmetria: 0 },
      bocca: 'sorriso', curva: 1, guance: 1.1, sguardo: null,
      rimbalzo: 1.3, segno: 'scintille'
    },
    laughing: {
      palpebraSu: 0.55, palpebraGiu: 0.55, pupilla: 1, arcoGiu: 1, felici: 1,
      ciglio: { alza: 0.7, inclina: -0.3, curva: 1, asimmetria: 0 },
      bocca: 'risata', curva: 1, guance: 1.3, sguardo: null,
      testa: -0.16, rimbalzo: 2.8, segno: 'scintille'
    },
    surprised: {
      palpebraSu: 0, palpebraGiu: 0, pupilla: 0.36, occhi: 1.4, iride: 0.72,
      ciglio: { alza: 1.2, inclina: 0.15, curva: 1, asimmetria: 0 },
      bocca: 'O', curva: 0, guance: 0.35, sguardo: null,
      segno: 'esclamazione'
    },
    worried: {
      palpebraSu: 0.04, palpebraGiu: 0.04, pupilla: 0.6, occhi: 1.15, inclinaSu: -0.5,
      ciglio: { alza: 0.55, inclina: 1.7, curva: -0.1, asimmetria: 0 },
      bocca: 'ondulata', curva: -0.5, guance: 0.2, sguardo: { x: -0.35, y: 0.1 },
      tremito: 1.3, segno: 'goccia'
    },
    sad: {
      palpebraSu: 0.38, palpebraGiu: 0.1, pupilla: 1.4, iride: 1.25, inclinaSu: -1.2, lucidi: 1,
      ciglio: { alza: 0.2, inclina: 1.8, curva: -0.15, asimmetria: 0 },
      bocca: 'triste', curva: -1, guance: 0.15, sguardo: { x: 0, y: 0.6 },
      testa: 0.2, segno: 'lacrima'
    },
    thinking: {
      palpebraSu: 0.3, palpebraGiu: 0.16, pupilla: 1, inclinaSu: 0.2,
      ciglio: { alza: 0.15, inclina: -0.4, curva: 0.3, asimmetria: 1 },
      bocca: 'chiusa', curva: -0.2, storta: 0.5, spostaBocca: 0.28, guance: 0.2, sguardo: { x: 0.85, y: -0.75 },
      testa: -0.2, segno: 'pensiero'
    },
    excited: {
      palpebraSu: 0, palpebraGiu: 0.1, pupilla: 1.25, occhi: 1.28, iride: 1.15, stelle: 1, arcoGiu: 0.45,
      ciglio: { alza: 0.95, inclina: -0.2, curva: 1, asimmetria: 0 },
      bocca: 'grande', curva: 1, guance: 1.1, sguardo: null,
      rimbalzo: 2.3, segno: 'scintille'
    },
    love: {
      palpebraSu: 0.04, palpebraGiu: 0.18, pupilla: 1.2, iride: 1.15, cuori: 1, arcoGiu: 0.55,
      ciglio: { alza: 0.55, inclina: -0.1, curva: 0.85, asimmetria: 0 },
      bocca: 'sorriso', curva: 0.9, guance: 1.5, sguardo: null,
      testa: -0.16, rimbalzo: 0.8, segno: 'cuori'
    },
    angry: {
      palpebraSu: 0.32, palpebraGiu: 0.22, pupilla: 0.62, inclinaSu: 1.45, rosso: 1,
      ciglio: { alza: -0.25, inclina: -2.1, curva: -0.25, asimmetria: 0 },
      bocca: 'denti', curva: -0.7, guance: 0.15, sguardo: null,
      tremito: 1, segno: 'rabbia'
    },
    sleepy: {
      palpebraSu: 0.76, palpebraGiu: 0.12, pupilla: 1, inclinaSu: -0.4,
      ciglio: { alza: -0.08, inclina: 0.35, curva: 0.1, asimmetria: 0 },
      bocca: 'piccola', curva: 0, guance: 0.5, sguardo: { x: 0, y: 0.4 },
      testa: 0.18, segno: 'zzz'
    },
    // v422, chiesta da chi usa l'app: la faccia infastidita. Non è la
    // rabbia (niente denti, niente rossore): palpebre pesanti e piatte,
    // l'occhiata di traverso, la bocca storta da una parte e lo sbuffo
    annoyed: {
      palpebraSu: 0.56, palpebraGiu: 0.14, pupilla: 0.8, inclinaSu: 0.15, arcoGiu: 0.05,
      ciglio: { alza: -0.1, inclina: -0.75, curva: -0.1, asimmetria: 0.45 },
      bocca: 'chiusa', curva: -0.55, storta: -0.85, spostaBocca: -0.16, guance: 0.1, sguardo: { x: 0.9, y: -0.15 },
      testa: 0.14, segno: 'sbuffo'
    },
    // v422, la faccia da bullo: lo sguardo dall'alto in basso (testa
    // indietro, palpebre a mezz'asta), un sopracciglio su e uno giù, il
    // ghigno storto coi denti e il luccichio sul dente, come nei cartoni
    bully: {
      palpebraSu: 0.4, palpebraGiu: 0.3, pupilla: 0.75, inclinaSu: 0.55, arcoGiu: 0.4,
      ciglio: { alza: 0, inclina: -0.95, curva: 0.1, asimmetria: 0.75 },
      bocca: 'ghigno', curva: 0.6, storta: 1, spostaBocca: 0.12, guance: 0.2, sguardo: { x: 0, y: 0.3 },
      testa: -0.14, segno: 'luccichio'
    }
  };
  const STOR_ESPRESSIONE_DI_SERIE = 'neutral';

  /* Le forme della bocca, nelle unità del volto: `larg` è la mezza
   * larghezza, `aper` l'altezza dell'apertura, `tondo` quanto somiglia a un
   * cerchio (la O), `curva` la curvatura propria (il sorriso e il broncio la
   * hanno anche da chiusi), `onda` la bocca tremolante della paura, `denti`
   * i denti stretti della rabbia (e, all'insù, il ghigno del bullo). Le prime cinque sono quelle del parlato. */
  const STOR_BOCCHE = {
    chiusa:   { larg: 0.17, aper: 0,    tondo: 0,    curva: 0,     onda: 0 },
    // v426: le sillabe più grandi, alla misura delle bocche delle
    // espressioni: prima chi parlava aveva la bocca più piccola di chi taceva
    piccola:  { larg: 0.12, aper: 0.11, tondo: 0.7,  curva: 0,     onda: 0 },
    A:        { larg: 0.2,  aper: 0.34, tondo: 0.25, curva: 0,     onda: 0 },
    E:        { larg: 0.26, aper: 0.17, tondo: 0,    curva: 0.12,  onda: 0 },
    O:        { larg: 0.15, aper: 0.34, tondo: 1,    curva: 0,     onda: 0 },
    sorriso:  { larg: 0.3,  aper: 0.16, tondo: 0,    curva: 0.85,  onda: 0 },
    grande:   { larg: 0.33, aper: 0.32, tondo: 0,    curva: 0.8,   onda: 0 },
    risata:   { larg: 0.34, aper: 0.38, tondo: 0,    curva: 0.9,   onda: 0 },
    // v426: la tristezza è una bocca aperta all'ingiù, col labbro che trema
    triste:   { larg: 0.22, aper: 0.19, tondo: 0,    curva: -0.85, onda: 0.35 },
    ondulata: { larg: 0.22, aper: 0,    tondo: 0,    curva: -0.15, onda: 1 },
    denti:    { larg: 0.27, aper: 0.2,  tondo: 0,    curva: -0.25, onda: 0, denti: 1 },
    ghigno:   { larg: 0.27, aper: 0.16, tondo: 0,    curva: 0.45,  onda: 0, denti: 1 }
  };
  const STOR_BOCCHE_PARLATO = ['chiusa', 'piccola', 'A', 'E', 'O'];

  /* Le famiglie: quello che un personaggio eredita se non dice altro. Un
   * oggetto che l'app conosce ma che nessuna voce di `STOR_PERSONAGGI`
   * nomina (una luna di Urano, un asteroide, la sesta stella dell'elenco)
   * parla lo stesso, con la faccia e il corpo della sua famiglia.
   *
   * `sagoma` è il **corpo** del personaggio quando l'astro vero è troppo
   * piccolo per portare il volto (§6-quater): una sonda è una sonda, con la
   * sua parabola, e non un pianeta con la faccia; un asteroide è un sasso a
   * patata, una cometa ha la sua chioma e la sua coda. `genere` (`f`, `m`)
   * decide i tratti: ciglia lunghe, sopracciglia sottili e labbra per lei,
   * sopracciglia folte (e, a chi le ha, baffi e barba) per lui. */
  const STOR_FAMIGLIE = {
    stella:   { pelle: '#fde68a', iride: '#f59e0b', sottotitolo: '#fde68a', guance: '#fb923c', genere: 'f', sagoma: 'stella',
      scala: 0.8, voce: { ritmo: '-2%', tono: '2Hz' }, espressione: 'happy', personalita: 'stella' },
    pianeta:  { pelle: '#cbd5e1', iride: '#3b82f6', sottotitolo: '#e2e8f0', guance: '#f9a8d4', genere: 'm', sagoma: 'pianeta',
      scala: 0.78, voce: { ritmo: '0%', tono: '0Hz' }, espressione: 'neutral', personalita: 'pianeta' },
    luna:     { pelle: '#e2e8f0', iride: '#64748b', sottotitolo: '#e2e8f0', guance: '#fbcfe8', genere: 'f', sagoma: 'luna',
      scala: 0.8, voce: { ritmo: '4%', tono: '10Hz' }, espressione: 'neutral', personalita: 'luna' },
    nano:     { pelle: '#e3d3bd', iride: '#7c3aed', sottotitolo: '#ddd6fe', guance: '#fbcfe8', genere: 'm', sagoma: 'luna',
      scala: 0.8, voce: { ritmo: '6%', tono: '14Hz' }, espressione: 'happy', personalita: 'nano' },
    asteroide:{ pelle: '#b8aa98', iride: '#b45309', sottotitolo: '#fcd34d', guance: '#fdba74', genere: 'm', sagoma: 'asteroide',
      scala: 0.8, voce: { ritmo: '8%', tono: '18Hz' }, espressione: 'happy', personalita: 'asteroide' },
    cometa:   { pelle: '#cdeef0', iride: '#0d9488', sottotitolo: '#a7f3d0', guance: '#99f6e4', genere: 'f', sagoma: 'cometa',
      scala: 0.8, voce: { ritmo: '10%', tono: '12Hz' }, espressione: 'surprised', personalita: 'cometa' },
    stazione: { pelle: '#e8edf3', iride: '#2563eb', sottotitolo: '#93c5fd', guance: '#bae6fd', genere: 'f', sagoma: 'iss',
      scala: 0.8, voce: { ritmo: '6%', tono: '4Hz' }, espressione: 'happy', personalita: 'stazione' },
    sonda:    { pelle: '#f4efe2', iride: '#a16207', sottotitolo: '#fcd34d', guance: '#fed7aa', genere: 'f', sagoma: 'voyager',
      scala: 0.8, voce: { ritmo: '-4%', tono: '-4Hz' }, espressione: 'thinking', personalita: 'sonda' },
    // Le galassie (v412): vivono soltanto nella scala cosmica, al loro posto
    // sulla carta (`cosmo`, il luogo di scala-cosmica.js)
    galassia: { pelle: '#fbefd0', iride: '#7c3aed', sottotitolo: '#e9d5ff', guance: '#f9a8d4', genere: 'f', sagoma: 'galassia',
      braccia: '#a5b4fc', scala: 0.8, voce: { ritmo: '-10%', tono: '-6Hz' }, espressione: 'happy', personalita: 'galassia' },
    // I buchi (v414): il buco nero, col disco di gas che gli gira attorno, e
    // il suo contrario. La pelle è un viola quasi nero e non nero puro: i
    // tratti d'inchiostro hanno l'alone color panna, e così si leggono.
    buco:     { pelle: '#2a1c4a', iride: '#f97316', sottotitolo: '#fdba74', guance: '#fb7185', genere: 'm', sagoma: 'buco_nero',
      disco: '#fb923c', scala: 0.8, voce: { ritmo: '-14%', tono: '-18Hz' }, espressione: 'thinking', personalita: 'buco' }
  };

  /* I personaggi con un carattere loro. Ogni campo è facoltativo e vince su
   * quello della famiglia:
   *
   *   famiglia      una chiave di STOR_FAMIGLIE
   *   nome          chiave del dizionario del nome (di serie il nome che l'app
   *                 dà già a quell'oggetto: `corpo.<id>`, SOL_LUNE, …)
   *   pelle         il colore del corpo disegnato (e del disco grafico)
   *   iride         il colore degli occhi
   *   sottotitolo   il colore del nome nel sottotitolo
   *   guance        il colore del rossore (happy)
   *   genere        'f' o 'm': i tratti di lei o di lui
   *   sagoma        il corpo quando l'astro vero è troppo piccolo (§6-quater):
   *                 stella, pianeta, luna, anelli, asteroide, cometa,
   *                 voyager, iss, tiangong, hubble, galassia, gigante_rossa,
   *                 nana_bianca, supernova, buco_nero, buco_bianco
   *   cosmo         il luogo della scala cosmica in cui vive, e solo lì
   *                 (`idea`: in nessun posto della carta, v414)
   *   luogo         il suo luogo nella scala cosmica, per chi vive anche
   *                 altrove (Betelgeuse, che è una stella del planetario)
   *   decoro        il disegno sul corpo di un pianeta: bande, macchia,
   *                 continenti, calotta, nubi, crateri, cuore (Plutone),
   *                 sale (Cerere), macchia_scura (Haumea)
   *   baffi         'manubrio', 'folti', 'spioventi' (solo lui)
   *   barba         'folta', 'onde', 'pizzetto', 'ispida' (solo lui)
   *   peli          il colore di baffi, barba e sopracciglia folte
   *   labbra        il colore delle labbra (solo lei; di serie dalla pelle)
   *   trucco        l'ombretto sopra agli occhi (solo lei)
   *   scala         quanto del disco occupa il volto (0–0,95 del raggio)
   *   dx, dy        dove sta il volto rispetto al centro (in raggi)
   *   occhi         { r, distanza, alto } in frazioni del volto
   *   voce          { ritmo, tono } per la sintesi (vedi narrazione.js)
   *   espressione   quella di partenza
   *   personalita   chiave `storie.personalita.<…>` (detta nella pagina Demo)
   *   alias         gli altri nomi con cui l'app lo chiama in un'altra vista
   *
   * Il genere segue il nome italiano e il mito: la Luna, la Terra, Venere
   * sono lei; Marte, Giove, Saturno sono lui. Aggiungere un personaggio è
   * aggiungere una riga qui (e il suo nome nei dizionari se l'app non ne ha
   * già uno). */
  const STOR_PERSONAGGI = {
    Sun:      { famiglia: 'stella', genere: 'm', pelle: '#fcd34d', iride: '#c2410c', sottotitolo: '#fde047', guance: '#fb923c',
      baffi: 'folti', peli: '#ea580c',
      scala: 0.72, voce: { ritmo: '-8%', tono: '-10Hz' }, espressione: 'happy', personalita: 'Sun' },
    Mercury:  { famiglia: 'pianeta', genere: 'm', pelle: '#c9c2bb', iride: '#78716c', sottotitolo: '#e7e5e4', decoro: 'crateri',
      voce: { ritmo: '14%', tono: '16Hz' }, espressione: 'happy', personalita: 'Mercury' },
    Venus:    { famiglia: 'pianeta', genere: 'f', pelle: '#fde68a', iride: '#d97706', sottotitolo: '#fef08a', decoro: 'nubi',
      labbra: '#e11d48', trucco: '#c084fc',
      voce: { ritmo: '-2%', tono: '12Hz' }, espressione: 'happy', personalita: 'Venus' },
    Earth:    { famiglia: 'pianeta', genere: 'f', pelle: '#7dd3fc', iride: '#15803d', sottotitolo: '#7dd3fc', guance: '#fda4af',
      decoro: 'continenti', labbra: '#e85d75',
      voce: { ritmo: '-3%', tono: '0Hz' }, espressione: 'happy', personalita: 'Earth' },
    Moon:     { famiglia: 'luna', genere: 'f', pelle: '#e2e8f0', iride: '#6366f1', sottotitolo: '#c7d2fe', guance: '#f9a8d4',
      labbra: '#db6a8f',
      voce: { ritmo: '2%', tono: '18Hz' }, espressione: 'neutral', personalita: 'Moon',
      occhi: { r: 0.345, distanza: 0.43, alto: -0.06 } },
    Mars:     { famiglia: 'pianeta', genere: 'm', pelle: '#f0907a', iride: '#b91c1c', sottotitolo: '#fca5a5', decoro: 'calotta',
      barba: 'pizzetto', peli: '#6b1d14',
      voce: { ritmo: '8%', tono: '6Hz' }, espressione: 'happy', personalita: 'Mars' },
    Jupiter:  { famiglia: 'pianeta', genere: 'm', pelle: '#f3d2a6', iride: '#9a3412', sottotitolo: '#fdba74', decoro: 'bande',
      baffi: 'folti', barba: 'folta', peli: '#fbf3e4',
      scala: 0.7, voce: { ritmo: '-10%', tono: '-14Hz' }, espressione: 'happy', personalita: 'Jupiter' },
    Saturn:   { famiglia: 'pianeta', genere: 'm', sagoma: 'anelli', pelle: '#f3dc9c', iride: '#a16207', sottotitolo: '#fde68a',
      baffi: 'manubrio', peli: '#6b4f2e',
      scala: 0.7, voce: { ritmo: '-6%', tono: '-8Hz' }, espressione: 'happy', personalita: 'Saturn' },
    Uranus:   { famiglia: 'pianeta', genere: 'm', pelle: '#a5f3fc', iride: '#0e7490', sottotitolo: '#a5f3fc',
      voce: { ritmo: '-4%', tono: '4Hz' }, espressione: 'thinking', personalita: 'Uranus' },
    Neptune:  { famiglia: 'pianeta', genere: 'm', pelle: '#7fb2f5', iride: '#1d4ed8', sottotitolo: '#93c5fd', decoro: 'macchia',
      barba: 'onde', peli: '#e0f2fe',
      voce: { ritmo: '-6%', tono: '-2Hz' }, espressione: 'neutral', personalita: 'Neptune' },
    Pluto:    { famiglia: 'nano', genere: 'm', pelle: '#e3d3bd', iride: '#92400e', sottotitolo: '#fde68a', decoro: 'cuore',
      personalita: 'Pluto' },
    /* Gli altri pianeti nani (v420), quelli di `SOL_MONDI`: fino alla v419
     * parlavano con la faccia di famiglia, tutti uguali. Il genere segue il
     * mito da cui viene il nome: Cerere, Eris, Haumea e Sedna sono dee;
     * Makemake, Gonggong, Quaoar e Orco dèi. I colori sono quelli veri (Sedna
     * e Gonggong fra i corpi più rossi del Sistema Solare, Eris quasi bianca
     * di ghiaccio), il decoro quello per cui li si riconosce: le macchie di
     * sale di Cerere, la macchia rosso scuro di Haumea. */
    Ceres:    { famiglia: 'nano', genere: 'f', pelle: '#d6d9de', iride: '#475569', sottotitolo: '#e2e8f0', labbra: '#c0587a',
      decoro: 'sale', voce: { ritmo: '0%', tono: '10Hz' }, espressione: 'happy', personalita: 'Ceres' },
    Eris:     { famiglia: 'nano', genere: 'f', pelle: '#eef2f8', iride: '#7c3aed', sottotitolo: '#ddd6fe', labbra: '#be185d',
      trucco: '#a78bfa', voce: { ritmo: '6%', tono: '14Hz' }, espressione: 'excited', personalita: 'Eris' },
    Haumea:   { famiglia: 'nano', genere: 'f', pelle: '#dfe6f2', iride: '#0e7490', sottotitolo: '#a5f3fc', labbra: '#e85d75',
      decoro: 'macchia_scura', voce: { ritmo: '14%', tono: '18Hz' }, espressione: 'laughing', personalita: 'Haumea' },
    Sedna:    { famiglia: 'nano', genere: 'f', pelle: '#e0a88f', iride: '#1e3a8a', sottotitolo: '#fecaca', labbra: '#9f1239',
      voce: { ritmo: '-10%', tono: '6Hz' }, espressione: 'sleepy', personalita: 'Sedna' },
    Makemake: { famiglia: 'nano', genere: 'm', pelle: '#e8cfc0', iride: '#9a3412', sottotitolo: '#fed7aa',
      voce: { ritmo: '4%', tono: '2Hz' }, espressione: 'happy', personalita: 'Makemake' },
    Gonggong: { famiglia: 'nano', genere: 'm', pelle: '#d8a8a8', iride: '#991b1b', sottotitolo: '#fca5a5',
      baffi: 'spioventi', peli: '#b91c1c', voce: { ritmo: '2%', tono: '-6Hz' }, espressione: 'neutral', personalita: 'Gonggong' },
    Quaoar:   { famiglia: 'nano', genere: 'm', pelle: '#cdb8c8', iride: '#6d28d9', sottotitolo: '#e9d5ff',
      voce: { ritmo: '6%', tono: '4Hz' }, espressione: 'happy', personalita: 'Quaoar' },
    Orcus:    { famiglia: 'nano', genere: 'm', pelle: '#bcc6d8', iride: '#334155', sottotitolo: '#cbd5e1',
      barba: 'ispida', peli: '#475569', voce: { ritmo: '-8%', tono: '-12Hz' }, espressione: 'thinking', personalita: 'Orcus' },
    Io:       { famiglia: 'luna', genere: 'f', pelle: '#fde68a', iride: '#ca8a04', sottotitolo: '#fde68a', espressione: 'surprised' },
    Europa:   { famiglia: 'luna', genere: 'f', pelle: '#e0f2fe', iride: '#0284c7', sottotitolo: '#bae6fd' },
    Ganymede: { famiglia: 'luna', genere: 'm', pelle: '#d6d3d1', iride: '#57534e', sottotitolo: '#e7e5e4' },
    Callisto: { famiglia: 'luna', genere: 'f', pelle: '#a8a29e', iride: '#44403c', sottotitolo: '#d6d3d1' },
    Titan:    { famiglia: 'luna', genere: 'm', pelle: '#fcd34d', iride: '#b45309', sottotitolo: '#fcd34d' },
    iss:      { famiglia: 'stazione', genere: 'f', alias: ['sat-iss', 'ISS'], personalita: 'iss' },
    css:      { famiglia: 'stazione', genere: 'f', sagoma: 'tiangong', alias: ['sat-css', 'Tiangong'], pelle: '#f3eded', iride: '#dc2626', sottotitolo: '#fca5a5',
      labbra: '#dc2626' },
    hubble:   { famiglia: 'stazione', genere: 'm', sagoma: 'hubble', alias: ['sat-hubble', 'Hubble'], pelle: '#e5e7eb', iride: '#4b5563', sottotitolo: '#e5e7eb',
      baffi: 'folti', peli: '#9ca3af' },
    voyager1: { famiglia: 'sonda', genere: 'f', alias: ['Voyager 1'], personalita: 'voyager' },
    voyager2: { famiglia: 'sonda', genere: 'f', alias: ['Voyager 2'], iride: '#be185d', sottotitolo: '#f9a8d4', labbra: '#db2777',
      personalita: 'voyager' },
    // I personaggi dell'universo (v412): compaiono soltanto nella scala
    // cosmica, dove la carta sa dove stanno. `cosmo` è il loro luogo.
    milky_way: { famiglia: 'galassia', genere: 'f', nome: 'storie.nome.milky_way', cosmo: 'milky_way', alias: ['Via Lattea', 'Milky Way'],
      pelle: '#fdf0cf', braccia: '#93c5fd', iride: '#4338ca', sottotitolo: '#c7d2fe', labbra: '#c026d3', personalita: 'milky_way' },
    andromeda: { famiglia: 'galassia', genere: 'f', nome: 'storie.nome.andromeda', cosmo: 'andromeda', alias: ['Andromeda', 'M31'],
      pelle: '#fde2f3', braccia: '#e9a8f0', iride: '#9d174d', sottotitolo: '#f5d0fe', labbra: '#db2777', trucco: '#c084fc',
      voce: { ritmo: '-6%', tono: '8Hz' }, personalita: 'andromeda' },
    sirius:    { famiglia: 'stella', genere: 'm', nome: 'storie.nome.sirius', cosmo: 'sirius', alias: ['Sirio', 'Sirius'],
      pelle: '#e0f2fe', raggi: '#7dd3fc', iride: '#1d4ed8', sottotitolo: '#bae6fd', baffi: 'manubrio', peli: '#1e3a8a',
      voce: { ritmo: '4%', tono: '-4Hz' }, espressione: 'excited', personalita: 'sirius' },
    alpha_centauri: { famiglia: 'stella', genere: 'f', nome: 'storie.nome.alpha_centauri', cosmo: 'alpha_centauri', alias: ['Alfa Centauri', 'Alpha Centauri'],
      pelle: '#fef3c7', raggi: '#fbbf24', iride: '#b45309', sottotitolo: '#fde68a', labbra: '#e11d48',
      voce: { ritmo: '2%', tono: '10Hz' }, espressione: 'happy', personalita: 'alpha_centauri' },
    /* La vita e la morte delle stelle (v414). Betelgeuse è anche la settima
     * stella del planetario (`SKY_STELLE` di app.js, lo slot `Star7`): parla
     * dalla spalla di Orione nel cielo di casa e, nella scala cosmica, dal suo
     * posto vero a 548 anni luce (`luogo`, che a differenza di `cosmo` non la
     * chiude nella carta). Gli altri vivono solo lì: la supernova del 1054,
     * che oggi è la nebulosa del Granchio (`crab_nebula`, 6500 anni luce),
     * Sirio B, la nana bianca accanto a Sirio, e Sagittario A*, il buco nero
     * al centro della Galassia. Il buco bianco non ha un posto (`cosmo:
     * 'idea'`): nessuno ne ha mai visto uno, e la storia non può metterlo su
     * una carta vera; galleggia davanti alla carta, disegnato a tratteggio. */
    Star7: { famiglia: 'stella', genere: 'f', sagoma: 'gigante_rossa', nome: 'storie.nome.betelgeuse', luogo: 'betelgeuse', alias: ['Betelgeuse'],
      pelle: '#f97a5c', raggi: '#dc3b26', iride: '#7f1d1d', sottotitolo: '#fca5a5', guance: '#fb7185', labbra: '#9f1239', trucco: '#a855f7',
      voce: { ritmo: '-8%', tono: '-2Hz' }, espressione: 'happy', personalita: 'betelgeuse' },
    supernova: { famiglia: 'stella', genere: 'f', sagoma: 'supernova', nome: 'storie.nome.supernova', cosmo: 'crab_nebula',
      alias: ['Supernova', 'SN 1054', 'Granchio', 'Crab'], pelle: '#fef3c7', raggi: '#f97316', iride: '#0369a1', sottotitolo: '#fdba74',
      labbra: '#e11d48', voce: { ritmo: '10%', tono: '8Hz' }, espressione: 'excited', personalita: 'supernova' },
    sirius_b: { famiglia: 'stella', genere: 'm', sagoma: 'nana_bianca', nome: 'storie.nome.sirius_b', cosmo: 'sirius', alias: ['Sirio B', 'Sirius B'],
      pelle: '#f1f5ff', raggi: '#93c5fd', iride: '#1e40af', sottotitolo: '#dbeafe', guance: '#c7d2fe',
      voce: { ritmo: '8%', tono: '20Hz' }, espressione: 'happy', personalita: 'sirius_b' },
    sgr_a: { famiglia: 'buco', genere: 'm', nome: 'storie.nome.sgr_a', cosmo: 'galactic_center', alias: ['Sagittario A*', 'Sagittarius A*', 'Sgr A*'],
      baffi: 'spioventi', peli: '#e9d5ff', personalita: 'sgr_a' },
    white_hole: { famiglia: 'buco', genere: 'm', sagoma: 'buco_bianco', nome: 'storie.nome.white_hole', cosmo: 'idea', alias: ['Buco bianco', 'White hole'],
      pelle: '#f8fafc', iride: '#0891b2', sottotitolo: '#a5f3fc', guance: '#a5f3fc',
      voce: { ritmo: '12%', tono: '16Hz' }, espressione: 'excited', personalita: 'white_hole' }
  };
  const STOR_SAGOME = ['stella', 'pianeta', 'luna', 'anelli', 'asteroide', 'cometa', 'voyager', 'iss', 'tiangong', 'hubble', 'galassia',
    'gigante_rossa', 'nana_bianca', 'supernova', 'buco_nero', 'buco_bianco'];
  /* Le vesti (v414, `character_become`): un personaggio diventa per un po'
   * un'altra cosa, col suo volto. Il Sole, fra cinque miliardi di anni, si
   * gonfierà in una gigante rossa e poi resterà una nana bianca: la storia
   * glielo fa provare addosso. `k` è la misura a cui arriva, rispetto alla
   * sua; il resto vince sul profilo come una riga di `STOR_PERSONAGGI`. */
  const STOR_VESTI = {
    red_giant:   { sagoma: 'gigante_rossa', pelle: '#f97a5c', raggi: '#dc3b26', k: 1.8 },
    white_dwarf: { sagoma: 'nana_bianca', pelle: '#f1f5ff', raggi: '#93c5fd', k: 0.55 },
    supernova:   { sagoma: 'supernova', pelle: '#fef3c7', raggi: '#f97316', k: 1.5 },
    black_hole:  { sagoma: 'buco_nero', pelle: '#2a1c4a', disco: '#fb923c', k: 1 },
    self:        null
  };
  // Le sagome che non sono un disco: nella vista 3D l'app le disegna come un
  // segno (la crocetta della sonda, il puntino della stazione) e il corpo lo
  // disegna questo modulo, col volto sopra
  const STOR_SAGOME_FORMA = ['asteroide', 'cometa', 'voyager', 'iss', 'tiangong', 'hubble'];
  const STOR_PIANETI = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

  /* La fisica del personaggio (v430). Chi usa l'app ha chiesto che ogni
   * personaggio sia **il suo corpo celeste**, con quello che lo distingue
   * davvero — la superficie, l'atmosfera, gli anelli, le lune che gli
   * girano attorno, l'eventuale avatar d'energia (la corona del Sole, la
   * magnetosfera di Giove) — e che la fisica muova anche le emozioni: Giove
   * arrabbiato ha le tempeste più forti, il Sole risponde con le
   * prominenze, le lune di un pianeta impaurito gli si stringono attorno,
   * Saturno gesticola con gli anelli. E soprattutto che **il carattere venga
   * dalla fisica**: Mercurio è nervoso perché fa un giro del Sole in 88
   * giorni, Plutone è insicuro perché nel 2006 l'hanno declassato.
   *
   *   superficie   cosa c'è sotto (la dice la pagina Demo, la usa il disegno)
   *   atmosfera    { colore, spessore (in raggi), densita 0–1 } o null
   *   tempeste     il tipo di maltempo che la rabbia gonfia: vortici (Giove),
   *                venti (Nettuno), cicloni (Terra), fulmini (Venere),
   *                polvere (Marte), esagono (Saturno), vulcani (Io)
   *   prominenze   true per le stelle: gli archi di plasma dal bordo
   *   avatar       l'energia attorno al corpo: corona, magnetosfera, aura
   *   anelli       { colore, rx, ry, giro, alfa } — gli anelli sottili di
   *                Urano (quasi verticali: è coricato di 98°), Nettuno, Giove;
   *                quelli di Saturno sono già la sua sagoma
   *   lune         [{ nome, colore, r, d, periodo (ms, < 0 = all'indietro),
   *                piatto (quanto è schiacciata l'orbita), giro, sasso }]
   *                in raggi del corpo: abbastanza vicine da stare nel quadro
   *   passo        quanto è svelto il suo corpo (respiro, occhiate, lune)
   *   tremito      il nervoso di fondo (Mercurio)
   *   testa        la testa piegata di serie (Urano, coricato su un fianco)
   *   tratto       la chiave `storie.fisica.<…>`: perché è fatto così
   *
   * Una famiglia dà i valori di serie; un personaggio senza riga eredita
   * quelli della famiglia (una luna qualunque: niente atmosfera, crateri). */
  const STOR_FISICA_FAMIGLIE = {
    stella:    { superficie: 'plasma', atmosfera: { colore: '#fdba74', spessore: 0.16, densita: 0.55 }, prominenze: true, avatar: 'corona', passo: 0.9 },
    pianeta:   { superficie: 'roccia', atmosfera: null, passo: 1 },
    luna:      { superficie: 'regolite', atmosfera: null, passo: 1 },
    nano:      { superficie: 'ghiaccio', atmosfera: null, passo: 1 },
    asteroide: { superficie: 'roccia', atmosfera: null, passo: 1.15 },
    cometa:    { superficie: 'ghiaccio_sporco', atmosfera: null, passo: 1.2 },
    stazione:  { superficie: 'metallo', atmosfera: null, passo: 1.1 },
    sonda:     { superficie: 'metallo', atmosfera: null, passo: 0.9 },
    galassia:  { superficie: 'stelle', atmosfera: null, avatar: 'aura', passo: 0.6 },
    buco:      { superficie: 'orizzonte', atmosfera: null, avatar: 'aura', passo: 0.7 }
  };
  const STOR_FISICA = {
    Sun:     { superficie: 'plasma', atmosfera: { colore: '#fb923c', spessore: 0.2, densita: 0.6 }, prominenze: true, avatar: 'corona',
      passo: 0.85, tratto: 'Sun' },
    Mercury: { superficie: 'crateri', atmosfera: null, passo: 1.85, tremito: 0.3, tratto: 'Mercury' },
    Venus:   { superficie: 'nubi_acide', atmosfera: { colore: '#facc15', spessore: 0.2, densita: 0.95 }, tempeste: 'fulmini',
      passo: 0.8, tratto: 'Venus' },
    Earth:   { superficie: 'oceani', atmosfera: { colore: '#7dd3fc', spessore: 0.11, densita: 0.55 }, tempeste: 'cicloni', avatar: 'magnetosfera',
      lune: [{ nome: 'Moon', colore: '#e2e8f0', r: 0.27, d: 1.42, periodo: 9000, piatto: 0.34, giro: -0.12 }], tratto: 'Earth' },
    Moon:    { superficie: 'crateri', atmosfera: null, tratto: 'Moon' },
    Mars:    { superficie: 'deserto', atmosfera: { colore: '#fdba74', spessore: 0.06, densita: 0.25 }, tempeste: 'polvere', passo: 1.15,
      lune: [{ nome: 'Phobos', colore: '#a8937f', r: 0.11, d: 1.2, periodo: 2600, piatto: 0.3, giro: 0.05, sasso: true },
        { nome: 'Deimos', colore: '#c4b39c', r: 0.08, d: 1.48, periodo: 6200, piatto: 0.3, giro: 0.05, sasso: true }], tratto: 'Mars' },
    Jupiter: { superficie: 'bande', atmosfera: { colore: '#fde7c4', spessore: 0.1, densita: 0.5 }, tempeste: 'vortici', avatar: 'magnetosfera',
      anelli: { colore: '#c8b49a', rx: 1.3, ry: 0.07, giro: 0.04, alfa: 0.35 }, passo: 0.7,
      lune: [{ nome: 'Io', colore: '#fde68a', r: 0.09, d: 1.22, periodo: 3000, piatto: 0.12, giro: 0.04 },
        { nome: 'Europa', colore: '#e0f2fe', r: 0.08, d: 1.38, periodo: 4500, piatto: 0.12, giro: 0.04 },
        { nome: 'Ganymede', colore: '#d6d3d1', r: 0.11, d: 1.55, periodo: 7000, piatto: 0.12, giro: 0.04 },
        { nome: 'Callisto', colore: '#a8a29e', r: 0.1, d: 1.72, periodo: 11000, piatto: 0.12, giro: 0.04 }], tratto: 'Jupiter' },
    Saturn:  { superficie: 'bande', atmosfera: { colore: '#fde68a', spessore: 0.08, densita: 0.45 }, tempeste: 'esagono', passo: 0.85,
      lune: [{ nome: 'Titan', colore: '#f59e0b', r: 0.13, d: 1.82, periodo: 9000, piatto: 0.26, giro: -0.1 }], tratto: 'Saturn' },
    Uranus:  { superficie: 'ghiaccio', atmosfera: { colore: '#a5f3fc', spessore: 0.12, densita: 0.55 }, passo: 0.9, testa: 0.3,
      anelli: { colore: '#e2e8f0', rx: 1.5, ry: 0.36, giro: 1.4, alfa: 0.7 },
      lune: [{ nome: 'Miranda', colore: '#cbd5e1', r: 0.07, d: 1.3, periodo: 3400, piatto: 0.36, giro: 1.4 },
        { nome: 'Titania', colore: '#d6d3d1', r: 0.1, d: 1.65, periodo: 7600, piatto: 0.36, giro: 1.4 }], tratto: 'Uranus' },
    Neptune: { superficie: 'ghiaccio', atmosfera: { colore: '#60a5fa', spessore: 0.12, densita: 0.6 }, tempeste: 'venti', passo: 0.6,
      anelli: { colore: '#bfdbfe', rx: 1.4, ry: 0.3, giro: -0.3, alfa: 0.3 },
      lune: [{ nome: 'Triton', colore: '#fbcfe8', r: 0.12, d: 1.6, periodo: -8000, piatto: 0.45, giro: -0.3 }], tratto: 'Neptune' },
    Pluto:   { superficie: 'ghiaccio_azoto', atmosfera: { colore: '#bfdbfe', spessore: 0.06, densita: 0.25 }, passo: 1.05, tremito: 0.1,
      lune: [{ nome: 'Charon', colore: '#cbd5e1', r: 0.48, d: 1.7, periodo: 9500, piatto: 0.3, giro: -0.15 }], tratto: 'Pluto' },
    Io:      { superficie: 'zolfo', atmosfera: null, tempeste: 'vulcani', passo: 1.2 },
    Europa:  { superficie: 'ghiaccio', atmosfera: null },
    Titan:   { superficie: 'metano', atmosfera: { colore: '#f59e0b', spessore: 0.22, densita: 0.9 } }
  };
  /* Come la fisica risponde a un'emozione: quanto si gonfiano le tempeste
   * e le prominenze, come cambia l'atmosfera (`k` lo spessore, `tinta` il
   * colore verso cui va, `alfa` quanto si vede), che fanno le lune (`k` il
   * raggio dell'orbita: < 1 si stringono, `giro` quanto corrono, `tremito`,
   * `balla`, `cala`) e gli anelli (`inclina` in radianti, `apri` quanto si
   * aprono, `brilla`), e quanto si accende l'avatar. */
  const STOR_FISICA_EMOZIONI = {
    neutral:   {},
    happy:     { prominenze: 0.25, atmo: { k: 1.05 }, lune: { giro: 1.25, balla: 0.4 }, anelli: { inclina: 0.12, apri: 0.12, brilla: 0.6 }, avatar: 0.35 },
    excited:   { tempesta: 0.15, prominenze: 0.7, atmo: { k: 1.15, tinta: '#fde047', mix: 0.2 }, lune: { k: 1.08, giro: 2, balla: 1 },
      anelli: { inclina: 0.22, apri: 0.3, brilla: 1 }, avatar: 0.8 },
    laughing:  { tempesta: 0.1, prominenze: 0.55, atmo: { k: 1.1 }, lune: { giro: 1.7, balla: 1 }, anelli: { inclina: 0.1, apri: 0.2, scuoti: 1, brilla: 0.8 }, avatar: 0.6 },
    surprised: { prominenze: 0.6, atmo: { k: 1.25 }, lune: { k: 1.3, giro: 0.6 }, anelli: { apri: 0.45 }, avatar: 0.6 },
    love:      { prominenze: 0.3, atmo: { k: 1.15, tinta: '#f472b6', mix: 0.35 }, lune: { k: 0.85, giro: 1.1 }, anelli: { inclina: 0.1, apri: 0.1, brilla: 0.5 }, avatar: 0.6 },
    thinking:  { lune: { giro: 0.6 }, anelli: { inclina: -0.06 }, avatar: 0.3 },
    worried:   { tempesta: 0.2, atmo: { k: 0.95, tinta: '#94a3b8', mix: 0.2 }, lune: { k: 0.78, giro: 0.8, tremito: 0.5 }, anelli: { inclina: -0.15, apri: -0.1 }, avatar: 0.2 },
    sad:       { tempesta: 0.1, atmo: { k: 0.85, tinta: '#64748b', mix: 0.35, alfa: 0.7 }, lune: { k: 0.88, giro: 0.45, cala: 1 },
      anelli: { inclina: -0.28, apri: -0.2 }, avatar: 0.1 },
    sleepy:    { atmo: { k: 0.9, alfa: 0.8 }, lune: { k: 0.95, giro: 0.3, cala: 0.5 }, anelli: { inclina: -0.2, apri: -0.3 }, avatar: 0.1 },
    annoyed:   { tempesta: 0.5, prominenze: 0.45, atmo: { k: 1.15, tinta: '#f97316', mix: 0.2 }, lune: { giro: 1.2, tremito: 0.35 },
      anelli: { inclina: -0.12, apri: -0.15 }, avatar: 0.5 },
    angry:     { tempesta: 1, prominenze: 1, atmo: { k: 1.35, tinta: '#ef4444', mix: 0.45 }, lune: { k: 1.05, giro: 1.8, tremito: 1 },
      anelli: { apri: -0.25, scuoti: 0.6 }, avatar: 1 },
    bully:     { tempesta: 0.4, prominenze: 0.6, atmo: { k: 1.2, tinta: '#a855f7', mix: 0.2 }, lune: { k: 1.1, giro: 1.4 },
      anelli: { inclina: 0.3, apri: 0.2, brilla: 1 }, avatar: 0.7 }
  };

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
  const STOR_TAU_BOCCA_CHIUDE = 22;
  const STOR_COMPARSA_MS = 560;     // il «pop» elastico con cui un volto compare
  const STOR_BOING_MS = 460;        // il rimbalzo di un cambio d'espressione
  const STOR_SACCADI_MS = [900, 2600]; // le occhiate a vuoto di chi sta fermo

  /* Il corpo nello spazio (§5-bis) e gli effetti speciali (§6-ter), v409.
   * Le chiavi del DSL sono in inglese come tutte le altre; i nomi a schermo
   * stanno nei dizionari (`storie.percorso.*`, `storie.animazione.*`,
   * `storie.effetto.*`). */
  const STOR_PERCORSI = ['arc', 'straight', 'hop', 'loop', 'spiral', 'zigzag', 'teleport'];
  const STOR_LATI = ['auto', 'left', 'right', 'above', 'below', 'front', 'behind'];
  // I posti dello schermo (oltre agli oggetti) verso cui un astro può andare;
  // `orbit` è la sua orbita vera, cioè «torna a casa».
  const STOR_LUOGHI = ['orbit', 'center', 'left', 'right', 'top', 'bottom'];
  const STOR_ANIMAZIONI = ['jump', 'bounce', 'shake', 'nod', 'spin', 'pulse', 'dance', 'wobble'];
  // Gli effetti e la loro durata di serie, in millisecondi della storia
  const STOR_EFFETTI = {
    explosion: 2400, shockwave: 1500, flash: 700, sparkles: 2200, fireworks: 2800, smoke: 3200,
    hearts: 2600, lightning: 1200, shooting_star: 1800, glow: 3000, confetti: 2800
  };
  const STOR_POSTI_EFFETTO = ['center', 'left', 'right', 'top', 'bottom'];
  const STOR_CRESCITA_MS = 700;     // quanto ci mette un astro a crescere per portare il volto
  const STOR_RITORNO_MS = 750;      // e a tornare com'era quando la storia lo lascia
  const STOR_VOLTO_3D_PX = STOR_VOLTO_MIN_PX * 1.25; // il raggio di volto che la 3D garantisce

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
    p.occhi = Object.assign({ r: 0.33, distanza: 0.42, alto: -0.06 }, base.occhi || {}, proprio.occhi || {});
    p.scala = Math.max(0.3, Math.min(0.95, Number(p.scala) || 0.78));
    p.dx = Number(p.dx) || 0; p.dy = Number(p.dy) || 0;
    if (!STOR_ESPRESSIONI[p.espressione]) p.espressione = STOR_ESPRESSIONE_DI_SERIE;
    p.genere = p.genere === 'f' ? 'f' : 'm';
    if (!STOR_SAGOME.includes(p.sagoma)) p.sagoma = base.sagoma || 'pianeta';
    // Baffi e barba solo a lui, labbra e ombretto solo a lei: un profilo
    // scritto male non fa una Luna coi baffi
    if (p.genere === 'f') { p.baffi = null; p.barba = null; }
    else { p.trucco = null; }
    p.peli = p.peli || scurisci(p.pelle, 0.55);
    p.labbra = p.genere === 'f' ? (p.labbra || '#d9577b') : null;
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
    // Senza `nomeCorpo` (lo Studio nelle prove Node) il dizionario basta
    if (t('corpo.' + id)) return t('corpo.' + id);
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
      occhi: m('occhi', 1), iride: m('iride', 1), stelle: m('stelle', 0), cuori: m('cuori', 0),
      inclinaSu: m('inclinaSu', 0), arcoGiu: m('arcoGiu', 0.15), felici: m('felici', 0), lucidi: m('lucidi', 0),
      rosso: m('rosso', 0), storta: m('storta', 0),
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
    // v426: anche i denti si mescolano (fino alla v425 si perdevano alla
    // prima sillaba, e chi era arrabbiato parlava a bocca spalancata)
    return { larg: mix(a.larg, b.larg, k), aper: mix(a.aper, b.aper, k), tondo: mix(a.tondo, b.tondo, k),
      curva: mix(a.curva, b.curva, k), onda: mix(a.onda || 0, b.onda || 0, k), denti: mix(a.denti || 0, b.denti || 0, k) };
  }

  /* La bocca a cui tendere (v426): quella dell'espressione a riposo, o,
   * mentre il personaggio parla, la sillaba **detta con la sua faccia**.
   * Fino alla v425 chi parlava aveva le cinque bocche del parlato e basta:
   * l'arrabbiato perdeva i denti stretti, il preoccupato smetteva di
   * tremare, il contento parlava con la bocca stretta di chi è serio. Adesso
   * la larghezza sta a metà fra la sillaba e la bocca dell'umore; chi ha i
   * denti parla fra i denti (la sillaba apre poco, e non diventa mai una O);
   * chi trema trema anche parlando; chi sorride parla sorridendo (la bocca
   * non si chiude mai del tutto fra una sillaba e l'altra). La curvatura
   * dell'umore la aggiunge `storGeometria`. Funzione pura: la provano le
   * prove e la usa l'anteprima delle bocche. */
  function storBoccaBersaglio(espr, forma) {
    const riposo = STOR_BOCCHE[espr && espr.bocca] || STOR_BOCCHE.chiusa;
    if (!forma || !(forma.apertura > 0)) return Object.assign({ onda: 0, denti: 0 }, riposo);
    const sill = STOR_BOCCHE[forma.forma] || STOR_BOCCHE.chiusa;
    const out = { larg: mix(sill.larg, riposo.larg, 0.5), aper: sill.aper, tondo: sill.tondo, curva: sill.curva,
      onda: (riposo.onda || 0) * 0.6, denti: riposo.denti || 0 };
    if (out.denti) {
      out.aper = Math.max(riposo.aper, sill.aper * 0.85);
      out.tondo = 0;
      out.curva = riposo.curva;
    } else if (riposo.aper > 0.1 && riposo.curva > 0.5) {
      out.aper = Math.max(sill.aper, riposo.aper * 0.55);
      out.curva = Math.max(sill.curva, riposo.curva * 0.6);
      out.tondo = sill.tondo * 0.6;
    }
    return out;
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

  /* L'apertura dell'occhio: la parte dell'ellisse che sta fra la palpebra
   * di sopra e quella di sotto, come due file di punti da sinistra a
   * destra (il bordo di sopra e quello di sotto). Fino alla v410 le palpebre
   * erano due stesure del colore della pelle appoggiate sull'occhio: sopra a
   * un pianeta vero, di un altro colore, sembravano un paio d'occhiali, e a
   * occhio spalancato il tratto della palpebra diventava una virgola scura in
   * cima all'iride — una seconda pupilla. Adesso l'occhio **è** l'apertura:
   * il bianco, l'iride e il contorno seguono questo bordo, e quando le due
   * palpebre si toccano l'apertura è `null` (l'occhio è una riga). */
  function storAperturaOcchio(occ) {
    const N = 36, punti = [];
    for (let i = 0; i <= N; i++) {
      const u = -1 + 2 * i / N;
      const e = Math.sqrt(Math.max(0, 1 - u * u));
      const su = Math.max(occ.cy - occ.ry * e, occ.palpebraSu(u));
      const giu = Math.min(occ.cy + occ.ry * e, occ.palpebraGiu(u));
      punti.push({ u, su, giu, d: giu - su });
    }
    // Il tratto aperto più lungo (è uno solo: ellisse e palpebre sono curve dolci)
    let meglio = null, da = -1;
    for (let i = 0; i <= N + 1; i++) {
      const aperto = i <= N && punti[i].d > 0.01;
      if (aperto && da < 0) da = i;
      if (!aperto && da >= 0) { if (!meglio || i - da > meglio[1] - meglio[0]) meglio = [da, i - 1]; da = -1; }
    }
    if (!meglio) return null;
    const x = u => occ.cx + u * occ.rx;
    // Gli angoli dell'occhio: dove le due palpebre si incontrano, fra un
    // campione chiuso e uno aperto
    const angolo = (i, j) => {
      const a = punti[i], b = punti[j];
      if (!a || a.d > 0.01) return null;
      const k = a.d === b.d ? 0 : (0 - a.d) / (b.d - a.d);
      const u = mix(a.u, b.u, Math.max(0, Math.min(1, k)));
      const y = mix(mix(a.su, b.su, k), mix(a.giu, b.giu, k), 0.5);
      return [x(u), y];
    };
    const sx = angolo(meglio[0] - 1, meglio[0]), dx = angolo(meglio[1] + 1, meglio[1]);
    const sopra = [], sotto = [];
    if (sx) { sopra.push(sx); sotto.push(sx); }
    for (let i = meglio[0]; i <= meglio[1]; i++) { sopra.push([x(punti[i].u), punti[i].su]); sotto.push([x(punti[i].u), punti[i].giu]); }
    if (dx) { sopra.push(dx); sotto.push(dx); }
    const alto = Math.max(...punti.slice(meglio[0], meglio[1] + 1).map(p => p.d));
    return { sopra, sotto, alto };
  }

  /* Il volto in un riquadro di raggio R centrato in (cx, cy). `st`:
   *   espr     i parametri dell'espressione (già mescolati)
   *   sguardo  {x, y} nel cerchio unitario
   *   battito  0 aperto … 1 chiuso
   *   bocca    {larg, aper, tondo, curva} (la forma del parlato o del riposo)
   * Restituisce le parti, e nient'altro: il disegno è in §6. Il genere del
   * profilo cambia le misure: lei ha gli occhi un po' più grandi e alti e le
   * sopracciglia sottili e arcuate, lui le sopracciglia folte e più basse. */
  function storGeometria(cx, cy, R, profilo, st) {
    const o = profilo.occhi;
    const e = st.espr;
    const lei = profilo.genere === 'f';
    // (v425: gli occhi spalancati non si toccano mai fra loro)
    const rx = Math.min(o.distanza * R * 0.9, o.r * R * Math.max(0.7, Math.min(1.45, e.occhi || 1)) * (lei ? 1.05 : 0.96));
    // v417-v418, gli «occhioni di luna»: l'occhio è grande e alto, a
    // mandorla tonda; l'iride è un ovale che occupa poco più di metà della
    // larghezza, così ha strada per guardare di lato (come nel disegno di
    // riferimento, dove la Luna guarda da una parte)
    const ry = rx * (lei ? 1.1 : 1.02);
    const g = st.sguardo || { x: 0, y: 0 };
    const gm = Math.hypot(g.x, g.y);
    const gx = gm > 1 ? g.x / gm : g.x, gy = gm > 1 ? g.y / gm : g.y;
    // v432: l'iride un poco più grande (era 0,66): lo sguardo più dolce
    const iride = rx * Math.min(0.8, 0.7 * Math.max(0.6, e.iride || 1));
    // la pupilla è grande: di serie occupa i tre quarti dell'iride, e
    // dell'iride resta una corona di colore
    const pupilla = Math.min(iride * 0.84, iride * 0.68 * Math.max(0.5, Math.min(1.3, e.pupilla)));
    // Quanto può correre l'iride senza uscire dall'occhio: l'ellisse è più
    // alta che larga, e il suo raggio più corto è rx.
    const corsa = Math.max(rx * 0.1, rx - iride - rx * 0.04);
    const battito = Math.max(0, Math.min(1, st.battito || 0));
    let su = Math.max(0, Math.min(1, e.palpebraSu + 0.1 * (1 - Math.min(1, e.palpebraSu * 3)))), giu = Math.max(0, Math.min(1, e.palpebraGiu));
    // Il battito porta giù la palpebra di sopra fino a toccare quella di
    // sotto (che sale appena): un occhio chiuso è una riga, non un buco.
    su = mix(su, 1 - giu * 0.4, battito);
    giu = mix(giu, giu * 0.4, battito);
    if (su + giu > 1) { const k = 1 / (su + giu); su *= k; giu *= k; }
    // Col battito la palpebra si raddrizza: un occhio arrabbiato che batte
    // le palpebre si chiude, non resta una fessura storta
    const inclina = (e.inclinaSu || 0) * (1 - battito);
    const arco = Math.max(0, e.arcoGiu === undefined ? 0.15 : e.arcoGiu) * (1 - battito);
    // quanto l'occhio è a mandorla: poco da spalancato (la sorpresa è tonda)
    const mandorla = Math.min(1, 0.3 + su * 4);
    const occhi = [-1, 1].map(lato => {
      const ex = cx + lato * o.distanza * R, ey = cy + o.alto * R;
      const ix = ex + gx * corsa, iy = ey + gy * corsa;
      const bordoSu = ey - ry + 2 * ry * su, bordoGiu = ey + ry - 2 * ry * giu;
      const angolo = u => ey + ry * 0.07 * (1 - u * lato);
      const occ = {
        lato, cx: ex, cy: ey, rx, ry,
        iride: { x: ix, y: iy, r: iride },
        pupilla: { x: ix, y: iy, r: pupilla },
        // I riflessi: un tondo grande in alto verso destra e un puntino
        // sotto, a sinistra di lui (v418)
        luci: [
          { x: ix + iride * 0.24, y: iy - iride * 0.3, r: iride * 0.3 },
          { x: ix - iride * 0.3, y: iy + iride * 0.36, r: iride * 0.13 }
        ].concat((e.lucidi || 0) > 0.5 ? [{ x: ix + iride * 0.05, y: iy - iride * 0.52, r: iride * 0.1 },
          { x: ix - iride * 0.42, y: iy + iride * 0.28, r: iride * 0.08 }] : []),
        // Le palpebre come quota del loro bordo
        bordoSu, bordoGiu,
        chiusura: su + giu, giu, inclina, arco,
        felici: (e.felici || 0) > 0.5,
        // Il bordo delle palpebre lungo l'occhio (u da −1 a 1, da sinistra a
        // destra). Quella di sopra segue la curva del bulbo, e `inclina` la
        // abbassa verso il naso (> 0, la rabbia) o verso fuori (< 0, la
        // tristezza); quella di sotto si inarca all'insù quanto dice `arco`.
        // Dalla v418 le due palpebre disegnano loro la forma dell'occhio:
        // la palpebra di sopra è una cupola morbida che scende fino
        // all'angolo, quella di sotto una U che sale fino allo stesso
        // angolo (`angolo`, un poco più basso vicino al naso). Così l'occhio
        // è tondo col solo angolo esterno a punta, come nel disegno di
        // riferimento, e non un'ellisse tagliata (squadrata) o un limone.
        // `mandorla` dice quanto: poco da spalancati, e la sorpresa è tonda.
        palpebraSu: u => {
          const centro = bordoSu - ry * 0.15 * mandorla;
          return centro + mandorla * Math.max(0, angolo(u) - centro) * Math.pow(Math.abs(u), 2.8) +
            inclina * ry * 0.42 * (-lato * u) * Math.min(1, su * 4 + 0.25);
        },
        palpebraGiu: u => bordoGiu - ry * arco * 0.72 * (1 - u * u) -
          mandorla * Math.max(0, bordoGiu - angolo(u)) * Math.pow(Math.abs(u), 2.6) * (1 - Math.min(0.85, arco * 1.4))
      };
      occ.apertura = occ.chiusura >= 0.985 ? null : storAperturaOcchio(occ);
      return occ;
    });
    const c = e.ciglio;
    const cigli = occhi.map(occ => {
      const asim = occ.lato < 0 ? (c.asimmetria || 0) : 0;
      // v425: le sopracciglia corrono di più (0,3 del volto invece di 0,24):
      // da lontano sono loro a dire l'umore prima della bocca
      const yBase = occ.cy - occ.ry - R * (0.08 + (c.alza + asim) * 0.3 + (lei ? 0.05 : -0.015)) - (st.alzaCigli || 0) * R * 0.07;
      // `inclina` > 0 alza l'estremo verso il naso: la faccia preoccupata.
      // Quelle di lei sono lunghe e alte, un filo che si assottiglia fuori
      const interno = occ.cx - occ.lato * occ.rx * (lei ? 0.62 : 1.0), esterno = occ.cx + occ.lato * occ.rx * (lei ? 1.28 : 1.18);
      const yInterno = yBase - c.inclina * R * 0.2, yEsterno = yBase + c.inclina * R * 0.09;
      const curva = c.curva + (lei ? 0.5 : 0.06);
      return {
        lato: occ.lato,
        x1: interno, y1: yInterno, x2: esterno, y2: yEsterno,
        qx: (interno + esterno) / 2 + occ.lato * (lei ? occ.rx * 0.12 : 0), qy: (yInterno + yEsterno) / 2 - curva * R * 0.15,
        spessore: Math.max(lei ? 1.6 : 2.4, R * (lei ? 0.062 : 0.105)), folto: !lei
      };
    });
    const b = st.bocca;
    const bocca = {
      // v425: la bocca è più grande (un terzo in più), come nei cartoni: è
      // il segno che si legge meglio su un astro piccolo. Sotto ai baffi
      // scende un poco (v426), se no i baffi la coprivano tutta
      x: cx + (e.spostaBocca || 0) * R, y: cy + (profilo.baffi ? 0.5 : 0.42) * R,
      // v432: un filo più stretta (era 1,3), più da bambola
      larg: b.larg * R * 1.2 * (lei ? 0.94 : 1), aper: b.aper * R * 1.3, tondo: b.tondo, onda: b.onda || 0, denti: b.denti || 0,
      storta: e.storta || 0,
      // la curvatura dell'espressione resta anche parlando (si parla sorridendo)
      curva: Math.max(-1, Math.min(1, b.curva + e.curva * (b.aper > 0.04 ? 0.5 : 1)))
    };
    const guance = e.guance > 0.05 ? occhi.map(occ => ({ lato: occ.lato, x: Math.min(Math.abs(occ.cx + occ.lato * occ.rx * 0.45 - cx), R * 0.6) * occ.lato + cx,
      // con gli occhi spalancati (la sorpresa) le guance non scappano dal viso
      y: Math.min(occ.cy + occ.ry * 1.5, cy + 0.36 * R),
      // v432: guance più tonde e un poco più grandi (erano 0,78 × 0,46)
      rx: Math.min(occ.rx, o.r * R * 1.05) * 0.86, ry: Math.min(occ.rx, o.r * R * 1.05) * 0.54, alfa: Math.min(0.8, 0.28 + e.guance * 0.45), linee: e.guance > 1.05 })) : [];
    // Il naso: una virgola d'inchiostro fra gli occhi e la bocca (più
    // grande e col suo bulbo per lui)
    const naso = { x: cx + (e.spostaBocca || 0) * R * 0.4, y: cy + 0.2 * R, r: R * (lei ? 0.04 : 0.058) };
    return { cx, cy, R, occhi, cigli, bocca, guance, naso, lei, rosso: e.rosso || 0,
      stelle: e.stelle || 0, cuori: e.cuori || 0, lucidi: e.lucidi || 0, segno: e.segno || null };
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
    ridotto: false,
    // La vista 3D (§5-bis): dove ogni astro sarebbe davvero e dove la
    // storia lo ha messo, nelle unità della scena; i ritorni di chi è uscito
    // di scena spostato o ingrandito; gli effetti speciali in corso (§6-ter).
    vere: new Map(),           // id → { scena, r } la posizione vera, a ogni fotogramma
    mosse: new Map(),          // id → { scena, r } quella mostrata
    vicinoVere: null,          // in quale banco sono state lette (sistema o Terra e Luna)
    ritorni: new Map(),        // id → { delta, k, da }
    effetti: [],
    domanda: null              // il cartello della domanda al pubblico (v430, story_question)
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
    if ((stor.personaggi.size || stor.effetti.length) && d && !d.inCorso && !stor.anteprima) storSgombra();
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
      saccade: { x: 0, y: 0 }, prossimaSaccade: stor.orologio + 600 + dado(r) * 1200,
      // Il corpo (§5-bis): il viaggio in corso o finito, le animazioni della
      // scena, la scala chiesta, e quanto è stato mostrato nell'ultimo fotogramma
      moto: null, animazioni: [], scalaVoluta: null, veste: null,
      rVero: 0, rMostrato: 0, ultimoPunto3D: null, ultimoDelta: null
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
        for (const [id, p] of stor.personaggi) if (p.congedo) { storRitorno(p); stor.personaggi.delete(id); }
        if (!stor.personaggi.size) { stor.parlante = null; stor.posti.clear(); stor.ultimiDisegnati = []; }
      });
    }
  }
  function storSgombra() {
    for (const p of stor.personaggi.values()) storRitorno(p);
    stor.personaggi.clear(); stor.parlante = null; stor.posti.clear(); stor.ricevute.clear();
    stor.ultimiDisegnati = []; stor.effetti = []; stor.domanda = null;
    stor.regia.modo = 'auto'; stor.regia.chi = null; stor.regia.zoomMax = null; stor.regia.scosse = []; stor.regia.tieni = null;
    Object.assign(stor.regia, { giro: 0, vGiro: 0, giroOra: NaN, ultimoParlante: null, ultimoGiro: null, rot: 0, vrot: 0, velGiro: STOR_REGIA.giroVel });
    storZittisci();
  }
  // Chi esce di scena spostato o ingrandito non torna a posto di colpo: per
  // tre quarti di secondo scivola indietro verso l'orbita e la misura veri.
  function storRitorno(pg) {
    const k = pg.rVero > 0 && pg.rMostrato > 0 ? pg.rMostrato / pg.rVero : 1;
    const d = pg.ultimoDelta;
    const spostato = d && (Math.abs(d.x) + Math.abs(d.y) + Math.abs(d.z)) > 1e-12;
    if (!spostato && Math.abs(k - 1) < 1e-3) return;
    stor.ritorni.set(pg.id, { delta: spostato ? d : null, k, da: adesso() });
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
      canale: 'demo', personaggio: id, testoSeSpenta: true,
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
  // 5-bis. Il corpo nello spazio: viaggi, animazioni, misura (vista 3D)
  // ===================================================================

  /* Fino alla v408 la promessa era «il cielo resta vero»: il volto si
   * appoggiava dove il renderer aveva disegnato l'astro, e un pianeta di tre
   * pixel aveva la faccia in un adesivo accanto. Chi scrive storie ha chiesto
   * il contrario, e ha ragione: il personaggio è **l'astro stesso**. Allora,
   * solo nella vista 3D e solo per chi è in scena:
   *
   *   - l'astro **cresce** quanto basta a portare il volto (di serie, con
   *     `size: auto`; `size: real` lo lascia della sua misura);
   *   - può **viaggiare** fuori dall'orbita (`character_move`) verso un altro
   *     astro o un posto dello schermo, con un percorso da cartone, e tornare
   *     (`character_return`);
   *   - salta, trema, balla (`character_animate`), e cambia misura
   *     (`character_scale`).
   *
   * Tutto avviene **nella scena 3D**, prima della proiezione: l'app chiede a
   * `storScena3D` dove mettere un corpo e a `storRaggio3D` quanto farlo
   * grosso, e da lì in poi lo tratta come sempre — la profondità, le lune
   * che lo seguono, la fase, il nome, il dito che lo sceglie. Senza
   * personaggi le due funzioni restituiscono quello che ricevono alla prima
   * riga. Quando la storia lascia l'astro, l'astro torna a posto scivolando
   * (`storRitorno`). Il planetario resta com'era: lì gli astri non viaggiano,
   * e le animazioni muovono solo il volto.
   *
   * Lo spostamento si pensa **sullo schermo** (a destra di Giove, al centro,
   * con un arco verso l'alto) e si fa **nello spazio**: la proiezione è
   * ortogonale, quindi la terna dello schermo (`storAssiSchermo`) è una base
   * ortonormale della scena e un passo di un pixel vale `1 / sol.scala`. */
  const liscio = u => { const x = Math.max(0, Math.min(1, u)); return x * x * x * (x * (x * 6 - 15) + 10); };
  const v3 = {
    piu: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
    meno: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
    per: (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k }),
    punto: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
    misto: (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k })
  };
  // La terna dello schermo nella scena: `ex` verso destra, `su` verso l'alto,
  // `w` verso chi guarda. È quella di `solProietta` (app.js) letta al
  // contrario: la camera gira di `az` (radianti) ed è alta `elev` (gradi).
  function storAssiSchermo(s) {
    const a = (s && s.az) || 0, e = ((s && s.elev) || 0) * Math.PI / 180;
    return {
      ex: { x: Math.cos(a), y: -Math.sin(a), z: 0 },
      su: { x: Math.sin(a) * Math.sin(e), y: Math.cos(a) * Math.sin(e), z: Math.cos(e) },
      w: { x: -Math.sin(a) * Math.cos(e), y: -Math.cos(a) * Math.cos(e), z: Math.sin(e) },
      scala: Math.max(1e-9, (s && s.scala) || 1)
    };
  }
  // Un passo sullo schermo (pixel, y in giù) come vettore della scena
  function dalloSchermo(assi, dx, dy) {
    return v3.piu(v3.per(assi.ex, dx / assi.scala), v3.per(assi.su, -dy / assi.scala));
  }

  /* L'animazione del corpo in un istante, in raggi del corpo: spostamento
   * (`dx`, `dy`, y in giù), misura (`k`), e per il volto rotazione (`giro`) e
   * schiacciamento (`sx`, `sy`). `u` va da 0 a 1 sulla ripresa; a 0 e a 1
   * ogni animazione è ferma, così finisce dove è cominciata. Funzione pura. */
  function storAnimazioneAl(tipo, u, volte, forza) {
    const o = { dx: 0, dy: 0, k: 1, giro: 0, sx: 1, sy: 1 };
    if (!(u > 0) || u >= 1) return o;
    const n = Math.max(1, Math.round(Number(volte) || 0) || (tipo === 'bounce' || tipo === 'shake' || tipo === 'nod' ? 3 : 2));
    const f = Number.isFinite(forza) ? Math.max(0.1, Math.min(3, forza)) : 1;
    const P = Math.PI;
    if (tipo === 'jump' || tipo === 'bounce') {
      const alto = tipo === 'jump' ? 1.35 : 0.6, molla = tipo === 'jump' ? 0.12 : 0.22;
      const h = Math.abs(Math.sin(P * n * u));
      o.dy = -h * alto * f;
      // schiacciato quando tocca terra, allungato in volo
      const terra = Math.pow(1 - h, 6);
      o.sx = 1 + molla * f * terra - 0.05 * f * h; o.sy = 1 - molla * f * terra + 0.07 * f * h;
    } else if (tipo === 'shake') {
      o.dx = Math.sin(2 * P * 3 * n * u) * 0.26 * f * (1 - u * 0.4);
      o.giro = Math.sin(2 * P * 3 * n * u) * 0.06 * f;
    } else if (tipo === 'nod') {
      o.dy = Math.sin(2 * P * n * u) * 0.14 * f; o.giro = Math.sin(2 * P * n * u) * 0.07 * f;
    } else if (tipo === 'spin') {
      o.giro = 2 * P * n * liscio(u);
    } else if (tipo === 'pulse') {
      o.k = 1 + 0.24 * f * Math.abs(Math.sin(P * n * u));
    } else if (tipo === 'dance') {
      const a = Math.sin(2 * P * n * u);
      o.dx = a * 0.5 * f; o.dy = -Math.abs(a) * 0.22 * f; o.giro = a * 0.3 * f;
    } else if (tipo === 'wobble') {
      const w = Math.sin(2 * P * 2 * n * u) * (1 - u) * 0.22 * f;
      o.sx = 1 + w; o.sy = 1 - w;
    }
    return o;
  }
  // Tutte le animazioni del personaggio in questo istante, sommate
  function storAnimazioniDi(pg) {
    const o = { dx: 0, dy: 0, k: 1, giro: 0, sx: 1, sy: 1 };
    if (stor.ridotto || !pg.animazioni || !pg.animazioni.length) return o;
    for (const a of pg.animazioni) {
      const x = storAnimazioneAl(a.tipo, a.u, a.volte, a.forza);
      o.dx += x.dx; o.dy += x.dy; o.giro += x.giro; o.k *= x.k; o.sx *= x.sx; o.sy *= x.sy;
    }
    return o;
  }
  /* Il corpo di chi parla (v427). Chi ha chiesto le CosmoStorie voleva
   * personaggi vivi mentre parlano, non una bocca che si apre su una palla
   * ferma: allora chi parla annuisce sulle sillabe, ondeggia piano da un lato
   * all'altro, dondola la testa, si sporge verso chi guarda, e ogni frase ha
   * i suoi «colpi» — un saltello con lo schiacciamento all'atterraggio, ogni
   * secondo e un quarto circa, come un attore che sottolinea le parole.
   *
   * `energia` (0…1) sale in un quarto di secondo quando la voce comincia e
   * scende in mezzo secondo quando tace: niente scatti a inizio e fine
   * battuta. In raggi del corpo (`dx`, `dy`, y in giù), radianti (`giro`) e
   * fattori (`sx`, `sy`, `k` per la misura del corpo nella 3D). Nella 3D lo
   * spostamento muove l'astro vero (`storScena3D`), nel planetario il volto
   * (`storPosa`). Funzione pura dello stato; col movimento ridotto è ferma. */
  const STOR_COLPO_MS = 1250;
  function storMotoParlato(pg, t) {
    const m = { dx: 0, dy: 0, giro: 0, sx: 1, sy: 1, k: 1 };
    const en = Math.max(0, Math.min(1, pg.energia || 0));
    if (!(en > 0.002) || stor.ridotto) return m;
    const f = pg.fase || 0;
    const ap = Math.max(0, Math.min(1, pg.apertura || 0));
    const tp = t - (pg.parlaDa || 0);
    // Il cenno sulle parole e l'ondeggiare lento
    m.dy -= (0.05 * ap + 0.04 * Math.abs(Math.sin(tp / 210 + f))) * en;
    m.dx += Math.sin(tp / 540 + f) * 0.06 * en;
    // La testa che dondola, più viva sulle sillabe aperte
    m.giro += (Math.sin(tp / 660 + f * 1.7) * 0.09 + Math.sin(tp / 250 + f) * 0.04 * ap) * en;
    // Si sporge verso chi guarda
    const sg = pg.sguardo ? Math.max(-1, Math.min(1, pg.sguardo.x)) : 0;
    m.dx += sg * 0.07 * en; m.giro += sg * 0.06 * en;
    // I colpi: un saltello, poi lo schiacciamento quando ricade
    const periodo = STOR_COLPO_MS * (0.85 + ((seme(pg.id || '') % 30) / 100));
    const b = (((tp + f * 400) % periodo) + periodo) % periodo / periodo;
    if (b < 0.28) {
      const q = Math.sin(b / 0.28 * Math.PI);
      m.dy -= 0.1 * q * en; m.sy += 0.06 * q * en; m.sx -= 0.035 * q * en;
    } else if (b < 0.4) {
      const q = Math.sin((b - 0.28) / 0.12 * Math.PI);
      m.sy -= 0.07 * q * en; m.sx += 0.06 * q * en;
    }
    // Il corpo si gonfia appena sulle sillabe
    m.k = 1 + 0.04 * ap * en;
    return m;
  }

  // La scala chiesta con `character_scale`, mentre ci arriva e dopo
  function storScalaDi(pg) {
    const s = pg.scalaVoluta;
    const k = storVesteK(pg);
    if (!s) return k;
    return mix(s.da, s.a, stor.ridotto ? 1 : liscio(s.u)) * k;
  }
  /* La veste (`character_become`, v414): quanto è grande adesso rispetto a
   * sé (la gigante rossa si gonfia per tutta la ripresa, la nana bianca si
   * rimpicciolisce) e il profilo con cui si disegna. Il volto resta il suo:
   * gli occhi, i baffi del Sole, la voce. */
  function storVesteK(pg) {
    const v = pg.veste;
    if (!v) return 1;
    const a = v.forma === 'self' ? 1 : (STOR_VESTI[v.forma] || { k: 1 }).k;
    return mix(v.kDa, a, stor.ridotto ? 1 : liscio(v.u));
  }
  function storVesteProfilo(pg) {
    const v = pg.veste;
    if (!v || !STOR_VESTI[v.forma]) return pg.profilo;
    if (!v.profilo || v.di !== pg.profilo) {
      const resto = Object.assign({}, STOR_VESTI[v.forma]);
      delete resto.k;
      v.profilo = Object.assign({}, pg.profilo, resto);
      v.di = pg.profilo;
    }
    return v.profilo;
  }

  /* Dove va un viaggio, nella scena. Un oggetto: accanto a lui, dal lato
   * chiesto (di serie quello da cui si arriva), a una distanza fatta dei due
   * raggi disegnati — così due astri ingranditi non si compenetrano. Un
   * posto dello schermo: quel punto, alla propria profondità. L'orbita: la
   * posizione vera di adesso. `null` finché il bersaglio non è stato visto. */
  function storDestinazione(pg, moto, vera, A, assi, r) {
    if (moto.verso === 'orbit') return vera;
    const s = globale('sol') || {};
    if (STOR_LUOGHI.includes(moto.verso)) {
      const L = s.L || 800, H = s.H || 600;
      const fx = { center: 0.5, left: 0.24, right: 0.76, top: 0.5, bottom: 0.5 }[moto.verso];
      const fy = { center: 0.48, left: 0.48, right: 0.48, top: 0.28, bottom: 0.7 }[moto.verso];
      // L'origine della scena (il Sole, o la Terra nel banco) sta qui sullo schermo
      const ox = (s.cx || L / 2) + (s.panX || 0), oy = (s.cy || H / 2) + (s.panY || 0);
      return v3.piu(dalloSchermo(assi, L * fx - ox, H * fy - oy), v3.per(assi.w, v3.punto(vera, assi.w)));
    }
    const b = stor.mosse.get(moto.verso) || stor.vere.get(moto.verso);
    if (!b) return null;
    const rMio = Math.max(pg.rMostrato || 0, r || 0, 2);
    const passo = ((b.r || 2) + rMio) * 1.3 * (moto.distanza || 1) + 8;
    let dx = 1, dy = 0, fondo = 0;
    const lato = moto.lato || 'auto';
    if (lato === 'left') dx = -1;
    else if (lato === 'above') { dx = 0; dy = -1; }
    else if (lato === 'below') { dx = 0; dy = 1; }
    else if (lato === 'front' || lato === 'behind') { dx = 0.45; dy = 0.3; fondo = lato === 'front' ? 1 : -1; }
    else if (lato === 'auto') {
      const d = v3.meno(A, b.scena);
      const cx = v3.punto(d, assi.ex), cy = -v3.punto(d, assi.su), n = Math.hypot(cx, cy);
      if (n > 1e-12) { dx = cx / n; dy = cy / n; }
    }
    let D = v3.piu(b.scena, dalloSchermo(assi, dx * passo, dy * passo));
    if (fondo) D = v3.piu(D, v3.per(assi.w, fondo * ((b.r || 2) + rMio) * 3 / assi.scala));
    return D;
  }

  /* Il punto di un viaggio da A a D quando ne è passata la frazione `u`.
   * Il percorso aggiunge la sua forma sul piano dello schermo: l'arco curva
   * verso l'alto, il saltello fa `giri` balzi, il giro della morte un anello
   * a metà strada, la spirale arriva girando attorno alla meta, lo zig-zag
   * ondeggia, il teletrasporto sparisce e ricompare (la misura la fa
   * `storRaggio3D`). Funzione pura. */
  function storPuntoViaggio(percorso, A, D, u, assi, giri) {
    const k = percorso === 'teleport' ? (u < 0.5 ? 0 : 1) : liscio(u);
    const d = v3.meno(D, A);
    const lx = v3.punto(d, assi.ex), ly = v3.punto(d, assi.su), L = Math.hypot(lx, ly);
    if (percorso === 'spiral' && L > 1e-12) {
      const n = Number(giri) > 0 ? Number(giri) : 1.25;
      const vx = -lx, vy = -ly, vz = -v3.punto(d, assi.w);
      const th = 2 * Math.PI * n * k, resto = 1 - k;
      const rx = (vx * Math.cos(th) - vy * Math.sin(th)) * resto, ry = (vx * Math.sin(th) + vy * Math.cos(th)) * resto;
      return v3.piu(D, v3.piu(v3.piu(v3.per(assi.ex, rx), v3.per(assi.su, ry)), v3.per(assi.w, vz * resto)));
    }
    let P = v3.misto(A, D, k);
    if (L < 1e-12) return P;
    // la perpendicolare sul piano dello schermo, girata verso l'alto
    let qx = -ly / L, qy = lx / L;
    if (qy < 0) { qx = -qx; qy = -qy; }
    const lungo = v3.piu(v3.per(assi.ex, lx / L), v3.per(assi.su, ly / L));
    const traverso = v3.piu(v3.per(assi.ex, qx), v3.per(assi.su, qy));
    if (percorso === 'arc') P = v3.piu(P, v3.per(traverso, L * 0.32 * Math.sin(Math.PI * u)));
    else if (percorso === 'hop') {
      const n = Number(giri) > 0 ? Math.round(Number(giri)) : 3;
      P = v3.piu(P, v3.per(assi.su, L * 0.22 * Math.abs(Math.sin(Math.PI * n * u))));
    } else if (percorso === 'zigzag') {
      const n = Number(giri) > 0 ? Math.round(Number(giri)) : 3;
      P = v3.piu(P, v3.per(traverso, L * 0.14 * Math.sin(2 * Math.PI * n * u) * Math.sin(Math.PI * u)));
    } else if (percorso === 'loop') {
      const n = Number(giri) > 0 ? Math.round(Number(giri)) : 1;
      const rho = Math.max(L * 0.16, 36 / assi.scala), th = 2 * Math.PI * n * k;
      P = v3.piu(P, v3.piu(v3.per(lungo, rho * Math.sin(th)), v3.per(traverso, rho * (1 - Math.cos(th)))));
    }
    return P;
  }

  // Se i corpi sono stati letti in un altro banco (sistema ↔ Terra e Luna),
  // le loro unità non c'entrano più: si dimentica tutto e si riparte da dove
  // ogni astro si trova adesso.
  function storBanco3D() {
    const s = globale('sol');
    const banco = !!(s && s.vicino);
    if (stor.vicinoVere !== banco) {
      stor.vicinoVere = banco;
      stor.vere.clear(); stor.mosse.clear(); stor.ritorni.clear();
      for (const pg of stor.personaggi.values()) { pg.ultimoPunto3D = null; if (pg.moto) pg.moto.A = null; }
    }
    return s;
  }

  /* Il gancio della posizione (app.js: `solDisegna`, `solDisegnaVicino`,
   * `solScenaLuna`, `solScenaLunaPianeta`). `vera` è il punto della scena in
   * cui l'app metterebbe il corpo, `r` il suo raggio disegnato. */
  function storScena3D(id, vera, r) {
    if ((!stor.personaggi.size && !stor.ritorni.size) || !vera) return vera;
    const s = storBanco3D();
    const cid = storCanonico(id);
    stor.vere.set(cid, { scena: vera, r: r || 0 });
    const pg = stor.personaggi.get(cid);
    if (!pg) {
      const rt = stor.ritorni.get(cid);
      if (!rt) return storLunaReagisce(cid, vera, s);
      const f = 1 - liscio((adesso() - rt.da) / STOR_RITORNO_MS);
      if (f <= 0) { stor.ritorni.delete(cid); return vera; }
      if (!rt.delta) return vera;
      const P = v3.piu(vera, v3.per(rt.delta, f));
      stor.mosse.set(cid, { scena: P, r: r || 0 });
      return P;
    }
    const assi = storAssiSchermo(s);
    let base = vera;
    // Un viaggio verso un luogo dell'universo vive solo nella scala
    // cosmica: tornati nella 3D, il personaggio è di nuovo a casa
    if (pg.moto && luogoCosmico(pg.moto.verso)) pg.moto = null;
    const m = pg.moto;
    if (m) {
      if (!m.A) m.A = pg.ultimoPunto3D || vera;
      const D = storDestinazione(pg, m, vera, m.A, assi, r);
      if (D) {
        base = storPuntoViaggio(m.percorso, m.A, D, m.u, assi, m.giri);
        if (m.u >= 1 && m.verso === 'orbit') pg.moto = null;   // tornato a casa
      } else base = m.A;
    }
    pg.ultimoPunto3D = base;
    pg.ultimoDelta = v3.meno(base, vera);
    // Le animazioni spostano il corpo vero, in raggi del corpo mostrato, e
    // così fa chi parla (v427): annuisce, ondeggia, sottolinea le parole
    const an = storAnimazioniDi(pg);
    const mp = storMotoParlato(pg, stor.orologio);
    let P = base;
    const ddx = an.dx + mp.dx, ddy = an.dy + mp.dy;
    if (ddx || ddy) {
      const R = Math.max(pg.rMostrato || r || 0, 4);
      P = v3.piu(base, dalloSchermo(assi, ddx * R, ddy * R));
    }
    // Il passo di lato perché nessuno copra un altro personaggio (v428,
    // `storPalco3D`), in pixel dello schermo
    if (pg.scarto && (pg.scarto.x || pg.scarto.y)) {
      const passo = dalloSchermo(assi, pg.scarto.x, pg.scarto.y);
      P = v3.piu(P, passo);
      // uscendo di scena torna a posto anche dal passo di lato, senza scatti
      pg.ultimoDelta = v3.piu(pg.ultimoDelta, passo);
    }
    stor.mosse.set(cid, { scena: P, r: pg.rMostrato || r || 0 });
    return P;
  }

  /* Le lune vere reagiscono al loro pianeta (v430, §6-sexies): una luna che
   * non è un personaggio, attorno a un pianeta che lo è, si stringe a lui
   * quando ha paura, si allarga quando si sorprende, trema quando si
   * arrabbia, balla quando è contento. Lo spostamento entra nella scena
   * prima della proiezione, come i viaggi; il centro è il pianeta **come
   * è mostrato** (anche lui può essere in viaggio). */
  const STOR_PADRI = { Moon: 'Earth', Phobos: 'Mars', Deimos: 'Mars', Charon: 'Pluto' };
  function storPadreDi(id) {
    if (STOR_PADRI[id]) return STOR_PADRI[id];
    const l = tabella('SOL_LUNE').find(x => x.id === id);
    return l && l.idPianeta ? storCanonico(l.idPianeta) : null;
  }
  function storLunaReagisce(id, vera, s) {
    const padre = storPadreDi(id);
    const pp = padre && stor.personaggi.get(padre);
    if (!pp || pp.nascosto || !pp.reazione) return vera;
    const centro = (stor.mosse.get(padre) || {}).scena;
    if (!centro) return vera;
    const re = pp.reazione;
    let P = v3.piu(centro, v3.per(v3.meno(vera, centro), re.luneK));
    if (!stor.ridotto && (re.luneTremito || re.luneBalla || re.luneCala)) {
      const R = Math.max(pp.rMostrato || 0, 4), tt = stor.orologio, f = (seme(id) % 628) / 100;
      const dx = Math.sin(tt * 0.06 + f) * 0.08 * re.luneTremito;
      const dy = Math.cos(tt * 0.071 + f) * 0.06 * re.luneTremito
        - Math.abs(Math.sin(tt / 240 + f)) * 0.15 * re.luneBalla + 0.2 * re.luneCala;   // y in giù
      P = v3.piu(P, dalloSchermo(storAssiSchermo(s), dx * R, dy * R));
    }
    return P;
  }

  /* Il gancio della misura (`solDisegna`, `solDisegnaVicino`,
   * `solRaggioLuna`, `solRaggioLunaPianeta`, `solRaggioSole`). Con
   * `size: auto` l'astro cresce, con un pop elastico, fino a portare un volto
   * leggibile; poi la scala chiesta, il battito di `pulse` e il
   * rimpicciolirsi del teletrasporto. */
  function storRaggio3D(id, r) {
    if ((!stor.personaggi.size && !stor.ritorni.size) || !(r > 0)) return r;
    const s = storBanco3D();
    const cid = storCanonico(id);
    if (cid === 'Sun' && !(s && s.vicino)) stor.vere.set('Sun', { scena: { x: 0, y: 0, z: 0 }, r });
    const pg = stor.personaggi.get(cid);
    if (!pg) {
      const rt = stor.ritorni.get(cid);
      if (!rt) return r;
      const f = 1 - liscio((adesso() - rt.da) / STOR_RITORNO_MS);
      if (f <= 0) { stor.ritorni.delete(cid); return r; }
      return r * (1 + (rt.k - 1) * f);
    }
    let k = 1;
    if (pg.misura === 'auto') {
      // La prospettiva (v428): chi è più vicino alla camera è più grande
      // (`storPalco3D`); prima tutti crescevano alla stessa misura
      k *= pg.prosp || 1;
      const voluto = STOR_VOLTO_3D_PX / pg.profilo.scala;
      if (voluto > r) {
        const u = stor.ridotto ? 1 : Math.max(0, Math.min(1, (stor.orologio - pg.comparsoDa) / STOR_CRESCITA_MS));
        // fuori-indietro: sfora appena e si posa, come il pop del volto
        const c1 = 1.6, v = u - 1, pop = u >= 1 ? 1 : 1 + (c1 + 1) * v * v * v + c1 * v * v;
        k *= 1 + (voluto / r - 1) * Math.max(0, pop);
      }
    }
    k *= storScalaDi(pg) * storAnimazioniDi(pg).k * storMotoParlato(pg, stor.orologio).k;
    const m = pg.moto;
    if (m && m.percorso === 'teleport' && m.u > 0 && m.u < 1 && !stor.ridotto) k *= Math.max(0.04, Math.abs(1 - 2 * m.u));
    pg.rVero = r; pg.rMostrato = r * k;
    return r * k;
  }

  // ===================================================================
  // 6. Il disegno
  // ===================================================================

  /* Lo stile: la **fiaba d'inchiostro**. Ogni tratto è un pennino indaco
   * scuro (non nero: il nero puro sopra a un cielo notturno buca la tela),
   * a spessore variabile — più grosso dove il tratto «appoggia», sottile
   * dove sfugge —, i colori sono stesure piatte con **un'ombra sola a taglio
   * netto**, come la cel animation. Sotto a ogni tratto passa un alone
   * color panna, che è quello che tiene leggibile un tratto appoggiato sulla
   * parte buia di una falce di Luna.
   *
   * Dalla v417 i volti sono quelli degli **«occhioni di luna»**, su un
   * disegno di riferimento chiesto da chi usa l'app: occhi grandi a mandorla
   * con gli angoli a punta, l'iride scura che quasi li riempie e ha un anello
   * chiaro al bordo, nei riflessi una **falce di luna** e una stellina a
   * quattro punte; la riga delle ciglia piena, con la codina all'insù, e le
   * ciglia arricciate (per lei); sopracciglia sottili e alte, un nasino fatto
   * d'ombra, le guance con le tre lineette, un neo. Il corpo ha perso il
   * retino a puntini (faceva rumore accanto agli occhi): un'ombra a falce dal
   * bordo appena sfumato, i crateri piatti, il bordo panna fra due fili. */
  const INCHIOSTRO = '#1c1236';
  const ALONE = 'rgba(255, 248, 235, 0.62)';
  // Il velo più leggero dei tratti del volto (v417): l'alone pieno attorno
  // agli occhi grandi faceva di nuovo gli occhiali
  const ALONE_TENUE = 'rgba(255, 248, 235, 0.34)';

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
  function mescolaColori(a, b, k) {
    const ma = /^#?([0-9a-f]{6})$/i.exec(a || ''), mb = /^#?([0-9a-f]{6})$/i.exec(b || '');
    if (!ma || !mb) return a || b || '#e2e8f0';
    const na = parseInt(ma[1], 16), nb = parseInt(mb[1], 16);
    const c = sh => Math.round(mix((na >> sh) & 255, (nb >> sh) & 255, k)).toString(16).padStart(2, '0');
    return '#' + c(16) + c(8) + c(0);
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

  // Una fila di punti come tratto aperto (il bordo di una palpebra)
  function polilinea(ctx, punti) {
    ctx.beginPath();
    punti.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  }
  // Il punto e la direzione a una frazione `f` lungo una fila di punti
  function lungo(punti, f) {
    const i = Math.max(0, Math.min(punti.length - 2, Math.floor(f * (punti.length - 1))));
    const [x1, y1] = punti[i], [x2, y2] = punti[i + 1];
    const k = f * (punti.length - 1) - i;
    return { x: mix(x1, x2, k), y: mix(y1, y2, k), tx: x2 - x1, ty: y2 - y1 };
  }

  /* Le ciglia (v417, gli «occhioni di luna»). Per lei un ventaglio di
   * colpi di pennino lungo la metà esterna della palpebra: partono verso
   * fuori e si arricciano all'insù, sempre più lunghi verso l'angolo, e due
   * o tre piccoli sotto; per lui due colpi corti all'angolo. Sono loro, più
   * di ogni altra cosa, a dire da lontano «è una lei». `bordo` va da
   * sinistra a destra; `chiuso` le gira all'ingiù (il sonno, il battito). */
  function disegnaCiglia(ctx, occ, profilo, bordo, chiuso) {
    const lei = profilo.genere === 'f';
    const lato = occ.lato;
    ctx.fillStyle = INCHIOSTRO;
    // il bordo va da sinistra a destra: l'angolo esterno è a destra per
    // l'occhio destro, a sinistra per il sinistro
    const fr = f => lato > 0 ? f : 1 - f;
    const giu = chiuso ? 1 : -1;
    const colpo = (f, lun, apre, w) => {
      const p = lungo(bordo, fr(f));
      // la normale al bordo, verso fuori dall'occhio (su, o giù se chiuso)
      const tl = Math.hypot(p.tx, p.ty) || 1;
      let nx = -p.ty / tl, ny = p.tx / tl;
      if (ny * giu < 0) { nx = -nx; ny = -ny; }
      // la direzione: dalla normale verso l'esterno, tanto più quanto `apre`
      const dx = nx * (1 - apre) + lato * apre, dy = ny * (1 - apre) + giu * apre * 0.15;
      const dl = Math.hypot(dx, dy) || 1;
      const ux = dx / dl, uy = dy / dl;
      const x2 = p.x + ux * lun + lato * lun * 0.18, y2 = p.y + uy * lun + giu * lun * 0.22;
      // parte piatta verso fuori, poi la punta si arriccia
      const qx = p.x + ux * lun * 0.55 + lato * lun * 0.32, qy = p.y + uy * lun * 0.55;
      tracciaPennino(ctx, p.x, p.y, qx, qy, x2, y2, w, u => 1 - u * 0.88);
      ctx.fill();
    };
    const w = Math.max(1, occ.rx * (lei ? 0.13 : 0.11));
    if (lei) {
      // raccolte all'angolo esterno, lunghe e arricciate (v418)
      // v425, come nel disegno della Luna sorridente: tre ciglia sole,
      // grosse e arricciate, e una sotto all'angolo. Poche e decise si
      // leggono anche su un volto piccolo; il ventaglio di cinque era un
      // grumo grigio
      const voci = [[0.72, 0.42, 0.4], [0.88, 0.56, 0.62], [1, 0.5, 0.9]];
      for (const [f, lun, apre] of voci) colpo(f, occ.rx * lun, apre, w * 1.35);
      if (!chiuso && occ.apertura) {
        const sotto = occ.apertura.sotto;
        for (const [f, lun] of [[0.9, 0.24]]) {
          const p = lungo(sotto, fr(f));
          const x2 = p.x + lato * lun * occ.rx * 0.55, y2 = p.y + lun * occ.rx;
          tracciaPennino(ctx, p.x, p.y, (p.x + x2) / 2 + lato * occ.rx * 0.03, (p.y + y2) / 2, x2, y2, w * 1.05, u => 1 - u * 0.85);
          ctx.fill();
        }
      }
    } else {
      colpo(0.86, occ.rx * 0.2, 0.55, w);
      colpo(0.97, occ.rx * 0.26, 0.8, w);
    }
  }

  /* La riga della palpebra di sopra: un tratto pieno che s'ingrossa verso
   * l'angolo esterno e lì scappa in una codina all'insù, come l'eyeliner
   * dei cartoni. Per lui più sottile e senza codina. */
  function rigaPalpebra(ctx, occ, punti, lei) {
    const n = punti.length;
    if (n < 2) return;
    const w = occ.rx * (lei ? 0.24 : 0.2);
    const lato = occ.lato;
    const su = [], giu = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = punti[i];
      const [xa, ya] = punti[Math.max(0, i - 1)], [xb, yb] = punti[Math.min(n - 1, i + 1)];
      const tl = Math.hypot(xb - xa, yb - ya) || 1;
      let nx = (yb - ya) / tl, ny = -(xb - xa) / tl;
      if (ny > 0) { nx = -nx; ny = -ny; }
      // da dentro (0) a fuori (1)
      const u = lato > 0 ? i / (n - 1) : 1 - i / (n - 1);
      const larg = Math.max(0.6, w * (0.25 + 0.75 * Math.pow(u, 0.8)) * Math.sin(Math.PI * Math.min(1, 0.06 + u * 0.94) * 0.5 + 0.35));
      su.push([x + nx * larg, y + ny * larg]); giu.push([x - nx * larg * 0.25, y - ny * larg * 0.25]);
    }
    ctx.beginPath();
    ctx.moveTo(su[0][0], su[0][1]);
    const fuori = lato > 0 ? n - 1 : 0;
    const ordine = lato > 0 ? [...su.keys()] : [...su.keys()].reverse();
    // il tratto di sopra fino all'angolo esterno, poi la codina, poi indietro sotto
    ctx.beginPath();
    ordine.forEach((i, k) => (k ? ctx.lineTo(su[i][0], su[i][1]) : ctx.moveTo(su[i][0], su[i][1])));
    if (lei) {
      const [cx, cy] = punti[fuori];
      ctx.quadraticCurveTo(cx + lato * occ.rx * 0.2, cy - occ.ry * 0.06, cx + lato * occ.rx * 0.36, cy - occ.ry * 0.3);
      ctx.quadraticCurveTo(cx + lato * occ.rx * 0.16, cy - occ.ry * 0.0, giu[fuori][0], giu[fuori][1]);
    }
    for (let k = ordine.length - 1; k >= 0; k--) ctx.lineTo(giu[ordine[k]][0], giu[ordine[k]][1]);
    ctx.closePath();
    ctx.fillStyle = INCHIOSTRO; ctx.fill();
  }

  function disegnaOcchio(ctx, occ, profilo, geom, t) {
    const ap = occ.apertura;
    const lei = profilo.genere === 'f';
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (!ap) {
      // Chiuso: una riga. Dalla risata è un arco all'insù (gli occhi che
      // ridono), dal sonno e dal battito la palpebra abbassata, all'ingiù.
      const riga = [];
      const yc = (occ.bordoSu + occ.bordoGiu) / 2;
      for (let i = 0; i <= 16; i++) {
        const u = -1 + i / 8;
        const x = occ.cx + u * occ.rx * 0.98;
        const y = occ.felici ? occ.cy + occ.ry * (0.18 - 0.85 * (1 - u * u))
          : yc + occ.ry * (0.32 * (1 - u * u) - 0.04) + occ.inclina * occ.ry * 0.3 * (-occ.lato * u);
        riga.push([x, y]);
      }
      const spessa = Math.max(2, occ.rx * (lei ? 0.24 : 0.22));
      ctx.strokeStyle = ALONE_TENUE; ctx.lineWidth = spessa + 2.2; polilinea(ctx, riga); ctx.stroke();
      ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = spessa; polilinea(ctx, riga); ctx.stroke();
      disegnaCiglia(ctx, occ, profilo, riga, !occ.felici);
      ctx.restore();
      return;
    }
    const forma = () => {
      ctx.beginPath();
      ap.sopra.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (let i = ap.sotto.length - 1; i >= 0; i--) ctx.lineTo(ap.sotto[i][0], ap.sotto[i][1]);
      ctx.closePath();
    };
    // L'ombretto di lei: una velatura fra l'occhio e la piega della palpebra
    if (profilo.trucco) {
      // sfumata tutt'attorno, più carica sopra la riga delle ciglia
      const ox = occ.cx + occ.lato * occ.rx * 0.15, oy = occ.cy - occ.ry * 0.35;
      const ombr = ctx.createRadialGradient(ox, oy, occ.rx * 0.3, ox, oy, occ.rx * 1.3);
      ombr.addColorStop(0, rgba(profilo.trucco, 0.55)); ombr.addColorStop(0.55, rgba(profilo.trucco, 0.3)); ombr.addColorStop(1, rgba(profilo.trucco, 0));
      ctx.fillStyle = ombr;
      ctx.beginPath(); ctx.ellipse(ox, oy, occ.rx * 1.3, occ.ry * 1.05, 0, 0, Math.PI * 2); ctx.fill();
    }
    // L'ombretto lilla (v418): una stesura piatta e tenue che segue la
    // palpebra di sopra e sale verso l'angolo esterno, come nel disegno di
    // riferimento; per lui appena accennata
    if (occ.chiusura < 0.8) {
      const pelle = profilo.pelle || '#e2e8f0';
      const lilla = profilo.trucco || '#a78bfa';
      const alto = ap.sopra.map(([x, y]) => {
        const u = (x - occ.cx) / occ.rx * occ.lato;   // −1 dentro, 1 fuori
        return [occ.cx + (x - occ.cx) * 1.08, y - occ.ry * (0.2 + 0.22 * Math.max(0, u + 0.3))];
      });
      ctx.beginPath();
      alto.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (let i = ap.sopra.length - 1; i >= 0; i--) ctx.lineTo(ap.sopra[i][0], ap.sopra[i][1]);
      ctx.closePath();
      ctx.fillStyle = rgba(mescolaColori(pelle, lilla, 0.45), lei ? 0.55 : 0.28); ctx.fill();
    }
    // Il bianco: avorio, piatto, con l'ombra lavanda della palpebra in alto
    const bianco = ctx.createLinearGradient(occ.cx, occ.cy - occ.ry, occ.cx, occ.cy + occ.ry);
    // v425: bianco vero, non avorio: è il contrasto bianco–iride–pupilla
    // che fa leggere lo sguardo da lontano
    bianco.addColorStop(0, '#e9e6f6'); bianco.addColorStop(0.28, '#ffffff'); bianco.addColorStop(1, '#ffffff');
    ctx.fillStyle = bianco;
    forma(); ctx.fill();
    ctx.save();
    forma(); ctx.clip();
    const ir = occ.iride;
    const pu = occ.pupilla;
    // L'iride (v418): un ovale piatto, alto, del suo colore con un'ombra a
    // falce dal lato opposto allo sguardo; la pupilla quasi la riempie. Niente
    // sfumature né fili: stesure piatte, come i cartoni di una volta.
    const OV = 1.16;
    const ovale = (x, y, r) => { ctx.beginPath(); ctx.ellipse(x, y, r, r * OV, 0, 0, Math.PI * 2); };
    // v425, come nel disegno di riferimento: l'iride scura in alto e
    // luminosa in basso, il colore che «si accende» sotto alla pupilla
    const sfum = ctx.createLinearGradient(ir.x, ir.y - ir.r * OV, ir.x, ir.y + ir.r * OV);
    sfum.addColorStop(0, scurisci(profilo.iride, 0.35)); sfum.addColorStop(0.55, profilo.iride); sfum.addColorStop(1, schiarisci(profilo.iride, 0.35));
    ovale(ir.x, ir.y, ir.r); ctx.fillStyle = sfum; ctx.fill();
    // l'ombra della palpebra sull'iride: una falce più scura in alto
    ctx.save(); ovale(ir.x, ir.y, ir.r); ctx.clip();
    ctx.fillStyle = scurisci(profilo.iride, 0.32);
    ctx.beginPath(); ctx.ellipse(ir.x, ir.y - ir.r * 0.95, ir.r * 1.3, ir.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const pulsa = 1 + 0.12 * Math.sin(t / 140);
    if (geom.cuori > 0.5) {
      // l'amore: la pupilla è un cuore rosso che batte
      cuore(ctx, pu.x, pu.y + ir.r * 0.05, ir.r * 0.66 * pulsa);
      ctx.fillStyle = '#ff3d6e'; ctx.fill();
      ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(0.7, ir.r * 0.09); ctx.stroke();
    } else if (geom.stelle > 0.5) {
      // l'entusiasmo: la pupilla è una stella dorata che pulsa
      ctx.fillStyle = '#ffe066';
      stella(ctx, pu.x, pu.y, ir.r * 0.8 * pulsa, ir.r * 0.36 * pulsa, 5, -Math.PI / 2);
      ctx.fill();
      ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(0.7, ir.r * 0.08); ctx.stroke();
    } else {
      ovale(pu.x, pu.y, pu.r); ctx.fillStyle = '#100a24'; ctx.fill();
    }
    // il contorno dell'iride, d'inchiostro
    ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(0.9, ir.r * 0.09);
    ctx.beginPath(); ctx.ellipse(ir.x, ir.y, ir.r * 0.97, ir.r * 0.97 * OV, 0, 0, Math.PI * 2); ctx.stroke();
    // I riflessi: un tondo grande e un puntino, color panna
    ctx.fillStyle = '#ffffff';
    for (const l of occ.luci) { ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); ctx.fill(); }
    // L'ombra della palpebra di sopra sul bianco: dà profondità all'occhio
    ctx.strokeStyle = 'rgba(80, 60, 140, 0.16)'; ctx.lineWidth = occ.ry * 0.26;
    polilinea(ctx, ap.sopra); ctx.stroke();
    // Gli occhi lucidi: un velo d'acqua sul bordo di sotto
    if (geom.lucidi > 0.5) {
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)'; ctx.lineWidth = Math.max(1.2, occ.ry * 0.22);
      polilinea(ctx, ap.sotto); ctx.stroke();
    }
    ctx.restore();
    // Il contorno: un filo sotto, la riga piena della palpebra sopra
    // v425: il contorno di sotto è un tratto pieno, come quello di sopra
    // appena più sottile: l'occhio è una forma chiusa e netta
    ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(1.2, occ.rx * 0.11);
    polilinea(ctx, ap.sotto); ctx.stroke();
    rigaPalpebra(ctx, occ, ap.sopra, lei);
    // Gli occhi che sorridono spingono su le guance: una piega sotto
    if (occ.arco > 0.45) {
      const piega = ap.sotto.filter((_, i, a) => i > a.length * 0.22 && i < a.length * 0.78)
        .map(([x, y]) => [occ.cx + (x - occ.cx) * 0.7, y + occ.ry * 0.42]);
      ctx.strokeStyle = rgba(INCHIOSTRO, 0.3 * Math.min(1, (occ.arco - 0.45) * 3)); ctx.lineWidth = Math.max(0.7, occ.rx * 0.06);
      polilinea(ctx, piega); ctx.stroke();
    }
    disegnaCiglia(ctx, occ, profilo, ap.sopra, false);
    ctx.restore();
  }

  /* La bocca (riscritta nella v426, sul disegno della Luna sorridente). Il
   * tratto è sempre d'inchiostro pieno, per lei e per lui: fino alla v425
   * la bocca chiusa di lei erano due labbra colorate, e da preoccupata,
   * triste o pensierosa diventava un grumo rosa che non diceva niente. Le
   * labbra restano come una velatura sotto alla riga. La bocca aperta è una
   * forma campionata (`bordi`): il bordo di sopra e quello di sotto, con
   * gli angoli che salgono nel sorriso e scendono nel broncio, e il labbro
   * di sopra che trema (`onda`) nella paura e nel pianto. Dentro, il fondo
   * scuro, la lingua e i denti di sopra; con `denti` due file di denti che
   * si separano quando il personaggio parla (la rabbia, il ghigno). */
  function bordiBocca(b) {
    const N = 18, sopra = [], sotto = [];
    const denti = b.denti > 0.5;
    const ang = b.y - b.curva * b.larg * 0.42;
    const cSu = b.y - b.aper * (0.55 - b.tondo * 0.3) + b.curva * b.larg * 0.28;
    const cGiu = b.y + b.aper * 1.6 + b.curva * b.larg * 0.5;
    for (let i = 0; i <= N; i++) {
      const u = -1 + 2 * i / N;
      const x = b.x + u * b.larg;
      if (denti) {
        // i denti stretti: un rettangolo dagli angoli tondi, piegato
        // all'ingiù (la rabbia) o all'insù (il ghigno) lungo la sua mezzeria
        const mezzo = b.y - b.curva * b.larg * 0.6 * u * u;
        const h = b.aper * 0.5 * Math.pow(1 - u * u, 0.22);
        sopra.push([x, mezzo - h]); sotto.push([x, mezzo + h]);
        continue;
      }
      // sopra la quadratica fra i due angoli (la stessa di prima della
      // v426); sotto un fondo più pieno e tondo, la «D» dei cartoni, che
      // non scende a punta come una V
      const kSu = (1 - u * u) / 2, kGiu = Math.pow(1 - u * u, 0.6) / 2;
      const trema = Math.sin(u * Math.PI * 3) * b.larg * 0.07 * (b.onda || 0) * (1 - u * u);
      sopra.push([x, ang + (cSu - ang) * kSu + trema]);
      sotto.push([x, ang + (cGiu - ang) * kGiu]);
    }
    return { sopra, sotto };
  }
  function disegnaBocca(ctx, b, R, profilo) {
    ctx.save();
    // La bocca di traverso (`storta`): si gira attorno al suo centro, e
    // l'angolo che sale è quello di destra per `storta` > 0
    if (b.storta) {
      ctx.translate(b.x, b.y); ctx.rotate(-b.storta * 0.32); ctx.translate(-b.x, -b.y);
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const lei = !!(profilo && profilo.genere === 'f' && profilo.labbra);
    const spessore = Math.max(2, b.larg * 0.17);
    const angoli = b.y - b.curva * b.larg * 0.5;
    const fossette = () => {
      // le fossette agli angoli di un sorriso largo (o le pieghe del broncio)
      if (Math.abs(b.curva) < 0.45 || (b.onda || 0) > 0.2) return;
      const verso = b.curva > 0 ? -1 : 1;
      const yAng = b.aper < 1 ? angoli : b.y - b.curva * b.larg * 0.42;
      ctx.strokeStyle = INCHIOSTRO;
      ctx.lineWidth = spessore * 0.75;
      ctx.beginPath();
      for (const lato of [-1, 1]) {
        const x = b.x + lato * b.larg;
        ctx.moveTo(x - lato * b.larg * 0.08, yAng + verso * b.larg * 0.14);
        ctx.quadraticCurveTo(x + lato * b.larg * 0.1, yAng, x + lato * b.larg * 0.04, yAng - verso * b.larg * 0.16);
      }
      ctx.stroke();
    };
    if (b.aper < Math.max(1, b.larg * 0.08)) {
      const riga = () => {
        ctx.beginPath();
        const n = 16;
        for (let i = 0; i <= n; i++) {
          const u = i / n, x = b.x - b.larg + 2 * b.larg * u;
          // la stessa quadratica di prima della v426: angoli, e il centro più giù di 1,3 volte
          const y = angoli + b.curva * b.larg * 1.3 * 2 * u * (1 - u) +
            Math.sin(u * Math.PI * 4) * b.larg * 0.12 * (b.onda || 0);
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
      };
      // le labbra di lei: una velatura sotto alla riga, mai un disegno a sé
      if (lei && (b.onda || 0) < 0.4) {
        ctx.strokeStyle = rgba(profilo.labbra, 0.55); ctx.lineWidth = spessore * 1.6;
        ctx.save(); ctx.translate(0, spessore * 0.75);
        ctx.beginPath();
        for (let i = 3; i <= 13; i++) {
          const u = i / 16, x = b.x - b.larg + 2 * b.larg * u;
          const y = angoli + b.curva * b.larg * 1.3 * 2 * u * (1 - u);
          if (i > 3) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke(); ctx.restore();
      }
      ctx.strokeStyle = ALONE; ctx.lineWidth = spessore + 2.6; riga(); ctx.stroke();
      ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = spessore; riga(); ctx.stroke();
      fossette();
      ctx.restore();
      return;
    }
    const tonda = b.tondo > 0.6 && !(b.denti > 0.5);
    const { sopra, sotto } = tonda ? { sopra: null, sotto: null } : bordiBocca(b);
    const traccia = () => {
      ctx.beginPath();
      if (tonda) { ctx.ellipse(b.x, b.y, b.larg, b.aper / 2, 0, 0, Math.PI * 2); return; }
      sopra.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (let i = sotto.length - 1; i >= 0; i--) ctx.lineTo(sotto[i][0], sotto[i][1]);
      ctx.closePath();
    };
    traccia();
    ctx.strokeStyle = ALONE; ctx.lineWidth = spessore + 2.6; ctx.stroke();
    const fondo = ctx.createLinearGradient(b.x, b.y - b.aper, b.x, b.y + b.aper);
    fondo.addColorStop(0, '#3a0c26'); fondo.addColorStop(1, '#7a1c3c');
    ctx.fillStyle = fondo; ctx.fill();
    ctx.save(); traccia(); ctx.clip();
    if (b.denti > 0.5) {
      // due file di denti che seguono i bordi: a bocca stretta si toccano,
      // parlando si separano e in mezzo si vede il buio
      const h = Math.max(b.aper * 0.42, b.larg * 0.16);
      const fila = (bordo, verso) => {
        ctx.beginPath();
        bordo.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        for (let i = bordo.length - 1; i >= 0; i--) ctx.lineTo(bordo[i][0], bordo[i][1] + verso * h);
        ctx.closePath();
        ctx.fillStyle = '#fffdf6'; ctx.fill();
        ctx.strokeStyle = rgba(INCHIOSTRO, 0.75); ctx.lineWidth = Math.max(0.8, spessore * 0.4);
        ctx.beginPath();
        bordo.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + verso * h) : ctx.moveTo(x, y + verso * h)));
        for (let k = -2; k <= 2; k++) {
          const x = b.x + k * b.larg * 0.36, y = lungo(bordo, (k * 0.36 + 1) / 2).y;
          ctx.moveTo(x, y); ctx.lineTo(x, y + verso * h);
        }
        ctx.stroke();
      };
      fila(sopra, 1); fila(sotto, -1);
    } else {
      // la lingua col suo riflesso, e i denti di sopra nei sorrisi e quando si apre bene
      ctx.fillStyle = '#e8577a';
      ctx.beginPath(); ctx.ellipse(b.x, b.y + b.aper * 0.78, b.larg * 0.66, b.aper * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255, 196, 214, 0.75)';
      ctx.beginPath(); ctx.ellipse(b.x - b.larg * 0.14, b.y + b.aper * 0.52, b.larg * 0.16, b.aper * 0.1, -0.3, 0, Math.PI * 2); ctx.fill();
      if (!tonda && (b.aper > b.larg * 0.42 || b.curva > 0.4) && b.curva > -0.2) {
        ctx.fillStyle = '#fffdf6';
        ctx.beginPath();
        sopra.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        for (let i = sopra.length - 1; i >= 0; i--) ctx.lineTo(sopra[i][0], sopra[i][1] + b.aper * 0.32);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
    ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = spessore;
    traccia(); ctx.stroke();
    fossette();
    ctx.restore();
  }

  /* Baffi e barba (solo lui). Stesure piatte nel colore dei peli, l'ombra
   * a taglio netto e il pennino attorno, come tutto il resto. La barba sta
   * sotto alla bocca (che le si disegna sopra), i baffi sopra. */
  function stesura(ctx, colore, traccia, R) {
    traccia(); ctx.strokeStyle = ALONE; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.fillStyle = scurisci(colore, 0.22); ctx.fill();
    ctx.save(); traccia(); ctx.clip();
    ctx.translate(-R * 0.03, -R * 0.045); traccia(); ctx.fillStyle = colore; ctx.fill();
    ctx.restore();
    traccia(); ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(1, R * 0.028); ctx.stroke();
  }
  function disegnaBarba(ctx, geom, profilo) {
    const { R } = geom, b = geom.bocca;
    const x = b.x, cy = geom.cy;
    const tipo = profilo.barba;
    if (tipo === 'ispida') {
      // la barba di tre giorni: puntini sulla mascella
      ctx.fillStyle = rgba(profilo.peli, 0.6);
      const st = { s: 11 };
      ctx.beginPath();
      for (let k = 0; k < 46; k++) {
        const a = Math.PI * (0.12 + 0.76 * dado(st)), d = R * (0.62 + 0.3 * dado(st));
        const px = x + Math.cos(a) * d * 0.95, py = cy + 0.18 * R + Math.sin(a) * d * 0.82;
        if (Math.abs(px - x) < b.larg * 1.15 && Math.abs(py - b.y) < R * 0.12) continue;
        const r = Math.max(0.5, R * 0.016);
        ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, Math.PI * 2);
      }
      ctx.fill();
      return;
    }
    if (tipo === 'pizzetto') {
      stesura(ctx, profilo.peli, () => {
        ctx.beginPath();
        ctx.moveTo(x - R * 0.17, b.y + R * 0.15);
        ctx.quadraticCurveTo(x, b.y + R * 0.1, x + R * 0.17, b.y + R * 0.15);
        ctx.quadraticCurveTo(x + R * 0.16, b.y + R * 0.3, x, b.y + R * 0.36);
        ctx.quadraticCurveTo(x - R * 0.16, b.y + R * 0.3, x - R * 0.17, b.y + R * 0.15);
        ctx.closePath();
      }, R);
      return;
    }
    // folta (il re degli dèi) e onde (il dio del mare): una nuvola a riccioli
    // attorno al mento, con il buco per la bocca
    const onde = tipo === 'onde';
    const ax = R * (onde ? 0.52 : 0.6), ay = R * (onde ? 0.72 : 0.56), oy = cy + R * 0.3;
    const traccia = () => {
      ctx.beginPath();
      const n = onde ? 7 : 8;
      const a0 = Math.PI * 0.08, a1 = Math.PI * 0.92;
      const punto = a => [x + Math.cos(a) * ax, oy + Math.sin(a) * ay * (onde ? 1 - 0.25 * Math.abs(Math.cos(a)) : 1)];
      ctx.moveTo(...punto(a0));
      for (let k = 1; k <= n; k++) {
        const a = mix(a0, a1, k / n), am = mix(a0, a1, (k - 0.5) / n);
        const [mx, my] = punto(am);
        const gonfio = onde ? 1.16 : 1.13;
        ctx.quadraticCurveTo(x + (mx - x) * gonfio, oy + (my - oy) * gonfio, ...punto(a));
      }
      // il bordo di dentro: sotto alla bocca, lasciando le guance libere
      ctx.quadraticCurveTo(x - ax * 0.7, oy + R * 0.02, x - b.larg * 1.2, b.y + R * 0.06);
      ctx.quadraticCurveTo(x, b.y + R * 0.3, x + b.larg * 1.2, b.y + R * 0.06);
      ctx.quadraticCurveTo(x + ax * 0.7, oy + R * 0.02, ...punto(a0));
      ctx.closePath();
    };
    stesura(ctx, profilo.peli, traccia, R);
    // qualche ricciolo dentro
    ctx.strokeStyle = rgba(onde ? '#38bdf8' : scurisci(profilo.peli, 0.4), 0.7); ctx.lineWidth = Math.max(0.8, R * 0.018);
    ctx.beginPath();
    for (const [dx, dy, s] of [[-0.32, 0.62, 1], [0, 0.78, -1], [0.32, 0.62, 1], [-0.16, 0.88, -1], [0.16, 0.88, 1]]) {
      const px = x + dx * R, py = cy + dy * R;
      if (onde) { ctx.moveTo(px - R * 0.08, py); ctx.quadraticCurveTo(px - R * 0.03, py - R * 0.07, px, py); ctx.quadraticCurveTo(px + R * 0.04, py + R * 0.07, px + R * 0.09, py); }
      else ctx.moveTo(px + R * 0.06, py), ctx.arc(px, py, R * 0.06, 0, Math.PI * (s > 0 ? 1.3 : -1.3), s < 0);
    }
    ctx.stroke();
  }
  function disegnaBaffi(ctx, geom, profilo) {
    const { R } = geom, b = geom.bocca;
    const x = b.x, y = geom.naso.y + R * 0.07;
    const tipo = profilo.baffi;
    for (const lato of [-1, 1]) {
      stesura(ctx, profilo.peli, () => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        if (tipo === 'manubrio') {
          // sottili, con le punte arricciate all'insù
          ctx.quadraticCurveTo(x + lato * R * 0.2, y - R * 0.03, x + lato * R * 0.36, y + R * 0.04);
          ctx.quadraticCurveTo(x + lato * R * 0.48, y + R * 0.05, x + lato * R * 0.47, y - R * 0.06);
          ctx.quadraticCurveTo(x + lato * R * 0.45, y - R * 0.11, x + lato * R * 0.41, y - R * 0.07);
          ctx.quadraticCurveTo(x + lato * R * 0.43, y - R * 0.01, x + lato * R * 0.35, y + R * 0.01);
          ctx.quadraticCurveTo(x + lato * R * 0.2, y + R * 0.1, x, y + R * 0.07);
        } else if (tipo === 'spioventi') {
          // da tricheco: scendono ai lati della bocca
          ctx.quadraticCurveTo(x + lato * R * 0.22, y - R * 0.04, x + lato * R * 0.3, y + R * 0.08);
          ctx.quadraticCurveTo(x + lato * R * 0.34, y + R * 0.2, x + lato * R * 0.3, y + R * 0.26);
          ctx.quadraticCurveTo(x + lato * R * 0.2, y + R * 0.16, x, y + R * 0.1);
        } else {
          // folti, a nuvola
          ctx.quadraticCurveTo(x + lato * R * 0.12, y - R * 0.06, x + lato * R * 0.22, y - R * 0.01);
          ctx.quadraticCurveTo(x + lato * R * 0.36, y - R * 0.03, x + lato * R * 0.42, y + R * 0.08);
          ctx.quadraticCurveTo(x + lato * R * 0.32, y + R * 0.15, x + lato * R * 0.2, y + R * 0.12);
          ctx.quadraticCurveTo(x + lato * R * 0.1, y + R * 0.15, x, y + R * 0.1);
        }
        ctx.closePath();
      }, R);
    }
  }

  // Le sopracciglia: per lei un tratto sottile e arcuato d'inchiostro, per
  // lui un tratto folto nel colore dei peli (o d'inchiostro)
  const profiloCiglioFolto = u => (0.7 + 0.55 * Math.sin(Math.PI * (0.12 + 0.7 * u))) * (1 - 0.62 * u * u);
  function disegnaSopracciglia(ctx, geom, profilo) {
    const peli = (profilo.baffi || profilo.barba) ? profilo.peli : INCHIOSTRO;
    for (const c of geom.cigli) {
      const p = c.folto ? profiloCiglioFolto : profiloCiglio;
      tracciaPennino(ctx, c.x1, c.y1, c.qx, c.qy, c.x2, c.y2, c.spessore, p);
      ctx.strokeStyle = ALONE; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.fillStyle = c.folto ? peli : INCHIOSTRO; ctx.fill();
      if (c.folto && peli !== INCHIOSTRO) { ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(0.8, c.spessore * 0.14); ctx.stroke(); }
    }
  }

  /* Il volto girato (v432). Quando la regia gira attorno al personaggio
   * (`story_camera { mode: orbit }`, §7-ter) la camera vera si sposta, e il
   * volto non può restare sempre dritto verso chi guarda: dipinto sulla
   * sfera, guarda dove guardava quando la camera è partita. Visto di lato si
   * vede un occhio solo e un pezzo dell'altro, schiacciato sul bordo; da
   * dietro non si vede più niente del volto, solo la nuca (l'astro).
   * Ogni tratto ha una sua longitudine sulla sfera (dove sta il suo centro
   * sul disco): girando di `yaw` il suo centro va a R·cosφ·sin(λ + yaw) e
   * il tratto si accorcia in largo di cos(λ + yaw)/cos λ. Un tratto oltre il
   * bordo sparisce, e vicino al bordo sfuma; tutto è ritagliato sul disco.
   * `yaw` = 0 è il volto di sempre. Funzione pura: la provano le prove. */
  function storPosaSullaSfera(geom, x0, y0, yaw) {
    const { cx, cy, R } = geom;
    const v = Math.max(-0.95, Math.min(0.95, (y0 - cy) / R));
    const cphi = Math.sqrt(1 - v * v);
    const lam = Math.asin(Math.max(-0.98, Math.min(0.98, (x0 - cx) / (R * cphi))));
    const lam2 = lam + yaw;
    const c2 = Math.cos(lam2);
    if (c2 <= 0.02) return null;
    return { x: cx + R * cphi * Math.sin(lam2), sx: c2 / Math.max(0.25, Math.cos(lam)),
      alfa: Math.min(1, (c2 - 0.02) / 0.22), davanti: c2 };
  }
  function storDisegnaVolto(ctx, geom, profilo, alfa, t) {
    ctx.save();
    ctx.globalAlpha *= alfa;
    ctx.lineCap = 'round';
    const { cx, cy, R } = geom;
    const yaw = geom.yaw || 0;
    const gira = Math.abs(Math.sin(yaw)) > 1e-3 || Math.cos(yaw) < 0;
    if (gira) { ctx.beginPath(); ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2); ctx.clip(); }
    // Un tratto al suo posto sulla sfera girata (o così com'è, senza giro)
    const posa = (x0, y0, fn) => {
      if (!gira) { fn(); return; }
      const q = storPosaSullaSfera(geom, x0, y0, yaw);
      if (!q) return;
      ctx.save();
      ctx.globalAlpha *= q.alfa;
      ctx.translate(q.x, 0); ctx.scale(q.sx, 1); ctx.translate(-x0, 0);
      fn();
      ctx.restore();
    };
    // La rabbia: la fronte si fa rossa, dall'alto
    if (geom.rosso > 0.05) posa(cx, cy - R * 0.25, () => {
      const g = ctx.createLinearGradient(cx, cy - R, cx, cy + R * 0.1);
      g.addColorStop(0, `rgba(220, 38, 38, ${(0.45 * geom.rosso).toFixed(3)})`); g.addColorStop(1, 'rgba(220, 38, 38, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx, cy - R * 0.25, R * 0.92, R * 0.78, 0, 0, Math.PI * 2); ctx.fill();
    });
    // Le guance: un rossore sfumato e, sopra, le tre lineette sottili in
    // diagonale dei cartoni (v417: ci sono sempre, più fitte da contenti)
    const colGuance = geom.rosso > 0.5 ? '#ef4444' : profilo.guance;
    for (const g of geom.guance) posa(g.x, g.y, () => {
      const r = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.rx);
      // v425: un ovale quasi pieno, il bordo appena morbido (il disegno di
      // riferimento): si legge come rossore, non come una macchia sfocata
      r.addColorStop(0, rgba(colGuance, g.alfa)); r.addColorStop(0.72, rgba(colGuance, g.alfa * 0.9)); r.addColorStop(1, rgba(colGuance, 0));
      ctx.fillStyle = r;
      ctx.beginPath(); ctx.ellipse(g.x, g.y, g.rx, g.ry, 0, 0, Math.PI * 2); ctx.fill();
      if (g.linee) {
        ctx.strokeStyle = rgba(scurisci(colGuance, 0.12), Math.min(0.85, 0.35 + g.alfa));
        ctx.lineWidth = Math.max(0.7, g.rx * 0.055);
        ctx.beginPath();
        for (let k = -1; k <= 1; k++) {
          const x = g.x + k * g.rx * 0.26;
          ctx.moveTo(x + g.rx * 0.07, g.y - g.ry * 0.26); ctx.lineTo(x - g.rx * 0.07, g.y + g.ry * 0.26);
        }
        ctx.stroke();
      }
    });
    // Ogni occhio col suo sopracciglio, alla stessa longitudine: girando
    // restano insieme, e l'occhio che va dietro se li porta via tutti e due
    for (const occ of geom.occhi) posa(occ.cx, occ.cy, () => {
      disegnaOcchio(ctx, occ, profilo, geom, t);
      disegnaSopracciglia(ctx, Object.assign({}, geom, { cigli: geom.cigli.filter(c => c.lato === occ.lato) }), profilo);
    });
    // Il naso: per lui la virgola d'inchiostro col bulbo. Per lei, dalla
    // v425, niente naso né neo, come nel disegno di riferimento: occhi,
    // guance e bocca, e il volto si legge al primo colpo
    const n = geom.naso;
    if (!geom.lei) posa(n.x, n.y, () => {
      ctx.strokeStyle = rgba('#1c1236', 0.55); ctx.lineWidth = Math.max(0.9, n.r * 0.42);
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      ctx.beginPath(); ctx.arc(n.x, n.y - n.r * 0.9, n.r * 0.55, Math.PI * 0.6, Math.PI * 1.25); ctx.stroke();
    });
    posa(geom.bocca.x, geom.bocca.y, () => {
      if (profilo.barba) disegnaBarba(ctx, geom, profilo);
      disegnaBocca(ctx, geom.bocca, R, profilo);
      if (profilo.baffi) disegnaBaffi(ctx, geom, profilo);
    });
    ctx.restore();
  }

  // ===================================================================
  // 6-bis. I segni da fumetto
  // ===================================================================

  /* Il segno che accompagna un'espressione, come nei fumetti: le scintille
   * della gioia, i tre raggi della sorpresa, la lacrima che scende, la
   * goccia di sudore, le bolle del pensiero, le zeta del sonno, lo sbuffo
   * dell'infastidito e il luccichio sul dente del bullo. Le zeta sono
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
    } else if (segno === 'rabbia') {
      // la «vena» dei fumetti: quattro archi rossi a croce, che pulsano
      const pul = 1 + 0.14 * Math.abs(Math.sin(t / 160 * fermo));
      const x = cx + R * 0.74, y = cy - R * 0.74, s = R * 0.16 * pop * pul;
      for (const passata of [0, 1, 2]) {
        ctx.strokeStyle = passata === 0 ? ALONE : passata === 1 ? INCHIOSTRO : '#ef4444';
        ctx.lineWidth = Math.max(1.4, s * 0.34) + (passata === 0 ? 3.4 : passata === 1 ? 1.6 : 0);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + Math.PI / 4;
          const ux = Math.cos(a), uy = Math.sin(a);
          // un arco che volta le spalle al centro della croce
          ctx.moveTo(x + ux * s * 0.35 - uy * s * 0.55, y + uy * s * 0.35 + ux * s * 0.55);
          ctx.quadraticCurveTo(x + ux * s * 0.95, y + uy * s * 0.95, x + ux * s * 0.35 + uy * s * 0.55, y + uy * s * 0.35 - ux * s * 0.55);
        }
        ctx.stroke();
      }
    } else if (segno === 'cuori') {
      for (let k = 0; k < 3; k++) {
        const f = ridotto ? (k + 1) / 4 : ((t / 2200 + k / 3) % 1);
        const lato = k % 2 ? -1 : 1;
        const x = cx + lato * R * (0.72 + f * 0.25) + Math.sin(f * 7 + k) * R * 0.05, y = cy - R * (0.35 + f * 0.85);
        const s = R * (0.07 + f * 0.06) * pop;
        ctx.globalAlpha = Math.min(1, u * 1.6) * (f > 0.75 ? (1 - f) / 0.25 : Math.min(1, f * 5));
        cuore(ctx, x, y, s);
        ctx.strokeStyle = ALONE; ctx.lineWidth = Math.max(1, s * 0.25) + 2.4; ctx.stroke();
        ctx.fillStyle = '#ff4d7d'; ctx.fill();
        ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(1, s * 0.25); ctx.stroke();
      }
    } else if (segno === 'sbuffo') {
      // lo sbuffo di chi è infastidito: tre nuvolette che escono dall'angolo
      // della bocca (dalla parte verso cui è storta) e si disperdono
      const b = geom.bocca || { x: cx, y: cy + 0.4 * R, larg: R * 0.17 };
      const verso = (b.storta || 0) > 0 ? 1 : -1;
      for (let k = 0; k < 3; k++) {
        const f = ridotto ? (k + 1) / 4 : ((t / 1500 + k / 3) % 1);
        const x = b.x + verso * (b.larg * 1.1 + f * R * 0.55), y = b.y - f * R * 0.12 + Math.sin(f * 5 + k) * R * 0.03;
        const r = R * (0.05 + f * 0.08) * pop;
        ctx.globalAlpha = Math.min(1, u * 1.6) * (f > 0.6 ? (1 - f) / 0.4 : Math.min(1, f * 6));
        const nuvola = () => {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.moveTo(x + verso * r * 1.55, y - r * 0.15); ctx.arc(x + verso * r * 0.9, y - r * 0.15, r * 0.65, 0, Math.PI * 2);
          ctx.moveTo(x - verso * r * 0.1 + r * 0.6, y + r * 0.5); ctx.arc(x - verso * r * 0.1, y + r * 0.5, r * 0.6, 0, Math.PI * 2);
        };
        // prima i contorni e poi la stesura sopra: dei tre tondi resta il
        // bordo di fuori, e la nuvola è una sola
        ctx.strokeStyle = ALONE; ctx.lineWidth = Math.max(2, r * 0.44) + 4.8; nuvola(); ctx.stroke();
        ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(1.8, r * 0.44); nuvola(); ctx.stroke();
        ctx.fillStyle = '#f1f5f9'; nuvola(); ctx.fill();
      }
    } else if (segno === 'luccichio') {
      // il «ting!» sul dente del ghigno: una stella sottile che si accende
      // e si spegne all'angolo che sale, girando appena
      const b = geom.bocca || { x: cx, y: cy + 0.4 * R, larg: R * 0.2, storta: 0 };
      const verso = (b.storta || 0) >= 0 ? 1 : -1;
      const ang = -(b.storta || 0) * 0.32;
      const dx = verso * b.larg * 1.05, dy = -b.larg * 0.35;
      const x = b.x + dx * Math.cos(ang) - dy * Math.sin(ang), y = b.y + dx * Math.sin(ang) + dy * Math.cos(ang);
      const ciclo = ridotto ? 0.5 : ((t / 1800) % 1);
      const lampo = ridotto ? 1 : Math.max(0, Math.sin(Math.min(1, ciclo / 0.35) * Math.PI));
      const s = R * 0.21 * pop * (0.35 + 0.65 * lampo);
      if (s > 0.5) {
        stella(ctx, x, y, s, s * 0.18, 4, ciclo * 1.2 * fermo);
        ctx.strokeStyle = ALONE; ctx.lineWidth = Math.max(1, s * 0.14) + 2.2; ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(0.8, s * 0.12); ctx.stroke();
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

  // ===================================================================
  // 6-ter. Gli effetti speciali
  // ===================================================================

  /* Esplosioni, onde d'urto, fuochi d'artificio, cuori, fulmini… nello
   * stesso stile dei volti: stesure piatte, pennino d'inchiostro, l'esplosione
   * è il «KABOOM» a punte dei fumetti e non una palla di fuoco realistica.
   * Un effetto si attacca a un astro (e lo segue mentre si muove) o a un
   * posto dello schermo; dura `durata` millisecondi dell'orologio della
   * storia, quindi in pausa si ferma anche lui. Le particelle escono da un
   * dado seminato rifatto a ogni fotogramma: sono sempre le stesse, e un
   * salto indietro le ridisegna uguali.
   *
   * Col movimento ridotto un effetto è soltanto un alone che si accende e
   * si spegne: niente lampi a tutto schermo, niente sfarfallio dei fulmini.
   * Il lampo vero si accende **una volta**, mai a ripetizione. */
  function stellaPiena(ctx, x, y, r, punte, giro, rientro) {
    stella(ctx, x, y, r, r * (rientro || 0.45), punte, giro); ctx.fill();
  }
  function cuore(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.4, y + s * 0.05, x - s * 0.85, y - s * 1.05, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.85, y - s * 1.05, x + s * 1.4, y + s * 0.05, x, y + s * 0.9);
    ctx.closePath();
  }
  const COLORI_FESTA = ['#ff5d8f', '#ffd23f', '#3bceac', '#5aa9ff', '#c084fc', '#ff8c42'];

  function storDisegnaEffetto(ctx, ef, x, y, r, t, L, H, ridotto) {
    const s = (t - ef.inizio) / ef.durata;
    if (!(s >= 0) || s > 1) return;
    const R = Math.max(14, r || 0) * ef.scala;
    const d = { s: ef.seme };
    const colore = ef.colore;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (ridotto) {
      const a = Math.sin(Math.PI * s) * 0.7;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R * 2.2);
      g.addColorStop(0, rgba(colore || '#fff3b0', a)); g.addColorStop(1, rgba(colore || '#fff3b0', 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    const tipo = ef.tipo;
    if (tipo === 'explosion') {
      // il fumo, dietro a tutto, che resta quando il resto è finito
      if (s > 0.2) {
        const q = (s - 0.2) / 0.8;
        for (let k = 0; k < 9; k++) {
          const a = dado(d) * Math.PI * 2, v = 0.7 + dado(d) * 0.6;
          const px = x + Math.cos(a) * R * (0.6 + 1.7 * q * v), py = y + Math.sin(a) * R * (0.6 + 1.7 * q * v) - q * R * 0.4;
          const rr = R * (0.32 + 0.55 * q) * (0.7 + dado(d) * 0.5);
          ctx.globalAlpha = 0.55 * (1 - q);
          ctx.fillStyle = '#6b5f86'; ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = rgba('#1c1236', 0.5); ctx.lineWidth = Math.max(1, rr * 0.08); ctx.stroke();
        }
      }
      // il KABOOM: una stella a punte irregolari, gialla dentro e arancio fuori
      if (s < 0.62) {
        const cresce = 1 - Math.pow(1 - Math.min(1, s / 0.3), 3);
        const svanisce = s < 0.45 ? 1 : 1 - (s - 0.45) / 0.17;
        const ro = R * 2.3 * cresce;
        ctx.globalAlpha = Math.max(0, svanisce);
        ctx.beginPath();
        const punte = 13;
        for (let k = 0; k < punte * 2; k++) {
          const a = k * Math.PI / punte + 0.2;
          const rr = k % 2 ? ro * (0.5 + dado(d) * 0.14) : ro * (0.86 + dado(d) * 0.28);
          if (k) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
        const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, ro));
        g.addColorStop(0, '#fffbe6'); g.addColorStop(0.35, '#ffd23f'); g.addColorStop(0.75, colore || '#ff7a1a'); g.addColorStop(1, '#e8361b');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(1.6, R * 0.07); ctx.stroke();
        ctx.fillStyle = '#fff6c2';
        stellaPiena(ctx, x, y, ro * 0.48, 9, s * 2, 0.55);
      }
      // i sassolini che volano via, a pennino
      for (let k = 0; k < 16; k++) {
        const a = dado(d) * Math.PI * 2, v = 0.5 + dado(d), giro = dado(d) * 6;
        const dist = R * (0.5 + 5 * s * v), q = R * (0.07 + dado(d) * 0.08) * (1 - s * 0.5);
        const px = x + Math.cos(a) * dist, py = y + Math.sin(a) * dist;
        ctx.globalAlpha = 1 - s * s;
        ctx.save(); ctx.translate(px, py); ctx.rotate(giro + s * 8 * v);
        ctx.beginPath(); ctx.moveTo(-q, -q * 0.6); ctx.lineTo(q * 0.7, -q); ctx.lineTo(q, q * 0.5); ctx.lineTo(-q * 0.4, q); ctx.closePath();
        ctx.fillStyle = k % 3 ? '#a08a72' : '#ffb347'; ctx.fill();
        ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(0.8, q * 0.25); ctx.stroke();
        ctx.restore();
      }
      // l'onda d'urto
      ctx.globalAlpha = Math.max(0, 1 - s) * 0.85;
      ctx.strokeStyle = '#fff2c8'; ctx.lineWidth = Math.max(1, R * 0.14 * (1 - s));
      ctx.beginPath(); ctx.arc(x, y, R * (1 + 5.5 * s), 0, Math.PI * 2); ctx.stroke();
      // il lampo iniziale
      if (s < 0.18) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, R * (1.5 + 6 * s));
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.globalAlpha = 1 - s / 0.18; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, R * (1.5 + 6 * s), 0, Math.PI * 2); ctx.fill();
      }
    } else if (tipo === 'shockwave') {
      for (let k = 0; k < 3; k++) {
        const q = s * 1.4 - k * 0.2;
        if (q <= 0 || q >= 1) continue;
        ctx.globalAlpha = 1 - q;
        for (const passata of [0, 1]) {
          ctx.strokeStyle = passata ? (colore || '#bfe3ff') : 'rgba(12,6,30,0.5)';
          ctx.lineWidth = Math.max(1.2, R * 0.12 * (1 - q)) + (passata ? 0 : 2.4);
          ctx.beginPath(); ctx.arc(x, y, R * (1.05 + 4 * q), 0, Math.PI * 2); ctx.stroke();
        }
      }
    } else if (tipo === 'flash') {
      const a = s < 0.2 ? s / 0.2 : 1 - (s - 0.2) / 0.8;
      ctx.globalAlpha = Math.max(0, a) * 0.85;
      ctx.fillStyle = colore || '#ffffff';
      ctx.fillRect(0, 0, L, H);
    } else if (tipo === 'sparkles' || tipo === 'glow') {
      if (tipo === 'glow') {
        const pulsa = 0.75 + 0.25 * Math.sin(t / 260);
        const a = Math.sin(Math.PI * s) * pulsa;
        const g = ctx.createRadialGradient(x, y, R * 0.6, x, y, R * 2.6);
        g.addColorStop(0, rgba(colore || '#fde68a', 0.75 * a)); g.addColorStop(1, rgba(colore || '#fde68a', 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = a; ctx.strokeStyle = rgba(colore || '#fff3b0', 0.9); ctx.lineWidth = Math.max(1.2, R * 0.06);
        ctx.setLineDash([R * 0.18, R * 0.22]); ctx.lineDashOffset = -t / 40;
        ctx.beginPath(); ctx.arc(x, y, R * 1.35, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      const n = tipo === 'glow' ? 6 : 12;
      for (let k = 0; k < n; k++) {
        const a = dado(d) * Math.PI * 2, dist = R * (1.15 + dado(d) * 1.1), fase = dado(d) * 6;
        const vita = Math.sin(Math.PI * Math.min(1, Math.max(0, s * 1.25 - dado(d) * 0.25)));
        const q = R * (0.13 + dado(d) * 0.12) * vita * (0.6 + 0.4 * Math.abs(Math.sin(t / 220 + fase)));
        if (q < 0.3) continue;
        const px = x + Math.cos(a + s * 0.6) * dist, py = y + Math.sin(a + s * 0.6) * dist;
        stella(ctx, px, py, q, q * 0.3, 4, t / 700 + fase);
        ctx.globalAlpha = 1; ctx.fillStyle = k % 2 ? '#fff3b0' : (colore || '#ffe066'); ctx.fill();
        ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(0.8, q * 0.16); ctx.stroke();
      }
    } else if (tipo === 'fireworks') {
      for (let b = 0; b < 3; b++) {
        const q = (s - b * 0.18) / 0.62;
        if (q <= 0 || q >= 1) continue;
        const a0 = dado(d) * Math.PI * 2, cx = x + Math.cos(a0) * R * (1.6 + dado(d)), cy = y + Math.sin(a0) * R * (1.2 + dado(d)) - R;
        const tinta = colore && b === 0 ? colore : COLORI_FESTA[(b * 2 + Math.floor(dado(d) * 6)) % COLORI_FESTA.length];
        const raggio = R * 1.5 * (1 - Math.pow(1 - q, 3));
        ctx.globalAlpha = 1 - q * q;
        for (let k = 0; k < 18; k++) {
          const a = k / 18 * Math.PI * 2 + b;
          const px = cx + Math.cos(a) * raggio, py = cy + Math.sin(a) * raggio + q * q * R * 0.8;
          ctx.strokeStyle = tinta; ctx.lineWidth = Math.max(1, R * 0.05);
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * raggio * 0.55, cy + Math.sin(a) * raggio * 0.55 + q * q * R * 0.5); ctx.lineTo(px, py); ctx.stroke();
          ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(px, py, Math.max(0.8, R * 0.05), 0, Math.PI * 2); ctx.fill();
        }
      }
    } else if (tipo === 'smoke') {
      for (let k = 0; k < 10; k++) {
        const ritardo = dado(d) * 0.4, q = (s - ritardo) / (1 - ritardo);
        if (q <= 0) continue;
        const px = x + (dado(d) - 0.5) * R * 1.6 + Math.sin(q * 4 + k) * R * 0.2, py = y - R * 0.3 - q * R * 2.6;
        const rr = R * (0.3 + q * 0.6);
        ctx.globalAlpha = 0.6 * Math.sin(Math.PI * q);
        ctx.fillStyle = colore || '#8b84a6'; ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rgba('#1c1236', 0.45); ctx.lineWidth = Math.max(1, rr * 0.07); ctx.stroke();
      }
    } else if (tipo === 'hearts') {
      for (let k = 0; k < 8; k++) {
        const ritardo = dado(d) * 0.45, q = (s - ritardo) / (1 - ritardo);
        if (q <= 0) continue;
        const px = x + (dado(d) - 0.5) * R * 2.4 + Math.sin(q * 6 + k) * R * 0.25, py = y - R * 0.4 - q * R * 2.4;
        const q2 = R * (0.16 + dado(d) * 0.1) * Math.min(1, q * 4);
        ctx.globalAlpha = q > 0.75 ? (1 - q) / 0.25 : 1;
        cuore(ctx, px, py, q2);
        ctx.fillStyle = colore || '#ff5d8f'; ctx.fill();
        ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(0.9, q2 * 0.18); ctx.stroke();
      }
    } else if (tipo === 'lightning') {
      // Due accensioni sole, distanti: un fulmine che sfarfalla veloce è
      // proprio la cosa da non mettere davanti a un bambino.
      const acceso = s < 0.35 || (s > 0.5 && s < 0.8);
      if (acceso) {
        for (let b = 0; b < 3; b++) {
          const a = -Math.PI / 2 + (b - 1) * 0.7 + (dado(d) - 0.5) * 0.3;
          let px = x + Math.cos(a) * R * 3.2, py = y + Math.sin(a) * R * 3.2;
          const tratti = [[px, py]];
          for (let k = 1; k <= 6; k++) {
            const f = k / 6;
            const bx = px + (x + Math.cos(a) * R * 1.05 - px) * f, by = py + (y + Math.sin(a) * R * 1.05 - py) * f;
            tratti.push([bx + (dado(d) - 0.5) * R * 0.5 * (k < 6 ? 1 : 0), by + (dado(d) - 0.5) * R * 0.3 * (k < 6 ? 1 : 0)]);
          }
          for (const passata of [0, 1]) {
            ctx.strokeStyle = passata ? (colore || '#fff59d') : INCHIOSTRO;
            ctx.lineWidth = Math.max(1.4, R * 0.08) + (passata ? 0 : 2.6);
            ctx.beginPath(); tratti.forEach(([qx, qy], i) => i ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy)); ctx.stroke();
          }
        }
      }
    } else if (tipo === 'shooting_star') {
      const a = 0.6 + (dado(d) - 0.5) * 0.4;
      const testa = -1.5 + 3 * liscio(s);
      const hx = x + Math.cos(a) * R * 4 * testa, hy = y + Math.sin(a) * R * 4 * testa - R * 1.2;
      const g = ctx.createLinearGradient(hx, hy, hx - Math.cos(a) * R * 3, hy - Math.sin(a) * R * 3);
      g.addColorStop(0, rgba(colore || '#fff3b0', 0.95)); g.addColorStop(1, rgba(colore || '#fff3b0', 0));
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(2, R * 0.16);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - Math.cos(a) * R * 3, hy - Math.sin(a) * R * 3); ctx.stroke();
      ctx.fillStyle = '#fffbe6'; stellaPiena(ctx, hx, hy, R * 0.28, 5, t / 300, 0.45);
      ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(1, R * 0.05); ctx.stroke();
    } else if (tipo === 'confetti') {
      for (let k = 0; k < 26; k++) {
        const px0 = x + (dado(d) - 0.5) * R * 4, ritardo = dado(d) * 0.3, giro = dado(d) * 6;
        const q = (s - ritardo) / (1 - ritardo);
        if (q <= 0) continue;
        const px = px0 + Math.sin(q * 7 + k) * R * 0.25, py = y - R * 1.8 + q * R * 3.6;
        ctx.globalAlpha = q > 0.8 ? (1 - q) / 0.2 : 1;
        ctx.save(); ctx.translate(px, py); ctx.rotate(giro + q * 9);
        ctx.fillStyle = COLORI_FESTA[k % COLORI_FESTA.length];
        ctx.fillRect(-R * 0.08, -R * 0.04, R * 0.16, R * 0.08);
        ctx.restore();
      }
    }
    ctx.restore();
  }
  // Dove sta un effetto in questo fotogramma: sull'astro (se è disegnato) o
  // nel posto dello schermo chiesto. `null` se l'astro non c'è.
  function storPostoEffetto(ef, perId, L, H) {
    if (ef.target) {
      const c = perId.get(ef.target);
      if (!c || !Number.isFinite(c.px) || !Number.isFinite(c.py)) return null;
      return { x: c.px, y: c.py, r: c.r };
    }
    const fx = { center: 0.5, left: 0.25, right: 0.75, top: 0.5, bottom: 0.5 }[ef.dove] || 0.5;
    const fy = { center: 0.45, left: 0.45, right: 0.45, top: 0.25, bottom: 0.7 }[ef.dove] || 0.45;
    return { x: L * fx, y: H * fy, r: Math.min(L, H) * 0.06 };
  }
  function storEffetto(tipo, opz = {}) {
    if (!STOR_EFFETTI[tipo]) return null;
    const ef = {
      tipo, target: opz.target ? storCanonico(opz.target) : null, dove: opz.dove || 'center',
      inizio: stor.orologio, durata: Math.max(300, opz.durata || STOR_EFFETTI[tipo]),
      scala: Math.max(0.2, Math.min(5, Number(opz.scala) || 1)), colore: opz.colore || null,
      seme: seme(tipo + ':' + (opz.target || '') + ':' + stor.effetti.length + ':' + Math.round(stor.orologio)) || 1
    };
    stor.effetti.push(ef);
    // I botti fanno tremare il quadro (la lente della regia, §7-ter)
    const scossa = STOR_REGIA.scosse[tipo];
    if (scossa && !opz.quieto) storScossa(scossa * Math.min(1.4, Math.sqrt(ef.scala)), tipo === 'lightning' ? 500 : 800);
    return ef;
  }

  // ===================================================================
  // 6-quater. I corpi: il personaggio è l'oggetto
  // ===================================================================

  /* Quando l'astro vero è troppo piccolo per portare il volto (un pianeta
   * nel planetario è un puntino, una sonda nella 3D è una crocetta), il
   * personaggio ha un **corpo** disegnato qui: lo stesso oggetto, in
   * cartone. Fino alla v410 era un adesivo tondo per tutti, e la Voyager
   * parlava da un disco come se fosse un pianeta: chi guardava non capiva
   * più chi fosse chi. Adesso la Voyager è la Voyager — la grande parabola
   * (il volto sta lì), il corpo a dieci facce dorato, i bracci con gli
   * strumenti e i generatori —, la stazione ha i suoi pannelli, Hubble il
   * suo tubo, un asteroide è un sasso a patata e una cometa ha chioma e
   * coda; i pianeti sono dischi col loro disegno (le bande di Giove, gli
   * anelli di Saturno, i continenti della Terra, la calotta di Marte).
   *
   * `volto` dice dove sta il volto sul corpo (spostamento e misura, in
   * raggi), `ingombro` quanto il corpo esce dal suo raggio (i pannelli, gli
   * anelli, la coda): serve a non appoggiarlo sopra a un altro personaggio.
   * Tutto nello stile dei volti: stesure piatte, un'ombra sola a taglio
   * netto, pennino d'inchiostro con l'alone color panna sotto. */
  const STOR_CORPI = {
    stella:    { volto: [0, 0, 0.86], ingombro: 1.3 },
    pianeta:   { volto: [0, 0, 0.9], ingombro: 1 },
    luna:      { volto: [0, 0, 0.9], ingombro: 1 },
    anelli:    { volto: [0, -0.04, 0.84], ingombro: 1.65 },
    asteroide: { volto: [0.02, 0.03, 0.8], ingombro: 1.12 },
    cometa:    { volto: [0, 0.02, 0.8], ingombro: 1.5 },
    voyager:   { volto: [0, -0.12, 0.72], ingombro: 1.5 },
    iss:       { volto: [0, 0, 0.62], ingombro: 1.75 },
    tiangong:  { volto: [0, 0.02, 0.6], ingombro: 1.7 },
    hubble:    { volto: [0, 0.06, 0.58], ingombro: 1.35 },
    galassia:  { volto: [0, 0, 0.72], ingombro: 1.5 },
    // v414: le stelle che invecchiano, quelle che esplodono, i buchi
    gigante_rossa: { volto: [0, 0.02, 0.82], ingombro: 1.4 },
    nana_bianca:   { volto: [0, 0, 0.86], ingombro: 1.45 },
    supernova:     { volto: [0, 0, 0.7], ingombro: 1.85 },
    buco_nero:     { volto: [0, -0.04, 0.8], ingombro: 1.75 },
    buco_bianco:   { volto: [0, 0, 0.8], ingombro: 1.6 }
  };
  // Dove sta il volto su un corpo di raggio R centrato in (x, y)
  function storVoltoNelCorpo(sagoma, x, y, R) {
    const v = (STOR_CORPI[sagoma] || STOR_CORPI.pianeta).volto;
    return { cx: x + v[0] * R, cy: y + v[1] * R, R: R * v[2] };
  }
  // Quanto il corpo esce dal suo raggio. Con un profilo (v430) contano
  // anche le lune e gli anelli della sua fisica (§6-sexies)
  const ingombroDi = x => {
    const sag = x && typeof x === 'object' ? x.sagoma : x;
    const base = (STOR_CORPI[sag] || STOR_CORPI.pianeta).ingombro;
    return x && typeof x === 'object' ? Math.max(base, storFisica(x).ingombro) : base;
  };

  /* Una parte del corpo: la stesura scura, quella chiara spostata verso la
   * luce (in alto a sinistra) e il pennino attorno, con l'alone sotto. */
  function parte(ctx, traccia, colore, R, opz = {}) {
    traccia();
    ctx.strokeStyle = ALONE; ctx.lineWidth = Math.max(2.4, R * 0.07); ctx.stroke();
    ctx.fillStyle = scurisci(colore, opz.buio === undefined ? 0.28 : opz.buio); ctx.fill();
    ctx.save(); traccia(); ctx.clip();
    ctx.translate(-R * (opz.luce || 0.12), -R * (opz.luce || 0.12) * 1.1);
    traccia(); ctx.fillStyle = colore; ctx.fill();
    ctx.restore();
    if (opz.dentro) { ctx.save(); traccia(); ctx.clip(); opz.dentro(); ctx.restore(); }
    traccia(); ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(1.1, R * (opz.pennino || 0.04)); ctx.stroke();
  }
  function rettangolo(ctx, x, y, w, h, r) {
    ctx.beginPath();
    const q = Math.min(r || 0, w / 2, h / 2);
    ctx.moveTo(x + q, y);
    ctx.arcTo(x + w, y, x + w, y + h, q); ctx.arcTo(x + w, y + h, x, y + h, q);
    ctx.arcTo(x, y + h, x, y, q); ctx.arcTo(x, y, x + w, y, q);
    ctx.closePath();
  }
  // Un tratto d'inchiostro con l'alone (i bracci, i tralicci)
  function asta(ctx, x1, y1, x2, y2, w, colore) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = ALONE; ctx.lineWidth = w + 2.6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (colore && w > 2.4) {
      ctx.strokeStyle = colore; ctx.lineWidth = w * 0.45;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }
  // Un pannello solare: celle blu, la griglia e la cornice dorata
  function pannello(ctx, x, y, w, h, R) {
    parte(ctx, () => rettangolo(ctx, x, y, w, h, R * 0.02), '#3b5fc0', R, {
      luce: 0.06, pennino: 0.03,
      dentro: () => {
        ctx.strokeStyle = 'rgba(191, 219, 254, 0.55)'; ctx.lineWidth = Math.max(0.6, R * 0.012);
        ctx.beginPath();
        const nx = Math.max(2, Math.round(w / (R * 0.12))), ny = Math.max(2, Math.round(h / (R * 0.12)));
        for (let i = 1; i < nx; i++) { ctx.moveTo(x + w * i / nx, y); ctx.lineTo(x + w * i / nx, y + h); }
        for (let j = 1; j < ny; j++) { ctx.moveTo(x, y + h * j / ny); ctx.lineTo(x + w, y + h * j / ny); }
        ctx.stroke();
        // un riflesso in diagonale: il vetro delle celle
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.moveTo(x, y + h * 0.15); ctx.lineTo(x + w * 0.55, y); ctx.lineTo(x + w * 0.85, y); ctx.lineTo(x, y + h * 0.5); ctx.closePath(); ctx.fill();
      }
    });
    ctx.strokeStyle = '#e2b04a'; ctx.lineWidth = Math.max(0.8, R * 0.018);
    rettangolo(ctx, x + R * 0.015, y + R * 0.015, w - R * 0.03, h - R * 0.03, R * 0.015); ctx.stroke();
  }
  // Un sasso a patata: il contorno di un asteroide (e del nucleo di una
  // cometa), diverso per ogni personaggio ma sempre uguale per lo stesso
  function patata(ctx, x, y, R, semeTesto, bozze) {
    const st = { s: seme(semeTesto || 'sasso') || 1 };
    const f = [dado(st) * 6, dado(st) * 6, dado(st) * 6];
    const n = 28, punti = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const r = R * (1 + (bozze || 1) * (0.08 * Math.sin(2 * a + f[0]) + 0.06 * Math.sin(3 * a + f[1]) + 0.035 * Math.sin(5 * a + f[2])));
      punti.push([x + Math.cos(a) * r * 1.06, y + Math.sin(a) * r * 0.94]);
    }
    ctx.beginPath();
    const mezzo = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    ctx.moveTo(...mezzo(punti[n - 1], punti[0]));
    for (let i = 0; i < n; i++) ctx.quadraticCurveTo(...punti[i], ...mezzo(punti[i], punti[(i + 1) % n]));
    ctx.closePath();
  }
  // I crateri (v417): ovali piatti, l'orlo chiaro in basso verso la luce e
  // la conca in ombra in alto, senza pennino: fanno pelle, non disegno
  function crateri(ctx, x, y, R, colore, elenco) {
    for (const [dx, dy, r] of elenco) {
      const cx = x + dx * R, cy = y + dy * R, q = r * R;
      ctx.fillStyle = rgba(schiarisci(colore, 0.35), 0.75);
      ctx.beginPath(); ctx.ellipse(cx + q * 0.08, cy + q * 0.1, q * 1.04, q * 0.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(scurisci(colore, 0.22), 0.9);
      ctx.beginPath(); ctx.ellipse(cx, cy, q, q * 0.84, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(scurisci(colore, 0.36), 0.55);
      ctx.beginPath(); ctx.ellipse(cx - q * 0.12, cy - q * 0.14, q * 0.72, q * 0.52, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* Il disco di un astro tondo: l'ombra piatta spostata (è *appoggiato*
   * sul cielo), il bordo color panna, la stesura col taglio netto
   * dell'ombra, il suo disegno (`decora`, dentro al disco) e la luce di
   * taglio sul bordo. */
  function disegnaDisco(ctx, x, y, R, pelle, decora) {
    const forma = () => { ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); };
    ctx.save();
    ctx.translate(R * 0.06, R * 0.08);
    forma(); ctx.fillStyle = 'rgba(12, 6, 30, 0.4)'; ctx.fill();
    ctx.restore();
    // Il bordo (v417): un anello color panna fra due fili d'inchiostro
    ctx.beginPath(); ctx.arc(x, y, R * 1.045, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff6e6'; ctx.lineWidth = Math.max(2, R * 0.07); ctx.stroke();
    ctx.strokeStyle = rgba(INCHIOSTRO, 0.9); ctx.lineWidth = Math.max(0.8, R * 0.018);
    ctx.beginPath(); ctx.arc(x, y, R * 1.08, 0, Math.PI * 2); ctx.stroke();
    forma();
    ctx.fillStyle = scurisci(pelle, 0.26); ctx.fill();
    ctx.save(); ctx.clip();
    // la stesura chiara, spostata verso la luce: il resto è l'ombra, una
    // falce dal bordo appena sfumato (fino alla v416 c'era il retino a
    // puntini; accanto agli occhioni faceva rumore)
    const lx = x - R * 0.2, ly = y - R * 0.22, lr = R * 1.02;
    const luce = ctx.createRadialGradient(lx, ly, lr * 0.9, lx, ly, lr);
    luce.addColorStop(0, pelle); luce.addColorStop(1, rgba(pelle, 0));
    ctx.fillStyle = pelle;
    ctx.beginPath(); ctx.arc(lx, ly, lr * 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = luce;
    ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();
    if (decora) decora();
    // il riverbero sul bordo in ombra e la luce di taglio sul bordo illuminato
    ctx.lineWidth = R * 0.07;
    ctx.strokeStyle = rgba(schiarisci(pelle, 0.25), 0.45);
    ctx.beginPath(); ctx.arc(x, y, R * 0.965, Math.PI * 0.05, Math.PI * 0.75); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'; ctx.lineWidth = R * 0.05;
    ctx.beginPath(); ctx.arc(x, y, R * 0.95, Math.PI * 1.12, Math.PI * 1.38); ctx.stroke();
    ctx.restore();
    forma();
    ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(1.4, R * 0.04); ctx.stroke();
  }
  // Il disegno sulla faccia di un pianeta. Sta sotto al volto, quindi resta
  // ai bordi e chiaro: deve dire «è Giove» senza sporcare gli occhi.
  function decoroPianeta(ctx, x, y, R, profilo) {
    const pelle = profilo.pelle;
    switch (profilo.decoro) {
      case 'bande': {
        ctx.fillStyle = rgba(scurisci(pelle, 0.22), 0.6);
        for (const [dy, h] of [[-0.62, 0.13], [-0.34, 0.09], [0.3, 0.12], [0.58, 0.1], [0.8, 0.08]]) {
          ctx.beginPath();
          ctx.moveTo(x - R * 1.1, y + (dy - h / 2) * R);
          ctx.quadraticCurveTo(x, y + (dy - h / 2 - 0.04) * R, x + R * 1.1, y + (dy - h / 2) * R);
          ctx.lineTo(x + R * 1.1, y + (dy + h / 2) * R);
          ctx.quadraticCurveTo(x, y + (dy + h / 2 + 0.04) * R, x - R * 1.1, y + (dy + h / 2) * R);
          ctx.closePath(); ctx.fill();
        }
        // la Grande Macchia Rossa, in basso a destra (lontana dalla bocca)
        ctx.fillStyle = '#d9653b';
        ctx.beginPath(); ctx.ellipse(x + R * 0.62, y + R * 0.46, R * 0.2, R * 0.11, -0.1, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rgba(INCHIOSTRO, 0.6); ctx.lineWidth = Math.max(0.8, R * 0.025); ctx.stroke();
        break;
      }
      case 'macchia':
        ctx.fillStyle = rgba(scurisci(pelle, 0.25), 0.55);
        ctx.beginPath(); ctx.ellipse(x, y - R * 0.66, R * 1.1, R * 0.12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a4fa0';
        ctx.beginPath(); ctx.ellipse(x - R * 0.6, y + R * 0.5, R * 0.18, R * 0.1, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.ellipse(x - R * 0.58, y + R * 0.66, R * 0.14, R * 0.03, 0.1, 0, Math.PI * 2); ctx.fill();
        break;
      case 'continenti': {
        ctx.fillStyle = '#5fcf7e';
        ctx.strokeStyle = rgba('#166534', 0.6); ctx.lineWidth = Math.max(0.8, R * 0.025);
        for (const blob of [[[-0.75, -0.35, 0.22], [-0.6, -0.15, 0.2], [-0.72, 0.1, 0.16], [-0.55, 0.38, 0.13]],
          [[0.62, -0.48, 0.2], [0.8, -0.25, 0.16], [0.5, -0.28, 0.14]], [[0.55, 0.55, 0.17], [0.75, 0.42, 0.13]]]) {
          ctx.beginPath();
          for (const [dx, dy, r] of blob) { ctx.moveTo(x + (dx + r) * R, y + dy * R); ctx.arc(x + dx * R, y + dy * R, r * R, 0, Math.PI * 2); }
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (const [dx, dy, w] of [[-0.1, -0.78, 0.4], [0.2, 0.82, 0.35], [-0.6, 0.66, 0.2]]) {
          ctx.beginPath(); ctx.ellipse(x + dx * R, y + dy * R, w * R, R * 0.05, 0, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'calotta':
        ctx.fillStyle = '#fff7ef';
        ctx.beginPath(); ctx.ellipse(x - R * 0.05, y - R * 0.98, R * 0.45, R * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(scurisci(pelle, 0.25), 0.5);
        for (const [dx, dy, rx, ry] of [[-0.68, 0.2, 0.18, 0.1], [0.66, -0.1, 0.14, 0.2], [0.4, 0.7, 0.2, 0.08]]) {
          ctx.beginPath(); ctx.ellipse(x + dx * R, y + dy * R, rx * R, ry * R, 0.4, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 'nubi':
        ctx.strokeStyle = rgba(schiarisci(pelle, 0.5), 0.8); ctx.lineWidth = Math.max(1, R * 0.07);
        ctx.beginPath();
        for (const [dy, a] of [[-0.62, 1], [0.66, -1], [0.85, 1]]) {
          ctx.moveTo(x - R, y + dy * R);
          ctx.bezierCurveTo(x - R * 0.4, y + (dy - 0.12 * a) * R, x + R * 0.3, y + (dy + 0.12 * a) * R, x + R, y + dy * R);
        }
        ctx.stroke();
        break;
      case 'cuore':
        // il cuore di Plutone (la pianura Sputnik, ghiaccio chiaro), in basso
        // a destra, lontano dalla bocca; attorno i crateri di una luna
        decoroPianeta(ctx, x, y, R, Object.assign({}, profilo, { decoro: 'crateri' }));
        ctx.fillStyle = rgba(schiarisci(pelle, 0.6), 0.9);
        ctx.beginPath();
        ctx.moveTo(x + R * 0.62, y + R * 0.86);
        ctx.bezierCurveTo(x + R * 0.36, y + R * 0.68, x + R * 0.32, y + R * 0.42, x + R * 0.5, y + R * 0.38);
        ctx.bezierCurveTo(x + R * 0.6, y + R * 0.36, x + R * 0.62, y + R * 0.46, x + R * 0.64, y + R * 0.5);
        ctx.bezierCurveTo(x + R * 0.68, y + R * 0.42, x + R * 0.8, y + R * 0.36, x + R * 0.88, y + R * 0.46);
        ctx.bezierCurveTo(x + R * 0.98, y + R * 0.6, x + R * 0.8, y + R * 0.76, x + R * 0.62, y + R * 0.86);
        ctx.closePath(); ctx.fill();
        break;
      case 'sale':
        // le due macchie bianche di sale nel cratere Occator di Cerere, in alto
        // a destra sopra al sopracciglio: più in basso cadevano sulla guancia
        decoroPianeta(ctx, x, y, R, Object.assign({}, profilo, { decoro: 'crateri' }));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        for (const [dx, dy, r] of [[0.5, -0.66, 0.07], [0.62, -0.58, 0.04]]) {
          ctx.beginPath(); ctx.arc(x + dx * R, y + dy * R, r * R, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 'macchia_scura':
        // la macchia rosso scuro di Haumea, sul bordo in alto (sotto, alle
        // guance, si confondeva col rossore)
        decoroPianeta(ctx, x, y, R, Object.assign({}, profilo, { decoro: 'crateri' }));
        ctx.fillStyle = rgba('#8b3a3a', 0.7);
        ctx.beginPath(); ctx.ellipse(x - R * 0.5, y - R * 0.7, R * 0.2, R * 0.12, -0.5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'crateri':
        // tutt'attorno al volto, come nella Luna dei cartoni: più fitti sul bordo
        crateri(ctx, x, y, R, pelle, [[-0.78, -0.3, 0.12], [-0.86, 0.12, 0.08], [-0.7, 0.42, 0.13], [-0.42, 0.78, 0.1],
          [0.02, 0.9, 0.07], [0.42, 0.8, 0.11], [0.78, 0.44, 0.09], [0.88, 0.02, 0.07], [0.74, -0.46, 0.1],
          [0.38, -0.8, 0.08], [-0.3, -0.84, 0.07], [-0.55, -0.64, 0.05], [0.6, 0.62, 0.05], [-0.88, -0.08, 0.04]]);
        break;
    }
  }

  // Il corpo intero di un personaggio, centrato in (x, y), di raggio R
  function disegnaCorpo(ctx, x, y, R, profilo, t) {
    const sagoma = profilo.sagoma;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (sagoma === 'stella') {
      // la corona: fiamme che girano piano, e un bagliore
      const alone = ctx.createRadialGradient(x, y, R * 0.8, x, y, R * 1.55);
      alone.addColorStop(0, rgba(profilo.raggi ? schiarisci(profilo.raggi, 0.4) : '#fde68a', 0.5)); alone.addColorStop(1, rgba('#fde68a', 0));
      ctx.fillStyle = alone; ctx.beginPath(); ctx.arc(x, y, R * 1.55, 0, Math.PI * 2); ctx.fill();
      const giro = t / 9000;
      parte(ctx, () => {
        ctx.beginPath();
        const n = 14;
        for (let k = 0; k < n; k++) {
          const a = giro + k / n * Math.PI * 2, b = giro + (k + 0.5) / n * Math.PI * 2, c = giro + (k + 1) / n * Math.PI * 2;
          const lun = R * (1.3 + 0.06 * Math.sin(t / 300 + k * 1.7));
          if (!k) ctx.moveTo(x + Math.cos(a) * R * 0.98, y + Math.sin(a) * R * 0.98);
          ctx.quadraticCurveTo(x + Math.cos(a + 0.1) * lun * 0.95, y + Math.sin(a + 0.1) * lun * 0.95, x + Math.cos(b) * lun, y + Math.sin(b) * lun);
          ctx.quadraticCurveTo(x + Math.cos(c - 0.12) * R * 1.12, y + Math.sin(c - 0.12) * R * 1.12, x + Math.cos(c) * R * 0.98, y + Math.sin(c) * R * 0.98);
        }
        ctx.closePath();
      }, profilo.raggi || '#fb923c', R, { buio: 0.15 });
      disegnaDisco(ctx, x, y, R, profilo.pelle);
    } else if (sagoma === 'pianeta' || sagoma === 'luna') {
      disegnaDisco(ctx, x, y, R, profilo.pelle, () => {
        if (sagoma === 'luna' && !profilo.decoro) decoroPianeta(ctx, x, y, R, Object.assign({}, profilo, { decoro: 'crateri' }));
        else decoroPianeta(ctx, x, y, R, profilo);
      });
    } else if (sagoma === 'anelli') {
      // Gli anelli: la metà di dietro sotto al disco, quella davanti sopra,
      // abbastanza in basso da passare sotto alla bocca
      // v430: Saturno gesticola con gli anelli (§6-sexies). L'orgoglio li
      // alza e li apre come un petto in fuori, la tristezza li lascia
      // cadere, la rabbia li fa vibrare, e chi parla li muove sulle parole
      const re = profilo.reazione || null;
      const gesto = re ? re.anelliInclina + Math.sin(t / 260) * 0.08 * re.energia + Math.sin(t / 90) * 0.05 * re.anelliScuoti : 0;
      const ax = x, ay = y + R * 0.3, rx = R * 1.62, ry = R * 0.4 * (1 + (re ? Math.max(-0.5, re.anelliApri) : 0)), giro = -0.1 + gesto;
      const anello = (da, a) => {
        for (const [w, c] of [[R * 0.3, INCHIOSTRO], [R * 0.24, '#ead39d'], [R * 0.035, rgba('#8a6d3b', 0.8)]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.ellipse(ax, ay, rx, ry, giro, da, a); ctx.stroke();
        }
      };
      ctx.lineCap = 'butt';
      ctx.strokeStyle = ALONE; ctx.lineWidth = R * 0.3 + 3;
      ctx.beginPath(); ctx.ellipse(ax, ay, rx, ry, giro, Math.PI, Math.PI * 2); ctx.stroke();
      anello(Math.PI, Math.PI * 2);
      disegnaDisco(ctx, x, y, R, profilo.pelle, () => {
        ctx.fillStyle = rgba(scurisci(profilo.pelle, 0.15), 0.5);
        for (const dy of [-0.6, -0.35]) { ctx.beginPath(); ctx.ellipse(x, y + dy * R, R * 1.1, R * 0.07, 0, 0, Math.PI * 2); ctx.fill(); }
      });
      anello(0, Math.PI);
      // e quando è fiero, gli anelli luccicano (è vanitoso, e lo sa)
      if (re && re.anelliBrilla > 0.05) {
        for (let k = 0; k < 3; k++) {
          const a = t / 1400 + k * 2.1, cg = Math.cos(giro), sg = Math.sin(giro);
          const lx = Math.cos(a) * rx, ly = Math.abs(Math.sin(a)) * ry;
          luccichio(ctx, ax + lx * cg - ly * sg, ay + lx * sg + ly * cg, R * 0.13 * (0.6 + 0.4 * Math.sin(t / 200 + k)),
            re.anelliBrilla * (0.5 + 0.5 * Math.sin(t / 330 + k * 1.7)));
        }
      }
    } else if (sagoma === 'asteroide') {
      parte(ctx, () => patata(ctx, x, y, R * 0.98, profilo.id, 1.2), profilo.pelle, R, {
        luce: 0.16,
        dentro: () => crateri(ctx, x, y, R, profilo.pelle, [[-0.66, -0.42, 0.15], [0.7, 0.38, 0.12], [-0.48, 0.66, 0.1], [0.58, -0.6, 0.09], [0.82, -0.12, 0.06]])
      });
    } else if (sagoma === 'cometa') {
      // La coda dalla parte opposta al Sole (se lo si sa), se no in alto a
      // destra; la polvere larga e curva, gli ioni dritti e azzurri
      const a = Number.isFinite(profilo.codaVerso) ? profilo.codaVerso : -0.75;
      const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
      const L = R * 2.8;
      const coda = (larg, curva, colore, alfa) => {
        const g = ctx.createLinearGradient(x, y, x + ux * L, y + uy * L);
        g.addColorStop(0, rgba(colore, alfa)); g.addColorStop(1, rgba(colore, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x + nx * R * 0.7, y + ny * R * 0.7);
        ctx.quadraticCurveTo(x + ux * L * 0.5 + nx * R * (larg + curva), y + uy * L * 0.5 + ny * R * (larg + curva), x + ux * L + nx * R * (larg + curva * 2), y + uy * L + ny * R * (larg + curva * 2));
        ctx.lineTo(x + ux * L - nx * R * (larg - curva * 2), y + uy * L - ny * R * (larg - curva * 2));
        ctx.quadraticCurveTo(x + ux * L * 0.5 - nx * R * (larg - curva), y + uy * L * 0.5 - ny * R * (larg - curva), x - nx * R * 0.7, y - ny * R * 0.7);
        ctx.closePath(); ctx.fill();
      };
      coda(0.95, 0.5, '#fef3c7', 0.75);
      coda(0.35, -0.15, '#7dd3fc', 0.8);
      // i filamenti che scorrono lungo la coda
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(0.8, R * 0.03);
      ctx.setLineDash([R * 0.25, R * 0.35]); ctx.lineDashOffset = -t / 40;
      ctx.beginPath();
      for (const k of [-0.4, 0, 0.45]) {
        ctx.moveTo(x + ux * R + nx * R * k, y + uy * R + ny * R * k);
        ctx.quadraticCurveTo(x + ux * L * 0.5 + nx * R * (k + 0.25), y + uy * L * 0.5 + ny * R * (k + 0.25), x + ux * L * 0.9 + nx * R * (k * 1.6 + 0.5), y + uy * L * 0.9 + ny * R * (k * 1.6 + 0.5));
      }
      ctx.stroke(); ctx.setLineDash([]);
      const chioma = ctx.createRadialGradient(x, y, R * 0.6, x, y, R * 1.5);
      chioma.addColorStop(0, 'rgba(224, 252, 255, 0.55)'); chioma.addColorStop(1, 'rgba(224, 252, 255, 0)');
      ctx.fillStyle = chioma; ctx.beginPath(); ctx.arc(x, y, R * 1.5, 0, Math.PI * 2); ctx.fill();
      parte(ctx, () => patata(ctx, x, y, R * 0.94, profilo.id, 0.6), profilo.pelle, R, { luce: 0.14 });
    } else if (sagoma === 'voyager') {
      // I bracci, dietro a tutto: il magnetometro lunghissimo in alto a
      // destra, i generatori (tre cilindri) in basso a sinistra, la
      // piattaforma degli strumenti con la telecamera in basso a destra
      asta(ctx, x + R * 0.3, y + R * 0.3, x + R * 1.48, y - R * 0.8, Math.max(1, R * 0.035));
      for (let k = 1; k <= 5; k++) {
        const u = k / 6, px = mix(x + R * 0.3, x + R * 1.48, u), py = mix(y + R * 0.3, y - R * 0.8, u);
        ctx.fillStyle = INCHIOSTRO; ctx.beginPath(); ctx.arc(px, py, Math.max(0.8, R * 0.025), 0, Math.PI * 2); ctx.fill();
      }
      parte(ctx, () => { ctx.beginPath(); ctx.arc(x + R * 1.48, y - R * 0.8, R * 0.07, 0, Math.PI * 2); }, '#e5e7eb', R);
      asta(ctx, x - R * 0.2, y + R * 0.62, x - R * 1.5, y + R * 0.98, Math.max(1.6, R * 0.06), '#9ca3af');
      for (const u of [0.55, 0.72, 0.89]) {
        const px = mix(x - R * 0.2, x - R * 1.5, u), py = mix(y + R * 0.62, y + R * 0.98, u);
        parte(ctx, () => rettangolo(ctx, px - R * 0.08, py - R * 0.11, R * 0.16, R * 0.22, R * 0.04), '#6b7280', R, { pennino: 0.03 });
      }
      asta(ctx, x + R * 0.35, y + R * 0.6, x + R * 1.3, y + R * 0.92, Math.max(1.4, R * 0.05), '#9ca3af');
      parte(ctx, () => rettangolo(ctx, x + R * 1.18, y + R * 0.78, R * 0.3, R * 0.26, R * 0.04), '#d1d5db', R, { pennino: 0.03 });
      parte(ctx, () => { ctx.beginPath(); ctx.arc(x + R * 1.33, y + R * 0.91, R * 0.07, 0, Math.PI * 2); }, '#1f2937', R, { pennino: 0.025 });
      // il corpo a dieci facce, d'oro, sotto alla parabola
      parte(ctx, () => {
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = k / 10 * Math.PI * 2 + Math.PI / 10;
          const px = x + Math.cos(a) * R * 0.56, py = y + R * 0.8 + Math.sin(a) * R * 0.34;
          if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
      }, '#e0b43a', R, {
        dentro: () => {
          ctx.strokeStyle = rgba('#7c5a12', 0.6); ctx.lineWidth = Math.max(0.6, R * 0.015);
          ctx.beginPath();
          for (const dx of [-0.34, -0.12, 0.12, 0.34]) { ctx.moveTo(x + dx * R, y + R * 0.4); ctx.lineTo(x + dx * R, y + R * 1.2); }
          ctx.stroke();
        }
      });
      // la grande parabola, rivolta a noi: è lì che sta il volto
      const dx = x, dy = y - R * 0.12, dr = R * 0.86;
      parte(ctx, () => { ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2); }, profilo.pelle, R, {
        luce: 0.1, buio: 0.18,
        dentro: () => {
          ctx.strokeStyle = rgba(INCHIOSTRO, 0.16); ctx.lineWidth = Math.max(0.6, R * 0.014);
          for (const k of [0.97, 0.7]) { ctx.beginPath(); ctx.arc(dx, dy, dr * k, 0, Math.PI * 2); ctx.stroke(); }
        }
      });
      ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(1.8, R * 0.07);
      ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2); ctx.stroke();
      // l'antennina in testa, con il suo pallino
      asta(ctx, dx, dy - dr, dx, dy - dr - R * 0.26, Math.max(1, R * 0.035));
      parte(ctx, () => { ctx.beginPath(); ctx.arc(dx, dy - dr - R * 0.3, R * 0.07, 0, Math.PI * 2); }, '#f59e0b', R);
    } else if (sagoma === 'iss' || sagoma === 'tiangong') {
      const iss = sagoma === 'iss';
      if (iss) {
        // il traliccio e quattro coppie di pannelli
        parte(ctx, () => rettangolo(ctx, x - R * 1.72, y - R * 0.07, R * 3.44, R * 0.14, R * 0.03), '#9ca3af', R, {
          pennino: 0.03,
          dentro: () => {
            ctx.strokeStyle = rgba(INCHIOSTRO, 0.5); ctx.lineWidth = Math.max(0.6, R * 0.012);
            ctx.beginPath();
            for (let k = -16; k <= 16; k++) { ctx.moveTo(x + k * R * 0.1, y - R * 0.07); ctx.lineTo(x + (k + 1) * R * 0.1, y + R * 0.07); }
            ctx.stroke();
          }
        });
        for (const px of [-1.62, -1.24, 0.98, 1.36]) {
          pannello(ctx, x + px * R, y - R * 0.98, R * 0.26, R * 0.86, R);
          pannello(ctx, x + px * R, y + R * 0.12, R * 0.26, R * 0.86, R);
        }
        // i radiatori bianchi
        for (const px of [-0.92, 0.7]) parte(ctx, () => rettangolo(ctx, x + px * R, y + R * 0.1, R * 0.22, R * 0.46, R * 0.02), '#f8fafc', R, { pennino: 0.025 });
        // i moduli sopra e sotto al nodo centrale
        parte(ctx, () => rettangolo(ctx, x - R * 0.16, y - R * 0.98, R * 0.32, R * 0.4, R * 0.08), profilo.pelle, R);
        parte(ctx, () => rettangolo(ctx, x - R * 0.14, y + R * 0.58, R * 0.28, R * 0.42, R * 0.08), profilo.pelle, R);
      } else {
        // Tiangong: le due grandi ali e il laboratorio in cima, a T
        for (const lato of [-1, 1]) {
          asta(ctx, x + lato * R * 0.8, y, x + lato * R * 1.02, y, Math.max(1.2, R * 0.05));
          pannello(ctx, lato < 0 ? x - R * 1.78 : x + R * 1.0, y - R * 0.32, R * 0.78, R * 0.64, R);
        }
        parte(ctx, () => rettangolo(ctx, x - R * 0.2, y - R * 1.15, R * 0.4, R * 0.62, R * 0.12), profilo.pelle, R);
        pannello(ctx, x - R * 0.62, y - R * 1.05, R * 0.36, R * 0.22, R);
        pannello(ctx, x + R * 0.26, y - R * 1.05, R * 0.36, R * 0.22, R);
      }
      // il modulo centrale, dove sta il volto
      parte(ctx, () => rettangolo(ctx, x - R * 0.8, y - R * 0.66, R * 1.6, R * 1.32, R * 0.36), profilo.pelle, R, {
        dentro: () => {
          ctx.strokeStyle = rgba(INCHIOSTRO, 0.22); ctx.lineWidth = Math.max(0.6, R * 0.016);
          ctx.beginPath();
          for (const k of [-0.62, 0.62]) { ctx.moveTo(x + k * R, y - R * 0.66); ctx.lineTo(x + k * R, y + R * 0.66); }
          ctx.stroke();
        }
      });
    } else if (sagoma === 'galassia') {
      // Una spirale vista di faccia: il bagliore, due bracci a spirale
      // logaritmica (l'avvolgimento di 12°, come nella carta) punteggiati di
      // stelle che girano piano, e il nucleo dorato dove sta il volto
      const braccia = profilo.braccia || '#a5b4fc';
      const alone = ctx.createRadialGradient(x, y, R * 0.5, x, y, R * 1.6);
      alone.addColorStop(0, rgba(braccia, 0.45)); alone.addColorStop(1, rgba(braccia, 0));
      ctx.fillStyle = alone; ctx.beginPath(); ctx.arc(x, y, R * 1.6, 0, Math.PI * 2); ctx.fill();
      const giro = t / 14000;
      const passo = Math.tan(16 * Math.PI / 180);
      // un braccio: una spirale logaritmica affusolata, dal nucleo verso fuori
      const braccio = (b, larg, colore, alfa) => {
        const n = 30, fine = Math.log(1.6 / 0.7) / passo, sx = [], dx = [], centro = [];
        for (let i = 0; i <= n; i++) {
          const f = fine * i / n, u = i / n;
          const r = R * 0.7 * Math.exp(passo * f), a = giro + b + f;
          const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.9;
          // la normale alla spirale, per lo spessore (quasi radiale: il
          // braccio si avvolge di pochi gradi)
          const ta = a - Math.atan(passo);
          const w = R * larg * (1 - u * 0.85) / 2;
          sx.push([px + Math.cos(ta) * w, py + Math.sin(ta) * w * 0.9]);
          dx.push([px - Math.cos(ta) * w, py - Math.sin(ta) * w * 0.9]);
          centro.push([px, py]);
        }
        const forma = () => {
          ctx.beginPath(); ctx.moveTo(...sx[0]);
          for (const q of sx) ctx.lineTo(...q);
          for (let i = dx.length - 1; i >= 0; i--) ctx.lineTo(...dx[i]);
          ctx.closePath();
        };
        ctx.save();
        ctx.globalAlpha *= alfa;
        forma(); ctx.strokeStyle = ALONE; ctx.lineWidth = 2.6; ctx.stroke();
        ctx.fillStyle = colore; ctx.fill();
        // la riga chiara al centro del braccio, e la polvere scura sul bordo interno
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(0.8, R * larg * 0.18);
        polilinea(ctx, centro.slice(0, -4)); ctx.stroke();
        ctx.strokeStyle = rgba(INCHIOSTRO, 0.45); ctx.lineWidth = Math.max(0.6, R * 0.025);
        polilinea(ctx, dx.slice(2, -6)); ctx.stroke();
        forma(); ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(1, R * 0.03); ctx.stroke();
        // le stelle lungo il braccio
        ctx.fillStyle = '#fffbeb';
        for (let i = 4; i < centro.length - 2; i += 4) {
          const [px, py] = centro[i], q = Math.max(0.8, R * 0.03) * (0.7 + 0.5 * Math.abs(Math.sin(t / 500 + i + b)));
          stella(ctx, px, py, q * 2.2, q * 0.6, 4, 0); ctx.fill();
        }
        ctx.restore();
      };
      braccio(Math.PI / 2, 0.22, schiarisci(braccia, 0.2), 0.75);
      braccio(Math.PI * 1.5, 0.22, schiarisci(braccia, 0.2), 0.75);
      braccio(0, 0.36, braccia, 1);
      braccio(Math.PI, 0.36, braccia, 1);
      parte(ctx, () => { ctx.beginPath(); ctx.arc(x, y, R * 0.8, 0, Math.PI * 2); }, profilo.pelle, R, {
        luce: 0.1, buio: 0.12,
        dentro: () => {
          const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.8);
          g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
        }
      });
    } else if (sagoma === 'gigante_rossa') {
      // La supergigante rossa ribolle: celle di gas grandi come l'orbita
      // della Terra salgono e scendono, il contorno ondeggia piano, e
      // attorno c'è il velo di polvere che ha già soffiato via (quello che
      // nel 2019-2020 la fece scurire, e tutti pensarono che stesse per
      // esplodere)
      const raggi = profilo.raggi || '#dc2626';
      const velo = ctx.createRadialGradient(x, y, R * 0.85, x, y, R * 1.7);
      velo.addColorStop(0, rgba(schiarisci(raggi, 0.15), 0.45)); velo.addColorStop(1, rgba(raggi, 0));
      ctx.fillStyle = velo; ctx.beginPath(); ctx.arc(x, y, R * 1.7, 0, Math.PI * 2); ctx.fill();
      const st = { s: seme(profilo.id || 'gigante') || 1 };
      ctx.fillStyle = rgba(schiarisci(raggi, 0.25), 0.4);
      for (let k = 0; k < 7; k++) {
        const a = k / 7 * Math.PI * 2 + dado(st) * 0.8, d = R * (1.28 + 0.1 * Math.sin(t / 2300 + k * 1.9));
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, R * (0.09 + dado(st) * 0.08), 0, Math.PI * 2); ctx.fill();
      }
      const bordo = () => {
        const n = 40, punti = [];
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2;
          const r = R * (1 + 0.045 * Math.sin(3 * a + t / 1300) + 0.03 * Math.sin(5 * a - t / 900 + 1.3) + 0.018 * Math.sin(8 * a + t / 700));
          punti.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
        }
        const mezzo = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        ctx.beginPath(); ctx.moveTo(...mezzo(punti[n - 1], punti[0]));
        for (let i = 0; i < n; i++) ctx.quadraticCurveTo(...punti[i], ...mezzo(punti[i], punti[(i + 1) % n]));
        ctx.closePath();
      };
      parte(ctx, bordo, profilo.pelle, R, {
        luce: 0.12, buio: 0.3,
        dentro: () => {
          // le celle: chiazze chiare (il gas caldo che sale) e scure (quello
          // freddo che scende), che respirano piano; ai bordi, lontano dagli occhi
          for (const [dx, dy, r, chiara] of [[-0.62, -0.5, 0.26, 1], [0.66, -0.42, 0.22, 0], [-0.72, 0.36, 0.2, 0], [0.7, 0.44, 0.25, 1],
            [0, -0.86, 0.2, 1], [-0.2, 0.86, 0.18, 1], [0.32, 0.8, 0.14, 0], [-0.9, -0.05, 0.14, 1], [0.9, 0, 0.13, 0]]) {
            const q = r * R * (1 + 0.12 * Math.sin(t / 1100 + dx * 7 + dy * 5));
            ctx.fillStyle = chiara ? rgba('#fdba74', 0.5) : rgba(scurisci(profilo.pelle, 0.22), 0.45);
            ctx.beginPath(); ctx.ellipse(x + dx * R, y + dy * R, q, q * 0.82, dx + dy, 0, Math.PI * 2); ctx.fill();
          }
        }
      });
    } else if (sagoma === 'nana_bianca') {
      // La nana bianca: piccola, caldissima, densa. Un disco bianco che
      // splende azzurro, con le quattro punte di luce di una stella vista al
      // telescopio che pulsano appena
      const raggi = profilo.raggi || '#93c5fd';
      const alone = ctx.createRadialGradient(x, y, R * 0.7, x, y, R * 1.6);
      alone.addColorStop(0, rgba(raggi, 0.7)); alone.addColorStop(1, rgba(raggi, 0));
      ctx.fillStyle = alone; ctx.beginPath(); ctx.arc(x, y, R * 1.6, 0, Math.PI * 2); ctx.fill();
      const lampo = 1 + 0.05 * Math.sin(t / 380);
      parte(ctx, () => stella(ctx, x, y, R * 1.42 * lampo, R * 0.2, 4, -Math.PI / 2), '#f8fbff', R, { buio: 0.12, pennino: 0.03 });
      parte(ctx, () => stella(ctx, x, y, R * 1.12, R * 0.3, 4, -Math.PI / 4), schiarisci(raggi, 0.5), R, { buio: 0.12, pennino: 0.025 });
      disegnaDisco(ctx, x, y, R * 0.97, profilo.pelle, () => {
        ctx.strokeStyle = rgba(raggi, 0.6); ctx.lineWidth = R * 0.12;
        ctx.beginPath(); ctx.arc(x, y, R * 0.92, 0, Math.PI * 2); ctx.stroke();
      });
    } else if (sagoma === 'supernova') {
      // La supernova: la stella che è esplosa. Dietro, la nuvola che si
      // allarga (la nebulosa del Granchio: un bagliore azzurro con i
      // filamenti rossi e arancioni), le onde d'urto che corrono via, la
      // stella di fuoco a punte; in mezzo il cuore rimasto, la stella di
      // neutroni, coi due fasci di luce che girano come un faro (la pulsar
      // del Granchio gira trenta volte al secondo: qui molto più piano)
      const raggi = profilo.raggi || '#f97316';
      const st = { s: seme(profilo.id || 'supernova') || 1 };
      const nube = ctx.createRadialGradient(x, y, R * 0.5, x, y, R * 1.7);
      nube.addColorStop(0, rgba('#93c5fd', 0.55)); nube.addColorStop(0.7, rgba('#a5b4fc', 0.3)); nube.addColorStop(1, rgba('#a5b4fc', 0));
      ctx.fillStyle = nube;
      ctx.beginPath();
      for (let i = 0; i <= 18; i++) {
        const a = i / 18 * Math.PI * 2, r = R * (1.45 + 0.2 * Math.sin(a * 3 + 1.1) + 0.12 * Math.sin(a * 5 + 2.3));
        if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.85); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.85);
      }
      ctx.closePath(); ctx.fill();
      // i filamenti: tratti mossi dal centro verso fuori
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2 + dado(st) * 0.3, r0 = R * (0.95 + dado(st) * 0.2), r1 = R * (1.4 + dado(st) * 0.3);
        const piega = (dado(st) - 0.5) * 0.5;
        const c = k % 3 ? raggi : '#ef4444';
        ctx.strokeStyle = ALONE; ctx.lineWidth = Math.max(1.6, R * 0.07);
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.85);
        ctx.quadraticCurveTo(x + Math.cos(a + piega) * (r0 + r1) / 2, y + Math.sin(a + piega) * (r0 + r1) / 2 * 0.85, x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.85);
        ctx.stroke();
        ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.9, R * 0.04); ctx.stroke();
      }
      // le onde d'urto che corrono via, una dopo l'altra
      for (let k = 0; k < 3; k++) {
        const f = (t / 2600 + k / 3) % 1;
        ctx.strokeStyle = rgba(schiarisci(raggi, 0.3), (1 - f) * 0.7); ctx.lineWidth = Math.max(0.8, R * 0.07 * (1 - f));
        ctx.beginPath(); ctx.ellipse(x, y, R * (0.95 + 0.85 * f), R * (0.95 + 0.85 * f) * 0.85, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // i due fasci della pulsar
      const faro = t / 1400;
      for (const lato of [0, Math.PI]) {
        const a = faro + lato, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, L = R * 1.8;
        const g = ctx.createLinearGradient(x, y, x + ux * L, y + uy * L);
        g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(186,230,253,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x + nx * R * 0.06, y + ny * R * 0.06);
        ctx.lineTo(x + ux * L + nx * R * 0.22, y + uy * L + ny * R * 0.22);
        ctx.lineTo(x + ux * L - nx * R * 0.22, y + uy * L - ny * R * 0.22);
        ctx.lineTo(x - nx * R * 0.06, y - ny * R * 0.06); ctx.closePath(); ctx.fill();
      }
      // la stella di fuoco a punte, che pulsa
      const pulsa = 1 + 0.06 * Math.sin(t / 260);
      parte(ctx, () => stella(ctx, x, y, R * 1.18 * pulsa, R * 0.86, 12, t / 9000), '#fde047', R, { buio: 0.15, pennino: 0.03 });
      parte(ctx, () => stella(ctx, x, y, R * 1.0 * pulsa, R * 0.8, 9, -t / 7000), schiarisci(raggi, 0.15), R, { buio: 0.12, pennino: 0.025 });
      disegnaDisco(ctx, x, y, R * 0.8, profilo.pelle);
    } else if (sagoma === 'buco_nero') {
      // Il buco nero: un'ombra tonda da cui la luce non esce, l'anello di luce
      // che le gira attorno (quello delle fotografie del 2019 e del 2022), il
      // disco di gas caldo che ci gira dentro come l'acqua nel lavandino. La
      // metà di dietro del disco sta sotto all'ombra, quella davanti sopra,
      // abbastanza in basso da passare sotto alla bocca, come gli anelli di
      // Saturno; e la parte lontana del disco si vede piegata sopra
      // all'ombra, perché la gravità piega la luce. Il lato che viene verso di
      // noi è più chiaro (si vede davvero così).
      const disco = profilo.disco || '#fb923c';
      const alone = ctx.createRadialGradient(x, y, R * 0.95, x, y, R * 1.8);
      alone.addColorStop(0, rgba(disco, 0.5)); alone.addColorStop(1, rgba(disco, 0));
      ctx.fillStyle = alone; ctx.beginPath(); ctx.arc(x, y, R * 1.8, 0, Math.PI * 2); ctx.fill();
      const ax = x, ay = y + R * 0.34, rx = R * 1.7, ry = R * 0.36, giro = -0.08;
      const luce = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
      luce.addColorStop(0, '#fef3c7'); luce.addColorStop(0.4, disco); luce.addColorStop(1, scurisci(disco, 0.3));
      const metaDisco = (da, a) => {
        ctx.lineCap = 'butt';
        ctx.strokeStyle = ALONE; ctx.lineWidth = R * 0.34 + 3;
        ctx.beginPath(); ctx.ellipse(ax, ay, rx, ry, giro, da, a); ctx.stroke();
        for (const [w, c] of [[R * 0.34, INCHIOSTRO], [R * 0.27, luce], [R * 0.08, rgba('#fffbeb', 0.85)]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.ellipse(ax, ay, rx, ry, giro, da, a); ctx.stroke();
        }
        // il gas che gira: trattini che scorrono lungo il disco
        ctx.strokeStyle = rgba(scurisci(disco, 0.35), 0.55); ctx.lineWidth = Math.max(0.8, R * 0.035);
        ctx.setLineDash([R * 0.22, R * 0.3]); ctx.lineDashOffset = t / 30;
        ctx.beginPath(); ctx.ellipse(ax, ay, rx * 0.93, ry * 0.86, giro, da, a); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(ax, ay, rx * 1.06, ry * 1.12, giro, da, a); ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineCap = 'round';
      };
      metaDisco(Math.PI, Math.PI * 2);
      // la luce piegata sopra all'ombra
      ctx.strokeStyle = ALONE; ctx.lineWidth = R * 0.2 + 3;
      ctx.beginPath(); ctx.arc(x, y, R * 1.13, Math.PI * 1.06, Math.PI * 1.94); ctx.stroke();
      ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = R * 0.2; ctx.stroke();
      ctx.strokeStyle = luce; ctx.lineWidth = R * 0.14; ctx.stroke();
      // l'anello di luce, che tremola appena
      ctx.strokeStyle = rgba('#fde68a', 0.85 + 0.15 * Math.sin(t / 420)); ctx.lineWidth = Math.max(1.4, R * 0.07);
      ctx.beginPath(); ctx.arc(x, y, R * 1.02, 0, Math.PI * 2); ctx.stroke();
      // l'ombra: il viola quasi nero della pelle, più buio verso il centro
      parte(ctx, () => { ctx.beginPath(); ctx.arc(x, y, R * 0.97, 0, Math.PI * 2); }, profilo.pelle, R, {
        luce: 0.06, buio: 0.35,
        dentro: () => {
          const g = ctx.createRadialGradient(x, y, 0, x, y, R);
          g.addColorStop(0, 'rgba(5, 2, 14, 0.55)'); g.addColorStop(1, 'rgba(5, 2, 14, 0)');
          ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
        }
      });
      metaDisco(0, Math.PI);
    } else if (sagoma === 'buco_bianco') {
      // Il buco bianco: il buco nero al contrario, da cui le cose possono
      // solo uscire. Nessuno ne ha mai visto uno: esiste nelle equazioni di
      // Einstein, e per questo è disegnato **a tratteggio**, come un'idea
      // a matita. La luce corre fuori, in raggi e in onde che si allargano.
      const alone = ctx.createRadialGradient(x, y, R * 0.8, x, y, R * 1.65);
      alone.addColorStop(0, 'rgba(165, 243, 252, 0.6)'); alone.addColorStop(1, 'rgba(165, 243, 252, 0)');
      ctx.fillStyle = alone; ctx.beginPath(); ctx.arc(x, y, R * 1.65, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 3; k++) {
        const f = (t / 1800 + k / 3) % 1;
        ctx.strokeStyle = rgba('#67e8f9', (1 - f) * 0.65); ctx.lineWidth = Math.max(0.8, R * 0.06 * (1 - f));
        ctx.beginPath(); ctx.arc(x, y, R * (1.02 + 0.55 * f), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.setLineDash([R * 0.14, R * 0.12]); ctx.lineDashOffset = -t / 25;
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2 + 0.13;
        const x0 = x + Math.cos(a) * R * 1.05, y0 = y + Math.sin(a) * R * 1.05, x1 = x + Math.cos(a) * R * 1.55, y1 = y + Math.sin(a) * R * 1.55;
        ctx.strokeStyle = ALONE; ctx.lineWidth = Math.max(2, R * 0.08);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = Math.max(1, R * 0.04); ctx.stroke();
      }
      ctx.setLineDash([]);
      const forma = () => { ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); };
      const g = ctx.createRadialGradient(x - R * 0.2, y - R * 0.2, 0, x, y, R);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.75, profilo.pelle); g.addColorStop(1, '#cffafe');
      forma(); ctx.fillStyle = g; ctx.fill();
      ctx.save(); forma(); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.ellipse(x - R * 0.5, y - R * 0.52, R * 0.17, R * 0.09, -0.75, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // il contorno a tratteggio, che gira piano
      ctx.setLineDash([R * 0.2, R * 0.13]); ctx.lineDashOffset = -t / 60;
      forma(); ctx.strokeStyle = ALONE; ctx.lineWidth = Math.max(3, R * 0.12); ctx.stroke();
      ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = Math.max(1.4, R * 0.05); ctx.stroke();
      ctx.setLineDash([]);
    } else if (sagoma === 'hubble') {
      // i due pannelli lunghi ai lati, il tubo argentato, il coperchio aperto
      for (const lato of [-1, 1]) {
        asta(ctx, x + lato * R * 0.6, y, x + lato * R * 0.84, y, Math.max(1.2, R * 0.05));
        pannello(ctx, lato < 0 ? x - R * 1.3 : x + R * 0.84, y - R * 0.8, R * 0.46, R * 1.6, R);
      }
      parte(ctx, () => rettangolo(ctx, x - R * 0.64, y - R * 0.96, R * 1.28, R * 1.94, R * 0.3), profilo.pelle, R, {
        dentro: () => {
          ctx.strokeStyle = rgba(INCHIOSTRO, 0.25); ctx.lineWidth = Math.max(0.6, R * 0.016);
          ctx.beginPath();
          for (const k of [-0.62, 0.68]) { ctx.moveTo(x - R * 0.64, y + k * R); ctx.lineTo(x + R * 0.64, y + k * R); }
          ctx.stroke();
          ctx.fillStyle = rgba('#9ca3af', 0.35);
          ctx.fillRect(x - R * 0.64, y + R * 0.68, R * 1.28, R * 0.3);
        }
      });
      parte(ctx, () => { ctx.beginPath(); ctx.ellipse(x - R * 0.1, y - R * 1.12, R * 0.62, R * 0.15, -0.35, 0, Math.PI * 2); }, '#d1d5db', R, { pennino: 0.03 });
      ctx.fillStyle = '#1e1b3a';
      ctx.beginPath(); ctx.ellipse(x, y - R * 0.96, R * 0.5, R * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ===================================================================
  // 6-quinquies. Il palco: dove va ogni volto, e il disegno di tutti
  // ===================================================================

  // Il corpo messo accanto, col filo tratteggiato che lo lega all'astro vero: il
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
  function storPosa(pg, R, t, desDa, apertura, parla, ridotto, corpoSiMuove) {
    const posa = { dx: 0, dy: 0, giro: 0, sx: 1, sy: 1 };
    if (ridotto) return posa;
    const e = pg.espr || {};
    const u = Math.max(0, Math.min(1, desDa / STOR_COMPARSA_MS));
    // fuori-indietro: 0 → oltre 1 → 1
    const c1 = 2.2, v = u - 1;
    const pop = u >= 1 ? 1 : Math.max(0, 1 + (c1 + 1) * v * v * v + c1 * v * v);
    // La fisica muove anche il corpo (v430): Mercurio respira svelto e ha il
    // nervoso addosso, Giove e Nettuno sono lenti, Urano tiene la testa
    // piegata come il suo asse coricato
    const fis = pg.profilo ? storFisica(storVesteProfilo(pg)) : null;
    const passo = fis ? fis.passo : 1;
    const respiro = Math.sin(t * passo / 950 + (pg.fase || 0)) * 0.014;
    posa.sx = pop * (1 - respiro * 0.5);
    posa.sy = pop * (1 + respiro);
    if (parla) { posa.sy += apertura * 0.1; posa.sx -= apertura * 0.05; posa.giro += Math.sin(t / 230 + (pg.fase || 0)) * 0.035 * apertura; }
    // Il corpo di chi parla (v427): rotazione e schiacciamento sempre; lo
    // spostamento qui solo dove l'astro non si muove da sé (nella 3D lo
    // porta già `storScena3D`, e il volto lo segue)
    const mp = storMotoParlato(pg, t);
    posa.giro += mp.giro; posa.sx *= mp.sx; posa.sy *= mp.sy;
    if (!corpoSiMuove) { posa.dx += mp.dx * R; posa.dy += mp.dy * R; }
    const w = (t - (pg.cambioDa || -1e9)) / STOR_BOING_MS;
    if (w >= 0 && w < 1) { const k = Math.sin(w * Math.PI * 2.5) * (1 - w) * 0.11; posa.sx += k; posa.sy -= k; }
    posa.dy -= Math.abs(Math.sin(t / 230 + (pg.fase || 0))) * R * 0.05 * (e.rimbalzo || 0);
    posa.dx += Math.sin(t * 0.11) * R * 0.014 * (e.tremito || 0);
    posa.giro += (e.testa || 0) + Math.sin(t / 1300 + (pg.fase || 0)) * 0.02;
    if (fis) {
      posa.giro += fis.testa;
      if (fis.tremito) {
        posa.dx += Math.sin(t * 0.09 * passo + (pg.fase || 0)) * R * 0.03 * fis.tremito;
        posa.giro += Math.sin(t * 0.05 * passo) * 0.05 * fis.tremito;
      }
    }
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
    // La domanda al pubblico (v430) sta sopra a tutto, anche senza personaggi
    const domanda = vista !== 'anteprima' && stor.domanda;
    if (!stor.personaggi.size && !stor.effetti.length) {
      if (domanda) storDisegnaDomanda(ctx, L, H);
      stor.ultimiDisegnati = disegnati; return disegnati;
    }
    const perId = new Map();
    for (const c of corpi) { const id = storCanonico(c.id); if (!perId.has(id)) perId.set(id, c); }
    const voce = radice.narrazione && typeof radice.narrazione.voce === 'function' ? radice.narrazione.voce() : null;
    const chiOra = storChiParlaOra();
    const parlante = chiOra && voce && voce.personaggio === chiOra ? chiOra : null;
    const ritmi = storDisegnaPersonaggi.ritmi || (storDisegnaPersonaggi.ritmi = new Map());
    const presi = [];
    const dt = Math.max(0, stor.orologio - (stor.ultimoOrologio || stor.orologio));
    stor.ultimoOrologio = stor.orologio;
    const ridotto = stor.ridotto;
    // Nella vista 3D l'astro porta il volto addosso: con `size: auto` è
    // cresciuto apposta (`storRaggio3D`), e l'adesivo accanto resta solo per
    // chi lo chiede (`badge`) o vuole la misura vera (`real`).
    const in3d = vista === 'sistema' || vista === 'vicino';
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
      const p = storVesteProfilo(pg);
      const Rdisco = c.r * p.scala;
      // Con un po' di isteresi: durante uno zoom il volto non deve saltare
      // avanti e indietro fra il disco e il disco grafico accanto.
      const soglia = STOR_VOLTO_MIN_PX * (pg.addossoPrima ? 0.88 : 1.1);
      // Chi ha una veste (`character_become`) non è più l'astro che l'app ha
      // disegnato: porta il suo corpo nuovo, sopra all'astro
      const addosso = pg.misura !== 'costume' && (pg.misura === 'disk' || (in3d && pg.misura === 'auto') ||
        (pg.misura !== 'badge' && Rdisco >= soglia)) && (in3d || !pg.veste);
      pg.addossoPrima = addosso;
      pg.punto = { x: c.px, y: c.py };
      // Nella 3D una sonda, una stazione, un asteroide non hanno un disco su
      // cui mettere il volto (l'app li disegna come un segno): il corpo lo
      // disegna questo modulo, lì dove l'app ha messo l'astro (§6-quater)
      const corpo3d = in3d && addosso && pg.misura !== 'real' && (STOR_SAGOME_FORMA.includes(p.sagoma) || !!pg.veste);
      piano.push({ pg, c, addosso, Rdisco, corpo3d });
      if (corpo3d) {
        const Rc = Math.max(c.r, STOR_VOLTO_3D_PX * (pg.prosp || 1) / STOR_CORPI[p.sagoma].volto[2]);
        presi.push({ id: pg.id, x: c.px, y: c.py, R: Rc * ingombroDi(p) });
      } else if (addosso) presi.push({ id: pg.id, x: c.px + p.dx * c.r, y: c.py + p.dy * c.r, R: Rdisco });
    }
    // Un disco grafico non deve coprire l'astro di un altro personaggio
    for (const { pg, c } of piano) presi.push({ id: pg.id, astro: true, x: c.px, y: c.py, R: Math.max(8, c.r) });
    const Rbadge = Math.max(STOR_DISCO_MIN_PX, Math.min(STOR_DISCO_MAX_PX, Math.min(L, H) * 0.075));
    const m = Object.assign({ su: STOR_MARGINE_PX, giu: STOR_MARGINE_PX, lati: STOR_MARGINE_PX }, margini || {});
    for (const posa of piano) {
      const { pg, c, addosso } = posa;
      const p = storVesteProfilo(pg);
      let cx, cy, R, posto = null;
      if (posa.corpo3d) {
        R = Math.max(c.r, STOR_VOLTO_3D_PX * (pg.prosp || 1) / STOR_CORPI[p.sagoma].volto[2]);
        cx = c.px; cy = c.py;
        posto = { x: cx, y: cy, R, centrato: true, in3d: true };
      } else if (addosso) { R = posa.Rdisco; cx = c.px + p.dx * c.r; cy = c.py + p.dy * c.r; }
      else {
        /* Il personaggio è troppo piccolo per portare il volto: ha un corpo
         * disegnato (§6-quater), e il corpo si mette **sull'astro**, al suo
         * posto (v411) — l'astro è lui. Solo se lì non c'entra (il bordo
         * dello schermo, un altro personaggio troppo vicino) o se la storia
         * chiede `badge`, va accanto, legato all'astro da un filo. */
        R = pg.misura === 'costume' && c.costumeR ? c.costumeR : pg.veste ? Math.max(Rbadge, c.r) : Rbadge;
        const Ri = R * ingombroDi(in3d ? p.sagoma : p);
        const ondeggia = ridotto ? 0 : Math.sin(stor.orologio / 1700 + pg.fase) * 1.2;
        // Fuori dal quadro della scala cosmica, o un'idea che non sta sulla
        // carta (il buco bianco): niente filo verso un astro
        const fuori = Number.isFinite(c.freccia) || !!c.idea;
        const libero = pg.misura === 'costume' || ((pg.misura === 'auto' || fuori) &&
          c.px - Ri >= m.lati && c.px + Ri <= L - m.lati && c.py - Ri >= m.su && c.py + Ri <= H - m.giu &&
          !presi.some(q => q.id !== pg.id && Math.hypot(q.x - c.px, q.y - c.py) < q.R + Ri + 4));
        if (libero) {
          cx = c.px; cy = c.py + (pg.misura === 'costume' ? 0 : ondeggia);
          posto = { x: cx, y: cy, R, centrato: true };
        } else {
          const s = storPostoDisco(pg.id, c.px, c.py, c.r, Ri, L, H, presi, margini);
          cx = s.x; cy = s.y + ondeggia;
          // chi è fuori dal quadro non ha un filo verso il bordo: ha la freccia
          posto = fuori ? { x: cx, y: cy, R, centrato: true } : { x: cx, y: cy, R, ax: c.px, ay: c.py, ar: c.r };
        }
        presi.push({ id: pg.id, x: cx, y: cy, R: Ri });
      }
      // La fisica risponde all'umore (v430, §6-sexies): tempeste, prominenze,
      // atmosfera, lune e anelli scivolano verso la reazione voluta, e il
      // tempo delle lune corre più o meno svelto senza mai saltare
      const fis = storFisica(p);
      const kR = ridotto ? 1 : 1 - Math.exp(-dt / STOR_TAU_REAZIONE);
      pg.reazione = mescolaReazione(pg.reazione, storReazioneFisica(fis, pg.espressione, pg.energia || 0), kR);
      if (!ridotto) pg.tempoLune = (pg.tempoLune || 0) + dt * Math.max(0, pg.reazione.luneGiro) * fis.passo;
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
          pg.prossimaSaccade = stor.orologio + (STOR_SACCADI_MS[0] + dado(pg.dado) * (STOR_SACCADI_MS[1] - STOR_SACCADI_MS[0])) / fis.passo;
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
      const meta = storBoccaBersaglio(pg.espr, forma);
      if (forma.apertura > 0) {
        const kB = 1 - Math.exp(-dt / STOR_TAU_BOCCA_APRE);
        pg.bocca = mescolaBocca(pg.bocca, meta, Math.max(kB, 0.35));
      } else if (ridotto) pg.bocca = Object.assign({}, meta);
      else {
        // si chiude in due fotogrammi: subito per l'occhio, ma senza lo
        // scatto da una forma all'altra a fine frase e a ogni cambio d'umore
        const kB = 1 - Math.exp(-dt / STOR_TAU_BOCCA_CHIUDE);
        pg.bocca = mescolaBocca(pg.bocca, meta, Math.max(kB, 0.5));
      }
      pg.forma = forma.forma; pg.apertura = forma.apertura; pg.via = forma.via || '';
      // L'energia di chi parla (v427): sale in fretta e scende piano, così il
      // corpo non scatta all'inizio e alla fine di una battuta
      if (staParlando && !(pg.energia > 0.02)) pg.parlaDa = stor.orologio;
      const kEn = ridotto ? 1 : 1 - Math.exp(-dt / (staParlando ? 240 : 520));
      pg.energia = mix(pg.energia || 0, staParlando ? 1 : 0, kEn);
      // Sul corpo disegnato il volto sta dove dice la sagoma: sulla
      // parabola della Voyager, sul modulo centrale della stazione, un po'
      // più dentro del bordo di un disco (un occhio che tocca il contorno
      // sembra uscire dal disco).
      const sulCorpo = posto ? storVoltoNelCorpo(p.sagoma, cx, cy, R) : { cx, cy, R };
      const geom = storGeometria(sulCorpo.cx, sulCorpo.cy, sulCorpo.R, p, {
        espr: pg.espr, sguardo: pg.sguardo, battito, bocca: pg.bocca,
        alzaCigli: staParlando && !ridotto ? forma.apertura : 0
      });
      // Il volto girato (v432): nella 3D e nella scala cosmica, quando la
      // regia gira la camera attorno, il volto resta dov'era sulla sfera
      if (vista === 'sistema' || vista === 'vicino' || vista === 'cosmo') geom.yaw = stor.regia.giro || 0;
      // Il segno da fumetto (le scintille, la goccia) è del volto: girato di
      // spalle se ne va con lui (v433), di lato si vede appena
      const segnoVisto = Math.max(0, Math.min(1, Math.cos(geom.yaw || 0) * 1.6 + 0.4));
      const t = stor.orologio;
      const desDa = t - pg.comparsoDa;
      const alfa = ridotto ? Math.min(1, desDa / 320) : Math.min(1, desDa / (STOR_COMPARSA_MS * 0.35));
      // Il corpo del volto: comparsa elastica, respiro, rimbalzo, tremito,
      // testa inclinata, la «molla» di un cambio d'espressione e lo
      // schiacciamento delle sillabe. Si muovono i tratti (e l'adesivo), mai
      // l'astro: la Luna resta dov'è e com'è, il volto le vive sopra.
      const att = storPosa(pg, R, t, desDa, forma.apertura, staParlando, ridotto, in3d);
      // Le animazioni (§5-bis). Nella 3D il salto e la danza hanno già
      // spostato l'astro vero, e il volto lo segue da sé: qui restano la
      // rotazione e lo schiacciamento. Nel planetario l'astro non si muove,
      // e allora si muove il volto (o l'adesivo) tutto intero, con la scala.
      const an = storAnimazioniDi(pg);
      att.giro += an.giro; att.sx *= an.sx; att.sy *= an.sy;
      if (!in3d) {
        const sc = storScalaDi(pg) * an.k;
        att.dx += an.dx * R; att.dy += an.dy * R; att.sx *= sc; att.sy *= sc;
      }
      // Il volto addosso è dipinto **sulla sfera**: guardando di lato la
      // faccia scivola verso quel lato e si accorcia, come una testa che si
      // gira, e non esce dal disco dell'astro.
      const giraTesta = posto || ridotto ? null : {
        ox: pg.sguardo.x * R * 0.14, oy: pg.sguardo.y * R * 0.1,
        sx: 1 - Math.min(0.2, Math.abs(pg.sguardo.x) * 0.14), sy: 1 - Math.min(0.15, Math.abs(pg.sguardo.y) * 0.1)
      };
      const trasforma = g => {
        g.translate(cx + att.dx, cy + att.dy);
        if (giraTesta) { g.translate(giraTesta.ox, giraTesta.oy); g.scale(giraTesta.sx, giraTesta.sy); }
        g.rotate(att.giro); g.scale(att.sx, att.sy); g.translate(-cx, -cy);
      };
      if (posto) {
        if (!posto.centrato) disegnaSupporto(ctx, posto, p, alfa, t);
        // La coda di una cometa va dalla parte opposta al Sole
        let pc = p;
        if (p.sagoma === 'cometa') {
          const sole = perId.get('Sun');
          const verso = c.luce && Number.isFinite(c.luce.x) ? Math.atan2(-c.luce.y, -c.luce.x)
            : sole && Number.isFinite(sole.px) && Math.hypot(sole.px - c.px, sole.py - c.py) > 1 ? Math.atan2(c.py - sole.py, c.px - sole.px) : NaN;
          pc = Object.assign({}, p, { codaVerso: verso });
        }
        pc = Object.assign({}, pc, { reazione: pg.reazione });
        // Nella 3D le lune e gli anelli veri li disegna l'app
        const opzFis = { ridotto, tempoLune: pg.tempoLune || 0, lune: !posto.in3d, anelli: !posto.in3d };
        const tutto = g => {
          g.save(); trasforma(g);
          g.save(); g.globalAlpha *= alfa;
          storDisegnaFisica(g, 'dietro', cx, cy, R, fis, pg.reazione, t, opzFis);
          disegnaCorpo(g, cx, cy, R, pc, t);
          storDisegnaFisica(g, 'davanti', cx, cy, R, fis, pg.reazione, t, opzFis);
          g.restore();
          storDisegnaVolto(g, geom, p, alfa, t);
          g.restore();
        };
        if (posto.in3d) conLuce(ctx, cx + att.dx, cy + att.dy, R * 2.2, c.luce, tutto);
        else tutto(ctx);
        ctx.save(); trasforma(ctx);
        storDisegnaSegno(ctx, geom, pg.segno, t, Math.min(1, (t - pg.segnoDa) / 380) * alfa * segnoVisto, ridotto);
        ctx.restore();
      } else {
        // Sull'astro: ritagliato sul suo disco e illuminato dal suo Sole.
        // Nel planetario no: lì un salto porta il volto fuori dall'astro,
        // che resta fermo dov'è davvero.
        const ritaglia = in3d;
        // La fisica sull'astro vero (v430): dietro, solo fuori dal suo disco
        // (l'atmosfera, la corona, le prominenze); le lune e gli anelli solo
        // nel planetario, perché nella 3D ci sono già quelli veri
        const opzFis = { ridotto, tempoLune: pg.tempoLune || 0, fuori: true, lune: !in3d, anelli: !in3d };
        ctx.save(); ctx.globalAlpha *= alfa;
        storDisegnaFisica(ctx, 'dietro', c.px, c.py, c.r, fis, pg.reazione, t, opzFis);
        ctx.restore();
        const volto = g => {
          g.save();
          if (ritaglia) { g.beginPath(); g.arc(c.px, c.py, Math.max(c.r * 1.02, R * 1.05), 0, Math.PI * 2); g.clip(); }
          // le tempeste stanno sul disco, sotto al volto, e prendono la sua luce
          g.save(); g.globalAlpha *= alfa;
          storDisegnaFisica(g, 'davanti', c.px, c.py, c.r, fis, pg.reazione, t, opzFis);
          g.restore();
          trasforma(g);
          storDisegnaVolto(g, geom, p, alfa, t);
          g.restore();
        };
        conLuce(ctx, cx + att.dx, cy + att.dy, Math.max(c.r * 1.1, R * 1.6), in3d ? c.luce : null, volto);
        ctx.save(); trasforma(ctx);
        storDisegnaSegno(ctx, geom, pg.segno, t, Math.min(1, (t - pg.segnoDa) / 380) * alfa * segnoVisto, ridotto);
        ctx.restore();
      }
      // Nella scala cosmica, chi è fuori dal quadro ha una freccia verso
      // dove sta davvero
      if (Number.isFinite(c.freccia)) disegnaFreccia(ctx, cx + att.dx, cy + att.dy, R * 1.25, c.freccia, p, alfa);
      disegnati.push({ id: pg.id, vista, x: cx, y: cy, R, addosso: !posto || !!posto.in3d, fuori: Number.isFinite(c.freccia),
        idea: !!c.idea, veste: pg.veste && STOR_VESTI[pg.veste.forma] ? pg.veste.forma : null, scala: att.sx,
        corpo: posto ? p.sagoma : null, centrato: !!(posto && posto.centrato), forma: pg.forma, apertura: pg.apertura, via: pg.via,
        parla: parlante === pg.id && !!(voce && voce.parla), battito, sguardo: Object.assign({}, pg.sguardo),
        espressione: pg.espressione, astro: { x: c.px, y: c.py, r: c.r }, geom });
    }
    // Gli effetti speciali, sopra ai volti; quelli finiti se ne vanno
    if (stor.effetti.length) {
      const t = stor.orologio;
      stor.effetti = stor.effetti.filter(ef => t - ef.inizio <= ef.durata);
      for (const ef of stor.effetti) {
        const posto = storPostoEffetto(ef, perId, L, H);
        // La regia (§7-ter) va a guardare il botto dove è stato disegnato
        ef.ultimoPosto = posto ? { x: posto.x, y: posto.y, r: posto.r, vista } : null;
        if (posto) storDisegnaEffetto(ctx, ef, posto.x, posto.y, posto.r, t, L, H, ridotto);
      }
    }
    if (domanda) storDisegnaDomanda(ctx, L, H);
    stor.ultimiDisegnati = disegnati;
    return disegnati;
  }

  // Una freccia a pennino sul bordo del corpo, verso l'angolo `a`
  function disegnaFreccia(ctx, x, y, d, a, profilo, alfa) {
    ctx.save();
    ctx.globalAlpha *= alfa;
    ctx.translate(x + Math.cos(a) * d, y + Math.sin(a) * d);
    ctx.rotate(a);
    const s = Math.max(7, d * 0.22);
    ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.6, -s * 0.75); ctx.lineTo(-s * 0.25, 0); ctx.lineTo(-s * 0.6, s * 0.75); ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ALONE; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = profilo.sottotitolo || '#fde68a'; ctx.fill();
    ctx.strokeStyle = INCHIOSTRO; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();
  }

  /* Il volto con la luce del suo Sole. Si dipinge su una tela di passaggio
   * e lì sopra si stende l'ombra (`source-atop`: solo dove c'è il volto,
   * non sul pianeta, che la sua ombra l'ha già), poi si appoggia sulla tela
   * vera. `luce` dice da che parte sta il Sole sullo schermo e quanto della
   * faccia rivolta a noi è in ombra; l'ombra si ferma a metà, perché un
   * volto sulla notte di una falce deve restare leggibile. Senza tela di
   * passaggio (le prove Node) si disegna dritto. */
  let telaLuce = null;
  function conLuce(ctx, x, y, mezzo, luce, disegna) {
    const buio = luce ? Math.max(0, Math.min(1, luce.buio || 0)) : 0;
    if (buio < 0.05 || typeof document === 'undefined' || !document.createElement || typeof ctx.getTransform !== 'function') {
      disegna(ctx); return;
    }
    const m = ctx.getTransform();
    const scala = Math.hypot(m.a, m.b) || 1;
    const lato = Math.ceil(mezzo * 2 * scala) + 4;
    if (lato > 2048) { disegna(ctx); return; }
    if (!telaLuce) telaLuce = document.createElement('canvas');
    if (telaLuce.width < lato || telaLuce.height < lato) { telaLuce.width = Math.max(lato, telaLuce.width); telaLuce.height = Math.max(lato, telaLuce.height); }
    const g = telaLuce.getContext('2d');
    if (!g) { disegna(ctx); return; }
    const X0 = Math.floor(m.a * (x - mezzo) + m.c * (y - mezzo) + m.e) - 2, Y0 = Math.floor(m.b * (x - mezzo) + m.d * (y - mezzo) + m.f) - 2;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.clearRect(0, 0, lato, lato);
    g.setTransform(m.a, m.b, m.c, m.d, m.e - X0, m.f - Y0);
    g.globalAlpha = ctx.globalAlpha;
    disegna(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-atop';
    const cx = (m.a * x + m.c * y + m.e) - X0, cy = (m.b * x + m.d * y + m.f) - Y0, R = mezzo * scala;
    const ox = luce.x || 0, oy = luce.y || 0;
    const ombra = g.createLinearGradient(cx + ox * R, cy + oy * R, cx - ox * R, cy - oy * R);
    const a = 0.5 * buio;
    ombra.addColorStop(0, 'rgba(10, 6, 28, 0)');
    ombra.addColorStop(0.45, `rgba(10, 6, 28, ${(a * 0.35).toFixed(3)})`);
    ombra.addColorStop(1, `rgba(10, 6, 28, ${a.toFixed(3)})`);
    g.fillStyle = ombra;
    g.fillRect(0, 0, lato, lato);
    g.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(telaLuce, 0, 0, lato, lato, X0, Y0, lato, lato);
    ctx.restore();
  }

  // ===================================================================
  // 6-sexies. La fisica del personaggio: atmosfera, tempeste, lune e anelli (v430)
  // ===================================================================

  /* Chi cambia corpo (`character_become`) cambia anche fisica: il Sole
   * gigante rossa ha un'atmosfera gonfia e polverosa, da buco nero non ha più
   * prominenze né atmosfera. Il carattere (`tratto`) resta il suo. */
  const STOR_FISICA_VESTI = {
    gigante_rossa: { superficie: 'plasma', atmosfera: { colore: '#f97a5c', spessore: 0.3, densita: 0.6 }, prominenze: true, avatar: 'corona', passo: 0.6 },
    nana_bianca:   { superficie: 'plasma', atmosfera: { colore: '#bfdbfe', spessore: 0.1, densita: 0.5 }, prominenze: false, avatar: 'corona', passo: 1.4 },
    supernova:     { superficie: 'plasma', atmosfera: null, prominenze: false, avatar: 'aura', passo: 1.2 },
    buco_nero:     { superficie: 'orizzonte', atmosfera: null, prominenze: false, avatar: 'aura', passo: 0.7 }
  };
  const STOR_TAU_REAZIONE = 420;   // quanto ci mette la fisica a seguire l'umore
  const fisicheFatte = typeof WeakMap === 'function' ? new WeakMap() : null;
  // La fisica di un profilo: la riga del personaggio sopra a quella della
  // famiglia, e la veste sopra a tutte e due. Si calcola una volta per profilo.
  function storFisica(target) {
    const p = target && typeof target === 'object' ? target : storProfilo(target);
    if (fisicheFatte && fisicheFatte.has(p)) return fisicheFatte.get(p);
    const base = STOR_FISICA_FAMIGLIE[p.famiglia] || STOR_FISICA_FAMIGLIE.pianeta;
    const propria = STOR_FISICA[p.id] || {};
    const f = Object.assign({ superficie: '', atmosfera: null, tempeste: null, prominenze: false, avatar: null, anelli: null, lune: [],
      passo: 1, tremito: 0, testa: 0, tratto: '' }, base, propria);
    const veste = STOR_FISICA_VESTI[p.sagoma];
    if (veste && STOR_FISICA_VESTI[STOR_PERSONAGGI[p.id] && STOR_PERSONAGGI[p.id].sagoma] !== veste)
      Object.assign(f, { tempeste: null, anelli: null, lune: [] }, veste);
    // Saturno ha gli anelli nella sagoma (§6-quater): qui non si ridisegnano
    if (p.sagoma === 'anelli') f.anelli = null;
    f.passo = Math.max(0.3, Math.min(3, Number(f.passo) || 1));
    f.lune = Array.isArray(f.lune) ? f.lune : [];
    // Quanto il corpo esce dal suo raggio con lune e anelli
    f.ingombro = Math.max(1, ...f.lune.map(l => l.d + l.r), f.anelli ? f.anelli.rx : 1);
    if (fisicheFatte) fisicheFatte.set(p, f);
    return f;
  }
  function storTratto(target) {
    const f = storFisica(target);
    return f.tratto ? t('storie.fisica.' + f.tratto) || '' : '';
  }

  /* Come la fisica risponde all'umore, in un istante: una funzione pura
   * della fisica, dell'espressione e dell'energia di chi parla (le prove la
   * leggono). Tutti i campi sono numeri, così due reazioni si mescolano
   * campo per campo e un cambio d'umore scivola invece di scattare. Ciò che
   * il corpo non ha resta spento: Mercurio non ha atmosfera da arrossare,
   * la Luna non ha tempeste. */
  function storReazioneFisica(fis, espressione, energia) {
    const e = STOR_FISICA_EMOZIONI[espressione] || {};
    const en = Math.max(0, Math.min(1, Number(energia) || 0));
    const atmo = e.atmo || {}, lune = e.lune || {}, an = e.anelli || {};
    const base = fis.atmosfera ? fis.atmosfera.colore : '#ffffff';
    const tinta = atmo.tinta ? mescolaColori(base, atmo.tinta, atmo.mix || 0) : base;
    const n = parseInt(/^#?([0-9a-f]{6})$/i.exec(tinta) ? tinta.replace('#', '') : 'ffffff', 16);
    return {
      energia: en,
      tempesta: fis.tempeste ? Math.min(1, (e.tempesta || 0) + 0.15 * en) : 0,
      prominenze: fis.prominenze ? Math.min(1, 0.12 + (e.prominenze || 0) + 0.25 * en) : 0,
      atmoK: fis.atmosfera ? (atmo.k || 1) * (1 + 0.08 * en) : 1,
      atmoAlfa: fis.atmosfera ? (atmo.alfa || 1) : 0,
      atmoR: n >> 16, atmoG: (n >> 8) & 255, atmoB: n & 255,
      luneK: fis.lune.length ? (lune.k || 1) : 1,
      luneGiro: lune.giro === undefined ? 1 : lune.giro,
      luneTremito: lune.tremito || 0, luneBalla: lune.balla || 0, luneCala: lune.cala || 0,
      anelliInclina: an.inclina || 0, anelliApri: an.apri || 0, anelliScuoti: an.scuoti || 0, anelliBrilla: an.brilla || 0,
      avatar: fis.avatar ? Math.min(1, 0.25 + (e.avatar || 0) * 0.75 + 0.2 * en) : 0
    };
  }
  function mescolaReazione(a, b, k) {
    if (!a) return Object.assign({}, b);
    const r = {};
    for (const c of Object.keys(b)) r[c] = mix(Number.isFinite(a[c]) ? a[c] : b[c], b[c], k);
    return r;
  }
  // Il colore dell'atmosfera di adesso, dai tre canali mescolati
  const coloreAtmo = re => '#' + [re.atmoR, re.atmoG, re.atmoB]
    .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

  // Una stellina a quattro punte, il luccichio dei cartoni
  function luccichio(ctx, x, y, s, alfa) {
    if (!(s > 0.4) || !(alfa > 0.02)) return;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, alfa);
    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.fill();
    ctx.restore();
  }
  // Fuori dal disco: per disegnare dietro a un astro che l'app ha già dipinto
  function clipFuoriDisco(ctx, x, y, R) {
    ctx.beginPath();
    ctx.rect(x - R * 6, y - R * 6, R * 12, R * 12);
    ctx.arc(x, y, R, 0, Math.PI * 2, true);
    ctx.clip('evenodd');
  }

  /* Dove sta ogni luna disegnata, in pixel, rispetto al centro del corpo: la
   * sua orbita schiacciata (la vediamo di taglio) e girata, l'angolo che
   * cresce col tempo delle lune (`tempoLune`, che corre più o meno svelto con
   * l'umore senza mai saltare), e la reazione: si stringono, si allargano,
   * tremano, ballano, si lasciano cadere. `davanti` dice se passa davanti al
   * corpo (la metà bassa dell'orbita, verso di noi). Funzione pura. */
  function storPostiLune(fis, re, R, tempoLune, t) {
    const k = re ? re.luneK : 1;
    return fis.lune.map((l, i) => {
      const a = (tempoLune || 0) / (l.periodo || 6000) * Math.PI * 2 + i * 2.1 + 0.6;
      const lx = Math.cos(a) * l.d * k * R, ly = Math.sin(a) * l.d * k * R * (l.piatto || 0.3);
      const g = l.giro || 0, cg = Math.cos(g), sg = Math.sin(g);
      let x = lx * cg - ly * sg, y = lx * sg + ly * cg;
      if (re) {
        x += Math.sin(t * 0.06 + i * 1.9) * R * 0.05 * re.luneTremito;
        y += Math.cos(t * 0.071 + i * 2.3) * R * 0.04 * re.luneTremito;
        y -= Math.abs(Math.sin(t / 240 + i * 1.3)) * R * 0.1 * re.luneBalla;
        y += R * 0.14 * re.luneCala * (0.6 + 0.4 * Math.cos(a));
      }
      return { x, y, r: Math.max(1.2, l.r * R), davanti: Math.sin(a) > 0, luna: l };
    });
  }

  /* Il disegno della fisica, in due strati: `dietro` va prima del corpo
   * (l'avatar d'energia, l'atmosfera, le prominenze, la metà di dietro di
   * anelli e orbite), `davanti` dopo il corpo e prima del volto (le
   * tempeste sul disco, la metà davanti). `opz.fuori` disegna lo strato di
   * dietro solo fuori dal disco: è il caso dell'astro vero, già dipinto
   * dall'app, su cui il volto sta addosso. `opz.lune` e `opz.anelli` li
   * spengono dove l'app disegna già quelli veri (la vista 3D). */
  function storDisegnaFisica(ctx, strato, x, y, R, fis, re, t, opz = {}) {
    if (!fis || !re || !(R > 1)) return;
    const tm = opz.ridotto ? 0 : t;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (strato === 'dietro') {
      ctx.save();
      if (opz.fuori) clipFuoriDisco(ctx, x, y, R * 0.98);
      if (fis.avatar && re.avatar > 0.02) disegnaAvatar(ctx, x, y, R, fis, re, tm);
      if (fis.atmosfera && re.atmoAlfa > 0.02) {
        const a = fis.atmosfera, est = R * (1 + a.spessore * re.atmoK);
        const pulsa = 1 + 0.18 * Math.sin(tm / 170) * re.tempesta;
        const alfa = Math.min(0.85, a.densita * 0.6 * re.atmoAlfa * pulsa);
        const col = coloreAtmo(re);
        const g = ctx.createRadialGradient(x, y, R * 0.97, x, y, est);
        g.addColorStop(0, rgba(col, alfa)); g.addColorStop(0.45, rgba(col, alfa * 0.45)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, est, 0, Math.PI * 2); ctx.fill();
      }
      if (fis.prominenze && re.prominenze > 0.02) disegnaProminenze(ctx, x, y, R, re, tm, opz);
      ctx.restore();
      if (opz.anelli !== false && fis.anelli) disegnaAnelliFisica(ctx, x, y, R, fis.anelli, re, tm, false);
      if (opz.lune !== false && fis.lune.length) disegnaLune(ctx, x, y, R, fis, re, opz.tempoLune, tm, false);
    } else {
      if (fis.tempeste && re.tempesta > 0.02) {
        ctx.save();
        ctx.beginPath(); ctx.arc(x, y, R * 0.99, 0, Math.PI * 2); ctx.clip();
        disegnaTempesta(ctx, x, y, R, fis.tempeste, re.tempesta, tm, opz);
        ctx.restore();
        if (fis.tempeste === 'vulcani') disegnaVulcani(ctx, x, y, R, re.tempesta, tm);
      }
      if (opz.anelli !== false && fis.anelli) disegnaAnelliFisica(ctx, x, y, R, fis.anelli, re, tm, true);
      if (opz.lune !== false && fis.lune.length) disegnaLune(ctx, x, y, R, fis, re, opz.tempoLune, tm, true);
    }
    ctx.restore();
  }

  // L'energia attorno al corpo: la corona a raggi del Sole, la magnetosfera
  // di Giove e della Terra (le aurore ai poli e le linee del campo), l'aura
  function disegnaAvatar(ctx, x, y, R, fis, re, t) {
    const s = re.avatar;
    if (fis.avatar === 'corona') {
      const n = 18;
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 + t / 14000 + (k % 2) * 0.08;
        const lun = R * (1.25 + (0.25 + 0.55 * s) * (0.65 + 0.35 * Math.sin(t / 520 + k * 2.7)));
        const g = ctx.createLinearGradient(x + Math.cos(a) * R, y + Math.sin(a) * R, x + Math.cos(a) * lun, y + Math.sin(a) * lun);
        g.addColorStop(0, `rgba(254, 240, 138, ${(0.18 + 0.32 * s).toFixed(3)})`); g.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = g;
        const w = 0.07 + 0.04 * (k % 3);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a - w) * R, y + Math.sin(a - w) * R);
        ctx.lineTo(x + Math.cos(a) * lun, y + Math.sin(a) * lun);
        ctx.lineTo(x + Math.cos(a + w) * R, y + Math.sin(a + w) * R);
        ctx.closePath(); ctx.fill();
      }
    } else if (fis.avatar === 'magnetosfera') {
      // le linee del campo: anse dal polo nord al polo sud, ai due lati
      ctx.setLineDash([R * 0.08, R * 0.1]); ctx.lineDashOffset = -t / 70;
      ctx.lineWidth = Math.max(0.8, R * 0.025);
      ctx.strokeStyle = `rgba(165, 180, 252, ${(0.12 + 0.3 * s).toFixed(3)})`;
      for (const lato of [-1, 1]) for (const largo of [1.55, 1.95]) {
        ctx.beginPath();
        ctx.moveTo(x, y - R * 0.86);
        ctx.bezierCurveTo(x + lato * R * largo, y - R * 1.15, x + lato * R * largo, y + R * 1.15, x, y + R * 0.86);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // le aurore: due ovali verdi e viola sopra ai poli, che tremolano
      for (const polo of [-1, 1]) {
        const tr = 0.75 + 0.25 * Math.sin(t / 230 + polo);
        ctx.strokeStyle = `rgba(74, 222, 128, ${((0.2 + 0.55 * s) * tr).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, R * 0.06);
        ctx.beginPath(); ctx.ellipse(x, y + polo * R * 0.93, R * 0.34, R * 0.09, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(192, 132, 252, ${((0.12 + 0.35 * s) * tr).toFixed(3)})`;
        ctx.lineWidth = Math.max(0.8, R * 0.03);
        ctx.beginPath(); ctx.ellipse(x, y + polo * R * 1.0, R * 0.4, R * 0.1, 0, 0, Math.PI * 2); ctx.stroke();
      }
    } else {
      const g = ctx.createRadialGradient(x, y, R * 0.8, x, y, R * (1.5 + 0.5 * s));
      g.addColorStop(0, `rgba(196, 181, 253, ${(0.15 + 0.35 * s).toFixed(3)})`); g.addColorStop(1, 'rgba(196, 181, 253, 0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * (1.5 + 0.5 * s), 0, Math.PI * 2); ctx.fill();
    }
  }

  /* Le prominenze: archi di plasma che si alzano dal bordo e ricadono. Con
   * la rabbia sono di più, più alte, e ogni tanto una si stacca e vola via
   * (l'espulsione di massa coronale). I piedi stanno dietro al disco. */
  function disegnaProminenze(ctx, x, y, R, re, t, opz) {
    const s = re.prominenze;
    const n = 2 + Math.round(5 * s);
    const st = { s: seme('prominenze') };
    for (let k = 0; k < n; k++) {
      const a = dado(st) * Math.PI * 2 + t / 20000 * (k % 2 ? 1 : -1);
      const largo = 0.14 + dado(st) * 0.12;
      const h = R * (0.14 + 0.4 * s * (0.55 + 0.45 * Math.sin(t / (380 + k * 70) + k * 1.7)));
      const p1 = [x + Math.cos(a - largo) * R * 0.95, y + Math.sin(a - largo) * R * 0.95];
      const p2 = [x + Math.cos(a + largo) * R * 0.95, y + Math.sin(a + largo) * R * 0.95];
      const c1 = [x + Math.cos(a - largo * 0.9) * (R + h * 1.5), y + Math.sin(a - largo * 0.9) * (R + h * 1.5)];
      const c2 = [x + Math.cos(a + largo * 0.9) * (R + h * 1.5), y + Math.sin(a + largo * 0.9) * (R + h * 1.5)];
      for (const [w, c] of [[R * 0.13, 'rgba(234, 88, 12, 0.55)'], [R * 0.065, 'rgba(251, 146, 60, 0.9)'], [R * 0.025, 'rgba(254, 240, 138, 0.95)']]) {
        ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.8, w * (0.7 + 0.5 * s));
        ctx.beginPath(); ctx.moveTo(...p1); ctx.bezierCurveTo(...c1, ...c2, ...p2); ctx.stroke();
      }
    }
    // l'espulsione: una bolla di plasma che parte dal bordo e si allarga
    if (s > 0.6 && !opz.ridotto) {
      const ciclo = 2600, u = (t % ciclo) / ciclo;
      const a = seme('cme' + Math.floor(t / ciclo)) % 628 / 100;
      const d = R * (1.05 + u * 1.3), q = R * (0.12 + u * 0.35);
      ctx.strokeStyle = `rgba(251, 146, 60, ${((1 - u) * 0.7 * (s - 0.5) * 2).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, R * 0.05 * (1 - u));
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, q, a - 1.4, a + 1.4); ctx.stroke();
    }
  }

  // Gli anelli sottili di Urano, Nettuno e Giove: la metà di dietro prima del
  // corpo, quella davanti dopo. L'umore li inclina e li apre come gesti.
  function disegnaAnelliFisica(ctx, x, y, R, an, re, t, davanti) {
    const gesto = re.anelliInclina * 0.6 + Math.sin(t / 260) * 0.06 * re.energia + Math.sin(t / 90) * 0.05 * re.anelliScuoti;
    const rx = R * an.rx, ry = Math.max(R * 0.02, R * an.ry * (1 + re.anelliApri * 0.6));
    const giro = an.giro + gesto;
    const da = davanti ? 0 : Math.PI, a = davanti ? Math.PI : Math.PI * 2;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = rgba(INCHIOSTRO, an.alfa * 0.6); ctx.lineWidth = Math.max(1.2, R * 0.06);
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, giro, da, a); ctx.stroke();
    ctx.strokeStyle = rgba(an.colore, an.alfa); ctx.lineWidth = Math.max(0.8, R * 0.035);
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, giro, da, a); ctx.stroke();
    ctx.lineCap = 'round';
  }

  function disegnaLune(ctx, x, y, R, fis, re, tempoLune, t, davanti) {
    for (const m of storPostiLune(fis, re, R, tempoLune, t)) {
      if (m.davanti !== davanti) continue;
      const lx = x + m.x, ly = y + m.y, l = m.luna;
      if (m.r < 2.2) {
        ctx.fillStyle = l.colore; ctx.beginPath(); ctx.arc(lx, ly, m.r, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      parte(ctx, l.sasso ? () => patata(ctx, lx, ly, m.r, l.nome, 1.4) : () => { ctx.beginPath(); ctx.arc(lx, ly, m.r, 0, Math.PI * 2); },
        l.colore, m.r, { luce: 0.18, pennino: 0.07 });
    }
  }

  /* Il maltempo sul disco, tanto più forte quanto più il personaggio è
   * arrabbiato (`s`, 0–1). Ognuno ha il suo, quello vero: Giove i vortici
   * attorno alla Grande Macchia Rossa, Nettuno i venti più veloci del
   * Sistema Solare e la sua macchia scura, la Terra i cicloni, Venere i
   * fulmini nelle nubi d'acido, Marte le tempeste di polvere, Saturno
   * l'esagono al polo. */
  function disegnaTempesta(ctx, x, y, R, tipo, s, t, opz) {
    const veloce = 0.3 + 1.7 * s;
    if (tipo === 'vortici' || tipo === 'cicloni') {
      const giove = tipo === 'vortici';
      const centri = giove ? [[0.62, 0.46, 0.2], [-0.5, 0.58, 0.09], [0.2, 0.7, 0.07], [-0.2, -0.5, 0.08]] : [[-0.45, 0.42, 0.16], [0.55, 0.3, 0.13], [0.1, -0.62, 0.11]];
      const quanti = giove ? 1 + Math.round(3 * s) : 1 + Math.round(2 * s);
      centri.slice(0, quanti).forEach(([cx, cy, q], i) => {
        const px = x + cx * R, py = y + cy * R, r = q * R * (1 + 0.5 * s);
        ctx.strokeStyle = giove && !i ? `rgba(185, 28, 28, ${(0.3 + 0.45 * s).toFixed(3)})` : `rgba(255, 255, 255, ${(0.35 + 0.45 * s).toFixed(3)})`;
        ctx.lineWidth = Math.max(0.8, R * 0.025);
        const giro = t / 1000 * veloce * (i % 2 ? -1 : 1) * Math.PI;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath(); ctx.ellipse(px, py, r * (1 - k * 0.28), r * (1 - k * 0.28) * (giove ? 0.6 : 0.9), 0, giro + k * 2, giro + k * 2 + 3.6); ctx.stroke();
        }
      });
      if (giove && s > 0.55) lampoTempesta(ctx, x, y, R, s, t, opz, '#fef9c3');
    } else if (tipo === 'venti') {
      // le nubi bianche che corrono, la macchia scura che si gonfia
      ctx.fillStyle = `rgba(30, 58, 138, ${(0.25 + 0.4 * s).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(x - R * 0.6, y + R * 0.5, R * 0.18 * (1 + 0.6 * s), R * 0.1 * (1 + 0.6 * s), 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.3 + 0.5 * s).toFixed(3)})`;
      for (let k = 0; k < 2 + Math.round(3 * s); k++) {
        const v = R * 0.00045 * veloce * (1 + k * 0.3);
        const px = x - R * 1.2 + (((t * v + k * R * 0.83) % (R * 2.4)) + R * 2.4) % (R * 2.4);
        const py = y + R * (-0.7 + k * 0.33);
        ctx.beginPath(); ctx.ellipse(px, py, R * 0.22, R * 0.025, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (tipo === 'fulmini') {
      ctx.strokeStyle = `rgba(254, 249, 195, ${(0.25 + 0.4 * s).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, R * 0.05);
      const sp = (t / 1000 * veloce * R * 0.25) % (R * 0.5);
      for (const dy of [-0.55, 0, 0.55]) {
        ctx.beginPath();
        ctx.moveTo(x - R * 1.1 + sp, y + (dy - 0.2) * R);
        ctx.quadraticCurveTo(x + sp * 0.5, y + dy * R, x - R * 1.1 + sp, y + (dy + 0.2) * R);
        ctx.stroke();
      }
      lampoTempesta(ctx, x, y, R, s, t, opz, '#fefce8');
    } else if (tipo === 'polvere') {
      ctx.fillStyle = `rgba(194, 65, 12, ${(0.45 * s).toFixed(3)})`;
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
      ctx.strokeStyle = `rgba(253, 186, 116, ${(0.5 * s).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, R * 0.06);
      for (let k = 0; k < 4; k++) {
        const px = x - R * 1.3 + (((t * R * 0.0004 * veloce + k * R * 0.65) % (R * 2.6)) + R * 2.6) % (R * 2.6);
        ctx.beginPath(); ctx.moveTo(px, y + R * (-0.6 + k * 0.38)); ctx.lineTo(px + R * 0.45, y + R * (-0.65 + k * 0.38)); ctx.stroke();
      }
    } else if (tipo === 'esagono') {
      ctx.strokeStyle = `rgba(120, 85, 30, ${(0.25 + 0.45 * s).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, R * 0.035);
      const giro = t / 6000 * veloce;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = giro + k / 6 * Math.PI * 2;
        const px = x + Math.cos(a) * R * 0.3, py = y - R * 0.78 + Math.sin(a) * R * 0.1;
        if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
      if (s > 0.4) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.6 * s).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(x + R * 0.55, y + R * 0.55, R * 0.12 * s, R * 0.06 * s, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // Un fulmine: pochi, distanti, mai uno sfarfallio (col movimento ridotto niente)
  function lampoTempesta(ctx, x, y, R, s, t, opz, colore) {
    if (opz.ridotto) return;
    const ciclo = 1700 - 1000 * s, n = Math.floor(t / ciclo), u = (t % ciclo) / ciclo;
    if (u > 0.09) return;
    const st = { s: seme('lampo' + n) || 1 };
    let px = x + (dado(st) - 0.5) * R * 1.1, py = y - R * 0.5 + dado(st) * R * 0.3;
    ctx.strokeStyle = colore; ctx.lineWidth = Math.max(1, R * 0.035);
    ctx.beginPath(); ctx.moveTo(px, py);
    for (let k = 0; k < 4; k++) { px += (dado(st) - 0.5) * R * 0.25; py += R * 0.14; ctx.lineTo(px, py); }
    ctx.stroke();
  }
  // I pennacchi dei vulcani di Io: ombrelli di zolfo sul bordo, una colonna
  // sottile e una cupola sfumata che ricade (non un tratto: sembravano antenne)
  function disegnaVulcani(ctx, x, y, R, s, t) {
    for (const a of [-1.9, -1.2, -0.5].slice(0, 1 + Math.round(2 * s))) {
      const h = R * (0.15 + 0.35 * s) * (0.85 + 0.15 * Math.sin(t / 300 + a));
      const bx = x + Math.cos(a) * R * 0.97, by = y + Math.sin(a) * R * 0.97;
      const tx = x + Math.cos(a) * (R + h * 0.7), ty = y + Math.sin(a) * (R + h * 0.7);
      const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, h * 0.6);
      g.addColorStop(0, `rgba(253, 230, 138, ${(0.35 + 0.35 * s).toFixed(3)})`); g.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(tx, ty, h * 0.6, h * 0.42, a + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(250, 204, 21, ${(0.25 + 0.3 * s).toFixed(3)})`;
      const nx = -Math.sin(a), ny = Math.cos(a), w = R * 0.035;
      ctx.beginPath();
      ctx.moveTo(bx + nx * w, by + ny * w); ctx.lineTo(tx + nx * w * 0.4, ty + ny * w * 0.4);
      ctx.lineTo(tx - nx * w * 0.4, ty - ny * w * 0.4); ctx.lineTo(bx - nx * w, by - ny * w);
      ctx.closePath(); ctx.fill();
    }
  }


  // ===================================================================
  // 7. I ganci dei renderer
  // ===================================================================

  /* Planetario. `skyDisegnaAstro` e `corpiMinoriDisegna` lasciano qui la
   * ricevuta di ogni astro che hanno disegnato davvero (dopo i loro tagli di
   * bordo e di visibilità), con la sua posizione e il suo raggio. Senza
   * personaggi in scena si esce alla prima riga. */
  function storRicevuta(id, px, py, r, o) {
    if (!stor.personaggi.size && !stor.effetti.length) return;
    stor.ricevute.set(id, { id, px, py, r, az: o && o.az, alt: o && o.alt, tipo: o && o.tipo });
  }
  function storDisegnaCielo(ctx) {
    if (!stor.personaggi.size && !stor.effetti.length) { stor.ricevute.clear(); stor.ultimiDisegnati = []; return []; }
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
    if (!stor.personaggi.size && !stor.effetti.length) { stor.ultimiDisegnati = []; return []; }
    const sol = globale('sol');
    if (!sol) return [];
    const elenco = [];
    const assi = storAssiSchermo(sol);
    const sole = scena && scena.sole;
    // Da che parte arriva la luce, per l'ombra sul volto (`conLuce`). Nella
    // scena grande il Sole è l'origine, e la frazione in ombra della faccia
    // rivolta a noi viene dalla geometria vera; dove il punto della scena
    // non c'è (il banco Terra e Luna, le lune), basta la direzione del Sole
    // sullo schermo con un'ombra leggera.
    const luceDi = (id, px, py, punto) => {
      if (storCanonico(id) === 'Sun') return null;
      if (punto && !sol.vicino) {
        const n = Math.hypot(punto.x, punto.y, punto.z);
        if (!(n > 0)) return null;
        const vx = -v3.punto(punto, assi.ex) / n, vy = v3.punto(punto, assi.su) / n, vz = -v3.punto(punto, assi.w) / n;
        const m = Math.hypot(vx, vy) || 1;
        return { x: vx / m, y: vy / m, buio: Math.max(0, Math.min(1, (1 - vz) / 2)) };
      }
      if (sole && Number.isFinite(sole.px)) {
        const dx = sole.px - px, dy = sole.py - py, m = Math.hypot(dx, dy);
        if (m > 1) return { x: dx / m, y: dy / m, buio: 0.35 };
      }
      return null;
    };
    const metti = (id, px, py, r, vicinanza, punto) => {
      if (!id || !Number.isFinite(px) || !Number.isFinite(py)) return;
      elenco.push({ id, px, py, r: Math.max(0, r || 0), vicinanza: Number.isFinite(vicinanza) ? vicinanza : 0,
        luce: stor.personaggi.size ? luceDi(id, px, py, punto) : null });
    };
    for (const p of (scena && scena.corpi) || []) {
      if (p && p.schermo) metti(p.id, p.schermo.px, p.schermo.py, p.rDisegno, p.schermo.vicinanza, p.scena);
    }
    if (scena && scena.sole) metti('Sun', scena.sole.px, scena.sole.py, scena.sole.r, scena.sole.vicinanza);
    if (!sol.vicino && sol.lunaSchermo) metti('Moon', sol.lunaSchermo.px, sol.lunaSchermo.py, sol.lunaSchermo.r, sol.lunaSchermo.vicinanza,
      (stor.mosse.get('Moon') || {}).scena);
    for (const l of sol.luneSchermo || []) metti(l.id, l.px, l.py, l.r, l.vicinanza, (stor.mosse.get(l.id) || {}).scena);
    for (const s of sol.satSchermo || []) metti(s.id, s.px, s.py, s.r, s.vicinanza);
    for (const c of elenco) {
      c.nascosto = elenco.some(q => q !== c && q.vicinanza > c.vicinanza && q.r > c.r * 0.6 &&
        Math.hypot(q.px - c.px, q.py - c.py) < q.r - Math.min(c.r, q.r) * 0.25);
    }
    const giu = (sol.altaBarra || 0) + 54;
    storPalco3D(elenco, assi, sol);
    return storDisegnaPersonaggi(ctx, sol.vicino ? 'vicino' : 'sistema', elenco, sol.L, sol.H, { su: 12, giu, lati: 64 });
  }

  /* Il palco della 3D (v428). Chi guarda una storia ha chiesto due cose:
   * che i personaggi non si coprano l'un l'altro, e che la loro misura dica
   * quanto sono lontani dalla camera.
   *
   * **La prospettiva.** La proiezione della 3D è ortogonale e ogni
   * personaggio cresceva fino alla stessa misura di volto (`STOR_VOLTO_3D_PX`):
   * Giove dietro a Saturno era grande quanto lui. Ora ognuno ha un fattore
   * `prosp`, come in una camera vera a distanza `STOR_PALCO.camera` volte il
   * lato corto dello schermo: chi sta più avanti della media dei personaggi
   * (lungo l'asse che guarda chi guarda) è più grande, chi sta dietro più
   * piccolo, fra `prospMin` e `prospMax`. Scivola, non salta.
   *
   * **Il posto.** Si parte da dove ognuno starebbe senza passi di lato,
   * si allontanano a coppie quelli che si toccano (contando gli anelli di
   * Saturno e i corpi disegnati di sonde e stazioni) per qualche giro, e lo
   * spostamento che ne viene è il passo di lato (`scarto`, in pixel) a cui
   * ognuno scivola: da quel punto `storScena3D` lo mette nella scena, e il
   * volto, la profondità e le lune lo seguono. Il Sole non si sposta: si
   * scansa l'altro. Partendo ogni volta dal posto senza passi, il risultato
   * non oscilla e torna a zero quando i due si allontanano da sé. */
  const STOR_PALCO = { camera: 1.8, prospMin: 0.62, prospMax: 1.6, aria: 1.1, spazio: 8, giri: 10, tauMs: 320, tauProspMs: 420 };
  function storPalco3D(elenco, assi, sol) {
    const L = sol.L || 0, H = sol.H || 0, lato = Math.max(1, Math.min(L, H));
    const ora = stor.orologio;
    const dt = Math.max(0, Math.min(200, ora - (stor.ultimoPalco || ora)));
    stor.ultimoPalco = ora;
    const kS = stor.ridotto ? 1 : 1 - Math.exp(-dt / STOR_PALCO.tauMs);
    const kP = stor.ridotto ? 1 : 1 - Math.exp(-dt / STOR_PALCO.tauProspMs);
    const perId = new Map();
    for (const c of elenco) { const id = storCanonico(c.id); if (!perId.has(id)) perId.set(id, c); }
    const attori = [];
    for (const pg of stor.personaggi.values()) {
      const c = perId.get(pg.id);
      if (!pg.scarto) pg.scarto = { x: 0, y: 0 };
      if (!c || pg.nascosto || pg.misura === 'real' || !Number.isFinite(c.px)) {
        // fuori scena: il passo di lato torna a zero piano
        pg.scarto.x *= 1 - kS; pg.scarto.y *= 1 - kS;
        continue;
      }
      const punto = (stor.mosse.get(pg.id) || stor.vere.get(pg.id) || {}).scena;
      const z = punto ? v3.punto(punto, assi.w) * assi.scala : 0;
      const p = storVesteProfilo(pg);
      let rad = c.r * (pg.id === 'Saturn' ? 2.3 : 1);
      if (STOR_SAGOME_FORMA.includes(p.sagoma) || pg.veste) {
        const sag = STOR_CORPI[p.sagoma] ? p.sagoma : 'pianeta';
        rad = Math.max(rad, STOR_VOLTO_3D_PX * (pg.prosp || 1) / STOR_CORPI[sag].volto[2] * ingombroDi(sag));
      }
      attori.push({ pg, z, rad, fermo: pg.id === 'Sun',
        x: c.px - pg.scarto.x, y: c.py - pg.scarto.y });
    }
    // La prospettiva, attorno alla profondità media di chi è in scena
    const ref = attori.length ? attori.reduce((a, b) => a + b.z, 0) / attori.length : 0;
    const D = STOR_PALCO.camera * lato;
    for (const a of attori) {
      const voluta = attori.length < 2 || stor.ridotto ? 1
        : Math.max(STOR_PALCO.prospMin, Math.min(STOR_PALCO.prospMax, D / Math.max(D * 0.2, D - (a.z - ref))));
      a.pg.prosp = mix(a.pg.prosp || 1, voluta, kP);
    }
    // Il posto: a coppie, chi si tocca si allontana
    const pos = attori.map(a => ({ x: a.x, y: a.y }));
    for (let g = 0; g < STOR_PALCO.giri; g++) {
      let mosso = false;
      for (let i = 0; i < attori.length; i++) for (let j = i + 1; j < attori.length; j++) {
        const A = attori[i], B = attori[j];
        if (A.fermo && B.fermo) continue;
        let dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
        let d = Math.hypot(dx, dy);
        const serve = (A.rad + B.rad) * STOR_PALCO.aria + STOR_PALCO.spazio;
        if (d >= serve) continue;
        if (d < 0.5) { const a = (seme(A.pg.id + B.pg.id) % 628) / 100; dx = Math.cos(a); dy = Math.sin(a); d = 1; }
        const spinta = serve - d, ux = dx / d, uy = dy / d;
        const qa = A.fermo ? 0 : B.fermo ? 1 : 0.5, qb = 1 - qa;
        pos[i].x -= ux * spinta * qa; pos[i].y -= uy * spinta * qa;
        pos[j].x += ux * spinta * qb; pos[j].y += uy * spinta * qb;
        mosso = true;
      }
      if (!mosso) break;
    }
    const tetto = lato * 0.6;
    attori.forEach((a, i) => {
      let sx = pos[i].x - a.x, sy = pos[i].y - a.y;
      const m = Math.hypot(sx, sy);
      if (m > tetto) { sx *= tetto / m; sy *= tetto / m; }
      a.pg.scarto.x = mix(a.pg.scarto.x, sx, kS);
      a.pg.scarto.y = mix(a.pg.scarto.y, sy, kS);
    });
  }

  // ===================================================================
  // 7-bis. La scala cosmica: personaggi in viaggio per l'universo (v412)
  // ===================================================================

  /* La scala cosmica (scala-cosmica.js) è il quarto quadro della vista 3D:
   * una carta sola, alla misura vera, dalla Terra all'universo osservabile.
   * Le storie ci possono entrare (`cosmic_scale` nella scena) e i personaggi
   * ci stanno **al loro posto vero**: la Terra attorno al Sole, la Voyager 1
   * a centosettanta unità astronomiche, la Via Lattea col suo centro a
   * ventiseimila anni luce, Andromeda a due milioni e mezzo. È la stessa
   * promessa del planetario: il punto di partenza è vero, e allontanandosi
   * si vede quello che è vero — a un certo punto il Sole, la Terra e la
   * Voyager diventano un puntino solo, e i loro corpi si affollano lì, legati
   * dai fili allo stesso pixel. Una storia non può mentire su questo, e anzi
   * ci si può costruire sopra la sua battuta migliore.
   *
   * Da lì un personaggio può **viaggiare** (`character_move`) verso un altro
   * personaggio o verso un luogo dell'universo (`STOR_LUOGHI_COSMO`: le
   * tappe della scala e i paletti con un nome). Il viaggio attraversa le
   * decade come le attraversa la camera: quando partenza e arrivo sono
   * distanti molti ordini di grandezza la distanza dal Sole cresce in
   * progressione geometrica (`storPuntoCosmo`), così su una carta logaritmica
   * il viaggio scorre invece di stare fermo e poi saltare in fondo. Chi esce
   * dal quadro resta sul bordo, con una freccia verso dove sta davvero. */
  const STOR_LUOGHI_COSMO = ['alpha_centauri', 'sirius', 'orion_nebula', 'galactic_center', 'lmc', 'smc', 'andromeda', 'triangulum',
    'virgo_cluster', 'great_attractor', 'betelgeuse', 'crab_nebula', 'earth', 'earth_moon', 'inner_planets', 'planets', 'kuiper', 'heliopause', 'oort',
    'local_cloud', 'local_bubble', 'orion_arm', 'milky_way', 'local_group', 'virgo', 'laniakea', 'universe'];
  const luogoCosmico = v => typeof v === 'string' && STOR_LUOGHI_COSMO.includes(v);
  const scenaCosmica = scena => !!(scena && Array.isArray(scena.azioni) && scena.azioni.some(a => a.comando === 'cosmic_scale'));

  // Un punto del viaggio fra A e D (vettori della carta, in UA). Fra due
  // cose a distanze simili dal Sole (la Terra e Marte) la strada è dritta;
  // fra due distanze lontane molti ordini di grandezza (la Terra e
  // Andromeda) la distanza cresce in progressione geometrica e la direzione
  // gira piano: è la strada che su una carta logaritmica si vede scorrere.
  function storPuntoCosmo(A, D, u) {
    const k = Math.max(0, Math.min(1, u));
    const la = Math.hypot(A.x, A.y, A.z), ld = Math.hypot(D.x, D.y, D.z);
    const piccolo = Math.min(la, ld), grande = Math.max(la, ld);
    if (!(grande > 0) || grande / Math.max(piccolo, 1e-9) < 8) {
      return { x: A.x + (D.x - A.x) * k, y: A.y + (D.y - A.y) * k, z: A.z + (D.z - A.z) * k };
    }
    const eps = Math.max(1e-6, grande * 1e-12);
    const m = Math.exp(Math.log(la + eps) + (Math.log(ld + eps) - Math.log(la + eps)) * k) - eps;
    const da = la > 1e-9 ? { x: A.x / la, y: A.y / la, z: A.z / la } : null;
    const a = ld > 1e-9 ? { x: D.x / ld, y: D.y / ld, z: D.z / ld } : null;
    let dir = !da ? a : !a ? da : { x: da.x + (a.x - da.x) * k, y: da.y + (a.y - da.y) * k, z: da.z + (a.z - da.z) * k };
    const n = Math.hypot(dir.x, dir.y, dir.z);
    if (!(n > 1e-9)) dir = a || da;
    else dir = { x: dir.x / n, y: dir.y / n, z: dir.z / n };
    return { x: dir.x * m, y: dir.y * m, z: dir.z * m };
  }
  /* La forma del percorso sullo schermo: quanto il personaggio esce dalla
   * strada dritta fra il pixel di partenza e quello d'arrivo. Funzione pura,
   * zero all'inizio e alla fine. */
  function storScarto2D(percorso, ax, ay, bx, by, u, giri) {
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d;
    const busta = Math.sin(Math.PI * Math.max(0, Math.min(1, u)));
    switch (percorso) {
      case 'arc': return { x: nx * busta * d * 0.22, y: ny * busta * d * 0.22 };
      case 'hop': { const h = Math.abs(Math.sin(Math.PI * 3 * u)) * Math.min(70, d * 0.18); return { x: 0, y: -h }; }
      case 'loop': {
        if (u < 0.3 || u > 0.7) return { x: 0, y: 0 };
        const a = (u - 0.3) / 0.4 * Math.PI * 2 * Math.max(1, Math.round(giri || 1)), r = Math.min(60, d * 0.16);
        return { x: Math.sin(a) * r, y: -(1 - Math.cos(a)) * r };
      }
      case 'spiral': { const a = u * Math.PI * 2 * Math.max(1, giri || 2), r = Math.min(70, d * 0.2) * busta; return { x: Math.cos(a) * r, y: Math.sin(a) * r }; }
      case 'zigzag': { const z = Math.abs(((u * 6) % 2) - 1) * 2 - 1; return { x: nx * z * busta * d * 0.08, y: ny * z * busta * d * 0.08 }; }
      default: return { x: 0, y: 0 };
    }
  }
  // Dove sta di casa un personaggio sulla carta: il suo luogo (le galassie,
  // le stelle vicine) o il suo corpo (la Terra, la Voyager); chi la carta
  // non conosce sta col Sole, che a queste scale è lo stesso puntino.
  function storCasaCosmo(pg) {
    if (pg.profilo.cosmo === 'idea') return null;
    const luogo = globale('cosmLuogo'), dove = globale('cosmDove');
    const suo = pg.profilo.cosmo || pg.profilo.luogo;
    if (suo && typeof luogo === 'function') { const l = luogo(suo); if (l) return l.v; }
    if (typeof dove === 'function') { const v = dove(pg.id); if (v) return v; }
    return { x: 0, y: 0, z: 0 };
  }
  // Il vettore di una meta: un luogo, un altro personaggio, o casa
  function storMetaCosmo(pg, verso) {
    if (!verso || verso === 'orbit') return storCasaCosmo(pg);
    if (luogoCosmico(verso)) { const l = globale('cosmLuogo') && globale('cosmLuogo')(verso); if (l) return l.v; }
    const altro = stor.personaggi.get(verso);
    if (altro && altro.profilo.cosmo === 'idea') return null;
    if (altro) return altro.cosmoV || storCasaCosmo(altro);
    const dove = globale('cosmDove');
    const v = typeof dove === 'function' ? dove(verso) : null;
    return v || null;
  }

  function storDisegnaCosmo(ctx, cam, margini) {
    if (!stor.personaggi.size && !stor.effetti.length) { stor.ultimiDisegnati = []; return []; }
    if (!cam || typeof cam.p !== 'function') return [];
    const L = cam.W, H = cam.H;
    const m = Object.assign({ su: STOR_MARGINE_PX, giu: STOR_MARGINE_PX, lati: STOR_MARGINE_PX }, margini || {});
    const raggio = globale('cosmRaggioUA');
    const corpi = [];
    // Ogni personaggio al suo posto, o a quello del suo viaggio
    for (const pg of stor.personaggi.values()) {
      // Il buco bianco non ha un posto sulla carta: nessuno ne ha mai visto
      // uno. Galleggia davanti alla carta, a destra in alto (e se lì c'è già
      // qualcuno si sposta, senza il filo: non è legato a niente).
      if (pg.profilo.cosmo === 'idea') {
        pg.moto = null; pg.cosmoV = null;
        corpi.push({ id: pg.id, px: L * 0.72, py: m.su + (H - m.su - m.giu) * 0.34, r: 1, idea: true });
        continue;
      }
      const casa = storCasaCosmo(pg);
      let v = casa, scarto = { x: 0, y: 0 };
      const moto = pg.moto;
      if (moto) {
        if (!moto.Acosmo) moto.Acosmo = pg.cosmoV || casa;
        const D = storMetaCosmo(pg, moto.verso);
        if (D) {
          const u = moto.percorso === 'teleport' ? (moto.u >= 0.5 ? 1 : 0) : moto.u * moto.u * (3 - 2 * moto.u);
          v = storPuntoCosmo(moto.Acosmo, D, u);
          const a = cam.p(moto.Acosmo), b = cam.p(D);
          scarto = storScarto2D(moto.percorso, a.x, a.y, b.x, b.y, moto.u, moto.giri);
          // Arrivando su un altro personaggio ci si ferma accanto, non sopra
          if (moto.u > 0 && stor.personaggi.has(moto.verso)) {
            const lato = { left: -1, right: 1 }[moto.lato] || (a.x <= b.x ? -1 : 1);
            scarto.x += lato * Math.min(1, moto.u * 1.5) * 64 * (moto.distanza || 1);
          }
        }
      }
      pg.cosmoV = v;
      if (moto && moto.u >= 1 && moto.verso === 'orbit') pg.moto = null;   // tornato a casa
      const q = cam.p(v);
      let px = q.x + scarto.x, py = q.y + scarto.y, freccia;
      // Fuori dal quadro: sul bordo (tutto il corpo dentro), con la freccia
      // verso dove sta davvero
      const dentro = Math.max(STOR_DISCO_MIN_PX, Math.min(STOR_DISCO_MAX_PX, Math.min(L, H) * 0.075)) * 1.35;
      const x0 = m.lati + dentro, x1 = L - m.lati - dentro, y0 = m.su + dentro, y1 = H - m.giu - dentro;
      if (!(px >= x0 && px <= x1 && py >= y0 && py <= y1) && Number.isFinite(px) && Number.isFinite(py)) {
        freccia = Math.atan2(py - H / 2, px - L / 2);
        px = Math.max(x0, Math.min(x1, px)); py = Math.max(y0, Math.min(y1, py));
      }
      // Chi sta fuori dal quadro porta il suo corpo sul bordo, mai il disco
      // vero: appena partiti dalla Terra il Sole è fuori dallo schermo ma
      // largo migliaia di pixel, e il volto sarebbe stato un occhio gigante
      // appoggiato al bordo (v414)
      const r = typeof raggio === 'function' && !moto && !Number.isFinite(freccia) ? raggio(pg.id) * cam.s : 0;
      corpi.push({ id: pg.id, px, py, r: Math.max(1, r || 0), freccia });
    }
    // I luoghi guardati o colpiti da un effetto, perché lo sguardo e l'effetto
    // sappiano dove sono
    const luogo = globale('cosmLuogo');
    const nominati = new Set();
    for (const pg of stor.personaggi.values()) if (luogoCosmico(pg.guarda)) nominati.add(pg.guarda);
    for (const ef of stor.effetti) if (luogoCosmico(ef.target)) nominati.add(ef.target);
    for (const n of nominati) {
      if (stor.personaggi.has(n) || typeof luogo !== 'function') continue;
      const l = luogo(n);
      if (l) { const q = cam.p(l.v); corpi.push({ id: n, px: q.x, py: q.y, r: 0, luogo: true }); }
    }
    return storDisegnaPersonaggi(ctx, 'cosmo', corpi, L, H, m);
  }

  // ===================================================================
  // 7-ter. La regia: la camera che va dove succede qualcosa (v416)
  // ===================================================================

  /* Chi scrive storie ha chiesto una camera viva: quando un personaggio
   * parla la camera gli va vicino, con gli occhi ben dentro al quadro; quando
   * scoppia qualcosa si gira a guardarlo e il quadro trema; quando nessuno
   * parla torna larga, dove la scena l'aveva messa.
   *
   * Non è una seconda camera astronomica: è una **lente** sulla tela. Ogni
   * renderer apre la lente all'inizio del fotogramma (`storLenteApri`, una
   * traslazione e una scala sul contesto) e la chiude dopo i volti
   * (`storLenteChiudi`), prima delle scritte di servizio in basso. Così le
   * camere delle scene (`camera_3d`, `center_target`, `cosmic_scale`)
   * restano padrone di cosa si guarda, e la regia sceglie solo il primo
   * piano. Una lente e non uno zoom vero per due ragioni: nella 3D il volto
   * ha già la sua misura in pixel (`STOR_VOLTO_3D_PX`) e uno zoom della scena
   * non lo ingrandirebbe; e tutto quello che si disegna è vettoriale, quindi
   * un volto a tre volte resta nitido. Le tele dipinte una volta (le stelle,
   * la Via Lattea) un po' si sgranano: per questo lo zoom ha un tetto.
   *
   * Il quadro non esce mai dalla tela (la finestra vista dalla lente sta
   * sempre dentro a [0, L] × [0, H]): niente bordi vuoti, e lo sfondo che il
   * renderer stende su tutta la tela copre tutto anche ingrandito. Le
   * posizioni salvate per le prove e per il dito (`ultimiDisegnati`, i
   * corpi di `sol`) restano nelle coordinate del disegno, senza lente.
   *
   * Tace quando la persona prende la camera in mano
   * (`AstroDemo.cameraManuale`), con l'opzione spenta, fuori dalle storie,
   * e nelle scene con `story_camera { mode: wide }`. Col movimento ridotto
   * non tace più (v434): va più piano e senza scosse. Fra due battute non
   * torna ferma alla camera della scena ma tiene il gruppo e gli si
   * avvicina (`storRegiaGruppo`).
   *
   * Ogni scena può scegliere la sua regia (v431, chiesto da chi scrive le
   * storie: «la camera dev'essere dinamica, zoomare quando qualcuno parla e
   * girare intorno al personaggio se serve»): `auto` (quella di sempre),
   * `speaker` (primo piano stretto su chi parla, e fra due battute resta
   * su di lui invece di allargarsi), `close` (su un personaggio solo),
   * `orbit` (la camera gira attorno a un personaggio, o a chi parla) e
   * `wide` (la camera della scena, ferma). Il giro nella 3D e nella scala
   * cosmica è vero: un azimut in più che `solDisegna` somma alla camera per
   * il solo fotogramma (`storRegiaGiro`), e la lente tiene al centro il
   * personaggio — girare attorno al perno e poi ricentrare su di lui è lo
   * stesso che girare attorno a lui, perché la proiezione è ortogonale. Nel
   * planetario, dove la camera sta per terra e girare attorno a un astro non
   * ha senso, il giro è il quadro che rolla piano e scivola in cerchio
   * attorno al personaggio, come una camera a mano che gli passa accanto. */
  const STOR_REGIA = {
    zoomMax: 3.2,          // oltre, le tele dipinte una volta si sgranano troppo
    volto: 0.17,           // il raggio del volto in primo piano, in frazione del lato corto
    occhiY: 0.4,           // dove vanno gli occhi: sopra al centro, sotto ci sono i sottotitoli
    effettoY: 0.45,
    omega: 4.4,            // la molla della camera (rad/s): arriva in un secondo, senza scatti
    omegaZoom: 3.4,        // lo zoom un poco più lento del carrello (v427): prima ci si gira, poi ci si avvicina
    carrello: 0.09,        // durante una battuta la camera si avvicina ancora piano, fino a +9% (v427)
    carrelloMs: 6000,
    respiro: 0.006,        // la camera a mano: un ondeggiare lento, in frazione del lato corto (v427)
    arco: 0.45,            // passando da un personaggio all'altro si allarga un poco e torna (v427)
    terzi: 0.1,            // chi parla guardando di lato va a un terzo, con lo spazio davanti (v427)
    voltoStretto: 0.22,    // il primo piano di `speaker`, più stretto di quello di `auto` (v431)
    giroVolto: 0.13,       // nel giro il volto è più piccolo: si deve vedere il mondo che gli gira dietro (v431)
    giroVel: 14,           // gradi al secondo del giro, di serie (v431): un giro intero in poco meno di mezzo minuto
    giroAvvio: 1.6,        // secondi per prendere (e lasciare) la velocità del giro, senza strappi
    giroRollio: 0.08,      // nel planetario il quadro rolla al più di tanto (radianti, ~4,6°)
    giroCerchio: 0.03,     // e scivola in cerchio attorno al personaggio, in frazione del lato corto
    tieniMs: 900,          // finita una battuta, resta ancora un poco prima di allargarsi
    manoMs: 3500,          // dopo l'ultimo gesto sulla camera la regia aspetta tanto, poi riparte (v433)
    gruppoMax: 1.35,       // senza battute la camera tiene il gruppo, al più di tanto (v434)
    gruppoCarrello: 0.12,  // e gli si avvicina piano, fino a +12% in `gruppoMs`
    gruppoMs: 10000,
    ridottoMolla: 0.55,    // col movimento ridotto la camera va più piano (v434), ma va
    // Gli effetti che la camera va a guardare, per quanto (ms della storia)
    // e quanto sono grandi rispetto al raggio dell'astro che li porta
    effetti: { explosion: [1700, 2.6], shockwave: [1300, 3.2], fireworks: [2100, 3], lightning: [1100, 2.4],
      hearts: [1500, 2.2], confetti: [1500, 2.6], shooting_star: [1200, 3.5] },
    // E quelli che fanno tremare il quadro, con che forza
    scosse: { explosion: 1, shockwave: 0.55, lightning: 0.7, fireworks: 0.3 }
  };
  stor.regia = {
    modo: 'auto', chi: null, zoomMax: null,       // quello che la scena chiede
    velGiro: 14, giro: 0, vGiro: 0, giroOra: NaN, ultimoParlante: null, ultimoGiro: null, rot: 0, vrot: 0,
    lk: 0, vlk: 0, fx: NaN, fy: NaN, vfx: 0, vfy: 0, ay: 0.5, vay: 0, ax: 0.5, vax: 0, ripresa: null,
    vista: '', L: 0, H: 0, ultimo: 0, tieni: null, scosse: [],
    aperta: null, k: 1, tx: 0, ty: 0, motivo: 'largo'
  };
  /* La camera presa a mano (v433). Prima della v433 bastava un giro di
   * rotellina, un trascinamento di sei pixel fatto per sbaglio o un tasto
   * freccia e la regia taceva fino alla scena dopo: a chi guarda sembrava
   * che lo zoom su chi parla non funzionasse più. Ora tace solo mentre la
   * persona sta muovendo la camera, e `STOR_REGIA.manoMs` dopo l'ultimo
   * gesto riparte (le camere della scena restano invece alla persona fino
   * alla scena dopo, come prima). */
  function cameraInMano() {
    const d = radice.AstroDemo;
    if (!d || !d.cameraManuale) return false;
    const da = Number(d.cameraManualeDa);
    if (!(da > 0)) return true;
    return adesso() - da < STOR_REGIA.manoMs;
  }
  function regiaAccesa() {
    const r = stor.regia;
    // Col movimento ridotto la regia non tace più (v434): chi guarda una
    // storia con le animazioni del sistema spente vedeva la camera ferma dal
    // primo all'ultimo secondo. Va più piano e senza scosse, respiro, arco,
    // carrello e rollio; per fermarla del tutto c'è l'opzione `cameraStorie`
    if (r.modo === 'wide' || stor.anteprima) return false;
    if (!stor.personaggi.size && !stor.effetti.length) return false;
    const d = radice.AstroDemo;
    if (d) {
      if (cameraInMano()) return false;
      const o = d.opzioni;
      if (o && o.cameraStorie === false) return false;
    }
    return true;
  }
  /* Chi sta parlando adesso (v433). Di solito lo dice `stor.parlante`, che
   * `storParla` tiene finché la voce non finisce. Ma se la voce si rompe
   * (una sintesi del dispositivo che lancia un errore, un ponte che non
   * risponde) la promessa della narrazione fallisce subito e `parlante` si
   * azzera, mentre il sottotitolo col nome resta a schermo per il tempo di
   * leggerlo: la regia credeva che nessuno parlasse e non stringeva mai.
   * Allora si chiede anche alla narrazione chi ha la parola nel canale delle
   * demo. */
  function storChiParlaOra() {
    if (stor.parlante) return stor.parlante.target;
    const n = radice.narrazione;
    if (!n || typeof n.voce !== 'function' || typeof n.stato !== 'function') return null;
    const st = n.stato();
    if (!st || st.canale !== 'demo' || st.fase === 'finita') return null;
    const v = n.voce();
    const id = v && v.personaggio ? storCanonico(v.personaggio) : null;
    return id && stor.personaggi.has(id) ? id : null;
  }
  // Dove sono gli occhi di un volto disegnato, e quanto è grande
  function storOcchiDi(d) {
    const g = d.geom;
    const R = Math.max(4, d.R * Math.abs(d.scala || 1));
    if (g && g.occhi && g.occhi.length === 2)
      return { x: (g.occhi[0].cx + g.occhi[1].cx) / 2, y: (g.occhi[0].cy + g.occhi[1].cy) / 2 + R * 0.12, R };
    return { x: d.x, y: d.y - R * 0.1, R };
  }
  /* Che cosa inquadrare adesso. Restituisce il punto del disegno da portare
   * al centro, lo zoom e a che altezza dello schermo va il punto; `null`
   * vuol dire «largo». Funzione pura sullo stato: la provano le prove.
   *   1. un effetto grosso appena cominciato (il botto si guarda);
   *   2. il personaggio che la scena chiede (`story_camera { mode: close }`);
   *   3. chi parla — da solo, o insieme a chi gli sta accanto e lo ascolta
   *      se ci stanno tutti e due senza allontanarsi troppo;
   *   4. chi sta facendo qualcosa (un viaggio, un salto, una veste nuova). */
  function storRegiaInquadra(vista, L, H) {
    const r = stor.regia;
    const lato = Math.min(L, H);
    const tetto = Math.max(1, Math.min(4, r.zoomMax || STOR_REGIA.zoomMax));
    const quanti = stor.ultimiDisegnati.filter(d => d.vista === vista && !d.fuori);
    const dentro = (x, y) => x >= 0 && y >= 0 && x <= L && y <= H;
    const primoPiano = (d, frazione, motivo) => {
      const o = storOcchiDi(d);
      // La regola dei terzi (v427): chi guarda di lato lascia lo spazio
      // davanti allo sguardo, come in ogni inquadratura di un cartone
      const pg = stor.personaggi.get(d.id);
      const sg = pg && pg.sguardo ? pg.sguardo.x : 0;
      const ax = Math.abs(sg) > 0.15 ? 0.5 - STOR_REGIA.terzi * Math.sign(sg) : 0.5;
      return { x: o.x, y: o.y, k: Math.max(1, Math.min(tetto, lato * frazione / o.R)), ay: STOR_REGIA.occhiY, ax, motivo, id: d.id };
    };
    // 1. Il botto
    let ultimo = null;
    for (const ef of stor.effetti) {
      const regola = STOR_REGIA.effetti[ef.tipo];
      const p = ef.ultimoPosto;
      if (!regola || !p || p.vista !== vista || !dentro(p.x, p.y)) continue;
      const eta = stor.orologio - ef.inizio;
      if (eta < 0 || eta > regola[0]) continue;
      if (!ultimo || ef.inizio >= ultimo.ef.inizio) ultimo = { ef, p, regola };
    }
    if (ultimo) {
      const Rv = Math.max(14, ultimo.p.r || 0) * ultimo.ef.scala * ultimo.regola[1];
      return { x: ultimo.p.x, y: ultimo.p.y, k: Math.max(1, Math.min(tetto * 0.8, lato * 0.42 / Rv)),
        ay: STOR_REGIA.effettoY, motivo: 'effetto', id: ultimo.ef.tipo };
    }
    // 2. Chi la scena vuole vicino
    if (r.modo === 'close' && r.chi) {
      const d = quanti.find(x => x.id === r.chi);
      if (d) return primoPiano(d, STOR_REGIA.volto, 'vicino');
    }
    const chi = storChiParlaOra();
    const parla = chi ? quanti.find(d => d.id === chi) : null;
    // 2-bis. Il giro (v431): attorno a chi la scena ha scelto, se no a chi
    // parla, se no a chi c'era prima, se no al primo che c'è. Il volto più
    // piccolo, perché il bello del giro è il mondo che si muove dietro
    if (r.modo === 'orbit') {
      const d = (r.chi && quanti.find(x => x.id === r.chi)) || parla ||
        (r.ultimoGiro && quanti.find(x => x.id === r.ultimoGiro)) || quanti[0];
      // Anche girando, chi parla si guarda da vicino (v433): il giro continua
      // e la camera stringe su di lui finché parla, poi torna al giro largo
      if (d) return Object.assign(primoPiano(d, d === parla ? STOR_REGIA.voltoStretto : STOR_REGIA.giroVolto, 'giro'), { ax: 0.5 });
    }
    // 2-ter. Sempre su chi parla (v431): primo piano stretto, niente campo e
    // controcampo, e fra due battute resta su chi ha parlato per ultimo
    if (r.modo === 'speaker') {
      const d = parla || (r.ultimoParlante && quanti.find(x => x.id === r.ultimoParlante));
      if (d) return primoPiano(d, STOR_REGIA.voltoStretto, 'parla');
    }
    // 3. Chi parla
    if (parla) {
      const solo = primoPiano(parla, STOR_REGIA.volto, 'parla');
      // Il campo e controcampo dei cartoni: se chi ascolta è vicino, li si
      // tiene tutti e due (si vede lo sguardo che va da uno all'altro)
      const a = storOcchiDi(parla);
      let meglio = null;
      for (const d of quanti) {
        if (d.id === parla.id) continue;
        const b = storOcchiDi(d);
        const x0 = Math.min(a.x - a.R * 1.35, b.x - b.R * 1.35), x1 = Math.max(a.x + a.R * 1.35, b.x + b.R * 1.35);
        const y0 = Math.min(a.y - a.R * 1.2, b.y - b.R * 1.2), y1 = Math.max(a.y + a.R * 1.5, b.y + b.R * 1.5);
        const k = Math.min(L * 0.84 / (x1 - x0), H * 0.6 / (y1 - y0), tetto);
        if (k >= solo.k * 0.6 && (!meglio || k > meglio.k))
          meglio = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, k: Math.max(1, k), ay: 0.44, motivo: 'dialogo', id: parla.id + '+' + d.id };
      }
      return meglio || solo;
    }
    // 4. Chi sta facendo qualcosa
    for (const d of quanti) {
      const pg = stor.personaggi.get(d.id);
      if (!pg) continue;
      const viaggia = pg.moto && pg.moto.u > 0 && pg.moto.u < 1;
      const salta = pg.animazioni.some(a => a.u > 0 && a.u < 1);
      const cambia = pg.veste && pg.veste.u > 0 && pg.veste.u < 1;
      if (viaggia || salta || cambia) return primoPiano(d, STOR_REGIA.volto * 0.62, 'azione');
    }
    return null;
  }
  /* Il largo che non sta fermo (v434). Prima, quando nessuno parlava, la
   * lente tornava a 1 e il quadro restava quello della scena: in una storia
   * di battute corte la camera faceva «dentro e fuori» e fra una battuta e
   * l'altra restava immobile. Ora il largo è il piano d'insieme dei
   * cartoni: tiene tutti i personaggi disegnati (un poco più stretto della
   * scena, al più `gruppoMax`) e gli si avvicina piano (`gruppoCarrello`),
   * così il quadro non è mai fermo. Funzione pura sullo stato. */
  function storRegiaGruppo(vista, L, H) {
    const quanti = stor.ultimiDisegnati.filter(d => d.vista === vista && !d.fuori);
    if (!quanti.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const d of quanti) {
      const o = storOcchiDi(d);
      x0 = Math.min(x0, o.x - o.R * 1.8); x1 = Math.max(x1, o.x + o.R * 1.8);
      y0 = Math.min(y0, o.y - o.R * 1.6); y1 = Math.max(y1, o.y + o.R * 1.9);
    }
    const k = Math.max(1, Math.min(STOR_REGIA.gruppoMax, L * 0.8 / Math.max(1, x1 - x0), H * 0.62 / Math.max(1, y1 - y0)));
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, k, ay: 0.46, ax: 0.5, motivo: 'gruppo', id: 'gruppo' };
  }
  // La molla della camera: smorzata al punto giusto, arriva senza oscillare
  function molla(x, v, meta, w, dt) {
    const a = w * w * (meta - x) - 2 * w * v;
    v += a * dt; x += v * dt;
    return [x, v];
  }
  // Una scossa: il botto la chiede, la lente la consuma
  function storScossa(forza, durata = 700) {
    if (!(forza > 0)) return;
    stor.regia.scosse.push({ da: stor.orologio, forza: Math.min(1.5, forza), durata });
  }
  function storLenteApri(ctx, vista, L, H) {
    const r = stor.regia;
    if (r.aperta) storLenteChiudi();
    if (!ctx || !(L > 0 && H > 0)) return;
    const ora = adesso();
    const dt = r.ultimo ? Math.min(0.1, Math.max(0, (ora - r.ultimo) / 1000)) : 0;
    r.ultimo = ora;
    const accesa = regiaAccesa();
    // Un'altra vista (il volo dal cielo alla 3D) o un'altra tela: si riparte larghi
    if (r.vista !== vista || Math.abs(r.L - L) > 1 || Math.abs(r.H - H) > 1) {
      Object.assign(r, { vista, L, H, lk: 0, vlk: 0, fx: NaN, fy: NaN, vfx: 0, vfy: 0, ay: 0.5, vay: 0, ax: 0.5, vax: 0, tieni: null, ripresa: null });
    }
    if (!accesa && r.lk < 0.002 && !r.scosse.length && Math.abs(r.rot) < 1e-4) { r.k = 1; r.tx = 0; r.ty = 0; r.rot = 0; r.vrot = 0; r.motivo = 'largo'; r.vfx = r.vfy = r.vlk = 0; return; }
    let meta = accesa ? storRegiaInquadra(vista, L, H) : null;
    if (meta && meta.motivo === 'parla') r.ultimoParlante = meta.id;
    if (meta && meta.motivo === 'giro') r.ultimoGiro = meta.id;
    const giro = storRegiaGiro();
    // Nel planetario il giro è il quadro che scivola in cerchio attorno al
    // personaggio (nella 3D e nella scala cosmica gira la camera vera)
    if (meta && meta.motivo === 'giro' && vista === 'cielo' && !stor.ridotto) {
      const raggio = STOR_REGIA.giroCerchio * Math.min(L, H) / Math.max(1, meta.k);
      meta = Object.assign({}, meta, { x: meta.x + raggio * Math.cos(giro), y: meta.y + raggio * 0.6 * Math.sin(giro) });
    }
    if (meta && meta.motivo !== 'gruppo') r.tieni = { meta, da: ora };
    else if (accesa && r.tieni && ora - r.tieni.da < STOR_REGIA.tieniMs) meta = r.tieni.meta;
    if (!meta && accesa) meta = storRegiaGruppo(vista, L, H);
    if (!Number.isFinite(r.fx)) { r.fx = meta ? meta.x : L / 2; r.fy = meta ? meta.y : H / 2; }
    // La ripresa (v427): da quando la camera tiene lo stesso soggetto. Su una
    // battuta lunga si avvicina ancora piano (il carrello dei cartoni), così
    // il quadro non è mai fermo del tutto
    const tetto = Math.max(1, Math.min(4, r.zoomMax || STOR_REGIA.zoomMax));
    if (meta && (!r.ripresa || r.ripresa.id !== meta.id)) r.ripresa = { id: meta.id, da: stor.orologio };
    if (!meta) r.ripresa = null;
    let kMeta = meta ? meta.k : 1;
    if (meta && (meta.motivo === 'parla' || meta.motivo === 'dialogo') && !stor.ridotto) {
      const u = liscio((stor.orologio - r.ripresa.da) / STOR_REGIA.carrelloMs);
      kMeta = Math.min(tetto * (1 + STOR_REGIA.carrello), kMeta * (1 + STOR_REGIA.carrello * u));
    }
    if (meta && meta.motivo === 'gruppo') {
      const u = liscio((stor.orologio - r.ripresa.da) / STOR_REGIA.gruppoMs);
      kMeta *= 1 + STOR_REGIA.gruppoCarrello * (stor.ridotto ? 0.5 : 1) * u;
    }
    let lkMeta = Math.log(kMeta);
    // L'arco (v427): passando da un personaggio lontano a un altro la camera
    // si allarga un poco a metà strada e si riavvicina all'arrivo, invece di
    // strisciare in primo piano sul vuoto fra i due
    if (meta && Number.isFinite(r.fx) && !stor.ridotto) {
      const lontano = Math.hypot(meta.x - r.fx, meta.y - r.fy) / Math.max(1, Math.min(L, H));
      lkMeta = Math.max(0, lkMeta - Math.min(STOR_REGIA.arco, lontano * 0.9));
    }
    // In pausa la camera si ferma con la storia
    const passo = demoInPausa() ? 0 : dt;
    const piano = stor.ridotto ? STOR_REGIA.ridottoMolla : 1;
    const w = STOR_REGIA.omega * piano, wz = STOR_REGIA.omegaZoom * piano;
    for (let n = Math.max(1, Math.ceil(passo / 0.02)), i = 0; i < n && passo > 0; i++) {
      const h = passo / n;
      [r.lk, r.vlk] = molla(r.lk, r.vlk, lkMeta, wz, h);
      if (meta) {
        // Nel giro il personaggio si sposta sul disegno di continuo (è il
        // mondo che gli gira attorno): una molla più svelta lo tiene al centro
        const wf = meta.motivo === 'giro' && r.ripresa && stor.orologio - r.ripresa.da > 1200 ? w * 2.2 : w;
        [r.fx, r.vfx] = molla(r.fx, r.vfx, meta.x, wf, h);
        [r.fy, r.vfy] = molla(r.fy, r.vfy, meta.y, wf, h);
        [r.ay, r.vay] = molla(r.ay, r.vay, meta.ay, w, h);
      }
      [r.ax, r.vax] = molla(r.ax, r.vax, meta && Number.isFinite(meta.ax) ? meta.ax : 0.5, w * 0.6, h);
      // Il rollio del giro nel planetario: va e viene col giro, e finito il
      // giro torna dritto con la sua molla
      const rotMeta = meta && meta.motivo === 'giro' && vista === 'cielo' && !stor.ridotto
        ? STOR_REGIA.giroRollio * Math.sin(giro * 1.3) : 0;
      [r.rot, r.vrot] = molla(r.rot, r.vrot, rotMeta, w * 0.5, h);
    }
    r.lk = Math.max(0, r.lk);
    // La scossa: ingrandisce appena (così il tremito non scopre i bordi) e
    // sposta il quadro su due seni sfasati, che si spengono in fretta
    let forza = 0;
    r.scosse = r.scosse.filter(s => stor.orologio - s.da < s.durata && stor.orologio >= s.da - 50);
    for (const s of r.scosse) { const q = 1 - (stor.orologio - s.da) / s.durata; forza += s.forza * q * q; }
    if (stor.ridotto) forza = 0;
    const k = Math.exp(r.lk) * (1 + 0.035 * Math.min(1.5, forza));
    const ax = L * r.ax, ay = H * r.ay;
    let tx = ax - k * r.fx, ty = ay - k * r.fy;
    // La camera a mano (v427): in primo piano il quadro respira, due seni
    // lenti e sfasati; largo resta fermo. Segue l'orologio della storia,
    // quindi in pausa si ferma anche lui
    if (!stor.ridotto && k > 1.01) {
      const t = stor.orologio, amp = STOR_REGIA.respiro * Math.min(L, H) * Math.min(1, k - 1);
      tx += amp * (Math.sin(t * 0.00037) + 0.5 * Math.sin(t * 0.00091 + 1.1));
      ty += amp * 0.8 * (Math.sin(t * 0.00029 + 0.7) + 0.5 * Math.sin(t * 0.00083 + 2.3));
    }
    if (forza > 0) {
      const t = stor.orologio;
      tx += forza * 7 * (Math.sin(t * 0.061) + 0.6 * Math.sin(t * 0.137 + 1.3));
      ty += forza * 6 * (Math.sin(t * 0.077 + 0.4) + 0.6 * Math.sin(t * 0.151 + 2.1));
    }
    // La finestra non esce dalla tela
    tx = Math.min(0, Math.max(L * (1 - k), tx));
    ty = Math.min(0, Math.max(H * (1 - k), ty));
    r.k = k; r.tx = tx; r.ty = ty; r.motivo = meta ? meta.motivo : 'largo';
    r.rx = ax; r.ry = ay;
    if (stor.ridotto) r.rot = 0;
    const ruota = Math.abs(r.rot) > 1e-4;
    if (k < 1.0005 && Math.abs(tx) < 0.05 && Math.abs(ty) < 0.05 && !ruota) return;
    ctx.save();
    // Il rollio gira attorno al punto dove la lente porta il soggetto: lui
    // resta lì, è il cielo che gli si inclina attorno
    if (ruota) { ctx.translate(ax, ay); ctx.rotate(r.rot); ctx.translate(-ax, -ay); }
    ctx.translate(tx, ty);
    ctx.scale(k, k);
    r.aperta = ctx;
  }
  function storLenteChiudi() {
    const r = stor.regia;
    if (!r.aperta) return;
    const ctx = r.aperta;
    r.aperta = null;
    try { ctx.restore(); } catch (_) { /* contesto perso */ }
  }
  // Da un punto del disegno a dove si vede sullo schermo, con la lente di adesso
  function storLenteSchermo(x, y) {
    const r = stor.regia;
    const sx = r.tx + r.k * x, sy = r.ty + r.k * y;
    if (!r.rot) return { x: sx, y: sy };
    const c = Math.cos(r.rot), s = Math.sin(r.rot), dx = sx - (r.rx || 0), dy = sy - (r.ry || 0);
    return { x: (r.rx || 0) + c * dx - s * dy, y: (r.ry || 0) + s * dx + c * dy };
  }
  /* Il giro della camera (v431), in radianti: quanto la regia vuole che la
   * camera della 3D e della scala cosmica giri **in più** di quella della
   * scena. Corre sull'orologio della storia (in pausa si ferma), prende e
   * lascia la velocità in `giroAvvio` secondi, e tace dove tace la regia;
   * presa la camera a mano resta dov'era (niente scatto sotto il dito). Si
   * azzera con la scena (`story_camera` che si chiude): il taglio di scena
   * è il momento giusto per uno stacco. `solDisegna` lo somma a `sol.az` e
   * a `cosm.az` per il solo fotogramma. */
  function storRegiaGiro() {
    const r = stor.regia;
    const t = stor.orologio;
    const dt = Number.isFinite(r.giroOra) ? Math.max(0, Math.min(0.1, (t - r.giroOra) / 1000)) : 0;
    r.giroOra = t;
    if (cameraInMano()) { r.vGiro = 0; return r.giro; }
    const vuole = r.modo === 'orbit' && regiaAccesa() ? r.velGiro * Math.PI / 180 * (stor.ridotto ? 0.5 : 1) : 0;
    if (dt > 0) {
      const a = Math.min(1, dt / Math.max(0.05, STOR_REGIA.giroAvvio / 3));
      r.vGiro += (vuole - r.vGiro) * a;
      if (Math.abs(r.vGiro) < 1e-4 && !vuole) r.vGiro = 0;
      r.giro += r.vGiro * dt;
    }
    return r.giro;
  }

  /* Il cartello del luogo (v429, rifatto nella v430). Chi guarda una
   * CosmoStoria deve sapere dove si trova — il cielo di casa, il Sistema
   * Solare, la Terra e la Luna, e nella scala cosmica a che altezza
   * dell'universo (l'eliopausa, la nube di Oort, il Gruppo Locale…). Nella
   * v429 era un cartiglio grande in alto al centro con «Sei qui», sempre
   * acceso: troppo appariscente, ha detto chi guarda. Ora è solo il nome,
   * piccolo e semitrasparente nell'angolo in alto a destra, e solo per
   * qualche secondo quando il luogo cambia (`STOR_CARTELLO`): compare piano,
   * resta, se ne va. Fuori dalla lente della regia; è della storia, quindi
   * c'è anche con le scritte spente, e fuori da una storia non c'è. */
  const STOR_CARTELLO = { entra: 400, resta: 3200, esce: 900, alfa: 0.78 };
  function storDisegnaCartelloLuogo(ctx, chiave, L, H) {
    const d = radice.AstroDemo;
    if (!ctx || !chiave || !(d && d.storia) || !(L > 0 && H > 0)) return;
    const nome = t(chiave);
    if (!nome) return;
    const c = stor.cartello || (stor.cartello = { chiave: '', da: 0 });
    const ora = adesso();
    if (c.chiave !== chiave) { c.chiave = chiave; c.da = ora; }
    const eta = ora - c.da, C = STOR_CARTELLO;
    if (eta > C.entra + C.resta + C.esce) return;
    const alfa = C.alfa * (eta < C.entra ? eta / C.entra : eta < C.entra + C.resta ? 1 : 1 - (eta - C.entra - C.resta) / C.esce);
    if (!(alfa > 0.01)) return;
    // v432: un poco più grande (era 11–13,5 px): chi guarda lo trovava
    // troppo piccolo per leggerlo al volo
    const fs = Math.max(14, Math.min(19, L * 0.017));
    const carattere = (radice.document && radice.document.body && radice.getComputedStyle
      ? radice.getComputedStyle(radice.document.body).fontFamily : '') || 'sans-serif';
    ctx.save();
    ctx.font = `600 ${fs}px ${carattere}`;
    const w = Math.min(L * 0.5, ctx.measureText(nome).width + fs * 1.6), h = fs * 2;
    const margine = 16;
    const x = L - margine - w, y = margine;
    ctx.globalAlpha = alfa;
    ctx.fillStyle = 'rgba(12, 10, 32, 0.5)';
    ctx.beginPath();
    const r = h / 2;
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x + r, y + h); ctx.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255, 248, 235, 0.22)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255, 248, 235, 0.92)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(nome, x + w / 2, y + h / 2 + 0.5, w - fs);
    ctx.restore();
  }

  /* Il cartello della domanda al pubblico (v430, `story_question`). Sta in
   * alto, sotto al cartello «Sei qui», nello stesso adesivo: la domanda a
   * capo su al più tre righe, poi le due scelte A e B (se ci sono) in due
   * pillole di colore diverso, e l'invito a rispondere. Compare col pop
   * elastico; col movimento ridotto c'è e basta. */
  // La larghezza di un testo; senza misura (una tela finta) una stima
  function larghezzaTesto(ctx, testo, fs) {
    const m = ctx.measureText ? ctx.measureText(testo) : null;
    return m && Number.isFinite(m.width) ? m.width : String(testo).length * fs * 0.55;
  }
  function storRigheTesto(ctx, testo, largo, max, fs) {
    const parole = String(testo).split(/\s+/).filter(Boolean), righe = [];
    let riga = '';
    for (const p of parole) {
      const prova = riga ? riga + ' ' + p : p;
      if (riga && larghezzaTesto(ctx, prova, fs) > largo) { righe.push(riga); riga = p; }
      else riga = prova;
    }
    if (riga) righe.push(riga);
    if (righe.length > max) { righe.length = max; righe[max - 1] = righe[max - 1].replace(/\s*\S*$/, '') + '…'; }
    return righe;
  }
  function storDisegnaDomanda(ctx, L, H) {
    const d = stor.domanda;
    if (!ctx || !d || !(L > 0 && H > 0)) return;
    const ora = adesso();
    const ridotto = movimentoRidotto();
    const u = ridotto ? 1 : Math.min(1, (ora - d.da) / 560);
    const c1 = 1.9, v = u - 1;
    const pop = u >= 1 ? 1 : Math.max(0, 1 + (c1 + 1) * v * v * v + c1 * v * v);
    const carattere = (radice.document && radice.document.body && radice.getComputedStyle
      ? radice.getComputedStyle(radice.document.body).fontFamily : '') || 'sans-serif';
    const fsC = Math.max(15, Math.min(24, L * 0.026));
    const fs = Math.max(14, Math.min(22, L * 0.024));
    const w = Math.min(L - 24, 600);
    ctx.save();
    ctx.font = `800 ${fs}px ${carattere}`;
    const righe = storRigheTesto(ctx, d.testo, w - fs * 2, 3, fs);
    const scelte = [d.a, d.b].filter(Boolean);
    const fsS = fs * 0.85, hS = fsS * 2;
    ctx.font = `800 ${fsS}px ${carattere}`;
    const largoS = Math.max(0, ...scelte.map(x => larghezzaTesto(ctx, x, fsS))) + hS * 1.6;
    const inColonna = scelte.length === 2 && largoS * 2 + fs > w - fs * 1.6;
    const altScelte = !scelte.length ? 0 : (inColonna ? scelte.length * (hS + 6) : hS + 6);
    const fsI = Math.max(10, fs * 0.58);
    const h = fs * 0.9 + righe.length * fs * 1.25 + (altScelte ? altScelte + fs * 0.35 : 0) + fsI * 1.9;
    const cx = L / 2;
    const y0 = (L < 640 ? 100 : 16) + fsC * 2.55 + 12;
    const cy = Math.min(H - h / 2 - 8, y0 + h / 2) + (ridotto ? 0 : Math.sin(ora / 1900) * 1.5);
    ctx.globalAlpha = Math.min(1, u * 2.5);
    ctx.translate(cx, cy);
    ctx.scale(pop, pop);
    // l'adesivo: l'ombra piatta, il fondo viola, il bordo color panna
    ctx.fillStyle = 'rgba(8, 4, 20, 0.55)';
    rettangolo(ctx, -w / 2 + 3, -h / 2 + 4, w, h, fs * 0.9); ctx.fill();
    const fondo = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    fondo.addColorStop(0, 'rgba(60, 36, 110, 0.95)'); fondo.addColorStop(1, 'rgba(26, 16, 56, 0.95)');
    ctx.fillStyle = fondo;
    rettangolo(ctx, -w / 2, -h / 2, w, h, fs * 0.9); ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(255, 248, 235, 0.9)'; ctx.stroke();
    // il punto di domanda, nel suo tondo, che dondola
    const qx = -w / 2 + fs * 0.2, qy = -h / 2 + fs * 0.15, qr = fs * 0.8;
    ctx.save();
    ctx.translate(qx, qy); ctx.rotate(ridotto ? 0 : Math.sin(ora / 500) * 0.15);
    ctx.beginPath(); ctx.arc(0, 0, qr, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INCHIOSTRO; ctx.stroke();
    ctx.font = `900 ${fs * 1.15}px ${carattere}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INCHIOSTRO;
    ctx.fillText('?', 0, fs * 0.05);
    ctx.restore();
    // la domanda
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = `800 ${fs}px ${carattere}`;
    let y = -h / 2 + fs * 0.9 + fs * 0.5;
    for (const r of righe) {
      ctx.lineWidth = Math.max(3, fs * 0.2); ctx.strokeStyle = INCHIOSTRO; ctx.strokeText(r, 0, y);
      ctx.fillStyle = '#fff8eb'; ctx.fillText(r, 0, y);
      y += fs * 1.25;
    }
    // le scelte
    if (scelte.length) {
      y += fs * 0.1;
      const colori = [['#fbbf24', '#78350f'], ['#67e8f9', '#164e63']];
      const lw = inColonna ? Math.min(w - fs * 2, largoS) : largoS;
      const posti = inColonna ? scelte.map((_, i) => [0, y + i * (hS + 6) + hS / 2])
        : scelte.length === 1 ? [[0, y + hS / 2]] : [[-(lw + fs) / 2, y + hS / 2], [(lw + fs) / 2, y + hS / 2]];
      scelte.forEach((testo, i) => {
        const [px, py] = posti[i];
        ctx.font = `800 ${fsS}px ${carattere}`;
        rettangolo(ctx, px - lw / 2, py - hS / 2, lw, hS, hS / 2);
        ctx.fillStyle = 'rgba(255, 248, 235, 0.96)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = INCHIOSTRO; ctx.stroke();
        const lx = px - lw / 2 + hS / 2;
        ctx.beginPath(); ctx.arc(lx, py, hS * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = colori[i][0]; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = colori[i][1];
        ctx.fillText(i ? 'B' : 'A', lx, py + fsS * 0.04);
        ctx.fillStyle = INCHIOSTRO;
        ctx.fillText(testo, px + hS * 0.3, py + fsS * 0.04, lw - hS * 1.3);
      });
      y += altScelte;
    }
    // l'invito
    const invito = t('storie.domanda.invito');
    if (invito) {
      ctx.font = `700 ${fsI}px ${carattere}`;
      ctx.fillStyle = '#fde68a';
      ctx.fillText(invito, 0, h / 2 - fsI * 1.05, w - fs);
    }
    ctx.restore();
  }

  // ===================================================================
  // 7-quater. I rumori: botti, boing e scintille (v416)
  // ===================================================================

  /* Ogni effetto ha il suo rumore, e così i gesti dei personaggi: il boing
   * di un salto, il fischio di un viaggio, lo zap del teletrasporto, il
   * risucchio di un buco nero. Sono **sintetizzati** con Web Audio, nello
   * stesso spirito dei disegni: niente file da scaricare (l'app funziona
   * offline), un suono da cartone animato e non una registrazione vera, e
   * ognuno è una ricetta di pochi oscillatori e un soffio di rumore filtrato.
   *
   * Il contesto audio è quello della voce (`narr.audioContesto`), così i
   * rumori finiscono anche nel filmato registrato con l'audio, attraverso la
   * stessa presa (`narr.cattura`). Mentre un personaggio parla i rumori si
   * abbassano, per non coprirlo. Tacciono con l'opzione «Effetti sonori
   * nelle storie» spenta, in pausa, fuori da una demo, e senza Web Audio. */
  const STOR_SUONI = ['explosion', 'shockwave', 'flash', 'sparkles', 'fireworks', 'smoke', 'hearts', 'lightning',
    'shooting_star', 'glow', 'confetti', 'boing', 'whoosh', 'pop', 'zap', 'magic', 'inflate', 'suck', 'wobble',
    'spin', 'tada', 'ding', 'drumroll', 'rumble'];
  // Il rumore che fa ogni gesto, quando la storia non ne sceglie un altro
  const STOR_SUONO_ANIMAZIONE = { jump: 'boing', bounce: 'boing', shake: 'wobble', nod: null, spin: 'spin', pulse: 'pop', dance: 'tada', wobble: 'wobble' };
  const STOR_SUONO_PERCORSO = { arc: 'whoosh', straight: 'whoosh', hop: 'boing', loop: 'whoosh', spiral: 'spin', zigzag: 'whoosh', teleport: 'zap' };
  const STOR_SUONO_VESTE = { red_giant: 'inflate', white_dwarf: 'magic', supernova: 'explosion', black_hole: 'suck', self: 'magic' };
  const suono = { uscita: null, contesto: null, rumore: null, attivi: new Set(), ultimi: new Map(), prese: new WeakSet() };

  function storContestoAudio() {
    const AC = radice.AudioContext || radice.webkitAudioContext;
    const n = typeof narr !== 'undefined' ? narr : null;   // narrazione.js
    let a = (n && n.audioContesto) || suono.contesto;
    if (!a) {
      if (!AC) return null;
      try { a = new AC(); } catch (_) { return null; }
      if (n) n.audioContesto = a;
    }
    if (a.state === 'suspended' && a.resume) Promise.resolve(a.resume()).catch(() => {});
    if (suono.contesto !== a) {
      suono.contesto = a; suono.rumore = null;
      const g = a.createGain(); g.gain.value = 0.6;
      let fine = g;
      // Un compressore in fondo: tre botti di fila non devono gracchiare
      if (typeof a.createDynamicsCompressor === 'function') {
        const c = a.createDynamicsCompressor();
        try { c.threshold.value = -14; c.ratio.value = 6; c.attack.value = 0.003; c.release.value = 0.25; } catch (_) { /* valori di serie */ }
        g.connect(c); fine = c;
      }
      fine.connect(a.destination);
      suono.uscita = { g, fine };
    }
    // Il filmato con l'audio: la stessa presa della voce
    const presa = n && n.cattura && n.cattura.destinazione;
    if (presa && !suono.prese.has(presa)) { try { suono.uscita.fine.connect(presa); suono.prese.add(presa); } catch (_) { /* niente */ } }
    return a;
  }
  // Due secondi di rumore bianco, fatti una volta sola
  function rumoreBianco(a) {
    if (suono.rumore) return suono.rumore;
    const n = Math.floor(a.sampleRate * 2);
    const b = a.createBuffer(1, n, a.sampleRate);
    const dati = b.getChannelData(0);
    const r = { s: 12345 };
    for (let i = 0; i < n; i++) dati[i] = dado(r) * 2 - 1;
    suono.rumore = b;
    return b;
  }
  function vivo(nodo, fine) {
    suono.attivi.add(nodo);
    nodo.onended = () => suono.attivi.delete(nodo);
    nodo.stop(fine);
  }
  // L'inviluppo: sale in `attacco` fino a `picco`, poi si spegne in `durata`
  function inviluppo(param, t0, attacco, picco, durata) {
    param.setValueAtTime(0.0001, t0);
    param.exponentialRampToValueAtTime(Math.max(0.0002, picco), t0 + Math.max(0.002, attacco));
    param.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attacco + 0.01, durata));
  }
  // Un tono, con la sua scivolata di altezza
  function tono(a, uscita, o) {
    const t0 = o.t0, durata = o.durata;
    const osc = a.createOscillator();
    osc.type = o.tipo || 'sine';
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.curva) osc.frequency.setValueCurveAtTime(o.curva, t0, durata);
    else if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t0 + durata);
    const g = a.createGain();
    inviluppo(g.gain, t0, o.attacco || 0.005, o.picco || 0.2, durata);
    let ultimo = osc;
    if (o.taglio) {
      const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.taglio, t0);
      osc.connect(f); ultimo = f;
    }
    if (o.vibrato) {
      const lfo = a.createOscillator(), prof = a.createGain();
      lfo.frequency.value = o.vibrato[0]; prof.gain.value = o.vibrato[1];
      lfo.connect(prof); prof.connect(osc.frequency);
      lfo.start(t0); vivo(lfo, t0 + durata + 0.05);
    }
    ultimo.connect(g); g.connect(uscita);
    osc.start(t0); vivo(osc, t0 + durata + 0.05);
  }
  // Un soffio di rumore filtrato: il fumo, il vento, il tuono, il botto
  function soffio(a, uscita, o) {
    const t0 = o.t0, durata = o.durata;
    const src = a.createBufferSource();
    src.buffer = rumoreBianco(a);
    const f = a.createBiquadFilter();
    f.type = o.filtro || 'lowpass';
    f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(o.f0, t0);
    if (o.fm) { f.frequency.exponentialRampToValueAtTime(o.fm, t0 + durata * 0.45); if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t0 + durata); }
    else if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t0 + durata);
    const g = a.createGain();
    inviluppo(g.gain, t0, o.attacco || 0.005, o.picco || 0.3, durata);
    src.connect(f); f.connect(g); g.connect(uscita);
    src.start(t0, (o.da || 0) % 1.5);
    vivo(src, t0 + durata + 0.05);
  }
  // Il «boing»: un'altezza che oscilla e si smorza, come una molla pizzicata
  function curvaBoing(f, n = 96) {
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const u = i / (n - 1); c[i] = f * (1 + 0.35 * u) * (1 + 0.55 * Math.exp(-4.5 * u) * Math.sin(2 * Math.PI * 6 * u)); }
    return c;
  }
  /* Le ricette. `t` è l'istante di partenza, `d` il dado seminato (lo stesso
   * effetto suona sempre uguale), `v` il volume. */
  const RICETTE = {
    explosion(a, u, t, d, v) {
      soffio(a, u, { t0: t, durata: 0.12, filtro: 'highpass', f0: 2200, picco: 0.45 * v, attacco: 0.002 });
      soffio(a, u, { t0: t, durata: 1.7, f0: 3200, f1: 80, picco: 0.7 * v, attacco: 0.004 });
      tono(a, u, { t0: t, durata: 0.95, f0: 120, f1: 30, picco: 0.65 * v, attacco: 0.006 });
      for (let i = 0; i < 6; i++) soffio(a, u, { t0: t + 0.25 + dado(d) * 0.8, durata: 0.05, filtro: 'bandpass', f0: 900 + dado(d) * 1800, q: 2, picco: 0.18 * v, da: dado(d) });
    },
    shockwave(a, u, t, d, v) {
      soffio(a, u, { t0: t, durata: 1.1, filtro: 'bandpass', f0: 220, fm: 2400, f1: 260, q: 1.6, picco: 0.5 * v, attacco: 0.08 });
      tono(a, u, { t0: t, durata: 1.2, f0: 70, f1: 38, picco: 0.5 * v, attacco: 0.12 });
    },
    flash(a, u, t, d, v) {
      tono(a, u, { t0: t, durata: 0.4, f0: 2600, f1: 1800, picco: 0.16 * v });
      tono(a, u, { t0: t, durata: 0.22, tipo: 'triangle', f0: 3900, picco: 0.07 * v });
      soffio(a, u, { t0: t, durata: 0.3, filtro: 'highpass', f0: 6000, picco: 0.1 * v });
    },
    sparkles(a, u, t, d, v) {
      const note = [1568, 1760, 2093, 2349, 2637, 3136, 3520];
      for (let i = 0; i < 9; i++) {
        const f = note[Math.floor(dado(d) * note.length)], t0 = t + i * 0.075 + dado(d) * 0.03;
        tono(a, u, { t0, durata: 0.2, f0: f, picco: 0.11 * v });
        tono(a, u, { t0, durata: 0.12, tipo: 'triangle', f0: f * 2, picco: 0.03 * v });
      }
    },
    fireworks(a, u, t, d, v) {
      for (let c = 0; c < 2; c++) {
        const t0 = t + c * 0.75;
        tono(a, u, { t0, durata: 0.55, f0: 520 + c * 90, f1: 1900 + c * 200, picco: 0.1 * v, vibrato: [18, 25] });
        soffio(a, u, { t0: t0 + 0.55, durata: 0.6, f0: 2000, f1: 180, picco: 0.6 * v, attacco: 0.003 });
        tono(a, u, { t0: t0 + 0.55, durata: 0.35, f0: 150, f1: 50, picco: 0.45 * v });
        for (let i = 0; i < 10; i++) soffio(a, u, { t0: t0 + 0.7 + dado(d) * 0.8, durata: 0.03, filtro: 'bandpass', f0: 2500 + dado(d) * 2500, q: 3, picco: 0.12 * v, da: dado(d) });
      }
    },
    smoke(a, u, t, d, v) { soffio(a, u, { t0: t, durata: 1.2, f0: 900, f1: 260, picco: 0.24 * v, attacco: 0.2 }); },
    hearts(a, u, t, d, v) {
      [1047, 1319, 1568].forEach((f, i) => {
        tono(a, u, { t0: t + i * 0.16, durata: 0.4, f0: f, picco: 0.14 * v, vibrato: [6, 8] });
        tono(a, u, { t0: t + i * 0.16, durata: 0.3, tipo: 'triangle', f0: f / 2, picco: 0.05 * v });
      });
    },
    lightning(a, u, t, d, v) {
      soffio(a, u, { t0: t, durata: 0.2, filtro: 'highpass', f0: 1600, picco: 0.8 * v, attacco: 0.002 });
      soffio(a, u, { t0: t + 0.08, durata: 2.2, f0: 420, f1: 70, picco: 0.6 * v, attacco: 0.14 });
      tono(a, u, { t0: t + 0.1, durata: 1.8, f0: 48, f1: 36, picco: 0.35 * v, attacco: 0.2 });
    },
    shooting_star(a, u, t, d, v) {
      tono(a, u, { t0: t, durata: 1.0, f0: 2700, f1: 700, picco: 0.12 * v, vibrato: [9, 30] });
      soffio(a, u, { t0: t, durata: 0.9, filtro: 'bandpass', f0: 4200, f1: 1400, q: 1.2, picco: 0.06 * v });
      tono(a, u, { t0: t + 0.9, durata: 0.7, f0: 1760, picco: 0.08 * v });
    },
    glow(a, u, t, d, v) { [523, 659, 784, 1047].forEach(f => tono(a, u, { t0: t, durata: 1.7, f0: f, picco: 0.06 * v, attacco: 0.4 })); },
    confetti(a, u, t, d, v) {
      soffio(a, u, { t0: t, durata: 0.09, filtro: 'bandpass', f0: 1300, q: 1, picco: 0.6 * v, attacco: 0.002 });
      for (let i = 0; i < 10; i++) soffio(a, u, { t0: t + 0.06 + i * 0.03, durata: 0.025, filtro: 'highpass', f0: 3500, picco: 0.1 * v, da: dado(d) });
      tono(a, u, { t0: t + 0.16, durata: 0.16, tipo: 'triangle', f0: 784, picco: 0.14 * v });
      tono(a, u, { t0: t + 0.33, durata: 0.55, tipo: 'triangle', f0: 1047, picco: 0.16 * v, vibrato: [6, 10] });
    },
    boing(a, u, t, d, v) { tono(a, u, { t0: t, durata: 0.6, tipo: 'triangle', f0: 260, curva: curvaBoing(240 + dado(d) * 60), picco: 0.28 * v }); },
    whoosh(a, u, t, d, v) { soffio(a, u, { t0: t, durata: 0.7, filtro: 'bandpass', f0: 300, fm: 2400, f1: 500, q: 1.3, picco: 0.36 * v, attacco: 0.12 }); },
    pop(a, u, t, d, v) {
      tono(a, u, { t0: t, durata: 0.1, f0: 340, f1: 1000, picco: 0.32 * v });
      soffio(a, u, { t0: t, durata: 0.025, filtro: 'highpass', f0: 3000, picco: 0.12 * v });
    },
    zap(a, u, t, d, v) {
      tono(a, u, { t0: t, durata: 0.3, tipo: 'sawtooth', f0: 1700, f1: 160, picco: 0.1 * v, taglio: 3200 });
      tono(a, u, { t0: t + 0.04, durata: 0.26, tipo: 'square', f0: 1200, f1: 220, picco: 0.05 * v, taglio: 2600 });
    },
    magic(a, u, t, d, v) {
      [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => tono(a, u, { t0: t + i * 0.06, durata: 0.45, f0: f, picco: 0.1 * v }));
      soffio(a, u, { t0: t, durata: 1.0, filtro: 'highpass', f0: 5200, picco: 0.05 * v, attacco: 0.25 });
    },
    inflate(a, u, t, d, v) { tono(a, u, { t0: t, durata: 1.1, tipo: 'sawtooth', f0: 70, f1: 230, picco: 0.2 * v, attacco: 0.15, taglio: 900 }); },
    suck(a, u, t, d, v) {
      tono(a, u, { t0: t, durata: 1.5, f0: 320, f1: 36, picco: 0.4 * v, attacco: 0.5 });
      soffio(a, u, { t0: t, durata: 1.5, f0: 2600, f1: 110, picco: 0.32 * v, attacco: 0.7 });
    },
    wobble(a, u, t, d, v) { tono(a, u, { t0: t, durata: 0.7, tipo: 'triangle', f0: 210, picco: 0.2 * v, vibrato: [11, 70] }); },
    spin(a, u, t, d, v) {
      for (let i = 0; i < 3; i++) soffio(a, u, { t0: t + i * 0.17, durata: 0.2, filtro: 'bandpass', f0: 600, f1: 2800, q: 2, picco: 0.26 * v, attacco: 0.05, da: i * 0.3 });
    },
    tada(a, u, t, d, v) {
      tono(a, u, { t0: t, durata: 0.14, tipo: 'sawtooth', f0: 784, picco: 0.1 * v, taglio: 2400 });
      tono(a, u, { t0: t + 0.15, durata: 0.65, tipo: 'sawtooth', f0: 1047, picco: 0.12 * v, taglio: 2600, vibrato: [6, 9] });
    },
    ding(a, u, t, d, v) {
      tono(a, u, { t0: t, durata: 1.2, f0: 1319, picco: 0.2 * v });
      tono(a, u, { t0: t, durata: 0.6, f0: 2637, picco: 0.06 * v });
    },
    drumroll(a, u, t, d, v) {
      for (let i = 0; i < 22; i++) soffio(a, u, { t0: t + i * 0.06, durata: 0.05, filtro: 'bandpass', f0: 800, q: 1.4, picco: (0.08 + 0.2 * i / 22) * v, da: dado(d) });
      soffio(a, u, { t0: t + 1.35, durata: 1.0, filtro: 'highpass', f0: 5000, picco: 0.3 * v, attacco: 0.003 });
    },
    rumble(a, u, t, d, v) {
      soffio(a, u, { t0: t, durata: 2.0, f0: 220, f1: 90, picco: 0.5 * v, attacco: 0.4 });
      tono(a, u, { t0: t, durata: 2.0, f0: 40, picco: 0.3 * v, attacco: 0.4 });
    }
  };
  function suoniAccesi() {
    const d = radice.AstroDemo;
    if (!d || !d.inCorso || d.stato === 'pausa') return false;
    const o = d.opzioni;
    return !(o && o.effettiSonori === false);
  }
  /* Suona un rumore. `volume` da 0 a 2 (1 di serie). Restituisce vero se è
   * partito. Lo stesso rumore non riparte prima di un decimo di secondo: un
   * salto di scena che crea dieci azioni insieme non fa una raffica. */
  function storSuona(nome, opz = {}) {
    if (!RICETTE[nome] || !(opz.forza || suoniAccesi())) return false;
    const ora = adesso();
    if (ora - (suono.ultimi.get(nome) || -1e9) < 100) return false;
    const a = opz.contesto || storContestoAudio();
    if (!a) return false;
    suono.ultimi.set(nome, ora);
    const uscita = opz.contesto ? opz.uscita || a.destination : suono.uscita.g;
    // Sotto la voce di un personaggio i rumori si abbassano
    if (!opz.contesto) {
      const voce = radice.narrazione && typeof radice.narrazione.voce === 'function' ? radice.narrazione.voce() : null;
      try { uscita.gain.setTargetAtTime(voce && voce.parla ? 0.38 : 0.6, a.currentTime, 0.05); } catch (_) { /* niente */ }
    }
    const v = Math.max(0, Math.min(2, opz.volume === undefined ? 1 : Number(opz.volume) || 0));
    if (!(v > 0)) return false;
    try {
      RICETTE[nome](a, uscita, a.currentTime + 0.01, { s: seme(nome + ':' + (opz.seme || '')) || 1 }, v);
      return true;
    } catch (e) { return false; }
  }
  // Uno Stop o la fine della storia zittiscono anche i rumori in corso
  function storZittisci() {
    if (!suono.attivi.size) return;
    // Non un taglio secco: un'ombra di dissolvenza, poi tutto fermo
    const a = suono.contesto, fine = a ? a.currentTime + 0.2 : 0;
    try { if (a && suono.uscita) suono.uscita.g.gain.setTargetAtTime(0.0001, a.currentTime, 0.04); } catch (_) { /* niente */ }
    for (const n of suono.attivi) { try { n.stop(fine); } catch (_) { /* già fermo */ } }
    suono.attivi.clear();
  }
  // Il rumore di un gesto: `sound` del comando (`off`, un nome) o quello di serie
  function suonoScelto(p, diSerie) { return p.sound === 'off' ? null : p.sound && p.sound !== 'auto' ? p.sound : diSerie; }

  // ===================================================================
  // 8. Le azioni del DSL
  // ===================================================================

  const ERR_RIPIEGHI = {
    personaggioIgnoto: 'Personaggio sconosciuto: {nome}',
    espressioneIgnota: 'Espressione sconosciuta: {nome} (ammesse: {elenco})',
    sguardoIgnoto: 'Non so dove guardare: {nome}',
    personaggioNonInScena: '{nome} deve comparire in questa scena con character_show',
    personaggioVista: 'I personaggi compaiono solo nel planetario e nella vista 3D',
    soloCosmo: '{nome} vive nella scala cosmica: la scena vuole cosmic_scale',
    ideaFerma: '{nome} non ha un posto sulla carta: non viaggia e non si raggiunge',
    personaggioMisura: 'size vuole auto, disk o badge, oppure real',
    solo3d: '{comando} funziona solo nella vista 3D (solar_system_3d)',
    destinazioneIgnota: 'Non so dove andare: {nome}',
    versoSeStesso: '{nome} non può andare verso sé stesso',
    valoreIgnoto: '{campo} sconosciuto: {nome} (ammessi: {elenco})',
    numeroFuori: '{campo} vuole un numero fra {min} e {max}',
    coloreNonValido: 'Colore non valido: {nome} (si scrive \'#rrggbb\')',
    parametroSconosciuto: 'Parametro sconosciuto: {nome}',
    narraVuota: 'character_speak vuole un id o un testo',
    narraLunga: 'Testo di narrazione troppo lungo (al massimo 400 caratteri)',
    narraId: 'Narrazione sconosciuta: {id}',
    domandaVuota: 'story_question vuole il testo della domanda (text)',
    domandaLunga: '{campo} è troppo lungo (al massimo {max} caratteri)'
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
  function guardaVerso(o, scena) {
    if (o === undefined || o === 'viewer' || o === 'camera') return null;
    if (luogoCosmico(o) && !STOR_PERSONAGGI[o]) { richiedi(!scena || scenaCosmica(scena), 'soloCosmo', { nome: o }); return o; }
    const cosmico = STOR_PERSONAGGI[storCanonico(o)];
    if (cosmico && cosmico.cosmo) richiedi(!scena || scenaCosmica(scena), 'soloCosmo', { nome: storNome(storCanonico(o)) });
    richiedi(typeof o === 'string' && storOggettoNoto(storCanonico(o)), 'sguardoIgnoto', { nome: String(o) });
    return storCanonico(o);
  }
  function statoDemo() { const d = radice.AstroDemo; return d ? d.stato : 'attivo'; }

  let gettoni = 0;
  const COMANDI = {
    character_show: {
      verifica(p, scena) {
        campi(p, ['target', 'expression', 'look', 'size', 'sound']);
        const id = bersaglio(p);
        sceltaSuono(p);
        // la Via Lattea, Andromeda, Sirio: la carta sa dove stanno, il cielo
        // di casa e la vista 3D no
        if (scena && STOR_PERSONAGGI[id] && STOR_PERSONAGGI[id].cosmo) richiedi(scenaCosmica(scena), 'soloCosmo', { nome: storNome(id) });
        if (p.expression !== undefined) espressione(p.expression);
        guardaVerso(p.look, scena);
        richiedi(p.size === undefined || ['auto', 'disk', 'badge', 'real'].includes(p.size), 'personaggioMisura');
        inScena(p, scena, 'character_show');
      },
      crea(p) {
        // Una demo che comincia spegne l'anteprima della pagina: i volti di
        // una storia non si mescolano con quello di prova.
        if (stor.anteprima) storChiudiAnteprima();
        const nuovo = !stor.personaggi.has(storCanonico(p.target));
        const pg = storMostra(p.target, { espressione: p.expression, guarda: guardaVerso(p.look), misura: p.size });
        // Chi entra in scena per la prima volta fa «pop»
        const rumore = suonoScelto(p, nuovo ? 'pop' : null);
        if (rumore) storSuona(rumore, { seme: pg.id });
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
        guardaVerso(p.object, scena); inScena(p, scena);
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

  // I comandi del corpo e degli effetti (v409)
  function soloIn3d(scena, comando) {
    if (!scena) return;
    richiedi(scena.vista === 'solar_system_3d', 'solo3d', { comando });
  }
  function scelta(v, campo, ammessi) {
    richiedi(v === undefined || (typeof v === 'string' && ammessi.includes(v)), 'valoreIgnoto',
      { campo, nome: String(v), elenco: ammessi.join(', ') });
    return v;
  }
  function numeroIn(v, campo, min, max) {
    richiedi(v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max), 'numeroFuori',
      { campo, min, max });
    return v;
  }
  function verso(p, id, scena) {
    const v = p.to;
    richiedi(typeof v === 'string' && v.trim(), 'destinazioneIgnota', { nome: String(v) });
    if (STOR_LUOGHI.includes(v)) return v;
    if (luogoCosmico(v) && !STOR_PERSONAGGI[v]) { richiedi(!scena || scenaCosmica(scena), 'soloCosmo', { nome: v }); return v; }
    const altro = storCanonico(v.trim());
    richiedi(storOggettoNoto(altro), 'destinazioneIgnota', { nome: v });
    richiedi(altro !== id, 'versoSeStesso', { nome: v });
    richiedi(!sonoIdea(altro), 'ideaFerma', { nome: storNome(altro) });
    return altro;
  }
  const sonoIdea = id => !!(STOR_PERSONAGGI[id] && STOR_PERSONAGGI[id].cosmo === 'idea');
  // Un'azione del corpo si lega al personaggio quando c'è: il motore crea le
  // azioni nell'ordine in cui sono scritte, e `character_show` può venire dopo.
  function legaPersonaggio(id, fa) {
    let legato = null;
    return () => {
      const pg = stor.personaggi.get(id);
      if (pg && pg !== legato) { legato = pg; fa(pg); }
      return legato;
    };
  }
  Object.assign(COMANDI, {
    character_move: {
      verifica(p, scena) {
        campi(p, ['target', 'to', 'side', 'distance', 'path', 'turns', 'sound']);
        const id = bersaglio(p);
        sceltaSuono(p);
        richiedi(!sonoIdea(id), 'ideaFerma', { nome: storNome(id) });
        verso(p, id, scena);
        scelta(p.side, 'side', STOR_LATI); scelta(p.path, 'path', STOR_PERCORSI);
        numeroIn(p.distance, 'distance', 0.3, 6); numeroIn(p.turns, 'turns', 0.5, 8);
        inScena(p, scena); soloIn3d(scena, 'character_move');
      },
      crea(p) {
        const id = storCanonico(p.target);
        const moto = { verso: verso(p, id), lato: p.side || 'auto', distanza: p.distance || 1,
          percorso: p.path || 'arc', giri: p.turns || 0, u: 0, A: null, lampi: 0 };
        const lega = legaPersonaggio(id, pg => { moto.A = null; pg.moto = moto; });
        lega();
        const rumore = suonoScelto(p, STOR_SUONO_PERCORSO[moto.percorso]);
        let suonato = false;
        return {
          aggiorna(u) {
            if (!lega()) return;
            moto.u = stor.ridotto ? (u > 0 ? 1 : 0) : u;
            if (!suonato && u > 0 && u < 1) { suonato = true; if (rumore) storSuona(rumore, { seme: id }); }
            // Il teletrasporto: una nuvola di scintille dove sparisce e una
            // dove ricompare
            if (moto.percorso === 'teleport' && !stor.ridotto) {
              if (moto.lampi === 0 && u > 0) { moto.lampi = 1; storEffetto('sparkles', { target: id, durata: 900 }); }
              if (moto.lampi === 1 && u >= 0.5) { moto.lampi = 2; storEffetto('sparkles', { target: id, durata: 1100 }); }
            }
          }
        };
      }
    },
    character_return: {
      verifica(p, scena) {
        campi(p, ['target', 'path', 'sound']); bersaglio(p); scelta(p.path, 'path', STOR_PERCORSI); sceltaSuono(p);
        inScena(p, scena); soloIn3d(scena, 'character_return');
      },
      crea(p) {
        return COMANDI.character_move.crea({ target: p.target, to: 'orbit', path: p.path || 'arc', sound: p.sound });
      }
    },
    // Diventa un'altra cosa, col suo volto (v414): il Sole che si gonfia in
    // una gigante rossa e poi resta una nana bianca. La veste arriva con un
    // lampo di scintille e la «molla» del volto; la misura nuova ci arriva per
    // tutta la ripresa. Resta, come un viaggio, finché il personaggio è in
    // scena o finché `shape: self` non lo rimette com'era.
    character_become: {
      verifica(p, scena) {
        campi(p, ['target', 'shape', 'sound']); bersaglio(p); sceltaSuono(p);
        richiedi(p.shape !== undefined, 'valoreIgnoto', { campo: 'shape', nome: '', elenco: Object.keys(STOR_VESTI).join(', ') });
        scelta(p.shape, 'shape', Object.keys(STOR_VESTI));
        inScena(p, scena);
      },
      crea(p) {
        const id = storCanonico(p.target);
        const v = { forma: p.shape, u: 0, kDa: 1 };
        const lega = legaPersonaggio(id, pg => {
          v.kDa = storVesteK(pg);
          pg.veste = v;
          pg.cambioDa = stor.orologio;
          if (!stor.ridotto) storEffetto('sparkles', { target: id, durata: 1100 });
          const rumore = suonoScelto(p, STOR_SUONO_VESTE[p.shape]);
          if (rumore) storSuona(rumore, { seme: id });
          // Una stella che esplode fa tremare il quadro anche senza `effect`
          if (p.shape === 'supernova') storScossa(1.1, 900);
        });
        lega();
        return {
          aggiorna(u) {
            const pg = lega();
            if (!pg) return;
            v.u = stor.ridotto ? 1 : u;
            // tornato com'era: niente più veste
            if (v.forma === 'self' && v.u >= 1 && pg.veste === v) pg.veste = null;
          }
        };
      }
    },
    character_animate: {
      verifica(p, scena) {
        campi(p, ['target', 'animation', 'times', 'strength', 'sound']); bersaglio(p); sceltaSuono(p);
        richiedi(p.animation !== undefined, 'valoreIgnoto', { campo: 'animation', nome: '', elenco: STOR_ANIMAZIONI.join(', ') });
        scelta(p.animation, 'animation', STOR_ANIMAZIONI);
        numeroIn(p.times, 'times', 1, 20); numeroIn(p.strength, 'strength', 0.2, 3);
        inScena(p, scena);
      },
      crea(p) {
        const id = storCanonico(p.target);
        const anim = { tipo: p.animation, u: 0, volte: p.times || 0, forza: p.strength === undefined ? 1 : p.strength };
        const lega = legaPersonaggio(id, pg => pg.animazioni.push(anim));
        lega();
        const rumore = suonoScelto(p, STOR_SUONO_ANIMAZIONE[p.animation]);
        let suonato = false;
        return {
          aggiorna(u) {
            if (!lega()) return;
            anim.u = u;
            if (!suonato && u > 0 && u < 1) { suonato = true; if (rumore) storSuona(rumore, { seme: id }); }
          },
          chiudi() { const pg = stor.personaggi.get(id); if (pg) pg.animazioni = pg.animazioni.filter(a => a !== anim); }
        };
      }
    },
    character_scale: {
      verifica(p, scena) {
        campi(p, ['target', 'scale']); bersaglio(p);
        richiedi(p.scale !== undefined, 'numeroFuori', { campo: 'scale', min: 0.2, max: 6 });
        numeroIn(p.scale, 'scale', 0.2, 6);
        inScena(p, scena);
      },
      crea(p) {
        const id = storCanonico(p.target);
        const s = { da: 1, a: p.scale, u: 0 };
        const lega = legaPersonaggio(id, pg => { s.da = storScalaDi(pg); pg.scalaVoluta = s; });
        lega();
        return { aggiorna(u) { if (lega()) s.u = u; } };
      }
    },
    effect: {
      verifica(p, scena) {
        campi(p, ['type', 'target', 'at', 'size', 'color', 'duration', 'sound']);
        sceltaSuono(p);
        richiedi(p.type !== undefined, 'valoreIgnoto', { campo: 'type', nome: '', elenco: Object.keys(STOR_EFFETTI).join(', ') });
        scelta(p.type, 'type', Object.keys(STOR_EFFETTI));
        if (p.target !== undefined && luogoCosmico(p.target) && !STOR_PERSONAGGI[p.target])
          richiedi(!scena || scenaCosmica(scena), 'soloCosmo', { nome: p.target });
        else if (p.target !== undefined) {
          const id = bersaglio(p);
          if (scena && STOR_PERSONAGGI[id] && STOR_PERSONAGGI[id].cosmo) richiedi(scenaCosmica(scena), 'soloCosmo', { nome: storNome(id) });
        }
        scelta(p.at, 'at', STOR_POSTI_EFFETTO);
        numeroIn(p.size, 'size', 0.2, 5); numeroIn(p.duration, 'duration', 0.3, 20);
        richiedi(p.color === undefined || (typeof p.color === 'string' && /^#[0-9a-f]{6}$/i.test(p.color)), 'coloreNonValido', { nome: String(p.color) });
        if (scena) richiedi(VISTE_PERSONAGGI.includes(scena.vista), 'personaggioVista');
      },
      crea(p) {
        // Un effetto vive il suo tempo anche se la scena finisce prima: un
        // botto in coda a una scena non si taglia a metà. Uno Stop o la fine
        // della storia li tolgono tutti (`storSgombra`).
        if (stor.anteprima) storChiudiAnteprima();
        const ef = storEffetto(p.type, { target: p.target, dove: p.at, scala: p.size, colore: p.color,
          durata: p.duration ? p.duration * 1000 : undefined });
        // Il botto si sente: il rumore dello stesso nome, o quello scelto
        const rumore = suonoScelto(p, p.type);
        if (rumore) storSuona(rumore, { seme: p.type + (p.target || ''), volume: ef ? Math.min(1.4, 0.75 + 0.25 * ef.scala) : 1 });
        return {};
      }
    }
  });

  // La regia di una scena (§7-ter): `auto` (di serie) va da chi parla e dai
  // botti, `wide` tiene la camera della scena, `close` resta su un
  // personaggio; dalla v431 `speaker` sta sempre stretto su chi parla e
  // `orbit` gira attorno a un personaggio (o a chi parla), a `speed` gradi
  // al secondo (negativo: nell'altro verso)
  const STOR_MODI_REGIA = ['auto', 'wide', 'close', 'speaker', 'orbit'];
  Object.assign(COMANDI, {
    story_camera: {
      verifica(p, scena) {
        campi(p, ['mode', 'target', 'zoom', 'speed']);
        richiedi(p.mode !== undefined, 'valoreIgnoto', { campo: 'mode', nome: '', elenco: STOR_MODI_REGIA.join(', ') });
        scelta(p.mode, 'mode', STOR_MODI_REGIA);
        numeroIn(p.zoom, 'zoom', 1, 4);
        numeroIn(p.speed, 'speed', -90, 90);
        if (p.mode === 'close') { richiedi(p.target !== undefined, 'personaggioIgnoto', { nome: '' }); inScena(p, scena); }
        else if (p.mode === 'orbit' && p.target !== undefined) inScena(p, scena);
        else if (p.target !== undefined) bersaglio(p);
        if (scena) richiedi(VISTE_PERSONAGGI.includes(scena.vista), 'personaggioVista');
      },
      crea(p) {
        const r = stor.regia;
        r.modo = p.mode; r.chi = p.target ? storCanonico(p.target) : null; r.zoomMax = p.zoom || null;
        r.velGiro = p.speed !== undefined ? p.speed : STOR_REGIA.giroVel;
        return { chiudi() {
          r.modo = 'auto'; r.chi = null; r.zoomMax = null; r.velGiro = STOR_REGIA.giroVel;
          // Il giro finisce col taglio di scena: la scena dopo riparte dritta
          r.giro = 0; r.vGiro = 0; r.ultimoGiro = null;
        } };
      }
    },
    sound: {
      verifica(p, scena) {
        campi(p, ['type', 'volume']);
        richiedi(p.type !== undefined, 'valoreIgnoto', { campo: 'type', nome: '', elenco: STOR_SUONI.join(', ') });
        scelta(p.type, 'type', STOR_SUONI);
        numeroIn(p.volume, 'volume', 0, 2);
      },
      crea(p) { storSuona(p.type, { volume: p.volume }); return {}; }
    }
  });
  function sceltaSuono(p) { return scelta(p.sound, 'sound', ['auto', 'off'].concat(STOR_SUONI)); }

  /* La domanda al pubblico (v430): il cartello che chiude un episodio con
   * una domanda vera, nata da quello che è successo — «Chi ha ragione?»,
   * «Dove dovrebbe andare la sonda?», una scelta fra A e B, una previsione.
   * La scrive lo Studio (`studioDomandaFinale`) o chi scrive il copione; qui
   * c'è solo il cartello, che resta per tutta la scena e se ne va con lei.
   * Il personaggio che la pone la dice con `character_speak` nella stessa
   * scena. `kind` dice il tipo (serve al disegno: la sonda ha la parabola,
   * la fiducia un cuore) e le scelte `a` e `b` sono facoltative: una
   * previsione può restare aperta. */
  const STOR_TIPI_DOMANDA = ['who_is_right', 'probe', 'trust', 'explore', 'choice', 'prediction', 'next_star'];
  const STOR_DOMANDA_MAX = 200, STOR_SCELTA_MAX = 60;
  Object.assign(COMANDI, {
    story_question: {
      verifica(p) {
        campi(p, ['text', 'a', 'b', 'kind', 'from']);
        richiedi(typeof p.text === 'string' && p.text.trim(), 'domandaVuota');
        richiedi(p.text.length <= STOR_DOMANDA_MAX, 'domandaLunga', { campo: 'text', max: STOR_DOMANDA_MAX });
        for (const c of ['a', 'b']) {
          richiedi(p[c] === undefined || typeof p[c] === 'string', 'valoreIgnoto', { campo: c, nome: String(p[c]), elenco: '' });
          richiedi(p[c] === undefined || p[c].length <= STOR_SCELTA_MAX, 'domandaLunga', { campo: c, max: STOR_SCELTA_MAX });
        }
        scelta(p.kind, 'kind', STOR_TIPI_DOMANDA);
        if (p.from !== undefined) bersaglio({ target: p.from });
      },
      crea(p) {
        if (stor.anteprima) storChiudiAnteprima();
        const d = { testo: p.text.trim(), a: (p.a || '').trim(), b: (p.b || '').trim(), tipo: p.kind || 'choice',
          chi: p.from ? storCanonico(p.from) : null, da: adesso() };
        stor.domanda = d;
        storSuona('ding', { seme: 'domanda' });
        return { chiudi() { if (stor.domanda === d) stor.domanda = null; } };
      }
    }
  });

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
    storMostra(target, { espressione: espressioneScelta || undefined, misura: 'costume' });
    const passo = () => {
      const a = stor.anteprima;
      if (!a || a.tela !== tela) return;
      if (radice.AstroDemo && radice.AstroDemo.inCorso) { storChiudiAnteprima(); return; }
      const dpr = Math.max(1, Math.min(2, radice.devicePixelRatio || 1));
      const w = tela.clientWidth || 300, h = tela.clientHeight || 180;
      if (tela.width !== Math.round(w * dpr)) { tela.width = Math.round(w * dpr); tela.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      storPalco(ctx, w, h, stor.orologio);
      // il personaggio col suo corpo, lo stesso che avrà nel cielo
      const p = storProfilo(a.target);
      const r = Math.min(w, h) * 0.4 / Math.max(1, ingombroDi(p) * 0.8);
      storDisegnaPersonaggi(ctx, 'anteprima', [{ id: a.target, px: w / 2, py: h / 2 + (p.sagoma === 'voyager' ? r * 0.12 : 0), r: 1, costumeR: r }],
        w, h, { su: 0, giu: 0, lati: 0 });
      a.raf = radice.requestAnimationFrame(passo);
    };
    passo();
    return stor.anteprima;
  }
  // Il palco dell'anteprima e dei ritratti: un cielo d'inchiostro con
  // qualche stella che pulsa
  function storPalco(ctx, w, h, t) {
    const fondo = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    fondo.addColorStop(0, '#2a1f55'); fondo.addColorStop(1, '#0d0a1f');
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, w, h);
    const st = { s: 7 };
    const n = Math.max(6, Math.round(w * h / 2000));
    for (let k = 0; k < n; k++) {
      const x = dado(st) * w, y = dado(st) * h, q = 0.6 + dado(st) * 1.2;
      ctx.fillStyle = `rgba(255, 246, 220, ${0.35 + 0.4 * Math.abs(Math.sin(t / 700 + k))})`;
      ctx.beginPath(); ctx.arc(x, y, q, 0, Math.PI * 2); ctx.fill();
    }
  }
  /* Un ritratto fermo: il personaggio col suo corpo e un'espressione, su
   * una tela piccola (le figurine dello Studio). Si dipinge una volta sola,
   * senza toccare i personaggi in scena: lo stato è uno di passaggio. */
  function storRitratto(tela, target, espressioneScelta, opz = {}) {
    const ctx = tela && tela.getContext && tela.getContext('2d');
    if (!ctx) return false;
    const dpr = Math.max(1, Math.min(2, radice.devicePixelRatio || 1));
    const w = opz.larghezza || tela.clientWidth || 64, h = opz.altezza || tela.clientHeight || 64;
    tela.width = Math.round(w * dpr); tela.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (opz.palco !== false) storPalco(ctx, w, h, 0);
    const id = storCanonico(target);
    const profilo = storProfilo(id);
    const nome = STOR_ESPRESSIONI[espressioneScelta] ? espressioneScelta : profilo.espressione;
    const pg = nuovoStato(id, profilo, { espressione: nome, misura: 'costume' });
    pg.espr = parametriEspressione(nome);
    const r = Math.min(w, h) * (opz.misura || 0.36) / Math.max(1, ingombroDi(opz.fisica === false ? profilo.sagoma : profilo) * 0.75);
    const x = w / 2, y = h / 2 + (profilo.sagoma === 'voyager' ? r * 0.15 : 0);
    const sulCorpo = storVoltoNelCorpo(profilo.sagoma, x, y, r);
    const geom = storGeometria(sulCorpo.cx, sulCorpo.cy, sulCorpo.R, profilo, {
      espr: pg.espr, sguardo: { x: 0, y: 0 }, battito: 0, bocca: Object.assign({}, STOR_BOCCHE[pg.espr.bocca] || STOR_BOCCHE.chiusa)
    });
    ctx.save();
    // La fisica (v430): l'atmosfera, gli anelli sottili, le lune ferme al
    // loro posto di partenza. È ciò che fa riconoscere una figurina piccola:
    // Urano col suo anello in piedi, Marte coi due sassolini, Plutone e Caronte
    const fis = opz.fisica === false ? null : storFisica(profilo);
    const re = fis ? storReazioneFisica(fis, nome, 0) : null;
    if (fis) storDisegnaFisica(ctx, 'dietro', x, y, r, fis, re, 0, { ridotto: true, tempoLune: 0 });
    disegnaCorpo(ctx, x, y, r, re ? Object.assign({}, profilo, { reazione: re }) : profilo, 0);
    if (fis) storDisegnaFisica(ctx, 'davanti', x, y, r, fis, re, 0, { ridotto: true, tempoLune: 0 });
    storDisegnaVolto(ctx, geom, profilo, 1, 0);
    ctx.restore();
    return true;
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
        // v430: perché è fatto così, la fisica sotto al carattere
        const tratto = storTratto(p);
        if (tratto) { const sm = document.createElement('small'); sm.className = 'storia-tratto'; sm.textContent = ' ' + tratto; li.append(sm); }
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
        // L'editor sta nella linguetta Demo (v409): prima si passa di là
        if (typeof radice.demoMostraScheda === 'function') radice.demoMostraScheda('demo-scheda-demo');
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
    STOR_VOLTO_MIN_PX, STOR_PERCORSI, STOR_LATI, STOR_LUOGHI, STOR_ANIMAZIONI, STOR_EFFETTI, STOR_POSTI_EFFETTO,
    canonico: storCanonico, famigliaDi: storFamigliaDi, noto: storOggettoNoto, profilo: storProfilo,
    nome: storNome, personalita: storPersonalita,
    ritmo: storRitmo, formaAlTempo: storFormaAlTempo, boccaDaSegnale: storBoccaDaSegnale, boccaBersaglio: storBoccaBersaglio,
    tempoDelCarattere: storTempoDelCarattere,
    geometria: storGeometria, posa: storPosa, pupillaDentro: storPupillaDentro, chiusuraBattito: storChiusuraBattito,
    sguardoVerso: storSguardoVerso, parametriEspressione,
    mostra: storMostra, espressione: storEspressione, guarda: storGuarda, batti: storBatti,
    nascondi: storNascondi, congeda: storCongeda, sgombra: storSgombra, parla: storParla,
    disegnaPersonaggi: storDisegnaPersonaggi, disegnaCielo: storDisegnaCielo, disegnaSistema: storDisegnaSistema,
    comandi: COMANDI, registraComandi,
    disegnaCosmo: storDisegnaCosmo, puntoCosmo: storPuntoCosmo, scarto2D: storScarto2D, STOR_LUOGHI_COSMO,
    scena3D: storScena3D, raggio3D: storRaggio3D, assiSchermo: storAssiSchermo, puntoViaggio: storPuntoViaggio,
    animazioneAl: storAnimazioneAl, effetto: storEffetto, disegnaEffetto: storDisegnaEffetto,
    anteprima: storAnteprima, chiudiAnteprima: storChiudiAnteprima, provaVoce: storProvaVoce, ritratto: storRitratto,
    voltoNelCorpo: storVoltoNelCorpo, aperturaOcchio: storAperturaOcchio, STOR_SAGOME, STOR_CORPI,
    STOR_VESTI, vesteProfilo: storVesteProfilo, scalaDi: storScalaDi, disegnaCorpo, disegnaVolto: storDisegnaVolto, disegnaSegno: storDisegnaSegno,
    riempiPagina: storRiempiPagina, storie: storieDisponibili,
    STOR_FISICA, STOR_FISICA_FAMIGLIE, STOR_FISICA_EMOZIONI, STOR_TIPI_DOMANDA,
    fisica: storFisica, reazioneFisica: storReazioneFisica, postiLune: storPostiLune, tratto: storTratto,
    disegnaFisica: storDisegnaFisica, lunaReagisce: storLunaReagisce, padreDi: storPadreDi,
    get domanda() { return stor.domanda ? Object.assign({}, stor.domanda) : null; },
    stato: stor,
    STOR_REGIA, STOR_SUONI, regiaInquadra: storRegiaInquadra, regiaGruppo: storRegiaGruppo, regiaGiro: storRegiaGiro, posaSullaSfera: storPosaSullaSfera, lenteApri: storLenteApri, lenteChiudi: storLenteChiudi,
    lenteSchermo: storLenteSchermo, cartelloLuogo: storDisegnaCartelloLuogo, scossa: storScossa, suona: storSuona, zittisci: storZittisci, RICETTE_SUONI: RICETTE,
    get regia() { const r = stor.regia; return { modo: r.modo, chi: r.chi, k: r.k, tx: r.tx, ty: r.ty, motivo: r.motivo, vista: r.vista }; },
    get attivi() { return stor.personaggi.size; },
    get disegnati() { return stor.ultimiDisegnati.map(d => Object.assign({}, d, { geom: undefined })); },
    get parlante() { return stor.parlante ? stor.parlante.target : null; },
    get effetti() { return stor.effetti.map(e => ({ tipo: e.tipo, target: e.target, dove: e.dove })); }
  };
  radice.storRicevuta = storRicevuta;
  radice.storDisegnaCielo = storDisegnaCielo;
  radice.storDisegnaSistema = storDisegnaSistema;
  radice.storScena3D = storScena3D;
  radice.storDisegnaCosmo = storDisegnaCosmo;
  radice.storRaggio3D = storRaggio3D;
  radice.storLenteApri = storLenteApri;
  radice.storLenteChiudi = storLenteChiudi;
  radice.storRegiaGiro = storRegiaGiro;
  radice.storDisegnaCartelloLuogo = storDisegnaCartelloLuogo;
  radice.storLenteK = () => stor.regia.aperta ? stor.regia.k : 1;
  // La lente dell'ultimo fotogramma, per la parallasse del cielo delle
  // CosmoStorie (`solSfondoStoria`, app.js), che si stende prima di aprirla
  radice.storLenteStato = () => ({ k: stor.regia.k || 1, tx: stor.regia.tx || 0, ty: stor.regia.ty || 0 });
  // È in scena in questo momento? (la 3D disegna una sonda o un mondo minore
  // spenti, se sono personaggi)
  radice.storInScena = id => stor.personaggi.size > 0 && stor.personaggi.has(storCanonico(id));
  radice.StorieCosmiche = api;
  registraComandi();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
