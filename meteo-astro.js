// =====================================================================
// IL METEO DA ASTRONOMO
//
// Il meteo normale risponde a «piove?». A chi guarda il cielo quella
// domanda non basta: una notte può essere perfettamente asciutta e
// perfettamente inutile.
//
// Servono tre cose, e sono tre cose diverse:
//
//   LE NUVOLE. Quante, e a che quota. Non è pignoleria: i cirri a
//   diecimila metri lasciano passare la Luna e i pianeti ma spengono
//   ogni galassia, mentre uno strato basso a mille metri copre tutto ma
//   spesso si buca. Un solo numero di «copertura» mescola i due casi e
//   non serve a nessuno.
//
//   IL SEEING. Quanto trema l'immagine. Non dipende dalle nuvole ma
//   dalla turbolenza dell'aria in quota — soprattutto dalla corrente a
//   getto, che a diecimila metri corre a duecento all'ora e mescola
//   strati a temperature diverse. Una notte limpida sotto la corrente a
//   getto dà stelle che ballano e un pianeta impossibile da ingrandire.
//
//   LA TRASPARENZA. Quanta luce passa. È polvere, umidità, sabbia del
//   Sahara, fumo: aria pulitissima e aria lattiginosa possono essere
//   tutt'e due «serene».
//
// È il mestiere di Astrospheric, che però è nato per il Nord America e
// sull'Italia copre male. Qui si fa con Open-Meteo, gratis e senza
// chiave, e si disegna nella griglia oraria del Clear Sky Chart — che è
// il modo in cui gli astrofili leggono una notte da vent'anni.
//
// Ordine di caricamento: dopo app.js (usa `luogoCorrente`, `oraBreve`).
// =====================================================================


// =====================================================================
// 1. SCARICARE I DATI
// =====================================================================

const CHIAVE_METEO_ASTRO = 'astrocalendario_meteo_astro';
const METEO_ASTRO_GIORNI = 3;          // oltre i tre giorni queste previsioni non valgono niente
const METEO_ASTRO_VALIDO_MS = 60 * 60 * 1000;

// I campi orari che servono. Sono tutti gratuiti e senza chiave; quelli
// con il suffisso hPa sono a quota di pressione invece che al suolo.
const METEO_ASTRO_CAMPI = [
  'cloud_cover',            // copertura totale
  'cloud_cover_low',        // sotto i 3 km: quella che si buca
  'cloud_cover_mid',        // 3–8 km
  'cloud_cover_high',       // sopra gli 8 km: i cirri, i traditori
  'temperature_2m',
  'relative_humidity_2m',
  'dew_point_2m',           // per la rugiada sull'ottica
  'wind_speed_10m',         // il vento al suolo fa vibrare il tubo
  'wind_gusts_10m',
  'visibility',
  'precipitation_probability',
  'wind_speed_250hPa',      // la corrente a getto: il seeing nasce qui
  'temperature_500hPa',
  'cape'                    // instabilità: aria che sale, immagine che balla
].join(',');

let meteoAstro = null;
let meteoAstroInCorso = null;

function meteoAstroDaCache() {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_METEO_ASTRO) || 'null');
    return v && Array.isArray(v.ore) ? v : null;
  } catch (e) {
    return null;
  }
}

function meteoAstroAncoraValido(m, luogo) {
  if (!m || !luogo || !Array.isArray(m.ore) || !m.ore.length) return false;
  if (Date.now() - m.quando > METEO_ASTRO_VALIDO_MS) return false;
  return Math.abs(m.lat - luogo.lat) < 0.3 && Math.abs(m.lon - luogo.lon) < 0.3;
}

function caricaMeteoAstro(forza) {
  const luogo = typeof luogoCorrente === 'function' ? luogoCorrente() : null;
  if (!luogo) return Promise.resolve(null);

  if (!forza) {
    if (meteoAstroAncoraValido(meteoAstro, luogo)) return Promise.resolve(meteoAstro);
    const salvato = meteoAstroDaCache();
    if (meteoAstroAncoraValido(salvato, luogo)) { meteoAstro = salvato; return Promise.resolve(meteoAstro); }
  }
  if (meteoAstroInCorso) return meteoAstroInCorso;

  const base = 'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${luogo.lat.toFixed(4)}&longitude=${luogo.lon.toFixed(4)}` +
    `&hourly=${METEO_ASTRO_CAMPI}&forecast_days=${METEO_ASTRO_GIORNI}&timezone=auto`;

  // La qualità dell'aria è un'altra API, e chiederla insieme sarebbe più
  // comodo: non si può. Se non risponde si continua lo stesso — senza,
  // la trasparenza si stima dall'umidità, peggio ma non è la fine.
  const aria = 'https://air-quality-api.open-meteo.com/v1/air-quality' +
    `?latitude=${luogo.lat.toFixed(4)}&longitude=${luogo.lon.toFixed(4)}` +
    '&hourly=aerosol_optical_depth,dust&forecast_days=' + METEO_ASTRO_GIORNI + '&timezone=auto';

  meteoAstroInCorso = Promise.all([
    fetch(base).then(r => { if (!r.ok) throw new Error('meteo non valido'); return r.json(); }),
    fetch(aria).then(r => r.ok ? r.json() : null).catch(() => null)
  ])
    .then(([m, a]) => {
      const h = m.hourly || {};
      const ah = (a && a.hourly) || {};
      const indiceAria = new Map();
      (ah.time || []).forEach((t, i) => indiceAria.set(t, i));

      const ore = (h.time || []).map((t, i) => {
        const ia = indiceAria.has(t) ? indiceAria.get(t) : -1;
        const p = k => (h[k] && h[k][i] !== null && h[k][i] !== undefined) ? h[k][i] : null;
        return {
          ms: new Date(t).getTime(),
          nuvole: p('cloud_cover'),
          nuvoleBasse: p('cloud_cover_low'),
          nuvoleMedie: p('cloud_cover_mid'),
          nuvoleAlte: p('cloud_cover_high'),
          temp: p('temperature_2m'),
          umidita: p('relative_humidity_2m'),
          rugiada: p('dew_point_2m'),
          vento: p('wind_speed_10m'),
          raffiche: p('wind_gusts_10m'),
          visibilita: p('visibility'),
          pioggia: p('precipitation_probability'),
          getto: p('wind_speed_250hPa'),
          temp500: p('temperature_500hPa'),
          cape: p('cape'),
          aerosol: ia >= 0 && ah.aerosol_optical_depth ? ah.aerosol_optical_depth[ia] : null,
          polvere: ia >= 0 && ah.dust ? ah.dust[ia] : null
        };
      }).filter(o => !isNaN(o.ms));

      ore.forEach(o => {
        o.seeing = meteoSeeing(o);
        o.trasparenza = meteoTrasparenza(o);
        o.scartoRugiada = (o.temp !== null && o.rugiada !== null) ? o.temp - o.rugiada : null;
      });

      meteoAstro = { lat: luogo.lat, lon: luogo.lon, quando: Date.now(), ore };
      try { localStorage.setItem(CHIAVE_METEO_ASTRO, JSON.stringify(meteoAstro)); } catch (e) { /* pieno */ }
      return meteoAstro;
    })
    .catch(() => {
      const salvato = meteoAstroDaCache();
      if (salvato) meteoAstro = salvato;
      return meteoAstro;
    })
    .finally(() => { meteoAstroInCorso = null; });

  return meteoAstroInCorso;
}


// =====================================================================
// 2. DA NUMERI DI METEOROLOGIA A NUMERI DI ASTRONOMIA
//
//     Nessun servizio meteo pubblica «il seeing»: è una grandezza
//     astronomica, e chi fa previsioni per l'agricoltura non ha motivo
//     di calcolarla. Si stima da quello che c'è, e va detto chiaramente
//     che è una stima — non una misura.
// =====================================================================

// Il seeing, in una scala da 1 (immagine ferma) a 5 (poltiglia).
//
// Il pezzo grosso è la corrente a getto: a 250 hPa, cioè attorno ai
// diecimila metri, il vento può passare da venti a duecentocinquanta
// chilometri orari, e quando corre così mescola strati d'aria a
// temperature diverse. Ogni confine fra due strati è una lente che si
// deforma, e il risultato è la stella che balla.
//
// Poi contano il vento al suolo (che fa vibrare il tubo e rimescola
// l'aria calda che sale dai tetti) e l'instabilità — il CAPE, la stessa
// grandezza con cui si prevedono i temporali: aria che sale è aria che
// non sta ferma.
function meteoSeeing(o) {
  let s = 1.4;

  if (o.getto !== null) {
    // Sotto i 40 km/h non si sente; sopra i 180 non c'è più niente da
    // rovinare. In mezzo cresce quasi in proporzione.
    s += Math.max(0, Math.min(2.4, (o.getto - 40) / 60));
  } else {
    s += 0.8;                                  // senza il dato, stima prudente
  }

  if (o.vento !== null) s += Math.max(0, Math.min(0.8, (o.vento - 12) / 22));
  if (o.cape !== null) s += Math.max(0, Math.min(0.7, o.cape / 700));

  return Math.max(1, Math.min(5, s));
}

// La trasparenza, sempre da 1 (aria di cristallo) a 5 (lattiginosa).
//
// Qui il dato buono è lo spessore ottico degli aerosol, che l'API della
// qualità dell'aria dà per davvero: è letteralmente quanta luce viene
// assorbita dalla colonna d'aria sopra di te. Quando manca, l'umidità è
// un surrogato passabile — l'acqua sospesa diffonde come la polvere.
function meteoTrasparenza(o) {
  let t = 1.5;

  if (o.aerosol !== null && o.aerosol !== undefined) {
    // Sotto 0,05 è aria di montagna; sopra 0,4 è foschia vera
    t += Math.max(0, Math.min(2.5, (o.aerosol - 0.05) / 0.14));
  } else if (o.umidita !== null) {
    t += Math.max(0, Math.min(1.8, (o.umidita - 55) / 22));
  }

  if (o.polvere !== null && o.polvere > 20) t += Math.min(0.8, o.polvere / 120);
  // Le nuvole alte non coprono, ma velano: un cirro sottile toglie mezza
  // magnitudine senza che a occhio sembri nuvoloso
  if (o.nuvoleAlte !== null) t += Math.min(0.9, o.nuvoleAlte / 110);
  if (o.visibilita !== null && o.visibilita < 15000) t += Math.min(0.7, (15000 - o.visibilita) / 14000);

  return Math.max(1, Math.min(5, t));
}

const METEO_PAROLE = ['', 'ottimo', 'buono', 'discreto', 'scarso', 'pessimo'];
function meteoParola(v) {
  return METEO_PAROLE[Math.max(1, Math.min(5, Math.round(v)))];
}

// Il voto di un'ora, da 0 a 100: quanto vale davvero uscire in quell'ora
function meteoVotoOra(o) {
  if (!o) return null;
  let v = 100;
  if (o.nuvole !== null) v -= o.nuvole * 0.75;
  v -= (o.seeing - 1) * 7;
  v -= (o.trasparenza - 1) * 6;
  if (o.pioggia !== null) v -= o.pioggia * 0.35;
  return Math.max(0, Math.round(v));
}


// =====================================================================
// 3. LA GRIGLIA DEL CLEAR SKY CHART
//
//     Ore in colonna, grandezze in riga, un quadratino colorato per
//     ognuna. Chi guarda il cielo la legge in due secondi: cerca la
//     colonna di quadratini scuri, e quella è la sua notte.
//
//     È una tabella HTML, non un canvas: si può leggere con lo schermo
//     al buio, si copia, e chi usa un lettore di schermo la sente.
// =====================================================================

const METEO_RIGHE = [
  { chiave: 'nuvole',       nome: 'Nuvole',       verso: 'meno-meglio', max: 100, unita: '%' },
  { chiave: 'nuvoleAlte',   nome: 'Nuvole alte',  verso: 'meno-meglio', max: 100, unita: '%' },
  { chiave: 'seeing',       nome: 'Seeing',       verso: 'meno-meglio', max: 5, scala: 'cinque' },
  { chiave: 'trasparenza',  nome: 'Trasparenza',  verso: 'meno-meglio', max: 5, scala: 'cinque' },
  { chiave: 'vento',        nome: 'Vento',        verso: 'meno-meglio', max: 40, unita: ' km/h' },
  { chiave: 'scartoRugiada', nome: 'Rugiada',     verso: 'piu-meglio',  max: 12, unita: '°' }
];

// Da un valore alla sua casella colorata. Cinque livelli, dal blu scuro
// (ottimo) al bianco sporco (pessimo) — la stessa scala del Clear Sky
// Chart originale, che tutti riconoscono.
const METEO_COLORI = ['#0b2559', '#1e4d8f', '#4a7fbf', '#93b4d6', '#dfe6ee'];

function meteoCasella(riga, valore) {
  if (valore === null || valore === undefined) return { colore: '#1e293b', livello: null };
  let k;
  if (riga.verso === 'piu-meglio') {
    // La rugiada è al contrario: più margine c'è fra temperatura e punto
    // di rugiada, meglio è. Sotto i due gradi l'ottica si appanna.
    k = 1 - Math.max(0, Math.min(1, valore / riga.max));
  } else {
    k = Math.max(0, Math.min(1, valore / riga.max));
  }
  const livello = Math.min(4, Math.floor(k * 5));
  return { colore: METEO_COLORI[livello], livello };
}

function meteoTestoCasella(riga, valore) {
  if (valore === null || valore === undefined) return '—';
  if (riga.scala === 'cinque') return meteoParola(valore);
  return Math.round(valore) + (riga.unita || '');
}

// Costruisce la griglia per le prossime `ore` ore, a partire da adesso.
function meteoGrigliaHtml(ore) {
  if (!meteoAstro || !meteoAstro.ore.length) {
    return '<p class="nota-meteo">Previsioni non ancora disponibili.</p>';
  }

  const adesso = Date.now() - 3600000;
  const finestra = meteoAstro.ore.filter(o => o.ms >= adesso).slice(0, ore || 30);
  if (!finestra.length) return '<p class="nota-meteo">Previsioni scadute.</p>';

  // Le ore di notte si segnano: è quello che si sta cercando, e in una
  // griglia di trenta colonne senza un segno ci si perde.
  const obs = typeof osservatoreCorrente === 'function' ? osservatoreCorrente() : null;
  const notturna = o => {
    if (!obs) return false;
    try { return altAzCorpo('Sun', new Date(o.ms), obs).alt < -12; } catch (e) { return false; }
  };

  const intestazione = finestra.map(o => {
    const d = new Date(o.ms);
    return `<th scope="col" class="${notturna(o) ? 'ora-notte' : ''}" title="${d.toLocaleString('it')}">${
      String(d.getHours()).padStart(2, '0')}</th>`;
  }).join('');

  const righe = METEO_RIGHE.map(r => {
    const celle = finestra.map(o => {
      const v = o[r.chiave];
      const c = meteoCasella(r, v);
      return `<td class="cella-meteo" style="background:${c.colore}" ` +
             `title="${r.nome}: ${meteoTestoCasella(r, v)}"><span class="sr-only">${meteoTestoCasella(r, v)}</span></td>`;
    }).join('');
    return `<tr><th scope="row">${r.nome}</th>${celle}</tr>`;
  }).join('');

  // La riga dei giorni, sopra le ore: senza, trenta numeri di fila non
  // dicono se le tre di notte sono stanotte o domani
  const giorni = [];
  finestra.forEach((o, i) => {
    const g = new Date(o.ms).toLocaleDateString('it', { weekday: 'short' });
    if (!giorni.length || giorni[giorni.length - 1].nome !== g) giorni.push({ nome: g, quante: 1 });
    else giorni[giorni.length - 1].quante++;
  });
  const rigaGiorni = giorni.map(g =>
    `<th scope="col" colspan="${g.quante}" class="giorno-meteo">${g.nome}</th>`).join('');

  return `<div class="griglia-meteo-guscio"><table class="griglia-meteo">
    <thead><tr><th></th>${rigaGiorni}</tr><tr><th class="ang-meteo">ora</th>${intestazione}</tr></thead>
    <tbody>${righe}</tbody></table></div>
    <p class="legenda-meteo"><span class="scala-meteo">${
      METEO_COLORI.map(c => `<i style="background:${c}"></i>`).join('')
    }</span> da ottimo a pessimo. Le ore col fondo scuro sono quelle di buio astronomico.</p>`;
}

// La finestra migliore delle prossime notti, detta a parole: è quello
// che uno vuole sapere davvero, senza leggere nessuna griglia.
function meteoFinestraMigliore() {
  if (!meteoAstro || !meteoAstro.ore.length) return null;
  const obs = typeof osservatoreCorrente === 'function' ? osservatoreCorrente() : null;
  if (!obs) return null;

  const adesso = Date.now();
  const buone = meteoAstro.ore.filter(o => {
    if (o.ms < adesso) return false;
    try { return altAzCorpo('Sun', new Date(o.ms), obs).alt < -12; } catch (e) { return false; }
  }).map(o => ({ o, voto: meteoVotoOra(o) }));

  if (!buone.length) return null;

  // Il tratto continuo migliore, non l'ora migliore: un'ora buona in
  // mezzo a cinque pessime non è una serata.
  let miglioreTratto = null, corrente = null;
  buone.forEach(({ o, voto }) => {
    if (voto >= 55) {
      if (corrente && o.ms - corrente.fine <= 3600000 * 1.5) {
        corrente.fine = o.ms; corrente.somma += voto; corrente.quante++;
      } else {
        corrente = { inizio: o.ms, fine: o.ms, somma: voto, quante: 1 };
      }
      if (!miglioreTratto || corrente.somma > miglioreTratto.somma) miglioreTratto = corrente;
    } else {
      corrente = null;
    }
  });

  if (!miglioreTratto) {
    const peggioIlMeno = buone.reduce((a, b) => b.voto > a.voto ? b : a);
    return {
      niente: true,
      testo: 'Nelle prossime notti non c\'è una finestra decente. ' +
             `Il meno peggio è verso le ${oraBreve(new Date(peggioIlMeno.o.ms))}.`
    };
  }

  const da = new Date(miglioreTratto.inizio), a = new Date(miglioreTratto.fine);
  const stanotte = da.getTime() - adesso < 20 * 3600000;
  return {
    inizio: da, fine: a,
    voto: Math.round(miglioreTratto.somma / miglioreTratto.quante),
    testo: `${stanotte ? 'Stanotte' : da.toLocaleDateString('it', { weekday: 'long' })} ` +
           `dalle ${oraBreve(da)} alle ${oraBreve(a)}` +
           (miglioreTratto.quante >= 4 ? ' — una finestra lunga' : '')
  };
}


// =====================================================================
// 4. L'AURORA
//
//     Dalle nostre latitudini l'aurora è rarissima, e proprio per questo
//     è la cosa che uno non si perdona di aver perso. Nel maggio del
//     2024 si è vista dalla Pianura Padana e mezza Italia l'ha saputo il
//     giorno dopo dalle fotografie degli altri.
//
//     L'indice Kp misura quanto è disturbato il campo magnetico
//     terrestre, da 0 a 9. Più è alto, più l'ovale aurorale scende verso
//     sud. La corrispondenza fra Kp e latitudine è nota e stabile, e
//     basta a dire «da dove sei, stanotte, potrebbe valere la pena
//     guardare a nord».
//
//     I dati vengono dal NOAA Space Weather Prediction Center: pubblici,
//     senza chiave.
// =====================================================================

const AURORA_URL_ORA = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const AURORA_URL_PREVISIONE = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';
const CHIAVE_AURORA = 'astrocalendario_aurora';

// A che latitudine geomagnetica arriva l'ovale aurorale per ogni Kp.
// Sono i valori classici della scala: ogni punto di Kp fa scendere il
// confine di circa due gradi.
const AURORA_CONFINE = { 0: 66.5, 1: 64.5, 2: 62.4, 3: 60.4, 4: 58.3, 5: 56.3, 6: 54.2, 7: 52.2, 8: 50.1, 9: 48.1 };

// La latitudine geomagnetica non è quella geografica: il polo nord
// magnetico non sta sul polo. Per l'Italia lo scarto vale parecchio —
// Milano è a 45,5° geografici ma a circa 44° geomagnetici, cioè un po'
// più lontana dall'aurora di quanto la carta faccia pensare.
//
// La formula esatta richiederebbe il modello completo del campo; questa
// è l'approssimazione a dipolo, che per l'Europa sbaglia di meno di un
// grado ed è più che abbastanza per dire «vale la pena o no».
const AURORA_POLO_LAT = 80.7 * Math.PI / 180;      // polo geomagnetico nord, epoca 2025
const AURORA_POLO_LON = -72.7 * Math.PI / 180;

function latitudineGeomagnetica(lat, lon) {
  const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
  const sin = Math.sin(la) * Math.sin(AURORA_POLO_LAT) +
              Math.cos(la) * Math.cos(AURORA_POLO_LAT) * Math.cos(lo - AURORA_POLO_LON);
  return Math.asin(Math.max(-1, Math.min(1, sin))) * 180 / Math.PI;
}

let aurora = null;

function caricaAurora(forza) {
  if (!forza && aurora && Date.now() - aurora.quando < 30 * 60000) return Promise.resolve(aurora);

  return Promise.all([
    fetch(AURORA_URL_ORA).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(AURORA_URL_PREVISIONE).then(r => r.ok ? r.json() : null).catch(() => null)
  ])
    .then(([ora, previsione]) => {
      // Il NOAA restituisce una tabella: prima riga i nomi delle colonne,
      // poi i dati. Non è JSON strutturato, è un CSV travestito.
      let kpOra = null;
      if (Array.isArray(ora) && ora.length > 1) {
        const ultima = ora[ora.length - 1];
        kpOra = parseFloat(ultima[1]);
      }

      let massimoPrevisto = null;
      const prossime = [];
      if (Array.isArray(previsione) && previsione.length > 1) {
        previsione.slice(1).forEach(r => {
          const quando = new Date(r[0].replace(' ', 'T') + 'Z');
          const kp = parseFloat(r[1]);
          if (isNaN(quando.getTime()) || isNaN(kp)) return;
          if (quando.getTime() < Date.now() - 3600000) return;
          prossime.push({ quando, kp });
          if (massimoPrevisto === null || kp > massimoPrevisto) massimoPrevisto = kp;
        });
      }

      aurora = { quando: Date.now(), kp: kpOra, massimoPrevisto, prossime };
      try { localStorage.setItem(CHIAVE_AURORA, JSON.stringify(aurora)); } catch (e) { /* pieno */ }
      return aurora;
    })
    .catch(() => {
      try {
        const v = JSON.parse(localStorage.getItem(CHIAVE_AURORA) || 'null');
        if (v) aurora = v;
      } catch (e) { /* niente */ }
      return aurora;
    });
}

// Vale la pena guardare a nord stanotte?
function auroraDaQui() {
  const luogo = typeof luogoCorrente === 'function' ? luogoCorrente() : null;
  if (!luogo || !aurora) return null;

  const mia = latitudineGeomagnetica(luogo.lat, luogo.lon);
  const kp = aurora.massimoPrevisto !== null ? aurora.massimoPrevisto : aurora.kp;
  if (kp === null || kp === undefined || isNaN(kp)) return null;

  const confine = AURORA_CONFINE[Math.round(Math.max(0, Math.min(9, kp)))];

  // Il confine è dove l'aurora sta SOPRA la testa. Il bagliore basso
  // sull'orizzonte si vede da tre o quattro gradi più a sud, ed è
  // esattamente il caso italiano: non l'aurora addosso, ma il cielo
  // rosso a nord.
  const scarto = mia - confine;

  let livello, testo;
  if (scarto >= 0) {
    livello = 'alta';
    testo = `Con Kp ${kp.toFixed(1)} l'aurora arriva sopra la tua latitudine: guarda a nord.`;
  } else if (scarto >= -4) {
    livello = 'possibile';
    testo = `Con Kp ${kp.toFixed(1)} il bagliore potrebbe affacciarsi basso sull'orizzonte nord. Serve un orizzonte libero e niente luci.`;
  } else if (scarto >= -8) {
    livello = 'improbabile';
    testo = `Kp ${kp.toFixed(1)}: da qui è improbabile, servirebbe una tempesta più forte.`;
  } else {
    livello = 'no';
    testo = null;                       // sotto questa soglia non si dice niente: sarebbe rumore
  }

  return { livello, testo, kp, latGeomagnetica: mia, confine, scarto };
}
