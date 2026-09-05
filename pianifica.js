// =====================================================================
// PIANIFICARE LA SERATA
//
// Il calendario dice cosa succede. Il planetario dice dov'è. Manca la
// domanda di mezzo, che è quella che uno si fa davvero mentre guarda
// fuori dalla finestra: **stasera cosa guardo, e a che ora?**
//
// Qui ci sono le tre cose che rispondono.
//
//   LA CURVA DELLA NOTTE. Un oggetto non "si vede" o "non si vede": sale,
//   passa in meridiano, scende. Il grafico dell'altezza nel tempo è il
//   modo in cui gli astrofili ragionano da sempre, ed è la schermata più
//   guardata di SkySafari. Qui c'è, con i crepuscoli ombreggiati e la
//   Luna sovrapposta — perché una notte con la Luna piena alta è un'altra
//   notte.
//
//   I MIGLIORI DI STANOTTE. Un elenco ordinato di cosa vale la pena, che
//   tiene conto di tutto insieme: quanto sale, quando fa buio, quanto
//   disturba la Luna, che cielo hai, che strumento hai e cosa dice il
//   meteo. Gli ingredienti c'erano già tutti, sparsi; qui si sommano.
//
//   IL PALAZZO DI FRONTE. Nessuna app al mondo tiene conto della cosa che
//   davvero decide se una serata funziona: che a ovest c'è un condominio
//   di otto piani, e che tutto quello che sta sotto i trenta gradi da
//   quella parte non lo vedrai mai. Qui si può dire, e da lì in poi entra
//   in tutti i conti.
//
// Ordine di caricamento: dopo app.js (usa `finestraBuio`, `altAzCorpo`,
// `osservatoreCorrente`, `meteo`), dopo catalogo.js (usa `cieloDiCasa`).
// =====================================================================


// =====================================================================
// 1. IL PROFILO DELL'ORIZZONTE — il palazzo di fronte
//
//     Sedici settori da 22°30′, uno per ogni punto della rosa dei venti,
//     con l'altezza in gradi di quello che c'è davanti. Zero vuol dire
//     orizzonte libero (il mare); trenta vuol dire il condominio.
//
//     Sedici e non trecentosessanta perché è una cosa che si stima a
//     occhio dal balcone, non si misura col teodolite: chiedere più
//     precisione di quella che uno può dare è un modo di farsi dare
//     numeri inventati.
// =====================================================================

const CHIAVE_ORIZZONTE = 'astrocalendario_orizzonte';

const ORIZZONTE_SETTORI = 16;
const ORIZZONTE_PASSO = 360 / ORIZZONTE_SETTORI;      // 22,5°

// Gli stessi nomi che usa già il planetario per le direzioni
const ORIZZONTE_NOMI = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                        'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];

let orizzonteMio = null;

function orizzonteCarica() {
  if (orizzonteMio) return orizzonteMio;
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_ORIZZONTE) || 'null');
    if (Array.isArray(v) && v.length === ORIZZONTE_SETTORI) {
      orizzonteMio = v.map(x => Math.max(0, Math.min(80, Number(x) || 0)));
      return orizzonteMio;
    }
  } catch (e) { /* storage negato */ }
  orizzonteMio = new Array(ORIZZONTE_SETTORI).fill(0);
  return orizzonteMio;
}

function orizzonteSalva(valori) {
  orizzonteMio = valori.map(x => Math.max(0, Math.min(80, Number(x) || 0)));
  try { localStorage.setItem(CHIAVE_ORIZZONTE, JSON.stringify(orizzonteMio)); } catch (e) { /* pieno */ }
}

function orizzonteLibero() {
  return orizzonteCarica().every(x => x <= 0);
}

// Butta via quello che c'è in memoria, così al prossimo giro si rilegge
// dal salvato. Serve al ripristino di un backup, che scrive direttamente
// in localStorage e altrimenti si troverebbe davanti il profilo vecchio
// fino alla ricarica della pagina.
function orizzonteDimentica() {
  orizzonteMio = null;
}

// Quanto è alto l'ostacolo in quella direzione. Fra un settore e l'altro
// si interpola: un palazzo non finisce di netto a metà di un settore, e
// uno scalino nel grafico sarebbe più falso di una rampa.
function orizzonteAltezza(az) {
  const o = orizzonteCarica();
  const a = ((az % 360) + 360) % 360;
  const dove = a / ORIZZONTE_PASSO;
  const i = Math.floor(dove) % ORIZZONTE_SETTORI;
  const j = (i + 1) % ORIZZONTE_SETTORI;
  const k = dove - Math.floor(dove);
  return o[i] * (1 - k) + o[j] * k;
}

// Si vede davvero da qui? Non basta essere sopra l'orizzonte matematico:
// bisogna essere sopra il tetto del vicino.
function sopraIlMioOrizzonte(alt, az) {
  return alt > orizzonteAltezza(az);
}


// =====================================================================
// 2. LA CURVA DELLA NOTTE
//
//     In orizzontale le ore, in verticale l'altezza sull'orizzonte. Le
//     bande scure sono i crepuscoli; la linea tratteggiata in basso è il
//     profilo degli ostacoli, se ne sono stati dichiarati; la curva
//     grigia è la Luna, che non è un oggetto da guardare ma un lampione
//     acceso.
// =====================================================================

const PIAN_PASSI = 96;                 // un punto ogni quindici minuti circa

// Calcola la curva di un bersaglio lungo la notte. `bersaglio` può essere
// il nome di un corpo per Astronomy Engine ('Mars'), oppure un oggetto
// {ra, dec} in ore e gradi (per le stelle e il cielo profondo).
function pianCurvaNotturna(bersaglio, quando) {
  const obs = osservatoreCorrente();
  if (!obs || typeof Astronomy === 'undefined') return null;

  const buio = finestraBuio(quando || new Date());
  if (!buio || !buio.tramonto) return null;

  // La finestra va da un'ora prima del tramonto a un'ora dopo l'alba: il
  // crepuscolo fa parte della serata, e per Mercurio e Venere è tutta la
  // serata che c'è.
  const inizio = buio.tramonto.getTime() - 3600000;
  const fine = (buio.alba ? buio.alba.getTime() : inizio + 12 * 3600000) + 3600000;
  const passo = (fine - inizio) / PIAN_PASSI;

  const punti = [];
  const luna = [];
  let culmine = null;

  for (let k = 0; k <= PIAN_PASSI; k++) {
    const data = new Date(inizio + k * passo);
    let p = null, l = null;
    try {
      p = bersaglio && bersaglio.ra !== undefined
        ? altAzCoordinate(bersaglio.ra, bersaglio.dec, data, obs)
        : altAzCorpo(bersaglio, data, obs);
      l = altAzCorpo('Moon', data, obs);
    } catch (e) { continue; }

    const voce = {
      ms: data.getTime(), alt: p.alt, az: p.az,
      // Quanto sta sopra il tetto del vicino: negativo vuol dire coperto
      sopraOstacoli: p.alt - orizzonteAltezza(p.az)
    };
    punti.push(voce);
    luna.push({ ms: voce.ms, alt: l.alt });

    if (!culmine || voce.alt > culmine.alt) culmine = voce;
  }

  // Il momento buono non è il culmine, è il culmine A CIELO BUIO e sopra
  // gli ostacoli. Per un oggetto che passa in meridiano a mezzogiorno,
  // il culmine non serve a niente.
  const buioDa = (buio.buioInizio || buio.tramonto).getTime();
  const buioA = (buio.buioFine || buio.alba || new Date(fine)).getTime();
  let migliore = null;
  punti.forEach(p => {
    if (p.ms < buioDa || p.ms > buioA) return;
    if (p.sopraOstacoli <= 0) return;
    if (!migliore || p.alt > migliore.alt) migliore = p;
  });

  return {
    punti, luna, culmine, migliore, buio,
    inizio, fine,
    // Per quante ore, stanotte, sta a cielo buio e sopra gli ostacoli:
    // è il numero che dice se vale la pena tirare fuori il telescopio.
    oreUtili: punti.filter(p =>
      p.ms >= buioDa && p.ms <= buioA && p.sopraOstacoli > 0
    ).length * passo / 3600000
  };
}

// Disegna la curva su un canvas. Nessuna libreria: sono quattro linee e
// due bande, e importare un motore di grafici per questo sarebbe come
// comprare un camion per portare la spesa.
function pianDisegnaCurva(canvas, curva, etichetta) {
  if (!canvas || !curva) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const L = canvas.clientWidth || 320, A = canvas.clientHeight || 150;
  canvas.width = L * dpr; canvas.height = A * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, L, A);

  const MG = { s: 30, d: 8, alto: 12, basso: 20 };
  const gL = L - MG.s - MG.d, gA = A - MG.alto - MG.basso;
  const x = ms => MG.s + (ms - curva.inizio) / (curva.fine - curva.inizio) * gL;
  const y = alt => MG.alto + (90 - Math.max(0, Math.min(90, alt))) / 90 * gA;

  // --- le bande del crepuscolo ---
  // Fuori dal buio astronomico il cielo è ancora chiaro, e disegnarlo
  // dello stesso colore del cuore della notte sarebbe una bugia.
  const b = curva.buio;
  ctx.fillStyle = 'rgba(8, 12, 24, 0.85)';
  ctx.fillRect(MG.s, MG.alto, gL, gA);
  if (b.buioInizio && b.buioFine) {
    ctx.fillStyle = 'rgba(2, 4, 10, 0.95)';
    ctx.fillRect(x(b.buioInizio.getTime()), MG.alto,
                 x(b.buioFine.getTime()) - x(b.buioInizio.getTime()), gA);
  }

  // --- la griglia ---
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.lineWidth = 1;
  [0, 30, 60, 90].forEach(g => {
    ctx.beginPath(); ctx.moveTo(MG.s, y(g)); ctx.lineTo(L - MG.d, y(g)); ctx.stroke();
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(g + '°', MG.s - 4, y(g));
  });

  // Le ore tonde: una etichetta ogni due ore, o la riga si affolla
  const primaOra = new Date(curva.inizio);
  primaOra.setMinutes(0, 0, 0);
  primaOra.setHours(primaOra.getHours() + 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let ms = primaOra.getTime(); ms < curva.fine; ms += 3600000) {
    const d = new Date(ms);
    if (d.getHours() % 2) continue;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.beginPath(); ctx.moveTo(x(ms), MG.alto); ctx.lineTo(x(ms), MG.alto + gA); ctx.stroke();
    ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
    ctx.fillText(String(d.getHours()).padStart(2, '0'), x(ms), MG.alto + gA + 4);
  }

  // --- il profilo degli ostacoli ---
  if (!orizzonteLibero()) {
    ctx.fillStyle = 'rgba(120, 113, 108, 0.42)';
    ctx.beginPath();
    ctx.moveTo(x(curva.punti[0].ms), MG.alto + gA);
    curva.punti.forEach(p => ctx.lineTo(x(p.ms), y(orizzonteAltezza(p.az))));
    ctx.lineTo(x(curva.punti[curva.punti.length - 1].ms), MG.alto + gA);
    ctx.closePath(); ctx.fill();
  }

  // --- la Luna ---
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.34)';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  curva.luna.forEach((p, i) => i ? ctx.lineTo(x(p.ms), y(p.alt)) : ctx.moveTo(x(p.ms), y(p.alt)));
  ctx.stroke();
  ctx.setLineDash([]);

  // --- il bersaglio ---
  // Piena dove è sopra gli ostacoli, sottile dove è coperto: la
  // differenza fra "c'è" e "lo vedi" deve saltare all'occhio.
  [{ soloVisibile: false, colore: 'rgba(96, 165, 250, 0.35)', spessore: 1.4 },
   { soloVisibile: true, colore: '#60a5fa', spessore: 2.4 }].forEach(passo => {
    ctx.strokeStyle = passo.colore;
    ctx.lineWidth = passo.spessore;
    ctx.beginPath();
    let staccato = true;
    curva.punti.forEach(p => {
      const salta = passo.soloVisibile ? p.sopraOstacoli <= 0 : false;
      if (salta) { staccato = true; return; }
      if (staccato) { ctx.moveTo(x(p.ms), y(p.alt)); staccato = false; }
      else ctx.lineTo(x(p.ms), y(p.alt));
    });
    ctx.stroke();
  });

  // --- il momento buono ---
  if (curva.migliore) {
    const px = x(curva.migliore.ms), py = y(curva.migliore.alt);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, MG.alto + gA); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#facc15';
    ctx.beginPath(); ctx.arc(px, py, 3.4, 0, Math.PI * 2); ctx.fill();
  }

  if (etichetta) {
    ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(etichetta, MG.s + 6, MG.alto + 4);
  }
}

// Il riassunto a parole della curva, per chi il grafico non lo guarda
function pianRaccontoCurva(curva) {
  const T = (k, v) => astroI18n.t('curva.' + k, v);
  if (!curva) return T('servePosizione');
  if (!curva.migliore) {
    if (curva.culmine && curva.culmine.alt > 0) return T('soloDiGiorno');
    return T('nonSorgeMai');
  }
  const ore = curva.oreUtili;
  const quanto = ore >= 6 ? T('quasiTuttaLaNotte')
               : ore >= 3 ? T('circaOre', { n: Math.round(ore) })
               : ore >= 1 ? T('pocoPiuDiUnOra') : T('menoDiUnOra');
  return T('momentoBuono', {
    ora: oraBreve(new Date(curva.migliore.ms)),
    gradi: Math.round(curva.migliore.alt),
    quanto
  });
}


// =====================================================================
// 3. I MIGLIORI DI STANOTTE
//
//     Il punteggio è una somma di penalità, non un voto di bellezza.
//     Ogni motivo per cui una cosa stasera è meno buona toglie punti, e
//     ogni penalità si porta dietro la sua spiegazione — perché "M13:
//     72" non dice niente, mentre "M13: alto e in cielo buio, ma la Luna
//     è al 78%" dice tutto.
// =====================================================================

// I bersagli fra cui scegliere: i pianeti, la Luna, il cielo profondo che
// il catalogo conosce, e i corpi minori abbastanza luminosi.
function pianBersagli() {
  const lista = [];

  ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'].forEach(id => {
    lista.push({ tipo: 'pianeta', id, nome: pianNomePianeta(id) });
  });
  lista.push({ tipo: 'luna', id: 'Moon', nome: 'Luna' });

  if (typeof catPronto === 'function' && catPronto()) {
    cat.profondo.forEach(o => lista.push({
      tipo: 'profondo', nome: o.nome, ra: o.ra, dec: o.dec, dato: o
    }));
  }

  if (typeof corpiMinoriInteressanti === 'function') {
    try {
      corpiMinoriInteressanti(new Date(), 11).forEach(c => lista.push({
        tipo: 'corpoMinore', nome: c.nome, ra: c.ra, dec: c.dec, mag: c.mag, dato: c
      }));
    } catch (e) { /* dati non ancora caricati */ }
  }

  return lista;
}

const PIAN_NOMI_PIANETI = {
  Mercury: 'Mercurio', Venus: 'Venere', Mars: 'Marte', Jupiter: 'Giove',
  Saturn: 'Saturno', Uranus: 'Urano', Neptune: 'Nettuno'
};
function pianNomePianeta(id) { return PIAN_NOMI_PIANETI[id] || id; }

// Con che nome il planetario conosce questo bersaglio.
//   Serve al tasto "Planetario" della dashboard: da lì si apre il cielo già
//   puntato su quello che si stava leggendo, che è il gesto successivo
//   naturale a «M31, sale fino a 62° verso le 2:10». I pianeti e la Luna si
//   chiamano come li chiama Astronomy Engine; il cielo profondo e i corpi
//   minori portano il loro prefisso, e `skyVoceDiId()` sa leggerli tutt'e tre.
function pianIdCielo(b) {
  if (b.tipo === 'profondo') return 'dso:' + b.nome;
  if (b.tipo === 'corpoMinore') return 'min:' + b.nome;
  return b.id || null;
}

// Quanto disturba la Luna stanotte: zero se è nuova o sotto l'orizzonte,
// uno se è piena e alta. Si calcola una volta per tutta la classifica.
function pianDisturboLunare(quando) {
  const obs = osservatoreCorrente();
  if (!obs) return { fattore: 0, testo: null };
  try {
    const t = Astronomy.MakeTime(quando);
    const ill = Astronomy.Illumination('Moon', t);
    const pos = altAzCorpo('Moon', quando, obs);
    if (pos.alt <= 0) return { fattore: 0, testo: astroI18n.t('notte.lunaSottoOrizzonte') };
    // Sotto i venti gradi la Luna illumina molto meno: la sua luce
    // attraversa più atmosfera e non arriva allo zenit.
    const quantoAlta = Math.min(1, pos.alt / 40);
    const fattore = ill.phase_fraction * quantoAlta;
    return {
      fattore,
      testo: fattore > 0.15
        ? astroI18n.t('notte.lunaAlPerCento', {
            perc: Math.round(ill.phase_fraction * 100), gradi: Math.round(pos.alt) })
        : null
    };
  } catch (e) {
    return { fattore: 0, testo: null };
  }
}

// Quante nuvole nel cuore della notte, se la previsione c'è
function pianNuvoleStanotte(buio) {
  if (typeof meteo === 'undefined' || !meteo || !Array.isArray(meteo.ore) || !buio) return null;
  const da = (buio.buioInizio || buio.tramonto || new Date()).getTime();
  const a = (buio.buioFine || buio.alba || new Date(da + 6 * 3600000)).getTime();
  const dentro = meteo.ore.filter(o => o.ms >= da && o.ms <= a && o.nuvole !== null);
  if (!dentro.length) return null;
  return dentro.reduce((s, o) => s + o.nuvole, 0) / dentro.length;
}

function migliorDiStanotte(quanti) {
  const obs = osservatoreCorrente();
  if (!obs) return [];

  const adesso = new Date();
  const buio = finestraBuio(adesso);
  if (!buio || !buio.tramonto) return [];

  const bortle = typeof cieloDiCasa === 'function' ? cieloDiCasa() : 5;
  const luna = pianDisturboLunare(buio.buioInizio || buio.tramonto);
  const nuvole = pianNuvoleStanotte(buio);

  const voti = pianBersagli().map(b => {
    const curva = pianCurvaNotturna(b.ra !== undefined ? { ra: b.ra, dec: b.dec } : b.id, adesso);
    if (!curva || !curva.migliore) return null;

    const motivi = [];
    let punti = 100;

    // --- quanto sale ---
    const alt = curva.migliore.alt;
    const M = (k, v) => astroI18n.t('motivo.' + k, v);
    if (alt < 20) { punti -= 30; motivi.push(M('restaBasso', { gradi: Math.round(alt) })); }
    else if (alt < 35) { punti -= 12; motivi.push(M('nonSaleMolto', { gradi: Math.round(alt) })); }
    else motivi.push(M('saleFinoA', { gradi: Math.round(alt) }));

    // --- per quanto tempo ---
    if (curva.oreUtili < 1) { punti -= 25; motivi.push(M('mezzOra')); }
    else if (curva.oreUtili < 2.5) { punti -= 10; motivi.push(M('finestraStretta', { n: Math.round(curva.oreUtili) })); }

    // --- il disturbo della Luna, che non tocca tutti allo stesso modo ---
    // Sui pianeti e sulla Luna stessa non conta niente: sono luminosi, e
    // il chiarore di fondo non se li mangia. Su una galassia debole
    // conta più di ogni altra cosa.
    if (b.tipo === 'profondo' && luna.fattore > 0.1) {
      const quantoSoffre = b.dato && b.dato.brillanza > 12 ? 45 : 25;
      punti -= Math.round(luna.fattore * quantoSoffre);
      if (luna.testo) motivi.push(luna.testo.toLowerCase());
    }

    // --- si vede con quello che hai? ---
    let strumento = null;
    if (b.tipo === 'profondo' && typeof profondoStrumento === 'function') {
      strumento = profondoStrumento(b.dato, bortle);
      if (strumento === 'telescopio') { punti -= 8; motivi.push(M('serveIlTelescopio')); }
    } else if (b.tipo === 'corpoMinore') {
      strumento = b.mag <= 6 ? 'occhio' : b.mag <= 9 ? 'binocolo' : 'telescopio';
      motivi.push(M('magnitudine', { mag: astroI18n.numero(b.mag, 1) }));
    }

    // --- il cielo che hai ---
    // Sotto un cielo di città un oggetto esteso e debole non c'è: non è
    // una penalità, è un fatto, e va detto invece di proporlo lo stesso.
    if (b.tipo === 'profondo' && strumento === 'telescopio' && b.dato.brillanza > 13.5 && bortle >= 6) {
      punti -= 30;
      motivi.push(M('quasiImpossibile'));
    }

    // --- il meteo, uguale per tutti ---
    if (nuvole !== null && nuvole > 30) {
      punti -= Math.round((nuvole - 30) * 0.5);
    }

    return {
      nome: b.nome, tipo: b.tipo, dato: b.dato, strumento,
      idCielo: pianIdCielo(b),
      punti: Math.max(0, Math.min(100, punti)),
      quando: new Date(curva.migliore.ms),
      altezza: alt, oreUtili: curva.oreUtili,
      motivi, curva
    };
  }).filter(Boolean);

  voti.sort((a, b) => b.punti - a.punti || b.altezza - a.altezza);

  // Un elenco di venti galassie tutte uguali non serve: meglio un po' di
  // ogni cosa. Si prende il meglio di ogni famiglia, poi si riempie.
  const scelti = [];
  const perTipo = {};
  voti.forEach(v => {
    perTipo[v.tipo] = (perTipo[v.tipo] || 0);
    if (perTipo[v.tipo] < 4) { scelti.push(v); perTipo[v.tipo]++; }
  });
  voti.forEach(v => { if (!scelti.includes(v)) scelti.push(v); });

  return scelti.slice(0, quanti || 12);
}

// Il riassunto della notte: com'è, in una riga
function pianComEStanotte() {
  const buio = finestraBuio(new Date());
  if (!buio || !buio.tramonto) return null;

  const luna = pianDisturboLunare(buio.buioInizio || buio.tramonto);
  const nuvole = pianNuvoleStanotte(buio);
  const bortle = typeof cieloDiCasa === 'function' ? cieloDiCasa() : 5;
  const cielo = typeof CAT_CIELI !== 'undefined' ? CAT_CIELI[bortle] : null;

  const N = (k, v) => astroI18n.t('notte.' + k, v);
  const pezzi = [];
  if (nuvole !== null) {
    pezzi.push(N(nuvole <= 20 ? 'sereno' : nuvole <= 50 ? 'aTratti'
             : nuvole <= 80 ? 'moltoNuvoloso' : 'coperto'));
  }
  if (luna.fattore < 0.1) pezzi.push(N('senzaLuna'));
  else if (luna.fattore > 0.5) pezzi.push(N('lunaSchiarisce'));
  else pezzi.push(N('unPoDiLuna'));
  // Il nome della scala di Bortle va in minuscolo dentro alla frase in
  // italiano; in inglese non si tocca, e a saperlo è il dizionario.
  if (cielo) pezzi.push(N('daUnCielo', { cielo: cielo.nome.toLowerCase() }));

  return {
    testo: pezzi.join(', '),
    buio,
    nuvole,
    luna,
    // Il voto della notte in sé, prima ancora di scegliere cosa guardare
    voto: Math.max(0, Math.round(100
      - (nuvole !== null ? nuvole * 0.7 : 20)
      - luna.fattore * 30))
  };
}
