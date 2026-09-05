// I transiti — quando un oggetto costruito dall'uomo passa davanti a un astro.
//
// Un aereo che attraversa il disco del Sole, la ISS che taglia la Luna piena
// in un secondo e mezzo: sono le due cose che in questo cielo si possono
// **prevedere e poi guardare**, e sono anche le due che il planetario finora
// sapeva disegnare e non sapeva annunciare.
//
// LA LEZIONE DI QUESTO FILE, in una riga: **un transito non si trova
// campionando**. Il disco del Sole è largo mezzo grado; un aereo a cinque
// chilometri attraversa il cielo a quasi tre gradi al secondo, e la ISS a uno.
// Il transito dura quindi fra un decimo e un secondo e mezzo. Il codice di
// prima cercava gli allineamenti su sei campioni distanti un minuto l'uno
// dall'altro (`aerei.js`, `aggiornaAllineamenti`): la probabilità che uno di
// quei sei istanti caschi dentro alla finestra buona è **meno di una su
// trecento**. Non era un filtro poco sensibile, era un filtro che non poteva
// funzionare — e il sintomo, come sempre in questo cielo, era un'assenza:
// nessun avviso, che è identico a «stanotte non passa niente».
//
// Da qui le quattro scelte che tengono in piedi il modulo:
//
//   1. **Il passo si misura in gradi, non in secondi** (§3). Si cammina lungo
//      la traiettoria tenendo fisso quanto l'oggetto si sposta **in cielo** fra
//      un campione e il successivo. Ne viene una proprietà che vale la pena
//      scrivere: il numero dei campioni è la lunghezza angolare del cammino
//      diviso il passo, e **non dipende dalla durata** — un aereo lontano che
//      striscia per venti minuti costa quanto uno vicino che sfreccia in due.
//      Vicino, dove è veloce, i passi si accorciano da soli; ed è lì che
//      servono.
//   2. **Il minimo si raffina, non si campiona** (§4). Il campionamento serve
//      solo a **incastrare** il momento del massimo avvicinamento fra due
//      istanti; da lì lo trova una sezione aurea, che dimezza l'intervallo
//      diciassette volte e arriva al millisecondo. La precisione al
//      millisecondo chiesta per le stazioni è questa, ed è aritmetica: quanto
//      valga *fisicamente* è un'altra domanda, e ha una risposta onesta in §7.
//   3. **Le due incertezze si dichiarano** (§6 e §7). Un TLE di ieri sbaglia
//      di un decimo di secondo; l'estrapolazione di un aereo a cinque minuti
//      sbaglia di **gradi**. Sono due mondi diversi, e un avviso che li
//      scrivesse con la stessa faccia mentirebbe su uno dei due.
//   4. **Il conto sta fuori dal fotogramma** (§8). Gli astri si campionano una
//      volta sola per tutta la scansione e si interpolano: sono lenti e lisci,
//      e un `Astronomy.Equator` per campione per astro sarebbe l'unico costo
//      capace di mettere in ginocchio il ciclo di disegno.
//
// I nomi hanno il prefisso `tran`. La geometria dei §2-§4 non sa niente
// dell'app — prende i suoi punti da una funzione che le si passa — ed è per
// questo che `verifica.html` può provarla senza caricare `app.js`.
(function () {
  'use strict';

  // =====================================================================
  // 1. LE COSTANTI
  // =====================================================================

  // Quanto lontano si guarda. Sono due finestre diverse perché sono due
  // previsioni diverse: un TLE regge per giorni, la rotta dichiarata da un
  // aereo regge per minuti (§6).
  // Quattro ore, e non di più. Il numero non è a occhio: gli avvisi coprono
  // tre ore (`TRAN_AVVISO_ORIZZONTE_MS`), quindi tutto quello che si trova
  // oltre è lavoro il cui risultato non lo vede nessuno — e la scansione si
  // rifà comunque ogni due minuti, quindi un transito fra cinque ore verrà
  // trovato con un'ora e mezza di anticipo sul momento in cui varrebbe la
  // pena annunciarlo.
  const TRAN_FINESTRA_SAT_MIN = 4 * 60;
  const TRAN_FINESTRA_AEREI_MIN = 25;

  // Il passo del cammino, in **gradi di cielo** (§3). Due valori: il giro
  // grosso serve a scoprire quali astri vale la pena guardare, quello fine a
  // incastrare il minimo. Un giro grosso da 2° non può nascondere un
  // avvicinamento: fra due campioni distanti 2° la traiettoria può passare al
  // più 1° più vicino di quanto dicano i due estremi (è l'altezza del
  // triangolo, e vale sempre), quindi si scarta solo chi resta oltre
  // `soglia + 1°`. È il margine `TRAN_MARGINE_GROSSO` qui sotto.
  const TRAN_PASSO_GROSSO = 2;
  const TRAN_MARGINE_GROSSO = TRAN_PASSO_GROSSO / 2;

  // Sotto questa separazione minima si tiene la candidata: un grado è già
  // «passa lì accanto», due lune piene di distanza.
  const TRAN_SOGLIA_VICINO = 1.0;

  // La tolleranza della sezione aurea. Un millisecondo è la richiesta, ed è
  // anche il punto oltre il quale raffinare non significa più niente: la ISS
  // in un millisecondo fa otto metri, cioè un decimo del suo corpo.
  const TRAN_TOLLERANZA_MS = 1;

  // Ogni quanto si campionano gli astri per la tabella di §5.
  //
  // Tre minuti, e il numero viene da un conto e da una misura. L'errore
  // dell'interpolazione quadratica va come il **cubo** del passo, quindi
  // triplicarlo lo moltiplica per ventisette: da millesimi di secondo
  // d'arco a qualche centesimo, cioè ancora cinquantamila volte meno del
  // disco che si sta cercando di attraversare. In cambio la tabella costa un
  // terzo, ed è la cosa più cara di tutta la scansione — quattro ore di
  // finestra per sette astri sono qualche centinaio di chiamate ad
  // Astronomy Engine, tutte in fila e tutte prima che il conto vero cominci.
  //
  // Il numero che conta davvero non è però il secondo d'arco: è quanto
  // sposta l'**istante**. Un centesimo di secondo d'arco, per l'aereo più
  // lento che valga la pena guardare, vale meno di due decimi di
  // millisecondo — cioè resta sotto la precisione che questo modulo
  // dichiara. Il §31 lo misura invece di sperarlo.
  const TRAN_PASSO_ASTRI_MS = 180000;

  // Gli astri che vale la pena guardare. Le stelle no, e non è pigrizia: un
  // aereo che «passa su Vega» non è una cosa che si veda — non c'è nessun
  // disco da coprire, e la silhouette ha bisogno di un fondo luminoso.
  const TRAN_BERSAGLI = ['Sun', 'Moon', 'Venus', 'Jupiter', 'Mars', 'Saturn', 'Mercury'];

  // L'apertura alare che si dà a un aereo di cui non si sa il modello. L'ADS-B
  // non porta la fusoliera: porta una posizione. Quaranta metri sono un
  // corto-medio raggio, e il numero **non entra nell'istante del transito** —
  // entra solo in quanto grande lo si disegna e in quanto largo è lo
  // sfioramento che conta come contatto.
  const TRAN_APERTURA_AEREO_M = 40;

  // L'incertezza dell'estrapolazione ADS-B (§6). La rotta dichiarata è buona
  // a una frazione di grado, ma l'aereo **vira**, e su cinque minuti è la
  // virata a comandare. Un grado di scarto di rotta è la misura onesta di un
  // velivolo in crociera.
  const TRAN_SIGMA_ROTTA_GRADI = 1.0;
  const TRAN_SIGMA_VELOCITA = 0.01;

  // Quanto in là si accetta di annunciare un transito d'aereo. Oltre, il cono
  // d'incertezza è più largo del cielo che si sta guardando e l'avviso
  // direbbe soltanto «forse, da qualche parte, in quella direzione».
  const TRAN_AEREO_PREAVVISO_MAX_MS = 12 * 60000;

  // Il ritmo del motore (§8). Gli aerei si ricontrollano spesso perché la
  // fotografia sotto cambia ogni quarantacinque secondi; le stazioni molto
  // meno, perché un TLE non cambia in due minuti e la loro scansione è
  // l'unica cosa cara di questo file.
  const TRAN_RICALCOLO_AEREI_MS = 4000;
  const TRAN_RICALCOLO_SAT_MS = 120000;

  // Il passo grosso con cui si spazza il cielo per sapere **se** la stazione
  // è sopra l'orizzonte. Qui non si sta seguendo una traiettoria — quello
  // viene dopo — si sta solo chiedendo «c'è o non c'è», e un passaggio dura
  // minuti: un minuto di passo lo trova comunque, e costa un terzo di venti
  // secondi. Sono duecentoquaranta propagazioni SGP4 per stazione invece di
  // settecento, e a cinquanta microsecondi l'una la differenza si sente.
  const TRAN_SONDA_SAT_MS = 60000;
  // Quanto lavoro si fa prima di cedere il turno al browser. Mezzo
  // fotogramma, come il tracciamento dei raggi delle acque
  // (`acqueTagliaAScaglioni` in terreno.js): è la stessa lezione, cioè che
  // un conto lungo non si accorcia, si **spezza**.
  const TRAN_SCAGLIONE_MS = 8;

  // Quando un avviso smette di essere «imminente» e quando sparisce del
  // tutto. Un transito già passato resta a schermo per qualche secondo: chi
  // ha alzato gli occhi vuole sapere se era quello.
  const TRAN_AVVISO_ORIZZONTE_MS = 3 * 3600 * 1000;
  const TRAN_AVVISO_CODA_MS = 20000;

  // Sotto questa altezza non si annuncia niente: il tetto del palazzo di
  // fronte è più basso, ma un transito a due gradi non lo guarda nessuno.
  const TRAN_ALT_MINIMA = 5;

  const D2R = Math.PI / 180, R2D = 180 / Math.PI;

  // =====================================================================
  // 2. LA GEOMETRIA — versori, separazione, interpolazione
  //
  //    Tutto quello che segue lavora su **versori** e non su coppie
  //    (azimut, altezza), e la ragione è la stessa per cui la bussola di
  //    app.js lavora con un quaternione: le coordinate sferiche hanno due
  //    poli e una cucitura, e i transiti capitano anche allo zenit. Una
  //    media di azimut fra 359° e 1° dà 180°, cioè la parte opposta del
  //    cielo, e non se ne accorge nessuno finché non capita.
  // =====================================================================

  function tranVersore(azGradi, altGradi) {
    const az = azGradi * D2R, alt = altGradi * D2R;
    const c = Math.cos(alt);
    return [Math.sin(az) * c, Math.cos(az) * c, Math.sin(alt)];
  }

  function tranAzAlt(v) {
    return {
      az: (Math.atan2(v[0], v[1]) * R2D + 360) % 360,
      alt: Math.asin(Math.max(-1, Math.min(1, v[2]))) * R2D
    };
  }

  // La separazione in gradi fra due versori. **Non** è un `acos` del prodotto
  // scalare, ed è la riga più importante di questa sezione: per due direzioni
  // vicine il coseno vale uno meno qualcosa di piccolissimo, e in doppia
  // precisione quel «qualcosa» si perde. A mezzo grado di separazione l'acos
  // restituisce già solo sette cifre buone; a un secondo d'arco — che è
  // esattamente la scala su cui si decide un transito — ne restituisce
  // quattro. La forma con l'`atan2` del modulo del prodotto vettoriale è
  // esatta a tutte le separazioni, e costa una radice in più.
  function tranSeparazione(u, w) {
    const cx = u[1] * w[2] - u[2] * w[1];
    const cy = u[2] * w[0] - u[0] * w[2];
    const cz = u[0] * w[1] - u[1] * w[0];
    const seno = Math.sqrt(cx * cx + cy * cy + cz * cz);
    const coseno = u[0] * w[0] + u[1] * w[1] + u[2] * w[2];
    return Math.atan2(seno, coseno) * R2D;
  }

  function tranNormalizza(v) {
    const n = Math.hypot(v[0], v[1], v[2]);
    return n > 0 ? [v[0] / n, v[1] / n, v[2] / n] : [0, 0, 1];
  }

  // =====================================================================
  // 3. IL CAMMINO IN CIELO — il passo si misura in gradi
  //
  //    `campiona(tMs)` restituisce il versore dell'oggetto in quell'istante,
  //    oppure `null` se lì non c'è (sotto l'orizzonte, fuori dai dati). Si
  //    cammina da `t0` a `t1` tenendo il **passo angolare** sotto
  //    `passoGradi`: dove l'oggetto corre i passi si accorciano da soli.
  //
  //    La proprietà che rende tutto questo sopportabile: il numero dei
  //    campioni è la lunghezza angolare del cammino diviso il passo. Un
  //    passaggio da orizzonte a orizzonte sono al più 180°, quindi con un
  //    passo di 2° sono novanta campioni — e sarebbero novanta anche se
  //    quel passaggio durasse un'ora invece che due minuti.
  // =====================================================================

  function tranCammino(campiona, t0, t1, passoGradi, opz) {
    const o = opz || {};
    const dtMin = Math.max(1, o.dtMinMs || 20);
    const dtMax = Math.max(dtMin, o.dtMaxMs || 30000);
    const massimo = o.massimoCampioni || 4000;
    const punti = [];
    if (!(t1 > t0)) return punti;

    let t = t0;
    let dt = Math.min(dtMax, Math.max(dtMin, o.dtIniziale || 1000));
    let v = campiona(t);
    if (v) punti.push({ t, v });

    while (t < t1 && punti.length < massimo) {
      // Il passo si prova e, se ha scavalcato, si rifà più corto. È un
      // integratore con rifiuto, e serve al primo passo di ogni cammino:
      // lì la velocità angolare non la si è ancora misurata, e partire
      // troppo lunghi vorrebbe dire saltare proprio l'avvicinamento che si
      // sta cercando.
      let accettato = false;
      for (let tentativo = 0; tentativo < 8 && !accettato; tentativo++) {
        const tn = Math.min(t1, t + dt);
        const vn = campiona(tn);
        if (!vn) {
          // Fuori vista: si avanza comunque, se no un buco in mezzo al
          // cammino lo fermerebbe per sempre.
          t = tn; v = null; accettato = true; break;
        }
        const passo = v ? tranSeparazione(v, vn) : 0;
        if (v && passo > passoGradi * 2 && dt > dtMin) {
          dt = Math.max(dtMin, dt * (passoGradi / passo) * 0.9);
          continue;
        }
        punti.push({ t: tn, v: vn });
        // Il passo dopo si tara su quello appena misurato. Il tetto di
        // quattro impedisce che una fase lenta — l'oggetto quasi fermo al
        // culmine — allunghi il passo tanto da saltare la ripartenza.
        const fattore = passo > 1e-9 ? Math.min(4, passoGradi / passo) : 4;
        dt = Math.min(dtMax, Math.max(dtMin, dt * fattore));
        t = tn; v = vn; accettato = true;
      }
      if (!accettato) { t = Math.min(t1, t + dt); v = campiona(t); if (v) punti.push({ t, v }); }
    }
    return punti;
  }

  // =====================================================================
  // 4. IL MINIMO — incastrarlo, poi raffinarlo
  //
  //    Il campionamento non deve trovare l'istante: deve solo dire fra quali
  //    due campioni sta. Da lì è un problema di minimo di una funzione liscia
  //    e unimodale, e la sezione aurea lo risolve senza derivate, restringendo
  //    l'intervallo del 38% a ogni valutazione: da un minuto al millisecondo
  //    sono ventiquattro conti.
  // =====================================================================

  const AUREA = (Math.sqrt(5) - 1) / 2;   // 0.618…

  function tranMinimo(f, a, b, tolleranzaMs) {
    const toll = Math.max(0.05, tolleranzaMs || TRAN_TOLLERANZA_MS);
    let x0 = a, x3 = b;
    let x1 = x3 - AUREA * (x3 - x0);
    let x2 = x0 + AUREA * (x3 - x0);
    let f1 = f(x1), f2 = f(x2);
    let giri = 0;
    while (x3 - x0 > toll && giri++ < 200) {
      if (f1 < f2) { x3 = x2; x2 = x1; f2 = f1; x1 = x3 - AUREA * (x3 - x0); f1 = f(x1); }
      else { x0 = x1; x1 = x2; f1 = f2; x2 = x0 + AUREA * (x3 - x0); f2 = f(x2); }
    }
    const t = f1 < f2 ? x1 : x2;
    return { t, valore: Math.min(f1, f2) };
  }

  // Dove la separazione attraversa una soglia: sono i **contatti**, cioè
  // l'istante in cui l'oggetto entra nel disco e quello in cui ne esce. Una
  // bisezione basta e avanza — la funzione lì è monotona e ripida, ed è
  // proprio la ripidità che rende un transito così breve.
  function tranContatto(f, dentro, fuori, soglia, tolleranzaMs) {
    const toll = Math.max(0.05, tolleranzaMs || TRAN_TOLLERANZA_MS);
    let a = dentro, b = fuori;
    let giri = 0;
    while (Math.abs(b - a) > toll && giri++ < 200) {
      const m = (a + b) / 2;
      if (f(m) <= soglia) a = m; else b = m;
    }
    return (a + b) / 2;
  }

  // I minimi locali di una serie di separazioni, restituiti come intervalli
  // che li **incastrano**. Gli estremi contano: un oggetto che entra in scena
  // già vicinissimo all'astro ha il suo minimo al primo campione, e cercarlo
  // solo fra i campioni interni vorrebbe dire perderlo.
  function tranBrackets(punti, sep) {
    const fuori = [];
    for (let i = 0; i < punti.length; i++) {
      const prima = i > 0 ? sep[i - 1] : Infinity;
      const dopo = i < punti.length - 1 ? sep[i + 1] : Infinity;
      if (sep[i] <= prima && sep[i] <= dopo) {
        fuori.push({
          i,
          a: punti[Math.max(0, i - 1)].t,
          b: punti[Math.min(punti.length - 1, i + 1)].t,
          stima: sep[i]
        });
      }
    }
    return fuori;
  }

  // =====================================================================
  // 5. GLI ASTRI — campionati una volta, interpolati per tutti
  //
  //    Un `Astronomy.Equator` più un `Horizon` costano una manciata di
  //    microsecondi: nulla, finché non li si chiede duemila volte per
  //    aereo per astro. Ma un astro in cielo è la cosa più liscia che ci
  //    sia — un cerchio percorso a un quarto di grado al minuto — e
  //    interpolarlo non è un'approssimazione da giustificare: è la scelta
  //    giusta. Con nodi a un minuto e una parabola per i versori l'errore
  //    sta sotto il centesimo di secondo d'arco, cioè cinquantamila volte
  //    più piccolo del disco che si sta cercando di attraversare.
  // =====================================================================

  function tranTabellaAstro(campiona, t0, t1, passoMs) {
    const passo = Math.max(1000, passoMs || TRAN_PASSO_ASTRI_MS);
    const quanti = Math.max(3, Math.ceil((t1 - t0) / passo) + 1);
    const nodi = [];
    for (let i = 0; i < quanti; i++) {
      const v = campiona(t0 + i * passo);
      if (!v) return null;
      nodi.push(v);
    }
    return {
      t0, passo, nodi,
      at(t) {
        const x = (t - t0) / passo;
        // Il nodo di mezzo della parabola: si tiene sempre una terna dentro
        // ai limiti, così anche i due estremi sono interpolati e non
        // estrapolati.
        let k = Math.round(x);
        if (k < 1) k = 1;
        if (k > nodi.length - 2) k = nodi.length - 2;
        const s = x - k;
        const a = nodi[k - 1], b = nodi[k], c = nodi[k + 1];
        // Lagrange su tre nodi equispaziati, scritto sui pesi: per s = 0
        // torna esattamente il nodo di mezzo, che è la proprietà da cui
        // dipende la prova «sui nodi si rilegge identica».
        const wa = s * (s - 1) / 2, wb = 1 - s * s, wc = s * (s + 1) / 2;
        return tranNormalizza([
          wa * a[0] + wb * b[0] + wc * c[0],
          wa * a[1] + wb * b[1] + wc * c[1],
          wa * a[2] + wb * b[2] + wc * c[2]
        ]);
      }
    };
  }

  // Il raggio angolare di un astro, in gradi. È la misura che decide se
  // «vicino» diventa «davanti»: sotto di lei l'oggetto è **sul disco**, ed è
  // il transito vero e proprio.
  function tranRaggioAstro(o) {
    if (!o) return 0;
    if (typeof skySemidiametro === 'function') {
      const r = skySemidiametro(o);
      if (r > 0) return r;
    }
    // Senza i dati del corpo resta la misura che tutti conoscono: mezzo grado
    // di diametro per Sole e Luna, un puntino per tutto il resto.
    if (o.tipo === 'sole' || o.tipo === 'luna') return 0.266;
    return 0.005;
  }

  // Gli astri di questo istante, presi dal planetario. Si porta dietro il
  // versore campionabile: chi lo chiama non deve sapere niente di
  // Astronomy Engine.
  function tranAstriBersaglio(observer) {
    if (typeof sky === 'undefined' || !Array.isArray(sky.oggetti)) return [];
    const obs = observer || sky.observer;
    if (!obs || typeof Astronomy === 'undefined') return [];
    return sky.oggetti
      .filter(o => TRAN_BERSAGLI.indexOf(o.id) !== -1)
      .map(o => ({
        id: o.id,
        nome: o.nome || o.id,
        tipo: o.tipo,
        astro: o,
        raggio: tranRaggioAstro(o),
        campiona(t) {
          try {
            const tt = Astronomy.MakeTime(new Date(t));
            const equ = Astronomy.Equator(o.id, tt, obs, true, true);
            const hor = Astronomy.Horizon(tt, obs, equ.ra, equ.dec, 'normal');
            return tranVersore(hor.azimuth, hor.altitude);
          } catch (e) { return null; }
        }
      }));
  }

  // =====================================================================
  // 6. GLI AEREI — l'arco intero, e quanto ci si può credere
  //
  //    L'arco. Un aereo in crociera a undici chilometri sta sopra
  //    l'orizzonte geometrico fino a trecentosettanta chilometri di
  //    distanza, e a duecentocinquanta metri al secondo ci mette venticinque
  //    minuti ad attraversarli: **quello** è l'arco di transito, non i cinque
  //    minuti che il disegno tratteggiava. Si cerca per bisezione l'istante
  //    in cui l'elevazione scende sotto l'orizzonte vero — quello di
  //    `terreno.js`, con le colline —, avanti e indietro dal presente.
  //
  //    Quanto ci si può credere. Qui la matematica è onesta e la risposta è
  //    scomoda: l'estrapolazione a rotta costante è ottima per un minuto,
  //    buona per due e diventa letteratura dopo dieci. Un grado di scarto di
  //    rotta — cioè una virata appena accennata — su cinque minuti a
  //    duecentocinquanta metri al secondo sposta l'aereo di **milletrecento
  //    metri** di traverso; a dieci chilometri di distanza sono sette gradi,
  //    quattordici lune piene. Il disco del Sole ne è largo mezzo.
  //
  //    La conseguenza va detta e non nascosta: **un transito d'aereo si può
  //    annunciare, non promettere**. Quello che questo modulo calcola è dove
  //    e quando l'aereo passerà davanti al Sole *se tiene la rotta*, e
  //    accanto ci mette il cono d'incertezza che quella rotta si porta
  //    dietro. Un avviso che dicesse «fra 4 minuti e 12 secondi» senza dire
  //    «± 6°» sarebbe una bugia con la faccia di una misura.
  // =====================================================================

  function tranAereoCampionatore(aereo, obs) {
    const api = window.AereiADS_B;
    if (!api || !aereo || !obs) return null;
    const origine = aereo.posizioneFeed || aereo;
    const t0 = Number.isFinite(origine.ultimaLettura) ? origine.ultimaLettura * 1000 : Date.now();
    return function (t) {
      const p = api.posizioneFutura(origine, (t - t0) / 1000);
      const c = api.coordinateCielo(p, obs);
      return { v: tranVersore(c.az, c.alt), az: c.az, alt: c.alt, km: c.distanzaKm };
    };
  }

  // L'orizzonte vero in quella direzione, colline comprese. Senza il modulo
  // del terreno resta lo zero geometrico: è la stessa cascata che usa il
  // planetario per decidere se un astro è sorto.
  function tranOrizzonte(az) {
    if (typeof skyAltezzaOrizzonte === 'function') {
      try { const h = skyAltezzaOrizzonte(az); if (Number.isFinite(h)) return h; } catch (e) { /* niente terreno */ }
    }
    return 0;
  }

  // I due capi dell'arco: quando l'aereo si alza sopra l'orizzonte e quando
  // ci ricasca sotto. L'elevazione lungo una rotta rettilinea a quota
  // costante ha un massimo solo, quindi da un istante in cui l'aereo è alto
  // basta camminare nelle due direzioni finché non scende, e poi bisecare.
  function tranArcoAereo(campionatore, ora, finestraMs) {
    const sopra = t => { const p = campionatore(t); return p.alt - tranOrizzonte(p.az); };
    function capo(verso) {
      // Mezzo minuto di passo. L'arco dura decine di minuti, quindi non c'è
      // niente da perdere; e questa sonda gira per **ogni aereo in cielo**,
      // due volte (avanti e indietro), quindi è il posto in cui dimezzare il
      // passo dimezza il costo di tutta la scansione.
      const passo = 30000;
      let t = ora, ultimo = sopra(ora);
      if (ultimo <= 0) return ora;
      for (let i = 1; i * passo <= finestraMs; i++) {
        const tn = ora + verso * i * passo;
        const s = sopra(tn);
        if (s <= 0) {
          // Bisezione fra l'ultimo istante alto e il primo basso: un minuto
          // di incertezza sul capo dell'arco non cambierebbe niente, ma il
          // conto costa dieci valutazioni e le vale, perché è da qui che
          // esce la durata scritta nella scheda.
          let a = ora + verso * (i - 1) * passo, b = tn;
          for (let k = 0; k < 24 && Math.abs(b - a) > 250; k++) {
            const m = (a + b) / 2;
            if (sopra(m) > 0) a = m; else b = m;
          }
          return (a + b) / 2;
        }
        ultimo = s;
      }
      return ora + verso * finestraMs;
    }
    if (sopra(ora) <= 0) return null;
    return { inizio: capo(-1), fine: capo(1) };
  }

  // Il cono d'incertezza al tempo di preavviso `dtMs`, in gradi. È la somma
  // in quadratura dello scarto di traverso (la virata) e di quello lungo la
  // rotta (la velocità), divisa per la distanza: geometria elementare, e
  // l'unica difesa contro un avviso che sembra una misura.
  function tranIncertezzaAereo(aereo, dtMs, distanzaKm) {
    const v = Math.max(30, aereo.velocitaMs || 250);
    const dt = Math.max(0, dtMs) / 1000;
    const traverso = v * dt * (TRAN_SIGMA_ROTTA_GRADI * D2R);
    const lungo = v * dt * TRAN_SIGMA_VELOCITA;
    const metri = Math.hypot(traverso, lungo);
    const km = Math.max(0.3, distanzaKm || 10);
    return Math.atan2(metri / 1000, km) * R2D;
  }

  // Quanto è largo l'aereo visto da qui. Serve a due cose e a nessun'altra:
  // sapere se sfiorando il bordo del disco lo tocca comunque, e disegnarlo
  // alla misura vera quando è vicino — a cinque chilometri un'apertura alare
  // di quaranta metri è **mezzo grado**, cioè quanto il Sole: sullo schermo
  // non è più un triangolino, è una sagoma che il disco lo copre davvero.
  function tranAperturaAereo(distanzaKm) {
    const km = Math.max(0.05, distanzaKm || 10);
    return Math.atan2(TRAN_APERTURA_AEREO_M / 1000, km) * R2D;
  }

  // =====================================================================
  // 7. LE STAZIONI — SGP4, e cosa vuol dire «al millisecondo»
  //
  //    Qui la previsione è di un'altra pasta. Un TLE fresco più SGP4 mettono
  //    la ISS entro un chilometro lungo l'orbita, e un chilometro a sette
  //    chilometri e mezzo al secondo è **un decimo di secondo**. Il TLE però
  //    invecchia di circa un chilometro al giorno: con quello di stamattina
  //    l'istante calcolato è buono a un decimo di secondo, con quello di tre
  //    giorni fa a mezzo. Il raffinamento arriva al millisecondo — è
  //    aritmetica, e la si dichiara per quello che è — mentre la barra
  //    d'errore fisica è quella dell'età del TLE, e si scrive accanto.
  //
  //    L'altra cosa da sapere: un transito della ISS sul Sole si vede da una
  //    striscia di terreno larga pochi chilometri. È esattamente il motivo
  //    per cui questo conto va fatto **sulle coordinate GPS di adesso** e
  //    non su quelle della città: due paesi vicini vedono due cieli diversi,
  //    e uno dei due non vede niente.
  // =====================================================================

  function tranStazioni() {
    if (typeof SATELLITI === 'undefined' || typeof satellite === 'undefined') return [];
    return SATELLITI.filter(s => s && (s.id === 'iss' || s.id === 'css'));
  }

  function tranStazioneCampionatore(sat, luogo) {
    if (typeof satRecDi !== 'function' || typeof satOsservatoreGd !== 'function' ||
        typeof satAltAz !== 'function') return null;
    const rec = satRecDi(sat);
    if (!rec) return null;
    const gd = satOsservatoreGd(luogo);
    return function (t) {
      const p = satAltAz(rec, new Date(t), gd);
      if (!p) return null;
      return { v: tranVersore(p.az, p.alt), az: p.az, alt: p.alt, km: p.distanza, posizione: p.posizione };
    };
  }

  // L'età del TLE, e da lì l'errore fisico stimato sull'istante. Non è una
  // taratura fine: è l'ordine di grandezza, che è tutto quello che serve per
  // non far passare per esatta una previsione che non lo è.
  function tranErroreTle(sat) {
    if (typeof satTle === 'undefined') return null;
    const tle = satTle[sat.id];
    if (!tle || !tle.quando) return null;
    const giorni = Math.max(0, (Date.now() - tle.quando) / 86400000);
    // Un chilometro di scarto lungo l'orbita per giorno di età, a 7,66 km/s.
    return { giorni, secondi: giorni * 1 / 7.66 };
  }

  // =====================================================================
  // 8. IL MOTORE — cercare i transiti senza fermare il fotogramma
  // =====================================================================

  const tran = {
    aperto: false,
    eventi: [],          // tutti i transiti e gli sfioramenti trovati
    quandoAerei: 0,
    quandoStazioni: 0,
    aereiInCorso: false,
    stazioniInCorso: false,
    eventiAerei: [],
    eventiStazioni: [],
    scartato: {},        // avvisi che l'utente ha chiuso: chiave -> quando
    tabelle: null,
    finestraTabelle: null
  };

  // La tabella degli astri vale per una finestra di tempo. Rifarla a ogni
  // scansione costerebbe qualche centinaio di chiamate ad Astronomy Engine:
  // si tiene finché la finestra chiesta ci sta dentro.
  // Il margine attorno alla finestra chiesta: così una scansione che scorre
  // in avanti di qualche secondo non fa ricostruire tutto ogni volta.
  function tranMargineFinestra(t0, t1) { return { t0: t0 - 60000, t1: t1 + 5 * 60000 }; }

  function tranTabelleBuone(astri, t0, t1) {
    const f = tran.finestraTabelle;
    return (f && tran.tabelle && t0 >= f.t0 && t1 <= f.t1 &&
      tran.tabelle.length === astri.length &&
      tran.tabelle.every((v, i) => v.id === astri[i].id)) ? tran.tabelle : null;
  }

  function tranVoceTabella(x, a, b) {
    const tab = tranTabellaAstro(x.campiona, a, b, TRAN_PASSO_ASTRI_MS);
    return tab ? { id: x.id, nome: x.nome, tipo: x.tipo, raggio: x.raggio, astro: x.astro, tab } : null;
  }

  function tranTabelle(astri, t0, t1) {
    const pronte = tranTabelleBuone(astri, t0, t1);
    if (pronte) return pronte;
    const f = tranMargineFinestra(t0, t1);
    const tabelle = astri.map(x => tranVoceTabella(x, f.t0, f.t1)).filter(Boolean);
    tran.tabelle = tabelle;
    tran.finestraTabelle = f;
    return tabelle;
  }

  // Il cuore: dato un oggetto che si muove e un elenco di astri tabellati,
  // trova gli avvicinamenti. Due giri, come annunciato in §1 — il grosso per
  // scartare, il fine per raffinare.
  function tranCercaAvvicinamenti(campionatore, t0, t1, tabelle, opz) {
    const o = opz || {};
    const soglia = o.soglia || TRAN_SOGLIA_VICINO;
    const punti = tranCammino(t => { const p = campionatore(t); return p && p.v; },
      t0, t1, o.passoGradi || TRAN_PASSO_GROSSO,
      { dtMinMs: o.dtMinMs || 20, dtMaxMs: o.dtMaxMs || 20000, dtIniziale: o.dtIniziale || 2000,
        massimoCampioni: o.massimoCampioni || 4000 });
    if (punti.length < 2) return [];

    const trovati = [];
    tabelle.forEach(astro => {
      const sep = punti.map(p => tranSeparazione(p.v, astro.tab.at(p.t)));
      const minimoGrosso = Math.min.apply(null, sep);
      // Il margine è quello di §1: fra due campioni distanti `passo` la
      // traiettoria può avvicinarsi al più di metà passo in più.
      if (minimoGrosso > soglia + (o.passoGradi || TRAN_PASSO_GROSSO) / 2) return;

      const f = t => {
        const p = campionatore(t);
        return p ? tranSeparazione(p.v, astro.tab.at(t)) : 999;
      };
      tranBrackets(punti, sep).forEach(b => {
        if (b.stima > soglia + (o.passoGradi || TRAN_PASSO_GROSSO)) return;
        const m = tranMinimo(f, b.a, b.b, TRAN_TOLLERANZA_MS);
        if (m.valore > soglia) return;
        const p = campionatore(m.t);
        if (!p || p.alt < TRAN_ALT_MINIMA) return;

        // Il contatto: quanto largo è il bersaglio da colpire. Il disco
        // dell'astro più la mezza apertura dell'oggetto — un aereo vicino è
        // largo quanto il Sole, e sfiorandone il bordo lo copre comunque.
        const mezzaApertura = o.apertura ? o.apertura(p.km) / 2 : 0;
        const bersaglio = astro.raggio + mezzaApertura;
        const dentro = m.valore <= bersaglio;
        let inizio = null, fine = null;
        if (dentro) {
          // I contatti stanno fra il minimo e i due estremi del bracket: lì
          // la separazione era certamente maggiore della soglia, se no il
          // bracket sarebbe un altro.
          if (f(b.a) > bersaglio) inizio = tranContatto(f, m.t, b.a, bersaglio, TRAN_TOLLERANZA_MS);
          if (f(b.b) > bersaglio) fine = tranContatto(f, m.t, b.b, bersaglio, TRAN_TOLLERANZA_MS);
        }
        trovati.push({
          astroId: astro.id, astroNome: astro.nome, astroTipo: astro.tipo,
          quando: m.t, separazione: m.valore, raggioAstro: astro.raggio,
          bersaglio, transito: dentro,
          // Quanto è centrale: zero è il centro del disco, uno il bordo. È
          // il numero che dice se vale la pena correre a prendere la
          // macchina fotografica.
          centralita: bersaglio > 0 ? Math.min(1, m.valore / bersaglio) : 1,
          contattoInizio: inizio, contattoFine: fine,
          durataMs: (inizio !== null && fine !== null) ? fine - inizio : null,
          az: p.az, alt: p.alt, distanzaKm: p.km,
          // La posizione grezza del campionatore viaggia con l'evento: per
          // una stazione è il vettore da cui si capisce se in quell'istante
          // è al sole o dentro al cono d'ombra della Terra, e ricalcolarla
          // più tardi vorrebbe dire propagare due volte lo stesso istante.
          posizione: p.posizione || null
        });
      });
    });
    return trovati;
  }

  function tranScanAerei(ora) {
    const api = window.AereiADS_B;
    if (!api || !api.stato || !Array.isArray(api.stato.aerei)) return [];
    // Il punto **stabile** dell'app, non quello vivo che insegue il GPS fra
    // un fix e l'altro (`osservatoreDisegno`). Sembra il contrario di quello
    // che serve, e invece è il punto: un transito si annuncia con un minuto
    // di anticipo, e in un minuto chi è in macchina fa un chilometro e mezzo
    // — cioè si sposta molto più di quanto valga la differenza fra i due
    // punti. Prevedere da dove si è **adesso** un allineamento che capiterà
    // fra un minuto, mentre ci si muove, è una precisione che non c'è: la
    // posizione stabile è la scelta onesta, e il cono d'incertezza di §6 dice
    // il resto.
    const obs = api.osservatore ? api.osservatore() : null;
    if (!obs) return [];
    const astri = tranAstriBersaglio();
    if (!astri.length) return [];
    const finestra = TRAN_FINESTRA_AEREI_MIN * 60000;
    const tabelle = tranTabelle(astri, ora, ora + finestra);
    if (!tabelle.length) return [];

    const fuori = [];
    api.stato.aerei.forEach(aereo => {
      if (!Number.isFinite(aereo.lat) || !Number.isFinite(aereo.lon)) return;
      const campionatore = tranAereoCampionatore(aereo, obs);
      if (!campionatore) return;
      const arco = tranArcoAereo(campionatore, ora, finestra);
      if (!arco) return;
      const fine = Math.min(arco.fine, ora + finestra);
      if (fine <= ora) return;

      tranCercaAvvicinamenti(campionatore, ora, fine, tabelle, {
        apertura: tranAperturaAereo,
        dtMinMs: 20, dtMaxMs: 20000, dtIniziale: 2000
      }).forEach(e => {
        const preavviso = e.quando - ora;
        if (preavviso > TRAN_AEREO_PREAVVISO_MAX_MS) return;
        fuori.push(Object.assign(e, {
          genere: 'aereo',
          chiave: 'aereo:' + aereo.id + ':' + e.astroId,
          oggettoId: aereo.id,
          oggettoNome: (aereo.callsign || aereo.id || '').trim() || 'aereo',
          incertezza: tranIncertezzaAereo(aereo, preavviso, e.distanzaKm),
          apertura: tranAperturaAereo(e.distanzaKm),
          arco: { inizio: arco.inizio, fine: arco.fine,
                  durataMin: Math.max(0, (arco.fine - arco.inizio) / 60000) }
        }));
      });
    });
    return fuori;
  }

  // Le stazioni, e perché questa è l'unica cosa cara del file.
  //
  // Una propagazione SGP4 costa una cinquantina di microsecondi: niente,
  // finché non se ne chiedono cinquemila. Spazzare quattro ore di cielo per
  // due stazioni e poi seguirne i passaggi grado per grado è esattamente
  // questo, e **misurato** faceva trecentotredici millisecondi: venti
  // fotogrammi persi in un colpo, ogni due minuti. Un `requestIdleCallback`
  // non basta a curarlo — il turno che concede è di una cinquantina di
  // millisecondi, e un compito da trecento lo sfonda e blocca lo schermo
  // lo stesso.
  //
  // Quindi il conto non si accorcia: si **spezza**. È la stessa cura del
  // tracciamento dei raggi delle acque (`acqueTagliaAScaglioni` in
  // terreno.js), e la stessa forma: una coda di compiti, ognuno abbastanza
  // piccolo da starci in mezzo fotogramma, e fra un compito e l'altro il
  // turno torna al browser.
  //
  // I compiti sono di due specie. La **sonda** chiede, un minuto per volta,
  // se la stazione è sopra l'orizzonte, e ne ricava le finestre dei
  // passaggi. La **finestra** cerca gli avvicinamenti dentro a uno di quei
  // passaggi, che dura minuti e costa poco. Le due si accodano da sole: la
  // sonda, arrivando in fondo a un passaggio, ci mette dietro la finestra
  // corrispondente.
  function tranLavoroStazioni(ora, quandoFinito, opz) {
    // Il budget di uno scaglione, in millisecondi. `Infinity` vuol dire
    // «tutto in un colpo», ed è la porta da cui entra il banco di prova.
    //
    // Attenzione al confronto: qui c'era `Number.isFinite(opz.scaglioneMs)`,
    // che per `Infinity` risponde **falso** — quindi il budget infinito
    // ricadeva sugli otto millisecondi di serie, la coda cedeva il turno, e
    // `tranScanStazioni` tornava con la sua lista ancora vuota. Il difetto
    // era invisibile finché le tabelle erano già in memoria (allora il
    // lavoro che restava ci stava dentro a uno scaglione e finiva davvero
    // prima di tornare), e compariva solo quando bisognava ricostruirle: cioè
    // in modo intermittente, che è il modo peggiore. L'ha preso la prova che
    // confronta le due strade, ed è esattamente quello per cui c'è.
    const budget = (opz && typeof opz.scaglioneMs === 'number') ? opz.scaglioneMs : TRAN_SCAGLIONE_MS;
    const stazioni = tranStazioni();
    const luogo = typeof skyLuogoDelCielo === 'function' ? skyLuogoDelCielo() : null;
    const astri = tranAstriBersaglio();
    const finestra = TRAN_FINESTRA_SAT_MIN * 60000;
    if (!stazioni.length || !luogo || !astri.length) { quandoFinito([]); return; }

    const trovati = [];
    const coda = [];
    // Le tabelle degli astri, un astro per compito. È la parte più cara di
    // tutta la scansione — quattro ore di finestra per sette astri sono
    // qualche centinaio di chiamate ad Astronomy Engine, e messe tutte in
    // fila fanno una ventina di millisecondi in un blocco solo. Spezzate
    // per astro sono tre millisecondi l'una, cioè meno di mezzo fotogramma.
    let tabelle = tranTabelleBuone(astri, ora, ora + finestra);
    const margine = tranMargineFinestra(ora, ora + finestra);
    if (!tabelle) {
      tabelle = [];
      astri.forEach(x => coda.push({ tipo: 'tabella', astro: x }));
      coda.push({ tipo: 'tabelleFatte' });
    }
    stazioni.forEach(sat => {
      const campionatore = tranStazioneCampionatore(sat, luogo);
      if (!campionatore) return;
      coda.push({ tipo: 'sonda', sat, campionatore, i: 0, apertura: null });
    });
    if (!coda.some(c => c.tipo === 'sonda')) { quandoFinito([]); return; }

    const passi = Math.ceil(finestra / TRAN_SONDA_SAT_MS);

    const adesso = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

    function scaglione() {
      const finePezzo = adesso() + budget;
      while (coda.length) {
        const c = coda[0];
        if (c.tipo === 'tabella') {
          coda.shift();
          const voce = tranVoceTabella(c.astro, margine.t0, margine.t1);
          if (voce) tabelle.push(voce);
          if (adesso() > finePezzo) return true;
        } else if (c.tipo === 'tabelleFatte') {
          coda.shift();
          // Le tabelle appena costruite valgono anche per la scansione degli
          // aerei, che chiede una finestra molto più corta e ci sta dentro:
          // metterle nella memoria comune vuol dire che il giro degli aerei,
          // fra due minuti, non ne ricostruisce nessuna.
          tran.tabelle = tabelle;
          tran.finestraTabelle = margine;
        } else if (c.tipo === 'sonda') {
          while (c.i <= passi) {
            const t = ora + Math.min(finestra, c.i * TRAN_SONDA_SAT_MS);
            const p = c.campionatore(t);
            // Tre gradi di margine sotto la soglia degli avvisi: un
            // passaggio va aperto **prima** che diventi interessante, se no
            // il primo campione utile cade già in mezzo alla salita e la
            // finestra comincia troncata.
            const su = p && p.alt > TRAN_ALT_MINIMA - 3;
            if (su && c.apertura === null) c.apertura = t;
            if ((!su || c.i === passi) && c.apertura !== null) {
              coda.push({ tipo: 'finestra', sat: c.sat, campionatore: c.campionatore,
                          a: c.apertura, b: t });
              c.apertura = null;
            }
            c.i++;
            if (adesso() > finePezzo) return true;
          }
          coda.shift();
        } else {
          coda.shift();
          const errore = tranErroreTle(c.sat);
          // Lo stesso passo grosso degli aerei, e per la stessa ragione: il
          // cammino serve a **incastrare** il minimo, non a trovarlo. A
          // trovarlo è la sezione aurea di §4, che dal bracket arriva al
          // millisecondo comunque largo sia. Un passo di 0,6°, come nel
          // primo tentativo, costava tre volte tanto e non aggiungeva una
          // cifra di precisione.
          tranCercaAvvicinamenti(c.campionatore, c.a, c.b, tabelle, {
            dtMinMs: 5, dtMaxMs: 8000, dtIniziale: 500, massimoCampioni: 2000
          }).forEach(e => trovati.push(Object.assign(e, {
            genere: 'stazione',
            chiave: 'sat:' + c.sat.id + ':' + e.astroId + ':' + Math.round(e.quando / 60000),
            oggettoId: c.sat.id,
            oggettoNome: c.sat.nome,
            // L'incertezza qui non è la virata di un aereo: è l'età del TLE,
            // e si scrive in secondi perché è di quello che si tratta (§7).
            incertezzaSec: errore ? errore.secondi : null,
            tleGiorni: errore ? errore.giorni : null,
            illuminata: typeof satelliteIlluminato === 'function' && e.posizione
              ? satelliteIlluminato(e.posizione, new Date(e.quando)) : null
          })));
          if (adesso() > finePezzo) return true;
        }
      }
      return false;
    }

    function giro() {
      let ancora;
      try { ancora = scaglione(); }
      catch (e) { quandoFinito([]); return; }
      if (ancora) {
        if (typeof skyQuandoLibero === 'function') skyQuandoLibero(giro, 60);
        else setTimeout(giro, 0);
      } else {
        quandoFinito(trovati);
      }
    }
    giro();
  }

  // La versione tutta in un colpo, per il banco di prova: gli stessi compiti
  // della coda, senza cedere il turno. Le due devono dare **gli stessi
  // numeri** — se divergessero, i transiti sarebbero giusti sul computer di
  // chi li ha scritti e sbagliati su un telefono lento, dove gli scaglioni
  // cadono in punti diversi. Il §31 lo controlla.
  function tranScanStazioni(ora) {
    let fuori = null;
    // Con un budget infinito la coda non cede mai il turno e `quandoFinito`
    // è chiamata prima che questa riga finisca: se un giorno smettesse di
    // essere vero, questa funzione tornerebbe una lista vuota **senza
    // dirlo**, ed è già successo. Quindi non si torna `fuori || []`: si
    // guarda se il lavoro è finito davvero.
    tranLavoroStazioni(ora, e => { fuori = e; }, { scaglioneMs: Infinity });
    if (fuori === null) throw new Error('tranScanStazioni: il lavoro non è finito nella stessa passata');
    return fuori;
  }

  function tranOrdina(elenco) {
    return elenco.slice().sort((a, b) => a.quando - b.quando);
  }

  // Chi merita un avviso. Non tutto quello che si trova: un transito è una
  // notizia, uno sfioramento a tre quarti di grado è una curiosità, e
  // mescolarli insegna a ignorare gli avvisi — che è il modo in cui una spia
  // smette di servire.
  function tranMeritaAvviso(e, ora) {
    if (!e || !Number.isFinite(e.quando)) return false;
    if (e.quando < ora - TRAN_AVVISO_CODA_MS) return false;
    if (e.quando > ora + TRAN_AVVISO_ORIZZONTE_MS) return false;
    if (tran.scartato[e.chiave]) return false;
    if (e.alt < TRAN_ALT_MINIMA) return false;
    if (e.genere === 'stazione') return e.transito;
    // Per un aereo si annuncia il transito, ma solo finché il cono
    // d'incertezza non è più largo di quello che si sta annunciando. Con un
    // preavviso di dieci minuti quel cono vale gradi: dire «passerà davanti
    // al Sole» sarebbe inventare una precisione che non c'è.
    return e.transito && e.incertezza <= Math.max(2, e.bersaglio * 12);
  }

  function tranAvvisoCorrente(ora) {
    const adesso = Number.isFinite(ora) ? ora : Date.now();
    const buoni = tran.eventi.filter(e => tranMeritaAvviso(e, adesso));
    if (!buoni.length) return null;
    // Il più imminente fra quelli ancora da venire; se sono tutti passati,
    // l'ultimo, che è quello che si è appena visto.
    const futuri = buoni.filter(e => e.quando >= adesso);
    return (futuri.length ? futuri : buoni)[0] || null;
  }

  function tranAggiorna(forza) {
    if (typeof sky === 'undefined') return;
    const ora = Date.now();
    // Nella macchina del tempo un avviso «fra tre minuti» non vuol dire
    // niente: si sta guardando un'altra sera. Il conto si ferma, e gli
    // avvisi con lui.
    const api = window.AereiADS_B;
    const reale = !api || !api.tempoReale || api.tempoReale();
    if (!reale) { if (tran.eventi.length) { tran.eventi = []; tranAggiornaAvviso(); } return; }

    if (!tran.aereiInCorso && (forza || ora - tran.quandoAerei > TRAN_RICALCOLO_AEREI_MS)) {
      tran.quandoAerei = ora;
      tran.aereiInCorso = true;
      const lavoro = () => {
        try { tran.eventiAerei = tranScanAerei(Date.now()); }
        catch (e) { tran.eventiAerei = []; }
        tran.aereiInCorso = false;
        tran.eventi = tranOrdina(tran.eventiAerei.concat(tran.eventiStazioni));
        tranAggiornaAvviso();
      };
      // Misurata con quaranta aerei in cielo, la scansione costa una decina
      // di millisecondi: quanto un fotogramma intero. Fatta dentro al ciclo
      // di disegno sarebbe un fotogramma perso ogni quattro secondi — poco,
      // e visibile. Va quindi dove vanno le altre cose care di questa app:
      // nel tempo che il browser non sta usando per disegnare. Chi la chiede
      // **esplicitamente** (`forza`) la vuole invece adesso, e se la prende.
      if (forza) lavoro();
      else if (typeof skyQuandoLibero === 'function') skyQuandoLibero(lavoro, 800);
      else setTimeout(lavoro, 0);
    }
    if (!tran.stazioniInCorso && (forza || ora - tran.quandoStazioni > TRAN_RICALCOLO_SAT_MS)) {
      tran.quandoStazioni = ora;
      tran.stazioniInCorso = true;
      // La scansione delle stazioni è l'unica cosa cara di questo file:
      // qualche migliaio di propagazioni SGP4. Fatta dentro al ciclo di
      // disegno sarebbe un fotogramma perso ogni due minuti — poco, ma
      // visibile, e questo planetario il fotogramma se lo conta. Va quindi
      // dove vanno le altre cose care: nel tempo che il browser non sta
      // usando per disegnare.
      const lavoro = () => {
        try {
          tranLavoroStazioni(Date.now(), trovati => {
            tran.eventiStazioni = trovati;
            tran.stazioniInCorso = false;
            tran.eventi = tranOrdina(tran.eventiAerei.concat(tran.eventiStazioni));
            tranAggiornaAvviso();
          });
        } catch (e) {
          tran.eventiStazioni = [];
          tran.stazioniInCorso = false;
        }
      };
      if (typeof skyQuandoLibero === 'function') skyQuandoLibero(lavoro, 1200);
      else setTimeout(lavoro, 0);
    }
    tranAggiornaAvviso();
  }

  // =====================================================================
  // 9. L'AVVISO — il tempo che manca, scritto come lo si direbbe
  // =====================================================================

  // «fra 3 min 12 s», «fra 2 h 15 min», «adesso». Le ore compaiono solo
  // quando servono, e i secondi spariscono appena diventano rumore: sapere
  // che mancano «due ore e quindici» è utile, sapere che ne mancano
  // «due ore, quindici minuti e otto secondi» è una cifra da leggere per
  // niente.
  function tranQuantoManca(ms) {
    // Il conto sta nel gestore delle lingue: la precisione che si adatta alla
    // distanza (i secondi finché contano, poi i minuti) è la stessa che serve
    // a un'eclissi del 2070 e a un transito che comincia adesso, e scritta due
    // volte diventa due frasi da tradurre.
    // `breve`: l'avviso sta appoggiato sul cielo e ha due centimetri di
    // larghezza — «fra 45 s», non «fra 45 secondi».
    return astroI18n.quantoManca(ms, { codaMs: TRAN_AVVISO_CODA_MS, breve: true });
  }


  function tranPunti(az) {
    // La rosa la dà il gestore: in inglese l'ovest è «W», non «O».
    return astroI18n.siglaPunto(az);
  }

  function tranTitolo(e) {
    const che = e.genere === 'stazione' ? e.oggettoNome : `Aereo ${e.oggettoNome}`;
    return `${che} passa davanti ${tranArticolo(e.astroNome)}`;
  }

  function tranArticolo(nome) {
    if (nome === 'Sole') return 'al Sole';
    if (nome === 'Luna') return 'alla Luna';
    return 'a ' + nome;
  }

  // Il dettaglio sotto al titolo. Tre cose e non una di più: dove guardare,
  // quanto dura, e quanto ci si può credere — che è la riga che questo
  // modulo esiste per non dimenticare.
  function tranDettaglio(e) {
    const pezzi = [];
    pezzi.push(`${tranPunti(e.az)}, ${Math.round(e.alt)}° sull'orizzonte`);
    if (e.durataMs) {
      const s = e.durataMs / 1000;
      pezzi.push(s < 10 ? `dura ${s.toFixed(1)} s` : `dura ${Math.round(s)} s`);
    }
    if (e.genere === 'stazione') {
      if (Number.isFinite(e.incertezzaSec) && e.incertezzaSec >= 0.05) {
        pezzi.push(`± ${e.incertezzaSec.toFixed(1)} s`);
      } else {
        pezzi.push('orario esatto');
      }
    } else if (Number.isFinite(e.incertezza)) {
      // Per un aereo l'incertezza è angolare, ed è la cosa importante: dice
      // di quanto può mancare il bersaglio, non di quanto può sbagliare
      // l'ora.
      pezzi.push(`± ${e.incertezza < 1 ? e.incertezza.toFixed(1) : Math.round(e.incertezza)}° di mira`);
    }
    return pezzi.join(' · ');
  }

  let avvisoUltimo = '';
  let avvisoNodo = null;

  function tranAggiornaAvviso() {
    // Il nodo si cerca una volta sola. Questa funzione gira a ogni
    // fotogramma, e una `getElementById` per fotogramma non costa niente da
    // sola — ma in questo ciclo niente costa niente da solo: sono le
    // trentacinque cose che non costano niente a fare i tre millisecondi.
    if (!avvisoNodo || !avvisoNodo.isConnected) avvisoNodo = document.getElementById('transito-avviso');
    const el = avvisoNodo;
    if (!el) return;
    // La strada che si percorre novantanove volte su cento: nessun transito
    // in vista e l'avviso già spento. Si esce prima di toccare il DOM e
    // prima di filtrare l'elenco.
    if (!tran.eventi.length && el.classList.contains('hidden')) return;
    const ora = Date.now();
    const e = tranAvvisoCorrente(ora);
    const aperto = typeof sky !== 'undefined' && sky.aperto;
    if (!e || !aperto) {
      if (!el.classList.contains('hidden')) { el.classList.add('hidden'); avvisoUltimo = ''; }
      return;
    }
    const manca = tranQuantoManca(e.quando - ora);
    const firma = e.chiave + '|' + manca + '|' + Math.round(e.separazione * 1000);
    if (firma === avvisoUltimo) return;
    avvisoUltimo = firma;
    el.classList.remove('hidden');
    el.dataset.genere = e.genere;
    const titolo = el.querySelector('[data-transito-titolo]');
    const quando = el.querySelector('[data-transito-quando]');
    const nota = el.querySelector('[data-transito-nota]');
    if (titolo) titolo.textContent = tranTitolo(e);
    if (quando) quando.textContent = manca;
    if (nota) nota.textContent = tranDettaglio(e);
    el.dataset.chiave = e.chiave;
  }

  // Chiudere un avviso è una risposta, non un rinvio: quel transito non si
  // ripropone. Gli altri sì — e il prossimo passaggio della stessa stazione
  // ha una chiave diversa, perché ci sta dentro il minuto.
  function tranScartaAvviso() {
    const el = avvisoNodo || document.getElementById('transito-avviso');
    if (!el || !el.dataset.chiave) return;
    const ora = Date.now();
    tran.scartato[el.dataset.chiave] = ora;
    // Le chiavi vecchie si buttano: passata la finestra in cui quel transito
    // poteva comparire, ricordarsi che era stato chiuso non serve più — e
    // una mappa che cresce per tutta la sessione è il genere di perdita che
    // non si vede finché non si tiene il planetario aperto una notte intera.
    Object.keys(tran.scartato).forEach(k => {
      if (ora - tran.scartato[k] > TRAN_AVVISO_ORIZZONTE_MS + TRAN_AVVISO_CODA_MS) delete tran.scartato[k];
    });
    avvisoUltimo = '';
    tranAggiornaAvviso();
  }

  // Portare la vista sul transito annunciato: è la cosa che uno vuole fare
  // subito dopo aver letto l'avviso, e cercarla nei pannelli sarebbe la
  // stessa fatica di prima.
  function tranGuardaAvviso() {
    const e = tranAvvisoCorrente(Date.now());
    if (!e || typeof skyCentraSu !== 'function') return;
    // `skyCentraSu` vuole un oggetto con un nome: col telefono che punta il
    // cielo non può spostare la mappa, e allora dice a voce da che parte
    // girarsi — e per dirlo quel nome le serve.
    skyCentraSu({ az: e.az, alt: e.alt, nome: tranTitolo(e) });
  }

  function tranCollega() {
    const el = document.getElementById('transito-avviso');
    if (!el || el.dataset.collegato === 'si') return;
    el.dataset.collegato = 'si';
    const chiudi = el.querySelector('[data-transito-chiudi]');
    if (chiudi) chiudi.addEventListener('click', tranScartaAvviso);
    const guarda = el.querySelector('[data-transito-guarda]');
    if (guarda) guarda.addEventListener('click', tranGuardaAvviso);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tranCollega);
    } else {
      tranCollega();
    }
  }

  // =====================================================================
  // 10. QUELLO CHE ESCE DA QUI
  // =====================================================================

  window.tranAggiorna = tranAggiorna;
  window.tranAggiornaAvviso = tranAggiornaAvviso;
  window.tranEventi = () => tran.eventi.slice();
  window.tranAvvisoCorrente = tranAvvisoCorrente;
  window.tranQuantoManca = tranQuantoManca;

  // Per il banco di prova (§31 di verifica.html) e per chi debba guardarci
  // dentro dalla console. La geometria dei §2-§4 è pura: si prova senza
  // caricare `app.js`, ed è per questo che è scritta così.
  window.Transiti = {
    tranVersore, tranAzAlt, tranSeparazione, tranNormalizza,
    tranCammino, tranMinimo, tranContatto, tranBrackets,
    tranTabellaAstro, tranRaggioAstro,
    tranCercaAvvicinamenti, tranTabelle, tranAstriBersaglio,
    tranArcoAereo, tranIncertezzaAereo, tranAperturaAereo, tranAereoCampionatore,
    tranStazioni, tranStazioneCampionatore, tranErroreTle,
    tranScanAerei, tranScanStazioni, tranLavoroStazioni, tranMeritaAvviso, tranAvvisoCorrente,
    tranQuantoManca, tranPunti, tranTitolo, tranDettaglio,
    stato: tran,
    TRAN_PASSO_GROSSO, TRAN_MARGINE_GROSSO, TRAN_SOGLIA_VICINO, TRAN_TOLLERANZA_MS,
    TRAN_PASSO_ASTRI_MS, TRAN_BERSAGLI, TRAN_APERTURA_AEREO_M,
    TRAN_SIGMA_ROTTA_GRADI, TRAN_SIGMA_VELOCITA, TRAN_AEREO_PREAVVISO_MAX_MS,
    TRAN_FINESTRA_SAT_MIN, TRAN_FINESTRA_AEREI_MIN, TRAN_ALT_MINIMA,
    TRAN_SONDA_SAT_MS, TRAN_SCAGLIONE_MS,
    TRAN_AVVISO_ORIZZONTE_MS, TRAN_AVVISO_CODA_MS
  };
}());
