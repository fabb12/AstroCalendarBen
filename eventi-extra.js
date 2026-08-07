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

            creaEvento({
              titolo: perigeo ? 'Superluna' : 'Microluna',
              dataObj: piena.date,
              categoria: 'luna',
              colore: '#e2e8f0',
              corpoCielo: 'Moon',
              strumento: 'occhio',
              spiegazione: perigeo
                ? `Luna piena a ${Math.round(apside.dist_km).toLocaleString('it')} km, vicina al punto più ` +
                  `prossimo della sua orbita. Il disco misura ${primi.toFixed(1)} primi d'arco, ` +
                  `${Math.abs(controMedia).toFixed(0)}% più grande della media.`
                : `Luna piena a ${Math.round(apside.dist_km).toLocaleString('it')} km, vicina al punto più ` +
                  `lontano della sua orbita: il disco più piccolo dell'anno, ${primi.toFixed(1)} primi d'arco.`,
              programma: perigeo
                ? 'La differenza col vero c\'è ma è modesta: il 14% fra la più grande e la più piccola ' +
                  'dell\'anno, e non avendo un termine di paragone in cielo a occhio non si distingue. ' +
                  'Il modo per vederla davvero è fotografarla sempre con lo stesso obiettivo e ' +
                  'confrontare gli scatti a mesi di distanza. L\'effetto «Luna enorme» che si vede ' +
                  'all\'orizzonte, invece, non c\'entra niente con la distanza: è un\'illusione ottica, ' +
                  'e all\'orizzonte la Luna è anzi leggermente più lontana che allo zenit.'
                : 'La Luna piena più piccola e più debole dell\'anno. Non è uno spettacolo: è il ' +
                  'termine di paragone che serve per accorgersi, sei mesi dopo, di quanto cambia.',
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

const EXTRA_PIANETI_ESTERNI = [
  { id: 'Mars', nome: 'Marte', colore: '#f87171' },
  { id: 'Jupiter', nome: 'Giove', colore: '#fbbf24' },
  { id: 'Saturn', nome: 'Saturno', colore: '#fcd34d' },
  { id: 'Uranus', nome: 'Urano', colore: '#67e8f9' },
  { id: 'Neptune', nome: 'Nettuno', colore: '#818cf8' }
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

        creaEvento({
          titolo: `${p.nome} all'opposizione`,
          dataObj: t.date,
          categoria: 'pianeti',
          colore: p.colore,
          corpoCielo: p.id,
          strumento: EXTRA_OPPOSIZIONE_STRUMENTO[p.id] || 'binocolo',
          spiegazione: `${p.nome} è dalla parte opposta del Sole: sorge al tramonto, ` +
            `è più alto a mezzanotte e tramonta all'alba. Dista ${dTerra.toFixed(2)} unità ` +
            `astronomiche dalla Terra e brilla di magnitudine ${ill.mag.toFixed(1)}: ` +
            `è la notte migliore dell'anno per guardarlo.`,
          programma: p.id === 'Mars'
            ? 'È l\'unico periodo in cui Marte mostra qualcosa: fuori dalle opposizioni resta ' +
              'un puntino arancione anche nei telescopi grandi. Aspetta che sia alto, lascia ' +
              'raffreddare lo strumento, e ingrandisci molto più di quanto sembri ragionevole.'
            : p.id === 'Saturn'
            ? 'Gli anelli sono la cosa che converte le persone all\'astronomia. Bastano ' +
              'cinquanta ingrandimenti per vederli staccati dal disco.'
            : p.id === 'Jupiter'
            ? 'Le due bande scure si vedono anche in un piccolo rifrattore, e le quattro lune ' +
              'cambiano disposizione di ora in ora: guardale a inizio e a fine serata.'
            : 'Serve una carta per riconoscerlo fra le stelle: a un\'occhiata distratta è una ' +
              'stellina qualunque. Il modo sicuro è guardare due sere di fila e vedere chi si è mosso.',
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
        titolo: `${p.nome} in congiunzione col Sole`,
        dataObj: t.date,
        categoria: 'pianeti',
        colore: '#94a3b8',
        corpoCielo: p.id,
        strumento: 'occhio',
        spiegazione: `${p.nome} passa dietro al Sole visto da qui: per qualche settimana, ` +
          'prima e dopo, non è osservabile.',
        programma: 'Non c\'è niente da guardare, ed è proprio questo il punto: se lo stavi ' +
          'cercando e non lo trovavi, il motivo è questo. Ricomparirà nel cielo del mattino, ' +
          'basso a est prima dell\'alba.',
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
      creaEvento({
        titolo: 'Venere al massimo splendore',
        dataObj: p.time.date,
        categoria: 'pianeti',
        colore: '#fef9c3',
        corpoCielo: 'Venus',
        strumento: 'occhio',
        spiegazione: `Venere raggiunge la magnitudine ${p.mag.toFixed(1)}, il massimo di questa ` +
          `apparizione. È illuminato solo per il ${fase}% — una falce — ma è così vicino che ` +
          'la falce compensa abbondantemente.',
        programma: 'A questa luminosità Venere fa ombra: da un posto buio, con la Luna sotto ' +
          'l\'orizzonte, tieni un foglio bianco davanti a te e guarda. Al binocolo, tenuto ' +
          'fermissimo, la falce si vede già — ed è la stessa osservazione che nel 1610 convinse ' +
          'Galileo che Venere gira attorno al Sole e non attorno a noi.',
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

  [{ id: 'Mercury', nome: 'Mercurio' }, { id: 'Venus', nome: 'Venere' }].forEach(p => {
    let quando = new Date(inizio);
    let giri = 0;
    while (giri++ < 60) {
      let t;
      try { t = Astronomy.SearchTransit(p.id, quando); } catch (e) { break; }
      if (!t || t.start.date > fine) break;

      const durataOre = (t.finish.date - t.start.date) / 3600000;
      creaEvento({
        titolo: `Transito di ${p.nome} sul Sole`,
        dataObj: t.peak.date,
        categoria: 'pianeti',
        colore: '#fb923c',
        corpoCielo: 'Sun',
        strumento: 'telescopio',
        spiegazione: `${p.nome} passa davanti al disco del Sole: un dischetto nero perfettamente ` +
          `tondo che lo attraversa in ${durataOre.toFixed(1)} ore, dalle ${oraBreve(t.start.date)} ` +
          `alle ${oraBreve(t.finish.date)}. Al centro passa a ${t.separation.toFixed(1)} primi ` +
          'd\'arco dal centro del Sole.',
        programma: '⚠ MAI guardare il Sole senza un filtro solare certificato messo DAVANTI ' +
          'all\'obiettivo: un secondo basta a rendere ciechi per sempre, e nel telescopio il ' +
          'danno è istantaneo e indolore. I filtri che si avvitano all\'oculare non vanno usati ' +
          'mai — si crepano per il calore. In alternativa, la proiezione su un cartoncino ' +
          'bianco è sicura e mostra tutto. ' +
          (p.id === 'Venus'
            ? 'I transiti di Venere vengono a coppie separate da otto anni, e poi non se ne ' +
              'vedono più per oltre un secolo: chi se lo perde non ne ha un altro.'
            : 'Il dischetto di Mercurio è piccolissimo, un centosessantesimo del diametro del ' +
              'Sole: serve un ingrandimento vero, non basta il filtro sugli occhiali.'),
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
      titolo: `Cometa ${c.nome} al massimo`,
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
      spiegazione: `La cometa ${c.nome} raggiunge la magnitudine ${massimo.mag.toFixed(1)}, ` +
        `a ${massimo.p.distanzaTerra.toFixed(2)} unità astronomiche dalla Terra e ` +
        `${massimo.p.distanzaSole.toFixed(2)} dal Sole. ` +
        (settimane > 1 ? `Resta alla portata per circa ${settimane} settimane.` : 'La finestra è di pochi giorni.'),
      programma: (aOcchio
        ? 'Dovrebbe vedersi a occhio nudo da un posto buio, ma non aspettarti la fotografia: ' +
          'a occhio una cometa è una macchia sfocata con forse un accenno di coda. Il binocolo ' +
          'è lo strumento giusto, meglio del telescopio — serve campo largo, non ingrandimento. '
        : 'Cercala col binocolo: le comete sono grandi e deboli, e il telescopio ingrandisce ' +
          'troppo per contenerle. ') +
        'Tieni presente che le previsioni sulla luminosità delle comete sbagliano spesso e di ' +
        'molto, in tutt\'e due i sensi: dipende da quanto ghiaccio evapora, e quello si scopre ' +
        'solo quando succede.'
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
  return {
    lat: l.lat, lon: l.lon,
    mia: Math.abs(g),
    boreale,
    nome: boreale ? 'boreale' : 'australe',
    verso: boreale ? 'nord' : 'sud'
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

function auroraNumero(v) {
  return (Math.round(v * 10) / 10).toString().replace('.', ',');
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

    creaEvento({
      titolo: `Aurora ${casa.nome}: Kp ${auroraNumero(n.kp)} previsto`,
      dataObj: n.quando,
      categoria: 'aurore',
      colore: addosso ? '#4ade80' : '#fb7185',
      strumento: 'occhio',
      aurora: { kp: n.kp, previsione: true },
      spiegazione:
        `Il NOAA prevede un indice Kp di ${auroraNumero(n.kp)} per questa notte. ` +
        `Da qui — ${auroraNumero(casa.mia)}° di latitudine geomagnetica — ` +
        (addosso
          ? `l'ovale aurorale scende sopra la tua testa: se il cielo è sereno, gli archi verdi ` +
            `si vedono alti a ${casa.verso}, e con questa tempesta possono arrivare allo zenit.`
          : solaCoda
            ? `l'ovale resta oltre l'orizzonte, ma non tutto: il verde vive a 100–180 km e la ` +
              `curvatura della Terra lo nasconde, mentre il rosso dell'ossigeno a duecento e passa ` +
              `chilometri si affaccia lo stesso. Aspettati un bagliore rosato basso a ${casa.verso}, ` +
              `non archi verdi — è l'aurora che si è vista dall'Italia nel maggio 2024.`
            : `è al limite: serve un orizzonte ${casa.verso} completamente libero e buio.`) +
        ' Le previsioni del Kp a tre giorni sbagliano spesso di un punto in su o in giù.',
      programma: {
        cosaPortare: 'Niente strumenti: l\'aurora è larga decine di gradi e il binocolo la taglia. ' +
          'Semmai una macchina fotografica su treppiede — il sensore vede i colori che l\'occhio, ' +
          'al buio, quasi non distingue.',
        doveVederlo: `Un posto con l'orizzonte ${casa.verso} completamente sgombro e nessun paese ` +
          'illuminato da quella parte: una cupola di luce arancione su un bagliore rosso lo cancella. ' +
          'La costa, un crinale, un campo aperto.',
        comeVederlo: 'Dai venti minuti agli occhi prima di giudicare, e guarda a lungo: l\'aurora ' +
          'cambia in pochi minuti e le sottotempeste arrivano a ondate, con mezz\'ora di niente in ' +
          'mezzo. Il momento migliore è attorno alla mezzanotte magnetica, cioè poco prima o poco ' +
          'dopo la mezzanotte vera. Il tasto «Vedi nel planetario» ti fa vedere adesso che forma ' +
          'avrebbe da qui.'
      }
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

    [['marzo', s.mar_equinox.date], ['settembre', s.sep_equinox.date]].forEach(([mese, eq]) => {
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

      creaEvento({
        titolo: `Stagione delle aurore — equinozio di ${mese}`,
        dataObj: notte,
        categoria: 'aurore',
        colore: '#34d399',
        strumento: 'occhio',
        aurora: { kp: kpFinto, stagione: true },
        spiegazione:
          'Attorno agli equinozi le tempeste geomagnetiche sono circa il doppio che attorno ai ' +
          'solstizi, e non è una coincidenza: è l\'effetto di Russell-McPherron. Il campo magnetico ' +
          'che il Sole ci soffia addosso arriva avvolto a spirale, e in marzo e in settembre ' +
          'l\'inclinazione dell\'asse terrestre lo presenta al campo terrestre nel verso che ' +
          'favorisce la riconnessione — che è il rubinetto da cui passa l\'energia dell\'aurora. ' +
          'Le tre settimane attorno a questa data sono il periodo dell\'anno in cui vale la pena ' +
          'tenere d\'occhio le previsioni. ' +
          (casa
            ? `Da qui, a ${auroraNumero(casa.mia)}° di latitudine geomagnetica, ` +
              (serve.bagliore <= 6
                ? `basta un Kp ${auroraNumero(Math.max(0, serve.bagliore))} perché qualcosa si affacci a ${casa.verso}: ` +
                  'in una stagione buona capita più volte.'
                : serve.bagliore <= 9
                  ? `servirebbe un Kp ${auroraNumero(serve.bagliore)}: capita qualche volta per ciclo solare, ` +
                    'e il maggio 2024 è stata l\'ultima.'
                  : 'ci vorrebbe una tempesta fuori scala — dal tuo parallelo l\'aurora è una cosa ' +
                    'da una volta ogni molte decine d\'anni.')
            : ''),
        programma: {
          cosaPortare: 'Niente di speciale: l\'aurora si guarda a occhio nudo. Utile invece un ' +
            'telefono con la notifica delle tempeste geomagnetiche, perché il preavviso vero è ' +
            'di poche ore.',
          doveVederlo: casa
            ? `Serve un orizzonte ${casa.verso} libero e buio. Se abiti in pianura, il posto giusto ` +
              'lo si sceglie una volta e ci si torna: quando arriva la tempesta non c\'è tempo di cercarlo.'
            : 'Serve un orizzonte libero e buio verso il polo più vicino.',
          comeVederlo: 'Non è un evento a data fissa e nessuno può prometterlo: è una stagione. ' +
            'Il riquadro «Che cielo avrai» della dashboard mostra il Kp previsto per le prossime ' +
            'tre notti, ed è quello il momento in cui decidere se uscire. Il banco «Aurore polari» ' +
            'della vista Didattica spiega da dove viene tutto questo, e ti porta nel planetario ' +
            'in un posto e in una notte in cui l\'aurora si è vista per davvero.'
        }
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
