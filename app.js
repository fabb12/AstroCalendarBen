// Il nostro database locale di eventi calcolati al volo
let eventiCalcolati = [];
let fullCalendarInstance = null;
let contatoreId = 0; // per generare id univoci e "sicuri" (solo lettere+numeri)

// Dove finiscono gli eventi appena creati. Normalmente è la lista principale,
// ma durante il calcolo di un mese "a richiesta" si punta a una lista di
// appoggio, così i doppioni si possono scartare prima di mescolarli agli altri.
let destinazioneEventi = null;

// Il mese che si sta guardando (calendario e agenda vanno d'accordo).
// null = nessun mese scelto: l'agenda mostra tutti gli eventi in arrivo.
let meseSelezionato = null;

// I mesi già calcolati, per non rifare due volte lo stesso lavoro
const mesiCalcolati = new Set();

// Vero mentre siamo noi a spostare il calendario: evita che il suo evento
// "ho cambiato mese" ci rimandi indietro da dove siamo appena partiti
let calendarioInMovimento = false;

// Le "impronte" degli eventi già in lista: servono a non duplicare un evento
// che ricade in due finestre di calcolo diverse
const impronteEventi = new Set();

// Fin dove si può andare indietro e avanti nel tempo: vale per il selettore
// del mese e per la macchina del tempo del planetario, che sono due modi di
// dire la stessa cosa e non devono contraddirsi (scrivere il 2500 nel
// planetario e non poterlo aprire nel calendario è il genere di incoerenza
// che fa credere a un guasto).
//
// Il 1600 è l'inizio dell'astronomia col telescopio; il 3000 è il limite
// chiesto in avanti. Fuori da una fascia di due o tre secoli attorno a oggi
// le effemeridi di Astronomy Engine perdono precisione — di minuti, non di
// giorni — ma le posizioni restano quelle giuste per guardare il cielo, che è
// quello che serve qui.
const ANNO_MINIMO_NAVIGABILE = 1600;
const ANNO_MASSIMO_NAVIGABILE = 3000;

const NOMI_MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

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
// Al posto delle emoji: piccole icone a contorno (stile Lucide), una per ogni
// oggetto. Nessun riempimento: il tratto prende il colore del testo
// (currentColor), così l'icona resta leggibile ovunque venga usata e mantiene
// lo stesso peso visivo del resto dell'interfaccia.
// ---------------------------------------------------------------------------
const DISEGNI = {
  sole: `<circle cx="12" cy="12" r="4.2"/>
    <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/>`,

  luna: `<path d="M20.4 13.6A8.7 8.7 0 1 1 10.4 3.6a6.8 6.8 0 0 0 10 10z"/>`,

  lunapiena: `<circle cx="12" cy="12" r="8.4"/>
    <circle cx="9.4" cy="9.8" r="1.7"/><circle cx="14.6" cy="14.4" r="1.2"/>
    <circle cx="15.4" cy="9" r="0.8"/>`,

  mercurio: `<circle cx="12" cy="12" r="6.4"/>
    <circle cx="10.2" cy="10.6" r="1.3"/><circle cx="14" cy="13.8" r="0.9"/>`,

  venere: `<circle cx="12" cy="12" r="7.6"/>
    <path d="M7.2 9.8c3-0.9 5.8-0.9 8.6 0M6.4 13.8c3.4-1 6.8-1 10.2 0"/>`,

  marte: `<circle cx="12" cy="12" r="7.2"/>
    <path d="M6.6 8.8c3.4-1 6.8-1 10.2 0"/>
    <circle cx="10.2" cy="13.2" r="1.5"/><circle cx="14.6" cy="10.8" r="0.9"/>`,

  giove: `<circle cx="12" cy="12" r="8.2"/>
    <path d="M4.8 9.2c4.8-1 9.6-1 14.4 0M3.9 12.4h16.2M4.8 15.6c4.8 1 9.6 1 14.4 0"/>
    <ellipse cx="14.4" cy="15.4" rx="1.8" ry="1.1"/>`,

  saturno: `<circle cx="12" cy="12" r="5.8"/>
    <ellipse cx="12" cy="12" rx="10.2" ry="3.4" transform="rotate(-22 12 12)"/>`,

  urano: `<circle cx="12" cy="12" r="6.2"/>
    <ellipse cx="12" cy="12" rx="9.6" ry="3" transform="rotate(76 12 12)"/>`,

  nettuno: `<circle cx="12" cy="12" r="7.6"/>
    <path d="M5.4 14c2.2-1.8 4.4-1.8 6.6 0s4.4 1.8 6.6 0"/>
    <ellipse cx="10" cy="9.4" rx="1.8" ry="1.1"/>`,

  terra: `<circle cx="12" cy="12" r="8.2"/>
    <ellipse cx="12" cy="12" rx="3.6" ry="8.2"/>
    <path d="M3.9 12h16.2"/>`,

  stella: `<path d="M12 3.2l2.5 5.7 6.2.6-4.7 4.1 1.4 6.1L12 16.5l-5.4 3.2 1.4-6.1-4.7-4.1 6.2-.6z"/>`,

  meteora: `<path d="M16.6 3.6l1.3 3.1 3.4.3-2.6 2.2.8 3.3-2.9-1.8-2.9 1.8.8-3.3-2.6-2.2 3.4-.3z"/>
    <path d="M10.6 13.2L3.4 20.4M13.4 15.6l-4.2 4.4M6.8 11.8l-3.2 3.4"/>`,

  eclissi: `<circle cx="10.2" cy="12" r="6.4"/>
    <circle cx="14.8" cy="12" r="6.4"/>`,

  foglia: `<path d="M4.6 19.4c-1.6-6.8 3.4-13.2 15-15 1.4 11.4-6 16.6-15 15z"/>
    <path d="M5 19q6.2-5 12.4-11"/>`,

  congiunzione: `<circle cx="8.8" cy="13.4" r="4.6"/>
    <circle cx="16.2" cy="10.2" r="3.2"/>`,

  segnalino: `<path d="M12 21c4-4.4 6-7.8 6-10.4a6 6 0 1 0-12 0C6 13.2 8 16.6 12 21z"/>
    <circle cx="12" cy="10.4" r="2.2"/>`,

  satellite: `<rect x="9.4" y="9.4" width="5.2" height="5.2" rx="1.2"/>
    <rect x="2" y="10.2" width="5.6" height="3.6" rx="1"/>
    <rect x="16.4" y="10.2" width="5.6" height="3.6" rx="1"/>
    <path d="M12 9.4V6.4M12 6.4l-2-2M12 6.4l2-2M12 14.6v3"/>`,

  occhio: `<path d="M2.6 12S6.4 6.4 12 6.4 21.4 12 21.4 12 17.6 17.6 12 17.6 2.6 12 2.6 12z"/>
    <circle cx="12" cy="12" r="2.8"/>`,

  binocolo: `<rect x="4.4" y="5.6" width="4.8" height="7.6" rx="1.4"/>
    <rect x="14.8" y="5.6" width="4.8" height="7.6" rx="1.4"/>
    <circle cx="6.8" cy="16.6" r="3.4"/><circle cx="17.2" cy="16.6" r="3.4"/>
    <path d="M9.2 9.2h5.6"/>`,

  telescopio: `<rect x="3.6" y="8.8" width="13.6" height="4.2" rx="1.4" transform="rotate(-24 10.4 10.9)"/>
    <path d="M11.6 14.4L9.4 20.4M11.6 14.4l4.4 5.2M6.8 20.4h6"/>
    <circle cx="18.8" cy="6.4" r="1.4"/>`,

  fotocamera: `<rect x="2.8" y="7.2" width="18.4" height="12" rx="2.4"/>
    <path d="M8.6 7.2l1.6-2.4h3.6l1.6 2.4"/>
    <circle cx="12" cy="13.4" r="3.4"/>`,

  medaglia: `<path d="M8.4 2.8l3.2 5.8M15.6 2.8L12.4 8.6"/>
    <circle cx="12" cy="15.2" r="5.6"/>
    <path d="M12 12.4l1 2.1 2.3.2-1.7 1.5.5 2.2-2.1-1.2-2.1 1.2.5-2.2-1.7-1.5 2.3-.2z"/>`,

  bersaglio: `<circle cx="12" cy="12" r="8.4"/>
    <circle cx="12" cy="12" r="5"/>
    <circle cx="12" cy="12" r="1.8"/>`,

  nebulosa: `<path d="M4.8 13.8c-1.6-5.2 3.2-9.4 8.2-8.4 4.4 1 6.8 5.4 5 8.8-2 3.6-11.4 4.4-13.2-.4z"/>
    <circle cx="9.8" cy="11.4" r="1.3"/><circle cx="14.4" cy="13.2" r="0.9"/>`,

  quaderno: `<rect x="4.4" y="3.6" width="15.2" height="16.8" rx="2"/>
    <path d="M8.4 3.6v16.8M11.4 8.4h5.4M11.4 12h5.4M11.4 15.6h3.6"/>`,

  calendario: `<rect x="3.4" y="5.2" width="17.2" height="15.2" rx="2.4"/>
    <path d="M3.4 10h17.2M8.2 3.4v3.4M15.8 3.4v3.4"/>`,

  lista: `<path d="M9.2 6.8h11M9.2 12h11M9.2 17.2h11"/>
    <circle cx="4.8" cy="6.8" r="1.1"/><circle cx="4.8" cy="12" r="1.1"/><circle cx="4.8" cy="17.2" r="1.1"/>`,

  piu: `<path d="M12 5.4v13.2M5.4 12h13.2"/>`,

  campana: `<path d="M18 10.4a6 6 0 1 0-12 0c0 4.2-1.6 5.6-1.6 5.6h15.2S18 14.6 18 10.4z"/>
    <path d="M10.2 19.2a2.1 2.1 0 0 0 3.6 0"/>`,

  ingranaggio: `<circle cx="12" cy="12" r="3.1"/>
    <path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5"/>`,

  scarica: `<path d="M12 3.6v11.2M7.8 10.6L12 14.8l4.2-4.2"/>
    <path d="M4.6 17.4v1.6a1.4 1.4 0 0 0 1.4 1.4h12a1.4 1.4 0 0 0 1.4-1.4v-1.6"/>`
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
  // `color` accompagna lo sfondo: serve all'alone luminoso definito nel CSS
  return `<span class="punto-categoria" style="background:${colore};color:${colore};width:${dimensione}px;height:${dimensione}px"></span>`;
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

// =====================================================================
// 0. IL DISPOSITIVO
//    Lo schermo non decide solo l'aspetto: decide anche quanti dati ha
//    senso mettere davanti a chi guarda. Su un monitor da scrivania un
//    elenco di dodici voci si legge in un colpo d'occhio; sullo stesso
//    elenco, su un telefono, si scorre per mezzo minuto.
//
//    Qui teniamo un'unica verità — "telefono", "tablet" o "computer" —
//    la scriviamo su <html data-dispositivo="…"> perché il CSS possa
//    leggerla, e la usiamo per accorciare gli elenchi, cambiare le
//    opzioni del calendario e ridisegnare le tele.
//
//    I confini sono gli stessi del foglio di stile (style.css): se si
//    cambiano lì, vanno cambiati anche qui.
// =====================================================================

const PUNTI_ROTTURA = { tablet: 768, computer: 1180 };

// Un telefono girato di lato è largo quanto un tablet e alto la metà: 844x390
// invece di 390x844. Guardando la sola larghezza lo scambiavamo per un tablet
// e gli davamo l'impaginazione di uno schermo alto — elenchi lunghi, filtri
// tutti aperti, riquadri da mezzo schermo — su 390 pixel d'altezza. Sotto
// questa altezza, quindi, comanda il profilo "telefono" per quanto largo sia
// lo schermo. Il confine è lo stesso del foglio di stile.
const ALTEZZA_MINIMA_TABLET = 560;

// Icona di ogni sezione: serve alla barra in fondo sul telefono, dove
// un'etichetta da sola sarebbe troppo piccola per capirsi al volo
const ICONE_VISTE = {
  stasera:    'luna',
  calendario: 'calendario',
  agenda:     'lista',
  cielo:      'stella',
  telescopio: 'telescopio',
  diario:     'quaderno'
};

// La sezione mostrata in questo momento, per ridisegnarla se cambia lo schermo
let dispositivoAttuale = null;
let vistaAttuale = 'stasera';

function larghezzaSchermo() {
  return window.innerWidth || document.documentElement.clientWidth || 1024;
}

function altezzaSchermo() {
  return window.innerHeight || document.documentElement.clientHeight || 768;
}

// Si comanda col dito? Allora i bersagli devono essere grandi e certi
// effetti "al passaggio del mouse" non hanno senso
function aTocco() {
  return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

// Telefono girato di lato: schermo basso, più largo che alto, e si tocca.
// Il tocco fa da guardia — una finestra di browser schiacciata sul computer
// resta un computer, con il mouse non c'è nessun pollice da avvicinare.
function telefonoGirato() {
  const a = altezzaSchermo();
  return a <= ALTEZZA_MINIMA_TABLET && larghezzaSchermo() > a && aTocco();
}

function profiloDispositivo() {
  // L'altezza ha l'ultima parola: è quella che manca quando si gira il telefono
  if (telefonoGirato()) return 'telefono';
  const l = larghezzaSchermo();
  if (l < PUNTI_ROTTURA.tablet) return 'telefono';
  if (l < PUNTI_ROTTURA.computer) return 'tablet';
  return 'computer';
}

// Sceglie un valore diverso per ogni misura di schermo. Si legge come una
// frase: quanto(3, 6, 10) → tre sul telefono, sei sul tablet, dieci sul computer
function quanto(telefono, tablet, computer) {
  const p = dispositivoAttuale || profiloDispositivo();
  if (p === 'telefono') return telefono;
  if (p === 'tablet') return tablet;
  return computer;
}

// Le opzioni del calendario a griglia cambiano con lo spazio: sul telefono
// due eventi per casella e il resto sotto "+altri", sul monitor tutti
function opzioniCalendarioPerSchermo() {
  const telefono = (dispositivoAttuale || profiloDispositivo()) === 'telefono';
  return {
    dayMaxEvents: quanto(2, 3, 6),
    // Sul telefono la barra in cima si riduce all'osso: freccia, mese, freccia.
    // Per tornare a oggi c'è già "Mese corrente" nel selettore qui sopra.
    headerToolbar: telefono
      ? { left: 'prev', center: 'title', right: 'next' }
      : { left: 'prev,next today', center: 'title', right: '' },
    titleFormat: telefono
      ? { year: 'numeric', month: 'short' }
      : { year: 'numeric', month: 'long' }
  };
}

function adattaCalendario() {
  if (!fullCalendarInstance) return;
  const opzioni = opzioniCalendarioPerSchermo();
  // batchRendering evita un ridisegno per ogni singola opzione cambiata
  fullCalendarInstance.batchRendering(() => {
    Object.entries(opzioni).forEach(([chiave, valore]) => {
      fullCalendarInstance.setOption(chiave, valore);
    });
  });
  adattaAltezzaCalendario();
  fullCalendarInstance.updateSize();
}

// Sul computer il mese dovrebbe stare in una schermata sola. Il modo sbagliato
// di ottenerlo è imporre un'altezza alla griglia: FullCalendar, se non ci
// sta, nasconde le ultime settimane dentro a uno scorrimento suo, e un mese
// tagliato è peggio di una pagina da scorrere.
//
// Il modo giusto è il contrario: la griglia resta ad altezza naturale (non
// taglia mai niente) e sono le righe a crescere fin dove c'è spazio libero.
// Qui misuriamo quanto ne resta sotto ai comandi e lo dividiamo per le
// settimane da disegnare; il risultato va in una variabile CSS che il foglio
// di stile usa come altezza minima delle caselle. Se lo spazio non basta la
// variabile sparisce e ci si affida al valore del CSS: la pagina scorre,
// come sul telefono e sul tablet.
const ALTEZZA_RIGA_CALENDARIO_BASE = 96;   // il minimo previsto dal CSS

function adattaAltezzaCalendario() {
  if (!fullCalendarInstance) return;
  const griglia = document.getElementById('calendario-griglia');
  const vista = document.getElementById('vista-calendario');
  if (!griglia || !vista) return;

  const radice = document.documentElement;
  const rinuncia = () => radice.style.removeProperty('--altezza-riga-calendario');

  // A vista nascosta le misure valgono zero: si aspetta di essere a schermo
  if ((dispositivoAttuale || profiloDispositivo()) !== 'computer' || vista.classList.contains('hidden')) {
    rinuncia();
    return;
  }

  const cima = griglia.getBoundingClientRect().top + window.scrollY;
  // Sotto alla griglia restano i bordi interni di tutti i contenitori che la
  // avvolgono (la scheda, poi il corpo pagina). Se non li si toglie dal conto
  // avanza una striscia da scorrere fatta di solo vuoto.
  let respiroSotto = 0;
  for (let nodo = griglia.parentElement; nodo && nodo !== document.body; nodo = nodo.parentElement) {
    const stile = getComputedStyle(nodo);
    respiroSotto += (parseFloat(stile.paddingBottom) || 0) + (parseFloat(stile.marginBottom) || 0);
  }

  // Barra dei comandi e riga dei nomi dei giorni stanno dentro alla griglia:
  // lo spazio per le settimane è quello che avanza dopo di loro
  const misura = (sel, meno) => {
    const el = griglia.querySelector(sel);
    return el ? el.getBoundingClientRect().height : meno;
  };
  const righe = griglia.querySelectorAll('.fc-daygrid-body tr').length || 6;
  const spazio = window.innerHeight - cima - respiroSotto - 10
    - misura('.fc-toolbar', 52) - misura('.fc-col-header', 36);

  // I sei pixel tolti per riga sono i bordi delle caselle e gli arrotondamenti,
  // che si sommano all'altezza minima: senza questo margine il mese sborda di
  // poco e resta una barra di scorrimento buona a niente. Sbagliare per
  // difetto lascia un filo di vuoto in fondo, che non dà fastidio a nessuno.
  const perRiga = Math.floor(spazio / righe) - 6;
  if (perRiga > ALTEZZA_RIGA_CALENDARIO_BASE) {
    radice.style.setProperty('--altezza-riga-calendario', `${perRiga}px`);
  } else {
    rinuncia();
  }
}

// I filtri per categoria e strumento: sul telefono stanno chiusi dietro al
// tasto "Filtri", altrove sono sempre in vista
function adattaFiltri() {
  const pannello = document.getElementById('filtri-avanzati');
  const tasto = document.getElementById('btn-filtri');
  if (!pannello) return;
  if ((dispositivoAttuale || profiloDispositivo()) === 'telefono') {
    // Se non li ha aperti nessuno, sul telefono partono chiusi
    if (!pannello.dataset.apertoDaUtente) pannello.classList.add('filtri-chiusi');
  } else {
    pannello.classList.remove('filtri-chiusi');
  }
  if (tasto) aggiornaTastoFiltri();
}

function aggiornaTastoFiltri() {
  const pannello = document.getElementById('filtri-avanzati');
  const tasto = document.getElementById('btn-filtri');
  if (!pannello || !tasto) return;
  const chiuso = pannello.classList.contains('filtri-chiusi');
  tasto.setAttribute('aria-expanded', chiuso ? 'false' : 'true');
  tasto.title = chiuso ? 'Mostra i filtri per categoria e strumento' : 'Nascondi i filtri';
}

// Le istruzioni lunghe della bussola: aperte dove c'è spazio, ripiegate sul
// telefono. Appena qualcuno le apre o le chiude di persona, l'app smette di
// deciderlo al posto suo.
let istruzioniCieloDecisoDaUtente = false;
let istruzioniCieloInAggiornamento = false;

function adattaIstruzioniCielo() {
  const nota = document.getElementById('skymap-istruzioni');
  if (!nota || istruzioniCieloDecisoDaUtente) return;
  istruzioniCieloInAggiornamento = true;
  nota.open = (dispositivoAttuale || profiloDispositivo()) === 'computer';
  istruzioniCieloInAggiornamento = false;
}

function sorvegliaIstruzioniCielo() {
  const nota = document.getElementById('skymap-istruzioni');
  if (!nota) return;
  nota.addEventListener('toggle', () => {
    if (!istruzioniCieloInAggiornamento) istruzioniCieloDecisoDaUtente = true;
  });
}

// Quello che va rifatto quando si passa, per esempio, da verticale a
// orizzontale su un tablet: gli elenchi cambiano lunghezza e le tele misura
function ridisegnaPerDispositivo() {
  if (vistaAttuale === 'stasera') {
    costruisciStaseraProssimi();
    // I passaggi si riscrivono solo se i dati orbitali sono già arrivati:
    // altrimenti cancelleremmo il "Caricamento…" con un "non disponibile"
    if (Object.keys(satTle).length) mostraPassaggiSatelliti();
  }
  if (typeof sky === 'object' && sky.aperto) skyRidimensiona();
  if (typeof sim === 'object' && sim.aperto) simRidimensiona();
  // La mappa dell'eclissi cambia riquadro passando a due colonne: senza
  // questo Leaflet continuerebbe a disegnare sulla misura vecchia
  if (_mappaEclissi) _mappaEclissi.invalidateSize();
}

function applicaProfiloDispositivo(opzioni = {}) {
  const radice = document.documentElement;
  radice.dataset.tocco = aTocco() ? 'si' : 'no';

  const profilo = profiloDispositivo();
  if (!opzioni.forza && profilo === dispositivoAttuale) return;

  const precedente = dispositivoAttuale;
  dispositivoAttuale = profilo;
  radice.dataset.dispositivo = profilo;

  adattaFiltri();
  adattaIstruzioniCielo();
  adattaCalendario();
  // Al primo giro le viste non sono ancora costruite: ci pensa l'avvio
  if (precedente) ridisegnaPerDispositivo();
}

function inizializzaDispositivo() {
  sorvegliaIstruzioniCielo();
  applicaProfiloDispositivo({ forza: true });

  // Un solo ridisegno per fotogramma, anche mentre si trascina il bordo
  // della finestra: senza freno il ricalcolo partirebbe a ogni pixel
  let attesa = null;
  const suCambio = () => {
    if (attesa) cancelAnimationFrame(attesa);
    attesa = requestAnimationFrame(() => {
      attesa = null;
      applicaProfiloDispositivo();
      // L'altezza del calendario segue la finestra anche quando la fascia di
      // schermo non cambia: allargare o stringere di poco sposta comunque
      // quanto spazio resta sotto ai comandi
      adattaAltezzaCalendario();
      if (fullCalendarInstance) fullCalendarInstance.updateSize();
    });
  };
  window.addEventListener('resize', suCambio);

  // Girando lo schermo la fascia può restare la stessa (un telefono è un
  // telefono in tutt'e due i versi) ma le proporzioni si ribaltano: le tele,
  // gli elenchi e il calendario vanno rifatti comunque, quindi qui si forza.
  //
  // Due passate invece di una perché su iOS, al momento dell'avviso, la
  // finestra ha ancora le misure di prima: senza il ripasso a 300ms il cielo
  // resterebbe disegnato sulla forma vecchia. E poiché gli avvisi arrivano
  // quasi sempre in coppia (matchMedia e orientationchange), i timer già in
  // attesa si annullano: di ridisegni ne resta comunque uno.
  let giri = [];
  const suGiro = () => {
    giri.forEach(clearTimeout);
    const passata = () => {
      applicaProfiloDispositivo({ forza: true });
      adattaAltezzaCalendario();
      if (fullCalendarInstance) fullCalendarInstance.updateSize();
    };
    giri = [setTimeout(passata, 120), setTimeout(passata, 300)];
  };
  // matchMedia è la via che funziona ovunque, anche dove `orientationchange`
  // non arriva mai (schermi che ruotano senza avvisare, finestre affiancate)
  const versoSchermo = window.matchMedia && window.matchMedia('(orientation: portrait)');
  if (versoSchermo && versoSchermo.addEventListener) {
    versoSchermo.addEventListener('change', suGiro);
  } else if (versoSchermo && versoSchermo.addListener) {
    versoSchermo.addListener(suGiro);       // Safari fino alla 13
  }
  window.addEventListener('orientationchange', suGiro);
}

// Barra di navigazione: sul telefono diventa la fila di icone in fondo allo
// schermo, quindi ogni voce si porta dietro il suo disegno e la sua etichetta
function inizializzaNavigazione() {
  VISTE.forEach(v => {
    const btn = document.getElementById(v.btn);
    if (!btn) return;
    const testo = btn.textContent.trim();
    btn.innerHTML =
      `<span class="voce-menu-icona">${icona(ICONE_VISTE[v.nome] || 'stella', 20)}</span>` +
      `<span class="voce-menu-testo">${testo}</span>`;
  });

  // I tasti della testata: un disegno davanti al nome. Sotto i 1180px resta
  // il solo disegno (lo dice il CSS), quindi il nome va messo anche in
  // aria-label: altrimenti per un lettore di schermo il tasto sarebbe muto.
  document.querySelectorAll('.azioni-testata .azione-testata').forEach(btn => {
    const nome = btn.textContent.trim();
    if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', nome);
    btn.innerHTML =
      `<span class="azione-icona">${icona(btn.dataset.icona || 'stella', 18)}</span>` +
      `<span class="etichetta-lunga">${nome}</span>`;
  });
}

// Avvio al caricamento della pagina
window.addEventListener('DOMContentLoaded', () => {
  registraSW();
  inizializzaDispositivo();
  inizializzaNavigazione();
  calcolaEventiAstronomi();
  caricaEventiManuali();
  caricaDiario();
  inizializzaUI();
  inizializzaFormAggiungi();
  inizializzaMappaEclissiUI();
  inizializzaEclissiDiCasaUI();
  inizializzaMappaLunareUI();
  inizializzaSimulazione();
  inizializzaSkymap();
  inizializzaLezioneEclittica();
  inizializzaSistemaSolare();
  inizializzaNotifiche();
  inizializzaInstallazione();
  inizializzaDiarioUI();
  inizializzaImpostazioni();
  inizializzaPosizioneUI();
  inizializzaStasera();
  // La vista d'apertura è "Stasera": è la domanda che ci si fa davvero
  mostraVista('stasera');
  // Un link condiviso (?evento=…) porta direttamente sulla scheda giusta
  gestisciLinkCondiviso();
});

// Helper: crea un evento con id sicuro e testo data formattato
function creaEvento({ id, titolo, dataObj, spiegazione, colore, programma, manuale, linkMappa, categoria, eclissi, eclissiLunare, corpoCielo, simul, strumento, congiunzione }) {
  (destinazioneEventi || eventiCalcolati).push({
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
    // Le eclissi lunari hanno una mappa tutta loro: non c'è un'ombra che
    // corre sulla Terra, ma la metà di pianeta da cui la Luna è visibile
    eclissiLunare: eclissiLunare || null,
    // Corpo celeste protagonista dell'evento: apre il planetario puntato su di lui
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
// Calcola tutti gli eventi astronomici compresi fra due istanti qualsiasi —
// anche nel passato — e li restituisce in una lista a parte, senza toccare
// il calendario. È il motore usato sia all'avvio sia dal selettore del mese.
function calcolaEventiIntervallo(inizio, fine, opzioni = {}) {
  if (typeof Astronomy === 'undefined') return [];

  const raccolta = [];
  const precedente = destinazioneEventi;
  destinazioneEventi = raccolta;
  try {
    const t0 = new Astronomy.AstroTime(inizio);
    // Le eclissi possono avere un orizzonte più lontano di quello degli altri eventi
    const limiteEclissi = opzioni.limiteEclissi || fine;

    aggiungiFasiLunari(t0, fine);
    aggiungiEclissiLunari(t0, limiteEclissi);
    aggiungiEclissiSolari(t0, limiteEclissi);
    aggiungiStagioni(inizio, fine);
    aggiungiSciamiMeteorici(inizio, fine);
    aggiungiElongazioni(inizio, fine);
    aggiungiCongiunzioni(inizio, fine);
  } finally {
    destinazioneEventi = precedente;
  }
  return raccolta;
}

// L'impronta di un evento: stesso titolo nello stesso giorno = stesso evento.
// Le finestre di calcolo si sovrappongono e i raffinamenti numerici possono
// spostare un minimo di qualche minuto, quindi il giorno è la grana giusta.
function improntaEvento(ev) {
  const d = ev.dataObj;
  return `${ev.titolo}|${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Aggiunge al calendario gli eventi non ancora presenti, e riordina se serve
function inserisciEventi(lista) {
  let aggiunti = 0;
  lista.forEach(ev => {
    const impronta = improntaEvento(ev);
    if (impronteEventi.has(impronta)) return;
    impronteEventi.add(impronta);
    eventiCalcolati.push(ev);
    aggiunti++;
  });
  if (aggiunti) eventiCalcolati.sort((a, b) => a.dataObj - b.dataObj);
  return aggiunti;
}

// Chiave del mese nel formato "2027-03"
function chiaveMese(anno, mese) {
  return `${anno}-${String(mese + 1).padStart(2, '0')}`;
}

// Calcola (una volta sola) gli eventi di un mese preciso, passato o futuro.
// Restituisce quanti eventi nuovi sono entrati nel calendario.
function assicuraMese(anno, mese) {
  const chiave = chiaveMese(anno, mese);
  if (mesiCalcolati.has(chiave)) return 0;
  mesiCalcolati.add(chiave);

  // Un paio di giorni di margine ai bordi: le congiunzioni cercano un minimo
  // fra un campione e l'altro, e senza margine quelle a cavallo del mese
  // sfuggirebbero.
  const inizio = new Date(anno, mese, 1, 0, 0, 0);
  const fine = new Date(anno, mese + 1, 0, 23, 59, 59);
  const inizioMargine = new Date(inizio.getTime() - 2 * 86400000);
  const fineMargine = new Date(fine.getTime() + 2 * 86400000);

  return inserisciEventi(calcolaEventiIntervallo(inizioMargine, fineMargine));
}

// Come sopra, ma per un intervallo qualsiasi: calcola tutti i mesi che tocca
// (la griglia del calendario mostra anche code del mese prima e di quello dopo)
function assicuraIntervallo(inizio, fine) {
  let aggiunti = 0;
  const cursore = new Date(inizio.getFullYear(), inizio.getMonth(), 1);
  const ultimo = new Date(fine.getFullYear(), fine.getMonth(), 1);
  // Un limite di sicurezza: non si calcolano secoli in un colpo solo
  for (let i = 0; cursore <= ultimo && i < 36; i++) {
    aggiunti += assicuraMese(cursore.getFullYear(), cursore.getMonth());
    cursore.setMonth(cursore.getMonth() + 1);
  }
  return aggiunti;
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

  inserisciEventi(calcolaEventiIntervallo(oggi, limite, { limiteEclissi }));

  // Segniamo come già fatti i mesi che questa passata copre per intero.
  // Il mese in corso resta fuori: qui parte da oggi, e i giorni già passati
  // vanno ricalcolati se qualcuno torna a guardarli. Anche le congiunzioni
  // hanno un orizzonte più corto (CONG_ANNI), quindi ci fermiamo lì.
  const fineCoperta = new Date(Math.min(
    limite.getTime(),
    oggi.getTime() + CONG_ANNI * 365.25 * 86400000
  ));
  const cursore = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 1);
  while (new Date(cursore.getFullYear(), cursore.getMonth() + 1, 0) <= fineCoperta) {
    mesiCalcolati.add(chiaveMese(cursore.getFullYear(), cursore.getMonth()));
    cursore.setMonth(cursore.getMonth() + 1);
  }

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
          comeVederlo: 'Approfitta del cielo scuro della seconda parte della notte per il deep sky.'
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
        // Le semidurate danno i contatti senza cercarli: bastano sommate e
        // sottratte all'istante di massimo.
        eclissiLunare: {
          peakUt: ecl.peak.ut,
          kind: ecl.kind,
          sdPenum: ecl.sd_penum,
          sdPartial: ecl.sd_partial,
          sdTotal: ecl.sd_total,
          oscuramento: ecl.obscuration
        },
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
        // Non è più un collegamento nella scheda: resta solo come ripiego per
        // quando Leaflet non si carica e la mappa dell'ombra non si può aprire.
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
        // alla mappa: percorso, fasce e città vengono ricalcolati solo quando
        // serve. Anche le eclissi parziali hanno la loro mappa: non c'è una
        // fascia di totalità, ma la penombra attraversa comunque il pianeta.
        eclissi: {
          peakUt: ecl.peak.ut,
          kind: ecl.kind,
          tipo,
          lat: haCentro ? ecl.latitude : null,
          lon: haCentro ? ecl.longitude : null
        },
        // Dati per la simulazione: quanto Sole viene coperto al culmine e di
        // che tipo di eclissi si tratta (totale, anulare, parziale).
        simul: {
          scena: 'eclissiSolare',
          kind: ecl.kind,
          tipo,
          // Con il tempo di culmine la scena può ricostruire l'eclissi vera
          // vista dal luogo dell'utente, invece di accontentarsi di una
          // geometria plausibile dedotta dall'oscuramento.
          peakUt: ecl.peak.ut,
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
//   Tutto quello che compare sulla mappa nasce da una sola domanda,
//   ripetuta per tanti punti e tanti istanti: «da qui, adesso, quanta
//   parte del Sole nasconde la Luna?». Da quella risposta ricaviamo il
//   cono d'ombra (l'umbra, dove l'eclissi è totale o anulare), le fasce
//   di oscuramento parziale, il percorso completo sulla Terra e l'elenco
//   delle città che l'ombra sta attraversando in quel momento.
// =====================================================================
const UA_KM = 149597870.7;           // 1 unità astronomica in km
const RAGGIO_TERRA_KM = 6378.137;    // raggio equatoriale terrestre
const APPIATTIMENTO = 1 / 298.257223563;
const RAGGIO_TERRA_UA = RAGGIO_TERRA_KM / UA_KM;
const RAGGIO_SOLE_KM = 695700;
const RAGGIO_LUNA_KM = 1737.4;
const RAGGIO_SOLE_UA = RAGGIO_SOLE_KM / UA_KM;
const RAGGIO_LUNA_UA = RAGGIO_LUNA_KM / UA_KM;
const ECL_RAD = Math.PI / 180;
const ECL_F2 = (1 - APPIATTIMENTO) * (1 - APPIATTIMENTO);

// Le fasce di oscuramento disegnate attorno all'ombra: dal bordo esterno
// della penombra (dove il Sole è appena intaccato) fino al cuore scuro.
// Sono cerchi concentrici sovrapposti: più ci si avvicina all'asse, più
// il velo si fa fitto, esattamente come accade nella realtà.
// Qui stanno solo le soglie e i nomi: i colori dipendono dalla tavolozza,
// perché su una mappa chiara e su una scura non possono essere gli stessi.
const ECL_FASCE = [
  { soglia: 0.0015, etichetta: 'Sole appena intaccato' },
  { soglia: 0.25,   etichetta: 'almeno 1/4 coperto' },
  { soglia: 0.50,   etichetta: 'metà Sole coperto' },
  { soglia: 0.75,   etichetta: 'quasi tutto coperto' }
];

// Le soglie del terminatore, cioè della linea che separa il giorno dalla
// notte. Non è una riga sola: fra il tramonto e il buio vero passa quasi
// un'ora, e sulla carta quel passaggio si legge molto meglio come fascia
// sfumata che come un taglio netto.
//   −0,833° è il Sole con il bordo superiore appoggiato all'orizzonte:
//   un quarto di grado di raggio apparente più mezzo grado abbondante di
//   rifrazione. È il tramonto vero, quello che si vede dalla spiaggia.
// Un'eclissi si può guardare solo dalla parte illuminata, quindi questo velo
// dice a colpo d'occhio dove non ha senso nemmeno provare.
const ECL_NOTTE_SOGLIE = [
  { alt: -0.833, nome: 'Sole tramontato' },
  { alt: -6,     nome: 'crepuscolo civile finito' },
  { alt: -18,    nome: 'notte astronomica' }
];

// --- Le due tavolozze della mappa dell'eclissi ------------------------
//
// La mappa dell'ombra nasceva scura come tutto il resto dell'app: le tessere
// di OpenStreetMap venivano rovesciate in negativo dal foglio di stile. Bello
// da vedere, ma quella mappa serve a rispondere a una domanda geografica —
// «l'ombra passa sopra casa mia? quanto devo guidare per entrare nella
// fascia?» — e su un fondo in negativo i confini, le coste e i nomi delle
// città diventano illeggibili proprio mentre li si cerca. Adesso la mappa è
// chiara, quella vera di OpenStreetMap; il fondo scuro resta a disposizione
// di chi la guarda di notte con gli occhi abituati al buio, e si cambia con
// un tasto sotto al filmato.
//
// I colori non si limitano a invertirsi: su fondo chiaro i veli azzurri
// tenui sparirebbero e la linea centrale, quasi bianca, non si vedrebbe
// affatto. Ogni tema ha quindi la sua scala, con lo stesso significato:
// azzurro→viola per la penombra, ambra per la fascia centrale, ombra scura
// (o ambrata, se anulare) per il cono nell'istante mostrato.
const ECL_TAVOLOZZE = {
  chiara: {
    fasce: [
      { colore: '#0284c7', opacita: 0.14, bordo: 'rgba(2, 132, 199, 0.55)' },
      { colore: '#2563eb', opacita: 0.18, bordo: 'rgba(37, 99, 235, 0.60)' },
      { colore: '#4338ca', opacita: 0.24, bordo: 'rgba(67, 56, 202, 0.70)' },
      { colore: '#3b0764', opacita: 0.34, bordo: 'rgba(88, 28, 135, 0.85)' }
    ],
    parziale: { colore: '#0369a1', opacita: 0.13 },
    isocrona: { colore: '#075985', opacita: 0.45 },
    // La fascia centrale deve saltare all'occhio anche sopra ai veli azzurri
    // della penombra: sul chiaro l'ambra spento diventava un grigio fangoso
    totale: { colore: '#ea580c', opacita: 0.42 },
    centrale: '#7f1d1d',
    massimo: { bordo: '#7c2d12', dentro: '#ea580c' },
    umbra: { bordo: '#b91c1c', dentro: '#0b1020', opacita: 0.9 },
    umbraAnulare: { bordo: '#b45309', dentro: '#fbbf24', opacita: 0.65 },
    alone: '#dc2626',
    aloneAnulare: '#f59e0b',
    mirino: '#1f2937',
    citta: { bordo: 'rgba(15, 23, 42, 0.6)', bordoAttivo: '#0f172a' },
    osservatore: { bordo: '#0f172a', dentro: '#059669' },
    // Il velo della notte: tre strati dello stesso blu di fondo, uno sopra
    // l'altro. Sono tenui apposta — sotto ci sono coste e confini, e la
    // domanda della mappa resta geografica anche al buio.
    notte: { colore: '#0f172a', veli: [0.13, 0.10, 0.09], linea: '#1e293b' }
  },
  scura: {
    fasce: [
      { colore: '#7dd3fc', opacita: 0.09, bordo: 'rgba(125, 211, 252, 0.45)' },
      { colore: '#60a5fa', opacita: 0.11, bordo: 'rgba(96, 165, 250, 0.50)' },
      { colore: '#6366f1', opacita: 0.15, bordo: 'rgba(129, 140, 248, 0.60)' },
      { colore: '#4c1d95', opacita: 0.24, bordo: 'rgba(167, 139, 250, 0.75)' }
    ],
    parziale: { colore: '#38bdf8', opacita: 0.10 },
    isocrona: { colore: '#7dd3fc', opacita: 0.30 },
    totale: { colore: '#f59e0b', opacita: 0.34 },
    centrale: '#fff3d6',
    massimo: { bordo: '#fff3d6', dentro: '#f97316' },
    umbra: { bordo: '#ff5f5f', dentro: '#05070f', opacita: 0.92 },
    umbraAnulare: { bordo: '#fbbf24', dentro: '#2a1c05', opacita: 0.7 },
    alone: '#f87171',
    aloneAnulare: '#fbbf24',
    mirino: '#fff8e7',
    citta: { bordo: 'rgba(255, 255, 255, 0.55)', bordoAttivo: '#ffffff' },
    osservatore: { bordo: '#ffffff', dentro: '#34d399' },
    // Sul fondo scuro le tessere sono già in negativo: il velo deve pesare
    // meno, o la metà in ombra diventa una macchia nera in cui le coste
    // spariscono. Lì a raccontare il confine è soprattutto la linea, che
    // infatti si schiarisce.
    notte: { colore: '#000308', veli: [0.12, 0.09, 0.08], linea: '#bfdbfe' }
  }
};

// La mappa parte chiara: è quella che si legge senza pensarci.
let _eclTemaMappa = 'chiara';
function _eclTav() { return ECL_TAVOLOZZE[_eclTemaMappa] || ECL_TAVOLOZZE.chiara; }

// Un colore della tavolozza con la sua trasparenza. Serve ai campioni della
// legenda, che devono essere veli come quelli disegnati sulla mappa.
function _eclVelo(esa, alfa) {
  const n = parseInt(String(esa).replace('#', ''), 16);
  if (!isFinite(n)) return esa;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alfa)).toFixed(2)})`;
}

// Città di riferimento sparse su tutti i continenti: servono a dare un
// nome ai luoghi che il cono d'ombra attraversa, così il filmato non è
// solo una macchia che scorre sopra il mare.
// Formato compatto: [nome, paese, latitudine, longitudine].
const ECL_CITTA = [
  ['Roma', 'Italia', 41.90, 12.50], ['Milano', 'Italia', 45.46, 9.19],
  ['Napoli', 'Italia', 40.85, 14.27], ['Torino', 'Italia', 45.07, 7.69],
  ['Palermo', 'Italia', 38.12, 13.36], ['Genova', 'Italia', 44.41, 8.93],
  ['Bologna', 'Italia', 44.49, 11.34], ['Firenze', 'Italia', 43.77, 11.26],
  ['Bari', 'Italia', 41.12, 16.87], ['Catania', 'Italia', 37.50, 15.09],
  ['Venezia', 'Italia', 45.44, 12.32], ['Verona', 'Italia', 45.44, 10.99],
  ['Trieste', 'Italia', 45.65, 13.78], ['Cagliari', 'Italia', 39.22, 9.12],
  ['Perugia', 'Italia', 43.11, 12.39], ['Ancona', 'Italia', 43.62, 13.51],
  ['Pescara', 'Italia', 42.46, 14.21], ['Reggio Calabria', 'Italia', 38.11, 15.65],
  ['Trento', 'Italia', 46.07, 11.12], ['Bolzano', 'Italia', 46.50, 11.35],
  ['Aosta', 'Italia', 45.74, 7.32], ['Potenza', 'Italia', 40.64, 15.81],
  ['Campobasso', 'Italia', 41.56, 14.66], ["L'Aquila", 'Italia', 42.35, 13.40],
  ['Sassari', 'Italia', 40.73, 8.56], ['Messina', 'Italia', 38.19, 15.55],
  ['Lecce', 'Italia', 40.35, 18.17], ['Brescia', 'Italia', 45.54, 10.22],
  ['Padova', 'Italia', 45.41, 11.88], ['Salerno', 'Italia', 40.68, 14.77],

  ['Londra', 'Regno Unito', 51.51, -0.13], ['Edimburgo', 'Regno Unito', 55.95, -3.19],
  ['Dublino', 'Irlanda', 53.35, -6.26], ['Parigi', 'Francia', 48.86, 2.35],
  ['Lione', 'Francia', 45.76, 4.84], ['Marsiglia', 'Francia', 43.30, 5.37],
  ['Nizza', 'Francia', 43.70, 7.27], ['Madrid', 'Spagna', 40.42, -3.70],
  ['Barcellona', 'Spagna', 41.39, 2.17], ['Siviglia', 'Spagna', 37.39, -5.99],
  ['Lisbona', 'Portogallo', 38.72, -9.14], ['Porto', 'Portogallo', 41.15, -8.61],
  ['Berlino', 'Germania', 52.52, 13.40], ['Monaco di Baviera', 'Germania', 48.14, 11.58],
  ['Amburgo', 'Germania', 53.55, 9.99], ['Francoforte', 'Germania', 50.11, 8.68],
  ['Vienna', 'Austria', 48.21, 16.37], ['Zurigo', 'Svizzera', 47.38, 8.54],
  ['Ginevra', 'Svizzera', 46.20, 6.14], ['Amsterdam', 'Paesi Bassi', 52.37, 4.90],
  ['Bruxelles', 'Belgio', 50.85, 4.35], ['Copenaghen', 'Danimarca', 55.68, 12.57],
  ['Oslo', 'Norvegia', 59.91, 10.75], ['Tromsø', 'Norvegia', 69.65, 18.96],
  ['Stoccolma', 'Svezia', 59.33, 18.07], ['Helsinki', 'Finlandia', 60.17, 24.94],
  ['Reykjavík', 'Islanda', 64.15, -21.94], ['Longyearbyen', 'Svalbard', 78.22, 15.65],
  ['Varsavia', 'Polonia', 52.23, 21.01], ['Praga', 'Cechia', 50.08, 14.44],
  ['Budapest', 'Ungheria', 47.50, 19.04], ['Bucarest', 'Romania', 44.43, 26.10],
  ['Sofia', 'Bulgaria', 42.70, 23.32], ['Atene', 'Grecia', 37.98, 23.73],
  ['Istanbul', 'Turchia', 41.01, 28.98], ['Ankara', 'Turchia', 39.93, 32.86],
  ['Kiev', 'Ucraina', 50.45, 30.52], ['Mosca', 'Russia', 55.76, 37.62],
  ['San Pietroburgo', 'Russia', 59.94, 30.31], ['Murmansk', 'Russia', 68.97, 33.09],
  ['Belgrado', 'Serbia', 44.79, 20.45], ['Zagabria', 'Croazia', 45.81, 15.98],
  ['Lubiana', 'Slovenia', 46.06, 14.51], ['Sarajevo', 'Bosnia ed Erzegovina', 43.86, 18.41],
  ['Tirana', 'Albania', 41.33, 19.82], ['Skopje', 'Macedonia del Nord', 41.99, 21.43],
  ['Riga', 'Lettonia', 56.95, 24.11], ['Vilnius', 'Lituania', 54.69, 25.28],
  ['Tallinn', 'Estonia', 59.44, 24.75], ['Minsk', 'Bielorussia', 53.90, 27.57],
  ['La Valletta', 'Malta', 35.90, 14.51], ['Nicosia', 'Cipro', 35.17, 33.36],

  ['Il Cairo', 'Egitto', 30.04, 31.24], ['Alessandria', 'Egitto', 31.20, 29.92],
  ['Casablanca', 'Marocco', 33.57, -7.59], ['Rabat', 'Marocco', 34.02, -6.84],
  ['Marrakech', 'Marocco', 31.63, -8.01], ['Algeri', 'Algeria', 36.75, 3.06],
  ['Tunisi', 'Tunisia', 36.81, 10.18], ['Tripoli', 'Libia', 32.89, 13.19],
  ['Khartoum', 'Sudan', 15.50, 32.56], ['Addis Abeba', 'Etiopia', 9.03, 38.74],
  ['Nairobi', 'Kenya', -1.29, 36.82], ['Dar es Salaam', 'Tanzania', -6.79, 39.21],
  ['Kampala', 'Uganda', 0.35, 32.58], ['Kinshasa', 'RD del Congo', -4.44, 15.27],
  ['Lagos', 'Nigeria', 6.52, 3.38], ['Abuja', 'Nigeria', 9.06, 7.49],
  ['Accra', 'Ghana', 5.60, -0.19], ['Abidjan', "Costa d'Avorio", 5.36, -4.01],
  ['Dakar', 'Senegal', 14.72, -17.47], ['Bamako', 'Mali', 12.64, -8.00],
  ['Niamey', 'Niger', 13.51, 2.11], ["N'Djamena", 'Ciad', 12.11, 15.04],
  ['Nouakchott', 'Mauritania', 18.08, -15.98], ['Luanda', 'Angola', -8.84, 13.23],
  ['Lusaka', 'Zambia', -15.42, 28.28], ['Harare', 'Zimbabwe', -17.83, 31.05],
  ['Maputo', 'Mozambico', -25.97, 32.57], ['Johannesburg', 'Sudafrica', -26.20, 28.05],
  ['Città del Capo', 'Sudafrica', -33.92, 18.42], ['Windhoek', 'Namibia', -22.56, 17.08],
  ['Antananarivo', 'Madagascar', -18.88, 47.51], ['Mogadiscio', 'Somalia', 2.05, 45.34],

  ['Gerusalemme', 'Israele', 31.78, 35.22], ['Tel Aviv', 'Israele', 32.08, 34.78],
  ['Beirut', 'Libano', 33.89, 35.50], ['Damasco', 'Siria', 33.51, 36.29],
  ['Amman', 'Giordania', 31.95, 35.93], ['Baghdad', 'Iraq', 33.31, 44.36],
  ['Riad', 'Arabia Saudita', 24.71, 46.68], ['La Mecca', 'Arabia Saudita', 21.39, 39.86],
  ['Dubai', 'Emirati Arabi Uniti', 25.20, 55.27], ['Doha', 'Qatar', 25.29, 51.53],
  ['Kuwait City', 'Kuwait', 29.38, 47.99], ['Teheran', 'Iran', 35.69, 51.39],
  ['Baku', 'Azerbaigian', 40.41, 49.87], ['Tbilisi', 'Georgia', 41.72, 44.79],
  ['Yerevan', 'Armenia', 40.18, 44.51], ['Kabul', 'Afghanistan', 34.53, 69.17],
  ['Karachi', 'Pakistan', 24.86, 67.01], ['Lahore', 'Pakistan', 31.55, 74.34],
  ['Islamabad', 'Pakistan', 33.68, 73.05], ['Nuova Delhi', 'India', 28.61, 77.21],
  ['Mumbai', 'India', 19.08, 72.88], ['Calcutta', 'India', 22.57, 88.36],
  ['Chennai', 'India', 13.08, 80.27], ['Bangalore', 'India', 12.97, 77.59],
  ['Hyderabad', 'India', 17.39, 78.49], ['Colombo', 'Sri Lanka', 6.93, 79.86],
  ['Kathmandu', 'Nepal', 27.72, 85.32], ['Dhaka', 'Bangladesh', 23.81, 90.41],
  ['Yangon', 'Myanmar', 16.87, 96.20], ['Bangkok', 'Thailandia', 13.76, 100.50],
  ['Hanoi', 'Vietnam', 21.03, 105.85], ['Ho Chi Minh', 'Vietnam', 10.82, 106.63],
  ['Phnom Penh', 'Cambogia', 11.56, 104.92], ['Kuala Lumpur', 'Malaysia', 3.14, 101.69],
  ['Singapore', 'Singapore', 1.35, 103.82], ['Giacarta', 'Indonesia', -6.21, 106.85],
  ['Manila', 'Filippine', 14.60, 120.98], ['Hong Kong', 'Cina', 22.32, 114.17],
  ['Taipei', 'Taiwan', 25.03, 121.57], ['Shanghai', 'Cina', 31.23, 121.47],
  ['Pechino', 'Cina', 39.90, 116.41], ['Guangzhou', 'Cina', 23.13, 113.26],
  ['Chengdu', 'Cina', 30.57, 104.07], ["Xi'an", 'Cina', 34.34, 108.94],
  ['Ulaanbaatar', 'Mongolia', 47.89, 106.91], ['Seul', 'Corea del Sud', 37.57, 126.98],
  ['Tokyo', 'Giappone', 35.68, 139.69], ['Osaka', 'Giappone', 34.69, 135.50],
  ['Sapporo', 'Giappone', 43.06, 141.35], ['Almaty', 'Kazakistan', 43.24, 76.89],
  ['Tashkent', 'Uzbekistan', 41.30, 69.24], ['Novosibirsk', 'Russia', 55.03, 82.92],
  ['Vladivostok', 'Russia', 43.12, 131.89], ['Jakutsk', 'Russia', 62.03, 129.73],

  ['Anchorage', 'Stati Uniti', 61.22, -149.90], ['Vancouver', 'Canada', 49.28, -123.12],
  ['Calgary', 'Canada', 51.05, -114.07], ['Winnipeg', 'Canada', 49.90, -97.14],
  ['Toronto', 'Canada', 43.65, -79.38], ['Ottawa', 'Canada', 45.42, -75.70],
  ['Montréal', 'Canada', 45.50, -73.57], ['Halifax', 'Canada', 44.65, -63.58],
  ["St. John's", 'Canada', 47.56, -52.71], ['Iqaluit', 'Canada', 63.75, -68.52],
  ['Nuuk', 'Groenlandia', 64.18, -51.72], ['Seattle', 'Stati Uniti', 47.61, -122.33],
  ['Portland', 'Stati Uniti', 45.52, -122.68], ['San Francisco', 'Stati Uniti', 37.77, -122.42],
  ['Los Angeles', 'Stati Uniti', 34.05, -118.24], ['San Diego', 'Stati Uniti', 32.72, -117.16],
  ['Las Vegas', 'Stati Uniti', 36.17, -115.14], ['Phoenix', 'Stati Uniti', 33.45, -112.07],
  ['Denver', 'Stati Uniti', 39.74, -104.99], ['Salt Lake City', 'Stati Uniti', 40.76, -111.89],
  ['Dallas', 'Stati Uniti', 32.78, -96.80], ['Houston', 'Stati Uniti', 29.76, -95.37],
  ['Austin', 'Stati Uniti', 30.27, -97.74], ['Kansas City', 'Stati Uniti', 39.10, -94.58],
  ['Minneapolis', 'Stati Uniti', 44.98, -93.27], ['Chicago', 'Stati Uniti', 41.88, -87.63],
  ['Detroit', 'Stati Uniti', 42.33, -83.05], ['Indianapolis', 'Stati Uniti', 39.77, -86.16],
  ['St. Louis', 'Stati Uniti', 38.63, -90.20], ['Nashville', 'Stati Uniti', 36.16, -86.78],
  ['Atlanta', 'Stati Uniti', 33.75, -84.39], ['Miami', 'Stati Uniti', 25.76, -80.19],
  ['Orlando', 'Stati Uniti', 28.54, -81.38], ['Charlotte', 'Stati Uniti', 35.23, -80.84],
  ['Washington', 'Stati Uniti', 38.91, -77.04], ['Filadelfia', 'Stati Uniti', 39.95, -75.17],
  ['New York', 'Stati Uniti', 40.71, -74.01], ['Boston', 'Stati Uniti', 42.36, -71.06],
  ['Honolulu', 'Stati Uniti', 21.31, -157.86], ['Città del Messico', 'Messico', 19.43, -99.13],
  ['Guadalajara', 'Messico', 20.67, -103.35], ['Monterrey', 'Messico', 25.69, -100.32],
  ['Cancún', 'Messico', 21.16, -86.85], ['Città del Guatemala', 'Guatemala', 14.63, -90.51],
  ['San Salvador', 'El Salvador', 13.69, -89.22], ['Tegucigalpa', 'Honduras', 14.07, -87.19],
  ['Managua', 'Nicaragua', 12.11, -86.24], ['San José', 'Costa Rica', 9.93, -84.08],
  ['Panamá', 'Panamá', 8.98, -79.52], ["L'Avana", 'Cuba', 23.11, -82.37],
  ['Kingston', 'Giamaica', 17.97, -76.79], ['Santo Domingo', 'Rep. Dominicana', 18.49, -69.93],
  ['San Juan', 'Porto Rico', 18.47, -66.11], ['Bogotá', 'Colombia', 4.71, -74.07],
  ['Medellín', 'Colombia', 6.24, -75.58], ['Caracas', 'Venezuela', 10.48, -66.90],
  ['Quito', 'Ecuador', -0.18, -78.47], ['Guayaquil', 'Ecuador', -2.19, -79.89],
  ['Lima', 'Perù', -12.05, -77.04], ['La Paz', 'Bolivia', -16.50, -68.15],
  ['Santa Cruz', 'Bolivia', -17.78, -63.18], ['Asunción', 'Paraguay', -25.28, -57.63],
  ['Santiago', 'Cile', -33.45, -70.67], ['Punta Arenas', 'Cile', -53.16, -70.91],
  ['Buenos Aires', 'Argentina', -34.60, -58.38], ['Córdoba', 'Argentina', -31.42, -64.18],
  ['Mendoza', 'Argentina', -32.89, -68.84], ['Bariloche', 'Argentina', -41.13, -71.31],
  ['Ushuaia', 'Argentina', -54.80, -68.30], ['Montevideo', 'Uruguay', -34.90, -56.16],
  ['San Paolo', 'Brasile', -23.55, -46.63], ['Rio de Janeiro', 'Brasile', -22.91, -43.17],
  ['Brasília', 'Brasile', -15.79, -47.88], ['Salvador', 'Brasile', -12.97, -38.50],
  ['Recife', 'Brasile', -8.05, -34.88], ['Fortaleza', 'Brasile', -3.73, -38.53],
  ['Manaus', 'Brasile', -3.12, -60.02], ['Belém', 'Brasile', -1.46, -48.50],
  ['Porto Alegre', 'Brasile', -30.03, -51.23],

  ['Perth', 'Australia', -31.95, 115.86], ['Adelaide', 'Australia', -34.93, 138.60],
  ['Melbourne', 'Australia', -37.81, 144.96], ['Sydney', 'Australia', -33.87, 151.21],
  ['Brisbane', 'Australia', -27.47, 153.03], ['Cairns', 'Australia', -16.92, 145.77],
  ['Darwin', 'Australia', -12.46, 130.84], ['Hobart', 'Australia', -42.88, 147.33],
  ['Auckland', 'Nuova Zelanda', -36.85, 174.76], ['Wellington', 'Nuova Zelanda', -41.29, 174.78],
  ['Christchurch', 'Nuova Zelanda', -43.53, 172.64], ['Port Moresby', 'Papua Nuova Guinea', -9.44, 147.18],
  ['Suva', 'Figi', -18.14, 178.44], ['Nouméa', 'Nuova Caledonia', -22.28, 166.46],
  ['Papeete', 'Polinesia francese', -17.54, -149.57], ['Apia', 'Samoa', -13.83, -171.77],
  ['Hagåtña', 'Guam', 13.47, 144.75]
];

// --- Geometria di base ------------------------------------------------

// Sole e Luna in coordinate equatoriali della data, più il tempo siderale:
// sono gli unici ingredienti che servono a tutte le formule successive.
// Un istante viene ricalcolato una volta sola: durante il filmato la stessa
// posizione serve per centinaia di punti diversi.
let _eclCacheIstante = { ut: null, dati: null };
function _eclIstante(ut) {
  if (_eclCacheIstante.ut === ut) return _eclCacheIstante.dati;
  const time = Astronomy.MakeTime(ut);
  const rot = Astronomy.Rotation_EQJ_EQD(time); // dall'equatore J2000 a quello della data
  const m = Astronomy.RotateVector(rot, Astronomy.GeoMoon(time));
  // Il Sole va preso dove lo *vediamo*, con luce viaggiata e aberrazione:
  // sono una ventina di secondi d'arco, ma sul terreno spostano l'ombra di
  // una quarantina di chilometri.
  const s = Astronomy.RotateVector(rot, Astronomy.GeoVector(Astronomy.Body.Sun, time, true));
  const dati = {
    ut, time,
    m: [m.x, m.y, m.z],
    s: [s.x, s.y, s.z],
    gast: Astronomy.SiderealTime(time) * 15 // tempo siderale di Greenwich, in gradi
  };
  _eclCacheIstante = { ut, dati };
  return dati;
}

// Da vettore equatoriale-della-data a latitudine/longitudine geografiche.
function _eclVettoreALatLon(v, gast) {
  const r = Math.hypot(v[0], v[1], v[2]);
  const decl = Math.asin(Math.max(-1, Math.min(1, v[2] / r)));
  let lon = Math.atan2(v[1], v[0]) / ECL_RAD - gast;
  lon = ((lon % 360) + 540) % 360 - 180; // normalizza in [-180, 180]
  const lat = Math.atan(Math.tan(decl) / ECL_F2) / ECL_RAD; // geocentrica → geodetica
  return [lat, lon];
}

// Quanta parte del Sole è coperta, vista da un punto preciso della
// superficie terrestre in un dato istante. È il cuore di tutta la mappa.
//
// Con `dettaglio` restituisce anche come i due dischi sono messi in cielo:
// separazione, raggi apparenti e da che parte sta la Luna rispetto al Sole
// per chi lo sta guardando. Servono ai tempi di contatto e alla simulazione,
// ma non alla mappa — che chiama questa funzione centinaia di migliaia di
// volte per ogni eclissi, e quei conti in più li pagherebbe cari.
function _eclCircostanze(lat, lon, d, dettaglio) {
  const latR = lat * ECL_RAD;
  const thetaR = (lon + d.gast) * ECL_RAD;
  const cs = Math.cos(latR), sn = Math.sin(latR);
  const ct = Math.cos(thetaR), st = Math.sin(thetaR);
  // Posizione geocentrica del punto, tenendo conto dello schiacciamento
  const c = 1 / Math.sqrt(cs * cs + ECL_F2 * sn * sn);
  const rc = c * RAGGIO_TERRA_UA, rz = c * ECL_F2 * RAGGIO_TERRA_UA;
  const px = rc * cs * ct, py = rc * cs * st, pz = rz * sn;
  // Verticale locale (geodetica) e vettori topocentrici verso Sole e Luna
  const ux = cs * ct, uy = cs * st, uz = sn;
  const sx = d.s[0] - px, sy = d.s[1] - py, sz = d.s[2] - pz;
  const mx = d.m[0] - px, my = d.m[1] - py, mz = d.m[2] - pz;
  const ds = Math.hypot(sx, sy, sz);
  const dm = Math.hypot(mx, my, mz);

  const altSole = Math.asin(Math.max(-1, Math.min(1, (ux * sx + uy * sy + uz * sz) / ds))) / ECL_RAD;
  const rSole = Math.asin(RAGGIO_SOLE_UA / ds) / ECL_RAD;   // raggio apparente, in gradi
  const rLuna = Math.asin(RAGGIO_LUNA_UA / dm) / ECL_RAD;
  const cosSep = Math.max(-1, Math.min(1, (sx * mx + sy * my + sz * mz) / (ds * dm)));
  const sep = Math.acos(cosSep) / ECL_RAD;                  // distanza fra i due centri

  let osc = 0, tipo = 'nessuna';
  if (sep < rSole + rLuna) {
    if (sep <= Math.abs(rSole - rLuna)) {
      // Un disco è tutto dentro l'altro: totale se la Luna appare più grande
      tipo = rLuna >= rSole ? 'totale' : 'anulare';
      osc = rLuna >= rSole ? 1 : (rLuna * rLuna) / (rSole * rSole);
    } else {
      tipo = 'parziale';
      osc = simAreaIntersezione(rSole, rLuna, sep) / (Math.PI * rSole * rSole);
    }
  }
  // Sotto l'orizzonte l'eclissi c'è, ma da lì non la vede nessuno.
  const suOrizzonte = altSole > -0.6;
  const esito = {
    osc: suOrizzonte ? osc : 0,
    oscGeometrico: osc,
    tipo: suOrizzonte ? tipo : 'nessuna',
    tipoGeometrico: tipo,
    altSole,
    suOrizzonte
  };
  if (!dettaglio) return esito;

  esito.sep = sep;
  esito.rSole = rSole;
  esito.rLuna = rLuna;

  // Est e nord locali, per l'azimut del Sole. Ai poli "est" non esiste:
  // lì si lascia perdere l'azimut invece di dividere per zero.
  const orizz = Math.hypot(ux, uy);
  if (orizz > 1e-9) {
    const ex = -uy / orizz, ey = ux / orizz;         // est
    const nx = -uz * ey, ny = uz * ex, nz = ux * ey - uy * ex; // nord = û × ê
    const sux = sx / ds, suy = sy / ds, suz = sz / ds;
    esito.azSole = ((Math.atan2(sux * ex + suy * ey,
                                sux * nx + suy * ny + suz * nz) / ECL_RAD) + 360) % 360;
  } else {
    esito.azSole = null;
  }

  // Dove sta la Luna rispetto al Sole per chi lo guarda: si proietta tutto
  // sul piano del cielo perpendicolare alla direzione del Sole, con lo zenit
  // come "alto". Così la Luna morde il disco dal lato giusto anche quando il
  // Sole è basso e la scena va disegnata inclinata.
  const su = [sx / ds, sy / ds, sz / ds];
  const mu = [mx / dm, my / dm, mz / dm];
  const usu = ux * su[0] + uy * su[1] + uz * su[2];
  let alt = [ux - usu * su[0], uy - usu * su[1], uz - usu * su[2]];
  let na = Math.hypot(alt[0], alt[1], alt[2]);
  if (na < 1e-9) {
    // Sole allo zenit esatto: "alto" non è definito, si prende il nord celeste
    alt = [-su[2] * su[0], -su[2] * su[1], 1 - su[2] * su[2]];
    na = Math.hypot(alt[0], alt[1], alt[2]) || 1;
  }
  alt = [alt[0] / na, alt[1] / na, alt[2] / na];
  // destra dell'osservatore = direzione di sguardo × alto
  const des = [
    su[1] * alt[2] - su[2] * alt[1],
    su[2] * alt[0] - su[0] * alt[2],
    su[0] * alt[1] - su[1] * alt[0]
  ];
  const msu = mu[0] * su[0] + mu[1] * su[1] + mu[2] * su[2];
  const scarto = [mu[0] - msu * su[0], mu[1] - msu * su[1], mu[2] - msu * su[2]];
  const dxc = scarto[0] * des[0] + scarto[1] * des[1] + scarto[2] * des[2];
  const dyc = scarto[0] * alt[0] + scarto[1] * alt[1] + scarto[2] * alt[2];
  const nd = Math.hypot(dxc, dyc);
  // Versore che punta dal centro del Sole a quello della Luna, nel riquadro
  // dell'osservatore: x verso destra, y verso lo zenit.
  esito.versoX = nd > 1e-12 ? dxc / nd : 1;
  esito.versoY = nd > 1e-12 ? dyc / nd : 0;
  return esito;
}

// La Terra è schiacciata ai poli: allungando l'asse z di 1/(1−f) diventa
// una sfera, dove intersezioni e distanze si calcolano con due righe. Alla
// fine si torna indietro e il punto è di nuovo sull'ellissoide vero.
const ECL_SCHIACCIA = 1 / (1 - APPIATTIMENTO);

// Punto in cui l'asse del cono d'ombra buca la superficie terrestre
// (il centro dell'eclissi). null se in quell'istante l'asse manca la Terra.
function _eclPuntoAsse(d) {
  const mz = d.m[2] * ECL_SCHIACCIA, sz = d.s[2] * ECL_SCHIACCIA;
  let dx = d.m[0] - d.s[0], dy = d.m[1] - d.s[1], dz = mz - sz;
  const dl = Math.hypot(dx, dy, dz);
  dx /= dl; dy /= dl; dz /= dl;
  const md = d.m[0] * dx + d.m[1] * dy + mz * dz;
  const m2 = d.m[0] * d.m[0] + d.m[1] * d.m[1] + mz * mz;
  const disc = md * md - (m2 - RAGGIO_TERRA_UA * RAGGIO_TERRA_UA);
  if (disc < 0) return null; // l'asse passa accanto alla Terra: nessun centro
  const t = -md - Math.sqrt(disc); // intersezione più vicina (lato illuminato)
  return _eclVettoreALatLon(
    [d.m[0] + t * dx, d.m[1] + t * dy, (mz + t * dz) / ECL_SCHIACCIA], d.gast);
}

// Punto di massima eclissi: se l'asse tocca la Terra è quello; altrimenti
// è il punto della superficie che passa più vicino all'asse — quello da cui
// la Luna morde il Sole più profondamente (tipico delle eclissi parziali).
function _eclPuntoMassimo(d) {
  const asse = _eclPuntoAsse(d);
  if (asse) return asse;
  const mz = d.m[2] * ECL_SCHIACCIA, sz = d.s[2] * ECL_SCHIACCIA;
  let dx = d.m[0] - d.s[0], dy = d.m[1] - d.s[1], dz = mz - sz;
  const dl = Math.hypot(dx, dy, dz);
  dx /= dl; dy /= dl; dz /= dl;
  const t = -(d.m[0] * dx + d.m[1] * dy + mz * dz);
  return _eclVettoreALatLon(
    [d.m[0] + t * dx, d.m[1] + t * dy, (mz + t * dz) / ECL_SCHIACCIA], d.gast);
}

// Punto raggiunto partendo da (lat, lon) in una certa direzione e distanza.
// La longitudine NON viene normalizzata: la continuità serve a disegnare
// poligoni che scavalcano l'antimeridiano senza spezzarsi.
function _eclDestinazione(lat, lon, azimut, km) {
  const dist = km / RAGGIO_TERRA_KM;
  const f1 = lat * ECL_RAD, th = azimut * ECL_RAD;
  const sd = Math.sin(dist), cd = Math.cos(dist);
  const sf = Math.sin(f1), cf = Math.cos(f1);
  const sinF2 = Math.max(-1, Math.min(1, sf * cd + cf * sd * Math.cos(th)));
  const f2 = Math.asin(sinF2);
  const dLon = Math.atan2(Math.sin(th) * sd * cf, cd - sf * sinF2);
  return [f2 / ECL_RAD, lon + dLon / ECL_RAD];
}

// Distanza (km) e direzione iniziale (gradi) fra due punti.
function _eclDistanzaAzimut(a, b) {
  const f1 = a[0] * ECL_RAD, f2 = b[0] * ECL_RAD, dl = (b[1] - a[1]) * ECL_RAD;
  const sf1 = Math.sin(f1), cf1 = Math.cos(f1);
  const sf2 = Math.sin(f2), cf2 = Math.cos(f2);
  const cosD = Math.max(-1, Math.min(1, sf1 * sf2 + cf1 * cf2 * Math.cos(dl)));
  return {
    km: Math.acos(cosD) * RAGGIO_TERRA_KM,
    az: Math.atan2(Math.sin(dl) * cf2, cf1 * sf2 - sf1 * cf2 * Math.cos(dl)) / ECL_RAD
  };
}

const ECL_LAT_POLO = 89.9;

// Su una mappa la Terra si ripete all'infinito verso est e verso ovest, e una
// stessa longitudine si può scrivere in mille modi (10°, 370°, −350°…). Se due
// figure che devono sovrapporsi finiscono in due copie diverse del mondo, si
// staccano. Per evitarlo tutta la mappa di un'eclissi lavora attorno a un solo
// meridiano di riferimento: quello del punto di massima eclissi.
let _eclRifLon = 0;
function _eclInquadra(lon) {
  let l = lon;
  while (l - _eclRifLon > 180) l -= 360;
  while (l - _eclRifLon < -180) l += 360;
  return l;
}
function _eclInquadraPunto(p) {
  return p ? [p[0], _eclInquadra(p[1])] : p;
}

// Contorno chiuso della regione in cui vale una condizione: da ogni azimut
// si "cammina" verso l'esterno finché la condizione smette di essere vera.
// I punti tornano già srotolati e inquadrati, pronti da dare a Leaflet.
function _eclContorno(centro, dentro, maxKm, nAzimut, nPassi) {
  if (!dentro(centro[0], centro[1])) return null;
  // La penombra è spesso così larga da inghiottire un polo. Lì il giro per
  // azimut non funziona — i raggi scavalcano il polo e ricadono dall'altra
  // parte del mondo — e la regione va descritta come calotta.
  if (dentro(ECL_LAT_POLO, _eclRifLon)) return _eclCalotta(dentro, true, nAzimut * 2);
  if (dentro(-ECL_LAT_POLO, _eclRifLon)) return _eclCalotta(dentro, false, nAzimut * 2);

  const c = _eclInquadraPunto(centro);
  const punti = [];
  for (let i = 0; i < nAzimut; i++) {
    const az = (i * 360) / nAzimut;
    const estremo = _eclDestinazione(c[0], c[1], az, maxKm);
    if (dentro(estremo[0], estremo[1])) { punti.push(estremo); continue; }
    let basso = 0, alto = maxKm;
    for (let k = 0; k < nPassi; k++) {
      const mezzo = (basso + alto) / 2;
      const q = _eclDestinazione(c[0], c[1], az, mezzo);
      if (dentro(q[0], q[1])) basso = mezzo; else alto = mezzo;
    }
    punti.push(_eclDestinazione(c[0], c[1], az, basso));
  }
  return _eclSrotola(punti, c[1]);
}

// Regione che arriva fino a un polo: invece di girarle attorno, la si descrive
// meridiano per meridiano — per ogni longitudine, fin dove scende il bordo — e
// la si chiude lungo il bordo alto della carta. Il verso di percorrenza è lo
// stesso dei contorni normali, così più anelli sovrapposti si sommano invece
// di annullarsi.
function _eclCalotta(dentro, nord, nMeridiani) {
  const latPolo = nord ? ECL_LAT_POLO : -ECL_LAT_POLO;
  const verso = nord ? 1 : -1;
  // Si lavora in "distanza dal polo": theta = 0 al polo, 180 al polo opposto.
  const latDi = (theta) => verso * (90 - theta);
  const thetaPolo = 90 - ECL_LAT_POLO;

  // Il bordo, un giro di mondo. Attenzione: NON si può cercare per bisezione
  // fra il polo e l'altro emisfero. La penombra viene tagliata dalla linea del
  // giorno e della notte, e su certi meridiani lascia un secondo lembo staccato
  // più a sud: una bisezione ci cascherebbe dentro e il bordo salterebbe di
  // migliaia di km. Bisogna scendere dal polo e fermarsi alla prima uscita.
  const bordo = [];
  for (let i = 0; i <= nMeridiani; i++) {
    const lon = _eclRifLon - 180 + (360 * i) / nMeridiani;
    // Si parte sempre dal polo e si scende a passi corti: saltare avanti
    // "tanto il bordo cambia piano" farebbe finire dentro il lembo staccato e
    // il contorno schizzerebbe dall'altra parte del mondo.
    let dentroT = thetaPolo, fuoriT = thetaPolo + 2;
    while (fuoriT < 180 && dentro(latDi(fuoriT), lon)) { dentroT = fuoriT; fuoriT += 2; }
    for (let k = 0; k < 9; k++) {
      const mezzo = (dentroT + fuoriT) / 2;
      if (dentro(latDi(mezzo), lon)) dentroT = mezzo; else fuoriT = mezzo;
    }
    bordo.push([latDi(dentroT), lon]);
  }
  // La carta ripete il mondo a destra e a sinistra: la calotta viene ricopiata
  // nelle due copie vicine, così non si interrompe di netto ai bordi.
  // Il verso di percorrenza resta quello dei contorni normali (a nord da est a
  // ovest), altrimenti gli anelli sovrapposti si annullerebbero a vicenda.
  const punti = [];
  for (const giro of [1, 0, -1]) {
    const scarto = giro * 360;
    for (let i = 0; i <= nMeridiani; i++) {
      const b = bordo[nord ? nMeridiani - i : i];
      punti.push([b[0], b[1] + (nord ? scarto : -scarto)]);
    }
  }
  punti.push([latPolo, punti[punti.length - 1][1]], [latPolo, punti[0][1]]);
  return punti;
}

// Rende continue le longitudini di una spezzata: senza questo passaggio i
// poligoni che passano sopra l'antimeridiano attraversano tutta la mappa.
function _eclSrotola(punti, lonSeme) {
  const fuori = [];
  let prec = typeof lonSeme === 'number' ? lonSeme : null;
  for (const p of punti) {
    let lon = p[1];
    if (prec !== null) {
      while (lon - prec > 180) lon -= 360;
      while (lon - prec < -180) lon += 360;
    }
    fuori.push([p[0], lon]);
    prec = lon;
  }
  return fuori;
}

// Una calotta non si può disegnare come linea aperta: il tratto che risale al
// polo e torna indietro taglierebbe la carta da parte a parte. Per le isocrone
// si tolgono quei punti e si lascia il giro aperto.
function _eclLineaContorno(anello) {
  const conTappo = anello.some(p => Math.abs(p[0]) >= ECL_LAT_POLO - 0.05);
  return conTappo
    ? anello.filter(p => Math.abs(p[0]) < ECL_LAT_POLO - 0.05)
    : anello.concat([anello[0]]);
}

// --- Ricostruzione dell'intera eclissi -------------------------------

// Da quando a quando, rispetto al culmine, l'eclissi è visibile da
// qualche parte sulla Terra. Serve a tarare il cursore del tempo.
function _eclFinestraGlobale(peakUt) {
  let inizio = null, fine = null;
  for (let min = -340; min <= 340; min += 4) {
    const d = _eclIstante(peakUt + min / 1440);
    const p = _eclPuntoMassimo(d);
    if (!p) continue;
    if (_eclCircostanze(p[0], p[1], d).osc > 0.001) {
      if (inizio === null) inizio = min;
      fine = min;
    }
  }
  if (inizio === null) return { inizio: -150, fine: 150 };
  return { inizio: Math.floor(inizio) - 4, fine: Math.ceil(fine) + 4 };
}

// --- Le circostanze in un punto preciso: i tempi di contatto -----------
//
// La mappa risponde a "dove"; questi sono i numeri che uno si scrive sul
// palmo della mano prima di uscire: a che ora la Luna tocca il Sole, a che
// ora lo copre del tutto, quanto dura, a che ora finisce. Si trovano
// cercando gli istanti in cui la distanza fra i due dischi attraversa le
// soglie giuste — la somma dei raggi per l'inizio e la fine, la loro
// differenza per la fase centrale.
//
// Non si può partire da un campionamento grezzo: al bordo della fascia la
// totalità dura pochi secondi e qualunque passo ragionevole la salterebbe.
// Si parte invece dall'istante di massimo avvicinamento, che è sempre uno
// solo, e da lì si cercano i contatti verso l'esterno.

// Istante in cui una condizione diventa vera, fra un minuto in cui è falsa
// e uno in cui è vera. Diciotto dimezzamenti bastano a scendere sotto il
// secondo anche partendo da una finestra di sei ore.
function _eclQuandoDiventaVero(lat, lon, peakUt, minFalso, minVero, condizione) {
  let a = minFalso, b = minVero;
  for (let i = 0; i < 18; i++) {
    const m = (a + b) / 2;
    if (condizione(_eclCircostanze(lat, lon, _eclIstante(peakUt + m / 1440), true))) b = m;
    else a = m;
  }
  return (a + b) / 2;
}

// Minuto in cui una grandezza tocca il minimo, cercato per sezioni successive.
function _eclMinimoDi(lat, lon, peakUt, da, a, quanto) {
  let lo = da, hi = a;
  for (let i = 0; i < 22; i++) {
    const t1 = lo + (hi - lo) / 3, t2 = hi - (hi - lo) / 3;
    const v1 = quanto(_eclCircostanze(lat, lon, _eclIstante(peakUt + t1 / 1440), true));
    const v2 = quanto(_eclCircostanze(lat, lon, _eclIstante(peakUt + t2 / 1440), true));
    if (v1 < v2) hi = t2; else lo = t1;
  }
  return (lo + hi) / 2;
}

const ECL_CENTRALE = (c) => c.tipoGeometrico === 'totale' || c.tipoGeometrico === 'anulare';
const ECL_IN_CORSO = (c) => c.sep < c.rSole + c.rLuna;

// Un contatto, pronto da mostrare: quando, con che Sole in cielo.
function _eclContatto(lat, lon, peakUt, dataPicco, min) {
  const c = _eclCircostanze(lat, lon, _eclIstante(peakUt + min / 1440), true);
  return {
    min,
    data: new Date(dataPicco.getTime() + min * 60000),
    alt: c.altSole,
    az: c.azSole,
    osc: c.osc,
    suOrizzonte: c.suOrizzonte
  };
}

// Tutte le circostanze dell'eclissi viste da (lat, lon). null se da lì la
// Luna non sfiora nemmeno il Sole.
function _eclCircostanzeLocali(lat, lon, peakUt, finestra, dataPicco) {
  const passo = Math.max(2, (finestra.fine - finestra.inizio) / 120);

  // Primo giro grosso, solo per circondare il momento di massimo
  // avvicinamento: è uno solo in tutta la finestra, quindi basta trovarne
  // il campione più vicino.
  let minSep = Infinity, minAt = 0;
  let oscVisibile = 0, visibileAt = null;
  for (let min = finestra.inizio; min <= finestra.fine; min += passo) {
    const c = _eclCircostanze(lat, lon, _eclIstante(peakUt + min / 1440), true);
    if (c.sep < minSep) { minSep = c.sep; minAt = min; }
    if (c.suOrizzonte && c.osc > oscVisibile) { oscVisibile = c.osc; visibileAt = min; }
  }

  const tMax = _eclMinimoDi(lat, lon, peakUt, minAt - passo, minAt + passo, c => c.sep);
  const cMax = _eclCircostanze(lat, lon, _eclIstante(peakUt + tMax / 1440), true);
  if (cMax.sep >= cMax.rSole + cMax.rLuna) return null; // da qui non si vede nulla

  // I due estremi: si esce dall'eclissi camminando all'indietro e in avanti.
  // Dal punto di vista di un singolo luogo la fase parziale non supera mai
  // le tre ore e mezza, quindi duecento minuti per parte bastano sempre.
  let primaFuori = null, dopoFuori = null;
  for (let dt = passo; dt <= 220; dt += 10) {
    if (primaFuori === null &&
        !ECL_IN_CORSO(_eclCircostanze(lat, lon, _eclIstante(peakUt + (tMax - dt) / 1440), true))) {
      primaFuori = tMax - dt;
    }
    if (dopoFuori === null &&
        !ECL_IN_CORSO(_eclCircostanze(lat, lon, _eclIstante(peakUt + (tMax + dt) / 1440), true))) {
      dopoFuori = tMax + dt;
    }
    if (primaFuori !== null && dopoFuori !== null) break;
  }
  if (primaFuori === null) primaFuori = tMax - 230;
  if (dopoFuori === null) dopoFuori = tMax + 230;

  const c1 = _eclQuandoDiventaVero(lat, lon, peakUt, primaFuori, tMax, ECL_IN_CORSO);
  const c4 = _eclQuandoDiventaVero(lat, lon, peakUt, tMax, dopoFuori, c => !ECL_IN_CORSO(c));

  const centrale = ECL_CENTRALE(cMax);
  let c2 = null, c3 = null;
  if (centrale) {
    c2 = _eclQuandoDiventaVero(lat, lon, peakUt, c1, tMax, ECL_CENTRALE);
    c3 = _eclQuandoDiventaVero(lat, lon, peakUt, tMax, c4, c => !ECL_CENTRALE(c));
  }

  // Se al massimo il Sole è ancora (o già) sotto l'orizzonte, il momento
  // buono per guardare è un altro: il migliore fra quelli in cui il Sole
  // c'è davvero.
  let momentoMigliore = null;
  if (!cMax.suOrizzonte && visibileAt !== null) {
    const t = _eclMinimoDi(lat, lon, peakUt, visibileAt - passo, visibileAt + passo,
                           c => (c.suOrizzonte ? -c.osc : 1));
    momentoMigliore = _eclContatto(lat, lon, peakUt, dataPicco, t);
  }

  const fatto = (min) => _eclContatto(lat, lon, peakUt, dataPicco, min);
  return {
    lat, lon,
    tipo: cMax.tipoGeometrico,
    centrale,
    oscMax: cMax.oscGeometrico,
    // Quanto Sole si vede sparire davvero da qui: se al massimo il Sole è
    // sotto l'orizzonte, l'oscuramento geometrico racconta un'eclissi che
    // da questo punto nessuno vedrà. Col Sole che tramonta a eclissi in
    // corso l'oscuramento cambia in fretta, e il valore del giro grezzo
    // sbaglierebbe di qualche punto rispetto all'istante affinato: si usa
    // quello, cosi' il titolo e l'avviso sotto dicono lo stesso numero.
    oscVisibile: cMax.suOrizzonte ? cMax.osc
      : (momentoMigliore ? momentoMigliore.osc : oscVisibile),
    visibile: cMax.suOrizzonte || visibileAt !== null,
    suOrizzonteAlMassimo: cMax.suOrizzonte,
    c1: fatto(c1),
    c2: c2 !== null ? fatto(c2) : null,
    massimo: fatto(tMax),
    c3: c3 !== null ? fatto(c3) : null,
    c4: fatto(c4),
    durataCentraleSec: c2 !== null && c3 !== null ? (c3 - c2) * 60 : 0,
    durataParzialeMin: c4 - c1,
    momentoMigliore
  };
}

// --- Quanto manca alla fascia di totalità ------------------------------
//
// La domanda che si fa chiunque abiti vicino alla fascia e non dentro. Il
// salto fra il 99% e il 100% non è un punto percentuale: è la differenza fra
// un pomeriggio curioso e l'unica volta nella vita in cui si vede la corona
// solare. Vale la pena dire quanti chilometri costa, e in che direzione.
//
// Il test "sono dentro la fascia?" non rifà i conti astronomici: la fascia è
// già disegnata sulla mappa come insieme di ombre istantanee, e basta
// chiedersi se il punto cade dentro una di quelle.

function _eclDentroAnello(anello, lat, lon) {
  let dentro = false;
  for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
    const yi = anello[i][0], xi = anello[i][1];
    const yj = anello[j][0], xj = anello[j][1];
    if ((yi > lat) !== (yj > lat) &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

function _eclNellaFascia(lat, lon) {
  if (!_eclPercorso || !_eclPercorso.regioneTotale.length) return false;
  const l = _eclInquadra(lon);
  return _eclPercorso.regioneTotale.some(a => _eclDentroAnello(a, lat, l));
}

// Dove andare e quanto costa: il punto più vicino della linea centrale, il
// bordo più vicino della fascia, e quanto durerebbe la fase centrale se ci
// si spostasse fin lì.
function _eclConsiglioFascia(lat, lon, peakUt, finestra, dataPicco, circQui) {
  if (!_eclPercorso) return null;
  const linea = _eclPercorso.lineaCentrale;
  if (!linea || linea.length < 2) return null; // parziale ovunque: non c'è dove andare

  const qui = [lat, _eclInquadra(lon)];
  // Dentro o fuori lo dicono le circostanze calcolate, non il poligono
  // disegnato sulla mappa. La fascia disegnata nasce da ombre campionate a
  // istanti discreti e con un contorno a trenta azimut: sul filo del bordo
  // e' un pelo piu' stretta del vero, e li' rispondeva "niente totalita'" a
  // chi due riquadri piu' su leggeva "totalita': venti secondi".
  const dentro = circQui
    ? !!(circQui.centrale && circQui.suOrizzonteAlMassimo)
    : _eclNellaFascia(lat, lon);

  let centro = null;
  for (const p of linea) {
    const d = _eclDistanzaAzimut(qui, p);
    if (!centro || d.km < centro.km) centro = { punto: p, km: d.km, az: (d.az + 360) % 360 };
  }
  if (!centro) return null;

  // Sulla linea centrale la fase centrale dura al massimo: è il posto da
  // consigliare, non il primo lembo di fascia utile.
  const circCentro = _eclCircostanzeLocali(centro.punto[0], centro.punto[1],
                                           peakUt, finestra, dataPicco);
  centro.durataSec = circCentro ? circCentro.durataCentraleSec : 0;
  centro.nome = nomeLuogoVicino(centro.punto[0], _eclInquadra(centro.punto[1]), 120);

  // Il bordo più vicino: si cammina lungo la rotta verso la linea centrale
  // finché si entra nella fascia. Sono solo conti di geometria piana, quindi
  // si può cercare a tentoni senza pagare nulla.
  let bordo = null;
  if (!dentro && centro.km > 0.5) {
    let fuori = 0, entro = centro.km;
    for (let i = 0; i < 16; i++) {
      const m = (fuori + entro) / 2;
      const p = _eclDestinazione(lat, lon, centro.az, m);
      if (_eclNellaFascia(p[0], p[1])) entro = m; else fuori = m;
    }
    // Se la bisezione trova il bordo a ridosso dei piedi vuol dire che si è
    // proprio sul filo: il poligono e i conti la vedono diversamente, e
    // "spostati di 300 metri" non è un consiglio da dare a nessuno.
    if (entro > 1.5) {
      const p = _eclDestinazione(lat, lon, centro.az, entro);
      bordo = { km: entro, az: centro.az, punto: [p[0], _eclInquadra(p[1])] };
      bordo.nome = nomeLuogoVicino(bordo.punto[0], bordo.punto[1], 120);
    }
  }

  return { dentro, centro, bordo };
}

// Campiona il percorso dell'ombra e ne ricava le due regioni disegnate sulla
// mappa: la fascia di totalità e la zona di eclissi parziale.
//
// Il modo ingenuo — unire i bordi destro e sinistro dell'ombra lungo la rotta —
// si rompe appena il percorso sfiora un polo, perché "destra" e "sinistra" si
// scambiano di posto e la fascia si annoda. Qui invece si tengono i contorni
// interi, uno per istante, e si consegnano a Leaflet come un unico poligono a
// più anelli con riempimento "nonzero": sovrapponendosi si fondono nella
// macchia percorsa, senza cuciture e senza nodi. Perché non restino smerlature
// l'ombra viene campionata fitta, molto più stretta della propria larghezza.
function _eclCampionaPercorso(peakUt, finestra) {
  const durata = finestra.fine - finestra.inizio;
  const passo = Math.max(2, Math.round(durata / 90));

  // Tutto ruota attorno al meridiano del massimo: da qui in poi ogni punto
  // della mappa viene riportato nella copia di mondo che gli sta più vicino.
  const culmine = _eclPuntoMassimo(_eclIstante(peakUt));
  _eclRifLon = culmine ? culmine[1] : 0;

  const grezzi = [];
  for (let min = finestra.inizio; min <= finestra.fine; min += passo) {
    const d = _eclIstante(peakUt + min / 1440);
    const massimo = _eclInquadraPunto(_eclPuntoMassimo(d));
    if (!massimo) continue;
    grezzi.push({ min, d, massimo, asse: _eclInquadraPunto(_eclPuntoAsse(d)) });
  }

  const regioneParziale = [], isocrone = [];
  // Un'isocrona ogni tre quarti d'ora circa: abbastanza da leggere il verso
  // della corsa, non tante da impastare la mappa.
  const passoIsocrona = Math.max(1, Math.round(45 / passo));
  grezzi.forEach((g, i) => {
    const dentroParziale = (la, lo) => _eclCircostanze(la, lo, g.d).osc > 0.0015;
    const anello = _eclContorno(g.massimo, dentroParziale, 9000, 44, 10);
    if (anello) {
      regioneParziale.push(anello);
      // Quando la penombra ingoia un polo il suo bordo fa il giro del mondo:
      // come isocrona sarebbe solo una riga da un capo all'altro della carta,
      // quindi si tengono soltanto i cerchi veri e propri.
      const calotta = anello.some(p => Math.abs(p[0]) >= ECL_LAT_POLO - 0.05);
      if (!calotta && i % passoIsocrona === 0) isocrone.push({ min: g.min, anello });
    }
  });

  // L'ombra vera corre a più di mezzo chilometro al secondo ed è larga poche
  // centinaia di km: per una fascia dai bordi lisci serve un campione al minuto.
  const regioneTotale = [];
  const passoUmbra = Math.min(1, Math.max(0.4, durata / 320));
  for (let min = finestra.inizio; min <= finestra.fine; min += passoUmbra) {
    const d = _eclIstante(peakUt + min / 1440);
    const asse = _eclInquadraPunto(_eclPuntoAsse(d));
    if (!asse) continue;
    const dentroTotale = (la, lo) => {
      const c = _eclCircostanze(la, lo, d);
      return c.tipo === 'totale' || c.tipo === 'anulare';
    };
    const anello = _eclContorno(asse, dentroTotale, 2500, 30, 11);
    if (anello) regioneTotale.push(anello);
  }

  return {
    campioni: grezzi,
    // La rotta del punto di massima eclissi: c'è sempre, anche quando l'ombra
    // non tocca la Terra, ed è ciò su cui si inquadra la mappa.
    rottaMassimo: _eclSrotola(grezzi.map(g => g.massimo)),
    lineaCentrale: _eclSrotola(grezzi.filter(g => g.asse).map(g => g.asse)),
    regioneTotale,
    regioneParziale,
    isocrone
  };
}

// =====================================================================
// 1-ter. LA MAPPA: stato, disegno, filmato
// =====================================================================
let _mappaEclissi = null;
let _mappaStrati = [];                  // tracciati fissi (percorso, fasce)
// Gli stessi tracciati, ma per nome: cambiando tema della mappa vanno
// ricolorati uno per uno, senza ricostruire tutto (e senza perdere l'istante
// a cui è arrivato il filmato)
let _eclStratiFissi = { parziale: null, isocrone: [], totale: null, centrale: null, massimo: null };
let _eclissiEventoInCorso = null;
let _eclissiOffsetTempoMin = 0;
let _eclissiPosizioneTemporanea = null; // { lat, lon } se l'utente clicca sulla mappa
let _eclissiMarkerPosizione = null;
let _eclFinestra = { inizio: -180, fine: 180 };
let _eclPercorso = null;
let _eclDinamici = null;                // livelli ridisegnati a ogni fotogramma
let _eclCitta = [];                     // città che vedono questa eclissi
let _eclCittaMarker = [];
let _eclCittaEvidenziata = -1;
let _eclFilmato = { attivo: false, timer: null, velocita: 8, segui: true };
let _eclCacheOrari = { chiave: null, valore: null };
// Contatti e distanza dalla fascia costano qualche centinaio di posizioni di
// Sole e Luna: si calcolano quando l'osservatore si sposta, non a ogni
// fotogramma del filmato.
let _eclCacheLocale = { chiave: null, valore: null };

// Istante attualmente mostrato, nelle due forme che servono.
function _eclissiTempoSelezionato() {
  if (!_eclissiEventoInCorso) return new Date();
  return new Date(_eclissiEventoInCorso.dataObj.getTime() + _eclissiOffsetTempoMin * 60000);
}
function _eclUtSelezionato() {
  return _eclissiEventoInCorso.eclissi.peakUt + _eclissiOffsetTempoMin / 1440;
}
function _eclOra(data) {
  return data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
function _eclOraUTC(data) {
  return `${String(data.getUTCHours()).padStart(2, '0')}:${String(data.getUTCMinutes()).padStart(2, '0')}`;
}
// Percentuale di Sole coperto. Il 100% è riservato alla totalità vera:
// un 99,7% arrotondato a "100%" farebbe credere che il Sole sparisca, e
// nelle eclissi al limite della fascia è proprio la differenza che conta.
function _eclPerc(v) {
  if (v >= 0.9995) return '100%';
  if (v >= 0.995) return `${(v * 100).toFixed(1).replace('.', ',')}%`;
  return `${Math.round(v * 100)}%`;
}
// Come si chiama la fase centrale di questa eclissi
function _eclNomeCentrale(kind) {
  return kind === 'total' ? 'totalità' : kind === 'annular' ? 'anularità' : 'fase centrale';
}
// Un contatto si annota al secondo: al bordo della fascia la totalità può
// durarne una decina, e i minuti tondi non basterebbero a dire quando.
function _eclOraSec(data) {
  return data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
// Durata della fase centrale: sotto l'ora si legge meglio in minuti e secondi.
function _eclDurataSec(sec) {
  const s = Math.round(sec);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${String(s % 60).padStart(2, '0')} s`;
}
// Distanza da percorrere, arrotondata a quanto serve davvero saperla.
function _eclKm(km) {
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}
// Quanto manca, con la precisione che ha senso a quella distanza: gli anni
// per un'eclissi del 2070, i minuti per una di stasera.
function _eclQuantoManca(data) {
  const ms = data.getTime() - Date.now();
  if (ms <= 0) return 'in corso o appena passata';
  const minuti = ms / 60000, ore = minuti / 60, giorni = ore / 24;
  const mesiTesto = (n) => (n === 1 ? '1 mese' : `${n} mesi`);
  if (giorni >= 730) {
    const anni = Math.floor(giorni / 365.25);
    const mesi = Math.round((giorni - anni * 365.25) / 30.44);
    return mesi > 0 ? `fra ${anni} anni e ${mesiTesto(mesi)}` : `fra ${anni} anni`;
  }
  if (giorni >= 365) {
    const mesi = Math.round((giorni - 365.25) / 30.44);
    return mesi > 0 ? `fra un anno e ${mesiTesto(mesi)}` : 'fra un anno';
  }
  if (giorni >= 60) return `fra ${Math.round(giorni / 30.44)} mesi`;
  if (giorni >= 2) return `fra ${Math.round(giorni)} giorni`;
  if (ore >= 2) return `fra ${Math.floor(ore)}h ${String(Math.round(minuti % 60)).padStart(2, '0')}m`;
  if (minuti >= 2) return `fra ${Math.round(minuti)} minuti`;
  return 'fra pochi istanti';
}

// --- Disegno dei livelli mobili (il cono d'ombra vero e proprio) ------

// Crea una volta sola i poligoni che poi vengono solo rimodellati: durante
// il filmato aggiungere e togliere livelli a ogni fotogramma fa singhiozzare.
function _eclCreaDinamici() {
  if (_eclDinamici) return;
  const tav = _eclTav();

  // La notte è un fondale, non un velo da stendere sopra: sta in un riquadro
  // suo, fra le tessere e i tracciati dell'eclissi, che devono restare
  // leggibili qualunque cosa venga disegnata dopo.
  const veli = ECL_NOTTE_SOGLIE.map((s, i) => L.polygon([], {
    stroke: false, fillColor: tav.notte.colore, fillOpacity: tav.notte.veli[i],
    interactive: false, smoothFactor: 1.5, pane: 'ecl-notte', className: 'ecl-velo-notte'
  }).addTo(_mappaEclissi));

  const linea = L.polyline([], {
    color: tav.notte.linea, weight: 1.2, opacity: 0.8,
    interactive: false, smoothFactor: 1.5, pane: 'ecl-notte'
  }).addTo(_mappaEclissi);

  const fasce = ECL_FASCE.map((f, i) => L.polygon([], {
    color: tav.fasce[i].bordo, weight: 1,
    fillColor: tav.fasce[i].colore, fillOpacity: tav.fasce[i].opacita,
    interactive: false, smoothFactor: 1, className: 'ecl-fascia'
  }).addTo(_mappaEclissi));

  const alone = L.polygon([], {
    stroke: false, fillColor: tav.alone, fillOpacity: 0.18,
    interactive: false, smoothFactor: 1
  }).addTo(_mappaEclissi);

  const umbra = L.polygon([], {
    color: tav.umbra.bordo, weight: 2.5,
    fillColor: tav.umbra.dentro, fillOpacity: tav.umbra.opacita,
    interactive: false, smoothFactor: 1, className: 'ecl-umbra'
  }).addTo(_mappaEclissi);

  const mirino = L.circleMarker([0, 0], {
    radius: 3, color: tav.mirino, fillColor: tav.mirino, fillOpacity: 1,
    weight: 1, interactive: false
  }).addTo(_mappaEclissi);

  _eclDinamici = { fasce, alone, umbra, mirino, notte: { veli, linea } };
}

function _eclSvuotaDinamici() {
  if (!_eclDinamici) return;
  _eclDinamici.fasce.forEach(f => f.setLatLngs([]));
  _eclDinamici.alone.setLatLngs([]);
  _eclDinamici.umbra.setLatLngs([]);
  _eclDinamici.mirino.setStyle({ opacity: 0, fillOpacity: 0 });
  _eclSvuotaNotte();
}

// --- Il terminatore: dov'è giorno e dov'è notte in questo istante -------
//
// La penombra di un'eclissi è larga migliaia di chilometri e spesso arriva a
// lambire il bordo del mondo illuminato: là il Sole è intaccato, ma è già
// tramontato, e la mappa da sola non lo diceva. Chi guardava la macchia
// azzurra allungarsi sull'Atlantico non aveva modo di sapere che metà di
// quella macchia cadeva su un oceano in cui era notte.
//
// Da qui in poi la carta lo dice: un velo scuro sulla metà di Terra in ombra,
// con il suo bordo — il terminatore — disegnato sopra.

// La regione in cui il Sole sta più in basso di una certa altezza è una
// calotta: quella centrata sul punto antisolare, con raggio 90° + altezza.
// La si descrive meridiano per meridiano, perché su una carta di Mercatore è
// così che si disegna senza cuciture — per ogni longitudine, da che latitudine
// a che latitudine è buio.
//
// Il conto è la formula di sempre,
//     sin(alt) = sin(lat)·sin(δ) + cos(lat)·cos(δ)·cos(H),
// risolta però rispetto alla latitudine invece che rispetto all'altezza. Il
// membro di destra è R·cos(lat − ψ), con R = |(sin δ, cos δ·cos H)| e
// ψ = atan2(sin δ, cos δ·cos H): le due latitudini cercate sono ψ ± acos(sin alt / R),
// e fra loro sta il tratto buio. Nessuna bisezione, due arcotangenti a meridiano.
//
// Attenzione all'errore facile: non si può chiudere la fascia sul polo dando
// per scontato che il polo sia al buio. Al polo il Sole sta esattamente alla
// declinazione del giorno, quindi a marzo — con δ vicina a zero — il polo non
// è né in notte astronomica né in crepuscolo: la calotta non lo tocca e la
// fascia si chiude su sé stessa come una lente. Prendendo l'intervallo vero,
// tutti e due i casi vengono da soli.
function _eclFasciaDellaNotte(d, altGradi, nPunti) {
  const r = Math.hypot(d.s[0], d.s[1], d.s[2]) || 1;
  const ar = Math.atan2(d.s[1], d.s[0]) / ECL_RAD;              // ascensione retta, gradi
  const dec = Math.asin(Math.max(-1, Math.min(1, d.s[2] / r))); // declinazione, radianti
  const senoDec = Math.sin(dec), cosDec = Math.cos(dec);
  const senoAlt = Math.sin(altGradi * ECL_RAD);
  const bassa = [], alta = [], veroBassa = [], veroAlta = [];
  for (let i = 0; i <= nPunti; i++) {
    // Si gira tutto il mondo, ma restando nella copia di mappa dell'eclissi:
    // il velo deve combaciare con l'ombra, non finire un giro più in là.
    const lon = _eclRifLon - 180 + (360 * i) / nPunti;
    const angOrario = (lon + d.gast - ar) * ECL_RAD;
    const b = cosDec * Math.cos(angOrario);
    const raggio = Math.hypot(senoDec, b);
    const psi = raggio > 1e-12 ? Math.atan2(senoDec, b) / ECL_RAD : 180;
    // La latitudine in cui, su questo meridiano, il Sole tocca il fondo della
    // sua corsa: è lì che la fascia si stringe fino a sparire.
    let piuBuia = psi + 180;
    if (piuBuia > 180) piuBuia -= 360;
    piuBuia = Math.max(-ECL_LAT_POLO, Math.min(ECL_LAT_POLO, piuBuia));
    let da = piuBuia, a = piuBuia, veroDa = false, veroA = false;
    if (raggio > Math.abs(senoAlt)) {
      const scarto = Math.acos(Math.max(-1, Math.min(1, senoAlt / raggio))) / ECL_RAD;
      // L'arco buio va da ψ+scarto a ψ+360−scarto. È lungo meno di mezzo giro
      // (lo scarto supera sempre i 90°, perché l'altezza cercata è negativa),
      // quindi una sola delle sue copie può cadere sulla carta.
      for (const giro of [-1, 0, 1]) {
        const x = psi + scarto + giro * 360, y = psi + 360 - scarto + giro * 360;
        if (y <= -ECL_LAT_POLO || x >= ECL_LAT_POLO) continue;
        da = Math.max(-ECL_LAT_POLO, x);
        a = Math.min(ECL_LAT_POLO, y);
        // Un capo tosato dal bordo della carta non è il terminatore: è il
        // polo. Va nel poligono, ma non nella linea.
        veroDa = x > -ECL_LAT_POLO;
        veroA = y < ECL_LAT_POLO;
        break;
      }
    }
    bassa.push([da, lon]); veroBassa.push(veroDa);
    alta.push([a, lon]); veroAlta.push(veroA);
  }
  return { bassa, alta, veroBassa, veroAlta };
}

// La carta ripete il mondo a destra e a sinistra: il velo va ricopiato nelle
// due copie vicine, o trascinando la mappa la notte finirebbe di colpo.
// Ogni copia è un poligono a sé — anelli annidati sarebbero buchi.
function _eclAnelliNotte(fascia) {
  const anello = fascia.bassa.concat(fascia.alta.slice().reverse());
  return [-1, 0, 1].map(giro => [anello.map(p => [p[0], p[1] + giro * 360])]);
}

// Il bordo si disegna a pezzi: dove la fascia si appoggia al polo o si chiude
// su sé stessa non c'è nessun terminatore da mostrare, e una linea tirata
// dritta lì taglierebbe la carta da parte a parte.
function _eclSpezzaBordo(punti, validi, pezzi) {
  let corrente = [];
  punti.forEach((p, i) => {
    if (validi[i]) { corrente.push(p); return; }
    if (corrente.length > 1) pezzi.push(corrente);
    corrente = [];
  });
  if (corrente.length > 1) pezzi.push(corrente);
  return pezzi;
}

function _eclSvuotaNotte() {
  if (!_eclDinamici || !_eclDinamici.notte) return;
  _eclDinamici.notte.veli.forEach(v => v.setLatLngs([]));
  _eclDinamici.notte.linea.setLatLngs([]);
}

function _eclDisegnaNotte(d) {
  if (!_eclDinamici || !_eclDinamici.notte) return;
  if (!_eclMostraNotte) { _eclSvuotaNotte(); return; }
  // Durante il filmato si dimezzano i meridiani: il terminatore è una curva
  // dolce, e a cinque gradi di passo nessuno se ne accorge.
  const nPunti = _eclFilmato.attivo ? 72 : 144;
  ECL_NOTTE_SOGLIE.forEach((soglia, i) => {
    const fascia = _eclFasciaDellaNotte(d, soglia.alt, nPunti);
    _eclDinamici.notte.veli[i].setLatLngs(_eclAnelliNotte(fascia));
    // La linea si disegna solo sulla prima soglia: quella è il terminatore.
    if (i > 0) return;
    const pezzi = [];
    _eclSpezzaBordo(fascia.bassa, fascia.veroBassa, pezzi);
    _eclSpezzaBordo(fascia.alta, fascia.veroAlta, pezzi);
    const copie = [];
    for (const giro of [-1, 0, 1]) {
      for (const pezzo of pezzi) copie.push(pezzo.map(p => [p[0], p[1] + giro * 360]));
    }
    _eclDinamici.notte.linea.setLatLngs(copie);
  });
}

// Si può spegnere: chi studia la fascia di totalità sull'Atlantico a volte
// vuole la carta pulita, senza niente sopra alle coste.
let _eclMostraNotte = true;

function _eclAggiornaTastoNotte() {
  const tasto = document.getElementById('btn-eclissi-notte');
  if (!tasto) return;
  tasto.classList.toggle('attiva', _eclMostraNotte);
  tasto.setAttribute('aria-pressed', _eclMostraNotte ? 'true' : 'false');
  tasto.title = _eclMostraNotte
    ? 'Nascondi la linea del giorno e della notte'
    : 'Mostra dov\'è giorno e dov\'è notte: un\'eclissi si vede solo dalla parte illuminata';
}

window.eclissiAlternaNotte = () => {
  _eclMostraNotte = !_eclMostraNotte;
  _eclAggiornaTastoNotte();
  if (_eclissiEventoInCorso) {
    _eclissiAggiornaTutto();
    // La legenda spiega anche il velo: spento, quella voce non ha più oggetto
    _eclAggiornaLegenda(_eclissiEventoInCorso);
  }
};

// --- Il tema della mappa: chiara (di partenza) o scura ------------------

// Ricolora tutto quello che sta sopra le tessere. Non ricostruisce niente:
// il filmato può essere a metà corsa e ci resta.
function _eclApplicaTemaMappa() {
  const tav = _eclTav();
  const contenitore = document.getElementById('mappa-eclissi');
  if (contenitore) {
    contenitore.classList.toggle('mappa-chiara', _eclTemaMappa === 'chiara');
    contenitore.classList.toggle('mappa-scura', _eclTemaMappa !== 'chiara');
  }

  if (_eclStratiFissi.parziale) {
    _eclStratiFissi.parziale.setStyle({ fillColor: tav.parziale.colore, fillOpacity: tav.parziale.opacita });
  }
  _eclStratiFissi.isocrone.forEach(l =>
    l.setStyle({ color: tav.isocrona.colore, opacity: tav.isocrona.opacita }));
  if (_eclStratiFissi.totale) {
    _eclStratiFissi.totale.setStyle({ fillColor: tav.totale.colore, fillOpacity: tav.totale.opacita });
  }
  if (_eclStratiFissi.centrale) _eclStratiFissi.centrale.setStyle({ color: tav.centrale });
  if (_eclStratiFissi.massimo) {
    _eclStratiFissi.massimo.setStyle({ color: tav.massimo.bordo, fillColor: tav.massimo.dentro });
  }

  if (_eclDinamici) {
    _eclDinamici.fasce.forEach((f, i) => f.setStyle({
      color: tav.fasce[i].bordo, fillColor: tav.fasce[i].colore, fillOpacity: tav.fasce[i].opacita
    }));
    _eclDinamici.mirino.setStyle({ color: tav.mirino, fillColor: tav.mirino });
    _eclDinamici.notte.veli.forEach((v, i) =>
      v.setStyle({ fillColor: tav.notte.colore, fillOpacity: tav.notte.veli[i] }));
    _eclDinamici.notte.linea.setStyle({ color: tav.notte.linea });
    // Ombra e alone li ritinge _eclDisegnaOmbra, che sa se è totale o anulare
  }

  if (_eclissiMarkerPosizione) {
    _eclissiMarkerPosizione.setStyle({ color: tav.osservatore.bordo, fillColor: tav.osservatore.dentro });
  }
  // Le città sono decine di pallini con lo stesso stile: si ridisegnano
  if (_mappaEclissi && _eclCittaMarker.length) _eclDisegnaCitta();

  // Il tasto sta sull'angolo della mappa, quindi è un segno solo: la luna
  // porta al buio, il sole riporta alla mappa vera
  const tasto = document.getElementById('btn-eclissi-tema');
  if (tasto) {
    const chiara = _eclTemaMappa === 'chiara';
    tasto.textContent = chiara ? '☾' : '☀';
    tasto.title = chiara
      ? 'Passa al fondo scuro: di notte, con gli occhi abituati al buio, una mappa chiara abbaglia'
      : 'Torna alla mappa chiara: coste, confini e nomi delle città si leggono molto meglio';
    tasto.setAttribute('aria-label', chiara ? 'Mappa scura' : 'Mappa chiara');
  }
}

window.eclissiAlternaTemaMappa = () => {
  _eclTemaMappa = _eclTemaMappa === 'chiara' ? 'scura' : 'chiara';
  _eclApplicaTemaMappa();
  // L'ombra e la legenda si rifanno con i colori nuovi: una legenda che
  // spiega i colori di prima è peggio di nessuna legenda
  if (_eclissiEventoInCorso) {
    _eclissiAggiornaTutto();
    _eclAggiornaLegenda(_eclissiEventoInCorso);
  }
};

// Ridisegna ombra, penombra e fasce intermedie per l'istante selezionato.
// Restituisce il quadro d'insieme: dove cade il massimo e quanto vale.
function _eclDisegnaOmbra() {
  if (!_mappaEclissi || !_eclissiEventoInCorso) return null;
  _eclCreaDinamici();

  const d = _eclIstante(_eclUtSelezionato());
  // Il giorno e la notte ci sono anche quando l'ombra manca la Terra: il velo
  // si disegna prima, e non dipende da come è messa la Luna.
  _eclDisegnaNotte(d);
  const massimo = _eclInquadraPunto(_eclPuntoMassimo(d));
  const asse = _eclInquadraPunto(_eclPuntoAsse(d));
  const cMax = massimo ? _eclCircostanze(massimo[0], massimo[1], d) : null;

  // Con il filmato in corso si alleggerisce il calcolo: meno raggi, più fluidità
  const nAz = _eclFilmato.attivo ? 36 : 56;
  const nPassi = _eclFilmato.attivo ? 10 : 12;

  if (!massimo || !cMax || cMax.osc <= 0.0015) {
    _eclDinamici.fasce.forEach(f => f.setLatLngs([]));
    _eclDinamici.alone.setLatLngs([]);
    _eclDinamici.umbra.setLatLngs([]);
    _eclDinamici.mirino.setStyle({ opacity: 0, fillOpacity: 0 });
    return { d, massimo, cMax, asse: null, fuoriTerra: true };
  }

  // Fasce di oscuramento, dalla più larga alla più stretta
  ECL_FASCE.forEach((f, i) => {
    if (cMax.osc < f.soglia) { _eclDinamici.fasce[i].setLatLngs([]); return; }
    const dentro = (la, lo) => _eclCircostanze(la, lo, d).osc >= f.soglia;
    _eclDinamici.fasce[i].setLatLngs(_eclContorno(massimo, dentro, 9000, nAz, nPassi) || []);
  });

  // Il cono d'ombra: solo dove l'asse colpisce davvero la Terra
  if (asse) {
    const dentro = (la, lo) => {
      const c = _eclCircostanze(la, lo, d);
      return c.tipo === 'totale' || c.tipo === 'anulare';
    };
    const contorno = _eclContorno(asse, dentro, 2500, nAz, nPassi + 2);
    if (contorno) {
      _eclDinamici.umbra.setLatLngs(contorno);
      // Un alone morbido attorno all'ombra: la rende visibile anche quando la
      // mappa è lontana e il cono varrebbe due pixel. Se l'ombra arriva a
      // inglobare il polo il contorno è una calotta e gonfiarla non ha senso.
      const calotta = contorno.some(p => Math.abs(p[0]) >= ECL_LAT_POLO - 0.05);
      _eclDinamici.alone.setLatLngs(calotta ? [] : contorno.map(p => {
        const { km, az } = _eclDistanzaAzimut(asse, p);
        return _eclDestinazione(asse[0], asse[1], az, Math.max(km * 2.2, km + 90));
      }));
    } else {
      _eclDinamici.umbra.setLatLngs([]);
      _eclDinamici.alone.setLatLngs([]);
    }
    // L'ombra anulare non è nera: è un anello di luce, quindi cambia colore
    const anulare = cMax.tipo === 'anulare';
    const tav = _eclTav();
    const stile = anulare ? tav.umbraAnulare : tav.umbra;
    _eclDinamici.umbra.setStyle({
      color: stile.bordo, fillColor: stile.dentro, fillOpacity: stile.opacita
    });
    _eclDinamici.alone.setStyle({ fillColor: anulare ? tav.aloneAnulare : tav.alone });
  } else {
    _eclDinamici.umbra.setLatLngs([]);
    _eclDinamici.alone.setLatLngs([]);
  }

  _eclDinamici.mirino.setLatLng(massimo);
  _eclDinamici.mirino.setStyle({ opacity: 1, fillOpacity: 1 });

  return { d, massimo, cMax, asse, fuoriTerra: false };
}

// --- Le città toccate dall'ombra --------------------------------------

// Prima di aprire la mappa si guarda, città per città, quanto Sole verrà
// coperto e a che ora: è l'elenco che poi si anima durante il filmato.
function _eclPreparaCitta(peakUt, finestra) {
  const trovate = [];
  const passo = Math.max(2, Math.round((finestra.fine - finestra.inizio) / 90));
  const istanti = [];
  for (let min = finestra.inizio; min <= finestra.fine; min += passo) {
    istanti.push({ min, d: _eclIstante(peakUt + min / 1440) });
  }
  for (const [nome, paese, lat, lon] of ECL_CITTA) {
    let migliore = 0, minMigliore = 0, tipoMigliore = 'nessuna';
    for (const it of istanti) {
      const c = _eclCircostanze(lat, lon, it.d);
      if (c.osc > migliore) { migliore = c.osc; minMigliore = it.min; tipoMigliore = c.tipo; }
    }
    if (migliore <= 0.004) continue;
    // Affina l'istante di massimo attorno al campione migliore
    for (let dm = -passo; dm <= passo; dm += passo / 6) {
      const min = minMigliore + dm;
      if (min < finestra.inizio || min > finestra.fine) continue;
      const c = _eclCircostanze(lat, lon, _eclIstante(peakUt + min / 1440));
      if (c.osc > migliore) { migliore = c.osc; tipoMigliore = c.tipo; minMigliore = min; }
    }
    trovate.push({ nome, paese, lat, lon, oscMax: migliore, minMax: minMigliore, tipoMax: tipoMigliore });
  }
  trovate.sort((a, b) => b.oscMax - a.oscMax);
  return trovate;
}

// Colore di una città in base a quanto Sole le verrà coperto
function _eclColoreCitta(osc) {
  if (osc >= 0.999) return '#ff5f5f';
  if (osc >= 0.9) return '#fb923c';
  if (osc >= 0.6) return '#fbbf24';
  if (osc >= 0.3) return '#a78bfa';
  return '#7dd3fc';
}

function _eclDisegnaCitta() {
  _eclCittaMarker.forEach(m => _mappaEclissi.removeLayer(m));
  _eclCittaMarker = [];
  _eclCittaEvidenziata = -1;
  _eclCitta.forEach((c, i) => {
    const m = L.circleMarker([c.lat, _eclInquadra(c.lon)], {
      radius: c.oscMax >= 0.98 ? 5 : 3.5,
      color: _eclTav().citta.bordo,
      weight: 1,
      fillColor: _eclColoreCitta(c.oscMax),
      fillOpacity: 0.9,
      className: 'ecl-citta-punto'
    }).addTo(_mappaEclissi);
    m.bindTooltip(`${c.nome} — max ${_eclPerc(c.oscMax)}`, { direction: 'top', offset: [0, -4] });
    m.on('click', () => {
      _eclissiPosizioneTemporanea = { lat: c.lat, lon: c.lon };
      _eclissiAggiornaTutto();
    });
    _eclCittaMarker.push(m);
  });
}

// Aggiorna il pannello delle città per l'istante mostrato e mette in
// evidenza, sulla mappa, quella che in questo momento è più in ombra.
function _eclAggiornaPannelloCitta(quadro) {
  const lista = document.getElementById('eclissi-citta-lista');
  const testa = document.getElementById('eclissi-citta-ora');
  const conteggio = document.getElementById('eclissi-citta-conteggio');
  const hud = document.getElementById('eclissi-hud-citta');
  if (!lista || !testa) return;

  const d = quadro.d;
  const attive = [];
  _eclCitta.forEach((c, i) => {
    const circ = _eclCircostanze(c.lat, c.lon, d);
    if (circ.osc > 0.005) attive.push({ c, i, osc: circ.osc, tipo: circ.tipo, alt: circ.altSole });
  });
  attive.sort((a, b) => b.osc - a.osc);

  // La città più in ombra viene segnata sulla mappa con una targhetta fissa:
  // è il modo più diretto per dire «l'ombra è qui, adesso».
  const nuovoIndice = attive.length ? attive[0].i : -1;
  if (nuovoIndice !== _eclCittaEvidenziata) {
    const vecchioMarker = _eclCittaMarker[_eclCittaEvidenziata];
    if (vecchioMarker) {
      const vecchia = _eclCitta[_eclCittaEvidenziata];
      vecchioMarker.setStyle({
        radius: vecchia.oscMax >= 0.98 ? 5 : 3.5,
        color: _eclTav().citta.bordo, weight: 1, fillOpacity: 0.9
      });
      vecchioMarker.unbindTooltip().bindTooltip(
        `${vecchia.nome} — max ${_eclPerc(vecchia.oscMax)}`, { direction: 'top', offset: [0, -4] });
    }
    const nuovoMarker = _eclCittaMarker[nuovoIndice];
    if (nuovoMarker) {
      nuovoMarker.setStyle({ radius: 8, color: _eclTav().citta.bordoAttivo, weight: 2.5, fillOpacity: 1 });
      nuovoMarker.unbindTooltip().bindTooltip('', {
        direction: 'top', offset: [0, -9], permanent: true, className: 'ecl-tooltip-attiva'
      }).openTooltip();
      nuovoMarker.bringToFront();
    }
    _eclCittaEvidenziata = nuovoIndice;
  }
  // Il valore cambia a ogni fotogramma: si riscrive solo il testo
  if (nuovoIndice >= 0 && _eclCittaMarker[nuovoIndice]) {
    const t = attive[0];
    const marchio = t.tipo === 'totale' ? ' · TOTALE' : t.tipo === 'anulare' ? ' · ANULARE' : '';
    _eclCittaMarker[nuovoIndice].setTooltipContent(`<b>${t.c.nome}</b> · ${_eclPerc(t.osc)}${marchio}`);
  }

  if (conteggio) {
    conteggio.textContent = attive.length
      ? `${attive.length} ${attive.length === 1 ? 'città raggiunta' : 'città raggiunte'} in questo istante`
      : 'nessuna città raggiunta in questo istante';
  }

  if (!attive.length) {
    // Nessuna città sotto l'ombra: si dice quale sarà la prossima
    const prossima = _eclCitta
      .filter(c => c.minMax > _eclissiOffsetTempoMin)
      .sort((a, b) => a.minMax - b.minMax)[0];
    if (prossima) {
      const oraP = new Date(_eclissiEventoInCorso.dataObj.getTime() + prossima.minMax * 60000);
      testa.innerHTML = `<span class="ecl-citta-vuoto">L'ombra non ha ancora raggiunto nessuna delle città in elenco.` +
        ` La prossima sarà <b>${prossima.nome}</b> (${prossima.paese}) alle ${_eclOra(oraP)}, con ${_eclPerc(prossima.oscMax)} di Sole coperto.</span>`;
    } else {
      testa.innerHTML = `<span class="ecl-citta-vuoto">In questo istante l'eclissi non è visibile da nessuna delle città in elenco.</span>`;
    }
    lista.innerHTML = '';
    if (hud) hud.classList.add('hidden');
    return;
  }

  const p = attive[0];
  const centrale = p.tipo === 'totale' || p.tipo === 'anulare';
  testa.innerHTML = `
    <div class="ecl-citta-primo ${centrale ? 'centrale' : ''}">
      <div class="ecl-citta-primo-testa">
        <span class="ecl-citta-primo-nome">${p.c.nome}</span>
        <span class="ecl-citta-primo-paese">${p.c.paese}</span>
        ${centrale ? `<span class="ecl-badge-totale">${p.tipo === 'anulare' ? 'ANULARE' : 'TOTALE'}</span>` : ''}
      </div>
      <div class="ecl-barra"><span style="width:${(p.osc * 100).toFixed(1)}%"></span></div>
      <div class="ecl-citta-primo-dati">
        <b>${_eclPerc(p.osc)}</b> di Sole coperto · Sole a ${p.alt.toFixed(0)}° sull'orizzonte
      </div>
    </div>`;

  lista.innerHTML = attive.slice(1, 9).map(a => `
    <li class="ecl-citta-riga" data-citta="${a.i}" title="Porta qui l'osservatore">
      <span class="ecl-citta-nome">${a.c.nome}<span class="ecl-citta-paese">${a.c.paese}</span></span>
      <span class="ecl-barra piccola"><span style="width:${(a.osc * 100).toFixed(1)}%"></span></span>
      <span class="ecl-citta-perc${a.tipo === 'totale' || a.tipo === 'anulare' ? ' totale' : ''}">${_eclPerc(a.osc)}</span>
    </li>`).join('');

  if (hud) {
    hud.classList.remove('hidden');
    hud.innerHTML = `<span class="ecl-hud-pallino"></span>` +
      `<span>L'ombra è su <b>${p.c.nome}</b> — ${_eclPerc(p.osc)}` +
      `${centrale ? (p.tipo === 'anulare' ? ' · anulare' : ' · totale') : ''}</span>`;
  }
}

// --- Dati per il luogo scelto -----------------------------------------

function _eclissiAggiornaDatiLocali(quadro) {
  const testoLuogo = document.getElementById('eclissi-luogo-testo');
  const datiLocaliEl = document.getElementById('eclissi-dati-locali');
  if (!testoLuogo || !datiLocaliEl || !_eclissiEventoInCorso) return;

  let lat, lon, fonte;
  if (_eclissiPosizioneTemporanea) {
    lat = _eclissiPosizioneTemporanea.lat;
    lon = _eclissiPosizioneTemporanea.lon;
    fonte = 'punto scelto sulla mappa';
  } else {
    const locale = luogoCorrente();
    if (locale) {
      lat = locale.lat; lon = locale.lon;
      fonte = 'la tua posizione';
    } else if (quadro && quadro.massimo) {
      lat = quadro.massimo[0]; lon = quadro.massimo[1];
      fonte = 'punto di massima eclissi';
    } else {
      return;
    }
  }

  // La longitudine può arrivare da un clic su una copia lontana della mappa:
  // per scriverla e per fare i conti la si riporta fra −180° e +180°.
  lon = ((lon % 360) + 540) % 360 - 180;
  testoLuogo.innerHTML = `${formattaCoordinate(lat, lon)} <span class="ecl-fonte">(${fonte})</span>`;

  if (_mappaEclissi) {
    if (_eclissiMarkerPosizione) {
      _eclissiMarkerPosizione.setLatLng([lat, _eclInquadra(lon)]);
    } else {
      _eclissiMarkerPosizione = L.circleMarker([lat, _eclInquadra(lon)], {
        radius: 7, color: _eclTav().osservatore.bordo, fillColor: _eclTav().osservatore.dentro,
        fillOpacity: 1, weight: 2.5,
        className: 'ecl-osservatore'
      }).addTo(_mappaEclissi).bindTooltip('Il tuo punto di osservazione', { direction: 'top' });
    }
    _eclissiMarkerPosizione.bringToFront();
  }

  if (typeof Astronomy === 'undefined') {
    datiLocaliEl.innerHTML = '<p class="text-red-400">Astronomy Engine non disponibile</p>';
    return;
  }

  const tempo = _eclissiTempoSelezionato();
  const d = quadro ? quadro.d : _eclIstante(_eclUtSelezionato());

  try {
    const c = _eclCircostanze(lat, lon, d);
    const t = Astronomy.MakeTime(tempo);
    const obs = new Astronomy.Observer(lat, lon, 0);
    const equSole = Astronomy.Equator('Sun', t, obs, true, true);
    const horSole = Astronomy.Horizon(t, obs, equSole.ra, equSole.dec, 'normal');

    // Alba e tramonto cambiano solo di giorno in giorno: si ricalcolano
    // di rado, altrimenti il filmato rallenta a ogni fotogramma.
    const chiave = `${lat.toFixed(2)}|${lon.toFixed(2)}|${tempo.toDateString()}`;
    if (_eclCacheOrari.chiave !== chiave) {
      _eclCacheOrari = { chiave, valore: orariSorgereTramonto('Sun', tempo, obs) };
    }
    const orari = _eclCacheOrari.valore || {};

    let stato, classe;
    if (!c.suOrizzonte) {
      stato = 'Il Sole è sotto l\'orizzonte: da qui non si vede nulla';
      classe = 'ecl-stato-no';
    } else if (c.tipo === 'nessuna') {
      stato = 'Sole intero: l\'eclissi non è (ancora) iniziata qui';
      classe = 'ecl-stato-no';
    } else if (c.tipo === 'totale') {
      stato = 'ECLISSI TOTALE in corso';
      classe = 'ecl-stato-totale';
    } else if (c.tipo === 'anulare') {
      stato = 'ECLISSI ANULARE in corso (anello di fuoco)';
      classe = 'ecl-stato-totale';
    } else {
      stato = 'Eclissi parziale in corso';
      classe = 'ecl-stato-parziale';
    }

    datiLocaliEl.innerHTML = `
      <p class="${classe} ecl-stato">${stato}</p>
      <div class="ecl-barra grande"><span style="width:${(c.osc * 100).toFixed(1)}%"></span></div>
      <p><span class="ecl-etichetta">Sole coperto</span> <b>${_eclPerc(c.osc)}</b></p>
      <p><span class="ecl-etichetta">Sole</span> alt ${horSole.altitude.toFixed(1)}° · az ${Math.round(horSole.azimuth)}° (${skyNomeDirezione(horSole.azimuth)})</p>
      <p class="ecl-nota-piccola">Alba ${skyOra(orari.sorge)} · Tramonto ${skyOra(orari.tramonta)}</p>
    `;
    _eclAggiornaDossier(lat, lon);
  } catch (e) {
    console.error(e);
    datiLocaliEl.innerHTML = '<p class="text-red-400">Errore nel calcolo dei dati locali.</p>';
  }
}

// --- Il dossier del luogo: contatti e distanza dalla fascia ------------

// Tutto ciò che di questo punto non cambia mentre scorre il filmato. Si
// ricalcola solo quando l'osservatore si sposta.
function _eclDossierLocale(lat, lon) {
  const ev = _eclissiEventoInCorso;
  if (!ev || !ev.eclissi) return null;
  const chiave = `${lat.toFixed(4)}|${lon.toFixed(4)}|${ev.eclissi.peakUt}`;
  if (_eclCacheLocale.chiave === chiave) return _eclCacheLocale.valore;

  let valore = null;
  try {
    const circ = _eclCircostanzeLocali(lat, lon, ev.eclissi.peakUt, _eclFinestra, ev.dataObj);
    const fascia = _eclConsiglioFascia(lat, lon, ev.eclissi.peakUt, _eclFinestra, ev.dataObj, circ);
    valore = { circ, fascia, cronologia: _eclCronologia(circ) };
  } catch (e) {
    console.error('Errore nel calcolo delle circostanze locali:', e);
  }
  _eclCacheLocale = { chiave, valore };
  return valore;
}

function _eclAggiornaDossier(lat, lon) {
  const dossier = _eclDossierLocale(lat, lon);
  _eclDisegnaContatti(dossier && dossier.circ);
  _eclDisegnaConsiglioFascia(dossier);
  _eclDisegnaTacche(dossier && dossier.circ);
  _eclDisegnaCronologia(dossier);
  _eclDisegnaSicurezza(dossier && dossier.circ);
  _eclAggiornaMeteo(lat, lon, dossier);
}

// --- Sicurezza e fotografia -------------------------------------------
//
// La regola sul filtro non è la stessa dappertutto, e questa è esattamente
// la cosa che la gente sbaglia: dentro la fascia si toglie, per quei pochi
// minuti; un chilometro fuori non si toglie mai. Dirla in astratto non
// serve a nessuno — qui la si dice per il punto che l'utente ha scelto,
// con gli orari esatti in cui vale.
let _eclSicurezzaResa = null;

function _eclDisegnaSicurezza(circ) {
  const el = document.getElementById('eclissi-sicurezza');
  if (!el) return;
  if (_eclSicurezzaResa === _eclCacheLocale.chiave) return;
  _eclSicurezzaResa = _eclCacheLocale.chiave;

  const totale = circ && circ.centrale && circ.tipo === 'totale' && circ.suOrizzonteAlMassimo;
  const anulare = circ && circ.centrale && circ.tipo === 'anulare';

  let regola;
  if (totale) {
    regola = `
      <p class="ecl-sic-titolo si">Da questo punto il filtro si può togliere — ma solo
        fra le ${_eclOraSec(circ.c2.data)} e le ${_eclOraSec(circ.c3.data)}.</p>
      <p>Sono ${_eclDurataSec(circ.durataCentraleSec)}: l'unico momento di tutta l'eclissi in
        cui il Sole si guarda a occhio nudo, ed è anche l'unico in cui vale la pena farlo.
        Un secondo prima e un secondo dopo la luce torna pericolosa all'istante, senza dolore
        che avverta: la retina non ha recettori per il dolore, e il danno si scopre ore dopo.
        Rimetti il filtro <b>prima</b> che ricompaia il Sole, non quando lo vedi.</p>`;
  } else if (anulare) {
    regola = `
      <p class="ecl-sic-titolo no">Il filtro non si toglie mai, in nessun istante.</p>
      <p>Nelle eclissi anulari resta sempre un anello di fotosfera scoperto, e quell'anello
        è abbagliante quanto il Sole intero. È l'errore più diffuso: si crede che "anulare"
        somigli a "totale". Non c'entrano niente.</p>`;
  } else {
    regola = `
      <p class="ecl-sic-titolo no">Il filtro non si toglie mai, in nessun istante.</p>
      <p>Da qui il Sole non sparisce mai del tutto${circ && circ.visibile
        ? ` — si ferma al ${_eclPerc(circ.oscVisibile)}` : ''}. Anche una falce sottilissima
        di fotosfera basta a bruciare la retina, e il buio intorno inganna: la pupilla si
        allarga e ne lascia entrare di più.</p>`;
  }

  el.innerHTML = `
    ${regola}
    <ul class="ecl-sic-elenco">
      <li><b>Occhiali certificati ISO 12312-2.</b> Non occhiali da sole, per quanto scuri;
        non lastre radiografiche, vetri affumicati, CD o pellicole. Guardando attraverso un
        filtro giusto, in casa, non si deve vedere <i>nulla</i> tranne una lampada molto
        forte.</li>
      <li><b>Controllali contro luce prima di uscire.</b> Se il filtro è graffiato, forato o
        staccato dalla montatura, si butta. Vale anche per quelli avanzati dall'eclissi
        precedente, che spesso hanno passato anni in un cassetto.</li>
      <li><b>Mai un binocolo o un telescopio con gli occhiali da eclissi.</b> Lo strumento
        concentra la luce e fonde il filtro in una frazione di secondo. Il filtro solare va
        <b>davanti all'obiettivo</b>, mai fra oculare e occhio.</li>
      <li><b>Il modo più sicuro non guarda il Sole affatto.</b> Un foglio bucato con uno
        spillo proietta l'immagine del Sole su un secondo foglio: si vede la falce, in
        diretta. Uno scolapasta ne proietta cento in una volta, ed è il modo migliore di
        mostrarla ai bambini — che guardano lo schermo, non il cielo.</li>
      <li><b>Occhio all'ombra degli alberi.</b> Ogni spiraglio fra le foglie funziona da foro
        stenopeico: il terreno si riempie di falci. È lo spettacolo che quasi tutti si
        perdono, perché stanno guardando in alto.</li>
    </ul>

    <p class="ecl-sic-sotto">Se vuoi fotografarla</p>
    <ul class="ecl-sic-elenco">
      <li><b>Il filtro sta davanti all'obiettivo</b> per tutta la fase parziale, e non è
        opzionale: senza, il sensore si rovina e il mirino ottico è pericoloso quanto
        guardare il Sole a occhio nudo.</li>
      <li><b>Trova l'esposizione una settimana prima.</b> Fotografa il Sole non eclissato con
        lo stesso filtro, lo stesso obiettivo e la stessa apertura, e annota i valori: quella
        posa vale identica per tutte le fasi parziali, perché la superficie del Sole ha
        sempre la stessa luminosità — ne resta solo meno.</li>
      ${totale ? `<li><b>In totalità, togli il filtro e apri la forcella.</b> La corona copre
        un intervallo di luminosità enorme: la parte attaccata al bordo è migliaia di volte
        più brillante di quella esterna, e nessuna singola posa le prende entrambe. Si parte
        da tempi molto brevi — attorno al millesimo di secondo a f/8 e ISO 400, buoni per
        l'anello di diamante e le protuberanze — e si scende per raddoppi fino a circa un
        secondo per la corona esterna. Sono punti di partenza: la cosa che conta è
        <b>variare molto</b>, non azzeccare un valore.</li>
      <li><b>Metti a fuoco prima, a mano, e non toccare più.</b> L'autofocus non aggancia
        niente su un cielo nero, e in ${_eclDurataSec(circ.durataCentraleSec)} non c'è tempo
        per accorgersene.</li>
      <li><b>Guardala.</b> Programma uno scatto a raffica e stacca gli occhi dal mirino: le
        fotografie della corona esistono a migliaia, fatte meglio, con strumenti migliori.
        Il ricordo di averla vista no.</li>` : `<li><b>Non serve altro.</b> Senza totalità
        tutta l'eclissi si fotografa con il filtro montato e la stessa posa dall'inizio alla
        fine. Le foto più belle, però, sono a terra: le falci proiettate dalle foglie.</li>`}
    </ul>`;
}

// I cinque orari, in fila. Ognuno è cliccabile: porta il cursore del tempo
// esattamente lì, che è il modo più diretto di guardarsi un contatto.
function _eclDisegnaContatti(circ) {
  const el = document.getElementById('eclissi-contatti');
  if (!el) return;
  if (!circ) {
    el.innerHTML = `<p class="ecl-contatti-vuoto">Da questo punto la Luna non tocca il Sole:
      l'eclissi non è visibile qui.</p>`;
    return;
  }

  const nomeFase = circ.tipo === 'anulare' ? 'Anularità' : 'Totalità';
  let titolo, classeTitolo;
  if (!circ.visibile) {
    // I conti danno un'eclissi, ma da qui il Sole è sotto l'orizzonte per
    // tutta la sua durata: dire "97% di Sole coperto" sarebbe una bugia.
    titolo = 'Non visibile da qui';
    classeTitolo = 'assente';
  } else if (circ.centrale && circ.durataCentraleSec > 0 && circ.suOrizzonteAlMassimo) {
    titolo = `${nomeFase}: ${_eclDurataSec(circ.durataCentraleSec)}`;
    classeTitolo = 'centrale';
  } else {
    titolo = `Massimo ${_eclPerc(circ.oscVisibile)} di Sole coperto`;
    classeTitolo = 'parziale';
  }

  const righe = [];
  const aggiungi = (contatto, nome, nota) => {
    if (!contatto) return;
    righe.push({ contatto, nome, nota });
  };
  aggiungi(circ.c1, 'Primo contatto', 'la Luna tocca il bordo del Sole');
  aggiungi(circ.c2, `Inizio ${nomeFase.toLowerCase()}`,
           circ.tipo === 'anulare' ? 'si chiude l\'anello di fuoco' : 'il Sole sparisce');
  aggiungi(circ.massimo, 'Massimo', `${_eclPerc(circ.massimo.osc)} di Sole coperto`);
  aggiungi(circ.c3, `Fine ${nomeFase.toLowerCase()}`, 'ricompare il primo lembo di Sole');
  aggiungi(circ.c4, 'Ultimo contatto', 'il Sole torna intero');

  const corpo = righe.map(r => `
    <li class="ecl-contatto${r.contatto.suOrizzonte ? '' : ' sotto'}" data-min="${r.contatto.min}"
        title="Porta il cursore del tempo su questo momento">
      <span class="ecl-contatto-nome">${r.nome}</span>
      <span class="ecl-contatto-ora">${_eclOraSec(r.contatto.data)}</span>
      <span class="ecl-contatto-nota">${r.contatto.suOrizzonte
        ? `${r.nota} · Sole a ${r.contatto.alt.toFixed(0)}°`
        : 'il Sole è sotto l\'orizzonte'}</span>
    </li>`).join('');

  // Quando il Sole sorge o tramonta a eclissi iniziata, i contatti da soli
  // ingannano: dicono orari a cui da qui non si vede niente.
  let avviso = '';
  if (!circ.suOrizzonteAlMassimo) {
    avviso = circ.momentoMigliore
      ? `<p class="ecl-contatti-avviso">Al massimo il Sole è sotto l'orizzonte. Il momento
         migliore per guardare da qui è <b>${_eclOraSec(circ.momentoMigliore.data)}</b>, con
         <b>${_eclPerc(circ.momentoMigliore.osc)}</b> di Sole coperto e il Sole a
         ${circ.momentoMigliore.alt.toFixed(0)}° sull'orizzonte.</p>`
      : `<p class="ecl-contatti-avviso">Da qui l'eclissi cade tutta con il Sole sotto
         l'orizzonte: non è visibile.</p>`;
  }

  el.innerHTML = `
    <div class="ecl-contatti-testa">
      <span class="ecl-contatti-titolo ${classeTitolo}">${titolo}</span>
      <span class="ecl-contatti-durata">fase parziale ${Math.round(circ.durataParzialeMin)} min in tutto</span>
    </div>
    <ol class="ecl-contatti-lista">${corpo}</ol>
    ${avviso}
    <p class="ecl-nota-piccola">Orari nel fuso del tuo dispositivo. Tocca una riga per
      spostare lì il cursore del tempo.</p>`;
}

// Il consiglio pratico: dove andare, quanto costa, quanto si guadagna.
function _eclDisegnaConsiglioFascia(dossier) {
  const el = document.getElementById('eclissi-fascia');
  if (!el) return;
  const fascia = dossier && dossier.fascia;
  const circ = dossier && dossier.circ;
  if (!fascia) { el.innerHTML = ''; el.classList.add('vuoto'); return; }
  el.classList.remove('vuoto');

  const nomeFase = circ && circ.tipo === 'anulare' ? 'anularità' : 'totalità';
  const dove = (p) => p.nome ? ` (vicino a ${p.nome})` : '';

  if (fascia.dentro) {
    const qui = circ && circ.durataCentraleSec
      ? `Qui dura <b>${_eclDurataSec(circ.durataCentraleSec)}</b>.` : '';
    const meglio = fascia.centro.durataSec > (circ ? circ.durataCentraleSec : 0) + 5
      ? ` Sulla linea centrale, <b>${_eclKm(fascia.centro.km)}</b> verso
         ${skyNomeDirezione(fascia.centro.az)}${dove(fascia.centro)}, arriva a
         <b>${_eclDurataSec(fascia.centro.durataSec)}</b>.`
      : fascia.centro.km < 25
        ? ' Sei praticamente sulla linea centrale: di meglio non c\'è.'
        : '';
    el.innerHTML = `
      <p class="ecl-fascia-esito dentro">Sei dentro la fascia di ${nomeFase}.</p>
      <p>${qui}${meglio}</p>`;
    return;
  }

  // Se da qui il Sole è sotto l'orizzonte non ha senso parlare di quanto
  // viene coperto: il discorso è solo dove bisognerebbe andare.
  const visibile = circ ? circ.visibile : true;
  const premessa = visibile
    ? `<p>Il Sole arriva a essere coperto al <b>${circ ? _eclPerc(circ.oscVisibile) : '—'}</b>,
        ma non sparisce mai del tutto: niente corona, niente buio. La differenza fra il 99%
        e il 100% è tutta l'eclissi.</p>`
    : `<p>Da questo punto il Sole resta sotto l'orizzonte per tutta la durata dell'eclissi.
        Per vederla bisogna spostarsi.</p>`;
  el.innerHTML = `
    <p class="ecl-fascia-esito fuori">Da qui la ${nomeFase} non si vede.</p>
    ${premessa}
    <ul class="ecl-fascia-passi">
      ${fascia.bordo ? `<li><b>${_eclKm(fascia.bordo.km)}</b> verso
        ${skyNomeDirezione(fascia.bordo.az)}${dove(fascia.bordo)}
        — il primo punto da cui il Sole sparisce, per pochi istanti.</li>` : ''}
      <li><b>${_eclKm(fascia.centro.km)}</b> verso ${skyNomeDirezione(fascia.centro.az)}${dove(fascia.centro)}
        — sulla linea centrale, ${fascia.centro.durataSec > 0
          ? `dove la ${nomeFase} dura <b>${_eclDurataSec(fascia.centro.durataSec)}</b>`
          : `dove la ${nomeFase} dura più a lungo`}.</li>
    </ul>`;
}

// --- La cronologia: cosa si vede, minuto per minuto -------------------
//
// I contatti dicono gli orari; questa dice cosa guardare. Sono i fenomeni
// che separano chi ha visto un'eclissi da chi l'ha soltanto guardata: la
// luce che diventa metallica, le ombre volanti, i grani di Baily. Ogni voce
// è ancorata a un orario vero, calcolato per questo punto.

// Momento in cui il Sole risulta coperto almeno di una certa frazione.
// Fra il primo contatto e il massimo l'oscuramento cresce sempre, quindi
// la soglia si attraversa una volta sola.
function _eclMinutoASoglia(circ, soglia) {
  const ev = _eclissiEventoInCorso;
  if (!ev || !circ || circ.oscMax < soglia) return null;
  return _eclQuandoDiventaVero(circ.lat, circ.lon, ev.eclissi.peakUt,
    circ.c1.min, circ.massimo.min, c => c.oscGeometrico >= soglia);
}

function _eclCronologia(circ) {
  const ev = _eclissiEventoInCorso;
  // Senza eclissi, o con il Sole sotto l'orizzonte per tutta la sua durata,
  // non c'è nessuna sequenza da raccontare.
  if (!circ || !ev || !circ.visibile) return null;
  const anulare = circ.tipo === 'anulare';
  const passi = [];
  const agg = (min, classe, titolo, testo) => {
    if (min === null || min === undefined || !isFinite(min)) return;
    passi.push({ min, classe, titolo, testo });
  };

  agg(circ.c1.min, 'attesa', 'Primo contatto',
    'La Luna intacca il bordo del Sole. A occhio nudo non si nota nulla: il cambiamento ' +
    'si vede solo attraverso il filtro. È il momento di controllare che gli occhiali siano integri.');

  const met = _eclMinutoASoglia(circ, 0.5);
  agg(met, 'attesa', 'Sole coperto a metà',
    'Metà disco è sparito, eppure intorno sembra ancora pieno giorno: l\'occhio compensa ' +
    'in modo straordinario. Prova a fotografare l\'ombra di un albero — ogni spazio fra le ' +
    'foglie proietta una piccola falce.');

  const forte = _eclMinutoASoglia(circ, 0.85);
  agg(forte, 'attesa', 'Sole coperto all\'85%',
    'Ora la luce cambia davvero: si fa metallica, i colori si smorzano e le ombre diventano ' +
    'insolitamente nette. La temperatura comincia a scendere, di qualche grado.');

  if (circ.centrale) {
    const nomeFase = anulare ? 'anularità' : 'totalità';
    agg(circ.c2.min - 3, 'avviso', 'Tre minuti alla ' + nomeFase,
      'La luce crolla in fretta. Gli uccelli tacciono e gli animali si comportano come ' +
      'all\'imbrunire. Guarda in direzione da cui arriva l\'ombra: si vede una parete scura ' +
      'avanzare sull\'orizzonte.');

    if (!anulare) {
      agg(circ.c2.min - 0.7, 'avviso', 'Ombre volanti',
        'Sul terreno chiaro — un lenzuolo bianco steso per terra è perfetto — possono ' +
        'comparire bande scure che scorrono e tremolano. Durano una manciata di secondi ' +
        'e non sempre si vedono: è uno dei fenomeni più sfuggenti dell\'eclissi.');
      agg(circ.c2.min - 0.2, 'avviso', 'Grani di Baily e anello di diamante',
        'L\'ultimo lembo di Sole si spezza in perline luminose: è la luce che passa fra le ' +
        'montagne del bordo lunare. Poi resta un solo punto brillante su un anello sottile — ' +
        'l\'anello di diamante.');
      agg(circ.c2.min, 'clou', 'TOTALITÀ — ora si toglie il filtro',
        'Il Sole è sparito. Questo, e solo questo, è il momento in cui si può guardare a occhio ' +
        'nudo. Appare la corona, perlacea e ramificata. Sul bordo cerca le protuberanze rosa. ' +
        'Poi voltati: l\'orizzonte è arancione in tutte le direzioni, come un tramonto a 360°.');
      // Sotto il minuto non si fa in tempo a guardarsi intorno: dire di
      // cercare i pianeti sprecherebbe metà dei secondi che ci sono.
      if (circ.durataCentraleSec > 60) {
        agg((circ.c2.min + circ.c3.min) / 2, 'clou', 'A metà totalità',
          'Alza gli occhi dal Sole per qualche secondo: si vedono i pianeti più luminosi e le ' +
          'stelle più brillanti, in pieno giorno. È il ricordo che resta più a lungo.');
      }
      // Al bordo della fascia la totalità può durare pochi secondi: l'avviso
      // sul filtro non deve finire prima del suo inizio.
      agg(Math.max(circ.c3.min - 0.2, (circ.c2.min + circ.c3.min) / 2),
        'avviso', 'Rimetti il filtro, adesso',
        'Il secondo anello di diamante sta per arrivare. Va anticipato, non aspettato: appena ' +
        'ricompare un lembo di fotosfera la luce torna pericolosa in una frazione di secondo.');
      agg(circ.c3.min, 'attesa', 'Fine della totalità',
        'Il Sole torna. Da qui in poi si ripete tutto al contrario, e la maggior parte della ' +
        'gente se ne va: peccato, perché la luce che torna è bella quanto quella che se ne va.');
    } else {
      agg(circ.c2.min, 'clou', 'ANULARITÀ — il filtro resta su',
        'La Luna è tutta dentro il disco del Sole e resta un anello di luce. Attenzione: ' +
        'quell\'anello è fotosfera piena, abbagliante come il Sole intero. In un\'eclissi ' +
        'anulare il filtro non si toglie mai, in nessun istante.');
      agg(circ.c3.min, 'attesa', 'Fine dell\'anularità',
        'L\'anello si spezza e torna la falce. La luce, che era calata in modo strano senza ' +
        'mai diventare notte, ricomincia a salire.');
    }
  } else {
    agg(circ.massimo.min, 'clou', 'Massimo dell\'eclissi',
      `Il Sole è coperto al ${_eclPerc(circ.oscMax)} e non andrà oltre. Da qui non c'è ` +
      'totalità: niente corona, niente buio, e il filtro non va tolto in nessun momento. ' +
      'Sotto il 90% il paesaggio cambia sorprendentemente poco.');
  }

  agg(circ.c4.min, 'attesa', 'Ultimo contatto',
    'Il disco solare è di nuovo intero. L\'eclissi è finita.');

  passi.sort((a, b) => a.min - b.min);
  return passi.map(p => Object.assign(p, {
    data: new Date(ev.dataObj.getTime() + p.min * 60000)
  }));
}

let _eclCronologiaResa = null;

function _eclDisegnaCronologia(dossier) {
  const el = document.getElementById('eclissi-cronologia');
  if (!el) return;
  const passi = dossier && dossier.cronologia;
  if (!passi || !passi.length) {
    el.innerHTML = `<p class="ecl-nota-piccola">Da questo punto non c'è niente da vedere:
      o la Luna non tocca il Sole, o il Sole resta sotto l'orizzonte per tutta l'eclissi.
      Sposta il punto di osservazione dentro la zona colorata sulla mappa.</p>`;
    _eclCronologiaResa = null;
    return;
  }
  // La lista si ricostruisce solo quando cambia il luogo: durante il filmato
  // si limita a spostare l'evidenziazione, che è un'operazione da nulla.
  if (_eclCronologiaResa !== _eclCacheLocale.chiave) {
    el.innerHTML = passi.map(p => `
      <li class="ecl-passo ${p.classe}" data-min="${p.min}"
          title="Porta il cursore del tempo su questo momento">
        <span class="ecl-passo-ora">${_eclOraSec(p.data)}</span>
        <span class="ecl-passo-testo">
          <b>${p.titolo}</b>
          <span>${p.testo}</span>
        </span>
      </li>`).join('');
    _eclCronologiaResa = _eclCacheLocale.chiave;
  }
  let attivo = -1;
  passi.forEach((p, i) => { if (p.min <= _eclissiOffsetTempoMin) attivo = i; });
  el.querySelectorAll('.ecl-passo').forEach((n, i) => n.classList.toggle('attivo', i === attivo));
}

// =====================================================================
// 1-ter-bis. IL CIELO SARÀ SERENO?
//   La geometria dice se l'eclissi passa di qui. Le nuvole decidono se la
//   vedrai: e' l'unica variabile che conta davvero e l'unica su cui si puo'
//   ancora fare qualcosa, spostandosi. Per gli eventi vicini si chiede la
//   previsione; per quelli lontani — e sono quasi tutti, visto che il
//   calendario arriva al 2070 — si guarda cosa faceva il cielo in quel
//   punto, in quei giorni, negli ultimi quindici anni.
//
//   Tutto qui dentro fallisce in silenzio. L'app deve restare usabile in un
//   campo senza campo: se la rete non risponde, semplicemente non si parla
//   di nuvole.
// =====================================================================

const MET_CHIAVE_CACHE = 'astrocalendario_meteo';
const MET_ANNI_STORICI = 15;
const MET_SOGLIA_SERENO = 30;      // copertura media giornaliera, in percento
const MET_ATTESA_MS = 9000;
const MET_TTL_PREVISIONE = 3 * 3600000;  // le previsioni invecchiano in fretta
const MET_TTL_CLIMA = 180 * 86400000;    // la climatologia praticamente mai

function _metCacheLeggi(chiave) {
  try {
    const tutto = JSON.parse(localStorage.getItem(MET_CHIAVE_CACHE) || '{}');
    const v = tutto[chiave];
    if (v && v.scade > Date.now()) return v.dato;
  } catch (e) { /* cache illeggibile: si rifà la richiesta */ }
  return null;
}

function _metCacheScrivi(chiave, dato, ttl) {
  try {
    const tutto = JSON.parse(localStorage.getItem(MET_CHIAVE_CACHE) || '{}');
    tutto[chiave] = { dato, scade: Date.now() + ttl };
    // Senza potatura la cache cresce a ogni punto toccato sulla mappa
    const voci = Object.entries(tutto).filter(([, v]) => v.scade > Date.now());
    if (voci.length > 60) voci.splice(0, voci.length - 60);
    localStorage.setItem(MET_CHIAVE_CACHE, JSON.stringify(Object.fromEntries(voci)));
  } catch (e) { /* spazio finito o modalità privata: pazienza */ }
}

async function _metChiedi(url) {
  if (typeof fetch !== 'function') return null;
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const stop = ctrl ? setTimeout(() => ctrl.abort(), MET_ATTESA_MS) : null;
  try {
    const r = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null; // niente rete, niente meteo: non è un errore da mostrare
  } finally {
    if (stop) clearTimeout(stop);
  }
}

function _metData(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-` +
         `${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Le previsioni arrivano a sedici giorni; oltre, non esistono.
function _metEntroPrevisione(quando) {
  const giorni = (quando.getTime() - Date.now()) / 86400000;
  return giorni >= -1 && giorni <= 15;
}

// Nuvole previste nell'ora dell'eclissi, in quel punto.
async function _metPrevisione(lat, lon, quando) {
  const chiave = `p|${lat.toFixed(1)}|${lon.toFixed(1)}|${_metData(quando)}|${quando.getUTCHours()}`;
  const salvato = _metCacheLeggi(chiave);
  if (salvato) return salvato;

  const giorno = _metData(quando);
  const url = 'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&hourly=cloud_cover&start_date=${giorno}&end_date=${giorno}&timezone=UTC`;
  const d = await _metChiedi(url);
  const ore = d && d.hourly && d.hourly.time;
  const cop = d && d.hourly && (d.hourly.cloud_cover || d.hourly.cloudcover);
  if (!ore || !cop) return null;

  const cercata = `${giorno}T${String(quando.getUTCHours()).padStart(2, '0')}:00`;
  let i = ore.indexOf(cercata);
  if (i < 0) i = Math.min(quando.getUTCHours(), cop.length - 1);
  const nuvole = cop[i];
  if (typeof nuvole !== 'number') return null;

  const esito = { tipo: 'previsione', nuvole };
  _metCacheScrivi(chiave, esito, MET_TTL_PREVISIONE);
  return esito;
}

// Distanza fra due date del calendario, ignorando l'anno: serve a prendere
// i giorni "attorno" alla data dell'eclissi anche a cavallo di capodanno.
function _metDistanzaGiorni(mese, giorno, altroMese, altroGiorno) {
  const gi = (m, g) => Math.round((Date.UTC(2001, m - 1, g) - Date.UTC(2001, 0, 1)) / 86400000);
  const d = Math.abs(gi(mese, giorno) - gi(altroMese, altroGiorno));
  return Math.min(d, 365 - d);
}

// Cosa faceva il cielo, in quel punto, nei giorni attorno a quella data,
// negli ultimi quindici anni. Una richiesta sola: si scaricano le medie
// giornaliere di tutto il periodo e si tengono le date che servono.
async function _metClima(lat, lon, quando) {
  const mese = quando.getUTCMonth() + 1, giorno = quando.getUTCDate();
  const chiave = `c|${lat.toFixed(1)}|${lon.toFixed(1)}|${mese}-${giorno}`;
  const salvato = _metCacheLeggi(chiave);
  if (salvato) return salvato;

  const ultimo = new Date().getUTCFullYear() - 1;
  const primo = ultimo - MET_ANNI_STORICI + 1;
  const url = 'https://archive-api.open-meteo.com/v1/archive' +
    `?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&start_date=${primo}-01-01&end_date=${ultimo}-12-31` +
    '&daily=cloud_cover_mean&timezone=UTC';
  const d = await _metChiedi(url);
  const giorni = d && d.daily && d.daily.time;
  const cop = d && d.daily && (d.daily.cloud_cover_mean || d.daily.cloudcover_mean);
  if (!giorni || !cop) return null;

  // Una finestra di tre giorni per parte: la data esatta darebbe quindici
  // valori soli, troppo pochi per dire qualcosa.
  const valori = [];
  for (let i = 0; i < giorni.length; i++) {
    const v = cop[i];
    if (typeof v !== 'number') continue;
    const p = giorni[i].split('-');
    if (_metDistanzaGiorni(mese, giorno, +p[1], +p[2]) <= 3) valori.push(v);
  }
  if (valori.length < 20) return null;

  valori.sort((a, b) => a - b);
  const esito = {
    tipo: 'clima',
    mediana: valori[Math.floor(valori.length / 2)],
    quotaSereno: valori.filter(v => v <= MET_SOGLIA_SERENO).length / valori.length,
    campioni: valori.length,
    daAnno: primo,
    adAnno: ultimo
  };
  _metCacheScrivi(chiave, esito, MET_TTL_CLIMA);
  return esito;
}

function _metGiudizio(quota) {
  if (quota >= 0.65) return { classe: 'buono', testo: 'buone probabilità' };
  if (quota >= 0.45) return { classe: 'medio', testo: 'probabilità discrete' };
  if (quota >= 0.25) return { classe: 'medio', testo: 'probabilità scarse' };
  return { classe: 'brutto', testo: 'probabilità basse' };
}

// --- Il pannello -------------------------------------------------------

let _metRichiestaInCorso = 0;
let _metRimando = null;

function _eclAggiornaMeteo(lat, lon, dossier) {
  const el = document.getElementById('eclissi-meteo');
  if (!el || !_eclissiEventoInCorso) return;
  // Trascinando il punto sulla mappa si passa su decine di posizioni: si
  // aspetta che la mano si fermi prima di chiedere qualcosa alla rete.
  if (_metRimando) clearTimeout(_metRimando);
  _metRimando = setTimeout(() => _metCarica(el, lat, lon, dossier), 700);
}

async function _metCarica(el, lat, lon, dossier) {
  const ev = _eclissiEventoInCorso;
  if (!ev) return;
  const mio = ++_metRichiestaInCorso;

  // L'ora che conta è quella del massimo in questo punto, non del culmine
  // globale: possono distare ore.
  const circ = dossier && dossier.circ;
  const quando = circ && circ.visibile
    ? (circ.momentoMigliore || circ.massimo).data
    : ev.dataObj;

  const vicino = _metEntroPrevisione(quando);
  const qui = vicino ? await _metPrevisione(lat, lon, quando) : await _metClima(lat, lon, quando);
  if (mio !== _metRichiestaInCorso) return;   // l'utente si è già spostato altrove
  if (!qui) { el.innerHTML = ''; el.classList.add('vuoto'); return; }

  // Il confronto che vale il viaggio: se la fascia è altrove, quanto cambia
  // il cielo laggiù?
  let laggiu = null;
  const fascia = dossier && dossier.fascia;
  if (!vicino && fascia && !fascia.dentro && fascia.centro) {
    const p = fascia.centro.punto;
    laggiu = await _metClima(p[0], ((p[1] % 360) + 540) % 360 - 180, quando);
    if (mio !== _metRichiestaInCorso) return;
  }

  el.classList.remove('vuoto');
  el.innerHTML = _metHtml(qui, laggiu, fascia, quando);
}

function _metHtml(qui, laggiu, fascia, quando) {
  if (qui.tipo === 'previsione') {
    const g = _metGiudizio(1 - qui.nuvole / 100);
    return `
      <p class="ecl-meteo-testa">Il cielo, quel giorno</p>
      <p class="ecl-meteo-valore ${g.classe}">${Math.round(qui.nuvole)}% di nuvole previste</p>
      <p>Previsione per le ${_eclOra(quando)} in questo punto. Manca poco: vale la pena
        ricontrollarla il giorno prima, quando sarà molto più affidabile.</p>`;
  }

  const g = _metGiudizio(qui.quotaSereno);
  const perc = (q) => `${Math.round(q * 100)}%`;
  let confronto = '';
  if (laggiu && fascia && fascia.centro) {
    const salto = laggiu.quotaSereno - qui.quotaSereno;
    const dove = fascia.centro.nome ? ` (${fascia.centro.nome})` : '';
    confronto = Math.abs(salto) < 0.06
      ? `<p class="ecl-meteo-confronto">Sulla linea centrale, a ${_eclKm(fascia.centro.km)}
          verso ${skyNomeDirezione(fascia.centro.az)}${dove}, il cielo storicamente si comporta
          quasi allo stesso modo (${perc(laggiu.quotaSereno)} di giornate serene).</p>`
      : `<p class="ecl-meteo-confronto ${salto > 0 ? 'meglio' : 'peggio'}">
          Sulla linea centrale, a ${_eclKm(fascia.centro.km)} verso
          ${skyNomeDirezione(fascia.centro.az)}${dove}, si passa a
          <b>${perc(laggiu.quotaSereno)}</b> di giornate serene:
          ${salto > 0 ? 'oltre alla totalità, ci si guadagna anche in cielo'
                      : 'la totalità si guadagna, ma il cielo è storicamente più chiuso'}.</p>`;
  }

  return `
    <p class="ecl-meteo-testa">Il cielo, storicamente</p>
    <p class="ecl-meteo-valore ${g.classe}">${perc(qui.quotaSereno)} di giornate serene</p>
    <p>Negli ultimi ${MET_ANNI_STORICI} anni (${qui.daAnno}–${qui.adAnno}), nei giorni attorno
      al ${quando.getUTCDate()} ${quando.toLocaleDateString('it-IT', { month: 'long', timeZone: 'UTC' })},
      in questo punto il cielo era coperto in media al <b>${Math.round(qui.mediana)}%</b>.
      Sono ${g.testo}.</p>
    ${confronto}
    <p class="ecl-nota-piccola">Statistica su ${qui.campioni} giornate, dalla rianalisi ERA5.
      Non è una previsione — a questa distanza non esistono — ma dice dove conviene
      cercare posto.</p>`;
}

// =====================================================================
// 1-ter-ter. PORTARSELA DIETRO
//   Il giorno dell'eclissi si e' in un campo, e nei campi spesso non c'e'
//   campo. Tutto il resto dell'app funziona gia' offline — la libreria
//   astronomica e' in cache e i conti si rifanno da soli — ma le tessere
//   della mappa arrivano dalla rete, e senza quelle resta un rettangolo
//   grigio proprio quando serve capire dove si e'.
//
//   Qui si scaricano in anticipo le tessere attorno al punto di
//   osservazione. Non tutto il percorso: solo il pezzo di mondo in cui si
//   stara' davvero, che e' anche l'unico modo onesto di chiedere quelle
//   tessere a un servizio gratuito.
// =====================================================================

const OFF_RAGGIO_KM = 220;
const OFF_ZOOM = [4, 5, 6, 7, 8];
const OFF_MAX_TESSERE = 260;
const OFF_IN_PARALLELO = 4;

function _offTessellaX(lon, z) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}
function _offTessellaY(lat, z) {
  const r = Math.max(-85, Math.min(85, lat)) * ECL_RAD;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z));
}

// Le tessere che coprono un quadrato attorno al punto, zoom per zoom, dal
// piu' largo al piu' fitto: se il tetto arriva prima, resta comunque una
// mappa d'insieme utilizzabile invece di un dettaglio a macchia di leopardo.
function _offElencoTessere(lat, lon) {
  const dLat = OFF_RAGGIO_KM / 111.32;
  const dLon = OFF_RAGGIO_KM / (111.32 * Math.max(0.15, Math.cos(lat * ECL_RAD)));
  const urls = [];
  for (const z of OFF_ZOOM) {
    const n = Math.pow(2, z);
    const x1 = _offTessellaX(lon - dLon, z), x2 = _offTessellaX(lon + dLon, z);
    const y1 = _offTessellaY(lat + dLat, z), y2 = _offTessellaY(lat - dLat, z);
    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) {
        if (y < 0 || y >= n) continue;
        const xx = ((x % n) + n) % n;   // l'antimeridiano non spezza il giro
        urls.push(`https://a.tile.openstreetmap.org/${z}/${xx}/${y}.png`);
        if (urls.length >= OFF_MAX_TESSERE) return urls;
      }
    }
  }
  return urls;
}

let _offInCorso = false;

async function _eclScaricaOffline(lat, lon, riferisci) {
  if (_offInCorso) return;
  _offInCorso = true;
  const urls = _offElencoTessere(lat, lon);
  let fatte = 0, fallite = 0;

  // Le tessere passano dal service worker, che le conserva man mano: basta
  // chiederle una volta perche' restino disponibili senza rete.
  const coda = urls.slice();
  const operaio = async () => {
    while (coda.length) {
      const url = coda.shift();
      try {
        const r = await fetch(url, { mode: 'cors' });
        if (!r.ok) fallite++;
      } catch (e) {
        fallite++;
      }
      fatte++;
      if (fatte % 5 === 0 || !coda.length) riferisci(fatte, urls.length, fallite);
    }
  };
  try {
    await Promise.all(Array.from({ length: OFF_IN_PARALLELO }, operaio));
  } finally {
    _offInCorso = false;
  }
  return { fatte, fallite, totali: urls.length };
}

function _eclAggiornaTastoOffline(testo, stato) {
  const b = document.getElementById('btn-eclissi-offline');
  if (!b) return;
  b.textContent = testo;
  b.className = `ecl-tasto-largo${stato ? ' ' + stato : ''}`;
  b.disabled = stato === 'in-corso';
}

// =====================================================================
// 1-quater. LE ECLISSI DI CASA TUA
//   Una mappa risponde a "chi vede questa eclissi". Girando la domanda —
//   "quali eclissi vedo io, da qui?" — viene fuori il calendario personale
//   di chi guarda: quante ne passano sopra casa nella sua vita, quanto
//   grosse, e soprattutto quando arriva quella che vale un viaggio.
// =====================================================================

// Sguardo veloce su una singola eclissi: quanto Sole viene coperto, al
// massimo, da questo punto. Costa una frazione delle circostanze complete
// perché non cerca i contatti — e va moltiplicato per un centinaio di
// eclissi, quindi ogni conto risparmiato si sente.
function _eclSguardoLocale(lat, lon, peakUt) {
  let minSep = Infinity, minAt = 0;
  let oscVista = 0, vistaAt = null;
  // Il massimo avvicinamento fra i due dischi, da un punto qualsiasi, cade
  // sempre entro poche ore dal culmine globale.
  for (let min = -200; min <= 200; min += 10) {
    const c = _eclCircostanze(lat, lon, _eclIstante(peakUt + min / 1440), true);
    if (c.sep < minSep) { minSep = c.sep; minAt = min; }
    if (c.suOrizzonte && c.osc > oscVista) { oscVista = c.osc; vistaAt = min; }
  }

  const t = _eclMinimoDi(lat, lon, peakUt, minAt - 10, minAt + 10, c => c.sep);
  const c = _eclCircostanze(lat, lon, _eclIstante(peakUt + t / 1440), true);
  if (c.sep >= c.rSole + c.rLuna) return null;      // da qui la Luna non tocca il Sole

  if (c.suOrizzonte) {
    return { min: t, osc: c.osc, tipo: c.tipoGeometrico, alt: c.altSole, alSorgere: false };
  }
  // Al massimo il Sole è sotto l'orizzonte: conta il momento migliore in cui
  // il Sole c'è davvero, che è quello che questa persona vedrà.
  if (vistaAt === null || oscVista < 0.005) return null;
  const t2 = _eclMinimoDi(lat, lon, peakUt, vistaAt - 10, vistaAt + 10,
                          x => (x.suOrizzonte ? -x.osc : 1));
  const c2 = _eclCircostanze(lat, lon, _eclIstante(peakUt + t2 / 1440), true);
  if (!c2.suOrizzonte || c2.osc < 0.005) return null;
  return { min: t2, osc: c2.osc, tipo: c2.tipoGeometrico, alt: c2.altSole, alSorgere: true };
}

let _eclCasaCache = { chiave: null, valore: null };

function _eclEclissiDiCasa(lat, lon) {
  const chiave = `${lat.toFixed(3)}|${lon.toFixed(3)}`;
  if (_eclCasaCache.chiave === chiave) return _eclCasaCache.valore;

  const trovate = [];
  eventiCalcolati.forEach(ev => {
    if (!ev.eclissi || typeof ev.eclissi.peakUt !== 'number') return;
    const s = _eclSguardoLocale(lat, lon, ev.eclissi.peakUt);
    if (!s) return;
    trovate.push({
      id: ev.id,
      titolo: ev.titolo,
      data: new Date(ev.dataObj.getTime() + s.min * 60000),
      osc: s.osc,
      tipo: s.tipo,
      alt: s.alt,
      alSorgere: s.alSorgere
    });
  });
  trovate.sort((a, b) => a.data - b.data);
  _eclCasaCache = { chiave, valore: trovate };
  return trovate;
}

function _eclColoreOsc(osc) {
  if (osc >= 0.999) return 'var(--rosso)';
  if (osc >= 0.9) return '#fb923c';
  if (osc >= 0.6) return 'var(--ambra)';
  if (osc >= 0.3) return 'var(--viola-chiaro)';
  return 'var(--blu-chiaro)';
}

function _eclDisegnaEclissiDiCasa(lat, lon) {
  const elenco = document.getElementById('casa-elenco');
  const riepilogo = document.getElementById('casa-riepilogo');
  const sotto = document.getElementById('casa-sottotitolo');
  if (!elenco) return;

  const luogo = nomeLuogoVicino(lat, lon, 60) || formattaCoordinate(lat, lon);
  if (sotto) {
    sotto.textContent = `Tutte le eclissi solari visibili da ${luogo}, fino al ${ANNO_LIMITE_ECLISSI}`;
  }

  let lista;
  try {
    lista = _eclEclissiDiCasa(lat, lon);
  } catch (e) {
    console.error('Errore nel calcolo delle eclissi locali:', e);
    elenco.innerHTML = '<p class="text-red-400">Errore nel calcolo delle eclissi visibili da qui.</p>';
    return;
  }

  if (!lista.length) {
    elenco.innerHTML = `<p class="ecl-nota-piccola">Da questo punto, fino al
      ${ANNO_LIMITE_ECLISSI}, non se ne vede nessuna. Succede: le eclissi solari sono
      frequenti sul pianeta, ma rare sopra un punto preciso.</p>`;
    if (riepilogo) riepilogo.innerHTML = '';
    return;
  }

  const centrali = lista.filter(e => e.tipo === 'totale' || e.tipo === 'anulare');
  const prossimaTotale = lista.find(e => e.tipo === 'totale');
  const anni = (d) => (d - Date.now()) / (365.25 * 24 * 3600000);

  if (riepilogo) {
    const schede = [
      { etichetta: 'Eclissi visibili da qui', valore: String(lista.length),
        nota: `fino al ${ANNO_LIMITE_ECLISSI}, anche solo parziali` },
      { etichetta: 'La prossima', valore: lista[0].data.toLocaleDateString('it-IT',
          { day: 'numeric', month: 'short', year: 'numeric' }),
        nota: `${_eclPerc(lista[0].osc)} di Sole coperto · fra ${Math.round(anni(lista[0].data))} anni`
              .replace('fra 0 anni', 'entro l\'anno') },
      prossimaTotale
        ? { etichetta: 'La prossima totale', valore: prossimaTotale.data.toLocaleDateString('it-IT',
              { day: 'numeric', month: 'short', year: 'numeric' }),
            nota: `fra ${Math.round(anni(prossimaTotale.data))} anni — l'unica che vale davvero un viaggio` }
        : { etichetta: 'Eclissi totali', valore: 'nessuna',
            nota: `da qui, fino al ${ANNO_LIMITE_ECLISSI}, il Sole non sparisce mai del tutto` }
    ];
    riepilogo.innerHTML = schede.map(s => `
      <div class="ecl-scheda">
        <span class="ecl-scheda-etichetta">${s.etichetta}</span>
        <span class="ecl-scheda-valore">${s.valore}</span>
        <span class="ecl-scheda-nota">${s.nota}</span>
      </div>`).join('');
  }

  const badge = (e) => e.tipo === 'totale'
    ? '<span class="casa-badge totale">TOTALE</span>'
    : e.tipo === 'anulare' ? '<span class="casa-badge anulare">ANULARE</span>' : '';

  elenco.innerHTML = `
    <p class="casa-intro">Da qui passano <b>${lista.length}</b> eclissi solari, di cui
      <b>${centrali.length}</b> ${centrali.length === 1 ? 'centrale' : 'centrali'}. La barra dice
      quanto Sole verrà coperto: sotto il 90% il paesaggio cambia molto meno di quanto
      la gente si aspetti.</p>
    <ol class="casa-lista">` +
    lista.map(e => `
      <li class="casa-riga${e.tipo === 'totale' ? ' totale' : ''}" data-evento="${e.id}"
          title="Apri la mappa di questa eclissi">
        <span class="casa-data">
          <b>${e.data.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</b>
          <span>${e.data.getFullYear()}</span>
        </span>
        <span class="casa-barra">
          <span style="width:${(e.osc * 100).toFixed(1)}%;background:${_eclColoreOsc(e.osc)}"></span>
        </span>
        <span class="casa-perc">${_eclPerc(e.osc)}</span>
        <span class="casa-note">${badge(e)}${e.alSorgere
          ? '<span class="casa-nota-piccola">al sorgere o al tramonto</span>' : ''}</span>
      </li>`).join('') + '</ol>';
}

function apriEclissiDiCasa(lat, lon) {
  const modale = document.getElementById('modale-eclissi-casa');
  if (!modale) return;
  const elenco = document.getElementById('casa-elenco');
  if (elenco) {
    elenco.innerHTML = `<p class="ecl-nota-piccola">Sto guardando una per una tutte le
      eclissi da qui al ${ANNO_LIMITE_ECLISSI}…</p>`;
  }
  modale.classList.remove('hidden');
  // Un attimo di respiro perché la finestra si disegni prima del calcolo:
  // sono un centinaio di eclissi e su un telefono si sentono.
  setTimeout(() => _eclDisegnaEclissiDiCasa(lat, lon), 40);
}

function chiudiEclissiDiCasa() {
  const modale = document.getElementById('modale-eclissi-casa');
  if (modale) modale.classList.add('hidden');
}

function inizializzaEclissiDiCasaUI() {
  const modale = document.getElementById('modale-eclissi-casa');
  if (!modale) return;
  ['btn-chiudi-casa', 'btn-chiudi-casa-basso'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', chiudiEclissiDiCasa);
  });
  modale.addEventListener('click', (e) => { if (e.target === modale) chiudiEclissiDiCasa(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modale.classList.contains('hidden')) chiudiEclissiDiCasa();
  });

  // Da una riga si torna alla mappa dell'eclissi scelta
  const elenco = document.getElementById('casa-elenco');
  if (elenco) {
    elenco.addEventListener('click', (e) => {
      const riga = e.target.closest('[data-evento]');
      if (!riga) return;
      chiudiEclissiDiCasa();
      apriMappaEclissi(riga.dataset.evento);
    });
  }

  // Il diario ha già un traguardo "Cacciatore di eclissi": quello che
  // mancava era il modo di arrivarci dalla finestra dell'eclissi appena
  // vista, che è l'unico momento in cui uno ha voglia di scriverne.
  const diarioEcl = document.getElementById('btn-eclissi-diario');
  if (diarioEcl) {
    diarioEcl.addEventListener('click', () => {
      if (!_eclissiEventoInCorso) return;
      const id = _eclissiEventoInCorso.id;
      chiudiMappaEclissi();
      apriDiarioEvento(id);
    });
  }

  const offline = document.getElementById('btn-eclissi-offline');
  if (offline) {
    offline.addEventListener('click', async () => {
      const p = _eclissiPosizioneTemporanea || luogoCorrente();
      if (!p) { apriPosizione(true); return; }
      _eclAggiornaTastoOffline('Scarico le mappe…', 'in-corso');
      const esito = await _eclScaricaOffline(p.lat, ((p.lon % 360) + 540) % 360 - 180,
        (fatte, totali) => _eclAggiornaTastoOffline(`Scarico le mappe… ${fatte}/${totali}`, 'in-corso'));
      if (!esito) { _eclAggiornaTastoOffline('Salva le mappe per l\'uso offline'); return; }
      _eclAggiornaTastoOffline(
        esito.fallite >= esito.totali
          ? 'Non c\'è rete: riprova quando torna'
          : `Salvate ${esito.totali - esito.fallite} tessere: qui la mappa ora funziona senza rete`,
        esito.fallite >= esito.totali ? 'fallito' : 'fatto');
    });
  }

  const apri = document.getElementById('btn-eclissi-casa');
  if (apri) {
    apri.addEventListener('click', () => {
      // Si guarda dal punto scelto sulla mappa, che è quello di cui l'utente
      // sta leggendo i numeri in quel momento.
      const p = _eclissiPosizioneTemporanea || luogoCorrente();
      if (!p) {
        apriPosizione(true);
        return;
      }
      apriEclissiDiCasa(p.lat, ((p.lon % 360) + 540) % 360 - 180);
    });
  }
}

// =====================================================================
// 1-quinquies. LE ECLISSI LUNARI
//   Sono quelle che l'italiano medio vedra' davvero: da casa, senza
//   spostarsi, senza filtri, una totale ogni pochi anni. Fino a ora
//   avevano solo la simulazione, mentre le solari avevano tutta la mappa.
//
//   La geometria e' molto piu' semplice. Non c'e' un'ombra che corre sulla
//   Terra: la Luna entra nell'ombra terrestre e chiunque la veda in cielo
//   vede la stessa identica cosa, nello stesso identico istante. L'unica
//   domanda e' se in quel momento la Luna e' sopra l'orizzonte.
// =====================================================================

// Sotto quale altezza geometrica si considera la Luna tramontata. Non zero:
// l'atmosfera rifrange e alza di poco più di mezzo grado quello che sta sul
// filo dell'orizzonte, ed è la convenzione con cui gli almanacchi danno le
// zone di visibilità. Senza questo scarto la mappa risulterebbe più stretta
// di quelle con cui verrà confrontata.
const LUN_ORIZZONTE = -0.5;

function _lunIstante(ut) {
  const time = Astronomy.MakeTime(ut);
  const rot = Astronomy.Rotation_EQJ_EQD(time);
  const m = Astronomy.RotateVector(rot, Astronomy.GeoMoon(time));
  return { ut, time, m: [m.x, m.y, m.z], gast: Astronomy.SiderealTime(time) * 15 };
}

// Altezza della Luna sull'orizzonte da un punto della superficie. La Luna e'
// vicina: la parallasse vale quasi un grado, e va tenuta — e' proprio quella
// che allarga la zona di visibilita' oltre il mezzo pianeta esatto.
function _lunAltezza(lat, lon, d) {
  const latR = lat * ECL_RAD, thetaR = (lon + d.gast) * ECL_RAD;
  const cs = Math.cos(latR), sn = Math.sin(latR);
  const ct = Math.cos(thetaR), st = Math.sin(thetaR);
  const c = 1 / Math.sqrt(cs * cs + ECL_F2 * sn * sn);
  const rc = c * RAGGIO_TERRA_UA, rz = c * ECL_F2 * RAGGIO_TERRA_UA;
  const ux = cs * ct, uy = cs * st, uz = sn;
  const mx = d.m[0] - rc * ux, my = d.m[1] - rc * uy, mz = d.m[2] - rz * sn;
  const dm = Math.hypot(mx, my, mz);
  return Math.asin(Math.max(-1, Math.min(1, (ux * mx + uy * my + uz * mz) / dm))) / ECL_RAD;
}

// Azimut della Luna, per dire da che parte guardare
function _lunAzimut(lat, lon, d) {
  const latR = lat * ECL_RAD, thetaR = (lon + d.gast) * ECL_RAD;
  const cs = Math.cos(latR), sn = Math.sin(latR);
  const ct = Math.cos(thetaR), st = Math.sin(thetaR);
  const c = 1 / Math.sqrt(cs * cs + ECL_F2 * sn * sn);
  const rc = c * RAGGIO_TERRA_UA, rz = c * ECL_F2 * RAGGIO_TERRA_UA;
  const ux = cs * ct, uy = cs * st, uz = sn;
  const mx = d.m[0] - rc * ux, my = d.m[1] - rc * uy, mz = d.m[2] - rz * sn;
  const dm = Math.hypot(mx, my, mz);
  const orizz = Math.hypot(ux, uy);
  if (orizz < 1e-9) return null;
  const ex = -uy / orizz, ey = ux / orizz;
  const nx = -uz * ey, ny = uz * ex, nz = ux * ey - uy * ex;
  const vx = mx / dm, vy = my / dm, vz = mz / dm;
  return ((Math.atan2(vx * ex + vy * ey, vx * nx + vy * ny + vz * nz) / ECL_RAD) + 360) % 360;
}

// I contatti di un'eclissi lunare non si cercano: le semidurate calcolate
// dalla libreria, sommate e sottratte al massimo, li danno tutti.
function _lunContatti(dati) {
  const v = [];
  const agg = (min, sigla, nome) => v.push({ min, sigla, nome });
  if (dati.sdPenum > 0) agg(-dati.sdPenum, 'P1', 'Inizio della penombra');
  if (dati.sdPartial > 0) agg(-dati.sdPartial, 'U1', 'Inizio della fase parziale');
  if (dati.sdTotal > 0) agg(-dati.sdTotal, 'U2', 'Inizio della totalità');
  agg(0, '—', 'Massimo dell\'eclissi');
  if (dati.sdTotal > 0) agg(dati.sdTotal, 'U3', 'Fine della totalità');
  if (dati.sdPartial > 0) agg(dati.sdPartial, 'U4', 'Fine della fase parziale');
  if (dati.sdPenum > 0) agg(dati.sdPenum, 'P4', 'Fine della penombra');
  return v;
}

let _lunMappa = null;
let _lunStrati = [];
let _lunEventoInCorso = null;
let _lunMarkerPosizione = null;

function _lunNomeTipo(kind) {
  return kind === 'total' ? 'totale' : kind === 'partial' ? 'parziale' : 'penombrale';
}

// La regione da cui la Luna e' sopra l'orizzonte in un dato istante: un
// cerchio di raggio poco piu' che un quarto di meridiano attorno al punto
// che ha la Luna allo zenit. Quasi sempre inghiotte un polo, e li' il
// contorno per azimut non funziona — ma _eclContorno sa gia' cavarsela.
function _lunRegioneVisibile(d, nAzimut) {
  const centro = _eclVettoreALatLon(d.m, d.gast);
  return _eclContorno(centro, (la, lo) => _lunAltezza(la, lo, d) > LUN_ORIZZONTE,
                      11000, nAzimut || 72, 11);
}

function apriMappaLunare(id) {
  const evento = eventiCalcolati.find(e => e.id === id);
  if (!evento || !evento.eclissiLunare) return;
  const modale = document.getElementById('modale-lunare');
  if (!modale || typeof L === 'undefined' || typeof Astronomy === 'undefined') return;

  _lunEventoInCorso = evento;
  const titolo = document.getElementById('lunare-titolo');
  if (titolo) titolo.textContent = `${evento.titolo} — ${evento.dataTesto}`;
  modale.classList.remove('hidden');

  if (!_lunMappa) {
    _lunMappa = L.map('mappa-lunare', {
      worldCopyJump: true, minZoom: 1, zoomControl: false, attributionControl: true
    }).setView([20, 0], 1);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 6, attribution: '&copy; OpenStreetMap'
    }).addTo(_lunMappa);
    L.control.zoom({ position: 'topright' }).addTo(_lunMappa);
  }

  _lunStrati.forEach(s => _lunMappa.removeLayer(s));
  _lunStrati = [];
  if (_lunMarkerPosizione) { _lunMappa.removeLayer(_lunMarkerPosizione); _lunMarkerPosizione = null; }

  const dati = evento.eclissiLunare;
  const contatti = _lunContatti(dati);
  const primo = contatti[0], ultimo = contatti[contatti.length - 1];
  const dMax = _lunIstante(dati.peakUt);
  const dPrimo = _lunIstante(dati.peakUt + primo.min / 1440);
  const dUltimo = _lunIstante(dati.peakUt + ultimo.min / 1440);

  // Tutta la mappa lavora attorno al meridiano che ha la Luna allo zenit
  const zenit = _eclVettoreALatLon(dMax.m, dMax.gast);
  _eclRifLon = zenit[1];

  // Chi vede il massimo: la Luna e' su in quell'istante
  const alMassimo = _lunRegioneVisibile(dMax);
  if (alMassimo) {
    _lunStrati.push(L.polygon(alMassimo, {
      stroke: false, fillColor: '#a78bfa', fillOpacity: 0.18, fillRule: 'nonzero',
      interactive: false
    }).addTo(_lunMappa));
  }

  // Chi la vede dall'inizio alla fine: la Luna deve essere su in entrambi
  // gli estremi. La Terra intanto ha girato, e la zona si stringe parecchio.
  const intera = _eclContorno(zenit,
    (la, lo) => _lunAltezza(la, lo, dPrimo) > LUN_ORIZZONTE &&
                _lunAltezza(la, lo, dUltimo) > LUN_ORIZZONTE,
    11000, 72, 11);
  if (intera) {
    _lunStrati.push(L.polygon(intera, {
      stroke: false, fillColor: '#c4b5fd', fillOpacity: 0.3, fillRule: 'nonzero'
    }).bindTooltip('Da qui si vede l\'eclissi per intero, dal primo all\'ultimo contatto',
      { sticky: true }).addTo(_lunMappa));
  }

  // Il punto che ha la Luna esattamente allo zenit al massimo
  _lunStrati.push(L.circleMarker(_eclInquadraPunto(zenit), {
    radius: 6, color: '#f5f3ff', fillColor: '#8b5cf6', fillOpacity: 1, weight: 2
  }).bindTooltip(`<b>Luna allo zenit</b><br>${_eclOra(evento.dataObj)} · ` +
    `${formattaCoordinate(zenit[0], zenit[1])}`, { direction: 'top' }).addTo(_lunMappa));

  _lunAggiornaTesti(evento, contatti);

  setTimeout(() => {
    _lunMappa.invalidateSize();
    if (alMassimo) {
      const b = L.latLngBounds(alMassimo.map(p => [Math.max(-80, Math.min(80, p[0])), p[1]]));
      _lunMappa.fitBounds(b.pad(0.05));
    }
  }, 60);
}

function chiudiMappaLunare() {
  const modale = document.getElementById('modale-lunare');
  if (modale) modale.classList.add('hidden');
  _lunEventoInCorso = null;
}

// Riepilogo, contatti locali e nota sul colore
function _lunAggiornaTesti(evento, contatti) {
  const dati = evento.eclissiLunare;
  // Vale per le eclissi di Luna quanto per quelle di Sole: capitano solo
  // quando il plenilunio incrocia un nodo
  mostraStagioneEclissi('lunare-stagione', evento.dataObj);
  const riepilogo = document.getElementById('lunare-riepilogo');
  const tabella = document.getElementById('lunare-contatti');
  const luogoEl = document.getElementById('lunare-luogo');
  const nota = document.getElementById('lunare-nota');

  const durataTotale = dati.sdTotal > 0 ? dati.sdTotal * 2 : 0;
  const durataParziale = dati.sdPartial > 0 ? dati.sdPartial * 2 : 0;
  const inizio = new Date(evento.dataObj.getTime() - dati.sdPenum * 60000);
  const fine = new Date(evento.dataObj.getTime() + dati.sdPenum * 60000);

  if (riepilogo) {
    const schede = [
      { etichetta: 'Dura in tutto', valore: `${Math.round(dati.sdPenum * 2)} min`,
        nota: `dalle ${_eclOra(inizio)} alle ${_eclOra(fine)}, ora locale` },
      durataTotale > 0
        ? { etichetta: 'Totalità', valore: _eclDurataSec(durataTotale * 60),
            nota: 'la Luna è tutta dentro l\'ombra della Terra' }
        : { etichetta: 'Fase più profonda',
            valore: durataParziale > 0 ? _eclDurataSec(durataParziale * 60) : 'solo penombra',
            nota: durataParziale > 0 ? 'la Luna è in parte dentro l\'ombra'
                                     : 'la Luna sfiora solo la penombra: cambiamento appena percettibile' },
      { etichetta: 'Massimo alle', valore: _eclOra(evento.dataObj),
        nota: typeof dati.oscuramento === 'number'
          ? `${_eclPerc(dati.oscuramento)} del disco lunare in ombra` : '—' }
    ];
    riepilogo.innerHTML = schede.map(s => `
      <div class="ecl-scheda">
        <span class="ecl-scheda-etichetta">${s.etichetta}</span>
        <span class="ecl-scheda-valore">${s.valore}</span>
        <span class="ecl-scheda-nota">${s.nota}</span>
      </div>`).join('');
  }

  // I contatti valgono per tutto il pianeta: cambia solo se da casa tua la
  // Luna, in quel momento, e' sopra o sotto l'orizzonte.
  const luogo = luogoCorrente();
  if (luogoEl) {
    luogoEl.innerHTML = luogo
      ? `${formattaCoordinate(luogo.lat, luogo.lon)} <span class="ecl-fonte">(la tua posizione)</span>`
      : '<span class="ecl-fonte">nessuna posizione impostata</span>';
  }

  if (tabella) {
    let sopra = 0;
    const righe = contatti.map(c => {
      const t = new Date(evento.dataObj.getTime() + c.min * 60000);
      let stato = '';
      if (luogo) {
        const d = _lunIstante(dati.peakUt + c.min / 1440);
        const alt = _lunAltezza(luogo.lat, luogo.lon, d);
        const az = _lunAzimut(luogo.lat, luogo.lon, d);
        if (alt > LUN_ORIZZONTE) {
          sopra++;
          stato = `Luna a ${alt.toFixed(0)}°${az != null ? ` verso ${skyNomeDirezione(az)}` : ''}`;
        } else {
          stato = 'la Luna è sotto l\'orizzonte';
        }
      }
      return `
        <li class="ecl-contatto${luogo && !stato.startsWith('Luna') ? ' sotto' : ''}">
          <span class="ecl-contatto-nome">${c.nome}
            ${c.sigla !== '—' ? `<span class="lun-sigla">${c.sigla}</span>` : ''}</span>
          <span class="ecl-contatto-ora">${_eclOraSec(t)}</span>
          <span class="ecl-contatto-nota">${stato || 'imposta la posizione per sapere se da te è visibile'}</span>
        </li>`;
    }).join('');

    let avviso = '';
    if (luogo) {
      if (sopra === 0) {
        avviso = `<p class="ecl-contatti-avviso">Da qui questa eclissi non si vede: la Luna
          resta sotto l'orizzonte per tutta la sua durata.</p>`;
      } else if (sopra < contatti.length) {
        avviso = `<p class="ecl-contatti-avviso">Da qui se ne vede solo una parte: la Luna
          sorge o tramonta a eclissi iniziata. I momenti con la Luna sotto l'orizzonte sono
          barrati.</p>`;
      }
    }
    tabella.innerHTML = righe + avviso;
  }

  if (nota) {
    nota.innerHTML = dati.kind === 'total'
      ? `<p><b>Di che colore sarà?</b> Nessuno può dirlo con precisione. Durante la totalità la
         Luna non sparisce: viene illuminata dalla luce del Sole rifratta dall'atmosfera
         terrestre — la somma di tutte le albe e i tramonti del pianeta, in quel momento —
         e per questo diventa rossa. Quanto rossa dipende da com'è messa la nostra atmosfera:
         dopo una grande eruzione vulcanica, con la stratosfera carica di polveri, le eclissi
         totali sono state quasi nere.</p>
         <p>Gli osservatori la classificano a occhio con la scala di Danjon, da <b>L=0</b>
         (Luna quasi invisibile, grigio-nerastra) a <b>L=4</b> (arancione molto luminosa, con
         il bordo azzurrino). Guardala e dai il tuo voto: è una misura che si fa ancora a
         occhio nudo, e la tua vale quanto quella di chiunque altro.</p>
         <p class="ecl-nota-piccola">Si guarda tranquillamente a occhio nudo, senza nessun
         filtro: qui non c'è niente di pericoloso. Un binocolo aiuta moltissimo a cogliere
         le sfumature di colore sul bordo dell'ombra.</p>`
      : `<p>Le eclissi ${_lunNomeTipo(dati.kind)} sono più discrete di quelle totali: ${
         dati.kind === 'partial'
           ? 'un morso scuro sul bordo della Luna, netto e ben visibile a occhio nudo, ma senza il rosso della totalità.'
           : 'la Luna attraversa solo la penombra, e il calo di luminosità è così graduale che spesso ci si accorge appena che stia succedendo qualcosa. Confronta una foto a inizio e a metà eclissi: lì la differenza si vede.'}</p>
         <p class="ecl-nota-piccola">Si guarda a occhio nudo, senza filtri. Nessun pericolo.</p>`;
  }
}

function inizializzaMappaLunareUI() {
  const modale = document.getElementById('modale-lunare');
  if (!modale) return;
  ['btn-chiudi-lunare', 'btn-chiudi-lunare-basso'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', chiudiMappaLunare);
  });
  modale.addEventListener('click', (e) => { if (e.target === modale) chiudiMappaLunare(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modale.classList.contains('hidden')) chiudiMappaLunare();
  });
}

// Le tacche dei contatti sopra al cursore del tempo: danno una forma alla
// linea del tempo, che altrimenti è una barra uguale dappertutto.
function _eclDisegnaTacche(circ) {
  const el = document.getElementById('eclissi-tacche');
  if (!el) return;
  const ampiezza = _eclFinestra.fine - _eclFinestra.inizio;
  if (!circ || ampiezza <= 0) { el.innerHTML = ''; return; }

  const dove = (min) => ((min - _eclFinestra.inizio) / ampiezza) * 100;
  const segni = [];
  const segna = (contatto, classe, etichetta) => {
    if (!contatto) return;
    const pos = dove(contatto.min);
    if (pos < -1 || pos > 101) return;
    segni.push(`<span class="ecl-tacca ${classe}" style="left:${pos.toFixed(2)}%"
      title="${etichetta} · ${_eclOraSec(contatto.data)}"></span>`);
  };
  segna(circ.c1, 'contatto', 'Primo contatto');
  segna(circ.c4, 'contatto', 'Ultimo contatto');
  segna(circ.massimo, 'massimo', 'Massimo');

  // La fase centrale è una fascia, non un istante: al bordo dura pochi
  // secondi e una tacca sola non si vedrebbe.
  if (circ.c2 && circ.c3) {
    const a = dove(circ.c2.min), b = dove(circ.c3.min);
    segni.push(`<span class="ecl-tacca-fascia" style="left:${a.toFixed(2)}%;
      width:${Math.max(0.6, b - a).toFixed(2)}%"
      title="Fase centrale · ${_eclDurataSec(circ.durataCentraleSec)}"></span>`);
  }
  el.innerHTML = segni.join('');
}

// --- Testata della mappa (ora e fase globale) -------------------------

function _eclAggiornaHud(quadro) {
  const oraEl = document.getElementById('eclissi-hud-ora');
  const faseEl = document.getElementById('eclissi-hud-fase');
  const tempo = _eclissiTempoSelezionato();
  if (oraEl) {
    oraEl.innerHTML = `<b>${_eclOra(tempo)}</b><span class="ecl-hud-utc">${_eclOraUTC(tempo)} UTC</span>`;
  }
  if (faseEl) {
    let testo = 'Eclissi non ancora iniziata', classe = 'attesa';
    if (quadro && !quadro.fuoriTerra && quadro.cMax) {
      if (quadro.asse && (quadro.cMax.tipo === 'totale' || quadro.cMax.tipo === 'anulare')) {
        testo = quadro.cMax.tipo === 'anulare' ? 'Anularità in corso' : 'Totalità in corso';
        classe = 'centrale';
      } else {
        testo = `Solo fase parziale · max ${_eclPerc(quadro.cMax.osc)}`;
        classe = 'parziale';
      }
    }
    faseEl.textContent = testo;
    faseEl.className = `ecl-hud-fase ${classe}`;
  }
}

// Oltre gli 84° la proiezione di Mercatore si stira all'infinito e la carta
// finisce: se la vista sconfina lassù resta mezza finestra nera. Qui la si fa
// scorrere quel tanto che basta per riempirla di mondo.
function _eclEvitaIlVuoto() {
  if (!_mappaEclissi) return;
  const misura = _mappaEclissi.getSize();
  const zoom = _mappaEclissi.getZoom();
  const altezzaMondo = _mappaEclissi.project([-85.05, 0], zoom).y -
                       _mappaEclissi.project([85.05, 0], zoom).y;
  // Se la finestra è più alta di tutta la carta il vuoto è inevitabile:
  // spostarsi non servirebbe a niente, se non a far ballare la mappa.
  if (altezzaMondo <= misura.y) return;
  const vista = _mappaEclissi.getBounds();
  if (vista.getNorth() > 84) {
    const y = _mappaEclissi.latLngToContainerPoint([84, vista.getCenter().lng]).y;
    if (y > 0) _mappaEclissi.panBy([0, y], { animate: false });
  } else if (vista.getSouth() < -84) {
    const y = _mappaEclissi.latLngToContainerPoint([-84, vista.getCenter().lng]).y;
    if (y < misura.y) _mappaEclissi.panBy([0, y - misura.y], { animate: false });
  }
}

// La fase centrale, al bordo della fascia, dura pochi secondi: guardando la
// mappa scorrere ci si accorge a stento di esserci passati sopra. Il telefono
// lo racconta con una vibrazione, come farebbe con una notifica.
let _eclEraCentrale = false;

function _eclSegnalaFaseCentrale() {
  const dossier = _eclCacheLocale.valore;
  const circ = dossier && dossier.circ;
  const dentro = !!(circ && circ.c2 && circ.c3 &&
    _eclissiOffsetTempoMin >= circ.c2.min && _eclissiOffsetTempoMin <= circ.c3.min);
  if (dentro === _eclEraCentrale) return;
  _eclEraCentrale = dentro;
  // Solo durante il filmato: chi trascina il cursore a mano sa gia' dove sta
  // andando, e una vibrazione a ogni passaggio sarebbe fastidiosa.
  if (dentro && _eclFilmato.attivo && navigator.vibrate) {
    try { navigator.vibrate([40, 60, 140]); } catch (e) { /* non ovunque si puo' */ }
  }
}

// --- Il ciclo di aggiornamento ----------------------------------------

function _eclissiAggiornaTutto() {
  const slider = document.getElementById('eclissi-tempo-slider');
  const valore = document.getElementById('eclissi-tempo-valore');
  if (slider) slider.value = _eclissiOffsetTempoMin;
  if (valore) {
    const m = Math.round(_eclissiOffsetTempoMin);
    const segno = m > 0 ? '+' : '';
    valore.innerHTML = `${_eclOra(_eclissiTempoSelezionato())} ` +
      `<span class="ecl-scarto">${m === 0 ? 'culmine' : `${segno}${m} min`}</span>`;
  }

  const quadro = _eclDisegnaOmbra();
  if (!quadro) return;
  _eclSegnalaFaseCentrale();
  _eclAggiornaHud(quadro);
  _eclAggiornaPannelloCitta(quadro);
  _eclissiAggiornaDatiLocali(quadro);

  // Con "segui l'ombra" la mappa insegue il cono, ma senza strattoni: si
  // rimette al centro solo quando l'ombra sta per uscire dal riquadro
  // centrale, come una telecamera che accompagna il soggetto.
  if (_eclFilmato.segui && _eclFilmato.attivo && quadro.massimo) {
    const centro = quadro.asse || quadro.massimo;
    const punto = _mappaEclissi.latLngToContainerPoint(centro);
    const misura = _mappaEclissi.getSize();
    const fuori = punto.x < misura.x * 0.3 || punto.x > misura.x * 0.7 ||
                  punto.y < misura.y * 0.3 || punto.y > misura.y * 0.7;
    // L'animazione va evitata: a ogni fotogramma ripartirebbe da capo e la
    // mappa resterebbe ferma.
    if (fuori) { _mappaEclissi.panTo(centro, { animate: false }); _eclEvitaIlVuoto(); }
  }
}

// --- Il filmato --------------------------------------------------------

function _eclFilmatoAggiornaPulsante() {
  const btn = document.getElementById('eclissi-play');
  if (!btn) return;
  btn.classList.toggle('in-corso', _eclFilmato.attivo);
  btn.setAttribute('aria-label', _eclFilmato.attivo ? 'Metti in pausa' : 'Avvia il filmato');
  btn.title = _eclFilmato.attivo ? 'Metti in pausa' : 'Avvia il filmato dell\'ombra';
  btn.innerHTML = _eclFilmato.attivo
    ? '<span class="ecl-icona-pausa"></span><span class="ecl-play-testo">Pausa</span>'
    : '<span class="ecl-icona-play"></span><span class="ecl-play-testo">Riproduci</span>';
}

function _eclFilmatoAvvia() {
  if (_eclFilmato.attivo || !_eclissiEventoInCorso) return;
  // Ripartendo dalla fine si torna all'inizio, come un vero lettore
  if (_eclissiOffsetTempoMin >= _eclFinestra.fine - 0.5) {
    _eclissiOffsetTempoMin = _eclFinestra.inizio;
  }
  _eclFilmato.attivo = true;
  _eclFilmatoAggiornaPulsante();
  const intervallo = 90; // ms fra un fotogramma e l'altro
  _eclFilmato.timer = setInterval(() => {
    _eclissiOffsetTempoMin += _eclFilmato.velocita * (intervallo / 1000);
    if (_eclissiOffsetTempoMin >= _eclFinestra.fine) {
      _eclissiOffsetTempoMin = _eclFinestra.fine;
      _eclissiAggiornaTutto();
      _eclFilmatoFerma();
      return;
    }
    _eclissiAggiornaTutto();
  }, intervallo);
}

function _eclFilmatoFerma() {
  if (_eclFilmato.timer) clearInterval(_eclFilmato.timer);
  _eclFilmato.timer = null;
  _eclFilmato.attivo = false;
  _eclFilmatoAggiornaPulsante();
  _eclissiAggiornaTutto(); // ridisegna con la risoluzione piena
}

function _eclFilmatoAlterna() {
  if (_eclFilmato.attivo) _eclFilmatoFerma(); else _eclFilmatoAvvia();
}

// Sposta il tempo restando dentro la finestra dell'eclissi
function _eclVaiA(minuti) {
  _eclissiOffsetTempoMin = Math.max(_eclFinestra.inizio, Math.min(_eclFinestra.fine, minuti));
  _eclissiAggiornaTutto();
}

// --- Legenda e riepilogo ----------------------------------------------

function _eclAggiornaLegenda(evento, riepilogo) {
  const legenda = document.getElementById('eclissi-legenda-griglia');
  const sottotitolo = document.getElementById('mappa-sottotitolo');
  const riep = document.getElementById('eclissi-riepilogo');
  if (!legenda) return;

  const kind = evento.eclissi.kind;
  const centrale = kind === 'total' || kind === 'annular' || kind === 'hybrid';
  const nomeCentrale = _eclNomeCentrale(kind);
  // I campioni della legenda devono avere gli stessi colori che ha la mappa
  // in questo momento: cambiando tema cambiano anche loro, se no la legenda
  // spiegherebbe una mappa che non è quella sotto gli occhi.
  const tav = _eclTav();
  const ombra = kind === 'annular' ? tav.umbraAnulare : tav.umbra;
  const coloreOmbra = ombra.bordo;
  const riempOmbra = ombra.dentro;
  const stileFascia = `background:${_eclVelo(tav.totale.colore, tav.totale.opacita + 0.08)};` +
    `border-color:${tav.totale.colore}`;
  const stileParziale = `background:${_eclVelo(tav.parziale.colore, tav.parziale.opacita + 0.04)};` +
    `border-color:${_eclVelo(tav.isocrona.colore, 0.7)}`;
  const stilePenombra = 'background: radial-gradient(circle,' + tav.fasce.slice().reverse()
    .map((f, i) => {
      const da = i * 25, a = (i + 1) * 25;
      const c = _eclVelo(f.colore, Math.min(0.9, f.opacita * 3.4 + 0.2));
      return ` ${c} ${da}%, ${c} ${a}%`;
    }).join(',') + `); border-color:${_eclVelo(tav.fasce[0].colore, 0.6)}`;

  const voci = [];
  if (centrale) {
    voci.push({
      campione: `<span class="ecl-sw ecl-sw-fascia" style="${stileFascia}"></span>`,
      titolo: `Fascia di ${nomeCentrale}`,
      testo: 'La striscia di Terra da cui il Sole sparisce del tutto. È larga poche decine o centinaia di km: fuori di qui la totalità non si vede.'
    });
    voci.push({
      campione: `<span class="ecl-sw ecl-sw-linea" style="border-top-color:${tav.centrale}"></span>`,
      titolo: 'Linea centrale',
      testo: `Il cuore della fascia: qui la ${nomeCentrale} dura più a lungo.`
    });
    voci.push({
      campione: `<span class="ecl-sw ecl-sw-ombra" style="background:${riempOmbra};border-color:${coloreOmbra}"></span>`,
      titolo: 'Cono d\'ombra adesso',
      testo: `Dove si trova l'ombra in questo istante. Corre sulla Terra a più di 1.500 km/h: è la macchia che si muove nel filmato.`
    });
  }
  voci.push({
    campione: `<span class="ecl-sw ecl-sw-parziale" style="${stileParziale}"></span>`,
    titolo: 'Zona di eclissi parziale (tutta l\'eclissi)',
    testo: 'Il velo azzurro copre tutti i luoghi che, prima o poi, vedranno il Sole intaccato dalla Luna. È molto più esteso della fascia centrale.'
  });
  voci.push({
    campione: `<span class="ecl-sw ecl-sw-penombra" style="${stilePenombra}"></span>`,
    titolo: 'Penombra adesso',
    testo: 'La regione che in questo istante vede un\'eclissi parziale. I gradini di colore, andando verso il centro, sono 25%, 50% e 75% di Sole coperto.'
  });
  if (_eclMostraNotte) {
    // Il campione è la mappa in piccolo: metà chiara, metà velata, con il
    // terminatore in mezzo.
    const veloNotte = _eclVelo(tav.notte.colore, tav.notte.veli[0] + 0.10);
    const veloFondo = _eclVelo(tav.notte.colore, tav.notte.veli[0] + 0.26);
    const stileNotte = `background: linear-gradient(100deg,` +
      ` rgba(0,0,0,0) 44%, ${tav.notte.linea} 44%, ${tav.notte.linea} 47%,` +
      ` ${veloNotte} 47%, ${veloNotte} 72%, ${veloFondo} 72%);` +
      `border-color:${_eclVelo(tav.notte.linea, 0.55)}`;
    voci.push({
      campione: `<span class="ecl-sw ecl-sw-notte" style="${stileNotte}"></span>`,
      titolo: 'Dov\'è notte in questo istante',
      testo: 'Il velo copre la metà di Terra in cui il Sole è già tramontato, e il suo bordo è il terminatore: la linea che separa il giorno dalla notte. Più il velo è fitto, più il Sole è sceso — il primo gradino è il crepuscolo, l\'ultimo la notte piena. L\'eclissi si vede solo dalla parte illuminata: dove passa questa linea, il Sole sta sorgendo o tramontando eclissato.'
    });
  }
  voci.push({
    campione: `<span class="ecl-sw ecl-sw-citta" style="border-color:${tav.citta.bordoAttivo}"></span>`,
    titolo: 'Città toccate',
    testo: `Ogni pallino è una città che vede l'eclissi; il colore dice quanto Sole le verrà coperto al massimo. Quella cerchiata di ${_eclTemaMappa === 'chiara' ? 'scuro' : 'bianco'} è la più in ombra adesso.`
  });
  voci.push({
    campione: `<span class="ecl-sw ecl-sw-osservatore" style="background:${tav.osservatore.dentro};border-color:${tav.osservatore.bordo}"></span>`,
    titolo: 'Il tuo punto di osservazione',
    testo: 'Parte dalla tua posizione. Tocca un punto qualsiasi della mappa (o una città in elenco) per spostarlo.'
  });

  legenda.innerHTML = voci.map(v => `
    <div class="ecl-voce">
      <span class="ecl-voce-campione">${v.campione}</span>
      <span class="ecl-voce-testo"><b>${v.titolo}</b><span>${v.testo}</span></span>
    </div>`).join('');

  if (sottotitolo) {
    sottotitolo.textContent = centrale
      ? `Il cono d'ombra della Luna attraversa la Terra: segui il suo percorso e le città che incontra.`
      : `Nessuna fascia di totalità: l'ombra passa accanto alla Terra e resta solo la penombra, cioè un'eclissi parziale.`;
  }

  if (riep && riepilogo) riep.innerHTML = riepilogo;

  const schema = document.getElementById('eclissi-schema');
  if (schema) schema.innerHTML = _eclSchemaGeometria(kind);
}

// --- Lo schema: la geometria vista dall'alto e la curva a S -------------
//
// Due disegni, uno sopra l'altro:
//   1) come si dispongono Sole, Luna e Terra visti dal polo nord, con il
//      cono d'ombra che sfiora la superficie;
//   2) perché quella traccia, aperta su una mappa piatta, diventa una
//      sinusoide: è un arco di cerchio massimo inclinato sull'equatore.
// Gli SVG sono statici (nessun dato dell'eclissi in corso) tranne il colore
// del cono e il caso anulare, in cui la punta dell'ombra non arriva a terra.

// La latitudine di un cerchio massimo inclinato di `i` a una data longitudine:
// è la funzione che, disegnata su una mappa lat/lon, dà la curva a S.
function _eclSchemaLat(lon, i) {
  return Math.atan(Math.tan(i) * Math.sin(lon));
}

// Il cerchio massimo inclinato visto sul globo (proiezione ortografica da un
// punto dell'equatore): torna la parte davanti o quella dietro, a scelta.
function _eclSchemaTracciaGlobo(cx, cy, R, incl, lon0, davanti, lonDa = -180, lonA = 180) {
  const i = incl * Math.PI / 180, l0 = lon0 * Math.PI / 180;
  const pezzi = [];
  let corrente = [];
  for (let g = -180; g <= 180; g += 2) {
    const a = g * Math.PI / 180;
    const lat = Math.asin(Math.sin(i) * Math.sin(a));
    const lonGeo = Math.atan2(Math.cos(i) * Math.sin(a), Math.cos(a)) * 180 / Math.PI;
    const lon = lonGeo * Math.PI / 180 - l0;
    if (lonGeo < lonDa || lonGeo > lonA || (Math.cos(lat) * Math.cos(lon) > 0) !== davanti) {
      if (corrente.length > 1) pezzi.push(corrente);
      corrente = [];
      continue;
    }
    corrente.push(`${(cx + R * Math.cos(lat) * Math.sin(lon)).toFixed(1)},${(cy - R * Math.sin(lat)).toFixed(1)}`);
  }
  if (corrente.length > 1) pezzi.push(corrente);
  return pezzi.map(p => 'M' + p.join('L')).join(' ');
}

// La stessa traccia su una mappa rettangolare: longitudini da `da` a `a`.
function _eclSchemaTracciaMappa(x0, x1, ymid, hMezza, incl, da, a) {
  const i = incl * Math.PI / 180;
  const punti = [];
  for (let g = da; g <= a; g += 2) {
    const x = x0 + (x1 - x0) * (g + 180) / 360;
    const y = ymid - hMezza * (_eclSchemaLat(g * Math.PI / 180, i) / (Math.PI / 2));
    punti.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return 'M' + punti.join('L');
}

function _eclSchemaGeometria(kind) {
  const anulare = kind === 'annular';
  const coloreOmbra = anulare ? '#fbbf24' : '#ff5f5f';
  const nomeCentrale = _eclNomeCentrale(kind);
  const INCL = 40;      // inclinazione della traccia sull'equatore, nel disegno
  const CX = 95, CY = 135, R = 72;                 // il globo
  const X0 = 282, X1 = 600, YM = 135, HM = 70;      // la mappa piatta

  // Il cono: nelle eclissi anulari la punta cade prima della Terra e a terra
  // arriva l'antiumbra, che si riallarga (il Sole sporge tutt'intorno).
  const puntaX = anulare ? 424 : 520;
  const cono = `M252,112 L${puntaX},125 L252,138 Z`;
  // L'antiumbra parte dalla punta del cono e si riallarga fino al suolo.
  const antiumbra = anulare
    ? `<path d="M424,125 L492,102 L492,148 Z" fill="rgba(245,181,68,0.22)" stroke="#fbbf24"
             stroke-width="1" stroke-dasharray="3 3"/>`
    : '';

  const svgGeometria = `
  <svg class="ecl-schema-svg" viewBox="0 0 620 250" role="img"
       aria-label="Schema visto dall'alto: il Sole a sinistra, la Luna al centro con il suo cono d'ombra, la Terra a destra colpita dall'ombra.">
    <defs>
      <radialGradient id="eclSole" cx="30%" cy="50%" r="70%">
        <stop offset="0%" stop-color="#fff6d8"/>
        <stop offset="55%" stop-color="#fbbf24"/>
        <stop offset="100%" stop-color="#f59e0b"/>
      </radialGradient>
      <linearGradient id="eclLuna" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#eef2fb"/>
        <stop offset="50%" stop-color="#8f98ad"/>
        <stop offset="100%" stop-color="#343b4c"/>
      </linearGradient>
      <linearGradient id="eclTerra" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#6fb2ff"/>
        <stop offset="45%" stop-color="#2a6fd6"/>
        <stop offset="100%" stop-color="#080e1c"/>
      </linearGradient>
      <clipPath id="eclClipTerra"><circle cx="530" cy="125" r="74"/></clipPath>
      <!-- i coni si fermano dove incontrano la Terra: il resto è dietro il globo -->
      <mask id="eclFuoriTerra">
        <rect x="0" y="0" width="620" height="250" fill="#fff"/>
        <circle cx="530" cy="125" r="75" fill="#000"/>
      </mask>
      <marker id="eclFrAmbra" viewBox="0 0 10 10" refX="8" refY="5"
              markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,1 L9,5 L0,9 z" fill="#fbbf24"/>
      </marker>
      <marker id="eclFrChiara" viewBox="0 0 10 10" refX="8" refY="5"
              markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,1 L9,5 L0,9 z" fill="#a9b4cc"/>
      </marker>
      <marker id="eclFrOmbra" viewBox="0 0 10 10" refX="8" refY="5"
              markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,1 L9,5 L0,9 z" fill="${coloreOmbra}"/>
      </marker>
    </defs>

    <g mask="url(#eclFuoriTerra)">
      <!-- la penombra: il cono che si allarga, dove il Sole è coperto solo in parte -->
      <path d="M252,106 L524,18 L524,232 L252,144 Z"
            fill="rgba(99,102,241,0.16)" stroke="rgba(125,211,252,0.32)"
            stroke-width="1" stroke-dasharray="4 4"/>
      <!-- il cono d'ombra vero e proprio -->
      <path d="${cono}" fill="rgba(5,7,15,0.92)" stroke="${coloreOmbra}" stroke-width="1.2"/>
      ${antiumbra}
    </g>

    <!-- i raggi del Sole -->
    <g stroke="#fbbf24" stroke-width="1.4" opacity="0.5" marker-end="url(#eclFrAmbra)">
      <path d="M80,66 L236,108"/><path d="M80,125 L232,125"/><path d="M80,184 L236,142"/>
    </g>

    <!-- il Sole -->
    <circle cx="2" cy="125" r="72" fill="url(#eclSole)"/>
    <text x="16" y="131" class="sk-scura">Sole</text>

    <!-- l'orbita della Luna attorno alla Terra e la Luna -->
    <path d="M264,44 A278,278 0 0 0 264,206" fill="none" stroke="#a9b4cc"
          stroke-width="1.2" stroke-dasharray="5 5" opacity="0.6" marker-end="url(#eclFrChiara)"/>
    <text x="250" y="228" text-anchor="middle" class="sk-n">orbita della Luna</text>
    <circle cx="252" cy="125" r="15" fill="url(#eclLuna)" stroke="rgba(233,237,247,0.45)" stroke-width="1"/>
    <text x="234" y="103" text-anchor="end" class="sk-t">Luna</text>

    <!-- la Terra vista dal polo nord: il giorno è la metà rivolta al Sole -->
    <circle cx="530" cy="125" r="74" fill="url(#eclTerra)" stroke="rgba(148,168,214,0.35)" stroke-width="1"/>
    <g clip-path="url(#eclClipTerra)">
      <ellipse cx="452" cy="125" rx="46" ry="112" fill="rgba(99,102,241,0.45)"/>
      <ellipse cx="459" cy="125" rx="8" ry="17" fill="#05070f"
               stroke="${coloreOmbra}" stroke-width="2"/>
    </g>
    <path d="M552,99 A34,34 0 0 0 501,108" fill="none" stroke="#a9b4cc" stroke-width="1.4"
          opacity="0.8" marker-end="url(#eclFrChiara)"/>
    <circle cx="530" cy="125" r="3" fill="#e9edf7"/>
    <text x="539" y="122" class="sk-n sk-chiara">polo N</text>
    <text x="530" y="72" text-anchor="middle" class="sk-n sk-chiara">rotazione</text>
    <text x="530" y="214" text-anchor="middle" class="sk-t">Terra</text>
    <path d="M447,150 Q441,174 451,192" fill="none" stroke="${coloreOmbra}" stroke-width="1.8"
          marker-end="url(#eclFrOmbra)"/>
    <text x="418" y="212" text-anchor="end" class="sk-l">l'ombra corre<tspan x="418" dy="13">sulla superficie</tspan></text>

    <!-- le etichette delle due zone -->
    <text x="372" y="88" text-anchor="middle" class="sk-l">penombra → eclissi parziale</text>
    <path d="M340,168 L344,132" stroke="rgba(148,168,214,0.5)" stroke-width="1"/>
    <text x="338" y="182" text-anchor="middle" class="sk-l">cono d'ombra → ${nomeCentrale}</text>

    <text x="612" y="244" text-anchor="end" class="sk-n">Distanze e dimensioni non sono in scala.</text>
  </svg>`;

  const svgSinusoide = `
  <svg class="ecl-schema-svg" viewBox="0 0 620 260" role="img"
       aria-label="A sinistra il globo con la traccia inclinata dell'ombra, a destra la stessa traccia su una mappa piatta, dove diventa una sinusoide.">
    <defs>
      <marker id="eclFrB" viewBox="0 0 10 10" refX="8" refY="5"
              markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,1 L9,5 L0,9 z" fill="#a9b4cc"/>
      </marker>
      <marker id="eclFrB2" viewBox="0 0 10 10" refX="8" refY="5"
              markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,1 L9,5 L0,9 z" fill="#fbbf24"/>
      </marker>
    </defs>

    <!-- IL GLOBO: la traccia è un cerchio massimo inclinato sull'equatore -->
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="#0d1728" stroke="rgba(148,168,214,0.35)" stroke-width="1"/>
    <g stroke="rgba(148,168,214,0.22)" stroke-width="1" fill="none">
      ${[-60, -30, 30, 60].map(f => {
        const r = f * Math.PI / 180;
        return `<path d="M${(CX - R * Math.cos(r)).toFixed(1)},${(CY - R * Math.sin(r)).toFixed(1)} L${(CX + R * Math.cos(r)).toFixed(1)},${(CY - R * Math.sin(r)).toFixed(1)}"/>`;
      }).join('')}
      ${[30, 60].map(d => `<ellipse cx="${CX}" cy="${CY}" rx="${(R * Math.sin(d * Math.PI / 180)).toFixed(1)}" ry="${R}"/>`).join('')}
      <path d="M${CX},${CY - R} L${CX},${CY + R}"/>
    </g>
    <path d="M${CX - R},${CY} L${CX + R},${CY}" stroke="rgba(125,211,252,0.7)" stroke-width="1.3"/>
    <text x="${CX + R - 4}" y="${CY + 15}" text-anchor="end" class="sk-n">equatore</text>
    <path d="${_eclSchemaTracciaGlobo(CX, CY, R, INCL, 20, false)}" fill="none"
          stroke="#fbbf24" stroke-width="1.4" stroke-dasharray="4 4" opacity="0.4"/>
    <path d="${_eclSchemaTracciaGlobo(CX, CY, R, INCL, 20, true)}" fill="none"
          stroke="#fbbf24" stroke-width="1.4" stroke-dasharray="4 4" opacity="0.55"/>
    <path d="${_eclSchemaTracciaGlobo(CX, CY, R, INCL, 20, true, -46, 64)}" fill="none"
          stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
    ${(() => {
      const lat = _eclSchemaLat(10 * Math.PI / 180, INCL * Math.PI / 180);
      const dl = (10 - 20) * Math.PI / 180;
      return `<circle cx="${(CX + R * Math.cos(lat) * Math.sin(dl)).toFixed(1)}" cy="${(CY - R * Math.sin(lat)).toFixed(1)}" r="5" fill="#05070f" stroke="${coloreOmbra}" stroke-width="2"/>`;
    })()}
    <text x="${CX}" y="${CY + R + 26}" text-anchor="middle" class="sk-t">La traccia sul globo</text>
    <text x="${CX}" y="${CY + R + 41}" text-anchor="middle" class="sk-n">un arco di cerchio inclinato di ~${INCL}°</text>

    <!-- il passaggio dalla sfera alla carta -->
    <path d="M180,135 L242,135" stroke="#a9b4cc" stroke-width="1.6" marker-end="url(#eclFrB)"/>
    <text x="209" y="124" text-anchor="middle" class="sk-n">srotola</text>

    <!-- LA MAPPA PIATTA: la stessa traccia diventa una sinusoide -->
    <rect x="${X0}" y="${YM - HM}" width="${X1 - X0}" height="${HM * 2}" rx="8"
          fill="rgba(8,11,20,0.6)" stroke="rgba(148,168,214,0.26)" stroke-width="1"/>
    <g stroke="rgba(148,168,214,0.16)" stroke-width="1">
      ${[1, 2, 3, 4, 5].map(k => {
        const x = (X0 + (X1 - X0) * k / 6).toFixed(1);
        return `<path d="M${x},${YM - HM} L${x},${YM + HM}"/>`;
      }).join('')}
      ${[-60, 60].map(f => {
        const y = (YM - HM * f / 90).toFixed(1);
        return `<path d="M${X0},${y} L${X1},${y}"/>`;
      }).join('')}
    </g>
    <path d="M${X0},${YM} L${X1},${YM}" stroke="rgba(125,211,252,0.7)" stroke-width="1.3"/>
    <text x="${X0 - 6}" y="${YM - HM * 60 / 90 + 4}" text-anchor="end" class="sk-n">+60°</text>
    <text x="${X0 - 6}" y="${YM + 4}" text-anchor="end" class="sk-n">0°</text>
    <text x="${X0 - 6}" y="${YM + HM * 60 / 90 + 4}" text-anchor="end" class="sk-n">−60°</text>
    <path d="${_eclSchemaTracciaMappa(X0, X1, YM, HM, INCL, -180, 180)}" fill="none"
          stroke="#fbbf24" stroke-width="1.4" stroke-dasharray="4 4" opacity="0.4"/>
    <path d="${_eclSchemaTracciaMappa(X0, X1, YM, HM, INCL, -46, 64)}" fill="none"
          stroke="#fbbf24" stroke-width="3" stroke-linecap="round" marker-end="url(#eclFrB2)"/>
    ${(() => {
      const x = X0 + (X1 - X0) * (10 + 180) / 360;
      const y = YM - HM * (_eclSchemaLat(10 * Math.PI / 180, INCL * Math.PI / 180) / (Math.PI / 2));
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#05070f" stroke="${coloreOmbra}" stroke-width="2"/>`;
    })()}
    <text x="${(X0 + X1) / 2}" y="${YM + HM + 26}" text-anchor="middle" class="sk-t">La stessa traccia sulla mappa</text>
    <text x="${(X0 + X1) / 2}" y="${YM + HM + 41}" text-anchor="middle" class="sk-n">la parte accesa è il tratto percorso dall'ombra</text>
  </svg>`;

  return `
    <figure class="ecl-schema-fig">
      ${svgGeometria}
      <figcaption>Vista dall'alto, dal polo nord: Sole, Luna e Terra quasi in fila. La Luna proietta
      un cono d'ombra lungo circa 370.000 km che arriva a malapena a toccare la Terra: sulla superficie
      ne resta una macchia larga poche decine o centinaia di chilometri.</figcaption>
    </figure>
    <figure class="ecl-schema-fig">
      ${svgSinusoide}
      <figcaption>L'ombra viaggia quasi in linea retta nello spazio, ma il suolo che incontra è una
      sfera: il punto di contatto descrive un arco inclinato rispetto all'equatore. Aperto su una mappa
      piatta, quell'arco diventa una sinusoide — la curva a S che vedi qui sopra.</figcaption>
    </figure>
    <ul class="ecl-schema-note">
      <li><b>Perché è inclinata.</b> L'ombra segue la Luna, che non corre sull'equatore: a seconda del
      mese può trovarsi fino a ~28° a nord o a sud, e l'arco che disegna è inclinato di altrettanto.</li>
      <li><b>Perché va verso Est.</b> La Luna avanza sulla sua orbita a circa 1 km/s, la superficie
      terrestre ruota nello stesso verso ma solo a 0,46 km/s all'equatore: vince la Luna, così l'ombra
      scivola da ovest verso est a oltre 1.500 km/h.</li>
      <li><b>Perché la S non è perfetta.</b> La Terra ruota mentre l'ombra la attraversa e il cono
      incontra la superficie di sbieco vicino ai poli: la curva si allunga e si incurva più del dovuto,
      ma la forma a S resta riconoscibile.</li>
    </ul>`;
}

// Riepilogo testuale sopra la mappa: durata, massimo, città migliori.
function _eclCostruisciRiepilogo(evento) {
  const kind = evento.eclissi.kind;
  const centrale = kind === 'total' || kind === 'annular' || kind === 'hybrid';
  const inizio = new Date(evento.dataObj.getTime() + _eclFinestra.inizio * 60000);
  const fine = new Date(evento.dataObj.getTime() + _eclFinestra.fine * 60000);
  const dMax = _eclIstante(evento.eclissi.peakUt);
  const pMax = _eclPuntoMassimo(dMax);
  const cMax = pMax ? _eclCircostanze(pMax[0], pMax[1], dMax) : null;

  const totali = _eclCitta.filter(c => c.tipoMax === 'totale' || c.tipoMax === 'anulare');
  const migliori = (totali.length ? totali : _eclCitta).slice(0, 4);

  const schede = [
    { etichetta: 'Quando', valore: _eclQuantoManca(evento.dataObj),
      nota: evento.dataObj.toLocaleDateString('it-IT',
        { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) },
    { etichetta: 'Sulla Terra dalle', valore: `${_eclOra(inizio)} alle ${_eclOra(fine)}`,
      nota: `${Math.round(_eclFinestra.fine - _eclFinestra.inizio)} minuti in tutto (ora locale)` },
    { etichetta: 'Massimo alle', valore: _eclOra(evento.dataObj),
      nota: cMax ? `${_eclPerc(cMax.osc)} di Sole coperto, a ${formattaCoordinate(pMax[0], pMax[1])}` : '—' },
    { etichetta: centrale ? 'Città nella fascia centrale' : 'Città che la vedono',
      valore: centrale ? String(totali.length) : String(_eclCitta.length),
      nota: migliori.length ? migliori.map(c => c.nome).join(', ') : 'nessuna fra quelle in elenco' }
  ];
  return schede.map(s => `
    <div class="ecl-scheda">
      <span class="ecl-scheda-etichetta">${s.etichetta}</span>
      <span class="ecl-scheda-valore">${s.valore}</span>
      <span class="ecl-scheda-nota">${s.nota}</span>
    </div>`).join('');
}

// --- Apertura e chiusura ----------------------------------------------

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

  // Il filmato dell'eclissi precedente va fermato prima di cambiare evento,
  // altrimenti un ultimo fotogramma disegnerebbe l'ombra nuova sui dati vecchi.
  if (_eclFilmato.attivo) _eclFilmatoFerma();

  if (titoloEl) titoloEl.textContent = `${evento.titolo} — ${evento.dataTesto}`;
  modale.classList.remove('hidden');

  _eclissiEventoInCorso = evento;
  _eclissiPosizioneTemporanea = null;
  _eclCittaEvidenziata = -1;
  _eclEraCentrale = false;

  // "L'ho vista" ha senso solo dopo che è passata: prima non c'è niente da
  // raccontare, e il tasto sarebbe solo un invito a mentire al diario.
  const tastoDiario = document.getElementById('btn-eclissi-diario');
  if (tastoDiario) {
    tastoDiario.classList.toggle('hidden', evento.dataObj.getTime() > Date.now());
  }

  // Inizializza la mappa la prima volta
  if (!_mappaEclissi) {
    _mappaEclissi = L.map('mappa-eclissi', {
      worldCopyJump: true, minZoom: 1, zoomControl: false, attributionControl: true
    }).setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 8, attribution: '&copy; OpenStreetMap'
    }).addTo(_mappaEclissi);
    // Il velo del giorno e della notte ha un riquadro tutto suo, appena sopra
    // le tessere: così l'ombra, le isocrone e le città gli restano sempre
    // sopra, per quanto tardi vengano aggiunte alla mappa.
    _mappaEclissi.createPane('ecl-notte');
    _mappaEclissi.getPane('ecl-notte').style.zIndex = 350;
    // I comandi dello zoom vanno a destra: a sinistra c'è l'orologio
    L.control.zoom({ position: 'topright' }).addTo(_mappaEclissi);
    // Le tessere si mostrano com'è la mappa vera, chiara: è il tema di partenza
    _eclApplicaTemaMappa();

    // Un tocco sulla mappa sposta l'osservatore
    _mappaEclissi.on('click', (e) => {
      _eclissiPosizioneTemporanea = { lat: e.latlng.lat, lon: e.latlng.lng };
      _eclissiAggiornaTutto();
    });
    // Trascinando la mappa si smette di inseguire l'ombra
    _mappaEclissi.on('dragstart', () => {
      const casella = document.getElementById('eclissi-segui');
      if (_eclFilmato.segui && casella) { _eclFilmato.segui = false; casella.checked = false; }
    });
  }

  // Ripulisce i tracciati dell'eclissi precedente
  _mappaStrati.forEach(s => _mappaEclissi.removeLayer(s));
  _mappaStrati = [];
  _eclStratiFissi = { parziale: null, isocrone: [], totale: null, centrale: null, massimo: null };
  _eclCittaMarker.forEach(m => _mappaEclissi.removeLayer(m));
  _eclCittaMarker = [];
  if (_eclissiMarkerPosizione) {
    _mappaEclissi.removeLayer(_eclissiMarkerPosizione);
    _eclissiMarkerPosizione = null;
  }
  _eclSvuotaDinamici();

  // Ricostruisce l'eclissi: finestra temporale, percorso, città
  const peakUt = evento.eclissi.peakUt;
  _eclFinestra = _eclFinestraGlobale(peakUt);
  _eclPercorso = _eclCampionaPercorso(peakUt, _eclFinestra);
  _eclCitta = _eclPreparaCitta(peakUt, _eclFinestra);
  _eclissiOffsetTempoMin = 0;

  // Zona di eclissi parziale: la penombra di tutti gli istanti, tutta insieme.
  // Con la regola di riempimento "nonzero" gli anelli sovrapposti si fondono
  // in una macchia sola, senza cuciture e senza zone più scure.
  if (_eclPercorso.regioneParziale.length) {
    const p = L.polygon(_eclPercorso.regioneParziale, {
      stroke: false, fillColor: _eclTav().parziale.colore, fillOpacity: _eclTav().parziale.opacita,
      fillRule: 'nonzero', interactive: false, smoothFactor: 1.4
    }).addTo(_mappaEclissi);
    _mappaStrati.push(p);
    _eclStratiFissi.parziale = p;
  }

  // Isocrone: dov'era (o dove sarà) la penombra di ora in ora. Danno il verso
  // della corsa senza bisogno di far partire il filmato.
  _eclPercorso.isocrone.forEach(iso => {
    const linea = _eclLineaContorno(iso.anello);
    if (linea.length < 2) return;
    const ora = _eclOra(new Date(evento.dataObj.getTime() + iso.min * 60000));
    const l = L.polyline(linea, {
      color: _eclTav().isocrona.colore, weight: 1, opacity: _eclTav().isocrona.opacita,
      dashArray: '3 7', smoothFactor: 1.4
    }).bindTooltip(`Penombra alle ${ora}: qui il Sole comincia a essere intaccato`,
      { sticky: true }).addTo(_mappaEclissi);
    _mappaStrati.push(l);
    _eclStratiFissi.isocrone.push(l);
  });

  // Fascia di totalità/anularità: la striscia che conta davvero. Anche questa
  // è l'unione di tante ombre istantanee, così resta pulita pure ai poli.
  if (_eclPercorso.regioneTotale.length) {
    const p = L.polygon(_eclPercorso.regioneTotale, {
      stroke: false, fillColor: _eclTav().totale.colore, fillOpacity: _eclTav().totale.opacita,
      fillRule: 'nonzero', smoothFactor: 1
    }).addTo(_mappaEclissi);
    p.bindTooltip(`Fascia di ${_eclNomeCentrale(evento.eclissi.kind)}: da qui il Sole sparisce del tutto`,
      { sticky: true });
    _mappaStrati.push(p);
    _eclStratiFissi.totale = p;
  }

  // Linea centrale
  if (_eclPercorso.lineaCentrale && _eclPercorso.lineaCentrale.length > 1) {
    const l = L.polyline(_eclPercorso.lineaCentrale, {
      color: _eclTav().centrale, weight: 2, opacity: 0.9, dashArray: '9 7', interactive: false
    }).addTo(_mappaEclissi);
    _mappaStrati.push(l);
    _eclStratiFissi.centrale = l;
  }

  // Punto di massima eclissi
  const dMax = _eclIstante(peakUt);
  const pMax = _eclPuntoMassimo(dMax);
  if (pMax) {
    const cMax = _eclCircostanze(pMax[0], pMax[1], dMax);
    const marker = L.circleMarker(pMax, {
      radius: 6, color: _eclTav().massimo.bordo, fillColor: _eclTav().massimo.dentro,
      fillOpacity: 1, weight: 2
    }).bindTooltip(
      `<b>Massima eclissi</b><br>${_eclOra(evento.dataObj)} · ${_eclPerc(cMax.osc)} di Sole coperto`,
      { direction: 'top' }
    ).addTo(_mappaEclissi);
    _mappaStrati.push(marker);
    _eclStratiFissi.massimo = marker;
  }

  _eclDisegnaCitta();

  // Cursore del tempo tarato sulla durata reale dell'eclissi
  const slider = document.getElementById('eclissi-tempo-slider');
  if (slider) {
    slider.min = _eclFinestra.inizio;
    slider.max = _eclFinestra.fine;
    slider.step = 0.5;
    slider.value = 0;
  }
  const etInizio = document.getElementById('eclissi-tempo-inizio');
  const etFine = document.getElementById('eclissi-tempo-fine');
  if (etInizio) etInizio.textContent = _eclOra(new Date(evento.dataObj.getTime() + _eclFinestra.inizio * 60000));
  if (etFine) etFine.textContent = _eclOra(new Date(evento.dataObj.getTime() + _eclFinestra.fine * 60000));

  const casellaSegui = document.getElementById('eclissi-segui');
  if (casellaSegui) { _eclFilmato.segui = true; casellaSegui.checked = true; }
  _eclFilmatoAggiornaPulsante();
  _eclAggiornaTastoSchermo();
  _eclAggiornaTastoNotte();

  _eclAggiornaLegenda(evento, _eclCostruisciRiepilogo(evento));

  // Perché proprio adesso: i nodi della Luna e la stagione delle eclissi
  mostraStagioneEclissi('eclissi-stagione', evento.dataObj);

  // Inquadra il percorso e ricalcola le dimensioni (il div era nascosto)
  setTimeout(() => {
    _mappaEclissi.invalidateSize();
    // Si inquadra la fascia centrale, che è ciò che si va a cercare; se non
    // c'è (eclissi parziale) si allarga a tutta la zona di visibilità.
    // Oltre gli 80° la proiezione di Mercatore si stira all'infinito: se il
    // percorso arriva al polo si taglia lì, altrimenti resta mezza mappa nera.
    // Si inquadra la fascia di totalità, che è ciò che si va a cercare. Quando
    // non c'è (eclissi parziale) si segue la rotta del massimo, allargando di
    // più: quel che conta è vedere la regione attorno.
    const centrale = _eclPercorso.lineaCentrale && _eclPercorso.lineaCentrale.length > 1;
    const inquadra = centrale ? _eclPercorso.lineaCentrale : _eclPercorso.rottaMassimo;
    if (inquadra && inquadra.length > 1) {
      const larghi = L.latLngBounds(inquadra.map(p => [Math.max(-80, Math.min(80, p[0])), p[1]])).pad(centrale ? 0.25 : 0.7);
      _mappaEclissi.fitBounds(L.latLngBounds(
        [Math.max(-82, larghi.getSouth()), larghi.getWest()],
        [Math.min(82, larghi.getNorth()), larghi.getEast()]
      ));
      // Lo zoom va a scatti: la finestra può comunque sconfinare oltre il polo
      _eclEvitaIlVuoto();
    }
    _eclissiAggiornaTutto();
  }, 60);
}

function chiudiMappaEclissi() {
  if (_eclFilmato.attivo) _eclFilmatoFerma();
  if (_eclSchermoIntero) _eclEsciSchermoIntero();
  const modale = document.getElementById('modale-mappa');
  if (modale) modale.classList.add('hidden');
  _eclissiEventoInCorso = null;
}

// --- La mappa a tutto schermo ---
//   Il cono d'ombra è una figura lunga mezzo pianeta: dentro alla finestra,
//   con i pannelli di lettura accanto, se ne vede un pezzo per volta. A
//   schermo intero la mappa si prende tutto e i comandi del filmato le
//   restano appoggiati sopra, così si continua a scorrere il tempo mentre si
//   guarda l'ombra correre.
let _eclSchermoIntero = false;
let _eclSegnaposto = null;    // dove rimettere il guscio quando si esce

// Il guscio si cerca per la sua classe, non per il modale che lo contiene:
// nel ripiego a schermo intero esce dal modale e va appeso al body, e da
// lì una ricerca dentro `#modale-mappa` non lo troverebbe più. (La mappa
// delle eclissi lunari ha un guscio suo, senza lettore: sono due elementi
// diversi e non vanno confusi.)
function _eclGuscioMappa() {
  return document.querySelector('.ecl-guscio-filmato');
}

function _eclAlternaSchermoIntero() {
  if (_eclSchermoIntero) _eclEsciSchermoIntero();
  else _eclEntraSchermoIntero();
}

function _eclEntraSchermoIntero() {
  const guscio = _eclGuscioMappa();
  if (!guscio || _eclSchermoIntero) return;
  _eclSchermoIntero = true;
  document.body.classList.add('ecl-mappa-immersiva');

  const chiedi = guscio.requestFullscreen || guscio.webkitRequestFullscreen;
  if (chiedi) {
    try {
      const esito = chiedi.call(guscio);
      if (esito && typeof esito.catch === 'function') esito.catch(() => _eclRipiegoSchermo(guscio));
    } catch (e) {
      _eclRipiegoSchermo(guscio);
    }
  } else {
    _eclRipiegoSchermo(guscio);
  }

  _eclAggiornaTastoSchermo();
  _eclRimisuraMappa();
}

// Il ripiego per chi non ha l'API Fullscreen sugli elementi (Safari su
// iPhone). Qui non basta incollare il guscio al viewport dov'è: la finestra
// ha lo sfondo sfocato, e un antenato con `backdrop-filter` diventa il
// riferimento di tutto ciò che sta dentro — `position: fixed` compreso, che
// finirebbe ancorato al contenuto che scorre. Il guscio esce quindi dal
// modale e va appeso al body, lasciando un segnaposto per il ritorno.
function _eclRipiegoSchermo(guscio) {
  if (!_eclSchermoIntero || _eclSegnaposto) return;
  _eclSegnaposto = document.createComment('guscio-mappa-eclissi');
  guscio.parentNode.insertBefore(_eclSegnaposto, guscio);
  document.body.appendChild(guscio);
  guscio.classList.add('ecl-schermo-pieno');
  _eclAggiornaTastoSchermo();
  _eclRimisuraMappa();
}

function _eclEsciSchermoIntero() {
  if (!_eclSchermoIntero) return;
  const guscio = _eclGuscioMappa();
  _eclSchermoIntero = false;
  document.body.classList.remove('ecl-mappa-immersiva');

  if (guscio) guscio.classList.remove('ecl-schermo-pieno');
  if (guscio && _eclSegnaposto && _eclSegnaposto.parentNode) {
    _eclSegnaposto.parentNode.replaceChild(guscio, _eclSegnaposto);
  }
  _eclSegnaposto = null;

  const esci = document.exitFullscreen || document.webkitExitFullscreen;
  const attivo = document.fullscreenElement || document.webkitFullscreenElement;
  if (attivo && esci) {
    try {
      const esito = esci.call(document);
      if (esito && typeof esito.catch === 'function') esito.catch(() => {});
    } catch (e) { /* già uscito per conto suo */ }
  }

  _eclAggiornaTastoSchermo();
  _eclRimisuraMappa();
}

// Leaflet misura il suo riquadro una volta sola: cambiandolo sotto i piedi
// (schermo intero, rotazione) va avvisato, o resta con mezza mappa grigia.
// Nella stessa occasione si misura il lettore: a schermo intero è lui a
// decidere quanto in alto deve stare la targhetta della città sotto l'ombra,
// e la sua altezza cambia con la larghezza dello schermo.
function _eclRimisuraMappa() {
  [90, 320].forEach(ms => setTimeout(() => {
    const guscio = _eclGuscioMappa();
    const lettore = guscio && guscio.querySelector('.ecl-lettore');
    if (guscio && lettore) {
      guscio.style.setProperty('--ecl-altezza-lettore', `${Math.round(lettore.offsetHeight)}px`);
    }
    if (_mappaEclissi) _mappaEclissi.invalidateSize();
  }, ms));
}

function _eclAggiornaTastoSchermo() {
  const b = document.getElementById('btn-eclissi-schermo');
  if (!b) return;
  b.classList.toggle('attiva', _eclSchermoIntero);
  b.textContent = _eclSchermoIntero ? '✕' : '⛶';
  b.title = _eclSchermoIntero
    ? 'Esci dalla mappa a tutto schermo (anche con Esc)'
    : 'La mappa a tutto schermo, con i comandi in sovrimpressione';
  b.setAttribute('aria-label', _eclSchermoIntero ? 'Esci da schermo intero' : 'Mappa a schermo intero');
}

// Collega i comandi del modale: chiusura, cursore del tempo e filmato.
function inizializzaMappaEclissiUI() {
  const modale = document.getElementById('modale-mappa');
  if (!modale) return;
  // Due vie d'uscita: la croce in alto e, per chi ha scorrito fino in fondo,
  // un tasto largo alla fine della pagina
  ['btn-chiudi-mappa', 'btn-chiudi-mappa-basso'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', chiudiMappaEclissi);
  });
  modale.addEventListener('click', (e) => { if (e.target === modale) chiudiMappaEclissi(); });

  // Schermo intero della mappa, con i suoi due modi di uscire: il tasto e
  // l'Esc. Nel pieno schermo vero l'Esc lo intercetta il browser (e ce lo
  // racconta con `fullscreenchange`); nel ripiego arriva fin qui, e allora
  // deve chiudere la mappa grande, non la finestra sotto.
  const tastoSchermo = document.getElementById('btn-eclissi-schermo');
  if (tastoSchermo) tastoSchermo.addEventListener('click', _eclAlternaSchermoIntero);
  // "Non c'è più niente a schermo intero" non basta a dire che la mappa grande
  // è finita: la finestra può essere aperta sopra al planetario già a schermo
  // intero (sezione 7.5-bis), e allora uscendo dalla mappa il posto resta al
  // cielo. Quello che conta è se a tenerlo è ancora il guscio della mappa.
  const cambioSchermo = () => {
    const attivo = document.fullscreenElement || document.webkitFullscreenElement;
    if (_eclSchermoIntero && !_eclSegnaposto && attivo !== _eclGuscioMappa()) _eclEsciSchermoIntero();
    else _eclRimisuraMappa();
  };
  document.addEventListener('fullscreenchange', cambioSchermo);
  document.addEventListener('webkitfullscreenchange', cambioSchermo);
  // Girando il telefono cambiano sia il riquadro della mappa sia l'altezza
  // del lettore: entrambi vanno rimisurati, o l'ombra resta su mezza mappa
  window.addEventListener('resize', () => { if (_eclSchermoIntero) _eclRimisuraMappa(); });

  document.addEventListener('keydown', (e) => {
    if (modale.classList.contains('hidden')) return;
    if (e.key === 'Escape') {
      if (_eclSchermoIntero) _eclEsciSchermoIntero();
      else chiudiMappaEclissi();
      return;
    }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    // Comandi da lettore video: spazio riproduce, le frecce scorrono il tempo,
    // Inizio e Fine saltano ai due estremi.
    if (e.key === ' ') {
      e.preventDefault();
      _eclFilmatoAlterna();
      return;
    }
    const passo = e.shiftKey ? 10 : 1;
    const salti = {
      ArrowLeft: () => _eclVaiA(_eclissiOffsetTempoMin - passo),
      ArrowRight: () => _eclVaiA(_eclissiOffsetTempoMin + passo),
      Home: () => _eclVaiA(_eclFinestra.inizio),
      End: () => _eclVaiA(_eclFinestra.fine)
    };
    if (salti[e.key]) {
      e.preventDefault();
      if (_eclFilmato.attivo) _eclFilmatoFerma();
      salti[e.key]();
    }
  });

  const slider = document.getElementById('eclissi-tempo-slider');
  if (slider) {
    slider.addEventListener('input', () => {
      if (_eclFilmato.attivo) _eclFilmatoFerma();
      _eclissiOffsetTempoMin = parseFloat(slider.value);
      _eclissiAggiornaTutto();
    });
  }

  const play = document.getElementById('eclissi-play');
  if (play) play.addEventListener('click', _eclFilmatoAlterna);

  const comandi = [
    ['eclissi-tempo-avvio', () => _eclVaiA(_eclFinestra.inizio)],
    ['eclissi-tempo-meno', () => _eclVaiA(_eclissiOffsetTempoMin - 10)],
    ['eclissi-tempo-reset', () => _eclVaiA(0)],
    ['eclissi-tempo-piu', () => _eclVaiA(_eclissiOffsetTempoMin + 10)],
    ['eclissi-tempo-termine', () => _eclVaiA(_eclFinestra.fine)]
  ];
  comandi.forEach(([id, azione]) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', () => { if (_eclFilmato.attivo) _eclFilmatoFerma(); azione(); });
  });

  const velocita = document.getElementById('eclissi-velocita');
  if (velocita) {
    velocita.addEventListener('change', () => { _eclFilmato.velocita = parseFloat(velocita.value); });
  }

  const segui = document.getElementById('eclissi-segui');
  if (segui) segui.addEventListener('change', () => { _eclFilmato.segui = segui.checked; });

  // La barra di salto rapido: su telefono il modale è una colonna lunga e
  // senza questa i pannelli in fondo non li trova nessuno.
  const salti = modale.querySelector('.ecl-salti');
  if (salti) {
    salti.addEventListener('click', (e) => {
      const b = e.target.closest('[data-salta]');
      if (!b) return;
      const bersaglio = document.getElementById(b.dataset.salta);
      if (!bersaglio) return;
      // I pannelli sono cassetti, e la metà nasce chiusa: saltare su uno
      // chiuso porterebbe davanti alla sua sola maniglia. Lo si apre.
      if (bersaglio.tagName === 'DETAILS') bersaglio.open = true;
      bersaglio.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Contatti e cronologia: toccare una riga porta il cursore su quel momento.
  // È il modo più diretto di guardarsi un istante preciso dell'eclissi.
  ['eclissi-contatti', 'eclissi-cronologia'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
      const riga = e.target.closest('[data-min]');
      if (!riga) return;
      const min = parseFloat(riga.dataset.min);
      if (!isFinite(min)) return;
      if (_eclFilmato.attivo) _eclFilmatoFerma();
      _eclVaiA(min);
    });
  });

  // Toccando una città dell'elenco l'osservatore si sposta lì
  const lista = document.getElementById('eclissi-citta-lista');
  if (lista) {
    lista.addEventListener('click', (e) => {
      const riga = e.target.closest('[data-citta]');
      if (!riga) return;
      const c = _eclCitta[parseInt(riga.dataset.citta, 10)];
      if (!c) return;
      _eclissiPosizioneTemporanea = { lat: c.lat, lon: c.lon };
      _eclissiAggiornaTutto();
    });
  }
}

// --- Equinozi e Solstizi ---
function aggiungiStagioni(oggi, limite) {
  try {
    const annoInizio = oggi.getFullYear();
    for (let anno = annoInizio; anno <= limite.getFullYear(); anno++) {
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
    for (let anno = annoInizio; anno <= limite.getFullYear(); anno++) {
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
    // Nota: Astronomy.Body.X è la stringa del corpo, riusata dal planetario
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
  // Se l'agenda è ferma su un mese diverso, l'evento appena salvato non si
  // vedrebbe: portiamola sul mese giusto invece di far sparire il lavoro fatto
  portaAlMeseDellEvento(dati.dataObj);
  aggiornaViste();
}

// Se un mese è selezionato e la data non ci rientra, spostiamoci su quel mese
function portaAlMeseDellEvento(data) {
  if (!meseSelezionato || !(data instanceof Date) || isNaN(data)) return;
  if (data.getFullYear() === meseSelezionato.anno && data.getMonth() === meseSelezionato.mese) return;
  impostaMeseSelezionato(data.getFullYear(), data.getMonth());
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
  inizializzaSelettoriMese();
  costruisciAgenda();
  inizializzaCalendario();
  costruisciDiario();
  gestisciTab();
}

// =====================================================================
// 1-quater. Scelta del mese (calendario e agenda vanno insieme)
//    Si può scrivere un mese e un anno qualsiasi, anche molto indietro
//    nel tempo: gli eventi di quel mese vengono calcolati sul momento.
// =====================================================================

// Riempie i due selettori (calendario e agenda) e ne collega i tasti
function inizializzaSelettoriMese() {
  const oggi = new Date();
  document.querySelectorAll('[data-selettore-mese]').forEach(box => {
    const selMese = box.querySelector('[data-campo-mese]');
    const campoAnno = box.querySelector('[data-campo-anno]');

    if (selMese) {
      selMese.innerHTML = NOMI_MESI
        .map((nome, i) => `<option value="${i}">${nome}</option>`)
        .join('');
      selMese.value = String(oggi.getMonth());
    }
    if (campoAnno) {
      campoAnno.min = String(ANNO_MINIMO_NAVIGABILE);
      campoAnno.max = String(ANNO_MASSIMO_NAVIGABILE);
      campoAnno.value = String(oggi.getFullYear());
      // Invio nel campo anno = "Mostra", senza dover cercare il tasto
      campoAnno.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); vaiAlMeseDelSelettore(box); }
      });
    }

    box.querySelectorAll('[data-azione-mese]').forEach(btn => {
      btn.addEventListener('click', () => {
        const azione = btn.dataset.azioneMese;
        if (azione === 'vai') vaiAlMeseDelSelettore(box);
        else if (azione === 'oggi') impostaMeseSelezionato(oggiAnno(), oggiMese());
        else if (azione === 'prossimi') azzeraMeseSelezionato();
      });
    });
  });
  sincronizzaSelettoriMese();
}

function oggiAnno() { return new Date().getFullYear(); }
function oggiMese() { return new Date().getMonth(); }

// Il primo giorno del mese che la griglia sta disegnando (oggi, se non c'è)
function meseMostratoDalCalendario() {
  const inizio = fullCalendarInstance && fullCalendarInstance.view
    ? fullCalendarInstance.view.currentStart
    : null;
  const oggi = new Date();
  return inizio ? new Date(inizio.getFullYear(), inizio.getMonth(), 1)
                : new Date(oggi.getFullYear(), oggi.getMonth(), 1);
}

// Legge mese e anno scritti in un selettore e ci porta il calendario
function vaiAlMeseDelSelettore(box) {
  const selMese = box.querySelector('[data-campo-mese]');
  const campoAnno = box.querySelector('[data-campo-anno]');
  const mese = selMese ? parseInt(selMese.value, 10) : NaN;
  let anno = campoAnno ? parseInt(campoAnno.value, 10) : NaN;

  if (!Number.isFinite(anno)) anno = oggiAnno();
  // Fuori dai binari non si va: la libreria perde precisione e il calcolo
  // diventa lunghissimo senza dare nulla in più
  anno = Math.min(ANNO_MASSIMO_NAVIGABILE, Math.max(ANNO_MINIMO_NAVIGABILE, anno));
  if (!Number.isFinite(mese) || mese < 0 || mese > 11) return;

  impostaMeseSelezionato(anno, mese);
}

// Porta calendario e agenda su un mese preciso, calcolandone gli eventi
function impostaMeseSelezionato(anno, mese, opzioni = {}) {
  meseSelezionato = { anno, mese };
  mostraCalcoloInCorso(anno, mese);

  // Il calcolo vero è sincrono e blocca il disegno: gli lasciamo un giro di
  // schermo per far comparire prima la scritta "sto calcolando".
  const esegui = () => {
    assicuraMese(anno, mese);
    if (opzioni.intervallo) assicuraIntervallo(opzioni.intervallo.inizio, opzioni.intervallo.fine);
    if (!opzioni.daCalendario && fullCalendarInstance) {
      // gotoDate riaccende datesSet: gli diciamo di non rimbalzare indietro
      calendarioInMovimento = true;
      fullCalendarInstance.gotoDate(new Date(anno, mese, 1));
      calendarioInMovimento = false;
    }
    sincronizzaSelettoriMese();
    sincronizzaCalendario();
    costruisciAgenda();
  };
  if (opzioni.subito) esegui(); else setTimeout(esegui, 0);
}

// Torna alla vista "tutti gli eventi in arrivo" (nessun mese scelto)
function azzeraMeseSelezionato() {
  meseSelezionato = null;
  sincronizzaSelettoriMese();
  costruisciAgenda();
}

// Allinea i campi dei due selettori e le righe di stato al mese scelto
function sincronizzaSelettoriMese() {
  // Senza un mese scelto i campi mostrano quello che si sta guardando nella
  // griglia: premere "Mostra" senza toccare nulla deve essere una conferma,
  // non un salto altrove.
  const riferimento = meseSelezionato
    ? new Date(meseSelezionato.anno, meseSelezionato.mese, 1)
    : meseMostratoDalCalendario();
  const anno = riferimento.getFullYear();
  const mese = riferimento.getMonth();

  document.querySelectorAll('[data-selettore-mese]').forEach(box => {
    const selMese = box.querySelector('[data-campo-mese]');
    const campoAnno = box.querySelector('[data-campo-anno]');
    if (selMese) selMese.value = String(mese);
    if (campoAnno && document.activeElement !== campoAnno) campoAnno.value = String(anno);
  });

  // La riga sotto la griglia segue il mese davvero disegnato: "Tutti i prossimi"
  // cambia l'agenda, non il calendario, e le due scritte non devono litigare
  const statoCal = document.getElementById('calendario-stato');
  if (statoCal) {
    const mostrata = meseMostratoDalCalendario();
    statoCal.textContent = `Eventi di ${NOMI_MESI[mostrata.getMonth()]} ${mostrata.getFullYear()}, ` +
      'calcolati per questo mese.';
  }

  const statoAgenda = document.getElementById('agenda-stato');
  if (statoAgenda) {
    statoAgenda.textContent = meseSelezionato
      ? `Stai leggendo ${NOMI_MESI[mese]} ${anno}. Con “Tutti i prossimi” torni agli eventi in arrivo.`
      : 'Stai leggendo tutti gli eventi in arrivo. Scegli un mese per vedere quello, anche nel passato.';
  }
}

// Avvisa che il calcolo è in corso: un mese lontano richiede qualche istante
function mostraCalcoloInCorso(anno, mese) {
  if (mesiCalcolati.has(chiaveMese(anno, mese))) return;
  const testo = `Calcolo gli eventi di ${NOMI_MESI[mese]} ${anno}…`;
  const statoCal = document.getElementById('calendario-stato');
  if (statoCal) statoCal.textContent = testo;
  const statoAgenda = document.getElementById('agenda-stato');
  if (statoAgenda) statoAgenda.textContent = testo;
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

// Gli eventi che l'agenda deve mostrare: quelli del mese scelto se ce n'è uno
// (compresi i giorni già passati, che è il senso di guardarsi indietro),
// altrimenti tutti quelli che superano i filtri.
function getEventiAgenda() {
  const lista = getEventiFiltrati();
  if (!meseSelezionato) return lista;
  const { anno, mese } = meseSelezionato;
  return lista.filter(ev =>
    ev.dataObj.getFullYear() === anno && ev.dataObj.getMonth() === mese
  );
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

// Sul telefono i due blocchi di filtri (categoria e strumento) occupavano più
// spazio della ricerca stessa. Qui accanto al campo compare un tasto "Filtri"
// che li apre e li chiude; su schermi più grandi il tasto non esiste nemmeno,
// perché i filtri restano sempre visibili.
function costruisciTastoFiltri() {
  const barra = document.getElementById('barra-ricerca');
  const pannello = document.getElementById('filtri-avanzati');
  if (!barra || !pannello || document.getElementById('btn-filtri')) return;

  const campo = barra.querySelector('.relative');
  if (!campo) return;

  // Campo e tasto viaggiano affiancati sulla stessa riga
  const riga = document.createElement('div');
  riga.className = 'riga-ricerca';
  campo.parentNode.insertBefore(riga, campo);
  riga.appendChild(campo);

  const tasto = document.createElement('button');
  tasto.id = 'btn-filtri';
  tasto.type = 'button';
  tasto.className = 'px-3 py-2 rounded-lg text-sm font-semibold bg-slate-700 ' +
    'hover:bg-slate-600 text-white flex-shrink-0 items-center gap-1.5';
  tasto.setAttribute('aria-controls', 'filtri-avanzati');
  tasto.innerHTML = `${icona('bersaglio', 16)} Filtri`;
  tasto.addEventListener('click', () => {
    pannello.classList.toggle('filtri-chiusi');
    // Da qui in poi comanda la scelta di chi guarda, non più il tipo di schermo
    pannello.dataset.apertoDaUtente = '1';
    aggiornaTastoFiltri();
  });
  riga.appendChild(tasto);

  aggiornaTastoFiltri();
}

// Costruisce la barra di ricerca e i chip delle categorie e ne collega gli eventi
function inizializzaRicerca() {
  const input = document.getElementById('ricerca-eventi');
  const btnPulisci = document.getElementById('btn-pulisci-ricerca');
  const contenitoreChip = document.getElementById('filtri-categorie');

  costruisciTastoFiltri();

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

  const eventiDaMostrare = getEventiAgenda();

  if (eventiDaMostrare.length === 0) {
    let messaggio;
    if (eventiCalcolati.length === 0) {
      messaggio = 'Nessun evento da mostrare.';
    } else if (meseSelezionato) {
      messaggio = `Nessun evento in ${NOMI_MESI[meseSelezionato.mese]} ${meseSelezionato.anno} ` +
        'con i filtri attivi. Prova a cambiare mese, ricerca o categoria.';
    } else {
      messaggio = 'Nessun evento corrisponde alla ricerca. Prova a cambiare i termini o la categoria.';
    }
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
    // Le scorciatoie del riquadro "Come prepararsi": solo tasti, e solo tasti
    // che restano dentro l'app. Niente scritte sottolineate in mezzo al testo,
    // che su un telefono nessuno prova a toccare, e niente collegamenti che
    // portano fuori: le coordinate del massimo si leggono già lì sotto, alla
    // riga "Dove", e la mappa dell'ombra le mostra meglio di una mappa stradale.
    const stileScorciatoia = 'px-3 py-1.5 rounded-full text-xs font-medium bg-slate-700 ' +
      'hover:bg-blue-600 text-slate-100 transition-colors border border-transparent';
    const scorciatoie = [];
    // Il tasto principale di ogni evento: aprire il planetario già portato
    // sull'istante giusto. Prima qui c'era "Trova la Luna nel cielo", che
    // puntava la Luna di adesso — per un'eclissi di fra due mesi mostrava il
    // punto sbagliato del cielo all'ora sbagliata, ed era il contrario di
    // quello che serve. Adesso si arriva nel cielo di quel momento, con
    // l'evento segnato dove bisogna guardare.
    scorciatoie.push(`<button onclick="apriEventoNelPlanetario('${evento.id}')" class="${stileScorciatoia}" ` +
      `title="Apre il planetario sull'istante dell'evento, puntato dove guardare">Vedi nel planetario</button>`);
    if (evento.eclissi) {
      scorciatoie.push(`<button onclick="apriMappaEclissi('${evento.id}')" class="${stileScorciatoia}" ` +
        `title="Il percorso del cono d'ombra, minuto per minuto">Mappa dell'ombra</button>`);
    }
    if (evento.eclissiLunare) {
      scorciatoie.push(`<button onclick="apriMappaLunare('${evento.id}')" class="${stileScorciatoia}" ` +
        `title="Da dove si vede, a che ora, e con la Luna quanto alta">Dove e quando vederla</button>`);
    }
    const barraScorciatoie = scorciatoie.length
      ? `<div class="flex flex-wrap gap-2 mt-3">${scorciatoie.join('')}</div>`
      : '';
    card.innerHTML = `
      <div class="barra-evento" style="background-color: ${evento.colore}; color: ${evento.colore}"></div>
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
          </ul>
          ${barraScorciatoie}
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

  // Barra dei comandi, densità delle caselle e formato del titolo dipendono
  // da quanto schermo c'è: le decide opzioniCalendarioPerSchermo()
  const opzioniSchermo = opzioniCalendarioPerSchermo();

  fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'it',
    firstDay: 1, // Lunedì
    height: 'auto',
    ...opzioniSchermo,
    buttonText: { today: 'Oggi' },
    moreLinkContent: (arg) => `+${arg.num}`,
    // Niente rettangoli pieni: un pallino colorato e il titolo, come su un'agenda di carta
    eventDisplay: 'list-item',
    displayEventTime: false,
    // Non c'è un limite ai mesi navigabili: quelli fuori dal calcolo iniziale
    // vengono calcolati appena si arriva a guardarli
    validRange: {
      start: new Date(ANNO_MINIMO_NAVIGABILE, 0, 1),
      end: new Date(ANNO_MASSIMO_NAVIGABILE, 11, 31)
    },
    events: eventiPerGriglia(getEventiFiltrati()),
    // Ogni volta che cambia il mese mostrato — con le frecce, con "Oggi" o dal
    // selettore — calcoliamo gli eventi di quel mese e ci allineiamo l'agenda.
    datesSet: function(info) {
      if (calendarioInMovimento) return;
      const corrente = info.view.currentStart;
      const anno = corrente.getFullYear();
      const mese = corrente.getMonth();
      if (meseSelezionato && meseSelezionato.anno === anno && meseSelezionato.mese === mese) return;
      // La griglia mostra anche le code del mese prima e di quello dopo:
      // le calcoliamo tutte, così non restano caselle vuote per finta.
      impostaMeseSelezionato(anno, mese, {
        daCalendario: true,
        intervallo: { inizio: info.start, fine: new Date(info.end.getTime() - 1) }
      });
    },
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
  // Il primo disegno non conta come "l'utente ha scelto un mese": l'agenda
  // deve aprirsi su tutti gli eventi in arrivo, non solo su questo mese.
  calendarioInMovimento = true;
  fullCalendarInstance.render();
  calendarioInMovimento = false;
}

// =====================================================================
// 3. Gestione Tab (Cambia vista Mese / Agenda / Planetario)
// =====================================================================

// Le sei viste dell'app: pulsante, contenitore e nome logico.
// Il nome logico di una vista non è la sua etichetta: `cielo` si legge
// "Planetario" sullo schermo, ma resta `cielo` nei link condivisi
// (`?vista=cielo`) e nel codice, perché quelli sono già in giro.
const VISTE = [
  { nome: 'stasera',    btn: 'btn-vista-stasera',    vista: 'vista-stasera' },
  { nome: 'calendario', btn: 'btn-vista-calendario', vista: 'vista-calendario' },
  { nome: 'agenda',     btn: 'btn-vista-agenda',     vista: 'vista-agenda' },
  { nome: 'cielo',      btn: 'btn-vista-skymap',     vista: 'vista-skymap' },
  { nome: 'telescopio', btn: 'btn-vista-telescopio', vista: 'vista-telescopio' },
  { nome: 'diario',     btn: 'btn-vista-diario',     vista: 'vista-diario' }
];

// Mostra una sola vista alla volta e aggiorna lo stile dei pulsanti
function mostraVista(nome) {
  const attivo = "voce-menu attiva";
  const inattivo = "voce-menu";
  // Serve a chi ridisegna dopo un cambio di schermo: sa cosa c'è davanti
  vistaAttuale = nome;

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

  // Resize necessario per FullCalendar quando torna visibile: solo ora la
  // griglia ha una misura vera, quindi è il momento di darle la sua altezza
  if (nome === 'calendario' && fullCalendarInstance) {
    adattaAltezzaCalendario();
    fullCalendarInstance.updateSize();
  }

  // Il disegno del cielo gira solo quando la sua vista è a schermo;
  // uscendo si spegne anche la fotocamera (batteria e privacy).
  if (nome === 'cielo') {
    apriSkymap();
  } else {
    chiudiSkymap();
    skySpegniFotocamera();
  }

  // La vista Telescopio ha cronometri e sensori che vanno spenti uscendo
  if (nome === 'telescopio') {
    if (typeof telCostruisciVista === 'function') telCostruisciVista();
  } else if (typeof telChiudiVista === 'function') {
    telChiudiVista();
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

// Un'eclissi non si prepara in mezz'ora. Se bisogna mettersi in viaggio per
// entrare nella fascia di totalità, l'unico preavviso utile è di mesi: per
// queste il promemoria arriva a scaglioni. Ogni scaglione ha una finestra
// entro cui vale ancora la pena mandarlo — l'app avvisa solo quando è
// aperta, e chi la riapre due giorni dopo non vuole sentirsi dire "manca un
// mese" quando ormai mancano ventotto giorni.
const SCAGLIONI_ECLISSI = [
  { min: 365 * 24 * 60, finestraMin: 3 * 24 * 60, testo: 'Manca un anno' },
  { min: 30 * 24 * 60, finestraMin: 24 * 60, testo: 'Manca un mese' },
  { min: 7 * 24 * 60, finestraMin: 12 * 60, testo: 'Manca una settimana' },
  { min: 15 * 60, finestraMin: 5 * 60, testo: 'È domani' },
  { min: 60, finestraMin: 25, testo: 'Manca un\'ora' }
];

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

    // Le eclissi hanno la loro scaletta di preavvisi, che parte da un anno
    // prima. Le altre restano com'erano: mezz'ora e via.
    if (evento.eclissi || evento.eclissiLunare) {
      SCAGLIONI_ECLISSI.forEach(s => {
        const quando = istante - s.min * 60000;
        if (adesso < quando || adesso >= quando + s.finestraMin * 60000) return;
        // La sigla dello scaglione sta prima della chiocciola: dopo c'è
        // l'istante dell'evento, che serve a ripulire la lista.
        const chiave = `${evento.titolo}#${s.min}@${istante}`;
        if (notificheInviate.includes(chiave)) return;
        notificheInviate.push(chiave);
        salvaNotificheInviate();
        mostraNotificaEvento(evento, s.testo);
      });
      return;
    }

    if (istante > fineFinestra || istante < inizioFinestra) return;

    const chiave = chiaveNotifica(evento);
    if (notificheInviate.includes(chiave)) return;

    notificheInviate.push(chiave);
    salvaNotificheInviate();
    mostraNotificaEvento(evento);
  });
}

function mostraNotificaEvento(evento, anticipo) {
  try {
    const notifica = new Notification(
      anticipo ? `${anticipo}: ${evento.titolo}` : evento.titolo, {
      body: `${evento.dataTesto}\n${evento.spiegazione || ''}`.trim(),
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      // Con la scaletta dei preavvisi lo stesso evento avvisa piu' volte:
      // senza distinguere le targhette ogni promemoria cancellerebbe il
      // precedente, che e' giusto per un promemoria solo e sbagliato qui.
      tag: anticipo ? `${evento.id}-${anticipo}` : evento.id
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
// 7. IL PLANETARIO (SkyMap) — punta il telefono e trova gli astri
//    Si chiamava "Cielo": è il cielo in diretta, ma la parola che dice
//    davvero cos'è — un cielo calcolato in cui ci si muove e si viaggia
//    nel tempo — è planetario, ed è quella che l'app usa dappertutto.
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
// La chiave della calibrazione è alla versione 2: dalla versione in cui la
// declinazione magnetica viene corretta da sola, le vecchie correzioni fatte
// a mano (che quasi sempre servivano a rimediare proprio a quella) darebbero
// una doppia correzione. Cambiando chiave ripartono tutti da zero.
const CHIAVE_SKY_BUSSOLA = 'astrocalendario_bussola_offset_v2';
// Taratura dell'obiettivo per la realtà aumentata: quanti gradi di mondo
// entrano nel lato lungo dell'inquadratura (vedi skyCampoFotocamera)
const CHIAVE_SKY_CAMERA = 'astrocalendario_camera_campo';

// Corpi del Sistema Solare mostrati nel cielo.
// Gli id sono i valori di Astronomy.Body (semplici stringhe): li scriviamo
// direttamente così il file resta valido anche se la libreria non si carica.
// `diametroKm` e `classe` servono alla scheda che si apre toccando l'astro:
// la distanza e la magnitudine cambiano ogni istante e le calcoliamo, ma il
// diametro e la natura dell'oggetto sono dati da tabella.
const SKY_CORPI = [
  { id: 'Sun',     nome: 'Sole',     disegno: 'sole',     colore: '#fbbf24', tipo: 'sole',
    diametroKm: 1392700, classe: 'Stella: la nostra',
    nota: 'Contiene il 99,86% della massa di tutto il Sistema Solare.' },
  { id: 'Moon',    nome: 'Luna',     disegno: 'luna',     colore: '#e2e8f0', tipo: 'luna',
    diametroKm: 3474, classe: 'Satellite naturale della Terra',
    nota: 'Ci mostra sempre la stessa faccia: gira su sé stessa nel tempo che impiega a girarci attorno.' },
  { id: 'Mercury', nome: 'Mercurio', disegno: 'mercurio', colore: '#cbd5e1', tipo: 'pianeta',
    diametroKm: 4879, classe: 'Pianeta roccioso',
    nota: 'Non si allontana mai molto dal Sole: si vede solo nel crepuscolo, bassissimo.' },
  { id: 'Venus',   nome: 'Venere',   disegno: 'venere',   colore: '#fde68a', tipo: 'pianeta',
    diametroKm: 12104, classe: 'Pianeta roccioso',
    nota: 'L\'astro più luminoso dopo Sole e Luna: le nuvole di acido solforico riflettono il 70% della luce.' },
  { id: 'Mars',    nome: 'Marte',    disegno: 'marte',    colore: '#f87171', tipo: 'pianeta',
    diametroKm: 6779, classe: 'Pianeta roccioso',
    nota: 'Il colore arancione è ossido di ferro: ruggine, su scala planetaria.' },
  { id: 'Jupiter', nome: 'Giove',    disegno: 'giove',    colore: '#fcd34d', tipo: 'pianeta',
    diametroKm: 139820, classe: 'Gigante gassoso',
    nota: 'Con un binocolo fermo si vedono i quattro satelliti scoperti da Galileo.' },
  { id: 'Saturn',  nome: 'Saturno',  disegno: 'saturno',  colore: '#fcd34d', tipo: 'pianeta',
    diametroKm: 116460, classe: 'Gigante gassoso',
    nota: 'Gli anelli si vedono già con un piccolo telescopio: sono ghiaccio, spessi poche decine di metri.' },
  { id: 'Uranus',  nome: 'Urano',    disegno: 'urano',    colore: '#67e8f9', tipo: 'pianeta',
    diametroKm: 50724, classe: 'Gigante ghiacciato',
    nota: 'Al limite dell\'occhio nudo sotto cieli molto scuri: nel binocolo è un puntino verdastro.' },
  { id: 'Neptune', nome: 'Nettuno',  disegno: 'nettuno',  colore: '#93c5fd', tipo: 'pianeta',
    diametroKm: 49244, classe: 'Gigante ghiacciato',
    nota: 'Mai visibile a occhio nudo: fu trovato con i calcoli prima che col telescopio.' }
];

// Otto stelle luminose usate come punti di riferimento per orientarsi.
// Coordinate J2000: ascensione retta in ore, declinazione in gradi.
// Astronomy Engine mette a disposizione otto "slot" (Star1...Star8).
// `spettro` e `raggioSole` (raggi solari) raccontano che stella è: la scheda
// di un sole lontano non può parlare di diametro apparente, ma di questo sì.
const SKY_STELLE = [
  { nome: 'Stella Polare', ra: 2.5303,  dec: 89.2641,  ly: 433, mag: 1.98, colore: '#fef3c7',
    spettro: 'F7 Ib, supergigante gialla', raggioSole: 37.5 },
  { nome: 'Sirio',         ra: 6.7525,  dec: -16.7161, ly: 8.6, mag: -1.46, colore: '#dbeafe',
    spettro: 'A1 V, nana bianco-azzurra', raggioSole: 1.71 },
  { nome: 'Vega',          ra: 18.6156, dec: 38.7837,  ly: 25,  mag: 0.03, colore: '#e0f2fe',
    spettro: 'A0 V, nana bianco-azzurra', raggioSole: 2.36 },
  { nome: 'Capella',       ra: 5.2782,  dec: 45.9980,  ly: 42.9, mag: 0.08, colore: '#fef9c3',
    spettro: 'G8 III + G0 III, coppia di giganti gialle', raggioSole: 11.98 },
  { nome: 'Arturo',        ra: 14.2610, dec: 19.1825,  ly: 36.7, mag: -0.05, colore: '#fed7aa',
    spettro: 'K0 III, gigante arancione', raggioSole: 25.4 },
  { nome: 'Rigel',         ra: 5.2423,  dec: -8.2016,  ly: 863, mag: 0.13, colore: '#dbeafe',
    spettro: 'B8 Ia, supergigante azzurra', raggioSole: 78.9 },
  { nome: 'Betelgeuse',    ra: 5.9195,  dec: 7.4070,   ly: 548, mag: 0.50, colore: '#fca5a5',
    spettro: 'M1-2 Ia-ab, supergigante rossa', raggioSole: 764 },
  { nome: 'Altair',        ra: 19.8464, dec: 8.8683,   ly: 16.7, mag: 0.77, colore: '#f1f5f9',
    spettro: 'A7 V, nana bianca di sequenza', raggioSole: 1.79 }
];

// Elenco completo degli astri disegnabili (corpi + stelle negli slot Star1..Star8)
const SKY_ASTRI = SKY_CORPI.concat(
  SKY_STELLE.map((s, i) => ({
    id: `Star${i + 1}`,
    nome: s.nome,
    disegno: 'stella',
    colore: s.colore,
    tipo: 'stella',
    mag: s.mag,
    // Le coordinate di catalogo restano attaccate all'astro: servono alla
    // scheda (costellazione, ascensione retta) anche quando la libreria
    // non è disponibile per ricalcolarle.
    ra: s.ra,
    dec: s.dec,
    ly: s.ly,
    classe: s.spettro,
    raggioSole: s.raggioSole
  }))
);

// Alle stazioni spaziali (ISS e Tiangong) serve una voce come agli astri,
// così si possono cercare e disegnare allo stesso modo. L'elenco si compone
// al primo uso: SATELLITI è definito più avanti nel file.
let skyElencoCache = null;
function skyElenco() {
  if (!skyElencoCache) {
    skyElencoCache = SKY_ASTRI.concat(SATELLITI.map(s => ({
      id: 'sat-' + s.id,
      satId: s.id,
      nome: s.nome,
      disegno: 'satellite',
      colore: s.colore,
      tipo: 'satellite'
    })), SKY_PROFONDO.map(o => ({
      // Nebulose, galassie e ammassi erano gli unici che si potevano solo
      // *incontrare* sulla mappa: non c'era modo di chiedere «portami su
      // Andromeda». Nell'elenco ci stanno come gli altri — l'identificativo è
      // il nome, che qui è unico e non cambia mai.
      id: 'dso:' + o.nome,
      nome: o.nome,
      disegno: 'nebulosa',
      colore: SKY_COLORI_PROFONDO[o.tipo] || '#c4b5fd',
      tipo: 'profondo',
      tipoProfondo: o.tipo
    })));
  }
  return skyElencoCache;
}

// Il dato di catalogo di un oggetto profondo, a partire dall'identificativo
// dell'elenco
function skyProfondoDiId(id) {
  if (typeof id !== 'string' || !id.startsWith('dso:')) return null;
  const nome = id.slice(4);
  return SKY_PROFONDO.find(o => o.nome === nome) || null;
}

// Dove sta adesso un oggetto profondo. Le sue coordinate non cambiano mai
// (è fermo rispetto alle stelle), ma azimut e altezza sì: si ricalcolano
// mezzo minuto per volta, perché l'elenco le chiede una volta per pillola a
// ogni giro e per una tabella di numeri mezzo minuto è precisione da avanzo.
let skyProfondoOrizzonte = { chiave: null, mappa: new Map() };
function skyPosizioneProfondo(dato) {
  // Se il filtro del cielo profondo è acceso le posizioni ci sono già:
  // le ha appena calcolate skyAggiornaCatalogo, e sono quelle disegnate
  const vivo = (sky.profondo || []).find(p => p.nome === dato.nome);
  if (vivo) return { az: vivo.az, alt: vivo.alt };
  if (!sky.observer || typeof Astronomy === 'undefined') return null;

  const chiave = Math.floor(skyAdesso().getTime() / 30000) + '|' +
    sky.observer.latitude.toFixed(3) + ',' + sky.observer.longitude.toFixed(3);
  if (skyProfondoOrizzonte.chiave !== chiave) skyProfondoOrizzonte = { chiave, mappa: new Map() };
  if (skyProfondoOrizzonte.mappa.has(dato.nome)) return skyProfondoOrizzonte.mappa.get(dato.nome);

  let posizione = null;
  try {
    const hor = Astronomy.Horizon(Astronomy.MakeTime(skyAdesso()), sky.observer, dato.ra, dato.dec, 'normal');
    posizione = { az: hor.azimuth, alt: hor.altitude };
  } catch (e) { /* senza posizione restano le sole coordinate di catalogo */ }
  skyProfondoOrizzonte.mappa.set(dato.nome, posizione);
  return posizione;
}

// L'oggetto puntabile che si chiama così: prima fra quelli calcolati a ogni
// giro (Sole, Luna, pianeti, stelle, satelliti), poi fra quelli del cielo
// profondo, che vivono in un elenco a parte ma dall'elenco degli astri si
// scelgono allo stesso modo.
function skyVoceDiId(id) {
  if (!id) return null;
  const o = (sky.oggetti || []).find(x => x.id === id);
  if (o) return o;
  const dato = skyProfondoDiId(id);
  if (!dato) return null;
  const dove = skyPosizioneProfondo(dato);
  return Object.assign({ id, tipo: 'profondo', disegno: 'nebulosa', categoria: 'profondo' },
    dato, dove || {});
}

// Stato del planetario
const sky = {
  aperto: false,
  raf: null,
  canvas: null,
  ctx: null,
  larghezza: 0,
  altezza: 0,
  observer: null,        // Astronomy.Observer del luogo da cui si guarda il cielo
  posizione: null,       // { lat, lon, fonte, origine, nome, precisione, tempo }
  // Il luogo di sola visita: quando c'è, il planetario disegna il cielo da
  // qui invece che dalla posizione dell'app. Vale solo per questa vista e
  // non viene salvato: la posizione vera resta quella delle Impostazioni
  // (vedi 7.1-ter). { lat, lon, nome }
  luogoVista: null,
  scartoPerScelta: false, // l'ultima lettura automatica è stata rifiutata perché comanda la posizione scelta
  attesaPosizione: null, // richiesta di geolocalizzazione in corso (una sola per volta)
  erroreGps: null,       // ultimo errore del navigatore: { codice, quando }
  sorveglianza: null,    // id di watchPosition mentre il planetario è aperto
  sensori: false,        // orientamento del dispositivo attivo
  seguiTelefono: true,   // con i sensori accesi, il cielo lo punta il telefono
  assoluto: false,       // alpha riferito al Nord magnetico (bussola affidabile)
  orient: null,          // { alpha, beta, gamma } dall'ultimo evento
  ultimoAssoluto: 0,     // quando è arrivata l'ultima lettura riferita al Nord
  baseFiltrata: null,    // terna di sguardo levigata (filtro anti-tremolio)
  declinazione: 0,       // scarto Nord magnetico → Nord vero, in gradi (Est positivo)
  offsetBussola: 0,      // correzione manuale della bussola, in gradi
  calibrazione: false,   // il trascinamento sta ritoccando la bussola
  salvaBussola: null,    // timer per salvare la calibrazione a fine trascinamento
  fov: 55,               // campo visivo verticale, in gradi (quello disegnato adesso)
  fovVoluto: 55,         // dove lo zoom sta andando: ci arriva scivolando (vedi 7.4-ter)
  manuale: { az: 180, alt: 25 },
  puntatori: new Map(),  // dita appoggiate sul canvas (per trascinamento e pizzico)
  pizzico: null,
  // Trascinamento e sua inerzia: quanto correva il dito quando ha lasciato il
  // cielo, e la vista che continua da sola e si spegne (vedi 7.4-ter)
  trascinamento: null,
  inerzia: null,
  ultimoFotogramma: 0,   // performance.now() del fotogramma precedente, per il dt
  target: null,          // id dell'astro da cercare
  oggetti: [],           // posizioni calcolate (az/alt) degli astri
  prossimoCalcolo: 0,
  prossimoAggiornoUI: 0, // i numeri attorno alla mappa vanno più piano del cielo
  cacheOrari: { chiave: null, valore: null },
  stelleDefinite: false,
  wakeLock: null,
  avvisi: {},           // messaggi mostrati sotto al cielo, uno per argomento
  scadenzaAvvisi: {},   // avvisi che si cancellano da soli (id dei timer)
  // Macchina del tempo: secondi di scarto rispetto all'ora vera. In secondi,
  // non in minuti, perché la barra del tempo deve poter spostare il cielo
  // anche di dieci secondi: le stazioni spaziali fanno un grado al secondo.
  offsetTempoSec: 0,
  ancoraTempoSec: 0,     // il centro della finestra su cui scorre la slitta
  finestraTempoSec: 43200, // mezza larghezza della finestra della slitta
  passoTempoSec: 600,    // quanto spostano i tasti − e +, e con loro la slitta
  // Playback: il tempo che cammina da solo. Verso 0 fermo, +1 avanti,
  // −1 indietro; la velocità è un gradino della scala SKY_VELOCITA_PLAYBACK
  playbackVerso: 0,
  playbackVelIndice: 2,
  playbackUltimo: 0,     // performance.now() dell'ultimo passo, per il dt
  // Il verso scelto l'ultima volta: il play della barra del tempo è uno solo,
  // e riparte da dove si era rimasti. Chi guarda un pianeta tornare indietro
  // vuole rivederlo tornare indietro, non ricominciare in avanti.
  playbackUltimoVerso: 1,
  // Figure delle costellazioni e oggetti del deep sky
  mostraCostellazioni: true,
  mostraProfondo: false,
  // Mirino sul polo celeste, per allineare una montatura equatoriale
  mostraPolo: false,
  // Eventi del calendario segnati sulla mappa (radiante di uno sciame, astro
  // eclissato): sono l'unica cosa disegnata che non è "un astro dove sta"
  mostraEventi: true,
  // cosa succede all'ora mostrata, e il programma dei sette giorni dopo
  eventiOra: { chiave: null, inCorso: [], vicini: [], settimana: [] },
  eventiFirma: '',        // ultima versione scritta nel pannello, per non riscriverla
  eventiMeseTimer: null,  // attesa prima di calcolare il mese di un istante lontano
  // Inseguimento: la vista tiene l'oggetto scelto al centro, da sola, mentre
  // il cielo ruota o mentre il playback corre
  inseguimento: false,
  // La strada che l'oggetto scelto percorre nel cielo durante l'osservazione:
  // da dove è salito, dove sarà fra un'ora, quando tramonta (vedi 7.3-bis)
  mostraTraccia: true,
  traccia: { chiave: null, punti: [], nome: '', colore: '#93c5fd', prossimo: 0 },
  // L'eclittica: la strada che il Sole percorre in un anno fra le stelle, e
  // il binario attorno a cui stanno tutti i pianeti (vedi 7.3-ter). Resta
  // accesa finché non la si spegne, qualunque oggetto si stia guardando.
  mostraEclittica: false,
  eclittica: {
    chiave: null, punti: [], mesi: [], scarto: null, prossimo: 0,
    // L'analemma viaggia insieme all'eclittica ma ha i suoi conti e la sua
    // chiave: cambiare oggetto scelto non deve rifarlo (vedi 7.3-ter)
    analemma: { chiave: null, punti: [], mesi: [], oggi: null }
  },
  // Filtri della mappa: cosa compare e cosa no
  mostraPianeti: true,
  mostraSoleLuna: true,
  mostraStelle: true,
  mostraSatelliti: true,
  mostraSottoOrizzonte: true,
  // Il filtro "Su ora" del pannello Astri: restringe l'elenco a chi in questo
  // momento sta sopra l'orizzonte. È un filtro dell'*elenco*, non della mappa —
  // il cielo continua a disegnare quello che gli dicono i `mostra…` qui sopra
  soloAstriVisibili: false,
  // La categoria scelta nel pannello Astri: 'tutte', oppure la `chiave` di
  // una delle SKY_FAMIGLIE. Anche questo filtra l'elenco, non la mappa
  famigliaAstri: 'tutte',
  mostraGriglia: true,
  mostraNomi: true,
  mostraViaLattea: true,
  // Cielo dipinto come lo si vede davvero a quell'ora: colore che cambia col
  // Sole, foschia sull'orizzonte, stelle che sbiadiscono di giorno
  atmosfera: true,
  luceCielo: 0,          // quanto è chiaro il cielo adesso: 0 notte, 1 giorno
  ariaOra: null,         // i colori dell'aria dell'ultimo fotogramma
  // Eclissi di Sole in corso all'ora mostrata: quanto la Luna copre il disco
  // solare. Si ricalcola a ogni fotogramma perché ne dipendono la misura
  // della Luna, la corona, il bagliore e il colore del cielo (vedi 7.3.2)
  eclisse: null,
  costellazioni: [],
  profondo: [],
  viaLattea: [],
  // Flusso video della fotocamera, quando la realtà aumentata è accesa
  camera: null,
  // Realtà aumentata: sopra l'immagine vera il campo visivo non è più una
  // preferenza, è una misura dell'obiettivo. `cameraCampoLato` è la taratura
  // (gradi coperti dal lato lungo del fotogramma), `cameraCampo` il campo
  // verticale che ne risulta nel riquadro, `fovPrimaCamera` il campo scelto a
  // mano da riprendere quando la fotocamera si spegne.
  cameraCampoLato: 0,
  cameraCampo: 0,
  fovPrimaCamera: null,
  salvaCamera: null,     // timer per salvare la taratura a fine pizzico
  // Ultima proiezione usata per disegnare: serve a capire cosa c'è sotto al
  // dito senza rifare (e sporcare) il filtro della bussola
  ultimaBase: null,
  ultimaFocale: 0,
  // Oggetto di cui è aperta la scheda: un riferimento, non una fotografia,
  // perché posizione e magnitudine vanno rilette a ogni aggiornamento
  selezione: null,
  centraQuandoPronto: null, // astro da centrare appena ne sappiamo la posizione
  animazioneVista: null,    // spostamento morbido dello sguardo (modo manuale)
  // Schermo intero: se è attivo, se lo stiamo simulando col CSS e se abbiamo
  // messo una tappa nella cronologia (il tasto Indietro di Android)
  schermoIntero: false,
  fintoSchermoIntero: false,
  tappaStoria: false,
  // Registrazione di un momento da condividere (vedi 7.6): la durata è una
  // scelta che resta, il resto vive quanto la registrazione
  reg: {
    durataSec: 10,
    attiva: false,
    avvio: 0,              // performance.now() della prima immagine presa
    tela: null,            // la tela di montaggio: fotocamera + cielo + firma
    ctx: null,
    flusso: null,          // MediaStream preso dalla tela
    registratore: null,    // MediaRecorder
    pezzi: [],             // i blocchi che arrivano dal registratore
    est: 'webm',
    mime: '',
    durataReale: 0,        // quanto è durata davvero (si può fermare prima)
    ultimoConto: 0,        // per non riscrivere il conto alla rovescia a ogni fotogramma
    esito: null            // { blob, url, nome, tipo }
  },
  ultimoPuntatore: 'mouse'  // com'è arrivato l'ultimo tocco: dito o mouse
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

// --- Filtro anti-tremolio della bussola ---
// I sensori non danno un angolo, danno una misura: fra una lettura e l'altra
// ballano di qualche grado. Con un campo di 55° su trecento pixel un grado
// vale quasi sei pixel, quindi quel ballo si vede tutto. E c'è un punto in
// cui peggiora: con il telefono tenuto dritto davanti a sé (beta vicino a
// 90°) la terna alpha/beta/gamma perde un grado di libertà — alpha e gamma
// diventano intercambiabili — e il rumore su alpha esplode.
// Per questo non si levigano gli angoli ma la terna di sguardo già costruita:
// è continua, non ha il salto fra 359° e 0° e non soffre di quella
// singolarità.
const SKY_TAU_FERMO = 0.35;     // secondi di memoria quando il telefono è fermo
const SKY_TAU_MOSSA = 0.035;    // secondi di memoria quando lo si muove davvero
// Sopra l'immagine della fotocamera lo stesso filtro non va bene. Sulla mappa
// disegnata un ritardo di mezzo secondo non lo nota nessuno — non c'è niente
// con cui confrontarlo — mentre il tremolio si vede tutto. In realtà
// aumentata è il contrario: il confronto ce l'hai sotto, ed è impietoso. Il
// cielo che arriva in ritardo scivola sull'immagine vera a ogni movimento del
// braccio, e l'astro puntato scappa via dal punto in cui lo si è messo,
// mentre il tremolio si confonde con la grana del video. Qui si smorza quindi
// molto meno: si preferisce un filo di ballo a un cielo che insegue.
const SKY_TAU_FERMO_AR = 0.12;
const SKY_TAU_MOSSA_AR = 0.02;
const SKY_TAU_SPIA_VELOCE = 0.1; // le due medie che riconoscono il movimento…
const SKY_TAU_SPIA_LENTA = 0.5;  // …dal rumore: distanti solo se ci si muove
const SKY_MOVIMENTO_GRADI = 3;   // oltre questo scarto fra le due è movimento
const SKY_TAU_RUMORE = 1;        // con che calma si stima il rumore del sensore
const SKY_PESO_RUMORE = 0.8;     // quanto il rumore stimato alza quella soglia

function skyNormalizza(v) {
  const n = Math.hypot(v[0], v[1], v[2]);
  return n > 1e-9 ? [v[0] / n, v[1] / n, v[2] / n] : v;
}

function skyMescola(a, b, k) {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function skyAngoloFra(a, b) {
  return Math.acos(Math.max(-1, Math.min(1, skyDot(a, b)))) * SKY_R2D;
}

// Media pesata fra la terna già levigata e quella appena letta. Il peso
// dipende dal tempo passato (così il filtro si comporta uguale a venti o a
// sessanta fotogrammi al secondo) e da quanto ci si sta muovendo davvero:
// fermi conviene smorzare molto, muovendosi bisogna seguire subito, se no il
// cielo arriva in ritardo sul braccio.
//
// Distinguere le due cose guardando quanto è saltata l'ultima lettura non
// funziona: un singolo sobbalzo del sensore è grande quanto un movimento
// vero. Servono due medie della stessa direzione, una pronta e una pigra: il
// rumore le sposta tutte e due allo stesso modo e restano vicine, mentre un
// movimento continuato le allontana, perché la pigra ci arriva dopo. È la
// distanza fra loro a dire quanto fidarsi della lettura nuova.
//
// Quanto debba essere grande quella distanza per contare come movimento non
// si può però fissare una volta per tutte: una bussola scadente, o il
// telefono tenuto in una posizione dove gli angoli sono quasi degeneri, fa
// ballare le due medie di parecchi gradi anche da fermo. La soglia si adatta
// quindi al rumore che quel telefono sta mostrando davvero, misurato mentre
// sta fermo (durante il movimento la stima resta congelata, altrimenti
// scambierebbe il movimento stesso per rumore).
function skyLevigaBase(nuova) {
  const adesso = performance.now();
  const prec = sky.baseFiltrata;
  const schermo = skyAngoloSchermo();

  // Prima lettura, ritorno da fuori schermo o telefono girato: non c'è nulla
  // da levigare, si riparte da qui invece di scivolarci dentro.
  if (!prec || prec.schermo !== schermo || adesso - prec.tempo > 500) {
    sky.baseFiltrata = {
      f: nuova.f, r: nuova.r, u: nuova.u,
      veloce: nuova.f, lento: nuova.f, rumore: 0, tempo: adesso, schermo
    };
    return nuova;
  }

  const dt = Math.min(0.1, Math.max(0.001, (adesso - prec.tempo) / 1000));
  const veloce = skyNormalizza(skyMescola(prec.veloce, nuova.f, 1 - Math.exp(-dt / SKY_TAU_SPIA_VELOCE)));
  const lento = skyNormalizza(skyMescola(prec.lento, nuova.f, 1 - Math.exp(-dt / SKY_TAU_SPIA_LENTA)));

  const soglia = SKY_MOVIMENTO_GRADI + SKY_PESO_RUMORE * prec.rumore;
  const quota = Math.min(1, skyAngoloFra(veloce, lento) / soglia);
  const tauFermo = sky.camera ? SKY_TAU_FERMO_AR : SKY_TAU_FERMO;
  const tauMossa = sky.camera ? SKY_TAU_MOSSA_AR : SKY_TAU_MOSSA;
  const tau = tauFermo + (tauMossa - tauFermo) * quota;
  const k = 1 - Math.exp(-dt / tau);

  // Di quanto sta ballando questo sensore: è la distanza fra la lettura grezza
  // e la sua media pronta, e la si aggiorna solo da fermo.
  const rumore = quota < 0.3
    ? prec.rumore + (skyAngoloFra(nuova.f, veloce) - prec.rumore) * (1 - Math.exp(-dt / SKY_TAU_RUMORE))
    : prec.rumore;

  // Mescolando vettori si perde l'ortogonalità: la terna va raddrizzata,
  // altrimenti il cielo si deforma a poco a poco.
  const f = skyNormalizza(skyMescola(prec.f, nuova.f, k));
  const rGrezzo = skyMescola(prec.r, nuova.r, k);
  const proiezione = skyDot(rGrezzo, f);
  const r = skyNormalizza([
    rGrezzo[0] - f[0] * proiezione,
    rGrezzo[1] - f[1] * proiezione,
    rGrezzo[2] - f[2] * proiezione
  ]);
  const u = skyCross(r, f);

  sky.baseFiltrata = { f, r, u, veloce, lento, rumore, tempo: adesso, schermo };
  return { f, r, u };
}

// Il cielo lo punta il telefono, oppure il dito? Con i sensori accesi la
// prima è la modalità naturale, ma si può sganciare: senza sganciarla non si
// potrebbe portare al centro della mappa un oggetto scelto dall'elenco, che
// è proprio quello che si vuole quando si cerca qualcosa.
function skyUsaSensori() {
  return !!(sky.sensori && sky.seguiTelefono && sky.orient);
}

// Terna di riferimento della "telecamera": f = dove punta il telefono,
// r = destra dello schermo, u = alto dello schermo (tutti in Est/Nord/Alto).
function skyBase() {
  if (skyUsaSensori()) {
    // alpha arriva riferito al Nord magnetico: skyCorrezioneNord lo porta al
    // Nord vero, l'unico rispetto al quale sono calcolati gli astri.
    const R = skyMatriceDispositivo(
      (sky.orient.alpha + skyCorrezioneNord() + sky.offsetBussola) * SKY_D2R,
      sky.orient.beta * SKY_D2R,
      sky.orient.gamma * SKY_D2R
    );
    // Assi dello schermo espressi negli assi del telefono (ruotati se è in orizzontale)
    const o = skyAngoloSchermo() * SKY_D2R;
    const co = Math.cos(o), so = Math.sin(o);
    return skyLevigaBase({
      // Si guarda attraverso il retro del telefono: asse -Z del dispositivo
      f: skyApplica(R, [0, 0, -1]),
      r: skyApplica(R, [co, -so, 0]),
      u: skyApplica(R, [so, co, 0])
    });
  }
  // Modalità manuale: la direzione di sguardo la decide il dito, ed è esatta
  sky.baseFiltrata = null;
  const f = skyVettore(sky.manuale.az, sky.manuale.alt);
  const az = sky.manuale.az * SKY_D2R;
  const r = [Math.cos(az), -Math.sin(az), 0]; // orizzontale, verso azimut crescenti
  return { f, r, u: skyCross(r, f) };
}

// Quanto si può stringere e allargare il campo visivo.
// Il minimo era 15°: la larghezza di due mani tese, dove la Luna è un
// puntino di quattordici pixel e Saturno una briciola. Ma un planetario non
// serve solo a trovare gli astri, serve anche a guardarli: a un quarto di
// grado la Luna esce dallo schermo con i suoi mari, Giove mostra le bande e
// Saturno gli anelli. È lo stesso gesto di prima — il pizzico, la rotellina,
// i tasti + e − — solo che adesso non si ferma a metà strada.
const SKY_FOV_MIN = 0.25;
const SKY_FOV_MAX = 110;

// A forte ingrandimento la mano trema più del cielo: un grado di oscillazione
// del polso, che a campo largo valeva mezzo pixel, a mezzo grado di campo
// sposta la vista di uno schermo intero. Lo si dice una volta sola per
// sessione, e solo a chi sta puntando col telefono.
let skyDettoDelTremolio = false;

// Il campo si può cambiare in due modi. Di netto — ed è quello che serve
// quando a comandare sono le dita (il pizzico) o l'obiettivo della
// fotocamera: lì un ritardo, per quanto piccolo, si vedrebbe come un cielo
// che scivola sotto le dita invece di stare attaccato. Oppure `morbido`, e
// allora questo dice solo dove si vuole arrivare: al campo ci si scivola
// dentro un fotogramma per volta (vedi `skyMuoviZoom`, sezione 7.4-ter). È il
// modo dei tasti + e −, della rotellina e del "campo normale", dove il salto
// secco fa perdere il filo di cosa si stava guardando.
function skyImpostaFov(gradi, opzioni = {}) {
  sky.fovVoluto = Math.max(SKY_FOV_MIN, Math.min(SKY_FOV_MAX, gradi));
  if (!opzioni.morbido) sky.fov = sky.fovVoluto;
  if (!skyDettoDelTremolio && sky.fovVoluto <= 6 && skyUsaSensori()) {
    skyDettoDelTremolio = true;
    skyAvviso('ingrandimento', 'A questo ingrandimento il tremolio della mano si vede tutto: ' +
      'spegni “Segui il telefono” e muovi la mappa col dito, oppure scegli l’astro e accendi “Insegui”.', 12000);
  }
}

// Distanza focale in pixel corrispondente al campo visivo verticale scelto
function skyFocale() {
  return (sky.altezza / 2) / Math.tan(sky.fov / 2 * SKY_D2R);
}

// --- Realtà aumentata: il campo del disegno è quello dell'obiettivo ---
// Sulla mappa disegnata il campo visivo è una preferenza: si stringe per
// guardare da vicino, si allarga per avere il colpo d'occhio. Sopra
// l'immagine della fotocamera non lo è più: è un dato dell'obiettivo, e
// sbagliarlo è il motivo per cui gli astri "scivolano" sul video.
//
// Il conto è questo. Un telefono tenuto dritto inquadra in altezza una
// sessantina di gradi di mondo; la mappa ne disegnava 55 sulla stessa
// altezza, cioè disegnava il cielo ingrandito di quasi un quinto. Al centro
// le due immagini combaciano lo stesso — il centro è il centro per tutti e
// due — ma già a un quarto di schermo dal centro il segno disegnato cade
// quattro gradi più in là dell'astro vero, otto lune piene. E soprattutto:
// girando il telefono il segno attraversa lo schermo più in fretta
// dell'immagine sotto. È esattamente quello che si vede, e che sembra un
// difetto del puntamento: punti un astro, lo centri, e appena ti muovi il suo
// segno se ne va per conto proprio.
//
// Quanto riprenda l'obiettivo il browser non lo dice: né getSettings() né
// getCapabilities() espongono il campo visivo. Lo si assume: SKY_CAMERA_LATO
// è il campo coperto dal LATO LUNGO del fotogramma, che sui telefoni sta
// intorno ai 65° e — a differenza della diagonale — non cambia se lo stream
// arriva in 4:3 o in 16:9, perché il ritaglio del 16:9 toglie sempre dal lato
// corto. Da lì si ricava la focale del video in pixel, e da quella quanti
// gradi entrano davvero nell'altezza del riquadro, tenendo conto del ritaglio
// di `object-fit: cover`. Se poi quell'obiettivo è più largo o più stretto
// della media, il pizzico lo tara e la taratura resta salvata.
const SKY_CAMERA_LATO = 65;      // gradi sul lato lungo del fotogramma
const SKY_CAMERA_LATO_MIN = 25;
const SKY_CAMERA_LATO_MAX = 120;

// Misure del video così com'è inquadrato adesso: il lato lungo del fotogramma
// e quanta della sua altezza sopravvive al ritaglio, in pixel di video.
function skyGeometriaVideo() {
  const video = document.getElementById('skymap-video');
  if (!video) return null;
  const vw = video.videoWidth, vh = video.videoHeight;
  const cw = sky.larghezza, ch = sky.altezza;
  // videoWidth resta 0 finché il primo fotogramma non è arrivato
  if (!vw || !vh || !cw || !ch) return null;
  // `object-fit: cover`: il video è ingrandito quel tanto che basta a coprire
  // il riquadro, e quel che avanza viene tagliato via.
  const scala = Math.max(cw / vw, ch / vh);
  return { latoLungo: Math.max(vw, vh), altezzaVisibile: Math.min(vh, ch / scala) };
}

function skyTaraturaCamera() {
  return sky.cameraCampoLato || SKY_CAMERA_LATO;
}

// Campo verticale (in gradi) che l'immagine copre davvero nel riquadro
function skyCampoFotocamera() {
  const g = skyGeometriaVideo();
  if (!g) return 0;
  const focale = (g.latoLungo / 2) / Math.tan(skyTaraturaCamera() / 2 * SKY_D2R);
  return 2 * Math.atan((g.altezzaVisibile / 2) / focale) * SKY_R2D;
}

// L'inverso: che obiettivo bisogna supporre perché nel riquadro entrino
// esattamente quei gradi in verticale. Serve al pizzico, che tara guardando
// l'immagine invece che i numeri.
function skyLatoPerCampo(campoVerticale) {
  const g = skyGeometriaVideo();
  if (!g) return 0;
  const focale = (g.altezzaVisibile / 2) / Math.tan(campoVerticale / 2 * SKY_D2R);
  return 2 * Math.atan((g.latoLungo / 2) / focale) * SKY_R2D;
}

// Il campo lo detta l'obiettivo solo quando il cielo insegue davvero
// l'inquadratura. Con la vista sganciata, o senza sensori, la fotocamera è
// soltanto uno sfondo: lì lo zoom torna a essere una comodità di chi guarda.
function skyCampoDaObiettivo() {
  return !!sky.camera && skyUsaSensori();
}

// Riallinea il campo del disegno a quello dell'obiettivo. Va rifatto a ogni
// fotogramma: il video parte dopo (le sue misure arrivano con il primo
// fotogramma) e il riquadro cambia da solo con lo schermo intero e con la
// rotazione del telefono.
function skySincronizzaCampoFotocamera() {
  if (!skyCampoDaObiettivo()) return;
  const campo = skyCampoFotocamera();
  if (!campo || !isFinite(campo)) return;
  sky.cameraCampo = campo;
  // Qui il campo non è una preferenza ma una misura: si prende com'è, e si
  // spegne anche l'eventuale zoom morbido ancora in viaggio, che altrimenti
  // continuerebbe a tirare il cielo via dall'inquadratura
  sky.fov = campo;
  sky.fovVoluto = campo;
}

function skyImpostaTaraturaCamera(gradiLatoLungo) {
  if (!gradiLatoLungo || !isFinite(gradiLatoLungo)) return;
  sky.cameraCampoLato = Math.max(SKY_CAMERA_LATO_MIN, Math.min(SKY_CAMERA_LATO_MAX, gradiLatoLungo));
  skySincronizzaCampoFotocamera();
  // Durante il pizzico arrivano decine di valori al secondo: si salva quando
  // le dita si fermano.
  clearTimeout(sky.salvaCamera);
  sky.salvaCamera = setTimeout(() => {
    try { localStorage.setItem(CHIAVE_SKY_CAMERA, sky.cameraCampoLato.toFixed(2)); } catch (e) { /* niente storage */ }
  }, 400);
}

// Con la fotocamera accesa lo zoom non ingrandisce: tara. Il gesto è lo
// stesso di sempre — si allarga o si stringe il cielo disegnato — ma quello
// che cambia è quanto si suppone che riprenda l'obiettivo, finché gli astri
// non si posano su quelli veri.
function skyTaraCampoFotocamera(campoVerticaleVoluto) {
  const campo = Math.max(5, Math.min(140, campoVerticaleVoluto));
  const lato = skyLatoPerCampo(campo);
  if (!lato) return;
  skyImpostaTaraturaCamera(lato);
  skyAvviso('camera-taratura',
    `Taratura della fotocamera: ${Math.round(sky.cameraCampo)}° di cielo nell'altezza dello schermo. ` +
    'Allarga o stringi finché gli astri disegnati non si posano su quelli veri.', 5000);
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
  const a = skyElenco().find(x => x.id === id);
  return a ? a.nome : id;
}

// =====================================================================
// 7.1 Posizione dell'osservatore e sensori
// =====================================================================

// --- Dal Nord magnetico al Nord vero (declinazione) ---
// La bussola del telefono non punta al Nord geografico: punta dove tira il
// campo magnetico terrestre. Lo scarto fra i due — la declinazione — vale
// circa 4° in Italia, ma arriva a 15° a Seattle e a oltre 20° in Patagonia,
// e non è una costante: dipende da dove sei e cambia di anno in anno.
//
// Né Android né iOS la correggono: `deviceorientationabsolute` e
// `webkitCompassHeading` danno tutti e due la direzione del Nord MAGNETICO
// (WebKit legge `CLHeading.magneticHeading`). Gli astri invece si calcolano
// rispetto al Nord vero: usare l'una per puntare gli altri sposta tutto il
// cielo di quei gradi, sempre nello stesso verso. È la ragione per cui il
// nostro cielo cadeva accanto agli astri mentre le altre app di planetario,
// che questa correzione la fanno, sullo stesso telefono ci cascano sopra.
//
// La declinazione si ricava dal World Magnetic Model 2025 (NOAA/NGA, dato di
// pubblico dominio, valido dal 2025 al 2030): uno sviluppo in armoniche
// sferiche del campo terrestre fino al dodicesimo grado. I coefficienti sono
// in nanotesla; g e h sono il campo all'epoca 2025.0, dg e dh la sua deriva
// annua. L'indice della coppia (n, m) è n·(n+1)/2 + m.
const SKY_WMM = {
  epoca: 2025.0,
  nMax: 12,
  g: [0,-29351.8,-1410.8,-2556.6,2951.1,1649.3,1361,-2404.1,1243.8,453.6,895,799.5,55.7,-281.1,12.1,-233.2,368.9,187.2,-138.7,-142,20.9,64.4,63.8,76.9,-115.7,-40.9,14.9,-60.7,79.5,-77,-8.8,59.3,15.8,2.5,-11.1,14.2,23.2,10.8,-17.5,2,-21.7,16.9,15,-16.8,0.9,4.6,7.8,3,-0.2,-2.5,-13.1,2.4,8.6,-8.7,-12.9,-1.3,-6.4,0.2,2,-1,-0.6,-0.9,1.5,0.9,-2.7,-3.9,2.9,-1.5,-2.5,2.4,-0.6,-0.1,-0.6,-0.1,1.1,-1,-0.2,2.6,-2,-0.2,0.3,1.2,-1.3,0.6,0.6,0.5,-0.1,-0.4,-0.2,-1.3,-0.7],
  h: [0,0,4545.4,0,-3133.6,-815.1,0,-56.6,237.5,-549.5,0,278.6,-133.9,212,-375.6,0,45.4,220.2,-122.9,43,106.1,0,-18.4,16.8,48.8,-59.8,10.9,72.7,0,-48.9,-14.4,-1,23.4,-7.4,-25.1,-2.3,0,7.1,-12.6,11.4,-9.7,12.7,0.7,-5.2,3.9,0,-24.8,12.2,8.3,-3.3,-5.2,7.2,-0.6,0.8,10,0,3.3,0,2.4,5.3,-9.1,0.4,-4.2,-3.8,0.9,-9.1,0,0,2.9,-0.6,0.2,0.5,-0.3,-1.2,-1.7,-2.9,-1.8,-2.3,0,-1.3,0.7,1,-1.4,0,0.6,-0.1,0.8,0.1,-1,0.1,0.2],
  dg: [0,12,9.7,-11.6,-5.2,-8,-1.3,-4.2,0.4,-15.6,-1.6,-2.4,-6,5.6,-7,0.6,1.4,0,0.6,2.2,0.9,-0.2,-0.4,0.9,1.2,-0.9,0.3,0.9,0,-0.1,-0.1,0.5,-0.1,-0.8,-0.8,0.8,-0.1,0.2,0,0.5,-0.1,0.3,0.2,0,0.2,0,-0.1,0.1,0.3,-0.3,0,0.3,-0.1,0.1,-0.1,0.1,0,0.1,0.1,0,-0.3,0,-0.1,-0.1,0,0,0,0,0,0,0,-0.1,0,0,-0.1,-0.1,-0.1,-0.1,0,0,0,0,0,0,0.1,0,0,0,-0.1,0,-0.1],
  dh: [0,0,-21.5,0,-27.7,-12.1,0,4,-0.3,-4.1,0,-1.1,4.1,1.6,-4.4,0,-0.5,2.2,0.4,1.7,1.9,0,0.3,-1.6,-0.4,0.9,0.7,0.9,0,0.6,0.5,-0.8,0,-1,0.6,-0.2,0,-0.2,0.5,-0.4,0.4,-0.5,-0.6,0.3,0.2,0,-0.3,0.3,-0.3,0.3,0.2,-0.1,-0.2,0.4,0.1,0,0,0,-0.2,0.1,-0.1,0.1,0,-0.1,0.2,0,0,0,0.1,0,0.1,0,0,0.1,0,0,0,0,0,0,0,-0.1,0.1,0,0,0,0,0,0,0,-0.1]
};

// Declinazione magnetica in gradi (positiva se il Nord magnetico sta a Est di
// quello vero) al livello del mare, nel luogo e nell'istante dati.
function skyDeclinazioneMagnetica(lat, lon, quando) {
  const M = SKY_WMM, nMax = M.nMax;
  const data = quando instanceof Date ? quando : new Date(quando || Date.now());
  const anno = data.getUTCFullYear();
  const annoDecimale = anno + (data.getTime() - Date.UTC(anno, 0, 1)) / (365 * 86400000);
  // Fuori dalla finestra di validità il modello si estrapola: peggiora di
  // qualche decimo di grado all'anno, sempre meglio che ignorare il problema.
  const dt = Math.max(-5, Math.min(10, annoDecimale - M.epoca));

  // Dalla latitudine geodetica (quella del GPS) a quella geocentrica, che è
  // il sistema in cui il modello è scritto. Ellissoide WGS84, raggio di
  // riferimento del modello 6371.2 km.
  const a = 6378.137, b = 6356.7523142, re = 6371.2;
  const e2 = 1 - (b * b) / (a * a);
  const sinLat = Math.sin(lat * SKY_D2R), cosLat = Math.cos(lat * SKY_D2R);
  const rc = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const xp = rc * cosLat;
  const zp = rc * (1 - e2) * sinLat;
  const r = Math.sqrt(xp * xp + zp * zp);
  const phi = Math.asin(zp / r);
  const x = Math.sin(phi);
  const z = Math.sqrt((1 - x) * (1 + x)); // = cos(phi), scritto così per non perdere cifre ai poli

  // Polinomi associati di Legendre semi-normalizzati alla Schmidt, con la
  // loro derivata rispetto alla latitudine (ricorsione standard del WMM).
  const idx = (n, m) => n * (n + 1) / 2 + m;
  const P = [1], dP = [0], norma = [1];
  for (let n = 1; n <= nMax; n++) {
    for (let m = 0; m <= n; m++) {
      const i = idx(n, m);
      if (n === m) {
        const i1 = idx(n - 1, m - 1);
        P[i] = z * P[i1];
        dP[i] = z * dP[i1] + x * P[i1];
      } else if (m > n - 2) {
        const i2 = idx(n - 1, m);
        P[i] = x * P[i2];
        dP[i] = x * dP[i2] - z * P[i2];
      } else {
        const i1 = idx(n - 2, m), i2 = idx(n - 1, m);
        const k = ((n - 1) * (n - 1) - m * m) / ((2 * n - 1) * (2 * n - 3));
        P[i] = x * P[i2] - k * P[i1];
        dP[i] = x * dP[i2] - z * P[i2] - k * dP[i1];
      }
    }
  }
  for (let n = 1; n <= nMax; n++) {
    norma[idx(n, 0)] = norma[idx(n - 1, 0)] * (2 * n - 1) / n;
    for (let m = 1; m <= n; m++) {
      norma[idx(n, m)] = norma[idx(n, m - 1)] *
        Math.sqrt(((n - m + 1) * (m === 1 ? 2 : 1)) / (n + m));
    }
  }
  for (let n = 1; n <= nMax; n++) {
    for (let m = 0; m <= n; m++) {
      const i = idx(n, m);
      P[i] *= norma[i];
      dP[i] *= -norma[i];
    }
  }

  // Seni e coseni dei multipli della longitudine, e potenze del raggio
  const cosL = Math.cos(lon * SKY_D2R), sinL = Math.sin(lon * SKY_D2R);
  const cosM = [1, cosL], sinM = [0, sinL];
  for (let m = 2; m <= nMax; m++) {
    cosM[m] = cosM[m - 1] * cosL - sinM[m - 1] * sinL;
    sinM[m] = cosM[m - 1] * sinL + sinM[m - 1] * cosL;
  }
  const rp = [(re / r) * (re / r)];
  for (let n = 1; n <= nMax; n++) rp[n] = rp[n - 1] * (re / r);

  // Somma delle armoniche: bx verso Nord, by verso Est, bz verso il basso
  let bx = 0, by = 0, bz = 0;
  for (let n = 1; n <= nMax; n++) {
    for (let m = 0; m <= n; m++) {
      const i = idx(n, m);
      const g = M.g[i] + dt * M.dg[i];
      const h = M.h[i] + dt * M.dh[i];
      bz -= rp[n] * (g * cosM[m] + h * sinM[m]) * (n + 1) * P[i];
      by += rp[n] * (g * sinM[m] - h * cosM[m]) * m * P[i];
      bx -= rp[n] * (g * cosM[m] + h * sinM[m]) * dP[i];
    }
  }
  const cosPhi = Math.cos(phi);
  if (Math.abs(cosPhi) > 1e-10) {
    by /= cosPhi;
  } else {
    // Ai poli la divisione per il coseno esplode: la componente verso Est si
    // ricava con la formula limite prevista dal modello.
    by = 0;
    let q1 = 1;
    const Ps = [1];
    for (let n = 1; n <= nMax; n++) {
      const i = idx(n, 1);
      const q2 = q1 * (2 * n - 1) / n;
      const q3 = q2 * Math.sqrt(2 * n / (n + 1));
      q1 = q2;
      if (n === 1) {
        Ps[n] = Ps[n - 1];
      } else {
        const k = ((n - 1) * (n - 1) - 1) / ((2 * n - 1) * (2 * n - 3));
        Ps[n] = x * Ps[n - 1] - k * Ps[n - 2];
      }
      by += rp[n] * ((M.g[i] + dt * M.dg[i]) * sinM[1] - (M.h[i] + dt * M.dh[i]) * cosM[1]) * Ps[n] * q3;
    }
  }

  // Il campo è nel sistema geocentrico: va riportato all'orizzonte locale
  const psi = phi - lat * SKY_D2R;
  const nord = bx * Math.cos(psi) - bz * Math.sin(psi);
  return Math.atan2(by, nord) * SKY_R2D;
}

// Ricalcola la declinazione per la posizione corrente. Cambia di pochi primi
// d'arco all'anno e di un grado ogni centinaio di chilometri: basta rifarla
// quando cambia il luogo.
function skyAggiornaDeclinazione() {
  if (!sky.posizione) { sky.declinazione = 0; return; }
  try {
    const d = skyDeclinazioneMagnetica(sky.posizione.lat, sky.posizione.lon, new Date());
    sky.declinazione = isFinite(d) ? d : 0;
  } catch (e) {
    sky.declinazione = 0;
  }
}

// Correzione da sommare ad alpha per passare al Nord vero. Ha senso solo con
// una bussola vera: quando l'orientamento è relativo, alpha parte da un punto
// qualunque e il riferimento lo dà a mano l'utente.
function skyCorrezioneNord() {
  return sky.assoluto ? -sky.declinazione : 0;
}

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
const SKY_PRECISIONE_MIGLIORE = 2;   // quanto dev'essere più stretta per valere comunque
const SKY_FONTI_RIPIEGO = ['salvata', 'backup'];

// Le sorgenti che l'utente ha scelto o che vengono da un vero satellite:
// una lettura di rete non deve mai scavalcarle, se non per un trasloco vero.
const POS_ORIGINI_PRECISE = ['gps', 'manuale', 'citta'];
// Le due sorgenti che sono una decisione, non una misura: la città scelta in
// elenco e le coordinate scritte a mano.
const POS_SCELTA_UTENTE = ['manuale', 'citta'];
// Le letture che arrivano da sole, senza che nessuno le abbia chieste in
// quel momento: il GPS che si stringe mentre aggancia, l'indirizzo IP, la
// posizione riletta dal browser all'avvio.
const POS_FONTI_AUTOMATICHE = ['gps', 'rete', 'salvata'];
// Quanto deve dire "sei altrove" la rete perché le crediamo comunque: sotto i
// 150 km è la solita imprecisione dell'indirizzo IP, sopra è un trasferimento.
const POS_RETE_TRASLOCO_M = 150000;
// Quanto è larga, in metri, una posizione dedotta dall'indirizzo IP: nel
// migliore dei casi indovina la città, spesso solo la provincia.
const POS_PRECISIONE_RETE_M = 25000;

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
  // Scelta esplicita dell'utente (coordinate a mano o città scelta in elenco):
  // comanda lei, sempre. È l'ultimo strato, quello che non può fallire.
  if (fonte === 'manuale' || fonte === 'citta') return true;

  // Una posizione di ripiego (ultima salvata, backup) non scalza mai una posizione vera
  if (SKY_FONTI_RIPIEGO.includes(fonte) && !SKY_FONTI_RIPIEGO.includes(attuale.fonte)) return false;

  // La rete (indirizzo IP) indovina la città, a volte solo la regione: serve
  // a non lasciare l'app cieca quando il GPS non risponde, ma non deve
  // sostituire un punto che l'utente ha scelto o che i satelliti hanno dato.
  // L'unica eccezione è il trasloco: se dice un luogo lontanissimo, quella
  // che abbiamo è semplicemente di un'altra vita.
  if (fonte === 'rete' &&
      POS_ORIGINI_PRECISE.includes(attuale.origine) &&
      skyDistanzaMetri(attuale.lat, attuale.lon, lat, lon) < POS_RETE_TRASLOCO_M) {
    return false;
  }

  // Mai tornare indietro nel tempo: le risposte del browser possono arrivare
  // fuori ordine, e una lettura presa dalla cache è più vecchia di quella in uso.
  if (tempo && attuale.tempo && tempo < attuale.tempo) return false;

  // Una lettura molto più stretta di quella in uso porta comunque qualcosa di
  // nuovo, anche se il punto si sposta di poco: è il passaggio dal fix di rete
  // largo chilometri al fix GPS largo venti metri. Rifiutarlo lasciava la
  // vista a dichiarare una precisione che non aveva.
  if (precisione && attuale.precisione &&
      precisione * SKY_PRECISIONE_MIGLIORE < attuale.precisione) return true;

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

// --- La posizione scelta comanda ---
// Chi apre le Impostazioni e sceglie la sua città sta dicendo una cosa
// precisa: "l'app deve calcolare da qui". Poi però il planetario si apre,
// il GPS aggancia, la sorveglianza consegna un fix a duecento metri — e
// quello, passando il filtro qui sopra, buttava via la scelta appena fatta.
// Da fuori sembrava che la posizione non venisse salvata: si impostava, si
// tornava indietro e ne era già comparsa un'altra.
// Da qui in poi una scelta esplicita resta finché è l'utente a chiedere un
// nuovo rilevamento (il tasto "Rileva di nuovo" della finestra della
// posizione, o il tasto Posizione del planetario): sono loro a mettere
// `posRilevamentoForzato`, e solo per il tempo della cascata.
let posRilevamentoForzato = false;

function posizioneSceltaDaUtente() {
  const p = sky.posizione;
  return !!p && POS_SCELTA_UTENTE.includes(p.origine || p.fonte);
}

// Applica una posizione, se la lettura supera il filtro qui sopra.
// Restituisce true quando la posizione è stata davvero cambiata.
function skyImpostaPosizione(lat, lon, fonte, dettagli) {
  const precisione = dettagli && isFinite(dettagli.precisione) ? dettagli.precisione : null;
  const tempo = dettagli && dettagli.tempo ? dettagli.tempo : null;
  // Da dove viene davvero il punto. `fonte` dice come è arrivato adesso
  // ('salvata' quando lo rileggiamo dal browser), `origine` dice chi l'ha
  // prodotto la prima volta: senza, dopo un riavvio non sapremmo più
  // distinguere un fix GPS da una città scelta a mano.
  const origine = (dettagli && dettagli.origine) ||
    (SKY_FONTI_RIPIEGO.includes(fonte) ? null : fonte);
  const nome = dettagli && dettagli.nome ? dettagli.nome : null;

  // Prima di ogni altro giudizio: una lettura automatica non tocca la
  // posizione che l'utente ha scelto. Lo scarto viene annotato, perché chi
  // aveva chiesto la lettura deve poterlo raccontare invece di far finta
  // che il GPS abbia deciso lui.
  if (POS_FONTI_AUTOMATICHE.includes(fonte) && !posRilevamentoForzato && posizioneSceltaDaUtente()) {
    sky.scartoPerScelta = true;
    skyAggiornaStato();
    return false;
  }
  sky.scartoPerScelta = false;

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

  // Il nome del luogo: quello dichiarato da chi ha fornito il punto, oppure
  // la città di riferimento più vicina. Serve a dire "Roma" invece di
  // "41,9° N, 12,5° E", che a colpo d'occhio non dice niente a nessuno.
  sky.posizione = {
    lat, lon, fonte, origine, precisione, tempo,
    nome: nome || nomeLuogoVicino(lat, lon)
  };
  // L'osservatore non lo si costruisce più qui: nel planetario può esserci un
  // luogo di sola visita che ha la precedenza, e sceglierlo è compito suo
  // (vedi 7.1-ter). Con il luogo di visita acceso, questo cambio di posizione
  // aggiorna il resto dell'app ma non sposta il cielo disegnato.
  skyAggiornaOsservatore();
  // Lo scarto fra Nord magnetico e Nord vero dipende da dove sei davvero (è
  // il magnetometro del telefono a leggerlo, non il cielo che stai guardando):
  // si rifà sulla posizione vera, non sul luogo di visita.
  skyAggiornaDeclinazione();
  // Cambiando luogo cambiano orari, altezze e giudizi: la memoria va svuotata
  svuotaCacheLocali();
  try {
    localStorage.setItem(CHIAVE_SKY_POSIZIONE, JSON.stringify({
      lat, lon, precisione, tempo,
      origine: sky.posizione.origine,
      nome: sky.posizione.nome
    }));
  } catch (e) { /* storage pieno o non disponibile: pazienza */ }
  skyAvviso('posizione', ''); // la posizione c'è: via l'eventuale avviso
  skyAggiornaStato();
  aggiornaTastiPosizione();
  return true;
}

// Rilegge l'ultima posizione salvata (così l'app funziona subito, anche offline)
function skyCaricaPosizioneSalvata() {
  try {
    const dati = JSON.parse(localStorage.getItem(CHIAVE_SKY_POSIZIONE) || 'null');
    if (dati && typeof dati.lat === 'number' && typeof dati.lon === 'number') {
      // Ci portiamo dietro anche quanto era precisa, quando è stata presa e
      // da quale strato veniva: servono a giudicare le letture nuove senza
      // ripartire da zero, e a dire all'utente cosa sta usando l'app.
      skyImpostaPosizione(dati.lat, dati.lon, 'salvata', {
        precisione: dati.precisione,
        tempo: dati.tempo,
        origine: dati.origine || null,
        nome: dati.nome || null
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
      // Un browser senza geolocalizzazione non è un browser rotto: succede
      // dietro certe policy aziendali, o su pagine servite senza HTTPS.
      sky.erroreGps = { codice: 'assente', quando: Date.now() };
      risolvi(false);
      return;
    }
    let concluso = false;
    const concludi = (esito) => { if (!concluso) { concluso = true; risolvi(esito); } };

    // Finché l'utente non risponde alla richiesta di permesso il browser non
    // richiama nulla (i "timeout" qui sotto partono solo dopo il consenso):
    // dopo 16 secondi smettiamo di aspettare e lo diciamo.
    const attesaMassima = setTimeout(() => {
      sky.erroreGps = { codice: 'attesa', quando: Date.now() };
      concludi(false);
    }, 16000);

    const usa = (pos) => {
      clearTimeout(attesaMassima);
      sky.erroreGps = null;
      // La posizione viene comunque usata, anche se arriva in ritardo:
      // il filtro qui sopra decide se è meglio di quella che abbiamo già.
      skyImpostaPosizione(pos.coords.latitude, pos.coords.longitude, 'gps', {
        precisione: pos.coords.accuracy,
        tempo: pos.timestamp
      });
      skyAggiornaOggetti(true);
      // Il dispositivo ha risposto: resta da dire se la sua risposta è stata
      // presa o se comanda ancora la posizione scelta a mano. Sono due esiti
      // diversi da raccontare, non lo stesso "fatto".
      concludi(sky.scartoPerScelta ? 'scartata' : 'gps');
    };

    // Il motivo del rifiuto cambia tutto quello che ha senso dire dopo:
    // un permesso negato si risolve nelle impostazioni del browser, un
    // timeout riprovando, un dispositivo senza antenna mai.
    const annota = (err) => {
      const c = err && err.code;
      sky.erroreGps = {
        codice: c === 1 ? 'permesso' : c === 3 ? 'attesa' : 'indisponibile',
        quando: Date.now()
      };
    };

    // Prima si chiede il GPS vero e una lettura recente. Se non arriva
    // (al chiuso, o senza antenna) si ripiega su wi-fi/rete, che è meglio
    // di niente: la lettura grossolana passa comunque dal filtro.
    navigator.geolocation.getCurrentPosition(
      usa,
      (err1) => {
        annota(err1);
        // Permesso negato: insistere con una seconda richiesta non serve a
        // nulla, il browser risponderebbe di nuovo di no senza chiedere.
        if (err1 && err1.code === 1) { clearTimeout(attesaMassima); concludi(false); return; }
        navigator.geolocation.getCurrentPosition(
          usa,
          (err2) => { annota(err2); clearTimeout(attesaMassima); concludi(false); },
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

// Una sola lettura non basta: il primo fix che il browser consegna è quasi
// sempre quello di rete (wi-fi o cella), largo centinaia di metri o
// chilometri, perché il GPS vero impiega decine di secondi ad agganciare i
// satelliti. Chiedendo la posizione una volta sola all'apertura ci si teneva
// quel primo fix per tutta la sessione. Finché il planetario è aperto la
// posizione resta invece sotto osservazione, così la lettura si stringe da
// sola man mano che il GPS aggancia; il filtro qui sopra decide di volta in
// volta se la nuova lettura è meglio di quella in uso.
// `autorizzata` dice che il consenso c'è già (l'utente ha appena chiesto la
// posizione): senza quella certezza la sorveglianza non parte da sola, se no
// aprire il planetario farebbe comparire subito la richiesta di permesso,
// che invece deve restare legata al pulsante.
function skySorvegliaPosizione(autorizzata) {
  if (sky.sorveglianza !== null || !navigator.geolocation) return;
  if (!autorizzata) {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' })
        .then(p => { if (p.state === 'granted' && sky.aperto) skySorvegliaPosizione(true); })
        .catch(() => { /* alcuni browser non sanno interrogare questo permesso */ });
    }
    return;
  }
  try {
    sky.sorveglianza = navigator.geolocation.watchPosition(
      (pos) => {
        const cambiata = skyImpostaPosizione(pos.coords.latitude, pos.coords.longitude, 'gps', {
          precisione: pos.coords.accuracy,
          tempo: pos.timestamp
        });
        if (cambiata) skyAggiornaOggetti(true);
        else skyAggiornaStato();
      },
      () => { /* permesso negato o sensore assente: restano le letture a richiesta */ },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  } catch (e) { /* browser senza watchPosition: pazienza */ }
}

function skySmettiDiSorvegliare() {
  if (sky.sorveglianza === null) return;
  try { navigator.geolocation.clearWatch(sky.sorveglianza); } catch (e) { /* già chiuso */ }
  sky.sorveglianza = null;
}

// =====================================================================
// 7.1-bis  LA POSIZIONE A STRATI
//   Senza un punto sulla Terra metà dell'app resta spenta: niente orari
//   di sorgere e tramonto, niente buio astronomico, niente meteo, niente
//   passaggi della ISS. Ma il modo "giusto" di sapere dove sei fallisce
//   più spesso di quanto sembri: il permesso negato per abitudine, il
//   GPS che al chiuso non aggancia, il browser da scrivania che non ha
//   proprio l'antenna.
//
//   Per questo la posizione non ha una strada sola, ne ha tre, provate
//   in ordine e sempre dichiarate a chi guarda:
//
//     1. GPS      — il satellite: metri di errore. Chiede il permesso.
//     2. Rete     — l'indirizzo IP: indovina la città, sbaglia di
//                   chilometri, ma non chiede niente a nessuno.
//     3. A mano   — l'utente sceglie la città in elenco o scrive le
//                   coordinate. Funziona sempre, anche senza rete, e
//                   per questo è l'ultimo strato: non può fallire.
//
//   Ogni strato è un ripiego di quello sopra, mai una sostituzione: una
//   lettura di rete non scalza mai un fix GPS (lo dice il filtro in
//   skyLetturaAttendibile), e l'app dice sempre con quale strato sta
//   lavorando, perché "±25 km" e "±8 m" non sono la stessa cosa.
// =====================================================================

// Come si racconta ogni strato: `provenienza` è la frase intera ("rilevata
// dal GPS"), `breve` è l'etichetta che sta in una riga stretta.
const POS_ETICHETTE = {
  gps:     { breve: 'GPS',           provenienza: 'rilevata dal GPS del dispositivo' },
  rete:    { breve: 'rete',          provenienza: 'dedotta dalla connessione' },
  citta:   { breve: 'città scelta',  provenienza: 'la città che hai scelto' },
  manuale: { breve: 'a mano',        provenienza: 'le coordinate che hai scritto' },
  salvata: { breve: 'salvata',       provenienza: 'l\'ultima posizione salvata' },
  backup:  { breve: 'da backup',     provenienza: 'ripristinata da un backup' }
};

// Città di riferimento più vicina, se sta entro il raggio indicato: dà un
// nome al punto ("vicino a Bologna") invece di due numeri.
function nomeLuogoVicino(lat, lon, raggioKm = 60) {
  if (typeof ECL_CITTA === 'undefined' || !isFinite(lat) || !isFinite(lon)) return null;
  let migliore = null, distanza = Infinity;
  for (const [nome, paese, cLat, cLon] of ECL_CITTA) {
    const d = skyDistanzaMetri(lat, lon, cLat, cLon);
    if (d < distanza) { distanza = d; migliore = nome; }
  }
  return distanza <= raggioKm * 1000 ? migliore : null;
}

// --- Strato 2: la posizione dedotta dall'indirizzo IP -----------------
// Tre servizi diversi, provati in fila: sono gratuiti e senza chiave, ma
// proprio per questo capita che uno sia irraggiungibile o abbia finito le
// richieste del giorno. Basta che ne risponda uno.
const POS_SERVIZI_RETE = [
  {
    url: 'https://ipapi.co/json/',
    leggi: d => (d && !d.error ? { lat: +d.latitude, lon: +d.longitude, nome: d.city, paese: d.country_name } : null)
  },
  {
    url: 'https://ipwho.is/',
    leggi: d => (d && d.success !== false ? { lat: +d.latitude, lon: +d.longitude, nome: d.city, paese: d.country } : null)
  },
  {
    url: 'https://get.geojs.io/v1/ip/geo.json',
    leggi: d => (d ? { lat: +d.latitude, lon: +d.longitude, nome: d.city, paese: d.country } : null)
  }
];

// Una fetch che non resta appesa: senza rete il browser può tenere aperta
// la richiesta per minuti, e l'utente resterebbe a guardare "Cerco…".
function fetchConScadenza(url, ms = 6000) {
  if (typeof AbortController === 'undefined') return fetch(url);
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), ms);
  return fetch(url, { signal: stop.signal }).finally(() => clearTimeout(timer));
}

async function posizioneDallaRete() {
  for (const servizio of POS_SERVIZI_RETE) {
    try {
      const risposta = await fetchConScadenza(servizio.url);
      if (!risposta.ok) continue;
      const letto = servizio.leggi(await risposta.json());
      if (letto && isFinite(letto.lat) && isFinite(letto.lon) &&
          Math.abs(letto.lat) <= 90 && Math.abs(letto.lon) <= 180 &&
          !(letto.lat === 0 && letto.lon === 0)) {
        return letto;
      }
    } catch (e) { /* servizio muto o rete assente: si prova il prossimo */ }
  }
  return null;
}

// Perché il GPS non ha risposto, detto in modo che si capisca cosa fare.
function posMotivoGps() {
  const codice = sky.erroreGps ? sky.erroreGps.codice : null;
  switch (codice) {
    case 'permesso':
      return 'Permesso negato. Puoi ridarlo dal lucchetto accanto all\'indirizzo del browser.';
    case 'attesa':
      return 'Il dispositivo non ha risposto in tempo: al chiuso il GPS spesso non aggancia.';
    case 'indisponibile':
      return 'Il dispositivo non è riuscito a calcolare la posizione.';
    case 'assente':
      return 'Questo browser non offre la geolocalizzazione.';
    default:
      return 'Nessuna risposta dal dispositivo.';
  }
}

// La cascata vera e propria. `suPasso(strato, stato, testo)` viene chiamata
// a ogni passaggio, così l'interfaccia può raccontare quello che sta
// succedendo invece di mostrare una rotella muta.
//   stato: 'corso' | 'fatto' | 'fallito' | 'ignorato' | 'serve'
// Restituisce { esito, strato, messaggio }, dove esito vale:
//   'gps' | 'rete'      → posizione nuova, dallo strato indicato
//   'invariata'         → gli strati automatici non hanno cambiato quella che c'era
//   'manuale'           → non c'è nessuna posizione: tocca all'utente
//
// `opzioni.forzato` dice che la cascata parte da un gesto esplicito ("Rileva
// di nuovo", il tasto Posizione): solo allora una lettura automatica può
// sostituire la posizione che l'utente aveva scelto a mano. Senza questo, il
// primo fix del GPS cancellava la città appena scelta nelle Impostazioni.
async function trovaPosizioneAStrati(suPasso, opzioni) {
  const passo = (strato, stato, testo) => { if (suPasso) suPasso(strato, stato, testo); };
  const avevaPosizione = !!luogoCorrente();
  const scelta = posizioneSceltaDaUtente();
  const nomeScelto = (sky.posizione && sky.posizione.nome) || null;
  const forzato = !!(opzioni && opzioni.forzato);
  const precedente = posRilevamentoForzato;
  posRilevamentoForzato = forzato;

  try {
    return await _trovaPosizioneAStrati(passo, { avevaPosizione, scelta, nomeScelto });
  } finally {
    posRilevamentoForzato = precedente;
  }
}

async function _trovaPosizioneAStrati(passo, { avevaPosizione, scelta, nomeScelto }) {
  // --- Strato 1: il GPS del dispositivo ---
  passo('gps', 'corso', 'Chiedo la posizione al dispositivo…');
  const daGps = await skyRichiediPosizione();
  if (daGps === 'scartata') {
    // Il dispositivo ha risposto, ma la posizione la comanda chi l'ha scelta:
    // qui si dice cosa è successo e come cambiare idea, senza spostare niente.
    const dove = nomeScelto ? ` (${nomeScelto})` : '';
    passo('gps', 'ignorato', `Il dispositivo ha risposto, ma stai usando la posizione che hai scelto tu${dove}.`);
    passo('rete', 'ignorato', 'Non serve.');
    passo('manuale', 'serve', 'Cambiala qui sotto, o usa “Rileva di nuovo” per tornare al GPS.');
    return {
      esito: 'invariata', strato: 'gps',
      messaggio: `Tengo la posizione che hai scelto tu${dove}: le letture automatiche non la sostituiscono. ` +
        'Per tornare al GPS usa “Rileva di nuovo”.'
    };
  }
  if (daGps) {
    passo('gps', 'fatto', 'Posizione rilevata dal dispositivo.');
    passo('rete', 'ignorato', 'Non serve: il GPS ha risposto.');
    passo('manuale', 'ignorato', 'Non serve.');
    return { esito: 'gps', strato: 'gps', messaggio: 'Fatto: sto usando la posizione del dispositivo.' };
  }
  passo('gps', 'fallito', posMotivoGps());

  // --- Strato 2: l'indirizzo IP ---
  passo('rete', 'corso', 'Provo a capirlo dalla connessione…');
  const daRete = await posizioneDallaRete();
  if (daRete) {
    const applicata = skyImpostaPosizione(daRete.lat, daRete.lon, 'rete', {
      precisione: POS_PRECISIONE_RETE_M,
      tempo: Date.now(),
      nome: daRete.nome || null
    });
    if (applicata) {
      const dove = sky.posizione && sky.posizione.nome ? ` (${sky.posizione.nome})` : '';
      passo('rete', 'fatto', `Posizione approssimata dalla connessione${dove}.`);
      passo('manuale', 'serve', 'Correggila qui sotto se non è il tuo paese.');
      return {
        esito: 'rete', strato: 'rete',
        messaggio: `Posizione approssimata dalla rete${dove}: buona per gli orari, ` +
          'può sbagliare di qualche decina di chilometri. Se non è il posto giusto, correggila qui sotto.'
      };
    }
    // Rifiutata: o perché quella che abbiamo è più precisa, o perché è una
    // scelta dell'utente e nessuna lettura automatica la scavalca. Sono due
    // cose diverse e vanno dette in modo diverso: la seconda non è un
    // fallimento, è l'app che rispetta quello che le è stato detto.
    if (scelta) {
      const dove = nomeScelto ? ` (${nomeScelto})` : '';
      passo('rete', 'ignorato', `Comanda la posizione che hai scelto tu${dove}.`);
      passo('manuale', 'serve', 'Cambiala qui sotto, se ti sei spostato.');
      return {
        esito: 'invariata', strato: 'rete',
        messaggio: `Tengo la posizione che hai scelto tu${dove}: la rete indovina la città, ma la tua scelta vale di più.`
      };
    }
    passo('rete', 'ignorato', 'La posizione che hai già è più precisa di questa.');
    passo('manuale', 'serve', 'Cambiala qui sotto se ti sei spostato.');
    return {
      esito: 'invariata', strato: 'rete',
      messaggio: 'Non sono riuscito ad aggiornarla, ma quella che hai già è più precisa: la tengo.'
    };
  }
  passo('rete', 'fallito', 'Nessuna risposta: sembri offline.');

  // --- Strato 3: a mano. Non fallisce, ma deve farlo l'utente ---
  if (avevaPosizione) {
    passo('manuale', 'serve', 'Puoi cambiarla qui sotto.');
    return {
      esito: 'invariata', strato: 'manuale',
      messaggio: 'Non riesco a rilevarla adesso: resta quella di prima. Puoi sempre sceglierla a mano qui sotto.'
    };
  }
  passo('manuale', 'serve', 'Scegli la città o scrivi le coordinate: funziona sempre.');
  return {
    esito: 'manuale', strato: 'manuale',
    messaggio: 'Né GPS né rete hanno risposto. Nessun problema: scegli la tua città qui sotto, ' +
      'oppure scrivi le coordinate. Funziona anche senza connessione.'
  };
}

// =====================================================================
// 7.1-ter  IL LUOGO DA CUI SI GUARDA (solo nel planetario)
//   L'app ha una posizione sola, e la decide chi la usa: quella delle
//   Impostazioni. È lei che dice a che ora fa buio, che tempo farà, quando
//   passa la stazione spaziale, dove puntare il telescopio. Quella non si
//   tocca da nessun'altra parte.
//
//   Il planetario però fa anche un altro mestiere: guardare. "Che cielo si
//   vede stanotte dal Cile?", "Da casa dei miei l'eclissi è totale?" —
//   domande legittime, che con una posizione sola costringevano a cambiare
//   davvero residenza all'app, e poi a ricordarsi di rimetterla a posto
//   (di solito ce se ne accorgeva il giorno dopo, con il meteo di un'altra
//   nazione nella scheda Stasera).
//
//   Da qui in poi il planetario può avere un luogo suo, di sola visita:
//   sposta il cielo disegnato e nient'altro. Non viene salvato — alla
//   riapertura si torna a casa da soli — e la barra in alto lo dichiara
//   sempre, perché un cielo che non è il tuo deve dirlo.
// =====================================================================

// Da dove si sta guardando il cielo: il luogo di visita se c'è, se no la
// posizione vera. `proprio` distingue i due casi per chi deve raccontarlo.
function skyLuogoDelCielo() {
  if (sky.luogoVista) {
    return { lat: sky.luogoVista.lat, lon: sky.luogoVista.lon, nome: sky.luogoVista.nome || null, proprio: true };
  }
  const l = luogoCorrente();
  if (!l) return null;
  return {
    lat: l.lat, lon: l.lon,
    nome: (sky.posizione && sky.posizione.nome) || null,
    proprio: false
  };
}

// Rifà l'osservatore del planetario a partire dal luogo effettivo. Va
// chiamata a ogni cambio — di posizione vera o di luogo di visita — perché
// tutto il cielo (astri, orari, traccia, eclittica) parte da qui.
function skyAggiornaOsservatore() {
  const l = skyLuogoDelCielo();
  sky.observer = (l && typeof Astronomy !== 'undefined')
    ? new Astronomy.Observer(l.lat, l.lon, 0)
    : null;
  // Cambiando luogo cambiano altezze, orari e giudizi: la memoria va svuotata
  sky.prossimoCalcolo = 0;
  sky.cacheOrari = { chiave: null, valore: null };
  if (sky.aperto && typeof skyAggiornaOggetti === 'function') skyAggiornaOggetti(true);
  skyAggiornaStato();
  skyAggiornaLuogoVistaUI();
}

// Sposta l'occhio altrove. Restituisce false se il punto non ha senso: le
// coordinate scritte a mano possono essere qualsiasi cosa.
function skyImpostaLuogoVista(lat, lon, nome) {
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
  sky.luogoVista = { lat, lon, nome: nome || nomeLuogoVicino(lat, lon) };
  skyAggiornaOsservatore();
  return true;
}

// Torna a casa: il cielo riprende a essere quello della posizione dell'app.
function skyTornaAlLuogoDiCasa() {
  if (!sky.luogoVista) return;
  sky.luogoVista = null;
  skyAggiornaOsservatore();
}

// --- Il riquadro del luogo, dentro il pannello Tempo ------------------
// Sta lì e non altrove perché tempo e luogo sono le due coordinate dello
// stesso cielo: chi apre quel pannello sta già chiedendo "e se guardassi
// da un'altra parte?" — che sia un'altra ora o un altro posto.

let skyLuogoTimerCitta = null;
let skyLuogoRichiesta = 0;

// La riga di lettura: da dove si guarda, e se è casa o una visita.
function skyAggiornaLuogoVistaUI() {
  const nomeEl = document.getElementById('skymap-luogo-nome');
  const casa = document.getElementById('skymap-luogo-casa');
  const nota = document.getElementById('skymap-luogo-nota');
  const l = skyLuogoDelCielo();

  // Il nome basta: le coordinate stanno già nella lettura di stato in alto a
  // destra, e ripeterle qui allungava la riga senza dire niente di nuovo.
  if (nomeEl) {
    nomeEl.textContent = l ? (l.nome || formattaCoordinate(l.lat, l.lon)) : 'nessuna posizione';
    nomeEl.title = l ? formattaCoordinate(l.lat, l.lon) : '';
    nomeEl.dataset.visita = l && l.proprio ? 'si' : 'no';
  }
  if (casa) casa.classList.toggle('hidden', !(l && l.proprio));
  // Una riga sola, e diversa nei due casi: quando il cielo è spostato la nota
  // deve rassicurare (il resto dell'app non si è mosso), quando è a casa deve
  // solo dire cosa succede se si cerca una città.
  if (nota) {
    nota.textContent = l && l.proprio
      ? 'Solo qui: orari, meteo, satelliti e telescopio restano sulla tua posizione.'
      : 'Vale solo per il planetario: il resto dell\'app resta sulla tua posizione.';
  }
}

// Applica una città o un punto scelto nel pannello e lo racconta
function skyUsaLuogoVista(lat, lon, nome) {
  // Le coordinate arrivano da un elenco di città, quindi sono buone: il
  // controllo resta come rete di sicurezza per chi chiamasse da altrove.
  if (!skyImpostaLuogoVista(lat, lon, nome)) {
    skyAvviso('luogo', 'Quel punto non sta sulla Terra: riprova con un\'altra città.', 6000);
    return;
  }
  skyMostraRisultatiLuogo([], null);
  const campo = document.getElementById('skymap-luogo-cerca');
  if (campo) campo.value = '';
  const l = skyLuogoDelCielo();
  skyAvviso('luogo', `Cielo visto da ${l && l.nome ? l.nome : formattaCoordinate(lat, lon)}: solo qui nel planetario.`, 7000);
}

function skyMostraRisultatiLuogo(elenco, nota) {
  const box = document.getElementById('skymap-luogo-risultati');
  if (!box) return;
  if (!elenco.length) {
    box.innerHTML = nota ? `<p class="pos-risultati-nota">${nota}</p>` : '';
    return;
  }
  box.innerHTML = elenco.map((c, i) => `
    <button type="button" class="pos-risultato" role="option" data-luogo="${i}">
      <span class="pos-risultato-nome">${c.nome}</span>
      <span class="pos-risultato-paese">${c.paese || ''}</span>
    </button>`).join('') + (nota ? `<p class="pos-risultati-nota">${nota}</p>` : '');
  box.querySelectorAll('[data-luogo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = elenco[parseInt(btn.dataset.luogo, 10)];
      if (c) skyUsaLuogoVista(c.lat, c.lon, c.nome);
    });
  });
}

// Stessa ricerca della finestra della posizione: prima l'elenco a bordo, che
// risponde subito e funziona offline, poi il servizio online per i paesi
// piccoli. Riusarla evita due comportamenti diversi per la stessa domanda.
function skyCercaCittaVista(testo) {
  if (skyLuogoTimerCitta) clearTimeout(skyLuogoTimerCitta);
  const locali = posCittaLocali(testo);
  if ((testo || '').trim().length < 2) { skyMostraRisultatiLuogo([], null); return; }
  skyMostraRisultatiLuogo(locali, locali.length ? null : 'Cerco anche fuori dall\'elenco…');
  const richiesta = ++skyLuogoRichiesta;
  skyLuogoTimerCitta = setTimeout(async () => {
    const online = await posCittaOnline(testo);
    if (richiesta !== skyLuogoRichiesta) return;  // nel frattempo ha scritto altro
    const visti = new Set(locali.map(c => posNormalizzaNome(c.nome)));
    const uniti = locali.concat(online.filter(c => !visti.has(posNormalizzaNome(c.nome)))).slice(0, 10);
    skyMostraRisultatiLuogo(uniti, uniti.length ? null : 'Nessuna città con questo nome.');
  }, 420);
}

// Collega i comandi del riquadro. Chiamata una volta sola, da inizializzaSkymap.
function skyInizializzaLuogoVista() {
  const cerca = document.getElementById('skymap-luogo-cerca');
  if (cerca) {
    cerca.addEventListener('input', () => skyCercaCittaVista(cerca.value));
    // Invio: se c'è una sola città trovata è quella che si vuole
    cerca.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const primo = document.querySelector('#skymap-luogo-risultati [data-luogo]');
      if (primo) primo.click();
    });
  }

  const casa = document.getElementById('skymap-luogo-casa');
  if (casa) {
    casa.addEventListener('click', () => {
      skyTornaAlLuogoDiCasa();
      skyAvviso('luogo', 'Cielo di nuovo dalla tua posizione.', 4000);
    });
  }

  // La posizione principale non si cambia da qui: per quella c'è la sua
  // finestra (Impostazioni, o il tasto Posizione). Un secondo ingresso in
  // questo pannello avrebbe rimesso in dubbio quale delle due comanda.
  skyAggiornaLuogoVistaUI();
}

// Il telefono può mandare DUE flussi di orientamento, e sono flussi diversi:
// "deviceorientationabsolute" è riferito al Nord vero (usa il magnetometro),
// mentre "deviceorientation" su Android è relativo, cioè la sua alpha parte
// da dove si trovava il telefono quando il sensore si è acceso. Ascoltandoli
// tutti e due, sessanta volte al secondo ciascuno, si sovrascrivevano a
// vicenda: le loro alpha differiscono di un angolo qualunque, e il cielo
// rimbalzava di continuo fra due orientamenti. Comanda l'assoluto; il
// relativo si usa solo finché l'assoluto non arriva, o se smette di arrivare.
const SKY_ATTESA_ASSOLUTO_MS = 3000;

// Riceve alpha/beta/gamma dal telefono. Su iOS webkitCompassHeading dà
// direttamente la direzione rispetto al Nord vero: è la più affidabile.
function skyEventoOrientamento(e) {
  const bussolaIOS = typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading);
  const assoluto = bussolaIOS || e.absolute === true || e.type === 'deviceorientationabsolute';
  const adesso = Date.now();

  if (assoluto) {
    sky.ultimoAssoluto = adesso;
  } else if (adesso - sky.ultimoAssoluto < SKY_ATTESA_ASSOLUTO_MS) {
    return; // c'è di meglio in arrivo: questa lettura non serve
  }

  // Un valore mancante non è "zero": prenderlo alla lettera faceva scattare
  // il cielo verso Nord. Se manca, si tiene l'ultimo valore buono.
  const prec = sky.orient;
  const numero = (v, difetto) => (typeof v === 'number' && isFinite(v) ? v : difetto);
  const alpha = bussolaIOS
    ? 360 - e.webkitCompassHeading            // bussola di iOS -> alpha assoluto
    : numero(e.alpha, prec ? prec.alpha : null);
  const beta = numero(e.beta, prec ? prec.beta : null);
  const gamma = numero(e.gamma, prec ? prec.gamma : null);
  if (alpha === null || beta === null || gamma === null) return;

  // Cambiando sorgente l'alpha cambia di scatto: il filtro riparte da capo,
  // altrimenti il cielo ci arriverebbe scivolando per mezzo secondo.
  const cambioSorgente = assoluto !== sky.assoluto;
  if (cambioSorgente) sky.baseFiltrata = null;

  sky.orient = { alpha, beta, gamma };
  sky.assoluto = assoluto;
  sky.sensori = true;
  // Cambia anche quel che possiamo promettere all'utente: con una bussola
  // relativa il Nord va corretto a mano.
  if (cambioSorgente) skyAggiornaStato();
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
  // Ci si iscrive a entrambi gli eventi, ma non per usarli entrambi: quello
  // assoluto è il migliore e su certi dispositivi esiste senza mai arrivare,
  // quindi il relativo resta lì come rete di sicurezza. A scegliere fra i due,
  // lettura per lettura, è skyEventoOrientamento.
  sky.baseFiltrata = null;
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

// Ogni quanto rifare i conti delle posizioni quando l'orologio cammina da
// solo. Una volta al secondo è stata a lungo la risposta giusta: il cielo
// ruota di quindici secondi d'arco al secondo, e a campo largo sono due
// centesimi di pixel — nessuno può vederli. Ma il planetario adesso arriva a
// un quarto di grado di campo, e lì quello stesso scatto vale un pixel
// abbondante: le stelle smettono di scorrere e cominciano a saltellare una
// volta al secondo, e con l'inseguimento acceso a saltellare è tutto il
// cielo attorno all'astro tenuto fermo.
//
// L'intervallo si adatta quindi a quanto si è ingranditi: si sceglie il
// tempo che il cielo impiega a spostarsi di mezzo pixel. A campo largo viene
// un tempo lunghissimo e si resta al secondo tondo; stringendo scende da
// solo fino a dieci volte al secondo, che è già il passo del playback e non
// ha mai dato problemi. Sotto non si va: le figure delle costellazioni e la
// Via Lattea sono centinaia di conversioni di coordinate, e rifarle a ogni
// fotogramma pianta tutto.
const SKY_ROTAZIONE_GRADI_SEC = 360 / 86164;   // quanto ruota il cielo in un secondo
const SKY_CALCOLO_MIN_MS = 100;
const SKY_CALCOLO_MAX_MS = 1000;
// I numeri scritti attorno alla mappa, invece, restano a due volte al secondo
// qualunque cosa faccia il cielo: nessuno legge un'altezza che cambia dieci
// volte al secondo, e riscriverla costa più che disegnare
const SKY_UI_INTERVALLO = 500;

function skyIntervalloCalcolo() {
  const gradiPerPixel = sky.fov / Math.max(1, sky.altezza || 340);
  const secondi = (gradiPerPixel * 0.5) / SKY_ROTAZIONE_GRADI_SEC;
  return Math.max(SKY_CALCOLO_MIN_MS, Math.min(SKY_CALCOLO_MAX_MS, secondi * 1000));
}

// Ricalcola azimut e altezza di tutti gli astri (al massimo una volta al secondo)
function skyAggiornaOggetti(forza) {
  const adesso = Date.now();
  if (!forza && adesso < sky.prossimoCalcolo) return;
  sky.prossimoCalcolo = adesso + (sky.playbackVerso ? SKY_PLAYBACK_INTERVALLO : skyIntervalloCalcolo());

  if (typeof Astronomy === 'undefined' || !sky.observer) {
    sky.oggetti = [];
    // Senza posizione non si sa dove guardare, ma cosa succede stanotte sì:
    // l'elenco degli eventi vive lo stesso
    skyAggiornaEventi();
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
        distanzaUA: equ.dist,
        // Coordinate equatoriali dell'epoca di oggi: sono quelle da mettere
        // sui cerchi graduati di un telescopio, e quelle che mostra la scheda
        raOra: equ.ra,
        decOra: equ.dec
      });
      // La costellazione si cerca in coordinate J2000 (i confini sono
      // definiti in quel sistema). Per le stelle le abbiamo già in tabella;
      // per i corpi del Sistema Solare serve una seconda conversione.
      if (astro.tipo !== 'stella') {
        try {
          const eqj = Astronomy.Equator(astro.id, t, sky.observer, false, true);
          voce.ra = eqj.ra;
          voce.dec = eqj.dec;
        } catch (e) { /* restano solo le coordinate di oggi */ }
      }
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
  skyAggiungiSatelliti(lista, quando);
  skyOmbraDellaTerra(lista, t);
  skyAssettoDiSaturno(lista, t);
  sky.oggetti = lista;
  skyAggiornaCatalogo(quando);

  // Quello che sta INTORNO alla mappa — le altezze scritte nei chip, la
  // scheda dell'oggetto, l'elenco di cosa succede — non ha bisogno di
  // seguire il cielo scatto per scatto: sono numeri che un occhio umano
  // legge, non un'immagine che scorre. Ricalcolarli dieci volte al secondo
  // (a forte ingrandimento, o col playback lanciato) vuol dire rifare dieci
  // volte al secondo una scansione di tutto il calendario e riscrivere pezzi
  // di pagina — ed è esattamente il lavoro che ruba i millisecondi al
  // disegno, cioè la fluidità che si stava cercando di guadagnare.
  if (forza || adesso >= sky.prossimoAggiornoUI) {
    sky.prossimoAggiornoUI = adesso + SKY_UI_INTERVALLO;
    skyAggiornaEtichette();
    skyAggiornaTestoTempo();
    // Cosa succede nel cielo di quest'ora: l'elenco segue l'orologio
    skyAggiornaEventi();
    skyChiediEventiDelMese();
  }

  // Chi arriva da un'altra scheda ("Trova Marte nel cielo") chiede di
  // centrare un astro le cui coordinate, in quel momento, non c'erano ancora
  if (sky.centraQuandoPronto) {
    const atteso = lista.find(x => x.id === sky.centraQuandoPronto) ||
      skyVoceDiId(sky.centraQuandoPronto);
    if (atteso && typeof atteso.az === 'number') {
      sky.centraQuandoPronto = null;
      skyCentraSu(atteso);
    }
  }
}

// La Luna dentro il cono d'ombra della Terra. Il conto va fatto dal centro
// della Terra, non da qui: la parallasse lunare vale fino a un grado, cioè
// quanto tutta l'ombra, e prendere le coordinate che vediamo noi metterebbe
// l'ombra dalla parte sbagliata.
// I raggi dell'ombra sono quelli classici (Chauvenet): l'ombra piena e la
// penombra si costruiscono dalla parallasse della Luna, da quella del Sole e
// dal raggio apparente del Sole, allargate dell'un per cento perché l'aria
// della Terra gonfia un po' il cono.
const SKY_RAGGIO_TERRA = 6378.14;
const SKY_RAGGIO_SOLE = 696000;
const SKY_RAGGIO_LUNA = 1737.4;

function skyOmbraDellaTerra(lista, t) {
  const luna = lista.find(o => o.id === 'Moon');
  if (!luna) return;
  luna.ombraTerra = null;
  if (typeof Astronomy === 'undefined' || typeof Astronomy.GeoVector !== 'function') return;
  try {
    const gl = Astronomy.GeoVector('Moon', t, true);
    const gs = Astronomy.GeoVector('Sun', t, true);
    const dL = Math.hypot(gl.x, gl.y, gl.z) * SKY_KM_PER_UA;
    const dS = Math.hypot(gs.x, gs.y, gs.z) * SKY_KM_PER_UA;
    if (!dL || !dS) return;
    const piL = Math.asin(SKY_RAGGIO_TERRA / dL) * SKY_R2D;
    const piS = Math.asin(SKY_RAGGIO_TERRA / dS) * SKY_R2D;
    const sS = Math.asin(SKY_RAGGIO_SOLE / dS) * SKY_R2D;
    const rL = Math.asin(SKY_RAGGIO_LUNA / dL) * SKY_R2D;
    const umbra = 1.02 * (piL + piS - sS);
    const penombra = 1.02 * (piL + piS + sS);

    // Il centro dell'ombra è il punto opposto al Sole
    const u = skyNormalizza([gl.x, gl.y, gl.z]);
    const a = skyNormalizza([-gs.x, -gs.y, -gs.z]);
    const gamma = skyAngoloFra(u, a);
    if (gamma > penombra + rL) return;     // la Luna è fuori: niente da disegnare

    // Da che parte le sta l'ombra, detto come angolo di posizione (dal nord
    // celeste verso est): è l'unico modo di passare il dato al disegno senza
    // portarsi dietro tutto il sistema di coordinate.
    const nord = skyNormalizza([-u[2] * u[0], -u[2] * u[1], 1 - u[2] * u[2]]);
    const est = skyNormalizza([-u[1], u[0], 0]);
    const p = skyDot(a, u);
    const versoOmbra = skyNormalizza([a[0] - p * u[0], a[1] - p * u[1], a[2] - p * u[2]]);
    const pa = Math.atan2(skyDot(versoOmbra, est), skyDot(versoOmbra, nord));
    luna.ombraTerra = { gamma, umbra, penombra, rL, pa };
  } catch (e) { /* niente ombra: la Luna resta piena, e pazienza */ }
}

// Quanto sono aperti gli anelli di Saturno. Non è un dettaglio da grafico:
// nel marzo 2025 erano esattamente di taglio e sparivano per settimane,
// mentre nel 2032 saranno spalancati. Il numero è il seno della latitudine
// da cui li guardiamo, e si ricava dall'asse di rotazione del pianeta.
function skyAssettoDiSaturno(lista, t) {
  const saturno = lista.find(o => o.id === 'Saturn');
  if (!saturno) return;
  if (typeof Astronomy === 'undefined' || typeof Astronomy.RotationAxis !== 'function') return;
  try {
    const asse = Astronomy.RotationAxis('Saturn', t);
    const g = Astronomy.GeoVector('Saturn', t, true);
    const u = skyNormalizza([g.x, g.y, g.z]);
    const n = skyNormalizza([asse.north.x, asse.north.y, asse.north.z]);
    // Guardiamo il polo nord degli anelli se il loro nord punta verso di noi
    saturno.aperturaAnelli = -skyDot(n, u);
  } catch (e) { /* si userà l'apertura media */ }
}

// Aggiunge ISS e Tiangong agli oggetti del cielo. A differenza dei pianeti
// si spostano di un grado ogni pochi secondi: oltre al punto calcoliamo la
// scia, cioè da dove arrivano e dove stanno andando nei minuti vicini.
function skyAggiungiSatelliti(lista, quando) {
  if (typeof satellite === 'undefined') return;
  // Come tutto il resto del disegno, anche le stazioni spaziali si vedono
  // dal luogo da cui si sta guardando, che può non essere casa (7.1-ter)
  const luogo = skyLuogoDelCielo();
  if (!luogo) return;
  const gd = satOsservatoreGd(luogo);

  SATELLITI.forEach(sat => {
    const rec = satRecDi(sat);
    if (!rec) { satPrecaricaTle(); return; }
    const p = satAltAz(rec, quando, gd);
    if (!p) return;

    const traccia = [];
    for (let m = -4; m <= 4; m += 0.5) {
      const q = satAltAz(rec, new Date(quando.getTime() + m * 60000), gd);
      if (q) traccia.push({ az: q.az, alt: q.alt, futuro: m > 0 });
    }

    lista.push({
      id: 'sat-' + sat.id,
      satId: sat.id,
      nome: sat.nome,
      disegno: 'satellite',
      colore: sat.colore,
      tipo: 'satellite',
      az: p.az,
      alt: p.alt,
      distanzaKm: p.distanza,
      illuminato: satelliteIlluminato(p.posizione, quando),
      traccia,
      // Dati da tabella per la scheda: cos'è, quanto è grande, quanto brilla
      classe: sat.classe,
      dimensione: sat.dimensione,
      magTipica: sat.magTipica,
      periodoMin: sat.periodoMin,
      nota: sat.nota
    });
  });
}

// Gli astri si ricalcolano una volta al secondo, e va benissimo: si spostano
// di un grado ogni quattro minuti. Una stazione spaziale fa un grado in un
// secondo, quindi la sua posizione la riprendiamo a ogni fotogramma (due
// propagazioni per volta: costano poco e il puntino non salta più).
function skyMuoviSatelliti() {
  if (typeof satellite === 'undefined' || !sky.oggetti.length) return;
  const luogo = skyLuogoDelCielo();
  if (!luogo) return;
  const gd = satOsservatoreGd(luogo);
  const quando = skyAdesso();

  sky.oggetti.forEach(o => {
    if (o.tipo !== 'satellite') return;
    const sat = satelliteDaId(o.satId);
    const rec = sat && satRecDi(sat);
    if (!rec) return;
    const p = satAltAz(rec, quando, gd);
    if (!p) return;
    o.az = p.az;
    o.alt = p.alt;
    o.distanzaKm = p.distanza;
  });
}

// Orari di sorgere, culminazione e tramonto dell'astro selezionato
// (ricalcolati ogni mezz'ora: cercarli è la cosa più costosa di tutta la vista)
function skyOrari(id) {
  if (!sky.observer || typeof Astronomy === 'undefined') return null;
  // Le stazioni spaziali non "sorgono" una volta al giorno: fanno un giro
  // ogni 90 minuti. Per loro contano i passaggi, non gli orari di sorgere.
  if (typeof id === 'string' && id.startsWith('sat-')) return null;
  const chiave = `${id}|${Math.floor(skyAdesso().getTime() / 1800000)}`;
  if (sky.cacheOrari.chiave === chiave) return sky.cacheOrari.valore;
  let valore = null;
  try {
    const adesso = skyAdesso();
    const sorge = Astronomy.SearchRiseSet(id, sky.observer, 1, adesso, 1);
    const tramonta = Astronomy.SearchRiseSet(id, sky.observer, -1, adesso, 1);
    valore = { sorge: sorge ? sorge.date : null, tramonta: tramonta ? tramonta.date : null };
    // Il momento in cui passa più alto: è l'ora giusta per puntarlo, perché
    // l'aria da attraversare è al minimo
    try {
      const culmine = Astronomy.SearchHourAngle(id, sky.observer, 0, adesso);
      valore.culmina = culmine.time.date;
      valore.altezzaMax = culmine.hor.altitude;
    } catch (e) { /* alcuni corpi non hanno culminazione utile: pazienza */ }
  } catch (e) {
    valore = null;
  }
  sky.cacheOrari = { chiave, valore };
  return valore;
}

// Sorgere, culminazione e tramonto di un punto fisso del cielo (galassie,
// nebulose, stelle delle costellazioni). Non sono corpi della libreria,
// quindi il conto si fa a mano: l'angolo orario all'orizzonte dice quanto
// tempo passa fra la culminazione e il tramonto, e il tempo siderale dice
// quando cade quella culminazione.
const SKY_ORA_SIDERALE = 0.9972695663;   // un'ora siderale, in ore solari
const SKY_GIORNO_SIDERALE_MS = 86164.09 * 1000;
function skyOrariPuntoFisso(ra, dec) {
  if (!sky.observer || typeof Astronomy === 'undefined') return null;
  const lat = sky.observer.latitude, lon = sky.observer.longitude;
  const quando = skyAdesso();
  let gst;
  try { gst = Astronomy.SiderealTime(Astronomy.MakeTime(quando)); } catch (e) { return null; }

  // Ore siderali che mancano al passaggio in meridiano, riportate a ±12
  const lst = ((gst + lon / 15) % 24 + 24) % 24;
  let dt = ra - lst;
  while (dt <= -12) dt += 24;
  while (dt > 12) dt -= 24;
  let culmina = new Date(quando.getTime() + dt * SKY_ORA_SIDERALE * 3600000);
  const altezzaMax = 90 - Math.abs(lat - dec);

  // Angolo orario all'orizzonte, con l'orizzonte abbassato di mezzo grado
  // dalla rifrazione (è la convenzione usata anche per il Sole)
  const h0 = -0.5667 * SKY_D2R;
  const latR = lat * SKY_D2R, decR = dec * SKY_D2R;
  const cosH = (Math.sin(h0) - Math.sin(latR) * Math.sin(decR)) /
               (Math.cos(latR) * Math.cos(decR));
  if (cosH <= -1) return { culmina, altezzaMax, sempreSopra: true };
  if (cosH >= 1) return { culmina, altezzaMax, maiSopra: true };

  const H = Math.acos(cosH) * SKY_R2D / 15;   // in ore
  let sorge = new Date(culmina.getTime() - H * SKY_ORA_SIDERALE * 3600000);
  let tramonta = new Date(culmina.getTime() + H * SKY_ORA_SIDERALE * 3600000);
  // Se il passaggio più vicino è già finito, si guarda al prossimo giro
  if (tramonta < quando) {
    culmina = new Date(culmina.getTime() + SKY_GIORNO_SIDERALE_MS);
    sorge = new Date(sorge.getTime() + SKY_GIORNO_SIDERALE_MS);
    tramonta = new Date(tramonta.getTime() + SKY_GIORNO_SIDERALE_MS);
  }
  return { culmina, altezzaMax, sorge, tramonta };
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

// =====================================================================
// 7.3.1 L'ASPETTO DEL CIELO
//     Un planetario non è un grafico: è un cielo. Il colore del fondo, la
//     foschia sull'orizzonte, l'alone del Sole e le stelle che sbiadiscono
//     quando fa giorno dipendono tutti da un solo numero — l'altezza del
//     Sole — e sono ciò che fa somigliare la mappa a quello che si ha
//     davvero sopra la testa.
// =====================================================================

// Le tappe del colore del cielo, dalla notte piena al mezzogiorno. Per ogni
// altezza del Sole: colore allo zenit, colore all'orizzonte, colore della
// foschia bassa e quanta luce c'è in giro (0 = notte, 1 = giorno pieno).
const SKY_TAPPE_CIELO = [
  { sole: -18, zenit: [2, 6, 22],     orizzonte: [9, 15, 36],     foschia: [26, 30, 48],    luce: 0 },
  { sole: -12, zenit: [4, 10, 32],    orizzonte: [16, 26, 58],    foschia: [46, 42, 62],    luce: 0.05 },
  { sole: -6,  zenit: [14, 32, 74],   orizzonte: [62, 54, 96],    foschia: [140, 82, 92],   luce: 0.2 },
  { sole: -2,  zenit: [30, 62, 118],  orizzonte: [150, 98, 92],   foschia: [236, 140, 88],  luce: 0.45 },
  { sole: 2,   zenit: [46, 96, 164],  orizzonte: [178, 142, 128], foschia: [244, 186, 140], luce: 0.74 },
  { sole: 10,  zenit: [54, 116, 196], orizzonte: [156, 190, 224], foschia: [206, 224, 242], luce: 0.94 },
  { sole: 45,  zenit: [46, 108, 194], orizzonte: [166, 202, 232], foschia: [214, 230, 246], luce: 1 }
];

function skyMescolaColore(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k)
  ];
}

function skyRgba(c, alpha) {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

// L'aria di questo momento, interpolando fra due tappe
function skyAria(altSole) {
  const T = SKY_TAPPE_CIELO;
  if (!sky.atmosfera) {
    // Atmosfera spenta: fondo scuro e costante, come una carta stellare
    return { zenit: T[0].zenit, orizzonte: T[0].orizzonte, foschia: T[0].foschia, luce: 0 };
  }
  if (altSole <= T[0].sole) return T[0];
  for (let i = 1; i < T.length; i++) {
    if (altSole <= T[i].sole) {
      const a = T[i - 1], b = T[i];
      const t = (altSole - a.sole) / (b.sole - a.sole);
      return {
        zenit: skyMescolaColore(a.zenit, b.zenit, t),
        orizzonte: skyMescolaColore(a.orizzonte, b.orizzonte, t),
        foschia: skyMescolaColore(a.foschia, b.foschia, t),
        luce: a.luce + (b.luce - a.luce) * t
      };
    }
  }
  return T[T.length - 1];
}

// Il colore del cielo a una data altezza sull'orizzonte: dallo zenit in giù
// si scalda e si schiarisce, e negli ultimi gradi entra la foschia — di
// giorno la polvere, di notte le luci dei paesi.
function skyColoreCielo(aria, alt) {
  const t = Math.pow(Math.max(0, Math.min(1, alt / 55)), 0.75);
  let c = skyMescolaColore(aria.orizzonte, aria.zenit, t);
  const foschia = Math.max(0, 1 - Math.max(0, alt) / 12);
  return skyMescolaColore(c, aria.foschia, 0.4 * foschia * foschia);
}

// Sfondo del cielo. Il gradiente si costruisce campionando l'altezza vera di
// sette righe dello schermo: così l'orizzonte è più chiaro dello zenit da
// sé, senza dover sapere dove cade. (Con il telefono inclinato di lato la
// stessa riga di pixel non è tutta alla stessa altezza: il gradiente resta
// verticale, ed è un'approssimazione che a occhio non si nota.)
function skyDisegnaSfondo(ctx, base, focale, aria) {
  const L = sky.larghezza, H = sky.altezza;
  const altezzaDellaRiga = (py) => {
    const k = (H / 2 - py) / focale;
    const v = [
      base.f[0] + k * base.u[0],
      base.f[1] + k * base.u[1],
      base.f[2] + k * base.u[2]
    ];
    const n = Math.hypot(v[0], v[1], v[2]) || 1;
    return Math.asin(Math.max(-1, Math.min(1, v[2] / n))) * SKY_R2D;
  };

  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    g.addColorStop(t, skyRgba(skyColoreCielo(aria, altezzaDellaRiga(t * H)), 1));
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L, H);
}

// L'alone del Sole: di giorno lo sbianca tutto attorno a sé, al tramonto
// accende l'orizzonte d'arancione, e resta visibile anche quando il Sole è
// appena sotto — è la ragione per cui il crepuscolo esiste.
function skyDisegnaAloneSole(ctx, base, focale, sole, aria) {
  if (!sole || !sky.atmosfera) return;
  let forza = sole.alt >= 0 ? 0.9 : Math.max(0, 1 + sole.alt / 18);
  // Se la Luna gli sta davanti, il bagliore se ne va con la parte di Sole
  // che copre: è la prima cosa che si nota durante un'eclissi, molto prima
  // che il cielo cambi colore — e senza questo, alla totalità il cielo
  // restava di un grigio da mezzogiorno con la corona in mezzo.
  if (sky.eclisse && sky.eclisse.attiva) forza *= Math.pow(1 - sky.eclisse.copertura, 0.6);
  if (forza <= 0.02) return;

  // Sotto l'orizzonte l'alone si appoggia comunque al suo azimut, appena
  // sopra la linea: è lì che si vede la luce che rimane
  const p = skyProietta(skyVettore(sole.az, Math.max(sole.alt, -8)), base, focale);
  if (!p.davanti) return;

  const raggio = Math.max(60, focale * Math.tan(38 * SKY_D2R));
  const centro = sole.alt >= 0 ? [255, 246, 214] : [255, 196, 128];
  const bordo = skyMescolaColore(aria.foschia, [255, 150, 70], 0.6);

  ctx.save();
  const g = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, raggio);
  g.addColorStop(0, skyRgba(centro, 0.5 * forza));
  g.addColorStop(0.3, skyRgba(bordo, 0.2 * forza));
  g.addColorStop(1, skyRgba(bordo, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.px, p.py, raggio, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// L'alone della Luna: quando è alta e piena illumina il cielo attorno a sé,
// e cancella le stelle deboli. Ha senso solo di notte.
function skyDisegnaAloneLuna(ctx, base, focale, luna) {
  if (!luna || !sky.atmosfera || luna.alt < 0 || sky.luceCielo > 0.25) return;
  const fase = typeof luna.frazione === 'number' ? luna.frazione : 1;
  const forza = 0.13 * fase * fase;
  if (forza < 0.02) return;

  const p = skyProietta(skyVettore(luna.az, luna.alt), base, focale);
  if (!p.davanti) return;
  const raggio = Math.max(30, focale * Math.tan(8 * SKY_D2R));

  ctx.save();
  const g = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, raggio);
  g.addColorStop(0, `rgba(214, 226, 255, ${forza})`);
  g.addColorStop(1, 'rgba(214, 226, 255, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.px, p.py, raggio, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Quanto l'aria smorza un astro basso sull'orizzonte: a dieci gradi la luce
// attraversa cinque volte l'atmosfera che attraversa allo zenit, e si vede.
function skyEstinzione(alt) {
  if (!sky.atmosfera) return 1;
  if (alt >= 22) return 1;
  if (alt <= 0) return 0.4;
  return 0.4 + 0.6 * (alt / 22);
}

// Quanto è visibile una stella con la luce che c'è: di giorno spariscono
// tutte, al crepuscolo restano solo le più luminose.
function skyVelo() {
  return Math.max(0, 1 - sky.luceCielo * 1.12);
}

// --- La Via Lattea ---------------------------------------------------
// Non è un catalogo: è il piano della nostra galassia visto da dentro. Basta
// sapere dove passa (le coordinate galattiche b = 0) e quanto è luminoso
// lungo il giro: verso il centro, in Sagittario, è una nuvola densa; verso
// l'anticentro, in Auriga, si intuisce appena.
const SKY_NGP_RA = 192.85948;    // polo nord galattico, ascensione retta in gradi
const SKY_NGP_DEC = 27.12825;    // ...e declinazione
const SKY_L_NCP = 122.93192;     // longitudine galattica del polo nord celeste

function skyGalatticoAEquatoriale(l, b) {
  const br = b * SKY_D2R;
  const dNGP = SKY_NGP_DEC * SKY_D2R;
  const dl = (SKY_L_NCP - l) * SKY_D2R;
  const sinDec = Math.sin(dNGP) * Math.sin(br) + Math.cos(dNGP) * Math.cos(br) * Math.cos(dl);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  const y = Math.cos(br) * Math.sin(dl);
  const x = Math.cos(dNGP) * Math.sin(br) - Math.sin(dNGP) * Math.cos(br) * Math.cos(dl);
  const ra = ((SKY_NGP_RA + Math.atan2(y, x) * SKY_R2D) % 360 + 360) % 360;
  return { ra: ra / 15, dec: dec * SKY_R2D };
}

// Quanto brilla la banda a quella longitudine galattica
function skyLuceViaLattea(l) {
  const a = ((l % 360) + 360) % 360;
  const dalCentro = Math.min(a, 360 - a);
  const verso = Math.pow(Math.cos(dalCentro * 0.5 * SKY_D2R), 2);
  // Addensamenti e vuoti lungo il giro: una banda perfettamente uniforme si
  // riconosce subito come disegnata a tavolino
  const grumi = 0.86 + 0.14 * Math.sin(a * 0.11) * Math.cos(a * 0.043 + 1.7);
  return (0.4 + 0.6 * verso) * grumi;
}

// Il percorso del piano galattico, calcolato una volta sola
const SKY_VIA_LATTEA = (() => {
  const punti = [];
  for (let l = 0; l <= 360; l += 4) {
    const p = skyGalatticoAEquatoriale(l % 360, 0);
    punti.push({ ra: p.ra, dec: p.dec, luce: skyLuceViaLattea(l) });
  }
  return punti;
})();

// I passaggi con cui si dipinge la banda: dal velo larghissimo e tenue al
// nocciolo stretto e più chiaro. Sommandoli viene una nuvola sfumata, che è
// il modo giusto di disegnare una cosa che non ha bordi.
// I veli con cui si dipinge la banda: venti passate, dalla più larga e
// impalpabile al nocciolo stretto. Con pochi strati larghi si vedeva il bordo
// di ciascuno e la banda sembrava un nastro cucito; venti veli quasi
// trasparenti si fondono in una nuvola sola, senza scalini.
function skyCostruisciVeliViaLattea(quanti, guadagno) {
  const strati = [];
  for (let i = 0; i < quanti; i++) {
    const t = i / (quanti - 1);      // 0 = il velo più largo, 1 = il nocciolo
    strati.push({
      gradi: 1.1 + 17 * Math.pow(1 - t, 1.7),
      alpha: (0.006 + 0.011 * t * t) * guadagno
    });
  }
  return strati;
}

// Due ricette: venti veli dove la GPU se lo può permettere, dieci (più densi,
// così la banda resta della stessa luminosità) sul telefono — riempire venti
// volte mezzo schermo a ogni fotogramma è il conto più caro di tutta la vista.
const SKY_VELI_VIA_LATTEA = skyCostruisciVeliViaLattea(20, 1);
const SKY_VELI_VIA_LATTEA_LEGGERI = skyCostruisciVeliViaLattea(10, 1.9);

function skyDisegnaViaLattea(ctx, base, focale) {
  const punti = sky.viaLattea;
  if (!punti || punti.length < 2) return;
  const velo = skyVelo();
  if (velo < 0.08) return;      // di giorno non c'è niente da mostrare

  const proiettati = punti.map(p => {
    const q = skyProietta(skyVettore(p.az, p.alt), base, focale);
    return { px: q.px, py: q.py, davanti: q.davanti, alt: p.alt, luce: p.luce };
  });

  // La banda si spezza in tratti continui: dove passa dietro di noi, dove
  // scende sotto l'orizzonte, dove il salto fra due punti è troppo grande.
  // Ogni tratto diventa un percorso solo, ripassato venti volte: novanta
  // segmenti con i cappucci tondi lasciavano in cielo una collana di cerchi.
  const tratti = [];
  let corrente = [];
  const chiudi = () => { if (corrente.length > 1) tratti.push(corrente); corrente = []; };
  proiettati.forEach((q, i) => {
    const prec = i > 0 ? proiettati[i - 1] : null;
    const rotto = !q.davanti || q.alt < -8 ||
      (prec && Math.hypot(q.px - prec.px, q.py - prec.py) > sky.larghezza * 0.6);
    if (rotto) { chiudi(); if (q.davanti && q.alt >= -8) corrente.push(q); return; }
    corrente.push(q);
  });
  chiudi();
  if (!tratti.length) return;

  // Ogni tratto si spezza in pezzi corti, ciascuno con la sua luminosità:
  // verso il centro galattico la banda è una nuvola densa, verso l'anticentro
  // si intuisce appena. (Un gradiente da un capo all'altro del tratto
  // sarebbe stato più elegante, ma quando la banda si ripiega i suoi due capi
  // finiscono vicini sullo schermo e il gradiente taglia la nuvola a metà.)
  const pezzi = [];
  tratti.forEach(tratto => {
    const lungo = 5;
    for (let i = 0; i < tratto.length - 1; i += lungo) {
      const pezzo = tratto.slice(i, Math.min(tratto.length, i + lungo + 1));
      if (pezzo.length > 1) pezzi.push(pezzo);
    }
  });

  const veli = sky.larghezza < 560 ? SKY_VELI_VIA_LATTEA_LEGGERI : SKY_VELI_VIA_LATTEA;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Cappucci tagliati, non tondi: con i veli larghi il cappuccio tondo
  // sporgeva oltre la fine del pezzo e si sovrapponeva al pezzo dopo,
  // lasciando lungo la banda una fila di perline chiare
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ced8ff';

  pezzi.forEach(pezzo => {
    // Il percorso si costruisce una volta e i venti veli lo ripassano
    const percorso = new Path2D();
    pezzo.forEach((q, i) => (i === 0 ? percorso.moveTo(q.px, q.py) : percorso.lineTo(q.px, q.py)));

    const media = pezzo.reduce((acc, q) => acc + q.luce * skyEstinzione(q.alt), 0) / pezzo.length;
    const forza = media * velo;
    if (forza < 0.05) return;

    veli.forEach(strato => {
      ctx.globalAlpha = strato.alpha * forza;
      ctx.lineWidth = Math.max(2, focale * Math.tan(strato.gradi * SKY_D2R));
      ctx.stroke(percorso);
    });
  });
  ctx.restore();
}

// =====================================================================
// 7.3.2 LA PELLE DEGLI ASTRI
//   Finché il campo era largo, un astro erano dieci pixel e bastava un
//   pallino colorato. Ma adesso il campo si stringe fino a un quarto di
//   grado: la Luna riempie mezzo schermo, Giove è grande come una moneta —
//   e a quella misura un disco liscio si riconosce subito per quello che è,
//   un cerchio disegnato, non un mondo.
//   Qui ogni astro si prende la sua faccia vera: i mari della Luna alle
//   loro coordinate selenografiche, le bande di Giove alle latitudini
//   giuste, la calotta polare di Marte, la granulazione del Sole e la sua
//   corona quando la Luna gli passa davanti.
//   La spesa si paga una volta sola. Ogni faccia si dipinge su una tela
//   fuori schermo, e da lì in poi si ricopia soltanto: per il browser
//   ricopiare un'immagine è l'operazione più economica che ci sia, mentre
//   ridisegnare cinquanta crateri sessanta volte al secondo farebbe
//   scaldare il telefono e basta.
// =====================================================================

// Numeri a caso sempre uguali. La faccia della Luna non può cambiare fra un
// fotogramma e l'altro (né fra una sessione e l'altra): da un seme — una
// stringa qualunque — esce sempre la stessa sequenza.
function skySeme(testo) {
  let h = 2166136261;
  for (let i = 0; i < testo.length; i++) {
    h ^= testo.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function skyCaso(seme) {
  let s = seme >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Il deposito delle tele ------------------------------------------
// Ogni astro ha una tela per taglia (le taglie raddoppiano: 64, 128, 256…),
// perché ingrandendo servono più pixel. Quando sono troppe se ne va quella
// che non si guarda da più tempo: una Map conserva l'ordine di inserimento,
// quindi la più vecchia è sempre la prima chiave.
const skyTele = new Map();
const SKY_TELE_MAX = 18;

// Quanto grande dipingere una faccia: la potenza di due che copre il
// diametro sullo schermo, tenendo conto dei pixel veri del display. Più
// grande di così non si vedrebbe, e su un telefono si sentirebbe.
function skyLatoTela(rPixel) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const tetto = dispositivoAttuale === 'telefono' ? 256 : 512;
  let lato = 64;
  while (lato < rPixel * 2 * dpr && lato < tetto) lato *= 2;
  return lato;
}

function skyPelle(chiave, lato, pennello) {
  const k = chiave + '@' + lato;
  if (skyTele.has(k)) {
    const gia = skyTele.get(k);
    skyTele.delete(k);
    skyTele.set(k, gia);          // rimessa in fondo alla fila
    return gia;
  }
  let tela = null;
  try {
    tela = document.createElement('canvas');
    tela.width = lato;
    tela.height = lato;
    const c = tela.getContext('2d');
    // Il pennello lavora in un mondo comodo: il disco dell'astro è il
    // cerchio di raggio 1 attorno all'origine, qualunque sia la taglia della
    // tela. Così le coordinate delle macchie si scrivono una volta sola.
    c.translate(lato / 2, lato / 2);
    c.scale(lato / 2, lato / 2);
    c.lineWidth = 0.008;
    pennello(c);
  } catch (e) {
    tela = null;                  // niente tela: si ripiega sul disco sfumato
  }
  skyTele.set(k, tela);
  if (skyTele.size > SKY_TELE_MAX) skyTele.delete(skyTele.keys().next().value);
  return tela;
}

// --- Attrezzi da pittore ---------------------------------------------

// Una nuvola tonda che sfuma verso il bordo: è il pennello con cui si
// dipinge tutto ciò che in natura non ha un contorno (mari, nebulose, aloni)
function skyNuvola(ctx, r, colore, alpha, nocciolo) {
  const g = ctx.createRadialGradient(0, 0, r * (nocciolo == null ? 0.25 : nocciolo), 0, 0, r);
  g.addColorStop(0, skyColoreConAlpha(colore, alpha));
  g.addColorStop(0.6, skyColoreConAlpha(colore, alpha * 0.45));
  g.addColorStop(1, skyColoreConAlpha(colore, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
}

// Dove cade, sul disco che vediamo, un punto di longitudine e latitudine
// date. È la proiezione ortografica, quella giusta per una palla lontana:
// `z` dice se il punto è sulla faccia rivolta a noi e quanto è vicino al
// bordo (più è vicino, più tutto ciò che ci sta sopra si schiaccia).
function skySuSfera(lon, lat) {
  const a = lon * SKY_D2R, b = lat * SKY_D2R;
  const x = Math.cos(b) * Math.sin(a);
  const y = -Math.sin(b);
  const z = Math.cos(b) * Math.cos(a);
  return { x, y, z, rot: Math.atan2(y, x) };
}

// Una macchia appoggiata sulla palla: verso il bordo si stringe nella
// direzione del centro, come succede a tutto ciò che sta su una sfera.
// Il pennello riceve un contesto già portato lì e già schiacciato.
function skyMacchiaSfera(ctx, lon, lat, raggio, pennello) {
  const p = skySuSfera(lon, lat);
  if (p.z <= 0.06) return;        // dall'altra parte, o proprio sul filo
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.scale(Math.max(0.1, p.z), 1);
  pennello(ctx, raggio, p.z);
  ctx.restore();
}

// Le bande di un gigante gassoso. Sono paralleli, e su una palla vista di
// fianco un parallelo è una riga dritta: verso i poli le righe si stringono
// da sé, perché la latitudine entra con un seno. I bordi sono appena
// ondulati — una banda dal bordo dritto sembra nastro adesivo.
function skyBandeSfera(ctx, bande) {
  bande.forEach((b, n) => {
    const y1 = -Math.sin(b.a * SKY_D2R), y2 = -Math.sin(b.b * SKY_D2R);
    const onda = b.onda == null ? 0.014 : b.onda;
    ctx.fillStyle = b.c;
    ctx.globalAlpha = b.alfa == null ? 1 : b.alfa;
    ctx.beginPath();
    for (let x = -1; x <= 1.0001; x += 0.08) {
      const y = y1 + Math.sin(x * 7 + n) * onda;
      if (x === -1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let x = 1; x >= -1.0001; x -= 0.08) {
      ctx.lineTo(x, y2 + Math.sin(x * 5.5 - n * 1.7) * onda);
    }
    ctx.closePath();
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// Crateri sparsi su una palla: un orlo chiaro di materiale scavato e un
// fondo in ombra. La distribuzione è uniforme sulla sfera (la latitudine si
// tira a sorte con un arcoseno, se no si affollano ai poli).
function skyCrateriSfera(ctx, caso, quanti, opzioni) {
  const o = opzioni || {};
  for (let i = 0; i < quanti; i++) {
    const lon = caso() * 360 - 180;
    const lat = Math.asin(caso() * 2 - 1) * SKY_R2D;
    if (o.evita && o.evita(lon, lat) && caso() > 0.25) continue;
    const r = (o.min || 0.008) + Math.pow(caso(), 3) * (o.max || 0.05);
    skyMacchiaSfera(ctx, lon, lat, r, (c, raggio) => {
      c.beginPath();
      c.arc(0, 0, raggio, 0, Math.PI * 2);
      c.fillStyle = o.fondo || 'rgba(96, 92, 88, 0.32)';
      c.fill();
      c.lineWidth = raggio * 0.4;
      c.strokeStyle = o.orlo || 'rgba(240, 236, 228, 0.30)';
      c.stroke();
    });
  }
}

// Una stellina dentro una texture: nocciolo minuscolo e alone
function skyStellina(ctx, x, y, r, colore, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
  g.addColorStop(0, skyColoreConAlpha(colore, alpha));
  g.addColorStop(0.25, skyColoreConAlpha(colore, alpha * 0.4));
  g.addColorStop(1, skyColoreConAlpha(colore, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.4, 0, Math.PI * 2);
  ctx.fill();
}

// --- La Luna ----------------------------------------------------------
// I mari, alle loro coordinate selenografiche vere: longitudine positiva
// verso est, che guardando la Luna con il nord in alto è la destra (il Mare
// Crisium, la macchia staccata in alto a destra, sta a +59°). Il raggio è in
// raggi lunari: l'Imbrium è largo poco meno di un terzo del disco.
const SKY_MARI_LUNA = [
  { lon: -57, lat: 20,  r: 0.40, f: 0.75 },   // Oceanus Procellarum
  { lon: -17, lat: 34,  r: 0.31, f: 0.95 },   // Mare Imbrium
  { lon: 18,  lat: 28,  r: 0.20, f: 1    },   // Mare Serenitatis
  { lon: 31,  lat: 8,   r: 0.23, f: 0.95 },   // Mare Tranquillitatis
  { lon: 59,  lat: 17,  r: 0.14, f: 0.9  },   // Mare Crisium
  { lon: 52,  lat: -8,  r: 0.17, f: 0.8  },   // Mare Fecunditatis
  { lon: 34,  lat: -15, r: 0.11, f: 0.8  },   // Mare Nectaris
  { lon: -17, lat: -21, r: 0.17, f: 0.75 },   // Mare Nubium
  { lon: -39, lat: -24, r: 0.12, f: 0.8  },   // Mare Humorum
  { lon: -2,  lat: 56,  r: 0.15, f: 0.55 },   // Mare Frigoris
  { lon: 4,   lat: 13,  r: 0.09, f: 0.6  },   // Mare Vaporum
  { lon: -31, lat: 8,   r: 0.13, f: 0.5  },   // Mare Insularum
  { lon: -23, lat: -10, r: 0.10, f: 0.55 }    // Mare Cognitum
];

// I crateri che si riconoscono a occhio. Tycho, in basso, è quello con la
// raggiera: alla Luna piena è la cosa più vistosa del disco.
const SKY_CRATERI_LUNA = [
  { lon: -11, lat: -43, r: 0.048, raggiera: 1.05 },   // Tycho
  { lon: -20, lat: 10,  r: 0.042, raggiera: 0.55 },   // Copernico
  { lon: -38, lat: 8,   r: 0.028, raggiera: 0.38 },   // Keplero
  { lon: -47, lat: 24,  r: 0.024, raggiera: 0.34 },   // Aristarco
  { lon: 61,  lat: -9,  r: 0.045, raggiera: 0.22 },   // Langrenus
  { lon: -2,  lat: -9,  r: 0.052, raggiera: 0    },   // Tolomeo
  { lon: 60,  lat: -25, r: 0.048, raggiera: 0    },   // Petavius
  { lon: -8,  lat: -25, r: 0.040, raggiera: 0    }    // Walter
];

function skyDentroUnMare(lon, lat) {
  const p = skySuSfera(lon, lat);
  return SKY_MARI_LUNA.some(m => {
    const q = skySuSfera(m.lon, m.lat);
    return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < m.r;
  });
}

// Un mare non è un cerchio: è una pozza dai contorni frastagliati. Si
// costruisce da più lobi sovrapposti attorno al punto giusto — con un
// cerchio solo si vedeva subito il compasso.
function skyDipingiMare(ctx, m) {
  const caso = skyCaso(skySeme(`mare${m.lon}:${m.lat}`));
  const gradiPerRaggio = 90;                 // un raggio lunare vale 90° d'arco
  for (let i = 0; i < 11; i++) {
    const a = caso() * Math.PI * 2;
    const d = Math.pow(caso(), 0.65) * m.r * 0.6 * gradiPerRaggio;
    const lat = m.lat + Math.sin(a) * d;
    const lon = m.lon + Math.cos(a) * d / Math.max(0.35, Math.cos(lat * SKY_D2R));
    // Lobi allungati e girati a caso: sovrapponendosi danno una pozza dai
    // contorni frastagliati, che è come sono fatti i mari veri
    const giro = caso() * Math.PI, stretto = 0.45 + caso() * 0.5;
    skyMacchiaSfera(ctx, lon, lat, m.r * (0.4 + caso() * 0.5), (c, r) => {
      c.rotate(giro);
      c.scale(1, stretto);
      skyNuvola(c, r, '#5f636d', 0.34 * m.f, 0.8);
    });
  }
}

function skyDipingiLuna(ctx) {
  const caso = skyCaso(skySeme('luna'));
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.clip();

  // Gli altopiani: la roccia chiara e piena di crateri che copre quasi tutto
  ctx.fillStyle = '#c4bfb5';
  ctx.fillRect(-1, -1, 2, 2);

  // I mari: colate di lava antica, grigie e senza bordi netti
  SKY_MARI_LUNA.forEach(m => skyDipingiMare(ctx, m));

  // La grana della superficie: senza, i mari sembrano macchie di vernice
  for (let i = 0; i < 300; i++) {
    const lon = caso() * 360 - 180;
    const lat = Math.asin(caso() * 2 - 1) * SKY_R2D;
    const chiaro = caso() > 0.5;
    skyMacchiaSfera(ctx, lon, lat, 0.015 + caso() * 0.05, (c, r) => {
      skyNuvola(c, r, chiaro ? '#e7e2d8' : '#8d8a84', 0.07, 0.1);
    });
  }

  // I crateri piccoli, quasi tutti sugli altopiani: i mari sono molto più
  // giovani e non hanno avuto il tempo di prenderne
  skyCrateriSfera(ctx, caso, 220, {
    evita: skyDentroUnMare, min: 0.005, max: 0.038,
    fondo: 'rgba(120, 116, 110, 0.16)', orlo: 'rgba(233, 228, 218, 0.15)'
  });

  // Quelli grandi, con nome: attorno hanno il mantello di detriti chiari
  // lanciati dall'impatto, che è ciò che li rende riconoscibili
  SKY_CRATERI_LUNA.forEach(k => {
    if (k.raggiera) {
      skyMacchiaSfera(ctx, k.lon, k.lat, k.r * 2.6, (c, r) => {
        skyNuvola(c, r, '#ece7dd', 0.10 * Math.min(1, k.raggiera), 0.12);
      });
    }
    skyMacchiaSfera(ctx, k.lon, k.lat, k.r, (c, r) => {
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fillStyle = 'rgba(112, 108, 104, 0.22)';
      c.fill();
      c.lineWidth = r * 0.3;
      c.strokeStyle = 'rgba(240, 236, 228, 0.20)';
      c.stroke();
    });
  });

  // Le raggiere di Tycho e Copernico: schizzi chiari lanciati a mezza Luna
  // di distanza. Alla Luna piena sono l'impronta più vistosa del disco — ma
  // sono strisce di polvere, non fuochi d'artificio: partono dall'orlo del
  // cratere (non dal centro, che se no diventa una stella) e si spengono.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  SKY_CRATERI_LUNA.forEach(k => {
    if (!k.raggiera) return;
    const p = skySuSfera(k.lon, k.lat);
    if (p.z <= 0.1) return;
    for (let i = 0; i < 26; i++) {
      const a = caso() * Math.PI * 2;
      const dentro = k.r * 2.2;
      const lungo = dentro + k.raggiera * (0.3 + caso() * 0.8);
      const x1 = p.x + Math.cos(a) * dentro, y1 = p.y + Math.sin(a) * dentro;
      const x2 = p.x + Math.cos(a) * lungo, y2 = p.y + Math.sin(a) * lungo;
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, 'rgba(250, 248, 240, 0.013)');
      g.addColorStop(0.3, 'rgba(250, 248, 240, 0.010)');
      g.addColorStop(1, 'rgba(250, 248, 240, 0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 0.012 + caso() * 0.03;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  });
  ctx.restore();

  // Un filo di scurimento sul bordo: la Luna piena è famosa per essere
  // piatta, ma l'ultimo orlo scuro le dà la rotondità
  const g = ctx.createRadialGradient(0, 0, 0.72, 0, 0, 1);
  g.addColorStop(0, 'rgba(12, 14, 22, 0)');
  g.addColorStop(1, 'rgba(12, 14, 22, 0.32)');
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

// --- Il Sole ----------------------------------------------------------
// Non è un disco bianco: è gas a cinquemila gradi, con la grana delle celle
// di convezione, le facole più chiare verso il bordo e — quasi sempre —
// qualche macchia. E soprattutto è più scuro sull'orlo che al centro,
// perché lì lo sguardo attraversa gli strati alti e più freddi.
function skyDipingiSole(ctx) {
  const caso = skyCaso(skySeme('sole'));
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.clip();

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, '#fffef8');
  g.addColorStop(0.55, '#fff7dd');
  g.addColorStop(0.85, '#ffe3a4');
  g.addColorStop(1, '#f8a83e');
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);

  // La granulazione: un milione di celle di gas che salgono e ricadono. Vista
  // da qui è una grana finissima, appena percepibile — non una schiuma.
  for (let i = 0; i < 700; i++) {
    const lon = caso() * 360 - 180;
    const lat = Math.asin(caso() * 2 - 1) * SKY_R2D;
    const chiara = caso() > 0.45;
    skyMacchiaSfera(ctx, lon, lat, 0.012 + caso() * 0.018, (c, r) => {
      skyNuvola(c, r, chiara ? '#fffdf0' : '#f3c469', 0.09, 0.15);
    });
  }

  // Le facole: reticoli più chiari, visibili soprattutto verso l'orlo
  for (let i = 0; i < 22; i++) {
    const lon = (caso() > 0.5 ? 1 : -1) * (52 + caso() * 30);
    const lat = caso() * 90 - 45;
    skyMacchiaSfera(ctx, lon, lat, 0.05 + caso() * 0.08, (c, r) => {
      skyNuvola(c, r, '#fffef2', 0.22, 0.05);
    });
  }

  // Le macchie: un nocciolo scuro dentro una penombra più chiara. Stanno
  // sempre in due fasce attorno all'equatore, mai ai poli — e sono piccole:
  // una macchia grande come la Terra, sul disco solare, è un puntino.
  [{ lon: -24, lat: 13, r: 0.028 }, { lon: 14, lat: -11, r: 0.020 },
   { lon: 41, lat: 9, r: 0.014 }, { lon: -8, lat: -14, r: 0.010 }].forEach(m => {
    skyMacchiaSfera(ctx, m.lon, m.lat, m.r, (c, r) => {
      c.save();
      c.scale(1, 0.8);
      skyNuvola(c, r * 2.2, '#c98a35', 0.4, 0.45);
      c.beginPath();
      c.arc(0, 0, r * 0.8, 0, Math.PI * 2);
      c.fillStyle = 'rgba(92, 58, 22, 0.7)';
      c.fill();
      c.restore();
    });
  });
  ctx.restore();
}

// --- La corona --------------------------------------------------------
// Si vede solo quando la Luna copre esattamente il disco: è il momento per
// cui la gente attraversa gli oceani. La tela è più larga del Sole (tre
// raggi e mezzo) perché i pennacchi equatoriali arrivano lontano, mentre
// ai poli la corona fa ciuffi corti e dritti, come limatura di ferro su
// una calamita — che è esattamente quello che è: gas che segue il campo
// magnetico.
const SKY_CORONA_RAGGI = 3.4;

function skyDipingiCorona(ctx) {
  const caso = skyCaso(skySeme('corona'));
  const s = 1 / SKY_CORONA_RAGGI;           // dove finisce il disco del Sole
  ctx.globalCompositeOperation = 'lighter';

  // L'alone di fondo, che si spegne in fretta con la distanza: la corona
  // interna è mille volte più luminosa di quella esterna
  const g = ctx.createRadialGradient(0, 0, s * 0.92, 0, 0, 1);
  g.addColorStop(0, 'rgba(255, 253, 246, 0.55)');
  g.addColorStop(0.08, 'rgba(246, 247, 242, 0.16)');
  g.addColorStop(0.3, 'rgba(224, 233, 245, 0.05)');
  g.addColorStop(1, 'rgba(200, 216, 240, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();

  // I pennacchi: lame sottili che partono dall'orlo e si assottigliano fino
  // a sparire. Lunghe all'equatore, corte ai poli — è la forma che ha la
  // corona quando il Sole è tranquillo, e la si riconosce in ogni fotografia.
  for (let i = 0; i < 80; i++) {
    const a = caso() * Math.PI * 2;
    const equatoriale = Math.pow(Math.abs(Math.cos(a)), 1.4);
    const lungo = s + (1 - s) * (0.25 + 0.75 * equatoriale) * (0.55 + caso() * 0.7);
    const largo = (0.015 + caso() * 0.035) * (0.5 + equatoriale);
    ctx.save();
    ctx.rotate(a);
    const gr = ctx.createLinearGradient(s, 0, lungo, 0);
    gr.addColorStop(0, 'rgba(255, 252, 242, 0.085)');
    gr.addColorStop(0.35, 'rgba(250, 248, 238, 0.035)');
    gr.addColorStop(1, 'rgba(236, 242, 252, 0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(s * 0.97, -largo * 0.5);
    ctx.quadraticCurveTo(lungo * 0.6, -largo, lungo, 0);
    ctx.quadraticCurveTo(lungo * 0.6, largo, s * 0.97, largo * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // La cromosfera: il filo rosa che si accende un istante prima della
  // totalità, e le protuberanze che sporgono dall'orlo
  ctx.strokeStyle = 'rgba(255, 108, 74, 0.85)';
  ctx.lineWidth = s * 0.035;
  ctx.beginPath();
  ctx.arc(0, 0, s * 1.012, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const a = caso() * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(s, 0);
    skyNuvola(ctx, s * (0.08 + caso() * 0.16), '#ff5a4a', 0.75, 0.2);
    ctx.restore();
  }
}

// --- I pianeti --------------------------------------------------------

// Mercurio: una palla di roccia grigia coperta di crateri, senza aria e
// senza mari. Il grande bacino chiaro in alto a destra è Caloris.
function skyDipingiMercurio(ctx) {
  const caso = skyCaso(skySeme('mercurio'));
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#9b968e';
  ctx.fillRect(-1, -1, 2, 2);
  for (let i = 0; i < 90; i++) {
    const lon = caso() * 360 - 180;
    const lat = Math.asin(caso() * 2 - 1) * SKY_R2D;
    skyMacchiaSfera(ctx, lon, lat, 0.05 + caso() * 0.16, (c, r) => {
      skyNuvola(c, r, caso() > 0.5 ? '#b3ada3' : '#807b74', 0.22, 0.1);
    });
  }
  skyMacchiaSfera(ctx, 35, 30, 0.3, (c, r) => skyNuvola(c, r, '#c2bcb1', 0.5, 0.2));
  skyCrateriSfera(ctx, caso, 190, {
    min: 0.006, max: 0.055,
    fondo: 'rgba(88, 84, 78, 0.34)', orlo: 'rgba(206, 200, 190, 0.34)'
  });
  ctx.restore();
}

// Venere: non si vede il pianeta, si vede il tetto delle sue nuvole. Per
// questo è quasi senza dettagli — giallo pallido, uniforme, accecante.
function skyDipingiVenere(ctx) {
  const caso = skyCaso(skySeme('venere'));
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#efe3c0';
  ctx.fillRect(-1, -1, 2, 2);
  // Le fasce di nuvole, appena percettibili: nella luce visibile Venere è
  // quasi liscia, e fingere il contrario sarebbe un falso
  for (let i = 0; i < 22; i++) {
    const lat = caso() * 150 - 75;
    skyMacchiaSfera(ctx, caso() * 200 - 100, lat, 0.25 + caso() * 0.4, (c, r) => {
      c.save();
      c.scale(1, 0.32);
      skyNuvola(c, r, caso() > 0.45 ? '#fdf6df' : '#dcc99c', 0.3, 0.05);
      c.restore();
    });
  }
  skyMacchiaSfera(ctx, 0, 78, 0.5, (c, r) => skyNuvola(c, r, '#fffbea', 0.4, 0.1));
  ctx.restore();
}

// Marte: la ruggine, le regioni scure che i primi osservatori scambiarono
// per mari (la più vistosa è la Syrtis Major, il "triangolo") e le calotte
// polari di ghiaccio.
const SKY_MACCHIE_MARTE = [
  { lon: 70,  lat: 6,   r: 0.34, f: 0.85 },   // Syrtis Major
  { lon: -40, lat: 42,  r: 0.32, f: 0.45 },   // Acidalia Planitia
  { lon: -35, lat: -24, r: 0.32, f: 0.5  },   // Mare Erythraeum
  { lon: 110, lat: -22, r: 0.30, f: 0.5  },   // Mare Cimmerium
  { lon: 5,   lat: -8,  r: 0.22, f: 0.42 },   // Sinus Sabaeus
  { lon: 145, lat: 12,  r: 0.22, f: 0.35 }    // Elysium scuro
];

function skyDipingiMarte(ctx) {
  const caso = skyCaso(skySeme('marte'));
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#c1663a';
  ctx.fillRect(-1, -1, 2, 2);
  // Le zone chiare di polvere
  for (let i = 0; i < 14; i++) {
    skyMacchiaSfera(ctx, caso() * 360 - 180, caso() * 120 - 60, 0.2 + caso() * 0.3,
      (c, r) => skyNuvola(c, r, '#dd9660', 0.35, 0.1));
  }
  SKY_MACCHIE_MARTE.forEach(m => {
    skyMacchiaSfera(ctx, m.lon, m.lat, m.r, (c, r) => skyNuvola(c, r, '#6b4534', 0.8 * m.f, 0.35));
  });
  // Hellas, il bacino chiaro dell'emisfero sud
  skyMacchiaSfera(ctx, 70, -42, 0.22, (c, r) => skyNuvola(c, r, '#e9b184', 0.5, 0.2));
  // Le calotte di ghiaccio: piccole, perché stanno oltre i settanta gradi di
  // latitudine (e quella sud, d'estate, è la più vistosa)
  const calotta = (y, spessore, alpha) => {
    const g = ctx.createLinearGradient(0, y, 0, y + spessore);
    g.addColorStop(0, `rgba(250, 252, 255, ${alpha})`);
    g.addColorStop(0.6, `rgba(246, 250, 255, ${alpha * 0.55})`);
    g.addColorStop(1, 'rgba(250, 252, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(-1, Math.min(y, y + spessore), 2, Math.abs(spessore));
  };
  calotta(-1, 0.09, 0.8);
  calotta(1, -0.14, 0.9);
  ctx.restore();
}

// Giove: le bande. Le zone chiare sono nuvole alte di ammoniaca, le bande
// scure buchi in cui si vede più in basso. La Grande Macchia Rossa è una
// tempesta che gira da almeno trecento anni ed è larga come la Terra.
function skyDipingiGiove(ctx) {
  const caso = skyCaso(skySeme('giove'));
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#e7d8ba';
  ctx.fillRect(-1, -1, 2, 2);
  skyBandeSfera(ctx, [
    { a: 90,  b: 62,  c: '#a89880' },
    { a: 62,  b: 46,  c: '#c7b498' },
    { a: 46,  b: 34,  c: '#a98d6c' },
    { a: 34,  b: 22,  c: '#e6d7b8' },
    { a: 22,  b: 9,   c: '#ab7d55' },   // banda equatoriale nord
    { a: 9,   b: -8,  c: '#f1e5c9' },   // zona equatoriale
    { a: -8,  b: -21, c: '#a5744f' },   // banda equatoriale sud
    { a: -21, b: -34, c: '#e3d2b2' },
    { a: -34, b: -48, c: '#b59a7c' },
    { a: -48, b: -64, c: '#c9b79b' },
    { a: -64, b: -90, c: '#a39482' }
  ]);
  // Festoni e turbolenze dove due bande si sfregano
  for (let i = 0; i < 60; i++) {
    const lat = [20, 10, -7, -20, 34][Math.floor(caso() * 5)] + caso() * 6 - 3;
    skyMacchiaSfera(ctx, caso() * 360 - 180, lat, 0.06 + caso() * 0.12, (c, r) => {
      c.save();
      c.scale(1, 0.35);
      skyNuvola(c, r, caso() > 0.5 ? '#f6ecd6' : '#8b5f3e', 0.4, 0.1);
      c.restore();
    });
  }
  // La Grande Macchia Rossa
  skyMacchiaSfera(ctx, 22, -21, 0.24, (c, r) => {
    c.save();
    c.scale(1, 0.45);
    skyNuvola(c, r, '#c05a37', 0.85, 0.35);
    skyNuvola(c, r * 0.55, '#e07a4c', 0.6, 0.2);
    c.restore();
  });
  ctx.restore();
}

// Saturno: le stesse bande di Giove ma sbiadite, come viste attraverso un
// velo — perché è più freddo e più lontano dal Sole, e sopra le nuvole c'è
// una foschia che smorza tutto.
function skyDipingiSaturno(ctx) {
  const caso = skyCaso(skySeme('saturno'));
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#e3cfa4';
  ctx.fillRect(-1, -1, 2, 2);
  skyBandeSfera(ctx, [
    { a: 90,  b: 60,  c: '#b6a482', onda: 0.008 },
    { a: 60,  b: 40,  c: '#d8c49a', onda: 0.008 },
    { a: 40,  b: 22,  c: '#e9d7ac', onda: 0.008 },
    { a: 22,  b: 6,   c: '#d3bb8c', onda: 0.008 },
    { a: 6,   b: -12, c: '#f0e1b8', onda: 0.008 },
    { a: -12, b: -30, c: '#d9c496', onda: 0.008 },
    { a: -30, b: -52, c: '#c9b389', onda: 0.008 },
    { a: -52, b: -90, c: '#ab9a7d', onda: 0.008 }
  ]);
  for (let i = 0; i < 20; i++) {
    skyMacchiaSfera(ctx, caso() * 360 - 180, caso() * 100 - 50, 0.12 + caso() * 0.18, (c, r) => {
      c.save();
      c.scale(1, 0.3);
      skyNuvola(c, r, caso() > 0.5 ? '#f4e6c2' : '#c2a87e', 0.3, 0.1);
      c.restore();
    });
  }
  ctx.restore();
}

// Urano e Nettuno: metano nell'atmosfera, che si mangia il rosso e lascia
// passare l'azzurro. Urano è quasi liscio, Nettuno ha bande e tempeste.
function skyDipingiUrano(ctx) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createRadialGradient(-0.2, -0.2, 0.1, 0, 0, 1.2);
  g.addColorStop(0, '#c3f0f2');
  g.addColorStop(0.7, '#8fd8e0');
  g.addColorStop(1, '#5fb3c4');
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  skyBandeSfera(ctx, [
    { a: 40, b: 14, c: '#a7e2e8', alfa: 0.35, onda: 0.006 },
    { a: -14, b: -40, c: '#88cfda', alfa: 0.35, onda: 0.006 }
  ]);
  ctx.restore();
}

function skyDipingiNettuno(ctx) {
  const caso = skyCaso(skySeme('nettuno'));
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createRadialGradient(-0.2, -0.2, 0.1, 0, 0, 1.2);
  g.addColorStop(0, '#7aa8ec');
  g.addColorStop(0.65, '#4d7fd6');
  g.addColorStop(1, '#2f5bab');
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  skyBandeSfera(ctx, [
    { a: 46, b: 20, c: '#6f9de6', alfa: 0.45, onda: 0.008 },
    { a: -18, b: -44, c: '#3f6cc4', alfa: 0.45, onda: 0.008 }
  ]);
  skyMacchiaSfera(ctx, -25, -22, 0.22, (c, r) => {
    c.save();
    c.scale(1, 0.5);
    skyNuvola(c, r, '#1e3f80', 0.7, 0.3);
    c.restore();
  });
  for (let i = 0; i < 6; i++) {
    skyMacchiaSfera(ctx, caso() * 360 - 180, caso() * 80 - 40, 0.06 + caso() * 0.06,
      (c, r) => { c.save(); c.scale(1, 0.4); skyNuvola(c, r, '#e8f2ff', 0.4, 0.1); c.restore(); });
  }
  ctx.restore();
}

// Chi dipinge cosa. Gli astri che non stanno qui (le stelle, le stazioni
// spaziali) non hanno una faccia: sono punti, e restano punti.
const SKY_FACCE = {
  Sun: skyDipingiSole,
  Moon: skyDipingiLuna,
  Mercury: skyDipingiMercurio,
  Venus: skyDipingiVenere,
  Mars: skyDipingiMarte,
  Jupiter: skyDipingiGiove,
  Saturn: skyDipingiSaturno,
  Uranus: skyDipingiUrano,
  Neptune: skyDipingiNettuno
};

// La tela giusta per questo astro, alla taglia giusta. Torna null quando
// l'astro è troppo piccolo perché una faccia abbia senso: sotto gli otto
// pixel di raggio resta il dischetto sfumato di prima, che non costa niente
// — e che è anche più onesto, perché le bande di Giove disegnate su dieci
// pixel non sembrano Giove, sembrano una caramella a righe.
function skyFacciaDi(o, r) {
  if (r < 8 || !o || !SKY_FACCE[o.id]) return null;
  return skyPelle('faccia:' + o.id, skyLatoTela(r), SKY_FACCE[o.id]);
}

// --- Il cielo profondo -------------------------------------------------
// Una galassia non è un'ellisse vuota e una nebulosa non è un cerchietto
// tratteggiato: sono nuvole di luce senza bordi, e finché erano simboli non
// si capiva perché la gente passa la notte a guardarle. Ognuna si dipinge
// una volta sola, con il suo seme, e poi si ricopia grande quanto è grande
// davvero in cielo.
function skyPennelloProfondo(o) {
  const seme = skySeme('dso:' + o.nome);
  return function (ctx) {
    const caso = skyCaso(seme);
    ctx.globalCompositeOperation = 'lighter';
    if (o.tipo === 'galassia') {
      skyNuvola(ctx, 0.98, '#8fa6ff', 0.16, 0.02);
      skyNuvola(ctx, 0.7, '#c3cfff', 0.24, 0.05);
      // Due bracci a spirale, fatti di fiocchi sovrapposti e non di una riga:
      // in un binocolo si intravede una macchia ovale, non una fotografia, e
      // un tratto pieno si riconoscerebbe subito per quello che è
      for (let b = 0; b < 2; b++) {
        for (let t = 0.12; t < 1; t += 0.035) {
          const a = b * Math.PI + t * 3.0 + caso() * 0.12;
          const r = t * 0.72;
          ctx.save();
          ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
          skyNuvola(ctx, 0.09 + 0.11 * t, '#ccdaff', 0.085 * (1 - t * 0.45), 0.05);
          ctx.restore();
        }
      }
      skyNuvola(ctx, 0.26, '#ffeed2', 0.55, 0.03);
      skyNuvola(ctx, 0.12, '#fff8e8', 0.9, 0.02);
      for (let i = 0; i < 30; i++) {
        const a = caso() * Math.PI * 2, r = Math.pow(caso(), 0.6) * 0.7;
        skyStellina(ctx, Math.cos(a) * r, Math.sin(a) * r, 0.006, '#dbe6ff', 0.3);
      }
      // La banda di polvere che taglia il disco: nelle galassie di taglio è
      // la cosa che si vede meglio di tutte
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 14; i++) {
        const x = -0.8 + i * 0.12;
        ctx.save();
        ctx.translate(x, 0.2 + Math.abs(x) * 0.08);
        ctx.scale(1, 0.3);
        skyNuvola(ctx, 0.3, '#000000', 0.26, 0.02);
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'lighter';
    } else if (o.tipo === 'nebulosa') {
      // Fiocchi sovrapposti di idrogeno acceso, con dentro qualche vena più
      // fredda e le stelle appena nate che la illuminano da dentro
      for (let i = 0; i < 9; i++) {
        const a = caso() * Math.PI * 2, d = caso() * 0.42;
        ctx.save();
        ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
        ctx.rotate(caso() * Math.PI);
        ctx.scale(1, 0.5 + caso() * 0.5);
        skyNuvola(ctx, 0.34 + caso() * 0.42, caso() > 0.7 ? '#7fd7f0' : '#ff86a8', 0.16, 0.05);
        ctx.restore();
      }
      skyNuvola(ctx, 0.3, '#ffd9e4', 0.22, 0.05);
      for (let i = 0; i < 16; i++) {
        const a = caso() * Math.PI * 2, r = Math.pow(caso(), 0.7) * 0.62;
        skyStellina(ctx, Math.cos(a) * r, Math.sin(a) * r, 0.01, '#ecf4ff', 0.55);
      }
      // Le vene scure: polvere davanti alla nuvola. Si tolgono, non si
      // aggiungono — sono buchi nella luce.
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 5; i++) {
        const a = caso() * Math.PI * 2, d = caso() * 0.5;
        ctx.save();
        ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
        ctx.rotate(caso() * Math.PI);
        ctx.scale(1, 0.22 + caso() * 0.2);
        skyNuvola(ctx, 0.3 + caso() * 0.3, '#000000', 0.5, 0.05);
        ctx.restore();
      }
    } else if (o.tipo === 'planetaria') {
      // Un anello di fumo: il guscio di gas che una stella morente si è
      // sfilata di dosso, con la stella al centro
      const g = ctx.createRadialGradient(0, 0, 0.3, 0, 0, 0.75);
      g.addColorStop(0, 'rgba(120, 220, 190, 0)');
      g.addColorStop(0.45, 'rgba(134, 239, 172, 0.55)');
      g.addColorStop(0.8, 'rgba(96, 165, 250, 0.25)');
      g.addColorStop(1, 'rgba(96, 165, 250, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 0.78, 0, Math.PI * 2);
      ctx.fill();
      skyStellina(ctx, 0, 0, 0.02, '#ffffff', 0.5);
    } else if (o.tipo === 'globulare') {
      // Mezzo milione di stelle in una palla: densissime al centro,
      // sgranate ai bordi
      skyNuvola(ctx, 0.85, '#ffeec4', 0.2, 0.02);
      skyNuvola(ctx, 0.36, '#fff6de', 0.5, 0.05);
      for (let i = 0; i < 260; i++) {
        const a = caso() * Math.PI * 2;
        const r = Math.pow(caso(), 2.1) * 0.9;
        skyStellina(ctx, Math.cos(a) * r, Math.sin(a) * r, 0.006, '#fffaf0', 0.5);
      }
    } else {
      // Ammasso aperto: un pugno di stelle giovani, larghe e sparse
      skyNuvola(ctx, 0.9, '#bcd8ff', 0.08, 0.02);
      for (let i = 0; i < 80; i++) {
        const a = caso() * Math.PI * 2;
        const r = Math.pow(caso(), 0.75) * 0.92;
        const grande = caso() > 0.86;
        skyStellina(ctx, Math.cos(a) * r, Math.sin(a) * r,
          grande ? 0.018 : 0.008, grande ? '#dbeafe' : '#e8f0ff', grande ? 0.85 : 0.5);
      }
    }
  };
}

function skyFacciaProfondo(o, r) {
  return skyPelle('dso:' + o.nome, skyLatoTela(Math.min(r * 1.25, 150)), skyPennelloProfondo(o));
}

// --- Come si veste un astro sullo schermo ------------------------------

// Gli angoli che servono a orientare una faccia: da che parte gli arriva la
// luce del Sole (il lembo illuminato guarda sempre di là) e da che parte gli
// sta il nord del cielo, che è il verso in cui la faccia va ruotata perché
// i mari finiscano dove li vediamo davvero.
function skyOrientamento(o, v, base) {
  const schermo = (d) => Math.atan2(-skyDot(d, base.u), skyDot(d, base.r));
  const tangente = (w) => {
    const p = skyDot(w, v);
    return skyNormalizza([w[0] - p * v[0], w[1] - p * v[1], w[2] - p * v[2]]);
  };

  let luce = 0;
  const sole = sky.oggetti.find(x => x.id === 'Sun');
  if (sole && o.id !== 'Sun') luce = schermo(tangente(skyVettore(sole.az, sole.alt)));

  // Il polo celeste sta a nord, alto sull'orizzonte quanto la latitudine
  const lat = sky.observer ? sky.observer.latitude : 45;
  const polo = skyVettore(0, lat);
  const nord = tangente(polo);
  const est = skyNormalizza(skyCross(polo, v));
  return { luce, polo: schermo(nord), nord, est, schermo };
}

// La parte illuminata di una palla, come percorso da ritagliare. Il
// contesto dev'essere già ruotato in modo che il Sole stia verso destra.
// Il terminatore è un semicerchio schiacciato: con la falce (k < 0,5) si
// incurva verso il lato illuminato, con la gibbosa verso quello in ombra.
function skyPercorsoIlluminato(ctx, r, k) {
  const a = Math.abs(r * (1 - 2 * k));
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.ellipse(0, 0, a, r, 0, Math.PI / 2, -Math.PI / 2, k <= 0.5);
  ctx.closePath();
}

// ...e la parte in ombra, che è il resto del disco
function skyPercorsoOmbra(ctx, r, k) {
  const a = Math.abs(r * (1 - 2 * k));
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI / 2, -Math.PI / 2, false);
  ctx.ellipse(0, 0, a, r, 0, -Math.PI / 2, Math.PI / 2, k > 0.5);
  ctx.closePath();
}

// Di che colore è il lato in ombra di un astro: nero quando il cielo è
// nero, del colore del cielo quando il cielo è chiaro. È la luce diffusa
// dall'aria che sta *davanti* all'astro, e senza di lei la Luna del
// pomeriggio sembrerebbe una palla da biliardo appesa in cielo.
function skyColoreNotteAstro(o) {
  const aria = sky.ariaOra;
  const buio = [3, 5, 10];
  if (!aria) return 'rgb(3, 5, 10)';
  const cielo = skyColoreCielo(aria, Math.max(0, o.alt));
  const m = skyMescolaColore(buio, cielo, Math.min(1, sky.luceCielo * 1.15));
  return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
}

// L'ombreggiatura che fa sembrare tonda una palla: più chiara dalla parte
// del Sole, più scura dall'altra, con l'orlo che scappa via.
function skyRilievoSfera(ctx, r, angoloLuce, opzioni) {
  const o = opzioni || {};
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  const cx = Math.cos(angoloLuce) * r * 0.5, cy = Math.sin(angoloLuce) * r * 0.5;
  const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 1.9);
  g.addColorStop(0, `rgba(255, 252, 240, ${o.brillante == null ? 0.12 : o.brillante})`);
  g.addColorStop(0.4, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, `rgba(2, 4, 12, ${o.bordo == null ? 0.5 : o.bordo})`);
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

// Il globo di un mondo: la sua faccia, ritagliata sulla parte illuminata.
// Il punto è tutto lì — la parte non illuminata di un pianeta non è nera:
// non c'è. Dietro ci si vede il cielo, e con la falce di Venere in pieno
// giorno la differenza fra le due cose è tutta la differenza.
function skyDisegnaGlobo(ctx, r, o, ang, opzioni) {
  const k = Math.max(0, Math.min(1, typeof o.frazione === 'number' ? o.frazione : 1));
  ctx.save();

  // Prima però: il lato in ombra di un mondo non è un vetro. Di notte è nero
  // e copre le stelle che ci stanno dietro; di giorno sparisce, perché
  // l'aria fra noi e lui è piena di luce diffusa — ed è per questo che della
  // Luna del pomeriggio si vede solo la falce. Il quanto lo dice la
  // chiarezza del cielo: quello che si dipinge è il buio *che avanza*.
  // Basta un cielo mezzo chiaro perché il lato in ombra sparisca del tutto:
  // di giorno la Luna è una falce sospesa nell'azzurro, non una palla scura
  const trasparenza = Math.max(0, 1 - sky.luceCielo * 2);
  if (k < 0.985 && trasparenza > 0.015 && !sky.camera) {
    ctx.save();
    ctx.rotate(ang.luce);
    skyPercorsoOmbra(ctx, r, k);
    ctx.fillStyle = `rgba(3, 5, 10, ${trasparenza})`;
    ctx.fill();
    ctx.restore();
  }

  // E poi il morso: dove il lato in ombra passa davanti al disco del Sole
  // non c'è più niente da vedere attraverso, e lì il nero è pieno anche in
  // pieno giorno. Ritagliato sul Sole e non su tutta la Luna, se no durante
  // una parziale comparirebbe in cielo un disco azzurro grande come la Luna
  // — che non esiste: della Luna, davanti al Sole, si vede solo il morso.
  if (k < 0.985 && opzioni && opzioni.morso) {
    const m = opzioni.morso;
    ctx.save();
    ctx.beginPath();
    ctx.arc(m.dx, m.dy, m.r, 0, Math.PI * 2);
    ctx.clip();
    ctx.rotate(ang.luce);
    skyPercorsoOmbra(ctx, r, k);
    ctx.fillStyle = '#050608';
    ctx.fill();
    ctx.restore();
  }

  if (k < 0.985) {
    // Il ritaglio si costruisce nel verso del Sole e poi si torna indietro:
    // una volta preso, il ritaglio non segue più le rotazioni
    ctx.rotate(ang.luce);
    skyPercorsoIlluminato(ctx, r, k);
    ctx.clip();
    ctx.rotate(-ang.luce);
  }
  const faccia = skyFacciaDi(o, r);
  if (faccia) {
    ctx.save();
    ctx.rotate(ang.polo);
    ctx.drawImage(faccia, -r, -r, r * 2, r * 2);
    ctx.restore();
  } else if (opzioni && opzioni.ripiego) {
    opzioni.ripiego(ctx, r);
  }
  skyRilievoSfera(ctx, r, ang.luce, opzioni);
  // Il velo dell'aria bassa vale per il corpo, non per il cielo che gli sta
  // intorno: sta dentro al ritaglio della fase, se no attorno alla Luna
  // Nuova compariva un disco beige — l'aria "davanti" a un pezzo di mondo
  // che in quel momento non si vede.
  if (opzioni && typeof opzioni.estinzione === 'number') {
    skyVeloAtmosferico(ctx, r, opzioni.estinzione);
  }
  ctx.restore();
}

// L'aria bassa sull'orizzonte non rende gli astri trasparenti: li smorza e
// li arrossa, come fa con il Sole che tramonta. Prima era un'opacità, e la
// Luna bassa lasciava vedere le stelle attraverso.
function skyVeloAtmosferico(ctx, r, estinzione) {
  const quanto = 1 - Math.max(0, Math.min(1, estinzione));
  if (quanto < 0.02) return;
  // Moltiplicare, non sovrapporre: così ciò che è già scuro (la parte in
  // ombra, il morso dell'eclissi) resta scuro, e ciò che è chiaro si
  // arrossa. Sovrapponendo un velo arancione, un'eclissi bassa sull'orizzonte
  // diventava marrone anche dove non c'era niente di illuminato.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  const scuro = 1 - 0.22 * quanto;
  ctx.fillStyle = `rgb(${Math.round(255 * scuro)}, ${Math.round(255 * (1 - 0.42 * quanto) * scuro)}, ` +
    `${Math.round(255 * (1 - 0.78 * quanto) * scuro)})`;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

// --- L'orizzonte non è una riga dritta --------------------------------
// Il terreno era un poligono di colore piatto tagliato da una riga: giusto
// come geometria, ma nessuno ha davanti un orizzonte così. Da casa si vedono
// colline, una fila di alberi, il campanile del paese — ed è proprio quel
// profilo a decidere se un astro basso si vedrà davvero o no.
// Il profilo è inventato (la vera skyline di casa tua non la sa nessuno) ma
// sempre lo stesso: onde lunghe per le colline, macchie strette per gli
// alberi. Si calcola una volta sola, un grado per volta.
const SKY_PROFILO = (() => {
  const caso = skyCaso(skySeme('orizzonte'));
  const fasi = [];
  for (let i = 0; i < 6; i++) fasi.push(caso() * Math.PI * 2);
  // Macchie d'alberi: strette e alte. Ne bastano poche perché l'orizzonte
  // smetta di sembrare disegnato col righello.
  const alberi = [];
  for (let i = 0; i < 34; i++) {
    alberi.push({ az: caso() * 360, largo: 0.8 + caso() * 3.5, alto: 0.4 + caso() * 1.6 });
  }
  const p = new Float32Array(361);
  for (let i = 0; i < p.length; i++) {
    const a = i * SKY_D2R;
    let h = 1.05
      + 0.75 * Math.sin(a + fasi[0])
      + 0.45 * Math.sin(2 * a + fasi[1])
      + 0.26 * Math.sin(3 * a + fasi[2])
      + 0.14 * Math.sin(5 * a + fasi[3])
      + 0.08 * Math.sin(8 * a + fasi[4]);
    alberi.forEach(t => {
      const d = Math.abs(((i - t.az + 540) % 360) - 180);
      if (d < t.largo) h += t.alto * Math.pow(Math.cos(d / t.largo * Math.PI / 2), 2);
    });
    p[i] = Math.max(0.1, h);
  }
  p[360] = p[0];
  return p;
})();

function skyAltezzaOrizzonte(az) {
  const x = (((az % 360) + 360) % 360);
  const i = Math.floor(x);
  const t = x - i;
  return SKY_PROFILO[i] + (SKY_PROFILO[i + 1] - SKY_PROFILO[i]) * t;
}

// --- Come si disegna un punto luminoso -------------------------------
// Una stella non è un cerchio pieno: è un nocciolo piccolissimo con un alone
// che sfuma, e più è luminosa più l'alone si allarga. Sopra una certa
// luminosità l'occhio (e qualunque obiettivo) ci vede anche una croce.
function skyDisegnaPuntoStellare(ctx, x, y, r, colore, alpha, croce) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';

  const alone = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
  alone.addColorStop(0, colore);
  alone.addColorStop(0.22, skyColoreConAlpha(colore, 0.5));
  alone.addColorStop(1, skyColoreConAlpha(colore, 0));
  ctx.fillStyle = alone;
  ctx.beginPath();
  ctx.arc(x, y, r * 4.5, 0, Math.PI * 2);
  ctx.fill();

  if (croce) {
    const l = r * 4.4;
    ctx.globalAlpha = alpha * 0.34;
    ctx.strokeStyle = colore;
    ctx.lineWidth = Math.max(0.5, r * 0.18);
    ctx.beginPath();
    ctx.moveTo(x - l, y); ctx.lineTo(x + l, y);
    ctx.moveTo(x, y - l); ctx.lineTo(x, y + l);
    ctx.stroke();
  }

  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.7, r * 0.62), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Da "#rrggbb" a "rgba(r, g, b, a)": serve ai gradienti, che vogliono un
// colore trasparente allo stesso tono di quello pieno
function skyColoreConAlpha(esa, alpha) {
  const c = esa.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Un disco planetario: il bordo è appena più scuro del centro, come su una
// palla illuminata da lontano. Con pochi pixel non si vedrebbe nulla di più,
// e più di così sarebbe finto.
function skyDisegnaDiscoPianeta(ctx, x, y, r, colore) {
  const g = ctx.createRadialGradient(x - r * 0.28, y - r * 0.28, r * 0.1, x, y, r);
  g.addColorStop(0, skyMescolaEsa(colore, '#ffffff', 0.45));
  g.addColorStop(0.65, colore);
  g.addColorStop(1, skyMescolaEsa(colore, '#0b1020', 0.45));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function skyMescolaEsa(a, b, t) {
  const leggi = e => {
    const c = e.replace('#', '');
    const n = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const m = skyMescolaColore(leggi(a), leggi(b), t);
  return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
}

// Gli anelli di Saturno. Non sono un cerchietto attorno al disco: sono un
// piano di ghiaccio che passa dietro al globo da una parte e davanti
// dall'altra, con la Divisione di Cassini a tagliarlo in due e l'ombra del
// pianeta buttata sopra. Quanto sono aperti non lo si può inventare — nel
// 2025 erano di taglio e sparivano del tutto — quindi l'apertura arriva
// dall'asse vero di Saturno (vedi skyInclinazioneAnelli).
const SKY_ANELLI = [
  { da: 1.24, a: 1.52, colore: '#c9b48d', alpha: 0.30 },   // anello C, tenue
  { da: 1.52, a: 1.95, colore: '#efe0be', alpha: 0.92 },   // anello B, il più luminoso
  { da: 1.95, a: 2.03, colore: '#7a6a52', alpha: 0.18 },   // Divisione di Cassini
  { da: 2.03, a: 2.27, colore: '#dfcda6', alpha: 0.62 }    // anello A
];

function skyDisegnaAnelli(ctx, r, apertura, davanti) {
  const schiacciamento = Math.max(0.03, Math.abs(apertura));
  ctx.save();
  // Metà per volta: quella dietro si disegna prima del globo, quella davanti
  // dopo. Il taglio è la riga che passa per il centro del pianeta.
  ctx.beginPath();
  if (davanti === (apertura >= 0)) ctx.rect(-r * 3, 0, r * 6, r * 3);
  else ctx.rect(-r * 3, -r * 3, r * 6, r * 3);
  ctx.clip();
  SKY_ANELLI.forEach(a => {
    const raggio = r * (a.da + a.a) / 2;
    ctx.globalAlpha = a.alpha;
    ctx.strokeStyle = a.colore;
    ctx.lineWidth = Math.max(0.5, r * (a.a - a.da));
    ctx.beginPath();
    ctx.ellipse(0, 0, raggio, raggio * schiacciamento, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

// Riempie la parte di schermo sotto l'orizzonte, ci appoggia sopra il
// profilo delle colline e ne traccia la linea vera.
// In proiezione prospettica l'orizzonte è sempre una retta: la troviamo
// tagliando il rettangolo dello schermo con il piano orizzontale.
function skyDisegnaTerreno(ctx, base, focale, aria) {
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

  // I colori della terra. Di notte è quasi nera, di giorno è campagna; e in
  // tutti e due i casi la parte lontana — quella appena sotto l'orizzonte —
  // prende un po' del colore dell'aria, che è il modo in cui la distanza si
  // vede: le cose lontane sbiadiscono verso il colore del cielo.
  // Di notte la terra è quasi nera — più scura del cielo, sempre: è il
  // contrasto che disegna il profilo delle colline. Di giorno invece la
  // distanza la sbiadisce verso il colore dell'aria, e quello è il modo in
  // cui l'occhio misura quanto è lontana una collina.
  const vicino = skyMescolaColore([5, 8, 10], [38, 46, 32], sky.luceCielo);
  const lontanoBase = skyMescolaColore([10, 14, 18], [74, 84, 62], sky.luceCielo);
  const lontano = aria
    ? skyMescolaColore(lontanoBase, aria.foschia, 0.06 + 0.3 * sky.luceCielo)
    : lontanoBase;

  if (sotto.length >= 3) {
    // Dove cade l'orizzonte sullo schermo: da lì parte la sfumatura
    const bordi = sotto.filter(p => p.bordo);
    const y0 = bordi.length ? bordi.reduce((s, p) => s + p.y, 0) / bordi.length : 0;
    ctx.save();
    ctx.beginPath();
    sotto.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    const gr = ctx.createLinearGradient(0, y0, 0, Math.max(y0 + 40, H));
    gr.addColorStop(0, skyRgba(lontano, 0.98));
    gr.addColorStop(0.35, skyRgba(skyMescolaColore(lontano, vicino, 0.7), 0.99));
    gr.addColorStop(1, skyRgba(vicino, 1));
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.restore();
  }

  // Le colline e gli alberi, appoggiati sopra la linea. Sono dello stesso
  // colore del terreno che gli sta subito sotto — se no fra il profilo e il
  // suolo si vedeva una cucitura — e si staccano dal cielo per contrasto,
  // che è poi come si vede una collina all'imbrunire.
  skyDisegnaProfiloOrizzonte(ctx, base, focale, skyRgba(lontano, 1));

  if (sotto.length < 3) return;
  // La linea d'orizzonte vero resta, sotto al profilo: è il riferimento —
  // zero gradi di altezza — e serve a capire quanto le colline coprono
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < sotto.length; i++) {
    const a = sotto[i], b = sotto[(i + 1) % sotto.length];
    if (a.bordo && b.bordo) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
  }
  ctx.strokeStyle = sky.luceCielo > 0.4 ? '#e8f2ff' : '#5eb8e8';
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.3;
  ctx.stroke();
  ctx.restore();
}

// Il profilo delle colline. Si disegnano solo gli azimut che possono
// finire sullo schermo: fare tutto il giro costerebbe sei volte tanto e non
// si vedrebbe. Il conto di quanto giro serve viene dal raggio angolare
// dello schermo e da quanto in alto si sta guardando.
function skyDisegnaProfiloOrizzonte(ctx, base, focale, colore) {
  const L = sky.larghezza, H = sky.altezza;
  const semi = Math.atan2(Math.hypot(L, H) / 2, focale);
  const altF = Math.asin(Math.max(-1, Math.min(1, base.f[2])));
  const cosAlt = Math.cos(altF);
  if (cosAlt < 1e-4) return;
  const rapporto = Math.cos(semi) / cosAlt;
  if (rapporto >= 1) return;                 // l'orizzonte non è in vista
  const mezzo = Math.min(180, Math.acos(Math.max(-1, rapporto)) * SKY_R2D + 6);
  const centro = Math.atan2(base.f[0], base.f[1]) * SKY_R2D;
  const passo = mezzo > 60 ? 2 : 1;

  ctx.save();
  ctx.fillStyle = colore;
  let corsa = [];
  const chiudi = () => {
    if (corsa.length > 1) {
      ctx.beginPath();
      corsa.forEach((q, i) => (i === 0 ? ctx.moveTo(q.cx, q.cy) : ctx.lineTo(q.cx, q.cy)));
      for (let i = corsa.length - 1; i >= 0; i--) ctx.lineTo(corsa[i].bx, corsa[i].by);
      ctx.closePath();
      ctx.fill();
    }
    corsa = [];
  };
  for (let d = -mezzo; d <= mezzo + 0.001; d += passo) {
    const az = centro + d;
    const cresta = skyProietta(skyVettore(az, skyAltezzaOrizzonte(az)), base, focale);
    const piede = skyProietta(skyVettore(az, 0), base, focale);
    if (!cresta.davanti || !piede.davanti) { chiudi(); continue; }
    corsa.push({ cx: cresta.px, cy: cresta.py, bx: piede.px, by: piede.py });
  }
  chiudi();
  ctx.restore();
}

// Reticolo di riferimento: meridiani di azimut e paralleli di altezza
function skyDisegnaGriglia(ctx, base, focale) {
  ctx.save();
  // Su un cielo chiaro un reticolo scuro fa da gabbia: schiarisce e si smorza
  ctx.strokeStyle = sky.luceCielo > 0.4 ? '#f1f5f9' : '#334155';
  ctx.lineWidth = 1;
  ctx.globalAlpha = sky.luceCielo > 0.4 ? 0.22 : 0.5;
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
  // Su un cielo diurno le lettere chiare sparirebbero: cambiano tinta con la
  // luce, e sotto restano leggibili grazie a un'ombra morbida
  const giorno = sky.luceCielo > 0.45;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = giorno ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 4;
  punti.forEach(p => {
    const q = skyProietta(skyVettore(p.az, 0), base, focale);
    if (!q.davanti || q.px < -40 || q.px > sky.larghezza + 40) return;
    const principale = p.testo.length === 1;
    ctx.font = principale ? 'bold 16px system-ui, sans-serif' : '12px system-ui, sans-serif';
    if (p.testo === 'N') ctx.fillStyle = giorno ? '#b91c1c' : '#f87171';
    else if (principale) ctx.fillStyle = giorno ? '#0f172a' : '#e2e8f0';
    else ctx.fillStyle = giorno ? '#334155' : '#94a3b8';
    ctx.fillText(p.testo, q.px, q.py + 14);
  });
  ctx.restore();
}

// Disegna la Luna: la faccia vera (i mari dove stanno davvero), la fase —
// il lembo illuminato guarda sempre verso il Sole — la luce cinerea sul lato
// in ombra e, quando capita, l'ombra della Terra addosso.
function skyDisegnaLuna(ctx, x, y, r, o, ang, estinzione, morso) {
  const k = Math.max(0, Math.min(1, typeof o.frazione === 'number' ? o.frazione : 1));
  ctx.save();
  ctx.translate(x, y);

  // La luce cinerea: quando la falce è sottile, il lato buio non è nero — è
  // illuminato dalla Terra, che vista da lassù è quasi piena e quattro volte
  // più grande. La si vede solo di notte, e non mentre la Luna passa davanti
  // al Sole (lì attorno c'è la corona, e non si vedrebbe comunque).
  const eclissiInCorso = sky.eclisse && sky.eclisse.attiva;
  if (!eclissiInCorso && sky.luceCielo < 0.3 && k < 0.4 && k > 0.002) {
    ctx.save();
    ctx.rotate(ang.luce);
    skyPercorsoOmbra(ctx, r, k);
    ctx.clip();
    ctx.rotate(-ang.luce);
    const forza = 0.16 * (1 - k / 0.4);
    const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    g.addColorStop(0, `rgba(150, 168, 205, ${forza})`);
    g.addColorStop(1, `rgba(120, 140, 180, ${forza * 0.35})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // La faccia vera, orientata sul nord del cielo e non sul Sole: i mari
  // stanno fermi mentre la fase cambia, com'è giusto che sia
  skyDisegnaGlobo(ctx, r, o, ang, {
    brillante: 0.05,
    bordo: 0.4,
    morso,
    estinzione,
    ripiego: (c, raggio) => {
      c.beginPath();
      c.arc(0, 0, raggio, 0, Math.PI * 2);
      c.fillStyle = '#e9e6de';
      c.fill();
    }
  });

  // L'ombra della Terra, se ci siamo dentro (vedi skyOmbraDellaTerra)
  if (o.ombraTerra) skyDisegnaOmbraLunare(ctx, r, o, ang);
  ctx.restore();
}

// L'eclissi di Luna vista da vicino. L'ombra della Terra è un cerchio quasi
// tre volte più grande del disco lunare: sulla Luna si vede come un morso
// dal bordo curvo — fu quella curva a far capire agli antichi che la Terra
// è una palla. Dentro l'ombra la Luna non sparisce: diventa ramata, perché
// l'unica luce che le arriva è quella filtrata da tutti i tramonti del
// mondo insieme.
function skyDisegnaOmbraLunare(ctx, r, o, ang) {
  const s = o.ombraTerra;
  if (!s || !s.rL) return;
  // Dove sta il centro dell'ombra rispetto alla Luna, sullo schermo: la
  // direzione si costruisce dall'angolo di posizione (nord verso est)
  const c = Math.cos(s.pa), q = Math.sin(s.pa);
  const d = [
    ang.nord[0] * c + ang.est[0] * q,
    ang.nord[1] * c + ang.est[1] * q,
    ang.nord[2] * c + ang.est[2] * q
  ];
  const angolo = ang.schermo(d);
  const dist = (s.gamma / s.rL) * r;
  const cx = Math.cos(angolo) * dist, cy = Math.sin(angolo) * dist;

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalCompositeOperation = 'multiply';

  // La penombra: un velo grigio che si stringe verso l'ombra vera
  const rp = (s.penombra / s.rL) * r;
  const gp = ctx.createRadialGradient(cx, cy, rp * 0.25, cx, cy, rp);
  gp.addColorStop(0, 'rgba(120, 122, 130, 1)');
  gp.addColorStop(1, 'rgba(255, 255, 255, 1)');
  ctx.fillStyle = gp;
  ctx.fillRect(-r, -r, r * 2, r * 2);

  // L'ombra vera, ramata, con il bordo sfumato di un paio di centesimi
  const ru = (s.umbra / s.rL) * r;
  const gu = ctx.createRadialGradient(cx, cy, ru * 0.2, cx, cy, ru * 1.06);
  gu.addColorStop(0, 'rgba(150, 52, 30, 1)');
  gu.addColorStop(0.72, 'rgba(120, 46, 32, 1)');
  gu.addColorStop(0.95, 'rgba(96, 60, 62, 1)');
  gu.addColorStop(1, 'rgba(255, 255, 255, 1)');
  ctx.fillStyle = gu;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

// Un pianeta: la faccia vera se è abbastanza grande, la fase (Venere fa la
// falce come la Luna, ed è la cosa che stupisce di più al telescopio) e per
// Saturno gli anelli, metà dietro e metà davanti al globo.
function skyDisegnaPianeta(ctx, x, y, r, o, ang, estinzione) {
  ctx.save();
  ctx.translate(x, y);

  const anelli = o.id === 'Saturn' && r >= 3;
  const apertura = anelli ? skyAperturaAnelli(o) : 0;
  if (anelli) {
    ctx.save();
    ctx.rotate(ang.polo);
    skyDisegnaAnelli(ctx, r, apertura, false);
    ctx.restore();
  }

  skyDisegnaGlobo(ctx, r, o, ang, {
    brillante: 0.1,
    bordo: 0.5,
    estinzione,
    // Sotto i cinque pixel non c'è spazio per una faccia: resta il dischetto
    // sfumato, che però tiene lo stesso la fase — è la falce di Venere a
    // dire che è un mondo e non una stella
    ripiego: (c, raggio) => skyDisegnaDiscoPianeta(c, 0, 0, raggio, o.colore)
  });

  if (anelli) {
    ctx.save();
    ctx.rotate(ang.polo);
    skyDisegnaAnelli(ctx, r, apertura, true);
    ctx.restore();
  }
  ctx.restore();
}

// Il Sole: il disco pieno di granulazione, e — quando la Luna ci passa
// davanti — la corona. Era questo il buco più grosso del planetario: il
// Sole veniva disegnato sopra la Luna e per giunta semitrasparente, così
// durante un'eclissi non si vedeva né il morso né la corona. Adesso il Sole
// sta sotto (lo disegna prima, vedi l'ordine in skyDisegna), è opaco, e il
// suo bagliore si spegne man mano che la Luna lo copre — che è esattamente
// quello che succede al cielo attorno.
function skyDisegnaSole(ctx, x, y, r, o, estinzione) {
  const ecl = sky.eclisse;
  const coperto = ecl && ecl.attiva ? ecl.copertura : 0;
  ctx.save();
  ctx.translate(x, y);

  // La corona: si accende negli ultimi istanti prima della totalità, quando
  // la fotosfera è ormai tutta nascosta. In un'eclissi anulare non compare —
  // resta un anello di Sole acceso, e quello acceca comunque.
  if (ecl && ecl.attiva && ecl.rapporto >= 1 && coperto > 0.965) {
    const forza = Math.min(1, (coperto - 0.965) / 0.033);
    const tela = skyPelle('corona', skyLatoTela(r * SKY_CORONA_RAGGI), skyDipingiCorona);
    if (tela) {
      const R = r * SKY_CORONA_RAGGI;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = forza;
      ctx.drawImage(tela, -R, -R, R * 2, R * 2);
      ctx.restore();
    }
  }

  const faccia = skyFacciaDi(o, r);
  if (faccia) {
    ctx.drawImage(faccia, -r, -r, r * 2, r * 2);
  } else {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, '#fffef6');
    g.addColorStop(0.75, '#fff0c4');
    g.addColorStop(1, '#f9b451');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  skyVeloAtmosferico(ctx, r, estinzione);
  ctx.restore();
}

// --- Le eclissi di Sole viste da qui ----------------------------------
// Due dischi che si sovrappongono: il conto è tutto qui. Serve a tre cose —
// quanto disegnare grande la Luna (deve coprire il Sole come lo copre
// davvero), quando far comparire la corona, e di quanto scurire il cielo.
function skyRaggioAngolare(o) {
  if (!o || typeof o.diametroKm !== 'number') return 0;
  const km = typeof o.distanzaUA === 'number' && o.distanzaUA > 0
    ? o.distanzaUA * SKY_KM_PER_UA
    : (typeof o.distanzaKm === 'number' ? o.distanzaKm : 0);
  if (!km) return 0;
  return Math.atan((o.diametroKm / 2) / km) * SKY_R2D;
}

// Quanta parte del disco del Sole è coperta: è l'area comune a due cerchi
function skyCoperturaDischi(sep, rS, rL) {
  if (sep >= rS + rL) return 0;
  if (sep <= Math.abs(rL - rS)) return rL >= rS ? 1 : (rL * rL) / (rS * rS);
  const a1 = Math.acos((sep * sep + rS * rS - rL * rL) / (2 * sep * rS));
  const a2 = Math.acos((sep * sep + rL * rL - rS * rS) / (2 * sep * rL));
  const area = rS * rS * (a1 - Math.sin(2 * a1) / 2) + rL * rL * (a2 - Math.sin(2 * a2) / 2);
  return Math.max(0, Math.min(1, area / (Math.PI * rS * rS)));
}

function skyEclisseDiSole(sole, luna) {
  if (!sole || !luna) return null;
  const rS = skyRaggioAngolare(sole), rL = skyRaggioAngolare(luna);
  if (!rS || !rL) return null;
  const sep = skyAngoloFra(skyVettore(sole.az, sole.alt), skyVettore(luna.az, luna.alt));
  if (sep > rS + rL) return null;
  const copertura = skyCoperturaDischi(sep, rS, rL);
  return {
    attiva: copertura > 0.0004,
    copertura,
    sep,
    rapporto: rL / rS,
    totale: sep + rS <= rL,
    anulare: sep + rL <= rS
  };
}

// Il cielo durante un'eclissi. Non si spegne in proporzione a quanto Sole
// resta scoperto — l'occhio non funziona così: fino all'ottanta per cento
// non ci si accorge di niente, e poi negli ultimi minuti crolla tutto
// insieme e vengono fuori le stelle.
function skyAriaEclissata(aria, copertura) {
  if (!(copertura > 0.02)) return aria;
  const resta = Math.pow(Math.max(0, 1 - copertura), 0.35);
  const notte = SKY_TAPPE_CIELO[0];
  const verso = 1 - resta;
  return {
    zenit: skyMescolaColore(aria.zenit, notte.zenit, verso),
    orizzonte: skyMescolaColore(aria.orizzonte, notte.orizzonte, verso * 0.85),
    foschia: skyMescolaColore(aria.foschia, notte.foschia, verso * 0.8),
    luce: aria.luce * resta
  };
}

// Quanto sono aperti gli anelli di Saturno: è il seno della latitudine da
// cui li vediamo, e cambia con lentezza (nel 2025 erano di taglio, nel 2032
// saranno spalancati). Se la libreria non sa dirci dov'è l'asse del
// pianeta, si ripiega su un'apertura media.
function skyAperturaAnelli(o) {
  return typeof o.aperturaAnelli === 'number' ? o.aperturaAnelli : 0.32;
}

// Raggio in pixel con cui disegnare un astro. Sono due misure che convivono:
// · l'**icona**, fissa e generosa, perché a campo largo il Sole e la Luna
//   sarebbero due puntini di un pixel e mezzo, e lì conta trovarli;
// · il **disco vero**, calcolato dal diametro dell'astro e dalla sua
//   distanza in questo istante.
// Vince il più grande dei due. Guardando il cielo "a occhio" comanda sempre
// l'icona e non cambia niente; appena si stringe il campo — e adesso lo si
// può stringere fino a un quarto di grado — comanda il disco vero, e gli
// astri crescono come crescerebbero in un oculare.
function skyRaggio(o, focale) {
  return Math.max(skyRaggioIcona(o), skyRaggioVero(o, focale));
}

function skyRaggioIcona(o) {
  if (o.tipo === 'sole') return 15;
  if (o.tipo === 'luna') {
    // Durante un'eclissi di Sole la Luna non può avere una misura sua: deve
    // stare al Sole esattamente come ci sta in cielo, se no una totale
    // sembra parziale (o viceversa). Quindi prende l'icona del Sole
    // moltiplicata per il rapporto vero fra i due dischi — che è il numero
    // da cui dipende tutto, ed è il motivo per cui certe eclissi sono
    // anulari e certe altre no.
    if (sky.eclisse && sky.eclisse.attiva) return 15 * sky.eclisse.rapporto;
    return 14;
  }
  if (o.tipo === 'satellite') return 5;
  const mag = typeof o.mag === 'number' ? o.mag : 3;
  return Math.max(2.5, Math.min(11, 6 - mag * 0.9));
}

// Il raggio che l'astro occupa davvero sullo schermo: mezzo diametro diviso
// la distanza è l'angolo sotto cui lo vediamo, e la focale lo trasforma in
// pixel. Le stelle non hanno diametro apparente misurabile (Betelgeuse, la
// più grande del nostro cielo, sta sotto il centesimo di secondo d'arco) e
// le stazioni spaziali nemmeno: per loro resta l'icona.
function skyRaggioVero(o, focale) {
  if (!focale || typeof o.diametroKm !== 'number') return 0;
  const km = typeof o.distanzaUA === 'number' && o.distanzaUA > 0
    ? o.distanzaUA * SKY_KM_PER_UA
    : (typeof o.distanzaKm === 'number' ? o.distanzaKm : 0);
  if (!km) return 0;
  return focale * (o.diametroKm / 2) / km;
}

// Percorso della stazione spaziale nei minuti attorno all'istante mostrato:
// il tratteggio è la strada già fatta, la linea piena è dove sta andando.
function skyDisegnaScia(ctx, base, focale, o) {
  const punti = o.traccia.map(t => {
    const p = skyProietta(skyVettore(t.az, t.alt), base, focale);
    return { px: p.px, py: p.py, davanti: p.davanti, futuro: t.futuro };
  });

  ctx.save();
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 1; i < punti.length; i++) {
    const a = punti[i - 1], b = punti[i];
    if (!a.davanti || !b.davanti) continue;
    ctx.beginPath();
    ctx.setLineDash(b.futuro ? [] : [3, 4]);
    ctx.globalAlpha = b.futuro ? 0.75 : 0.35;
    ctx.strokeStyle = o.colore;
    ctx.moveTo(a.px, a.py);
    ctx.lineTo(b.px, b.py);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function skyDisegnaAstro(ctx, base, focale, o) {
  const v = skyVettore(o.az, o.alt);
  const p = skyProietta(v, base, focale);
  if (!p.davanti) return;

  const sottoOrizzonte = o.alt < 0;
  const r = skyRaggio(o, focale);
  // Saturno con gli anelli occupa più del suo disco: lo segnano il nome e il
  // cerchio dell'astro cercato
  let anelli = false;
  // Un astro ingrandito può avere il centro fuori dallo schermo e il disco
  // ancora dentro: il margine deve crescere con lui, se no la Luna sparisce
  // tutta insieme appena il suo centro esce dal bordo
  const margine = Math.max(60, r * 1.2);
  if (p.px < -margine || p.px > sky.larghezza + margine ||
      p.py < -margine || p.py > sky.altezza + margine) return;

  // Quanto si vede davvero: l'aria bassa smorza, e la luce del giorno
  // cancella. Sole, Luna e pianeti luminosi si vedono anche di giorno.
  const resiste = o.tipo === 'sole' || o.tipo === 'luna' ||
    (o.tipo === 'pianeta' && typeof o.mag === 'number' && o.mag < 0);
  const visibilita = skyEstinzione(o.alt) * (resiste ? 1 : Math.max(0.12, skyVelo()));
  if (!sottoOrizzonte && visibilita < 0.06) return;

  // La scia della stazione spaziale: tratteggiata dove è già passata,
  // continua dove sta andando nei prossimi minuti.
  if (o.tipo === 'satellite' && o.traccia) skyDisegnaScia(ctx, base, focale, o);

  // Le stelle hanno un disegno tutto loro: nocciolo, alone e croce di
  // diffrazione sulle più luminose
  if (o.tipo === 'stella' && !sottoOrizzonte) {
    skyDisegnaPuntoStellare(ctx, p.px, p.py, r, o.colore, visibilita,
      typeof o.mag === 'number' && o.mag < 1.2);
  }

  ctx.save();
  ctx.globalAlpha = sottoOrizzonte ? 0.3 : visibilita;

  if (!sottoOrizzonte && o.tipo !== 'stella') {
    // Alone luminoso: sul Sole è il bagliore che sbianca tutto, sulla Luna un
    // velo appena accennato (se no il disco spariva dentro al suo bagliore).
    // Ingrandendo, l'alone smette di crescere in proporzione e diventa una
    // fascia di larghezza fissa attorno al disco: sei volte un Sole grande
    // mezzo schermo sarebbe una macchia bianca su tutto il cielo.
    // E se la Luna sta coprendo il Sole, il bagliore se ne va con lui: è la
    // cosa che si nota per prima, molto prima che il cielo cambi colore.
    const largo = o.tipo === 'sole' ? Math.min(r * 6, r + 90)
      : (o.tipo === 'luna' ? Math.min(r * 2.2, r + 32) : Math.min(r * 3.2, r + 26));
    let scoperto = 1;
    if (o.tipo === 'sole' && sky.eclisse && sky.eclisse.attiva) {
      scoperto = Math.pow(1 - sky.eclisse.copertura, 0.6);
    } else if (o.tipo === 'luna') {
      // Il bagliore della Luna è la sua luce: una falce sottile non ne ha, e
      // la Luna Nuova nemmeno. Senza questo, durante un'eclissi parziale
      // restava in cielo un disco pallido grande come la Luna — l'alone di
      // un astro che in quel momento non sta illuminando niente.
      scoperto = Math.pow(Math.max(0, Math.min(1, typeof o.frazione === 'number' ? o.frazione : 1)), 0.7);
    }
    if (scoperto > 0.03) {
      ctx.save();
      ctx.globalAlpha *= scoperto;
      const alone = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, largo);
      alone.addColorStop(0, o.colore + (o.tipo === 'sole' ? 'cc' : (o.tipo === 'luna' ? '66' : 'aa')));
      alone.addColorStop(o.tipo === 'sole' ? 0.35 : 0.5, o.colore + (o.tipo === 'luna' ? '33' : '55'));
      alone.addColorStop(1, o.colore + '00');
      ctx.fillStyle = alone;
      ctx.beginPath();
      ctx.arc(p.px, p.py, largo, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Sole, Luna e pianeti non sono trasparenti: sono corpi solidi, e l'aria
  // bassa li smorza e li arrossa invece di lasciarci vedere attraverso (è
  // skyVeloAtmosferico a occuparsene, dentro al disco). L'opacità piena
  // vale solo per loro: le stelle e le stazioni restano punti di luce, e
  // per quelli sbiadire è giusto.
  const corposo = !sottoOrizzonte &&
    (o.tipo === 'sole' || o.tipo === 'luna' || (o.tipo === 'pianeta' && r >= 3));
  if (corposo) ctx.globalAlpha = o.tipo === 'pianeta' ? Math.max(visibilita, 0.75) : 1;

  if (sottoOrizzonte) {
    // Un puntino spento e nient'altro: il corpo vero (disco, anelli, fase)
    // lo disegniamo solo per ciò che sta davvero sopra l'orizzonte
    ctx.fillStyle = o.colore;
    ctx.beginPath();
    ctx.arc(p.px, p.py, Math.max(1.5, r * 0.5), 0, Math.PI * 2);
    ctx.fill();
  } else if (o.tipo === 'stella') {
    // Il nocciolo l'ha già disegnato skyDisegnaPuntoStellare
  } else if (o.tipo === 'satellite') {
    // Un rombo, per non confonderla con una stella: le stazioni si muovono
    ctx.beginPath();
    ctx.moveTo(p.px, p.py - r);
    ctx.lineTo(p.px + r, p.py);
    ctx.lineTo(p.px, p.py + r);
    ctx.lineTo(p.px - r, p.py);
    ctx.closePath();
    ctx.fillStyle = o.illuminato === false ? '#64748b' : o.colore;
    ctx.fill();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (o.tipo === 'luna') {
    // Da che parte arriva la luce (il lembo illuminato punta sempre di là) e
    // da che parte sta il nord del cielo (i mari si orientano su quello)
    // Se il Sole è lì dietro, alla Luna serve sapere dove sta e quanto è
    // grande sullo schermo: è il ritaglio del morso (vedi skyDisegnaGlobo)
    let morso = null;
    if (sky.eclisse && sky.eclisse.attiva) {
      const sole = sky.oggetti.find(x => x.id === 'Sun');
      if (sole) {
        const q = skyProietta(skyVettore(sole.az, sole.alt), base, focale);
        if (q.davanti) morso = { dx: q.px - p.px, dy: q.py - p.py, r: skyRaggio(sole, focale) };
      }
    }
    skyDisegnaLuna(ctx, p.px, p.py, r, o, skyOrientamento(o, v, base), skyEstinzione(o.alt), morso);
  } else if (o.tipo === 'sole') {
    skyDisegnaSole(ctx, p.px, p.py, r, o, skyEstinzione(o.alt));
  } else {
    // Pianeti: la faccia vera se c'è spazio, la fase, e per Saturno gli
    // anelli — metà dietro al globo e metà davanti.
    if (o.id === 'Saturn' && r >= 3) anelli = true;
    skyDisegnaPianeta(ctx, p.px, p.py, r, o, skyOrientamento(o, v, base), skyEstinzione(o.alt));
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
  if (sky.mostraNomi) {
    ctx.globalAlpha = sottoOrizzonte ? 0.45 : Math.max(0.12, 0.95 * visibilita);
    ctx.font = (o.id === sky.target ? 'bold ' : '') + '12px system-ui, sans-serif';
    ctx.fillStyle = o.id === sky.target ? '#93c5fd' : '#e2e8f0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const etichettaAstro = o.tipo === 'satellite' && o.illuminato === false
      ? `${o.nome} (nell'ombra)`
      : o.nome;
    // Il nome sta appena fuori dal disco, ma non lo segue all'infinito: su
    // una Luna ingrandita finirebbe fuori dallo schermo. Quando gli finisce
    // sopra — e la Luna da vicino è bianca — a salvarlo è il contorno scuro.
    // Con gli anelli l'ingombro di Saturno è più del doppio del suo disco:
    // il nome deve stare fuori da quelli, non dal globo
    const x = p.px + Math.min((anelli ? r * 2.3 : r) + 6, 46);
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(2, 6, 16, 0.75)';
    ctx.strokeText(etichettaAstro, x, p.py);
    ctx.fillText(etichettaAstro, x, p.py);
  }

  // Cerchio di conferma sull'astro cercato
  if (o.id === sky.target) {
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(p.px, p.py, (anelli ? r * 2.3 : r) + 12, 0, Math.PI * 2);
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
  // Il margine da tenere dipende da quanto è lunga la scritta: con un
  // margine fisso "(sotto l'orizzonte)" finiva mezzo fuori dallo schermo
  const meta = ctx.measureText(etichetta).width / 2 + 10;
  const dy = y < H / 2 ? 26 : -26;
  ctx.fillText(etichetta, Math.max(meta, Math.min(L - meta, x)), y + dy);
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

// Cosa finisce davvero sulla mappa. I filtri lavorano per categoria, così
// "voglio solo i pianeti" o "togli di mezzo ciò che è già tramontato" sono
// un tocco, non una lettura di venti etichette sovrapposte.
function skyOggettiDaDisegnare() {
  return sky.oggetti.filter(o => {
    if (!sky.mostraSottoOrizzonte && o.alt < 0) return false;
    if (o.tipo === 'pianeta') return sky.mostraPianeti;
    if (o.tipo === 'sole' || o.tipo === 'luna') return sky.mostraSoleLuna;
    if (o.tipo === 'stella') return sky.mostraStelle;
    if (o.tipo === 'satellite') return sky.mostraSatelliti;
    return true;
  });
}

// Il cerchio sull'oggetto di cui è aperta la scheda. Gli astri dell'elenco
// hanno già il loro (lo disegna skyDisegnaAstro); questo serve a tutto il
// resto, che sulla mappa è solo un simbolo fra tanti.
function skyDisegnaEvidenza(ctx, base, focale) {
  const e = sky.evidenza;
  if (!e || typeof e.az !== 'number') return;
  const p = skyProietta(skyVettore(e.az, e.alt), base, focale);
  if (!p.davanti) return;

  ctx.save();
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.px, p.py, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function skyDisegna() {
  if (!sky.ctx) return;
  const ctx = sky.ctx;
  const L = sky.larghezza, H = sky.altezza;

  // Con la fotocamera accesa il campo del disegno lo detta l'obiettivo, non
  // la preferenza dell'utente: si ricontrolla qui perché il video parte dopo
  // e il riquadro cambia con lo schermo intero e con la rotazione.
  skySincronizzaCampoFotocamera();

  const base = skyBase();
  const focale = skyFocale();
  // La proiezione appena usata resta a disposizione: serve a capire cosa c'è
  // sotto al dito quando si tocca la mappa, senza ricostruirla (e senza
  // disturbare il filtro anti-tremolio, che è un filtro con memoria).
  sky.ultimaBase = base;
  sky.ultimaFocale = focale;

  // Che cielo c'è a quest'ora: lo decide l'altezza del Sole. Da qui vengono
  // il colore del fondo, la foschia bassa, il terreno e quante stelle si
  // vedono — di giorno nessuna.
  const sole = sky.oggetti.find(o => o.id === 'Sun');
  const luna = sky.oggetti.find(o => o.id === 'Moon');
  // C'è un'eclissi di Sole in corso? Si guarda una volta per fotogramma,
  // perché la risposta serve a mezzo disegno: quanto grande fare la Luna,
  // se accendere la corona, quanto spegnere il bagliore e il cielo.
  sky.eclisse = skyEclisseDiSole(sole, luna);
  let aria = skyAria(sole ? sole.alt : -30);
  if (sky.eclisse && sky.eclisse.attiva) aria = skyAriaEclissata(aria, sky.eclisse.copertura);
  sky.luceCielo = aria.luce;
  // L'aria di questo istante resta a disposizione di chi disegna: serve a
  // sapere di che colore è il cielo dietro (e davanti) a un astro
  sky.ariaOra = aria;

  // Con la fotocamera accesa il canvas resta trasparente: sotto si vede
  // il mondo vero e sopra ci finiscono solo gli astri calcolati.
  const conCamera = !!sky.camera;
  if (conCamera) {
    ctx.clearRect(0, 0, L, H);
  } else {
    skyDisegnaSfondo(ctx, base, focale, aria);
    skyDisegnaAloneSole(ctx, base, focale, sole, aria);
    skyDisegnaAloneLuna(ctx, base, focale, luna);
    if (sky.mostraViaLattea) skyDisegnaViaLattea(ctx, base, focale);
  }

  if (sky.mostraGriglia) skyDisegnaGriglia(ctx, base, focale);
  if (!conCamera) skyDisegnaTerreno(ctx, base, focale, aria);
  skyDisegnaCardinali(ctx, base, focale);
  skyDisegnaCostellazioni(ctx, base, focale);
  skyDisegnaProfondo(ctx, base, focale);

  // Il binario del Sistema Solare: sotto a tutto il resto, perché è lo
  // sfondo su cui si leggono i pianeti, non uno degli attori
  skyCalcolaEclittica();
  skyDisegnaEclittica(ctx, base, focale);

  // La strada dell'oggetto scelto nelle ore attorno a questo istante: sta
  // sotto agli astri, perché è una guida e non deve coprirli
  skyCalcolaTraccia();
  skyDisegnaTraccia(ctx, base, focale);

  // Prima le stelle, poi i pianeti, poi il Sole, poi la Luna, infine le
  // stazioni spaziali (che si muovono e devono restare sempre riconoscibili
  // sopra il resto). L'ordine fra Sole e Luna non è un dettaglio: la Luna
  // passa **davanti** al Sole, e finché il Sole veniva disegnato per ultimo
  // un'eclissi non si vedeva affatto — la Luna gli finiva sotto.
  const ordine = { stella: 0, pianeta: 1, sole: 2, luna: 3, satellite: 4 };
  const daDisegnare = skyOggettiDaDisegnare();
  daDisegnare
    .slice()
    .sort((a, b) => (ordine[a.tipo] || 0) - (ordine[b.tipo] || 0))
    .forEach(o => skyDisegnaAstro(ctx, base, focale, o));

  // Gli eventi in corso all'ora mostrata: il radiante di uno sciame, l'anello
  // attorno all'astro eclissato. Sopra agli astri, sotto alle guide.
  skyDisegnaEventi(ctx, base, focale);

  // La freccia che dice da che parte è finito l'astro scelto. Vale anche per
  // una galassia presa dall'elenco: quella non sta fra gli astri disegnati
  // qui, ma un azimut e un'altezza ce li ha come tutti gli altri.
  const bersaglio = daDisegnare.find(o => o.id === sky.target) ||
    (sky.target ? skyVoceDiId(sky.target) : null);
  if (bersaglio && typeof bersaglio.az === 'number') skyDisegnaGuida(ctx, base, focale, bersaglio);

  // Cerchio attorno all'oggetto di cui è aperta la scheda, quando non è un
  // astro dell'elenco (una galassia, una stella di una figura): senza questo
  // non si saprebbe quale dei tanti puntini si è toccato
  skyDisegnaEvidenza(ctx, base, focale);

  // Il mirino del polo celeste, per chi deve allineare una montatura
  // equatoriale: lo disegna il modulo Telescopio, se è acceso.
  if (typeof telDisegnaPoloSuCielo === 'function') telDisegnaPoloSuCielo(ctx, base, focale);

  skyDisegnaMirino(ctx);

  // Se manca la posizione non c'è nulla da calcolare: spieghiamo il perché
  if (!sky.observer) {
    ctx.save();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Serve la tua posizione: “Aggiorna posizione” qui sotto, o scegli la città.', L / 2, H / 2 + 40);
    ctx.restore();
  }

  skyAggiornaHud(base);

  // Se si sta registrando, questo fotogramma finisce anche nel filmato: il
  // montaggio si fa qui, appena il cielo è finito (vedi 7.6)
  if (sky.reg.attiva) skyRegAcquisisci();
}

// Il campo visivo, detto nell'unità in cui si legge: sotto i due gradi i
// gradi interi non bastano più (fra 1° e 0,25° direbbero sempre "0°")
function skyCampoTesto() {
  return sky.fov >= 2 ? `${Math.round(sky.fov)}°` : skyAngoloApparente(sky.fov);
}

// Azimut e altezza verso cui punta il telefono, mostrati in alto a sinistra
function skyAggiornaHud(base) {
  const hud = document.getElementById('skymap-hud');
  if (!hud) return;
  const f = base.f;
  const alt = Math.asin(Math.max(-1, Math.min(1, f[2]))) * SKY_R2D;
  const az = ((Math.atan2(f[0], f[1]) * SKY_R2D) % 360 + 360) % 360;
  const stretta = sky.larghezza && sky.larghezza < 560;
  const testo = `${skyNomeDirezione(az)} ${Math.round(az) % 360}° · alt ${alt.toFixed(0)}°` +
    (stretta ? '' : ` · campo ${skyCampoTesto()}${skyCampoDaObiettivo() ? ' (obiettivo)' : ''}`);
  // Riscrivere il testo sessanta volte al secondo costa e non serve: quasi
  // sempre è identico a quello di prima.
  if (hud.textContent !== testo) hud.textContent = testo;
}

// Avvisi sotto al cielo, uno per argomento (posizione, sensori):
// passare un testo vuoto cancella quel solo avviso. Con `durataMs` l'avviso
// se ne va da sé: certi messaggi sono risposte a un tocco ("è da quella
// parte"), e lasciarli lì per sempre li trasforma in rumore.
function skyAvviso(chiave, testo, durataMs) {
  sky.avvisi[chiave] = testo || '';
  clearTimeout(sky.scadenzaAvvisi[chiave]);
  if (testo && durataMs) {
    sky.scadenzaAvvisi[chiave] = setTimeout(() => skyAvviso(chiave, ''), durataMs);
  }
  const el = document.getElementById('skymap-avviso');
  if (!el) return;
  const completo = Object.keys(sky.avvisi).map(k => sky.avvisi[k]).filter(Boolean).join(' ');
  el.textContent = completo;
  el.classList.toggle('hidden', !completo);
}

// Accende o spegne un tasto del planetario. Lo stato è una classe sola
// (`attiva`) più aria-pressed: chi lo cambia non deve conoscere la grafica,
// che sta tutta nel foglio di stile, e il testo si può cambiare insieme.
function skyTasto(id, attiva, testo) {
  const b = document.getElementById(id);
  if (!b) return;
  b.classList.toggle('attiva', !!attiva);
  b.setAttribute('aria-pressed', attiva ? 'true' : 'false');
  if (testo) b.textContent = testo;
}

function skyAggiornaStato() {
  const el = document.getElementById('skymap-stato');
  if (!el) return;
  const righe = [];
  // Un cielo che non è quello di casa tua deve dirlo prima di ogni altra
  // cosa, sempre, e non solo nel pannello che l'ha deciso: chi torna sulla
  // mappa dieci minuti dopo non si ricorda di averlo spostato.
  if (sky.luogoVista) {
    const nome = sky.luogoVista.nome || formattaCoordinate(sky.luogoVista.lat, sky.luogoVista.lon);
    righe.push(`cielo visto da ${nome} · solo qui`);
  }
  if (sky.posizione) {
    // Dire quanto è larga la lettura evita di dare per buono un fix di rete
    // scambiandolo per GPS: è la prima cosa da guardare se il cielo non torna.
    const p = sky.posizione.precisione;
    const quanto = p ? ` ${precisioneTesto(p)}` : '';
    const et = POS_ETICHETTE[sky.posizione.origine || sky.posizione.fonte];
    righe.push(`${formattaCoordinate(sky.posizione.lat, sky.posizione.lon)}${quanto}` +
      (et ? ` · ${et.breve}` : ''));
  } else {
    righe.push('posizione mancante');
  }
  if (!sky.seguiTelefono && sky.sensori) {
    righe.push('vista sganciata: la muovi col dito');
  } else if (sky.sensori) {
    if (sky.assoluto) {
      const d = sky.declinazione;
      righe.push(Math.abs(d) >= 0.05
        ? `Nord vero (declinazione ${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}°)`
        : 'Nord vero');
    } else {
      righe.push('bussola relativa: da calibrare');
    }
  } else {
    righe.push('modalità manuale');
  }
  el.innerHTML = righe.join('<br>');
}

// =====================================================================
// 7.3-bis LA TRACCIA DELL'OGGETTO OSSERVATO
//   Un planetario dice dov'è un astro adesso. Ma chi passa una serata al
//   telescopio ha bisogno di un'altra cosa: sapere che strada farà quell'astro
//   mentre lo guarda. Se fra un'ora sarà dietro il tetto del vicino, tanto
//   vale saperlo prima di montare la montatura; e se sta ancora salendo,
//   conviene aspettare, perché più è alto e meno aria c'è da attraversare.
//   Qui si disegna proprio quella strada: la curva che l'oggetto scelto
//   percorre nelle ore attorno all'istante mostrato, tratteggiata dove è già
//   passato e piena dove sta andando, con l'ora segnata di sessanta in
//   sessanta minuti. È la stessa idea della scia della stazione spaziale
//   (che però corre in minuti, non in ore, e la sua la calcola l'SGP4).
// =====================================================================

const SKY_TRACCIA_ORE = 4;          // quanto indietro e quanto avanti
const SKY_TRACCIA_PASSO_MIN = 10;   // un campione ogni dieci minuti
const SKY_TRACCIA_RINFRESCO_MS = 400;  // non più spesso di così, playback compreso

// Di che cosa si disegna la traccia: l'oggetto scelto adesso, se è un astro
// che la libreria sa calcolare o un punto fisso di cui conosciamo le
// coordinate (una galassia, una stella di una figura). Le stazioni spaziali
// no: hanno già la loro scia dei minuti, e in quattro ore fanno tre giri.
function skyOggettoDaTracciare() {
  const o = skyOggettoScelto();
  if (!o || o.tipo === 'satellite') return null;
  const idCorpo = o.id && SKY_ASTRI.some(a => a.id === o.id) ? o.id : null;
  if (!idCorpo && (typeof o.ra !== 'number' || typeof o.dec !== 'number')) return null;
  return { idCorpo, ra: o.ra, dec: o.dec, nome: o.nome || 'oggetto', colore: o.colore || '#93c5fd' };
}

// Ricalcola la traccia solo quando serve: cambiare oggetto, spostare
// l'orologio di qualche minuto o cambiare posizione. Sono un'ottantina di
// conversioni di coordinate — poco per una volta, troppo per ogni fotogramma.
function skyCalcolaTraccia() {
  if (!sky.mostraTraccia || !sky.observer || typeof Astronomy === 'undefined') {
    sky.traccia.punti = [];
    sky.traccia.chiave = null;
    return;
  }
  const o = skyOggettoDaTracciare();
  if (!o) {
    sky.traccia.punti = [];
    sky.traccia.chiave = null;
    return;
  }

  const quando = skyAdesso().getTime();
  const passoMs = SKY_TRACCIA_PASSO_MIN * 60000;
  // I campioni si prendono sulla griglia dei dieci minuti, non a partire
  // dall'istante mostrato: così uno di essi cade sempre sull'ora tonda, che è
  // il punto su cui va scritto l'orario.
  const t0 = Math.round(quando / passoMs) * passoMs;
  const chiave = [o.idCorpo || `${o.ra},${o.dec}`, t0,
    Math.round(sky.observer.latitude * 100), Math.round(sky.observer.longitude * 100)].join('|');
  if (sky.traccia.chiave === chiave) return;
  const adesso = performance.now();
  if (adesso < sky.traccia.prossimo) return;
  sky.traccia.prossimo = adesso + SKY_TRACCIA_RINFRESCO_MS;
  sky.traccia.chiave = chiave;

  const punti = [];
  const passi = Math.round(SKY_TRACCIA_ORE * 60 / SKY_TRACCIA_PASSO_MIN);
  for (let i = -passi; i <= passi; i++) {
    const t = new Date(t0 + i * passoMs);
    let p = null;
    try {
      p = o.idCorpo
        ? altAzCorpo(o.idCorpo, t, sky.observer)
        : altAzCoordinate(o.ra, o.dec, t, sky.observer);
    } catch (e) { p = null; }
    if (!p) continue;
    punti.push({
      az: p.az, alt: p.alt,
      futuro: t.getTime() >= quando,
      // Le ore tonde diventano i paletti chilometrici della traccia
      ora: t.getMinutes() === 0 ? t.getHours() : null
    });
  }

  sky.traccia.punti = punti;
  sky.traccia.nome = o.nome;
  sky.traccia.colore = o.colore;
}

// Disegna la traccia sotto agli astri: è una guida, non un protagonista.
function skyDisegnaTraccia(ctx, base, focale) {
  if (!sky.mostraTraccia) return;
  const punti = sky.traccia.punti;
  if (!punti || punti.length < 2) return;

  const colore = sky.traccia.colore || '#93c5fd';
  const proiettati = punti.map(t => {
    const p = skyProietta(skyVettore(t.az, t.alt), base, focale);
    return { px: p.px, py: p.py, davanti: p.davanti, futuro: t.futuro, ora: t.ora, alt: t.alt };
  });

  ctx.save();
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = colore;

  for (let i = 1; i < proiettati.length; i++) {
    const a = proiettati[i - 1], b = proiettati[i];
    if (!a.davanti || !b.davanti) continue;
    // Vicino al bordo della proiezione due campioni contigui possono finire
    // ai due capi dello schermo: un segmento così è una riga falsa
    if (Math.abs(a.px - b.px) > sky.larghezza || Math.abs(a.py - b.py) > sky.altezza) continue;
    const sotto = a.alt < 0 || b.alt < 0;
    ctx.setLineDash(b.futuro ? [] : [4, 5]);
    ctx.globalAlpha = (b.futuro ? 0.75 : 0.4) * (sotto ? 0.45 : 1);
    ctx.beginPath();
    ctx.moveTo(a.px, a.py);
    ctx.lineTo(b.px, b.py);
    ctx.stroke();
  }

  // I paletti dell'ora: un puntino e, se c'è spazio, l'orario accanto
  ctx.setLineDash([]);
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  proiettati.forEach(p => {
    if (p.ora === null || !p.davanti) return;
    if (p.px < 0 || p.px > sky.larghezza || p.py < 0 || p.py > sky.altezza) return;
    ctx.globalAlpha = p.alt < 0 ? 0.35 : 0.85;
    ctx.fillStyle = colore;
    ctx.beginPath();
    ctx.arc(p.px, p.py, 2.6, 0, Math.PI * 2);
    ctx.fill();
    if (sky.mostraNomi) {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`${p.ora}`, p.px + 6, p.py - 6);
    }
  });

  ctx.restore();
}

// =====================================================================
// 7.3-ter L'ECLITTICA
//   Chi guarda la traccia del Sole per la prima volta pensa: «questa è
//   l'eclittica». Non lo è, ed è una confusione che vale la pena sciogliere
//   proprio qui. La traccia del Sole nelle ore attorno a stasera è l'arco
//   che gli fa fare la rotazione della Terra: un cerchio quasi parallelo
//   all'equatore celeste, che a giugno passa alto e a dicembre raso.
//   L'eclittica invece è la strada che il Sole percorre in un ANNO fra le
//   stelle: un cerchio massimo inclinato di 23,4° sull'equatore, che nel
//   cielo di un istante preciso sta lì tutto intero, dall'orizzonte da cui
//   sale a quello in cui scende, anche di notte quando il Sole è dall'altra
//   parte della Terra.
//
//   È quel cerchio che serve per capire il Sistema Solare: i pianeti si
//   muovono quasi nello stesso piano della Terra, e perciò da qui li vediamo
//   sempre appoggiati a questa linea, mai più di qualche grado sopra o
//   sotto. Finché resta una frase in una scheda («Marte è 1,8° sotto
//   l'eclittica») è un numero; con la linea disegnata diventa un fatto che
//   si vede — e si vede anche perché la Luna, che di gradi ne prende fino a
//   cinque, non ci eclissa il Sole tutti i mesi.
//
//   Perciò questo non è un tasto che "lascia la traccia del Sole sullo
//   schermo": è il cerchio vero, disegnato con i marcatori dei mesi (dove
//   sarà il Sole il primo di ogni mese) e, se un oggetto è selezionato, con
//   il filo a piombo che lo unisce alla linea e ne misura lo scarto.
// =====================================================================

const SKY_ECL_PASSO_GRADI = 3;      // un campione ogni tre gradi di longitudine
const SKY_ECL_RINFRESCO_MS = 400;   // come la traccia: mai più spesso di così
const SKY_ECL_ARROTONDA_MS = 60000; // un minuto di cielo = 0,25° di rotazione: invisibile

// Obliquità media dell'eclittica: l'inclinazione dell'asse terrestre, che
// cala di poco più di un secondo d'arco all'anno. La formula è quella
// classica; la nutazione (meno di un centesimo di grado) qui non serve.
function skyObliquita(data) {
  const T = Astronomy.MakeTime(data).tt / 36525;
  return 23.439291111 - 0.0130041667 * T - 1.638e-7 * T * T + 5.036e-7 * T * T * T;
}

// Da coordinate eclittiche a equatoriali: una rotazione attorno all'asse che
// punta al punto d'Ariete, di un angolo pari all'obliquità.
function skyEquatorialiDiEclittica(lonGradi, latGradi, eps) {
  const l = lonGradi * SKY_D2R, b = latGradi * SKY_D2R, e = eps * SKY_D2R;
  const x = Math.cos(b) * Math.cos(l);
  const y = Math.cos(b) * Math.sin(l) * Math.cos(e) - Math.sin(b) * Math.sin(e);
  const z = Math.cos(b) * Math.sin(l) * Math.sin(e) + Math.sin(b) * Math.cos(e);
  let ra = Math.atan2(y, x) * SKY_R2D / 15;
  if (ra < 0) ra += 24;
  return { ra, dec: Math.asin(Math.max(-1, Math.min(1, z))) * SKY_R2D };
}

// E la strada di ritorno: quanto un astro sta a nord ("sopra") o a sud
// ("sotto") dell'eclittica, e a che punto del giro si trova.
function skyEclitticaDiEquatoriali(raOre, decGradi, eps) {
  const a = raOre * 15 * SKY_D2R, d = decGradi * SKY_D2R, e = eps * SKY_D2R;
  const x = Math.cos(d) * Math.cos(a);
  const y = Math.cos(d) * Math.sin(a) * Math.cos(e) + Math.sin(d) * Math.sin(e);
  const z = Math.sin(d) * Math.cos(e) - Math.cos(d) * Math.sin(a) * Math.sin(e);
  let lon = Math.atan2(y, x) * SKY_R2D;
  if (lon < 0) lon += 360;
  return { lon, lat: Math.asin(Math.max(-1, Math.min(1, z))) * SKY_R2D };
}

// Di quanto un oggetto sta fuori dal piano dell'orbita terrestre. Le
// coordinate dell'epoca di oggi se ci sono (i pianeti), quelle di catalogo
// altrimenti (stelle e deep sky): sulla latitudine eclittica la differenza
// fra le due è di millesimi di grado.
function skyScartoEclittica(o) {
  if (!o || o.tipo === 'satellite' || typeof Astronomy === 'undefined') return null;
  const ra = typeof o.raOra === 'number' ? o.raOra : o.ra;
  const dec = typeof o.decOra === 'number' ? o.decOra : o.dec;
  if (typeof ra !== 'number' || typeof dec !== 'number') return null;
  try {
    const data = skyAdesso();
    return skyEclitticaDiEquatoriali(ra, dec, skyObliquita(data));
  } catch (e) { return null; }
}

// Il cerchio in cielo, i marcatori dei mesi e il filo a piombo dell'oggetto
// scelto. Sono un paio di centinaia di conversioni: si rifanno quando cambia
// il minuto mostrato, il luogo o l'oggetto selezionato, non a ogni fotogramma.
function skyCalcolaEclittica() {
  if (!sky.mostraEclittica || !sky.observer || typeof Astronomy === 'undefined') {
    sky.eclittica.punti = [];
    sky.eclittica.mesi = [];
    sky.eclittica.scarto = null;
    sky.eclittica.chiave = null;
    sky.eclittica.analemma = { chiave: null, punti: [], mesi: [], oggi: null };
    return;
  }

  const scelto = skyOggettoScelto();
  const t0 = Math.round(skyAdesso().getTime() / SKY_ECL_ARROTONDA_MS) * SKY_ECL_ARROTONDA_MS;
  const chiave = [t0, Math.round(sky.observer.latitude * 100), Math.round(sky.observer.longitude * 100),
    scelto ? (scelto.id || `${scelto.ra},${scelto.dec}`) : '-'].join('|');
  if (sky.eclittica.chiave === chiave) return;
  const adesso = performance.now();
  if (adesso < sky.eclittica.prossimo) return;
  sky.eclittica.prossimo = adesso + SKY_ECL_RINFRESCO_MS;
  sky.eclittica.chiave = chiave;

  const data = new Date(t0);
  const t = Astronomy.MakeTime(data);
  const eps = skyObliquita(data);
  // Dove finisce, nel cielo di questo istante, un punto dell'eclittica
  const inCielo = (lon, lat) => {
    const e = skyEquatorialiDiEclittica(lon, lat || 0, eps);
    const hor = Astronomy.Horizon(t, sky.observer, e.ra, e.dec, 'normal');
    return { az: hor.azimuth, alt: hor.altitude, lon };
  };

  const punti = [];
  try {
    // Si arriva a 360 per chiudere il cerchio sul punto di partenza
    for (let lon = 0; lon <= 360; lon += SKY_ECL_PASSO_GRADI) punti.push(inCielo(lon % 360, 0));
  } catch (e) { punti.length = 0; }
  sky.eclittica.punti = punti;

  // I paletti dell'eclittica sono i mesi, come le ore lo sono per la traccia:
  // dodici puntini che dicono dove sarà il Sole il primo di ogni mese, cioè
  // da che parte sta andando e quale pezzo di cerchio è cielo di stanotte.
  const mesi = [];
  try {
    for (let i = 0; i < 12; i++) {
      const primo = new Date(data.getFullYear(), data.getMonth() + i, 1);
      const sole = Astronomy.SunPosition(primo);
      const p = inCielo(sole.elon, 0);
      p.mese = NOMI_MESI[primo.getMonth()].slice(0, 3).toLowerCase();
      mesi.push(p);
    }
  } catch (e) { mesi.length = 0; }
  sky.eclittica.mesi = mesi;

  // L'analemma dipende solo dall'ora mostrata e dal luogo: non lo si rifà
  // quando cambia soltanto l'oggetto selezionato
  const chiaveAnalemma = [t0, Math.round(sky.observer.latitude * 100), Math.round(sky.observer.longitude * 100)].join('|');
  if (sky.eclittica.analemma.chiave !== chiaveAnalemma) {
    skyCalcolaAnalemma(t0, chiaveAnalemma);
  }

  // Il filo a piombo: dall'oggetto scelto giù (o su) fino alla linea, nel
  // punto che ha la sua stessa longitudine eclittica. È la misura dello
  // scarto resa visibile, che è poi il motivo per cui questa linea esiste.
  sky.eclittica.scarto = null;
  if (scelto && typeof scelto.az === 'number') {
    const ecl = skyScartoEclittica(scelto);
    if (ecl && Math.abs(ecl.lat) > 0.05) {
      try {
        const piede = inCielo(ecl.lon, 0);
        sky.eclittica.scarto = {
          az: scelto.az, alt: scelto.alt,
          azPiede: piede.az, altPiede: piede.alt,
          lat: ecl.lat,
          colore: scelto.colore || '#e2e8f0'
        };
      } catch (e) { /* senza il piede resta solo la linea */ }
    }
  }
}

// Colore della linea: ambra su cielo scuro, ambra bruciata di giorno, dove
// un tratto chiaro sparirebbe nell'azzurro (stessa scelta del reticolo).
function skyColoreEclittica() {
  return sky.luceCielo > 0.4 ? '#b45309' : '#fbbf24';
}

function skyDisegnaEclittica(ctx, base, focale) {
  if (!sky.mostraEclittica) return;
  const punti = sky.eclittica.punti;
  if (!punti || punti.length < 2) return;

  const colore = skyColoreEclittica();
  const proietta = p => {
    const q = skyProietta(skyVettore(p.az, p.alt), base, focale);
    return { px: q.px, py: q.py, davanti: q.davanti, alt: p.alt, mese: p.mese };
  };
  const dentro = p => p.davanti && p.px >= 0 && p.px <= sky.larghezza && p.py >= 0 && p.py <= sky.altezza;
  const proiettati = punti.map(proietta);

  ctx.save();
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = colore;
  ctx.setLineDash([10, 7]);

  for (let i = 1; i < proiettati.length; i++) {
    const a = proiettati[i - 1], b = proiettati[i];
    if (!a.davanti || !b.davanti) continue;
    // Come per la traccia: due campioni contigui ai due capi dello schermo
    // sono un artefatto della proiezione, non un tratto di cerchio
    if (Math.abs(a.px - b.px) > sky.larghezza || Math.abs(a.py - b.py) > sky.altezza) continue;
    ctx.globalAlpha = (a.alt < 0 || b.alt < 0) ? 0.22 : 0.55;
    ctx.beginPath();
    ctx.moveTo(a.px, a.py);
    ctx.lineTo(b.px, b.py);
    ctx.stroke();
  }

  // I mesi lungo la linea
  ctx.setLineDash([]);
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  sky.eclittica.mesi.map(proietta).forEach(p => {
    if (!dentro(p)) return;
    ctx.globalAlpha = p.alt < 0 ? 0.3 : 0.8;
    ctx.fillStyle = colore;
    ctx.beginPath();
    ctx.arc(p.px, p.py, 2.4, 0, Math.PI * 2);
    ctx.fill();
    if (sky.mostraNomi) ctx.fillText(p.mese, p.px + 6, p.py - 7);
  });

  // Il nome della linea, una volta sola: senza, un cerchio tratteggiato in
  // più è solo un'altra riga. Va scritto lontano dal centro dello schermo,
  // perché al centro c'è quasi sempre l'oggetto inseguito, con la sua
  // etichetta: due scritte sovrapposte sono peggio di nessuna.
  if (sky.mostraNomi) {
    const cx = sky.larghezza / 2, cy = sky.altezza / 2;
    const margine = 60;
    let migliore = null, distanza = -1;
    proiettati.forEach(p => {
      if (!dentro(p) || p.alt < 0) return;
      if (p.px < margine || p.px > sky.larghezza - margine ||
          p.py < margine || p.py > sky.altezza - margine) return;
      const d = (p.px - cx) * (p.px - cx) + (p.py - cy) * (p.py - cy);
      if (d > distanza) { distanza = d; migliore = p; }
    });
    if (migliore) {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = colore;
      ctx.fillText('eclittica', migliore.px + 8, migliore.py + 10);
    }
  }

  skyDisegnaAnalemma(ctx, base, focale);
  skyDisegnaScartoEclittica(ctx, base, focale);
  ctx.restore();
}

// --- L'ANALEMMA: il Sole alla stessa ora, un giorno dopo l'altro ------------
//   L'eclittica dice dove passa il Sole in un anno fra le stelle. L'analemma
//   risponde a una domanda più casalinga, e più sorprendente: se esco in
//   giardino ogni giorno alla stessa ora e segno dov'è il Sole, che figura
//   viene fuori? Non un punto, e nemmeno una riga: un otto allungato.
//
//   Le due cause sono le stesse che rendono l'eclittica interessante. L'asse
//   della Terra è inclinato di 23,4°, e questo fa salire e scendere il Sole
//   di 47° fra un solstizio e l'altro: è l'altezza dell'otto. E l'orbita è
//   un'ellisse, quindi la Terra a gennaio corre più forte che a luglio: il
//   Sole arriva al mezzogiorno un po' in anticipo o un po' in ritardo
//   sull'orologio, fino a un quarto d'ora, ed è la larghezza dell'otto.
//   Insomma: l'analemma è l'eclittica guardata sempre alla stessa ora.
//
//   Si accende insieme all'eclittica, perché è la stessa lezione vista da
//   un'altra parte, e perché da sola non si saprebbe a cosa appenderla.
// =====================================================================

// I campioni vanno presi a giorni interi di distanza, se no cambia anche
// l'ora e la figura non è più un analemma: con un passo di 5,003 giorni —
// l'anno vero diviso in 73 — l'ultimo campione finisce quasi sei ore più
// tardi del primo, e l'otto si apre in una spirale storta.
const SKY_ANALEMMA_PASSI = 73;                    // 73 × 5 giorni = un anno
const SKY_ANALEMMA_PASSO_MS = 5 * 86400000;
const SKY_ANALEMMA_GIRO_MS = SKY_ANALEMMA_PASSI * SKY_ANALEMMA_PASSO_MS;

// Il Sole allo stesso istante del giorno, per un anno intero. I campioni si
// prendono a distanze esatte in millisecondi e non "stessa ora locale": l'ora
// legale sposterebbe metà figura di quindici gradi, spezzandola in due.
function skyCalcolaAnalemma(t0, chiave) {
  const a = { chiave, punti: [], mesi: [], oggi: null };
  sky.eclittica.analemma = a;
  try {
    const solePunto = quando => {
      const t = Astronomy.MakeTime(quando);
      const equ = Astronomy.Equator('Sun', t, sky.observer, true, true);
      const hor = Astronomy.Horizon(t, sky.observer, equ.ra, equ.dec, 'normal');
      return { az: hor.azimuth, alt: hor.altitude };
    };

    for (let i = 0; i < SKY_ANALEMMA_PASSI; i++) {
      a.punti.push(solePunto(new Date(t0 + i * SKY_ANALEMMA_PASSO_MS)));
    }
    a.oggi = a.punti[0];

    // I primi del mese, presi alla stessa ora universale dei campioni: sono i
    // paletti che dicono da che parte si cammina lungo l'otto
    const d0 = new Date(t0);
    for (let i = 0; i < 12; i++) {
      const m = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + i, 1,
        d0.getUTCHours(), d0.getUTCMinutes(), d0.getUTCSeconds()));
      const p = solePunto(m);
      p.mese = NOMI_MESI[m.getUTCMonth()].slice(0, 3).toLowerCase();
      a.mesi.push(p);
    }
  } catch (e) {
    sky.eclittica.analemma = { chiave, punti: [], mesi: [], oggi: null };
  }
}

function skyDisegnaAnalemma(ctx, base, focale) {
  const a = sky.eclittica.analemma;
  if (!a || a.punti.length < 3) return;

  // Oro pallido e tratto pieno: l'eclittica è ambra e tratteggiata, e le due
  // linee si incrociano di continuo. A distinguerle, comunque, è soprattutto
  // la forma: un otto non lo fa nient'altro in cielo.
  const colore = sky.luceCielo > 0.4 ? '#a16207' : '#fde68a';
  const proietta = p => {
    const q = skyProietta(skyVettore(p.az, p.alt), base, focale);
    return { px: q.px, py: q.py, davanti: q.davanti, alt: p.alt, mese: p.mese };
  };
  const dentro = p => p.davanti && p.px >= 0 && p.px <= sky.larghezza && p.py >= 0 && p.py <= sky.altezza;
  const punti = a.punti.map(proietta);

  ctx.save();
  ctx.strokeStyle = colore;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  for (let i = 0; i < punti.length; i++) {
    const p = punti[i], q = punti[(i + 1) % punti.length];   // la figura è chiusa
    if (!p.davanti || !q.davanti) continue;
    if (Math.abs(p.px - q.px) > sky.larghezza || Math.abs(p.py - q.py) > sky.altezza) continue;
    ctx.globalAlpha = (p.alt < 0 || q.alt < 0) ? 0.22 : 0.6;
    ctx.beginPath();
    ctx.moveTo(p.px, p.py);
    ctx.lineTo(q.px, q.py);
    ctx.stroke();
  }

  // I mesi, ma solo quelli che non si pestano i piedi: da lontano l'otto è
  // lungo un centimetro, e dodici scritte lì sopra sono una macchia
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const scritti = [];
  a.mesi.map(proietta).forEach(p => {
    if (!dentro(p)) return;
    ctx.globalAlpha = p.alt < 0 ? 0.3 : 0.85;
    ctx.fillStyle = colore;
    ctx.beginPath();
    ctx.arc(p.px, p.py, 2.2, 0, Math.PI * 2);
    ctx.fill();
    if (!sky.mostraNomi) return;
    if (scritti.some(s => Math.abs(s.px - p.px) < 26 && Math.abs(s.py - p.py) < 16)) return;
    scritti.push(p);
    ctx.fillText(p.mese, p.px + 6, p.py - 7);
  });

  // Dove sta il Sole adesso è anche il punto dell'otto di oggi: le due cose
  // coincidono sempre, ed è il modo più rapido per capire cos'è questa figura
  const oggi = a.oggi ? proietta(a.oggi) : null;
  if (oggi && dentro(oggi)) {
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = colore;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(oggi.px, oggi.py, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Il nome, lontano dal Sole: lì attorno ci sono già l'anello di oggi, il
  // nome del Sole e qualunque pianeta gli stia passando vicino
  if (sky.mostraNomi) {
    const margine = 50;
    let migliore = null, distanza = -1;
    punti.forEach(p => {
      if (!dentro(p) || p.alt < 0) return;
      if (p.px < margine || p.px > sky.larghezza - margine ||
          p.py < margine || p.py > sky.altezza - margine) return;
      const d = oggi ? (p.px - oggi.px) ** 2 + (p.py - oggi.py) ** 2 : 0;
      if (d > distanza) { distanza = d; migliore = p; }
    });
    if (migliore) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = colore;
      ctx.fillText('analemma', migliore.px + 9, migliore.py + 11);
    }
  }
  ctx.restore();
}

// Il filo a piombo fra l'oggetto scelto e l'eclittica, con quanti gradi sono
function skyDisegnaScartoEclittica(ctx, base, focale) {
  const s = sky.eclittica.scarto;
  if (!s) return;
  const a = skyProietta(skyVettore(s.az, s.alt), base, focale);
  const b = skyProietta(skyVettore(s.azPiede, s.altPiede), base, focale);
  if (!a.davanti || !b.davanti) return;
  if (Math.abs(a.px - b.px) > sky.larghezza / 2 || Math.abs(a.py - b.py) > sky.altezza / 2) return;

  ctx.save();
  ctx.strokeStyle = s.colore;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([2, 3]);
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(a.px, a.py);
  ctx.lineTo(b.px, b.py);
  ctx.stroke();

  if (sky.mostraNomi) {
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = s.colore;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const segno = s.lat >= 0 ? '+' : '−';
    // Lo scarto si scrive oltre il piede, proseguendo nel verso del filo:
    // vicino all'astro ci sono già il suo simbolo e il suo nome
    const verso = b.py >= a.py ? 1 : -1;
    ctx.fillText(`${segno}${skyNumero(Math.abs(s.lat), 1)}°`, b.px + 7, b.py + verso * 12);
  }
  ctx.restore();
}

// =====================================================================
// 7.3-quater LA LEZIONE DELL'ECLITTICA
//   Disegnare la linea non basta a spiegarla. Chi la vede per la prima volta
//   si chiede giustamente da dove esca: perché proprio lì, perché il Sole ci
//   sta sempre sopra, perché i pianeti quasi. La risposta non si può dare a
//   parole in una scheda, perché è una faccenda di geometria in tre
//   dimensioni: il Sistema Solare è un disco, noi stiamo dentro al disco, e
//   guardandolo di taglio da qui dentro lo vediamo come una riga.
//
//   Questa è quella spiegazione in cinque quadri, con il Sistema Solare che
//   si inclina sotto gli occhi finché il bersaglio visto dall'alto diventa
//   un piatto visto di profilo. Si apre dal tasto dentro la scheda del Sole,
//   che è il posto dove la domanda nasce.
//
//   Le distanze fra le orbite sono compresse (Saturno è novanta volte più
//   lontano di quanto lo si disegni qui): senza, Mercurio sarebbe dentro al
//   Sole. Gli angoli invece sono veri, ed è di angoli che parla la lezione.
// =====================================================================

// Semiasse in unità astronomiche, periodo in anni, inclinazione dell'orbita
// sull'eclittica e longitudine del nodo ascendente (dove l'orbita sale sopra
// il piano della Terra): sono questi due ultimi numeri a fare la lezione.
const LEZ_PIANETI = [
  { nome: 'Mercurio', ua: 0.387, anni: 0.241, incl: 7.00, nodo: 48.3,  raggio: 3.4, colore: '#cbd5e1' },
  { nome: 'Venere',   ua: 0.723, anni: 0.615, incl: 3.39, nodo: 76.7,  raggio: 4.6, colore: '#fde68a' },
  { nome: 'Terra',    ua: 1.000, anni: 1.000, incl: 0.00, nodo: 0,     raggio: 4.8, colore: '#60a5fa' },
  { nome: 'Marte',    ua: 1.524, anni: 1.881, incl: 1.85, nodo: 49.6,  raggio: 3.8, colore: '#f87171' },
  { nome: 'Giove',    ua: 5.203, anni: 11.86, incl: 1.30, nodo: 100.5, raggio: 8.0, colore: '#fbbf24' },
  { nome: 'Saturno',  ua: 9.537, anni: 29.45, incl: 2.49, nodo: 113.7, raggio: 6.8, colore: '#fcd34d' }
];

// I cinque quadri. `elev` è l'altezza della telecamera sul piano: 90° è la
// vista dall'alto, pochi gradi è la vista di taglio.
const LEZ_CAPITOLI = [
  {
    breve: 'Dall\'alto',
    titolo: 'Visto dall\'alto sembra un bersaglio',
    tipo: 'sistema', elev: 88, disco: 0, anniAlSecondo: 1 / 8,
    testo: 'Sopra la testa del Sole il Sistema Solare sembra un bersaglio: cerchi quasi ' +
      'perfetti, percorsi tutti nello stesso verso, come se qualcuno li avesse disegnati ' +
      'col compasso. È la figura che tutti abbiamo in mente — ed è anche quella che ' +
      'nasconde il fatto più importante, perché vista da sopra una cosa piatta e una cosa ' +
      'spessa sono identiche.'
  },
  {
    breve: 'Di taglio',
    titolo: 'Girata di taglio: non è una palla, è un disco',
    tipo: 'sistema', elev: 4, disco: 0, anniAlSecondo: 1 / 8,
    testo: 'Adesso la stessa scena si abbassa fino a guardarla di profilo, e i cerchi si ' +
      'schiacciano uno sull\'altro. Ecco il fatto: i pianeti non sono sparsi in tutte le ' +
      'direzioni attorno al Sole, stanno tutti dentro a un piatto sottile. Ognuno viaggia ' +
      'su un piano un po\' diverso, ma «un po\'» vuol dire pochi gradi.'
  },
  {
    breve: 'Il piano',
    titolo: 'Il pavimento del Sistema Solare',
    tipo: 'sistema', elev: 13, disco: 1, anniAlSecondo: 1 / 8,
    testo: 'Per misurare quei gradi serve un pavimento da cui contarli, e la scelta è ' +
      'naturale: il piano dell\'orbita della Terra, cioè il nostro. Prolungalo all\'infinito, ' +
      'fino alle stelle: il cerchio che disegna nel cielo è <strong>l\'eclittica</strong>. ' +
      'Le orbite degli altri lo attraversano appena inclinate — Mercurio 7,0°, Venere 3,4°, ' +
      'Saturno 2,5°, Marte 1,8°, Giove 1,3° — e per questo restano sempre lì attorno.'
  },
  {
    breve: 'Da qui',
    titolo: 'Come lo vediamo da dentro',
    tipo: 'cielo', anniAlSecondo: 0,
    testo: 'Noi stiamo dentro a quel pavimento e lo guardiamo di taglio: perciò il Sole, la ' +
      'Luna e i pianeti ci sembrano infilati sulla stessa riga, che attraversa il cielo da ' +
      'un orizzonte all\'altro. È esattamente la linea che accende il tasto «Eclittica» del ' +
      'planetario. Questi sono i pianeti veri di adesso: la scala verticale è ingrandita ' +
      'sei volte, altrimenti quei due o tre gradi non si vedrebbero.'
  },
  {
    breve: 'L\'analemma',
    titolo: 'L\'eclittica guardata sempre alla stessa ora',
    tipo: 'analemma', anniAlSecondo: 1 / 14,
    testo: 'Prova a uscire ogni giorno alla stessa ora e a segnare dov\'è il Sole. Non viene un ' +
      'punto — e nemmeno una riga: viene un <strong>otto allungato</strong>, l\'analemma. Le due ' +
      'cause sono le stesse di prima, prese una per volta. L\'asse della Terra è inclinato di ' +
      '23,4°, e questo alza e abbassa il Sole di 47° fra i due solstizi: è l\'altezza dell\'otto. ' +
      'L\'orbita è un\'ellisse, quindi d\'inverno la Terra corre più forte e il Sole arriva al ' +
      'mezzogiorno con un anticipo o un ritardo che tocca il quarto d\'ora: è la larghezza. ' +
      'Sulla mappa lo trovi acceso insieme all\'eclittica, in oro pallido, e ti passa esattamente ' +
      'per dove il Sole si trova adesso.'
  },
  {
    breve: 'Il nome',
    titolo: 'Perché si chiama proprio “eclittica”',
    tipo: 'nodi', anniAlSecondo: 1 / 22,
    testo: 'Il nome viene dalle eclissi. La Luna gira su un piano inclinato di 5° sul nostro, ' +
      'quindi tocca l\'eclittica in due soli punti: i <strong>nodi</strong>. Perché ci sia ' +
      'un\'eclissi servono due coincidenze insieme — la Luna in un nodo, e il Sole nella ' +
      'stessa direzione (eclissi di Sole) o in quella opposta (eclissi di Luna). Guarda il ' +
      'Sole girare attorno: solo due volte l\'anno si mette in linea con i nodi, ed è lì che ' +
      'si aprono le stagioni delle eclissi. Ecco perché non ne capita una al mese. ' +
      'L\'inclinazione dell\'orbita lunare, qui, è disegnata quattro volte più marcata del ' +
      'vero: a 5° esatti sarebbe indistinguibile dallo spessore della linea.'
  }
];

const lez = {
  aperto: false, canvas: null, ctx: null, L: 0, H: 0, raf: null, ultimoTs: 0,
  capitolo: 0,
  elev: 88,            // altezza della telecamera, insegue quella del capitolo
  rotazione: 0,        // giro lento attorno al Sole, perché la scena respiri
  anni: 0,             // il tempo della lezione, in anni
  fade: 1,             // dissolvenza al cambio di quadro
  scala: 1, cx: 0, cy: 0, altaBarra: 0,
  stelle: [],
  cielo: null,         // posizioni vere dei pianeti per il quadro «Da qui»
  analemma: null,      // il Sole a mezzogiorno per un anno, col suo anticipo
  skyDaRiprendere: false
};

// --- Geometria della scena -------------------------------------------------

// Raggio con cui si disegna un'orbita: le distanze vere non ci stanno in uno
// schermo (Saturno è venticinque volte Mercurio), quindi si comprimono. Gli
// angoli, che sono il punto della lezione, restano invece esatti.
function lezRaggio(ua) {
  return Math.pow(ua / 9.537, 0.42);
}

// Un punto dell'orbita: cerchio inclinato di `incl` gradi sul piano
// dell'eclittica, con la linea dei nodi ruotata di `nodo` gradi.
function lezPuntoOrbita(p, gradi) {
  const th = gradi * SKY_D2R, i = p.incl * SKY_D2R, om = p.nodo * SKY_D2R;
  const r = lezRaggio(p.ua);
  const x = r * Math.cos(th), y = r * Math.sin(th) * Math.cos(i), z = r * Math.sin(th) * Math.sin(i);
  return { x: x * Math.cos(om) - y * Math.sin(om), y: x * Math.sin(om) + y * Math.cos(om), z };
}

// Dalla scena allo schermo: telecamera a `lez.elev` gradi sul piano, che gira
// lentamente attorno all'asse. `vicinanza` serve a disegnare per ultimo ciò
// che sta davanti.
function lezProietta(x, y, z) {
  const a = lez.rotazione, e = lez.elev * SKY_D2R;
  const xr = x * Math.cos(a) - y * Math.sin(a);
  const yr = x * Math.sin(a) + y * Math.cos(a);
  return {
    px: lez.cx + xr * lez.scala,
    py: lez.cy - (yr * Math.sin(e) + z * Math.cos(e)) * lez.scala,
    vicinanza: z * Math.sin(e) - yr * Math.cos(e)
  };
}

// --- Pezzi di disegno riusati fra i quadri ---------------------------------

function lezGeneraStelle(quante) {
  lez.stelle = [];
  for (let i = 0; i < quante; i++) {
    lez.stelle.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + 0.3, a: Math.random() * 0.5 + 0.2 });
  }
}

function lezSfondo(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, lez.H);
  g.addColorStop(0, '#04060f');
  g.addColorStop(1, '#0a1024');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, lez.L, lez.H);
  ctx.fillStyle = '#e2e8f0';
  lez.stelle.forEach(s => {
    ctx.globalAlpha = s.a;
    ctx.beginPath();
    ctx.arc(s.x * lez.L, s.y * lez.H, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function lezAlone(ctx, px, py, raggio, colore, forza) {
  const g = ctx.createRadialGradient(px, py, 0, px, py, raggio);
  g.addColorStop(0, colore);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = forza;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, py, raggio, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function lezTesto(ctx, testo, px, py, colore, misura = 12, allinea = 'left') {
  ctx.save();
  ctx.font = `${misura}px system-ui, sans-serif`;
  ctx.textAlign = allinea;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.85)';
  ctx.strokeText(testo, px, py);
  ctx.fillStyle = colore;
  ctx.fillText(testo, px, py);
  ctx.restore();
}

// --- Quadri 1-3: il Sistema Solare che si inclina --------------------------

function lezQuadroSistema(ctx, cap) {
  lezSfondo(ctx);
  // Vista dall'alto il disco è largo quanto alto, e a comandare è l'altezza
  // dello schermo; abbassando la telecamera si schiaccia, e allora si può
  // ingrandire. La scena così riempie sempre il riquadro, e il passaggio da
  // un quadro all'altro diventa anche un avvicinarsi.
  const senoElev = Math.max(0.3, Math.sin(lez.elev * SKY_D2R));
  lez.scala = Math.min(lez.L * 0.42, lez.H * 0.42 / senoElev);
  lez.cx = lez.L / 2;
  lez.cy = lez.H / 2;

  // Il piano di riferimento: il disco su cui giace l'orbita terrestre,
  // prolungato oltre Saturno. Compare solo nel terzo quadro, ed è la
  // risposta disegnata alla domanda «l'eclittica dov'è?».
  if (cap.disco > 0) lezDisegnaDisco(ctx, cap.disco);

  const corpi = [];
  LEZ_PIANETI.forEach(p => {
    // L'orbita, campionata e sfumata con la profondità: il tratto che passa
    // dietro al Sole si spegne, ed è quello che dà il senso dello spazio
    const passo = 6;
    let prec = null;
    const terra = p.nome === 'Terra';
    for (let g = 0; g <= 360; g += passo) {
      const q = lezPuntoOrbita(p, g);
      const s = lezProietta(q.x, q.y, q.z);
      if (prec) {
        const vicino = (s.vicinanza + prec.vicinanza) / 2;
        ctx.globalAlpha = (terra ? 0.55 : 0.32) + 0.3 * Math.max(0, Math.min(1, vicino + 0.5));
        ctx.strokeStyle = p.colore;
        ctx.lineWidth = terra ? 2 : 1.2;
        ctx.beginPath();
        ctx.moveTo(prec.px, prec.py);
        ctx.lineTo(s.px, s.py);
        ctx.stroke();
      }
      prec = s;
    }
    ctx.globalAlpha = 1;

    const ang = (lez.anni / p.anni) * 360 + p.nodo;
    const q = lezPuntoOrbita(p, ang);
    const s = lezProietta(q.x, q.y, q.z);
    corpi.push({ p, s });
  });

  // Di taglio i sei pianeti finiscono tutti su una striscia alta pochi pixel,
  // e i nomi si accavallano. Ognuno ha quindi il suo piolo su una scaletta,
  // con un filo che lo lega al puntino: si legge in tutti e tre i quadri.
  const scaletta = [-18, 20, -34, 36, -50, 52];

  // Il Sole al centro, con il suo alone
  const sole = lezProietta(0, 0, 0);
  lezAlone(ctx, sole.px, sole.py, 46, 'rgba(253, 224, 71, 0.55)', 1);
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.arc(sole.px, sole.py, 9, 0, Math.PI * 2);
  ctx.fill();

  // I pianeti, dal più lontano al più vicino
  corpi.sort((a, b) => a.s.vicinanza - b.s.vicinanza).forEach(({ p, s }) => {
    const terra = p.nome === 'Terra';
    lezAlone(ctx, s.px, s.py, p.raggio * 3.4, p.colore, terra ? 0.5 : 0.32);
    ctx.fillStyle = p.colore;
    ctx.beginPath();
    ctx.arc(s.px, s.py, p.raggio, 0, Math.PI * 2);
    ctx.fill();
    if (terra) {
      ctx.strokeStyle = '#bfdbfe';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(s.px, s.py, p.raggio + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    const dy = scaletta[LEZ_PIANETI.indexOf(p)] || -18;
    ctx.save();
    ctx.strokeStyle = p.colore;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.px, s.py);
    ctx.lineTo(s.px + 9, s.py + dy);
    ctx.stroke();
    ctx.restore();
    lezTesto(ctx, p.nome, s.px + 12, s.py + dy, terra ? '#dbeafe' : '#cbd5e1', terra ? 13 : 12);
  });
}

// Il piano dell'eclittica: un disco ambra appena percettibile, con il bordo
// segnato, che dice «tutto quello che vedete sta praticamente qui dentro».
function lezDisegnaDisco(ctx, forza) {
  const punti = [];
  for (let g = 0; g <= 360; g += 4) {
    const th = g * SKY_D2R, r = 1.18;
    punti.push(lezProietta(r * Math.cos(th), r * Math.sin(th), 0));
  }
  ctx.save();
  ctx.beginPath();
  punti.forEach((s, i) => i ? ctx.lineTo(s.px, s.py) : ctx.moveTo(s.px, s.py));
  ctx.closePath();
  ctx.globalAlpha = 0.1 * forza;
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  ctx.globalAlpha = 0.55 * forza;
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([9, 6]);
  ctx.stroke();
  ctx.restore();

  const eti = punti[Math.round(punti.length * 0.62)];
  if (eti) lezTesto(ctx, 'piano dell\'eclittica', eti.px, eti.py + 14, '#fbbf24', 12);
}

// --- Quadro 4: la stessa scena vista da dentro -----------------------------

// Dove sono adesso, davvero, i pianeti rispetto all'eclittica. Si legge una
// volta all'apertura del quadro: in un minuto non si spostano.
function lezLeggiCielo() {
  if (typeof Astronomy === 'undefined') { lez.cielo = null; return; }
  const nomi = [
    { id: 'Sun', nome: 'Sole', colore: '#fde68a', raggio: 9 },
    { id: 'Moon', nome: 'Luna', colore: '#e2e8f0', raggio: 7 },
    { id: 'Mercury', nome: 'Mercurio', colore: '#cbd5e1', raggio: 4 },
    { id: 'Venus', nome: 'Venere', colore: '#fde68a', raggio: 5 },
    { id: 'Mars', nome: 'Marte', colore: '#f87171', raggio: 4.5 },
    { id: 'Jupiter', nome: 'Giove', colore: '#fbbf24', raggio: 6.5 },
    { id: 'Saturn', nome: 'Saturno', colore: '#fcd34d', raggio: 6 }
  ];
  try {
    const t = Astronomy.MakeTime(skyAdesso());
    lez.cielo = nomi.map(n => {
      const e = Astronomy.Ecliptic(Astronomy.GeoVector(n.id, t, true));
      return Object.assign({}, n, { lon: e.elon, lat: e.elat });
    });
  } catch (e) { lez.cielo = null; }
}

function lezQuadroCielo(ctx) {
  lezSfondo(ctx);
  const cy = lez.H * 0.52;
  const margine = Math.min(60, lez.L * 0.06);
  const largo = lez.L - margine * 2;
  // In orizzontale ci sta tutto il giro del cielo; in verticale si ingrandisce
  // sei volte, altrimenti due gradi sarebbero quattro pixel e la lezione non
  // si vedrebbe. È un imbroglio dichiarato: sta scritto in fondo al quadro.
  const ESAGERA = 6;
  const perGrado = (largo / 360) * ESAGERA;

  // La linea: stessa ambra tratteggiata del planetario, così chi torna sulla
  // mappa riconosce di aver già visto questa riga
  ctx.save();
  ctx.strokeStyle = '#fbbf24';
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1.8;
  ctx.setLineDash([10, 7]);
  ctx.beginPath();
  ctx.moveTo(margine * 0.4, cy);
  ctx.lineTo(lez.L - margine * 0.4, cy);
  ctx.stroke();
  ctx.restore();
  lezTesto(ctx, 'eclittica', margine * 0.4 + 4, cy - 14, '#fbbf24', 12);

  if (!lez.cielo) {
    lezTesto(ctx, 'Servono i dati della libreria astronomica per mostrare il cielo di adesso.',
      lez.L / 2, lez.H / 2, '#94a3b8', 13, 'center');
    return;
  }

  // Le tacche dei trenta gradi di longitudine, per dare la misura del giro
  ctx.save();
  ctx.strokeStyle = '#475569';
  ctx.globalAlpha = 0.7;
  for (let g = 0; g <= 360; g += 30) {
    const px = margine + largo * (g / 360);
    ctx.beginPath();
    ctx.moveTo(px, cy - 4);
    ctx.lineTo(px, cy + 4);
    ctx.stroke();
  }
  ctx.restore();

  // Due astri nella stessa direzione (capita: si chiama congiunzione) avrebbero
  // i nomi uno sull'altro. Chi arriva secondo scala di un gradino.
  const occupati = [];
  const gradino = o => {
    let liv = 0;
    while (occupati.some(u => Math.abs(u.px - o.px) < 62 && u.liv === liv)) liv++;
    occupati.push({ px: o.px, liv });
    return liv;
  };

  lez.cielo.slice().sort((a, b) => b.raggio - a.raggio).forEach(o => {
    const px = margine + largo * (((o.lon % 360) + 360) % 360) / 360;
    const py = cy - o.lat * perGrado;
    lezAlone(ctx, px, py, o.raggio * 3.6, o.colore, o.id === 'Sun' ? 0.6 : 0.35);
    ctx.fillStyle = o.colore;
    ctx.beginPath();
    ctx.arc(px, py, o.raggio, 0, Math.PI * 2);
    ctx.fill();
    // Il filo a piombo fino alla linea: lo stesso segno che il planetario
    // disegna sull'oggetto scelto
    if (Math.abs(o.lat) > 0.15) {
      ctx.save();
      ctx.strokeStyle = o.colore;
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, cy);
      ctx.stroke();
      ctx.restore();
    }
    const segno = o.lat >= 0 ? '+' : '−';
    const su = o.lat >= 0;
    const liv = gradino({ px });
    const dy = (su ? -1 : 1) * (12 + liv * 30);
    if (liv > 0) {
      ctx.save();
      ctx.strokeStyle = o.colore;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 6, py + dy + (su ? 8 : -8));
      ctx.stroke();
      ctx.restore();
    }
    lezTesto(ctx, o.nome, px + o.raggio + 5, py + dy, '#e2e8f0', 12);
    lezTesto(ctx, `${segno}${skyNumero(Math.abs(o.lat), 1)}°`,
      px + o.raggio + 5, py + dy + (su ? -14 : 14), o.colore, 11);
  });

  lezTesto(ctx, 'scala verticale ingrandita 6 volte · in orizzontale il giro completo del cielo',
    lez.L - 10, lez.H - 14, '#64748b', 11, 'right');
}

// --- Quadro 5: l'analemma, cioè l'eclittica presa sempre alla stessa ora ---

// Il Sole a mezzogiorno medio locale, un anno intero. Oltre a dove sta, di
// ogni giorno serve di quanto è avanti o indietro rispetto all'orologio:
// è l'equazione del tempo, e nella figura è la larghezza.
function lezLeggiAnalemma() {
  lez.analemma = null;
  if (typeof Astronomy === 'undefined') return;
  try {
    const obs = sky.observer || new Astronomy.Observer(42, 12.5, 0);
    const anno = new Date().getFullYear();
    // Mezzogiorno medio locale del 1° gennaio, dedotto dalla longitudine e non
    // dal fuso: così la figura viene diritta, e l'ora legale non la spezza.
    const t0 = Date.UTC(anno, 0, 1, 0, 0, 0) + (12 - obs.longitude / 15) * 3600000;
    const punti = [];
    for (let i = 0; i < SKY_ANALEMMA_PASSI; i++) {
      const data = new Date(t0 + i * SKY_ANALEMMA_PASSO_MS);
      const t = Astronomy.MakeTime(data);
      const equ = Astronomy.Equator('Sun', t, obs, true, true);
      const hor = Astronomy.Horizon(t, obs, equ.ra, equ.dec, 'normal');
      // Tempo solare vero meno tempo solare medio: l'anticipo o il ritardo
      // del Sole sull'orologio, in minuti
      const oreAngolo = Astronomy.HourAngle('Sun', t, obs);
      const vero = (oreAngolo + 12) % 24;
      const ut = ((((t.ut + 0.5) % 1) + 1) % 1) * 24;
      const medio = ((ut + obs.longitude / 15) % 24 + 24) % 24;
      let scarto = vero - medio;
      if (scarto > 12) scarto -= 24;
      if (scarto < -12) scarto += 24;
      punti.push({ alt: hor.altitude, eot: scarto * 60, data, primo: data.getUTCDate() <= 5 ? data.getUTCMonth() : -1 });
    }
    lez.analemma = { punti, t0, lat: obs.latitude };
  } catch (e) { lez.analemma = null; }
}

function lezQuadroAnalemma(ctx) {
  lezSfondo(ctx);
  const a = lez.analemma;
  if (!a || a.punti.length < 3) {
    lezTesto(ctx, 'Serve la libreria astronomica per calcolare l\'analemma.',
      lez.L / 2, lez.H / 2, '#94a3b8', 13, 'center');
    return;
  }

  const eot = a.punti.map(p => p.eot), alt = a.punti.map(p => p.alt);
  const eMin = Math.min(...eot), eMax = Math.max(...eot);
  const aMin = Math.min(...alt), aMax = Math.max(...alt);
  // Il grafico: in orizzontale i minuti di anticipo o ritardo, in verticale
  // l'altezza del Sole. Nel cielo vero l'otto è sottile come un dito; qui i
  // due assi hanno ciascuno la sua scala, se no la larghezza sparirebbe.
  const larghezza = Math.min(lez.L * 0.34, 240);
  const altezza = lez.H * 0.6;
  const cx = lez.L * 0.52, cy = lez.H * 0.5;
  const sx = e => cx + (e - (eMin + eMax) / 2) / Math.max(1, eMax - eMin) * larghezza;
  const sy = h => cy - (h - (aMin + aMax) / 2) / Math.max(1, aMax - aMin) * altezza;

  // La verticale dell'orologio: a sinistra il Sole è in anticipo, a destra in ritardo
  ctx.save();
  ctx.strokeStyle = '#475569';
  ctx.globalAlpha = 0.7;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(sx(0), sy(aMax) - 26);
  ctx.lineTo(sx(0), sy(aMin) + 26);
  ctx.stroke();
  ctx.restore();
  lezTesto(ctx, 'in orario', sx(0), sy(aMax) - 34, '#94a3b8', 11, 'center');

  // L'otto
  ctx.save();
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  a.punti.forEach((p, i) => {
    const px = sx(p.eot), py = sy(p.alt);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // I primi del mese, con il nome dove c'è posto
  const scritti = [];
  a.punti.forEach(p => {
    if (p.primo < 0) return;
    const px = sx(p.eot), py = sy(p.alt);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(px, py, 2.6, 0, Math.PI * 2);
    ctx.fill();
    if (scritti.some(s => Math.abs(s.x - px) < 30 && Math.abs(s.y - py) < 15)) return;
    scritti.push({ x: px, y: py });
    lezTesto(ctx, NOMI_MESI[p.primo].slice(0, 3).toLowerCase(),
      px + (p.eot >= (eMin + eMax) / 2 ? 7 : -7), py, '#cbd5e1', 11,
      p.eot >= (eMin + eMax) / 2 ? 'left' : 'right');
  });
  ctx.globalAlpha = 1;

  // La misura verticale: 47°, che sono due volte l'inclinazione dell'asse
  const xMis = Math.max(30, sx(eMin) - 60);
  lezMisura(ctx, xMis, sy(aMax), xMis, sy(aMin), true);
  lezTesto(ctx, `${skyNumero(aMax - aMin, 1)}°`, xMis - 8, (sy(aMax) + sy(aMin)) / 2, '#a5b4fc', 12, 'right');
  lezTesto(ctx, 'l\'asse è storto di 23,4°', xMis - 8, (sy(aMax) + sy(aMin)) / 2 + 16, '#818cf8', 11, 'right');

  // E quella orizzontale: mezz'ora scarsa fra il giorno più in anticipo e
  // quello più in ritardo
  const yMis = sy(aMin) + 34;
  lezMisura(ctx, sx(eMin), yMis, sx(eMax), yMis, false);
  lezTesto(ctx, `da −${skyNumero(Math.abs(eMin), 0)} a +${skyNumero(eMax, 0)} minuti`,
    cx, yMis + 16, '#a5b4fc', 12, 'center');
  lezTesto(ctx, 'l\'orbita è un\'ellisse: la Terra non va sempre uguale', cx, yMis + 32, '#818cf8', 11, 'center');

  // Il Sole che cammina lungo la figura, giorno dopo giorno
  const frazione = ((lez.anni % 1) + 1) % 1;
  const posto = frazione * a.punti.length;
  const i0 = Math.floor(posto) % a.punti.length;
  const i1 = (i0 + 1) % a.punti.length;
  const f = posto - Math.floor(posto);
  const pe = a.punti[i0].eot + (a.punti[i1].eot - a.punti[i0].eot) * f;
  const pa = a.punti[i0].alt + (a.punti[i1].alt - a.punti[i0].alt) * f;
  const px = sx(pe), py = sy(pa);
  lezAlone(ctx, px, py, 30, 'rgba(253, 224, 71, 0.6)', 1);
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.arc(px, py, 7, 0, Math.PI * 2);
  ctx.fill();

  const giorno = new Date(a.t0 + frazione * SKY_ANALEMMA_GIRO_MS);
  lezTesto(ctx, `${giorno.getUTCDate()} ${NOMI_MESI[giorno.getUTCMonth()].toLowerCase()}`,
    px + 13, py - 8, '#fde68a', 12);
  lezTesto(ctx, `${pa >= 0 ? '' : '−'}${skyNumero(Math.abs(pa), 0)}° di altezza · ` +
    `${pe >= 0 ? '+' : '−'}${skyNumero(Math.abs(pe), 0)} min`, px + 13, py + 8, '#cbd5e1', 11);

  lezTesto(ctx, `il Sole a mezzogiorno, da ${skyNumero(a.lat, 1)}° di latitudine`,
    lez.L - 10, lez.H - 14, '#64748b', 11, 'right');
}

// Una quota da disegno tecnico: la riga con i due trattini alle estremità
function lezMisura(ctx, x1, y1, x2, y2, verticale) {
  ctx.save();
  ctx.strokeStyle = '#818cf8';
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  if (verticale) {
    ctx.moveTo(x1 - 5, y1); ctx.lineTo(x1 + 5, y1);
    ctx.moveTo(x2 - 5, y2); ctx.lineTo(x2 + 5, y2);
  } else {
    ctx.moveTo(x1, y1 - 5); ctx.lineTo(x1, y1 + 5);
    ctx.moveTo(x2, y2 - 5); ctx.lineTo(x2, y2 + 5);
  }
  ctx.stroke();
  ctx.restore();
}

// --- Quadro 6: i nodi, e il nome della linea -------------------------------

function lezQuadroNodi(ctx) {
  lezSfondo(ctx);
  // Il Sole sta più in fuori di tutto il resto: la scala lascia il posto a lui
  // e al suo nome, se no finisce mezzo fuori dal riquadro
  lez.scala = Math.min(lez.L * 0.27, lez.H * 0.58);
  lez.cx = lez.L / 2;
  lez.cy = lez.H / 2;
  lez.elev = 14;
  lez.rotazione = 0;

  // L'inclinazione vera è 5,1°: disegnata così, con la telecamera bassa, si
  // confonderebbe con lo spessore della linea, e il quadro direbbe il
  // contrario di quello che deve dire. Qui è ingrandita quattro volte — sta
  // scritto sotto, perché un disegno che imbroglia di nascosto non insegna.
  const INCL = 20;
  const orbita = g => {
    const th = g * SKY_D2R, i = INCL * SKY_D2R;
    return { x: Math.cos(th), y: Math.sin(th) * Math.cos(i), z: Math.sin(th) * Math.sin(i) };
  };

  // Il piano dell'eclittica attorno alla Terra
  ctx.save();
  ctx.beginPath();
  for (let g = 0; g <= 360; g += 4) {
    const s = lezProietta(1.5 * Math.cos(g * SKY_D2R), 1.5 * Math.sin(g * SKY_D2R), 0);
    g ? ctx.lineTo(s.px, s.py) : ctx.moveTo(s.px, s.py);
  }
  ctx.closePath();
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1.3;
  ctx.setLineDash([9, 6]);
  ctx.stroke();
  ctx.restore();
  const bordo = lezProietta(1.5 * Math.cos(255 * SKY_D2R), 1.5 * Math.sin(255 * SKY_D2R), 0);
  lezTesto(ctx, 'piano dell\'eclittica', bordo.px, bordo.py + 14, '#fbbf24', 11, 'center');

  // L'orbita della Luna, inclinata: sopra il piano è chiara, sotto è spenta
  let prec = null;
  for (let g = 0; g <= 360; g += 4) {
    const q = orbita(g);
    const s = lezProietta(q.x, q.y, q.z);
    if (prec) {
      ctx.globalAlpha = q.z >= 0 ? 0.85 : 0.35;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(prec.px, prec.py);
      ctx.lineTo(s.px, s.py);
      ctx.stroke();
    }
    prec = s;
  }
  ctx.globalAlpha = 1;

  // La linea dei nodi: dove l'orbita taglia il piano. È fissa, mentre il
  // Sole gira: è tutta qui la ragione delle stagioni delle eclissi.
  const nodoA = lezProietta(1, 0, 0), nodoB = lezProietta(-1, 0, 0);
  ctx.save();
  ctx.strokeStyle = '#38bdf8';
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(nodoA.px, nodoA.py);
  ctx.lineTo(nodoB.px, nodoB.py);
  ctx.stroke();
  ctx.restore();
  [nodoA, nodoB].forEach(n => {
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(n.px, n.py, 3.4, 0, Math.PI * 2);
    ctx.fill();
  });
  lezTesto(ctx, 'nodo', nodoA.px + 8, nodoA.py - 12, '#38bdf8', 11);
  lezTesto(ctx, 'nodo', nodoB.px - 8, nodoB.py - 12, '#38bdf8', 11, 'right');

  // La Terra al centro
  const terra = lezProietta(0, 0, 0);
  lezAlone(ctx, terra.px, terra.py, 26, 'rgba(96, 165, 250, 0.5)', 1);
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.arc(terra.px, terra.py, 7, 0, Math.PI * 2);
  ctx.fill();
  lezTesto(ctx, 'Terra', terra.px + 12, terra.py + 12, '#dbeafe', 12);

  // Il Sole gira attorno in un anno (è la Terra che gira, ma da qui si vede
  // così); la Luna fa un giro al mese, cioè dodici volte più in fretta.
  const angSole = lez.anni * 360;
  const angLuna = lez.anni * 360 * 12.37;
  const dirSole = lezProietta(1.58 * Math.cos(angSole * SKY_D2R), 1.58 * Math.sin(angSole * SKY_D2R), 0);
  lezAlone(ctx, dirSole.px, dirSole.py, 40, 'rgba(253, 224, 71, 0.6)', 1);
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.arc(dirSole.px, dirSole.py, 8, 0, Math.PI * 2);
  ctx.fill();
  lezTesto(ctx, 'Sole', dirSole.px + 12, dirSole.py + 12, '#fde68a', 12);

  const qL = orbita(angLuna);
  const luna = lezProietta(qL.x, qL.y, qL.z);
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(luna.px, luna.py, 5, 0, Math.PI * 2);
  ctx.fill();
  lezTesto(ctx, 'Luna', luna.px + 9, luna.py - 9, '#e2e8f0', 11);

  // Quanto manca perché il Sole sia in linea coi nodi, e quanto la Luna è
  // lontana dal piano: le due condizioni che devono capitare insieme
  const scartoSole = Math.abs(Math.sin(angSole * SKY_D2R));
  const lunaAlNodo = Math.abs(Math.sin(angLuna * SKY_D2R));
  const stagione = scartoSole < 0.26;      // Sole entro ~15° dalla linea dei nodi

  if (stagione) {
    // La linea che passa per Sole, Terra e punto opposto: quando è questa a
    // coincidere con la linea dei nodi, l'eclissi diventa possibile
    ctx.save();
    ctx.strokeStyle = '#fbbf24';
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    const opposto = lezProietta(-1.58 * Math.cos(angSole * SKY_D2R), -1.58 * Math.sin(angSole * SKY_D2R), 0);
    ctx.beginPath();
    ctx.moveTo(dirSole.px, dirSole.py);
    ctx.lineTo(opposto.px, opposto.py);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    const l = Math.min(300, lez.L - 40), h = 26, x = lez.L / 2 - l / 2, y = 14;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, l, h, 13); else ctx.rect(x, y, l, h);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    lezTesto(ctx, 'stagione delle eclissi: Sole in linea coi nodi',
      lez.L / 2, y + h / 2, '#e0f2fe', 12, 'center');

    if (lunaAlNodo < 0.12) {
      // Luna dalla parte del Sole: si mette in mezzo, ed è un'eclissi di Sole.
      // Dalla parte opposta è lei a entrare nell'ombra della Terra.
      const insieme = Math.cos((angLuna - angSole) * SKY_D2R) > 0;
      lezAlone(ctx, luna.px, luna.py, 30, 'rgba(248, 250, 252, 0.8)', 1);
      lezTesto(ctx, insieme ? 'eclissi di Sole' : 'eclissi di Luna',
        luna.px + 10, luna.py + 12, '#fca5a5', 12);
    }
  }

  lezTesto(ctx, 'inclinazione ingrandita 4 volte (in realtà 5°) · un giro del Sole = un anno, uno della Luna = un mese',
    lez.L - 10, lez.H - 14, '#64748b', 11, 'right');
}

// --- Ciclo, comandi e finestra ---------------------------------------------

function lezRidimensiona() {
  if (!lez.canvas) return;
  const dpr = window.devicePixelRatio || 1;
  lez.L = lez.canvas.clientWidth || 320;
  lez.H = lez.canvas.clientHeight || 300;
  lez.canvas.width = Math.round(lez.L * dpr);
  lez.canvas.height = Math.round(lez.H * dpr);
  lez.ctx = lez.canvas.getContext('2d');
  lez.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function lezDisegna() {
  if (!lez.ctx) return;
  const ctx = lez.ctx;
  const cap = LEZ_CAPITOLI[lez.capitolo];
  ctx.clearRect(0, 0, lez.L, lez.H);
  ctx.save();
  ctx.globalAlpha = lez.fade;
  try {
    if (cap.tipo === 'cielo') lezQuadroCielo(ctx);
    else if (cap.tipo === 'analemma') lezQuadroAnalemma(ctx);
    else if (cap.tipo === 'nodi') lezQuadroNodi(ctx);
    else lezQuadroSistema(ctx, cap);
  } catch (e) {
    console.error('Errore nella lezione dell\'eclittica:', e);
  }
  ctx.restore();
}

function lezCiclo(ts) {
  if (!lez.aperto) return;
  const dt = lez.ultimoTs ? Math.min((ts - lez.ultimoTs) / 1000, 0.1) : 0;
  lez.ultimoTs = ts;
  const cap = LEZ_CAPITOLI[lez.capitolo];

  lez.anni += dt * (cap.anniAlSecondo || 0);
  // La telecamera non salta da un quadro all'altro: ci arriva, e vedere
  // il disco che si chiude è metà della spiegazione
  if (cap.tipo === 'sistema') {
    lez.elev += (cap.elev - lez.elev) * Math.min(1, dt * 2.4);
    lez.rotazione += dt * 0.06;
  }
  lez.fade = Math.min(1, lez.fade + dt * 2.5);

  lezDisegna();
  lez.raf = requestAnimationFrame(lezCiclo);
}

function lezVaiA(indice) {
  const nuovo = Math.max(0, Math.min(LEZ_CAPITOLI.length - 1, indice));
  const cambiaTipo = LEZ_CAPITOLI[nuovo].tipo !== LEZ_CAPITOLI[lez.capitolo].tipo;
  lez.capitolo = nuovo;
  if (cambiaTipo) lez.fade = 0;            // quadri diversi: dissolvenza
  if (LEZ_CAPITOLI[nuovo].tipo === 'cielo') lezLeggiCielo();
  if (LEZ_CAPITOLI[nuovo].tipo === 'analemma') { lezLeggiAnalemma(); lez.anni = 0; }
  if (LEZ_CAPITOLI[nuovo].tipo === 'nodi') lez.anni = 0.02;
  lezAggiornaTesti();
  lezDisegna();
}

function lezAggiornaTesti() {
  const cap = LEZ_CAPITOLI[lez.capitolo];
  const titolo = document.getElementById('lez-titolo-quadro');
  if (titolo) titolo.textContent = cap.titolo;
  const testo = document.getElementById('lez-testo');
  if (testo) testo.innerHTML = `<p>${cap.testo}</p>`;
  const passo = document.getElementById('lez-passo');
  if (passo) passo.textContent = `${lez.capitolo + 1} / ${LEZ_CAPITOLI.length}`;
  document.querySelectorAll('#lez-capitoli [data-capitolo]').forEach(b => {
    const attivo = Number(b.dataset.capitolo) === lez.capitolo;
    b.classList.toggle('attiva', attivo);
    b.setAttribute('aria-pressed', attivo ? 'true' : 'false');
  });
  const indietro = document.getElementById('lez-btn-indietro');
  if (indietro) indietro.disabled = lez.capitolo === 0;
  const avanti = document.getElementById('lez-btn-avanti');
  if (avanti) {
    const ultimo = lez.capitolo === LEZ_CAPITOLI.length - 1;
    avanti.disabled = ultimo;
    avanti.textContent = ultimo ? 'Fine' : 'Avanti';
  }
}

// Si apre dal tasto dentro la scheda del Sole, e da chi ha bisogno di un
// pezzo preciso della spiegazione: le finestre delle eclissi entrano
// direttamente dal quadro dei nodi, che è quello che le riguarda.
window.apriLezioneEclittica = (da) => {
  const modale = document.getElementById('modale-lezione');
  if (!modale) return;
  lez.canvas = document.getElementById('lez-canvas');
  if (!lez.canvas) return;

  const chiesto = typeof da === 'string' ? LEZ_CAPITOLI.findIndex(c => c.tipo === da) : Number(da);
  lez.capitolo = Number.isInteger(chiesto) && chiesto >= 0 && chiesto < LEZ_CAPITOLI.length ? chiesto : 0;
  lez.elev = 88;
  lez.rotazione = 0;
  lez.anni = 0;
  lez.fade = 0;
  lez.ultimoTs = 0;
  lezGeneraStelle(90);
  lezAggiornaTesti();

  modale.classList.remove('hidden');
  lez.aperto = true;

  // Il planetario dietro alla finestra non serve a nessuno, e due tele che
  // si ridisegnano insieme su un telefono si sentono: si mette in pausa.
  lez.skyDaRiprendere = !!sky.raf;
  if (sky.raf) { cancelAnimationFrame(sky.raf); sky.raf = null; }

  requestAnimationFrame(() => {
    lezRidimensiona();
    if (!lez.raf) lez.raf = requestAnimationFrame(lezCiclo);
  });
};

function chiudiLezioneEclittica() {
  const modale = document.getElementById('modale-lezione');
  if (modale) modale.classList.add('hidden');
  lez.aperto = false;
  if (lez.raf) cancelAnimationFrame(lez.raf);
  lez.raf = null;
  if (lez.skyDaRiprendere && sky.aperto && !sky.raf) {
    sky.raf = requestAnimationFrame(skyCiclo);
  }
  lez.skyDaRiprendere = false;
}

function inizializzaLezioneEclittica() {
  const modale = document.getElementById('modale-lezione');
  if (!modale) return;

  const chips = document.getElementById('lez-capitoli');
  if (chips && chips.dataset.pronto !== 'si') {
    chips.innerHTML = LEZ_CAPITOLI.map((c, i) =>
      `<button type="button" class="lez-capitolo" data-capitolo="${i}">${i + 1}. ${c.breve}</button>`).join('');
    chips.querySelectorAll('[data-capitolo]').forEach(b =>
      b.addEventListener('click', () => lezVaiA(Number(b.dataset.capitolo))));
    chips.dataset.pronto = 'si';
  }

  ['btn-chiudi-lezione', 'btn-chiudi-lezione-basso'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', chiudiLezioneEclittica);
  });
  modale.addEventListener('click', e => { if (e.target === modale) chiudiLezioneEclittica(); });
  document.addEventListener('keydown', e => {
    if (!lez.aperto) return;
    if (e.key === 'Escape') chiudiLezioneEclittica();
    else if (e.key === 'ArrowRight') lezVaiA(lez.capitolo + 1);
    else if (e.key === 'ArrowLeft') lezVaiA(lez.capitolo - 1);
  });

  const indietro = document.getElementById('lez-btn-indietro');
  if (indietro) indietro.addEventListener('click', () => lezVaiA(lez.capitolo - 1));
  const avanti = document.getElementById('lez-btn-avanti');
  if (avanti) avanti.addEventListener('click', () => lezVaiA(lez.capitolo + 1));

  window.addEventListener('resize', () => { if (lez.aperto) { lezRidimensiona(); lezDisegna(); } });
}

// --- Il ponte fra la lezione e le eclissi ----------------------------------
//   Un'eclissi è la lezione dei nodi che capita davvero, in una data che sta
//   sul calendario. Chi apre la mappa dell'ombra o la simulazione si chiede
//   quasi sempre la stessa cosa — «perché proprio adesso, e perché non tutti
//   i mesi?» — e la risposta è a due centimetri, nel quadro dei nodi. Qui si
//   calcolano i numeri di QUESTA eclissi (quanto la Luna è fuori dal piano,
//   quanto manca al suo passaggio al nodo, quali altre eclissi le fanno
//   compagnia nella stessa stagione) e si offre la porta per andare a vedere
//   la geometria che li produce.
// =====================================================================

const ECL_STAGIONE_GIORNI = 25;      // quanto larga è la finestra di una stagione
const ECL_TIPI_SOLARI = { total: 'totale', annular: 'anulare', partial: 'parziale', hybrid: 'ibrida' };
const ECL_TIPI_LUNARI = { penumbral: 'penombrale', partial: 'parziale', total: 'totale' };

// Il nodo lunare più vicino a una data, e da che parte sta
function nodoLunareVicino(data) {
  let nodo = Astronomy.SearchMoonNode(Astronomy.MakeTime(new Date(data.getTime() - 20 * 86400000)));
  let migliore = nodo;
  for (let i = 0; i < 4; i++) {
    nodo = Astronomy.NextMoonNode(nodo);
    if (Math.abs(nodo.time.date - data) < Math.abs(migliore.time.date - data)) migliore = nodo;
  }
  return migliore;
}

// Le altre eclissi della stessa stagione: quelle che cadono entro tre
// settimane e mezza, cioè quelle che il Sole illumina restando in linea coi
// nodi. Non le si cerca in `eventiCalcolati` perché possono stare in un mese
// che nessuno ha ancora aperto.
function eclissiCompagne(data) {
  const compagne = [];
  const inizio = Astronomy.MakeTime(new Date(data.getTime() - ECL_STAGIONE_GIORNI * 86400000));
  const dentro = quando => {
    const scarto = Math.abs(quando - data) / 86400000;
    return scarto <= ECL_STAGIONE_GIORNI && scarto > 1;   // oltre il giorno: non è lei stessa
  };

  let sol = Astronomy.SearchGlobalSolarEclipse(inizio);
  for (let i = 0; i < 4 && sol; i++) {
    if (sol.peak.date - data > ECL_STAGIONE_GIORNI * 86400000) break;
    if (dentro(sol.peak.date)) {
      compagne.push({ data: sol.peak.date, testo: `eclissi di Sole ${ECL_TIPI_SOLARI[sol.kind] || sol.kind}` });
    }
    sol = Astronomy.NextGlobalSolarEclipse(sol.peak);
  }

  let lun = Astronomy.SearchLunarEclipse(inizio);
  for (let i = 0; i < 4 && lun; i++) {
    if (lun.peak.date - data > ECL_STAGIONE_GIORNI * 86400000) break;
    if (dentro(lun.peak.date)) {
      compagne.push({ data: lun.peak.date, testo: `eclissi di Luna ${ECL_TIPI_LUNARI[lun.kind] || lun.kind}` });
    }
    lun = Astronomy.NextLunarEclipse(lun.peak);
  }

  return compagne.sort((a, b) => a.data - b.data);
}

// Il pannello, uguale per la mappa dell'ombra, per la mappa dell'eclissi
// lunare e per la simulazione: gli stessi tre paragrafi e la stessa porta.
function stagioneEclissiHtml(data) {
  if (typeof Astronomy === 'undefined' || !(data instanceof Date) || isNaN(data)) return '';
  let latitudine, nodo, compagne;
  try {
    latitudine = Astronomy.Ecliptic(Astronomy.GeoVector('Moon', Astronomy.MakeTime(data), true)).elat;
    nodo = nodoLunareVicino(data);
    compagne = eclissiCompagne(data);
  } catch (e) { return ''; }

  const oreAlNodo = (nodo.time.date - data) / 3600000;
  const prima = oreAlNodo >= 0;
  const quante = Math.abs(oreAlNodo) < 1.5
    ? 'praticamente nello stesso momento'
    : `${skyNumero(Math.abs(oreAlNodo), 0)} ore ${prima ? 'dopo' : 'prima'}`;
  const verso = nodo.kind > 0 ? 'ascendente (la Luna sale sopra il piano)' : 'discendente (la Luna scende sotto il piano)';

  const righe = [
    '<p>Un\'eclissi non capita a ogni novilunio, e il motivo è tutto qui: l\'orbita della Luna è ' +
    'inclinata di 5° sull\'eclittica, e la incrocia in due soli punti, i <b>nodi</b>. Serve che il ' +
    'novilunio (o il plenilunio) capiti proprio mentre la Luna è di passaggio da lì, e che il Sole ' +
    'sia in quella stessa direzione: è la <b>stagione delle eclissi</b>, e capita due volte l\'anno.</p>',

    `<p>Per questa: al momento del massimo la Luna è a <b>${skyNumero(Math.abs(latitudine), 2)}°</b> ` +
    `dall'eclittica${Math.abs(latitudine) < 0.6 ? ' (quasi esattamente sulla linea)' : ''} e passa ` +
    `per il nodo ${verso} <b>${quante}</b>, il ${dataOraBreve(nodo.time.date)}. ` +
    'Più i due istanti si avvicinano, più l\'allineamento è centrato.</p>'
  ];

  if (compagne.length) {
    righe.push('<p>Nella stessa stagione: ' +
      compagne.map(c => `<b>${c.testo}</b> il ${c.data.toLocaleDateString('it-IT',
        { day: 'numeric', month: 'long', year: 'numeric' })}`).join(', ') +
      '. Le eclissi vanno a coppie o a terzetti a un paio di settimane di distanza: è il tempo che ' +
      'serve alla Luna per arrivare al nodo opposto, mentre il Sole è ancora in linea con essi.</p>');
  }

  righe.push('<button type="button" class="ecl-tasto-largo" onclick="apriLezioneEclittica(\'nodi\')" ' +
    'title="Il quadro della lezione dedicato ai nodi e alle stagioni delle eclissi">' +
    'Guarda la geometria dei nodi</button>');

  return righe.join('');
}

// Riempie il pannello, se in quella finestra c'è
function mostraStagioneEclissi(idElemento, data) {
  const el = document.getElementById(idElemento);
  if (!el) return;
  const html = stagioneEclissiHtml(data);
  el.innerHTML = html;
  const guscio = el.closest('details, .sim-eclittica');
  if (guscio) guscio.classList.toggle('hidden', !html);
}

// =====================================================================
// 7.4 Interfaccia del planetario
// =====================================================================

// I diciannove astri non sono un elenco solo: sono quattro famiglie, e uno che
// cerca Nettuno sa già in quale guardare. Divisi per famiglia — nell'ordine in
// cui li si cerca, da quello che si vede a occhio nudo a quello che ci vuole
// un telescopio — l'occhio salta al gruppo giusto invece di leggere una fila
// di pillole tutte uguali.
const SKY_FAMIGLIE = [
  { chiave: 'soleluna',  etichetta: 'Sole e Luna', titolo: 'Sole e Luna',       tipi: ['sole', 'luna'] },
  { chiave: 'pianeti',   etichetta: 'Pianeti',     titolo: 'Pianeti',           tipi: ['pianeta'] },
  { chiave: 'stelle',    etichetta: 'Stelle',      titolo: 'Stelle',            tipi: ['stella'] },
  { chiave: 'profondo',  etichetta: 'Profondo',    titolo: 'Cielo profondo',    tipi: ['profondo'] },
  { chiave: 'satelliti', etichetta: 'Stazioni',    titolo: 'Stazioni spaziali', tipi: ['satellite'] }
];

// I titolini dicono dove sei nell'elenco; questi tasti dicono cosa vuoi
// vedere. Sono la stessa divisione, usata nell'altro verso: chi sa già che
// gli interessa un pianeta tocca «Pianeti» e si toglie di mezzo tutto il
// resto, invece di scorrere quattro famiglie per arrivare alla seconda.
function skyCostruisciCategorie() {
  const cont = document.getElementById('skymap-astri-categorie');
  if (!cont || cont.dataset.pronto === 'si') return;
  const chip = (chiave, testo, aiuto) =>
    `<button type="button" class="tasto-segmento" data-famiglia-astri="${chiave}" ` +
    `aria-pressed="false" title="${aiuto}">${testo}</button>`;
  cont.innerHTML = chip('tutte', 'Tutti', 'Tutte le categorie insieme') +
    SKY_FAMIGLIE.map(f => chip(f.chiave, f.etichetta, `Solo ${f.titolo.toLowerCase()}`)).join('');
  cont.querySelectorAll('[data-famiglia-astri]').forEach(b =>
    b.addEventListener('click', () => skyImpostaFamigliaAstri(b.dataset.famigliaAstri)));
  cont.dataset.pronto = 'si';
  skyAggiornaTastiCategorie();
}

function skyImpostaFamigliaAstri(chiave) {
  // Ripremendo la categoria accesa si torna a vederle tutte: è il gesto che
  // tutti provano, e senza di lui bisogna ricordarsi che esiste «Tutti»
  sky.famigliaAstri = (chiave !== 'tutte' && sky.famigliaAstri === chiave) ? 'tutte' : chiave;
  skyAggiornaTastiCategorie();
  skyFiltraElenco();
}

function skyAggiornaTastiCategorie() {
  document.querySelectorAll('#skymap-astri-categorie [data-famiglia-astri]').forEach(b => {
    const attivo = b.dataset.famigliaAstri === (sky.famigliaAstri || 'tutte');
    b.classList.toggle('attiva', attivo);
    b.setAttribute('aria-pressed', attivo ? 'true' : 'false');
  });
}

// Pulsanti per scegliere l'astro da cercare
function skyCostruisciElenco() {
  skyCostruisciCategorie();
  const cont = document.getElementById('skymap-oggetti');
  if (!cont || cont.dataset.pronto === 'si') return;
  const tutti = skyElenco();
  cont.innerHTML = SKY_FAMIGLIE.map(f => {
    const astri = tutti.filter(a => f.tipi.includes(a.tipo));
    if (!astri.length) return '';
    // Il nome normalizzato viaggia col tasto: la ricerca non deve rifare
    // diciannove volte lo stesso lavoro a ogni lettera digitata
    const chip = astri.map(a =>
      `<button type="button" data-astro="${a.id}" data-nome="${normalizzaTesto(a.nome)}" ` +
      `data-famiglia="${f.chiave}" data-fuori="no" class="chip-astro">` +
      `${icona(a.disegno, 15)}<span class="nome-astro">${a.nome}</span><span class="sky-alt"></span></button>`
    ).join('');
    return `<div class="famiglia-astri" data-famiglia="${f.chiave}" data-fuori="no">` +
      `<p class="titolo-famiglia">${f.titolo}</p>` +
      `<div class="astri-famiglia">${chip}</div></div>`;
  }).join('');
  cont.querySelectorAll('.chip-astro').forEach(btn => {
    btn.addEventListener('click', () => skyImpostaTarget(btn.dataset.astro));
  });
  cont.dataset.pronto = 'si';
  skyAggiornaStileElenco();
  skyFiltraElenco();
}

function skyAggiornaStileElenco() {
  // Misure e spaziature stanno in style.css (`.chip-astro`), che le sa
  // stringere sui telefoni: qui restano solo i colori, che dicono lo stato
  const base = 'chip-astro inline-flex items-center rounded-full border border-slate-600';
  document.querySelectorAll('.chip-astro').forEach(btn => {
    const o = skyVoceDiId(btn.dataset.astro);
    const visibile = o && o.alt > 0;
    let stile;
    if (btn.dataset.astro === sky.target) stile = ' bg-blue-600 text-white shadow';
    else if (visibile) stile = ' bg-slate-700 text-slate-100 hover:bg-slate-600';
    else stile = ' bg-slate-800 text-slate-500 hover:bg-slate-700';
    btn.className = base + stile;
  });
}

// La categoria, la ricerca per nome e il filtro "Su ora": tre modi di dire la
// stessa cosa — togli di mezzo quello che adesso non interessa — e lavorano
// insieme, non uno al posto dell'altro (si può cercare "m" dentro ai soli
// oggetti del cielo profondo che stanno su adesso).
// Chi resta fuori lo dice un attributo, non una classe: `skyAggiornaStileElenco`
// riscrive il `className` di ogni tasto a ogni giro, e una classe non
// sopravviverebbe al primo aggiornamento delle altezze.
function skyFiltraElenco() {
  const campo = document.getElementById('skymap-astri-cerca');
  const cercato = normalizzaTesto(campo ? campo.value : '').trim();
  const parole = cercato ? cercato.split(/\s+/) : [];
  const famiglia = sky.famigliaAstri || 'tutte';
  let trovati = 0;

  document.querySelectorAll('#skymap-oggetti .chip-astro').forEach(btn => {
    const nome = btn.dataset.nome || '';
    const o = skyVoceDiId(btn.dataset.astro);
    const perNome = parole.every(p => nome.includes(p));
    const perFamiglia = famiglia === 'tutte' || btn.dataset.famiglia === famiglia;
    // Finché le posizioni non sono state calcolate "Su ora" non toglie
    // niente: un elenco vuoto all'apertura sembrerebbe un guasto
    const perAltezza = !sky.soloAstriVisibili || !o || o.alt > 0;
    const dentro = perNome && perFamiglia && perAltezza;
    btn.dataset.fuori = dentro ? 'no' : 'si';
    if (dentro) trovati++;
  });

  // Una famiglia rimasta senza nessuno se ne va col suo titolo
  document.querySelectorAll('#skymap-oggetti .famiglia-astri').forEach(f => {
    f.dataset.fuori = f.querySelector('.chip-astro[data-fuori="no"]') ? 'no' : 'si';
  });

  const vuoto = document.getElementById('skymap-astri-vuoto');
  if (vuoto) {
    vuoto.textContent = sky.soloAstriVisibili && !parole.length
      ? 'In questa categoria, adesso, non c\'è niente sopra l\'orizzonte.'
      : 'Nessun astro con questo nome.';
    vuoto.classList.toggle('hidden', trovati > 0);
  }
}

// Aggiorna l'altezza mostrata accanto a ogni astro e la scheda in basso
function skyAggiornaEtichette() {
  document.querySelectorAll('.chip-astro').forEach(btn => {
    const span = btn.querySelector('.sky-alt');
    const o = skyVoceDiId(btn.dataset.astro);
    if (span) span.textContent = o ? `${o.alt >= 0 ? '↑' : '↓'}${Math.abs(Math.round(o.alt))}°` : '';
  });
  skyAggiornaStileElenco();
  // Le altezze cambiano di continuo: se il filtro guarda proprio quelle,
  // l'elenco va ripassato insieme a loro
  if (sky.soloAstriVisibili) skyFiltraElenco();
  skyAggiornaScheda();
}

// Scegliere un astro dall'elenco non è solo "accendere una freccia": la
// mappa lo porta al centro, perché il gesto naturale dopo aver detto "voglio
// vedere Saturno" è cercarlo con gli occhi al centro dello schermo.
//
// Quello che NON succede più: la scheda dei dati non si apre da sola. Scegliere
// un astro dall'elenco vuol dire "portamelo davanti", non "raccontamelo", e la
// scheda si prendeva mezzo cielo proprio nel momento in cui lo si cercava.
// Da qui in poi la scheda si apre in un modo solo: premendo direttamente
// sull'oggetto disegnato sulla mappa.
function skyImpostaTarget(id, opzioni = {}) {
  const spegni = sky.target === id && !opzioni.mantieni;
  sky.target = spegni ? null : id;
  sky.cacheOrari = { chiave: null, valore: null };

  if (spegni) {
    // Se la scheda aperta era proprio la sua, se ne va con lui
    const sel = sky.selezione;
    if (sel && sel.categoria === 'astro' && sel.id === id) skyChiudiDettaglio();
  } else {
    const o = skyVoceDiId(sky.target);
    skyAssicuraVisibile(o);
    // Se le posizioni non sono ancora state calcolate (si arriva qui anche
    // da un'altra scheda) il centraggio aspetta il primo calcolo
    if (o) skyCentraSu(o);
    else sky.centraQuandoPronto = sky.target;
  }

  skyAggiornaStileElenco();
  skyAggiornaScheda();
}

// Un astro nascosto da un filtro non si trova nemmeno seguendo la freccia:
// se qualcuno lo chiede, il filtro che lo copre si riapre.
function skyAssicuraVisibile(o) {
  if (!o) return;
  if (o.tipo === 'pianeta') sky.mostraPianeti = true;
  else if (o.tipo === 'sole' || o.tipo === 'luna') sky.mostraSoleLuna = true;
  else if (o.tipo === 'stella') sky.mostraStelle = true;
  else if (o.tipo === 'satellite') sky.mostraSatelliti = true;
  else if (o.tipo === 'profondo') sky.mostraProfondo = true;
  if (o.alt < 0) sky.mostraSottoOrizzonte = true;
  skyAggiornaTastiFiltri();
}

// ---------------------------------------------------------------------
// La scheda dell'oggetto
//   Nome, tipo, distanza, dimensioni, magnitudine, costellazione e
//   coordinate: le stesse righe compaiono in due posti — il pannello che si
//   apre toccando la mappa (sta dentro al riquadro del cielo, così funziona
//   anche a schermo intero) e la scheda di fianco all'elenco — quindi c'è
//   una sola funzione che le scrive.
// ---------------------------------------------------------------------

// Dalle sigle di tre lettere ai nomi italiani delle costellazioni. La chiave
// è la sigla, non il nome: le sigle sono uno standard IAU, mentre i nomi
// lunghi della libreria hanno qualche svista di trascrizione.
const SKY_SIGLE_COSTELLAZIONI = {
  And: 'Andromeda', Ant: 'Macchina Pneumatica', Aps: 'Uccello del Paradiso', Aql: 'Aquila',
  Aqr: 'Acquario', Ara: 'Altare', Ari: 'Ariete', Aur: 'Auriga', Boo: 'Boote', Cae: 'Bulino',
  Cam: 'Giraffa', Cap: 'Capricorno', Car: 'Carena', Cas: 'Cassiopea', Cen: 'Centauro',
  Cep: 'Cefeo', Cet: 'Balena', Cha: 'Camaleonte', Cir: 'Compasso', CMa: 'Cane Maggiore',
  CMi: 'Cane Minore', Cnc: 'Cancro', Col: 'Colomba', Com: 'Chioma di Berenice',
  CrA: 'Corona Australe', CrB: 'Corona Boreale', Crt: 'Coppa', Cru: 'Croce del Sud',
  Crv: 'Corvo', CVn: 'Cani da Caccia', Cyg: 'Cigno', Del: 'Delfino', Dor: 'Dorado',
  Dra: 'Dragone', Equ: 'Cavallino', Eri: 'Eridano', For: 'Fornace', Gem: 'Gemelli',
  Gru: 'Gru', Her: 'Ercole', Hor: 'Orologio', Hya: 'Idra', Hyi: 'Idra Maschio',
  Ind: 'Indiano', Lac: 'Lucertola', Leo: 'Leone', Lep: 'Lepre', Lib: 'Bilancia',
  LMi: 'Leone Minore', Lup: 'Lupo', Lyn: 'Lince', Lyr: 'Lira', Men: 'Mensa',
  Mic: 'Microscopio', Mon: 'Unicorno', Mus: 'Mosca', Nor: 'Squadra', Oct: 'Ottante',
  Oph: 'Ofiuco', Ori: 'Orione', Pav: 'Pavone', Peg: 'Pegaso', Per: 'Perseo',
  Phe: 'Fenice', Pic: 'Pittore', PsA: 'Pesce Australe', Psc: 'Pesci', Pup: 'Poppa',
  Pyx: 'Bussola', Ret: 'Reticolo', Scl: 'Scultore', Sco: 'Scorpione', Sct: 'Scudo',
  Ser: 'Serpente', Sex: 'Sestante', Sge: 'Freccia', Sgr: 'Sagittario', Tau: 'Toro',
  Tel: 'Telescopio', TrA: 'Triangolo Australe', Tri: 'Triangolo', Tuc: 'Tucano',
  UMa: 'Orsa Maggiore', UMi: 'Orsa Minore', Vel: 'Vele', Vir: 'Vergine',
  Vol: 'Pesce Volante', Vul: 'Volpetta'
};

const SKY_KM_PER_UA = 149597870.7;
const SKY_SEC_LUCE_PER_UA = 499.005;

// In che costellazione cade un punto del cielo. I confini sono definiti in
// coordinate J2000, quindi qui vanno quelle di catalogo, non quelle di oggi.
function skyCostellazioneDi(ra, dec) {
  if (typeof ra !== 'number' || typeof dec !== 'number') return null;
  if (typeof Astronomy === 'undefined' || typeof Astronomy.Constellation !== 'function') return null;
  try {
    const c = Astronomy.Constellation(ra, dec);
    const nome = SKY_SIGLE_COSTELLAZIONI[c.symbol] || c.name;
    return `${nome} (${c.symbol})`;
  } catch (e) {
    return null;
  }
}

// Numeri alla maniera italiana: virgola decimale e punto per le migliaia
function skyNumero(valore, decimali = 0) {
  return valore.toLocaleString('it-IT', { minimumFractionDigits: decimali, maximumFractionDigits: decimali });
}

// Ascensione retta in ore, minuti e secondi di tempo
function skyAscensioneTesto(ore) {
  let tot = ((ore % 24) + 24) % 24;
  let h = Math.floor(tot);
  let m = Math.floor((tot - h) * 60);
  let s = Math.round((((tot - h) * 60) - m) * 60);
  if (s === 60) { s = 0; m += 1; }
  if (m === 60) { m = 0; h = (h + 1) % 24; }
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

// Declinazione in gradi, primi e secondi d'arco
function skyDeclinazioneTesto(gradi) {
  const segno = gradi < 0 ? '−' : '+';
  const a = Math.abs(gradi);
  let g = Math.floor(a);
  let m = Math.floor((a - g) * 60);
  let s = Math.round((((a - g) * 60) - m) * 60);
  if (s === 60) { s = 0; m += 1; }
  if (m === 60) { m = 0; g += 1; }
  return `${segno}${g}° ${String(m).padStart(2, '0')}′ ${String(s).padStart(2, '0')}″`;
}

// Un angolo piccolo detto nell'unità in cui si legge meglio
function skyAngoloApparente(gradi) {
  if (gradi >= 1) return `${skyNumero(gradi, 2)}°`;
  const primi = gradi * 60;
  if (primi >= 1) return `${skyNumero(primi, 1)}′`;
  return `${skyNumero(primi * 60, 1)}″`;
}

// Quanto ci mette la luce a coprire una distanza: è il modo più onesto di
// dire quanto è lontano un pianeta
function skyTempoLuceTesto(secondi) {
  if (secondi < 90) return `${skyNumero(secondi, 1)} secondi`;
  const minuti = secondi / 60;
  if (minuti < 90) return `${skyNumero(minuti, 1)} minuti`;
  return `${skyNumero(minuti / 60, 1)} ore`;
}

function skyDistanzaTesto(o) {
  // Stazioni spaziali: poche centinaia di chilometri, e cambiano di continuo
  if (typeof o.distanzaKm === 'number') {
    return `${skyNumero(Math.round(o.distanzaKm))} km in linea d'aria da te`;
  }
  // Corpi del Sistema Solare: la distanza vera dell'istante mostrato
  if (typeof o.distanzaUA === 'number' && o.tipo !== 'stella') {
    const km = o.distanzaUA * SKY_KM_PER_UA;
    const misura = km < 5e6
      ? `${skyNumero(Math.round(km))} km`
      : `${skyNumero(o.distanzaUA, 3)} UA (${skyNumero(Math.round(km))} km)`;
    return `${misura} · la luce ci mette ${skyTempoLuceTesto(o.distanzaUA * SKY_SEC_LUCE_PER_UA)}`;
  }
  // Stelle: anni luce, cioè quanto indietro nel tempo stiamo guardando
  if (typeof o.ly === 'number') {
    const anno = new Date().getFullYear() - Math.round(o.ly);
    return `${skyNumero(o.ly, o.ly < 100 ? 1 : 0)} anni luce: la luce che vedi è partita ` +
      `${o.ly < 60 ? 'nel' : 'intorno al'} ${anno}`;
  }
  // Deep sky: misura di catalogo, scritta in tabella
  return o.distanza || null;
}

function skyDimensioniTesto(o) {
  // Deep sky e satelliti portano la misura già scritta in tabella
  if (o.dimensione) return o.dimensione;

  if (typeof o.diametroKm === 'number') {
    let testo = `${skyNumero(Math.round(o.diametroKm))} km di diametro`;
    if (typeof o.distanzaUA === 'number' && o.distanzaUA > 0) {
      const km = o.distanzaUA * SKY_KM_PER_UA;
      const apparente = 2 * Math.atan((o.diametroKm / 2) / km) * SKY_R2D;
      testo += ` · in cielo appare ${skyAngoloApparente(apparente)}`;
    }
    return testo;
  }
  if (typeof o.raggioSole === 'number') {
    return `${skyNumero(o.raggioSole, o.raggioSole < 10 ? 2 : 0)} volte il raggio del Sole`;
  }
  return null;
}

// La magnitudine è una scala al rovescio (più piccola = più luminosa): la
// scheda dice anche cosa serve per vederlo, che è la domanda vera.
function skyMagnitudineTesto(o) {
  const mag = typeof o.mag === 'number' ? o.mag : (typeof o.magTipica === 'number' ? o.magTipica : null);
  if (mag === null) return null;
  const quando = typeof o.mag === 'number' ? '' : ' (valore tipico dei passaggi migliori)';
  const strumento = mag <= 6 ? 'a occhio nudo, sotto un cielo buio'
                  : mag <= 9.5 ? 'con un binocolo'
                  : 'con un telescopio';
  return `${skyNumero(mag, 1)} — ${strumento}${quando}`;
}

function skyClasseTesto(o) {
  if (o.classe) return o.classe;
  if (o.categoria === 'profondo') return SKY_NOMI_PROFONDO[o.tipo] || 'Oggetto del cielo profondo';
  if (o.categoria === 'figura') {
    return o.costellazioneFigura
      ? `Stella della figura: ${o.costellazioneFigura}`
      : 'Stella';
  }
  return null;
}

// Gli orari del giorno mostrato: per i corpi della libreria li cerca lei,
// per un punto fisso del cielo li calcoliamo noi
function skyOrariDi(o) {
  if (o.categoria === 'astro') {
    if (o.tipo === 'satellite') return null;
    return skyOrari(o.id);
  }
  if (typeof o.ra === 'number') return skyOrariPuntoFisso(o.ra, o.dec);
  return null;
}

// Le righe della scheda, nell'ordine in cui interessano: prima cos'è e
// quanto è lontano, poi dove guardare, infine i numeri da strumento.
function skyRigheScheda(o) {
  const righe = [];
  const dato = (etichetta, valore) => {
    if (valore) righe.push(`<li><span class="voce-dato">${etichetta}:</span> ${valore}</li>`);
  };

  dato('Tipo', skyClasseTesto(o));
  dato('Costellazione', skyCostellazioneDi(o.ra, o.dec));
  dato('Distanza dalla Terra', skyDistanzaTesto(o));
  dato('Dimensioni', skyDimensioniTesto(o));
  dato('Magnitudine', skyMagnitudineTesto(o));

  // La fase si dice per la Luna sempre, e per i pianeti solo quando c'è
  // davvero: Giove e Saturno mostrano un disco pieno tutto l'anno, e
  // scriverlo ogni volta è una riga in più che non dice niente.
  if (typeof o.frazione === 'number' && (o.tipo === 'luna' || o.frazione < 0.98)) {
    dato('Fase', `disco illuminato al ${Math.round(o.frazione * 100)}%`);
  }
  if (o.tipo === 'satellite') {
    dato('Illuminazione', o.illuminato
      ? 'al Sole, quindi può brillare'
      : 'dentro l\'ombra della Terra, invisibile');
    if (typeof o.periodoMin === 'number') {
      dato('Orbita', `un giro della Terra ogni ${o.periodoMin} minuti`);
    }
  }

  if (typeof o.az === 'number') {
    dato('Direzione', `${skyNomeDirezione(o.az)} (azimut ${Math.round(o.az) % 360}°)`);
    dato('Altezza', `${skyNumero(o.alt, 1)}° ${o.alt >= 0 ? 'sopra' : 'sotto'} l'orizzonte`);
  }

  // Coordinate equatoriali: quelle dell'epoca di oggi se le abbiamo (sono
  // quelle da mettere sui cerchi graduati), altrimenti quelle di catalogo
  const ra = typeof o.raOra === 'number' ? o.raOra : o.ra;
  const dec = typeof o.decOra === 'number' ? o.decOra : o.dec;
  if (typeof ra === 'number' && typeof dec === 'number') {
    const epoca = typeof o.raOra === 'number' ? 'epoca di oggi' : 'J2000';
    dato('Coordinate', `AR ${skyAscensioneTesto(ra)} · Dec ${skyDeclinazioneTesto(dec)} <span class="text-slate-500">(${epoca})</span>`);
  }

  // Quanto sta fuori dal piano dell'orbita terrestre. Il numero da solo dice
  // poco: il tasto “Eclittica” disegna la linea a cui si riferisce, e allora
  // «un grado e mezzo sotto» diventa una cosa che si vede.
  const ecl = skyScartoEclittica(o);
  if (ecl) {
    dato('Rispetto all\'eclittica', (Math.abs(ecl.lat) < 0.1
      ? 'praticamente sulla linea'
      : `${skyNumero(Math.abs(ecl.lat), 1)}° ${ecl.lat > 0 ? 'sopra' : 'sotto'}`) +
      ` <span class="text-slate-500">(longitudine ${Math.round(ecl.lon)}°)</span>`);
  }

  const orari = skyOrariDi(o);
  if (orari) {
    if (orari.sempreSopra) dato('Da qui', 'è circumpolare: non tramonta mai');
    else if (orari.maiSopra) dato('Da qui', 'non sale mai sopra l\'orizzonte, a questa latitudine');
    else if (orari.sorge || orari.tramonta) dato('Sorge e tramonta', `${skyOra(orari.sorge)} → ${skyOra(orari.tramonta)}`);
    if (orari.culmina) {
      dato('Passa più alto', `${skyOra(orari.culmina)}` +
        (typeof orari.altezzaMax === 'number' ? `, a ${Math.round(orari.altezzaMax)}° di altezza` : ''));
    }
  }

  return righe;
}

// La scheda intera: titolo, righe di dati, un consiglio in parole e — per il
// Sole — l'avvertimento che non va guardato mai, con niente e in nessun caso.
function skySchedaHtml(o) {
  if (!o) return '';
  const disegno = o.disegno || (o.categoria === 'profondo' ? 'nebulosa' : 'stella');
  const sat = o.tipo === 'satellite' ? satelliteDaId(o.satId) : null;
  const titolo = sat ? sat.nomeLungo : o.nome;

  let coda = '';
  if (o.tipo === 'satellite') {
    coda = `<p class="nota-dettaglio">${skyPassaggioSatelliteTesto(o)}</p>`;
  }

  const consiglio = skyConsiglioScheda(o);
  const nota = o.nota ? `<p class="nota-dettaglio">${o.nota}</p>` : '';
  const avviso = o.id === 'Sun'
    ? '<p class="allarme-dettaglio">Attenzione: non guardare mai il Sole direttamente, né a occhio nudo né con binocolo o telescopio.</p>'
    : '';

  // La scheda del Sole è il posto dove nasce la domanda «ma l'eclittica cos'è,
  // di preciso?»: il Sole ci sta sopra sempre, per definizione. Da qui si apre
  // la lezione animata che lo spiega (sezione 7.3-quater).
  //
  // Dalla scheda di un pianeta nasce invece l'altra domanda — «e perché
  // stasera sta proprio lì?» — che dentro alla cupola non ha risposta: quella
  // porta al Sistema Solare visto da fuori (sezione 7.7), già puntato su di lui.
  let azioni = '';
  if (o.id === 'Sun') {
    azioni = '<button type="button" class="tasto-evento-cielo tasto-evento-forte" ' +
      'onclick="apriLezioneEclittica()" title="Il Sistema Solare visto dall\'alto e poi di taglio: ' +
      'da dove esce l\'eclittica, in cinque quadri animati">Che cos\'è l\'eclittica</button>';
  }
  if (o.tipo === 'pianeta' || o.id === 'Sun') {
    azioni += '<button type="button" class="tasto-evento-cielo" onclick="apriSistemaSolare()" ' +
      'title="Guarda il Sistema Solare da fuori, in questo istante: dove sta ogni pianeta sulla ' +
      'sua orbita, e in che direzione lo stai guardando">Vedilo dall\'esterno</button>';
  }
  if (azioni) azioni = `<div class="azioni-evento">${azioni}</div>`;

  return `<h3 class="flex items-center gap-2">${icona(disegno, 20)} ${titolo}</h3>
    <ul>${skyRigheScheda(o).join('')}</ul>${coda}
    ${consiglio ? `<p class="nota-dettaglio">${consiglio}</p>` : ''}${nota}${avviso}${azioni}`;
}

// Il prossimo passaggio visibile di una stazione spaziale
function skyPassaggioSatelliteTesto(o) {
  if (!satPassaggi[o.satId]) {
    if (!satInCorso) aggiornaPassaggiSatelliti(false);
    return 'Calcolo dei prossimi passaggi in corso…';
  }
  const p = prossimoPassaggioVisibile(o.satId);
  if (!p) return `Nessun passaggio visibile a occhio nudo nei prossimi ${SAT_GIORNI} giorni da qui.`;
  if (p.inizio <= new Date()) {
    return `<span class="text-green-400 font-bold">Sta passando adesso</span>: guarda verso ${skyNomeDirezione(o.az)}, fino alle ${oraBreve(p.fine)}.`;
  }
  return `Prossimo passaggio visibile: <strong class="text-white">${dataOraBreve(p.inizio)}</strong> (${fraQuanto(p.inizio)}), ` +
    `da ${skyNomeDirezione(p.azInizio)} verso ${skyNomeDirezione(p.azFine)}, fino a ${Math.round(p.elevazioneMax)}° di altezza.`;
}

function skyConsiglioScheda(o) {
  if (typeof o.alt !== 'number') return '';
  if (o.tipo === 'satellite') {
    return o.alt > 0
      ? (o.illuminato
          ? 'È sopra il tuo orizzonte e illuminata dal Sole: se il cielo è già scuro la vedi a occhio nudo, come una stella che scivola.'
          : 'È sopra il tuo orizzonte ma dentro l\'ombra della Terra: c\'è, però non riflette luce e non si vede.')
      : 'In questo momento è sotto il tuo orizzonte: te la nasconde la curvatura della Terra. La linea colorata mostra da dove arriverà.';
  }
  if (o.alt > 0) {
    return skyUsaSensori()
      ? 'È sopra l\'orizzonte: segui la freccia azzurra muovendo il telefono.'
      : 'È sopra l\'orizzonte: il tasto “Centra” lo porta in mezzo alla mappa.';
  }
  return 'In questo momento è sotto l\'orizzonte: guarda gli orari qui sopra per sapere quando torna visibile.';
}

// La selezione tiene solo un riferimento all'oggetto: qui diventa la
// fotografia dell'istante mostrato, con posizione e magnitudine di adesso.
function skyVoceSelezionata() {
  const sel = sky.selezione;
  if (!sel) return null;

  if (sel.categoria === 'astro') {
    const o = sky.oggetti.find(x => x.id === sel.id);
    return o ? Object.assign({ categoria: 'astro' }, o) : null;
  }

  const voce = Object.assign({ categoria: sel.categoria }, sel.dati);
  if (sky.observer && typeof Astronomy !== 'undefined') {
    try {
      const hor = Astronomy.Horizon(Astronomy.MakeTime(skyAdesso()), sky.observer, voce.ra, voce.dec, 'normal');
      voce.az = hor.azimuth;
      voce.alt = hor.altitude;
    } catch (e) { /* senza posizione restano le sole coordinate di catalogo */ }
  }
  return voce;
}

// Apre la scheda sopra la mappa (e aggiorna quella di fianco)
function skyApriDettaglio(sel) {
  sky.selezione = sel;
  const pannello = document.getElementById('skymap-dettaglio');
  if (pannello) pannello.classList.add('visibile');
  skyAggiornaScheda();
}

function skyChiudiDettaglio() {
  sky.selezione = null;
  sky.evidenza = null;
  const pannello = document.getElementById('skymap-dettaglio');
  if (pannello) pannello.classList.remove('visibile');
  skyAggiornaScheda();
}

// Riscrive la scheda sulla mappa. Gira una volta al secondo, quindi lo
// scorrimento va conservato: se no leggere una scheda lunga sul telefono
// diventerebbe impossibile.
function skyAggiornaScheda() {
  const corpo = document.getElementById('skymap-dettaglio-corpo');
  const pannello = document.getElementById('skymap-dettaglio');
  if (!corpo || !pannello) return;

  const voce = skyVoceSelezionata();
  // Il cerchio sulla mappa segue la selezione, ma per gli astri dell'elenco
  // ci pensa già il bersaglio: due cerchi sullo stesso puntino sono un errore
  sky.evidenza = voce && voce.categoria !== 'astro' && typeof voce.az === 'number'
    ? { az: voce.az, alt: voce.alt }
    : null;

  if (!pannello.classList.contains('visibile')) return;
  const scorrimento = pannello.scrollTop;
  corpo.innerHTML = voce ? skySchedaHtml(voce) : skyAttesaSchedaHtml();
  pannello.scrollTop = scorrimento;
}

// Cosa scrivere quando non c'è (ancora) nulla da mostrare
function skyAttesaSchedaHtml() {
  const sel = sky.selezione;
  if (!sel || sel.categoria !== 'astro') {
    return 'Tocca un oggetto disegnato sulla mappa per vedere distanza, dimensioni, magnitudine, costellazione e coordinate.';
  }
  if (typeof sel.id === 'string' && sel.id.startsWith('sat-')) {
    satPrecaricaTle();
    return luogoCorrente()
      ? `Scarico i dati orbitali di <strong>${skyNomeCorpo(sel.id)}</strong>…`
      : `Per sapere dov'è <strong>${skyNomeCorpo(sel.id)}</strong> mi serve la tua posizione: ` +
        `<button type="button" onclick="apriPosizione(true)" class="senza-cornice underline text-blue-300 hover:text-blue-200">scegliamola insieme</button>.`;
  }
  return `Calcolo della posizione di <strong>${skyNomeCorpo(sel.id)}</strong> in corso…`;
}

// =====================================================================
// 7.4-bis GLI EVENTI DEL CIELO MOSTRATO
//   La mappa dice dove sono gli astri; il calendario dice quando succede
//   qualcosa. Finché sono due schede separate, chi porta l'orologio sulla
//   notte del 12 agosto vede un cielo qualsiasi e non sa che ci sta guardando
//   dentro il picco delle Perseidi. Qui le due cose si toccano: gli eventi
//   che cadono nell'istante mostrato compaiono sopra la mappa, e quelli che
//   hanno un punto preciso nel cielo — il radiante di uno sciame, la Luna
//   eclissata, i due corpi di una congiunzione — vengono anche segnati lì
//   dove bisogna guardare.
// =====================================================================

// Quanto "dura", in minuti prima e dopo l'istante di picco, ciascun tipo di
// evento. Non sono durate fisiche: sono la finestra dentro cui ha senso dire
// che sta succedendo adesso. Un'eclissi dura le sue ore; il picco di uno
// sciame è una notte intera; una massima elongazione resta buona per giorni.
const SKY_EVENTI_FINESTRA_MIN = {
  eclissi: 200,
  meteore: 16 * 60,
  luna: 10 * 60,
  stagioni: 12 * 60,
  pianeti: 24 * 60,
  congiunzioni: 10 * 60,
  personali: 120,
  altro: 120
};

// Oltre questo scarto dall'istante mostrato un evento non entra più nemmeno
// fra quelli "in giornata": è di un'altra notte
const SKY_EVENTI_VICINI_MIN = 20 * 60;

// Quanto avanti guarda l'elenco della settimana. Sette giorni sono l'orizzonte
// di chi programma un'uscita: più in là il meteo non si sa, e l'elenco
// diventerebbe un secondo calendario dentro al planetario.
const SKY_EVENTI_SETTIMANA_MS = 7 * 86400000;

// Da quando a quando un evento si considera in corso
function skyFinestraEvento(ev) {
  const t = ev.dataObj.getTime();
  // Le eclissi lunari sanno dire da sole quanto durano: la semidurata di
  // penombra è esattamente metà evento, dal primo sfioramento all'ultimo
  const mezza = (ev.eclissiLunare && ev.eclissiLunare.sdPenum)
    ? ev.eclissiLunare.sdPenum
    : (SKY_EVENTI_FINESTRA_MIN[ev.categoria] || SKY_EVENTI_FINESTRA_MIN.altro);
  return { inizio: t - mezza * 60000, fine: t + mezza * 60000 };
}

// Cosa succede intorno all'istante mostrato: quello che è in corso adesso,
// quello che cade nelle ore vicine e quello che arriva entro sette giorni.
// Il risultato si tiene da parte per mezzo minuto: la lista degli eventi
// calcolati può avere migliaia di voci, e questa funzione gira insieme al
// ricalcolo delle posizioni.
function skyEventiVicini() {
  const quando = skyAdesso().getTime();
  const chiave = Math.floor(quando / 30000);
  if (sky.eventiOra.chiave === chiave) return sky.eventiOra;

  const inCorso = [], vicini = [], settimana = [];
  const limite = SKY_EVENTI_VICINI_MIN * 60000;
  eventiCalcolati.forEach(ev => {
    if (!ev.dataObj) return;
    const dt = ev.dataObj.getTime() - quando;
    // Scarto grossolano, costa nulla: indietro basta la finestra più larga,
    // in avanti si arriva fino alla settimana dell'elenco in fondo
    if (dt > SKY_EVENTI_SETTIMANA_MS || dt < -(limite + 6 * 3600000)) return;
    const f = skyFinestraEvento(ev);
    if (quando >= f.inizio && quando <= f.fine) inCorso.push(ev);
    else if (Math.abs(dt) <= limite) vicini.push(ev);
    else if (dt > 0) settimana.push(ev);
  });

  const vicinanza = (a, b) => Math.abs(a.dataObj - quando) - Math.abs(b.dataObj - quando);
  inCorso.sort(vicinanza);
  vicini.sort(vicinanza);
  // La settimana invece si legge in ordine di calendario: è un programma,
  // non un elenco di cose vicine
  settimana.sort((a, b) => a.dataObj - b.dataObj);

  sky.eventiOra = { chiave, inCorso, vicini, settimana };
  return sky.eventiOra;
}

// Il calendario nasce con i mesi da oggi in avanti. La macchina del tempo,
// però, arriva al 1900 e al 2100: se l'orologio finisce su un mese mai
// calcolato, glielo calcoliamo — una volta sola, e non mentre il playback
// corre (i mesi passerebbero a decine e il cielo si pianterebbe).
function skyChiediEventiDelMese() {
  if (typeof assicuraMese !== 'function' || typeof Astronomy === 'undefined') return;
  if (sky.playbackVerso) return;
  clearTimeout(sky.eventiMeseTimer);
  sky.eventiMeseTimer = setTimeout(() => {
    if (!sky.aperto) return;
    const quando = skyAdesso();
    let aggiunti = 0;
    // Anche il giorno prima e quello dopo: un evento della notte a cavallo
    // del mese sta in un mese che non è quello dell'orologio. E poi la
    // settimana in avanti, perché l'elenco in fondo al menu Eventi arriva
    // fin lì: senza questi mesi, a fine mese la settimana sarebbe vuota.
    [-86400000, 0, 86400000, 4 * 86400000, 7 * 86400000].forEach(dt => {
      const d = new Date(quando.getTime() + dt);
      const anno = d.getFullYear();
      if (anno < ANNO_MINIMO_NAVIGABILE || anno > ANNO_MASSIMO_NAVIGABILE) return;
      try {
        aggiunti += assicuraMese(anno, d.getMonth());
      } catch (e) { /* un mese che non si calcola non deve fermare il cielo */ }
    });
    if (aggiunti) {
      sky.eventiOra.chiave = null;
      skyAggiornaEventi();
    }
  }, 600);
}

// Dove guardare per vedere un evento: il radiante per uno sciame, il corpo
// protagonista per tutto il resto. null se l'evento non ha un punto in cielo
// (una data sul calendario, un promemoria personale).
function skyPosizioneEvento(ev, quando) {
  if (!sky.observer || typeof Astronomy === 'undefined') return null;
  try {
    if (ev.simul && ev.simul.scena === 'sciame' && typeof ev.simul.ra === 'number') {
      const p = altAzCoordinate(ev.simul.ra, ev.simul.dec, quando, sky.observer);
      return { az: p.az, alt: p.alt, radiante: true, nome: ev.simul.nome || ev.titolo };
    }
    if (ev.corpoCielo) {
      // Se l'astro è già stato calcolato per il disegno, riusiamo quello:
      // sono le stesse coordinate, allo stesso istante
      const o = sky.oggetti.find(x => x.id === ev.corpoCielo);
      const p = o ? { az: o.az, alt: o.alt } : altAzCorpo(ev.corpoCielo, quando, sky.observer);
      return { az: p.az, alt: p.alt, radiante: false, nome: skyNomeCorpo(ev.corpoCielo) };
    }
  } catch (e) { /* evento senza posizione: resta solo nell'elenco */ }
  return null;
}

// Da quanto (o fra quanto) rispetto all'istante mostrato
function skyQuandoEventoTesto(ev, inCorso) {
  const scarto = Math.round((ev.dataObj.getTime() - skyAdesso().getTime()) / 1000);
  const picco = Math.abs(scarto) < 60 ? 'al massimo adesso' : `massimo ${skyScartoTempoTesto(scarto)}`;
  return inCorso ? `in corso · ${picco}` : skyScartoTempoTesto(scarto);
}

// Il tasto della mappa, per gli eventi che ne hanno una.
//   Un'eclissi di Sole non si capisce dalla sola posizione in cielo: la
//   domanda vera è da dove la si vede e quanto — e la risposta è il percorso
//   del cono d'ombra. Chi la incontra qui, nell'elenco del planetario, prima
//   doveva ricordarsi di cercarla in agenda per arrivarci. Per le eclissi di
//   Luna il gemello è la mappa di visibilità.
function skyTastoMappaHtml(ev) {
  if (ev.eclissi) {
    return `<button type="button" class="tasto-evento-cielo tasto-evento-forte" onclick="skyApriMappaEvento('${ev.id}')" ` +
      `title="Il percorso del cono d'ombra sulla Terra, minuto per minuto">Mappa dell'ombra</button>`;
  }
  if (ev.eclissiLunare) {
    return `<button type="button" class="tasto-evento-cielo tasto-evento-forte" onclick="skyApriMappaEvento('${ev.id}')" ` +
      `title="Da dove si vede, a che ora, e con la Luna quanto alta">Dove si vede</button>`;
  }
  return '';
}

// La finestra della mappa vive nella pagina, e la pagina non si vede finché
// il cielo è a schermo intero (nel pieno schermo vero il browser disegna solo
// l'elemento richiesto): si esce prima, se no il tasto sembrerebbe rotto.
window.skyApriMappaEvento = (id) => {
  const ev = eventiCalcolati.find(e => e.id === id);
  if (!ev) return;
  const apri = () => {
    if (ev.eclissi && typeof apriMappaEclissi === 'function') apriMappaEclissi(id);
    else if (ev.eclissiLunare && typeof apriMappaLunare === 'function') apriMappaLunare(id);
  };
  if (sky.schermoIntero) {
    skyEsciSchermoIntero();
    setTimeout(apri, 140);
  } else {
    apri();
  }
};

// Una riga dell'elenco: cosa succede, quando, e i tasti che servono —
// portarci sopra l'orologio, cercarlo in cielo e, per le eclissi, aprire
// la mappa di dove si vede.
function skyEventoHtml(ev, inCorso) {
  const cat = CATEGORIE[ev.categoria] || CATEGORIE.personali;
  const posizione = skyPosizioneEvento(ev, skyAdesso());
  const dove = posizione
    ? `<span class="dove-evento">${skyNomeDirezione(posizione.az)}, ${Math.round(posizione.alt)}°` +
      `${posizione.alt < 0 ? ' (sotto l\'orizzonte)' : ''}</span>`
    : '';
  const cerca = posizione
    ? `<button type="button" class="tasto-evento-cielo" onclick="skyEventoNelCielo('${ev.id}')">Mostra in cielo</button>`
    : '';
  return `<div class="voce-evento-cielo${inCorso ? ' in-corso' : ''}" style="--colore-evento:${ev.colore || '#60a5fa'}">
    <span class="segno-evento">${icona(cat.disegno, 18)}</span>
    <div class="corpo-evento">
      <p class="titolo-evento">${ev.titolo}</p>
      <p class="quando-evento">${skyQuandoEventoTesto(ev, inCorso)}${dove ? ' · ' + dove : ''}</p>
      <div class="azioni-evento">
        <button type="button" class="tasto-evento-cielo" onclick="skyVaiAEvento('${ev.id}')">Porta l'orologio qui</button>
        ${cerca}
        ${skyTastoMappaHtml(ev)}
      </div>
    </div>
  </div>`;
}

// Giorno e ora di un evento della settimana, in forma corta: "gio 7 ago · 22:14".
// Per quello che succede fra tre giorni "fra 68 h" non dice niente; la sera in
// cui uscire, invece, sì.
function skyGiornoEventoTesto(ev) {
  const d = ev.dataObj;
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

// Una riga dell'elenco della settimana. Qui il tasto è uno solo, ed è quello
// che serve: portare il planetario su quella sera e puntarlo dove guardare.
// "Mostra in cielo" non avrebbe senso — al cielo di adesso quell'evento non
// c'è ancora.
function skyEventoSettimanaHtml(ev) {
  const cat = CATEGORIE[ev.categoria] || CATEGORIE.personali;
  const scarto = Math.round((ev.dataObj.getTime() - skyAdesso().getTime()) / 1000);
  return `<div class="voce-evento-cielo settimana" style="--colore-evento:${ev.colore || '#60a5fa'}">
    <span class="segno-evento">${icona(cat.disegno, 18)}</span>
    <div class="corpo-evento">
      <p class="titolo-evento">${ev.titolo}</p>
      <p class="quando-evento">${skyGiornoEventoTesto(ev)} · ${skyScartoTempoTesto(scarto)}</p>
      <div class="azioni-evento">
        <button type="button" class="tasto-evento-cielo" onclick="apriEventoNelPlanetario('${ev.id}')">Vedi nel planetario</button>
        ${skyTastoMappaHtml(ev)}
      </div>
    </div>
  </div>`;
}

// Riscrive il pannello e il promemoria sopra la mappa. Gira una volta al
// secondo insieme al resto: riscriviamo solo se è cambiato qualcosa, se no
// un tasto premuto a metà secondo sparirebbe da sotto il dito.
function skyAggiornaEventi() {
  const dati = skyEventiVicini();
  const elenco = document.getElementById('skymap-eventi-elenco');
  const chip = document.getElementById('skymap-eventi-chip');

  if (chip) {
    const n = dati.inCorso.length;
    chip.classList.toggle('visibile', n > 0);
    if (n) {
      const testo = n === 1 ? dati.inCorso[0].titolo : `${n} eventi nel cielo mostrato`;
      // Su una mappa stretta il titolo intero non ci sta: si accorcia
      const stretta = sky.larghezza && sky.larghezza < 560;
      const mostrato = stretta && testo.length > 26 ? testo.slice(0, 24) + '…' : testo;
      if (chip.textContent !== mostrato) chip.textContent = mostrato;
    }
  }

  if (!elenco) return;
  const settimana = dati.settimana || [];
  const firma = dati.inCorso.map(e => 'c' + e.id)
    .concat(dati.vicini.map(e => 'v' + e.id))
    .concat(settimana.map(e => 's' + e.id)).join(',') +
    '|' + Math.floor(skyAdesso().getTime() / 60000);
  if (firma === sky.eventiFirma) return;
  sky.eventiFirma = firma;

  const pezzi = [];
  if (dati.inCorso.length) {
    pezzi.push('<p class="titolo-elenco-eventi">Sta succedendo adesso</p>');
    dati.inCorso.forEach(ev => pezzi.push(skyEventoHtml(ev, true)));
  }
  if (dati.vicini.length) {
    pezzi.push('<p class="titolo-elenco-eventi">Nelle ore vicine</p>');
    dati.vicini.forEach(ev => pezzi.push(skyEventoHtml(ev, false)));
  }
  if (!dati.inCorso.length && !dati.vicini.length) {
    pezzi.push('<p class="nota-lunga">Nel cielo di quest\'ora non c\'è nessun evento del calendario. ' +
      'Sposta l\'orologio — per esempio su una notte di agosto o di dicembre — e qui compariranno gli sciami, ' +
      'le eclissi e le congiunzioni di quel momento.</p>');
  }
  // La settimana: il programma dei prossimi sette giorni, senza uscire dal
  // planetario. È l'elenco da guardare per decidere quale sera vale la pena
  // uscire, e ogni riga porta il cielo su quel momento.
  if (settimana.length) {
    pezzi.push('<p class="titolo-elenco-eventi">Nei prossimi 7 giorni</p>');
    settimana.forEach(ev => pezzi.push(skyEventoSettimanaHtml(ev)));
  } else {
    pezzi.push('<p class="titolo-elenco-eventi">Nei prossimi 7 giorni</p>');
    pezzi.push('<p class="nota-lunga">Nessun evento del calendario nei sette giorni dopo l\'ora mostrata.</p>');
  }
  elenco.innerHTML = pezzi.join('');
}

// Porta l'orologio del planetario sull'istante di un evento
window.skyVaiAEvento = (id) => {
  const ev = eventiCalcolati.find(e => e.id === id);
  if (!ev) return;
  skyFermaPlayback();
  skyImpostaOffsetTempo((ev.dataObj.getTime() - Date.now()) / 1000);
  skyAvviso('eventi', `Orologio portato su “${ev.titolo}”.`, 5000);
};

// Punta la mappa dove si vede l'evento: il radiante di uno sciame, l'astro
// protagonista negli altri casi (che diventa anche il bersaglio della freccia)
window.skyEventoNelCielo = (id) => {
  const ev = eventiCalcolati.find(e => e.id === id);
  if (!ev) return;
  const p = skyPosizioneEvento(ev, skyAdesso());
  if (!p) {
    skyAvviso('eventi', 'Questo evento non ha un punto preciso del cielo da mostrare.', 5000);
    return;
  }
  if (!p.radiante && ev.corpoCielo) {
    skyImpostaTarget(ev.corpoCielo, { mantieni: true });
    return;
  }
  skyMostraGruppo('');
  skyCentraSu({ nome: `il radiante delle ${p.nome}`, az: p.az, alt: p.alt });
};

// Vedere l'evento nel planetario, nel momento giusto.
//   È il tasto che ogni scheda dell'agenda porta in cima alle scorciatoie, e
//   quello delle righe della settimana qui nel menu Eventi. Prima al suo posto
//   c'era "Trova la Luna nel cielo": apriva il cielo di adesso e ci puntava la
//   Luna: per un'eclissi di fra due mesi, il punto sbagliato all'ora sbagliata.
//   Qui invece si fa tutto in un gesto solo — planetario aperto, orologio
//   portato sull'istante dell'evento, mappa puntata dove bisogna guardare e
//   traccia accesa, così si vede anche da che parte l'astro arriva e dove
//   sarà dopo.
window.apriEventoNelPlanetario = (id) => {
  const ev = eventiCalcolati.find(e => e.id === id);
  if (!ev || !ev.dataObj) return;

  mostraVista('cielo');

  // Prima si ferma il playback: se no il tempo, appena arrivati sull'istante
  // giusto, ricomincerebbe subito a scappare via
  skyFermaPlayback();
  skyImpostaOffsetTempo((ev.dataObj.getTime() - Date.now()) / 1000);
  // Un istante lontano può cadere in un mese mai calcolato: gli eventi di quel
  // mese servono adesso, perché sono quelli che compaiono nell'elenco
  skyChiediEventiDelMese();

  // I segni degli eventi sulla mappa servono proprio qui: se il filtro era
  // spento si arriverebbe su un cielo muto
  sky.mostraEventi = true;

  const p = skyPosizioneEvento(ev, skyAdesso());
  if (ev.corpoCielo && (!p || !p.radiante)) {
    // La traccia dell'astro protagonista si accende da sé: di un evento
    // interessa anche da dove arriva e dove sarà fra un'ora
    sky.mostraTraccia = true;
    skyImpostaTarget(ev.corpoCielo, { mantieni: true });
  } else {
    // Uno sciame non ha un astro da puntare — il radiante è un punto del
    // cielo, non un oggetto — e un equinozio non ha nemmeno quello. Il
    // bersaglio di prima va spento: se no resterebbe acceso, con la sua
    // traccia, sopra un evento che non lo riguarda.
    sky.target = null;
    sky.traccia.chiave = null;
    sky.traccia.punti = [];
    skyAggiornaStileElenco();
    skyAggiornaScheda();
    if (p) skyCentraSu({ nome: `il radiante delle ${p.nome}`, az: p.az, alt: p.alt });
  }
  skyAggiornaTastiFiltri();

  // Il cielo mostrato non è quello di adesso: dirlo subito evita di leggere
  // posizioni giuste credendole sbagliate (o il contrario)
  const dove = p
    ? ` — guarda verso ${skyNomeDirezione(p.az)}, a ${Math.round(p.alt)}° di altezza` +
      (p.alt < 0 ? ' (in quel momento è ancora sotto l\'orizzonte)' : '')
    : '';
  skyAvviso('eventi', `Cielo di ${ev.dataTesto}: ${ev.titolo}${dove}.`, 12000);
};

// Il nome corto di un evento, quello che ci sta scritto sulla mappa: via il
// prefisso di categoria, via il secondo sciame di una coppia, e comunque non
// più lungo di una ventina di caratteri.
function skyEtichettaEvento(ev, pos) {
  let testo = pos.radiante
    ? 'radiante ' + String(pos.nome).split(/\s+e\s+/)[0]
    : String(ev.titolo).replace(/^(Sciame Meteorico|Congiunzione|Occultazione):?\s*/i, '');
  if (testo.length > 30) testo = testo.slice(0, 29).trimEnd() + '…';
  return testo;
}

// I segni degli eventi sulla mappa. Sono pochi e discreti: un anello
// tratteggiato attorno all'astro protagonista, e per uno sciame un radiante
// con le sue scie — perché lì non c'è nessun astro da cerchiare, ma è
// esattamente il punto da cui vedrai partire le meteore.
function skyDisegnaEventi(ctx, base, focale) {
  if (!sky.mostraEventi) return;
  const dati = skyEventiVicini();
  if (!dati.inCorso.length) return;
  const quando = skyAdesso();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Più di tre segni sulla stessa mappa sono confusione, non informazione
  dati.inCorso.slice(0, 3).forEach(ev => {
    const pos = skyPosizioneEvento(ev, quando);
    if (!pos) return;
    const p = skyProietta(skyVettore(pos.az, pos.alt), base, focale);
    if (!p.davanti) return;
    if (p.px < -60 || p.px > sky.larghezza + 60 || p.py < -60 || p.py > sky.altezza + 60) return;

    const colore = ev.colore || '#60a5fa';
    ctx.globalAlpha = pos.alt < 0 ? 0.35 : 0.9;
    ctx.strokeStyle = colore;
    ctx.fillStyle = colore;
    ctx.lineWidth = 1.6;

    if (pos.radiante) {
      // Il radiante: un cerchietto e le scie che se ne allontanano
      ctx.beginPath();
      ctx.arc(p.px, p.py, 7, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + 0.2;
        ctx.beginPath();
        ctx.moveTo(p.px + Math.cos(a) * 12, p.py + Math.sin(a) * 12);
        ctx.lineTo(p.px + Math.cos(a) * 24, p.py + Math.sin(a) * 24);
        ctx.stroke();
      }
    } else {
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(p.px, p.py, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // L'etichetta sta sul cielo, non su un fondo: senza un'ombra sotto, sopra
    // la Via Lattea o un alone lunare non si legge. E i titoli lunghi si
    // accorciano: "Sciame Meteorico: Delta Aquaridi meridionali e Alfa
    // Capricornidi" attraversava mezza mappa coprendo quello che indicava.
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(2, 6, 16, 0.9)';
    ctx.shadowBlur = 4;
    const etichetta = skyEtichettaEvento(ev, pos);
    const meta = ctx.measureText(etichetta).width / 2 + 8;
    ctx.fillText(etichetta,
      Math.max(meta, Math.min(sky.larghezza - meta, p.px)), p.py - (pos.radiante ? 32 : 36));
    ctx.shadowBlur = 0;
  });
  ctx.restore();
}

// Cosa c'è sotto al dito. Si prova prima con gli astri dell'elenco (sono
// quelli che si cercano), poi con il deep sky, infine con le stelle delle
// figure: il bersaglio è generoso, perché un dito copre venti pixel.
function skyOggettoNelPunto(px, py) {
  const base = sky.ultimaBase, focale = sky.ultimaFocale;
  if (!base || !focale) return null;

  let scelto = null;
  const guarda = (az, alt, soglia, crea) => {
    if (typeof az !== 'number') return;
    const p = skyProietta(skyVettore(az, alt), base, focale);
    if (!p.davanti) return;
    const d = Math.hypot(p.px - px, p.py - py);
    if (d > soglia) return;
    if (!scelto || d < scelto.d) scelto = { d, sel: crea() };
  };

  skyOggettiDaDisegnare().forEach(o =>
    guarda(o.az, o.alt, Math.max(24, skyRaggio(o, focale) + 16), () => ({ categoria: 'astro', id: o.id })));
  if (scelto) return scelto.sel;

  sky.profondo.forEach(o =>
    guarda(o.az, o.alt, 22, () => ({
      categoria: 'profondo',
      dati: SKY_PROFONDO.find(x => x.nome === o.nome) || o
    })));
  if (scelto) return scelto.sel;

  if (sky.mostraCostellazioni) {
    sky.costellazioni.forEach(c => c.stelle.forEach(s =>
      guarda(s.az, s.alt, 18, () => ({
        categoria: 'figura',
        dati: Object.assign({ costellazioneFigura: c.nome, disegno: 'stella' }, s)
      }))));
  }
  return scelto ? scelto.sel : null;
}

// =====================================================================
// 7.4-ter MOVIMENTI MORBIDI
//   Il cielo vero non fa scatti. Un planetario che invece li fa — il campo
//   che salta di colpo a ogni tocco dello zoom, la vista che si pianta di
//   netto appena il dito lascia lo schermo — non sembra un cielo, sembra un
//   grafico che si aggiorna. E c'è di più di un vezzo: guardando un cielo
//   che si sposta a scatti si perde ogni volta il filo di dove si era, e si
//   deve ricominciare a cercare l'astro da capo.
//
//   Qui stanno le tre cose che rendono continuo quello che prima era a
//   gradini: l'inerzia del trascinamento (la vista continua a scorrere e si
//   ferma da sé), lo zoom che ci scivola dentro invece di saltarci, e il dt
//   del fotogramma, che tiene tutto questo uguale a venti come a centoventi
//   fotogrammi al secondo.
//
//   Tutti smorzamenti sono esponenziali con costante di tempo: `tau` è il
//   tempo in cui resta un terzo di quello che c'era. È la stessa forma del
//   filtro anti-tremolio della bussola (sezione 7), ed è l'unica che si
//   comporta uguale a qualunque cadenza di fotogrammi.
// =====================================================================

// Quanto tempo è passato dal fotogramma precedente, in secondi. Tosato a un
// decimo: dopo un fotogramma perso, o tornando da un'altra scheda, un dt
// enorme farebbe fare all'inerzia un balzo di mezzo cielo.
function skyDeltaFotogramma() {
  const ora = performance.now();
  const prec = sky.ultimoFotogramma || ora;
  sky.ultimoFotogramma = ora;
  return Math.min(0.1, Math.max(0, (ora - prec) / 1000));
}

// --- Lo zoom che ci scivola dentro ---
// Il campo si stringe e si allarga per rapporti, non per differenze: da 40°
// a 20° è lo stesso gesto che da 2° a 1°. Per questo l'avvicinamento si fa
// sul logaritmo del campo — così il cielo cresce a velocità costante — e non
// sul campo stesso, che partirebbe a razzo per poi strisciare all'arrivo.
const SKY_TAU_ZOOM = 0.13;      // secondi: sotto sembra uno scatto, sopra una melassa

function skyMuoviZoom(dt) {
  const voluto = sky.fovVoluto;
  if (!voluto || !dt) return;
  if (!(sky.fov > 0)) { sky.fov = voluto; return; }
  const scarto = Math.log(voluto / sky.fov);
  // Arrivati a un millesimo si posa esattamente sul valore voluto: se no il
  // campo resterebbe per sempre a inseguirlo per cifre invisibili
  if (Math.abs(scarto) < 0.001) { sky.fov = voluto; return; }
  sky.fov = sky.fov * Math.exp(scarto * (1 - Math.exp(-dt / SKY_TAU_ZOOM)));
}

// --- L'inerzia del trascinamento ---
// Chi spinge il cielo con il dito si aspetta che continui: è il gesto che fa
// ogni mappa e ogni elenco da quindici anni a questa parte. Senza, per
// attraversare il cielo bisogna trascinare cinque volte di fila, e ogni volta
// la vista si inchioda a metà strada.
//
// La velocità non si prende dall'ultimo spostamento — un solo evento di
// puntatore è rumore puro, e basta un dito che si ferma un istante prima di
// staccarsi per lanciare il cielo dalla parte sbagliata — ma da una media
// pronta degli ultimi centesimi di secondo.
const SKY_TAU_LANCIO = 0.06;    // memoria della media che misura quanto corre il dito
const SKY_TAU_INERZIA = 0.45;   // in quanto tempo la corsa si spegne
const SKY_LANCIO_SCADUTO = 90;  // ms: dito fermo più di così, nessun lancio
const SKY_INERZIA_MAX_SCHERMI = 4;   // schermate al secondo: oltre è un cielo impazzito
const SKY_INERZIA_MINIMA = 0.02;     // schermate al secondo: sotto, si è fermo

// Quanto corre la vista, in schermate al secondo. In gradi non si potrebbe
// dire: dieci gradi al secondo sono un lento panoramico a campo largo e un
// cielo che scappa via a un quarto di grado di campo. E i gradi di azimut
// vanno prima riportati a gradi di cielo, che in alto valgono meno.
function skySchermateAlSecondo(vAz, vAlt) {
  const stretta = Math.max(0.25, Math.cos(sky.manuale.alt * SKY_D2R));
  return Math.hypot(vAz * stretta, vAlt) / Math.max(0.0001, sky.fov);
}

// Un pixel di dito quanti gradi di azimut vale. Vicino allo zenit molti di
// più: un grado di azimut, lassù, è un pezzetto di cielo grande quanto il suo
// coseno. Senza compensare, più si guarda in alto più il cielo si incolla e
// il dito gli scivola sopra — proprio dove si guarda quando un astro è al
// culmine. Il fattore si tosa a quattro: agli ultimi gradi diventerebbe
// infinito e basterebbe un tremito per far girare la volta su se stessa.
function skyGradiAzPerPixel() {
  const gradiPerPixel = sky.fov / Math.max(1, sky.altezza);
  const compensa = Math.min(4, 1 / Math.max(0.25, Math.cos(sky.manuale.alt * SKY_D2R)));
  return gradiPerPixel * compensa;
}

// Il dito ha spostato la vista: si tiene nota di quanto sta correndo, per
// poterla lasciare andare quando si stacca.
function skyRicordaTrascinamento(dAz, dAlt) {
  const ora = performance.now();
  const prec = sky.trascinamento;
  const dt = prec ? Math.max(0.004, Math.min(0.1, (ora - prec.quando) / 1000)) : 0;
  if (!dt) {
    sky.trascinamento = { vAz: 0, vAlt: 0, quando: ora };
    return;
  }
  const k = 1 - Math.exp(-dt / SKY_TAU_LANCIO);
  sky.trascinamento = {
    vAz: prec.vAz + (dAz / dt - prec.vAz) * k,
    vAlt: prec.vAlt + (dAlt / dt - prec.vAlt) * k,
    quando: ora
  };
}

// Il dito si stacca: se stava ancora correndo, la vista prosegue da sola.
function skyLanciaVista() {
  const t = sky.trascinamento;
  sky.trascinamento = null;
  if (!t || sky.inseguimento || skyUsaSensori()) return;
  if (performance.now() - t.quando > SKY_LANCIO_SCADUTO) return;   // dito fermo prima di staccarsi

  const vSchermi = skySchermateAlSecondo(t.vAz, t.vAlt);
  if (vSchermi < SKY_INERZIA_MINIMA) return;
  const freno = vSchermi > SKY_INERZIA_MAX_SCHERMI ? SKY_INERZIA_MAX_SCHERMI / vSchermi : 1;
  sky.inerzia = { vAz: t.vAz * freno, vAlt: t.vAlt * freno };
}

// Un passo dell'inerzia, a ogni fotogramma
function skyScorriPerInerzia(dt) {
  const i = sky.inerzia;
  if (!i) return;
  if (!dt || skyUsaSensori() || sky.inseguimento || sky.animazioneVista) { sky.inerzia = null; return; }

  sky.manuale.az = ((sky.manuale.az + i.vAz * dt) % 360 + 360) % 360;
  sky.manuale.alt = Math.max(-89, Math.min(89, sky.manuale.alt + i.vAlt * dt));

  const smorza = Math.exp(-dt / SKY_TAU_INERZIA);
  i.vAz *= smorza;
  i.vAlt *= smorza;

  // Sotto il cinquantesimo di schermata al secondo il movimento non si vede
  // più: meglio posarsi che restare a strisciare per sempre
  if (skySchermateAlSecondo(i.vAz, i.vAlt) < SKY_INERZIA_MINIMA) sky.inerzia = null;
}

// Chi tocca comanda: qualunque movimento in corso si ferma qui
function skyFermaMovimenti() {
  sky.inerzia = null;
  sky.animazioneVista = null;
}

// Porta al centro della mappa l'oggetto scelto, con uno spostamento morbido
// (uno scatto secco fa perdere l'orientamento). Con i sensori accesi la
// mappa la punta il telefono: lì si può solo dire da che parte girarsi.
function skyCentraSu(o, opzioni = {}) {
  if (!o || typeof o.az !== 'number') return;

  if (skyUsaSensori()) {
    // Il telefono sta puntando: la mappa non si può spostare da qui, ma si
    // può dire da che parte girarsi (e come sganciare la vista, se preferisce)
    skyAvviso('centratura', `${o.nome} sta verso ${skyNomeDirezione(o.az)}, a ${Math.round(o.alt)}° di altezza: ` +
      'girati da quella parte e segui la freccia azzurra. Se preferisci muovere la mappa col dito, ' +
      'spegni “Segui il telefono”.', 9000);
    return;
  }

  const az = ((o.az % 360) + 360) % 360;
  const alt = Math.max(-85, Math.min(85, o.alt));
  sky.inerzia = null;      // una corsa in corso porterebbe via dal bersaglio
  if (opzioni.subito) {
    sky.animazioneVista = null;
    sky.manuale.az = az;
    sky.manuale.alt = alt;
    return;
  }
  // Si gira dalla parte più corta: da 350° a 10° sono venti gradi, non 340
  const giro = ((az - sky.manuale.az + 540) % 360) - 180;
  const dAlt = alt - sky.manuale.alt;
  // Quanto cielo c'è davvero da attraversare (l'azimut conta meno in alto,
  // dove i meridiani si stringono): un ritocco di dieci gradi e un mezzo giro
  // della volta non possono durare uguale. Sotto il terzo di secondo il
  // movimento non si legge, sopra il secondo si aspetta.
  const distanza = Math.hypot(giro * Math.max(0.25, Math.cos((sky.manuale.alt + alt) / 2 * SKY_D2R)), dAlt);
  sky.animazioneVista = {
    az0: sky.manuale.az, alt0: sky.manuale.alt,
    dAz: giro, dAlt,
    inizio: performance.now(),
    durata: Math.max(320, Math.min(1100, 260 + distanza * 6))
  };
}

// ---------------------------------------------------------------------
// Inseguimento
//   "Centra" porta l'oggetto in mezzo allo schermo una volta sola: dopo un
//   minuto la rotazione della Terra lo ha già spostato di un quarto di grado,
//   e con il playback acceso a mille volte il tempo vero se ne va dal campo in
//   pochi secondi. L'inseguimento tiene il timone da solo: a ogni fotogramma
//   rimette lo sguardo sull'oggetto scelto, così quello resta immobile al
//   centro e a muoversi è tutto il resto del cielo — che è esattamente ciò che
//   fa una montatura motorizzata, e il modo più chiaro per capire cosa vedrà
//   l'oculare durante la serata.
// ---------------------------------------------------------------------

// L'oggetto "scelto adesso": prima quello di cui è aperta la scheda, poi
// l'astro acceso nell'elenco. Sono i due modi di dire "questo qui".
function skyOggettoScelto() {
  const voce = skyVoceSelezionata();
  if (voce && typeof voce.az === 'number') return voce;
  if (sky.target) {
    const o = skyVoceDiId(sky.target);
    if (o && typeof o.az === 'number') return o;
  }
  return voce || null;
}

function skyAlternaInseguimento() {
  const acceso = !sky.inseguimento;
  const o = skyOggettoScelto();

  if (acceso && !o) {
    skyAvviso('inseguimento', 'Prima scegli cosa inseguire: toccalo sulla mappa, o prendilo dall\'elenco degli astri.', 7000);
    return;
  }

  sky.inseguimento = acceso;
  skyAggiornaTastoInsegui();

  if (!acceso) {
    skyAvviso('inseguimento', '');
    return;
  }

  // Con i sensori accesi la direzione la decide il telefono: nessun calcolo
  // può spostare la vista, quindi lo diciamo invece di fingere che funzioni
  if (skyUsaSensori()) {
    skyAvviso('inseguimento', `Per inseguire ${o.nome} la mappa deve poter essere spostata: ` +
      'spegni “Segui il telefono” e l\'inseguimento parte subito.', 9000);
    return;
  }

  skyFermaMovimenti();
  skyCentraSu(o, { subito: true });
  skyAvviso('inseguimento', `${o.nome} resta al centro della mappa: la vista lo segue da sola. ` +
    'Trascinando il cielo col dito l\'inseguimento si spegne.', 7000);
}

// Un passo dell'inseguimento, a ogni fotogramma. Niente spostamento morbido:
// qui l'oggetto non deve arrivare al centro, deve non allontanarsene mai.
function skyInsegui() {
  if (!sky.inseguimento) return;
  if (skyUsaSensori()) return;      // la vista la punta il telefono
  const o = skyOggettoScelto();
  if (!o || typeof o.az !== 'number') return;
  skyFermaMovimenti();
  sky.manuale.az = ((o.az % 360) + 360) % 360;
  sky.manuale.alt = Math.max(-89, Math.min(89, o.alt));
}

// Chi trascina il cielo vuole guardare da un'altra parte: l'inseguimento che
// riporta la vista indietro a ogni fotogramma sarebbe una mappa che non
// risponde più al dito.
function skySpegniInseguimento(motivo) {
  if (!sky.inseguimento) return;
  sky.inseguimento = false;
  skyAggiornaTastoInsegui();
  if (motivo) skyAvviso('inseguimento', motivo, 5000);
  else skyAvviso('inseguimento', '');
}

function skyAggiornaTastoInsegui() {
  skyTasto('skymap-btn-insegui', sky.inseguimento, sky.inseguimento ? 'Insegue' : 'Insegui');
  // Il gemello sulla mappa: stessa cosa, senza parole. Il testo qui non c'è
  // (è un bersaglio disegnato), quindi lo stato lo dicono il colore e il
  // suggerimento — che deve cambiare, o resterebbe a promettere di accendere
  // qualcosa che è già acceso.
  skyTasto('skymap-btn-insegui-mappa', sky.inseguimento);
  const mappa = document.getElementById('skymap-btn-insegui-mappa');
  if (mappa) {
    mappa.title = sky.inseguimento
      ? 'Smetti di inseguire: la vista torna libera'
      : 'Tieni al centro l\'oggetto scelto: la vista lo segue da sola';
    mappa.setAttribute('aria-label', sky.inseguimento ? 'Smetti di inseguire' : 'Insegui l\'oggetto scelto');
  }
}

// Un passo dello spostamento morbido, chiamato a ogni fotogramma
function skyMuoviVista() {
  const a = sky.animazioneVista;
  if (!a) return;
  const k = Math.min(1, (performance.now() - a.inizio) / a.durata);
  // Partenza e arrivo rallentati, il tratto in mezzo veloce. La curva è
  // quella "liscia due volte": parte e arriva non solo con velocità nulla ma
  // anche senza strappo. Con la parabola di prima l'accelerazione compariva
  // di colpo al primo fotogramma, e a forte ingrandimento quel piccolo
  // strattone iniziale si vedeva tutto.
  const e = k * k * k * (k * (6 * k - 15) + 10);
  sky.manuale.az = ((a.az0 + a.dAz * e) % 360 + 360) % 360;
  sky.manuale.alt = a.alt0 + a.dAlt * e;
  if (k >= 1) sky.animazioneVista = null;
}

// Sgancia (o riattacca) la vista dal telefono. Sganciandola, la mappa parte
// esattamente da dove si stava guardando: se saltasse a un'altra direzione si
// perderebbe il filo di quello che si aveva davanti.
function skyAlternaSeguiTelefono() {
  const nuovo = !sky.seguiTelefono;
  if (!nuovo) {
    const base = sky.ultimaBase;
    if (base) {
      sky.manuale.alt = Math.asin(Math.max(-1, Math.min(1, base.f[2]))) * SKY_R2D;
      sky.manuale.az = ((Math.atan2(base.f[0], base.f[1]) * SKY_R2D) % 360 + 360) % 360;
    }
    sky.calibrazione = false;
    skyAggiornaTastoCalibrazione();
  }
  sky.seguiTelefono = nuovo;
  skyFermaMovimenti();
  // Riattaccando la vista al telefono l'inseguimento non ha più niente da
  // guidare: meglio spegnerlo che lasciare acceso un tasto che non fa nulla
  if (nuovo && sky.sensori) skySpegniInseguimento();
  skyTasto('skymap-btn-segui', nuovo);
  skyAggiornaStato();

  // Con la fotocamera accesa sganciare la vista stacca il cielo dall'immagine:
  // non è più realtà aumentata, è una mappa sopra uno sfondo.
  if (sky.camera && sky.sensori) {
    skyAvviso('camera', nuovo ? '' :
      'Vista sganciata: il cielo disegnato non sta più sopra quello che inquadri.');
  }

  if (!sky.sensori) {
    skyAvviso('centratura', 'Bussola e giroscopio non sono attivi: la mappa la muovi già col dito.', 7000);
  } else {
    skyAvviso('centratura', nuovo
      ? 'La mappa torna a seguire il telefono: muovilo per guardarti intorno.'
      : 'Vista sganciata dal telefono: ora la mappa la muovi col dito, e “Centra” funziona.', 7000);
  }
}

// Guarda verso un punto cardinale, o su per aria: sul computer non c'è una
// bussola che punti al posto tuo, e trascinare fino a Nord è una fatica.
function skyGuardaVerso(verso) {
  if (skyUsaSensori()) {
    skyAvviso('centratura', 'Con bussola e giroscopio accesi la direzione la decide il telefono: ' +
      'girati verso dove vuoi guardare, oppure spegni “Segui il telefono”.', 9000);
    return;
  }
  if (verso === 'zenit') {
    skyCentraSu({ nome: 'lo zenit', az: sky.manuale.az, alt: 85 });
    return;
  }
  skyCentraSu({ nome: skyNomeDirezione(verso), az: verso, alt: 25 });
}

// Apre il cielo in diretta puntato su una stazione spaziale
window.cercaSatelliteNelCielo = (satId) => {
  cercaNelCielo('sat-' + satId);
  satPrecaricaTle();
};

// =====================================================================
// 7.4-quater AVVIO, CICLO E GESTI DELLA VISTA
//   Da qui la vista prende vita: i permessi e la posizione all'avvio, il
//   ciclo di disegno che gira solo finché il planetario è a schermo, e le
//   dita — trascinamento, pizzico, tocco secco sull'oggetto. Chi cerca il
//   comportamento dei movimenti (inerzia, zoom morbido) lo trova invece
//   nella sezione 7.4-ter: qui ci sono solo i gesti che lo mettono in moto.
// =====================================================================

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

  // La geolocalizzazione può metterci qualche secondo: intanto lo diciamo.
  // Se il GPS non risponde si scende di strato (rete, poi scelta a mano):
  // meglio un cielo approssimato che una vista vuota.
  if (!sky.observer) skyAvviso('posizione', 'Sto cercando la tua posizione…');
  const esito = await trovaPosizioneAStrati();
  if (esito.esito === 'gps') {
    skyAvviso('posizione', '');
  } else if (esito.esito === 'rete') {
    skyAvviso('posizione', 'Posizione approssimata, dedotta dalla connessione: per il puntamento fine ' +
      'conviene sceglierla a mano dal tasto della posizione, nella scheda Stasera.');
  } else if (sky.observer || skyCaricaPosizioneSalvata()) {
    skyAvviso('posizione', '');
  } else {
    skyAvviso('posizione', 'Posizione non disponibile: senza di essa non posso sapere cosa hai sopra la testa. ' +
      'Scegli la tua città dal tasto della posizione, nella scheda Stasera: funziona anche senza permessi.');
  }

  // Il permesso è appena stato chiesto: ora la sorveglianza può partire
  if (esito.esito === 'gps') skySorvegliaPosizione(true);
  skyAggiornaStato();
  skyAggiornaOggetti(true);
  if (esito.esito === 'gps' || esito.esito === 'rete') posDopoCambio();
  else aggiornaTastiPosizione();
}

// Ciclo di disegno: gira solo quando il planetario è a schermo
function skyCiclo() {
  if (!sky.aperto) return;
  // Quanto è durato il fotogramma precedente: lo chiedono lo zoom morbido e
  // l'inerzia, che devono comportarsi uguale a qualunque cadenza (vedi 7.4-ter)
  const dt = skyDeltaFotogramma();
  skyAvanzaPlayback();
  skyAggiornaOggetti(false);
  skyMuoviSatelliti();
  skyMuoviZoom(dt);
  skyScorriPerInerzia(dt);
  skyMuoviVista();
  // L'inseguimento parla per ultimo: qualunque cosa abbiano deciso il
  // playback o lo spostamento morbido, l'oggetto scelto torna al centro
  skyInsegui();
  skyDisegna();
  sky.raf = requestAnimationFrame(skyCiclo);
}

function apriSkymap() {
  if (sky.aperto) return;
  sky.aperto = true;
  skyCostruisciElenco();
  skyRidimensiona();
  if (!sky.observer) skyCaricaPosizioneSalvata();
  satPrecaricaTle();
  skySorvegliaPosizione();
  skyAggiornaStato();
  skyAggiornaOggetti(true);
  skyTieniSchermoAcceso();
  // Il primo fotogramma non eredita né il tempo né la corsa di quando la
  // vista è stata chiusa: il cielo riparte fermo, da dove lo si era lasciato
  sky.ultimoFotogramma = 0;
  sky.inerzia = null;
  sky.trascinamento = null;
  sky.fovVoluto = sky.fov;
  sky.raf = requestAnimationFrame(skyCiclo);
}

function chiudiSkymap() {
  if (!sky.aperto) return;
  sky.aperto = false;
  if (sky.raf) cancelAnimationFrame(sky.raf);
  sky.raf = null;
  // Il playback non deve sopravvivere alla vista: tornando qui domani il
  // cielo ripartirebbe da un istante che nessuno ha più in mente
  skyFermaPlayback();
  skySmettiDiSorvegliare();
  skyRilasciaSchermo();
  // Una registrazione in corso muore qui: senza il cielo davanti non ci sono
  // più fotogrammi da prendere, e il risultato non avrebbe dove farsi vedere
  skyRegFerma({ annulla: true });
  skyRegChiudiPannello();
  skyRegDimenticaEsito();
  // Uscendo dalla vista non si può restare a schermo intero: resterebbe una
  // mappa ferma sopra tutta la pagina
  skyEsciSchermoIntero();
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

function skyZoom(fattore, opzioni = {}) {
  // Sopra l'immagine della fotocamera ingrandire il cielo da solo lo
  // scollerebbe dal mondo: lì lo stesso gesto tara l'obiettivo.
  if (skyCampoDaObiettivo()) { skyTaraCampoFotocamera((sky.cameraCampo || sky.fov) * fattore); return; }
  // Il fattore si applica a dove lo zoom sta andando, non a dov'è arrivato:
  // due tocchi di fila sul + devono valere due passi interi, anche se il
  // primo non ha ancora finito di scivolare
  skyImpostaFov((opzioni.morbido ? sky.fovVoluto || sky.fov : sky.fov) * fattore, opzioni);
}

// Trascinamento: in manuale ci si guarda intorno, con i sensori si calibra la
// bussola. Un tocco secco, invece, apre la scheda dell'oggetto che sta lì
// sotto; e con il mouse il doppio clic entra ed esce dallo schermo intero.
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
    // Il pizzico parte dal campo che si ha davanti adesso, e ferma sul posto
    // lo zoom morbido ancora in viaggio: da qui in poi comandano le dita
    if (sky.puntatori.size === 2) {
      sky.fovVoluto = sky.fov;
      sky.pizzico = { distanza: distanzaPuntatori(), fov: sky.fov };
    }
    // Il doppio clic si accetta solo dal mouse: sul touch il doppio tocco è
    // già preso dallo zoom del sistema, e rubarglielo confonde le dita
    sky.ultimoPuntatore = e.pointerType || 'mouse';
    // Chi tocca comanda: lo spostamento morbido verso un oggetto e la corsa
    // per inerzia si fermano qui, sotto il dito
    skyFermaMovimenti();
    sky.trascinamento = null;
    // Da qui si capirà se è stato un tocco (per aprire la scheda) o un
    // trascinamento (per guardarsi intorno)
    sky.tocco = { id: e.pointerId, x: e.clientX, y: e.clientY, quando: performance.now(), mosso: false };
  });

  c.addEventListener('pointermove', (e) => {
    const prec = sky.puntatori.get(e.pointerId);
    if (!prec) return;
    const dx = e.clientX - prec.x;
    const dy = e.clientY - prec.y;
    sky.puntatori.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (sky.tocco && sky.tocco.id === e.pointerId &&
        Math.hypot(e.clientX - sky.tocco.x, e.clientY - sky.tocco.y) > 8) {
      sky.tocco.mosso = true;
    }

    if (sky.puntatori.size === 2 && sky.pizzico) {
      const d = distanzaPuntatori();
      if (d > 0) {
        const voluto = sky.pizzico.fov * sky.pizzico.distanza / d;
        // Con la fotocamera accesa il pizzico non ingrandisce: tara
        if (skyCampoDaObiettivo()) skyTaraCampoFotocamera(voluto);
        else skyImpostaFov(voluto);
      }
      return;
    }

    const gradiPerPixel = sky.fov / Math.max(1, sky.altezza);
    if (skyUsaSensori()) {
      sky.trascinamento = null;   // qui il dito non muove il cielo: niente da lanciare
      // Con i sensori attivi il cielo lo punta il telefono, non il dito: qui
      // il trascinamento può solo correggere la bussola, e solo se la
      // correzione è stata chiesta apposta. Prima bastava sfiorare il cielo —
      // per esempio provando a scorrere la pagina — per ruotarlo di decine di
      // gradi, e quella rotazione restava salvata anche alle aperture
      // successive: il cielo risultava storto senza che si capisse perché.
      if (sky.calibrazione) skyImpostaOffsetBussola(sky.offsetBussola - dx * gradiPerPixel);
    } else {
      // Il dito ha la precedenza sull'inseguimento: se no la vista tornerebbe
      // indietro da sola a ogni fotogramma
      if (sky.inseguimento && (dx || dy)) {
        skySpegniInseguimento('Inseguimento spento: stai muovendo la mappa col dito.');
      }
      // In azimut un pixel non vale sempre lo stesso: verso lo zenit vale di
      // più (vedi skyGradiAzPerPixel). Così il pezzo di cielo preso sotto al
      // dito ci resta anche guardando in alto, invece di scivolare via.
      const dAz = -dx * skyGradiAzPerPixel();
      const dAlt = dy * gradiPerPixel;
      sky.manuale.az = ((sky.manuale.az + dAz) % 360 + 360) % 360;
      const altPrima = sky.manuale.alt;
      sky.manuale.alt = Math.max(-89, Math.min(89, sky.manuale.alt + dAlt));
      // Contro il fermo dei ±89° la corsa non deve accumularsi, se no
      // staccando il dito la vista partirebbe di lato senza motivo
      skyRicordaTrascinamento(dAz, sky.manuale.alt - altPrima);
    }
  });

  // Tocco secco su un oggetto: si apre la sua scheda. Un tocco nel vuoto la
  // chiude, che è il gesto che tutti provano per primo.
  const forseTocco = (e) => {
    const t = sky.tocco;
    if (!t || t.id !== e.pointerId) return;
    sky.tocco = null;
    if (t.mosso || sky.puntatori.size > 1) return;
    if (performance.now() - t.quando > 600) return;

    const r = c.getBoundingClientRect();
    const sel = skyOggettoNelPunto(e.clientX - r.left, e.clientY - r.top);
    if (!sel) { skyChiudiDettaglio(); return; }
    if (sel.categoria === 'astro') {
      // Toccarlo sulla mappa vale come sceglierlo dall'elenco, ma senza
      // spostare la vista: è già sotto il dito
      sky.target = sel.id;
      sky.cacheOrari = { chiave: null, valore: null };
      skyAggiornaStileElenco();
    }
    skyApriDettaglio(sel);
  };

  // Il dito se ne va. Se era l'ultimo rimasto e stava ancora spingendo il
  // cielo, la vista prosegue da sola e si spegne (vedi 7.4-ter); se ne resta
  // un altro appoggiato — la fine di un pizzico — il trascinamento riparte
  // da lì, e la corsa di prima non c'entra più nulla.
  const finePuntatore = (e, lancia) => {
    sky.puntatori.delete(e.pointerId);
    if (sky.puntatori.size < 2) sky.pizzico = null;
    if (sky.puntatori.size > 0) { sky.trascinamento = null; return; }
    if (lancia) skyLanciaVista();
    else sky.trascinamento = null;
  };
  c.addEventListener('pointerup', (e) => { forseTocco(e); finePuntatore(e, true); });
  c.addEventListener('pointercancel', (e) => { sky.tocco = null; finePuntatore(e); });
  c.addEventListener('pointerleave', (e) => finePuntatore(e));

  // Doppio clic: entra e esce dallo schermo intero. Solo col mouse — sul
  // touch il doppio tocco resta libero per lo zoom e la navigazione.
  c.addEventListener('dblclick', (e) => {
    if (sky.ultimoPuntatore === 'touch' || sky.ultimoPuntatore === 'pen') return;
    e.preventDefault();
    skyAlternaSchermoIntero();
  });

  // La rotellina. Prima ogni evento valeva uno scatto tondo del 10%, in un
  // verso o nell'altro: sul mouse andava bene, sul trackpad no — lì gli
  // eventi arrivano a decine al secondo con spostamenti di pochi pixel, e il
  // cielo partiva a razzo al primo sfioramento. Adesso conta quanto è girata
  // davvero: uno scatto di mouse (deltaY 100) vale ancora il 10%, un
  // millimetro di dito sul trackpad vale la sua frazione. Il campo poi ci
  // scivola dentro invece di saltarci (vedi 7.4-ter).
  c.addEventListener('wheel', (e) => {
    e.preventDefault();
    // deltaMode dice in che unità è deltaY: pixel, righe o schermate
    const pixel = e.deltaMode === 1 ? e.deltaY * 16 : (e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY);
    const scatti = Math.max(-4, Math.min(4, pixel / 100));
    if (!scatti) return;
    skyZoom(Math.exp(scatti * 0.0953), { morbido: true });   // e^0.0953 = 1.1
  }, { passive: false });
}

// Il tasto dice se il trascinamento sul cielo sta ritoccando la bussola
function skyAggiornaTastoCalibrazione() {
  skyTasto('skymap-btn-calibra', sky.calibrazione,
    sky.calibrazione ? 'Fine calibrazione' : 'Calibra');
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

  // Taratura dell'obiettivo: se questo telefono l'ha già fatta, si riparte da lì
  const camera = parseFloat(localStorage.getItem(CHIAVE_SKY_CAMERA));
  if (!isNaN(camera)) {
    sky.cameraCampoLato = Math.max(SKY_CAMERA_LATO_MIN, Math.min(SKY_CAMERA_LATO_MAX, camera));
  }

  // Costellazioni, deep sky, macchina del tempo e fotocamera
  inizializzaSkymapExtra();
  // I comandi della registrazione (vedi 7.6)
  skyRegInizializza();
  // Il luogo da cui si guarda, dentro il pannello Tempo (vedi 7.1-ter)
  skyInizializzaLuogoVista();

  const collega = (id, azione) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', azione);
  };

  collega('skymap-btn-avvia', () => skyAvvia(true));
  collega('skymap-btn-manuale', () => skyAvvia(false));
  // I due tasti dello zoom stanno sull'angolo della mappa, sempre a portata:
  // dentro al pannello Navigazione erano un doppione degli stessi comandi
  // Un tocco vale il 40% del campo: da 55° si arriva sulla Luna ingrandita in
  // una dozzina di tocchi, invece che in venticinque. La rotellina e il
  // pizzico restano più fini, che lì la precisione è del polso.
  collega('skymap-zoom-in', () => skyZoom(1 / 1.4, { morbido: true }));
  collega('skymap-zoom-out', () => skyZoom(1.4, { morbido: true }));
  collega('skymap-btn-campo', () => {
    // Con la fotocamera accesa "campo normale" vuol dire togliere la taratura
    // fatta a mano e tornare all'obiettivo tipico
    if (skyCampoDaObiettivo()) {
      sky.cameraCampoLato = 0;
      try { localStorage.removeItem(CHIAVE_SKY_CAMERA); } catch (e) { /* niente storage */ }
      skySincronizzaCampoFotocamera();
      skyAvviso('camera-taratura', 'Taratura della fotocamera azzerata.', 3000);
      return;
    }
    // Tornare al campo normale da un quarto di grado è un balzo di duecento
    // volte: fatto di colpo si perde ogni riferimento, fatto scivolando si
    // vede il cielo allargarsi e si capisce da dove si stava venendo
    skyImpostaFov(55, { morbido: true });
  });
  collega('skymap-btn-centra', () => {
    const voce = skyOggettoScelto();
    if (voce) skyCentraSu(voce);
    else skyAvviso('centratura', 'Prima scegli un oggetto: dall\'elenco qui sotto, o toccandolo sulla mappa.', 7000);
  });
  collega('skymap-btn-insegui', skyAlternaInseguimento);
  collega('skymap-btn-insegui-mappa', skyAlternaInseguimento);
  // Il Sistema Solare visto da fuori (sezione 7.7): sta in fondo al pannello
  // degli astri, subito sotto l'elenco da cui si sceglie il pianeta
  collega('skymap-btn-sistema', () => apriSistemaSolare());
  skyAggiornaTastoInsegui();
  document.querySelectorAll('#cielo-comandi [data-verso]').forEach(b => {
    b.addEventListener('click', () => {
      const v = b.dataset.verso;
      skyGuardaVerso(v === 'zenit' ? 'zenit' : (parseInt(v, 10) || 0));
    });
  });
  collega('skymap-btn-segui', skyAlternaSeguiTelefono);
  collega('skymap-cal-meno', () => skyImpostaOffsetBussola(sky.offsetBussola - 5));
  collega('skymap-cal-piu', () => skyImpostaOffsetBussola(sky.offsetBussola + 5));
  collega('skymap-cal-zero', () => skyImpostaOffsetBussola(0));
  collega('skymap-btn-calibra', () => {
    sky.calibrazione = !sky.calibrazione;
    skyAggiornaTastoCalibrazione();
  });
  skyAggiornaTastoCalibrazione();

  // La scheda dell'oggetto si chiude col suo ✕
  collega('skymap-dettaglio-chiudi', skyChiudiDettaglio);

  // I filtri della mappa
  const filtro = (id, campo) => collega(id, () => {
    sky[campo] = !sky[campo];
    skyAggiornaTastiFiltri();
    skyAggiornaOggetti(true);
  });
  filtro('skymap-btn-pianeti', 'mostraPianeti');
  filtro('skymap-btn-solelun', 'mostraSoleLuna');
  filtro('skymap-btn-stelle', 'mostraStelle');
  filtro('skymap-btn-satelliti', 'mostraSatelliti');
  filtro('skymap-btn-sotto', 'mostraSottoOrizzonte');
  filtro('skymap-btn-griglia', 'mostraGriglia');
  filtro('skymap-btn-etichette', 'mostraNomi');
  filtro('skymap-btn-vialattea', 'mostraViaLattea');
  filtro('skymap-btn-atmosfera', 'atmosfera');
  // I segni degli eventi si accendono e si spengono senza rifare i conti
  // delle posizioni: cambia solo cosa viene disegnato
  collega('skymap-btn-eventi', () => {
    sky.mostraEventi = !sky.mostraEventi;
    skyAggiornaTastiFiltri();
  });
  // Anche la traccia è solo disegno: la sua curva si ricalcola da sé al
  // prossimo fotogramma, e spegnendola sparisce senza rifare nessun conto
  collega('skymap-btn-traccia', () => {
    sky.mostraTraccia = !sky.mostraTraccia;
    if (!sky.mostraTraccia) sky.traccia.punti = [];
    sky.traccia.chiave = null;
    skyAggiornaTastiFiltri();
  });
  // L'eclittica è una linea sola, ma quasi nessuno sa già cosa sia: la prima
  // volta che si accende conviene dirlo, altrimenti resta un tratteggio in più
  collega('skymap-btn-eclittica', () => {
    sky.mostraEclittica = !sky.mostraEclittica;
    sky.eclittica.chiave = null;
    if (!sky.mostraEclittica) {
      sky.eclittica.punti = [];
      sky.eclittica.mesi = [];
      sky.eclittica.scarto = null;
      skyAvviso('eclittica', '');
    } else {
      skyAvviso('eclittica', 'L\'eclittica è la strada che il Sole percorre in un anno fra le stelle: ' +
        'i puntini sono i primi del mese. I pianeti stanno sempre a pochi gradi da questa linea, ' +
        'e il filo a piombo dice quanti. L\'otto in oro pallido è l\'analemma: dov\'è il Sole ' +
        'a quest\'ora ogni giorno dell\'anno.', 14000);
    }
    skyAggiornaTastiFiltri();
  });
  // Il promemoria sopra la mappa apre l'elenco di cosa sta succedendo
  collega('skymap-eventi-chip', () => skyMostraGruppo('eventi'));
  skyAggiornaTastiFiltri();

  // Le linguette dei gruppi di comandi (telefono e tablet)
  document.querySelectorAll('#cielo-comandi [data-vai-gruppo]').forEach(b => {
    b.addEventListener('click', () => skyMostraGruppo(b.dataset.vaiGruppo));
  });
  // Sotto il cielo il tasto deve fare qualcosa al primo tocco, non aprire
  // una finestra: si prova la cascata sul posto. Solo se resta senza
  // risposta si apre la finestra, dove la posizione si può scegliere a mano.
  collega('skymap-btn-posizione', async () => {
    skyAvviso('posizione', 'Sto cercando la tua posizione…');
    // Anche questo è un gesto esplicito: chi lo preme sta chiedendo di
    // rilevarla adesso, quindi il rilevamento può sostituire una scelta.
    const esito = await trovaPosizioneAStrati(null, { forzato: true });
    if (esito.esito === 'gps') {
      skyAvviso('posizione', '');
      skySorvegliaPosizione(true);
    } else if (esito.esito === 'rete') {
      skyAvviso('posizione', 'Posizione approssimata, dedotta dalla connessione: il cielo è quello giusto ' +
        'a grandi linee, ma per i passaggi dei satelliti serve il punto esatto. Puoi sceglierlo a mano ' +
        'dalla scheda Stasera, sul tasto della posizione.');
    } else if (esito.esito === 'invariata') {
      skyAvviso('posizione', 'Non sono riuscito ad aggiornarla: resta la posizione di prima.');
    } else {
      // Niente da nessuno dei due strati automatici: la finestra si apre da
      // sé, perché lì c'è l'unica strada rimasta (e non fallisce).
      skyAvviso('posizione', 'Né GPS né rete hanno risposto: scegli il luogo nella finestra che si è aperta.');
      apriPosizione(false);
    }
    skyAggiornaOggetti(true);
    // Cambiata da qui o dalla finestra, la posizione nuova deve arrivare a
    // tutte le viste: ci pensa sempre lo stesso punto di raccordo.
    if (esito.esito === 'gps' || esito.esito === 'rete') await posDopoCambio();
    else aggiornaTastiPosizione();
  });

  collega('skymap-btn-notte', () => {
    const cont = document.getElementById('skymap-contenitore');
    if (!cont) return;
    const attiva = cont.classList.toggle('modalita-notte');
    skyTasto('skymap-btn-notte', attiva, attiva ? 'Colori normali' : 'Modalità notte');
  });

  // --- Trovare un astro senza scorrere tutto l'elenco ---
  const cercaAstri = document.getElementById('skymap-astri-cerca');
  if (cercaAstri) {
    cercaAstri.addEventListener('input', skyFiltraElenco);
    cercaAstri.addEventListener('keydown', (e) => {
      // Invio sceglie il primo rimasto: scritto "sat", il gesto dopo è
      // sempre quello, e farglielo cercare col dito è una tappa di troppo
      if (e.key === 'Enter') {
        const primo = document.querySelector('#skymap-oggetti .chip-astro[data-fuori="no"]');
        if (primo) {
          e.preventDefault();
          skyImpostaTarget(primo.dataset.astro, { mantieni: true });
        }
        return;
      }
      // Esc svuota il campo invece di uscire dallo schermo intero: qui dentro
      // "annulla" vuol dire "annulla la ricerca"
      if (e.key === 'Escape' && cercaAstri.value) {
        e.stopPropagation();
        cercaAstri.value = '';
        skyFiltraElenco();
      }
    });
  }
  collega('skymap-astri-visibili', () => {
    sky.soloAstriVisibili = !sky.soloAstriVisibili;
    skyTasto('skymap-astri-visibili', sky.soloAstriVisibili);
    skyFiltraElenco();
  });

  collega('skymap-btn-schermo', skyAlternaSchermoIntero);
  // Lo stesso comando, ma appoggiato sull'angolo della mappa: com'è per la
  // mappa dell'ombra delle eclissi, dove il ⛶ sta lì e non dentro a un
  // pannello. Andarlo a cercare fra le opzioni della Visualizzazione,
  // mentre si guarda il cielo, era una tappa di troppo.
  collega('skymap-btn-schermo-mappa', skyAlternaSchermoIntero);
  collega('skymap-btn-esci', () => skyEsciSchermoIntero());

  window.addEventListener('resize', () => { if (sky.aperto) skyRidimensiona(); });
  if (screen.orientation && screen.orientation.addEventListener) {
    screen.orientation.addEventListener('change', () => setTimeout(skyRidimensiona, 200));
  }
  skyInizializzaSchermoIntero();

  // Fuori schermo il ciclo di disegno si ferma; al ritorno riparte
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (sky.raf) cancelAnimationFrame(sky.raf);
      sky.raf = null;
      skyRilasciaSchermo();
      // Il disegno si ferma, quindi nel filmato non entrerebbe più niente:
      // la registrazione si chiude qui e si tiene quello che ha ripreso
      skyRegFerma();
    } else if (sky.aperto && !sky.raf) {
      skyTieniSchermoAcceso();
      // Il playback riprende da adesso: i minuti passati con l'app in tasca
      // non devono trasformarsi in un balzo di anni
      sky.playbackUltimo = 0;
      sky.raf = requestAnimationFrame(skyCiclo);
    }
  });
}

// Lo stato acceso/spento dei tasti dei filtri e della visualizzazione
function skyAggiornaTastiFiltri() {
  skyTasto('skymap-btn-pianeti', sky.mostraPianeti);
  skyTasto('skymap-btn-solelun', sky.mostraSoleLuna);
  skyTasto('skymap-btn-stelle', sky.mostraStelle);
  skyTasto('skymap-btn-satelliti', sky.mostraSatelliti);
  skyTasto('skymap-btn-sotto', sky.mostraSottoOrizzonte);
  skyTasto('skymap-btn-griglia', sky.mostraGriglia);
  skyTasto('skymap-btn-etichette', sky.mostraNomi);
  skyTasto('skymap-btn-costellazioni', sky.mostraCostellazioni);
  skyTasto('skymap-btn-vialattea', sky.mostraViaLattea);
  skyTasto('skymap-btn-deepsky', sky.mostraProfondo);
  skyTasto('skymap-btn-polo', sky.mostraPolo);
  skyTasto('skymap-btn-atmosfera', sky.atmosfera);
  skyTasto('skymap-btn-eventi', sky.mostraEventi);
  skyTasto('skymap-btn-traccia', sky.mostraTraccia);
  skyTasto('skymap-btn-eclittica', sky.mostraEclittica);
}

// Quale gruppo di comandi è aperto sopra la mappa: uno solo, e toccando di
// nuovo la sua linguetta si richiude. Da chiusi si vedono cinque linguette
// invece di venticinque tasti, e il cielo resta tutto in vista.
function skyMostraGruppo(nome) {
  const barra = document.getElementById('cielo-comandi');
  if (!barra) return;
  const aperto = barra.dataset.gruppoAttivo === nome ? '' : (nome || '');
  barra.dataset.gruppoAttivo = aperto;
  barra.querySelectorAll('.gruppo-comandi').forEach(s =>
    s.classList.toggle('gruppo-attivo', !!aperto && s.dataset.gruppo === aperto));
  barra.querySelectorAll('[data-vai-gruppo]').forEach(b => {
    const attiva = !!aperto && b.dataset.vaiGruppo === aperto;
    b.classList.toggle('attiva', attiva);
    b.setAttribute('aria-pressed', attiva ? 'true' : 'false');
  });
}

// =====================================================================
// 7.5 SCHERMO INTERO
//     Sul computer si entra e si esce con un doppio clic sulla mappa, con
//     Esc o col tasto Esci. Sul telefono il doppio tocco no: è il gesto
//     dello zoom, e prenderglielo rende la mappa ostile. Lì si entra dal
//     tasto e si esce dal ✕ nell'angolo, che resta sempre visibile —
//     oppure col tasto Indietro di Android, che è la prima cosa che uno
//     prova, e che senza una tappa nella cronologia butterebbe fuori
//     dall'app invece di chiudere la mappa.
//
//     Dove l'API Fullscreen non c'è (Safari su iPhone non la offre sugli
//     elementi) si ripiega su un riquadro fissato al viewport: da fuori
//     non si vede la differenza, e l'uscita è la stessa.
// =====================================================================

function skyAlternaSchermoIntero() {
  if (sky.schermoIntero) skyEsciSchermoIntero();
  else skyEntraSchermoIntero();
}

function skyEntraSchermoIntero() {
  const cont = document.getElementById('skymap-contenitore');
  if (!cont || sky.schermoIntero) return;
  sky.schermoIntero = true;
  document.body.classList.add('cielo-immersivo');

  // La tappa nella cronologia serve al gesto Indietro di Android
  if (!sky.tappaStoria) {
    try {
      history.pushState({ cieloSchermoIntero: true }, '');
      sky.tappaStoria = true;
    } catch (e) { /* senza cronologia restano il ✕ e Esc */ }
  }

  const chiedi = cont.requestFullscreen || cont.webkitRequestFullscreen;
  if (chiedi) {
    try {
      const esito = chiedi.call(cont);
      if (esito && typeof esito.catch === 'function') esito.catch(() => skyRipiegoSchermoIntero(cont));
    } catch (e) {
      skyRipiegoSchermoIntero(cont);
    }
  } else {
    skyRipiegoSchermoIntero(cont);
  }

  skyAggiornaTastiSchermo();
  setTimeout(skyRidimensiona, 90);
}

// Il ripiego tutto in CSS, per chi non ha l'API Fullscreen sugli elementi
function skyRipiegoSchermoIntero(cont) {
  if (!sky.schermoIntero) return;
  sky.fintoSchermoIntero = true;
  cont.classList.add('finto-schermo-intero');
  skyAggiornaTastiSchermo();
  skySistemaModaliSchermoIntero();
  setTimeout(skyRidimensiona, 60);
}

// `daStoria`: ci ha portato qui il tasto Indietro, quindi la tappa nella
// cronologia è già stata consumata e non va tolta un'altra volta.
function skyEsciSchermoIntero(opzioni = {}) {
  if (!sky.schermoIntero) return;
  const cont = document.getElementById('skymap-contenitore');
  sky.schermoIntero = false;
  sky.fintoSchermoIntero = false;
  if (cont) cont.classList.remove('finto-schermo-intero');
  document.body.classList.remove('cielo-immersivo');

  // Le finestre ospitate qui dentro tornano al loro posto nella pagina prima
  // che il riquadro smetta di essere a schermo intero: se restassero, si
  // ritroverebbero appese al riquadro del cielo in mezzo alla pagina
  skyRiportaModaliDalCielo();

  const esci = document.exitFullscreen || document.webkitExitFullscreen;
  const attivo = document.fullscreenElement || document.webkitFullscreenElement;
  if (attivo && esci) {
    try {
      const esito = esci.call(document);
      if (esito && typeof esito.catch === 'function') esito.catch(() => {});
    } catch (e) { /* già uscito per conto suo */ }
  }

  if (sky.tappaStoria) {
    sky.tappaStoria = false;
    if (!opzioni.daStoria) {
      try { history.back(); } catch (e) { /* niente cronologia */ }
    }
  }

  skyAggiornaTastiSchermo();
  setTimeout(skyRidimensiona, 90);
}

function skyAggiornaTastiSchermo() {
  const esci = document.getElementById('skymap-btn-esci');
  if (esci) esci.classList.toggle('visibile', sky.schermoIntero);
  skyTasto('skymap-btn-schermo', sky.schermoIntero,
    sky.schermoIntero ? 'Esci da schermo intero' : 'Schermo intero');

  // Il tasto sull'angolo della mappa. Il simbolo resta lo stesso e a dire
  // "sei dentro" è il colore: una ✕ accanto al tondo rosso della
  // registrazione si leggerebbe come "annulla il filmato", che è l'ultima
  // cosa che deve succedere premendola. Per uscire con una parola scritta
  // c'è comunque il tasto Esci nell'angolo in alto.
  const mappa = document.getElementById('skymap-btn-schermo-mappa');
  if (mappa) {
    mappa.classList.toggle('attiva', sky.schermoIntero);
    mappa.title = sky.schermoIntero
      ? 'Esci dallo schermo intero (anche con Esc)'
      : 'Il cielo a tutto schermo, con i comandi in sovrimpressione';
    mappa.setAttribute('aria-label', sky.schermoIntero ? 'Esci da schermo intero' : 'Cielo a schermo intero');
    mappa.setAttribute('aria-pressed', sky.schermoIntero ? 'true' : 'false');
  }
}

function skyInizializzaSchermoIntero() {
  // Uscita dal pieno schermo decisa dal browser (Esc, gesto di sistema):
  // qui si rimette in ordine anche il resto
  const cambio = () => {
    const attivo = document.fullscreenElement || document.webkitFullscreenElement;
    if (!attivo && sky.schermoIntero && !sky.fintoSchermoIntero) skyEsciSchermoIntero();
    // Il pieno schermo vero arriva (e se ne va) in differita: è qui che si
    // decide se le finestre aperte devono stare dentro al cielo o nella pagina
    skySistemaModaliSchermoIntero();
    setTimeout(skyRidimensiona, 80);
  };
  document.addEventListener('fullscreenchange', cambio);
  document.addEventListener('webkitfullscreenchange', cambio);

  // Esc: il browser lo gestisce da sé nel pieno schermo vero, ma nel ripiego
  // in CSS nessuno lo ascolterebbe. Se però sopra al cielo c'è aperta una
  // finestra — la lezione dell'eclittica, il Sistema Solare in 3D — l'Esc è
  // suo: chiude quella, e il pieno schermo resta com'era. Altrimenti un tasto
  // solo farebbe due cose insieme, e chi lo preme ne voleva una.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !sky.schermoIntero) return;
    if (lez.aperto || sol.aperto) return;
    skyEsciSchermoIntero();
  });

  // Il tasto (o il gesto) Indietro di Android
  window.addEventListener('popstate', () => {
    if (sky.schermoIntero) skyEsciSchermoIntero({ daStoria: true });
  });

  skyInizializzaModaliSopraIlCielo();
}

// =====================================================================
// 7.5-bis LE FINESTRE CHE SI APRONO SOPRA IL CIELO A SCHERMO INTERO
//     Dalla scheda del Sole si aprono il Sistema Solare in 3D e la lezione
//     dell'eclittica; dagli eventi la mappa dell'ombra e la simulazione.
//     Col cielo a schermo intero non se ne vedeva nessuna: si toccava il
//     tasto e non succedeva niente.
//
//     Le due ragioni sono diverse ma il rimedio è uno solo. Nel pieno
//     schermo vero il browser disegna soltanto l'elemento andato a schermo
//     intero e i suoi discendenti: le finestre, che stanno in fondo alla
//     pagina, esistono e sono aperte — semplicemente non le vede nessuno.
//     Nel ripiego in CSS (Safari su iPhone) il riquadro del cielo si incolla
//     al viewport con z-index 60, e le finestre, ferme al 50 di Tailwind, ci
//     finiscono sotto.
//
//     Quindi finché il cielo è a schermo intero le finestre aperte vanno a
//     stare *dentro* il suo riquadro, e alla chiusura tornano esattamente da
//     dove erano venute — stesso padre, stesso posto fra i fratelli. Spostare
//     un nodo non tocca né i suoi ascoltatori né il contenuto delle sue tele,
//     e la misura la prendono comunque nel `requestAnimationFrame` che segue,
//     cioè dopo il trasloco.
//
//     Nessuna finestra viene aperta o chiusa da qui: si guarda solo la classe
//     `hidden` con un MutationObserver, così vale per tutte quelle di oggi e
//     per quelle di domani, senza toccare le loro `apri…()`.
// =====================================================================

// --- Prestare un pezzo di pagina a un'altra finestra, e saperlo rimettere ---
//     Lo fanno in due: le finestre sopra al cielo a schermo intero (qui) e il
//     pannello del tempo che va a farsi vedere nel Sistema Solare (7.5-ter).
//     Si ricorda il padre *e* il fratello che veniva dopo, perché rimettere un
//     nodo in fondo al suo vecchio padre non è rimetterlo dov'era.
function skyRicordaPosto(mappa, nodo) {
  if (!mappa.has(nodo)) mappa.set(nodo, { padre: nodo.parentElement, dopo: nodo.nextElementSibling });
}

function skyRimettiAlSuoPosto(mappa, nodo) {
  const casa = mappa.get(nodo);
  if (!casa) return false;
  mappa.delete(nodo);
  if (!casa.padre) return true;
  // Il fratello di allora potrebbe non essere più lì: in quel caso in fondo
  if (casa.dopo && casa.dopo.parentElement === casa.padre) casa.padre.insertBefore(nodo, casa.dopo);
  else casa.padre.appendChild(nodo);
  return true;
}

// Dove stava ogni finestra prima di essere portata sopra al cielo
const skyModaliOspitate = new Map();
// Mentre riordiniamo cambiamo delle classi: senza questa guardia
// l'osservatore si richiamerebbe da solo
let skyModaliInRiordino = false;

// Il riquadro che tiene il pieno schermo del planetario: quello vero se il
// browser ce l'ha concesso, il ripiego incollato al viewport se no. Fuori dal
// pieno schermo — e quando a schermo intero c'è altro, per esempio la mappa
// dell'eclissi — qui non c'è niente da ospitare.
function skyGuscioSchermoIntero() {
  const cont = document.getElementById('skymap-contenitore');
  if (!cont) return null;
  const vero = document.fullscreenElement || document.webkitFullscreenElement;
  if (vero === cont) return cont;
  if (cont.classList.contains('finto-schermo-intero')) return cont;
  return null;
}

function skyOspitaModale(modale, guscio) {
  if (!modale || !guscio || modale.parentElement === guscio) return;
  skyRicordaPosto(skyModaliOspitate, modale);
  guscio.appendChild(modale);
  modale.classList.add('modale-sopra-il-cielo');
}

// Chi non è mai stato ospite esce di qui subito, e non è un dettaglio: togliere
// una classe che non c'è conta lo stesso come una modifica dell'attributo, e
// l'osservatore si sveglierebbe di nuovo — all'infinito, a pagina bloccata.
function skyRestituisciModale(modale) {
  if (!skyModaliOspitate.has(modale)) {
    if (modale.classList.contains('modale-sopra-il-cielo')) modale.classList.remove('modale-sopra-il-cielo');
    return;
  }
  modale.classList.remove('modale-sopra-il-cielo');
  skyRimettiAlSuoPosto(skyModaliOspitate, modale);
}

// Rimette d'accordo il posto di ogni finestra con lo stato del pieno schermo
function skySistemaModaliSchermoIntero() {
  if (skyModaliInRiordino) return;
  skyModaliInRiordino = true;
  try {
    const guscio = skyGuscioSchermoIntero();
    document.querySelectorAll('.velo-modale').forEach(modale => {
      const aperta = !modale.classList.contains('hidden');
      if (guscio && aperta) skyOspitaModale(modale, guscio);
      else skyRestituisciModale(modale);
    });
  } finally {
    skyModaliInRiordino = false;
  }
}

// Si esce dal pieno schermo: tutte a casa, aperte o chiuse che siano
function skyRiportaModaliDalCielo() {
  if (skyModaliInRiordino || !skyModaliOspitate.size) return;
  skyModaliInRiordino = true;
  try {
    Array.from(skyModaliOspitate.keys()).forEach(skyRestituisciModale);
  } finally {
    skyModaliInRiordino = false;
  }
}

function skyInizializzaModaliSopraIlCielo() {
  if (typeof MutationObserver !== 'function') return;
  const occhio = new MutationObserver(() => skySistemaModaliSchermoIntero());
  document.querySelectorAll('.velo-modale').forEach(modale => {
    occhio.observe(modale, { attributes: true, attributeFilter: ['class'] });
  });
}

// =====================================================================
// 7.5-ter IL PANNELLO DEL TEMPO, PRESTATO AL SISTEMA SOLARE
//     Le due barre del tempo — quella sotto al cielo e quella sotto alla
//     scena in 3D — sono la stessa barra: stessi tasti, stesso ordine,
//     stesso istante. Solo che nel planetario la lettura al centro è anche
//     una porta (si tocca e si apre il pannello "Tempo": la data scritta a
//     mano, il passo, il playback), mentre nel Sistema Solare non apriva
//     niente. Due barre gemelle di cui una sola risponde al tocco: uno ci
//     prova, non succede nulla, e smette di fidarsi anche dell'altra.
//
//     Qui non se ne fa una copia — una copia diverge al primo ritocco, e
//     avremmo due pannelli da tenere d'accordo. Si presta *quello vero*:
//     finché serve, la `section[data-gruppo="tempo"]` va a stare dentro
//     alla finestra del Sistema Solare, e alla chiusura torna al suo posto
//     fra i pannelli del cielo. Stesso nodo, stessi ascoltatori, stesso
//     stato: coerente per costruzione, non per manutenzione.
//
//     Da ospite tace quello che lì non vorrebbe dire niente (`data-solo-cielo`):
//     il passo e il playback, perché il passo della scena è il suo — sta nei
//     comandi appena sotto — e il playback del cielo mentre il cielo è fermo
//     non camminerebbe; e il luogo da cui si guarda, che a un disegno visto
//     da fuori dal Sistema Solare non serve. Resta quello che nelle due viste
//     vuol dire la stessa identica cosa: che istante stiamo guardando.
// =====================================================================

const skyPostoDelTempo = new Map();

function skySezioneTempo() {
  return document.querySelector('.gruppo-comandi.gruppo-tempo');
}

function solPannelloTempoAperto() {
  const ospite = document.getElementById('sol-tempo-pannello');
  return !!ospite && !ospite.classList.contains('hidden');
}

// La lettura fa da interruttore, come la sua gemella nel planetario
function solAlternaPannelloTempo() {
  if (solPannelloTempoAperto()) solChiudiPannelloTempo();
  else solApriPannelloTempo();
}

function solApriPannelloTempo() {
  const sezione = skySezioneTempo();
  const ospite = document.getElementById('sol-tempo-pannello');
  const corpo = document.getElementById('sol-tempo-corpo');
  if (!sezione || !ospite || !corpo) return;

  // Si sta scegliendo un istante: il tempo che cammina se lo porterebbe via
  // da sotto le dita mentre lo si scrive. Vale anche per il playback acceso
  // nel planetario, che è lo stesso orologio visto dall'altra parte
  solFermaTempo();
  // E sotto, nel planetario, non resta un pannello aperto a metà con dentro
  // un buco al posto della sezione che ci siamo appena presi
  skyMostraGruppo('');

  skyRicordaPosto(skyPostoDelTempo, sezione);
  corpo.appendChild(sezione);
  sezione.classList.add('gruppo-attivo', 'gruppo-ospite');
  ospite.classList.remove('hidden');
  sol.ancoraSec = solOffset();

  // Il ciclo del cielo è in pausa finché questa finestra è aperta: la data
  // scritta nel campo e la lettura lunga se le rinfresca la barra della scena
  skyAggiornaTestoTempo();
  solAggiornaBarra();
}

function solChiudiPannelloTempo() {
  const sezione = skySezioneTempo();
  const ospite = document.getElementById('sol-tempo-pannello');
  if (ospite) ospite.classList.add('hidden');
  if (sezione) {
    sezione.classList.remove('gruppo-attivo', 'gruppo-ospite');
    skyRimettiAlSuoPosto(skyPostoDelTempo, sezione);
  }
  // Scritta una data qui dentro, la slitta della scena riparte da lì: se
  // restasse ancorata a dove eravamo prima, il primo trascinamento
  // riporterebbe indietro di quanto ci si era appena spostati
  sol.ancoraSec = solOffset();
  solAggiornaBarra();
}

// =====================================================================
// 7.6 REGISTRARE UN MOMENTO
//     Certe cose del cielo non stanno in una fotografia. Una congiunzione
//     ferma è due puntini; la Luna che in venti secondi di playback
//     scavalca Giove si capisce al volo. Da qui si prendono pochi secondi
//     di quello che c'è sulla mappa e se ne fa un file da mandare.
//
//     Quello che finisce nel file è il cielo, non lo schermo: si monta su
//     una tela a parte l'immagine della fotocamera (se la realtà aumentata
//     è accesa) più il cielo disegnato, e in fondo una firma con l'istante
//     e il luogo — che è l'unica cosa che rende leggibile un filmato di
//     stelle a chi lo riceve. I comandi appoggiati sulla mappa restano
//     fuori: sono roba di chi guarda, non del cielo.
//
//     Il tasto sta sulla mappa e non se ne va mai (angolo in basso a
//     destra, sopra allo zoom). Non è un vezzo: una registrazione la si
//     prepara prima — si accendono i filtri, si sposta l'ora, si stringe il
//     campo sulla Luna — e finché il tasto stava dentro al pannello
//     Visualizzazione bisognava tornarci a ogni ripensamento, riaprendo il
//     pannello proprio sopra al cielo da riprendere. Adesso si prepara la
//     vista con calma, si chiudono i pannelli e si tocca il tondo rosso.
//
//     Un formato solo: il filmato che il browser sa scrivere — mp4 dove
//     c'è, se no webm. Sono i due che qualsiasi telefono, chat o computer
//     apre senza chiedere niente a nessuno.
// =====================================================================

const SKY_REG_DURATE = [5, 10, 20];
const SKY_REG_FPS_VIDEO = 30;
// Lato lungo del filmato: la misura di uno schermo di telefono, che è anche
// quella che le chat non ricomprimono fino a rovinarla
const SKY_REG_LATO_VIDEO = 1080;

// Il tipo di file lo decide il browser: si prende il primo che sa scrivere.
// L'mp4 per primo perché è quello che le chat aprono senza discutere.
const SKY_REG_TIPI_VIDEO = [
  { mime: 'video/mp4;codecs=avc1.42E01E', est: 'mp4' },
  { mime: 'video/mp4', est: 'mp4' },
  { mime: 'video/webm;codecs=vp9', est: 'webm' },
  { mime: 'video/webm;codecs=vp8', est: 'webm' },
  { mime: 'video/webm', est: 'webm' }
];

// La modalità notte è un filtro CSS sul riquadro: la tela di montaggio non lo
// eredita, quindi se lo rimette addosso da sola. Chi registra col filtro rosso
// acceso si aspetta un filmato rosso.
const SKY_REG_FILTRO_NOTTE = 'grayscale(1) sepia(1) saturate(6) hue-rotate(-38deg) brightness(0.85)';

function skyRegTipoVideo() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of SKY_REG_TIPI_VIDEO) {
    try {
      if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(t.mime)) return t;
    } catch (e) { /* tipo non riconosciuto: si prova il prossimo */ }
  }
  return null;
}

// --- La tela di montaggio -------------------------------------------------

// Misura fissa per tutta la registrazione: se cambiasse a metà (rotazione,
// schermo intero) il filmato si spezzerebbe. Larghezza e altezza pari, che
// certi codificatori video non digeriscono i numeri dispari.
function skyRegPreparaTela() {
  const l = sky.larghezza || 320;
  const h = sky.altezza || 320;
  const dpr = window.devicePixelRatio || 1;
  const k = Math.min(dpr, SKY_REG_LATO_VIDEO / Math.max(l, h));
  const tela = document.createElement('canvas');
  tela.width = Math.max(2, Math.round(l * k / 2) * 2);
  tela.height = Math.max(2, Math.round(h * k / 2) * 2);
  sky.reg.tela = tela;
  sky.reg.ctx = tela.getContext('2d');
  return !!sky.reg.ctx;
}

// Un fotogramma: fotocamera sotto, cielo sopra, firma in fondo. Le due
// immagini si ritagliano come fa il riquadro sullo schermo (`object-fit:
// cover`), così quello che si registra è quello che si sta guardando.
function skyRegComponi() {
  const r = sky.reg;
  if (!r.ctx || !r.tela) return;
  const ctx = r.ctx;
  const L = r.tela.width, H = r.tela.height;
  const cont = document.getElementById('skymap-contenitore');
  const filtro = cont && cont.classList.contains('modalita-notte') ? SKY_REG_FILTRO_NOTTE : 'none';

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, L, H);

  ctx.filter = filtro;
  const video = document.getElementById('skymap-video');
  if (sky.camera && video && video.videoWidth) {
    skyRegDisegnaCoprendo(ctx, video, video.videoWidth, video.videoHeight, L, H);
  }
  if (sky.canvas && sky.canvas.width) {
    skyRegDisegnaCoprendo(ctx, sky.canvas, sky.canvas.width, sky.canvas.height, L, H);
  }

  // La firma passa sotto lo stesso filtro di tutto il resto: una scritta
  // bianca su un filmato rosso si vedrebbe subito che è stata appiccicata dopo
  skyRegFirma(ctx, L, H);
  ctx.filter = 'none';
}

function skyRegDisegnaCoprendo(ctx, sorgente, sl, sh, L, H) {
  const scala = Math.max(L / sl, H / sh);
  const l = sl * scala, h = sh * scala;
  ctx.drawImage(sorgente, (L - l) / 2, (H - h) / 2, l, h);
}

// La firma: quando e da dove. Senza, un filmato di stelle mandato a qualcuno
// è un fondo nero con dei puntini; con due righe diventa "il cielo di
// quella sera, da lì".
function skyRegFirma(ctx, L, H) {
  const misura = Math.max(11, Math.round(H / 34));
  const margine = Math.round(misura * 1.1);
  const quando = skyAdesso();
  // Su un fotogramma stretto (telefono in verticale) il mese per esteso si
  // mangia la riga: lì basta l'abbreviazione
  const data = quando.toLocaleString('it-IT', {
    day: 'numeric', month: L < 520 ? 'short' : 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  // Il luogo della firma è quello da cui si guarda: se il cielo è stato
  // spostato altrove, il filmato deve dire quello, non dove sei seduto.
  let dove = '';
  const luogoFirma = skyLuogoDelCielo();
  if (luogoFirma) {
    dove = luogoFirma.nome || formattaCoordinate(luogoFirma.lat, luogoFirma.lon);
  }
  const riga = dove ? `${data} · ${dove}` : data;

  ctx.save();
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = Math.round(misura / 2);

  const misuraNome = Math.round(misura * 0.82);
  ctx.font = `600 ${misura}px system-ui, sans-serif`;
  const largaRiga = ctx.measureText(riga).width;
  ctx.font = `${misuraNome}px system-ui, sans-serif`;
  const largoNome = ctx.measureText('AstroCalendario di Ben').width;
  // Il nome dell'app sta in fondo a destra se ci sta senza toccare la data;
  // se no si accomoda sopra, che è meglio di due scritte sovrapposte
  const inFila = largaRiga + largoNome + margine * 3 <= L;

  ctx.fillStyle = 'rgba(148, 168, 214, 0.85)';
  if (inFila) {
    ctx.textAlign = 'right';
    ctx.fillText('AstroCalendario di Ben', L - margine, H - margine);
    ctx.textAlign = 'left';
  } else {
    ctx.fillText('AstroCalendario di Ben', margine, H - margine - Math.round(misura * 1.25));
  }

  ctx.font = `600 ${misura}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
  ctx.fillText(riga, margine, H - margine);
  ctx.restore();
}

// --- Avvio, presa dei fotogrammi, arresto ---------------------------------

function skyRegAlterna() {
  if (sky.reg.attiva) skyRegFerma();
  else skyRegAvvia();
}

function skyRegAvvia() {
  const r = sky.reg;
  if (r.attiva || !sky.canvas) return;

  // Un risultato per volta: quello di prima si butta solo adesso, così chi ha
  // fatto due registrazioni di fila non si ritrova la prima sparita a metà
  skyRegDimenticaEsito();
  skyRegChiudiPannello();

  if (!skyRegPreparaTela()) {
    skyAvviso('registra', 'Non riesco a preparare la registrazione su questo dispositivo.', 8000);
    return;
  }
  if (!skyRegAvviaVideo()) return;

  r.attiva = true;
  r.avvio = performance.now();
  r.ultimoConto = 0;
  skyAvviso('registra', '');
  // I pannelli si chiudono: chi registra vuole guardare il cielo, e un
  // pannello aperto copre metà di quello che sta riprendendo
  skyMostraGruppo('');
  skyRegAggiornaComando(r.durataSec);
}

function skyRegAvviaVideo() {
  const r = sky.reg;
  const tipo = skyRegTipoVideo();
  if (!tipo || typeof r.tela.captureStream !== 'function') {
    // Succede sui browser vecchi: meglio dirlo che lasciare un tasto che si
    // preme e non fa niente
    skyAvviso('registra', 'Questo browser non sa registrare un filmato: serve una versione più ' +
      'recente di Chrome, Safari o Firefox.', 10000);
    return false;
  }
  try {
    r.flusso = r.tela.captureStream(SKY_REG_FPS_VIDEO);
    r.registratore = new MediaRecorder(r.flusso, { mimeType: tipo.mime, videoBitsPerSecond: 6000000 });
  } catch (e) {
    r.flusso = null;
    r.registratore = null;
    skyAvviso('registra', 'Il registratore video non è partito: riprova, o aggiorna il browser.', 10000);
    return false;
  }
  r.pezzi = [];
  r.est = tipo.est;
  r.mime = tipo.mime.split(';')[0];
  r.registratore.ondataavailable = (e) => { if (e.data && e.data.size) r.pezzi.push(e.data); };
  r.registratore.onstop = () => {
    if (r.flusso) { r.flusso.getTracks().forEach(t => t.stop()); r.flusso = null; }
    const pezzi = r.pezzi;
    r.pezzi = [];
    r.registratore = null;
    if (!pezzi.length) {
      skyAvviso('registra', 'La registrazione è rimasta vuota: riprova.', 8000);
      return;
    }
    skyRegMostraEsito(new Blob(pezzi, { type: r.mime }), r.est, r.mime);
  };
  r.registratore.start();
  return true;
}

// Chiamata alla fine di ogni disegno del cielo, finché la registrazione dura:
// è il posto giusto perché quello che si monta è esattamente il fotogramma
// appena finito, non quello di mezzo secondo fa.
function skyRegAcquisisci() {
  const r = sky.reg;
  if (!r.attiva) return;
  // Il registratore prende dalla tela quello che ci trova, quando gli pare:
  // la tela dev'essere aggiornata a ogni fotogramma
  skyRegComponi();

  const restano = r.durataSec - (performance.now() - r.avvio) / 1000;
  skyRegAggiornaComando(restano);
  if (restano <= 0) skyRegFerma();
}

// Ferma la registrazione: il file arriva poco dopo, dal registratore. Con
// `annulla` invece si butta via tutto: succede uscendo dal planetario, dove
// il risultato non avrebbe più nessun posto dove farsi vedere.
function skyRegFerma(opzioni = {}) {
  const r = sky.reg;
  if (!r.attiva) return;
  r.attiva = false;
  // Fermando prima del tempo la registrazione dura quello che è durata: è
  // questa la misura da scrivere sotto al risultato, non quella scelta
  r.durataReale = Math.max(0.1, (performance.now() - r.avvio) / 1000);
  skyRegAggiornaComando(null);

  if (r.registratore) {
    if (opzioni.annulla) {
      r.registratore.onstop = null;
      r.pezzi = [];
    }
    try { r.registratore.stop(); } catch (e) { /* già fermo */ }
    if (opzioni.annulla) {
      r.registratore = null;
      if (r.flusso) { r.flusso.getTracks().forEach(t => t.stop()); r.flusso = null; }
    }
  }
}

// Il tasto sulla mappa dice da solo cosa sta succedendo: fermo è un tondo
// rosso, mentre registra diventa un quadrato che pulsa e accanto compaiono i
// secondi che mancano. Con `restano` a null torna a riposo.
function skyRegAggiornaComando(restano) {
  const tasto = document.getElementById('skymap-btn-registra');
  const tempo = document.getElementById('skymap-reg-tempo');
  const inCorso = restano !== null;
  if (tasto) {
    tasto.classList.toggle('in-corso', inCorso);
    tasto.setAttribute('aria-pressed', inCorso ? 'true' : 'false');
    tasto.title = inCorso
      ? 'Ferma qui la registrazione e tieni quello che hai ripreso'
      : `Registra ${sky.reg.durataSec} secondi di cielo da condividere`;
    tasto.setAttribute('aria-label', inCorso ? 'Ferma la registrazione' : 'Registra il cielo');
  }
  if (!tempo) return;
  tempo.classList.toggle('visibile', inCorso);
  if (!inCorso) { tempo.textContent = ''; return; }
  // Il conto alla rovescia si riscrive dieci volte al secondo, non sessanta
  const ora = performance.now();
  if (ora - sky.reg.ultimoConto < 100) return;
  sky.reg.ultimoConto = ora;
  tempo.textContent = `${Math.max(0, restano).toFixed(1)} s`;
}

// --- Il risultato: guardarlo, mandarlo, salvarlo --------------------------

function skyRegNomeFile(est) {
  const d = skyAdesso();
  const due = (n) => String(n).padStart(2, '0');
  return `planetario-${d.getFullYear()}${due(d.getMonth() + 1)}${due(d.getDate())}-` +
    `${due(d.getHours())}${due(d.getMinutes())}${due(d.getSeconds())}.${est}`;
}

function skyRegMostraEsito(blob, est, tipo) {
  const r = sky.reg;
  skyRegDimenticaEsito();
  r.esito = {
    blob,
    url: URL.createObjectURL(blob),
    nome: skyRegNomeFile(est),
    tipo: tipo || blob.type
  };

  const anteprima = document.getElementById('skymap-clip-anteprima');
  if (anteprima) {
    anteprima.innerHTML = '';
    const v = document.createElement('video');
    v.src = r.esito.url;
    v.controls = true;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.autoplay = true;
    anteprima.appendChild(v);
    v.play().catch(() => { /* basta il tasto play */ });
  }

  const nota = document.getElementById('skymap-clip-nota');
  if (nota) {
    const mb = blob.size / (1024 * 1024);
    const peso = mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(blob.size / 1024)} kB`;
    const durata = (r.durataReale || r.durataSec).toFixed(1).replace('.0', '').replace('.', ',');
    nota.textContent = `Filmato di ${durata} s · ${peso} · ${r.esito.nome}`;
  }
  const pannello = document.getElementById('skymap-clip');
  if (pannello) pannello.classList.add('visibile');
}

function skyRegChiudiPannello() {
  const pannello = document.getElementById('skymap-clip');
  if (pannello) pannello.classList.remove('visibile');
  const anteprima = document.getElementById('skymap-clip-anteprima');
  // Il video dell'anteprima va tolto di mezzo davvero: lasciato lì continua a
  // girare in sottofondo sopra a un cielo che nel frattempo cammina
  if (anteprima) anteprima.innerHTML = '';
}

function skyRegDimenticaEsito() {
  const r = sky.reg;
  if (r.esito && r.esito.url) URL.revokeObjectURL(r.esito.url);
  r.esito = null;
}

async function skyRegCondividi() {
  const e = sky.reg.esito;
  if (!e) return;
  const quando = skyAdesso().toLocaleString('it-IT', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
  });
  const testo = `Il cielo del ${quando}, dal planetario di AstroCalendario di Ben.`;
  try {
    const file = new File([e.blob], e.nome, { type: e.tipo });
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Il cielo di stasera', text: testo });
      return;
    }
  } catch (err) {
    // L'utente che chiude il foglio di condivisione non è un errore da spiegare
    if (err && err.name === 'AbortError') return;
  }
  // Dove non si può condividere direttamente (quasi tutti i computer) il file
  // si scarica: da lì lo si allega a mano
  skyRegSalva();
  skyAvviso('registra', 'Questo dispositivo non passa i file alle altre app: ' +
    'l\'ho scaricato, così lo puoi allegare a mano.', 9000);
}

function skyRegSalva() {
  const e = sky.reg.esito;
  if (!e) return;
  const a = document.createElement('a');
  a.href = e.url;
  a.download = e.nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// --- Comandi --------------------------------------------------------------

// Quale durata è scelta, e il titolo del tasto sulla mappa che la annuncia
function skyRegAggiornaComandi() {
  document.querySelectorAll('#cielo-comandi [data-durata-reg]').forEach(b => {
    const attiva = parseInt(b.dataset.durataReg, 10) === sky.reg.durataSec;
    b.classList.toggle('attiva', attiva);
    b.setAttribute('aria-pressed', attiva ? 'true' : 'false');
  });
  if (!sky.reg.attiva) skyRegAggiornaComando(null);
}

function skyRegInizializza() {
  const collega = (id, azione) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', azione);
  };

  // La durata si sceglie prima: cambiarla a registrazione avviata vorrebbe
  // dire fermare una cosa e consegnarne un'altra
  document.querySelectorAll('#cielo-comandi [data-durata-reg]').forEach(b => {
    b.addEventListener('click', () => {
      if (sky.reg.attiva) {
        skyAvviso('registra', 'Sto registrando: ferma prima, poi cambia la durata.', 4000);
        return;
      }
      const d = parseInt(b.dataset.durataReg, 10);
      if (SKY_REG_DURATE.indexOf(d) >= 0) sky.reg.durataSec = d;
      skyRegAggiornaComandi();
    });
  });

  collega('skymap-btn-registra', skyRegAlterna);
  collega('skymap-clip-chiudi', () => { skyRegChiudiPannello(); skyRegDimenticaEsito(); });
  collega('skymap-clip-condividi', skyRegCondividi);
  collega('skymap-clip-salva', skyRegSalva);
  collega('skymap-clip-rifai', () => { skyRegChiudiPannello(); skyRegDimenticaEsito(); skyRegAvvia(); });

  skyRegAggiornaComandi();
}

// Apre il planetario puntato su un astro (usata dalle schede dell'agenda)
window.cercaNelCielo = (idCorpo) => {
  mostraVista('cielo');
  skyImpostaTarget(idCorpo, { mantieni: true });
};

// =====================================================================
// 7.7 IL SISTEMA SOLARE IN 3D — dove sono davvero, in questo momento
//   Il planetario risponde a «dove devo guardare»: dà una direzione dentro
//   alla cupola, e finisce lì. Ma la domanda che nasce subito dopo — «e
//   perché stasera Marte sta lì, e fra sei mesi starà dall'altra parte?» —
//   dentro alla cupola non ha risposta: la risposta è fuori, nel disegno
//   delle orbite, e si vede solo uscendo dal Sistema Solare e guardandolo
//   da lontano.
//
//   Questa è quella vista da fuori. Le posizioni sono quelle vere
//   dell'istante mostrato dal planetario — lo stesso istante, sempre: si
//   sposta il tempo di qua e si trova spostato anche di là — proiettate in
//   ortogonale, cioè senza prospettiva: chi guarda sta infinitamente
//   lontano, i raggi arrivano paralleli e due segmenti lunghi uguali si
//   disegnano uguali ovunque stiano. È la proiezione dei disegni tecnici, e
//   qui serve proprio perché non fa rimpicciolire quello che sta in fondo:
//   le distanze restano confrontabili a occhio.
//
//   Ci si gira attorno col dito, ed è il punto di tutto. Vista dall'alto la
//   scena è il bersaglio dei libri di scuola. Girata di taglio si scopre che
//   quel bersaglio è un piatto sottile, e che i pianeti ci stanno dentro per
//   pochi gradi: da lì l'eclittica smette di essere una riga da credere sulla
//   parola e diventa il bordo di un pavimento visto di profilo.
//
//   Due imbrogli, entrambi dichiarati sotto al disegno e disattivabili:
//   le distanze si possono comprimere (con quelle vere Mercurio finisce
//   dentro al Sole, perché Nettuno è settantasette volte più lontano) e
//   l'altezza fuori dal piano si può ingrandire (2° di inclinazione, a
//   schermo, sono meno dello spessore della linea).
// =====================================================================

const SOL_UA_KM = 149597870.7;
const SOL_LUCE_MIN_UA = 8.3167;     // minuti che la luce impiega per un'unità astronomica
const SOL_RIF_UA = 30.07;           // Nettuno: il metro con cui si normalizza tutto il disegno

// I pianeti, col loro colore del planetario (chi arriva qui riconosce le
// stesse tinte che vede sulla mappa) e due misure per disegnarli.
//
// `raggio` è il pallino ingrandito: comodo da toccare col dito, ma coi
// rapporti schiacciati. `km` è il diametro vero, che serve all'altra misura —
// quella in scala, dove Giove viene ventinove volte Mercurio come nella
// realtà. Nessuna delle due è in scala con le *distanze*: lì la Terra sarebbe
// un centesimo di pixel.
const SOL_PIANETI = [
  { id: 'Mercury', nome: 'Mercurio', colore: '#cbd5e1', raggio: 5.0,  km: 4879,   ua: 0.387, anni: 0.241 },
  { id: 'Venus',   nome: 'Venere',   colore: '#fde68a', raggio: 7.2,  km: 12104,  ua: 0.723, anni: 0.615 },
  { id: 'Earth',   nome: 'Terra',    colore: '#60a5fa', raggio: 7.6,  km: 12742,  ua: 1.000, anni: 1.000 },
  { id: 'Mars',    nome: 'Marte',    colore: '#f87171', raggio: 6.0,  km: 6779,   ua: 1.524, anni: 1.881 },
  { id: 'Jupiter', nome: 'Giove',    colore: '#fbbf24', raggio: 13.5, km: 139820, ua: 5.203, anni: 11.86 },
  { id: 'Saturn',  nome: 'Saturno',  colore: '#fcd34d', raggio: 11.5, km: 116460, ua: 9.537, anni: 29.45 },
  { id: 'Uranus',  nome: 'Urano',    colore: '#67e8f9', raggio: 8.6,  km: 50724,  ua: 19.19, anni: 84.01 },
  { id: 'Neptune', nome: 'Nettuno',  colore: '#93c5fd', raggio: 8.3,  km: 49244,  ua: 30.07, anni: 164.8 }
];

// Il raggio del Sole e quello del pallino della Luna coi pallini ingranditi
const SOL_RAGGIO_SOLE = 17;
const SOL_RAGGIO_LUNA = 3.4;

// A pallini in scala: quanti pixel vale un chilometro di diametro. Scelto
// perché Mercurio, il più piccolo, resti un punto che si vede.
const SOL_PX_PER_KM = 3.4e-4;
const SOL_SOLE_KM = 1392700;
// Il Sole in scala sarebbe 109 Terre, cioè quattro volte e mezza il disegno:
// si mangerebbe tutte le orbite interne. Resta il più grosso di tutti — è la
// cosa vera che deve restare — ma tosato, e sotto al disegno c'è scritto.
const SOL_SOLE_MAX = 0.085;   // frazione del lato corto della tela

// Quanto ci mettono la telecamera e lo zoom ad arrivare dove sono stati
// mandati: sono tempi di dimezzamento, in secondi
const SOL_TAU_VISTA = 0.28;
const SOL_TAU_ZOOM = 0.22;

// I tre punti di vista preimpostati. `elev` è l'altezza della telecamera sul
// piano dell'eclittica: 90° è a picco sul Sole, 0° è dentro al piano.
const SOL_VISTE = {
  alto:   { elev: 89 },
  obliqua: { elev: 34 },
  taglio: { elev: 2 }
};

// Il passo del tempo, e con lui quanto ne copre la slitta da un capo
// all'altro. Il play fa tre passi al secondo, qualunque sia il passo scelto:
// un comando solo per la velocità e per lo scatto, invece di due.
const SOL_PASSI = [
  { nome: 'giorno', sec: 86400,          finestra: 60 * 86400 },
  { nome: 'mese',   sec: 30 * 86400,     finestra: 2 * 365.25 * 86400 },
  { nome: 'anno',   sec: 365.25 * 86400, finestra: 30 * 365.25 * 86400 }
];
const SOL_PASSI_AL_SECONDO = 3;

const sol = {
  aperto: false, canvas: null, ctx: null, L: 0, H: 0, raf: null, ultimoTs: 0,
  // La telecamera: `az` gira attorno all'asse del Sistema Solare, `elev` sale
  // e scende sul piano. I due valori "voluti" servono ai tasti dei punti di
  // vista, che ci portano scivolando invece che di scatto (come lo zoom del
  // planetario, sezione 7.4-ter): vedere il disco che si chiude è metà della
  // spiegazione, e saltarci sopra la butterebbe via.
  az: -0.55, elev: 34, elevVoluta: 34,
  zoom: 1, zoomVoluto: 1,
  // Lo spostamento della scena dentro alla tela, in pixel: il Sole non è
  // inchiodato al centro. Serve appena ci si avvicina — a zoom alto Nettuno
  // sta fuori dallo schermo, e girando la scena per raggiungerlo si perde
  // l'inquadratura che si voleva. Si sposta con due dita (o col tasto destro,
  // o con Maiusc premuto), e il tasto ⌖ la rimette al centro.
  panX: 0, panY: 0,
  distanzeVere: false,   // false = distanze compresse, per farceli stare tutti
  // Si parte dall'altezza vera fuori dal piano, non da quella ingrandita: la
  // prima cosa che questa vista deve dire è che il Sistema Solare è piatto
  // davvero, non "quasi". L'ingrandimento è lì per chi poi vuole vedere le
  // inclinazioni, ma dev'essere una cosa che si chiede, non che si trova.
  esagera: 1,
  misureVere: false,     // false = pallini ingranditi, true = in scala fra loro
  scelto: null,          // id del pianeta di cui si legge la scheda
  pianeti: [], terra: null, luna: null,
  orbite: { chiave: null, tracce: [] },
  istante: 0,            // ms dell'ultimo calcolo delle posizioni
  scala: 1, cx: 0, cy: 0,
  stelle: [],
  // Dita appoggiate sulla tela: una gira la scena, due la avvicinano
  puntatori: new Map(), pizzico: null, trascinamento: null, mosso: 0, giu: 0,
  modoPan: false,        // il dito sposta la scena invece di girarla (Maiusc o tasto destro)
  // Il tempo: il passo scelto, il centro della finestra su cui scorre la
  // slitta, e il verso della marcia (0 fermo, +1 avanti, −1 indietro)
  passoIndice: 0, ancoraSec: 0, marcia: 0,
  prossimaScheda: 0, firmaScheda: '',
  skyDaRiprendere: false
};

// --- Geometria della scena -------------------------------------------------

// Il raggio a cui si disegna una distanza vera, in unità di schermo (1 = il
// bordo del disegno). Con le distanze compresse si usa una potenza: gli
// intervalli fra i pianeti interni si allargano e quelli fra gli esterni si
// stringono, ma l'ordine e i rapporti angolari restano quelli veri.
function solRaggio(ua) {
  const q = Math.max(0, ua) / SOL_RIF_UA;
  return sol.distanzeVere ? q : Math.pow(q, 0.42);
}

// Da un vettore eliocentrico in unità astronomiche al punto della scena.
// La compressione delle distanze si applica al vettore intero, direzione
// compresa: così l'inclinazione dell'orbita non cambia di un grado. Poi, e
// solo poi, l'altezza fuori dal piano si ingrandisce del fattore scelto.
function solScena(v) {
  const r = Math.hypot(v.x, v.y, v.z);
  if (!r) return { x: 0, y: 0, z: 0 };
  const k = solRaggio(r) / r;
  return { x: v.x * k, y: v.y * k, z: v.z * k * sol.esagera };
}

// Dalla scena allo schermo, in proiezione ortogonale: nessuna prospettiva,
// nessun rimpicciolimento con la distanza. `vicinanza` dice quanto un punto
// sta verso chi guarda, e serve a disegnare per ultimo ciò che sta davanti.
function solProietta(p) {
  const a = sol.az, e = sol.elev * SKY_D2R;
  const xr = p.x * Math.cos(a) - p.y * Math.sin(a);
  const yr = p.x * Math.sin(a) + p.y * Math.cos(a);
  return {
    px: sol.cx + sol.panX + xr * sol.scala,
    py: sol.cy + sol.panY - (yr * Math.sin(e) + p.z * Math.cos(e)) * sol.scala,
    vicinanza: p.z * Math.sin(e) - yr * Math.cos(e)
  };
}

// Lo zoom che porta l'orbita di un pianeta a riempire il disegno
function solZoomPer(ua) {
  const r = solRaggio(ua);
  return r > 0 ? 0.9 / r : 1;
}

// Quante unità astronomiche ci sono dal Sole al bordo corto del disegno. Con
// le distanze compresse è l'unico modo di sapere dove si è arrivati, e serve
// anche a cambiare metro senza far saltare via l'inquadratura.
function solUaAlBordo(zoom) {
  const unita = 0.5 / (0.44 * (zoom || sol.zoom));
  return SOL_RIF_UA * (sol.distanzeVere ? unita : Math.pow(unita, 1 / 0.42));
}

function solMisura() {
  sol.cx = sol.L / 2;
  sol.cy = sol.H / 2;
  sol.scala = Math.min(sol.L, sol.H) * 0.44 * sol.zoom;
}

// Quanto si disegna grosso un corpo, nelle due misure: il pallino ingrandito
// che si tocca col dito, o il diametro vero in scala fra i corpi.
function solRaggioCorpo(p) {
  // Sotto il pixel e mezzo un pianeta non è più un pianeta ma un granello di
  // polvere: Mercurio e Marte si fermano lì. Fra tutti gli altri il rapporto
  // è quello vero.
  return sol.misureVere ? Math.max(1.2, p.km * SOL_PX_PER_KM / 2) : p.raggio;
}

function solRaggioSole() {
  if (!sol.misureVere) return SOL_RAGGIO_SOLE;
  return Math.min(Math.min(sol.L, sol.H) * SOL_SOLE_MAX, SOL_SOLE_KM * SOL_PX_PER_KM / 2);
}

// --- Le posizioni vere -----------------------------------------------------

// Coordinate eclittiche eliocentriche, in unità astronomiche: l'unico posto
// in cui questa sezione parla con Astronomy Engine.
function solVettore(id, t) {
  return Astronomy.Ecliptic(Astronomy.HelioVector(id, t)).vec;
}

function solLeggiPosizioni(quando) {
  if (typeof Astronomy === 'undefined') { sol.pianeti = []; sol.terra = null; return; }
  const ms = quando.getTime();
  if (sol.istante === ms && sol.pianeti.length) return;
  try {
    const t = Astronomy.MakeTime(quando);
    sol.pianeti = SOL_PIANETI.map(p => {
      const v = solVettore(p.id, t);
      return Object.assign({}, p, { pos: v, r: Math.hypot(v.x, v.y, v.z) });
    });
    sol.terra = sol.pianeti.find(p => p.id === 'Earth') || null;
    // La Luna: a 384.000 km da noi, in questa scena, sta dentro al pallino
    // della Terra. Del resto qui non interessa quanto è lontana ma da che
    // parte sta — è quello che fa la fase e, due volte l'anno, le eclissi —
    // e allora la si disegna a distanza esagerata tenendo la direzione vera.
    const m = Astronomy.Ecliptic(Astronomy.GeoMoon(t)).vec;
    const d = Math.hypot(m.x, m.y, m.z) || 1;
    sol.luna = { x: m.x / d, y: m.y / d, z: m.z / d };
  } catch (e) {
    sol.pianeti = []; sol.terra = null; sol.luna = null;
  }
  sol.istante = ms;
}

// Le orbite si disegnano campionando la posizione vera lungo un periodo
// intero, centrato sull'istante mostrato: nessuna ellisse inventata, e le
// inclinazioni vengono da sé. Cambiano di pochissimo in un secolo, quindi il
// conto si rifà solo se ci si sposta di più di cinque anni.
function solCalcolaOrbite(quando) {
  if (typeof Astronomy === 'undefined') return;
  const chiave = Math.round(quando.getFullYear() / 5);
  if (sol.orbite.chiave === chiave && sol.orbite.tracce.length) return;
  const tracce = [];
  try {
    SOL_PIANETI.forEach(p => {
      const passi = p.anni < 3 ? 84 : 128;
      const durata = p.anni * 365.25 * 86400000;
      const punti = [];
      for (let i = 0; i <= passi; i++) {
        const d = new Date(quando.getTime() + (i / passi - 0.5) * durata);
        punti.push(solVettore(p.id, Astronomy.MakeTime(d)));
      }
      tracce.push({ id: p.id, colore: p.colore, punti });
    });
  } catch (e) { return; }
  sol.orbite = { chiave, tracce };
}

// --- Pezzi di disegno ------------------------------------------------------

function solGeneraStelle(quante) {
  sol.stelle = [];
  for (let i = 0; i < quante; i++) {
    sol.stelle.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + 0.3, a: Math.random() * 0.5 + 0.18 });
  }
}

function solSfondo(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, sol.H);
  g.addColorStop(0, '#04060f');
  g.addColorStop(1, '#0a1024');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, sol.L, sol.H);
  ctx.fillStyle = '#e2e8f0';
  sol.stelle.forEach(s => {
    ctx.globalAlpha = s.a;
    ctx.beginPath();
    ctx.arc(s.x * sol.L, s.y * sol.H, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// Il carattere della pagina si chiede una volta sola: getComputedStyle costa
// un calcolo di stile, e qui di scritte ce ne sono una dozzina per fotogramma
let SOL_CARATTERE = '';
function solTesto(ctx, testo, x, y, colore, misura, allinea) {
  if (!SOL_CARATTERE) SOL_CARATTERE = getComputedStyle(document.body).fontFamily || 'sans-serif';
  ctx.font = `${misura || 12}px ${SOL_CARATTERE}`;
  ctx.textAlign = allinea || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = colore;
  ctx.fillText(testo, x, y);
  ctx.textAlign = 'left';
}

// I nomi accanto ai pianeti. Quando i quattro interni si stringono attorno al
// Sole — succede sempre, con le distanze compresse e ancora di più con quelle
// vere — quattro scritte nello stesso posto diventano una macchia illeggibile.
// Allora ogni nome prova quattro angoli attorno al suo pallino, e se sono
// tutti occupati rinuncia: meglio un nome in meno che cinque sovrapposti.
// Chi resta senza si legge lo stesso, toccandolo o dalla tabella qui sotto.
function solEtichetta(ctx, testo, px, py, raggio, colore, misura, prese, obbligata) {
  if (!SOL_CARATTERE) SOL_CARATTERE = getComputedStyle(document.body).fontFamily || 'sans-serif';
  ctx.font = `${misura}px ${SOL_CARATTERE}`;
  const largo = ctx.measureText(testo).width;
  const alto = misura + 2;
  // Sei posti: i quattro angoli, poi sopra e sotto in colonna. Gli ultimi due
  // servono ai pianeti interni, che con le distanze compresse si stringono in
  // un pugno attorno al Sole e agli angoli non ci stanno più.
  const posti = [
    { x: px + raggio + 4, y: py - raggio - 2 },
    { x: px + raggio + 4, y: py + raggio + alto },
    { x: px - raggio - 4 - largo, y: py - raggio - 2 },
    { x: px - raggio - 4 - largo, y: py + raggio + alto },
    { x: px - largo / 2, y: py - raggio - 5 },
    { x: px - largo / 2, y: py + raggio + alto + 3 }
  ];
  // Libero vuol dire due cose: che nessun altro nome è già lì, e che sta
  // dentro alla tela — un nome tagliato a metà dal bordo è peggio che assente
  const libero = (b) =>
    b.x >= 2 && b.x + b.w <= sol.L - 2 && b.y >= 2 && b.y + b.h <= sol.H - 26 - (sol.altaBarra || 0) &&
    !prese.some(q => b.x < q.x + q.w && b.x + b.w > q.x && b.y < q.y + q.h && b.y + b.h > q.y);
  const scatolaDi = (p) => ({ x: p.x - 2, y: p.y - alto, w: largo + 4, h: alto + 3 });
  let posto = posti.find(p => libero(scatolaDi(p)));
  // Il nome del pianeta scelto non rinuncia mai: se tutti e quattro gli
  // angoli sono occupati si mette comunque nel primo, e si legge sopra
  if (!posto && obbligata) posto = posti[0];
  if (!posto) return;
  prese.push(scatolaDi(posto));
  solTesto(ctx, testo, posto.x, posto.y, colore, misura);
}

// Il pavimento: dodici raggi e un cerchio esterno sul piano dell'eclittica.
// Vista dall'alto è un reticolo qualunque; girata di taglio diventa la riga
// che spiega tutto, perché è il piano stesso visto di profilo.
function solDisegnaPiano(ctx) {
  const bordo = solRaggio(SOL_RIF_UA * 1.06);
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 168, 214, 0.16)';
  ctx.lineWidth = 1;
  for (let g = 0; g < 360; g += 30) {
    const a = g * SKY_D2R;
    const p = solProietta({ x: Math.cos(a) * bordo, y: Math.sin(a) * bordo, z: 0 });
    const c = solProietta({ x: 0, y: 0, z: 0 });
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(c.px, c.py);
    ctx.lineTo(p.px, p.py);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  for (let g = 0; g <= 360; g += 4) {
    const a = g * SKY_D2R;
    const p = solProietta({ x: Math.cos(a) * bordo, y: Math.sin(a) * bordo, z: 0 });
    if (g === 0) ctx.moveTo(p.px, p.py); else ctx.lineTo(p.px, p.py);
  }
  ctx.stroke();
  ctx.restore();
}

// Un'orbita, in due passate: prima il mezzo giro che passa dietro al Sole,
// più smorzato, poi quello che passa davanti. Costa due tratti invece di
// centoventotto, e basta a far sentire quale metà è più vicina.
function solDisegnaOrbita(ctx, traccia) {
  const punti = traccia.punti.map(v => solProietta(solScena(v)));
  ctx.save();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = traccia.colore;
  [false, true].forEach(davanti => {
    ctx.globalAlpha = davanti ? 0.5 : 0.16;
    ctx.beginPath();
    let penna = false;
    punti.forEach(p => {
      const suo = (p.vicinanza >= 0) === davanti;
      if (!suo) { penna = false; return; }
      if (!penna) { ctx.moveTo(p.px, p.py); penna = true; }
      else ctx.lineTo(p.px, p.py);
    });
    ctx.stroke();
  });
  ctx.restore();
}

function solDisegnaSole(ctx) {
  const p = solProietta({ x: 0, y: 0, z: 0 });
  const raggio = solRaggioSole();
  const g = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, raggio * 6);
  g.addColorStop(0, 'rgba(253, 224, 71, 0.55)');
  g.addColorStop(0.35, 'rgba(251, 146, 60, 0.18)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.px, p.py, raggio * 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.arc(p.px, p.py, raggio, 0, Math.PI * 2);
  ctx.fill();
}

// Il filo a piombo: dal pianeta giù fino al piano dell'eclittica, con il suo
// segno per terra. È il pezzo che rende tridimensionale un disegno piatto —
// senza, un pianeta alto sul piano e uno lontano dal Sole si somigliano.
function solDisegnaPiombo(ctx, corpo) {
  const suolo = solProietta({ x: corpo.scena.x, y: corpo.scena.y, z: 0 });
  const alto = corpo.schermo;
  if (Math.abs(suolo.py - alto.py) < 2.5) return;
  ctx.save();
  ctx.strokeStyle = corpo.colore;
  ctx.globalAlpha = 0.42;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(alto.px, alto.py);
  ctx.lineTo(suolo.px, suolo.py);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(suolo.px, suolo.py, 2.6, Math.max(1, 2.6 * Math.sin(sol.elev * SKY_D2R)), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function solDisegnaCorpo(ctx, corpo) {
  const p = corpo.schermo;
  const r = corpo.rDisegno;
  const scelto = sol.scelto === corpo.id;
  ctx.save();
  if (scelto) {
    ctx.strokeStyle = '#fff';
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(p.px, p.py, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Un filo di luce dalla parte del Sole, tanto per ricordare da dove
  // arriva: è il motivo per cui esistono le fasi
  const g = ctx.createRadialGradient(
    p.px - (p.px - sol.cx) * 0.25, p.py - (p.py - sol.cy) * 0.25, r * 0.2,
    p.px, p.py, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, corpo.colore);
  g.addColorStop(1, corpo.colore);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// La Luna attorno alla Terra, a distanza esagerata (vedi solLeggiPosizioni)
function solDisegnaLuna(ctx, terra) {
  if (!sol.luna || !terra) return;
  // Abbastanza staccata dalla Terra da non finirle dentro, adesso che i
  // pallini sono più grossi
  const passo = 23 / sol.scala;
  const p = solProietta({
    x: terra.scena.x + sol.luna.x * passo,
    y: terra.scena.y + sol.luna.y * passo,
    z: terra.scena.z + sol.luna.z * passo * sol.esagera
  });
  ctx.save();
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(terra.schermo.px, terra.schermo.py);
  ctx.lineTo(p.px, p.py);
  ctx.stroke();
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(p.px, p.py, SOL_RAGGIO_LUNA, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// La riga che unisce il tuo occhio all'oggetto scelto, prolungata fino alle
// stelle: è il ponte fra questa vista e il planetario. Da una parte c'è "in
// che direzione lo vedo", dall'altra "perché è in quella direzione".
function solDisegnaSguardo(ctx, terra, corpo) {
  if (!terra || !corpo || corpo.id === 'Earth') return;
  const dx = corpo.scena.x - terra.scena.x;
  const dy = corpo.scena.y - terra.scena.y;
  const dz = corpo.scena.z - terra.scena.z;
  const d = Math.hypot(dx, dy, dz) || 1;
  const oltre = solRaggio(SOL_RIF_UA * 1.25) * 2 / d;
  const fine = solProietta({
    x: terra.scena.x + dx * oltre, y: terra.scena.y + dy * oltre, z: terra.scena.z + dz * oltre
  });
  ctx.save();
  ctx.strokeStyle = '#4c8dff';
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(terra.schermo.px, terra.schermo.py);
  ctx.lineTo(corpo.schermo.px, corpo.schermo.py);
  ctx.stroke();
  ctx.globalAlpha = 0.4;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(corpo.schermo.px, corpo.schermo.py);
  ctx.lineTo(fine.px, fine.py);
  ctx.stroke();
  ctx.restore();
}

function solDisegna() {
  if (!sol.ctx) return;
  const ctx = sol.ctx;
  solMisura();
  solSfondo(ctx);

  if (!sol.pianeti.length) {
    solTesto(ctx, 'Le posizioni dei pianeti non sono disponibili', sol.L / 2, sol.H / 2, '#94a3b8', 13, 'center');
    return;
  }

  // Ogni corpo porta con sé il suo punto nella scena e sullo schermo: si
  // calcolano una volta e li usano il piombo, la riga dello sguardo e la Luna
  sol.pianeti.forEach(p => {
    p.scena = solScena(p.pos);
    p.schermo = solProietta(p.scena);
    p.rDisegno = solRaggioCorpo(p);
  });
  const terra = sol.pianeti.find(p => p.id === 'Earth');
  const scelto = sol.pianeti.find(p => p.id === sol.scelto) || null;

  solDisegnaPiano(ctx);
  sol.orbite.tracce.forEach(t => solDisegnaOrbita(ctx, t));
  solDisegnaSole(ctx);
  solDisegnaSguardo(ctx, terra, scelto);

  // Il terreno che le scritte non possono occupare. Prima di tutto i corpi
  // stessi: «Venere» scritto in bianco sopra al disco del Sole non si legge, e
  // sopra a un pianeta glielo cancella. Poi, mano a mano, i nomi già messi
  // (vedi solEtichetta).
  const sole = solProietta({ x: 0, y: 0, z: 0 });
  const rSole = solRaggioSole();
  const prese = [{ x: sole.px - rSole, y: sole.py - rSole, w: rSole * 2, h: rSole * 2 }];
  sol.pianeti.forEach(p => prese.push({
    x: p.schermo.px - p.rDisegno, y: p.schermo.py - p.rDisegno,
    w: p.rDisegno * 2, h: p.rDisegno * 2
  }));

  // Dietro prima, davanti poi: è tutto quello che serve perché una scena
  // ortogonale sembri profonda
  const ordinati = sol.pianeti.slice().sort((a, b) => a.schermo.vicinanza - b.schermo.vicinanza);
  ordinati.forEach(p => {
    solDisegnaPiombo(ctx, p);
    if (p.id === 'Earth') solDisegnaLuna(ctx, p);
    solDisegnaCorpo(ctx, p);
  });

  // I nomi vengono dopo tutti i pallini, altrimenti un pianeta disegnato più
  // tardi cancellerebbe la scritta di quello di prima. Il pianeta scelto
  // scrive per primo e ha sempre il suo posto: è l'unico che si sta cercando.
  if (scelto) solEtichetta(ctx, scelto.nome, scelto.schermo.px, scelto.schermo.py,
    scelto.rDisegno, '#ffffff', 13, prese, true);
  solEtichetta(ctx, 'Sole', sole.px, sole.py, rSole, '#fde68a', 12, prese, true);
  ordinati.forEach(p => {
    if (p === scelto) return;
    solEtichetta(ctx, p.nome, p.schermo.px, p.schermo.py, p.rDisegno,
      'rgba(233, 237, 247, 0.82)', 11.5, prese);
  });

  // In basso: da che altezza si sta guardando, e quanto è largo il disegno.
  // Su una tela stretta le due scritte si tamponerebbero a metà strada:
  // allora diventano una sola, più corta.
  const stretta = sol.L < 560;
  const riga = sol.H - 10 - (sol.altaBarra || 0);
  const alto = sol.elev > 70 ? 'a picco sul piano' : (sol.elev < 8 ? 'quasi dentro al piano' : `${Math.round(sol.elev)}° sopra il piano`);
  const largo = solUaAlBordo(sol.zoom);
  const misure = sol.misureVere ? 'pianeti in scala, Sole no' : 'pianeti ingranditi';
  const bordo = `${solNumero(largo, largo < 2 ? 2 : 1)} UA al bordo`;
  if (stretta) {
    solTesto(ctx, `${alto} · ${bordo}${sol.distanzeVere ? '' : ' (compresse)'}`, 10, riga, '#64748b', 10.5);
  } else {
    solTesto(ctx, `${alto} delle orbite · ${misure}`, 10, riga, '#64748b', 11);
    solTesto(ctx, `dal Sole al bordo ≈ ${bordo.replace(' al bordo', '')}` +
      (sol.distanzeVere ? '' : ' · distanze compresse'), sol.L - 10, riga, '#64748b', 11, 'right');
  }
}

// --- I numeri sotto al disegno ---------------------------------------------

// L'angolo Sole–Terra–pianeta: quanto lontano dal Sole lo vediamo in cielo.
// È il numero che decide tutto — sotto i 15° è perso nella luce, a 180° è in
// opposizione e si vede tutta la notte — e non dipende da dove sei sulla
// Terra: è geometria del Sistema Solare, ed è per questo che sta qui.
function solElongazione(corpo, terra) {
  if (!corpo || !terra) return null;
  const ax = -terra.pos.x, ay = -terra.pos.y, az = -terra.pos.z;          // verso il Sole
  const bx = corpo.pos.x - terra.pos.x, by = corpo.pos.y - terra.pos.y, bz = corpo.pos.z - terra.pos.z;
  const na = Math.hypot(ax, ay, az), nb = Math.hypot(bx, by, bz);
  if (!na || !nb) return null;
  const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by + az * bz) / (na * nb)));
  const gradi = Math.acos(cos) * SKY_R2D;
  // A est o a ovest del Sole: la differenza fra le due longitudini viste da
  // qui. A est vuol dire che tramonta dopo di lui, cioè che si vede la sera.
  const lonP = Math.atan2(by, bx) * SKY_R2D;
  const lonS = Math.atan2(ay, ax) * SKY_R2D;
  const d = ((lonP - lonS) % 360 + 360) % 360;
  return { gradi, est: d < 180, distanza: nb };
}

// Che cosa vuol dire, per chi stanotte esce a guardare
function solQuandoSiVede(el, corpo) {
  if (!el) return '';
  const dove = el.est ? 'a ovest, dopo il tramonto' : 'a est, prima dell\'alba';
  if (el.gradi < 15) {
    return corpo.r < 1
      ? 'È quasi in linea col Sole: per qualche settimana resta dentro alla sua luce.'
      : 'È dietro al Sole, o quasi: sorge e tramonta con lui, e non si vede.';
  }
  if (el.gradi > 150) return 'È dalla parte opposta al Sole: sorge quando lui tramonta e resta in cielo tutta la notte.';
  if (el.gradi < 45) return `Si stacca poco dal Sole: lo trovi basso ${dove}.`;
  if (el.est) return 'Lo vedi la sera, già alto al buio, e tramonta nel cuore della notte.';
  return 'Lo vedi nella seconda metà della notte: sorge a notte fonda e resta fino all\'alba.';
}

function solNumero(v, cifre) {
  return v.toLocaleString('it-IT', { maximumFractionDigits: cifre });
}

function solRigaTabella(p, terra) {
  const el = solElongazione(p, terra);
  if (!el && p.id !== 'Earth') return '';
  const scelto = sol.scelto === p.id ? ' attiva' : '';
  if (p.id === 'Earth') {
    return `<button type="button" class="sol-riga-pianeta sei-qui${scelto}" data-sol-pianeta="Earth">
        <span class="sol-pallino" style="background:${p.colore}"></span>
        <span class="sol-nome">Terra</span>
        <span class="sol-dato">sei qui</span>
        <span class="sol-dato">${solNumero(p.r, 3)} UA dal Sole</span>
      </button>`;
  }
  const breve = el.gradi < 15 ? 'nella luce del Sole'
    : (el.gradi > 150 ? 'tutta la notte' : (el.est ? 'la sera' : 'la mattina'));
  return `<button type="button" class="sol-riga-pianeta${scelto}" data-sol-pianeta="${p.id}">
      <span class="sol-pallino" style="background:${p.colore}"></span>
      <span class="sol-nome">${p.nome}</span>
      <span class="sol-dato">${solNumero(el.distanza, 2)} UA da noi</span>
      <span class="sol-dato">${Math.round(el.gradi)}° dal Sole</span>
      <span class="sol-quando-breve">${breve}</span>
    </button>`;
}

function solSchedaHtml() {
  if (!sol.pianeti.length) {
    return '<p class="sol-vuoto">Senza la libreria di calcolo non si possono mettere i pianeti al loro posto. ' +
      'Torna quando c\'è rete: da lì in poi funziona anche offline.</p>';
  }
  const terra = sol.pianeti.find(p => p.id === 'Earth');
  const scelto = sol.pianeti.find(p => p.id === sol.scelto) || null;

  let testa = '';
  if (scelto && scelto.id !== 'Earth') {
    const el = solElongazione(scelto, terra);
    const luce = el.distanza * SOL_LUCE_MIN_UA;
    const luceTesto = luce < 60 ? `${Math.round(luce)} minuti` : `${solNumero(luce / 60, 1)} ore`;
    testa = `<div class="sol-testa">
        <h4 style="color:${scelto.colore}">${scelto.nome}</h4>
        <ul class="sol-dati">
          <li><span>Dal Sole</span><strong>${solNumero(scelto.r, 3)} UA</strong></li>
          <li><span>Da noi</span><strong>${solNumero(el.distanza, 3)} UA</strong>
            <em>${solNumero(el.distanza * SOL_UA_KM / 1e6, 0)} milioni di km</em></li>
          <li><span>La sua luce ci mette</span><strong>${luceTesto}</strong></li>
          <li><span>Angolo dal Sole in cielo</span><strong>${Math.round(el.gradi)}°</strong>
            <em>${el.gradi < 3 || el.gradi > 177 ? 'in linea' : (el.est ? 'a est del Sole' : 'a ovest del Sole')}</em></li>
        </ul>
        <p class="sol-frase">${solQuandoSiVede(el, scelto)}</p>
        <div class="sol-azioni">
          <button type="button" class="tasto-cielo tasto-primario" onclick="solGuardaNelPlanetario()">Guardalo nel planetario</button>
        </div>
      </div>`;
  } else if (scelto) {
    testa = `<div class="sol-testa">
        <h4 style="color:${scelto.colore}">Terra</h4>
        <p class="sol-frase">Sei qui, sul pallino azzurro. La riga che parte da qui, quando scegli un pianeta,
          è la direzione in cui devi guardare: è la stessa che il planetario ti mostra dentro alla cupola.</p>
      </div>`;
  }

  const righe = sol.pianeti.map(p => solRigaTabella(p, terra)).join('');
  return `${testa}<div class="sol-tabella">${righe}</div>`;
}

function solAggiornaScheda(forza) {
  const box = document.getElementById('sol-scheda');
  if (!box) return;
  const html = solSchedaHtml();
  const firma = `${sol.scelto}|${Math.round(sol.istante / 60000)}|${html.length}`;
  if (!forza && firma === sol.firmaScheda) return;
  sol.firmaScheda = firma;
  box.innerHTML = html;
  box.querySelectorAll('[data-sol-pianeta]').forEach(b =>
    b.addEventListener('click', () => solScegli(b.dataset.solPianeta)));
}

function solScegli(id) {
  sol.scelto = sol.scelto === id ? null : id;
  solAggiornaScheda(true);
  solDisegna();
}

// Dal disegno alla cupola: chiude la finestra e lascia il planetario puntato
// sull'oggetto che si stava guardando da fuori
window.solGuardaNelPlanetario = () => {
  const id = sol.scelto;
  chiudiSistemaSolare();
  if (id && id !== 'Earth') skyImpostaTarget(id, { mantieni: true });
};

// --- Il tempo: la stessa barra del planetario -------------------------------
//   Stessi tasti nello stesso ordine — ⟲, l'istante, un passo indietro, la
//   slitta, un passo avanti, il play — perché chi l'ha già usata sotto al
//   cielo qui non deve imparare niente. L'istante è quello del planetario:
//   quello che si sposta di qua si trova spostato anche di là.
//
//   Cambia solo la misura del passo, che lì sono minuti e qui sono giorni: un
//   pianeta in dieci minuti non si muove. Il passo scelto decide tre cose
//   insieme — quanto saltano i tasti − e +, quanto tempo copre la slitta, e
//   quanto corre il play (tre passi al secondo) — così la velocità non è un
//   comando in più da capire.

function solPasso() {
  return SOL_PASSI[Math.max(0, Math.min(SOL_PASSI.length - 1, sol.passoIndice || 0))];
}

function solOffset() {
  return sky.offsetTempoSec || 0;
}

// Di quanto si è lontani da adesso, in parole corte
function solScartoTesto(sec) {
  const g = sec / 86400;
  const a = Math.abs(g);
  const segno = g >= 0 ? '+' : '−';
  if (a < 1) return `${segno}${Math.round(Math.abs(sec) / 3600)} h`;
  if (a < 60) return `${segno}${Math.round(a)} g`;
  if (a < 365) return `${segno}${Math.round(a / 30.44)} mesi`;
  return `${segno}${(a / 365.25).toFixed(a < 3652 ? 1 : 0)} anni`;
}

// La lettura, la slitta e i tasti: tutto quello che la barra mostra di sé
function solAggiornaBarra(quando) {
  const scarto = solOffset();
  const spostato = Math.abs(scarto) >= 1;

  const lettura = document.getElementById('sol-quando');
  if (lettura) {
    const data = (quando || skyAdesso()).toLocaleDateString('it-IT',
      { day: 'numeric', month: 'short', year: 'numeric' });
    const testo = spostato ? `${data} · ${solScartoTesto(scarto)}` : `${data} · adesso`;
    if (lettura.textContent !== testo) lettura.textContent = testo;
  }
  const barra = document.getElementById('sol-tempo');
  if (barra) barra.classList.toggle('spostata', spostato);

  // La finestra segue l'istante quando questo le esce dai bordi: altrimenti
  // il cursore resterebbe incollato a un estremo senza poter più tornare
  const f = solPasso().finestra;
  if (Math.abs(scarto - sol.ancoraSec) > f) sol.ancoraSec = scarto;
  const slitta = document.getElementById('sol-slitta');
  if (slitta && document.activeElement !== slitta) {
    slitta.min = String(-f);
    slitta.max = String(f);
    slitta.step = String(Math.max(1, Math.round(f / 720)));
    const v = String(Math.max(-f, Math.min(f, scarto - sol.ancoraSec)));
    if (slitta.value !== v) slitta.value = v;
  }

  const play = document.getElementById('sol-play');
  if (play) {
    // Il tempo può camminare per due motivi: il play di questa barra, oppure
    // il playback lasciato acceso nel planetario. È lo stesso orologio, e il
    // tasto deve dire la verità su tutt'e due — se no qui si vede ❚❚ mentre
    // la scena si muove da sola
    const cammina = solInMarcia();
    play.textContent = cammina ? '❚❚' : '▶';
    play.classList.toggle('attiva', !!cammina);
    play.setAttribute('aria-pressed', cammina ? 'true' : 'false');
    play.title = cammina
      ? (sky.playbackVerso ? `Ferma il tempo (playback del planetario, ${skyVelocitaPlayback().nome})` : 'Ferma il tempo')
      : 'Fai camminare il tempo';
  }
  document.querySelectorAll('#sol-passi [data-sol-passo]').forEach(b => {
    const attivo = Number(b.dataset.solPasso) === sol.passoIndice;
    b.classList.toggle('attiva', attivo);
    b.setAttribute('aria-pressed', attivo ? 'true' : 'false');
  });

  // Col pannello del tempo in prestito qui (7.5-ter) il ciclo del cielo è in
  // pausa, e nessuno rinfrescherebbe la data scritta nel campo né la lettura
  // lunga: mentre il pannello è aperto ci pensa questa barra
  if (solPannelloTempoAperto()) skyAggiornaTestoTempo();
}

// Il tempo cammina, sì o no — comunque lo si sia messo in moto. Il playback
// del planetario resta acceso anche mentre questa finestra è aperta (è lo
// stesso orologio: chi lo fa avanzare, finché il cielo è in pausa dietro alla
// finestra, è il ciclo di qui), quindi «in marcia» sono due cose che valgono
// come una.
function solInMarcia() {
  return sol.marcia || sky.playbackVerso || 0;
}

// Ferma il tempo da qualunque parte lo si sia avviato
function solFermaTempo() {
  sol.marcia = 0;
  if (sky.playbackVerso) skyFermaPlayback();
}

function solAlternaMarcia() {
  if (solInMarcia()) solFermaTempo();
  else sol.marcia = 1;
  solAggiornaBarra();
}

function solSpostaDiUnPasso(verso) {
  solFermaTempo();
  skyImpostaOffsetTempo(solOffset() + verso * solPasso().sec);
  solAggiornaBarra();
}

function solImpostaPasso(indice) {
  sol.passoIndice = Math.max(0, Math.min(SOL_PASSI.length - 1, indice));
  sol.ancoraSec = solOffset();      // la finestra nuova si centra su dove siamo
  solAggiornaBarra();
}

function solTornaAdesso() {
  solFermaTempo();
  sol.ancoraSec = 0;
  skyImpostaOffsetTempo(0);
  solAggiornaBarra();
}

// --- Ciclo, comandi e gesti ------------------------------------------------

function solRidimensiona() {
  if (!sol.canvas) return;
  const dpr = window.devicePixelRatio || 1;
  sol.L = sol.canvas.clientWidth || 320;
  sol.H = sol.canvas.clientHeight || 320;
  sol.canvas.width = Math.round(sol.L * dpr);
  sol.canvas.height = Math.round(sol.H * dpr);
  sol.ctx = sol.canvas.getContext('2d');
  sol.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Quanto della tela si prende la barra del tempo, che le sta appoggiata
  // sopra: le scritte in fondo devono restarle sopra, e la misura la dà lei
  const barra = document.getElementById('sol-tempo');
  sol.altaBarra = barra ? barra.offsetHeight + 20 : 0;
}

function solCiclo(ts) {
  if (!sol.aperto) return;
  const dt = sol.ultimoTs ? Math.min((ts - sol.ultimoTs) / 1000, 0.1) : 0;
  sol.ultimoTs = ts;

  // Il tempo che cammina: lo si sposta con `fluido`, cioè senza forzare a
  // ogni fotogramma il ricalcolo di tutto il planetario che sta dietro. I
  // conti veri li rifà questa vista, che ha bisogno solo di otto vettori.
  if (sol.marcia) {
    const avanti = solOffset() + sol.marcia * solPasso().sec * SOL_PASSI_AL_SECONDO * dt;
    skyImpostaOffsetTempo(avanti, { fluido: true });
    if (skyAlCapolineaDelTempo()) { sol.marcia = 0; }
  } else if (sky.playbackVerso) {
    // Il playback acceso nel planetario non si ferma perché si è aperta questa
    // finestra: il cielo dietro è in pausa, ma l'orologio è lo stesso e a
    // farlo camminare, adesso, è questo ciclo. Senza, la barra diceva «▶ 1 h/s»
    // e la scena restava immobile — due orologi che dicevano cose diverse.
    skyAvanzaPlayback();
  }

  // La telecamera raggiunge il punto di vista chiesto scivolando. Smorzamento
  // esponenziale col `dt` del fotogramma, come i movimenti del planetario
  // (sezione 7.4-ter): a 30 o a 120 fotogrammi al secondo il viaggio dura
  // uguale. Lo zoom si interpola in geometrica — raddoppiare e dimezzare
  // devono costare lo stesso.
  const versoVista = 1 - Math.exp(-dt / SOL_TAU_VISTA);
  sol.elev += (sol.elevVoluta - sol.elev) * versoVista;
  if (Math.abs(sol.zoomVoluto - sol.zoom) > 0.0005) {
    sol.zoom *= Math.pow(sol.zoomVoluto / sol.zoom, 1 - Math.exp(-dt / SOL_TAU_ZOOM));
  } else sol.zoom = sol.zoomVoluto;

  const quando = skyAdesso();
  solLeggiPosizioni(quando);
  solCalcolaOrbite(quando);
  solDisegna();

  // I numeri scritti sotto vanno più piano del disegno: rifare la tabella a
  // sessanta fotogrammi al secondo si sente, e nessuno la legge così in fretta
  if (ts > sol.prossimaScheda) {
    sol.prossimaScheda = ts + 250;
    solAggiornaBarra(quando);
    solAggiornaScheda(false);
  }

  sol.raf = requestAnimationFrame(solCiclo);
}

function solImpostaVista(nome) {
  const v = SOL_VISTE[nome];
  if (v) sol.elevVoluta = v.elev;
  solAggiornaTasti();
}

function solImpostaZoom(z, opzioni = {}) {
  const valore = Math.max(0.35, Math.min(60, z));
  sol.zoomVoluto = valore;
  if (!opzioni.morbido) sol.zoom = valore;
  solAggiornaTasti();
}

function solAggiornaTasti() {
  const segna = (sel, prova) => document.querySelectorAll(sel).forEach(b => {
    const attivo = prova(b);
    b.classList.toggle('attiva', attivo);
    b.setAttribute('aria-pressed', attivo ? 'true' : 'false');
  });
  segna('#modale-sistema [data-sol-vista]', b => {
    const v = SOL_VISTE[b.dataset.solVista];
    return v && Math.abs(sol.elevVoluta - v.elev) < 0.5;
  });
  segna('#modale-sistema [data-sol-distanze]', b => (b.dataset.solDistanze === 'vere') === sol.distanzeVere);
  segna('#modale-sistema [data-sol-altezze]', b => Number(b.dataset.solAltezze) === sol.esagera);
  segna('#modale-sistema [data-sol-misure]', b => (b.dataset.solMisure === 'vere') === sol.misureVere);
}

// Il gesto è il comando principale di questa vista: si gira la scena col
// dito come si girerebbe un modellino in mano. In orizzontale gira attorno
// all'asse, in verticale alza e abbassa il punto di vista fino a entrare nel
// piano delle orbite — che è il momento in cui si capisce.
//
// Il verso è quello del modellino, non quello della telecamera: il dito
// spinge il Sistema Solare, non l'occhio che lo guarda. Trascinando verso
// destra la scena gira verso destra, e tirando verso il basso si scende sul
// piano delle orbite — come se la si prendesse per il bordo e la si
// inclinasse verso di sé. Prima era l'opposto (si muoveva il punto di vista)
// e ogni volta bisognava provare in che verso andasse.
const SOL_GIRO_PER_PIXEL = 0.008;    // radianti di azimut per pixel di dito
const SOL_ELEV_PER_PIXEL = 0.32;     // gradi di elevazione per pixel di dito

// Rimette la scena in mezzo alla tela: lo spostamento con due dita è comodo
// finché non ci si perde, e allora serve un modo solo per tornare.
function solCentra() {
  sol.panX = 0;
  sol.panY = 0;
  if (sol.aperto) solDisegna();
}

function solSposta(dx, dy) {
  sol.panX += dx;
  sol.panY += dy;
}

function solInizializzaGesti() {
  const c = sol.canvas;
  if (!c || c.dataset.gestiPronti === 'si') return;
  c.dataset.gestiPronti = 'si';

  const distanzaDita = () => {
    const p = [...sol.puntatori.values()];
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  };

  // Il punto di mezzo fra le dita appoggiate: con due dita è quello che
  // comanda lo spostamento della scena, mentre la loro distanza comanda lo zoom
  const centroDita = () => {
    const p = [...sol.puntatori.values()];
    if (!p.length) return { x: 0, y: 0 };
    return {
      x: p.reduce((s, q) => s + q.x, 0) / p.length,
      y: p.reduce((s, q) => s + q.y, 0) / p.length
    };
  };

  // Ogni volta che il numero di dita cambia, i due riferimenti del gesto —
  // da dove sta scorrendo il trascinamento e quanto erano lontane le dita
  // quando è cominciato il pizzico — ripartono da adesso.
  //
  // Senza questo c'era il salto: si pizzicava per avvicinarsi, si staccava un
  // dito, e il primo millimetro percorso dal dito rimasto veniva misurato dal
  // punto in cui quel dito si era appoggiato *prima* del pizzico. Due dita
  // allargate di sei centimetri diventavano una ventina di gradi di rotazione
  // in un fotogramma solo: la scena scattava di lato, e sembrava che fossero
  // i pianeti a essersi spostati. Lo stesso capitava col terzo dito
  // appoggiato per sbaglio col palmo.
  const riancora = () => {
    const dita = [...sol.puntatori.values()];
    sol.trascinamento = dita.length === 1 ? { x: dita[0].x, y: dita[0].y } : null;
    if (dita.length < 2) { sol.pizzico = null; return; }
    // Con le dita sopra, lo zoom morbido si ferma: da qui in poi comanda il
    // pizzico, e deve partire esattamente da quello che si sta vedendo — non
    // dal campo verso cui la vista stava ancora scivolando
    sol.zoomVoluto = sol.zoom;
    const m = centroDita();
    sol.pizzico = { d: distanzaDita(), zoom: sol.zoom, cx: m.x, cy: m.y };
  };

  c.addEventListener('pointerdown', (e) => {
    c.setPointerCapture(e.pointerId);
    sol.puntatori.set(e.pointerId, { x: e.clientX, y: e.clientY });
    sol.mosso = 0;
    sol.giu = performance.now();
    // Col mouse un dito solo gira; per spostare la scena si tiene premuto
    // Maiusc o si trascina col tasto destro (o con quello centrale), che è
    // come si sposta una mappa in ogni altro programma
    if (sol.puntatori.size === 1) sol.modoPan = !!e.shiftKey || e.button === 1 || e.button === 2;
    // Le istruzioni servono finché non si è capito come si fa: al primo dito
    // appoggiato sulla scena hanno finito il loro lavoro e se ne vanno
    const aiuto = document.querySelector('#modale-sistema .sol-suggerimento');
    if (aiuto) aiuto.classList.add('sol-svanito');
    riancora();
  });

  c.addEventListener('pointermove', (e) => {
    if (!sol.puntatori.has(e.pointerId)) return;
    sol.puntatori.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Due dita fanno due cose insieme, come su una mappa: allontanandole si
    // ingrandisce, spostandole tutt'e due si sposta la scena. Il punto di
    // mezzo è la maniglia — resta sotto le dita mentre lo zoom lavora
    if (sol.puntatori.size >= 2 && sol.pizzico) {
      const d = distanzaDita();
      if (sol.pizzico.d > 4) solImpostaZoom(sol.pizzico.zoom * (d / sol.pizzico.d));
      const m = centroDita();
      solSposta(m.x - sol.pizzico.cx, m.y - sol.pizzico.cy);
      sol.pizzico.cx = m.x;
      sol.pizzico.cy = m.y;
      sol.mosso += 10;
      return;
    }
    if (!sol.trascinamento) return;
    const dx = e.clientX - sol.trascinamento.x;
    const dy = e.clientY - sol.trascinamento.y;
    sol.trascinamento = { x: e.clientX, y: e.clientY };
    sol.mosso += Math.abs(dx) + Math.abs(dy);
    if (sol.modoPan) { solSposta(dx, dy); return; }
    // Il verso del modellino: il dito porta con sé la scena
    sol.az += dx * SOL_GIRO_PER_PIXEL;
    const elev = Math.max(-89, Math.min(89, sol.elevVoluta + dy * SOL_ELEV_PER_PIXEL));
    sol.elevVoluta = elev;
    sol.elev = elev;
    solAggiornaTasti();
  });

  const fine = (e) => {
    const era = sol.puntatori.size;
    if (!sol.puntatori.delete(e.pointerId)) return;
    // Il dito che resta ricomincia da dove si trova adesso, e la rotazione
    // continua da lì senza doverlo staccare e riappoggiare
    riancora();
    // Un tocco secco, senza trascinamento: sceglie il pianeta più vicino
    if (era === 1 && sol.mosso < 8 && performance.now() - sol.giu < 500 && !sol.modoPan) solTocco(e);
    if (!sol.puntatori.size) sol.modoPan = false;
  };
  c.addEventListener('pointerup', fine);
  c.addEventListener('pointercancel', fine);
  c.addEventListener('pointerleave', fine);

  // Col tasto destro si sposta la scena: il menù contestuale, qui, sarebbe
  // solo il modo di interrompere il gesto a metà
  c.addEventListener('contextmenu', (e) => e.preventDefault());

  // La rotella non salta: chiede un campo e ci si scivola dentro, com'è nel
  // planetario (sezione 7.4-ter). Il conto parte da dove la vista *sta
  // andando*, non da dov'è arrivata: così due scatti di rotella di fila si
  // sommano, invece che il secondo rimangiarsi il viaggio del primo.
  c.addEventListener('wheel', (e) => {
    e.preventDefault();
    const pixel = e.deltaMode === 1 ? e.deltaY * 16 : (e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY);
    const scatti = Math.max(-4, Math.min(4, pixel / 100));
    if (scatti) solImpostaZoom(sol.zoomVoluto * Math.exp(-scatti * 0.12), { morbido: true });
  }, { passive: false });
}

function solTocco(e) {
  if (!sol.canvas || !sol.pianeti.length) return;
  const r = sol.canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  // Ogni pianeta ha la sua area sensibile — almeno un polpastrello, di più se
  // il pallino è grosso — ma a vincere è sempre il più vicino al dito: la
  // soglia dice *se* si può prendere, non *chi* si prende.
  let migliore = null, miglioreD = Infinity;
  sol.pianeti.forEach(p => {
    if (!p.schermo) return;
    const d = Math.hypot(p.schermo.px - x, p.schermo.py - y);
    if (d <= Math.max(22, (p.rDisegno || p.raggio) + 10) && d < miglioreD) { migliore = p; miglioreD = d; }
  });
  if (migliore) solScegli(migliore.id);
}

// --- Apertura e chiusura ---------------------------------------------------

window.apriSistemaSolare = () => {
  const modale = document.getElementById('modale-sistema');
  if (!modale) return;
  sol.canvas = document.getElementById('sol-canvas');
  if (!sol.canvas) return;

  // Si entra guardando quello che si stava guardando: se nel planetario era
  // scelto un pianeta, la riga dello sguardo parte già puntata su di lui
  const bersaglio = SOL_PIANETI.some(p => p.id === sky.target) ? sky.target : null;
  sol.scelto = bersaglio;
  sol.marcia = 0;
  // La scena riparte in mezzo alla tela: lo spostamento di due dita è una
  // cosa di questa sessione, non una preferenza da ritrovare
  sol.panX = 0;
  sol.panY = 0;
  sol.modoPan = false;
  // Si entra anche nello stesso istante, sempre: l'orologio è quello del
  // planetario, e la finestra della slitta si centra su dove siamo
  sol.ancoraSec = sky.offsetTempoSec || 0;
  sol.firmaScheda = '';
  sol.prossimaScheda = 0;
  sol.ultimoTs = 0;
  sol.istante = 0;
  solGeneraStelle(110);
  solInizializzaGesti();
  const aiuto = modale.querySelector('.sol-suggerimento');
  if (aiuto) aiuto.classList.remove('sol-svanito');
  solAggiornaTasti();
  solAggiornaBarra();

  modale.classList.remove('hidden');
  sol.aperto = true;

  // Due tele che si ridisegnano insieme su un telefono si sentono, e il
  // planetario dietro alla finestra non lo guarda nessuno: si mette in pausa
  // (com'è per la lezione dell'eclittica, sezione 7.3-quater)
  sol.skyDaRiprendere = !!sky.raf;
  if (sky.raf) { cancelAnimationFrame(sky.raf); sky.raf = null; }

  requestAnimationFrame(() => {
    solRidimensiona();
    const quando = skyAdesso();
    solLeggiPosizioni(quando);
    solCalcolaOrbite(quando);
    solAggiornaBarra(quando);
    solAggiornaScheda(true);
    if (!sol.raf) sol.raf = requestAnimationFrame(solCiclo);
  });
};

function chiudiSistemaSolare() {
  // Il pannello del tempo qui è in prestito: va restituito *prima* di chiudere
  // la finestra, o resterebbe murato dentro a un modale nascosto — e il
  // planetario si ritroverebbe senza i suoi comandi del tempo (7.5-ter)
  solChiudiPannelloTempo();
  const modale = document.getElementById('modale-sistema');
  if (modale) modale.classList.add('hidden');
  sol.aperto = false;
  // La marcia di questa vista finisce con lei: i suoi passi (un giorno, un
  // mese, un anno per scatto) non hanno un corrispondente fra le velocità del
  // playback del planetario, e farlo ripartire a caso vorrebbe dire tornare
  // su un cielo che scappa. Il playback del planetario, invece, se era acceso
  // resta acceso: qui dentro non si è mai fermato, l'ha solo fatto camminare
  // il ciclo di questa finestra.
  sol.marcia = 0;
  if (sol.raf) cancelAnimationFrame(sol.raf);
  sol.raf = null;

  // Il tempo camminato qui dentro è quello del planetario: prima di tornarci
  // si arrotonda al secondo e si forza il ricalcolo, che durante la marcia
  // fluida era stato saltato apposta
  skyImpostaOffsetTempo(Math.round(sky.offsetTempoSec || 0));

  if (sol.skyDaRiprendere && sky.aperto && !sky.raf) {
    sky.raf = requestAnimationFrame(skyCiclo);
  }
  sol.skyDaRiprendere = false;
}

function inizializzaSistemaSolare() {
  const modale = document.getElementById('modale-sistema');
  if (!modale) return;

  ['btn-chiudi-sistema', 'btn-chiudi-sistema-basso'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', chiudiSistemaSolare);
  });
  modale.addEventListener('click', e => { if (e.target === modale) chiudiSistemaSolare(); });

  modale.querySelectorAll('[data-sol-vista]').forEach(b =>
    b.addEventListener('click', () => solImpostaVista(b.dataset.solVista)));

  modale.querySelectorAll('[data-sol-quadro]').forEach(b =>
    b.addEventListener('click', () => {
      const interni = b.dataset.solQuadro === 'interni';
      // Questi due sono comandi di inquadratura: se la scena era stata
      // spostata di lato, "Tutto" deve tornare a farla vedere tutta
      solCentra();
      solImpostaZoom(solZoomPer(interni ? 1.7 : SOL_RIF_UA), { morbido: true });
    }));

  modale.querySelectorAll('[data-sol-distanze]').forEach(b =>
    b.addEventListener('click', () => {
      const vere = b.dataset.solDistanze === 'vere';
      if (vere === sol.distanzeVere) return;
      // Cambiare metro cambia quanti pixel vale un'unità astronomica: senza
      // rifare i conti, passando alle distanze vere la scena si accartoccia
      // dentro al Sole e non si capisce più cosa sia successo. Si tiene fermo
      // quello che sta al bordo: l'inquadratura resta la stessa, e si vede
      // solo la cosa che conta, cioè i pianeti che si riordinano dentro.
      const bordo = solUaAlBordo(sol.zoomVoluto);
      sol.distanzeVere = vere;
      const r = solRaggio(bordo);
      solImpostaZoom(r > 0 ? 0.5 / (0.44 * r) : 1, { morbido: true });
      solAggiornaTasti();
      solDisegna();
    }));

  modale.querySelectorAll('[data-sol-altezze]').forEach(b =>
    b.addEventListener('click', () => {
      sol.esagera = Number(b.dataset.solAltezze) || 1;
      solAggiornaTasti();
      solDisegna();
    }));

  const zoomIn = document.getElementById('sol-zoom-in');
  if (zoomIn) zoomIn.addEventListener('click', () => solImpostaZoom(sol.zoomVoluto * 1.4, { morbido: true }));
  const zoomOut = document.getElementById('sol-zoom-out');
  if (zoomOut) zoomOut.addEventListener('click', () => solImpostaZoom(sol.zoomVoluto / 1.4, { morbido: true }));
  const centra = document.getElementById('sol-centra');
  if (centra) centra.addEventListener('click', solCentra);

  modale.querySelectorAll('[data-sol-misure]').forEach(b =>
    b.addEventListener('click', () => {
      sol.misureVere = b.dataset.solMisure === 'vere';
      solAggiornaTasti();
      solDisegna();
    }));

  // La barra del tempo
  const play = document.getElementById('sol-play');
  if (play) play.addEventListener('click', solAlternaMarcia);
  const adesso = document.getElementById('sol-tempo-adesso');
  if (adesso) adesso.addEventListener('click', solTornaAdesso);
  // La lettura è la porta del pannello del tempo, come nel planetario (7.5-ter)
  const quando = document.getElementById('sol-quando');
  if (quando) quando.addEventListener('click', solAlternaPannelloTempo);
  const chiudiTempo = document.getElementById('sol-tempo-chiudi');
  if (chiudiTempo) chiudiTempo.addEventListener('click', solChiudiPannelloTempo);
  const meno = document.getElementById('sol-passo-meno');
  if (meno) meno.addEventListener('click', () => solSpostaDiUnPasso(-1));
  const piu = document.getElementById('sol-passo-piu');
  if (piu) piu.addEventListener('click', () => solSpostaDiUnPasso(1));

  const slitta = document.getElementById('sol-slitta');
  if (slitta) {
    // Mentre il pollice scorre arrivano decine di valori al secondo: il tempo
    // si sposta «fluido», cioè senza rifare a ogni valore i conti di tutto il
    // planetario che sta dietro (a questa vista bastano otto vettori, e se li
    // rifà da sé a ogni fotogramma). Il conto pieno si fa quando il dito si
    // stacca.
    slitta.addEventListener('input', () => {
      solFermaTempo();
      skyImpostaOffsetTempo(sol.ancoraSec + Number(slitta.value), { fluido: true, daSlitta: true });
    });
    slitta.addEventListener('change', () => {
      skyImpostaOffsetTempo(Math.round(sol.ancoraSec + Number(slitta.value)));
      solAggiornaBarra();
    });
  }

  const passi = document.getElementById('sol-passi');
  if (passi && passi.dataset.pronto !== 'si') {
    passi.innerHTML = SOL_PASSI.map((v, i) =>
      `<button type="button" class="tasto-segmento" data-sol-passo="${i}" ` +
      `title="I tasti − e + saltano di un ${v.nome}, e il play ne fa tre al secondo">${v.nome}</button>`).join('');
    passi.querySelectorAll('[data-sol-passo]').forEach(b =>
      b.addEventListener('click', () => solImpostaPasso(Number(b.dataset.solPasso))));
    passi.dataset.pronto = 'si';
  }

  document.addEventListener('keydown', e => {
    if (!sol.aperto) return;
    // Col pannello del tempo aperto l'Esc è suo: chiude quello e la scena
    // resta dov'è, com'è nel planetario per le finestre sopra al cielo
    if (e.key === 'Escape' && solPannelloTempoAperto()) { solChiudiPannelloTempo(); return; }
    // E finché si scrive una data, le frecce e lo spazio sono del campo
    if (solPannelloTempoAperto() && e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    // Le frecce girano la scena nello stesso verso del dito; con Maiusc
    // premuto la spostano, come il trascinamento col tasto destro
    const passoPan = 40;
    if (e.key === 'Escape') chiudiSistemaSolare();
    else if (e.key === 'ArrowLeft') { e.shiftKey ? solSposta(-passoPan, 0) : (sol.az -= 0.12); }
    else if (e.key === 'ArrowRight') { e.shiftKey ? solSposta(passoPan, 0) : (sol.az += 0.12); }
    else if (e.key === 'ArrowUp') {
      if (e.shiftKey) solSposta(0, -passoPan);
      else { sol.elevVoluta = Math.max(-89, sol.elevVoluta - 4); solAggiornaTasti(); }
    } else if (e.key === 'ArrowDown') {
      if (e.shiftKey) solSposta(0, passoPan);
      else { sol.elevVoluta = Math.min(89, sol.elevVoluta + 4); solAggiornaTasti(); }
    } else if (e.key === 'c' || e.key === 'C') solCentra();
    else if (e.key === ' ') { e.preventDefault(); solAlternaMarcia(); }
  });

  window.addEventListener('resize', () => { if (sol.aperto) { solRidimensiona(); solDisegna(); } });
}

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

// Con l'anno, o senza. Il riquadro dell'ora sta appoggiato in alto a sinistra
// sopra alla scena: su un canvas stretto la forma lunga arriva fino in mezzo e
// copre quello che c'è sotto (la N della cupola, il bordo della Luna). L'anno
// intanto è già scritto nel titolo della finestra.
function simOraTesto(data, compatto) {
  return data.toLocaleString('it-IT', Object.assign(
    { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    compatto ? {} : { year: 'numeric' }
  ));
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

// Le scritte restano dentro il riquadro. Su uno schermo stretto le etichette
// che stanno sul bordo — i punti cardinali della cupola, i nomi sotto agli
// astri, la percentuale sotto al riquadro del telescopio — cadevano mezze
// fuori dal canvas: si spostano del minimo che serve a leggerle per intero.
function simEtichetta(ctx, testo, x, y, colore, allineamento, grassetto) {
  ctx.save();
  ctx.font = `${grassetto ? 'bold ' : ''}13px system-ui, sans-serif`;
  const allinea = allineamento || 'center';
  const larghezza = ctx.measureText(testo).width;
  const aSinistra = allinea === 'center' ? larghezza / 2 : allinea === 'right' ? larghezza : 0;
  const aDestra = allinea === 'center' ? larghezza / 2 : allinea === 'right' ? 0 : larghezza;
  const margine = 5;
  // Se la scritta è più larga del canvas non c'è niente da salvare: si lascia
  // dov'è, centrata sul punto, invece di spingerla tutta da una parte.
  if (aSinistra + aDestra + 2 * margine <= sim.L) {
    x = simClamp(x, margine + aSinistra, sim.L - margine - aDestra);
  }
  y = simClamp(y, 9, sim.H - 9);
  ctx.fillStyle = colore || '#e2e8f0';
  ctx.textAlign = allinea;
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

// Da dove guardare questa eclissi nella simulazione. La risposta giusta è
// "da casa tua": è l'unico punto di vista che dica qualcosa a chi guarda.
// Se da lì l'eclissi non si vede si ripiega sul punto di massima eclissi,
// dicendolo, invece di far credere che il Sole sparisca anche in giardino.
function simContestoEclissiSolare(ev, dati) {
  if (typeof Astronomy === 'undefined' || typeof dati.peakUt !== 'number') return null;
  try {
    const peakUt = dati.peakUt;
    const finestra = _eclFinestraGlobale(peakUt);
    const prova = (la, lo) => {
      const c = _eclCircostanzeLocali(la, lo, peakUt, finestra, ev.dataObj);
      return c && c.visibile ? c : null;
    };

    const casa = luogoCorrente();
    if (casa) {
      const circ = prova(casa.lat, casa.lon);
      if (circ) {
        return { peakUt, lat: casa.lat, lon: casa.lon, circ, daUtente: true,
                 nome: nomeLuogoVicino(casa.lat, casa.lon, 80) };
      }
    }

    // Il punto di massima eclissi, se l'ombra tocca la Terra; altrimenti il
    // punto in cui la Luna morde il Sole più a fondo.
    let lat = dati.lat, lon = dati.lon;
    if (lat == null || lon == null) {
      const p = _eclPuntoMassimo(_eclIstante(peakUt));
      if (!p) return null;
      lat = p[0]; lon = p[1];
    }
    const circ = prova(lat, lon);
    if (!circ) return null;
    return { peakUt, lat, lon, circ, daUtente: false, nome: nomeLuogoVicino(lat, lon, 120) };
  } catch (e) {
    console.error('Contesto dell\'eclissi non ricostruibile:', e);
    return null;
  }
}

// Come stanno Sole e Luna in un dato momento della simulazione, in un formato
// unico che la scena sa disegnare. Due sorgenti possibili: le posizioni vere
// calcolate per il luogo scelto, oppure — se la libreria astronomica non c'è
// o l'eclissi non è ricostruibile — la geometria plausibile di ripiego.
// Le lunghezze sono in raggi solari, che è l'unità con cui si disegna.
function simEclissiSolareIstante(tempo) {
  const s = sim.scena;
  const minuti = (tempo.getTime() - sim.evento.dataObj.getTime()) / SIM_MIN;

  if (s.ecl) {
    const c = _eclCircostanze(s.ecl.lat, s.ecl.lon,
                              _eclIstante(s.ecl.peakUt + minuti / 1440), true);
    return {
      minuti,
      rLuna: c.rLuna / c.rSole,
      sep: c.sep / c.rSole,
      vx: c.versoX, vy: c.versoY,
      alt: c.altSole, az: c.azSole,
      osc: c.oscGeometrico, tipo: c.tipoGeometrico,
      suOrizzonte: c.suOrizzonte, reale: true
    };
  }

  const g = s.geo;
  const dx = g.v * minuti;
  const sep = Math.hypot(g.dmin, dx);
  const n = sep > 1e-9 ? sep : 1;
  const tipo = sep >= 1 + g.k ? 'nessuna'
    : sep <= Math.abs(1 - g.k) ? (g.k >= 1 ? 'totale' : 'anulare')
    : 'parziale';
  return {
    minuti, rLuna: g.k, sep, vx: dx / n, vy: g.dmin / n,
    alt: 42, az: null, osc: simOscuramento(sep, g.k), tipo,
    suOrizzonte: true, reale: false
  };
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
    const ecl = simContestoEclissiSolare(ev, dati);
    if (ecl) {
      // La finestra è quella vera del luogo: dal primo all'ultimo contatto,
      // con un margine per vedere il Sole ancora intero alle due estremità.
      const c = ecl.circ;
      const margine = Math.max(3, (c.c4.min - c.c1.min) * 0.05);
      const dove = ecl.daUtente
        ? `dalla tua posizione${ecl.nome ? ` (${ecl.nome})` : ''}`
        : `da ${ecl.nome || formattaCoordinate(ecl.lat, ecl.lon)}, dove l’eclissi è al massimo`;
      return {
        tipo, dati, ecl,
        inizio: d + (c.c1.min - margine) * SIM_MIN,
        fine: d + (c.c4.min + margine) * SIM_MIN,
        durata: 30,
        nota: `Posizioni vere di Sole e Luna viste ${dove}: altezza sull’orizzonte, ` +
          `direzione da cui arriva la Luna e orari sono quelli veri. Attenzione: nella ` +
          `realtà il Sole va guardato solo con filtri certificati.`
      };
    }
    // Ripiego: una geometria plausibile, quando l'eclissi non è ricostruibile
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
  const L = sim.L, H = sim.H;
  const q = simEclissiSolareIstante(tempo);

  // La luce che resta ha due cause indipendenti, che si moltiplicano.
  // L'eclissi ne toglie pochissima fino a un soffio dalla totalità — l'occhio
  // compensa e per questo un 90% delude chi se lo aspetta buio. Il Sole basso
  // invece la toglie sempre, eclissi o no.
  const luceEclissi = Math.pow(1 - simClamp(q.osc, 0, 1), 0.28);
  const luceGiorno = simClamp((q.alt + 6) / 14, 0.04, 1);
  const luce = simClamp(luceEclissi * luceGiorno, 0, 1);
  const buio = 1 - luce;

  const orizzonte = H * 0.8;
  const rSole = Math.min(L, H) * 0.13;
  const cx = L / 2;
  // Il Sole sta dove sta davvero: alto a mezzogiorno, appoggiato sul
  // paesaggio quando l'eclissi lo coglie vicino al tramonto.
  const cy = orizzonte - (simClamp(q.alt, -8, 90) / 90) * (orizzonte - H * 0.14);

  // --- Cielo -----------------------------------------------------------
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const mix = (a, b) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * luce)},` +
                        `${Math.round(a[1] + (b[1] - a[1]) * luce)},` +
                        `${Math.round(a[2] + (b[2] - a[2]) * luce)})`;
  g.addColorStop(0, mix([5, 8, 22], [37, 99, 235]));
  g.addColorStop(1, mix([15, 23, 42], [186, 230, 253]));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L, H);

  // Durante la totalità l'orizzonte si accende di arancione tutt'intorno: è
  // il cielo illuminato di fuori, oltre il cono d'ombra, e sorprende sempre
  // più della corona. Lo stesso bagliore c'è, più tenue, col Sole basso.
  // Il bagliore arriva sul serio solo negli ultimi secondi: farlo comparire
  // già al 98% racconterebbe un'eclissi più spettacolare di quella vera.
  const alone360 = Math.max(
    simClamp((q.osc - 0.995) / 0.005, 0, 1) * 0.85,
    simClamp((10 - q.alt) / 18, 0, 1) * 0.55
  );
  if (alone360 > 0.01) {
    const b = ctx.createLinearGradient(0, orizzonte - H * 0.22, 0, orizzonte);
    b.addColorStop(0, 'rgba(251,146,60,0)');
    b.addColorStop(1, `rgba(251,146,60,${(0.45 * alone360).toFixed(3)})`);
    ctx.fillStyle = b;
    ctx.fillRect(0, orizzonte - H * 0.22, L, H * 0.22);
  }

  // Stelle e pianeti: in totalità si vedono davvero, in pieno giorno. Ma non
  // prima: anche col Sole coperto al 99% il cielo resta troppo chiaro, e
  // riempirlo di stelle darebbe l'idea sbagliata di cosa aspettarsi.
  simDisegnaStelleSfondo(ctx, simClamp((0.16 - luce) * 6, 0, 0.7));

  // --- Sole, corona, Luna ----------------------------------------------
  const mx = cx + q.vx * q.sep * rSole;
  const my = cy - q.vy * q.sep * rSole;   // sullo schermo lo zenit è in alto
  const rLuna = q.rLuna * rSole;
  const totale = q.tipo === 'totale';
  const anulare = q.tipo === 'anulare';

  // Alone diurno: si spegne man mano che il disco sparisce
  const alone = ctx.createRadialGradient(cx, cy, rSole * 0.9, cx, cy, rSole * 3.4);
  alone.addColorStop(0, `rgba(253,224,71,${(0.5 * luceEclissi * luceGiorno).toFixed(3)})`);
  alone.addColorStop(1, 'rgba(253,224,71,0)');
  ctx.fillStyle = alone;
  ctx.beginPath(); ctx.arc(cx, cy, rSole * 3.4, 0, Math.PI * 2); ctx.fill();

  // Corona: solo nella totalità vera. Non è un alone tondo — ha pennacchi
  // che si allungano da una parte e dall'altra, ed è quello che la rende
  // riconoscibile in ogni fotografia di eclissi.
  if (totale) {
    const forza = simClamp((q.osc - 0.999) / 0.001, 0, 1);
    ctx.save();
    ctx.globalAlpha = forza;
    ctx.globalCompositeOperation = 'lighter';
    [0.2, 1.35, 2.9, 4.3].forEach((ang, i) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.scale(1, i % 2 ? 0.34 : 0.46);
      const p = ctx.createRadialGradient(0, 0, rSole * 0.95, 0, 0, rSole * (i % 2 ? 3.1 : 2.4));
      p.addColorStop(0, 'rgba(226,232,240,0.5)');
      p.addColorStop(0.4, 'rgba(203,213,225,0.16)');
      p.addColorStop(1, 'rgba(203,213,225,0)');
      ctx.fillStyle = p;
      ctx.beginPath(); ctx.arc(0, 0, rSole * (i % 2 ? 3.1 : 2.4), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    // L'anello interno, quello brillante attaccato al bordo lunare
    const interna = ctx.createRadialGradient(cx, cy, rLuna * 0.98, cx, cy, rLuna * 1.55);
    interna.addColorStop(0, 'rgba(248,250,252,0.75)');
    interna.addColorStop(1, 'rgba(226,232,240,0)');
    ctx.fillStyle = interna;
    ctx.beginPath(); ctx.arc(cx, cy, rLuna * 1.55, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Disco solare
  ctx.beginPath(); ctx.arc(cx, cy, rSole, 0, Math.PI * 2);
  ctx.fillStyle = '#fde047'; ctx.fill();

  // Protuberanze: lingue rosa sul bordo, visibili solo a Sole coperto
  if (totale) {
    ctx.save();
    ctx.globalAlpha = simClamp((q.osc - 0.999) / 0.001, 0, 1);
    ctx.fillStyle = '#fb7185';
    [0.9, 2.5, 4.1, 5.6].forEach((ang, i) => {
      const rr = rLuna * (1 + 0.03 + 0.02 * (i % 3));
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr,
              rSole * (0.035 + 0.015 * (i % 2)), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // L'anello di fuoco delle anulari abbaglia quanto il Sole intero: gli si
  // dà un bagliore, perché è esattamente il punto in cui la gente sbaglia.
  // Va acceso prima della Luna: sommato sopra, le schiarirebbe la faccia in
  // ombra, che invece resta nera.
  if (anulare) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const an = ctx.createRadialGradient(cx, cy, rSole * 0.98, cx, cy, rSole * 1.8);
    an.addColorStop(0, 'rgba(253,224,71,0.55)');
    an.addColorStop(1, 'rgba(253,224,71,0)');
    ctx.fillStyle = an;
    ctx.beginPath(); ctx.arc(cx, cy, rSole * 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Disco lunare: nero, perché è la faccia in ombra della Luna. Si disegna
  // solo dove copre qualcosa — fuori dal Sole la Luna nuova è invisibile, e
  // un cerchio nero in mezzo al cielo azzurro sembrerebbe un buco nella
  // scena. In totalità invece la sagoma si staglia sulla corona, e allora
  // la si lascia vedere per intero.
  const centrale = totale || anulare;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, centrale ? Math.max(rSole, rLuna) : rSole, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath(); ctx.arc(mx, my, rLuna, 0, Math.PI * 2);
  ctx.fillStyle = '#0b1120'; ctx.fill();
  ctx.restore();

  // Grani di Baily e anello di diamante: negli ultimi secondi prima e dopo
  // la totalità il Sole filtra fra le montagne del bordo lunare. Si accendono
  // sul lembo che la Luna non ha ancora coperto, cioè dalla parte opposta al
  // suo spostamento.
  const soglia = Math.abs(q.rLuna - 1);
  const scarto = q.sep - soglia;              // >0: la fase centrale non c'è (ancora)
  if (q.rLuna >= 1 && scarto > 0 && scarto < 0.05 && q.osc > 0.9) {
    const forza = 1 - scarto / 0.05;
    const bx = cx - q.vx * rSole, by = cy + q.vy * rSole;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const d = ctx.createRadialGradient(bx, by, 0, bx, by, rSole * (0.5 + forza));
    d.addColorStop(0, `rgba(255,255,255,${(0.95 * forza).toFixed(3)})`);
    d.addColorStop(0.25, `rgba(254,240,138,${(0.5 * forza).toFixed(3)})`);
    d.addColorStop(1, 'rgba(254,240,138,0)');
    ctx.fillStyle = d;
    ctx.beginPath(); ctx.arc(bx, by, rSole * (0.5 + forza), 0, Math.PI * 2); ctx.fill();
    // I grani veri e propri, sparsi lungo il lembo, solo all'ultimo istante
    if (forza > 0.55) {
      const base = Math.atan2(by - cy, bx - cx);
      ctx.fillStyle = `rgba(255,255,255,${((forza - 0.55) * 2).toFixed(3)})`;
      [-0.34, -0.15, 0.12, 0.3].forEach((s, i) => {
        ctx.beginPath();
        ctx.arc(cx + Math.cos(base + s) * rSole, cy + Math.sin(base + s) * rSole,
                rSole * (0.022 + 0.012 * (i % 2)), 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  }

  // --- Paesaggio --------------------------------------------------------
  ctx.fillStyle = `rgb(${Math.round(30 - 24 * buio)},${Math.round(41 - 34 * buio)},${Math.round(59 - 47 * buio)})`;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, orizzonte + H * 0.02);
  ctx.quadraticCurveTo(L * 0.2, orizzonte - H * 0.06, L * 0.42, orizzonte + H * 0.03);
  ctx.quadraticCurveTo(L * 0.65, orizzonte + H * 0.12, L * 0.78, orizzonte);
  ctx.quadraticCurveTo(L * 0.9, orizzonte - H * 0.08, L, orizzonte + H * 0.04);
  ctx.lineTo(L, H);
  ctx.closePath();
  ctx.fill();

  // Bussola: da che parte guardare, e quanto in alto
  if (q.az != null) {
    simEtichetta(ctx, `${skyNomeDirezione(q.az)} · ${Math.round(q.az)}°`,
                 cx, orizzonte + H * 0.07, 'rgba(226,232,240,0.75)');
  }
  // L'altezza va in un angolo: accanto al Sole finirebbe sopra alla Luna
  // proprio nei momenti in cui la si guarda.
  if (q.reale) {
    simEtichetta(ctx, `Sole a ${q.alt.toFixed(0)}° sull'orizzonte`,
                 10, 18, 'rgba(226,232,240,0.6)', 'left');
  }

  // --- Il testo che accompagna la scena ---------------------------------
  const ecl = sim.scena.ecl;
  const c = ecl && ecl.circ;
  const nomeCentrale = anulare || (c && c.tipo === 'anulare') ? 'anularità' : 'totalità';

  let fase;
  if (!q.suOrizzonte) fase = 'Il Sole è sotto l’orizzonte: da qui, in questo momento, non si vede nulla';
  else if (totale) fase = 'TOTALITÀ: il giorno diventa notte e appare la corona solare';
  else if (anulare) fase = 'ANULARITÀ: resta un anello di fuoco, abbagliante come il Sole intero';
  else if (q.osc > 0.001) fase = 'Fase parziale: la Luna morde il disco del Sole';
  else fase = q.minuti < 0
    ? 'Il Sole è integro: l’eclissi non è ancora cominciata'
    : 'Il Sole è integro: l’eclissi è finita';

  // Un 99,97% non va arrotondato a "100%" mentre si scrive "fase parziale":
  // proprio lì la differenza fra i due numeri è tutta l'eclissi.
  const percOsc = (!centrale && q.osc >= 0.9995) ? '99,9%' : _eclPerc(q.osc);

  const righe = [
    `<p><strong>${fase}</strong></p>`,
    `<p>Sole oscurato: <strong>${percOsc}</strong> · luce ambientale residua ≈ ` +
      `<strong>${(luce * 100).toFixed(0)}%</strong>` +
      (q.reale ? ` · Sole a <strong>${q.alt.toFixed(0)}°</strong>` +
        (q.az != null ? ` verso ${skyNomeDirezione(q.az)}` : '') : '') + '</p>'
  ];

  if (c) {
    // Quanto manca al prossimo contatto: è il conto che si fa davvero mentre
    // si aspetta, molto più del tempo trascorso dall'inizio.
    const tappe = [
      c.c1 && { min: c.c1.min, testo: 'al primo contatto' },
      c.c2 && { min: c.c2.min, testo: `all’inizio della ${nomeCentrale}` },
      c.c3 && { min: c.c3.min, testo: `alla fine della ${nomeCentrale}` },
      c.c4 && { min: c.c4.min, testo: 'all’ultimo contatto' }
    ].filter(Boolean);
    const prossima = tappe.find(t => t.min > q.minuti + 0.01);
    if (prossima) {
      // Sotto il minuto e mezzo si contano i secondi: è la scala su cui si
      // ragiona negli istanti che contano.
      const secondi = (prossima.min - q.minuti) * 60;
      const quanto = secondi < 90
        ? `${Math.round(secondi)} s`
        : simDurataTesto(prossima.min - q.minuti);
      righe.push(`<p>Mancano <strong>${quanto}</strong> ${prossima.testo}.</p>`);
    } else {
      righe.push('<p>L’eclissi, da qui, è finita.</p>');
    }

    if (c.centrale && c.durataCentraleSec > 0) {
      righe.push(`<p>Da questo punto la ${nomeCentrale} dura ` +
        `<strong>${_eclDurataSec(c.durataCentraleSec)}</strong>.</p>`);
    } else {
      righe.push(`<p>Da questo punto il Sole non sparisce mai del tutto: si ferma al ` +
        `<strong>${_eclPerc(c.oscVisibile)}</strong>. Niente corona, e il filtro non va ` +
        `tolto in nessun momento.</p>`);
    }
    righe.push(ecl.daUtente
      ? `<p>Scena vista dalla tua posizione${ecl.nome ? ` (${ecl.nome})` : ''}: ` +
        `orari, altezza del Sole e direzione da cui arriva la Luna sono quelli veri.</p>`
      : `<p>Da casa tua questa eclissi non è visibile: la scena è vista da ` +
        `${ecl.nome || formattaCoordinate(ecl.lat, ecl.lon)}, dove l’eclissi è al massimo.</p>`);
  } else {
    righe.push(`<p>${q.minuti < 0 ? 'Mancano' : 'Sono passati'} ` +
      `<strong>${simDurataTesto(q.minuti)}</strong> ${q.minuti < 0 ? 'al' : 'dal'} massimo.</p>`);
    righe.push(sim.scena.dati.lat != null
      ? `<p>Scena vista dal punto di massima eclissi (${formattaCoordinate(sim.scena.dati.lat, sim.scena.dati.lon)}). Altrove il Sole viene coperto meno.</p>`
      : '<p>Eclissi parziale ovunque: non esiste un punto di totalità sulla Terra.</p>');
  }
  return righe;
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

// Quanto può essere larga la cupola. Il cerchio non è il limite del disegno:
// i punti cardinali stanno fuori dal bordo (sono disegnati a −6° di altezza,
// cioè al 6,7% oltre il raggio), e sotto agli astri bassi c'è il loro nome.
// Prendendo mezza la misura più corta — com'era prima — su un telefono la N
// e la S finivano oltre il canvas e la E e la O restavano tagliate a metà.
function simRaggioCupola(L, H) {
  return Math.max(60, (Math.min(L, H) / 2 - 16) / 1.07);
}

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
  const R = simRaggioCupola(L, H);

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
  const R = simRaggioCupola(L, H);

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
  if (oraEl) oraEl.textContent = simOraTesto(tempo, sim.L < 420);
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
  simPonteEclittica(evento);

  modale.classList.remove('hidden');
  sim.aperto = true;
  // Il canvas ha dimensioni solo dopo che il modale è visibile
  requestAnimationFrame(() => {
    simRidimensiona();
    if (!sim.raf) sim.raf = requestAnimationFrame(simCiclo);
  });
};

// Sotto alla simulazione, il rimando alla lezione dell'eclittica. Per
// un'eclissi è il discorso dei nodi, con i numeri di quella lì; per tutto il
// resto è il ricordo che quel che si sta guardando succede su una riga sola,
// e ogni scena dice perché la riguarda.
const SIM_PERCHE_ECLITTICA = {
  faseLunare: 'Le fasi sono la Luna che ci gira attorno restando sempre a pochi gradi da quella linea.',
  stagione: 'Equinozi e solstizi sono i quattro punti in cui l\'eclittica incrocia l\'equatore celeste: ' +
    'le stagioni nascono proprio dall\'angolo fra i due.',
  elongazione: 'Un pianeta si allontana dal Sole muovendosi lungo quella linea: l\'elongazione si misura lì sopra.',
  cielo: 'Sole, Luna e pianeti che vedi in scena stanno tutti appoggiati a quella riga.'
};

function simPonteEclittica(evento) {
  const el = document.getElementById('sim-eclittica');
  if (!el || !sim.scena) return;
  const tipo = sim.scena.tipo;

  if (tipo === 'eclissiLunare' || tipo === 'eclissiSolare') {
    mostraStagioneEclissi('sim-eclittica', evento.dataObj);
    return;
  }

  const perche = SIM_PERCHE_ECLITTICA[tipo];
  if (!perche) { el.innerHTML = ''; el.classList.add('hidden'); return; }
  el.innerHTML = `<p>Tutto questo succede lungo <b>l'eclittica</b>: il cerchio che il Sole percorre ` +
    `in un anno fra le stelle, e attorno a cui stanno la Luna e i pianeti. ${perche}</p>` +
    '<button type="button" class="ecl-tasto-largo" onclick="apriLezioneEclittica()" ' +
    'title="La lezione animata: il Sistema Solare dall\'alto, poi di taglio">Che cos\'è l\'eclittica</button>';
  el.classList.remove('hidden');
}

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

  // La croce in alto e il tasto in fondo chiudono entrambi la finestra
  ['btn-chiudi-simulazione', 'btn-chiudi-simulazione-basso'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', chiudiSimulazione);
  });
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
//     Fino a ieri le coordinate servivano solo al planetario. Ora un
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

// =====================================================================
// 10-bis. LA FINESTRA DELLA POSIZIONE
//   Un solo posto, raggiungibile da ovunque, che risponde a tre domande:
//   che posizione sta usando l'app, quanto è precisa, e come cambiarla.
//   Il tasto grande prova gli strati in ordine (GPS → rete) e, se
//   entrambi tacciono, porta per mano all'unico che non fallisce mai:
//   scegliere la città.
// =====================================================================

// Nome breve del luogo, buono per un tasto: la città se la conosciamo,
// altrimenti le coordinate. Mai la parola "posizione" e basta: chi legge
// deve poter riconoscere il posto, o accorgersi che è sbagliato.
function etichettaLuogo() {
  const p = (typeof sky !== 'undefined' && sky.posizione) ? sky.posizione : null;
  if (p) return p.nome || formattaCoordinate(p.lat, p.lon);
  const l = luogoCorrente();
  return l ? formattaCoordinate(l.lat, l.lon) : null;
}

// Da metri a testo leggibile: "±12 m", "±25 km"
function precisioneTesto(metri) {
  if (!metri || !isFinite(metri)) return '';
  return metri >= 1000 ? `±${(metri / 1000).toFixed(metri >= 10000 ? 0 : 1)} km` : `±${Math.round(metri)} m`;
}

// Quanto è vecchia una lettura, detto come lo direbbe una persona
function quandoTesto(ms) {
  if (!ms) return '';
  const minuti = Math.round((Date.now() - ms) / 60000);
  if (minuti < 2) return 'adesso';
  if (minuti < 60) return `${minuti} minuti fa`;
  const ore = Math.round(minuti / 60);
  if (ore < 24) return ore === 1 ? 'un\'ora fa' : `${ore} ore fa`;
  const giorni = Math.round(ore / 24);
  return giorni === 1 ? 'ieri' : `${giorni} giorni fa`;
}

// Quanto ci si può fidare del punto che stiamo usando: decide il colore
// della scheda e del pallino sul tasto.
function qualitaPosizione() {
  const p = (typeof sky !== 'undefined' && sky.posizione) ? sky.posizione : null;
  if (!p) return 'assente';
  const origine = p.origine || p.fonte;
  if (origine === 'gps' || origine === 'manuale') return 'precisa';
  if (origine === 'citta') return 'buona';
  return 'approssimata'; // rete, o un backup di cui non sappiamo la provenienza
}

let posRicercaInCorso = false;
let posTimerCitta = null;
let posRichiestaCitta = 0;

// Apre la finestra. Con `avviaSubito` la ricerca parte da sola: è quello
// che serve quando si arriva qui da un "manca la posizione", perché in quel
// caso l'utente ha già espresso l'intenzione premendo il tasto.
window.apriPosizione = function apriPosizione(avviaSubito) {
  const modale = document.getElementById('modale-posizione');
  if (!modale) return;
  modale.classList.remove('hidden');
  posAzzeraStrati();
  posAggiornaScheda();
  posMostraEsito('', null);
  posMostraRisultati([], null);
  const campo = document.getElementById('pos-cerca-citta');
  if (campo) campo.value = '';
  const l = luogoCorrente();
  const lat = document.getElementById('pos-lat');
  const lon = document.getElementById('pos-lon');
  if (lat) lat.value = l ? l.lat.toFixed(4) : '';
  if (lon) lon.value = l ? l.lon.toFixed(4) : '';
  const testoBtn = document.getElementById('pos-btn-cerca-testo');
  if (testoBtn) testoBtn.textContent = l ? 'Rileva di nuovo' : 'Trova la mia posizione';
  const manuale = document.getElementById('pos-manuale');
  if (manuale) manuale.classList.toggle('in-evidenza', false);
  // Se non c'è ancora niente, cercare è l'unica cosa sensata da fare:
  // gliela risparmiamo.
  if (avviaSubito || !l) posCerca();
};

function chiudiPosizione() {
  const modale = document.getElementById('modale-posizione');
  if (modale) modale.classList.add('hidden');
}

// La scheda in alto: cosa sta usando l'app, adesso.
function posAggiornaScheda() {
  const box = document.getElementById('pos-scheda-stato');
  if (!box) return;
  const p = (typeof sky !== 'undefined' && sky.posizione) ? sky.posizione : null;
  const l = luogoCorrente();

  if (!l) {
    box.dataset.stato = 'assente';
    box.innerHTML = `
      <p class="pos-scheda-titolo">Nessuna posizione impostata</p>
      <p class="pos-scheda-dettaglio">Senza un punto sulla Terra non posso dirti a che ora fa buio,
        cosa sorge, cosa tramonta e che tempo farà. Bastano dieci secondi.</p>`;
    return;
  }

  const qualita = qualitaPosizione();
  box.dataset.stato = qualita;
  const origine = (p && (p.origine || p.fonte)) || null;
  const et = POS_ETICHETTE[origine] || null;
  const nome = (p && p.nome) ? p.nome : null;
  const coord = formattaCoordinate(l.lat, l.lon);
  const prec = p ? precisioneTesto(p.precisione) : '';
  const eta = p && p.tempo ? quandoTesto(p.tempo) : '';

  const testo = et ? et.provenienza : 'l\'ultima posizione salvata';
  const provenienza = testo.charAt(0).toUpperCase() + testo.slice(1);
  const dettagli = [prec, eta].filter(Boolean).join(' · ');

  box.innerHTML = `
    <p class="pos-scheda-titolo">${nome ? nome : coord}</p>
    <p class="pos-scheda-coordinate">${nome ? coord + ' · ' : ''}${provenienza}${dettagli ? ' · ' + dettagli : ''}</p>
    ${qualita === 'approssimata'
      ? '<p class="pos-scheda-dettaglio">È una posizione di ripiego: va bene per gli orari, ' +
        'ma se il paese non è quello giusto scegli la città qui sotto.</p>'
      : posizioneSceltaDaUtente()
        // Dirlo serve: prima il primo fix del GPS la sostituiva in silenzio, e
        // sembrava che la scelta non venisse salvata.
        ? '<p class="pos-scheda-dettaglio">L\'app sta calcolando tutto da qui. L\'hai scelta tu, ' +
          'quindi resta: né il GPS né la rete la cambiano da soli, finché non premi “Rileva di nuovo”.</p>'
        : '<p class="pos-scheda-dettaglio">L\'app sta calcolando tutto da qui.</p>'}`;
}

// Riporta i tre strati allo stato "non ancora provato"
function posAzzeraStrati() {
  document.querySelectorAll('#pos-strati .pos-strato').forEach(li => {
    li.dataset.stato = 'attesa';
    const nota = li.querySelector('.pos-strato-nota');
    if (nota) nota.remove();
  });
}

// Accende (o spegne) uno strato e ci scrive sotto cosa è successo
function posImpostaStrato(strato, stato, testo) {
  const li = document.querySelector(`#pos-strati .pos-strato[data-strato="${strato}"]`);
  if (!li) return;
  li.dataset.stato = stato;
  const testi = li.querySelector('.pos-strato-testo');
  if (!testi) return;
  let nota = li.querySelector('.pos-strato-nota');
  if (!testo) { if (nota) nota.remove(); return; }
  if (!nota) {
    nota = document.createElement('p');
    nota.className = 'pos-strato-nota';
    testi.appendChild(nota);
  }
  nota.textContent = testo;
}

function posMostraEsito(testo, tono) {
  const el = document.getElementById('pos-esito');
  if (!el) return;
  el.textContent = testo || '';
  el.dataset.tono = tono || 'neutro';
  el.classList.toggle('hidden', !testo);
}

// Il tasto grande: prova gli strati in ordine e racconta cosa sta facendo.
async function posCerca() {
  if (posRicercaInCorso) return;
  posRicercaInCorso = true;
  const btn = document.getElementById('pos-btn-cerca');
  const testoBtn = document.getElementById('pos-btn-cerca-testo');
  if (btn) btn.disabled = true;
  if (testoBtn) testoBtn.textContent = 'Sto cercando…';
  posAzzeraStrati();
  posMostraEsito('', null);

  let esito;
  try {
    // Il tasto grande è la richiesta esplicita per eccellenza: qui, e solo
    // qui, una lettura automatica può sostituire una posizione scelta a mano.
    esito = await trovaPosizioneAStrati(posImpostaStrato, { forzato: true });
  } catch (e) {
    esito = { esito: 'manuale', messaggio: 'Qualcosa è andato storto durante la ricerca: scegli la città qui sotto.' };
  }

  if (btn) btn.disabled = false;
  if (testoBtn) testoBtn.textContent = luogoCorrente() ? 'Rileva di nuovo' : 'Riprova';

  const tono = esito.esito === 'gps' ? 'ok'
             : esito.esito === 'rete' ? 'avviso'
             : esito.esito === 'invariata' ? 'neutro' : 'avviso';
  posMostraEsito(esito.messaggio, tono);
  posAggiornaScheda();

  // Se non c'è ancora niente, la parte manuale deve saltare all'occhio:
  // è l'unica strada rimasta e non deve sembrare un dettaglio in fondo.
  const manuale = document.getElementById('pos-manuale');
  if (manuale) {
    manuale.classList.toggle('in-evidenza', esito.esito === 'manuale');
    if (esito.esito === 'manuale') {
      manuale.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const campo = document.getElementById('pos-cerca-citta');
      if (campo) setTimeout(() => campo.focus(), 300);
    }
  }

  posRicercaInCorso = false;
  if (esito.esito === 'gps' || esito.esito === 'rete') await posDopoCambio();
}

// Un cambio di posizione tocca mezza app: qui c'è l'unico posto in cui si
// rimette tutto in riga, così nessuna vista resta indietro con i vecchi conti.
async function posDopoCambio() {
  aggiornaTastiPosizione();
  posAggiornaScheda();
  if (typeof aggiornaSchedaImpostazioni === 'function') aggiornaSchedaImpostazioni();
  try { await caricaMeteo(true); } catch (e) { /* senza rete resta l'ultima previsione */ }
  if (typeof costruisciStasera === 'function') costruisciStasera();
  if (typeof aggiornaViste === 'function') aggiornaViste();
  if (typeof telOggettiCache !== 'undefined' && telOggettiCache) telOggettiCache.quando = 0;
  if (typeof telCostruisciPannello === 'function' && document.getElementById('telescopio-corpo')) {
    try { telCostruisciPannello(); } catch (e) { /* la vista Telescopio non è aperta */ }
  }
  if (typeof skyAggiornaOggetti === 'function' && typeof sky !== 'undefined' && sky.aperto) {
    skyAggiornaOggetti(true);
  }
}

// --- Strato 3: la ricerca della città --------------------------------
// L'elenco locale (quello delle eclissi) è già a bordo e funziona offline:
// è la risposta immediata. Se c'è rete, il servizio di Open-Meteo aggiunge
// i paesi piccoli, che in un elenco di capoluoghi non ci sono.
// normalizzaTesto scompone gli accenti, ma non le lettere che accento non
// sono: chi cerca "tromso" con la tastiera italiana non troverebbe Tromsø.
const POS_LETTERE_SPECIALI = { 'ø': 'o', 'æ': 'ae', 'å': 'a', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'ł': 'l', 'ß': 'ss' };

function posNormalizzaNome(testo) {
  return normalizzaTesto(testo).replace(/[øæåđðþłß]/g, c => POS_LETTERE_SPECIALI[c] || c);
}

function posCittaLocali(testo) {
  const q = posNormalizzaNome(testo);
  if (q.length < 2 || typeof ECL_CITTA === 'undefined') return [];
  const inizia = [], contiene = [];
  for (const [nome, paese, lat, lon] of ECL_CITTA) {
    const n = posNormalizzaNome(nome);
    if (n.startsWith(q)) inizia.push({ nome, paese, lat, lon });
    else if (n.includes(q)) contiene.push({ nome, paese, lat, lon });
  }
  return inizia.concat(contiene).slice(0, 8);
}

async function posCittaOnline(testo) {
  const q = (testo || '').trim();
  if (q.length < 3) return [];
  try {
    const url = 'https://geocoding-api.open-meteo.com/v1/search' +
      `?name=${encodeURIComponent(q)}&count=8&language=it&format=json`;
    const risposta = await fetchConScadenza(url, 5000);
    if (!risposta.ok) return [];
    const dati = await risposta.json();
    return (dati.results || [])
      .filter(r => isFinite(r.latitude) && isFinite(r.longitude))
      .map(r => ({
        nome: r.name,
        paese: [r.admin1, r.country].filter(Boolean).join(', '),
        lat: r.latitude,
        lon: r.longitude
      }));
  } catch (e) {
    return []; // offline: restano le città a bordo, che bastano
  }
}

function posMostraRisultati(elenco, nota) {
  const box = document.getElementById('pos-risultati');
  if (!box) return;
  if (!elenco.length) {
    box.innerHTML = nota ? `<p class="pos-risultati-nota">${nota}</p>` : '';
    return;
  }
  box.innerHTML = elenco.map((c, i) => `
    <button type="button" class="pos-risultato" role="option" data-citta="${i}">
      <span class="pos-risultato-nome">${c.nome}</span>
      <span class="pos-risultato-paese">${c.paese || ''}</span>
    </button>`).join('') + (nota ? `<p class="pos-risultati-nota">${nota}</p>` : '');
  box.querySelectorAll('[data-citta]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = elenco[parseInt(btn.dataset.citta, 10)];
      if (c) posUsaLuogo(c.lat, c.lon, c.nome, 'citta');
    });
  });
  // Sul telefono la tastiera copre metà schermo: senza questo le città
  // trovate finiscono sotto di essa e sembra che la ricerca non risponda.
  try { box.scrollIntoView({ block: 'nearest' }); } catch (e) { /* browser vecchio */ }
}

// Applica un luogo scelto a mano e aggiorna tutta l'app
async function posUsaLuogo(lat, lon, nome, fonte) {
  skyImpostaPosizione(lat, lon, fonte, { nome: nome || null, tempo: Date.now() });
  const manuale = document.getElementById('pos-manuale');
  if (manuale) manuale.classList.remove('in-evidenza');
  posImpostaStrato('manuale', 'fatto', `Stai usando ${nome || formattaCoordinate(lat, lon)}.`);
  posMostraEsito(`Fatto: l'app calcola tutto da ${nome || formattaCoordinate(lat, lon)}.`, 'ok');
  posMostraRisultati([], null);
  const campo = document.getElementById('pos-cerca-citta');
  if (campo) campo.value = '';
  await posDopoCambio();
}

function inizializzaPosizioneUI() {
  // L'ultima posizione salvata torna in memoria subito, non solo quando si
  // apre il planetario: è lei che fa trovare l'app già "accesa" alla
  // riapertura, anche senza rete e senza ripetere la richiesta di permesso.
  if (!sky.posizione) skyCaricaPosizioneSalvata();

  const modale = document.getElementById('modale-posizione');
  if (modale) modale.addEventListener('click', (e) => { if (e.target === modale) chiudiPosizione(); });
  ['btn-chiudi-posizione', 'btn-chiudi-posizione-basso'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', chiudiPosizione);
  });

  const cerca = document.getElementById('pos-btn-cerca');
  if (cerca) cerca.addEventListener('click', () => posCerca());

  // Ricerca della città: prima l'elenco a bordo (istantaneo), poi il
  // servizio online se dice qualcosa in più.
  const campo = document.getElementById('pos-cerca-citta');
  if (campo) {
    campo.addEventListener('input', () => {
      const testo = campo.value;
      if (posTimerCitta) clearTimeout(posTimerCitta);
      const locali = posCittaLocali(testo);
      if (testo.trim().length < 2) { posMostraRisultati([], null); return; }
      posMostraRisultati(locali, locali.length ? null : 'Cerco anche fuori dall\'elenco…');
      const richiesta = ++posRichiestaCitta;
      posTimerCitta = setTimeout(async () => {
        const online = await posCittaOnline(testo);
        // Nel frattempo l'utente può aver scritto altro: quella risposta
        // non vale più niente.
        if (richiesta !== posRichiestaCitta) return;
        const visti = new Set(locali.map(c => posNormalizzaNome(c.nome)));
        const uniti = locali.concat(online.filter(c => !visti.has(posNormalizzaNome(c.nome)))).slice(0, 10);
        posMostraRisultati(uniti, uniti.length ? null : 'Nessuna città trovata con questo nome.');
      }, 320);
    });
    // Invio: se c'è una sola città plausibile, la prende
    campo.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const primo = document.querySelector('#pos-risultati .pos-risultato');
      if (primo) primo.click();
    });
  }

  const btnCoord = document.getElementById('pos-btn-coordinate');
  if (btnCoord) btnCoord.addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('pos-lat').value);
    const lon = parseFloat(document.getElementById('pos-lon').value);
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      posMostraEsito('Coordinate non valide: la latitudine va da −90 a 90, la longitudine da −180 a 180.', 'errore');
      return;
    }
    posUsaLuogo(lat, lon, null, 'manuale');
  });

  aggiornaTastiPosizione();
}

// Tutti i tasti che parlano di posizione dicono la stessa cosa, e la
// dicono per esteso: dove sei secondo l'app, e quanto ci si può fidare.
function aggiornaTastiPosizione() {
  const qualita = qualitaPosizione();
  const dove = etichettaLuogo();
  const btn = document.getElementById('btn-stasera-posizione');
  if (btn) {
    const testo = btn.querySelector('.tasto-posizione-testo');
    btn.dataset.stato = qualita === 'assente' ? 'assente' : qualita;
    if (testo) testo.textContent = dove ? `Osservi da ${dove}` : 'Imposta la tua posizione';
    btn.title = dove
      ? `Orari, buio e meteo sono calcolati da ${dove}. Tocca per cambiare luogo o rilevarlo di nuovo.`
      : 'Scegli il luogo da cui stai osservando: GPS, connessione o città in elenco';
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
// oggetti del deep sky). Le coordinate sono J2000: la differenza con
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
      if (fase === 0) return 'telescopio';   // cielo buio: è la notte del deep sky
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
// 13. PASSAGGI DELLE STAZIONI SPAZIALI (ISS e Tiangong)
//     Sono gli oggetti costruiti dall'uomo più facili da vedere: passano
//     alti, sembrano una stella luminosa che scivola in silenzio e non
//     lampeggiano come gli aerei. I dati orbitali (TLE) arrivano da
//     Celestrak e la propagazione SGP4 la fa satellite.js, tutto dentro
//     al browser. Un passaggio si vede solo se: la stazione è alta
//     sull'orizzonte, è illuminata dal Sole e chi guarda è già al buio.
//     Tutto è calcolato per il punto esatto in cui ci si trova: gli orari
//     e le direzioni cambiano anche fra due paesi vicini.
// =====================================================================

const SATELLITI = [
  {
    id: 'iss',
    nome: 'ISS',
    nomeLungo: 'Stazione Spaziale Internazionale',
    catnr: 25544,
    colore: '#93c5fd',
    chiaveTle: 'astrocalendario_tle_iss',
    classe: 'Stazione spaziale abitata',
    dimensione: '109 × 73 m, pannelli solari compresi',
    magTipica: -3,
    periodoMin: 93,
    nota: 'Grande come un campo da calcio: è l\'oggetto artificiale più luminoso del cielo.'
  },
  {
    id: 'css',
    nome: 'Tiangong',
    nomeLungo: 'Tiangong, la stazione spaziale cinese',
    catnr: 48274,
    colore: '#fca5a5',
    chiaveTle: 'astrocalendario_tle_css',
    classe: 'Stazione spaziale abitata',
    dimensione: 'circa 55 m fra i moduli e i pannelli',
    magTipica: -1,
    periodoMin: 92,
    nota: 'Più piccola della ISS: brilla circa come una stella luminosa, e passa più bassa.'
  }
];

const TLE_VALIDITA_MS = 12 * 60 * 60 * 1000;
const URL_TLE = catnr => `https://celestrak.org/NORAD/elements/gp.php?CATNR=${catnr}&FORMAT=TLE`;

// Quanti giorni avanti cercare i passaggi e con che passo temporale
const SAT_GIORNI = 5;
const SAT_PASSO_S = 30;
const SAT_ELEVAZIONE_MINIMA = 10;   // gradi: sotto è nascosta da case e alberi
const SAT_R2D = 180 / Math.PI;

// Passaggi calcolati e dati orbitali, per stazione
const satPassaggi = {};    // id stazione -> elenco dei passaggi
const satTle = {};         // id stazione -> { riga1, riga2, quando }
const satRecCache = {};    // id stazione -> satrec già costruito
let satInCorso = null;
let satPrecaricaAvviata = false;

function satelliteDaId(id) {
  return SATELLITI.find(s => s.id === id) || null;
}

function tleDaCache(sat) {
  try {
    const dati = JSON.parse(localStorage.getItem(sat.chiaveTle) || 'null');
    if (dati && dati.riga1 && dati.riga2) return dati;
  } catch (e) { /* dato corrotto */ }
  return null;
}

async function caricaTle(sat, forza) {
  const salvato = satTle[sat.id] || tleDaCache(sat);
  if (!forza && salvato && Date.now() - salvato.quando < TLE_VALIDITA_MS) {
    satTle[sat.id] = salvato;
    return salvato;
  }

  try {
    const risposta = await fetch(URL_TLE(sat.catnr));
    if (!risposta.ok) throw new Error('risposta non valida');
    const testo = await risposta.text();
    const righe = testo.trim().split('\n').map(r => r.trim()).filter(Boolean);
    const riga1 = righe.find(r => r.startsWith('1 '));
    const riga2 = righe.find(r => r.startsWith('2 '));
    if (!riga1 || !riga2) throw new Error('formato TLE inatteso');
    const dati = { riga1, riga2, quando: Date.now() };
    try { localStorage.setItem(sat.chiaveTle, JSON.stringify(dati)); } catch (e) { /* storage pieno */ }
    satTle[sat.id] = dati;
    return dati;
  } catch (e) {
    // Un TLE vecchio di qualche giorno sbaglia di poco: meglio di niente,
    // e lo diciamo nell'interfaccia.
    if (salvato) satTle[sat.id] = salvato;
    return salvato;
  }
}

// Scarica una volta sola i dati orbitali di tutte le stazioni: serve al
// planetario, che li vuole appena si apre per disegnarle in diretta.
function satPrecaricaTle() {
  if (satPrecaricaAvviata) return;
  satPrecaricaAvviata = true;
  Promise.all(SATELLITI.map(s => caricaTle(s, false)))
    .then(() => { if (sky.aperto) skyAggiornaOggetti(true); })
    .catch(() => { /* senza rete restano i dati salvati, se ci sono */ });
}

// Il satrec (i parametri orbitali digeriti da satellite.js) si ricostruisce
// solo quando arriva un TLE nuovo: farlo a ogni fotogramma sarebbe sprecato.
function satRecDi(sat) {
  const tle = satTle[sat.id] || tleDaCache(sat);
  if (!tle || typeof satellite === 'undefined') return null;
  satTle[sat.id] = tle;
  const memoria = satRecCache[sat.id];
  if (memoria && memoria.quando === tle.quando) return memoria.rec;
  try {
    const rec = satellite.twoline2satrec(tle.riga1, tle.riga2);
    satRecCache[sat.id] = { quando: tle.quando, rec };
    return rec;
  } catch (e) {
    return null;
  }
}

// L'osservatore nel formato che vuole satellite.js (radianti e chilometri)
function satOsservatoreGd(luogo) {
  return {
    longitude: luogo.lon * Math.PI / 180,
    latitude: luogo.lat * Math.PI / 180,
    height: 0.1
  };
}

// Dove sta la stazione, vista da qui, in un dato istante
function satAltAz(rec, data, gd) {
  let pv;
  try { pv = satellite.propagate(rec, data); } catch (e) { return null; }
  if (!pv || !pv.position) return null;
  try {
    const gmst = satellite.gstime(data);
    const ecf = satellite.eciToEcf(pv.position, gmst);
    const look = satellite.ecfToLookAngles(gd, ecf);
    return {
      az: ((look.azimuth * SAT_R2D) % 360 + 360) % 360,
      alt: look.elevation * SAT_R2D,
      distanza: look.rangeSat,
      posizione: pv.position
    };
  } catch (e) {
    return null;
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

// Cerca i passaggi nei prossimi giorni sopra il punto in cui ci si trova.
// Restituisce una lista di oggetti con inizio, culmine, fine, altezza
// massima e direzioni in cui guardare.
function calcolaPassaggiSatellite(sat, luogo) {
  const rec = satRecDi(sat);
  if (typeof satellite === 'undefined' || !rec || !luogo) return [];

  const osservatoreGd = satOsservatoreGd(luogo);
  const obs = osservatoreCorrente();

  const passaggi = [];
  let corrente = null;
  const inizio = Date.now();
  const passi = Math.floor(SAT_GIORNI * 86400 / SAT_PASSO_S);

  for (let i = 0; i < passi; i++) {
    const data = new Date(inizio + i * SAT_PASSO_S * 1000);
    const p = satAltAz(rec, data, osservatoreGd);
    if (!p) continue;

    if (p.alt >= SAT_ELEVAZIONE_MINIMA) {
      const voce = {
        data,
        elevazione: p.alt,
        azimut: p.az,
        distanza: p.distanza,
        posizione: p.posizione
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

    // Visibile a occhio nudo solo se la stazione è al sole e chi guarda è al buio
    const illuminata = satelliteIlluminato(culmine.posizione, culmine.data);
    const altSole = obs ? altezzaSole(culmine.data, obs) : null;
    const osservatoreAlBuio = altSole === null ? true : altSole < -6;

    return {
      satId: sat.id,
      inizio: primo.data,
      fine: ultimo.data,
      culmine: culmine.data,
      elevazioneMax: culmine.elevazione,
      azInizio: primo.azimut,
      azCulmine: culmine.azimut,
      azFine: ultimo.azimut,
      distanzaMin: Math.round(culmine.distanza),
      durataMin: Math.max(1, Math.round((ultimo.data - primo.data) / 60000)),
      visibile: illuminata && osservatoreAlBuio,
      illuminata,
      alBuio: osservatoreAlBuio,
      altezzaSole: altSole
    };
  });
}

async function aggiornaPassaggiSatelliti(forza) {
  const box = document.getElementById('stasera-satelliti');
  const luogo = luogoCorrente();

  if (!luogo) {
    if (box) box.innerHTML = '<p class="text-slate-400">Serve la tua posizione: le stazioni spaziali passano sopra un punto preciso della Terra, ' +
      'e da un paese all\'altro cambia tutto. Qui il GPS conta davvero: una città sbagliata sposta gli orari di minuti.</p>' +
      '<button type="button" onclick="apriPosizione(true)" class="mt-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-700 hover:bg-blue-600 text-slate-100 transition-colors">Dimmi dove sono</button>';
    return;
  }
  if (typeof satellite === 'undefined') {
    if (box) box.innerHTML = '<p class="text-amber-400">Libreria orbitale non caricata: riapri l\'app quando c\'è rete, poi funzionerà anche offline.</p>';
    return;
  }
  if (satInCorso) return satInCorso;
  if (box) box.innerHTML = '<p class="text-slate-400">Calcolo dei passaggi in corso…</p>';

  satInCorso = (async () => {
    await Promise.all(SATELLITI.map(async sat => {
      const tle = await caricaTle(sat, forza);
      if (!tle) { satPassaggi[sat.id] = null; return; }
      try {
        satPassaggi[sat.id] = calcolaPassaggiSatellite(sat, luogo);
      } catch (e) {
        console.error(`Errore passaggi ${sat.nome}:`, e);
        satPassaggi[sat.id] = [];
      }
    }));
    satPrecaricaAvviata = true;
    mostraPassaggiSatelliti();
    if (sky.aperto) skyAggiornaOggetti(true);
    skyAggiornaScheda();
  })().finally(() => { satInCorso = null; });

  return satInCorso;
}

// "Fra quanto" in parole: è la risposta che si cerca davvero guardando fuori
function fraQuanto(data) {
  const ms = data - Date.now();
  if (ms <= 0) return 'adesso';
  const min = Math.round(ms / 60000);
  if (min < 1) return 'fra pochi secondi';
  if (min < 60) return `fra ${min} min`;
  const ore = Math.floor(min / 60), resto = min % 60;
  if (ore < 24) return `fra ${ore} h${resto ? ' ' + resto + ' min' : ''}`;
  const giorni = Math.round(ore / 24);
  return `fra ${giorni} giorn${giorni === 1 ? 'o' : 'i'}`;
}

// Il primo passaggio visibile di una stazione, o null se non ce n'è
function prossimoPassaggioVisibile(satId) {
  const elenco = satPassaggi[satId];
  if (!elenco) return null;
  return elenco.find(p => p.visibile && p.fine > new Date()) || null;
}

// Tutti i passaggi visibili delle due stazioni, in ordine di orario
function passaggiVisibiliOrdinati() {
  const adesso = new Date();
  return SATELLITI
    .flatMap(sat => (satPassaggi[sat.id] || []).filter(p => p.visibile && p.fine > adesso))
    .sort((a, b) => a.inizio - b.inizio);
}

function satEtichetta(sat) {
  return `<span class="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full border"
    style="color:${sat.colore};border-color:${sat.colore}66;background:${sat.colore}1a">${sat.nome}</span>`;
}

function mostraPassaggiSatelliti() {
  const box = document.getElementById('stasera-satelliti');
  if (!box) return;

  const visibili = passaggiVisibiliOrdinati().slice(0, quanto(3, 5, 8));

  // Se i dati orbitali sono vecchi gli orari ballano: meglio dirlo
  const etaMax = SATELLITI.reduce((max, sat) => {
    const tle = satTle[sat.id];
    if (!tle) return max;
    return Math.max(max, Date.now() - tle.quando);
  }, 0);
  const giorniEta = Math.floor(etaMax / 86400000);
  const notaEta = giorniEta >= 1
    ? `<p class="text-xs text-amber-400 mt-1">Dati orbitali vecchi di ${giorniEta} giorn${giorniEta === 1 ? 'o' : 'i'}: gli orari possono spostarsi di qualche minuto. Premi “Aggiorna” con la rete accesa.</p>`
    : '';

  // Riepilogo per stazione: quando tocca alla ISS e quando a Tiangong
  const riepilogo = SATELLITI.map(sat => {
    const elenco = satPassaggi[sat.id];
    let testo;
    if (!elenco) {
      testo = '<span class="text-amber-400">dati orbitali non disponibili</span>';
    } else {
      const p = prossimoPassaggioVisibile(sat.id);
      if (!p) {
        const quanti = elenco.length;
        testo = quanti
          ? `<span class="text-slate-400">nessun passaggio visibile nei prossimi ${SAT_GIORNI} giorni (passa ${quanti} volte, ma di giorno o nell'ombra della Terra)</span>`
          : `<span class="text-slate-400">non passa mai abbastanza alta da qui nei prossimi ${SAT_GIORNI} giorni</span>`;
      } else if (p.inizio <= new Date()) {
        testo = `<strong class="text-green-400">sta passando adesso</strong>, verso ${skyNomeDirezione(p.azCulmine)}`;
      } else {
        testo = `<strong class="text-white">${dataOraBreve(p.inizio)}</strong> <span class="text-slate-400">(${fraQuanto(p.inizio)}, verso ${skyNomeDirezione(p.azInizio)})</span>`;
      }
    }
    return `
      <div class="flex items-baseline gap-2 flex-wrap">
        ${satEtichetta(sat)}
        <span class="text-sm text-slate-300">${testo}</span>
        <button onclick="cercaSatelliteNelCielo('${sat.id}')" class="text-xs px-2.5 py-1 rounded-full bg-slate-700 hover:bg-blue-600 text-white" title="Mostrala nel cielo, dove si trova adesso">Dov'è ora</button>
      </div>`;
  }).join('');

  const intestazione = `<div class="grid gap-2 bg-slate-900 p-3 rounded-xl border border-slate-700">${riepilogo}</div>`;

  if (!visibili.length) {
    box.innerHTML = intestazione +
      `<p class="text-slate-400 mt-1">Nessun passaggio visibile a occhio nudo nei prossimi giorni: capita spesso, perché la stazione deve essere illuminata dal Sole mentre da qui è già buio.</p>` +
      notaEta;
    return;
  }

  const schede = visibili.map(p => {
    const sat = satelliteDaId(p.satId);
    const inCorso = p.inizio <= new Date();
    const qualita = p.elevazioneMax > 60 ? 'spettacolare, quasi allo zenit'
                  : p.elevazioneMax > 40 ? 'molto buono, alta nel cielo'
                  : 'discreto, resta bassa sull\'orizzonte';
    return `
      <div class="bg-slate-900 p-3 rounded-xl border ${inCorso ? 'border-green-600' : 'border-slate-700'}">
        <div class="flex justify-between items-baseline gap-2 flex-wrap">
          <span class="font-bold text-white inline-flex items-center gap-2">
            ${icona('satellite', 18)} ${satEtichetta(sat)} ${dataOraBreve(p.inizio)}
          </span>
          <span class="text-xs ${inCorso ? 'text-green-400 font-bold' : 'text-slate-400'}">${inCorso ? 'in corso adesso' : fraQuanto(p.inizio)}</span>
        </div>
        <p class="text-sm text-slate-300 mt-1">
          Compare verso <strong>${skyNomeDirezione(p.azInizio)}</strong>, passa più alta alle
          <strong>${oraBreve(p.culmine)}</strong> a <strong>${Math.round(p.elevazioneMax)}°</strong>
          verso <strong>${skyNomeDirezione(p.azCulmine)}</strong>, e sparisce verso
          <strong>${skyNomeDirezione(p.azFine)}</strong> alle <strong>${oraBreve(p.fine)}</strong>.
        </p>
        <p class="text-xs text-slate-500 mt-1">
          ${p.durataMin} min di passaggio · ${p.distanzaMin} km di distanza al culmine · passaggio ${qualita}.
        </p>
        <div class="mt-2">
          <button onclick="cercaSatelliteNelCielo('${p.satId}')" class="text-xs px-3 py-1.5 rounded-full bg-slate-700 hover:bg-blue-600 text-white font-semibold" title="Apri il cielo in diretta puntato sulla stazione">Trova nel cielo</button>
        </div>
      </div>`;
  }).join('');

  box.innerHTML = intestazione + schede +
    `<p class="text-xs text-slate-500">Sembra una stella luminosa che scivola senza fare rumore: non lampeggia come un aereo. Guarda qualche minuto prima dell'orario e tieni d'occhio la direzione indicata.</p>` +
    notaEta;
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
    <div class="scheda-riepilogo bg-slate-900 p-4 rounded-xl border border-slate-700">
      <p class="etichetta-riepilogo text-xs text-slate-400 uppercase tracking-wide">${titolo}</p>
      <p class="valore-riepilogo text-lg font-bold text-white mt-1">${valore}</p>
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
      <div class="scheda-piena bg-slate-900 p-4 rounded-xl border border-amber-800">
        <p class="text-amber-400 font-semibold">Manca la tua posizione</p>
        <p class="text-sm text-slate-300 mt-1">Senza un punto sulla Terra non posso dirti a che ora fa buio,
          cosa sorge e cosa tramonta. Ci sono tre modi per darmelo — il GPS, la connessione o la tua città
          scelta in elenco — e almeno uno funziona sempre. Resta salvato solo su questo dispositivo.</p>
        <button type="button" onclick="apriPosizione(true)"
          class="mt-3 px-4 py-2 rounded-full text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white">Dimmi dove sono</button>
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
                   : 'cielo scuro: ottimo per meteore e deep sky';
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
  if (!obs) {
    box.innerHTML = '<p class="text-slate-400">Serve la posizione per sapere cosa hai sopra la testa.</p>' +
      '<button type="button" onclick="apriPosizione(true)" class="mt-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-700 hover:bg-blue-600 text-slate-100 transition-colors">Dimmi dove sono</button>';
    return;
  }

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
  // Sul telefono un elenco corto si legge tutto senza scorrere; sul monitor
  // lo spazio c'è e allungarlo evita di dover aprire l'agenda
  const prossimi = eventiCalcolati
    .filter(e => e.dataObj.getTime() >= adesso - 6 * 3600000 && e.dataObj.getTime() <= limite)
    .sort((a, b) => a.dataObj - b.dataObj)
    .slice(0, quanto(5, 8, 12));

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
  aggiornaPassaggiSatelliti(false);
}

function inizializzaStasera() {
  // Il tasto non "rileva" e basta: apre la finestra della posizione, dove si
  // vede cosa sta usando l'app e si può cambiare in tre modi diversi. Se non
  // c'è ancora niente la ricerca parte da sola, così chi vuole solo essere
  // trovato non deve premere due volte.
  const btnPos = document.getElementById('btn-stasera-posizione');
  if (btnPos) btnPos.addEventListener('click', () => apriPosizione(false));

  const btnSat = document.getElementById('btn-satelliti-aggiorna');
  if (btnSat) btnSat.addEventListener('click', () => aggiornaPassaggiSatelliti(true));
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
              <button onclick="apriDiarioEvento('${v.id}')" class="px-2.5 py-1 mt-1 rounded-full text-xs font-semibold bg-slate-700 hover:bg-blue-600 text-slate-100 transition-colors" title="Modifica questa osservazione">Modifica</button>
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
  // L'agenda potrebbe essere ferma su un altro mese: portiamola dove serve,
  // altrimenti la scheda cercata non è nemmeno disegnata
  const cercato = eventiCalcolati.find(e => e.id === id);
  if (cercato) portaAlMeseDellEvento(cercato.dataObj);
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
    // Non solo le coordinate: anche il nome del luogo e da quale strato
    // veniva, così un ripristino non degrada un GPS in "punto anonimo".
    posizione: sky.posizione
      ? { lat: sky.posizione.lat, lon: sky.posizione.lon, nome: sky.posizione.nome, origine: sky.posizione.origine }
      : luogoCorrente(),
    bussola: localStorage.getItem(CHIAVE_SKY_BUSSOLA),
    cameraCampo: localStorage.getItem(CHIAVE_SKY_CAMERA)
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
      skyImpostaPosizione(dati.posizione.lat, dati.posizione.lon, 'backup', {
        nome: dati.posizione.nome || null,
        origine: dati.posizione.origine || null
      });
    }
    if (dati.bussola) {
      try { localStorage.setItem(CHIAVE_SKY_BUSSOLA, dati.bussola); } catch (e) { /* niente storage */ }
    }
    // La taratura dell'obiettivo vale per la fotocamera di quel telefono: se
    // il backup arriva da un altro, basta rifarla col pizzico (o azzerarla)
    if (dati.cameraCampo) {
      try { localStorage.setItem(CHIAVE_SKY_CAMERA, dati.cameraCampo); } catch (e) { /* niente storage */ }
      const c = parseFloat(dati.cameraCampo);
      if (!isNaN(c)) sky.cameraCampoLato = Math.max(SKY_CAMERA_LATO_MIN, Math.min(SKY_CAMERA_LATO_MAX, c));
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
  if (!box) return;
  if (!luogo) {
    box.textContent = 'Non impostata: molte funzioni restano spente.';
    box.className = 'text-sm text-amber-400';
    return;
  }
  // Dire anche da dove arriva: "Roma" rilevata col GPS e "Roma" dedotta
  // dall'indirizzo IP non danno lo stesso cielo.
  const p = (typeof sky !== 'undefined' && sky.posizione) ? sky.posizione : null;
  const et = p ? POS_ETICHETTE[p.origine || p.fonte] : null;
  const dove = etichettaLuogo();
  const coord = formattaCoordinate(luogo.lat, luogo.lon);
  box.textContent = `${dove}${dove === coord ? '' : ` · ${coord}`}` +
    (et ? ` · ${et.provenienza}` : '');
  box.className = qualitaPosizione() === 'approssimata' ? 'text-sm text-amber-400' : 'text-sm text-green-400';
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

  // La posizione si gestisce in un posto solo: qui c'è la porta per arrivarci
  const btnPos = document.getElementById('imp-btn-posizione');
  if (btnPos) btnPos.addEventListener('click', () => {
    chiudi();
    apriPosizione(false);
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
// 18. COSTELLAZIONI E deep sky NEL PLANETARIO
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

// Oggetti del deep sky alla portata di occhio nudo e binocolo.
// `distanza` e `dimensione` sono i dati che la scheda mostra e che non si
// possono calcolare: la prima è una misura di catalogo, la seconda è quanto
// grande appare in cielo (per confronto, la Luna piena misura circa 30′).
// `assePrimi`, `asseMinore` e `angoloPosizione` sono la stessa misura in
// forma di numeri — asse maggiore e minore in primi d'arco, orientamento in
// gradi dal nord celeste verso est — e servono a disegnarli grandi e
// storti come sono davvero, invece che tutti uguali (vedi skyDisegnaProfondo).
const SKY_PROFONDO = [
  { nome: 'M31 — Galassia di Andromeda', ra: 0.712, dec: 41.269, mag: 3.4, tipo: 'galassia', assePrimi: 190, asseMinore: 60, angoloPosizione: 38, strumento: 'occhio',
    distanza: '2,5 milioni di anni luce', dimensione: '3° × 1° (sei volte la Luna piena)',
    nota: 'La cosa più lontana visibile a occhio nudo: 2,5 milioni di anni luce. Nel binocolo è una macchia ovale.' },
  { nome: 'M42 — Nebulosa di Orione', ra: 5.588, dec: -5.391, mag: 4.0, tipo: 'nebulosa', assePrimi: 65, asseMinore: 60, angoloPosizione: 20, strumento: 'occhio',
    distanza: '1.344 anni luce', dimensione: '65′ × 60′',
    nota: 'La stella di mezzo della spada di Orione non è una stella: è una nursery di stelle appena nate.' },
  { nome: 'M45 — Pleiadi', ra: 3.790, dec: 24.117, mag: 1.6, tipo: 'ammasso', assePrimi: 110, asseMinore: 100, angoloPosizione: 0, strumento: 'occhio',
    distanza: '444 anni luce', dimensione: '110′ (quattro Lune piene in fila)',
    nota: 'Le “sette sorelle”. A occhio nudo se ne contano 6–7, col binocolo diventano decine.' },
  { nome: 'M44 — Presepe', ra: 8.670, dec: 19.983, mag: 3.7, tipo: 'ammasso', assePrimi: 95, asseMinore: 95, angoloPosizione: 0, strumento: 'binocolo',
    distanza: '577 anni luce', dimensione: '95′',
    nota: 'Una nuvoletta a occhio nudo, uno sciame di stelle nel binocolo.' },
  { nome: 'M13 — Ammasso di Ercole', ra: 16.695, dec: 36.460, mag: 5.8, tipo: 'globulare', assePrimi: 20, asseMinore: 20, angoloPosizione: 0, strumento: 'binocolo',
    distanza: '22.200 anni luce', dimensione: '20′',
    nota: 'Mezzo milione di stelle in una palla: il più bell\'ammasso globulare del cielo boreale.' },
  { nome: 'M8 — Nebulosa Laguna', ra: 18.060, dec: -24.383, mag: 6.0, tipo: 'nebulosa', assePrimi: 90, asseMinore: 40, angoloPosizione: 75, strumento: 'binocolo',
    distanza: '4.100 anni luce', dimensione: '90′ × 40′',
    nota: 'Nel cuore della Via Lattea estiva, sopra il “becco” della teiera del Sagittario.' },
  { nome: 'M22 — Globulare del Sagittario', ra: 18.606, dec: -23.904, mag: 5.1, tipo: 'globulare', assePrimi: 32, asseMinore: 32, angoloPosizione: 0, strumento: 'binocolo',
    distanza: '10.400 anni luce', dimensione: '32′',
    nota: 'Più luminoso di M13 ma più basso: serve un orizzonte sud pulito.' },
  { nome: 'Doppio Ammasso di Perseo', ra: 2.317, dec: 57.133, mag: 4.3, tipo: 'ammasso', assePrimi: 60, asseMinore: 30, angoloPosizione: 100, strumento: 'binocolo',
    distanza: '7.500 anni luce', dimensione: '60′ in due gruppi',
    nota: 'Due ammassi vicini nello stesso campo del binocolo: uno dei colpi d\'occhio più belli.' },
  { nome: 'M57 — Nebulosa Anello', ra: 18.893, dec: 33.029, mag: 8.8, tipo: 'planetaria', assePrimi: 1.4, asseMinore: 1, angoloPosizione: 60, strumento: 'telescopio',
    distanza: '2.300 anni luce', dimensione: '1,4′ × 1′',
    nota: 'Un anello di fumo lasciato da una stella morente, fra le due stelle basse della Lira.' },
  { nome: 'M27 — Nebulosa Manubrio', ra: 19.994, dec: 22.721, mag: 7.4, tipo: 'planetaria', assePrimi: 8, asseMinore: 6, angoloPosizione: 30, strumento: 'telescopio',
    distanza: '1.360 anni luce', dimensione: '8′ × 6′',
    nota: 'Grande e alla portata di un piccolo telescopio, sotto cieli scuri anche del binocolo.' },
  { nome: 'M51 — Galassia Vortice', ra: 13.498, dec: 47.195, mag: 8.4, tipo: 'galassia', assePrimi: 11, asseMinore: 7, angoloPosizione: 170, strumento: 'telescopio',
    distanza: '23 milioni di anni luce', dimensione: '11′ × 7′',
    nota: 'Due galassie in collisione, sotto la coda del Grande Carro.' },
  { nome: 'M81 — Galassia di Bode', ra: 9.926, dec: 69.066, mag: 6.9, tipo: 'galassia', assePrimi: 27, asseMinore: 14, angoloPosizione: 157, strumento: 'telescopio',
    distanza: '12 milioni di anni luce', dimensione: '27′ × 14′',
    nota: 'Insieme a M82 entra nello stesso campo: due galassie in un colpo solo.' },
  { nome: 'M15 — Globulare di Pegaso', ra: 21.500, dec: 12.167, mag: 6.2, tipo: 'globulare', assePrimi: 18, asseMinore: 18, angoloPosizione: 0, strumento: 'binocolo',
    distanza: '33.600 anni luce', dimensione: '18′',
    nota: 'Compatto e luminoso, facile da trovare partendo da Enif.' },
  { nome: 'M3 — Globulare dei Cani da Caccia', ra: 13.703, dec: 28.377, mag: 6.2, tipo: 'globulare', assePrimi: 18, asseMinore: 18, angoloPosizione: 0, strumento: 'binocolo',
    distanza: '33.900 anni luce', dimensione: '18′',
    nota: 'Primavera: a metà strada fra Arturo e Cor Caroli.' }
];

// Come si chiama in italiano, e con che parola, ciascun tipo di oggetto profondo
const SKY_NOMI_PROFONDO = {
  galassia: 'Galassia', nebulosa: 'Nebulosa diffusa', ammasso: 'Ammasso aperto',
  globulare: 'Ammasso globulare', planetaria: 'Nebulosa planetaria'
};

// Colori per tipo di oggetto profondo
const SKY_COLORI_PROFONDO = {
  galassia: '#c4b5fd', nebulosa: '#f9a8d4', ammasso: '#a5f3fc',
  globulare: '#fde68a', planetaria: '#86efac'
};

// L'ora mostrata nel planetario: normalmente adesso, ma la si può
// spostare avanti e indietro — di secondi o di anni — per rivedere una notte
// passata o preparare quella che verrà.
function skyAdesso() {
  return new Date(Date.now() + (sky.offsetTempoSec || 0) * 1000);
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
        // Le coordinate di catalogo restano attaccate alla stella: servono
        // alla scheda che si apre toccandola sulla mappa
        return { az: hor.azimuth, alt: hor.altitude, ra: s[0], dec: s[1], mag: s[2], nome: s[3] };
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

  // La banda della Via Lattea: novanta punti, ricalcolati con il resto
  if (sky.mostraViaLattea) {
    sky.viaLattea = SKY_VIA_LATTEA.map(o => {
      const hor = Astronomy.Horizon(t, sky.observer, o.ra, o.dec, 'normal');
      return { az: hor.azimuth, alt: hor.altitude, luce: o.luce };
    });
  } else {
    sky.viaLattea = [];
  }
}

// Figure delle costellazioni: linee sottili e stelle proporzionate alla luminosità
function skyDisegnaCostellazioni(ctx, base, focale) {
  if (!sky.costellazioni || !sky.costellazioni.length) return;
  const velo = skyVelo();
  if (velo < 0.06) return;      // in pieno giorno non si vede nessuna figura

  ctx.save();
  sky.costellazioni.forEach(c => {
    const punti = c.stelle.map(s => skyProietta(skyVettore(s.az, s.alt), base, focale));

    // Linee della figura: un filo, non un disegno tecnico. Quelle che
    // passano sotto l'orizzonte restano un'ombra: la figura si intuisce, ma
    // non sembra disegnata sul prato davanti a casa.
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.1;
    [{ sotto: false, alpha: 0.4 }, { sotto: true, alpha: 0.1 }].forEach(passo => {
      ctx.strokeStyle = `rgba(120, 178, 255, ${passo.alpha * velo})`;
      ctx.beginPath();
      c.linee.forEach(([i, j]) => {
        const a = punti[i], b = punti[j];
        if (!a || !b || !a.davanti || !b.davanti) return;
        const interrata = (c.stelle[i].alt + c.stelle[j].alt) / 2 < 0;
        if (interrata !== passo.sotto) return;
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
      });
      ctx.stroke();
    });

    // Stelle della costellazione
    c.stelle.forEach((s, i) => {
      const p = punti[i];
      if (!p.davanti) return;
      if (p.px < -20 || p.px > sky.larghezza + 20 || p.py < -20 || p.py > sky.altezza + 20) return;
      const r = Math.max(1.2, Math.min(4.5, 3.6 - s.mag * 0.55));
      if (s.alt < 0) {
        ctx.globalAlpha = 0.22 * velo;
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      // Le stelle delle figure sono la trama del cielo: disegnate come punti
      // luminosi con l'alone, non come pallini, la mappa cambia faccia
      const forza = velo * skyEstinzione(s.alt) * (s.mag < 2 ? 1 : 0.85);
      if (forza < 0.05) return;
      skyDisegnaPuntoStellare(ctx, p.px, p.py, r * 0.9, '#dbe6ff', forza, s.mag < 1.3);
    });

    // Nome della costellazione al centro della figura, se è in vista
    const visibili = punti.filter((p, i) => p.davanti && c.stelle[i].alt > 0 &&
      p.px > 0 && p.px < sky.larghezza && p.py > 0 && p.py < sky.altezza);
    if (sky.mostraNomi && visibili.length >= Math.max(2, Math.ceil(punti.length / 2))) {
      const cx = visibili.reduce((s, p) => s + p.px, 0) / visibili.length;
      const cy = visibili.reduce((s, p) => s + p.py, 0) / visibili.length;
      ctx.globalAlpha = 0.7 * velo;
      ctx.font = 'italic 13px system-ui, sans-serif';
      ctx.fillStyle = '#a8c8ff';
      ctx.textAlign = 'center';
      ctx.fillText(c.nome, cx, cy);
    }
  });
  ctx.restore();
}

// Oggetti del deep sky.
// Erano cerchietti tratteggiati: un simbolo su una carta, non una cosa che
// si guarda. Adesso ognuno è la nuvola di luce che è davvero, grande quanto
// è grande in cielo (M31 è larga sei Lune piene, e a campo stretto si vede)
// e orientata come sta lassù. Sotto una certa misura sullo schermo resta
// comunque un fiocchetto visibile: se no, ingrandendo si perderebbero.
// L'angolo di posizione è misurato dal nord celeste verso est, come su tutti
// i cataloghi: sullo schermo diventa una direzione sola, con la stessa
// bussola che orienta i mari della Luna.
function skyDisegnaProfondo(ctx, base, focale) {
  if (!sky.profondo || !sky.profondo.length) return;
  const velo = skyVelo();
  if (velo < 0.05) return;                 // di giorno non c'è niente da vedere

  ctx.save();
  sky.profondo.forEach(o => {
    const v = skyVettore(o.az, o.alt);
    const p = skyProietta(v, base, focale);
    if (!p.davanti) return;

    // Quanto è grande sullo schermo: mezzo asse maggiore, in pixel. Il
    // minimo tiene visibili gli oggetti piccoli (M57 è un anellino di un
    // primo e mezzo: a campo largo sarebbe mezzo pixel).
    const primi = typeof o.assePrimi === 'number' ? o.assePrimi : 20;
    const vero = focale * Math.tan(primi / 120 * SKY_D2R);
    const R = Math.max(9, vero);
    const rapporto = typeof o.asseMinore === 'number' && primi > 0
      ? Math.max(0.2, o.asseMinore / primi) : 1;
    const margine = R * 1.4 + 20;
    if (p.px < -margine || p.px > sky.larghezza + margine ||
        p.py < -margine || p.py > sky.altezza + margine) return;

    const alpha = (o.alt < 0 ? 0.18 : 0.95 * skyEstinzione(o.alt)) * velo;
    if (alpha < 0.04) return;

    // L'angolo di posizione, portato sullo schermo
    const polo = skyVettore(0, sky.observer ? sky.observer.latitude : 45);
    const pv = skyDot(polo, v);
    const nord = skyNormalizza([polo[0] - pv * v[0], polo[1] - pv * v[1], polo[2] - pv * v[2]]);
    const est = skyNormalizza(skyCross(polo, v));
    const pa = (typeof o.angoloPosizione === 'number' ? o.angoloPosizione : 0) * SKY_D2R;
    const d = [
      nord[0] * Math.cos(pa) + est[0] * Math.sin(pa),
      nord[1] * Math.cos(pa) + est[1] * Math.sin(pa),
      nord[2] * Math.cos(pa) + est[2] * Math.sin(pa)
    ];
    const rotazione = Math.atan2(-skyDot(d, base.u), skyDot(d, base.r));

    const tela = skyFacciaProfondo(o, R);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.px, p.py);
    if (tela) {
      // Additiva: la luce delle nebulose si somma a quella del cielo, non lo
      // copre — è per questo che sotto un cielo chiaro non si vedono più
      ctx.globalCompositeOperation = 'lighter';
      ctx.rotate(rotazione);
      ctx.scale(1, rapporto);
      ctx.drawImage(tela, -R * 1.25, -R * 1.25, R * 2.5, R * 2.5);
    } else {
      ctx.fillStyle = SKY_COLORI_PROFONDO[o.tipo] || '#a5f3fc';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (sky.mostraNomi) {
      ctx.globalAlpha = (o.alt < 0 ? 0.3 : 0.85) * velo;
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = SKY_COLORI_PROFONDO[o.tipo] || '#a5f3fc';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(o.nome.split(' — ')[0], p.px + Math.min(R + 8, 60), p.py);
    }
  });
  ctx.restore();
}

// --- Macchina del tempo del planetario ---
// L'istante mostrato si può dire in due modi, e servono tutti e due: uno
// scarto rispetto a ora (i salti e la slitta, per "com'è fra dieci minuti")
// oppure una data e un'ora precise (per "com'era la notte in cui…"). Sotto
// sotto è sempre lo stesso numero, `offsetTempoSec`.
//
// La slitta non copre tutto: scorre dentro una finestra scelta, centrata su
// un'ancora. Con una slitta unica da mesi a mesi un pixel valeva mezz'ora e
// dei secondi non si parlava nemmeno; con la finestra a ±10 minuti un pixel
// vale pochi secondi, ed è lì che la precisione serve davvero.

// Fin dove arriva la macchina del tempo. Prima era «mezzo secolo in ogni
// verso», una misura comoda da scrivere ma che non voleva dire niente per chi
// guarda: non si pensa «fra cinquant'anni», si pensa «nel 2100», «nel 3000».
// Adesso gli estremi sono due anni veri — gli stessi del calendario
// (ANNO_MINIMO_NAVIGABILE e ANNO_MASSIMO_NAVIGABILE) — e lo scarto massimo si
// ricava da lì, perché in secondi cambia di giorno in giorno.
function skyLimiteTempoSec(verso) {
  const ora = Date.now();
  if (verso > 0) return (new Date(ANNO_MASSIMO_NAVIGABILE, 11, 31, 23, 59, 59).getTime() - ora) / 1000;
  return (new Date(ANNO_MINIMO_NAVIGABILE, 0, 1, 0, 0, 0).getTime() - ora) / 1000;
}

// Siamo arrivati a un capolinea? Serve al playback e alla marcia del Sistema
// Solare, che a fine corsa si devono fermare da soli invece di spingere
// contro il fermo col tasto acceso a vuoto.
function skyAlCapolineaDelTempo() {
  const s = sky.offsetTempoSec || 0;
  return s >= skyLimiteTempoSec(1) - 1 || s <= skyLimiteTempoSec(-1) + 1;
}

// Come si dice a chi guarda dove finisce la corsa
function skyTestoCapolinea() {
  return `La macchina del tempo va dal ${ANNO_MINIMO_NAVIGABILE} al ${ANNO_MASSIMO_NAVIGABILE}.`;
}

// "fra 2 h 15 min", "3 g 4 h fa": lo scarto detto in parole
function skyScartoTempoTesto(secondi) {
  const a = Math.abs(secondi);
  const g = Math.floor(a / 86400);
  const h = Math.floor((a % 86400) / 3600);
  const m = Math.floor((a % 3600) / 60);
  const s = Math.floor(a % 60);
  const pezzi = [];
  if (g) pezzi.push(`${g} g`);
  if (h) pezzi.push(`${h} h`);
  if (m) pezzi.push(`${m} min`);
  if (s && !g && !h) pezzi.push(`${s} s`);
  const durata = pezzi.join(' ') || '0 s';
  return secondi > 0 ? `fra ${durata}` : `${durata} fa`;
}

function skyAggiornaTestoTempo() {
  const quando = skyAdesso();
  const scarto = Math.round(sky.offsetTempoSec || 0);
  // Mentre il playback cammina, l'istante da solo non basta: bisogna vedere
  // anche in che verso e con che passo sta scorrendo
  const marcia = sky.playbackVerso
    ? `${sky.playbackVerso > 0 ? '▶' : '◀'} ${skyVelocitaPlayback().nome}`
    : '';
  const spostato = scarto !== 0 || !!sky.playbackVerso;

  const el = document.getElementById('skymap-tempo-testo');
  if (el) {
    const istante = quando.toLocaleString('it-IT', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const scartoTesto = scarto === 0 ? 'in tempo reale' : skyScartoTempoTesto(scarto);
    el.textContent = [istante, scartoTesto, marcia].filter(Boolean).join(' · ');
    el.classList.toggle('spostata', spostato);
  }

  // La barra in fondo alla mappa: l'istante mostrato si legge sempre, non
  // solo quando è già andato storto qualcosa. Fuori dal tempo reale si
  // accende d'ambra e tira fuori il ⟲, che è l'unica via di ritorno che serva
  // avere sempre sotto il pollice.
  const barra = document.getElementById('cielo-tempo');
  if (barra) barra.classList.toggle('spostata', spostato);

  const lettura = document.getElementById('skymap-tempo-quando');
  if (lettura) {
    lettura.textContent = skyTestoBarraTempo(quando, scarto, marcia);
    const esteso = quando.toLocaleString('it-IT', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    lettura.title = `${esteso}${scarto === 0 ? ' (tempo reale)' : ' · ' + skyScartoTempoTesto(scarto)}` +
      ' — tocca per data, passo e velocità del playback';
  }

  skyAggiornaCampoData(quando);
}

// Lo stesso scarto in forma di targhetta: "+20 min", "+7h46", "−3g 4h". Serve
// dove lo spazio si conta a lettere — la barra del tempo su un telefono — e
// dove "3 g 4 h fa" non ci starebbe mai.
function skyScartoBreve(secondi) {
  const a = Math.abs(secondi);
  const segno = secondi > 0 ? '+' : '−';
  const g = Math.floor(a / 86400);
  const h = Math.floor((a % 86400) / 3600);
  const m = Math.floor((a % 3600) / 60);
  // Le ore si scrivono all'orologiaia — "+7h46" — perché "+7 h 46" lascia
  // quel 46 senza unità, e chi legge di sfuggita capisce quarantasei ore
  if (g) return `${segno}${g}g${h ? ' ' + h + 'h' : ''}`;
  if (h) return `${segno}${h}h${m ? String(m).padStart(2, '0') : ''}`;
  if (m) return `${segno}${m} min`;
  return `${segno}${Math.floor(a)} s`;
}

// Che cosa scrive la barra del tempo. Deve stare in una pillola stretta senza
// rubare spazio alla slitta, quindi dice il minimo che serve a non sbagliarsi:
//   · l'ora, sempre;
//   · il giorno, solo se non è oggi (spostarsi di tre ore è un conto,
//     spostarsi di tre giorni e vedere solo "22:41" è una trappola);
//   · di quanto ci si è spostati — o, se il cielo sta camminando, a che passo,
//     perché lì lo scarto cambia a ogni fotogramma ed è illeggibile.
// L'ultima riga è quella che cambia con la larghezza: sulla mappa larga si
// dice per esteso ("fra 20 min"), su quella stretta in targhetta ("+20 min").
function skyTestoBarraTempo(quando, scarto, marcia) {
  const ora = quando.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const oggi = new Date();
  const giorno = quando.toDateString() === oggi.toDateString()
    ? ''
    : quando.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ' ';
  const testa = giorno + ora;
  if (scarto === 0 && !marcia) return testa;

  const stretta = !sky.larghezza || sky.larghezza < 500;
  // Su una mappa stretta, quando c'è già la data non si aggiunge anche di
  // quanto: "5 ago 10:01" dice dove sei meglio di "5 ago 10:01 · +3 g" tagliato
  if (stretta && giorno && !marcia) return testa;

  const coda = marcia || (stretta ? skyScartoBreve(scarto) : skyScartoTempoTesto(scarto));
  return `${testa} · ${coda}`;
}

// --- Le sei caselle della data ---
// Giorno, mese, anno, ore, minuti, secondi: sei numeri, nell'ordine in cui in
// italiano una data si dice. Ognuno è un campo suo, e l'anno si scrive per
// intero — è l'unico modo di arrivare al 3000 senza mille clic su una
// freccetta.
const SKY_CASELLE_DATA = [
  { id: 'skymap-data-giorno',  leggi: d => d.getDate() },
  { id: 'skymap-data-mese',    leggi: d => d.getMonth() + 1 },
  { id: 'skymap-data-anno',    leggi: d => d.getFullYear(), cifre: 4 },
  { id: 'skymap-data-ore',     leggi: d => d.getHours() },
  { id: 'skymap-data-minuti',  leggi: d => d.getMinutes() },
  { id: 'skymap-data-secondi', leggi: d => d.getSeconds() }
];

// Il campo della data segue l'istante mostrato, ma non mentre ci si scrive
// dentro: sovrascrivere quello che l'utente sta digitando è il modo più
// sicuro di rendere inservibile un campo. Basta che *una* delle caselle abbia
// il fuoco perché tutte stiano ferme: si scrive una data intera, non un
// numero per volta, e riscrivere le altre cinque mentre si digita l'anno
// vorrebbe dire cancellare il giorno appena messo.
function skyAggiornaCampoData(quando) {
  const gruppo = document.getElementById('skymap-data');
  if (!gruppo || gruppo.contains(document.activeElement)) return;
  SKY_CASELLE_DATA.forEach(c => {
    const campo = document.getElementById(c.id);
    if (!campo) return;
    const valore = String(c.leggi(quando)).padStart(c.cifre || 2, '0');
    if (campo.value !== valore) campo.value = valore;
  });
}

// Che istante dicono le sei caselle. Torna `null` se quello che c'è scritto
// non è una data: un 31 di febbraio, un anno fuori dai due estremi, una
// casella lasciata vuota. Chi chiama se lo aspetta e rimette i numeri di
// prima, invece di portare il cielo in un posto a caso.
function skyDataDalleCaselle() {
  const n = {};
  for (const c of SKY_CASELLE_DATA) {
    const campo = document.getElementById(c.id);
    if (!campo || campo.value.trim() === '') return null;
    const v = parseInt(campo.value, 10);
    if (!Number.isFinite(v)) return null;
    n[c.id] = v;
  }
  const anno = n['skymap-data-anno'];
  const mese = n['skymap-data-mese'];
  const giorno = n['skymap-data-giorno'];
  if (anno < ANNO_MINIMO_NAVIGABILE || anno > ANNO_MASSIMO_NAVIGABILE) return null;
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
  const d = new Date(anno, mese - 1, giorno,
    n['skymap-data-ore'], n['skymap-data-minuti'], n['skymap-data-secondi'], 0);
  if (isNaN(d.getTime())) return null;
  // Il 31 di febbraio, scritto in un campo, diventerebbe il 3 di marzo senza
  // che nessuno lo dica: se la data si è "sistemata" da sola non era una data
  if (d.getFullYear() !== anno || d.getMonth() !== mese - 1 || d.getDate() !== giorno) return null;
  return d;
}

// "Vai": porta il cielo alla data scritta. Se non è una data, le caselle
// tornano a dire l'istante mostrato — un errore che si corregge da sé è
// meglio di un messaggio da leggere.
function skyVaiAllaDataScritta() {
  const d = skyDataDalleCaselle();
  if (!d) {
    skyAvviso('data', `Quella data non esiste. ${skyTestoCapolinea()}`, 5000);
    skyAggiornaTestoTempo();
    return;
  }
  skyAvviso('data', '');
  // Chi scrive un istante preciso vuole quello, non vederselo scorrere via:
  // si ferma tutto ciò che sta camminando, di qua come nella finestra del
  // Sistema Solare, che è lo stesso orologio
  skyFermaPlayback();
  sol.marcia = 0;
  skyImpostaOffsetTempo((d.getTime() - Date.now()) / 1000);
}

// La slitta si riadatta alla finestra scelta. Il passo è la finestra divisa
// in circa 1.400 tacche: con ±10 minuti sono scatti da un secondo.
function skyAggiornaSlittaTempo() {
  const slitta = document.getElementById('skymap-tempo');
  if (!slitta) return;
  const f = sky.finestraTempoSec;
  slitta.min = String(-f);
  slitta.max = String(f);
  slitta.step = String(Math.max(1, Math.round(f / 720)));
  const valore = Math.max(-f, Math.min(f, (sky.offsetTempoSec || 0) - sky.ancoraTempoSec));
  if (parseFloat(slitta.value) !== valore) slitta.value = String(valore);
}

// `daSlitta`: il valore arriva dalla slitta, quindi è già dentro la finestra
// e l'ancora non va spostata (se no il pollice si troverebbe il cursore che
// gli scappa sotto).
//
// `fluido`: lo scarto arriva dal playback, un fotogramma per volta. Lì i
// decimi di secondo vanno tenuti (arrotondando, alle velocità lente il tempo
// non si muoverebbe più: mezzo secondo per fotogramma sparirebbe a ogni
// passaggio) e il ricalcolo pieno non si forza — ci pensa il ciclo di
// disegno, che durante il playback gira a passo ridotto.
function skyImpostaOffsetTempo(secondi, opzioni = {}) {
  const valore = Number(secondi) || 0;
  sky.offsetTempoSec = Math.max(skyLimiteTempoSec(-1), Math.min(skyLimiteTempoSec(1),
    opzioni.fluido ? valore : Math.round(valore)));

  // Se l'istante nuovo è fuori dalla finestra, la finestra lo segue: altrimenti
  // la slitta resterebbe incollata a un estremo senza poter più tornare
  if (!opzioni.daSlitta && Math.abs(sky.offsetTempoSec - sky.ancoraTempoSec) > sky.finestraTempoSec) {
    sky.ancoraTempoSec = sky.offsetTempoSec;
  }

  if (!opzioni.fluido) {
    sky.prossimoCalcolo = 0;                     // ricalcolo immediato
    sky.cacheOrari = { chiave: null, valore: null };
  }
  skyAggiornaSlittaTempo();
  skyAggiornaTestoTempo();
  // Dalla slitta, mentre il pollice scorre, arrivano decine di valori al
  // secondo: rifare qui i conti a ognuno vuol dire farli anche tre volte per
  // fotogramma, e il cielo va a scatti proprio mentre lo si sta scorrendo. Con
  // il planetario aperto basta segnare che il conto è scaduto (`prossimoCalcolo`
  // è già a zero): il ciclo di disegno lo rifà una volta sola, al fotogramma
  // dopo, con l'ultimo valore arrivato. Fuori dal ciclo — vista chiusa — il
  // conto va invece fatto subito, perché non c'è nessuno che lo farà.
  const aspettaIlFotogramma = opzioni.daSlitta && sky.aperto && sky.raf;
  if (!opzioni.fluido && !aspettaIlFotogramma) skyAggiornaOggetti(true);
}

// Quanto tempo copre la slitta, da un estremo all'altro
function skyImpostaFinestraTempo(secondi) {
  sky.finestraTempoSec = Math.max(60, secondi || 3600);
  sky.ancoraTempoSec = sky.offsetTempoSec || 0;   // la finestra si centra su qui
  skyAggiornaSlittaTempo();
}

// Il passo del tempo: quanto spostano i due tasti − e +, e insieme quanto
// tempo copre la slitta che ci sta in mezzo. Sono la stessa cosa detta due
// volte — chi lavora al secondo vuole la slitta sui minuti, chi salta di
// giorno in giorno la vuole sul mese — e prima erano due file di tasti da
// tenere d'accordo a mano. Adesso è una scelta sola.
const SKY_FINESTRA_DEL_PASSO = {
  10: 600,          // dieci secondi di passo, slitta su ±10 minuti
  60: 3600,
  600: 43200,
  3600: 604800,
  86400: 2592000    // un giorno di passo, slitta su ±30 giorni
};

function skyImpostaPassoTempo(secondi) {
  const passo = Math.max(1, parseInt(secondi, 10) || 600);
  sky.passoTempoSec = passo;
  document.querySelectorAll('#cielo-comandi [data-passo-tempo]').forEach(b => {
    const scelto = parseInt(b.dataset.passoTempo, 10) === passo;
    b.classList.toggle('attiva', scelto);
    b.setAttribute('aria-pressed', scelto ? 'true' : 'false');
  });
  skyImpostaFinestraTempo(SKY_FINESTRA_DEL_PASSO[passo] || passo * 72);
}

// Un passo avanti o indietro (verso +1 o −1). Non ferma il playback: è una
// spinta, e mentre il cielo cammina serve proprio a quello — saltare la
// mezz'ora che non interessa.
function skySpostaDiUnPasso(verso) {
  const passo = sky.passoTempoSec || 600;
  skyImpostaOffsetTempo((sky.offsetTempoSec || 0) + verso * passo);
}

// --- Playback del tempo ---
// I salti e la slitta portano su un istante e lì si fermano. Il playback
// invece fa camminare l'orologio, avanti o indietro, e il cielo si muove
// sotto gli occhi: è l'unico modo per vedere quello che un fermo immagine
// non racconta — la volta che ruota attorno alla Polare, la Luna che
// scivola fra le stelle di notte in notte, un pianeta che rallenta, si
// ferma e torna indietro.
//
// La velocità è un moltiplicatore del tempo vero: 3.600× vuol dire che in
// un secondo di orologio passa un'ora di cielo. Siccome l'istante mostrato
// è "adesso + scarto", e l'"adesso" cammina già per conto suo, allo scarto
// se ne aggiunge una in meno: v − 1 andando avanti, −v − 1 all'indietro.
// Con v = 1 in avanti lo scarto sta fermo, ed è esattamente il tempo reale.

const SKY_VELOCITA_PLAYBACK = [
  { fattore: 10,      nome: '10 s/s' },    // le stazioni spaziali che attraversano il cielo
  { fattore: 60,      nome: '1 min/s' },
  { fattore: 300,     nome: '5 min/s' },   // la rotazione della volta si vede a occhio
  { fattore: 1800,    nome: '30 min/s' },
  { fattore: 3600,    nome: '1 h/s' },     // alba e tramonto in pochi secondi
  { fattore: 21600,   nome: '6 h/s' },
  { fattore: 86400,   nome: '1 g/s' },     // la Luna che cambia posto e fase
  { fattore: 604800,  nome: '7 g/s' },
  { fattore: 2592000, nome: '30 g/s' }     // le stagioni, i pianeti che tornano indietro
];

const SKY_PLAYBACK_INTERVALLO = 80;   // ms fra un ricalcolo e l'altro, col playback acceso
const SKY_PLAYBACK_SALTO_MAX = 0.5;   // s reali: oltre, l'intervallo si taglia

function skyVelocitaPlayback() {
  const i = Math.max(0, Math.min(SKY_VELOCITA_PLAYBACK.length - 1, sky.playbackVelIndice || 0));
  return SKY_VELOCITA_PLAYBACK[i];
}

// Un fotogramma di playback: sposta lo scarto di quanto è passato davvero,
// moltiplicato per la velocità scelta. Chiamata dal ciclo di disegno.
function skyAvanzaPlayback() {
  if (!sky.playbackVerso) return;

  const ora = performance.now();
  const precedente = sky.playbackUltimo || ora;
  sky.playbackUltimo = ora;
  // Dopo un fotogramma perso (o al ritorno da un'altra scheda) l'intervallo
  // sarebbe enorme e il cielo farebbe un balzo: si taglia
  const dt = Math.min(SKY_PLAYBACK_SALTO_MAX, Math.max(0, (ora - precedente) / 1000));
  if (!dt) return;

  const v = skyVelocitaPlayback().fattore * sky.playbackVerso;
  const nuovo = (sky.offsetTempoSec || 0) + (v - 1) * dt;

  // Arrivati al capolinea della macchina del tempo il playback si ferma da
  // solo, invece di spingere contro il limite col tasto acceso a vuoto
  if (nuovo >= skyLimiteTempoSec(1) || nuovo <= skyLimiteTempoSec(-1)) {
    skyFermaPlayback();
    skyImpostaOffsetTempo(nuovo);   // lo scarto viene tosato al limite
    skyAvviso('playback', `Il playback si ferma qui: ${skyTestoCapolinea().toLowerCase()}`, 6000);
    return;
  }

  skyImpostaOffsetTempo(nuovo, { fluido: true });
}

// Avvia il playback in un verso (+1 avanti, −1 indietro). Ripremendo il
// tasto già acceso si mette in pausa: è quello che fa ogni lettore.
function skyAvviaPlayback(verso) {
  if (sky.playbackVerso === verso) { skyFermaPlayback(); return; }
  sky.playbackVerso = verso;
  sky.playbackUltimoVerso = verso;  // il play della barra ripartirà di qui
  sky.playbackUltimo = 0;          // il primo dt parte dal fotogramma dopo
  sky.prossimoCalcolo = 0;         // il cielo riparte subito, non fra un secondo
  skyAvviso('playback', '');
  skyAggiornaComandiPlayback();
  skyAggiornaTestoTempo();
}

function skyFermaPlayback() {
  if (!sky.playbackVerso) return;
  sky.playbackVerso = 0;
  sky.playbackUltimo = 0;
  skyAggiornaComandiPlayback();
  // Fermandosi si torna a un secondo intero (camminando lo scarto porta i
  // decimi) e si rifà il conto pieno, che nel frattempo girava a passo ridotto
  skyImpostaOffsetTempo(Math.round(sky.offsetTempoSec || 0));
}

// Il moltiplicatore sale e scende per gradini. Si può cambiare anche mentre
// il cielo cammina: cambia il passo, non l'istante raggiunto.
function skyCambiaVelocitaPlayback(passo) {
  const massimo = SKY_VELOCITA_PLAYBACK.length - 1;
  sky.playbackVelIndice = Math.max(0, Math.min(massimo, (sky.playbackVelIndice || 0) + passo));
  skyAggiornaComandiPlayback();
  skyAggiornaTestoTempo();
}

// Tasti del playback e lettura della velocità. Ai due estremi della scala i
// tasti si spengono: dire "più veloce" quando più veloce non c'è confonde.
function skyAggiornaComandiPlayback() {
  skyTasto('skymap-play-indietro', sky.playbackVerso < 0);
  skyTasto('skymap-play-avanti', sky.playbackVerso > 0);

  const v = skyVelocitaPlayback();
  const lettura = document.getElementById('skymap-vel-valore');
  if (lettura) {
    // Solo il passo, senza il moltiplicatore: "1 h/s" dice già tutto, e sul
    // telefono "3.600× · 1 h/s" mandava a capo la riga del playback
    lettura.textContent = v.nome;
    lettura.title = `In un secondo vero passa ${v.nome.replace('/s', '')} di cielo (${v.fattore.toLocaleString('it-IT')}×)`;
    lettura.classList.toggle('in-corso', !!sky.playbackVerso);
  }
  const meno = document.getElementById('skymap-vel-meno');
  const piu = document.getElementById('skymap-vel-piu');
  if (meno) meno.disabled = sky.playbackVelIndice <= 0;
  if (piu) piu.disabled = sky.playbackVelIndice >= SKY_VELOCITA_PLAYBACK.length - 1;

  // Il play della barra del tempo: un tasto solo, che avvia e ferma. Da fermo
  // il simbolo ricorda il verso in cui ripartirà — chi ha appena visto Marte
  // tornare indietro trova il ◀ e sa che ripremendo tornerà indietro ancora.
  // In marcia diventa il quadratino di stop e si accende: è l'unico segnale
  // che l'ora si muove da sola, e senza si guarda un cielo che scorre senza
  // sapere chi lo sta spingendo.
  const play = document.getElementById('skymap-tempo-play');
  if (play) {
    const inMarcia = !!sky.playbackVerso;
    const verso = sky.playbackVerso || sky.playbackUltimoVerso || 1;
    play.textContent = inMarcia ? '■' : (verso > 0 ? '▶' : '◀');
    play.classList.toggle('attiva', inMarcia);
    play.setAttribute('aria-pressed', inMarcia ? 'true' : 'false');
    play.setAttribute('aria-label', inMarcia ? 'Ferma il playback' : 'Avvia il playback');
    play.title = inMarcia
      ? `Ferma il playback (il cielo sta camminando a ${v.nome})`
      : `Fai camminare il cielo ${verso > 0 ? 'in avanti' : 'all’indietro'}, a ${v.nome}` +
        ' (verso e velocità si cambiano nel pannello Tempo)';
  }
}

// --- Fotocamera: il cielo calcolato sopra l'immagine reale ---

async function skyAttivaFotocamera() {
  const video = document.getElementById('skymap-video');
  if (!video) return;

  if (sky.camera) {
    sky.camera.getTracks().forEach(t => t.stop());
    sky.camera = null;
    video.srcObject = null;
    video.classList.add('hidden');
    // Spenta la fotocamera il campo torna a essere una preferenza: si riprende
    // quello che c'era prima, e il filtro riparte con lo smorzamento della
    // mappa disegnata.
    sky.cameraCampo = 0;
    if (sky.fovPrimaCamera !== null) { skyImpostaFov(sky.fovPrimaCamera, { morbido: true }); sky.fovPrimaCamera = null; }
    sky.baseFiltrata = null;
    skyAvviso('camera', '');
    skyAvviso('camera-taratura', '');
    skyTasto('skymap-btn-camera', false, 'Fotocamera');
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
    // Il campo scelto a mano si mette da parte: da adesso lo detta l'obiettivo
    // (quello a cui si stava andando, se uno zoom morbido è ancora in viaggio)
    if (sky.fovPrimaCamera === null) sky.fovPrimaCamera = sky.fovVoluto || sky.fov;
    // Il filtro anti-tremolio cambia regime (in AR smorza molto meno):
    // ripartire da zero evita mezzo secondo di scivolata all'accensione.
    sky.baseFiltrata = null;
    skySincronizzaCampoFotocamera();
    // Le misure del video arrivano col primo fotogramma, che può tardare
    video.addEventListener('loadedmetadata', skySincronizzaCampoFotocamera, { once: true });
    skyTasto('skymap-btn-camera', true, 'Spegni fotocamera');
    // Senza bussola l'immagine e il cielo calcolato non possono stare
    // insieme: meglio dirlo subito che lasciar credere a un difetto della
    // realtà aumentata.
    if (!skyUsaSensori()) {
      skyAvviso('camera', sky.sensori
        ? 'Vista sganciata: per sovrapporre il cielo all’immagine riattiva “Segui il telefono”.'
        : 'Senza bussola e giroscopio il cielo non può seguire l’inquadratura: qui la fotocamera fa solo da sfondo.');
    } else {
      skyAvviso('camera', '');
      if (!sky.assoluto) {
        skyAvviso('camera-taratura', 'Bussola relativa: se il cielo è ruotato rispetto all’immagine, ' +
          'correggilo con “Calibra”. Con il pizzico invece si tara il campo dell’obiettivo.', 8000);
      }
    }
  } catch (e) {
    sky.camera = null;
    skyAvviso('camera', 'Fotocamera non disponibile: serve il permesso del browser e una connessione sicura (https).');
  }
}

function skySpegniFotocamera() {
  if (sky.camera) skyAttivaFotocamera();
}

// Collega i comandi nuovi del planetario (chiamata da inizializzaSkymap)
function inizializzaSkymapExtra() {
  const collega = (id, azione) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', azione);
  };

  // --- Il tempo: la slitta, i salti, la data scritta a mano ---
  const slitta = document.getElementById('skymap-tempo');
  if (slitta) {
    slitta.addEventListener('input', () => {
      // Scorrendo a mano il playback si ferma: se no il cursore scapperebbe
      // da sotto il pollice mentre lo si tiene. La posizione del dito però si
      // legge prima di fermarlo: fermandolo la slitta si riallinea all'istante
      // raggiunto, e il primo scatto del trascinamento andrebbe perso.
      const valore = parseFloat(slitta.value) || 0;
      skyFermaPlayback();
      skyImpostaOffsetTempo(sky.ancoraTempoSec + valore, { daSlitta: true });
    });
  }
  const tornaAdesso = () => {
    skyFermaPlayback();
    sky.ancoraTempoSec = 0;
    skyImpostaOffsetTempo(0);
  };
  collega('skymap-tempo-ora', tornaAdesso);
  collega('skymap-tempo-adesso', tornaAdesso);
  // La lettura della barra è anche la porta del pannello: il posto dove uno
  // si accorge che l'ora è sbagliata è lo stesso dove vuole aggiustarla
  collega('skymap-tempo-quando', () => skyMostraGruppo('tempo'));
  // Il play della barra: avvia nel verso di prima, o ferma quello che cammina
  collega('skymap-tempo-play', () => {
    if (sky.playbackVerso) skyFermaPlayback();
    else skyAvviaPlayback(sky.playbackUltimoVerso || 1);
  });
  // Il passo scelto vale per i due tasti e per la slitta insieme
  document.querySelectorAll('#cielo-comandi [data-passo-tempo]').forEach(b => {
    b.addEventListener('click', () => skyImpostaPassoTempo(b.dataset.passoTempo));
  });
  collega('skymap-passo-meno', () => skySpostaDiUnPasso(-1));
  collega('skymap-passo-piu', () => skySpostaDiUnPasso(1));

  // --- Il playback: il verso, lo stop e il moltiplicatore di velocità ---
  collega('skymap-play-indietro', () => skyAvviaPlayback(-1));
  collega('skymap-play-avanti', () => skyAvviaPlayback(1));
  collega('skymap-play-ferma', () => skyFermaPlayback());
  collega('skymap-vel-meno', () => skyCambiaVelocitaPlayback(-1));
  collega('skymap-vel-piu', () => skyCambiaVelocitaPlayback(1));

  // La data scritta a mano: qualsiasi istante fra i due anni estremi, in ora
  // locale. Sono sei caselle, e ognuna si comporta come le altre — Invio vale
  // "Vai", uscire dall'ultima applica quello che si è scritto.
  const gruppoData = document.getElementById('skymap-data');
  if (gruppoData) {
    const anno = document.getElementById('skymap-data-anno');
    if (anno) {
      anno.min = String(ANNO_MINIMO_NAVIGABILE);
      anno.max = String(ANNO_MASSIMO_NAVIGABILE);
    }
    SKY_CASELLE_DATA.forEach(c => {
      const campo = document.getElementById(c.id);
      if (!campo) return;
      campo.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); skyVaiAllaDataScritta(); campo.blur(); }
      });
      // Le frecce ↑ e ↓ dentro alla casella spostano il cielo appena si
      // premono: è il modo più veloce di dire "il giorno dopo, e quello dopo"
      campo.addEventListener('change', skyVaiAllaDataScritta);
    });
    // Uscendo dal gruppo si applica quello che c'è scritto: nessuno deve
    // scoprire, dieci secondi dopo, che la data digitata non è mai partita
    gruppoData.addEventListener('focusout', (e) => {
      if (gruppoData.contains(e.relatedTarget)) return;
      const d = skyDataDalleCaselle();
      const attuale = skyAdesso();
      if (d && Math.abs(d.getTime() - attuale.getTime()) >= 1000) skyVaiAllaDataScritta();
      else skyAggiornaTestoTempo();
    });
  }
  collega('skymap-data-vai', skyVaiAllaDataScritta);

  collega('skymap-btn-costellazioni', () => {
    sky.mostraCostellazioni = !sky.mostraCostellazioni;
    skyAggiornaTastiFiltri();
    skyAggiornaOggetti(true);
  });

  collega('skymap-btn-deepsky', () => {
    sky.mostraProfondo = !sky.mostraProfondo;
    skyAggiornaTastiFiltri();
    skyAggiornaOggetti(true);
  });

  collega('skymap-btn-camera', skyAttivaFotocamera);

  // Uscendo dal planetario la fotocamera si spegne: batteria e privacy
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) skySpegniFotocamera();
  });

  skyImpostaPassoTempo(sky.passoTempoSec);
  skyAggiornaComandiPlayback();
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
        <p class="text-slate-400">Con la tua posizione posso dirti se questo evento si vede da casa tua, a che ora e in che direzione.</p>
        <button onclick="apriPosizione(true)" class="px-3 py-1.5 mt-2 rounded-full text-xs font-semibold bg-slate-700 hover:bg-blue-600 text-slate-100 transition-colors">Dimmi dove sono</button>
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
