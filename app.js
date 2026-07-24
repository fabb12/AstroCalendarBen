// Il nostro database locale di eventi calcolati al volo
let eventiCalcolati = [];
let fullCalendarInstance = null;

// Avvio al caricamento della pagina
window.addEventListener('DOMContentLoaded', () => {
  registraSW();
  calcolaEventiAstronomi();
  inizializzaUI();
});

// 1. Calcolo tramite Astronomy Engine
function calcolaEventiAstronomi() {
  const oggi = new Date();
  // Calcoliamo per i prossimi 6 mesi
  const limite = new Date();
  limite.setMonth(limite.getMonth() + 6);
  
  let dataAttuale = new Date(oggi);
  const timeAstroOggi = new Astronomy.AstroTime(oggi);

  // Trova le fasi lunari (0=Nuova, 1=Primo Quarto, 2=Piena, 3=Ultimo Quarto)
  let mq = Astronomy.SearchMoonQuarter(timeAstroOggi);
  
  // Trova le prossime 20 fasi lunari
  for (let i = 0; i < 20; i++) {
    const dataFase = mq.time.date;
    if (dataFase > limite) break;

    let titolo, spiegazione;
    if (mq.quarter === 0) {
      titolo = "Luna Nuova";
      spiegazione = "La Luna si trova tra la Terra e il Sole. La faccia rivolta verso di noi è in ombra, ottimo per osservare le stelle profonde.";
    } else if (mq.quarter === 2) {
      titolo = "Luna Piena";
      spiegazione = "La Terra si trova tra il Sole e la Luna. Il disco lunare è completamente illuminato.";
    }

    // Salviamo solo Lune piene e nuove
    if (mq.quarter === 0 || mq.quarter === 2) {
      eventiCalcolati.push({
        id: `fase-${i}`,
        titolo: titolo,
        dataObj: dataFase,
        dataTesto: formattData(dataFase),
        spiegazione: spiegazione,
        colore: mq.quarter === 2 ? '#eab308' : '#64748b', // Giallo per Piena, Grigio per Nuova
        programma: {
          cosaPortare: mq.quarter === 2 ? "Binocolo per i crateri lunari." : "Telescopio per galassie, essendo il cielo molto buio.",
          doveVederlo: "Dovunque, ma per la Luna Nuova vai lontano dalla città.",
          comeVederlo: mq.quarter === 2 ? "A occhio nudo la luce potrebbe essere intensa, un filtro lunare aiuta." : "Usa una mappa stellare per orientarti al buio."
        }
      });
    }
    mq = Astronomy.NextMoonQuarter(mq);
  }

  // Trova le Eclissi Lunari globali
  let eclissi = Astronomy.SearchLunarEclipse(timeAstroOggi);
  if (eclissi && eclissi.peak.time.date < limite) {
     eventiCalcolati.push({
        id: `eclissi-${eclissi.kind}`,
        titolo: `Eclissi Lunare (${eclissi.kind})`,
        dataObj: eclissi.peak.time.date,
        dataTesto: formattData(eclissi.peak.time.date),
        spiegazione: "La Terra proietta la sua ombra sulla Luna, oscurandola e donandole un colore rossastro.",
        colore: '#ef4444',
        programma: {
          cosaPortare: "Occhi aperti, macchina fotografica con teleobiettivo.",
          doveVederlo: "Basta che la Luna sia visibile sull'orizzonte.",
          comeVederlo: "Puoi guardarla tranquillamente a occhio nudo."
        }
      });
  }

  // Ordina temporalmente
  eventiCalcolati.sort((a, b) => a.dataObj - b.dataObj);
  document.getElementById('loading-msg').style.display = 'none';
}

function formattData(data) {
  return data.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' });
}

// 2. Inizializzazione Interfaccia (Griglia e Liste)
function inizializzaUI() {
  costruisciAgenda();
  inizializzaCalendario();
  gestisciTab();
}

function costruisciAgenda() {
  const container = document.getElementById('eventi-container');
  container.innerHTML = '';
  
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
    events: eventiPerGriglia,
    eventClick: function(info) {
      // Se clicco su un evento nel calendario, apro l'agenda e leggo il testo
      document.getElementById('btn-vista-agenda').click();
      setTimeout(() => {
        leggiEvento(info.event.id);
        const card = document.querySelector(`button[onclick="leggiEvento('${info.event.id}')"]`).parentElement.parentElement;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  });
  fullCalendarInstance.render();
}

// 3. Gestione Tab (Cambia vista)
function gestisciTab() {
  const btnCal = document.getElementById('btn-vista-calendario');
  const btnAg = document.getElementById('btn-vista-agenda');
  const viewCal = document.getElementById('vista-calendario');
  const viewAg = document.getElementById('vista-agenda');

  btnCal.addEventListener('click', () => {
    viewCal.classList.remove('hidden');
    viewAg.classList.add('hidden');
    
    // Aggiorna bottoni
    btnCal.className = "px-5 py-2 rounded-full font-semibold transition-colors bg-blue-600 hover:bg-blue-500 text-white shadow-lg";
    btnAg.className = "px-5 py-2 rounded-full font-semibold transition-colors bg-slate-700 hover:bg-slate-600 text-white";
    
    // Resize necessario per FullCalendar
    fullCalendarInstance.updateSize(); 
  });

  btnAg.addEventListener('click', () => {
    viewAg.classList.remove('hidden');
    viewCal.classList.add('hidden');
    
    btnAg.className = "px-5 py-2 rounded-full font-semibold transition-colors bg-blue-600 hover:bg-blue-500 text-white shadow-lg";
    btnCal.className = "px-5 py-2 rounded-full font-semibold transition-colors bg-slate-700 hover:bg-slate-600 text-white";
  });
}

// 4. Lettura Vocale (TTS)
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
  if(voceItaliana) sintesi.voice = voceItaliana;

  window.speechSynthesis.speak(sintesi);
};

// Carica le voci altrimenti a volte non vanno la prima volta
speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

// 5. Notifiche (Base)
document.getElementById('btn-notifiche').addEventListener('click', async () => {
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
