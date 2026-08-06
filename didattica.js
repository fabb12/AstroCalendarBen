// =====================================================================
// AstroCalendario di Ben — IL LABORATORIO (la vista Didattica)
//
//   Le altre viste rispondono a «cosa si vede stanotte». Questa risponde
//   alla domanda che viene subito dopo, e che è quella vera: «perché».
//   Perché Marte per due mesi torna indietro. Perché una sonda per Giove
//   non si può lanciare a marzo. Perché passare vicino a un pianeta fa
//   guadagnare velocità senza accendere niente.
//
//   Tre regole ce le siamo date qui dentro, e valgono per tutti e cinque
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
//      solo quello a schermo calcola e disegna. Quattro tele che animano
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
//   e i cinque esperimenti la usano tutti: così hanno la stessa faccia.
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

  // I cinque banchi. `costruisci` scrive il markup, `collega` attacca i
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
  const lenti = new Map();           // id della tela → stato della sua lente

  function didLente(id) {
    let l = lenti.get(id);
    if (!l) { l = { zoom: 1, x: 0, y: 0, L: 0, H: 0, tela: null, box: null, lettura: null }; lenti.set(id, l); }
    return l;
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
    didLenteAssesta(l);
  }

  // Da un punto della tela al punto del disegno. Serve a chi sulla tela ci
  // trascina qualcosa — il parametro d'impatto della fionda — che se no,
  // con la lente accesa, misurerebbe pixel di schermo su un disegno che
  // schermo non è più.
  function didLenteMondo(id, x, y) {
    const l = lenti.get(id);
    if (!l || l.zoom === 1) return { x, y };
    return { x: (x - l.x) / l.zoom, y: (y - l.y) / l.zoom };
  }

  function didLenteMostra(l) {
    const accesa = l.zoom > 1.001;
    if (l.box) {
      l.box.classList.toggle('did-lente-accesa', accesa);
      if (l.lettura) l.lettura.textContent = l.zoom.toFixed(1).replace('.', ',') + '×';
    }
    // Finché la lente è ferma la pagina scorre anche col dito appoggiato
    // sulla tela (`pan-y`, dal foglio di stile); appena si è ingrandito quel
    // dito serve a spostarsi dentro al disegno, e lo scorrimento della
    // pagina si fa a lato. È una scelta che si disfa da sé: basta il ⟲.
    if (l.tela && !l.tela.dataset.lenteFerma) l.tela.style.touchAction = accesa ? 'none' : '';
    if (l.tela) l.tela.classList.toggle('did-tela-accesa', accesa);
  }

  // I comandi se li appende la lente da sé al riquadro della scena: i banchi
  // scrivono solo il loro <canvas>, e il markup non va toccato
  function didLenteComandi(c, l) {
    const scena = c.closest('.did-scena');
    if (!scena) return;
    const box = document.createElement('div');
    box.className = 'did-lente';
    box.innerHTML =
      '<span class="did-lente-fattore">1,0×</span>' +
      '<button type="button" class="did-lente-tasto" data-lente="meno" title="Allontanati" aria-label="Allontanati">−</button>' +
      '<button type="button" class="did-lente-tasto" data-lente="piu" title="Avvicinati al disegno (anche con due dita, o con Ctrl e la rotella)" aria-label="Avvicinati">+</button>' +
      '<button type="button" class="did-lente-tasto did-lente-azzera" data-lente="azzera" title="Torna a vedere tutto il disegno" aria-label="Torna a vedere tutto il disegno">⟲</button>';
    scena.appendChild(box);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lente]');
      if (!b) return;
      if (b.dataset.lente === 'azzera') didLenteAzzera(l);
      else didLenteIngrandisci(l, b.dataset.lente === 'piu' ? DID_LENTE_PASSO : 1 / DID_LENTE_PASSO);
      didLenteMostra(l);
    });
    l.box = box;
    l.lettura = box.querySelector('.did-lente-fattore');
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
    didLenteComandi(c, l);
    didLenteMostra(l);

    const dove = (e) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    // La rotella: solo con Ctrl (o ⌘) premuto finché la lente è ferma. Su
    // una pagina che scorre, una tela che si mangia la rotella appena il
    // puntatore ci passa sopra è una trappola — si scorre l'articolo e ci si
    // ritrova ingranditi dentro a un disegno senza aver chiesto niente.
    // Quando invece la lente è già accesa la rotella è chiaramente sua, e
    // tornando a 1× la restituisce alla pagina.
    c.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey && l.zoom <= 1.001) return;
      const pixel = e.deltaMode === 1 ? e.deltaY * 16 : (e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY);
      const scatti = Math.max(-4, Math.min(4, pixel / 100));
      if (!scatti) return;
      e.preventDefault();
      const p = dove(e);
      if (didLenteIngrandisci(l, Math.exp(-scatti * 0.2), p.x, p.y)) didLenteMostra(l);
    }, { passive: false });

    // Un dito sposta il disegno, due lo avvicinano *e* lo spostano — le
    // stesse regole della vista 3D, perché è lo stesso gesto. Come lì, a
    // ogni dito che si appoggia o si stacca i riferimenti si rifanno: se no
    // il dito rimasto verrebbe misurato da dove si era appoggiato prima del
    // pizzico, e il disegno scatterebbe di lato.
    const dita = new Map();
    let pizzico = null, ultimo = null;
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
      riancora();
      if (dita.size >= 2 || (trascina && l.zoom > 1.001)) {
        try { c.setPointerCapture(e.pointerId); } catch (err) { /* niente */ }
      }
    });

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
      if (!trascina || !ultimo || l.zoom <= 1.001) return;
      const q = dove(e);
      didLenteSposta(l, q.x - ultimo.x, q.y - ultimo.y);
      ultimo = q;
    });

    const stacca = (e) => { if (dita.delete(e.pointerId)) riancora(); };
    c.addEventListener('pointerup', stacca);
    c.addEventListener('pointercancel', stacca);
    c.addEventListener('pointerleave', stacca);

    // Doppio clic: avvicina dov'è il puntatore, e la seconda volta rimette
    // tutto il disegno nel riquadro. È la scorciatoia di chi ha il mouse.
    c.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (l.zoom > 1.001) didLenteAzzera(l);
      else { const p = dove(e); didLenteIngrandisci(l, 2.4, p.x, p.y); }
      didLenteMostra(l);
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
    let alto = Math.round(largo / proporzione);
    if (altezzaMax) alto = Math.min(alto, altezzaMax);
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const wPx = Math.round(largo * dpr), hPx = Math.round(alto * dpr);
    if (c.width !== wPx || c.height !== hPx) { c.width = wPx; c.height = hPx; }
    if (c.style.height !== alto + 'px') c.style.height = alto + 'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Le tele che hanno la lente la agganciano qui, al primo fotogramma in
    // cui esistono davvero: prima di allora il riquadro è nascosto, largo
    // zero, e non c'è niente a cui appendere i comandi.
    if (opz && opz.lente) {
      didLenteAttacca(c, id, opz);
      const l = didLente(id);
      didLenteAssesta(l, largo, alto);
      if (l.zoom !== 1 || l.x || l.y) {
        ctx.setTransform(dpr * l.zoom, 0, 0, dpr * l.zoom, dpr * l.x, dpr * l.y);
      }
    }
    return { c, ctx, L: largo, H: alto };
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
    ctx.font = `${opz.peso || 600} ${opz.misura || 11}px ${opz.mono ? 'ui-monospace, SFMono-Regular, monospace' : 'system-ui, -apple-system, sans-serif'}`;
    ctx.textAlign = opz.allinea || 'left';
    ctx.textBaseline = opz.base || 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = 'rgba(3, 6, 14, 0.88)';
    ctx.strokeText(testo, x, y);
    ctx.fillStyle = opz.colore || C.testo;
    ctx.fillText(testo, x, y);
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
  // funziona su tutti e cinque i banchi.
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
  //    e cinque gli esperimenti.
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
    const t = didTela('did-retro-elio', 1, 400, { lente: true });
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
    const t = didTela('did-kep-tela', 1.5, 440, { lente: true });
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
  // sono i due numeri che decidono quanto si può guadagnare
  const FIONDA_PIANETI = {
    Venus:   { mu: 3.24859e5, vOrb: 35.02, raggio: 6052,  nome: 'Venere',  colore: '#e8cf9a' },
    Earth:   { mu: 3.98600e5, vOrb: 29.78, raggio: 6371,  nome: 'Terra',   colore: '#4c8dff' },
    Jupiter: { mu: 1.26687e8, vOrb: 13.07, raggio: 69911, nome: 'Giove',   colore: '#e0a367' },
    Saturn:  { mu: 3.79312e7, vOrb: 9.68,  raggio: 58232, nome: 'Saturno', colore: '#e3d6a3' }
  };

  laboratorio({
    id: 'fionda',
    chip: 'Fionda gravitazionale',
    occhiello: 'Concetto 3 — rubare velocità a un pianeta',
    titolo: 'Come si guadagna velocità senza accendere niente',
    sommario: `Una sonda che passa vicino a un pianeta ne esce con la stessa velocità con cui è entrata —
      ma solo per chi guarda dal pianeta. Per chi guarda dal Sole la sonda è più veloce, e il pianeta
      un pochino più lento: la velocità non si crea, si prende in prestito. Guarda le due tele insieme,
      è tutta lì la differenza.`,

    costruisci() {
      return `
        <div class="segmenti-cielo did-quadri" id="did-fionda-schede">
          <button type="button" class="tasto-segmento attiva" data-scheda="sim">Il banco di prova</button>
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
            { id: 'did-fionda-dev', nome: 'Di quanto viene piegata' },
            { id: 'did-fionda-peri', nome: 'Passaggio più stretto' },
            { id: 'did-fionda-max', nome: 'Massimo teorico da questo pianeta' }
          ])}

          <p class="did-spiega" id="did-fionda-spiega">—</p>
          <p class="did-nota">Il massimo teorico è il doppio della velocità orbitale del pianeta, e si
            otterrebbe solo con una deviazione di 180°: impossibile, perché prima si toccherebbe la
            superficie. Ed è per questo che le fionde si fanno a Giove: non perché sia grosso, ma perché è
            grosso <em>e</em> si muove — Saturno pesa un terzo e viaggia più piano, e infatti rende meno.</p>
        </div>

        <div id="did-fionda-voyager" class="hidden">
          <figure class="did-scena did-scena-tonda">
            <canvas id="did-voy-tela" class="did-tela"></canvas>
            <figcaption class="did-targhetta">Il Grand Tour, 1977 – 1990 · posizioni planetarie reali</figcaption>
          </figure>

          <figure class="did-scena did-scena-bassa">
            <canvas id="did-voy-grafico" class="did-tela"></canvas>
            <figcaption class="did-targhetta">La velocità rispetto al Sole, incontro dopo incontro</figcaption>
          </figure>

          ${didBarra('did-voy', { min: 1977, max: 1990.5, passo: 0.02, valore: 1977.6, etichettaSlitta: 'Scorri gli anni' })}

          ${didLetture([
            { id: 'did-voy-quando', nome: 'Siamo nel', forte: true },
            { id: 'did-voy-1', nome: 'Voyager 1', forte: true },
            { id: 'did-voy-2', nome: 'Voyager 2', forte: true },
            { id: 'did-voy-prossimo', nome: 'Prossimo incontro' }
          ])}

          <p class="did-spiega" id="did-voy-spiega">—</p>
          <p class="did-nota">Le posizioni dei quattro giganti sono quelle vere, calcolate anno per anno:
            l'allineamento del Grand Tour — che si ripresenta una volta ogni 176 anni — è quello che c'era
            davvero. Le date degli incontri sono esatte. La traiettoria fra un incontro e l'altro è
            stilizzata, e i valori di velocità sono i valori indicativi ricostruiti dalle carte JPL.</p>
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
        fionda.scheda = b.dataset.scheda;
        const s = $('did-fionda-sim'), v = $('did-fionda-voyager');
        if (s) s.classList.toggle('hidden', fionda.scheda !== 'sim');
        if (v) v.classList.toggle('hidden', fionda.scheda !== 'voyager');
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
      voyNumeri();
    },

    passo(dt) {
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
      else { voyDisegnaMappa(); voyDisegnaGrafico(); }
    }
  });

  // Il passaggio si calcola una volta sola quando cambiano i comandi, non
  // a ogni fotogramma: quattromila passi di integrazione sono niente da
  // fare una volta e sono troppi da fare sessanta volte al secondo. Dopo,
  // il tempo che cammina si limita a leggere l'ennesimo punto — e la
  // slitta può scorrere avanti e indietro senza che la sonda «derivi».
  function fiondaCalcola() {
    const P = FIONDA_PIANETI[fionda.pianeta];
    const bKm = fionda.b * P.raggio;
    const v0 = fionda.vInf;
    // Si parte abbastanza lontano perché il pianeta non conti quasi
    // niente: dieci volte la distanza a cui la sua gravità piega
    const dIniziale = Math.max(Math.abs(bKm) * 6, P.raggio * 220);
    const dt = Math.max(2, dIniziale / v0 / 900);   // passo in secondi

    // La sonda parte sotto al pianeta quando il parametro d'impatto è
    // positivo, ed è una scelta di segno che conta: il pianeta si muove
    // verso l'alto (+y), quindi «sotto» vuol dire passargli dietro, dalla
    // parte che sta lasciando — e passare dietro è la manovra che fa
    // guadagnare. Con la slitta a destra si guadagna, a sinistra si
    // frena: è l'unico verso che uno si aspetta.
    let x = -dIniziale, y = -bKm, vx = v0, vy = 0;
    const punti = [{ x, y, vx, vy, t: 0 }];
    let t = 0, peri = Infinity, schianto = false;

    for (let i = 0; i < 20000; i++) {
      // Velocity-Verlet: conserva l'energia molto meglio di Eulero, e su
      // un'iperbole si vede subito — con Eulero la sonda usciva più lenta
      // di quanto era entrata anche nel riferimento del pianeta, che è
      // proprio la cosa che questo esperimento deve smentire
      const r2 = x * x + y * y;
      const r = Math.sqrt(r2);
      peri = Math.min(peri, r);
      if (r < P.raggio) { schianto = true; break; }
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
      if (i % 6 === 0) punti.push({ x, y, vx, vy, t });
      // Si smette quando si è tornati lontani **e** ci si sta
      // allontanando. La prima versione chiedeva anche `x > 0`, e con una
      // deviazione forte — che è il caso interessante — la sonda esce
      // all'indietro e quella condizione non si avverava mai: il ciclo
      // andava fino in fondo ai ventimila passi e la velocità finale era
      // presa chissà dove.
      if (r > dIniziale && (x * vx + y * vy) > 0) break;
    }
    punti.push({ x, y, vx, vy, t });

    // Nel riferimento del Sole: si somma la velocità del pianeta. Il
    // pianeta va lungo +y, la sonda arriva lungo +x — così la geometria
    // «davanti/dietro» è quella dei libri e il segno del parametro
    // d'impatto decide se si guadagna o si perde.
    const V = P.vOrb;
    const primaSole = Math.hypot(punti[0].vx, punti[0].vy + V);
    const ultimo = punti[punti.length - 1];
    const dopoSole = Math.hypot(ultimo.vx, ultimo.vy + V);

    // L'angolo di deviazione analitico dell'iperbole: sin(δ/2) = 1/(1+b·v∞²/μ)
    const dev = 2 * Math.asin(1 / (1 + Math.abs(bKm) * v0 * v0 / P.mu)) * GRADI;

    fionda.traiettoria = {
      punti, schianto, peri, primaSole, dopoSole, dev,
      guadagno: dopoSole - primaSole,
      max: 2 * V,
      vOrb: V,
      raggio: P.raggio,
      colore: P.colore,
      nome: P.nome,
      periRaggi: peri / P.raggio
    };
    fionda.t = 0;
    const s = $('did-fionda-slitta'); if (s) s.value = '0';
    fiondaNumeri();
  }

  function fiondaPunto() {
    const tr = fionda.traiettoria;
    if (!tr) return null;
    const i = Math.max(0, Math.min(tr.punti.length - 1, Math.round(fionda.t * (tr.punti.length - 1))));
    return tr.punti[i];
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
      scrivi('did-fionda-max', `${num(tr.max, 1)} km/s`);
      const sp = $('did-fionda-spiega');
      if (sp) sp.innerHTML = `Troppo stretto: la sonda ha colpito ${tr.nome}. È il limite vero della fionda —
        più si passa vicino più si viene deviati, ma sotto la superficie non si passa. Allarga il
        parametro d'impatto.`;
      return;
    }

    scrivi('did-fionda-prima', `${num(tr.primaSole, 2)} km/s`);
    scrivi('did-fionda-dopo', `${num(tr.dopoSole, 2)} km/s`, tr.guadagno >= 0 ? 'verde' : 'rosso');
    scrivi('did-fionda-guadagno', `${tr.guadagno >= 0 ? '+' : '−'}${num(Math.abs(tr.guadagno), 2)} km/s`,
      tr.guadagno >= 0 ? 'verde' : 'rosso');
    scrivi('did-fionda-dev', `${num(tr.dev, 1)}°`);
    scrivi('did-fionda-peri', `${num(tr.periRaggi, 1)} raggi di ${tr.nome} · ${num(tr.peri / 1000, 0)} mila km`);
    scrivi('did-fionda-max', `± ${num(tr.max, 1)} km/s (2 × ${num(tr.vOrb, 1)})`);
    const p = fiondaPunto();
    const lettura = $('did-fionda-lettura');
    if (lettura && p) lettura.textContent = `${num(p.t / 86400, 1)} g`;

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

  function fiondaDisegnaPianeta() {
    const t = didTela('did-fionda-pianeta', 1.1, 340, { lente: true, trascina: false });
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
    didScritta(ctx, tr.nome, cx, cy + raggioPx + 15, { colore: C.testo2, misura: 11, allinea: 'center' });

    const p = fiondaPunto();
    if (p) {
      const v = Math.hypot(p.vx, p.vy);
      didFreccia(ctx, X(p.x), Y(p.y), X(p.x) + p.vx / v * 34, Y(p.y) - p.vy / v * 34,
        { colore: C.verde, spessore: 2.2, punta: 8 });
      didCorpo(ctx, X(p.x), Y(p.y), 4.5, '#ffffff', { alone: 2.6 });
      didScritta(ctx, `${num(v, 2)} km/s`, X(p.x) + 8, Y(p.y) - 12, { colore: C.verde, misura: 11, peso: 700, mono: true });
    }
    // Va detto con precisione, se no il numero che cammina sembra
    // smentire la targhetta: cadendo verso il pianeta la sonda accelera
    // (a cinque raggi da Giove va a ventisette km/s), risalendo
    // restituisce tutto. Quello che non cambia è la velocità **da
    // lontano**: entra e esce con la stessa, al centesimo.
    const vIn = Math.hypot(tr.punti[0].vx, tr.punti[0].vy);
    const vOut = Math.hypot(tr.punti[tr.punti.length - 1].vx, tr.punti[tr.punti.length - 1].vy);
    didScritta(ctx, `entra a ${num(vIn, 2)}  ·  esce a ${num(vOut, 2)} km/s`, 12, 20,
      { colore: C.testo2, misura: 10, peso: 700, mono: true });
    didScritta(ctx, 'in mezzo accelera cadendo e rallenta risalendo: si riprende tutto', 12, 35,
      { colore: C.testo3, misura: 9, peso: 500 });
  }

  function fiondaDisegnaSole() {
    const t = didTela('did-fionda-sole', 1.1, 340, { lente: true });
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
      didScritta(ctx, `${num(v, 2)} km/s`, px + 9, pyS - 12, { colore: C.verde, misura: 11, peso: 700, mono: true });
    }
    didScritta(ctx, `entra a ${num(tr.primaSole, 2)}  ·  esce a ${num(tr.dopoSole, 2)} km/s`, 12, 20,
      { colore: tr.guadagno >= 0 ? C.verde : C.rosso, misura: 10, peso: 700, mono: true });
    didScritta(ctx, `${tr.guadagno >= 0 ? '+' : '−'}${num(Math.abs(tr.guadagno), 2)} km/s, e nessuno ha acceso niente`,
      12, 35, { colore: C.testo3, misura: 9, peso: 500 });
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
    const a = tr.punti[0], b = tr.punti[tr.punti.length - 1];
    const vMax = Math.max(Math.hypot(a.vx, a.vy + V), Math.hypot(b.vx, b.vy + V), V + fionda.vInf) || 1;
    const k = Math.min(L * 0.20, H * 0.40) / vMax;

    const disegna = (ox, oy, p, colore, titolo, valore) => {
      // la velocità del pianeta (il lato in comune)
      didFreccia(ctx, ox, oy, ox, oy - V * k, { colore: didVela(tr.colore, 0.95), spessore: 2.2, punta: 8 });
      // la velocità rispetto al pianeta, appoggiata in cima
      didFreccia(ctx, ox, oy - V * k, ox + p.vx * k, oy - V * k - p.vy * k,
        { colore: 'rgba(138, 180, 255, 0.95)', spessore: 2, punta: 7 });
      // la risultante: quella che si misura dal Sole
      didFreccia(ctx, ox, oy, ox + p.vx * k, oy - V * k - p.vy * k, { colore, spessore: 2.6, punta: 10 });
      didScritta(ctx, titolo, ox, oy + 20, { colore: C.testo2, misura: 11, allinea: 'center', peso: 700 });
      didScritta(ctx, valore, ox, oy + 36, { colore, misura: 12, allinea: 'center', peso: 700, mono: true });
    };

    const y = H * 0.72;
    disegna(L * 0.27, y, a, 'rgba(169, 180, 204, 0.95)', 'prima dell\'incontro', `${num(tr.primaSole, 2)} km/s`);
    disegna(L * 0.73, y, b, tr.guadagno >= 0 ? C.verde : C.rosso, 'dopo l\'incontro', `${num(tr.dopoSole, 2)} km/s`);

    // La legenda: tre righe, tre colori, e si smette di indovinare
    const voci = [
      [didVela(tr.colore, 0.95), `velocità di ${tr.nome} (${num(V, 1)} km/s)`],
      ['rgba(138, 180, 255, 0.95)', `velocità rispetto a ${tr.nome} — ruota soltanto, resta ${num(fionda.vInf, 1)} km/s`],
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
  const VOY_TAPPE = {
    v1: [
      { anno: 1977.68, dove: null,      v: 36.0, testo: 'Lancio da Cape Canaveral, 5 settembre 1977' },
      { anno: 1979.17, dove: 'Jupiter', v: 10.5, testo: 'Arrivo a Giove: la sonda ha rallentato salendo verso l\'esterno' },
      { anno: 1979.20, dove: 'Jupiter', v: 25.0, testo: 'Fionda di Giove, 5 marzo 1979: +15 km/s in un giorno' },
      { anno: 1980.85, dove: 'Saturn',  v: 14.5, testo: 'Arrivo a Saturno' },
      { anno: 1980.88, dove: 'Saturn',  v: 21.5, testo: 'Fionda di Saturno, 12 novembre 1980: la sonda esce dal piano dei pianeti' },
      { anno: 1990.5,  dove: null,      v: 17.4, testo: 'In viaggio verso il fuori: oggi va a 17 km/s ed è l\'oggetto umano più lontano' }
    ],
    v2: [
      { anno: 1977.62, dove: null,      v: 36.0, testo: 'Lancio, 20 agosto 1977 — sedici giorni prima della gemella' },
      { anno: 1979.50, dove: 'Jupiter', v: 10.0, testo: 'Arrivo a Giove' },
      { anno: 1979.53, dove: 'Jupiter', v: 25.0, testo: 'Fionda di Giove, 9 luglio 1979' },
      { anno: 1981.62, dove: 'Saturn',  v: 14.0, testo: 'Arrivo a Saturno' },
      { anno: 1981.65, dove: 'Saturn',  v: 20.5, testo: 'Fionda di Saturno, 26 agosto 1981: rotta su Urano' },
      { anno: 1986.05, dove: 'Uranus',  v: 17.0, testo: 'Arrivo a Urano' },
      { anno: 1986.07, dove: 'Uranus',  v: 21.0, testo: 'Fionda di Urano, 24 gennaio 1986: unica visita mai fatta' },
      { anno: 1989.63, dove: 'Neptune', v: 19.0, testo: 'Arrivo a Nettuno' },
      { anno: 1989.65, dove: 'Neptune', v: 17.4, testo: 'Nettuno, 25 agosto 1989: qui la fionda serve a FRENARE, per passare vicino a Tritone' },
      { anno: 1990.5,  dove: null,      v: 15.4, testo: 'Verso il fuori, a 15,4 km/s' }
    ]
  };

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
            tabella[k].push({ anno: a, x: v.x, y: v.y });
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
      out[k] = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
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
  const voyNodiCache = {};
  function voyNodi(chi) {
    if (voyNodiCache[chi]) return voyNodiCache[chi];
    const tappe = VOY_TAPPE[chi];
    const nodi = [{ anno: tappe[0].anno, p: { x: 0.6, y: 0.75 } }];
    tappe.forEach(t => {
      if (!t.dove) return;
      const p = voyPosizioni(t.anno)[t.dove];
      // due tappe sullo stesso pianeta (arrivo e fionda) sono lo stesso
      // punto: la seconda si scarta, se no l'interpolazione ci si ferma
      if (p && !(nodi.length > 1 && Math.abs(nodi[nodi.length - 1].anno - t.anno) < 0.1)) {
        nodi.push({ anno: t.anno, p });
      }
    });
    const ultimo = nodi[nodi.length - 1];
    // Dopo l'ultimo incontro si tira dritto verso fuori, lungo la
    // direzione in cui la fionda l'ha lanciata
    const dir = Math.hypot(ultimo.p.x, ultimo.p.y) || 1;
    nodi.push({
      anno: ultimo.anno + 12,
      p: { x: ultimo.p.x * (1 + 34 / dir), y: ultimo.p.y * (1 + 34 / dir) }
    });
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
        // curvando, come si arriva davvero.
        const p0 = nodi[Math.max(0, i - 2)].p, p1 = nodi[i - 1].p;
        const p2 = nodi[i].p, p3 = nodi[Math.min(nodi.length - 1, i + 1)].p;
        const f2 = f * f, f3 = f2 * f;
        const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * f +
          (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3);
        return { x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) };
      }
    }
    return nodi[nodi.length - 1].p;
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

  function voyNumeri() {
    const a = fionda.voyAnno;
    const anno = Math.floor(a);
    const mese = MESI[Math.min(11, Math.floor((a % 1) * 12))];
    scrivi('did-voy-quando', `${mese} ${anno}`);
    scrivi('did-voy-1', a < 1977.68 ? 'non ancora partita' : `${num(voyVelocita('v1', a), 1)} km/s`, 'blu');
    scrivi('did-voy-2', a < 1977.62 ? 'non ancora partita' : `${num(voyVelocita('v2', a), 1)} km/s`, 'verde');

    // La prossima tappa, di chiunque sia
    let prossima = null, diChi = '';
    ['v1', 'v2'].forEach(chi => {
      VOY_TAPPE[chi].forEach(t => {
        if (t.anno > a && t.dove && (!prossima || t.anno < prossima.anno)) { prossima = t; diChi = chi === 'v1' ? 'Voyager 1' : 'Voyager 2'; }
      });
    });
    scrivi('did-voy-prossimo', prossima ? `${diChi} → ${CORPI[prossima.dove].nome}` : 'nessuno: sono uscite dal Sistema Solare');
    const lettura = $('did-voy-lettura');
    if (lettura) lettura.textContent = `${anno}`;

    // La spiegazione segue la tappa più vicina appena passata
    let ultima = null, chiUltima = '';
    ['v1', 'v2'].forEach(chi => {
      VOY_TAPPE[chi].forEach(t => {
        if (t.anno <= a && (!ultima || t.anno > ultima.anno)) { ultima = t; chiUltima = chi === 'v1' ? 'Voyager 1' : 'Voyager 2'; }
      });
    });
    const sp = $('did-voy-spiega');
    if (sp && ultima) sp.innerHTML = `<strong>${chiUltima}</strong> — ${ultima.testo}.`;
  }

  function voyDisegnaMappa() {
    const t = didTela('did-voy-tela', 1.45, 430, { lente: true });
    if (!t) return;
    const { ctx, L, H } = t;
    didSfondo(ctx, L, H);
    const pos = voyPosizioni(fionda.voyAnno);
    const scala = Math.min(L, H) * 0.45 / 32;   // Nettuno sta a 30 UA
    const cx = L / 2, cy = H / 2;
    const X = (x) => cx + x * scala;
    const Y = (y) => cy - y * scala;

    ['Jupiter', 'Saturn', 'Uranus', 'Neptune'].forEach(k => {
      didCerchio(ctx, cx, cy, CORPI[k].a * scala, 'rgba(148, 168, 214, 0.12)', 1);
    });
    didCorpo(ctx, cx, cy, 7, C.sole, { alone: 3.6 });

    ['Jupiter', 'Saturn', 'Uranus', 'Neptune'].forEach(k => {
      const p = pos[k];
      if (!p) return;
      const x = X(p.x), y = Y(p.y);
      didCorpo(ctx, x, y, k === 'Jupiter' ? 6 : 5, CORPI[k].colore, { anelli: k === 'Saturn' });
      // Il nome va messo verso fuori, lungo il raggio: nel 1978 Giove e
      // Saturno erano a pochi gradi l'uno dall'altro e le due scritte
      // finivano una sopra l'altra («SaturnGiove»). Spingendole in fuori
      // si separano da sole, perché i due pianeti stanno su cerchi
      // diversi.
      const d = Math.hypot(p.x, p.y) || 1;
      const ux = p.x / d, uy = p.y / d;
      didScritta(ctx, CORPI[k].nome, x + ux * 14, y - uy * 14 + 4,
        { colore: C.testo2, misura: 10, allinea: ux < -0.25 ? 'right' : ux > 0.25 ? 'left' : 'center' });
    });

    // Le due scie, ricostruite dall'inizio fino all'anno mostrato
    [['v1', C.bluChiaro], ['v2', C.verde]].forEach(([chi, col]) => {
      const punti = [];
      for (let a = VOY_TAPPE[chi][0].anno; a <= fionda.voyAnno; a += 0.05) {
        const p = voyDove(chi, a);
        punti.push({ x: X(p.x), y: Y(p.y) });
      }
      didPercorso(ctx, punti, { colore: didVela(col, 0.55), spessore: 1.6 });
      if (fionda.voyAnno >= VOY_TAPPE[chi][0].anno) {
        const p = voyDove(chi, fionda.voyAnno);
        didCorpo(ctx, X(p.x), Y(p.y), 4, col, { alone: 3 });
        // Una sopra e una sotto: nei primi mesi le due sonde sono quasi
        // nello stesso punto, e i due nomi si sovrapporrebbero
        didScritta(ctx, chi === 'v1' ? 'Voyager 1' : 'Voyager 2',
          X(p.x) + 13, Y(p.y) + (chi === 'v1' ? -14 : 24),
          { colore: col, misura: 10, peso: 700 });
      }
    });

    didScritta(ctx, `${Math.floor(fionda.voyAnno)}`, 12, 24, { colore: C.testo, misura: 18, peso: 700, mono: true });
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

    [['v1', '#8ab4ff'], ['v2', '#34d399']].forEach(([chi, col]) => {
      const punti = [];
      for (let a = VOY_TAPPE[chi][0].anno; a <= A1; a += 0.02) punti.push({ x: X(a), y: Y(voyVelocita(chi, a)) });
      didPercorso(ctx, punti, { colore: col, spessore: 1.9 });
      // I gradini: gli incontri, dove la curva salta
      VOY_TAPPE[chi].forEach(tp => {
        if (!tp.dove) return;
        didCerchio(ctx, X(tp.anno), Y(tp.v), 3, col, 1.4);
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
    const fase = 180 - omega * tVoloGiorni;          // angolo di anticipo della meta al lancio
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
    scrivi('did-lancio-angolo', `${num(c.fase, 1)}° ${c.fase >= 0 ? 'avanti alla Terra' : 'dietro alla Terra'}`);
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
    const scartoGradi = lancio.scarto * (c.omega - c.omegaTerra);
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
      sp.innerHTML = `Per arrivare a ${nome} la sonda deve percorrere <strong>mezza ellisse</strong> col
        perielio sull'orbita della Terra e l'afelio su quella di ${nome}: ci mette
        <strong>${Math.round(c.tVoloGiorni)} giorni</strong>, e questo numero non si può cambiare — lo
        fissa Keplero. Quindi ${nome} al momento del lancio deve trovarsi <strong>${num(c.fase, 0)}°
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
      sp.innerHTML = `La sonda è in caduta libera. Dopo la spinta iniziale di
        <strong>${num(c.dv1, 2)} km/s</strong> non accende più niente: sale verso l'afelio rallentando
        (seconda legge di Keplero), e quando ci arriva le servirà un'altra spinta di
        ${num(c.dv2, 2)} km/s per non ricadere indietro.`;
    }
  }

  function lancioDisegna() {
    const t = didTela('did-lancio-tela', 1.35, 470, { lente: true });
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
    if (lancio.partito) {
      const punti = [];
      for (let i = 0; i <= 80; i++) {
        const f = (i / 80) * lancio.t;
        const p = kepPunto(f * Math.PI, et);
        const segno = c.interno ? -1 : 1;
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
  // 8. IL BANCO — linguette, costruzione e ciclo di disegno
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
    // Il banco nuovo parte dall'alto: cambiando esperimento a metà pagina
    // ci si ritrovava in mezzo ai comandi di qualcosa che non si era
    // ancora visto
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
  // 9. AVVIO E SPEGNIMENTO — li chiama mostraVista() in app.js
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
    stato.acceso = false;
    if (stato.raf) { cancelAnimationFrame(stato.raf); stato.raf = null; }
    const l = labAttivo();
    if (l && l.esce) { try { l.esce(); } catch (e) { /* niente */ } }
  };

  // Un gancio per chi ridisegna dopo una rotazione: le tele si rimisurano
  // da sole a ogni fotogramma, quindi qui non c'è quasi niente da fare —
  // basta buttare via lo sfondo stellato, che è l'unica cosa in cache
  window.didatticaRidimensiona = function () { cacheStelle.chiave = ''; };

})();
