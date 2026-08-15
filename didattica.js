// =====================================================================
// AstroCalendario di Ben — IL LABORATORIO (la vista Didattica)
//
//   Le altre viste rispondono a «cosa si vede stanotte». Questa risponde
//   alla domanda che viene subito dopo, e che è quella vera: «perché».
//   Perché Marte per due mesi torna indietro. Perché una sonda per Giove
//   non si può lanciare a marzo. Perché passare vicino a un pianeta fa
//   guadagnare velocità senza accendere niente.
//
//   Tre regole ce le siamo date qui dentro, e valgono per tutti e otto
//   gli esperimenti:
//
//   1. I numeri sono veri. Le posizioni dei pianeti vengono da Astronomy
//      Engine, le date sono date vere, le velocità sono in km/s e i conti
//      sono quelli dei libri (Keplero, vis-viva, Hohmann, l'iperbole del
//      passaggio ravvicinato). Dove qualcosa è stilizzato — la traiettoria
//      delle Voyager fra un incontro e l'altro, il disegno dei corpi che è
//      fuori scala — c'è scritto sotto al disegno. Una simulazione che
//      mente insegna una cosa sbagliata, ed è peggio che non insegnare
//      niente.
//
//   2. Un esperimento per volta. Le linguette in cima cambiano il banco:
//      solo quello a schermo calcola e disegna. Quattro tele che animanod
//      insieme facevano scaldare il telefono per mostrare tre cose che
//      nessuno stava guardando.
//
//   3. Ogni esperimento finisce in un ponte. In fondo a ognuno ci sono i
//      tasti che portano la stessa cosa nel resto dell'app: l'orologio
//      condiviso (`skyImpostaOffsetTempo`) alla data che si sta guardando,
//      il planetario puntato sull'astro (`cercaNelCielo`), il Sistema
//      Solare in 3D (`apriSistemaSolare`), la lezione dell'eclittica
//      (`apriLezioneEclittica`). Il laboratorio spiega la regola; l'app poi
//      la fa vedere nel cielo di stasera. Senza quel passaggio resterebbe
//      un gioco a parte.
//
//   Prefisso `did`. Tutto quello che serve al disegno sta nella sezione 1,
//   e gli otto esperimenti la usano tutti: così hanno la stessa faccia.
// =====================================================================

(function () {
  'use strict';

  // ===================================================================
  // 0. STATO E COSTANTI
  // ===================================================================

  const AU_KM = 149597870.7;          // un'unità astronomica in km
  const MU_SOLE = 4 * Math.PI * Math.PI; // GM del Sole in UA³/anno²
  const UA_ANNO_IN_KMS = 4.740572;    // 1 UA/anno quante km/s sono
  const GIORNO_MS = 86400000;
  const GRADI = 180 / Math.PI;

  // La tavolozza del laboratorio. Sono gli stessi accenti del tema
  // "Deep Space" di style.css, ma scritti qui perché le tele non leggono
  // le variabili CSS: `getComputedStyle` a ogni fotogramma costa più del
  // disegno stesso.
  const C = {
    fondo:      '#05070f',
    fondo2:     '#0a0f1e',
    griglia:    'rgba(148, 168, 214, 0.10)',
    grigliaSu:  'rgba(148, 168, 214, 0.20)',
    testo:      '#e9edf7',
    testo2:     '#a9b4cc',
    testo3:     '#74809a',
    blu:        '#4c8dff',
    bluChiaro:  '#8ab4ff',
    viola:      '#8b5cf6',
    verde:      '#34d399',
    ambra:      '#f5b544',
    rosso:      '#f87171',
    sole:       '#ffc94d',
    terra:      '#4c8dff'
  };

  // I corpi che compaiono in più di un esperimento, con i numeri che
  // servono a tutti: semiasse in UA, periodo in anni, raggio in km.
  const CORPI = {
    Mercury: { nome: 'Mercurio', a: 0.38710, T: 0.24085, e: 0.2056, raggio: 2440,  colore: '#b6a99a' },
    Venus:   { nome: 'Venere',   a: 0.72333, T: 0.61520, e: 0.0068, raggio: 6052,  colore: '#e8cf9a' },
    Earth:   { nome: 'Terra',    a: 1.00000, T: 1.00000, e: 0.0167, raggio: 6371,  colore: '#4c8dff' },
    Mars:    { nome: 'Marte',    a: 1.52371, T: 1.88085, e: 0.0934, raggio: 3390,  colore: '#e0715a' },
    Jupiter: { nome: 'Giove',    a: 5.20288, T: 11.8618, e: 0.0489, raggio: 69911, colore: '#e0a367' },
    Saturn:  { nome: 'Saturno',  a: 9.53667, T: 29.4571, e: 0.0565, raggio: 58232, colore: '#e3d6a3' },
    Uranus:  { nome: 'Urano',    a: 19.1891, T: 84.0205, e: 0.0457, raggio: 25362, colore: '#8fdcf0' },
    Neptune: { nome: 'Nettuno',  a: 30.0699, T: 164.771, e: 0.0113, raggio: 24622, colore: '#6d9bf5' }
  };

  const stato = {
    acceso: false,
    raf: null,
    ultimoTs: 0,
    lab: 'retro',       // quale banco è a schermo
    costruito: false
  };

  // Gli otto banchi. `costruisci` scrive il markup, `collega` attacca i
  // comandi, `entra`/`esce` accendono e spengono, `passo` fa camminare il
  // tempo e `disegna` mette tutto sulla tela. Chi non ha bisogno di una
  // di queste cose semplicemente non la definisce.
  const LABORATORI = [];
  function laboratorio(def) { LABORATORI.push(def); return def; }
  function labAttivo() { return LABORATORI.find(l => l.id === stato.lab) || LABORATORI[0]; }

  // ===================================================================
  // 1. GLI ATTREZZI DEL DISEGNO
  //    Una tela che si adatta allo schermo e non sgrana, uno sfondo di
  //    stelle dipinto una volta sola, e i pochi pennelli che tutti gli
  //    esperimenti si passano: un corpo con l'alone, una scritta che si
  //    legge anche sopra a un'orbita, una freccia con la punta.
  // ===================================================================

  const $ = (id) => document.getElementById(id);

  // -------------------------------------------------------------------
  // La lente — avvicinarsi a un disegno
  //
  // Le tele dei banchi sono piccole e i disegni ci stanno dentro tutti
  // interi: è quello che serve per capire la forma d'insieme, ed è anche
  // il motivo per cui i dettagli non si vedono. Il cappio del moto
  // retrogrado è largo pochi gradi in un riquadro che ne inquadra decine;
  // le due somme di vettori della fionda si accavallano in tre pixel; la
  // finestra di lancio fa incrociare due orbite in un punto grande come la
  // punta di una matita. Da qui la lente: la stessa tela, ingrandita, e ci
  // si sposta dentro col dito.
  //
  // È un ingrandimento di *disegno*, non di scena: si moltiplica la
  // matrice della tela e basta. I banchi continuano a disegnare nelle loro
  // coordinate di sempre — larghe `L`, alte `H` — e nessuno di loro sa che
  // esiste una lente. Le scritte crescono insieme al resto, ed è giusto
  // così: sotto una lente cresce tutto.
  // -------------------------------------------------------------------

  const DID_LENTE_MAX = 8;
  const DID_LENTE_PASSO = 1.45;      // quanto salta un tocco di + o di −
  const DID_TOCCO_ZOOM = 2.4;        // quanto avvicina un doppio clic (o doppio tocco)
  const DID_TOCCO_DOPPIO = 320;      // entro quanti ms due tocchi sono un doppio tocco
  // Tenendo premuto + o − lo zoom cammina da solo: è l'unico modo, su un
  // telefono, di avere il giro continuo della rotella. Parte dopo mezzo
  // istante — se no un tocco normale ne farebbe due — e va a passi piccoli,
  // perché tenuto premuto un secondo deve arrivare in fondo, non oltre.
  const DID_RIPETI_ATTESA = 340;     // ms prima che il tasto cominci a ripetere
  const DID_RIPETI_OGNI = 70;        // ms fra un passo e l'altro
  const DID_RIPETI_PASSO = 1.10;     // quanto vale un passo della ripetizione

  // --- La giostra: girare la scena come nel Sistema Solare in 3D ---------
  //
  // Le scene dei banchi sono piante: il piano delle orbite visto a picco.
  // È l'inquadratura giusta per leggere gli angoli — l'angolo di fase di una
  // finestra di lancio, il cappio del retrogrado — ed è anche quella che
  // nasconde l'unica cosa che una pianta non può dire: che quel piano è un
  // piano. Girandolo di taglio l'ellisse di trasferimento si chiude, le
  // orbite diventano righe, e si capisce di essere dentro a un disco.
  //
  // La rotazione è la stessa della vista 3D, e non per gusto: chi arriva qui
  // dopo aver girato il Sistema Solare col dito si aspetta che il dito
  // faccia la stessa cosa. `az` gira attorno all'asse del piano, `elev` è
  // l'altezza dell'occhio sul piano (90° a picco, 0° dentro al piano), e i
  // versi sono quelli di `solProietta` — il dito porta con sé la scena.
  //
  // Anche questa, come la lente, è una moltiplicazione della matrice della
  // tela: per un punto del piano (z = 0) la proiezione ortogonale della
  // vista 3D *è* una matrice 2×2, e i banchi continuano a non saperne
  // niente. Due cose però devono restare fuori dallo schiacciamento — i
  // dischi dei corpi e le scritte — e infatti ne escono (vedi `didPunto`).
  const DID_GIRO_PER_PIXEL = 0.008;   // radianti di azimut per pixel di dito
  const DID_ELEV_PER_PIXEL = 0.32;    // gradi di elevazione per pixel di dito
  const DID_VISTE = [90, 34, 8];      // a picco, obliqua, di taglio
  const DID_TAU_VISTA = 0.24;         // tempo di dimezzamento dello scivolo, in secondi

  const lenti = new Map();           // id della tela → stato della sua vista

  function didLente(id) {
    let l = lenti.get(id);
    if (!l) {
      l = {
        id, zoom: 1, x: 0, y: 0, L: 0, H: 0,
        az: 0, elev: 90, elevVoluta: 90, puoGirare: false, ultimoTs: 0,
        tela: null, box: null, lettura: null, tastoGiro: null, tastoPieno: null
      };
      lenti.set(id, l);
    }
    return l;
  }

  // La matrice del giro, attorno al centro della tela. Per un punto del
  // piano vale quello che fa `solProietta` con z = 0: si ruota di `az`
  // attorno all'asse verticale e si schiaccia di sin(elev). A 90° torna
  // l'identità, cioè esattamente la pianta di prima.
  function didGiroMatrice(l, L, H) {
    if (!l.puoGirare) return null;
    const a = l.az, e = Math.max(0.5, Math.min(90, l.elev)) * Math.PI / 180;
    const ca = Math.cos(a), sa = Math.sin(a), se = Math.sin(e);
    if (Math.abs(a) < 1e-4 && se > 0.9999) return null;
    // In coordinate di tela la y cresce verso il basso, ed è per questo che
    // la seconda riga ha i segni girati rispetto alla formula in coordinate
    // matematiche: è la stessa algebra di `solProietta`, letta al contrario
    const m = { a: ca, b: -sa * se, c: sa, d: ca * se };
    const cx = L / 2, cy = H / 2;
    m.e = cx - (m.a * cx + m.c * cy);
    m.f = cy - (m.b * cx + m.d * cy);
    return m;
  }

  // Il punto di vista successivo: il primo preset più basso di dove siamo
  // adesso, e arrivati di taglio si ricomincia dall'alto
  function didGiroProssima(l) {
    // Si guarda dove la scena *sta andando*, non dove è arrivata: lo scivolo
    // dura mezzo secondo, e due tocchi svelti sul tasto leggevano tutt'e due
    // l'inclinazione di partenza — si premeva due volte e si tornava sempre
    // allo stesso punto di vista
    const da = l.elevVoluta;
    const giu = DID_VISTE.filter(v => v < da - 1.5);
    return giu.length ? giu[0] : DID_VISTE[0];
  }

  // Lo spostamento non può portare il disegno fuori dal riquadro: il bordo
  // del mondo resta sempre attaccato al bordo della tela. Senza, ci si
  // ritrovava nel nero, e da lì non si capiva più come tornare indietro.
  function didLenteAssesta(l, L, H) {
    if (L) l.L = L;
    if (H) l.H = H;
    l.zoom = Math.max(1, Math.min(DID_LENTE_MAX, l.zoom));
    l.x = Math.max(l.L - l.zoom * l.L, Math.min(0, l.x));
    l.y = Math.max(l.H - l.zoom * l.H, Math.min(0, l.y));
  }

  // Ingrandisce tenendo fermo il punto sotto il dito: è l'unico modo perché
  // la rotella non porti via quello che si stava guardando
  function didLenteIngrandisci(l, fattore, sx, sy) {
    const prima = l.zoom;
    const dopo = Math.max(1, Math.min(DID_LENTE_MAX, prima * fattore));
    if (Math.abs(dopo - prima) < 1e-4) return false;
    const ax = sx === undefined ? l.L / 2 : sx;
    const ay = sy === undefined ? l.H / 2 : sy;
    l.x = ax - (ax - l.x) * (dopo / prima);
    l.y = ay - (ay - l.y) * (dopo / prima);
    l.zoom = dopo;
    didLenteAssesta(l);
    return true;
  }

  function didLenteSposta(l, dx, dy) {
    l.x += dx; l.y += dy;
    didLenteAssesta(l);
  }

  function didLenteAzzera(l) {
    l.zoom = 1; l.x = 0; l.y = 0;
    l.az = 0; l.elev = 90; l.elevVoluta = 90;
    didLenteAssesta(l);
  }

  // -------------------------------------------------------------------
  // Lo schermo intero — la scena da sola, con la sua barra
  //
  // Una scena che si può girare in tre dimensioni chiede spazio: dentro a
  // un riquadro alto quattrocento pixel, il piano dei pianeti messo di
  // taglio è una riga di due millimetri, e il viaggio della Voyager 1 che
  // esce dal piano non si vede proprio. Da qui il ⛶: la scena si prende
  // tutto lo schermo, e il ✕ (o Esc) la rimette dov'era.
  //
  // Con lei viene la **barra del tempo**. È la differenza fra un banco di
  // prova e una figura: a schermo intero uno vuole far camminare il tempo
  // e girare la scena insieme, e se la barra resta fuori bisogna uscire
  // per premere play. La barra non si duplica — si sposta, e alla chiusura
  // torna esattamente da dove era venuta (lo stesso mestiere che fa
  // `skyRicordaPosto` in app.js, con la stessa cura per il fratello che
  // veniva dopo).
  //
  // Il pieno schermo vero non c'è dappertutto — su iPhone l'API non vale
  // per gli elementi — e allora si ripiega su una scena in `position:
  // fixed` appesa al body, con un segnaposto che le tiene il posto. È lo
  // stesso ripiego della mappa dell'ombra e della vista 3D.
  // -------------------------------------------------------------------

  const pieno = {
    id: null, scena: null, segnaposto: null,
    barra: null, barraPosto: null, guscioBarra: null, ripiego: false
  };

  function didPienoAttivo(id) { return !!id && pieno.id === id; }

  // La barra che appartiene a questa scena: si sale di padre in padre finché
  // non se ne trova una, e ci si ferma al banco. Sembra un giro largo e
  // invece è l'unico modo che regge tutti i casi: la fionda ne ha due (il
  // passaggio e il Grand Tour) in due schede diverse, e la scena sa a quale
  // delle due appartiene solo per il fatto di starci dentro.
  function didBarraDiScena(scena) {
    let n = scena.parentElement;
    while (n && n !== document.body) {
      const b = n.querySelector('.did-barra');
      if (b) return b;
      if (n.classList.contains('did-lab')) break;
      n = n.parentElement;
    }
    return null;
  }

  function didPienoAlterna(id) {
    if (didPienoAttivo(id)) didPienoEsci();
    else didPienoEntra(id);
  }

  function didPienoEntra(id) {
    const c = $(id);
    const scena = c && c.closest('.did-scena');
    if (!scena) return;
    if (pieno.id) didPienoEsci();
    pieno.id = id;
    pieno.scena = scena;
    scena.classList.add('did-scena-piena');
    document.body.classList.add('did-immersivo');

    const barra = didBarraDiScena(scena);
    if (barra) {
      pieno.barra = barra;
      pieno.barraPosto = document.createComment('barra-didattica');
      barra.parentNode.insertBefore(pieno.barraPosto, barra);
      const guscio = document.createElement('div');
      guscio.className = 'did-pieno-barra';
      guscio.appendChild(barra);
      scena.appendChild(guscio);
      pieno.guscioBarra = guscio;
    }

    // L'altezza fissa che `didTela` aveva messo alla tela va tolta: qui
    // l'altezza la detta il riquadro, e una tela alta 430px in mezzo a uno
    // schermo intero è la cosa più triste che ci sia
    if (c.style.height) c.style.height = '';

    const chiedi = scena.requestFullscreen || scena.webkitRequestFullscreen;
    if (chiedi) {
      try {
        const esito = chiedi.call(scena);
        if (esito && typeof esito.catch === 'function') esito.catch(() => didPienoRipiego());
      } catch (e) { didPienoRipiego(); }
    } else {
      didPienoRipiego();
    }
    didLenteMostra(didLente(id));
  }

  function didPienoRipiego() {
    if (!pieno.scena || pieno.ripiego) return;
    pieno.ripiego = true;
    pieno.segnaposto = document.createComment('scena-didattica');
    pieno.scena.parentNode.insertBefore(pieno.segnaposto, pieno.scena);
    document.body.appendChild(pieno.scena);
    pieno.scena.classList.add('did-pieno-ripiego');
  }

  function didPienoEsci() {
    if (!pieno.id) return;
    const id = pieno.id, scena = pieno.scena;
    pieno.id = null;
    document.body.classList.remove('did-immersivo');

    if (pieno.barra && pieno.barraPosto && pieno.barraPosto.parentNode) {
      pieno.barraPosto.parentNode.replaceChild(pieno.barra, pieno.barraPosto);
    }
    if (pieno.guscioBarra && pieno.guscioBarra.parentNode) pieno.guscioBarra.remove();
    pieno.barra = null; pieno.barraPosto = null; pieno.guscioBarra = null;

    if (scena) {
      scena.classList.remove('did-scena-piena', 'did-pieno-ripiego');
      if (pieno.segnaposto && pieno.segnaposto.parentNode) {
        pieno.segnaposto.parentNode.replaceChild(scena, pieno.segnaposto);
      }
    }
    pieno.segnaposto = null;
    pieno.ripiego = false;
    pieno.scena = null;

    const attivo = document.fullscreenElement || document.webkitFullscreenElement;
    const esci = document.exitFullscreen || document.webkitExitFullscreen;
    if (attivo && esci) {
      try {
        const esito = esci.call(document);
        if (esito && typeof esito.catch === 'function') esito.catch(() => {});
      } catch (e) { /* era già uscito per conto suo */ }
    }
    didLenteMostra(didLente(id));
  }

  // Esc, il tasto ⛶ della barra del browser, o un cambio di scheda: il
  // pieno schermo può finire senza passare dal nostro tasto, e allora la
  // barra resterebbe murata dentro a una scena che non è più piena.
  document.addEventListener('fullscreenchange', didPienoControlla);
  document.addEventListener('webkitfullscreenchange', didPienoControlla);
  function didPienoControlla() {
    if (!pieno.id || pieno.ripiego) return;
    const attivo = document.fullscreenElement || document.webkitFullscreenElement;
    if (attivo !== pieno.scena) didPienoEsci();
  }
  // Nel ripiego Esc non lo gestisce nessuno: qui la via d'uscita la diamo noi
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pieno.id && pieno.ripiego) { e.preventDefault(); didPienoEsci(); }
  });

  // --- Che cosa sta disegnando la tela adesso ---------------------------
  //
  // La matrice composta (giro + lente, senza il `dpr`) e l'ingrandimento,
  // riscritti da `didTela` a ogni fotogramma. Servono ai due pennelli che
  // dalla matrice devono *uscire*: un pianeta schiacciato di taglio non
  // sarebbe più un pianeta, e una scritta inclinata di sessanta gradi non
  // si legge. Tutt'e due si proiettano il loro punto e poi disegnano in
  // coordinate di schermo, esattamente come fanno i nomi della vista 3D.
  //
  // Basta una variabile sola perché disegna una tela per volta: `didTela`
  // apre il fotogramma di quella tela, e tutto quello che segue è suo.
  let vista = null;

  function didPunto(x, y) {
    if (!vista) return { x, y };
    return { x: vista.a * x + vista.c * y + vista.e, y: vista.b * x + vista.d * y + vista.f };
  }

  // --- Uscire dal piano -------------------------------------------------
  //
  // Le scene dei banchi sono piante, e per quasi tutto va benissimo: le
  // orbite dei pianeti stanno in un piano, e le inclinazioni vere sono
  // gradi che non si vedrebbero. Un viaggio però dal piano esce davvero, e
  // di parecchio: dopo Saturno la Voyager 1 è stata scagliata trentacinque
  // gradi sopra il piano dei pianeti, la 2 quarantotto sotto dopo Nettuno.
  // Disegnate a picco, quelle due sonde sembrano andarsene di lato come
  // tutte le altre — e il pezzo più bello del Grand Tour sparisce.
  //
  // `didQuota(h)` dice di quanto va spostato un punto **in coordinate di
  // tela** perché venga disegnato `h` sopra al piano. Si somma alle
  // coordinate di prima e poi si disegna come sempre: la matrice della
  // scena ci pensa lei. Guardando a picco (elev 90°) l'offset è zero, ed è
  // giusto — da sopra, un aereo in volo e la sua ombra sono lo stesso
  // punto. Girando la scena il punto si stacca, e più la si mette di taglio
  // più si stacca, fino a valere `h` pixel pieni.
  function didQuota(h) {
    if (!vista || !vista.gira || !h) return { x: 0, y: 0 };
    const e = Math.max(0.5, Math.min(90, vista.elev)) * Math.PI / 180;
    const k = h * Math.cos(e) / Math.sin(e);
    return { x: Math.sin(vista.az) * k, y: -Math.cos(vista.az) * k };
  }

  // Lo stesso, già sommato: da un punto del piano e una quota, il punto di
  // tela da passare ai pennelli di sempre
  function didAlza(x, y, h) {
    const q = didQuota(h);
    return { x: x + q.x, y: y + q.y };
  }

  // Rimette la matrice nuda del riquadro: niente giro, niente lente, solo
  // il `dpr`. Va sempre fra un `ctx.save()` e un `ctx.restore()`.
  function didSchermo(ctx) {
    const dpr = vista ? vista.dpr : Math.min(2.5, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Da un punto della tela al punto del disegno. Serve a chi sulla tela ci
  // trascina qualcosa — il parametro d'impatto della fionda — che se no,
  // con la lente accesa, misurerebbe pixel di schermo su un disegno che
  // schermo non è più.
  function didLenteMondo(id, x, y) {
    const l = lenti.get(id);
    if (!l) return { x, y };
    // Prima si toglie la lente, poi il giro: l'ordine è quello di `didTela`
    // letto al contrario
    const px = (x - l.x) / l.zoom, py = (y - l.y) / l.zoom;
    const m = didGiroMatrice(l, l.L, l.H);
    // Il determinante della matrice del giro è sin(elev): messa quasi di
    // taglio, tornare indietro vorrebbe dire moltiplicare per venti, e un
    // millimetro di dito diventerebbe mezza scena. Lì si fa finta di niente.
    const det = m ? m.a * m.d - m.b * m.c : 0;
    if (!m || Math.abs(det) < 0.05) return { x: px, y: py };
    const ux = px - m.e, uy = py - m.f;
    return { x: (m.d * ux - m.c * uy) / det, y: (-m.b * ux + m.a * uy) / det };
  }

  function didLenteMostra(l) {
    const girata = l.puoGirare && (l.elev < 89.5 || Math.abs(l.az) > 0.005);
    const intero = didPienoAttivo(l.id);
    const accesa = l.zoom > 1.001 || girata || intero;
    if (l.tastoPieno) {
      // Lo stesso tasto fa le due cose, e da pieno dice ✕ come ogni via
      // d'uscita dell'app: due tasti distinti, di cui uno sempre spento,
      // sarebbero solo un tasto in più nell'angolo di un disegno
      l.tastoPieno.textContent = intero ? '✕' : '⛶';
      l.tastoPieno.title = intero ? 'Esci dallo schermo intero (anche con Esc)'
        : 'Guarda la scena a schermo intero, con la sua barra del tempo';
      l.tastoPieno.setAttribute('aria-label', l.tastoPieno.title);
      l.tastoPieno.setAttribute('aria-pressed', intero ? 'true' : 'false');
      l.tastoPieno.classList.toggle('did-lente-esci', intero);
    }
    if (l.box) {
      l.box.classList.toggle('did-lente-accesa', accesa);
      l.box.classList.toggle('did-lente-gira', !!l.puoGirare);
      if (l.lettura) l.lettura.textContent = l.zoom.toFixed(1).replace('.', ',') + '×';
      // Il tasto del punto di vista dice l'inclinazione di adesso: è la sua
      // etichetta e insieme il suo modo di spiegarsi, perché un numero di
      // gradi che cambia mentre si trascina si capisce da sé
      if (l.tastoGiro) l.tastoGiro.textContent = Math.round(l.elev) + '°';
    }
    // Finché la vista è ferma la pagina scorre anche col dito appoggiato
    // sulla tela (`pan-y`, dal foglio di stile); appena si è ingrandito o
    // girato, quel dito serve al disegno e lo scorrimento della pagina si fa
    // a lato. È una scelta che si disfa da sé: basta il ⟲.
    if (l.tela && !l.tela.dataset.lenteFerma) l.tela.style.touchAction = accesa ? 'none' : '';
    if (l.tela) l.tela.classList.toggle('did-tela-accesa', accesa);
  }

  // I comandi se li appende la lente da sé al riquadro della scena: i banchi
  // scrivono solo il loro <canvas>, e il markup non va toccato
  function didLenteComandi(c, l, opz) {
    const scena = c.closest('.did-scena');
    if (!scena) return;
    const box = document.createElement('div');
    box.className = 'did-lente';
    box.innerHTML =
      (opz && opz.pieno
        ? '<button type="button" class="did-lente-tasto did-lente-pieno" data-lente="pieno" ' +
            'title="Guarda la scena a schermo intero, con la sua barra del tempo" ' +
            'aria-label="Schermo intero" aria-pressed="false">⛶</button>'
        : '') +
      '<button type="button" class="did-lente-tasto did-lente-giro" data-lente="gira" ' +
        'title="Gira la scena: a picco sul piano, obliqua, di taglio. Si trascina anche col dito, come il Sistema Solare in 3D." ' +
        'aria-label="Cambia il punto di vista sul piano">90°</button>' +
      '<span class="did-lente-fattore">1,0×</span>' +
      // Il ⟲ sta **prima** del − e del +, e non in fondo com'era. In fondo
      // spuntava esattamente sotto al dito che aveva appena toccato il +:
      // a riposo si vede il solo +, appena si ingrandisce compaiono gli
      // altri tre, la fila cresce verso sinistra e l'ultimo posto — quello
      // che il dito stava già mirando — passava all'azzera. Si toccava due
      // volte «avvicinati» e ci si ritrovava al punto di partenza. Con
      // questo ordine il + resta l'ultimo in tutti e due i casi, cioè non
      // si muove mai.
      '<button type="button" class="did-lente-tasto did-lente-azzera" data-lente="azzera" title="Rimetti la scena a picco, alla misura intera" aria-label="Rimetti la scena com\'era">⟲</button>' +
      '<button type="button" class="did-lente-tasto" data-lente="meno" title="Allontanati (tienilo premuto per andare via piano)" aria-label="Allontanati">−</button>' +
      '<button type="button" class="did-lente-tasto" data-lente="piu" title="Avvicinati al disegno: tienilo premuto per avvicinarti piano, oppure usa la rotella, due dita, o due tocchi" aria-label="Avvicinati">+</button>';
    scena.appendChild(box);

    // Tenere premuto + o − avvicina di continuo. Su un telefono la rotella
    // non c'è e il pizzico chiede due dita libere — che con una mano sola,
    // reggendo il telefono, sono una pretesa: questo è il comando che fa la
    // stessa cosa con un dito solo, e per giunta più preciso di un pizzico.
    let ripete = null, haRipetuto = false;
    const fermaRipetizione = () => {
      if (ripete) { clearTimeout(ripete.avvio); clearInterval(ripete.giro); ripete = null; }
    };
    box.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-lente="piu"], [data-lente="meno"]');
      if (!b) return;
      fermaRipetizione();
      haRipetuto = false;
      const su = b.dataset.lente === 'piu';
      ripete = {
        avvio: setTimeout(() => {
          ripete.giro = setInterval(() => {
            haRipetuto = true;
            if (!didLenteIngrandisci(l, su ? DID_RIPETI_PASSO : 1 / DID_RIPETI_PASSO)) fermaRipetizione();
            didLenteMostra(l);
          }, DID_RIPETI_OGNI);
        }, DID_RIPETI_ATTESA),
        giro: null
      };
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* niente */ }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
      box.addEventListener(ev, fermaRipetizione));

    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lente]');
      if (!b) return;
      // Il clic arriva anche in fondo a una pressione lunga: lì lo zoom l'ha
      // già fatto la ripetizione, e un salto in più sarebbe un sussulto
      if (haRipetuto && (b.dataset.lente === 'piu' || b.dataset.lente === 'meno')) {
        haRipetuto = false;
        return;
      }
      if (b.dataset.lente === 'pieno') didPienoAlterna(l.id);
      else if (b.dataset.lente === 'azzera') didLenteAzzera(l);
      else if (b.dataset.lente === 'gira') l.elevVoluta = didGiroProssima(l);
      else didLenteIngrandisci(l, b.dataset.lente === 'piu' ? DID_LENTE_PASSO : 1 / DID_LENTE_PASSO);
      didLenteMostra(l);
    });
    l.box = box;
    l.lettura = box.querySelector('.did-lente-fattore');
    l.tastoGiro = box.querySelector('.did-lente-giro');
    l.tastoPieno = box.querySelector('.did-lente-pieno');
  }

  function didLenteAttacca(c, id, opz) {
    if (c.dataset.lente === 'si') return;
    c.dataset.lente = 'si';
    const l = didLente(id);
    l.tela = c;
    // Le tele che hanno già un gesto loro (la fionda: si trascina per
    // spostare il punto di passaggio) tengono quello, e la lente si muove
    // coi tasti e col pizzico. Due significati per lo stesso dito sarebbero
    // un indovinello.
    const trascina = !(opz && opz.trascina === false);
    if (!trascina) c.dataset.lenteFerma = 'si';
    didLenteComandi(c, l, opz);
    didLenteMostra(l);

    const dove = (e) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    // La rotella avvicina e allontana, senza chiedere permesso a nessun
    // tasto: sopra a un disegno che si può ingrandire, girare la rotella
    // vuol dire quello e basta, ed è quello che si prova per primo.
    //
    // Il rischio noto è la trappola dello scorrimento — si scorre
    // l'articolo, il puntatore passa sopra a una tela e ci si ritrova
    // dentro a un disegno senza aver chiesto niente. Il freno non è più un
    // tasto da tenere premuto ma il **capolinea**: quando la lente è già
    // alla misura intera e si continua ad allontanare, la rotella torna
    // alla pagina, che riprende a scorrere da dove era. Così una tela ferma
    // — cioè come la si trova arrivando — non trattiene niente, e una
    // ingrandita è chiaramente sua.
    c.addEventListener('wheel', (e) => {
      const pixel = e.deltaMode === 1 ? e.deltaY * 16 : (e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY);
      const scatti = Math.max(-4, Math.min(4, pixel / 100));
      if (!scatti) return;
      const fattore = Math.exp(-scatti * 0.2);
      const alCapolinea = fattore < 1
        ? l.zoom <= 1 + 1e-4
        : l.zoom >= DID_LENTE_MAX - 1e-4;
      // Con Ctrl la rotella resta comunque nostra: è il gesto di chi vuole
      // ingrandire *questo* e non ha voglia di ragionare su dove sta
      if (alCapolinea && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const p = dove(e);
      if (didLenteIngrandisci(l, fattore, p.x, p.y)) didLenteMostra(l);
    }, { passive: false });

    // Le regole del dito sono quelle della vista 3D, alla lettera, perché è
    // lo stesso gesto e chi arriva qui l'ha già imparato lì: **un dito gira**
    // la scena (e il dito porta con sé la scena, non l'occhio), **due dita**
    // avvicinano *e* spostano, col mouse si sposta tenendo Maiusc o col tasto
    // destro. Dove la scena non si può girare — un grafico, una carta del
    // cielo — un dito solo torna a spostare il disegno ingrandito, che lì è
    // l'unica cosa sensata da fargli fare.
    //
    // Come nella vista 3D, a ogni dito che si appoggia o si stacca i
    // riferimenti si rifanno: se no il dito rimasto verrebbe misurato da dove
    // si era appoggiato *prima* del pizzico, e la scena scatterebbe di lato.
    const dita = new Map();
    let pizzico = null, ultimo = null, modoPan = false;
    const insieme = () => [...dita.values()];
    const riancora = () => {
      const p = insieme();
      ultimo = p.length === 1 ? { x: p[0].x, y: p[0].y } : null;
      pizzico = p.length >= 2
        ? { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }
        : null;
    };

    c.addEventListener('pointerdown', (e) => {
      dita.set(e.pointerId, dove(e));
      if (dita.size === 1) modoPan = !!e.shiftKey || e.button === 1 || e.button === 2;
      riancora();
      if (dita.size >= 2 || (trascina && (l.puoGirare || l.zoom > 1.001))) {
        try { c.setPointerCapture(e.pointerId); } catch (err) { /* niente */ }
      }
    });

    // Col tasto destro si sposta: il menù contestuale, qui, sarebbe solo il
    // modo di interrompere il gesto a metà
    c.addEventListener('contextmenu', (e) => { if (trascina) e.preventDefault(); });

    c.addEventListener('pointermove', (e) => {
      if (!dita.has(e.pointerId)) return;
      dita.set(e.pointerId, dove(e));
      const p = insieme();
      if (p.length >= 2 && pizzico) {
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        const mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
        if (pizzico.d > 6) didLenteIngrandisci(l, d / pizzico.d, mx, my);
        didLenteSposta(l, mx - pizzico.x, my - pizzico.y);
        pizzico = { d, x: mx, y: my };
        didLenteMostra(l);
        return;
      }
      if (!ultimo) return;
      const q = dove(e);
      const dx = q.x - ultimo.x, dy = q.y - ultimo.y;
      ultimo = q;
      // Maiusc, o tasto destro: si sposta. Su una tela che non si gira è
      // sempre così, e serve solo quando c'è qualcosa fuori dal riquadro.
      if (modoPan || !l.puoGirare) {
        if (!trascina || l.zoom <= 1.001) return;
        didLenteSposta(l, dx, dy);
        didLenteMostra(l);
        return;
      }
      if (!trascina) return;
      l.az += dx * DID_GIRO_PER_PIXEL;
      l.elevVoluta = Math.max(2, Math.min(90, l.elevVoluta + dy * DID_ELEV_PER_PIXEL));
      l.elev = l.elevVoluta;
      didLenteMostra(l);
    });

    // Dove si è appoggiato il dito e quanto si è mosso: serve al doppio
    // tocco, che deve distinguere due colpetti secchi da due trascinamenti
    const partenze = new Map();
    c.addEventListener('pointerdown', (e) => partenze.set(e.pointerId, { ...dove(e), t: performance.now() }));

    const stacca = (e) => {
      partenze.delete(e.pointerId);
      if (!dita.delete(e.pointerId)) return;
      riancora();
      if (!dita.size) modoPan = false;
    };
    c.addEventListener('pointercancel', stacca);
    c.addEventListener('pointerleave', stacca);

    // Doppio clic e doppio tocco: avvicinano dov'è il dito, e la seconda
    // volta rimettono tutto com'era — misura intera e scena a picco. È la
    // scorciatoia di chi ha il mouse e la via d'uscita di chi si è perso
    // girando.
    let doppioFatto = 0;      // quando l'ha fatto il nostro contatore di tocchi
    const raddoppia = (x, y) => {
      doppioFatto = performance.now();
      const girata = l.puoGirare && (l.elev < 89.5 || Math.abs(l.az) > 0.005);
      if (l.zoom > 1.001 || girata) didLenteAzzera(l);
      else didLenteIngrandisci(l, DID_TOCCO_ZOOM, x, y);
      didLenteMostra(l);
    };

    c.addEventListener('dblclick', (e) => {
      e.preventDefault();
      // Chrome, dopo due tocchi svelti, manda **anche** un `dblclick` — e i
      // due si annullavano a vicenda: il nostro contatore avvicinava, il suo
      // `dblclick` trovava la lente accesa e rimetteva tutto com'era. Da
      // fuori sembrava che il doppio tocco non funzionasse; in realtà ne
      // funzionavano due.
      if (performance.now() - doppioFatto < 700) return;
      const p = dove(e);
      raddoppia(p.x, p.y);
    });

    // Il doppio tocco lo contiamo noi e non lo lasciamo a `dblclick`: c'è chi
    // lo manda (Chrome), chi lo tiene per sé come zoom della pagina e chi lo
    // consegna mezzo secondo dopo, e mezzo secondo su un gesto è un'eternità.
    // Due colpetti fermi e vicini: se in mezzo il dito ha camminato era un
    // trascinamento, e la scena l'ha già girata.
    let scorso = { t: 0, x: 0, y: 0 };
    c.addEventListener('pointerup', (e) => {
      const giu = partenze.get(e.pointerId);
      const dita2 = dita.size;
      stacca(e);
      // Il doppio tocco vale solo per il dito, solo da solo, e non dove il
      // dito ha già un mestiere suo (il punto di passaggio della fionda, la
      // telecamera del banco delle aurore): lì due colpetti capitano di
      // continuo, e azzerare la vista per sbaglio è la cosa più fastidiosa
      // che possa fare un disegno
      if (e.pointerType === 'mouse' || !trascina || !giu || dita2 !== 1) return;
      const q = dove(e);
      const ora = performance.now();
      const fermo = Math.hypot(q.x - giu.x, q.y - giu.y) < 12 && ora - giu.t < 500;
      if (!fermo) { scorso = { t: 0, x: 0, y: 0 }; return; }
      if (ora - scorso.t < DID_TOCCO_DOPPIO && Math.hypot(q.x - scorso.x, q.y - scorso.y) < 34) {
        e.preventDefault();
        raddoppia(q.x, q.y);
        scorso = { t: 0, x: 0, y: 0 };
        return;
      }
      scorso = { t: ora, x: q.x, y: q.y };
    });
  }

  // Le tele sono larghe quanto il loro riquadro e alte in proporzione, e
  // ogni volta che cambiano misura si ridisegnano da sé: girare il
  // telefono o allargare la finestra non richiede nessun gancio esterno,
  // perché la misura si rilegge a ogni fotogramma (è una lettura di
  // `clientWidth`, non costa niente) e il buffer si rifà solo quando
  // serve davvero. Il fattore `dpr` è quello che tiene le linee nitide
  // sugli schermi fitti: senza, un cerchio di stelle sembra disegnato col
  // pennarello.
  function didTela(id, proporzione, altezzaMax, opz) {
    const c = $(id);
    if (!c || !c.isConnected) return null;
    const largo = Math.round(c.clientWidth || 0);
    if (largo < 40) return null;
    // A schermo intero la proporzione non comanda più: la tela prende
    // l'altezza che le lascia il riquadro (il foglio di stile la fa crescere
    // e la barra le sta sotto), e qui la si legge invece di calcolarla
    const intero = didPienoAttivo(id);
    let alto = intero ? Math.round(c.clientHeight || 0) : 0;
    if (alto < 40) {
      alto = Math.round(largo / proporzione);
      if (altezzaMax) alto = Math.min(alto, altezzaMax);
    }
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const wPx = Math.round(largo * dpr), hPx = Math.round(alto * dpr);
    if (c.width !== wPx || c.height !== hPx) { c.width = wPx; c.height = hPx; }
    if (!intero && c.style.height !== alto + 'px') c.style.height = alto + 'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vista = { dpr, zoom: 1, a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, gira: false, az: 0, elev: 90 };
    // Le tele che hanno la lente la agganciano qui, al primo fotogramma in
    // cui esistono davvero: prima di allora il riquadro è nascosto, largo
    // zero, e non c'è niente a cui appendere i comandi.
    if (opz && opz.lente) {
      didLenteAttacca(c, id, opz);
      const l = didLente(id);
      // Se la scena si può girare lo decide il banco, e può cambiare da un
      // fotogramma all'altro: il quadro dell'armonia di Keplero è un grafico
      // a barre, e un grafico a barre girato di taglio non è più niente
      const gira = !!(opz.gira);
      if (l.puoGirare !== gira) { l.puoGirare = gira; didLenteMostra(l); }
      didLenteAssesta(l, largo, alto);
      didGiroScivola(l);
      // Prima il giro (attorno al centro della tela), poi la lente: così lo
      // spostamento della lente lavora sull'immagine già girata, che è
      // quello che si aspetta il dito
      const m = didGiroMatrice(l, largo, alto);
      const z = l.zoom;
      const occhio = { gira, az: l.az, elev: l.elev };
      if (m) {
        vista = { dpr, zoom: z, a: z * m.a, b: z * m.b, c: z * m.c, d: z * m.d, e: z * m.e + l.x, f: z * m.f + l.y, ...occhio };
      } else if (z !== 1 || l.x || l.y) {
        vista = { dpr, zoom: z, a: z, b: 0, c: 0, d: z, e: l.x, f: l.y, ...occhio };
      } else {
        Object.assign(vista, occhio);
      }
      ctx.setTransform(dpr * vista.a, dpr * vista.b, dpr * vista.c, dpr * vista.d,
        dpr * vista.e, dpr * vista.f);
    }
    return { c, ctx, L: largo, H: alto };
  }

  // L'inclinazione ci scivola invece di saltarci: vedere il piano che si
  // chiude è metà della spiegazione, e saltarci sopra la butterebbe via. È
  // lo stesso smorzamento esponenziale col `dt` del fotogramma che usa la
  // vista 3D, quindi si comporta uguale a qualunque cadenza.
  function didGiroScivola(l) {
    const ora = performance.now();
    const dt = l.ultimoTs ? Math.min(0.1, (ora - l.ultimoTs) / 1000) : 0;
    l.ultimoTs = ora;
    if (!dt || Math.abs(l.elevVoluta - l.elev) < 0.05) { l.elev = l.elevVoluta; return; }
    l.elev += (l.elevVoluta - l.elev) * (1 - Math.pow(0.5, dt / DID_TAU_VISTA));
    didLenteMostra(l);
  }

  // Lo sfondo stellato: un pulviscolo fermo, sempre lo stesso, dipinto su
  // una tela fuori schermo e ricopiato. Rifarlo a ogni fotogramma vorrebbe
  // dire duecento archi al sessantesimo di secondo per uno sfondo che non
  // si muove — ed è esattamente la cosa che il planetario non fa mai.
  const cacheStelle = { chiave: '', tela: null };
  function didSfondo(ctx, L, H) {
    const chiave = L + 'x' + H;
    if (cacheStelle.chiave !== chiave) {
      const t = document.createElement('canvas');
      t.width = L; t.height = H;
      const g = t.getContext('2d');
      const sfumatura = g.createLinearGradient(0, 0, L * 0.6, H);
      sfumatura.addColorStop(0, '#080d1c');
      sfumatura.addColorStop(0.55, C.fondo);
      sfumatura.addColorStop(1, '#03050b');
      g.fillStyle = sfumatura;
      g.fillRect(0, 0, L, H);
      // Una velatura di nebulosa, appena percettibile: due macchie fredde
      // che rompono il nero piatto senza farsi notare
      const nb = g.createRadialGradient(L * 0.18, H * 0.12, 0, L * 0.18, H * 0.12, L * 0.6);
      nb.addColorStop(0, 'rgba(76, 141, 255, 0.10)');
      nb.addColorStop(1, 'rgba(76, 141, 255, 0)');
      g.fillStyle = nb; g.fillRect(0, 0, L, H);
      const nb2 = g.createRadialGradient(L * 0.86, H * 0.92, 0, L * 0.86, H * 0.92, L * 0.5);
      nb2.addColorStop(0, 'rgba(139, 92, 246, 0.09)');
      nb2.addColorStop(1, 'rgba(139, 92, 246, 0)');
      g.fillStyle = nb2; g.fillRect(0, 0, L, H);
      // Il pulviscolo. Il generatore è pseudo-casuale ma deterministico:
      // ridimensionando la finestra le stelle non ballano.
      let seme = 20260804;
      const caso = () => { seme = (seme * 1664525 + 1013904223) % 4294967296; return seme / 4294967296; };
      const quante = Math.round(L * H / 2600);
      for (let i = 0; i < quante; i++) {
        const x = caso() * L, y = caso() * H;
        const r = 0.35 + caso() * caso() * 1.25;
        const lum = 0.20 + caso() * 0.55;
        g.fillStyle = `rgba(210, 224, 255, ${lum.toFixed(3)})`;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      cacheStelle.chiave = chiave;
      cacheStelle.tela = t;
    }
    // Lo sfondo resta fuori dalla lente: è il cielo lontano, e ingrandirlo
    // vorrebbe dire solo sgranarlo. Si stende alla misura del riquadro —
    // che la lente non cambia — e il disegno ingrandito ci va sopra.
    ctx.save();
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(cacheStelle.tela, 0, 0, L, H);
    ctx.restore();
  }

  // Un corpo celeste: il disco, il bordo appena più chiaro dalla parte
  // della luce, e l'alone che lo fa sembrare acceso invece che incollato.
  function didCorpo(ctx, x, y, r, colore, opz = {}) {
    // Il disco non si schiaccia quando si gira la scena: un pianeta visto di
    // taglio resta un pianeta, e sono le *orbite* che devono diventare
    // ellissi, non i corpi. Si proietta il centro e si disegna tondo in
    // coordinate di schermo — come i pallini della vista 3D, che infatti
    // restano tondi anche col Sistema Solare messo di profilo.
    const p = didPunto(x, y);
    ctx.save();
    didSchermo(ctx);
    didCorpoSchermo(ctx, p.x, p.y, r * (vista ? vista.zoom : 1), colore, opz);
    ctx.restore();
  }

  function didCorpoSchermo(ctx, x, y, r, colore, opz = {}) {
    const alone = opz.alone === undefined ? 2.6 : opz.alone;
    if (alone > 0) {
      const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * alone);
      g.addColorStop(0, didVela(colore, 0.34));
      g.addColorStop(1, didVela(colore, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * alone, 0, Math.PI * 2); ctx.fill();
    }
    const disco = ctx.createRadialGradient(x - r * 0.34, y - r * 0.34, r * 0.1, x, y, r);
    disco.addColorStop(0, didSchiarisci(colore, 0.42));
    disco.addColorStop(1, colore);
    ctx.fillStyle = disco;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (opz.anelli) {
      ctx.strokeStyle = didVela(colore, 0.75);
      ctx.lineWidth = Math.max(1, r * 0.22);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 2.05, r * 0.62, -0.35, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Una scritta che resta leggibile anche se le passa sotto un'orbita:
  // il contorno scuro costa un `strokeText` e risparmia un riquadro.
  function didScritta(ctx, testo, x, y, opz = {}) {
    // Come i dischi, le scritte escono dal giro: dentro alla matrice, con la
    // scena di taglio, «Terra» diventerebbe una riga alta due pixel e
    // inclinata. Il posto lo dà la proiezione, il resto è schermo. La lente
    // invece se la tengono — sotto una lente cresce tutto, scritte comprese.
    //
    // Due opzioni, e nascono tutt'e due dallo stesso inciampo. `schermo`
    // salta la proiezione: le scritte appoggiate a un angolo della tela —
    // l'anno, la riga delle velocità — sono etichette del riquadro, non
    // cose che stanno nella scena, e girando la scena andavano a spasso.
    // `dx`/`dy` sono uno scostamento **dopo** la proiezione: scansare una
    // scritta di dodici pixel sopra al suo pallino, dentro alla matrice,
    // con la scena quasi di taglio diventa uno scostamento di due — e due
    // etichette che dovevano stare una sopra l'altra si stampavano una
    // sull'altra.
    // Un'etichetta del riquadro non cresce con la lente: è scritta sul
    // vetro, non sul disegno
    const k = opz.schermo ? 1 : (vista ? vista.zoom : 1);
    const p = opz.schermo ? { x, y } : didPunto(x, y);
    if (opz.dx) p.x += opz.dx * k;
    if (opz.dy) p.y += opz.dy * k;
    ctx.save();
    didSchermo(ctx);
    ctx.font = `${opz.peso || 600} ${(opz.misura || 11) * k}px ${opz.mono ? 'ui-monospace, SFMono-Regular, monospace' : 'system-ui, -apple-system, sans-serif'}`;
    ctx.textAlign = opz.allinea || 'left';
    ctx.textBaseline = opz.base || 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.2 * k;
    ctx.strokeStyle = 'rgba(3, 6, 14, 0.88)';
    ctx.strokeText(testo, p.x, p.y);
    ctx.fillStyle = opz.colore || C.testo;
    ctx.fillText(testo, p.x, p.y);
    ctx.restore();
  }

  function didFreccia(ctx, x1, y1, x2, y2, opz = {}) {
    const colore = opz.colore || C.testo2;
    const sp = opz.spessore || 1.6;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    const ux = dx / len, uy = dy / len;
    const punta = Math.min(opz.punta || 9, len * 0.5);
    ctx.strokeStyle = colore;
    ctx.lineWidth = sp;
    ctx.lineCap = 'round';
    if (opz.tratteggio) ctx.setLineDash(opz.tratteggio);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - ux * punta * 0.6, y2 - uy * punta * 0.6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colore;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * punta - uy * punta * 0.42, y2 - uy * punta + ux * punta * 0.42);
    ctx.lineTo(x2 - ux * punta + uy * punta * 0.42, y2 - uy * punta - ux * punta * 0.42);
    ctx.closePath(); ctx.fill();
  }

  function didPercorso(ctx, punti, opz = {}) {
    if (!punti || punti.length < 2) return;
    ctx.strokeStyle = opz.colore || C.blu;
    ctx.lineWidth = opz.spessore || 1.8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (opz.tratteggio) ctx.setLineDash(opz.tratteggio);
    ctx.beginPath();
    ctx.moveTo(punti[0].x, punti[0].y);
    for (let i = 1; i < punti.length; i++) ctx.lineTo(punti[i].x, punti[i].y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function didCerchio(ctx, cx, cy, r, colore, spessore, tratteggio) {
    ctx.strokeStyle = colore;
    ctx.lineWidth = spessore || 1;
    if (tratteggio) ctx.setLineDash(tratteggio);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Da "#rrggbb" a "rgba(r,g,b,a)": serve agli aloni, che sono lo stesso
  // colore del corpo ma sfumato via
  function didVela(hex, alfa) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
  }
  function didSchiarisci(hex, quanto) {
    const n = parseInt(hex.slice(1), 16);
    const m = (v) => Math.round(v + (255 - v) * quanto);
    return `rgb(${m((n >> 16) & 255)}, ${m((n >> 8) & 255)}, ${m(n & 255)})`;
  }

  // I segni dei comandi. Non sono emoji (l'app non ne usa) e non stanno
  // in DISEGNI perché servono solo qui: sono i quattro tasti di un
  // registratore, disegnati con lo stesso tratto delle icone dell'app.
  const SEGNI = {
    play:   '<path d="M8 5.4 18.4 12 8 18.6z" fill="currentColor" stroke="none"/>',
    pausa:  '<path d="M9 5.6v12.8M15 5.6v12.8" stroke-width="2.4"/>',
    inizio: '<path d="M7 5.6v12.8"/><path d="M18.4 5.6 9.2 12l9.2 6.4z" fill="currentColor" stroke="none"/>',
    meno:   '<path d="M5.6 12h12.8"/>',
    piu:    '<path d="M12 5.6v12.8M5.6 12h12.8"/>',
    avanti: '<path d="M6 5.6 15 12l-9 6.4z" fill="currentColor" stroke="none"/><path d="M17.6 5.6v12.8"/>'
  };
  function segno(nome, misura = 18) {
    return `<svg class="icona-disegnata" width="${misura}" height="${misura}" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SEGNI[nome] || ''}</svg>`;
  }

  // La barra di trasporto: è la stessa per tutti gli esperimenti che
  // hanno un tempo che cammina, e questo è il punto — imparato una volta,
  // funziona su tutti e otto i banchi.
  function didBarra(p, opz = {}) {
    const velocita = (opz.velocita || [0.5, 1, 3, 8]).map((v, i) =>
      `<button type="button" class="tasto-segmento${i === (opz.velIndice || 1) ? ' attiva' : ''}" data-vel="${v}">${v}×</button>`).join('');
    return `
      <div class="did-barra">
        <button id="${p}-inizio" type="button" class="did-tondo" title="Torna all'inizio" aria-label="Torna all'inizio">${segno('inizio')}</button>
        <button id="${p}-play" type="button" class="did-tondo did-play" title="Avvia o ferma l'animazione" aria-pressed="false" aria-label="Avvia">${segno('play')}</button>
        <input id="${p}-slitta" class="did-slitta" type="range" min="${opz.min || 0}" max="${opz.max || 1000}" step="${opz.passo || 1}" value="${opz.valore || 0}"
          aria-label="${opz.etichettaSlitta || 'Scorri il tempo'}">
        <span id="${p}-lettura" class="did-lettura">—</span>
        <div class="segmenti-cielo did-velocita" id="${p}-velocita">${velocita}</div>
      </div>`;
  }

  // Un riquadro di numeri vivi sotto (o sopra) una tela. `dati` è
  // [{id, nome, unita}] e il valore lo scrive poi chi calcola.
  function didLetture(dati) {
    return `<div class="did-letture">` + dati.map(d => `
      <div class="did-lettura-voce${d.forte ? ' forte' : ''}">
        <span class="did-lettura-nome">${d.nome}</span>
        <strong id="${d.id}" class="did-lettura-valore">—</strong>
      </div>`).join('') + `</div>`;
  }

  function scrivi(id, testo, classe) {
    const n = $(id);
    if (!n) return;
    n.textContent = testo;
    if (classe !== undefined) n.className = 'did-lettura-valore' + (classe ? ' ' + classe : '');
  }

  function alterna(p, condizione) {
    const b = $(p + '-play');
    if (!b) return;
    b.innerHTML = segno(condizione ? 'pausa' : 'play');
    b.setAttribute('aria-pressed', condizione ? 'true' : 'false');
    b.setAttribute('aria-label', condizione ? 'Ferma' : 'Avvia');
    b.classList.toggle('in-marcia', !!condizione);
  }

  function collegaBarra(p, oggetto, opz = {}) {
    const play = $(p + '-play');
    if (play) play.addEventListener('click', () => {
      oggetto.marcia = !oggetto.marcia;
      alterna(p, oggetto.marcia);
      if (opz.suMarcia) opz.suMarcia(oggetto.marcia);
    });
    const inizio = $(p + '-inizio');
    if (inizio) inizio.addEventListener('click', () => {
      oggetto.marcia = false;
      alterna(p, false);
      if (opz.suInizio) opz.suInizio();
    });
    const slitta = $(p + '-slitta');
    if (slitta) slitta.addEventListener('input', (e) => {
      oggetto.marcia = false;
      alterna(p, false);
      if (opz.suSlitta) opz.suSlitta(Number(e.target.value));
    });
    const vel = $(p + '-velocita');
    if (vel) vel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-vel]');
      if (!b) return;
      vel.querySelectorAll('[data-vel]').forEach(x => x.classList.toggle('attiva', x === b));
      oggetto.velocita = Number(b.dataset.vel);
    });
  }

  // ---------------------------------------------------- date e numeri
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

  function didData(d) { return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`; }
  function didDataBreve(d) { return `${d.getDate()} ${MESI_BREVI[d.getMonth()]} ${d.getFullYear()}`; }
  function didDataCorta(d) { return `${d.getDate()} ${MESI_BREVI[d.getMonth()]}`; }
  function num(v, dec = 1) { return Number(v).toFixed(dec).replace('.', ','); }
  // I chilometri di un'orbita si scrivono a gruppi di tre: «1266870» non si
  // legge, «1.266.870» sì. Serve solo al pannello dei conti della fionda,
  // dove i numeri sono grossi e devono restare confrontabili a occhio.
  function numMila(v, dec = 0) {
    return Number(v).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  // L'istante da cui parte tutto: è l'orologio del planetario, non quello
  // del computer. Se qualcuno ha spostato il tempo di là, il laboratorio
  // parte da lì — sono lo stesso orologio.
  function didAdesso() {
    if (typeof skyAdesso === 'function') {
      try { return skyAdesso(); } catch (e) { /* il planetario non è pronto */ }
    }
    return new Date();
  }

  // ===================================================================
  // 2. I PONTI VERSO IL RESTO DELL'APP
  //    Il laboratorio non ha un tempo suo: usa quello del planetario. Da
  //    qui in poi «portami lì» vuol dire sempre la stessa cosa, in tutti
  //    e otto gli esperimenti.
  // ===================================================================

  function didPortaOrologio(data) {
    if (typeof skyImpostaOffsetTempo !== 'function' || !data) return false;
    try {
      skyImpostaOffsetTempo((data.getTime() - Date.now()) / 1000);
      return true;
    } catch (e) { return false; }
  }

  function didVaiInCielo(data, idAstro) {
    didPortaOrologio(data);
    if (typeof cercaNelCielo === 'function' && idAstro) { cercaNelCielo(idAstro); return; }
    if (typeof mostraVista === 'function') mostraVista('cielo');
  }

  function didVaiInTreD(data) {
    didPortaOrologio(data);
    if (typeof apriSistemaSolare === 'function') apriSistemaSolare();
  }

  function didVaiAllaLezione(quadro) {
    if (typeof apriLezioneEclittica === 'function') apriLezioneEclittica(quadro);
  }

  // I due tasti che chiudono ogni esperimento. Sono sempre gli stessi due
  // perché sono sempre le stesse due domande: «e in cielo dove lo vedo?» e
  // «e da fuori come sta messo?».
  function didPonti(voci) {
    return `<div class="did-ponti">` + voci.map(v =>
      `<button type="button" class="did-ponte" data-ponte="${v.azione}"${v.titolo ? ` title="${v.titolo}"` : ''}>
        <span class="did-ponte-segno">${typeof icona === 'function' ? icona(v.icona || 'stella', 17) : ''}</span>
        <span>${v.testo}</span>
      </button>`).join('') + `</div>`;
  }

  // ===================================================================
  // 3. ESPERIMENTO 1 — IL MOTO RETROGRADO
  //
  //   Due tele affiancate e la stessa data. A sinistra le orbite viste da
  //   fuori, col filo che unisce la Terra al pianeta; a destra dove quel
  //   filo va a finire sul cielo, cioè quello che si vede davvero.
  //   Il cappio a destra non è disegnato: esce da sé dalle posizioni vere.
  //
  //   Le posizioni sono di Astronomy Engine, e la traccia del cielo è in
  //   coordinate eclittiche geocentriche vere (longitudine e latitudine):
  //   è per questo che il cappio ha la forma storta che ha, diversa a ogni
  //   passaggio. Il primo tentativo di questa vista disegnava una linea
  //   avanti e indietro e ci sommava un'oscillazione finta per «fare il
  //   cappio»: si vedeva benissimo che era finta, e soprattutto non
  //   insegnava che il cappio dipende da quanto l'orbita del pianeta è
  //   inclinata sulla nostra.
  // ===================================================================

  const retro = {
    corpo: 'Mars',
    centro: null,        // l'istante attorno a cui gira la finestra (l'opposizione)
    giorno: 0,           // dove siamo dentro la finestra, in campioni
    marcia: true,
    velocita: 1,
    campioni: null,      // la traccia calcolata: posizioni elio e geo
    orbite: null,
    stazionari: null,
    calcolando: false
  };

  const RETRO_CORPI = ['Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
  const RETRO_FINESTRA = { Mars: 200, Jupiter: 170, Saturn: 160, Uranus: 150, Neptune: 150 };
  const RETRO_PASSI = 220;   // quanti campioni in tutta la finestra

  laboratorio({
    id: 'retro',
    chip: 'Moto retrogrado',
    occhiello: 'Concetto 1 — la Terra sorpassa',
    titolo: 'Perché Marte, per due mesi, torna indietro',
    sommario: `Da qui i pianeti esterni sembrano fermarsi, tornare sui propri passi e ripartire.
      Non frenano e non tornano indietro davvero: siamo noi che li sorpassiamo, perché stiamo più
      dentro e andiamo più forte. A sinistra la verità vista da fuori, a destra quello che se ne
      vede da qui — e sono la stessa cosa, nello stesso istante.`,

    costruisci() {
      return `
        <div class="did-scene did-scene-due">
          <figure class="did-scena">
            <canvas id="did-retro-elio" class="did-tela"></canvas>
            <figcaption class="did-targhetta">Le orbite viste da fuori</figcaption>
          </figure>
          <figure class="did-scena">
            <canvas id="did-retro-cielo" class="did-tela"></canvas>
            <figcaption class="did-targhetta">Quello che si vede da qui</figcaption>
          </figure>
        </div>

        ${didBarra('did-retro', { min: 0, max: RETRO_PASSI - 1, valore: 0, etichettaSlitta: 'Scorri i mesi' })}

        <div class="did-riga">
          <div class="segmenti-cielo" id="did-retro-corpi">
            ${RETRO_CORPI.map((k, i) => `<button type="button" class="tasto-segmento${i === 0 ? ' attiva' : ''}" data-corpo="${k}">${CORPI[k].nome}</button>`).join('')}
          </div>
        </div>
        <div class="did-riga did-riga-fine">
          <button type="button" class="did-tasto" id="did-retro-prima">‹ Cappio prima</button>
          <span class="did-quando" id="did-retro-quando">—</span>
          <button type="button" class="did-tasto" id="did-retro-dopo">Cappio dopo ›</button>
        </div>

        ${didLetture([
          { id: 'did-retro-data', nome: 'Data mostrata', forte: true },
          { id: 'did-retro-moto', nome: 'Moto apparente', forte: true },
          { id: 'did-retro-vel', nome: 'Velocità in cielo' },
          { id: 'did-retro-dist', nome: 'Distanza dalla Terra' },
          { id: 'did-retro-elong', nome: 'Distanza dal Sole in cielo' },
          { id: 'did-retro-mag', nome: 'Luminosità' }
        ])}

        <p class="did-spiega" id="did-retro-spiega">—</p>
        <p class="did-nota">Il cappio a destra è disegnato in coordinate eclittiche vere: la sua forma cambia a
          ogni passaggio perché dipende da quanto l'orbita del pianeta è inclinata sulla nostra. I due dischi
          sono fuori scala — a scala vera la Terra sarebbe invisibile.</p>

        ${didPonti([
          { azione: 'cielo', icona: 'stella', testo: 'Guardalo in cielo a questa data', titolo: 'Porta il planetario alla data mostrata, puntato sul pianeta' },
          { azione: 'tred', icona: 'saturno', testo: 'Vedilo dall\'esterno', titolo: 'Apre il Sistema Solare in 3D allo stesso istante' }
        ])}`;
    },

    collega() {
      collegaBarra('did-retro', retro, {
        suSlitta: (v) => { retro.giorno = v; retroAggiornaNumeri(); },
        suInizio: () => { retro.giorno = 0; retroSlitta(); retroAggiornaNumeri(); }
      });
      const corpi = $('did-retro-corpi');
      if (corpi) corpi.addEventListener('click', (e) => {
        const b = e.target.closest('[data-corpo]');
        if (!b) return;
        corpi.querySelectorAll('[data-corpo]').forEach(x => x.classList.toggle('attiva', x === b));
        retro.corpo = b.dataset.corpo;
        retro.centro = null;
        retroPrepara();
      });
      const prima = $('did-retro-prima');
      if (prima) prima.addEventListener('click', () => retroSaltaCappio(-1));
      const dopo = $('did-retro-dopo');
      if (dopo) dopo.addEventListener('click', () => retroSaltaCappio(1));

      collegaPonti('retro', (azione) => {
        const c = retroCampione();
        if (!c) return;
        if (azione === 'cielo') didVaiInCielo(c.data, retro.corpo);
        else didVaiInTreD(c.data);
      });
    },

    entra() { if (!retro.campioni || retro.corpoCalcolato !== retro.corpo) retroPrepara(); alterna('did-retro', retro.marcia); },

    passo(dt) {
      if (!retro.marcia || !retro.campioni) return;
      retro.giorno += dt * 9 * retro.velocita;
      if (retro.giorno >= RETRO_PASSI - 1) retro.giorno = 0;
      retroSlitta();
      retroAggiornaNumeri();
    },

    disegna() { retroDisegnaElio(); retroDisegnaCielo(); }
  });

  function retroSlitta() {
    const s = $('did-retro-slitta');
    if (s) s.value = String(Math.round(retro.giorno));
  }

  function retroCampione() {
    if (!retro.campioni) return null;
    const i = Math.max(0, Math.min(retro.campioni.length - 1, Math.round(retro.giorno)));
    return retro.campioni[i];
  }

  // Il centro della finestra è l'opposizione: è lì che il cappio succede,
  // perché è lì che il sorpasso avviene. Chiederla ad Astronomy Engine
  // (`SearchRelativeLongitude` a 0°) invece di stimarla dai periodi vuol
  // dire avere la data vera, quella che poi si ritrova nel calendario.
  function retroTrovaOpposizione(da, verso) {
    try {
      if (verso >= 0) return Astronomy.SearchRelativeLongitude(retro.corpo, 0, da).date;
      // All'indietro non c'è una ricerca pronta, ma non serve: le
      // opposizioni sono spaziate esattamente di un periodo sinodico,
      // quindi cercando in avanti a partire da un periodo e mezzo prima si
      // trova per forza quella immediatamente precedente.
      const sin = retroSinodico(retro.corpo);
      const indietro = new Date(da.getTime() - sin * 1.5 * GIORNO_MS);
      return Astronomy.SearchRelativeLongitude(retro.corpo, 0, indietro).date;
    } catch (e) { return null; }
  }

  function retroSinodico(k) {
    const T = CORPI[k].T;
    return Math.abs(1 / (1 / 1 - 1 / T)) * 365.25;
  }

  // Tutta la traccia si calcola una volta sola per finestra: duecento
  // istanti, ognuno con la posizione eliocentrica della Terra e del
  // pianeta e la direzione geocentrica in coordinate eclittiche. Poi il
  // tempo che cammina non ricalcola più niente — legge un indice.
  function retroPrepara() {
    if (typeof Astronomy === 'undefined') return;
    retro.calcolando = true;
    const k = retro.corpo;
    if (!retro.centro) retro.centro = retroTrovaOpposizione(didAdesso(), 1) || didAdesso();

    const mezza = RETRO_FINESTRA[k];
    const passo = (mezza * 2) / (RETRO_PASSI - 1);
    const campioni = [];
    for (let i = 0; i < RETRO_PASSI; i++) {
      const d = new Date(retro.centro.getTime() + (-mezza + i * passo) * GIORNO_MS);
      try {
        const t = Astronomy.MakeTime(d);
        const terra = Astronomy.Ecliptic(Astronomy.HelioVector('Earth', t)).vec;
        const pia = Astronomy.Ecliptic(Astronomy.HelioVector(k, t)).vec;
        const geo = Astronomy.Ecliptic(Astronomy.GeoVector(k, t, true));
        campioni.push({
          data: d,
          tx: terra.x, ty: terra.y,
          px: pia.x, py: pia.y,
          lon: geo.elon, lat: geo.elat,
          dist: Math.hypot(pia.x - terra.x, pia.y - terra.y, (pia.z || 0) - (terra.z || 0))
        });
      } catch (e) { /* una data fuori catalogo non ferma le altre */ }
    }
    if (campioni.length < 8) { retro.calcolando = false; return; }

    // La velocità apparente in cielo: quanta longitudine eclittica si
    // percorre al giorno. Negativa vuol dire retrograda — ed è tutto qui
    // il fenomeno, in un segno meno.
    for (let i = 0; i < campioni.length; i++) {
      const a = campioni[Math.max(0, i - 1)], b = campioni[Math.min(campioni.length - 1, i + 1)];
      let dLon = b.lon - a.lon;
      while (dLon > 180) dLon -= 360;
      while (dLon < -180) dLon += 360;
      const dGiorni = (b.data - a.data) / GIORNO_MS || 1;
      campioni[i].velLon = dLon / dGiorni;
      campioni[i].retro = campioni[i].velLon < 0;
    }

    // I due punti stazionari: dove il segno cambia. Sono le date che i
    // giornali chiamano «Marte diventa retrogrado».
    const staz = [];
    for (let i = 1; i < campioni.length; i++) {
      if (campioni[i].retro !== campioni[i - 1].retro) {
        staz.push({ indice: i, data: campioni[i].data, versoRetro: campioni[i].retro });
      }
    }

    // Le orbite, campionate una volta per un giro intero: sono ellissi
    // vere, non cerchi. Per Nettuno un giro sono 165 anni, e si vede che
    // non è un cerchio perfetto.
    const orbite = { terra: [], pianeta: [] };
    const base = Astronomy.MakeTime(retro.centro);
    for (let i = 0; i <= 160; i++) {
      try {
        const tt = base.AddDays((i / 160) * 365.25);
        orbite.terra.push(Astronomy.Ecliptic(Astronomy.HelioVector('Earth', tt)).vec);
      } catch (e) { /* niente */ }
    }
    const giroPianeta = CORPI[k].T * 365.25;
    for (let i = 0; i <= 200; i++) {
      try {
        const tt = base.AddDays((i / 200) * giroPianeta);
        orbite.pianeta.push(Astronomy.Ecliptic(Astronomy.HelioVector(k, tt)).vec);
      } catch (e) { /* niente */ }
    }

    retro.campioni = campioni;
    retro.orbite = orbite;
    retro.stazionari = staz;
    retro.corpoCalcolato = k;
    retro.calcolando = false;
    // Si apre in mezzo al cappio, non all'inizio della finestra: a
    // duecento giorni dall'opposizione il pianeta è fuori
    // dall'inquadratura del cielo, e la prima cosa che si vedeva era una
    // tela quasi vuota con scritto «fuori dal riquadro» — che è
    // esattamente il contrario di quello che questo banco deve mostrare.
    retro.giorno = Math.round(RETRO_PASSI / 2);
    retroSlitta();
    retroAggiornaNumeri();
  }

  function retroSaltaCappio(verso) {
    if (!retro.centro) return;
    const partenza = new Date(retro.centro.getTime() + verso * GIORNO_MS * 10);
    const nuova = retroTrovaOpposizione(partenza, verso);
    if (!nuova) return;
    retro.centro = nuova;
    retro.giorno = 0;
    retroPrepara();
  }

  function retroAggiornaNumeri() {
    const c = retroCampione();
    if (!c) return;
    const nome = CORPI[retro.corpo].nome;
    scrivi('did-retro-data', didData(c.data));

    const retrogrado = c.retro;
    const quasiFermo = Math.abs(c.velLon) < 0.012;
    scrivi('did-retro-moto',
      quasiFermo ? 'fermo (stazionario)' : retrogrado ? 'retrogrado — va all\'indietro' : 'diretto — va avanti',
      quasiFermo ? 'ambra' : retrogrado ? 'rosso' : 'verde');
    scrivi('did-retro-vel', `${num(c.velLon * 60, 1)}′ al giorno`);
    scrivi('did-retro-dist', `${num(c.dist, 3)} UA · ${num(c.dist * AU_KM / 1e6, 0)} milioni di km`);

    try {
      const t = Astronomy.MakeTime(c.data);
      const el = Astronomy.AngleFromSun(retro.corpo, t);
      scrivi('did-retro-elong', `${num(el, 0)}° dal Sole`);
      const ill = Astronomy.Illumination(retro.corpo, t);
      scrivi('did-retro-mag', `magnitudine ${num(ill.mag, 1)}`);
    } catch (e) {
      scrivi('did-retro-elong', '—'); scrivi('did-retro-mag', '—');
    }

    const quando = $('did-retro-quando');
    if (quando && retro.centro) quando.textContent = `Opposizione: ${didDataBreve(retro.centro)}`;
    const lettura = $('did-retro-lettura');
    if (lettura && retro.centro) {
      const g = Math.round((c.data - retro.centro) / GIORNO_MS);
      lettura.textContent = g === 0 ? 'opposizione' : `${g > 0 ? '+' : '−'}${Math.abs(g)} g`;
    }

    const sp = $('did-retro-spiega');
    if (sp) {
      const staz = retro.stazionari || [];
      const inizio = staz.find(s => s.versoRetro);
      const fine = staz.find(s => !s.versoRetro && (!inizio || s.indice > inizio.indice));
      let durata = '';
      if (inizio && fine) {
        const giorni = Math.round((fine.data - inizio.data) / GIORNO_MS);
        durata = ` Questo cappio dura <strong>${giorni} giorni</strong>, dal ${didDataBreve(inizio.data)} al ${didDataBreve(fine.data)}.`;
      }
      sp.innerHTML = retrogrado
        ? `Adesso ${nome} <strong>sta andando all'indietro</strong> fra le stelle. Guarda a sinistra: la Terra
           è dalla stessa parte del Sole rispetto a ${nome} e lo sta sorpassando, come un'auto sulla corsia
           interna. Il filo che li unisce ruota all'indietro, e il pianeta con lui.${durata}`
        : `Adesso ${nome} <strong>va avanti</strong>, verso oriente, come fa quasi sempre. Il sorpasso deve
           ancora cominciare (o è già finito): la Terra e ${nome} si stanno avvicinando lungo le rispettive
           orbite.${durata}`;
    }
  }

  function retroDisegnaElio() {
    const t = didTela('did-retro-elio', 1, 400, { lente: true, gira: true, pieno: true });
    if (!t || !retro.campioni) return;
    const { ctx, L, H } = t;
    didSfondo(ctx, L, H);

    const c = retroCampione();
    const scala = (Math.min(L, H) * 0.42) / (CORPI[retro.corpo].a * 1.08);
    const cx = L / 2, cy = H / 2;
    const X = (v) => cx + v * scala;
    const Y = (v) => cy - v * scala;

    // Le due orbite vere
    [['terra', 'rgba(76, 141, 255, 0.30)'], ['pianeta', didVela(CORPI[retro.corpo].colore, 0.30)]].forEach(([k, col]) => {
      const p = retro.orbite && retro.orbite[k];
      if (!p || p.length < 3) return;
      ctx.strokeStyle = col; ctx.lineWidth = 1.1;
      ctx.beginPath();
      p.forEach((v, i) => i ? ctx.lineTo(X(v.x), Y(v.y)) : ctx.moveTo(X(v.x), Y(v.y)));
      ctx.closePath(); ctx.stroke();
    });

    // Il filo di vista, e il suo prolungamento verso le stelle: è la cosa
    // da guardare, perché è quella che a destra diventa la posizione in
    // cielo. Si prolunga ben oltre il pianeta proprio per dire «e poi
    // continua fino alle stelle fisse, infinitamente lontane».
    const tx = X(c.tx), ty = Y(c.ty), px = X(c.px), py = Y(c.py);
    const dx = px - tx, dy = py - ty, len = Math.hypot(dx, dy) || 1;
    const lungo = Math.max(L, H);
    ctx.strokeStyle = c.retro ? 'rgba(248, 113, 113, 0.55)' : 'rgba(138, 180, 255, 0.45)';
    ctx.lineWidth = 1.3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + dx / len * lungo, ty + dy / len * lungo); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = c.retro ? C.rosso : C.bluChiaro;
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke();

    // La strada già fatta dai due, negli ultimi mesi
    const i0 = Math.max(0, Math.round(retro.giorno) - 90);
    const iN = Math.round(retro.giorno);
    ctx.lineWidth = 1.6;
    ['t', 'p'].forEach((q) => {
      ctx.strokeStyle = q === 't' ? 'rgba(76, 141, 255, 0.75)' : didVela(CORPI[retro.corpo].colore, 0.75);
      ctx.beginPath();
      for (let i = i0; i <= iN; i++) {
        const s = retro.campioni[i];
        const xx = X(q === 't' ? s.tx : s.px), yy = Y(q === 't' ? s.ty : s.py);
        i === i0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    });

    didCorpo(ctx, cx, cy, Math.max(7, L * 0.026), C.sole, { alone: 3.4 });
    didCorpo(ctx, tx, ty, 5, C.terra);
    didCorpo(ctx, px, py, 6.5, CORPI[retro.corpo].colore, { anelli: retro.corpo === 'Saturn' });
    didScritta(ctx, 'Terra', tx + 9, ty + 4, { colore: C.bluChiaro, misura: 11 });
    didScritta(ctx, CORPI[retro.corpo].nome, px + 10, py + 4, { colore: CORPI[retro.corpo].colore, misura: 11 });
    didScritta(ctx, 'Sole', cx + 12, cy + 16, { colore: C.ambra, misura: 10 });
  }

  function retroDisegnaCielo() {
    const t = didTela('did-retro-cielo', 1, 400, { lente: true });
    if (!t || !retro.campioni) return;
    const { ctx, L, H } = t;
    didSfondo(ctx, L, H);

    // L'inquadratura si stringe sul cappio, non su tutta la traccia. È
    // una lezione presa sbattendoci la testa: inquadrando i quattrocento
    // giorni interi il pianeta percorre novanta gradi di longitudine e
    // quindici di cappio, e il cappio diventa un puntino schiacciato in
    // un angolo — cioè sparisce proprio la cosa da guardare. Si inquadra
    // il tratto retrogrado più un mese per parte; il resto della traccia
    // entra ed esce dai bordi, e va benissimo così.
    const rif = retro.campioni[0].lon;
    const rel = retro.campioni.map(s => {
      let d = s.lon - rif;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      return d;
    });
    const staz = retro.stazionari || [];
    let da = Math.round(retro.campioni.length * 0.32), a = Math.round(retro.campioni.length * 0.68);
    if (staz.length >= 2) {
      const orlo = Math.round(retro.campioni.length * 0.09);
      da = Math.max(0, staz[0].indice - orlo);
      a = Math.min(retro.campioni.length - 1, staz[staz.length - 1].indice + orlo);
    }
    let lonMin = 1e9, lonMax = -1e9, latMin = 1e9, latMax = -1e9;
    for (let i = da; i <= a; i++) {
      lonMin = Math.min(lonMin, rel[i]); lonMax = Math.max(lonMax, rel[i]);
      latMin = Math.min(latMin, retro.campioni[i].lat); latMax = Math.max(latMax, retro.campioni[i].lat);
    }
    const margine = 0.12;
    const spanL = Math.max(lonMax - lonMin, 3) * (1 + margine * 2);
    const spanB = Math.max(latMax - latMin, 1.2) * (1 + margine * 2);
    // Lo stesso metro sui due assi, se no il cappio verrebbe stirato e
    // avrebbe una forma che non è la sua
    const scala = Math.min((L - 30) / spanL, (H - 52) / spanB);
    const cLon = (lonMin + lonMax) / 2, cLat = (latMin + latMax) / 2;
    // In cielo la longitudine cresce verso oriente, e oriente sulle carte
    // sta a sinistra: per questo la x è girata. Senza, il cappio si
    // vedrebbe specchiato rispetto a come lo si trova sull'atlante.
    const X = (d) => L / 2 - (d - cLon) * scala;
    const Y = (b) => H / 2 - (b - cLat) * scala;

    // La riga dell'eclittica, e le tacche dei gradi
    ctx.strokeStyle = 'rgba(245, 181, 68, 0.28)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(L, Y(0)); ctx.stroke();
    ctx.setLineDash([]);
    didScritta(ctx, 'eclittica', 8, Y(0) - 6, { colore: 'rgba(245, 181, 68, 0.75)', misura: 9, peso: 500 });

    // Sei o sette tacche, non una ogni grado: il passo si sceglie da sé
    // in base a quanto cielo è inquadrato
    const largo = (L - 30) / scala;                       // gradi visibili
    const passoTacca = [0.5, 1, 2, 5, 10, 20].find(p => largo / p <= 8) || 30;
    const primo = Math.ceil((cLon - largo / 2) / passoTacca) * passoTacca;
    for (let g = primo; g <= cLon + largo / 2; g += passoTacca) {
      const x = X(g);
      if (x < 16 || x > L - 16) continue;
      ctx.strokeStyle = C.griglia; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      const lonVera = ((rif + g) % 360 + 360) % 360;
      // I gradi vanno in alto: in basso a sinistra c'è la targhetta della
      // scena, e le due scritte finivano una sopra l'altra
      didScritta(ctx, `${lonVera.toFixed(passoTacca < 1 ? 1 : 0)}°`, x, 15,
        { colore: C.testo3, misura: 9, peso: 500, mono: true, allinea: 'center' });
    }

    // La traccia: due colori, e la differenza è tutto il concetto. Blu
    // dove il pianeta va avanti, rosso dove torna indietro.
    ctx.lineCap = 'round';
    for (let i = 1; i < retro.campioni.length; i++) {
      // Quello che sta fuori dall'inquadratura si vede appena: serve solo
      // a dire «di là continua», non deve rubare l'occhio al cappio
      const dentro = i >= da && i <= a;
      ctx.lineWidth = dentro ? 2.4 : 1.4;
      ctx.strokeStyle = retro.campioni[i].retro
        ? (dentro ? 'rgba(248, 113, 113, 0.95)' : 'rgba(248, 113, 113, 0.35)')
        : (dentro ? 'rgba(138, 180, 255, 0.6)' : 'rgba(138, 180, 255, 0.2)');
      ctx.beginPath();
      ctx.moveTo(X(rel[i - 1]), Y(retro.campioni[i - 1].lat));
      ctx.lineTo(X(rel[i]), Y(retro.campioni[i].lat));
      ctx.stroke();
    }

    // I due punti stazionari, con la data: sono i due chiodi del cappio
    (retro.stazionari || []).forEach(s => {
      const x = X(rel[s.indice]), y = Y(retro.campioni[s.indice].lat);
      didCerchio(ctx, x, y, 6, C.ambra, 1.6);
      didScritta(ctx, didDataCorta(s.data), x, y - 11, { colore: C.ambra, misura: 9, allinea: 'center', peso: 600 });
    });

    // Dove il pianeta sta adesso, e da che parte va
    const i = Math.max(0, Math.min(retro.campioni.length - 1, Math.round(retro.giorno)));
    const c = retro.campioni[i];
    const x = X(rel[i]), y = Y(c.lat);
    const iPrima = Math.max(0, i - 6);
    didFreccia(ctx, X(rel[iPrima]), Y(retro.campioni[iPrima].lat), x, y,
      { colore: c.retro ? C.rosso : C.bluChiaro, spessore: 2.4, punta: 10 });
    didCorpo(ctx, x, y, 7, CORPI[retro.corpo].colore, { anelli: retro.corpo === 'Saturn' });
    // Il nome sta a destra del disco finché c'è posto, poi passa a
    // sinistra: fuori dall'inquadratura si taglierebbe a metà
    const aDestra = x < L - 74;
    didScritta(ctx, CORPI[retro.corpo].nome, x + (aDestra ? 11 : -11), y + 4,
      { colore: C.testo, misura: 11, allinea: aDestra ? 'left' : 'right' });
    // E se il pianeta è proprio fuori dal riquadro, una freccina al bordo
    // dice da che parte è andato invece di lasciare la tela vuota
    if (x < 4 || x > L - 4) {
      const xb = x < 4 ? 14 : L - 14;
      didFreccia(ctx, xb + (x < 4 ? 10 : -10), H / 2, xb, H / 2, { colore: C.testo3, spessore: 1.6, punta: 8 });
      didScritta(ctx, 'fuori dal riquadro', L / 2, H / 2 - 12,
        { colore: C.testo3, misura: 10, allinea: 'center', peso: 600 });
    }

    didScritta(ctx, 'longitudine eclittica →', L - 8, H - 10, { colore: C.testo3, misura: 9, allinea: 'right', peso: 500 });
  }

  // ===================================================================
  // 4. ESPERIMENTO 2 — LE TRE LEGGI DI KEPLERO
  //
  //   Sta qui in mezzo, e non è un caso: le altre quattro sono tutte
  //   conseguenze sue. Il cappio del moto retrogrado esiste perché chi sta
  //   più vicino al Sole va più forte (terza legge). La finestra di lancio
  //   esiste perché il tempo di volo è fissato dal semiasse dell'ellisse
  //   di trasferimento (terza legge, di nuovo). La fionda si può calcolare
  //   perché attorno a un pianeta si viaggia su una conica (prima legge).
  //
  //   Tre quadri, uno per legge, sulla stessa ellisse.
  // ===================================================================

  const kep = {
    quadro: 'forma',
    e: 0.6,
    fase: 0,        // anomalia media, in giri
    marcia: true,
    velocita: 1,
    aTerza: 1.52,
    scelto: 'Mars'
  };

  laboratorio({
    id: 'keplero',
    chip: 'Le leggi di Keplero',
    occhiello: 'Concetto 2 — le tre regole di tutto',
    titolo: 'Le tre leggi che comandano ogni cosa qui dentro',
    sommario: `Quattrocento anni fa Keplero si accorse di tre cose guardando i numeri di Tycho Brahe:
      le orbite sono ellissi, i pianeti vanno più forte quando sono vicini al Sole, e chi sta più lontano
      impiega spropositatamente di più. Da queste tre righe discendono il moto retrogrado, le finestre
      di lancio e la traiettoria di ogni sonda mai partita.`,

    costruisci() {
      return `
        <div class="segmenti-cielo did-quadri" id="did-kep-quadri">
          <button type="button" class="tasto-segmento attiva" data-quadro="forma">1ª · L'ellisse</button>
          <button type="button" class="tasto-segmento" data-quadro="aree">2ª · Le aree</button>
          <button type="button" class="tasto-segmento" data-quadro="armonia">3ª · L'armonia</button>
        </div>

        <figure class="did-scena did-scena-tonda">
          <canvas id="did-kep-tela" class="did-tela"></canvas>
          <figcaption class="did-targhetta" id="did-kep-targhetta">La prima legge</figcaption>
        </figure>

        <div id="did-kep-comandi-orbita">
          ${didBarra('did-kep', { min: 0, max: 999, valore: 0, etichettaSlitta: 'Scorri lungo l\'orbita' })}
          <div class="did-riga">
            <label class="did-etichetta" for="did-kep-ecc">Schiacciamento dell'orbita (eccentricità)</label>
            <span class="did-valore" id="did-kep-ecc-val">0,60</span>
          </div>
          <input id="did-kep-ecc" class="did-slitta did-slitta-larga" type="range" min="0" max="0.92" step="0.01" value="0.6">
          <div class="did-riga did-riga-avvolgi" id="did-kep-esempi">
            <span class="did-etichetta">Prendi quella di:</span>
            <button type="button" class="did-pillola" data-ecc="0.0167" data-nome="Terra">Terra</button>
            <button type="button" class="did-pillola" data-ecc="0.0934" data-nome="Marte">Marte</button>
            <button type="button" class="did-pillola" data-ecc="0.2056" data-nome="Mercurio">Mercurio</button>
            <button type="button" class="did-pillola" data-ecc="0.85" data-nome="una cometa">una cometa</button>
          </div>
        </div>

        <div id="did-kep-comandi-armonia" class="hidden">
          <div class="did-riga">
            <label class="did-etichetta" for="did-kep-a">Se un pianeta stesse a…</label>
            <span class="did-valore" id="did-kep-a-val">1,52 UA</span>
          </div>
          <input id="did-kep-a" class="did-slitta did-slitta-larga" type="range" min="0.3" max="31" step="0.01" value="1.52">
        </div>

        ${didLetture([
          { id: 'did-kep-r', nome: 'Distanza dal Sole', forte: true },
          { id: 'did-kep-v', nome: 'Velocità adesso', forte: true },
          { id: 'did-kep-peri', nome: 'Perielio · afelio' },
          { id: 'did-kep-area', nome: 'Area spazzata in 1/12 di anno' }
        ])}

        <p class="did-spiega" id="did-kep-spiega">—</p>

        ${didPonti([
          { azione: 'tred', icona: 'saturno', testo: 'Vedi le orbite vere in 3D', titolo: 'Apre il Sistema Solare in 3D, dove le orbite sono quelle vere' },
          { azione: 'lezione', icona: 'sole', testo: 'E perché stanno tutte sullo stesso piano?', titolo: 'Apre la lezione dell\'eclittica' }
        ])}`;
    },

    collega() {
      const quadri = $('did-kep-quadri');
      if (quadri) quadri.addEventListener('click', (e) => {
        const b = e.target.closest('[data-quadro]');
        if (!b) return;
        quadri.querySelectorAll('[data-quadro]').forEach(x => x.classList.toggle('attiva', x === b));
        didPienoEsci();
        kep.quadro = b.dataset.quadro;
        kepAggiornaComandi();
      });
      collegaBarra('did-kep', kep, {
        suSlitta: (v) => { kep.fase = v / 1000; kepNumeri(); },
        suInizio: () => { kep.fase = 0; kepNumeri(); }
      });
      const ecc = $('did-kep-ecc');
      if (ecc) ecc.addEventListener('input', (e) => {
        kep.e = Number(e.target.value);
        const v = $('did-kep-ecc-val');
        if (v) v.textContent = num(kep.e, 3);
        kepNumeri();
      });
      const esempi = $('did-kep-esempi');
      if (esempi) esempi.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ecc]');
        if (!b) return;
        kep.e = Number(b.dataset.ecc);
        const s = $('did-kep-ecc'); if (s) s.value = String(kep.e);
        const v = $('did-kep-ecc-val'); if (v) v.textContent = num(kep.e, 3);
        esempi.querySelectorAll('[data-ecc]').forEach(x => x.classList.toggle('attiva', x === b));
        kepNumeri();
      });
      const sa = $('did-kep-a');
      if (sa) sa.addEventListener('input', (e) => {
        kep.aTerza = Number(e.target.value);
        kepNumeri();
      });
      collegaPonti('keplero', (azione) => {
        if (azione === 'tred') didVaiInTreD(didAdesso());
        else didVaiAllaLezione('piano');
      });
    },

    entra() { kepAggiornaComandi(); alterna('did-kep', kep.marcia); },

    passo(dt) {
      if (!kep.marcia || kep.quadro === 'armonia') return;
      kep.fase = (kep.fase + dt * 0.09 * kep.velocita) % 1;
      const s = $('did-kep-slitta');
      if (s) s.value = String(Math.round(kep.fase * 1000));
      kepNumeri();
    },

    disegna() { kepDisegna(); }
  });

  function kepAggiornaComandi() {
    const orb = $('did-kep-comandi-orbita'), arm = $('did-kep-comandi-armonia');
    if (orb) orb.classList.toggle('hidden', kep.quadro === 'armonia');
    if (arm) arm.classList.toggle('hidden', kep.quadro !== 'armonia');
    const targhetta = $('did-kep-targhetta');
    if (targhetta) targhetta.textContent = kep.quadro === 'forma' ? 'Prima legge — l\'orbita è un\'ellisse, il Sole sta in un fuoco'
      : kep.quadro === 'aree' ? 'Seconda legge — in tempi uguali si spazzano aree uguali'
      : 'Terza legge — il quadrato dell\'anno è il cubo della distanza';
    kepNumeri();
  }

  // L'equazione di Keplero: da M (che cammina uniforme col tempo) a E
  // (che dice davvero dove sta il corpo). Non si può invertire con una
  // formula, si itera — e in sei passi di Newton è già esatta al
  // miliardesimo, anche per un'ellisse molto schiacciata.
  function kepEccentrica(M, e) {
    let E = e < 0.8 ? M : Math.PI;
    for (let i = 0; i < 8; i++) {
      const f = E - e * Math.sin(E) - M;
      const df = 1 - e * Math.cos(E);
      const passo = f / df;
      E -= passo;
      if (Math.abs(passo) < 1e-12) break;
    }
    return E;
  }

  // Posizione sull'ellisse in unità di semiasse, misurata dal fuoco (dal
  // Sole, cioè): è la forma in cui serve a tutti i disegni.
  function kepPunto(M, e) {
    const E = kepEccentrica(M, e);
    return {
      x: Math.cos(E) - e,
      y: Math.sqrt(1 - e * e) * Math.sin(E),
      r: 1 - e * Math.cos(E),
      E
    };
  }

  function kepNumeri() {
    if (kep.quadro === 'armonia') {
      const a = kep.aTerza;
      const T = Math.pow(a, 1.5);
      const av = $('did-kep-a-val');
      if (av) av.textContent = `${num(a, 2)} UA`;
      scrivi('did-kep-r', `${num(a, 2)} UA dal Sole`);
      scrivi('did-kep-v', `${num(29.785 / Math.sqrt(a), 1)} km/s`);
      scrivi('did-kep-peri', `il suo anno: ${T < 1 ? num(T * 365.25, 0) + ' giorni' : num(T, 2) + ' anni'}`);
      scrivi('did-kep-area', '—');
      const sp = $('did-kep-spiega');
      if (sp) sp.innerHTML = `Un pianeta a <strong>${num(a, 2)} UA</strong> impiegherebbe
        <strong>${T < 1 ? num(T * 365.25, 0) + ' giorni' : num(T, 2) + ' anni'}</strong> a fare un giro:
        è ${num(a, 2)} elevato a 1,5. Il doppio della distanza non fa il doppio dell'anno, ne fa quasi il
        triplo — ed è questa sproporzione che rende il viaggio verso i pianeti esterni così lento, e le
        loro finestre di lancio così frequenti (perché li raggiungiamo quasi subito, tanto loro non
        scappano).`;
      return;
    }

    const e = kep.e;
    const M = kep.fase * Math.PI * 2;
    const p = kepPunto(M, e);
    // Tutti i numeri riferiti a un semiasse di 1 UA, così sono confrontabili
    const r = p.r;
    const v = Math.sqrt(MU_SOLE * (2 / r - 1)) * UA_ANNO_IN_KMS;
    scrivi('did-kep-r', `${num(r, 3)} UA (a = 1 UA)`);
    scrivi('did-kep-v', `${num(v, 2)} km/s`, r < 1 ? 'verde' : 'ambra');
    scrivi('did-kep-peri', `${num(1 - e, 3)} UA · ${num(1 + e, 3)} UA`);
    // L'area di un dodicesimo di orbita è sempre la stessa: π·a·b/12
    const area = Math.PI * Math.sqrt(1 - e * e) / 12;
    scrivi('did-kep-area', `${num(area, 4)} UA² — sempre la stessa`);
    const lettura = $('did-kep-lettura');
    if (lettura) lettura.textContent = `mese ${Math.floor(kep.fase * 12) + 1}/12`;

    const sp = $('did-kep-spiega');
    if (!sp) return;
    if (kep.quadro === 'forma') {
      sp.innerHTML = e < 0.03
        ? `Con l'eccentricità quasi a zero l'ellisse è indistinguibile da un cerchio: è il caso della Terra
           (e = 0,0167), ed è il motivo per cui per duemila anni nessuno si è accorto che non era un cerchio.
           <strong>Alza lo schiacciamento</strong> e guarda dove va a finire il Sole: non al centro, ma in
           uno dei due fuochi — l'altro resta vuoto.`
        : `Il Sole sta in <strong>uno dei due fuochi</strong>, mai al centro. La distanza dal Sole oscilla
           fra ${num(1 - e, 3)} e ${num(1 + e, 3)} UA nello stesso giro, e con lei oscilla tutto: la
           velocità, la luce ricevuta, la durata delle stagioni.`;
    } else {
      sp.innerHTML = `I dodici spicchi hanno forme diversissime — stretti e lunghi vicino all'afelio, larghi
        e corti al perielio — ma <strong>la stessa area</strong>, e il pianeta ne percorre uno per ogni
        dodicesimo del suo anno. Detto al contrario: vicino al Sole deve correre
        (${num(Math.sqrt(MU_SOLE * (2 / (1 - e) - 1)) * UA_ANNO_IN_KMS, 1)} km/s al perielio) e lontano può
        andare piano (${num(Math.sqrt(MU_SOLE * (2 / (1 + e) - 1)) * UA_ANNO_IN_KMS, 1)} km/s all'afelio).
        È la conservazione del momento angolare, scoperta prima che avesse un nome.`;
    }
  }

  function kepDisegna() {
    const t = didTela('did-kep-tela', 1.5, 440, { lente: true, gira: kep.quadro !== 'armonia', pieno: true });
    if (!t) return;
    const { ctx, L, H } = t;
    didSfondo(ctx, L, H);
    if (kep.quadro === 'armonia') { kepDisegnaArmonia(ctx, L, H); return; }

    const e = kep.e;
    const b = Math.sqrt(1 - e * e);
    // Il disegno si tiene sempre nel riquadro qualunque sia lo
    // schiacciamento: si scala sul semiasse maggiore, che è l'unica misura
    // che non cambia mentre si muove la slitta
    const scala = Math.min((L * 0.84) / 2, (H * 0.8) / (2 * Math.max(b, 0.28)));
    // Il riquadro si centra sull'**ellisse**, non sul fuoco: il Sole sta
    // di lato, ed è giusto così — è la prima legge. Centrando sul Sole,
    // con un'orbita molto schiacciata metà del disegno finiva fuori.
    const cx = L / 2 + e * scala, cy = H / 2;
    const X = (x) => cx + x * scala;
    const Y = (y) => cy - y * scala;

    // L'ellisse
    ctx.strokeStyle = 'rgba(148, 168, 214, 0.34)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(X(-e), Y(0), scala, scala * b, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (kep.quadro === 'aree') {
      // I dodici spicchi. Si disegnano come poligoni fitti fra due
      // anomalie medie: essendo M proporzionale al tempo, dodici spicchi
      // di M uguale sono dodici mesi uguali — e le aree vengono da sé.
      for (let s = 0; s < 12; s++) {
        const attivo = Math.floor(kep.fase * 12) === s;
        ctx.beginPath();
        ctx.moveTo(X(0), Y(0));
        for (let k = 0; k <= 14; k++) {
          const M = ((s + k / 14) / 12) * Math.PI * 2;
          const p = kepPunto(M, e);
          ctx.lineTo(X(p.x), Y(p.y));
        }
        ctx.closePath();
        ctx.fillStyle = attivo ? 'rgba(245, 181, 68, 0.42)'
          : s % 2 ? 'rgba(76, 141, 255, 0.16)' : 'rgba(139, 92, 246, 0.14)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 168, 214, 0.20)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    } else {
      // Prima legge: i due fuochi, gli assi, e i due raggi che sommati
      // fanno sempre 2a — la definizione stessa di ellisse, disegnata
      const p = kepPunto(kep.fase * Math.PI * 2, e);
      ctx.strokeStyle = 'rgba(148, 168, 214, 0.22)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(X(-1 - e), Y(0)); ctx.lineTo(X(1 - e), Y(0)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(-e), Y(-b)); ctx.lineTo(X(-e), Y(b)); ctx.stroke();
      ctx.setLineDash([]);
      // il secondo fuoco, quello dove non c'è niente
      didCerchio(ctx, X(-2 * e), Y(0), 4.5, 'rgba(148, 168, 214, 0.6)', 1.2, [3, 3]);
      didScritta(ctx, 'l\'altro fuoco: vuoto', X(-2 * e), Y(0) + 18, { colore: C.testo3, misura: 9, allinea: 'center', peso: 500 });
      ctx.strokeStyle = 'rgba(245, 181, 68, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(p.x), Y(p.y)); ctx.stroke();
      ctx.strokeStyle = 'rgba(148, 168, 214, 0.35)';
      ctx.beginPath(); ctx.moveTo(X(-2 * e), Y(0)); ctx.lineTo(X(p.x), Y(p.y)); ctx.stroke();
    }

    // La strada già percorsa in questo giro
    const punti = [];
    const finoA = Math.max(2, Math.round(kep.fase * 180));
    for (let i = 0; i <= finoA; i++) {
      const p = kepPunto((i / 180) * Math.PI * 2, e);
      punti.push({ x: X(p.x), y: Y(p.y) });
    }
    didPercorso(ctx, punti, { colore: 'rgba(138, 180, 255, 0.55)', spessore: 1.6 });

    const p = kepPunto(kep.fase * Math.PI * 2, e);
    // La freccia della velocità: la direzione si prende avanzando di un
    // pelo lungo l'orbita, la lunghezza dalla vis-viva. Così al perielio
    // la freccia è visibilmente il doppio o il triplo che all'afelio, ed è
    // la seconda legge disegnata senza doverla dire.
    const p2 = kepPunto(kep.fase * Math.PI * 2 + 0.004, e);
    const vx = p2.x - p.x, vy = p2.y - p.y;
    const vlen = Math.hypot(vx, vy) || 1;
    const vKm = Math.sqrt(MU_SOLE * (2 / p.r - 1));
    const lung = 14 + vKm * 13;
    didFreccia(ctx, X(p.x), Y(p.y), X(p.x) + (vx / vlen) * lung, Y(p.y) - (vy / vlen) * lung,
      { colore: C.verde, spessore: 2.2, punta: 8 });

    didCorpo(ctx, X(0), Y(0), Math.max(9, scala * 0.075), C.sole, { alone: 3.2 });
    didCorpo(ctx, X(p.x), Y(p.y), 7, C.terra);
    didScritta(ctx, 'Sole', X(0), Y(0) + Math.max(9, scala * 0.075) + 14, { colore: C.ambra, misura: 10, allinea: 'center' });
    didScritta(ctx, `${num(vKm * UA_ANNO_IN_KMS, 1)} km/s`, X(p.x) + 11, Y(p.y) - 9, { colore: C.verde, misura: 10, peso: 700 });
  }

  function kepDisegnaArmonia(ctx, L, H) {
    // Un grafico in scala logaritmica: la terza legge, che è una potenza,
    // in log-log diventa una retta di pendenza 3/2 — e gli otto pianeti ci
    // stanno sopra uno per uno, senza nessun aggiustamento.
    const mx = 46, my = 34;
    const x0 = mx, x1 = L - 16, y0 = H - my, y1 = 18;
    const lax = [-0.55, 1.55];          // log10(a): da 0,28 a 35 UA
    const lay = [-0.75, 2.35];          // log10(T): da 0,18 a 224 anni
    const X = (la) => x0 + (la - lax[0]) / (lax[1] - lax[0]) * (x1 - x0);
    const Y = (lt) => y0 - (lt - lay[0]) / (lay[1] - lay[0]) * (y0 - y1);

    ctx.strokeStyle = C.griglia;
    ctx.lineWidth = 1;
    [0.3, 1, 3, 10, 30].forEach(a => {
      const x = X(Math.log10(a));
      ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y0); ctx.stroke();
      // In alto: in fondo a sinistra c'è la targhetta della scena, e le
      // prime due tacche ci finivano sotto
      didScritta(ctx, `${a} UA`, x, 14, { colore: C.testo3, misura: 9, allinea: 'center', peso: 500, mono: true });
    });
    [0.2, 1, 10, 100].forEach(T => {
      const y = Y(Math.log10(T));
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      didScritta(ctx, T < 1 ? `${T}` : `${T} a`, x0 - 6, y + 3, { colore: C.testo3, misura: 9, allinea: 'right', peso: 500, mono: true });
    });

    // La legge
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(lax[0]), Y(1.5 * lax[0]));
    ctx.lineTo(X(lax[1]), Y(1.5 * lax[1]));
    ctx.stroke();
    // La formula sta al centro della retta, non in fondo: all'angolo
    // usciva dal riquadro insieme al nome di Nettuno
    didScritta(ctx, 'T = a¹·⁵', X(0.15) + 10, Y(1.5 * 0.15) + 18, { colore: C.verde, misura: 12, peso: 700 });

    Object.keys(CORPI).forEach(k => {
      const c = CORPI[k];
      const x = X(Math.log10(c.a)), y = Y(Math.log10(c.T));
      didCorpo(ctx, x, y, 6, c.colore, { alone: 2.2, anelli: k === 'Saturn' });
      const aDestra = x < L - 78;
      didScritta(ctx, c.nome, x + (aDestra ? 9 : -9), y + 4,
        { colore: C.testo2, misura: 10, allinea: aDestra ? 'left' : 'right' });
    });

    const a = kep.aTerza, T = Math.pow(a, 1.5);
    const px = X(Math.log10(a)), py = Y(Math.log10(T));
    ctx.strokeStyle = 'rgba(245, 181, 68, 0.5)';
    ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, py); ctx.lineTo(x0, py); ctx.stroke();
    ctx.setLineDash([]);
    didCerchio(ctx, px, py, 8, C.ambra, 2);
    didScritta(ctx, `${num(a, 2)} UA → ${T < 1 ? num(T * 365.25, 0) + ' giorni' : num(T, 2) + ' anni'}`,
      px, py - 14, { colore: C.ambra, misura: 11, allinea: 'center', peso: 700 });
  }

  // ===================================================================
  // 5. ESPERIMENTO 3 — LA FIONDA GRAVITAZIONALE
  //
  //   Questo esperimento esiste per una sola frase, e la frase è questa:
  //   «rispetto al pianeta la sonda esce con la stessa velocità con cui è
  //   entrata; rispetto al Sole no». Tutto il resto — perché si guadagni
  //   passando dietro e si perda passando davanti, perché il massimo
  //   possibile sia il doppio della velocità del pianeta — sta lì dentro.
  //
  //   Per questo le tele sono due, affiancate e sincronizzate: la stessa
  //   sonda, lo stesso istante, due osservatori. A sinistra chi sta seduto
  //   sul pianeta e vede un'iperbole perfettamente simmetrica; a destra
  //   chi guarda dal Sole e vede una curva che entra piano ed esce forte.
  //   Sotto, il triangolo dei vettori che spiega la differenza.
  //
  //   La fisica è vera: integrazione a due corpi con il GM del pianeta
  //   scelto, distanze in chilometri, velocità in km/s. L'angolo di
  //   deviazione che compare fra i numeri è quello analitico
  //   dell'iperbole, e serve anche da controllo: se l'integrazione
  //   sbagliasse, i due numeri divergerebbero subito.
  // ===================================================================

  const fionda = {
    scheda: 'sim',
    pianeta: 'Jupiter',
    vInf: 10,          // velocità di avvicinamento relativa al pianeta, km/s
    b: 15,             // parametro d'impatto, in raggi planetari (segno = da che parte passa)
    traiettoria: null,
    t: 0,
    marcia: true,
    velocita: 1,
    voyMarcia: true,
    voyAnno: 1977.6,
    voyVel: 1
  };

  // Il GM dei pianeti (km³/s²) e la loro velocità orbitale media (km/s):
  // sono i due numeri che decidono quanto si può guadagnare. `muTesto` è lo
  // stesso μ scritto come si scrive a mano, che nel pannello dei conti
  // vale più di 126687000.
  const FIONDA_PIANETI = {
    Venus:   { mu: 3.24859e5, vOrb: 35.02, raggio: 6052,  nome: 'Venere',  colore: '#e8cf9a', muTesto: '3,24859 × 10⁵' },
    Earth:   { mu: 3.98600e5, vOrb: 29.78, raggio: 6371,  nome: 'Terra',   colore: '#4c8dff', muTesto: '3,98600 × 10⁵' },
    Jupiter: { mu: 1.26687e8, vOrb: 13.07, raggio: 69911, nome: 'Giove',   colore: '#e0a367', muTesto: '1,26687 × 10⁸' },
    Saturn:  { mu: 3.79312e7, vOrb: 9.68,  raggio: 58232, nome: 'Saturno', colore: '#e3d6a3', muTesto: '3,79312 × 10⁷' }
  };

  laboratorio({
    id: 'fionda',
    chip: 'Fionda gravitazionale',
    occhiello: 'Concetto 3 — rubare velocità a un pianeta',
    titolo: 'Come si guadagna velocità senza accendere niente',
    sommario: `Una sonda che passa vicino a un pianeta ne esce con la stessa velocità con cui è entrata —
      ma solo per chi guarda dal pianeta. Per chi guarda dal Sole la sonda è più veloce, e il pianeta
      un pochino più lento: la velocità non si crea, si prende in prestito. Guarda le due tele insieme,
      è tutta lì la differenza. Nella terza scheda ci sono i conti, uno per uno, con i tuoi numeri
      dentro.`,

    costruisci() {
      return `
        <div class="segmenti-cielo did-quadri" id="did-fionda-schede">
          <button type="button" class="tasto-segmento attiva" data-scheda="sim">Il banco di prova</button>
          <button type="button" class="tasto-segmento" data-scheda="conti">Come si calcola</button>
          <button type="button" class="tasto-segmento" data-scheda="voyager">Il Grand Tour delle Voyager</button>
        </div>

        <div id="did-fionda-sim">
          <div class="did-scene did-scene-due">
            <figure class="did-scena">
              <canvas id="did-fionda-pianeta" class="did-tela"></canvas>
              <figcaption class="did-targhetta">Visto dal pianeta — <em>entra ed esce alla stessa velocità</em></figcaption>
            </figure>
            <figure class="did-scena">
              <canvas id="did-fionda-sole" class="did-tela"></canvas>
              <figcaption class="did-targhetta">Visto dal Sole — <em>esce a una velocità diversa</em></figcaption>
            </figure>
          </div>

          <figure class="did-scena did-scena-bassa">
            <canvas id="did-fionda-vettori" class="did-tela"></canvas>
            <figcaption class="did-targhetta">Perché: la stessa somma, fatta due volte</figcaption>
          </figure>

          ${didBarra('did-fionda', { min: 0, max: 999, valore: 0, etichettaSlitta: 'Scorri il passaggio' })}

          <div class="did-riga">
            <div class="segmenti-cielo" id="did-fionda-corpi">
              ${Object.keys(FIONDA_PIANETI).map(k => `<button type="button" class="tasto-segmento${k === 'Jupiter' ? ' attiva' : ''}" data-pianeta="${k}">${FIONDA_PIANETI[k].nome}</button>`).join('')}
            </div>
          </div>

          <div class="did-riga">
            <label class="did-etichetta" for="did-fionda-b">Quanto passa lontano, e da che parte</label>
            <span class="did-valore" id="did-fionda-b-val">15 raggi, dietro</span>
          </div>
          <input id="did-fionda-b" class="did-slitta did-slitta-larga" type="range" min="-40" max="40" step="0.5" value="15">

          <div class="did-riga">
            <label class="did-etichetta" for="did-fionda-v">Con che velocità arriva (rispetto al pianeta)</label>
            <span class="did-valore" id="did-fionda-v-val">10,0 km/s</span>
          </div>
          <input id="did-fionda-v" class="did-slitta did-slitta-larga" type="range" min="2" max="25" step="0.5" value="10">

          ${didLetture([
            { id: 'did-fionda-prima', nome: 'Velocità prima (dal Sole)', forte: true },
            { id: 'did-fionda-dopo', nome: 'Velocità dopo (dal Sole)', forte: true },
            { id: 'did-fionda-guadagno', nome: 'Guadagno netto', forte: true },
            { id: 'did-fionda-dev', nome: 'Di quanto viene piegata (δ)' },
            { id: 'did-fionda-peri', nome: 'Passaggio più stretto' },
            { id: 'did-fionda-vperi', nome: 'Quanto va forte là in mezzo' },
            { id: 'did-fionda-max', nome: 'Il massimo da questa rotta' }
          ])}

          <p class="did-spiega" id="did-fionda-spiega">—</p>
          <p class="did-nota">Arrivando di traverso alla corsa del pianeta — come qui — il massimo non si
            ottiene con la deviazione più forte possibile ma con una deviazione di <strong>90°</strong>, e
            vale <em>v∞ + V − √(v∞² + V²)</em>: piegare di più vuol dire ributtare indietro velocità appena
            guadagnata. Il tetto assoluto, potendo scegliere anche da che parte arrivare, è due volte la più
            piccola fra la velocità della sonda e quella del pianeta. Ed è per questo che le fionde si fanno
            a Giove: non perché sia grosso, ma perché è grosso <em>e</em> si muove — Saturno pesa un terzo e
            viaggia più piano, e infatti rende meno.</p>
        </div>

        <div id="did-fionda-conti" class="hidden">
          <p class="did-spiega"><strong>Prima, senza formule.</strong> Tira una pallina contro un treno
            che ti viene incontro. Per il macchinista la pallina arriva a una certa velocità e rimbalza
            via con la stessa: il treno non se ne accorge nemmeno. Ma il treno, intanto, si è mosso — e
            per te che stai a bordo strada la pallina torna indietro con la sua velocità <em>più due
            volte</em> quella del treno. Non l'ha spinta nessuno: è cambiato chi guarda.
            La fionda gravitazionale è quella pallina. Il pianeta è il treno, e al posto della lamiera
            c'è la gravità: non tocca, ma piega — e per il resto il conto è identico.</p>

          <h4 class="did-sottotitolo">I cinque numeri che servono</h4>
          <p class="did-nota">Tre li dà il pianeta e stanno sulle tabelle; due li scegli tu, e sono le
            due slitte del banco di prova. Non serve altro: né la massa della sonda (non compare mai),
            né dove si trova il Sole.</p>
          <div class="did-dati" id="did-fionda-dati"></div>

          <h4 class="did-sottotitolo">Il conto, in sei passi</h4>
          <p class="did-nota">Sono i numeri che hai adesso sulle slitte: cambia una slitta nell'altra
            scheda e qui cambia tutto, riga per riga.</p>
          <div class="did-passi" id="did-fionda-passi"></div>

          <p class="did-spiega" id="did-fionda-tetto">—</p>

          <p class="did-nota">Due cose che stupiscono, e sono tutt'e due vere. <strong>La massa della
            sonda non compare</strong>: la fionda funziona identica per una sonda da una tonnellata e per
            un sasso, perché la gravità accelera tutti allo stesso modo. E <strong>l'energia si
            conserva</strong>: quella che la sonda guadagna il pianeta la perde, rallentando sulla propria
            orbita. Voyager 2 ha rubato a Giove tanta velocità da spostarlo — di circa un miliardesimo di
            miliardesimo di millimetro al secondo.</p>
        </div>

        <div id="did-fionda-voyager" class="hidden">
          <figure class="did-scena did-scena-tonda">
            <canvas id="did-voy-tela" class="did-tela"></canvas>
            <figcaption class="did-targhetta">Il Grand Tour, 1977 – 1990 · posizioni planetarie reali</figcaption>
          </figure>

          <p class="did-nota did-nota-gesto"><strong>Girala col dito</strong> (o col tasto dei gradi in alto
            a destra, o trascinando col mouse): vista a picco questa è una pianta, e la cosa più bella del
            viaggio non si vede. Mettila di taglio e guarda la <strong>Voyager 1 staccarsi dal piano dei
            pianeti</strong> dopo Saturno, e la 2 tuffarcisi sotto dopo Nettuno. Per <strong>avvicinarti</strong>:
            la rotella del mouse, due dita sullo schermo, due tocchi svelti, o il + tenuto premuto. Col ⛶ la
            scena si prende tutto lo schermo, barra del tempo compresa.</p>

          <figure class="did-scena did-scena-bassa">
            <canvas id="did-voy-grafico" class="did-tela"></canvas>
            <figcaption class="did-targhetta">La velocità rispetto al Sole, incontro dopo incontro</figcaption>
          </figure>

          ${didBarra('did-voy', { min: 1977, max: 1990.5, passo: 0.02, valore: 1977.6, etichettaSlitta: 'Scorri gli anni' })}

          <div class="did-linea-tempo" id="did-voy-linea"></div>

          ${didLetture([
            { id: 'did-voy-quando', nome: 'Siamo nel', forte: true },
            { id: 'did-voy-1', nome: 'Voyager 1 · velocità', forte: true },
            { id: 'did-voy-d1', nome: 'Voyager 1 · dov\'è' },
            { id: 'did-voy-2', nome: 'Voyager 2 · velocità', forte: true },
            { id: 'did-voy-d2', nome: 'Voyager 2 · dov\'è' },
            { id: 'did-voy-prossimo', nome: 'Prossimo incontro' }
          ])}

          <p class="did-spiega" id="did-voy-spiega">—</p>
          <p class="did-nota">Le posizioni dei quattro giganti sono quelle vere, calcolate anno per anno,
            <strong>z compresa</strong>: l'allineamento del Grand Tour — che si ripresenta una volta ogni
            176 anni — è quello che c'era davvero. Le date degli incontri, le distanze di massimo
            avvicinamento e le due inclinazioni di fuga (35° sopra il piano per la 1, 48° sotto per la 2)
            sono esatte. La traiettoria fra un incontro e l'altro è stilizzata — passa per i punti veri nei
            giorni veri, ma la curva che li unisce è disegnata — e i valori di velocità sono quelli
            indicativi ricostruiti dalle carte JPL.</p>
        </div>

        ${didPonti([
          { azione: 'tred', icona: 'saturno', testo: 'Dove sono oggi i giganti', titolo: 'Apre il Sistema Solare in 3D all\'istante di adesso' },
          { azione: 'cielo', icona: 'stella', testo: 'Guarda Giove stasera', titolo: 'Apre il planetario puntato su Giove' }
        ])}`;
    },

    collega() {
      const schede = $('did-fionda-schede');
      if (schede) schede.addEventListener('click', (e) => {
        const b = e.target.closest('[data-scheda]');
        if (!b) return;
        schede.querySelectorAll('[data-scheda]').forEach(x => x.classList.toggle('attiva', x === b));
        didPienoEsci();
        fionda.scheda = b.dataset.scheda;
        [['did-fionda-sim', 'sim'], ['did-fionda-conti', 'conti'], ['did-fionda-voyager', 'voyager']]
          .forEach(([id, quale]) => {
            const n = $(id);
            if (n) n.classList.toggle('hidden', fionda.scheda !== quale);
          });
        if (fionda.scheda === 'conti') fiondaConti();
      });

      collegaBarra('did-fionda', fionda, {
        suSlitta: (v) => { fionda.t = v / 1000; fiondaNumeri(); },
        suInizio: () => { fionda.t = 0; fiondaNumeri(); }
      });

      const corpi = $('did-fionda-corpi');
      if (corpi) corpi.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pianeta]');
        if (!b) return;
        corpi.querySelectorAll('[data-pianeta]').forEach(x => x.classList.toggle('attiva', x === b));
        fionda.pianeta = b.dataset.pianeta;
        fiondaCalcola();
      });

      const sb = $('did-fionda-b');
      if (sb) sb.addEventListener('input', (e) => { fionda.b = Number(e.target.value); fiondaCalcola(); });
      const sv = $('did-fionda-v');
      if (sv) sv.addEventListener('input', (e) => { fionda.vInf = Number(e.target.value); fiondaCalcola(); });

      // Anche col dito: si trascina sulla tela di sinistra per spostare il
      // punto di passaggio. È il gesto naturale — «passo un po' più in là» —
      // e insegna più di venti slitte
      const tela = $('did-fionda-pianeta');
      if (tela) {
        const muovi = (ev) => {
          const r = tela.getBoundingClientRect();
          // Il punto va letto attraverso la lente: se il disegno è
          // ingrandito, il pixel sotto il dito non è più il pixel del
          // disegno, e il punto di passaggio saltava via appena ci si
          // avvicinava per vederlo meglio
          const y = didLenteMondo('did-fionda-pianeta', 0,
            (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top).y;
          const q = (r.height / 2 - y) / (r.height / 2);   // da -1 a 1
          fionda.b = Math.max(-40, Math.min(40, Math.round(q * 40 * 2) / 2));
          const s = $('did-fionda-b'); if (s) s.value = String(fionda.b);
          fiondaCalcola();
          ev.preventDefault();
        };
        let giu = false;
        tela.addEventListener('pointerdown', (e) => { giu = true; tela.setPointerCapture(e.pointerId); muovi(e); });
        tela.addEventListener('pointermove', (e) => { if (giu) muovi(e); });
        tela.addEventListener('pointerup', () => { giu = false; });
        tela.addEventListener('pointercancel', () => { giu = false; });
      }

      collegaBarra('did-voy', { get marcia() { return fionda.voyMarcia; }, set marcia(v) { fionda.voyMarcia = v; },
        get velocita() { return fionda.voyVel; }, set velocita(v) { fionda.voyVel = v; } }, {
        suSlitta: (v) => { fionda.voyAnno = v; voyNumeri(); },
        suInizio: () => { fionda.voyAnno = 1977; voySlitta(); voyNumeri(); }
      });

      collegaPonti('fionda', (azione) => {
        if (azione === 'tred') didVaiInTreD(didAdesso());
        else didVaiInCielo(didAdesso(), 'Jupiter');
      });
    },

    entra() {
      if (!fionda.traiettoria) fiondaCalcola();
      alterna('did-fionda', fionda.marcia);
      alterna('did-voy', fionda.voyMarcia);
      // La linea del tempo si costruisce qui e non in `collega()`: ha
      // bisogno delle posizioni dei pianeti, e quelle arrivano da
      // Astronomy Engine, che alla costruzione del banco può non esserci
      // ancora
      voyCostruisciLinea();
      voyNumeri();
      fiondaConti();
    },

    passo(dt) {
      if (fionda.scheda === 'conti') return;   // qui non cammina niente: sono conti
      if (fionda.scheda === 'sim') {
        if (!fionda.marcia) return;
        fionda.t += dt * 0.16 * fionda.velocita;
        if (fionda.t > 1) fionda.t = 0;
        const s = $('did-fionda-slitta'); if (s) s.value = String(Math.round(fionda.t * 1000));
        fiondaNumeri();
      } else {
        if (!fionda.voyMarcia) return;
        fionda.voyAnno += dt * 0.55 * fionda.voyVel;
        if (fionda.voyAnno > 1990.5) fionda.voyAnno = 1977;
        voySlitta();
        voyNumeri();
      }
    },

    disegna() {
      if (fionda.scheda === 'sim') { fiondaDisegnaPianeta(); fiondaDisegnaSole(); fiondaDisegnaVettori(); }
      else if (fionda.scheda === 'voyager') { voyDisegnaMappa(); voyDisegnaGrafico(); }
    }
  });

  // -------------------------------------------------------------- i conti
  //
  // Tutta la fionda sta in cinque righe di formule, e vale la pena tenerle
  // separate dal disegno: sono loro che il pannello «Come si calcola»
  // mostra, e sono loro che rispondono senza integrare niente.
  //
  //   a  = μ / v∞²              il semiasse dell'iperbole
  //   e  = √(1 + (b/a)²)        l'apertura — b è il parametro d'impatto
  //   δ  = 2·arcsin(1/e)        di quanto la traiettoria viene piegata
  //   rp = a·(e − 1)            il passaggio più stretto
  //   vp = √(v∞² + 2μ/rp)       quanto va forte là in mezzo
  //
  // Attenzione a un inciampo che c'era e ha resistito a lungo: la formula
  // scritta qui sopra vuole il **parametro d'impatto**, e la sua sorella
  // `e = 1 + rp·v∞²/μ` vuole il **perielio**. Mescolarle — usare b dentro
  // alla seconda — dà un numero perfettamente plausibile e completamente
  // sbagliato: per Giove a 15 raggi con 10 km/s diceva 66° dove la
  // traiettoria ne fa 101. Il controllo vero è il perielio: quello che
  // esce dalla formula e quello che misura l'integrazione devono
  // coincidere alla terza cifra, e adesso lo fanno.
  function fiondaIperbole(P, bRaggi, vInf) {
    const b = Math.abs(bRaggi) * P.raggio;
    const a = P.mu / (vInf * vInf);
    const e = Math.sqrt(1 + (b / a) * (b / a));
    const peri = a * (e - 1);
    return {
      b, a, e, peri,
      verso: bRaggi >= 0 ? 1 : -1,        // dietro (+) o davanti (−) al pianeta
      h: b * vInf,                        // momento angolare per unità di massa
      dev: 2 * Math.asin(1 / e),          // radianti
      vPeri: Math.sqrt(vInf * vInf + 2 * P.mu / peri)
    };
  }

  // Lo stato di partenza, preso **sull'iperbole** e non a occhio.
  //
  // La prima versione metteva la sonda in (−d, −b) con velocità (v∞, 0),
  // cioè la appoggiava sull'asintoto invece che sull'orbita, e a quel
  // punto né v∞ né b erano più quelli chiesti: a 220 raggi da Giove la
  // velocità di caduta è già il 4% in più, e il parametro d'impatto vero
  // (h/v∞) usciva di un raggio e mezzo più largo. Qui si fa il contrario:
  // si parte dalla coppia (v∞, b) che l'utente ha scelto, si scrive
  // l'orbita che ne segue, e si va a prendere il punto in cui quell'orbita
  // passa a distanza `d`. Così i numeri del pannello dei conti e la curva
  // disegnata parlano dello stesso volo.
  function fiondaPartenza(P, ip, d) {
    const p = ip.a * (ip.e * ip.e - 1);
    // anomalia vera alla distanza d, sul ramo in arrivo (negativa)
    const nu = -Math.acos(Math.max(-1, Math.min(1, (p / d - 1) / ip.e)));
    const k = P.mu / ip.h;
    const px = d * Math.cos(nu), py = d * Math.sin(nu);
    const pvx = -k * Math.sin(nu), pvy = k * (ip.e + Math.cos(nu));
    // Si gira tutto perché l'asintoto d'arrivo sia orizzontale: la sonda
    // deve entrare da sinistra, che è come la guarda il disegno
    const nuInf = Math.acos(-1 / ip.e);
    const th = Math.atan2(ip.e - 1 / ip.e, Math.sin(nuInf));
    const c = Math.cos(-th), s = Math.sin(-th);
    return {
      x: c * px - s * py,
      y: ip.verso * (s * px + c * py),
      vx: c * pvx - s * pvy,
      vy: ip.verso * (s * pvx + c * pvy)
    };
  }

  // Il passaggio si calcola una volta sola quando cambiano i comandi, non
  // a ogni fotogramma: qualche migliaio di passi di integrazione sono
  // niente da fare una volta e sono troppi da fare sessanta volte al
  // secondo. Dopo, il tempo che cammina si limita a leggere il punto
  // dell'istante — e la slitta può scorrere avanti e indietro senza che la
  // sonda «derivi».
  function fiondaCalcola() {
    const P = FIONDA_PIANETI[fionda.pianeta];
    const v0 = fionda.vInf;
    const ip = fiondaIperbole(P, fionda.b, v0);

    // Si parte abbastanza lontano perché il pianeta conti poco, ma non
    // così lontano da passare metà del filmato in mezzo al niente
    const dIniziale = Math.max(ip.b * 6, P.raggio * 220, ip.peri * 6);
    const p0 = fiondaPartenza(P, ip, dIniziale);
    let { x, y, vx, vy } = p0;
    const punti = [{ x, y, vx, vy, t: 0 }];
    let t = 0, peri = Infinity, schianto = false;
    let ux = x, uy = y;                       // ultimo punto messo da parte
    const passoDisegno = dIniziale / 500;     // ogni quanto salvare un punto

    // Il passo si accorcia avvicinandosi: lontano non succede niente e un
    // passo lungo va benissimo, al perielio la sonda gira di novanta gradi
    // in poche ore e un passo lungo tagliava la curva — il perielio usciva
    // più largo del vero e la deviazione più debole
    const passoBase = dIniziale / v0 / 900;
    for (let i = 0; i < 60000; i++) {
      // Velocity-Verlet: conserva l'energia molto meglio di Eulero, e su
      // un'iperbole si vede subito — con Eulero la sonda usciva più lenta
      // di quanto era entrata anche nel riferimento del pianeta, che è
      // proprio la cosa che questo esperimento deve smentire
      const r2 = x * x + y * y;
      const r = Math.sqrt(r2);
      peri = Math.min(peri, r);
      if (r < P.raggio) { schianto = true; break; }
      const dt = Math.max(0.5, passoBase * Math.pow(r / dIniziale, 1.5));
      const a = -P.mu / (r2 * r);
      const ax = a * x, ay = a * y;
      const xn = x + vx * dt + 0.5 * ax * dt * dt;
      const yn = y + vy * dt + 0.5 * ay * dt * dt;
      const rn2 = xn * xn + yn * yn;
      const rn = Math.sqrt(rn2);
      const an = -P.mu / (rn2 * rn);
      vx += 0.5 * (ax + an * xn) * dt;
      vy += 0.5 * (ay + an * yn) * dt;
      x = xn; y = yn;
      t += dt;
      // I punti si mettono da parte a distanza, non a numero di passi: la
      // curva disegnata vuole punti fitti uguale dappertutto, e col passo
      // che si accorcia vicino al pianeta «uno ogni sei» ne avrebbe
      // ammucchiati mille sul perielio e dieci sulle due gambe dritte
      if (Math.hypot(x - ux, y - uy) > passoDisegno) {
        punti.push({ x, y, vx, vy, t });
        ux = x; uy = y;
      }
      // Si smette quando si è tornati lontani **e** ci si sta
      // allontanando. La prima versione chiedeva anche `x > 0`, e con una
      // deviazione forte — che è il caso interessante — la sonda esce
      // all'indietro e quella condizione non si avverava mai: il ciclo
      // andava fino in fondo ai passi disponibili e la velocità finale era
      // presa chissà dove.
      if (r > dIniziale && (x * vx + y * vy) > 0) break;
    }
    punti.push({ x, y, vx, vy, t });

    // Le velocità **da lontano**, che sono quelle di cui parla la fionda:
    // in arrivo (v∞, 0), in uscita la stessa ruotata di δ. Il verso della
    // rotazione lo dà la parte da cui si passa, ed è tutta lì la
    // differenza fra guadagnare e restituire.
    const dev = ip.dev;
    const vIn = { x: v0, y: 0 };
    const vOut = { x: v0 * Math.cos(dev), y: ip.verso * v0 * Math.sin(dev) };

    // Nel riferimento del Sole: si somma la velocità del pianeta. Il
    // pianeta va lungo +y, la sonda arriva lungo +x — così la geometria
    // «davanti/dietro» è quella dei libri e il segno del parametro
    // d'impatto decide se si guadagna o si perde.
    const V = P.vOrb;
    const primaSole = Math.hypot(vIn.x, vIn.y + V);
    const dopoSole = Math.hypot(vOut.x, vOut.y + V);

    fionda.traiettoria = {
      punti, schianto, dev: dev * GRADI, ecc: ip.e, semiasse: ip.a,
      bKm: ip.b, verso: ip.verso, vInf: v0, vIn, vOut,
      peri: schianto ? peri : ip.peri,
      periRaggi: (schianto ? peri : ip.peri) / P.raggio,
      periInt: peri, vPeri: ip.vPeri,
      primaSole, dopoSole,
      guadagno: dopoSole - primaSole,
      // Il salto della velocità *relativa al pianeta*: la corda dell'arco
      // di cerchio percorso dalla punta del vettore. È lo stesso numero in
      // tutti e due i riferimenti, ed è il massimo che si può spostare
      dvRel: 2 * v0 * Math.sin(dev / 2),
      // Il massimo di questa rotta: arrivando di traverso, prima vale
      // sempre √(v∞²+V²) e dopo al più v∞+V, cioè con δ = 90°
      max: v0 + V - Math.hypot(v0, V),
      // Il massimo assoluto, potendo scegliere anche da dove arrivare
      maxAssoluto: 2 * Math.min(v0, V),
      tTot: t,
      vOrb: V,
      raggio: P.raggio,
      mu: P.mu,
      colore: P.colore,
      nome: P.nome,
      muTesto: P.muTesto
    };
    fionda.t = 0;
    const s = $('did-fionda-slitta'); if (s) s.value = '0';
    fiondaNumeri();
  }

  // Il punto dell'istante mostrato. Si cerca **per tempo**, non per
  // indice: i punti sono equidistanti nello spazio, e la sonda quello
  // spazio non lo percorre a velocità costante — scorrendo per indice si
  // vedeva la sonda rallentare proprio al perielio, cioè fare il
  // contrario di quello che fa.
  function fiondaPunto() {
    const tr = fionda.traiettoria;
    if (!tr || !tr.punti.length) return null;
    const pu = tr.punti;
    const t = fionda.t * tr.tTot;
    let lo = 0, hi = pu.length - 1;
    while (lo < hi - 1) {
      const m = (lo + hi) >> 1;
      if (pu[m].t <= t) lo = m; else hi = m;
    }
    const a = pu[lo], b = pu[hi];
    const f = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 0;
    return {
      x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f,
      vx: a.vx + (b.vx - a.vx) * f, vy: a.vy + (b.vy - a.vy) * f, t
    };
  }

  function fiondaNumeri() {
    const tr = fionda.traiettoria;
    if (!tr) return;
    const bv = $('did-fionda-b-val');
    if (bv) bv.textContent = fionda.b === 0 ? 'in rotta di collisione'
      : `${num(Math.abs(fionda.b), 1)} raggi, ${fionda.b > 0 ? 'dietro al pianeta' : 'davanti al pianeta'}`;
    const vv = $('did-fionda-v-val');
    if (vv) vv.textContent = `${num(fionda.vInf, 1)} km/s`;

    if (tr.schianto) {
      scrivi('did-fionda-prima', `${num(tr.primaSole, 2)} km/s`);
      scrivi('did-fionda-dopo', 'schiantata sul pianeta', 'rosso');
      scrivi('did-fionda-guadagno', '—', 'rosso');
      scrivi('did-fionda-dev', '—');
      scrivi('did-fionda-peri', 'impatto');
      scrivi('did-fionda-vperi', '—');
      scrivi('did-fionda-max', `+ ${num(tr.max, 2)} km/s`);
      const sp = $('did-fionda-spiega');
      if (sp) sp.innerHTML = `Troppo stretto: la sonda ha colpito ${tr.nome}. È il limite vero della fionda —
        più si passa vicino più si viene deviati, ma sotto la superficie non si passa. La formula lo dice
        prima ancora di provare: il perielio <em>r<sub>p</sub> = a·(e − 1)</em> viene
        ${num(tr.periRaggi, 2)} raggi, e il pianeta ne occupa uno. Allarga il parametro d'impatto.`;
      fiondaConti();
      return;
    }

    scrivi('did-fionda-prima', `${num(tr.primaSole, 2)} km/s`);
    scrivi('did-fionda-dopo', `${num(tr.dopoSole, 2)} km/s`, tr.guadagno >= 0 ? 'verde' : 'rosso');
    scrivi('did-fionda-guadagno', `${tr.guadagno >= 0 ? '+' : '−'}${num(Math.abs(tr.guadagno), 2)} km/s`,
      tr.guadagno >= 0 ? 'verde' : 'rosso');
    scrivi('did-fionda-dev', `${num(tr.dev, 1)}°`);
    scrivi('did-fionda-peri', `${num(tr.periRaggi, 1)} raggi di ${tr.nome} · ${numMila(tr.peri)} km`);
    scrivi('did-fionda-vperi', `${num(tr.vPeri, 1)} km/s`);
    scrivi('did-fionda-max', `+ ${num(tr.max, 2)} km/s (con δ = 90°)`);
    const p = fiondaPunto();
    const lettura = $('did-fionda-lettura');
    if (lettura && p) lettura.textContent = `${num(p.t / 86400, 1)} g`;
    fiondaConti();

    const sp = $('did-fionda-spiega');
    if (!sp) return;
    const resa = Math.abs(tr.guadagno) / tr.max * 100;
    sp.innerHTML = tr.guadagno >= 0
      ? `La sonda è passata <strong>dietro</strong> a ${tr.nome}, cioè dalla parte da cui il pianeta se ne
         sta andando: si è fatta trascinare, ed è uscita con <strong>${num(tr.guadagno, 2)} km/s in più</strong>
         rispetto al Sole — il ${num(resa, 0)}% di tutto quello che ${tr.nome} potrebbe darle.
         Nelle due tele qui sopra la sonda è la stessa: a sinistra entra ed esce a ${num(fionda.vInf, 1)} km/s,
         a destra entra a ${num(tr.primaSole, 2)} ed esce a ${num(tr.dopoSole, 2)}. Nessuna delle due sbaglia:
         cambia chi guarda. Il conto torna perché ${tr.nome} ha perso esattamente altrettanta energia — solo
         che pesa 10²⁴ volte più della sonda, e non se ne accorge nessuno.`
      : `La sonda è passata <strong>davanti</strong> a ${tr.nome}, cioè si è messa sulla sua strada: le ha
         restituito <strong>${num(Math.abs(tr.guadagno), 2)} km/s</strong>. Sembra uno spreco, e invece è
         una manovra normalissima: per andare verso il Sole — Parker Solar Probe, BepiColombo — bisogna
         <em>frenare</em>, e frenare con i motori costerebbe molto più propellente di quanto se ne possa
         portare. Prova a mandare la sonda dall'altra parte, e il segno cambia.`;
  }

  // ------------------------------------------- «Come si calcola», dal vivo
  //
  // Le stesse formule di `fiondaIperbole`, ma scritte con dentro i numeri
  // che ci sono adesso sulle slitte. È la differenza fra leggere
  // «δ = 2·arcsin(1/e)» e vedere che con Giove, quindici raggi e dieci
  // km/s viene centouno gradi: la formula da sola non convince nessuno,
  // la formula col proprio caso dentro sì.
  //
  // Si ricostruisce solo quando la scheda è a schermo: girando la slitta
  // del parametro d'impatto `fiondaCalcola` gira decine di volte al
  // secondo, e riscrivere due dozzine di nodi che nessuno sta guardando è
  // lavoro buttato.
  function fiondaConti() {
    if (fionda.scheda !== 'conti') return;
    const tr = fionda.traiettoria;
    const dati = $('did-fionda-dati'), passi = $('did-fionda-passi'), tetto = $('did-fionda-tetto');
    if (!tr || !dati || !passi) return;
    const v0 = tr.vInf, V = tr.vOrb;

    const riga = (simbolo, nome, valore, nota) => `
      <div class="did-dato">
        <span class="did-dato-simbolo">${simbolo}</span>
        <span class="did-dato-nome">${nome}</span>
        <strong class="did-dato-valore">${valore}</strong>
        <span class="did-dato-nota">${nota}</span>
      </div>`;

    dati.innerHTML =
      riga('μ', `Quanto tira ${tr.nome}`, `${tr.muTesto} km³/s²`,
        `La massa del pianeta moltiplicata per la costante di gravitazione. Si usa sempre il prodotto,
         mai i due numeri separati: è lui che si misura davvero, guardando una luna girare.`) +
      riga('R', `Il raggio di ${tr.nome}`, `${numMila(tr.raggio)} km`,
        'Il muro: sotto non si passa, e infatti è lui a mettere il limite a tutta la manovra.') +
      riga('V', `Quanto corre ${tr.nome}`, `${num(V, 2)} km/s`,
        'La velocità con cui il pianeta gira attorno al Sole. È da qui che si ruba: un pianeta fermo non regalerebbe niente.') +
      riga('v∞', 'Con che velocità arriva la sonda', `${num(v0, 1)} km/s`,
        `Misurata <em>dal pianeta</em> e <em>da lontano</em>: la velocità che la sonda avrebbe se il pianeta
         non la tirasse. Arrivandogli addosso va già più forte — a bordo campo, in questo caso,
         ${num(Math.sqrt(v0 * v0 + 2 * tr.mu / Math.max(1, tr.raggio * 220)), 1)} km/s.`) +
      riga('b', 'Di quanto lo manca', `${num(Math.abs(fionda.b), 1)} raggi = ${numMila(tr.bKm)} km`,
        `Il <em>parametro d'impatto</em>: quanto la sonda mancherebbe il centro del pianeta se la gravità
         non la piegasse. Non è la distanza a cui passa davvero — quella viene dopo, ed è più piccola.`);

    const passo = (n, titolo, formula, conto, esito, spiega) => `
      <div class="did-passo">
        <span class="did-passo-numero">${n}</span>
        <div class="did-passo-corpo">
          <span class="did-passo-titolo">${titolo}</span>
          <code class="did-formula">${formula}</code>
          <code class="did-conto">${conto} <strong>= ${esito}</strong></code>
          <span class="did-passo-nota">${spiega}</span>
        </div>
      </div>`;

    const dev = tr.dev;
    passi.innerHTML =
      passo(1, 'Quanto pesa la gravità rispetto alla corsa',
        'a = μ / v∞²',
        `${tr.muTesto} / ${num(v0, 1)}²`, `${numMila(tr.semiasse)} km (${num(tr.semiasse / tr.raggio, 1)} raggi)`,
        `È il semiasse dell'iperbole, e si legge come un metro di paragone: se <em>b</em> è molto più
         piccolo di <em>a</em>, la sonda entra nel campo del pianeta e ne esce girata; se è molto più
         grande, tira dritto. Qui b/a vale ${num(tr.bKm / tr.semiasse, 2)}.`) +
      passo(2, 'Quanto è aperta la curva',
        'e = √(1 + (b/a)²)',
        `√(1 + ${num(tr.bKm / tr.semiasse, 3)}²)`, num(tr.ecc, 3),
        `L'eccentricità. Sotto 1 sarebbe un'orbita chiusa e la sonda resterebbe prigioniera del pianeta;
         qui è sempre sopra 1 — la sonda passa e se ne va. Più <em>e</em> è vicino a 1, più la curva è
         stretta attorno al pianeta.`) +
      passo(3, 'Di quanto viene piegata — è il numero che conta',
        'sin(δ/2) = 1/e   →   δ = 2 · arcsin(1/e)',
        `2 · arcsin(1 / ${num(tr.ecc, 3)})`, `${num(dev, 1)}°`,
        `<strong>δ è tutta la manovra.</strong> La gravità non cambia di un centesimo la velocità della
         sonda rispetto al pianeta: le gira soltanto la freccia, di questi gradi. Tutto quello che segue
         è conseguenza di questa rotazione.`) +
      passo(4, 'Quanto passa vicino davvero',
        'r_p = a · (e − 1)',
        `${numMila(tr.semiasse)} · (${num(tr.ecc, 3)} − 1)`,
        `${numMila(tr.peri)} km (${num(tr.periRaggi, 2)} raggi)`,
        `Il passaggio più stretto. Se viene meno di R la sonda non passa: si schianta, e la manovra non
         esiste. È questo il vero limite della fionda, non la fisica.`) +
      passo(5, 'Quanto va forte là in mezzo',
        'v_p = √(v∞² + 2μ / r_p)',
        `√(${num(v0, 1)}² + 2 · ${tr.muTesto} / ${numMila(tr.peri)})`, `${num(tr.vPeri, 2)} km/s`,
        `Conservazione dell'energia, niente di più. Cadendo verso il pianeta la sonda accelera fino a
         qui; risalendo restituisce tutto e torna a ${num(v0, 1)} km/s. È il motivo per cui, <em>per il
         pianeta</em>, il bilancio è zero.`) +
      passo(6, 'La stessa cosa, guardata dal Sole',
        'v_prima = √(v∞² + V²)   ·   v_dopo = √(v∞² + V² + 2·v∞·V·sin δ)',
        `√(${num(v0, 1)}² + ${num(V, 2)}² ${tr.verso > 0 ? '+' : '−'} 2·${num(v0, 1)}·${num(V, 2)}·sin ${num(dev, 1)}°)`,
        `${num(tr.dopoSole, 2)} km/s, contro i ${num(tr.primaSole, 2)} di prima`,
        `Nessuna formula nuova: è la somma di due frecce, fatta prima e dopo. La sonda arriva di traverso
         alla corsa del pianeta, e per questo prima vale sempre √(v∞²+V²). Passando
         <strong>${tr.verso > 0 ? 'dietro' : 'davanti'}</strong> la rotazione porta la freccia
         ${tr.verso > 0 ? 'dalla parte in cui il pianeta viaggia, e le due si sommano' :
           'contro la corsa del pianeta, e le due si sottraggono'}:
         <strong>${tr.guadagno >= 0 ? '+' : '−'}${num(Math.abs(tr.guadagno), 2)} km/s</strong>.`);

    if (tetto) {
      tetto.innerHTML = `<strong>E il tetto?</strong> La punta della freccia relativa gira su un cerchio,
        quindi il salto più grande possibile della velocità è la corda di quel cerchio:
        <em>Δv = 2·v∞·sin(δ/2)</em> = ${num(tr.dvRel, 2)} km/s. Ma non tutto quel salto diventa velocità
        in più rispetto al Sole: dipende da dove punta. Con questa rotta d'arrivo il massimo si ottiene
        con <strong>δ = 90°</strong> e vale <em>v∞ + V − √(v∞² + V²)</em> =
        <strong>${num(tr.max, 2)} km/s</strong>; ${tr.schianto ? 'adesso però la sonda non passa proprio'
          : tr.guadagno >= 0 ? `adesso ne stai prendendo ${num(tr.guadagno / tr.max * 100, 0)}%`
          : `adesso invece stai frenando di ${num(-tr.guadagno, 2)} km/s, ed è un limite che non c'è —
             perdere si può perdere quanto si vuole, fino a fermarsi`}. Potendo scegliere anche da che parte arrivare,
        il limite invalicabile è due volte la più piccola fra v∞ e V, cioè
        ${num(tr.maxAssoluto, 1)} km/s: più di così un pianeta non può dare, per quanto lo si sfiori.`;
    }
  }

  function fiondaDisegnaPianeta() {
    const t = didTela('did-fionda-pianeta', 1.1, 340, { lente: true, gira: true, trascina: false, pieno: true });
    if (!t || !fionda.traiettoria) return;
    const { ctx, L, H } = t;
    didSfondo(ctx, L, H);
    const tr = fionda.traiettoria;

    // L'inquadratura sta stretta sull'incontro, non su tutta la corsa: la
    // sonda arriva da centoventi raggi di distanza, e inquadrando quelli
    // il pianeta diventa un puntino e la curva una retta. Qui si guarda
    // la piega, quindi si inquadra la piega; le due gambe dritte escono
    // dai bordi e va bene così.
    const maxR = Math.max(tr.peri * 6, tr.raggio * 12, Math.abs(fionda.b) * tr.raggio * 2.4);
    const scala = Math.min(L * 0.46, H * 0.46) / maxR;
    const cx = L / 2, cy = H / 2;
    const X = (x) => cx + x * scala;
    const Y = (y) => cy - y * scala;

    // La ragnatela del campo: cerchi a distanza crescente, per far vedere
    // che la gravità c'è ovunque ma conta solo vicino
    for (let k = 1; k <= 4; k++) {
      didCerchio(ctx, cx, cy, tr.raggio * scala * Math.pow(3, k), 'rgba(148, 168, 214, 0.07)', 1, [3, 6]);
    }

    didPercorso(ctx, tr.punti.map(p => ({ x: X(p.x), y: Y(p.y) })), { colore: 'rgba(138, 180, 255, 0.45)', spessore: 1.6 });

    const raggioPx = Math.max(6, tr.raggio * scala);
    didCorpo(ctx, cx, cy, raggioPx, tr.colore, { alone: 2.4, anelli: fionda.pianeta === 'Saturn' });
    didScritta(ctx, tr.nome, cx, cy, { colore: C.testo2, misura: 11, allinea: 'center', dy: raggioPx + 15 });

    const p = fiondaPunto();
    if (p) {
      const v = Math.hypot(p.vx, p.vy);
      didFreccia(ctx, X(p.x), Y(p.y), X(p.x) + p.vx / v * 34, Y(p.y) - p.vy / v * 34,
        { colore: C.verde, spessore: 2.2, punta: 8 });
      didCorpo(ctx, X(p.x), Y(p.y), 4.5, '#ffffff', { alone: 2.6 });
      didScritta(ctx, `${num(v, 2)} km/s`, X(p.x), Y(p.y),
        { colore: C.verde, misura: 11, peso: 700, mono: true, dx: 8, dy: -12 });
    }
    // Va detto con precisione, se no il numero che cammina sembra
    // smentire la targhetta: cadendo verso il pianeta la sonda accelera
    // (a cinque raggi da Giove va a ventisette km/s), risalendo
    // restituisce tutto. Quello che non cambia è la velocità **da
    // lontano**, cioè v∞: entra e esce con quella, identica.
    didScritta(ctx, `entra a ${num(tr.vInf, 2)}  ·  esce a ${num(tr.vInf, 2)} km/s  ·  piegata di ${num(tr.dev, 1)}°`,
      12, 20, { colore: C.testo2, misura: 10, peso: 700, mono: true, schermo: true });
    didScritta(ctx, `in mezzo accelera cadendo fino a ${num(tr.vPeri, 1)} km/s e rallenta risalendo: si riprende tutto`,
      12, 35, { colore: C.testo3, misura: 9, peso: 500, schermo: true });
  }

  function fiondaDisegnaSole() {
    const t = didTela('did-fionda-sole', 1.1, 340, { lente: true, gira: true, pieno: true });
    if (!t || !fionda.traiettoria) return;
    const { ctx, L, H } = t;
    didSfondo(ctx, L, H);
    const tr = fionda.traiettoria;
    const V = tr.vOrb;

    // Nel riferimento del Sole il pianeta si muove, e la stessa
    // traiettoria diventa una curva aperta che entra con una pendenza ed
    // esce con un'altra: è quella la cosa da vedere. Il centro sta a metà
    // dell'incontro, e i due assi si scalano separatamente perché la
    // scena è molto più alta che larga (il pianeta, nel frattempo, ha
    // percorso la sua strada).
    const maxT = tr.punti[tr.punti.length - 1].t;
    const tMed = maxT / 2;
    let maxX = tr.raggio * 8, maxY = tr.raggio * 8;
    tr.punti.forEach(p => {
      maxX = Math.max(maxX, Math.abs(p.x));
      maxY = Math.max(maxY, Math.abs(p.y + V * (p.t - tMed)));
    });
    const scala = Math.min(L * 0.44 / maxX, H * 0.44 / maxY);
    const cx = L * 0.5, cy = H * 0.5;
    const X = (p) => cx + p.x * scala;
    const Y = (p, tt) => cy - (p.y + V * (tt - tMed)) * scala;

    didPercorso(ctx, tr.punti.map(p => ({ x: X(p), y: Y(p, p.t) })),
      { colore: 'rgba(245, 181, 68, 0.5)', spessore: 1.8 });

    // La strada del pianeta
    ctx.strokeStyle = didVela(tr.colore, 0.28);
    ctx.lineWidth = 1.2; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(cx, H); ctx.lineTo(cx, 0); ctx.stroke();
    ctx.setLineDash([]);

    const p = fiondaPunto();
    const raggioPx = Math.max(5, tr.raggio * scala);
    if (p) {
      const py = cy - (V * (p.t - tMed)) * scala;
      didCorpo(ctx, cx, py, raggioPx, tr.colore, { alone: 2.2, anelli: fionda.pianeta === 'Saturn' });
      didFreccia(ctx, cx, py, cx, py - 26, { colore: didVela(tr.colore, 0.9), spessore: 1.8, punta: 7 });

      const vsx = p.vx, vsy = p.vy + V;
      const v = Math.hypot(vsx, vsy);
      const px = X(p), pyS = Y(p, p.t);
      didFreccia(ctx, px, pyS, px + vsx / v * 38, pyS - vsy / v * 38, { colore: C.verde, spessore: 2.4, punta: 9 });
      didCorpo(ctx, px, pyS, 4.5, '#ffffff', { alone: 2.6 });
      didScritta(ctx, `${num(v, 2)} km/s`, px, pyS,
        { colore: C.verde, misura: 11, peso: 700, mono: true, dx: 9, dy: -12 });
    }
    didScritta(ctx, `entra a ${num(tr.primaSole, 2)}  ·  esce a ${num(tr.dopoSole, 2)} km/s`, 12, 20,
      { colore: tr.guadagno >= 0 ? C.verde : C.rosso, misura: 10, peso: 700, mono: true, schermo: true });
    didScritta(ctx, `${tr.guadagno >= 0 ? '+' : '−'}${num(Math.abs(tr.guadagno), 2)} km/s, e nessuno ha acceso niente`,
      12, 35, { colore: C.testo3, misura: 9, peso: 500, schermo: true });
  }

  // Il triangolo dei vettori. Stava schiacciato in un angolo della tela
  // del Sole, sopra alla traiettoria, e non si leggeva: è la figura che
  // spiega l'intero esperimento, quindi ha una tela sua. Due somme
  // affiancate — prima e dopo — con lo stesso lato in comune (la velocità
  // del pianeta) e i due lati relativi lunghi uguali: si vede a occhio
  // che ruotano soltanto, e che le risultanti no.
  function fiondaDisegnaVettori() {
    const t = didTela('did-fionda-vettori', 2.6, 270, { lente: true });
    if (!t || !fionda.traiettoria) return;
    const { ctx, L, H } = t;
    ctx.fillStyle = '#070b16';
    ctx.fillRect(0, 0, L, H);
    const tr = fionda.traiettoria;
    if (tr.schianto) {
      didScritta(ctx, 'La sonda non è mai uscita: nessun vettore da sommare.', L / 2, H / 2,
        { colore: C.testo3, misura: 12, allinea: 'center', peso: 600 });
      return;
    }
    const V = tr.vOrb;
    // Le due frecce relative sono quelle **da lontano** — v∞ prima, la
    // stessa ruotata di δ dopo — e non i vettori all'ultimo punto
    // calcolato: a bordo campo la sonda è già un po' caduta verso il
    // pianeta, e il disegno mostrerebbe due frecce lunghe diverse proprio
    // nella figura che deve far vedere che sono uguali
    const a = tr.vIn, b = tr.vOut;
    const vMax = Math.max(tr.primaSole, tr.dopoSole, V + tr.vInf) || 1;
    const k = Math.min(L * 0.20, H * 0.40) / vMax;

    const disegna = (ox, oy, p, colore, titolo, valore) => {
      // la velocità del pianeta (il lato in comune)
      didFreccia(ctx, ox, oy, ox, oy - V * k, { colore: didVela(tr.colore, 0.95), spessore: 2.2, punta: 8 });
      // la velocità rispetto al pianeta, appoggiata in cima
      didFreccia(ctx, ox, oy - V * k, ox + p.x * k, oy - V * k - p.y * k,
        { colore: 'rgba(138, 180, 255, 0.95)', spessore: 2, punta: 7 });
      // la risultante: quella che si misura dal Sole
      didFreccia(ctx, ox, oy, ox + p.x * k, oy - V * k - p.y * k, { colore, spessore: 2.6, punta: 10 });
      didScritta(ctx, titolo, ox, oy + 20, { colore: C.testo2, misura: 11, allinea: 'center', peso: 700 });
      didScritta(ctx, valore, ox, oy + 36, { colore, misura: 12, allinea: 'center', peso: 700, mono: true });
    };

    const y = H * 0.72;
    disegna(L * 0.27, y, a, 'rgba(169, 180, 204, 0.95)', 'prima dell\'incontro', `${num(tr.primaSole, 2)} km/s`);
    disegna(L * 0.73, y, b, tr.guadagno >= 0 ? C.verde : C.rosso, 'dopo l\'incontro', `${num(tr.dopoSole, 2)} km/s`);

    // La legenda: tre righe, tre colori, e si smette di indovinare
    const voci = [
      [didVela(tr.colore, 0.95), `velocità di ${tr.nome} (${num(V, 1)} km/s)`],
      ['rgba(138, 180, 255, 0.95)', `velocità rispetto a ${tr.nome} — ruota di ${num(tr.dev, 0)}°, resta ${num(tr.vInf, 1)} km/s`],
      [tr.guadagno >= 0 ? C.verde : C.rosso, 'somma delle due: la velocità rispetto al Sole']
    ];
    voci.forEach(([col, testo], i) => {
      const yy = 18 + i * 15;
      ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(12, yy - 3); ctx.lineTo(30, yy - 3); ctx.stroke();
      didScritta(ctx, testo, 36, yy, { colore: C.testo3, misura: 10, peso: 500 });
    });
  }

  // ---------------------------------------------- Il Grand Tour, davvero
  // Le date sono quelle vere, i valori di velocità sono quelli indicativi
  // delle ricostruzioni JPL. Le posizioni dei pianeti no: quelle sono
  // calcolate, e sono il pezzo che rende onesto tutto il quadro — il
  // famoso allineamento del 1977 si vede perché c'era, non perché l'ho
  // disegnato allineato.
  //
  // Ogni tappa che è un incontro porta con sé i suoi dettagli: il giorno,
  // quanto è passata vicino (dal **centro** del pianeta, che è la misura
  // con cui si fanno i conti della fionda: le carte spesso danno la quota
  // sulle nubi, e fra le due c'è un raggio planetario di differenza), e
  // quanto ha guadagnato. Sono i numeri con cui il banco di prova qui
  // accanto si può rifare l'incontro vero.
  const VOY_TAPPE = {
    v1: [
      { anno: 1977.68, dove: null, v: 36.0, giorno: '5 settembre 1977',
        titolo: 'Lancio', testo: `Parte da Cape Canaveral con un Titan IIIE-Centaur, sedici giorni <em>dopo</em>
          la gemella ma su una rotta più corta e veloce: la sorpasserà prima di Giove. I 36 km/s sono
          rispetto al Sole, e comprendono i 30 che la Terra le ha regalato semplicemente stando lì.` },
      { anno: 1979.17, dove: 'Jupiter', v: 10.5, arrivo: true,
        titolo: 'In avvicinamento a Giove', testo: `Diciotto mesi di salita verso l'esterno: la sonda ha
          speso quasi tutta la velocità del lancio a risalire il pozzo gravitazionale del Sole, e arriva a
          Giove a 10,5 km/s. Senza la fionda, da qui in poi rallenterebbe ancora e ricadrebbe indietro.` },
      { anno: 1979.20, dove: 'Jupiter', v: 25.0, giorno: '5 marzo 1979', stretta: 348890, salto: 14.5,
        titolo: 'Fionda di Giove', testo: `Passa a 349.000 km dal centro di Giove — cinque raggi — e in un
          giorno guadagna 14,5 km/s: più di quanto potrebbe darle qualunque motore montato a bordo. Da qui
          in avanti la sonda è su una traiettoria di fuga dal Sistema Solare, e non lo era prima.` },
      { anno: 1980.85, dove: 'Saturn', v: 14.5, arrivo: true,
        titolo: 'In avvicinamento a Saturno', testo: `Venti mesi e mezzo miliardo di chilometri più in là.
          Salendo ha di nuovo rallentato, da 25 a 14,5 km/s: è il Sole che tira indietro, e si paga sempre.` },
      { anno: 1980.88, dove: 'Saturn', v: 21.5, giorno: '12 novembre 1980', stretta: 184300, salto: 7.0,
        titolo: 'Fionda di Saturno, e addio al piano', testo: `La manovra più costosa del programma, e fu una
          scelta: per passare a 6.500 km da <strong>Titano</strong> — l'unica luna del Sistema Solare con
          un'atmosfera densa — la traiettoria venne piegata <strong>fuori dal piano dei pianeti</strong>.
          Il prezzo fu Plutone, che la Voyager 1 avrebbe potuto raggiungere e che nessuno ha più visto da
          vicino fino al 2015. Da questo istante la sonda sale di 35° sopra il piano: gira la scena col dito
          e la vedi staccarsi.` },
      { anno: 1990.5, dove: null, v: 17.4,
        titolo: 'Verso il fuori', testo: `Va a 17 km/s ed è l'oggetto costruito da noi più lontano di tutti.
          Il 14 febbraio 1990, da sei miliardi di chilometri, si è girata a fotografare la Terra: un puntino
          in un raggio di luce, il <em>Pale Blue Dot</em>. Poi le telecamere sono state spente per sempre.` }
    ],
    v2: [
      { anno: 1977.62, dove: null, v: 36.0, giorno: '20 agosto 1977',
        titolo: 'Lancio', testo: `Parte per prima, su una rotta più lenta ma capace di incrociare tutti e
          quattro i giganti: è lei la vera Grand Tour. L'allineamento che lo permette si ripresenta una volta
          ogni 176 anni.` },
      { anno: 1979.50, dove: 'Jupiter', v: 10.0, arrivo: true,
        titolo: 'In avvicinamento a Giove', testo: 'Ventitré mesi di salita, e arriva a Giove a 10 km/s.' },
      { anno: 1979.53, dove: 'Jupiter', v: 25.0, giorno: '9 luglio 1979', stretta: 721670, salto: 15.0,
        titolo: 'Fionda di Giove', testo: `Passa più larga della gemella — 722.000 km dal centro, dieci raggi —
          perché la deviazione doveva essere quella giusta per arrivare a Saturno <em>nel punto</em> da cui si
          riparte per Urano. Una fionda non si sceglie per il guadagno massimo: si sceglie per dove ti manda.` },
      { anno: 1981.62, dove: 'Saturn', v: 14.0, arrivo: true,
        titolo: 'In avvicinamento a Saturno', testo: 'Due anni dopo Giove, di nuovo rallentata a 14 km/s.' },
      { anno: 1981.65, dove: 'Saturn', v: 20.5, giorno: '26 agosto 1981', stretta: 161000, salto: 6.5,
        titolo: 'Fionda di Saturno', testo: `Passa a 161.000 km dal centro, restando <strong>nel piano</strong>:
          è la differenza con la sorella, e le costa la vista ravvicinata di Titano ma le regala Urano e
          Nettuno. Durante il passaggio la piattaforma delle telecamere si bloccò, e per due giorni si temette
          fosse finito tutto lì.` },
      { anno: 1986.05, dove: 'Uranus', v: 17.0, arrivo: true,
        titolo: 'In avvicinamento a Urano', testo: 'Quattro anni e mezzo di traversata nel vuoto, a tre miliardi di chilometri da casa.' },
      { anno: 1986.07, dove: 'Uranus', v: 21.0, giorno: '24 gennaio 1986', stretta: 107000, salto: 4.0,
        titolo: 'Urano — la prima e unica volta', testo: `81.500 km sopra le nubi. Urano gira coricato su un
          fianco, quindi le sue lune formano un bersaglio a cerchi concentrici invece che una fila: la sonda
          ci passò in mezzo in poche ore. Nessuno c'è più tornato, e non ci sono missioni approvate.` },
      { anno: 1989.63, dove: 'Neptune', v: 19.0, arrivo: true,
        titolo: 'In avvicinamento a Nettuno', testo: 'Tre anni e mezzo ancora, e siamo a 4,5 miliardi di chilometri.' },
      { anno: 1989.65, dove: 'Neptune', v: 17.4, giorno: '25 agosto 1989', stretta: 29240, salto: -1.6,
        titolo: 'Nettuno — qui la fionda FRENA', testo: `4.950 km sopra le nubi del polo nord: il passaggio più
          ravvicinato di tutto il programma. E la manovra, per una volta, <strong>toglie</strong> velocità
          invece di darla: serviva a piegare la rotta verso il basso per incontrare <strong>Tritone</strong>
          cinque ore dopo. Il segno negativo che vedi nel banco di prova, quando mandi la sonda davanti al
          pianeta, è esattamente questo. Da qui la Voyager 2 scende di 48° sotto il piano dei pianeti.` },
      { anno: 1990.5, dove: null, v: 15.4,
        titolo: 'Verso il fuori', testo: `Va a 15,4 km/s, più piano della gemella perché ha speso due incontri
          a girare invece che ad accelerare. Ha visitato quattro pianeti: nessun'altra sonda, prima o dopo.` }
    ]
  };

  // Quanto ogni sonda esce dal piano dei pianeti dopo l'ultimo incontro,
  // in gradi. Sono i due numeri che rendono questo viaggio una faccenda a
  // tre dimensioni invece che una pianta: la 1 sale, la 2 scende, e
  // guardando a picco sembrerebbero due rotte qualunque.
  const VOY_FUGA = { v1: 35.5, v2: -47.5 };

  const voyCache = { pianeti: null };

  function voyPosizioni(anno) {
    // Le posizioni dei quattro giganti, campionate una volta e poi
    // interpolate: cinquantadue anni × quattro pianeti sono duecento
    // chiamate, e farle a ogni fotogramma sarebbe uno spreco
    if (!voyCache.pianeti && typeof Astronomy !== 'undefined') {
      const tabella = {};
      ['Jupiter', 'Saturn', 'Uranus', 'Neptune'].forEach(k => {
        tabella[k] = [];
        for (let a = 1977; a <= 1991; a += 0.25) {
          try {
            const d = new Date(Date.UTC(Math.floor(a), 0, 1 + Math.round((a % 1) * 365.25)));
            const v = Astronomy.Ecliptic(Astronomy.HelioVector(k, Astronomy.MakeTime(d))).vec;
            // La z si porta dietro perché la scena adesso è in tre
            // dimensioni: sono decimi di UA — Nettuno arriva a poco più di
            // una — e a picco non si vedono, ma girando la scena sì
            tabella[k].push({ anno: a, x: v.x, y: v.y, z: v.z });
          } catch (e) { /* niente */ }
        }
      });
      voyCache.pianeti = tabella;
    }
    const out = {};
    const tab = voyCache.pianeti || {};
    Object.keys(tab).forEach(k => {
      const arr = tab[k];
      if (!arr || !arr.length) return;
      const q = Math.max(0, Math.min(arr.length - 1.001, (anno - 1977) / 0.25));
      const i = Math.floor(q), f = q - i;
      const a = arr[i], b = arr[Math.min(arr.length - 1, i + 1)];
      out[k] = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
    });
    return out;
  }

  function voySlitta() {
    const s = $('did-voy-slitta');
    if (s) s.value = String(fionda.voyAnno.toFixed(2));
  }

  // I punti fissi del viaggio: dove stava ogni pianeta **il giorno
  // dell'incontro**. Sembra ovvio, e per un giro intero non lo è stato:
  // la prima versione prendeva la posizione del pianeta all'anno che si
  // stava guardando, così il nodo «Giove, marzo 1979» si spostava mentre
  // scorreva il tempo e le due scie si arrotolavano attorno al Sole
  // seguendo i pianeti invece di stare ferme dov'erano passate. Sono
  // undici posizioni in tutto: si calcolano una volta e non cambiano più.
  //
  // I nodi adesso hanno anche una **z**, e non è un vezzo: è il pezzo di
  // Grand Tour che una pianta non può raccontare. Fino all'ultimo incontro
  // le due sonde stanno praticamente nel piano dei pianeti (la z è quella
  // vera del pianeta che stanno incontrando, decimi di UA); dopo, la
  // fionda le scaglia fuori — la 1 di 35° in su dopo Titano, la 2 di 48°
  // in giù dopo Tritone — e da lì in avanti se ne vanno in due direzioni
  // che, viste a picco, sembrano la stessa cosa e non lo sono affatto.
  const voyNodiCache = {};
  function voyNodi(chi) {
    if (voyNodiCache[chi]) return voyNodiCache[chi];
    const tappe = VOY_TAPPE[chi];
    const nodi = [{ anno: tappe[0].anno, p: { x: 0.6, y: 0.75, z: 0 }, dove: null }];
    tappe.forEach(t => {
      // Le tappe di avvicinamento non sono nodi: sono lo stesso punto
      // dell'incontro, e l'interpolazione ci si fermerebbe sopra
      if (!t.dove || t.arrivo) return;
      const p = voyPosizioni(t.anno)[t.dove];
      if (p) nodi.push({ anno: t.anno, p: { x: p.x, y: p.y, z: p.z || 0 }, dove: t.dove, tappa: t });
    });
    // Dopo l'ultimo incontro si tira dritto verso fuori, lungo la direzione
    // in cui la fionda l'ha lanciata e con l'inclinazione che le ha dato.
    //
    // La fuga si scrive **un anno per volta**, e non con un nodo solo
    // lontanissimo. Con un nodo solo la Catmull-Rom prende la tangente
    // all'ultimo incontro guardando il nodo successivo, che stava a
    // trentaquattro unità astronomiche e ventiquattro fuori dal piano: quel
    // ventiquattro rientrava all'indietro nel tratto precedente e la
    // Voyager 1, nel 1980 — quando ancora doveva arrivare a Saturno —
    // risultava un'unità astronomica e mezza *sotto* il piano, cioè tredici
    // gradi dalla parte sbagliata. Con nodi equidistanti e in fila la
    // spline passa per la retta esatta, che è quello che fa una sonda su
    // cui non agisce più niente.
    const ultimo = nodi[nodi.length - 1];
    const piano = Math.hypot(ultimo.p.x, ultimo.p.y) || 1;
    const salita = Math.tan((VOY_FUGA[chi] || 0) * Math.PI / 180);
    const dx = ultimo.p.x / piano, dy = ultimo.p.y / piano;
    const lung = Math.hypot(1, salita);
    // La velocità di fuga in UA all'anno, dall'ultima tappa: 17,4 km/s
    // sono tre unità astronomiche e mezza all'anno
    const passo = tappe[tappe.length - 1].v * 31557600 / AU_KM;
    for (let k = 1; k <= 12; k++) {
      const d = passo * k;
      nodi.push({
        anno: ultimo.anno + k,
        dove: null,
        p: {
          x: ultimo.p.x + dx * d / lung,
          y: ultimo.p.y + dy * d / lung,
          z: ultimo.p.z + salita * d / lung
        }
      });
    }
    if (voyCache.pianeti) voyNodiCache[chi] = nodi;   // solo se i dati c'erano davvero
    return nodi;
  }

  function voyDove(chi, anno) {
    const nodi = voyNodi(chi);
    if (anno <= nodi[0].anno) return nodi[0].p;
    for (let i = 1; i < nodi.length; i++) {
      if (anno <= nodi[i].anno) {
        const f = Math.max(0, Math.min(1, (anno - nodi[i - 1].anno) / (nodi[i].anno - nodi[i - 1].anno || 1)));
        // Catmull-Rom sui quattro nodi attorno: una spezzata di rette fra
        // un pianeta e l'altro si vede lontano un miglio che è finta —
        // nessuna sonda ha mai svoltato ad angolo retto. Questa passa per
        // gli stessi punti (che sono veri, e nei giorni veri) ma ci arriva
        // curvando, come si arriva davvero. Adesso curva anche in altezza.
        const p0 = nodi[Math.max(0, i - 2)].p, p1 = nodi[i - 1].p;
        const p2 = nodi[i].p, p3 = nodi[Math.min(nodi.length - 1, i + 1)].p;
        const f2 = f * f, f3 = f2 * f;
        const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * f +
          (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3);
        return {
          x: cr(p0.x, p1.x, p2.x, p3.x),
          y: cr(p0.y, p1.y, p2.y, p3.y),
          z: cr(p0.z || 0, p1.z || 0, p2.z || 0, p3.z || 0)
        };
      }
    }
    return nodi[nodi.length - 1].p;
  }

  // Quanto è lontana dal Sole, e di quanti gradi sta fuori dal piano dei
  // pianeti: sono le due letture che raccontano il viaggio meglio di
  // qualunque disegno, perché la seconda per dodici anni vale zero e poi
  // improvvisamente no
  function voyStato(chi, anno) {
    const p = voyDove(chi, anno);
    const piano = Math.hypot(p.x, p.y);
    return {
      p,
      ua: Math.hypot(piano, p.z || 0),
      lat: Math.atan2(p.z || 0, piano) * GRADI
    };
  }

  function voyVelocita(chi, anno) {
    const tappe = VOY_TAPPE[chi];
    if (anno <= tappe[0].anno) return tappe[0].v;
    for (let i = 1; i < tappe.length; i++) {
      if (anno <= tappe[i].anno) {
        const f = (anno - tappe[i - 1].anno) / (tappe[i].anno - tappe[i - 1].anno || 1);
        return tappe[i - 1].v + (tappe[i].v - tappe[i - 1].v) * f;
      }
    }
    return tappe[tappe.length - 1].v;
  }

  const VOY_NOMI = { v1: 'Voyager 1', v2: 'Voyager 2' };

  // Le tappe di tutt'e due messe in fila, ordinate per data: è l'elenco su
  // cui si costruisce la linea del tempo, e quello su cui si cerca «dove
  // siamo adesso»
  function voyTutteLeTappe() {
    const tutte = [];
    ['v1', 'v2'].forEach(chi => VOY_TAPPE[chi].forEach(t => tutte.push({ chi, t })));
    return tutte.sort((a, b) => a.t.anno - b.t.anno);
  }

  function voyNumeri() {
    const a = fionda.voyAnno;
    const anno = Math.floor(a);
    const mese = MESI[Math.min(11, Math.floor((a % 1) * 12))];
    scrivi('did-voy-quando', `${mese} ${anno}`);

    ['v1', 'v2'].forEach(chi => {
      const partita = a >= VOY_TAPPE[chi][0].anno;
      const n = chi === 'v1' ? '1' : '2';
      if (!partita) {
        scrivi('did-voy-' + n, 'non ancora partita', chi === 'v1' ? 'blu' : 'verde');
        scrivi('did-voy-d' + n, '—');
        return;
      }
      const s = voyStato(chi, a);
      scrivi('did-voy-' + n, `${num(voyVelocita(chi, a), 1)} km/s`, chi === 'v1' ? 'blu' : 'verde');
      // Sotto il grado non vale la pena parlare di «fuori dal piano»: sono
      // le inclinazioni di sempre delle orbite planetarie
      const fuori = Math.abs(s.lat) < 1 ? 'nel piano dei pianeti'
        : `${num(Math.abs(s.lat), 0)}° ${s.lat > 0 ? 'sopra' : 'sotto'} il piano`;
      scrivi('did-voy-d' + n, `${num(s.ua, 1)} UA · ${fuori}`);
    });

    // La prossima tappa, di chiunque sia
    let prossima = null, diChi = '';
    ['v1', 'v2'].forEach(chi => {
      VOY_TAPPE[chi].forEach(t => {
        if (t.anno > a && t.dove && !t.arrivo && (!prossima || t.anno < prossima.anno)) {
          prossima = t; diChi = VOY_NOMI[chi];
        }
      });
    });
    scrivi('did-voy-prossimo', prossima
      ? `${diChi} → ${CORPI[prossima.dove].nome}, ${prossima.giorno}`
      : 'nessuno: sono uscite dal Sistema Solare');
    const lettura = $('did-voy-lettura');
    if (lettura) lettura.textContent = `${anno}`;

    // La spiegazione segue la tappa più vicina appena passata
    let ultima = null;
    voyTutteLeTappe().forEach(v => { if (v.t.anno <= a) ultima = v; });
    const sp = $('did-voy-spiega');
    if (sp && ultima) {
      const t = ultima.t;
      const dettagli = [];
      if (t.giorno) dettagli.push(t.giorno);
      if (t.stretta) dettagli.push(`${numMila(t.stretta)} km dal centro del pianeta`);
      if (t.salto !== undefined) {
        dettagli.push(`${t.salto >= 0 ? '+' : '−'}${num(Math.abs(t.salto), 1)} km/s rispetto al Sole`);
      }
      sp.innerHTML = `<strong>${VOY_NOMI[ultima.chi]} · ${t.titolo}</strong>` +
        (dettagli.length ? `<span class="did-spiega-dati">${dettagli.join(' · ')}</span>` : '') +
        `<span class="did-spiega-testo">${t.testo}</span>`;
    }
    voyAggiornaLinea();
  }

  // La linea del tempo: ogni incontro è un tasto, e toccandolo l'orologio
  // ci va. Scorrere a mano una slitta di tredici anni per ritrovare il
  // giorno di Urano è un lavoro da nessuno.
  function voyCostruisciLinea() {
    const n = $('did-voy-linea');
    if (!n || n.dataset.pronto === 'si') return;
    n.dataset.pronto = 'si';
    n.innerHTML = voyTutteLeTappe().map(({ chi, t }, i) => `
      <button type="button" class="did-tappa did-tappa-${chi}${t.arrivo ? ' did-tappa-lieve' : ''}"
        data-tappa="${i}" data-anno="${t.anno}"
        title="${VOY_NOMI[chi]} — ${t.titolo}${t.giorno ? ', ' + t.giorno : ''}">
        <span class="did-tappa-chi">${chi === 'v1' ? 'V1' : 'V2'}</span>
        <span class="did-tappa-che">${t.dove ? CORPI[t.dove].nome : t.titolo}</span>
        <span class="did-tappa-quando">${t.giorno || Math.floor(t.anno)}</span>
      </button>`).join('');
    n.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tappa]');
      if (!b) return;
      fionda.voyMarcia = false;
      alterna('did-voy', false);
      // Un filo dopo l'incontro, se no si arriva sull'istante esatto in cui
      // la velocità sta ancora saltando e la lettura dice il numero di prima
      fionda.voyAnno = Math.min(1990.5, Number(b.dataset.anno) + 0.01);
      voySlitta();
      voyNumeri();
    });
  }

  function voyAggiornaLinea() {
    const n = $('did-voy-linea');
    if (!n || n.dataset.pronto !== 'si') return;
    const tappe = voyTutteLeTappe();
    let ultima = -1;
    tappe.forEach((v, i) => { if (v.t.anno <= fionda.voyAnno) ultima = i; });
    n.querySelectorAll('[data-tappa]').forEach(b => {
      const i = Number(b.dataset.tappa);
      b.classList.toggle('attiva', i === ultima);
      b.classList.toggle('did-tappa-fatta', i < ultima);
    });
  }

  function voyDisegnaMappa() {
    const t = didTela('did-voy-tela', 1.45, 430, { lente: true, gira: true, pieno: true });
    if (!t) return;
    const { ctx, L, H } = t;
    didSfondo(ctx, L, H);
    const pos = voyPosizioni(fionda.voyAnno);
    const scala = Math.min(L, H) * 0.45 / 32;   // Nettuno sta a 30 UA
    const cx = L / 2, cy = H / 2;
    const X = (x) => cx + x * scala;
    const Y = (y) => cy - y * scala;

    // Un punto del viaggio sullo schermo, quota compresa: `didQuota`
    // aggiunge lo scostamento fuori dal piano, che a picco è zero e
    // girando la scena si apre
    // (la z positiva è il nord dell'eclittica, e sullo schermo va in su:
    //  `didQuota` alza di quanto serve, cioè di niente se si guarda a picco)
    const P = (p) => didAlza(X(p.x), Y(p.y), (p.z || 0) * scala);

    ['Jupiter', 'Saturn', 'Uranus', 'Neptune'].forEach(k => {
      didCerchio(ctx, cx, cy, CORPI[k].a * scala, 'rgba(148, 168, 214, 0.12)', 1);
    });
    didCorpo(ctx, cx, cy, 7, C.sole, { alone: 3.6 });

    ['Jupiter', 'Saturn', 'Uranus', 'Neptune'].forEach(k => {
      const p = pos[k];
      if (!p) return;
      const q = P(p);
      didCorpo(ctx, q.x, q.y, k === 'Jupiter' ? 6 : 5, CORPI[k].colore, { anelli: k === 'Saturn' });
      // Il nome va messo verso fuori, lungo il raggio: nel 1978 Giove e
      // Saturno erano a pochi gradi l'uno dall'altro e le due scritte
      // finivano una sopra l'altra («SaturnGiove»). Spingendole in fuori
      // si separano da sole, perché i due pianeti stanno su cerchi
      // diversi.
      const d = Math.hypot(p.x, p.y) || 1;
      const ux = p.x / d, uy = p.y / d;
      didScritta(ctx, CORPI[k].nome, q.x, q.y,
        { colore: C.testo2, misura: 10, dx: ux * 14, dy: -uy * 14 + 4,
          allinea: ux < -0.25 ? 'right' : ux > 0.25 ? 'left' : 'center' });
    });

    // I punti in cui è successo qualcosa restano segnati anche dopo che la
    // sonda è passata: la scia da sola dice dov'è andata, non dove ha
    // girato — e il Grand Tour è tutto nei posti in cui ha girato
    ['v1', 'v2'].forEach(chi => {
      voyNodi(chi).forEach(nodo => {
        if (!nodo.dove || nodo.anno > fionda.voyAnno) return;
        const q = P(nodo.p);
        didCerchio(ctx, q.x, q.y, 8, 'rgba(245, 181, 68, 0.55)', 1.2, [2, 3]);
      });
    });

    // Le due scie, ricostruite dall'inizio fino all'anno mostrato
    [['v1', C.bluChiaro], ['v2', C.verde]].forEach(([chi, col]) => {
      const punti = [];
      for (let a = VOY_TAPPE[chi][0].anno; a <= fionda.voyAnno; a += 0.05) {
        punti.push(P(voyDove(chi, a)));
      }
      didPercorso(ctx, punti, { colore: didVela(col, 0.55), spessore: 1.6 });
      if (fionda.voyAnno >= VOY_TAPPE[chi][0].anno) {
        const p = voyDove(chi, fionda.voyAnno);
        const q = P(p);
        // Il filo a piombo fino al piano dei pianeti, come nella vista 3D
        // del Sistema Solare: senza, un punto sospeso in aria è solo un
        // punto spostato, e non si capisce di quanto sia alto
        const piede = { x: X(p.x), y: Y(p.y) };
        if (Math.hypot(q.x - piede.x, q.y - piede.y) > 3) {
          ctx.strokeStyle = didVela(col, 0.4);
          ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
          ctx.beginPath(); ctx.moveTo(piede.x, piede.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          ctx.setLineDash([]);
          didCorpo(ctx, piede.x, piede.y, 1.6, col, { alone: 0 });
        }
        didCorpo(ctx, q.x, q.y, 4, col, { alone: 3 });
        // Una sopra e una sotto: nei primi mesi le due sonde sono quasi
        // nello stesso punto, e i due nomi si sovrapporrebbero
        const s = voyStato(chi, fionda.voyAnno);
        // Gli scostamenti sono in pixel di schermo (`dx`/`dy`): dentro alla
        // matrice, con la scena di taglio, i dodici pixel che separano le
        // due righe diventavano due e le scritte si stampavano una sull'altra
        didScritta(ctx, `${VOY_NOMI[chi]} · ${num(s.ua, 1)} UA`, q.x, q.y,
          { colore: col, misura: 10, peso: 700, dx: 13, dy: chi === 'v1' ? -14 : 24 });
        if (Math.abs(s.lat) >= 1) {
          didScritta(ctx, `${num(Math.abs(s.lat), 0)}° ${s.lat > 0 ? 'sopra' : 'sotto'} il piano`,
            q.x, q.y,
            { colore: didVela(col, 0.75), misura: 9, peso: 600, dx: 13, dy: chi === 'v1' ? -1 : 37 });
        }
      }
    });

    // L'anno sta in alto a destra, sotto ai tasti della lente: in basso a
    // sinistra c'è la targhetta, e a schermo intero la targhetta sale
    // nell'angolo in alto a sinistra — cioè proprio dove l'anno stava prima
    didScritta(ctx, `${Math.floor(fionda.voyAnno)}`, L - 12, 60,
      { colore: C.testo, misura: 18, peso: 700, mono: true, schermo: true, allinea: 'right' });
  }

  function voyDisegnaGrafico() {
    const t = didTela('did-voy-grafico', 3.2, 200, { lente: true });
    if (!t) return;
    const { ctx, L, H } = t;
    ctx.fillStyle = '#070b16';
    ctx.fillRect(0, 0, L, H);
    // Gli anni vanno in cima: in basso a sinistra c'è la targhetta della
    // scena, e i primi due finivano nascosti sotto
    const x0 = 42, x1 = L - 14, y0 = H - 16, y1 = 30;
    const A0 = 1977, A1 = 1990.5, V1 = 40;
    const X = (a) => x0 + (a - A0) / (A1 - A0) * (x1 - x0);
    const Y = (v) => y0 - v / V1 * (y0 - y1);

    ctx.strokeStyle = C.griglia; ctx.lineWidth = 1;
    [10, 20, 30, 40].forEach(v => {
      ctx.beginPath(); ctx.moveTo(x0, Y(v)); ctx.lineTo(x1, Y(v)); ctx.stroke();
      didScritta(ctx, `${v}`, x0 - 6, Y(v) + 3, { colore: C.testo3, misura: 9, allinea: 'right', mono: true, peso: 500 });
    });
    for (let a = 1978; a <= 1990; a += 2) {
      didScritta(ctx, `${a}`, X(a), 16, { colore: C.testo3, misura: 9, allinea: 'center', mono: true, peso: 500 });
    }
    didScritta(ctx, 'km/s', x0 - 6, y1 - 8, { colore: C.testo3, misura: 9, allinea: 'right', peso: 500 });

    [['v1', '#8ab4ff'], ['v2', '#34d399']].forEach(([chi, col], riga) => {
      const punti = [];
      for (let a = VOY_TAPPE[chi][0].anno; a <= A1; a += 0.02) punti.push({ x: X(a), y: Y(voyVelocita(chi, a)) });
      didPercorso(ctx, punti, { colore: col, spessore: 1.9 });
      // I gradini: gli incontri, dove la curva salta. Ognuno dice di
      // quanto — «G +14,5» — perché è quello il numero per cui esiste
      // tutto il grafico, e leggerlo sull'asse a occhio non riesce
      VOY_TAPPE[chi].forEach(tp => {
        if (!tp.dove || tp.arrivo) return;
        const px = X(tp.anno), py = Y(tp.v);
        didCerchio(ctx, px, py, 3, col, 1.4);
        if (tp.salto === undefined) return;
        const segno = tp.salto >= 0 ? '+' : '−';
        didScritta(ctx, `${CORPI[tp.dove].nome[0]} ${segno}${num(Math.abs(tp.salto), 1)}`,
          px, py - 8 + (riga ? 20 : 0),
          { colore: col, misura: 9, peso: 700, mono: true, allinea: 'center' });
      });
    });

    const a = fionda.voyAnno;
    ctx.strokeStyle = 'rgba(245, 181, 68, 0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(X(a), y1); ctx.lineTo(X(a), y0); ctx.stroke();
  }

  // ===================================================================
  // 6. ESPERIMENTO 4 — LE FINESTRE DI LANCIO
  //
  //   «Perché non si può partire per Marte quando si vuole» si spiega in
  //   un disegno solo: la sonda percorre mezza ellisse, ci mette un tempo
  //   che è fissato dalla terza legge di Keplero e non si può cambiare, e
  //   quando arriva il pianeta deve essere lì. Non «lì attorno»: lì.
  //
  //   Qui i conti sono quelli veri dell'orbita di Hohmann — semiasse,
  //   tempo di volo, angolo di fase, periodo sinodico, spinte da dare —
  //   e la data della prossima finestra si trova cercando nelle posizioni
  //   vere dei pianeti l'istante in cui l'angolo fra Terra e meta è quello
  //   giusto. Non è una tabella scritta a mano: è una ricerca.
  // ===================================================================

  const lancio = {
    meta: 'Mars',
    scarto: 0,          // giorni di anticipo o ritardo sulla finestra
    t: 0,               // frazione del volo
    marcia: false,
    velocita: 1,
    conti: null,
    finestra: null,
    partito: false
  };

  const LANCIO_METE = ['Venus', 'Mars', 'Jupiter', 'Mercury', 'Saturn'];

  laboratorio({
    id: 'finestre',
    chip: 'Finestre di lancio',
    occhiello: 'Concetto 4 — partire al minuto giusto',
    titolo: 'Perché per Marte si parte solo ogni 26 mesi',
    sommario: `Una sonda non punta il pianeta: punta il posto dove il pianeta sarà fra sei, otto,
      trentadue mesi. Il tempo di volo lo decide Keplero e non si tratta, quindi l'unica cosa che si
      può scegliere è il giorno della partenza — e i giorni buoni sono pochi. Sposta la data e guarda
      di quanti milioni di chilometri si sbaglia il bersaglio.`,

    costruisci() {
      return `
        <figure class="did-scena did-scena-tonda">
          <canvas id="did-lancio-tela" class="did-tela"></canvas>
          <figcaption class="did-targhetta" id="did-lancio-verdetto">Scegli la meta, sposta la data, lancia</figcaption>
        </figure>

        ${didBarra('did-lancio', { min: 0, max: 999, valore: 0, etichettaSlitta: 'Scorri il volo', velocita: [0.5, 1, 2, 4] })}

        <div class="did-riga">
          <div class="segmenti-cielo" id="did-lancio-mete">
            ${LANCIO_METE.map(k => `<button type="button" class="tasto-segmento${k === 'Mars' ? ' attiva' : ''}" data-meta="${k}">${CORPI[k].nome}</button>`).join('')}
          </div>
        </div>

        <div class="did-riga">
          <label class="did-etichetta" for="did-lancio-scarto">Parto rispetto alla finestra perfetta</label>
          <span class="did-valore" id="did-lancio-scarto-val">il giorno giusto</span>
        </div>
        <input id="did-lancio-scarto" class="did-slitta did-slitta-larga" type="range" min="-90" max="90" step="1" value="0">

        ${didLetture([
          { id: 'did-lancio-volo', nome: 'Tempo di volo', forte: true },
          { id: 'did-lancio-angolo', nome: 'Dove deve stare la meta alla partenza', forte: true },
          { id: 'did-lancio-esito', nome: 'Esito del lancio', forte: true },
          { id: 'did-lancio-sinodico', nome: 'Ogni quanto si riapre la finestra' },
          { id: 'did-lancio-dv', nome: 'Spinta necessaria (Δv totale)' },
          { id: 'did-lancio-prossima', nome: 'Prossima finestra vera' }
        ])}

        <p class="did-spiega" id="did-lancio-spiega">—</p>
        <p class="did-nota">Il conto è quello dell'orbita di Hohmann, la più economica che ci sia: mezza
          ellisse tangente a tutt'e due le orbite. Le sonde vere ne usano varianti più veloci e più care, e
          spesso ci aggiungono una fionda o due — ma la finestra resta, e resta larga poche settimane.</p>

        ${didPonti([
          { azione: 'tred', icona: 'saturno', testo: 'Portami alla prossima finestra vera', titolo: 'Sposta l\'orologio alla data trovata e apre il Sistema Solare in 3D' },
          { azione: 'cielo', icona: 'stella', testo: 'E in cielo, quel giorno, dov\'è?', titolo: 'Apre il planetario a quella data, puntato sulla meta' }
        ])}`;
    },

    collega() {
      collegaBarra('did-lancio', lancio, {
        suMarcia: (m) => { if (m) lancio.partito = true; },
        suSlitta: (v) => { lancio.partito = true; lancio.t = v / 1000; lancioNumeri(); },
        suInizio: () => { lancio.t = 0; lancio.partito = false; lancioNumeri(); }
      });
      const mete = $('did-lancio-mete');
      if (mete) mete.addEventListener('click', (e) => {
        const b = e.target.closest('[data-meta]');
        if (!b) return;
        mete.querySelectorAll('[data-meta]').forEach(x => x.classList.toggle('attiva', x === b));
        lancio.meta = b.dataset.meta;
        lancio.t = 0; lancio.partito = false; lancio.marcia = false;
        alterna('did-lancio', false);
        lancioPrepara();
      });
      const sc = $('did-lancio-scarto');
      if (sc) sc.addEventListener('input', (e) => {
        lancio.scarto = Number(e.target.value);
        lancio.t = 0; lancio.partito = false; lancio.marcia = false;
        alterna('did-lancio', false);
        lancioNumeri();
      });
      collegaPonti('finestre', (azione) => {
        const data = lancio.finestra ? lancio.finestra.data : didAdesso();
        if (azione === 'tred') didVaiInTreD(data);
        else didVaiInCielo(data, lancio.meta);
      });
    },

    entra() { if (!lancio.conti || lancio.conti.meta !== lancio.meta) lancioPrepara(); alterna('did-lancio', lancio.marcia); },

    passo(dt) {
      if (!lancio.marcia) return;
      lancio.partito = true;
      lancio.t += dt * 0.18 * lancio.velocita;
      if (lancio.t >= 1) { lancio.t = 1; lancio.marcia = false; alterna('did-lancio', false); }
      const s = $('did-lancio-slitta'); if (s) s.value = String(Math.round(lancio.t * 1000));
      lancioNumeri();
    },

    disegna() { lancioDisegna(); }
  });

  // Un angolo riportato dentro al giro, fra −180° e +180°. Serve perché la
  // formula dell'angolo di fase, per le mete veloci, esce dal giro: Mercurio
  // durante il volo percorre 431°, e «180 − 431» fa −252°, che non è un posto
  // ma un giro e mezzo. Il posto è lo stesso detto per la via corta, +108°, e
  // quello è il numero che va scritto e disegnato — con −252° la lettura
  // diceva «252° dietro alla Terra» e il settore sul disegno faceva un
  // pacman di tre quarti di orbita al posto di uno spicchio.
  function lancioGiro(g) {
    return ((g % 360) + 540) % 360 - 180;
  }

  function lancioPrepara() {
    const k = lancio.meta;
    const r1 = 1.0, r2 = CORPI[k].a;
    const at = (r1 + r2) / 2;
    const tVoloAnni = 0.5 * Math.pow(at, 1.5);
    const tVoloGiorni = tVoloAnni * 365.25;
    // Di quanto avanza la meta durante il volo, e quindi dove deve stare
    // quando si parte: la sonda arriva a 180° dal punto di partenza
    const omega = 360 / (CORPI[k].T * 365.25);      // gradi al giorno della meta
    const omegaTerra = 360 / 365.25;
    const fase = lancioGiro(180 - omega * tVoloGiorni);   // angolo di anticipo della meta al lancio
    const sinodico = Math.abs(1 / (1 / 1 - 1 / CORPI[k].T)) * 365.25;
    const vTerra = 29.785;
    const dv1 = Math.abs(vTerra / Math.sqrt(r1) * (Math.sqrt(2 * r2 / (r1 + r2)) - 1));
    const dv2 = Math.abs(vTerra / Math.sqrt(r2) * (1 - Math.sqrt(2 * r1 / (r1 + r2))));

    lancio.conti = { meta: k, r1, r2, at, tVoloAnni, tVoloGiorni, fase, sinodico, omega, omegaTerra, dv1, dv2, interno: r2 < r1 };
    lancio.finestra = lancioTrovaFinestra(k, fase);
    lancioNumeri();
  }

  // La finestra vera: si scorrono i giorni e si guarda quando l'angolo
  // fra la Terra e la meta (visto dal Sole) diventa quello che serve.
  // Passa da zero l'ultima volta, e quel giorno è la finestra.
  function lancioTrovaFinestra(k, faseVoluta) {
    if (typeof Astronomy === 'undefined') return null;
    const partenza = didAdesso();
    const sin = Math.abs(1 / (1 / 1 - 1 / CORPI[k].T)) * 365.25;
    let precedente = null;
    for (let g = 0; g <= sin * 1.15 + 5; g += 2) {
      const d = new Date(partenza.getTime() + g * GIORNO_MS);
      let sc;
      try {
        const t = Astronomy.MakeTime(d);
        const terra = Astronomy.Ecliptic(Astronomy.HelioVector('Earth', t));
        const meta = Astronomy.Ecliptic(Astronomy.HelioVector(k, t));
        let diff = meta.elon - terra.elon - faseVoluta;
        diff = ((diff % 360) + 540) % 360 - 180;      // riportato fra −180 e +180
        sc = diff;
      } catch (e) { continue; }
      if (precedente !== null && Math.sign(sc) !== Math.sign(precedente.v) && Math.abs(sc - precedente.v) < 180) {
        // interpolazione lineare fra i due giorni che stanno a cavallo
        const f = Math.abs(precedente.v) / (Math.abs(precedente.v) + Math.abs(sc));
        const gg = precedente.g + (g - precedente.g) * f;
        const data = new Date(partenza.getTime() + gg * GIORNO_MS);
        return { data, arrivo: new Date(data.getTime() + 0.5 * Math.pow((1 + CORPI[k].a) / 2, 1.5) * 365.25 * GIORNO_MS) };
      }
      precedente = { g, v: sc };
    }
    return null;
  }

  function lancioNumeri() {
    const c = lancio.conti;
    if (!c) return;
    const nome = CORPI[lancio.meta].nome;
    const sv = $('did-lancio-scarto-val');
    if (sv) sv.textContent = lancio.scarto === 0 ? 'il giorno giusto'
      : `${Math.abs(lancio.scarto)} giorni ${lancio.scarto > 0 ? 'in ritardo' : 'in anticipo'}`;

    scrivi('did-lancio-volo', c.tVoloGiorni > 400
      ? `${num(c.tVoloAnni, 2)} anni (${Math.round(c.tVoloGiorni)} giorni)`
      : `${Math.round(c.tVoloGiorni)} giorni`);
    scrivi('did-lancio-angolo', `${num(Math.abs(c.fase), 1)}° ${c.fase >= 0 ? 'avanti alla Terra' : 'dietro alla Terra'}`);
    scrivi('did-lancio-sinodico', c.sinodico > 400
      ? `ogni ${num(c.sinodico / 365.25, 2)} anni` : `ogni ${Math.round(c.sinodico)} giorni (${num(c.sinodico / 30.44, 0)} mesi)`);
    scrivi('did-lancio-dv', `${num(c.dv1 + c.dv2, 2)} km/s (${num(c.dv1, 2)} + ${num(c.dv2, 2)})`);
    scrivi('did-lancio-prossima', lancio.finestra
      ? `${didData(lancio.finestra.data)} → arrivo ${didDataBreve(lancio.finestra.arrivo)}` : 'non trovata');
    const lettura = $('did-lancio-lettura');
    if (lettura) lettura.textContent = `giorno ${Math.round(c.tVoloGiorni * lancio.t)}`;

    // Di quanto si sbaglia. L'angolo di fase che serve è fissato; partendo
    // N giorni dopo, la meta si trova già spostata di N·(ω − ω_terra)
    // rispetto a dove doveva stare — e ci resta per tutto il volo, perché
    // l'ellisse della sonda è sempre la stessa e ci mette sempre lo stesso
    // tempo. Il resto è un arco di circonferenza al raggio della meta.
    // Anche questo va riportato dentro al giro: per Mercurio, che si sposta
    // di 3,1° al giorno rispetto a noi, novanta giorni di ritardo fanno 279°
    // — che come «errore di mira» non vuol dire niente, perché il pianeta è
    // dall'altra parte ed è a 81° dal punto d'arrivo, non a 279°. Riportarlo
    // dentro al giro dice anche la cosa giusta al limite: dopo un periodo
    // sinodico intero lo scarto torna a zero, ed è vero — è la finestra dopo.
    const scartoGradi = lancioGiro(lancio.scarto * (c.omega - c.omegaTerra));
    const mancatoKm = Math.abs(scartoGradi) / GRADI * c.r2 * AU_KM;
    const centrato = mancatoKm < 3e6;   // la sfera d'influenza di un pianeta, presa larga

    const verdetto = $('did-lancio-verdetto');
    if (!lancio.partito) {
      scrivi('did-lancio-esito', 'ancora a terra');
      if (verdetto) { verdetto.textContent = 'Sposta la data, poi premi Avvia per partire'; verdetto.className = 'did-targhetta'; }
    } else if (lancio.t < 1) {
      scrivi('did-lancio-esito', `in volo — ${Math.round(lancio.t * 100)}% del tragitto`, 'blu');
      if (verdetto) { verdetto.textContent = `In volo verso ${nome} — mancano ${Math.round(c.tVoloGiorni * (1 - lancio.t))} giorni`; verdetto.className = 'did-targhetta'; }
    } else if (centrato) {
      scrivi('did-lancio-esito', 'bersaglio centrato', 'verde');
      if (verdetto) { verdetto.textContent = `Centrato: la sonda e ${nome} sono arrivati insieme`; verdetto.className = 'did-targhetta did-bene'; }
    } else {
      scrivi('did-lancio-esito', `mancato di ${num(mancatoKm / 1e6, 1)} milioni di km`, 'rosso');
      if (verdetto) { verdetto.textContent = `Mancato: ${nome} era ${num(mancatoKm / 1e6, 1)} milioni di km più ${scartoGradi > 0 ? 'avanti' : 'indietro'}`; verdetto.className = 'did-targhetta did-male'; }
    }

    const sp = $('did-lancio-spiega');
    if (!sp) return;
    if (!lancio.partito) {
      sp.innerHTML = `Per arrivare a ${nome} la sonda deve percorrere <strong>mezza ellisse</strong>
        ${c.interno
          ? `con l'afelio sull'orbita della Terra e il perielio su quella di ${nome}`
          : `col perielio sull'orbita della Terra e l'afelio su quella di ${nome}`}: ci mette
        <strong>${Math.round(c.tVoloGiorni)} giorni</strong>, e questo numero non si può cambiare — lo
        fissa Keplero. Quindi ${nome} al momento del lancio deve trovarsi <strong>${num(Math.abs(c.fase), 0)}°
        ${c.fase >= 0 ? 'più avanti' : 'più indietro'}</strong> della Terra, per essere al punto d'arrivo
        quando ci arriva la sonda. Questa configurazione si ripete
        ${c.sinodico > 400 ? `ogni ${num(c.sinodico / 365.25, 1)} anni` : `ogni ${Math.round(c.sinodico / 30.44)} mesi`}:
        è la finestra di lancio, e fuori da lì non si parte.`;
    } else if (lancio.t >= 1 && !centrato) {
      sp.innerHTML = `Partire ${Math.abs(lancio.scarto)} giorni ${lancio.scarto > 0 ? 'dopo' : 'prima'} non
        sposta l'orbita della sonda — quella è sempre la stessa ellisse, e ci mette sempre
        ${Math.round(c.tVoloGiorni)} giorni. Sposta il pianeta: in quei giorni ${nome} si è mosso di
        <strong>${num(Math.abs(scartoGradi), 1)}°</strong> rispetto a dove doveva stare, che alla sua
        distanza fanno <strong>${num(mancatoKm / 1e6, 1)} milioni di chilometri</strong>. Con il
        propellente di bordo, una correzione così non si paga: si aspetta la finestra dopo.`;
    } else if (lancio.t >= 1) {
      sp.innerHTML = `Centrato. La sonda ha percorso <strong>${Math.round(c.tVoloGiorni)} giorni</strong> di
        volo cieco — nessuna spinta, solo caduta libera attorno al Sole — e ha trovato ${nome} esattamente
        dove doveva essere. È così che si arriva su un pianeta: non si insegue, si dà appuntamento.`;
    } else {
      // Verso l'esterno si sale rallentando, verso l'interno si scende
      // accelerando: è la stessa seconda legge di Keplero letta nei due
      // versi, e dirla al contrario è il modo più rapido di insegnarla male
      sp.innerHTML = `La sonda è in caduta libera. Dopo la ${c.interno ? 'frenata' : 'spinta'} iniziale di
        <strong>${num(c.dv1, 2)} km/s</strong> non accende più niente: ${c.interno
          ? `scende verso il perielio andando sempre più forte (seconda legge di Keplero), e quando ci
             arriva le servirà un'altra spinta di ${num(c.dv2, 2)} km/s per frenare, se no risale`
          : `sale verso l'afelio rallentando (seconda legge di Keplero), e quando ci arriva le servirà
             un'altra spinta di ${num(c.dv2, 2)} km/s per non ricadere indietro`}.`;
    }
  }

  function lancioDisegna() {
    const t = didTela('did-lancio-tela', 1.35, 470, { lente: true, gira: true, pieno: true });
    if (!t || !lancio.conti) return;
    const { ctx, L, H } = t;
    didSfondo(ctx, L, H);
    const c = lancio.conti;
    const raggioMax = Math.max(c.r1, c.r2) * 1.12;
    const scala = Math.min(L, H) * 0.44 / raggioMax;
    const cx = L / 2, cy = H / 2;
    const X = (x) => cx + x * scala;
    const Y = (y) => cy - y * scala;

    didCerchio(ctx, cx, cy, c.r1 * scala, 'rgba(76, 141, 255, 0.28)', 1.2);
    didCerchio(ctx, cx, cy, c.r2 * scala, didVela(CORPI[lancio.meta].colore, 0.28), 1.2);

    // L'ellisse di trasferimento: perielio sull'orbita di partenza,
    // afelio su quella d'arrivo. Si disegna sempre, anche prima di
    // partire — è la strada, e vederla prima aiuta
    const rMin = Math.min(c.r1, c.r2), rMax = Math.max(c.r1, c.r2);
    const at = c.at, et = (rMax - rMin) / (rMax + rMin);
    // Il punto di partenza è la Terra al momento del lancio: lo mettiamo
    // sull'asse x positivo, così la geometria si legge sempre uguale
    ctx.strokeStyle = 'rgba(245, 181, 68, 0.35)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    for (let i = 0; i <= 180; i++) {
      const M = (i / 180) * Math.PI * 2;
      const p = kepPunto(M, et);
      // Nel disegno l'asse maggiore dell'ellisse è orizzontale, col
      // perielio a destra quando si va verso l'esterno
      const segno = c.interno ? -1 : 1;
      const xx = (p.x * at) * segno, yy = (p.y * at) * segno;
      i ? ctx.lineTo(X(xx), Y(yy)) : ctx.moveTo(X(xx), Y(yy));
    }
    ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);

    // Posizioni al tempo mostrato. Il tempo scorre in frazioni di volo.
    // La Terra al lancio è per costruzione il nostro zero: lo scarto di
    // giorni non la sposta (basta ruotare il foglio), sposta la meta.
    const giorni = c.tVoloGiorni * lancio.t;
    const angTerra = (c.omegaTerra * giorni) / GRADI;
    const angMetaVero = (c.fase + lancio.scarto * (c.omega - c.omegaTerra) + c.omega * giorni) / GRADI;

    const tx = X(c.r1 * Math.cos(angTerra)), ty = Y(c.r1 * Math.sin(angTerra));
    const mx = X(c.r2 * Math.cos(angMetaVero)), my = Y(c.r2 * Math.sin(angMetaVero));

    // Il punto d'arrivo previsto, sempre a 180° dalla partenza
    const ax = X(c.r2 * Math.cos(Math.PI)), ay = Y(c.r2 * Math.sin(Math.PI));
    didCerchio(ctx, ax, ay, 7, 'rgba(245, 181, 68, 0.55)', 1.4, [3, 3]);
    didScritta(ctx, 'punto d\'arrivo', ax, ay - 13, { colore: 'rgba(245, 181, 68, 0.8)', misura: 9, allinea: 'center', peso: 600 });

    // L'angolo di fase alla partenza, disegnato come un settore: è la
    // cosa che si deve capire, quindi si vede
    if (!lancio.partito || lancio.t < 0.02) {
      ctx.fillStyle = 'rgba(76, 141, 255, 0.10)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const da = 0, aA = (c.fase + lancio.scarto * (c.omega - c.omegaTerra)) / GRADI;
      ctx.arc(cx, cy, c.r2 * scala * 0.55, -da, -aA, aA > 0);
      ctx.closePath(); ctx.fill();
      didScritta(ctx, `${num(c.fase + lancio.scarto * (c.omega - c.omegaTerra), 0)}°`,
        cx + c.r2 * scala * 0.32 * Math.cos(aA / 2), cy - c.r2 * scala * 0.32 * Math.sin(aA / 2),
        { colore: C.bluChiaro, misura: 12, allinea: 'center', peso: 700 });
    }

    // La sonda lungo la mezza ellisse, col moto vero di Keplero: parte
    // dal perielio (M = 0) e arriva all'afelio (M = π) in mezzo periodo
    //
    // Verso una meta interna il viaggio è al contrario: la partenza è
    // l'*afelio* dell'ellisse — che è l'orbita della Terra, la più larga
    // delle due — e l'arrivo è il perielio. L'anomalia media va quindi da π
    // a 2π, non da 0 a π. Con lo 0–π la sonda faceva il volo alla rovescia e
    // non se ne accorgeva nessuno finché non si guardava: partiva dal punto
    // d'arrivo, girava in senso orario mentre Terra e Venere andavano
    // dall'altra parte, e finiva esattamente dove la Terra era al lancio.
    if (lancio.partito) {
      const punti = [];
      for (let i = 0; i <= 80; i++) {
        const f = (i / 80) * lancio.t;
        const segno = c.interno ? -1 : 1;
        const p = kepPunto(Math.PI * (c.interno ? 1 + f : f), et);
        punti.push({ x: X(p.x * at * segno), y: Y(p.y * at * segno) });
      }
      didPercorso(ctx, punti, { colore: '#f5b544', spessore: 2.2 });
      const ultimo = punti[punti.length - 1];
      didCorpo(ctx, ultimo.x, ultimo.y, 4, '#ffffff', { alone: 3 });
    }

    didCorpo(ctx, cx, cy, Math.max(8, scala * 0.05), C.sole, { alone: 3.4 });
    didCorpo(ctx, tx, ty, 5.5, C.terra);
    didScritta(ctx, 'Terra', tx + 9, ty + 4, { colore: C.bluChiaro, misura: 10 });
    didCorpo(ctx, mx, my, 6, CORPI[lancio.meta].colore, { anelli: lancio.meta === 'Saturn' });
    didScritta(ctx, CORPI[lancio.meta].nome, mx + 10, my + 4, { colore: CORPI[lancio.meta].colore, misura: 10 });
  }

  // ===================================================================
  // 7. ESPERIMENTO 5 — GLI ALLINEAMENTI
  //
  //   Cercare quando i pianeti si mettono in fila è un lavoro da
  //   calcolatore, ed è il tipo di conto che un'app può fare mentre uno
  //   guarda: qualche migliaio di istanti, la dispersione degli angoli, i
  //   minimi. Il punto era non bloccare la pagina mentre lo fa — prima la
  //   ricerca girava tutta dentro a un clic, e su vent'anni il telefono
  //   restava fermo per qualche secondo, senza nemmeno poter dire a che
  //   punto era. Adesso va a pezzetti, un pezzetto per fotogramma, con la
  //   barra che avanza.
  //
  //   E soprattutto: la congiunzione si misura come si vede, cioè come
  //   distanza angolare vera fra due direzioni nel cielo, non come
  //   differenza di longitudine. Due pianeti alla stessa longitudine ma a
  //   sei gradi di latitudine l'uno dall'altro non sono affatto vicini.
  // ===================================================================

  const allin = {
    scelti: { Mercury: false, Venus: true, Earth: true, Mars: true, Jupiter: true, Saturn: true, Uranus: false, Neptune: false },
    anni: 5,
    lavoro: null,
    risultati: []
  };

  laboratorio({
    id: 'allineamenti',
    chip: 'Allineamenti',
    occhiello: 'Concetto 5 — quando si mettono in fila',
    titolo: 'Trova quando i pianeti si allineano davvero',
    sommario: `Due modi di stare in fila, e vanno tenuti distinti. <em>Allineamento eliocentrico</em>:
      i pianeti stanno tutti dalla stessa parte del Sole — è una configurazione vera del Sistema Solare,
      ma non si vede. <em>Congiunzione</em>: due pianeti si trovano vicini nel nostro cielo, e quella si
      vede benissimo — anche se nello spazio sono lontanissimi. Questo banco cerca l'una e l'altra nelle
      posizioni vere dei prossimi anni.`,

    costruisci() {
      return `
        <div class="did-riga did-riga-avvolgi" id="did-allin-pianeti">
          ${Object.keys(CORPI).map(k => `
            <button type="button" class="did-pillola${allin.scelti[k] ? ' attiva' : ''}" data-pianeta="${k}">
              <span class="did-pallino" style="background:${CORPI[k].colore}"></span>${CORPI[k].nome}
            </button>`).join('')}
        </div>

        <div class="did-riga did-riga-fine">
          <div class="segmenti-cielo" id="did-allin-periodo">
            <button type="button" class="tasto-segmento attiva" data-anni="5">5 anni</button>
            <button type="button" class="tasto-segmento" data-anni="10">10 anni</button>
            <button type="button" class="tasto-segmento" data-anni="25">25 anni</button>
          </div>
          <button type="button" class="did-tasto did-primario" id="did-allin-cerca">Cerca</button>
        </div>

        <div class="did-avanzamento hidden" id="did-allin-avanzamento">
          <div class="did-avanzamento-barra"><i id="did-allin-barra"></i></div>
          <span id="did-allin-nota">—</span>
        </div>

        <div class="did-risultati" id="did-allin-lista">
          <p class="did-vuoto">Scegli i pianeti e premi <strong>Cerca</strong>: l'app scorre le posizioni
            vere giorno per giorno e tiene solo le configurazioni più strette.</p>
        </div>

        <p class="did-nota">Un «allineamento» perfetto non esiste: le orbite sono inclinate l'una sull'altra,
          e la fila è sempre approssimata. Qui la misura è lo <strong>scarto</strong>: il settore angolare
          più stretto che contiene tutti i pianeti scelti. Sotto i dieci gradi si può già parlare di fila.</p>`;
    },

    collega() {
      const pian = $('did-allin-pianeti');
      if (pian) pian.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pianeta]');
        if (!b) return;
        const k = b.dataset.pianeta;
        allin.scelti[k] = !allin.scelti[k];
        b.classList.toggle('attiva', allin.scelti[k]);
      });
      const per = $('did-allin-periodo');
      if (per) per.addEventListener('click', (e) => {
        const b = e.target.closest('[data-anni]');
        if (!b) return;
        per.querySelectorAll('[data-anni]').forEach(x => x.classList.toggle('attiva', x === b));
        allin.anni = Number(b.dataset.anni);
      });
      const cerca = $('did-allin-cerca');
      if (cerca) cerca.addEventListener('click', allinAvvia);

      const lista = $('did-allin-lista');
      if (lista) lista.addEventListener('click', (e) => {
        const b = e.target.closest('[data-vai]');
        if (!b) return;
        const r = allin.risultati[Number(b.dataset.indice)];
        if (!r) return;
        if (b.dataset.vai === 'cielo') didVaiInCielo(r.data, r.primo);
        else didVaiInTreD(r.data);
      });
    },

    esce() { allin.lavoro = null; },

    passo() { if (allin.lavoro) allinLavora(); }
  });

  function allinAvvia() {
    if (typeof Astronomy === 'undefined') return;
    const scelti = Object.keys(allin.scelti).filter(k => allin.scelti[k]);
    const lista = $('did-allin-lista');
    if (scelti.length < 2) {
      if (lista) lista.innerHTML = `<p class="did-vuoto did-male">Servono almeno due pianeti.</p>`;
      return;
    }
    const passo = 3;                       // giorni fra un campione e l'altro
    allin.lavoro = {
      scelti,
      visti: scelti.filter(k => k !== 'Earth'),   // dalla Terra, la Terra non si vede
      passo,
      totale: Math.round(allin.anni * 365.25 / passo),
      fatto: 0,
      da: didAdesso(),
      trovati: [],
      tracce: {}
    };
    allin.risultati = [];
    const av = $('did-allin-avanzamento');
    if (av) av.classList.remove('hidden');
    if (lista) lista.innerHTML = `<p class="did-vuoto">Ricerca in corso…</p>`;
  }

  // Un pezzetto per fotogramma: quanto basta a restare sotto i pochi
  // millisecondi, così l'animazione degli altri banchi (e lo scorrimento
  // della pagina) non se ne accorgono nemmeno.
  function allinLavora() {
    const L = allin.lavoro;
    if (!L) return;
    const fine = Math.min(L.totale, L.fatto + 70);

    for (; L.fatto < fine; L.fatto++) {
      const d = new Date(L.da.getTime() + L.fatto * L.passo * GIORNO_MS);
      try {
        const t = Astronomy.MakeTime(d);

        // 1. La fila vista dal Sole: quanto è stretto il settore che
        //    contiene tutti i pianeti scelti
        const lon = L.scelti.map(k => Astronomy.Ecliptic(Astronomy.HelioVector(k, t)).elon);
        allinTraccia(L, 'elio', allinDispersione(lon), d, L.scelti);

        // 2. Le vicinanze viste da qui. Si guarda **ogni coppia**, non
        //    solo il gruppo intero: la domanda vera che uno si fa è «e
        //    quando li vedo vicini?», e Venere accanto a Giove è una
        //    vista che capita spesso — mentre tutti e cinque insieme
        //    dentro a pochi gradi non capita quasi mai, e cercando solo
        //    quello la risposta era sempre «niente trovato». La misura è
        //    l'angolo vero fra le due direzioni, non la differenza di
        //    longitudine: due pianeti alla stessa longitudine ma a sei
        //    gradi di latitudine l'uno dall'altro non sono vicini.
        if (L.visti.length >= 2) {
          const dir = L.visti.map(k => {
            const v = Astronomy.GeoVector(k, t, true);
            const n = Math.hypot(v.x, v.y, v.z) || 1;
            return { k, x: v.x / n, y: v.y / n, z: v.z / n };
          });
          let peggio = 0;
          for (let i = 0; i < dir.length; i++) {
            for (let j = i + 1; j < dir.length; j++) {
              const cos = Math.max(-1, Math.min(1, dir[i].x * dir[j].x + dir[i].y * dir[j].y + dir[i].z * dir[j].z));
              const ang = Math.acos(cos) * GRADI;
              allinTraccia(L, 'c:' + dir[i].k + '|' + dir[j].k, ang, d, [dir[i].k, dir[j].k]);
              if (ang > peggio) peggio = ang;
            }
          }
          // 3. E il raduno: tutti quanti dentro allo stesso pezzo di cielo
          if (dir.length >= 3) allinTraccia(L, 'raduno', peggio, d, L.visti);
        }
      } catch (e) { /* una data fuori catalogo non ferma la ricerca */ }
    }

    const barra = $('did-allin-barra');
    if (barra) barra.style.width = Math.round(L.fatto / L.totale * 100) + '%';
    const nota = $('did-allin-nota');
    if (nota) nota.textContent = `${Math.round(L.fatto / L.totale * 100)}% dei giorni esaminati`;

    if (L.fatto >= L.totale) { allinConcludi(L); }
  }

  // Il segno che si è toccato il fondo della valle: finché il valore
  // scende si aggiorna il candidato, appena risale si registra quello di
  // prima. Niente doppioni a grappolo e nessun secondo giro di
  // filtraggio — la data che esce è il giorno più stretto, non il primo
  // giorno sotto una soglia.
  function allinTraccia(L, chiave, valore, data, corpi) {
    const p = L.tracce[chiave];
    if (!p) { L.tracce[chiave] = { scarto: valore, data, corpi, scendendo: true }; return; }
    if (valore < p.scarto) { L.tracce[chiave] = { scarto: valore, data, corpi, scendendo: true }; return; }
    if (p.scendendo) {
      L.trovati.push({
        tipo: chiave === 'elio' ? 'elio' : chiave === 'raduno' ? 'raduno' : 'coppia',
        scarto: p.scarto, data: p.data, corpi: p.corpi.slice()
      });
    }
    L.tracce[chiave] = { scarto: valore, data, corpi, scendendo: false };
  }

  // Il settore angolare più stretto che contiene tutti: si ordinano gli
  // angoli, si cerca il buco più largo fra due consecutivi, e quello che
  // resta è la fila. È il conto giusto, e sta in quattro righe.
  function allinDispersione(gradi) {
    const g = gradi.slice().sort((a, b) => a - b);
    let buco = 0;
    for (let i = 0; i < g.length; i++) {
      const d = ((i === g.length - 1 ? g[0] + 360 : g[i + 1]) - g[i] + 360) % 360;
      if (d > buco) buco = d;
    }
    return 360 - buco;
  }

  // La scelta di cosa vale la pena mostrare. Le congiunzioni hanno una
  // soglia vera (cinque gradi: sotto, i due pianeti stanno nello stesso
  // sguardo); per le file dal Sole invece la soglia non ha senso —
  // dipende da quanti pianeti si sono scelti — e si tengono
  // semplicemente le più strette del periodo. Così la risposta non è mai
  // «non ho trovato niente», che è la risposta più inutile che ci sia.
  function allinConcludi(L) {
    const coppie = L.trovati.filter(r => r.tipo === 'coppia' && r.scarto < 5);
    const raduni = L.trovati.filter(r => r.tipo === 'raduno' && r.scarto < 25);
    // Quanto stretta può diventare la fila dipende da quanti pianeti si
    // sono scelti: due si allineano di continuo, cinque quasi mai. La
    // soglia si allarga con loro, se no con cinque pianeti la sezione
    // «fila dal Sole» sarebbe sempre vuota — e con due sarebbe piena di
    // roba banale.
    const soglia = 10 + 6 * Math.max(0, L.scelti.length - 2);
    const tutteElio = L.trovati.filter(r => r.tipo === 'elio').sort((a, b) => a.scarto - b.scarto);
    allin.migliorElio = tutteElio[0] || null;
    allin.numeroScelti = L.scelti.length;
    const elio = tutteElio.filter(r => r.scarto < soglia).slice(0, 6);

    allin.risultati = coppie.concat(raduni, elio)
      .sort((a, b) => a.data - b.data)
      .slice(0, 30)
      .map(r => Object.assign(r, {
        primo: r.corpi.find(k => k !== 'Earth') || r.corpi[0],
        elongazione: allinElongazione(r)
      }));

    allin.lavoro = null;
    const av = $('did-allin-avanzamento');
    if (av) av.classList.add('hidden');
    allinMostra();
  }

  // Quanto sta lontano dal Sole in cielo, cioè: si riesce a vederlo, o è
  // annegato nel chiarore? Senza questo numero una congiunzione
  // "spettacolare" a otto gradi dal Sole manderebbe qualcuno fuori a
  // cercare una cosa invisibile.
  function allinElongazione(r) {
    if (r.tipo === 'elio') return null;
    try { return Astronomy.AngleFromSun(r.primo, Astronomy.MakeTime(r.data)); }
    catch (e) { return null; }
  }

  function allinComeSiVede(gradi) {
    if (gradi < 0.5) return 'più vicini di una Luna piena: sembrano quasi una stella sola';
    if (gradi < 1.5) return 'entro tre dischi di Luna: entrambi nello stesso campo del binocolo';
    if (gradi < 3) return 'un dito a braccio teso li copre tutti e due';
    return 'due dita a braccio teso: una coppia che si nota subito';
  }

  function allinMostra() {
    const lista = $('did-allin-lista');
    if (!lista) return;

    // La riga di riepilogo risponde alla domanda che uno si è fatto
    // premendo «Cerca», anche quando la risposta è «mai». Prima, con
    // cinque pianeti scelti, la ricerca finiva con un «non ho trovato
    // niente» che sembrava un guasto: invece è il risultato, e detto così
    // insegna qualcosa — più pianeti si mettono nel conto, più la fila
    // diventa impossibile.
    let riassunto = '';
    if (allin.migliorElio) {
      const m = allin.migliorElio;
      const n = allin.numeroScelti;
      riassunto = `<p class="did-riassunto">Nei prossimi ${allin.anni} anni la fila più stretta di questi
        ${n} pianeti attorno al Sole è di <strong>${num(m.scarto, 0)}°</strong>, il ${didDataBreve(m.data)}.
        ${m.scarto > 60
          ? `Cioè: non si allineano affatto, e non è un caso — con ${n} pianeti che girano a velocità tutte
             diverse, trovarli nello stesso spicchio è praticamente impossibile. Togline qualcuno e guarda
             come cambia.`
          : m.scarto > 25
            ? 'Un bel raggruppamento, ma non una fila: a occhio, dall\'esterno, si vedrebbe un ventaglio.'
            : 'Una fila vera e propria — con questi pianeti è un evento raro.'}</p>`;
    }

    if (!allin.risultati.length) {
      lista.innerHTML = riassunto + `<p class="did-vuoto">Nessuna configurazione stretta da segnalare.
        Prova con un periodo più lungo, o con Venere e Giove: sono i due che si incontrano più spesso, e
        sono anche i due più luminosi del cielo.</p>`;
      return;
    }
    lista.innerHTML = riassunto + allin.risultati.map((r, i) => {
      const nomi = r.corpi.map(k => CORPI[k].nome);
      const pallini = r.corpi.map(k => `<span class="did-pallino" style="background:${CORPI[k].colore}"></span>`).join('');
      const basso = r.elongazione !== null && r.elongazione < 18;
      const forte = r.tipo === 'coppia' ? r.scarto < 1.5 : r.tipo === 'raduno' ? r.scarto < 12 : r.scarto < 12;
      const marchio = r.tipo === 'elio' ? ['did-marchio-elio', 'fila dal Sole']
        : r.tipo === 'raduno' ? ['did-marchio-raduno', 'raduno in cielo']
        : ['did-marchio-geo', 'congiunzione'];

      let testo;
      if (r.tipo === 'elio') {
        testo = `Tutti dalla stessa parte del Sole, dentro a un settore di ${num(r.scarto, 0)}°: è la
          configurazione più stretta che questi pianeti raggiungono nel periodo cercato. È una posizione
          vera dello spazio, e si vede solo dall'esterno — dalla Terra non ci si accorge di niente.`;
      } else if (r.tipo === 'raduno') {
        testo = `Tutti e ${r.corpi.length} dentro a ${num(r.scarto, 0)}° di cielo: un raduno che si vede
          a occhio nudo, se il Sole non è di mezzo.`;
      } else {
        testo = `${nomi[0]} e ${nomi[1]} a <strong>${num(r.scarto, 1)}°</strong> l'uno dall'altro —
          ${allinComeSiVede(r.scarto)}.`;
      }
      const avviso = basso
        ? `<p class="did-esito-avviso">Attenzione: a ${num(r.elongazione, 0)}° dal Sole, quindi bassissima
           sull'orizzonte e immersa nel crepuscolo. Difficile, ma non impossibile.</p>`
        : '';

      return `
        <article class="did-esito${forte ? ' did-esito-forte' : ''}">
          <div class="did-esito-testa">
            <span class="did-marchio ${marchio[0]}">${marchio[1]}</span>
            <strong class="did-esito-data">${didData(r.data)}</strong>
            <span class="did-esito-scarto">${num(r.scarto, r.tipo === 'coppia' ? 1 : 0)}°</span>
          </div>
          <p class="did-esito-corpi">${pallini}${nomi.join(' · ')}</p>
          <p class="did-esito-testo">${testo}</p>
          ${avviso}
          <div class="did-esito-tasti">
            ${r.tipo !== 'elio' ? `<button type="button" class="did-tasto" data-vai="cielo" data-indice="${i}">Guardalo in cielo</button>` : ''}
            <button type="button" class="did-tasto" data-vai="tred" data-indice="${i}">Vedilo dall'esterno</button>
          </div>
        </article>`;
    }).join('');
  }


  // ===================================================================
  // 8. ESPERIMENTO 6 — LE AURORE POLARI
  //
  //   Delle cose che si vedono in cielo, l'aurora è l'unica che non
  //   viene dalla meccanica celeste. Non c'è un'orbita da cui ricavarla
  //   e non c'è una data da scrivere in calendario: c'è il Sole che
  //   soffia, la Terra che si difende, e il punto in cui la difesa cede.
  //
  //   È anche la cosa che più di tutte viene raccontata male. «Le
  //   particelle del Sole colpiscono l'atmosfera ai poli» è una frase
  //   che sta in una riga e sbaglia due volte: le particelle del vento
  //   solare non arrivano quasi mai dritte fin qui — è il campo
  //   terrestre a portarcele, e le prende dalla coda, cioè da dietro,
  //   non dal davanti — e non arrivano *al polo*, arrivano su un
  //   **anello** attorno al polo, che sopra il polo lascia un buco. Chi
  //   va in Lapponia e guarda a nord aspettandosi il massimo verso il
  //   polo, non di rado ce l'ha dietro le spalle.
  //
  //   Il banco fa vedere la catena intera, e la fa vedere in tre
  //   dimensioni, perché in due non si capisce: la magnetosfera è un
  //   solido, la coda è un tubo, e l'ovale è un anello che si può solo
  //   guardare da fuori. Quattro quadri sulla stessa scena — si gira col
  //   dito e l'inquadratura si sposta da sola — e un quinto quadro che è
  //   un taglio visto di lato, quello che risponde alla domanda che in
  //   Italia si sono fatti tutti: «ma allora perché a me è venuta rossa?».
  //
  //   I NUMERI. La magnetopausa e l'onda d'urto sono il modello di Shue
  //   et al. (1997), che sta in `aurora-polare.js` §7 e che
  //   `verifica.html` controlla. Le linee di campo sono dipolari
  //   (r = L·cos²λ) e vengono poi stirate dal vento con una regola
  //   dichiarata sotto al disegno. L'ovale è `aurBordo()` e
  //   `aurSpessore()`: le stesse due funzioni con cui il planetario
  //   disegna l'aurora vera, quindi l'anello che si vede qui e le tende
  //   che si vedono là sono lo stesso oggetto guardato da due parti. Il
  //   taglio di lato è `aurAltezza()`, cioè la Terra tonda: quello è a
  //   scala vera, curvatura e quote comprese, senza nessuna esagerazione.
  //
  //   Il ponte finale non è il solito «guardalo stasera»: da qui stasera
  //   non c'è niente da guardare. È un elenco di posti e di notti in cui
  //   l'aurora c'è stata **davvero**, e ogni riga porta il planetario lì:
  //   altro luogo, altra data, l'ovale acceso col Kp di quella notte. È
  //   l'unico modo onesto di far vedere un'aurora a chi vive a
  //   quarantacinque gradi di latitudine.
  // ===================================================================

  const RE_KM = 6371;                  // un raggio terrestre, in km
  const AURL_SOLE_X = 200;             // dov'è il Sole nella scena, in raggi terrestri
  const AURL_ORE = 60;                 // quanto dura la storia
  const AURL_VIAGGIO_H = 45;           // quanto ci mette la nube ad arrivare
  const AURL_TILT = 18;                // inclinazione del dipolo sul vento, in gradi
  const AURL_CODA_MAX = 78;            // fin dove si disegna la coda, in raggi terrestri
  const AURL_QUOTA_ALTA = 380;         // la cima delle tende, in km

  const CA = {
    sole:   '#ffc94d',
    vento:  '#7dd3fc',
    nube:   '#f0abfc',
    urto:   '#94a3b8',
    scudo:  '#8ab4ff',
    coda:   '#a78bfa',
    chiusa: '#5eead4',
    aperta: '#c4b5fd',
    verde:  '#5cf5a0',
    rosso:  '#ff6b7a',
    casa:   '#ffe066'
  };

  // I cinque quadri. `centro` e `campo` sono l'inquadratura (in raggi
  // terrestri), `elev` l'altezza da cui si guarda finché non ci si mette
  // il dito.
  const AURL_QUADRI = {
    vento: {
      chip: 'Il Sole soffia',
      centro: [-95, 0, 0], campo: 128, elev: 14, az: -90,
      // Ogni quadro ha la sua finestra di tempo, e la barra si accorcia su
      // quella. Con un'unica barra da sessanta ore aprire «la scarica» e
      // trovare la coda tranquilla — perché la nube è ancora a mezza
      // strada, o perché la tempesta è già passata — era il modo più veloce
      // di far credere che il banco fosse rotto. Adesso ogni quadro gira
      // sul pezzo di storia che racconta.
      finestra: [0, 47],
      targhetta: 'Dal Sole alla Terra — <em>distanze compresse 117 volte</em>',
      titolo: 'Il vento non smette mai, ogni tanto arriva una folata',
      testo: `La corona solare è così calda che il Sole non riesce a tenersela: perde di continuo un
        milione di tonnellate al secondo di gas elettricamente carico, che si allarga in tutte le
        direzioni a quattrocento chilometri al secondo. Quello è il <strong>vento solare</strong>, e
        c'è sempre. Ogni tanto, da una regione attiva, parte in più una bolla: un miliardo di
        tonnellate di plasma con dentro un pezzo del campo magnetico solare, sparata a mille
        chilometri al secondo. Si chiama <em>espulsione di massa coronale</em>, e ci mette un giorno
        o due ad arrivare. Scorri la barra: quello che vedi partire adesso lo sapremo fra due giorni.`
    },
    scudo: {
      chip: 'Lo scudo',
      centro: [12, 0, 0], campo: 52, elev: 16, az: -90,
      finestra: [38, 54],
      targhetta: 'La magnetosfera nel vento — <em>magnetopausa di Shue (1997)</em>',
      titolo: 'Perché il vento solare non ci arriva addosso',
      testo: `Il campo magnetico terrestre non è un guscio: è un ostacolo in un fiume. Il vento lo
        schiaccia dalla parte del Sole fino a fermarsi dove le due pressioni si pareggiano — il
        <strong>naso</strong> della magnetopausa, una decina di raggi terrestri, sessantacinquemila
        chilometri — e se lo porta dietro dall'altra parte in una <strong>coda</strong> lunga
        centinaia di raggi. Più avanti ancora c'è l'<em>onda d'urto</em>: il vento arriva
        supersonico e lì frena di colpo, come l'acqua davanti alla prua. Guarda il naso mentre la
        nube arriva: sotto tempesta si schiaccia quasi a metà, e i satelliti geostazionari — che
        stanno a 6,6 raggi — si sono trovati per qualche ora <em>fuori</em> dalla magnetosfera.`
    },
    scarica: {
      chip: 'La scarica',
      centro: [26, 0, 0], campo: 58, elev: 18, az: -90,
      finestra: [45.2, 55],
      targhetta: 'La coda che si carica e si rompe — <em>la sottotempesta</em>',
      titolo: 'L\'aurora non viene dal davanti: viene da dietro',
      testo: `Qui sta il pezzo che quasi nessuno racconta. Se il campo magnetico della nube è rivolto a
        <strong>sud</strong>, cioè al contrario del nostro, sul naso le linee di campo si
        <em>riconnettono</em>: si aprono, e il vento se le trascina dietro nella coda. La coda si
        carica come una molla, per una mezz'ora o un'ora. Poi si rompe nel mezzo — un secondo punto
        di riconnessione, a una ventina di raggi — e succedono due cose insieme: un pezzo di coda se
        ne va verso l'esterno, e tutto il resto scatta indietro verso la Terra sparando elettroni
        lungo le linee di campo. È la <strong>sottotempesta</strong>, dura una decina di minuti, e
        quegli elettroni finiscono in fondo alle linee — cioè attorno ai poli.`
    },
    anello: {
      chip: 'L\'anello',
      centro: [0, 0, 0], campo: 3.2, elev: 40, az: -118,
      finestra: [43, 58],
      targhetta: 'L\'ovale aurorale, boreale e australe — <em>quote ingrandite 6 volte</em>',
      titolo: 'Non è al polo: è un anello attorno al polo',
      testo: `Le linee di campo che raccolgono gli elettroni della coda non finiscono al polo: finiscono
        su un <strong>anello</strong> largo qualche grado attorno al polo <em>geomagnetico</em>, che
        a sua volta non sta sul polo geografico. L'anello è schiacciato verso il lato notte, sta
        fermo rispetto al Sole, ed è la Terra che gli gira sotto: per questo l'ora migliore è la
        mezzanotte magnetica, e per questo il tuo paese ci passa sotto una volta al giorno — guarda
        il pallino giallo mentre scorre la barra. Più la tempesta è forte, più l'anello si allarga
        verso l'equatore: è tutto lì il motivo per cui certe notti si vede anche da sud. E ce ne
        sono due, uguali e opposti: quello che si guarda dalla Norvegia e quello che si guarda dalla
        Tasmania sono i due capi delle stesse linee di campo, e si accendono negli stessi minuti.`
    },
    taglio: {
      chip: 'Perché da qui è rossa',
      targhetta: 'Il taglio visto di lato, alla mezzanotte magnetica — <em>curvatura e quote a scala vera</em>',
      titolo: 'La Terra è tonda, e l\'aurora ha un\'altezza',
      testo: `Questo quadro non è una scena, è un taglio, e risponde alla domanda che in Italia si sono
        fatti tutti nel maggio 2024. L'aurora non è una luce appoggiata sull'orizzonte: è un volume
        di atmosfera fra i 100 e i 400 chilometri, e ogni quota ha il suo colore, perché ogni quota
        ha la sua riga di emissione. Se l'ovale è a mille chilometri da te, la curvatura della Terra
        ti nasconde il fondo della tenda e ti lascia vedere solo la cima: sotto l'orizzonte resta il
        verde dell'ossigeno a 120 km, si affaccia il rosso dello stesso ossigeno a 250. Non c'è
        nessuna regola scritta da qualche parte che dica «in Italia fai il rosso»: viene fuori da qui.`
    }
  };

  // I posti e le notti in cui l'aurora c'è stata davvero. Sono quattro
  // perché sono quattro casi diversi, non quattro cartoline: l'ovale
  // addosso, l'ovale accanto, il solo rosso da lontano, e l'altro
  // emisfero.
  const AURL_METE = [
    {
      id: 'tromso', nome: 'Tromsø', paese: 'Norvegia', lat: 69.65, lon: 18.96,
      quando: Date.UTC(2024, 11, 21, 21, 0), kp: 4, kpVero: false,
      titolo: 'L\'ovale sopra la testa',
      testo: `Notte del solstizio, dentro al circolo polare: il Sole non sorge e il buio dura
        ventiquattr'ore. A questa latitudine geomagnetica non serve una tempesta — con un Kp 4, che
        capita più volte al mese, l'ovale passa proprio di sopra e le tende scendono dallo zenit.
        È l'aurora delle fotografie.`
    },
    {
      id: 'fairbanks', nome: 'Fairbanks', paese: 'Alaska', lat: 64.84, lon: -147.72,
      quando: Date.UTC(2025, 2, 21, 7, 0), kp: 5, kpVero: false,
      titolo: 'L\'equinozio, cioè la stagione giusta',
      testo: `La notte dell'equinozio di marzo, che statisticamente è il periodo dell'anno con più
        tempeste (è l'effetto Russell-McPherron, quello per cui il calendario segna la «stagione
        delle aurore»). Fairbanks sta appena a sud dell'ovale tranquillo: con un Kp 5 l'anello le
        scende addosso e l'arco passa allo zenit verso mezzanotte.`
    },
    {
      id: 'padana', nome: 'Pianura Padana', paese: 'Italia', lat: 44.49, lon: 11.34,
      quando: Date.UTC(2024, 4, 10, 21, 0), kp: 9, kpVero: true,
      titolo: 'Il cielo rosso del maggio 2024',
      testo: `La sera del 10 maggio 2024, tempesta di Gannon: Kp 9, la più forte dal 2003. Mezza Italia
        ha fotografato un cielo <em>rosso</em> a nord, e quasi nessuno lì per lì ha capito perché — dai
        posti più bui e più a nord si è visto anche un accenno di verde, ma bassissimo. Con un Kp così
        l'ovale scende a quattrocento chilometri da qui, ed è la sola volta in vent'anni che è successo:
        con la slitta del quadro «Perché da qui è rossa» si vede a che Kp il verde comincia ad
        affacciarsi, e quanto ci vuole ad arrivarci.`
    },
    {
      id: 'hobart', nome: 'Hobart', paese: 'Tasmania', lat: -42.88, lon: 147.33,
      quando: Date.UTC(2024, 4, 11, 12, 0), kp: 8, kpVero: true,
      titolo: 'La stessa tempesta, dall\'altra parte',
      testo: `La notte dopo, dall'emisfero sud. La stessa nube, la stessa tempesta, l'ovale
        <em>australe</em> — che non è un'altra aurora: è l'altro capo delle stesse linee di campo. Da
        Hobart si guarda a sud, e tutto il resto funziona identico.`
    }
  ];

  const AURL_LUOGHI = [
    { id: 'casa', nome: 'Casa mia' },
    { id: 'tromso', nome: 'Tromsø', lat: 69.65, lon: 18.96 },
    { id: 'reykjavik', nome: 'Reykjavík', lat: 64.15, lon: -21.94 },
    { id: 'edimburgo', nome: 'Edimburgo', lat: 55.95, lon: -3.19 },
    { id: 'padana', nome: 'Pianura Padana', lat: 44.49, lon: 11.34 },
    { id: 'hobart', nome: 'Hobart', lat: -42.88, lon: 147.33 }
  ];

  const aurL = {
    quadro: 'vento',
    t: 0,                 // ore dall'eruzione
    marcia: true,
    velocita: 1,
    cam: { az: -90, elev: 14 },
    camV: { az: -90, elev: 14 },
    trascina: null,
    luogo: 'casa',
    // Sei è il Kp da cui partire, e non è un numero a caso: è la tempesta
    // forte ma non irripetibile, quella che dalle nostre latitudini fa
    // esattamente il caso che il quadro racconta — il verde ancora sotto
    // la curvatura, il rosso già sopra l'orizzonte.
    kpTaglio: 6,
    // le due memorie: le linee di campo e la risposta «da qui cosa si
    // vedrebbe» costano troppo per rifarle sessanta volte al secondo, e
    // cambiano molto più piano di così
    campo: { chiave: '', linee: null },
    visto: new Map(),
    ore: new Map()
  };

  // -------------------------------------------------- la tempesta
  // Il vento in funzione delle ore: prima della nube è quello di tutti i
  // giorni, poi in un'ora sale a valori da tempesta e poi decade in
  // mezza giornata. `s` è il solo parametro che conta: 0 = quiete, 1 = il
  // colpo. Non è un modello del Sole, è la forma che ha una tempesta
  // vera, e i valori agli estremi sono quelli misurati.
  function aurLVento(t) {
    const d = t - AURL_VIAGGIO_H;
    const s = d < 0 ? 0 : (d < 1 ? d : Math.exp(-(d - 1) / 10));
    return {
      s,
      p: 2 + 18 * s,             // pressione dinamica, nPa
      bz: -1 - 24 * s,           // campo interplanetario verso sud, nT
      v: 400 + 520 * s           // velocità, km/s
    };
  }

  function aurLKp(t) {
    const s = aurLVento(t).s;
    return Math.max(1, Math.min(9, 1.5 + 7.3 * Math.pow(s, 0.75)));
  }

  // La sottotempesta: la coda si carica per un paio d'ore e poi si scarica
  // in dieci minuti. È il ciclo che fa comparire e sparire gli archi
  // mentre uno sta lì a guardare — ed è il motivo per cui chi esce, vede
  // niente per venti minuti e rientra, si perde l'aurora.
  const AURL_CICLO_H = 2.4;
  function aurLSottotempesta(t) {
    const d = t - AURL_VIAGGIO_H;
    if (d < 0.3) return { carica: 0, luce: 0.06, scarica: false };
    const f = ((d - 0.3) % AURL_CICLO_H) / AURL_CICLO_H;
    if (f < 0.78) return { carica: f / 0.78, luce: 0.12 + 0.2 * (f / 0.78), scarica: false };
    const u = (f - 0.78) / 0.22;
    return { carica: 1 - u, luce: 0.35 + 0.65 * Math.sin(u * Math.PI), scarica: true };
  }

  // Dov'è la nube adesso, sull'asse Sole-Terra
  function aurLNube(t) {
    const q = Math.max(0, Math.min(1.4, t / AURL_VIAGGIO_H));
    return {
      x: -AURL_SOLE_X + AURL_SOLE_X * q,
      // il raggio della calotta è la strada che il fronte ha già fatto: a
      // q = 1 il naso della nube è esattamente sulla Terra
      raggioFronte: Math.max(6, AURL_SOLE_X * q),
      q,
      partita: t > 0.4
    };
  }

  // -------------------------------------------------- lo scudo
  function aurLUrtoAvanti() { return typeof AUR_URTO_AVANTI === 'number' ? AUR_URTO_AVANTI : 1.28; }
  function aurLUrtoApertura() { return typeof AUR_URTO_APERTURA === 'number' ? AUR_URTO_APERTURA : 1.42; }
  function aurLThetaMax() { return typeof AUR_MP_THETA_MAX === 'number' ? AUR_MP_THETA_MAX : 2.55; }

  function aurLMagnetopausa(theta, r0, alfa) {
    if (typeof aurMagnetopausa === 'function') return aurMagnetopausa(theta, r0, alfa);
    const t = Math.min(Math.abs(theta), aurLThetaMax());
    return r0 * Math.pow(2 / (1 + Math.cos(t)), alfa);
  }

  function aurLScudo(t) {
    const v = aurLVento(t);
    const r0 = typeof aurStandoff === 'function' ? aurStandoff(v.p, v.bz) : 10.3;
    const alfa = typeof aurAperturaCoda === 'function' ? aurAperturaCoda(v.p, v.bz) : 0.59;
    return { r0, alfa, codaR: aurLMagnetopausa(2.2, r0, alfa) * Math.sin(2.2), v };
  }

  // Il profilo della magnetopausa come tabella (x, raggio perpendicolare).
  // Da qui esce sia il disegno della superficie sia la deviazione dei fili
  // di vento, che devono girarci attorno senza attraversarla.
  function aurLProfilo(s, n, avanti, apertura) {
    const r0 = s.r0 * (avanti || 1);
    const alfa = Math.min(1.05, s.alfa * (apertura || 1));
    const t = [];
    const max = aurLThetaMax();
    for (let i = 0; i <= n; i++) {
      const th = max * i / n;
      const r = aurLMagnetopausa(th, r0, alfa);
      const x = -r * Math.cos(th);
      if (x > AURL_CODA_MAX) break;
      t.push({ x, rho: r * Math.sin(th) });
    }
    return t;
  }

  function aurLRho(prof, x) {
    if (!prof.length) return 0;
    if (x <= prof[0].x) return 0;
    const ultimo = prof[prof.length - 1];
    if (x >= ultimo.x) return ultimo.rho;
    for (let i = 1; i < prof.length; i++) {
      if (prof[i].x >= x) {
        const a = prof[i - 1], b = prof[i];
        const u = (x - a.x) / ((b.x - a.x) || 1);
        return a.rho + (b.rho - a.rho) * u;
      }
    }
    return ultimo.rho;
  }

  // -------------------------------------------------- la telecamera
  function aurLVista(L, H, centro, campo) {
    const az = aurL.cam.az * Math.PI / 180, el = aurL.cam.elev * Math.PI / 180;
    const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
    return {
      L, H, cx: L / 2, cy: H / 2, c: centro,
      scala: Math.min(L * 0.47, H * 0.86) / campo,
      r: [-sa, ca, 0],
      u: [-se * ca, -se * sa, ce],
      f: [ce * ca, ce * sa, se]
    };
  }

  // La profondità (`z`) si misura dall'**origine**, cioè dalla Terra, non
  // dal centro dell'inquadratura: se no bastava spostare la telecamera
  // lungo la coda perché la metà «davanti» del globo diventasse quella
  // sbagliata, e l'ovale si disegnava dalla parte nascosta.
  function aurLPro(p, w) {
    const dx = p[0] - w.c[0], dy = p[1] - w.c[1], dz = p[2] - w.c[2];
    return {
      x: w.cx + (dx * w.r[0] + dy * w.r[1] + dz * w.r[2]) * w.scala,
      y: w.cy - (dx * w.u[0] + dy * w.u[1] + dz * w.u[2]) * w.scala,
      z: p[0] * w.f[0] + p[1] * w.f[1] + p[2] * w.f[2]
    };
  }

  // Una polilinea in due passate: davanti piena, dietro sbiadita. Costa
  // due `stroke` per linea invece di uno per segmento, ed è la differenza
  // fra un reticolo che si legge come un solido e uno che sembra un
  // ghirigoro piatto.
  function aurLFilo(ctx, punti, colore, spessore, opacita) {
    const o = opacita === undefined ? 1 : opacita;
    for (let passata = 0; passata < 2; passata++) {
      const davanti = passata === 1;
      ctx.beginPath();
      let dentro = false;
      for (let i = 1; i < punti.length; i++) {
        const a = punti[i - 1], b = punti[i];
        if ((((a.z + b.z) / 2 >= 0)) !== davanti) { dentro = false; continue; }
        if (!dentro) { ctx.moveTo(a.x, a.y); dentro = true; }
        ctx.lineTo(b.x, b.y);
      }
      ctx.strokeStyle = didVela(colore, o * (davanti ? 0.9 : 0.24));
      ctx.lineWidth = spessore * (davanti ? 1 : 0.8);
      ctx.stroke();
    }
  }

  // -------------------------------------------------- il campo magnetico
  // Una linea di campo dipolare, r = L·cos²λ, inclinata col dipolo e poi
  // deformata dal vento. La deformazione è dichiarata: dentro alla
  // magnetopausa una compressione dal lato del Sole, fuori la linea si
  // apre e il vento se la porta nella coda stringendola verso l'asse.
  // La forma esatta la darebbero solo le equazioni del plasma; questa la
  // somiglia, e le due cose che contano — dove finiscono i piedi delle
  // linee, e da che parte arriva la roba — sono al posto giusto.
  function aurLDeforma(p, s) {
    const r = Math.hypot(p[0], p[1], p[2]);
    if (r < 1.001) return p;
    const cos = Math.max(-1, Math.min(1, -p[0] / r));
    const R = aurLMagnetopausa(Math.acos(cos), s.r0, s.alfa);
    if (r <= R) {
      const k = 1 - 0.12 * Math.max(0, cos);
      return [p[0] * k, p[1] * k, p[2] * k];
    }
    const ecc = r - R;
    const perp = Math.hypot(p[1], p[2]);
    const f = Math.min(1, ecc / 10);
    const stretta = perp > 0.001 ? Math.min(1, (s.codaR * 0.92) / perp) : 1;
    const k = 1 + (stretta - 1) * f;
    return [p[0] + ecc * 2.4, p[1] * k, p[2] * k];
  }

  function aurLRuotaTilt(p, tiltRad) {
    const c = Math.cos(tiltRad), sn = Math.sin(tiltRad);
    return [p[0] * c + p[2] * sn, p[1], -p[0] * sn + p[2] * c];
  }

  // Una linea di campo dal piede a nord al piede a sud. `lat0` è la
  // latitudine magnetica del piede: sotto i 72° torna indietro (linea
  // chiusa, è lo scudo), sopra il vento se la porta via (linea aperta, ed
  // è la strada per cui gli elettroni scendono sull'ovale).
  const AURL_PASSI_LINEA = 64;
  function aurLLinea(lat0, lonDeg, s, tiltRad) {
    const la0 = lat0 * Math.PI / 180;
    const cos0 = Math.cos(la0);
    const L = 1 / Math.max(1e-4, cos0 * cos0);
    const lon = lonDeg * Math.PI / 180;
    const punti = [];
    for (let i = 0; i <= AURL_PASSI_LINEA; i++) {
      const la = la0 - 2 * la0 * i / AURL_PASSI_LINEA;
      const c = Math.cos(la);
      const r = L * c * c;
      if (r < 0.999) continue;
      let p = aurLRuotaTilt([r * c * Math.cos(lon), r * c * Math.sin(lon), r * Math.sin(la)], tiltRad);
      p = aurLDeforma(p, s);
      if (p[0] > AURL_CODA_MAX) {
        // la linea esce dal quadro: si spezza qui e riprende dall'altra
        // metà, se no il segmento di ritorno taglia tutta la scena
        if (punti.length && punti[punti.length - 1]) punti.push(null);
        continue;
      }
      punti.push(p);
    }
    return punti;
  }

  // Le linee si rifanno solo quando la tempesta è cambiata abbastanza da
  // vedersi: un quarto d'ora di racconto, che a velocità 1× è un decimo
  // di secondo. Rifarle a ogni fotogramma sarebbero duemila radici
  // quadrate e duemila arcocoseni per un disegno identico a quello di
  // prima.
  const AURL_CHIUSE = [56, 65, 71];
  const AURL_APERTE = [75, 79, 84];
  const AURL_LONGITUDINI = [0, 60, 120, 180, 240, 300];
  function aurLLinee(s, tiltRad) {
    const chiave = Math.round(aurL.t * 4);
    if (aurL.campo.chiave === chiave && aurL.campo.linee) return aurL.campo.linee;
    const chiuse = [], aperte = [];
    AURL_CHIUSE.forEach(la => AURL_LONGITUDINI.forEach(f => chiuse.push(aurLLinea(la, f, s, tiltRad))));
    AURL_APERTE.forEach(la => AURL_LONGITUDINI.forEach(f => aperte.push(aurLLinea(la, f, s, tiltRad))));
    aurL.campo = { chiave, linee: { chiuse, aperte } };
    return aurL.campo.linee;
  }

  function aurLDisegnaLinea(ctx, w, punti, colore, spessore, opacita) {
    let pezzo = [];
    const scarica = () => {
      if (pezzo.length > 1) aurLFilo(ctx, pezzo, colore, spessore, opacita);
      pezzo = [];
    };
    for (let i = 0; i < punti.length; i++) {
      if (!punti[i]) { scarica(); continue; }
      pezzo.push(aurLPro(punti[i], w));
    }
    scarica();
  }

  // -------------------------------------------------- l'ovale sul globo
  // Un punto dell'ovale: latitudine magnetica `la`, ora magnetica `mlt`,
  // quota `km`. Mezzogiorno magnetico guarda il Sole, cioè -X.
  function aurLPuntoOvale(la, mlt, km, boreale, tiltRad) {
    const fi = (180 + (mlt - 12) * 15) * Math.PI / 180;
    const l = (boreale ? la : -la) * Math.PI / 180;
    const r = 1 + (km || 0) / RE_KM;
    return aurLRuotaTilt(
      [r * Math.cos(l) * Math.cos(fi), r * Math.cos(l) * Math.sin(fi), r * Math.sin(l)], tiltRad);
  }

  // Il nastro dell'ovale, dal bordo verso l'equatore a quello verso il
  // polo. `aurBordo` e `aurSpessore` sono quelle del planetario: se un
  // giorno si ritocca la forma dell'ovale, si ritocca in un posto solo.
  function aurLNastro(kp, boreale, tiltRad, km, quanti) {
    const n = quanti || 72;
    const fuori = [], dentro = [];
    for (let i = 0; i <= n; i++) {
      const mlt = i * 24 / n;
      const b = typeof aurBordo === 'function' ? aurBordo(kp, mlt) : 66.5 - 2.05 * kp;
      const sp = typeof aurSpessore === 'function' ? aurSpessore(kp, mlt) : 5;
      fuori.push(aurLPuntoOvale(b, mlt, km, boreale, tiltRad));
      dentro.push(aurLPuntoOvale(Math.min(88, b + sp), mlt, km, boreale, tiltRad));
    }
    return { fuori, dentro };
  }

  // -------------------------------------------------- dove sono io
  // La stessa domanda che si fa il planetario, ridotta all'osso: da un
  // luogo e con un Kp, quanto è lontano l'ovale e sotto che angolo se ne
  // vedono il verde e il rosso. Le funzioni sono quelle di
  // `aurora-polare.js`, quindi la risposta è la stessa che darà il cielo.
  // Le falde: l'ovale ha uno spessore, e va guardato tutto. Cercando solo
  // il bordo verso l'equatore si sbagliava proprio il caso che questo
  // banco esiste per raccontare — da Tromsø con Kp 4 quel bordo sta mille
  // chilometri **a sud**, perché il paese è già dentro all'anello, e la
  // risposta veniva «un bagliore lontano a 16°» invece che «ce l'hai
  // sopra la testa». È lo stesso motivo per cui `aurGeometria()` disegna
  // più falde invece di una riga sola.
  const AURL_FALDE = [0, 0.35, 0.7, 1];

  function aurLCalcola(data, lat, lon, kp) {
    if (typeof aurBordo !== 'function' || typeof aurRiferimento !== 'function') return null;
    const provaNord = aurMagnetiche(lat, lon, aurRiferimento(AUR_POLO_NORD));
    const boreale = provaNord.lat >= 0;
    const rif = aurRiferimento(boreale ? AUR_POLO_NORD : AUR_POLO_SUD);
    const mia = aurMagnetiche(lat, lon, rif);
    const sub = aurSubsolare(data);
    const subM = aurMagnetiche(sub.lat, sub.lon, rif);
    const soglia = typeof AUR_VERDE_MIN_ALT === 'number' ? AUR_VERDE_MIN_ALT : 3;

    let migliore = null, verdeSuOrizzonte = false;
    AURL_FALDE.forEach(f => {
      for (let i = 0; i < 48; i++) {
        const mlt = i * 24 / 48;
        const lonM = subM.lon + (mlt - 12) * 15;
        const sp = typeof aurSpessore === 'function' ? aurSpessore(kp, mlt) : 5;
        const g = aurGeografiche(Math.min(88, aurBordo(kp, mlt) + f * sp), lonM, rif);
        const rotta = aurRotta(lat, lon, g.lat, g.lon);
        const verde = aurAltezza(rotta.psi, 120);
        if (verde > soglia) verdeSuOrizzonte = true;
        const cima = aurAltezza(rotta.psi, 400);
        if (!migliore || cima > migliore.cima) {
          migliore = {
            mlt, az: rotta.az, psi: rotta.psi, km: rotta.psi * RE_KM,
            verde, rosso: aurAltezza(rotta.psi, 250), cima
          };
        }
      }
    });

    return Object.assign({
      boreale, mia: mia.lat, verso: boreale ? 'nord' : 'sud',
      nome: boreale ? 'boreale' : 'australe',
      siVedeVerde: verdeSuOrizzonte,
      siVede: migliore.cima > 0.5
    }, migliore);
  }

  // L'ora magnetica di un posto: 12 è mezzogiorno magnetico (il Sole dalla
  // parte del polo), 0 la mezzanotte magnetica.
  function aurLOraMagnetica(data, lat, lon) {
    if (typeof aurRiferimento !== 'function') return null;
    const boreale = aurMagnetiche(lat, lon, aurRiferimento(AUR_POLO_NORD)).lat >= 0;
    const rif = aurRiferimento(boreale ? AUR_POLO_NORD : AUR_POLO_SUD);
    const mia = aurMagnetiche(lat, lon, rif);
    const sub = aurSubsolare(data);
    const subM = aurMagnetiche(sub.lat, sub.lon, rif);
    return ((((12 + (mia.lon - subM.lon) / 15) % 24) + 24) % 24);
  }

  // «Da qui si vedrebbe?» è una domanda che ha senso solo di notte, e
  // precisamente attorno alla **mezzanotte magnetica**: è lì che l'ovale
  // scende, perché è schiacciato verso il lato notte. Chiedendolo
  // all'istante di adesso — che per chi apre l'app di pomeriggio è
  // mezzogiorno magnetico — la risposta era giusta e inutile: l'ovale
  // dall'altra parte del pianeta, duemila chilometri invece di mille, e un
  // verdetto molto più pessimista del vero. Quindi l'orologio si porta
  // avanti da sé fino all'ora buona della prossima rotazione.
  //
  // Il verso in cui l'ora magnetica cammina non si dà per scontato — nel
  // riferimento australe la longitudine magnetica è ribaltata — e si
  // misura invece di dedurlo: due letture a un'ora di distanza.
  function aurLOraBuona(data, lat, lon) {
    // Anche questa si tiene da parte: sta in mezzo al ciclo di disegno e
    // dentro ci sono due chiamate ad Astronomy Engine
    const chiave = [Math.round(data.getTime() / 600000), lat.toFixed(2), lon.toFixed(2)].join('|');
    if (aurL.ore.has(chiave)) return aurL.ore.get(chiave);
    const v = aurLOraBuonaConto(data, lat, lon);
    if (aurL.ore.size > 200) aurL.ore.clear();
    aurL.ore.set(chiave, v);
    return v;
  }

  function aurLOraBuonaConto(data, lat, lon) {
    const m0 = aurLOraMagnetica(data, lat, lon);
    if (m0 === null) return data;
    const m1 = aurLOraMagnetica(new Date(data.getTime() + 3600000), lat, lon);
    const giro = (x) => { let v = x % 24; if (v > 12) v -= 24; if (v < -12) v += 24; return v; };
    const passo = giro(m1 - m0);
    if (Math.abs(passo) < 0.2) return data;
    const mancano = giro((typeof AUR_ORA_PIU_VIVA === 'number' ? AUR_ORA_PIU_VIVA : 22.5) - m0);
    let ore = mancano / passo;
    if (ore < 0) ore += 24 / Math.abs(passo);
    return new Date(data.getTime() + ore * 3600000);
  }

  // Quarantotto giri di trigonometria sferica per quattro falde non si
  // fanno sessanta volte al secondo per scrivere una riga di testo che
  // cambia ogni tanto: la risposta si tiene da parte, con la grana con cui
  // si legge.
  function aurLGuarda(data, lat, lon, kp) {
    const chiave = [Math.round(data.getTime() / 600000), lat.toFixed(2), lon.toFixed(2),
      Math.round(kp * 10)].join('|');
    if (aurL.visto.has(chiave)) return aurL.visto.get(chiave);
    const v = aurLCalcola(data, lat, lon, kp);
    if (aurL.visto.size > 300) aurL.visto.clear();
    aurL.visto.set(chiave, v);
    return v;
  }

  function aurLLuogoScelto() {
    const v = AURL_LUOGHI.find(l => l.id === aurL.luogo) || AURL_LUOGHI[0];
    if (v.id !== 'casa') return { nome: v.nome, lat: v.lat, lon: v.lon };
    const l = typeof luogoCorrente === 'function' ? luogoCorrente() : null;
    if (!l) return { nome: 'Pianura Padana', lat: 44.49, lon: 11.34, ripiego: true };
    return { nome: 'Casa mia', lat: l.lat, lon: l.lon };
  }

  // ===================================================================
  //   Il banco
  // ===================================================================

  laboratorio({
    id: 'aurora',
    chip: 'Aurore polari',
    occhiello: 'Concetto 6 — dal Sole ai poli',
    titolo: 'Come si accende un\'aurora',
    sommario: `Il Sole soffia, la Terra si difende, e nel punto in cui la difesa cede si accende una
      luce. Quattro quadri sulla stessa scena in tre dimensioni — il vento che parte, lo scudo che lo
      devia, la coda che si carica e si rompe, l'anello attorno al polo — e un taglio visto di lato
      che spiega perché la stessa aurora, dalla Norvegia, è verde e riempie il cielo, mentre
      dall'Italia è un bagliore rosso appoggiato all'orizzonte. In fondo ci sono quattro notti in cui
      è successo davvero, e ognuna apre il planetario lì.`,

    costruisci() {
      return `
        <div class="segmenti-cielo did-quadri" id="did-aur-quadri">
          ${Object.keys(AURL_QUADRI).map((k, i) =>
            `<button type="button" class="tasto-segmento${i === 0 ? ' attiva' : ''}" data-quadro="${k}">${AURL_QUADRI[k].chip}</button>`).join('')}
        </div>

        <div id="did-aur-scena">
          <figure class="did-scena did-scena-tonda">
            <canvas id="did-aur-tela" class="did-tela"></canvas>
            <figcaption class="did-targhetta" id="did-aur-targhetta">—</figcaption>
          </figure>

          ${didBarra('did-aur', { min: 0, max: AURL_ORE * 10, valore: 0,
            etichettaSlitta: 'Scorri le ore della tempesta' })}

          ${didLetture([
            { id: 'did-aur-nube', nome: 'La nube è a' },
            { id: 'did-aur-vel', nome: 'Vento solare' },
            { id: 'did-aur-naso', nome: 'Naso dello scudo', forte: true },
            { id: 'did-aur-kp', nome: 'Indice Kp', forte: true },
            { id: 'did-aur-daqui', nome: 'Da casa tua', forte: true }
          ])}

          <p class="did-nota did-nota-gesto">Gira la scena col dito (o trascinando col mouse) per
            guardarla da un'altra parte. Per avvicinarti: la rotella del mouse, due dita sullo schermo, o il
            + tenuto premuto. Il ⟲ rimette tutto a posto, e il ⛶ prende tutto lo schermo.</p>
        </div>

        <div id="did-aur-scena-taglio" class="hidden">
          <figure class="did-scena">
            <canvas id="did-aur-taglio" class="did-tela"></canvas>
            <figcaption class="did-targhetta" id="did-aur-taglio-targhetta">—</figcaption>
          </figure>

          <div class="did-riga did-riga-avvolgi" id="did-aur-luoghi">
            ${AURL_LUOGHI.map(l => `<button type="button" class="did-pillola${l.id === 'casa' ? ' attiva' : ''}" data-luogo="${l.id}">${l.nome}</button>`).join('')}
          </div>

          <div class="did-riga">
            <label class="did-etichetta" for="did-aur-kp-slitta">Quanto è forte la tempesta</label>
            <span class="did-valore" id="did-aur-kp-val">Kp 6,0</span>
          </div>
          <input id="did-aur-kp-slitta" class="did-slitta did-slitta-larga" type="range" min="0" max="9" step="0.1" value="6">

          ${didLetture([
            { id: 'did-aur-t-lat', nome: 'Latitudine geomagnetica' },
            { id: 'did-aur-t-dist', nome: 'L\'ovale dista', forte: true },
            { id: 'did-aur-t-verde', nome: 'Il verde (120 km)', forte: true },
            { id: 'did-aur-t-rosso', nome: 'Il rosso (250 km)', forte: true }
          ])}

          <p class="did-spiega" id="did-aur-t-spiega">—</p>
        </div>

        <p class="did-spiega" id="did-aur-spiega">—</p>
        <p class="did-nota" id="did-aur-nota">—</p>

        <h4 class="did-sottotitolo">Quattro notti in cui è successo davvero</h4>
        <p class="did-nota">Da quasi tutta Europa l'aurora capita una volta ogni molti anni: aspettare
          che succeda per vederla non è un piano. Queste righe portano il planetario in un altro posto e
          in un'altra notte — quelle vere — con l'ovale acceso al Kp di allora. La posizione dell'app non
          si tocca: è una visita, e dal pannello <em>Tempo e luogo</em> del planetario si torna a casa
          con un tasto.</p>
        <div class="did-mete" id="did-aur-mete"></div>

        ${didPonti([
          { azione: 'cielo', icona: 'stella', testo: 'L\'aurora nel cielo di casa', titolo: 'Apre il planetario da qui, con l\'ovale acceso alla tempesta scelta qui sopra' },
          { azione: 'tred', icona: 'saturno', testo: 'Il Sistema Solare adesso', titolo: 'Apre la vista dall\'esterno all\'istante di adesso' }
        ])}`;
    },

    collega() {
      const quadri = $('did-aur-quadri');
      if (quadri) quadri.addEventListener('click', (e) => {
        const b = e.target.closest('[data-quadro]');
        if (!b) return;
        quadri.querySelectorAll('[data-quadro]').forEach(x => x.classList.toggle('attiva', x === b));
        didPienoEsci();
        aurLApriQuadro(b.dataset.quadro);
      });

      collegaBarra('did-aur', aurL, {
        suSlitta: (v) => { aurL.t = v / 10; aurLNumeri(); },
        suInizio: () => { aurL.t = aurLFinestra(aurL.quadro)[0]; aurLNumeri(); }
      });

      const luoghi = $('did-aur-luoghi');
      if (luoghi) luoghi.addEventListener('click', (e) => {
        const b = e.target.closest('[data-luogo]');
        if (!b) return;
        luoghi.querySelectorAll('[data-luogo]').forEach(x => x.classList.toggle('attiva', x === b));
        aurL.luogo = b.dataset.luogo;
        aurLNumeriTaglio();
      });

      const kp = $('did-aur-kp-slitta');
      if (kp) kp.addEventListener('input', (e) => {
        aurL.kpTaglio = Number(e.target.value);
        aurLNumeriTaglio();
      });

      // Girare la scena. Il dito porta con sé il modellino, come nella
      // vista 3D del Sistema Solare: è lo stesso gesto e deve fare la
      // stessa cosa. Con due dita comanda la lente, e questo si tira da
      // parte — due significati per lo stesso gesto sarebbero un
      // indovinello.
      const tela = $('did-aur-tela');
      if (tela) {
        const dita = new Set();
        tela.addEventListener('pointerdown', (e) => {
          dita.add(e.pointerId);
          aurL.trascina = dita.size === 1 ? { x: e.clientX, y: e.clientY } : null;
        });
        tela.addEventListener('pointermove', (e) => {
          if (!aurL.trascina || dita.size !== 1) return;
          const dx = e.clientX - aurL.trascina.x, dy = e.clientY - aurL.trascina.y;
          aurL.trascina = { x: e.clientX, y: e.clientY };
          aurL.cam.az -= dx * 0.42;
          aurL.cam.elev = Math.max(-84, Math.min(84, aurL.cam.elev + dy * 0.34));
          aurL.camV.az = aurL.cam.az;
          aurL.camV.elev = aurL.cam.elev;
        });
        const su = (e) => { dita.delete(e.pointerId); if (!dita.size) aurL.trascina = null; };
        tela.addEventListener('pointerup', su);
        tela.addEventListener('pointercancel', su);
        tela.addEventListener('pointerleave', su);
      }

      const mete = $('did-aur-mete');
      if (mete) mete.addEventListener('click', (e) => {
        const b = e.target.closest('[data-meta]');
        if (!b) return;
        const m = AURL_METE.find(x => x.id === b.dataset.meta);
        if (m) aurLPortami(m);
      });

      collegaPonti('aurora', (azione) => {
        if (azione === 'tred') { didVaiInTreD(didAdesso()); return; }
        const l = aurLLuogoScelto();
        aurLPortami({
          nome: l.nome, lat: l.lat, lon: l.lon,
          quando: didAdesso().getTime(), kp: aurL.kpTaglio,
          daCasa: aurL.luogo === 'casa' && !l.ripiego
        });
      });

      aurLCostruisciMete();
      aurLApriQuadro('vento');
    },

    entra() {
      alterna('did-aur', aurL.marcia);
      aurLApriQuadro(aurL.quadro);
    },

    passo(dt) {
      // La telecamera scivola verso l'inquadratura del quadro invece di
      // saltarci: cambiando linguetta si capisce dove si è andati.
      const k = 1 - Math.exp(-dt / 0.30);
      aurL.cam.az += (aurL.camV.az - aurL.cam.az) * k;
      aurL.cam.elev += (aurL.camV.elev - aurL.cam.elev) * k;

      if (aurL.quadro === 'taglio' || !aurL.marcia) return;
      const f = aurLFinestra(aurL.quadro);
      aurL.t += dt * 2.6 * aurL.velocita;
      if (aurL.t >= f[1]) aurL.t = f[0];
      const s = $('did-aur-slitta');
      if (s && document.activeElement !== s) s.value = String(Math.round(aurL.t * 10));
      aurLNumeri();
    },

    disegna() {
      if (aurL.quadro === 'taglio') aurLDisegnaTaglio();
      else aurLDisegnaScena();
    }
  });

  function aurLFinestra(id) {
    const q = AURL_QUADRI[id];
    return (q && q.finestra) || [0, AURL_ORE];
  }

  function aurLApriQuadro(id) {
    const q = AURL_QUADRI[id];
    if (!q) return;
    aurL.quadro = id;
    const scena = $('did-aur-scena'), taglio = $('did-aur-scena-taglio');
    if (scena) scena.classList.toggle('hidden', id === 'taglio');
    if (taglio) taglio.classList.toggle('hidden', id !== 'taglio');

    const f = aurLFinestra(id);
    const slitta = $('did-aur-slitta');
    if (slitta) { slitta.min = String(Math.round(f[0] * 10)); slitta.max = String(Math.round(f[1] * 10)); }
    if (aurL.t < f[0] || aurL.t > f[1]) aurL.t = f[0];
    if (slitta) slitta.value = String(Math.round(aurL.t * 10));
    if (q.elev !== undefined) aurL.camV.elev = q.elev;
    // L'anello si guarda da sopra il polo, e va inquadrato chiuso: visto
    // di taglio sembra un arco, e l'idea dell'anello non passa.
    if (q.az !== undefined) aurL.camV.az = q.az;

    const targhetta = $(id === 'taglio' ? 'did-aur-taglio-targhetta' : 'did-aur-targhetta');
    if (targhetta) targhetta.innerHTML = q.targhetta;
    const spiega = $('did-aur-spiega');
    if (spiega) spiega.innerHTML = `<strong>${q.titolo}.</strong> ${q.testo}`;
    const nota = $('did-aur-nota');
    if (nota) nota.innerHTML = aurLNotaQuadro(id);

    if (id === 'taglio') aurLNumeriTaglio(); else aurLNumeri();
  }

  function aurLNotaQuadro(id) {
    if (id === 'vento') {
      return `Le distanze sono compresse: il Sole sta a 23.481 raggi terrestri e qui è disegnato a 200,
        centodiciassette volte più vicino — se no la Terra sarebbe un punto invisibile a un metro dal
        bordo dello schermo. Anche il disco solare è fuori scala. Il tempo di viaggio invece è vero:
        45 ore fanno 920 km/s, cioè una nube veloce. Quelle lente ci mettono tre giorni; quelle del
        1859 e del 2003 arrivarono in diciassette ore.`;
    }
    if (id === 'anello') {
      return `Le quote sono ingrandite sei volte: l'aurora vive fra i 100 e i 400 chilometri, che su un
        globo grande come questo sarebbero una buccia più sottile della riga che la disegna. La forma
        e la posizione dell'anello no, quelle sono vere — <code>aurBordo()</code> e
        <code>aurSpessore()</code> sono le stesse funzioni con cui il planetario disegna l'aurora nel
        cielo.`;
    }
    if (id === 'taglio') {
      return `Questo è l'unico quadro senza nessuna esagerazione: curvatura della Terra, distanza
        dell'ovale e quote dell'aurora sono tutte alla stessa scala, e gli angoli scritti sul disegno
        sono gli angoli veri sopra l'orizzonte — li calcola <code>aurAltezza()</code>, la stessa
        funzione del planetario. È per questo che il disegno viene così largo e così basso: a mille
        chilometri di distanza, trecento chilometri di quota sono una cosa piccola. I numeri sono quelli
        della <strong>mezzanotte magnetica</strong> della prossima notte, non quelli di adesso: l'ovale
        è schiacciato verso il lato notte, e chiederlo alle tre del pomeriggio darebbe una risposta
        giusta e inutile — l'anello dall'altra parte del pianeta.`;
    }
    return `La magnetopausa e l'onda d'urto sono il modello di Shue et al. (1997), con la pressione e il
      campo della tempesta che scorre nella barra. Le linee di campo sono dipolari
      (<code>r = L·cos²λ</code>) e poi stirate dal vento con una regola dichiarata nel codice: la forma
      esatta della coda la darebbero solo le equazioni del plasma, ma le due cose che qui contano —
      dove finiscono i piedi delle linee e da che parte arriva la roba — sono al posto giusto.`;
  }

  // -------------------------------------------------- i numeri
  function aurLNumeri() {
    const t = aurL.t;
    const v = aurLVento(t);
    const s = aurLScudo(t);
    const nube = aurLNube(t);
    const kp = aurLKp(t);

    const lettura = $('did-aur-lettura');
    if (lettura) {
      lettura.textContent = `${num(t, 1)} h — ` + (
        t < 0.5 ? 'l\'eruzione'
          : nube.q < 1 ? 'la nube viaggia'
            : t - AURL_VIAGGIO_H < 1 ? 'l\'urto'
              : aurLSottotempesta(t).scarica ? 'sottotempesta' : 'la coda si carica');
    }

    scrivi('did-aur-nube', nube.q >= 1
      ? 'arrivata'
      : `${num((AURL_SOLE_X - Math.abs(nube.x)) * RE_KM / 1e6, 1)} milioni di km dal Sole`);
    scrivi('did-aur-vel', `${Math.round(v.v)} km/s`);
    scrivi('did-aur-naso', `${num(s.r0, 1)} R⊕ · ${Math.round(s.r0 * RE_KM / 1000)} mila km`,
      s.r0 < 7 ? 'rosso' : '');
    scrivi('did-aur-kp', `Kp ${num(kp, 1)}`, kp >= 7 ? 'verde' : (kp >= 5 ? 'ambra' : ''));

    const l = typeof luogoCorrente === 'function' ? luogoCorrente() : null;
    if (!l) { scrivi('did-aur-daqui', 'posizione ignota'); return; }
    const g = aurLGuarda(aurLOraBuona(didAdesso(), l.lat, l.lon), l.lat, l.lon, kp);
    if (!g) { scrivi('did-aur-daqui', '—'); return; }
    scrivi('did-aur-daqui',
      !g.siVede ? 'niente: resta sotto l\'orizzonte'
        : g.siVedeVerde ? `archi verdi, fino a ${num(g.cima, 0)}°`
          : `solo bagliore rosso, fino a ${num(g.cima, 0)}°`,
      g.siVedeVerde ? 'verde' : (g.siVede ? 'ambra' : ''));
  }

  function aurLNumeriTaglio() {
    const kp = aurL.kpTaglio;
    const lettura = $('did-aur-kp-val');
    if (lettura) lettura.textContent = `Kp ${num(kp, 1)}`;
    const l = aurLLuogoScelto();
    const g = aurLGuarda(aurLOraBuona(didAdesso(), l.lat, l.lon), l.lat, l.lon, kp);
    const spiega = $('did-aur-t-spiega');
    if (!g) { if (spiega) spiega.textContent = 'Il modulo delle aurore non è caricato.'; return; }

    scrivi('did-aur-t-lat', `${num(Math.abs(g.mia), 1)}° ${g.boreale ? 'nord' : 'sud'}`);
    scrivi('did-aur-t-dist', `${Math.round(g.km)} km`);
    scrivi('did-aur-t-verde', `${num(g.verde, 1)}°`, g.verde > 3 ? 'verde' : 'rosso');
    scrivi('did-aur-t-rosso', `${num(g.rosso, 1)}°`, g.rosso > 3 ? 'verde' : (g.rosso > 0 ? 'ambra' : 'rosso'));

    if (!spiega) return;
    if (g.cima <= 0.5) {
      spiega.innerHTML = `Da <strong>${l.nome}</strong>, con Kp ${num(kp, 1)}, l'ovale resta
        ${Math.round(g.km)} km più in là e la curvatura della Terra lo nasconde tutto: non si affaccia
        nemmeno la cima. Alza il Kp e guarda da che punto comincia a spuntare — quel numero, per il tuo
        parallelo, dice tutto.`;
    } else if (!g.siVedeVerde) {
      spiega.innerHTML = `<strong>Ecco il caso italiano.</strong> Da ${l.nome} l'ovale è a
        ${Math.round(g.km)} km: il verde a 120 km di quota sta a ${num(g.verde, 1)}°, cioè
        ${g.verde < 0 ? 'sotto l\'orizzonte, oltre il bordo della Terra' : 'talmente basso da essere spento dall\'aria'},
        mentre il rosso a 250 km si affaccia a ${num(g.rosso, 1)}° e la cima della tenda arriva a
        ${num(g.cima, 1)}°. Aspettati un bagliore rosato, non archi verdi. Nessuno l'ha deciso: è la
        Terra che è tonda.`;
    } else if (g.cima > 60) {
      spiega.innerHTML = `Da <strong>${l.nome}</strong> con Kp ${num(kp, 1)} l'ovale è praticamente
        addosso — ${Math.round(g.km)} km — e le tende arrivano a ${num(g.cima, 0)}° sopra l'orizzonte,
        cioè quasi allo zenit. Da sotto l'ovale l'aurora non si guarda «verso ${g.verso}»: si guarda in
        su, e la corona aurorale si apre a raggiera sopra la testa.`;
    } else {
      spiega.innerHTML = `Da <strong>${l.nome}</strong> con Kp ${num(kp, 1)} l'ovale è a
        ${Math.round(g.km)} km: abbastanza vicino perché il verde stia sopra l'orizzonte
        (${num(g.verde, 1)}°) e si vedano gli archi, non solo il bagliore. La cima della tenda arriva a
        ${num(g.cima, 0)}° verso ${g.verso}.`;
    }
  }

  // -------------------------------------------------- le mete
  // Il riepilogo di una meta non è un giudizio, sono i tre numeri: il
  // verde, il rosso e la cima della tenda. Un giudizio solo («aurora
  // verde», «solo il rosso») prima o poi contraddice il calcolo che gli
  // sta sotto — ed è successo, scrivendo «il cielo rosso del 2024» sopra
  // a una riga che con Kp 9 dice che il verde ci arrivava eccome.
  function aurLRiassunto(g) {
    if (!g) return 'Il modulo delle aurore non è caricato.';
    if (!g.siVede) return 'Da lì, quella notte: l\'ovale resta sotto l\'orizzonte.';
    const dice = (nome, alt) => alt > 0
      ? `${nome} a <strong>${num(alt, 0)}°</strong>`
      : `${nome} sotto l'orizzonte`;
    return `Da lì, quella notte: ${dice('il verde', g.verde)}, ${dice('il rosso', g.rosso)}, ` +
      `la cima della tenda a <strong>${num(g.cima, 0)}°</strong> verso ${g.verso}.`;
  }

  function aurLCostruisciMete() {
    const box = $('did-aur-mete');
    if (!box) return;
    box.innerHTML = AURL_METE.map(m => {
      const data = new Date(m.quando);
      const g = aurLGuarda(data, m.lat, m.lon, m.kp);
      return `
        <article class="did-meta">
          <div class="did-meta-testa">
            <strong class="did-meta-nome">${m.nome}</strong>
            <span class="did-meta-paese">${m.paese}</span>
            <span class="did-meta-kp${m.kpVero ? ' did-meta-kp-vero' : ''}">Kp ${num(m.kp, 0)}${m.kpVero ? ' · vero' : ''}</span>
          </div>
          <p class="did-meta-quando">${didData(data)} — ${m.titolo}</p>
          <p class="did-meta-testo">${m.testo}</p>
          <p class="did-meta-esito">${aurLRiassunto(g)}</p>
          <button type="button" class="did-tasto did-primario" data-meta="${m.id}">Portami lì nel planetario</button>
        </article>`;
    }).join('');
  }

  // Il ponte vero di questo banco: un altro luogo, un'altra notte, e
  // l'ovale acceso. Sposta il *luogo di visita* del planetario, non la
  // posizione dell'app — quella resta dov'è, e dal pannello Tempo e luogo
  // si torna a casa con un tasto.
  function aurLPortami(m) {
    const data = new Date(m.quando);
    if (typeof mostraVista === 'function') mostraVista('cielo');
    if (typeof skyFermaPlayback === 'function') skyFermaPlayback();
    if (!m.daCasa && typeof skyImpostaLuogoVista === 'function') {
      skyImpostaLuogoVista(m.lat, m.lon, m.nome || null);
    }
    didPortaOrologio(data);
    if (typeof aurImpostaKpSimulato === 'function') aurImpostaKpSimulato(m.kp);
    // L'ovale è largo decine di gradi: col campo stretto se ne vedrebbe un
    // pezzo e non si capirebbe nemmeno che è un arco
    if (typeof skyImpostaFov === 'function') skyImpostaFov(110);

    // Un giro di schermo, perché l'osservatore del planetario sia già
    // quello nuovo quando si decide da che parte guardare
    setTimeout(() => {
      const g = aurLGuarda(data, m.lat, m.lon, m.kp);
      if (!g) return;
      if (typeof skyCentraSu === 'function') {
        skyCentraSu({ nome: 'l\'aurora', az: g.az, alt: Math.max(8, Math.min(65, g.cima * 0.5)) },
          { subito: true });
      }
      if (typeof skyAvviso === 'function') {
        skyAvviso('aurora',
          `${m.nome || 'Da qui'}, ${didData(data)}, Kp ${num(m.kp, 1)}: ` +
          (g.siVedeVerde
            ? `l'ovale ${g.nome} è a ${Math.round(g.km)} km e gli archi verdi arrivano a ${num(g.cima, 0)}° verso ${g.verso}.`
            : g.siVede
              ? `l'ovale ${g.nome} è a ${Math.round(g.km)} km — il verde resta sotto la curvatura, si affaccia il rosso fino a ${num(g.cima, 0)}° verso ${g.verso}.`
              : 'con questo Kp, da qui l\'ovale resta sotto l\'orizzonte: alza la slitta del Kp nel pannello Filtri.'),
          14000);
      }
    }, 90);
  }

  // ===================================================================
  //   Il disegno della scena in tre dimensioni
  // ===================================================================

  function aurLDisegnaScena() {
    const tela = didTela('did-aur-tela', 1.62, 470, { lente: true, trascina: false, pieno: true });
    if (!tela) return;
    const { ctx, L, H } = tela;
    didSfondo(ctx, L, H);

    const q = AURL_QUADRI[aurL.quadro];
    const w = aurLVista(L, H, q.centro, q.campo);
    const s = aurLScudo(aurL.t);
    const kp = aurLKp(aurL.t);
    const tilt = AURL_TILT * Math.PI / 180;
    const lontano = q.campo > 70;         // si vede anche il Sole
    const vicino = q.campo < 8;           // si vede solo il globo

    if (!vicino) {
      const prof = aurLProfilo(s, 40);
      const urto = aurLProfilo(s, 40, aurLUrtoAvanti(), aurLUrtoApertura());
      if (lontano) aurLDisegnaSole(ctx, w);
      // I fili si scostano sull'**onda d'urto**, non sulla magnetopausa: è
      // lì che il vento frena e comincia a scivolare di lato, e fra le due
      // superfici c'è la guaina, dove il flusso è già deviato
      aurLDisegnaVento(ctx, w, s, urto, lontano);
      if (!lontano) {
        aurLDisegnaSuperficie(ctx, w, urto, CA.urto, 0.28);
        aurLDisegnaSuperficie(ctx, w, prof, CA.scudo, 0.60);
      }
    }

    const linee = aurLLinee(s, tilt);
    linee.chiuse.forEach(p => aurLDisegnaLinea(ctx, w, p, CA.chiusa, 1.1, 0.5));
    if (!vicino) linee.aperte.forEach(p => aurLDisegnaLinea(ctx, w, p, CA.aperta, 1.2, 0.45));

    if (aurL.quadro === 'scarica') aurLDisegnaSottotempesta(ctx, w, s, linee);
    if (!vicino) aurLDisegnaNube(ctx, w);
    aurLDisegnaTerra(ctx, w, kp, tilt, q.campo);
    aurLEtichette(ctx, w, s, q, vicino, lontano);
  }

  function aurLDisegnaSole(ctx, w) {
    const c = aurLPro([-AURL_SOLE_X, 0, 0], w);
    const r = Math.max(10, 22 * w.scala);
    const alone = ctx.createRadialGradient(c.x, c.y, r * 0.7, c.x, c.y, r * 4.2);
    alone.addColorStop(0, 'rgba(255, 201, 77, 0.32)');
    alone.addColorStop(0.4, 'rgba(255, 150, 60, 0.11)');
    alone.addColorStop(1, 'rgba(255, 150, 60, 0)');
    ctx.fillStyle = alone;
    ctx.beginPath(); ctx.arc(c.x, c.y, r * 4.2, 0, Math.PI * 2); ctx.fill();
    didCorpo(ctx, c.x, c.y, r, CA.sole, { alone: 1.9 });
    didScritta(ctx, 'Sole', c.x, c.y + r + 16, { colore: CA.sole, misura: 11, allinea: 'center' });
  }

  // Il vento: fili che scorrono verso la coda e girano attorno allo scudo.
  // Non attraversano mai la magnetopausa, ed è quello il punto — il vento
  // solare non ci arriva addosso, ci scivola attorno.
  const AURL_FILI = 20;
  // Un `max` secco fra il filo dritto e il bordo dell'ostacolo fa uno
  // spigolo, e uno spigolo in un fiume non c'è: il filo si scosta prima e
  // rientra dopo. Questa è la stessa cosa scritta morbida.
  function aurLScosta(b, r) {
    if (r <= 0) return b;
    const d = b - r;
    return r + 0.5 * (d + Math.sqrt(d * d + 9));
  }

  function aurLDisegnaVento(ctx, w, s, prof, lontano) {
    const v = aurLVento(aurL.t);
    const x0 = lontano ? -AURL_SOLE_X + 24 : -46;
    const x1 = lontano ? 74 : AURL_CODA_MAX;
    const passi = 26;
    const fase = (aurL.t * 0.7) % 1;

    for (let i = 0; i < AURL_FILI; i++) {
      const fi = i / AURL_FILI * 2 * Math.PI + 0.21;
      const b = lontano ? (8 + (i % 5) * 17) : (3 + (i % 6) * 6.5);
      const punti = [];
      for (let k = 0; k <= passi; k++) {
        const x = x0 + (x1 - x0) * k / passi;
        const rho = lontano ? b : aurLScosta(b, aurLRho(prof, x) * 1.04);
        punti.push(aurLPro([x, rho * Math.cos(fi), rho * Math.sin(fi)], w));
      }
      aurLFilo(ctx, punti, CA.vento, 1, 0.26);

      // il pacchetto che scorre: fa vedere il verso e la velocità
      const u = (fase + i / AURL_FILI) % 1;
      const p = punti[Math.min(passi - 1, Math.floor(u * passi))];
      if (p && p.z >= 0) {
        ctx.fillStyle = didVela(CA.vento, 0.75);
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.9, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (lontano) {
      const a = aurLPro([x0 + 26, 0, 62], w), b = aurLPro([x0 + 86, 0, 62], w);
      didFreccia(ctx, a.x, a.y, b.x, b.y, { colore: didVela(CA.vento, 0.8), spessore: 1.6, punta: 8 });
      didScritta(ctx, `vento solare · ${Math.round(v.v)} km/s`, a.x, a.y - 8,
        { colore: CA.vento, misura: 10, peso: 700 });
    }
  }

  function aurLDisegnaSuperficie(ctx, w, prof, colore, opacita) {
    if (!prof.length) return;
    const meridiani = 10;
    for (let m = 0; m < meridiani; m++) {
      const fi = m / meridiani * 2 * Math.PI;
      aurLFilo(ctx, prof.map(p => aurLPro([p.x, p.rho * Math.cos(fi), p.rho * Math.sin(fi)], w)),
        colore, 1.1, opacita);
    }
    // gli anelli: senza, i meridiani da soli sembrano una gabbia piatta
    [0.1, 0.28, 0.48, 0.7, 0.95].forEach(u => {
      const p = prof[Math.min(prof.length - 1, Math.round(u * (prof.length - 1)))];
      const punti = [];
      for (let k = 0; k <= 40; k++) {
        const fi = k / 40 * 2 * Math.PI;
        punti.push(aurLPro([p.x, p.rho * Math.cos(fi), p.rho * Math.sin(fi)], w));
      }
      aurLFilo(ctx, punti, colore, 1, opacita * 0.75);
    });
  }

  // La sottotempesta: il punto in cui la coda si rompe, il pezzo che se ne
  // va, e gli elettroni che corrono verso la Terra.
  function aurLDisegnaSottotempesta(ctx, w, s, linee) {
    if (aurL.t < AURL_VIAGGIO_H) return;
    const st = aurLSottotempesta(aurL.t);
    const xX = 20 + 4 * st.carica;                   // dove si rompe

    // il piano neutro: dove le due metà della coda si toccano
    const bordo = [];
    for (let k = 0; k <= 28; k++) {
      const a = k / 28 * 2 * Math.PI;
      bordo.push(aurLPro([xX, s.codaR * 0.8 * Math.cos(a), s.codaR * 0.8 * Math.sin(a) * 0.22], w));
    }
    aurLFilo(ctx, bordo, CA.coda, 1.2, 0.5);

    const x = aurLPro([xX, 0, 0], w);
    ctx.strokeStyle = didVela(CA.rosso, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x.x - 7, x.y - 7); ctx.lineTo(x.x + 7, x.y + 7);
    ctx.moveTo(x.x + 7, x.y - 7); ctx.lineTo(x.x - 7, x.y + 7);
    ctx.stroke();
    didScritta(ctx, 'qui si rompe', x.x + 11, x.y - 9, { colore: CA.rosso, misura: 10, peso: 700 });

    if (st.scarica) {
      const d = ((aurL.t - AURL_VIAGGIO_H - 0.3) % AURL_CICLO_H) / AURL_CICLO_H;
      const c = aurLPro([xX + 12 + 60 * Math.max(0, d - 0.78) / 0.22, 0, 0], w);
      const rr = Math.max(7, 9 * w.scala);
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rr);
      g.addColorStop(0, didVela(CA.coda, 0.55));
      g.addColorStop(1, didVela(CA.coda, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, Math.PI * 2); ctx.fill();
      didScritta(ctx, 'via il plasmoide', c.x, c.y - rr - 6,
        { colore: CA.coda, misura: 10, allinea: 'center', peso: 700 });
    }

    // Gli elettroni che corrono verso la Terra lungo le ultime linee
    // chiuse: sono loro l'aurora, e vengono da dietro. Si riusano le linee
    // già calcolate — sono le stesse che si stanno disegnando.
    const quanti = st.scarica ? 30 : 10;
    const fase = (aurL.t * 3.4) % 1;
    const ultime = linee.chiuse.slice(-AURL_LONGITUDINI.length);
    for (let i = 0; i < quanti; i++) {
      const linea = ultime[i % ultime.length];
      if (!linea) continue;
      const validi = linea.filter(Boolean);
      if (validi.length < 6) continue;
      // dal punto più lontano verso il piede, cioè al contrario
      const meta = validi.slice(0, Math.floor(validi.length / 2));
      const u = (fase + i / quanti) % 1;
      const p = meta[Math.max(0, Math.min(meta.length - 1, Math.floor((1 - u) * meta.length)))];
      const q = aurLPro(p, w);
      if (q.z < 0) continue;
      ctx.fillStyle = didVela(st.scarica ? CA.verde : CA.aperta, 0.85);
      ctx.beginPath(); ctx.arc(q.x, q.y, 2.1, 0, Math.PI * 2); ctx.fill();
    }
  }

  // La nube è una **calotta**, non un anello: un pezzo di guscio sferico
  // centrato sul Sole che si allarga mentre corre. Disegnandola come
  // cerchi nel piano perpendicolare alla corsa, con la telecamera che li
  // guarda di taglio, collassavano tutti in un trattino verticale — che è
  // geometricamente giusto e non somiglia a niente. Gli archi della
  // calotta invece si vedono da qualunque parte la si guardi, e sono anche
  // la forma vera: il fronte di un'espulsione coronale è un arco di sfera
  // largo decine di gradi, non un proiettile.
  const AURL_NUBE_APERTURA = 0.72;        // semiapertura della calotta, radianti
  function aurLDisegnaNube(ctx, w) {
    const n = aurLNube(aurL.t);
    if (!n.partita || n.q >= 1.25) return;
    const sole = -AURL_SOLE_X;
    const meridiani = 9, passi = 22;

    for (let m = 0; m < meridiani; m++) {
      const fi = m / meridiani * 2 * Math.PI;
      const punti = [];
      for (let k = 0; k <= passi; k++) {
        const th = -AURL_NUBE_APERTURA + 2 * AURL_NUBE_APERTURA * k / passi;
        punti.push(aurLPro([
          sole + n.raggioFronte * Math.cos(th),
          n.raggioFronte * Math.sin(th) * Math.cos(fi),
          n.raggioFronte * Math.sin(th) * Math.sin(fi)], w));
      }
      aurLFilo(ctx, punti, CA.nube, 1.1, 0.34);
    }
    // il fronte, cioè il bordo che urta: più marcato degli altri
    const fronte = [];
    for (let k = 0; k <= 40; k++) {
      const a = k / 40 * 2 * Math.PI;
      const th = AURL_NUBE_APERTURA;
      fronte.push(aurLPro([
        sole + n.raggioFronte * Math.cos(th),
        n.raggioFronte * Math.sin(th) * Math.cos(a),
        n.raggioFronte * Math.sin(th) * Math.sin(a)], w));
    }
    aurLFilo(ctx, fronte, CA.nube, 1.8, 0.6);

    const c = aurLPro([n.x, 0, n.raggioFronte * Math.sin(AURL_NUBE_APERTURA)], w);
    didScritta(ctx, 'la nube', c.x, c.y - 8,
      { colore: CA.nube, misura: 11, allinea: 'center', peso: 700 });
  }

  // La Terra, e sopra di lei i due ovali. Il globo è dipinto col
  // terminatore dalla parte giusta: il Sole sta a -X, quindi la metà
  // illuminata guarda là.
  function aurLDisegnaTerra(ctx, w, kp, tilt, campo) {
    const c = aurLPro([0, 0, 0], w);
    const r = Math.max(3, w.scala);
    const versoSole = aurLPro([-1, 0, 0], w);
    const dx = versoSole.x - c.x, dy = versoSole.y - c.y;
    const n = Math.hypot(dx, dy) || 1;

    const g = ctx.createRadialGradient(
      c.x + dx / n * r * 0.62, c.y + dy / n * r * 0.62, r * 0.08, c.x, c.y, r);
    g.addColorStop(0, '#9cc0ff');
    g.addColorStop(0.42, '#2f5fbf');
    g.addColorStop(1, '#07101f');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(138, 180, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (r < 16) {
      didScritta(ctx, 'Terra', c.x, c.y + r + 15, { colore: C.testo2, misura: 11, allinea: 'center' });
      return;
    }

    // L'asse del dipolo: si vede subito che non è quello di rotazione
    const a0 = aurLPro(aurLRuotaTilt([0, 0, -1.5], tilt), w);
    const a1 = aurLPro(aurLRuotaTilt([0, 0, 1.5], tilt), w);
    ctx.strokeStyle = 'rgba(233, 237, 247, 0.28)';
    ctx.setLineDash([4, 5]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke();
    ctx.setLineDash([]);

    const esagera = campo < 8 ? 6 : 1;
    aurLDisegnaOvale(ctx, w, kp, true, tilt, esagera);
    aurLDisegnaOvale(ctx, w, kp, false, tilt, esagera);
    aurLDisegnaCasa(ctx, w, tilt);
  }

  function aurLDisegnaOvale(ctx, w, kp, boreale, tilt, esagera) {
    const st = aurL.t >= AURL_VIAGGIO_H ? aurLSottotempesta(aurL.t) : { luce: 0.3 };
    const forza = Math.max(0.14, Math.min(1, st.luce));
    const base = aurLNastro(kp, boreale, tilt, 0, 72);
    const cima = aurLNastro(kp, boreale, tilt, AURL_QUOTA_ALTA * esagera, 72);
    const n = base.fuori.length - 1;

    for (let i = 0; i < n; i++) {
      const a0 = aurLPro(base.fuori[i], w), a1 = aurLPro(base.fuori[i + 1], w);
      const b0 = aurLPro(base.dentro[i], w), b1 = aurLPro(base.dentro[i + 1], w);
      if ((a0.z + b0.z) / 2 < 0) continue;      // l'altra metà la copre il globo
      const vivo = typeof aurLuminositaOra === 'function' ? aurLuminositaOra(i * 24 / n) : 1;
      ctx.fillStyle = `rgba(92, 245, 160, ${(0.16 + 0.58 * vivo * forza).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y);
      ctx.lineTo(b1.x, b1.y); ctx.lineTo(b0.x, b0.y);
      ctx.closePath(); ctx.fill();
    }

    if (esagera <= 1) return;

    // le tende: dal suolo alla quota alta, verde in basso e rosso in cima,
    // che sono le due righe di emissione dell'ossigeno
    for (let i = 0; i < n; i += 2) {
      const p0 = aurLPro(base.fuori[i], w), p1 = aurLPro(cima.fuori[i], w);
      if (p0.z < 0) continue;
      const vivo = typeof aurLuminositaOra === 'function' ? aurLuminositaOra(i * 24 / n) : 1;
      const gr = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
      gr.addColorStop(0, `rgba(92, 245, 160, ${(0.66 * vivo * forza).toFixed(3)})`);
      gr.addColorStop(0.55, `rgba(206, 232, 116, ${(0.34 * vivo * forza).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(255, 74, 92, 0)');
      ctx.strokeStyle = gr;
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }

    const eti = aurLPro(aurLPuntoOvale(
      (typeof aurBordo === 'function' ? aurBordo(kp, 21) : 60), 21,
      AURL_QUOTA_ALTA * esagera, boreale, tilt), w);
    if (eti.z >= 0) {
      didScritta(ctx, boreale ? 'ovale boreale' : 'ovale australe', eti.x, eti.y - 7,
        { colore: CA.verde, misura: 10, allinea: 'center', peso: 700 });
    }
  }

  // Il segnalino di casa, che gira col mondo: nel quadro dell'anello si
  // vede il proprio paese passare sotto (o accanto) all'ovale, e l'ora
  // magnetica dice quanto manca alla mezzanotte buona.
  function aurLDisegnaCasa(ctx, w, tilt) {
    if (typeof luogoCorrente !== 'function' || typeof aurMagnetiche !== 'function') return;
    const l = luogoCorrente();
    if (!l) return;
    const data = new Date(didAdesso().getTime() + (aurL.t - AURL_VIAGGIO_H) * 3600000);
    const provaNord = aurMagnetiche(l.lat, l.lon, aurRiferimento(AUR_POLO_NORD));
    const boreale = provaNord.lat >= 0;
    const rif = aurRiferimento(boreale ? AUR_POLO_NORD : AUR_POLO_SUD);
    const mia = aurMagnetiche(l.lat, l.lon, rif);
    const sub = aurSubsolare(data);
    const subM = aurMagnetiche(sub.lat, sub.lon, rif);
    const mlt = ((((12 + (mia.lon - subM.lon) / 15) % 24) + 24) % 24);

    const p = aurLPro(aurLPuntoOvale(Math.abs(mia.lat), mlt, 0, boreale, tilt), w);
    if (p.z < 0) return;
    ctx.fillStyle = CA.casa;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2); ctx.fill();
    didScritta(ctx,
      `qui · ${String(Math.floor(mlt)).padStart(2, '0')}:${String(Math.floor((mlt % 1) * 60)).padStart(2, '0')} magnetiche`,
      p.x + 7, p.y - 5, { colore: CA.casa, misura: 10, peso: 700 });
  }

  function aurLEtichette(ctx, w, s, q, vicino, lontano) {
    if (vicino) {
      const sole = aurLPro([-2.6, 0, 0], w);
      const terra = aurLPro([-1.15, 0, 0], w);
      didFreccia(ctx, sole.x, sole.y, terra.x, terra.y,
        { colore: didVela(CA.sole, 0.85), spessore: 1.8, punta: 8 });
      didScritta(ctx, 'verso il Sole', sole.x, sole.y - 9,
        { colore: CA.sole, misura: 10, allinea: 'center', peso: 700 });
      return;
    }
    if (lontano) return;

    const naso = aurLPro([-s.r0, 0, 0], w);
    didFreccia(ctx, naso.x - 48, naso.y - 28, naso.x - 5, naso.y - 4,
      { colore: didVela(CA.scudo, 0.85), spessore: 1.4, punta: 7 });
    didScritta(ctx, `naso · ${num(s.r0, 1)} R⊕`, naso.x - 52, naso.y - 32,
      { colore: CA.scudo, misura: 10, peso: 700, allinea: 'right' });

    const coda = aurLPro([AURL_CODA_MAX * 0.62, 0, s.codaR * 1.25], w);
    didScritta(ctx, 'la coda — lunga centinaia di raggi', coda.x, coda.y,
      { colore: CA.coda, misura: 10, allinea: 'center', peso: 700 });
  }

  // ===================================================================
  //   Il taglio visto di lato — a scala vera
  // ===================================================================

  function aurLDisegnaTaglio() {
    const tela = didTela('did-aur-taglio', 2.6, 330, { lente: true });
    if (!tela) return;
    const { ctx, L, H } = tela;
    didSfondo(ctx, L, H);

    const l = aurLLuogoScelto();
    const g = aurLGuarda(aurLOraBuona(didAdesso(), l.lat, l.lon), l.lat, l.lon, aurL.kpTaglio);
    if (!g) return;

    // La curvatura è vera: la Terra è un cerchio enorme di cui si vede solo
    // un pezzo, e l'osservatore ci sta sopra.
    //
    // Il raggio in pixel esce da due esigenze, e si prende la più stretta.
    // La prima: l'ovale, che dista `psi` radianti, deve cascare dentro la
    // tela. La seconda: le quote, che seguono **lo stesso metro** della
    // curvatura, devono starci in altezza. Prendendo il minimo, il disegno
    // resta a scala vera in tutti e due i sensi sempre — e questa è
    // l'unica ragione per cui gli angoli scritti accanto alle linee di
    // vista si possono anche misurare col goniometro sullo schermo. Il
    // primo tentativo comprimeva le quote quando non ci stavano, e in quel
    // caso il disegno diceva una cosa e i numeri un'altra.
    const psi = Math.max(0.012, g.psi);
    const obsX = L * 0.15, obsY = H * 0.80;
    const perAltezza = (H * 0.58) / 440 * RE_KM;
    const Rpx = Math.min((L * 0.6) / Math.sin(psi), perAltezza);
    const Cx = obsX, Cy = obsY + Rpx;
    const scalaKm = Rpx / RE_KM;

    const P = (ang, km) => {
      const rp = Rpx + (km || 0) * scalaKm;
      return { x: Cx + rp * Math.sin(ang), y: Cy - rp * Math.cos(ang) };
    };
    // Il suolo si disegna per tutta la larghezza della tela, non per il
    // solo tratto fra l'osservatore e l'ovale: con l'ovale vicino quel
    // tratto è largo cinquanta pixel, e il riempimento chiudeva sull'angolo
    // in basso con una diagonale che sembrava una montagna.
    const suolo = (k, n) => {
      const x = -40 + (L + 80) * k / n;
      return P(Math.asin(Math.max(-1, Math.min(1, (x - Cx) / Rpx))), 0);
    };
    const filoSuolo = (n) => {
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        const p = suolo(k, n);
        if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
    };

    filoSuolo(70);
    ctx.lineTo(L + 40, H + 60); ctx.lineTo(-40, H + 60); ctx.closePath();
    const terra = ctx.createLinearGradient(0, obsY, 0, H);
    terra.addColorStop(0, 'rgba(30, 48, 84, 0.95)');
    terra.addColorStop(1, 'rgba(8, 14, 28, 0.98)');
    ctx.fillStyle = terra; ctx.fill();
    ctx.strokeStyle = 'rgba(138, 180, 255, 0.5)'; ctx.lineWidth = 1.4;
    filoSuolo(70);
    ctx.stroke();

    // La tenda aurorale, quota per quota, coi colori delle righe di
    // emissione: sono AUR_QUOTE, le stesse del planetario.
    const quote = typeof AUR_QUOTE !== 'undefined' ? AUR_QUOTE : [
      { km: 104, colore: [96, 255, 176], alfa: 0.9 },
      { km: 250, colore: [255, 138, 108], alfa: 0.32 },
      { km: 420, colore: [214, 40, 74], alfa: 0 }
    ];
    const largo = Math.max(16, psi * 0.18 * Rpx);
    for (let i = 0; i < quote.length - 1; i++) {
      const a = quote[i], b = quote[i + 1];
      const pa = P(psi, a.km), pb = P(psi, b.km);
      const gr = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
      gr.addColorStop(0, `rgba(${a.colore[0]},${a.colore[1]},${a.colore[2]},${(a.alfa * 0.6).toFixed(3)})`);
      gr.addColorStop(1, `rgba(${b.colore[0]},${b.colore[1]},${b.colore[2]},${(b.alfa * 0.6).toFixed(3)})`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(pa.x - largo / 2, pa.y); ctx.lineTo(pa.x + largo / 2, pa.y);
      ctx.lineTo(pb.x + largo / 2, pb.y); ctx.lineTo(pb.x - largo / 2, pb.y);
      ctx.closePath(); ctx.fill();
    }

    // l'orizzonte dell'osservatore: nel disegno è esattamente orizzontale,
    // perché l'osservatore sta in cima al cerchio
    ctx.strokeStyle = 'rgba(233, 237, 247, 0.42)';
    ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(obsX - 26, obsY); ctx.lineTo(L + 30, obsY); ctx.stroke();
    ctx.setLineDash([]);
    didScritta(ctx, 'orizzonte', L - 10, obsY - 7,
      { colore: C.testo2, misura: 10, allinea: 'right', peso: 700 });

    // Le linee di vista. Gli angoli scritti sono quelli veri, e sul disegno
    // si misurano con un goniometro: è la stessa scala.
    [
      { km: 120, alt: g.verde, colore: CA.verde, nome: 'verde 120 km' },
      { km: 250, alt: g.rosso, colore: CA.rosso, nome: 'rosso 250 km' }
    ].forEach(r => {
      const p = P(psi, r.km);
      const dentro = r.alt > 0;
      ctx.strokeStyle = didVela(r.colore, dentro ? 0.85 : 0.32);
      ctx.lineWidth = dentro ? 1.8 : 1.2;
      if (!dentro) ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(obsX, obsY); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.setLineDash([]);
      didScritta(ctx, `${r.nome} → ${num(r.alt, 1)}°${dentro ? '' : ' · sotto l\'orizzonte'}`,
        (obsX + p.x) / 2, (obsY + p.y) / 2 - 7,
        { colore: r.colore, misura: 10, allinea: 'center', peso: 700 });
    });

    ctx.fillStyle = CA.casa;
    ctx.beginPath(); ctx.arc(obsX, obsY, 4, 0, Math.PI * 2); ctx.fill();
    didScritta(ctx, l.nome, obsX, obsY + 18,
      { colore: CA.casa, misura: 11, allinea: 'center', peso: 700 });

    const pOvale = P(psi, 470);
    didScritta(ctx, `l'ovale · ${Math.round(g.km)} km di distanza`, pOvale.x, pOvale.y,
      { colore: C.testo2, misura: 10, allinea: 'center', peso: 700 });
    didScritta(ctx, 'curvatura e quote alla stessa scala — nessuna esagerazione',
      12, 18, { colore: C.testo3, misura: 10, peso: 600 });
  }


  // ===================================================================
  // 8-bis. ESPERIMENTO 7 — LE COSTELLAZIONI NON ESISTONO
  //
  //   È il banco che smonta tutto il resto dell'app, ed è per questo che
  //   ci vuole. Il planetario passa il tempo a dire «quella è Orione»; qui
  //   si dice come stanno davvero le cose: Orione non è un oggetto. È una
  //   coincidenza di direzioni, valida da un unico punto dell'universo —
  //   questo — e da nessun altro.
  //
  //   Le tre stelle della cintura sembrano gemelle, uguali di luce e
  //   allineate: stanno a 692, 1.977 e 736 anni luce. Alnilam, quella in
  //   mezzo, è quasi tre volte più lontana delle altre due, e sembra
  //   uguale soltanto perché è enormemente più luminosa. Metterle nello
  //   spazio vero e girarci intorno è l'unico modo di vederlo.
  //
  //   Tre quadri, che sono tre domande in fila:
  //     1. «La figura» — quella che si vede da qui, con accanto quanto è
  //        lontana ogni stella. Il grafico delle distanze fa il resto.
  //     2. «Nello spazio» — le stesse stelle in tre dimensioni, con il
  //        Sole e i raggi visuali. Si gira col dito, e girandola la figura
  //        si disfa: è il momento in cui la cosa si capisce.
  //     3. «Da un altro pianeta» — il cielo rifatto da un punto di vista
  //        che si sposta, fino a duemila anni luce da qui. Il posto si
  //        sceglie: o una slitta che si allontana di traverso, o — ed è la
  //        domanda vera — un pianeta di una delle stelle della figura
  //        stessa. Da un pianeta di Betelgeuse, Orione non esiste: e
  //        Betelgeuse, lì, è il Sole. Accanto al cielo rifatto c'è la
  //        stessa scena in tre dimensioni, che si gira col dito, dove si
  //        vede *da dove* si sta guardando: è quella che spiega perché la
  //        figura si è disfatta invece di limitarsi a mostrarlo.
  //
  //   I dati sono le parallassi di Hipparcos via HYG, in dati-distanze.js:
  //   si caricano solo entrando qui. Prefisso `spa`.
  // ===================================================================

  const SPA_FIGURE = [
    { sigla: 'Ori', nome: 'Orione' },
    { sigla: 'UMa', nome: 'Orsa Maggiore' },
    { sigla: 'Cru', nome: 'Croce del Sud' },
    { sigla: 'Cas', nome: 'Cassiopea' },
    { sigla: 'Leo', nome: 'Leone' },
    { sigla: 'Cyg', nome: 'Cigno' },
    { sigla: 'Sco', nome: 'Scorpione' },
    { sigla: 'Gem', nome: 'Gemelli' }
  ];

  const SPA_QUADRI = {
    figura:  { nome: 'La figura',            elev: 90, az: 0 },
    spazio:  { nome: 'Nello spazio',         elev: 16, az: 28 },
    altrove: { nome: 'Da un altro pianeta',  elev: 90, az: 0 }
  };

  // Fin dove si può andare. Duemila anni luce sono più della stella più
  // lontana di quasi tutte le figure: oltre, non si sta più guardando la
  // costellazione da un altro punto — si sta guardando il suo relitto.
  const SPA_VIAGGIO_MAX = 2000;

  const spa = {
    sigla: 'Ori',
    quadro: 'figura',
    dati: null,            // { stelle, linee } della figura scelta
    stato: 'niente',       // niente | carico | pronto | fallito
    cam: { az: 28, elev: 16 },
    camV: { az: 28, elev: 16 },
    trascina: null,
    viaggio: 0,            // anni luce di distanza dal Sole del punto di vista
    direzione: 0,          // gradi: da che parte ci si allontana
    meta: null,            // indice della stella su cui ci si è trasferiti
    marcia: false,
    velocita: 1
  };

  const SPA_C = {
    sole: '#ffd166',
    raggio: 'rgba(120, 178, 255, 0.32)',
    linea: 'rgba(120, 178, 255, 0.75)',
    linea3d: 'rgba(139, 92, 246, 0.55)',
    barra: '#8b5cf6',
    barraLontana: '#4c8dff',
    // Il grigio del «com'era da qui»: deve leggersi come un ricordo, non
    // come una seconda figura in gara con quella nuova
    fantasma: 'rgba(148, 168, 214, 0.34)',
    occhio: '#f472b6',
    scarto: 'rgba(244, 114, 182, 0.42)'
  };

  // --- I dati ---------------------------------------------------------

  function spaChiediDati() {
    if (typeof costCaricaDistanze !== 'function') { spa.stato = 'fallito'; return; }
    if (spa.stato === 'carico') return;
    spa.stato = 'carico';
    costCaricaDistanze().then((bene) => {
      spa.stato = bene ? 'pronto' : 'fallito';
      if (!bene) return;
      spaPrepara();
      spaAggiornaTesti();
    });
  }

  function spaPrepara() {
    if (typeof costStelle3D !== 'function') return;
    const d = costStelle3D(spa.sigla);
    if (!d) return;
    // Cambiando figura la meta non vuol più dire niente: era l'indice di
    // una stella di un'altra costellazione, e tenerla vorrebbe dire
    // trasferirsi su una stella a caso di quella nuova
    if (!spa.dati || spa.dati.sigla !== d.sigla) spa.meta = null;
    // Le stelle si ordinano dalla più vicina alla più lontana: serve al
    // grafico delle distanze, e serve a disegnare in 3D quelle davanti
    // per ultime
    d.ordine = d.stelle.map((s, i) => i).sort((a, b) => d.stelle[a].al - d.stelle[b].al);
    d.minima = d.stelle[d.ordine[0]].al;
    d.massima = d.stelle[d.ordine[d.ordine.length - 1]].al;
    spa.dati = d;
    spaCostruisciMete();
  }

  // La stella su cui ci si è trasferiti, se ce n'è una: il punto di vista
  // non è più un posto qualunque dello spazio ma un pianeta di quella
  // stella lì, che nel suo cielo è il Sole.
  function spaMeta() {
    const d = spa.dati;
    if (!d || spa.meta === null) return null;
    return d.stelle[spa.meta] || null;
  }

  // Le mete offerte: le stelle della figura che hanno un nome, dalla più
  // luminosa, con le distanze misurate prima di quelle stimate — su una
  // distanza di ripiego un viaggio non vuol dire niente.
  function spaMete() {
    const d = spa.dati;
    if (!d) return [];
    return d.stelle
      .map((s, i) => ({ i, s }))
      .filter(v => v.s.nome)
      .sort((a, b) => (a.s.stimata - b.s.stimata) || (a.s.mag - b.s.mag))
      .slice(0, 5);
  }

  // Il punto da cui si guarda. Due modi, e sono due domande diverse. Con
  // una meta scelta si sta su un pianeta di quella stella, ed è la
  // domanda che dà il nome al quadro. Senza, si parte dal Sole e ci si
  // sposta di `viaggio` anni luce in una direzione PERPENDICOLARE alla
  // linea che punta alla costellazione: è la scelta che fa vedere di più,
  // perché andando verso la figura o allontanandosene cambierebbe solo la
  // scala, mentre di traverso la prospettiva si smonta.
  function spaOsservatore() {
    const d = spa.dati;
    if (!d) return [0, 0, 0];
    const meta = spaMeta();
    if (meta) return [meta.x, meta.y, meta.z];
    const c = spaCentro();
    const n = Math.hypot(c[0], c[1], c[2]) || 1;
    const f = [c[0] / n, c[1] / n, c[2] / n];
    // Due assi qualunque perpendicolari alla direzione della figura
    const su = Math.abs(f[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    const a = spaNormale(spaCroce(f, su));
    const b = spaNormale(spaCroce(f, a));
    const t = spa.direzione * Math.PI / 180;
    const ca = Math.cos(t), sa = Math.sin(t);
    return [
      spa.viaggio * (a[0] * ca + b[0] * sa),
      spa.viaggio * (a[1] * ca + b[1] * sa),
      spa.viaggio * (a[2] * ca + b[2] * sa)
    ];
  }

  function spaCroce(u, v) {
    return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  }
  function spaNormale(v) {
    const n = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / n, v[1] / n, v[2] / n];
  }

  // Il baricentro della figura nello spazio, pesato sulla luminosità: è
  // lì che punta la telecamera, ed è la direzione da cui si misura lo
  // spostamento dell'osservatore
  function spaCentro() {
    const d = spa.dati;
    if (!d) return [0, 0, 1];
    let x = 0, y = 0, z = 0, p = 0;
    d.stelle.forEach(s => {
      const w = Math.pow(2.512, -s.mag);
      x += s.x * w; y += s.y * w; z += s.z * w; p += w;
    });
    return p ? [x / p, y / p, z / p] : [0, 0, 1];
  }

  // --- Come si vede una stella da un punto qualunque -------------------
  //
  // Non è una formula astronomica: è la definizione stessa di «vedere».
  // Si prende il vettore dall'osservatore alla stella, lo si normalizza,
  // e si guarda dove cade rispetto alla direzione in cui si sta
  // guardando. Da qui (osservatore nell'origine) torna esattamente la
  // posizione di catalogo; da altrove torna un'altra cosa, ed è tutto il
  // punto del banco.
  function spaCielo(s, occhio, base) {
    const dx = s.x - occhio[0], dy = s.y - occhio[1], dz = s.z - occhio[2];
    const dist = Math.hypot(dx, dy, dz) || 1e-6;
    const u = [dx / dist, dy / dist, dz / dist];
    return {
      x: u[0] * base.r[0] + u[1] * base.r[1] + u[2] * base.r[2],
      y: u[0] * base.u[0] + u[1] * base.u[1] + u[2] * base.u[2],
      avanti: u[0] * base.f[0] + u[1] * base.f[1] + u[2] * base.f[2],
      dist
    };
  }

  // Una terna ortonormale che guarda verso `f`
  function spaBaseVerso(f) {
    const fn = spaNormale(f);
    const su = Math.abs(fn[2]) > 0.95 ? [1, 0, 0] : [0, 0, 1];
    const r = spaNormale(spaCroce(su, fn));
    const u = spaCroce(fn, r);
    return { f: fn, r, u };
  }

  // Quanto appare luminosa una stella da una certa distanza: la magnitudine
  // cambia col quadrato della distanza, e questa è la seconda metà della
  // sorpresa — allontanandosi non cambia solo il disegno, cambia CHI si
  // vede. Rigel da vicino è un faro, Sirio da mille anni luce sparisce.
  function spaMagnitudine(s, dist) {
    return s.mag + 5 * Math.log10(Math.max(0.001, dist / s.al));
  }

  function spaRaggioStella(mag) {
    return Math.max(0.7, 4.6 - mag * 0.72);
  }

  // Quanto ci si è allontanati dal Sole, in anni luce: è l'unica cosa che
  // distingue «sei ancora a casa» da «guarda cos'è successo», e vale per
  // tutt'e due i modi di spostarsi
  function spaLontananza() {
    const o = spaOsservatore();
    return Math.hypot(o[0], o[1], o[2]);
  }

  // L'angolo fra due stelle in cielo, in gradi. I punti di `spaCielo`
  // sono già le componenti del versore in una terna ortonormale, quindi
  // il prodotto scalare è quello vero — purché le due letture vengano
  // dallo stesso posto, e infatti si confrontano sempre a coppie.
  function spaAngolo(a, b) {
    const c = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.avanti * b.avanti));
    return Math.acos(c) * 180 / Math.PI;
  }

  // Il confronto fra i due cieli: quante stelle sono svanite, e soprattutto
  // quale coppia di stelle *unite da una linea della figura* si è aperta o
  // chiusa di più. È il numero che dice la cosa senza metafore: Alnitak e
  // Alnilam, che da qui sono a un grado e mezzo, da lassù sono a
  // sessanta — e una figura è fatta esattamente di quelle distanze.
  function spaConfronto() {
    const d = spa.dati;
    if (!d) return null;
    const occhio = spaOsservatore();
    const centro = spaCentro();
    const baseQui = spaBaseVerso(centro);
    const base = spaBaseVerso([centro[0] - occhio[0], centro[1] - occhio[1], centro[2] - occhio[2]]);
    const qui = d.stelle.map(s => spaCielo(s, [0, 0, 0], baseQui));
    const la = d.stelle.map(s => spaCielo(s, occhio, base));
    const svanite = d.stelle.filter((s, i) =>
      i !== spa.meta && spaMagnitudine(s, la[i].dist) > 6.5).length;

    let coppia = null;
    d.linee.forEach(([a, b]) => {
      if (a === spa.meta || b === spa.meta) return;
      const prima = spaAngolo(qui[a], qui[b]);
      const dopo = spaAngolo(la[a], la[b]);
      const salto = Math.abs(dopo - prima);
      if (!coppia || salto > coppia.salto) {
        coppia = { a, b, prima, dopo, salto };
      }
    });
    return { svanite, coppia, qui, la };
  }

  // Le tre stelle della cintura di Orione stanno a otto pixel l'una
  // dall'altra: scritte lì com'è, le tre etichette si stampano una sopra
  // l'altra e non si legge nessuna delle tre. Qui si tiene l'elenco delle
  // zone già occupate e si prova a scostare l'etichetta — sopra, sotto, a
  // sinistra — finché trova posto. Se non lo trova, non si scrive: una
  // scritta illeggibile è peggio di una scritta assente.
  function spaEtichetta(ctx, testo, x, y, colore, zone) {
    const largo = testo.length * 5.4 + 8, alto = 13;
    const prove = [[6, -3], [6, 11], [6, -15], [-largo - 6, -3], [-largo - 6, 11], [6, 23]];
    for (const [dx, dy] of prove) {
      const bx = x + dx, by = y + dy - alto + 3;
      const libero = zone.every(z =>
        bx > z.x + z.w || bx + largo < z.x || by > z.y + z.h || by + alto < z.y);
      if (!libero) continue;
      zone.push({ x: bx, y: by, w: largo, h: alto });
      didScritta(ctx, testo, x + dx, y + dy, { colore, misura: 10, peso: 600, schermo: true });
      return true;
    }
    return false;
  }

  // --- Quadro 1: la figura come si vede da qui -------------------------

  function spaDisegnaFigura() {
    const tela = didTela('did-spa-figura', 1.5, 420, { lente: true, pieno: true });
    if (!tela) return;
    const { ctx, L, H } = tela;
    didSfondo(ctx, L, H);
    const d = spa.dati;
    if (!d) { spaAttesa(ctx, L, H); return; }

    const base = spaBaseVerso(spaCentro());
    const punti = d.stelle.map(s => spaCielo(s, [0, 0, 0], base));
    const g = spaInquadra(punti, L, H, 42);

    // Le linee della figura
    ctx.strokeStyle = SPA_C.linea;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    d.linee.forEach(([a, b]) => {
      const pa = g(punti[a]), pb = g(punti[b]);
      ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
    });
    ctx.stroke();

    // Le stelle, con la distanza scritta accanto alle più luminose
    const zone = [{ x: 0, y: 0, w: 300, h: 26 }];   // la riga di titolo in alto
    d.stelle.forEach((s, i) => {
      const p = g(punti[i]);
      const r = spaRaggioStella(s.mag);
      didCorpoSchermo(ctx, p.x, p.y, r, costColoreStella(s.bv), { alone: r * 3 });
      if (s.mag < 2.9 && s.nome) {
        spaEtichetta(ctx, `${s.nome} · ${Math.round(s.al)} al`, p.x + r, p.y, C.testo2, zone);
      }
    });

    didScritta(ctx, 'Da qui: la figura che tutti conoscono', 12, 18,
      { colore: C.testo3, misura: 11, peso: 700, schermo: true });
  }

  // --- Il grafico delle distanze ---------------------------------------
  //
  // Un istogramma orizzontale, una barra per stella, in scala logaritmica
  // — perché fra Gacrux (89 anni luce) e Alnilam (1.977) c'è un fattore
  // venti, e in scala lineare le vicine diventerebbero righe invisibili.
  // È il quadro che dice la cosa in un colpo solo: le barre non sono
  // nemmeno lontanamente uguali.

  function spaDisegnaDistanze() {
    const tela = didTela('did-spa-distanze', 1.35, 430, { lente: true });
    if (!tela) return;
    const { ctx, L, H } = tela;
    ctx.clearRect(0, 0, L, H);
    const d = spa.dati;
    if (!d) { spaAttesa(ctx, L, H); return; }

    // Solo le stelle che hanno un nome o sono luminose: ottanta barre non
    // si leggono, dodici sì
    const scelte = d.ordine
      .map(i => ({ i, s: d.stelle[i] }))
      .filter(v => v.s.mag < 3.6 || v.s.nome)
      .slice(0, 14);
    if (!scelte.length) return;

    const sx = 104, dx = 34, alto = 26, basso = 44;
    const larga = Math.max(40, L - sx - dx);
    const passo = (H - alto - basso) / scelte.length;
    const min = Math.max(1, d.minima * 0.7), max = d.massima * 1.15;
    const lg = v => Math.log10(Math.max(1, v));
    const perX = v => sx + larga * (lg(v) - lg(min)) / Math.max(0.05, lg(max) - lg(min));

    // Le tacche: 10, 100, 1.000 anni luce
    ctx.strokeStyle = 'rgba(148, 168, 214, 0.16)';
    ctx.lineWidth = 1;
    [10, 30, 100, 300, 1000, 3000].forEach(v => {
      if (v < min || v > max) return;
      const x = perX(v);
      ctx.beginPath(); ctx.moveTo(x, alto - 6); ctx.lineTo(x, H - basso + 4); ctx.stroke();
      didScritta(ctx, v >= 1000 ? (v / 1000) + '.000' : String(v), x, H - basso + 16,
        { colore: C.testo3, misura: 10, allinea: 'center', peso: 600, schermo: true });
    });
    didScritta(ctx, 'anni luce', L - dx, H - basso + 16,
      { colore: C.testo3, misura: 10, allinea: 'right', peso: 600, schermo: true });

    scelte.forEach((v, k) => {
      const y = alto + passo * (k + 0.5);
      const x = perX(v.s.al);
      const colore = v.s.al > d.minima * 4 ? SPA_C.barraLontana : SPA_C.barra;
      ctx.strokeStyle = colore;
      ctx.lineWidth = Math.max(3, Math.min(9, passo * 0.42));
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(x, y); ctx.stroke();
      didCorpoSchermo(ctx, x, y, 3.4, costColoreStella(v.s.bv), { alone: 9 });
      didScritta(ctx, v.s.nome || 'una stella', sx - 8, y + 3,
        { colore: C.testo2, misura: 10.5, allinea: 'right', peso: 600, schermo: true });
      didScritta(ctx, `${Math.round(v.s.al)}${v.s.stimata ? ' ?' : ''}`, x + 9, y + 3,
        { colore: C.testo3, misura: 10, peso: 600, schermo: true });
    });

    didScritta(ctx, 'Quanto è lontana ognuna — scala logaritmica', 12, 16,
      { colore: C.testo3, misura: 11, peso: 700, schermo: true });
  }

  // --- Quadro 2: le stelle nello spazio, in tre dimensioni -------------

  function spaVista(L, H, campo) {
    const az = spa.cam.az * Math.PI / 180, el = spa.cam.elev * Math.PI / 180;
    const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
    return {
      L, H, cx: L / 2, cy: H / 2,
      scala: Math.min(L * 0.44, H * 0.82) / campo,
      r: [-sa, ca, 0],
      u: [-se * ca, -se * sa, ce],
      f: [ce * ca, ce * sa, se]
    };
  }

  // La scena si guarda in un riferimento in cui la figura sta davanti:
  // si ruota lo spazio perché la direzione della costellazione diventi
  // l'asse y, e il Sole resta nell'origine. Senza, una figura vicina al
  // polo si vedrebbe di taglio comunque si giri la telecamera.
  function spaLocale(p, telaio) {
    const q = [p[0] - 0, p[1] - 0, p[2] - 0];
    return [
      q[0] * telaio.a[0] + q[1] * telaio.a[1] + q[2] * telaio.a[2],
      q[0] * telaio.f[0] + q[1] * telaio.f[1] + q[2] * telaio.f[2],
      q[0] * telaio.b[0] + q[1] * telaio.b[1] + q[2] * telaio.b[2]
    ];
  }

  function spaTelaio() {
    const f = spaNormale(spaCentro());
    const su = Math.abs(f[2]) > 0.95 ? [1, 0, 0] : [0, 0, 1];
    const a = spaNormale(spaCroce(su, f));
    const b = spaCroce(f, a);
    return { f, a, b };
  }

  function spaPro(p, w) {
    return {
      x: w.cx + (p[0] * w.r[0] + p[1] * w.r[1] + p[2] * w.r[2]) * w.scala,
      y: w.cy - (p[0] * w.u[0] + p[1] * w.u[1] + p[2] * w.u[2]) * w.scala,
      z: p[0] * w.f[0] + p[1] * w.f[1] + p[2] * w.f[2]
    };
  }

  // --- Le scene in tre dimensioni (quadro 2, e il fianco del quadro 3) --
  //
  // Il cielo rifatto dice *che* la figura si è disfatta; questa scena dice
  // *perché*. Il punto di vista è segnato dove sta davvero, con i suoi
  // raggi visuali: si vede che partono da un altro capo del fuso, e che da
  // lì due stelle che da casa erano una accanto all'altra stanno da parti
  // opposte. Si gira col dito, come tutte le scene 3D del laboratorio.
  //
  // La scena è una sola funzione per due quadri. Cambia
  // dove sta l'occhio — nel Sole per il quadro «Nello spazio», sulla meta
  // per quello «Da un altro pianeta» — e da lì cambia tutto il resto: da
  // dove partono i raggi visuali, cosa c'è da inquadrare, cosa si scrive.
  function spaScena3D(id, opz) {
    const tela = didTela(id, opz.proporzione, opz.altezza,
      { lente: true, trascina: false, pieno: true });
    if (!tela) return;
    const { ctx, L, H } = tela;
    didSfondo(ctx, L, H);
    const d = spa.dati;
    if (!d) { spaAttesa(ctx, L, H); return; }

    const occhio = opz.occhio || [0, 0, 0];
    const staltrove = Math.hypot(occhio[0], occhio[1], occhio[2]) > 0.5;
    const telaio = spaTelaio();
    const locali = d.stelle.map(s => spaLocale([s.x, s.y, s.z], telaio));
    const locOcchio = spaLocale(occhio, telaio);

    // L'inquadratura si misura sui punti veri, non sulla distanza massima:
    // le stelle di una figura stanno tutte quasi nella stessa direzione,
    // quindi occupano un fuso sottile: inquadrando una sfera larga quanto
    // la più lontana, la scena finiva tutta in un francobollo in mezzo
    // alla tela.
    const grezza = spaVista(L, H, 1);
    const daTenere = locali.concat([[0, 0, 0]]);
    if (staltrove) daTenere.push(locOcchio);   // il punto di vista sta nel quadro
    const crudi = daTenere.map(p => spaPro(p, grezza));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    crudi.forEach(p => {
      minX = Math.min(minX, p.x - L / 2); maxX = Math.max(maxX, p.x - L / 2);
      minY = Math.min(minY, p.y - H / 2); maxY = Math.max(maxY, p.y - H / 2);
    });
    const campo = Math.max(1e-6, Math.max(maxX - minX, (maxY - minY) * 1.25)) /
      (Math.min(L * 0.44, H * 0.82) / 1) * 1.16;
    const w = spaVista(L, H, campo);
    // Il centro della scena è il mezzo di quello che c'è, non l'origine:
    // il Sole sta a un capo del fuso, e centrare su di lui butterebbe
    // fuori schermo metà delle stelle
    w.cx -= (minX + maxX) / 2 * (w.scala / grezza.scala);
    w.cy -= (minY + maxY) / 2 * (w.scala / grezza.scala);
    const punti = locali.map(p => spaPro(p, w));
    const sole = spaPro([0, 0, 0], w);
    const occhioP = staltrove ? spaPro(locOcchio, w) : sole;

    // Le zone già occupate dalle scritte. Si riempie dall'alto in giù per
    // importanza — prima la riga di titolo, poi il Sole e il punto di
    // vista, che sono i due perni del quadro, poi il metro dei cerchi, e
    // per ultimi i nomi delle stelle, che sono tanti e possono rinunciare.
    // Prima non c'era ordine e si stampavano tutte l'una sull'altra: da
    // Betelgeuse, «1.000 al» finiva esattamente sopra a «il Sole».
    const zone3d = [{ x: 0, y: 0, w: 360, h: 26 }];
    const prendi = (x, y, largo, alto) => {
      const b = { x: x - largo / 2, y: y - alto + 3, w: largo, h: alto };
      const libero = zone3d.every(z =>
        b.x > z.x + z.w || b.x + b.w < z.x || b.y > z.y + z.h || b.y + b.h < z.y);
      if (libero) zone3d.push(b);
      return libero;
    };
    // I due perni si prendono il posto anche se sono disegnati per ultimi,
    // e a differenza di tutti gli altri non rinunciano mai: se sotto al
    // pallino non c'è spazio la scritta va sopra, ma va. Con la meta su
    // una stella della figura i due pallini finiscono vicini — cinquecento
    // anni luce, in una scena larga duemila, sono un centimetro — e le due
    // scritte centrate si stampavano una sull'altra.
    const posa = (x, y, testo, prove) => {
      const largo = testo.length * 5.4 + 8;
      for (const [dx, dy] of prove) {
        if (prendi(x + dx, y + dy, largo, 13)) return { x: x + dx, y: y + dy };
      }
      return { x: x + prove[0][0], y: y + prove[0][1] };
    };
    const nomeSole = staltrove ? 'il Sole — casa' : 'il Sole — noi siamo qui';
    const postoSole = posa(sole.x, sole.y, nomeSole, [[0, 18], [0, -13], [0, 31]]);
    const nomeOcchio = opz.nomeOcchio || 'sei qui';
    const postoOcchio = staltrove
      ? posa(occhioP.x, occhioP.y, nomeOcchio, [[0, 22], [0, -17], [0, 35], [0, -30]])
      : null;

    // I cerchi di distanza attorno al Sole: 100, 500, 1.000, 2.000 anni
    // luce. Sono il metro della scena — senza, «lontano» non vuol dire
    // niente e la scena sembra un modellino senza misure. Il cerchio si
    // disegna sempre; la sua scritta solo se trova posto, perché una
    // misura illeggibile non misura niente.
    ctx.save();
    [100, 250, 500, 1000, 2000, 4000].forEach(raggio => {
      if (raggio > d.massima * 1.4) return;
      ctx.beginPath();
      for (let k = 0; k <= 72; k++) {
        const t = k / 72 * Math.PI * 2;
        const p = spaPro([raggio * Math.cos(t), raggio * Math.sin(t), 0], w);
        if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = 'rgba(148, 168, 214, 0.13)';
      ctx.lineWidth = 1;
      ctx.stroke();
      const et = spaPro([raggio, 0, 0], w);
      const testo = raggio >= 1000 ? (raggio / 1000) + '.000 al' : raggio + ' al';
      if (!prendi(et.x, et.y - 4, testo.length * 5.4 + 8, 13)) return;
      didScritta(ctx, testo, et.x, et.y - 4,
        { colore: C.testo3, misura: 9.5, allinea: 'center', peso: 600, schermo: true });
    });
    ctx.restore();

    // I raggi visuali dall'occhio a ogni stella: sono LA spiegazione. Dal
    // Sole tutte le stelle della figura stanno dentro a un fascio
    // strettissimo, e a distanze completamente diverse lungo quel fascio;
    // da un altro capo dello spazio il fascio si apre a ventaglio, ed è
    // esattamente quello che il cielo lì accanto sta mostrando.
    ctx.strokeStyle = SPA_C.raggio;
    ctx.lineWidth = 1;
    ctx.beginPath();
    punti.forEach((p, i) => {
      if (staltrove && i === spa.meta) return;
      ctx.moveTo(occhioP.x, occhioP.y); ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Il tragitto: dal Sole a dove si è finiti. È la misura di tutto il
    // quadro, e senza di lei il puntino rosa sembra messo lì a caso.
    if (staltrove) {
      ctx.save();
      ctx.strokeStyle = SPA_C.occhio;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(sole.x, sole.y); ctx.lineTo(occhioP.x, occhioP.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Le linee della figura, che qui si vedono per quello che sono:
    // congiungimenti fra stelle che non si toccano
    ctx.strokeStyle = SPA_C.linea3d;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    d.linee.forEach(([a, b]) => {
      ctx.moveTo(punti[a].x, punti[a].y);
      ctx.lineTo(punti[b].x, punti[b].y);
    });
    ctx.stroke();

    // Le stelle, dalla più lontana alla più vicina
    const perZ = d.stelle.map((s, i) => i).sort((a, b) => punti[a].z - punti[b].z);
    perZ.forEach(i => {
      const s = d.stelle[i], p = punti[i];
      const r = spaRaggioStella(s.mag);
      didCorpoSchermo(ctx, p.x, p.y, r, costColoreStella(s.bv), { alone: r * 2.8 });
      // La stella su cui si sta seduti non si nomina due volte: il suo
      // nome è già quello del punto di vista, un palmo più in giù
      if (s.mag < 2.2 && s.nome && !(staltrove && i === spa.meta)) {
        spaEtichetta(ctx, `${s.nome} · ${Math.round(s.al)} al`, p.x + r, p.y, C.testo2, zone3d);
      }
    });

    // Il Sole, che qui è un puntino come gli altri
    didCorpoSchermo(ctx, sole.x, sole.y, 3.4, SPA_C.sole, { alone: 8 });
    didScritta(ctx, nomeSole, postoSole.x, postoSole.y,
      { colore: SPA_C.sole, misura: 10.5, allinea: 'center', peso: 700, schermo: true });

    // E il punto di vista, dove sta davvero: è il perno di tutto il quadro
    if (staltrove) {
      ctx.save();
      ctx.strokeStyle = SPA_C.occhio;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(occhioP.x, occhioP.y, 7.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      didCorpoSchermo(ctx, occhioP.x, occhioP.y, 3, SPA_C.occhio, { alone: 9 });
      didScritta(ctx, nomeOcchio, postoOcchio.x, postoOcchio.y,
        { colore: SPA_C.occhio, misura: 10.5, allinea: 'center', peso: 700, schermo: true });
    }

    didScritta(ctx, opz.titolo, 12, 18,
      { colore: C.testo3, misura: 11, peso: 700, schermo: true });
  }

  function spaDisegnaSpazio() {
    spaScena3D('did-spa-tela', {
      proporzione: 1.45, altezza: 480, occhio: [0, 0, 0],
      titolo: 'Gira col dito: la figura è un caso, e si vede subito'
    });
  }

  // La stessa scena, ma col punto di vista spostato dove dice la slitta o
  // la meta scelta: sta accanto al cielo rifatto, e si gira col dito
  function spaDisegnaAltrove3D() {
    const meta = spaMeta();
    const via = Math.round(spaLontananza());
    spaScena3D('did-spa-tela-altrove', {
      proporzione: 1.35, altezza: 420,
      occhio: spaOsservatore(),
      nomeOcchio: meta ? `sei qui — ${meta.nome}` : (via ? `sei qui · ${via} al` : 'sei qui'),
      titolo: via
        ? 'Gira col dito: da lì i raggi visuali si aprono a ventaglio'
        : 'Gira col dito — poi spostati, e guarda cosa succede ai raggi'
    });
  }

  // --- Quadro 3: il cielo da un altro punto ----------------------------

  function spaDisegnaAltrove() {
    const tela = didTela('did-spa-altrove', 1.5, 460, { lente: true, pieno: true });
    if (!tela) return;
    const { ctx, L, H } = tela;
    didSfondo(ctx, L, H);
    const d = spa.dati;
    if (!d) { spaAttesa(ctx, L, H); return; }

    const occhio = spaOsservatore();
    const meta = spaMeta();
    const centro = spaCentro();
    // Si continua a guardare verso la figura, da dove si è arrivati
    const base = spaBaseVerso([centro[0] - occhio[0], centro[1] - occhio[1], centro[2] - occhio[2]]);

    // L'inquadratura parte da quella di casa e NON si riadatta per stare
    // comoda: se si riadattasse, la figura resterebbe sempre della stessa
    // misura e non si vedrebbe più niente cambiare. È il punto: si sta
    // guardando lo stesso pezzo di cielo, ed è la figura a smontarsi.
    // Cede solo quando la figura nuova straborderebbe dalla tela — e
    // succede appena si va a stare su una delle sue stelle, che di quel
    // cielo occupa metà: allora il riquadro si allarga tenendo fermo il
    // centro, così l'ingrandimento cambia ma il pezzo di cielo no.
    const daQui = d.stelle.map(s => spaCielo(s, [0, 0, 0], spaBaseVerso(centro)));
    const punti = d.stelle.map(s => spaCielo(s, occhio, base));
    const magOra = d.stelle.map((s, i) => spaMagnitudine(s, punti[i].dist));
    const viva = i => i !== spa.meta && punti[i].avanti && magOra[i] <= 6.5;
    const g = spaInquadraAltrove(daQui, punti, L, H, 46, viva);
    const partito = spaLontananza() > 0.5;

    // Il fantasma della figura di casa: tratteggiata e grigia, sotto a
    // tutto. Senza, il quadro mostra una figura sfasciata ma non c'è più
    // niente con cui confrontarla — e «diversa da cosa?» è la prima
    // domanda che si fa chi guarda.
    if (partito) {
      ctx.save();
      ctx.strokeStyle = SPA_C.fantasma;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      d.linee.forEach(([a, b]) => {
        const pa = g(daQui[a]), pb = g(daQui[b]);
        ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // E il filo che unisce ogni stella luminosa a dov'era: è il modo
      // più corto per dire di quanto si è spostata quella lì
      ctx.save();
      ctx.strokeStyle = SPA_C.scarto;
      ctx.lineWidth = 1;
      ctx.beginPath();
      d.stelle.forEach((s, i) => {
        if (!viva(i) || s.mag > 2.9 || !s.nome) return;
        const a = g(daQui[i]), b = g(punti[i]);
        if (Math.hypot(a.x - b.x, a.y - b.y) < 6) return;
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    ctx.strokeStyle = SPA_C.linea;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    d.linee.forEach(([a, b]) => {
      if (!viva(a) || !viva(b)) return;
      const pa = g(punti[a]), pb = g(punti[b]);
      ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
    });
    ctx.stroke();

    const zone = [{ x: 0, y: 0, w: 340, h: 40 }];
    d.stelle.forEach((s, i) => {
      if (!viva(i)) return;               // dietro le spalle, o troppo debole
      const p = g(punti[i]);
      const r = spaRaggioStella(magOra[i]);
      didCorpoSchermo(ctx, p.x, p.y, r, costColoreStella(s.bv), { alone: r * 3 });
      if (partito && s.nome && s.mag < 2.9) {
        spaEtichetta(ctx, s.nome, p.x + r, p.y, C.testo2, zone);
      }
    });

    let testo;
    if (!partito) testo = 'Sei sul Sole: è la figura di sempre';
    else if (meta) testo = `Da un pianeta di ${meta.nome} · ${Math.round(meta.al)} anni luce da casa`;
    else testo = `${Math.round(spa.viaggio)} anni luce di lato — e la figura non c'è più`;
    didScritta(ctx, testo, 12, 18,
      { colore: partito ? '#c4b5fd' : C.testo3, misura: 11, peso: 700, schermo: true });
    if (partito) {
      didScritta(ctx, meta
        ? `in grigio com'era da qui — e ${meta.nome}, lassù, è il tuo Sole`
        : "in grigio com'era da qui",
        12, 33, { colore: C.testo3, misura: 10, peso: 600, schermo: true });
    }
  }

  // Il riquadro occupato da un gruppo di punti, o `null` se non ce n'è
  // nemmeno uno davanti agli occhi
  function spaScatola(punti, tieni) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    punti.forEach((p, i) => {
      if (!p.avanti) return;
      if (tieni && !tieni(i)) return;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    return isFinite(minX) ? { minX, maxX, minY, maxY } : null;
  }

  // L'inquadratura del quadro «da un altro pianeta»: il centro è sempre
  // quello della figura vista da casa — è lo stesso pezzo di cielo, e
  // spostarlo vorrebbe dire barare — ma il riquadro si allarga quanto
  // serve perché ci stia dentro anche la figura nuova. Tenendolo fisso,
  // come faceva prima, bastava andare a stare su una stella della figura
  // per ritrovarsi con tutto fuori dalla tela e la sensazione che il
  // quadro fosse rotto.
  function spaInquadraAltrove(daQui, ora, L, H, margine, tieni) {
    const a = spaScatola(daQui) || { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const b = spaScatola(ora, tieni);
    const mx = (a.minX + a.maxX) / 2, my = (a.minY + a.maxY) / 2;
    let hx = (a.maxX - a.minX) / 2, hy = (a.maxY - a.minY) / 2;
    if (b) {
      hx = Math.max(hx, Math.abs(b.minX - mx), Math.abs(b.maxX - mx));
      hy = Math.max(hy, Math.abs(b.minY - my), Math.abs(b.maxY - my));
    }
    const scala = Math.min(
      (L - margine * 2) / Math.max(0.02, hx * 2),
      (H - margine * 2) / Math.max(0.02, hy * 2));
    return p => ({ x: L / 2 - (p.x - mx) * scala, y: H / 2 - (p.y - my) * scala });
  }

  // Un'inquadratura che tiene dentro tutti i punti dati, con un margine
  function spaInquadra(punti, L, H, margine) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    punti.forEach(p => {
      if (!p.avanti) return;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    if (!isFinite(minX)) { minX = maxX = minY = maxY = 0; }
    const scala = Math.min(
      (L - margine * 2) / Math.max(0.02, maxX - minX),
      (H - margine * 2) / Math.max(0.02, maxY - minY));
    const mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
    return p => ({ x: L / 2 - (p.x - mx) * scala, y: H / 2 - (p.y - my) * scala });
  }

  // Il dito che gira una scena in 3D del banco. Un dito solo: appena ne
  // arriva un secondo il gesto è della lente (avvicina e sposta), e questo
  // si tira da parte invece di litigarci.
  function spaCollegaGiro(id) {
    const tela = $(id);
    if (!tela) return;
    const dita = new Set();
    tela.addEventListener('pointerdown', (e) => {
      dita.add(e.pointerId);
      spa.trascina = dita.size === 1 ? { x: e.clientX, y: e.clientY } : null;
    });
    tela.addEventListener('pointermove', (e) => {
      if (!spa.trascina || dita.size !== 1) return;
      const dx = e.clientX - spa.trascina.x, dy = e.clientY - spa.trascina.y;
      spa.trascina = { x: e.clientX, y: e.clientY };
      spa.cam.az -= dx * 0.42;
      spa.cam.elev = Math.max(-84, Math.min(84, spa.cam.elev + dy * 0.34));
      spa.camV.az = spa.cam.az;
      spa.camV.elev = spa.cam.elev;
    });
    const su = (e) => { dita.delete(e.pointerId); if (!dita.size) spa.trascina = null; };
    tela.addEventListener('pointerup', su);
    tela.addEventListener('pointercancel', su);
    tela.addEventListener('pointerleave', su);
  }

  function spaAttesa(ctx, L, H) {
    didScritta(ctx, spa.stato === 'fallito'
      ? 'Le distanze non si sono caricate: serve la rete, una volta sola.'
      : 'Sto prendendo le distanze delle stelle…',
      L / 2, H / 2, { colore: C.testo3, misura: 12, allinea: 'center', peso: 600, schermo: true });
  }

  // --- I numeri scritti sotto ------------------------------------------

  function spaAggiornaTesti() {
    const d = spa.dati;
    if (!d) return;
    const vicina = d.stelle[d.ordine[0]];
    const lontana = d.stelle[d.ordine[d.ordine.length - 1]];
    const rapporto = lontana.al / Math.max(1, vicina.al);
    // Quante stelle della figura, da dove ci si è spostati, sono già
    // scese sotto la sesta magnitudine: è la seconda metà della sorpresa
    const cfr = spaConfronto();
    const svanite = cfr ? cfr.svanite : 0;

    scrivi('did-spa-vicina', `${vicina.nome || 'una stella'} · ${Math.round(vicina.al)} al`);
    scrivi('did-spa-lontana', `${lontana.nome || 'una stella'} · ${Math.round(lontana.al)} al`);
    scrivi('did-spa-rapporto', `${rapporto.toFixed(1)} volte`, rapporto > 3 ? 'ambra' : null);
    scrivi('did-spa-svanite', `${svanite} su ${d.stelle.length}`, svanite ? 'ambra' : null);

    // La coppia che si è aperta di più: due stelle unite da una linea
    // della figura, e quanto distavano prima e quanto distano adesso
    const c = cfr && cfr.coppia;
    if (!c || c.salto < 0.05) {
      scrivi('did-spa-coppia', spaLontananza() > 0.5 ? 'niente di misurabile' : '—');
    } else {
      const na = d.stelle[c.a].nome || 'una stella';
      const nb = d.stelle[c.b].nome || 'una stella';
      scrivi('did-spa-coppia',
        `${na}–${nb}: da ${num(c.prima, 1)}° a ${num(c.dopo, 1)}°`,
        c.salto > 5 ? 'ambra' : null);
    }
  }

  function spaAggiornaSlitte() {
    const meta = spaMeta();
    const v = $('did-spa-viaggio-valore');
    if (v) {
      v.textContent = meta ? `${Math.round(meta.al)} anni luce`
        : (spa.viaggio < 1 ? 'sul Sole' : `${Math.round(spa.viaggio)} anni luce`);
    }
    const dir = $('did-spa-direzione-valore');
    if (dir) dir.textContent = meta ? 'verso la meta' : `${Math.round(spa.direzione)}°`;
    const mete = $('did-spa-mete');
    if (mete) mete.querySelectorAll('[data-meta]').forEach(b =>
      b.classList.toggle('attiva', b.dataset.meta === String(spa.meta)));
  }

  // Le mete cambiano con la figura, quindi la fila di pillole si riscrive
  // ogni volta: la prima è sempre «dal Sole», cioè il volo libero delle
  // due slitte, e le altre sono le stelle della figura
  function spaCostruisciMete() {
    const riga = $('did-spa-mete');
    if (!riga) return;
    const mete = spaMete();
    riga.innerHTML =
      `<span class="did-etichetta">Va' a stare su…</span>` +
      `<button type="button" class="did-pillola${spa.meta === null ? ' attiva' : ''}" data-meta="null">dal Sole</button>` +
      mete.map(v => `<button type="button" class="did-pillola${spa.meta === v.i ? ' attiva' : ''}" data-meta="${v.i}" title="${Math.round(v.s.al)} anni luce da qui${v.s.stimata ? ', distanza stimata' : ''}">${v.s.nome}</button>`).join('');
  }

  // Il ponte in entrata: dalla scheda dell'atlante si arriva qui, con la
  // figura già scelta. Funziona per tutte e ottantotto, non solo per le
  // otto che hanno una pillola: se la figura non è fra quelle, nessuna
  // pillola resta accesa ed è giusto così — il banco sta mostrando una
  // costellazione che non è in elenco.
  window.didCostellazioneNelloSpazio = function (sigla) {
    // Chi arriva qui dall'atlante lo lascia aperto dietro di sé: si
    // ritroverebbe il banco sotto a un velo nero, senza capire perché
    if (typeof chiudiAtlanteCostellazioni === 'function') chiudiAtlanteCostellazioni();
    if (typeof mostraVista === 'function') mostraVista('didattica');
    didatticaAvvia();
    spa.sigla = sigla || spa.sigla;
    spa.viaggio = 0;
    spa.meta = null;
    spa.quadro = 'figura';
    didApri('spazio');
    const figure = $('did-spa-figure');
    if (figure) figure.querySelectorAll('[data-figura]').forEach(x =>
      x.classList.toggle('attiva', x.dataset.figura === spa.sigla));
    const quadri = $('did-spa-quadri');
    if (quadri) quadri.querySelectorAll('[data-quadro]').forEach(x =>
      x.classList.toggle('attiva', x.dataset.quadro === 'figura'));
    const banco = $('did-lab-spazio');
    if (banco) banco.querySelectorAll('.did-scene[data-quadro]').forEach(sez => {
      sez.hidden = sez.dataset.quadro !== 'figura';
    });
    const sl = $('did-spa-viaggio');
    if (sl) sl.value = 0;
    if (spa.stato === 'pronto') { spaPrepara(); spaAggiornaTesti(); }
    else spaChiediDati();
    spaAggiornaSlitte();
  };

  laboratorio({
    id: 'spazio',
    chip: 'Le costellazioni non esistono',
    occhiello: 'Concetto 7 — la prospettiva',
    titolo: 'Orione, da un altro pianeta, non è niente',
    sommario: `Una costellazione non è un oggetto: è un allineamento apparente, e vale da un solo
      punto dell'universo — questo. Le tre stelle della cintura di Orione sembrano gemelle e in
      fila: stanno a 692, 1.977 e 736 anni luce, e non hanno niente a che fare l'una con l'altra.
      Qui le stesse stelle sono messe nello spazio vero, ognuna alla sua distanza misurata, e ci
      si può girare intorno. Poi si va a stare su una di loro — su un pianeta di Betelgeuse, di
      Rigel, di Alnitak — e si guarda che cosa è rimasto della figura: accanto al cielo rifatto
      c'è la scena in tre dimensioni, che si gira col dito, e dice perché.`,

    costruisci() {
      return `
        <!-- Otto nomi di costellazione in una pillola unica, su un
             telefono, si accavallano: qui vanno a capo, come i luoghi del
             banco delle aurore. -->
        <div class="did-riga did-riga-avvolgi" id="did-spa-figure">
          ${SPA_FIGURE.map((f, i) => `<button type="button" class="did-pillola${i === 0 ? ' attiva' : ''}" data-figura="${f.sigla}">${f.nome}</button>`).join('')}
        </div>

        <div class="did-riga did-riga-avvolgi" id="did-spa-quadri">
          ${Object.keys(SPA_QUADRI).map((k, i) => `<button type="button" class="did-pillola${i === 0 ? ' attiva' : ''}" data-quadro="${k}">${SPA_QUADRI[k].nome}</button>`).join('')}
        </div>

        <div class="did-scene did-scene-due" data-quadro="figura">
          <figure class="did-scena">
            <canvas id="did-spa-figura" class="did-tela"></canvas>
            <figcaption class="did-targhetta">La figura, come si vede da qui</figcaption>
          </figure>
          <figure class="did-scena">
            <canvas id="did-spa-distanze" class="did-tela"></canvas>
            <figcaption class="did-targhetta">Le distanze vere, una barra per stella</figcaption>
          </figure>
        </div>

        <div class="did-scene" data-quadro="spazio" hidden>
          <figure class="did-scena">
            <canvas id="did-spa-tela" class="did-tela"></canvas>
            <figcaption class="did-targhetta">Le stesse stelle nello spazio, con i raggi visuali dal Sole</figcaption>
          </figure>
        </div>

        <div class="did-scene" data-quadro="altrove" hidden>
          <!-- Le mete si riscrivono a ogni cambio di figura: sono le sue
               stelle, e quelle di Orione non sono quelle del Leone. -->
          <div class="did-riga did-riga-avvolgi" id="did-spa-mete"></div>

          <div class="did-scene did-scene-due">
            <figure class="did-scena">
              <canvas id="did-spa-altrove" class="did-tela"></canvas>
              <figcaption class="did-targhetta">Lo stesso pezzo di cielo, visto da lì — in grigio com'era da qui</figcaption>
            </figure>
            <figure class="did-scena">
              <canvas id="did-spa-tela-altrove" class="did-tela"></canvas>
              <figcaption class="did-targhetta">Perché: dov'è finito il tuo occhio — <em>gira col dito</em></figcaption>
            </figure>
          </div>

          <div class="did-riga">
            <label class="did-etichetta" for="did-spa-viaggio">Quanto ti allontani dal Sole</label>
            <span class="did-valore" id="did-spa-viaggio-valore">sul Sole</span>
          </div>
          <input id="did-spa-viaggio" class="did-slitta did-slitta-larga" type="range"
            min="0" max="${SPA_VIAGGIO_MAX}" step="10" value="0">

          <div class="did-riga">
            <label class="did-etichetta" for="did-spa-direzione">Da che parte ti sposti</label>
            <span class="did-valore" id="did-spa-direzione-valore">0°</span>
          </div>
          <input id="did-spa-direzione" class="did-slitta did-slitta-larga" type="range"
            min="0" max="360" step="5" value="0">
        </div>

        ${didLetture([
          { id: 'did-spa-vicina', nome: 'La più vicina' },
          { id: 'did-spa-lontana', nome: 'La più lontana' },
          { id: 'did-spa-rapporto', nome: 'Quante volte più lontana', forte: true },
          { id: 'did-spa-svanite', nome: 'Da lì, invisibili a occhio', forte: true },
          { id: 'did-spa-coppia', nome: 'La coppia che si è aperta di più', forte: true }
        ])}

        <p class="did-nota">Le distanze vengono dalle parallassi di Hipparcos (database HYG). Per una
          decina di stelle molto lontane la parallasse non basta a dare un numero: quelle sono
          segnate con un punto interrogativo, e messe alla distanza mediana della loro figura.
          Le magnitudini nel terzo quadro sono ricalcolate dalla distanza vera: allontanandosi non
          cambia solo il disegno, cambia anche quali stelle si vedono ancora. Andando a stare su una
          stella della figura, quella lì sparisce dal cielo — è il Sole di quel posto — e le altre
          si riordinano da capo: il grigio tratteggiato è come stavano viste da qui.</p>

        ${didPonti([
          { azione: 'cielo', icona: 'stella', testo: 'Vedila nel planetario',
            titolo: 'La stessa figura sul cielo di stanotte, con il suo disegno' },
          { azione: 'atlante', icona: 'lista', testo: 'La sua pagina nell\'atlante',
            titolo: 'Chi le ha dato il nome, come la chiamano altrove, e se da qui si vede' }
        ])}`;
    },

    collega() {
      const figure = $('did-spa-figure');
      if (figure) figure.addEventListener('click', (e) => {
        const b = e.target.closest('[data-figura]');
        if (!b) return;
        spa.sigla = b.dataset.figura;
        figure.querySelectorAll('[data-figura]').forEach(x =>
          x.classList.toggle('attiva', x.dataset.figura === spa.sigla));
        spa.viaggio = 0;
        const sl = $('did-spa-viaggio');
        if (sl) sl.value = 0;
        spaPrepara();
        spaAggiornaTesti();
        spaAggiornaSlitte();
      });

      const quadri = $('did-spa-quadri');
      if (quadri) quadri.addEventListener('click', (e) => {
        const b = e.target.closest('[data-quadro]');
        if (!b) return;
        spa.quadro = b.dataset.quadro;
        quadri.querySelectorAll('[data-quadro]').forEach(x =>
          x.classList.toggle('attiva', x.dataset.quadro === spa.quadro));
        const banco = $('did-lab-spazio');
        if (banco) banco.querySelectorAll('[data-quadro]').forEach(sez => {
          if (sez.tagName !== 'DIV' || !sez.classList.contains('did-scene')) return;
          sez.hidden = sez.dataset.quadro !== spa.quadro;
        });
      });

      // Le mete: la fila si riscrive da sé a ogni figura, quindi
      // l'ascoltatore sta sul contenitore e non sulle pillole
      const mete = $('did-spa-mete');
      if (mete) mete.addEventListener('click', (e) => {
        const b = e.target.closest('[data-meta]');
        if (!b) return;
        spa.meta = b.dataset.meta === 'null' ? null : Number(b.dataset.meta);
        spaAggiornaSlitte();
        spaAggiornaTesti();
      });

      // Toccando una slitta si torna al volo libero: le due cose sono
      // alternative, e disabilitare i comandi invece di lasciarli
      // rispondere è il modo più sicuro di far credere che siano rotti
      const aMano = () => { if (spa.meta !== null) { spa.meta = null; spaCostruisciMete(); } };
      const viaggio = $('did-spa-viaggio');
      if (viaggio) viaggio.addEventListener('input', (e) => {
        aMano();
        spa.viaggio = Number(e.target.value);
        spaAggiornaSlitte();
        spaAggiornaTesti();
      });
      const direzione = $('did-spa-direzione');
      if (direzione) direzione.addEventListener('input', (e) => {
        aMano();
        spa.direzione = Number(e.target.value);
        spaAggiornaSlitte();
        spaAggiornaTesti();
      });

      // Girare le scene in 3D: lo stesso gesto del banco delle aurore e
      // della vista 3D del Sistema Solare — il dito porta con sé il
      // modellino. Con due dita comanda la lente, e questo si tira da parte.
      // La telecamera è una sola per tutt'e due le tele, ed è giusto così:
      // sono la stessa scena guardata in due quadri diversi, e ritrovarla
      // girata come la si era lasciata è metà del filo del discorso.
      ['did-spa-tela', 'did-spa-tela-altrove'].forEach(spaCollegaGiro);

      collegaPonti('spazio', (azione) => {
        if (azione === 'cielo' && typeof costMostraInCielo === 'function') costMostraInCielo(spa.sigla);
        if (azione === 'atlante' && typeof apriAtlanteCostellazioni === 'function') {
          apriAtlanteCostellazioni(spa.sigla);
        }
      });
    },

    entra() {
      if (spa.stato === 'pronto') { spaPrepara(); spaAggiornaTesti(); }
      else spaChiediDati();
      spaAggiornaSlitte();
    },

    passo() {
      // La telecamera ci scivola invece di saltarci
      const k = 0.12;
      spa.cam.az += (spa.camV.az - spa.cam.az) * k;
      spa.cam.elev += (spa.camV.elev - spa.cam.elev) * k;
    },

    disegna() {
      if (spa.quadro === 'figura') { spaDisegnaFigura(); spaDisegnaDistanze(); }
      else if (spa.quadro === 'spazio') spaDisegnaSpazio();
      else { spaDisegnaAltrove(); spaDisegnaAltrove3D(); }
    }
  });
// ===================================================================
  // 9. ESPERIMENTO 8 — IL SOLE AL TRAMONTO
  //
  //   Tre domande in fila, e ognuna ha il suo quadro: mettendole nello
  //   stesso disegno si è costretti a mentire su almeno una scala.
  //
  //   1. «Perché tramonta» — il globo. Il Sole non scende: siamo noi che
  //      giriamo. Qui il Sole sta fermo a destra, la Terra gira sul suo
  //      asse — col dito, o col tasto avvia — e l'omino ci gira insieme
  //      fino a passare dalla parte in ombra. Il confine fra il giorno e
  //      la notte **non si muove**: lo attraversiamo noi, ed è tutto il
  //      punto del quadro. La versione di prima faceva l'opposto (un Sole
  //      che saliva e scendeva attorno a una Terra ferma) e raccontava,
  //      senza volerlo, un modello tolemaico.
  //      Qui lo spessore dell'aria è **ingrandito**, e c'è scritto di
  //      quanto: alla scala vera sarebbe un filo di un pixel.
  //
  //   2. «Quanta aria» — la fascia e il cammino, a **scala vera**,
  //      curvatura compresa. Otto chilometri e mezzo di aria (tutta
  //      quella che c'è, se la si comprimesse alla densità del suolo)
  //      contro i più di trecento chilometri di aria che la luce si mangia
  //      quando il Sole è sull'orizzonte. Il cammino più corto
  //      possibile — quello di un Sole dritto sopra la testa — è disegnato
  //      accanto, con lo stesso identico metro: è un trattino, ed è la
  //      colonna d'aria che la massa d'aria prende per unità (non quella
  //      di mezzogiorno, che a queste latitudini è già mezza volta più
  //      lunga). Il rapporto fra i due è la massa d'aria, e non è
  //      un numero da credere sulla parola — si misura col righello sullo
  //      schermo, come gli angoli del taglio delle aurore.
  //
  //   3-bis. «E su Marte?» — gli stessi due cieli, la stessa ora, la
  //      stessa scala angolare, e il colore che si rovescia: di paglia di
  //      giorno, azzurro attorno al Sole al tramonto. Non è un vezzo da
  //      cartolina: è la prova che il colore del cielo non lo decide «il
  //      cielo», lo decide la **misura** di quello che diffonde la luce.
  //
  //   3. «Che colore ha» — quello che si vede da qui. Il cielo dipinto
  //      coi colori che escono dai conti (una sola diffusione di
  //      Rayleigh: la luce che illumina un pezzo di cielo si è già
  //      mangiata la sua strada, e di lì ci arriva quello che quel pezzo
  //      diffonde verso di noi), il disco del Sole alla sua misura
  //      angolare vera, **schiacciato** dalla rifrazione differenziale
  //      come lo è davvero, e accanto il posto in cui il Sole sarebbe
  //      senza atmosfera: sotto l'orizzonte.
  //
  //   Il comando è uno solo per tutti, ed è la rotazione della Terra — non
  //   l'altezza del Sole. L'altezza è una conseguenza, e prenderla per
  //   manopola era esattamente il modo in cui il banco faceva credere che
  //   a muoversi fosse il Sole.
  //
  //   Il Sole però si prende col dito lo stesso, e in tutti i quadri: nel
  //   globo si trascina la Terra, nel quadro dell'aria si punta la
  //   direzione del raggio, nei due del cielo lo si tira su e giù. A
  //   muoversi resta sempre `tram.ora`, quindi non esiste un quadro che
  //   possa raccontare un'ora diversa dagli altri.
  // ===================================================================

  const TRAM_RE = 6371;             // raggio della Terra, km
  // L'atmosfera «equivalente»: tutta l'aria che c'è, compressa alla densità
  // del suolo. È l'altezza di scala, ed è anche la definizione operativa di
  // massa d'aria — «uno» vuol dire una di queste colonne.
  const TRAM_ARIA_KM = 8.4;
  const TRAM_K0 = 0.10;             // estinzione di Rayleigh a 550 nm, magnitudini per massa d'aria
  const TRAM_SOLE_GRADI = 0.533;    // diametro apparente del Sole
  const TRAM_RAGGIO_SOLE = TRAM_SOLE_GRADI / 2;
  const TRAM_ORA_MAX = 180;         // la slitta: dal mezzogiorno alla mezzanotte
  const TRAM_GRADI_AL_SEC = 4;      // quanto gira la Terra in un secondo, a 1×
  // Il cammino più lungo possibile dentro alla fascia: quello del raggio che
  // arriva rasente, e che finisce dove finisce perché la Terra è tonda —
  // su una Terra piatta non finirebbe mai. Vale √(2RH), sono 327 km, ed è
  // il numero su cui è tarata la scala del quadro «Quanta aria».
  const TRAM_CAMMINO_MAX = Math.sqrt(2 * TRAM_RE * TRAM_ARIA_KM + TRAM_ARIA_KM * TRAM_ARIA_KM);
  // Dove sta l'osservatore nel quadro dell'aria, in frazioni del riquadro.
  // È una costante e non due numeri scritti nel disegno perché la stessa
  // coppia serve al dito: chi trascina il Sole misura l'angolo **da lì**, e
  // se il disegno e il gesto usassero due punti diversi il Sole si
  // sposterebbe di un pelo a ogni presa.
  const TRAM_ARIA_OBS = { x: 0.88, y: 0.68 };

  // Il raggio di curvatura di un raggio di luce rasente, in raggi terrestri:
  // è il numero da cui esce il fatto che la rifrazione all'orizzonte vale
  // mezzo grado, cioè più del diametro del Sole.
  const TRAM_CURVA_RAGGI = 6;

  const TRAM_BANDE = [
    { id: 'blu',   nm: 450, colore: '#4c8dff' },
    { id: 'verde', nm: 550, colore: '#5fd6a8' },
    { id: 'rosso', nm: 650, colore: '#ff6b5a' }
  ];

  const TRAM_QUADRI = {
    globo:  { chip: 'Perché tramonta' },
    aria:   { chip: 'Quanta aria' },
    colore: { chip: 'Che colore ha' },
    marte:  { chip: 'E su Marte?' }
  };

  // I punti di vista sul globo. «Di taglio» è quello di partenza, e non per
  // caso: con la telecamera perpendicolare alla direzione del Sole il
  // confine giorno/notte si vede di profilo — cioè come una riga dritta in
  // mezzo al disco — e l'osservatore, nel momento del tramonto, ci finisce
  // esattamente sopra, al centro del globo.
  //
  // Da lì viene anche il fatto che **il Sole sta a sinistra**, che a prima
  // vista sembra una scelta di gusto e non lo è. Col polo nord in alto la
  // Terra gira in senso antiorario, quindi il pomeriggio di chi guarda sta
  // dalla parte opposta a quella del mattino: mettendo il Sole a destra,
  // tutto il tratto che questo banco racconta — dal mezzogiorno al buio —
  // finiva dietro al globo, e l'omino spariva proprio quando serviva.
  const TRAM_VISTE = {
    taglio: { nome: 'Di taglio',  az: 90, elev: 12 },
    alto:   { nome: "Dall'alto",  az: 90, elev: 70 },
    sole:   { nome: 'Dal Sole',   az: 0,  elev: 14 }
  };

  const TRAM_LUOGHI = [
    { id: 'qui',  nome: 'Da casa tua' },
    { id: 'eq',   nome: "All'equatore", lat: 0,     lon: 12 },
    { id: 'nord', nome: 'Tromsø, 69° N', lat: 69.65, lon: 18.96 }
  ];

  // I salti: l'altezza del Sole che conta, e la slitta ci arriva da sola.
  // Servono perché il tratto interessante — dal Sole basso alla fine del
  // crepuscolo — è meno di un decimo della corsa della slitta.
  const TRAM_METE = [
    { nome: 'Mezzogiorno', ora: 0 },
    { nome: 'Sole a 10°',  h: 10 },
    { nome: 'Tramonto',    h: 0 },
    { nome: 'Crepuscolo',  h: -6 },
    { nome: 'Notte',       ora: TRAM_ORA_MAX }
  ];

  // Il mondo e le luci delle città stanno in `app.js` (§7.3.2, `SKY_MONDO` e
  // `SKY_LUCI_CITTA`): sono lo stesso mondo che la vista 3D del Sistema
  // Solare appoggia sulla Terra da vicino, e due copie dello stesso mondo
  // divergono al primo ritocco — si corregge una costa e l'altra resta
  // storta, senza che niente lo dica. Se app.js non c'è (il banco di prova
  // carica i moduli da soli) il globo resta senza coste: il resto del quadro
  // — il giorno, la notte, l'anello dell'aria — funziona lo stesso.
  const TRAM_MONDO = typeof SKY_MONDO !== 'undefined' ? SKY_MONDO : [];
  const TRAM_LUCI = typeof SKY_LUCI_CITTA !== 'undefined' ? SKY_LUCI_CITTA : [];


  const tram = {
    quadro: 'globo',
    ora: 0,               // gradi di rotazione dal mezzogiorno: è l'angolo orario del Sole
    marcia: false,
    velocita: 1,
    luogo: 'qui',
    lat: 44.5, lon: 11.3, // dove sta l'omino
    decl: 0,              // declinazione del Sole nel giorno che si guarda
    giorno: null,         // quel giorno, per scriverlo
    vista: 'taglio',
    cam: { az: 90, elev: 12 },
    camV: { az: 90, elev: 12 },
    trascina: null,
    avviato: false,
    veroAdesso: undefined
  };

  // -------------------------------------------------------------------
  // 9.1 Vettori, sfera, telecamera
  // -------------------------------------------------------------------

  function tramAdd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function tramSub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function tramScala(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function tramDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function tramCroce(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function tramNorm(a) {
    const n = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / n, a[1] / n, a[2] / n];
  }
  function tramPseudo(n) {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  // L'assetto della scena. Il Sole sta fermo sull'asse x, lontano; l'asse
  // della Terra è inclinato in modo che il punto in cui il Sole è a picco
  // cada sul parallelo della sua declinazione di oggi — cioè l'inclinazione
  // che si vede sullo schermo non è un numero fisso da manuale, è la
  // stagione in cui siamo.
  function tramAssetto() {
    const d = tram.decl * Math.PI / 180;
    const n = [Math.sin(d), 0, Math.cos(d)];
    const s = [1, 0, 0];
    const e1 = tramNorm(tramSub(s, tramScala(n, tramDot(s, n))));  // il meridiano di mezzogiorno
    return { n, s, e1, e2: tramCroce(n, e1) };
  }

  // Un punto della superficie: latitudine, e angolo attorno all'asse contato
  // dal meridiano di mezzogiorno — cioè l'angolo orario.
  function tramSuGlobo(a, lat, ang) {
    const la = lat * Math.PI / 180, an = ang * Math.PI / 180;
    const c = Math.cos(la);
    return tramAdd(
      tramAdd(tramScala(a.e1, c * Math.cos(an)), tramScala(a.e2, c * Math.sin(an))),
      tramScala(a.n, Math.sin(la)));
  }

  // A che angolo dal meridiano di mezzogiorno si trova una longitudine
  // geografica. L'osservatore sta alla sua longitudine vera, quindi a
  // mezzogiorno è il suo pezzo di mondo a guardare il Sole, e girando l'ora
  // si vede passare tutto il resto.
  function tramAngoloDiLon(lon) { return tram.ora + (lon - tram.lon); }

  function tramVistaGlobo(L, H, a) {
    const az = tram.cam.az * Math.PI / 180;
    const el = Math.max(-78, Math.min(78, tram.cam.elev)) * Math.PI / 180;
    const d = tramNorm(tramAdd(
      tramScala(tramAdd(tramScala(a.e1, Math.cos(az)), tramScala(a.e2, Math.sin(az))), Math.cos(el)),
      tramScala(a.n, Math.sin(el))));
    const r = tramNorm(tramCroce(a.n, d));
    return {
      d, r, u: tramCroce(d, r),
      cx: L * 0.56, cy: H * 0.54,
      scala: Math.min(L * 0.25, H * 0.33)
    };
  }
  function tramPro(p, w) {
    return {
      x: w.cx + tramDot(p, w.r) * w.scala,
      y: w.cy - tramDot(p, w.u) * w.scala,
      z: tramDot(p, w.d)
    };
  }
  // Un punto dietro al bordo si appoggia sul bordo: è l'approssimazione di
  // sempre per una sagoma che si taglia sul limbo, e su un continente non si
  // vede perché il taglio è proprio lì.
  function tramAlBordo(p, cen, R) {
    if (p.z >= 0) return p;
    const dx = p.x - cen.x, dy = p.y - cen.y, n = Math.hypot(dx, dy) || 1;
    return { x: cen.x + dx / n * R, y: cen.y + dy / n * R, z: 0 };
  }

  // -------------------------------------------------------------------
  // 9.2 La fisica: rifrazione, quanta aria, quanta luce resta
  // -------------------------------------------------------------------

  function tramRifrazione(hVeroGradi) {
    const h = Math.max(-1.5, hVeroGradi);
    return 1 / Math.tan((h + 7.31 / (h + 4.4)) * Math.PI / 180);   // Bennett, in primi d'arco
  }
  function tramAltezzaApparente(hVero) { return hVero + tramRifrazione(hVero) / 60; }

  function tramMassaAria(hApp) {
    const h = Math.max(0.05, hApp);
    return 1 / (Math.sin(h * Math.PI / 180) + 0.50572 * Math.pow(h + 6.07995, -1.6364));
  }

  // Quanta aria, in chilometri di colonna equivalente: la massa d'aria per
  // lo spessore della fascia.
  //
  // Non è la corda geometrica dentro alla fascia — quella, a fascia
  // omogenea, all'orizzonte è 38,9 spessori contro i 37,2 di Kasten &
  // Young, perché l'aria vera salendo si dirada e la formula empirica ne
  // tiene conto. Le due stanno entro il 6%, e per un pezzo il quadro
  // disegnava la prima e scriveva accanto la seconda. Sei per cento non si
  // vedono, ma quel quadro promette una cosa precisa — «il trattino ci sta
  // dentro tante volte quanta è la massa d'aria» — e una promessa così o è
  // esatta o non va fatta. Quindi si disegna **questa**: la lunghezza che,
  // divisa per lo spessore, dà esattamente il numero scritto.
  function tramCamminoKm(X) { return X * TRAM_ARIA_KM; }

  function tramTrasmittanza(nm, X) {
    return Math.pow(10, -0.4 * TRAM_K0 * Math.pow(550 / nm, 4) * X);
  }

  // Dall'ora all'altezza del Sole: la formula di sempre, sin h = sin φ sin δ
  // + cos φ cos δ cos H. È qui che entra la latitudine, ed è per questo che
  // da Tromsø il Sole scende di sbieco e ci mette un'ora a tramontare.
  function tramAltezzaDaOra(ora) {
    const f = tram.lat * Math.PI / 180, d = tram.decl * Math.PI / 180, H = ora * Math.PI / 180;
    return Math.asin(Math.max(-1, Math.min(1,
      Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(H)))) * GRADI;
  }
  function tramOraPerAltezza(h) {
    const f = tram.lat * Math.PI / 180, d = tram.decl * Math.PI / 180;
    const den = Math.cos(f) * Math.cos(d);
    if (Math.abs(den) < 1e-9) return 0;
    const c = (Math.sin(h * Math.PI / 180) - Math.sin(f) * Math.sin(d)) / den;
    if (c >= 1) return 0;                 // più in alto di così non arriva mai
    if (c <= -1) return TRAM_ORA_MAX;     // e più in basso nemmeno
    return Math.acos(c) * GRADI;
  }
  function tramAltezzaMassima() { return 90 - Math.abs(tram.lat - tram.decl); }

  function tramCalcola() {
    const hVero = tramAltezzaDaOra(tram.ora);
    const R = tramRifrazione(hVero);
    const hApp = tramAltezzaApparente(hVero);
    const X = tramMassaAria(hApp);
    const bande = {};
    TRAM_BANDE.forEach(b => { bande[b.id] = tramTrasmittanza(b.nm, X); });
    return {
      hVero, R, hApp, X, bande,
      cammino: tramCamminoKm(X),
      sopra: hApp > -TRAM_RAGGIO_SOLE       // il disco si vede ancora, tutto o in parte
    };
  }

  function tramColoreSole(bande) {
    const mx = Math.max(bande.blu, bande.verde, bande.rosso, 1e-6);
    const canale = (v) => 255 * Math.pow(Math.max(0, v) / mx, 0.45);
    return { r: canale(bande.rosso), g: canale(bande.verde), b: canale(bande.blu) };
  }

  // Il colore del cielo a una certa altezza sopra l'orizzonte. Una sola
  // diffusione, e basta: la luce che illumina quel pezzo di cielo si è già
  // mangiata la sua strada (la trasmittanza alla massa d'aria
  // dell'illuminazione), e di lì ci arriva quello che quel pezzo diffonde
  // verso di noi (uno meno la trasmittanza alla massa d'aria della vista).
  // Il blu in alto e l'arancione sull'orizzonte non sono dipinti a mano:
  // escono da queste due righe.
  // Lo spessore ottico dell'ozono, che sta fra i 20 e i 30 km e assorbe nel
  // verde-arancione (la banda di Chappuis). Serve solo al colore del cielo,
  // e non è un ritocco estetico: con la sola diffusione di Rayleigh il
  // cielo sopra al Sole che tramonta veniva verde oliva, perché il verde
  // diffuso e il rosso diffuso finivano quasi pari. L'ozono lo mangia, e
  // l'arancione torna al suo posto. Non entra invece nel conto della luce
  // che arriva diritta: quella è la domanda a cui l'istogramma risponde, ed
  // è una domanda su Rayleigh.
  const TRAM_OZONO = { 450: 0.002, 550: 0.031, 650: 0.016 };

  function tramColoreCielo(alt, hSole) {
    const Xv = tramMassaAria(Math.max(alt, 0.6));
    // Un pezzo di cielo alto sopra la testa è illuminato da luce che ha
    // fatto meno strada di quella che arriva a un pezzo di cielo rasente:
    // è per questo che al tramonto l'arancione sta in basso e il blu
    // resiste in alto, ed è quel `+ alt` a dirlo
    const Xi = tramMassaAria(Math.max(hSole + alt * 0.85, 0.25));
    const luce = Math.max(0.012, Math.min(1, (hSole + 7.5) / 9.5));
    // L'ozono sta sulla strada della luce che *illumina* quel pezzo di
    // cielo (la fascia alta che il raggio attraversa di traverso), non su
    // quella che da lì scende fino a noi: entra solo nel primo fattore
    const v = (nm) => tramTrasmittanza(nm, Xi) * Math.exp(-TRAM_OZONO[nm] * Xi)
      * (1 - tramTrasmittanza(nm, Xv));
    // Dalla quantità di luce al colore sullo schermo non si passa
    // moltiplicando: guardando rasente all'orizzonte il termine diffuso va
    // a uno in tutt'e tre le bande, e con un fattore secco i tre canali
    // sbattevano insieme contro il 255 — un cielo bianco piatto, che era
    // esattamente quello che si vedeva col Sole a dieci gradi. Questa è la
    // curva che satura invece di tosare, e i rapporti fra i colori li
    // tiene fino in fondo.
    const k = 4.5 * luce;
    const canale = (nm) => 255 * (1 - Math.exp(-k * v(nm)));
    return { r: canale(650), g: canale(550), b: canale(450) };
  }

  // -------------------------------------------------------------------
  // 9.2-bis Marte, per confronto
  //
  // È la domanda che viene subito dopo «perché il cielo è azzurro»: e su
  // Marte? Su Marte il cielo è **di paglia** di giorno e **azzurro attorno
  // al Sole** al tramonto — l'esatto contrario del nostro — e la ragione
  // sta tutta nella misura di quello che diffonde la luce.
  //
  // Da noi diffondono le molecole d'aria, mille volte più piccole della
  // lunghezza d'onda: è il regime di Rayleigh, dove la diffusione va come
  // λ⁻⁴ e va più o meno in tutte le direzioni. Il blu viene sparpagliato
  // per tutto il cielo, e da qualunque parte si guardi ne arriva: cielo
  // azzurro, e Sole rosso perché il blu che vediamo in giro è quello che
  // al raggio è stato tolto.
  //
  // Su Marte l'aria è lo 0,6% della nostra: di Rayleigh non resta niente
  // (lo spessore ottico è sedici volte più piccolo del nostro). A
  // diffondere è la **polvere** in sospensione, granelli di un paio di
  // micron — cioè grandi *come* la lunghezza d'onda, non mille volte meno.
  // Da lì due cose che rovesciano tutto:
  //
  //   • la polvere non guarda il colore quando *estingue* (granelli
  //     grandi: l'estinzione è grigia), ma diffonde con un **picco in
  //     avanti** tanto più stretto quanto più corta è l'onda. Il blu
  //     resta quindi appiccicato attorno al Sole invece di sparpagliarsi;
  //   • è ossido di ferro, e il ferro **si mangia il blu** (l'albedo di
  //     singola diffusione è 0,63 nel blu e 0,94 nel rosso).
  //
  // Lontano dal Sole vince l'assorbimento: cielo color paglia. Vicino al
  // Sole vince il picco in avanti: alone azzurro. Ed è per questo che le
  // fotografie dei tramonti marziani sembrano un negativo dei nostri.
  const TRAM_MARTE = {
    RE: 3390,              // raggio, km
    ARIA_KM: 11.1,         // altezza di scala: gravità di un terzo, aria che si dirada più piano
    kRay: 0.0064,          // estinzione di Rayleigh a 550 nm, magnitudini per massa d'aria
    kPolvere: 0.543,       // la polvere: spessore ottico 0,5, e non guarda il colore
    soleGradi: 0.35,       // il Sole visto da Marte
    // Per ogni banda: quanta luce la polvere ridiffonde invece di
    // assorbirla (`omega`), e quanto stretto è il picco in avanti (`g`)
    bande: {
      450: { omega: 0.63, g: 0.78 },
      550: { omega: 0.86, g: 0.70 },
      650: { omega: 0.94, g: 0.63 }
    }
  };

  // La massa d'aria di un pianeta qualunque, col modello della fascia
  // omogenea: è quello che serve per Marte, dove la formula empirica di
  // Kasten & Young — tarata sull'atmosfera terrestre — non vuol dire niente.
  function tramMassaAriaSlab(R, Hkm, hGradi) {
    const h = Math.max(0, hGradi) * Math.PI / 180;
    const A = R + Hkm, sn = R * Math.sin(h);
    return (Math.sqrt(sn * sn + A * A - R * R) - sn) / Hkm;
  }
  function tramMassaAriaMarte(h) { return tramMassaAriaSlab(TRAM_MARTE.RE, TRAM_MARTE.ARIA_KM, h); }

  // Henyey-Greenstein: la forma di diffusione di un granello grande. Con
  // g = 0 va uguale in tutte le direzioni, con g vicino a 1 va quasi tutta
  // in avanti. È il picco in avanti che tiene il blu attaccato al Sole.
  function tramFaseHG(thetaGradi, g) {
    const c = Math.cos(thetaGradi * Math.PI / 180);
    const d = 1 + g * g - 2 * g * c;
    return (1 - g * g) / (4 * Math.PI * Math.pow(Math.max(1e-4, d), 1.5));
  }

  // Il colore del cielo di Marte. La **tinta** esce dai conti; la
  // luminosità no, e va detto: con mezza unità di spessore ottico di
  // polvere e venti masse d'aria una diffusione sola darebbe, al tramonto,
  // un cielo nero — su Marte la luce del crepuscolo arriva quasi tutta da
  // diffusioni multiple, e questo modello non le sa contare. La
  // compressione `^0.35` sulla trasmittanza è quella: fa da esposizione,
  // e lascia intatto il rapporto fra le tre bande, che è l'unica cosa che
  // questo quadro promette di far vedere.
  const TRAM_MARTE_COMPRIMI = 0.35;
  function tramColoreCieloMarte(alt, hSole) {
    const M = TRAM_MARTE;
    const Xv = tramMassaAriaMarte(Math.max(alt, 0.6));
    const Xi = tramMassaAriaMarte(Math.max(hSole + alt * 0.85, 0.4));
    const theta = Math.abs(alt - hSole);
    const luce = Math.max(0.02, Math.min(1, (hSole + 6) / 10));
    // L'estinzione della polvere è grigia, quindi la trasmittanza è la
    // stessa per tutti: il colore viene da `omega` e dal picco in avanti
    const T = (X) => Math.pow(10, -0.4 * (M.kPolvere + M.kRay) * X);
    const esposizione = Math.pow(T(Xi), TRAM_MARTE_COMPRIMI);
    const diffuso = 1 - T(Xv);
    const canale = (nm) => {
      const b = M.bande[nm];
      return 255 * (1 - Math.exp(-8.5 * luce * esposizione * b.omega * tramFaseHG(theta, b.g) * diffuso));
    };
    return { r: canale(650), g: canale(550), b: canale(450) };
  }

  function tramRGBA(c, alfa = 1) {
    return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${alfa})`;
  }
  function tramHexOf(c) {
    const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
  }
  function tramScurisci(hex, quanto) {
    const n = parseInt(hex.slice(1), 16);
    const m = (v) => Math.round(v * (1 - quanto));
    return `rgb(${m((n >> 16) & 255)}, ${m((n >> 8) & 255)}, ${m(n & 255)})`;
  }

  // -------------------------------------------------------------------
  // 9.3 Il quadro del globo
  // -------------------------------------------------------------------

  // Il colore dell'aria vista di taglio dallo spazio, in funzione di quanta
  // luce prende: il filo azzurro delle fotografie dall'orbita, che sul
  // confine fra giorno e notte diventa arancione. Quell'anello arancione è
  // il tramonto di chi in quel momento sta là sotto — ed è la stessa cosa
  // che il quadro «Che colore ha» guarda da sotto.
  const TRAM_ARIA_TINTE = [
    { k: 0.00, c: [176,  74,  52], a: 0.00 },
    { k: 0.10, c: [255, 120,  62], a: 0.42 },
    { k: 0.28, c: [255, 178, 112], a: 0.46 },
    { k: 1.00, c: [126, 180, 255], a: 0.55 }
  ];
  function tramColoreAria(ill) {
    const k = (ill + 0.25) / 0.6;
    if (k <= 0) return null;
    const t = Math.min(1, k);
    let i = 0;
    while (i < TRAM_ARIA_TINTE.length - 2 && t > TRAM_ARIA_TINTE[i + 1].k) i++;
    const a = TRAM_ARIA_TINTE[i], b = TRAM_ARIA_TINTE[i + 1];
    const u = Math.max(0, Math.min(1, (t - a.k) / (b.k - a.k || 1)));
    const m = (x, y) => Math.round(x + (y - x) * u);
    return `rgba(${m(a.c[0], b.c[0])}, ${m(a.c[1], b.c[1])}, ${m(a.c[2], b.c[2])}, ${(a.a + (b.a - a.a) * u).toFixed(3)})`;
  }

  function tramTraccia(ctx, punti) {
    ctx.beginPath();
    punti.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.closePath();
  }

  // L'arco di bordo che va da un angolo all'altro passando per `dove`: serve
  // a chiudere le due mezze lune del giorno e della notte sullo stesso
  // cerchio, senza fessure in mezzo.
  function tramArco(cen, R, da, a, dove) {
    const giro = (x) => { let v = x % (2 * Math.PI); return v < 0 ? v + 2 * Math.PI : v; };
    const avanti = giro(a - da);
    const verso = giro(dove - da) <= avanti ? 1 : -1;
    const ampiezza = verso > 0 ? avanti : (2 * Math.PI - avanti);
    const n = Math.max(6, Math.round(ampiezza / 0.09));
    const punti = [];
    for (let i = 0; i <= n; i++) {
      const th = da + verso * ampiezza * i / n;
      punti.push({ x: cen.x + R * Math.cos(th), y: cen.y + R * Math.sin(th) });
    }
    return punti;
  }

  // Il confine fra giorno e notte, disegnato per quello che è: il cerchio
  // massimo perpendicolare alla direzione del Sole. In proiezione
  // ortogonale la sua metà visibile è mezza ellisse, e i due estremi cadono
  // **esattamente** sul bordo del disco — sono ±(Sole × direzione di vista),
  // che stanno su tutt'e due i cerchi. Prendendoli in chiuso invece che
  // cercandoli fra i campioni, giorno e notte combaciano sempre.
  function tramRegioni(w, a, cen, R) {
    const sd = tramDot(a.s, w.d);
    const q = tramCroce(a.s, w.d);
    const nq = Math.hypot(q[0], q[1], q[2]);
    if (nq < 0.06) return { tutto: sd > 0 ? 'giorno' : 'notte' };
    const u1 = tramScala(q, 1 / nq);
    const u2 = tramCroce(a.s, u1);
    const verso = tramDot(u2, w.d) >= 0 ? 1 : -1;
    const term = [];
    for (let i = 0; i <= 60; i++) {
      const th = verso * (i / 60) * Math.PI;
      term.push(tramPro(tramAdd(tramScala(u1, Math.cos(th)), tramScala(u2, Math.sin(th))), w));
    }
    const ang = (p) => Math.atan2(p.y - cen.y, p.x - cen.x);
    const aS = ang(tramPro(tramNorm(tramSub(a.s, tramScala(w.d, sd))), w));
    const da = ang(term[term.length - 1]), aa = ang(term[0]);
    return {
      term,
      giorno: term.concat(tramArco(cen, R, da, aa, aS)),
      notte: term.concat(tramArco(cen, R, da, aa, aS + Math.PI))
    };
  }

  // Da una costa in (longitudine, latitudine) al poligono da riempire sullo
  // schermo. Il pezzo che sta dall'altra parte del globo si appoggia sul
  // bordo, e nel punto dove la costa lo attraversa il taglio è **esatto**:
  // si interpola sul vettore fra i due vertici e si normalizza, così il
  // punto cade sul cerchio massimo del limbo invece che vicino. I vertici
  // del tutto nascosti scivolano lungo il bordo, ed è quello che fa sembrare
  // che il continente prosegua dietro — che è quello che fa davvero.
  function tramSagoma(punti, w, a, cen, R) {
    const v = punti.map(q => tramSuGlobo(a, q[1], tramAngoloDiLon(q[0])));
    const z = v.map(q => tramDot(q, w.d));
    let visto = false;
    for (let i = 0; i < z.length; i++) if (z[i] > -0.02) { visto = true; break; }
    if (!visto) return null;                       // tutta dall'altra parte
    const fuori = [];
    for (let i = 0; i < v.length; i++) {
      const j = (i + 1) % v.length;
      fuori.push(tramAlBordo(tramPro(v[i], w), cen, R));
      if ((z[i] > 0) !== (z[j] > 0)) {
        const k = z[i] / (z[i] - z[j]);
        fuori.push(tramPro(tramNorm([
          v[i][0] + (v[j][0] - v[i][0]) * k,
          v[i][1] + (v[j][1] - v[i][1]) * k,
          v[i][2] + (v[j][2] - v[i][2]) * k]), w));
      }
    }
    return fuori;
  }

  function tramDisegnaGlobo() {
    const tela = didTela('did-tram-globo', 1.35, 470, { lente: true, pieno: true, trascina: false });
    if (!tela) return;
    const { ctx, L, H } = tela;
    didSfondo(ctx, L, H);

    const s = tramCalcola();
    const a = tramAssetto();
    const w = tramVistaGlobo(L, H, a);
    const cen = tramPro([0, 0, 0], w);
    const R = w.scala;
    const aria = Math.max(4, R * 0.055);
    const esagera = Math.round(aria / R * TRAM_RE / TRAM_ARIA_KM / 5) * 5;
    const coloreSole = tramColoreSole(s.bande);
    const reg = tramRegioni(w, a, cen, R);

    // --- Il Sole, fermo, e i suoi raggi paralleli ---------------------
    const sx = tramDot(a.s, w.r), sy = -tramDot(a.s, w.u);
    const lung = Math.hypot(sx, sy);
    let etichettaSole = null;
    if (lung > 0.22) {
      const ux = sx / lung, uy = sy / lung;
      // Quanto lontano si può mettere il disco senza uscire dalla tela: il
      // Sole è a sinistra o a destra a seconda di come si è girata la
      // scena, e un numero scritto a mano varrebbe per una posa sola
      const spazioX = ux > 0.01 ? (L - 42 - cen.x) / ux : (ux < -0.01 ? (cen.x - 42) / -ux : 1e9);
      const spazioY = uy > 0.01 ? (H - 42 - cen.y) / uy : (uy < -0.01 ? (cen.y - 42) / -uy : 1e9);
      const dist = Math.max(R * 1.5, Math.min(R * 3.4, spazioX, spazioY));
      const px = cen.x + ux * dist, py = cen.y + uy * dist;
      // i raggi: paralleli, perché il Sole è lontano. Si fermano dove
      // incontrano l'aria, e quelli che passano di lato tirano dritto.
      ctx.lineWidth = 1.1;
      for (let i = -4; i <= 4; i++) {
        const b = i * R * 0.42;
        const bx = -uy * b, by = ux * b;
        const dentro = Math.abs(b) < R + aria;
        const t1 = dentro ? Math.sqrt(Math.max(0, (R + aria) * (R + aria) - b * b)) : 0;
        const x0 = px + bx - ux * (dist - R * 2.6), y0 = py + by - uy * (dist - R * 2.6);
        const x1 = cen.x + bx - ux * t1, y1 = cen.y + by - uy * t1;
        ctx.strokeStyle = `rgba(255, 226, 168, ${dentro ? 0.30 : 0.16})`;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      const rSole = Math.max(10, R * 0.15);
      didCorpoSchermo(ctx, px, py, rSole, '#ffd166', { alone: 3.2 });
      // La scritta va in coda a tutto: scritta qui, su una tela stretta il
      // globo le finiva sopra e si leggeva «il Sole — sta fer»
      etichettaSole = { x: Math.max(58, Math.min(L - 58, px)), y: py + rSole + 17 };
    }

    // --- L'aria vista di taglio: l'anello attorno al disco -------------
    //
    // Un punto del bordo prende luce come il coseno fra la sua direzione e
    // quella del Sole, e quel coseno — scritto in coordinate di schermo —
    // è **una funzione lineare della posizione**: per un punto del bordo
    // (X, Y) vale (X·(r·Sole) + Y·(−u·Sole)) / R. Quindi l'anello si può
    // dipingere con una sfumatura lineare sola, esatta, e in un colpo.
    // Il primo tentativo lo faceva a spicchi, uno per grado: dove due
    // spicchi si sovrapponevano le trasparenze si sommavano, e l'anello
    // veniva fuori come uno steccato di righe chiare.
    const gx = tramDot(w.r, a.s), gy = -tramDot(w.u, a.s);
    const gn = Math.hypot(gx, gy);
    if (gn > 0.004) {
      const sfuma = ctx.createLinearGradient(
        cen.x - gx / gn * R, cen.y - gy / gn * R,
        cen.x + gx / gn * R, cen.y + gy / gn * R);
      for (let i = 0; i <= 16; i++) {
        sfuma.addColorStop(i / 16, tramColoreAria(-gn + 2 * gn * i / 16) || 'rgba(0, 0, 0, 0)');
      }
      ctx.strokeStyle = sfuma;
      ctx.lineWidth = aria * 1.8;
      ctx.beginPath(); ctx.arc(cen.x, cen.y, R + aria * 0.4, 0, Math.PI * 2); ctx.stroke();
    }

    // --- Il globo: oceano, continenti, luci ----------------------------
    ctx.save();
    ctx.beginPath(); ctx.arc(cen.x, cen.y, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#08152b';                      // l'oceano di notte
    ctx.fillRect(cen.x - R, cen.y - R, R * 2, R * 2);
    if (reg.giorno) { tramTraccia(ctx, reg.giorno); ctx.fillStyle = '#14559e'; ctx.fill(); }
    else if (reg.tutto === 'giorno') { ctx.fillStyle = '#14559e'; ctx.fillRect(cen.x - R, cen.y - R, R * 2, R * 2); }

    const passata = (poligono, giorno) => {
      ctx.save();
      if (poligono) { tramTraccia(ctx, poligono); ctx.clip(); }
      TRAM_MONDO.forEach(t => {
        const p = tramSagoma(t.punti, w, a, cen, R);
        if (!p) return;
        ctx.fillStyle = giorno ? t.c : tramScurisci(t.c, 0.82);
        tramTraccia(ctx, p); ctx.fill();
      });
      ctx.restore();
    };
    if (reg.tutto !== 'notte') passata(reg.giorno, true);
    if (reg.tutto !== 'giorno') passata(reg.notte, false);

    if (reg.tutto !== 'giorno') {
      ctx.save();
      if (reg.notte) { tramTraccia(ctx, reg.notte); ctx.clip(); }
      TRAM_LUCI.forEach((c, i) => {
        const p = tramPro(tramSuGlobo(a, c[1], tramAngoloDiLon(c[0])), w);
        if (p.z <= 0.08) return;
        const rr = Math.max(1.1, R * 0.016) * (0.7 + tramPseudo(i * 7 + 3) * 0.7);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 3.4);
        g.addColorStop(0, 'rgba(255, 214, 140, 0.85)');
        g.addColorStop(1, 'rgba(255, 176, 80, 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr * 3.4, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    }

    // il velo d'aria sopra la parte illuminata: la stessa diffusione che di
    // sotto fa il cielo azzurro, vista da fuori
    if (reg.tutto !== 'notte') {
      ctx.save();
      if (reg.giorno) { tramTraccia(ctx, reg.giorno); ctx.clip(); }
      const g = ctx.createRadialGradient(cen.x, cen.y, R * 0.15, cen.x, cen.y, R);
      g.addColorStop(0, 'rgba(126, 180, 255, 0.10)');
      g.addColorStop(1, 'rgba(126, 180, 255, 0.30)');
      ctx.fillStyle = g;
      ctx.fillRect(cen.x - R, cen.y - R, R * 2, R * 2);
      ctx.restore();
    }

    // il confine sfumato: sulla Terra vera il passaggio non è una riga, è la
    // fascia — larga qualche centinaio di chilometri — in cui sta
    // albeggiando o tramontando. Larga, però, quanto è davvero: le prime
    // prove la disegnavano spessa un decimo del globo e sembrava una
    // cicatrice marrone in mezzo al pianeta
    if (reg.term) {
      const filo = (larghezza, alfa) => {
        ctx.strokeStyle = `rgba(255, 168, 104, ${alfa})`;
        ctx.lineWidth = larghezza;
        ctx.beginPath();
        reg.term.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
        ctx.stroke();
      };
      filo(R * 0.05, 0.05);
      filo(R * 0.022, 0.10);
      filo(1.4, 0.42);
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(150, 190, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cen.x, cen.y, R, 0, Math.PI * 2); ctx.stroke();

    // --- L'asse, i poli, il verso del giro -----------------------------
    const pN = tramPro(tramScala(a.n, 1.3), w), pS = tramPro(tramScala(a.n, -1.3), w);
    ctx.strokeStyle = 'rgba(233, 237, 247, 0.3)';
    ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(pS.x, pS.y); ctx.lineTo(pN.x, pN.y); ctx.stroke();
    ctx.setLineDash([]);
    didScritta(ctx, 'N', pN.x, pN.y - 6, { colore: C.testo2, misura: 11, allinea: 'center', peso: 700 });

    tramFrecciaGiro(ctx, w, a, R);

    // --- Il parallelo dell'osservatore e l'omino -----------------------
    const giroObs = [];
    for (let i = 0; i <= 96; i++) giroObs.push(tramPro(tramSuGlobo(a, tram.lat, i / 96 * 360), w));
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i < giroObs.length - 1; i++) {
      const p0 = giroObs[i], p1 = giroObs[i + 1];
      ctx.strokeStyle = (p0.z + p1.z) / 2 > 0 ? 'rgba(244, 114, 182, 0.75)' : 'rgba(244, 114, 182, 0.16)';
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    ctx.setLineDash([]);

    const vObs = tramSuGlobo(a, tram.lat, tram.ora);
    const pObs = tramPro(vObs, w);
    if (pObs.z > -0.03) {
      // la verticale del posto, e l'orizzonte che le sta perpendicolare:
      // quando il raggio del Sole ci arriva sopra rasente, è il tramonto
      const dx = pObs.x - cen.x, dy = pObs.y - cen.y, n = Math.hypot(dx, dy) || 1;
      const vx = dx / n, vy = dy / n;
      ctx.strokeStyle = 'rgba(233, 237, 247, 0.4)';
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(pObs.x, pObs.y); ctx.lineTo(pObs.x + vx * R * 0.3, pObs.y + vy * R * 0.3);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(233, 237, 247, 0.28)';
      ctx.beginPath();
      ctx.moveTo(pObs.x - vy * R * 0.16, pObs.y + vx * R * 0.16);
      ctx.lineTo(pObs.x + vy * R * 0.16, pObs.y - vx * R * 0.16);
      ctx.stroke();

      // il raggio che arriva proprio lì
      if (s.sopra && lung > 0.22) {
        const ux = sx / lung, uy = sy / lung;
        const l0 = R * 1.5;
        didFreccia(ctx, pObs.x + ux * l0, pObs.y + uy * l0, pObs.x + ux * 6, pObs.y + uy * 6,
          { colore: tramRGBA(coloreSole, 0.95), spessore: 2.4, punta: 9 });
      }

      ctx.fillStyle = '#f472b6';
      ctx.beginPath(); ctx.arc(pObs.x, pObs.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 1.6; ctx.stroke();
      didScritta(ctx, `sei qui · ${tramOraTesto()}`, pObs.x + vx * R * 0.36, pObs.y + vy * R * 0.36,
        { colore: '#f9a8d4', misura: 11.5, peso: 800,
          allinea: vx < -0.15 ? 'right' : (vx > 0.15 ? 'left' : 'center'), dy: vy < 0 ? -5 : 13 });
    }

    // --- Le etichette del quadro ---------------------------------------
    // «Giorno» e «notte» si appoggiano alla direzione del Sole **proiettata
    // sullo schermo** — la stessa dell'anello dell'aria — e non al punto in
    // cui il Sole è a picco: quel punto, con la scena messa di taglio, sta
    // sul bordo del disco quasi sempre, e le due parole non comparivano mai.
    if (gn > 0.2) {
      const dove = (verso, testo, colore) => didScritta(ctx, testo,
        cen.x + gx / gn * R * 0.6 * verso, cen.y + gy / gn * R * 0.6 * verso,
        { colore, misura: 12, allinea: 'center', peso: 800 });
      dove(1, 'GIORNO', 'rgba(214, 234, 255, 0.85)');
      dove(-1, 'NOTTE', 'rgba(158, 176, 214, 0.8)');
    }

    if (etichettaSole) {
      didScritta(ctx, L < 460 ? 'il Sole' : 'il Sole — sta fermo',
        etichettaSole.x, etichettaSole.y,
        { colore: '#ffd166', misura: 11, allinea: 'center', peso: 700 });
    } else if (tramDot(a.s, w.d) > 0) {
      // Guardando dalla parte del Sole non c'è niente da disegnare — il Sole
      // è dietro alla telecamera — e senza una riga che lo dica sembra che
      // sia sparito. È anche il quadro in cui tutto il bordo è arancione:
      // da lassù il limbo è tutto tramonto, perché il Sole lo sfiora ovunque
      didScritta(ctx, 'Il Sole è alle tue spalle: si vede solo il giorno.',
        12, H - 16, { colore: '#ffd166', misura: 11, peso: 700, schermo: true });
    }

    // Le due righe stanno in alto tutt'e due, e sono corte: su un telefono
    // la tela è larga trecentocinquanta pixel, e una riga di stato
    // appoggiata in basso finiva sotto alla targhetta — cioè si scriveva
    // per non farsi leggere. Quello che diceva è comunque nelle letture.
    didScritta(ctx, 'Il Sole non si muove: gira la Terra.', 12, 20,
      { colore: C.testo2, misura: 12, peso: 700, schermo: true });
    didScritta(ctx, `Aria ingrandita ~${esagera}× — alla scala vera è un filo.`,
      12, 37, { colore: C.testo3, misura: 10.5, peso: 600, schermo: true });
  }

  // La freccia del verso di rotazione, attorno al polo. È calcolata sul
  // modello e non incollata sullo schermo: girando la scena gira con lei, e
  // resta l'unico segno che dice da che parte va il tempo.
  function tramFrecciaGiro(ctx, w, a, R) {
    const punti = [];
    for (let i = 0; i <= 40; i++) {
      const ang = -70 + i / 40 * 150;
      punti.push(tramPro(tramScala(tramSuGlobo(a, 74, ang), 1.1), w));
    }
    const vis = punti.filter(p => p.z > 0.05);
    if (vis.length < 6) return;
    ctx.strokeStyle = 'rgba(138, 180, 255, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    vis.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.stroke();
    const b = vis[vis.length - 1], c = vis[vis.length - 3];
    didFreccia(ctx, c.x, c.y, b.x, b.y, { colore: 'rgba(138, 180, 255, 0.8)', spessore: 1.6, punta: 8 });
    didScritta(ctx, 'gira così', vis[Math.floor(vis.length / 2)].x, vis[Math.floor(vis.length / 2)].y - 7,
      { colore: 'rgba(138, 180, 255, 0.85)', misura: 10, allinea: 'center', peso: 700 });
  }

  // -------------------------------------------------------------------
  // 9.4 Il quadro dell'aria — scala vera, curvatura compresa
  // -------------------------------------------------------------------

  function tramDisegnaAria() {
    const tela = didTela('did-tram-aria', 2.9, 300, { lente: true, pieno: true, trascina: false });
    if (!tela) return;
    const { ctx, L, H } = tela;
    didSfondo(ctx, L, H);

    const s = tramCalcola();
    const coloreSole = tramColoreSole(s.bande);

    // Un metro solo, per tutti e due gli assi: è questa l'unica ragione per
    // cui il rapporto fra i due cammini si può misurare col righello.
    const scala = (L * 0.78) / TRAM_CAMMINO_MAX;
    const ariaPx = TRAM_ARIA_KM * scala;
    // L'osservatore non sta in fondo alla tela: sotto ci vuole il posto per
    // il suolo e per la targhetta, che è appoggiata sopra al disegno
    const obsX = L * TRAM_ARIA_OBS.x, obsY = H * TRAM_ARIA_OBS.y;
    const Rpx = TRAM_RE * scala, Cx = obsX, Cy = obsY + Rpx;
    // il punto a quota `km` sopra il suolo, alla stessa ascissa
    const quota = (x, km) => {
      const rr = Rpx + km * scala, dx = x - Cx;
      return Cy - Math.sqrt(Math.max(0, rr * rr - dx * dx));
    };
    const filo = (km, n) => {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const x = -20 + (L + 40) * i / n;
        const y = quota(x, km);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
    };

    // L'aria vera non ha un tetto: si dirada e basta. Questa velatura è il
    // suo profilo esponenziale, e la fascia piena qui sotto è la stessa
    // identica quantità d'aria, tutta compressa alla densità del suolo.
    for (let k = 40; k > 0; k -= 1.6) {
      ctx.fillStyle = `rgba(94, 150, 235, ${(0.030 * Math.exp(-k / TRAM_ARIA_KM)).toFixed(4)})`;
      ctx.beginPath();
      filo(k, 40);
      ctx.lineTo(L + 20, H + 30); ctx.lineTo(-20, H + 30); ctx.closePath();
      ctx.fill();
    }

    // la fascia equivalente
    const gAria = ctx.createLinearGradient(0, obsY - ariaPx, 0, obsY);
    gAria.addColorStop(0, 'rgba(110, 168, 255, 0.26)');
    gAria.addColorStop(1, 'rgba(150, 198, 255, 0.58)');
    ctx.fillStyle = gAria;
    ctx.beginPath();
    filo(TRAM_ARIA_KM, 60);
    for (let i = 60; i >= 0; i--) {
      const x = -20 + (L + 40) * i / 60;
      ctx.lineTo(x, quota(x, 0));
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(160, 200, 255, 0.7)';
    ctx.lineWidth = 1.1; ctx.setLineDash([6, 5]);
    filo(TRAM_ARIA_KM, 60); ctx.stroke();
    ctx.setLineDash([]);

    // il suolo
    ctx.beginPath();
    filo(0, 60);
    ctx.lineTo(L + 20, H + 30); ctx.lineTo(-20, H + 30); ctx.closePath();
    const gSuolo = ctx.createLinearGradient(0, obsY, 0, H);
    gSuolo.addColorStop(0, 'rgba(38, 56, 92, 0.98)');
    gSuolo.addColorStop(1, 'rgba(9, 15, 30, 1)');
    ctx.fillStyle = gSuolo; ctx.fill();
    ctx.strokeStyle = 'rgba(150, 190, 255, 0.55)'; ctx.lineWidth = 1.3;
    filo(0, 60); ctx.stroke();

    // l'orizzonte dell'osservatore: nel disegno è esattamente orizzontale,
    // perché l'osservatore sta in cima al cerchio. È anche il raggio che
    // arriva rasente, quello del tramonto: da lì in poi il suolo scende.
    ctx.strokeStyle = 'rgba(233, 237, 247, 0.28)';
    ctx.setLineDash([4, 6]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(4, obsY); ctx.lineTo(obsX, obsY); ctx.stroke();
    ctx.setLineDash([]);

    // --- I due cammini -------------------------------------------------
    const hApp = Math.max(0, s.hApp);
    const rad = hApp * Math.PI / 180;
    const ex = obsX - s.cammino * Math.cos(rad) * scala;
    const ey = obsY - s.cammino * Math.sin(rad) * scala;

    // il cammino di mezzogiorno: verticale, uno spessore secco
    ctx.strokeStyle = 'rgba(233, 237, 247, 0.9)';
    ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(obsX, obsY); ctx.lineTo(obsX, obsY - ariaPx); ctx.stroke();
    ctx.strokeStyle = 'rgba(233, 237, 247, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(obsX, obsY - ariaPx); ctx.lineTo(obsX - 10, obsY - ariaPx - 26);
    ctx.stroke();
    ctx.setLineDash([]);
    didScritta(ctx, 'dritto sopra la testa: 1×', obsX - 12, obsY - ariaPx - 30,
      { colore: C.testo2, misura: 10.5, allinea: 'right', peso: 700 });

    // quello di adesso, col colore che si porta dietro: bianco quando entra,
    // e quello che resta quando arriva
    const gr = ctx.createLinearGradient(ex, ey, obsX, obsY);
    gr.addColorStop(0, 'rgba(255, 252, 245, 0.95)');
    gr.addColorStop(1, tramRGBA(coloreSole, 1));
    ctx.strokeStyle = gr;
    ctx.lineWidth = 5.5; ctx.globalAlpha = 0.22;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(obsX, obsY); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.6;
    // il raggio si incurva davvero: il suo raggio di curvatura è una decina
    // di volte quello della Terra, e su trecento km è un chilometro e mezzo.
    // Disegnato alla stessa scala di tutto il resto è un paio di pixel — e
    // sono quei due pixel a farci vedere il Sole quando è già tramontato.
    const sag = s.cammino * s.cammino / (2 * TRAM_CURVA_RAGGI * TRAM_RE) * scala;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.quadraticCurveTo((ex + obsX) / 2, (ey + obsY) / 2 - sag * 2, obsX, obsY);
    ctx.stroke();

    // L'etichetta si scosta **perpendicolarmente al raggio**, non «più in
    // alto»: col Sole a mezza altezza il raggio è ripido, e uno scostamento
    // verticale la lasciava appoggiata sopra alla riga
    const mx = (ex + obsX) / 2, my = (ey + obsY) / 2;
    didScritta(ctx, `adesso: ${Math.round(s.cammino)} km — ${num(s.X, 1)}×`,
      mx - Math.sin(rad) * 16, my - Math.cos(rad) * 16,
      { colore: tramHexOf(coloreSole), misura: 12, allinea: 'center', peso: 800 });

    // --- Il blu che se ne va di lato ------------------------------------
    //
    // È la metà della storia che di solito non si racconta: la luce che il
    // raggio perde non sparisce, cambia direzione. Va a finire in tutto il
    // resto del cielo, ed è **quella** che vediamo azzurra. I trattini si
    // spengono avvicinandosi all'osservatore perché di blu, lungo la
    // strada, ne resta sempre meno: arrivati qui non ce n'è quasi più, e
    // infatti il Sole è rosso.
    const quanti = Math.max(3, Math.min(22, Math.round(s.cammino / 14)));
    const nx = Math.sin(rad), ny = -Math.cos(rad);      // la perpendicolare al raggio, verso il cielo
    for (let i = 1; i <= quanti; i++) {
      const u = i / (quanti + 1);
      const px = ex + (obsX - ex) * u, py = ey + (obsY - ey) * u;
      const resta = tramTrasmittanza(450, s.X * u);     // quanto blu è ancora nel raggio, lì
      const forza = Math.max(0, Math.min(1, Math.pow(resta, 0.35)));
      if (forza < 0.06) continue;
      const lun = 8 + 11 * forza;
      ctx.strokeStyle = `rgba(130, 180, 255, ${(0.9 * forza).toFixed(3)})`;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + nx * lun - Math.cos(rad) * lun * 0.3, py + ny * lun + Math.sin(rad) * lun * 0.3);
      ctx.stroke();
    }
    if (s.X > 1.4) {
      didScritta(ctx, 'il blu esce di lato: è quello che fa il cielo azzurro',
        ex + (obsX - ex) * 0.10 + nx * 46, ey + (obsY - ey) * 0.10 + ny * 46,
        { colore: 'rgba(150, 190, 255, 0.95)', misura: 10.5, peso: 700 });
    }

    // Quanta ne arriva davvero, scritto dove arriva
    didScritta(ctx, `arriva il ${num(s.bande.verde * 100, s.bande.verde > 0.1 ? 0 : 1)}%`,
      obsX - 10, obsY + 16,
      { colore: tramHexOf(coloreSole), misura: 11, allinea: 'right', peso: 800 });

    // il Sole, in fondo al raggio, con l'anello che dice che si può prendere
    const dSole = Math.min(74, Math.hypot(ex, ey - H * 0.2));
    const px = ex - Math.cos(rad) * dSole, py = ey - Math.sin(rad) * dSole;
    if (px > 12) {
      didCorpoSchermo(ctx, px, py, 10, tramHexOf(coloreSole), { alone: 3 });
      ctx.strokeStyle = 'rgba(255, 240, 200, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(px, py, 17, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      didScritta(ctx, 'trascinami', px, py - 24,
        { colore: 'rgba(255, 226, 168, 0.9)', misura: 10, allinea: 'center', peso: 700 });
    }

    // --- La misura della fascia ----------------------------------------
    const mX = obsX + Math.min(34, (L - obsX) * 0.45);
    ctx.strokeStyle = 'rgba(160, 200, 255, 0.85)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(mX, quota(mX, 0)); ctx.lineTo(mX, quota(mX, TRAM_ARIA_KM));
    ctx.moveTo(mX - 4, quota(mX, 0)); ctx.lineTo(mX + 4, quota(mX, 0));
    ctx.moveTo(mX - 4, quota(mX, TRAM_ARIA_KM)); ctx.lineTo(mX + 4, quota(mX, TRAM_ARIA_KM));
    ctx.stroke();
    didScritta(ctx, '8,4 km', mX + 6, quota(mX, TRAM_ARIA_KM) - 9,
      { colore: '#a0c8ff', misura: 10, peso: 700 });

    // la riga graduata: 100 km, con lo stesso metro di tutto il resto
    const barra = 100 * scala, bx = 16, by = Math.min(H - 16, obsY + 34);
    ctx.strokeStyle = 'rgba(233, 237, 247, 0.55)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(bx + barra, by);
    ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4);
    ctx.moveTo(bx + barra, by - 4); ctx.lineTo(bx + barra, by + 4);
    ctx.stroke();
    didScritta(ctx, '100 km', bx + barra / 2, by - 7,
      { colore: C.testo3, misura: 9.5, allinea: 'center', peso: 600, schermo: true });

    // --- Il titolo del quadro ------------------------------------------
    didScritta(ctx, s.sopra
      ? `${Math.round(s.cammino)} km d'aria contro gli 8,4 che basterebbero col Sole sulla testa: ${num(s.X, 1)} volte.`
      : `Il Sole è sotto l'orizzonte: la luce che resta ha attraversato tutto questo e oltre.`,
      12, 22, { colore: C.testo, misura: 13, peso: 800, schermo: true });
    didScritta(ctx, "Otto chilometri e mezzo è poco più dell'Everest (8,8) e meno di un aereo di linea (11).",
      12, 39, { colore: C.testo3, misura: 10.5, peso: 600, schermo: true });
    didScritta(ctx, 'Curvatura, spessore e cammino allo stesso metro — nessuna esagerazione.',
      12, 55, { colore: C.testo3, misura: 10, peso: 600, schermo: true });
  }

  // -------------------------------------------------------------------
  // 9.5 Il quadro del colore — quello che si vede da qui
  // -------------------------------------------------------------------

  // Quanto cielo si inquadra: quel tanto che basta a tenerci dentro il Sole.
  // È una funzione e non due righe dentro al disegno perché la usa anche il
  // dito — chi trascina il Sole si muove in gradi, e i gradi per pixel sono
  // questi.
  function tramCampoCielo(hApp) { return Math.max(4, Math.min(80, hApp * 1.3 + 2.4)); }

  function tramDisegnaCieloVisto() {
    const tela = didTela('did-tram-cielo', 1.25, 420, { lente: true, pieno: true, trascina: false });
    if (!tela) return;
    const { ctx, L, H } = tela;
    const s = tramCalcola();

    // Un campo stretto, come una fotografia col teleobiettivo: è l'unico
    // modo di avere il disco del Sole alla sua misura vera — mezzo grado —
    // e insieme il pezzo di cielo in cui il colore cambia davvero. Si
    // allarga quel tanto che basta a tenerci dentro il Sole: con un campo
    // fisso, appena il Sole si alzava un poco usciva dall'inquadratura e
    // restava un rettangolo di colore senza il suo protagonista.
    const campo = tramCampoCielo(s.hApp);
    const kpx = H / campo;
    const yOriz = H * 0.80;
    const yDi = (alt) => yOriz - alt * kpx;
    const cx = L * 0.5;

    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, L, H);
    for (let y = 0; y < yOriz; y += 3) {
      const alt = (yOriz - y) / kpx;
      ctx.fillStyle = tramRGBA(tramColoreCielo(alt, s.hVero));
      ctx.fillRect(0, y, L, 3.2);
    }

    // il bagliore attorno al Sole
    const coloreSole = tramColoreSole(s.bande);
    const rx = TRAM_RAGGIO_SOLE * kpx;
    const ySole = yDi(s.hApp);
    if (s.hApp > -1.2) {
      const g = ctx.createRadialGradient(cx, ySole, rx * 0.4, cx, ySole, rx * 11);
      g.addColorStop(0, tramRGBA(coloreSole, 0.55));
      g.addColorStop(0.35, tramRGBA(coloreSole, 0.18));
      g.addColorStop(1, tramRGBA(coloreSole, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, L, yOriz);
    }

    // Dov'è davvero: la posizione geometrica, senza atmosfera. È sotto
    // l'orizzonte molto prima che il Sole sparisca, e questa è tutta la
    // faccenda della rifrazione. Si disegna **dopo** il terreno, perché è
    // un segno del disegno e non una cosa che sta in cielo: al tramonto il
    // Sole geometrico è sotto la linea, e sepolto sotto la collina non lo
    // vedeva nessuno — proprio nel momento in cui vale la pena guardarlo.
    const yVero = yDi(s.hVero);
    const segnoVero = () => {
      if (Math.abs(yVero - ySole) < 3) return;
      ctx.strokeStyle = 'rgba(226, 234, 250, 0.8)';
      ctx.setLineDash([4, 4]); ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(cx, yVero, rx, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + rx + 12, yVero); ctx.lineTo(cx + rx + 12, ySole);
      ctx.stroke();
      ctx.setLineDash([]);
      didScritta(ctx, `rifrazione ${Math.round(s.R)}′`, cx + rx + 18, (yVero + ySole) / 2 + 4,
        { colore: '#e2eafa', misura: 10.5, peso: 700 });
      // a sinistra del cerchio e non sotto: sotto c'è la targhetta, e
      // proprio nell'istante che conta — il Sole geometrico appena sceso —
      // la scritta ci finiva dietro
      didScritta(ctx, 'dov\'è davvero il Sole', cx - rx - 10, yVero + 4,
        { colore: 'rgba(226, 234, 250, 0.85)', misura: 10, allinea: 'right', peso: 700 });
    };

    // Il disco, schiacciato: il bordo di sotto è alzato dalla rifrazione più
    // di quello di sopra, e il Sole all'orizzonte diventa un'ellisse. Le due
    // altezze sono calcolate una per una, non è una deformazione a occhio.
    const alto = tramAltezzaApparente(s.hVero + TRAM_RAGGIO_SOLE);
    const basso = tramAltezzaApparente(s.hVero - TRAM_RAGGIO_SOLE);
    const ry = Math.max(1, (alto - basso) / 2 * kpx);
    const yCentro = yDi((alto + basso) / 2);
    if (s.hApp > -1.2) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, L, yOriz); ctx.clip();
      const disco = ctx.createRadialGradient(cx, yCentro, 0, cx, yCentro, Math.max(rx, ry));
      disco.addColorStop(0, tramRGBA({ r: Math.min(255, coloreSole.r + 30), g: Math.min(255, coloreSole.g + 26), b: Math.min(255, coloreSole.b + 20) }));
      disco.addColorStop(1, tramRGBA(coloreSole));
      ctx.fillStyle = disco;
      ctx.beginPath(); ctx.ellipse(cx, yCentro, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // il terreno: una cresta lontana e il primo piano scuro
    ctx.fillStyle = 'rgba(10, 16, 30, 0.96)';
    ctx.beginPath();
    ctx.moveTo(0, yOriz);
    for (let x = 0; x <= L; x += 8) {
      const d = Math.sin(x * 0.014) * 3 + Math.sin(x * 0.037 + 1.2) * 2.2;
      ctx.lineTo(x, yOriz - Math.max(0, d));
    }
    ctx.lineTo(L, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(233, 237, 247, 0.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, yOriz); ctx.lineTo(L, yOriz); ctx.stroke();
    didScritta(ctx, 'orizzonte', L - 10, yOriz + 15,
      { colore: C.testo2, misura: 10, allinea: 'right', peso: 600 });

    segnoVero();

    const schiaccia = Math.max(0, 1 - ry / rx);
    didScritta(ctx, s.sopra
      ? `Disco schiacciato del ${Math.round(schiaccia * 100)}% · rifrazione ${Math.round(s.R)}′ contro i 32′ del diametro`
      : 'Il disco è sotto l\'orizzonte: resta il crepuscolo',
      12, 20, { colore: C.testo2, misura: 11, peso: 700, schermo: true });
    didScritta(ctx, `Campo inquadrato: ${num(campo, 1)}° in altezza — il Sole è alla sua misura vera`,
      12, 36, { colore: C.testo3, misura: 10, peso: 600, schermo: true });
  }

  // --- L'istogramma dello spettro che resta ---------------------------
  function tramDisegnaBande() {
    const tela = didTela('did-tram-bande', 1, 420, { lente: true, pieno: true });
    if (!tela) return;
    const { ctx, L, H } = tela;
    ctx.clearRect(0, 0, L, H);
    const s = tramCalcola();

    // Sotto ci vuole il posto per i nomi delle bande e per la targhetta,
    // che sta appoggiata sopra al disegno; sopra, per il titolo e per il
    // campione del colore
    const basso = 74, alto = 58;
    const zonaAlta = H - basso - alto;
    const passo = (L - 40) / 3;
    const largo = Math.min(64, passo * 0.55);

    ctx.strokeStyle = 'rgba(148, 168, 214, 0.16)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(16, alto); ctx.lineTo(L - 16, alto); ctx.stroke();
    ctx.setLineDash([]);
    didScritta(ctx, 'tutta la luce (100%)', L - 18, alto - 8,
      { colore: C.testo3, misura: 9.5, allinea: 'right', peso: 600, schermo: true });

    TRAM_BANDE.forEach((b, i) => {
      const v = Math.max(1e-5, s.bande[b.id]);
      const frazione = Math.max(0, Math.min(1, (Math.log10(v) + 4) / 4));
      const x = 20 + passo * i + (passo - largo) / 2;
      const h = Math.max(2, zonaAlta * frazione);
      const y = alto + zonaAlta - h;

      ctx.fillStyle = didVela(b.colore, 0.75);
      ctx.fillRect(x, y, largo, h);
      ctx.strokeStyle = didVela(b.colore, 0.9);
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x, y, largo, h);

      const pct = v * 100;
      const testoPct = pct >= 1 ? `${num(pct, pct >= 10 ? 0 : 1)}%` : (pct >= 0.01 ? `${num(pct, 2)}%` : '< 0,01%');
      didScritta(ctx, testoPct, x + largo / 2, y - 6,
        { colore: C.testo, misura: 10.5, allinea: 'center', peso: 700, schermo: true });
      didScritta(ctx, `${b.id} · ${b.nm} nm`, x + largo / 2, H - basso + 16,
        { colore: C.testo2, misura: 10, allinea: 'center', peso: 600, schermo: true });
    });

    didScritta(ctx, `Quanta luce arriva all'occhio, dopo ${num(s.X, 1)} masse d'aria`, 12, 18,
      { colore: C.testo3, misura: 11, peso: 700, schermo: true });
    // il campione del colore che ne esce: è quello che il Sole ha adesso
    ctx.fillStyle = tramRGBA(tramColoreSole(s.bande));
    ctx.beginPath(); ctx.roundRect(12, 28, 26, 15, 5); ctx.fill();
    didScritta(ctx, 'il colore che ne esce', 46, 40,
      { colore: C.testo2, misura: 10, peso: 600, schermo: true });
  }

  // -------------------------------------------------------------------
  // 9.6 Il quadro di Marte — due cieli, la stessa ora
  // -------------------------------------------------------------------

  // Un cielo visto da sotto, dentro a un riquadro: le strisce di colore, il
  // Sole alla sua misura angolare vera, l'orizzonte, il terreno.
  //
  // È la stessa funzione per tutt'e due i pianeti, e non è pigrizia: se i
  // due cieli fossero disegnati da due funzioni diverse, la differenza fra
  // loro potrebbe venire dal disegno invece che dalla fisica, e il
  // confronto — che è tutto quello che questo quadro è — non varrebbe più
  // niente. Cambiano tre cose sole: la funzione che dà il colore, quanto è
  // grande il Sole visto da lì, e il colore del suolo.
  function tramDipingiCielo(ctx, r, p) {
    const kpx = r.H / p.campo;
    const yOriz = r.y + r.H * 0.78;
    const cx = r.x + r.L / 2;
    const yDi = (alt) => yOriz - alt * kpx;

    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.L, r.H); ctx.clip();

    ctx.fillStyle = '#05070f';
    ctx.fillRect(r.x, r.y, r.L, r.H);
    for (let y = r.y; y < yOriz; y += 3) {
      ctx.fillStyle = tramRGBA(p.colore((yOriz - y) / kpx, p.hSole));
      ctx.fillRect(r.x, y, r.L, 3.2);
    }

    const rx = p.soleGradi / 2 * kpx;
    const ySole = yDi(p.hSole);
    if (p.hSole > -1.2) {
      const g = ctx.createRadialGradient(cx, ySole, rx * 0.4, cx, ySole, rx * 11);
      g.addColorStop(0, tramRGBA(p.coloreSole, 0.5));
      g.addColorStop(0.35, tramRGBA(p.coloreSole, 0.16));
      g.addColorStop(1, tramRGBA(p.coloreSole, 0));
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, r.L, yOriz - r.y);
      ctx.fillStyle = tramRGBA(p.coloreSole);
      ctx.beginPath(); ctx.ellipse(cx, ySole, rx, rx * p.schiaccia, 0, 0, Math.PI * 2); ctx.fill();
    }

    // il terreno
    ctx.fillStyle = p.suolo;
    ctx.beginPath();
    ctx.moveTo(r.x, yOriz);
    for (let x = 0; x <= r.L; x += 8) {
      const d = Math.sin((x + p.onda) * 0.02) * 3 + Math.sin((x + p.onda) * 0.048 + 1.2) * 2;
      ctx.lineTo(r.x + x, yOriz - Math.max(0, d));
    }
    ctx.lineTo(r.x + r.L, r.y + r.H); ctx.lineTo(r.x, r.y + r.H);
    ctx.closePath(); ctx.fill();

    ctx.restore();
    ctx.strokeStyle = 'rgba(148, 168, 214, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.L - 1, r.H - 1);
    return { yOriz, kpx, cx };
  }

  function tramDisegnaMarte() {
    // Su un telefono i due cieli non stanno affiancati: verrebbero due
    // francobolli, e un confronto fra due francobolli non è un confronto.
    // Si mettono uno sopra l'altro, e la tela diventa alta invece che larga
    // — la proporzione si sceglie **prima** di chiederla, leggendo quanto è
    // largo il riquadro, perché è quella che decide l'altezza.
    const nodo = $('did-tram-marte');
    const stretto = !!nodo && nodo.clientWidth > 0 && nodo.clientWidth < 520;
    const tela = didTela('did-tram-marte', stretto ? 0.62 : 1.75, stretto ? 620 : 400,
      { lente: true, pieno: true, trascina: false });
    if (!tela) return;
    const { ctx, L, H } = tela;
    didSfondo(ctx, L, H);
    const s = tramCalcola();

    // Lo stesso campo per tutt'e due, se no i due cieli non sarebbero
    // confrontabili: mezzo grado di Sole da una parte e mezzo grado
    // dall'altra devono venire alla stessa misura sullo schermo.
    const campo = tramCampoCielo(Math.max(0, s.hApp));
    // Il fondo tiene le due righe di spiegazione **e** la targhetta, che è
    // appoggiata sopra al disegno e su un telefono va a capo: è la stessa
    // misura nei due casi perché il posto che serve non dipende da come
    // sono disposti i riquadri
    const alto = 30, basso = 108;
    const nome = 16;              // quanto sta il nome del pianeta sopra al suo riquadro
    const coda = 34;              // quanto stanno il colore e la sua riga sotto
    let rTerra, rMarte;
    if (stretto) {
      const ph = Math.max(90, (H - alto - basso - 2 * (nome + coda)) / 2);
      rTerra = { x: 12, y: alto + nome, L: L - 24, H: ph };
      rMarte = { x: 12, y: alto + nome + ph + coda + nome, L: L - 24, H: ph };
    } else {
      const largo = (L - 30) / 2;
      const ph = Math.max(80, H - alto - basso - nome - coda);
      rTerra = { x: 12, y: alto + nome, L: largo, H: ph };
      rMarte = { x: L - 12 - largo, y: alto + nome, L: largo, H: ph };
    }

    // Il Sole della Terra: quello che resta dopo Rayleigh, cioè rosso.
    const coloreTerra = tramColoreSole(s.bande);
    // Quello di Marte resta **bianco**: la polvere non guarda il colore
    // quando ferma la luce, la ferma e basta. Si spegne, non si arrossa.
    const Xm = tramMassaAriaMarte(Math.max(0, s.hVero));
    const restaM = Math.pow(10, -0.4 * (TRAM_MARTE.kPolvere + TRAM_MARTE.kRay) * Xm);
    const lm = 0.5 + 0.5 * Math.pow(Math.max(0, Math.min(1, restaM)), 0.25);
    const coloreMarte = { r: 255 * lm, g: 251 * lm, b: 241 * lm };

    const A = tramDipingiCielo(ctx, rTerra, {
      campo, hSole: s.hApp, colore: tramColoreCielo, soleGradi: TRAM_SOLE_GRADI,
      coloreSole: coloreTerra, schiaccia: 0.86, suolo: 'rgba(10, 16, 30, 0.96)', onda: 0
    });
    const M = tramDipingiCielo(ctx, rMarte, {
      // Su Marte l'aria è così poca che la rifrazione non esiste: qualche
      // primo d'arco contro i nostri trentaquattro. Il Sole tramonta quando
      // tramonta, e non si schiaccia.
      campo, hSole: s.hVero, colore: tramColoreCieloMarte, soleGradi: TRAM_MARTE.soleGradi,
      coloreSole: coloreMarte, schiaccia: 1, suolo: 'rgba(52, 30, 20, 0.97)', onda: 300
    });

    // Il nome del colore che esce dai conti, sotto ognuno dei due cieli: è
    // la riga che si legge per prima, e cambia trascinando il Sole.
    const tintaT = tramColoreCielo(campo * 0.35, s.hVero);
    const tintaM = tramColoreCieloMarte(campo * 0.35, s.hVero);
    const intesta = (r, testo, colore, tinta, sottotitolo) => {
      const cx = r.x + r.L / 2;
      didScritta(ctx, testo, cx, r.y - 5,
        { colore, misura: 12, allinea: 'center', peso: 800, schermo: true });
      didScritta(ctx, `cielo ${tramNomeTinta(tinta)}`, cx, r.y + r.H + 16,
        { colore: tramRGBA(tinta), misura: 12, allinea: 'center', peso: 800, schermo: true });
      didScritta(ctx, sottotitolo, cx, r.y + r.H + 31,
        { colore: C.testo3, misura: 10, allinea: 'center', peso: 600, schermo: true });
    };
    intesta(rTerra, 'TERRA', '#8ab4ff', tintaT, 'molecole ben più piccole della luce: Rayleigh, λ⁻⁴');
    intesta(rMarte, 'MARTE', '#e0956a', tintaM, 'polvere grande come la luce, e ferro che mangia il blu');

    const sotto = rMarte.y + rMarte.H + coda + 14;
    didScritta(ctx, s.hVero > 6
      ? (stretto ? 'Di giorno: noi azzurri, Marte color paglia.'
        : 'Di giorno: da noi il blu sparpagliato in tutto il cielo, su Marte la polvere che se lo mangia e lascia il colore della sabbia.')
      : (stretto ? 'Al tramonto si scambiano: noi rossi, Marte azzurro.'
        : 'Al tramonto si scambiano: il nostro cielo diventa rosso, e su Marte il blu si stringe attorno al Sole invece di sparpagliarsi.'),
      12, sotto, { colore: C.testo2, misura: 11, peso: 700, schermo: true });
    didScritta(ctx, stretto
      ? 'Molecole: Terra 0,097, Marte 0,006. Polvere: 0,5.'
      : 'Spessore ottico a 550 nm — molecole: Terra 0,097, Marte 0,006 (sedici volte meno). Polvere di Marte: 0,5, cioè ottanta volte la sua aria.',
      12, sotto + 16, { colore: C.testo3, misura: 10, peso: 600, schermo: true });

    // il Sole si può prendere anche qui
    if (s.hApp > -1.2) {
      ctx.strokeStyle = 'rgba(255, 240, 200, 0.4)';
      ctx.lineWidth = 1.1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(A.cx, A.yOriz - s.hApp * A.kpx, 16, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(M.cx, M.yOriz - s.hVero * M.kpx, 16, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    didScritta(ctx, stretto ? 'Trascina su e giù per muovere il Sole.'
      : 'Trascina su e giù per muovere il Sole — si muove in tutt\'e due i cieli.',
      12, 18, { colore: C.testo3, misura: 10.5, peso: 600, schermo: true });
  }

  // Il nome del colore, dal colore. Serve solo a scriverlo sotto ai due
  // cieli: un cielo «rgb(191,181,139)» non lo capisce nessuno.
  function tramNomeTinta(c) {
    const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b);
    if (mx < 26) return 'quasi nero';
    const sat = (mx - mn) / Math.max(1, mx);
    if (sat < 0.13) return 'grigio';
    if (c.b >= mx - 1) return c.g > c.r * 1.25 ? 'azzurro' : 'blu';
    if (c.r >= mx - 1) {
      if (c.g > c.r * 0.78) return c.b > c.r * 0.6 ? 'color paglia' : 'giallo ocra';
      if (c.g > c.r * 0.45) return 'arancione';
      return 'rosso';
    }
    return 'verdastro';
  }

  // -------------------------------------------------------------------
  // 9.7 I numeri, i comandi, il banco
  // -------------------------------------------------------------------

  function tramOraTesto() {
    const ore = 12 + tram.ora / 15;
    const h = Math.floor(ore) % 24;
    const m = Math.round((ore - Math.floor(ore)) * 60);
    return `${String(m === 60 ? h + 1 : h).padStart(2, '0')}:${String(m === 60 ? 0 : m).padStart(2, '0')}`;
  }

  function tramImpostaOra(v) {
    tram.ora = Math.max(0, Math.min(TRAM_ORA_MAX, v));
    const sl = $('did-tram-slitta');
    if (sl) sl.value = String(Math.round(tram.ora * 10));
  }

  // Da dove si **vede** il Sole a dove sta la Terra. Chi trascina il Sole
  // col dito indica un'altezza apparente: di lì si toglie la rifrazione
  // (tre passate bastano e avanzano — la correzione è di mezzo grado, e a
  // ogni giro se ne sbaglia un centesimo) e si arriva all'angolo orario,
  // che è l'unica manopola vera del banco. Muovere il Sole vuol dire
  // quindi girare la Terra, ed è giusto che sia così: se il Sole avesse
  // uno stato suo, i quadri finirebbero per raccontare ore diverse.
  //
  // Sopra il mezzogiorno del posto non si va: da una certa latitudine il
  // Sole più in alto di così non ci arriva, e la slitta si ferma lì invece
  // di far finta.
  // L'inversa non esiste dappertutto, e va detto: sotto ai −34′ apparenti
  // non c'è **nessuna** altezza vera che ci porti, perché la rifrazione
  // all'orizzonte vale esattamente quello. Sotto quella soglia il conto si
  // ferma al fondo invece di rincorrere un punto fisso che non c'è — che
  // col dito vuol dire: si trascina il Sole sotto l'orizzonte e lui si
  // ferma al tramonto, che è anche quello che succede davvero.
  function tramVeroDaApparente(hApp) {
    const app = Math.max(-1.2, Math.min(90, hApp));
    let hVero = app;
    for (let i = 0; i < 5; i++) hVero = Math.max(-1.4, app - tramRifrazione(hVero) / 60);
    return hVero;
  }
  function tramImpostaAltezzaApparente(hApp) {
    tramImpostaOra(tramOraPerAltezza(tramVeroDaApparente(hApp)));
  }

  // Il Sole si prende col dito. Chi chiama dice **come** si legge la
  // posizione del dito, perché nei due quadri vuol dire due cose diverse:
  // nel quadro dell'aria conta l'angolo che il raggio fa con l'orizzonte
  // (si prende il Sole e lo si corica, e il cammino nell'aria si allunga
  // sotto gli occhi); nei quadri del cielo conta lo **spostamento**
  // verticale, perché lì l'inquadratura si allarga da sé man mano che il
  // Sole sale, e un angolo assoluto si rincorrerebbe da solo.
  function tramCollegaSole(id, leggi) {
    const tela = $(id);
    if (!tela) return;
    let preso = null;
    const dove = (e) => {
      const r = tela.getBoundingClientRect();
      const p = didLenteMondo(id, e.clientX - r.left, e.clientY - r.top);
      return { x: p.x, y: p.y, L: r.width, H: r.height };
    };
    tela.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary) return;
      preso = dove(e);
      try { tela.setPointerCapture(e.pointerId); } catch (err) { /* pazienza */ }
      if (tram.marcia) { tram.marcia = false; alterna('did-tram', false); }
      leggi(preso, null);
      tramAggiornaTesti();
    });
    tela.addEventListener('pointermove', (e) => {
      if (!preso || !e.isPrimary) return;
      const p = dove(e);
      leggi(p, preso);
      preso = p;
      tramAggiornaTesti();
    });
    const su = () => { preso = null; };
    tela.addEventListener('pointerup', su);
    tela.addEventListener('pointercancel', su);
  }

  function tramLeggiPosto() {
    const scelto = TRAM_LUOGHI.find(l => l.id === tram.luogo);
    if (scelto && typeof scelto.lat === 'number') {
      tram.lat = scelto.lat; tram.lon = scelto.lon;
    } else {
      const l = typeof luogoCorrente === 'function' ? luogoCorrente() : null;
      tram.lat = l ? l.lat : 44.5;
      tram.lon = l ? l.lon : 11.3;
    }
    tram.giorno = didAdesso();
    tram.decl = tramDeclinazione(tram.giorno);
  }

  // La declinazione del Sole nel giorno che si sta guardando: è lei a dire
  // dove cade il punto in cui il Sole è a picco, e quindi quanto in alto
  // arriva da qui. Preso da Astronomy Engine come tutto il resto dell'app.
  function tramDeclinazione(data) {
    if (typeof Astronomy === 'undefined') return 0;
    try {
      const t = Astronomy.MakeTime(data);
      const obs = new Astronomy.Observer(0, 0, 0);
      return Astronomy.Equator('Sun', t, obs, true, true).dec;
    } catch (e) { return 0; }
  }

  function tramAggiornaQuadro() {
    Object.keys(TRAM_QUADRI).forEach(k => {
      const n = $('did-tram-q-' + k);
      if (n) n.classList.toggle('hidden', k !== tram.quadro);
    });
    const q = $('did-tram-quadri');
    if (q) q.querySelectorAll('[data-quadro]').forEach(b =>
      b.classList.toggle('attiva', b.dataset.quadro === tram.quadro));
  }

  function tramAggiornaTesti() {
    const s = tramCalcola();
    const coloreSole = tramColoreSole(s.bande);

    scrivi('did-tram-ora', `${tramOraTesto()} — girata di ${Math.round(tram.ora)}°`);
    // Sotto il ventesimo di grado dire «sopra» o «sotto» è una lotteria di
    // arrotondamento: si scriveva «0,0° sotto l'orizzonte», che è un modo
    // di sbagliare che sembra un dato
    scrivi('did-tram-vero', Math.abs(s.hVero) < 0.05 ? 'esattamente sull\'orizzonte'
      : (s.hVero > 0 ? `${num(s.hVero, 1)}° sopra l'orizzonte`
        : `${num(-s.hVero, 1)}° sotto l'orizzonte`));
    scrivi('did-tram-rifrazione', `${Math.round(s.R)}′ — il Sole è alzato di tanto`);
    scrivi('did-tram-apparente', `${num(s.hApp, 2)}°`,
      !s.sopra ? 'rosso' : (s.hVero < 0 ? 'ambra' : null));
    scrivi('did-tram-massa', `${num(s.X, 1)}× · ${Math.round(s.cammino)} km d'aria`,
      s.X > 12 ? 'ambra' : null);

    const pctVerde = s.bande.verde * 100;
    scrivi('did-tram-luce',
      `${pctVerde >= 1 ? num(pctVerde, 1) : num(pctVerde, 3)}% — ${num(1 / s.bande.verde, 0)}× più debole`,
      s.bande.verde < 0.5 ? 'ambra' : null);

    const elColore = $('did-tram-colore');
    if (elColore) {
      const rapporto = s.bande.blu / Math.max(1e-6, s.bande.rosso);
      let nomeCol = 'rosso puro';
      if (rapporto > 0.75) nomeCol = 'bianco neutro';
      else if (rapporto > 0.4) nomeCol = 'giallo';
      else if (rapporto > 0.12) nomeCol = 'arancione dorato';
      else if (rapporto > 0.02) nomeCol = 'arancione profondo';
      elColore.textContent = nomeCol;
      elColore.className = 'did-lettura-valore';
      elColore.style.color = tramRGBA(coloreSole);
    }

    if (tram.veroAdesso !== undefined) {
      scrivi('did-tram-adesso', tram.veroAdesso === null ? 'N/D'
        : (tram.veroAdesso > 0 ? `${num(tram.veroAdesso, 1)}° sopra l'orizzonte`
          : `tramontato, ${num(-tram.veroAdesso, 1)}° sotto`));
    }

    const sl = $('did-tram-slitta');
    if (sl && document.activeElement !== sl) sl.value = String(Math.round(tram.ora * 10));
    const lettura = $('did-tram-lettura');
    if (lettura) lettura.textContent = `${tramOraTesto()} · Sole a ${num(s.hVero, 1)}°`;

    const dove = $('did-tram-dove');
    if (dove) {
      const hMax = tramAltezzaMassima();
      dove.innerHTML = `Stai guardando dal parallelo <strong>${num(Math.abs(tram.lat), 1)}° ${tram.lat >= 0 ? 'N' : 'S'}</strong>. `
        + `Oggi il Sole è a picco sul parallelo <strong>${num(Math.abs(tram.decl), 1)}° ${tram.decl >= 0 ? 'N' : 'S'}</strong>, `
        + (hMax <= 0
          ? `e da qui non sorge affatto: gira tutto il giorno sotto l'orizzonte.`
          : `quindi da qui non sale mai sopra <strong>${num(hMax, 1)}°</strong>. L'ora è quella solare vera: mezzogiorno è quando il Sole passa in meridiano.`);
    }

    const sp = $('did-tram-spiega');
    if (!sp) return;
    if (!s.sopra) {
      sp.innerHTML = `Il disco è scomparso sotto l'orizzonte ottico. Quello che resta in cielo è
        <strong>crepuscolo</strong>: luce che non arriva più dritta, ma diffusa dall'aria alta che da lassù
        vede ancora il Sole. È lo stesso anello arancione che, sul globo, si vede di taglio dallo spazio.`;
    } else if (s.hVero < -0.02) {
      sp.innerHTML = `Geometricamente il Sole è già <strong>${num(-s.hVero, 2)}° sotto l'orizzonte</strong>:
        senza atmosfera sarebbe tramontato. Lo vediamo ancora perché l'aria piega il raggio di
        <strong>${Math.round(s.R)}′</strong> — più del mezzo grado che il disco stesso misura, e per questo
        il tramonto «vero» e quello che si guarda non sono lo stesso istante.`;
    } else {
      sp.innerHTML = `La luce attraversa <strong>${Math.round(s.cammino)} km</strong> d'aria invece degli 8,4
        che basterebbero col Sole dritto sopra la testa: <strong>${num(s.X, 1)} volte</strong> tanto. La diffusione di Rayleigh cresce come
        λ⁻⁴, quindi il blu se ne va per primo — ne resta il <strong>${num(s.bande.blu * 100, s.bande.blu > 0.01 ? 1 : 3)}%</strong> —
        mentre del rosso arriva ancora il <strong>${num(s.bande.rosso * 100, 0)}%</strong>. Il blu perso non è
        sparito: è il colore del cielo attorno.`;
    }
  }

  function tramSoleVeroAdesso() {
    if (typeof osservatoreCorrente !== 'function' || typeof Astronomy === 'undefined') return null;
    try {
      const obs = osservatoreCorrente();
      if (!obs) return null;
      const t = Astronomy.MakeTime(didAdesso());
      const equ = Astronomy.Equator('Sun', t, obs, true, true);
      return Astronomy.Horizon(t, obs, equ.ra, equ.dec, null).altitude;
    } catch (e) { return null; }
  }

  function tramTramontoDiStasera() {
    if (typeof osservatoreCorrente !== 'function' || typeof Astronomy === 'undefined') return didAdesso();
    try {
      const obs = osservatoreCorrente();
      if (!obs) return didAdesso();
      const r = Astronomy.SearchRiseSet('Sun', obs, -1, didAdesso(), 2);
      return r ? r.date : didAdesso();
    } catch (e) { return didAdesso(); }
  }

  // Il dito sul globo: di traverso lo fa girare — cioè sposta l'ora — e in
  // su e in giù alza e abbassa il punto di vista. Sono i due gesti che uno
  // prova per primi su una palla disegnata, e vogliono dire le due cose che
  // qui hanno un senso.
  function tramCollegaGlobo(id) {
    const tela = $(id);
    if (!tela) return;
    const dita = new Set();
    tela.addEventListener('pointerdown', (e) => {
      dita.add(e.pointerId);
      tram.trascina = dita.size === 1 ? { x: e.clientX, y: e.clientY } : null;
      if (tram.trascina && tram.marcia) { tram.marcia = false; alterna('did-tram', false); }
    });
    tela.addEventListener('pointermove', (e) => {
      if (!tram.trascina || dita.size !== 1) return;
      const dx = e.clientX - tram.trascina.x, dy = e.clientY - tram.trascina.y;
      tram.trascina = { x: e.clientX, y: e.clientY };
      // Il dito porta con sé il globo, come nella vista 3D: col Sole a
      // sinistra l'osservatore cammina verso destra man mano che il tempo
      // passa, quindi tirare a destra vuol dire far passare le ore.
      tramImpostaOra(tram.ora + dx * 0.32);
      tram.cam.elev = Math.max(-60, Math.min(78, tram.cam.elev + dy * 0.3));
      tram.camV.elev = tram.cam.elev;
      tramAggiornaTesti();
    });
    const su = (e) => { dita.delete(e.pointerId); if (!dita.size) tram.trascina = null; };
    tela.addEventListener('pointerup', su);
    tela.addEventListener('pointercancel', su);
    tela.addEventListener('pointerleave', su);
  }

  function tramPillole(id, attributo, azione) {
    const riga = $(id);
    if (!riga) return;
    riga.addEventListener('click', (e) => {
      const b = e.target.closest('[data-' + attributo + ']');
      if (!b) return;
      riga.querySelectorAll('[data-' + attributo + ']').forEach(x => x.classList.toggle('attiva', x === b));
      azione(b.dataset[attributo]);
    });
  }

  laboratorio({
    id: 'tramonto',
    chip: 'Il Sole al tramonto',
    occhiello: 'Concetto 8 — Ottica dell\'atmosfera',
    titolo: 'Perché il Sole al tramonto è rosso, debole, e già tramontato',
    sommario: `Il Sole non scende: <em>siamo noi che giriamo</em>. <strong>Trascina la Terra col dito</strong>
      e guarda l'omino passare dalla parte in ombra — il confine fra il giorno e la notte sta fermo, lo
      attraversiamo noi. Quando il Sole è basso la sua luce entra di striscio: la stessa aria che col
      Sole sulla testa attraverserebbe in 8 km se la deve fare per più di trecento, e il blu se ne va per
      strada — <em>di lato</em>, che è poi il motivo per cui il cielo attorno è azzurro. Al raggio resta
      il rosso. <strong>Il Sole si prende col dito</strong> in tutti i quadri; nell'ultimo c'è Marte
      accanto a noi, dove la stessa storia finisce al contrario.`,

    costruisci() {
      return `
        <div class="segmenti-cielo did-quadri" id="did-tram-quadri">
          ${Object.keys(TRAM_QUADRI).map((k, i) =>
            `<button type="button" class="tasto-segmento${i === 0 ? ' attiva' : ''}" data-quadro="${k}">${TRAM_QUADRI[k].chip}</button>`).join('')}
        </div>

        <div id="did-tram-q-globo">
          <figure class="did-scena did-scena-tonda">
            <canvas id="did-tram-globo" class="did-tela"></canvas>
            <figcaption class="did-targhetta"><strong>Trascina la Terra</strong> per farla girare. Il Sole sta fermo.</figcaption>
          </figure>
          <div class="did-riga did-riga-avvolgi" id="did-tram-viste">
            <span class="did-etichetta">Guarda il globo:</span>
            ${Object.keys(TRAM_VISTE).map((k, i) =>
              `<button type="button" class="did-pillola${i === 0 ? ' attiva' : ''}" data-vista="${k}">${TRAM_VISTE[k].nome}</button>`).join('')}
          </div>
          <p class="did-nota did-nota-gesto">Un dito di traverso fa girare la Terra — cioè fa passare le ore —
            e in su o in giù alza e abbassa il punto di vista; due dita avvicinano.</p>
        </div>

        <div id="did-tram-q-aria" class="hidden">
          <figure class="did-scena did-scena-tonda">
            <canvas id="did-tram-aria" class="did-tela"></canvas>
            <figcaption class="did-targhetta"><strong>Trascina il Sole</strong> — scala vera, curvatura compresa.
              Il trattino verticale è il cammino più corto possibile: <em>quello lungo ci sta dentro tante volte
              quanta è la massa d'aria</em>.</figcaption>
          </figure>
        </div>

        <div id="did-tram-q-colore" class="hidden">
          <div class="did-scene did-scene-due">
            <figure class="did-scena">
              <canvas id="did-tram-cielo" class="did-tela"></canvas>
              <figcaption class="did-targhetta"><strong>Trascina il Sole su e giù.</strong> Il disco è alla misura
                vera, schiacciato dalla rifrazione, e accanto c'è dove sarebbe senza aria</figcaption>
            </figure>
            <figure class="did-scena">
              <canvas id="did-tram-bande" class="did-tela"></canvas>
              <figcaption class="did-targhetta">Quanta luce resta, colore per colore</figcaption>
            </figure>
          </div>
        </div>

        <div id="did-tram-q-marte" class="hidden">
          <figure class="did-scena did-scena-tonda">
            <canvas id="did-tram-marte" class="did-tela"></canvas>
            <figcaption class="did-targhetta">Stessa ora, stessa scala: a cambiare è solo <em>chi</em> diffonde la luce.</figcaption>
          </figure>
          <p class="did-nota">Da noi diffondono le molecole d'aria, mille volte più piccole della lunghezza
            d'onda: è il regime di <strong>Rayleigh</strong>, dove la diffusione cresce come λ⁻⁴ e va un po'
            in tutte le direzioni. Il blu viene sparpagliato per tutto il cielo — e da qualunque parte si
            guardi, ne arriva: <strong>cielo azzurro</strong>. Su Marte l'aria è lo 0,6% della nostra e di
            Rayleigh non resta niente: a diffondere è la <strong>polvere</strong>, granelli di un paio di
            micron, cioè grandi <em>come</em> la lunghezza d'onda. Una polvere così non guarda il colore
            quando ferma la luce, ma la ridiffonde con un picco in avanti tanto più stretto quanto più corta
            è l'onda — e per giunta è ossido di ferro, che il blu se lo mangia. Lontano dal Sole vince
            l'assorbimento (<strong>cielo color paglia</strong>), vicino al Sole vince il picco in avanti
            (<strong>alone azzurro al tramonto</strong>). È il nostro cielo esattamente al contrario.</p>
        </div>

        ${didBarra('did-tram', { min: 0, max: TRAM_ORA_MAX * 10, passo: 1, valore: 0,
          etichettaSlitta: 'Quanto è girata la Terra dal mezzogiorno', velocita: [0.25, 1, 3, 8] })}

        <div class="did-riga did-riga-avvolgi" id="did-tram-mete">
          <span class="did-etichetta">Portami a:</span>
          ${TRAM_METE.map((m, i) => `<button type="button" class="did-pillola" data-meta="${i}">${m.nome}</button>`).join('')}
        </div>

        <div class="did-riga did-riga-avvolgi" id="did-tram-luoghi">
          <span class="did-etichetta">Da dove guardi:</span>
          ${TRAM_LUOGHI.map((l, i) =>
            `<button type="button" class="did-pillola${i === 0 ? ' attiva' : ''}" data-luogo="${l.id}">${l.nome}</button>`).join('')}
        </div>

        ${didLetture([
        { id: 'did-tram-ora', nome: 'Ora solare del posto' },
        { id: 'did-tram-vero', nome: 'Dov\'è il Sole per davvero' },
        { id: 'did-tram-rifrazione', nome: 'Quanto lo alza l\'aria' },
        { id: 'did-tram-apparente', nome: 'Dove lo vediamo', forte: true },
        { id: 'did-tram-massa', nome: 'Aria attraversata', forte: true },
        { id: 'did-tram-luce', nome: 'Luce che arriva', forte: true },
        { id: 'did-tram-colore', nome: 'Colore che ne esce', forte: true },
        { id: 'did-tram-adesso', nome: 'Il Sole adesso, da casa tua' }
      ])}

        <p class="did-spiega" id="did-tram-spiega">—</p>
        <p class="did-nota" id="did-tram-dove">—</p>

        ${didPonti([
        { azione: 'cielo', icona: 'sole', testo: 'Vedi il tramonto di stasera',
          titolo: 'Porta il planetario all\'ora vera del tramonto, da casa tua' },
        { azione: 'tred', icona: 'saturno', testo: 'Guarda la Terra da fuori',
          titolo: 'Apre il Sistema Solare in 3D' }
      ])}`;
    },

    collega() {
      collegaBarra('did-tram', tram, {
        suSlitta: (v) => { tramImpostaOra(v / 10); tramAggiornaTesti(); },
        suInizio: () => { tramImpostaOra(0); tramAggiornaTesti(); }
      });

      const quadri = $('did-tram-quadri');
      if (quadri) quadri.addEventListener('click', (e) => {
        const b = e.target.closest('[data-quadro]');
        if (!b) return;
        tram.quadro = b.dataset.quadro;
        tramAggiornaQuadro();
      });

      tramPillole('did-tram-viste', 'vista', (k) => {
        const v = TRAM_VISTE[k];
        if (!v) return;
        tram.vista = k;
        tram.camV.az = v.az; tram.camV.elev = v.elev;
      });

      tramPillole('did-tram-mete', 'meta', (i) => {
        const m = TRAM_METE[Number(i)];
        if (!m) return;
        tram.marcia = false;
        alterna('did-tram', false);
        tramImpostaOra(m.ora !== undefined ? m.ora : tramOraPerAltezza(m.h));
        tramAggiornaTesti();
      });

      tramPillole('did-tram-luoghi', 'luogo', (id) => {
        tram.luogo = id;
        tramLeggiPosto();
        tramAggiornaTesti();
      });

      tramCollegaGlobo('did-tram-globo');

      // Il quadro dell'aria: il dito **è** la direzione del raggio. Si punta
      // dove si vuole il Sole e il cammino nell'aria si rifà da solo.
      tramCollegaSole('did-tram-aria', (p) => {
        tramImpostaAltezzaApparente(Math.atan2(
          TRAM_ARIA_OBS.y * p.H - p.y,
          Math.max(6, TRAM_ARIA_OBS.x * p.L - p.x)) * GRADI);
      });
      // I due quadri del cielo: conta lo spostamento, non il punto
      const suGiu = (p, prima) => {
        if (!prima) return;
        const s = tramCalcola();
        const campo = tramCampoCielo(Math.max(0, s.hApp));
        tramImpostaAltezzaApparente(s.hApp + (prima.y - p.y) * campo / p.H);
      };
      tramCollegaSole('did-tram-cielo', suGiu);
      tramCollegaSole('did-tram-marte', suGiu);

      collegaPonti('tramonto', (azione) => {
        if (azione === 'cielo') didVaiInCielo(tramTramontoDiStasera(), 'Sun');
        else if (azione === 'tred') didVaiInTreD(didAdesso());
      });
    },

    entra() {
      tram.veroAdesso = tramSoleVeroAdesso();
      tramLeggiPosto();
      // La prima volta si atterra dove la cosa si vede: il Sole già basso.
      // Dopo, si ritrova il banco dove lo si era lasciato.
      if (!tram.avviato) { tram.avviato = true; tramImpostaOra(tramOraPerAltezza(9)); }
      tramAggiornaQuadro();
      tramAggiornaTesti();
    },

    passo(dt) {
      if (tram.marcia) {
        tramImpostaOra(tram.ora + dt * TRAM_GRADI_AL_SEC * tram.velocita);
        if (tram.ora >= TRAM_ORA_MAX) { tram.marcia = false; alterna('did-tram', false); }
        tramAggiornaTesti();
      }
      // Il punto di vista ci scivola invece di saltarci: vedere il globo
      // che si inclina è metà di quello che si è chiesto premendo il tasto.
      const k = 1 - Math.pow(0.5, dt / 0.3);
      tram.cam.az += (tram.camV.az - tram.cam.az) * k;
      tram.cam.elev += (tram.camV.elev - tram.cam.elev) * k;
    },

    disegna() {
      if (tram.quadro === 'globo') tramDisegnaGlobo();
      else if (tram.quadro === 'aria') tramDisegnaAria();
      else if (tram.quadro === 'marte') tramDisegnaMarte();
      else { tramDisegnaCieloVisto(); tramDisegnaBande(); }
    }
  });

  // ===================================================================
  // 10. IL BANCO — linguette, costruzione e ciclo di disegno
  // ===================================================================

  function collegaPonti(labId, azione) {
    const banco = $('did-lab-' + labId);
    if (!banco) return;
    banco.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ponte]');
      if (!b) return;
      azione(b.dataset.ponte);
    });
  }

  function didCostruisci() {
    if (stato.costruito) return;
    const linguette = $('did-linguette');
    const banco = $('did-banco');
    if (!linguette || !banco) return;

    linguette.innerHTML = LABORATORI.map((l, i) => `
      <button type="button" class="did-linguetta${i === 0 ? ' attiva' : ''}" data-lab="${l.id}">
        <span class="did-linguetta-numero">${i + 1}</span>
        <span>${l.chip}</span>
      </button>`).join('');

    banco.innerHTML = LABORATORI.map((l, i) => `
      <section id="did-lab-${l.id}" class="did-lab${i === 0 ? '' : ' hidden'}">
        <header class="did-testa">
          <span class="did-occhiello">${l.occhiello}</span>
          <h3 class="did-titolo">${l.titolo}</h3>
          <p class="did-sommario">${l.sommario}</p>
        </header>
        <div class="did-corpo">${l.costruisci()}</div>
      </section>`).join('');

    linguette.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lab]');
      if (!b) return;
      didApri(b.dataset.lab);
    });

    LABORATORI.forEach(l => { if (l.collega) { try { l.collega(); } catch (err) { console.warn('Didattica:', l.id, err); } } });
    stato.costruito = true;
  }

  function didApri(id) {
    const prima = labAttivo();
    if (prima && prima.id === id) return;
    didPienoEsci();
    if (prima && prima.esce) { try { prima.esce(); } catch (e) { /* niente */ } }
    stato.lab = id;
    LABORATORI.forEach(l => {
      const n = $('did-lab-' + l.id);
      if (n) n.classList.toggle('hidden', l.id !== id);
    });
    const ling = $('did-linguette');
    if (ling) ling.querySelectorAll('[data-lab]').forEach(b => b.classList.toggle('attiva', b.dataset.lab === id));
    const dopo = labAttivo();
    if (dopo && dopo.entra) { try { dopo.entra(); } catch (e) { console.warn('Didattica:', id, e); } }
    const banco = $('did-banco');
    if (banco && banco.getBoundingClientRect().top < -40) {
      banco.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function ciclo(ts) {
    if (!stato.acceso) return;
    const dt = Math.min(0.1, (ts - stato.ultimoTs) / 1000) || 0;
    stato.ultimoTs = ts;
    const l = labAttivo();
    if (l) {
      try { if (l.passo) l.passo(dt); } catch (e) { /* un banco rotto non ferma gli altri */ }
      try { if (l.disegna) l.disegna(); } catch (e) { /* idem */ }
    }
    stato.raf = requestAnimationFrame(ciclo);
  }

  // ===================================================================
  // 10. AVVIO E SPEGNIMENTO — li chiama mostraVista() in app.js
  // ===================================================================

  window.didatticaAvvia = function () {
    if (stato.acceso) return;
    didCostruisci();
    stato.acceso = true;
    const l = labAttivo();
    if (l && l.entra) { try { l.entra(); } catch (e) { console.warn('Didattica:', e); } }
    stato.ultimoTs = performance.now();
    stato.raf = requestAnimationFrame(ciclo);
  };

  window.didatticaSpegni = function () {
    didPienoEsci();
    stato.acceso = false;
    if (stato.raf) { cancelAnimationFrame(stato.raf); stato.raf = null; }
    const l = labAttivo();
    if (l && l.esce) { try { l.esce(); } catch (e) { /* niente */ } }
  };

  window.didEntraSchermoIntero = function () {
    // Cerchiamo la scena 3D attualmente visibile (quindi dentro un banco non nascosto)
    const banco = document.querySelector('.did-lab:not(.hidden)');
    if (banco) {
      // In alcune scene (es. spazio, ci sono più scene e solo alcune visibili)
      // Troviamo quella che non ha l'attributo hidden e non ha la classe hidden.
      const sceneVisibili = Array.from(banco.querySelectorAll('.did-scena')).filter(s => {
        // Se c'è un genitore col data-quadro, questo deve corrispondere al quadro attivo, ma per sicurezza controlliamo che sia visibile
        // Check display style / hidden attribute
        if (s.closest('[hidden]')) return false;
        if (s.closest('.hidden')) return false;
        return true;
      });
      if (sceneVisibili.length > 0) {
        // Prendi la prima (o l'unica) scena visibile e mettila a tutto schermo
        const id = sceneVisibili[0].id;
        if (id) didPienoEntra('#' + id);
      }
    }
  };

  window.didatticaRidimensiona = function () { cacheStelle.chiave = ''; };
  window.didProve = {
    fiondaIperbole, FIONDA_PIANETI,
    // Il banco del tramonto: la fisica è tutta in queste cinque funzioni, e
    // sono numeri che a occhio non si controllano — mezzo grado di
    // rifrazione in più o in meno disegna un tramonto lo stesso.
    tram: {
      rifrazione: tramRifrazione,
      altezzaApparente: tramAltezzaApparente,
      massaAria: tramMassaAria,
      camminoKm: tramCamminoKm,
      trasmittanza: tramTrasmittanza,
      // La geometria giorno/ora vuole latitudine e declinazione, che stanno
      // nello stato: si passano da fuori invece di doverlo pilotare
      altezzaDaOra: (ora, lat, decl) => {
        const prima = { lat: tram.lat, decl: tram.decl };
        tram.lat = lat; tram.decl = decl;
        const v = tramAltezzaDaOra(ora);
        tram.lat = prima.lat; tram.decl = prima.decl;
        return v;
      },
      oraPerAltezza: (h, lat, decl) => {
        const prima = { lat: tram.lat, decl: tram.decl };
        tram.lat = lat; tram.decl = decl;
        const v = tramOraPerAltezza(h);
        tram.lat = prima.lat; tram.decl = prima.decl;
        return v;
      },
      veroDaApparente: tramVeroDaApparente,
      // il cielo, e il cielo di Marte: sono le due funzioni che il quadro
      // del confronto mette una accanto all'altra
      coloreCielo: tramColoreCielo,
      coloreCieloMarte: tramColoreCieloMarte,
      massaAriaMarte: tramMassaAriaMarte,
      fase: tramFaseHG,
      MARTE: TRAM_MARTE, K0: TRAM_K0,
      RE: TRAM_RE, ARIA_KM: TRAM_ARIA_KM, CAMMINO_MAX: TRAM_CAMMINO_MAX
    }
  };

})();