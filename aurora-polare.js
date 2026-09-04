// =====================================================================
// LE AURORE POLARI — boreale e australe — nel planetario
//
// L'app sapeva già dire *se* stanotte vale la pena guardare a nord: il
// riquadro della dashboard legge il Kp del NOAA, lo confronta con la
// latitudine geomagnetica di casa e risponde sì o no (`meteo-astro.js`,
// sezione 4). Quello che non sapeva fare era mostrarla. E l'aurora è la
// cosa del cielo che più di tutte non si racconta a parole: chi non l'ha
// mai vista, leggendo «bagliore rosso basso sull'orizzonte nord» si
// immagina una fiammata, esce, vede un chiarore appena più caldo del
// solito sopra le colline e crede di essersela persa.
//
// Qui l'aurora si disegna. Non come un effetto decorativo appiccicato
// sopra l'orizzonte, ma come sta davvero: un anello di luce attorno al
// polo geomagnetico, alto un centinaio di chilometri, visto **da dove
// sei**. Da questo discendono tutte le cose giuste senza doverle
// programmare a mano:
//
//   - dall'Islanda l'ovale ti passa sopra la testa e le tende scendono
//     dallo zenit;
//   - dalla Scozia è un arco verde basso a nord;
//   - dall'Italia, con la stessa tempesta, il verde resta sotto
//     l'orizzonte — sono seicento chilometri più in là, e la Terra è
//     tonda — e quello che si affaccia sopra le colline è solo la parte
//     alta della tenda, l'emissione rossa dell'ossigeno a duecento e
//     passa chilometri. È esattamente quello che si è visto dalla
//     Pianura Padana nel maggio del 2024: non archi verdi, un cielo
//     rosso a nord. Non c'è nessuna riga di codice che dica «in Italia
//     fai il rosso»: viene fuori dalla geometria.
//   - e sotto l'equatore magnetico l'anello è quello australe, attorno
//     all'altro polo, e lo si guarda a sud.
//
// COME È FATTO IL CONTO, in quattro passi.
//
//   1. Il campo magnetico terrestre si approssima con un dipolo
//      inclinato: un polo nord geomagnetico a 80,7°N 72,7°O e il suo
//      antipodo a sud. Attorno a quel polo si definisce una latitudine
//      e una longitudine magnetiche, che sono quelle che comandano
//      l'aurora — non le geografiche.
//   2. L'ovale aurorale non è un cerchio centrato sul polo: è schiacciato
//      verso il lato notte. A mezzanotte magnetica scende di parecchio
//      verso l'equatore, a mezzogiorno risale verso il polo. Quindi la
//      sua posizione nel cielo dipende dall'ora, e girando l'orologio del
//      planetario la si vede scendere verso mezzanotte e risalire.
//   3. Quanto scende lo dice il Kp, l'indice di disturbo geomagnetico da
//      0 a 9: ogni punto vale un paio di gradi di latitudine.
//   4. Ogni punto dell'ovale è un pezzo di atmosfera alto fra i 90 e i
//      400 chilometri, e da qui lo si vede sotto un certo angolo. È lo
//      stesso conto della cresta di montagna lontana in `terreno.js`,
//      con la Terra tonda in mezzo — solo che qui la "montagna" è alta
//      duecento chilometri e sta a mille di distanza.
//
// I COLORI non sono scelti a gusto: sono le righe di emissione.
// L'ossigeno atomico a 557,7 nm — il verde di tutte le fotografie — sta
// fra i 100 e i 180 km; sopra i 200 domina il rosso a 630,0 nm, che è la
// stessa riga ma da uno stato che a bassa quota si spegne prima di
// emettere; sotto i 100, nelle tempeste forti, l'azoto ionizzato mette
// la frangia viola-rosata alla base delle tende.
//
// Ordine di caricamento: dopo `app.js` (usa `sky`, `skyProietta`,
// `skyVettore`, `skyLuogoDelCielo`) e accanto a `meteo-astro.js`, da cui
// legge il Kp vero quando c'è. Se il Kp non c'è — e per una data del
// passato o del futuro non c'è mai — resta la simulazione, che è poi il
// modo in cui questa vista si usa quasi sempre: l'aurora vera, da qui,
// capita una volta ogni dieci anni.
// =====================================================================


// =====================================================================
// 1. IL DIPOLO
//     Dove sta il polo magnetico, e come si gira il mondo attorno a lui.
// =====================================================================

// Poli geomagnetici del dipolo, epoca 2025. Il sud non è un dato a sé:
// per definizione di dipolo è l'antipodo del nord.
const AUR_POLO_NORD = { lat: 80.7, lon: -72.7 };
const AUR_POLO_SUD = { lat: -80.7, lon: 107.3 };

const AUR_D2R = Math.PI / 180;
const AUR_R2D = 180 / Math.PI;

// Raggio terrestre medio: lo stesso di `terreno.js`.
const AUR_RAGGIO_KM = 6371;

function aurVersore(lat, lon) {
  const la = lat * AUR_D2R, lo = lon * AUR_D2R;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

function aurPunto(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

function aurCroce(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function aurNormalizza(v) {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

// La terna del mondo magnetico: `z` verso il polo scelto, `x` sul
// meridiano che contiene il polo sud geografico (è la convenzione
// classica delle coordinate geomagnetiche), `y` a chiudere.
//
// `verso` serve a una sottigliezza dell'emisfero australe: ribaltando la
// terna si ribalta anche il senso in cui cresce la longitudine, e con lui
// il senso in cui gira l'ora magnetica. Un ±1 rimette le cose a posto e
// fa sì che il settore prima di mezzanotte — quello dove l'aurora è più
// viva — stia dalla parte giusta anche in Tasmania.
function aurRiferimento(polo) {
  const z = aurVersore(polo.lat, polo.lon);
  const giu = [0, 0, -1];
  const proiezione = aurPunto(giu, z);
  const x = aurNormalizza([
    giu[0] - proiezione * z[0],
    giu[1] - proiezione * z[1],
    giu[2] - proiezione * z[2]
  ]);
  return { z, x, y: aurCroce(z, x), verso: polo.lat >= 0 ? 1 : -1, polo };
}

// Da geografiche a magnetiche. La latitudine è **sempre positiva verso il
// polo scelto**: nell'emisfero sud, con la terna australe, la Tasmania ha
// latitudine magnetica positiva. Tutta la matematica dell'ovale può così
// restare una sola, scritta una volta.
function aurMagnetiche(lat, lon, rif) {
  const v = aurVersore(lat, lon);
  const z = Math.max(-1, Math.min(1, aurPunto(v, rif.z)));
  return {
    lat: Math.asin(z) * AUR_R2D,
    lon: Math.atan2(aurPunto(v, rif.y), aurPunto(v, rif.x)) * AUR_R2D * rif.verso
  };
}

// L'inverso: dal punto dell'ovale al punto della Terra sotto di lui.
function aurGeografiche(latM, lonM, rif) {
  const la = latM * AUR_D2R, lo = lonM * rif.verso * AUR_D2R;
  const u = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const g = [
    u[0] * rif.x[0] + u[1] * rif.y[0] + u[2] * rif.z[0],
    u[0] * rif.x[1] + u[1] * rif.y[1] + u[2] * rif.z[1],
    u[0] * rif.x[2] + u[1] * rif.y[2] + u[2] * rif.z[2]
  ];
  return {
    lat: Math.asin(Math.max(-1, Math.min(1, g[2]))) * AUR_R2D,
    lon: Math.atan2(g[1], g[0]) * AUR_R2D
  };
}

// Il punto della Terra che in questo istante ha il Sole allo zenit. Serve
// per l'ora magnetica: l'ovale sta fermo rispetto al Sole, ed è la Terra
// che gli gira sotto.
function aurSubsolare(data) {
  if (typeof Astronomy !== 'undefined') {
    try {
      const eq = Astronomy.Equator(Astronomy.Body.Sun, data, aurOsservatoreZero(), true, true);
      const gast = Astronomy.SiderealTime(data);            // ore siderali di Greenwich
      return { lat: eq.dec, lon: aurNormLon((eq.ra - gast) * 15) };
    } catch (e) { /* si ripiega sull'ora UTC */ }
  }
  // Ripiego senza libreria: il Sole sul meridiano di Greenwich a
  // mezzogiorno UTC. Sbaglia fino a un quarto di grado per l'equazione del
  // tempo, che su un ovale largo migliaia di chilometri non si vede.
  const ore = data.getUTCHours() + data.getUTCMinutes() / 60 + data.getUTCSeconds() / 3600;
  return { lat: 0, lon: aurNormLon(180 - ore * 15) };
}

let aurOsservatoreCache = null;
function aurOsservatoreZero() {
  if (!aurOsservatoreCache) aurOsservatoreCache = new Astronomy.Observer(0, 0, 0);
  return aurOsservatoreCache;
}

function aurNormLon(g) {
  let v = g % 360;
  if (v > 180) v -= 360;
  if (v < -180) v += 360;
  return v;
}


// =====================================================================
// 2. L'OVALE AURORALE
//     Che forma ha, quanto scende, e dove si accende di più.
// =====================================================================

// A che latitudine magnetica arriva il bordo verso l'equatore a
// mezzanotte magnetica, per ogni punto di Kp. È la stessa scala che usa
// `auroraDaQui()` in meteo-astro.js — 66,5° con Kp 0, un paio di gradi in
// meno per ogni punto — scritta come retta invece che come tabella,
// perché qui il Kp può essere anche 4,7.
const AUR_CONFINE_ZERO = 66.5;
const AUR_CONFINE_PER_KP = 2.05;

// Di quanto l'ovale è schiacciato verso il lato notte. A mezzogiorno
// magnetico il bordo sta una decina di gradi più vicino al polo: è la
// forma a uovo di tutte le carte dell'ovale, e conta parecchio, perché è
// il motivo per cui l'aurora si vede **di notte** — non solo perché di
// giorno c'è il Sole, ma perché di giorno l'anello è più su.
const AUR_SBILANCIO = 9;

// Lo spessore della fascia: più larga a mezzanotte, più larga con la
// tempesta.
const AUR_SPESSORE_BASE = 3;
const AUR_SPESSORE_PER_KP = 0.35;
const AUR_SPESSORE_NOTTE = 4;

// L'ora magnetica dove l'ovale è più vivo. Non è mezzanotte esatta: le
// sottotempeste scattano nel settore serale, un'ora o due prima.
const AUR_ORA_PIU_VIVA = 22.5;

// L'angolo attorno all'ovale, contato da mezzanotte magnetica.
function aurAngoloOra(mlt) { return mlt / 24 * 2 * Math.PI; }

// Il bordo verso l'equatore, in latitudine magnetica.
function aurBordo(kp, mlt) {
  const mezzanotte = AUR_CONFINE_ZERO - AUR_CONFINE_PER_KP * kp;
  return mezzanotte + AUR_SBILANCIO * (1 - Math.cos(aurAngoloOra(mlt))) / 2;
}

function aurSpessore(kp, mlt) {
  return AUR_SPESSORE_BASE + AUR_SPESSORE_PER_KP * kp +
    AUR_SPESSORE_NOTTE * (1 + Math.cos(aurAngoloOra(mlt))) / 2;
}

// Quanto è accesa quella parte dell'anello. Il settore di mezzogiorno c'è
// sempre — l'ovale è chiuso — ma è debolissimo; quello prima di
// mezzanotte è dove si vedono le tende che si muovono.
function aurLuminositaOra(mlt) {
  let d = mlt - AUR_ORA_PIU_VIVA;
  while (d > 12) d -= 24;
  while (d < -12) d += 24;
  const c = Math.cos(d / 24 * 2 * Math.PI);
  return 0.16 + 0.84 * Math.pow((1 + c) / 2, 1.3);
}

// Le quote: dove sta la luce, e di che colore è lì.
//
// Sono le righe di emissione, non una tavolozza. Il verde dell'ossigeno
// atomico (557,7 nm) vive fra i 100 e i 180 km, dove l'aria è ancora
// abbastanza densa da eccitarlo ma non tanto da spegnerlo per urto. Il
// rosso (630,0 nm) è la stessa specie da uno stato che dura otto secondi:
// sotto i 200 km non fa in tempo a emettere, e per questo il rosso è
// **sempre** la parte alta della tenda. Il viola alla base è azoto
// ionizzato, e si accende solo quando le particelle arrivano abbastanza
// energiche da scendere così in basso: cioè nelle tempeste vere.
const AUR_QUOTE = [
  { km: 90,  colore: [178, 96, 236],  alfa: 0.22, soloTempesta: true },
  { km: 104, colore: [96, 255, 176],  alfa: 0.92 },
  { km: 125, colore: [78, 250, 150],  alfa: 1.00 },
  { km: 155, colore: [128, 246, 132], alfa: 0.76 },
  { km: 195, colore: [206, 232, 116], alfa: 0.46 },
  { km: 250, colore: [255, 138, 108], alfa: 0.32 },
  { km: 320, colore: [255, 74, 92],   alfa: 0.20 },
  { km: 420, colore: [214, 40, 74],   alfa: 0 }
];

// Sotto questa quota si parla di "verde": se il verde è sotto l'orizzonte
// e il rosso no, siamo nel caso italiano.
const AUR_QUOTA_VERDE = 180;

// E "sopra l'orizzonte" vuol dire almeno tre gradi. Sotto, il verde c'è
// per la geometria ma non per l'occhio: dieci masse d'aria lo spengono, e
// comunque davanti c'è quasi sempre una collina. Dire «archi verdi
// visibili» per un grado di altezza sarebbe far uscire di casa qualcuno
// per niente — il conto sarebbe pure giusto, e la serata buttata.
const AUR_VERDE_MIN_ALT = 3;

// Le falde: l'ovale ha uno spessore, e da vicino non è un muro ma un
// susseguirsi di tende. Da lontano se ne vede una sola — le altre stanno
// dietro e più in alto, e disegnarle tutte vorrebbe dire sommare tre volte
// la stessa luce.
const AUR_FALDE = [
  { dentro: 0, peso: 1 },
  { dentro: 0.3, peso: 0.85 },
  { dentro: 0.6, peso: 0.72 },
  { dentro: 0.9, peso: 0.6 }
];

// Quanti punti lungo l'anello. Novantasei fanno un campione ogni quarto
// d'ora magnetico: sullo schermo, anche con l'ovale sopra la testa, sono
// colonne di una decina di pixel.
const AUR_CAMPIONI = 96;


// =====================================================================
// 3. DA LASSÙ A QUI
//     Sotto che angolo si vede un pezzo di atmosfera alto duecento
//     chilometri e lontano mille.
// =====================================================================

// Azimut e distanza angolare fra due punti della Terra.
function aurRotta(lat0, lon0, lat, lon) {
  const la0 = lat0 * AUR_D2R, la = lat * AUR_D2R, dl = (lon - lon0) * AUR_D2R;
  const cos = Math.sin(la0) * Math.sin(la) + Math.cos(la0) * Math.cos(la) * Math.cos(dl);
  const psi = Math.acos(Math.max(-1, Math.min(1, cos)));
  const az = Math.atan2(
    Math.sin(dl) * Math.cos(la),
    Math.cos(la0) * Math.sin(la) - Math.sin(la0) * Math.cos(la) * Math.cos(dl)
  ) * AUR_R2D;
  return { psi, az: (az + 360) % 360 };
}

// L'altezza sull'orizzonte di un punto a quota `km` visto da qui, con la
// Terra tonda in mezzo. È il conto che decide tutto: con la stessa
// tempesta, da Reykjavík l'ovale è allo zenit e da Bologna il suo verde è
// due gradi **sotto** l'orizzonte.
function aurAltezza(psi, km) {
  const r = AUR_RAGGIO_KM, R = AUR_RAGGIO_KM + km;
  const orizzontale = R * Math.sin(psi);
  const verticale = R * Math.cos(psi) - r;
  return Math.atan2(verticale, orizzontale) * AUR_R2D;
}

// L'aria che c'è in mezzo. Un arco a tre gradi sull'orizzonte lo si guarda
// attraverso dieci atmosfere: è il motivo per cui il bagliore rosso visto
// dall'Italia è sempre sul limite del percepibile, mentre lo stesso rosso
// visto dalla Norvegia riempie il cielo. La massa d'aria è la formula di
// Kasten-Young, l'estinzione un coefficiente basso: l'aurora è una riga di
// emissione, e le righe passano meglio del continuo.
function aurEstinzione(altGradi) {
  if (altGradi <= -1) return 0;
  const a = Math.max(0, altGradi);
  const massa = 1 / (Math.sin((a + 6.07995) * AUR_D2R) + 0.50572 * Math.pow(a + 6.07995, -1.6364));
  return Math.exp(-0.12 * Math.max(0, massa - 1));
}


// =====================================================================
// 4. LE PIEGHE E I RAGGI
//     Un'aurora non è una fascia uniforme: è un drappo appeso alle linee
//     del campo magnetico, con le pieghe che scorrono lungo l'arco e i
//     raggi verticali che appaiono e si spengono. Senza questo, il conto
//     giusto disegnerebbe una benda colorata — e nessuno che l'abbia vista
//     riconoscerebbe quello che sta guardando.
// =====================================================================

function aurCasuale(n) {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

// Rumore continuo a una dimensione: due valori a caso e una raccordata
// morbida in mezzo.
function aurOnda(x) {
  const i = Math.floor(x), f = x - i;
  const t = f * f * (3 - 2 * f);
  const a = aurCasuale(i), b = aurCasuale(i + 1);
  return a + (b - a) * t;
}

// Tre scale sovrapposte: le anse larghe dell'arco, le pieghe, i raggi.
// I pesi non sono uguali di proposito: le anse fanno quasi tutto, le
// pieghe modulano, i raggi appena increspano. Con i raggi forti ogni
// colonna aveva una luminosità sua e il drappo diventava una staccionata
// — le aste verticali vere si disegnano invece a parte, in `aurRaggio`,
// dove sono strette come si deve.
// `dettaglio` è l'inverso del passo di campionamento: quando le colonne si
// diradano, le frequenze fitte vanno diradate con loro. Senza, la piega
// fine cadeva fra un campione e l'altro e usciva a scalini — un drappo
// fatto di rettangoli, che è il difetto tipico di chi disegna un rumore
// campionandolo più largo della sua lunghezza d'onda.
function aurPiega(mlt, falda, fase, dettaglio) {
  const d = dettaglio || 1;
  const anse = aurOnda(mlt * 1.7 + fase * 0.35 + falda * 7.3);
  const pieghe = aurOnda(mlt * 5.1 * d - fase * 0.8 + falda * 3.1);
  const raggi = aurOnda(mlt * 19 * d + fase * 1.6 + falda * 11);
  return (0.42 + 0.58 * anse) * (0.66 + 0.34 * pieghe) * (0.82 + 0.18 * raggi);
}

// Il tetto della tenda, colonna per colonna: fra i 260 e i 450 km. Le
// tende non finiscono tutte alla stessa quota, ed è quello che rende il
// bordo alto frastagliato invece che tagliato con la riga.
function aurTetto(mlt, falda, fase) {
  return 260 + 190 * aurOnda(mlt * 3.3 + fase * 0.5 + falda * 5.7);
}

// Quanto scorre il disegno delle pieghe, al secondo di orologio vero.
// Un'aurora tranquilla si muove piano — l'occhio ci mette un minuto ad
// accorgersi che è cambiata; una in sottotempesta corre. Questa è la via
// di mezzo, scelta perché non distragga da tutto il resto del cielo.
const AUR_SCORRIMENTO = 0.055;


// =====================================================================
// 5. IL DISEGNO
// =====================================================================

// Sopra questa luce del cielo non si vede più niente: l'aurora è debole,
// e il crepuscolo la cancella molto prima delle stelle.
const AUR_LUCE_MAX = 0.26;

// La tela di servizio si dipinge a mezza risoluzione e si ricopia
// ingrandita. Due motivi, tutti e due buoni: si dimezza il riempimento, e
// soprattutto l'ingrandimento bilineare sfuma da sé le cuciture fra una
// colonna e l'altra — un'aurora è luce diffusa, e mezzo pixel di
// sfocatura la fa somigliare di più a quello che è.
const AUR_SCALA_TELA = 0.42;

// Il tetto di quadri per fotogramma (il passo di campionamento si adatta a
// lui, vedi `aurDisegna`). Con l'ovale sopra la testa e il campo a 180° ci
// starebbero tutte e novantasei le colonne per quattro falde: si salta di
// passo invece di disegnarne quattrocento.
const AUR_QUADRI_MAX = 80;

// Oltre questa larghezza (in pixel della tela di servizio) un quadro si
// taglia in fette, fino a un massimo di quattro.
const AUR_QUADRO_PX = 26;
const AUR_FETTE_MAX = 4;

const aur = {
  // Nasce **spenta**, come i nomi dei monti e i disegni delle costellazioni, e
  // per la stessa ragione: da queste latitudini l'ovale acceso non disegna
  // niente — sta sotto l'orizzonte, oltre la curvatura della Terra — mentre i
  // suoi comandi si prendevano due terzi della scheda «Cielo» a ogni apertura
  // del planetario. Adesso il tasto è quello che li apre: si preme «Aurora» e
  // compaiono la slitta della tempesta e la riga che dice cosa si vedrebbe da
  // qui. Quando l'aurora c'è per davvero non tocca all'utente accorgersene:
  // il riquadro della dashboard (`aurGuardaInCielo`), gli eventi «aurora» del
  // calendario e il banco della Didattica la accendono da sé.
  acceso: false,
  kpSimulato: null,        // null = si usa il Kp vero
  geo: null,
  chiave: '',
  tela: null,
  sfocata: null,
  notaQuando: 0,
  notaTesto: ''
};

// Il Kp da usare adesso: quello simulato se c'è, se no quello vero
// all'ora mostrata (la previsione del NOAA copre tre giorni; fuori da lì
// non c'è nessun Kp da mostrare, e per una data del 2031 non ci sarà mai).
function aurKpMostrato() {
  if (aur.kpSimulato !== null) return { kp: aur.kpSimulato, simulato: true };
  if (typeof aurora === 'undefined' || !aurora) return { kp: null, simulato: false };

  const quando = (typeof skyAdesso === 'function' ? skyAdesso() : new Date()).getTime();
  const prossime = Array.isArray(aurora.prossime) ? aurora.prossime : [];
  let vicino = null, scarto = Infinity;
  for (const p of prossime) {
    const t = p.quando instanceof Date ? p.quando.getTime() : new Date(p.quando).getTime();
    const d = Math.abs(t - quando);
    if (d < scarto) { scarto = d; vicino = p; }
  }
  // Tre ore: è il passo con cui il Kp è definito. Più in là della
  // previsione si smette di rispondere invece di stiracchiare l'ultimo
  // valore su una settimana.
  if (vicino && scarto <= 3 * 3600000) return { kp: vicino.kp, simulato: false };
  if (Math.abs(quando - Date.now()) <= 3 * 3600000 && typeof aurora.kp === 'number') {
    return { kp: aurora.kp, simulato: false };
  }
  return { kp: null, simulato: false };
}

// La luce propria dell'aurora, a parità di distanza. Cresce con il Kp, ma
// non da zero: anche con il campo tranquillo l'ovale c'è, e chi ci sta
// sotto lo vede.
function aurForzaDelKp(kp) {
  return 0.5 + 0.5 * Math.min(1, Math.max(0, kp) / 6);
}

// Tutta la geometria di questo istante: per ogni falda, un giro di colonne
// con il loro azimut e le altezze delle otto quote. Si rifà quando cambia
// l'ora (a passi di un quarto di minuto: l'ovale si sposta di un decimo di
// grado), il luogo o il Kp.
function aurGeometria(data, luogo, kp) {
  const chiave = [
    Math.round(data.getTime() / 15000),
    luogo.lat.toFixed(2), luogo.lon.toFixed(2), kp.toFixed(2)
  ].join('|');
  if (aur.chiave === chiave && aur.geo) return aur.geo;

  // Da che parte è il polo: la latitudine magnetica calcolata col polo
  // nord dice l'emisfero. All'equatore magnetico i due ovali sono
  // ugualmente lontani e non si vede né l'uno né l'altro: si prende quello
  // più vicino e la geometria concluderà da sé che sta sotto i piedi.
  const provaNord = aurMagnetiche(luogo.lat, luogo.lon, aurRiferimento(AUR_POLO_NORD));
  const boreale = provaNord.lat >= 0;
  const rif = aurRiferimento(boreale ? AUR_POLO_NORD : AUR_POLO_SUD);
  const mia = aurMagnetiche(luogo.lat, luogo.lon, rif);

  const sub = aurSubsolare(data);
  const subM = aurMagnetiche(sub.lat, sub.lon, rif);

  // Quante falde: da lontano una sola. Tutte e quattro solo quando l'ovale
  // è addosso, ed è lì che servono — sotto l'ovale il cielo è pieno di
  // tende su più piani, una dietro l'altra.
  const distanza = aurBordo(kp, 0) - mia.lat;
  const quante = distanza > 5 ? 1 : distanza > 2 ? 2 : AUR_FALDE.length;

  const falde = [];
  let altMassima = -90, azMassima = 0, verde = false;

  for (let f = 0; f < quante; f++) {
    const falda = AUR_FALDE[f];
    const colonne = [];
    for (let k = 0; k < AUR_CAMPIONI; k++) {
      const mlt = k * 24 / AUR_CAMPIONI;
      const lonM = subM.lon + (mlt - 12) * 15;
      const latM = aurBordo(kp, mlt) + falda.dentro * aurSpessore(kp, mlt);
      const g = aurGeografiche(latM, lonM, rif);
      const rotta = aurRotta(luogo.lat, luogo.lon, g.lat, g.lon);
      const alt = AUR_QUOTE.map(q => aurAltezza(rotta.psi, q.km));
      // I versori si calcolano **qui**, non a ogni fotogramma. Sono
      // trentadue punti per colonna fra tutte le falde, e rifarne i seni e
      // i coseni sessanta volte al secondo costava più di tutto il resto
      // del disegno messo insieme: la direzione di un punto dell'ovale non
      // cambia finché non cambia l'ora.
      const v = alt.map(a => skyVettore(rotta.az, a));

      colonne.push({ mlt, az: rotta.az, alt, v });

      // Il riepilogo si fa su tutte le falde, non solo sul bordo verso
      // l'equatore: chi sta sotto l'ovale ha il bordo lontano a sud e le
      // tende vere sopra la testa, e dicendogli l'altezza del solo bordo
      // gli si racconterebbe un'aurora bassa mentre gli piove addosso.
      const cima = alt[alt.length - 1];
      if (cima > altMassima) { altMassima = cima; azMassima = rotta.az; }
      for (let j = 0; j < AUR_QUOTE.length; j++) {
        if (AUR_QUOTE[j].km <= AUR_QUOTA_VERDE && alt[j] > AUR_VERDE_MIN_ALT) verde = true;
      }
    }
    falde.push({ colonne, peso: falda.peso, indice: f });
  }

  aur.chiave = chiave;
  aur.geo = { falde, boreale, mia: mia.lat, altMassima, azMassima, verde, kp };
  return aur.geo;
}

// La tela di servizio, a mezza risoluzione.
function aurTela() {
  const L = Math.max(2, Math.round(sky.larghezza * AUR_SCALA_TELA));
  const H = Math.max(2, Math.round(sky.altezza * AUR_SCALA_TELA));
  if (!aur.tela) {
    const c = document.createElement('canvas');
    aur.tela = { canvas: c, ctx: c.getContext('2d'), L: 0, H: 0 };
  }
  if (aur.tela.L !== L || aur.tela.H !== H) {
    aur.tela.canvas.width = L;
    aur.tela.canvas.height = H;
    aur.tela.L = L;
    aur.tela.H = H;
  }
  return aur.tela;
}

// La sfocatura del povero: si rimpicciolisce di quattro volte e si
// rimette grande. Due `drawImage` con l'interpolazione accesa, e la
// scheda video fa il resto.
function aurSfoca(tela) {
  const L = Math.max(2, Math.round(tela.L / 4));
  const H = Math.max(2, Math.round(tela.H / 4));
  if (!aur.sfocata) {
    const c = document.createElement('canvas');
    aur.sfocata = { canvas: c, ctx: c.getContext('2d'), L: 0, H: 0 };
  }
  const s = aur.sfocata;
  if (s.L !== L || s.H !== H) {
    s.canvas.width = L;
    s.canvas.height = H;
    s.L = L;
    s.H = H;
  }
  s.ctx.clearRect(0, 0, L, H);
  s.ctx.imageSmoothingEnabled = true;
  s.ctx.drawImage(tela.canvas, 0, 0, L, H);
  return s.canvas;
}

// Una colonna proiettata: gli otto punti sullo schermo (già in scala della
// tela di servizio). Torna `null` se non è disegnabile — dietro l'occhio,
// o così ai bordi della stereografica da valere decine di migliaia di
// pixel.
function aurProiettaColonna(c, base, focale, scala) {
  const p = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let j = 0; j < c.v.length; j++) {
    const q = skyProietta(c.v[j], base, focale);
    if (!q.davanti) return null;
    const x = q.px * scala, y = q.py * scala;
    if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 40000 || Math.abs(y) > 40000) return null;
    p.push({ x, y });
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { p, minX, maxX, minY, maxY, mlt: c.mlt, alt: c.alt };
}

// Il quadro fra due colonne. Il colore lungo l'altezza è un gradiente
// solo, appoggiato all'asse che va dalla base alla cima: le quote
// intermedie ci si proiettano sopra, e così la sfumatura segue la
// curvatura della colonna anche quando questa attraversa mezzo cielo.
function aurQuadro(t, a, b, intensita, tempesta, tetto) {
  const n = a.p.length;
  const bx = (a.p[0].x + b.p[0].x) / 2, by = (a.p[0].y + b.p[0].y) / 2;
  const tx = (a.p[n - 1].x + b.p[n - 1].x) / 2, ty = (a.p[n - 1].y + b.p[n - 1].y) / 2;
  const dx = tx - bx, dy = ty - by;
  const lung = dx * dx + dy * dy;
  if (lung < 1) return false;

  const gr = t.createLinearGradient(bx, by, tx, ty);
  let prec = -1;
  for (let j = 0; j < n; j++) {
    const q = AUR_QUOTE[j];
    const mx = (a.p[j].x + b.p[j].x) / 2 - bx;
    const my = (a.p[j].y + b.p[j].y) / 2 - by;
    let s = (mx * dx + my * dy) / lung;
    s = Math.max(prec + 0.0005, Math.min(1, s));
    if (s <= prec) continue;
    prec = s;
    // L'aria che c'è in mezzo la si misura all'altezza di quella quota:
    // la base di una tenda lontana è quasi sempre più smorzata della sua
    // cima, ed è per questo che da lontano restano solo i colori alti.
    const est = aurEstinzione((a.alt[j] + b.alt[j]) / 2);
    let alfa = q.alfa * intensita * est;
    if (q.soloTempesta) alfa *= tempesta;
    // Il tetto di questa colonna: sopra ci si spegne. Il verde non lo
    // tocca mai — il tetto più basso sta a 250 km — e quello che varia è
    // fin dove arriva la coda rossa.
    if (tetto) alfa *= Math.max(0, Math.min(1, (tetto - q.km) / 200 + 0.45));
    gr.addColorStop(Math.max(0, Math.min(1, s)),
      `rgba(${q.colore[0]}, ${q.colore[1]}, ${q.colore[2]}, ${alfa.toFixed(4)})`);
  }

  t.fillStyle = gr;
  t.beginPath();
  t.moveTo(a.p[0].x, a.p[0].y);
  for (let j = 1; j < n; j++) t.lineTo(a.p[j].x, a.p[j].y);
  for (let j = n - 1; j >= 0; j--) t.lineTo(b.p[j].x, b.p[j].y);
  t.closePath();
  t.fill();
  return true;
}

// Una colonna a metà strada fra due, presa sullo schermo. È una corda al
// posto dell'arco: su un pezzo di arco lungo mezzo cielo si vedrebbe, su
// una fetta di quadro no — e serve solo per le fette.
function aurInterpola(a, b, u) {
  return {
    p: a.p.map((q, j) => ({
      x: q.x + (b.p[j].x - q.x) * u,
      y: q.y + (b.p[j].y - q.y) * u
    })),
    alt: a.alt.map((v, j) => v + (b.alt[j] - v) * u)
  };
}

// Quanto è largo un quadro sullo schermo, misurato a mezza altezza.
function aurLarghezza(a, b) {
  const j = Math.floor(a.p.length / 2);
  return Math.hypot(a.p[j].x - b.p[j].x, a.p[j].y - b.p[j].y);
}

// Il raggio: una striscia stretta e più accesa dentro al quadro. È la
// firma visiva dell'aurora — le tende non sfumano, sono fatte di aste
// verticali — e costa un quadro in più solo dove il drappo è già luminoso.
function aurRaggio(t, a, b, intensita, tempesta, tetto, mezzo) {
  // Quanto è largo: sempre una fetta sottile del quadro, e tanto più
  // sottile quanto più il quadro è largo. Con il passo che si allarga, la
  // "fetta" a larghezza fissa diventava un blocco luminoso con due spigoli
  // verticali — l'unica cosa, in tutto il disegno, che si vedeva essere
  // fatta di poligoni.
  const m = Math.max(0.03, Math.min(0.16, mezzo || 0.14));
  return aurQuadro(t, aurInterpola(a, b, 0.5 - m), aurInterpola(a, b, 0.5 + m),
    intensita, tempesta, tetto);
}

// L'aurora di questo fotogramma. Va chiamata **prima** del terreno: la
// collina la deve tagliare come fa dal vero, e le stelle le deve
// attraversare — un'aurora non copre le stelle, ci si somma sopra, ed è
// per questo che il ricalco finale è additivo.
function aurDisegna(ctx, base, focale) {
  if (!aur.acceso || !sky.observer) return;
  const luogo = typeof skyLuogoDelCielo === 'function' ? skyLuogoDelCielo() : null;
  if (!luogo) return;

  // La riga del pannello si rinfresca **qui**, prima di ogni scorciatoia:
  // quello che ha da dire cambia con l'ora mostrata, e quasi sempre da
  // dire ha proprio che non si vede niente. Aggiornandola solo quando
  // c'era qualcosa da disegnare, restava ferma sull'ultima aurora vista —
  // e con la macchina del tempo in mano è la riga che si guarda di più.
  aurAggiornaNota();

  const k = aurKpMostrato();
  if (k.kp === null || isNaN(k.kp)) return;

  // Di giorno e al crepuscolo non c'è niente da vedere. Con l'atmosfera
  // spenta (carta stellare) `luceCielo` è zero e l'aurora resta accesa:
  // lì la si sta guardando di proposito.
  const notte = 1 - Math.min(1, (sky.luceCielo || 0) / AUR_LUCE_MAX);
  if (notte <= 0.02) return;

  const g = aurGeometria(skyAdesso(), luogo, k.kp);
  if (!g || !g.falde.length || g.altMassima < -2) return;

  const tela = aurTela();
  const t = tela.ctx;
  t.clearRect(0, 0, tela.L, tela.H);

  // Il disegno delle pieghe scorre con l'orologio vero (le tende si
  // muovono), ma dipende anche dall'ora mostrata: spostando la macchina
  // del tempo di tre ore l'aurora non è la stessa di prima, ed è giusto
  // così — non lo è nemmeno dal vero.
  const fase = (skyAdesso().getTime() / 3600000) * 2.2 +
    (typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000) * AUR_SCORRIMENTO;
  const tempesta = Math.max(0, Math.min(1, (k.kp - 4.5) / 3));
  const margine = 40;

  // Prima si proietta tutto e si conta quanto ne entra nel riquadro, poi si
  // decide **il passo**. Con un tetto secco al numero dei quadri, un'aurora
  // che occupa mezzo cielo si sarebbe interrotta a metà dell'arco — un
  // taglio netto in aria, la cosa più finta che il planetario potesse fare.
  // Saltando invece di troncare, l'arco resta intero e a diradarsi sono i
  // dettagli, che è il modo giusto di spendere meno.
  const dentro = (a, b) =>
    a && b &&
    Math.max(a.maxX, b.maxX) >= -margine && Math.min(a.minX, b.minX) <= tela.L + margine &&
    Math.max(a.maxY, b.maxY) >= -margine && Math.min(a.minY, b.minY) <= tela.H + margine;

  const pronte = g.falde.map(falda =>
    falda.colonne.map(c => aurProiettaColonna(c, base, focale, AUR_SCALA_TELA)));

  let visibili = 0;
  pronte.forEach(colonne => {
    for (let i = 0; i < colonne.length; i++) {
      if (dentro(colonne[i], colonne[(i + 1) % colonne.length])) visibili++;
    }
  });
  if (!visibili) return;
  const passo = Math.max(1, Math.ceil(visibili / AUR_QUADRI_MAX));

  let quadri = 0;
  for (let f = 0; f < pronte.length; f++) {
    const falda = g.falde[f];
    const colonne = pronte[f];
    const n = colonne.length;
    for (let i = 0; i < n; i += passo) {
      const a = colonne[i], b = colonne[(i + passo) % n];
      if (!dentro(a, b)) continue;

      // Quanto viene largo sullo schermo. Un arco visto quasi di punta si
      // schiaccia in pochi pixel; lo stesso arco che ti passa davanti può
      // occupare mezzo schermo con un quadro solo — e allora si vede che è
      // un quadro: un rettangolo di luce con due spigoli verticali. Dove
      // succede lo si taglia in fette, che costano poco perché sono poche.
      const parti = quadri < AUR_QUADRI_MAX
        ? Math.max(1, Math.min(AUR_FETTE_MAX, Math.round(aurLarghezza(a, b) / AUR_QUADRO_PX)))
        : 1;
      const arco = passo * 24 / AUR_CAMPIONI;

      for (let s = 0; s < parti; s++) {
        const ca = s === 0 ? a : aurInterpola(a, b, s / parti);
        const cb = s === parti - 1 ? b : aurInterpola(a, b, (s + 1) / parti);
        const mlt = a.mlt + arco * (s + 0.5) / parti;
        const luce = aurLuminositaOra(mlt);
        const dettaglio = parti / passo;
        const intensita = aurPiega(mlt, falda.indice, fase, dettaglio) * luce * falda.peso;
        if (intensita < 0.02) continue;
        const tetto = aurTetto(mlt, falda.indice, fase);
        if (aurQuadro(t, ca, cb, intensita, tempesta, tetto)) quadri++;
        // I raggi solo dove il drappo è già acceso: sono le aste verticali
        // che si accendono e si spengono dentro alla tenda, e senza di loro
        // l'aurora resta una fascia di colore.
        if (intensita > 0.55) {
          if (aurRaggio(t, ca, cb, (intensita - 0.42) * 0.85, tempesta, tetto, 0.14 * dettaglio)) quadri++;
        }
      }
    }
  }

  if (!quadri) return;

  // Il ricalco: additivo, perché l'aurora è luce che si aggiunge al cielo
  // e non vernice che lo copre. Le stelle continuano a vedersi attraverso,
  // che è la cosa che colpisce di più chi la vede la prima volta.
  //
  // Due passate. La prima è il disegno com'è; la seconda è lo stesso
  // disegno rimpicciolito e rimesso grande, cioè sfocato — la scheda
  // video lo fa in un colpo solo con l'interpolazione bilineare, e costa
  // meno di qualunque filtro. Serve a due cose insieme: toglie le
  // cuciture fra una colonna e l'altra, e mette attorno alle tende quel
  // bagliore diffuso che hanno sempre, perché la luce dell'aurora la si
  // vede anche di rimbalzo sull'aria che le sta davanti.
  const forza = Math.max(0, Math.min(1, aurForzaDelKp(k.kp) * notte));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = forza * 0.62;
  ctx.drawImage(tela.canvas, 0, 0, sky.larghezza, sky.altezza);
  const sfocata = aurSfoca(tela);
  if (sfocata) {
    ctx.globalAlpha = forza * 0.5;
    ctx.drawImage(sfocata, 0, 0, sky.larghezza, sky.altezza);
  }
  ctx.restore();
}


// =====================================================================
// 6. I COMANDI E LA RIGA CHE SPIEGA
// =====================================================================

function aurAlterna() {
  aur.acceso = !aur.acceso;
  aurAggiornaPannello();
}

// Il Kp simulato: è il modo in cui questa vista si usa quasi sempre.
// L'aurora vera, da qui, capita una volta ogni dieci anni — e uno la vuole
// vedere adesso, per sapere cosa cercare quando capiterà.
function aurImpostaKpSimulato(v) {
  aur.kpSimulato = v === null ? null : Math.max(0, Math.min(9, v));
  aur.chiave = '';
  if (aur.kpSimulato !== null) aur.acceso = true;
  aurAggiornaPannello();
}

function aurKpVero() {
  const k = aurKpMostrato();
  return aur.kpSimulato !== null ? null : (k.kp === null ? null : k.kp);
}

// Cosa si vedrebbe da qui, con questo Kp. È la riga che vale il modulo
// intero: dice se il verde arriva sopra l'orizzonte o se resta solo il
// rosso, e in che direzione guardare.
function aurTesto() {
  if (!aur.acceso) return 'Aurore spente.';
  const luogo = typeof skyLuogoDelCielo === 'function' ? skyLuogoDelCielo() : null;
  if (!luogo) return 'Serve la tua posizione per sapere dove passa l\'ovale aurorale.';

  const k = aurKpMostrato();
  if (k.kp === null || isNaN(k.kp)) {
    return 'Il Kp di quest\'ora non si sa (la previsione del NOAA arriva a tre giorni, ' +
      'e del passato non c\'è). Muovi la slitta qui sotto per vedere che aurora farebbe una tempesta.';
  }

  const g = aurGeometria(skyAdesso(), luogo, k.kp);
  if (!g) return '';
  const dove = g.boreale ? 'nord' : 'sud';
  const nome = g.boreale ? 'boreale' : 'australe';
  const quale = k.simulato ? `Kp ${aurNumero(k.kp)} simulato` : `Kp ${aurNumero(k.kp)}`;
  const direzione = typeof skyNomeDirezione === 'function'
    ? skyNomeDirezione(g.azMassima) : dove;

  if (g.altMassima <= 0.2) {
    return `${quale}: l'ovale aurorale resta sotto l'orizzonte ${dove}. ` +
      `Da qui — ${aurNumero(Math.abs(g.mia))}° di latitudine geomagnetica — non si vedrebbe niente. ` +
      'Con la slitta puoi far crescere la tempesta e guardare da che Kp comincia ad affacciarsi.';
  }
  if (!g.verde) {
    return `${quale}: da qui il verde resta sotto l'orizzonte — è oltre la curvatura della Terra — ` +
      `e si affaccia solo la parte alta delle tende, il rosso dell'ossigeno a duecento chilometri: ` +
      `fino a ${aurNumero(g.altMassima)}° sopra l'orizzonte, verso ${direzione}. ` +
      'È l\'aurora che si è vista dall\'Italia nel maggio 2024.';
  }
  if (g.altMassima > 60) {
    return `${quale}: l'ovale ${nome} ti passa praticamente sopra la testa. ` +
      `Le tende scendono dallo zenit e il verde riempie il cielo verso ${direzione}.`;
  }
  return `${quale}: aurora ${nome} visibile da qui, con gli archi verdi sopra l'orizzonte ` +
    `e le tende che arrivano a ${aurNumero(g.altMassima)}° verso ${direzione}.`;
}

function aurNumero(v) {
  return (Math.round(v * 10) / 10).toString().replace('.', ',');
}

function aurAggiornaPannello() {
  const tasto = document.getElementById('skymap-btn-aurora');
  if (tasto) {
    tasto.classList.toggle('attiva', aur.acceso);
    tasto.setAttribute('aria-pressed', aur.acceso ? 'true' : 'false');
    tasto.setAttribute('aria-expanded', aur.acceso ? 'true' : 'false');
  }
  // La slitta del Kp e la riga che racconta cosa si vedrebbe da qui **stanno
  // sotto al tasto dell'aurora**, e compaiono solo con l'ovale acceso. A tasto
  // spento erano due terzi della scheda «Cielo» occupati da un comando che non
  // comandava niente di disegnato, con sotto una frase che descriveva un cielo
  // che nessuno stava guardando — e chi arrivava lì cercando le nuvole doveva
  // scorrerle via per trovarle. Il comando non si può perdere per questo:
  // muovendo la slitta l'aurora si accende da sé (`aurImpostaKpSimulato`), e
  // qui si apre insieme alla cosa che regola. `hidden` e non una classe, così
  // il tabulatore non ci passa dentro quando non si vede.
  const blocco = document.getElementById('blocco-aurora');
  if (blocco) blocco.hidden = !aur.acceso;
  const slitta = document.getElementById('skymap-aurora-kp');
  const vero = aurKpVero();
  if (slitta && document.activeElement !== slitta) {
    slitta.value = String(aur.kpSimulato !== null ? aur.kpSimulato : (vero === null ? 0 : vero));
  }
  const lettura = document.getElementById('skymap-aurora-kp-valore');
  if (lettura) {
    lettura.textContent = aur.kpSimulato !== null
      ? `Kp ${aurNumero(aur.kpSimulato)} simulato`
      : (vero === null ? 'Kp non disponibile' : `Kp ${aurNumero(vero)} vero`);
  }
  const torna = document.getElementById('skymap-aurora-vero');
  if (torna) torna.disabled = aur.kpSimulato === null;

  aur.notaTesto = '';
  aurAggiornaNota(true);
}

// La riga si riscrive al massimo una volta al secondo, e solo se è
// cambiata: sta dentro al ciclo di disegno, e scrivere nel DOM sessanta
// volte al secondo una frase identica è il modo più semplice di far
// scattare il cielo.
function aurAggiornaNota(subito) {
  const nota = document.getElementById('skymap-aurora-nota');
  if (!nota) return;
  // Col blocco chiuso non c'è niente da riscrivere, e `aurTesto()` non è
  // gratis: rifà la geometria dell'ovale per dire una frase che nessuno legge.
  if (!aur.acceso) return;
  const ora = Date.now();
  if (!subito && ora - aur.notaQuando < 1000) return;
  aur.notaQuando = ora;
  const testo = aurTesto();
  if (testo === aur.notaTesto) return;
  aur.notaTesto = testo;
  nota.textContent = testo;
}

// Dal riquadro della dashboard al planetario, girato verso l'ovale.
function aurGuardaInCielo() {
  if (typeof mostraVista === 'function') mostraVista('cielo');
  aur.acceso = true;
  setTimeout(() => {
    const luogo = typeof skyLuogoDelCielo === 'function' ? skyLuogoDelCielo() : null;
    const k = aurKpMostrato();
    let az = 0, alt = 18;
    if (luogo && k.kp !== null && !isNaN(k.kp)) {
      const g = aurGeometria(skyAdesso(), luogo, k.kp);
      if (g) {
        az = g.altMassima > -2 ? g.azMassima : (g.boreale ? 0 : 180);
        // A che altezza guardare non è sempre lo stesso: da mille chilometri
        // l'ovale è un bagliore appoggiato all'orizzonte, e inquadrare a
        // diciotto gradi vuol dire mettercelo sotto il bordo dello schermo;
        // da sotto l'ovale, invece, le tende scendono dallo zenit e a
        // diciotto gradi si guarda il terreno. Metà dell'altezza della cima
        // le tiene tutte e due dentro l'inquadratura.
        alt = Math.max(10, Math.min(65, g.altMassima * 0.5));
      }
    }
    if (typeof skyCentraSu === 'function') {
      skyCentraSu({ nome: 'l\'aurora', az, alt });
    }
    aurAggiornaPannello();
  }, 60);
}

function aurCollega() {
  const slitta = document.getElementById('skymap-aurora-kp');
  if (slitta) {
    slitta.addEventListener('input', () => aurImpostaKpSimulato(parseFloat(slitta.value)));
  }
  const torna = document.getElementById('skymap-aurora-vero');
  if (torna) torna.addEventListener('click', () => {
    aurImpostaKpSimulato(null);
    // Anche questo comando lascia aperti i Filtri, così si possono regolare
    // più elementi prima di richiudere il pannello dalla sua linguetta.
  });
  aurAggiornaPannello();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', aurCollega);
} else {
  aurCollega();
}


// =====================================================================
// 7. LA FORMA DELLO SCUDO
//     Dove finisce il campo magnetico terrestre e comincia il vento
//     solare. Non serve al disegno dell'ovale nel planetario: serve al
//     banco delle aurore della vista Didattica, che il campo lo fa
//     vedere. Sta qui perché è fisica dell'aurora — la stessa di tutto
//     il resto del file — e perché così `verifica.html` la può
//     controllare contro i numeri pubblicati.
//
//     Il modello è quello di Shue et al. (1997), che è la forma con cui
//     si disegna la magnetopausa da trent'anni:
//
//         r(θ) = r₀ · ( 2 / (1 + cos θ) ) ^ α
//
//     con θ contato dalla direzione del Sole. A θ = 0 dà r₀, il "naso"
//     dello scudo; crescendo θ si apre nei fianchi e poi nella coda.
//     Due numeri la governano, e tutti e due li detta il vento solare:
//     r₀ dice quanto lontano arriva il naso, α quanto la coda è aperta.
// =====================================================================

// La distanza del naso, in raggi terrestri, in funzione della pressione
// dinamica del vento (nPa) e della componente sud del campo magnetico
// interplanetario (nT, negativa = verso sud). È la formula di Shue: la
// pressione schiaccia lo scudo con l'esponente 1/6,6 — quindi ci vuole
// una pressione dieci volte più alta per dimezzarlo — mentre un campo
// rivolto a sud lo eroda, perché è quello che si riconnette col nostro.
//
// Coi valori del vento tranquillo (2 nPa, Bz nullo) viene 10,3 raggi
// terrestri, cioè 65.000 km: è il numero che sta su tutti i libri.
// Con l'urto di una tempesta forte (20 nPa, Bz −20 nT) scende a 5,5, e
// in quelle occasioni i satelliti geostazionari — che stanno a
// 6,6 raggi — si sono trovati **fuori** dalla magnetosfera, in pieno
// vento solare. Non è un modo di dire: è successo, e si vede nei dati.
function aurStandoff(pressioneNPa, bzNT) {
  const p = Math.max(0.05, pressioneNPa || 2);
  const bz = bzNT === undefined ? 0 : bzNT;
  const base = bz >= 0
    ? 11.4 + 0.013 * bz
    : 11.4 + 0.140 * bz;
  return base * Math.pow(p, -1 / 6.6);
}

// L'apertura della coda. Anche questa cresce con la pressione e con il
// campo verso sud: sotto tempesta la magnetosfera non si limita a
// stringersi davanti, si allunga anche dietro.
function aurAperturaCoda(pressioneNPa, bzNT) {
  const p = Math.max(0.05, pressioneNPa || 2);
  const bz = bzNT === undefined ? 0 : bzNT;
  return (0.58 - 0.007 * bz) * (1 + 0.024 * Math.log(p));
}

// Il raggio della magnetopausa nella direzione θ (radianti, contati dal
// Sole). La formula diverge verso θ = π — la coda vera non si chiude
// mai — quindi oltre `AUR_MP_THETA_MAX` si smette di chiedere e si tira
// dritto: è quello che fa il disegno del banco.
const AUR_MP_THETA_MAX = 2.55;      // ~146°, dove la coda è ormai un tubo

function aurMagnetopausa(theta, r0, alfa) {
  const t = Math.min(Math.abs(theta), AUR_MP_THETA_MAX);
  const c = Math.cos(t);
  return r0 * Math.pow(2 / (1 + c), alfa === undefined ? 0.58 : alfa);
}

// L'onda d'urto sta più avanti del naso di circa un quarto, e si apre di
// più: il vento solare è supersonico e frena lì, prima di scivolare
// attorno allo scudo.
const AUR_URTO_AVANTI = 1.28;
const AUR_URTO_APERTURA = 1.42;
