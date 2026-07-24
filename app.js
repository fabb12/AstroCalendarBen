// Il nostro database locale di eventi calcolati al volo
let eventiCalcolati = [];
let fullCalendarInstance = null;
let contatoreId = 0; // per generare id univoci e "sicuri" (solo lettere+numeri)

// Avvio al caricamento della pagina
window.addEventListener('DOMContentLoaded', () => {
  registraSW();
  calcolaEventiAstronomi();
  inizializzaUI();
});

// Helper: crea un evento con id sicuro e testo data formattato
function creaEvento({ titolo, dataObj, spiegazione, colore, programma }) {
  eventiCalcolati.push({
    id: `ev${contatoreId++}`,
    titolo,
    dataObj,
    dataTesto: formattData(dataObj),
    spiegazione,
    colore,
    programma
  });
}

// =====================================================================
// 1. Calcolo di TUTTI gli eventi tramite Astronomy Engine
//    Ogni categoria è isolata in un try/catch: se una fallisce,
//    le altre vengono comunque calcolate e la pagina non resta vuota.
// =====================================================================
function calcolaEventiAstronomi() {
  const oggi = new Date();
  // Calcoliamo per i prossimi 12 mesi (calendario navigabile e ricco)
  const limite = new Date();
  limite.setMonth(limite.getMonth() + 12);

  if (typeof Astronomy === 'undefined') {
    console.error('Libreria Astronomy Engine non caricata.');
    mostraErrore('Impossibile caricare la libreria astronomica. Controlla la connessione.');
    return;
  }

  const t0 = new Astronomy.AstroTime(oggi);

  aggiungiFasiLunari(t0, limite);
  aggiungiEclissiLunari(t0, limite);
  aggiungiEclissiSolari(t0, limite);
  aggiungiStagioni(oggi, limite);
  aggiungiSciamiMeteorici(oggi, limite);
  aggiungiElongazioni(oggi, limite);

  // Ordina temporalmente
  eventiCalcolati.sort((a, b) => a.dataObj - b.dataObj);

  const loading = document.getElementById('loading-msg');
  if (loading) {
    if (eventiCalcolati.length === 0) {
      loading.textContent = 'Nessun evento trovato nei prossimi 12 mesi.';
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
    for (let i = 0; i < 60; i++) {
      const dataFase = mq.time.date;
      if (dataFase > limite) break;
      const dati = info[mq.quarter];
      if (dati) {
        creaEvento({
          titolo: dati.titolo,
          dataObj: dataFase,
          spiegazione: dati.spiegazione,
          colore: dati.colore,
          programma: dati.programma
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
    for (let i = 0; i < 30; i++) {
      const dataPicco = ecl.peak.date; // BUGFIX: 'peak' è già un AstroTime
      if (dataPicco > limite) break;
      creaEvento({
        titolo: `Eclissi Lunare ${kindIt[ecl.kind] || ecl.kind}`,
        dataObj: dataPicco,
        spiegazione: 'La Terra proietta la sua ombra sulla Luna, oscurandola e, nelle eclissi totali, donandole un colore rossastro (“Luna di Sangue”).',
        colore: '#ef4444',
        programma: {
          cosaPortare: 'Occhi aperti e, se vuoi, una macchina fotografica con teleobiettivo.',
          doveVederlo: 'Ovunque la Luna sia visibile sopra l’orizzonte.',
          comeVederlo: 'Si guarda tranquillamente a occhio nudo, senza alcun filtro.'
        }
      });
      ecl = Astronomy.NextLunarEclipse(ecl); // richiede l'intero oggetto eclissi
    }
  } catch (err) {
    console.error('Errore eclissi lunari:', err);
  }
}

// --- Eclissi Solari (globali) ---
function aggiungiEclissiSolari(t0, limite) {
  try {
    const kindIt = { partial: 'Parziale', annular: 'Anulare', total: 'Totale', hybrid: 'Ibrida' };
    let ecl = Astronomy.SearchGlobalSolarEclipse(t0);
    for (let i = 0; i < 30; i++) {
      const dataPicco = ecl.peak.date;
      if (dataPicco > limite) break;
      creaEvento({
        titolo: `Eclissi Solare ${kindIt[ecl.kind] || ecl.kind}`,
        dataObj: dataPicco,
        spiegazione: 'La Luna passa davanti al Sole oscurandolo, del tutto o in parte. La fascia di visibilità cambia a seconda del punto della Terra.',
        colore: '#f97316',
        programma: {
          cosaPortare: 'OBBLIGATORI occhiali certificati per eclissi o un filtro solare: mai guardare il Sole a occhio nudo.',
          doveVederlo: 'Solo da alcune zone della Terra: verifica se la tua regione è nella fascia di visibilità.',
          comeVederlo: 'Usa esclusivamente filtri solari certificati o la proiezione con un foro stenopeico.'
        }
      });
      ecl = Astronomy.NextGlobalSolarEclipse(ecl);
    }
  } catch (err) {
    console.error('Errore eclissi solari:', err);
  }
}

// --- Equinozi e Solstizi ---
function aggiungiStagioni(oggi, limite) {
  try {
    const annoInizio = oggi.getFullYear();
    for (let anno = annoInizio; anno <= annoInizio + 1; anno++) {
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
    for (let anno = annoInizio; anno <= annoInizio + 1; anno++) {
      sciami.forEach(s => {
        // Picco tipico intorno alle 22:00 ora locale
        const d = new Date(anno, s.mese - 1, s.giorno, 22, 0, 0);
        if (d >= oggi && d <= limite) {
          creaEvento({
            titolo: `Sciame Meteorico: ${s.nome}`,
            dataObj: d,
            spiegazione: s.spiegazione || `Pioggia di stelle cadenti (${s.zhr} nelle condizioni migliori). Le meteore sembrano irradiarsi da un punto della volta celeste.`,
            colore: '#06b6d4',
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
      for (let i = 0; i < 8; i++) {
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
// 2. Inizializzazione Interfaccia (Griglia e Liste)
// =====================================================================
function inizializzaUI() {
  costruisciAgenda();
  inizializzaCalendario();
  gestisciTab();
}

function costruisciAgenda() {
  const container = document.getElementById('eventi-container');
  if (!container) return;
  container.innerHTML = '';

  if (eventiCalcolati.length === 0) {
    container.innerHTML = '<p class="text-center text-slate-400">Nessun evento da mostrare.</p>';
    return;
  }

  eventiCalcolati.forEach(evento => {
    const card = document.createElement('article');
    card.className = "bg-slate-800 p-6 rounded-2xl border border-slate-700 card-hover relative overflow-hidden";
    // Una piccola linea colorata a sinistra per il tipo di evento
    card.innerHTML = `
      <div class="absolute left-0 top-0 bottom-0 w-2" style="background-color: ${evento.colore}"></div>
      <div class="flex justify-between items-start mb-4 pl-4">
        <div>
          <h2 class="text-2xl font-bold text-white">${evento.titolo}</h2>
          <p class="text-blue-400 text-sm font-semibold mt-1">📅 ${evento.dataTesto}</p>
        </div>
        <button onclick="leggiEvento('${evento.id}')" class="p-3 bg-slate-700 hover:bg-slate-600 rounded-full transition-colors flex-shrink-0" title="Ascolta le info">
          🔊
        </button>
      </div>

      <div class="space-y-3 text-slate-300 pl-4">
        <p><strong>✨ Cosa succede:</strong> ${evento.spiegazione}</p>
        <div class="bg-slate-900 p-4 rounded-xl mt-4 text-sm border border-slate-700">
          <h3 class="font-bold text-white mb-2">🎒 Programma (Consigli)</h3>
          <ul class="space-y-2">
            <li><span class="text-blue-400">Portare:</span> ${evento.programma.cosaPortare}</li>
            <li><span class="text-blue-400">Dove:</span> ${evento.programma.doveVederlo}</li>
            <li><span class="text-blue-400">Come:</span> ${evento.programma.comeVederlo}</li>
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

  // Trasforma i nostri dati per FullCalendar
  const eventiPerGriglia = eventiCalcolati.map(e => ({
    id: e.id,
    title: e.titolo,
    start: e.dataObj,
    backgroundColor: e.colore,
    borderColor: e.colore,
    allDay: true
  }));

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
    events: eventiPerGriglia,
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
