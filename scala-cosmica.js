/* =====================================================================
 * scala-cosmica.js — Oltre i pianeti: la scala cosmica
 * =====================================================================
 *
 * La vista 3D del Sistema Solare finisce a Kuiper, e le due Voyager sono
 * già tre volte più in là. Questo file è il quarto quadro di quella
 * finestra («Scala cosmica»): una scena che si allarga a passi di
 * **logaritmo**, dal Sistema Solare fino al bordo dell'universo
 * osservabile, con dentro undici strutture vere e le due sonde al loro
 * posto di oggi. Si apre vista dall'alto e si gira col dito come la vista
 * 3D (v401: `cosm.az`, `cosm.elev`), e ci si arriva anche solo
 * allontanandosi dal Sistema Solare con lo zoom (`solZoomVersoIlCosmo` in
 * app.js). Dalla v404 la scala comincia **dalla Terra** — la Terra, la Luna,
 * i pianeti di roccia, il Sistema Solare, alla loro misura vera — e in fondo,
 * avvicinandosi alla Terra finché riempie lo schermo, si atterra nel
 * planetario: dal cielo di casa all'universo osservabile è una carta sola.
 *
 * La domanda a cui risponde è una sola, e si sbaglia facilmente: *quanto
 * sono lontane le Voyager?* Lontanissime, per noi — più di un giorno luce
 * fra poco — e niente per la Galassia. Il disegno deve dire tutt'e due le
 * cose senza mentire su nessuna, e per questo tre regole:
 *
 *   1. **Le misure sono vere**: ogni struttura ha la sua misura pubblicata,
 *      e la distanza delle sonde è quella del modello di `app.js`
 *      (`solPuntoVoyager`: le coniche del Grand Tour fino al 2026, poi la
 *      retta di `SOL_SONDE`). Le dichiarazioni incerte lo dicono (la nube di
 *      Oort non è mai stata osservata; la coda dell'eliosfera ha una forma
 *      discussa; i punti delle galassie lontane sono illustrativi).
 *   2. **Le direzioni sono proiezioni oneste**: la carta è la vista dall'alto
 *      su un piano, e il piano cambia con la scala — quello dei pianeti
 *      vicino al Sole, quello della Galassia fino al Gruppo Locale, quello
 *      supergalattico oltre — perché ognuno è il piano in cui *quella*
 *      struttura è piatta. Il cambio è graduale (le posizioni si mescolano
 *      in qualche decimo di decade) e la didascalia in alto dice sempre su
 *      quale piano si sta guardando.
 *   3. **Le Voyager stanno dove sono oggi**, e basta: niente scie né futuro
 *      (v401), e il loro nome si scrive solo alla scala dell'eliosfera.
 *
 * Il disegno sta sulla stessa tela della vista 3D (`sol.ctx`): così la
 * registrazione di un momento e la vista pulita delle demo funzionano senza
 * saperne niente. Il ciclo di disegno resta quello di `solCiclo`, e da
 * `solDisegna` si arriva qui con un `typeof` (la regola dei moduli di questa
 * applicazione: senza questo file, la 3D resta quella di prima).
 *
 * Prefisso `cosm`. Prove in `scripts/prova-scala-cosmica.js`.
 * ===================================================================== */

// =====================================================================
// 1. Unità e piani
// =====================================================================

const COSM_D2R = Math.PI / 180;
// Unità astronomiche in un anno luce, e secondi di luce in un'unità
// astronomica: le due conversioni da cui escono tutte le altre
const COSM_UA_AL = 63241.077;
const COSM_LUCE_S_UA = 499.004784;
const COSM_KM_UA = 149597870.7;
const COSM_ANNO_MS = 365.25 * 86400000;
const COSM_EPSILON = 23.4392911 * COSM_D2R;

// Dall'equatore J2000 alle coordinate galattiche (la matrice IAU, righe =
// gli assi galattici: verso il centro, verso l = 90°, verso il polo nord)
const COSM_EQ_GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.4448296300, 0.7469822445],
  [-0.8676661490, -0.1980763734, 0.4559837762]
];

function cosmVettore(x, y, z) { return { x, y, z }; }

function cosmEqAGal(v) {
  const m = COSM_EQ_GAL;
  return cosmVettore(
    m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z,
    m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z,
    m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z);
}
function cosmGalAEq(v) {
  const m = COSM_EQ_GAL;
  return cosmVettore(
    m[0][0] * v.x + m[1][0] * v.y + m[2][0] * v.z,
    m[0][1] * v.x + m[1][1] * v.y + m[2][1] * v.z,
    m[0][2] * v.x + m[1][2] * v.y + m[2][2] * v.z);
}
// Eclittica J2000 → equatore J2000: una rotazione attorno all'asse x
function cosmEclAGal(v) {
  const c = Math.cos(COSM_EPSILON), s = Math.sin(COSM_EPSILON);
  return cosmEqAGal(cosmVettore(v.x, v.y * c - v.z * s, v.y * s + v.z * c));
}
function cosmGalAEcl(v) {
  const e = cosmGalAEq(v);
  const c = Math.cos(COSM_EPSILON), s = Math.sin(COSM_EPSILON);
  return cosmVettore(e.x, e.y * c + e.z * s, -e.y * s + e.z * c);
}
function cosmDaSferiche(lonGradi, latGradi, d) {
  const lo = lonGradi * COSM_D2R, la = latGradi * COSM_D2R;
  return cosmVettore(d * Math.cos(la) * Math.cos(lo), d * Math.cos(la) * Math.sin(lo), d * Math.sin(la));
}
// Un oggetto di catalogo: ascensione retta e declinazione J2000, distanza in
// unità astronomiche → vettore galattico
function cosmDaRaDec(ra, dec, ua) { return cosmEqAGal(cosmDaSferiche(ra, dec, ua)); }
function cosmDaGal(l, b, ua) { return cosmDaSferiche(l, b, ua); }
function cosmDaEcl(lon, lat, ua) { return cosmEclAGal(cosmDaSferiche(lon, lat, ua)); }

// Gli assi del piano supergalattico (de Vaucouleurs): l'origine delle
// longitudini sta a l = 137,37°, il polo a l = 47,37°, b = 6,32°. Il terzo
// asse è il prodotto vettoriale dei due.
const COSM_SG_X = cosmDaGal(137.37, 0, 1);
const COSM_SG_Z = cosmDaGal(47.37, 6.32, 1);
const COSM_SG_Y = cosmVettore(
  COSM_SG_Z.y * COSM_SG_X.z - COSM_SG_Z.z * COSM_SG_X.y,
  COSM_SG_Z.z * COSM_SG_X.x - COSM_SG_Z.x * COSM_SG_X.z,
  COSM_SG_Z.x * COSM_SG_X.y - COSM_SG_Z.y * COSM_SG_X.x);
const cosmScalare = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

/* I quattro piani della carta, e quando si passa dall'uno all'altro.
 *
 * Fino a Kuiper si guarda il piano dei pianeti dal nord dell'eclittica: le
 * orbite sono cerchi. Appena oltre si passa al **piano delle due Voyager**,
 * quello che contiene le direzioni in cui fuggono: una sale di trentacinque
 * gradi sopra l'eclittica e l'altra scende di quarantotto, quindi viste
 * dall'alto sui pianeti le loro distanze sarebbero accorciate di un quarto
 * e di un terzo, e la Voyager 1 di oggi sembrerebbe ancora dentro
 * all'eliopausa che ha attraversato nel 2012. Su quel piano invece le due
 * distanze sono vere, e gli attraversamenti cadono sul bordo che hanno
 * attraversato. Dalla nube di Oort in là il piano giusto è quello della
 * Galassia (visto dal suo polo nord, col centro in alto): è lì che il
 * braccio di Orione e i bracci a spirale sono piatti. Oltre il Gruppo
 * Locale si passa al piano supergalattico, dove stanno l'Ammasso della
 * Vergine e il Grande Attrattore — nel piano galattico la Vergine, alta
 * settantaquattro gradi, cadrebbe quasi addosso a noi.
 *
 * I passaggi avvengono dove la struttura che sta cambiando piano è o una
 * sfera (la nube di Oort) o più piccola di qualche pixel (la Via Lattea
 * vista dal Superammasso): il giro non si vede quasi. */
// I passaggi sono larghi quasi mezza decade (v404): con un passaggio stretto
// lo zoom di una rotellina girava la carta di scatto, e un giro della carta
// che si vede accadere sotto le dita si legge come un errore
const COSM_PIANO_SONDE = [1.9, 2.32];
const COSM_PIANO_GAL = [4.35, 5.35];
const COSM_PIANO_SG = [11.9, 12.8];

function cosmLiscia(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Da un vettore galattico (in UA) al punto sulla carta, coi pesi dei tre
// piani per il logaritmo della scala `L`
function cosmPesiPiano(L) {
  return {
    sonde: cosmLiscia(COSM_PIANO_SONDE[0], COSM_PIANO_SONDE[1], L),
    gal: cosmLiscia(COSM_PIANO_GAL[0], COSM_PIANO_GAL[1], L),
    sg: cosmLiscia(COSM_PIANO_SG[0], COSM_PIANO_SG[1], L)
  };
}

// Il piano delle due sonde: la bisettrice delle due direzioni di fuga punta
// in basso sullo schermo, e la normale al piano verso chi guarda. Le
// direzioni sono gli asintoti di `SOL_SONDE` (app.js), con i numeri
// pubblicati come riserva.
let cosmAssiSonde = null;
function cosmPianoSonde() {
  if (cosmAssiSonde) return cosmAssiSonde;
  const tab = typeof SOL_SONDE !== 'undefined' ? SOL_SONDE : [{ lon: 255.9, lat: 34.9 }, { lon: 288.0, lat: -48.0 }];
  const a = cosmDaEcl(tab[0].lon, tab[0].lat, 1), b = cosmDaEcl(tab[1].lon, tab[1].lat, 1);
  const unit = v => { const l = Math.hypot(v.x, v.y, v.z) || 1; return cosmVettore(v.x / l, v.y / l, v.z / l); };
  const croce = (u, v) => cosmVettore(u.y * v.z - u.z * v.y, u.z * v.x - u.x * v.z, u.x * v.y - u.y * v.x);
  const bis = unit(cosmVettore(a.x + b.x, a.y + b.y, a.z + b.z));
  const n = unit(croce(a, b));
  const su = cosmVettore(-bis.x, -bis.y, -bis.z), destra = unit(croce(bis, n));
  cosmAssiSonde = { su, destra, normale: croce(destra, su) };
  return cosmAssiSonde;
}

// La terza coordinata è la normale al piano (verso chi guarda dall'alto):
// serve da quando la scena si gira col dito (v401). Ogni terna è destrorsa,
// quindi vista dall'alto la carta è identica a prima.
function cosmSullaCarta(v, pesi) {
  const e = cosmGalAEcl(v);
  let x = e.x, y = e.y, z = e.z;
  if (pesi.sonde > 0 && pesi.gal < 1) {
    const ps = cosmPianoSonde();
    x += (cosmScalare(v, ps.destra) - x) * pesi.sonde;
    y += (cosmScalare(v, ps.su) - y) * pesi.sonde;
    z += (cosmScalare(v, ps.normale) - z) * pesi.sonde;
  }
  // Galattico visto dal polo nord: il centro in alto, l = 90° a sinistra
  x += (-v.y - x) * pesi.gal;
  y += (v.x - y) * pesi.gal;
  z += (v.z - z) * pesi.gal;
  if (pesi.sg > 0) {
    x += (cosmScalare(v, COSM_SG_X) - x) * pesi.sg;
    y += (cosmScalare(v, COSM_SG_Y) - y) * pesi.sg;
    z += (cosmScalare(v, COSM_SG_Z) - z) * pesi.sg;
  }
  return { x, y, z };
}

// Dalla carta allo schermo con la camera di adesso: lo stesso giro della
// vista 3D (`solProietta` in app.js) — `az` gira attorno alla normale,
// `elev` è l'altezza dell'occhio sul piano (90° = a picco, com'era prima)
function cosmRuota(q) {
  const a = cosm.az || 0, e = (cosm.elev == null ? 90 : cosm.elev) * COSM_D2R;
  const xr = q.x * Math.cos(a) - q.y * Math.sin(a);
  const yr = q.x * Math.sin(a) + q.y * Math.cos(a);
  return { x: xr, y: yr * Math.sin(e) + (q.z || 0) * Math.cos(e) };
}

// =====================================================================
// 2. Il catalogo: le strutture e i segni
// =====================================================================

const COSM_AL = COSM_UA_AL;
const COSM_MAL = 1e6 * COSM_UA_AL;
const COSM_GAL = 1e9 * COSM_UA_AL;

// Il centro galattico: 26.000 anni luce verso il Sagittario
const COSM_CENTRO_GAL = cosmDaGal(0, 0, 26000 * COSM_AL);
// Andromeda e il baricentro del Gruppo Locale (le due galassie maggiori
// hanno masse confrontabili: il baricentro sta poco meno che a metà strada)
const COSM_M31 = cosmDaRaDec(10.6847, 41.2690, 2.54 * COSM_MAL);
const COSM_BARICENTRO_LG = cosmVettore(COSM_M31.x * 0.45, COSM_M31.y * 0.45, COSM_M31.z * 0.45);
const COSM_VERGINE = cosmDaRaDec(187.7059, 12.3911, 54 * COSM_MAL);
const COSM_GRANDE_ATTRATTORE = cosmDaGal(325.3, -7.3, 250 * COSM_MAL);
// La direzione da cui arriva il vento interstellare: è il naso
// dell'eliosfera (λ = 255,7°, β = 5,1° in eclittica)
const COSM_NASO = cosmDaEcl(255.7, 5.1, 1);
// La Nube Interstellare Locale: una trentina di anni luce, e il Sole vicino
// al suo bordo (la direzione del centro è indicativa)
const COSM_CENTRO_LIC = cosmDaGal(135, 6, 11 * COSM_AL);
const COSM_CENTRO_BOLLA = cosmDaGal(200, 10, 80 * COSM_AL);

// Le misure del Sistema Solare vicino, in UA: la scala comincia dalla Terra
// (v404) e i corpi lì si disegnano alla loro misura vera
const COSM_TERRA_R_UA = 6371.0 / COSM_KM_UA;
const COSM_LUNA_R_UA = 1737.4 / COSM_KM_UA;
const COSM_LUNA_ORBITA_UA = 384400 / COSM_KM_UA;
const COSM_SOLE_R_UA = 695700 / COSM_KM_UA;

/* Le quindici tappe. Per ognuna: `r` il raggio (in UA) a cui si
 * inquadra e da cui si giudica se è in vista, `centro` (vettore galattico,
 * o null per il Sole), `inquadra` quanta vista attorno a lei serve, e `id`
 * esterno per le demo (`cosmic_scale { to: 'oort' }`). Le misure scritte
 * nelle schede vengono dal dizionario: qui ci sono solo i numeri da cui si
 * disegna.
 *
 * Le prime quattro (v404) sono la scala **sotto** Kuiper: la Terra, la Terra
 * con la Luna, i pianeti di roccia, il Sistema Solare fino a Nettuno. Prima la
 * carta cominciava a Kuiper e sotto si tornava alla vista 3D, che ha un altro
 * metro (distanze compresse, corpi ingranditi): il passaggio era un cambio di
 * disegno nel mezzo di uno zoom. Adesso la scala è una sola, dalla Terra
 * all'universo, e in fondo — avvicinandosi alla Terra finché riempie lo
 * schermo — si atterra nel planetario. La Terra non sta ferma: il suo centro
 * è `terra` (`cosmCentroDi`), riletto all'istante della carta. */
const COSM_STRUTTURE = [
  { id: 'terra', demo: 'earth', r: COSM_TERRA_R_UA, vista: COSM_TERRA_R_UA * 2.3, centroDi: 'terra', vicino: true },
  { id: 'terraLuna', demo: 'earth_moon', r: COSM_LUNA_ORBITA_UA, vista: COSM_LUNA_ORBITA_UA * 1.32, centroDi: 'terra', vicino: true },
  { id: 'pianetiInterni', demo: 'inner_planets', r: 1.524, centro: null, vista: 1.95, raggio: true },
  { id: 'pianeti', demo: 'planets', r: 30.07, centro: null, vista: 37, raggio: true },
  { id: 'kuiper', demo: 'kuiper', r: 50, interno: 30, centro: null, vista: 64, raggio: true },
  { id: 'eliopausa', demo: 'heliopause', r: 121.6, centro: null, vista: 230, raggio: true },
  { id: 'oort', demo: 'oort', r: 100000, interno: 1000, centro: null, vista: 128000, raggio: true },
  { id: 'mezzoLocale', demo: 'local_cloud', r: 13 * COSM_AL, centro: COSM_CENTRO_LIC, vista: 28 * COSM_AL,
    ancora: cosmVettore(COSM_CENTRO_LIC.x / 2, COSM_CENTRO_LIC.y / 2, COSM_CENTRO_LIC.z / 2) },
  { id: 'bollaLocale', demo: 'local_bubble', r: 500 * COSM_AL, centro: COSM_CENTRO_BOLLA, vista: 700 * COSM_AL },
  { id: 'braccioOrione', demo: 'orion_arm', r: 5000 * COSM_AL, centro: cosmDaGal(80, 0, 900 * COSM_AL), vista: 6500 * COSM_AL },
  { id: 'viaLattea', demo: 'milky_way', r: 50000 * COSM_AL, centro: COSM_CENTRO_GAL, vista: 62000 * COSM_AL },
  { id: 'gruppoLocale', demo: 'local_group', r: 5 * COSM_MAL, centro: COSM_BARICENTRO_LG, vista: 6.2 * COSM_MAL },
  { id: 'vergine', demo: 'virgo', r: 55 * COSM_MAL, centro: COSM_VERGINE, vista: 72 * COSM_MAL, mai: true,
    ancora: cosmVettore(COSM_VERGINE.x * 0.6, COSM_VERGINE.y * 0.6, COSM_VERGINE.z * 0.6) },
  { id: 'laniakea', demo: 'laniakea', r: 260 * COSM_MAL, centro: COSM_GRANDE_ATTRATTORE, vista: 330 * COSM_MAL, mai: true,
    ancora: cosmVettore(COSM_GRANDE_ATTRATTORE.x * 0.6, COSM_GRANDE_ATTRATTORE.y * 0.6, COSM_GRANDE_ATTRATTORE.z * 0.6) },
  { id: 'universo', demo: 'universe', r: 46.5 * COSM_GAL, centro: null, vista: 56 * COSM_GAL, mai: true }
];
const COSM_PER_ID = new Map(COSM_STRUTTURE.map(s => [s.id, s]));

// I punti di riferimento con un nome: non sono strutture, sono i paletti
// che fanno capire dove si è
const COSM_SEGNI = [
  { id: 'alfaCen', v: cosmDaGal(315.73, -0.68, 4.37 * COSM_AL), colore: '#fde68a', minL: 5.4, maxL: 8.2, stella: true },
  { id: 'sirio', v: cosmDaGal(227.23, -8.89, 8.6 * COSM_AL), colore: '#bfdbfe', minL: 5.7, maxL: 8.0, stella: true },
  { id: 'gliese445', v: cosmDaRaDec(176.92, 78.69, 17.1 * COSM_AL), colore: '#fca5a5', minL: 5.9, maxL: 8.0, stella: true },
  { id: 'ross248', v: cosmDaRaDec(355.48, 44.17, 10.3 * COSM_AL), colore: '#fca5a5', minL: 5.8, maxL: 8.0, stella: true },
  { id: 'orione', v: cosmDaRaDec(83.82, -5.39, 1344 * COSM_AL), colore: '#f9a8d4', minL: 7.6, maxL: 9.4 },
  { id: 'centro', v: COSM_CENTRO_GAL, colore: '#fde68a', minL: 8.6, maxL: 10.6 },
  { id: 'gnm', v: cosmDaRaDec(80.89, -69.76, 160000 * COSM_AL), colore: '#c4b5fd', minL: 9.6, maxL: 11.5, galassia: 7000 * COSM_AL },
  { id: 'pnm', v: cosmDaRaDec(13.19, -72.83, 200000 * COSM_AL), colore: '#c4b5fd', minL: 9.6, maxL: 11.3, galassia: 3500 * COSM_AL },
  { id: 'm31', v: COSM_M31, colore: '#e9d5ff', minL: 10.6, maxL: 12.6, galassia: 76000 * COSM_AL, inclina: 0.42, gira: 38 },
  { id: 'm33', v: cosmDaRaDec(23.46, 30.66, 2.73 * COSM_MAL), colore: '#ddd6fe', minL: 10.8, maxL: 12.2, galassia: 30000 * COSM_AL, inclina: 0.7, gira: -20 },
  { id: 'ammassoVergine', v: COSM_VERGINE, colore: '#fde68a', minL: 12.0, maxL: 13.9 },
  { id: 'grandeAttrattore', v: COSM_GRANDE_ATTRATTORE, colore: '#fbbf24', minL: 12.8, maxL: 14.4 }
];

// Le tappe del viaggio delle due sonde: le passate hanno la data vera, le
// future la distanza (e l'anno esce dal modello). `ua` per le future, `ms`
// per le passate; `stella` per gli incontri che sono distanze minime da
// un'altra stella, e lì l'anno è quello pubblicato (non si muovono le stelle).
const COSM_TAPPE = [
  { id: 'shock', sonda: 'voyager1', ms: Date.UTC(2004, 11, 16) },
  { id: 'shock', sonda: 'voyager2', ms: Date.UTC(2007, 7, 30) },
  { id: 'eliopausa', sonda: 'voyager1', ms: Date.UTC(2012, 7, 25) },
  { id: 'eliopausa', sonda: 'voyager2', ms: Date.UTC(2018, 10, 5) },
  { id: 'giornoLuce', sonda: 'voyager1', ua: 86400 / COSM_LUCE_S_UA },
  { id: 'oortDentro', sonda: 'voyager1', ua: 1000 },
  { id: 'annoLuce', sonda: 'voyager1', ua: COSM_UA_AL },
  { id: 'oortFuori', sonda: 'voyager1', ua: 100000 },
  { id: 'gliese', sonda: 'voyager1', anni: 40000 },
  { id: 'ross', sonda: 'voyager2', anni: 40000 },
  { id: 'sirio', sonda: 'voyager2', anni: 296000 }
];

// La scala: logaritmo in base dieci di metà del lato corto, in UA. In fondo
// c'è la Terra che riempie lo schermo: lì, con lo zoom, si atterra nel
// planetario (`COSM_L_ATTERRA`, la stessa misura da cui parte il volo
// d'atterraggio di app.js: il raggio della Terra al 42% del lato corto).
const COSM_L_ATTERRA = Math.log10(COSM_TERRA_R_UA / 0.84);
const COSM_L_MIN = COSM_L_ATTERRA - 0.06;
const COSM_L_MAX = 15.85;
// Fino a qui la carta tiene la Terra al centro, da qui ai pianeti di roccia
// scivola sul Sole: allontanandosi dalla Terra la si deve vedere finché il
// Sole non entra nel quadro
const COSM_L_TERRA_FINO = -0.55;

// =====================================================================
// 3. Lo stato
// =====================================================================

const cosm = {
  attivo: false,
  L: 2.4, Lvoluto: 2.4,
  volo: null,             // { da, a, t0, durata, tappe } quando si vola fra due scale
  pan: { x: 0, y: 0 },    // spostamento a mano, in UA sul piano dello schermo
  az: 0, elev: 90,        // la camera (v401): giro attorno alla normale (rad), altezza sul piano (gradi)
  elevVoluta: 90, azVoluto: 0,
  anni: 0,                // quanto avanti nel futuro guardare le sonde
  baseMs: null,           // l'istante di partenza (null = l'orologio della 3D)
  scelta: null,           // la struttura o il segno della scheda aperta
  evidenza: null,         // una struttura da far risaltare (le demo)
  regia: false,           // una demo sta guidando la scala
  ultimoTs: 0,
  // Lo zoom attorno a un punto (v404): il punto della carta che sta sotto al
  // dito e il pixel dove deve restare mentre la scala scivola. Prima lo
  // spostamento si applicava tutto subito e la scala arrivava dopo, quindi
  // per un quarto di secondo il punto scappava via e poi tornava.
  ancoraZoom: null,
  // La corsa lasciata dal dito (px/s), che si spegne da sé come nella vista 3D
  inerzia: null,
  sprite: {}, nuvole: {}, sagome: {},
  schermo: { sonde: [], segni: [], traccia: null },
  ui: null
};

function cosmAttivo() { return cosm.attivo; }

// =====================================================================
// 4. Le Voyager: dove sono, e quanto lontano
// =====================================================================

function cosmIstante() {
  const base = cosm.baseMs != null ? cosm.baseMs
    : (typeof skyAdesso === 'function' ? skyAdesso().getTime() : Date.now());
  return base + cosm.anni * COSM_ANNO_MS;
}

// La posizione eclittica eliocentrica in UA: prima del 2026 il Grand Tour
// di app.js, dopo la retta di `SOL_SONDE` — che funziona anche fra
// centomila anni, perché è una retta (a quella distanza la gravità del Sole
// non sposta più niente che si veda)
function cosmPosizioneSonda(id, ms) {
  if (typeof solPuntoVoyager === 'function') {
    const p = solPuntoVoyager(id, ms);
    if (p) return p;
  }
  const s = (typeof SOL_SONDE !== 'undefined' ? SOL_SONDE : []).find(x => x.id === id);
  if (!s) return null;
  const epoca = typeof SOL_SONDE_EPOCA_MS !== 'undefined' ? SOL_SONDE_EPOCA_MS : Date.UTC(2026, 0, 1);
  const d = Math.max(0, s.ua + s.uaPerAnno * (ms - epoca) / COSM_ANNO_MS);
  return cosmDaSferiche(s.lon, s.lat, d);
}

function cosmDatiSonda(id) {
  return (typeof SOL_SONDE !== 'undefined' ? SOL_SONDE : []).find(x => x.id === id) || null;
}

// La Terra, per la distanza «da noi». Fuori dal secolo non la si chiede alla
// libreria: fra mille anni la differenza fra la Terra e il Sole, vista da
// migliaia di unità astronomiche, è dentro all'ultima cifra.
let cosmTerraCache = { ms: NaN, v: null };
function cosmTerra(ms) {
  if (Math.abs(ms - Date.now()) > 400 * COSM_ANNO_MS || typeof Astronomy === 'undefined') return null;
  const ora = Math.round(ms / 3600000);
  if (cosmTerraCache.ms === ora) return cosmTerraCache.v;
  let v = null;
  try {
    const h = Astronomy.HelioVector('Earth', new Date(ms));
    const e = Astronomy.Ecliptic(h).vec;
    v = { x: e.x, y: e.y, z: e.z };
  } catch (e) { v = null; }
  cosmTerraCache = { ms: ora, v };
  return v;
}

// La Terra, la Luna e i pianeti all'istante della carta, per disegnarli alla
// loro misura vera (v404). A differenza di `cosmTerra` qui non c'è memoria
// all'ora: alla scala della Terra in un'ora il pianeta fa sette schermi di
// strada, e il centro della carta lo deve seguire istante per istante. La
// memoria è dell'istante esatto, e l'istante è uno per fotogramma
// (`cosm.msFotogramma`): così tutto il disegno parla dello stesso momento.
const COSM_PIANETI = [
  { id: 'Mercury', km: 4879, colore: '#cbd5e1' }, { id: 'Venus', km: 12104, colore: '#fde68a' },
  { id: 'Earth', km: 12742, colore: '#60a5fa' }, { id: 'Mars', km: 6779, colore: '#f87171' },
  { id: 'Jupiter', km: 139820, colore: '#fbbf24' }, { id: 'Saturn', km: 116460, colore: '#fcd34d' },
  { id: 'Uranus', km: 50724, colore: '#67e8f9' }, { id: 'Neptune', km: 49244, colore: '#93c5fd' }
];
function cosmTabellaPianeti() {
  return typeof SOL_PIANETI !== 'undefined' && SOL_PIANETI.length ? SOL_PIANETI : COSM_PIANETI;
}
let cosmCorpiMemo = { ms: NaN, v: null };
function cosmCorpi(ms) {
  if (cosmCorpiMemo.ms === ms) return cosmCorpiMemo.v;
  let v = null;
  if (typeof Astronomy !== 'undefined' && Number.isFinite(ms) && Math.abs(ms - Date.now()) < 3000 * COSM_ANNO_MS) {
    try {
      const t = Astronomy.MakeTime(new Date(ms));
      const ecl = h => { const e = Astronomy.Ecliptic(h).vec; return { x: e.x, y: e.y, z: e.z }; };
      const asse = id => (typeof solAsse === 'function' ? solAsse(id, t) : [0, 0, 1]);
      const pianeti = cosmTabellaPianeti().map(p => Object.assign({}, p, { pos: ecl(Astronomy.HelioVector(p.id, t)), asse: asse(p.id) }));
      const terra = pianeti.find(p => p.id === 'Earth');
      v = { ms, pianeti, terra: terra ? terra.pos : null, luna: ecl(Astronomy.GeoMoon(t)), asseLuna: asse('Moon') };
    } catch (e) { v = null; }
  }
  cosmCorpiMemo = { ms, v };
  return v;
}
function cosmCorpiOra() {
  return cosmCorpi(Number.isFinite(cosm.msFotogramma) ? cosm.msFotogramma : cosmIstante());
}
// La Terra in coordinate galattiche, cioè quelle di ogni altra cosa della
// carta. Senza effemeridi (le prove senza browser) è il Sole: a ogni scala
// in cui la differenza conta, le effemeridi ci sono.
function cosmTerraGal() {
  const c = cosmCorpiOra();
  return c && c.terra ? cosmEclAGal(c.terra) : cosmVettore(0, 0, 0);
}
// Il centro di una tappa: quello scritto, o quello che si muove
function cosmCentroDi(s) {
  if (!s) return null;
  if (s.centroDi === 'terra') return cosmTerraGal();
  return s.centro;
}

// Tutto quello che una scheda o un'etichetta vuole sapere di una sonda
function cosmMisuraSonda(id, ms) {
  const p = cosmPosizioneSonda(id, ms);
  const s = cosmDatiSonda(id);
  if (!p || !s) return null;
  const r = Math.hypot(p.x, p.y, p.z);
  const t = cosmTerra(ms);
  const dt = t ? Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z) : r;
  return {
    id, nome: s.nome, colore: s.colore, ecl: p, gal: cosmEclAGal(p),
    dalSole: r, dallaTerra: dt, terraNota: !!t, kms: s.kms, uaPerAnno: s.uaPerAnno,
    partita: ms >= Date.UTC(1977, 7, 20)
  };
}

// L'istante in cui una sonda arriva a una distanza dal Sole: sulla retta si
// risolve a mano; prima del 2026 non serve (le tappe passate hanno la data)
function cosmQuandoA(id, ua) {
  const s = cosmDatiSonda(id);
  if (!s) return null;
  const epoca = typeof SOL_SONDE_EPOCA_MS !== 'undefined' ? SOL_SONDE_EPOCA_MS : Date.UTC(2026, 0, 1);
  return epoca + (ua - s.ua) / s.uaPerAnno * COSM_ANNO_MS;
}

// La distanza da un punto (giorno luce: dalla **Terra**, che è chi ascolta):
// si cerca per bisezione attorno alla stima sulla retta
function cosmQuandoDallaTerra(id, ua) {
  const stima = cosmQuandoA(id, ua);
  if (stima == null) return null;
  let a = stima - 2 * COSM_ANNO_MS, b = stima + 2 * COSM_ANNO_MS;
  const f = ms => { const m = cosmMisuraSonda(id, ms); return m ? m.dallaTerra - ua : 0; };
  if (f(a) > 0 || f(b) < 0) return stima;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (f(m) < 0) a = m; else b = m; }
  return (a + b) / 2;
}

// Le tappe con il loro istante, ordinate
function cosmTappe() {
  const ora = Date.now();
  return COSM_TAPPE.map(t => {
    let ms = t.ms;
    if (ms == null && t.ua != null) ms = t.id === 'giornoLuce' ? cosmQuandoDallaTerra(t.sonda, t.ua) : cosmQuandoA(t.sonda, t.ua);
    if (ms == null && t.anni != null) ms = Date.UTC(2026, 0, 1) + t.anni * COSM_ANNO_MS;
    return Object.assign({}, t, { quando: ms, passata: ms <= ora });
  }).sort((a, b) => a.quando - b.quando);
}

// =====================================================================
// 5. Testi: misure, distanze, tempi
// =====================================================================

const cosmT = (k, p) => (typeof astroI18n !== 'undefined' ? astroI18n.t(k, p) : k);
function cosmNum(n, dec) {
  if (typeof astroI18n !== 'undefined') return astroI18n.numero(n, dec);
  return dec == null ? String(Math.round(n)) : n.toFixed(dec);
}
// Tre cifre significative, che è quanto queste misure valgono
function cosmCifre(n) {
  if (n >= 100) return cosmNum(Math.round(n));
  // Gli zeri in coda non sono cifre significative: «42 mila», non «42,0»
  const dec = n >= 10 ? 1 : n >= 1 ? 2 : 3;
  const f = Math.pow(10, dec), r = Math.round(n * f) / f;
  let usati = dec;
  while (usati > 0 && Math.abs(r * Math.pow(10, usati - 1) - Math.round(r * Math.pow(10, usati - 1))) < 1e-9) usati--;
  return cosmNum(r, usati);
}

// Un numero con la sua unità: il testo a tre cifre significative, e il
// valore arrotondato per scegliere il plurale («1 anno luce», «2 anni luce»)
function cosmU(chiave, valore) {
  const arrot = valore >= 100 ? Math.round(valore) : valore >= 10 ? Math.round(valore * 10) / 10 : valore >= 1 ? Math.round(valore * 100) / 100 : valore;
  return cosmT(chiave, { n: cosmCifre(valore), count: arrot });
}

// Una distanza in UA scritta nell'unità che la rende leggibile
function cosmTestoDistanza(ua) {
  if (!Number.isFinite(ua)) return '—';
  const al = ua / COSM_UA_AL;
  // Sotto i dieci milioni di chilometri l'unità astronomica è un numero con
  // troppi zeri: la Terra e la Luna si misurano in chilometri (v404)
  if (ua < 0.067) return cosmU('cosmo.unita.km', ua * COSM_KM_UA);
  if (al < 0.05) return cosmU('cosmo.unita.ua', ua);
  if (al < 1e6) return cosmU('cosmo.unita.al', al);
  if (al < 1e9) return cosmU('cosmo.unita.mal', al / 1e6);
  return cosmU('cosmo.unita.gal', al / 1e9);
}

// Una durata in anni, dalla frazione di giorno ai miliardi
function cosmTestoAnni(anni) {
  if (!Number.isFinite(anni)) return '—';
  const secondi = anni * 365.25 * 86400;
  // La luce attraverso la Terra o fino alla Luna: secondi e minuti, non «0 h 0 min»
  if (secondi < 60) return cosmU('cosmo.unita.secondi', secondi);
  if (secondi < 3600) { const m = Math.round(secondi / 60); return cosmT('cosmo.unita.minuti', { n: cosmNum(m), count: m }); }
  if (anni < 2 / 365.25) {
    const ore = anni * 365.25 * 24;
    const h = Math.floor(ore), m = Math.round((ore - h) * 60);
    return cosmT('cosmo.unita.ore', { h, m });
  }
  if (anni < 1) { const g = Math.round(anni * 365.25); return cosmT('cosmo.unita.giorni', { n: cosmNum(g), count: g }); }
  if (anni < 10) return cosmU('cosmo.unita.anni', anni);
  if (anni < 1e4) { const a = Math.round(anni); return cosmT('cosmo.unita.anni', { n: cosmNum(a), count: a }); }
  if (anni < 1e6) return cosmU('cosmo.unita.milaAnni', anni / 1e3);
  if (anni < 1e9) return cosmU('cosmo.unita.milioniAnni', anni / 1e6);
  return cosmU('cosmo.unita.miliardiAnni', anni / 1e9);
}

// Il tempo che la luce impiega a fare quei chilometri: ore e minuti
function cosmTestoLuce(ua) {
  const s = ua * COSM_LUCE_S_UA;
  if (s < 3600) return cosmTestoAnni(s / (365.25 * 86400));
  const h = Math.floor(s / 3600), m = Math.round((s - h * 3600) / 60);
  return cosmT('cosmo.unita.ore', { h, m });
}

function cosmTestoAnno(ms) {
  const anno = 1970 + ms / COSM_ANNO_MS;
  if (anno < 9999) {
    return typeof astroI18n !== 'undefined'
      ? astroI18n.data(new Date(ms), { year: 'numeric' }) : String(Math.floor(anno));
  }
  return cosmNum(Math.round(anno / 100) * 100);
}

// =====================================================================
// 6. La camera della carta
// =====================================================================

// A che scala si inquadra una struttura (o le sonde di oggi). Due nomi non
// sono tappe ma punti di raccordo con la vista 3D (v404): `arrival` è la
// scala a cui la Terra ha la misura che le dà adesso la vista 3D — è da lì
// che una demo prende la carta senza scatti dopo il volo dal planetario — e
// `landing` è quella da cui parte l'atterraggio nel planetario.
function cosmLDi(id) {
  if (id === 'voyager' || id === 'probes') {
    const m = cosmMisuraSonda('voyager1', Date.now());
    return Math.log10(Math.max(60, (m ? m.dalSole : 170) * 1.55));
  }
  if (id === 'landing' || id === 'atterraggio') return COSM_L_ATTERRA;
  if (id === 'arrival' || id === 'arrivo') {
    const L = cosmLDallaVista3D();
    return Number.isFinite(L) ? L : Math.log10(COSM_TERRA_R_UA * 2.3);
  }
  const s = COSM_PER_ID.get(id) || COSM_STRUTTURE.find(x => x.demo === id);
  return s ? Math.log10(s.vista) : null;
}

// La scala a cui la Terra della carta è grande quanto quella della vista 3D
function cosmLDallaVista3D() {
  if (typeof sol === 'undefined' || !sol.pianeti || typeof solRaggioCorpo !== 'function') return NaN;
  const terra = sol.pianeti.find(p => p.id === 'Earth');
  if (!terra || !(sol.L > 0) || !(sol.H > 0)) return NaN;
  const r = solRaggioCorpo(terra);
  const lato = Math.max(60, Math.min(sol.L, sol.H) / 2);
  return r > 0 ? Math.log10(COSM_TERRA_R_UA * lato / r) : NaN;
}

// Il centro della carta per una scala: fra un'inquadratura e la successiva
// si scivola con una curva morbida, così lo spostamento è sempre una
// frazione della vista e non salta mai. Sotto i pianeti di roccia il centro
// è la Terra (v404): uscendo dal planetario è da lei che si parte, e il
// Sole prende il suo posto solo quando entra nel quadro.
function cosmAncore(pesi) {
  const terra = cosmSullaCarta(cosmTerraGal(), pesi);
  const punti = [{ L: COSM_L_MIN, c: terra }, { L: COSM_L_TERRA_FINO, c: terra }];
  COSM_STRUTTURE.forEach(s => {
    // L'ancora è il centro della struttura, o — per quelle che hanno noi sul
    // bordo (la nube locale, la Vergine, Laniakea) — un punto fra lei e il
    // Sole, così nel quadro ci stanno tutt'e due
    const a = s.ancora || cosmCentroDi(s);
    punti.push({ L: Math.log10(s.vista), c: a ? cosmSullaCarta(a, pesi) : { x: 0, y: 0, z: 0 } });
  });
  return punti.sort((x, y) => x.L - y.L);
}
// L'ancora della scala vista dalla camera, senza lo spostamento a mano
function cosmAncoraRuotata(L) {
  const pesi = cosmPesiPiano(L);
  const a = cosmAncore(pesi);
  let c = a[a.length - 1].c;
  if (L <= a[0].L) c = a[0].c;
  else for (let i = 0; i < a.length - 1; i++) {
    if (L >= a[i].L && L <= a[i + 1].L) {
      const k = cosmLiscia(a[i].L, a[i + 1].L, L);
      c = { x: a[i].c.x + (a[i + 1].c.x - a[i].c.x) * k, y: a[i].c.y + (a[i + 1].c.y - a[i].c.y) * k,
        z: a[i].c.z + (a[i + 1].c.z - a[i].c.z) * k };
      break;
    }
  }
  return cosmRuota(c);
}
function cosmCentro(L) {
  // Il centro è l'ancora vista dalla camera, più lo spostamento a mano (che
  // è nel piano dello schermo)
  const r = cosmAncoraRuotata(L);
  return { x: r.x + cosm.pan.x, y: r.y + cosm.pan.y };
}

// Quanti pixel vale metà del lato corto
function cosmLato(W, H) { return Math.max(60, Math.min(W, H) / 2); }

// Quello che serve per proiettare in questo fotogramma
function cosmCamera(L, W, H) {
  const lato = cosmLato(W, H);
  const s = lato / Math.pow(10, L);
  const pesi = cosmPesiPiano(L);
  const c = cosmCentro(L);
  return {
    L, W, H, s, pesi, c, lato,
    p(v) {
      const q = cosmRuota(cosmSullaCarta(v, pesi));
      return { x: W / 2 + (q.x - c.x) * s, y: H / 2 - (q.y - c.y) * s };
    },
    // Un vettore della carta (non un punto): la sua immagine sullo schermo
    d(v) {
      const q = cosmRuota(cosmSullaCarta(v, pesi));
      return { x: q.x * s, y: -q.y * s };
    },
    // Lo stesso, in UA sul piano dello schermo (senza scala né verso)
    q(v) { return cosmRuota(cosmSullaCarta(v, pesi)); }
  };
}

// Quanto si vede una cosa che è grande `rpx` pixel: compare piano sopra i
// pochi pixel, se ne va quando è tanto più grande dello schermo che non c'è
// più niente da vedere del suo bordo
function cosmVisibilita(rpx, lato, dentro = 4, fuori = 9) {
  if (!(rpx > 0)) return 0;
  const l = Math.log10(rpx);
  const su = cosmLiscia(Math.log10(dentro), Math.log10(dentro * 6), l);
  const giu = 1 - cosmLiscia(Math.log10(lato * fuori * 0.35), Math.log10(lato * fuori), l);
  return Math.max(0, Math.min(su, giu));
}

// Il volo fra due scale. La durata cresce con le decade da attraversare,
// ma meno che in proporzione: dieci decade non devono durare un minuto. Il
// profilo è quintico (parte e arriva con accelerazione nulla, v404): con la
// curva cubica di prima l'arrivo su una tappa si sentiva come una frenata.
function cosmVolaA(L, opzioni = {}) {
  if (!Number.isFinite(L)) return;
  const a = Math.max(COSM_L_MIN + 0.02, Math.min(COSM_L_MAX, L));
  const salto = Math.abs(a - cosm.L);
  const durata = opzioni.immediato ? 0 : 0.85 + 0.55 * Math.sqrt(salto);
  cosm.ancoraZoom = null;
  cosm.inerzia = null;
  cosm.volo = durata ? { da: cosm.L, a, t0: performance.now(), durata: durata * 1000, panDa: { ...cosm.pan } } : null;
  if (!durata) { cosm.L = a; cosm.pan = { x: 0, y: 0 }; }
  cosm.Lvoluto = a;
}
function cosmQuintica(u) { return u * u * u * (u * (u * 6 - 15) + 10); }

// Lo zoom attorno a un punto dello schermo (v404). Si ricorda il punto della
// carta sotto al dito e, a ogni fotogramma, si rifà lo spostamento perché
// resti sotto al dito alla scala di adesso — anche mentre la scala scivola e
// anche mentre l'ancora delle tappe si sposta. Allontanandosi lo spostamento
// a mano si riassorbe un poco per decade (`COSM_RIASSORBE`), così chi si
// allontana dalla Terra col dito di lato ritrova comunque, a quella scala,
// la Galassia in mezzo allo schermo.
const COSM_RIASSORBE = 1.15;
function cosmAncoraAlPunto(sx, sy) {
  const cam = cosm.cam;
  if (!cam) return null;
  const c = cosmCentro(cosm.L);
  const s = cosmLato(cam.W, cam.H) / Math.pow(10, cosm.L);
  // Zoomando su un corpo (un pianeta, la Luna, il Sole) si aggancia lui e
  // non il punto: alla scala dei pianeti un pixel vale decimi di unità
  // astronomica, e un punto «quasi sulla Terra» dopo cinque decade di zoom è
  // a trenta schermi da lei. Agganciato, il corpo resta sotto al dito e
  // scivola verso il centro man mano che ci si avvicina — è quello che si
  // voleva guardare.
  const corpo = cosmCorpoNelPunto(sx, sy);
  return { sx, sy, sx0: sx, sy0: sy, L0: cosm.L, corpo,
    q: { x: c.x + (sx - cam.W / 2) / s, y: c.y - (sy - cam.H / 2) / s } };
}
// Dove sta un corpo, in coordinate galattiche, all'istante della carta
function cosmPosizioneCorpo(id) {
  if (id === 'Sun') return cosmVettore(0, 0, 0);
  const c = cosmCorpiOra();
  if (!c) return null;
  if (id === 'Moon') return cosmEclAGal({ x: c.terra.x + c.luna.x, y: c.terra.y + c.luna.y, z: c.terra.z + c.luna.z });
  const p = c.pianeti.find(x => x.id === id);
  return p ? cosmEclAGal(p.pos) : null;
}
function cosmCorpoNelPunto(sx, sy) {
  const cam = cosm.cam, c = cosmCorpiOra();
  if (!cam || !c || cam.L > 2.6) return null;
  const ids = ['Sun', 'Moon'].concat(c.pianeti.map(p => p.id));
  let scelto = null, migliore = Infinity;
  ids.forEach(id => {
    const v = cosmPosizioneCorpo(id);
    if (!v) return;
    const q = cam.p(v);
    const km = id === 'Sun' ? 1391400 : id === 'Moon' ? 3474.8 : (c.pianeti.find(p => p.id === id) || {}).km || 0;
    const r = km / 2 / COSM_KM_UA * cam.s;
    const d = Math.hypot(q.x - sx, q.y - sy);
    // La Luna si aggancia solo quando è staccata dalla Terra sullo schermo
    if (id === 'Moon' && Math.hypot(c.luna.x, c.luna.y, c.luna.z) * cam.s < 12) return;
    if (d < Math.max(24, r + 10) && d < migliore) { migliore = d; scelto = id; }
  });
  return scelto;
}
function cosmApplicaAncora() {
  const z = cosm.ancoraZoom, cam = cosm.cam;
  if (!z || !cam) return;
  const s = cosmLato(cam.W, cam.H) / Math.pow(10, cosm.L);
  const anc = cosmAncoraRuotata(cosm.L);
  let q = z.q, sx = z.sx, sy = z.sy;
  if (z.corpo) {
    const v = cosmPosizioneCorpo(z.corpo);
    if (v) {
      q = cosmRuota(cosmSullaCarta(v, cosmPesiPiano(cosm.L)));
      // Avvicinandosi il corpo scivola al centro: dopo tre decade è lì
      if (!cosm.ditaGiu) {
        const w = Math.exp(-0.75 * Math.abs(cosm.L - z.L0));
        sx = cam.W / 2 + (z.sx0 - cam.W / 2) * w;
        sy = cam.H / 2 + (z.sy0 - cam.H / 2) * w;
        z.sx = sx; z.sy = sy;
      }
    }
  }
  let px = q.x - anc.x - (sx - cam.W / 2) / s;
  let py = q.y - anc.y + (sy - cam.H / 2) / s;
  if (cosm.L > z.L0 && !z.corpo) {
    const w = Math.exp(-(cosm.L - z.L0) * COSM_RIASSORBE);
    px *= w; py *= w;
  }
  if (Number.isFinite(px) && Number.isFinite(py)) cosm.pan = { x: px, y: py };
}

// L'inerzia della carta: le stesse costanti della vista 3D, perché il dito
// che lascia andare la carta deve sentire la stessa frenata
const COSM_TAU_INERZIA = 0.48;
const COSM_TAU_LANCIO = 0.06;
const COSM_INERZIA_MIN = 7;
const COSM_INERZIA_MAX = 3200;
const COSM_GIRO_PER_PIXEL = 0.008;
const COSM_ELEV_PER_PIXEL = 0.32;
function cosmTrascina(dx, dy, tipo) {
  const cam = cosm.cam;
  if (tipo === 'giro') {
    cosm.az += dx * COSM_GIRO_PER_PIXEL;
    cosm.elev = Math.max(-89, Math.min(89.999, cosm.elev + dy * COSM_ELEV_PER_PIXEL));
    cosm.azVoluto = cosm.az; cosm.elevVoluta = cosm.elev;
  } else if (tipo === 'inclina') {
    cosm.elev = Math.max(-89, Math.min(89.999, cosm.elev + dy * COSM_ELEV_PER_PIXEL));
    cosm.elevVoluta = cosm.elev;
  } else if (cam) {
    const s = cosmLato(cam.W, cam.H) / Math.pow(10, cosm.L);
    cosm.pan.x -= dx / s;
    cosm.pan.y += dy / s;
    // Lo spostamento a mano non va oltre qualche decina di viste: chi si
    // perde ha il ⟲, e non deve ritrovarsi a dieci schermi dal niente
    const lim = Math.pow(10, cosm.L) * 40;
    cosm.pan.x = Math.max(-lim, Math.min(lim, cosm.pan.x));
    cosm.pan.y = Math.max(-lim, Math.min(lim, cosm.pan.y));
  }
}

function cosmPassoCamera(ora) {
  if (cosm.regia) return;
  // La camera scivola verso dove è stata chiesta (il ⟲, l'ingresso): il dito
  // invece la muove direttamente, e scrive le due grandezze insieme
  const dt = cosm.ultimoTs ? Math.min(0.1, (ora - cosm.ultimoTs) / 1000) : 0;
  const kc = 1 - Math.exp(-dt / 0.2);
  if (Math.abs(cosm.elevVoluta - cosm.elev) > 0.01) cosm.elev += (cosm.elevVoluta - cosm.elev) * kc;
  else cosm.elev = cosm.elevVoluta;
  if (Math.abs(cosm.azVoluto - cosm.az) > 1e-4) cosm.az += (cosm.azVoluto - cosm.az) * kc;
  else cosm.az = cosm.azVoluto;
  // La corsa del dito che continua da sola
  const i = cosm.inerzia;
  if (i && dt && !cosm.ditaGiu) {
    cosmTrascina(i.vx * dt, i.vy * dt, i.tipo);
    const freno = Math.exp(-dt / COSM_TAU_INERZIA);
    i.vx *= freno; i.vy *= freno;
    if (Math.hypot(i.vx, i.vy) < COSM_INERZIA_MIN) cosm.inerzia = null;
  }
  if (cosm.volo) {
    const v = cosm.volo;
    const u = Math.min(1, (ora - v.t0) / v.durata);
    const k = cosmQuintica(u);
    cosm.L = v.da + (v.a - v.da) * k;
    cosm.pan = { x: v.panDa.x * (1 - k), y: v.panDa.y * (1 - k) };
    if (u >= 1) { cosm.volo = null; cosm.Lvoluto = cosm.L; }
    return;
  }
  if (Math.abs(cosm.Lvoluto - cosm.L) > 1e-4) cosm.L += (cosm.Lvoluto - cosm.L) * (1 - Math.exp(-dt / 0.14));
  else cosm.L = cosm.Lvoluto;
  if (cosm.ancoraZoom) {
    cosmApplicaAncora();
    // Un corpo agganciato si continua a seguire anche a scala ferma: il
    // tempo scorre, e la Terra a quella scala fa uno schermo in pochi minuti
    if (cosm.L === cosm.Lvoluto && !cosm.ditaGiu && !cosm.ancoraZoom.corpo) cosm.ancoraZoom = null;
  }
  // La riga della scala trascinata riporta la carta sull'ancora delle tappe
  if (cosm.riassorbi && dt) {
    const k = Math.exp(-dt / 0.35);
    cosm.pan = { x: cosm.pan.x * k, y: cosm.pan.y * k };
    if (Math.hypot(cosm.pan.x, cosm.pan.y) < Math.pow(10, cosm.L) * 1e-3) { cosm.pan = { x: 0, y: 0 }; cosm.riassorbi = false; }
  }
  // In fondo alla scala, la Terra riempie lo schermo: si atterra. Solo se è
  // lei che si sta guardando — zoomando nel vuoto accanto la scala si ferma
  if (cosm.L <= COSM_L_ATTERRA + 0.004 && cosm.Lvoluto <= COSM_L_ATTERRA + 0.004) {
    if (cosmTerraAlCentro()) cosmAtterra();
    else cosm.Lvoluto = Math.max(cosm.Lvoluto, COSM_L_ATTERRA + 0.01);
  }
}

// =====================================================================
// 7. I materiali: generati una volta sola, con un dado seminato
// =====================================================================

function cosmDado(seme) {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function cosmGauss(d) {
  const u = Math.max(1e-9, d()), v = d();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function cosmTela(l, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = l; c.height = h || l;
  return c;
}

/* La Via Lattea vista dal polo nord galattico: la barra, quattro bracci a
 * spirale logaritmica con un passo di dodici gradi (i raggi alla longitudine
 * del Sole sono quelli dei bracci veri: Scudo-Centauro, Sagittario, Perseo,
 * il braccio esterno), il braccio di Orione dove sta il Sole. Gira in senso
 * orario visto da qui, e i bracci restano indietro: per questo il raggio
 * cresce andando in senso antiorario. Il lato è centomila anni luce. */
const COSM_BRACCI = [
  { raggio: 15400, colore: [190, 210, 255] },
  { raggio: 21500, colore: [205, 220, 255] },
  { raggio: 30100, colore: [190, 205, 255] },
  { raggio: 42000, colore: [170, 190, 245] }
];
const COSM_PASSO_BRACCI = Math.tan(12 * COSM_D2R);

function cosmSpriteViaLattea() {
  if (cosm.sprite.viaLattea !== undefined) return cosm.sprite.viaLattea;
  const N = 1024, c = cosmTela(N);
  cosm.sprite.viaLattea = c;
  if (!c) return null;
  const g = c.getContext('2d');
  const k = (N / 2 - 12) / 50000;               // pixel per anno luce
  const punto = (x, y) => [N / 2 - y * k, N / 2 - x * k];  // galattico rispetto al centro → tela
  const d = cosmDado(7);
  // Il disco: un bagliore che si spegne verso il bordo
  let gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  gr.addColorStop(0, 'rgba(255,236,200,0.55)');
  gr.addColorStop(0.12, 'rgba(255,220,180,0.32)');
  gr.addColorStop(0.45, 'rgba(160,180,240,0.12)');
  gr.addColorStop(1, 'rgba(120,140,220,0)');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  // I bracci: migliaia di stelline lungo la spirale, più fitte verso il
  // centro, e qualche nube rosa d'idrogeno acceso
  g.globalCompositeOperation = 'lighter';
  // Le stelline si raccolgono per livello di luce, come nella ragnatela
  const nubi = new Path2D();
  COSM_BRACCI.forEach((b, i) => {
    const stelle = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    for (let n = 0; n < 2600; n++) {
      const psi = Math.PI + (d() * 2 - 0.95) * Math.PI * 1.15;
      const r = b.raggio * Math.exp(COSM_PASSO_BRACCI * (psi - Math.PI));
      if (r < 5000 || r > 52000) continue;
      const larg = 420 + r * 0.022;
      const rr = r + cosmGauss(d) * larg, pp = psi + cosmGauss(d) * 0.02;
      const [u, v] = punto(rr * Math.cos(pp), rr * Math.sin(pp));
      const a = Math.min(0.95, 0.3 + 9000 / (rr + 6000) * 0.3) * (0.5 + d() * 0.5);
      const rosa = d() < 0.025;
      const raggio = rosa ? 1.6 + d() * 1.4 : 0.6 + d() * 1.1;
      const tr = rosa ? nubi : stelle[Math.min(3, Math.floor(a * 0.7 * 5))];
      tr.moveTo(u + raggio, v); tr.arc(u, v, raggio, 0, Math.PI * 2);
    }
    stelle.forEach((tr, k) => { g.fillStyle = `rgba(${b.colore[0]},${b.colore[1]},${b.colore[2]},${0.1 + k * 0.16})`; g.fill(tr); });
    void i;
  });
  g.fillStyle = 'rgba(255,140,190,0.55)'; g.fill(nubi);
  // Il braccio di Orione: il ponte corto su cui sta il Sole
  for (let n = 0; n < 1100; n++) {
    const psi = Math.PI + (d() - 0.45) * 0.42;
    const r = 26300 * Math.exp(COSM_PASSO_BRACCI * (psi - Math.PI)) + cosmGauss(d) * 1100;
    const [u, v] = punto(r * Math.cos(psi), r * Math.sin(psi));
    g.fillStyle = `rgba(215,225,255,${0.25 + d() * 0.35})`;
    g.beginPath(); g.arc(u, v, 0.6 + d() * 0.9, 0, Math.PI * 2); g.fill();
  }
  // La barra, lunga ventiseimila anni luce e girata di 27° rispetto alla
  // linea Sole–centro, con l'estremo vicino dalla parte delle longitudini
  // positive; e il rigonfiamento
  const ang = 27 * COSM_D2R;
  const [x1, y1] = punto(-13000 * Math.cos(ang), 13000 * Math.sin(ang));
  const [x2, y2] = punto(13000 * Math.cos(ang), -13000 * Math.sin(ang));
  g.save();
  g.translate(N / 2, N / 2);
  g.rotate(Math.atan2(y2 - y1, x2 - x1));
  g.scale(1, 0.32);
  gr = g.createRadialGradient(0, 0, 0, 0, 0, Math.hypot(x2 - x1, y2 - y1) / 2);
  gr.addColorStop(0, 'rgba(255,230,180,0.9)');
  gr.addColorStop(0.6, 'rgba(255,200,150,0.35)');
  gr.addColorStop(1, 'rgba(255,190,140,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, Math.hypot(x2 - x1, y2 - y1) / 2, 0, Math.PI * 2); g.fill();
  g.restore();
  gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, 6000 * k);
  gr.addColorStop(0, 'rgba(255,248,225,1)');
  gr.addColorStop(1, 'rgba(255,220,170,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(N / 2, N / 2, 6000 * k, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-over';
  return c;
}

// Una spirale qualunque, per Andromeda e il Triangolo: stessa ricetta, due
// bracci, piccola
function cosmSpriteGalassia() {
  if (cosm.sprite.galassia !== undefined) return cosm.sprite.galassia;
  const N = 256, c = cosmTela(N);
  cosm.sprite.galassia = c;
  if (!c) return null;
  const g = c.getContext('2d');
  const d = cosmDado(31);
  let gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  gr.addColorStop(0, 'rgba(255,240,215,0.95)');
  gr.addColorStop(0.18, 'rgba(240,215,190,0.45)');
  gr.addColorStop(0.6, 'rgba(170,180,240,0.12)');
  gr.addColorStop(1, 'rgba(150,160,230,0)');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  g.globalCompositeOperation = 'lighter';
  for (let b = 0; b < 2; b++) for (let n = 0; n < 700; n++) {
    const t = d() * 3.2;
    const r = 10 * Math.exp(0.42 * t) + cosmGauss(d) * 4;
    const a = t + b * Math.PI + cosmGauss(d) * 0.08;
    g.fillStyle = `rgba(205,215,255,${0.2 + d() * 0.4})`;
    g.beginPath(); g.arc(N / 2 + r * Math.cos(a), N / 2 + r * Math.sin(a), 0.5 + d() * 0.8, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  return c;
}

// La ragnatela cosmica dell'universo osservabile. È **illustrativa**: i
// filamenti hanno la misura giusta (decine di milioni di anni luce) ma le
// posizioni non sono quelle di nessun catalogo, e la scheda lo dice.
function cosmSpriteRagnatela() {
  if (cosm.sprite.ragnatela !== undefined) return cosm.sprite.ragnatela;
  const N = 1024, c = cosmTela(N);
  cosm.sprite.ragnatela = c;
  if (!c) return null;
  const g = c.getContext('2d');
  const d = cosmDado(97);
  const nodi = [];
  for (let i = 0; i < 260; i++) {
    const r = Math.sqrt(d()) * (N / 2 - 30), a = d() * Math.PI * 2;
    nodi.push([N / 2 + r * Math.cos(a), N / 2 + r * Math.sin(a)]);
  }
  g.globalCompositeOperation = 'lighter';
  // I punti si raccolgono in quattro tracciati, uno per livello di luce, e
  // si riempiono alla fine: cinquantamila cambi di colore costavano un
  // terzo di secondo, quattro riempimenti niente
  const livelli = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  nodi.forEach((p, i) => {
    const vicini = nodi.map((q, j) => [Math.hypot(q[0] - p[0], q[1] - p[1]), j])
      .filter(x => x[1] !== i).sort((a, b) => a[0] - b[0]).slice(0, 3);
    vicini.forEach(([dist, j]) => {
      if (dist > 90) return;
      const q = nodi[j];
      // Un filamento non è una retta: un arco con un punto di controllo
      // spostato a caso, e i punti sparpagliati attorno
      const cx = (p[0] + q[0]) / 2 + cosmGauss(d) * dist * 0.22, cy = (p[1] + q[1]) / 2 + cosmGauss(d) * dist * 0.22;
      for (let n = 0; n < dist * 2.2; n++) {
        const t = d(), u = 1 - t;
        const x = u * u * p[0] + 2 * u * t * cx + t * t * q[0] + cosmGauss(d) * 2.6;
        const y = u * u * p[1] + 2 * u * t * cy + t * t * q[1] + cosmGauss(d) * 2.6;
        livelli[Math.min(3, Math.floor(d() * 4))].rect(x, y, 1.1, 1.1);
      }
    });
    const gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], 4);
    gr.addColorStop(0, 'rgba(255,225,200,0.55)');
    gr.addColorStop(1, 'rgba(255,225,200,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(p[0], p[1], 4, 0, Math.PI * 2); g.fill();
  });
  livelli.forEach((tr, i) => { g.fillStyle = `rgba(170,190,255,${0.07 + i * 0.045})`; g.fill(tr); });
  g.globalCompositeOperation = 'source-over';
  return c;
}

// I materiali si preparano prima che servano, quando il browser è libero:
// la Via Lattea e la ragnatela costano qualche decina di millisecondi l'una,
// e pagarle a metà di uno zoom vorrebbe dire un fotogramma perso proprio lì
function cosmPreparaMateriali() {
  const lavori = [cosmSpriteViaLattea, cosmSpriteGalassia, cosmSpriteRagnatela,
    () => cosmNuvola('oort'), () => cosmNuvola('laniakea'), () => cosmNuvola('vergine'), () => cosmNuvola('nane'),
    () => cosmNuvola('kuiper'), () => cosmNuvola('asteroidi')];
  const quando = typeof requestIdleCallback === 'function' ? f => requestIdleCallback(f, { timeout: 600 }) : f => setTimeout(f, 30);
  const prossimo = () => { const f = lavori.shift(); if (!f) return; try { f(); } catch (e) { /* niente */ } quando(prossimo); };
  quando(prossimo);
}

/* Le nuvole di punti in tre dimensioni (vettori galattici in UA): la fascia
 * di Kuiper e la nube di Oort attorno al Sole, le galassie nane del Gruppo
 * Locale, i gruppi del Superammasso della Vergine, i filamenti di Laniakea.
 * Le due del Sistema Solare hanno la forma vera (un anello sull'eclittica,
 * una sfera); quelle extragalattiche hanno la misura e il centro veri e i
 * singoli punti illustrativi. */
function cosmNuvola(nome) {
  if (cosm.nuvole[nome]) return cosm.nuvole[nome];
  const punti = [];
  if (nome === 'kuiper') {
    // I plutini in risonanza 3:2 con Nettuno a 39,4 UA, la fascia classica
    // fra 42 e 48, e il disco diffuso che si allarga oltre il precipizio
    const d = cosmDado(3);
    for (let i = 0; i < 1500; i++) {
      const x = d();
      const r = x < 0.22 ? 39.4 + cosmGauss(d) * 0.6
        : x < 0.82 ? 42 + d() * 5.8 + cosmGauss(d) * 0.5
          : 48 + Math.pow(d(), 2) * 40;
      const a = d() * Math.PI * 2, z = cosmGauss(d) * (x < 0.82 ? 0.08 : 0.25) * r;
      const p = cosmEclAGal(cosmVettore(r * Math.cos(a), r * Math.sin(a), z));
      p.luce = 0.35 + d() * 0.65;
      punti.push(p);
    }
  } else if (nome === 'asteroidi') {
    // La fascia principale fra Marte e Giove, coi vuoti di Kirkwood dove le
    // orbite sono in risonanza con Giove (4:1, 3:1, 5:2, 7:3, 2:1): a
    // differenza della vista 3D qui le distanze sono vere, e i vuoti stanno
    // dove stanno
    const d = cosmDado(9);
    const vuoti = [2.065, 2.502, 2.825, 2.958, 3.279];
    for (let i = 0; i < 2600 && punti.length < 1700; i++) {
      const r = 2.1 + Math.pow(d(), 0.9) * 1.25;
      if (vuoti.some(v => Math.abs(r - v) < 0.028) && d() < 0.9) continue;
      const a = d() * Math.PI * 2, z = cosmGauss(d) * 0.1 * r;
      const p = cosmEclAGal(cosmVettore(r * Math.cos(a), r * Math.sin(a), z));
      p.luce = 0.3 + d() * 0.7;
      punti.push(p);
    }
  } else if (nome === 'oort') {
    // La nube interna (di Hills) più fitta, l'esterna rada fino a centomila
    // UA; isotropa. Il raggio si sorteggia in logaritmo.
    const d = cosmDado(5);
    for (let i = 0; i < 1600; i++) {
      const r = Math.pow(10, 3.05 + Math.pow(d(), 0.8) * 1.95);
      const z = d() * 2 - 1, a = d() * Math.PI * 2, q = Math.sqrt(1 - z * z);
      punti.push(cosmVettore(r * q * Math.cos(a), r * q * Math.sin(a), r * z));
    }
  } else if (nome === 'nane') {
    const d = cosmDado(11);
    for (let i = 0; i < 70; i++) {
      const attorno = i < 26 ? COSM_CENTRO_GAL : i < 58 ? COSM_M31 : COSM_BARICENTRO_LG;
      const sigma = i < 58 ? 0.45 * COSM_MAL : 1.6 * COSM_MAL;
      punti.push(cosmVettore(attorno.x + cosmGauss(d) * sigma, attorno.y + cosmGauss(d) * sigma, attorno.z + cosmGauss(d) * sigma));
    }
  } else if (nome === 'vergine') {
    const d = cosmDado(13);
    for (let i = 0; i < 320; i++) punti.push(cosmVettore(
      COSM_VERGINE.x + cosmGauss(d) * 4 * COSM_MAL, COSM_VERGINE.y + cosmGauss(d) * 4 * COSM_MAL, COSM_VERGINE.z + cosmGauss(d) * 4 * COSM_MAL));
    for (let gq = 0; gq < 46; gq++) {
      const sx = (d() * 2 - 1) * 52 * COSM_MAL, sy = (d() * 2 - 1) * 52 * COSM_MAL, sz = cosmGauss(d) * 6 * COSM_MAL;
      if (Math.hypot(sx, sy) > 55 * COSM_MAL) continue;
      const centro = cosmVettore(
        COSM_VERGINE.x + COSM_SG_X.x * sx + COSM_SG_Y.x * sy + COSM_SG_Z.x * sz,
        COSM_VERGINE.y + COSM_SG_X.y * sx + COSM_SG_Y.y * sy + COSM_SG_Z.y * sz,
        COSM_VERGINE.z + COSM_SG_X.z * sx + COSM_SG_Y.z * sy + COSM_SG_Z.z * sz);
      for (let n = 0; n < 9; n++) punti.push(cosmVettore(
        centro.x + cosmGauss(d) * 1.4 * COSM_MAL, centro.y + cosmGauss(d) * 1.4 * COSM_MAL, centro.z + cosmGauss(d) * 1.4 * COSM_MAL));
    }
  } else if (nome === 'laniakea') {
    const d = cosmDado(17);
    const nodi = [];
    for (let i = 0; i < 34; i++) {
      const r = Math.sqrt(d()) * 250 * COSM_MAL, a = d() * Math.PI * 2, z = cosmGauss(d) * 30 * COSM_MAL;
      const sx = r * Math.cos(a), sy = r * Math.sin(a);
      nodi.push(cosmVettore(
        COSM_GRANDE_ATTRATTORE.x + COSM_SG_X.x * sx + COSM_SG_Y.x * sy + COSM_SG_Z.x * z,
        COSM_GRANDE_ATTRATTORE.y + COSM_SG_X.y * sx + COSM_SG_Y.y * sy + COSM_SG_Z.y * z,
        COSM_GRANDE_ATTRATTORE.z + COSM_SG_X.z * sx + COSM_SG_Y.z * sy + COSM_SG_Z.z * z));
    }
    nodi.push(COSM_VERGINE, COSM_GRANDE_ATTRATTORE);
    nodi.forEach((p, i) => {
      nodi.map((q, j) => [Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z), j]).filter(x => x[1] !== i)
        .sort((a, b) => a[0] - b[0]).slice(0, 2).forEach(([, j]) => {
          const q = nodi[j];
          for (let n = 0; n < 36; n++) {
            const t = d(), j2 = 4 * COSM_MAL;
            punti.push(cosmVettore(p.x + (q.x - p.x) * t + cosmGauss(d) * j2, p.y + (q.y - p.y) * t + cosmGauss(d) * j2, p.z + (q.z - p.z) * t + cosmGauss(d) * j2));
          }
        });
    });
  }
  cosm.nuvole[nome] = punti;
  return punti;
}

// =====================================================================
// 8. Il disegno
// =====================================================================

let COSM_CARATTERE = '';
function cosmCarattere(misura, peso) {
  if (!COSM_CARATTERE && typeof document !== 'undefined') {
    COSM_CARATTERE = getComputedStyle(document.body).fontFamily || 'sans-serif';
  }
  return `${peso || 500} ${misura}px ${COSM_CARATTERE || 'sans-serif'}`;
}
// Una scritta col suo alone scuro: è appoggiata su un fondo che cambia
// sotto di lei a ogni decade
function cosmScritta(ctx, testo, x, y, colore, misura, allinea, peso) {
  ctx.font = cosmCarattere(misura, peso);
  ctx.textAlign = allinea || 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = 'rgba(3,6,16,0.85)';
  ctx.strokeText(testo, x, y);
  ctx.fillStyle = colore;
  ctx.fillText(testo, x, y);
}

// Il nome di una struttura (e sotto la sua misura) in cima al suo bordo,
// tosato dentro allo schermo
function cosmNomeStruttura(ctx, cam, id, x, y, alfa, sopra) {
  // Il nome si scrive quando la struttura è quella che si sta guardando, o
  // le sta accanto: con tutte le strutture in vista insieme i nomi si
  // accavallano, e quello delle più piccole sta comunque sulla riga in fondo
  const s = COSM_PER_ID.get(id);
  if (s) {
    const q = Math.log10(s.r * cam.s / cam.lato);
    alfa *= Math.min(cosmLiscia(-0.7, -0.4, q), 1 - cosmLiscia(0.35, 0.75, q));
  }
  if (alfa < 0.05) return;
  const W = cam.W, H = cam.H;
  const nome = cosmT(`cosmo.${id}.nome`), misura = cosmT(`cosmo.${id}.breve`);
  const xx = Math.max(90, Math.min(W - 90, x));
  const cima = cosm.regia ? (cosm.rigaY || 26) + 30 : 70;
  // Sopra alla riga della scala, che in fondo occupa una fascia sua
  const yy = Math.max(cima, Math.min(H - (cosm.fondoPx || 120) - (cosm.regia ? 26 : 70), y - (sopra || 0)));
  const evid = cosm.evidenza === id || (cosm.scelta && cosm.scelta.id === id);
  ctx.globalAlpha = Math.min(1, alfa * 1.15);
  cosmScritta(ctx, nome, xx, yy, evid ? '#fde68a' : '#e2e8f0', evid ? 15 : 13, 'center', 650);
  cosmScritta(ctx, misura, xx, yy + 15, 'rgba(203,213,225,0.9)', 11, 'center', 500);
  ctx.globalAlpha = 1;
}

function cosmPercorsoCerchio(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); }

// Un cerchio enorme non va chiesto al canvas: oltre qualche milione di
// pixel il rasterizzatore sbaglia o si ferma. Si disegna solo se il bordo
// può cadere nello schermo.
function cosmCerchioUtile(x, y, r, W, H) {
  if (!(r > 0) || r > 4e6) return false;
  const dx = Math.max(0, Math.abs(x - W / 2) - W / 2), dy = Math.max(0, Math.abs(y - H / 2) - H / 2);
  const lontano = Math.hypot(dx, dy);
  if (lontano > r + 4) return false;
  // Lo schermo intero dentro al cerchio: il bordo non si vede
  const angoli = [[0, 0], [W, 0], [0, H], [W, H]];
  return !angoli.every(([a, b]) => Math.hypot(a - x, b - y) < r - 4);
}

// Una sagoma irregolare (la bolla, la nube locale, Laniakea): un raggio che
// oscilla con qualche armonica sorteggiata, in un piano dato da due assi
function cosmSagoma(nome, armoniche, seme) {
  if (cosm.sagome[nome]) return cosm.sagome[nome];
  const d = cosmDado(seme);
  const h = Array.from({ length: armoniche }, (_, i) => ({ k: i + 2, a: (d() - 0.5) * 0.36 / (i * 0.6 + 1), f: d() * Math.PI * 2 }));
  const r = a => 1 + h.reduce((s, x) => s + x.a * Math.cos(x.k * a + x.f), 0);
  cosm.sagome[nome] = r;
  return r;
}
function cosmTracciaSagoma(ctx, cam, centro, raggio, forma, assi) {
  ctx.beginPath();
  for (let i = 0; i <= 96; i++) {
    const a = i / 96 * Math.PI * 2, rr = raggio * forma(a);
    const v = cosmVettore(
      centro.x + (assi[0].x * Math.cos(a) + assi[1].x * Math.sin(a)) * rr,
      centro.y + (assi[0].y * Math.cos(a) + assi[1].y * Math.sin(a)) * rr,
      centro.z + (assi[0].z * Math.cos(a) + assi[1].z * Math.sin(a)) * rr);
    const p = cam.p(v);
    if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
  }
  ctx.closePath();
}
const COSM_ASSI_GAL = [cosmVettore(1, 0, 0), cosmVettore(0, 1, 0)];
const COSM_ASSI_SG = [COSM_SG_X, COSM_SG_Y];

// --- Il Sistema Solare alla sua misura vera (v404) ---------------------------
/* Sotto Kuiper la carta è la stessa di sopra: distanze vere, corpi alla loro
 * misura vera. Vuol dire che la Terra, vista a scala dei pianeti di roccia, è
 * un granello di un decimo di pixel — e si disegna lo stesso, con un pallino
 * minimo e un alone, perché un pianeta che sparisce lascerebbe l'orbita senza
 * chi la percorre. Quando invece è grande (ci si è avvicinati) ogni corpo ha
 * la faccia della vista 3D: la Terra vera di §7.7-ter (coste, notte, luci
 * delle città, il puntino di casa) e le facce dipinte di §7.3.2, con la fase
 * vista da questa camera. Sono le stesse funzioni di app.js, chiamate con gli
 * assi di questa camera: sotto Kuiper la carta è il piano dell'eclittica, e
 * la terna di `cosmRuota` è la stessa di `solAssiVista`. */
function cosmAssiCamera() {
  const a = cosm.az || 0, e = (cosm.elev == null ? 90 : cosm.elev) * COSM_D2R;
  const ca = Math.cos(a), sa = Math.sin(a), ce = Math.cos(e), se = Math.sin(e);
  return { destra: [ca, -sa, 0], alto: [sa * se, ca * se, ce], verso: [-sa * ce, -ca * ce, se] };
}
function cosmSulloSchermo(p, cam, margine) {
  return p.x > -margine && p.y > -margine && p.x < cam.W + margine && p.y < cam.H + margine;
}
function cosmNomeCorpo(id) {
  return typeof nomeCorpo === 'function' ? nomeCorpo(id) : id;
}

// L'orbita di un pianeta: quella intera già campionata dalla vista 3D (le
// stesse posizioni, quindi lo stesso disegno), o — quando ci si è avvicinati
// tanto che fra due campioni l'orbita sarebbe una spezzata visibile — un arco
// corto campionato fitto attorno al punto in cui il pianeta sta adesso
const COSM_ORBITA_INTERA_MAX_PX = 480;
function cosmTracciaOrbita(id) {
  const t = typeof sol !== 'undefined' && sol.orbite && sol.orbite.tracce;
  return t ? t.find(x => x.id === id) : null;
}
function cosmArcoOrbita(p, ms, cam) {
  if (typeof Astronomy === 'undefined') return null;
  const a = Math.hypot(p.pos.x, p.pos.y, p.pos.z) || 1;
  const vista = Math.max(cam.W, cam.H) / cam.s;
  const ampio = Math.min(Math.PI, 2.6 * vista / a);
  const anni = Math.pow(a, 1.5);
  // L'arco si centra sul pezzo d'orbita più vicino al centro dello schermo,
  // che è quasi sempre dove sta il pianeta — ma non per forza: guardando la
  // Terra da vicino passa nel quadro anche l'orbita di Venere, senza Venere
  let centroMs = ms;
  const t = cosmTracciaOrbita(p.id);
  if (t && t.punti.length > 2) {
    let migliore = Infinity, k = 0;
    t.punti.forEach((v, i) => {
      const q = cam.p(cosmEclAGal(v));
      const d = Math.hypot(q.x - cam.W / 2, q.y - cam.H / 2);
      if (d < migliore) { migliore = d; k = i; }
    });
    if (migliore > Math.hypot(cam.W, cam.H) * 1.2 + a * cam.s * 0.02) return null;
    centroMs = ms + (k / (t.punti.length - 1) - 0.5) * anni * COSM_ANNO_MS;
  }
  const passo = Math.round(Math.log2(ampio) * 2);
  const chiave = `${p.id}|${Math.round(centroMs / 60000)}|${passo}`;
  cosm.archi = cosm.archi || new Map();
  if (cosm.archi.has(chiave)) return cosm.archi.get(chiave);
  const punti = [];
  try {
    for (let i = -40; i <= 40; i++) {
      const d = new Date(centroMs + i / 40 * ampio / (2 * Math.PI) * anni * COSM_ANNO_MS);
      const e = Astronomy.Ecliptic(Astronomy.HelioVector(p.id, Astronomy.MakeTime(d))).vec;
      punti.push(cosmEclAGal(cosmVettore(e.x, e.y, e.z)));
    }
  } catch (e) { return null; }
  if (cosm.archi.size > 24) cosm.archi.clear();
  cosm.archi.set(chiave, punti);
  return punti;
}
function cosmDisegnaOrbite(ctx, cam, corpi) {
  corpi.pianeti.forEach(p => {
    const a = Math.hypot(p.pos.x, p.pos.y, p.pos.z);
    const rpx = a * cam.s;
    let alfa = cosmVisibilita(rpx, cam.lato, 6, 40);
    let punti = null;
    if (rpx > COSM_ORBITA_INTERA_MAX_PX) {
      // Da vicino resta il solo tratto che passa nello schermo: la strada che
      // il pianeta sta facendo, appena accennata
      punti = cosmArcoOrbita(p, corpi.ms, cam);
      alfa = 0.55;
    } else if (alfa > 0.02) {
      const t = cosmTracciaOrbita(p.id);
      punti = t ? t.punti.map(v => cosmEclAGal(v)) : null;
      if (!punti) {
        punti = [];
        for (let i = 0; i <= 120; i++) {
          const g = i / 120 * Math.PI * 2;
          punti.push(cosmEclAGal(cosmVettore(a * Math.cos(g), a * Math.sin(g), 0)));
        }
      }
    }
    // Sopra a un globo grande l'orbita è una riga che lo taglia in due: si
    // ritira man mano che il pianeta si prende lo schermo
    const rCorpo = (p.km || 0) / 2 / COSM_KM_UA * cam.s;
    alfa *= 1 - 0.8 * cosmLiscia(20, 90, rCorpo);
    if (!punti || alfa < 0.02) return;
    ctx.globalAlpha = alfa * 0.55;
    ctx.strokeStyle = p.colore; ctx.lineWidth = p.id === 'Earth' ? 1.3 : 1;
    ctx.beginPath();
    punti.forEach((v, i) => { const q = cam.p(v); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

// Un corpo alla sua misura vera: un pallino con l'alone quando è piccolo, la
// faccia della vista 3D quando è grande
function cosmDisegnaCorpo(ctx, cam, corpo, pos, rVero, assi, quando, minimo) {
  const q = cam.p(cosmEclAGal(pos));
  const r = rVero * cam.s;
  if (!cosmSulloSchermo(q, cam, r + 30)) return null;
  if (r >= 2.6 && typeof solDisegnaCorpo === 'function') {
    try {
      // La Terra vera vuole il suo istante (non quello della vista 3D)
      if (corpo.id === 'Earth' && typeof solDisegnaTerraVera === 'function' && r >= 13) {
        ctx.save();
        ctx.translate(q.x, q.y);
        const d = Math.hypot(pos.x, pos.y, pos.z) || 1;
        const globo = typeof sol !== 'undefined' ? sol.globoTerra : null;
        const fatto = solDisegnaTerraVera(ctx, [-pos.x / d, -pos.y / d, -pos.z / d], r, assi, quando);
        if (typeof sol !== 'undefined') sol.globoTerra = globo;
        ctx.restore();
        if (fatto) { cosmAureola(ctx, q, r, '96,165,250'); return { q, r }; }
      }
      // `solDisegnaCorpo` legge lo stato della vista 3D solo per sapere se il
      // corpo è quello scelto: qui non lo è mai
      const scelto = sol.scelto; sol.scelto = null;
      solDisegnaCorpo(ctx, Object.assign({}, corpo, { pos, schermo: { px: q.x, py: q.y }, rDisegno: r }), assi);
      sol.scelto = scelto;
      if (corpo.id === 'Earth') cosmAureola(ctx, q, r, '96,165,250');
      return { q, r };
    } catch (e) { /* si torna al pallino */ }
  }
  const rp = Math.max(minimo || 1.6, r);
  const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rp * 3.4);
  g.addColorStop(0, corpo.colore);
  g.addColorStop(0.3, corpo.colore + '88');
  g.addColorStop(1, corpo.colore + '00');
  ctx.fillStyle = g;
  cosmPercorsoCerchio(ctx, q.x, q.y, rp * 3.4); ctx.fill();
  ctx.fillStyle = corpo.colore;
  cosmPercorsoCerchio(ctx, q.x, q.y, rp); ctx.fill();
  return { q, r: rp };
}
// L'aria di taglio, attorno a un pianeta con l'atmosfera
function cosmAureola(ctx, q, r, rgb) {
  const g = ctx.createRadialGradient(q.x, q.y, r * 0.98, q.x, q.y, r * 1.1);
  g.addColorStop(0, `rgba(${rgb},0.45)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  cosmPercorsoCerchio(ctx, q.x, q.y, r * 1.1); ctx.fill();
}

// L'orbita della Luna: un mese siderale di posizioni geocentriche, rifatte
// ogni ora di carta, disegnate attorno alla Terra di adesso
function cosmOrbitaLuna(ms) {
  const chiave = Math.round(ms / 3600000);
  if (cosm.orbitaLuna && cosm.orbitaLuna.chiave === chiave) return cosm.orbitaLuna.punti;
  const punti = [];
  try {
    for (let i = 0; i <= 96; i++) {
      const d = new Date(ms + (i / 96 - 0.5) * 27.3217 * 86400000);
      const e = Astronomy.Ecliptic(Astronomy.GeoMoon(Astronomy.MakeTime(d))).vec;
      punti.push({ x: e.x, y: e.y, z: e.z });
    }
  } catch (e) { return null; }
  cosm.orbitaLuna = { chiave, punti };
  return punti;
}

// Una riga di misura fra due corpi, col numero a metà: alla scala in cui la
// distanza è la cosa da guardare, dirla è meglio che lasciarla indovinare
function cosmRigaMisura(ctx, cam, a, b, testo, colore, alfa) {
  if (alfa < 0.03) return;
  const da = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / da, uy = (b.y - a.y) / da;
  ctx.globalAlpha = alfa * 0.7;
  ctx.strokeStyle = colore; ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  ctx.beginPath(); ctx.moveTo(a.x + ux * 10, a.y + uy * 10); ctx.lineTo(b.x - ux * 10, b.y - uy * 10); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = alfa;
  let x = (a.x + b.x) / 2, y = (a.y + b.y) / 2 - 11;
  x = Math.max(120, Math.min(cam.W - 120, x));
  y = Math.max(70, Math.min(cam.H - (cosm.fondoPx || 120) - 60, y));
  cosmScritta(ctx, testo, x, y, colore, 11, 'center', 600);
  ctx.globalAlpha = 1;
}

function cosmDisegnaSistemaVicino(ctx, cam) {
  const corpi = cosmCorpiOra();
  if (!corpi) { cosmDisegnaPianetiSemplici(ctx, cam); return; }
  // La fascia degli asteroidi, fra Marte e Giove
  cosmDisegnaNuvola(ctx, cam, 'asteroidi', 'rgba(214,200,170,1)', cosmVisibilita(2.8 * cam.s, cam.lato, 10, 16) * 0.85, 1.2);
  cosmDisegnaOrbite(ctx, cam, corpi);
  const assi = cosmAssiCamera();
  const quando = new Date(corpi.ms);
  const terraGal = cosmEclAGal(corpi.terra);
  // La Luna e la sua orbita attorno alla Terra
  const lunaPos = { x: corpi.terra.x + corpi.luna.x, y: corpi.terra.y + corpi.luna.y, z: corpi.terra.z + corpi.luna.z };
  const dLuna = Math.hypot(corpi.luna.x, corpi.luna.y, corpi.luna.z);
  const rOrbitaLuna = dLuna * cam.s;
  const alfaOrbitaLuna = cosmVisibilita(rOrbitaLuna, cam.lato, 5, 40);
  if (alfaOrbitaLuna > 0.02) {
    const punti = cosmOrbitaLuna(corpi.ms);
    if (punti) {
      ctx.globalAlpha = alfaOrbitaLuna * 0.45;
      ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      punti.forEach((g, i) => {
        const q = cam.p(cosmEclAGal({ x: corpi.terra.x + g.x, y: corpi.terra.y + g.y, z: corpi.terra.z + g.z }));
        if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
      });
      ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }
  // I pianeti, dal più lontano al più vicino a chi guarda (la vicinanza è la
  // coordinata lungo la direzione dello sguardo)
  const dietro = v => -(v.x * assi.verso[0] + v.y * assi.verso[1] + v.z * assi.verso[2]);
  const elenco = corpi.pianeti.map(p => ({ corpo: p, pos: p.pos, r: p.km / 2 / COSM_KM_UA, min: p.id === 'Earth' ? 2.3 : 1.6 }));
  if (rOrbitaLuna > 3) {
    elenco.push({ corpo: { id: 'Moon', colore: '#d4d4d8', asse: corpi.asseLuna }, pos: lunaPos, r: COSM_LUNA_R_UA, min: 1.3,
      alfa: cosmLiscia(3, 14, rOrbitaLuna) });
  }
  elenco.sort((a, b) => dietro(b.pos) - dietro(a.pos));
  const posti = [];
  elenco.forEach(e => {
    const aOrbita = e.corpo.id === 'Moon' ? rOrbitaLuna : Math.hypot(e.pos.x, e.pos.y, e.pos.z) * cam.s;
    // Un pianeta si vede alla scala della sua orbita, o quando è grande lui
    let alfa = Math.max(cosmVisibilita(aOrbita, cam.lato, 4, 90), e.r * cam.s >= 1.2 ? 1 : 0);
    if (e.alfa != null) alfa = Math.min(alfa, e.alfa);
    if (alfa < 0.03) return;
    ctx.globalAlpha = alfa;
    const fatto = cosmDisegnaCorpo(ctx, cam, e.corpo, e.pos, e.r, assi, quando, e.min);
    ctx.globalAlpha = 1;
    if (fatto) posti.push({ e, fatto, alfa, aOrbita });
  });
  // I nomi, dopo i corpi: un nome coperto da un pianeta non si legge
  posti.forEach(({ e, fatto, alfa, aOrbita }) => {
    const grande = fatto.r >= 13;
    if (e.corpo.id === 'Earth' && grande) return;    // c'è già «Sei qui»
    if (aOrbita < 26 && !grande) return;
    const nome = cosmNomeCorpo(e.corpo.id);
    ctx.globalAlpha = alfa;
    cosmScritta(ctx, nome, fatto.q.x, fatto.q.y + fatto.r + 13, e.corpo.colore, grande ? 13 : 11, 'center', grande ? 650 : 500);
    ctx.globalAlpha = 1;
  });
  // Le due misure che a quelle scale sono la cosa da guardare: la Luna e il Sole
  const terra = cam.p(terraGal);
  const luna = cam.p(cosmEclAGal(lunaPos));
  cosmRigaMisura(ctx, cam, terra, luna,
    cosmT('cosmo.etichetta.distanzaLuna', { d: cosmTestoDistanza(dLuna), luce: cosmTestoLuce(dLuna) }), '#e2e8f0',
    Math.min(cosmLiscia(70, 140, rOrbitaLuna), 1 - cosmLiscia(900, 2400, rOrbitaLuna)));
  const dSole = Math.hypot(corpi.terra.x, corpi.terra.y, corpi.terra.z);
  cosmRigaMisura(ctx, cam, cam.p(cosmVettore(0, 0, 0)), terra,
    cosmT('cosmo.etichetta.distanzaSole', { d: cosmTestoDistanza(dSole), luce: cosmTestoLuce(dSole) }), '#fde68a',
    Math.min(cosmLiscia(80, 150, dSole * cam.s), 1 - cosmLiscia(700, 1600, dSole * cam.s)));
}

// Senza effemeridi (non dovrebbe capitare: le carica la pagina) restano i
// cerchi delle orbite medie, come prima della v404
function cosmDisegnaPianetiSemplici(ctx, cam) {
  COSM_PIANETI.forEach(o => {
    const ua = { Mercury: 0.387, Venus: 0.723, Earth: 1, Mars: 1.524, Jupiter: 5.2, Saturn: 9.54, Uranus: 19.2, Neptune: 30.07 }[o.id];
    const rpx = ua * cam.s;
    const alfa = cosmVisibilita(rpx, cam.lato, 6, 40);
    if (alfa < 0.02) return;
    ctx.globalAlpha = alfa * 0.5;
    ctx.strokeStyle = o.colore; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const a = i / 90 * Math.PI * 2;
      const p = cam.p(cosmEclAGal(cosmVettore(ua * Math.cos(a), ua * Math.sin(a), 0)));
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    }
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

function cosmDisegnaNuvola(ctx, cam, nome, colore, alfa, raggio) {
  if (alfa < 0.02) return;
  const punti = cosmNuvola(nome);
  ctx.fillStyle = colore;
  const W = cam.W, H = cam.H;
  // Le nuvole che hanno una luce per punto (Kuiper, gli asteroidi) si
  // stendono in tre passate: tutti uguali, mille sassi sono una nebbia
  // uniforme; con tre luci sono una fascia di sassi
  const livelli = punti.length && punti[0].luce != null ? 3 : 1;
  const tracce = Array.from({ length: livelli }, () => new Path2D());
  for (let i = 0; i < punti.length; i++) {
    const p = cam.p(punti[i]);
    if (p.x < -4 || p.y < -4 || p.x > W + 4 || p.y > H + 4) continue;
    const k = livelli > 1 ? Math.min(2, Math.floor(punti[i].luce * 3)) : 0;
    const rr = raggio * (livelli > 1 ? 0.7 + k * 0.35 : 1);
    tracce[k].rect(p.x - rr / 2, p.y - rr / 2, rr, rr);
  }
  tracce.forEach((t, k) => {
    ctx.globalAlpha = alfa * (livelli > 1 ? 0.45 + k * 0.28 : 1);
    ctx.fill(t);
  });
  ctx.globalAlpha = 1;
}

// --- L'eliosfera ------------------------------------------------------------
/* La forma: una superficie di rivoluzione attorno al naso, r(θ) = R·(2 /
 * (1 + cos θ))^k, tosata a tre volte il naso sulla coda (che c'è, è lunga e
 * la sua forma è discussa: la si sfuma invece di chiuderla). Si disegna il
 * suo **contorno apparente**: per ogni direzione dello schermo il punto più
 * lontano fra quelli della superficie proiettati, che per una forma come
 * questa è esattamente la sagoma. Il naso è tarato perché la superficie
 * passi dove l'ha attraversata Voyager 1 (121,6 UA, agosto 2012). */
const COSM_ELIO = {
  pausa: { k: 0.35, naso: 118.7, colore: '125,211,252', passaggi: { voyager1: [Date.UTC(2012, 7, 25), 121.6], voyager2: [Date.UTC(2018, 10, 5), 119] } },
  shock: { k: 0.3, naso: 90.5, colore: '196,181,253', passaggi: { voyager1: [Date.UTC(2004, 11, 16), 94], voyager2: [Date.UTC(2007, 7, 30), 84] } }
};
const COSM_CODA = 3.1;

/* La superficie passa **per i due punti in cui le sonde l'hanno
 * attraversata**: una forma di rivoluzione sola non ce la fa (la Voyager 2,
 * più lontana dal naso, l'ha trovata più vicina: l'eliosfera è schiacciata
 * dalla parte del sud), quindi si aggiunge un termine di asimmetria lungo la
 * direzione che separa le due sonde, perpendicolare al naso. Due incognite
 * (il naso e l'asimmetria), due misure: si risolve a mano. */
function cosmParametriElio(quale) {
  const f = COSM_ELIO[quale];
  if (f.tarato) return f;
  const n = COSM_NASO;
  const dir = id => {
    const p = cosmPosizioneSonda(id, f.passaggi[id][0]);
    const g = p ? cosmEclAGal(p) : null;
    const l = g ? Math.hypot(g.x, g.y, g.z) : 0;
    return l ? cosmVettore(g.x / l, g.y / l, g.z / l) : null;
  };
  const d1 = dir('voyager1'), d2 = dir('voyager2');
  if (d1 && d2) {
    const diff = cosmVettore(d1.x - d2.x, d1.y - d2.y, d1.z - d2.z);
    const lungo = cosmScalare(diff, n);
    let m = cosmVettore(diff.x - n.x * lungo, diff.y - n.y * lungo, diff.z - n.z * lungo);
    const lm = Math.hypot(m.x, m.y, m.z) || 1;
    m = cosmVettore(m.x / lm, m.y / lm, m.z / lm);
    const g = d => Math.min(Math.pow(2 / (1 + cosmScalare(d, n)), f.k), COSM_CODA);
    const A = f.passaggi.voyager1[1] / g(d1), B = f.passaggi.voyager2[1] / g(d2);
    const c1 = cosmScalare(d1, m), c2 = cosmScalare(d2, m);
    if (Math.abs(c2 - c1) > 1e-3) {
      const Rn = (A * c2 - B * c1) / (c2 - c1);
      const beta = (A - Rn) / (Rn * c1);
      if (Rn > 50 && Math.abs(beta) < 0.6) { f.naso = Rn; f.beta = beta; f.m = m; }
    }
  }
  f.tarato = true;
  return f;
}
// Il raggio della superficie in una direzione (versore galattico)
function cosmRaggioElio(quale, d) {
  const f = cosmParametriElio(quale);
  const c = cosmScalare(d, COSM_NASO);
  const asim = f.m ? 1 + f.beta * cosmScalare(d, f.m) : 1;
  return f.naso * Math.min(Math.pow(2 / (1 + c), f.k), COSM_CODA) * asim;
}

function cosmContornoElio(cam, quale) {
  const f = cosmParametriElio(quale);
  const chiave = quale + '|' + cam.pesi.sonde.toFixed(3) + '|' + cam.pesi.gal.toFixed(3) +
    '|' + (cosm.az || 0).toFixed(3) + '|' + (cosm.elev == null ? 90 : cosm.elev).toFixed(2);
  const memo = cosm.sagome['elio-' + quale];
  let contorno;
  if (memo && memo.chiave === chiave) contorno = memo.punti;
  else {
    // Due assi perpendicolari al naso
    const n = COSM_NASO;
    const ref = Math.abs(n.z) < 0.9 ? cosmVettore(0, 0, 1) : cosmVettore(1, 0, 0);
    let u = cosmVettore(n.y * ref.z - n.z * ref.y, n.z * ref.x - n.x * ref.z, n.x * ref.y - n.y * ref.x);
    const lu = Math.hypot(u.x, u.y, u.z); u = cosmVettore(u.x / lu, u.y / lu, u.z / lu);
    const w = cosmVettore(n.y * u.z - n.z * u.y, n.z * u.x - n.x * u.z, n.x * u.y - n.y * u.x);
    const bin = new Array(120).fill(0);
    const naso2 = cam.q(n);
    for (let i = 0; i <= 60; i++) {
      const th = i / 60 * Math.PI;
      for (let j = 0; j < 48; j++) {
        const ph = j / 48 * Math.PI * 2;
        const dir = cosmVettore(
          n.x * Math.cos(th) + (u.x * Math.cos(ph) + w.x * Math.sin(ph)) * Math.sin(th),
          n.y * Math.cos(th) + (u.y * Math.cos(ph) + w.y * Math.sin(ph)) * Math.sin(th),
          n.z * Math.cos(th) + (u.z * Math.cos(ph) + w.z * Math.sin(ph)) * Math.sin(th));
        const r = cosmRaggioElio(quale, dir);
        const q = cam.q(dir);
        const rr = Math.hypot(q.x, q.y) * r;
        const ang = Math.atan2(q.y, q.x);
        const b = ((Math.round(ang / (2 * Math.PI) * 120) % 120) + 120) % 120;
        if (rr > bin[b]) bin[b] = rr;
      }
    }
    contorno = { bin, naso: naso2 };
    cosm.sagome['elio-' + quale] = { chiave, punti: contorno };
  }
  return contorno;
}
function cosmDisegnaEliosfera(ctx, cam) {
  const alfa = cosmVisibilita(COSM_ELIO.pausa.naso * cam.s, cam.lato, 8, 30);
  if (alfa < 0.02) return 0;
  const sole = cam.p(cosmVettore(0, 0, 0));
  ['pausa', 'shock'].forEach(quale => {
    const c = cosmContornoElio(cam, quale);
    const f = COSM_ELIO[quale];
    ctx.beginPath();
    c.bin.forEach((r, i) => {
      const a = i / 120 * Math.PI * 2;
      const x = sole.x + Math.cos(a) * r * cam.s, y = sole.y - Math.sin(a) * r * cam.s;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath();
    // Il naso netto, la coda che sfuma: un gradiente lungo la direzione del
    // vento, sulla carta
    const nx = c.naso.x, ny = -c.naso.y, ln = Math.hypot(nx, ny) || 1;
    const lungo = f.naso * COSM_CODA * cam.s;
    const g = ctx.createLinearGradient(sole.x + nx / ln * f.naso * cam.s, sole.y + ny / ln * f.naso * cam.s,
      sole.x - nx / ln * lungo, sole.y - ny / ln * lungo);
    g.addColorStop(0, `rgba(${f.colore},${0.9 * alfa})`);
    g.addColorStop(0.55, `rgba(${f.colore},${0.4 * alfa})`);
    g.addColorStop(1, `rgba(${f.colore},0)`);
    if (quale === 'pausa') {
      const riemp = ctx.createLinearGradient(sole.x + nx / ln * f.naso * cam.s, sole.y + ny / ln * f.naso * cam.s,
        sole.x - nx / ln * lungo, sole.y - ny / ln * lungo);
      riemp.addColorStop(0, `rgba(56,120,200,${0.16 * alfa})`);
      riemp.addColorStop(1, 'rgba(56,120,200,0)');
      ctx.fillStyle = riemp; ctx.fill();
    }
    ctx.strokeStyle = g;
    ctx.lineWidth = quale === 'pausa' ? 2 : 1.2;
    ctx.setLineDash(quale === 'pausa' ? [] : [5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  // La freccia del vento interstellare che arriva sul naso
  const c = cosmContornoElio(cam, 'pausa');
  const nx = c.naso.x, ny = -c.naso.y, ln = Math.hypot(nx, ny) || 1;
  const testa = { x: sole.x + nx / ln * (COSM_ELIO.pausa.naso * cam.s + 14), y: sole.y + ny / ln * (COSM_ELIO.pausa.naso * cam.s + 14) };
  const coda = { x: testa.x + nx / ln * 44, y: testa.y + ny / ln * 44 };
  ctx.globalAlpha = alfa * 0.8;
  ctx.strokeStyle = '#a5b4fc'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(coda.x, coda.y); ctx.lineTo(testa.x, testa.y);
  const pa = Math.atan2(testa.y - coda.y, testa.x - coda.x);
  ctx.lineTo(testa.x - 7 * Math.cos(pa - 0.45), testa.y - 7 * Math.sin(pa - 0.45));
  ctx.moveTo(testa.x, testa.y);
  ctx.lineTo(testa.x - 7 * Math.cos(pa + 0.45), testa.y - 7 * Math.sin(pa + 0.45));
  ctx.stroke();
  if (COSM_ELIO.pausa.naso * cam.s > 50) cosmScritta(ctx, cosmT('cosmo.etichetta.vento'), coda.x + nx / ln * 10, coda.y + ny / ln * 10 - 8, '#c7d2fe', 10.5);
  ctx.globalAlpha = 1;
  // I nomi: l'eliopausa in cima, lo shock di terminazione dentro
  const top = Math.max(...c.bin.slice(25, 35)) * cam.s;
  cosmNomeStruttura(ctx, cam, 'eliopausa', sole.x, sole.y - top, alfa, 18);
  if (COSM_ELIO.shock.naso * cam.s > 70) {
    // Dalla parte della coda, dove non passa nessuna sonda
    ctx.globalAlpha = alfa * 0.85;
    const cs = cosmContornoElio(cam, 'shock');
    const ang = Math.atan2(-c.naso.y, -c.naso.x);
    const b = ((Math.round(ang / (2 * Math.PI) * 120) % 120) + 120) % 120;
    const r = Math.min(cs.bin[b] * cam.s, cam.H * 0.32);
    cosmScritta(ctx, cosmT('cosmo.etichetta.shock'), sole.x + Math.cos(ang) * r * 0.82, sole.y - Math.sin(ang) * r * 0.82, '#ddd6fe', 10.5);
    ctx.globalAlpha = 1;
  }
  return alfa;
}

// --- Le Voyager sulla carta -------------------------------------------------
// Solo il segno di oggi (v401): niente scia, niente tratto del futuro, niente
// tacche delle tappe. Quello che la carta può dire senza inventare è dove
// stanno **adesso**; il viaggio lo racconta la demo delle Voyager.
// L'etichetta non si scrive a ogni scala: solo dove le due sonde sono due
// punti distinti e l'eliosfera è la cosa che si sta guardando — da più
// lontano sono un punto solo col Sole, e il loro nome lì è rumore.
const COSM_SONDE_NOMI_L = [1.75, 3.15];

function cosmDisegnaSonde(ctx, cam) {
  const ms = Date.now();
  cosm.schermo.sonde = [];
  const sole = cam.p(cosmVettore(0, 0, 0));
  const misure = ['voyager1', 'voyager2'].map(id => cosmMisuraSonda(id, ms)).filter(Boolean);
  if (!misure.length) return;
  const lontano = Math.max(...misure.map(m => m.dalSole));
  // Quando sono più vicine al Sole di qualche pixel non si disegnano affatto:
  // sarebbero un granello sopra al Sole
  if (lontano * cam.s < 6) return;
  const nomi = cam.L >= COSM_SONDE_NOMI_L[0] && cam.L <= COSM_SONDE_NOMI_L[1];
  const t = performance.now() / 1000;
  misure.forEach((m, i) => {
    if (!m.partita) return;
    const p = cam.p(m.gal);
    cosm.schermo.sonde.push({ id: m.id, x: p.x, y: p.y, m });
    ctx.fillStyle = m.colore;
    cosmPercorsoCerchio(ctx, p.x, p.y, 3.4); ctx.fill();
    ctx.strokeStyle = m.colore; ctx.lineWidth = 1.2;
    cosmPercorsoCerchio(ctx, p.x, p.y, 7 + 2 * Math.sin(t * 2.4 + i)); ctx.stroke();
    if (!nomi) return;
    // L'etichetta, dalla parte opposta al Sole
    const dx = p.x - sole.x, dy = p.y - sole.y, l = Math.hypot(dx, dy) || 1;
    let x = p.x + dx / l * 16, y = p.y + dy / l * 16;
    const allinea = dx >= 0 ? 'left' : 'right';
    // Fuori dalla fascia della riga della scala: in fondo di solito, in cima
    // durante una demo
    const cima = cosm.regia ? (cosm.rigaY || 26) + 40 : 54;
    x = Math.max(8, Math.min(cam.W - 8, x)); y = Math.max(cima, Math.min(cam.H - (cosm.fondoPx || 120) - (cosm.regia ? 44 : 96), y));
    // In alto a sinistra stanno le tre viste: il nome scivola alla loro destra
    if (!cosm.regia && y < 250 && x < 190) x = allinea === 'left' ? 190 : Math.max(x, 330);
    cosmScritta(ctx, m.nome, x, y, m.colore, 13, allinea, 700);
    cosmScritta(ctx, cosmT('cosmo.sonde.etichettaSole', { d: cosmTestoDistanza(m.dalSole) }), x, y + 15, '#e2e8f0', 11, allinea);
    if (m.terraNota) {
      cosmScritta(ctx, cosmT('cosmo.sonde.etichettaTerra', { d: cosmTestoDistanza(m.dallaTerra), luce: cosmTestoLuce(m.dallaTerra) }),
        x, y + 29, 'rgba(203,213,225,0.92)', 11, allinea);
    }
  });
}

// --- La Galassia e oltre ----------------------------------------------------
// Uno sprite piano appoggiato su un piano a tre dimensioni: si proiettano i
// due assi e il centro, e il resto lo fa la trasformazione affine del canvas
function cosmDisegnaSpritePiano(ctx, cam, sprite, centro, raggioUA, assi, alfa) {
  if (!sprite || alfa < 0.02) return;
  const N = sprite.width;
  const scala = raggioUA / (N / 2);
  const a = cam.d(cosmVettore(assi[0].x * scala, assi[0].y * scala, assi[0].z * scala));
  const b = cam.d(cosmVettore(assi[1].x * scala, assi[1].y * scala, assi[1].z * scala));
  const o = cam.p(centro);
  if (!Number.isFinite(a.x + b.x + o.x + o.y)) return;
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.transform(a.x, a.y, b.x, b.y, o.x - (a.x + b.x) * N / 2, o.y - (a.y + b.y) * N / 2);
  ctx.drawImage(sprite, 0, 0);
  ctx.restore();
}

function cosmDisegnaGalassia(ctx, cam) {
  const s = COSM_PER_ID.get('viaLattea');
  const rpx = s.r * cam.s;
  // Compare già come una spiralina di pochi pixel (il «noi» del Gruppo
  // Locale), e se ne va quando la sprite comincerebbe a vedersi a quadretti:
  // da lì in giù il braccio di Orione ha le sue stelle, disegnate una per una
  const alfa = cosmVisibilita(rpx, cam.lato, 1.2, 18) * (1 - cosmLiscia(900, 2600, rpx));
  if (alfa < 0.02) return 0;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Lo sprite ha il nord galattico verso chi guarda: a destra −y, in basso −x
  // Sotto gli otto pixel la spirale si disegna di otto pixel: alla scala
  // del Gruppo Locale è un segno, come Andromeda accanto, e non un granello
  const raggio = Math.max(50000 * COSM_AL, 8 / cam.s) * (512 / 500);
  cosmDisegnaSpritePiano(ctx, cam, cosmSpriteViaLattea(), COSM_CENTRO_GAL, raggio,
    [cosmVettore(0, -1, 0), cosmVettore(-1, 0, 0)], Math.min(1, alfa * 1.1));
  const c = cam.p(COSM_CENTRO_GAL);
  if (rpx > 40) cosmNomeStruttura(ctx, cam, 'viaLattea', c.x, c.y - rpx * 1.04, alfa, 0);
  return alfa;
}

// Il braccio di Orione: una striscia larga tremilacinquecento anni luce e
// lunga diecimila, sulla spirale col passo dei bracci veri
function cosmDisegnaBraccio(ctx, cam) {
  const rpx = 5000 * COSM_AL * cam.s;
  const alfa = cosmVisibilita(rpx, cam.lato, 6, 7);
  if (alfa < 0.02) return 0;
  const centro = (psi, dr) => {
    const r = 26300 * Math.exp(COSM_PASSO_BRACCI * (psi - Math.PI)) + dr;
    return cosmVettore(COSM_CENTRO_GAL.x + r * COSM_AL * Math.cos(psi), r * COSM_AL * Math.sin(psi), 0);
  };
  const da = Math.PI - 0.17, a = Math.PI + 0.21;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) { const p = cam.p(centro(da + (a - da) * i / 40, -1750)); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
  for (let i = 40; i >= 0; i--) { const p = cam.p(centro(da + (a - da) * i / 40, 1750)); ctx.lineTo(p.x, p.y); }
  ctx.closePath();
  // Il bagliore del braccio: più fitto lungo la sua spina, sfumato ai bordi
  const m = cam.p(centro(Math.PI + 0.02, 0)), b = cam.p(centro(Math.PI + 0.02, 1750));
  const largo = Math.hypot(b.x - m.x, b.y - m.y) || 1;
  const bagliore = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, largo * 3.2);
  bagliore.addColorStop(0, `rgba(170,190,250,${0.2 * alfa})`);
  bagliore.addColorStop(0.5, `rgba(150,170,240,${0.1 * alfa})`);
  bagliore.addColorStop(1, 'rgba(150,170,240,0)');
  ctx.fillStyle = bagliore; ctx.fill();
  ctx.strokeStyle = `rgba(165,180,252,${0.5 * alfa})`; ctx.lineWidth = 1.1;
  ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
  // Le stelle, una per una: un braccio è fatto di stelle, più fitte al
  // centro della sua larghezza, con qualche gigante blu e qualche nube rosa
  // d'idrogeno acceso — è lì che nascono, e sono loro a disegnare la spirale
  const d = cosmDado(41);
  const livelli = [new Path2D(), new Path2D(), new Path2D()];
  const rosa = new Path2D();
  for (let i = 0; i < 1400; i++) {
    const t = d(), w = Math.max(-1, Math.min(1, cosmGauss(d) * 0.45));
    const p = cam.p(centro(da + (a - da) * t, w * 1750));
    if (p.x < -6 || p.y < -6 || p.x > cam.W + 6 || p.y > cam.H + 6) { d(); d(); continue; }
    const k = d(), lum = d();
    if (k < 0.025) { const r = 2.4 + lum * 2.6; rosa.moveTo(p.x + r, p.y); rosa.arc(p.x, p.y, r, 0, Math.PI * 2); continue; }
    const liv = lum < 0.62 ? 0 : lum < 0.92 ? 1 : 2;
    const r = 0.6 + liv * 0.55;
    livelli[liv].rect(p.x - r, p.y - r, r * 2, r * 2);
  }
  ctx.fillStyle = `rgba(255,140,190,${0.42 * alfa})`; ctx.fill(rosa);
  [['226,232,255', 0.45], ['210,225,255', 0.7], ['190,215,255', 0.95]].forEach(([c, k], i) => {
    ctx.fillStyle = `rgba(${c},${k * alfa})`; ctx.fill(livelli[i]);
  });
  const p = cam.p(centro(Math.PI + 0.13, -1900));
  cosmNomeStruttura(ctx, cam, 'braccioOrione', p.x, p.y, alfa, 0);
  return alfa;
}

function cosmDisegnaBolle(ctx, cam) {
  // La Nube Interstellare Locale: il gas tiepido in cui il Sole sta
  // navigando adesso, col bordo a un paio di anni luce
  [['mezzoLocale', COSM_CENTRO_LIC, 13 * COSM_AL, 'rgba(125,211,252,', 21],
    ['bollaLocale', COSM_CENTRO_BOLLA, 500 * COSM_AL, 'rgba(251,146,60,', 23]].forEach(([id, centro, r, colore, seme]) => {
    const rpx = r * cam.s;
    const alfa = cosmVisibilita(rpx, cam.lato, 6, 7);
    if (alfa < 0.02) return;
    const forma = cosmSagoma(id, 5, seme);
    cosmTracciaSagoma(ctx, cam, centro, r, forma, COSM_ASSI_GAL);
    const c = cam.p(centro);
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rpx * 1.2);
    g.addColorStop(0, colore + (0.03 * alfa) + ')');
    g.addColorStop(0.75, colore + (0.1 * alfa) + ')');
    g.addColorStop(1, colore + (0.22 * alfa) + ')');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = colore + (0.75 * alfa) + ')'; ctx.lineWidth = id === 'bollaLocale' ? 2.2 : 1.4;
    ctx.stroke();
    cosmNomeStruttura(ctx, cam, id, c.x, c.y - rpx * 1.02, alfa, 4);
  });
}

function cosmDisegnaOort(ctx, cam) {
  const rpx = 100000 * cam.s;
  const alfa = cosmVisibilita(rpx, cam.lato, 6, 9);
  if (alfa < 0.02) return 0;
  const sole = cam.p(cosmVettore(0, 0, 0));
  const g = ctx.createRadialGradient(sole.x, sole.y, 0, sole.x, sole.y, rpx);
  g.addColorStop(0, `rgba(148,163,184,${0.1 * alfa})`);
  g.addColorStop(0.3, `rgba(148,163,184,${0.06 * alfa})`);
  g.addColorStop(1, 'rgba(148,163,184,0)');
  ctx.fillStyle = g;
  cosmPercorsoCerchio(ctx, sole.x, sole.y, rpx); ctx.fill();
  cosmDisegnaNuvola(ctx, cam, 'oort', 'rgba(203,213,225,1)', alfa * 0.6, 1.3);
  if (cosmCerchioUtile(sole.x, sole.y, rpx, cam.W, cam.H)) {
    ctx.setLineDash([3, 6]); ctx.strokeStyle = `rgba(203,213,225,${0.45 * alfa})`; ctx.lineWidth = 1;
    cosmPercorsoCerchio(ctx, sole.x, sole.y, rpx); ctx.stroke();
    cosmPercorsoCerchio(ctx, sole.x, sole.y, 1000 * cam.s); ctx.stroke();
    ctx.setLineDash([]);
  }
  cosmNomeStruttura(ctx, cam, 'oort', sole.x, sole.y - rpx * 1.02, alfa, 4);
  if (1000 * cam.s > 26) {
    ctx.globalAlpha = alfa * 0.85;
    cosmScritta(ctx, cosmT('cosmo.etichetta.oortDentro'), sole.x, sole.y + 1000 * cam.s + 12, 'rgba(203,213,225,0.9)', 10.5);
    ctx.globalAlpha = 1;
  }
  return alfa;
}

function cosmDisegnaKuiper(ctx, cam) {
  const rpx = 50 * cam.s;
  const alfa = cosmVisibilita(rpx, cam.lato, 5, 22);
  if (alfa < 0.02) return 0;
  const sole = cam.p(cosmVettore(0, 0, 0));
  // Il bagliore dell'anello, appena accennato: vista dall'alto con la camera
  // dritta è una corona; inclinata resta un velo che non mente sulla forma,
  // perché i punti sopra disegnano l'anello vero
  if (rpx < 4e5 && cosm.elev > 55) {
    const g = ctx.createRadialGradient(sole.x, sole.y, 34 * cam.s, sole.x, sole.y, 56 * cam.s);
    g.addColorStop(0, 'rgba(150,170,220,0)');
    g.addColorStop(0.35, `rgba(150,170,220,${0.07 * alfa})`);
    g.addColorStop(0.62, `rgba(150,170,220,${0.05 * alfa})`);
    g.addColorStop(1, 'rgba(150,170,220,0)');
    ctx.fillStyle = g;
    cosmPercorsoCerchio(ctx, sole.x, sole.y, 56 * cam.s); ctx.fill();
  }
  cosmDisegnaNuvola(ctx, cam, 'kuiper', 'rgba(196,210,240,1)', alfa * 0.85, 1.5);
  if (rpx > 30) cosmNomeStruttura(ctx, cam, 'kuiper', sole.x, sole.y + rpx + 14, alfa, 0);
  return alfa;
}

function cosmDisegnaGruppoLocale(ctx, cam) {
  const s = COSM_PER_ID.get('gruppoLocale');
  const rpx = s.r * cam.s;
  const alfa = cosmVisibilita(rpx, cam.lato, 5, 9);
  if (alfa < 0.02) return 0;
  cosmDisegnaNuvola(ctx, cam, 'nane', 'rgba(221,214,254,1)', alfa * 0.85, 2.2);
  const c = cam.p(COSM_BARICENTRO_LG);
  if (cosmCerchioUtile(c.x, c.y, rpx, cam.W, cam.H)) {
    ctx.strokeStyle = `rgba(196,181,253,${0.6 * alfa})`; ctx.setLineDash([7, 6]); ctx.lineWidth = 1.3;
    cosmPercorsoCerchio(ctx, c.x, c.y, rpx); ctx.stroke(); ctx.setLineDash([]);
  }
  cosmNomeStruttura(ctx, cam, 'gruppoLocale', c.x, c.y - rpx * 1.03, alfa, 4);
  return alfa;
}

function cosmDisegnaVergine(ctx, cam) {
  const s = COSM_PER_ID.get('vergine');
  const rpx = s.r * cam.s;
  const alfa = cosmVisibilita(rpx, cam.lato, 5, 8);
  if (alfa < 0.02) return 0;
  cosmDisegnaNuvola(ctx, cam, 'vergine', 'rgba(253,230,190,1)', alfa * 0.8, 1.7);
  cosmTracciaSagoma(ctx, cam, COSM_VERGINE, s.r, cosmSagoma('vergine', 4, 27), COSM_ASSI_SG);
  ctx.strokeStyle = `rgba(253,224,171,${0.55 * alfa})`; ctx.setLineDash([7, 6]); ctx.lineWidth = 1.3;
  ctx.stroke(); ctx.setLineDash([]);
  const c = cam.p(COSM_VERGINE);
  cosmNomeStruttura(ctx, cam, 'vergine', c.x, c.y - rpx * 1.08, alfa, 4);
  return alfa;
}

// Laniakea è definito dal **moto** delle galassie: tutte quelle qui dentro
// scorrono verso il Grande Attrattore. Le frecce dicono quello, la forma il
// confine dove i flussi si separano.
function cosmDisegnaLaniakea(ctx, cam) {
  const s = COSM_PER_ID.get('laniakea');
  const rpx = s.r * cam.s;
  const alfa = cosmVisibilita(rpx, cam.lato, 5, 8);
  if (alfa < 0.02) return 0;
  cosmDisegnaNuvola(ctx, cam, 'laniakea', 'rgba(253,230,200,1)', alfa * 0.65, 1.5);
  const forma = cosmSagoma('laniakea', 6, 29);
  cosmTracciaSagoma(ctx, cam, COSM_GRANDE_ATTRATTORE, s.r, forma, COSM_ASSI_SG);
  ctx.fillStyle = `rgba(251,191,36,${0.05 * alfa})`; ctx.fill();
  ctx.strokeStyle = `rgba(251,191,36,${0.7 * alfa})`; ctx.lineWidth = 1.6; ctx.stroke();
  const c = cam.p(COSM_GRANDE_ATTRATTORE);
  ctx.strokeStyle = `rgba(253,224,171,${0.45 * alfa})`; ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + 0.2;
    const rr = s.r * forma(a) * 0.86;
    const v = cosmVettore(
      COSM_GRANDE_ATTRATTORE.x + (COSM_SG_X.x * Math.cos(a) + COSM_SG_Y.x * Math.sin(a)) * rr,
      COSM_GRANDE_ATTRATTORE.y + (COSM_SG_X.y * Math.cos(a) + COSM_SG_Y.y * Math.sin(a)) * rr,
      COSM_GRANDE_ATTRATTORE.z + (COSM_SG_X.z * Math.cos(a) + COSM_SG_Y.z * Math.sin(a)) * rr);
    const p = cam.p(v);
    const mx = p.x + (c.x - p.x) * 0.45, my = p.y + (c.y - p.y) * 0.45;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mx, my);
    const pa = Math.atan2(my - p.y, mx - p.x);
    ctx.lineTo(mx - 6 * Math.cos(pa - 0.5), my - 6 * Math.sin(pa - 0.5));
    ctx.moveTo(mx, my); ctx.lineTo(mx - 6 * Math.cos(pa + 0.5), my - 6 * Math.sin(pa + 0.5));
    ctx.stroke();
  }
  cosmNomeStruttura(ctx, cam, 'laniakea', c.x, c.y - rpx * 1.1, alfa, 4);
  return alfa;
}

function cosmDisegnaUniverso(ctx, cam) {
  const s = COSM_PER_ID.get('universo');
  const rpx = s.r * cam.s;
  const alfa = cosmVisibilita(rpx, cam.lato, 6, 7);
  if (alfa < 0.02) return 0;
  const c = cam.p(cosmVettore(0, 0, 0));
  // La ragnatela, illustrativa, che si accende man mano che ci si allontana
  const web = cosmSpriteRagnatela();
  const luceWeb = alfa * cosmLiscia(13.8, 14.8, cam.L);
  if (web && luceWeb > 0.01) {
    // Solo il pezzo che cade sullo schermo: chiedere al canvas di stendere
    // un'immagine larga seimila pixel per vederne mille costa mezzo secondo
    const k = web.width / (rpx * 2);
    const x0 = Math.max(0, c.x - rpx), y0 = Math.max(0, c.y - rpx);
    const x1 = Math.min(cam.W, c.x + rpx), y1 = Math.min(cam.H, c.y + rpx);
    if (x1 > x0 && y1 > y0) {
      ctx.save();
      ctx.globalAlpha = luceWeb;
      ctx.imageSmoothingQuality = 'low';
      ctx.drawImage(web, (x0 - (c.x - rpx)) * k, (y0 - (c.y - rpx)) * k, (x1 - x0) * k, (y1 - y0) * k, x0, y0, x1 - x0, y1 - y0);
      ctx.restore();
    }
  }
  // Il fondo cosmico: un anello caldo sul bordo
  if (rpx < 4e6) {
    // Un gradiente che parte dal centro, con le fermate tutte sul bordo: la
    // forma a due cerchi sarebbe la stessa cosa, ma è un altro programma per
    // la scheda grafica, e compilarlo la prima volta costa un fotogramma
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rpx * 1.04);
    g.addColorStop(0, 'rgba(251,146,60,0)');
    g.addColorStop(0.865, 'rgba(251,146,60,0)');
    g.addColorStop(0.962, `rgba(251,146,60,${0.38 * alfa})`);
    g.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = g;
    cosmPercorsoCerchio(ctx, c.x, c.y, rpx * 1.04); ctx.fill();
    ctx.strokeStyle = `rgba(253,186,116,${0.8 * alfa})`; ctx.lineWidth = 1.6;
    cosmPercorsoCerchio(ctx, c.x, c.y, rpx); ctx.stroke();
    if (rpx > 60) {
      ctx.globalAlpha = alfa;
      cosmScritta(ctx, cosmT('cosmo.etichetta.fondo'), c.x, c.y + rpx + 14, '#fdba74', 10.5);
      ctx.globalAlpha = 1;
    }
  }
  cosmNomeStruttura(ctx, cam, 'universo', c.x, c.y - rpx - 8, alfa, 14);
  return alfa;
}

// I segni con un nome: stelle vicine, nebulose, galassie
function cosmDisegnaSegni(ctx, cam) {
  cosm.schermo.segni = [];
  COSM_SEGNI.forEach(sg => {
    const alfa = Math.min(cosmLiscia(sg.minL, sg.minL + 0.4, cam.L), 1 - cosmLiscia(sg.maxL - 0.4, sg.maxL, cam.L));
    if (alfa < 0.03) return;
    const p = cam.p(sg.v);
    if (p.x < -50 || p.y < -50 || p.x > cam.W + 50 || p.y > cam.H + 50) return;
    ctx.globalAlpha = alfa;
    if (sg.galassia) {
      // Come la Via Lattea, una galassia del gruppo resta un segno leggibile
      // anche quando la sua misura vera è di pochi pixel
      const rpx = Math.max(sg.galassia * cam.s, sg.galassia > 50000 * COSM_AL ? 9 : 6);
      if (rpx > 2.5) {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate((sg.gira || 0) * COSM_D2R); ctx.scale(1, sg.inclina || 0.75);
        const sp = cosmSpriteGalassia();
        if (sp) ctx.drawImage(sp, -rpx, -rpx, rpx * 2, rpx * 2);
        ctx.restore();
      } else {
        ctx.fillStyle = sg.colore; cosmPercorsoCerchio(ctx, p.x, p.y, 2.4); ctx.fill();
      }
    } else {
      ctx.fillStyle = sg.colore;
      cosmPercorsoCerchio(ctx, p.x, p.y, sg.stella ? 2.6 : 3.2); ctx.fill();
      if (sg.stella) {
        ctx.strokeStyle = sg.colore; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(p.x - 6, p.y); ctx.lineTo(p.x + 6, p.y); ctx.moveTo(p.x, p.y - 6); ctx.lineTo(p.x, p.y + 6); ctx.stroke();
      }
    }
    cosmScritta(ctx, cosmT(`cosmo.etichetta.${sg.id}`), p.x, p.y + 14 + (sg.galassia ? Math.min(30, sg.galassia * cam.s * 0.6) : 0), sg.colore, 11);
    ctx.globalAlpha = 1;
    cosm.schermo.segni.push({ id: sg.id, x: p.x, y: p.y });
  });
}

// Il Sole, e quando non si vede più un disco il «sei qui». Da vicino (v404)
// è un disco alla sua misura vera, con la granulazione della vista 3D e la
// corona attorno.
function cosmDisegnaSole(ctx, cam) {
  const p = cam.p(cosmVettore(0, 0, 0));
  const rVero = COSM_SOLE_R_UA * cam.s;
  if (rVero > 4.5 && rVero < 4e5) {
    if (!cosmSulloSchermo(p, cam, rVero * 3)) return;
    const corona = ctx.createRadialGradient(p.x, p.y, rVero * 0.9, p.x, p.y, rVero * 3);
    corona.addColorStop(0, 'rgba(255,236,170,0.55)');
    corona.addColorStop(0.35, 'rgba(253,200,90,0.16)');
    corona.addColorStop(1, 'rgba(253,190,80,0)');
    ctx.fillStyle = corona; cosmPercorsoCerchio(ctx, p.x, p.y, rVero * 3); ctx.fill();
    const faccia = typeof skyFacciaDi === 'function' && rVero <= 2048 ? skyFacciaDi({ id: 'Sun' }, rVero) : null;
    if (faccia) ctx.drawImage(faccia, p.x - rVero, p.y - rVero, rVero * 2, rVero * 2);
    else {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rVero);
      g.addColorStop(0, '#fffbe6'); g.addColorStop(0.7, '#fde047'); g.addColorStop(1, '#f59e0b');
      ctx.fillStyle = g; cosmPercorsoCerchio(ctx, p.x, p.y, rVero); ctx.fill();
    }
    cosmScritta(ctx, cosmT('cosmo.etichetta.sole'), p.x, p.y + rVero + 14, '#fde68a', 12, 'center', 650);
    return;
  }
  if (!cosmSulloSchermo(p, cam, 30)) return;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 11);
  g.addColorStop(0, 'rgba(255,250,220,1)');
  g.addColorStop(0.3, 'rgba(253,224,71,0.9)');
  g.addColorStop(1, 'rgba(253,224,71,0)');
  ctx.fillStyle = g; cosmPercorsoCerchio(ctx, p.x, p.y, 11); ctx.fill();
  if (cam.L < 3.6) cosmScritta(ctx, cosmT('cosmo.etichetta.sole'), p.x, p.y + 17, '#fde68a', 11);
  else if (cam.L > 5.6) {
    ctx.strokeStyle = 'rgba(253,224,71,0.8)'; ctx.lineWidth = 1;
    // In alto a sinistra: in alto a destra, alla scala delle stelle vicine,
    // c'è Alfa Centauri col suo nome
    ctx.beginPath(); ctx.moveTo(p.x - 6, p.y - 6); ctx.lineTo(p.x - 20, p.y - 20); ctx.stroke();
    cosmScritta(ctx, cosmT('cosmo.etichetta.seiQui'), p.x - 22, p.y - 26, '#fde68a', 11, 'right', 650);
  }
}

// --- Le letture sul bordo: il piano, la riga del metro, l'anno -------------

// Un metro tondo: 1, 2 o 5 per una potenza di dieci, nell'unità giusta
function cosmMetro(cam) {
  const voluto = cam.W * 0.18 / cam.s; // UA
  const al = voluto / COSM_UA_AL;
  let unita, scala;
  if (voluto < 0.02) { unita = 'km'; scala = 1 / COSM_KM_UA; }
  else if (al < 0.05) { unita = 'ua'; scala = 1; }
  else if (al < 1e6) { unita = 'al'; scala = COSM_UA_AL; }
  else if (al < 1e9) { unita = 'mal'; scala = COSM_UA_AL * 1e6; }
  else { unita = 'gal'; scala = COSM_UA_AL * 1e9; }
  const v = voluto / scala;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / e >= 5 ? 5 : v / e >= 2 ? 2 : 1;
  const n = m * e;
  return { px: n * scala * cam.s, testo: cosmT(`cosmo.unita.${unita}`, { n: cosmNum(n, n < 1 ? (n < 0.1 ? 2 : 1) : 0), count: n }) };
}

function cosmDisegnaLetture(ctx, cam) {
  const W = cam.W;
  // La didascalia del piano
  const pesi = cam.pesi;
  const piano = pesi.sg > 0.5 ? 'supergalattico' : pesi.gal > 0.5 ? 'galattico' : pesi.sonde > 0.5 ? 'sonde' : 'eclittica';
  // Durante una demo la riga della scala sta in cima (in fondo ci sono i
  // sottotitoli, a sinistra il cartello): la didascalia e il metro le
  // stanno sotto, a destra
  const regia = cosm.regia;
  // Su uno schermo stretto in cima ci sono le viste e i comandi: la
  // didascalia e il metro scendono sopra alla riga della scala
  const stretto = !regia && W < 560;
  const yTop = regia ? (cosm.rigaY || 26) + 36 : stretto ? cam.H - (cosm.fondoPx || 100) - 84 : 22;
  const xc = regia ? W - 20 - 70 : W / 2;
  ctx.globalAlpha = 0.92;
  cosmScritta(ctx, cosmT(`cosmo.piano.${piano}`), regia ? W - 20 : xc, yTop, 'rgba(203,213,225,0.95)', 11, regia ? 'right' : 'center');
  // Il metro
  const m = cosmMetro(cam);
  const x0 = xc - m.px / 2, y = yTop + 18;
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x0, y - 4); ctx.lineTo(x0, y + 4); ctx.moveTo(x0, y); ctx.lineTo(x0 + m.px, y);
  ctx.moveTo(x0 + m.px, y - 4); ctx.lineTo(x0 + m.px, y + 4); ctx.stroke();
  cosmScritta(ctx, m.testo, xc, y + 13, '#e2e8f0', 11, 'center', 600);
  ctx.globalAlpha = 1;
}

/* La riga della scala, in fondo: un asse logaritmico dalla Terra (v404) al
 * diametro dell'universo osservabile, con una tacca per ogni tappa e un segno
 * solo, dove sta la vista adesso. Le Voyager qui non ci sono più (v401): la
 * riga parla di scale, e la sonda segnata a ogni scala era un'etichetta che
 * non si poteva togliere. Si tocca per volare a una tappa, e si **trascina**
 * per scorrere la scala col dito (v404): è il modo più diretto di dire
 * «più in là» quando le decade sono venti. */
const COSM_RIGA_DA = COSM_L_MIN, COSM_RIGA_A = 15.6;
function cosmDisegnaRiga(ctx, cam) {
  const W = cam.W;
  const destra = cosm.regia ? 18 : 64;
  const x0 = 18, x1 = W - destra;
  if (x1 - x0 < 160) { cosm.schermo.riga = null; return; }
  const y = cosm.regia ? (cosm.rigaY || 26) : cam.H - (cosm.fondoPx || 100) - 22;
  const X = l => x0 + (x1 - x0) * (l - COSM_RIGA_DA) / (COSM_RIGA_A - COSM_RIGA_DA);
  cosm.schermo.riga = { x0, x1, y, X, Linv: x => COSM_RIGA_DA + (x - x0) / (x1 - x0) * (COSM_RIGA_A - COSM_RIGA_DA) };
  ctx.fillStyle = 'rgba(5,9,22,0.55)';
  ctx.fillRect(x0 - 8, y - 22, x1 - x0 + 16, 44);
  ctx.strokeStyle = 'rgba(148,163,184,0.7)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  // Le tacche delle strutture, col loro nome breve sopra o sotto a turno
  const vicina = cosmStrutturaDellaScala(cam.L);
  COSM_STRUTTURE.forEach((s, i) => {
    // La tacca sta dove la tappa si inquadra: arrivandoci, il segno della
    // vista le si posa sopra
    const x = X(Math.log10(s.vista));
    const evid = vicina && vicina.id === s.id;
    ctx.strokeStyle = evid ? '#fde68a' : 'rgba(203,213,225,0.7)';
    ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke();
    if (evid || (x1 - x0) > 560) {
      ctx.globalAlpha = evid ? 1 : 0.7;
      const testo = cosmT(`cosmo.${s.id}.corto`);
      ctx.font = cosmCarattere(evid ? 10.5 : 9.5, evid ? 650 : 500);
      const mezzo = ctx.measureText(testo).width / 2 + 2;
      const xt = Math.max(x0 + mezzo - 6, Math.min(x1 - mezzo + 6, x));
      cosmScritta(ctx, testo, xt, i % 2 ? y + 13 : y - 13, evid ? '#fde68a' : '#cbd5e1', evid ? 10.5 : 9.5, 'center', evid ? 650 : 500);
      ctx.globalAlpha = 1;
    }
  });
  // La vista
  const xv = X(cam.L);
  ctx.fillStyle = '#93c5fd';
  ctx.beginPath(); ctx.moveTo(xv, y - 3); ctx.lineTo(xv - 5, y - 11); ctx.lineTo(xv + 5, y - 11); ctx.closePath(); ctx.fill();
}

// Quale struttura descrive meglio la scala di adesso
function cosmStrutturaDellaScala(L) {
  let migliore = null, scarto = Infinity;
  COSM_STRUTTURE.forEach(s => {
    const d = Math.abs(Math.log10(s.vista) - L);
    if (d < scarto) { scarto = d; migliore = s; }
  });
  return scarto < 1.1 ? migliore : null;
}

// --- Il fotogramma ----------------------------------------------------------
function cosmDisegna(ctx) {
  if (!ctx || typeof sol === 'undefined') return;
  const ora = performance.now();
  // Un istante solo per tutto il fotogramma: la Terra al centro e la Terra
  // disegnata devono essere la stessa Terra
  cosm.msFotogramma = cosmIstante();
  if (!cosm.cam) cosm.cam = cosmCamera(cosm.L, sol.L, sol.H);
  cosmPassoCamera(ora);
  cosm.ultimoTs = ora;
  if (!cosm.attivo) return;
  if (typeof solSfondo === 'function') solSfondo(ctx);
  else { ctx.fillStyle = '#04060f'; ctx.fillRect(0, 0, sol.L, sol.H); }
  const cam = cosmCamera(cosm.L, sol.L, sol.H);
  cosm.cam = cam;
  cosmMisuraFondo();
  // Dal più grande al più piccolo: chi sta sopra è quello che si è venuti
  // a vedere
  cosmDisegnaUniverso(ctx, cam);
  cosmDisegnaLaniakea(ctx, cam);
  cosmDisegnaVergine(ctx, cam);
  cosmDisegnaGruppoLocale(ctx, cam);
  cosmDisegnaGalassia(ctx, cam);
  cosmDisegnaBraccio(ctx, cam);
  cosmDisegnaBolle(ctx, cam);
  cosmDisegnaOort(ctx, cam);
  cosmDisegnaEliosfera(ctx, cam);
  cosmDisegnaKuiper(ctx, cam);
  cosmDisegnaSole(ctx, cam);
  cosmDisegnaSistemaVicino(ctx, cam);
  cosmDisegnaSegni(ctx, cam);
  cosmDisegnaSonde(ctx, cam);
  cosmDisegnaLetture(ctx, cam);
  cosmDisegnaRiga(ctx, cam);
  if (cosm.ui && ora > (cosm.prossimaUi || 0)) {
    cosm.prossimaUi = ora + 300;
    cosmAggiornaInterfaccia();
  }
}

// Quanto spazio lasciano in fondo la barra del tempo e la fila dei tasti
// della scala: si legge dalla pagina due volte al secondo, non a ogni
// fotogramma (getBoundingClientRect forza l'impaginazione)
function cosmMisuraFondo() {
  const ora = performance.now();
  if (ora < (cosm.prossimaMisura || 0)) return;
  cosm.prossimaMisura = ora + 500;
  let fondo = (typeof sol !== 'undefined' && sol.altaBarra) || 70;
  const fila = cosm.ui && cosm.ui.fila;
  if (fila && !cosm.regia && sol.canvas && fila.offsetParent) {
    const t = sol.canvas.getBoundingClientRect(), r = fila.getBoundingClientRect();
    if (r.height) fondo = Math.max(fondo, t.bottom - r.top + 4);
  }
  cosm.fondoPx = fondo;
  // In una demo la riga sta in cima, ma sotto al cartello della data se il
  // cartello le cade sopra (è appoggiato alla pagina, non alla tela)
  let riga = 26;
  const cartello = typeof document !== 'undefined' ? document.getElementById('demo-cartello') : null;
  if (cosm.regia && cartello && sol.canvas) {
    const t = sol.canvas.getBoundingClientRect(), r = cartello.getBoundingClientRect();
    if (r.height && r.bottom > t.top && r.top < t.top + 60) riga = Math.max(riga, r.bottom - t.top + 26);
  }
  cosm.rigaY = riga;
}

// =====================================================================
// 9. L'interfaccia: la fila delle scale, la scheda, la manopola del futuro
// =====================================================================

function cosmPreparaInterfaccia() {
  if (cosm.ui || typeof document === 'undefined') return cosm.ui;
  const guscio = document.getElementById('sol-guscio');
  if (!guscio) return null;
  const radice = document.createElement('div');
  radice.id = 'cosm-interfaccia';
  radice.className = 'cosm-interfaccia';
  radice.hidden = true;
  const fila = document.createElement('nav');
  fila.className = 'cosm-fila';
  fila.id = 'cosm-fila';
  const scheda = document.createElement('aside');
  scheda.className = 'cosm-scheda';
  scheda.id = 'cosm-scheda';
  scheda.hidden = true;
  scheda.setAttribute('aria-live', 'polite');
  const aiuto = document.createElement('p');
  aiuto.className = 'cosm-aiuto';
  aiuto.textContent = cosmT('cosmo.aiuto');
  radice.append(aiuto, scheda, fila);
  guscio.append(radice);
  cosm.ui = { radice, fila, scheda, aiuto, firmaScheda: '' };
  cosmScriviFila();
  fila.addEventListener('click', e => {
    const b = e.target.closest('[data-cosm-vai]');
    if (!b) return;
    const id = b.dataset.cosmVai;
    cosmScegli(id); cosmVolaA(cosmLDi(id));
  });
  scheda.addEventListener('click', e => {
    const b = e.target.closest('[data-cosm-azione]');
    if (!b) return;
    const azione = b.dataset.cosmAzione;
    if (azione === 'chiudi') cosmChiudiScheda();
    else if (azione === 'vai' && cosm.scelta) cosmVolaA(cosmLDi(cosm.scelta.id));
  });
  return cosm.ui;
}

function cosmScriviFila() {
  if (!cosm.ui) return;
  // Le sole strutture: «Voyager oggi» non è una scala, e in questa fila
  // stava come se lo fosse (v401). Le sonde si toccano sulla carta.
  const voci = COSM_STRUTTURE.map(s => ({ id: s.id, nome: cosmT(`cosmo.${s.id}.nome`) }));
  cosm.ui.fila.setAttribute('aria-label', cosmT('cosmo.fila'));
  cosm.ui.fila.innerHTML = voci.map(v =>
    `<button type="button" class="cosm-tasto" data-cosm-vai="${v.id}" aria-pressed="false">${cosmEsc(v.nome)}</button>`).join('');
}

function cosmEsc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function cosmAggiornaInterfaccia() {
  const ui = cosm.ui;
  if (!ui) return;
  const vicina = cosmStrutturaDellaScala(cosm.L);
  ui.fila.querySelectorAll('[data-cosm-vai]').forEach(b => {
    const attivo = vicina && vicina.id === b.dataset.cosmVai;
    if (b.classList.contains('attiva') !== !!attivo) {
      b.classList.toggle('attiva', !!attivo);
      b.setAttribute('aria-pressed', attivo ? 'true' : 'false');
      if (attivo && b.scrollIntoView && !cosm.regia) {
        const r = b.getBoundingClientRect(), f = ui.fila.getBoundingClientRect();
        if (r.left < f.left || r.right > f.right) ui.fila.scrollLeft += r.left - f.left - (f.width - r.width) / 2;
      }
    }
  });
  if (!ui.scheda.hidden) cosmScriviScheda(false);
}

// La scheda di una struttura: misura, distanza, quanto ci mette la luce, e
// quanto ci metterebbe Voyager 1 — è la riga che toglie ogni illusione
function cosmSchedaStruttura(id) {
  const s = COSM_PER_ID.get(id);
  if (!s) return '';
  const v1 = cosmDatiSonda('voyager1');
  const kmsV1 = v1 ? v1.kms : 17;
  const uaAnnoV1 = kmsV1 * COSM_ANNO_MS / 1000 / COSM_KM_UA;
  const diam = s.r * 2;
  const centro = cosmCentroDi(s);
  const distanza = centro ? Math.hypot(centro.x, centro.y, centro.z) : 0;
  // Le strutture attorno al Sole si misurano dal Sole (fin dove arrivano, e
  // quanto ci mettono la luce e la sonda ad arrivarci); le altre per il
  // diametro. Oltre il Gruppo Locale lo spazio si espande: lì la sonda non
  // arriverà mai, e dirle un tempo sarebbe una bugia.
  // La Terra e la Luna (v404) si misurano da qui: quanto è grande la Terra e
  // quanto è lontano il Sole, quanto è lontana adesso la Luna
  const corpi = s.vicino ? cosmCorpiOra() : null;
  const dLuna = corpi ? Math.hypot(corpi.luna.x, corpi.luna.y, corpi.luna.z) : COSM_LUNA_ORBITA_UA;
  const righe = s.id === 'terra' ? [
    [cosmT('cosmo.scheda.misura'), cosmTestoDistanza(diam)],
    [cosmT('cosmo.scheda.distanza'), cosmTestoDistanza(distanza || 1)],
    [cosmT('cosmo.scheda.luceDalSole'), cosmTestoLuce(distanza || 1)],
    [cosmT('cosmo.scheda.voyager'), cosmTestoAnni(diam / uaAnnoV1)]
  ] : s.id === 'terraLuna' ? [
    [cosmT('cosmo.scheda.lunaOra'), cosmTestoDistanza(dLuna)],
    [cosmT('cosmo.scheda.luceArriva'), cosmTestoLuce(dLuna)],
    [cosmT('cosmo.scheda.voyagerArriva'), cosmTestoAnni(dLuna / uaAnnoV1)]
  ] : s.raggio ? [
    [cosmT('cosmo.scheda.finoA'), cosmTestoDistanza(s.r)],
    [cosmT('cosmo.scheda.luceArriva'), cosmTestoAnni(s.r / COSM_UA_AL)],
    [cosmT('cosmo.scheda.voyagerArriva'), cosmTestoAnni(s.r / uaAnnoV1)]
  ] : [
    [cosmT('cosmo.scheda.misura'), cosmTestoDistanza(diam)],
    [cosmT('cosmo.scheda.distanza'), s.centro ? cosmTestoDistanza(distanza) : cosmT('cosmo.scheda.noi')],
    [cosmT('cosmo.scheda.luce'), cosmTestoAnni(diam / COSM_UA_AL)],
    [cosmT('cosmo.scheda.voyager'), s.mai ? cosmT('cosmo.scheda.mai') : cosmTestoAnni(diam / uaAnnoV1)]
  ];
  return `<div class="cosm-scheda-testa"><h3>${cosmEsc(cosmT(`cosmo.${id}.nome`))}</h3>` +
    `<button type="button" class="tasto-chiudi-dettaglio" data-cosm-azione="chiudi" aria-label="${cosmEsc(cosmT('cosmo.scheda.chiudi'))}">✕</button></div>` +
    `<dl class="cosm-dati">${righe.map(([a, b]) => `<dt>${cosmEsc(a)}</dt><dd>${cosmEsc(b)}</dd>`).join('')}</dl>` +
    `<p class="cosm-testo">${cosmEsc(cosmT(`cosmo.${id}.testo`))}</p>` +
    `<button type="button" class="tasto-cielo cosm-vai" data-cosm-azione="vai">${cosmEsc(cosmT('cosmo.scheda.vai'))}</button>`;
}

function cosmSchedaSonde() {
  // Le sonde al loro posto di oggi, e le tappe del viaggio come elenco da
  // leggere: niente manopola del futuro (v401), la carta mostra solo adesso
  const ms = Date.now();
  const righe = ['voyager1', 'voyager2'].map(id => cosmMisuraSonda(id, ms)).filter(Boolean).map(m =>
    `<div class="cosm-sonda" style="--colore-sonda:${m.colore}"><strong>${cosmEsc(m.nome)}</strong>` +
    `<span>${cosmEsc(cosmT('cosmo.sonde.dalSole', { d: cosmTestoDistanza(m.dalSole), km: cosmCifre(m.dalSole * COSM_KM_UA / 1e9) }))}</span>` +
    (m.terraNota ? `<span>${cosmEsc(cosmT('cosmo.sonde.dallaTerra', { d: cosmTestoDistanza(m.dallaTerra), luce: cosmTestoLuce(m.dallaTerra) }))}</span>` : '') +
    `<span>${cosmEsc(cosmT('cosmo.sonde.velocita', { kms: cosmNum(m.kms, 1), ua: cosmNum(m.uaPerAnno, 2) }))}</span></div>`).join('');
  const tappe = cosmTappe().map(tp => {
    const s = cosmDatiSonda(tp.sonda);
    const quando = tp.anni != null ? cosmT('cosmo.tappa.fraCirca', { anni: cosmTestoAnni(tp.anni) })
      : tp.passata ? (typeof astroI18n !== 'undefined' ? astroI18n.data(new Date(tp.quando), { year: 'numeric', month: 'short' }) : '')
        : cosmT('cosmo.tappa.anno', { anno: cosmTestoAnno(tp.quando) });
    return `<li class="${tp.passata ? 'passata' : ''}"><span class="cosm-tappa-quando">${cosmEsc(quando)}</span>` +
      `<span>${cosmEsc(cosmT(`cosmo.tappa.${tp.id}`, { sonda: s ? s.nome : '' }))}</span></li>`;
  }).join('');
  return `<div class="cosm-scheda-testa"><h3>${cosmEsc(cosmT('cosmo.sonde.titolo'))}</h3>` +
    `<button type="button" class="tasto-chiudi-dettaglio" data-cosm-azione="chiudi" aria-label="${cosmEsc(cosmT('cosmo.scheda.chiudi'))}">✕</button></div>` +
    `<div class="cosm-sonde">${righe}</div>` +
    `<h4>${cosmEsc(cosmT('cosmo.tappa.titolo'))}</h4><ol class="cosm-tappe">${tappe}</ol>`;
}

function cosmScriviScheda(forza) {
  const ui = cosm.ui;
  if (!ui || !cosm.scelta) return;
  const html = cosm.scelta.id === 'sonde' ? cosmSchedaSonde() : cosmSchedaStruttura(cosm.scelta.id);
  if (!forza && html === ui.firmaScheda) return;
  ui.scheda.innerHTML = html;
  ui.firmaScheda = html;
  ui.scheda.hidden = false;
}

function cosmScegli(id) {
  cosmPreparaInterfaccia();
  cosm.scelta = { id };
  cosmScriviScheda(true);
}
function cosmApriSchedaSonde() { cosmScegli('sonde'); }
function cosmChiudiScheda() {
  cosm.scelta = null;
  if (cosm.ui) { cosm.ui.scheda.hidden = true; cosm.ui.firmaScheda = ''; }
}

// =====================================================================
// 10. I gesti
// =====================================================================

// Cosa c'è sotto al dito: una sonda, un segno, la riga della scala, o la
// struttura più piccola che contiene il punto
function cosmCosaNelPunto(x, y) {
  const cam = cosm.cam;
  if (!cam) return null;
  for (const s of cosm.schermo.sonde) if (Math.hypot(s.x - x, s.y - y) < 22) return { tipo: 'sonde' };
  const riga = cosm.schermo.riga;
  if (riga && Math.abs(y - riga.y) < 22 && x >= riga.x0 - 6 && x <= riga.x1 + 6) {
    let migliore = null, d = Infinity;
    COSM_STRUTTURE.forEach(s => { const dd = Math.abs(riga.X(Math.log10(s.vista)) - x); if (dd < d) { d = dd; migliore = s; } });
    return migliore ? { tipo: 'struttura', id: migliore.id, vola: true } : null;
  }
  const sole = cam.p(cosmVettore(0, 0, 0));
  let scelta = null, raggio = Infinity;
  COSM_STRUTTURE.forEach(s => {
    const rpx = s.r * cam.s;
    if (cosmVisibilita(rpx, cam.lato, 4, 9) < 0.25) return;
    const centro = cosmCentroDi(s);
    const c = centro ? cam.p(centro) : sole;
    const d = Math.hypot(c.x - x, c.y - y);
    if ((d < rpx * 1.05 || Math.abs(d - rpx) < 22) && rpx < raggio) { raggio = rpx; scelta = s; }
  });
  return scelta ? { tipo: 'struttura', id: scelta.id } : null;
}

function cosmTocco(x, y) {
  const cosa = cosmCosaNelPunto(x, y);
  if (!cosa) { cosmChiudiScheda(); return; }
  if (cosa.tipo === 'sonde') { cosmApriSchedaSonde(); if (cosa.vola) cosmVolaA(cosmLDi('voyager')); return; }
  cosmScegli(cosa.id);
  if (cosa.vola) cosmVolaA(cosmLDi(cosa.id));
}

// La scala a cui si entra arrivando dalla vista 3D senza una misura da
// raccordare (le prove e chi la chiama da fuori): l'inquadratura di «Tutto»
const COSM_L_INGRESSO = Math.log10(70);

/* Lo zoom (v404). Tre cose lo rendono prevedibile, e mancavano tutte e tre:
 *   - il punto sotto al dito resta sotto al dito **mentre** la scala scivola
 *     (`cosmApplicaAncora`, rifatto a ogni fotogramma), non solo all'arrivo;
 *   - due scatti di rotella di fila si sommano sullo stesso punto, invece di
 *     ricominciare dal centro raggiunto a metà;
 *   - allontanandosi lo spostamento a mano si riassorbe un poco per decade,
 *     così la carta torna da sola sulla tappa che si sta guardando.
 * Sotto Kuiper non si torna più alla vista 3D: la scala continua fino alla
 * Terra, e in fondo si atterra nel planetario (`cosmAtterra`). */
function cosmZoomAttorno(dL, x, y) {
  const cam = cosm.cam;
  cosm.volo = null;
  cosm.inerzia = null;
  cosm.riassorbi = false;
  const L1 = Math.max(COSM_L_MIN, Math.min(COSM_L_MAX, cosm.Lvoluto + dL));
  if (cam) {
    const sx = x == null ? cam.W / 2 : x, sy = y == null ? cam.H / 2 : y;
    const z = cosm.ancoraZoom;
    // La stessa ancora se il dito non si è spostato: il punto si ricorda
    // dalla prima tacca della rotella, non da dove la carta è arrivata
    // (il confronto è col punto **di partenza**: un corpo agganciato scivola
    // verso il centro, e il dito che resta fermo sta ancora chiedendo lui)
    if (!z || Math.hypot(z.sx0 - sx, z.sy0 - sy) > 3) cosm.ancoraZoom = cosmAncoraAlPunto(sx, sy);
    else if (dL < 0 && cosm.L < z.L0 && !z.corpo) z.L0 = cosm.L;
  }
  cosm.Lvoluto = L1;
}

function cosmZoomPasso(verso) {
  cosm.volo = null;
  cosmZoomAttorno(verso * 0.45, null, null);
}

function cosmCollegaGesti() {
  if (cosm.gestiPronti || typeof document === 'undefined') return;
  const guscio = document.getElementById('sol-guscio');
  if (!guscio) return;
  cosm.gestiPronti = true;
  const dita = new Map();
  // `modo`: 'mappa' (un dito sposta la carta, v404), 'giro' (Maiusc o tasto
  // destro: gira e inclina), 'riga' (il dito sulla riga della scala),
  // 'pizzico', 'inclina' (due dita che salgono insieme, come nelle mappe
  // dei telefoni)
  let modo = 'mappa', partenza = null, toccoDa = null, ultimoTocco = 0, lancio = null;
  const sulla = e => cosm.attivo && typeof sol !== 'undefined' && e.target === sol.canvas;
  const locale = e => {
    const r = sol.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const ferma = e => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); };
  const sullaRiga = p => {
    const riga = cosm.schermo.riga;
    return riga && Math.abs(p.y - riga.y) < 22 && p.x >= riga.x0 - 8 && p.x <= riga.x1 + 8;
  };
  // La velocità del dito, mediata come nella vista 3D: è da lei che parte
  // la corsa quando lo si lascia andare
  const ricorda = (dx, dy) => {
    const ora = performance.now();
    if (!lancio) { lancio = { vx: 0, vy: 0, quando: ora }; return; }
    const dt = Math.max(0.004, Math.min(0.1, (ora - lancio.quando) / 1000));
    const k = 1 - Math.exp(-dt / COSM_TAU_LANCIO);
    lancio.vx += (dx / dt - lancio.vx) * k;
    lancio.vy += (dy / dt - lancio.vy) * k;
    lancio.quando = ora;
  };
  const datiPizzico = () => {
    const [a, b] = [...dita.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };
  guscio.addEventListener('pointerdown', e => {
    if (!sulla(e)) return;
    ferma(e);
    try { sol.canvas.setPointerCapture(e.pointerId); } catch (_) { /* niente */ }
    if (cosm.ui && cosm.ui.aiuto) cosm.ui.aiuto.classList.add('svanito');
    const p = locale(e);
    dita.set(e.pointerId, p);
    cosm.volo = null;
    cosm.inerzia = null;
    cosm.ditaGiu = true;
    lancio = null;
    if (dita.size === 1) {
      modo = sullaRiga(p) ? 'riga' : (e.button === 2 || e.shiftKey ? 'giro' : 'mappa');
      toccoDa = { x: p.x, y: p.y, t: performance.now() };
      partenza = null;
    } else if (dita.size === 2) {
      const d = datiPizzico();
      partenza = { d: d.d, ang: d.ang, L: cosm.L, m: d.m, m0: d.m, deciso: false };
      cosm.Lvoluto = cosm.L;
      cosm.ancoraZoom = cosmAncoraAlPunto(d.m.x, d.m.y);
      modo = 'pizzico';
      toccoDa = null;
    }
  }, true);
  guscio.addEventListener('pointermove', e => {
    if (!sulla(e) || !dita.has(e.pointerId)) return;
    ferma(e);
    const prima = dita.get(e.pointerId), ora = locale(e);
    dita.set(e.pointerId, ora);
    if (dita.size === 2 && partenza) {
      const d = datiPizzico();
      // Due dita che salgono o scendono insieme senza allontanarsi inclinano
      // la carta: si decide nei primi pixel, poi il gesto resta quello
      if (!partenza.deciso) {
        const dy = d.m.y - partenza.m0.y, dx = d.m.x - partenza.m0.x;
        const rapporto = Math.abs(Math.log(d.d / partenza.d));
        if (Math.hypot(dx, dy) > 10 || rapporto > 0.06) {
          partenza.deciso = true;
          if (Math.abs(dy) > 2.2 * Math.abs(dx) && rapporto < 0.05) modo = 'inclina';
        }
      }
      if (modo === 'inclina') {
        cosmTrascina(0, d.m.y - partenza.m.y, 'inclina');
        partenza.m = d.m;
        return;
      }
      if (d.d > 4) {
        cosm.L = cosm.Lvoluto = Math.max(COSM_L_MIN, Math.min(COSM_L_MAX, partenza.L - Math.log10(d.d / partenza.d)));
        // Due dita che ruotano girano la carta attorno al loro punto di mezzo
        let da = d.ang - partenza.ang;
        if (da > Math.PI) da -= 2 * Math.PI; else if (da < -Math.PI) da += 2 * Math.PI;
        if (Math.abs(da) > 1e-4) {
          cosm.az -= da; cosm.azVoluto = cosm.az;
          partenza.ang = d.ang;
          const L0 = cosm.ancoraZoom ? cosm.ancoraZoom.L0 : cosm.L;
          cosm.ancoraZoom = cosmAncoraAlPunto(d.m.x, d.m.y);
          if (cosm.ancoraZoom) cosm.ancoraZoom.L0 = Math.min(L0, cosm.ancoraZoom.L0);
        }
        if (cosm.ancoraZoom) { cosm.ancoraZoom.sx = d.m.x; cosm.ancoraZoom.sy = d.m.y; }
        cosmApplicaAncora();
        partenza.m = d.m;
      }
      return;
    }
    if (dita.size !== 1 || !cosm.cam) return;
    if (toccoDa && Math.hypot(ora.x - toccoDa.x, ora.y - toccoDa.y) < 6) return;
    toccoDa = null;
    const dx = ora.x - prima.x, dy = ora.y - prima.y;
    if (modo === 'riga') {
      // Il dito sulla riga scorre la scala, e la carta torna sulla tappa
      const riga = cosm.schermo.riga;
      if (!riga) return;
      cosm.ancoraZoom = null;
      cosm.riassorbi = true;
      cosm.Lvoluto = Math.max(COSM_L_MIN + 0.02, Math.min(COSM_L_MAX, riga.Linv(Math.max(riga.x0, Math.min(riga.x1, ora.x)))));
      return;
    }
    if (modo === 'pizzico') return;
    cosm.ancoraZoom = null;
    cosmTrascina(dx, dy, modo);
    ricorda(dx, dy);
  }, true);
  const fine = e => {
    if (!dita.has(e.pointerId)) return;
    if (cosm.attivo) ferma(e);
    const p = dita.get(e.pointerId);
    const era = dita.size;
    dita.delete(e.pointerId);
    if (dita.size < 2) partenza = null;
    // Il dito che resta dopo un pizzico ricomincia a spostare da dov'è
    if (era === 2 && dita.size === 1) { modo = 'mappa'; lancio = null; }
    if (!dita.size) {
      cosm.ditaGiu = false;
      // Lasciato andare in corsa, il dito lancia la carta
      if (e.type === 'pointerup' && lancio && (modo === 'mappa' || modo === 'giro') &&
          performance.now() - lancio.quando < 90) {
        const v = Math.hypot(lancio.vx, lancio.vy);
        if (v > COSM_INERZIA_MIN) {
          const lim = Math.min(1, COSM_INERZIA_MAX / v);
          cosm.inerzia = { vx: lancio.vx * lim, vy: lancio.vy * lim, tipo: modo };
        }
      }
      lancio = null;
    }
    if (e.type === 'pointerup' && toccoDa && performance.now() - toccoDa.t < 450) {
      const ora = performance.now();
      if (modo !== 'riga' && ora - ultimoTocco < 320) { cosmZoomAttorno(-0.8, p.x, p.y); ultimoTocco = 0; }
      else { ultimoTocco = ora; cosmTocco(p.x, p.y); }
    }
    if (!dita.size) modo = 'mappa';
    toccoDa = null;
  };
  guscio.addEventListener('pointerup', fine, true);
  guscio.addEventListener('pointercancel', fine, true);
  guscio.addEventListener('wheel', e => {
    if (!sulla(e)) return;
    ferma(e);
    const p = locale(e);
    // La rotella di un mouse dà tacche da cento, il trackpad una pioggia di
    // numeri piccoli: si somma la quantità, non il numero degli eventi
    const pixel = e.deltaMode === 1 ? e.deltaY * 16 : (e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY);
    const passo = Math.max(-2, Math.min(2, pixel / 100));
    if (passo) cosmZoomAttorno(passo * 0.24, p.x, p.y);
  }, { capture: true, passive: false });
  guscio.addEventListener('dblclick', e => { if (sulla(e)) ferma(e); }, true);
  guscio.addEventListener('contextmenu', e => { if (sulla(e)) e.preventDefault(); }, true);
}

// =====================================================================
// 11. Entrare e uscire
// =====================================================================

function cosmEntra(id, opzioni = {}) {
  if (typeof sol === 'undefined') return;
  cosmPreparaInterfaccia();
  cosmCollegaGesti();
  if (!cosm.materialiChiesti) { cosm.materialiChiesti = true; cosmPreparaMateriali(); }
  const prima = cosm.attivo;
  cosm.attivo = true;
  cosm.pan = { x: 0, y: 0 };
  cosm.ancoraZoom = null;
  cosm.inerzia = null;
  cosm.riassorbi = false;
  // La camera: quella della vista 3D da cui si arriva (v404: la carta e la
  // scena hanno la stessa terna, quindi il passaggio non gira niente), o
  // vista dall'alto
  if (opzioni.camera) {
    cosm.az = cosm.azVoluto = opzioni.camera.az || 0;
    cosm.elev = cosm.elevVoluta = Math.max(-89, Math.min(90, opzioni.camera.elev == null ? 90 : opzioni.camera.elev));
  } else if (!prima) { cosm.az = cosm.azVoluto = 0; cosm.elev = cosm.elevVoluta = 90; }
  const guscio = document.getElementById('sol-guscio');
  if (guscio) guscio.classList.add('cosmo-attivo');
  if (cosm.ui) cosm.ui.radice.hidden = false;
  if (typeof solChiudiScheda === 'function') { try { solChiudiScheda(); } catch (e) { /* niente */ } }
  const L = Number.isFinite(opzioni.L) ? opzioni.L : (id ? cosmLDi(id) : cosmLDi('voyager'));
  // Si entra dalla scala da cui si arriva (`opzioni.da`, di serie i pianeti)
  // e si vola fino a dove si voleva: è la stessa strada che dice di quanto
  // ci si sta allontanando
  if (!prima && !opzioni.immediato) {
    const da = Number.isFinite(opzioni.da) ? opzioni.da : cosmLDi('pianeti');
    cosm.L = cosm.Lvoluto = Math.max(COSM_L_MIN + 0.02, Math.min(COSM_L_MAX, da));
  }
  cosmVolaA(L, { immediato: !!opzioni.immediato });
  // Chi arriva dalla vista 3D girando attorno alla Terra la ritrova in mezzo
  // allo schermo anche qui: lo spostamento è di un'unità astronomica, che
  // allontanandosi diventa subito niente
  if (opzioni.centraTerra && opzioni.immediato) {
    const t = cosmRuota(cosmSullaCarta(cosmTerraGal(), cosmPesiPiano(cosm.L)));
    const a = cosmAncoraRuotata(cosm.L);
    cosm.pan = { x: t.x - a.x, y: t.y - a.y };
  }
  if (id && id !== 'voyager' && COSM_PER_ID.has(id) && !opzioni.senzaScheda) cosmScegli(id);
  if (typeof solAggiornaTasti === 'function') solAggiornaTasti();
}

function cosmEsci() {
  if (!cosm.attivo) return;
  cosm.attivo = false;
  cosm.volo = null;
  cosm.regia = false;
  cosm.evidenza = null;
  cosm.baseMs = null;
  cosm.anni = 0;
  cosmChiudiScheda();
  const guscio = typeof document !== 'undefined' ? document.getElementById('sol-guscio') : null;
  if (guscio) guscio.classList.remove('cosmo-attivo');
  if (cosm.ui) cosm.ui.radice.hidden = true;
  if (typeof solAggiornaTasti === 'function') solAggiornaTasti();
}

// Le frecce della tastiera girano la camera come quelle della vista 3D
function cosmGiraConTasti(tasto) {
  if (tasto === 'ArrowLeft') cosm.azVoluto -= 0.12;
  else if (tasto === 'ArrowRight') cosm.azVoluto += 0.12;
  else if (tasto === 'ArrowUp') cosm.elevVoluta = Math.max(-89, cosm.elevVoluta - 4);
  else if (tasto === 'ArrowDown') cosm.elevVoluta = Math.min(90, cosm.elevVoluta + 4);
}

// In fondo alla scala la Terra riempie lo schermo, e si atterra nel
// planetario (v404): è la stessa discesa della vista 3D
// (`solAtterraNelPlanetario`, il volo d'ingresso percorso all'indietro), e la
// si prende dalla stessa misura — la Terra al 42% del lato corto — con la
// stessa camera. Non durante una demo o un filmato, che hanno la loro regia:
// lì la scala si ferma in fondo e basta.
function cosmAtterra() {
  if (cosm.atterrando || cosm.regia) return false;
  const bloccato = (typeof AstroDemo === 'object' && AstroDemo && AstroDemo.inCorso) ||
    (typeof sky !== 'undefined' && sky.reg && sky.reg.attiva) ||
    typeof solAtterraNelPlanetario !== 'function' || typeof solPreparaAtterraggio !== 'function';
  if (bloccato) { cosm.Lvoluto = Math.max(cosm.Lvoluto, COSM_L_ATTERRA + 0.01); return false; }
  cosm.atterrando = true;
  const camera = { az: cosm.az, elev: cosm.elev };
  try {
    cosmEsci();
    solPreparaAtterraggio(camera);
    return solAtterraNelPlanetario();
  } finally { cosm.atterrando = false; }
}

// La Terra sta in mezzo allo schermo (entro un quarto del lato corto)?
function cosmTerraAlCentro() {
  const cam = cosm.cam;
  if (!cam) return false;
  const q = cam.p(cosmTerraGal());
  return Math.hypot(q.x - cam.W / 2, q.y - cam.H / 2) < cam.lato * 0.5;
}

// Il ⟲: la carta dall'alto, senza spostamenti, sulla tappa più vicina alla
// scala di adesso — non più sulle Voyager, che a scala della Terra voleva
// dire un volo di sei decade per chiedere soltanto «rimettimi dritto»
function cosmReimposta() {
  cosm.anni = 0;
  cosm.ancoraZoom = null;
  cosm.inerzia = null;
  cosm.azVoluto = 0; cosm.elevVoluta = 90;
  const vicina = cosmStrutturaDellaScala(cosm.L);
  cosmVolaA(vicina ? Math.log10(vicina.vista) : cosmLDi('voyager'));
}

// Dal nome scritto nella ricerca della 3D: «Laniakea», «nube di Oort»,
// «Local Bubble» — in tutte le lingue del dizionario
function cosmCercaTesto(testo) {
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const q = norm(testo);
  if (q.length < 3) return false;
  const tutte = k => (typeof astroI18n !== 'undefined' && astroI18n.tutteLeVersioni
    ? astroI18n.tutteLeVersioni(k) : [cosmT(k)]).map(norm);
  for (const s of COSM_STRUTTURE) {
    const nomi = tutte(`cosmo.${s.id}.nome`).concat(tutte(`cosmo.${s.id}.corto`), [norm(s.demo.replace(/_/g, ' '))]);
    if (nomi.some(n => n && (n.includes(q) || q.includes(n)))) { cosmEntra(s.id); return true; }
  }
  return false;
}

// Dal planetario: apre la vista 3D già sulla scala cosmica. Senza una tappa
// chiesta (il tasto del pannello Astri) si esce col volo d'ingresso e si
// atterra sulla **Terra** della carta, alla stessa misura a cui la vista 3D
// l'aveva lasciata (`arrival`), e da lì ci si allontana fino ai pianeti
// (v404): uscendo dal planetario il centro è la Terra, non il Sole. Con una
// tappa chiesta si va dritti lì, come prima.
function apriScalaCosmica(id) {
  if (typeof apriSistemaSolare !== 'function') return;
  if (typeof sol !== 'undefined' && sol.aperto) { cosmEntra(id); return; }
  if (!id) {
    apriSistemaSolare({
      inquadra: () => {
        cosmEntra('terra', { L: cosmLDi('arrival'), immediato: true, senzaScheda: true,
          camera: { az: sol.az, elev: sol.elev } });
        cosmVolaA(cosmLDi('pianeti'));
      }
    });
    return;
  }
  apriSistemaSolare({ senzaVolo: true, inquadra: () => cosmEntra(id) });
}

// La regia delle demo (`cosmic_scale` in demo.js): la scala, gli anni e la
// struttura in evidenza, scritti dall'esterno a ogni fotogramma
function cosmRegia(stato) {
  if (!stato) { cosm.regia = false; cosm.evidenza = null; return; }
  if (!cosm.attivo) cosmEntra(null, { immediato: true, senzaScheda: true });
  // Quando chi guarda prende la camera col dito la scala torna sua; gli
  // anni invece continuano a scorrere col racconto
  cosm.regia = !stato.manuale;
  if (Number.isFinite(stato.L) && !stato.manuale) { cosm.L = cosm.Lvoluto = Math.max(COSM_L_MIN, Math.min(COSM_L_MAX, stato.L)); cosm.volo = null; }
  if (Number.isFinite(stato.anni)) cosm.anni = Math.max(0, stato.anni);
  if (stato.baseMs !== undefined) cosm.baseMs = stato.baseMs;
  if (stato.evidenza !== undefined) cosm.evidenza = stato.evidenza;
  if (stato.pan) cosm.pan = stato.pan;
  // La camera della carta (v402): la scrive la regia, perché a regia accesa
  // `cosmPassoCamera` non la fa scivolare
  if (Number.isFinite(stato.az)) cosm.az = cosm.azVoluto = stato.az;
  if (Number.isFinite(stato.elev)) cosm.elev = cosm.elevVoluta = Math.max(-89, Math.min(90, stato.elev));
  // Il Sole al centro (`center: 'sun'` delle demo): lo spostamento annulla
  // l'ancora di questa scala
  if (stato.centraSole) {
    const c = cosmCentro(cosm.L);
    cosm.pan = { x: cosm.pan.x - c.x, y: cosm.pan.y - c.y };
  }
}

// L'elenco delle strutture per chi le vuole nominare da fuori (le demo, le
// prove): l'id interno, quello delle demo e la scala a cui si inquadra
function cosmStrutture() {
  return COSM_STRUTTURE.map(s => ({ id: s.id, demo: s.demo, L: Math.log10(s.vista), r: s.r }));
}

// Il tasto del planetario, nel pannello Astri accanto alla vista 3D
if (typeof document !== 'undefined') {
  const collega = () => {
    const b = document.getElementById('skymap-btn-cosmo');
    if (b && !b.dataset.cosmPronto) {
      b.dataset.cosmPronto = '1';
      b.addEventListener('click', () => {
        apriScalaCosmica();
        if (typeof skyMostraGruppo === 'function') skyMostraGruppo('');
      });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', collega);
  else collega();
  // Al cambio lingua la fila si riscrive (la scheda si rifà da sé, ogni
  // trecento millisecondi, confrontando l'HTML)
  if (typeof astroI18n !== 'undefined' && astroI18n.alCambio) astroI18n.alCambio(() => {
    cosmScriviFila();
    if (cosm.ui) { cosm.ui.firmaScheda = ''; if (cosm.ui.aiuto) cosm.ui.aiuto.textContent = cosmT('cosmo.aiuto'); }
    cosm.sagome = Object.fromEntries(Object.entries(cosm.sagome).filter(([k]) => !k.startsWith('elio-')));
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cosm, COSM_STRUTTURE, COSM_SEGNI, COSM_TAPPE, COSM_UA_AL, COSM_LUCE_S_UA,
    cosmEclAGal, cosmGalAEcl, cosmDaRaDec, cosmDaGal, cosmSullaCarta, cosmPesiPiano,
    cosmMisuraSonda, cosmPosizioneSonda, cosmTappe, cosmQuandoA, cosmLDi, cosmCentro, cosmCamera,
    cosmTestoDistanza, cosmTestoAnni, cosmVisibilita, cosmStrutturaDellaScala, cosmStrutture,
    cosmCercaTesto, cosmRegia, cosmEntra, cosmEsci, cosmRuota, cosmZoomAttorno, COSM_L_INGRESSO, COSM_L_ATTERRA, COSM_L_MIN, cosmAncoraRuotata, cosmCorpi, cosmTestoLuce, cosmContornoElio, COSM_ELIO, COSM_NASO, cosmRaggioElio, cosmParametriElio
  };
}
