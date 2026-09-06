/* visione.js — Il motore di riconoscimento e inseguimento della realtà
 * aumentata. Prefisso `vis`.
 *
 * ────────────────────────────────────────────────────────────────────────
 * IL PROBLEMA, DETTO COME SI VEDE
 *
 * Con la fotocamera accesa il planetario disegna il cielo calcolato sopra
 * l'immagine vera. La geometria è giusta — la proiezione è rettilinea come
 * quella dell'obiettivo (§`skyProietta`), il campo lo detta l'obiettivo e non
 * la preferenza (§`skyCampoFotocamera`) — eppure l'aereo disegnato non sta
 * *sull'* aereo: sta lì accanto, qualche grado più in là. E appena si muove
 * il braccio scivola.
 *
 * Le ragioni sono tre, e sono di tre nature diverse. Vale la pena tenerle
 * separate, perché la cura è diversa per ognuna e mescolarle è il modo in cui
 * questo genere di allineamento non converge mai:
 *
 *   1. L'ASSETTO. La bussola sbaglia. Nel migliore dei casi di un grado, con
 *      del ferro vicino di dieci o venti. La §7.1-quinquies di `app.js` fa
 *      quello che si può fare senza guardare fuori — quaternione di sistema,
 *      ponte del giroscopio, taratura su un astro a mano — ma resta un errore
 *      che nessun sensore può togliere, perché nessun sensore sa dov'è il
 *      Nord vero meglio del campo magnetico che ha attorno.
 *
 *   2. L'OBIETTIVO. Quanto riprenda davvero questa fotocamera il browser non
 *      lo dice: né `getSettings()` né `getCapabilities()` espongono il campo
 *      visivo. Si assume 65° sul lato lungo e si spera. Se l'obiettivo è un
 *      grandangolo da 78° il centro combacia lo stesso e i bordi no — ed è
 *      l'errore che sembra un difetto del puntamento, perché cresce
 *      allontanandosi dal centro.
 *
 *   3. L'OGGETTO. Un aereo ADS-B non è dove il feed dice: è dove sarà quando
 *      la sua posizione, vecchia di qualche secondo, viene propagata dalla
 *      rotta. A duecentocinquanta metri al secondo, tre secondi sono
 *      ottocento metri — a cinque chilometri di distanza sono **nove gradi**.
 *      Questo errore è di quell'aereo e non degli altri: non è un errore di
 *      assetto, e correggere l'assetto per farlo tornare vorrebbe dire
 *      storcere tutto il resto del cielo.
 *
 * Un solo numero non può curarle tutte e tre, e questo modulo non ci prova:
 * ne stima **tre**, ognuno dal dato che lo può misurare.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LA CURA: GUARDARE L'IMMAGINE
 *
 * Nel fotogramma della fotocamera quegli oggetti ci sono davvero. La Luna è
 * un disco, un pianeta un punto luminoso, un aereo di notte una lucina che
 * lampeggia e di giorno una sagoma scura contro il cielo chiaro. Sono le cose
 * più facili da riconoscere che esistano — punti di contrasto su un fondo
 * quasi uniforme — e il cielo calcolato dice già **dove cercarle**, a meno
 * dell'errore che stiamo cercando di misurare.
 *
 * Quindi: si rileva, si associa, si risolve.
 *
 *   §3-§4  Si prende il fotogramma, si stima il fondo e si tengono le macchie
 *          che dal fondo si staccano — in tutt'e due i versi, perché di
 *          giorno un aereo è **più scuro** del cielo e cercare solo il chiaro
 *          vuol dire non trovarlo mai.
 *   §5-§6  Si associa ogni macchia al candidato che il cielo calcolato mette
 *          lì vicino, con un cancello che si stringe man mano che ci si fida.
 *   §7     Dalle coppie astro↔macchia si risolve la rotazione che le fa
 *          combaciare tutte insieme (Wahba, linearizzato: vedi §7).
 *   §8     Dal rapporto fra le distanze osservate e quelle previste si ricava
 *          la focale vera, cioè si **tara l'obiettivo da sé** invece di
 *          chiedere all'utente di pizzicare finché non torna.
 *   §9     Quello che resta, oggetto per oggetto, è l'errore di quell'oggetto:
 *          diventa la sua ancora, e la sua etichetta ci si incolla sopra.
 *
 * ────────────────────────────────────────────────────────────────────────
 * PERCHÉ RESTA ALLINEATO QUANDO SI MUOVE IL TELEFONO — la riga che conta
 *
 * Questo è il punto che distingue un aggancio da un trucco, e la risposta è
 * che **non si insegue niente a ogni fotogramma**.
 *
 * La tentazione è di rifare il riconoscimento sessanta volte al secondo e
 * incollare l'etichetta sulla macchia. Non funziona, e si vede subito: mentre
 * il telefono ruota l'immagine è mossa, le macchie si allungano e per metà
 * spariscono, il riconoscimento perde l'aggancio proprio nel momento in cui
 * lo si sta guardando — cioè il difetto che si voleva togliere, con in più
 * dei salti.
 *
 * La divisione giusta è quella della navigazione inerziale, e sta in una
 * frase: **il giroscopio dà il movimento, la vista dà la mira**. Il
 * giroscopio è velocissimo e preciso sul breve, ma non sa dov'è il Nord;
 * l'immagine sa esattamente dov'è il Nord, ma è lenta e si sfoca appena ci si
 * muove. Quindi la correzione che questo modulo calcola non è la posizione di
 * un'etichetta: è una **rotazione del mondo**, un errore di assetto che
 * cambia lentamente (il ferro nella stanza non si sposta). La si misura da
 * fermi, dove l'immagine è nitida, e da quel momento in poi la porta avanti
 * il giroscopio: girando il telefono l'etichetta resta incollata perché è
 * tutto il sistema di riferimento a essere stato raddrizzato, non lei.
 *
 * Da qui i due cancelli del §10: mentre il telefono ruota più in fretta di
 * `VIS_MOTO_MAX_GRADI_S` non si misura niente (si tiene quello che si sa), e
 * quando lo si misura si confronta l'immagine con la posa che il telefono
 * aveva `VIS_LATENZA_MS` fa, perché una fotocamera consegna il fotogramma
 * dopo averlo preso e con la testa che gira quella differenza è gradi.
 *
 * ────────────────────────────────────────────────────────────────────────
 * COSA SUCCEDE QUANDO NON C'È NIENTE DA RICONOSCERE
 *
 * Un cielo coperto, un muro davanti, la fotocamera puntata per terra: non si
 * trova nessun riferimento. Allora non succede niente — si tiene l'ultima
 * correzione, che era buona, e la si lascia invecchiare piano
 * (`VIS_CORREZIONE_VITA_MS`). Questo modulo non può **peggiorare**
 * l'allineamento: senza riferimenti non scrive, e spento non esiste — il
 * planetario resta esattamente quello di prima.
 */

(function () {
  'use strict';

  // ===================================================================
  // §1. Lo stato e le costanti
  // ===================================================================

  const D2R = Math.PI / 180, R2D = 180 / Math.PI;

  // Il fotogramma su cui si lavora, ed è un **conto di pixel** e non una
  // larghezza. Sembra un dettaglio e non lo è: uno schermo di telefono è
  // alto il doppio che largo, quindi fissando la larghezza a duecento si
  // finisce con ottantottomila pixel da rileggere e filtrare a ogni giro —
  // misurato in un browser vero, **dieci millisecondi e mezzo**, cioè più di
  // mezzo fotogramma, con la cadenza che si autolimitava a cinque giri al
  // secondo per non farsi sentire. Trentamila pixel costano un terzo e
  // bastano largamente: una stella è un punto, e un punto a centoventi pixel
  // di larghezza è un punto anche a duemila — mentre il centroide pesato (§4)
  // porta comunque la misura sotto al pixel, cioè attorno al ventesimo di
  // grado, che è un decimo del diametro della Luna.
  const VIS_PIXEL = 30000;
  const VIS_LARGO_MIN = 96, VIS_LARGO_MAX = 240;
  function visLatoRidotto(cw, ch) {
    const l = Math.round(Math.sqrt(VIS_PIXEL * cw / Math.max(1, ch)));
    return Math.max(VIS_LARGO_MIN, Math.min(VIS_LARGO_MAX, l));
  }

  // Ogni quanto si guarda l'immagine. Non serve di più: la correzione che si
  // sta misurando è un errore di assetto, e un errore di assetto non cambia
  // dieci volte al secondo — cambia quando ci si sposta o quando si avvicina
  // una calamita. Fra una misura e l'altra il movimento lo porta il
  // giroscopio, che va a sessanta.
  const VIS_CADENZA_MS = 80;
  // Se il giro costa più di così, si rallenta: su un telefono lento un
  // fotogramma perso ogni tre si vede, un aggancio più pigro no.
  const VIS_COSTO_ALTO_MS = 9;
  const VIS_CADENZA_MAX_MS = 320;

  // Il fondo si stima con una scatola larga così (in pixel del fotogramma
  // ridotto). Deve essere molto più grande delle macchie che si cercano — se
  // no la macchia entra nella stima del proprio fondo e si cancella da sé —
  // e molto più piccola delle strutture del cielo (il gradiente del tramonto,
  // la cupola di luce di un paese), che invece devono finirci dentro.
  const VIS_FONDO_RAGGIO = 7;

  // Quanto deve staccarsi una macchia dal fondo per essere una macchia: si
  // misura in scarti quadratici medi del residuo, che è il modo di non dover
  // scegliere una soglia in livelli — un cielo notturno e un cielo di
  // mezzogiorno hanno rumori diversi di un ordine di grandezza.
  const VIS_SOGLIA_SIGMA = 3.6;
  const VIS_SOGLIA_MIN = 3.5;      // livelli su 255: sotto, è grana del sensore
  const VIS_MACCHIE_MAX = 40;
  const VIS_CENTROIDE_RAGGIO = 4;  // px del fotogramma ridotto

  // I cancelli dell'associazione, in gradi. Il primo vale finché non ci si
  // fida ancora (la bussola può sbagliare di venti gradi con del ferro
  // vicino), il secondo appena l'aggancio tiene. Stringere subito vorrebbe
  // dire non agganciarsi mai; non stringere mai vorrebbe dire agganciarsi a
  // un lampione.
  const VIS_CANCELLO_LARGO = 12;
  const VIS_CANCELLO_STRETTO = 2.2;
  // Un aereo porta il suo errore, e non è piccolo: la propagazione di una
  // lettura vecchia di qualche secondo, da vicino, vale gradi. Il suo
  // cancello è quindi più largo, e quello che ci trova dentro non tocca
  // l'assetto (§9) — diventa l'ancora di quell'aereo e basta.
  const VIS_CANCELLO_AEREO = 9;

  // Due macchie ugualmente plausibili sotto lo stesso candidato non sono un
  // riferimento: sono una moneta lanciata. Se la seconda sta entro questo
  // fattore dalla prima, la coppia si scarta — meglio nessun aggancio che un
  // aggancio sbagliato, perché un aggancio sbagliato *sposta tutto il cielo*.
  const VIS_AMBIGUITA = 1.7;

  // Quanto può valere, in tutto, la correzione dell'assetto. Oltre non è più
  // una bussola imprecisa: è un'associazione sbagliata, e va rifiutata.
  const VIS_CORREZIONE_MAX = 25;
  // Con che calma la correzione insegue la misura. Mezzo secondo: abbastanza
  // lenta da non ballare col rumore di una singola misura, abbastanza svelta
  // da assestarsi mentre uno alza il telefono.
  const VIS_TAU_CORREZIONE_S = 0.5;
  // Quanto vive una correzione senza più riferimenti. Non si butta: è vera, e
  // il ferro della stanza non si sposta. Ma dopo qualche minuto è meglio
  // tornare a fidarsi della bussola che di una misura di dieci minuti fa.
  const VIS_CORREZIONE_VITA_MS = 180000;

  // Il movimento oltre il quale non si misura più (vedi il cappello).
  const VIS_MOTO_MAX_GRADI_S = 20;
  // Di quanto la fotocamera consegna in ritardo. Sessanta millisecondi è la
  // media misurata su telefoni di fascia media fra l'istante di scatto e la
  // disponibilità del fotogramma; a dieci gradi al secondo sono sei decimi di
  // grado, cioè più di una Luna piena.
  const VIS_LATENZA_MS = 60;
  const VIS_POSE_TENUTE = 40;

  // La taratura della focale si muove piano e di poco: è una proprietà
  // dell'obiettivo, non una cosa che cambia. Un passo grosso su una misura
  // sbagliata farebbe respirare tutto il cielo.
  const VIS_SCALA_PASSO_MAX = 0.02;
  const VIS_SCALA_MIN = 0.72, VIS_SCALA_MAX = 1.38;
  const VIS_SCALA_BASE_PX = 60;    // sotto, due riferimenti sono troppo vicini

  // Le ancore dei singoli oggetti.
  const VIS_TAU_ANCORA_S = 0.28;   // svelta: è lei a incollare l'etichetta
  const VIS_ANCORA_VITA_MS = 9000; // poi si scioglie: un aereo si è spostato
  const VIS_ANCORA_MAX = 14;       // gradi: oltre non è quell'aereo

  // Quante misure di fila servono per dichiarare l'aggancio, e quante ne
  // bastano per perderlo. Asimmetriche di proposito: un aggancio che si
  // accende e si spegne è peggio di nessun aggancio.
  const VIS_CONFERME = 3;
  const VIS_PERDITE = 12;

  // Riferimenti del paesaggio: angoli e bordi netti di tetti, montagne,
  // piante e muri. Non hanno coordinate astronomiche, quindi non possono
  // trovare il Nord da soli; possono però tenere ferma una mira già acquisita
  // e colmare i minuti in cui di notte nessun astro è leggibile dalla camera.
  // Si cercano in tutto il fotogramma, deliberatamente anche sotto la linea
  // dell'orizzonte.
  const VIS_SCENA_MAX = 28;
  const VIS_SCENA_DISTANZA = 10;
  const VIS_SCENA_RICERCA = 6;
  const VIS_SCENA_PATCH = 2;

  const stato = {
    attivo: false,          // il motore gira
    acceso: true,           // lo si vuole (interruttore dell'utente)
    tela: null,             // la tela di lavoro, piccola
    ctx: null,
    largo: 0, alto: 0,
    prossimoGiro: 0,
    cadenza: VIS_CADENZA_MS,
    costo: 0,               // millisecondi dell'ultimo giro
    pose: [],               // la storia delle pose, per la latenza
    correzione: null,       // matrice 3x3 nel mondo, o null
    correzioneQuando: 0,
    conferme: 0,
    perdite: 0,
    agganciato: false,
    riferimenti: 0,         // quanti astri hanno agganciato all'ultimo giro
    scarto: 0,              // scarto quadratico medio delle coppie, in gradi
    motivo: 'spento',       // perché non si è agganciati
    ancore: new Map(),      // id → { dAz, dAlt, quando, visto }
    segni: [],              // dove disegnare le parentesi dell'aggancio
    macchie: 0,             // quante macchie ha visto l'ultimo giro
    aereiAgganciati: 0,     // quanti aerei hanno trovato la loro sagoma
    scena: null,            // fotogramma e punti fermi del paesaggio
    riferimentiScena: 0,
    scala: 1,               // l'ultima correzione di focale applicata
    motoGradiS: 0,
    ultimoGiro: 0,
    guastoDetto: false
  };

  // --- Algebra: le rotazioni, scritte in tre righe per tre ---------------

  function versore(v) {
    const n = Math.hypot(v[0], v[1], v[2]);
    return n > 1e-12 ? [v[0] / n, v[1] / n, v[2] / n] : [0, 0, 1];
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function applica(R, v) {
    return [
      R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2],
      R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2],
      R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]
    ];
  }
  function moltiplica(A, B) {
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      M[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
    }
    return M;
  }
  function identita() { return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; }

  // Da vettore rotazione (asse per angolo, in radianti) a matrice: Rodrigues.
  // Si usa la formula esatta e non l'approssimazione `I + [ω]×`, che per gli
  // angoli in gioco sarebbe indistinguibile ma non è **ortogonale** — e una
  // matrice non ortogonale, moltiplicata addosso a sé stessa un fotogramma
  // dopo l'altro, deforma il cielo invece di ruotarlo.
  function rodrigues(w) {
    const t = Math.hypot(w[0], w[1], w[2]);
    if (t < 1e-12) return identita();
    const k = [w[0] / t, w[1] / t, w[2] / t];
    const c = Math.cos(t), s = Math.sin(t), u = 1 - c;
    return [
      [c + k[0] * k[0] * u, k[0] * k[1] * u - k[2] * s, k[0] * k[2] * u + k[1] * s],
      [k[1] * k[0] * u + k[2] * s, c + k[1] * k[1] * u, k[1] * k[2] * u - k[0] * s],
      [k[2] * k[0] * u - k[1] * s, k[2] * k[1] * u + k[0] * s, c + k[2] * k[2] * u]
    ];
  }

  // Di quanti gradi ruota una matrice di rotazione.
  function angoloDi(R) {
    const tr = R[0][0] + R[1][1] + R[2][2];
    return Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) * R2D;
  }

  // Scala una rotazione: la stessa rotazione, di una frazione dell'angolo. È
  // il modo di fare una media pesata fra due assetti senza passare per i
  // quaternioni — che qui servirebbero solo a questo.
  function scalaRotazione(R, k) {
    const tr = R[0][0] + R[1][1] + R[2][2];
    const t = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
    if (t < 1e-9) return identita();
    const s = 2 * Math.sin(t);
    const asse = [
      (R[2][1] - R[1][2]) / s,
      (R[0][2] - R[2][0]) / s,
      (R[1][0] - R[0][1]) / s
    ];
    const a = t * k;
    return rodrigues([asse[0] * a, asse[1] * a, asse[2] * a]);
  }

  function angoloFra(a, b) {
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * R2D;
  }

  function vettoreDa(azGradi, altGradi) {
    const az = azGradi * D2R, alt = altGradi * D2R;
    return [Math.sin(az) * Math.cos(alt), Math.cos(az) * Math.cos(alt), Math.sin(alt)];
  }
  function azAltDi(v) {
    return {
      az: (Math.atan2(v[0], v[1]) * R2D + 360) % 360,
      alt: Math.asin(Math.max(-1, Math.min(1, v[2]))) * R2D
    };
  }
  // Lo scarto fra due azimut, portato in [-180, 180]. Il giro è la trappola
  // di sempre: 359° e 1° distano due gradi, non trecentocinquantotto.
  function scartoAz(a, b) {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  // ===================================================================
  // §2. Il fotogramma ridotto
  // ===================================================================
  //
  // Il video è disegnato con `object-fit: cover`: ingrandito quel tanto che
  // basta a coprire il riquadro, e quel che avanza tagliato via. Qui si
  // prende **solo il ritaglio che si vede**, per due ragioni che vanno
  // insieme: una macchia fuori dallo schermo non è associabile a niente (non
  // c'è nessun candidato disegnato lì), e soprattutto la mappa fra il pixel
  // del fotogramma ridotto e il pixel del riquadro diventa una moltiplicazione
  // — se si prendesse il fotogramma intero servirebbe portarsi dietro anche
  // il ritaglio, ed è il posto in cui un fattore di scala si sbaglia in
  // silenzio.

  function geometriaVideo(video) {
    const vw = video.videoWidth, vh = video.videoHeight;
    const cw = sky.larghezza, ch = sky.altezza;
    if (!vw || !vh || !cw || !ch) return null;
    const scala = Math.max(cw / vw, ch / vh);
    const sw = Math.min(vw, cw / scala);
    const sh = Math.min(vh, ch / scala);
    return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh, cw, ch };
  }

  // Il fotogramma, in luminanza. Torna anche i due fattori che riportano un
  // pixel di qui a un pixel del riquadro.
  function prendiFotogramma() {
    const video = document.getElementById('skymap-video');
    if (!video || !video.videoWidth || video.readyState < 2) return null;
    const g = geometriaVideo(video);
    if (!g) return null;

    const largo = visLatoRidotto(g.cw, g.ch);
    const alto = Math.max(24, Math.round(largo * g.ch / g.cw));
    if (!stato.tela || stato.largo !== largo || stato.alto !== alto) {
      stato.tela = document.createElement('canvas');
      stato.tela.width = largo;
      stato.tela.height = alto;
      // `willReadFrequently`: senza, ogni `getImageData` costringe il browser
      // a riportare la tela dalla GPU alla memoria, ed è il grosso del costo.
      stato.ctx = stato.tela.getContext('2d', { willReadFrequently: true });
      stato.largo = largo;
      stato.alto = alto;
    }
    const ctx = stato.ctx;
    if (!ctx) return null;
    try {
      ctx.drawImage(video, g.sx, g.sy, g.sw, g.sh, 0, 0, largo, alto);
    } catch (e) {
      return null;   // il fotogramma non è ancora decodificabile
    }
    let dati;
    try {
      dati = ctx.getImageData(0, 0, largo, alto).data;
    } catch (e) {
      // Una tela contaminata non si può leggere. Non capita con getUserMedia
      // — un MediaStream è della stessa origine — ma se capitasse, il motore
      // si spegne invece di sollevare un'eccezione dentro al ciclo di disegno.
      return null;
    }
    const luma = scorta('luma', largo * alto, Float32Array);
    for (let i = 0, p = 0; i < luma.length; i++, p += 4) {
      luma[i] = 0.299 * dati[p] + 0.587 * dati[p + 1] + 0.114 * dati[p + 2];
    }
    return { luma, largo, alto, perPixelX: g.cw / largo, perPixelY: g.ch / alto };
  }

  // ===================================================================
  // §3. Il fondo, e il residuo
  // ===================================================================
  //
  // Una soglia assoluta sulla luminosità non serve a niente: il Sole di
  // mezzogiorno e una stella di seconda grandezza stanno a duecento livelli
  // di distanza, e in mezzo c'è tutto. Quello che ha sempre lo stesso
  // significato è il **contrasto locale**: quanto un pixel si stacca da
  // com'è il cielo lì attorno. Il fondo si stima con una media a scatola —
  // che con l'immagine integrale costa due somme per pixel, qualunque sia il
  // raggio — e il residuo è la differenza.
  //
  // Il residuo si tiene **con il segno**. È la riga che fa funzionare questo
  // modulo di giorno: di notte un aereo è una lucina (residuo positivo), di
  // giorno è una sagoma scura contro il cielo (residuo negativo), e un
  // rivelatore che cerca solo il chiaro, di giorno, non trova mai niente e
  // non lo dice.

  // Le tre memorie di lavoro si tengono fra un giro e l'altro. Non è
  // avarizia: sono un quarto di megabyte a testa, e allocarle dodici volte al
  // secondo vuol dire tre megabyte al secondo di spazzatura da raccogliere —
  // e il raccoglitore, su un telefono, si prende il suo tempo proprio mentre
  // il cielo scorre. Si rifanno solo quando cambia la misura del fotogramma.
  function scorta(nome, lunghezza, Tipo) {
    const c = stato.scorte || (stato.scorte = {});
    if (!c[nome] || c[nome].length !== lunghezza) c[nome] = new Tipo(lunghezza);
    return c[nome];
  }

  function immagineIntegrale(luma, L, H) {
    const S = scorta('integrale', (L + 1) * (H + 1), Float64Array);
    // La prima riga e la prima colonna restano zero per costruzione, ma una
    // memoria riusata porta dentro i numeri del giro prima: si azzerano.
    S.fill(0);
    for (let y = 0; y < H; y++) {
      let riga = 0;
      for (let x = 0; x < L; x++) {
        riga += luma[y * L + x];
        S[(y + 1) * (L + 1) + (x + 1)] = S[y * (L + 1) + (x + 1)] + riga;
      }
    }
    return S;
  }

  function visResiduo(luma, L, H, raggio) {
    const S = immagineIntegrale(luma, L, H);
    const res = scorta('residuo', L * H, Float32Array);
    const somma = (x0, y0, x1, y1) =>
      S[y1 * (L + 1) + x1] - S[y0 * (L + 1) + x1] - S[y1 * (L + 1) + x0] + S[y0 * (L + 1) + x0];
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - raggio), y1 = Math.min(H, y + raggio + 1);
      for (let x = 0; x < L; x++) {
        const x0 = Math.max(0, x - raggio), x1 = Math.min(L, x + raggio + 1);
        const n = (x1 - x0) * (y1 - y0);
        res[y * L + x] = luma[y * L + x] - somma(x0, y0, x1, y1) / n;
      }
    }
    return res;
  }

  // Lo scarto tipico del residuo, stimato in modo che una macchia grossa non
  // lo faccia salire: la **mediana degli assoluti** al posto della media
  // quadratica. Con la seconda, il Sole nel fotogramma alzerebbe la soglia
  // fino a nascondere tutto il resto — e la costante 1,4826 è quella che
  // riporta la mediana degli assoluti a uno scarto quadratico medio quando il
  // rumore è gaussiano, cioè quasi sempre.
  function visRumore(res) {
    // Si campiona: su ventimila pixel una stima su un ottavo è identica e
    // costa un ottavo.
    const passo = Math.max(1, Math.floor(res.length / 4096));
    const campioni = [];
    for (let i = 0; i < res.length; i += passo) campioni.push(Math.abs(res[i]));
    if (!campioni.length) return 1;
    campioni.sort((a, b) => a - b);
    const mediana = campioni[campioni.length >> 1];
    return Math.max(0.4, mediana * 1.4826);
  }

  // ===================================================================
  // §4. Le macchie
  // ===================================================================
  //
  // Un massimo locale sopra soglia, e attorno a lui il centroide pesato dei
  // pixel che gli appartengono. Il centroide è quello che porta la misura
  // **sotto al pixel**: un punto luminoso su un sensore si spalma su tre o
  // quattro pixel, e il baricentro di quei quattro sa dire dov'era il punto
  // con un decimo di pixel di errore. È la stessa cosa che fa un astrometrista
  // con una lastra, ed è il motivo per cui duecento pixel di larghezza bastano.

  function visRilevaMacchie(luma, L, H, opz) {
    const o = opz || {};
    const raggioFondo = o.raggioFondo || VIS_FONDO_RAGGIO;
    const res = o.residuo || visResiduo(luma, L, H, raggioFondo);
    const rumore = o.rumore || visRumore(res);
    const soglia = Math.max(o.sogliaMin || VIS_SOGLIA_MIN, (o.sigma || VIS_SOGLIA_SIGMA) * rumore);
    const rc = o.raggioCentroide || VIS_CENTROIDE_RAGGIO;
    const bordo = 2;
    const grezze = [];

    for (let y = bordo; y < H - bordo; y++) {
      for (let x = bordo; x < L - bordo; x++) {
        const v = res[y * L + x];
        const a = Math.abs(v);
        if (a < soglia) continue;
        // Massimo locale nel suo 3×3, nel verso del proprio segno. Il
        // confronto è sul valore con segno e non sul modulo: due macchie di
        // segno opposto attaccate (il bordo scuro attorno a una luce) non si
        // devono spegnere a vicenda.
        let estremo = true;
        for (let dy = -1; dy <= 1 && estremo; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const w = res[(y + dy) * L + (x + dx)];
            if (v > 0 ? w > v : w < v) { estremo = false; break; }
          }
        }
        if (!estremo) continue;
        grezze.push({ x, y, picco: a, segno: v > 0 ? 1 : -1 });
      }
    }
    grezze.sort((a, b) => b.picco - a.picco);

    // Soppressione dei non massimi, e **l'alone**.
    //
    // La prima regola è ovvia: due picchi dentro allo stesso raggio sono la
    // stessa macchia vista due volte (una sorgente satura ha spesso due pixel
    // identici in cima).
    //
    // La seconda no, e senza di lei questo rivelatore non funziona. Stimare
    // il fondo con una media a scatola vuol dire che una macchia **alza il
    // fondo attorno a sé**: la media della scatola centrata a otto pixel di
    // distanza contiene ancora la macchia, quindi lì il residuo diventa
    // negativo. Attorno a ogni stella si forma un anello scuro, e attorno a
    // ogni aereo controluce un anello chiaro — e sono sopra soglia. Misurato
    // sul banco: due sorgenti sole producevano **undici** macchie, nove delle
    // quali erano i loro aloni, e le nove finivano dritte nell'associazione a
    // fare da riferimenti falsi.
    //
    // La regola che le toglie senza togliere niente di vero è il segno: un
    // alone ha sempre il segno **opposto** a quello che l'ha prodotto, mentre
    // due astri vicini hanno lo stesso segno. Quindi si scarta la candidata
    // di segno contrario che casca dentro all'alone di una macchia già
    // accettata — e due stelle della cintura di Orione, che distano un grado
    // e mezzo e sono tutt'e due chiare, restano due.
    const macchie = [];
    const raggioAlone = raggioFondo * 2;
    for (const g of grezze) {
      if (macchie.length >= (o.massimo || VIS_MACCHIE_MAX)) break;
      let vicina = false;
      for (const m of macchie) {
        const d = Math.hypot(m.xg - g.x, m.yg - g.y);
        if (d < rc) { vicina = true; break; }
        if (m.segno !== g.segno && d < raggioAlone) { vicina = true; break; }
      }
      if (vicina) continue;

      // Il centroide, pesato sul residuo che supera metà soglia: sotto quel
      // livello sono le ali del rumore, e includerle tira il baricentro verso
      // il centro della finestra qualunque cosa ci sia dentro.
      //
      // E si **itera**, il che sembra una raffinatezza e non lo è. Un punto
      // luminoso ha il suo massimo al centro e una passata basta; un disco
      // largo — la Luna, il Sole — no: stimando il fondo con una scatola, al
      // centro del disco la scatola è quasi tutta disco, quindi il fondo
      // stimato è alto e il residuo lì **si abbassa**. Il massimo del residuo
      // non casca al centro ma su un anello, la finestra si centra su un
      // punto di quell'anello, e il baricentro che ne esce è tirato in fuori.
      // Misurato in un browser vero su una Luna larga otto pixel: **quattro
      // pixel di schermo** di errore sistematico, cioè tre decimi di grado —
      // e sistematico vuol dire che non si media via, ci si assesta sopra.
      // Ricentrando la finestra sul baricentro appena trovato l'errore
      // sparisce in due o tre passate, perché una finestra centrata su un
      // anello simmetrico dà il centro dell'anello.
      const mezza = soglia * 0.5;
      let cx = g.x, cy = g.y, sp = 0, n = 0, largo = 1;
      for (let passata = 0; passata < 3; passata++) {
        const raggio = passata === 0 ? rc : Math.max(rc, Math.min(rc * 3, Math.ceil(largo * 2.2)));
        const cxi = Math.round(cx), cyi = Math.round(cy);
        const x0 = Math.max(0, cxi - raggio), x1 = Math.min(L - 1, cxi + raggio);
        const y0 = Math.max(0, cyi - raggio), y1 = Math.min(H - 1, cyi + raggio);
        let s = 0, sx = 0, sy = 0, quanti = 0;
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const w = res[y * L + x] * g.segno;
            if (w < mezza) continue;
            s += w; sx += w * x; sy += w * y; quanti++;
          }
        }
        if (s <= 0 || quanti < 2) break;
        cx = sx / s; cy = sy / s; sp = s; n = quanti;
        // Il secondo momento dice quanto è larga: serve a distinguere la Luna
        // (un disco) da una stella (un punto) quando si associa, e alla
        // passata dopo dice quanto deve essere larga la finestra.
        let m2 = 0;
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const w = res[y * L + x] * g.segno;
            if (w < mezza) continue;
            m2 += w * ((x - cx) * (x - cx) + (y - cy) * (y - cy));
          }
        }
        largo = Math.sqrt(Math.max(0.25, m2 / s));
      }
      if (sp <= 0 || n < 2) continue;

      // La seconda soppressione, e senza di lei la Luna non si aggancia.
      //
      // La prima guarda i **picchi**, e per un punto luminoso basta. Per un
      // disco no: la Luna larga otto pixel ha in cima un pianoro saturo, e su
      // un pianoro ogni pixel è un massimo locale — bastano due picchi a
      // cinque pixel l'uno dall'altro (cioè oltre il raggio della prima
      // regola) perché passino tutti e due. I loro centroidi però cascano
      // quasi nello stesso punto, perché la finestra del centroide contiene
      // lo stesso disco. Misurato in un browser vero: **quattro** macchie per
      // una Luna sola, entro un pixel e mezzo l'una dall'altra.
      //
      // E quattro copie non sono un fastidio estetico: mandano a monte
      // l'aggancio. La regola dell'ambiguità del §6 chiede che la seconda
      // candidata sia molto peggiore della prima, e quattro copie della
      // stessa macchia sono la prima e la seconda a costo identico — quindi
      // la Luna veniva scartata come «ambigua», che è il modo in cui questo
      // difetto si presenta: non un aggancio storto, nessun aggancio.
      //
      // Il rimedio è dedurre la stessa cosa dal risultato invece che dal
      // punto di partenza: due picchi che danno lo stesso centroide sono lo
      // stesso oggetto. Il raggio di fusione tiene conto di quanto sono
      // larghe (due dischi che si sovrappongono sono uno solo), e per due
      // stelle vicine — larghe un pixel e distanti nove — non morde.
      let doppione = false;
      for (const m of macchie) {
        if (Math.hypot(m.x - cx, m.y - cy) < Math.max(rc, m.raggio + largo)) { doppione = true; break; }
      }
      if (doppione) continue;

      macchie.push({
        xg: g.x, yg: g.y, x: cx, y: cy,
        picco: g.picco, segno: g.segno, flusso: sp, raggio: largo, pixel: n
      });
    }
    return { macchie, rumore, soglia };
  }

  // Angoli ad alto contrasto, distribuiti nel fotogramma. Il prodotto dei
  // gradienti orizzontale e verticale privilegia spigoli e ramificazioni e
  // non scambia una lunga riga d'orizzonte per decine di riferimenti.
  function visPuntiScena(luma, L, H) {
    const grezzi = [];
    for (let y = 3; y < H - 3; y += 2) {
      for (let x = 3; x < L - 3; x += 2) {
        const gx = Math.abs(luma[y * L + x + 2] - luma[y * L + x - 2]);
        const gy = Math.abs(luma[(y + 2) * L + x] - luma[(y - 2) * L + x]);
        const forza = Math.min(gx, gy);
        if (forza >= 9) grezzi.push({ x, y, forza });
      }
    }
    grezzi.sort((a, b) => b.forza - a.forza);
    const punti = [];
    for (const p of grezzi) {
      if (punti.some(q => Math.hypot(q.x - p.x, q.y - p.y) < VIS_SCENA_DISTANZA)) continue;
      punti.push(p);
      if (punti.length >= VIS_SCENA_MAX) break;
    }
    return punti;
  }

  function visErrorePatch(a, b, L, H, ax, ay, bx, by) {
    let mediaA = 0, mediaB = 0, n = 0;
    for (let dy = -VIS_SCENA_PATCH; dy <= VIS_SCENA_PATCH; dy++) {
      for (let dx = -VIS_SCENA_PATCH; dx <= VIS_SCENA_PATCH; dx++) {
        const xa = ax + dx, ya = ay + dy, xb = bx + dx, yb = by + dy;
        if (xa < 0 || xa >= L || xb < 0 || xb >= L || ya < 0 || ya >= H || yb < 0 || yb >= H) return Infinity;
        mediaA += a[ya * L + xa]; mediaB += b[yb * L + xb]; n++;
      }
    }
    mediaA /= n; mediaB /= n;
    let somma = 0;
    for (let dy = -VIS_SCENA_PATCH; dy <= VIS_SCENA_PATCH; dy++) {
      for (let dx = -VIS_SCENA_PATCH; dx <= VIS_SCENA_PATCH; dx++) {
        const va = a[(ay + dy) * L + ax + dx] - mediaA;
        const vb = b[(by + dy) * L + bx + dx] - mediaB;
        somma += Math.abs(va - vb);
      }
    }
    return somma / Math.max(1, n);
  }

  // Segue i dettagli statici fra due fotogrammi e li restituisce già nella
  // forma del risolutore di assetto: `a` è la direzione del riferimento nel
  // mondo quando è stato acquisito, `b` quella in cui appare ora.
  function visSeguiScena(fot, base, focale) {
    const prima = stato.scena;
    const coppie = [], segni = [];
    const aSchermo = (x, y) => ({
      x: (x + 0.5) * fot.perPixelX,
      y: (y + 0.5) * fot.perPixelY
    });
    const nuovi = [];
    if (prima && prima.L === fot.largo && prima.H === fot.alto) {
      for (const p of prima.punti) {
        let migliore = null;
        for (let dy = -VIS_SCENA_RICERCA; dy <= VIS_SCENA_RICERCA; dy++) {
          for (let dx = -VIS_SCENA_RICERCA; dx <= VIS_SCENA_RICERCA; dx++) {
            const e = visErrorePatch(prima.luma, fot.luma, fot.largo, fot.alto, p.x, p.y, p.x + dx, p.y + dy);
            if (!migliore || e < migliore.e) migliore = { x: p.x + dx, y: p.y + dy, e };
          }
        }
        // Una patch che cambia troppo è una foglia mossa, un passante o il
        // salto d'esposizione del flash: non deve trascinare il cielo.
        if (!migliore || migliore.e > 18) continue;
        const s = aSchermo(migliore.x, migliore.y);
        coppie.push({ a: p.mondo, b: versore(skyDirezione(s.x, s.y, base, focale)), peso: 0.35 });
        nuovi.push({ x: migliore.x, y: migliore.y, mondo: p.mondo });
        segni.push({ vettore: p.mondo, genere: 'scena', raggio: 8 });
      }
    }
    // Se i vecchi dettagli sono usciti dal campo, semina i vuoti dal
    // fotogramma corrente. Nessun filtro sull'altezza: il primo piano sotto
    // l'orizzonte è spesso il riferimento notturno più nitido.
    if (nuovi.length < VIS_SCENA_MAX / 2) {
      for (const p of visPuntiScena(fot.luma, fot.largo, fot.alto)) {
        if (nuovi.some(q => Math.hypot(q.x - p.x, q.y - p.y) < VIS_SCENA_DISTANZA)) continue;
        const s = aSchermo(p.x, p.y);
        nuovi.push({ x: p.x, y: p.y, mondo: versore(skyDirezione(s.x, s.y, base, focale)) });
        if (nuovi.length >= VIS_SCENA_MAX) break;
      }
    }
    stato.scena = { L: fot.largo, H: fot.alto, luma: new Float32Array(fot.luma), punti: nuovi };
    return { coppie, segni };
  }

  // ===================================================================
  // §5. I candidati: cosa il cielo calcolato dice che c'è lì davanti
  // ===================================================================
  //
  // Non tutto quello che il planetario disegna si vede in un fotogramma di
  // telefono, e chiedere a un rivelatore di trovare Urano è il modo di
  // agganciarsi a un lampione. Si candidano solo le cose che una fotocamera
  // riprende davvero:
  //
  //   - il Sole e la Luna sempre, a qualunque ora (di giorno la Luna si vede
  //     benissimo, ed è il riferimento migliore che ci sia: è un disco, non
  //     un punto, quindi il centroide è precisissimo);
  //   - i pianeti luminosi e le stelle di prima grandezza **solo di notte** e
  //     solo se il cielo è abbastanza scuro (`sky.luceCielo`);
  //   - gli aerei, che di giorno sono sagome e di notte lucine — e che non
  //     entrano mai nel conto dell'assetto (vedi §9).
  //
  // Ognuno porta con sé quanto ci si aspetta che sia grande: è il secondo
  // segnale dell'associazione, dopo la distanza.

  const VIS_PIANETI = new Set(['Venus', 'Jupiter', 'Mars', 'Saturn', 'Mercury']);

  function visCandidati(base, focale) {
    const fuori = [];
    const L = sky.larghezza, H = sky.altezza;
    const margine = Math.min(L, H) * 0.04;
    // Quanto è chiaro il cielo adesso: `sky.luceCielo` viene da `skyAria` e
    // vale 0 di notte piena, 1 a mezzogiorno.
    const luce = typeof sky.luceCielo === 'number' ? sky.luceCielo : 0;
    const notte = luce < 0.12;
    const crepuscolo = luce < 0.45;

    const metti = (v) => {
      const p = skyProietta(v.vettore, base, focale);
      if (!p.davanti) return;
      if (p.px < -margine || p.px > L + margine || p.py < -margine || p.py > H + margine) return;
      fuori.push(Object.assign({}, v, { px: p.px, py: p.py }));
    };

    (sky.oggetti || []).forEach(o => {
      if (!o || typeof o.az !== 'number' || typeof o.alt !== 'number') return;
      // Sotto i due gradi c'è la foschia, e in mezzo alla foschia ci sono i
      // lampioni: è la fascia in cui un riferimento si scambia più facilmente
      // con qualcos'altro.
      if (o.alt < 2) return;
      let raggioAtteso = 2, peso = 1, chiaro = true;
      if (o.tipo === 'sole') {
        raggioAtteso = 0.27;         // gradi: mezzo grado di diametro
        peso = 0.8;                  // grosso e sfondato: il centroide è meno fine
      } else if (o.tipo === 'luna') {
        raggioAtteso = 0.27;
        peso = 1.4;                  // il riferimento migliore che ci sia
      } else if (o.tipo === 'pianeta') {
        if (!crepuscolo || !VIS_PIANETI.has(o.id)) return;
        if (typeof o.mag === 'number' && o.mag > (notte ? 2.2 : -1)) return;
        raggioAtteso = 0.05;
        peso = 1;
      } else if (o.tipo === 'stella') {
        if (!notte) return;
        if (typeof o.mag !== 'number' || o.mag > 1.6) return;
        raggioAtteso = 0.05;
        peso = 0.85;
      } else {
        // Satelliti e cielo profondo non sono riferimenti d'assetto: una
        // stazione attraversa il cielo a un grado al secondo, e mezzo secondo
        // di latenza è mezzo grado di errore che finirebbe dentro all'assetto.
        return;
      }
      metti({
        id: String(o.id), genere: 'astro', nome: o.nome || String(o.id),
        vettore: skyVettore(o.az, o.alt), raggioAtteso, peso, chiaro,
        // La polarità: un astro è **sempre** più chiaro del cielo che gli sta
        // attorno, di giorno come di notte — è per questo che si vede. Dirlo
        // costa un confronto e toglie di mezzo metà delle macchie sbagliate:
        // senza, la Luna poteva candidarsi alla sagoma scura di un aereo che
        // le passava a cinque gradi, e siccome le due erano ugualmente
        // plausibili la regola dell'ambiguità le scartava tutt'e due.
        polarita: 1,
        cancello: 0
      });
    });

    // Gli aerei: la loro posizione è già quella corretta dall'ancora (§9),
    // perché `aereoAdesso` l'applica. Il residuo che si misura qui è quindi
    // un incremento, e il ciclo converge.
    const aerei = (typeof AereiADS_B === 'object' && AereiADS_B.stato && AereiADS_B.stato.aerei) || [];
    aerei.forEach(a => {
      if (!a || typeof a.az !== 'number' || typeof a.alt !== 'number') return;
      if (a.alt < 1) return;
      // Un aereo lontano è meno di un pixel e non lascia traccia nel
      // fotogramma: candidarlo vuol dire solo offrire un cancello vuoto in
      // cui una macchia qualunque può cascare.
      if (typeof a.distanzaKm === 'number' && a.distanzaKm > 45) return;
      metti({
        id: 'aereo:' + a.id, genere: 'aereo', nome: a.volo || a.id,
        vettore: skyVettore(a.az, a.alt),
        raggioAtteso: 0.06, peso: 0.6, chiaro: false,
        // Un aereo invece è l'uno o l'altro, e dipende dall'ora: di giorno è
        // una sagoma scura contro il cielo, di notte una lucina che lampeggia.
        // Zero vuol dire «prendo tutt'e due i versi».
        polarita: 0,
        cancello: VIS_CANCELLO_AEREO
      });
    });

    return fuori;
  }

  // ===================================================================
  // §6. L'associazione
  // ===================================================================
  //
  // Il problema è il classico dell'inseguimento: N previsioni, M rivelazioni,
  // e nessuna etichetta scritta sopra. Qui però si può essere molto severi,
  // e conviene: **un aggancio sbagliato sposta tutto il cielo**, mentre un
  // aggancio mancato costa un ottantesimo di secondo. Quindi si tiene solo
  // quello che è ovvio — la macchia più vicina, dentro al cancello, e senza
  // una seconda candidata altrettanto plausibile — e si scarta tutto il resto.

  function visAssocia(candidati, macchie, opz) {
    const o = opz || {};
    const perGrado = o.perGrado || 1;      // pixel per grado, al centro
    const cancelloGradi = o.cancello || VIS_CANCELLO_LARGO;
    const coppie = [];
    const prese = new Set();

    // In ordine di peso: chi è più affidabile sceglie per primo. La Luna
    // prima di una stella di prima grandezza, un astro prima di un aereo.
    const ordinati = candidati.slice().sort((a, b) => b.peso - a.peso);

    for (const c of ordinati) {
      const cancello = (c.cancello || cancelloGradi) * perGrado;
      let prima = null, seconda = null;
      for (let i = 0; i < macchie.length; i++) {
        if (prese.has(i)) continue;
        const m = macchie[i];
        // La polarità, prima di tutto: una macchia più scura del cielo non è
        // un astro, qualunque distanza abbia.
        if (c.polarita && m.segno !== c.polarita) continue;
        const d = Math.hypot(m.x - c.px, m.y - c.py);
        if (d > cancello) continue;
        // La misura non è la sola distanza: una macchia della taglia
        // sbagliata è meno credibile di una della taglia giusta anche se sta
        // più vicina. Il costo è la distanza pesata da quanto la taglia
        // stona, in ottave.
        const attesoPx = Math.max(0.7, c.raggioAtteso * perGrado);
        const stona = Math.abs(Math.log2(Math.max(0.35, m.raggio) / attesoPx));
        const costo = d * (1 + 0.35 * Math.min(3, stona));
        const voce = { i, m, d, costo };
        if (!prima || costo < prima.costo) { seconda = prima; prima = voce; }
        else if (!seconda || costo < seconda.costo) seconda = voce;
      }
      if (!prima) continue;
      // L'ambiguità. Due macchie ugualmente buone non sono un riferimento.
      if (seconda && seconda.costo < prima.costo * VIS_AMBIGUITA) continue;
      prese.add(prima.i);
      coppie.push({ candidato: c, macchia: prima.m, distanzaPx: prima.d });
    }
    return coppie;
  }

  // ===================================================================
  // §7. L'assetto: la rotazione che fa combaciare tutte le coppie
  // ===================================================================
  //
  // È il problema di Wahba: date N direzioni previste e le N direzioni in cui
  // si vedono davvero, trovare la rotazione che minimizza lo scarto. La
  // soluzione esatta vuole una decomposizione ai valori singolari di una 3×3,
  // che in JavaScript sono duecento righe di codice numerico da provare.
  //
  // Non servono. La rotazione che si cerca è **piccola** — al massimo i
  // ventisei gradi di `VIS_CORREZIONE_MAX`, quasi sempre meno di cinque — e
  // per una rotazione piccola vale `R v ≈ v + ω × v`, che è lineare in ω. Il
  // minimo quadratico di
  //
  //     Σ w |(a − b) − ω × b|²
  //
  // si scrive allora come un sistema 3×3 simmetrico, e si risolve a mano:
  //
  //     [ Σ w (I − b bᵀ) + λI ] ω = Σ w (b × (a − b))
  //
  // (l'identità che serve è `[b]ᵀ[b] = I − b bᵀ` per b unitario). Poi si
  // itera: si applica la rotazione trovata, si rifanno i residui, si risolve
  // di nuovo. In tre giri la linearizzazione è esatta al millesimo di grado
  // anche a venti gradi di partenza.
  //
  // Il termine λ non è una precauzione numerica: è **la risposta giusta con
  // un riferimento solo**. Con una coppia sola la rotazione attorno a quella
  // direzione non è osservabile — una stella non dice come sei girato attorno
  // a lei — e senza λ il sistema è singolare. Con λ, la soluzione è la
  // rotazione *minima* che porta b su a, che è esattamente quello che si
  // vuole: correggi la mira, non inventarti un rollio.
  //
  // Gli sbagli si tolgono pesando: chi si scosta molto dal consenso conta
  // meno (Huber). È la difesa contro l'unica cosa che può rovinare tutto,
  // cioè una macchia associata all'astro sbagliato.

  function visRisolviRotazione(coppie, opz) {
    const o = opz || {};
    const giri = o.giri || 4;
    const scartoHuber = (o.huber || 1.2) * D2R;
    let R = identita();
    let usate = coppie.length;
    let residuo = 0;

    if (!coppie.length) return { R, residuo: 0, usate: 0, pesi: [] };

    let pesi = coppie.map(c => (typeof c.peso === 'number' ? c.peso : 1));

    for (let giro = 0; giro < giri; giro++) {
      const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const rhs = [0, 0, 0];
      const scarti = [];
      let sommaPesi = 0;

      for (let i = 0; i < coppie.length; i++) {
        const a = coppie[i].a;                    // dove dovrebbe stare
        const b = applica(R, coppie[i].b);        // dove si vede, già ruotato
        const e = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        const w = pesi[i];
        scarti.push(Math.hypot(e[0], e[1], e[2]));
        sommaPesi += w;
        // I − b bᵀ, pesato
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            M[r][c] += w * ((r === c ? 1 : 0) - b[r] * b[c]);
          }
        }
        const bxe = cross(b, e);
        rhs[0] += w * bxe[0]; rhs[1] += w * bxe[1]; rhs[2] += w * bxe[2];
      }

      // λ, e vale la pena dire quanto deve essere **piccolo**. Serve a una
      // cosa sola: con una coppia sola la rotazione attorno a quella
      // direzione non è determinata, e senza λ il sistema è singolare. Ma il
      // termine noto non ha nessuna componente lungo quella direzione (è un
      // prodotto vettoriale con b, quindi le è perpendicolare per
      // costruzione), quindi **qualunque** λ diverso da zero dà lì la
      // risposta giusta, cioè zero rollio. Nelle direzioni osservabili invece
      // λ è una molla che tira la soluzione verso l'immobilità, e quella
      // molla si paga: con 0,02 la rotazione trovata veniva il sedici per
      // cento più corta del vero (misurato: 2,64° al posto di 3,16°, cioè
      // mezzo grado di disallineamento che restava lì per sempre, perché a
      // ogni giro se ne rimangiava un pezzo). Un milionesimo regolarizza
      // altrettanto bene e non tira niente.
      const lambda = 1e-6 * Math.max(1e-6, sommaPesi);
      M[0][0] += lambda; M[1][1] += lambda; M[2][2] += lambda;

      const w = risolvi3(M, rhs);
      if (!w) break;
      R = moltiplica(rodrigues(w), R);

      // I pesi del giro dopo: chi si scosta più di `huber` conta meno, col
      // **quadrato** del rapporto e non col rapporto semplice. La differenza
      // non è di stile. Con la legge lineare (Huber classico) una coppia
      // sbagliata di otto gradi pesa ancora un settimo di una giusta, e su
      // tre coppie buone quel settimo storce la mira di un terzo di grado —
      // misurato sul banco: diciannove pixel, cioè quaranta volte la
      // precisione che il resto del modulo si è guadagnata. Col quadrato
      // scende a un cinquantesimo e non si vede più. È una legge
      // ridiscendente, cioè accetta di **buttare via** un dato invece di
      // mediarlo: qui è quello che si vuole, perché una coppia sbagliata non
      // è una misura rumorosa, è una misura di un'altra cosa.
      pesi = coppie.map((c, i) => {
        const base = (typeof c.peso === 'number' ? c.peso : 1);
        const s = scarti[i];
        if (s <= scartoHuber) return base;
        const r = scartoHuber / s;
        return base * r * r;
      });
    }

    // --- Il ripescaggio -------------------------------------------------
    //
    // Pesare poco una coppia sbagliata non è come non averla: pesata al
    // quadrato, un'associazione fuori di otto gradi lascia comunque due
    // decimi di grado di storto sulle altre — che sono quattro pixel, cioè
    // più dell'aggancio che tutto il resto del modulo si è guadagnato.
    // L'ultimo passo è quindi netto: si guarda chi è rimasto lontano dal
    // consenso, lo si **butta**, e si risolve un'ultima volta con i soli
    // superstiti a peso pieno. Si fa una volta sola e solo se restano almeno
    // due coppie: ripetuto, o con una coppia sola, diventerebbe la macchina
    // che si convince di qualunque cosa buttando via i dati che la smentiscono.
    const scartoDi = (c) => angoloFra(applica(R, c.b), c.a);
    const soglia = Math.max(scartoHuber * 2.5 * R2D, 0.6);
    const dentro = coppie.filter(c => scartoDi(c) <= soglia);
    if (!o.senzaRipescaggio && dentro.length >= 2 && dentro.length < coppie.length) {
      const rifatto = visRisolviRotazione(dentro, Object.assign({}, o, { senzaRipescaggio: true }));
      // Lo scarto e il conteggio si riferiscono alle **sole** coppie tenute:
      // includere quelle buttate racconterebbe un aggancio peggiore di quello
      // che è, e la pillola a schermo scriverebbe un numero che non è la
      // precisione con cui il cielo è appoggiato all'immagine.
      return rifatto;
    }

    // Lo scarto finale, in gradi, e quante coppie sono rimaste credibili.
    let somma = 0, buone = 0;
    coppie.forEach(c => {
      const g = scartoDi(c);
      somma += g * g;
      if (g < 1.5) buone++;
    });
    residuo = Math.sqrt(somma / coppie.length);
    usate = buone;
    return { R, residuo, usate, pesi };
  }

  // Un sistema 3×3 simmetrico, con Cramer. Tre righe, e non c'è niente da
  // provare in una libreria.
  function risolvi3(M, v) {
    const det =
      M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
      M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
      M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    if (!isFinite(det) || Math.abs(det) < 1e-12) return null;
    const col = (k) => {
      const A = [M[0].slice(), M[1].slice(), M[2].slice()];
      A[0][k] = v[0]; A[1][k] = v[1]; A[2][k] = v[2];
      return (
        A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
        A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
        A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
      ) / det;
    };
    const w = [col(0), col(1), col(2)];
    return w.every(isFinite) ? w : null;
  }

  // ===================================================================
  // §8. La focale: tarare l'obiettivo guardando, invece di chiederlo
  // ===================================================================
  //
  // Due riferimenti riconosciuti dicono una cosa che uno solo non può dire:
  // **quanto è ingrandita l'immagine**. Se la distanza fra le due macchie è
  // il dieci per cento più grande di quella fra i due punti disegnati, la
  // focale supposta è più corta del dieci per cento — cioè l'obiettivo è meno
  // grandangolare di quanto si credeva.
  //
  // Il rapporto fra distanze *a coppie* è la misura giusta perché non risente
  // dell'errore di assetto: ruotare la vista sposta tutti i punti insieme e
  // non cambia le distanze fra loro (per rotazioni piccole e campi normali —
  // in una prospettiva non è esatto, ma l'errore è del second'ordine, e
  // comunque il passo massimo per giro è il due per cento).
  //
  // È il pezzo che toglie un gesto all'utente: la taratura col pizzico resta,
  // ma non serve più farla.

  function visStimaScala(coppie, opz) {
    const o = opz || {};
    const minBase = o.minBase || VIS_SCALA_BASE_PX;
    const rapporti = [];
    for (let i = 0; i < coppie.length; i++) {
      for (let j = i + 1; j < coppie.length; j++) {
        const dPrev = Math.hypot(coppie[i].previstoX - coppie[j].previstoX,
                                 coppie[i].previstoY - coppie[j].previstoY);
        const dOss = Math.hypot(coppie[i].vistoX - coppie[j].vistoX,
                                coppie[i].vistoY - coppie[j].vistoY);
        if (dPrev < minBase) continue;
        rapporti.push(dOss / dPrev);
      }
    }
    if (!rapporti.length) return null;
    rapporti.sort((a, b) => a - b);
    return rapporti[rapporti.length >> 1];
  }

  // ===================================================================
  // §9. Le ancore: l'errore che è di quell'oggetto e non del cielo
  // ===================================================================
  //
  // Dopo aver raddrizzato l'assetto, quello che resta fra un aereo disegnato e
  // il suo aereo vero non è più un errore di bussola: è l'errore della
  // propagazione ADS-B, ed è **suo**. Diventa la sua ancora — due numeri, uno
  // scarto in azimut e uno in altezza — e da lì in poi `aereoAdesso` la
  // somma alle sue coordinate, cioè l'etichetta si incolla all'aereo e ci
  // resta anche girando il telefono.
  //
  // L'ancora invecchia. Un aereo che esce dall'inquadratura continua a
  // volare, e fra dieci secondi il suo errore di propagazione è un altro:
  // dopo `VIS_ANCORA_VITA_MS` si scioglie da sé, tornando piano a zero invece
  // di sparire di colpo — un'etichetta che salta è peggio di una un po'
  // spostata.

  // `dAz` e `dAlt` sono un **incremento**, non una posizione: la previsione
  // che li ha misurati portava già dentro l'ancora di prima (la applica
  // `aereoAdesso`), quindi quello che resta è di quanto ancora bisogna
  // spostarsi. Sommarlo con un peso è insieme il filtro e l'anello di
  // retroazione: l'etichetta ci arriva in un paio di decimi di secondo e poi
  // ci resta, perché a convergenza l'incremento è zero.
  function ancoraAggiorna(id, dAz, dAlt, dt) {
    if (!isFinite(dAz) || !isFinite(dAlt)) return;
    if (Math.abs(dAz) > VIS_ANCORA_MAX || Math.abs(dAlt) > VIS_ANCORA_MAX) return;
    const vecchia = stato.ancore.get(id) || { dAz: 0, dAlt: 0 };
    const k = 1 - Math.exp(-dt / VIS_TAU_ANCORA_S);
    const taglia = (x) => Math.max(-VIS_ANCORA_MAX, Math.min(VIS_ANCORA_MAX, x));
    stato.ancore.set(id, {
      dAz: taglia(vecchia.dAz + dAz * k),
      dAlt: taglia(vecchia.dAlt + dAlt * k),
      quando: performance.now()
    });
  }

  function ancoreInvecchia() {
    const ora = performance.now();
    stato.ancore.forEach((a, id) => {
      const eta = ora - a.quando;
      if (eta < VIS_ANCORA_VITA_MS) return;
      // Scioglimento: due secondi per tornare a zero.
      const k = Math.max(0, 1 - (eta - VIS_ANCORA_VITA_MS) / 2000);
      if (k <= 0) { stato.ancore.delete(id); return; }
      stato.ancore.set(id, { dAz: a.dAz * k, dAlt: a.dAlt * k, quando: a.quando });
    });
  }

  // ===================================================================
  // §10. Il ciclo
  // ===================================================================

  // La storia delle pose. Serve a una cosa sola, ed è la ragione per cui c'è:
  // il fotogramma che si sta guardando è stato preso qualche decina di
  // millisecondi fa, e va confrontato con la posa di **allora**, non con
  // quella di adesso. Girando il telefono a dieci gradi al secondo sono sei
  // decimi di grado, cioè più di una Luna piena di errore sistematico —
  // sistematico, quindi non si media via: finirebbe dritto nella correzione.
  function ricordaPosa(base, focale) {
    stato.pose.push({
      t: performance.now(),
      f: base.f, r: base.r, u: base.u, focale
    });
    if (stato.pose.length > VIS_POSE_TENUTE) stato.pose.shift();
  }

  function posaDiQualcheIstanteFa(ms) {
    if (!stato.pose.length) return null;
    const meta = performance.now() - ms;
    let scelta = stato.pose[0];
    for (const p of stato.pose) {
      if (Math.abs(p.t - meta) < Math.abs(scelta.t - meta)) scelta = p;
    }
    return scelta;
  }

  // Quanto sta ruotando il telefono, in gradi al secondo — e si prende la
  // **mediana** degli ultimi scarti, non l'ultimo.
  //
  // La ragione è che questo modulo si morde la coda: le pose che gli
  // arrivano sono già corrette da lui, quindi nel fotogramma in cui la
  // correzione fa il suo passo (mezzo grado, a volte) la posa salta — e un
  // salto di mezzo grado in un sedicesimo di secondo è trenta gradi al
  // secondo, cioè sopra al cancello del movimento. Guardando solo l'ultima
  // coppia, il motore si dichiarerebbe «in movimento» proprio perché si sta
  // correggendo, e ogni tanto salterebbe il giro successivo. La mediana di
  // cinque scarti quel salto isolato non lo vede nemmeno, e un movimento
  // vero — che dura, per definizione — lo vede tutto.
  function velocitaAngolare() {
    const n = stato.pose.length;
    if (n < 2) return 0;
    const scarti = [];
    for (let i = n - 1; i > 0 && scarti.length < 5; i--) {
      const dt = (stato.pose[i].t - stato.pose[i - 1].t) / 1000;
      if (dt <= 0.0005) continue;
      scarti.push(angoloFra(stato.pose[i].f, stato.pose[i - 1].f) / dt);
    }
    if (!scarti.length) return stato.motoGradiS;
    scarti.sort((a, b) => a - b);
    return scarti[scarti.length >> 1];
  }

  function perdiAggancio(motivo) {
    stato.motivo = motivo;
    stato.conferme = 0;
    stato.perdite++;
    if (stato.perdite > VIS_PERDITE) {
      stato.agganciato = false;
      stato.riferimenti = 0;
      stato.segni = [];
    }
  }

  // Il giro completo. Torna `true` se ha misurato qualcosa.
  function giro(baseOra, focaleOra) {
    const t0 = performance.now();

    stato.motoGradiS = velocitaAngolare();
    if (stato.motoGradiS > VIS_MOTO_MAX_GRADI_S) {
      // Non è un fallimento: è la divisione del lavoro. Mentre si gira
      // comanda il giroscopio, e l'immagine è mossa comunque.
      stato.motivo = 'movimento';
      return false;
    }

    const fot = prendiFotogramma();
    if (!fot) { stato.motivo = 'niente-immagine'; return false; }

    const posa = posaDiQualcheIstanteFa(VIS_LATENZA_MS) || { f: baseOra.f, r: baseOra.r, u: baseOra.u, focale: focaleOra };
    const base = { f: posa.f, r: posa.r, u: posa.u };
    const focale = posa.focale || focaleOra;

    const { macchie, rumore } = visRilevaMacchie(fot.luma, fot.largo, fot.alto, {});
    stato.macchie = macchie.length;

    // Dal fotogramma ridotto al riquadro: una moltiplicazione, perché il
    // ritaglio l'ha già tolto §2.
    // Il mezzo pixel, che è la trappola di ogni ricampionamento: l'indice `i`
    // del fotogramma ridotto non è un punto, è una **cella**, e copre lo
    // schermo da `i·passo` a `(i+1)·passo`. Il suo centro sta quindi mezzo
    // passo più in là. Dimenticarlo non fa sbagliare a caso: sposta tutte le
    // macchie nella stessa direzione di un pixel e mezzo, cioè aggiunge un
    // errore sistematico all'aggancio — e un errore sistematico è quello che
    // il filtro non toglie, perché non è rumore.
    macchie.forEach(m => {
      m.px = (m.x + 0.5) * fot.perPixelX;
      m.py = (m.y + 0.5) * fot.perPixelY;
      m.raggioPx = m.raggio * fot.perPixelX;
    });
    const inRiquadro = macchie.map(m => ({
      x: m.px, y: m.py, raggio: m.raggioPx, segno: m.segno, flusso: m.flusso
    }));

    const scena = visSeguiScena(fot, base, focale);
    stato.riferimentiScena = scena.coppie.length;
    const candidati = visCandidati(base, focale);

    // Pixel per grado al centro della vista: è il metro con cui si scrivono
    // i cancelli in gradi.
    const perGrado = focale * D2R;
    const cancello = stato.agganciato ? VIS_CANCELLO_STRETTO : VIS_CANCELLO_LARGO;
    const coppie = candidati.length
      ? visAssocia(candidati, inRiquadro, { perGrado, cancello }) : [];
    if (!coppie.length && scena.coppie.length < 3) {
      perdiAggancio('niente-riferimenti'); return false;
    }

    // --- L'assetto, dai soli astri -------------------------------------
    //
    // Gli aerei restano fuori, ed è la scelta di fondo di tutto il modulo: la
    // loro posizione ha un errore proprio di gradi, e mescolarla con quella
    // degli astri — che è esatta al primo d'arco — vorrebbe dire storcere il
    // cielo per far tornare un aereo. Il cielo si raddrizza sugli astri;
    // l'aereo si incolla da sé, con la sua ancora.
    const perAssetto = coppie.filter(c => c.candidato.genere === 'astro');
    let R = identita();
    let misurato = false;

    if (perAssetto.length || scena.coppie.length >= 3) {
      // I riferimenti noti danno la mira assoluta; quelli del paesaggio la
      // tengono ferma fra un fotogramma e l'altro. Quando convivono entrano
      // nello stesso consenso, ma il paesaggio pesa meno perché rami e foglie
      // possono muoversi.
      const wahba = perAssetto.map(c => ({
        a: c.candidato.vettore,                                   // dove dovrebbe stare
        b: versore(skyDirezione(c.macchia.x, c.macchia.y, base, focale)), // dove si vede
        peso: c.candidato.peso
      })).concat(scena.coppie);
      const sol = visRisolviRotazione(wahba, {});
      const gradi = angoloDi(sol.R);
      const soloScena = !perAssetto.length;
      // Un paesaggio non conosce il Nord e quindi corregge soltanto piccoli
      // scivolamenti; un astro può invece recuperare l'intero errore bussola.
      const limite = soloScena ? 4 : VIS_CORREZIONE_MAX;
      if (sol.usate >= (soloScena ? 3 : 1) && gradi < limite && isFinite(gradi)) {
        R = sol.R;
        stato.scarto = sol.residuo;
        stato.riferimenti = sol.usate;
        misurato = true;
      } else {
        perdiAggancio('scarto-grande');
      }
    }

    const t = performance.now();
    // Quanto tempo è passato dall'ultima misura: è il `dt` dei due filtri
    // esponenziali (la correzione e le ancore), e va preso dal giro
    // precedente e non dalla cadenza nominale — la cadenza si adatta al
    // costo, e un filtro tarato su un `dt` che non è quello vero si comporta
    // diversamente su un telefono lento.
    const dtGiro = stato.ultimoGiro ? (t - stato.ultimoGiro) / 1000 : stato.cadenza / 1000;
    const dt = Math.min(0.6, Math.max(0.01, dtGiro));
    stato.ultimoGiro = t;

    if (misurato) {
      // La correzione nuova, composta con quella che c'era, e inseguita piano.
      // `R` porta l'osservato sul previsto: comporla davanti alla correzione
      // corrente vuol dire raddrizzare ancora un po' il mondo nella direzione
      // che l'immagine ha appena indicato. Il segno di questa riga è l'unica
      // cosa di questo file che a occhio non si possa giudicare — un cielo
      // spostato dalla parte sbagliata è un cielo spostato come prima — e per
      // questo c'è la prova sintetica del §32 di `verifica.html`, che parte da
      // un errore noto e pretende di vederlo sparire.
      const passo = scalaRotazione(R, 1 - Math.exp(-dt / VIS_TAU_CORREZIONE_S));
      let nuova = moltiplica(passo, stato.correzione || identita());
      if (angoloDi(nuova) > VIS_CORREZIONE_MAX) {
        nuova = scalaRotazione(nuova, VIS_CORREZIONE_MAX / angoloDi(nuova));
      }
      stato.correzione = nuova;
      stato.correzioneQuando = t;

      stato.perdite = 0;
      stato.conferme = Math.min(VIS_CONFERME + 3, stato.conferme + 1);
      if (stato.conferme >= VIS_CONFERME || perAssetto.length >= 2) {
        stato.agganciato = true;
        stato.motivo = perAssetto.length ? 'agganciato' : 'scena';
      }

      // La focale, quando ci sono almeno due riferimenti buoni e distanti.
      if (perAssetto.length >= 2 && stato.agganciato) {
        const perScala = perAssetto.map(c => ({
          previstoX: c.candidato.px, previstoY: c.candidato.py,
          vistoX: c.macchia.x, vistoY: c.macchia.y
        }));
        const rapporto = visStimaScala(perScala, {});
        if (rapporto && rapporto > VIS_SCALA_MIN && rapporto < VIS_SCALA_MAX) {
          applicaScala(rapporto);
        }
      }
    }

    // --- Le ancore dei singoli oggetti ---------------------------------
    //
    // Si misurano **dopo** aver raddrizzato l'assetto, con la correzione
    // appena trovata: se no ogni aereo si porterebbe dentro anche l'errore
    // di bussola, e quando la bussola si raddrizza salterebbero tutti insieme.
    // La posa con cui si misurano le ancore è quella **appena raddrizzata**:
    // `base` porta la correzione che c'era prima di questo giro, e `R` è
    // quello che manca perché gli astri caschino sulle loro macchie. Le due
    // insieme sono la posa giusta. Il primo tentativo qui applicava di nuovo
    // `correggi(base)`, cioè la correzione due volte, e il risultato era che
    // l'ancora di un aereo assorbiva la correzione di bussola una seconda
    // volta e lo portava via — misurato: tre gradi e mezzo di scarto, cioè
    // peggio di come si era partiti.
    const baseCorretta = { f: applica(R, base.f), r: applica(R, base.r), u: applica(R, base.u) };
    let agganciAerei = 0;
    coppie.forEach(c => {
      if (c.candidato.genere !== 'aereo') return;
      const visto = versore(skyDirezione(c.macchia.x, c.macchia.y, baseCorretta, focale));
      const previsto = c.candidato.vettore;
      const v = azAltDi(visto), p = azAltDi(previsto);
      const dAz = scartoAz(v.az, p.az);
      const dAlt = v.alt - p.alt;
      ancoraAggiorna(c.candidato.id.slice(6), dAz, dAlt, dt);
      agganciAerei++;
    });
    stato.aereiAgganciati = agganciAerei;

    // Il caso di giorno, che è quello della segnalazione: nessun astro nel
    // fotogramma — il Sole è dall'altra parte, la Luna non c'è — e un aereo
    // sì. L'assetto non si può misurare e non si tocca; l'aereo però si
    // aggancia lo stesso, perché la sua ancora assorbe **tutto** l'errore,
    // quello di bussola compreso. Per chi guarda è la stessa cosa: l'aereo
    // disegnato sta sull'aereo vero e ci resta.
    if (!misurato && agganciAerei) {
      stato.perdite = 0;
      stato.motivo = 'aerei';
    }

    // Le parentesi da disegnare attorno a chi è agganciato: si tengono in
    // coordinate di **mondo**, non di schermo, perché fra una misura e
    // l'altra passano una decina di fotogrammi e nel frattempo la vista si
    // muove. Un segno disegnato a coordinate di schermo resterebbe indietro,
    // che è precisamente il difetto che questo modulo esiste per togliere.
    stato.segni = coppie.map(c => ({
      vettore: c.candidato.vettore,
      genere: c.candidato.genere,
      raggio: Math.max(7, (c.macchia.raggio || 2) * 2.2)
    })).concat(scena.segni);

    ancoreInvecchia();

    // Il costo, e la cadenza che si adatta.
    stato.costo = performance.now() - t0;
    stato.cadenza = stato.costo > VIS_COSTO_ALTO_MS
      ? Math.min(VIS_CADENZA_MAX_MS, stato.cadenza * 1.35)
      : Math.max(VIS_CADENZA_MS, stato.cadenza * 0.9);
    return misurato;
  }

  // La taratura della focale si passa al planetario nell'unico modo che
  // conta: cambiando quanto si suppone che riprenda l'obiettivo. Da lì
  // `skySincronizzaCampoFotocamera` rifà il campo, e il disegno lo segue.
  function applicaScala(rapporto) {
    if (typeof skyLatoPerCampo !== 'function' || typeof skyImpostaTaraturaCamera !== 'function') return;
    const limitato = Math.max(1 - VIS_SCALA_PASSO_MAX, Math.min(1 + VIS_SCALA_PASSO_MAX, rapporto));
    // Più grande l'immagine osservata, più lungo l'obiettivo: il campo si
    // stringe. `sky.cameraCampo` è il campo verticale di adesso.
    const campoOra = sky.cameraCampo || sky.fov;
    if (!campoOra) return;
    const campoNuovo = 2 * Math.atan(Math.tan(campoOra / 2 * D2R) / limitato) * R2D;
    const lato = skyLatoPerCampo(campoNuovo);
    if (!lato) return;
    stato.scala = limitato;
    skyImpostaTaraturaCamera(lato);
  }

  // ===================================================================
  // §11. Quello che il resto dell'app chiama
  // ===================================================================

  // La correzione applicata a una terna. È il punto in cui tutto questo
  // modulo entra nel disegno, ed è **una riga**: si ruota il sistema di
  // riferimento, non gli oggetti. Da lì in poi ogni cosa che il planetario
  // disegna — astri, aerei, costellazioni, il terreno — si sposta insieme, e
  // resta insieme mentre il telefono gira.
  function correggi(base) {
    const C = correzioneViva();
    if (!C) return base;
    return { f: applica(C, base.f), r: applica(C, base.r), u: applica(C, base.u) };
  }

  function correzioneViva() {
    if (!stato.correzione) return null;
    if (performance.now() - stato.correzioneQuando > VIS_CORREZIONE_VITA_MS) return null;
    return stato.correzione;
  }

  function visCorreggiBase(base) {
    if (!stato.attivo || !stato.acceso || !base) return base;
    return correggi(base);
  }

  // L'ancora di un aereo, in gradi. La legge `aereoAdesso` in `aerei.js`.
  function visAncoraAereo(id) {
    if (!stato.attivo || !stato.acceso) return null;
    const a = stato.ancore.get(String(id));
    if (!a) return null;
    if (performance.now() - a.quando > VIS_ANCORA_VITA_MS + 2000) return null;
    return { dAz: a.dAz, dAlt: a.dAlt };
  }

  function visAggiorna(base, focale) {
    if (!stato.attivo || !base || !focale) return;
    ricordaPosa(base, focale);
    if (!stato.acceso) { stato.motivo = 'spento'; return; }
    const ora = performance.now();
    if (ora < stato.prossimoGiro) return;
    stato.prossimoGiro = ora + stato.cadenza;
    try {
      giro(base, focale);
    } catch (e) {
      // Un guasto qui non deve mai fermare il fotogramma: la realtà aumentata
      // torna a essere quella di prima, cioè il cielo calcolato sopra
      // l'immagine, e basta.
      stato.motivo = 'guasto';
      if (!stato.guastoDetto) { stato.guastoDetto = true; console.warn('visione:', e); }
    }
    visAggiornaHud();
  }

  // I segni dell'aggancio: due parentesi attorno a ogni riferimento
  // riconosciuto. Non sono decorazione — sono l'unica cosa che dica *perché*
  // il cielo si è spostato, e senza di loro un utente che vede il disegno
  // muoversi da solo pensa a un difetto.
  function visDisegnaAgganci(ctx, base, focale) {
    if (!stato.attivo || !stato.acceso || !stato.agganciato || !stato.segni.length) return;
    ctx.save();
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    stato.segni.forEach(s => {
      const p = skyProietta(s.vettore, base, focale);
      if (!p.davanti) return;
      const r = Math.max(9, Math.min(60, s.raggio));
      ctx.strokeStyle = s.genere === 'aereo' ? 'rgba(125, 211, 252, 0.75)'
        : s.genere === 'scena' ? 'rgba(110, 231, 183, 0.55)' : 'rgba(196, 181, 253, 0.7)';
      const l = r * 0.42;
      // Quattro angoli, come il riquadro di messa a fuoco di una fotocamera.
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(p.px + sx * r, p.py + sy * r - sy * l);
        ctx.lineTo(p.px + sx * r, p.py + sy * r);
        ctx.lineTo(p.px + sx * r - sx * l, p.py + sy * r);
        ctx.stroke();
      });
    });
    ctx.restore();
  }

  // --- Lo stato a schermo ------------------------------------------------

  function testo() {
    const T = (k, v) => (typeof astroI18n === 'object' && astroI18n.t)
      ? astroI18n.t('visione.' + k, v) : k;
    if (!stato.acceso) return { classe: 'spento', testo: T('spento') };
    if (stato.agganciato) {
      return {
        classe: 'agganciato',
        // Lo scarto passa come **numero** e non come stringa già formattata:
        // il separatore decimale lo mette la lingua (mezzo grado qui si
        // scrive «0,5» e in inglese «0.5»), e formattarlo qui vorrebbe dire
        // scrivere un numero italiano dentro a una frase inglese.
        testo: stato.motivo === 'scena'
          ? T('scena', { n: stato.riferimentiScena })
          : T('agganciato', { n: stato.riferimenti, scarto: Math.round(stato.scarto * 10) / 10 })
      };
    }
    if (stato.aereiAgganciati && stato.motivo === 'aerei') {
      return { classe: 'agganciato', testo: T('aerei', { n: stato.aereiAgganciati }) };
    }
    if (stato.motivo === 'movimento') return { classe: 'cerca', testo: T('movimento') };
    if (stato.motivo === 'niente-immagine') return { classe: 'cerca', testo: T('attesa') };
    return { classe: 'cerca', testo: T('cerca') };
  }

  function visAggiornaHud() {
    const el = document.getElementById('ar-stato');
    if (!el) return;
    const acceso = stato.attivo && !!sky.camera;
    el.classList.toggle('hidden', !acceso);
    if (!acceso) return;
    const t = testo();
    el.dataset.stato = t.classe;
    const riga = el.querySelector('.ar-stato-testo');
    if (riga && riga.textContent !== t.testo) riga.textContent = t.testo;
  }

  // --- Accensione e spegnimento -----------------------------------------

  function visAvvia() {
    stato.attivo = true;
    stato.pose.length = 0;
    stato.prossimoGiro = 0;
    stato.cadenza = VIS_CADENZA_MS;
    stato.conferme = 0;
    stato.perdite = 0;
    stato.agganciato = false;
    stato.scena = null;
    stato.riferimentiScena = 0;
    stato.motivo = 'cerca';
    stato.guastoDetto = false;
    visAggiornaHud();
  }

  function visFerma() {
    stato.attivo = false;
    stato.agganciato = false;
    stato.segni = [];
    stato.ancore.clear();
    stato.pose.length = 0;
    stato.scena = null;
    stato.riferimentiScena = 0;
    // La correzione **non** si butta: è una misura vera dell'errore di
    // bussola in questo posto, e se la fotocamera si riaccende fra dieci
    // secondi è ancora quella. La fa scadere il tempo (§`correzioneViva`).
    visAggiornaHud();
  }

  function visAlterna() {
    stato.acceso = !stato.acceso;
    if (!stato.acceso) { stato.agganciato = false; stato.segni = []; }
    visAggiornaHud();
    return stato.acceso;
  }

  function visStato() {
    return {
      attivo: stato.attivo, acceso: stato.acceso, agganciato: stato.agganciato,
      riferimenti: stato.riferimenti, scarto: stato.scarto, macchie: stato.macchie,
      riferimentiScena: stato.riferimentiScena,
      motivo: stato.motivo, costo: stato.costo, cadenza: stato.cadenza,
      correzione: stato.correzione ? angoloDi(stato.correzione) : 0,
      ancore: stato.ancore.size, scala: stato.scala, moto: stato.motoGradiS
    };
  }

  // Rimettere a mano l'aggancio: serve quando ci si sposta di posto (il ferro
  // attorno è un altro) o quando qualcosa è andato storto e si vuole
  // ricominciare senza spegnere la fotocamera.
  function visAzzera() {
    stato.correzione = null;
    stato.ancore.clear();
    stato.agganciato = false;
    stato.conferme = 0;
    stato.segni = [];
    stato.scena = null;
    stato.riferimentiScena = 0;
    stato.scala = 1;
    visAggiornaHud();
  }

  window.visAvvia = visAvvia;
  window.visFerma = visFerma;
  window.visAggiorna = visAggiorna;
  window.visCorreggiBase = visCorreggiBase;
  window.visAncoraAereo = visAncoraAereo;
  window.visDisegnaAgganci = visDisegnaAgganci;
  window.visAggiornaHud = visAggiornaHud;
  window.visStato = visStato;
  window.visAlterna = visAlterna;
  window.visAzzera = visAzzera;
  window.visAttivo = () => stato.attivo;
  window.visAcceso = () => stato.acceso;
  window.visAgganciato = () => stato.attivo && stato.acceso && stato.agganciato;

  // Le funzioni pure, per il banco di prova (§32 di `verifica.html`). Sono le
  // stesse che gira il motore: non una copia.
  window.Visione = {
    visRilevaMacchie, visResiduo, visRumore, visAssocia, visRisolviRotazione,
    visStimaScala, rodrigues, angoloDi, scalaRotazione, applica, moltiplica,
    identita, versore, azAltDi, vettoreDa, scartoAz, risolvi3, stato,
    VIS_CANCELLO_LARGO, VIS_CANCELLO_STRETTO, VIS_CANCELLO_AEREO,
    VIS_AMBIGUITA, VIS_CORREZIONE_MAX, VIS_ANCORA_MAX, VIS_PIXEL, visLatoRidotto
  };
})();
