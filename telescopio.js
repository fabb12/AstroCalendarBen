// =====================================================================
// IL TELESCOPIO
//
// Il resto dell'app risponde alla domanda "cosa c'è stanotte". Qui si
// risponde a quella che viene subito dopo, ed è molto più difficile:
// "e adesso come faccio a inquadrarlo?".
//
// Un planetario ti dice dove sta un oggetto nel cielo. Non sa che tu hai
// un Newton da 130 mm con due oculari, un cercatore a punto rosso e una
// montatura equatoriale senza cannocchiale polare. Tutto quello che c'è
// in questo file nasce da quella differenza: i conti sono fatti sul
// *tuo* strumento, e le istruzioni parlano di manopole vere.
//
// La seconda idea, che viene da com'è fatto un telefono: dentro ci sono
// già una livella, un goniometro e una bussola, cioè esattamente i tre
// attrezzi che servono per mettere una montatura equatoriale al suo
// posto. E se lo si attacca al tubo, sa anche dove sta guardando il
// tubo. Quindi le due fasi difficili — allineare al Nord e trovare
// l'oggetto — non si spiegano soltanto: si guidano, un passo per volta,
// con lo strumento acceso dentro il passo che lo usa.
//
// Le sezioni, nell'ordine in cui servono davvero in giardino:
//   1. Il profilo dello strumento e l'ottica (ingrandimenti, campi)
//   2. Allineamento polare: il polo, la Polare, i sensori del telefono
//      come livella / goniometro / bussola, la deriva
//   3. Puntamento: push-to col telefono sul tubo, cerchi graduati
//      digitali, salti di stella
//   4. La serata: scaletta, raffreddamento, rugiada
//   5. Manutenzione: collimazione e test stellare
//   6. "Cosa vedrò davvero": l'anticipo onesto all'oculare
//   7. I disegni: quadrante polare, bussola, bolla, goniometro, radar
//   8. La vista e i suoi pannelli
// =====================================================================

const CHIAVE_TEL_PROFILO = 'astrocalendario_telescopio_v1';
const CHIAVE_TEL_SESSIONE = 'astrocalendario_telescopio_sessione_v1';

const TEL_D2R = Math.PI / 180;
const TEL_R2D = 180 / Math.PI;

// Un grado ha 60 primi, un primo 60 secondi: qui si passa di continuo
// dagli uni agli altri, e sbagliare fattore vuol dire sbagliare tutto.
const TEL_ARCMIN_PER_RAD = 180 * 60 / Math.PI;      // 3437.75
const TEL_ARCSEC_PER_RAD = 180 * 3600 / Math.PI;    // 206264.8

// Velocità di rotazione del cielo: 15 gradi l'ora, cioè 900 secondi
// d'arco al minuto. È la costante che sta sotto a tutta la deriva.
const TEL_ARCSEC_MIN = 900;

// =====================================================================
// 1. IL PROFILO DELLO STRUMENTO
//    Quattro numeri (apertura, focale, oculari, Barlow) e tutto il
//    resto dell'app smette di parlare in generale e comincia a parlare
//    del telescopio che hai in giardino.
// =====================================================================

// Telescopi già pronti: chi ha uno di questi non deve cercare niente sul
// manuale. Il primo è quello per cui l'app è nata.
const TEL_PRESET = [
  {
    id: 'spica130',
    nome: 'Bresser Spica 130/650 EQ3',
    apertura: 130, focale: 650, tipo: 'newton', ostruzione: 0.30,
    montatura: 'eq', cercatore: 'reddot',
    oculari: [
      { focale: 20, campoApp: 50, nome: '20 mm (in dotazione)' },
      { focale: 4, campoApp: 40, nome: '4 mm (in dotazione)' }
    ],
    barlow: 3
  },
  {
    id: 'newton150',
    nome: 'Newton 150/750 su EQ3-2',
    apertura: 150, focale: 750, tipo: 'newton', ostruzione: 0.28,
    montatura: 'eq', cercatore: 'ottico',
    oculari: [
      { focale: 25, campoApp: 52, nome: '25 mm' },
      { focale: 10, campoApp: 52, nome: '10 mm' }
    ],
    barlow: 2
  },
  {
    id: 'dobson200',
    nome: 'Dobson 200/1200',
    apertura: 200, focale: 1200, tipo: 'newton', ostruzione: 0.25,
    montatura: 'altaz', cercatore: 'ottico',
    oculari: [
      { focale: 30, campoApp: 52, nome: '30 mm' },
      { focale: 9, campoApp: 52, nome: '9 mm' }
    ],
    barlow: 2
  },
  {
    id: 'rifrattore70',
    nome: 'Rifrattore 70/700 su EQ1',
    apertura: 70, focale: 700, tipo: 'rifrattore', ostruzione: 0,
    montatura: 'eq', cercatore: 'reddot',
    oculari: [
      { focale: 20, campoApp: 50, nome: '20 mm' },
      { focale: 10, campoApp: 45, nome: '10 mm' }
    ],
    barlow: 2
  },
  {
    id: 'mak127',
    nome: 'Maksutov 127/1500',
    apertura: 127, focale: 1500, tipo: 'catadiottrico', ostruzione: 0.32,
    montatura: 'altaz', cercatore: 'reddot',
    oculari: [
      { focale: 25, campoApp: 50, nome: '25 mm' },
      { focale: 10, campoApp: 50, nome: '10 mm' }
    ],
    barlow: 2
  }
];

// Cercatori: quanto cielo inquadrano e se raddrizzano l'immagine.
// Il campo del cercatore decide la lunghezza dei salti di stella.
const TEL_CERCATORI = {
  reddot:  { nome: 'Punto rosso', campo: 8, ingrandimento: 1, dritta: true },
  ottico:  { nome: 'Cercatore 6×30', campo: 7, ingrandimento: 6, dritta: false },
  ottico9: { nome: 'Cercatore 9×50', campo: 5.5, ingrandimento: 9, dritta: false },
  nessuno: { nome: 'Nessun cercatore', campo: 3, ingrandimento: 1, dritta: true }
};

const TEL_TIPI = {
  newton:        { nome: 'Newton (riflettore)', rotazione: 180, specchiata: false },
  rifrattore:    { nome: 'Rifrattore', rotazione: 0, specchiata: true },
  catadiottrico: { nome: 'Maksutov / Schmidt-Cassegrain', rotazione: 0, specchiata: true }
};

// Scala di Bortle ridotta all'osso: serve a stimare quanto cielo di
// fondo si mangia il contrasto, non a fare classifiche.
const TEL_CIELI = [
  { id: 4, nome: 'Periferia / campagna vicina', magLimite: 6.0, nota: 'Via Lattea visibile ma slavata.' },
  { id: 5, nome: 'Periferia luminosa', magLimite: 5.6, nota: 'Via Lattea appena accennata allo zenit.' },
  { id: 6, nome: 'Cielo di paese', magLimite: 5.1, nota: 'Via Lattea invisibile, alone luminoso all\'orizzonte.' },
  { id: 8, nome: 'Città', magLimite: 4.2, nota: 'Si vedono poche decine di stelle: pianeti e Luna restano ottimi.' },
  { id: 3, nome: 'Campagna buia', magLimite: 6.6, nota: 'Via Lattea strutturata: qui il deep sky si apre.' },
  { id: 2, nome: 'Cielo di montagna', magLimite: 7.1, nota: 'Le condizioni migliori che si trovino in Italia.' }
];

const TEL_PROFILO_BASE = {
  presetId: 'spica130',
  nome: 'Bresser Spica 130/650 EQ3',
  apertura: 130,
  focale: 650,
  tipo: 'newton',
  ostruzione: 0.30,
  montatura: 'eq',
  cercatore: 'reddot',
  oculari: [
    { focale: 20, campoApp: 50, nome: '20 mm (in dotazione)' },
    { focale: 4, campoApp: 40, nome: '4 mm (in dotazione)' }
  ],
  barlow: 3,
  motoreAR: false,
  cielo: 5,
  // Il battito che accompagna il push-to: si punta guardando nel
  // cercatore, non lo schermo, quindi è l'orecchio o il polso a dire
  // "fermo". Il suono è spento di partenza perché in un raduno dà noia.
  pushtoVibra: true,
  pushtoSuono: false
};

// Stato del modulo. Tutto quello che deve sopravvivere alla chiusura
// dell'app sta in `profilo`; il resto è roba della serata in corso.
const tel = {
  profilo: null,
  pannello: 'strumento',
  // Allineamento polare: a che punto è la procedura guidata e quali passi
  // sono già stati dichiarati fatti
  passo: 0,
  fatti: [],
  tuttiPassi: false,
  // Allineamento per deriva (la parte da fotografia)
  deriva: { misure: [], inCorso: null, stella: null },
  // Sensori del telefono usati come livella, goniometro e bussola
  bussola: { attiva: false, timer: null, storico: [] },
  // Cerchi graduati digitali
  riferimento: null,        // { ra, dec, nome, quando }
  bersaglio: null,          // oggetto scelto come prossimo target
  metodo: 'pushto',         // come si vuole puntare: pushto | cerchi | salti
  // Telefono sul tubo (push-to)
  tubo: {
    attivo: false,
    allineamenti: [],       // punti di sincronizzazione { R, v, nome, quando }
    modello: null,          // asse del tubo + correzione di bussola risolti
    timer: null,
    ultimoBattito: 0,
    centrato: false,
    audio: null
  },
  // Tele di disegno riusate dai vari pannelli
  tele: {},
  // Serata
  scaletta: null
};

function telProfilo() {
  if (!tel.profilo) telCaricaProfilo();
  return tel.profilo;
}

function telCaricaProfilo() {
  let salvato = null;
  try {
    salvato = JSON.parse(localStorage.getItem(CHIAVE_TEL_PROFILO) || 'null');
  } catch (e) { /* dato corrotto: si riparte dal profilo base */ }

  const p = Object.assign({}, TEL_PROFILO_BASE, salvato || {});
  // Gli oculari sono l'unica parte che l'utente può rovinare davvero:
  // se l'elenco non regge, si torna a quelli di serie.
  if (!Array.isArray(p.oculari) || !p.oculari.length) {
    p.oculari = TEL_PROFILO_BASE.oculari.map(o => Object.assign({}, o));
  }
  p.oculari = p.oculari
    .filter(o => o && isFinite(o.focale) && o.focale > 0 && o.focale < 100)
    .map(o => ({
      focale: +o.focale,
      campoApp: isFinite(o.campoApp) && o.campoApp > 20 && o.campoApp <= 120 ? +o.campoApp : 50,
      nome: o.nome || `${o.focale} mm`
    }))
    .sort((a, b) => b.focale - a.focale);
  if (!p.oculari.length) p.oculari = TEL_PROFILO_BASE.oculari.map(o => Object.assign({}, o));

  if (!isFinite(p.apertura) || p.apertura <= 0) p.apertura = TEL_PROFILO_BASE.apertura;
  if (!isFinite(p.focale) || p.focale <= 0) p.focale = TEL_PROFILO_BASE.focale;
  if (!TEL_TIPI[p.tipo]) p.tipo = 'newton';
  if (!TEL_CERCATORI[p.cercatore]) p.cercatore = 'reddot';
  if (!isFinite(p.barlow) || p.barlow < 1) p.barlow = 1;

  tel.profilo = p;
  return p;
}

function telSalvaProfilo() {
  try {
    localStorage.setItem(CHIAVE_TEL_PROFILO, JSON.stringify(tel.profilo));
  } catch (e) { /* storage pieno: il profilo vale per questa sessione */ }
}

// --- L'ottica ---------------------------------------------------------
// Cinque formule in croce, ma sono quelle che trasformano "M13 è alto
// 40°" in "M13 entra nel campo dell'oculare da 20 mm".

// Ingrandimento massimo che ha senso: oltre il doppio dell'apertura in
// millimetri non arriva più dettaglio, arriva solo immagine più grande
// e più scura. È il numero che smaschera i "675×" sulle scatole.
function telIngrandimentoMassimo(profilo) {
  return Math.round(2 * profilo.apertura);
}

// Sotto questo ingrandimento il fascio di luce che esce dall'oculare è
// più largo della pupilla dell'occhio: la luce raccolta dallo specchio
// finisce sull'iride e viene buttata via.
function telIngrandimentoMinimo(profilo) {
  return Math.round(profilo.apertura / 6);
}

// Potere separatore (Dawes): la distanza minima fra due stelle doppie
// che l'apertura riesce ancora a dividere.
function telPotereSeparatore(profilo) {
  return 116 / profilo.apertura;
}

// Magnitudine più debole raggiungibile. La formula classica vale per
// cieli molto bui: qui la si abbassa se il cielo di casa è illuminato,
// perché è quello che succede davvero.
function telMagnitudineLimite(profilo) {
  const teorica = 2 + 5 * Math.log10(profilo.apertura);
  const cielo = TEL_CIELI.find(c => c.id === profilo.cielo);
  if (!cielo) return teorica;
  // Un cielo peggiore del riferimento (6.5 a occhio nudo) toglie
  // contrasto e quindi magnitudini, ma non in proporzione piena.
  const perdita = Math.max(0, 6.5 - cielo.magLimite) * 0.7;
  return teorica - perdita;
}

// Tutte le combinazioni possibili oculare × (diretto, con Barlow),
// ordinate dall'ingrandimento più basso al più alto. È la tabella che
// si vuole avere davanti prima di uscire.
function telCombinazioni(profilo) {
  const p = profilo || telProfilo();
  const massimo = telIngrandimentoMassimo(p);
  const minimo = telIngrandimentoMinimo(p);
  const lista = [];

  p.oculari.forEach(oc => {
    const varianti = [{ barlow: 1, etichetta: '' }];
    if (p.barlow > 1) varianti.push({ barlow: p.barlow, etichetta: ` + Barlow ${p.barlow}×` });

    varianti.forEach(v => {
      const ingrandimento = (p.focale * v.barlow) / oc.focale;
      const campoReale = oc.campoApp / ingrandimento;
      const pupilla = p.apertura / ingrandimento;
      lista.push({
        chiave: `${oc.focale}-${v.barlow}`,
        nome: `${oc.nome}${v.etichetta}`,
        oculare: oc,
        barlow: v.barlow,
        ingrandimento,
        campoReale,                    // in gradi
        campoRealeMin: campoReale * 60, // in primi d'arco
        pupilla,
        // Il giudizio serve più dei numeri: dice se quella combinazione
        // va usata o è lì solo perché era nella scatola.
        vuoto: ingrandimento > massimo,
        fiacco: ingrandimento < minimo,
        pupillaLarga: pupilla > 6.5
      });
    });
  });

  return lista.sort((a, b) => a.ingrandimento - b.ingrandimento);
}

// La combinazione giusta per un oggetto: deve starci dentro con un po'
// di margine, e più ingrandimento si può permettere meglio è (più buio
// il fondo cielo, più contrasto). Se non ci sta in nessuna, si sceglie
// comunque la più larga e lo si dice.
function telCombinazionePer(dimensioneMin, profilo, oggetto) {
  const lista = telCombinazioni(profilo);
  const utili = lista.filter(c => !c.vuoto);
  if (!utili.length) return { scelta: lista[0] || null, entra: false };

  // Luna e pianeti non seguono la regola del campo: sono piccoli e
  // luminosi, e hanno un ingrandimento a cui danno il meglio — sotto si
  // perde dettaglio, sopra si perde nitidezza. Quello lo sappiamo per
  // ciascuno, e vale più di qualunque formula.
  const ideale = oggetto && oggetto.aspetto && oggetto.aspetto.ingrandimentoIdeale;
  if (ideale) {
    const scelta = utili.reduce((migliore, c) =>
      Math.abs(c.ingrandimento - ideale) < Math.abs(migliore.ingrandimento - ideale) ? c : migliore, utili[0]);
    return { scelta, entra: !dimensioneMin || scelta.campoRealeMin >= dimensioneMin };
  }

  if (!isFinite(dimensioneMin) || dimensioneMin <= 0) {
    // Oggetto puntiforme (stella doppia, pianeta lontano): ingrandimento
    // alto, ma non oltre quello che regge l'atmosfera media.
    const seeing = utili.filter(c => c.ingrandimento <= 180);
    return { scelta: (seeing.length ? seeing : utili)[Math.max(0, (seeing.length ? seeing : utili).length - 1)], entra: true };
  }

  // Vogliamo l'oggetto entro circa metà campo: al bordo si vede peggio
  // e basta un soffio di vento per perderlo.
  const buone = utili.filter(c => c.campoRealeMin >= dimensioneMin * 2);
  if (buone.length) return { scelta: buone[buone.length - 1], entra: true };

  const larga = utili[0];
  return { scelta: larga, entra: larga.campoRealeMin >= dimensioneMin };
}

// --- Coordinate -------------------------------------------------------

// Le coordinate dei cataloghi sono J2000, ma il cielo di stanotte è
// ruotato di un quarto di grado rispetto ad allora. Per disegnare una
// costellazione non cambia niente; per dire dove sta la Polare rispetto
// al polo, che dista appena mezzo grado, cambia tutto.
function telCoordDiOggi(raOre, decGradi, data) {
  if (typeof Astronomy === 'undefined') return { ra: raOre, dec: decGradi };
  try {
    const t = Astronomy.MakeTime(data);
    const rot = Astronomy.Rotation_EQJ_EQD(t);
    const sfera = new Astronomy.Spherical(decGradi, raOre * 15, 1);
    const v = Astronomy.VectorFromSphere(sfera, t);
    const ruotato = Astronomy.RotateVector(rot, v);
    const fuori = Astronomy.SphereFromVector(ruotato);
    return { ra: fuori.lon / 15, dec: fuori.lat };
  } catch (e) {
    return { ra: raOre, dec: decGradi };
  }
}

// Tempo siderale locale in ore: è l'orologio con cui si legge il cielo.
// L'ascensione retta che passa in questo momento sul meridiano è
// esattamente questo numero.
function telTempoSiderale(data, luogo) {
  if (typeof Astronomy === 'undefined') return null;
  const l = luogo || luogoCorrente();
  if (!l) return null;
  try {
    const gast = Astronomy.SiderealTime(Astronomy.MakeTime(data));
    return ((gast + l.lon / 15) % 24 + 24) % 24;
  } catch (e) {
    return null;
  }
}

// Angolo orario: quanto tempo è passato da quando l'oggetto era in
// meridiano. Negativo = deve ancora arrivarci (sta a est).
function telAngoloOrario(raOre, data, luogo) {
  const lst = telTempoSiderale(data, luogo);
  if (lst == null) return null;
  let h = lst - raOre;
  while (h > 12) h -= 24;
  while (h < -12) h += 24;
  return h;
}

function telOreTesto(ore) {
  const segno = ore < 0 ? '−' : '+';
  const tot = Math.abs(ore);
  const h = Math.floor(tot);
  const m = Math.round((tot - h) * 60);
  const hh = m === 60 ? h + 1 : h;
  const mm = m === 60 ? 0 : m;
  return `${segno}${hh}h ${String(mm).padStart(2, '0')}m`;
}

function telGradiTesto(gradi, decimali = 1) {
  const segno = gradi < 0 ? '−' : '+';
  return `${segno}${Math.abs(gradi).toFixed(decimali)}°`;
}

// Declinazione in gradi e primi, cioè come è incisa sul cerchio graduato
// della montatura. Sul cerchio i decimali non esistono: ci sono le tacche
// dei gradi, e leggere "+38° 47′" è molto più diretto di "+38,8°".
function telDecTesto(dec) {
  const segno = dec < 0 ? '−' : '+';
  const a = Math.abs(dec);
  let g = Math.floor(a);
  let m = Math.round((a - g) * 60);
  if (m === 60) { g += 1; m = 0; }
  return `${segno}${g}° ${String(m).padStart(2, '0')}′`;
}

// Ascensione retta in ore e minuti. Il cerchio orario di una EQ3 ha le
// tacche ogni 10 minuti: i secondi sarebbero una precisione finta.
function telArTesto(ra) {
  const tot = ((ra % 24) + 24) % 24;
  let h = Math.floor(tot);
  let m = Math.round((tot - h) * 60);
  if (m === 60) { h = (h + 1) % 24; m = 0; }
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

// Angoli piccoli: sotto il grado si legge molto meglio in primi d'arco
function telAngoloTesto(gradi) {
  const a = Math.abs(gradi);
  if (a >= 1) return `${a.toFixed(a >= 10 ? 0 : 1)}°`;
  if (a >= 1 / 60) return `${Math.round(a * 60)}′`;
  return `${Math.round(a * 3600)}″`;
}

// Versore verso azimut/altezza, nella terna Est / Nord / Alto.
// È la stessa convenzione della vista Cielo: azimut 0 = Nord.
function telVersore(azGradi, altGradi) {
  const az = azGradi * TEL_D2R, alt = altGradi * TEL_D2R;
  return [Math.sin(az) * Math.cos(alt), Math.cos(az) * Math.cos(alt), Math.sin(alt)];
}

function telDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

function telCross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function telNormalizza(v) {
  const n = Math.hypot(v[0], v[1], v[2]);
  return n > 1e-12 ? [v[0] / n, v[1] / n, v[2] / n] : v;
}

function telSeparazione(a, b) {
  return Math.acos(Math.max(-1, Math.min(1, telDot(a, b)))) * TEL_R2D;
}

// Separazione angolare fra due punti dati in coordinate equatoriali
function telSeparazioneEq(ra1, dec1, ra2, dec2) {
  const d1 = dec1 * TEL_D2R, d2 = dec2 * TEL_D2R;
  const dra = (ra1 - ra2) * 15 * TEL_D2R;
  const c = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(dra);
  return Math.acos(Math.max(-1, Math.min(1, c))) * TEL_R2D;
}

// --- Il catalogo di stelle per orientarsi ------------------------------
// Le costellazioni disegnate nella vista Cielo sono già un catalogo di
// stelle con nome, posizione e luminosità: qui viene riusato per i
// salti di stella e per scegliere le stelle di allineamento, invece di
// portarsi dietro un secondo elenco che poi diverge dal primo.
let telStelleCache = null;
function telStelle() {
  if (telStelleCache) return telStelleCache;
  const viste = new Map();
  if (typeof SKY_COSTELLAZIONI !== 'undefined') {
    SKY_COSTELLAZIONI.forEach(c => {
      c.stelle.forEach(s => {
        const nome = s[3];
        if (!nome || viste.has(nome)) return;
        viste.set(nome, { nome, ra: s[0], dec: s[1], mag: s[2], costellazione: c.nome });
      });
    });
  }
  telStelleCache = Array.from(viste.values()).sort((a, b) => a.mag - b.mag);
  return telStelleCache;
}

// La stella luminosa più vicina a un punto: è sempre il primo passo di
// qualunque ricerca fatta a mano.
function telStellaVicina(ra, dec, magMassima = 3, escludi = null) {
  let migliore = null, minDist = Infinity;
  telStelle().forEach(s => {
    if (s.mag > magMassima) return;
    if (escludi && s.nome === escludi) return;
    const d = telSeparazioneEq(ra, dec, s.ra, s.dec);
    if (d < minDist) { minDist = d; migliore = s; }
  });
  return migliore ? Object.assign({ distanza: minDist }, migliore) : null;
}

// =====================================================================
// GLI OGGETTI PUNTABILI
// Pianeti, Luna e deep sky messi in un elenco solo, con quello che
// serve al telescopio: quanto sono grandi in cielo e che aspetto hanno
// davvero in un'apertura media.
// =====================================================================

// Dimensioni apparenti e aspetto reale degli oggetti profondi. I numeri
// vengono dai cataloghi; le descrizioni da come si vedono davvero in un
// 130 mm, che è tutt'altra cosa dalle fotografie.
const TEL_ASPETTO_PROFONDO = {
  // `forma` dice come disegnarla: un fuso (galassia di taglio), un disco
  // tondo (di faccia) o una coppia, che è il caso di M51 e di M81+M82 —
  // due macchie separate, non una macchia sola allungata.
  'M31': { dim: 180, nucleo: 12, tipo: 'galassia', sb: 22.2, forma: 'fuso',
    aspetto: 'Un ovale lattiginoso grande come tre Lune in fila. Il nucleo è netto, le braccia no: quelle restano alle fotografie.' },
  'M42': { dim: 60, nucleo: 20, tipo: 'nebulosa', sb: 20.5,
    aspetto: 'L\'unica nebulosa che mostra davvero una forma: due ali di gas grigio-verde attorno a quattro stelline in quadrato (il Trapezio).' },
  'M45': { dim: 110, nucleo: 110, tipo: 'ammasso', sb: 20.0,
    aspetto: 'Troppo grande per il telescopio: sta tutta solo nel cercatore o nel binocolo. Stelle azzurre, taglienti.' },
  'M44': { dim: 95, nucleo: 95, tipo: 'ammasso', sb: 21.0,
    aspetto: 'Una quarantina di stelle sparse, larghe. Anche qui l\'oculare più largo è quello giusto.' },
  'M13': { dim: 20, nucleo: 8, tipo: 'globulare', sb: 21.0,
    aspetto: 'Una palla di luce granulosa: a 100× i bordi cominciano a scomporsi in singole stelle. È il colpo d\'occhio migliore del cielo estivo.' },
  'M8': { dim: 45, nucleo: 15, tipo: 'nebulosa', sb: 21.8,
    aspetto: 'Una macchia grigia allungata tagliata da una fessura scura, con un ammasso di stelle appoggiato sopra.' },
  'M22': { dim: 24, nucleo: 10, tipo: 'globulare', sb: 21.2,
    aspetto: 'Più largo e più risolto di M13, ma sta basso: la foschia dell\'orizzonte se ne mangia metà.' },
  'Doppio': { dim: 60, nucleo: 30, tipo: 'ammasso', sb: 21.0,
    aspetto: 'Due pugni di stelle nello stesso campo, a poca distanza. Serve l\'oculare più largo per averli tutti e due insieme.' },
  'M57': { dim: 1.4, nucleo: 1.4, tipo: 'planetaria', sb: 18.5,
    aspetto: 'Una ciambella grigia piccolissima ma inconfondibile. Regge bene l\'ingrandimento: qui il 4 mm ha senso.' },
  'M27': { dim: 8, nucleo: 6, tipo: 'planetaria', sb: 20.5,
    aspetto: 'Un torsolo di mela luminoso, grigio-verde. Fra le nebulose è la più facile dopo M42.' },
  'M51': { dim: 11, nucleo: 4, tipo: 'galassia', sb: 22.5, forma: 'coppia',
    compagno: { distanza: 4.5, dim: 4, angolo: -20 },
    aspetto: 'Due macchioline tonde vicine. Il ponte di materia che le unisce, nelle foto così evidente, all\'oculare non c\'è.' },
  'M81': { dim: 21, nucleo: 6, tipo: 'galassia', sb: 21.7, forma: 'coppia',
    compagno: { distanza: 12, dim: 9, angolo: 70, sottile: true },
    aspetto: 'Ovale netto e luminoso; nello stesso campo M82, che invece è un fuso sottile. Due galassie in un colpo solo.' },
  'M15': { dim: 18, nucleo: 5, tipo: 'globulare', sb: 20.9,
    aspetto: 'Palla compatta con il centro molto concentrato: sembra una cometa senza coda.' },
  'M3': { dim: 18, nucleo: 6, tipo: 'globulare', sb: 21.0,
    aspetto: 'Globulare di prima qualità, quasi come M13: comincia a risolversi verso i 120×.' }
};

// Le sigle dei nomi lunghi ("M31 — Galassia di Andromeda") riportano
// alla scheda giusta senza doverle riscrivere tutte.
function telAspettoProfondo(nome) {
  const chiave = Object.keys(TEL_ASPETTO_PROFONDO).find(k => nome.startsWith(k));
  return chiave ? TEL_ASPETTO_PROFONDO[chiave] : null;
}

// Come si presentano i pianeti in un'apertura media: la delusione più
// comune è Marte, la sorpresa più comune è Saturno.
const TEL_ASPETTO_PIANETI = {
  Moon: { tipo: 'luna', ingrandimentoIdeale: 100,
    aspetto: 'Lungo il terminatore (il confine fra luce e ombra) i crateri hanno ombre lunghe e sembrano in rilievo. È lì che si guarda, non sulla parte piena.' },
  Mercury: { tipo: 'pianeta', ingrandimentoIdeale: 150,
    aspetto: 'Un dischetto minuscolo con una fase, come una Luna in miniatura. Sempre basso, sempre tremolante.' },
  Venus: { tipo: 'pianeta', ingrandimentoIdeale: 120,
    aspetto: 'Abbagliante e completamente liscio: nessun dettaglio, solo la fase. Bellissima da falce, poco prima del tramonto.' },
  Mars: { tipo: 'pianeta', ingrandimentoIdeale: 180,
    aspetto: 'Piccolo e arancione. Solo vicino alle opposizioni mostra la calotta polare bianca e qualche macchia scura.' },
  Jupiter: { tipo: 'pianeta', ingrandimentoIdeale: 150,
    aspetto: 'Due bande scure attraversano il disco, e quattro puntini in fila cambiano posto ogni sera: sono le lune di Galileo.' },
  Saturn: { tipo: 'pianeta', ingrandimentoIdeale: 160,
    aspetto: 'L\'anello si vede già a 50×, staccato dal disco verso i 120×. È l\'oggetto che convince chiunque guardi.' },
  Uranus: { tipo: 'pianeta', ingrandimentoIdeale: 180,
    aspetto: 'Un dischetto verdino appena più grande di una stella: la soddisfazione sta nel riconoscerlo, non nel dettaglio.' },
  Neptune: { tipo: 'pianeta', ingrandimentoIdeale: 200,
    aspetto: 'Indistinguibile da una stella se non per il colore bluastro. Serve la mappa per essere sicuri di averlo trovato.' }
};

// L'elenco completo di quello che si può puntare stanotte, con
// posizione, dimensione e giudizio sullo strumento in uso.
function telOggettiPuntabili(data) {
  const obs = osservatoreCorrente();
  if (!obs || typeof Astronomy === 'undefined') return [];
  const quando = data || new Date();
  const p = telProfilo();
  const lista = [];

  // Pianeti e Luna: posizione e dimensione vengono calcolate, non lette
  // da una tabella, perché cambiano di sera in sera.
  SKY_CORPI.forEach(c => {
    if (c.id === 'Sun') return;   // non si punta mai il Sole: nessuna scorciatoia
    try {
      const equ = Astronomy.Equator(c.id, Astronomy.MakeTime(quando), obs, true, true);
      const hor = Astronomy.Horizon(Astronomy.MakeTime(quando), obs, equ.ra, equ.dec, 'normal');
      let dim = null, mag = null;
      try {
        const info = Astronomy.Illumination(c.id, Astronomy.MakeTime(quando));
        mag = info.mag;
      } catch (e) { /* magnitudine non disponibile */ }
      if (c.id === 'Moon') {
        dim = 31;   // primi d'arco, mezzo grado abbondante
      } else {
        dim = telDiametroPianeta(c.id, quando);
      }
      lista.push({
        id: c.id, nome: c.nome, gruppo: 'pianeti', colore: c.colore,
        ra: equ.ra, dec: equ.dec, alt: hor.altitude, az: hor.azimuth,
        dim, mag, aspetto: TEL_ASPETTO_PIANETI[c.id] || null
      });
    } catch (e) { /* corpo non calcolabile: si salta */ }
  });

  // Deep sky: coordinate fisse, ma il giudizio dipende dall'apertura
  if (typeof SKY_PROFONDO !== 'undefined') {
    SKY_PROFONDO.forEach(o => {
      const asp = telAspettoProfondo(o.nome);
      const hor = altAzCoordinate(o.ra, o.dec, quando, obs);
      lista.push({
        id: 'dso-' + o.nome.slice(0, 12), nome: o.nome, gruppo: 'profondo',
        colore: (typeof SKY_COLORI_PROFONDO !== 'undefined' && SKY_COLORI_PROFONDO[o.tipo]) || '#a5f3fc',
        ra: o.ra, dec: o.dec, j2000: true, alt: hor.alt, az: hor.az,
        dim: asp ? asp.dim : null, mag: o.mag, nota: o.nota,
        tipo: o.tipo, aspetto: asp
      });
    });
  }

  // Stelle luminose: servono da riferimento per allineare e calibrare
  telStelle().filter(s => s.mag <= 2).forEach(s => {
    const hor = altAzCoordinate(s.ra, s.dec, quando, obs);
    lista.push({
      id: 'star-' + s.nome, nome: s.nome, gruppo: 'stelle', colore: '#e2e8f0',
      ra: s.ra, dec: s.dec, j2000: true, alt: hor.alt, az: hor.az,
      dim: null, mag: s.mag, costellazione: s.costellazione
    });
  });

  // Alla portata dello strumento? Un oggetto più debole del limite non
  // si vede, e va detto prima di far perdere mezz'ora a cercarlo.
  const limite = telMagnitudineLimite(p);
  lista.forEach(o => {
    o.allaPortata = o.mag == null || o.mag <= limite;
  });

  return lista;
}

// Le coordinate da mettere sulle manopole sono quelle di stanotte, non
// quelle stampate sul catalogo. Pianeti e Luna arrivano già calcolati per
// oggi; stelle e deep sky sono J2000 e vanno portati avanti, se no il
// cerchio graduato viene impostato su un cielo di venticinque anni fa.
function telCoordinateOggi(oggetto, data) {
  if (!oggetto) return null;
  if (!oggetto.j2000) return { ra: oggetto.ra, dec: oggetto.dec, aggiornate: false };
  const c = telCoordDiOggi(oggetto.ra, oggetto.dec, data || new Date());
  return { ra: c.ra, dec: c.dec, aggiornate: true };
}

// Diametro apparente di un pianeta in primi d'arco. Astronomy Engine dà
// la distanza; il raggio equatoriale è una costante nota.
const TEL_RAGGI_KM = {
  Mercury: 2439.7, Venus: 6051.8, Mars: 3389.5, Jupiter: 69911,
  Saturn: 58232, Uranus: 25362, Neptune: 24622
};

function telDiametroPianeta(id, data) {
  const raggio = TEL_RAGGI_KM[id];
  if (!raggio) return null;
  try {
    const v = Astronomy.GeoVector(id, Astronomy.MakeTime(data), true);
    const distanzaKm = Math.hypot(v.x, v.y, v.z) * 149597870.7;
    // Angolo sotteso, in primi d'arco
    return (2 * raggio / distanzaKm) * TEL_R2D * 60;
  } catch (e) {
    return null;
  }
}

// =====================================================================
// 2. ALLINEAMENTO POLARE
//
//    Una montatura equatoriale fa una cosa sola: gira attorno a un asse.
//    Se quell'asse è parallelo all'asse della Terra, una manopola sola
//    insegue tutto il cielo e il motore ha senso. Se non lo è, il motore
//    insegue una cosa che non esiste e l'oggetto scappa lo stesso.
//
//    La EQ-3 non ha il cannocchiale polare: il manuale dice "punta verso
//    la Polare" e si ferma lì. Ma la Polare non è il polo — gli gira
//    attorno a mezzo grado di distanza — e mezzo grado di errore basta a
//    far scappare un oggetto dal campo del 4 mm in pochi minuti.
//
//    Qui l'allineamento si fa in tre gradini, sempre più precisi:
//      · a occhio, con latitudine e Nord vero (arriva a ~2°)
//      · con l'orologio della Polare (arriva a ~10 primi)
//      · con la deriva, guardando nell'oculare (arriva a 1-2 primi)
//
//    E si fa con gli attrezzi del telefono: la bolla per il treppiede, il
//    goniometro per la scala della latitudine, la bussola per il Nord —
//    accesi dentro il passo che li usa, non spiegati a parole in un
//    elenco da leggere in piedi al buio.
// =====================================================================

// Coordinate J2000 della Polare, dal catalogo delle costellazioni.
const TEL_POLARE_J2000 = { ra: 2.530, dec: 89.264 };

// Dove sta il polo nord celeste: sempre esattamente a Nord vero, e alto
// sull'orizzonte quanto la latitudine. È l'unico punto del cielo che non
// si muove mai, e la ragione per cui la scala della latitudine sulla
// montatura è tarata in gradi.
function telPoloCeleste() {
  const l = luogoCorrente();
  if (!l) return null;
  return { az: 0, alt: l.lat, lat: l.lat };
}

// L'orologio della Polare: dove si trova la stella rispetto al polo in
// questo momento. L'angolo è misurato da "sopra il polo", in senso
// antiorario, che è il verso in cui gira il cielo visto da Nord.
function telOrologioPolare(data) {
  const l = luogoCorrente();
  if (!l || l.lat <= 0) return null;
  const quando = data || new Date();
  const oggi = telCoordDiOggi(TEL_POLARE_J2000.ra, TEL_POLARE_J2000.dec, quando);
  const ha = telAngoloOrario(oggi.ra, quando, l);
  if (ha == null) return null;

  const distanza = 90 - oggi.dec;          // in gradi, oggi vale circa 0,64°
  const angolo = ((ha * 15) % 360 + 360) % 360;

  // L'ora del quadrante, come la si legge su un reticolo polare
  const oraQuadrante = ((ha % 24) + 24) % 24;

  return {
    ra: oggi.ra, dec: oggi.dec,
    ha, angolo, distanza,
    distanzaMin: distanza * 60,
    oraQuadrante,
    // Il verso in cui la Polare sta rispetto al polo, detto a parole
    verso: telVersoOrologio(angolo),
    // E il verso opposto: dove sta il polo *rispetto alla Polare*. È
    // quello che serve davvero, perché al cercatore si guarda la Polare
    // e da lì ci si sposta.
    versoPolo: telVersoSecco(angolo + 180),
    // Lo stesso verso della Polare, ma detto secco: serve quando la frase
    // attorno nomina già il punto di riferimento.
    versoSecco: telVersoSecco(angolo),
    // Quante Lune piene sta larga quella distanza: un numero che si può
    // stimare a occhio senza righello, di notte, in giardino.
    lune: distanza / 0.52
  };
}

// Le otto direzioni del quadrante, guardando verso Nord a occhio nudo:
// 0° = in alto, e si gira in senso antiorario, cioè verso sinistra
// (Ovest), che è il verso in cui gira il cielo attorno al polo.
const TEL_SETTORI = [
  'in alto', 'in alto a sinistra', 'a sinistra (Ovest)', 'in basso a sinistra',
  'in basso', 'in basso a destra', 'a destra (Est)', 'in alto a destra'
];

function telVersoSecco(angolo) {
  return TEL_SETTORI[Math.round(((angolo % 360) + 360) % 360 / 45) % 8];
}

function telVersoOrologio(angolo) {
  const v = telVersoSecco(angolo);
  // Detto del polo: "sopra il polo" si legge meglio di "in alto del polo".
  if (v === 'in alto') return 'esattamente sopra il polo';
  if (v === 'in basso') return 'esattamente sotto il polo';
  return `${v} rispetto al polo`;
}

// Lo scarto fra il Nord della bussola e il Nord vero. La vista Cielo lo
// calcola già, ma solo dopo che è stata aperta almeno una volta: qui
// serve subito, e si ricava dalla posizione senza passare da lei.
function telDeclinazioneMagnetica() {
  if (typeof sky !== 'undefined' && sky.posizione && isFinite(sky.declinazione)) return sky.declinazione;
  const l = luogoCorrente();
  if (!l || typeof skyDeclinazioneMagnetica !== 'function') return 0;
  try {
    const d = skyDeclinazioneMagnetica(l.lat, l.lon, new Date());
    return isFinite(d) ? d : 0;
  } catch (e) {
    return 0;
  }
}

// Che numero deve segnare la bussola quando si guarda il Nord vero. È
// più utile di "correggi di tot gradi", perché toglie di mezzo il dubbio
// su da che parte correggere — che è l'errore che fanno tutti.
function telBussolaNordVero() {
  const d = telDeclinazioneMagnetica();
  return ((360 - d) % 360 + 360) % 360;
}

// --- I sensori del telefono al posto degli attrezzi ---------------------
//
//    Per allineare una montatura equatoriale servono tre attrezzi: una
//    livella, un goniometro e una bussola. Un telefono li ha tutti e tre
//    dentro, e sono anche già tarati. La vista Cielo usa gli stessi
//    sensori per orientare la mappa; qui servono per una cosa molto più
//    prosaica, cioè dire "gira il treppiede di tre gradi a destra" e
//    cambiare colore quando è fatto.
//
//    Le tolleranze sotto non sono arbitrarie: sono quelle sotto le quali
//    l'errore residuo non si vede più all'oculare.

const TEL_TOLLERANZA_NORD = 2;        // gradi di azimut
const TEL_TOLLERANZA_BOLLA = 0.8;     // gradi di inclinazione del treppiede
const TEL_TOLLERANZA_GRADI = 0.7;     // gradi sulla scala della latitudine

// Quanto ballerino può essere il numero della bussola prima che sia il
// caso di dirlo: sopra questo rumore c'è ferro vicino, o il magnetometro
// non è tarato.
const TEL_JITTER_SOSPETTO = 2.5;

function telStatoSensori() {
  const orient = (typeof sky !== 'undefined' && sky.orient) ? sky.orient : null;
  return {
    // Livella e goniometro funzionano appena arrivano i primi eventi
    attivi: !!(typeof sky !== 'undefined' && sky.sensori && orient),
    // La bussola no: su Android l'orientamento può arrivare "relativo",
    // cioè con l'azimut che parte da dove stava il telefono quando il
    // sensore si è accesso. In quel caso il numero è un numero qualunque,
    // e spacciarlo per il Nord farebbe sbagliare l'allineamento.
    bussolaVera: !!(typeof sky !== 'undefined' && sky.sensori && orient && sky.assoluto),
    possibile: typeof DeviceOrientationEvent !== 'undefined'
  };
}

// Dove sta guardando il telefono, in azimut vero. Il numero è già
// corretto della declinazione magnetica e della calibrazione manuale
// fatta nella vista Cielo: quello che esce da qui si confronta
// direttamente con l'azimut di un astro.
//
// Il telefono si può tenere in due modi, e l'asse da leggere è diverso:
// appoggiato in piano conta dove punta il lato alto, tenuto in verticale
// conta il dorso (dove guarda la fotocamera). Sceglie l'app in base a
// com'è inclinato, perché leggere l'asse sbagliato dà un numero che
// gira da solo appena si muove il polso.
function telBussolaTelefono() {
  const stato = telStatoSensori();
  if (!stato.attivi) return null;
  const R = telMatriceTelefono();
  if (!R) return null;

  const alto = [R[0][1], R[1][1], R[2][1]];        // +Y del telefono, in Est/Nord/Alto
  const dorso = [-R[0][2], -R[1][2], -R[2][2]];    // -Z: la direzione della fotocamera
  const modo = Math.abs(alto[2]) <= Math.abs(dorso[2]) ? 'piatto' : 'ritto';
  const asse = modo === 'piatto' ? alto : dorso;

  // Se l'asse scelto punta quasi allo zenit non ha più un azimut: capita
  // tenendo il telefono a 45°, che è il modo in cui non va tenuto.
  const orizzontale = Math.hypot(asse[0], asse[1]);
  if (orizzontale < 0.2) {
    return { modo, ambiguo: true, bussolaVera: stato.bussolaVera, jitter: null };
  }

  const az = ((Math.atan2(asse[0], asse[1]) * TEL_R2D) % 360 + 360) % 360;
  const inclinazione = Math.asin(Math.max(-1, Math.min(1, asse[2]))) * TEL_R2D;

  return {
    az,
    modo,
    ambiguo: false,
    // Quanto è inclinato l'asse che stiamo leggendo: a bussola piatta
    // dovrebbe essere quasi zero, e se non lo è il numero peggiora.
    inclinazione,
    storto: modo === 'piatto' && Math.abs(inclinazione) > 20,
    bussolaVera: stato.bussolaVera,
    jitter: telJitterBussola(az)
  };
}

// Quanto è disturbata la lettura della bussola. Non c'è modo di leggere il
// campo magnetico grezzo da una pagina web, ma un magnetometro disturbato
// si tradisce comunque: il numero salta avanti e indietro.
//
// La misura ovvia — di quanto è larga la finestra delle ultime letture —
// non va bene: mentre si gira il treppiede il numero cambia *per forza*,
// e darebbe un allarme continuo proprio nel momento in cui si sta
// lavorando. Quel che distingue il rumore da una rotazione vera è che una
// rotazione è liscia: cresce piano e in un verso. Quindi si guarda la
// differenza seconda, cioè quanto la lettura "curva" da un campione al
// successivo: per una rotazione a velocità qualunque è zero, per il
// rumore è dell'ordine del rumore stesso.
function telJitterBussola(az) {
  const storico = tel.bussola.storico;
  const adesso = Date.now();
  storico.push({ t: adesso, az });
  while (storico.length && adesso - storico[0].t > 2500) storico.shift();
  if (storico.length < 8) return null;

  // Le differenze fra letture consecutive, riportate nell'intervallo
  // ±180°: fra 359° e 1° la differenza è 2, non 358.
  const diff = [];
  for (let i = 1; i < storico.length; i++) {
    let d = storico[i].az - storico[i - 1].az;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    diff.push(d);
  }

  let somma = 0;
  for (let i = 1; i < diff.length; i++) somma += Math.abs(diff[i] - diff[i - 1]);
  const curvatura = somma / (diff.length - 1);
  // Per rumore bianco la differenza seconda vale in media un paio di volte
  // il rumore: dividendo si torna all'ampiezza, che è il numero che ha
  // senso mostrare.
  return curvatura / 2;
}

// Di quanto e da che parte girare, per portare la bussola sul valore
// giusto. Lo scarto si dice sempre col verso, mai col segno: "3° a
// destra" non si può capire al rovescio, "-3°" sì.
function telScartoAzimut(attuale, bersaglio) {
  let d = bersaglio - attuale;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return {
    gradi: d,
    modulo: Math.abs(d),
    verso: d > 0 ? 'destra' : 'sinistra',
    // "in senso orario" è il verso in cui si gira il treppiede guardandolo
    // da sopra, ed è l'unica formulazione che non si sbaglia di notte.
    senso: d > 0 ? 'orario' : 'antiorario'
  };
}

// La livella: inclinazione del telefono, sui due assi. La riga "Alto"
// della matrice dice quanto ciascun asse del telefono punta allo zenit,
// e da lì escono i due angoli — nessun bisogno di leggere beta e gamma,
// che vicino alla verticale impazziscono.
//
// Serve due volte, per due mestieri diversi: appoggiato sulla testa del
// treppiede è una bolla, appoggiato lungo l'asse polare è un goniometro.
function telLivella() {
  const stato = telStatoSensori();
  if (!stato.attivi) return null;
  const R = telMatriceTelefono();
  if (!R) return null;
  const arcoseno = v => Math.asin(Math.max(-1, Math.min(1, v))) * TEL_R2D;
  return {
    // Il lato alto del telefono su o giù: è l'angolo che si legge
    // appoggiandolo di lungo su un tubo o su un asse.
    inclinazione: arcoseno(R[2][1]),
    // Il fianco destro su o giù: la seconda bolla, quella che dice se il
    // telefono è sghembo.
    sbandamento: arcoseno(R[2][0])
  };
}

// L'alternativa alla bussola quando c'è il Sole: l'ombra di un'asta
// verticale punta esattamente all'opposto del Sole, e l'azimut del Sole
// lo sappiamo al decimo di grado. È il modo con cui si trovava il Nord
// prima dei magnetometri, e funziona anche in mezzo a un capannone di
// ferro.
function telNordDallOmbra(data) {
  const obs = osservatoreCorrente();
  if (!obs || typeof altAzCorpo !== 'function') return null;
  try {
    const h = altAzCorpo('Sun', data || new Date(), obs);
    // Sole troppo basso: l'ombra è lunghissima e i bordi si sfumano.
    // Troppo alto: è corta e il verso si legge male.
    if (h.alt < 5 || h.alt > 75) return null;
    const azOmbra = (h.az + 180) % 360;
    return { altSole: h.alt, azSole: h.az, azOmbra, scarto: telScartoAzimut(azOmbra, 0) };
  } catch (e) {
    return null;
  }
}

// Posizione della Polare in altezza e azimut: serve alla realtà
// aumentata, che ragiona in coordinate del cielo e non di quadrante.
function telPolareAltAz(data) {
  const obs = osservatoreCorrente();
  if (!obs) return null;
  const quando = data || new Date();
  const oggi = telCoordDiOggi(TEL_POLARE_J2000.ra, TEL_POLARE_J2000.dec, quando);
  const hor = altAzCoordinate(oggi.ra, oggi.dec, quando, obs);
  return { alt: hor.alt, az: hor.az };
}

// --- Allineamento per deriva ------------------------------------------
//
//    È il metodo più preciso che esista senza elettronica, e funziona
//    così: si guarda una stella e si aspetta. Se l'asse polare è storto,
//    la stella scivola verso Nord o verso Sud — e la direzione e la
//    velocità di quello scivolamento dicono *esattamente* di quanto e da
//    che parte è storto l'asse.
//
//    Il conto sotto non è una regoletta approssimata: è la geometria
//    vera. La velocità con cui la stella deriva in declinazione vale
//        dδ/dt = ω · (ε × S) · d̂
//    dove ε è l'errore dell'asse polare, S la direzione della stella,
//    d̂ la direzione verso il polo, ω la rotazione del cielo. Calcolando
//    quel prodotto per l'errore in azimut e per quello in altezza si
//    ottengono i due coefficienti di sensibilità della stella scelta.
//
//    Da questo discendono le due regole classiche, che qui però non sono
//    memorizzate a mano ma escono dal conto: una stella al meridiano
//    parla dell'errore in azimut, una a Est o a Ovest di quello in
//    altezza.

// Quanto deriva una stella, per ogni primo d'arco di errore dell'asse.
// Restituisce due coefficienti in secondi d'arco al minuto.
function telSensibilitaDeriva(alt, az, latitudine) {
  const fi = latitudine * TEL_D2R;
  const S = telVersore(az, alt);
  const p = [0, Math.cos(fi), Math.sin(fi)];       // polo celeste

  // Direzione di declinazione crescente nel punto S: verso il polo,
  // tolta la parte lungo la linea di vista.
  const proiezione = telDot(p, S);
  const d = telNormalizza([
    p[0] - proiezione * S[0],
    p[1] - proiezione * S[1],
    p[2] - proiezione * S[2]
  ]);
  // Stella troppo vicina al polo: la direzione "verso il polo" non è
  // più definita e la deriva non dice più niente di utile.
  if (Math.abs(proiezione) > 0.999) return null;

  // Spostamento del polo per un radiante di errore, nei due assi della
  // montatura: azimut positivo = asse ruotato verso Ovest,
  // altezza positiva = asse troppo alto.
  const epsAz = [-Math.cos(fi), 0, 0];
  const epsAlt = [0, -Math.sin(fi), Math.cos(fi)];

  const coefAz = telDot(telCross(epsAz, S), d);
  const coefAlt = telDot(telCross(epsAlt, S), d);

  // Da radianti a "secondi d'arco al minuto, per primo d'arco di errore"
  const k = TEL_ARCSEC_MIN / TEL_ARCMIN_PER_RAD;   // ≈ 0,2618

  return { az: k * coefAz, alt: k * coefAlt, coefAz, coefAlt };
}

// Che tipo di stella è, ai fini della deriva: quella buona per l'azimut
// sta a Sud vicino al meridiano, quella buona per l'altezza sta bassa a
// Est o a Ovest. Il giudizio esce dai coefficienti, non dalla posizione.
function telRuoloStellaDeriva(sens) {
  if (!sens) return { ruolo: 'inutile', testo: 'Troppo vicina al polo: non deriva in modo leggibile.' };
  const a = Math.abs(sens.coefAz), h = Math.abs(sens.coefAlt);
  if (a < 0.15 && h < 0.15) return { ruolo: 'inutile', testo: 'Poco sensibile: cercane un\'altra.' };
  if (a > h * 2.5) return { ruolo: 'azimut', testo: 'Ottima per l\'errore in azimut (la manopola che gira il treppiede).' };
  if (h > a * 2.5) return { ruolo: 'altezza', testo: 'Ottima per l\'errore in altezza (la scala della latitudine).' };
  return { ruolo: 'misto', testo: 'Sensibile a tutt\'e due gli errori: va bene come seconda misura.' };
}

// Le stelle migliori da usare adesso, divise per ruolo. Si scelgono fra
// quelle luminose e abbastanza alte da non ballare nella foschia.
function telStelleDeriva(data) {
  const obs = osservatoreCorrente();
  const l = luogoCorrente();
  if (!obs || !l) return [];
  const quando = data || new Date();

  return telStelle()
    .filter(s => s.mag <= 2.6)
    .map(s => {
      const hor = altAzCoordinate(s.ra, s.dec, quando, obs);
      const sens = telSensibilitaDeriva(hor.alt, hor.az, l.lat);
      const ruolo = telRuoloStellaDeriva(sens);
      return Object.assign({}, s, { alt: hor.alt, az: hor.az, sens, ruolo: ruolo.ruolo, ruoloTesto: ruolo.testo });
    })
    .filter(s => s.alt > 15 && s.alt < 75 && s.sens)
    .sort((a, b) => b.alt - a.alt);
}

// Da una misura di deriva all'errore dell'asse. Con una misura sola si
// assume che l'altro errore sia trascurabile (è il metodo classico: si
// sceglie la stella apposta); con due misure il sistema si risolve
// davvero, ed è molto più onesto.
//
// misure: [{ derivaArcsec, minuti, sens }] con deriva positiva = verso Nord
// Sotto questo tempo la misura non vale niente: la deriva da allineamento
// è dell'ordine del secondo d'arco al minuto, e in trenta secondi quello
// che si vede muovere è il seeing, non l'errore dell'asse.
const TEL_DERIVA_MINUTI_MINIMI = 1.5;

function telRisolviDeriva(misure) {
  const tutte = (misure || []).filter(m => m && m.sens && m.minuti > 0);
  if (!tutte.length) return null;

  // Le misure troppo brevi non entrano nel conto: farle pesare vorrebbe
  // dire moltiplicare per venti il rumore del seeing e stampare un
  // errore di mezzo grado con l'aria di un dato preciso.
  const valide = tutte.filter(m => m.minuti >= TEL_DERIVA_MINUTI_MINIMI);
  if (!valide.length) return { troppoBreve: true, minimo: TEL_DERIVA_MINUTI_MINIMI };

  if (valide.length === 1) {
    const m = valide[0];
    const tasso = m.derivaArcsec / m.minuti;
    // Si attribuisce tutto all'asse su cui la stella è più sensibile
    const usaAzimut = Math.abs(m.sens.az) >= Math.abs(m.sens.alt);
    const k = usaAzimut ? m.sens.az : m.sens.alt;
    if (Math.abs(k) < 0.02) return null;
    const errore = tasso / k;
    return {
      az: usaAzimut ? errore : null,
      alt: usaAzimut ? null : errore,
      parziale: true,
      residuoAltroAsse: usaAzimut ? 'altezza' : 'azimut'
    };
  }

  // Due o più misure: si prendono le due più indipendenti fra loro, così
  // il sistema non è quasi singolare (due stelle vicine dicono la stessa
  // cosa due volte e il risultato esplode).
  let miglioreA = null, miglioreB = null, miglioreDet = 0;
  for (let i = 0; i < valide.length; i++) {
    for (let j = i + 1; j < valide.length; j++) {
      const det = valide[i].sens.az * valide[j].sens.alt - valide[i].sens.alt * valide[j].sens.az;
      if (Math.abs(det) > Math.abs(miglioreDet)) {
        miglioreDet = det; miglioreA = valide[i]; miglioreB = valide[j];
      }
    }
  }
  if (!miglioreA || Math.abs(miglioreDet) < 0.01) {
    // Le stelle scelte sono troppo simili: meglio dire che serve una
    // stella in un'altra zona di cielo che dare un numero inventato.
    return { insufficiente: true };
  }

  const r1 = miglioreA.derivaArcsec / miglioreA.minuti;
  const r2 = miglioreB.derivaArcsec / miglioreB.minuti;
  const eAz = (r1 * miglioreB.sens.alt - r2 * miglioreA.sens.alt) / miglioreDet;
  const eAlt = (miglioreA.sens.az * r2 - miglioreB.sens.az * r1) / miglioreDet;

  return { az: eAz, alt: eAlt, parziale: false, stelle: [miglioreA.stella, miglioreB.stella] };
}

// Le correzioni da fare sulle manopole, dette come si fanno davvero.
function telCorrezioniDeriva(errore) {
  if (!errore || errore.insufficiente || errore.troppoBreve) return [];
  const righe = [];

  if (errore.az != null && isFinite(errore.az)) {
    // Errore in azimut positivo = asse polare ruotato verso Ovest
    const verso = errore.az > 0 ? 'EST' : 'OVEST';
    righe.push({
      asse: 'azimut',
      testo: `Asse polare spostato di ${Math.abs(errore.az).toFixed(1)}′ verso ${errore.az > 0 ? 'Ovest' : 'Est'}.`,
      azione: `Gira le viti di azimut (quelle che ruotano tutta la montatura sul treppiede) portando l'asse di ${Math.abs(errore.az).toFixed(1)}′ verso ${verso}.`,
      valore: errore.az
    });
  }
  if (errore.alt != null && isFinite(errore.alt)) {
    const verso = errore.alt > 0 ? 'abbassa' : 'alza';
    righe.push({
      asse: 'altezza',
      testo: `Asse polare ${errore.alt > 0 ? 'troppo alto' : 'troppo basso'} di ${Math.abs(errore.alt).toFixed(1)}′.`,
      azione: `${verso === 'abbassa' ? 'Abbassa' : 'Alza'} la scala della latitudine di ${Math.abs(errore.alt).toFixed(1)}′ (${(Math.abs(errore.alt) / 60).toFixed(2)}°).`,
      valore: errore.alt
    });
  }
  return righe;
}

// Con questo errore residuo, quanto tempo resta un oggetto nel campo?
// È la domanda che conta davvero: dice quando smettere di allineare.
function telAutonomiaInseguimento(erroreArcmin, combinazione) {
  if (!combinazione || !isFinite(erroreArcmin) || erroreArcmin <= 0) return null;
  // Nel caso peggiore la sensibilità vale 1: è il limite prudente
  const tassoMax = (TEL_ARCSEC_MIN / TEL_ARCMIN_PER_RAD) * erroreArcmin;   // arcsec/min
  if (tassoMax <= 0) return null;
  const mezzoCampo = combinazione.campoRealeMin * 60 / 2;                   // arcsec
  return mezzoCampo / tassoMax;                                            // minuti
}

// Deriva misurata in frazioni di campo: è l'unico modo pratico di
// misurarla senza un oculare a reticolo, e lo strumento il campo lo sa.
const TEL_FRAZIONI_CAMPO = [
  { id: 0, nome: 'Ferma: non si è mossa', valore: 0 },
  { id: 1, nome: 'Un filo (un ventesimo di campo)', valore: 1 / 20 },
  { id: 2, nome: 'Un decimo di campo', valore: 1 / 10 },
  { id: 3, nome: 'Un ottavo di campo', valore: 1 / 8 },
  { id: 4, nome: 'Un quarto di campo', valore: 1 / 4 },
  { id: 5, nome: 'Un terzo di campo', valore: 1 / 3 },
  { id: 6, nome: 'Mezzo campo', valore: 1 / 2 },
  { id: 7, nome: 'Uscita dal campo', valore: 1 }
];

// =====================================================================
// 3. PUNTARE
//
//    Tre modi di arrivare sull'oggetto. Nessuno dei tre richiede di
//    comprare niente, e nel pannello se ne mostra uno per volta: quello
//    che si sta usando. Tre schede aperte insieme, con le mani fredde,
//    vogliono dire scorrere per trovare quella giusta.
//
//    a) I cerchi graduati digitali: si centra una stella nota, si dice
//       all'app "sono qui", e da lì in poi lei dà gli scarti da fare
//       sulle due manopole. È il modo in cui si usano davvero i cerchi
//       di una montatura economica: mai in assoluto, sempre come
//       differenza da qualcosa che si è appena centrato.
//
//    b) I salti di stella: il percorso disegnato da una stella visibile
//       a occhio nudo fino all'oggetto, un campo di cercatore alla volta.
//
//    c) Il push-to: il telefono attaccato al tubo, come nelle app famose
//       di puntamento assistito. Si sincronizza su una stella nota e da
//       lì un radar dice, in tempo reale, quanto manca e da che parte —
//       con un battito che si infittisce, così si può puntare tenendo
//       l'occhio nel cercatore invece che sullo schermo.
// =====================================================================

// --- a) Cerchi graduati digitali ---------------------------------------

// Si centra una stella nota e si fissa il riferimento. Da qui in poi
// ogni spostamento è una differenza rispetto a questo punto.
function telFissaRiferimento(oggetto, data) {
  if (!oggetto) return false;
  const quando = data || new Date();
  // Si registrano le coordinate di stanotte, non quelle di catalogo: il
  // cerchio graduato va tarato sul cielo che hai davanti.
  const c = telCoordinateOggi(oggetto, quando);
  tel.riferimento = {
    ra: c.ra,
    dec: c.dec,
    nome: oggetto.nome,
    quando: quando.getTime()
  };
  telSalvaSessione();
  return true;
}

// Lo scarto da fare sulle due manopole per passare dal riferimento al
// bersaglio.
//
// Il conto cambia a seconda che il motore sia acceso o no, ed è una
// differenza che quasi tutte le guide dimenticano:
//   · con il motore l'asse insegue il cielo, quindi lo scarto in
//     ascensione retta resta quello di partenza, per sempre;
//   · senza motore il cielo continua a scorrere mentre tu armeggi, e
//     allo scarto va aggiunto tutto il tempo siderale passato dalla
//     calibrazione.
function telScartoVerso(bersaglio, data) {
  if (!tel.riferimento || !bersaglio) return null;
  const quando = data || new Date();
  const p = telProfilo();
  const meta = telCoordinateOggi(bersaglio, quando);

  // Positivo = bisogna aumentare l'angolo orario, cioè andare verso Ovest
  let dHA = tel.riferimento.ra - meta.ra;

  if (!p.motoreAR) {
    const lstOra = telTempoSiderale(quando);
    const lstCal = telTempoSiderale(new Date(tel.riferimento.quando));
    if (lstOra != null && lstCal != null) {
      let scorso = lstOra - lstCal;
      // Il tempo siderale gira in 24 ore: una sessione lunga può
      // scavalcare la mezzanotte siderale.
      while (scorso < -12) scorso += 24;
      while (scorso > 12) scorso -= 24;
      dHA += scorso;
    }
  }

  while (dHA > 12) dHA -= 24;
  while (dHA < -12) dHA += 24;

  const dDec = meta.dec - tel.riferimento.dec;

  // Il numero da leggere sul cerchio orario quando ci sei arrivato. Se il
  // cerchio è stato tarato sull'ascensione retta della stella di
  // riferimento, questo è semplicemente quel valore meno lo scarto — e
  // senza motore tiene già conto del cielo scorso nel frattempo.
  const letturaAR = ((tel.riferimento.ra - dHA) % 24 + 24) % 24;

  return {
    dHA,
    dDec,
    letturaAR,
    ra: meta.ra,
    dec: meta.dec,
    versoRA: dHA > 0 ? 'Ovest' : 'Est',
    versoDec: dDec > 0 ? 'Nord' : 'Sud',
    haBersaglio: telAngoloOrario(meta.ra, quando),
    conMotore: !!p.motoreAR,
    riferimento: tel.riferimento.nome
  };
}

// --- b) Salti di stella ------------------------------------------------

// Angolo di posizione da un punto all'altro del cielo: si misura da Nord
// verso Est, ed è il modo in cui si descrive una direzione fra due astri.
function telAngoloPosizione(ra1, dec1, ra2, dec2) {
  const d1 = dec1 * TEL_D2R, d2 = dec2 * TEL_D2R;
  const dra = (ra2 - ra1) * 15 * TEL_D2R;
  const y = Math.sin(dra) * Math.cos(d2);
  const x = Math.cos(d1) * Math.sin(d2) - Math.sin(d1) * Math.cos(d2) * Math.cos(dra);
  return ((Math.atan2(y, x) * TEL_R2D) % 360 + 360) % 360;
}

const TEL_DIREZIONI = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ovest', 'Ovest', 'Nord-Ovest'];
function telNomeDirezioneCielo(angoloPosizione) {
  return TEL_DIREZIONI[Math.round(angoloPosizione / 45) % 8];
}

// Il percorso a salti da una stella visibile a occhio nudo fino
// all'oggetto. Ogni salto sta dentro un campo di cercatore: è la
// lunghezza massima che si riesce a fare senza perdersi.
function telPercorsoSalti(bersaglio) {
  if (!bersaglio) return null;
  const p = telProfilo();
  const cercatore = TEL_CERCATORI[p.cercatore] || TEL_CERCATORI.reddot;
  const passoMax = cercatore.campo * 0.85;

  // Partenza: una stella luminosa vicina. Si preferisce quella che dà il
  // miglior compromesso fra "si vede a occhio nudo" e "è già vicina".
  let partenza = null, punteggio = Infinity;
  telStelle().forEach(s => {
    if (s.mag > 2.8) return;
    const d = telSeparazioneEq(bersaglio.ra, bersaglio.dec, s.ra, s.dec);
    if (d > 35) return;
    const valore = d + s.mag * 3;
    if (valore < punteggio) { punteggio = valore; partenza = s; }
  });

  if (!partenza) {
    return {
      partenza: null,
      salti: [],
      avviso: 'Nessuna stella luminosa abbastanza vicina: conviene arrivarci con i cerchi graduati o con il telefono sul tubo.'
    };
  }

  const salti = [];
  let corrente = { ra: partenza.ra, dec: partenza.dec, nome: partenza.nome };
  let distanza = telSeparazioneEq(corrente.ra, corrente.dec, bersaglio.ra, bersaglio.dec);
  const usate = new Set([partenza.nome]);
  let sicurezza = 0;

  while (distanza > passoMax && sicurezza++ < 8) {
    // La tappa successiva: una stella del catalogo che stia dentro un
    // campo di cercatore e che avvicini davvero al bersaglio.
    let tappa = null, migliore = distanza;
    telStelle().forEach(s => {
      if (usate.has(s.nome) || s.mag > 4.5) return;
      const dalPunto = telSeparazioneEq(corrente.ra, corrente.dec, s.ra, s.dec);
      if (dalPunto > passoMax || dalPunto < 0.5) return;
      const alBersaglio = telSeparazioneEq(s.ra, s.dec, bersaglio.ra, bersaglio.dec);
      if (alBersaglio < migliore) { migliore = alBersaglio; tappa = s; }
    });

    if (!tappa) break;

    salti.push({
      da: corrente.nome,
      a: tappa.nome,
      gradi: telSeparazioneEq(corrente.ra, corrente.dec, tappa.ra, tappa.dec),
      direzione: telNomeDirezioneCielo(telAngoloPosizione(corrente.ra, corrente.dec, tappa.ra, tappa.dec)),
      mag: tappa.mag,
      ra: tappa.ra, dec: tappa.dec
    });
    usate.add(tappa.nome);
    corrente = { ra: tappa.ra, dec: tappa.dec, nome: tappa.nome };
    distanza = migliore;
  }

  // Ultimo tratto: dall'ultima stella all'oggetto, che quasi sempre non
  // si vede nel cercatore e va cercato nell'oculare più largo.
  const combinazioni = telCombinazioni(p);
  const larga = combinazioni.find(c => !c.vuoto) || combinazioni[0];
  salti.push({
    da: corrente.nome,
    a: bersaglio.nome,
    gradi: distanza,
    direzione: telNomeDirezioneCielo(telAngoloPosizione(corrente.ra, corrente.dec, bersaglio.ra, bersaglio.dec)),
    finale: true,
    campiOculare: larga ? distanza / larga.campoReale : null
  });

  return {
    partenza,
    salti,
    cercatore,
    totale: telSeparazioneEq(partenza.ra, partenza.dec, bersaglio.ra, bersaglio.dec)
  };
}

// --- c) Il push-to: il telefono sul tubo -------------------------------
//
//    È il metodo delle app famose di puntamento assistito, e funziona
//    così: si fissa il telefono al tubo, si centra una stella nota, si
//    dice "adesso sono qui". Da quel momento il telefono sa dove guarda
//    il tubo e dice quanto manca al bersaglio, in tempo reale, mentre lo
//    si spinge. Nessun encoder, nessun cavo, nessuna montatura
//    computerizzata: solo i sensori che il telefono ha già.
//
//    Il trucco dell'allineamento sta in una riga: non serve sapere *come*
//    è montato il telefono. Con una stella si ricava l'asse del tubo
//    espresso negli assi del telefono (u = Rᵀ·v), e da lì la direzione
//    del tubo è R·u, comunque sia attaccato il supporto.
//
//    Ma con una stella sola resta dentro un errore che non si vede: il
//    magnetometro. Su un telefono la bussola sbaglia di cinque, dieci,
//    anche quindici gradi, e vicino a un tubo d'acciaio di più; quella
//    rotazione sbagliata attorno alla verticale entra dritta nel conto.
//
//    Da qui la seconda idea, ed è quella che fa la differenza fra un
//    push-to che funziona e uno che fa perdere la serata: con due stelle
//    (o più) si può risolvere *anche* l'errore della bussola. Il modello è
//
//        v = Rz(θ) · R · u
//
//    dove v è la stella nel cielo, R quel che dice il telefono, u l'asse
//    del tubo negli assi del telefono e θ l'errore di bussola. Gli
//    incliniometri del telefono sono buoni — la gravità non si sbaglia —
//    quindi basta correggere la rotazione attorno alla verticale. Due
//    stelle danno quattro vincoli per tre incognite (u ne ha due, θ una):
//    si risolve minimizzando su θ, che è una sola variabile e si può
//    cercare a forza bruta in mezzo millisecondo.
//
//    Risultato pratico: con una stella la precisione è quella della
//    bussola (2–3° nel migliore dei casi, molto peggio col ferro
//    vicino); con due stelle lontane fra loro scende a mezzo grado, cioè
//    dentro il campo di un oculare. È la differenza fra "da qualche parte
//    lì" e "ce l'hai nell'oculare".

function telMatriceTelefono() {
  if (typeof sky === 'undefined' || !sky.orient) return null;
  if (typeof skyMatriceDispositivo !== 'function') return null;
  const correzione = typeof skyCorrezioneNord === 'function' ? skyCorrezioneNord() : 0;
  return skyMatriceDispositivo(
    (sky.orient.alpha + correzione + (sky.offsetBussola || 0)) * TEL_D2R,
    sky.orient.beta * TEL_D2R,
    sky.orient.gamma * TEL_D2R
  );
}

function telApplicaMatrice(R, v) {
  return [
    R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2],
    R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2],
    R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]
  ];
}

// Trasposta: per una matrice di rotazione è anche l'inversa
function telApplicaTrasposta(R, v) {
  return [
    R[0][0] * v[0] + R[1][0] * v[1] + R[2][0] * v[2],
    R[0][1] * v[0] + R[1][1] * v[1] + R[2][1] * v[2],
    R[0][2] * v[0] + R[1][2] * v[1] + R[2][2] * v[2]
  ];
}

// Rotazione di un versore attorno alla verticale, cioè uno spostamento
// in azimut. È l'unica correzione che serve applicare a quel che dice il
// telefono: l'inclinazione la misura la gravità e non sbaglia, il Nord lo
// misura il magnetometro e sbaglia sempre.
function telRuotaAzimut(v, gradi) {
  const a = gradi * TEL_D2R;
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[1] * s, v[1] * c - v[0] * s, v[2]];
}

// Si centra una stella nell'oculare e si preme il tasto: qui si registra
// la coppia "com'era orientato il telefono" / "dov'era la stella". Sono i
// dati grezzi, non ancora il modello: il modello si ricava da tutti i
// punti insieme, ed è la cosa che rende utile registrarne più di uno.
function telAllineaTubo(oggetto, data) {
  const R = telMatriceTelefono();
  if (!R || !oggetto) return false;
  const obs = osservatoreCorrente();
  if (!obs) return false;
  const quando = data || new Date();
  const hor = altAzCoordinate(oggetto.ra, oggetto.dec, quando, obs);

  tel.tubo.allineamenti.push({
    nome: oggetto.nome.split(' — ')[0],
    R,
    v: telVersore(hor.az, hor.alt),
    alt: hor.alt,
    az: hor.az,
    quando: quando.getTime()
  });
  // Oltre i quattro punti non si guadagna più niente, e i più vecchi sono
  // anche i meno buoni: se nel frattempo il supporto si è mosso di un
  // millimetro, sono loro a mentire.
  while (tel.tubo.allineamenti.length > 4) tel.tubo.allineamenti.shift();

  telRisolviTubo();
  return true;
}

function telAzzeraAllineamentoTubo() {
  tel.tubo.allineamenti = [];
  tel.tubo.modello = null;
}

// Il cuore del push-to: da tutti i punti registrati ricava l'asse del
// tubo negli assi del telefono e l'errore di bussola.
//
// Con un punto solo non c'è scelta: si crede alla bussola (θ = 0).
// Con due o più si cerca il θ che rende i punti coerenti fra loro —
// cioè quello per cui tutti danno lo *stesso* asse del tubo, che è
// l'unica cosa che fisicamente non può cambiare se il telefono è
// avvitato al tubo. Una scansione a un grado su tutto il giro, poi un
// affinamento fine: sono qualche migliaio di prodotti scalari, e si fa
// una volta per allineamento.
function telRisolviTubo() {
  const punti = tel.tubo.allineamenti;
  if (!punti.length) { tel.tubo.modello = null; return null; }

  const prova = theta => {
    const assi = punti.map(a => telApplicaTrasposta(a.R, telRuotaAzimut(a.v, -theta)));
    const somma = assi.reduce((s, x) => [s[0] + x[0], s[1] + x[1], s[2] + x[2]], [0, 0, 0]);
    // Se i punti sono coerenti puntano tutti nello stesso verso e la loro
    // somma è lunga quasi quanto il numero di punti. Se non lo sono, si
    // accorciano fra loro: la lunghezza della somma *è* la misura della
    // coerenza, e non serve nemmeno calcolare gli scarti per cercare il
    // minimo.
    const lunghezza = Math.hypot(somma[0], somma[1], somma[2]);
    const media = telNormalizza(somma);
    const scarto = assi.reduce((m, x) => Math.max(m, telSeparazione(x, media)), 0);
    return { theta, u: media, scarto, lunghezza };
  };

  let migliore;
  if (punti.length === 1) {
    migliore = prova(0);
  } else {
    // Le due stelle devono stare lontane in cielo: se sono vicine, θ non
    // è più osservabile e la ricerca troverebbe un minimo qualunque.
    let baseMax = 0;
    for (let i = 0; i < punti.length; i++) {
      for (let j = i + 1; j < punti.length; j++) {
        baseMax = Math.max(baseMax, telSeparazione(punti[i].v, punti[j].v));
      }
    }
    if (baseMax < 15) {
      // Base troppo corta: si tiene il θ già trovato prima, se c'era, e si
      // usa il punto in più solo per mediare l'asse del tubo.
      const precedente = tel.tubo.modello ? tel.tubo.modello.theta : 0;
      migliore = prova(precedente);
      migliore.baseCorta = true;
      migliore.base = baseMax;
    } else {
      for (let t = -180; t < 180; t += 1) {
        const s = prova(t);
        if (!migliore || s.lunghezza > migliore.lunghezza) migliore = s;
      }
      for (let t = migliore.theta - 1; t <= migliore.theta + 1; t += 0.05) {
        const s = prova(t);
        if (s.lunghezza > migliore.lunghezza) migliore = s;
      }
      migliore.base = baseMax;
    }
  }

  tel.tubo.modello = {
    u: migliore.u,
    theta: migliore.theta,
    punti: punti.length,
    // Lo scarto massimo fra i punti è la stima onesta della precisione:
    // con un punto solo non si può stimare niente, e va detto.
    scarto: punti.length > 1 ? migliore.scarto : null,
    base: migliore.base || null,
    baseCorta: !!migliore.baseCorta,
    stelle: punti.map(a => a.nome)
  };
  return tel.tubo.modello;
}

// Dove sta guardando il tubo adesso
function telDirezioneTubo() {
  const m = tel.tubo.modello;
  if (!m) return null;
  const R = telMatriceTelefono();
  if (!R) return null;
  const v = telNormalizza(telRuotaAzimut(telApplicaMatrice(R, m.u), m.theta));
  const alt = Math.asin(Math.max(-1, Math.min(1, v[2]))) * TEL_R2D;
  const az = ((Math.atan2(v[0], v[1]) * TEL_R2D) % 360 + 360) % 360;
  return { v, alt, az };
}

// Quanto manca al bersaglio, detto nel modo in cui si muove la
// montatura: su una equatoriale non si "alza" e non si "gira", si
// muovono l'ascensione retta e la declinazione.
function telGuidaVersoBersaglio(bersaglio, data) {
  const tubo = telDirezioneTubo();
  const obs = osservatoreCorrente();
  if (!tubo || !obs || !bersaglio) return null;
  const quando = data || new Date();
  const p = telProfilo();

  const hor = altAzCoordinate(bersaglio.ra, bersaglio.dec, quando, obs);
  const vB = telVersore(hor.az, hor.alt);
  const separazione = telSeparazione(tubo.v, vB);

  const cercatore = TEL_CERCATORI[p.cercatore] || TEL_CERCATORI.reddot;
  const guida = {
    separazione,
    altBersaglio: hor.alt,
    azBersaglio: hor.az,
    altTubo: tubo.alt,
    azTubo: tubo.az,
    vTubo: tubo.v,
    vBersaglio: vB,
    dentroCercatore: separazione <= cercatore.campo / 2
  };

  // --- Il quadro per il radar -------------------------------------------
  //
  // Il piano tangente dove sta guardando il tubo, orientato come lo vede
  // l'occhio: in alto lo zenit, e quindi a destra quel che si ha
  // davvero a destra alzando la testa dal telefono. È l'unico
  // orientamento che non richiede di ragionare — un radar con il Nord
  // celeste in alto sarebbe più elegante e completamente inutile al buio.
  const zenit = [0, 0, 1];
  const proiezioneZenit = telDot(zenit, tubo.v);
  let su = telNormalizza([
    zenit[0] - proiezioneZenit * tubo.v[0],
    zenit[1] - proiezioneZenit * tubo.v[1],
    zenit[2] - proiezioneZenit * tubo.v[2]
  ]);
  // Tubo puntato allo zenit: "in alto" non esiste più, e si prende il Nord
  if (Math.abs(proiezioneZenit) > 0.9995) {
    const nord = [0, 1, 0];
    const pn = telDot(nord, tubo.v);
    su = telNormalizza([
      nord[0] - pn * tubo.v[0], nord[1] - pn * tubo.v[1], nord[2] - pn * tubo.v[2]
    ]);
  }
  const destra = telCross(tubo.v, su);

  // Lo scarto in coordinate del radar: proiezione azimutale equidistante,
  // cioè la distanza sul disegno è l'angolo vero in tutte le direzioni.
  const proiezioneB = telDot(vB, tubo.v);
  const perp = [
    vB[0] - proiezioneB * tubo.v[0],
    vB[1] - proiezioneB * tubo.v[1],
    vB[2] - proiezioneB * tubo.v[2]
  ];
  const lunghezza = Math.hypot(perp[0], perp[1], perp[2]);
  if (lunghezza > 1e-9) {
    const dir = [perp[0] / lunghezza, perp[1] / lunghezza, perp[2] / lunghezza];
    guida.dx = separazione * telDot(dir, destra);
    guida.dy = separazione * telDot(dir, su);
  } else {
    guida.dx = 0;
    guida.dy = 0;
  }

  // Dove cadono, sul radar, gli assi lungo cui si muove la montatura. Su
  // una equatoriale il tubo non va su e giù: va lungo la declinazione e
  // lungo l'ascensione retta, e sul disegno quei due assi sono storti di
  // un angolo che cambia con la zona di cielo. Disegnarli è quello che
  // trasforma "il bersaglio è là" in "gira questa manopola".
  const l = luogoCorrente();
  guida.assi = [];
  const angoloSchermo = w => Math.atan2(telDot(w, destra), telDot(w, su));
  if (p.montatura === 'eq' && l) {
    const polo = [0, Math.cos(l.lat * TEL_D2R), Math.sin(l.lat * TEL_D2R)];
    const pp = telDot(polo, tubo.v);
    const versoPolo = telNormalizza([
      polo[0] - pp * tubo.v[0], polo[1] - pp * tubo.v[1], polo[2] - pp * tubo.v[2]
    ]);
    if (Math.abs(pp) < 0.999) {
      const versoEst = telCross(versoPolo, tubo.v);   // ascensione retta crescente
      guida.assi = [
        { nome: 'Dec +', angolo: angoloSchermo(versoPolo), colore: '#fbbf24' },
        { nome: 'AR +', angolo: angoloSchermo(versoEst), colore: '#60a5fa' }
      ];
    }
  } else {
    const versoAz = telNormalizza([Math.cos(tubo.az * TEL_D2R), -Math.sin(tubo.az * TEL_D2R), 0]);
    guida.assi = [
      { nome: 'Alt +', angolo: angoloSchermo(su), colore: '#fbbf24' },
      { nome: 'Az +', angolo: angoloSchermo(versoAz), colore: '#60a5fa' }
    ];
  }

  if (p.montatura === 'eq') {
    // Il tubo, ricondotto a coordinate equatoriali: da lì gli scarti
    // sulle due manopole vere.
    //
    // Anche il bersaglio viene riportato indietro dalla sua posizione
    // apparente invece di usare le coordinate di catalogo: l'andata
    // (Astronomy.Horizon) tiene conto della rifrazione atmosferica e il
    // ritorno no, e facendo lo stesso giro sui due termini l'errore si
    // elide invece di finire tutto nello scarto.
    const eqTubo = telAltAzAEquatoriale(tubo.alt, tubo.az, quando);
    const eqBersaglio = telAltAzAEquatoriale(hor.alt, hor.az, quando);
    if (eqTubo && eqBersaglio) {
      let dHA = eqTubo.ra - eqBersaglio.ra;
      while (dHA > 12) dHA -= 24;
      while (dHA < -12) dHA += 24;
      guida.dHA = dHA;
      guida.dDec = eqBersaglio.dec - eqTubo.dec;
      guida.versoRA = dHA > 0 ? 'Ovest' : 'Est';
      guida.versoDec = guida.dDec > 0 ? 'Nord' : 'Sud';
    }
  } else {
    guida.dAlt = hor.alt - tubo.alt;
    let dAz = hor.az - tubo.az;
    while (dAz > 180) dAz -= 360;
    while (dAz < -180) dAz += 360;
    guida.dAz = dAz;
  }

  return guida;
}

// Da altezza/azimut a coordinate equatoriali: è l'inverso di quello che
// fa Astronomy.Horizon, e serve per sapere a che punto del cielo sta
// guardando il tubo.
function telAltAzAEquatoriale(alt, az, data) {
  const l = luogoCorrente();
  if (!l) return null;
  const fi = l.lat * TEL_D2R;
  const a = alt * TEL_D2R, A = az * TEL_D2R;

  const senoDec = Math.sin(a) * Math.sin(fi) + Math.cos(a) * Math.cos(fi) * Math.cos(A);
  const dec = Math.asin(Math.max(-1, Math.min(1, senoDec)));

  const y = -Math.sin(A) * Math.cos(a);
  const x = Math.sin(a) * Math.cos(fi) - Math.cos(a) * Math.sin(fi) * Math.cos(A);
  const ha = Math.atan2(y, x) * TEL_R2D / 15;    // angolo orario in ore

  const lst = telTempoSiderale(data || new Date(), l);
  if (lst == null) return null;

  return { ra: ((lst - ha) % 24 + 24) % 24, dec: dec * TEL_R2D, ha };
}

function telSalvaSessione() {
  try {
    localStorage.setItem(CHIAVE_TEL_SESSIONE, JSON.stringify({
      riferimento: tel.riferimento,
      misure: tel.deriva.misure,
      // A che punto è l'allineamento. Serve perché in giardino l'app si
      // chiude e si riapre dieci volte, e ricominciare dal passo 1 ogni
      // volta sarebbe la cosa più irritante possibile.
      passo: tel.passo,
      fatti: tel.fatti,
      metodo: tel.metodo,
      quando: Date.now()
    }));
  } catch (e) { /* storage pieno: la sessione vale finché l'app è aperta */ }
}

function telCaricaSessione() {
  try {
    const d = JSON.parse(localStorage.getItem(CHIAVE_TEL_SESSIONE) || 'null');
    if (!d) return;
    // Un riferimento di ieri sera non vale più niente: la montatura è
    // stata smontata e rimessa, e i cerchi sono ripartiti da capo.
    if (d.riferimento && Date.now() - d.riferimento.quando < 14 * 3600 * 1000) {
      tel.riferimento = d.riferimento;
    }
    // Lo stesso vale per l'allineamento: quello di ieri non c'è più.
    const fresca = d.quando && Date.now() - d.quando < 14 * 3600 * 1000;
    if (fresca) {
      if (isFinite(d.passo)) tel.passo = d.passo | 0;
      if (Array.isArray(d.fatti)) tel.fatti = d.fatti.filter(x => typeof x === 'string');
    }
    // Il metodo di puntamento invece è una preferenza, non un dato della
    // serata: quello si tiene.
    if (['pushto', 'cerchi', 'salti'].indexOf(d.metodo) >= 0) tel.metodo = d.metodo;
  } catch (e) { /* dato corrotto */ }
}

// =====================================================================
// 4. LA SERATA
//
//    Una lista di oggetti visibili non è un programma. Un programma
//    tiene conto che il Sole tramonta a una certa ora, che lo specchio
//    ha bisogno di mezz'ora per mettersi alla temperatura dell'aria, che
//    la Luna sta per sorgere e cancellerà il deep sky, e che verso l'una
//    l'umidità appanna il secondario e la serata finisce lì, che tu sia
//    d'accordo o no.
// =====================================================================

// Il punto di rugiada, dalla formula di Magnus. I dati (temperatura e
// umidità ora per ora) l'app li scarica già per il meteo: qui servono
// per sapere a che ora comincerà ad appannarsi lo specchio.
function telPuntoRugiada(tempC, umiditaPerc) {
  if (!isFinite(tempC) || !isFinite(umiditaPerc) || umiditaPerc <= 0) return null;
  const a = 17.625, b = 243.04;
  const gamma = Math.log(umiditaPerc / 100) + (a * tempC) / (b + tempC);
  return (b * gamma) / (a - gamma);
}

// Quando la temperatura dell'aria arriva al punto di rugiada, tutto
// quello che sta all'aperto e si è raffreddato si copre di condensa: per
// un Newton vuol dire lo specchio secondario, che sta in cima al tubo,
// esposto al cielo. È la fine della serata, se non si è preparati.
function telPrevisioneRugiada(buio) {
  if (typeof meteo === 'undefined' || !meteo || !Array.isArray(meteo.ore) || !buio) return null;
  const inizio = (buio.tramonto || new Date()).getTime();
  const fine = (buio.alba || new Date(inizio + 10 * 3600000)).getTime();

  const ore = meteo.ore.filter(o => o.ms >= inizio - 3600000 && o.ms <= fine + 3600000);
  if (!ore.length) return null;

  let primaCritica = null, minimoScarto = Infinity;
  ore.forEach(o => {
    const td = telPuntoRugiada(o.temp, o.umidita);
    if (td == null) return;
    const scarto = o.temp - td;
    if (scarto < minimoScarto) minimoScarto = scarto;
    if (scarto <= 2 && !primaCritica) primaCritica = { quando: new Date(o.ms), temp: o.temp, td, scarto };
  });

  return {
    quando: primaCritica ? primaCritica.quando : null,
    scartoMinimo: isFinite(minimoScarto) ? minimoScarto : null,
    rischio: minimoScarto <= 2 ? 'alto' : (minimoScarto <= 4 ? 'medio' : 'basso')
  };
}

// Quanto tempo prima portare fuori il telescopio. Uno specchio caldo
// crea correnti d'aria dentro al tubo, e quelle correnti fanno tremolare
// l'immagine esattamente come farebbe un cattivo seeing: si crede di
// avere un telescopio scarso, e invece è solo tiepido.
function telTempoRaffreddamento(profilo) {
  const p = profilo || telProfilo();
  if (p.tipo === 'rifrattore') return Math.round(5 + p.apertura / 20);
  return Math.round(10 + p.apertura / 6);
}

// Quando un oggetto passa in meridiano, cioè quando è più alto che
// possa essere. Succede quando il tempo siderale locale raggiunge la sua
// ascensione retta — e siccome il giorno siderale è quasi quattro minuti
// più corto di quello solare, le ore siderali di attesa vanno convertite
// prima di sommarle all'orologio.
const TEL_ORA_SIDERALE_IN_SOLARE = 0.9972696;

function telProssimoTransito(ra, data, luogo) {
  const lst = telTempoSiderale(data, luogo);
  if (lst == null) return null;
  let attesa = ra - lst;
  while (attesa < 0) attesa += 24;
  while (attesa >= 24) attesa -= 24;
  return new Date(data.getTime() + attesa * TEL_ORA_SIDERALE_IN_SOLARE * 3600000);
}

// Il momento in cui vale la pena puntarlo, dentro la notte disponibile.
//
// Prendere il campione più alto fra quelli provati non basta: per gli
// oggetti che culminano fuori dalla finestra di buio tutti i campioni
// cadono sullo stesso estremo, e la scaletta si accartoccia in due o tre
// orari uguali invece di distribuirsi sulla notte. Qui si parte dal
// transito vero e lo si riporta dentro la finestra.
function telMomentoOttimale(ra, dec, buio, obs) {
  const inizio = buio.buioInizio || buio.tramonto;
  const fine = buio.buioFine || buio.alba;
  if (!inizio || !fine) return null;

  const transito = telProssimoTransito(ra, inizio, luogoCorrente());
  if (!transito) return null;

  // Il transito utile può essere anche quello del giorno prima: se
  // l'oggetto ha culminato poco prima del tramonto sta calando, e il suo
  // momento migliore è l'inizio della finestra, non il transito di domani.
  const precedente = new Date(transito.getTime() - 23.9344699 * 3600000);
  const candidati = [transito, precedente];

  let quando = null;
  for (const t of candidati) {
    if (t >= inizio && t <= fine) { quando = t; break; }
  }
  if (!quando) {
    // Nessun transito dentro la finestra: l'oggetto è al suo meglio
    // all'estremo più vicino al transito.
    const distInizio = Math.min(...candidati.map(t => Math.abs(t - inizio)));
    const distFine = Math.min(...candidati.map(t => Math.abs(t - fine)));
    quando = distInizio <= distFine ? inizio : fine;
  }

  const pos = altAzCoordinate(ra, dec, quando, obs);
  return { quando, alt: pos.alt, az: pos.az, inTransito: quando === transito || quando === precedente };
}

// La scaletta della serata: cosa guardare, in che ordine, con quale
// oculare. L'ordine non è per bellezza ma per il cielo: prima quello che
// tramonta, poi quello che sale.
function telCostruisciScaletta(data) {
  const obs = osservatoreCorrente();
  if (!obs) return null;
  const quando = data || new Date();
  const buio = finestraBuio(quando);
  if (!buio) return null;

  const p = telProfilo();
  const oggetti = telOggettiPuntabili(quando).filter(o => o.gruppo !== 'stelle');

  // Dov'è la Luna stanotte: un oggetto debole a pochi gradi da una Luna
  // quasi piena semplicemente non si vede, per quanto sia alto.
  let luna = null, faseLuna = null;
  try {
    const t = Astronomy.MakeTime(buio.buioInizio || buio.tramonto || quando);
    const equ = Astronomy.Equator('Moon', t, obs, true, true);
    luna = { ra: equ.ra, dec: equ.dec };
    faseLuna = Astronomy.Illumination('Moon', t).phase_fraction;
  } catch (e) { /* senza Luna il conto si fa lo stesso */ }

  const voci = [];
  oggetti.forEach(o => {
    let migliore = telMomentoOttimale(o.ra, o.dec, buio, obs);
    if (!migliore) return;

    // Le posizioni arrivano calcolate per adesso, ma Luna e pianeti si
    // spostano fra le stelle mentre la notte passa — la Luna di mezzo
    // grado all'ora. Una seconda passata, con le coordinate dell'ora
    // trovata, rimette a posto il transito.
    if (o.gruppo === 'pianeti') {
      try {
        const equ = Astronomy.Equator(o.id, Astronomy.MakeTime(migliore.quando), obs, true, true);
        const raffinato = telMomentoOttimale(equ.ra, equ.dec, buio, obs);
        if (raffinato) { migliore = raffinato; o.ra = equ.ra; o.dec = equ.dec; }
      } catch (e) { /* si tiene la prima stima */ }
    }

    if (migliore.alt < 12) return;

    const separazioneLuna = luna ? telSeparazioneEq(o.ra, o.dec, luna.ra, luna.dec) : null;
    const combinazione = telCombinazionePer(o.dim, p, o);

    // Il disturbo della Luna cresce con la fase e cala con la distanza,
    // ma non si annulla mai finché la Luna è sopra l'orizzonte: una Luna
    // piena illumina tutta l'atmosfera, non solo il pezzo di cielo che le
    // sta attorno, e il deep sky si spegne dappertutto.
    let disturbo = 0;
    if (separazioneLuna != null && faseLuna != null && o.gruppo === 'profondo') {
      const lunaSuOrizzonte = altAzCoordinate(luna.ra, luna.dec, migliore.quando, obs).alt > 0;
      if (lunaSuOrizzonte) {
        const vicinanza = Math.max(0, 1 - separazioneLuna / 90);
        disturbo = faseLuna * (0.35 + 0.65 * vicinanza);
      }
    }

    voci.push({
      oggetto: o,
      quando: migliore.quando,
      alt: migliore.alt,
      az: migliore.az,
      separazioneLuna,
      disturbo,
      combinazione: combinazione.scelta,
      entra: combinazione.entra,
      // Il punteggio serve solo a scegliere cosa lasciare fuori quando
      // gli oggetti sono troppi: altezza buona, poco disturbo, alla
      // portata dello strumento.
      punteggio: migliore.alt / 90 * 2 - disturbo * 1.5 + (o.allaPortata ? 0.5 : -1)
    });
  });

  // Per ora, e a parità d'ora il più alto per primo: quando due oggetti
  // sono legati allo stesso estremo della finestra, conviene cominciare
  // da quello messo meglio.
  voci.sort((a, b) => (a.quando - b.quando) || (b.alt - a.alt));

  const rugiada = telPrevisioneRugiada(buio);
  const raffreddamento = telTempoRaffreddamento(p);
  const uscita = buio.tramonto ? new Date(buio.tramonto.getTime() - raffreddamento * 60000) : null;

  return {
    buio, voci, rugiada, raffreddamento, uscita,
    faseLuna,
    combinazioni: telCombinazioni(p)
  };
}

// =====================================================================
// 5. MANUTENZIONE: COLLIMAZIONE E TEST STELLARE
//
//    Un Newton f/5 è veloce, e i telescopi veloci sono severi: mezzo
//    millimetro di specchio storto e le stelle diventano cometine. È il
//    motivo per cui tanti telescopi economici vengono giudicati scarsi
//    quando invece sono solo scollimati.
// =====================================================================

const TEL_PASSI_COLLIMAZIONE = [
  {
    titolo: 'Guarda dentro il focheggiatore',
    testo: 'Di giorno, senza oculare, togli il tappo e guarda nel tubo del focheggiatore tenendo l\'occhio centrato. Devi vedere: lo specchio secondario (l\'ovale), il primario riflesso dentro di lui, e i tre ganci del primario.',
    controllo: 'Il secondario appare tondo e centrato nel tubo del focheggiatore?'
  },
  {
    titolo: 'Centra il secondario sotto il focheggiatore',
    testo: 'Se l\'ovale è spostato, agisci sulla vite centrale del ragno (quella che allunga o accorcia il sostegno) e sulla rotazione del secondario. Non toccare ancora le tre viti piccole: quelle servono al passo dopo.',
    controllo: 'L\'ovale è al centro e mostra tutto il primario?'
  },
  {
    titolo: 'Inclina il secondario per vedere tutto il primario',
    testo: 'Con le tre viti piccole del secondario, inclinalo finché il riflesso del primario è centrato nell\'ovale e si vedono tutti e tre i ganci, uguali.',
    controllo: 'I tre ganci del primario si vedono tutti, alla stessa distanza dal bordo?'
  },
  {
    titolo: 'Regola il primario',
    testo: 'Dietro al tubo ci sono tre viti di regolazione (spesso con tre di bloccaggio). Allenta i bloccaggi, poi ruota le viti di regolazione poco per volta finché il puntino centrale del primario finisce al centro di tutto. Un ottavo di giro alla volta.',
    controllo: 'Il puntino centrale è al centro del riflesso?'
  },
  {
    titolo: 'Verifica sulla stella',
    testo: 'Di notte punta una stella luminosa a 100× o più, e sfocala di poco. Devi vedere un disco di anelli concentrici, con il buco centrale (l\'ombra del secondario) esattamente in mezzo. Se il buco è spostato da una parte, la collimazione è ancora fuori da quella parte.',
    controllo: 'Gli anelli sono concentrici?'
  }
];

// Le figure del test stellare: come appare una stella sfocata quando la
// collimazione è buona e quando non lo è. Sono disegnate, non
// fotografate, perché quello che conta è la simmetria e in una foto si
// perde nel rumore.
const TEL_FIGURE_TEST = [
  { id: 'ok', nome: 'Collimazione buona', scarto: 0,
    testo: 'Anelli concentrici, buco centrale in mezzo. Va bene così: non toccare più niente.' },
  { id: 'poco', nome: 'Leggermente scollimato', scarto: 0.25,
    testo: 'Il buco è spostato di poco. Si vede solo sfocando: a fuoco l\'immagine è ancora buona. Correggibile con un ottavo di giro.' },
  { id: 'molto', nome: 'Scollimato', scarto: 0.55,
    testo: 'Il buco è chiaramente da una parte. A fuoco le stelle hanno una codina: qui il telescopio rende molto meno di quello che potrebbe.' }
];

// =====================================================================
// 6. COSA VEDRÒ DAVVERO
//
//    La delusione più comune di chi compra il primo telescopio è
//    l'incontro fra la foto di M31 vista su internet e la macchia grigia
//    vista all'oculare. Non è colpa del telescopio: è che nessuno gli ha
//    mai fatto vedere prima com'è fatta davvero l'osservazione visuale.
//
//    Questo pannello disegna l'oggetto come lo mostra *questa* apertura,
//    con *questo* oculare, sotto *questo* cielo. Comprese due cose che
//    le app di solito nascondono: l'immagine capovolta del Newton, e il
//    fatto che l'occhio, al buio, i colori non li vede.
// =====================================================================

// Quanto contrasto resta a un oggetto esteso: dipende da quanta luce
// raccoglie l'apertura e da quanto è luminoso il fondo cielo. È il
// numero che spiega perché lo stesso oggetto, in città, sparisce.
function telContrastoOggetto(oggetto, combinazione, profilo) {
  const p = profilo || telProfilo();
  const cielo = TEL_CIELI.find(c => c.id === p.cielo) || TEL_CIELI[1];

  if (!oggetto.aspetto || !oggetto.aspetto.sb) {
    // Pianeti e Luna: luminosi, il fondo cielo non c'entra
    return { visibilita: 1, facile: true };
  }

  // Brillanza superficiale dell'oggetto contro quella del cielo: più
  // sono vicine, meno l'oggetto stacca. La scala è in magnitudini per
  // secondo d'arco quadrato, dove numeri più alti = più scuro.
  const sbCielo = 21.8 - (6.5 - cielo.magLimite) * 1.3;
  const stacco = sbCielo - oggetto.aspetto.sb;

  // L'ingrandimento aiuta: allarga l'oggetto e scurisce il fondo allo
  // stesso modo, ma l'occhio vede meglio le macchie grandi.
  const bonus = combinazione ? Math.min(0.6, Math.log2(Math.max(1, combinazione.ingrandimento / 30)) * 0.25) : 0;

  const visibilita = Math.max(0, Math.min(1, (stacco + bonus + 0.8) / 2.5));
  return {
    visibilita,
    stacco,
    facile: visibilita > 0.55,
    difficile: visibilita < 0.25,
    cielo
  };
}

// Il verdetto in una riga: è la cosa che si legge davvero, prima di
// decidere se uscire a cercarlo.
function telVerdettoOggetto(oggetto, combinazione, profilo) {
  const p = profilo || telProfilo();
  const contrasto = telContrastoOggetto(oggetto, combinazione, p);
  const limite = telMagnitudineLimite(p);

  if (oggetto.mag != null && oggetto.mag > limite + 0.5) {
    return { esito: 'no', testo: `Troppo debole per ${p.apertura} mm sotto il tuo cielo: resterebbe invisibile.` };
  }
  if (oggetto.gruppo === 'pianeti') {
    return { esito: 'si', testo: 'I pianeti non temono l\'inquinamento luminoso: si vedono anche dal balcone di città.' };
  }
  if (contrasto.difficile) {
    return { esito: 'forse', testo: 'Al limite: serve occhio adattato al buio (venti minuti veri) e sguardo distolto.' };
  }
  if (contrasto.facile) {
    return { esito: 'si', testo: 'Alla portata: si trova senza fatica e regge l\'ingrandimento.' };
  }
  return { esito: 'forse', testo: 'Visibile ma non appariscente: cerca la macchia, non l\'immagine.' };
}

// =====================================================================
// 7. I DISEGNI
//    Quattro tele, tutte con lo stesso mestiere: mostrare un pezzo di
//    cielo alla scala giusta. La scala giusta la dà lo strumento.
// =====================================================================

function telPreparaTela(canvas) {
  if (!canvas) return null;
  const dpr = window.devicePixelRatio || 1;
  const l = canvas.clientWidth || 300;
  const h = canvas.clientHeight || 260;
  canvas.width = Math.round(l * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, l, h);
  return { ctx, l, h };
}

// --- L'orologio della Polare -------------------------------------------
// Il polo al centro, la Polare sul suo cerchietto, nella posizione che
// ha adesso. Disegnato come lo si vede a occhio guardando verso Nord:
// il cannocchiale polare, se lo si monta, capovolge tutto, e sta scritto
// sotto al disegno.
function telDisegnaOrologioPolare(canvas, dati) {
  const tela = telPreparaTela(canvas);
  if (!tela || !dati) return;
  const { ctx, l, h } = tela;
  const cx = l / 2, cy = h / 2;
  // Il raggio lascia fuori due corone: una per le ore del quadrante e una
  // per le scritte di orientamento, che se no si accavallano.
  const R = Math.min(l, h) / 2 - 44;

  // Il cerchio su cui gira la Polare attorno al polo
  ctx.strokeStyle = 'rgba(148,163,184,0.45)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Le ore del quadrante, come su un reticolo polare
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(148,163,184,0.75)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let ora = 0; ora < 24; ora += 3) {
    const a = ora * 15 * TEL_D2R;
    const x = cx - Math.sin(a) * (R + 13);
    const y = cy - Math.cos(a) * (R + 13);
    // L'ora che cade dove sta la Polare non si scrive: finirebbe sotto il
    // pallino, e fra le due cose quella che conta è il pallino.
    let scarto = Math.abs(((ora * 15 - dati.angolo) % 360 + 540) % 360 - 180);
    if (scarto > 20) ctx.fillText(`${ora}h`, x, y);
    ctx.beginPath();
    ctx.moveTo(cx - Math.sin(a) * (R - 4), cy - Math.cos(a) * (R - 4));
    ctx.lineTo(cx - Math.sin(a) * (R + 4), cy - Math.cos(a) * (R + 4));
    ctx.strokeStyle = 'rgba(148,163,184,0.5)';
    ctx.stroke();
  }

  // Croce del polo: è il punto in cui deve finire l'asse della montatura
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
  ctx.stroke();

  // La Polare, dove sta adesso. L'angolo si misura da sopra il polo, in
  // senso antiorario: guardando a Nord il cielo gira in quel verso.
  const a = dati.angolo * TEL_D2R;
  const px = cx - Math.sin(a) * R;
  const py = cy - Math.cos(a) * R;

  // La scritta del polo va dalla parte opposta alla Polare, se no la
  // freccia le passa sopra proprio nel punto che deve indicare.
  const sotto = py < cy;
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText('POLO', cx, cy + (sotto ? 22 : -30));
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(56,189,248,0.75)';
  ctx.fillText('qui va il centro', cx, cy + (sotto ? 34 : -18));

  // La freccia dalla Polare al polo: è il movimento da fare, e detta così
  // non c'è più bisogno di tradurre "in alto a sinistra" nella testa.
  const ux = (cx - px) / R, uy = (cy - py) / R;
  const daX = px + ux * 16, daY = py + uy * 16;
  const aX = cx - ux * 16, aY = cy - uy * 16;
  ctx.strokeStyle = 'rgba(56,189,248,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(daX, daY);
  ctx.lineTo(aX, aY);
  ctx.stroke();
  // Punta della freccia
  const ang = Math.atan2(aY - daY, aX - daX);
  ctx.fillStyle = 'rgba(56,189,248,0.85)';
  ctx.beginPath();
  ctx.moveTo(aX, aY);
  ctx.lineTo(aX - 8 * Math.cos(ang - 0.4), aY - 8 * Math.sin(ang - 0.4));
  ctx.lineTo(aX - 8 * Math.cos(ang + 0.4), aY - 8 * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();

  // La misura dello spostamento, scritta di fianco alla freccia
  ctx.save();
  ctx.translate((daX + aX) / 2, (daY + aY) / 2);
  ctx.rotate(Math.abs(ang) > Math.PI / 2 ? ang + Math.PI : ang);
  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${dati.distanzaMin.toFixed(0)}′`, 0, -4);
  ctx.restore();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#fde68a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(253,230,138,0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(px, py, 11, 0, Math.PI * 2);
  ctx.stroke();

  // Il nome va per forza verso l'esterno: dalla parte del centro c'è la
  // freccia, e sopra il pallino non ci sta.
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 11px system-ui, sans-serif';
  // Di fianco serve più spazio che sopra: la scritta è larga e bassa.
  const stacco = 22 + 16 * Math.abs(ux);
  ctx.fillText('Polare', px - ux * stacco, py - uy * stacco);

  // La direzione dello zenit, per orientarsi: guardando a Nord, l'alto
  // dello schermo è l'alto del cielo.
  ctx.fillStyle = 'rgba(148,163,184,0.6)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('↑ ZENIT', cx, 10);
  ctx.fillText('ORIZZONTE ↓', cx, h - 6);
  ctx.textAlign = 'left';
  ctx.fillText('OVEST', 4, cy - 8);
  ctx.textAlign = 'right';
  ctx.fillText('EST', l - 4, cy - 8);
}

// --- La bussola ---------------------------------------------------------
//
// Una rosa dei venti che gira, con l'indice fermo in alto: è il
// funzionamento di una bussola vera, e si legge senza pensarci. Il
// settore verde è la tolleranza: quando l'indice ci sta dentro, l'asse
// guarda al Nord vero abbastanza bene da non doverci tornare.
function telDisegnaBussola(canvas, dati) {
  const tela = telPreparaTela(canvas);
  if (!tela) return;
  const { ctx, l, h } = tela;
  const cx = l / 2, cy = h / 2 + 4;
  // La rosa è un cerchio: la misura che comanda è la più piccola delle due,
  // meno il posto per l'indice e per le lettere dei venti.
  const R = Math.min(l, h) / 2 - 26;
  if (R <= 10) return;

  // Senza lettura non si disegna un numero finto: si disegna la rosa
  // spenta, che si vede subito che non sta funzionando.
  const az = dati && isFinite(dati.az) ? dati.az : null;
  const bersaglio = dati && isFinite(dati.bersaglio) ? dati.bersaglio : 0;
  const scarto = az != null ? telScartoAzimut(az, bersaglio) : null;
  const buono = scarto && scarto.modulo <= TEL_TOLLERANZA_NORD;

  // Dove finisce sullo schermo un azimut, con la rosa ruotata perché la
  // lettura corrente stia sotto l'indice in alto
  const angolo = a => (a - (az || 0)) * TEL_D2R;
  const punto = (a, raggio) => [cx + Math.sin(angolo(a)) * raggio, cy - Math.cos(angolo(a)) * raggio];

  // Il settore di tolleranza attorno al bersaglio
  if (az != null) {
    const da = angolo(bersaglio - TEL_TOLLERANZA_NORD) - Math.PI / 2;
    const a = angolo(bersaglio + TEL_TOLLERANZA_NORD) - Math.PI / 2;
    ctx.fillStyle = buono ? 'rgba(34,197,94,0.35)' : 'rgba(34,197,94,0.16)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, da, a);
    ctx.closePath();
    ctx.fill();
  }

  // La corona
  ctx.strokeStyle = buono ? 'rgba(34,197,94,0.9)' : 'rgba(148,163,184,0.55)';
  ctx.lineWidth = buono ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  // Tacche ogni 15°, più marcate ai punti cardinali
  ctx.lineWidth = 1;
  for (let a = 0; a < 360; a += 15) {
    const cardinale = a % 90 === 0;
    const [x1, y1] = punto(a, R - (cardinale ? 10 : 5));
    const [x2, y2] = punto(a, R);
    ctx.strokeStyle = cardinale ? 'rgba(226,232,240,0.8)' : 'rgba(148,163,184,0.45)';
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Le lettere dei venti. Il Nord è di un altro colore: è l'unico che
  // interessa, gli altri servono solo a capire da che parte si sta
  // girando.
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [['N', 0], ['E', 90], ['S', 180], ['O', 270]].forEach(([lettera, a]) => {
    const [x, y] = punto(a, R - 22);
    ctx.fillStyle = lettera === 'N' ? '#f87171' : 'rgba(148,163,184,0.85)';
    ctx.fillText(lettera, x, y);
  });

  // L'indice fermo in alto: quello che si legge è quello che sta qui
  ctx.fillStyle = buono ? '#22c55e' : '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(cx, cy - R + 2);
  ctx.lineTo(cx - 7, cy - R - 11);
  ctx.lineTo(cx + 7, cy - R - 11);
  ctx.closePath();
  ctx.fill();

  // Il numero al centro, e sotto quanto e da che parte girare
  if (az != null) {
    ctx.fillStyle = buono ? '#4ade80' : '#ffffff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(`${Math.round(az)}°`, cx, cy - 6);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = buono ? 'rgba(74,222,128,0.9)' : 'rgba(226,232,240,0.85)';
    ctx.fillText(buono
      ? 'ci sei: non toccare più il treppiede'
      : `gira ${scarto.modulo.toFixed(0)}° verso ${scarto.verso}`, cx, cy + 20);
  } else {
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('bussola spenta', cx, cy);
  }

  // La freccia che indica dove sta il bersaglio, se è lontano dall'indice
  if (az != null && !buono) {
    const [bx, by] = punto(bersaglio, R - 34);
    ctx.fillStyle = 'rgba(34,197,94,0.95)';
    const a = angolo(bersaglio);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(-6, 5);
    ctx.lineTo(6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// --- La bolla -----------------------------------------------------------
//
// Una livella a bolla sferica, come quella che si avvita sui treppiedi
// buoni: la bolla scappa dalla parte in cui il treppiede è alto, quindi
// la gamba da accorciare è quella dove la bolla è andata.
function telDisegnaBolla(canvas, dati) {
  const tela = telPreparaTela(canvas);
  if (!tela) return;
  const { ctx, l, h } = tela;
  const cx = l / 2, cy = h / 2;
  const R = Math.min(l, h) / 2 - 16;
  if (R <= 10) return;

  // Fondo scala: 4°. Oltre non serve saperlo, serve solo saperlo tanto.
  const scala = 4;
  const fuori = dati ? Math.hypot(dati.inclinazione, dati.sbandamento) : null;
  const buono = fuori != null && fuori <= TEL_TOLLERANZA_BOLLA;

  ctx.fillStyle = 'rgba(15,23,42,0.9)';
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // I due cerchi di riferimento: dentro il piccolo è in piano, dentro il
  // grande è accettabile.
  [[TEL_TOLLERANZA_BOLLA, buono ? 'rgba(34,197,94,0.9)' : 'rgba(34,197,94,0.5)'],
   [2, 'rgba(148,163,184,0.4)'],
   [scala, 'rgba(148,163,184,0.55)']].forEach(([gradi, colore]) => {
    ctx.strokeStyle = colore;
    ctx.lineWidth = gradi === TEL_TOLLERANZA_BOLLA ? 2 : 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R * gradi / scala, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.strokeStyle = 'rgba(148,163,184,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
  ctx.stroke();

  if (fuori == null) {
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('sensori spenti', cx, cy);
    return;
  }

  // La bolla, come in una livella vera, scappa verso il lato alto: quello
  // dove è andata è il lato da abbassare, cioè la gamba da accorciare.
  const raggio = g => Math.max(-1, Math.min(1, g / scala)) * R;
  const bx = cx + raggio(dati.sbandamento);
  const by = cy - raggio(dati.inclinazione);
  ctx.fillStyle = buono ? 'rgba(74,222,128,0.9)' : 'rgba(251,191,36,0.9)';
  ctx.beginPath();
  ctx.arc(bx, by, Math.max(9, R * 0.16), 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = buono ? '#4ade80' : '#fbbf24';
  ctx.fillText(buono ? 'in piano' : `${fuori.toFixed(1)}° fuori piano`, cx, h - 10);
}

// --- Il goniometro ------------------------------------------------------
//
// Un quarto di cerchio con la lancetta sull'inclinazione letta adesso e
// una tacca verde sul valore da raggiungere. Serve per la scala della
// latitudine, che sulle montature economiche è stampata male e sbaglia
// anche di due gradi, e per controllare l'altezza del tubo.
function telDisegnaInclinometro(canvas, dati) {
  const tela = telPreparaTela(canvas);
  if (!tela) return;
  const { ctx, l, h } = tela;
  const cx = 22, cy = h - 22;
  const R = Math.min(l - 44, h - 44);
  if (R <= 20) return;

  const angolo = dati && isFinite(dati.angolo) ? dati.angolo : null;
  const bersaglio = dati && isFinite(dati.bersaglio) ? dati.bersaglio : null;
  const scarto = (angolo != null && bersaglio != null) ? angolo - bersaglio : null;
  const buono = scarto != null && Math.abs(scarto) <= TEL_TOLLERANZA_GRADI;

  // L'arco da 0 a 90°, con le tacche ogni 10
  ctx.strokeStyle = 'rgba(148,163,184,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2, 0);
  ctx.stroke();

  ctx.font = '9px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(148,163,184,0.75)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let g = 0; g <= 90; g += 10) {
    const a = g * TEL_D2R;
    const x1 = cx + Math.cos(a) * (R - 6), y1 = cy - Math.sin(a) * (R - 6);
    const x2 = cx + Math.cos(a) * R, y2 = cy - Math.sin(a) * R;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
    if (g % 30 === 0) ctx.fillText(`${g}°`, cx + Math.cos(a) * (R + 6), cy - Math.sin(a) * (R + 6));
  }

  // Il bersaglio: una linea verde e la sua etichetta
  if (bersaglio != null) {
    const a = Math.max(0, Math.min(90, bersaglio)) * TEL_D2R;
    ctx.strokeStyle = 'rgba(34,197,94,0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R, cy - Math.sin(a) * R);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // La lancetta: è il telefono visto di fianco, appoggiato sull'asse
  if (angolo != null) {
    const a = Math.max(-5, Math.min(95, angolo)) * TEL_D2R;
    ctx.strokeStyle = buono ? '#4ade80' : '#fbbf24';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * (R - 12), cy - Math.sin(a) * (R - 12));
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // Il numero grande, in alto a destra dove l'arco lascia spazio
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  if (angolo != null) {
    ctx.fillStyle = buono ? '#4ade80' : '#ffffff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(`${angolo.toFixed(1)}°`, l - 6, 4);
    if (bersaglio != null) {
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = buono ? 'rgba(74,222,128,0.9)' : 'rgba(226,232,240,0.85)';
      ctx.fillText(buono
        ? 'ci sei'
        : `${Math.abs(scarto).toFixed(1)}° ${scarto > 0 ? 'di troppo: abbassa' : 'in meno: alza'}`, l - 6, 34);
      ctx.fillStyle = 'rgba(34,197,94,0.8)';
      ctx.fillText(`bersaglio ${bersaglio.toFixed(1)}°`, l - 6, 50);
    }
  } else {
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('sensori spenti', l - 6, 6);
  }
}

// --- Il radar del push-to -----------------------------------------------
//
// Al centro c'è dove guarda il tubo adesso, e il pallino è il bersaglio:
// si spinge il telescopio finché il pallino non arriva al centro. La
// scala è vera — i cerchi del cercatore e dell'oculare sono grandi
// esattamente quanto il cielo che inquadrano — così quando il pallino
// entra nel cerchio verde l'oggetto è nell'oculare per davvero, non per
// metafora.
//
// La proiezione è azimutale equidistante: sul disegno un grado è un
// grado in tutte le direzioni, che è l'unica cosa che serve a un radar.
function telDisegnaRadar(canvas, guida, opzioni) {
  const tela = telPreparaTela(canvas);
  if (!tela) return;
  const { ctx, l, h } = tela;
  const o = opzioni || {};
  const cx = l / 2, cy = h / 2;
  const R = Math.min(l, h) / 2 - 16;
  if (R <= 20) return;

  if (!guida) {
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('in attesa dei sensori', cx, cy);
    return;
  }

  const cercatore = o.campoCercatore || 0;
  const oculare = o.campoOculare || 0;
  // Fondo scala: tiene dentro il bersaglio con un margine, ma non si
  // stringe mai tanto da far sparire il cerchio del cercatore, che è il
  // riferimento con cui si giudica "quanto manca".
  const scala = Math.min(90, Math.max(guida.separazione * 1.45, cercatore * 0.8, oculare * 2, 0.4));
  const raggio = gradi => Math.min(R, gradi / scala * R);
  const centrato = oculare ? guida.separazione < oculare / 2 : guida.separazione < 0.4;

  // La corona del fondo scala, con la sua misura scritta
  ctx.strokeStyle = 'rgba(148,163,184,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  // Un cerchio intermedio "tondo" (1°, 2°, 5°, 10°…) per avere il senso
  // della distanza senza contare i pixel
  const passi = [0.25, 0.5, 1, 2, 5, 10, 20, 45];
  const intermedio = passi.filter(g => g < scala * 0.85).pop();
  if (intermedio) {
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, raggio(intermedio), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.65)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(intermedio < 1 ? `${(intermedio * 60).toFixed(0)}′` : `${intermedio}°`,
      cx, cy - raggio(intermedio) - 2);
  }

  // Gli assi della montatura: le due direzioni lungo cui si muovono le
  // manopole, con il nome in punta
  (guida.assi || []).forEach(asse => {
    const dx = Math.sin(asse.angolo), dy = -Math.cos(asse.angolo);
    ctx.strokeStyle = asse.colore + '55';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(cx - dx * R, cy - dy * R);
    ctx.lineTo(cx + dx * R, cy + dy * R);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.fillStyle = asse.colore + 'cc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(asse.nome, cx + dx * (R - 10), cy + dy * (R - 10));
  });

  // Il campo del cercatore, in azzurro, e quello dell'oculare, in verde:
  // sono i due traguardi della manovra.
  if (cercatore && cercatore / 2 < scala) {
    ctx.strokeStyle = 'rgba(56,189,248,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, raggio(cercatore / 2), 0, Math.PI * 2);
    ctx.stroke();
  }
  if (oculare && oculare / 2 < scala) {
    ctx.strokeStyle = centrato ? 'rgba(74,222,128,0.95)' : 'rgba(34,197,94,0.6)';
    ctx.lineWidth = centrato ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(4, raggio(oculare / 2)), 0, Math.PI * 2);
    ctx.stroke();
  }

  // La crocetta del centro: è dove guarda il tubo
  ctx.strokeStyle = 'rgba(226,232,240,0.9)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
  ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
  ctx.stroke();

  // Il bersaglio. Se cade fuori dal fondo scala si appoggia sul bordo con
  // una freccia: meglio un verso giusto e una distanza tagliata che un
  // pallino invisibile.
  const px = cx + guida.dx / scala * R;
  const py = cy - guida.dy / scala * R;
  const distanza = Math.hypot(px - cx, py - cy);
  const fuori = distanza > R - 6;
  const fx = fuori ? cx + (px - cx) / distanza * (R - 6) : px;
  const fy = fuori ? cy + (py - cy) / distanza * (R - 6) : py;

  const colore = centrato ? '#4ade80' : (guida.dentroCercatore ? '#fbbf24' : '#f472b6');
  if (!centrato) {
    // La linea dal centro al bersaglio: dice il verso a colpo d'occhio,
    // che è quel che serve quando si ha un occhio nel cercatore.
    ctx.strokeStyle = colore + '99';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(fx, fy);
    ctx.stroke();
  }

  if (fuori) {
    const ang = Math.atan2(fy - cy, fx - cx);
    ctx.fillStyle = colore;
    ctx.beginPath();
    ctx.moveTo(fx + Math.cos(ang) * 8, fy + Math.sin(ang) * 8);
    ctx.lineTo(fx - Math.cos(ang - 0.5) * 9, fy - Math.sin(ang - 0.5) * 9);
    ctx.lineTo(fx - Math.cos(ang + 0.5) * 9, fy - Math.sin(ang + 0.5) * 9);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = colore;
    ctx.beginPath();
    ctx.arc(fx, fy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colore + '55';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(fx, fy, 11, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (o.nome) {
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillStyle = colore;
    ctx.textAlign = 'center';
    ctx.textBaseline = fy < cy ? 'top' : 'bottom';
    ctx.fillText(o.nome, Math.max(30, Math.min(l - 30, fx)), fy + (fy < cy ? 16 : -16));
  }

  // Fondo scala e legenda, in basso
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(148,163,184,0.7)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`raggio ${scala < 1 ? (scala * 60).toFixed(0) + '′' : scala.toFixed(scala < 10 ? 1 : 0) + '°'}`, 4, h - 4);
  ctx.textAlign = 'right';
  ctx.fillText('↑ zenit', l - 4, h - 4);
}

// --- Carta del cielo per i salti di stella -----------------------------
//
// Proiezione stereografica centrata sul punto che interessa: per campi
// di pochi gradi è indistinguibile dalla realtà, e non deforma i
// cerchietti del cercatore come farebbe una proiezione qualsiasi.
function telProiettaCampo(ra, dec, centro, scala, rotazione) {
  const d0 = centro.dec * TEL_D2R, d = dec * TEL_D2R;
  const dra = (ra - centro.ra) * 15 * TEL_D2R;
  const k = 2 / (1 + Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(dra));
  // x verso Est, y verso Nord (in gradi)
  let x = k * Math.cos(d) * Math.sin(dra) * TEL_R2D;
  let y = k * (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(dra)) * TEL_R2D;

  // In cielo l'Est sta a sinistra quando il Nord è in alto: è la
  // convenzione di tutte le carte astronomiche, e stona sempre la prima
  // volta che la si incontra.
  x = -x;

  if (rotazione) {
    const r = rotazione * TEL_D2R;
    const cx = x * Math.cos(r) - y * Math.sin(r);
    const cy = x * Math.sin(r) + y * Math.cos(r);
    x = cx; y = cy;
  }
  return { x: x * scala, y: -y * scala };
}

// Raggio del pallino di una stella secondo la sua luminosità
function telRaggioStella(mag) {
  return Math.max(1, 5.4 - mag * 0.62);
}

// Disegna un pezzo di cielo attorno a un centro, con i cerchi del
// cercatore e dell'oculare in scala. `rotazione` a 180 mostra il campo
// come lo rovescia un Newton.
function telDisegnaCampoCielo(canvas, opzioni) {
  const tela = telPreparaTela(canvas);
  if (!tela) return;
  const { ctx, l, h } = tela;
  const o = opzioni || {};
  const centro = o.centro;
  if (!centro) return;

  const campo = o.campo || 12;                       // lato in gradi
  const scala = Math.min(l, h) / campo;              // pixel per grado
  const cx = l / 2, cy = h / 2;
  const rot = o.rotazione || 0;

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, l, h);

  const punto = (ra, dec) => {
    const p = telProiettaCampo(ra, dec, centro, scala, rot);
    return { x: cx + p.x, y: cy + p.y };
  };

  // Cerchio del cercatore e cerchio dell'oculare: la ragione per cui la
  // carta è utile è che questi due cerchi sono in scala vera.
  //
  // Il cercatore va centrato sulla stella di partenza e l'oculare sul
  // bersaglio, perché è lì che stanno davvero nei due momenti del lavoro:
  // centrarli sul mezzo della carta li renderebbe due decorazioni.
  if (o.campoCercatore) {
    const c = o.partenza ? punto(o.partenza.ra, o.partenza.dec) : { x: cx, y: cy };
    ctx.strokeStyle = 'rgba(56,189,248,0.55)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, o.campoCercatore / 2 * scala, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(56,189,248,0.8)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('cercatore', c.x, c.y - o.campoCercatore / 2 * scala - 6);
  }
  if (o.campoOculare) {
    const c = o.bersaglio ? punto(o.bersaglio.ra, o.bersaglio.dec) : { x: cx, y: cy };
    ctx.strokeStyle = 'rgba(74,222,128,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, o.campoOculare / 2 * scala, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Le linee delle costellazioni fanno da impalcatura: senza, un campo
  // di stelle non dice niente a nessuno.
  if (typeof SKY_COSTELLAZIONI !== 'undefined') {
    ctx.strokeStyle = 'rgba(96,165,250,0.28)';
    ctx.lineWidth = 1;
    SKY_COSTELLAZIONI.forEach(c => {
      c.linee.forEach(([i, j]) => {
        const a = c.stelle[i], b = c.stelle[j];
        if (!a || !b) return;
        if (telSeparazioneEq(centro.ra, centro.dec, a[0], a[1]) > campo &&
            telSeparazioneEq(centro.ra, centro.dec, b[0], b[1]) > campo) return;
        const pa = punto(a[0], a[1]), pb = punto(b[0], b[1]);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      });
    });
  }

  // Le stelle
  ctx.textAlign = 'left';
  ctx.font = '10px system-ui, sans-serif';
  telStelle().forEach(s => {
    if (telSeparazioneEq(centro.ra, centro.dec, s.ra, s.dec) > campo * 0.75) return;
    const p = punto(s.ra, s.dec);
    if (p.x < -20 || p.x > l + 20 || p.y < -20 || p.y > h + 20) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, telRaggioStella(s.mag), 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    if (s.mag < 2.6) {
      ctx.fillStyle = 'rgba(226,232,240,0.75)';
      ctx.fillText(s.nome, p.x + 7, p.y + 3);
    }
  });

  // Il percorso a salti
  if (o.salti && o.salti.length && o.partenza) {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 4]);
    let prec = punto(o.partenza.ra, o.partenza.dec);
    o.salti.forEach(s => {
      const p = punto(s.ra != null ? s.ra : o.bersaglio.ra, s.dec != null ? s.dec : o.bersaglio.dec);
      ctx.beginPath();
      ctx.moveTo(prec.x, prec.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      prec = p;
    });
    ctx.setLineDash([]);

    const pp = punto(o.partenza.ra, o.partenza.dec);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    // L'etichetta va dalla parte opposta al bersaglio, se no le due si
    // accavallano proprio nel punto che interessa guardare.
    const pb = o.bersaglio ? punto(o.bersaglio.ra, o.bersaglio.dec) : { x: pp.x, y: pp.y - 1 };
    ctx.fillText('PARTI DA QUI', pp.x, pp.y + (pb.y > pp.y ? -16 : 22));
    ctx.textAlign = 'left';
  }

  // Il bersaglio
  if (o.bersaglio) {
    const p = punto(o.bersaglio.ra, o.bersaglio.dec);
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x - 18, p.y); ctx.lineTo(p.x - 13, p.y);
    ctx.moveTo(p.x + 13, p.y); ctx.lineTo(p.x + 18, p.y);
    ctx.moveTo(p.x, p.y - 18); ctx.lineTo(p.x, p.y - 13);
    ctx.moveTo(p.x, p.y + 13); ctx.lineTo(p.x, p.y + 18);
    ctx.stroke();
    ctx.fillStyle = '#f9a8d4';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    // Solo la sigla: il nome per esteso, su un campo di pochi gradi,
    // copre metà delle stelle che servono a orientarsi.
    ctx.fillText(o.bersaglio.nome.split(' — ')[0], p.x, p.y - 20);
    ctx.textAlign = 'left';
  }

  // La rosa dei venti celeste, che con la rotazione del Newton cambia
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(148,163,184,0.8)';
  ctx.textAlign = 'center';
  const versi = [
    { nome: 'N', dx: 0, dy: -1 }, { nome: 'S', dx: 0, dy: 1 },
    { nome: 'E', dx: -1, dy: 0 }, { nome: 'O', dx: 1, dy: 0 }
  ];
  const r = rot * TEL_D2R;
  versi.forEach(v => {
    const x = v.dx * Math.cos(r) - (-v.dy) * Math.sin(r);
    const y = -(v.dx * Math.sin(r) + (-v.dy) * Math.cos(r));
    ctx.fillText(v.nome, cx + x * (Math.min(l, h) / 2 - 12), cy + y * (Math.min(l, h) / 2 - 12) + 3);
  });
}

// --- L'oculare: cosa vedrò davvero -------------------------------------
//
// Il disegno più importante di tutto il file, e quello con meno codice
// astronomico dentro: qui non si tratta di calcolare, si tratta di non
// mentire. Nessun colore saturo, nessun braccio di spirale, nessuna
// nebulosa rosa. Quello che l'occhio vede al buio è grigio.
function telDisegnaOculare(canvas, oggetto, combinazione, opzioni) {
  const tela = telPreparaTela(canvas);
  if (!tela) return;
  const { ctx, l, h } = tela;
  const o = opzioni || {};
  const p = telProfilo();

  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, 0, l, h);
  if (!oggetto || !combinazione) return;

  const cx = l / 2, cy = h / 2;
  const R = Math.min(l, h) / 2 - 10;
  const campoMin = combinazione.campoRealeMin;         // primi d'arco
  const scala = (2 * R) / campoMin;                    // pixel per primo d'arco

  // Il cerchio dell'oculare, con il nero del fondo cielo dentro
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  const cielo = TEL_CIELI.find(c => c.id === p.cielo) || TEL_CIELI[1];
  // Il fondo cielo non è nero: in periferia è grigio-marrone, e più è
  // chiaro meno stacca quello che ci sta sopra.
  const grigio = Math.round(Math.max(2, (6.8 - cielo.magLimite) * 9));
  ctx.fillStyle = `rgb(${grigio + 2}, ${grigio + 2}, ${grigio + 5})`;
  ctx.fillRect(0, 0, l, h);

  // Stelle di campo: quante ne entrano dipende dall'apertura e dal cielo
  const seme = Math.abs(Math.round(oggetto.ra * 1000)) || 7;
  let rnd = seme;
  const casuale = () => {
    rnd = (rnd * 1103515245 + 12345) & 0x7fffffff;
    return rnd / 0x7fffffff;
  };
  const quante = Math.round(12 + telMagnitudineLimite(p) * 6 * (campoMin / 60));
  for (let i = 0; i < quante; i++) {
    const ang = casuale() * Math.PI * 2;
    const rr = Math.sqrt(casuale()) * R;
    const luce = casuale();
    const raggio = 0.5 + luce * luce * 1.8;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, raggio, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(226,232,240,${0.35 + luce * 0.6})`;
    ctx.fill();
  }

  const rotazione = o.rotazione != null ? o.rotazione : (TEL_TIPI[p.tipo] || TEL_TIPI.newton).rotazione;

  if (oggetto.gruppo === 'pianeti') {
    telDisegnaPianetaOculare(ctx, cx, cy, oggetto, scala, rotazione);
  } else {
    telDisegnaProfondoOculare(ctx, cx, cy, oggetto, combinazione, scala, p);
  }

  ctx.restore();

  // Il bordo dell'oculare
  ctx.strokeStyle = 'rgba(148,163,184,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  // Un pianeta occupa una frazione minima del campo, e disegnato in scala
  // vera diventa un punto: sembrerebbe di non vedere niente, mentre a
  // 160× la fase di Venere e le bande di Giove si riconoscono benissimo.
  // Il riquadro ingrandito dice la stessa verità senza mentire per difetto.
  if (oggetto.dim && oggetto.dim * scala < Math.min(l, h) / 9) {
    telDisegnaDettaglio(ctx, l, h, oggetto, combinazione, p, o);
  }

  // I dati del campo, sotto
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(148,163,184,0.9)';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.round(combinazione.ingrandimento)}× · campo ${telAngoloTesto(combinazione.campoReale)}`, 8, h - 8);
  if (rotazione === 180) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(251,191,36,0.9)';
    ctx.fillText('immagine capovolta', l - 8, h - 8);
  }
}

// Il riquadro del dettaglio: lo stesso oggetto, disegnato più grande, con
// scritto di quanto. Serve per gli oggetti piccoli, dove la scala vera
// del campo non lascia vedere quello che l'occhio invece distingue.
function telDisegnaDettaglio(ctx, l, h, oggetto, combinazione, profilo, opzioni) {
  const lato = Math.min(l, h) / 2.9;
  const x = l - lato - 8, y = h - lato - 26;
  const cx = x + lato / 2, cy = y + lato / 2;

  // Ingrandimento del riquadro: quanto basta perché l'oggetto ne occupi
  // circa metà, arrotondato a un numero che si legge bene.
  const scalaVera = (2 * (Math.min(l, h) / 2 - 10)) / combinazione.campoRealeMin;
  const voluta = (lato * 0.5) / oggetto.dim;
  const fattore = Math.max(2, Math.round(voluta / scalaVera));
  const scala = scalaVera * fattore;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, lato / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(5,7,12,0.92)';
  ctx.fillRect(x, y, lato, lato);

  const rotazione = opzioni && opzioni.rotazione != null
    ? opzioni.rotazione
    : (TEL_TIPI[profilo.tipo] || TEL_TIPI.newton).rotazione;

  if (oggetto.gruppo === 'pianeti') telDisegnaPianetaOculare(ctx, cx, cy, oggetto, scala, rotazione);
  else telDisegnaProfondoOculare(ctx, cx, cy, oggetto, combinazione, scala, profilo);
  ctx.restore();

  ctx.strokeStyle = 'rgba(148,163,184,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, lato / 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(148,163,184,0.85)';
  ctx.textAlign = 'center';
  ctx.fillText(`dettaglio ${fattore}×`, cx, y + lato + 13);
}

// I pianeti: dischetti piccoli, luminosi, con quel poco di dettaglio che
// un'apertura media mostra davvero.
function telDisegnaPianetaOculare(ctx, cx, cy, oggetto, scala, rotazione) {
  const raggio = Math.max(2, (oggetto.dim || 0.5) / 2 * scala);
  const capovolto = rotazione === 180;

  if (oggetto.id === 'Saturn') {
    // L'anello: l'unica cosa che si riconosce a colpo d'occhio
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((capovolto ? 180 : 0) * TEL_D2R + 0.25);
    ctx.scale(1, 0.42);
    ctx.strokeStyle = 'rgba(253,230,138,0.85)';
    ctx.lineWidth = Math.max(1.5, raggio * 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, raggio * 2.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, raggio, 0, Math.PI * 2);
  ctx.fillStyle = oggetto.colore || '#fcd34d';
  ctx.fill();

  if (oggetto.id === 'Jupiter') {
    // Le due bande equatoriali, e le lune in fila
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, raggio, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(180,120,80,0.55)';
    ctx.fillRect(cx - raggio, cy - raggio * 0.45, raggio * 2, raggio * 0.3);
    ctx.fillRect(cx - raggio, cy + raggio * 0.2, raggio * 2, raggio * 0.28);
    ctx.restore();

    const distanze = [2.6, 4.1, 6.5, 11.5];
    distanze.forEach((d, i) => {
      const x = cx + (i % 2 === 0 ? 1 : -1) * raggio * d * (capovolto ? -1 : 1);
      ctx.beginPath();
      ctx.arc(x, cy + (i - 1.5) * 1.5, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
    });
  }

  if (oggetto.id === 'Moon') {
    // Il terminatore, che è dove si guarda davvero
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, raggio, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.beginPath();
    ctx.ellipse(cx + raggio * (capovolto ? -0.45 : 0.45), cy, raggio * 0.85, raggio, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Il deep sky: macchie. Grigie, sfumate, senza bordi. Con il nucleo più
// denso, perché è l'unica struttura che si vede davvero.
function telDisegnaProfondoOculare(ctx, cx, cy, oggetto, combinazione, scala, profilo) {
  const asp = oggetto.aspetto;
  const contrasto = telContrastoOggetto(oggetto, combinazione, profilo);
  const dim = (oggetto.dim || 10) * scala;            // diametro in pixel
  const raggio = Math.max(3, dim / 2);
  const forza = Math.max(0.06, Math.min(0.72, contrasto.visibilita));

  const tipo = asp ? asp.tipo : 'nebulosa';

  if (tipo === 'ammasso' || tipo === 'globulare') {
    // Gli ammassi si risolvono in stelle: sopra un certo ingrandimento
    // il globulare comincia a "granulare" ai bordi, ed è la cosa più
    // bella che faccia.
    const risolve = combinazione.ingrandimento > 80 && profilo.apertura >= 100;
    if (tipo === 'globulare') {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, raggio);
      g.addColorStop(0, `rgba(226,232,240,${forza * 0.95})`);
      g.addColorStop(0.4, `rgba(203,213,225,${forza * 0.5})`);
      g.addColorStop(1, 'rgba(203,213,225,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, raggio, 0, Math.PI * 2);
      ctx.fill();
    }
    let rnd = Math.round(oggetto.dec * 977) || 13;
    const casuale = () => { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd / 0x7fffffff; };
    const quante = tipo === 'globulare' ? (risolve ? 90 : 25) : 45;
    for (let i = 0; i < quante; i++) {
      const ang = casuale() * Math.PI * 2;
      const rr = (tipo === 'globulare' ? Math.pow(casuale(), 0.45) : Math.sqrt(casuale())) * raggio;
      const luce = 0.35 + casuale() * 0.65;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, tipo === 'globulare' ? 0.8 : 1.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(241,245,249,${luce * (tipo === 'globulare' ? forza + 0.25 : 0.9)})`;
      ctx.fill();
    }
    return;
  }

  if (tipo === 'planetaria' && oggetto.nome.startsWith('M57')) {
    // L'anello di M57: piccolo ma con il buco al centro, e si vede
    const g = ctx.createRadialGradient(cx, cy, raggio * 0.35, cx, cy, raggio);
    g.addColorStop(0, 'rgba(180,200,190,0.05)');
    g.addColorStop(0.55, `rgba(200,220,210,${forza})`);
    g.addColorStop(1, 'rgba(200,220,210,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.25, 1);
    ctx.beginPath();
    ctx.arc(0, 0, raggio, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Galassie e nebulose: un ovale sfumato, con il nucleo più denso.
  const nucleo = asp && asp.nucleo ? (asp.nucleo * scala) / 2 : raggio * 0.3;
  const forma = asp && asp.forma ? asp.forma : (tipo === 'galassia' ? 'fuso' : 'tonda');
  const allunga = forma === 'fuso' ? 2.6 : (forma === 'coppia' ? 1.25 : 1.5);

  // Una macchia sfumata, orientata e allungata quanto serve
  const macchia = (x, y, r, stiramento, rotazione, intensita) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotazione);
    ctx.scale(stiramento, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(226,232,240,${Math.min(0.85, intensita + 0.28)})`);
    g.addColorStop(0.25, `rgba(203,213,225,${intensita * 0.7})`);
    g.addColorStop(0.7, `rgba(190,200,215,${intensita * 0.28})`);
    g.addColorStop(1, 'rgba(190,200,215,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  macchia(cx, cy, raggio / allunga * 1.1, allunga, 0.6, forza);

  // La compagna, per le coppie che entrano nello stesso campo
  if (forma === 'coppia' && asp.compagno) {
    const c = asp.compagno;
    const a = c.angolo * TEL_D2R;
    const d = c.distanza * scala;
    macchia(
      cx + Math.cos(a) * d, cy + Math.sin(a) * d,
      Math.max(2, c.dim * scala / 2) / (c.sottile ? 3 : 1.2),
      c.sottile ? 3 : 1.2, a + Math.PI / 2, forza * 0.85
    );
  }

  // Il Trapezio dentro M42: quattro stelline in quadrato, che è il
  // dettaglio che tutti riconoscono
  if (oggetto.nome.startsWith('M42')) {
    [[-3, -3], [3, -2], [1, 3], [-2, 2]].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(cx + dx * Math.max(1.5, nucleo * 0.25), cy + dy * Math.max(1.5, nucleo * 0.25), 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(248,250,252,0.95)';
      ctx.fill();
    });
  }
}

// --- Il test stellare --------------------------------------------------
// Una stella sfocata: anelli concentrici con al centro l'ombra del
// secondario. Se il buco non è in mezzo, la collimazione è fuori.
function telDisegnaTestStellare(canvas, scarto) {
  const tela = telPreparaTela(canvas);
  if (!tela) return;
  const { ctx, l, h } = tela;
  const cx = l / 2, cy = h / 2;
  const R = Math.min(l, h) / 2 - 8;

  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, l, h);

  const p = telProfilo();
  const ostruzione = p.ostruzione || 0.3;
  const dx = scarto * R * 0.8;

  // Gli anelli di diffrazione
  for (let i = 6; i >= 1; i--) {
    const r = R * (i / 6);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(226,232,240,${0.10 + (i % 2) * 0.30})`;
    ctx.lineWidth = R / 12;
    ctx.stroke();
  }

  // L'ombra del secondario: è lei che si sposta quando è scollimato
  ctx.beginPath();
  ctx.arc(cx + dx, cy, R * ostruzione, 0, Math.PI * 2);
  ctx.fillStyle = '#05070c';
  ctx.fill();
  ctx.strokeStyle = 'rgba(148,163,184,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Le razze del ragno che sostiene il secondario
  ctx.strokeStyle = 'rgba(226,232,240,0.18)';
  ctx.lineWidth = 1.5;
  [0, 90].forEach(a => {
    const r = a * TEL_D2R;
    ctx.beginPath();
    ctx.moveTo(cx + dx - Math.cos(r) * R, cy - Math.sin(r) * R);
    ctx.lineTo(cx + dx + Math.cos(r) * R, cy + Math.sin(r) * R);
    ctx.stroke();
  });
}

// =====================================================================
// 8. LA VISTA E I SUOI PANNELLI
// =====================================================================

const TEL_PANNELLI = [
  { id: 'strumento',   nome: 'Strumento',   sottotitolo: 'Ingrandimenti, campi, cosa arriva' },
  { id: 'allineamento', nome: 'Allineamento', sottotitolo: 'L\'asse al polo, un passo per volta, con livella e bussola' },
  { id: 'punta',       nome: 'Punta',       sottotitolo: 'Push-to col telefono, cerchi graduati, salti di stella' },
  { id: 'serata',      nome: 'Serata',      sottotitolo: 'La scaletta di stanotte' },
  { id: 'cura',        nome: 'Cura',        sottotitolo: 'Collimazione e test stellare' }
];

function telHtmlScheda(titolo, corpo, extra) {
  return `<div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl ${extra || ''}">
    ${titolo ? `<h3 class="text-lg font-bold text-white mb-3">${titolo}</h3>` : ''}
    ${corpo}
  </div>`;
}

function telHtmlSintesi(valore, etichetta, colore) {
  return `<div class="bg-slate-900 rounded-xl border border-slate-700 p-3 text-center">
    <div class="text-xl font-bold ${colore || 'text-white'}">${valore}</div>
    <div class="text-xs text-slate-400 mt-0.5">${etichetta}</div>
  </div>`;
}

function telMostraPannello(id) {
  tel.pannello = id;
  document.querySelectorAll('[data-tel-pannello]').forEach(b => {
    const attivo = b.dataset.telPannello === id;
    b.className = attivo
      ? 'px-3 py-2 rounded-full text-sm font-semibold bg-blue-600 text-white'
      : 'px-3 py-2 rounded-full text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200';
  });
  telCostruisciPannello();
}

function telCostruisciPannello() {
  const box = document.getElementById('telescopio-corpo');
  if (!box) return;

  // I due cicli che leggono i sensori girano solo nel pannello che li usa:
  // fuori da lì sarebbero batteria buttata via al freddo.
  if (tel.pannello !== 'punta') telFermaTubo();
  if (tel.pannello !== 'allineamento') telFermaSensori();

  switch (tel.pannello) {
    case 'strumento': box.innerHTML = telPannelloStrumento(); telDopoStrumento(); break;
    case 'allineamento': box.innerHTML = telPannelloAllineamento(); telDopoAllineamento(); break;
    case 'punta': box.innerHTML = telPannelloPunta(); telDopoPunta(); break;
    case 'serata': box.innerHTML = telPannelloSerata(); telDopoSerata(); break;
    case 'cura': box.innerHTML = telPannelloCura(); telDopoCura(); break;
  }
}

// --- Pannello: STRUMENTO -----------------------------------------------

function telPannelloStrumento() {
  const p = telProfilo();
  const combinazioni = telCombinazioni(p);
  const massimo = telIngrandimentoMassimo(p);
  const minimo = telIngrandimentoMinimo(p);
  const tipo = TEL_TIPI[p.tipo] || TEL_TIPI.newton;

  const righe = combinazioni.map(c => {
    let giudizio = '<span class="text-green-400">utile</span>';
    if (c.vuoto) giudizio = '<span class="text-red-400">ingrandimento vuoto</span>';
    else if (c.pupillaLarga) giudizio = '<span class="text-amber-400">luce sprecata</span>';
    else if (c.fiacco) giudizio = '<span class="text-amber-400">poco spinto</span>';
    return `<tr class="${c.vuoto ? 'opacity-60' : ''}">
      <td class="py-2 pr-3 text-slate-200">${c.nome}</td>
      <td class="py-2 pr-3 font-mono text-white">${Math.round(c.ingrandimento)}×</td>
      <td class="py-2 pr-3 font-mono text-slate-300">${telAngoloTesto(c.campoReale)}</td>
      <td class="py-2 pr-3 font-mono text-slate-300">${c.pupilla.toFixed(1)} mm</td>
      <td class="py-2 text-xs">${giudizio}</td>
    </tr>`;
  }).join('');

  const vuoti = combinazioni.filter(c => c.vuoto);

  const tabella = `
    <div class="overflow-x-auto -mx-1 px-1">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="text-xs text-slate-400 border-b border-slate-700">
            <th class="text-left font-semibold py-2 pr-3">Combinazione</th>
            <th class="text-left font-semibold py-2 pr-3">Ingrand.</th>
            <th class="text-left font-semibold py-2 pr-3">Campo</th>
            <th class="text-left font-semibold py-2 pr-3">Pupilla</th>
            <th class="text-left font-semibold py-2">Giudizio</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800">${righe}</tbody>
      </table>
    </div>
    ${vuoti.length ? `<p class="mt-3 text-xs text-amber-300 bg-amber-950/40 border border-amber-900 rounded-xl p-3">
      <strong>${vuoti.map(c => Math.round(c.ingrandimento) + '×').join(' e ')}</strong>:
      oltre il massimo utile di ${massimo}× per ${p.apertura} mm di apertura. L'immagine diventa
      più grande ma non più dettagliata — solo più scura e più molle. È il numero che le scatole
      dei telescopi mettono in copertina e che non si usa mai.</p>` : ''}`;

  const sintesi = `<div class="griglia-sintesi mb-4">
    ${telHtmlSintesi(`f/${(p.focale / p.apertura).toFixed(1)}`, 'rapporto focale')}
    ${telHtmlSintesi(`${massimo}×`, 'ingrand. massimo utile')}
    ${telHtmlSintesi(`${telPotereSeparatore(p).toFixed(2)}″`, 'potere separatore')}
    ${telHtmlSintesi(`mag ${telMagnitudineLimite(p).toFixed(1)}`, 'stella più debole')}
  </div>`;

  const opzioniPreset = TEL_PRESET.map(t =>
    `<option value="${t.id}" ${p.presetId === t.id ? 'selected' : ''}>${t.nome}</option>`).join('') +
    `<option value="custom" ${p.presetId === 'custom' ? 'selected' : ''}>Altro (a mano)</option>`;

  const opzioniCielo = TEL_CIELI.map(c =>
    `<option value="${c.id}" ${p.cielo === c.id ? 'selected' : ''}>${c.nome}</option>`).join('');

  const opzioniCercatore = Object.keys(TEL_CERCATORI).map(k =>
    `<option value="${k}" ${p.cercatore === k ? 'selected' : ''}>${TEL_CERCATORI[k].nome}</option>`).join('');

  const oculari = p.oculari.map((oc, i) => `
    <div class="flex items-center gap-2 bg-slate-900 rounded-xl border border-slate-700 p-2">
      <input type="number" data-tel-oculare="${i}" data-campo="focale" value="${oc.focale}"
        min="2" max="60" step="0.5" class="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-white text-sm">
      <span class="text-xs text-slate-400">mm, campo apparente</span>
      <input type="number" data-tel-oculare="${i}" data-campo="campoApp" value="${oc.campoApp}"
        min="25" max="120" step="1" class="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-white text-sm">
      <span class="text-xs text-slate-400">°</span>
      <button data-tel-rimuovi-oculare="${i}" class="ml-auto text-xs px-2 py-1 rounded-full bg-slate-700 hover:bg-red-600 text-white">Togli</button>
    </div>`).join('');

  return `
    ${telHtmlScheda('Il tuo telescopio', `
      ${sintesi}
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="block text-xs text-slate-400 mb-1">Modello</span>
          <select id="tel-preset" class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">${opzioniPreset}</select>
        </label>
        <label class="block">
          <span class="block text-xs text-slate-400 mb-1">Il cielo di casa tua</span>
          <select id="tel-cielo" class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">${opzioniCielo}</select>
        </label>
        <label class="block">
          <span class="block text-xs text-slate-400 mb-1">Apertura (mm)</span>
          <input id="tel-apertura" type="number" value="${p.apertura}" min="30" max="600" step="1"
            class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
        </label>
        <label class="block">
          <span class="block text-xs text-slate-400 mb-1">Focale (mm)</span>
          <input id="tel-focale" type="number" value="${p.focale}" min="100" max="4000" step="5"
            class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
        </label>
        <label class="block">
          <span class="block text-xs text-slate-400 mb-1">Cercatore</span>
          <select id="tel-cercatore" class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">${opzioniCercatore}</select>
        </label>
        <label class="block">
          <span class="block text-xs text-slate-400 mb-1">Barlow</span>
          <input id="tel-barlow" type="number" value="${p.barlow}" min="1" max="5" step="0.5"
            class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
        </label>
      </div>
      <label class="flex items-center gap-2 mt-3 text-sm text-slate-300">
        <input id="tel-motore" type="checkbox" ${p.motoreAR ? 'checked' : ''} class="accent-blue-500">
        Ho il motore di inseguimento sull'ascensione retta
      </label>
      <p class="text-xs text-slate-500 mt-2">${tipo.nome}${tipo.rotazione === 180
        ? ' — l\'immagine all\'oculare è ruotata di 180°: le carte vanno lette capovolte, e l\'app lo fa per te.'
        : ' — l\'immagine è dritta ma specchiata se usi il diagonale.'}</p>
    `)}

    ${telHtmlScheda('Oculari', `
      <div class="space-y-2">${oculari}</div>
      <button id="tel-aggiungi-oculare" class="mt-3 px-4 py-2 rounded-full text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white">Aggiungi un oculare</button>
      <p class="text-xs text-slate-500 mt-2">Il campo apparente sta scritto sull'oculare o nel manuale: 50° per un Plössl,
        40° per gli oculari semplici in dotazione, 68° e oltre per i grandangolari.</p>
    `)}

    ${telHtmlScheda('Cosa ottieni con quello che hai', tabella)}

    ${telHtmlScheda('Come si leggono questi numeri', `
      <ul class="text-sm text-slate-300 space-y-2">
        <li><strong class="text-white">Ingrandimento</strong> = focale del telescopio ÷ focale dell'oculare.
          Sopra ${massimo}× (il doppio dell'apertura in mm) non arriva più dettaglio; sotto ${minimo}× si butta via luce raccolta.</li>
        <li><strong class="text-white">Campo reale</strong> = campo apparente dell'oculare ÷ ingrandimento.
          È quanto cielo vedi: la Luna è mezzo grado, e serve per sapere se un oggetto ci sta dentro.</li>
        <li><strong class="text-white">Pupilla d'uscita</strong> = apertura ÷ ingrandimento. È il diametro del
          fascio che esce dall'oculare: se supera i 6–7 mm, l'iride ne taglia via un pezzo e quella luce è persa.</li>
        <li><strong class="text-white">Potere separatore</strong>: la distanza minima fra due stelle doppie che
          quest'apertura riesce ancora a dividere.</li>
      </ul>
    `)}`;
}

function telDopoStrumento() {
  const p = telProfilo();

  const aggiorna = (campo, valore) => {
    p[campo] = valore;
    if (campo !== 'cielo' && campo !== 'motoreAR') p.presetId = 'custom';
    telSalvaProfilo();
    telCostruisciPannello();
  };

  const preset = document.getElementById('tel-preset');
  if (preset) preset.addEventListener('change', () => {
    const scelto = TEL_PRESET.find(t => t.id === preset.value);
    if (!scelto) { p.presetId = 'custom'; telSalvaProfilo(); return; }
    Object.assign(p, {
      presetId: scelto.id, nome: scelto.nome, apertura: scelto.apertura, focale: scelto.focale,
      tipo: scelto.tipo, ostruzione: scelto.ostruzione, montatura: scelto.montatura,
      cercatore: scelto.cercatore, barlow: scelto.barlow,
      oculari: scelto.oculari.map(o => Object.assign({}, o))
    });
    telSalvaProfilo();
    telCostruisciPannello();
  });

  const numerico = (id, campo, min, max) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      const v = parseFloat(el.value);
      if (isFinite(v) && v >= min && v <= max) aggiorna(campo, v);
      else telCostruisciPannello();
    });
  };
  numerico('tel-apertura', 'apertura', 30, 600);
  numerico('tel-focale', 'focale', 100, 4000);
  numerico('tel-barlow', 'barlow', 1, 5);

  const cielo = document.getElementById('tel-cielo');
  if (cielo) cielo.addEventListener('change', () => aggiorna('cielo', parseInt(cielo.value, 10)));

  const cercatore = document.getElementById('tel-cercatore');
  if (cercatore) cercatore.addEventListener('change', () => aggiorna('cercatore', cercatore.value));

  const motore = document.getElementById('tel-motore');
  if (motore) motore.addEventListener('change', () => aggiorna('motoreAR', motore.checked));

  document.querySelectorAll('[data-tel-oculare]').forEach(el => {
    el.addEventListener('change', () => {
      const i = parseInt(el.dataset.telOculare, 10);
      const campo = el.dataset.campo;
      const v = parseFloat(el.value);
      if (!p.oculari[i] || !isFinite(v) || v <= 0) { telCostruisciPannello(); return; }
      p.oculari[i][campo] = v;
      if (campo === 'focale') p.oculari[i].nome = `${v} mm`;
      p.presetId = 'custom';
      telSalvaProfilo();
      telCostruisciPannello();
    });
  });

  document.querySelectorAll('[data-tel-rimuovi-oculare]').forEach(el => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.telRimuoviOculare, 10);
      if (p.oculari.length <= 1) return;
      p.oculari.splice(i, 1);
      p.presetId = 'custom';
      telSalvaProfilo();
      telCostruisciPannello();
    });
  });

  const aggiungi = document.getElementById('tel-aggiungi-oculare');
  if (aggiungi) aggiungi.addEventListener('click', () => {
    p.oculari.push({ focale: 10, campoApp: 50, nome: '10 mm' });
    p.oculari.sort((a, b) => b.focale - a.focale);
    p.presetId = 'custom';
    telSalvaProfilo();
    telCostruisciPannello();
  });
}

// --- Pannello: ALLINEAMENTO --------------------------------------------

// L'oculare con cui si misura la deriva: il più spinto fra quelli utili,
// perché più ingrandisce più la deriva si vede presto.
function telOculareDeriva() {
  const utili = telCombinazioni().filter(c => !c.vuoto);
  return utili.length ? utili[utili.length - 1] : null;
}

// I sei passi come dati, non come un blocco di HTML: ognuno si porta
// dietro il suo testo e sa quale strumento del telefono serve mentre lo
// si fa. È questo che permette di mostrarne uno per volta, con la
// bussola o la livella accesa proprio dentro il passo che le usa —
// invece di un elenco da leggere tutto in piedi al buio.
function telPassiAllineamento() {
  const l = luogoCorrente();
  const p = telProfilo();
  const orologio = telOrologioPolare();
  const declinazione = telDeclinazioneMagnetica();
  const bussolaMagnetica = telBussolaNordVero();
  const polare = telPolareAltAz();
  const cercatore = TEL_CERCATORI[p.cercatore] || TEL_CERCATORI.reddot;

  // Il cercatore ottico capovolge l'immagine: la stessa istruzione detta
  // "in alto a sinistra" a occhio diventa "in basso a destra" dentro il
  // cercatore. Sbagliare questo verso raddoppia l'errore invece di
  // azzerarlo, ed è il motivo per cui tanti allineamenti peggiorano.
  const versoNelCercatore = orologio
    ? (cercatore.dritta ? orologio.versoPolo : orologio.versoSecco)
    : '';

  return [
    {
      id: 'piano',
      breve: 'In piano',
      titolo: 'Treppiede in piano, gamba «N» verso Nord.',
      corpo: `Allarga le gambe alla stessa altezza e blocca. Se la testa parte storta la scala della latitudine
        misura da un piano sbagliato, e tutto il resto è tempo perso: un grado di treppiede è un grado di
        errore sull'asse, e non c'è passo successivo che lo recuperi.`,
      strumento: 'bolla',
      invito: `Appoggia il telefono <strong class="text-white">in piano sulla testa della montatura</strong>
        (o sul vassoio portaoculari, se è solidale al treppiede), schermo in su.`,
      nota: `Il guscio del telefono non è mai perfettamente piatto: quando la bolla è dentro, giralo di 90° e
        guarda se ci resta. Se salta fuori, la verità sta a metà fra le due letture.`
    },
    {
      id: 'latitudine',
      breve: 'Latitudine',
      titolo: `Scala della latitudine su ${l.lat.toFixed(1)}°.`,
      corpo: `È il settore graduato sul fianco della testa, con l'indice che scorre sui gradi. Si muove allentando
        la vite di elevazione (sulla EQ3 sono due, una davanti e una dietro: allenti una e stringi l'altra).
        Poi ristringi tutt'e due.`,
      strumento: 'inclinometro',
      bersaglio: l.lat,
      invito: `Appoggia il telefono <strong class="text-white">di lungo contro il fianco dell'asse polare</strong>
        — il cilindro che sta sotto le manopole — col lato alto verso il cielo. Il telefono si mette parallelo
        all'asse, e quello che legge è l'altezza dell'asse.`,
      nota: `Fidati di questo numero più che della scala stampata: sulle montature economiche il settore graduato
        sbaglia anche di due gradi, e nessuno lo controlla mai.`
    },
    {
      id: 'nord',
      breve: 'Nord',
      titolo: 'Gira tutto il treppiede verso il Nord vero.',
      corpo: `Ruoti il treppiede <em>intero</em>, non la montatura sul treppiede. Il numero che conta è il Nord
        <strong class="text-white">vero</strong>, non quello della bussola: qui distano
        ${Math.abs(declinazione).toFixed(1)}°, perché il Nord magnetico sta
        ${declinazione > 0 ? 'a Est' : 'a Ovest'} di quello vero. La bussola qui sotto la correzione la fa già;
        se usi una bussola vera, o un'altra app, devi farla tu e leggere
        <strong class="text-white">${Math.round(bussolaMagnetica)}°</strong> invece di 0°.`,
      strumento: 'bussola',
      bersaglio: 0,
      invito: `Tieni il telefono <strong class="text-white">in piano, col lato alto in linea con l'asse polare</strong>,
        e ruota il treppiede finché l'indice entra nel verde.`,
      nota: `Tienilo almeno a un braccio dal tubo: un Newton è un cilindro d'acciaio e la bussola se la porta
        dove vuole lui. Se il numero balla, il magnetometro è disturbato o da tarare — sotto ci sono due
        modi di trovare il Nord che non usano la bussola.`
    },
    {
      id: 'dec90',
      breve: 'Dec +90°',
      titolo: 'Metti la declinazione a +90° e il contrappeso in basso.',
      corpo: `<span class="text-amber-300">È il passo che manca su tutti i manuali, ed è quello che fa fallire
        l'allineamento.</span> Con la declinazione a +90° il tubo diventa parallelo all'asse polare: da quel
        momento <strong class="text-white">quello che vedi nel cercatore è esattamente dove guarda l'asse</strong>,
        e puoi allinearlo guardando invece di indovinare. Se il cerchio di declinazione non è tarato, mettilo a
        occhio: il tubo dev'essere parallelo al corpo dell'asse polare. Poi blocca le due manopole.`,
      strumento: 'inclinometro',
      bersaglio: l.lat,
      invito: `Appoggia il telefono <strong class="text-white">sul tubo, di lungo</strong>: se la declinazione è
        davvero a +90° e i passi 2 e 3 sono a posto, il tubo è alto quanto la tua latitudine.`,
      nota: `Se questo numero non torna con quello del passo 2, la declinazione non è a +90°: il cerchio è
        sfasato, e va rifatto a occhio guardando il parallelismo fra tubo e asse.`
    },
    {
      id: 'polare',
      breve: 'Polare',
      titolo: 'Trova la Polare nel cercatore.',
      corpo: `Adesso è alta <strong class="text-white">${polare ? polare.alt.toFixed(1) : l.lat.toFixed(1)}°</strong>
        sull'orizzonte, esattamente a Nord. Se non la vedi, muovi <em>solo</em> la vite di elevazione e il
        treppiede finché non entra nel campo del ${cercatore.nome.toLowerCase()} (${cercatore.campo}° di cielo).
        Per riconoscerla: prendi le due stelle di fondo del Grande Carro, tira la linea che le unisce e
        prolungala cinque volte.`,
      strumento: 'inclinometro',
      bersaglio: polare ? polare.alt : l.lat,
      invito: `Non la trovi? Appoggia il telefono sul tubo: se legge molto meno o molto più di
        ${polare ? polare.alt.toFixed(1) : l.lat.toFixed(1)}°, stai guardando il pezzo di cielo sbagliato.`,
      nota: `Da qui in avanti le manopole di ascensione retta e declinazione restano ferme: se le muovi, sposti
        il tubo e non l'asse, e l'asse è l'unica cosa che stai allineando.`
    },
    {
      id: 'scarto',
      breve: 'Scarto',
      titolo: orologio
        ? `Sposta il centro di ${orologio.distanzaMin.toFixed(0)}′ ${versoNelCercatore}.`
        : 'Scosta il centro di mezzo grado dalla Polare.',
      corpo: orologio
        ? `La Polare non va messa al centro: al centro ci va il polo, che adesso sta
           <strong class="text-amber-300">${versoNelCercatore}</strong> rispetto a lei${cercatore.dritta ? '' : ' <em>(verso già ribaltato per il tuo cercatore ottico)</em>'}.
           Quanto? ${orologio.distanzaMin.toFixed(0)}′, cioè ${orologio.lune.toFixed(1)} Lune piene in fila.
           Salta questo passo e ti resta mezzo grado di errore: per guardare va bene, per fotografare no.`
        : `La Polare gira attorno al polo a circa 38′ di distanza, e al centro va messo il polo, non lei.
           In che direzione dipende dall'ora, e il calcolo in questo momento non è disponibile.`,
      strumento: 'quadrante',
      facoltativo: true,
      nota: `Questo è l'unico passo che si può saltare senza rimpianti se stasera si guarda e basta.`
    }
  ];
}

// La barra dei passi: dove sei, cosa hai già fatto, e si può tornare
// indietro toccando un pallino. Piccola, perché sta sopra al passo vero.
function telHtmlProgresso(passi) {
  return `<div class="flex items-center gap-1.5 flex-wrap mb-4">
    ${passi.map((s, i) => {
      const fatto = tel.fatti.indexOf(s.id) >= 0;
      const attivo = i === tel.passo;
      const classe = attivo
        ? 'bg-blue-600 text-white ring-2 ring-blue-400'
        : (fatto ? 'bg-green-700 text-white' : 'bg-slate-700 text-slate-400');
      return `<button data-tel-vai-passo="${i}" title="${s.breve}"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${classe}">
        <span>${fatto && !attivo ? '✓' : i + 1}</span>
        <span class="${attivo ? '' : 'hidden sm:inline'}">${s.breve}</span>
      </button>`;
    }).join('')}
  </div>`;
}

// Lo strumento del telefono che serve al passo corrente. È lo stesso
// schema per tutti e tre: una tela che si ridisegna dieci volte al
// secondo, una riga di lettura scritta, e il testo di come tenere il
// telefono. Se i sensori sono spenti, al loro posto c'è il tasto per
// accenderli — mai un numero finto.
function telHtmlStrumento(passo) {
  if (!passo.strumento) return '';

  // Il quadrante polare non è un sensore: è un disegno del cielo, e vive
  // anche senza permessi.
  if (passo.strumento === 'quadrante') {
    return `<canvas id="tel-tela-polare-passo" class="block w-full rounded-xl border border-slate-700 bg-slate-950 mt-3" style="height:260px"></canvas>
      <p class="text-xs text-slate-400 mt-2">Come si vede <strong>a occhio nudo guardando a Nord</strong>:
      la croce azzurra è il polo, il punto giallo la Polare. Il disegno si aggiorna da solo, perché la Polare
      gira di 15° all'ora.</p>`;
  }

  const nomi = { bolla: 'livella a bolla', inclinometro: 'goniometro', bussola: 'bussola' };
  const stato = telStatoSensori();

  if (!stato.attivi) {
    return `<div class="mt-3 bg-slate-900 rounded-xl border border-blue-800 p-4">
      <p class="text-sm text-slate-300">${passo.invito}</p>
      ${stato.possibile
        ? `<button id="tel-accendi-sensori" class="mt-3 px-4 py-2 rounded-full text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white">
             Usa il telefono come ${nomi[passo.strumento]}</button>
           <p class="text-xs text-slate-500 mt-2">Servono i sensori di movimento. Non escono dal telefono: il
             calcolo è tutto qui dentro.</p>`
        : `<p class="text-xs text-amber-300 mt-2">Questo dispositivo non espone i sensori di movimento: lo
             strumento va usato quello vero.</p>`}
    </div>`;
  }

  const tele = {
    bolla: `<canvas id="tel-tela-bolla" class="block w-full rounded-xl border border-slate-700 bg-slate-950" style="height:220px"></canvas>`,
    inclinometro: `<canvas id="tel-tela-goniometro" data-bersaglio="${passo.bersaglio != null ? passo.bersaglio.toFixed(3) : ''}"
      class="block w-full rounded-xl border border-slate-700 bg-slate-950" style="height:200px"></canvas>`,
    bussola: `<canvas id="tel-tela-bussola" data-bersaglio="${passo.bersaglio != null ? passo.bersaglio.toFixed(3) : '0'}"
      class="block w-full rounded-xl border border-slate-700 bg-slate-950" style="height:290px"></canvas>`
  };

  return `<div class="mt-3 bg-slate-900 rounded-xl border border-slate-700 p-4">
    <p class="text-sm text-slate-300 mb-3">${passo.invito}</p>
    ${tele[passo.strumento]}
    <div id="tel-lettura-sensori" class="mt-2 text-xs text-slate-400">Attendo i sensori…</div>
    ${passo.strumento === 'bussola' ? telHtmlAlternativeNord() : ''}
  </div>`;
}

// Quando la bussola non è affidabile — e con un tubo d'acciaio a mezzo
// metro capita spesso — il Nord si trova in altri due modi, tutti e due
// più precisi del magnetometro. Stanno qui, chiusi, per non spaventare
// chi non ne ha bisogno.
function telHtmlAlternativeNord() {
  const ombra = telNordDallOmbra();
  const stato = telStatoSensori();

  const avviso = !stato.bussolaVera
    ? `<p class="text-xs text-amber-300 bg-amber-950/40 border border-amber-900 rounded-xl p-3 mb-2">
        Questo telefono sta dando un orientamento <strong>relativo</strong>: l'azimut parte da dove stava il
        telefono quando i sensori si sono accesi, e come bussola non vale niente. Usa uno dei due modi qui
        sotto, oppure taralo a mano nella vista Cielo su una stella che riconosci.</p>`
    : '';

  return `${avviso}
    <details class="mt-3 text-sm">
      <summary class="cursor-pointer text-blue-400 hover:text-blue-300 text-xs">Trovare il Nord senza bussola (due modi)</summary>
      <div class="mt-2 space-y-3 text-xs text-slate-300">
        ${ombra
          ? `<p><strong class="text-white">Con l'ombra, adesso.</strong> Il Sole è alto ${ombra.altSole.toFixed(0)}°
              a azimut ${Math.round(ombra.azSole)}°: l'ombra di un'asta verticale — un bastone, il treppiede
              chiuso — punta a <strong class="text-amber-300">${Math.round(ombra.azOmbra)}°</strong>. Il Nord vero
              sta ${ombra.scarto.modulo < 1 ? 'praticamente sulla linea dell\'ombra' :
              `a <strong class="text-white">${ombra.scarto.modulo.toFixed(0)}°</strong> in senso
              ${ombra.scarto.senso} rispetto all'ombra`}. Nessun magnetometro, nessuna declinazione: è geometria.</p>`
          : `<p><strong class="text-white">Con l'ombra.</strong> Di giorno l'ombra di un'asta verticale dà il Nord
              al mezzo grado, e l'app calcola l'angolo esatto. Adesso non si può: il Sole è troppo basso o non
              c'è. Riprova quando è fra 5° e 75° di altezza.</p>`}
        <p><strong class="text-white">Con la Polare.</strong> Di notte è il modo definitivo, e in fondo è quello
          che stai facendo: la Polare <em>è</em> il Nord, a mezzo grado. Metti la latitudine (passo 2), la
          declinazione a +90° (passo 4) e ruota il treppiede finché non entra nel cercatore. La bussola serve
          solo a farti arrivare vicino.</p>
        <p><button id="tel-vai-cielo" class="underline text-blue-400 hover:text-blue-300">Apri la realtà aumentata</button>:
          nella vista Cielo compare un mirino sul polo celeste, e lì la bussola si può correggere a mano
          trascinando finché le stelle sullo schermo coincidono con quelle vere.</p>
      </div>
    </details>`;
}

function telPannelloAllineamento() {
  const l = luogoCorrente();
  const p = telProfilo();

  if (!l) {
    return telHtmlScheda('Serve la posizione', `
      <p class="text-sm text-slate-300">L'allineamento polare è tutto un discorso di latitudine e di Nord vero:
      senza sapere dove sei, non c'è niente da calcolare.</p>
      <button id="tel-chiedi-posizione" class="mt-3 px-4 py-2 rounded-full text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white">Dimmi dove sono</button>
      <p class="text-xs text-slate-500 mt-2">Provo il GPS, poi la connessione; se non rispondono puoi scegliere la citt&agrave; in elenco.</p>`);
  }

  if (l.lat <= 0) {
    return telHtmlScheda('Emisfero australe', `
      <p class="text-sm text-slate-300">Da qui il polo celeste è quello Sud, e la Polare non si vede.
      L'allineamento si fa sulla Croce del Sud e sull'ottante: la parte di deriva qui sotto funziona lo stesso,
      ma l'orologio della Polare no.</p>`);
  }

  const orologio = telOrologioPolare();
  const declinazione = telDeclinazioneMagnetica();
  const bussola = telBussolaNordVero();
  const oculare = telOculareDeriva();
  const polare = telPolareAltAz();
  const cercatore = TEL_CERCATORI[p.cercatore] || TEL_CERCATORI.reddot;

  const versoNelCercatore = orologio
    ? (cercatore.dritta ? orologio.versoPolo : orologio.versoSecco)
    : '';

  const larga = telCombinazioni(p).find(c => !c.vuoto);
  const autonomiaSenzaQuadrante = orologio ? telAutonomiaInseguimento(orologio.distanzaMin, larga) : null;

  // --- La riga sola che riassume tutto ---------------------------------
  const inSintesi = telHtmlScheda('In due righe', `
    <p class="text-sm text-slate-300">Devi far guardare <strong class="text-white">l'asse della montatura</strong>
    (non il tubo) verso il polo celeste: un punto esatto a Nord, alto quanto la tua latitudine.
    La Polare è lì vicino ma <em>non</em> è quel punto: gli gira attorno a mezzo grado.</p>
    <div class="griglia-sintesi mt-3">
      ${telHtmlSintesi(`${l.lat.toFixed(1)}°`, 'scala della latitudine')}
      ${telHtmlSintesi(`${Math.round(bussola)}°`, 'una bussola vera deve segnare')}
      ${telHtmlSintesi(orologio ? `${orologio.distanzaMin.toFixed(0)}′` : '—', 'la Polare è larga così dal polo')}
      ${telHtmlSintesi(polare ? `${polare.alt.toFixed(1)}°` : '—', 'altezza della Polare ora')}
    </div>
    <p class="mt-3 text-xs text-slate-400">Per guardare e basta, puntare l'asse <em>sulla</em> Polare è già
    abbastanza${autonomiaSenzaQuadrante ? `: a ${Math.round(larga.ingrandimento)}× un oggetto centrato ti resta
    nel campo per circa ${Math.round(autonomiaSenzaQuadrante)} minuti` : ''}. L'ultimo passo serve
    per gli alti ingrandimenti e per le foto.</p>`);

  // --- La procedura guidata, un passo per volta ------------------------
  const passi = telPassiAllineamento();
  tel.passo = Math.max(0, Math.min(passi.length - 1, tel.passo | 0));
  const corrente = passi[tel.passo];
  const fatto = tel.fatti.indexOf(corrente.id) >= 0;
  // "Allineato" vuol dire fatti tutti i passi che contano: l'ultimo, quello
  // dello scarto dal polo, serve solo a chi fotografa.
  const finito = passi.filter(s => !s.facoltativo).every(s => tel.fatti.indexOf(s.id) >= 0);

  const guidata = telHtmlScheda('Allineare, un passo per volta', `
    ${telHtmlProgresso(passi)}
    ${finito ? `<p class="mb-3 text-sm text-green-300 bg-green-950/40 border border-green-900 rounded-xl p-3">
      Asse allineato. Da adesso elevazione e treppiede non si toccano più: se sposti il treppiede per girare
      attorno a un albero, l'allineamento è da rifare da capo.</p>` : ''}
    <div class="flex gap-3 items-start">
      <span class="flex-shrink-0 w-8 h-8 rounded-full ${fatto ? 'bg-green-700' : 'bg-blue-600'} text-white text-sm font-bold flex items-center justify-center">${fatto ? '✓' : tel.passo + 1}</span>
      <div class="min-w-0">
        <p class="text-white font-bold">${corrente.titolo}</p>
        <p class="text-sm text-slate-300 mt-1">${corrente.corpo}</p>
      </div>
    </div>
    ${telHtmlStrumento(corrente)}
    ${corrente.nota ? `<p class="mt-3 text-xs text-slate-500">${corrente.nota}</p>` : ''}
    <div class="flex flex-wrap gap-2 mt-4">
      ${tel.passo > 0 ? '<button id="tel-passo-indietro" class="px-4 py-2 rounded-full text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white">← Indietro</button>' : ''}
      <button id="tel-passo-fatto" class="px-4 py-2 rounded-full text-sm font-semibold bg-green-600 hover:bg-green-500 text-white">
        ${tel.passo === passi.length - 1 ? 'Fatto: ho finito' : 'Fatto, avanti →'}</button>
      ${tel.passo < passi.length - 1 ? '<button id="tel-passo-salta" class="px-4 py-2 rounded-full text-sm bg-slate-700 hover:bg-slate-600 text-slate-200">Salta</button>' : ''}
      ${tel.fatti.length ? '<button id="tel-passo-azzera" class="px-4 py-2 rounded-full text-sm bg-slate-700 hover:bg-slate-600 text-slate-200">Ricomincia</button>' : ''}
      <button id="tel-passo-tutti" class="px-4 py-2 rounded-full text-sm bg-slate-700 hover:bg-slate-600 text-slate-200">
        ${tel.tuttiPassi ? 'Nascondi l\'elenco' : 'Vedi tutti i passi'}</button>
    </div>
    <p class="mt-3 text-xs text-amber-300"><strong>Regola d'oro:</strong> in questa fase si muovono solo il
    treppiede e la vite di elevazione. Le manopole di ascensione retta e declinazione spostano il tubo, non
    l'asse: qui non servono.</p>
    ${tel.tuttiPassi ? `
      <ol class="mt-4 space-y-2 text-sm text-slate-300 border-t border-slate-700 pt-4">
        ${passi.map((s, i) => `<li class="flex gap-3">
          <span class="flex-shrink-0 w-6 h-6 rounded-full ${tel.fatti.indexOf(s.id) >= 0 ? 'bg-green-700' : 'bg-slate-700'} text-white text-xs font-bold flex items-center justify-center">${i + 1}</span>
          <div><strong class="text-white">${s.titolo}</strong><br><span class="text-slate-400">${s.corpo}</span></div>
        </li>`).join('')}
      </ol>` : ''}`);

  // --- Il quadrante ----------------------------------------------------
  const quadrante = orologio ? `
    <div class="grid gap-4 sm:grid-cols-2 items-center">
      <canvas id="tel-tela-polare" class="block w-full rounded-xl border border-slate-700 bg-slate-950" style="height:280px"></canvas>
      <div class="text-sm text-slate-300 space-y-2">
        <p class="bg-slate-900 rounded-xl border border-blue-800 p-3">
          <span class="text-slate-400 text-xs">In pratica, adesso:</span><br>
          punta il centro del cercatore <strong class="text-amber-300">${versoNelCercatore}</strong>
          rispetto alla Polare, di <strong class="text-white">${orologio.distanzaMin.toFixed(0)}′</strong>
          (${orologio.lune.toFixed(1)} Lune piene in fila).
        </p>
        <p class="text-xs text-slate-400">Il disegno è come si vede <strong>a occhio nudo, guardando verso Nord</strong>:
        alto dello schermo = alto del cielo, sinistra = Ovest. La croce azzurra è il polo, il punto giallo la Polare.</p>
        <p class="text-xs text-slate-400">La Polare gira attorno al polo in 24 ore: fra un'ora questo disegno sarà
        ruotato di 15°, per questo si aggiorna da solo. Adesso la Polare è ${orologio.verso}
        (angolo orario ${telOreTesto(orologio.ha)}, ora di quadrante ${orologio.oraQuadrante.toFixed(1)}h — è il numero
        da usare se un giorno monti un cannocchiale polare con il reticolo a orologio).</p>
      </div>
    </div>` : '<p class="text-sm text-slate-400">Calcolo non disponibile.</p>';

  // --- Quando non funziona ---------------------------------------------
  const causa = (titolo, corpo) => `
    <li><strong class="text-white">${titolo}</strong><br><span class="text-slate-400">${corpo}</span></li>`;

  const problemi = `
    <ul class="space-y-3 text-sm text-slate-300">
      ${causa('Hai mosso le manopole invece del treppiede.',
        `È la causa numero uno. Le manopole di ascensione retta e declinazione spostano il <em>tubo</em> rispetto
         all'asse: l'asse resta storto dov'era. L'asse si muove solo con la vite di elevazione (su e giù) e
         ruotando il treppiede (destra e sinistra).`)}
      ${causa('Il cercatore non è allineato al tubo.',
        `Allora "centrato nel cercatore" non vuol dire niente. Si tara di giorno, una volta per tutte: inquadra
         un oggetto lontano e fermo (un camino, un traliccio a un chilometro) nell'oculare da
         ${p.oculari[0].focale} mm, poi con le vitine del cercatore porta il puntino sopra lo stesso oggetto.`)}
      ${causa('Hai usato il Nord della bussola.',
        `Il Nord magnetico e quello vero qui distano ${Math.abs(declinazione).toFixed(1)}°: una bussola vera deve
         segnare <strong class="text-white">${Math.round(bussola)}°</strong>, non 0°. La bussola del passo 3 la
         correzione la fa già, e mostra 0° quando sei sul Nord vero. In tutt'e due i casi tienila lontana dal
         telescopio: il tubo è di acciaio e se la porta dove vuole lui.`)}
      ${causa('Non è la Polare.',
        `Verifica: prendi le due stelle di fondo del Grande Carro (quelle opposte al timone), tira la linea che le
         unisce e prolungala cinque volte. Finisci sulla Polare, ed è l'unica stella discretamente luminosa in
         quella zona vuota di cielo. Deve stare a ${polare ? polare.alt.toFixed(1) : l.lat.toFixed(1)}° di altezza,
         esattamente a Nord.`)}
      ${causa('L\'hai messa al centro.',
        `Non è un disastro: ti resta ${orologio ? orologio.distanzaMin.toFixed(0) : '38'}′ di errore, che per
         guardare a occhio va benissimo. Diventa un problema solo sopra i 150× o con la fotografia.`)}
      ${causa('Hai rifatto l\'allineamento a metà serata.',
        `Una volta finito, elevazione e treppiede non si toccano più fino alla fine. Se sposti il treppiede per
         girare attorno a un albero, l'allineamento è da rifare da capo.`)}
    </ul>`;

  return `
    ${inSintesi}
    ${guidata}
    ${telHtmlScheda('Dove mettere la Polare, adesso', quadrante)}
    ${telHtmlScheda('Non ci sei riuscito? Le sei cause, in ordine', problemi)}
    ${telHtmlScheda('Precisione da fotografia: la deriva', telHtmlDeriva(oculare))}`;
}

function telHtmlDeriva(oculare) {
  const stelle = telStelleDeriva();
  const perAzimut = stelle.filter(s => s.ruolo === 'azimut').slice(0, 4);
  const perAltezza = stelle.filter(s => s.ruolo === 'altezza').slice(0, 4);
  const misure = tel.deriva.misure;

  const bottoneStella = s => `<button data-tel-stella-deriva="${s.nome}"
    class="px-3 py-1.5 rounded-full text-xs font-semibold ${tel.deriva.stella === s.nome ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}">
    ${s.nome} <span class="opacity-70">${Math.round(s.alt)}°</span></button>`;

  const elencoMisure = misure.length ? `
    <ul class="mt-3 space-y-1 text-xs text-slate-300">
      ${misure.map((m, i) => `<li class="flex items-center gap-2">
        <span class="text-slate-400">${i + 1}.</span>
        <span class="text-white font-semibold">${m.stella}</span>
        <span>${m.minuti.toFixed(1)} min · ${m.derivaArcsec >= 0 ? 'verso Nord' : 'verso Sud'}
        ${Math.abs(m.derivaArcsec).toFixed(0)}″</span>
        <button data-tel-togli-misura="${i}" class="ml-auto text-slate-400 hover:text-red-400">togli</button>
      </li>`).join('')}
    </ul>` : '';

  const errore = telRisolviDeriva(misure);
  const correzioni = telCorrezioniDeriva(errore);

  let risultato = '';
  if (errore && errore.troppoBreve) {
    risultato = `<p class="mt-3 text-sm text-amber-300">Misure troppo brevi per dire qualcosa.
      La deriva da errore di allineamento vale qualche secondo d'arco al minuto: sotto i
      ${errore.minimo} minuti quello che si vede muovere è l'aria, non l'asse polare.
      Rifai la misura lasciando passare almeno 4–5 minuti.</p>`;
  } else if (errore && errore.insufficiente) {
    risultato = `<p class="mt-3 text-sm text-amber-300">Le due misure vengono da stelle troppo simili fra loro:
      dicono la stessa cosa due volte. Aggiungine una presa in una zona di cielo diversa
      (una a Sud vicino al meridiano, una bassa a Est o a Ovest).</p>`;
  } else if (correzioni.length) {
    const totale = Math.hypot(errore.az || 0, errore.alt || 0);
    const autonomia = telAutonomiaInseguimento(totale, oculare);
    risultato = `
      <div class="mt-4 bg-slate-900 rounded-xl border border-slate-700 p-4">
        <p class="text-sm font-bold text-white mb-2">Correzioni da fare</p>
        <ul class="space-y-2 text-sm">
          ${correzioni.map(c => `<li>
            <span class="text-slate-400">${c.testo}</span><br>
            <span class="text-green-300">${c.azione}</span>
          </li>`).join('')}
        </ul>
        ${errore.parziale ? `<p class="mt-2 text-xs text-amber-300">Misura sola: l'errore in ${errore.residuoAltroAsse}
          resta sconosciuto. Aggiungi una misura su una stella dell'altro gruppo per avere tutt'e due.</p>` : ''}
        ${autonomia ? `<p class="mt-3 text-xs text-slate-400">Con questo errore residuo (${totale.toFixed(1)}′),
          a ${Math.round(oculare.ingrandimento)}× un oggetto centrato ti resta nel campo per circa
          <strong class="text-white">${Math.round(autonomia)} minuti</strong>${telProfilo().motoreAR ? ' con il motore acceso' : ''}.</p>` : ''}
      </div>`;
  }

  const cronometro = tel.deriva.inCorso
    ? `<div class="mt-3 flex items-center gap-3">
         <span id="tel-cronometro" class="font-mono text-2xl text-white">0:00</span>
         <button id="tel-ferma-deriva" class="px-4 py-2 rounded-full text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white">Fermo: ho misurato</button>
         <button id="tel-annulla-deriva" class="px-3 py-2 rounded-full text-sm bg-slate-700 hover:bg-slate-600 text-white">Annulla</button>
       </div>`
    : `<button id="tel-avvia-deriva" class="mt-3 px-4 py-2 rounded-full text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white"
         ${tel.deriva.stella ? '' : 'disabled'}>Avvia il cronometro</button>`;

  const inserimento = tel.deriva.daInserire ? `
    <div class="mt-3 bg-slate-900 rounded-xl border border-blue-800 p-4">
      <p class="text-sm text-white font-semibold mb-2">Dopo ${tel.deriva.daInserire.minuti.toFixed(1)} minuti su ${tel.deriva.daInserire.stella}:</p>
      <p class="text-xs text-slate-400 mb-3">Per sapere da che parte è il Nord nel campo: muovi la manopola della
        declinazione verso i valori crescenti e guarda da che parte scappa la stella. Quella è il Nord.</p>
      <div class="flex flex-wrap gap-2 mb-3">
        <button data-tel-verso="1" class="px-3 py-1.5 rounded-full text-xs font-semibold ${tel.deriva.verso === 1 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200'}">È andata verso NORD</button>
        <button data-tel-verso="-1" class="px-3 py-1.5 rounded-full text-xs font-semibold ${tel.deriva.verso === -1 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200'}">È andata verso SUD</button>
      </div>
      <p class="text-xs text-slate-400 mb-2">Di quanto? Il campo dell'oculare è
        ${oculare ? telAngoloTesto(oculare.campoReale) : '—'} a ${oculare ? Math.round(oculare.ingrandimento) : '—'}×.</p>
      <div class="flex flex-wrap gap-2">
        ${TEL_FRAZIONI_CAMPO.map(f => `<button data-tel-frazione="${f.id}"
          class="px-3 py-1.5 rounded-full text-xs ${tel.deriva.frazione === f.id ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}">${f.nome}</button>`).join('')}
      </div>
      <button id="tel-salva-misura" class="mt-3 px-4 py-2 rounded-full text-sm font-semibold bg-green-600 hover:bg-green-500 text-white">Registra la misura</button>
    </div>` : '';

  return `
    <p class="text-xs text-amber-300 bg-amber-950/40 border border-amber-900 rounded-xl p-3 mb-3">
      Serve solo se fai foto a lunga posa o se lavori sopra i 150×. Per guardare, i 6 passi qui sopra bastano:
      salta pure questa parte.</p>
    <p class="text-sm text-slate-300">È il metodo più preciso che esista senza elettronica, e non richiede
    nessun accessorio: si centra una stella, si aspetta 4–5 minuti senza toccare niente, e si guarda da che parte
    è scivolata. Direzione e velocità dello scivolamento dicono <em>esattamente</em> di quanto è storto l'asse.
    Poi l'app traduce il conto in due frasi: quanto girare le viti di azimut e quanto alzare o abbassare
    la scala della latitudine.</p>

    <div class="mt-4">
      <p class="text-xs text-slate-400 mb-2">Stelle buone <strong>per l'errore in azimut</strong> (a Sud, vicino al meridiano):</p>
      <div class="flex flex-wrap gap-2">${perAzimut.length ? perAzimut.map(bottoneStella).join('') : '<span class="text-xs text-slate-500">Nessuna adatta in questo momento.</span>'}</div>
    </div>
    <div class="mt-3">
      <p class="text-xs text-slate-400 mb-2">Stelle buone <strong>per l'errore in altezza</strong> (basse a Est o a Ovest):</p>
      <div class="flex flex-wrap gap-2">${perAltezza.length ? perAltezza.map(bottoneStella).join('') : '<span class="text-xs text-slate-500">Nessuna adatta in questo momento.</span>'}</div>
    </div>

    ${tel.deriva.stella ? `<p class="mt-3 text-xs text-slate-400">Centra <strong class="text-white">${tel.deriva.stella}</strong>
      nell'oculare più spinto${oculare ? ` (${Math.round(oculare.ingrandimento)}×)` : ''}, poi avvia il cronometro e non toccare più niente.
      Bastano 4–5 minuti.</p>` : ''}

    ${cronometro}
    ${inserimento}
    ${elencoMisure}
    ${risultato}

    ${misure.length ? '<button id="tel-azzera-deriva" class="mt-3 text-xs text-slate-400 underline hover:text-slate-200">Azzera tutte le misure</button>' : ''}`;
}

function telDopoAllineamento() {
  // Il quadrante polare compare in due posti: nella scheda di riferimento
  // e, quando è il suo turno, dentro il passo della procedura. Si
  // disegnano tutte le tele che ci sono.
  const teleQuadrante = () => ['tel-tela-polare', 'tel-tela-polare-passo']
    .map(id => document.getElementById(id))
    .filter(Boolean);
  if (teleQuadrante().length) {
    const disegna = () => {
      const dati = telOrologioPolare();
      teleQuadrante().forEach(t => telDisegnaOrologioPolare(t, dati));
    };
    disegna();
    // La Polare gira di un grado ogni quattro minuti: ridisegnare ogni
    // mezzo minuto basta e avanza.
    clearInterval(tel.tele.polare);
    tel.tele.polare = setInterval(() => {
      if (teleQuadrante().length) disegna();
      else clearInterval(tel.tele.polare);
    }, 30000);
  }

  // La posizione si chiede sempre allo stesso modo: GPS, poi rete, poi la
  // scelta a mano. Ci pensa la finestra, che sa anche raccontarlo.
  const chiedi = document.getElementById('tel-chiedi-posizione');
  if (chiedi) chiedi.addEventListener('click', () => apriPosizione(true));

  const vaiCielo = document.getElementById('tel-vai-cielo');
  if (vaiCielo) vaiCielo.addEventListener('click', () => {
    sky.mostraPolo = true;
    mostraVista('cielo');
  });

  // Senza posizione, o dall'emisfero australe, il pannello mostra una
  // scheda sola e non c'è niente d'altro da collegare.
  const luogo = luogoCorrente();
  if (!luogo || luogo.lat <= 0) return;

  // --- La procedura guidata ---------------------------------------------
  const passi = telPassiAllineamento();

  document.querySelectorAll('[data-tel-vai-passo]').forEach(b => {
    b.addEventListener('click', () => {
      tel.passo = parseInt(b.dataset.telVaiPasso, 10) || 0;
      telSalvaSessione();
      telCostruisciPannello();
    });
  });

  const avanti = () => {
    tel.passo = Math.min(passi.length - 1, tel.passo + 1);
    telSalvaSessione();
    telCostruisciPannello();
  };

  const fatto = document.getElementById('tel-passo-fatto');
  if (fatto) fatto.addEventListener('click', () => {
    const id = passi[tel.passo] && passi[tel.passo].id;
    if (id && tel.fatti.indexOf(id) < 0) tel.fatti.push(id);
    if (tel.passo < passi.length - 1) avanti();
    else { telSalvaSessione(); telCostruisciPannello(); }
  });

  const salta = document.getElementById('tel-passo-salta');
  if (salta) salta.addEventListener('click', avanti);

  const indietro = document.getElementById('tel-passo-indietro');
  if (indietro) indietro.addEventListener('click', () => {
    tel.passo = Math.max(0, tel.passo - 1);
    telSalvaSessione();
    telCostruisciPannello();
  });

  const azzeraPassi = document.getElementById('tel-passo-azzera');
  if (azzeraPassi) azzeraPassi.addEventListener('click', () => {
    tel.fatti = [];
    tel.passo = 0;
    telSalvaSessione();
    telCostruisciPannello();
  });

  const tutti = document.getElementById('tel-passo-tutti');
  if (tutti) tutti.addEventListener('click', () => {
    tel.tuttiPassi = !tel.tuttiPassi;
    telCostruisciPannello();
  });

  const accendi = document.getElementById('tel-accendi-sensori');
  if (accendi) accendi.addEventListener('click', async () => {
    accendi.textContent = 'Accendo i sensori…';
    const ok = await skyRichiediSensori();
    if (!ok) {
      accendi.textContent = 'Permesso negato';
      accendi.insertAdjacentHTML('afterend',
        `<p class="text-xs text-amber-300 mt-2">Senza il permesso ai sensori di movimento gli strumenti del
         telefono non funzionano. Su iPhone si concede da Impostazioni → Safari → Movimento e orientamento.</p>`);
      return;
    }
    // I primi eventi arrivano entro un decimo di secondo: il pannello si
    // ricostruisce da solo e trova già i sensori accesi.
    setTimeout(() => telCostruisciPannello(), 250);
  });

  telAvviaSensori();

  document.querySelectorAll('[data-tel-stella-deriva]').forEach(b => {
    b.addEventListener('click', () => {
      tel.deriva.stella = b.dataset.telStellaDeriva;
      telCostruisciPannello();
    });
  });

  const avvia = document.getElementById('tel-avvia-deriva');
  if (avvia) avvia.addEventListener('click', () => {
    tel.deriva.inCorso = Date.now();
    telCostruisciPannello();
  });

  const annulla = document.getElementById('tel-annulla-deriva');
  if (annulla) annulla.addEventListener('click', () => {
    tel.deriva.inCorso = null;
    telFermaCronometro();
    telCostruisciPannello();
  });

  const ferma = document.getElementById('tel-ferma-deriva');
  if (ferma) ferma.addEventListener('click', () => {
    const minuti = (Date.now() - tel.deriva.inCorso) / 60000;
    tel.deriva.daInserire = { stella: tel.deriva.stella, minuti, quando: new Date(tel.deriva.inCorso) };
    tel.deriva.inCorso = null;
    tel.deriva.verso = null;
    tel.deriva.frazione = null;
    telFermaCronometro();
    telCostruisciPannello();
  });

  if (tel.deriva.inCorso) telAvviaCronometro();

  document.querySelectorAll('[data-tel-verso]').forEach(b => {
    b.addEventListener('click', () => {
      tel.deriva.verso = parseInt(b.dataset.telVerso, 10);
      telCostruisciPannello();
    });
  });
  document.querySelectorAll('[data-tel-frazione]').forEach(b => {
    b.addEventListener('click', () => {
      tel.deriva.frazione = parseInt(b.dataset.telFrazione, 10);
      telCostruisciPannello();
    });
  });

  const salva = document.getElementById('tel-salva-misura');
  if (salva) salva.addEventListener('click', () => {
    const d = tel.deriva.daInserire;
    const oculare = telOculareDeriva();
    if (!d || tel.deriva.verso == null || tel.deriva.frazione == null || !oculare) return;

    const frazione = TEL_FRAZIONI_CAMPO.find(f => f.id === tel.deriva.frazione);
    const derivaArcsec = tel.deriva.verso * frazione.valore * oculare.campoRealeMin * 60;

    const obs = osservatoreCorrente();
    const l = luogoCorrente();
    const stella = telStelle().find(s => s.nome === d.stella);
    if (!obs || !l || !stella) return;
    // La sensibilità va presa a metà misura: la stella si è mossa nel
    // frattempo, e con lei il suo modo di reagire all'errore.
    const meta = new Date(d.quando.getTime() + d.minuti * 30000);
    const hor = altAzCoordinate(stella.ra, stella.dec, meta, obs);
    const sens = telSensibilitaDeriva(hor.alt, hor.az, l.lat);
    if (!sens) return;

    tel.deriva.misure.push({ stella: d.stella, minuti: d.minuti, derivaArcsec, sens });
    tel.deriva.daInserire = null;
    tel.deriva.verso = null;
    tel.deriva.frazione = null;
    telSalvaSessione();
    telCostruisciPannello();
  });

  document.querySelectorAll('[data-tel-togli-misura]').forEach(b => {
    b.addEventListener('click', () => {
      tel.deriva.misure.splice(parseInt(b.dataset.telTogliMisura, 10), 1);
      telSalvaSessione();
      telCostruisciPannello();
    });
  });

  const azzera = document.getElementById('tel-azzera-deriva');
  if (azzera) azzera.addEventListener('click', () => {
    tel.deriva.misure = [];
    telSalvaSessione();
    telCostruisciPannello();
  });
}

// Il ciclo degli strumenti del telefono. Gira solo se sullo schermo c'è
// una tela che li usa, e a dieci volte al secondo: i sensori non danno di
// meglio, e ridisegnare più spesso servirebbe solo a scaldare la batteria
// mentre si è al freddo. Le tele si aggiornano in posto, senza
// ricostruire il pannello, perché un pannello che si ricostruisce dieci
// volte al secondo perde il fuoco dei tasti e fa sfarfallare tutto.
function telAvviaSensori() {
  telFermaSensori();

  const aggiorna = () => {
    const bolla = document.getElementById('tel-tela-bolla');
    const gonio = document.getElementById('tel-tela-goniometro');
    const bussola = document.getElementById('tel-tela-bussola');
    if (!bolla && !gonio && !bussola) { telFermaSensori(); return; }

    const livella = telLivella();
    const lettura = document.getElementById('tel-lettura-sensori');

    if (bolla) {
      telDisegnaBolla(bolla, livella);
      if (lettura) {
        lettura.innerHTML = livella
          ? `Lato alto ${livella.inclinazione >= 0 ? '+' : ''}${livella.inclinazione.toFixed(1)}° ·
             fianco destro ${livella.sbandamento >= 0 ? '+' : ''}${livella.sbandamento.toFixed(1)}°.
             La gamba da accorciare è quella dalla parte della bolla.`
          : 'Sensori in attesa: muovi un attimo il telefono.';
      }
    }

    if (gonio) {
      const bersaglio = parseFloat(gonio.dataset.bersaglio);
      telDisegnaInclinometro(gonio, livella
        ? { angolo: Math.abs(livella.inclinazione), bersaglio: isFinite(bersaglio) ? bersaglio : null }
        : null);
      if (lettura) {
        lettura.innerHTML = livella
          ? `Il telefono è inclinato di <strong class="text-white">${Math.abs(livella.inclinazione).toFixed(1)}°</strong>
             sull'orizzonte${Math.abs(livella.sbandamento) > 5
               ? ` — ma è anche sghembo di ${Math.abs(livella.sbandamento).toFixed(0)}°: raddrizzalo, se no legge di meno`
               : ''}.`
          : 'Sensori in attesa: muovi un attimo il telefono.';
      }
    }

    if (bussola) {
      const bersaglio = parseFloat(bussola.dataset.bersaglio);
      const b = telBussolaTelefono();
      telDisegnaBussola(bussola, b && !b.ambiguo
        ? { az: b.az, bersaglio: isFinite(bersaglio) ? bersaglio : 0 }
        : null);
      if (lettura) lettura.innerHTML = telTestoBussola(b, isFinite(bersaglio) ? bersaglio : 0);
    }
  };

  aggiorna();
  tel.bussola.timer = setInterval(aggiorna, 100);
}

function telFermaSensori() {
  if (tel.bussola.timer) { clearInterval(tel.bussola.timer); tel.bussola.timer = null; }
  tel.bussola.storico = [];
}

// La riga scritta sotto alla bussola. Dice tre cose che il disegno non
// può dire: com'è tenuto il telefono, se il numero è affidabile e se sta
// ballando. Un numero di bussola senza queste tre cose è pericoloso,
// perché sembra preciso.
function telTestoBussola(b, bersaglio) {
  if (!b) return 'Sensori in attesa: muovi un attimo il telefono.';
  if (b.ambiguo) {
    return `<span class="text-amber-300">Tienilo in piano</span> (appoggiato) oppure in verticale (come per una
      foto): a mezza strada non c'è un verso da leggere.`;
  }

  const pezzi = [];
  pezzi.push(b.modo === 'piatto'
    ? 'Sto leggendo dove punta il <strong class="text-white">lato alto</strong> del telefono.'
    : 'Sto leggendo dove punta il <strong class="text-white">dorso</strong> del telefono (la fotocamera).');

  const scarto = telScartoAzimut(b.az, bersaglio);
  pezzi.push(scarto.modulo <= TEL_TOLLERANZA_NORD
    ? '<span class="text-green-300">Sei sul Nord vero.</span>'
    : `Manca <strong class="text-white">${scarto.modulo.toFixed(0)}°</strong> in senso ${scarto.senso}.`);

  if (!b.bussolaVera) {
    pezzi.push('<span class="text-amber-300">Attenzione: orientamento relativo, questo azimut non è un Nord.</span>');
  }
  if (b.storto) {
    pezzi.push(`<span class="text-amber-300">Il telefono è inclinato di ${Math.abs(b.inclinazione).toFixed(0)}°:
      appoggialo più in piano.</span>`);
  }
  if (b.jitter != null && b.jitter > TEL_JITTER_SOSPETTO) {
    pezzi.push(`<span class="text-amber-300">Il numero balla di ±${b.jitter.toFixed(0)}°: c'è ferro vicino
      (il tubo, il contrappeso) oppure il magnetometro va tarato muovendo il telefono a otto nell'aria.</span>`);
  }
  return pezzi.join(' ');
}

function telAvviaCronometro() {
  telFermaCronometro();
  tel.deriva.timer = setInterval(() => {
    const el = document.getElementById('tel-cronometro');
    if (!el || !tel.deriva.inCorso) { telFermaCronometro(); return; }
    const s = Math.floor((Date.now() - tel.deriva.inCorso) / 1000);
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
}

function telFermaCronometro() {
  if (tel.deriva.timer) { clearInterval(tel.deriva.timer); tel.deriva.timer = null; }
}

// --- Pannello: PUNTA ---------------------------------------------------

let telOggettiCache = { quando: 0, lista: [] };
function telOggettiOra() {
  // Ricalcolare le posizioni di tutto a ogni ridisegno del pannello
  // costerebbe caro e non servirebbe: in un minuto il cielo non si muove
  // abbastanza da cambiare una sola cifra mostrata.
  if (Date.now() - telOggettiCache.quando < 60000 && telOggettiCache.lista.length) return telOggettiCache.lista;
  telOggettiCache = { quando: Date.now(), lista: telOggettiPuntabili(new Date()) };
  return telOggettiCache.lista;
}

function telBersaglioCorrente() {
  if (!tel.bersaglio) return null;
  return telOggettiOra().find(o => o.id === tel.bersaglio) || null;
}

function telPannelloPunta() {
  const obs = osservatoreCorrente();
  if (!obs) {
    return telHtmlScheda('Serve la posizione', `
      <p class="text-sm text-slate-300">Senza sapere dove sei, non c'è modo di dire dove guardare.</p>
      <button id="tel-chiedi-posizione" class="mt-3 px-4 py-2 rounded-full text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white">Dimmi dove sono</button>
      <p class="text-xs text-slate-500 mt-2">Provo il GPS, poi la connessione; se non rispondono puoi scegliere la citt&agrave; in elenco.</p>`);
  }

  // Di giorno gli oggetti stanno dove dice il conto, ma non si vedono:
  // meglio dirlo subito che lasciare cercare M13 alle tre del pomeriggio.
  const altSole = altezzaSole(new Date(), obs);
  const avvisoGiorno = (altSole != null && altSole > -6)
    ? `<p class="mb-3 text-xs text-amber-300 bg-amber-950/40 border border-amber-900 rounded-xl p-3">
        ${altSole > 0 ? 'È giorno' : 'È ancora crepuscolo'}: le posizioni qui sotto sono giuste, ma solo Luna e
        pianeti luminosi si vedono davvero. Usa questo pannello per prepararti, e il pannello Serata per sapere
        a che ora si comincia.</p>`
    : '';

  const oggetti = telOggettiOra().filter(o => o.alt > 5);
  const gruppi = [
    { id: 'pianeti', nome: 'Pianeti e Luna' },
    { id: 'profondo', nome: 'Deep sky' },
    { id: 'stelle', nome: 'Stelle luminose' }
  ];

  const scelta = gruppi.map(g => {
    const voci = oggetti.filter(o => o.gruppo === g.id).sort((a, b) => b.alt - a.alt);
    if (!voci.length) return '';
    return `<div class="mb-3">
      <p class="text-xs text-slate-400 mb-2">${g.nome}</p>
      <div class="flex flex-wrap gap-2">
        ${voci.map(o => `<button data-tel-bersaglio="${o.id}"
          class="px-3 py-1.5 rounded-full text-xs font-semibold ${tel.bersaglio === o.id ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'} ${o.allaPortata ? '' : 'opacity-50'}">
          ${o.nome.split(' — ')[0]} <span class="opacity-70">${Math.round(o.alt)}°</span></button>`).join('')}
      </div>
    </div>`;
  }).join('');

  const bersaglio = telBersaglioCorrente();
  if (!bersaglio) {
    return telHtmlScheda('Cosa vuoi puntare?', avvisoGiorno + scelta +
      '<p class="text-xs text-slate-500 mt-2">Sono elencati solo gli oggetti sopra i 5° di altezza: sotto, ci sono i tetti e la foschia.</p>') +
      telHtmlScheda('Tutte le coordinate di stanotte', telHtmlTabellaCoordinate(oggetti));
  }

  const p = telProfilo();
  const combinazione = telCombinazionePer(bersaglio.dim, p, bersaglio);
  const verdetto = telVerdettoOggetto(bersaglio, combinazione.scelta, p);
  const ha = telAngoloOrario(bersaglio.ra, new Date());
  const coloriVerdetto = { si: 'text-green-400', forse: 'text-amber-400', no: 'text-red-400' };

  const scheda = `
    <div class="griglia-sintesi mb-3">
      ${telHtmlSintesi(`${Math.round(bersaglio.alt)}°`, 'altezza ora')}
      ${telHtmlSintesi(skyNomeDirezione(bersaglio.az), `azimut ${Math.round(bersaglio.az)}°`)}
      ${telHtmlSintesi(bersaglio.dim ? telAngoloTesto(bersaglio.dim / 60) : '—', 'dimensione')}
      ${telHtmlSintesi(bersaglio.mag != null ? bersaglio.mag.toFixed(1) : '—', 'magnitudine')}
    </div>
    <p class="text-sm ${coloriVerdetto[verdetto.esito]}">${verdetto.testo}</p>
    <div class="mt-3 text-sm text-slate-300 space-y-1">
      <p><span class="text-slate-400">Angolo orario:</span> <span class="font-mono">${ha != null ? telOreTesto(ha) : '—'}</span>
        ${ha != null ? `<span class="text-xs text-slate-500">(${Math.abs(ha) < 0.2 ? 'in meridiano adesso: è il momento migliore' : (ha < 0 ? `passa in meridiano fra ${telOreTesto(-ha).replace('+', '')}` : `ha passato il meridiano da ${telOreTesto(ha).replace('+', '')}`)})</span>` : ''}</p>
      ${combinazione.scelta ? `<p><span class="text-slate-400">Oculare consigliato:</span>
        <span class="text-white">${combinazione.scelta.nome}</span> — ${Math.round(combinazione.scelta.ingrandimento)}×,
        campo ${telAngoloTesto(combinazione.scelta.campoReale)}${combinazione.entra ? '' : ' <span class="text-amber-400">(l\'oggetto è più grande del campo)</span>'}</p>` : ''}
    </div>
    <div class="flex flex-wrap gap-2 mt-3">
      <button id="tel-anteprima" class="px-4 py-2 rounded-full text-sm font-semibold bg-purple-700 hover:bg-purple-600 text-white">Cosa vedrò davvero</button>
      <button id="tel-cambia-bersaglio" class="px-4 py-2 rounded-full text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white">Cambia oggetto</button>
    </div>`;

  // Un oggetto che si vede a occhio nudo non ha bisogno di un percorso a
  // salti: si punta il cercatore e basta. La carta del cielo, per quelli,
  // sarebbe solo una scheda in più da scorrere.
  const aOcchioNudo = bersaglio.mag != null && bersaglio.mag < 3;
  const salti = aOcchioNudo
    ? `<p class="text-sm text-slate-300">
        ${bersaglio.nome.split(' — ')[0]} si vede a occhio nudo (magnitudine ${bersaglio.mag.toFixed(1)}):
        non serve nessun percorso. Guarda ${skyNomeDirezione(bersaglio.az)} a ${Math.round(bersaglio.alt)}° di altezza,
        mettilo nel punto rosso del cercatore e sei già nel campo dell'oculare più largo.</p>`
    : telHtmlSalti(bersaglio);

  // I tre modi di arrivarci non sono alternative equivalenti da mettere in
  // fila: uno si sceglie, e gli altri due intanto stanno zitti. Metterli
  // tutti aperti voleva dire cinque schede da scorrere con le mani fredde
  // per trovare quella che si stava usando.
  const metodi = [
    { id: 'pushto', nome: 'Push-to col telefono', sotto: 'Il telefono sul tubo ti guida in tempo reale' },
    // I cerchi graduati esistono solo su una equatoriale: su un Dobson non
    // c'è niente da graduare, e offrirli sarebbe una porta che non si apre.
    p.montatura === 'eq'
      ? { id: 'cerchi', nome: 'Cerchi graduati', sotto: 'Due numeri sulle manopole, niente sensori' }
      : null,
    { id: 'salti', nome: 'Salti di stella', sotto: 'Di stella in stella nel cercatore' }
  ].filter(Boolean);
  if (!metodi.some(m => m.id === tel.metodo)) tel.metodo = 'pushto';
  const scelto = metodi.find(m => m.id === tel.metodo);

  const sceltaMetodo = `
    <div class="flex flex-wrap gap-2">
      ${metodi.map(m => `<button data-tel-metodo="${m.id}" title="${m.sotto}"
        class="px-3 py-2 rounded-full text-sm font-semibold ${tel.metodo === m.id ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}">
        ${m.nome}</button>`).join('')}
    </div>
    <p class="text-xs text-slate-500 mt-2">${scelto.sotto}. ${p.montatura === 'eq'
      ? 'Sono tutti e tre buoni: il push-to è il più veloce, i cerchi il più preciso, i salti quello che non dipende da niente.'
      : 'Su montatura altazimutale i cerchi graduati non ci sono: restano il push-to e i salti di stella.'}</p>`;

  const corpoMetodo = tel.metodo === 'pushto'
    ? telHtmlScheda('Push-to: il telefono sul tubo', telHtmlTubo(bersaglio))
    : (tel.metodo === 'cerchi'
      ? telHtmlScheda('Cerchi graduati, passo per passo', telHtmlCerchi(bersaglio))
      : telHtmlScheda('Salti di stella', salti));

  return `
    ${telHtmlScheda(bersaglio.nome, scheda)}
    ${telHtmlScheda('Come ci arrivi?', sceltaMetodo)}
    ${corpoMetodo}
    ${telHtmlScheda('Coordinate per le manopole', telHtmlManopole(bersaglio))}`;
}

// Le due cifre che servono davanti al telescopio, grandi e senza contorno
// di parole: l'ascensione retta da mettere sul cerchio orario e la
// declinazione da mettere sul cerchio verticale.
function telHtmlManopole(bersaglio) {
  const quando = new Date();
  const c = telCoordinateOggi(bersaglio, quando);
  const lst = telTempoSiderale(quando);
  const ha = telAngoloOrario(c.ra, quando);

  const cifra = (etichetta, valore, sotto, colore) => `
    <div class="bg-slate-900 rounded-xl border border-slate-700 p-4 text-center">
      <div class="text-xs text-slate-400 mb-1">${etichetta}</div>
      <div class="text-3xl font-bold font-mono ${colore} tracking-tight">${valore}</div>
      <div class="text-xs text-slate-500 mt-1 font-mono">${sotto}</div>
    </div>`;

  return `
    <div class="grid gap-3 sm:grid-cols-2">
      ${cifra('Ascensione retta — cerchio orario', telArTesto(c.ra), telOreDecimaliTesto(c.ra), 'text-blue-300')}
      ${cifra('Declinazione — cerchio verticale', telDecTesto(c.dec), `${telGradiTesto(c.dec, 2)} decimali`, 'text-amber-300')}
    </div>

    <p class="mt-3 text-xs text-slate-500">Coordinate di stanotte${c.aggiornate ? ' (precessione applicata: sul catalogo, in J2000, sono AR '
      + telArTesto(bersaglio.ra) + ' e Dec ' + telDecTesto(bersaglio.dec) + ')' : ' — pianeti e Luna si spostano di ora in ora'}.
      Tempo siderale locale adesso: <span class="font-mono">${lst != null ? telArTesto(lst) : '—'}</span>${ha != null ? ` · angolo orario del bersaglio <span class="font-mono">${telOreTesto(ha)}</span>` : ''}.</p>

    <div class="mt-4 bg-slate-900 rounded-xl border border-slate-700 p-4 text-sm text-slate-300 space-y-3">
      <p class="font-bold text-white">Come si usano sulla Spica (e su qualunque EQ3)</p>
      <p><strong class="text-amber-300">La declinazione è assoluta.</strong> Il cerchio verticale, una volta
      tarato, vale tutta la vita: allenta la manopola, muovi finché l'indice segna
      <span class="font-mono text-white">${telDecTesto(c.dec)}</span>, ristringi. Se non ti torna, taralo una volta
      sola: centra una stella di cui conosci la declinazione e ruota il cerchio finché legge il suo valore.</p>
      <p><strong class="text-blue-300">L'ascensione retta no.</strong> Il cerchio orario gira insieme al cielo,
      quindi va ritarato a ogni sessione (e, senza motore, ogni volta che passa mezz'ora): si centra una stella
      nota e si fa scorrere il cerchio — è apposta che è morbido — finché legge l'ascensione retta di quella
      stella. Da quel momento i numeri sono buoni. Il passo qui sotto lo fa fare all'app.</p>
      <p class="text-xs text-slate-400">Precisione realistica di questi cerchi: mezzo grado o poco meno. Ti porta
      dentro il campo del cercatore, non al centro dell'oculare — l'ultimo pezzetto lo fai a occhio.</p>
    </div>`;
}

// L'elenco completo con le due cifre da mettere sulle manopole: serve a
// chi vuole segnarsele su un foglio prima di uscire, invece di aprire
// l'app oggetto per oggetto con le mani fredde.
function telHtmlTabellaCoordinate(oggetti) {
  const ora = new Date();
  const righe = oggetti.slice().sort((a, b) => b.alt - a.alt).map(o => {
    const c = telCoordinateOggi(o, ora);
    return `<tr class="border-t border-slate-700/60">
      <td class="py-1.5 pr-3 text-slate-200">${o.nome.split(' — ')[0]}</td>
      <td class="py-1.5 pr-3 font-mono text-blue-300 whitespace-nowrap">${telArTesto(c.ra)}</td>
      <td class="py-1.5 pr-3 font-mono text-amber-300 whitespace-nowrap">${telDecTesto(c.dec)}</td>
      <td class="py-1.5 text-right text-slate-400 whitespace-nowrap">${Math.round(o.alt)}°</td>
    </tr>`;
  }).join('');

  return `
    <p class="text-sm text-slate-300 mb-3">Ascensione retta e declinazione di tutto quello che è sopra l'orizzonte
    adesso, nel formato dei cerchi graduati. Sono coordinate di stanotte, già portate avanti dal J2000 del catalogo.</p>
    <div class="overflow-x-auto -mx-2 px-2">
      <table class="w-full text-sm">
        <thead><tr class="text-xs text-slate-400 text-left">
          <th class="pb-2 pr-3 font-normal">Oggetto</th>
          <th class="pb-2 pr-3 font-normal">AR</th>
          <th class="pb-2 pr-3 font-normal">Dec</th>
          <th class="pb-2 font-normal text-right">Alt</th>
        </tr></thead>
        <tbody>${righe}</tbody>
      </table>
    </div>`;
}

// Ascensione retta in ore, minuti e secondi: è come sta scritta sui
// cerchi della montatura e su qualunque catalogo.
function telOreDecimaliTesto(ore) {
  const tot = ((ore % 24) + 24) % 24;
  // Si arrotonda una volta sola, ai secondi, e poi si riportano: se no
  // esce "4h 11m 60s", che è un orario che non esiste.
  let secondi = Math.round(tot * 3600) % 86400;
  const h = Math.floor(secondi / 3600);
  const m = Math.floor((secondi % 3600) / 60);
  const s = secondi % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function telHtmlCerchi(bersaglio) {
  const p = telProfilo();
  const stelle = telOggettiOra()
    .filter(o => o.gruppo === 'stelle' && o.alt > 20)
    .sort((a, b) => a.mag - b.mag)
    .slice(0, 8);

  if (!tel.riferimento) {
    const ora = new Date();
    return `
      <p class="text-sm text-slate-300"><strong class="text-white">Passo 1 di 2: tara il cerchio orario.</strong>
      Centra nell'oculare una di queste stelle — sono le più luminose alte in cielo adesso — poi premi il suo nome.
      L'app ti dirà su che numero far scorrere il cerchio.</p>
      <div class="flex flex-col gap-2 mt-3">
        ${stelle.map(s => {
          const c = telCoordinateOggi(s, ora);
          return `<button data-tel-riferimento="${s.id}"
            class="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-left bg-slate-900 hover:bg-slate-700 border border-slate-700">
            <span class="text-sm font-semibold text-white">${s.nome}
              <span class="text-xs text-slate-400 font-normal">${Math.round(s.alt)}° · ${skyNomeDirezione(s.az)}</span></span>
            <span class="font-mono text-xs text-slate-300 whitespace-nowrap">
              <span class="text-blue-300">${telArTesto(c.ra)}</span> · <span class="text-amber-300">${telDecTesto(c.dec)}</span></span>
          </button>`;
        }).join('')}
      </div>
      ${stelle.length ? '' : '<p class="text-xs text-slate-500 mt-2">Nessuna stella luminosa abbastanza alta in questo momento.</p>'}
      <p class="text-xs text-slate-500 mt-3">Non riconosci nessuna di queste stelle? Va bene anche il bersaglio di
      un giro precedente, o la Luna: l'importante è sapere con certezza su cosa sei puntato.</p>`;
  }

  const scarto = telScartoVerso(bersaglio);
  if (!scarto) return '<p class="text-sm text-slate-400">Calcolo non disponibile.</p>';

  const eta = Math.round((Date.now() - tel.riferimento.quando) / 60000);

  return `
    <p class="text-sm text-slate-300">Sei puntato su <strong class="text-white">${tel.riferimento.nome}</strong>${eta > 0 ? ` <span class="text-slate-400">(da ${eta} min)</span>` : ''}:
      fai scorrere il cerchio orario finché l'indice legge
      <strong class="font-mono text-blue-300">${telArTesto(tel.riferimento.ra)}</strong>, e il cerchio verticale
      <strong class="font-mono text-amber-300">${telDecTesto(tel.riferimento.dec)}</strong>. Tarato.</p>

    <p class="text-sm text-white font-bold mt-4 mb-2">Passo 2 di 2: muovi le due manopole.</p>
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="bg-slate-900 rounded-xl border border-slate-700 p-4">
        <div class="text-xs text-slate-400 mb-1">Manopola di ascensione retta</div>
        <div class="text-2xl font-bold font-mono text-white">${telOreTesto(scarto.dHA).replace('+', '')}
          <span class="text-base text-blue-300 font-semibold">verso ${scarto.versoRA}</span></div>
        <div class="text-xs text-slate-400 mt-2">finché il cerchio orario legge
          <span class="font-mono text-blue-300">${telArTesto(scarto.letturaAR)}</span></div>
      </div>
      <div class="bg-slate-900 rounded-xl border border-slate-700 p-4">
        <div class="text-xs text-slate-400 mb-1">Manopola di declinazione</div>
        <div class="text-2xl font-bold font-mono text-white">${Math.abs(scarto.dDec).toFixed(1)}°
          <span class="text-base text-amber-300 font-semibold">verso ${scarto.versoDec}</span></div>
        <div class="text-xs text-slate-400 mt-2">finché il cerchio verticale legge
          <span class="font-mono text-amber-300">${telDecTesto(scarto.dec)}</span></div>
      </div>
    </div>

    <p class="mt-3 text-xs ${scarto.conMotore ? 'text-slate-400' : 'text-amber-300'}">
      ${scarto.conMotore
        ? 'Motore acceso: lo scarto in ascensione retta è fisso, non cambia mentre armeggi.'
        : `Senza motore il cielo scorre: la lettura in ascensione retta qui sopra tiene già conto del tempo
           passato dalla taratura${eta > 0 ? ` (${eta} min)` : ''}, ma premi <em>Ricalcola</em> appena prima di
           muovere la manopola.`}</p>

    <p class="mt-3 text-xs text-slate-500">Arrivato in fondo, guarda nell'oculare più largo: l'oggetto è lì dentro
    o poco fuori. Se non c'è, muovi piano in declinazione di mezzo grado avanti e indietro — l'errore dei cerchi
    è quasi sempre lì.</p>

    <div class="flex flex-wrap gap-2 mt-3">
      <button id="tel-ricalcola" class="px-4 py-2 rounded-full text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white">Ricalcola adesso</button>
      <button id="tel-riferimento-qui" class="px-4 py-2 rounded-full text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white">Sono arrivato: riparti da qui</button>
      <button id="tel-nuovo-riferimento" class="px-4 py-2 rounded-full text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white">Cambia stella di taratura</button>
    </div>`;
}

function telHtmlSalti(bersaglio) {
  const percorso = telPercorsoSalti(bersaglio);
  if (!percorso || !percorso.partenza) {
    return `<p class="text-sm text-slate-400">${percorso ? percorso.avviso : 'Percorso non disponibile.'}</p>`;
  }

  const p = telProfilo();
  const capovolto = tel.saltiCapovolti != null ? tel.saltiCapovolti : (TEL_TIPI[p.tipo] || {}).rotazione === 180;
  // Si cerca sempre con l'oculare più largo — è quello che perdona gli
  // errori — e si cambia solo dopo aver trovato l'oggetto.
  const larga = telCombinazioni(p).find(c => !c.vuoto);
  const combinazione = telCombinazionePer(bersaglio.dim, p).scelta;
  const cambioOculare = combinazione && larga && combinazione.chiave !== larga.chiave;

  const passi = percorso.salti.map((s, i) => `
    <li class="flex gap-3 items-start">
      <span class="flex-shrink-0 w-6 h-6 rounded-full ${s.finale ? 'bg-pink-600' : 'bg-amber-600'} text-white text-xs font-bold flex items-center justify-center">${i + 1}</span>
      <div class="text-sm">
        <span class="text-white font-semibold">${s.a}</span>
        <span class="text-slate-400"> — ${telAngoloTesto(s.gradi)} verso ${s.direzione}, da ${s.da}</span>
        ${s.finale
          ? `<div class="text-xs text-pink-300 mt-0.5">Ultimo tratto: qui l'oggetto non si vede nel cercatore.
             Passa all'oculare${larga ? ` da ${Math.round(larga.ingrandimento)}×` : ''} e spostati di
             ${s.campiOculare != null ? `circa ${s.campiOculare.toFixed(1)} campi` : 'poco'} verso ${s.direzione}.
             ${cambioOculare ? `Una volta trovato, sali a ${Math.round(combinazione.ingrandimento)}×: il fondo cielo
             si scurisce e l'oggetto stacca di più.` : ''}</div>`
          : `<div class="text-xs text-slate-500 mt-0.5">${(s.gradi / percorso.cercatore.campo).toFixed(1)} campi di cercatore${s.mag != null ? ` · stella di magnitudine ${s.mag.toFixed(1)}` : ''}</div>`}
      </div>
    </li>`).join('');

  return `
    <p class="text-sm text-slate-300 mb-3">Con un cercatore a punto rosso non si "cerca": si salta da una stella
    che si vede a occhio nudo alla successiva, un campo alla volta. Parti da
    <strong class="text-amber-300">${percorso.partenza.nome}</strong>
    (${percorso.partenza.costellazione}, magnitudine ${percorso.partenza.mag.toFixed(1)}).</p>

    <canvas id="tel-tela-salti" class="block w-full rounded-xl border border-slate-700 bg-slate-950 mb-3" style="height:300px"></canvas>

    <div class="flex flex-wrap gap-2 mb-3 text-xs">
      <button id="tel-ruota-carta" class="px-3 py-1.5 rounded-full font-semibold ${capovolto ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200'}">
        ${capovolto ? 'Vista oculare (capovolta)' : 'Vista carta (Nord in alto)'}
      </button>
      <span class="px-3 py-1.5 text-slate-500">Cerchio azzurro = cercatore ${percorso.cercatore.campo}° · verde = oculare</span>
    </div>

    <ol class="space-y-3">${passi}</ol>`;
}

// Le stelle buone per sincronizzare: luminose, alte abbastanza da non
// ballare nella foschia, e — dalla seconda in poi — lontane da quelle già
// usate, perché è la distanza fra le due che raddrizza la bussola.
function telStelleSincronizzazione(quante) {
  const usate = tel.tubo.allineamenti;
  return telOggettiOra()
    .filter(o => (o.gruppo === 'stelle' || o.gruppo === 'pianeti') && o.alt > 20 && (o.mag == null || o.mag < 2.2))
    .map(o => {
      const v = telVersore(o.az, o.alt);
      const base = usate.length ? Math.min.apply(null, usate.map(a => telSeparazione(a.v, v))) : null;
      return Object.assign({}, o, { base });
    })
    // Una stella a due gradi da una già usata non aggiunge nulla e rischia
    // di peggiorare il conto: fuori.
    .filter(o => o.base == null || o.base > 12)
    .sort((a, b) => (b.base || 0) - (a.base || 0) || a.mag - b.mag)
    .slice(0, quante || 6);
}

function telHtmlTubo(bersaglio) {
  const p = telProfilo();
  const spinta = p.montatura === 'eq' ? 'le due manopole' : 'il tubo con le mani';

  const intro = `<p class="text-sm text-slate-300">È il puntamento assistito delle app famose, fatto con quello che
    hai già: fissa il telefono al tubo con l'adattatore che sta nella scatola, centra una stella nota e premi
    <em>Sono su questa stella</em>. Da quel momento il telefono sa dove guarda il tubo, e mentre muovi ${spinta}
    ti dice quanto manca al bersaglio — con un pallino che si avvicina al centro e un battito che si infittisce.</p>`;

  if (!tel.tubo.attivo) {
    return intro + `
      <ul class="mt-3 text-xs text-slate-400 space-y-1">
        <li>· Il telefono va <strong class="text-slate-200">solidale al tubo</strong>: se scivola, l'allineamento è da rifare.</li>
        <li>· Lontano da calamite e dal contrappeso: il ferro sposta la bussola.</li>
        <li>· Non serve nessun cavo e nessuna montatura motorizzata.</li>
      </ul>
      <button id="tel-avvia-tubo" class="mt-3 px-4 py-2 rounded-full text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white">Accendi il push-to</button>`;
  }

  const modello = tel.tubo.modello;
  const stelle = telStelleSincronizzazione(6);
  const bottoniStelle = stelle.length
    ? `<div class="flex flex-wrap gap-2">
        ${stelle.map(s => `<button data-tel-allinea-tubo="${s.id}"
          class="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-700 hover:bg-green-600 text-white">
          Sono su ${s.nome.split(' — ')[0]}
          <span class="opacity-70">${Math.round(s.alt)}°${s.base != null ? ` · ${Math.round(s.base)}° dalla prima` : ''}</span>
        </button>`).join('')}
      </div>`
    : '<p class="text-xs text-slate-500">Nessuna stella adatta abbastanza alta e abbastanza lontana da quelle già usate.</p>';

  // --- Non ancora allineato --------------------------------------------
  if (!modello) {
    return intro + `
      <div class="mt-3 bg-slate-900 rounded-xl border border-blue-800 p-4">
        <p class="text-sm text-white font-semibold mb-1">Passo 1: dimmi dove sei puntato adesso.</p>
        <p class="text-xs text-slate-400 mb-3">Centra una di queste stelle nell'oculare — meglio in quello più
          largo, e poi rifinisci — e premi il suo nome. Non serve che sia precisa al secondo d'arco: serve che
          sia quella giusta.</p>
        ${bottoniStelle}
      </div>
      <button id="tel-spegni-tubo" class="mt-3 text-xs text-slate-400 underline hover:text-slate-200">Spegni il push-to</button>`;
  }

  // --- Allineato: la guida vera ----------------------------------------
  const qualita = telQualitaPushTo(modello);

  const secondaStella = modello.punti < 2 ? `
    <div class="mt-3 bg-slate-900 rounded-xl border border-amber-900 p-4">
      <p class="text-sm text-amber-300 font-semibold mb-1">Aggiungi una seconda stella: è il passo che raddoppia la precisione.</p>
      <p class="text-xs text-slate-400 mb-3">Con una stella sola l'app deve credere alla bussola del telefono, che
        sbaglia di qualche grado. Con due stelle <strong class="text-slate-200">lontane fra loro</strong> l'errore
        della bussola viene calcolato e tolto: si passa da "dentro il cercatore" a "dentro l'oculare". Centra
        un'altra stella e premi il suo nome.</p>
      ${bottoniStelle}
    </div>` : `
    <details class="mt-3">
      <summary class="cursor-pointer text-xs text-blue-400 hover:text-blue-300">Aggiungi un'altra stella (migliora ancora)</summary>
      <div class="mt-2">${bottoniStelle}</div>
    </details>`;

  return intro + `
    <div id="tel-guida-tubo" class="mt-3 bg-slate-900 rounded-2xl border border-slate-700 p-4">
      <p class="text-sm text-slate-400">In attesa dei sensori…</p>
    </div>

    <div class="mt-3 text-xs ${qualita.colore}">${qualita.testo}</div>

    ${secondaStella}

    <div class="flex flex-wrap gap-2 mt-3">
      <button id="tel-sincronizza-qui" class="px-4 py-2 rounded-full text-sm font-semibold bg-green-700 hover:bg-green-600 text-white"
        title="Da usare quando hai il bersaglio centrato: sincronizza qui e il prossimo salto parte preciso">
        Ce l'ho centrato: sincronizza qui</button>
      <button id="tel-azzera-tubo" class="px-4 py-2 rounded-full text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white">Riparti da zero</button>
      <button id="tel-spegni-tubo" class="px-4 py-2 rounded-full text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white">Spegni</button>
    </div>

    <div class="flex flex-wrap gap-2 mt-2">
      <button id="tel-pushto-vibra" class="px-3 py-1.5 rounded-full text-xs font-semibold ${p.pushtoVibra ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}">
        Vibrazione ${p.pushtoVibra ? 'accesa' : 'spenta'}</button>
      <button id="tel-pushto-suono" class="px-3 py-1.5 rounded-full text-xs font-semibold ${p.pushtoSuono ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}">
        Bip ${p.pushtoSuono ? 'acceso' : 'spento'}</button>
      <span class="px-2 py-1.5 text-xs text-slate-500">Servono per puntare senza guardare lo schermo: il battito
        si infittisce mentre ti avvicini.</span>
    </div>`;
}

// Che precisione può promettere l'allineamento fatto finora. È
// l'informazione che quasi nessuna app dà, e senza la quale l'utente non
// sa se fidarsi: con una stella sola si va a fiducia sulla bussola,
// con due si può misurare l'errore residuo e dirlo.
function telQualitaPushTo(modello) {
  if (!modello) return { testo: '', colore: 'text-slate-400' };

  const stelle = modello.stelle.join(' + ');
  if (modello.punti < 2) {
    return {
      colore: 'text-slate-400',
      testo: `Allineato su <strong class="text-white">${stelle}</strong>, un punto solo: la precisione è quella
        della bussola del telefono, quindi qualche grado. Ti porta dentro il campo del cercatore.`
    };
  }

  if (modello.baseCorta) {
    return {
      colore: 'text-amber-300',
      testo: `${modello.punti} punti (${stelle}), ma tutti nella stessa zona di cielo (${Math.round(modello.base)}°
        fra i più lontani): l'errore della bussola non si può ricavare. Aggiungi una stella in una parte di cielo
        diversa — meglio ancora, dall'altra parte del meridiano.`
    };
  }

  const scarto = modello.scarto;
  const buono = scarto != null && scarto < 1.5;
  return {
    colore: buono ? 'text-green-300' : 'text-amber-300',
    testo: `${modello.punti} punti (${stelle}), base di ${Math.round(modello.base)}°. Errore della bussola
      calcolato e tolto: <strong class="text-white">${modello.theta >= 0 ? '+' : ''}${modello.theta.toFixed(1)}°</strong>.
      I punti sono coerenti entro <strong class="text-white">${scarto.toFixed(1)}°</strong>, ed è più o meno la
      precisione che puoi aspettarti.${buono ? '' : ` Se è tanto, o il supporto del telefono si è mosso, o una
      delle stelle non era quella che credevi: prova a ripartire da zero.`}`
  };
}

function telDopoPunta() {
  // La posizione si chiede sempre allo stesso modo: GPS, poi rete, poi la
  // scelta a mano. Ci pensa la finestra, che sa anche raccontarlo.
  const chiedi = document.getElementById('tel-chiedi-posizione');
  if (chiedi) chiedi.addEventListener('click', () => apriPosizione(true));

  document.querySelectorAll('[data-tel-bersaglio]').forEach(b => {
    b.addEventListener('click', () => {
      tel.bersaglio = b.dataset.telBersaglio;
      telCostruisciPannello();
    });
  });

  const cambia = document.getElementById('tel-cambia-bersaglio');
  if (cambia) cambia.addEventListener('click', () => {
    tel.bersaglio = null;
    telCostruisciPannello();
  });

  document.querySelectorAll('[data-tel-metodo]').forEach(b => {
    b.addEventListener('click', () => {
      tel.metodo = b.dataset.telMetodo;
      telSalvaSessione();
      telCostruisciPannello();
    });
  });

  const anteprima = document.getElementById('tel-anteprima');
  if (anteprima) anteprima.addEventListener('click', () => telApriAnteprima(tel.bersaglio));

  document.querySelectorAll('[data-tel-riferimento]').forEach(b => {
    b.addEventListener('click', () => {
      const o = telOggettiOra().find(x => x.id === b.dataset.telRiferimento);
      if (o) telFissaRiferimento(o);
      telCostruisciPannello();
    });
  });

  const ricalcola = document.getElementById('tel-ricalcola');
  if (ricalcola) ricalcola.addEventListener('click', () => telCostruisciPannello());

  const nuovo = document.getElementById('tel-nuovo-riferimento');
  if (nuovo) nuovo.addEventListener('click', () => {
    tel.riferimento = null;
    telSalvaSessione();
    telCostruisciPannello();
  });

  // "Sono arrivato": il bersaglio appena centrato diventa il nuovo
  // riferimento, così gli errori non si sommano di salto in salto.
  const qui = document.getElementById('tel-riferimento-qui');
  if (qui) qui.addEventListener('click', () => {
    const b = telBersaglioCorrente();
    if (b) telFissaRiferimento(b);
    telCostruisciPannello();
  });

  // La carta dei salti
  const tela = document.getElementById('tel-tela-salti');
  const bersaglio = telBersaglioCorrente();
  if (tela && bersaglio) {
    const p = telProfilo();
    const percorso = telPercorsoSalti(bersaglio);
    const capovolto = tel.saltiCapovolti != null ? tel.saltiCapovolti : (TEL_TIPI[p.tipo] || {}).rotazione === 180;
    // Il cerchio verde è l'oculare con cui si cerca, cioè il più largo
    const combinazione = telCombinazioni(p).find(c => !c.vuoto);
    if (percorso && percorso.partenza) {
      // Il campo inquadrato tiene dentro tutto il percorso più un margine,
      // ma non meno di un campo di cercatore: se no il cerchio azzurro
      // esce dal disegno e non si capisce più la scala.
      const campo = Math.max(percorso.totale * 2.2, percorso.cercatore.campo * 1.3);
      const centro = {
        ra: (percorso.partenza.ra + bersaglio.ra) / 2,
        dec: (percorso.partenza.dec + bersaglio.dec) / 2
      };
      telDisegnaCampoCielo(tela, {
        centro,
        campo,
        rotazione: capovolto ? 180 : 0,
        campoCercatore: percorso.cercatore.campo,
        campoOculare: combinazione ? combinazione.campoReale : null,
        salti: percorso.salti,
        partenza: percorso.partenza,
        bersaglio
      });
    }
  }

  const ruota = document.getElementById('tel-ruota-carta');
  if (ruota) ruota.addEventListener('click', () => {
    const p = telProfilo();
    const attuale = tel.saltiCapovolti != null ? tel.saltiCapovolti : (TEL_TIPI[p.tipo] || {}).rotazione === 180;
    tel.saltiCapovolti = !attuale;
    telCostruisciPannello();
  });

  // --- Il push-to col telefono sul tubo ---------------------------------
  const avviaTubo = document.getElementById('tel-avvia-tubo');
  if (avviaTubo) avviaTubo.addEventListener('click', async () => {
    // Il contesto audio nasce qui, dentro il gesto: dopo non si potrebbe più
    telPreparaAudio();
    avviaTubo.textContent = 'Attivo i sensori…';
    const ok = await skyRichiediSensori();
    if (!ok) {
      avviaTubo.textContent = 'Sensori non disponibili';
      avviaTubo.insertAdjacentHTML('afterend',
        `<p class="text-xs text-amber-300 mt-2">Senza il permesso ai sensori di movimento il push-to non può
         funzionare. Su iPhone si concede da Impostazioni → Safari → Movimento e orientamento; restano i cerchi
         graduati e i salti di stella.</p>`);
      return;
    }
    tel.tubo.attivo = true;
    telCostruisciPannello();
  });

  document.querySelectorAll('[data-tel-allinea-tubo]').forEach(b => {
    b.addEventListener('click', () => {
      const o = telOggettiOra().find(x => x.id === b.dataset.telAllineaTubo);
      if (o && telAllineaTubo(o)) telCostruisciPannello();
    });
  });

  // "Ce l'ho centrato": il bersaglio appena inquadrato diventa un punto di
  // sincronizzazione in più. È il modo con cui il push-to migliora da solo
  // andando avanti nella serata, invece di peggiorare.
  const sincronizza = document.getElementById('tel-sincronizza-qui');
  if (sincronizza) sincronizza.addEventListener('click', () => {
    const b = telBersaglioCorrente();
    if (b && telAllineaTubo(b)) telCostruisciPannello();
  });

  const azzeraTubo = document.getElementById('tel-azzera-tubo');
  if (azzeraTubo) azzeraTubo.addEventListener('click', () => {
    telAzzeraAllineamentoTubo();
    telCostruisciPannello();
  });

  document.querySelectorAll('#tel-spegni-tubo').forEach(b => {
    b.addEventListener('click', () => {
      telFermaTubo();
      tel.tubo.attivo = false;
      if (typeof skyRilasciaSchermo === 'function' && !sky.aperto) skyRilasciaSchermo();
      telCostruisciPannello();
    });
  });

  const vibra = document.getElementById('tel-pushto-vibra');
  if (vibra) vibra.addEventListener('click', () => {
    const p = telProfilo();
    p.pushtoVibra = !p.pushtoVibra;
    if (p.pushtoVibra) telVibra(30);
    telSalvaProfilo();
    telCostruisciPannello();
  });

  const suono = document.getElementById('tel-pushto-suono');
  if (suono) suono.addEventListener('click', () => {
    const p = telProfilo();
    p.pushtoSuono = !p.pushtoSuono;
    if (p.pushtoSuono) { telPreparaAudio(); telBip(880, 0.1); }
    telSalvaProfilo();
    telCostruisciPannello();
  });

  if (tel.tubo.attivo && tel.tubo.modello) telAvviaTubo();
}

// Il ciclo che aggiorna la guida: gira solo quando serve, e a 10 volte al
// secondo — i sensori non danno di meglio e la batteria ringrazia. La
// struttura HTML si scrive una volta sola e poi si aggiornano i pezzi che
// cambiano: riscrivere tutto dieci volte al secondo farebbe sfarfallare
// la tela e perdere i tasti sotto il dito.
function telAvviaTubo() {
  telFermaTubo();
  const p = telProfilo();
  const cercatore = TEL_CERCATORI[p.cercatore] || TEL_CERCATORI.reddot;
  // Il campo con cui si cerca è quello dell'oculare più largo: è il
  // traguardo vero della manovra, non quello dell'oculare che si userà
  // dopo per guardare l'oggetto.
  const larga = telCombinazioni(p).find(c => !c.vuoto);
  const campoOculare = larga ? larga.campoReale : 0;

  const aggiorna = () => {
    const box = document.getElementById('tel-guida-tubo');
    if (!box) { telFermaTubo(); return; }
    const bersaglio = telBersaglioCorrente();
    const guida = telGuidaVersoBersaglio(bersaglio);

    if (!box.dataset.pronto) {
      box.dataset.pronto = 'si';
      box.innerHTML = `
        <div class="grid gap-3 sm:grid-cols-2 items-center">
          <canvas id="tel-tela-radar" class="block w-full rounded-xl border border-slate-700 bg-slate-950" style="height:260px"></canvas>
          <div>
            <div id="tel-radar-distanza" class="text-4xl font-bold text-white text-center leading-none">—</div>
            <div id="tel-radar-stato" class="text-xs text-slate-400 mt-2 text-center">&nbsp;</div>
            <div id="tel-radar-assi" class="mt-3"></div>
          </div>
        </div>
        <p id="tel-radar-piede" class="mt-3 text-xs text-slate-500 text-center">&nbsp;</p>`;
    }

    const tela = document.getElementById('tel-tela-radar');
    const distanza = document.getElementById('tel-radar-distanza');
    const stato = document.getElementById('tel-radar-stato');
    const assi = document.getElementById('tel-radar-assi');
    const piede = document.getElementById('tel-radar-piede');

    if (!guida) {
      telDisegnaRadar(tela, null);
      if (distanza) distanza.textContent = '—';
      if (stato) stato.innerHTML = '<span class="text-amber-400">Sensori fermi: muovi il telefono, o controlla i permessi.</span>';
      return;
    }

    telDisegnaRadar(tela, guida, {
      campoCercatore: cercatore.campo,
      campoOculare,
      nome: bersaglio ? bersaglio.nome.split(' — ')[0] : null
    });

    const nellOculare = campoOculare ? guida.separazione < campoOculare / 2 : guida.separazione < 0.4;
    if (distanza) {
      distanza.textContent = telAngoloTesto(guida.separazione);
      distanza.className = `text-4xl font-bold text-center leading-none ${nellOculare ? 'text-green-400' : (guida.dentroCercatore ? 'text-amber-300' : 'text-white')}`;
    }
    if (stato) {
      stato.innerHTML = nellOculare
        ? `<span class="text-green-300 font-semibold">Ce l'hai nell'oculare da ${larga ? Math.round(larga.ingrandimento) : ''}×: guarda.</span>`
        : (guida.dentroCercatore
          ? `Dentro il campo del ${cercatore.nome.toLowerCase()}: cercalo, poi rifinisci piano.`
          : 'Muovi seguendo la linea del radar.');
    }

    if (assi) {
      if (guida.dHA != null) {
        assi.innerHTML = `
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-slate-950 rounded-xl border border-slate-700 p-2 text-center">
              <div class="text-xs text-slate-400">Ascensione retta</div>
              <div class="text-lg font-mono font-bold text-white">${telOreTesto(guida.dHA).replace('+', '')}</div>
              <div class="text-xs text-blue-300">verso ${guida.versoRA}</div>
            </div>
            <div class="bg-slate-950 rounded-xl border border-slate-700 p-2 text-center">
              <div class="text-xs text-slate-400">Declinazione</div>
              <div class="text-lg font-mono font-bold text-white">${Math.abs(guida.dDec).toFixed(1)}°</div>
              <div class="text-xs text-amber-300">verso ${guida.versoDec}</div>
            </div>
          </div>`;
      } else if (guida.dAlt != null) {
        assi.innerHTML = `
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-slate-950 rounded-xl border border-slate-700 p-2 text-center">
              <div class="text-xs text-slate-400">Altezza</div>
              <div class="text-lg font-mono font-bold text-white">${Math.abs(guida.dAlt).toFixed(1)}°</div>
              <div class="text-xs text-amber-300">${guida.dAlt > 0 ? 'alza il tubo' : 'abbassa il tubo'}</div>
            </div>
            <div class="bg-slate-950 rounded-xl border border-slate-700 p-2 text-center">
              <div class="text-xs text-slate-400">Azimut</div>
              <div class="text-lg font-mono font-bold text-white">${Math.abs(guida.dAz).toFixed(1)}°</div>
              <div class="text-xs text-blue-300">verso ${guida.dAz > 0 ? 'destra' : 'sinistra'}</div>
            </div>
          </div>`;
      }
    }

    if (piede) {
      piede.innerHTML = `Tubo: ${Math.round(guida.altTubo)}° di altezza, ${skyNomeDirezione(guida.azTubo)} ·
        bersaglio: ${Math.round(guida.altBersaglio)}°, ${skyNomeDirezione(guida.azBersaglio)}`;
    }

    telBattitoPushTo(guida.separazione, campoOculare);
  };

  aggiorna();
  tel.tubo.timer = setInterval(aggiorna, 100);
  // Lo schermo che si spegne a metà manovra è il modo più sicuro di
  // perdere il bersaglio: finché il push-to è accesso, resta acceso.
  if (typeof skyTieniSchermoAcceso === 'function') skyTieniSchermoAcceso();
}

function telFermaTubo() {
  if (tel.tubo.timer) { clearInterval(tel.tubo.timer); tel.tubo.timer = null; }
  tel.tubo.centrato = false;
  // Un battito lasciato in coda continuerebbe a vibrare a pannello chiuso
  telVibra(0);
}

// Il battito. Puntando si ha un occhio nel cercatore e le mani sulle
// manopole: guardare lo schermo vuol dire perdere il campo. Un battito
// che si infittisce mentre ci si avvicina, e un doppio colpo quando si è
// dentro, risolvono il problema senza guardare niente. È il dettaglio
// che, in giardino, fa la differenza più di qualunque conto.
function telBattitoPushTo(separazione, campoOculare) {
  const p = telProfilo();
  if (!p.pushtoVibra && !p.pushtoSuono) return;
  const soglia = campoOculare ? campoOculare / 2 : 0.4;

  if (separazione < soglia) {
    if (!tel.tubo.centrato) {
      tel.tubo.centrato = true;
      if (p.pushtoVibra) telVibra([50, 70, 50, 70, 160]);
      if (p.pushtoSuono) { telBip(1180, 0.12); setTimeout(() => telBip(1570, 0.18), 150); }
    }
    return;
  }

  tel.tubo.centrato = false;
  // Da un battito ogni secondo e mezzo, lontano, a uno ogni decimo
  // quando ci si è quasi: la cadenza è la distanza, e l'orecchio la
  // legge meglio di un numero.
  const intervallo = Math.max(110, Math.min(1500, separazione * 90));
  const adesso = Date.now();
  if (adesso - tel.tubo.ultimoBattito < intervallo) return;
  tel.tubo.ultimoBattito = adesso;
  if (p.pushtoVibra) telVibra(22);
  if (p.pushtoSuono) telBip(420 + Math.max(0, 880 - separazione * 55), 0.05);
}

function telVibra(schema) {
  try {
    if (navigator.vibrate) navigator.vibrate(schema);
  } catch (e) { /* niente vibrazione: pazienza */ }
}

// Il contesto audio si può creare solo durante un gesto dell'utente, e si
// crea una volta sola: è il tasto che accende il push-to a farlo.
function telPreparaAudio() {
  if (tel.tubo.audio) {
    if (tel.tubo.audio.state === 'suspended') tel.tubo.audio.resume().catch(() => {});
    return;
  }
  try {
    const Contesto = window.AudioContext || window.webkitAudioContext;
    if (Contesto) tel.tubo.audio = new Contesto();
  } catch (e) { /* audio non disponibile */ }
}

function telBip(frequenza, durata) {
  const ctx = tel.tubo.audio;
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const guadagno = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequenza;
    osc.connect(guadagno);
    guadagno.connect(ctx.destination);
    const t = ctx.currentTime;
    // Attacco e coda morbidi: un'onda tagliata di netto fa "clic", e di
    // notte in un campo un clic è più fastidioso del bip.
    guadagno.gain.setValueAtTime(0.0001, t);
    guadagno.gain.exponentialRampToValueAtTime(0.12, t + 0.012);
    guadagno.gain.exponentialRampToValueAtTime(0.0001, t + durata);
    osc.start(t);
    osc.stop(t + durata + 0.03);
  } catch (e) { /* audio non disponibile */ }
}

// --- Pannello: SERATA --------------------------------------------------

function telOraTesto(data) {
  if (!data) return '—';
  return data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function telPannelloSerata() {
  const scaletta = telCostruisciScaletta();
  if (!scaletta) {
    return telHtmlScheda('Serve la posizione', `
      <p class="text-sm text-slate-300">Senza posizione non si sa né quando fa buio né cosa passa in meridiano.</p>
      <button id="tel-chiedi-posizione" class="mt-3 px-4 py-2 rounded-full text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white">Dimmi dove sono</button>
      <p class="text-xs text-slate-500 mt-2">Provo il GPS, poi la connessione; se non rispondono puoi scegliere la citt&agrave; in elenco.</p>`);
  }

  const b = scaletta.buio;
  const p = telProfilo();

  const preparazione = `
    <ol class="space-y-3 text-sm text-slate-300">
      <li class="flex gap-3">
        <span class="flex-shrink-0 text-xs font-mono text-blue-300 w-12 text-right pt-0.5">${telOraTesto(scaletta.uscita)}</span>
        <div><strong class="text-white">Porta fuori il telescopio.</strong>
          Uno specchio da ${p.apertura} mm ci mette circa ${scaletta.raffreddamento} minuti a mettersi alla
          temperatura dell'aria. Finché è più caldo, dentro al tubo si muovono correnti d'aria che fanno
          tremolare l'immagine esattamente come farebbe il cattivo seeing: si crede di avere un telescopio
          scarso, e invece è solo tiepido.</div>
      </li>
      <li class="flex gap-3">
        <span class="flex-shrink-0 text-xs font-mono text-blue-300 w-12 text-right pt-0.5">${telOraTesto(b.tramonto)}</span>
        <div><strong class="text-white">Tramonto.</strong> È il momento di allineare la montatura al polo:
          si fa meglio con ancora un po' di luce, e la Polare compare presto.</div>
      </li>
      ${b.buioInizio ? `<li class="flex gap-3">
        <span class="flex-shrink-0 text-xs font-mono text-blue-300 w-12 text-right pt-0.5">${telOraTesto(b.buioInizio)}</span>
        <div><strong class="text-white">Buio astronomico.</strong> Da qui in poi il cielo non migliora più:
          è tutto quello che il tuo posto può dare.</div>
      </li>` : ''}
      ${b.buioFine ? `<li class="flex gap-3">
        <span class="flex-shrink-0 text-xs font-mono text-blue-300 w-12 text-right pt-0.5">${telOraTesto(b.buioFine)}</span>
        <div><strong class="text-white">Comincia a schiarire.</strong></div>
      </li>` : ''}
    </ol>`;

  const rugiada = scaletta.rugiada;
  const avvisoRugiada = rugiada ? `
    <div class="mt-3 p-3 rounded-xl border ${rugiada.rischio === 'alto' ? 'bg-amber-950/40 border-amber-800' : 'bg-slate-900 border-slate-700'}">
      <p class="text-sm ${rugiada.rischio === 'alto' ? 'text-amber-300' : 'text-slate-300'}">
        <strong>Rugiada:</strong> ${rugiada.rischio === 'alto'
          ? `rischio alto${rugiada.quando ? `, da circa le ${telOraTesto(rugiada.quando)}` : ''}.`
          : (rugiada.rischio === 'medio' ? 'possibile a fine notte.' : 'improbabile stanotte.')}
        <span class="text-xs text-slate-400">Temperatura e punto di rugiada si avvicinano fino a
        ${rugiada.scartoMinimo != null ? rugiada.scartoMinimo.toFixed(1) + ' °C' : '—'} di scarto.</span>
      </p>
      ${rugiada.rischio !== 'basso' ? `<p class="text-xs text-slate-400 mt-1">Su un Newton si appanna il secondario,
        che sta in cima al tubo e guarda il cielo. Un paraluce di gommapiuma attorno alla bocca del tubo
        rimanda l'appannamento di un paio d'ore, e costa due euro.</p>` : ''}
    </div>` : '';

  const voci = scaletta.voci.slice(0, 14).map(v => {
    const o = v.oggetto;
    const disturbata = v.disturbo > 0.28;
    // Vicino alla Luna è un problema di distanza, lontano è la Luna che
    // illumina tutto il cielo: sono due avvisi diversi.
    const vicinoAllaLuna = v.separazioneLuna != null && v.separazioneLuna < 50;
    return `<li class="flex gap-3 items-start py-2 border-b border-slate-800 last:border-0">
      <span class="flex-shrink-0 text-xs font-mono text-blue-300 w-12 text-right pt-1">${telOraTesto(v.quando)}</span>
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline gap-2 flex-wrap">
          <button data-tel-vai-oggetto="${o.id}" class="text-white font-semibold hover:text-blue-300 text-left">${o.nome}</button>
          <span class="text-xs text-slate-400">${Math.round(v.alt)}° · ${skyNomeDirezione(v.az)}</span>
          ${o.allaPortata ? '' : '<span class="text-xs text-red-400">fuori portata</span>'}
        </div>
        <div class="text-xs text-slate-400 mt-0.5">
          ${v.combinazione ? `${v.combinazione.nome} → ${Math.round(v.combinazione.ingrandimento)}×` : ''}
          ${v.entra === false ? ' · <span class="text-amber-400">più grande del campo</span>' : ''}
          ${disturbata ? ` · <span class="text-amber-400">${vicinoAllaLuna
            ? `troppo vicino alla Luna (${Math.round(v.separazioneLuna)}°)`
            : 'cielo schiarito dalla Luna'}</span>` : ''}
        </div>
      </div>
    </li>`;
  }).join('');

  return `
    ${telHtmlScheda('Prima di cominciare', preparazione + avvisoRugiada)}
    ${telHtmlScheda('La scaletta di stanotte', `
      <p class="text-xs text-slate-400 mb-2">In ordine di quando ogni oggetto è più alto${scaletta.faseLuna != null
        ? ` · Luna illuminata al ${Math.round(scaletta.faseLuna * 100)}%` : ''}. Tocca un nome per portarlo nel pannello Punta.</p>
      <ul>${voci || '<li class="text-sm text-slate-400">Niente di interessante abbastanza alto stanotte.</li>'}</ul>`)}
    ${telHtmlScheda('Le regole della serata', `
      <ul class="text-sm text-slate-300 space-y-2">
        <li><strong class="text-white">Venti minuti di buio, veri.</strong> L'occhio si adatta lentamente e si
          "resetta" con un lampo di luce bianca. Schermo dell'app in modalità notte, torcia rossa, niente telefono.</li>
        <li><strong class="text-white">Comincia dal più basso a Ovest.</strong> Sta tramontando: se lo lasci per
          ultimo, non c'è più.</li>
        <li><strong class="text-white">Guarda di lato.</strong> Sulle macchie deboli la visione distolta
          (guardare a fianco dell'oggetto, non dritto) fa vedere il 30% in più: la parte sensibile della retina
          non sta al centro.</li>
        <li><strong class="text-white">Aspetta.</strong> Cinque minuti sullo stesso oggetto mostrano tre volte
          quello che si vede in dieci secondi. L'atmosfera si ferma a tratti, e in quegli attimi c'è tutto.</li>
      </ul>`)}`;
}

function telDopoSerata() {
  // La posizione si chiede sempre allo stesso modo: GPS, poi rete, poi la
  // scelta a mano. Ci pensa la finestra, che sa anche raccontarlo.
  const chiedi = document.getElementById('tel-chiedi-posizione');
  if (chiedi) chiedi.addEventListener('click', () => apriPosizione(true));

  document.querySelectorAll('[data-tel-vai-oggetto]').forEach(b => {
    b.addEventListener('click', () => {
      tel.bersaglio = b.dataset.telVaiOggetto;
      telMostraPannello('punta');
    });
  });
}

// --- Pannello: CURA ----------------------------------------------------

function telPannelloCura() {
  const p = telProfilo();
  const newton = p.tipo === 'newton';

  const figure = TEL_FIGURE_TEST.map(f => `
    <div class="text-center">
      <canvas data-tel-figura="${f.id}" class="block w-full rounded-xl border border-slate-700" style="height:120px"></canvas>
      <p class="text-xs font-semibold text-white mt-2">${f.nome}</p>
      <p class="text-xs text-slate-400 mt-1">${f.testo}</p>
    </div>`).join('');

  const passi = TEL_PASSI_COLLIMAZIONE.map((s, i) => `
    <li class="flex gap-3">
      <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">${i + 1}</span>
      <div class="text-sm">
        <strong class="text-white">${s.titolo}</strong>
        <p class="text-slate-300 mt-1">${s.testo}</p>
        <p class="text-xs text-blue-300 mt-1">→ ${s.controllo}</p>
      </div>
    </li>`).join('');

  return `
    ${telHtmlScheda('Collimazione', newton ? `
      <p class="text-sm text-slate-300">Un ${p.tipo === 'newton' ? 'Newton' : 'telescopio'} a f/${(p.focale / p.apertura).toFixed(1)}
      è veloce, e i telescopi veloci sono severi: mezzo millimetro di specchio storto e le stelle diventano cometine.
      È il motivo per cui tanti telescopi economici vengono giudicati scarsi quando invece sono solo scollimati —
      e si sistema in dieci minuti, gratis.</p>
      <ol class="mt-4 space-y-4">${passi}</ol>
      <p class="text-xs text-slate-500 mt-4">Prima di toccare le viti: fallo di giorno, con il telescopio orizzontale,
      e gira sempre poco per volta (un ottavo di giro). Se ti perdi, il primario è quasi sempre quello giusto da
      correggere per ultimo.</p>`
      : `<p class="text-sm text-slate-300">Il tuo strumento non è un Newton: la collimazione, se serve, si fa in modo
        diverso e molto più di rado. Il test stellare qui sotto vale lo stesso.</p>`)}

    ${telHtmlScheda('Il test stellare', `
      <p class="text-sm text-slate-300 mb-4">La verifica che conta si fa sul cielo: punta una stella luminosa a
      ${Math.round(Math.min(150, telIngrandimentoMassimo(p)))}× e sfocala di poco. Confronta con queste tre figure.</p>
      <div class="grid gap-4 sm:grid-cols-3">${figure}</div>
      <p class="text-xs text-slate-500 mt-4">Se gli anelli ballano e non stanno fermi mai, non è collimazione:
      è seeing (aria instabile) oppure lo specchio non è ancora arrivato in temperatura. Aspetta mezz'ora e riprova.</p>`)}

    ${telHtmlScheda('Le altre cose che rovinano una serata', `
      <ul class="text-sm text-slate-300 space-y-2">
        <li><strong class="text-white">Specchio caldo.</strong> ${telTempoRaffreddamento(p)} minuti fuori prima di iniziare.</li>
        <li><strong class="text-white">Treppiede sull'erba.</strong> Su terreno morbido ogni tocco fa ballare
          l'immagine per cinque secondi. Meglio il cemento, o affondare bene le punte.</li>
        <li><strong class="text-white">Ingrandimento troppo alto.</strong> Sopra i ${telIngrandimentoMassimo(p)}×
          l'immagine peggiora e basta. Nelle notti mediocri anche 100× sono troppi.</li>
        <li><strong class="text-white">Specchio pulito troppo spesso.</strong> Un velo di polvere toglie meno
          contrasto di un graffio. Si lava ogni qualche anno, non ogni stagione.</li>
        <li><strong class="text-white">Guardare dopo aver guardato il telefono.</strong> Bastano due secondi di
          schermo bianco per buttare via venti minuti di adattamento al buio.</li>
      </ul>`)}`;
}

function telDopoCura() {
  document.querySelectorAll('[data-tel-figura]').forEach(c => {
    const f = TEL_FIGURE_TEST.find(x => x.id === c.dataset.telFigura);
    if (f) telDisegnaTestStellare(c, f.scarto);
  });
}

// --- La finestra "cosa vedrò davvero" ----------------------------------

function telApriAnteprima(idOggetto) {
  const oggetto = telOggettiOra().find(o => o.id === idOggetto);
  const modale = document.getElementById('modale-oculare');
  if (!oggetto || !modale) return;

  const p = telProfilo();
  tel.anteprima = { oggetto, combinazione: telCombinazionePer(oggetto.dim, p).scelta };

  const titolo = document.getElementById('oculare-titolo');
  if (titolo) titolo.textContent = oggetto.nome;

  modale.classList.remove('hidden');
  telAggiornaAnteprima();
}

function telAggiornaAnteprima() {
  const a = tel.anteprima;
  if (!a) return;
  const p = telProfilo();
  const tela = document.getElementById('oculare-tela');
  if (tela) telDisegnaOculare(tela, a.oggetto, a.combinazione);

  const scelta = document.getElementById('oculare-scelta');
  if (scelta) {
    scelta.innerHTML = telCombinazioni(p).filter(c => !c.vuoto).map(c =>
      `<button data-tel-oculare-scelto="${c.chiave}"
        class="px-3 py-1.5 rounded-full text-xs font-semibold ${a.combinazione && a.combinazione.chiave === c.chiave ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}">
        ${Math.round(c.ingrandimento)}×</button>`).join('');
    scelta.querySelectorAll('[data-tel-oculare-scelto]').forEach(b => {
      b.addEventListener('click', () => {
        a.combinazione = telCombinazioni(p).find(c => c.chiave === b.dataset.telOculareScelto);
        telAggiornaAnteprima();
      });
    });
  }

  const testo = document.getElementById('oculare-testo');
  if (!testo) return;

  const verdetto = telVerdettoOggetto(a.oggetto, a.combinazione, p);
  const contrasto = telContrastoOggetto(a.oggetto, a.combinazione, p);
  const aspetto = a.oggetto.aspetto;
  const entra = a.oggetto.dim ? a.combinazione.campoRealeMin >= a.oggetto.dim : true;
  const colori = { si: 'text-green-400', forse: 'text-amber-400', no: 'text-red-400' };

  testo.innerHTML = `
    <p class="text-sm ${colori[verdetto.esito]} font-semibold">${verdetto.testo}</p>
    ${aspetto && aspetto.aspetto ? `<p class="text-sm text-slate-300 mt-2">${aspetto.aspetto}</p>` : ''}
    <div class="griglia-sintesi mt-3">
      ${telHtmlSintesi(`${Math.round(a.combinazione.ingrandimento)}×`, 'ingrandimento')}
      ${telHtmlSintesi(telAngoloTesto(a.combinazione.campoReale), 'campo inquadrato')}
      ${telHtmlSintesi(a.oggetto.dim ? telAngoloTesto(a.oggetto.dim / 60) : '—', 'dimensione oggetto')}
      ${telHtmlSintesi(entra ? 'sì' : 'no', 'entra nel campo', entra ? 'text-green-400' : 'text-amber-400')}
    </div>
    ${contrasto.cielo ? `<p class="text-xs text-slate-400 mt-3">Disegnato per un cielo
      «${contrasto.cielo.nome}» (magnitudine limite ${contrasto.cielo.magLimite} a occhio nudo).
      ${contrasto.cielo.nota} Cambia il cielo nel pannello Strumento per vedere come cambia.</p>` : ''}
    <p class="text-xs text-slate-500 mt-2">Nessun colore: al buio l'occhio umano vede in bianco e nero, e i coni
      che distinguono i colori non si accendono per una macchia così debole. Le fotografie sono vere, ma sono
      somme di ore di posa: quello che vedi all'oculare è questo, ed è dal vivo.</p>`;
}

function telInizializzaAnteprima() {
  const modale = document.getElementById('modale-oculare');
  if (!modale) return;
  const chiudi = () => modale.classList.add('hidden');
  const btn = document.getElementById('btn-chiudi-oculare');
  if (btn) btn.addEventListener('click', chiudi);
  const btnBasso = document.getElementById('btn-chiudi-oculare-basso');
  if (btnBasso) btnBasso.addEventListener('click', chiudi);
  modale.addEventListener('click', e => { if (e.target === modale) chiudi(); });
}

// =====================================================================
// 9. AVVIO E AGGANCI CON IL RESTO DELL'APP
// =====================================================================

function telCostruisciVista() {
  const barra = document.getElementById('telescopio-pannelli');
  if (barra && !barra.dataset.pronto) {
    barra.innerHTML = TEL_PANNELLI.map(p =>
      `<button data-tel-pannello="${p.id}" title="${p.sottotitolo}"
        class="px-3 py-2 rounded-full text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200">${p.nome}</button>`).join('');
    barra.dataset.pronto = 'si';
    barra.querySelectorAll('[data-tel-pannello]').forEach(b => {
      b.addEventListener('click', () => telMostraPannello(b.dataset.telPannello));
    });
  }
  telMostraPannello(tel.pannello);
}

function telChiudiVista() {
  telFermaTubo();
  telFermaSensori();
  telFermaCronometro();
  // Lo schermo lo tiene acceso anche la vista Cielo: si rilascia solo se
  // non è lei ad averlo chiesto.
  if (typeof skyRilasciaSchermo === 'function' && typeof sky !== 'undefined' && !sky.aperto) skyRilasciaSchermo();
  if (tel.tele.polare) { clearInterval(tel.tele.polare); tel.tele.polare = null; }
}

// Il mirino del polo celeste nella vista Cielo. È un aggancio: la vista
// Cielo lo chiama a ogni fotogramma, e se il telescopio non serve non
// disegna niente.
function telDisegnaPoloSuCielo(ctx, base, focale) {
  if (typeof sky === 'undefined' || !sky.mostraPolo || !sky.observer) return;
  const polo = telPoloCeleste();
  if (!polo) return;

  const v = skyVettore(polo.az, polo.alt);
  const p = skyProietta(v, base, focale);

  if (p.davanti) {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.px, p.py, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(p.px, p.py, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(p.px - 24, p.py); ctx.lineTo(p.px - 18, p.py);
    ctx.moveTo(p.px + 18, p.py); ctx.lineTo(p.px + 24, p.py);
    ctx.moveTo(p.px, p.py - 24); ctx.lineTo(p.px, p.py - 18);
    ctx.moveTo(p.px, p.py + 18); ctx.lineTo(p.px, p.py + 24);
    ctx.stroke();

    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = '#7dd3fc';
    ctx.textAlign = 'center';
    ctx.fillText('POLO CELESTE', p.px, p.py - 38);
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(125,211,252,0.8)';
    ctx.fillText('punta qui l\'asse della montatura', p.px, p.py + 46);
    ctx.restore();
  }

  // La Polare, per capire di quanto è spostata rispetto al polo
  const polare = telPolareAltAz();
  if (polare) {
    const pp = skyProietta(skyVettore(polare.az, polare.alt), base, focale);
    if (pp.davanti && p.davanti) {
      ctx.save();
      ctx.strokeStyle = 'rgba(253,230,138,0.7)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(p.px, p.py);
      ctx.lineTo(pp.px, pp.py);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function telInizializza() {
  telCaricaProfilo();
  telCaricaSessione();
  telInizializzaAnteprima();

  // Il tasto del polo celeste nella vista Cielo
  const btnPolo = document.getElementById('skymap-btn-polo');
  if (btnPolo) btnPolo.addEventListener('click', () => {
    sky.mostraPolo = !sky.mostraPolo;
    btnPolo.className = `px-3 py-1.5 rounded-full ${sky.mostraPolo ? 'bg-blue-700 hover:bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'} text-white font-semibold`;
  });

  // Il ridisegno delle tele quando cambia la misura dello schermo
  window.addEventListener('resize', () => {
    if (vistaAttuale === 'telescopio') telCostruisciPannello();
  });
}

// L'avvio vero avviene quando il resto dell'app è pronto: questo file
// viene caricato dopo app.js, quindi il DOMContentLoaded è già passato
// oppure sta per arrivare.
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', telInizializza);
} else {
  telInizializza();
}

