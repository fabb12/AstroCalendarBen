// Il nostro database locale di eventi calcolati al volo
let eventiCalcolati = [];
let fullCalendarInstance = null;
let contatoreId = 0; // per generare id univoci e "sicuri" (solo lettere+numeri)

// Categorie di eventi: usate dai filtri e dai badge nell'agenda
const CATEGORIE = {
  luna:      { nome: 'Fasi Lunari',      disegno: 'luna' },
  eclissi:   { nome: 'Eclissi',          disegno: 'eclissi' },
  stagioni:  { nome: 'Stagioni',         disegno: 'foglia' },
  meteore:   { nome: 'Sciami Meteorici', disegno: 'meteora' },
  pianeti:   { nome: 'Pianeti',          disegno: 'saturno' },
  congiunzioni: { nome: 'Congiunzioni',  disegno: 'congiunzione' },
  personali: { nome: 'Personali',        disegno: 'segnalino' }
};

// ---------------------------------------------------------------------------
// DISEGNI
// Al posto delle emoji: piccoli SVG fatti "a mano", uno per ogni oggetto.
// Il contorno prende il colore del testo (currentColor), così funziona sia
// sulla carta chiara sia sul cartoncino scuro; i pieni sono pastelli fissi,
// perché Giove deve restare color sabbia in tutti e due i temi.
// ---------------------------------------------------------------------------
const DISEGNI = {
  sole: `<circle cx="12" cy="12" r="5" fill="#f2c14e"/>
    <path d="M12 2.2v2.4M12 19.4v2.4M2.2 12h2.4M19.4 12h2.4M5.1 5.1l1.7 1.7M17.2 17.2l1.7 1.7M18.9 5.1l-1.7 1.7M6.8 17.2l-1.7 1.7"/>`,

  luna: `<path d="M20.5 13.4A8.9 8.9 0 1 1 10.6 3.5a7 7 0 0 0 9.9 9.9z" fill="#ecdfae"/>
    <circle cx="14.5" cy="15" r="1.5" fill="none"/>
    <circle cx="17.4" cy="11.2" r="0.9" fill="none"/>`,

  lunapiena: `<circle cx="12" cy="12" r="8.6" fill="#ecdfae"/>
    <circle cx="9" cy="9.5" r="2" fill="none"/><circle cx="14.8" cy="14.4" r="1.5" fill="none"/>
    <circle cx="15.2" cy="8.6" r="1" fill="none"/>`,

  mercurio: `<circle cx="12" cy="12" r="6.6" fill="#c9c3b4"/>
    <circle cx="10" cy="10.4" r="1.5" fill="none"/><circle cx="14.2" cy="14" r="1.1" fill="none"/>`,

  venere: `<circle cx="12" cy="12" r="7.8" fill="#f0d59a"/>
    <path d="M6 10.4q6-1.8 11.6-.4M5.4 13.6q6.4 1.8 12.6-.6" fill="none"/>`,

  marte: `<circle cx="12" cy="12" r="7.4" fill="#e2725b"/>
    <path d="M8.4 6.4q3.6-1.2 7.2 0" fill="none"/>
    <circle cx="10" cy="12.6" r="1.6" fill="none"/><circle cx="14.6" cy="10.4" r="1" fill="none"/>`,

  giove: `<circle cx="12" cy="12" r="8.4" fill="#dfb98a"/>
    <path d="M5.2 9q6.8-1.4 13.6 0M3.8 12.2q8.2-1.4 16.4 0M5.2 15.4q6.8 1.4 13.6 0" fill="none"/>
    <ellipse cx="14.6" cy="14.4" rx="2.1" ry="1.3" fill="#c9694f"/>`,

  saturno: `<circle cx="12" cy="12" r="6" fill="#e8cf9a"/>
    <ellipse cx="12" cy="12" rx="10.4" ry="3.4" fill="none" transform="rotate(-22 12 12)"/>`,

  urano: `<circle cx="12" cy="12" r="6.4" fill="#a9d8dd"/>
    <ellipse cx="12" cy="12" rx="9.6" ry="3" fill="none" transform="rotate(76 12 12)"/>`,

  nettuno: `<circle cx="12" cy="12" r="7.6" fill="#8fb3e0"/>
    <path d="M5.6 14.2q3.2-2 6.4 0t6-0.6" fill="none"/>
    <ellipse cx="10" cy="9.6" rx="1.9" ry="1.2" fill="#5d84bd"/>`,

  terra: `<circle cx="12" cy="12" r="8" fill="#7fb2e5"/>
    <path d="M6.4 9.6q2.6-2.4 5-0.6t3.6-0.4M7.6 15.4q2.8 1.8 5.4 0.2t3.4 0.6" fill="#7fb069"/>`,

  stella: `<path d="M12 2.8l2.5 6.1 6.6.5-5 4.3 1.6 6.4L12 16.6 6.3 20.1l1.6-6.4-5-4.3 6.6-.5z" fill="#f5e2a0"/>`,

  meteora: `<path d="M16.6 3.4l1.5 3.6 3.9.3-3 2.6.9 3.8-3.3-2.1-3.4 2.1.9-3.8-2.9-2.6 3.9-.3z" fill="#f2c14e"/>
    <path d="M10.4 12.8L3.2 20.4M13.6 15.2l-4.4 4.6M6.6 11.4l-3.2 3.4" fill="none"/>`,

  eclissi: `<circle cx="10.4" cy="12" r="6.6" fill="#f2c14e"/>
    <circle cx="14.6" cy="12" r="6.6" fill="#3d4a6b"/>`,

  foglia: `<path d="M4.4 19.6c-1.6-7 3.4-13.4 15.2-15.2 1.4 11.6-6.2 16.8-15.2 15.2z" fill="#7fb069"/>
    <path d="M4.8 19.2q6.4-5.2 12.8-11.4" fill="none"/>`,

  congiunzione: `<circle cx="8.6" cy="13.4" r="5" fill="#f0d59a"/>
    <circle cx="16.2" cy="10.2" r="3.4" fill="#dfb98a"/>`,

  segnalino: `<path d="M12 21.2s6.2-6.8 6.2-10.8a6.2 6.2 0 1 0-12.4 0c0 4 6.2 10.8 6.2 10.8z" fill="#e2685c"/>
    <circle cx="12" cy="10.2" r="2.2" fill="none"/>`,

  satellite: `<rect x="9.4" y="9.4" width="5.2" height="5.2" rx="1" fill="#c9c3b4"/>
    <rect x="1.8" y="10" width="6" height="4" rx="0.8" fill="#8fb3e0"/>
    <rect x="16.2" y="10" width="6" height="4" rx="0.8" fill="#8fb3e0"/>
    <path d="M12 9.4V6.2M12 6.2l-2 -2M12 6.2l2 -2" fill="none"/>`,

  occhio: `<path d="M2.4 12S6.2 6.2 12 6.2 21.6 12 21.6 12 17.8 17.8 12 17.8 2.4 12 2.4 12z" fill="#f5efdd"/>
    <circle cx="12" cy="12" r="2.8" fill="#3d4a6b"/>`,

  binocolo: `<rect x="4.2" y="5.4" width="5.2" height="8.4" rx="1.4" fill="#c9c3b4"/>
    <rect x="14.6" y="5.4" width="5.2" height="8.4" rx="1.4" fill="#c9c3b4"/>
    <circle cx="6.8" cy="16.6" r="3.6" fill="#8fb3e0"/><circle cx="17.2" cy="16.6" r="3.6" fill="#8fb3e0"/>
    <path d="M9.4 9h5.2" fill="none"/>`,

  telescopio: `<rect x="3.4" y="8.6" width="14" height="4.6" rx="1.4" fill="#c9c3b4" transform="rotate(-24 10.4 10.9)"/>
    <path d="M11.6 14.2L9.4 20.6M11.6 14.2l4.6 5.4M6.6 20.6h6" fill="none"/>
    <circle cx="18.6" cy="6.6" r="1.6" fill="#f5e2a0"/>`,

  fotocamera: `<rect x="2.6" y="7" width="18.8" height="12.4" rx="2" fill="#c9c3b4"/>
    <path d="M8.6 7l1.6-2.4h3.6L15.4 7" fill="none"/>
    <circle cx="12" cy="13.2" r="3.6" fill="#8fb3e0"/>`,

  medaglia: `<path d="M8.4 2.8l3.6 6.4M15.6 2.8L12 9.2" fill="none"/>
    <circle cx="12" cy="15.4" r="5.8" fill="#f2c14e"/>
    <path d="M12 12.4l1 2.2 2.4.2-1.8 1.6.6 2.3-2.2-1.3-2.2 1.3.6-2.3-1.8-1.6 2.4-.2z" fill="none"/>`,

  bersaglio: `<circle cx="12" cy="12" r="8.6" fill="#f5efdd"/>
    <circle cx="12" cy="12" r="5.4" fill="none"/>
    <circle cx="12" cy="12" r="2.2" fill="#e2685c"/>`,

  nebulosa: `<path d="M4.6 13.6c-1.6-5.4 3.4-9.6 8.4-8.6 4.6 1 7 5.6 5.2 9-2 3.8-11.8 4.6-13.6-.4z" fill="#ab9fd8"/>
    <circle cx="9.8" cy="11.4" r="1.4" fill="none"/><circle cx="14.6" cy="13.2" r="1" fill="none"/>`,

  quaderno: `<rect x="4.4" y="3.4" width="15.2" height="17.2" rx="1.6" fill="#f5efdd"/>
    <path d="M8 3.4v17.2M11 8h6M11 12h6M11 16h4" fill="none"/>`
};

// Restituisce il disegno richiesto, pronto da mettere dentro l'HTML
function icona(id, dimensione = 22) {
  const d = DISEGNI[id];
  if (!d) return '';
  return `<svg class="icona-disegnata" width="${dimensione}" height="${dimensione}" viewBox="0 0 24 24"` +
    ` fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"` +
    ` aria-hidden="true">${d}</svg>`;
}

// Pallino colorato: sostituisce il semaforo a emoji (verde/giallo/rosso)
function pallino(colore, dimensione = 12) {
  return `<span class="punto-categoria" style="background:${colore};width:${dimensione}px;height:${dimensione}px"></span>`;
}

// Il disegno della categoria di un evento (o una stellina, se non ce l'ha)
function iconaCategoria(idCategoria, dimensione = 20) {
  const cat = CATEGORIE[idCategoria];
  return icona(cat ? cat.disegno : 'stella', dimensione);
}

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
  caricaDiario();
  inizializzaUI();
  inizializzaFormAggiungi();
  inizializzaMappaEclissiUI();
  inizializzaSimulazione();
  inizializzaSkymap();
  inizializzaNotifiche();
  inizializzaInstallazione();
  inizializzaDiarioUI();
  inizializzaImpostazioni();
  inizializzaStasera();
  // La vista d'apertura è "Stasera": è la domanda che ci si fa davvero
  mostraVista('stasera');
  // Un link condiviso (?evento=…) porta direttamente sulla scheda giusta
  gestisciLinkCondiviso();
});

// Helper: crea un evento con id sicuro e testo data formattato
function creaEvento({ id, titolo, dataObj, spiegazione, colore, programma, manuale, linkMappa, categoria, eclissi, corpoCielo, simul, strumento, congiunzione }) {
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
    simul: simul || null,
    // Strumento minimo con cui l'evento ha senso (occhio, binocolo, telescopio)
    strumento: strumento || null,
    // Dati della congiunzione: quali corpi si incontrano e a che distanza
    congiunzione: congiunzione || null
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
  aggiungiCongiunzioni(oggi, limite);

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
          testo: `Punto di massima eclissi sulla mappa (${coord})`
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

  if (titoloEl) titoloEl.textContent = `Visibilità — ${evento.titolo} (${evento.dataTesto})`;
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
    `<option value="${id}">${CATEGORIE[id].nome}</option>`
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
    if (titoloModale) titoloModale.textContent = 'Nuovo evento';
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
    if (titoloModale) titoloModale.textContent = 'Modifica evento';
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

  // Il pulsante “Modifica” delle schede dell'agenda apre il form in modifica
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
  inizializzaFiltroStrumento();
  costruisciAgenda();
  inizializzaCalendario();
  costruisciDiario();
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
    // Il filtro per strumento è cumulativo: chi ha il binocolo vede anche
    // tutto ciò che si osserva a occhio nudo.
    if (filtroStrumento !== 'tutti') {
      const scelto = STRUMENTI[filtroStrumento];
      const serve = STRUMENTI[strumentoEvento(ev)];
      if (scelto && serve && serve.livello > scelto.livello) return false;
    }
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
    const chips = [{ id: 'tutti', nome: 'Tutti', disegno: 'stella' }]
      .concat(Object.keys(CATEGORIE).map(id => ({ id, ...CATEGORIE[id] })));

    contenitoreChip.innerHTML = chips.map(c =>
      `<button type="button" data-cat="${c.id}" class="chip-categoria">${icona(c.disegno, 17)} ${c.nome}</button>`
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
  const base = 'chip-categoria inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border border-slate-600';
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
    // Badge con la categoria dell'evento: disegno + nome (es. Fasi Lunari)
    const cat = CATEGORIE[evento.categoria];
    const badgeCategoria = cat
      ? `<span class="inline-flex items-center gap-1.5 align-middle text-xs bg-slate-700 text-slate-200 px-2.5 py-1 rounded-full border border-slate-600">${icona(cat.disegno, 16)} ${cat.nome}</span>`
      : '';
    // Gli eventi manuali si possono modificare ed eliminare
    const bottoneModifica = evento.manuale
      ? `<button onclick="apriModificaEvento('${evento.id}')" class="px-3 py-1.5 text-sm bg-slate-700 hover:bg-blue-600 rounded-full flex-shrink-0" title="Modifica evento">Modifica</button>`
      : '';
    const bottoneElimina = evento.manuale
      ? `<button onclick="eliminaEventoManuale('${evento.id}')" class="px-3 py-1.5 text-sm bg-slate-700 hover:bg-red-600 rounded-full flex-shrink-0" title="Elimina evento">Elimina</button>`
      : '';
    // Link alla mappa (es. punto di massima eclissi), se presente
    const linkMappa = evento.linkMappa
      ? `<li><a href="${evento.linkMappa.url}" target="_blank" rel="noopener" class="text-blue-400 underline hover:text-blue-300">${evento.linkMappa.testo}</a></li>`
      : '';
    // Pulsante mappa interattiva di visibilità (solo eclissi solari con fascia centrale)
    const bottoneMappa = evento.eclissi
      ? `<li><button onclick="apriMappaEclissi('${evento.id}')" class="inline-flex items-center gap-1 text-blue-400 underline hover:text-blue-300 bg-transparent border-0 p-0 cursor-pointer">Mostra la mappa di visibilità (linea centrale e area parziale)</button></li>`
      : '';
    // Scorciatoia verso la vista Cielo, puntata sul protagonista dell'evento
    const bottoneCielo = evento.corpoCielo
      ? `<li><button onclick="cercaNelCielo('${evento.corpoCielo}')" class="inline-flex items-center gap-1 text-blue-400 underline hover:text-blue-300 bg-transparent border-0 p-0 cursor-pointer">Trova ${skyNomeCorpo(evento.corpoCielo)} nel cielo adesso</button></li>`
      : '';
    card.innerHTML = `
      <div class="barra-evento" style="background-color: ${evento.colore}"></div>
      <div class="flex justify-between items-start mb-4 pl-4">
        <div>
          <h2 class="text-2xl font-bold text-white">${evento.titolo}${badgeManuale}</h2>
          <p class="text-blue-400 text-sm font-semibold mt-1">${evento.dataTesto}</p>
          <div class="mt-2">${badgeCategoria}${badgeStrumentoHtml(evento)}</div>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <button onclick="apriSimulazione('${evento.id}')" class="px-3 py-1.5 text-sm bg-slate-700 hover:bg-purple-600 rounded-full" title="Guarda cosa succede, passo per passo">Simula</button>
          <button onclick="leggiEvento('${evento.id}', 'tasto')" class="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-full" title="Leggi ad alta voce">Ascolta</button>
          ${bottoneModifica}
          ${bottoneElimina}
        </div>
      </div>

      <div class="space-y-3 text-slate-300 pl-4">
        <p><strong>Cosa succede:</strong> ${evento.spiegazione}</p>
        ${bloccoLocaleHtml(evento)}
        ${bloccoFotoHtml(evento)}
        <div class="bg-slate-900 p-4 rounded-xl mt-4 text-sm border border-slate-700">
          <h3 class="font-bold text-white mb-2">Come prepararsi</h3>
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
      ${barraAzioniHtml(evento)}
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
    // Niente rettangoli pieni: un pallino colorato e il titolo, come su un'agenda di carta
    eventDisplay: 'list-item',
    displayEventTime: false,
    events: eventiPerGriglia(getEventiFiltrati()),
    eventClick: function(info) {
      // Se clicco su un evento nel calendario apro l'agenda sulla sua scheda.
      // La voce NON parte da sola: si attiva solo col tasto “Ascolta” o con la notifica.
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
  { nome: 'stasera',    btn: 'btn-vista-stasera',    vista: 'vista-stasera' },
  { nome: 'calendario', btn: 'btn-vista-calendario', vista: 'vista-calendario' },
  { nome: 'agenda',     btn: 'btn-vista-agenda',     vista: 'vista-agenda' },
  { nome: 'cielo',      btn: 'btn-vista-skymap',     vista: 'vista-skymap' },
  { nome: 'diario',     btn: 'btn-vista-diario',     vista: 'vista-diario' }
];

// Mostra una sola vista alla volta e aggiorna lo stile dei pulsanti
function mostraVista(nome) {
  const attivo = "voce-menu attiva";
  const inattivo = "voce-menu";

  VISTE.forEach(v => {
    const btn = document.getElementById(v.btn);
    const vista = document.getElementById(v.vista);
    const selezionata = v.nome === nome;
    if (vista) vista.classList.toggle('hidden', !selezionata);
    if (btn) btn.className = selezionata ? attivo : inattivo;
  });

  // La ricerca filtra calendario e agenda: altrove non serve
  const ricerca = document.getElementById('barra-ricerca');
  if (ricerca) ricerca.classList.toggle('hidden', nome !== 'calendario' && nome !== 'agenda');

  // Resize necessario per FullCalendar quando torna visibile
  if (nome === 'calendario' && fullCalendarInstance) fullCalendarInstance.updateSize();

  // Il disegno del cielo gira solo quando la sua vista è a schermo;
  // uscendo si spegne anche la fotocamera (batteria e privacy).
  if (nome === 'cielo') {
    apriSkymap();
  } else {
    chiudiSkymap();
    skySpegniFotocamera();
  }

  // Stasera e Diario si ricostruiscono all'apertura: i dati cambiano di continuo
  if (nome === 'stasera') costruisciStasera();
  if (nome === 'diario') costruisciDiario();
  // Se nel frattempo è cambiata la posizione, l'agenda va riscritta
  if (nome === 'agenda' && agendaDaRicostruire) {
    agendaDaRicostruire = false;
    costruisciAgenda();
  }
}

function gestisciTab() {
  VISTE.forEach(v => {
    const btn = document.getElementById(v.btn);
    if (btn) btn.addEventListener('click', () => mostraVista(v.nome));
  });
}

// =====================================================================
// 4. Lettura Vocale (TTS)
//    La voce parte SOLO in due casi: quando si preme il tasto “Ascolta” di una
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
  try {
    const notifica = new Notification(evento.titolo, {
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

// Aggiorna l'aspetto del pulsante “Avvisami” in base al permesso concesso
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
      alert('Per installare l\'app su iPhone/iPad:\n\n1. Tocca il pulsante Condividi in basso\n2. Scegli "Aggiungi a schermata Home"\n3. Conferma con "Aggiungi"');
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
  { id: 'Sun',     nome: 'Sole',     disegno: 'sole',     colore: '#fbbf24', tipo: 'sole' },
  { id: 'Moon',    nome: 'Luna',     disegno: 'luna',     colore: '#e2e8f0', tipo: 'luna' },
  { id: 'Mercury', nome: 'Mercurio', disegno: 'mercurio', colore: '#cbd5e1', tipo: 'pianeta' },
  { id: 'Venus',   nome: 'Venere',   disegno: 'venere',   colore: '#fde68a', tipo: 'pianeta' },
  { id: 'Mars',    nome: 'Marte',    disegno: 'marte',    colore: '#f87171', tipo: 'pianeta' },
  { id: 'Jupiter', nome: 'Giove',    disegno: 'giove',    colore: '#fcd34d', tipo: 'pianeta' },
  { id: 'Saturn',  nome: 'Saturno',  disegno: 'saturno',  colore: '#fcd34d', tipo: 'pianeta' },
  { id: 'Uranus',  nome: 'Urano',    disegno: 'urano',    colore: '#67e8f9', tipo: 'pianeta' },
  { id: 'Neptune', nome: 'Nettuno',  disegno: 'nettuno',  colore: '#93c5fd', tipo: 'pianeta' }
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
    disegno: 'stella',
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
  posizione: null,       // { lat, lon, fonte, precisione, tempo }
  attesaPosizione: null, // richiesta di geolocalizzazione in corso (una sola per volta)
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
  avvisi: {},           // messaggi mostrati sotto al cielo, uno per argomento
  // Macchina del tempo: minuti di scarto rispetto all'ora vera
  offsetTempoMin: 0,
  // Figure delle costellazioni e oggetti del profondo cielo
  mostraCostellazioni: true,
  mostraProfondo: false,
  costellazioni: [],
  profondo: [],
  // Flusso video della fotocamera, quando la realtà aumentata è accesa
  camera: null
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

// --- Normalizzazione delle letture di posizione ---
// Il navigatore non restituisce un punto, restituisce una stima: ogni
// lettura balla di qualche decina di metri e, quando il GPS vero non è
// agganciato, il browser ripiega su wi-fi, celle telefoniche o indirizzo IP,
// che possono sbagliare di chilometri. Accettando ogni lettura così com'è
// il cielo si spostava di scatto e tornava indietro (il "tremolio" del GPS).
// Qui le letture vengono filtrate: cambiamo posizione solo quando la nuova
// lettura porta davvero un'informazione nuova.
const SKY_SPOSTAMENTO_MIN_M = 150;   // sotto questa soglia è rumore, non movimento
const SKY_PRECISIONE_PEGGIORE = 2;   // quanto può essere più larga una lettura per essere creduta
const SKY_FONTI_RIPIEGO = ['salvata', 'backup'];

// Distanza in metri fra due coordinate (emisenoverso: basta e avanza)
function skyDistanzaMetri(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * SKY_D2R;
  const dLon = (lon2 - lon1) * SKY_D2R;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * SKY_D2R) * Math.cos(lat2 * SKY_D2R) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Decide se una nuova lettura deve sostituire quella in uso.
function skyLetturaAttendibile(lat, lon, fonte, precisione, tempo) {
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
  const attuale = sky.posizione;
  if (!attuale) return true;                 // non avevamo niente: va bene tutto
  if (fonte === 'manuale') return true;      // scelta esplicita dell'utente: comanda lei

  // Una posizione di ripiego (ultima salvata, backup) non scalza mai una posizione vera
  if (SKY_FONTI_RIPIEGO.includes(fonte) && !SKY_FONTI_RIPIEGO.includes(attuale.fonte)) return false;

  // Mai tornare indietro nel tempo: le risposte del browser possono arrivare
  // fuori ordine, e una lettura presa dalla cache è più vecchia di quella in uso.
  if (tempo && attuale.tempo && tempo < attuale.tempo) return false;

  const d = skyDistanzaMetri(attuale.lat, attuale.lon, lat, lon);

  // Spostamento sotto la soglia: è il respiro del GPS, non un trasferimento.
  // Ricalcolare tutto il cielo per venti metri non cambia nulla di visibile.
  if (d < SKY_SPOSTAMENTO_MIN_M) return false;

  // Lettura molto più grossolana di quella che abbiamo: la crediamo solo se
  // dice qualcosa di incompatibile con la posizione attuale, cioè se lo
  // spostamento esce dal suo stesso margine d'errore. È questo il caso del
  // fix "di rete" largo chilometri che faceva saltare il cielo.
  if (precisione && attuale.precisione &&
      precisione > attuale.precisione * SKY_PRECISIONE_PEGGIORE && d < precisione) return false;

  return true;
}

// Applica una posizione, se la lettura supera il filtro qui sopra.
// Restituisce true quando la posizione è stata davvero cambiata.
function skyImpostaPosizione(lat, lon, fonte, dettagli) {
  const precisione = dettagli && isFinite(dettagli.precisione) ? dettagli.precisione : null;
  const tempo = dettagli && dettagli.tempo ? dettagli.tempo : null;

  if (!skyLetturaAttendibile(lat, lon, fonte, precisione, tempo)) {
    // Lettura scartata: la posizione resta ferma, ma se è arrivata da un GPS
    // valido teniamo buona la sua precisione e l'ora, così le letture
    // successive vengono confrontate con l'informazione più aggiornata.
    if (sky.posizione && fonte === 'gps') {
      if (precisione && (!sky.posizione.precisione || precisione < sky.posizione.precisione)) {
        sky.posizione.precisione = precisione;
      }
      if (tempo && (!sky.posizione.tempo || tempo > sky.posizione.tempo)) {
        sky.posizione.tempo = tempo;
      }
    }
    skyAvviso('posizione', '');
    skyAggiornaStato();
    return false;
  }

  sky.posizione = { lat, lon, fonte, precisione, tempo };
  if (typeof Astronomy !== 'undefined') {
    sky.observer = new Astronomy.Observer(lat, lon, 0);
  }
  sky.prossimoCalcolo = 0;
  sky.cacheOrari = { chiave: null, valore: null };
  // Cambiando luogo cambiano orari, altezze e giudizi: la memoria va svuotata
  svuotaCacheLocali();
  try {
    localStorage.setItem(CHIAVE_SKY_POSIZIONE, JSON.stringify({ lat, lon, precisione, tempo }));
  } catch (e) { /* storage pieno o non disponibile: pazienza */ }
  skyAvviso('posizione', ''); // la posizione c'è: via l'eventuale avviso
  skyAggiornaStato();
  return true;
}

// Rilegge l'ultima posizione salvata (così l'app funziona subito, anche offline)
function skyCaricaPosizioneSalvata() {
  try {
    const dati = JSON.parse(localStorage.getItem(CHIAVE_SKY_POSIZIONE) || 'null');
    if (dati && typeof dati.lat === 'number' && typeof dati.lon === 'number') {
      // Ci portiamo dietro anche quanto era precisa e quando è stata presa:
      // servono a giudicare le letture nuove senza ripartire da zero.
      skyImpostaPosizione(dati.lat, dati.lon, 'salvata', {
        precisione: dati.precisione,
        tempo: dati.tempo
      });
      return true;
    }
  } catch (e) { /* dato corrotto: lo ignoriamo */ }
  return false;
}

// Una sola lettura per volta: Cielo, Stasera e Impostazioni possono chiedere
// la posizione nello stesso momento, e due richieste in parallelo tornavano
// con fix diversi che si sovrascrivevano a vicenda.
function skyRichiediPosizione() {
  if (sky.attesaPosizione) return sky.attesaPosizione;

  sky.attesaPosizione = new Promise((risolvi) => {
    if (!navigator.geolocation) {
      risolvi(false);
      return;
    }
    let concluso = false;
    const concludi = (esito) => { if (!concluso) { concluso = true; risolvi(esito); } };

    // Finché l'utente non risponde alla richiesta di permesso il browser non
    // richiama nulla (i "timeout" qui sotto partono solo dopo il consenso):
    // dopo 16 secondi smettiamo di aspettare e lo diciamo.
    const attesaMassima = setTimeout(() => concludi(false), 16000);

    const usa = (pos) => {
      clearTimeout(attesaMassima);
      // La posizione viene comunque usata, anche se arriva in ritardo:
      // il filtro qui sopra decide se è meglio di quella che abbiamo già.
      skyImpostaPosizione(pos.coords.latitude, pos.coords.longitude, 'gps', {
        precisione: pos.coords.accuracy,
        tempo: pos.timestamp
      });
      skyAggiornaOggetti(true);
      concludi(true);
    };

    // Prima si chiede il GPS vero e una lettura recente. Se non arriva
    // (al chiuso, o senza antenna) si ripiega su wi-fi/rete, che è meglio
    // di niente: la lettura grossolana passa comunque dal filtro.
    navigator.geolocation.getCurrentPosition(
      usa,
      () => {
        navigator.geolocation.getCurrentPosition(
          usa,
          () => { clearTimeout(attesaMassima); concludi(false); },
          { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }).then((esito) => {
    sky.attesaPosizione = null;
    return esito;
  });

  return sky.attesaPosizione;
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

  // L'ora è quella scelta con il cursore del tempo (normalmente adesso)
  const quando = skyAdesso();
  const t = Astronomy.MakeTime(quando);
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
  skyAggiornaCatalogo(quando);
  skyAggiornaEtichette();
}

// Orari di sorgere e tramonto dell'astro selezionato (ricalcolati ogni mezz'ora)
function skyOrari(id) {
  if (!sky.observer || typeof Astronomy === 'undefined') return null;
  const chiave = `${id}|${Math.floor(skyAdesso().getTime() / 1800000)}`;
  if (sky.cacheOrari.chiave === chiave) return sky.cacheOrari.valore;
  let valore = null;
  try {
    const adesso = skyAdesso();
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

  // Con la fotocamera accesa il canvas resta trasparente: sotto si vede
  // il mondo vero e sopra ci finiscono solo gli astri calcolati.
  const conCamera = !!sky.camera;
  if (conCamera) {
    ctx.clearRect(0, 0, L, H);
  } else {
    const sfondo = ctx.createLinearGradient(0, 0, 0, H);
    sfondo.addColorStop(0, '#020617');
    sfondo.addColorStop(1, '#0f172a');
    ctx.fillStyle = sfondo;
    ctx.fillRect(0, 0, L, H);
  }

  const base = skyBase();
  const focale = skyFocale();

  skyDisegnaGriglia(ctx, base, focale);
  if (!conCamera) skyDisegnaTerreno(ctx, base, focale);
  skyDisegnaCardinali(ctx, base, focale);
  skyDisegnaCostellazioni(ctx, base, focale);
  skyDisegnaProfondo(ctx, base, focale);

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
    righe.push(`${formattaCoordinate(sky.posizione.lat, sky.posizione.lon)}`);
  } else {
    righe.push('posizione mancante');
  }
  if (sky.sensori) {
    righe.push(sky.assoluto ? 'bussola attiva' : 'bussola da calibrare');
  } else {
    righe.push('modalità manuale');
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
    `<button type="button" data-astro="${a.id}" class="chip-astro">${icona(a.disegno, 17)} ${a.nome} <span class="sky-alt text-slate-400"></span></button>`
  ).join('');
  cont.querySelectorAll('.chip-astro').forEach(btn => {
    btn.addEventListener('click', () => skyImpostaTarget(btn.dataset.astro));
  });
  cont.dataset.pronto = 'si';
  skyAggiornaStileElenco();
}

function skyAggiornaStileElenco() {
  const base = 'chip-astro inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border border-slate-600';
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
    ? '<p class="mt-2 text-amber-400">Attenzione: non guardare mai il Sole direttamente, né a occhio nudo né con binocolo o telescopio.</p>'
    : '';

  box.innerHTML = `
    <h3 class="font-bold text-white text-base mb-2 flex items-center gap-2">${icona(o.disegno, 22)} ${o.nome}</h3>
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
  if (!sky.observer) skyAvviso('posizione', 'Sto cercando la tua posizione…');
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

  // Costellazioni, profondo cielo, macchina del tempo e fotocamera
  inizializzaSkymapExtra();

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
    skyAvviso('posizione', 'Sto cercando la tua posizione…');
    const ok = await skyRichiediPosizione();
    skyAvviso('posizione', ok ? '' : 'Non riesco a leggere la posizione: controlla i permessi di localizzazione del browser.');
    skyAggiornaOggetti(true);
  });

  collega('skymap-btn-notte', () => {
    const cont = document.getElementById('skymap-contenitore');
    const btn = document.getElementById('skymap-btn-notte');
    if (!cont) return;
    const attiva = cont.classList.toggle('modalita-notte');
    if (btn) btn.textContent = attiva ? 'Colori normali' : 'Modalità notte';
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
      nota: 'La scena mostra l’eclissi come si vede dal punto migliore. Attenzione: nella realtà il Sole va guardato solo con filtri certificati.' };
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
      return `<p>Dalla tua posizione (${dove}) ${nome} è <strong>sopra l’orizzonte</strong>, ` +
             `a ${hor.altitude.toFixed(0)}° di altezza: l’evento è visibile.</p>`;
    }
    return `<p>Dalla tua posizione (${dove}) ${nome} è <strong>sotto l’orizzonte</strong> ` +
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
      ? `<p>Scena vista dal punto di massima eclissi (${formattaCoordinate(sim.scena.dati.lat, sim.scena.dati.lon)}). Altrove il Sole viene coperto meno.</p>`
      : '<p>Eclissi parziale ovunque: non esiste un punto di totalità sulla Terra.</p>'
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
    `<p>${Math.abs(giorni) < 0.5 ? 'Siamo nell’istante dell’evento.' :
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
  if (disturboSole > 0) righe.push('<p>C’è ancora luce crepuscolare: le meteore deboli restano invisibili.</p>');
  if (luna && luna.alt > 0 && (luna.frazione || 0) > 0.25) {
    righe.push(`<p>${icona('luna', 16)} La Luna è alta ${luna.alt.toFixed(0)}° e illuminata al ${((luna.frazione || 0) * 100).toFixed(0)}%: il suo chiarore riduce il conteggio.</p>`);
  } else if (radiante.alt > 0) {
    righe.push('<p>Niente disturbo lunare: condizioni buone, se il cielo è scuro.</p>');
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
    `<p>${Math.abs(giorni) < 0.5 ? 'Siamo nel giorno della massima elongazione.' :
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
  if (altSole > 0) condizione = `È giorno: il Sole è a ${altSole.toFixed(0)}° sull’orizzonte.`;
  else if (altSole > -6) condizione = 'Crepuscolo civile: si vedono solo gli astri più luminosi.';
  else if (altSole > -18) condizione = 'Crepuscolo astronomico: il cielo si sta facendo scuro.';
  else condizione = 'Notte piena: cielo completamente buio.';

  return [
    `<p><strong>${simOraTesto(tempo)}</strong> — vista da ${o.lat.toFixed(1)}°, ${o.lon.toFixed(1)}°${o.reale ? '' : ' (posizione predefinita)'}</p>`,
    `<p>${condizione}</p>`,
    luna && luna.alt > 0
      ? `<p>${icona('luna', 16)} La Luna è alta ${luna.alt.toFixed(0)}°, illuminata al ${((luna.frazione || 0) * 100).toFixed(0)}%.</p>`
      : `<p>${icona('luna', 16)} La Luna è sotto l’orizzonte.</p>`,
    pianeti.length
      ? `<p>${icona('saturno', 16)} Pianeti visibili a occhio nudo: <strong>${pianeti.join(', ')}</strong>.</p>`
      : `<p>${icona('saturno', 16)} Nessun pianeta visibile a occhio nudo in questo momento.</p>`
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
  if (btn) btn.textContent = sim.riproduce ? 'Pausa' : 'Riproduci';
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
  if (titolo) titolo.textContent = `${evento.titolo} — ${evento.dataTesto}`;
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

// =====================================================================
// 9. CONGIUNZIONI E OCCULTAZIONI
//    Gli eventi più belli da guardare a occhio nudo sono due astri che
//    si sfiorano. Li troviamo scandendo giorno per giorno la distanza
//    angolare fra ogni coppia e cercando i minimi: quando il minimo è
//    stretto abbastanza, nasce un evento del calendario.
// =====================================================================

// Corpi messi a confronto fra loro (la Luna è la protagonista più frequente)
const CONG_CORPI = [
  { id: 'Moon',    nome: 'Luna',     disegno: 'luna' },
  { id: 'Mercury', nome: 'Mercurio', disegno: 'mercurio' },
  { id: 'Venus',   nome: 'Venere',   disegno: 'venere' },
  { id: 'Mars',    nome: 'Marte',    disegno: 'marte' },
  { id: 'Jupiter', nome: 'Giove',    disegno: 'giove' },
  { id: 'Saturn',  nome: 'Saturno',  disegno: 'saturno' }
];

// Quanto lontano nel tempo cercare le congiunzioni: la scansione è giornaliera
// e la libreria calcola tutto nel browser, quindi teniamo un orizzonte umano.
const CONG_ANNI = 3;

// Soglie di "vicinanza": la Luna si muove molto e passa spesso vicino ai
// pianeti, quindi le chiediamo un incontro più stretto per fare notizia.
const CONG_SOGLIA_LUNA = 4;      // gradi
const CONG_SOGLIA_PIANETI = 3;   // gradi

// Sotto questa elongazione dal Sole l'incontro è immerso nella luce del giorno
const CONG_ELONGAZIONE_MINIMA = 15;

// Setaccio largo della scansione giornaliera: ogni avvicinamento sotto questo
// valore viene raffinato, e solo dopo si applica la soglia vera.
const CONG_SETACCIO = 15;

// Separazione angolare geocentrica (in gradi) fra due corpi a un dato istante
function congSeparazione(idA, idB, t) {
  const a = Astronomy.GeoVector(idA, t, true);
  const b = Astronomy.GeoVector(idB, t, true);
  return Astronomy.AngleBetween(a, b);
}

// Distanza angolare dal Sole: sotto una certa soglia l'evento non si vede
function congElongazioneSolare(id, t) {
  try {
    const sole = Astronomy.GeoVector('Sun', t, true);
    const corpo = Astronomy.GeoVector(id, t, true);
    return Astronomy.AngleBetween(sole, corpo);
  } catch (e) {
    return 180;
  }
}

function aggiungiCongiunzioni(oggi, limite) {
  if (typeof Astronomy === 'undefined' || typeof Astronomy.AngleBetween !== 'function') return;
  try {
    const fine = new Date(Math.min(
      limite.getTime(),
      oggi.getTime() + CONG_ANNI * 365.25 * 86400000
    ));
    const giorni = Math.ceil((fine - oggi) / 86400000);
    if (giorni < 3) return;

    // Coppie da controllare: Luna con ogni pianeta, e i pianeti fra loro
    const coppie = [];
    for (let i = 0; i < CONG_CORPI.length; i++) {
      for (let j = i + 1; j < CONG_CORPI.length; j++) {
        coppie.push({
          a: CONG_CORPI[i],
          b: CONG_CORPI[j],
          soglia: (CONG_CORPI[i].id === 'Moon' || CONG_CORPI[j].id === 'Moon')
            ? CONG_SOGLIA_LUNA : CONG_SOGLIA_PIANETI
        });
      }
    }

    // Un solo passaggio giornaliero: calcoliamo i vettori una volta per giorno
    // e da quelli tutte le separazioni, così il costo resta contenuto.
    const serie = coppie.map(() => []);
    const tempi = [];
    for (let g = 0; g <= giorni; g++) {
      const data = new Date(oggi.getTime() + g * 86400000);
      const t = Astronomy.MakeTime(data);
      tempi.push(t);
      const vettori = {};
      CONG_CORPI.forEach(c => {
        try { vettori[c.id] = Astronomy.GeoVector(c.id, t, true); } catch (e) { vettori[c.id] = null; }
      });
      coppie.forEach((coppia, k) => {
        const va = vettori[coppia.a.id], vb = vettori[coppia.b.id];
        serie[k].push(va && vb ? Astronomy.AngleBetween(va, vb) : 999);
      });
    }

    coppie.forEach((coppia, k) => {
      const sep = serie[k];
      for (let g = 1; g < sep.length - 1; g++) {
        // Cerchiamo ogni avvicinamento, non solo quelli già stretti al momento
        // del campione: la Luna percorre 13° al giorno, quindi fra un giorno e
        // l'altro può entrare e uscire dalla congiunzione senza farsi vedere.
        if (!(sep[g] < sep[g - 1] && sep[g] <= sep[g + 1] && sep[g] < CONG_SETACCIO)) continue;

        // Raffinamento in due passate: prima ogni 2 ore nel giorno prima e
        // dopo, poi ogni 5 minuti attorno al minimo trovato.
        let centro = tempi[g].date.getTime();
        let migliore = sep[g], miglioreMs = centro;
        const scandisci = (raggioMin, passoMin, partenza) => {
          for (let m = -raggioMin; m <= raggioMin; m += passoMin) {
            const ms = partenza + m * 60000;
            let s;
            try { s = congSeparazione(coppia.a.id, coppia.b.id, Astronomy.MakeTime(new Date(ms))); } catch (e) { continue; }
            if (s < migliore) { migliore = s; miglioreMs = ms; }
          }
        };
        scandisci(1440, 120, centro);
        scandisci(120, 5, miglioreMs);

        // Solo adesso, conosciuta la distanza minima vera, decidiamo se è un evento
        if (migliore >= coppia.soglia) continue;

        const miglioreT = Astronomy.MakeTime(new Date(miglioreMs));
        const quando = miglioreT.date;
        if (quando < oggi || quando > fine) continue;

        // Se la coppia è troppo vicina al Sole non c'è nulla da osservare
        const elong = congElongazioneSolare(coppia.b.id === 'Moon' ? coppia.a.id : coppia.b.id, miglioreT);
        if (elong < CONG_ELONGAZIONE_MINIMA) continue;

        const conLuna = coppia.a.id === 'Moon' || coppia.b.id === 'Moon';
        const gradi = migliore;
        const testoDistanza = gradi < 1
          ? `${Math.round(gradi * 60)} primi d'arco (meno di un grado: entrano insieme nel campo di un binocolo)`
          : `${gradi.toFixed(1)}°`;

        // Sotto il mezzo grado la Luna può addirittura coprire il pianeta:
        // la copertura vera dipende dal luogo, quindi lo diciamo come possibilità.
        const occultazione = conLuna && gradi < 0.5;
        const titolo = occultazione
          ? `Occultazione: ${coppia.a.nome} nasconde ${coppia.b.nome}`
          : `Congiunzione ${coppia.a.nome}–${coppia.b.nome}`;

        const spiegazione = occultazione
          ? `${coppia.a.nome} e ${coppia.b.nome} arrivano a ${testoDistanza} l'uno dall'altro: da alcune zone della Terra ` +
            `la Luna passa davanti al pianeta e lo nasconde per qualche decina di minuti. Da altre zone si vede comunque ` +
            `un avvicinamento spettacolare. Controlla gli orari locali qui sotto.`
          : `${coppia.a.nome} e ${coppia.b.nome} si avvicinano fino a ${testoDistanza}. ` +
            `Non si toccano davvero — restano lontanissimi fra loro — ma dalla Terra appaiono quasi sovrapposti: ` +
            `è uno degli spettacoli più facili da riconoscere anche in città.`;

        creaEvento({
          titolo,
          dataObj: quando,
          spiegazione,
          colore: occultazione ? '#f472b6' : '#8b5cf6',
          categoria: 'congiunzioni',
          // Nel cielo si punta il corpo più facile da trovare
          corpoCielo: conLuna ? 'Moon' : coppia.b.id,
          strumento: 'occhio',
          congiunzione: {
            a: coppia.a.id, b: coppia.b.id,
            nomeA: coppia.a.nome, nomeB: coppia.b.nome,
            separazione: gradi
          },
          simul: { scena: 'cielo' },
          programma: {
            cosaPortare: 'Nulla di obbligatorio: si vede a occhio nudo. Un binocolo li mostra insieme nello stesso campo, e con il telefono si fanno belle foto.',
            doveVederlo: `Serve un orizzonte libero nella direzione giusta: guarda la scheda “da qui” qui sotto per sapere dove e a che ora sono visibili dal tuo luogo.`,
            comeVederlo: 'Cerca i due punti luminosi molto vicini: quello che non “tremola” è il pianeta, le stelle invece scintillano.'
          }
        });
      }
    });
  } catch (err) {
    console.error('Errore congiunzioni:', err);
  }
}

// =====================================================================
// 10. LA TUA POSIZIONE, USATA DA TUTTA L'APP
//     Fino a ieri le coordinate servivano solo alla vista Cielo. Ora un
//     evento senza contesto locale ("Luna Piena alle 04:12") diventa
//     "sorge alle 21:03 a sud-est, alta 34° a mezzanotte".
// =====================================================================

const RAGGIO_TERRA_KM_LUOGO = 6378.137;

// Restituisce { lat, lon } se conosciamo il luogo dell'utente, altrimenti null.
// Non inventiamo mai una posizione di comodo senza dirlo.
function luogoCorrente() {
  if (typeof sky !== 'undefined' && sky.posizione && typeof sky.posizione.lat === 'number') {
    return { lat: sky.posizione.lat, lon: sky.posizione.lon };
  }
  try {
    const dati = JSON.parse(localStorage.getItem(CHIAVE_SKY_POSIZIONE) || 'null');
    if (dati && typeof dati.lat === 'number' && typeof dati.lon === 'number') {
      return { lat: dati.lat, lon: dati.lon };
    }
  } catch (e) { /* dato corrotto */ }
  return null;
}

function osservatoreCorrente() {
  const l = luogoCorrente();
  if (!l || typeof Astronomy === 'undefined') return null;
  try {
    return new Astronomy.Observer(l.lat, l.lon, 0);
  } catch (e) {
    return null;
  }
}

// Altezza e azimut di un corpo del Sistema Solare a un dato istante
function altAzCorpo(id, data, obs) {
  const t = Astronomy.MakeTime(data);
  const equ = Astronomy.Equator(id, t, obs, true, true);
  const hor = Astronomy.Horizon(t, obs, equ.ra, equ.dec, 'normal');
  return { alt: hor.altitude, az: hor.azimuth };
}

// Altezza e azimut di un punto fisso del cielo (radianti degli sciami,
// oggetti del profondo cielo). Le coordinate sono J2000: la differenza con
// quelle di oggi è di frazioni di grado, invisibile a occhio nudo.
function altAzCoordinate(raOre, decGradi, data, obs) {
  const t = Astronomy.MakeTime(data);
  const hor = Astronomy.Horizon(t, obs, raOre, decGradi, 'normal');
  return { alt: hor.altitude, az: hor.azimuth };
}

function altezzaSole(data, obs) {
  try { return altAzCorpo('Sun', data, obs).alt; } catch (e) { return null; }
}

// Ogni ricerca di alba, tramonto e crepuscolo è una ricerca numerica: senza
// memoria l'agenda le rifarebbe a ogni ridisegno, per ogni scheda. Teniamo
// quindi i risultati per notte e per luogo.
const cacheBuio = new Map();

function chiaveLuogo() {
  const l = luogoCorrente();
  return l ? `${l.lat.toFixed(2)},${l.lon.toFixed(2)}` : 'nessuno';
}

// Finestra di buio della notte che comincia nel giorno indicato:
// tramonto, buio astronomico (Sole a −18°), fine del buio e alba.
function finestraBuio(dataRiferimento) {
  const obs = osservatoreCorrente();
  if (!obs || typeof Astronomy === 'undefined') return null;

  // "Stanotte" è la notte che sta per arrivare; ma se sono le tre del mattino
  // la notte giusta è quella cominciata ieri sera, non la prossima.
  const partenza = new Date(dataRiferimento);
  if (partenza.getHours() < 6) partenza.setDate(partenza.getDate() - 1);
  partenza.setHours(12, 0, 0, 0);

  const chiave = `${chiaveLuogo()}|${partenza.toDateString()}`;
  if (cacheBuio.has(chiave)) return cacheBuio.get(chiave);

  try {
    const tramonto = Astronomy.SearchRiseSet('Sun', obs, -1, partenza, 2);
    const alba = tramonto ? Astronomy.SearchRiseSet('Sun', obs, 1, tramonto.date, 2) : null;
    // Alle alte latitudini d'estate il Sole non scende mai a −18°: la ricerca
    // restituisce null ed è un'informazione vera da mostrare, non un errore.
    const buioInizio = Astronomy.SearchAltitude('Sun', obs, -1, partenza, 2, -18);
    const buioFine = buioInizio ? Astronomy.SearchAltitude('Sun', obs, 1, buioInizio.date, 2, -18) : null;
    const nauticoInizio = Astronomy.SearchAltitude('Sun', obs, -1, partenza, 2, -12);

    const risultato = {
      tramonto: tramonto ? tramonto.date : null,
      alba: alba ? alba.date : null,
      buioInizio: buioInizio ? buioInizio.date : null,
      buioFine: buioFine ? buioFine.date : null,
      nautico: nauticoInizio ? nauticoInizio.date : null
    };
    cacheBuio.set(chiave, risultato);
    return risultato;
  } catch (e) {
    cacheBuio.set(chiave, null);
    return null;
  }
}

// Cerca il momento migliore della notte per un corpo: quando è più alto
// mentre il Sole è già sotto l'orizzonte.
function momentoMigliore(id, buio, obs, raDec) {
  if (!buio || !buio.tramonto) return null;
  const inizio = buio.tramonto.getTime();
  const fine = (buio.alba || new Date(inizio + 10 * 3600000)).getTime();
  if (fine <= inizio) return null;

  // Cerchiamo due cose insieme: il momento più alto in assoluto e il momento
  // più alto a cielo già scuro. Il secondo è quasi sempre quello giusto, ma
  // per Mercurio e Venere — che tramontano nel crepuscolo — non esiste, e
  // allora vale il primo.
  let assoluto = null, alBuio = null;
  const passo = Math.max(10 * 60000, (fine - inizio) / 48);
  for (let ms = inizio; ms <= fine; ms += passo) {
    const data = new Date(ms);
    let pos;
    try {
      pos = raDec ? altAzCoordinate(raDec.ra, raDec.dec, data, obs) : altAzCorpo(id, data, obs);
    } catch (e) { continue; }
    const voce = { alt: pos.alt, az: pos.az, quando: data };
    if (!assoluto || pos.alt > assoluto.alt) assoluto = voce;

    const altSole = altezzaSole(data, obs);
    if (altSole !== null && altSole < -6 && (!alBuio || pos.alt > alBuio.alt)) alBuio = voce;
  }
  return (alBuio && alBuio.alt > 5) ? alBuio : assoluto;
}

// Orari di sorgere e tramonto attorno a una data
function orariSorgereTramonto(id, data, obs) {
  try {
    const partenza = new Date(data.getTime() - 12 * 3600000);
    const sorge = Astronomy.SearchRiseSet(id, obs, 1, partenza, 2);
    const tramonta = Astronomy.SearchRiseSet(id, obs, -1, partenza, 2);
    return {
      sorge: sorge ? sorge.date : null,
      tramonta: tramonta ? tramonta.date : null
    };
  } catch (e) {
    return { sorge: null, tramonta: null };
  }
}

// Oltre questo orizzonte non calcoliamo le circostanze locali: in agenda ci
// sono centinaia di eventi (le eclissi arrivano al 2070) e ognuno costerebbe
// più ricerche numeriche. Per gli eventi lontani basta la data.
const GIORNI_CIRCOSTANZE = 120;

// Le circostanze cambiano lentamente: ricalcolarle più di una volta ogni
// mezz'ora non aggiunge nulla e rallenta il ridisegno dell'agenda.
const cacheCircostanze = new Map();

// Cambiando luogo le schede dell'agenda dicono cose diverse: le ricostruiamo
// alla prima occasione utile, non subito (l'agenda può avere centinaia di voci).
let agendaDaRicostruire = false;

function svuotaCacheLocali() {
  cacheBuio.clear();
  cacheCircostanze.clear();
  agendaDaRicostruire = true;
  eventiCalcolati.forEach(e => { delete e.localeCache; });
}

// "Da qui si vede?" — altezza, direzione, orari e giudizio per un evento.
// Restituisce null se manca la posizione o se l'evento è troppo lontano.
function circostanzeLocali(evento) {
  const obs = osservatoreCorrente();
  if (!obs || typeof Astronomy === 'undefined') return null;

  const giorni = (evento.dataObj.getTime() - Date.now()) / 86400000;
  if (giorni < -1 || giorni > GIORNI_CIRCOSTANZE) return null;

  const chiave = `${evento.id}|${chiaveLuogo()}|${Math.floor(Date.now() / 1800000)}`;
  if (cacheCircostanze.has(chiave)) return cacheCircostanze.get(chiave);

  // Corpo protagonista, oppure radiante per gli sciami meteorici
  const radiante = (evento.simul && evento.simul.scena === 'sciame' &&
                    typeof evento.simul.ra === 'number')
    ? { ra: evento.simul.ra, dec: evento.simul.dec } : null;
  const corpo = evento.corpoCielo;
  if (!corpo && !radiante) return null;

  let pos;
  try {
    pos = radiante
      ? altAzCoordinate(radiante.ra, radiante.dec, evento.dataObj, obs)
      : altAzCorpo(corpo, evento.dataObj, obs);
  } catch (e) {
    return null;
  }

  const altSole = altezzaSole(evento.dataObj, obs);
  const orari = corpo ? orariSorgereTramonto(corpo, evento.dataObj, obs) : { sorge: null, tramonta: null };

  // Il momento migliore della notte conta soprattutto per gli sciami e per
  // gli eventi il cui istante di picco cade quando l'astro è sotto l'orizzonte:
  // negli altri casi è una scansione costosa e inutile.
  const buio = finestraBuio(evento.dataObj);
  const eventoDiGiorno = corpo !== 'Sun' && altSole !== null && altSole > -6;
  const meglio = (pos.alt < 10 || radiante || eventoDiGiorno)
    ? momentoMigliore(corpo, buio, obs, radiante) : null;

  const eventoSolare = corpo === 'Sun';
  let giudizio, livello;
  if (pos.alt < 0) {
    giudizio = meglio && meglio.alt > 5
      ? `Al momento del picco è sotto l'orizzonte da qui, ma nella stessa notte arriva a ${Math.round(meglio.alt)}° verso le ${oraBreve(meglio.quando)}.`
      : 'Non visibile da qui: nell\'istante dell\'evento l\'astro si trova sotto l\'orizzonte.';
    livello = meglio && meglio.alt > 5 ? 'parziale' : 'no';
  } else if (!eventoSolare && altSole !== null && altSole > -6) {
    giudizio = `All'ora esatta dell'evento il cielo è ancora chiaro (Sole a ${Math.round(altSole)}°)` +
      (meglio && meglio.alt > 5
        ? `: guardalo verso le ${oraBreve(meglio.quando)}, quando è alto ${Math.round(meglio.alt)}° verso ${skyNomeDirezione(meglio.az)}.`
        : '. Cerca l\'astro nelle ore di buio più vicine.');
    livello = 'parziale';
  } else if (pos.alt < 10) {
    giudizio = `Visibile ma bassa sull'orizzonte (${Math.round(pos.alt)}°): serve una vista libera verso ${skyNomeDirezione(pos.az)}.`;
    livello = 'parziale';
  } else {
    giudizio = `Ben visibile da qui: ${Math.round(pos.alt)}° sopra l'orizzonte, verso ${skyNomeDirezione(pos.az)}.`;
    livello = 'si';
  }

  const risultato = {
    alt: pos.alt,
    az: pos.az,
    direzione: skyNomeDirezione(pos.az),
    altSole,
    sorge: orari.sorge,
    tramonta: orari.tramonta,
    migliore: meglio,
    buio,
    livello,
    giudizio
  };
  cacheCircostanze.set(chiave, risultato);
  return risultato;
}

function oraBreve(data) {
  return data ? data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—';
}

function dataOraBreve(data) {
  return data ? data.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

// =====================================================================
// 11. METEO E INDICE DI OSSERVABILITÀ
//     Il motivo più comune per cui un'osservazione salta sono le nuvole.
//     I dati vengono da Open-Meteo (gratuito, senza chiave): li teniamo
//     un'ora in memoria e li salviamo, così valgono anche senza rete.
// =====================================================================

const CHIAVE_METEO = 'astrocalendario_meteo';
const METEO_VALIDITA_MS = 60 * 60 * 1000;   // un'ora
const METEO_GIORNI = 7;

let meteo = null;          // { lat, lon, quando, ore: [{ ms, nuvole, temp, umidita, vento }] }
let meteoInCorso = null;   // promessa condivisa: una sola richiesta alla volta

function meteoDaCache() {
  try {
    const salvato = JSON.parse(localStorage.getItem(CHIAVE_METEO) || 'null');
    if (salvato && Array.isArray(salvato.ore)) return salvato;
  } catch (e) { /* dato corrotto */ }
  return null;
}

function meteoAncoraValido(dati, luogo) {
  if (!dati || !luogo) return false;
  if (Date.now() - dati.quando > METEO_VALIDITA_MS) return false;
  // Se ci si sposta di più di ~25 km le nuvole possono essere altre
  return Math.abs(dati.lat - luogo.lat) < 0.25 && Math.abs(dati.lon - luogo.lon) < 0.25;
}

async function caricaMeteo(forza) {
  const luogo = luogoCorrente();
  if (!luogo) return null;

  if (!forza) {
    if (meteoAncoraValido(meteo, luogo)) return meteo;
    const salvato = meteoDaCache();
    if (meteoAncoraValido(salvato, luogo)) { meteo = salvato; return meteo; }
  }
  if (meteoInCorso) return meteoInCorso;

  const url = 'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${luogo.lat.toFixed(4)}&longitude=${luogo.lon.toFixed(4)}` +
    '&hourly=cloud_cover,temperature_2m,relative_humidity_2m,wind_speed_10m' +
    `&forecast_days=${METEO_GIORNI}&timezone=auto`;

  meteoInCorso = fetch(url)
    .then(r => {
      if (!r.ok) throw new Error('risposta non valida');
      return r.json();
    })
    .then(dati => {
      const h = dati.hourly || {};
      const ore = (h.time || []).map((t, i) => ({
        // Open-Meteo con timezone=auto restituisce l'ora locale senza fuso:
        // interpretata dal browser come ora locale, che è esattamente ciò che serve.
        ms: new Date(t).getTime(),
        nuvole: h.cloud_cover ? h.cloud_cover[i] : null,
        temp: h.temperature_2m ? h.temperature_2m[i] : null,
        umidita: h.relative_humidity_2m ? h.relative_humidity_2m[i] : null,
        vento: h.wind_speed_10m ? h.wind_speed_10m[i] : null
      })).filter(o => !isNaN(o.ms));

      meteo = { lat: luogo.lat, lon: luogo.lon, quando: Date.now(), ore };
      try { localStorage.setItem(CHIAVE_METEO, JSON.stringify(meteo)); } catch (e) { /* storage pieno */ }
      return meteo;
    })
    .catch(() => {
      // Senza rete teniamo l'ultima previsione scaricata, dicendo quanto è vecchia
      const salvato = meteoDaCache();
      if (salvato) meteo = salvato;
      return meteo;
    })
    .finally(() => { meteoInCorso = null; });

  return meteoInCorso;
}

// Previsione per l'ora più vicina a una data (null se fuori dalle previsioni)
function meteoPerData(data) {
  if (!meteo || !meteo.ore.length || !data) return null;
  const ms = data.getTime();
  let migliore = null, distanza = Infinity;
  meteo.ore.forEach(o => {
    const d = Math.abs(o.ms - ms);
    if (d < distanza) { distanza = d; migliore = o; }
  });
  // Oltre 90 minuti di scarto vuol dire che l'evento è fuori dalla previsione
  return distanza <= 90 * 60000 ? migliore : null;
}

function descriviNuvole(perc) {
  if (perc === null || perc === undefined) return 'previsione non disponibile';
  if (perc <= 15) return 'cielo sereno';
  if (perc <= 40) return 'poco nuvoloso';
  if (perc <= 70) return 'nuvoloso a tratti';
  if (perc <= 90) return 'molto nuvoloso';
  return 'coperto';
}

// Punteggio 0–100 di quanto conviene uscire per un evento, con i motivi.
// Mette insieme quello che conta davvero: nuvole, altezza sull'orizzonte,
// luce del Sole e disturbo della Luna.
function indiceOsservabilita(evento) {
  const obs = osservatoreCorrente();
  if (!obs) return null;
  const giorni = (evento.dataObj.getTime() - Date.now()) / 86400000;
  if (giorni < -0.5 || giorni > METEO_GIORNI) return null;

  const motivi = [];
  let punteggio = 100;

  const locale = evento.localeCache !== undefined ? evento.localeCache : circostanzeLocali(evento);
  const solare = evento.corpoCielo === 'Sun';

  // Il giudizio si dà sul momento in cui conviene davvero guardare: se al
  // picco l'astro è sotto l'orizzonte ma più tardi si alza, è quell'ora che
  // conta — altrimenti puniremmo due volte lo stesso problema.
  let quando = evento.dataObj;
  let altezza = locale ? locale.alt : null;

  if (locale) {
    const diGiorno = !solare && locale.altSole !== null && locale.altSole > -6;
    const spostabile = (locale.alt < 5 || diGiorno) && locale.migliore && locale.migliore.alt > 5;
    if (spostabile) {
      quando = locale.migliore.quando;
      altezza = locale.migliore.alt;
      punteggio -= 10;
      motivi.push(`non al momento del picco, ma verso le ${oraBreve(quando)}`);
    } else if (locale.alt < 0) {
      return { punteggio: 0, semaforo: pallino('#e2685c'), motivi: ['non visibile da qui: sotto l\'orizzonte'], nuvole: null, quando: null };
    }

    if (altezza !== null && altezza < 15) {
      punteggio -= 20;
      motivi.push(`basso sull'orizzonte (${Math.round(altezza)}°)`);
    }

    const altSole = altezzaSole(quando, obs);
    if (!solare && altSole !== null && altSole > -6) {
      punteggio -= 40;
      motivi.push('cielo ancora chiaro a quell\'ora');
    }
  }

  const previsione = meteoPerData(quando);
  if (previsione && previsione.nuvole !== null) {
    punteggio -= Math.round(previsione.nuvole * 0.65);
    motivi.push(`${descriviNuvole(previsione.nuvole)} (${Math.round(previsione.nuvole)}% di nuvole)`);
  } else {
    motivi.push('previsione meteo non disponibile');
  }

  // La Luna piena cancella meteore e oggetti deboli, ma per le eclissi
  // lunari e le fasi è lei la protagonista: nessuna penalità.
  if (evento.categoria === 'meteore') {
    try {
      const ill = Astronomy.Illumination('Moon', Astronomy.MakeTime(quando));
      const posLuna = altAzCorpo('Moon', quando, obs);
      if (posLuna.alt > 0 && ill.phase_fraction > 0.5) {
        punteggio -= Math.round(ill.phase_fraction * 30);
        motivi.push(`Luna illuminata al ${Math.round(ill.phase_fraction * 100)}% e alta nel cielo: schiarisce lo sfondo`);
      }
    } catch (e) { /* niente dati lunari */ }
  }

  punteggio = Math.max(0, Math.min(100, punteggio));
  const semaforo = pallino(punteggio >= 70 ? '#7fb069' : punteggio >= 40 ? '#eab54a' : '#e2685c');
  return {
    punteggio, semaforo, motivi,
    nuvole: previsione ? previsione.nuvole : null,
    // Ora consigliata per uscire: la mostriamo nella scheda dell'evento
    quando: quando === evento.dataObj ? null : quando
  };
}

// =====================================================================
// 12. STRUMENTO NECESSARIO
//     Un filtro onesto: niente frustrazione per eventi che senza
//     telescopio non si vedono comunque.
// =====================================================================

const STRUMENTI = {
  occhio:     { nome: 'A occhio nudo',  disegno: 'occhio',     livello: 0 },
  binocolo:   { nome: 'Con binocolo',   disegno: 'binocolo',   livello: 1 },
  telescopio: { nome: 'Con telescopio', disegno: 'telescopio', livello: 2 }
};

let filtroStrumento = 'tutti';

// Strumento con cui l'evento dà il meglio di sé. Non è "il minimo per
// accorgersene", ma quello che serve per vedere davvero la cosa interessante:
// una Luna Piena si guarda a occhio nudo, i crateli del Primo Quarto no.
function strumentoEvento(evento) {
  if (evento.strumento && STRUMENTI[evento.strumento]) return evento.strumento;

  switch (evento.categoria) {
    case 'meteore':
    case 'stagioni':
    case 'eclissi':
      return 'occhio';

    case 'luna': {
      // 0 = Nuova, 1 = Primo Quarto, 2 = Piena, 3 = Ultimo Quarto
      const fase = evento.simul ? evento.simul.fase : null;
      if (fase === 0) return 'telescopio';   // cielo buio: è la notte del profondo cielo
      if (fase === 2) return 'occhio';       // la Luna Piena è lo spettacolo stesso
      return 'binocolo';                     // quarti: crateri lungo il terminatore
    }

    case 'congiunzioni':
      // Sotto il grado i due astri stanno nello stesso campo del binocolo,
      // ed è lì che la scena diventa davvero bella.
      return (evento.congiunzione && evento.congiunzione.separazione < 1) ? 'binocolo' : 'occhio';

    case 'pianeti':
      // Urano e Nettuno restano puntini anche col binocolo; per la fase di
      // Mercurio e Venere all'elongazione serve almeno un binocolo saldo.
      return (evento.corpoCielo === 'Uranus' || evento.corpoCielo === 'Neptune') ? 'telescopio' : 'binocolo';

    default:
      return 'occhio';
  }
}

// =====================================================================
// 13. PASSAGGI DELLA STAZIONE SPAZIALE INTERNAZIONALE
//     È l'evento più frequente e più facile: si vede a occhio nudo, anche
//     dal centro città. I dati orbitali (TLE) arrivano da Celestrak e la
//     propagazione SGP4 la fa satellite.js, tutto dentro al browser.
//     Un passaggio si vede solo se: la ISS è alta sull'orizzonte, è
//     illuminata dal Sole e chi guarda è già al buio.
// =====================================================================

const CHIAVE_TLE = 'astrocalendario_tle_iss';
const TLE_VALIDITA_MS = 12 * 60 * 60 * 1000;
const URL_TLE_ISS = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';

// Quanti giorni avanti cercare i passaggi e con che passo temporale
const ISS_GIORNI = 5;
const ISS_PASSO_S = 30;
const ISS_ELEVAZIONE_MINIMA = 10;   // gradi: sotto è nascosta da case e alberi

let issPassaggi = null;
let issInCorso = null;

function tleDaCache() {
  try {
    const dati = JSON.parse(localStorage.getItem(CHIAVE_TLE) || 'null');
    if (dati && dati.riga1 && dati.riga2) return dati;
  } catch (e) { /* dato corrotto */ }
  return null;
}

async function caricaTleIss(forza) {
  const salvato = tleDaCache();
  if (!forza && salvato && Date.now() - salvato.quando < TLE_VALIDITA_MS) return salvato;

  try {
    const risposta = await fetch(URL_TLE_ISS);
    if (!risposta.ok) throw new Error('risposta non valida');
    const testo = await risposta.text();
    const righe = testo.trim().split('\n').map(r => r.trim()).filter(Boolean);
    const riga1 = righe.find(r => r.startsWith('1 '));
    const riga2 = righe.find(r => r.startsWith('2 '));
    if (!riga1 || !riga2) throw new Error('formato TLE inatteso');
    const dati = { riga1, riga2, quando: Date.now() };
    try { localStorage.setItem(CHIAVE_TLE, JSON.stringify(dati)); } catch (e) { /* storage pieno */ }
    return dati;
  } catch (e) {
    // Un TLE vecchio di qualche giorno sbaglia di poco: meglio di niente,
    // e lo diciamo nell'interfaccia.
    return salvato;
  }
}

// Versore che punta al Sole, in coordinate equatoriali (usato per capire
// se la ISS è illuminata o dentro il cono d'ombra della Terra)
function versoreSole(data) {
  const v = Astronomy.GeoVector('Sun', Astronomy.MakeTime(data), false);
  const n = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return [v.x / n, v.y / n, v.z / n];
}

// Il satellite è illuminato se sta dalla parte del Sole oppure se, pur
// stando dietro alla Terra, passa fuori dal cilindro d'ombra.
function satelliteIlluminato(posKm, data) {
  try {
    const s = versoreSole(data);
    const proiezione = posKm.x * s[0] + posKm.y * s[1] + posKm.z * s[2];
    if (proiezione > 0) return true;
    const modulo2 = posKm.x * posKm.x + posKm.y * posKm.y + posKm.z * posKm.z;
    const perpendicolare = Math.sqrt(Math.max(0, modulo2 - proiezione * proiezione));
    return perpendicolare > 6378.137;
  } catch (e) {
    return true;
  }
}

// Cerca i passaggi visibili nei prossimi giorni. Restituisce una lista di
// oggetti con inizio, culmine, fine, altezza massima e direzioni.
function calcolaPassaggiIss(tle, luogo) {
  if (typeof satellite === 'undefined' || !tle || !luogo) return [];

  const rec = satellite.twoline2satrec(tle.riga1, tle.riga2);
  const osservatoreGd = {
    longitude: luogo.lon * Math.PI / 180,
    latitude: luogo.lat * Math.PI / 180,
    height: 0.1
  };
  const obs = osservatoreCorrente();

  const passaggi = [];
  let corrente = null;
  const inizio = Date.now();
  const passi = Math.floor(ISS_GIORNI * 86400 / ISS_PASSO_S);

  for (let i = 0; i < passi; i++) {
    const data = new Date(inizio + i * ISS_PASSO_S * 1000);
    let pv;
    try { pv = satellite.propagate(rec, data); } catch (e) { continue; }
    if (!pv || !pv.position) continue;

    const gmst = satellite.gstime(data);
    const ecf = satellite.eciToEcf(pv.position, gmst);
    const look = satellite.ecfToLookAngles(osservatoreGd, ecf);
    const elevazione = look.elevation * 180 / Math.PI;

    if (elevazione >= ISS_ELEVAZIONE_MINIMA) {
      const voce = {
        data,
        elevazione,
        azimut: ((look.azimuth * 180 / Math.PI) % 360 + 360) % 360,
        distanza: look.rangeSat,
        posizione: pv.position
      };
      if (!corrente) corrente = { punti: [voce] };
      else corrente.punti.push(voce);
    } else if (corrente) {
      passaggi.push(corrente);
      corrente = null;
    }
  }
  if (corrente) passaggi.push(corrente);

  return passaggi.map(p => {
    const punti = p.punti;
    const culmine = punti.reduce((a, b) => (b.elevazione > a.elevazione ? b : a), punti[0]);
    const primo = punti[0], ultimo = punti[punti.length - 1];

    // Visibile a occhio nudo solo se la ISS è al sole e chi guarda è al buio
    const illuminata = satelliteIlluminato(culmine.posizione, culmine.data);
    const altSole = obs ? altezzaSole(culmine.data, obs) : null;
    const osservatoreAlBuio = altSole === null ? true : altSole < -6;

    return {
      inizio: primo.data,
      fine: ultimo.data,
      culmine: culmine.data,
      elevazioneMax: culmine.elevazione,
      azInizio: primo.azimut,
      azFine: ultimo.azimut,
      distanzaMin: Math.round(culmine.distanza),
      durataMin: Math.max(1, Math.round((ultimo.data - primo.data) / 60000)),
      visibile: illuminata && osservatoreAlBuio,
      illuminata,
      alBuio: osservatoreAlBuio
    };
  });
}

async function aggiornaPassaggiIss(forza) {
  const box = document.getElementById('stasera-iss');
  const luogo = luogoCorrente();

  if (!luogo) {
    if (box) box.innerHTML = '<p class="text-slate-400">Serve la tua posizione: la ISS passa sopra un punto preciso della Terra. Premi “Dove sono” qui sopra.</p>';
    return;
  }
  if (typeof satellite === 'undefined') {
    if (box) box.innerHTML = '<p class="text-amber-400">Libreria orbitale non caricata: riapri l\'app quando c\'è rete, poi funzionerà anche offline.</p>';
    return;
  }
  if (issInCorso) return issInCorso;
  if (box) box.innerHTML = '<p class="text-slate-400">Calcolo dei passaggi in corso…</p>';

  issInCorso = (async () => {
    const tle = await caricaTleIss(forza);
    if (!tle) {
      if (box) box.innerHTML = '<p class="text-amber-400">Non riesco a scaricare i dati orbitali della ISS (serve la rete almeno una volta).</p>';
      return;
    }
    try {
      issPassaggi = calcolaPassaggiIss(tle, luogo);
    } catch (e) {
      console.error('Errore passaggi ISS:', e);
      issPassaggi = [];
    }
    mostraPassaggiIss(tle);
  })().finally(() => { issInCorso = null; });

  return issInCorso;
}

function mostraPassaggiIss(tle) {
  const box = document.getElementById('stasera-iss');
  if (!box) return;

  const visibili = (issPassaggi || []).filter(p => p.visibile).slice(0, 5);
  const eta = tle ? Math.round((Date.now() - tle.quando) / 3600000) : null;
  const notaEta = eta !== null && eta > 24
    ? `<p class="text-xs text-amber-400 mt-2">Dati orbitali vecchi di ${Math.round(eta / 24)} giorni: gli orari possono spostarsi di qualche minuto.</p>`
    : '';

  if (!visibili.length) {
    box.innerHTML = '<p class="text-slate-400">Nessun passaggio visibile a occhio nudo nei prossimi giorni: capita, la ISS passa spesso di giorno o nell\'ombra della Terra.</p>' + notaEta;
    return;
  }

  box.innerHTML = visibili.map(p => {
    const qualita = p.elevazioneMax > 60 ? 'spettacolare, quasi allo zenit'
                  : p.elevazioneMax > 40 ? 'molto buono, alta nel cielo'
                  : 'discreto, resta bassa';
    return `
      <div class="bg-slate-900 p-3 rounded-xl border border-slate-700">
        <div class="flex justify-between items-baseline gap-2 flex-wrap">
          <span class="font-bold text-white inline-flex items-center gap-2">${icona('satellite', 18)} ${dataOraBreve(p.inizio)}</span>
          <span class="text-xs text-slate-400">${p.durataMin} min · fino a ${Math.round(p.elevazioneMax)}° · ${p.distanzaMin} km</span>
        </div>
        <p class="text-sm text-slate-300 mt-1">
          Compare verso <strong>${skyNomeDirezione(p.azInizio)}</strong>, culmina alle
          <strong>${oraBreve(p.culmine)}</strong> e sparisce verso <strong>${skyNomeDirezione(p.azFine)}</strong>.
        </p>
        <p class="text-xs text-slate-500 mt-1">Passaggio ${qualita}. Sembra un aereo senza lampeggianti, silenzioso e velocissimo.</p>
      </div>`;
  }).join('') + notaEta;
}

// =====================================================================
// 14. VISTA "STASERA" — cosa vedo stanotte, da qui, e si vedrà?
//     È la risposta alla domanda che ci si fa davvero guardando fuori
//     dalla finestra: mette insieme buio, Luna, pianeti, meteo e ISS.
// =====================================================================

// Pianeti che vale la pena cercare stanotte (Urano e Nettuno restano fuori:
// senza telescopio non si distinguono da una stella qualsiasi)
const STASERA_CORPI = [
  { id: 'Moon',    nome: 'Luna',     disegno: 'luna' },
  { id: 'Mercury', nome: 'Mercurio', disegno: 'mercurio' },
  { id: 'Venus',   nome: 'Venere',   disegno: 'venere' },
  { id: 'Mars',    nome: 'Marte',    disegno: 'marte' },
  { id: 'Jupiter', nome: 'Giove',    disegno: 'giove' },
  { id: 'Saturn',  nome: 'Saturno',  disegno: 'saturno' }
];

function schedaRiepilogo(titolo, valore, dettaglio) {
  return `
    <div class="bg-slate-900 p-4 rounded-xl border border-slate-700">
      <p class="text-xs text-slate-400 uppercase tracking-wide">${titolo}</p>
      <p class="text-lg font-bold text-white mt-1">${valore}</p>
      <p class="text-xs text-slate-400 mt-1">${dettaglio}</p>
    </div>`;
}

// Nome della fase lunare a partire dalla longitudine eclittica relativa
function nomeFaseLunare(angolo) {
  if (angolo < 22.5 || angolo >= 337.5) return 'Luna Nuova';
  if (angolo < 67.5) return 'Luna crescente';
  if (angolo < 112.5) return 'Primo Quarto';
  if (angolo < 157.5) return 'Gibbosa crescente';
  if (angolo < 202.5) return 'Luna Piena';
  if (angolo < 247.5) return 'Gibbosa calante';
  if (angolo < 292.5) return 'Ultimo Quarto';
  return 'Luna calante';
}

function costruisciStaseraRiepilogo() {
  const box = document.getElementById('stasera-riepilogo');
  if (!box) return;

  const luogo = luogoCorrente();
  if (!luogo) {
    box.innerHTML = `
      <div class="md:col-span-3 bg-slate-900 p-4 rounded-xl border border-amber-800">
        <p class="text-amber-400 font-semibold">Manca la tua posizione</p>
        <p class="text-sm text-slate-300 mt-1">Senza coordinate non posso dirti a che ora fa buio, cosa sorge e cosa tramonta. Premi “Dove sono” qui sopra: resta salvata solo su questo dispositivo.</p>
      </div>`;
    return;
  }

  const obs = osservatoreCorrente();
  const buio = finestraBuio(new Date());
  const schede = [];

  // 1. Buio astronomico
  if (buio && buio.tramonto) {
    const finestra = buio.buioInizio && buio.buioFine
      ? `${oraBreve(buio.buioInizio)} → ${oraBreve(buio.buioFine)}`
      : 'niente buio completo stanotte';
    const dettaglio = buio.buioInizio
      ? `Tramonto ${oraBreve(buio.tramonto)} · alba ${oraBreve(buio.alba)}`
      : `Il Sole non scende mai a −18°: crepuscolo per tutta la notte. Tramonto ${oraBreve(buio.tramonto)}.`;
    schede.push(schedaRiepilogo('Buio astronomico', finestra, dettaglio));
  } else {
    schede.push(schedaRiepilogo('Buio astronomico', 'non calcolabile', 'Alle tue latitudini il Sole potrebbe non tramontare affatto.'));
  }

  // 2. Luna: quanto disturba e quando
  try {
    const t = Astronomy.MakeTime(new Date());
    const ill = Astronomy.Illumination('Moon', t);
    const fase = Astronomy.MoonPhase(t);
    const orari = orariSorgereTramonto('Moon', new Date(), obs);
    const perc = Math.round(ill.phase_fraction * 100);
    const disturbo = perc > 70 ? 'cielo molto schiarito: meglio Luna e pianeti che oggetti deboli'
                   : perc > 30 ? 'disturbo moderato per gli oggetti deboli'
                   : 'cielo scuro: ottimo per meteore e profondo cielo';
    schede.push(schedaRiepilogo(
      `${nomeFaseLunare(fase)}`,
      `illuminata al ${perc}%`,
      `Sorge ${oraBreve(orari.sorge)} · tramonta ${oraBreve(orari.tramonta)}. ${disturbo}.`
    ));
  } catch (e) {
    schede.push(schedaRiepilogo('Luna', 'dati non disponibili', ''));
  }

  // 3. Prossimo evento del calendario
  const prossimo = eventiCalcolati.filter(e => e.dataObj > new Date())
    .sort((a, b) => a.dataObj - b.dataObj)[0];
  if (prossimo) {
    const fra = Math.round((prossimo.dataObj - Date.now()) / 3600000);
    const quando = fra < 48 ? `fra ${fra} ore` : `fra ${Math.round(fra / 24)} giorni`;
    schede.push(schedaRiepilogo('Prossimo evento', prossimo.titolo, `${quando} · ${prossimo.dataTesto}`));
  }

  box.innerHTML = schede.join('');
}

async function costruisciStaseraMeteo() {
  const box = document.getElementById('stasera-meteo');
  if (!box) return;
  if (!luogoCorrente()) { box.innerHTML = ''; return; }

  box.innerHTML = '<p class="text-sm text-slate-400">Carico le previsioni…</p>';
  await caricaMeteo(false);
  if (!meteo || !meteo.ore.length) {
    box.innerHTML = '<p class="text-sm text-amber-400">Previsioni non disponibili (serve la rete). Il resto dei dati è calcolato in locale e resta valido.</p>';
    return;
  }

  // Nuvolosità ora per ora nella finestra utile della notte
  const buio = finestraBuio(new Date());
  const partenza = buio && buio.tramonto ? buio.tramonto.getTime() : Date.now();
  const arrivo = buio && buio.alba ? buio.alba.getTime() : partenza + 10 * 3600000;

  const ore = meteo.ore.filter(o => o.ms >= partenza - 3600000 && o.ms <= arrivo + 3600000);
  if (!ore.length) {
    box.innerHTML = '<p class="text-sm text-slate-400">Nessuna previsione per le ore di questa notte.</p>';
    return;
  }

  const media = Math.round(ore.reduce((s, o) => s + (o.nuvole || 0), 0) / ore.length);
  const migliore = ore.reduce((a, b) => ((b.nuvole ?? 100) < (a.nuvole ?? 100) ? b : a), ore[0]);
  const semaforo = pallino(media <= 25 ? '#7fb069' : media <= 60 ? '#eab54a' : '#e2685c');
  const vecchio = Math.round((Date.now() - meteo.quando) / 60000);
  const notaVecchio = vecchio > 90 ? ` · previsione di ${vecchio > 1440 ? Math.round(vecchio / 1440) + ' giorni' : Math.round(vecchio / 60) + ' ore'} fa` : '';

  const barre = ore.map(o => {
    const n = o.nuvole ?? 0;
    const colore = n <= 25 ? '#22c55e' : n <= 60 ? '#eab308' : '#64748b';
    const ora = new Date(o.ms).getHours();
    return `<div class="flex flex-col items-center gap-1" title="${ora}:00 · ${descriviNuvole(n)} (${Math.round(n)}%)">
      <div class="w-3 rounded-sm" style="height:${Math.max(3, Math.round(n * 0.4))}px; background:${colore}"></div>
      <span class="text-[10px] text-slate-500">${ora}</span>
    </div>`;
  }).join('');

  box.innerHTML = `
    <div class="bg-slate-900 p-4 rounded-xl border border-slate-700">
      <div class="flex justify-between items-baseline flex-wrap gap-2">
        <p class="font-bold text-white">${semaforo} Nuvole stanotte: ${descriviNuvole(media)} (${media}% in media)</p>
        <p class="text-xs text-slate-400">Ora migliore: ${oraBreve(new Date(migliore.ms))} con ${Math.round(migliore.nuvole ?? 0)}%${notaVecchio}</p>
      </div>
      <div class="flex items-end gap-1 mt-3 overflow-x-auto pb-1">${barre}</div>
      <p class="text-xs text-slate-500 mt-2">Altezza della barra = copertura nuvolosa prevista, ora per ora (dati Open-Meteo).</p>
    </div>`;

  // Le previsioni appena arrivate cambiano i semafori: vanno riscritti sia
  // l'elenco dei prossimi eventi sia le schede dell'agenda.
  costruisciStaseraProssimi();
  aggiornaSemaforiAgenda();
}

function costruisciStaseraPianeti() {
  const box = document.getElementById('stasera-pianeti');
  if (!box) return;

  const obs = osservatoreCorrente();
  if (!obs) { box.innerHTML = '<p class="text-slate-400">Serve la posizione per sapere cosa hai sopra la testa.</p>'; return; }

  const buio = finestraBuio(new Date());
  const righe = STASERA_CORPI.map(c => {
    let migliore = null, orari = null, mag = null, fase = null;
    try {
      migliore = momentoMigliore(c.id, buio, obs, null);
      orari = orariSorgereTramonto(c.id, new Date(), obs);
      const ill = Astronomy.Illumination(c.id, Astronomy.MakeTime(new Date()));
      mag = ill.mag;
      fase = ill.phase_fraction;
    } catch (e) { /* corpo non calcolabile */ }

    if (!migliore) return null;
    const visibile = migliore.alt > 5;
    return { c, migliore, orari, mag, fase, visibile };
  }).filter(Boolean).sort((a, b) => b.migliore.alt - a.migliore.alt);

  const visibili = righe.filter(r => r.visibile);
  const nascosti = righe.filter(r => !r.visibile);

  const html = visibili.map(r => `
    <div class="flex items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-700">
      <div class="min-w-0">
        <p class="font-bold text-white flex items-center gap-2">${icona(r.c.disegno, 24)} ${r.c.nome}
          <span class="text-xs font-normal text-slate-400">${r.mag !== null ? `mag ${r.mag.toFixed(1)}` : ''}</span>
        </p>
        <p class="text-xs text-slate-400 mt-0.5">
          Più alto alle <strong class="text-slate-200">${oraBreve(r.migliore.quando)}</strong>
          a ${Math.round(r.migliore.alt)}° verso ${skyNomeDirezione(r.migliore.az)}
          ${r.orari && r.orari.tramonta ? ` · tramonta ${oraBreve(r.orari.tramonta)}` : ''}
        </p>
      </div>
      <button onclick="cercaNelCielo('${r.c.id}')" class="text-xs px-3 py-1.5 rounded-full bg-slate-700 hover:bg-blue-600 text-white font-semibold flex-shrink-0" title="Trovalo nel cielo">Trova</button>
    </div>`).join('');

  const htmlNascosti = nascosti.length
    ? `<p class="text-xs text-slate-500 mt-1">Stanotte non si vedono (troppo bassi o dietro il Sole): ${nascosti.map(r => r.c.nome).join(', ')}.</p>`
    : '';

  box.innerHTML = (html || '<p class="text-slate-400">Nessun pianeta sopra l\'orizzonte durante le ore di buio.</p>') + htmlNascosti;
}

function costruisciStaseraProssimi() {
  const box = document.getElementById('stasera-prossimi');
  if (!box) return;

  const adesso = Date.now();
  const limite = adesso + 30 * 86400000;
  const prossimi = eventiCalcolati
    .filter(e => e.dataObj.getTime() >= adesso - 6 * 3600000 && e.dataObj.getTime() <= limite)
    .sort((a, b) => a.dataObj - b.dataObj)
    .slice(0, 8);

  if (!prossimi.length) {
    box.innerHTML = '<p class="text-slate-400">Nessun evento nei prossimi 30 giorni.</p>';
    return;
  }

  box.innerHTML = prossimi.map(ev => {
    const indice = indiceOsservabilita(ev);
    const cat = CATEGORIE[ev.categoria];
    const semaforo = indice ? `${indice.semaforo} ${indice.punteggio}/100` : '';
    const motivo = indice && indice.motivi.length ? indice.motivi[0] : '';
    return `
      <button onclick="vaiAllEvento('${ev.id}')" class="text-left bg-slate-900 p-3 rounded-xl border border-slate-700 hover:border-blue-500 transition-colors w-full">
        <div class="flex justify-between items-baseline gap-2 flex-wrap">
          <span class="font-bold text-white inline-flex items-center gap-2">${iconaCategoria(ev.categoria, 18)} ${ev.titolo}</span>
          <span class="text-xs text-slate-400">${semaforo}</span>
        </div>
        <p class="text-xs text-slate-400 mt-1">${ev.dataTesto}${motivo ? ` · ${motivo}` : ''}</p>
      </button>`;
  }).join('');
}

// Ricostruisce tutta la vista Stasera (la parte meteo e ISS arriva dopo)
function costruisciStasera() {
  costruisciStaseraRiepilogo();
  costruisciStaseraPianeti();
  costruisciStaseraProssimi();
  costruisciStaseraMeteo();
  aggiornaPassaggiIss(false);
}

function inizializzaStasera() {
  const btnPos = document.getElementById('btn-stasera-posizione');
  if (btnPos) {
    btnPos.addEventListener('click', async () => {
      btnPos.textContent = 'Cerco…';
      const ok = await skyRichiediPosizione();
      btnPos.textContent = 'Dove sono';
      if (!ok && !luogoCorrente()) {
        alert('Non riesco a leggere la posizione. Controlla i permessi del browser, oppure inseriscila a mano dalle Impostazioni.');
      }
      await caricaMeteo(true);
      costruisciStasera();
      aggiornaViste();
    });
  }

  const btnIss = document.getElementById('btn-iss-aggiorna');
  if (btnIss) btnIss.addEventListener('click', () => aggiornaPassaggiIss(true));
}

// =====================================================================
// 15. DIARIO DI OSSERVAZIONE E TRAGUARDI
//     Un calendario dice cosa succede; un diario dice cosa hai visto tu.
//     Ogni voce salva anche titolo e data dell'evento, così resta leggibile
//     anche quando quell'evento è ormai passato e non viene più calcolato.
// =====================================================================

const CHIAVE_DIARIO = 'astrocalendario_diario';

let diario = {};
let diarioEventoCorrente = null;
let diarioStelleScelte = 0;

function caricaDiario() {
  try {
    const dati = JSON.parse(localStorage.getItem(CHIAVE_DIARIO) || '{}');
    diario = (dati && typeof dati === 'object') ? dati : {};
  } catch (e) {
    diario = {};
  }
}

function salvaDiario() {
  try {
    localStorage.setItem(CHIAVE_DIARIO, JSON.stringify(diario));
  } catch (e) {
    console.error('Errore salvataggio diario:', e);
  }
}

function vociDiario() {
  return Object.keys(diario)
    .map(id => Object.assign({ id }, diario[id]))
    .sort((a, b) => new Date(b.dataEvento || b.quando) - new Date(a.dataEvento || a.quando));
}

// Traguardi: si sbloccano da soli guardando il cielo, non premendo tasti
const TRAGUARDI = [
  { id: 'primo', nome: 'Prima luce', disegno: 'stella', desc: 'La tua prima osservazione registrata',
    ok: v => v.length >= 1 },
  { id: 'cinque', nome: 'Osservatore assiduo', disegno: 'binocolo', desc: 'Cinque osservazioni nel diario',
    ok: v => v.length >= 5 },
  { id: 'venti', nome: 'Veterano del cielo', disegno: 'medaglia', desc: 'Venti osservazioni nel diario',
    ok: v => v.length >= 20 },
  { id: 'eclissi', nome: 'Cacciatore di eclissi', disegno: 'eclissi', desc: 'Hai visto un\'eclissi',
    ok: v => v.some(x => x.categoria === 'eclissi') },
  { id: 'meteore', nome: 'Desiderio espresso', disegno: 'meteora', desc: 'Hai visto uno sciame meteorico',
    ok: v => v.some(x => x.categoria === 'meteore') },
  { id: 'fasi', nome: 'Ciclo completo', disegno: 'lunapiena', desc: 'Tutte e quattro le fasi lunari',
    ok: v => ['Luna Nuova', 'Primo Quarto', 'Luna Piena', 'Ultimo Quarto']
      .every(f => v.some(x => (x.titolo || '').includes(f))) },
  { id: 'pianeti', nome: 'Giro dei pianeti', disegno: 'saturno', desc: 'Tre osservazioni di pianeti',
    ok: v => v.filter(x => x.categoria === 'pianeti' || x.categoria === 'congiunzioni').length >= 3 },
  { id: 'categorie', nome: 'Collezionista', disegno: 'bersaglio', desc: 'Almeno un evento per quattro categorie diverse',
    ok: v => new Set(v.map(x => x.categoria).filter(Boolean)).size >= 4 },
  { id: 'telescopio', nome: 'Occhio potenziato', disegno: 'telescopio', desc: 'Un\'osservazione fatta col telescopio',
    ok: v => v.some(x => x.strumento === 'telescopio') },
  { id: 'notturno', nome: 'Nottambulo', disegno: 'luna', desc: 'Un\'osservazione registrata fra l\'una e le cinque del mattino',
    ok: v => v.some(x => { const d = new Date(x.dataEvento || x.quando); return d.getHours() >= 1 && d.getHours() < 5; }) }
];

function traguardiRaggiunti() {
  const voci = vociDiario();
  return TRAGUARDI.map(t => Object.assign({}, t, { fatto: t.ok(voci) }));
}

// Apre il modale per registrare (o modificare) un'osservazione
window.apriDiarioEvento = (id) => {
  const evento = eventiCalcolati.find(e => e.id === id);
  const modale = document.getElementById('modale-diario');
  if (!modale) return;

  diarioEventoCorrente = id;
  const voce = diario[id] || {};
  diarioStelleScelte = voce.stelle || 0;

  const titolo = document.getElementById('diario-evento-titolo');
  if (titolo) titolo.textContent = evento ? `${evento.titolo} · ${evento.dataTesto}` : (voce.titolo || 'Osservazione');

  const nota = document.getElementById('diario-nota');
  if (nota) nota.value = voce.nota || '';
  const strumento = document.getElementById('diario-strumento-usato');
  if (strumento) strumento.value = voce.strumento || 'occhio';

  disegnaStelleDiario();
  modale.classList.remove('hidden');
};

function disegnaStelleDiario() {
  const box = document.getElementById('diario-stelle');
  if (!box) return;
  box.innerHTML = [1, 2, 3, 4, 5].map(n =>
    `<button type="button" data-stella="${n}" class="senza-cornice leading-none transition-transform hover:scale-110" title="${n} su 5">${n <= diarioStelleScelte ? '★' : '☆'}</button>`
  ).join('');
  box.querySelectorAll('button').forEach(b => {
    b.style.color = '#facc15';
    b.addEventListener('click', () => {
      diarioStelleScelte = parseInt(b.dataset.stella, 10);
      disegnaStelleDiario();
    });
  });
}

function inizializzaDiarioUI() {
  const modale = document.getElementById('modale-diario');
  const form = document.getElementById('form-diario');
  const chiudi = () => { if (modale) modale.classList.add('hidden'); diarioEventoCorrente = null; };

  const btnChiudi = document.getElementById('btn-chiudi-diario');
  if (btnChiudi) btnChiudi.addEventListener('click', chiudi);
  if (modale) modale.addEventListener('click', (e) => { if (e.target === modale) chiudi(); });

  const btnRimuovi = document.getElementById('btn-diario-rimuovi');
  if (btnRimuovi) btnRimuovi.addEventListener('click', () => {
    if (diarioEventoCorrente && diario[diarioEventoCorrente]) {
      delete diario[diarioEventoCorrente];
      salvaDiario();
      costruisciAgenda();
      costruisciDiario();
    }
    chiudi();
  });

  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!diarioEventoCorrente) return chiudi();

    const evento = eventiCalcolati.find(x => x.id === diarioEventoCorrente);
    const precedente = diario[diarioEventoCorrente] || {};
    diario[diarioEventoCorrente] = {
      visto: true,
      quando: precedente.quando || new Date().toISOString(),
      // Titolo, data e categoria vengono congelati qui: il diario deve
      // restare leggibile anche quando l'evento esce dal calendario.
      titolo: evento ? evento.titolo : precedente.titolo,
      dataEvento: evento ? evento.dataObj.toISOString() : precedente.dataEvento,
      categoria: evento ? evento.categoria : precedente.categoria,
      nota: document.getElementById('diario-nota').value.trim(),
      stelle: diarioStelleScelte,
      strumento: document.getElementById('diario-strumento-usato').value
    };
    salvaDiario();
    costruisciAgenda();
    costruisciDiario();
    chiudi();
  });
}

function costruisciDiario() {
  const statistiche = document.getElementById('diario-statistiche');
  const elencoBadge = document.getElementById('diario-badge');
  const elenco = document.getElementById('diario-elenco');
  const voci = vociDiario();

  if (statistiche) {
    const categorie = new Set(voci.map(v => v.categoria).filter(Boolean)).size;
    const media = voci.filter(v => v.stelle).length
      ? (voci.reduce((s, v) => s + (v.stelle || 0), 0) / voci.filter(v => v.stelle).length).toFixed(1)
      : '—';
    statistiche.innerHTML = [
      schedaRiepilogo('Osservazioni', String(voci.length), voci.length ? `L'ultima: ${dataOraBreve(new Date(voci[0].dataEvento || voci[0].quando))}` : 'Il diario è ancora vuoto'),
      schedaRiepilogo('Categorie esplorate', `${categorie} su ${Object.keys(CATEGORIE).length}`, 'Fasi lunari, eclissi, meteore, pianeti…'),
      schedaRiepilogo('Voto medio', String(media), 'Quanto ti sono piaciute le serate')
    ].join('');
  }

  if (elencoBadge) {
    elencoBadge.innerHTML = traguardiRaggiunti().map(t => `
      <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border border-slate-600 ${t.fatto ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-500 opacity-60'}" title="${t.desc}">
        ${icona(t.disegno, 18)} ${t.nome}
      </span>`).join('');
  }

  if (elenco) {
    if (!voci.length) {
      elenco.innerHTML = '<p class="text-slate-400">Nessuna osservazione registrata. Nell\'agenda, sotto ogni evento, trovi il pulsante “Visto!”.</p>';
      return;
    }
    elenco.innerHTML = voci.map(v => {
      const cat = CATEGORIE[v.categoria];
      const stelle = v.stelle ? '★'.repeat(v.stelle) + '☆'.repeat(5 - v.stelle) : '';
      const strumento = STRUMENTI[v.strumento] ? `${icona(STRUMENTI[v.strumento].disegno, 15)} ${STRUMENTI[v.strumento].nome}` :
                        (v.strumento === 'foto' ? `${icona('fotocamera', 15)} Con la fotocamera` : '');
      return `
        <article class="bg-slate-900 p-4 rounded-xl border border-slate-700">
          <div class="flex justify-between items-start gap-3">
            <div class="min-w-0">
              <h4 class="font-bold text-white flex items-center gap-2">${iconaCategoria(v.categoria, 18)} ${v.titolo || 'Osservazione'}</h4>
              <p class="text-xs text-blue-400 mt-0.5">${dataOraBreve(new Date(v.dataEvento || v.quando))}</p>
            </div>
            <div class="text-right flex-shrink-0">
              <p class="text-amber-400 text-sm">${stelle}</p>
              <button onclick="apriDiarioEvento('${v.id}')" class="senza-cornice text-xs text-slate-400 underline hover:text-white mt-1">modifica</button>
            </div>
          </div>
          ${v.nota ? `<p class="text-sm text-slate-300 mt-2 whitespace-pre-line">${v.nota.replace(/</g, '&lt;')}</p>` : ''}
          ${strumento ? `<p class="text-xs text-slate-500 mt-2">${strumento}</p>` : ''}
        </article>`;
    }).join('');
  }
}

// =====================================================================
// 16. CONDIVISIONE, CALENDARIO (.ics) E BACKUP
// =====================================================================

function urlEvento(id) {
  const base = location.origin + location.pathname;
  return `${base}?evento=${encodeURIComponent(id)}`;
}

// Porta l'utente sulla scheda di un evento, ovunque si trovi nell'app
window.vaiAllEvento = (id) => {
  mostraVista('agenda');
  setTimeout(() => {
    const card = document.querySelector(`article[data-evento-id="${id}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('evidenziato');
      setTimeout(() => card.classList.remove('evidenziato'), 2600);
    }
  }, 250);
};

// Apertura da un link condiviso: ?evento=<id> oppure ?vista=<nome>
function gestisciLinkCondiviso() {
  const parametri = new URLSearchParams(location.search);
  const vista = parametri.get('vista');
  if (vista && VISTE.some(v => v.nome === vista)) mostraVista(vista);

  const id = parametri.get('evento');
  if (id && eventiCalcolati.some(e => e.id === id)) vaiAllEvento(id);
}

window.condividiEvento = async (id) => {
  const ev = eventiCalcolati.find(e => e.id === id);
  if (!ev) return;

  const locale = circostanzeLocali(ev);
  const testo = `${ev.titolo}\n${ev.dataTesto}\n\n${ev.spiegazione}` +
    (locale ? `\n\nDa qui: ${locale.giudizio}` : '');

  if (navigator.share) {
    try {
      await navigator.share({ title: ev.titolo, text: testo, url: urlEvento(id) });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;  // condivisione annullata: nulla da fare
    }
  }
  try {
    await navigator.clipboard.writeText(`${testo}\n${urlEvento(id)}`);
    alert('Testo dell\'evento copiato: incollalo dove vuoi.');
  } catch (e) {
    prompt('Copia il link dell\'evento:', urlEvento(id));
  }
};

// Cartolina quadrata dell'evento, pronta da mandare in chat
window.immagineEvento = async (id) => {
  const ev = eventiCalcolati.find(e => e.id === id);
  if (!ev) return;

  const lato = 1080;
  const c = document.createElement('canvas');
  c.width = lato; c.height = lato;
  const ctx = c.getContext('2d');

  const sfondo = ctx.createLinearGradient(0, 0, lato, lato);
  sfondo.addColorStop(0, '#020617');
  sfondo.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = sfondo;
  ctx.fillRect(0, 0, lato, lato);

  // Stelline di sfondo
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * lato, y = Math.random() * lato * 0.75;
    const r = Math.random() * 1.8 + 0.4;
    ctx.globalAlpha = 0.3 + Math.random() * 0.7;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Banda colorata dell'evento
  ctx.fillStyle = ev.colore || '#3b82f6';
  ctx.fillRect(0, 0, 18, lato);

  const cat = CATEGORIE[ev.categoria];
  ctx.fillStyle = '#93c5fd';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(cat ? cat.nome : 'Evento', 70, 130);

  // Titolo su più righe
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 68px system-ui, sans-serif';
  const parole = ev.titolo.split(' ');
  let riga = '', y = 260;
  parole.forEach(p => {
    const prova = riga ? `${riga} ${p}` : p;
    if (ctx.measureText(prova).width > lato - 140) { ctx.fillText(riga, 70, y); y += 82; riga = p; }
    else riga = prova;
  });
  if (riga) ctx.fillText(riga, 70, y);

  ctx.fillStyle = '#facc15';
  ctx.font = '40px system-ui, sans-serif';
  ctx.fillText(ev.dataTesto, 70, y + 90);

  // Spiegazione, tagliata a quel che ci sta
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '32px system-ui, sans-serif';
  let ry = y + 170, rriga = '';
  ev.spiegazione.split(' ').forEach(p => {
    if (ry > lato - 160) return;
    const prova = rriga ? `${rriga} ${p}` : p;
    if (ctx.measureText(prova).width > lato - 140) { ctx.fillText(rriga, 70, ry); ry += 46; rriga = p; }
    else rriga = prova;
  });
  if (rriga && ry <= lato - 160) ctx.fillText(rriga, 70, ry);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText('AstroCalendario di Ben', 70, lato - 60);

  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  if (!blob) return;
  const file = new File([blob], `${ev.titolo.replace(/[^\w]+/g, '-').toLowerCase()}.png`, { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: ev.titolo, text: `${ev.titolo} · ${ev.dataTesto}` });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  scaricaFile(blob, file.name);
};

function scaricaFile(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- File .ics: il calendario del telefono gestisce i promemoria anche
//     ad app chiusa, cosa che una PWA da sola non può fare. ---

function icsData(data) {
  return data.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsTesto(str) {
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Le righe di un file .ics non devono superare i 75 ottetti
function icsPiega(riga) {
  if (riga.length <= 74) return riga;
  const pezzi = [riga.slice(0, 74)];
  let resto = riga.slice(74);
  while (resto.length > 73) {
    pezzi.push(' ' + resto.slice(0, 73));
    resto = resto.slice(73);
  }
  if (resto) pezzi.push(' ' + resto);
  return pezzi.join('\r\n');
}

function generaIcs(eventi) {
  const righe = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AstroCalendario di Ben//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:AstroCalendario di Ben'
  ];

  eventi.forEach(ev => {
    const prog = ev.programma || {};
    const descrizione = [
      ev.spiegazione,
      prog.cosaPortare ? `Portare: ${prog.cosaPortare}` : '',
      prog.doveVederlo ? `Dove: ${prog.doveVederlo}` : '',
      prog.comeVederlo ? `Come: ${prog.comeVederlo}` : '',
      urlEvento(ev.id)
    ].filter(Boolean).join('\n\n');

    righe.push('BEGIN:VEVENT');
    righe.push(`UID:${ev.id}@astrocalendario`);
    righe.push(`DTSTAMP:${icsData(new Date())}`);
    righe.push(`DTSTART:${icsData(ev.dataObj)}`);
    righe.push(`DTEND:${icsData(new Date(ev.dataObj.getTime() + 60 * 60000))}`);
    righe.push(icsPiega(`SUMMARY:${icsTesto(ev.titolo)}`));
    righe.push(icsPiega(`DESCRIPTION:${icsTesto(descrizione)}`));
    righe.push('BEGIN:VALARM');
    righe.push('TRIGGER:-PT30M');
    righe.push('ACTION:DISPLAY');
    righe.push(icsPiega(`DESCRIPTION:${icsTesto(ev.titolo)} fra 30 minuti`));
    righe.push('END:VALARM');
    righe.push('END:VEVENT');
  });

  righe.push('END:VCALENDAR');
  return righe.join('\r\n');
}

window.scaricaIcsEvento = (id) => {
  const ev = eventiCalcolati.find(e => e.id === id);
  if (!ev) return;
  const blob = new Blob([generaIcs([ev])], { type: 'text/calendar;charset=utf-8' });
  scaricaFile(blob, `${ev.titolo.replace(/[^\w]+/g, '-').toLowerCase()}.ics`);
};

function scaricaIcsProssimi(mesi) {
  const limite = Date.now() + mesi * 30.5 * 86400000;
  const eventi = eventiCalcolati
    .filter(e => e.dataObj.getTime() >= Date.now() && e.dataObj.getTime() <= limite)
    .sort((a, b) => a.dataObj - b.dataObj);
  if (!eventi.length) return 0;
  const blob = new Blob([generaIcs(eventi)], { type: 'text/calendar;charset=utf-8' });
  scaricaFile(blob, 'astrocalendario-eventi.ics');
  return eventi.length;
}

// --- Backup: tutto ciò che vive solo in questo browser ---

function esportaBackup() {
  const dati = {
    app: 'AstroCalendario di Ben',
    versione: 1,
    esportato: new Date().toISOString(),
    eventiManuali: JSON.parse(localStorage.getItem(CHIAVE_EVENTI_MANUALI) || '[]'),
    diario,
    posizione: luogoCorrente(),
    bussola: localStorage.getItem(CHIAVE_SKY_BUSSOLA)
  };
  const blob = new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' });
  const giorno = new Date().toISOString().slice(0, 10);
  scaricaFile(blob, `astrocalendario-backup-${giorno}.json`);
}

async function importaBackup(file) {
  const esito = document.getElementById('imp-esito');
  const dillo = (msg, colore) => {
    if (esito) { esito.textContent = msg; esito.className = `text-xs ${colore}`; }
  };

  try {
    const testo = await file.text();
    const dati = JSON.parse(testo);
    if (!dati || typeof dati !== 'object') throw new Error('file non valido');

    let eventiRipristinati = 0, noteRipristinate = 0;

    if (Array.isArray(dati.eventiManuali)) {
      localStorage.setItem(CHIAVE_EVENTI_MANUALI, JSON.stringify(dati.eventiManuali));
      eventiRipristinati = dati.eventiManuali.length;
      // Ricarichiamo in memoria: via i manuali attuali, dentro quelli del backup
      eventiCalcolati = eventiCalcolati.filter(e => !e.manuale);
      caricaEventiManuali();
    }

    if (dati.diario && typeof dati.diario === 'object') {
      diario = dati.diario;
      salvaDiario();
      noteRipristinate = Object.keys(diario).length;
    }

    if (dati.posizione && typeof dati.posizione.lat === 'number') {
      skyImpostaPosizione(dati.posizione.lat, dati.posizione.lon, 'backup');
    }
    if (dati.bussola) {
      try { localStorage.setItem(CHIAVE_SKY_BUSSOLA, dati.bussola); } catch (e) { /* niente storage */ }
    }

    pianificaNotifiche();
    aggiornaViste();
    costruisciDiario();
    costruisciStasera();
    aggiornaSchedaImpostazioni();
    dillo(`Ripristinati ${eventiRipristinati} eventi personali e ${noteRipristinate} note del diario.`, 'text-green-400');
  } catch (e) {
    dillo('File non leggibile: assicurati che sia un backup esportato da questa app.', 'text-red-400');
  }
}

function aggiornaSchedaImpostazioni() {
  const box = document.getElementById('imp-posizione');
  const luogo = luogoCorrente();
  if (box) {
    box.textContent = luogo
      ? `Impostata: ${formattaCoordinate(luogo.lat, luogo.lon)}`
      : 'Non impostata: molte funzioni restano spente.';
    box.className = luogo ? 'text-sm text-green-400' : 'text-sm text-amber-400';
  }
  const lat = document.getElementById('imp-lat');
  const lon = document.getElementById('imp-lon');
  if (lat && luogo) lat.value = luogo.lat.toFixed(4);
  if (lon && luogo) lon.value = luogo.lon.toFixed(4);
}

function inizializzaImpostazioni() {
  const modale = document.getElementById('modale-impostazioni');
  const apri = document.getElementById('btn-impostazioni');
  const chiudi = () => { if (modale) modale.classList.add('hidden'); };

  if (apri) apri.addEventListener('click', () => {
    aggiornaSchedaImpostazioni();
    if (modale) modale.classList.remove('hidden');
  });
  const btnChiudi = document.getElementById('btn-chiudi-impostazioni');
  if (btnChiudi) btnChiudi.addEventListener('click', chiudi);
  if (modale) modale.addEventListener('click', (e) => { if (e.target === modale) chiudi(); });

  const btnGps = document.getElementById('imp-btn-gps');
  if (btnGps) btnGps.addEventListener('click', async () => {
    btnGps.textContent = 'Cerco…';
    const ok = await skyRichiediPosizione();
    btnGps.textContent = 'Rileva con il GPS';
    aggiornaSchedaImpostazioni();
    if (ok) { await caricaMeteo(true); costruisciStasera(); aggiornaViste(); }
  });

  const btnManuale = document.getElementById('imp-btn-manuale');
  if (btnManuale) btnManuale.addEventListener('click', async () => {
    const lat = parseFloat(document.getElementById('imp-lat').value);
    const lon = parseFloat(document.getElementById('imp-lon').value);
    if (isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      alert('Coordinate non valide: la latitudine va da −90 a 90, la longitudine da −180 a 180.');
      return;
    }
    skyImpostaPosizione(lat, lon, 'manuale');
    aggiornaSchedaImpostazioni();
    await caricaMeteo(true);
    costruisciStasera();
    aggiornaViste();
  });

  const btnIcs = document.getElementById('imp-btn-ics');
  if (btnIcs) btnIcs.addEventListener('click', () => {
    const quanti = scaricaIcsProssimi(12);
    const esito = document.getElementById('imp-esito');
    if (esito) {
      esito.textContent = quanti
        ? `Scaricati ${quanti} eventi: aprili con il calendario del telefono per avere i promemoria.`
        : 'Nessun evento nei prossimi 12 mesi.';
      esito.className = 'text-xs text-green-400';
    }
  });

  const btnEsporta = document.getElementById('imp-btn-esporta');
  if (btnEsporta) btnEsporta.addEventListener('click', esportaBackup);

  const btnImporta = document.getElementById('imp-btn-importa');
  const fileImporta = document.getElementById('imp-file-importa');
  if (btnImporta && fileImporta) {
    btnImporta.addEventListener('click', () => fileImporta.click());
    fileImporta.addEventListener('change', () => {
      if (fileImporta.files && fileImporta.files[0]) importaBackup(fileImporta.files[0]);
      fileImporta.value = '';
    });
  }
}

// =====================================================================
// 17. CONSIGLI DI ASTROFOTOGRAFIA
//     Quasi tutti provano a fotografare quello che vedono, e quasi
//     sempre viene male: bastano tre numeri per cambiare il risultato.
// =====================================================================

function consigliFoto(evento) {
  const base = {
    treppiede: 'Un treppiede (anche piccolo) fa più differenza di qualsiasi obiettivo costoso.',
    telefono: 'Col telefono: modalità Pro o Notte, autoscatto di 3 secondi per non muoverlo, messa a fuoco manuale su ∞.'
  };

  switch (evento.categoria) {
    case 'luna':
      return Object.assign({}, base, {
        titolo: 'Fotografare la Luna',
        obiettivo: 'Il più lungo che hai: 200–300 mm su reflex, zoom ottico sul telefono.',
        esposizione: 'Regola “lunare”: 1/125 s, f/8, ISO 100. La Luna è illuminata dal Sole, quindi va trattata come un soggetto diurno.',
        errore: 'L\'errore classico è sovraesporre: se viene un disco bianco senza crateri, riduci di 2–3 stop.'
      });
    case 'eclissi':
      return Object.assign({}, base, {
        titolo: 'Fotografare l\'eclissi',
        obiettivo: 'Teleobiettivo 200 mm o più. Per quella solare serve un filtro solare certificato davanti all\'obiettivo.',
        esposizione: 'Eclissi lunare: ISO 800, f/5.6, 1/4 s durante la totalità (la Luna rossa è molto più scura). Eclissi solare parziale: come una foto diurna, ma solo con filtro.',
        errore: 'Mai puntare il Sole senza filtro: bruci il sensore e, se guardi nel mirino, anche l\'occhio.'
      });
    case 'meteore':
      return Object.assign({}, base, {
        titolo: 'Fotografare le stelle cadenti',
        obiettivo: 'Grandangolo luminoso (14–24 mm, f/2.8 o più aperto): serve campo, non ingrandimento.',
        esposizione: 'ISO 1600–3200, f/2.8, pose da 15–20 s a raffica per ore. Regola del 500: secondi massimi = 500 ÷ lunghezza focale, oltre le stelle diventano trattini.',
        errore: 'Non si insegue la meteora: si punta la camera in una zona di cielo a ~40° dal radiante e si scatta in continuo.'
      });
    case 'pianeti':
    case 'congiunzioni':
      return Object.assign({}, base, {
        titolo: 'Fotografare pianeti e congiunzioni',
        obiettivo: 'Per la congiunzione basta un 50–100 mm: bello è il paesaggio con i due astri vicini.',
        esposizione: 'ISO 400–800, f/4, 1–2 s se sono ancora nel crepuscolo. I pianeti sono luminosi: meglio esporre poco.',
        errore: 'Includi un albero o un profilo di case: una foto di due puntini nel nero non racconta nulla.'
      });
    default:
      return Object.assign({}, base, {
        titolo: 'Fotografare il cielo',
        obiettivo: 'Grandangolo luminoso e messa a fuoco manuale su una stella brillante.',
        esposizione: 'ISO 1600, f/2.8, 10–20 s. Scatta in RAW se puoi: recuperi molto in post-produzione.',
        errore: 'Evita lo zoom digitale: rovina i dettagli senza aggiungere nulla.'
      });
  }
}

// =====================================================================
// 18. COSTELLAZIONI E PROFONDO CIELO NELLA VISTA CIELO
//     Le figure delle costellazioni sono ciò che la gente cerca davvero
//     di riconoscere. Le stelle sono elencate con coordinate J2000
//     (ascensione retta in ore, declinazione in gradi): lo scarto con le
//     coordinate di oggi è di frazioni di grado, invisibile a occhio nudo.
// =====================================================================

const SKY_COSTELLAZIONI = [
  { nome: 'Orione', stelle: [
      [5.919, 7.407, 0.5, 'Betelgeuse'], [5.242, -8.202, 0.13, 'Rigel'], [5.418, 6.350, 1.64, 'Bellatrix'],
      [5.796, -9.670, 2.06, 'Saiph'], [5.679, -1.943, 1.77, 'Alnitak'], [5.604, -1.202, 1.69, 'Alnilam'],
      [5.533, -0.299, 2.23, 'Mintaka'], [5.585, 9.934, 3.39, 'Meissa']
    ], linee: [[0,2],[2,6],[6,5],[5,4],[4,3],[3,1],[1,6],[0,4],[0,7],[2,7]] },

  { nome: 'Orsa Maggiore', stelle: [
      [11.062, 61.751, 1.79, 'Dubhe'], [11.031, 56.383, 2.37, 'Merak'], [11.897, 53.695, 2.44, 'Phecda'],
      [12.257, 57.033, 3.31, 'Megrez'], [12.900, 55.960, 1.77, 'Alioth'], [13.399, 54.925, 2.23, 'Mizar'],
      [13.792, 49.313, 1.86, 'Alkaid']
    ], linee: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]] },

  { nome: 'Orsa Minore', stelle: [
      [2.530, 89.264, 1.98, 'Stella Polare'], [17.537, 86.586, 4.36, 'Yildun'], [16.766, 82.037, 4.21, 'ε UMi'],
      [15.734, 77.794, 4.29, 'ζ UMi'], [14.845, 74.155, 2.08, 'Kochab'], [15.345, 71.834, 3.05, 'Pherkad'],
      [16.291, 75.755, 4.95, 'η UMi']
    ], linee: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]] },

  { nome: 'Cassiopea', stelle: [
      [0.153, 59.150, 2.27, 'Caph'], [0.675, 56.537, 2.24, 'Schedar'], [0.945, 60.717, 2.15, 'γ Cas'],
      [1.430, 60.235, 2.68, 'Ruchbah'], [1.906, 63.670, 3.35, 'Segin']
    ], linee: [[0,1],[1,2],[2,3],[3,4]] },

  { nome: 'Cigno', stelle: [
      [20.690, 45.280, 1.25, 'Deneb'], [20.371, 40.257, 2.23, 'Sadr'], [19.512, 27.960, 3.05, 'Albireo'],
      [20.770, 33.970, 2.48, 'Gienah'], [19.749, 45.131, 2.87, 'δ Cyg']
    ], linee: [[0,1],[1,2],[1,3],[1,4]] },

  { nome: 'Lira', stelle: [
      [18.616, 38.784, 0.03, 'Vega'], [18.746, 37.605, 4.34, 'ζ Lyr'], [18.834, 33.363, 3.52, 'Sheliak'],
      [18.982, 32.690, 3.24, 'Sulafat'], [18.908, 36.899, 4.30, 'δ Lyr']
    ], linee: [[0,1],[1,2],[2,3],[3,4],[4,1]] },

  { nome: 'Aquila', stelle: [
      [19.846, 8.868, 0.77, 'Altair'], [19.771, 10.613, 2.72, 'Tarazed'], [19.921, 6.407, 3.71, 'Alshain'],
      [19.425, 3.115, 3.36, 'δ Aql'], [19.090, 13.863, 2.99, 'ζ Aql'], [19.098, -4.882, 3.44, 'λ Aql']
    ], linee: [[4,1],[1,0],[0,2],[0,3],[3,5]] },

  { nome: 'Scorpione', stelle: [
      [16.490, -26.432, 1.06, 'Antares'], [16.090, -19.805, 2.62, 'Graffias'], [16.005, -22.622, 2.29, 'Dschubba'],
      [15.981, -26.114, 2.89, 'π Sco'], [16.353, -25.593, 2.90, 'σ Sco'], [16.598, -28.216, 2.82, 'τ Sco'],
      [16.843, -34.293, 2.29, 'ε Sco'], [16.865, -38.048, 3.00, 'μ Sco'], [16.911, -42.361, 3.62, 'ζ Sco'],
      [17.203, -43.239, 3.33, 'η Sco'], [17.622, -42.998, 1.86, 'Sargas'], [17.560, -37.104, 1.62, 'Shaula']
    ], linee: [[1,2],[2,3],[2,4],[4,0],[0,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11]] },

  { nome: 'Leone', stelle: [
      [10.139, 11.967, 1.36, 'Regolo'], [11.818, 14.572, 2.14, 'Denebola'], [10.333, 19.841, 2.08, 'Algieba'],
      [11.235, 20.524, 2.56, 'Zosma'], [11.237, 15.430, 3.33, 'Chertan'], [10.122, 16.763, 3.48, 'η Leo'],
      [9.764, 23.774, 2.98, 'ε Leo'], [9.880, 26.007, 3.88, 'μ Leo'], [10.278, 23.417, 3.44, 'Adhafera']
    ], linee: [[6,7],[7,8],[8,2],[2,5],[5,0],[0,4],[4,3],[3,1],[1,4],[2,3]] },

  { nome: 'Toro', stelle: [
      [4.599, 16.509, 0.85, 'Aldebaran'], [5.438, 28.608, 1.65, 'Elnath'], [5.627, 21.143, 3.00, 'ζ Tau'],
      [4.477, 15.871, 3.40, 'θ Tau'], [4.330, 15.628, 3.65, 'γ Tau'], [4.382, 17.543, 3.76, 'δ Tau'],
      [4.478, 19.180, 3.53, 'ε Tau'], [4.011, 12.490, 3.41, 'λ Tau']
    ], linee: [[7,4],[4,5],[5,6],[6,1],[4,3],[3,0],[0,2]] },

  { nome: 'Gemelli', stelle: [
      [7.577, 31.888, 1.58, 'Castore'], [7.755, 28.026, 1.16, 'Polluce'], [6.629, 16.399, 1.90, 'Alhena'],
      [6.383, 22.514, 2.87, 'μ Gem'], [6.732, 25.131, 2.98, 'ε Gem'], [7.335, 21.982, 3.53, 'δ Gem'],
      [7.068, 20.570, 3.79, 'ζ Gem'], [6.755, 12.896, 3.36, 'ξ Gem'], [6.248, 22.507, 3.28, 'η Gem']
    ], linee: [[0,4],[4,3],[3,8],[1,5],[5,6],[6,2],[2,7],[0,1]] },

  { nome: 'Cane Maggiore', stelle: [
      [6.752, -16.716, -1.46, 'Sirio'], [6.378, -17.956, 1.98, 'Mirzam'], [7.140, -26.393, 1.83, 'Wezen'],
      [6.977, -28.972, 1.50, 'Adhara'], [7.402, -29.303, 2.45, 'Aludra']
    ], linee: [[1,0],[0,2],[2,3],[2,4]] },

  { nome: 'Auriga', stelle: [
      [5.278, 45.998, 0.08, 'Capella'], [5.992, 44.947, 1.90, 'Menkalinan'], [5.995, 37.213, 2.62, 'θ Aur'],
      [5.438, 28.608, 1.65, 'Elnath'], [4.950, 33.166, 2.69, 'ι Aur'], [5.033, 43.823, 2.99, 'ε Aur']
    ], linee: [[0,1],[1,2],[2,3],[3,4],[4,0],[0,5]] },

  { nome: 'Perseo', stelle: [
      [3.405, 49.861, 1.79, 'Mirfak'], [3.136, 40.956, 2.12, 'Algol'], [3.080, 53.507, 2.93, 'γ Per'],
      [3.715, 47.788, 3.01, 'δ Per'], [3.964, 40.010, 2.89, 'ε Per'], [3.902, 31.884, 2.85, 'ζ Per']
    ], linee: [[2,0],[0,3],[3,4],[4,5],[0,1]] },

  { nome: 'Andromeda', stelle: [
      [0.140, 29.091, 2.06, 'Alpheratz'], [1.162, 35.621, 2.06, 'Mirach'], [2.065, 42.330, 2.10, 'Almach'],
      [0.656, 30.861, 3.27, 'δ And'], [0.947, 38.499, 3.86, 'μ And']
    ], linee: [[0,3],[3,1],[1,2],[1,4]] },

  { nome: 'Pegaso', stelle: [
      [23.079, 15.205, 2.48, 'Markab'], [23.063, 28.083, 2.42, 'Scheat'], [0.221, 15.184, 2.83, 'Algenib'],
      [0.140, 29.091, 2.06, 'Alpheratz'], [21.736, 9.875, 2.38, 'Enif']
    ], linee: [[0,1],[1,3],[3,2],[2,0],[0,4]] },

  { nome: 'Boote', stelle: [
      [14.261, 19.182, -0.05, 'Arturo'], [14.750, 27.074, 2.35, 'Izar'], [14.535, 38.308, 3.03, 'γ Boo'],
      [15.032, 40.390, 3.49, 'β Boo'], [15.258, 33.315, 3.47, 'δ Boo'], [13.911, 18.398, 2.68, 'Muphrid']
    ], linee: [[5,0],[0,1],[1,4],[4,3],[3,2],[2,0]] },

  { nome: 'Corona Boreale', stelle: [
      [15.578, 26.715, 2.22, 'Alphecca'], [15.464, 29.106, 3.66, 'β CrB'], [15.712, 26.296, 3.84, 'γ CrB'],
      [15.826, 26.068, 4.57, 'δ CrB'], [15.960, 26.878, 4.14, 'ε CrB'], [15.548, 31.359, 4.14, 'θ CrB']
    ], linee: [[5,1],[1,0],[0,2],[2,3],[3,4]] },

  { nome: 'Vergine', stelle: [
      [13.420, -11.161, 0.98, 'Spica'], [12.694, -1.449, 2.74, 'Porrima'], [13.036, 10.959, 2.83, 'Vindemiatrix'],
      [12.927, 3.397, 3.38, 'δ Vir'], [13.578, -0.596, 3.38, 'ζ Vir'], [12.333, -0.667, 3.89, 'η Vir'],
      [11.845, 1.765, 3.60, 'β Vir']
    ], linee: [[6,5],[5,1],[1,3],[3,2],[3,4],[4,0]] },

  { nome: 'Sagittario', stelle: [
      [18.403, -34.385, 1.85, 'Kaus Australis'], [18.921, -26.297, 2.05, 'Nunki'], [18.350, -29.828, 2.70, 'Kaus Media'],
      [18.466, -25.422, 2.81, 'Kaus Borealis'], [18.741, -26.991, 3.17, 'φ Sgr'], [19.044, -29.880, 2.60, 'ζ Sgr'],
      [19.115, -27.670, 3.32, 'τ Sgr'], [18.097, -30.424, 2.99, 'γ Sgr']
    ], linee: [[7,2],[2,0],[2,3],[3,4],[4,1],[1,6],[6,5],[5,0],[4,5]] },

  { nome: 'Ariete', stelle: [
      [2.119, 23.462, 2.00, 'Hamal'], [1.911, 20.808, 2.64, 'Sheratan'], [1.892, 19.294, 3.86, 'Mesarthim']
    ], linee: [[0,1],[1,2]] },

  { nome: 'Croce del Sud', stelle: [
      [12.443, -63.099, 0.77, 'Acrux'], [12.795, -59.689, 1.25, 'Mimosa'], [12.519, -57.113, 1.63, 'Gacrux'],
      [12.253, -58.749, 2.79, 'δ Cru']
    ], linee: [[0,2],[1,3]] },

  { nome: 'Centauro', stelle: [
      [14.660, -60.834, -0.27, 'Rigil Kentaurus'], [14.064, -60.373, 0.61, 'Hadar']
    ], linee: [[0,1]] }
];

// Oggetti del profondo cielo alla portata di occhio nudo e binocolo
const SKY_PROFONDO = [
  { nome: 'M31 — Galassia di Andromeda', ra: 0.712, dec: 41.269, mag: 3.4, tipo: 'galassia', strumento: 'occhio',
    nota: 'La cosa più lontana visibile a occhio nudo: 2,5 milioni di anni luce. Nel binocolo è una macchia ovale.' },
  { nome: 'M42 — Nebulosa di Orione', ra: 5.588, dec: -5.391, mag: 4.0, tipo: 'nebulosa', strumento: 'occhio',
    nota: 'La stella di mezzo della spada di Orione non è una stella: è una nursery di stelle appena nate.' },
  { nome: 'M45 — Pleiadi', ra: 3.790, dec: 24.117, mag: 1.6, tipo: 'ammasso', strumento: 'occhio',
    nota: 'Le “sette sorelle”. A occhio nudo se ne contano 6–7, col binocolo diventano decine.' },
  { nome: 'M44 — Presepe', ra: 8.670, dec: 19.983, mag: 3.7, tipo: 'ammasso', strumento: 'binocolo',
    nota: 'Una nuvoletta a occhio nudo, uno sciame di stelle nel binocolo.' },
  { nome: 'M13 — Ammasso di Ercole', ra: 16.695, dec: 36.460, mag: 5.8, tipo: 'globulare', strumento: 'binocolo',
    nota: 'Mezzo milione di stelle in una palla: il più bell\'ammasso globulare del cielo boreale.' },
  { nome: 'M8 — Nebulosa Laguna', ra: 18.060, dec: -24.383, mag: 6.0, tipo: 'nebulosa', strumento: 'binocolo',
    nota: 'Nel cuore della Via Lattea estiva, sopra il “becco” della teiera del Sagittario.' },
  { nome: 'M22 — Globulare del Sagittario', ra: 18.606, dec: -23.904, mag: 5.1, tipo: 'globulare', strumento: 'binocolo',
    nota: 'Più luminoso di M13 ma più basso: serve un orizzonte sud pulito.' },
  { nome: 'Doppio Ammasso di Perseo', ra: 2.317, dec: 57.133, mag: 4.3, tipo: 'ammasso', strumento: 'binocolo',
    nota: 'Due ammassi vicini nello stesso campo del binocolo: uno dei colpi d\'occhio più belli.' },
  { nome: 'M57 — Nebulosa Anello', ra: 18.893, dec: 33.029, mag: 8.8, tipo: 'planetaria', strumento: 'telescopio',
    nota: 'Un anello di fumo lasciato da una stella morente, fra le due stelle basse della Lira.' },
  { nome: 'M27 — Nebulosa Manubrio', ra: 19.994, dec: 22.721, mag: 7.4, tipo: 'planetaria', strumento: 'telescopio',
    nota: 'Grande e alla portata di un piccolo telescopio, sotto cieli scuri anche del binocolo.' },
  { nome: 'M51 — Galassia Vortice', ra: 13.498, dec: 47.195, mag: 8.4, tipo: 'galassia', strumento: 'telescopio',
    nota: 'Due galassie in collisione, sotto la coda del Grande Carro.' },
  { nome: 'M81 — Galassia di Bode', ra: 9.926, dec: 69.066, mag: 6.9, tipo: 'galassia', strumento: 'telescopio',
    nota: 'Insieme a M82 entra nello stesso campo: due galassie in un colpo solo.' },
  { nome: 'M15 — Globulare di Pegaso', ra: 21.500, dec: 12.167, mag: 6.2, tipo: 'globulare', strumento: 'binocolo',
    nota: 'Compatto e luminoso, facile da trovare partendo da Enif.' },
  { nome: 'M3 — Globulare dei Cani da Caccia', ra: 13.703, dec: 28.377, mag: 6.2, tipo: 'globulare', strumento: 'binocolo',
    nota: 'Primavera: a metà strada fra Arturo e Cor Caroli.' }
];

// Colori per tipo di oggetto profondo
const SKY_COLORI_PROFONDO = {
  galassia: '#c4b5fd', nebulosa: '#f9a8d4', ammasso: '#a5f3fc',
  globulare: '#fde68a', planetaria: '#86efac'
};

// L'ora mostrata nella vista Cielo: normalmente adesso, ma la si può
// spostare avanti e indietro per pianificare la serata.
function skyAdesso() {
  return new Date(Date.now() + (sky.offsetTempoMin || 0) * 60000);
}

// Posizioni delle stelle delle costellazioni e degli oggetti profondi
function skyAggiornaCatalogo(data) {
  if (!sky.observer || typeof Astronomy === 'undefined') {
    sky.costellazioni = [];
    sky.profondo = [];
    return;
  }
  const t = Astronomy.MakeTime(data);

  if (sky.mostraCostellazioni) {
    sky.costellazioni = SKY_COSTELLAZIONI.map(c => ({
      nome: c.nome,
      linee: c.linee,
      stelle: c.stelle.map(s => {
        const hor = Astronomy.Horizon(t, sky.observer, s[0], s[1], 'normal');
        return { az: hor.azimuth, alt: hor.altitude, mag: s[2], nome: s[3] };
      })
    }));
  } else {
    sky.costellazioni = [];
  }

  if (sky.mostraProfondo) {
    sky.profondo = SKY_PROFONDO.map(o => {
      const hor = Astronomy.Horizon(t, sky.observer, o.ra, o.dec, 'normal');
      return Object.assign({}, o, { az: hor.azimuth, alt: hor.altitude });
    });
  } else {
    sky.profondo = [];
  }
}

// Figure delle costellazioni: linee sottili e stelle proporzionate alla luminosità
function skyDisegnaCostellazioni(ctx, base, focale) {
  if (!sky.costellazioni || !sky.costellazioni.length) return;

  ctx.save();
  sky.costellazioni.forEach(c => {
    const punti = c.stelle.map(s => skyProietta(skyVettore(s.az, s.alt), base, focale));

    // Linee della figura
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    c.linee.forEach(([i, j]) => {
      const a = punti[i], b = punti[j];
      if (!a || !b || !a.davanti || !b.davanti) return;
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
    });
    ctx.stroke();

    // Stelle della costellazione
    c.stelle.forEach((s, i) => {
      const p = punti[i];
      if (!p.davanti) return;
      if (p.px < -20 || p.px > sky.larghezza + 20 || p.py < -20 || p.py > sky.altezza + 20) return;
      const r = Math.max(1.2, Math.min(4.5, 3.6 - s.mag * 0.55));
      ctx.globalAlpha = s.alt < 0 ? 0.25 : 0.95;
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Nome della costellazione al centro della figura, se è in vista
    const visibili = punti.filter(p => p.davanti && p.px > 0 && p.px < sky.larghezza && p.py > 0 && p.py < sky.altezza);
    if (visibili.length >= Math.max(2, Math.ceil(punti.length / 2))) {
      const cx = visibili.reduce((s, p) => s + p.px, 0) / visibili.length;
      const cy = visibili.reduce((s, p) => s + p.py, 0) / visibili.length;
      ctx.globalAlpha = 0.75;
      ctx.font = 'italic 13px system-ui, sans-serif';
      ctx.fillStyle = '#93c5fd';
      ctx.textAlign = 'center';
      ctx.fillText(c.nome, cx, cy);
    }
  });
  ctx.restore();
}

// Oggetti del profondo cielo: simboli discreti con etichetta
function skyDisegnaProfondo(ctx, base, focale) {
  if (!sky.profondo || !sky.profondo.length) return;

  ctx.save();
  sky.profondo.forEach(o => {
    const p = skyProietta(skyVettore(o.az, o.alt), base, focale);
    if (!p.davanti) return;
    if (p.px < -40 || p.px > sky.larghezza + 40 || p.py < -40 || p.py > sky.altezza + 40) return;

    const colore = SKY_COLORI_PROFONDO[o.tipo] || '#a5f3fc';
    ctx.globalAlpha = o.alt < 0 ? 0.25 : 0.9;

    ctx.strokeStyle = colore;
    ctx.lineWidth = 1.4;
    if (o.tipo === 'galassia') {
      ctx.beginPath();
      ctx.ellipse(p.px, p.py, 9, 4.5, -0.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (o.tipo === 'nebulosa' || o.tipo === 'planetaria') {
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(p.px, p.py, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.beginPath();
      ctx.arc(p.px, p.py, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = colore;
      ctx.globalAlpha *= 0.35;
      ctx.fill();
    }

    ctx.globalAlpha = o.alt < 0 ? 0.3 : 0.85;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = colore;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.nome.split(' — ')[0], p.px + 12, p.py);
  });
  ctx.restore();
}

// --- Macchina del tempo della vista Cielo ---

function skyAggiornaTestoTempo() {
  const el = document.getElementById('skymap-tempo-testo');
  if (!el) return;
  const min = sky.offsetTempoMin || 0;
  if (!min) {
    el.textContent = 'In tempo reale';
    el.className = 'mt-2 text-xs text-slate-300 font-mono';
    return;
  }
  const abs = Math.abs(min);
  const durata = abs >= 60 ? `${Math.floor(abs / 60)}h ${String(abs % 60).padStart(2, '0')}m` : `${abs} min`;
  const scarto = min > 0 ? `fra ${durata}` : `${durata} fa`;
  el.textContent = `${skyAdesso().toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${scarto}`;
  el.className = 'mt-2 text-xs text-amber-400 font-mono';
}

function skyImpostaOffsetTempo(minuti) {
  sky.offsetTempoMin = minuti;
  sky.prossimoCalcolo = 0;                       // ricalcolo immediato
  sky.cacheOrari = { chiave: null, valore: null };
  const slider = document.getElementById('skymap-tempo');
  if (slider && parseInt(slider.value, 10) !== minuti) slider.value = String(minuti);
  skyAggiornaTestoTempo();
  skyAggiornaOggetti(true);
}

// --- Fotocamera: il cielo calcolato sopra l'immagine reale ---

async function skyAttivaFotocamera() {
  const video = document.getElementById('skymap-video');
  const btn = document.getElementById('skymap-btn-camera');
  if (!video) return;

  if (sky.camera) {
    sky.camera.getTracks().forEach(t => t.stop());
    sky.camera = null;
    video.srcObject = null;
    video.classList.add('hidden');
    if (btn) { btn.textContent = 'Fotocamera'; btn.className = 'px-3 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-white font-semibold'; }
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    skyAvviso('camera', 'Questo browser non dà accesso alla fotocamera.');
    return;
  }
  try {
    sky.camera = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }, audio: false
    });
    video.srcObject = sky.camera;
    video.classList.remove('hidden');
    await video.play().catch(() => {});
    if (btn) { btn.textContent = 'Spegni fotocamera'; btn.className = 'px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold'; }
    skyAvviso('camera', '');
  } catch (e) {
    sky.camera = null;
    skyAvviso('camera', 'Fotocamera non disponibile: serve il permesso del browser e una connessione sicura (https).');
  }
}

function skySpegniFotocamera() {
  if (sky.camera) skyAttivaFotocamera();
}

// Collega i comandi nuovi della vista Cielo (chiamata da inizializzaSkymap)
function inizializzaSkymapExtra() {
  const collega = (id, azione) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', azione);
  };

  const slider = document.getElementById('skymap-tempo');
  if (slider) slider.addEventListener('input', () => skyImpostaOffsetTempo(parseInt(slider.value, 10) || 0));
  collega('skymap-tempo-ora', () => skyImpostaOffsetTempo(0));

  collega('skymap-btn-costellazioni', () => {
    sky.mostraCostellazioni = !sky.mostraCostellazioni;
    const btn = document.getElementById('skymap-btn-costellazioni');
    if (btn) btn.className = `px-3 py-1.5 rounded-full ${sky.mostraCostellazioni ? 'bg-blue-700 hover:bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'} text-white font-semibold`;
    skyAggiornaOggetti(true);
  });

  collega('skymap-btn-deepsky', () => {
    sky.mostraProfondo = !sky.mostraProfondo;
    const btn = document.getElementById('skymap-btn-deepsky');
    if (btn) btn.className = `px-3 py-1.5 rounded-full ${sky.mostraProfondo ? 'bg-blue-700 hover:bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'} text-white font-semibold`;
    skyAggiornaOggetti(true);
  });

  collega('skymap-btn-camera', skyAttivaFotocamera);

  // Uscendo dalla vista Cielo la fotocamera si spegne: batteria e privacy
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) skySpegniFotocamera();
  });

  skyAggiornaTestoTempo();
}

// =====================================================================
// 19. LE SCHEDE DELL'AGENDA, ARRICCHITE
//     Ogni evento ora dice anche: da qui si vede? con che cielo? con
//     quale strumento? e cosa ne pensi tu (diario).
// =====================================================================

// Riquadro "da qui": altezza, direzione, orari e semaforo di osservabilità
function bloccoLocaleHtml(evento) {
  const locale = circostanzeLocali(evento);
  evento.localeCache = locale;   // riusato dall'indice di osservabilità
  if (!locale) {
    if (!luogoCorrente() && evento.dataObj.getTime() - Date.now() < 30 * 86400000) {
      return `<div class="bg-slate-900 p-3 rounded-xl mt-3 text-sm border border-slate-700">
        <button onclick="document.getElementById('btn-impostazioni').click()" class="text-blue-400 underline hover:text-blue-300">
          Imposta la tua posizione</button>
        <span class="text-slate-400"> per sapere se questo evento si vede da casa tua, a che ora e in che direzione.</span>
      </div>`;
    }
    return '';
  }

  const indice = indiceOsservabilita(evento);
  const colore = locale.livello === 'si' ? 'text-green-400'
               : locale.livello === 'parziale' ? 'text-amber-400' : 'text-red-400';
  const segno = pallino(locale.livello === 'si' ? '#7fb069' : locale.livello === 'parziale' ? '#eab54a' : '#e2685c');

  const righe = [];
  righe.push(`<p class="${colore} font-semibold">${segno} ${locale.giudizio}</p>`);

  if (locale.sorge || locale.tramonta) {
    righe.push(`<p class="text-slate-400 mt-1">Sorge ${oraBreve(locale.sorge)} · tramonta ${oraBreve(locale.tramonta)}</p>`);
  }
  if (locale.buio && locale.buio.buioInizio) {
    righe.push(`<p class="text-slate-400">Buio astronomico quella notte: ${oraBreve(locale.buio.buioInizio)} → ${oraBreve(locale.buio.buioFine)}</p>`);
  }
  if (indice) {
    righe.push(`<p class="mt-2 text-slate-300"><strong>${indice.semaforo} Osservabilità ${indice.punteggio}/100</strong>
      <span class="text-slate-400">— ${indice.motivi.join('; ')}</span></p>`);
    if (indice.quando) {
      righe.push(`<p class="text-blue-300">Momento consigliato: ${dataOraBreve(indice.quando)}</p>`);
    }
  }

  return `<div class="bg-slate-900 p-3 rounded-xl mt-3 text-sm border border-slate-700">
    <h3 class="font-bold text-white mb-1 text-sm">Da qui</h3>${righe.join('')}
  </div>`;
}

// Consigli di scatto, chiusi finché non servono
function bloccoFotoHtml(evento) {
  const f = consigliFoto(evento);
  return `<details class="bg-slate-900 rounded-xl mt-3 text-sm border border-slate-700">
    <summary class="p-3 cursor-pointer font-bold text-white">${f.titolo}</summary>
    <div class="px-3 pb-3 space-y-1 text-slate-300">
      <p><span class="text-blue-400">Obiettivo:</span> ${f.obiettivo}</p>
      <p><span class="text-blue-400">Esposizione:</span> ${f.esposizione}</p>
      <p><span class="text-blue-400">Errore da evitare:</span> ${f.errore}</p>
      <p class="text-slate-400">${f.treppiede} ${f.telefono}</p>
    </div>
  </details>`;
}

// Riga di pulsanti sotto la scheda: diario, condivisione, calendario, cartolina
function barraAzioniHtml(evento) {
  const visto = !!diario[evento.id];
  const stile = 'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors';
  return `<div class="flex flex-wrap gap-2 mt-3 pl-4">
    <button onclick="apriDiarioEvento('${evento.id}')" class="${stile} ${visto ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-slate-700 hover:bg-green-600 text-slate-100'}" title="Registra l'osservazione nel diario">
      ${visto ? 'Visto!' : 'Segna come visto'}
    </button>
    <button onclick="condividiEvento('${evento.id}')" class="${stile} bg-slate-700 hover:bg-blue-600 text-slate-100" title="Condividi l'evento">Condividi</button>
    <button onclick="immagineEvento('${evento.id}')" class="${stile} bg-slate-700 hover:bg-purple-600 text-slate-100" title="Crea una cartolina da mandare in chat">Cartolina</button>
    <button onclick="scaricaIcsEvento('${evento.id}')" class="${stile} bg-slate-700 hover:bg-blue-600 text-slate-100" title="Aggiungi al calendario del telefono">Al calendario</button>
  </div>`;
}

// Badge con lo strumento minimo consigliato
function badgeStrumentoHtml(evento) {
  const s = STRUMENTI[strumentoEvento(evento)];
  if (!s) return '';
  return `<span class="inline-flex items-center gap-1.5 align-middle text-xs bg-slate-700 text-slate-200 px-2.5 py-1 rounded-full border border-slate-600 ml-1" title="Strumento consigliato">${icona(s.disegno, 15)} ${s.nome}</span>`;
}

// Quando arrivano le previsioni meteo i semafori cambiano: ricostruiamo
// l'agenda solo se è la vista che l'utente sta guardando.
function aggiornaSemaforiAgenda() {
  const vista = document.getElementById('vista-agenda');
  if (vista && !vista.classList.contains('hidden')) costruisciAgenda();
}

// Chip del filtro per strumento
function inizializzaFiltroStrumento() {
  const cont = document.getElementById('filtri-strumento');
  if (!cont) return;

  const chip = [{ id: 'tutti', disegno: 'stella', nome: 'Tutto' }]
    .concat(Object.keys(STRUMENTI).map(id => ({ id, disegno: STRUMENTI[id].disegno, nome: STRUMENTI[id].nome })));

  cont.innerHTML = chip.map(c =>
    `<button type="button" data-str="${c.id}" class="chip-strumento" title="Mostra ciò che si vede ${c.id === 'tutti' ? 'in ogni caso' : c.nome.toLowerCase()}">${icona(c.disegno, 16)} ${c.nome}</button>`
  ).join('');

  cont.querySelectorAll('.chip-strumento').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroStrumento = btn.dataset.str;
      aggiornaStileChipStrumento();
      applicaFiltri();
    });
  });
  aggiornaStileChipStrumento();
}

function aggiornaStileChipStrumento() {
  const base = 'chip-strumento inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border border-slate-600';
  const attivo = ' bg-blue-600 text-white shadow';
  const inattivo = ' bg-slate-700 text-slate-300 hover:bg-slate-600';
  document.querySelectorAll('.chip-strumento').forEach(btn => {
    btn.className = base + (btn.dataset.str === filtroStrumento ? attivo : inattivo);
  });
}
