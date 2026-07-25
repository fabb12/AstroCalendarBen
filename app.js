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
  inizializzaSkymap();
  inizializzaInstallazione();
});

// Helper: crea un evento con id sicuro e testo data formattato
function creaEvento({ id, titolo, dataObj, spiegazione, colore, programma, manuale, linkMappa, categoria, eclissi, corpoCielo }) {
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
    eclissi: eclissi || null,
    // Corpo celeste protagonista dell'evento: apre la vista Cielo puntata su di lui
    corpoCielo: corpoCielo || null
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
          categoria: 'luna',
          corpoCielo: 'Moon'
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
        corpoCielo: 'Moon',
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
        corpoCielo: 'Sun',
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
  [{ km: 3500, colore: '#60a5fa', opac: 0.018 },
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
    // Nota: Astronomy.Body.X è la stringa del corpo, riusata dalla vista Cielo
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
          corpoCielo: p.body,
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
    // Scorciatoia verso la vista Cielo, puntata sul protagonista dell'evento
    const bottoneCielo = evento.corpoCielo
      ? `<li><button onclick="cercaNelCielo('${evento.corpoCielo}')" class="inline-flex items-center gap-1 text-blue-400 underline hover:text-blue-300 bg-transparent border-0 p-0 cursor-pointer">🔭 Trova ${skyNomeCorpo(evento.corpoCielo)} nel cielo adesso</button></li>`
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
            ${bottoneCielo}
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
// 3. Gestione Tab (Cambia vista Mese / Agenda / Cielo)
// =====================================================================

// Le tre viste dell'app: pulsante, contenitore e nome logico
const VISTE = [
  { nome: 'calendario', btn: 'btn-vista-calendario', vista: 'vista-calendario' },
  { nome: 'agenda',     btn: 'btn-vista-agenda',     vista: 'vista-agenda' },
  { nome: 'cielo',      btn: 'btn-vista-skymap',     vista: 'vista-skymap' }
];

// Mostra una sola vista alla volta e aggiorna lo stile dei pulsanti
function mostraVista(nome) {
  const attivo = "px-5 py-2 rounded-full font-semibold transition-colors bg-blue-600 hover:bg-blue-500 text-white shadow-lg";
  const inattivo = "px-5 py-2 rounded-full font-semibold transition-colors bg-slate-700 hover:bg-slate-600 text-white";

  VISTE.forEach(v => {
    const btn = document.getElementById(v.btn);
    const vista = document.getElementById(v.vista);
    const selezionata = v.nome === nome;
    if (vista) vista.classList.toggle('hidden', !selezionata);
    if (btn) btn.className = selezionata ? attivo : inattivo;
  });

  // La ricerca filtra calendario e agenda: nella vista Cielo non serve
  const ricerca = document.getElementById('barra-ricerca');
  if (ricerca) ricerca.classList.toggle('hidden', nome === 'cielo');

  // Resize necessario per FullCalendar quando torna visibile
  if (nome === 'calendario' && fullCalendarInstance) fullCalendarInstance.updateSize();

  // Il disegno del cielo gira solo quando la sua vista è a schermo
  if (nome === 'cielo') apriSkymap(); else chiudiSkymap();
}

function gestisciTab() {
  VISTE.forEach(v => {
    const btn = document.getElementById(v.btn);
    if (btn) btn.addEventListener('click', () => mostraVista(v.nome));
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

// =====================================================================
// 7. CIELO IN DIRETTA (SkyMap) — punta il telefono e trova gli astri
//    · Astronomy Engine calcola azimut e altezza di Sole, Luna, pianeti
//      e stelle luminose per la tua posizione, nell'istante esatto.
//    · L'API DeviceOrientation (bussola + giroscopio) dice dove sta
//      guardando il telefono.
//    · Un canvas disegna gli astri nel punto giusto dello schermo.
//    Senza sensori (o su computer) ci si guarda intorno trascinando il dito.
// =====================================================================

const SKY_D2R = Math.PI / 180;
const SKY_R2D = 180 / Math.PI;

// Preferenze salvate nel browser
const CHIAVE_SKY_POSIZIONE = 'astrocalendario_posizione';
const CHIAVE_SKY_BUSSOLA = 'astrocalendario_bussola_offset';

// Corpi del Sistema Solare mostrati nel cielo.
// Gli id sono i valori di Astronomy.Body (semplici stringhe): li scriviamo
// direttamente così il file resta valido anche se la libreria non si carica.
const SKY_CORPI = [
  { id: 'Sun',     nome: 'Sole',     icona: '☀️', colore: '#fbbf24', tipo: 'sole' },
  { id: 'Moon',    nome: 'Luna',     icona: '🌙', colore: '#e2e8f0', tipo: 'luna' },
  { id: 'Mercury', nome: 'Mercurio', icona: '☿',  colore: '#cbd5e1', tipo: 'pianeta' },
  { id: 'Venus',   nome: 'Venere',   icona: '♀',  colore: '#fde68a', tipo: 'pianeta' },
  { id: 'Mars',    nome: 'Marte',    icona: '♂',  colore: '#f87171', tipo: 'pianeta' },
  { id: 'Jupiter', nome: 'Giove',    icona: '♃',  colore: '#fcd34d', tipo: 'pianeta' },
  { id: 'Saturn',  nome: 'Saturno',  icona: '♄',  colore: '#fcd34d', tipo: 'pianeta' },
  { id: 'Uranus',  nome: 'Urano',    icona: '♅',  colore: '#67e8f9', tipo: 'pianeta' },
  { id: 'Neptune', nome: 'Nettuno',  icona: '♆',  colore: '#93c5fd', tipo: 'pianeta' }
];

// Otto stelle luminose usate come punti di riferimento per orientarsi.
// Coordinate J2000: ascensione retta in ore, declinazione in gradi.
// Astronomy Engine mette a disposizione otto "slot" (Star1...Star8).
const SKY_STELLE = [
  { nome: 'Stella Polare', ra: 2.5303,  dec: 89.2641,  ly: 433, mag: 1.98, colore: '#fef3c7' },
  { nome: 'Sirio',         ra: 6.7525,  dec: -16.7161, ly: 8.6, mag: -1.46, colore: '#dbeafe' },
  { nome: 'Vega',          ra: 18.6156, dec: 38.7837,  ly: 25,  mag: 0.03, colore: '#e0f2fe' },
  { nome: 'Capella',       ra: 5.2782,  dec: 45.9980,  ly: 42.9, mag: 0.08, colore: '#fef9c3' },
  { nome: 'Arturo',        ra: 14.2610, dec: 19.1825,  ly: 36.7, mag: -0.05, colore: '#fed7aa' },
  { nome: 'Rigel',         ra: 5.2423,  dec: -8.2016,  ly: 863, mag: 0.13, colore: '#dbeafe' },
  { nome: 'Betelgeuse',    ra: 5.9195,  dec: 7.4070,   ly: 548, mag: 0.50, colore: '#fca5a5' },
  { nome: 'Altair',        ra: 19.8464, dec: 8.8683,   ly: 16.7, mag: 0.77, colore: '#f1f5f9' }
];

// Elenco completo degli astri disegnabili (corpi + stelle negli slot Star1..Star8)
const SKY_ASTRI = SKY_CORPI.concat(
  SKY_STELLE.map((s, i) => ({
    id: `Star${i + 1}`,
    nome: s.nome,
    icona: '✦',
    colore: s.colore,
    tipo: 'stella',
    mag: s.mag
  }))
);

// Stato della vista Cielo
const sky = {
  aperto: false,
  raf: null,
  canvas: null,
  ctx: null,
  larghezza: 0,
  altezza: 0,
  observer: null,        // Astronomy.Observer con la posizione dell'utente
  posizione: null,       // { lat, lon, fonte }
  sensori: false,        // orientamento del dispositivo attivo
  assoluto: false,       // alpha riferito al Nord vero (bussola affidabile)
  orient: null,          // { alpha, beta, gamma } dall'ultimo evento
  offsetBussola: 0,      // correzione manuale della bussola, in gradi
  salvaBussola: null,    // timer per salvare la calibrazione a fine trascinamento
  fov: 55,               // campo visivo verticale, in gradi
  manuale: { az: 180, alt: 25 },
  puntatori: new Map(),  // dita appoggiate sul canvas (per trascinamento e pizzico)
  pizzico: null,
  target: null,          // id dell'astro da cercare
  oggetti: [],           // posizioni calcolate (az/alt) degli astri
  prossimoCalcolo: 0,
  cacheOrari: { chiave: null, valore: null },
  stelleDefinite: false,
  wakeLock: null,
  avvisi: {}            // messaggi mostrati sotto al cielo, uno per argomento
};

// --- Piccola algebra vettoriale (terna Est / Nord / Alto) ---
function skyDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function skyCross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

// Versore che punta verso azimut/altezza dati (azimut 0 = Nord, 90 = Est)
function skyVettore(azGradi, altGradi) {
  const az = azGradi * SKY_D2R, alt = altGradi * SKY_D2R;
  return [Math.sin(az) * Math.cos(alt), Math.cos(az) * Math.cos(alt), Math.sin(alt)];
}

// Matrice di rotazione del dispositivo secondo la specifica DeviceOrientation:
// R = Rz(alpha) · Rx(beta) · Ry(gamma), dagli assi del telefono a Est/Nord/Alto.
function skyMatriceDispositivo(alpha, beta, gamma) {
  const cA = Math.cos(alpha), sA = Math.sin(alpha);
  const cB = Math.cos(beta), sB = Math.sin(beta);
  const cG = Math.cos(gamma), sG = Math.sin(gamma);
  return [
    [cA * cG - sA * sB * sG, -sA * cB, cA * sG + sA * sB * cG],
    [sA * cG + cA * sB * sG,  cA * cB, sA * sG - cA * sB * cG],
    [-cB * sG,                sB,      cB * cG]
  ];
}

function skyApplica(R, v) {
  return [
    R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2],
    R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2],
    R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]
  ];
}

// Rotazione dello schermo rispetto al telefono (0 in verticale, 90/270 in orizzontale)
function skyAngoloSchermo() {
  if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
  if (typeof window.orientation === 'number') return window.orientation;
  return 0;
}

// Terna di riferimento della "telecamera": f = dove punta il telefono,
// r = destra dello schermo, u = alto dello schermo (tutti in Est/Nord/Alto).
function skyBase() {
  if (sky.sensori && sky.orient) {
    const R = skyMatriceDispositivo(
      (sky.orient.alpha + sky.offsetBussola) * SKY_D2R,
      sky.orient.beta * SKY_D2R,
      sky.orient.gamma * SKY_D2R
    );
    // Assi dello schermo espressi negli assi del telefono (ruotati se è in orizzontale)
    const o = skyAngoloSchermo() * SKY_D2R;
    const co = Math.cos(o), so = Math.sin(o);
    return {
      // Si guarda attraverso il retro del telefono: asse -Z del dispositivo
      f: skyApplica(R, [0, 0, -1]),
      r: skyApplica(R, [co, -so, 0]),
      u: skyApplica(R, [so, co, 0])
    };
  }
  // Modalità manuale: la direzione di sguardo la decide il dito
  const f = skyVettore(sky.manuale.az, sky.manuale.alt);
  const az = sky.manuale.az * SKY_D2R;
  const r = [Math.cos(az), -Math.sin(az), 0]; // orizzontale, verso azimut crescenti
  return { f, r, u: skyCross(r, f) };
}

// Distanza focale in pixel corrispondente al campo visivo verticale scelto
function skyFocale() {
  return (sky.altezza / 2) / Math.tan(sky.fov / 2 * SKY_D2R);
}

// Proietta un versore del cielo sullo schermo (prospettiva gnomonica)
function skyProietta(v, base, focale) {
  const d = skyDot(v, base.f);
  const x = skyDot(v, base.r);
  const y = skyDot(v, base.u);
  const davanti = d > 0.001;
  return {
    davanti,
    px: davanti ? sky.larghezza / 2 + focale * (x / d) : 0,
    py: davanti ? sky.altezza / 2 - focale * (y / d) : 0,
    x, y, d
  };
}

// Nome della direzione (16 settori) a partire dall'azimut
const SKY_ROSA = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
function skyNomeDirezione(az) {
  const i = Math.round((((az % 360) + 360) % 360) / 22.5) % 16;
  return SKY_ROSA[i];
}

function skyNomeCorpo(id) {
  const a = SKY_ASTRI.find(x => x.id === id);
  return a ? a.nome : id;
}

// =====================================================================
// 7.1 Posizione dell'osservatore e sensori
// =====================================================================

function skyImpostaPosizione(lat, lon, fonte) {
  sky.posizione = { lat, lon, fonte };
  if (typeof Astronomy !== 'undefined') {
    sky.observer = new Astronomy.Observer(lat, lon, 0);
  }
  sky.prossimoCalcolo = 0;
  sky.cacheOrari = { chiave: null, valore: null };
  try {
    localStorage.setItem(CHIAVE_SKY_POSIZIONE, JSON.stringify({ lat, lon }));
  } catch (e) { /* storage pieno o non disponibile: pazienza */ }
  skyAvviso('posizione', ''); // la posizione c'è: via l'eventuale avviso
  skyAggiornaStato();
}

// Rilegge l'ultima posizione salvata (così l'app funziona subito, anche offline)
function skyCaricaPosizioneSalvata() {
  try {
    const dati = JSON.parse(localStorage.getItem(CHIAVE_SKY_POSIZIONE) || 'null');
    if (dati && typeof dati.lat === 'number' && typeof dati.lon === 'number') {
      skyImpostaPosizione(dati.lat, dati.lon, 'salvata');
      return true;
    }
  } catch (e) { /* dato corrotto: lo ignoriamo */ }
  return false;
}

function skyRichiediPosizione() {
  return new Promise((risolvi) => {
    if (!navigator.geolocation) {
      risolvi(false);
      return;
    }
    let concluso = false;
    const concludi = (esito) => { if (!concluso) { concluso = true; risolvi(esito); } };

    // Finché l'utente non risponde alla richiesta di permesso il browser non
    // richiama nulla (il "timeout" qui sotto parte solo dopo il consenso):
    // dopo 15 secondi smettiamo di aspettare e lo diciamo.
    const attesaMassima = setTimeout(() => concludi(false), 15000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(attesaMassima);
        // La posizione viene comunque usata, anche se arriva in ritardo
        skyImpostaPosizione(pos.coords.latitude, pos.coords.longitude, 'gps');
        skyAggiornaOggetti(true);
        concludi(true);
      },
      () => { clearTimeout(attesaMassima); concludi(false); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

// Riceve alpha/beta/gamma dal telefono. Su iOS webkitCompassHeading dà
// direttamente la direzione rispetto al Nord vero: è la più affidabile.
function skyEventoOrientamento(e) {
  if (e.alpha === null && e.beta === null && e.gamma === null) return;
  let alpha = e.alpha || 0;
  if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
    alpha = 360 - e.webkitCompassHeading; // bussola di iOS -> alpha assoluto
    sky.assoluto = true;
  } else if (e.absolute === true || e.type === 'deviceorientationabsolute') {
    sky.assoluto = true;
  }
  sky.orient = { alpha, beta: e.beta || 0, gamma: e.gamma || 0 };
  sky.sensori = true;
}

async function skyRichiediSensori() {
  if (typeof DeviceOrientationEvent === 'undefined') return false;
  try {
    // iOS 13+: il permesso va chiesto durante un gesto dell'utente
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const esito = await DeviceOrientationEvent.requestPermission();
      if (esito !== 'granted') return false;
    }
  } catch (e) {
    return false;
  }
  // Se disponibile preferiamo l'evento "assoluto": alpha è riferito al Nord vero
  if ('ondeviceorientationabsolute' in window) {
    window.addEventListener('deviceorientationabsolute', skyEventoOrientamento, true);
  }
  window.addEventListener('deviceorientation', skyEventoOrientamento, true);
  return true;
}

// =====================================================================
// 7.2 Calcolo delle posizioni degli astri
// =====================================================================

// Registra le stelle luminose negli slot Star1...Star8 della libreria
function skyDefinisciStelle() {
  if (sky.stelleDefinite) return;
  if (typeof Astronomy === 'undefined' || typeof Astronomy.DefineStar !== 'function') return;
  SKY_STELLE.forEach((s, i) => {
    try { Astronomy.DefineStar(`Star${i + 1}`, s.ra, s.dec, s.ly); } catch (e) { /* slot non valido */ }
  });
  sky.stelleDefinite = true;
}

// Ricalcola azimut e altezza di tutti gli astri (al massimo una volta al secondo)
function skyAggiornaOggetti(forza) {
  const adesso = Date.now();
  if (!forza && adesso < sky.prossimoCalcolo) return;
  sky.prossimoCalcolo = adesso + 1000;

  if (typeof Astronomy === 'undefined' || !sky.observer) {
    sky.oggetti = [];
    return;
  }
  skyDefinisciStelle();

  const t = Astronomy.MakeTime(new Date());
  const lista = [];
  SKY_ASTRI.forEach(astro => {
    try {
      const equ = Astronomy.Equator(astro.id, t, sky.observer, true, true);
      const hor = Astronomy.Horizon(t, sky.observer, equ.ra, equ.dec, 'normal');
      const voce = Object.assign({}, astro, {
        az: hor.azimuth,
        alt: hor.altitude,
        distanzaUA: equ.dist
      });
      if (astro.tipo === 'luna' || astro.tipo === 'pianeta') {
        try {
          const ill = Astronomy.Illumination(astro.id, t);
          voce.mag = ill.mag;
          voce.frazione = ill.phase_fraction;
        } catch (e) { /* magnitudine non disponibile */ }
      }
      lista.push(voce);
    } catch (e) { /* corpo non calcolabile: lo saltiamo senza fermare gli altri */ }
  });
  sky.oggetti = lista;
  skyAggiornaEtichette();
}

// Orari di sorgere e tramonto dell'astro selezionato (ricalcolati ogni mezz'ora)
function skyOrari(id) {
  if (!sky.observer || typeof Astronomy === 'undefined') return null;
  const chiave = `${id}|${Math.floor(Date.now() / 1800000)}`;
  if (sky.cacheOrari.chiave === chiave) return sky.cacheOrari.valore;
  let valore = null;
  try {
    const adesso = new Date();
    const sorge = Astronomy.SearchRiseSet(id, sky.observer, 1, adesso, 1);
    const tramonta = Astronomy.SearchRiseSet(id, sky.observer, -1, adesso, 1);
    valore = { sorge: sorge ? sorge.date : null, tramonta: tramonta ? tramonta.date : null };
  } catch (e) {
    valore = null;
  }
  sky.cacheOrari = { chiave, valore };
  return valore;
}

function skyOra(data) {
  return data ? data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—';
}

// =====================================================================
// 7.3 Disegno del cielo sul canvas
// =====================================================================

function skyRidimensiona() {
  if (!sky.canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const l = sky.canvas.clientWidth || 320;
  const h = sky.canvas.clientHeight || 340;
  sky.larghezza = l;
  sky.altezza = h;
  sky.canvas.width = Math.round(l * dpr);
  sky.canvas.height = Math.round(h * dpr);
  sky.ctx = sky.canvas.getContext('2d');
  sky.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Riempie la parte di schermo sotto l'orizzonte e ne traccia la linea.
// In proiezione prospettica l'orizzonte è sempre una retta: la troviamo
// tagliando il rettangolo dello schermo con il piano orizzontale.
function skyDisegnaTerreno(ctx, base, focale) {
  const L = sky.larghezza, H = sky.altezza;
  // Componente verticale della direzione corrispondente al pixel (px, py):
  // negativa sotto l'orizzonte.
  const g = (px, py) => base.f[2] + (px - L / 2) * base.r[2] / focale + (H / 2 - py) * base.u[2] / focale;

  const angoli = [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: L, y: H }, { x: 0, y: H }]
    .map(p => ({ x: p.x, y: p.y, g: g(p.x, p.y), bordo: false }));

  const sotto = [];
  for (let i = 0; i < angoli.length; i++) {
    const a = angoli[i], b = angoli[(i + 1) % angoli.length];
    if (a.g <= 0) sotto.push(a);
    if ((a.g <= 0) !== (b.g <= 0)) {
      const t = a.g / (a.g - b.g);
      sotto.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), g: 0, bordo: true });
    }
  }
  if (sotto.length < 3) return;

  ctx.save();
  ctx.beginPath();
  sotto.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = 'rgba(17, 30, 27, 0.96)'; // terreno: verde molto scuro
  ctx.fill();

  // La linea d'orizzonte è il lato nato dal taglio
  ctx.beginPath();
  for (let i = 0; i < sotto.length; i++) {
    const a = sotto[i], b = sotto[(i + 1) % sotto.length];
    if (a.bordo && b.bordo) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
  }
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.restore();
}

// Reticolo di riferimento: meridiani di azimut e paralleli di altezza
function skyDisegnaGriglia(ctx, base, focale) {
  ctx.save();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();

  const tratto = (v1, v2) => {
    const a = skyProietta(v1, base, focale);
    const b = skyProietta(v2, base, focale);
    if (!a.davanti || !b.davanti) return;
    ctx.moveTo(a.px, a.py);
    ctx.lineTo(b.px, b.py);
  };

  for (let az = 0; az < 360; az += 30) {
    for (let alt = -20; alt < 80; alt += 10) {
      tratto(skyVettore(az, alt), skyVettore(az, alt + 10));
    }
  }
  for (const alt of [30, 60]) {
    for (let az = 0; az < 360; az += 10) {
      tratto(skyVettore(az, alt), skyVettore(az + 10, alt));
    }
  }
  ctx.stroke();
  ctx.restore();
}

// Lettere dei punti cardinali lungo l'orizzonte
function skyDisegnaCardinali(ctx, base, focale) {
  const punti = [
    { az: 0, testo: 'N' }, { az: 45, testo: 'NE' }, { az: 90, testo: 'E' }, { az: 135, testo: 'SE' },
    { az: 180, testo: 'S' }, { az: 225, testo: 'SO' }, { az: 270, testo: 'O' }, { az: 315, testo: 'NO' }
  ];
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  punti.forEach(p => {
    const q = skyProietta(skyVettore(p.az, 0), base, focale);
    if (!q.davanti || q.px < -40 || q.px > sky.larghezza + 40) return;
    const principale = p.testo.length === 1;
    ctx.font = principale ? 'bold 16px system-ui, sans-serif' : '12px system-ui, sans-serif';
    ctx.fillStyle = p.testo === 'N' ? '#f87171' : (principale ? '#e2e8f0' : '#94a3b8');
    ctx.fillText(p.testo, q.px, q.py + 14);
  });
  ctx.restore();
}

// Disegna la Luna con la fase reale: il lato illuminato guarda verso il Sole
function skyDisegnaLuna(ctx, x, y, r, frazione, angoloLuce) {
  const k = Math.max(0, Math.min(1, typeof frazione === 'number' ? frazione : 1));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angoloLuce);
  // Disco in ombra
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#475569';
  ctx.fill();
  // Parte illuminata: semicerchio del lembo luminoso + ellisse del terminatore.
  // Con la falce (k < 0,5) il terminatore si incurva verso il lato illuminato,
  // con la gibbosa (k > 0,5) verso quello in ombra.
  const a = Math.abs(r * (1 - 2 * k));
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.ellipse(0, 0, a, r, 0, Math.PI / 2, -Math.PI / 2, k <= 0.5);
  ctx.closePath();
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.restore();
}

// Raggio in pixel con cui disegnare un astro (Sole e Luna hanno misura fissa
// e generosa: qui conta trovarli, non riprodurne il diametro apparente)
function skyRaggio(o) {
  if (o.tipo === 'sole') return 15;
  if (o.tipo === 'luna') return 14;
  const mag = typeof o.mag === 'number' ? o.mag : 3;
  return Math.max(2.5, Math.min(11, 6 - mag * 0.9));
}

function skyDisegnaAstro(ctx, base, focale, o) {
  const v = skyVettore(o.az, o.alt);
  const p = skyProietta(v, base, focale);
  if (!p.davanti) return;
  const margine = 60;
  if (p.px < -margine || p.px > sky.larghezza + margine ||
      p.py < -margine || p.py > sky.altezza + margine) return;

  const sottoOrizzonte = o.alt < 0;
  const r = skyRaggio(o);

  ctx.save();
  ctx.globalAlpha = sottoOrizzonte ? 0.3 : 1;

  if (!sottoOrizzonte) {
    // Alone luminoso
    const alone = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, r * 3.2);
    alone.addColorStop(0, o.colore + 'aa');
    alone.addColorStop(1, o.colore + '00');
    ctx.fillStyle = alone;
    ctx.beginPath();
    ctx.arc(p.px, p.py, r * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (o.tipo === 'luna') {
    // Direzione del Sole vista dalla Luna, proiettata sullo schermo:
    // il lembo illuminato punta sempre da quella parte.
    const sole = sky.oggetti.find(x => x.id === 'Sun');
    let angolo = 0;
    if (sole) {
      const s = skyVettore(sole.az, sole.alt);
      const proiez = skyDot(s, v);
      const t = [s[0] - proiez * v[0], s[1] - proiez * v[1], s[2] - proiez * v[2]];
      angolo = Math.atan2(-skyDot(t, base.u), skyDot(t, base.r));
    }
    skyDisegnaLuna(ctx, p.px, p.py, r, o.frazione, angolo);
  } else {
    ctx.beginPath();
    ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
    ctx.fillStyle = o.colore;
    ctx.fill();
    if (o.tipo === 'sole') {
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  if (sottoOrizzonte) {
    // Sotto l'orizzonte: cerchio tratteggiato, sta dietro al terreno
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.arc(p.px, p.py, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Etichetta
  ctx.globalAlpha = sottoOrizzonte ? 0.45 : 0.95;
  ctx.font = (o.id === sky.target ? 'bold ' : '') + '12px system-ui, sans-serif';
  ctx.fillStyle = o.id === sky.target ? '#93c5fd' : '#e2e8f0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(o.nome, p.px + r + 6, p.py);

  // Cerchio di conferma sull'astro cercato
  if (o.id === sky.target) {
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(p.px, p.py, r + 12, 0, Math.PI * 2);
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

// Freccia che guida verso l'astro cercato quando è fuori dallo schermo
function skyDisegnaGuida(ctx, base, focale, o) {
  const L = sky.larghezza, H = sky.altezza;
  const v = skyVettore(o.az, o.alt);
  const p = skyProietta(v, base, focale);
  const bordo = 26;
  const inVista = p.davanti && p.px > bordo && p.px < L - bordo && p.py > bordo && p.py < H - bordo;
  if (inVista) return;

  // Direzione verso cui girarsi, nel piano tangente allo sguardo
  const angolo = Math.atan2(-p.y, p.x);
  const separazione = Math.acos(Math.max(-1, Math.min(1, skyDot(v, base.f)))) * SKY_R2D;

  const raggioX = L / 2 - 44, raggioY = H / 2 - 44;
  const x = L / 2 + Math.cos(angolo) * raggioX;
  const y = H / 2 + Math.sin(angolo) * raggioY;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angolo);
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, 9);
  ctx.lineTo(-10, -9);
  ctx.closePath();
  ctx.fillStyle = '#60a5fa';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = '#bfdbfe';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const etichetta = `${o.nome} · ${Math.round(separazione)}°` + (o.alt < 0 ? ' (sotto l\'orizzonte)' : '');
  const dy = y < H / 2 ? 26 : -26;
  ctx.fillText(etichetta, Math.max(70, Math.min(L - 70, x)), y + dy);
  ctx.restore();
}

// Mirino al centro dello schermo: indica dove sta puntando il telefono
function skyDisegnaMirino(ctx) {
  const x = sky.larghezza / 2, y = sky.altezza / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 12, y); ctx.lineTo(x - 4, y);
  ctx.moveTo(x + 4, y); ctx.lineTo(x + 12, y);
  ctx.moveTo(x, y - 12); ctx.lineTo(x, y - 4);
  ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 12);
  ctx.stroke();
  ctx.restore();
}

function skyDisegna() {
  if (!sky.ctx) return;
  const ctx = sky.ctx;
  const L = sky.larghezza, H = sky.altezza;

  // Sfondo notturno
  const sfondo = ctx.createLinearGradient(0, 0, 0, H);
  sfondo.addColorStop(0, '#020617');
  sfondo.addColorStop(1, '#0f172a');
  ctx.fillStyle = sfondo;
  ctx.fillRect(0, 0, L, H);

  const base = skyBase();
  const focale = skyFocale();

  skyDisegnaGriglia(ctx, base, focale);
  skyDisegnaTerreno(ctx, base, focale);
  skyDisegnaCardinali(ctx, base, focale);

  // Prima le stelle, poi i pianeti, infine Luna e Sole (restano sopra)
  const ordine = { stella: 0, pianeta: 1, luna: 2, sole: 3 };
  sky.oggetti
    .slice()
    .sort((a, b) => (ordine[a.tipo] || 0) - (ordine[b.tipo] || 0))
    .forEach(o => skyDisegnaAstro(ctx, base, focale, o));

  const bersaglio = sky.oggetti.find(o => o.id === sky.target);
  if (bersaglio) skyDisegnaGuida(ctx, base, focale, bersaglio);

  skyDisegnaMirino(ctx);

  // Se manca la posizione non c'è nulla da calcolare: spieghiamo il perché
  if (!sky.observer) {
    ctx.save();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Serve la tua posizione per sapere cosa hai sopra la testa.', L / 2, H / 2 + 40);
    ctx.restore();
  }

  skyAggiornaHud(base);
}

// Azimut e altezza verso cui punta il telefono, mostrati in alto a sinistra
function skyAggiornaHud(base) {
  const hud = document.getElementById('skymap-hud');
  if (!hud) return;
  const f = base.f;
  const alt = Math.asin(Math.max(-1, Math.min(1, f[2]))) * SKY_R2D;
  const az = ((Math.atan2(f[0], f[1]) * SKY_R2D) % 360 + 360) % 360;
  hud.textContent = `${skyNomeDirezione(az)} ${Math.round(az) % 360}° · alt ${alt.toFixed(0)}° · campo ${Math.round(sky.fov)}°`;
}

// Avvisi sotto al cielo, uno per argomento (posizione, sensori):
// passare un testo vuoto cancella quel solo avviso.
function skyAvviso(chiave, testo) {
  sky.avvisi[chiave] = testo || '';
  const el = document.getElementById('skymap-avviso');
  if (!el) return;
  const completo = Object.keys(sky.avvisi).map(k => sky.avvisi[k]).filter(Boolean).join(' ');
  el.textContent = completo;
  el.classList.toggle('hidden', !completo);
}

function skyAggiornaStato() {
  const el = document.getElementById('skymap-stato');
  if (!el) return;
  const righe = [];
  if (sky.posizione) {
    righe.push(`📍 ${formattaCoordinate(sky.posizione.lat, sky.posizione.lon)}`);
  } else {
    righe.push('📍 posizione mancante');
  }
  if (sky.sensori) {
    righe.push(sky.assoluto ? '🧭 bussola attiva' : '🧭 bussola da calibrare');
  } else {
    righe.push('✋ modalità manuale');
  }
  el.innerHTML = righe.join('<br>');
}

// =====================================================================
// 7.4 Interfaccia della vista Cielo
// =====================================================================

// Pulsanti per scegliere l'astro da cercare
function skyCostruisciElenco() {
  const cont = document.getElementById('skymap-oggetti');
  if (!cont || cont.dataset.pronto === 'si') return;
  cont.innerHTML = SKY_ASTRI.map(a =>
    `<button type="button" data-astro="${a.id}" class="chip-astro">${a.icona} ${a.nome} <span class="sky-alt text-slate-400"></span></button>`
  ).join('');
  cont.querySelectorAll('.chip-astro').forEach(btn => {
    btn.addEventListener('click', () => skyImpostaTarget(btn.dataset.astro));
  });
  cont.dataset.pronto = 'si';
  skyAggiornaStileElenco();
}

function skyAggiornaStileElenco() {
  const base = 'chip-astro px-3 py-1.5 rounded-full text-sm font-semibold transition-colors';
  document.querySelectorAll('.chip-astro').forEach(btn => {
    const o = sky.oggetti.find(x => x.id === btn.dataset.astro);
    const visibile = o && o.alt > 0;
    let stile;
    if (btn.dataset.astro === sky.target) stile = ' bg-blue-600 text-white shadow';
    else if (visibile) stile = ' bg-slate-700 text-slate-100 hover:bg-slate-600';
    else stile = ' bg-slate-800 text-slate-500 hover:bg-slate-700';
    btn.className = base + stile;
  });
}

// Aggiorna l'altezza mostrata accanto a ogni astro e la scheda in basso
function skyAggiornaEtichette() {
  document.querySelectorAll('.chip-astro').forEach(btn => {
    const span = btn.querySelector('.sky-alt');
    const o = sky.oggetti.find(x => x.id === btn.dataset.astro);
    if (span) span.textContent = o ? `${o.alt >= 0 ? '↑' : '↓'}${Math.round(o.alt)}°` : '';
  });
  skyAggiornaStileElenco();
  skyAggiornaScheda();
}

function skyImpostaTarget(id) {
  sky.target = sky.target === id ? null : id;
  sky.cacheOrari = { chiave: null, valore: null };
  skyAggiornaStileElenco();
  skyAggiornaScheda();
}

function skyAggiornaScheda() {
  const box = document.getElementById('skymap-info');
  if (!box) return;
  if (!sky.target) {
    box.innerHTML = 'Seleziona un astro per vedere dove si trova, quando sorge e quando tramonta.';
    return;
  }
  const o = sky.oggetti.find(x => x.id === sky.target);
  if (!o) {
    box.innerHTML = `Calcolo della posizione di <strong>${skyNomeCorpo(sky.target)}</strong> in corso…`;
    return;
  }

  const orari = skyOrari(o.id);
  const dettagli = [];
  dettagli.push(`<li><span class="text-blue-400">Direzione:</span> ${skyNomeDirezione(o.az)} (azimut ${Math.round(o.az) % 360}°)</li>`);
  dettagli.push(`<li><span class="text-blue-400">Altezza:</span> ${o.alt.toFixed(1)}° ${o.alt >= 0 ? 'sopra' : 'sotto'} l'orizzonte</li>`);
  if (typeof o.mag === 'number') {
    dettagli.push(`<li><span class="text-blue-400">Luminosità:</span> magnitudine ${o.mag.toFixed(1)}</li>`);
  }
  if (o.tipo === 'luna' && typeof o.frazione === 'number') {
    dettagli.push(`<li><span class="text-blue-400">Fase:</span> disco illuminato al ${Math.round(o.frazione * 100)}%</li>`);
  }
  if (typeof o.distanzaUA === 'number' && o.tipo !== 'stella') {
    const km = o.distanzaUA * 149597870.7;
    dettagli.push(`<li><span class="text-blue-400">Distanza:</span> ${km < 5e6
      ? `${Math.round(km).toLocaleString('it-IT')} km`
      : `${o.distanzaUA.toFixed(3)} UA`}</li>`);
  }
  if (orari) {
    dettagli.push(`<li><span class="text-blue-400">Sorge:</span> ${skyOra(orari.sorge)} · <span class="text-blue-400">Tramonta:</span> ${skyOra(orari.tramonta)}</li>`);
  }

  const consiglio = o.alt > 0
    ? 'È sopra l\'orizzonte: segui la freccia azzurra muovendo il telefono.'
    : 'In questo momento è sotto l\'orizzonte: guarda gli orari qui sopra per sapere quando torna visibile.';
  const avviso = o.id === 'Sun'
    ? '<p class="mt-2 text-amber-400">⚠️ Non guardare mai il Sole direttamente, né a occhio nudo né con binocolo o telescopio.</p>'
    : '';

  box.innerHTML = `
    <h3 class="font-bold text-white text-base mb-2">${o.icona} ${o.nome}</h3>
    <ul class="space-y-1">${dettagli.join('')}</ul>
    <p class="mt-2 text-slate-400">${consiglio}</p>${avviso}`;
}

// Avvio: permessi, posizione e sensori (parte da un gesto dell'utente).
// Il permesso dei sensori va chiesto subito, prima di qualsiasi attesa,
// altrimenti iOS non lo collega più al tocco e lo rifiuta.
async function skyAvvia(conSensori) {
  const attesaSensori = conSensori ? skyRichiediSensori() : Promise.resolve(false);

  // Il cielo si vede subito: la posizione arriva quando arriva
  const overlay = document.getElementById('skymap-overlay');
  if (overlay) overlay.classList.add('hidden');

  if (conSensori && !(await attesaSensori)) {
    skyAvviso('sensori', 'Bussola e giroscopio non disponibili: puoi comunque trascinare il dito sul cielo per guardarti intorno.');
  }

  // La geolocalizzazione può metterci qualche secondo: intanto lo diciamo
  if (!sky.observer) skyAvviso('posizione', '📍 Sto cercando la tua posizione…');
  const avutaPosizione = await skyRichiediPosizione();
  if (avutaPosizione || sky.observer || skyCaricaPosizioneSalvata()) {
    skyAvviso('posizione', '');
  } else {
    skyAvviso('posizione', 'Posizione non disponibile: senza di essa non posso sapere cosa hai sopra la testa. Controlla i permessi del browser e riprova con “Aggiorna posizione”.');
  }

  skyAggiornaStato();
  skyAggiornaOggetti(true);
}

// Ciclo di disegno: gira solo quando la vista Cielo è a schermo
function skyCiclo() {
  if (!sky.aperto) return;
  skyAggiornaOggetti(false);
  skyDisegna();
  sky.raf = requestAnimationFrame(skyCiclo);
}

function apriSkymap() {
  if (sky.aperto) return;
  sky.aperto = true;
  skyCostruisciElenco();
  skyRidimensiona();
  if (!sky.observer) skyCaricaPosizioneSalvata();
  skyAggiornaStato();
  skyAggiornaOggetti(true);
  skyTieniSchermoAcceso();
  sky.raf = requestAnimationFrame(skyCiclo);
}

function chiudiSkymap() {
  if (!sky.aperto) return;
  sky.aperto = false;
  if (sky.raf) cancelAnimationFrame(sky.raf);
  sky.raf = null;
  skyRilasciaSchermo();
}

// Evita che lo schermo si spenga mentre si osserva il cielo
async function skyTieniSchermoAcceso() {
  try {
    if ('wakeLock' in navigator && !sky.wakeLock) {
      sky.wakeLock = await navigator.wakeLock.request('screen');
      sky.wakeLock.addEventListener('release', () => { sky.wakeLock = null; });
    }
  } catch (e) { /* funzione non disponibile: non è un problema */ }
}

function skyRilasciaSchermo() {
  if (sky.wakeLock) {
    try { sky.wakeLock.release(); } catch (e) { /* già rilasciato */ }
    sky.wakeLock = null;
  }
}

function skyZoom(fattore) {
  sky.fov = Math.max(15, Math.min(110, sky.fov * fattore));
}

// Trascinamento: in manuale ci si guarda intorno, con i sensori si calibra la bussola
function skyInizializzaGesti() {
  const c = sky.canvas;
  if (!c) return;

  const distanzaPuntatori = () => {
    const p = Array.from(sky.puntatori.values());
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  };

  c.addEventListener('pointerdown', (e) => {
    c.setPointerCapture(e.pointerId);
    sky.puntatori.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (sky.puntatori.size === 2) sky.pizzico = { distanza: distanzaPuntatori(), fov: sky.fov };
  });

  c.addEventListener('pointermove', (e) => {
    const prec = sky.puntatori.get(e.pointerId);
    if (!prec) return;
    const dx = e.clientX - prec.x;
    const dy = e.clientY - prec.y;
    sky.puntatori.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (sky.puntatori.size === 2 && sky.pizzico) {
      const d = distanzaPuntatori();
      if (d > 0) sky.fov = Math.max(15, Math.min(110, sky.pizzico.fov * sky.pizzico.distanza / d));
      return;
    }

    const gradiPerPixel = sky.fov / Math.max(1, sky.altezza);
    if (sky.sensori) {
      // Con i sensori attivi il trascinamento orizzontale corregge la bussola
      skyImpostaOffsetBussola(sky.offsetBussola - dx * gradiPerPixel);
    } else {
      sky.manuale.az = ((sky.manuale.az - dx * gradiPerPixel) % 360 + 360) % 360;
      sky.manuale.alt = Math.max(-89, Math.min(89, sky.manuale.alt + dy * gradiPerPixel));
    }
  });

  const finePuntatore = (e) => {
    sky.puntatori.delete(e.pointerId);
    if (sky.puntatori.size < 2) sky.pizzico = null;
  };
  c.addEventListener('pointerup', finePuntatore);
  c.addEventListener('pointercancel', finePuntatore);
  c.addEventListener('pointerleave', finePuntatore);

  c.addEventListener('wheel', (e) => {
    e.preventDefault();
    skyZoom(e.deltaY > 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });
}

function skyImpostaOffsetBussola(valore) {
  sky.offsetBussola = ((valore % 360) + 360) % 360;
  const el = document.getElementById('skymap-cal-valore');
  if (el) {
    const mostrato = sky.offsetBussola > 180 ? sky.offsetBussola - 360 : sky.offsetBussola;
    el.textContent = `${mostrato.toFixed(0)}°`;
  }
  // Durante il trascinamento arrivano decine di valori al secondo:
  // salviamo solo quando il dito si ferma.
  clearTimeout(sky.salvaBussola);
  sky.salvaBussola = setTimeout(() => {
    try { localStorage.setItem(CHIAVE_SKY_BUSSOLA, String(sky.offsetBussola)); } catch (e) { /* niente storage */ }
  }, 400);
}

function inizializzaSkymap() {
  sky.canvas = document.getElementById('skymap-canvas');
  if (!sky.canvas) return;
  skyRidimensiona();
  skyInizializzaGesti();

  // Offset della bussola salvato dalla volta precedente
  const salvato = parseFloat(localStorage.getItem(CHIAVE_SKY_BUSSOLA));
  skyImpostaOffsetBussola(isNaN(salvato) ? 0 : salvato);

  const collega = (id, azione) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', azione);
  };

  collega('skymap-btn-avvia', () => skyAvvia(true));
  collega('skymap-btn-manuale', () => skyAvvia(false));
  collega('skymap-zoom-in', () => skyZoom(1 / 1.25));
  collega('skymap-zoom-out', () => skyZoom(1.25));
  collega('skymap-cal-meno', () => skyImpostaOffsetBussola(sky.offsetBussola - 5));
  collega('skymap-cal-piu', () => skyImpostaOffsetBussola(sky.offsetBussola + 5));
  collega('skymap-btn-posizione', async () => {
    skyAvviso('posizione', '📍 Sto cercando la tua posizione…');
    const ok = await skyRichiediPosizione();
    skyAvviso('posizione', ok ? '' : 'Non riesco a leggere la posizione: controlla i permessi di localizzazione del browser.');
    skyAggiornaOggetti(true);
  });

  collega('skymap-btn-notte', () => {
    const cont = document.getElementById('skymap-contenitore');
    const btn = document.getElementById('skymap-btn-notte');
    if (!cont) return;
    const attiva = cont.classList.toggle('modalita-notte');
    if (btn) btn.textContent = attiva ? '⚪ Colori normali' : '🔴 Modalità notte';
  });

  collega('skymap-btn-schermo', () => {
    const cont = document.getElementById('skymap-contenitore');
    if (!cont) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (cont.requestFullscreen) cont.requestFullscreen().catch(() => {});
  });

  window.addEventListener('resize', () => { if (sky.aperto) skyRidimensiona(); });
  document.addEventListener('fullscreenchange', () => setTimeout(skyRidimensiona, 80));
  if (screen.orientation && screen.orientation.addEventListener) {
    screen.orientation.addEventListener('change', () => setTimeout(skyRidimensiona, 200));
  }

  // Fuori schermo il ciclo di disegno si ferma; al ritorno riparte
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (sky.raf) cancelAnimationFrame(sky.raf);
      sky.raf = null;
      skyRilasciaSchermo();
    } else if (sky.aperto && !sky.raf) {
      skyTieniSchermoAcceso();
      sky.raf = requestAnimationFrame(skyCiclo);
    }
  });
}

// Apre la vista Cielo puntata su un astro (usata dalle schede dell'agenda)
window.cercaNelCielo = (idCorpo) => {
  mostraVista('cielo');
  sky.target = idCorpo;
  sky.cacheOrari = { chiave: null, valore: null };
  skyAggiornaStileElenco();
  skyAggiornaScheda();
};
