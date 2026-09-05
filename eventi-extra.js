// =====================================================================
// EVENTI CHE MANCAVANO AL CALENDARIO
//
// Astronomy Engine sa cercare molte più cose di quelle che il calendario
// mostrava. Non erano assenti per una scelta: erano semplicemente
// funzioni della libreria che nessuno aveva ancora chiamato.
//
// Qui ci sono sette famiglie nuove, e sono tutte cose che la gente
// riconosce e di cui parla:
//
//   LA SUPERLUNA. Il nome non è astronomico, è giornalistico, e proprio
//   per questo tutti lo conoscono e ogni volta qualcuno chiede «ma è
//   vero che stasera è più grande?». La risposta onesta — il quattordici
//   per cento in più della Luna piena più piccola, che a occhio non si
//   distingue senza un confronto — è più interessante della domanda.
//
//   LE OPPOSIZIONI. La notte dell'anno in cui un pianeta esterno è più
//   vicino, più luminoso e visibile tutta la notte. Per chi ha un
//   telescopio è la data che si segna sul calendario.
//
//   LE CONGIUNZIONI COL SOLE, che sono l'opposto: il pianeta sparisce
//   per settimane. Sapere perché non lo si trova più vale quanto sapere
//   quando c'è.
//
//   IL MASSIMO SPLENDORE DI VENERE, che è quando fa ombra.
//
//   I TRANSITI DI MERCURIO E VENERE sul disco del Sole: capitano poche
//   volte in una vita — quello di Venere del 2012 è l'ultimo fino al
//   2117 — e questo calendario arriva al 3000, quindi può mostrarli.
//
//   LE COMETE che diventano abbastanza luminose da uscire a vederle.
//
//   LE AURORE, che sono l'eccezione: non si calcolano, si prevedono a
//   tre giorni (il Kp del NOAA) e si aspettano nella loro stagione (gli
//   equinozi). Sono l'unica famiglia di qui dentro che non dipende dalla
//   meccanica celeste ma da cosa fa il Sole, e per questo il calendario
//   non promette mai una data: dice quando vale la pena guardare.
//
// Ordine di caricamento: dopo app.js (usa `creaEvento`, `CATEGORIE`),
// dopo `meteo-astro.js` (usa `aurora` e `latitudineGeomagnetica`).
// Il gancio è una sola riga dentro `calcolaEventiIntervallo()`.
// =====================================================================


// =====================================================================
// 1. SUPERLUNE E MICROLUNE
//
//     La Luna gira su un'ellisse: al perigeo sta a 356.500 km, all'apogeo
//     a 406.700. Fra i due estremi il disco cambia del 14% in diametro e
//     del 30% in luminosità — che sembra tanto, e a occhio non si vede
//     quasi per niente, perché non c'è nulla accanto con cui
//     confrontarlo. Su questo vale la pena essere onesti invece che
//     entusiasti: chi esce aspettandosi una Luna gigantesca torna
//     deluso, chi esce sapendo cosa guardare impara qualcosa.
// =====================================================================

// Quanto dev'essere vicino il perigeo alla Luna piena perché la cosa
// abbia senso di essere chiamata così. Oltre le ventiquattro ore la
// differenza non la vede più nessuno.
const SUPERLUNA_FINESTRA_ORE = 24;

// Le soglie di distanza. Non c'è una definizione ufficiale — è un termine
// divulgativo — ma questa (il 90% della distanza fra perigeo e apogeo) è
// quella che usano quasi tutti.
const SUPERLUNA_KM = 361863;
const MICROLUNA_KM = 405000;

function aggiungiSuperlune(inizio, fine) {
  if (typeof Astronomy === 'undefined') return;

  let apside;
  try {
    apside = Astronomy.SearchLunarApsis(new Date(inizio.getTime() - 20 * 86400000));
  } catch (e) { return; }

  let giri = 0;
  while (apside.time.date <= fine && giri++ < 2000) {
    const quando = apside.time.date;
    const perigeo = apside.kind === 0;      // 0 = perigeo, 1 = apogeo

    if (quando >= inizio && quando <= fine) {
      try {
        // La Luna piena più vicina a questo apside
        const piena = Astronomy.SearchMoonPhase(180, new Date(quando.getTime() - 20 * 86400000), 40);
        if (piena) {
          const scartoOre = Math.abs(piena.date - quando) / 3600000;
          const abbastanzaVicina = scartoOre <= SUPERLUNA_FINESTRA_ORE;
          const estrema = perigeo ? apside.dist_km <= SUPERLUNA_KM : apside.dist_km >= MICROLUNA_KM;

          if (abbastanzaVicina && estrema) {
            // Il diametro apparente, che è il numero vero della faccenda
            const primi = 2 * Math.atan(1737.4 / apside.dist_km) * 180 / Math.PI * 60;
            const controMedia = (384400 / apside.dist_km - 1) * 100;

            // I numeri sono già calcolati; le frasi si compongono quando
            // l'agenda le legge, così un cambio lingua le riscrive senza
            // rifare la ricerca dell'apside. `km` passa da `t()` e non da
            // `toLocaleString('it')`: il separatore delle migliaia è una regola
            // della lingua, e con quello cablato un'agenda inglese scriveva
            // «356.500 km» invece di «356,500 km».
            const quale = perigeo ? 'super' : 'micro';
            const L = (k, v) => astroI18n.t(`luna.${quale}.${k}`, v);
            const dati = {
              km: Math.round(apside.dist_km),
              primi: Number(primi.toFixed(1)),
              percento: Math.abs(Math.round(controMedia))
            };
            creaEvento({
              titolo: () => L('titolo'),
              dataObj: piena.date,
              categoria: 'luna',
              colore: '#e2e8f0',
              corpoCielo: 'Moon',
              strumento: 'occhio',
              spiegazione: () => L('spiegazione', dati),
              programma: () => L('programma'),
              simul: { scena: 'fase', fase: 180 }
            });
          }
        }
      } catch (e) { /* questa Luna piena non si trova: si va avanti */ }
    }

    try { apside = Astronomy.NextLunarApsis(apside); } catch (e) { return; }
  }
}


// =====================================================================
// 2. OPPOSIZIONI E CONGIUNZIONI COL SOLE
//
//     Un pianeta esterno all'opposizione sta dalla parte opposta del
//     Sole rispetto a noi: sorge al tramonto, culmina a mezzanotte,
//     tramonta all'alba. È anche il momento in cui è più vicino, quindi
//     più grande e più luminoso. Per Marte la differenza fra
//     un'opposizione e il resto dell'anno è enorme — passa da un
//     puntino a un disco con le calotte polari visibili.
//
//     Alla congiunzione col Sole è il contrario: il pianeta ci sta
//     dietro, e per settimane non si vede.
// =====================================================================

// Il nome non sta qui: lo dà `nomeCorpo(id)` di app.js, che è la sola tabella
// dei nomi del Sistema Solare che questo progetto abbia.
const EXTRA_PIANETI_ESTERNI = [
  { id: 'Mars', colore: '#f87171' },
  { id: 'Jupiter', colore: '#fbbf24' },
  { id: 'Saturn', colore: '#fcd34d' },
  { id: 'Uranus', colore: '#67e8f9' },
  { id: 'Neptune', colore: '#818cf8' }
];

// Sotto questa magnitudine un'opposizione non è una notizia per nessuno
// che non abbia un telescopio: Nettuno all'opposizione resta di ottava.
const EXTRA_OPPOSIZIONE_STRUMENTO = { Mars: 'occhio', Jupiter: 'occhio', Saturn: 'occhio',
                                      Uranus: 'binocolo', Neptune: 'telescopio' };

function aggiungiOpposizioni(inizio, fine) {
  if (typeof Astronomy === 'undefined') return;

  EXTRA_PIANETI_ESTERNI.forEach(p => {
    // --- opposizioni ---
    let quando = new Date(inizio);
    let giri = 0;
    while (giri++ < 200) {
      let t;
      try { t = Astronomy.SearchRelativeLongitude(p.id, 180, quando); } catch (e) { break; }
      if (!t || t.date > fine) break;

      try {
        const ill = Astronomy.Illumination(p.id, t);
        const distanza = ill.helio_dist;
        const geo = Astronomy.GeoVector(p.id, t, true);
        const dTerra = Math.hypot(geo.x, geo.y, geo.z);

        // Il consiglio è diverso per Marte, Saturno e Giove, e per gli altri
        // due è lo stesso: chi non ha una chiave sua legge quella generica.
        const consiglio = ['Mars', 'Saturn', 'Jupiter'].includes(p.id)
          ? `opposizione.programma.${p.id}` : 'opposizione.programma.lontani';
        const dati = { ua: Number(dTerra.toFixed(2)), mag: Number(ill.mag.toFixed(1)) };
        creaEvento({
          titolo: () => astroI18n.t('opposizione.titolo', { corpo: nomeCorpo(p.id) }),
          dataObj: t.date,
          categoria: 'pianeti',
          colore: p.colore,
          corpoCielo: p.id,
          strumento: EXTRA_OPPOSIZIONE_STRUMENTO[p.id] || 'binocolo',
          spiegazione: () => astroI18n.t('opposizione.spiegazione',
            { ...dati, corpo: nomeCorpo(p.id) }),
          programma: () => astroI18n.t(consiglio),
          simul: { scena: 'cielo', corpo: p.id }
        });
      } catch (e) { /* questa opposizione non si racconta: si va avanti */ }

      quando = new Date(t.date.getTime() + 30 * 86400000);
    }

    // --- congiunzioni col Sole ---
    // Solo per i pianeti che la gente cerca davvero: nessuno si accorge
    // che Nettuno è sparito.
    if (p.id !== 'Mars' && p.id !== 'Jupiter' && p.id !== 'Saturn') return;

    quando = new Date(inizio);
    giri = 0;
    while (giri++ < 200) {
      let t;
      try { t = Astronomy.SearchRelativeLongitude(p.id, 0, quando); } catch (e) { break; }
      if (!t || t.date > fine) break;

      creaEvento({
        titolo: () => astroI18n.t('congiunzioneSole.titolo', { corpo: nomeCorpo(p.id) }),
        dataObj: t.date,
        categoria: 'pianeti',
        colore: '#94a3b8',
        corpoCielo: p.id,
        strumento: 'occhio',
        spiegazione: () => astroI18n.t('congiunzioneSole.spiegazione', { corpo: nomeCorpo(p.id) }),
        programma: () => astroI18n.t('congiunzioneSole.programma'),
        simul: { scena: 'cielo', corpo: p.id }
      });

      quando = new Date(t.date.getTime() + 30 * 86400000);
    }
  });
}


// =====================================================================
// 3. IL MASSIMO SPLENDORE DI VENERE
//
//     Venere non è più luminoso quando è più vicino (allora ci mostra
//     una falce sottilissima) né quando è pieno (allora è dall'altra
//     parte del Sole, lontanissimo). Il massimo sta in mezzo, a una
//     falce del 27% circa: è il compromesso fra quanto è grande e quanta
//     parte ne vediamo illuminata.
//
//     A magnitudine −4,7 fa ombra su una parete bianca, in campagna, a
//     Luna nuova. È l'unico pianeta che lo fa.
// =====================================================================

function aggiungiSplendoreVenere(inizio, fine) {
  if (typeof Astronomy === 'undefined') return;

  let quando = new Date(inizio);
  let giri = 0;
  while (giri++ < 200) {
    let p;
    try { p = Astronomy.SearchPeakMagnitude('Venus', quando); } catch (e) { break; }
    if (!p || p.time.date > fine) break;

    if (p.time.date >= inizio) {
      const fase = Math.round(p.phase_fraction * 100);
      const mag = Number(p.mag.toFixed(1));
      creaEvento({
        titolo: () => astroI18n.t('splendore.titolo', { corpo: nomeCorpo('Venus') }),
        dataObj: p.time.date,
        categoria: 'pianeti',
        colore: '#fef9c3',
        corpoCielo: 'Venus',
        strumento: 'occhio',
        spiegazione: () => astroI18n.t('splendore.spiegazione',
          { corpo: nomeCorpo('Venus'), mag, n: fase }),
        programma: () => astroI18n.t('splendore.programma', { corpo: nomeCorpo('Venus') }),
        simul: { scena: 'cielo', corpo: 'Venus' }
      });
    }
    quando = new Date(p.time.date.getTime() + 200 * 86400000);
  }
}


// =====================================================================
// 4. I TRANSITI DI MERCURIO E VENERE SUL SOLE
//
//     Il pianeta passa davanti al disco solare e si vede come un
//     dischetto nero perfettamente tondo. Quelli di Venere capitano a
//     coppie separate da otto anni, e poi non succede più per oltre un
//     secolo: l'ultimo è stato nel 2012, il prossimo sarà nel 2117.
//     Quelli di Mercurio sono più frequenti — una dozzina per secolo.
//
//     Storicamente sono serviti a misurare la distanza Terra-Sole, ed è
//     per andare a vedere quello del 1769 che Cook è partito per Tahiti.
// =====================================================================

function aggiungiTransitiSolari(inizio, fine) {
  if (typeof Astronomy === 'undefined') return;

  [{ id: 'Mercury' }, { id: 'Venus' }].forEach(p => {
    let quando = new Date(inizio);
    let giri = 0;
    while (giri++ < 60) {
      let t;
      try { t = Astronomy.SearchTransit(p.id, quando); } catch (e) { break; }
      if (!t || t.start.date > fine) break;

      const durataOre = Number(((t.finish.date - t.start.date) / 3600000).toFixed(1));
      const primi = Number(t.separation.toFixed(1));
      const inizio = t.start.date, fine = t.finish.date;
      const T = (k, v) => astroI18n.t('transitoSole.' + k, v);
      creaEvento({
        titolo: () => T('titolo', { corpo: nomeCorpo(p.id) }),
        dataObj: t.peak.date,
        categoria: 'pianeti',
        colore: '#fb923c',
        corpoCielo: 'Sun',
        strumento: 'telescopio',
        // Gli orari si riformattano alla lettura: `oraBreve` passa dal fuso e
        // dalla lingua del luogo, e un'ora scritta una volta per sempre
        // resterebbe quella del momento in cui l'evento è nato.
        spiegazione: () => T('spiegazione', {
          corpo: nomeCorpo(p.id), ore: durataOre, primi,
          da: oraBreve(inizio), a: oraBreve(fine)
        }),
        programma: () => T('avvisoFiltro') + ' ' + T('nota.' + p.id),
        simul: { scena: 'cielo', corpo: 'Sun' }
      });

      quando = new Date(t.finish.date.getTime() + 86400000);
    }
  });
}


// =====================================================================
// 5. LE COMETE CHE SI ILLUMINANO
//
//     Una cometa non è un evento istantaneo: è una stagione. Diventa
//     visibile, resta per settimane, poi se ne va. Qui si segna il
//     giorno in cui è al massimo e si dice fin quando vale la pena
//     cercarla.
//
//     Vale la pena dire chiaro che le previsioni sulle comete sono la
//     cosa meno affidabile dell'astronomia: la luminosità dipende da
//     quanto ghiaccio evapora, e quello nessuno lo sa prima. Comete date
//     per spettacolari si sono sciolte in niente (la Kohoutek del 1973),
//     altre sono arrivate dal nulla.
// =====================================================================

const COMETA_MAG_INTERESSANTE = 8;      // sotto questa vale la pena dirlo

function aggiungiComete(inizio, fine) {
  if (typeof corpiMinoriTutti !== 'function' || typeof corpoMinoreInCielo !== 'function') return;

  const comete = corpiMinoriTutti().filter(c => c.tipo === 'cometa');
  if (!comete.length) return;

  // Una cometa si muove piano: campionare ogni cinque giorni basta e
  // avanza per trovare il massimo, e su un intervallo di anni evita di
  // fare centomila conti per niente.
  const PASSO = 5 * 86400000;
  const durata = fine.getTime() - inizio.getTime();
  if (durata > 40 * 365 * 86400000) return;      // finestre enormi: non ha senso

  comete.forEach(c => {
    let massimo = null;
    let primaVolta = null, ultimaVolta = null;

    for (let ms = inizio.getTime(); ms <= fine.getTime(); ms += PASSO) {
      let p;
      try { p = corpoMinoreInCielo(c, new Date(ms)); } catch (e) { continue; }
      if (!p || p.mag === null || !isFinite(p.mag)) continue;
      // Troppo vicina al Sole vuol dire invisibile, per quanto brilli
      if (p.elongazione < 20) continue;

      if (p.mag <= COMETA_MAG_INTERESSANTE) {
        if (!primaVolta) primaVolta = ms;
        ultimaVolta = ms;
        if (!massimo || p.mag < massimo.mag) massimo = { ms, mag: p.mag, p };
      }
    }

    if (!massimo) return;

    const settimane = Math.max(1, Math.round((ultimaVolta - primaVolta) / (7 * 86400000)));
    const aOcchio = massimo.mag <= 5.5;

    creaEvento({
      titolo: () => astroI18n.t('cometa.titolo', { nome: c.nome }),
      dataObj: new Date(massimo.ms),
      categoria: 'pianeti',
      colore: '#6ee7b7',
      // L'astro protagonista, con l'identificativo che usa l'elenco degli
      // astri del planetario (`min:<nome>`). Senza questo l'evento era una
      // riga di testo e basta: si leggeva «cometa al massimo» e poi
      // toccava cercarsela a mano nell'elenco. Con questo, «Vai sulla
      // cometa» la seleziona, la centra e le accende la traccia — come per
      // un'eclissi si punta la Luna.
      corpoCielo: 'min:' + c.nome,
      strumento: aOcchio ? 'occhio' : massimo.mag <= 8 ? 'binocolo' : 'telescopio',
      // Il nome della cometa è un nome proprio (C/2023 A3, Halley) e resta
      // com'è: la frase attorno no. «Resta alla portata per N settimane» ha il
      // plurale, e a scegliere la forma è `Intl.PluralRules` con `{n}`.
      spiegazione: () => astroI18n.t('cometa.spiegazione', {
        nome: c.nome,
        mag: Number(massimo.mag.toFixed(1)),
        ua: Number(massimo.p.distanzaTerra.toFixed(2)),
        uaSole: Number(massimo.p.distanzaSole.toFixed(2))
      }) + ' ' + (settimane > 1
        ? astroI18n.t('cometa.finestraSettimane', { n: settimane })
        : astroI18n.t('cometa.finestraCorta')),
      programma: () => astroI18n.t(aOcchio ? 'cometa.aOcchio' : 'cometa.alBinocolo') +
        ' ' + astroI18n.t('cometa.avvertenza')
    });
  });
}


// =====================================================================
// 6. LE AURORE POLARI
//
//     Un'aurora non si mette in calendario come un'eclissi. L'eclissi si
//     sa al secondo per i prossimi mille anni, perché dipende solo da
//     dove stanno la Luna e la Terra; l'aurora dipende da cosa fa il
//     Sole fra tre giorni, e quello non lo sa nessuno.
//
//     Ma due cose si sanno, e sono tutte e due vere.
//
//     LA PREVISIONE A TRE GIORNI. Il NOAA pubblica il Kp previsto ogni
//     tre ore fino a tre giorni avanti (lo scarica già `meteo-astro.js`
//     per il riquadro della dashboard). Quello è un vero appuntamento:
//     ha una data, un'ora e un numero. Qui diventa un evento del
//     calendario — ma solo per le notti in cui da **questa** latitudine
//     geomagnetica qualcosa si vedrebbe davvero, e solo per le ore in
//     cui è buio: un avviso di aurora a mezzogiorno è rumore.
//
//     LA STAGIONE. Le tempeste geomagnetiche non sono distribuite a
//     caso nell'anno: attorno agli equinozi sono circa il doppio che
//     attorno ai solstizi. Non è folklore, è l'effetto di
//     Russell-McPherron (1973): il campo magnetico interplanetario
//     arriva avvolto nella spirale di Parker, e in marzo e settembre
//     l'inclinazione dell'asse terrestre lo presenta al nostro campo
//     nel verso che favorisce la riconnessione. Marzo e settembre-
//     ottobre sono i mesi delle aurore, e questo si può scrivere in
//     calendario con anni di anticipo.
//
//     Quello che qui **non** si fa è inventare una data. Non esiste
//     nessun modo di dire «il 14 novembre 2029 ci sarà l'aurora», e un
//     calendario che lo scrivesse mentirebbe.
// =====================================================================

// La stessa scala del confine dell'ovale che usano `meteo-astro.js`
// (a tabella) e `aurora-polare.js` (a retta). Scritta come retta anche
// qui, perché serve invertita: non «dove arriva l'ovale con questo Kp»,
// ma «che Kp ci vorrebbe per arrivare fin qui».
const AURORA_EV_CONFINE_ZERO = 66.5;
const AURORA_EV_CONFINE_PER_KP = 2.05;

// Quanti gradi più a sud del confine si affaccia almeno il bagliore. È
// la stessa soglia di `auroraDaQui()`: sotto l'ovale ci si sta a
// quattro gradi di distanza, e da lì si vede la parte alta delle tende.
const AURORA_EV_BAGLIORE = 4;

// Sotto questo Kp non si scrive niente in calendario nemmeno a chi vive
// sotto l'ovale: da Tromsø un Kp 2 è una notte come tutte le altre, e
// segnarla come «evento» vorrebbe dire riempire il calendario di righe
// che non aggiungono niente.
const AURORA_EV_KP_MINIMO = 3;

// Il Sole dev'essere almeno sotto il crepuscolo civile: con il Sole a
// −3° il cielo è ancora azzurro e l'aurora più forte del secolo non si
// vedrebbe lo stesso.
const AURORA_EV_SOLE_MAX = -6;

// Dove siamo, in coordinate che contano per l'aurora.
function auroraCasaGeomagnetica() {
  if (typeof luogoCorrente !== 'function' || typeof latitudineGeomagnetica !== 'function') return null;
  const l = luogoCorrente();
  if (!l || !isFinite(l.lat) || !isFinite(l.lon)) return null;
  const g = latitudineGeomagnetica(l.lat, l.lon);
  const boreale = g >= 0;
  // `nome` e `verso` sono due parole che finiscono dentro a delle frasi
  // («Aurora boreale», «un orizzonte nord libero e buio»): getter, se no
  // restano quelle di quando l'evento è nato. Il verso lo dà `nomePunto`, che è
  // già il posto in cui questo progetto tiene i punti cardinali.
  return {
    lat: l.lat, lon: l.lon,
    mia: Math.abs(g),
    boreale,
    get nome() { return astroI18n.t(boreale ? 'aurora.boreale' : 'aurora.australe'); },
    get verso() { return astroI18n.nomePunto(boreale ? 0 : 180); }
  };
}

// Il Kp che ci vorrebbe da qui: uno perché l'ovale arrivi sopra la
// testa, uno perché almeno il bagliore si affacci sull'orizzonte.
function auroraKpNecessario(mia) {
  return {
    sopra: (AURORA_EV_CONFINE_ZERO - mia) / AURORA_EV_CONFINE_PER_KP,
    bagliore: (AURORA_EV_CONFINE_ZERO - AURORA_EV_BAGLIORE - mia) / AURORA_EV_CONFINE_PER_KP
  };
}

function auroraAltezzaSole(data, lat, lon) {
  if (typeof Astronomy === 'undefined') return null;
  try {
    const obs = new Astronomy.Observer(lat, lon, 0);
    const eq = Astronomy.Equator(Astronomy.Body.Sun, data, obs, true, true);
    return Astronomy.Horizon(data, obs, eq.ra, eq.dec, 'normal').altitude;
  } catch (e) { return null; }
}

// Un Kp si scrive con un decimale al massimo, e il separatore lo decide la
// lingua: «Kp 5,3» qui, «Kp 5.3» in inglese.
function auroraNumero(v) {
  return astroI18n.numero(Math.round(v * 10) / 10);
}

// --- (a) le notti che il NOAA prevede -------------------------------
function aurorePreviste(inizio, fine) {
  if (typeof aurora === 'undefined' || !aurora) return;
  const prossime = Array.isArray(aurora.prossime) ? aurora.prossime : [];
  if (!prossime.length) return;

  const casa = auroraCasaGeomagnetica();
  if (!casa) return;
  const serve = auroraKpNecessario(casa.mia);

  // Da qui, che Kp vale la pena segnalare. Non ha senso avvisare chi sta
  // a Bologna di un Kp 5 (l'ovale resterebbe mille chilometri più a
  // nord), né tacere a chi sta a Tromsø un Kp 5 perché «è poco».
  const soglia = Math.max(AURORA_EV_KP_MINIMO, serve.bagliore);

  // Una notte per volta: la previsione arriva a passi di tre ore, e di
  // una notte interessa il picco, non ogni singolo scalino. Le ore
  // piccole appartengono ancora alla notte del giorno prima — è per
  // questo che si toglie mezza giornata prima di prendere la data.
  const notti = new Map();
  prossime.forEach(p => {
    const q = p.quando instanceof Date ? p.quando : new Date(p.quando);
    if (isNaN(q.getTime()) || q < inizio || q > fine) return;
    const kp = Number(p.kp);
    if (!isFinite(kp)) return;
    // Buio o niente: l'aurora c'è anche di giorno, e non la vede nessuno
    const sole = auroraAltezzaSole(q, casa.lat, casa.lon);
    if (sole === null || sole > AURORA_EV_SOLE_MAX) return;
    const n = new Date(q.getTime() - 12 * 3600000);
    const chiave = `${n.getFullYear()}-${n.getMonth()}-${n.getDate()}`;
    const prima = notti.get(chiave);
    if (!prima || kp > prima.kp) notti.set(chiave, { kp, quando: q });
  });

  notti.forEach(n => {
    if (n.kp < soglia) return;
    const addosso = n.kp >= serve.sopra;
    const solaCoda = !addosso && n.kp >= serve.bagliore;

    // Il verdetto è una frase intera per ognuno dei tre casi, non una frase
    // montata a pezzi: «l'ovale scende sopra la tua testa» e «è al limite»
    // hanno una struttura diversa in inglese.
    const quale = addosso ? 'addosso' : solaCoda ? 'solaCoda' : 'alLimite';
    const A = (k, v) => astroI18n.t('aurora.previsione.' + k, v);
    creaEvento({
      titolo: () => A('titolo', { dove: casa.nome, kp: auroraNumero(n.kp) }),
      dataObj: n.quando,
      categoria: 'aurore',
      colore: addosso ? '#4ade80' : '#fb7185',
      strumento: 'occhio',
      aurora: { kp: n.kp, previsione: true },
      spiegazione: () =>
        A('apertura', { kp: auroraNumero(n.kp), gradi: auroraNumero(casa.mia) }) + ' ' +
        A(quale, { verso: casa.verso }) + ' ' + A('incertezza'),
      programma: () => ({
        cosaPortare: A('cosaPortare'),
        doveVederlo: A('doveVederlo', { verso: casa.verso }),
        comeVederlo: A('comeVederlo')
      })
    });
  });
}

// --- (b) le due stagioni dell'anno ----------------------------------
function auroreStagioni(inizio, fine) {
  if (typeof Astronomy === 'undefined') return;
  const casa = auroraCasaGeomagnetica();
  const serve = casa ? auroraKpNecessario(casa.mia) : null;

  const primo = inizio.getFullYear(), ultimo = fine.getFullYear();
  if (ultimo - primo > 40) return;              // finestre enormi: non ha senso

  for (let anno = primo; anno <= ultimo; anno++) {
    let s;
    try { s = Astronomy.Seasons(anno); } catch (e) { continue; }

    [['marzo', s.mar_equinox.date], ['settembre', s.sep_equinox.date]].forEach(([quale, eq]) => {
      if (!eq || eq < inizio || eq > fine) return;
      // L'evento è la notte dell'equinozio, non l'istante: un equinozio
      // cade spesso a mezzogiorno, e aprire il planetario lì mostrerebbe
      // un cielo azzurro.
      const notte = new Date(eq.getFullYear(), eq.getMonth(), eq.getDate(), 22, 30, 0);

      // Il Kp che ci vorrebbe da qui, tosato alla scala: è anche quello
      // con cui il planetario disegnerà l'ovale premendo «Vedi nel
      // planetario», e per una data di fra due anni non c'è nessun Kp
      // vero da mostrare — quindi tanto vale mostrare quello che serve.
      const kpFinto = serve
        ? Math.max(3, Math.min(9, Math.round(serve.bagliore * 10) / 10))
        : 6;

      const S = (k, v) => astroI18n.t('aurora.stagione.' + k, v);
      // Che tempesta ci vorrebbe da qui: tre risposte diverse, non una frase
      // con un numero dentro — la terza non ha nemmeno un numero da dire.
      const quanto = () => {
        if (!casa) return '';
        const dove = S('daQui', { gradi: auroraNumero(casa.mia) });
        if (serve.bagliore <= 6) {
          return ' ' + dove + ' ' + S('bastaKp',
            { kp: auroraNumero(Math.max(0, serve.bagliore)), verso: casa.verso });
        }
        if (serve.bagliore <= 9) {
          return ' ' + dove + ' ' + S('servirebbeKp', { kp: auroraNumero(serve.bagliore) });
        }
        return ' ' + dove + ' ' + S('fuoriScala');
      };
      creaEvento({
        // Il titolo nomina l'equinozio, e «di marzo» non è un mese incollato
        // dentro a una frase: in inglese è «the March equinox», con il mese
        // davanti. Due chiavi intere, una per equinozio.
        titolo: () => S('titolo.' + quale),
        dataObj: notte,
        categoria: 'aurore',
        colore: '#34d399',
        strumento: 'occhio',
        aurora: { kp: kpFinto, stagione: true },
        spiegazione: () => S('spiegazione') + quanto(),
        programma: () => ({
          cosaPortare: S('cosaPortare'),
          doveVederlo: casa ? S('doveVederlo', { verso: casa.verso }) : S('doveVederloSenzaCasa'),
          comeVederlo: S('comeVederlo')
        })
      });
    });
  }
}

function aggiungiAurore(inizio, fine) {
  aurorePreviste(inizio, fine);
  auroreStagioni(inizio, fine);
}

// Il Kp del NOAA arriva un secondo o due dopo l'avvio, quando gli eventi
// sono già stati calcolati: senza questa funzione le notti previste non
// entrerebbero mai in calendario. La chiama `ui-nuova.js` appena la
// previsione è in casa.
function aggiornaEventiAurora() {
  if (typeof creaEvento !== 'function' || typeof inserisciEventi !== 'function') return 0;

  const raccolta = [];
  const precedente = destinazioneEventi;
  destinazioneEventi = raccolta;
  try {
    // Mezza giornata indietro perché la notte in corso ci stia dentro, e
    // quattro giorni avanti perché è fin dove arriva la previsione.
    aurorePreviste(new Date(Date.now() - 12 * 3600000), new Date(Date.now() + 4 * 86400000));
  } catch (e) {
    console.warn('Eventi «aurore previste» non calcolati:', e);
  } finally {
    destinazioneEventi = precedente;
  }

  const aggiunti = inserisciEventi(raccolta);
  if (aggiunti && typeof applicaFiltri === 'function') applicaFiltri();
  return aggiunti;
}


// =====================================================================
// 7. IL GANCIO
//     Una funzione sola, che app.js chiama dentro
//     calcolaEventiIntervallo(). Come tutte le altre famiglie di eventi,
//     ognuna sta nel suo try/catch: se una fallisce, le altre entrano
//     lo stesso nel calendario.
// =====================================================================

function aggiungiEventiExtra(inizio, fine) {
  const famiglie = [
    ['superlune', () => aggiungiSuperlune(inizio, fine)],
    ['opposizioni', () => aggiungiOpposizioni(inizio, fine)],
    ['splendore di Venere', () => aggiungiSplendoreVenere(inizio, fine)],
    ['transiti solari', () => aggiungiTransitiSolari(inizio, fine)],
    ['comete', () => aggiungiComete(inizio, fine)],
    ['aurore', () => aggiungiAurore(inizio, fine)]
  ];

  famiglie.forEach(([nome, fai]) => {
    try {
      fai();
    } catch (e) {
      console.warn(`Eventi «${nome}» non calcolati:`, e);
    }
  });
}
