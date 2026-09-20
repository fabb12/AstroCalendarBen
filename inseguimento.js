/* inseguimento.js — L'inseguimento a rilevazioni degli aerei nella realtà
 * aumentata: ritaglio, rilevazione, flusso ottico, filtro. Prefisso `ins`.
 *
 * ────────────────────────────────────────────────────────────────────────
 * PERCHÉ ESISTE, DETTO COL CONTO IN MANO
 *
 * `visione.js` raddrizza il **cielo** e lo fa bene: misura l'errore di
 * bussola sugli astri e da lì in poi lo porta avanti il giroscopio (§10 di
 * quel file). Quello che resta fra l'etichetta di un aereo e il suo aereo
 * vero non è però un errore di bussola — è l'errore della propagazione
 * ADS-B, ed è **di quell'aereo**: una lettura vecchia di tre secondi, a
 * duecentocinquanta metri al secondo, sono ottocento metri, che a cinque
 * chilometri sono nove gradi. `visione.js` lo cura con le ancore (§9), e la
 * cura è giusta; quello che non regge è **il ritmo**, e per due ragioni che
 * si sommano.
 *
 *   1. LA CADENZA. Quel motore guarda l'immagine dodici volte al secondo nel
 *      caso migliore (`VIS_CADENZA_MS` 80 ms, per giunta strozzato a un
 *      fotogramma su sei da `VIS_FRAME_PASSO`), e fra una misura e l'altra
 *      l'ancora è **ferma**. Il giroscopio porta avanti l'assetto, cioè il
 *      cielo; l'aereo no, perché l'aereo non sta fermo nel mondo. Un aereo
 *      vicino attraversa il cielo a quasi tre gradi al secondo: in un
 *      dodicesimo di secondo sono due decimi di grado, e a ogni misura
 *      l'etichetta fa un saltino. È esattamente il sintomo della
 *      segnalazione — non «è spostata», ma «balla».
 *
 *   2. LA RISOLUZIONE. Quel motore lavora su un fotogramma ridotto a
 *      trentamila pixel (§2 di `visione.js`), cioè attorno a duecento per
 *      centocinquanta, ed è la scelta giusta per gli astri: la Luna è un
 *      disco di mezzo grado e un pianeta è un punto, e il centroide pesato
 *      porta la misura sotto al pixel comunque. Per un aereo no. Un
 *      aeroplano di linea con quaranta metri di apertura, a dieci chilometri,
 *      è largo **due decimi di grado**; a due virgola sei pixel per grado del
 *      fotogramma ridotto sono sei centesimi di pixel. Non è una macchia
 *      debole: non c'è proprio. Nel fotogramma nativo della fotocamera —
 *      milleottanta righe su sessantacinque gradi, cioè trenta pixel per
 *      grado — lo stesso aereo è largo sei pixel, ed è una sagoma che si
 *      rileva benissimo.
 *
 * La cura è una sola e le risolve tutt'e due: **guardare in piccolo, ma da
 * vicino, e spesso**. Si ritaglia dal fotogramma nativo una patch di due
 * centimetri di schermo attorno a dove il cielo calcolato dice che l'aereo
 * sta (§5), la si rileva a risoluzione piena (§3), e fra una rilevazione e
 * l'altra si insegue la sagoma col flusso ottico (§2), che costa un
 * centesimo di quello che costa rilevare.
 *
 * Il conto che rende sostenibile tutto il resto: una patch di 192×192 sono
 * trentasettemila pixel, cioè **l'uno e mezzo per cento** dei due milioni e
 * mezzo di un fotogramma 1920×1280 — e a parità di pixel letti si guarda
 * l'aereo a dieci volte la risoluzione angolare di prima.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LA PIPELINE, E DOV'È IL CONFINE FRA I TRE PEZZI
 *
 *     ritaglio (§5) → rilevazione (§3) ─┐
 *                                       ├→ Kalman (§4) → ancora (§9)
 *                     flusso ottico (§2)┘
 *
 * La divisione del lavoro è quella classica dell'inseguimento a rilevazioni,
 * e la ragione per cui i due pezzi non si possono scambiare è di costo:
 * **rilevare è caro e non sbaglia, inseguire è gratis e deriva**. Quindi si
 * rileva di rado (`INS_PASSO_RILEVA`, venti fotogrammi) e per il resto si
 * insegue; e ogni volta che si insegue si controlla quanto ci si può ancora
 * credere (l'errore avanti-indietro del §2), perché una deriva silenziosa è
 * peggio di una perdita dichiarata — un'etichetta che scivola piano su un
 * pezzo di cielo vuoto è ancora un'etichetta, e nessuno la legge come rotta.
 *
 * Il **filtro** sta in fondo, e non è una levigatura estetica: le due
 * sorgenti hanno precisioni diverse (una rilevazione vale un pixel, una
 * corsa di flusso ottico ne vale tre dopo venti fotogrammi) e un filtro di
 * Kalman è il modo di pesarle come meritano invece di credere sempre
 * all'ultima. La velocità che tiene nello stato serve a un'altra cosa
 * ancora, ed è quella che toglie il saltino: fra due misure la previsione
 * **continua a muoversi**, con la velocità angolare che ha appena misurato.
 *
 * ────────────────────────────────────────────────────────────────────────
 * IL RIVELATORE: PERCHÉ NON YOLO, E DOVE YOLO SI INNESTA
 *
 * La richiesta diceva YOLO, e vale la pena scrivere perché di serie qui non
 * c'è, perché è una decisione che si rivedrà.
 *
 * Il formato non c'entra — TFLite e CoreML sono formati **nativi**, e questa
 * è una pagina che si apre con un doppio clic: in un browser le strade sono
 * ONNX Runtime Web o TensorFlow.js. C'entrano invece tre numeri.
 *
 *   - LA TAGLIA. Un YOLO nano in ONNX quantizzato sono sei megabyte, più
 *     tre o quattro di runtime WebAssembly. Quest'app, tutta intera,
 *     cataloghi compresi, ne pesa quattro: il rivelatore peserebbe più del
 *     planetario, e andrebbe in `ASSETS` di `sw.js`, cioè si scaricherebbe
 *     all'installazione anche a chi la fotocamera non l'accende mai.
 *   - IL COSTO. Misurato in letteratura e coerente con quello che si vede:
 *     un nano a 320×320 in WASM SIMD su un telefono di fascia media costa
 *     fra ottanta e duecento millisecondi. Anche una volta ogni venti
 *     fotogrammi è **una pausa di dodici fotogrammi**, cioè esattamente il
 *     difetto che `rilievo.js` ha passato mesi a togliere: non conta il
 *     costo medio, conta il fotogramma peggiore. Con WebGPU si scenderebbe a
 *     venti o trenta, ma WebGPU su iOS in campo non c'è.
 *   - LA RESA, che è la ragione vera. La classe «airplane» di COCO è fatta
 *     di aeroplani fotografati in pista o grandi nel quadro. Il nostro
 *     bersaglio è una sagoma di **sei pixel** contro un cielo uniforme: a
 *     320×320, dopo il ridimensionamento della patch, ne resta uno. Un
 *     convoluzionale quella cosa lì non la vede, e non perché sia piccolo —
 *     perché non è quello che gli è stato insegnato a vedere.
 *
 * E la cosa che a quella scala funziona benissimo esiste già ed è vecchia di
 * cent'anni: un **filtro adattato**, cioè togliere il fondo locale e tenere
 * quello che se ne stacca (§3). Su una sagoma di sei pixel contro il cielo è
 * il rivelatore ottimo, costa un millisecondo, non pesa niente e non ha
 * bisogno di essere addestrato.
 *
 * Quindi: il rivelatore è **scambiabile** (§3, `insRivelatori`), il posto di
 * YOLO c'è e la sua strada è scritta per intero (§7) — si accende
 * configurando `INS_MODELLO_URL`, il modello si carica a richiesta e solo
 * nel worker, e il resto della pipeline non se ne accorge. Quello che non si
 * fa è portarsi dietro dieci megabyte per un risultato peggiore.
 *
 * ────────────────────────────────────────────────────────────────────────
 * IL FILO DI SFONDO, E PERCHÉ QUESTO FILE È ANCHE IL WORKER
 *
 * L'elaborazione delle immagini sta fuori dal filo principale, ed è la
 * ragione per cui questo file comincia guardando se `window` esiste: **è
 * insieme lo script della pagina e lo script del worker**. Non è un vezzo,
 * è l'unico modo di farlo senza un bundler — e questa applicazione non ha
 * né build né bundler (§1 di `CLAUDE.md`). Caricato da `index.html` registra
 * le sue funzioni su `window` e apre un `new Worker('inseguimento.js')`, che
 * è lo stesso file: dentro al worker `window` non c'è, quindi il file si
 * limita a registrare il suo `onmessage`. Le funzioni pure — la piramide, il
 * Lucas-Kanade, il rivelatore, il Kalman — sono **le stesse righe** nei due
 * posti, non una copia.
 *
 * Dal filo principale esce solo il ritaglio, e neanche quello costa: si
 * chiede un `ImageBitmap` della sola patch (`createImageBitmap` col
 * rettangolo di ritaglio, che è lavoro della GPU) e lo si **trasferisce** al
 * worker, cioè si passa il possesso di quella memoria invece di copiarla. Il
 * filo principale non legge un pixel.
 *
 * Il ripiego c'è e serve davvero: da `file://` un `new Worker` di file è
 * vietato da Chrome, e `OffscreenCanvas` dentro a un worker su Safari è
 * arrivato tardi. In tutt'e due i casi la pipeline gira sul filo principale,
 * con le stesse funzioni, e la sola differenza è che il ritaglio si legge
 * dove si è (§6). Costa un millisecondo per fotogramma su una patch, ed è la
 * ragione per cui il ripiego è accettabile e non è un secondo codice.
 *
 * ────────────────────────────────────────────────────────────────────────
 * COSA SUCCEDE SE QUESTO FILE NON C'È
 *
 * Niente. `visione.js` continua a misurare le sue ancore come prima, con la
 * sua cadenza, e l'etichetta resta dov'era. Ogni gancio nel resto dell'app è
 * guardato da un `typeof`, che è la regola di questo progetto per i moduli
 * aggiunti dopo.
 */

(function () {
  'use strict';

  // Il file ha due vite (vedi il cappello). Qui si decide quale.
  const NEL_WORKER = (typeof window === 'undefined') && (typeof importScripts === 'function');
  const globale = NEL_WORKER ? self : window;

  const D2R = Math.PI / 180, R2D = 180 / Math.PI;

  // ===================================================================
  // §1. Lo stato e le costanti
  // ===================================================================

  // Il lato della patch, in pixel del **fotogramma nativo**. Duecentocinquanta
  // gradi di schermo non c'entrano niente: quello che deve starci dentro è il
  // cancello, cioè quanto può sbagliare la previsione. Un aereo vicino, con
  // una lettura ADS-B vecchia di tre secondi, può stare nove gradi più in là
  // (§`VIS_CANCELLO_AEREO`); a trenta pixel per grado sono duecentosettanta
  // pixel, cioè più della patch. Per questo la patch **non** copre il
  // cancello intero e non deve: copre l'errore che resta dopo che il Kalman
  // ha fatto il suo giro, che a regime è sotto il grado. La prima rilevazione
  // di un aereo nuovo la fa `visione.js` col suo cancello largo sul
  // fotogramma ridotto — è il lavoro per cui quel motore è tarato — e da lì
  // in poi la patch stretta basta e avanza.
  //
  // 192 e non 256: sono trentasettemila pixel contro sessantacinquemila, e a
  // trenta pixel per grado coprono sei gradi e mezzo di cielo, che è sette
  // volte l'errore a regime. Duecentocinquantasei si paga e non si usa.
  const INS_LATO_PATCH = 192;
  // Non si ritaglia più di così del fotogramma: su una fotocamera frontale a
  // bassa risoluzione, o con lo zoom digitale, la patch potrebbe coprire
  // mezza immagine, e allora tanto vale lasciar lavorare `visione.js`.
  const INS_PATCH_QUOTA_MAX = 0.35;

  // Ogni quanti fotogrammi si rileva. Venti a sessanta al secondo è una
  // rilevazione ogni terzo di secondo, che è il tempo in cui un aereo vicino
  // percorre un grado — cioè il flusso ottico non deve mai inseguire più di
  // un grado alla volta, e su un grado non deriva.
  const INS_PASSO_RILEVA = 20;
  // Quante tracce si portano avanti insieme. Il costo è una patch per
  // fotogramma (si lavora a turno, §8), quindi il numero non cambia il costo
  // per fotogramma: cambia ogni quanto ognuna viene aggiornata. Con tre
  // tracce, a sessanta fotogrammi, ognuna si aggiorna venti volte al secondo,
  // cioè ogni quindici centesimi di grado di un aereo vicino.
  const INS_TRACCE_MAX = 3;

  // --- Il flusso ottico ---------------------------------------------------

  // Il semilato della finestra di Lucas-Kanade, in pixel. Undici per undici:
  // deve contenere la sagoma con attorno un po' di cielo, perché è il
  // contrasto fra i due a dare i gradienti su cui il metodo si regge. Più
  // larga non aiuta — attorno c'è cielo liscio, cioè zero gradiente, cioè
  // righe di zeri nel sistema.
  const INS_LK_FINESTRA = 5;
  const INS_LK_LIVELLI = 3;        // piramide: ±4 px al livello fine diventano ±16
  const INS_LK_ITERAZIONI = 6;
  const INS_LK_PASSO_MIN = 0.02;   // px: sotto, si è convergiuto
  // Il minimo autovalore della matrice dei gradienti, normalizzato al numero
  // di pixel della finestra. È il numero che dice «qui non c'è niente da
  // inseguire»: senza questo controllo il sistema si risolve lo stesso e
  // restituisce un numero qualunque — cioè una deriva che non lascia traccia.
  //
  // E non può essere una costante, che è l'errore misurato. Su cielo vuoto i
  // gradienti non sono zero: sono rumore del sensore, e con la differenza
  // centrata la loro varianza vale mezzo sigma quadro. Con σ di tre livelli —
  // un cielo notturno qualunque — quella media vale quattro e mezzo, cioè
  // **otto volte** una soglia fissa a 0,55: il cielo vuoto passava il
  // controllo e il flusso ottico si metteva a inseguire la grana del
  // sensore, restituendo spostamenti di un pixel e mezzo per fotogramma in
  // direzioni a caso. Il sintomo non è un errore: è un riquadro che se ne va
  // piano per conto suo, e nessuno lo legge come rotto.
  //
  // La soglia si scrive perciò in **scarti tipici**, e lo scarto tipico
  // questo modulo lo misura già: lo trova il rivelatore (§3) e lo si porta
  // avanti nella memoria della traccia. Tre sigma quadri stanno sei volte
  // sopra al rumore e molto sotto a qualunque sagoma vera, che di gradiente
  // ne ha decine di livelli.
  const INS_LK_AUTOVALORE_SIGMA = 3;
  const INS_LK_AUTOVALORE_MIN = 0.55;   // il pavimento, quando sigma non si sa
  // L'errore avanti-indietro: si insegue da qui a lì, poi si torna indietro,
  // e si guarda se si è tornati dove si era partiti. È il controllo di
  // qualità classico (Kalal, 2010) e qui è l'unico che ci sia, perché il
  // flusso ottico non ha nessun modo interno di sapere di aver perso il
  // bersaglio. Un pixel e mezzo: a trenta pixel per grado sono cinque
  // centesimi di grado, cioè sotto la precisione che serve.
  const INS_LK_AVANTI_INDIETRO_MAX = 1.5;
  // Quanti punti si inseguono dentro al riquadro. Non uno: un solo punto che
  // sbaglia è una traccia che se ne va, e non c'è modo di accorgersene. Nove
  // in griglia, mediana dei loro spostamenti, e almeno tre devono sopravvivere
  // al controllo avanti-indietro.
  const INS_LK_PUNTI = 3;          // per lato: 3×3 = 9
  const INS_LK_PUNTI_MIN = 3;

  // --- Il rivelatore ------------------------------------------------------

  // La scatola con cui si stima il fondo, in pixel della patch. Vale la stessa
  // regola del §4-ter di `visione.js` — molto più grande della macchia, molto
  // più piccola delle strutture del cielo — ma qui la macchia è di sei pixel
  // e la patch di centonovantadue, quindi non c'è niente da misurare: undici
  // va bene per tutti.
  const INS_FONDO_RAGGIO = 11;
  const INS_SOGLIA_SIGMA = 4.0;    // più severa di `visione.js`: qui si cerca una cosa sola
  const INS_SOGLIA_MIN = 3.0;      // livelli su 255
  // Quanto grande può essere la componente perché sia un aereo e non una
  // nuvola con un bordo netto. Un quarantesimo della patch in area: a
  // centonovantadue pixel di lato sono novecento pixel, cioè un aereo di
  // trenta per trenta — che a trenta pixel per grado è un grado di apertura,
  // cioè un jumbo a due chilometri. Sopra, non è un aereo.
  const INS_AREA_MAX_QUOTA = 0.025;
  const INS_AREA_MIN = 3;
  // Un aereo è lungo e stretto, ma non una riga: una componente più allungata
  // di così è il bordo di un tetto, la scia di un altro aereo o il filo della
  // luce.
  const INS_ASPETTO_MAX = 7;

  // --- Il filtro ----------------------------------------------------------

  // Il rumore di processo, in gradi al secondo quadrati. È quanto ci si
  // aspetta che l'**errore** di propagazione acceleri, non l'aereo: la rotta
  // dichiarata è quasi sempre giusta, quindi l'errore cresce piano e salta
  // quando arriva una lettura nuova. Due gradi al secondo quadrato lascia al
  // filtro la libertà di inseguire quel salto in un paio di misure senza
  // ballare col rumore.
  const INS_KALMAN_ACCEL = 2.0;
  // Il rumore di misura, in gradi. Una rilevazione vale il centroide pesato,
  // cioè un terzo di pixel a trenta pixel per grado: un centesimo di grado.
  // Si dichiara molto di più — un decimo — perché l'errore vero non è il
  // centroide, è la possibilità di aver centroidato la cosa sbagliata. Una
  // corsa di flusso ottico vale il doppio, perché porta dentro la deriva.
  const INS_KALMAN_R_RILEVATO = 0.10;
  const INS_KALMAN_R_INSEGUITO = 0.22;
  // Oltre questo scarto fra la misura e la previsione del filtro non è più
  // quell'aereo: si scarta la misura e si conta una perdita. Tre gradi è
  // abbondante rispetto a quello che una patch da sei gradi e mezzo può
  // contenere, e stretto rispetto al cancello di `visione.js`.
  const INS_INNOVAZIONE_MAX = 3.0;

  // Quanto vive una traccia senza misure. Un secondo e mezzo: oltre, la
  // velocità che il filtro tiene non racconta più niente e l'ancora
  // comincerebbe a inventare gradi.
  const INS_TRACCIA_VITA_MS = 1500;
  // E quanto vale l'ancora che questo modulo consegna: se nessuno l'aggiorna
  // scade, e da lì in poi risponde `visione.js` con la sua.
  const INS_ANCORA_VITA_MS = 1200;
  // Quante rilevazioni di fila servono per credere a una traccia nuova. Due:
  // una macchia isolata dentro a una patch di cielo può essere un uccello, un
  // riflesso sul vetro, un pixel caldo del sensore. Due di fila nello stesso
  // posto no.
  const INS_CONFERME = 2;
  const INS_PERDITE_MAX = 3;

  // Sopra questa velocità di rotazione del telefono non si misura niente, ed
  // è la stessa regola del §10 di `visione.js` per la stessa ragione:
  // l'immagine è mossa e il flusso ottico inseguirebbe la sfocatura. Qui il
  // numero è più generoso perché la patch è piccola e il seme viene dal
  // giroscopio (§8), quindi il flusso ottico ha da coprire molto meno.
  const INS_MOTO_MAX_GRADI_S = 35;

  // Oltre quanto una richiesta al worker si dà per persa. Vedi il commento in
  // `insAggiorna`: una richiesta appesa non fa rumore, spegne il modulo.
  const INS_RICHIESTA_APPESA_MS = 500;

  // La distanza oltre la quale un aereo non si insegue. Non è una scelta di
  // comodo: a quaranta chilometri un aeroplano è largo sei centesimi di
  // grado, cioè due pixel del fotogramma nativo — e due pixel non si
  // inseguono, si sorteggiano. È anche la distanza oltre la quale l'errore
  // di propagazione, in gradi, smette di essere il problema: ottocento metri
  // a quaranta chilometri sono un grado, che è già dentro alla precisione
  // con cui `visione.js` lavora.
  const INS_DISTANZA_MAX_KM = 25;

  // Il modello YOLO, se c'è. Vuoto — ed è il caso di serie — vuol dire che il
  // rivelatore è quello del §3. Si configura in `config.js`, come il ponte
  // ADS-B e quello di Edge-TTS.
  //
  // Da leggere **solo nella pagina**: `config.js` è uno script del documento
  // e dentro al worker non esiste, quindi là questi due sarebbero vuoti. Il
  // worker li riceve nel messaggio di accensione (§8-bis), ed è il genere di
  // dimenticanza che non lascia traccia — il modello semplicemente non si
  // carica mai, e il rivelatore di ripiego fa il suo lavoro senza dire
  // niente.
  const INS_MODELLO_URL = NEL_WORKER ? '' : (globale.INS_MODELLO_URL || '');
  const INS_ORT_PREDEFINITO =
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.wasm.min.js';
  const INS_ORT_URL = NEL_WORKER ? '' : (globale.INS_ORT_URL || INS_ORT_PREDEFINITO);
  const INS_MODELLO_LATO = 320;
  const INS_YOLO_CLASSE = 4;       // «airplane», nell'ordine di COCO
  const INS_YOLO_FIDUCIA = 0.25;

  // ===================================================================
  // §2. Il motore puro: la piramide e il Lucas-Kanade
  // ===================================================================
  //
  // Tutto quello che segue non tocca il documento, non guarda l'orologio e
  // non sa che cos'è un aereo: prende array di numeri e restituisce numeri.
  // È la stessa divisione di `missione-cielo.js` (§2 il motore, §3 il
  // raccoglitore) e per la stessa ragione: così gira **anche dentro al
  // worker**, dove il documento non c'è, e si prova senza un browser.

  // Le scorte: gli array di lavoro si riusano invece di riallocarli. Qui gira
  // a ogni fotogramma, e un `new Float32Array(37000)` per giro sono due
  // megabyte al secondo di spazzatura da raccogliere — cioè un fotogramma
  // perso ogni tanto, che è precisamente il difetto che questo modulo esiste
  // per togliere.
  const scorte = new Map();
  function scorta(nome, quanti, Tipo) {
    let a = scorte.get(nome);
    if (!a || a.length < quanti || a.constructor !== Tipo) {
      a = new Tipo(quanti);
      scorte.set(nome, a);
    }
    return a;
  }

  // Da RGBA a luminanza. I coefficienti sono quelli di sempre (Rec. 601):
  // qui non conta la fedeltà colorimetrica, conta che una sagoma scura
  // contro il cielo resti scura, e per quello va bene qualunque pesatura che
  // non azzeri il blu — il cielo è blu, e pesarlo zero renderebbe il cielo
  // nero quanto l'aereo.
  function insLuminanza(rgba, quanti, fuori) {
    const out = fuori || new Float32Array(quanti);
    for (let i = 0, p = 0; i < quanti; i++, p += 4) {
      out[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
    }
    return out;
  }

  // Un livello di piramide: media di quattro pixel. Non è un gaussiano vero e
  // non serve che lo sia — a questa scala la differenza fra una media di
  // quattro e un binomiale 1-2-1 è sotto il livello di rumore del sensore,
  // e la media costa tre somme invece di dodici.
  function insDimezza(src, L, H, fuori) {
    const l = L >> 1, h = H >> 1;
    const out = fuori || new Float32Array(l * h);
    for (let y = 0; y < h; y++) {
      const r0 = (y * 2) * L, r1 = r0 + L, o = y * l;
      for (let x = 0; x < l; x++) {
        const c = x * 2;
        out[o + x] = 0.25 * (src[r0 + c] + src[r0 + c + 1] + src[r1 + c] + src[r1 + c + 1]);
      }
    }
    return { dati: out, L: l, H: h };
  }

  // La piramide intera. `chiave` serve solo a tenere separate le scorte del
  // fotogramma di prima da quelle di adesso: senza, il secondo giro
  // riscriverebbe sopra al primo e il flusso ottico confronterebbe
  // un'immagine con sé stessa — che non fallisce, restituisce zero, cioè una
  // traccia perfettamente immobile sopra un aereo che si muove.
  function insPiramide(luma, L, H, livelli, chiave) {
    const p = [{ dati: luma, L, H }];
    for (let i = 1; i < livelli; i++) {
      const g = p[i - 1];
      if (g.L < 16 || g.H < 16) break;
      const n = (g.L >> 1) * (g.H >> 1);
      p.push(insDimezza(g.dati, g.L, g.H, scorta(chiave + ':pir' + i, n, Float32Array)));
    }
    return p;
  }

  // Il campionamento bilineare. È la riga da cui dipende il sub-pixel: col
  // pixel più vicino il Lucas-Kanade non converge affatto — il residuo è
  // costante a tratti, quindi il suo gradiente è zero quasi dappertutto e il
  // passo calcolato è zero. È la stessa lezione di `rilQuotaTessere` in
  // `rilievo.js`, in un'altra veste.
  function insCampiona(src, L, H, x, y) {
    if (x < 0) x = 0; else if (x > L - 1.001) x = L - 1.001;
    if (y < 0) y = 0; else if (y > H - 1.001) y = H - 1.001;
    const x0 = x | 0, y0 = y | 0;
    const fx = x - x0, fy = y - y0;
    const i = y0 * L + x0;
    const a = src[i], b = src[i + 1], c = src[i + L], d = src[i + L + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  // Lucas-Kanade piramidale, un punto.
  //
  // L'idea in una riga: attorno al punto, nell'immagine di prima, si misurano
  // i gradienti; poi si cerca lo spostamento che, applicato all'immagine di
  // adesso, annulla la differenza fra le due. Il sistema è due equazioni in
  // due incognite ed è lineare **solo per spostamenti piccoli**, che è la
  // ragione della piramide: al livello più grosso un pixel ne vale otto,
  // quindi uno spostamento di sedici pixel là sopra è di due — e due è
  // piccolo.
  //
  // Il risultato è `null` quando non c'è niente da inseguire (l'autovalore) o
  // quando il conto è uscito dall'immagine.
  function insLucasKanadePunto(pPrec, pOra, x, y, opz) {
    const o = opz || {};
    const w = o.finestra || INS_LK_FINESTRA;
    const iter = o.iterazioni || INS_LK_ITERAZIONI;
    const autMin = (o.autovaloreMin !== undefined) ? o.autovaloreMin : INS_LK_AUTOVALORE_MIN;
    const livelli = pPrec.length;
    // Il seme arriva dal chiamante (nel nostro caso dal giroscopio, §8) e si
    // scala giù come tutto il resto.
    let gx = (o.semeX || 0) / (1 << (livelli - 1));
    let gy = (o.semeY || 0) / (1 << (livelli - 1));

    for (let l = livelli - 1; l >= 0; l--) {
      const A = pPrec[l], B = pOra[l];
      const s = 1 / (1 << l);
      const px = x * s, py = y * s;
      if (px < w + 1 || py < w + 1 || px > A.L - w - 2 || py > A.H - w - 2) {
        // Il punto è sul bordo a questo livello: si salta il livello invece
        // di arrendersi — ai livelli fini ci sarà più margine.
        gx *= 2; gy *= 2;
        continue;
      }

      // La matrice dei gradienti, che al livello non cambia mai: si calcola
      // una volta e si riusa per tutte le iterazioni. È metà del costo.
      let Gxx = 0, Gxy = 0, Gyy = 0;
      const n = (2 * w + 1) * (2 * w + 1);
      const ix = scorta('lk:ix', n, Float32Array);
      const iy = scorta('lk:iy', n, Float32Array);
      const ia = scorta('lk:ia', n, Float32Array);
      let k = 0;
      for (let dy = -w; dy <= w; dy++) {
        for (let dx = -w; dx <= w; dx++, k++) {
          const cx = px + dx, cy = py + dy;
          const gxv = 0.5 * (insCampiona(A.dati, A.L, A.H, cx + 1, cy)
            - insCampiona(A.dati, A.L, A.H, cx - 1, cy));
          const gyv = 0.5 * (insCampiona(A.dati, A.L, A.H, cx, cy + 1)
            - insCampiona(A.dati, A.L, A.H, cx, cy - 1));
          ix[k] = gxv; iy[k] = gyv;
          ia[k] = insCampiona(A.dati, A.L, A.H, cx, cy);
          Gxx += gxv * gxv; Gxy += gxv * gyv; Gyy += gyv * gyv;
        }
      }
      // L'autovalore minore, normalizzato: è la misura di «quanto c'è da
      // inseguire qui». Su cielo liscio vale zero e ci si ferma; su un angolo
      // vale tanto; su un bordo dritto vale poco in una direzione sola — ed è
      // giusto che valga poco, perché lungo un bordo dritto lo spostamento
      // non si può misurare (il problema dell'apertura).
      const tr = Gxx + Gyy, det = Gxx * Gyy - Gxy * Gxy;
      const disc = Math.max(0, tr * tr / 4 - det);
      const lmin = tr / 2 - Math.sqrt(disc);
      if (!(lmin / n > autMin) || !(Math.abs(det) > 1e-7)) {
        if (l === 0) return null;
        gx *= 2; gy *= 2;
        continue;
      }

      for (let it = 0; it < iter; it++) {
        let bx = 0, by = 0;
        let kk = 0;
        for (let dy = -w; dy <= w; dy++) {
          for (let dx = -w; dx <= w; dx++, kk++) {
            const d = ia[kk] - insCampiona(B.dati, B.L, B.H, px + dx + gx, py + dy + gy);
            bx += d * ix[kk]; by += d * iy[kk];
          }
        }
        // La soluzione del 2×2, scritta a mano: una `solve` generica qui
        // costerebbe più del sistema.
        const ex = (Gyy * bx - Gxy * by) / det;
        const ey = (Gxx * by - Gxy * bx) / det;
        if (!isFinite(ex) || !isFinite(ey)) return null;
        gx += ex; gy += ey;
        if (Math.abs(ex) + Math.abs(ey) < INS_LK_PASSO_MIN) break;
      }

      if (l > 0) { gx *= 2; gy *= 2; }
    }

    if (!isFinite(gx) || !isFinite(gy)) return null;
    return { dx: gx, dy: gy };
  }

  // La traslazione del riquadro, da una griglia di punti e con il controllo
  // avanti-indietro.
  //
  // Perché la **mediana** e non la media: un punto che si aggancia a una
  // nuvola dietro all'aereo dà uno spostamento plausibile e sbagliato, e una
  // media di nove numeri di cui uno è sbagliato è sbagliata di un nono. La
  // mediana di nove numeri di cui tre sono sbagliati è ancora giusta. È la
  // stessa scelta di `velocitaAngolare` in `visione.js`, e per la stessa
  // ragione.
  function insFlussoRiquadro(pPrec, pOra, riquadro, opz) {
    const o = opz || {};
    const nLato = o.punti || INS_LK_PUNTI;
    const dxs = [], dys = [];
    const w = Math.max(2, riquadro.w), h = Math.max(2, riquadro.h);
    // I punti si spargono dentro al riquadro ma non sul suo bordo: sul bordo
    // metà della finestra è fondo, e il fondo non ha gradienti.
    for (let i = 0; i < nLato; i++) {
      for (let j = 0; j < nLato; j++) {
        const fx = nLato === 1 ? 0.5 : (i + 0.5) / nLato;
        const fy = nLato === 1 ? 0.5 : (j + 0.5) / nLato;
        const x = riquadro.x - w / 2 + fx * w;
        const y = riquadro.y - h / 2 + fy * h;
        const avanti = insLucasKanadePunto(pPrec, pOra, x, y, o);
        if (!avanti) continue;
        // E ritorno: dal punto d'arrivo, nell'immagine di adesso, si insegue
        // all'indietro verso quella di prima. Se si torna dove si era
        // partiti, la corsa era buona; se no, quel punto ha agganciato
        // qualcos'altro e non lo dice in nessun altro modo.
        //
        // Il seme va **girato**, e sbagliarlo costa le corse buone invece
        // che quelle cattive. Il seme dell'andata vale per l'andata: usarlo
        // anche al ritorno vuol dire partire dalla parte opposta di dove si
        // deve arrivare, e quando il seme è grosso — il salto della
        // previsione, trenta pixel — il ritorno finisce fuori portata e la
        // corsa viene bocciata. Misurato: con il seme ereditato, attraversando
        // un salto di trenta pixel si perdeva un fotogramma su venti, cioè il
        // fotogramma del salto — l'unico che contava. Quello che ci si
        // aspetta al ritorno è esattamente l'opposto dell'andata, e partire
        // da lì non rende il controllo compiacente: se il punto si è
        // agganciato a qualcos'altro, l'immagine di prima lì non combacia e
        // il metodo se ne va da un'altra parte comunque.
        const indietro = insLucasKanadePunto(pOra, pPrec, x + avanti.dx, y + avanti.dy,
          Object.assign({}, o, { semeX: -avanti.dx, semeY: -avanti.dy }));
        if (!indietro) continue;
        const errore = Math.hypot(avanti.dx + indietro.dx, avanti.dy + indietro.dy);
        if (errore > (o.avantiIndietroMax || INS_LK_AVANTI_INDIETRO_MAX)) continue;
        dxs.push(avanti.dx); dys.push(avanti.dy);
      }
    }
    if (dxs.length < (o.puntiMin || INS_LK_PUNTI_MIN)) return null;
    return { dx: insMediana(dxs), dy: insMediana(dys), punti: dxs.length };
  }

  function insMediana(a) {
    const b = a.slice().sort((x, y) => x - y);
    const n = b.length;
    return n % 2 ? b[n >> 1] : 0.5 * (b[n / 2 - 1] + b[n / 2]);
  }

  // ===================================================================
  // §3. Il rivelatore: la sagoma dentro alla patch
  // ===================================================================
  //
  // È il filtro adattato del cappello, in tre passi: si toglie il fondo
  // locale, si tiene quello che se ne stacca di più di qualche scarto tipico,
  // e della componente connessa che ne esce si prende il baricentro pesato.
  //
  // Due cose lo distinguono dal rivelatore di `visione.js`, e vengono tutt'e
  // due dal fatto che qui si cerca **una cosa sola in un posto noto** invece
  // che tutto quello che c'è:
  //
  //   - il **segno** conta e si dichiara. Di giorno un aereo è una sagoma
  //     scura contro il cielo chiaro, di notte una lucina. Chi chiama sa già
  //     che ora è (`sky.luceCielo`), quindi può dirlo, e dirlo dimezza le
  //     macchie sbagliate: al crepuscolo si prendono tutt'e due i versi.
  //   - si tiene **la migliore e basta**, pesata per quanto è vicina a dove
  //     l'aereo era previsto. Una patch di cielo attorno a un aereo può
  //     contenere un altro aereo, un uccello, il bordo di una nuvola; e il
  //     modo di non sbagliare non è una soglia più alta — è sapere che
  //     l'aereo che si cerca sta lì in mezzo, a meno di quello che il filtro
  //     non ha ancora corretto.

  // La somma integrale, per avere la media di una scatola in quattro letture
  // invece che in `(2r+1)²`. Con raggio undici la differenza è un fattore
  // cinquecento, e senza di lei il rivelatore costerebbe più del flusso
  // ottico che dovrebbe risparmiare.
  function insIntegrale(luma, L, H, fuori) {
    const S = fuori || new Float64Array((L + 1) * (H + 1));
    const W = L + 1;
    for (let x = 0; x <= L; x++) S[x] = 0;
    for (let y = 0; y < H; y++) {
      let riga = 0;
      const o = (y + 1) * W, p = y * W;
      S[o] = 0;
      for (let x = 0; x < L; x++) {
        riga += luma[y * L + x];
        S[o + x + 1] = S[p + x + 1] + riga;
      }
    }
    return S;
  }

  function insMediaScatola(S, L, H, x, y, r) {
    const W = L + 1;
    const x0 = Math.max(0, x - r), x1 = Math.min(L, x + r + 1);
    const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
    const n = (x1 - x0) * (y1 - y0);
    if (n <= 0) return 0;
    return (S[y1 * W + x1] - S[y0 * W + x1] - S[y1 * W + x0] + S[y0 * W + x0]) / n;
  }

  // Il residuo: quanto ogni pixel si stacca dal suo fondo locale, col segno.
  function insResiduo(luma, L, H, raggio, fuori) {
    const res = fuori || new Float32Array(L * H);
    const S = insIntegrale(luma, L, H, scorta('det:integrale', (L + 1) * (H + 1), Float64Array));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < L; x++) {
        res[y * L + x] = luma[y * L + x] - insMediaScatola(S, L, H, x, y, raggio);
      }
    }
    return res;
  }

  // Lo scarto tipico del residuo, con un istogramma a due passate invece di
  // un ordinamento. È la stessa cura del §3 di `visione.js`, e vale la pena
  // ripeterne la ragione: la scala dell'istogramma **non** si prende dal
  // massimo — con una sagoma forte dentro al campione il fondo scala va a
  // duecento livelli, la mediana casca tutta nella prima casella e quello che
  // esce è mezza casella travestita da misura.
  function insScartoTipico(res, L, H) {
    const n = L * H;
    let somma = 0;
    const passo = Math.max(1, Math.floor(n / 4000));
    let quanti = 0;
    for (let i = 0; i < n; i += passo) { somma += Math.abs(res[i]); quanti++; }
    if (!quanti) return 1;
    const media = somma / quanti;
    if (!(media > 0)) return 1;
    const scala = 6 * media;       // fondo scala abbondante, e non il massimo
    const CASELLE = 64;
    const isto = scorta('det:isto', CASELLE, Int32Array);
    isto.fill(0);
    for (let i = 0; i < n; i += passo) {
      const v = Math.min(CASELLE - 1, Math.floor(Math.abs(res[i]) / scala * CASELLE));
      isto[v]++;
    }
    let cum = 0, meta = quanti / 2, c = 0;
    for (; c < CASELLE; c++) { if (cum + isto[c] >= meta) break; cum += isto[c]; }
    // La seconda passata, dentro alla casella in cui la mediana è cascata.
    const a = c * scala / CASELLE, b = (c + 1) * scala / CASELLE;
    let dentro = 0, sotto = 0;
    for (let i = 0; i < n; i += passo) {
      const v = Math.abs(res[i]);
      if (v < a) sotto++;
      else if (v < b) dentro++;
    }
    const mediana = dentro > 0 ? a + (b - a) * (meta - sotto) / dentro : a;
    // Da mediana degli assoluti a scarto tipico, per un rumore gaussiano.
    return Math.max(0.35, mediana / 0.6745);
  }

  // La rilevazione vera e propria. `attesa` è dove il chiamante crede che
  // l'aereo stia, in pixel della patch, e serve a due cose: a pesare i
  // candidati (il più vicino vince a parità di forza) e a scartare quello che
  // sta troppo in là per essere lui.
  function insRilevaSagoma(luma, L, H, opz) {
    const o = opz || {};
    const raggio = o.raggioFondo || INS_FONDO_RAGGIO;
    const polarita = o.polarita || 0;   // +1 chiaro, −1 scuro, 0 tutt'e due
    const ax = (o.attesaX !== undefined) ? o.attesaX : L / 2;
    const ay = (o.attesaY !== undefined) ? o.attesaY : H / 2;
    const gate = o.gate || Math.min(L, H) / 2;

    const res = insResiduo(luma, L, H, raggio, scorta('det:res', L * H, Float32Array));
    const sigma = insScartoTipico(res, L, H);
    const soglia = Math.max(o.sogliaMin || INS_SOGLIA_MIN, (o.sigma || INS_SOGLIA_SIGMA) * sigma);

    const areaMax = Math.max(12, L * H * INS_AREA_MAX_QUOTA);
    const etichette = scorta('det:etichette', L * H, Int32Array);
    etichette.fill(0);
    const coda = scorta('det:coda', L * H, Int32Array);
    let miglior = null, idEtichetta = 0;
    const bordo = 1;

    for (let y = bordo; y < H - bordo; y++) {
      for (let x = bordo; x < L - bordo; x++) {
        const p = y * L + x;
        if (etichette[p]) continue;
        const v = res[p];
        const segno = v > 0 ? 1 : -1;
        if (Math.abs(v) < soglia) continue;
        if (polarita && segno !== polarita) continue;

        // La componente connessa, a otto vicini. Si marca comunque per intero
        // — anche quando si capisce che è da scartare — se no i suoi pixel
        // ripartono come componenti nuove e una nuvola diventa cinquanta
        // macchine.
        idEtichetta++;
        let testa = 0, fine = 1;
        let xmin = x, xmax = x, ymin = y, ymax = y;
        let sx = 0, sy = 0, peso = 0, picco = 0, tocca = false;
        coda[0] = p; etichette[p] = idEtichetta;
        while (testa < fine) {
          const q = coda[testa++];
          const qx = q % L, qy = (q / L) | 0;
          if (qx <= bordo || qx >= L - bordo - 1 || qy <= bordo || qy >= H - bordo - 1) tocca = true;
          if (qx < xmin) xmin = qx; if (qx > xmax) xmax = qx;
          if (qy < ymin) ymin = qy; if (qy > ymax) ymax = qy;
          const w = Math.abs(res[q]);
          sx += (qx + 0.5) * w; sy += (qy + 0.5) * w; peso += w;
          if (w > picco) picco = w;
          if (fine < areaMax * 4) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = qx + dx, ny = qy + dy;
                if (nx < bordo || nx >= L - bordo || ny < bordo || ny >= H - bordo) continue;
                const nn = ny * L + nx;
                if (etichette[nn]) continue;
                if (res[nn] * segno < soglia) continue;
                etichette[nn] = idEtichetta; coda[fine++] = nn;
              }
            }
          }
        }

        const w = xmax - xmin + 1, h = ymax - ymin + 1;
        // Chi tocca il bordo della patch è tagliato, quindi il suo baricentro
        // è il baricentro della parte che si vede e non dell'oggetto: si
        // scarta. È anche il modo in cui una nuvola che entra da un lato non
        // diventa mai un aereo.
        if (tocca || fine < INS_AREA_MIN || fine > areaMax) continue;
        if (Math.max(w / h, h / w) > INS_ASPETTO_MAX) continue;
        if (!(peso > 0)) continue;

        const cx = sx / peso, cy = sy / peso;
        const d = Math.hypot(cx - ax, cy - ay);
        if (d > gate) continue;
        // Il punteggio: la forza della macchia, scontata da quanto sta
        // lontano da dove l'aereo era previsto. Il mezzo gate al denominatore
        // vuol dire che una macchia sul bordo del cancello deve essere tre
        // volte più forte di una al centro per vincere — che è il modo di
        // dire «preferisco quella prevista, ma non a qualunque costo».
        const punteggio = picco / (1 + 2 * d / gate);
        if (!miglior || punteggio > miglior.punteggio) {
          miglior = {
            x: cx, y: cy, w, h, area: fine, picco, segno,
            punteggio, sigma, soglia,
            // Il raggio equivalente: serve a dimensionare la finestra del
            // flusso ottico al giro dopo.
            raggio: Math.sqrt(fine / Math.PI)
          };
        }
      }
    }
    return miglior;
  }

  // I rivelatori, per nome. È il punto in cui YOLO si innesta senza che
  // nient'altro se ne accorga (§7).
  const insRivelatori = {
    macchia: (patch, opz) => insRilevaSagoma(patch.luma, patch.L, patch.H, opz)
  };

  // ===================================================================
  // §4. Il filtro: Kalman a velocità costante, in gradi
  // ===================================================================
  //
  // Due filtri a una dimensione invece di uno a due, ed è una semplificazione
  // **esatta** e non una scorciatoia: con rumore di processo e di misura
  // diagonali le due coordinate non si parlano, quindi un 4×4 darebbe cifra
  // per cifra gli stessi numeri di due 2×2 al decimo del costo.
  //
  // Su che cosa si filtra, che è la scelta che conta: non sull'azimut e
  // sull'altezza — che si avvolgono, e a nord il filtro impazzirebbe — ma
  // sullo **scarto** fra dove l'aereo si vede e dove il feed dice che
  // dovrebbe essere, scritto in gradi di cielo veri:
  //
  //     ex = Δazimut · cos(altezza)      ey = Δaltezza
  //
  // Il coseno non è un ornamento: senza, a settanta gradi di altezza un
  // grado di azimut varrebbe un terzo di grado di cielo, e il filtro
  // crederebbe di vedere accelerazioni che non ci sono.
  //
  // E la velocità nello stato non serve a levigare: serve a **continuare**.
  // Fra una misura e l'altra passano cinque centesimi di secondo, e in quel
  // tempo la previsione si muove con la velocità che ha appena misurato
  // invece di restare ferma. È quella riga a togliere il saltino.

  function insFiltroNuovo(ex, ey) {
    const P = () => ({ x: 0, v: 0, p00: 1, p01: 0, p11: 1 });
    const a = P(), b = P();
    a.x = ex; b.x = ey;
    return { x: a, y: b, quando: 0 };
  }

  function insPrevedi1(s, dt, accel) {
    s.x += s.v * dt;
    const q = accel * accel;
    const q00 = q * dt * dt * dt / 3, q01 = q * dt * dt / 2, q11 = q * dt;
    s.p00 += dt * (2 * s.p01 + dt * s.p11) + q00;
    s.p01 += dt * s.p11 + q01;
    s.p11 += q11;
  }

  function insCorreggi1(s, z, R) {
    const S = s.p00 + R;
    if (!(S > 0)) return 0;
    const k0 = s.p00 / S, k1 = s.p01 / S;
    const innovazione = z - s.x;
    s.x += k0 * innovazione;
    s.v += k1 * innovazione;
    const p00 = s.p00, p01 = s.p01;
    s.p00 = p00 - k0 * p00;
    s.p01 = p01 - k0 * p01;
    s.p11 = s.p11 - k1 * p01;
    return innovazione;
  }

  function insFiltroPrevedi(f, dt) {
    const d = Math.min(0.5, Math.max(0.001, dt));
    insPrevedi1(f.x, d, INS_KALMAN_ACCEL);
    insPrevedi1(f.y, d, INS_KALMAN_ACCEL);
  }

  // Torna `false` quando la misura è stata rifiutata: succede e va detto,
  // perché una misura rifiutata è una perdita e tre perdite sono una traccia
  // da rifare da capo. Ingoiarla in silenzio vorrebbe dire una traccia che
  // resta «viva» mentre non misura più niente, cioè un'etichetta ferma sopra
  // un aereo che se n'è andato.
  function insFiltroCorreggi(f, ex, ey, R) {
    const innov = Math.hypot(ex - f.x.x, ey - f.y.x);
    if (innov > INS_INNOVAZIONE_MAX) return false;
    insCorreggi1(f.x, ex, R * R);
    insCorreggi1(f.y, ey, R * R);
    return true;
  }

  // ===================================================================
  // §5. Il ritaglio: dalla schermata al fotogramma nativo
  // ===================================================================
  //
  // Il video è disegnato con `object-fit: cover`, cioè ingrandito quel tanto
  // che basta a coprire il riquadro e tagliato di quel che avanza. La
  // geometria è la stessa di `geometriaVideo` in `visione.js` — ed è
  // **ricopiata qui di proposito**, con l'avvertimento che ogni copia in
  // questo progetto si porta dietro: quella funzione è chiusa dentro all'IIFE
  // di quel file e non si può chiamare da qui, e il giorno in cui una delle
  // due cambia non lo dice nessuno. Le due righe che contano sono la scala
  // (`max`, non `min`: è «cover») e il fatto che il ritaglio sia centrato.
  //
  // Da lì in poi il conto è una proporzione, ma nella direzione giusta:
  // questo modulo non ridimensiona niente. La patch si prende a risoluzione
  // **nativa**, perché è tutto il punto — ridurla vorrebbe dire rifare il
  // difetto che si sta curando.

  function insGeometriaVideo(video, cw, ch) {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh || !cw || !ch) return null;
    const scala = Math.max(cw / vw, ch / vh);
    const sw = Math.min(vw, cw / scala);
    const sh = Math.min(vh, ch / scala);
    return {
      sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh, vw, vh, cw, ch,
      // Da un pixel del riquadro a un pixel del video, e viceversa.
      perPixel: sw / cw
    };
  }

  // Il rettangolo da ritagliare, in pixel del video, attorno a un punto del
  // riquadro. Torna `null` quando la patch uscirebbe dal fotogramma per più
  // di metà: un ritaglio mezzo fuori si può fare (il browser lo riempie di
  // trasparente) e non si deve — quei pixel neri entrano nella stima del
  // fondo e la falsano esattamente dove serve che sia giusta.
  function insRettangoloPatch(geo, px, py, lato) {
    const vx = geo.sx + px * geo.perPixel;
    const vy = geo.sy + py * geo.perPixel;
    const l = Math.min(lato, Math.floor(Math.min(geo.vw, geo.vh) * INS_PATCH_QUOTA_MAX));
    if (l < 48) return null;
    const x0 = Math.round(vx - l / 2), y0 = Math.round(vy - l / 2);
    // Dentro al **ritaglio visibile**, non dentro al fotogramma: quello che
    // sta fuori dal ritaglio è video che l'utente non vede, e agganciarsi lì
    // vorrebbe dire un'etichetta appesa a una sagoma fuori dallo schermo.
    const bx0 = Math.ceil(geo.sx), by0 = Math.ceil(geo.sy);
    const bx1 = Math.floor(geo.sx + geo.sw), by1 = Math.floor(geo.sy + geo.sh);
    const cx0 = Math.max(bx0, Math.min(bx1 - l, x0));
    const cy0 = Math.max(by0, Math.min(by1 - l, y0));
    if (cx0 < bx0 || cy0 < by0 || cx0 + l > bx1 || cy0 + l > by1) return null;
    // Di quanto la patch è stata spostata per restare dentro: chi legge il
    // risultato deve saperlo, se no il centro della patch non è il centro che
    // aveva chiesto e tutte le distanze sono sbagliate di quello scarto.
    return { x: cx0, y: cy0, lato: l, spostataX: cx0 - x0, spostataY: cy0 - y0 };
  }

  // Dal pixel della patch al pixel del riquadro. È l'inversa di sopra, ed è
  // la riga per cui il rimappaggio non si sbaglia: una sola funzione, usata
  // da tutti.
  function insPatchAlRiquadro(geo, rett, x, y) {
    return {
      px: ((rett.x + x) - geo.sx) / geo.perPixel,
      py: ((rett.y + y) - geo.sy) / geo.perPixel
    };
  }

  // ===================================================================
  // §6. Il trasporto: il worker, e il ripiego sul filo principale
  // ===================================================================
  //
  // Il protocollo è volutamente povero — una patch di là, un riquadro di qua
  // — e per una ragione: un worker che tiene stato è un worker che si
  // disallinea, e quando si disallinea non lo dice. Qui lo stato che il
  // worker tiene è uno solo, la piramide del fotogramma precedente per ogni
  // traccia, ed è lo stato che **non si può** tenere altrove: rimandarlo
  // avanti e indietro vorrebbe dire copiare trentasettemila numeri per
  // fotogramma, che è precisamente quello che il trasferimento serve a
  // evitare.

  // Lo stato del worker: una piramide per traccia.
  const memoriaWorker = new Map();

  // Il lavoro vero, che gira **dove capita** — dentro al worker se il worker
  // c'è, sul filo principale se no. È la stessa funzione: vedi il cappello.
  function insLavora(messaggio, luma) {
    const { id, L, H, rileva, semeX, semeY, opzioni } = messaggio;
    const patch = { luma, L, H };
    let mem = memoriaWorker.get(id);
    // La patch può cambiare misura strada facendo — `insRettangoloPatch` la
    // tosa quando il fotogramma è piccolo o quando il ritaglio visibile
    // stringe. Due piramidi di misura diversa si confrontano lo stesso e
    // danno numeri, ed è il modo peggiore di sbagliare: si rileva da capo.
    if (mem && (mem.L !== L || mem.H !== H)) { memoriaWorker.delete(id); mem = null; }
    const chiave = 'trk:' + id;
    const piramide = insPiramide(luma, L, H, INS_LK_LIVELLI, chiave + ':ora');

    // Il rilevamento: o perché tocca (ogni `INS_PASSO_RILEVA` giri), o perché
    // l'inseguimento ha perso il bersaglio. Le due strade danno lo stesso
    // genere di risposta, e chi chiama non ha bisogno di sapere quale è
    // stata — glielo si dice comunque in `modo`, perché il filtro pesa le due
    // misure in modo diverso (§4).
    let esito = null;
    if (rileva || !mem || !mem.riquadro) {
      const nome = (opzioni && opzioni.rivelatore) || (insYoloPronto() ? 'yolo' : 'macchia');
      const trova = insRivelatori[nome] || insRivelatori.macchia;
      const m = trova(patch, opzioni || {});
      if (m) {
        esito = {
          x: m.x, y: m.y, w: m.w, h: m.h, raggio: m.raggio,
          forza: m.picco / Math.max(0.35, m.sigma), modo: 'rilevato',
          segno: m.segno, area: m.area,
          // Lo scarto tipico del cielo qui attorno: lo eredita
          // l'inseguimento, che ci taglia la sua soglia (sopra).
          sigma: m.sigma
        };
      }
    } else {
      // L'inseguimento, e qui c'è la riga che rende coerente tutto il resto.
      //
      // Il riquadro tenuto in memoria è nelle coordinate della patch di
      // **prima**, e la patch di adesso non è quella di prima: insegue la
      // previsione, quindi a ogni fotogramma è ritagliata qualche pixel più
      // in là. Lo stesso punto del mondo ha perciò due coordinate diverse
      // nelle due patch, e la differenza fra loro è di due nature:
      //
      //     pc − pp = (ritaglio di prima − ritaglio di adesso) + movimento
      //
      // Il primo addendo è **scorrimento** e si sa esattamente (sono due
      // numeri interi); il secondo è quanto il mondo si è girato sotto la
      // camera, e lo sa il giroscopio. Il chiamante somma i due e li manda
      // come seme (§8), e al flusso ottico resta da coprire il solo
      // movimento **dell'aereo** — un pixel o due. Senza il seme dovrebbe
      // coprire anche la mano, che a trenta gradi al secondo sono
      // venticinque pixel per fotogramma: fuori portata anche con la
      // piramide, e il sintomo sarebbe una traccia che si perde appena ci si
      // muove, cioè proprio quando serve.
      //
      // Il punto di partenza resta quindi in coordinate di **prima** e il
      // risultato esce in coordinate di adesso, che è ciò che il chiamante
      // si aspetta.
      const f = insFlussoRiquadro(mem.piramide, piramide, mem.riquadro, {
        semeX: semeX || 0, semeY: semeY || 0,
        // La soglia dell'autovalore in scarti tipici del **cielo di questa
        // patch**, misurato dall'ultima rilevazione: vedi
        // `INS_LK_AUTOVALORE_SIGMA`.
        autovaloreMin: mem.sigma
          ? Math.max(INS_LK_AUTOVALORE_MIN, INS_LK_AUTOVALORE_SIGMA * mem.sigma * mem.sigma)
          : INS_LK_AUTOVALORE_MIN
      });
      if (f) {
        esito = {
          x: mem.riquadro.x + f.dx, y: mem.riquadro.y + f.dy,
          w: mem.riquadro.w, h: mem.riquadro.h, raggio: mem.riquadro.raggio,
          forza: f.punti, modo: 'inseguito', punti: f.punti
        };
      }
    }

    if (esito) {
      memoriaWorker.set(id, {
        L, H,
        // Lo scarto tipico si porta avanti fra una rilevazione e l'altra: una
        // corsa di flusso ottico non lo misura, e senza di lui la soglia
        // tornerebbe al pavimento proprio nei venti fotogrammi in cui si
        // insegue.
        sigma: (esito.sigma !== undefined) ? esito.sigma : (mem && mem.sigma),
        piramide: insPiramideCopia(piramide, chiave + ':prec'),
        riquadro: { x: esito.x, y: esito.y, w: esito.w, h: esito.h, raggio: esito.raggio }
      });
    } else if (mem) {
      memoriaWorker.delete(id);
    }
    return esito;
  }

  // La piramide del fotogramma di adesso diventa quella «di prima» del giro
  // successivo, e va **copiata**: le scorte si riusano, quindi tenendo un
  // riferimento si terrebbe un array che il giro dopo viene riscritto —
  // cioè si confronterebbe il fotogramma con sé stesso, che non fallisce e
  // restituisce zero.
  function insPiramideCopia(p, chiave) {
    return p.map((l, i) => {
      const dst = scorta(chiave + i, l.L * l.H, Float32Array);
      dst.set(l.dati.subarray(0, l.L * l.H));
      return { dati: dst, L: l.L, H: l.H };
    });
  }

  // Quando l'aereo esce di scena la sua memoria va via con lui: un `Map` che
  // cresce per tutta la sessione è la perdita di memoria che nessuno vede. E
  // con lui vanno via le sue **scorte**, che sono la parte grossa: due
  // piramidi da trentasettemila numeri per traccia, cioè trecento kilobyte a
  // testa. In una serata sotto una rotta trafficata passano centinaia di
  // aerei, e senza questa riga resterebbero tutti in memoria.
  function insScorda(id) {
    memoriaWorker.delete(id);
    const prefisso = 'trk:' + id;
    scorte.forEach((v, k) => { if (k.indexOf(prefisso) === 0) scorte.delete(k); });
  }

  // ===================================================================
  // §7. Il rivelatore neurale, se qualcuno lo configura
  // ===================================================================
  //
  // Vive solo dentro al worker, si carica alla prima richiesta e non blocca
  // niente: finché non è pronto risponde il rivelatore del §3, e quando è
  // pronto subentra. Se il caricamento fallisce — non c'è rete, l'indirizzo è
  // sbagliato, il modello non si apre — si **dice una volta sola** e non si
  // riprova: un rivelatore che ci prova a ogni fotogramma su una rete che non
  // c'è è un fotogramma perso a ogni fotogramma.
  //
  // Che cosa si aspetta: un ONNX di YOLOv8 o YOLO11, ingresso
  // `[1, 3, lato, lato]` in RGB normalizzato a zero-uno, uscita
  // `[1, 4 + classi, ancore]` — cioè il formato che esce da
  // `yolo export format=onnx` senza toccare niente.

  let yoloStato = 'spento';   // spento | carico | pronto | guasto
  let yoloSessione = null;
  let yoloLato = INS_MODELLO_LATO;

  function insYoloPronto() { return yoloStato === 'pronto' && !!yoloSessione; }

  function insYoloCarica(modello, runtime) {
    if (!NEL_WORKER || !modello || yoloStato !== 'spento') return;
    const ortUrl = runtime || INS_ORT_PREDEFINITO;
    yoloStato = 'carico';
    try {
      importScripts(ortUrl);
    } catch (e) {
      yoloStato = 'guasto';
      self.postMessage({ tipo: 'diagnostica', yolo: 'runtime-non-caricato', dettaglio: String(e) });
      return;
    }
    const ort = self.ort;
    if (!ort || !ort.InferenceSession) { yoloStato = 'guasto'; return; }
    // `wasmPaths` va dichiarato, se no il runtime cerca i suoi `.wasm`
    // accanto allo script della pagina — che qui è la radice dell'app, dove
    // non ci sono: e il guasto che ne esce parla di un file mancante invece
    // che di una configurazione mancante.
    try { ort.env.wasm.wasmPaths = ortUrl.replace(/[^/]+$/, ''); } catch (e) { /* vecchie versioni */ }
    ort.InferenceSession.create(modello, {
      executionProviders: ['wasm'], graphOptimizationLevel: 'all'
    }).then(s => {
      yoloSessione = s;
      yoloStato = 'pronto';
      self.postMessage({ tipo: 'diagnostica', yolo: 'pronto' });
    }).catch(e => {
      yoloStato = 'guasto';
      self.postMessage({ tipo: 'diagnostica', yolo: 'modello-non-aperto', dettaglio: String(e) });
    });
  }

  // Il ridimensionamento con le bande («letterbox»): il modello vuole un
  // quadrato di lato fisso, la patch è già quadrata, quindi qui è una
  // proporzione e basta — ma la funzione tiene il caso generale perché la
  // patch quadrata è una scelta di oggi (§5) e non una legge.
  function insYoloIngresso(luma3, L, H, lato, fuori) {
    const t = fuori || new Float32Array(3 * lato * lato);
    const s = Math.min(lato / L, lato / H);
    const nl = Math.round(L * s), nh = Math.round(H * s);
    const ox = (lato - nl) >> 1, oy = (lato - nh) >> 1;
    t.fill(0.447);   // il grigio di riempimento che Ultralytics usa: 114/255
    const piano = lato * lato;
    for (let y = 0; y < nh; y++) {
      const sy = Math.min(H - 1, Math.floor(y / s));
      for (let x = 0; x < nl; x++) {
        const sx = Math.min(L - 1, Math.floor(x / s));
        const src = (sy * L + sx) * 4;
        const dst = (y + oy) * lato + (x + ox);
        t[dst] = luma3[src] / 255;
        t[piano + dst] = luma3[src + 1] / 255;
        t[2 * piano + dst] = luma3[src + 2] / 255;
      }
    }
    return { tensore: t, scala: s, ox, oy };
  }

  // Dall'uscita del modello al riquadro migliore, riportato nelle coordinate
  // della patch. Non c'è nessuna soppressione dei non-massimi, e non è una
  // dimenticanza: qui si cerca **un** aereo in un posto noto, quindi si tiene
  // il più fiducioso dentro al cancello e si butta il resto — che è la stessa
  // cosa che fa la NMS quando il vero positivo è uno solo, al decimo del
  // codice.
  function insYoloLeggi(uscita, forma, prep, opz) {
    const [, canali, ancore] = forma;
    const classi = canali - 4;
    if (classi < 1) return null;
    const ax = opz.attesaX, ay = opz.attesaY, gate = opz.gate;
    let miglior = null;
    for (let i = 0; i < ancore; i++) {
      const f = uscita[(4 + INS_YOLO_CLASSE) * ancore + i];
      if (f < INS_YOLO_FIDUCIA) continue;
      const cx = (uscita[0 * ancore + i] - prep.ox) / prep.scala;
      const cy = (uscita[1 * ancore + i] - prep.oy) / prep.scala;
      const w = uscita[2 * ancore + i] / prep.scala;
      const h = uscita[3 * ancore + i] / prep.scala;
      const d = Math.hypot(cx - ax, cy - ay);
      if (d > gate) continue;
      const punteggio = f / (1 + 2 * d / gate);
      if (!miglior || punteggio > miglior.punteggio) {
        miglior = {
          x: cx, y: cy, w, h, punteggio,
          raggio: Math.sqrt(Math.max(1, w * h) / Math.PI),
          picco: f * 255, sigma: 1, segno: 0, area: w * h
        };
      }
    }
    return miglior;
  }

  // ===================================================================
  // §8. Il ciclo e le tracce — solo nella pagina
  // ===================================================================

  if (!NEL_WORKER) {

    const stato = {
      acceso: true,
      attivo: false,
      worker: null,
      workerVivo: false,
      inVolo: 0,
      tracce: new Map(),     // id aereo → traccia
      giro: 0,
      turno: 0,
      costo: 0,
      ultimoQuando: 0,
      ultimaPosa: null,
      motoGradiS: 0,
      guastoDetto: false,
      yolo: INS_MODELLO_URL ? 'in-attesa' : 'spento',
      // Il ripiego: la tela su cui si legge la patch quando il worker non c'è.
      tela: null, ctx: null
    };

    // --- Il worker ------------------------------------------------------

    function insApriWorker() {
      if (stato.worker) return;
      // Un tentativo solo: da `file://` fallisce sempre, e riprovarci a ogni
      // accensione della fotocamera vuol dire un'eccezione in console a ogni
      // accensione. Il ripiego sul filo principale è già la risposta.
      if (stato.tentatoWorker) return;
      stato.tentatoWorker = true;
      // Da `file://` questo solleva, e va benissimo: si ripiega sul filo
      // principale, che su una patch costa un millisecondo.
      try {
        const w = new Worker('inseguimento.js');
        w.onmessage = (ev) => {
          const m = ev.data || {};
          if (m.tipo === 'diagnostica') { stato.yolo = m.yolo; return; }
          if (m.tipo !== 'esito') return;
          stato.inVolo = Math.max(0, stato.inVolo - 1);
          insRicevi(m);
        };
        w.onerror = () => {
          // Un worker che muore a metà sessione non deve portarsi via
          // l'inseguimento: si chiude e si continua sul filo principale.
          stato.workerVivo = false;
          stato.worker = null;
          stato.inVolo = 0;
        };
        stato.worker = w;
        stato.workerVivo = true;
        if (INS_MODELLO_URL) {
          w.postMessage({ tipo: 'carica-modello', modello: INS_MODELLO_URL, runtime: INS_ORT_URL });
        }
      } catch (e) {
        stato.workerVivo = false;
      }
    }

    // --- Le tracce -------------------------------------------------------

    function tracciaNuova(id) {
      return {
        id,
        filtro: null,
        riquadro: null,        // nelle coordinate della patch dell'ultimo giro
        rett: null,            // il ritaglio dell'ultimo giro, in pixel del video
        posaPrec: null,        // la posa con cui è stato misurato l'ultimo giro
        altUltima: 0,          // l'altezza a cui si è misurato: serve a disfare il coseno
        conferme: 0,
        perdite: 0,
        viva: false,
        quando: 0,
        ultimaMisura: 0,
        modo: '',
        giriDaRilevare: 0,
        // La direzione dell'aereo **nel mondo** all'ultimo aggiornamento. È
        // la stessa scelta di `stato.segni` in `visione.js`, e per la stessa
        // ragione: fra un aggiornamento e l'altro la vista si muove, e un
        // punto tenuto in coordinate di schermo resterebbe indietro.
        vettore: null
      };
    }

    // Chi si insegue: gli aerei vicini che il cielo calcolato mette in quadro.
    // Si ordinano per **vicinanza** e non per luminosità, ed è la scelta che
    // conta: è al vicino che l'errore di propagazione fa più danno (ottocento
    // metri a tre chilometri sono quindici gradi, a quaranta chilometri uno),
    // ed è il vicino che sul sensore lascia abbastanza pixel da inseguire.
    function insCandidati(base, focale) {
      const fuori = [];
      const L = sky.larghezza, H = sky.altezza;
      if (!L || !H) return fuori;
      const aerei = (typeof AereiADS_B === 'object' && AereiADS_B.stato && AereiADS_B.stato.aerei) || [];
      for (const a of aerei) {
        if (!a || typeof a.az !== 'number' || typeof a.alt !== 'number') continue;
        if (a.alt < 1) continue;
        if (typeof a.distanzaKm === 'number' && a.distanzaKm > INS_DISTANZA_MAX_KM) continue;
        const v = skyVettore(a.az, a.alt);
        const p = skyProietta(v, base, focale);
        if (!p.davanti) continue;
        // Dentro al riquadro con un margine stretto: una patch centrata sul
        // bordo esce per metà, e `insRettangoloPatch` la rifiuterebbe comunque
        // — tanto vale non chiederla.
        if (p.px < 0 || p.px > L || p.py < 0 || p.py > H) continue;
        // L'ancora **applicata**, cioè quella che il planetario sta
        // disegnando adesso, e qui c'è l'unica sottigliezza di tutto il
        // modulo. `a.az` e `a.alt` non sono la posizione del feed: sono
        // quella del feed più l'ancora, perché `ancoraVista` in `aerei.js`
        // gliel'ha già sommata. Misurando lo scarto contro di loro si
        // misurerebbe quindi un **incremento**, che a convergenza vale zero
        // — e un filtro che riceve zero come misura assoluta riporta l'ancora
        // a zero, cioè l'etichetta torna dov'era e riparte: un'oscillazione
        // lenta che sullo schermo si legge come un'etichetta che respira.
        //
        // Il filtro vuole invece lo scarto dal **feed**, che è una grandezza
        // che sta ferma. Lo si ottiene risommando quello che è stato tolto, e
        // per saperlo si chiede alla stessa funzione che il disegno
        // interroga: qualunque cosa risponda `visAncoraAereo` è ciò che è
        // stato applicato, quindi non c'è nessuna seconda contabilità da
        // tenere allineata. Fra questa lettura e quella del disegno passa un
        // fotogramma, cioè qualche centesimo di grado: dentro al rumore, e
        // comunque un anello che converge.
        const applicata = (typeof visAncoraAereo === 'function' ? visAncoraAereo(a.id) : null)
          || { dAz: 0, dAlt: 0 };
        fuori.push({
          id: String(a.id), az: a.az, alt: a.alt, vettore: v,
          px: p.px, py: p.py, applicata,
          km: typeof a.distanzaKm === 'number' ? a.distanzaKm : 999
        });
      }
      fuori.sort((x, y) => x.km - y.km);
      return fuori.slice(0, INS_TRACCE_MAX);
    }

    // Di quanto il mondo è scivolato sotto la camera da quando questa traccia
    // è stata misurata l'ultima volta, **in pixel del video**. È la metà
    // giroscopica del seme del flusso ottico (§6).
    //
    // Si misura proiettando la **stessa direzione** con le due pose — quella
    // di allora e quella di adesso — e guardando di quanto il suo punto si è
    // spostato sullo schermo. Non si passa per gli angoli: la proiezione è
    // stereografica e non lineare, quindi un grado al centro della vista non
    // vale i pixel di un grado sul bordo, e il conto in gradi sbaglierebbe
    // proprio dove la patch è più lontana dal centro.
    //
    // I pixel del riquadro diventano pixel del video moltiplicando per
    // `perPixel` (il video è più fitto dello schermo: vedi §5) — dividere,
    // che è l'errore che viene in mente, darebbe un seme più piccolo del
    // vero di un fattore due e il flusso ottico resterebbe indietro.
    function semeDaGiroscopio(t, base, focale, geo) {
      if (!t.vettore || !t.posaPrec) return { x: 0, y: 0 };
      const a = skyProietta(t.vettore, t.posaPrec.base, t.posaPrec.focale);
      const b = skyProietta(t.vettore, base, focale);
      if (!a.davanti || !b.davanti) return { x: 0, y: 0 };
      return { x: (b.px - a.px) * geo.perPixel, y: (b.py - a.py) * geo.perPixel };
    }

    // --- Il giro ---------------------------------------------------------

    // Chiamata dal ciclo di disegno, dopo `visAggiorna`. Costa il confronto
    // fra due numeri quando non c'è niente da fare, e una patch quando c'è.
    function insAggiorna(base, focale) {
      if (!stato.attivo || !stato.acceso || !base || !focale) return;
      if (typeof sky !== 'object' || !sky.camera) return;
      const ora = performance.now();
      const dt = stato.ultimoQuando ? (ora - stato.ultimoQuando) / 1000 : 0.016;
      stato.ultimoQuando = ora;

      // Quanto sta girando il telefono. Si legge dalla posa, come in
      // `visione.js`, e serve a una cosa sola: mentre si gira forte l'immagine
      // è mossa e il flusso ottico inseguirebbe la sfocatura. Non è un
      // fallimento — le tracce restano vive e il filtro continua a muoverle
      // con la velocità che ha.
      if (stato.ultimaPosa && dt > 0.0005) {
        const c = Math.max(-1, Math.min(1,
          base.f[0] * stato.ultimaPosa[0] + base.f[1] * stato.ultimaPosa[1] + base.f[2] * stato.ultimaPosa[2]));
        stato.motoGradiS = 0.7 * stato.motoGradiS + 0.3 * (Math.acos(c) * R2D / dt);
      }
      stato.ultimaPosa = [base.f[0], base.f[1], base.f[2]];

      const candidati = insCandidati(base, focale);
      const vivi = new Set(candidati.map(c => c.id));
      // Chi è uscito di scena: la sua traccia e la sua memoria se ne vanno.
      stato.tracce.forEach((t, id) => {
        if (vivi.has(id) && ora - t.quando < INS_TRACCIA_VITA_MS) return;
        stato.tracce.delete(id);
        insDimentica(id);
      });
      if (!candidati.length) return;

      // Il filtro cammina per tutte le tracce a ogni fotogramma — è un
      // pugno di moltiplicazioni — mentre l'immagine si guarda per una sola,
      // a turno. È la divisione che tiene il costo a una patch per fotogramma
      // qualunque sia il numero degli aerei in quadro.
      stato.tracce.forEach(t => { if (t.filtro) insFiltroPrevedi(t.filtro, dt); });

      if (stato.motoGradiS > INS_MOTO_MAX_GRADI_S) return;
      // Una richiesta per volta: il worker lavora un fotogramma indietro, e
      // accodargliene tre vorrebbe dire rispondere con posizioni vecchie di
      // tre fotogrammi. Meglio saltare un turno.
      //
      // Ma una richiesta che non torna più **spegne il modulo in silenzio**, e
      // dal di fuori non lo dice nessuno: `inVolo` resta sopra zero e da lì in
      // poi questa riga esce sempre, cioè non si guarda più un pixel mentre
      // tutto il resto continua a comportarsi normalmente. È la lezione di
      // `sorvegliaRichiesta` in `aerei.js`, nella stessa forma: non si crede
      // alle promesse, si guarda l'orologio. Mezzo secondo è venti volte il
      // costo di un giro buono.
      if (stato.inVolo > 0) {
        if (ora - (stato.inVoloDa || 0) < INS_RICHIESTA_APPESA_MS) return;
        stato.inVolo = 0;
        stato.appese = (stato.appese || 0) + 1;
      }

      const video = document.getElementById('skymap-video');
      if (!video || !video.videoWidth || video.readyState < 2) return;
      const geo = insGeometriaVideo(video, sky.larghezza, sky.altezza);
      if (!geo) return;

      stato.turno = (stato.turno + 1) % candidati.length;
      const c = candidati[stato.turno];
      let t = stato.tracce.get(c.id);
      if (!t) { t = tracciaNuova(c.id); stato.tracce.set(c.id, t); }

      // Dove si crede che l'aereo sia adesso: la previsione del feed, più
      // quello che il filtro ha imparato. È il centro della patch, ed è la
      // riga per cui la patch può essere piccola.
      const puntato = insDirezioneFiltrata(t, c);
      const p = skyProietta(puntato, base, focale);
      if (!p.davanti) return;
      const rett = insRettangoloPatch(geo, p.px, p.py, INS_LATO_PATCH);
      if (!rett) return;

      const seme = semeDaGiroscopio(t, base, focale, geo);
      // Lo scorrimento: di quanto il ritaglio si è spostato fra i due giri,
      // in pixel del video — che sono anche i pixel della patch, perché qui
      // non si ridimensiona niente (§5). Sommato al seme del giroscopio dà
      // l'intera differenza fra le coordinate di prima e quelle di adesso
      // (vedi il conto nel §6).
      const scorrimento = t.rett
        ? { x: t.rett.x - rett.x, y: t.rett.y - rett.y }
        : { x: 0, y: 0 };

      t.giriDaRilevare--;
      const rileva = !t.viva || t.giriDaRilevare <= 0 || !t.riquadro;

      // Il numero di serie della richiesta. Serve a una cosa sola, ed è il
      // seguito della sveglia qui sopra: una richiesta dichiarata persa può
      // sempre tornare: arriverebbe con l'esito giusto e la **posa
      // sbagliata**, cioè un riquadro rimappato con la vista di mezzo
      // secondo fa. Non fallisce — dà una direzione plausibile e storta, che
      // il filtro poi si tiene.
      stato.serie = (stato.serie || 0) + 1;
      const messaggio = {
        tipo: 'patch', id: c.id, L: rett.lato, H: rett.lato,
        serie: stato.serie,
        rileva,
        semeX: seme.x + scorrimento.x,
        semeY: seme.y + scorrimento.y,
        opzioni: {
          attesaX: rett.lato / 2 - rett.spostataX,
          attesaY: rett.lato / 2 - rett.spostataY,
          gate: rett.lato * 0.45,
          polarita: insPolarita()
        }
      };
      // Il contesto che serve a rileggere l'esito quando torna: il worker
      // risponde qualche millisecondo dopo, e nel frattempo la vista si è
      // mossa. Si tiene qui, non si manda di là.
      t.attesa = { rett, geo, base, focale, quando: ora, rileva, candidato: c, serie: stato.serie };

      insManda(messaggio, video, rett, geo);
    }

    // Di giorno una sagoma scura, di notte una lucina, al crepuscolo tutt'e
    // due. È la stessa regola del §5 di `visione.js` e dichiararla dimezza le
    // macchie sbagliate.
    function insPolarita() {
      const luce = typeof sky.luceCielo === 'number' ? sky.luceCielo : 0;
      if (luce > 0.45) return -1;
      if (luce < 0.12) return 1;
      return 0;
    }

    // La direzione su cui si punta la patch: quella del feed, spostata di
    // quello che il filtro ha misurato. Il filtro lavora in gradi di cielo
    // (§4), quindi qui si ritorna in azimut e altezza — e l'azimut si divide
    // per il coseno, che è l'inversa esatta della moltiplicazione fatta là.
    function insDirezioneFiltrata(t, c) {
      if (!t.filtro || !t.viva) return c.vettore;
      const cos = Math.max(0.05, Math.cos(c.alt * D2R));
      // Il filtro tiene lo scarto dal **feed**, quindi si riparte dal feed:
      // `c.az` porta già dentro l'ancora applicata, e sommarci sopra lo stato
      // del filtro vorrebbe dire contarla due volte.
      const az = c.az - c.applicata.dAz + t.filtro.x.x / cos;
      const alt = Math.max(-90, Math.min(90, c.alt - c.applicata.dAlt + t.filtro.y.x));
      return skyVettore(az, alt);
    }

    // --- Mandare e ricevere ---------------------------------------------

    function insManda(messaggio, video, rett, geo) {
      if (stato.workerVivo && stato.worker && typeof createImageBitmap === 'function') {
        // La strada buona: il ritaglio lo fa la GPU, l'immagine si
        // **trasferisce** (niente copia) e il filo principale non legge un
        // pixel. `createImageBitmap` è asincrona, quindi il fotogramma che il
        // worker vedrà è quello di adesso e non quello di dopo — è il motivo
        // per cui la posa si è già salvata in `t.attesa`.
        stato.inVolo++;
        stato.inVoloDa = performance.now();
        createImageBitmap(video, rett.x, rett.y, rett.lato, rett.lato)
          .then(bitmap => {
            // Fra la richiesta del ritaglio e la sua consegna passa un
            // fotogramma, e in quel fotogramma la fotocamera si può spegnere:
            // `insFerma` azzera tutto e il worker non c'è più. Senza questa
            // guardia la promessa cadrebbe su `null.postMessage`, cioè in un
            // rifiuto non gestito — e il `bitmap` resterebbe aperto.
            if (!stato.attivo || !stato.worker || !stato.workerVivo) {
              bitmap.close();
              stato.inVolo = Math.max(0, stato.inVolo - 1);
              return;
            }
            messaggio.bitmap = bitmap;
            stato.worker.postMessage(messaggio, [bitmap]);
          })
          .catch(() => {
            stato.inVolo = Math.max(0, stato.inVolo - 1);
            if (stato.attivo) insRipiego(messaggio, video, rett);
          });
        return;
      }
      insRipiego(messaggio, video, rett);
    }

    // Il ripiego: stesse funzioni, filo principale. Una patch di 192×192 sono
    // trentasettemila pixel, cioè meno del fotogramma ridotto che
    // `visione.js` legge già oggi: misurabile, non sensibile.
    function insRipiego(messaggio, video, rett) {
      const lato = rett.lato;
      if (!stato.tela || stato.tela.width !== lato) {
        stato.tela = document.createElement('canvas');
        stato.tela.width = lato; stato.tela.height = lato;
        stato.ctx = stato.tela.getContext('2d', { willReadFrequently: true });
      }
      if (!stato.ctx) return;
      let dati;
      try {
        stato.ctx.drawImage(video, rett.x, rett.y, lato, lato, 0, 0, lato, lato);
        dati = stato.ctx.getImageData(0, 0, lato, lato).data;
      } catch (e) { return; }
      const luma = insLuminanza(dati, lato * lato, scorta('ripiego:luma', lato * lato, Float32Array));
      const esito = insLavora(messaggio, luma);
      insRicevi({ tipo: 'esito', id: messaggio.id, serie: messaggio.serie, esito });
    }

    // L'esito, qualunque strada abbia fatto.
    function insRicevi(m) {
      const t = stato.tracce.get(m.id);
      if (!t || !t.attesa) return;
      // Una risposta in ritardo si butta: la posa con cui andrebbe riletta
      // non è più quella che le sta accanto (vedi `serie` in `insAggiorna`).
      if (m.serie !== undefined && m.serie !== t.attesa.serie) return;
      const { rett, geo, base, focale, candidato } = t.attesa;
      const esito = m.esito;
      t.attesa = null;

      if (!esito) {
        t.perdite++;
        t.riquadro = null;
        if (t.perdite > INS_PERDITE_MAX) { t.viva = false; t.conferme = 0; insDimentica(t.id); }
        // Rilevare al giro dopo, invece di inseguire il nulla.
        t.giriDaRilevare = 0;
        t.modo = 'perso';
        return;
      }

      t.riquadro = { x: esito.x, y: esito.y, w: esito.w, h: esito.h, raggio: esito.raggio };
      t.rett = rett;
      t.modo = esito.modo;
      if (esito.modo === 'rilevato') t.giriDaRilevare = INS_PASSO_RILEVA;

      // Dal pixel della patch alla direzione nel mondo. `base` e `focale`
      // sono quelle di **quando la patch è stata chiesta**, non quelle di
      // adesso: è la stessa trappola della latenza del §10 di `visione.js`, e
      // qui si evita tenendosele in `t.attesa`.
      const q = insPatchAlRiquadro(geo, rett, esito.x, esito.y);
      const dir = skyDirezione(q.px, q.py, base, focale);
      if (!dir) return;
      const n = Math.hypot(dir[0], dir[1], dir[2]);
      if (!(n > 0)) return;
      const v = [dir[0] / n, dir[1] / n, dir[2] / n];
      const alt = Math.asin(Math.max(-1, Math.min(1, v[2]))) * R2D;
      const az = ((Math.atan2(v[0], v[1]) * R2D) % 360 + 360) % 360;

      // Lo scarto dal **feed**, che è la grandezza su cui il filtro lavora
      // (§4). Quello che si misura direttamente è lo scarto da dove l'aereo è
      // **disegnato**, cioè un incremento; risommandoci l'ancora che è stata
      // applicata si torna al feed — e il conto si chiude da sé, perché
      // `candidato.az` vale `feed + applicata`:
      //
      //     (az − candidato.az) + applicata.dAz  =  az − feed
      //
      // Senza questa riga il filtro riceverebbe zero a convergenza e
      // riporterebbe l'ancora a zero: l'etichetta tornerebbe dov'era e
      // ripartirebbe, in un'oscillazione lenta che sullo schermo si legge
      // come un'etichetta che respira.
      const cos = Math.max(0.05, Math.cos(candidato.alt * D2R));
      let dAz = az - candidato.az;
      while (dAz > 180) dAz -= 360;
      while (dAz < -180) dAz += 360;
      const ex = (dAz + candidato.applicata.dAz) * cos;
      const ey = (alt - candidato.alt) + candidato.applicata.dAlt;
      if (!isFinite(ex) || !isFinite(ey)) return;

      if (!t.filtro) t.filtro = insFiltroNuovo(ex, ey);
      const R = esito.modo === 'rilevato' ? INS_KALMAN_R_RILEVATO : INS_KALMAN_R_INSEGUITO;
      const preso = insFiltroCorreggi(t.filtro, ex, ey, R);
      if (!preso) {
        // La misura era troppo lontana dalla previsione: non è quell'aereo.
        t.perdite++;
        if (t.perdite > INS_PERDITE_MAX) {
          t.viva = false; t.conferme = 0; t.filtro = null; insDimentica(t.id);
        }
        t.giriDaRilevare = 0;
        return;
      }

      t.perdite = 0;
      if (esito.modo === 'rilevato') t.conferme = Math.min(INS_CONFERME + 2, t.conferme + 1);
      if (t.conferme >= INS_CONFERME) t.viva = true;
      t.quando = performance.now();
      t.ultimaMisura = t.quando;
      t.vettore = v;
      // L'altezza a cui si è misurato: serve al giro dopo per disfare il
      // coseno del §4 (`insAncoraAereo`). Si prende quella del candidato e
      // non quella appena misurata perché è la stessa con cui il coseno è
      // stato applicato due righe fa: usarne due diversi lascerebbe un
      // errore che cresce verso lo zenit, cioè esattamente dove il coseno
      // conta.
      t.altUltima = candidato.alt;
      // La posa di **questa** misura diventa quella «di prima» del giro
      // successivo: è il termine noto del seme (§8, `semeDaGiroscopio`).
      t.posaPrec = { base, focale };
    }

    function insDimentica(id) {
      if (stato.worker && stato.workerVivo) stato.worker.postMessage({ tipo: 'scorda', id });
      else insScorda(id);
    }

    // ===================================================================
    // §9. Quello che il resto dell'app chiama
    // ===================================================================

    // L'ancora di un aereo, in gradi, nello stesso formato di quella di
    // `visione.js` — perché è lo stesso posto a leggerle (`ancoraVista` in
    // `aerei.js`, attraverso `visAncoraAereo`).
    //
    // Torna `null` quando questa traccia non ha niente di meglio da dire, e
    // allora risponde `visione.js` con la sua: le due non si sommano mai, ed è
    // la riga da non perdere — sommarle vorrebbe dire applicare due volte la
    // stessa correzione e portare l'etichetta dall'altra parte dell'aereo.
    function insAncoraAereo(id) {
      if (!stato.attivo || !stato.acceso) return null;
      const t = stato.tracce.get(String(id));
      if (!t || !t.viva || !t.filtro) return null;
      if (performance.now() - t.ultimaMisura > INS_ANCORA_VITA_MS) return null;
      // L'inversa del coseno del §4: il filtro tiene gradi di **cielo**, qui
      // servono gradi di **azimut**, e a settanta gradi di altezza i due
      // stanno fra loro come uno a tre.
      const cos = Math.max(0.05, Math.cos((t.altUltima || 0) * D2R));
      return { dAz: t.filtro.x.x / cos, dAlt: t.filtro.y.x, da: 'inseguimento' };
    }

    function insTracce() {
      const fuori = [];
      stato.tracce.forEach(t => fuori.push({
        id: t.id, viva: t.viva, modo: t.modo, conferme: t.conferme, perdite: t.perdite,
        vettore: t.vettore,
        riquadro: t.riquadro ? { w: t.riquadro.w, h: t.riquadro.h } : null,
        eta: t.ultimaMisura ? performance.now() - t.ultimaMisura : Infinity
      }));
      return fuori;
    }

    function insStato() {
      let vive = 0;
      stato.tracce.forEach(t => { if (t.viva) vive++; });
      return {
        attivo: stato.attivo, acceso: stato.acceso,
        worker: stato.workerVivo, yolo: stato.yolo,
        tracce: stato.tracce.size, vive, moto: stato.motoGradiS,
        // Quante richieste al worker si sono perse per strada. Zero è la
        // risposta normale; un numero che cresce vuol dire che il worker
        // arranca o è morto, e da fuori non si vedrebbe.
        appese: stato.appese || 0,
        latoPatch: INS_LATO_PATCH, passoRileva: INS_PASSO_RILEVA
      };
    }

    function insAvvia() {
      stato.attivo = true;
      stato.ultimoQuando = 0;
      stato.ultimaPosa = null;
      stato.motoGradiS = 0;
      insApriWorker();
    }

    function insFerma() {
      stato.attivo = false;
      stato.tracce.forEach((t, id) => insDimentica(id));
      stato.tracce.clear();
      stato.inVolo = 0;
    }

    function insAlterna() {
      stato.acceso = !stato.acceso;
      if (!stato.acceso) insFerma();
      return stato.acceso;
    }

    window.insAvvia = insAvvia;
    window.insFerma = insFerma;
    window.insAlterna = insAlterna;
    window.insAggiorna = insAggiorna;
    window.insAncoraAereo = insAncoraAereo;
    window.insTracce = insTracce;
    window.insStato = insStato;
    window.insAttivo = () => stato.attivo && stato.acceso;

    // Le funzioni pure, per il banco di prova. Sono **le stesse** che girano
    // nel planetario e dentro al worker, non una copia.
    window.Inseguimento = {
      insLuminanza, insDimezza, insPiramide, insCampiona,
      insLucasKanadePunto, insFlussoRiquadro, insMediana,
      insIntegrale, insMediaScatola, insResiduo, insScartoTipico, insRilevaSagoma,
      insFiltroNuovo, insFiltroPrevedi, insFiltroCorreggi, insPrevedi1, insCorreggi1,
      insGeometriaVideo, insRettangoloPatch, insPatchAlRiquadro,
      insLavora, insScorda, insYoloIngresso, insYoloLeggi,
      stato,
      INS_LATO_PATCH, INS_PASSO_RILEVA, INS_TRACCE_MAX, INS_LK_FINESTRA,
      INS_LK_LIVELLI, INS_LK_AVANTI_INDIETRO_MAX, INS_LK_AUTOVALORE_MIN,
      INS_LK_AUTOVALORE_SIGMA, INS_LK_PUNTI, INS_LK_PUNTI_MIN,
      INS_FONDO_RAGGIO, INS_SOGLIA_SIGMA, INS_AREA_MAX_QUOTA, INS_ASPETTO_MAX,
      INS_KALMAN_ACCEL, INS_KALMAN_R_RILEVATO, INS_KALMAN_R_INSEGUITO,
      INS_INNOVAZIONE_MAX, INS_ANCORA_VITA_MS, INS_CONFERME, INS_PERDITE_MAX,
      INS_MOTO_MAX_GRADI_S, INS_DISTANZA_MAX_KM, INS_PATCH_QUOTA_MAX,
      INS_RICHIESTA_APPESA_MS
    };

  } else {

    // ===================================================================
    // §8-bis. Il worker
    // ===================================================================
    //
    // Poche righe, e di proposito: tutto quello che c'è da sapere sta nelle
    // funzioni pure qui sopra, che sono le stesse che gira la pagina.

    let tela = null, ctx = null;

    self.onmessage = (ev) => {
      const m = ev.data || {};
      try {
        if (m.tipo === 'carica-modello') { insYoloCarica(m.modello, m.runtime); return; }
        if (m.tipo === 'scorda') { insScorda(m.id); return; }
        if (m.tipo !== 'patch') return;

        const lato = m.L;
        if (!tela || tela.width !== lato) {
          tela = new OffscreenCanvas(lato, lato);
          ctx = tela.getContext('2d', { willReadFrequently: true });
        }
        ctx.drawImage(m.bitmap, 0, 0);
        const rgba = ctx.getImageData(0, 0, lato, lato).data;
        m.bitmap.close();

        // Il rivelatore neurale, quando c'è, vuole i tre canali; quello del
        // §3 vuole la luminanza. Si prepara la luminanza sempre — serve
        // comunque al flusso ottico — e l'RGBA si passa a parte.
        const luma = insLuminanza(rgba, lato * lato, scorta('w:luma', lato * lato, Float32Array));

        if (insYoloPronto() && m.rileva) {
          insYoloGiro(m, rgba, luma, lato);
          return;
        }
        const esito = insLavora(m, luma);
        self.postMessage({ tipo: 'esito', id: m.id, serie: m.serie, esito });
      } catch (e) {
        // Un guasto qui non deve mai fermare il worker: si risponde «niente»
        // e il giro dopo si ricomincia. Un worker che muore in silenzio è il
        // modo peggiore di perdere l'inseguimento, perché dal di fuori
        // somiglia a un cielo senza aerei.
        self.postMessage({ tipo: 'esito', id: m.id, serie: m.serie, esito: null });
      }
    };

    // Il giro con la rete neurale è asincrono, quindi sta a parte: la
    // sessione ONNX restituisce una promessa, e nel frattempo il worker deve
    // restare libero di rispondere alle altre patch.
    function insYoloGiro(m, rgba, luma, lato) {
      const ort = self.ort;
      const prep = insYoloIngresso(rgba, lato, lato, yoloLato,
        scorta('w:tensore', 3 * yoloLato * yoloLato, Float32Array));
      const t = new ort.Tensor('float32', prep.tensore, [1, 3, yoloLato, yoloLato]);
      const nome = yoloSessione.inputNames[0];
      yoloSessione.run({ [nome]: t }).then(uscite => {
        const chiave = yoloSessione.outputNames[0];
        const u = uscite[chiave];
        const box = insYoloLeggi(u.data, u.dims, prep, m.opzioni || {});
        // Quando la rete non trova niente non si risponde «niente»: si
        // ripiega sul rivelatore del §3, che a questa scala è quello che
        // funziona. È il contrario di quello che verrebbe in mente, ed è il
        // punto di tutto il §7 — la rete è un di più, non un sostituto.
        const esito = box
          ? { x: box.x, y: box.y, w: box.w, h: box.h, raggio: box.raggio,
              forza: box.punteggio, modo: 'rilevato', segno: 0, area: box.area }
          : insLavora(m, luma);
        self.postMessage({ tipo: 'esito', id: m.id, serie: m.serie, esito });
      }).catch(() => {
        self.postMessage({ tipo: 'esito', id: m.id, serie: m.serie, esito: insLavora(m, luma) });
      });
    }
  }
})();
