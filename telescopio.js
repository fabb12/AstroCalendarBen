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
// Le sezioni, nell'ordine in cui servono davvero in giardino:
//   1. Il profilo dello strumento e l'ottica (ingrandimenti, campi)
//   2. Allineamento polare: il polo, la Polare, la deriva
//   3. Puntamento: cerchi graduati digitali, salti di stella, telefono
//      sul tubo
//   4. La serata: scaletta, raffreddamento, rugiada
//   5. Manutenzione: collimazione e test stellare
//   6. "Cosa vedrò davvero": l'anticipo onesto all'oculare
//   7. La vista e i suoi pannelli
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
  cielo: 5
};

// Stato del modulo. Tutto quello che deve sopravvivere alla chiusura
// dell'app sta in `profilo`; il resto è roba della serata in corso.
const tel = {
  profilo: null,
  pannello: 'strumento',
  // Allineamento polare
  deriva: { misure: [], inCorso: null, stella: null },
  // Cerchi graduati digitali
  riferimento: null,        // { ra, dec, nome, quando }
  bersaglio: null,          // oggetto scelto come prossimo target
  // Telefono sul tubo
  tubo: {
    attivo: false,
    versore: null,          // asse del tubo nel sistema del telefono
    orient: null,
    ascolto: null,
    raf: null,
    ultimoAvviso: 0
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
//    Tre modi di arrivare sull'oggetto, dal più semplice al più
//    tecnologico. Nessuno dei tre richiede di comprare niente.
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
//    c) Il telefono sul tubo: l'adattatore per smartphone è già nella
//       scatola. Attaccato al tubo, il telefono diventa un inclinometro
//       e una bussola, e l'app dice in tempo reale quanto manca.
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

// --- c) Il telefono sul tubo -------------------------------------------
//
//    L'adattatore per lo smartphone serve a fotografare, ma il telefono
//    che ci sta sopra ha dentro tre giroscopi e un magnetometro. Fissato
//    al tubo, sa dove sta guardando il tubo.
//
//    Il trucco dell'allineamento sta tutto in una riga: non serve sapere
//    *come* è montato il telefono. Basta centrare una stella e dire
//    "adesso". Da lì si ricava l'asse del tubo espresso negli assi del
//    telefono (u = Rᵀ·v) e da quel momento la direzione del tubo è R·u,
//    comunque sia stato attaccato il supporto.
//
//    La precisione è quella di una bussola da telefono: due o tre gradi.
//    Non basta per centrare l'oculare da 4 mm, ma porta dentro il campo
//    del cercatore, che è il 90% della fatica.

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

// Si centra una stella nell'oculare e si preme il tasto: da qui l'app sa
// come è orientato il telefono rispetto al tubo.
function telAllineaTubo(oggetto, data) {
  const R = telMatriceTelefono();
  if (!R || !oggetto) return false;
  const obs = osservatoreCorrente();
  if (!obs) return false;
  const quando = data || new Date();
  const hor = altAzCoordinate(oggetto.ra, oggetto.dec, quando, obs);
  const v = telVersore(hor.az, hor.alt);
  tel.tubo.versore = telApplicaTrasposta(R, v);
  tel.tubo.stella = oggetto.nome;
  tel.tubo.quando = quando.getTime();
  return true;
}

// Dove sta guardando il tubo adesso
function telDirezioneTubo() {
  if (!tel.tubo.versore) return null;
  const R = telMatriceTelefono();
  if (!R) return null;
  const v = telNormalizza(telApplicaMatrice(R, tel.tubo.versore));
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

  const guida = {
    separazione,
    altBersaglio: hor.alt,
    azBersaglio: hor.az,
    altTubo: tubo.alt,
    azTubo: tubo.az,
    dentroCercatore: separazione <= (TEL_CERCATORI[p.cercatore] || TEL_CERCATORI.reddot).campo / 2
  };

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
      misure: tel.deriva.misure
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
  { id: 'allineamento', nome: 'Allineamento', sottotitolo: 'Puntare l\'asse al polo, in 6 passi' },
  { id: 'punta',       nome: 'Punta',       sottotitolo: 'Coordinate AR e Dec, cerchi graduati, salti di stella' },
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

  // Il ciclo del telefono sul tubo gira solo nel pannello che lo usa
  if (tel.pannello !== 'punta') telFermaTubo();

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

  // Il cercatore ottico capovolge l'immagine: la stessa istruzione detta
  // "in alto a sinistra" a occhio diventa "in basso a destra" dentro il
  // cercatore. Sbagliare questo verso raddoppia l'errore invece di
  // azzerarlo, ed è il motivo per cui tanti allineamenti peggiorano.
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
      ${telHtmlSintesi(`${Math.round(bussola)}°`, 'la bussola deve segnare')}
      ${telHtmlSintesi(orologio ? `${orologio.distanzaMin.toFixed(0)}′` : '—', 'la Polare è larga così dal polo')}
      ${telHtmlSintesi(polare ? `${polare.alt.toFixed(1)}°` : '—', 'altezza della Polare ora')}
    </div>
    <p class="mt-3 text-xs text-slate-400">Per guardare e basta, puntare l'asse <em>sulla</em> Polare è già
    abbastanza${autonomiaSenzaQuadrante ? `: a ${Math.round(larga.ingrandimento)}× un oggetto centrato ti resta
    nel campo per circa ${Math.round(autonomiaSenzaQuadrante)} minuti` : ''}. Il passo 6 qui sotto serve
    per gli alti ingrandimenti e per le foto.</p>`);

  // --- I passi ---------------------------------------------------------
  const passo = (n, titolo, corpo) => `
    <li class="flex gap-3">
      <span class="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">${n}</span>
      <div><strong class="text-white">${titolo}</strong><br>${corpo}</div>
    </li>`;

  const passi = `
    <p class="text-sm text-slate-300 mb-3">Si fa una volta sola, a inizio serata, e dura tre minuti.
    <strong class="text-white">Regola d'oro:</strong> qui si muovono solo il treppiede e la vite di elevazione.
    Le due manopole di ascensione retta e declinazione, in questa fase, non si toccano mai.</p>
    <ol class="space-y-3 text-sm text-slate-300">
      ${passo(1, 'Treppiede in piano, gamba «N» verso nord.',
        `Allarga le gambe alla stessa altezza e blocca. Se la testa parte storta, tutto il resto è tempo perso.`)}
      ${passo(2, `Scala della latitudine su ${l.lat.toFixed(1)}°.`,
        `È il settore graduato sul fianco della testa, con l'indice che scorre sui gradi. Si muove allentando la
         vite di elevazione (sulla EQ3 sono due, una davanti e una dietro: allenti una e stringi l'altra).
         Poi ristringi tutt'e due.`)}
      ${passo(3, `Ruota tutta la montatura finché la bussola segna ${Math.round(bussola)}°.`,
        `Ruoti il treppiede intero, non la montatura sul treppiede. Quei ${Math.round(bussola)}° non sono un errore:
         la bussola punta al Nord magnetico, che qui sta ${declinazione > 0 ? 'a Est' : 'a Ovest'} di quello vero
         di ${Math.abs(declinazione).toFixed(1)}°, e il polo celeste sta sul Nord <em>vero</em>.
         <button id="tel-vai-cielo" class="underline text-blue-400 hover:text-blue-300">Verifica in realtà aumentata</button>:
         nella vista Cielo compare un mirino sul punto esatto.`)}
      ${passo(4, 'Metti la declinazione a +90° e il contrappeso in basso.',
        `<span class="text-amber-300">È il passo che manca su tutti i manuali, ed è quello che fa fallire l'allineamento.</span>
         Con la declinazione a +90° il tubo diventa parallelo all'asse polare: da quel momento
         <strong class="text-white">quello che vedi nel cercatore è esattamente dove guarda l'asse</strong>, e puoi
         allinearlo guardando invece di indovinare. Se il cerchio di declinazione non è tarato, mettilo a occhio:
         il tubo dev'essere parallelo al corpo dell'asse polare. Poi blocca le due manopole.`)}
      ${passo(5, 'Trova la Polare nel cercatore.',
        `Adesso è alta <strong class="text-white">${polare ? polare.alt.toFixed(1) : l.lat.toFixed(1)}°</strong>
         sull'orizzonte, esattamente a Nord. Se non la vedi, muovi <em>solo</em> elevazione e treppiede finché
         non entra nel campo del ${cercatore.nome.toLowerCase()} (${cercatore.campo}° di cielo).`)}
      ${orologio
        ? passo(6, `Sposta il centro di ${orologio.distanzaMin.toFixed(0)}′ ${versoNelCercatore}.`,
          `La Polare non va messa al centro: al centro ci va il polo, che adesso sta
           <strong class="text-amber-300">${versoNelCercatore}</strong> rispetto a lei${cercatore.dritta ? '' : ' <em>(verso già ribaltato per il tuo cercatore ottico)</em>'}.
           Quanto? ${orologio.distanzaMin.toFixed(0)}′, cioè ${orologio.lune.toFixed(1)} Lune piene in fila: sul
           disegno qui sotto è dove sta la croce azzurra. Salta questo passo e ti resta mezzo grado di errore —
           per guardare va bene, per fotografare no.`)
        : passo(6, 'Scosta il centro di mezzo grado dalla Polare.',
          `La Polare non va messa al centro: gira attorno al polo a circa 38′ di distanza, e il centro va messo
           sul polo. In che direzione dipende dall'ora: il disegno qui sotto lo dice, appena il calcolo è
           disponibile.`)}
    </ol>`;

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
        `Il Nord magnetico e quello vero qui distano ${Math.abs(declinazione).toFixed(1)}°: la bussola deve segnare
         <strong class="text-white">${Math.round(bussola)}°</strong>, non 0°. E tienila lontana dal telescopio:
         il tubo è di acciaio e se la porta dove vuole lui.`)}
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
    ${telHtmlScheda('Allineare in 6 passi', passi)}
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
  const tela = document.getElementById('tel-tela-polare');
  if (tela) {
    const disegna = () => telDisegnaOrologioPolare(tela, telOrologioPolare());
    disegna();
    // La Polare gira di un grado ogni quattro minuti: ridisegnare ogni
    // mezzo minuto basta e avanza.
    clearInterval(tel.tele.polare);
    tel.tele.polare = setInterval(() => {
      if (document.getElementById('tel-tela-polare')) disegna();
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
    ? telHtmlScheda('Come arrivarci', `<p class="text-sm text-slate-300">
        ${bersaglio.nome.split(' — ')[0]} si vede a occhio nudo (magnitudine ${bersaglio.mag.toFixed(1)}):
        non serve nessun percorso. Guarda ${skyNomeDirezione(bersaglio.az)} a ${Math.round(bersaglio.alt)}° di altezza,
        mettilo nel punto rosso del cercatore e sei già nel campo dell'oculare più largo.</p>`)
    : telHtmlScheda('Con i salti di stella', telHtmlSalti(bersaglio));

  return `
    ${telHtmlScheda(bersaglio.nome, scheda)}
    ${telHtmlScheda('Coordinate per le manopole', telHtmlManopole(bersaglio))}
    ${telHtmlScheda('Usare i cerchi graduati, passo per passo', telHtmlCerchi(bersaglio))}
    ${salti}
    ${telHtmlScheda('Con il telefono sul tubo', telHtmlTubo(bersaglio))}`;
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

function telHtmlTubo(bersaglio) {
  const p = telProfilo();
  const stelle = telOggettiOra()
    .filter(o => o.gruppo === 'stelle' && o.alt > 20)
    .sort((a, b) => a.mag - b.mag)
    .slice(0, 6);

  const intro = `<p class="text-sm text-slate-300">L'adattatore per lo smartphone è già nella scatola del telescopio.
    Fissa il telefono al tubo, centra una stella nell'oculare, premi <em>Sono su questa stella</em>: da quel momento
    il telefono sa dove guarda il tubo e ti dice quanto manca al bersaglio, in tempo reale.</p>
    <p class="text-xs text-slate-500 mt-2">Precisione realistica: 2–3°, quella di una bussola da telefono.
    Non basta per centrare l'oculare da ${p.oculari[p.oculari.length - 1].focale} mm, ma ti porta dentro il campo del
    cercatore — che è il 90% della fatica. Tieni il telefono lontano da calamite e da ferro.</p>`;

  if (!tel.tubo.attivo) {
    return intro + `<button id="tel-avvia-tubo" class="mt-3 px-4 py-2 rounded-full text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white">Accendi i sensori</button>`;
  }

  if (!tel.tubo.versore) {
    return intro + `
      <p class="text-xs text-slate-400 mt-3 mb-2">Centra una di queste stelle nell'oculare, poi premi il suo nome:</p>
      <div class="flex flex-wrap gap-2">
        ${stelle.map(s => `<button data-tel-allinea-tubo="${s.id}"
          class="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-700 hover:bg-green-600 text-white">
          Sono su ${s.nome}</button>`).join('')}
      </div>
      <button id="tel-spegni-tubo" class="mt-3 text-xs text-slate-400 underline hover:text-slate-200">Spegni i sensori</button>`;
  }

  return intro + `
    <div id="tel-guida-tubo" class="mt-3 bg-slate-900 rounded-xl border border-slate-700 p-4">
      <p class="text-sm text-slate-400">In attesa dei sensori…</p>
    </div>
    <div class="flex flex-wrap gap-2 mt-3">
      <button id="tel-riallinea-tubo" class="px-4 py-2 rounded-full text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white">Riallinea su un'altra stella</button>
      <button id="tel-spegni-tubo" class="px-4 py-2 rounded-full text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white">Spegni</button>
    </div>`;
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

  // Il telefono sul tubo
  const avviaTubo = document.getElementById('tel-avvia-tubo');
  if (avviaTubo) avviaTubo.addEventListener('click', async () => {
    avviaTubo.textContent = 'Attivo i sensori…';
    const ok = await skyRichiediSensori();
    if (!ok) {
      avviaTubo.textContent = 'Sensori non disponibili';
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

  const riallinea = document.getElementById('tel-riallinea-tubo');
  if (riallinea) riallinea.addEventListener('click', () => {
    tel.tubo.versore = null;
    telCostruisciPannello();
  });

  document.querySelectorAll('#tel-spegni-tubo').forEach(b => {
    b.addEventListener('click', () => {
      telFermaTubo();
      tel.tubo.attivo = false;
      telCostruisciPannello();
    });
  });

  if (tel.tubo.attivo && tel.tubo.versore) telAvviaTubo();
}

// Il ciclo che aggiorna la guida: gira solo quando serve, e a 5 volte al
// secondo — i sensori non danno di meglio e la batteria ringrazia.
function telAvviaTubo() {
  telFermaTubo();
  const aggiorna = () => {
    const box = document.getElementById('tel-guida-tubo');
    if (!box) { telFermaTubo(); return; }
    const bersaglio = telBersaglioCorrente();
    const guida = telGuidaVersoBersaglio(bersaglio);
    if (!guida) {
      box.innerHTML = '<p class="text-sm text-amber-400">Sensori fermi: muovi il telefono, o controlla i permessi.</p>';
      return;
    }

    const vicino = guida.separazione < 1.5;
    const colore = vicino ? 'text-green-400' : (guida.dentroCercatore ? 'text-amber-300' : 'text-white');

    let manopole = '';
    if (guida.dHA != null) {
      manopole = `
        <div class="grid grid-cols-2 gap-3 mt-3">
          <div class="text-center">
            <div class="text-xs text-slate-400">Ascensione retta</div>
            <div class="text-lg font-mono font-bold text-white">${telOreTesto(guida.dHA).replace('+', '')}</div>
            <div class="text-xs text-blue-300">verso ${guida.versoRA}</div>
          </div>
          <div class="text-center">
            <div class="text-xs text-slate-400">Declinazione</div>
            <div class="text-lg font-mono font-bold text-white">${Math.abs(guida.dDec).toFixed(1)}°</div>
            <div class="text-xs text-blue-300">verso ${guida.versoDec}</div>
          </div>
        </div>`;
    } else if (guida.dAlt != null) {
      manopole = `
        <div class="grid grid-cols-2 gap-3 mt-3">
          <div class="text-center">
            <div class="text-xs text-slate-400">Altezza</div>
            <div class="text-lg font-mono font-bold text-white">${Math.abs(guida.dAlt).toFixed(1)}°</div>
            <div class="text-xs text-blue-300">${guida.dAlt > 0 ? 'alza' : 'abbassa'}</div>
          </div>
          <div class="text-center">
            <div class="text-xs text-slate-400">Azimut</div>
            <div class="text-lg font-mono font-bold text-white">${Math.abs(guida.dAz).toFixed(1)}°</div>
            <div class="text-xs text-blue-300">verso ${guida.dAz > 0 ? 'destra' : 'sinistra'}</div>
          </div>
        </div>`;
    }

    box.innerHTML = `
      <div class="text-center">
        <div class="text-3xl font-bold ${colore}">${telAngoloTesto(guida.separazione)}</div>
        <div class="text-xs text-slate-400 mt-1">${vicino
          ? 'Sei sopra: guarda nell\'oculare.'
          : (guida.dentroCercatore ? 'Sei dentro il campo del cercatore.' : 'Continua a muovere.')}</div>
      </div>
      ${manopole}
      <p class="mt-3 text-xs text-slate-500 text-center">Tubo: ${Math.round(guida.altTubo)}° di altezza,
        ${skyNomeDirezione(guida.azTubo)} · bersaglio: ${Math.round(guida.altBersaglio)}°, ${skyNomeDirezione(guida.azBersaglio)}</p>`;
  };

  aggiorna();
  tel.tubo.timer = setInterval(aggiorna, 200);
}

function telFermaTubo() {
  if (tel.tubo.timer) { clearInterval(tel.tubo.timer); tel.tubo.timer = null; }
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
  telFermaCronometro();
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

