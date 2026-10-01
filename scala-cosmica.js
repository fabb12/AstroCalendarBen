/* =====================================================================
 * scala-cosmica.js — Oltre i pianeti: la scala cosmica
 * =====================================================================
 *
 * La vista 3D del Sistema Solare finisce a Kuiper, e le due Voyager sono
 * già tre volte più in là. Questo file è il quarto quadro di quella
 * finestra («Scala cosmica»): una carta vista dall'alto che si allarga a
 * passi di **logaritmo**, dal Sistema Solare fino al bordo dell'universo
 * osservabile, con dentro undici strutture vere e le due sonde al loro
 * posto di oggi — o di fra quarantamila anni.
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
 *   3. **Le Voyager non arrivano da nessuna parte in fretta**: la loro
 *      distanza è sempre segnata sulla riga della scala in fondo, e quando
 *      il viaggio intero diventa più piccolo di un pixel lo si dice.
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
const COSM_PIANO_SONDE = [1.95, 2.22];
const COSM_PIANO_GAL = [4.45, 5.25];
const COSM_PIANO_SG = [12.0, 12.7];

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
  cosmAssiSonde = { su: cosmVettore(-bis.x, -bis.y, -bis.z), destra: unit(croce(bis, n)) };
  return cosmAssiSonde;
}

function cosmSullaCarta(v, pesi) {
  const e = cosmGalAEcl(v);
  let x = e.x, y = e.y;
  if (pesi.sonde > 0 && pesi.gal < 1) {
    const ps = cosmPianoSonde();
    x += (cosmScalare(v, ps.destra) - x) * pesi.sonde;
    y += (cosmScalare(v, ps.su) - y) * pesi.sonde;
  }
  // Galattico visto dal polo nord: il centro in alto, l = 90° a sinistra
  x += (-v.y - x) * pesi.gal;
  y += (v.x - y) * pesi.gal;
  if (pesi.sg > 0) {
    x += (cosmScalare(v, COSM_SG_X) - x) * pesi.sg;
    y += (cosmScalare(v, COSM_SG_Y) - y) * pesi.sg;
  }
  return { x, y };
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

/* Le undici strutture. Per ognuna: `r` il raggio (in UA) a cui si
 * inquadra e da cui si giudica se è in vista, `centro` (vettore galattico,
 * o null per il Sole), `inquadra` quanta vista attorno a lei serve, e `id`
 * esterno per le demo (`cosmic_scale { to: 'oort' }`). Le misure scritte
 * nelle schede vengono dal dizionario: qui ci sono solo i numeri da cui si
 * disegna. */
const COSM_STRUTTURE = [
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

// Il tetto della manopola del futuro, e la forma: geometrica, perché le
// tappe stanno a decine, migliaia e centinaia di migliaia di anni
const COSM_FUTURO_MAX = 300000;
// La scala: logaritmo in base dieci di metà del lato corto, in UA
const COSM_L_MIN = 0.25;
const COSM_L_MAX = 15.85;

// =====================================================================
// 3. Lo stato
// =====================================================================

const cosm = {
  attivo: false,
  L: 2.4, Lvoluto: 2.4,
  volo: null,             // { da, a, t0, durata, tappe } quando si vola fra due scale
  pan: { x: 0, y: 0 },    // spostamento a mano, in UA sulla carta
  anni: 0,                // quanto avanti nel futuro guardare le sonde
  baseMs: null,           // l'istante di partenza (null = l'orologio della 3D)
  scelta: null,           // la struttura o il segno della scheda aperta
  evidenza: null,         // una struttura da far risaltare (le demo)
  regia: false,           // una demo sta guidando la scala
  ultimoTs: 0,
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
  if (al < 0.05) return cosmU('cosmo.unita.ua', ua);
  if (al < 1e6) return cosmU('cosmo.unita.al', al);
  if (al < 1e9) return cosmU('cosmo.unita.mal', al / 1e6);
  return cosmU('cosmo.unita.gal', al / 1e9);
}

// Una durata in anni, dalla frazione di giorno ai miliardi
function cosmTestoAnni(anni) {
  if (!Number.isFinite(anni)) return '—';
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

// A che scala si inquadra una struttura (o le sonde di oggi)
function cosmLDi(id) {
  if (id === 'voyager' || id === 'probes') {
    const m = cosmMisuraSonda('voyager1', cosmIstante());
    return Math.log10(Math.max(60, (m ? m.dalSole : 170) * 1.55));
  }
  if (id === 'planets' || id === 'pianeti') return Math.log10(34);
  const s = COSM_PER_ID.get(id) || COSM_STRUTTURE.find(x => x.demo === id);
  return s ? Math.log10(s.vista) : null;
}

// Il centro della carta per una scala: fra un'inquadratura e la successiva
// si scivola con una curva morbida, così lo spostamento è sempre una
// frazione della vista e non salta mai.
function cosmAncore(pesi) {
  const punti = [{ L: COSM_L_MIN, c: { x: 0, y: 0 } }];
  COSM_STRUTTURE.forEach(s => {
    // L'ancora è il centro della struttura, o — per quelle che hanno noi sul
    // bordo (la nube locale, la Vergine, Laniakea) — un punto fra lei e il
    // Sole, così nel quadro ci stanno tutt'e due
    const a = s.ancora || s.centro;
    punti.push({ L: Math.log10(s.vista), c: a ? cosmSullaCarta(a, pesi) : { x: 0, y: 0 } });
  });
  return punti;
}
function cosmCentro(L) {
  const pesi = cosmPesiPiano(L);
  const a = cosmAncore(pesi);
  let c = a[a.length - 1].c;
  if (L <= a[0].L) c = a[0].c;
  else for (let i = 0; i < a.length - 1; i++) {
    if (L >= a[i].L && L <= a[i + 1].L) {
      const k = cosmLiscia(a[i].L, a[i + 1].L, L);
      c = { x: a[i].c.x + (a[i + 1].c.x - a[i].c.x) * k, y: a[i].c.y + (a[i + 1].c.y - a[i].c.y) * k };
      break;
    }
  }
  return { x: c.x + cosm.pan.x, y: c.y + cosm.pan.y };
}

// Quello che serve per proiettare in questo fotogramma
function cosmCamera(L, W, H) {
  const lato = Math.max(60, Math.min(W, H) / 2);
  const s = lato / Math.pow(10, L);
  const pesi = cosmPesiPiano(L);
  const c = cosmCentro(L);
  return {
    L, W, H, s, pesi, c, lato,
    p(v) {
      const q = cosmSullaCarta(v, pesi);
      return { x: W / 2 + (q.x - c.x) * s, y: H / 2 - (q.y - c.y) * s };
    },
    // Un vettore della carta (non un punto): la sua immagine sullo schermo
    d(v) {
      const q = cosmSullaCarta(v, pesi);
      return { x: q.x * s, y: -q.y * s };
    }
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
// ma meno che in proporzione: dieci decade non devono durare un minuto.
function cosmVolaA(L, opzioni = {}) {
  if (!Number.isFinite(L)) return;
  const a = Math.max(COSM_L_MIN, Math.min(COSM_L_MAX, L));
  const durata = opzioni.immediato ? 0 : 0.7 + 0.42 * Math.sqrt(Math.abs(a - cosm.L)) * 1.6;
  cosm.volo = durata ? { da: cosm.L, a, t0: performance.now(), durata: durata * 1000, panDa: { ...cosm.pan } } : null;
  if (!durata) { cosm.L = a; cosm.pan = { x: 0, y: 0 }; }
  cosm.Lvoluto = a;
}

function cosmPassoCamera(ora) {
  if (cosm.regia) return;
  if (cosm.volo) {
    const v = cosm.volo;
    const u = Math.min(1, (ora - v.t0) / v.durata);
    const k = u * u * (3 - 2 * u);
    cosm.L = v.da + (v.a - v.da) * k;
    cosm.pan = { x: v.panDa.x * (1 - k), y: v.panDa.y * (1 - k) };
    if (u >= 1) { cosm.volo = null; cosm.Lvoluto = cosm.L; }
    return;
  }
  const dt = cosm.ultimoTs ? Math.min(0.1, (ora - cosm.ultimoTs) / 1000) : 0;
  if (Math.abs(cosm.Lvoluto - cosm.L) > 1e-4) cosm.L += (cosm.Lvoluto - cosm.L) * (1 - Math.exp(-dt / 0.16));
  else cosm.L = cosm.Lvoluto;
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
    () => cosmNuvola('kuiper'), () => cosmScia('voyager1'), () => cosmScia('voyager2')];
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
    const d = cosmDado(3);
    for (let i = 0; i < 700; i++) {
      const r = 39.4 + (d() < 0.25 ? 0 : (d() - 0.4) * 14) + cosmGauss(d) * 1.2;
      const a = d() * Math.PI * 2, z = cosmGauss(d) * 0.12 * r;
      punti.push(cosmEclAGal(cosmVettore(r * Math.cos(a), r * Math.sin(a), z)));
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
  const yy = Math.max(cima, Math.min(H - (cosm.fondoPx || 120) - 26, y - (sopra || 0)));
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

// --- Il Sistema Solare: orbite, Kuiper, pianeti -----------------------------
const COSM_ORBITE = [
  { id: 'Earth', ua: 1, colore: '#60a5fa' }, { id: 'Jupiter', ua: 5.2, colore: '#fcd34d' },
  { id: 'Saturn', ua: 9.54, colore: '#fde68a' }, { id: 'Uranus', ua: 19.2, colore: '#a5f3fc' },
  { id: 'Neptune', ua: 30.07, colore: '#93c5fd' }
];
function cosmDisegnaPianeti(ctx, cam) {
  const ms = cosmIstante();
  COSM_ORBITE.forEach(o => {
    const rpx = o.ua * cam.s;
    const alfa = cosmVisibilita(rpx, cam.lato, 6, 40);
    if (alfa < 0.02) return;
    ctx.globalAlpha = alfa * 0.5;
    ctx.strokeStyle = o.colore; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const a = i / 90 * Math.PI * 2;
      const p = cam.p(cosmEclAGal(cosmVettore(o.ua * Math.cos(a), o.ua * Math.sin(a), 0)));
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    }
    ctx.stroke();
    // Il pianeta al suo posto, se l'istante è dentro a quello che la libreria sa
    if (Math.abs(ms - Date.now()) < 3000 * COSM_ANNO_MS && typeof Astronomy !== 'undefined') {
      try {
        const e = Astronomy.Ecliptic(Astronomy.HelioVector(o.id, new Date(ms))).vec;
        const p = cam.p(cosmEclAGal(cosmVettore(e.x, e.y, e.z)));
        ctx.globalAlpha = alfa;
        ctx.fillStyle = o.colore;
        cosmPercorsoCerchio(ctx, p.x, p.y, 2.6); ctx.fill();
        if (rpx > 26) cosmScritta(ctx, typeof nomeCorpo === 'function' ? nomeCorpo(o.id) : o.id, p.x, p.y - 11, o.colore, 11);
      } catch (e) { /* fuori dal campo della libreria */ }
    }
  });
  ctx.globalAlpha = 1;
}

function cosmDisegnaNuvola(ctx, cam, nome, colore, alfa, raggio) {
  if (alfa < 0.02) return;
  const punti = cosmNuvola(nome);
  ctx.globalAlpha = alfa;
  ctx.fillStyle = colore;
  ctx.beginPath();
  const W = cam.W, H = cam.H;
  for (let i = 0; i < punti.length; i++) {
    const p = cam.p(punti[i]);
    if (p.x < -4 || p.y < -4 || p.x > W + 4 || p.y > H + 4) continue;
    ctx.rect(p.x - raggio / 2, p.y - raggio / 2, raggio, raggio);
  }
  ctx.fill();
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
  const chiave = quale + '|' + cam.pesi.sonde.toFixed(3) + '|' + cam.pesi.gal.toFixed(3);
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
    const naso2 = cosmSullaCarta(n, cam.pesi);
    for (let i = 0; i <= 60; i++) {
      const th = i / 60 * Math.PI;
      for (let j = 0; j < 48; j++) {
        const ph = j / 48 * Math.PI * 2;
        const dir = cosmVettore(
          n.x * Math.cos(th) + (u.x * Math.cos(ph) + w.x * Math.sin(ph)) * Math.sin(th),
          n.y * Math.cos(th) + (u.y * Math.cos(ph) + w.y * Math.sin(ph)) * Math.sin(th),
          n.z * Math.cos(th) + (u.z * Math.cos(ph) + w.z * Math.sin(ph)) * Math.sin(th));
        const r = cosmRaggioElio(quale, dir);
        const q = cosmSullaCarta(dir, cam.pesi);
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
// La scia (fatta piena, da fare tratteggiata) e il segno di oggi, con
// accanto quanto sono lontane; e le tappe come tacche lungo la strada.
function cosmScia(id) {
  const chiave = 'scia-' + id;
  if (cosm.nuvole[chiave]) return cosm.nuvole[chiave];
  const punti = [];
  const lancio = id === 'voyager1' ? Date.UTC(1977, 8, 5, 13) : Date.UTC(1977, 7, 20, 15);
  const fine = Date.UTC(2026, 0, 1);
  for (let ms = lancio; ms < fine; ms += (ms < Date.UTC(1990, 0, 1) ? 6 : 60) * 86400000) {
    const p = cosmPosizioneSonda(id, ms);
    if (p) punti.push(cosmEclAGal(p));
  }
  cosm.nuvole[chiave] = punti;
  return punti;
}

function cosmDisegnaSonde(ctx, cam) {
  const ms = cosmIstante();
  cosm.schermo.sonde = [];
  const sole = cam.p(cosmVettore(0, 0, 0));
  const misure = ['voyager1', 'voyager2'].map(id => cosmMisuraSonda(id, ms)).filter(Boolean);
  if (!misure.length) return;
  const lontano = Math.max(...misure.map(m => m.dalSole));
  const pxViaggio = lontano * cam.s;
  misure.forEach(m => {
    if (!m.partita) return;
    const p = cam.p(m.gal);
    // La strada fatta
    const scia = cosmScia(m.id);
    ctx.strokeStyle = m.colore; ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    let primo = true;
    scia.forEach(v => {
      const q = cam.p(v);
      if (primo) { ctx.moveTo(q.x, q.y); primo = false; } else ctx.lineTo(q.x, q.y);
    });
    // Dal 2026 in poi è la retta: fino all'istante mostrato
    if (ms > Date.UTC(2026, 0, 1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    // Quella che resta, tratteggiata: fino al doppio della distanza di
    // adesso, o fino al bordo dello schermo
    const futuro = cosmPosizioneSonda(m.id, ms + Math.max(50, m.dalSole / m.uaPerAnno) * COSM_ANNO_MS * 1.2);
    if (futuro) {
      const f = cam.p(cosmEclAGal(futuro));
      ctx.setLineDash([5, 6]); ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(f.x, f.y); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    cosm.schermo.sonde.push({ id: m.id, x: p.x, y: p.y, m });
  });
  // Le tappe come tacche: la data accanto
  if (pxViaggio > 30) cosmDisegnaTappe(ctx, cam, pxViaggio);
  // Il segno e l'etichetta di ognuna; o, quando il viaggio è un punto, un
  // segno solo sul Sole
  const t = performance.now() / 1000;
  if (pxViaggio < 14) {
    const pulsa = 10 + 4 * Math.sin(t * 3);
    ctx.strokeStyle = 'rgba(253,230,138,0.85)'; ctx.lineWidth = 1.4;
    cosmPercorsoCerchio(ctx, sole.x, sole.y, pulsa); ctx.stroke();
    const basso = cam.H - (cosm.fondoPx || 120) - 64;
    const y = sole.y + 30 < basso ? sole.y + 30 : sole.y - 46;
    cosmScritta(ctx, cosmT('cosmo.sonde.qui'), sole.x, y, '#fde68a', 12.5, 'center', 650);
    cosmScritta(ctx, cosmT(pxViaggio < 1 ? 'cosmo.sonde.menoDiUnPixel' : 'cosmo.sonde.pochiPixel'),
      sole.x, y + 15, 'rgba(253,230,138,0.85)', 10.5);
    return;
  }
  misure.forEach((m, i) => {
    if (!m.partita) return;
    const p = cam.p(m.gal);
    ctx.fillStyle = m.colore;
    cosmPercorsoCerchio(ctx, p.x, p.y, 3.4); ctx.fill();
    ctx.strokeStyle = m.colore; ctx.lineWidth = 1.2;
    cosmPercorsoCerchio(ctx, p.x, p.y, 7 + 2 * Math.sin(t * 2.4 + i)); ctx.stroke();
    // L'etichetta, dalla parte opposta al Sole
    const dx = p.x - sole.x, dy = p.y - sole.y, l = Math.hypot(dx, dy) || 1;
    let x = p.x + dx / l * 16, y = p.y + dy / l * 16;
    const allinea = dx >= 0 ? 'left' : 'right';
    x = Math.max(8, Math.min(cam.W - 8, x)); y = Math.max(54, Math.min(cam.H - (cosm.fondoPx || 120) - 44, y));
    cosmScritta(ctx, m.nome, x, y, m.colore, 13, allinea, 700);
    cosmScritta(ctx, cosmT('cosmo.sonde.etichettaSole', { d: cosmTestoDistanza(m.dalSole) }), x, y + 15, '#e2e8f0', 11, allinea);
    if (m.terraNota) {
      cosmScritta(ctx, cosmT('cosmo.sonde.etichettaTerra', { d: cosmTestoDistanza(m.dallaTerra), luce: cosmTestoLuce(m.dallaTerra) }),
        x, y + 29, 'rgba(203,213,225,0.92)', 11, allinea);
    }
  });
}

function cosmDisegnaTappe(ctx, cam) {
  const ora = cosmIstante();
  cosmTappe().forEach(tp => {
    if (tp.stella || tp.anni != null) return;
    const p3 = cosmPosizioneSonda(tp.sonda, tp.quando);
    if (!p3) return;
    const p = cam.p(cosmEclAGal(p3));
    if (p.x < 0 || p.y < 0 || p.x > cam.W || p.y > cam.H) return;
    const s = cosmDatiSonda(tp.sonda);
    // Una tacca fitta in mezzo alle altre si legge male: si scrive solo se
    // la tappa precedente sulla stessa strada è abbastanza lontana
    const raggio = Math.hypot(p3.x, p3.y, p3.z) * cam.s;
    if (raggio < 26) return;
    ctx.fillStyle = tp.quando <= ora ? s.colore : 'rgba(226,232,240,0.7)';
    cosmPercorsoCerchio(ctx, p.x, p.y, 2.3); ctx.fill();
    if (raggio > 40) {
      ctx.globalAlpha = 0.9;
      cosmScritta(ctx, cosmTestoAnno(tp.quando), p.x + 8, p.y + 10, 'rgba(226,232,240,0.85)', 10, 'left');
      ctx.globalAlpha = 1;
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
  const alfa = cosmVisibilita(rpx, cam.lato, 3, 18);
  if (alfa < 0.02) return 0;
  // Lo sprite ha il nord galattico verso chi guarda: a destra −y, in basso −x
  cosmDisegnaSpritePiano(ctx, cam, cosmSpriteViaLattea(), COSM_CENTRO_GAL, 50000 * COSM_AL * (512 / 500),
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
  ctx.fillStyle = `rgba(147,170,240,${0.12 * alfa})`; ctx.fill();
  ctx.strokeStyle = `rgba(165,180,252,${0.6 * alfa})`; ctx.lineWidth = 1.2;
  ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
  // Qualche stella dentro, perché un braccio è fatto di stelle
  const d = cosmDado(41);
  ctx.fillStyle = `rgba(226,232,255,${0.7 * alfa})`;
  ctx.beginPath();
  for (let i = 0; i < 260; i++) {
    const p = cam.p(centro(da + (a - da) * d(), (d() * 2 - 1) * 1750));
    ctx.rect(p.x, p.y, 1.2, 1.2);
  }
  ctx.fill();
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
  cosmDisegnaNuvola(ctx, cam, 'kuiper', 'rgba(186,200,230,1)', alfa * 0.75, 1.4);
  const sole = cam.p(cosmVettore(0, 0, 0));
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
      const rpx = sg.galassia * cam.s;
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

// Il Sole, e quando non si vede più un disco il «sei qui»
function cosmDisegnaSole(ctx, cam) {
  const p = cam.p(cosmVettore(0, 0, 0));
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9);
  g.addColorStop(0, 'rgba(255,250,220,1)');
  g.addColorStop(0.35, 'rgba(253,224,71,0.9)');
  g.addColorStop(1, 'rgba(253,224,71,0)');
  ctx.fillStyle = g; cosmPercorsoCerchio(ctx, p.x, p.y, 9); ctx.fill();
  if (cam.L < 3.6) cosmScritta(ctx, cosmT('cosmo.etichetta.sole'), p.x, p.y + 16, '#fde68a', 11);
  else if (cam.L > 5.6) {
    ctx.strokeStyle = 'rgba(253,224,71,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x + 6, p.y - 6); ctx.lineTo(p.x + 20, p.y - 20); ctx.stroke();
    cosmScritta(ctx, cosmT('cosmo.etichetta.seiQui'), p.x + 22, p.y - 26, '#fde68a', 11, 'left', 650);
  }
}

// --- Le letture sul bordo: il piano, la riga del metro, l'anno -------------

// Un metro tondo: 1, 2 o 5 per una potenza di dieci, nell'unità giusta
function cosmMetro(cam) {
  const voluto = cam.W * 0.18 / cam.s; // UA
  const al = voluto / COSM_UA_AL;
  let unita, scala;
  if (al < 0.05) { unita = 'ua'; scala = 1; }
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
  // L'anno, quando si guarda avanti
  if (cosm.anni > 0.5) {
    const ms = cosmIstante();
    const testo = cosmT('cosmo.sonde.annoFuturo', { anno: cosmTestoAnno(ms), fra: cosmTestoAnni(cosm.anni) });
    cosmScritta(ctx, testo, regia ? W - 20 : W / 2, y + 38, '#fde68a', regia ? 16 : 15, regia ? 'right' : 'center', 700);
  }
}

/* La riga della scala, in fondo: un asse logaritmico da un'unità
 * astronomica al diametro dell'universo osservabile, con una tacca per ogni
 * struttura e due segni — dove sta la vista adesso, e dove sta Voyager 1.
 * È la sola figura che dica in un colpo d'occhio la cosa che conta: la
 * sonda più lontana mai lanciata sta al tredici per cento della riga, e la
 * riga ha sedici decade. */
const COSM_RIGA_DA = 0, COSM_RIGA_A = 15.6;
function cosmDisegnaRiga(ctx, cam) {
  const W = cam.W;
  const destra = cosm.regia ? 18 : 64;
  const x0 = 18, x1 = W - destra;
  if (x1 - x0 < 160) { cosm.schermo.riga = null; return; }
  const y = cosm.regia ? (cosm.rigaY || 26) : cam.H - (cosm.fondoPx || 100) - 22;
  const X = l => x0 + (x1 - x0) * (l - COSM_RIGA_DA) / (COSM_RIGA_A - COSM_RIGA_DA);
  cosm.schermo.riga = { x0, x1, y, X };
  ctx.fillStyle = 'rgba(5,9,22,0.55)';
  ctx.fillRect(x0 - 8, y - 22, x1 - x0 + 16, 44);
  ctx.strokeStyle = 'rgba(148,163,184,0.7)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  // Le tacche delle strutture, col loro nome breve sopra o sotto a turno
  const vicina = cosmStrutturaDellaScala(cam.L);
  const m = cosmMisuraSonda('voyager1', cosmIstante());
  const xs = m ? X(Math.log10(Math.max(1, m.dalSole))) : null;
  // Il nome della sonda va dalla parte opposta a quello della struttura più
  // vicina sulla riga, se no i due si scrivono uno sull'altro
  let latoSonda = 1;
  if (xs != null) {
    let d = Infinity;
    COSM_STRUTTURE.forEach((s, i) => { const dd = Math.abs(X(Math.log10(s.r)) - xs); if (dd < d) { d = dd; latoSonda = i % 2 ? -1 : 1; } });
  }
  COSM_STRUTTURE.forEach((s, i) => {
    const x = X(Math.log10(s.r));
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
  // Voyager 1
  if (m) {
    ctx.fillStyle = m.colore; cosmPercorsoCerchio(ctx, xs, y, 3.4); ctx.fill();
    cosmScritta(ctx, m.nome, Math.max(x0 + 24, xs), y + 13 * latoSonda, m.colore, 9.5, 'center', 650);
  }
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
  cosmPassoCamera(ora);
  cosm.ultimoTs = ora;
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
  cosmDisegnaPianeti(ctx, cam);
  cosmDisegnaSegni(ctx, cam);
  cosmDisegnaSole(ctx, cam);
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
  radice.append(scheda, fila);
  guscio.append(radice);
  cosm.ui = { radice, fila, scheda, firmaScheda: '' };
  cosmScriviFila();
  fila.addEventListener('click', e => {
    const b = e.target.closest('[data-cosm-vai]');
    if (!b) return;
    const id = b.dataset.cosmVai;
    if (id === 'voyager') { cosmApriSchedaSonde(); cosmVolaA(cosmLDi('voyager')); }
    else { cosmScegli(id); cosmVolaA(cosmLDi(id)); }
  });
  scheda.addEventListener('click', e => {
    const b = e.target.closest('[data-cosm-azione]');
    if (!b) return;
    const azione = b.dataset.cosmAzione;
    if (azione === 'chiudi') cosmChiudiScheda();
    else if (azione === 'vai' && cosm.scelta) cosmVolaA(cosmLDi(cosm.scelta.id));
    else if (azione === 'oggi') { cosm.anni = 0; cosmScriviScheda(true); }
    else if (azione === 'tappa') {
      const ms = Number(b.dataset.ms);
      if (Number.isFinite(ms)) {
        const base = cosm.baseMs != null ? cosm.baseMs : (typeof skyAdesso === 'function' ? skyAdesso().getTime() : Date.now());
        cosm.anni = Math.max(0, Math.min(COSM_FUTURO_MAX, (ms - base) / COSM_ANNO_MS));
        const m = cosmMisuraSonda(b.dataset.sonda || 'voyager1', cosmIstante());
        if (m) cosmVolaA(Math.log10(Math.max(60, m.dalSole * 1.6)));
        cosmScriviScheda(true);
      }
    }
  });
  scheda.addEventListener('input', e => {
    if (e.target && e.target.id === 'cosm-futuro') {
      const u = Number(e.target.value) / 1000;
      cosm.anni = u <= 0 ? 0 : Math.pow(COSM_FUTURO_MAX + 1, u) - 1;
      cosmScriviScheda(true);
    }
  });
  return cosm.ui;
}

function cosmScriviFila() {
  if (!cosm.ui) return;
  const voci = [{ id: 'voyager', nome: cosmT('cosmo.sonde.tasto') }]
    .concat(COSM_STRUTTURE.map(s => ({ id: s.id, nome: cosmT(`cosmo.${s.id}.nome`) })));
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
  const lv = cosmLDi('voyager');
  const sonde = Math.abs(cosm.L - lv) < 0.35 && (!vicina || Math.abs(Math.log10(vicina.vista) - cosm.L) > 0.15);
  ui.fila.querySelectorAll('[data-cosm-vai]').forEach(b => {
    const attivo = b.dataset.cosmVai === 'voyager' ? sonde : !sonde && vicina && vicina.id === b.dataset.cosmVai;
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
  const distanza = s.centro ? Math.hypot(s.centro.x, s.centro.y, s.centro.z) : 0;
  // Le strutture attorno al Sole si misurano dal Sole (fin dove arrivano, e
  // quanto ci mettono la luce e la sonda ad arrivarci); le altre per il
  // diametro. Oltre il Gruppo Locale lo spazio si espande: lì la sonda non
  // arriverà mai, e dirle un tempo sarebbe una bugia.
  const righe = s.raggio ? [
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
  const ms = cosmIstante();
  const righe = ['voyager1', 'voyager2'].map(id => cosmMisuraSonda(id, ms)).filter(Boolean).map(m =>
    `<div class="cosm-sonda" style="--colore-sonda:${m.colore}"><strong>${cosmEsc(m.nome)}</strong>` +
    `<span>${cosmEsc(cosmT('cosmo.sonde.dalSole', { d: cosmTestoDistanza(m.dalSole), km: cosmCifre(m.dalSole * COSM_KM_UA / 1e9) }))}</span>` +
    (m.terraNota ? `<span>${cosmEsc(cosmT('cosmo.sonde.dallaTerra', { d: cosmTestoDistanza(m.dallaTerra), luce: cosmTestoLuce(m.dallaTerra) }))}</span>` : '') +
    `<span>${cosmEsc(cosmT('cosmo.sonde.velocita', { kms: cosmNum(m.kms, 1), ua: cosmNum(m.uaPerAnno, 2) }))}</span></div>`).join('');
  const u = cosm.anni <= 0 ? 0 : Math.log(cosm.anni + 1) / Math.log(COSM_FUTURO_MAX + 1);
  const tappe = cosmTappe().map(tp => {
    const s = cosmDatiSonda(tp.sonda);
    const quando = tp.anni != null ? cosmT('cosmo.tappa.fraCirca', { anni: cosmTestoAnni(tp.anni) })
      : tp.passata ? (typeof astroI18n !== 'undefined' ? astroI18n.data(new Date(tp.quando), { year: 'numeric', month: 'short' }) : '')
        : cosmT('cosmo.tappa.anno', { anno: cosmTestoAnno(tp.quando) });
    return `<li class="${tp.passata ? 'passata' : ''}"><button type="button" data-cosm-azione="tappa" data-ms="${tp.quando}" data-sonda="${tp.sonda}">` +
      `<span class="cosm-tappa-quando">${cosmEsc(quando)}</span>` +
      `<span>${cosmEsc(cosmT(`cosmo.tappa.${tp.id}`, { sonda: s ? s.nome : '' }))}</span></button></li>`;
  }).join('');
  const testoFuturo = cosm.anni > 0.5
    ? cosmT('cosmo.sonde.annoFuturo', { anno: cosmTestoAnno(ms), fra: cosmTestoAnni(cosm.anni) })
    : cosmT('cosmo.sonde.oggi');
  return `<div class="cosm-scheda-testa"><h3>${cosmEsc(cosmT('cosmo.sonde.titolo'))}</h3>` +
    `<button type="button" class="tasto-chiudi-dettaglio" data-cosm-azione="chiudi" aria-label="${cosmEsc(cosmT('cosmo.scheda.chiudi'))}">✕</button></div>` +
    `<div class="cosm-sonde">${righe}</div>` +
    `<label class="cosm-futuro" for="cosm-futuro"><span>${cosmEsc(cosmT('cosmo.sonde.futuro'))}</span>` +
    `<output data-cosm-futuro-testo>${cosmEsc(testoFuturo)}</output></label>` +
    `<div class="cosm-futuro-riga"><input id="cosm-futuro" type="range" min="0" max="1000" step="1" value="${Math.round(u * 1000)}">` +
    `<button type="button" class="tasto-cielo" data-cosm-azione="oggi">${cosmEsc(cosmT('cosmo.sonde.tastoOggi'))}</button></div>` +
    `<p class="cosm-nota">${cosmEsc(cosmT('cosmo.sonde.nota'))}</p>` +
    `<h4>${cosmEsc(cosmT('cosmo.tappa.titolo'))}</h4><ol class="cosm-tappe">${tappe}</ol>`;
}

function cosmScriviScheda(forza) {
  const ui = cosm.ui;
  if (!ui || !cosm.scelta) return;
  const html = cosm.scelta.id === 'sonde' ? cosmSchedaSonde() : cosmSchedaStruttura(cosm.scelta.id);
  // La manopola del futuro non si riscrive mentre la si tiene in mano: si
  // aggiornano solo i numeri attorno, se no il dito perde la presa
  const manopola = ui.scheda.querySelector('#cosm-futuro');
  if (!forza && html === ui.firmaScheda) return;
  if (manopola && document.activeElement === manopola && cosm.scelta.id === 'sonde') {
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    const nuove = tmp.querySelector('.cosm-sonde'), vecchie = ui.scheda.querySelector('.cosm-sonde');
    if (nuove && vecchie) vecchie.innerHTML = nuove.innerHTML;
    const o = ui.scheda.querySelector('[data-cosm-futuro-testo]'), on = tmp.querySelector('[data-cosm-futuro-testo]');
    if (o && on) o.textContent = on.textContent;
    ui.firmaScheda = html;
    return;
  }
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
    COSM_STRUTTURE.forEach(s => { const dd = Math.abs(riga.X(Math.log10(s.r)) - x); if (dd < d) { d = dd; migliore = s; } });
    const m = cosmMisuraSonda('voyager1', cosmIstante());
    if (m && Math.abs(riga.X(Math.log10(m.dalSole)) - x) < d) return { tipo: 'sonde', vola: true };
    return migliore ? { tipo: 'struttura', id: migliore.id, vola: true } : null;
  }
  const sole = cam.p(cosmVettore(0, 0, 0));
  let scelta = null, raggio = Infinity;
  COSM_STRUTTURE.forEach(s => {
    const rpx = s.r * cam.s;
    if (cosmVisibilita(rpx, cam.lato, 4, 9) < 0.25) return;
    const c = s.centro ? cam.p(s.centro) : sole;
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

// Lo zoom attorno a un punto dello schermo: il punto sotto al dito resta
// dov'è, come in ogni carta
function cosmZoomAttorno(dL, x, y) {
  const cam = cosm.cam;
  cosm.volo = null;
  const L1 = Math.max(COSM_L_MIN, Math.min(COSM_L_MAX, cosm.Lvoluto + dL));
  if (cam && x != null) {
    const cx = (x - cam.W / 2) / cam.s, cy = -(y - cam.H / 2) / cam.s;
    const k = 1 - Math.pow(10, L1 - cosm.Lvoluto);
    cosm.pan = { x: cosm.pan.x + cx * k, y: cosm.pan.y + cy * k };
    // Lo spostamento a mano non sopravvive a un salto di scala: oltre
    // qualche vista di distanza dall'ancora si riassorbe
    const lim = Math.pow(10, L1) * 3;
    cosm.pan.x = Math.max(-lim, Math.min(lim, cosm.pan.x));
    cosm.pan.y = Math.max(-lim, Math.min(lim, cosm.pan.y));
  }
  cosm.Lvoluto = L1;
}

function cosmZoomPasso(verso) {
  cosm.volo = null;
  cosmZoomAttorno(verso * 0.35, null, null);
}

function cosmCollegaGesti() {
  if (cosm.gestiPronti || typeof document === 'undefined') return;
  const guscio = document.getElementById('sol-guscio');
  if (!guscio) return;
  cosm.gestiPronti = true;
  const dita = new Map();
  let partenza = null, toccoDa = null, ultimoTocco = 0;
  const sulla = e => cosm.attivo && typeof sol !== 'undefined' && e.target === sol.canvas;
  const locale = e => {
    const r = sol.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const ferma = e => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); };
  guscio.addEventListener('pointerdown', e => {
    if (!sulla(e)) return;
    ferma(e);
    try { sol.canvas.setPointerCapture(e.pointerId); } catch (_) { /* niente */ }
    dita.set(e.pointerId, locale(e));
    cosm.volo = null;
    if (dita.size === 1) { const p = locale(e); toccoDa = { x: p.x, y: p.y, t: performance.now() }; partenza = null; }
    else if (dita.size === 2) {
      const [a, b] = [...dita.values()];
      partenza = { d: Math.hypot(a.x - b.x, a.y - b.y), L: cosm.Lvoluto };
      toccoDa = null;
    }
  }, true);
  guscio.addEventListener('pointermove', e => {
    if (!sulla(e) || !dita.has(e.pointerId)) return;
    ferma(e);
    const prima = dita.get(e.pointerId), ora = locale(e);
    dita.set(e.pointerId, ora);
    if (dita.size === 2 && partenza) {
      const [a, b] = [...dita.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 4) {
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        cosmZoomAttorno(partenza.L - Math.log10(d / partenza.d) - cosm.Lvoluto, m.x, m.y);
        cosm.L = cosm.Lvoluto;
      }
      return;
    }
    if (dita.size === 1 && cosm.cam) {
      if (toccoDa && Math.hypot(ora.x - toccoDa.x, ora.y - toccoDa.y) < 6) return;
      toccoDa = null;
      cosm.pan.x -= (ora.x - prima.x) / cosm.cam.s;
      cosm.pan.y += (ora.y - prima.y) / cosm.cam.s;
    }
  }, true);
  const fine = e => {
    if (!dita.has(e.pointerId)) return;
    if (cosm.attivo) ferma(e);
    const p = dita.get(e.pointerId);
    dita.delete(e.pointerId);
    if (dita.size < 2) partenza = null;
    if (e.type === 'pointerup' && toccoDa && performance.now() - toccoDa.t < 450) {
      const ora = performance.now();
      if (ora - ultimoTocco < 320) { cosmZoomAttorno(-0.8, p.x, p.y); ultimoTocco = 0; }
      else { ultimoTocco = ora; cosmTocco(p.x, p.y); }
    }
    toccoDa = null;
  };
  guscio.addEventListener('pointerup', fine, true);
  guscio.addEventListener('pointercancel', fine, true);
  guscio.addEventListener('wheel', e => {
    if (!sulla(e)) return;
    ferma(e);
    const p = locale(e);
    const passo = Math.max(-1, Math.min(1, e.deltaY / (e.deltaMode === 1 ? 3 : 100)));
    cosmZoomAttorno(passo * 0.22, p.x, p.y);
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
  const guscio = document.getElementById('sol-guscio');
  if (guscio) guscio.classList.add('cosmo-attivo');
  if (cosm.ui) cosm.ui.radice.hidden = false;
  if (typeof solChiudiScheda === 'function') { try { solChiudiScheda(); } catch (e) { /* niente */ } }
  const L = id ? cosmLDi(id) : cosmLDi('voyager');
  // Si entra dalla scala dei pianeti e si vola fino a dove si voleva: è la
  // stessa strada che dice di quanto ci si sta allontanando
  if (!prima && !opzioni.immediato) { cosm.L = Math.log10(34); cosm.Lvoluto = cosm.L; }
  cosmVolaA(L, { immediato: !!opzioni.immediato });
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

function cosmReimposta() {
  cosm.anni = 0;
  cosm.pan = { x: 0, y: 0 };
  cosmVolaA(cosmLDi('voyager'));
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

// Dal planetario: apre la vista 3D già sulla scala cosmica, senza il volo
// d'ingresso (quello atterra sulla Terra, e qui si va dall'altra parte)
function apriScalaCosmica(id) {
  if (typeof apriSistemaSolare !== 'function') return;
  if (typeof sol !== 'undefined' && sol.aperto) { cosmEntra(id); return; }
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
    if (cosm.ui) cosm.ui.firmaScheda = '';
    cosm.sagome = Object.fromEntries(Object.entries(cosm.sagome).filter(([k]) => !k.startsWith('elio-')));
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cosm, COSM_STRUTTURE, COSM_SEGNI, COSM_TAPPE, COSM_UA_AL, COSM_LUCE_S_UA,
    cosmEclAGal, cosmGalAEcl, cosmDaRaDec, cosmDaGal, cosmSullaCarta, cosmPesiPiano,
    cosmMisuraSonda, cosmPosizioneSonda, cosmTappe, cosmQuandoA, cosmLDi, cosmCentro, cosmCamera,
    cosmTestoDistanza, cosmTestoAnni, cosmVisibilita, cosmStrutturaDellaScala, cosmStrutture,
    cosmCercaTesto, cosmRegia, cosmEntra, cosmEsci, cosmContornoElio, COSM_ELIO, COSM_NASO, cosmRaggioElio, cosmParametriElio
  };
}
