// Il nostro database locale di eventi calcolati al volo
let eventiCalcolati = [];
let fullCalendarInstance = null;
let contatoreId = 0; // per generare id univoci e "sicuri" (solo lettere+numeri)

// Categorie di eventi: usate dai filtri e dai badge nell'agenda
const CATEGORIE = {
  luna:      { nome: 'Fasi Lunari',      icona: '🌙' },
  eclissi:   { nome: 'Eclissi',          icona: '🌑' },
  stagioni:  { nome: 'Stagioni',         icona: '🍂' },
  meteore:   { nome: 'Sciami Meteorici', icona: '☄️' },
  pianeti:   { nome: 'Pianeti',          icona: '🪐' },
  personali: { nome: 'Personali',        icona: '📌' }
};

// Stato corrente dei filtri di ricerca (testo libero + categoria selezionata)
let filtroTesto = '';
let filtroCategoria = 'tutti';

// Fino a quale anno (compreso) calcolare gli eventi astronomici
const ANNO_LIMITE = 2030;

// Le eclissi (solari e lunari) sono eventi rari e attesi: le calcoliamo più a lungo termine
const ANNO_LIMITE_ECLISSI = 2070;

// Chiave usata per salvare gli eventi manuali nel browser
const CHIAVE_EVENTI_MANUALI = 'astrocalendario_eventi_manuali';

// Avvio al caricamento della pagina
window.addEventListener('DOMContentLoaded', () => {
  registraSW();
  calcolaEventiAstronomi();
  caricaEventiManuali();
  inizializzaUI();
  inizializzaFormAggiungi();
  inizializzaMappaEclissiUI();
  inizializzaInstallazione();
});

// Helper: crea un evento con id sicuro e testo data formattato
function creaEvento({ id, titolo, dataObj, spiegazione, colore, programma, manuale, linkMappa, categoria, eclissi }) {
  eventiCalcolati.push({
    id: id || `ev${contatoreId++}`,
    titolo,
    dataObj,
    dataTesto: formattData(dataObj),
    spiegazione,
    colore,
    programma,
    manuale: !!manuale,
    linkMappa: linkMappa || null,
    categoria: categoria || 'altro',
    // Dati per la mappa di visibilità (solo eclissi solari con fascia centrale)
    eclissi: eclissi || null
  });
}

// =====================================================================
// 1. Calcolo di TUTTI gli eventi tramite Astronomy Engine
//    Ogni categoria è isolata in un try/catch: se una fallisce,
//    le altre vengono comunque calcolate e la pagina non resta vuota.
// =====================================================================
function calcolaEventiAstronomi() {
  const oggi = new Date();
  // Calcoliamo da oggi fino alla fine dell'anno ANNO_LIMITE (calendario ricco e a lungo termine)
  const limite = new Date(ANNO_LIMITE, 11, 31, 23, 59, 59);
  // Le eclissi vengono calcolate fino a un orizzonte più lontano (ANNO_LIMITE_ECLISSI)
  const limiteEclissi = new Date(ANNO_LIMITE_ECLISSI, 11, 31, 23, 59, 59);

  if (typeof Astronomy === 'undefined') {
    console.error('Libreria Astronomy Engine non caricata.');
    mostraErrore('Impossibile caricare la libreria astronomica. Controlla la connessione.');
    return;
  }

  const t0 = new Astronomy.AstroTime(oggi);

  aggiungiFasiLunari(t0, limite);
  aggiungiEclissiLunari(t0, limiteEclissi);
  aggiungiEclissiSolari(t0, limiteEclissi);
  aggiungiStagioni(oggi, limite);
  aggiungiSciamiMeteorici(oggi, limite);
  aggiungiElongazioni(oggi, limite);

  // Ordina temporalmente
  eventiCalcolati.sort((a, b) => a.dataObj - b.dataObj);

  const loading = document.getElementById('loading-msg');
  if (loading) {
    if (eventiCalcolati.length === 0) {
      loading.textContent = `Nessun evento trovato da oggi fino al ${ANNO_LIMITE}.`;
    } else {
      loading.style.display = 'none';
    }
  }
}

// --- Fasi Lunari (tutte e quattro: Nuova, Primo Quarto, Piena, Ultimo Quarto) ---
function aggiungiFasiLunari(t0, limite) {
  try {
    const info = {
      0: {
        titolo: 'Luna Nuova',
        colore: '#64748b',
        spiegazione: 'La Luna si trova tra la Terra e il Sole. La faccia rivolta verso di noi è in ombra: cielo buio, ottimo per osservare le stelle profonde.',
        programma: {
          cosaPortare: 'Telescopio per galassie e nebulose, essendo il cielo molto buio.',
          doveVederlo: 'Vai lontano dalla città per sfruttare il buio totale.',
          comeVederlo: 'Usa una mappa stellare per orientarti al buio.'
        }
      },
      1: {
        titolo: 'Primo Quarto di Luna',
        colore: '#94a3b8',
        spiegazione: 'Metà del disco lunare è illuminato. È il momento migliore per osservare i crateri lungo il terminatore, dove le ombre sono lunghe e nette.',
        programma: {
          cosaPortare: 'Binocolo o piccolo telescopio per i crateri.',
          doveVederlo: 'Visibile la sera, alta nel cielo dopo il tramonto.',
          comeVederlo: 'Osserva la linea di confine luce/ombra: è lì che i dettagli risaltano.'
        }
      },
      2: {
        titolo: 'Luna Piena',
        colore: '#eab308',
        spiegazione: 'La Terra si trova tra il Sole e la Luna. Il disco lunare è completamente illuminato e brillante.',
        programma: {
          cosaPortare: 'Binocolo per i mari lunari; un filtro lunare aiuta contro la luce intensa.',
          doveVederlo: 'Dovunque il cielo sia sgombro verso l’orizzonte.',
          comeVederlo: 'A occhio nudo la luce è intensa: un filtro lunare rende l’osservazione più confortevole.'
        }
      },
      3: {
        titolo: 'Ultimo Quarto di Luna',
        colore: '#94a3b8',
        spiegazione: 'L’altra metà del disco lunare è illuminata. Sorge a notte fonda ed è visibile al mattino presto.',
        programma: {
          cosaPortare: 'Binocolo o telescopio; sveglia presto per l’alba.',
          doveVederlo: 'Nel cielo del mattino, prima dell’alba.',
          comeVederlo: 'Approfitta del cielo scuro della seconda parte della notte per il profondo cielo.'
        }
      }
    };

    let mq = Astronomy.SearchMoonQuarter(t0);
    // ~4 fasi per mese lunare: fino a ~4.5 anni servono circa 240 iterazioni
    for (let i = 0; i < 300; i++) {
      const dataFase = mq.time.date;
      if (dataFase > limite) break;
      const dati = info[mq.quarter];
      if (dati) {
        creaEvento({
          titolo: dati.titolo,
          dataObj: dataFase,
          spiegazione: dati.spiegazione,
          colore: dati.colore,
          programma: dati.programma,
          categoria: 'luna'
        });
      }
      mq = Astronomy.NextMoonQuarter(mq);
    }
  } catch (err) {
    console.error('Errore fasi lunari:', err);
  }
}

// --- Eclissi Lunari (tutte quelle nel periodo) ---
function aggiungiEclissiLunari(t0, limite) {
  try {
    const kindIt = { penumbral: 'Penombrale', partial: 'Parziale', total: 'Totale' };
    let ecl = Astronomy.SearchLunarEclipse(t0);
    // ~2,4 eclissi lunari/anno: fino al 2070 servono oltre 100 iterazioni
    for (let i = 0; i < 160; i++) {
      const dataPicco = ecl.peak.date; // BUGFIX: 'peak' è già un AstroTime
      if (dataPicco > limite) break;
      creaEvento({
        titolo: `Eclissi Lunare ${kindIt[ecl.kind] || ecl.kind}`,
        dataObj: dataPicco,
        spiegazione: 'La Terra proietta la sua ombra sulla Luna, oscurandola e, nelle eclissi totali, donandole un colore rossastro (“Luna di Sangue”).',
        colore: '#ef4444',
        categoria: 'eclissi',
        programma: {
          cosaPortare: 'Occhi aperti e, se vuoi, una macchina fotografica con teleobiettivo.',
          doveVederlo: 'Ovunque la Luna sia visibile sopra l’orizzonte.',
          comeVederlo: 'Si guarda tranquillamente a occhio nudo, senza alcun filtro.'
        }
      });
      ecl = Astronomy.NextLunarEclipse(ecl.peak); // richiede il tempo di picco (AstroTime)
    }
  } catch (err) {
    console.error('Errore eclissi lunari:', err);
  }
}

// --- Eclissi Solari (globali) ---
// Per ogni eclissi indichiamo il punto di massima visibilità (dove l'eclissi è
// massima, al centro della fascia) e la zona in cui è visibile la fase parziale.
function aggiungiEclissiSolari(t0, limite) {
  try {
    const kindIt = { partial: 'Parziale', annular: 'Anulare', total: 'Totale', hybrid: 'Ibrida' };
    let ecl = Astronomy.SearchGlobalSolarEclipse(t0);
    // ~2,4 eclissi solari/anno: fino al 2070 servono oltre 100 iterazioni
    for (let i = 0; i < 160; i++) {
      const dataPicco = ecl.peak.date;
      if (dataPicco > limite) break;

      const tipo = kindIt[ecl.kind] || ecl.kind;

      // Il punto di massima eclissi (lat/lon) è definito solo quando l'asse
      // dell'ombra tocca la Terra (eclissi totale, anulare o ibrida).
      const haCentro = typeof ecl.latitude === 'number' && !isNaN(ecl.latitude) &&
                       typeof ecl.longitude === 'number' && !isNaN(ecl.longitude);

      // Percentuale di Sole oscurato al culmine, se disponibile
      let percOsc = '';
      if (typeof ecl.obscuration === 'number' && !isNaN(ecl.obscuration)) {
        percOsc = ` Al culmine il Sole risulta oscurato per circa il ${Math.round(ecl.obscuration * 100)}%.`;
      }

      let spiegazione, doveVederlo, linkMappa = null;

      if (haCentro) {
        const coord = formattaCoordinate(ecl.latitude, ecl.longitude);
        const faseCentrale = ecl.kind === 'total' ? 'totalità'
                           : ecl.kind === 'annular' ? 'anularità'
                           : 'fase centrale';
        spiegazione = `La Luna passa davanti al Sole (eclissi ${tipo.toLowerCase()}). ` +
          `Il punto di massima visibilità — dove l'eclissi è massima e la ${faseCentrale} dura più a lungo — ` +
          `si trova a ${coord}, al centro della stretta fascia che attraversa la Terra.${percOsc} ` +
          `Tutt'intorno, per alcune migliaia di chilometri, si osserva invece un'eclissi parziale.`;
        doveVederlo = `Punto di massima eclissi: ${coord}. La fase ${faseCentrale === 'fase centrale' ? 'centrale' : faseCentrale} ` +
          `è visibile solo lungo la stretta fascia che passa per quel punto; la fase parziale è visibile in una ` +
          `vasta regione (fino a qualche migliaio di km) tutt'attorno alla fascia. Verifica se la tua zona vi rientra.`;
        linkMappa = {
          url: `https://www.google.com/maps?q=${ecl.latitude.toFixed(4)},${ecl.longitude.toFixed(4)}`,
          testo: `🗺️ Punto di massima eclissi sulla mappa (${coord})`
        };
      } else {
        // Eclissi parziale a livello globale: l'ombra centrale non tocca la Terra
        spiegazione = `La Luna copre solo in parte il disco del Sole (eclissi parziale a livello globale): ` +
          `l'asse dell'ombra non tocca la superficie terrestre, quindi non esiste un punto di totalità.${percOsc} ` +
          `È osservabile come eclissi parziale, soprattutto dalle regioni polari o dalle zone sotto la penombra della Luna.`;
        doveVederlo = `Nessuna fascia di totalità: l'eclissi è parziale ovunque sia visibile, ` +
          `in genere verso le regioni polari. Verifica se la tua zona rientra nell'area di visibilità.`;
      }

      creaEvento({
        titolo: `Eclissi Solare ${tipo}`,
        dataObj: dataPicco,
        spiegazione,
        colore: '#f97316',
        categoria: 'eclissi',
        linkMappa,
        // Salviamo il tempo di picco (giorni UT rispetto a J2000) e i dati utili
        // alla mappa: la fascia centrale viene ricalcolata solo quando serve.
        eclissi: haCentro ? {
          peakUt: ecl.peak.ut,
          kind: ecl.kind,
          tipo,
          lat: ecl.latitude,
          lon: ecl.longitude
        } : null,
        programma: {
          cosaPortare: 'OBBLIGATORI occhiali certificati per eclissi (ISO 12312-2) o un filtro solare: mai guardare il Sole a occhio nudo, nemmeno parzialmente eclissato.',
          doveVederlo,
          comeVederlo: 'Usa esclusivamente filtri solari certificati oppure la proiezione con un foro stenopeico. Mai binocolo o telescopio senza apposito filtro solare.'
        }
      });
      ecl = Astronomy.NextGlobalSolarEclipse(ecl.peak); // richiede il tempo di picco (AstroTime)
    }
  } catch (err) {
    console.error('Errore eclissi solari:', err);
  }
}

// Formatta una coppia lat/lon in testo leggibile (es. "41,9° N, 12,5° E")
function formattaCoordinate(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'O';
  return `${Math.abs(lat).toFixed(1)}° ${ns}, ${Math.abs(lon).toFixed(1)}° ${ew}`;
}

// =====================================================================
// 1-bis. MAPPA DI VISIBILITÀ DELLE ECLISSI SOLARI
//   La linea di massima visibilità (fascia centrale) viene ricostruita
//   calcolando, istante per istante, dove l'asse dell'ombra della Luna
//   colpisce la superficie terrestre. Attorno a questa linea disegniamo
//   una fascia che stima l'area in cui l'eclissi è visibile in parte.
// =====================================================================
const UA_KM = 149597870.7;           // 1 unità astronomica in km
const RAGGIO_TERRA_KM = 6378.137;    // raggio equatoriale terrestre
const APPIATTIMENTO = 1 / 298.257223563;
const RAGGIO_TERRA_UA = RAGGIO_TERRA_KM / UA_KM;

// Calcola il punto della superficie terrestre attraversato dall'asse
// dell'ombra lunare a un dato istante (centro dell'eclissi). Restituisce
// [lat, lon] in gradi, oppure null se in quell'istante l'asse manca la Terra.
function _eclissiPuntoOmbra(time) {
  const luna = Astronomy.GeoMoon(time);
  const sole = Astronomy.GeoVector(Astronomy.Body.Sun, time, false);
  const rot = Astronomy.Rotation_EQJ_EQD(time); // dall'equatore J2000 a quello della data
  const m = Astronomy.RotateVector(rot, luna);
  const s = Astronomy.RotateVector(rot, sole);

  // Direzione dell'asse dell'ombra: dal Sole verso la Luna (e oltre, sulla Terra)
  let dx = m.x - s.x, dy = m.y - s.y, dz = m.z - s.z;
  const dl = Math.hypot(dx, dy, dz);
  dx /= dl; dy /= dl; dz /= dl;

  // Intersezione della retta (Luna + t·d) con la sfera terrestre
  const md = m.x * dx + m.y * dy + m.z * dz;
  const m2 = m.x * m.x + m.y * m.y + m.z * m.z;
  const disc = md * md - (m2 - RAGGIO_TERRA_UA * RAGGIO_TERRA_UA);
  if (disc < 0) return null; // l'asse non tocca la Terra: nessun centro d'eclissi

  const t = -md - Math.sqrt(disc); // intersezione più vicina (lato illuminato)
  const px = m.x + t * dx, py = m.y + t * dy, pz = m.z + t * dz;
  const r = Math.hypot(px, py, pz);

  // Da vettore equatoriale-della-data a latitudine/longitudine geografiche
  const declRad = Math.asin(pz / r);
  const raDeg = Math.atan2(py, px) * 180 / Math.PI;
  let lon = raDeg - Astronomy.SiderealTime(time) * 15; // GAST in gradi
  lon = ((lon + 540) % 360) - 180; // normalizza in [-180, 180]
  // Da latitudine geocentrica a geodetica
  const lat = Math.atan(Math.tan(declRad) / ((1 - APPIATTIMENTO) * (1 - APPIATTIMENTO))) * 180 / Math.PI;
  return [lat, lon];
}

// Ricostruisce la linea centrale dell'eclissi campionando le ore attorno al picco.
function _eclissiTracciaPercorso(peakUt) {
  const punti = [];
  for (let dmin = -260; dmin <= 260; dmin += 3) {
    const p = _eclissiPuntoOmbra(Astronomy.MakeTime(peakUt + dmin / 1440));
    if (p) punti.push(p);
  }
  return punti;
}

// Spezza una spezzata quando la longitudine "salta" oltre 180° (antimeridiano),
// così le linee e i poligoni non attraversano tutta la mappa.
function _eclissiSpezza(punti) {
  const segmenti = [];
  let corrente = [];
  for (let i = 0; i < punti.length; i++) {
    if (i > 0 && Math.abs(punti[i][1] - punti[i - 1][1]) > 180) {
      if (corrente.length) segmenti.push(corrente);
      corrente = [];
    }
    corrente.push(punti[i]);
  }
  if (corrente.length) segmenti.push(corrente);
  return segmenti;
}

// Stato della mappa Leaflet (creata una sola volta, poi riutilizzata)
let _mappaEclissi = null;
let _mappaStrati = [];

// Apre il modale con la mappa di visibilità per l'eclissi indicata.
function apriMappaEclissi(id) {
  const evento = eventiCalcolati.find(e => e.id === id);
  if (!evento || !evento.eclissi) return;
  const modale = document.getElementById('modale-mappa');
  const titoloEl = document.getElementById('mappa-titolo');
  if (!modale || typeof L === 'undefined') {
    // Leaflet non disponibile: apri il punto di massima eclissi su Google Maps
    if (evento.linkMappa) window.open(evento.linkMappa.url, '_blank', 'noopener');
    return;
  }

  if (titoloEl) titoloEl.textContent = `🗺️ Visibilità — ${evento.titolo} (${evento.dataTesto})`;
  modale.classList.remove('hidden');

  // Inizializza la mappa la prima volta
  if (!_mappaEclissi) {
    _mappaEclissi = L.map('mappa-eclissi', { worldCopyJump: true, minZoom: 1 }).setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 8,
      attribution: '&copy; OpenStreetMap'
    }).addTo(_mappaEclissi);
  }

  // Rimuove eventuali tracciati precedenti
  _mappaStrati.forEach(s => _mappaEclissi.removeLayer(s));
  _mappaStrati = [];

  const percorso = _eclissiTracciaPercorso(evento.eclissi.peakUt);

  // Area di visibilità parziale (stima): dischi sovrapposti lungo il percorso.
  // La sovrapposizione crea una fascia sfumata, più intensa vicino alla linea
  // centrale — robusta anche alle alte latitudini (niente artefatti ai poli).
  [{ km: 3500, colore: '#60a5fa', opac: 0.035 },
   { km: 1800, colore: '#3b82f6', opac: 0.045 }].forEach(f => {
    percorso.forEach(([lat, lon]) => {
      const disco = L.circle([lat, lon], {
        radius: f.km * 1000, stroke: false, fillColor: f.colore, fillOpacity: f.opac, interactive: false
      });
      disco.addTo(_mappaEclissi);
      _mappaStrati.push(disco);
    });
  });

  // Linea di massima visibilità (fascia centrale)
  _eclissiSpezza(percorso).forEach(seg => {
    const linea = L.polyline(seg, { color: '#1e3a8a', weight: 4, opacity: 0.95 });
    linea.addTo(_mappaEclissi);
    _mappaStrati.push(linea);
  });

  // Punto di massima eclissi
  if (typeof evento.eclissi.lat === 'number') {
    const faseIt = evento.eclissi.kind === 'total' ? 'totalità'
                 : evento.eclissi.kind === 'annular' ? 'anularità' : 'fase centrale';
    const marker = L.circleMarker([evento.eclissi.lat, evento.eclissi.lon], {
      radius: 6, color: '#f97316', fillColor: '#f97316', fillOpacity: 1, weight: 2
    }).bindPopup(`<b>Massima ${faseIt}</b><br>${formattaCoordinate(evento.eclissi.lat, evento.eclissi.lon)}`);
    marker.addTo(_mappaEclissi);
    _mappaStrati.push(marker);
  }

  // Inquadra il percorso e ricalcola le dimensioni (il div era nascosto)
  setTimeout(() => {
    _mappaEclissi.invalidateSize();
    if (percorso.length) {
      _mappaEclissi.fitBounds(L.latLngBounds(percorso).pad(0.4));
    }
  }, 60);
}

function chiudiMappaEclissi() {
  const modale = document.getElementById('modale-mappa');
  if (modale) modale.classList.add('hidden');
}

// Collega i pulsanti di chiusura del modale mappa.
function inizializzaMappaEclissiUI() {
  const modale = document.getElementById('modale-mappa');
  const btnChiudi = document.getElementById('btn-chiudi-mappa');
  if (!modale) return;
  if (btnChiudi) btnChiudi.addEventListener('click', chiudiMappaEclissi);
  modale.addEventListener('click', (e) => { if (e.target === modale) chiudiMappaEclissi(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modale.classList.contains('hidden')) chiudiMappaEclissi();
  });
}

// --- Equinozi e Solstizi ---
function aggiungiStagioni(oggi, limite) {
  try {
    const annoInizio = oggi.getFullYear();
    for (let anno = annoInizio; anno <= ANNO_LIMITE; anno++) {
      const s = Astronomy.Seasons(anno);
      const punti = [
        { at: s.mar_equinox, titolo: 'Equinozio di Primavera', spiegazione: 'Il Sole attraversa l’equatore celeste: giorno e notte hanno quasi la stessa durata. Inizia la primavera nell’emisfero nord.' },
        { at: s.jun_solstice, titolo: 'Solstizio d’Estate', spiegazione: 'Il giorno più lungo dell’anno nell’emisfero nord: il Sole raggiunge la massima altezza a mezzogiorno.' },
        { at: s.sep_equinox, titolo: 'Equinozio d’Autunno', spiegazione: 'Di nuovo giorno e notte quasi uguali: inizia l’autunno nell’emisfero nord.' },
        { at: s.dec_solstice, titolo: 'Solstizio d’Inverno', spiegazione: 'La notte più lunga dell’anno nell’emisfero nord: il Sole è più basso sull’orizzonte.' }
      ];
      punti.forEach(p => {
        const d = p.at.date;
        if (d >= oggi && d <= limite) {
          creaEvento({
            titolo: p.titolo,
            dataObj: d,
            spiegazione: p.spiegazione,
            colore: '#22c55e',
            categoria: 'stagioni',
            programma: {
              cosaPortare: 'Nulla di particolare: è un evento di calendario astronomico.',
              doveVederlo: 'Non si “vede” un punto preciso: segna il cambio di stagione.',
              comeVederlo: 'Nota come cambiano l’ora dell’alba e del tramonto nei giorni vicini.'
            }
          });
        }
      });
    }
  } catch (err) {
    console.error('Errore stagioni:', err);
  }
}

// --- Sciami Meteorici (date di picco annuali note) ---
function aggiungiSciamiMeteorici(oggi, limite) {
  try {
    const sciami = [
      { nome: 'Quadrantidi', mese: 1, giorno: 3, zhr: 'fino a 120 meteore/ora' },
      { nome: 'Liridi', mese: 4, giorno: 22, zhr: 'circa 18 meteore/ora' },
      { nome: 'Eta Aquaridi', mese: 5, giorno: 6, zhr: 'circa 50 meteore/ora' },
      {
        nome: 'Delta Aquaridi meridionali e Alfa Capricornidi',
        mese: 7, giorno: 30, zhr: 'fino a circa 25 meteore/ora',
        spiegazione: 'Doppio sciame che raggiunge il picco nella notte tra il 30 e il 31 luglio. Le Delta Aquaridi meridionali offrono scie di media velocità (fino a circa 25 meteore/ora in condizioni perfette), mentre le Alfa Capricornidi regalano bolidi molto luminosi e lenti.',
        programma: {
          cosaPortare: 'Sedia sdraio, coperta e bevande. Niente telescopio: serve un ampio campo visivo.',
          doveVederlo: 'Lontano dalle luci della città, in un luogo con orizzonte sgombro; lascia gli occhi adattarsi al buio per 20 minuti.',
          comeVederlo: 'A occhio nudo verso l’alto, con orario migliore intorno alle 3:00 del mattino, quando il radiante è più alto nel cielo.'
        }
      },
      { nome: 'Perseidi', mese: 8, giorno: 12, zhr: 'fino a 100 meteore/ora' },
      { nome: 'Orionidi', mese: 10, giorno: 21, zhr: 'circa 20 meteore/ora' },
      { nome: 'Leonidi', mese: 11, giorno: 17, zhr: 'circa 15 meteore/ora' },
      { nome: 'Geminidi', mese: 12, giorno: 14, zhr: 'fino a 120 meteore/ora' },
      { nome: 'Ursidi', mese: 12, giorno: 22, zhr: 'circa 10 meteore/ora' }
    ];
    const annoInizio = oggi.getFullYear();
    for (let anno = annoInizio; anno <= ANNO_LIMITE; anno++) {
      sciami.forEach(s => {
        // Picco tipico intorno alle 22:00 ora locale
        const d = new Date(anno, s.mese - 1, s.giorno, 22, 0, 0);
        if (d >= oggi && d <= limite) {
          creaEvento({
            titolo: `Sciame Meteorico: ${s.nome}`,
            dataObj: d,
            spiegazione: s.spiegazione || `Pioggia di stelle cadenti (${s.zhr} nelle condizioni migliori). Le meteore sembrano irradiarsi da un punto della volta celeste.`,
            colore: '#06b6d4',
            categoria: 'meteore',
            programma: s.programma || {
              cosaPortare: 'Sedia sdraio, coperta e bevande calde. Niente telescopio: serve un ampio campo visivo.',
              doveVederlo: 'Cielo buio e senza inquinamento luminoso; lascia gli occhi adattarsi al buio per 20 minuti.',
              comeVederlo: 'Guarda a occhio nudo verso l’alto, dopo mezzanotte quando il radiante è più alto.'
            }
          });
        }
      });
    }
  } catch (err) {
    console.error('Errore sciami meteorici:', err);
  }
}

// --- Massima Elongazione di Mercurio e Venere (miglior visibilità) ---
function aggiungiElongazioni(oggi, limite) {
  try {
    const pianeti = [
      { body: Astronomy.Body.Mercury, nome: 'Mercurio' },
      { body: Astronomy.Body.Venus, nome: 'Venere' }
    ];
    pianeti.forEach(p => {
      let start = new Date(oggi);
      // Mercurio ~6 elongazioni/anno, Venere ~2: fino al 2030 servono decine di iterazioni
      for (let i = 0; i < 50; i++) {
        let e;
        try {
          e = Astronomy.SearchMaxElongation(p.body, start);
        } catch (inner) {
          break;
        }
        if (!e) break;
        const d = e.time.date;
        if (d > limite) break;
        const quando = e.visibility === 'morning' ? 'al mattino, prima dell’alba' : 'alla sera, dopo il tramonto';
        creaEvento({
          titolo: `Massima Elongazione di ${p.nome}`,
          dataObj: d,
          spiegazione: `${p.nome} raggiunge la massima distanza apparente dal Sole (${e.elongation.toFixed(0)}°): è il momento migliore per osservarlo, visibile ${quando}.`,
          colore: '#a855f7',
          categoria: 'pianeti',
          programma: {
            cosaPortare: 'Binocolo; un piccolo telescopio per apprezzarne la fase.',
            doveVederlo: `Verso l’orizzonte ${e.visibility === 'morning' ? 'a est' : 'a ovest'}, ${quando}.`,
            comeVederlo: 'Cerca un orizzonte libero da ostacoli: il pianeta resta basso sull’orizzonte.'
          }
        });
        // Avanza oltre l'elongazione trovata per cercare la successiva
        start = new Date(d.getTime() + 20 * 24 * 60 * 60 * 1000);
      }
    });
  } catch (err) {
    console.error('Errore elongazioni:', err);
  }
}

function mostraErrore(msg) {
  const loading = document.getElementById('loading-msg');
  if (loading) {
    loading.textContent = msg;
    loading.classList.remove('italic');
    loading.classList.add('text-red-400');
  }
}

function formattData(data) {
  return data.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// =====================================================================
// 1-bis. Eventi Manuali (creati dall'utente e salvati nel browser)
// =====================================================================

// Legge gli eventi salvati in localStorage e li aggiunge alla lista
function caricaEventiManuali() {
  let salvati;
  try {
    salvati = JSON.parse(localStorage.getItem(CHIAVE_EVENTI_MANUALI) || '[]');
  } catch (err) {
    console.error('Errore lettura eventi manuali:', err);
    salvati = [];
  }
  if (!Array.isArray(salvati)) salvati = [];

  salvati.forEach(ev => {
    const dataObj = new Date(ev.data);
    if (isNaN(dataObj)) return; // ignora date non valide
    creaEvento({
      id: ev.id,
      titolo: ev.titolo,
      dataObj,
      spiegazione: ev.spiegazione,
      colore: ev.colore,
      programma: ev.programma,
      manuale: true,
      categoria: 'personali'
    });
  });

  eventiCalcolati.sort((a, b) => a.dataObj - b.dataObj);
}

// Salva in localStorage solo gli eventi manuali presenti in memoria
function salvaEventiManuali() {
  const daSalvare = eventiCalcolati
    .filter(e => e.manuale)
    .map(e => ({
      id: e.id,
      titolo: e.titolo,
      data: e.dataObj.toISOString(),
      spiegazione: e.spiegazione,
      colore: e.colore,
      programma: e.programma
    }));
  try {
    localStorage.setItem(CHIAVE_EVENTI_MANUALI, JSON.stringify(daSalvare));
  } catch (err) {
    console.error('Errore salvataggio eventi manuali:', err);
  }
}

// Crea un nuovo evento manuale a partire dai dati del form
function aggiungiEventoManuale(dati) {
  const programma = {
    cosaPortare: dati.cosaPortare || 'Nessuna indicazione particolare.',
    doveVederlo: dati.doveVederlo || 'Nessuna indicazione particolare.',
    comeVederlo: dati.comeVederlo || 'Nessuna indicazione particolare.'
  };

  creaEvento({
    id: `man${Date.now()}${contatoreId++}`,
    titolo: dati.titolo,
    dataObj: dati.dataObj,
    spiegazione: dati.spiegazione || 'Evento aggiunto manualmente.',
    colore: dati.colore || '#3b82f6',
    programma,
    manuale: true,
    categoria: 'personali'
  });

  eventiCalcolati.sort((a, b) => a.dataObj - b.dataObj);
  salvaEventiManuali();
  aggiornaViste();
}

// Elimina un evento manuale (dalla memoria, dallo storage e dalle viste)
window.eliminaEventoManuale = (id) => {
  const evento = eventiCalcolati.find(e => e.id === id);
  if (!evento || !evento.manuale) return;
  if (!confirm(`Vuoi eliminare l'evento "${evento.titolo}"?`)) return;

  eventiCalcolati = eventiCalcolati.filter(e => e.id !== id);
  salvaEventiManuali();
  aggiornaViste();
};

// Ricostruisce agenda e calendario dopo una modifica
function aggiornaViste() {
  applicaFiltri();

  // Aggiorna il messaggio "caricamento" dell'agenda
  const loading = document.getElementById('loading-msg');
  if (loading) {
    if (eventiCalcolati.length === 0) {
      loading.style.display = '';
      loading.textContent = 'Nessun evento da mostrare.';
    } else {
      loading.style.display = 'none';
    }
  }
}

// Collega il form e il modale "Aggiungi Evento"
function inizializzaFormAggiungi() {
  const modale = document.getElementById('modale-aggiungi');
  const btnApri = document.getElementById('btn-aggiungi');
  const btnChiudi = document.getElementById('btn-chiudi-modale');
  const btnAnnulla = document.getElementById('btn-annulla');
  const form = document.getElementById('form-evento');
  if (!modale || !btnApri || !form) return;

  const apri = () => {
    // Precompila con data/ora attuale (formato richiesto da datetime-local)
    const ora = new Date();
    ora.setMinutes(ora.getMinutes() - ora.getTimezoneOffset());
    document.getElementById('ev-data').value = ora.toISOString().slice(0, 16);
    modale.classList.remove('hidden');
  };
  const chiudi = () => {
    modale.classList.add('hidden');
    form.reset();
    document.getElementById('ev-colore').value = '#3b82f6';
  };

  btnApri.addEventListener('click', apri);
  if (btnChiudi) btnChiudi.addEventListener('click', chiudi);
  if (btnAnnulla) btnAnnulla.addEventListener('click', chiudi);
  // Chiudi cliccando sullo sfondo scuro
  modale.addEventListener('click', (e) => {
    if (e.target === modale) chiudi();
  });
  // Chiudi con il tasto Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modale.classList.contains('hidden')) chiudi();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const titolo = document.getElementById('ev-titolo').value.trim();
    const dataRaw = document.getElementById('ev-data').value;
    if (!titolo || !dataRaw) return;

    const dataObj = new Date(dataRaw);
    if (isNaN(dataObj)) {
      alert('Data non valida.');
      return;
    }

    aggiungiEventoManuale({
      titolo,
      dataObj,
      colore: document.getElementById('ev-colore').value,
      spiegazione: document.getElementById('ev-spiegazione').value.trim(),
      cosaPortare: document.getElementById('ev-portare').value.trim(),
      doveVederlo: document.getElementById('ev-dove').value.trim(),
      comeVederlo: document.getElementById('ev-come').value.trim()
    });

    chiudi();
    // Mostra l'agenda per far vedere subito l'evento appena creato
    const btnAg = document.getElementById('btn-vista-agenda');
    if (btnAg) btnAg.click();
  });
}

// =====================================================================
// 2. Inizializzazione Interfaccia (Griglia e Liste)
// =====================================================================
function inizializzaUI() {
  inizializzaRicerca();
  costruisciAgenda();
  inizializzaCalendario();
  gestisciTab();
}

// =====================================================================
// 1-ter. Ricerca intelligente e filtro per categoria
// =====================================================================

// Normalizza il testo per confronti "morbidi": minuscolo e senza accenti
function normalizzaTesto(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Restituisce solo gli eventi che rispettano ricerca testuale e categoria attiva.
// La ricerca testuale confronta titolo, spiegazione e nome della categoria, ed è
// "intelligente": ogni parola digitata deve comparire (in qualsiasi ordine).
function getEventiFiltrati() {
  const query = normalizzaTesto(filtroTesto).trim();
  const parole = query ? query.split(/\s+/) : [];

  return eventiCalcolati.filter(ev => {
    if (filtroCategoria !== 'tutti' && ev.categoria !== filtroCategoria) return false;
    if (parole.length === 0) return true;
    const nomeCategoria = CATEGORIE[ev.categoria] ? CATEGORIE[ev.categoria].nome : '';
    const testo = normalizzaTesto(`${ev.titolo} ${ev.spiegazione} ${nomeCategoria}`);
    return parole.every(p => testo.includes(p));
  });
}

// Riapplica i filtri correnti sia all'agenda sia al calendario a griglia
function applicaFiltri() {
  costruisciAgenda();
  sincronizzaCalendario();
}

// Trasforma la lista di eventi nel formato richiesto da FullCalendar
function eventiPerGriglia(lista) {
  return lista.map(e => ({
    id: e.id,
    title: e.titolo,
    start: e.dataObj,
    backgroundColor: e.colore,
    borderColor: e.colore,
    allDay: true
  }));
}

// Ricarica nel calendario a griglia solo gli eventi che passano i filtri
function sincronizzaCalendario() {
  if (!fullCalendarInstance) return;
  fullCalendarInstance.removeAllEvents();
  eventiPerGriglia(getEventiFiltrati()).forEach(ev => fullCalendarInstance.addEvent(ev));
}

// Costruisce la barra di ricerca e i chip delle categorie e ne collega gli eventi
function inizializzaRicerca() {
  const input = document.getElementById('ricerca-eventi');
  const btnPulisci = document.getElementById('btn-pulisci-ricerca');
  const contenitoreChip = document.getElementById('filtri-categorie');

  if (contenitoreChip) {
    const chips = [{ id: 'tutti', nome: 'Tutti', icona: '✨' }]
      .concat(Object.keys(CATEGORIE).map(id => ({ id, ...CATEGORIE[id] })));

    contenitoreChip.innerHTML = chips.map(c =>
      `<button type="button" data-cat="${c.id}" class="chip-categoria">${c.icona} ${c.nome}</button>`
    ).join('');

    contenitoreChip.querySelectorAll('.chip-categoria').forEach(btn => {
      btn.addEventListener('click', () => {
        filtroCategoria = btn.dataset.cat;
        aggiornaStileChip();
        applicaFiltri();
      });
    });
    aggiornaStileChip();
  }

  if (input) {
    input.addEventListener('input', () => {
      filtroTesto = input.value;
      if (btnPulisci) btnPulisci.classList.toggle('hidden', !input.value);
      applicaFiltri();
    });
  }

  if (btnPulisci && input) {
    btnPulisci.addEventListener('click', () => {
      input.value = '';
      filtroTesto = '';
      btnPulisci.classList.add('hidden');
      input.focus();
      applicaFiltri();
    });
  }
}

// Evidenzia il chip della categoria attiva
function aggiornaStileChip() {
  const base = 'chip-categoria px-3 py-1.5 rounded-full text-sm font-semibold transition-colors';
  const attivo = ' bg-blue-600 text-white shadow';
  const inattivo = ' bg-slate-700 text-slate-300 hover:bg-slate-600';
  document.querySelectorAll('.chip-categoria').forEach(btn => {
    btn.className = base + (btn.dataset.cat === filtroCategoria ? attivo : inattivo);
  });
}

function costruisciAgenda() {
  const container = document.getElementById('eventi-container');
  if (!container) return;
  container.innerHTML = '';

  const eventiDaMostrare = getEventiFiltrati();

  if (eventiDaMostrare.length === 0) {
    const messaggio = eventiCalcolati.length === 0
      ? 'Nessun evento da mostrare.'
      : 'Nessun evento corrisponde alla ricerca. Prova a cambiare i termini o la categoria.';
    container.innerHTML = `<p class="text-center text-slate-400">${messaggio}</p>`;
    return;
  }

  eventiDaMostrare.forEach(evento => {
    const card = document.createElement('article');
    card.className = "bg-slate-800 p-6 rounded-2xl border border-slate-700 card-hover relative overflow-hidden";
    // Una piccola linea colorata a sinistra per il tipo di evento
    const badgeManuale = evento.manuale
      ? '<span class="ml-2 align-middle text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">Manuale</span>'
      : '';
    // Badge con la categoria dell'evento (es. 🌙 Fasi Lunari)
    const cat = CATEGORIE[evento.categoria];
    const badgeCategoria = cat
      ? `<span class="align-middle text-xs bg-slate-700 text-slate-200 px-2 py-0.5 rounded-full">${cat.icona} ${cat.nome}</span>`
      : '';
    const bottoneElimina = evento.manuale
      ? `<button onclick="eliminaEventoManuale('${evento.id}')" class="p-3 bg-slate-700 hover:bg-red-600 rounded-full transition-colors flex-shrink-0" title="Elimina evento">🗑️</button>`
      : '';
    // Link alla mappa (es. punto di massima eclissi), se presente
    const linkMappa = evento.linkMappa
      ? `<li><a href="${evento.linkMappa.url}" target="_blank" rel="noopener" class="text-blue-400 underline hover:text-blue-300">${evento.linkMappa.testo}</a></li>`
      : '';
    // Pulsante mappa interattiva di visibilità (solo eclissi solari con fascia centrale)
    const bottoneMappa = evento.eclissi
      ? `<li><button onclick="apriMappaEclissi('${evento.id}')" class="inline-flex items-center gap-1 text-blue-400 underline hover:text-blue-300 bg-transparent border-0 p-0 cursor-pointer">🌍 Mostra mappa di visibilità (linea centrale e area parziale)</button></li>`
      : '';
    card.innerHTML = `
      <div class="absolute left-0 top-0 bottom-0 w-2" style="background-color: ${evento.colore}"></div>
      <div class="flex justify-between items-start mb-4 pl-4">
        <div>
          <h2 class="text-2xl font-bold text-white">${evento.titolo}${badgeManuale}</h2>
          <p class="text-blue-400 text-sm font-semibold mt-1">📅 ${evento.dataTesto}</p>
          <div class="mt-2">${badgeCategoria}</div>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <button onclick="leggiEvento('${evento.id}')" class="p-3 bg-slate-700 hover:bg-slate-600 rounded-full transition-colors" title="Ascolta le info">
            🔊
          </button>
          ${bottoneElimina}
        </div>
      </div>

      <div class="space-y-3 text-slate-300 pl-4">
        <p><strong>✨ Cosa succede:</strong> ${evento.spiegazione}</p>
        <div class="bg-slate-900 p-4 rounded-xl mt-4 text-sm border border-slate-700">
          <h3 class="font-bold text-white mb-2">🎒 Programma (Consigli)</h3>
          <ul class="space-y-2">
            <li><span class="text-blue-400">Portare:</span> ${evento.programma.cosaPortare}</li>
            <li><span class="text-blue-400">Dove:</span> ${evento.programma.doveVederlo}</li>
            <li><span class="text-blue-400">Come:</span> ${evento.programma.comeVederlo}</li>
            ${linkMappa}
            ${bottoneMappa}
          </ul>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function inizializzaCalendario() {
  const calendarEl = document.getElementById('calendario-griglia');
  if (!calendarEl || typeof FullCalendar === 'undefined') {
    console.error('FullCalendar non disponibile.');
    return;
  }

  fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'it',
    firstDay: 1, // Lunedì
    height: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: ''
    },
    buttonText: { today: 'Oggi' },
    events: eventiPerGriglia(getEventiFiltrati()),
    eventClick: function(info) {
      // Se clicco su un evento nel calendario, apro l'agenda e leggo il testo
      document.getElementById('btn-vista-agenda').click();
      setTimeout(() => {
        leggiEvento(info.event.id);
        const btn = document.querySelector(`button[onclick="leggiEvento('${info.event.id}')"]`);
        if (btn) {
          const card = btn.closest('article');
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  });
  fullCalendarInstance.render();
}

// =====================================================================
// 3. Gestione Tab (Cambia vista Mese / Agenda)
// =====================================================================
function gestisciTab() {
  const btnCal = document.getElementById('btn-vista-calendario');
  const btnAg = document.getElementById('btn-vista-agenda');
  const viewCal = document.getElementById('vista-calendario');
  const viewAg = document.getElementById('vista-agenda');

  const attivo = "px-5 py-2 rounded-full font-semibold transition-colors bg-blue-600 hover:bg-blue-500 text-white shadow-lg";
  const inattivo = "px-5 py-2 rounded-full font-semibold transition-colors bg-slate-700 hover:bg-slate-600 text-white";

  btnCal.addEventListener('click', () => {
    viewCal.classList.remove('hidden');
    viewAg.classList.add('hidden');
    btnCal.className = attivo;
    btnAg.className = inattivo;
    // Resize necessario per FullCalendar quando torna visibile
    if (fullCalendarInstance) fullCalendarInstance.updateSize();
  });

  btnAg.addEventListener('click', () => {
    viewAg.classList.remove('hidden');
    viewCal.classList.add('hidden');
    btnAg.className = attivo;
    btnCal.className = inattivo;
  });
}

// =====================================================================
// 4. Lettura Vocale (TTS)
// =====================================================================
window.leggiEvento = (id) => {
  const evento = eventiCalcolati.find(e => e.id === id);
  if (!evento) return;

  window.speechSynthesis.cancel();

  const testo = `
    Il calendario di Ben ti ricorda l'evento: ${evento.titolo}.
    Previsto per il ${evento.dataTesto}.
    Cosa succede? ${evento.spiegazione}.
    Passiamo al programma.
    Cosa portare: ${evento.programma.cosaPortare}.
    Dove vederlo: ${evento.programma.doveVederlo}.
    Come procedere: ${evento.programma.comeVederlo}.
    Cieli Sereni da Ben!
  `;

  const sintesi = new SpeechSynthesisUtterance(testo);
  sintesi.lang = 'it-IT';
  sintesi.rate = 0.9;

  // Tenta di usare una voce italiana
  const voci = window.speechSynthesis.getVoices();
  const voceItaliana = voci.find(v => v.lang === 'it-IT');
  if (voceItaliana) sintesi.voice = voceItaliana;

  window.speechSynthesis.speak(sintesi);
};

// Carica le voci altrimenti a volte non vanno la prima volta
speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

// =====================================================================
// 5. Notifiche (Base)
// =====================================================================
document.getElementById('btn-notifiche').addEventListener('click', async () => {
  if (!('Notification' in window)) {
    alert('Questo browser non supporta le notifiche.');
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    new Notification('Notifiche AstroCalendario Ben Attive!', {
      body: 'Il cosmo ti avviserà.',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/512px-NASA_logo.svg.png'
    });
  } else {
    alert("Permesso notifiche negato.");
  }
});

function registraSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .catch(err => console.error('Errore SW:', err));
  }
}

// =====================================================================
// 6. Installazione PWA (Aggiungi a schermata Home)
// =====================================================================
let promptInstallazione = null;

function inizializzaInstallazione() {
  const btn = document.getElementById('btn-installa');
  if (!btn) return;

  // App già installata (avviata in modalità standalone): nascondi il pulsante
  const giaInstallata = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (giaInstallata) {
    btn.classList.add('hidden');
    return;
  }

  // Chrome / Edge / Android: intercetta il prompt nativo di installazione
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptInstallazione = e;
    btn.classList.remove('hidden');
  });

  // Quando l'utente installa, nascondi il pulsante
  window.addEventListener('appinstalled', () => {
    promptInstallazione = null;
    btn.classList.add('hidden');
  });

  // iOS (Safari) non espone beforeinstallprompt: mostra le istruzioni manuali
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !giaInstallata) {
    btn.classList.remove('hidden');
  }

  btn.addEventListener('click', async () => {
    if (promptInstallazione) {
      promptInstallazione.prompt();
      await promptInstallazione.userChoice;
      promptInstallazione = null;
      btn.classList.add('hidden');
    } else if (isIOS) {
      alert('Per installare l\'app su iPhone/iPad:\n\n1. Tocca il pulsante Condividi ⬆️ in basso\n2. Scegli "Aggiungi a schermata Home"\n3. Conferma con "Aggiungi"');
    } else {
      alert('Per installare l\'app usa il menu del browser e scegli "Installa app" o "Aggiungi a schermata Home".');
    }
  });
}
