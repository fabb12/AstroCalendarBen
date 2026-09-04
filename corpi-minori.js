// =====================================================================
// I CORPI MINORI — le lune di Giove, le comete, gli asteroidi
//
// Astronomy Engine sa fare i pianeti, la Luna e Plutone, e li fa
// benissimo. Fuori da quell'elenco c'è il vuoto, e in quel vuoto ci
// stanno due cose che chi guarda il cielo vuole davvero:
//
//   LE LUNE DI GIOVE. Sono la prima cosa che si vede in un telescopio da
//   principiante — quattro puntini in fila, e ogni sera in un ordine
//   diverso. Sono anche il primo esperimento che ha mostrato che
//   qualcosa gira attorno a qualcosa che non è la Terra. Qui la libreria
//   ci arriva (JupiterMoons), va solo tradotta in pixel: dove stanno,
//   quale è davanti, quale sta buttando l'ombra sul pianeta.
//
//   COMETE E ASTEROIDI. Qui la libreria non arriva, e non può: le loro
//   orbite non sono una legge di natura ma una misura, che si aggiorna.
//   Vanno propagate a mano dalle leggi di Keplero — che poi è la stessa
//   matematica del 1609, e funziona ancora.
//
// Ordine di caricamento: dopo app.js. I dati (dati-corpi-minori.js)
// arrivano su richiesta, come i cataloghi.
// =====================================================================


// =====================================================================
// 1. LE LUNE DI GIOVE
//
//     Il disegno che tutti conoscono — Giove al centro e quattro puntini
//     in fila — è la proiezione delle quattro orbite viste quasi di
//     taglio, perché il piano dei satelliti galileiani è quasi lo stesso
//     dell'orbita di Giove attorno al Sole, e noi lo guardiamo da dentro
//     quel piano.
//
//     "Quasi" è la parola importante: se fosse esattamente di taglio si
//     vedrebbero transiti e eclissi ogni notte. Sono quei pochi gradi di
//     scarto a renderli eventi, e a farli capitare a stagioni.
// =====================================================================

const GIOVE_RAGGIO_KM = 71492;
const UA_IN_KM = 149597870.7;
const GIOVE_RAGGIO_UA = GIOVE_RAGGIO_KM / UA_IN_KM;

const LUNE_GIOVE = [
  { chiave: 'io',       nome: 'Io',       raggioKm: 1821.6, colore: '#fde68a', giorni: 1.769,
    nota: 'Il posto più vulcanico del Sistema Solare: Giove la impasta come una pallina di gomma.' },
  { chiave: 'europa',   nome: 'Europa',   raggioKm: 1560.8, colore: '#e0f2fe', giorni: 3.551,
    nota: 'Un guscio di ghiaccio su un oceano d\'acqua salata più grande di tutti i nostri messi insieme.' },
  { chiave: 'ganymede', nome: 'Ganimede', raggioKm: 2631.2, colore: '#d6d3d1', giorni: 7.155,
    nota: 'La luna più grande del Sistema Solare: batte Mercurio in diametro.' },
  { chiave: 'callisto', nome: 'Callisto', raggioKm: 2410.3, colore: '#a8a29e', giorni: 16.689,
    nota: 'La più esterna e la più butterata: una superficie che non si rinnova da quattro miliardi di anni.' }
];

// Dove stanno le quattro lune, all'istante dato.
//
// Restituisce per ognuna la posizione sul piano del cielo in RAGGI DI
// GIOVE — che è l'unità in cui si ragiona all'oculare ("Io è a tre
// raggi a est") — più lo stato: davanti al pianeta, dietro, in ombra.
//
// `x` cresce verso est, `y` verso nord celeste: le stesse direzioni
// della mappa del planetario, così il disegnino e il cielo concordano.
function luneDiGiove(data) {
  if (typeof Astronomy === 'undefined' || typeof Astronomy.JupiterMoons !== 'function') return null;

  let stato, giove, gioveElio;
  try {
    const t = Astronomy.MakeTime(data);
    stato = Astronomy.JupiterMoons(t);
    // Con la correzione di aberrazione: la stessa che usa il resto
    // dell'app per disegnare Giove, o le lune scivolerebbero rispetto al
    // pianeta di una ventina di secondi d'arco.
    giove = Astronomy.GeoVector('Jupiter', t, true);
    gioveElio = Astronomy.HelioVector('Jupiter', t);
  } catch (e) {
    return null;
  }

  // La terna del piano del cielo visto da qui: `u` è la linea di vista
  // (verso Giove), `est` e `nord` la completano.
  const u = versoreDi([giove.x, giove.y, giove.z]);
  const poloNord = [0, 0, 1];
  const est = versoreDi(prodottoVettoriale(poloNord, u));
  const nord = prodottoVettoriale(u, est);

  // E quella della luce del Sole, che serve per le ombre: `s` va dal
  // Sole a Giove, cioè nella direzione in cui i raggi viaggiano.
  const s = versoreDi([gioveElio.x, gioveElio.y, gioveElio.z]);

  return LUNE_GIOVE.map(luna => {
    const v = stato[luna.chiave];
    const r = [v.x, v.y, v.z];                    // giovicentrico, in UA

    // --- dove si vede ---
    const lungoLaVista = scalare(r, u);           // positivo = più lontano di Giove
    const x = scalare(r, est) / GIOVE_RAGGIO_UA;
    const y = scalare(r, nord) / GIOVE_RAGGIO_UA;
    const distanzaDalCentro = Math.hypot(x, y);   // in raggi di Giove

    // --- davanti o dietro ---
    const davanti = lungoLaVista < 0;
    const sulDisco = distanzaDalCentro < 1;
    const transito = davanti && sulDisco;         // si vede sul disco di Giove
    const occultata = !davanti && sulDisco;       // Giove la nasconde

    // --- l'ombra ---
    // La luna butta l'ombra su Giove quando sta fra il Sole e il
    // pianeta (r·s < 0) e la sua distanza dall'asse Sole-Giove è meno di
    // un raggio. L'eclissi è la stessa cosa a specchio: la luna dentro
    // il cono d'ombra, dall'altra parte.
    const lungoIlSole = scalare(r, s);
    const fuoriAsse = Math.hypot(
      r[0] - lungoIlSole * s[0],
      r[1] - lungoIlSole * s[1],
      r[2] - lungoIlSole * s[2]
    ) / GIOVE_RAGGIO_UA;

    const ombraSuGiove = lungoIlSole < 0 && fuoriAsse < 1;
    const eclissata = lungoIlSole > 0 && fuoriAsse < 1;

    // Dove cade l'ombra sul disco, per disegnarla: è il punto della
    // luna proiettato lungo i raggi del Sole, riportato sul piano del
    // cielo. Non coincide con la luna, e la distanza fra le due è il
    // motivo per cui l'ombra entra sul disco prima o dopo di lei.
    let ombraX = null, ombraY = null;
    if (ombraSuGiove) {
      const p = [r[0] - lungoIlSole * s[0], r[1] - lungoIlSole * s[1], r[2] - lungoIlSole * s[2]];
      ombraX = scalare(p, est) / GIOVE_RAGGIO_UA;
      ombraY = scalare(p, nord) / GIOVE_RAGGIO_UA;
    }

    return {
      nome: luna.nome, colore: luna.colore, nota: luna.nota,
      raggioKm: luna.raggioKm, giorni: luna.giorni,
      x, y, distanzaDalCentro, davanti,
      transito, occultata, eclissata, ombraSuGiove, ombraX, ombraY,
      // Quanto è grande vista da qui, in secondi d'arco: si fa una volta
      // e serve alla scheda ("Ganimede è un disco di 1,7 secondi: in un
      // 130 mm, nelle sere buone, si intuisce che non è un punto").
      diametroSec: 2 * Math.atan(luna.raggioKm / (distanzaTerra(giove, r) * UA_IN_KM)) * 206264.8,
      visibile: !transito && !occultata && !eclissata
    };
  });
}

function distanzaTerra(giove, r) {
  return Math.hypot(giove.x + r[0], giove.y + r[1], giove.z + r[2]);
}

// Il diametro apparente di Giove stesso, in secondi d'arco: serve a
// disegnare il pianeta e le lune nella stessa scala.
function gioveDiametroSec(data) {
  try {
    const g = Astronomy.GeoVector('Jupiter', Astronomy.MakeTime(data), true);
    const d = Math.hypot(g.x, g.y, g.z) * UA_IN_KM;
    return 2 * Math.atan(GIOVE_RAGGIO_KM / d) * 206264.8;
  } catch (e) {
    return null;
  }
}

// Cosa sta succedendo adesso, detto a parole. È quello che finisce nella
// scheda di Giove e negli eventi del planetario.
function luneDiGioveRacconto(data) {
  const lune = luneDiGiove(data);
  if (!lune) return null;

  const fatti = [];
  lune.forEach(l => {
    if (l.transito) fatti.push(astroI18n.t('lune.transito', { luna: l.nome }));
    if (l.ombraSuGiove) fatti.push(astroI18n.t('lune.ombra', { luna: l.nome }));
    if (l.occultata) fatti.push(astroI18n.t('lune.occultata', { luna: l.nome }));
    if (l.eclissata) fatti.push(astroI18n.t('lune.eclissata', { luna: l.nome }));
  });

  // In fila da ovest a est, che è come si vedono nel campo dell'oculare
  const inFila = lune.filter(l => l.visibile).sort((a, b) => a.x - b.x);

  return {
    lune,
    fatti,
    // "Callisto · Io — GIOVE — Europa · Ganimede"
    fila: inFila.length
      ? inFila.filter(l => l.x < 0).map(l => l.nome).join(' · ') +
        (inFila.some(l => l.x < 0) ? ' — ' : '') + 'GIOVE' +
        (inFila.some(l => l.x >= 0) ? ' — ' : '') +
        inFila.filter(l => l.x >= 0).map(l => l.nome).join(' · ')
      : astroI18n.t('lune.tutteNascoste')
  };
}


// =====================================================================
// 2. COMETE E ASTEROIDI — Keplero a mano
//
//     Un'orbita è un'ellisse con il Sole in un fuoco, e per sapere dove
//     sta un corpo in un dato momento bastano sei numeri e un'equazione
//     che non si risolve in forma chiusa. Quella è l'equazione di
//     Keplero:
//
//         M = E − e·sin E
//
//     dove M (l'anomalia media) cresce di un tanto al giorno — è il
//     tempo travestito da angolo — ed E (l'anomalia eccentrica) è quello
//     che serve per trovare la posizione vera. Non si può invertire con
//     carta e penna: si itera. Newton in una manciata di passi ci arriva.
//
//     Per le comete c'è il problema in più che molte hanno orbite quasi
//     paraboliche (e vicinissima a 1), e lì la formula dell'ellisse
//     esplode: il semiasse tende all'infinito. Per quelle si usa
//     l'equazione di Barker, che della parabola fa il caso esatto, e per
//     le iperboliche la versione con le funzioni iperboliche.
//
//     --- QUANTO CI SI PUÒ FIDARE, e perché ---
//
//     Questo è un problema a DUE corpi: il Sole e il sasso. Nel Sistema
//     Solare vero i corpi sono nove, e Giove tira. Propagare a due corpi
//     un'orbita che due corpi non è accumula uno scarto lungo la
//     traiettoria, in proporzione a quante orbite si compiono.
//
//     Misurato sui pianeti, partendo dai loro elementi osculatori
//     (banco di prova in verifica.html):
//
//       dieci giorni    ~100 km        invisibile
//       un anno         50–100 mila km  qualche secondo d'arco
//
//     Per puntare un telescopio, che ha un campo di mezzo grado — 1.800
//     secondi d'arco — è abbondantemente dentro. Per un asteroide, i cui
//     elementi restano buoni per anni, non c'è nemmeno da pensarci.
//
//     Per una cometa sì, e per due motivi diversi. Il primo è che le
//     comete si perturbano molto più dei sassi: sfiorano Giove, e a ogni
//     passaggio al perielio i getti di gas le spingono come un motore
//     acceso male. Il secondo è che di una cometa appena scoperta gli
//     elementi vengono da un arco di osservazioni di pochi giorni, e si
//     riscrivono ogni settimana. Per quelle, gli elementi vanno ripresi
//     dall'MPC — ed è per questo che si possono incollare a mano.
// =====================================================================

const CORPI_GIORNI_GIULIANI_1970 = 2440587.5;   // il giorno giuliano dell'epoca Unix
const GAUSS_K = 0.01720209895;                  // costante gravitazionale gaussiana, rad/giorno

function giornoGiuliano(data) {
  return data.getTime() / 86400000 + CORPI_GIORNI_GIULIANI_1970;
}

// --- l'equazione di Keplero, caso ellittico ---
// Newton-Raphson. Per eccentricità basse converge in tre passi; vicino a
// 1 ne serve qualcuno in più, e la prima stima va scelta con criterio o
// il metodo scivola via.
function risolviKepleroEllittico(M, e) {
  M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (M > Math.PI) M -= 2 * Math.PI;

  // Prima stima: per orbite quasi circolari M va benissimo; per quelle
  // molto eccentriche partire da M manda Newton a sbattere, e conviene
  // la stima di Danby.
  let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
  if (e >= 0.8) E = M + 0.85 * e * Math.sign(Math.sin(M) || 1);

  for (let i = 0; i < 60; i++) {
    const f = E - e * Math.sin(E) - M;
    const df = 1 - e * Math.cos(E);
    const passo = f / df;
    E -= passo;
    if (Math.abs(passo) < 1e-12) break;
  }
  return E;
}

// --- caso parabolico: l'equazione di Barker ---
// Ha soluzione esatta, senza iterare: è una cubica in tan(ν/2) che si
// risolve con la formula di Cardano.
function risolviBarker(q, giorniDalPerielio) {
  const W = 3 * GAUSS_K / Math.SQRT2 * giorniDalPerielio / Math.pow(q, 1.5);
  const y = Math.cbrt(W / 2 + Math.sqrt(W * W / 4 + 1));
  const tanMezziNu = y - 1 / y;
  const nu = 2 * Math.atan(tanMezziNu);
  const r = q * (1 + tanMezziNu * tanMezziNu);
  return { nu, r };
}

// --- caso iperbolico ---
function risolviKepleroIperbolico(M, e) {
  let H = Math.log(2 * Math.abs(M) / e + 1.8) * Math.sign(M || 1);
  for (let i = 0; i < 100; i++) {
    const f = e * Math.sinh(H) - H - M;
    const df = e * Math.cosh(H) - 1;
    const passo = f / df;
    H -= passo;
    if (Math.abs(passo) < 1e-12) break;
  }
  return H;
}

// Posizione eliocentrica di un corpo minore, in coordinate eclittiche
// J2000 e unità astronomiche.
//
// Accetta tutt'e due i modi di scrivere un'orbita: {a, M0, epoca} come
// si usa per gli asteroidi, {q, tPerielio} come si usa per le comete.
function posizioneCorpoMinore(elementi, data) {
  const jd = giornoGiuliano(data);
  const D2R = Math.PI / 180;
  const e = elementi.e;

  let nu, r;

  if (e < 0.98 || (e < 1 && elementi.a)) {
    // --- ellisse ---
    const a = elementi.a !== undefined ? elementi.a : elementi.q / (1 - e);
    const n = GAUSS_K / Math.pow(a, 1.5);          // moto medio, rad/giorno
    const M = elementi.M0 !== undefined
      ? elementi.M0 * D2R + n * (jd - elementi.epoca)
      : n * (jd - elementi.tPerielio);
    const E = risolviKepleroEllittico(M, e);
    nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    r = a * (1 - e * Math.cos(E));

  } else if (Math.abs(e - 1) < 0.001) {
    // --- parabola ---
    const b = risolviBarker(elementi.q, jd - elementi.tPerielio);
    nu = b.nu; r = b.r;

  } else if (e > 1) {
    // --- iperbole ---
    const a = elementi.q / (e - 1);
    const n = GAUSS_K / Math.pow(a, 1.5);
    const M = n * (jd - elementi.tPerielio);
    const H = risolviKepleroIperbolico(M, e);
    nu = 2 * Math.atan2(Math.sqrt(e + 1) * Math.sinh(H / 2), Math.sqrt(e - 1) * Math.cosh(H / 2));
    r = a * (e * Math.cosh(H) - 1);

  } else {
    // --- ellisse molto eccentrica, senza semiasse dichiarato ---
    const a = elementi.q / (1 - e);
    const n = GAUSS_K / Math.pow(a, 1.5);
    const M = n * (jd - elementi.tPerielio);
    const E = risolviKepleroEllittico(M, e);
    nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    r = a * (1 - e * Math.cos(E));
  }

  // Dal piano dell'orbita al piano dell'eclittica: tre rotazioni in fila
  // — l'argomento del pericentro, l'inclinazione, la longitudine del
  // nodo. È la stessa sequenza da duecento anni.
  const u = nu + elementi.peri * D2R;             // argomento di latitudine
  const cosU = Math.cos(u), sinU = Math.sin(u);
  const cosI = Math.cos(elementi.i * D2R), sinI = Math.sin(elementi.i * D2R);
  const cosN = Math.cos(elementi.nodo * D2R), sinN = Math.sin(elementi.nodo * D2R);

  return {
    x: r * (cosN * cosU - sinN * sinU * cosI),
    y: r * (sinN * cosU + cosN * sinU * cosI),
    z: r * (sinU * sinI),
    r,                                            // distanza dal Sole, UA
    nu                                            // anomalia vera
  };
}

// L'inclinazione dell'eclittica a J2000: serve a passare dalle
// coordinate eclittiche (in cui si scrivono le orbite) a quelle
// equatoriali (in cui si disegna il cielo).
const OBLIQUITA_J2000 = 23.4392911 * Math.PI / 180;

function eclitticheAEquatoriali(v) {
  const c = Math.cos(OBLIQUITA_J2000), s = Math.sin(OBLIQUITA_J2000);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

// Dove si vede da qui, adesso: ascensione retta, declinazione,
// distanza dalla Terra e magnitudine.
function corpoMinoreInCielo(elementi, data) {
  if (typeof Astronomy === 'undefined') return null;

  let terra;
  try {
    terra = Astronomy.HelioVector('Earth', Astronomy.MakeTime(data));
  } catch (e) {
    return null;
  }

  const elio = posizioneCorpoMinore(elementi, data);
  // Il vettore geocentrico è la differenza fra i due eliocentrici. La
  // Terra ce l'abbiamo già in coordinate equatoriali J2000 (è così che
  // le dà la libreria), quindi il corpo va portato lì anche lui.
  const eq = eclitticheAEquatoriali(elio);
  const dx = eq.x - terra.x, dy = eq.y - terra.y, dz = eq.z - terra.z;
  const delta = Math.hypot(dx, dy, dz);

  const raOre = ((Math.atan2(dy, dx) * 12 / Math.PI) + 24) % 24;
  const dec = Math.asin(dz / delta) * 180 / Math.PI;

  return {
    ra: raOre, dec,
    distanzaSole: elio.r,
    distanzaTerra: delta,
    mag: magnitudineCorpoMinore(elementi, elio.r, delta),
    // L'elongazione dal Sole dice se è osservabile o se è persa nella
    // luce del giorno: sotto i 15° non c'è niente da fare.
    elongazione: elongazioneDalSole(terra, eq)
  };
}

function elongazioneDalSole(terra, corpo) {
  // Terra→Sole è l'opposto di Sole→Terra
  const ts = [-terra.x, -terra.y, -terra.z];
  const tc = [corpo.x - terra.x, corpo.y - terra.y, corpo.z - terra.z];
  const cos = scalare(versoreDi(ts), versoreDi(tc));
  return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
}

// Quanto è luminoso.
//
// Sono due formule diverse, perché sono due oggetti diversi. Un
// asteroide è un sasso che riflette: la sua luce segue la distanza in
// modo prevedibile, con una correzione per la fase (mezzo asteroide
// illuminato dà meno luce di uno pieno) — è il sistema H·G.
//
// Una cometa no: è una palla di ghiaccio che si mette a evaporare
// avvicinandosi al Sole, e più si scalda più materia butta fuori. La
// sua luminosità cresce molto più in fretta di quanto la sola distanza
// giustifichi, e di quanto in fretta lo dice un esponente misurato caso
// per caso. È anche il motivo per cui le previsioni sulle comete
// sbagliano così spesso: quell'esponente cambia mentre la cometa arriva.
function magnitudineCorpoMinore(el, r, delta) {
  if (el.H === null || el.H === undefined) return null;

  if (el.tipo === 'cometa') {
    const n = el.G !== null && el.G !== undefined ? el.G : 4;
    return el.H + 5 * Math.log10(delta) + 2.5 * n * Math.log10(r);
  }

  // Asteroide, sistema H·G semplificato: si trascura l'angolo di fase,
  // che per un oggetto della fascia principale visto dalla Terra resta
  // sempre piccolo e vale al massimo qualche decimo di magnitudine.
  return el.H + 5 * Math.log10(r * delta);
}


// =====================================================================
// 3. IL REGISTRO DEI CORPI MINORI
//     Quelli che arrivano col file dei dati, più quelli che si
//     aggiungono a mano incollando gli elementi dell'MPC.
// =====================================================================

const CHIAVE_CORPI_MIEI = 'astrocalendario_corpi_minori_miei';

const corpiMinori = {
  stato: 'niente',
  promessa: null,
  elenco: [],           // quelli del file
  miei: []              // quelli incollati dall'utente
};

function corpiMinoriCarica() {
  if (corpiMinori.promessa) return corpiMinori.promessa;
  corpiMinori.stato = 'in-corso';

  corpiMinori.promessa = new Promise((risolvi, rifiuta) => {
    const s = document.createElement('script');
    s.src = 'dati-corpi-minori.js';
    s.async = false;
    s.onload = () => risolvi();
    s.onerror = () => rifiuta(new Error('dati-corpi-minori.js non si carica'));
    document.head.appendChild(s);
  })
    .then(() => {
      corpiMinori.elenco = typeof CORPI_MINORI !== 'undefined' ? CORPI_MINORI.slice() : [];
      corpiMinoriCaricaMiei();
      corpiMinori.stato = 'pronto';
      if (typeof skyInvalidaElenco === 'function') skyInvalidaElenco();
      return true;
    })
    .catch(e => {
      console.warn('Corpi minori non caricati:', e);
      corpiMinori.stato = 'fallito';
      corpiMinoriCaricaMiei();          // i propri restano comunque
      return false;
    });

  return corpiMinori.promessa;
}

function corpiMinoriCaricaMiei() {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_CORPI_MIEI) || '[]');
    corpiMinori.miei = Array.isArray(v) ? v : [];
  } catch (e) {
    corpiMinori.miei = [];
  }
}

function corpiMinoriSalvaMiei() {
  try {
    localStorage.setItem(CHIAVE_CORPI_MIEI, JSON.stringify(corpiMinori.miei));
  } catch (e) { /* storage pieno */ }
}

function corpiMinoriTutti() {
  // Se il file dei dati è già in pagina ma il caricatore non è passato
  // (succede quando lo carica qualcun altro — il banco di prova, o un
  // <script> messo a mano in index.html) si prende lo stesso, invece di
  // rispondere che non c'è niente mentre i dati sono lì.
  if (!corpiMinori.elenco.length && typeof CORPI_MINORI !== 'undefined') {
    corpiMinori.elenco = CORPI_MINORI.slice();
  }
  return corpiMinori.elenco.concat(corpiMinori.miei);
}

// --- incollare gli elementi dell'MPC ---
//
// Il Minor Planet Center pubblica gli elementi in un formato a colonne
// fisse pensato per le schede perforate, che nessuno legge a occhio, e
// in un formato a righe leggibile che invece si può incollare. Questo
// legge il secondo, più il formato "una riga per campo" che si ottiene
// copiando dalla pagina di un corpo sul sito del JPL.
//
// Non è una promessa di leggere qualunque cosa: è una scorciatoia per
// non dover scrivere sei numeri in sei caselle, con la possibilità di
// controllarli dopo. Quello che non riesce a capire lo dice.
function corpiMinoriLeggiIncollato(testo) {
  if (!testo || typeof testo !== 'string') return { errore: 'Non c\'è niente da leggere.' };

  const trova = (...chiavi) => {
    for (const k of chiavi) {
      const m = testo.match(new RegExp(k + '\\s*[=:]?\\s*(-?[\\d.]+)', 'i'));
      if (m) { const v = parseFloat(m[1]); if (isFinite(v)) return v; }
    }
    return null;
  };

  const e = trova('eccentricity', '\\be\\b');
  const i = trova('inclination', '\\bi\\b', 'incl');
  const nodo = trova('ascending node', 'longitude of the ascending node', '\\bnode\\b', 'Omega', '\\bOM\\b');
  const peri = trova('argument of peri\\w*', 'arg.? of peri\\w*', '\\bw\\b', '\\bperi\\b');
  const a = trova('semi-?major axis', '\\ba\\b');
  const q = trova('perihelion distance', '\\bq\\b');
  const M0 = trova('mean anomaly', '\\bM\\b', '\\bMA\\b');
  const epoca = trova('epoch');

  if (e === null || i === null || nodo === null || peri === null) {
    return { errore: 'Mancano l\'eccentricità, l\'inclinazione, il nodo o l\'argomento del perielio: senza quei quattro non si può calcolare niente.' };
  }
  if (a === null && q === null) {
    return { errore: 'Manca il semiasse maggiore (a) o la distanza al perielio (q).' };
  }

  const nomeMatch = testo.match(/^\s*([A-Za-z0-9][^\n=:]{2,40}?)\s*$/m);
  const voce = {
    nome: nomeMatch ? nomeMatch[1].trim() : 'Corpo senza nome',
    tipo: (e > 0.5 || (q !== null && a === null)) ? 'cometa' : 'asteroide',
    e, i, nodo, peri,
    H: trova('absolute magnitude', '\\bH\\b', '\\bM1\\b'),
    G: trova('slope', '\\bG\\b', '\\bK1\\b'),
    mio: true
  };

  if (a !== null && M0 !== null) {
    voce.a = a; voce.M0 = M0;
    // Un'epoca la si può dare in giorni giuliani o come data: se il
    // numero è piccolo non è un giorno giuliano, ed è meglio dirlo che
    // calcolare una posizione sbagliata di anni.
    if (epoca === null || epoca < 2000000) {
      return { errore: 'C\'è il semiasse e l\'anomalia media, ma l\'epoca manca o non è un giorno giuliano: senza, l\'anomalia media non vuol dire niente.' };
    }
    voce.epoca = epoca;
  } else if (q !== null) {
    voce.q = q;
    const tp = trova('time of perihelion', 'perihelion passage', '\\bTp\\b', '\\bT\\b');
    if (tp === null || tp < 2000000) {
      return { errore: 'C\'è la distanza al perielio ma non l\'istante del passaggio (Tp, in giorni giuliani).' };
    }
    voce.tPerielio = tp;
  }

  return { voce };
}

function corpoMinoreAggiungi(voce) {
  if (!voce || !voce.nome) return false;
  corpiMinori.miei = corpiMinori.miei.filter(c => c.nome !== voce.nome);
  corpiMinori.miei.push(voce);
  corpiMinoriSalvaMiei();
  if (typeof skyInvalidaElenco === 'function') skyInvalidaElenco();
  return true;
}

function corpoMinoreTogli(nome) {
  corpiMinori.miei = corpiMinori.miei.filter(c => c.nome !== nome);
  corpiMinoriSalvaMiei();
  if (typeof skyInvalidaElenco === 'function') skyInvalidaElenco();
}


// =====================================================================
// 4. QUELLI CHE VALE LA PENA GUARDARE STASERA
//     Sessanta corpi minori in elenco non servono a nessuno: quasi tutti
//     sono di quindicesima magnitudine e non si vedono. Servono quelli
//     che stasera, da qui, si vedono davvero.
// =====================================================================

// Magnitudine oltre la quale non ha senso proporre un corpo minore: è
// quella che un 200 mm da un cielo di periferia raggiunge a fatica.
//
// È una soglia sola, e prima non lo era: l'elenco degli astri si fermava a
// 12,5 e la mappa a 11,5, così una cometa di dodicesima compariva nel
// pannello, uno la sceglieva, e sul cielo non c'era niente da nessuna
// parte — né il puntino, né la freccia guida, perché `corpiMinoriVisibili`
// non l'aveva calcolata. Un nome nell'elenco è una promessa: quello che si
// può scegliere si deve poter trovare.
const CORPI_MAG_UTILE = 12.5;

function corpiMinoriInteressanti(data, magMassima) {
  const limite = magMassima !== undefined ? magMassima : CORPI_MAG_UTILE;
  const quando = data || new Date();

  return corpiMinoriTutti()
    .map(el => {
      const p = corpoMinoreInCielo(el, quando);
      if (!p || p.mag === null) return null;
      return Object.assign({ elementi: el, nome: el.nome, tipo: el.tipo }, p);
    })
    .filter(c => c && c.mag <= limite && c.elongazione >= 15)
    .sort((a, b) => a.mag - b.mag);
}

// Le voci da aggiungere all'elenco degli astri del planetario. Solo
// quelle visibili: un elenco di sessanta nomi di cui cinquantacinque
// invisibili è peggio che non averlo.
function corpiMinoriVociElenco(data) {
  if (corpiMinori.stato !== 'pronto' && !corpiMinori.miei.length) return [];

  return corpiMinoriInteressanti(data).map(c => ({
    id: 'min:' + c.nome,
    nome: c.nome,
    disegno: c.tipo === 'cometa' ? 'cometa' : 'asteroide',
    colore: c.tipo === 'cometa' ? '#a7f3d0' : '#fcd34d',
    tipo: 'corpoMinore',
    sottotipo: c.tipo,
    mag: c.mag,
    ra: c.ra,
    dec: c.dec
  }));
}

function corpoMinoreDiId(id) {
  if (typeof id !== 'string' || !id.startsWith('min:')) return null;
  const nome = id.slice(4);
  return corpiMinoriTutti().find(c => c.nome === nome) || null;
}


// =====================================================================
// 5. IN CIELO
//     Un corpo minore che compare nell'elenco ma non sulla mappa è una
//     promessa non mantenuta: uno legge «cometa di sesta magnitudine»,
//     tocca il nome e non trova niente da nessuna parte. Qui si calcolano
//     le posizioni sull'orizzonte, si disegnano e si possono toccare.
// =====================================================================

// Le posizioni si rifanno di rado di proposito: un asteroide si sposta di
// qualche primo d'arco al giorno, e ricalcolare Keplero per sessanta
// corpi a ogni fotogramma sarebbe spendere un millisecondo per non
// muovere niente. Mezzo minuto è precisione da avanzo.
const CORPI_CACHE_MS = 30000;
let corpiInCielo = { quando: 0, offset: null, elenco: [] };

function corpiMinoriVisibili() {
  if (typeof sky === 'undefined' || !sky.observer || typeof Astronomy === 'undefined') return [];
  if (!sky.mostraCorpiMinori) return [];

  const istante = typeof skyAdesso === 'function' ? skyAdesso() : new Date();
  const offset = typeof sky.offsetTempoSec === 'number' ? sky.offsetTempoSec : 0;

  // La macchina del tempo invalida la cache: se si è saltati a un altro
  // giorno le posizioni di mezzo minuto fa non valgono più niente.
  if (Date.now() - corpiInCielo.quando < CORPI_CACHE_MS && corpiInCielo.offset === offset) {
    return corpiInCielo.elenco;
  }

  const t = Astronomy.MakeTime(istante);
  const elenco = [];

  corpiMinoriInteressanti(istante).forEach(c => {
    try {
      // corpoMinoreInCielo dà coordinate J2000; Horizon vuole quelle di
      // oggi, come per tutti gli altri cataloghi.
      const oggi = typeof skyJ2000AllaData === 'function'
        ? skyJ2000AllaData(c.ra, c.dec, t)
        : { ra: c.ra, dec: c.dec };
      const hor = Astronomy.Horizon(t, sky.observer, oggi.ra, oggi.dec, 'normal');
      elenco.push(Object.assign({}, c, {
        az: hor.azimuth, alt: hor.altitude,
        raOra: oggi.ra, decOra: oggi.dec,
        sottotipo: c.tipo,
        disegno: c.tipo === 'cometa' ? 'cometa' : 'asteroide'
      }));
    } catch (e) { /* fuori scala: si salta */ }
  });

  corpiInCielo = { quando: Date.now(), offset, elenco };
  return elenco;
}

// Dove va la coda, sullo schermo.
//
// Non dietro alla cometa: **in direzione opposta al Sole**. La coda non la
// tira il movimento, la spinge il vento solare, e questo è il fatto che
// sorprende tutti la prima volta — mezza cometa in cielo ha la coda
// davanti a sé, perché sta tornando verso l'esterno del Sistema Solare.
//
// Basta il Sole proiettato: la direzione da lui alla cometa, sullo
// schermo, è già la direzione della coda. Quando il Sole è dietro
// l'osservatore la sua proiezione non c'è, e allora la coda si tace
// invece di puntare a caso.
function corpiMinoriDirezioneCoda(p, base, focale) {
  if (typeof sky === 'undefined' || !sky.oggetti) return null;
  const sole = sky.oggetti.find(o => o.id === 'Sun');
  if (!sole || typeof sole.az !== 'number') return null;
  const ps = skyProietta(skyVettore(sole.az, sole.alt), base, focale);
  if (!ps.davanti) return null;
  const dx = p.px - ps.px, dy = p.py - ps.py;
  const n = Math.hypot(dx, dy);
  if (n < 1) return null;
  return { x: dx / n, y: dy / n };
}

// Sulla mappa sono un puntino con il nome accanto, e le comete hanno un
// accenno di coda — che punta sempre in direzione opposta al Sole, perché
// è il vento solare a spingerla, non il movimento della cometa.
function corpiMinoriDisegna(ctx, base, focale) {
  const elenco = corpiMinoriVisibili();
  if (!elenco.length) return;

  const velo = typeof skyVelo === 'function' ? skyVelo() : 1;
  if (velo < 0.05) return;

  ctx.save();
  elenco.forEach(c => {
    if (c.alt < 0 && !sky.mostraSottoOrizzonte) return;
    const p = skyProietta(skyVettore(c.az, c.alt), base, focale);
    if (!p.davanti) return;
    if (p.px < -40 || p.px > sky.larghezza + 40 || p.py < -40 || p.py > sky.altezza + 40) return;

    const opacita = (c.alt < 0 ? 0.25 : 1) * velo;
    const cometa = c.tipo === 'cometa';
    const colore = cometa ? '#a7f3d0' : '#fcd34d';
    // Le più luminose un po' più grosse, come per le stelle. Il fondo
    // scala sul limite dell'elenco: una di dodicesima resta un puntino,
    // una di sesta si vede da lontano.
    const r = Math.max(2.2, 6.4 - c.mag * 0.42);

    if (cometa) {
      // La coda, prima di tutto: sta dietro alla chioma, non davanti.
      // Quanto è lunga non è un dato che abbiamo — dipende da quanta
      // materia sta buttando fuori, che è la cosa che le comete non
      // dicono mai in anticipo. Si usa la luminosità come indizio,
      // perché è la stessa causa: quello che la fa brillare è quello che
      // le fa la coda.
      const coda = corpiMinoriDirezioneCoda(p, base, focale);
      if (coda && c.mag < 11) {
        const lungo = Math.min(120, Math.max(14, (11 - c.mag) * 13));
        const fx = p.px + coda.x * lungo, fy = p.py + coda.y * lungo;
        const sfuma = ctx.createLinearGradient(p.px, p.py, fx, fy);
        sfuma.addColorStop(0, `rgba(167, 243, 208, ${0.34 * opacita})`);
        sfuma.addColorStop(1, 'rgba(167, 243, 208, 0)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = sfuma;
        // Un cuneo, non una riga: larga alla fine e stretta alla chioma,
        // che è il verso in cui si apre davvero
        const larga = Math.max(3, r * 2.4);
        ctx.beginPath();
        ctx.moveTo(p.px - coda.y * r * 0.8, p.py + coda.x * r * 0.8);
        ctx.lineTo(fx - coda.y * larga, fy + coda.x * larga);
        ctx.lineTo(fx + coda.y * larga, fy - coda.x * larga);
        ctx.lineTo(p.px + coda.y * r * 0.8, p.py - coda.x * r * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // La chioma: una nuvoletta sfumata, non un punto netto — è quello
      // che distingue una cometa da una stella anche nel binocolo.
      const alone = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, r * 3.4);
      alone.addColorStop(0, `rgba(167, 243, 208, ${0.55 * opacita})`);
      alone.addColorStop(1, 'rgba(167, 243, 208, 0)');
      ctx.fillStyle = alone;
      ctx.beginPath();
      ctx.arc(p.px, p.py, r * 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = opacita;
    ctx.fillStyle = colore;
    ctx.beginPath();
    ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
    ctx.fill();

    if (sky.mostraNomi) {
      ctx.globalAlpha = opacita * 0.85;
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      // I nomi delle comete sono lunghi ("C/2026 A3 (PANSTARRS)"): sulla
      // mappa sta la sigla, il resto lo dice la scheda.
      ctx.fillText(c.nome.split(' (')[0], p.px + r + 6, p.py);
    }
  });
  ctx.restore();
}


// =====================================================================
// 5. VETTORI — le tre righe che servono e basta
// =====================================================================

function scalare(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

function prodottoVettoriale(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function versoreDi(v) {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}
