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
  inizializzaSimulazione();
  inizializzaSkymap();
  inizializzaNotifiche();
  inizializzaInstallazione();
});

// Helper: crea un evento con id sicuro e testo data formattato
function creaEvento({ id, titolo, dataObj, spiegazione, colore, programma, manuale, linkMappa, categoria, eclissi, corpoCielo, simul }) {
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
    corpoCielo: corpoCielo || null,
    // Misure fisiche usate dalla simulazione per renderizzare l'evento
    simul: simul || null
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
          corpoCielo: 'Moon',
          simul: { scena: 'faseLunare', fase: mq.quarter }
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
        // Semidurate (in minuti) delle varie fasi: da queste la simulazione
        // ricava il percorso della Luna dentro penombra e ombra terrestre.
        simul: {
          scena: 'eclissiLunare',
          kind: ecl.kind,
          sdPenum: ecl.sd_penum,
          sdPartial: ecl.sd_partial,
          sdTotal: ecl.sd_total,
          oscuramento: ecl.obscuration
        },
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
        // Dati per la simulazione: quanto Sole viene coperto al culmine e di
        // che tipo di eclissi si tratta (totale, anulare, parziale).
        simul: {
          scena: 'eclissiSolare',
          kind: ecl.kind,
          tipo,
          oscuramento: typeof ecl.obscuration === 'number' && !isNaN(ecl.obscuration) ? ecl.obscuration : null,
          lat: haCentro ? ecl.latitude : null,
          lon: haCentro ? ecl.longitude : null
        },
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
        { at: s.mar_equinox, titolo: 'Equinozio di Primavera', tipo: 'equinozio', spiegazione: 'Il Sole attraversa l’equatore celeste: giorno e notte hanno quasi la stessa durata. Inizia la primavera nell’emisfero nord.' },
        { at: s.jun_solstice, titolo: 'Solstizio d’Estate', tipo: 'solstizio', spiegazione: 'Il giorno più lungo dell’anno nell’emisfero nord: il Sole raggiunge la massima altezza a mezzogiorno.' },
        { at: s.sep_equinox, titolo: 'Equinozio d’Autunno', tipo: 'equinozio', spiegazione: 'Di nuovo giorno e notte quasi uguali: inizia l’autunno nell’emisfero nord.' },
        { at: s.dec_solstice, titolo: 'Solstizio d’Inverno', tipo: 'solstizio', spiegazione: 'La notte più lunga dell’anno nell’emisfero nord: il Sole è più basso sull’orizzonte.' }
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
            simul: { scena: 'stagione', tipo: p.tipo, nome: p.titolo },
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
    // ra = ascensione retta del radiante (ore), dec = declinazione (gradi),
    // zhrNum = meteore/ora con radiante allo zenit e cielo perfetto: servono
    // alla simulazione per disegnare il radiante e stimare la frequenza reale.
    const sciami = [
      { nome: 'Quadrantidi', mese: 1, giorno: 3, zhr: 'fino a 120 meteore/ora', ra: 15.33, dec: 49.5, zhrNum: 120 },
      { nome: 'Liridi', mese: 4, giorno: 22, zhr: 'circa 18 meteore/ora', ra: 18.13, dec: 33.6, zhrNum: 18 },
      { nome: 'Eta Aquaridi', mese: 5, giorno: 6, zhr: 'circa 50 meteore/ora', ra: 22.47, dec: -1.0, zhrNum: 50 },
      {
        nome: 'Delta Aquaridi meridionali e Alfa Capricornidi',
        mese: 7, giorno: 30, zhr: 'fino a circa 25 meteore/ora', ra: 22.67, dec: -16.4, zhrNum: 25,
        spiegazione: 'Doppio sciame che raggiunge il picco nella notte tra il 30 e il 31 luglio. Le Delta Aquaridi meridionali offrono scie di media velocità (fino a circa 25 meteore/ora in condizioni perfette), mentre le Alfa Capricornidi regalano bolidi molto luminosi e lenti.',
        programma: {
          cosaPortare: 'Sedia sdraio, coperta e bevande. Niente telescopio: serve un ampio campo visivo.',
          doveVederlo: 'Lontano dalle luci della città, in un luogo con orizzonte sgombro; lascia gli occhi adattarsi al buio per 20 minuti.',
          comeVederlo: 'A occhio nudo verso l’alto, con orario migliore intorno alle 3:00 del mattino, quando il radiante è più alto nel cielo.'
        }
      },
      { nome: 'Perseidi', mese: 8, giorno: 12, zhr: 'fino a 100 meteore/ora', ra: 3.22, dec: 58.0, zhrNum: 100 },
      { nome: 'Orionidi', mese: 10, giorno: 21, zhr: 'circa 20 meteore/ora', ra: 6.33, dec: 15.5, zhrNum: 20 },
      { nome: 'Leonidi', mese: 11, giorno: 17, zhr: 'circa 15 meteore/ora', ra: 10.23, dec: 21.6, zhrNum: 15 },
      { nome: 'Geminidi', mese: 12, giorno: 14, zhr: 'fino a 120 meteore/ora', ra: 7.50, dec: 32.5, zhrNum: 120 },
      { nome: 'Ursidi', mese: 12, giorno: 22, zhr: 'circa 10 meteore/ora', ra: 14.47, dec: 75.3, zhrNum: 10 }
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
            simul: { scena: 'sciame', nome: s.nome, ra: s.ra, dec: s.dec, zhr: s.zhrNum },
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
          simul: {
            scena: 'elongazione',
            corpo: p.body,
            nome: p.nome,
            elongazione: e.elongation,
            visibilita: e.visibility
          },
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
      // Gli eventi salvati prima dell'introduzione della categoria restano "Personali"
      categoria: CATEGORIE[ev.categoria] ? ev.categoria : 'personali'
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
      programma: e.programma,
      categoria: e.categoria
    }));
  try {
    localStorage.setItem(CHIAVE_EVENTI_MANUALI, JSON.stringify(daSalvare));
  } catch (err) {
    console.error('Errore salvataggio eventi manuali:', err);
  }
}

// Trasforma i campi del form nel "programma" dell'evento
function programmaDaDati(dati) {
  return {
    cosaPortare: dati.cosaPortare || 'Nessuna indicazione particolare.',
    doveVederlo: dati.doveVederlo || 'Nessuna indicazione particolare.',
    comeVederlo: dati.comeVederlo || 'Nessuna indicazione particolare.'
  };
}

// Categoria valida scelta nel form (con ripiego su "personali")
function categoriaValida(id) {
  return CATEGORIE[id] ? id : 'personali';
}

// Crea un nuovo evento manuale a partire dai dati del form
function aggiungiEventoManuale(dati) {
  creaEvento({
    id: `man${Date.now()}${contatoreId++}`,
    titolo: dati.titolo,
    dataObj: dati.dataObj,
    spiegazione: dati.spiegazione || 'Evento aggiunto manualmente.',
    colore: dati.colore || '#3b82f6',
    programma: programmaDaDati(dati),
    manuale: true,
    categoria: categoriaValida(dati.categoria)
  });

  eventiCalcolati.sort((a, b) => a.dataObj - b.dataObj);
  salvaEventiManuali();
  pianificaNotifiche();
  aggiornaViste();
}

// Aggiorna un evento manuale esistente con i dati del form
function modificaEventoManuale(id, dati) {
  const evento = eventiCalcolati.find(e => e.id === id);
  if (!evento || !evento.manuale) return;

  evento.titolo = dati.titolo;
  evento.dataObj = dati.dataObj;
  evento.dataTesto = formattData(dati.dataObj);
  evento.spiegazione = dati.spiegazione || 'Evento aggiunto manualmente.';
  evento.colore = dati.colore || '#3b82f6';
  evento.programma = programmaDaDati(dati);
  evento.categoria = categoriaValida(dati.categoria);

  eventiCalcolati.sort((a, b) => a.dataObj - b.dataObj);
  salvaEventiManuali();
  // Se la data è cambiata il promemoria viene ricalcolato sulla nuova ora
  pianificaNotifiche();
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

// Id dell'evento in corso di modifica (null = stiamo creando un nuovo evento)
let eventoInModifica = null;

// Converte una data in stringa per l'input datetime-local (ora locale)
function perInputDataOra(data) {
  const copia = new Date(data.getTime());
  copia.setMinutes(copia.getMinutes() - copia.getTimezoneOffset());
  return copia.toISOString().slice(0, 16);
}

// Riempie il menu a tendina delle categorie con l'elenco CATEGORIE
function popolaTendinaCategorie() {
  const select = document.getElementById('ev-categoria');
  if (!select) return;
  select.innerHTML = Object.keys(CATEGORIE).map(id =>
    `<option value="${id}">${CATEGORIE[id].icona} ${CATEGORIE[id].nome}</option>`
  ).join('');
  select.value = 'personali';
}

// Collega il form e il modale, usato sia per creare sia per modificare un evento
function inizializzaFormAggiungi() {
  const modale = document.getElementById('modale-aggiungi');
  const btnApri = document.getElementById('btn-aggiungi');
  const btnChiudi = document.getElementById('btn-chiudi-modale');
  const btnAnnulla = document.getElementById('btn-annulla');
  const form = document.getElementById('form-evento');
  const titoloModale = document.getElementById('modale-titolo');
  const btnSalva = document.getElementById('btn-salva-evento');
  if (!modale || !btnApri || !form) return;

  popolaTendinaCategorie();

  // Apre il modale vuoto: nuovo evento con data/ora di adesso
  const apriNuovo = () => {
    eventoInModifica = null;
    form.reset();
    if (titoloModale) titoloModale.textContent = '➕ Nuovo Evento';
    if (btnSalva) btnSalva.textContent = 'Salva evento';
    document.getElementById('ev-colore').value = '#3b82f6';
    document.getElementById('ev-categoria').value = 'personali';
    document.getElementById('ev-data').value = perInputDataOra(new Date());
    modale.classList.remove('hidden');
  };

  // Apre il modale già compilato con i dati di un evento manuale esistente
  const apriModifica = (id) => {
    const evento = eventiCalcolati.find(e => e.id === id);
    if (!evento || !evento.manuale) return;

    eventoInModifica = id;
    form.reset();
    if (titoloModale) titoloModale.textContent = '✏️ Modifica Evento';
    if (btnSalva) btnSalva.textContent = 'Salva modifiche';
    document.getElementById('ev-titolo').value = evento.titolo;
    document.getElementById('ev-data').value = perInputDataOra(evento.dataObj);
    document.getElementById('ev-categoria').value = categoriaValida(evento.categoria);
    document.getElementById('ev-colore').value = evento.colore || '#3b82f6';
    document.getElementById('ev-spiegazione').value = evento.spiegazione || '';
    const prog = evento.programma || {};
    document.getElementById('ev-portare').value = prog.cosaPortare || '';
    document.getElementById('ev-dove').value = prog.doveVederlo || '';
    document.getElementById('ev-come').value = prog.comeVederlo || '';
    modale.classList.remove('hidden');
  };

  const chiudi = () => {
    modale.classList.add('hidden');
    form.reset();
    eventoInModifica = null;
    document.getElementById('ev-colore').value = '#3b82f6';
    document.getElementById('ev-categoria').value = 'personali';
  };

  // Il pulsante ✏️ delle schede dell'agenda apre il form in modifica
  window.apriModificaEvento = apriModifica;

  btnApri.addEventListener('click', apriNuovo);
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

    const dati = {
      titolo,
      dataObj,
      categoria: document.getElementById('ev-categoria').value,
      colore: document.getElementById('ev-colore').value,
      spiegazione: document.getElementById('ev-spiegazione').value.trim(),
      cosaPortare: document.getElementById('ev-portare').value.trim(),
      doveVederlo: document.getElementById('ev-dove').value.trim(),
      comeVederlo: document.getElementById('ev-come').value.trim()
    };

    if (eventoInModifica) {
      modificaEventoManuale(eventoInModifica, dati);
    } else {
      aggiungiEventoManuale(dati);
    }

    chiudi();
    // Mostra l'agenda per far vedere subito l'evento appena salvato
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
    card.dataset.eventoId = evento.id;
    // Una piccola linea colorata a sinistra per il tipo di evento
    const badgeManuale = evento.manuale
      ? '<span class="ml-2 align-middle text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">Manuale</span>'
      : '';
    // Badge con la categoria dell'evento (es. 🌙 Fasi Lunari)
    const cat = CATEGORIE[evento.categoria];
    const badgeCategoria = cat
      ? `<span class="align-middle text-xs bg-slate-700 text-slate-200 px-2 py-0.5 rounded-full">${cat.icona} ${cat.nome}</span>`
      : '';
    // Gli eventi manuali si possono modificare ed eliminare
    const bottoneModifica = evento.manuale
      ? `<button onclick="apriModificaEvento('${evento.id}')" class="p-3 bg-slate-700 hover:bg-blue-600 rounded-full transition-colors flex-shrink-0" title="Modifica evento">✏️</button>`
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
          <button onclick="apriSimulazione('${evento.id}')" class="p-3 bg-slate-700 hover:bg-purple-600 rounded-full transition-colors" title="Simula l'evento: guarda cosa succede">
            🎬
          </button>
          <button onclick="leggiEvento('${evento.id}', 'tasto')" class="p-3 bg-slate-700 hover:bg-slate-600 rounded-full transition-colors" title="Ascolta le info">
            🔊
          </button>
          ${bottoneModifica}
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
      // Se clicco su un evento nel calendario apro l'agenda sulla sua scheda.
      // La voce NON parte da sola: si attiva solo col tasto 🔊 o con la notifica.
      document.getElementById('btn-vista-agenda').click();
      setTimeout(() => {
        const card = document.querySelector(`article[data-evento-id="${info.event.id}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
//    La voce parte SOLO in due casi: quando si preme il tasto 🔊 di una
//    scheda ("tasto") oppure quando scatta il promemoria ("notifica").
//    Qualsiasi altra chiamata viene ignorata, così l'app non parla da sola.
// =====================================================================
const ORIGINI_VOCE_AMMESSE = ['tasto', 'notifica'];

window.leggiEvento = (id, origine) => {
  if (!ORIGINI_VOCE_AMMESSE.includes(origine)) return;
  if (!('speechSynthesis' in window)) return;

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
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

// =====================================================================
// 5. Notifiche e promemoria degli eventi
//    Quando scatta il promemoria di un evento parte anche la lettura vocale.
// =====================================================================

// Quanto prima dell'evento arriva il promemoria
const ANTICIPO_NOTIFICA_MIN = 30;
// Oltre questo ritardo (app riaperta molto dopo) il promemoria non ha più senso
const RITARDO_MASSIMO_MIN = 120;
// Ogni quanto controlliamo se c'è un evento in arrivo
const INTERVALLO_CONTROLLO_MS = 60 * 1000;

const CHIAVE_NOTIFICHE_INVIATE = 'astrocalendario_notifiche_inviate';

let timerNotifiche = null;
// Promemoria già mostrati: evita di ripetere la stessa notifica a ogni controllo
let notificheInviate = caricaNotificheInviate();

// La chiave è titolo + istante: resta stabile anche se gli id vengono rigenerati
function chiaveNotifica(evento) {
  return `${evento.titolo}@${evento.dataObj.getTime()}`;
}

function caricaNotificheInviate() {
  try {
    const salvate = JSON.parse(localStorage.getItem(CHIAVE_NOTIFICHE_INVIATE) || '[]');
    return Array.isArray(salvate) ? salvate : [];
  } catch (err) {
    console.error('Errore lettura promemoria inviati:', err);
    return [];
  }
}

function salvaNotificheInviate() {
  // Tiene solo i promemoria recenti, così la lista non cresce all'infinito
  const limite = Date.now() - 7 * 24 * 60 * 60 * 1000;
  notificheInviate = notificheInviate.filter(k => {
    const istante = Number(k.split('@').pop());
    return isNaN(istante) || istante > limite;
  });
  try {
    localStorage.setItem(CHIAVE_NOTIFICHE_INVIATE, JSON.stringify(notificheInviate));
  } catch (err) {
    console.error('Errore salvataggio promemoria inviati:', err);
  }
}

// Avvia (una sola volta) il controllo periodico dei promemoria
function pianificaNotifiche() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  controllaNotifiche();
  if (timerNotifiche) return;
  timerNotifiche = setInterval(controllaNotifiche, INTERVALLO_CONTROLLO_MS);
}

// Cerca gli eventi imminenti e per ognuno mostra la notifica + legge la scheda
function controllaNotifiche() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const adesso = Date.now();
  const inizioFinestra = adesso - RITARDO_MASSIMO_MIN * 60 * 1000;
  const fineFinestra = adesso + ANTICIPO_NOTIFICA_MIN * 60 * 1000;

  eventiCalcolati.forEach(evento => {
    const istante = evento.dataObj.getTime();
    if (istante > fineFinestra || istante < inizioFinestra) return;

    const chiave = chiaveNotifica(evento);
    if (notificheInviate.includes(chiave)) return;

    notificheInviate.push(chiave);
    salvaNotificheInviate();
    mostraNotificaEvento(evento);
  });
}

function mostraNotificaEvento(evento) {
  const cat = CATEGORIE[evento.categoria];
  const icona = cat ? cat.icona : '🔭';
  try {
    const notifica = new Notification(`${icona} ${evento.titolo}`, {
      body: `${evento.dataTesto}\n${evento.spiegazione || ''}`.trim(),
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: evento.id
    });
    // Cliccando la notifica si torna all'app sulla scheda dell'evento
    notifica.onclick = () => {
      window.focus();
      mostraVista('agenda');
      const card = document.querySelector(`article[data-evento-id="${evento.id}"]`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      notifica.close();
    };
  } catch (err) {
    console.error('Errore invio notifica:', err);
  }

  // La voce parte insieme al promemoria: è uno dei due casi ammessi
  leggiEvento(evento.id, 'notifica');
}

// Aggiorna l'aspetto del pulsante 🔔 in base al permesso concesso
function aggiornaPulsanteNotifiche() {
  const btn = document.getElementById('btn-notifiche');
  if (!btn || !('Notification' in window)) return;
  const attive = Notification.permission === 'granted';
  btn.classList.toggle('bg-blue-600', attive);
  btn.classList.toggle('text-white', attive);
  btn.classList.toggle('text-blue-400', !attive);
  btn.title = attive
    ? `Promemoria attivi: avviso ${ANTICIPO_NOTIFICA_MIN} minuti prima, con lettura vocale`
    : 'Attiva Notifiche';
}

function inizializzaNotifiche() {
  const btn = document.getElementById('btn-notifiche');
  if (btn) {
    btn.addEventListener('click', async () => {
      if (!('Notification' in window)) {
        alert('Questo browser non supporta le notifiche.');
        return;
      }
      const permission = await Notification.requestPermission();
      aggiornaPulsanteNotifiche();
      if (permission === 'granted') {
        new Notification('Notifiche AstroCalendario Ben Attive!', {
          body: `Ti avviso ${ANTICIPO_NOTIFICA_MIN} minuti prima di ogni evento e ti leggo la scheda.`,
          icon: 'icon-192.png'
        });
        pianificaNotifiche();
      } else {
        alert('Permesso notifiche negato.');
      }
    });
  }

  aggiornaPulsanteNotifiche();
  // Se il permesso era già stato concesso, i promemoria ripartono da soli
  pianificaNotifiche();
}

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

// =====================================================================
// 8. SIMULAZIONE DELL'EVENTO — "guarda cosa succede"
//    Ogni evento del calendario si può riprodurre su un canvas: la scena
//    viene ricostruita istante per istante con Astronomy Engine (fasi,
//    ombre, declinazioni, posizioni reali) e animata lungo una linea del
//    tempo che si può mettere in pausa e scorrere a mano.
// =====================================================================

const SIM_MIN = 60000, SIM_ORA = 3600000, SIM_GIORNO = 86400000;

// Raggi tipici dell'ombra e della penombra terrestre alla distanza della
// Luna, misurati in raggi lunari (ombra ≈ 0,70°, penombra ≈ 1,27°,
// Luna ≈ 0,26°). Servono a ricostruire la geometria dell'eclissi lunare.
const SIM_R_UMBRA = 2.65;
const SIM_R_PENUMBRA = 4.85;
// Velocità tipica della Luna rispetto all'ombra, in raggi lunari al minuto
const SIM_V_LUNA_OMBRA = 0.0354;

// Macchie scure usate per dare "faccia" alla Luna disegnata
const SIM_CRATERI = [
  [-0.30, -0.28, 0.20], [0.26, 0.08, 0.24], [0.04, -0.48, 0.12],
  [-0.46, 0.32, 0.16], [0.42, -0.42, 0.11], [-0.08, 0.52, 0.14], [0.56, 0.34, 0.09]
];

const sim = {
  aperto: false,
  raf: null,
  canvas: null,
  ctx: null,
  L: 0, H: 0,
  evento: null,
  scena: null,
  t: 0,                 // posizione nella finestra temporale (0 = inizio, 1 = fine)
  riproduce: true,
  velocita: 1,
  ultimoTs: 0,
  osservatore: null,    // posizione usata per dire "da qui si vede?"
  stelle: [],           // stelline di sfondo (fisse per tutta la simulazione)
  meteore: [],          // scie attive nella simulazione degli sciami
  giro: 0               // rotazione della Terra nella scena delle stagioni
};

// Le velocità selezionabili con il pulsante a destra della linea del tempo
const SIM_VELOCITA = [0.5, 1, 2, 4];

// =====================================================================
// 8.1 Utilità comuni
// =====================================================================

// Posizione da cui "si guarda" l'evento: quella dell'utente se disponibile,
// altrimenti il centro dell'Italia (dichiarato nella nota sotto la scena).
function simOsservatore() {
  if (sim.osservatore) return sim.osservatore;
  let lat = 41.9, lon = 12.5, reale = false;
  if (sky.posizione && typeof sky.posizione.lat === 'number') {
    lat = sky.posizione.lat; lon = sky.posizione.lon; reale = true;
  } else {
    try {
      const dati = JSON.parse(localStorage.getItem(CHIAVE_SKY_POSIZIONE) || 'null');
      if (dati && typeof dati.lat === 'number' && typeof dati.lon === 'number') {
        lat = dati.lat; lon = dati.lon; reale = true;
      }
    } catch (e) { /* nessuna posizione salvata */ }
  }
  const obs = typeof Astronomy !== 'undefined' ? new Astronomy.Observer(lat, lon, 0) : null;
  sim.osservatore = { lat, lon, obs, reale };
  return sim.osservatore;
}

function simOraTesto(data) {
  return data.toLocaleString('it-IT', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// Durata in forma leggibile, a partire dai minuti
function simDurataTesto(minuti) {
  const m = Math.abs(Math.round(minuti));
  if (m < 60) return `${m} min`;
  const ore = Math.floor(m / 60);
  if (ore < 48) return `${ore}h ${String(m % 60).padStart(2, '0')}m`;
  return `${Math.round(ore / 24)} giorni`;
}

function simClamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Area di sovrapposizione fra due cerchi di raggio r1 e r2 a distanza d
function simAreaIntersezione(r1, r2, d) {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.pow(Math.min(r1, r2), 2);
  const a1 = Math.acos(simClamp((d * d + r1 * r1 - r2 * r2) / (2 * d * r1), -1, 1));
  const a2 = Math.acos(simClamp((d * d + r2 * r2 - r1 * r1) / (2 * d * r2), -1, 1));
  return r1 * r1 * (a1 - Math.sin(a1) * Math.cos(a1)) +
         r2 * r2 * (a2 - Math.sin(a2) * Math.cos(a2));
}

// Frazione di disco solare (raggio 1) coperta da un disco di raggio k a distanza d
function simOscuramento(d, k) {
  return simAreaIntersezione(1, k, d) / Math.PI;
}

// Distanza fra i centri che produce un dato oscuramento (ricerca per bisezione)
function simSeparazioneDaOscuramento(obsc, k) {
  const massimo = simOscuramento(0, k);
  if (obsc >= massimo - 1e-9) return 0;   // copertura massima: dischi concentrici
  const bersaglio = obsc;
  let lo = 0, hi = 1 + k;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (simOscuramento(mid, k) > bersaglio) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Stelline di sfondo: generate una volta sola per simulazione
function simGeneraStelle(quante) {
  sim.stelle = [];
  for (let i = 0; i < quante; i++) {
    sim.stelle.push({
      x: Math.random(), y: Math.random(),
      r: 0.4 + Math.random() * 1.3,
      lum: 0.35 + Math.random() * 0.65
    });
  }
}

function simDisegnaStelleSfondo(ctx, alpha) {
  if (alpha <= 0.01) return;
  ctx.save();
  sim.stelle.forEach(s => {
    ctx.globalAlpha = alpha * s.lum;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(s.x * sim.L, s.y * sim.H, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function simEtichetta(ctx, testo, x, y, colore, allineamento, grassetto) {
  ctx.save();
  ctx.font = `${grassetto ? 'bold ' : ''}13px system-ui, sans-serif`;
  ctx.fillStyle = colore || '#e2e8f0';
  ctx.textAlign = allineamento || 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(2,6,23,0.9)';
  ctx.shadowBlur = 4;
  ctx.fillText(testo, x, y);
  ctx.restore();
}

// Disco lunare con la fase indicata (0 = nuova, 1 = piena).
// versoDestra dice da che parte si trova il lato illuminato.
function simDisegnaLuna(ctx, x, y, r, frazione, versoDestra, coloreDisco, coloreOmbra, senzaCrateri) {
  const k = simClamp(typeof frazione === 'number' ? frazione : 1, 0, 1);
  ctx.save();
  ctx.translate(x, y);
  if (!versoDestra) ctx.rotate(Math.PI);

  // Superficie con i mari lunari
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = coloreDisco || '#e5e7eb';
  ctx.fillRect(-r, -r, 2 * r, 2 * r);
  if (!senzaCrateri) {
    ctx.fillStyle = 'rgba(100,116,139,0.35)';
    SIM_CRATERI.forEach(c => {
      ctx.beginPath();
      ctx.arc(c[0] * r, c[1] * r, c[2] * r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();

  // Parte in ombra: disco intero meno la zona illuminata (riempimento pari/dispari)
  const a = Math.abs(r * (1 - 2 * k));
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.moveTo(0, -r);
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.ellipse(0, 0, a, r, 0, Math.PI / 2, -Math.PI / 2, k <= 0.5);
  ctx.closePath();
  ctx.fillStyle = coloreOmbra || 'rgba(2,6,23,0.9)';
  ctx.fill('evenodd');

  ctx.restore();
}

// Nome della fase lunare a partire dall'angolo di fase (0…360°)
function simNomeFase(angolo) {
  const a = ((angolo % 360) + 360) % 360;
  if (a < 12 || a > 348) return 'Luna Nuova';
  if (a < 78) return 'Luna crescente';
  if (a < 102) return 'Primo Quarto';
  if (a < 168) return 'Gibbosa crescente';
  if (a < 192) return 'Luna Piena';
  if (a < 258) return 'Gibbosa calante';
  if (a < 282) return 'Ultimo Quarto';
  return 'Luna calante';
}

// =====================================================================
// 8.2 Costruzione della scena (che cosa simuliamo e su quale intervallo)
// =====================================================================

// Ricostruisce il passaggio della Luna nell'ombra: distanza minima dal centro
// dell'ombra (d) e velocità (v, in raggi lunari al minuto). Ogni ramo parte da
// una misura reale dell'eclissi, così le fasi cadono negli istanti giusti.
function simGeometriaEclissiLunare(dati) {
  const sdPenum = Math.max(5, dati.sdPenum || 60);
  const sdPartial = dati.sdPartial || 0;
  const sdTotal = dati.sdTotal || 0;
  const RU = SIM_R_UMBRA;
  const contattoOmbra = RU + 1;   // separazione al primo contatto con l'ombra
  const uscitaOmbra = RU - 1;     // separazione all'inizio della totalità
  let v, d;

  if (sdTotal > 0 && sdPartial > sdTotal) {
    // Totale: conosciamo l'istante del 1° contatto con l'ombra e quello
    // d'ingresso nella totalità, cioè due punti della stessa traiettoria.
    const v2 = (contattoOmbra * contattoOmbra - uscitaOmbra * uscitaOmbra) /
               (sdPartial * sdPartial - sdTotal * sdTotal);
    v = Math.sqrt(Math.max(v2, 1e-8));
    d = Math.sqrt(Math.max(0, contattoOmbra * contattoOmbra - v2 * sdPartial * sdPartial));
  } else if (sdPartial > 0) {
    // Parziale: al massimo la frazione di Luna dentro l'ombra è nota
    // (obscuration), e da lì si ricava la distanza minima.
    const obsc = simClamp(typeof dati.oscuramento === 'number' ? dati.oscuramento : 0.5, 0.01, 0.99);
    d = simSeparazioneDaOscuramento(obsc, RU);
    v = Math.sqrt(Math.max(1e-8, contattoOmbra * contattoOmbra - d * d)) / sdPartial;
  } else {
    // Penombrale: la Luna sfiora soltanto la penombra
    v = SIM_V_LUNA_OMBRA;
    d = Math.sqrt(Math.max(0, Math.pow(SIM_R_PENUMBRA + 1, 2) - v * v * sdPenum * sdPenum));
  }

  // Raggio della penombra tarato su questa eclissi, così il primo contatto
  // penombrale cade davvero all'inizio della finestra simulata.
  const rPenum = simClamp(Math.sqrt(d * d + v * v * sdPenum * sdPenum) - 1, RU + 0.4, 9);
  return { v, d, rPenum, sdPenum, sdPartial, sdTotal };
}

function simGeometriaEclissiSolare(dati) {
  let obsc = typeof dati.oscuramento === 'number' && !isNaN(dati.oscuramento)
    ? dati.oscuramento
    : (dati.kind === 'partial' ? 0.55 : 1);
  obsc = simClamp(obsc, 0.02, 1);

  // k = quanto il disco lunare è grande rispetto a quello solare.
  // Nelle eclissi centrali (totali, anulari, ibride) i due dischi si
  // allineano: dall'oscuramento al culmine si ricava direttamente k.
  let k, dmin;
  if (dati.kind === 'annular') {
    k = simClamp(Math.sqrt(obsc), 0.7, 0.995);
    dmin = 0;
  } else if (dati.kind === 'total' || dati.kind === 'hybrid') {
    k = 1.03;
    dmin = 0;
  } else {
    k = 1.0;
    dmin = simSeparazioneDaOscuramento(obsc, k);
  }
  // La fase parziale, dal punto migliore, dura tipicamente circa tre ore
  const semiDurata = 95; // minuti dal primo contatto al massimo
  const v = Math.sqrt(Math.max(0.01, Math.pow(1 + k, 2) - dmin * dmin)) / semiDurata;
  return { k, dmin, v, semiDurata, obsc };
}

// Descrive la scena da simulare: tipo, finestra temporale e durata visiva
function simCostruisciScena(ev) {
  const d = ev.dataObj.getTime();
  const dati = (ev.simul && ev.simul.scena) ? ev.simul : { scena: 'cielo' };
  const tipo = dati.scena;

  if (tipo === 'eclissiLunare') {
    const geo = simGeometriaEclissiLunare(dati);
    const semi = geo.sdPenum * 1.15 * SIM_MIN;
    return { tipo, dati, geo, inizio: d - semi, fine: d + semi, durata: 26,
      nota: 'Ombra e penombra terrestri sono ricostruite dalle durate reali delle fasi calcolate per questa eclissi.' };
  }
  if (tipo === 'eclissiSolare') {
    const geo = simGeometriaEclissiSolare(dati);
    const semi = geo.semiDurata * 1.12 * SIM_MIN;
    return { tipo, dati, geo, inizio: d - semi, fine: d + semi, durata: 26,
      nota: 'La scena mostra l’eclissi come si vede dal punto migliore. ⚠️ Nella realtà il Sole va guardato solo con filtri certificati.' };
  }
  if (tipo === 'faseLunare') {
    const semi = 3.5 * SIM_GIORNO;
    return { tipo, dati, inizio: d - semi, fine: d + semi, durata: 24,
      nota: 'Fase e illuminazione sono calcolate dalle posizioni reali di Sole, Terra e Luna.' };
  }
  if (tipo === 'stagione') {
    const semi = 80 * SIM_GIORNO;
    return { tipo, dati, inizio: d - semi, fine: d + semi, durata: 30,
      nota: 'L’inclinazione dell’asse terrestre resta fissa: cambia la direzione del Sole, e con essa la durata del giorno.' };
  }
  if (tipo === 'sciame') {
    const notte = new Date(d);
    notte.setHours(18, 0, 0, 0);
    return { tipo, dati, inizio: notte.getTime(), fine: notte.getTime() + 12 * SIM_ORA, durata: 32,
      nota: 'Il numero di meteore dipende da quanto è alto il radiante e da quanta luce manda la Luna: qui sono calcolati entrambi.' };
  }
  if (tipo === 'elongazione') {
    const semi = 45 * SIM_GIORNO;
    return { tipo, dati, inizio: d - semi, fine: d + semi, durata: 28,
      nota: 'Le posizioni di Terra e pianeta sono quelle vere: al massimo dell’elongazione il pianeta appare illuminato a metà.' };
  }
  // Evento generico (compresi quelli aggiunti a mano): si simula il cielo
  const semi = 4 * SIM_ORA;
  return { tipo: 'cielo', dati, inizio: d - semi, fine: d + semi, durata: 26,
    nota: 'Vista del cielo dall’alto: al centro lo zenit, sul bordo l’orizzonte. Nord in alto, Est a sinistra (come guardando in su).' };
}

function simTempo() {
  const s = sim.scena;
  return new Date(s.inizio + sim.t * (s.fine - s.inizio));
}

// =====================================================================
// 8.3 Scene: eclissi lunare
// =====================================================================
function simScenaEclissiLunare(ctx, tempo) {
  const L = sim.L, H = sim.H, geo = sim.scena.geo;
  const minuti = (tempo.getTime() - sim.evento.dataObj.getTime()) / SIM_MIN;
  const x = geo.v * minuti;            // spostamento lungo il percorso, in raggi lunari
  const sep = Math.sqrt(geo.d * geo.d + x * x);

  // Scala: deve entrare tutto il percorso, penombra compresa
  const mezzaLarghezza = Math.max(geo.rPenum, geo.v * geo.sdPenum * 1.2) + 1.5;
  const mezzaAltezza = Math.max(geo.rPenum, geo.d + 1.5) + 0.5;
  const scala = Math.min(L / (2 * mezzaLarghezza), H / (2 * mezzaAltezza));
  const cx = L / 2, cy = H / 2;

  // Cielo notturno
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, L, H);
  simDisegnaStelleSfondo(ctx, 0.8);

  // Penombra: sfumatura ampia e tenue
  const rPen = geo.rPenum * scala, rOmb = SIM_R_UMBRA * scala;
  const grad = ctx.createRadialGradient(cx, cy, rOmb * 0.9, cx, cy, rPen);
  grad.addColorStop(0, 'rgba(15,23,42,0.85)');
  grad.addColorStop(1, 'rgba(15,23,42,0)');
  ctx.beginPath(); ctx.arc(cx, cy, rPen, 0, Math.PI * 2);
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = 'rgba(148,163,184,0.35)';
  ctx.setLineDash([6, 6]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);

  // Ombra piena
  ctx.beginPath(); ctx.arc(cx, cy, rOmb, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(2,6,23,0.92)'; ctx.fill();
  ctx.strokeStyle = 'rgba(248,113,113,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();

  simEtichetta(ctx, 'ombra della Terra', cx, cy - rOmb - 12, '#fca5a5');
  simEtichetta(ctx, 'penombra', cx, cy - rPen - 12, '#94a3b8');

  // Percorso della Luna
  const my = cy - geo.d * scala;
  ctx.beginPath();
  ctx.moveTo(cx - mezzaLarghezza * scala, my);
  ctx.lineTo(cx + mezzaLarghezza * scala, my);
  ctx.strokeStyle = 'rgba(148,163,184,0.25)';
  ctx.setLineDash([4, 8]); ctx.stroke(); ctx.setLineDash([]);

  // Luna
  const mx = cx + x * scala, r = scala;
  const inPenombra = simClamp((geo.rPenum + 1 - sep) / (geo.rPenum - SIM_R_UMBRA + 2), 0, 1);
  simDisegnaLuna(ctx, mx, my, r, 1, true, '#e5e7eb', 'rgba(0,0,0,0)');

  // Attenuazione penombrale (uniforme, appena percepibile)
  ctx.save();
  ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = `rgba(15,23,42,${0.45 * inPenombra})`;
  ctx.fillRect(mx - r, my - r, 2 * r, 2 * r);
  // Morso dell'ombra: rosso cupo, con la forma vera del cono d'ombra
  ctx.beginPath(); ctx.arc(cx, cy, rOmb, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(120,26,18,0.93)'; ctx.fill();
  ctx.restore();

  // Bordo della Luna
  ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(226,232,240,0.5)'; ctx.lineWidth = 1; ctx.stroke();

  // Che fase stiamo guardando
  const magOmbra = (SIM_R_UMBRA + 1 - sep) / 2;
  let fase;
  if (magOmbra >= 1) fase = 'Totalità: la Luna è tutta dentro l’ombra e diventa rossa';
  else if (magOmbra > 0) fase = 'Fase parziale: l’ombra della Terra morde il disco lunare';
  else if (inPenombra > 0.02) fase = 'Fase penombrale: la Luna si scurisce appena';
  else fase = 'Fuori dall’ombra: Luna piena normale';

  // Da qui si vede? (la Luna deve essere sopra l'orizzonte)
  const righe = [
    `<p><strong>${fase}</strong></p>`,
    `<p>Distanza dal centro dell’ombra: <strong>${sep.toFixed(2)}</strong> raggi lunari · ` +
    `magnitudine ombrale: <strong>${Math.max(0, magOmbra).toFixed(2)}</strong></p>`,
    `<p>${minuti < 0 ? 'Mancano' : 'Sono passati'} <strong>${simDurataTesto(minuti)}</strong> ` +
    `${minuti < 0 ? 'al' : 'dal'} massimo dell’eclissi.</p>`
  ];
  righe.push(simVisibilitaCorpo('Moon', tempo, 'la Luna'));
  return righe;
}

// Dice se un corpo è sopra l'orizzonte per l'osservatore, nell'istante dato
function simVisibilitaCorpo(corpo, tempo, nome) {
  const o = simOsservatore();
  if (!o.obs || typeof Astronomy === 'undefined') return '';
  try {
    const equ = Astronomy.Equator(corpo, tempo, o.obs, true, true);
    const hor = Astronomy.Horizon(tempo, o.obs, equ.ra, equ.dec, 'normal');
    const dove = `${o.lat.toFixed(1)}°, ${o.lon.toFixed(1)}°`;
    if (hor.altitude > 0) {
      return `<p>📍 Dalla tua posizione (${dove}) ${nome} è <strong>sopra l’orizzonte</strong>, ` +
             `a ${hor.altitude.toFixed(0)}° di altezza: l’evento è visibile.</p>`;
    }
    return `<p>📍 Dalla tua posizione (${dove}) ${nome} è <strong>sotto l’orizzonte</strong> ` +
           `(${hor.altitude.toFixed(0)}°): da qui questa fase non si vede.</p>`;
  } catch (e) {
    return '';
  }
}

// =====================================================================
// 8.4 Scene: eclissi solare
// =====================================================================
function simScenaEclissiSolare(ctx, tempo) {
  const L = sim.L, H = sim.H, geo = sim.scena.geo;
  const minuti = (tempo.getTime() - sim.evento.dataObj.getTime()) / SIM_MIN;
  const dx = geo.v * minuti;
  const sep = Math.sqrt(geo.dmin * geo.dmin + dx * dx);
  const obsc = simOscuramento(sep, geo.k);

  // Quanta luce resta: cala in modo netto solo vicino alla totalità
  const luce = Math.pow(1 - simClamp(obsc, 0, 1), 0.28);

  // Cielo: dal celeste del giorno al blu profondo della totalità
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const mix = (a, b) => [
    Math.round(a[0] + (b[0] - a[0]) * luce),
    Math.round(a[1] + (b[1] - a[1]) * luce),
    Math.round(a[2] + (b[2] - a[2]) * luce)
  ];
  const alto = mix([5, 8, 22], [37, 99, 235]);
  const basso = mix([15, 23, 42], [186, 230, 253]);
  g.addColorStop(0, `rgb(${alto.join(',')})`);
  g.addColorStop(1, `rgb(${basso.join(',')})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L, H);

  // Stelle: compaiono quando il cielo si fa scuro davvero
  simDisegnaStelleSfondo(ctx, simClamp((0.45 - luce) * 2.2, 0, 0.9));

  // Sole e Luna
  const rSole = Math.min(L, H) * 0.16;
  const cx = L / 2, cy = H * 0.42;

  // Alone (si riduce con l'oscuramento)
  const alone = ctx.createRadialGradient(cx, cy, rSole * 0.9, cx, cy, rSole * 3.4);
  alone.addColorStop(0, `rgba(253,224,71,${0.55 * luce})`);
  alone.addColorStop(1, 'rgba(253,224,71,0)');
  ctx.fillStyle = alone;
  ctx.beginPath(); ctx.arc(cx, cy, rSole * 3.4, 0, Math.PI * 2); ctx.fill();

  // Corona: visibile solo quando il disco è coperto quasi del tutto
  const forzaCorona = simClamp((obsc - 0.985) / 0.015, 0, 1);
  if (forzaCorona > 0) {
    ctx.save();
    ctx.globalAlpha = forzaCorona;
    const corona = ctx.createRadialGradient(cx, cy, rSole, cx, cy, rSole * 2.6);
    corona.addColorStop(0, 'rgba(241,245,249,0.85)');
    corona.addColorStop(0.35, 'rgba(226,232,240,0.35)');
    corona.addColorStop(1, 'rgba(226,232,240,0)');
    ctx.fillStyle = corona;
    ctx.beginPath(); ctx.arc(cx, cy, rSole * 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Disco solare
  ctx.beginPath(); ctx.arc(cx, cy, rSole, 0, Math.PI * 2);
  ctx.fillStyle = '#fde047'; ctx.fill();

  // Disco lunare (nero) che scorre davanti al Sole
  const mx = cx + dx * rSole, my = cy - geo.dmin * rSole;
  ctx.beginPath(); ctx.arc(mx, my, rSole * geo.k, 0, Math.PI * 2);
  ctx.fillStyle = '#0b1120'; ctx.fill();

  // Paesaggio in basso, che si scurisce con la luce
  const buio = 1 - luce;
  ctx.fillStyle = `rgb(${Math.round(30 - 22 * buio)},${Math.round(41 - 32 * buio)},${Math.round(59 - 45 * buio)})`;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H * 0.82);
  ctx.quadraticCurveTo(L * 0.2, H * 0.74, L * 0.42, H * 0.83);
  ctx.quadraticCurveTo(L * 0.65, H * 0.92, L * 0.78, H * 0.8);
  ctx.quadraticCurveTo(L * 0.9, H * 0.72, L, H * 0.84);
  ctx.lineTo(L, H);
  ctx.closePath();
  ctx.fill();

  let fase;
  if (obsc >= 0.999 && geo.k >= 1) fase = 'Totalità: il giorno diventa notte e appare la corona solare';
  else if (sim.scena.dati.kind === 'annular' && sep <= 1 - geo.k) fase = 'Anularità: resta un anello di fuoco attorno alla Luna';
  else if (obsc > 0.001) fase = 'Fase parziale: la Luna morde il disco del Sole';
  else fase = 'Prima o dopo l’eclissi: il Sole è integro';

  return [
    `<p><strong>${fase}</strong></p>`,
    `<p>Sole oscurato: <strong>${(obsc * 100).toFixed(1)}%</strong> · luce ambientale residua ≈ <strong>${(luce * 100).toFixed(0)}%</strong></p>`,
    `<p>${minuti < 0 ? 'Mancano' : 'Sono passati'} <strong>${simDurataTesto(minuti)}</strong> ${minuti < 0 ? 'al' : 'dal'} massimo.</p>`,
    sim.scena.dati.lat != null
      ? `<p>🌍 Scena vista dal punto di massima eclissi (${formattaCoordinate(sim.scena.dati.lat, sim.scena.dati.lon)}). Altrove il Sole viene coperto meno.</p>`
      : '<p>🌍 Eclissi parziale ovunque: non esiste un punto di totalità sulla Terra.</p>'
  ];
}

// =====================================================================
// 8.5 Scene: fase lunare
// =====================================================================
function simScenaFaseLunare(ctx, tempo) {
  const L = sim.L, H = sim.H;
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, L, H);
  simDisegnaStelleSfondo(ctx, 0.7);

  let frazione = 0.5, angoloFase = 90;
  try {
    frazione = Astronomy.Illumination('Moon', tempo).phase_fraction;
    angoloFase = Astronomy.MoonPhase(tempo);
  } catch (e) { /* libreria non disponibile */ }

  // Due riquadri affiancati (o impilati sugli schermi stretti): a sinistra la
  // Luna vista da qui, a destra lo schema Sole–Terra–Luna visto dall'alto.
  const orizzontale = L > H * 1.15;
  const aX = orizzontale ? L * 0.25 : L / 2;
  const aY = orizzontale ? H / 2 : H * 0.27;
  const bX = orizzontale ? L * 0.78 : L * 0.62;
  const bY = orizzontale ? H / 2 : H * 0.74;
  const rLuna = orizzontale ? Math.min(L * 0.17, H * 0.34) : Math.min(L * 0.24, H * 0.19);

  // 1) La Luna come la vediamo dalla Terra
  simDisegnaLuna(ctx, aX, aY, rLuna, frazione, angoloFase < 180, '#e5e7eb', 'rgba(2,6,23,0.92)');
  simEtichetta(ctx, 'come la vedi dalla Terra', aX, aY + rLuna + 18, '#94a3b8');

  // 2) Schema visto dall'alto: Sole a sinistra, Terra al centro, Luna in orbita.
  //    Il Sole sta a 1,95 raggi d'orbita: il riquadro deve contenerli tutti.
  const rOrbita = orizzontale
    ? Math.min((L - bX) * 0.85, (bX - L * 0.5) / 2.2, H * 0.32)
    : Math.min((L - bX) * 0.85, (bX - L * 0.06) / 2.2, H * 0.2);
  ctx.beginPath();
  ctx.arc(bX, bY, rOrbita, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(148,163,184,0.3)';
  ctx.setLineDash([4, 6]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);

  // Raggi del Sole, che arrivano da sinistra
  ctx.strokeStyle = 'rgba(250,204,21,0.45)';
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    const y = bY + i * rOrbita * 0.45;
    ctx.beginPath();
    ctx.moveTo(bX - rOrbita * 1.75, y);
    ctx.lineTo(bX - rOrbita * 1.15, y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(bX - rOrbita * 1.95, bY, Math.max(10, rOrbita * 0.22), 0, Math.PI * 2);
  ctx.fillStyle = '#facc15'; ctx.fill();
  simEtichetta(ctx, 'Sole', bX - rOrbita * 1.95, bY + rOrbita * 0.45, '#facc15');

  // Terra: metà illuminata verso il Sole
  const rTerra = Math.max(8, rOrbita * 0.17);
  ctx.beginPath(); ctx.arc(bX, bY, rTerra, 0, Math.PI * 2);
  ctx.fillStyle = '#1d4ed8'; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(bX, bY, rTerra, -Math.PI / 2, Math.PI / 2); ctx.clip();
  ctx.fillStyle = 'rgba(2,6,23,0.75)';
  ctx.fillRect(bX, bY - rTerra, rTerra, rTerra * 2);
  ctx.restore();
  simEtichetta(ctx, 'Terra', bX, bY + rTerra + 14, '#93c5fd');

  // Luna in orbita: l'angolo rispetto al Sole è proprio l'angolo di fase
  const theta = (180 + angoloFase) * Math.PI / 180;
  const lx = bX + rOrbita * Math.cos(theta);
  const ly = bY - rOrbita * Math.sin(theta);
  const rMini = Math.max(6, rOrbita * 0.11);
  ctx.beginPath(); ctx.arc(lx, ly, rMini, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a'; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(lx, ly, rMini, Math.PI / 2, -Math.PI / 2); ctx.clip();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(lx - rMini, ly - rMini, rMini, rMini * 2);
  ctx.restore();
  ctx.beginPath(); ctx.arc(lx, ly, rMini, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(226,232,240,0.6)'; ctx.lineWidth = 1; ctx.stroke();

  // Linea di vista Terra → Luna
  ctx.beginPath();
  ctx.moveTo(bX, bY); ctx.lineTo(lx, ly);
  ctx.strokeStyle = 'rgba(96,165,250,0.5)';
  ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]);
  simEtichetta(ctx, 'vista dall’alto', bX, orizzontale ? bY - rOrbita - 18 : H - 12, '#94a3b8');

  const minutiEvento = (tempo.getTime() - sim.evento.dataObj.getTime()) / SIM_MIN;
  return [
    `<p><strong>${simNomeFase(angoloFase)}</strong> · disco illuminato al <strong>${(frazione * 100).toFixed(0)}%</strong></p>`,
    `<p>Angolo Sole–Terra–Luna: <strong>${angoloFase.toFixed(0)}°</strong>. La metà della Luna rivolta al Sole è sempre illuminata: cambia solo quanta ne vediamo da qui.</p>`,
    `<p>${minutiEvento < 0 ? 'Mancano' : 'Sono passati'} <strong>${simDurataTesto(minutiEvento)}</strong> ${minutiEvento < 0 ? 'all’istante esatto di' : 'dall’istante esatto di'} «${sim.evento.titolo}».</p>`
  ];
}

// =====================================================================
// 8.6 Scene: equinozi e solstizi
// =====================================================================

// Proiezione ortografica del globo: asse inclinato di dec verso il Sole,
// che illumina da sinistra. La camera guarda da davanti, un po' dall'alto.
function simPuntoGlobo(lat, lon, dec) {
  const d2r = Math.PI / 180;
  const eps = 20 * d2r;                       // camera sollevata sull'equatore
  const dd = dec * d2r, la = lat * d2r, lo = lon * d2r;
  const n = [-Math.sin(dd), 0, Math.cos(dd)]; // asse di rotazione terrestre
  const a1 = [Math.cos(dd), 0, Math.sin(dd)]; // versore equatoriale (verso il Sole a lon 0)
  const a2 = [0, 1, 0];
  const P = [
    Math.cos(la) * Math.cos(lo) * a1[0] + Math.cos(la) * Math.sin(lo) * a2[0] + Math.sin(la) * n[0],
    Math.cos(la) * Math.cos(lo) * a1[1] + Math.cos(la) * Math.sin(lo) * a2[1] + Math.sin(la) * n[1],
    Math.cos(la) * Math.cos(lo) * a1[2] + Math.cos(la) * Math.sin(lo) * a2[2] + Math.sin(la) * n[2]
  ];
  const r = [1, 0, 0];                        // destra sullo schermo
  const u = [0, Math.sin(eps), Math.cos(eps)];// alto sullo schermo
  const c = [0, -Math.cos(eps), Math.sin(eps)];// verso la camera
  return {
    x: P[0] * r[0] + P[1] * r[1] + P[2] * r[2],
    y: -(P[0] * u[0] + P[1] * u[1] + P[2] * u[2]),
    visibile: (P[0] * c[0] + P[1] * c[1] + P[2] * c[2]) > 0,
    illuminato: P[0] < 0 // il Sole sta in direzione −x
  };
}

function simDisegnaParallelo(ctx, cx, cy, R, lat, dec, colore, tratteggio) {
  ctx.save();
  ctx.strokeStyle = colore;
  ctx.lineWidth = 1;
  if (tratteggio) ctx.setLineDash(tratteggio);
  let disegnando = false;
  ctx.beginPath();
  for (let lon = -180; lon <= 180; lon += 4) {
    const p = simPuntoGlobo(lat, lon, dec);
    if (!p.visibile) { disegnando = false; continue; }
    const x = cx + p.x * R, y = cy + p.y * R;
    if (!disegnando) { ctx.moveTo(x, y); disegnando = true; } else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function simScenaStagione(ctx, tempo) {
  const L = sim.L, H = sim.H;
  const o = simOsservatore();

  let dec = 0;
  try {
    const equ = Astronomy.Equator('Sun', tempo, o.obs, true, true);
    dec = equ.dec;
  } catch (e) { /* niente libreria */ }

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, L, H);
  simDisegnaStelleSfondo(ctx, 0.5);

  const cx = L * 0.6, cy = H / 2;
  const R = Math.min(L * 0.26, H * 0.38);

  // Sole e raggi orizzontali da sinistra
  const rSole = Math.max(16, R * 0.42);
  const sx = Math.max(rSole + 8, L * 0.1);
  const alone = ctx.createRadialGradient(sx, cy, rSole * 0.6, sx, cy, rSole * 2.4);
  alone.addColorStop(0, 'rgba(250,204,21,0.55)');
  alone.addColorStop(1, 'rgba(250,204,21,0)');
  ctx.fillStyle = alone;
  ctx.beginPath(); ctx.arc(sx, cy, rSole * 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx, cy, rSole, 0, Math.PI * 2);
  ctx.fillStyle = '#facc15'; ctx.fill();
  simEtichetta(ctx, 'Sole', sx, cy + rSole + 16, '#facc15');

  ctx.strokeStyle = 'rgba(250,204,21,0.35)';
  ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i++) {
    const y = cy + i * R * 0.42;
    ctx.beginPath();
    ctx.moveTo(sx + rSole + 10, y);
    ctx.lineTo(cx - R - 14, y);
    ctx.stroke();
  }

  // Globo: metà diurna a sinistra, metà notturna a destra
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(cx, cy - R, R, 2 * R);
  // Sfumatura del terminatore
  const term = ctx.createLinearGradient(cx - R * 0.25, 0, cx + R * 0.25, 0);
  term.addColorStop(0, 'rgba(11,18,32,0)');
  term.addColorStop(1, 'rgba(11,18,32,0.95)');
  ctx.fillStyle = term;
  ctx.fillRect(cx - R * 0.25, cy - R, R * 0.5, 2 * R);
  ctx.restore();

  // Paralleli notevoli: tropici, circoli polari, equatore
  simDisegnaParallelo(ctx, cx, cy, R, 0, dec, 'rgba(226,232,240,0.55)');
  [23.44, -23.44].forEach(l => simDisegnaParallelo(ctx, cx, cy, R, l, dec, 'rgba(148,163,184,0.35)', [3, 4]));
  [66.56, -66.56].forEach(l => simDisegnaParallelo(ctx, cx, cy, R, l, dec, 'rgba(96,165,250,0.45)', [2, 5]));

  // Asse terrestre (inclinazione fissa: cambia la direzione da cui arriva la luce)
  const pn = simPuntoGlobo(90, 0, dec), ps = simPuntoGlobo(-90, 0, dec);
  ctx.beginPath();
  ctx.moveTo(cx + ps.x * R * 1.18, cy + ps.y * R * 1.18);
  ctx.lineTo(cx + pn.x * R * 1.18, cy + pn.y * R * 1.18);
  ctx.strokeStyle = 'rgba(248,250,252,0.8)'; ctx.lineWidth = 2; ctx.stroke();
  simEtichetta(ctx, 'N', cx + pn.x * R * 1.3, cy + pn.y * R * 1.3, '#f8fafc', 'center', true);

  // Il parallelo dell'osservatore, con un puntino che gira: giorno e notte
  simDisegnaParallelo(ctx, cx, cy, R, o.lat, dec, 'rgba(74,222,128,0.8)');
  const lonPunto = ((sim.giro * 360) % 360) - 180;
  const p = simPuntoGlobo(o.lat, lonPunto, dec);
  if (p.visibile) {
    ctx.beginPath();
    ctx.arc(cx + p.x * R, cy + p.y * R, 5, 0, Math.PI * 2);
    ctx.fillStyle = p.illuminato ? '#fde047' : '#22c55e';
    ctx.fill();
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1; ctx.stroke();
    simEtichetta(ctx, p.illuminato ? 'qui è giorno' : 'qui è notte',
      cx + p.x * R, cy + p.y * R - 14, p.illuminato ? '#fde047' : '#86efac');
  }

  simEtichetta(ctx, 'giorno', cx - R * 0.55, cy + R + 20, '#bae6fd');
  simEtichetta(ctx, 'notte', cx + R * 0.55, cy + R + 20, '#94a3b8');

  // Durata del giorno alla latitudine dell'osservatore
  const d2r = Math.PI / 180;
  const cosH = -Math.tan(o.lat * d2r) * Math.tan(dec * d2r);
  let oreLuce;
  if (cosH <= -1) oreLuce = 24;
  else if (cosH >= 1) oreLuce = 0;
  else oreLuce = 2 * Math.acos(cosH) / d2r / 15;
  const altMezzogiorno = 90 - Math.abs(o.lat - dec);

  const giorni = (tempo.getTime() - sim.evento.dataObj.getTime()) / SIM_GIORNO;
  return [
    `<p><strong>Declinazione del Sole: ${dec >= 0 ? '+' : ''}${dec.toFixed(2)}°</strong> — è la latitudine dove il Sole sta esattamente allo zenit a mezzogiorno.</p>`,
    `<p>A ${o.lat.toFixed(1)}° di latitudine il Sole resta sopra l’orizzonte <strong>${Math.floor(Math.round(oreLuce * 60) / 60)}h ${String(Math.round(oreLuce * 60) % 60).padStart(2, '0')}m</strong> ` +
    `e a mezzogiorno arriva a <strong>${altMezzogiorno.toFixed(0)}°</strong> di altezza.</p>`,
    `<p>${Math.abs(giorni) < 0.5 ? '🎯 Siamo nell’istante dell’evento.' :
      `${giorni < 0 ? 'Mancano' : 'Sono passati'} <strong>${Math.abs(giorni).toFixed(0)} giorni</strong> ${giorni < 0 ? 'all’' : 'dall’'}evento.`}</p>`
  ];
}

// =====================================================================
// 8.7 Vista del cielo a cupola (usata da sciami e eventi generici)
// =====================================================================

// Proiezione a tutto cielo: zenit al centro, orizzonte sul bordo.
// Nord in alto ed Est a sinistra, come quando si guarda in su.
function simProiettaCupola(az, alt, cx, cy, R) {
  const r = (90 - alt) / 90 * R;
  const a = az * Math.PI / 180;
  return { x: cx - r * Math.sin(a), y: cy - r * Math.cos(a), fuori: alt < 0 };
}

function simCorpiCielo(tempo) {
  const o = simOsservatore();
  if (!o.obs || typeof Astronomy === 'undefined') return [];
  skyDefinisciStelle();
  const t = Astronomy.MakeTime(tempo);
  const lista = [];
  SKY_ASTRI.forEach(astro => {
    try {
      const equ = Astronomy.Equator(astro.id, t, o.obs, true, true);
      const hor = Astronomy.Horizon(t, o.obs, equ.ra, equ.dec, 'normal');
      const voce = Object.assign({}, astro, { az: hor.azimuth, alt: hor.altitude });
      if (astro.tipo === 'luna' || astro.tipo === 'pianeta') {
        try {
          const ill = Astronomy.Illumination(astro.id, t);
          voce.frazione = ill.phase_fraction;
          voce.mag = ill.mag;
        } catch (e) { /* magnitudine non disponibile */ }
      }
      lista.push(voce);
    } catch (e) { /* corpo non calcolabile */ }
  });
  return lista;
}

// Colori del cielo in base a quanto è alto (o basso) il Sole
function simColoriCielo(altSole) {
  if (altSole > 5) return ['#0369a1', '#7dd3fc'];
  if (altSole > -0.5) return ['#1e3a8a', '#f59e0b'];
  if (altSole > -6) return ['#0f172a', '#6d28d9'];
  if (altSole > -18) return ['#020617', '#1e293b'];
  return ['#010409', '#0b1220'];
}

function simDisegnaCupola(ctx, cx, cy, R, corpi, altSole) {
  const g = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R);
  const c = simColoriCielo(altSole);
  g.addColorStop(0, c[0]);
  g.addColorStop(1, c[1]);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(148,163,184,0.6)'; ctx.lineWidth = 2; ctx.stroke();

  // Cerchi di altezza 30° e 60°
  ctx.strokeStyle = 'rgba(148,163,184,0.22)'; ctx.lineWidth = 1;
  [30, 60].forEach(a => {
    ctx.beginPath(); ctx.arc(cx, cy, (90 - a) / 90 * R, 0, Math.PI * 2); ctx.stroke();
  });

  // Punti cardinali sul bordo
  [['N', 0], ['E', 90], ['S', 180], ['O', 270]].forEach(([nome, az]) => {
    const p = simProiettaCupola(az, -6, cx, cy, R);
    simEtichetta(ctx, nome, p.x, p.y, nome === 'N' ? '#f87171' : '#cbd5e1', 'center', true);
  });

  // Astri sopra l'orizzonte. Grandezza e trasparenza seguono la magnitudine:
  // Urano e Nettuno, invisibili a occhio nudo, restano puntini smorti.
  corpi.filter(o => o.alt > -1).forEach(o => {
    const p = simProiettaCupola(o.az, Math.max(o.alt, 0), cx, cy, R);
    if (o.tipo === 'luna') {
      simDisegnaLuna(ctx, p.x, p.y, 9, o.frazione, true, '#e5e7eb', 'rgba(2,6,23,0.85)');
      simEtichetta(ctx, 'Luna', p.x, p.y + 20, '#e2e8f0');
      return;
    }
    const mag = typeof o.mag === 'number' ? o.mag : 2;
    const r = o.tipo === 'sole' ? 11 : simClamp(5.5 - mag * 0.9, 1.6, 7);
    const aOcchioNudo = o.tipo === 'sole' || mag <= 5.5;

    ctx.save();
    ctx.globalAlpha = aOcchioNudo ? 1 : 0.4;
    const alone = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
    alone.addColorStop(0, o.colore + 'aa');
    alone.addColorStop(1, o.colore + '00');
    ctx.fillStyle = alone;
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = o.colore; ctx.fill();
    ctx.restore();

    // Etichetta solo per il Sole e per i pianeti che si vedono davvero
    if (o.tipo === 'sole' || (o.tipo === 'pianeta' && mag <= 4)) {
      simEtichetta(ctx, o.nome, p.x, p.y + r + 12, '#cbd5e1');
    }
  });
}

// =====================================================================
// 8.8 Scene: sciame meteorico
// =====================================================================
function simScenaSciame(ctx, tempo, dtReale) {
  const L = sim.L, H = sim.H;
  const dati = sim.scena.dati;
  const o = simOsservatore();
  const cx = L / 2, cy = H / 2;
  const R = Math.min(L, H) * 0.45;

  const corpi = simCorpiCielo(tempo);
  const sole = corpi.find(c => c.id === 'Sun');
  const luna = corpi.find(c => c.id === 'Moon');
  const altSole = sole ? sole.alt : -30;

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, L, H);

  // Radiante dello sciame
  let radiante = { az: 0, alt: -90 };
  if (o.obs && typeof Astronomy !== 'undefined' && typeof dati.ra === 'number') {
    try {
      radiante = Astronomy.Horizon(tempo, o.obs, dati.ra, dati.dec, 'normal');
      radiante = { az: radiante.azimuth, alt: radiante.altitude };
    } catch (e) { /* niente radiante */ }
  }

  simDisegnaCupola(ctx, cx, cy, R, corpi, altSole);

  const pr = simProiettaCupola(radiante.az, Math.max(radiante.alt, 0), cx, cy, R);

  // Quante meteore all'ora: dipende dall'altezza del radiante, dal chiaro di
  // Luna e dal crepuscolo. È la formula usata dagli osservatori (ZHR · sin h).
  const senoAlt = Math.max(0, Math.sin(radiante.alt * Math.PI / 180));
  const disturboLuna = (luna && luna.alt > 0) ? 0.55 * (luna.frazione || 0) : 0;
  const disturboSole = altSole > -12 ? 0.9 : 0;
  const tasso = (dati.zhr || 20) * senoAlt * (1 - disturboLuna) * (1 - disturboSole);

  // Nuove scie, con frequenza proporzionale al tasso reale
  if (radiante.alt > 0) {
    const attese = simClamp(tasso / 14, 0.15, 7) * dtReale;
    if (Math.random() < attese) {
      const ang = Math.random() * Math.PI * 2;
      const dist = R * (0.06 + Math.random() * 0.62);
      sim.meteore.push({
        x: pr.x + Math.cos(ang) * dist,
        y: pr.y + Math.sin(ang) * dist,
        dx: Math.cos(ang), dy: Math.sin(ang),
        lung: R * (0.08 + Math.random() * 0.22),
        vita: 0,
        durata: 0.45 + Math.random() * 0.5,
        lum: 0.5 + Math.random() * 0.5
      });
    }
  }

  // Disegno delle scie (dentro la cupola)
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  sim.meteore = sim.meteore.filter(m => {
    m.vita += dtReale;
    if (m.vita > m.durata) return false;
    const avanzamento = m.vita / m.durata;
    const x = m.x + m.dx * m.lung * avanzamento * 2.2;
    const y = m.y + m.dy * m.lung * avanzamento * 2.2;
    const scia = ctx.createLinearGradient(x - m.dx * m.lung, y - m.dy * m.lung, x, y);
    const alpha = m.lum * Math.sin(Math.PI * avanzamento);
    scia.addColorStop(0, 'rgba(226,232,240,0)');
    scia.addColorStop(1, `rgba(255,255,255,${alpha})`);
    ctx.strokeStyle = scia;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - m.dx * m.lung, y - m.dy * m.lung);
    ctx.lineTo(x, y);
    ctx.stroke();
    return true;
  });
  ctx.restore();

  // Segno del radiante
  if (radiante.alt > -2) {
    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(pr.x, pr.y, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.arc(pr.x, pr.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#22d3ee'; ctx.fill();
    simEtichetta(ctx, 'radiante', pr.x, pr.y - 24, '#67e8f9', 'center', true);
  }

  const ora = tempo.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const righe = [
    `<p><strong>Ore ${ora}</strong> · radiante ${radiante.alt > 0
      ? `a <strong>${radiante.alt.toFixed(0)}°</strong> sopra l’orizzonte`
      : '<strong>ancora sotto l’orizzonte</strong>'}</p>`,
    `<p>Meteore attese: <strong>${Math.round(tasso)} all’ora</strong> ` +
    `(su ${dati.zhr || 20}/ora teoriche con radiante allo zenit e cielo perfetto).</p>`
  ];
  if (disturboSole > 0) righe.push('<p>☀️ C’è ancora luce crepuscolare: le meteore deboli restano invisibili.</p>');
  if (luna && luna.alt > 0 && (luna.frazione || 0) > 0.25) {
    righe.push(`<p>🌙 La Luna è alta ${luna.alt.toFixed(0)}° e illuminata al ${((luna.frazione || 0) * 100).toFixed(0)}%: il suo chiarore riduce il conteggio.</p>`);
  } else if (radiante.alt > 0) {
    righe.push('<p>🌑 Niente disturbo lunare: condizioni buone, se il cielo è scuro.</p>');
  }
  return righe;
}

// =====================================================================
// 8.9 Scene: massima elongazione di un pianeta
// =====================================================================
function simScenaElongazione(ctx, tempo) {
  const L = sim.L, H = sim.H;
  const dati = sim.scena.dati;
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, L, H);
  simDisegnaStelleSfondo(ctx, 0.55);

  let vTerra = null, vPianeta = null, elong = null, frazione = 0.5, mag = null;
  try {
    vTerra = Astronomy.HelioVector('Earth', tempo);
    vPianeta = Astronomy.HelioVector(dati.corpo, tempo);
    const e = Astronomy.Elongation(dati.corpo, tempo);
    elong = e.elongation;
    const ill = Astronomy.Illumination(dati.corpo, tempo);
    frazione = ill.phase_fraction;
    mag = ill.mag;
  } catch (e) { /* libreria non disponibile */ }

  const cx = L * 0.5, cy = H * 0.52;
  const R = Math.min(L, H) * 0.36;   // raggio dell'orbita terrestre sullo schermo

  // Orbite
  ctx.strokeStyle = 'rgba(148,163,184,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  const raggioPianeta = vPianeta ? Math.hypot(vPianeta.x, vPianeta.y) : 0.7;
  ctx.beginPath(); ctx.arc(cx, cy, R * raggioPianeta, 0, Math.PI * 2); ctx.stroke();

  // Sole al centro
  const alone = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
  alone.addColorStop(0, 'rgba(250,204,21,0.7)');
  alone.addColorStop(1, 'rgba(250,204,21,0)');
  ctx.fillStyle = alone;
  ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#facc15'; ctx.fill();
  simEtichetta(ctx, 'Sole', cx, cy + 24, '#facc15');

  if (vTerra && vPianeta) {
    const tx = cx + vTerra.x * R, ty = cy - vTerra.y * R;
    const px = cx + vPianeta.x * R, py = cy - vPianeta.y * R;

    // Linee di vista dalla Terra
    ctx.strokeStyle = 'rgba(250,204,21,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.strokeStyle = 'rgba(168,85,247,0.85)';
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke();

    // Arco dell'angolo di elongazione, visto dalla Terra
    const a1 = Math.atan2(cy - ty, cx - tx);
    const a2 = Math.atan2(py - ty, px - tx);
    ctx.beginPath();
    ctx.arc(tx, ty, 42, a1, a2, ((a2 - a1 + Math.PI * 2) % (Math.PI * 2)) > Math.PI);
    ctx.strokeStyle = 'rgba(226,232,240,0.75)'; ctx.lineWidth = 1.5;
    ctx.stroke();
    if (elong != null) {
      const am = a1 + (((a2 - a1 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) / 2;
      simEtichetta(ctx, `${elong.toFixed(0)}°`, tx + Math.cos(am) * 58, ty + Math.sin(am) * 58, '#f8fafc', 'center', true);
    }

    // Terra
    ctx.beginPath(); ctx.arc(tx, ty, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6'; ctx.fill();
    simEtichetta(ctx, 'Terra', tx, ty + 20, '#93c5fd');

    // Pianeta
    ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#e9d5ff'; ctx.fill();
    simEtichetta(ctx, dati.nome, px, py + 20, '#d8b4fe');
  }

  // Riquadro: il pianeta al telescopio, con la sua fase
  const rq = Math.min(L, H) * 0.13;
  const qx = L - rq - 18, qy = rq + 18;
  ctx.save();
  ctx.fillStyle = 'rgba(2,6,23,0.75)';
  ctx.strokeStyle = 'rgba(148,163,184,0.4)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(qx - rq - 8, qy - rq - 8, (rq + 8) * 2, (rq + 8) * 2 + 16, 12)
                : ctx.rect(qx - rq - 8, qy - rq - 8, (rq + 8) * 2, (rq + 8) * 2 + 16);
  ctx.fill(); ctx.stroke();
  ctx.restore();
  // Venere ha nubi uniformi, Mercurio è craterizzato come la Luna
  simDisegnaLuna(ctx, qx, qy, rq * 0.75, frazione,
    dati.visibilita === 'evening', '#fde68a', 'rgba(2,6,23,0.9)', dati.corpo !== 'Mercury');
  simEtichetta(ctx, `al telescopio: ${(frazione * 100).toFixed(0)}%`, qx, qy + rq * 0.75 + 16, '#cbd5e1');

  const giorni = (tempo.getTime() - sim.evento.dataObj.getTime()) / SIM_GIORNO;
  const quando = dati.visibilita === 'morning' ? 'al mattino, prima dell’alba' : 'alla sera, dopo il tramonto';
  return [
    `<p><strong>Elongazione: ${elong != null ? elong.toFixed(1) + '°' : '—'}</strong> — è l’angolo fra ${dati.nome} e il Sole visto dalla Terra. Più è grande, più il pianeta si stacca dalla luce del Sole.</p>`,
    `<p>Disco illuminato al <strong>${(frazione * 100).toFixed(0)}%</strong>${mag != null ? ` · magnitudine <strong>${mag.toFixed(1)}</strong>` : ''} · visibile ${quando}.</p>`,
    `<p>${Math.abs(giorni) < 0.5 ? '🎯 Siamo nel giorno della massima elongazione.' :
      `${giorni < 0 ? 'Mancano' : 'Sono passati'} <strong>${Math.abs(giorni).toFixed(0)} giorni</strong> ${giorni < 0 ? 'al' : 'dal'} massimo.`}</p>`
  ];
}

// =====================================================================
// 8.10 Scene: cielo generico (eventi personali e tutto il resto)
// =====================================================================
function simScenaCielo(ctx, tempo) {
  const L = sim.L, H = sim.H;
  const cx = L / 2, cy = H / 2;
  const R = Math.min(L, H) * 0.45;

  const corpi = simCorpiCielo(tempo);
  const sole = corpi.find(c => c.id === 'Sun');
  const luna = corpi.find(c => c.id === 'Moon');
  const altSole = sole ? sole.alt : -30;

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, L, H);
  simDisegnaCupola(ctx, cx, cy, R, corpi, altSole);

  const o = simOsservatore();
  // Solo i pianeti che si vedono davvero a occhio nudo (Urano e Nettuno no)
  const pianeti = corpi
    .filter(c => c.tipo === 'pianeta' && c.alt > 0 && (typeof c.mag !== 'number' || c.mag <= 5.5))
    .map(c => c.nome);

  let condizione;
  if (altSole > 0) condizione = `☀️ È giorno: il Sole è a ${altSole.toFixed(0)}° sull’orizzonte.`;
  else if (altSole > -6) condizione = '🌆 Crepuscolo civile: si vedono solo gli astri più luminosi.';
  else if (altSole > -18) condizione = '🌌 Crepuscolo astronomico: il cielo si sta facendo scuro.';
  else condizione = '🌑 Notte piena: cielo completamente buio.';

  return [
    `<p><strong>${simOraTesto(tempo)}</strong> — vista da ${o.lat.toFixed(1)}°, ${o.lon.toFixed(1)}°${o.reale ? '' : ' (posizione predefinita)'}</p>`,
    `<p>${condizione}</p>`,
    luna && luna.alt > 0
      ? `<p>🌙 La Luna è alta ${luna.alt.toFixed(0)}°, illuminata al ${((luna.frazione || 0) * 100).toFixed(0)}%.</p>`
      : '<p>🌙 La Luna è sotto l’orizzonte.</p>',
    pianeti.length
      ? `<p>🪐 Pianeti visibili a occhio nudo: <strong>${pianeti.join(', ')}</strong>.</p>`
      : '<p>🪐 Nessun pianeta visibile a occhio nudo in questo momento.</p>'
  ];
}

// =====================================================================
// 8.11 Ciclo di disegno e comandi
// =====================================================================

function simRidimensiona() {
  if (!sim.canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const l = sim.canvas.clientWidth || 320;
  const h = sim.canvas.clientHeight || 300;
  sim.L = l; sim.H = h;
  sim.canvas.width = Math.round(l * dpr);
  sim.canvas.height = Math.round(h * dpr);
  sim.ctx = sim.canvas.getContext('2d');
  sim.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function simDisegna(dtReale) {
  if (!sim.ctx || !sim.scena) return;
  const ctx = sim.ctx;
  const tempo = simTempo();
  ctx.clearRect(0, 0, sim.L, sim.H);

  let righe = [];
  if (typeof Astronomy === 'undefined') {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, sim.L, sim.H);
    simEtichetta(ctx, 'Libreria astronomica non disponibile', sim.L / 2, sim.H / 2, '#f87171');
    righe = ['<p>Impossibile simulare l’evento senza la libreria astronomica: controlla la connessione.</p>'];
  } else {
    try {
      switch (sim.scena.tipo) {
        case 'eclissiLunare': righe = simScenaEclissiLunare(ctx, tempo); break;
        case 'eclissiSolare': righe = simScenaEclissiSolare(ctx, tempo); break;
        case 'faseLunare':    righe = simScenaFaseLunare(ctx, tempo); break;
        case 'stagione':      righe = simScenaStagione(ctx, tempo); break;
        case 'sciame':        righe = simScenaSciame(ctx, tempo, dtReale); break;
        case 'elongazione':   righe = simScenaElongazione(ctx, tempo); break;
        default:              righe = simScenaCielo(ctx, tempo); break;
      }
    } catch (err) {
      console.error('Errore nella simulazione:', err);
      righe = ['<p>Non è stato possibile calcolare questo istante della simulazione.</p>'];
    }
  }

  const oraEl = document.getElementById('sim-ora');
  if (oraEl) oraEl.textContent = simOraTesto(tempo);
  const didasc = document.getElementById('sim-didascalia');
  if (didasc) didasc.innerHTML = righe.filter(Boolean).join('');
}

function simCiclo(ts) {
  if (!sim.aperto) return;
  const dt = sim.ultimoTs ? Math.min((ts - sim.ultimoTs) / 1000, 0.1) : 0;
  sim.ultimoTs = ts;

  // La Terra gira sempre (serve alla scena delle stagioni)
  sim.giro = (sim.giro + dt / 6) % 1;

  if (sim.riproduce && sim.scena) {
    sim.t += dt / sim.scena.durata * sim.velocita;
    if (sim.t > 1) sim.t = 0;
    const slider = document.getElementById('sim-slider');
    if (slider) slider.value = String(Math.round(sim.t * 1000));
  }

  simDisegna(dt);
  sim.raf = requestAnimationFrame(simCiclo);
}

function simAggiornaPulsantePlay() {
  const btn = document.getElementById('sim-btn-play');
  if (btn) btn.textContent = sim.riproduce ? '⏸ Pausa' : '▶ Riproduci';
}

// Apre la simulazione dell'evento indicato
window.apriSimulazione = (id) => {
  const evento = eventiCalcolati.find(e => e.id === id);
  const modale = document.getElementById('modale-simulazione');
  if (!evento || !modale) return;

  sim.evento = evento;
  sim.osservatore = null;           // rilegge la posizione a ogni apertura
  sim.scena = simCostruisciScena(evento);
  sim.t = 0;
  sim.riproduce = true;
  sim.velocita = 1;
  sim.ultimoTs = 0;
  sim.meteore = [];
  simGeneraStelle(160);

  const titolo = document.getElementById('sim-titolo');
  if (titolo) titolo.textContent = `🎬 ${evento.titolo} — ${evento.dataTesto}`;
  const nota = document.getElementById('sim-nota');
  if (nota) {
    const o = simOsservatore();
    const dove = o.reale ? '' : ' Posizione non ancora rilevata: si usa il centro dell’Italia.';
    nota.textContent = (sim.scena.nota || '') + dove;
  }
  const slider = document.getElementById('sim-slider');
  if (slider) slider.value = '0';
  const btnVel = document.getElementById('sim-btn-velocita');
  if (btnVel) btnVel.textContent = '1×';
  simAggiornaPulsantePlay();

  modale.classList.remove('hidden');
  sim.aperto = true;
  // Il canvas ha dimensioni solo dopo che il modale è visibile
  requestAnimationFrame(() => {
    simRidimensiona();
    if (!sim.raf) sim.raf = requestAnimationFrame(simCiclo);
  });
};

function chiudiSimulazione() {
  const modale = document.getElementById('modale-simulazione');
  if (modale) modale.classList.add('hidden');
  sim.aperto = false;
  if (sim.raf) cancelAnimationFrame(sim.raf);
  sim.raf = null;
  sim.meteore = [];
}

function inizializzaSimulazione() {
  sim.canvas = document.getElementById('sim-canvas');
  const modale = document.getElementById('modale-simulazione');
  if (!sim.canvas || !modale) return;

  const btnChiudi = document.getElementById('btn-chiudi-simulazione');
  if (btnChiudi) btnChiudi.addEventListener('click', chiudiSimulazione);
  modale.addEventListener('click', (e) => { if (e.target === modale) chiudiSimulazione(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sim.aperto) chiudiSimulazione();
  });

  const btnPlay = document.getElementById('sim-btn-play');
  if (btnPlay) btnPlay.addEventListener('click', () => {
    sim.riproduce = !sim.riproduce;
    simAggiornaPulsantePlay();
  });

  const slider = document.getElementById('sim-slider');
  if (slider) slider.addEventListener('input', () => {
    sim.t = simClamp(parseFloat(slider.value) / 1000, 0, 1);
    sim.riproduce = false;          // scorrendo a mano la riproduzione si ferma
    simAggiornaPulsantePlay();
    simDisegna(0);
  });

  const btnVel = document.getElementById('sim-btn-velocita');
  if (btnVel) btnVel.addEventListener('click', () => {
    const i = SIM_VELOCITA.indexOf(sim.velocita);
    sim.velocita = SIM_VELOCITA[(i + 1) % SIM_VELOCITA.length];
    btnVel.textContent = `${sim.velocita}×`;
  });

  window.addEventListener('resize', () => { if (sim.aperto) simRidimensiona(); });

  // Fuori schermo l'animazione si ferma, al ritorno riparte
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (sim.raf) cancelAnimationFrame(sim.raf);
      sim.raf = null;
    } else if (sim.aperto && !sim.raf) {
      sim.ultimoTs = 0;
      sim.raf = requestAnimationFrame(simCiclo);
    }
  });
}
