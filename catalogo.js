// =====================================================================
// IL CATALOGO DEL CIELO
//
// Fino a ieri il planetario disegnava centocinquanta stelle: quelle delle
// ventitré figure che qualcuno aveva scritto a mano. Bastavano a
// riconoscere Orione, ma un cielo con centocinquanta stelle non è un
// cielo — è uno schema. Fra le figure c'era il vuoto, e il vuoto è la
// cosa che più di tutte tradisce che stai guardando un disegno.
//
// Adesso ce ne sono cinquemila: tutte quelle che un occhio abituato al
// buio vede da un cielo scuro, con le ottantotto figure ufficiali sopra.
//
// Due problemi da risolvere, e sono il motivo per cui questo file esiste
// invece di essere tre righe dentro app.js:
//
//   1. COSTA. app.js chiamava Astronomy.Horizon() una volta per stella,
//      a ogni aggiornamento. Con centocinquanta stelle sono
//      centocinquanta ricerche trigonometriche complete — si sopporta.
//      Con cinquemila, fino a quindici volte al secondo, sono
//      settantacinquemila al secondo, e il ciclo del planetario (che
//      deve stare sotto il millisecondo per fotogramma) muore. Qui la
//      rotazione dal cielo di J2000 al cielo di stasera si calcola UNA
//      VOLTA per aggiornamento, come matrice 3×3, e poi si applica a
//      ogni stella con nove moltiplicazioni. Cinquemila stelle costano
//      meno di quanto ne costassero cinquanta prima.
//
//   2. PESA. Duecento kilobyte di cataloghi non devono stare sulla
//      strada di chi apre l'app per sapere che tempo fa stasera. I tre
//      file dei dati si caricano da soli la prima volta che si apre il
//      planetario, non prima, e da lì in poi li tiene il service worker.
//
// Ordine di caricamento: dopo app.js (usa `sky`, `skyProietta`,
// `skyEstinzione`, `skyVelo`), prima o dopo telescopio.js — non si parlano.
//
// Fonte dei dati: Hipparcos, Yale Bright Star Catalog e il catalogo di
// Messier, per il tramite di d3-celestial (BSD-3-Clause). Cataloghi
// pubblici: nessuna chiave, nessun servizio, nessuna rete dopo il primo
// caricamento.
// =====================================================================


// =====================================================================
// 1. CARICAMENTO PIGRO
//     I tre file dei dati non stanno in index.html: ci arrivano da soli
//     quando il planetario si apre davvero. Chi non lo apre mai non li
//     scarica mai.
// =====================================================================

const CAT_FILE = ['dati-stelle.js', 'dati-costellazioni.js', 'dati-profondo.js'];
const CAT_FILE_DEBOLI = 'dati-stelle-deboli.js';

// Il taglio fra i due livelli del catalogo stellare, lo stesso che usa lo
// script che genera i dati.
const CAT_MAG_PRIMO_LIVELLO = 6.0;

const cat = {
  stato: 'niente',        // niente | in-corso | pronto | fallito
  promessa: null,

  // Il secondo livello — le diecimilacinquecento stelle fra la sesta e la
  // settima magnitudine — è un file a parte da 267 KB che quasi nessuno
  // scarica: serve solo a chi ha un cielo di montagna o sta ingrandendo
  // forte. Chi guarda dal balcone di città non lo vedrà mai passare.
  secondoLivello: 'niente',
  promessaDeboli: null,

  quante: 0,              // quante stelle ci sono adesso, primo livello + eventuale secondo

  // Vettori unitari delle stelle nel cielo di J2000, calcolati una volta
  // sola: sono la parte cara del conto, e non cambia mai.
  versoriJ2000: null,     // Float64Array, 3 per stella
  // Gli stessi vettori portati nel cielo di stasera, in coordinate
  // Est/Nord/Alto — la convenzione che usa skyProietta.
  versoriOra: null,       // Float64Array, 3 per stella
  magnitudini: null,      // Float32Array
  famiglie: null,         // Uint8Array: in quale delle sette famiglie di colore cade
  colori: null,           // Map indice → colore CSS, solo per quelle disegnate a una a una
  nomiPerIndice: null,    // Map indice → nome, solo per le 701 che ne hanno uno

  // Le figure: gli stessi punti, ma sono novecento in tutto e si possono
  // tenere come semplici array.
  figure: null,

  profondo: null,         // il catalogo degli oggetti profondi, arricchito
  // Le nubi della Via Lattea non stanno qui: le tiene app.js, che è dove
  // nascono e dove si disegnano. Questo modulo si limita a portarle nel
  // cielo di adesso con la matrice delle stelle.

  // La rotazione dal cielo di J2000 a quello di adesso, come l'ha
  // calcolata l'ultimo aggiornamento. Non serve a noi: serve a chi vuole
  // portare in cielo un punto qualsiasi (i telai dei disegni delle
  // costellazioni) **con la stessa matrice** delle stelle. Ricalcolarla
  // per conto proprio funzionerebbe lo stesso, ma un istante diverso di
  // mezzo secondo staccherebbe il disegno dalle sue stelle.
  matrice: null,
  quandoAggiornato: 0
};

function catPronto() {
  return cat.stato === 'pronto';
}

// Carica i tre file di dati, una volta sola. Se la rete non c'è e il
// service worker non li ha ancora presi, il planetario resta quello di
// prima: le figure scritte a mano in app.js. Nessun errore in faccia a
// nessuno — semplicemente un cielo più spoglio.
function catCarica() {
  if (cat.promessa) return cat.promessa;
  cat.stato = 'in-corso';

  cat.promessa = Promise.all(CAT_FILE.map(catCaricaScript))
    .then(() => {
      catPreparaStelle();
      catPreparaFigure();
      catPreparaProfondo();
      cat.stato = 'pronto';

      // L'elenco degli astri era già stato composto con i quattordici
      // oggetti profondi di prima: va rifatto, adesso che ce ne sono
      // centoquarantadue.
      if (typeof skyInvalidaElenco === 'function') skyInvalidaElenco();
      return true;
    })
    .catch(e => {
      console.warn('Catalogo del cielo non caricato:', e);
      cat.stato = 'fallito';
      return false;
    });

  return cat.promessa;
}

function catCaricaScript(file) {
  return new Promise((risolvi, rifiuta) => {
    const s = document.createElement('script');
    s.src = file;
    s.async = false;                  // l'ordine fra i tre non conta, ma tanto vale
    s.onload = () => risolvi();
    s.onerror = () => rifiuta(new Error('non si carica: ' + file));
    document.head.appendChild(s);
  });
}

// Il secondo livello si chiede da sé, la prima volta che serve: quando il
// cielo impostato è così scuro, o lo zoom così stretto, che il primo
// livello finisce e il cielo comincia a svuotarsi invece di riempirsi.
// Qui si guarda la magnitudine **voluta**, non quella concessa: quella
// concessa è già tosata alla profondità del catalogo (`catMagnitudineLimite`)
// e a chiederle di superare la soglia che fa scattare lo scarico si finirebbe
// col cane che si morde la coda — il file non si chiede perché non è
// arrivato, e non arriva perché non lo si chiede.
function catServeSecondoLivello() {
  if (!catPronto() || cat.secondoLivello !== 'niente') return;
  if (catMagnitudineVoluta() <= CAT_MAG_PRIMO_LIVELLO) return;

  cat.secondoLivello = 'in-corso';
  cat.promessaDeboli = catCaricaScript(CAT_FILE_DEBOLI)
    .then(() => {
      cat.secondoLivello = 'pronto';
      catPreparaStelle();             // si rifà da capo con l'elenco unito
      catAggiornaPosizioni(typeof skyAdesso === 'function' ? skyAdesso() : new Date());
      // Non serve chiedere un ridisegno: il ciclo del planetario gira su
      // requestAnimationFrame finché la vista è aperta, e al fotogramma
      // dopo le stelle nuove ci sono già.
    })
    .catch(() => {
      // Niente rete: si continua col primo livello, e non si riprova a
      // ogni fotogramma. Il cielo è meno fitto, e basta.
      cat.secondoLivello = 'fallito';
    });
}


// =====================================================================
// 2. IL COLORE DI UNA STELLA
//     Un cielo di puntini bianchi è un cielo finto. Le stelle hanno un
//     colore, e a occhio nudo si vede: Antares e Betelgeuse sono
//     arancioni, Rigel e Spica azzurre, e chi ha imparato a vederlo non
//     riesce più a non vederlo.
//
//     L'indice B−V è la misura di quel colore: quanto una stella è più
//     luminosa nel blu che nel visuale. Negativo vuol dire azzurra
//     (Rigel, −0,03), positivo rossa (Betelgeuse, +1,50).
// =====================================================================

// Sette tacche lungo la scala, interpolate. I valori vengono dalla
// temperatura di colore corrispondente, non da un gusto personale.
const CAT_SCALA_COLORE = [
  [-0.40, 155, 176, 255],   // azzurra, 30.000 K
  [ 0.00, 202, 215, 255],   // bianco-azzurra, 10.000 K
  [ 0.40, 248, 247, 255],   // bianca, 7.000 K
  [ 0.80, 255, 244, 234],   // bianco-gialla, 5.500 K
  [ 1.20, 255, 210, 161],   // gialla-arancione, 4.200 K
  [ 1.60, 255, 190, 127],   // arancione, 3.500 K
  [ 2.00, 255, 165, 105]    // rossa, 3.000 K
];

function catColoreDaBV(bv) {
  const s = CAT_SCALA_COLORE;
  if (bv <= s[0][0]) return `rgb(${s[0][1]},${s[0][2]},${s[0][3]})`;
  for (let i = 1; i < s.length; i++) {
    if (bv > s[i][0]) continue;
    const a = s[i - 1], b = s[i];
    const k = (bv - a[0]) / (b[0] - a[0]);
    const r = Math.round(a[1] + k * (b[1] - a[1]));
    const g = Math.round(a[2] + k * (b[2] - a[2]));
    const bl = Math.round(a[3] + k * (b[3] - a[3]));
    return `rgb(${r},${g},${bl})`;
  }
  const u = s[s.length - 1];
  return `rgb(${u[1]},${u[2]},${u[3]})`;
}


// =====================================================================
// 3. PREPARAZIONE DEL CATALOGO
//     Si fa una volta sola, appena i dati arrivano. Tutto quello che non
//     dipende né dall'ora né da dove sei si calcola qui e non si tocca
//     più: i vettori unitari, i colori, i nomi.
// =====================================================================

// Le otto stelle degli slot Star1…Star8 di app.js le disegna già lui, con
// l'icona, il nome e la scheda ricca (spettro, raggio, distanza). Il
// catalogo deve saltarle, o finirebbero disegnate due volte — e mai
// esattamente nello stesso posto, perché i due cataloghi differiscono di
// qualche centesimo di grado. Due Sirii affiancati sono la cosa più
// brutta che possa capitare a un planetario.
function catIndiciDaSaltare() {
  const salta = new Set();
  if (typeof SKY_STELLE === 'undefined') return salta;

  const n = CATALOGO_STELLE_QUANTE;
  SKY_STELLE.forEach(s => {
    let migliore = -1, minimo = Infinity;
    for (let i = 0; i < n; i++) {
      // Sopra la terza magnitudine ci sono duecento stelle: cercare fra
      // quelle basta e avanza, e ci risparmia cinquemila confronti per
      // ognuna delle otto.
      if (CATALOGO_STELLE[i * 4 + 2] > 3.0) break;
      const dRa = (CATALOGO_STELLE[i * 4] - s.ra) * 15 *
                  Math.cos(s.dec * Math.PI / 180);
      const dDec = CATALOGO_STELLE[i * 4 + 1] - s.dec;
      const d2 = dRa * dRa + dDec * dDec;
      if (d2 < minimo) { minimo = d2; migliore = i; }
    }
    // Un decimo di grado: abbastanza largo da assorbire la differenza fra
    // due cataloghi, abbastanza stretto da non prendere la stella accanto.
    if (migliore >= 0 && minimo < 0.01) salta.add(migliore);
  });
  return salta;
}

// Al di sopra di questa magnitudine una stella si disegna a una a una,
// con l'alone e il nome; sotto, finisce nel mucchio del suo colore. Sono
// un centinaio scarse, e sono quelle che si cercano davvero.
const CAT_MAG_LUMINOSE = 2.2;

// Sotto questo campo si è dentro all'oculare: sullo schermo restano poche
// decine di stelle, e allora le prendono tutte, il trattamento singolo —
// alone e nome. Il mucchio per famiglia di colore esiste per non fare
// cinquemila `fill()` a fotogramma; con trenta stelle non serve a niente, e
// un puntino grigio da un pixel in mezzo a uno schermo nero non si legge
// come una stella: si legge come polvere sul vetro.
const CAT_FOV_OCULARE = 6;

function catPreparaStelle() {
  const salta = catIndiciDaSaltare();

  // I due livelli si leggono di fila senza unirli in un array nuovo:
  // sarebbero altri quattrocento kilobyte di memoria per niente.
  const primo = CATALOGO_STELLE, quantiPrimo = CATALOGO_STELLE_QUANTE;
  const haDeboli = cat.secondoLivello === 'pronto' && typeof CATALOGO_STELLE_DEBOLI !== 'undefined';
  const secondo = haDeboli ? CATALOGO_STELLE_DEBOLI : null;
  const quantiSecondo = haDeboli ? CATALOGO_STELLE_DEBOLI_QUANTE : 0;
  const n = quantiPrimo + quantiSecondo;

  cat.quante = n;
  cat.versoriJ2000 = new Float64Array(n * 3);
  cat.versoriOra = new Float64Array(n * 3);
  cat.magnitudini = new Float32Array(n);
  cat.famiglie = new Uint8Array(n);
  cat.colori = new Map();

  const D2R = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const dentro = i < quantiPrimo ? primo : secondo;
    const k = (i < quantiPrimo ? i : i - quantiPrimo) * 4;

    const ra = dentro[k] * 15 * D2R;              // ore → gradi → radianti
    const dec = dentro[k + 1] * D2R;
    const cd = Math.cos(dec);

    // Vettore unitario nel sistema equatoriale di J2000, la stessa
    // convenzione di Astronomy Engine: x verso il punto d'Ariete,
    // z verso il polo nord celeste.
    cat.versoriJ2000[i * 3]     = cd * Math.cos(ra);
    cat.versoriJ2000[i * 3 + 1] = cd * Math.sin(ra);
    cat.versoriJ2000[i * 3 + 2] = Math.sin(dec);

    // Una stella saltata non si cancella dagli array — sposterebbe tutti
    // gli indici, e i nomi puntano agli indici. Si mette a una
    // magnitudine che nessun filtro lascia mai passare.
    const mag = salta.has(i) ? 99 : dentro[k + 2];
    cat.magnitudini[i] = mag;

    // La famiglia di colore si decide qui, non nel ciclo di disegno: là
    // sarebbe una divisione e due arrotondamenti per stella per
    // fotogramma, e non cambia mai.
    cat.famiglie[i] = catFamigliaDi(dentro[k + 3]);
    // Il colore per esteso serve solo a quelle disegnate a una a una e a
    // quelle che compaiono in elenco: tenerne quindicimila stringhe
    // sarebbe un megabyte buttato.
    if (mag <= 3.2) cat.colori.set(i, catColoreDaBV(dentro[k + 3]));
  }

  cat.nomiPerIndice = new Map();
  if (typeof STELLE_NOMI !== 'undefined') {
    STELLE_NOMI.forEach(([i, nome]) => {
      if (!salta.has(i)) cat.nomiPerIndice.set(i, nome);
    });
  }
}

function catPreparaFigure() {
  if (typeof COSTELLAZIONI_IAU === 'undefined') { cat.figure = []; return; }
  const D2R = Math.PI / 180;

  cat.figure = COSTELLAZIONI_IAU.map(c => {
    // Ogni spezzata diventa due array paralleli: i vettori J2000 (fermi) e
    // quelli di stasera (riscritti a ogni aggiornamento). Novecento punti
    // in tutto: si può stare comodi.
    const spezzate = c.spezzate.map(linea => {
      const j2000 = new Float64Array(linea.length * 3);
      linea.forEach(([raOre, dec], k) => {
        const ra = raOre * 15 * D2R, d = dec * D2R, cd = Math.cos(d);
        j2000[k * 3]     = cd * Math.cos(ra);
        j2000[k * 3 + 1] = cd * Math.sin(ra);
        j2000[k * 3 + 2] = Math.sin(d);
      });
      return { j2000, ora: new Float64Array(linea.length * 3), quanti: linea.length };
    });

    // Il nome della figura si scrive nel suo baricentro, che si calcola
    // dalla media dei vettori: farlo sulle coordinate darebbe un punto
    // sbagliato per ogni figura a cavallo delle zero ore (Pegaso, Pesci).
    const centro = new Float64Array(3);
    let quanti = 0;
    spezzate.forEach(s => {
      for (let k = 0; k < s.quanti; k++) {
        centro[0] += s.j2000[k * 3];
        centro[1] += s.j2000[k * 3 + 1];
        centro[2] += s.j2000[k * 3 + 2];
        quanti++;
      }
    });
    const norma = Math.hypot(centro[0], centro[1], centro[2]) || 1;
    centro[0] /= norma; centro[1] /= norma; centro[2] /= norma;

    return {
      sigla: c.sigla, nome: c.nome, latino: c.latino, rango: c.rango,
      spezzate, centroJ2000: centro, centroOra: new Float64Array(3)
    };
  });
}

// I quattordici oggetti profondi che app.js aveva già hanno qualcosa che
// nessun catalogo dà: una nota scritta a mano da chi li ha guardati
// davvero ("la stella di mezzo della spada di Orione non è una stella"),
// la distanza in anni luce e l'angolo di posizione. Quella roba non si
// butta: si appiccica sopra alle voci del catalogo grande.
function catPreparaProfondo() {
  if (typeof CATALOGO_PROFONDO === 'undefined') { cat.profondo = []; return; }

  const scritteAMano = new Map();
  if (typeof SKY_PROFONDO !== 'undefined') {
    SKY_PROFONDO.forEach(o => scritteAMano.set(o.nome.split(' ')[0], o));
  }

  const D2R = Math.PI / 180;
  cat.profondo = CATALOGO_PROFONDO.map(o => {
    const vecchio = scritteAMano.get(o.sigla);
    const ra = o.ra * 15 * D2R, dec = o.dec * D2R, cd = Math.cos(dec);

    return {
      // Il nome per esteso è quello che compare in elenco e sulla mappa.
      // "M31 — Galassia di Andromeda" se un nome ce l'ha, se no
      // "M85 — galassia ellittica": mai una sigla nuda.
      nome: o.alt ? `${o.sigla} — ${o.alt}` : `${o.sigla} — ${o.tipoTesto}`,
      sigla: o.sigla,
      altro: o.altro,
      ra: o.ra, dec: o.dec, mag: o.mag,
      tipo: o.tipo, tipoTesto: o.tipoTesto,
      assePrimi: o.assePrimi, asseMinore: o.asseMinore,
      brillanza: o.brillanza,
      messier: o.messier,

      // Dal vecchio elenco: l'angolo di posizione (senza, ogni galassia
      // sarebbe disegnata dritta), la distanza e la nota.
      angoloPosizione: vecchio && typeof vecchio.angoloPosizione === 'number'
        ? vecchio.angoloPosizione : 0,
      distanza: vecchio ? vecchio.distanza : null,
      dimensione: vecchio ? vecchio.dimensione : catDimensioneTesto(o),
      nota: vecchio ? vecchio.nota : null,

      versore: [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)],
      az: 0, alt: 0
    };
  });
}

// "3° × 1° (sei volte la Luna piena)" invece di "190 × 60": i primi d'arco
// non dicono niente a nessuno, il paragone con la Luna sì.
function catDimensioneTesto(o) {
  const gradi = p => p >= 60 ? `${(p / 60).toFixed(1).replace('.0', '')}°` : `${Math.round(p)}′`;
  const misura = o.asseMinore && Math.abs(o.asseMinore - o.assePrimi) > 0.5
    ? `${gradi(o.assePrimi)} × ${gradi(o.asseMinore)}`
    : gradi(o.assePrimi);
  const lune = o.assePrimi / 31;
  if (lune >= 1.6) return `${misura} (${astroI18n.t('profondo.volteLunaPiena', { n: Math.round(lune) })})`;
  if (lune >= 0.7) return `${misura} (${astroI18n.t('profondo.comeLunaPiena')})`;
  if (lune >= 0.25) return `${misura} (${astroI18n.t('profondo.terzoLunaPiena')})`;
  return misura;
}


// =====================================================================
// 4. IL MOTORE — una matrice al posto di cinquemila conti
//
//     Astronomy.Horizon() fa il lavoro completo: precessione, nutazione,
//     rotazione terrestre, rifrazione. Per una stella è la cosa giusta.
//     Per cinquemila è cinquemila volte lo stesso lavoro, perché
//     precessione, nutazione e rotazione terrestre sono le stesse per
//     tutto il cielo in un dato istante: cambia solo da quale punto del
//     cielo parti.
//
//     Quindi: si chiede alla libreria la rotazione composta
//
//        cielo di J2000 → cielo di oggi → orizzonte di qui
//
//     una volta sola, come matrice 3×3, e la si applica a ogni versore.
//     Nove moltiplicazioni e sei somme per stella.
//
//     La rifrazione si perde per strada, ed è giusto così: vale mezzo
//     grado esatto sull'orizzonte e crolla a zero salendo. Sulle stelle
//     di riferimento — quelle che si puntano davvero — app.js continua a
//     usare Horizon() con la rifrazione. Qui si disegna il fondo.
//
//     E c'è un guadagno che non era previsto. Astronomy.Horizon() vuole
//     coordinate dell'equatore DI OGGI, mentre i cataloghi (il nostro
//     compreso) sono in J2000: passargliele così com'erano metteva tutto
//     il cielo fuori posto di 0,36° — la precessione di ventisei anni,
//     più del diametro della Luna. A campo largo non si vedeva; a
//     mezzo grado di campo, dove si arriva con lo zoom, è tutto lo
//     schermo. Passando per la matrice, Rotation_EQJ_EQD fa la
//     precessione per forza, ed è impossibile dimenticarsene.
// =====================================================================

// ATTENZIONE all'indicizzazione: RotationMatrix.rot è memorizzata
// `rot[sorgente][destinazione]`, cioè la trasposta di come si scrive una
// matrice sul quaderno. Lo si vede in RotateVector, che fa
// out.x = rot[0][0]·v.x + rot[1][0]·v.y + rot[2][0]·v.z: il primo indice
// scorre la sorgente. Scambiarli non dà un errore, dà un cielo storto di
// una quarantina di gradi che sembra un problema di bussola.

function catMatriceCielo(data, osservatore) {
  const t = Astronomy.MakeTime(data);
  const rotazione = Astronomy.CombineRotation(
    Astronomy.Rotation_EQJ_EQD(t),
    Astronomy.Rotation_EQD_HOR(t, osservatore)
  );
  return rotazione.rot;
}

// Riscrive le posizioni di tutto il catalogo per l'istante dato. È la
// funzione che app.js chiama al posto del suo giro di Horizon().
function catAggiornaPosizioni(data) {
  if (!catPronto() || !sky.observer || typeof Astronomy === 'undefined') return false;

  let M;
  try {
    M = catMatriceCielo(data, sky.observer);
  } catch (e) {
    return false;                                   // data fuori scala: si lascia stare
  }

  // La matrice, srotolata in nove variabili locali, raggruppate per la
  // coordinata che producono. Dentro un ciclo da cinquemila giri ogni
  // M[0][0] è un doppio salto di puntatore: tirarle fuori una volta sola
  // vale il triplo della velocità.
  const nx = M[0][0], ny = M[1][0], nz = M[2][0];   // → Nord
  const ox = M[0][1], oy = M[1][1], oz = M[2][1];   // → Ovest
  const zx = M[0][2], zy = M[1][2], zz = M[2][2];   // → Zenit

  const j = cat.versoriJ2000, ora = cat.versoriOra;
  const n = cat.quante;

  for (let k = 0; k < n; k++) {
    const x = j[k * 3], y = j[k * 3 + 1], z = j[k * 3 + 2];
    // Est = −Ovest: è tutto il travaso dalla terna della libreria
    // (Nord, Ovest, Zenit) a quella di skyProietta (Est, Nord, Alto).
    // Sbagliare questo segno specchia il cielo da destra a sinistra, e il
    // modo più rapido di accorgersene è guardare da che parte gira il
    // Grande Carro.
    ora[k * 3]     = -(ox * x + oy * y + oz * z);
    ora[k * 3 + 1] =   nx * x + ny * y + nz * z;
    ora[k * 3 + 2] =   zx * x + zy * y + zz * z;
  }

  // Le figure: novecento punti, stessa storia
  cat.figure.forEach(fig => {
    fig.spezzate.forEach(s => {
      for (let k = 0; k < s.quanti; k++) {
        const x = s.j2000[k * 3], y = s.j2000[k * 3 + 1], z = s.j2000[k * 3 + 2];
        s.ora[k * 3]     = -(ox * x + oy * y + oz * z);
        s.ora[k * 3 + 1] =   nx * x + ny * y + nz * z;
        s.ora[k * 3 + 2] =   zx * x + zy * y + zz * z;
      }
    });
    const x = fig.centroJ2000[0], y = fig.centroJ2000[1], z = fig.centroJ2000[2];
    fig.centroOra[0] = -(ox * x + oy * y + oz * z);
    fig.centroOra[1] =   nx * x + ny * y + nz * z;
    fig.centroOra[2] =   zx * x + zy * y + zz * z;
  });

  // Il cielo profondo è solo centoquarantadue voci, e a lui serve anche
  // l'azimut in gradi: lo usano l'elenco, la freccia guida e la scheda.
  const R2D = 180 / Math.PI;
  cat.profondo.forEach(o => {
    const x = o.versore[0], y = o.versore[1], z = o.versore[2];
    const est  = -(ox * x + oy * y + oz * z);
    const nord =   nx * x + ny * y + nz * z;
    const alto =   zx * x + zy * y + zz * z;
    o.alt = Math.asin(Math.max(-1, Math.min(1, alto))) * R2D;
    o.az = (Math.atan2(est, nord) * R2D + 360) % 360;
    o.vOra = [est, nord, alto];
  });

  // Le nubi della Via Lattea passavano anche loro per Horizon() con
  // coordinate J2000, e si portavano dietro lo stesso mezzo grado di
  // scarto. Adesso sono milleseicento — tanto più vale rifarle qui, con
  // la matrice che la precessione la fa per forza.
  //
  // E si riscrivono **dentro agli stessi oggetti**: milleseicento oggetti
  // nuovi ogni volta che il cielo si aggiorna sarebbero, da soli, il conto
  // più caro di questo modulo. Gli oggetti se li costruisce app.js una
  // volta sola (`skyNubiDelCielo()`), qui si riempiono solo il versore
  // orizzontale e l'altezza.
  if (sky.mostraViaLattea && typeof skyNubiDelCielo === 'function') {
    const nubi = skyNubiDelCielo();
    for (let k = 0; k < nubi.length; k++) {
      const p = nubi[k], x = p.v[0], y = p.v[1], z = p.v[2];
      const alto = zx * x + zy * y + zz * z;
      p.vh[0] = -(ox * x + oy * y + oz * z);
      p.vh[1] =   nx * x + ny * y + nz * z;
      p.vh[2] =   alto;
      p.alt = Math.asin(Math.max(-1, Math.min(1, alto))) * R2D;
    }
    sky.viaLattea = nubi;
  } else {
    sky.viaLattea = [];
  }

  // app.js disegna il cielo profondo dal suo `sky.profondo`, e continua a
  // farlo: gli si mette dentro il catalogo grande, nella forma che si
  // aspetta. Nessuna riga di skyDisegnaProfondo() è stata toccata.
  sky.profondo = sky.mostraProfondo
    ? cat.profondo.filter(o => o.mag <= catLimiteProfondo())
    : [];

  cat.matrice = M;
  cat.quandoAggiornato = Date.now();
  return true;
}


// =====================================================================
// 5. IL CIELO DI CHI GUARDA — la scala di Bortle
//
//     Quante stelle si vedono non è una proprietà del cielo: è una
//     proprietà del posto da cui lo guardi. Dal centro di una città ne
//     conti trenta, dalla campagna duemila, da un rifugio in quota
//     tremila e la Via Lattea che fa ombra.
//
//     Finora questo numero stava in un solo posto — il profilo del
//     telescopio, dentro telescopio.js — e serviva solo a stimare il
//     contrasto all'oculare. Adesso è un'impostazione dell'app, e
//     comanda il planetario: cambiare Bortle cambia il cielo disegnato,
//     e vedere trecento stelle diventare tremila spostandosi di due
//     tacche spiega l'inquinamento luminoso meglio di qualunque testo.
// =====================================================================

const CHIAVE_CIELO_CASA = 'astrocalendario_cielo_casa';

// Le stesse sei tacche di TEL_CIELI in telescopio.js, con in più la
// brillanza del fondo cielo in magnitudini per primo quadrato: serve a
// dire se un oggetto esteso si stacca dallo sfondo oppure no.
const CAT_CIELI = {
  2: { nome: 'Cielo di montagna',        magLimite: 7.1, fondo: 13.0 },
  3: { nome: 'Campagna buia',            magLimite: 6.6, fondo: 12.7 },
  4: { nome: 'Periferia / campagna vicina', magLimite: 6.0, fondo: 12.2 },
  5: { nome: 'Periferia luminosa',       magLimite: 5.6, fondo: 11.6 },
  6: { nome: 'Cielo di paese',           magLimite: 5.1, fondo: 11.0 },
  8: { nome: 'Città',                    magLimite: 4.2, fondo: 9.8 }
};

const CAT_CIELO_PREDEFINITO = 5;

function cieloDiCasa() {
  try {
    const v = parseInt(localStorage.getItem(CHIAVE_CIELO_CASA), 10);
    if (CAT_CIELI[v]) return v;
  } catch (e) { /* storage negato */ }

  // Se non è mai stato scelto ma il telescopio sì, vale quello: è la
  // stessa domanda fatta due volte, e chi ha già risposto una volta non
  // deve rispondere di nuovo.
  try {
    if (typeof telProfilo === 'function') {
      const p = telProfilo();
      if (p && CAT_CIELI[p.cielo]) return p.cielo;
    }
  } catch (e) { /* telescopio non caricato */ }

  return CAT_CIELO_PREDEFINITO;
}

function impostaCieloDiCasa(bortle) {
  if (!CAT_CIELI[bortle]) return;
  try { localStorage.setItem(CHIAVE_CIELO_CASA, String(bortle)); } catch (e) { /* pieno */ }

  // Il telescopio fa lo stesso conto per il contrasto all'oculare: se
  // gliela cambio qui e non lì, le due parti dell'app si contraddicono.
  try {
    if (typeof telProfilo === 'function' && typeof telSalvaProfilo === 'function') {
      const p = telProfilo();
      if (p && p.cielo !== bortle) { p.cielo = bortle; telSalvaProfilo(); }
    }
  } catch (e) { /* telescopio non caricato */ }

  // Il cielo si riaggiusta da sé: catMagnitudineLimite() legge questa
  // impostazione a ogni fotogramma, e il ciclo del planetario gira già.
}

// Quanto lo zoom fa da strumento: avvicinarsi con le dita è la stessa cosa
// che alzare un binocolo, e come col binocolo compaiono stelle che a occhio
// nudo non c'erano. Senza questo, ingrandire dava un cielo sempre più vuoto
// — le stesse poche stelle sempre più distanti fra loro.
function catGuadagnoZoom() {
  const fov = sky && sky.fov ? sky.fov : 55;
  return Math.max(0, Math.min(3, Math.log2(55 / Math.max(0.2, fov)) * 0.8));
}

// La magnitudine più debole che questo catalogo contiene: sesta col solo
// primo livello, settima quando sono arrivate anche le deboli.
const CAT_MAG_SECONDO_LIVELLO = 7.0;

// Fin dove il catalogo può arrivare. **Il "può" non è una sfumatura**: qui
// va risposto con la profondità raggiungibile, non con quella già in
// memoria. Il secondo livello si scarica solo quando qualcuno chiede più
// della sesta magnitudine (`catServeSecondoLivello`), e rispondere 6,0
// finché non è arrivato vorrebbe dire tosare il limite proprio alla soglia
// che deve superarlo: le stelle deboli non si chiederebbero mai, e il
// livello in più non si vedrebbe mai. Si scende a 6,0 solo quando quel file
// non arriverà più.
function catProfonditaCatalogo() {
  return cat.secondoLivello === 'fallito' ? CAT_MAG_PRIMO_LIVELLO : CAT_MAG_SECONDO_LIVELLO;
}

// La magnitudine che si *vorrebbe* vedere: il cielo di casa più il guadagno
// dello zoom, meno quello che si mangia la luce del giorno. Può superare il
// catalogo, ed è lei a dire di quanto (`catOltreIlCatalogo`).
function catMagnitudineVoluta() {
  const cielo = CAT_CIELI[cieloDiCasa()] || CAT_CIELI[CAT_CIELO_PREDEFINITO];

  // Di giorno e al crepuscolo restano solo le più luminose, e il conto lo
  // fa già `skyVelo()` sull'opacità: qui si taglia più in basso per non
  // spendere tempo a disegnare cinquemila stelle invisibili.
  const luce = typeof skyVelo === 'function' ? skyVelo() : 1;
  if (luce < 0.02) return -99;
  const scalino = luce < 0.35 ? (1 - luce / 0.35) * 4 : 0;

  return cielo.magLimite + catGuadagnoZoom() - scalino;
}

// Fin dove si arriva a vedere, adesso, su questa mappa.
//
// Il limite si ferma dove finisce il catalogo, e questa riga esiste per una
// segnalazione precisa: «ogni tanto, se cambio il campo, spariscono tutte le
// stelle». Sparivano davvero, e ingrandendo. Il guadagno dello zoom vale
// fino a tre magnitudini, quindi da un cielo di periferia il limite saliva a
// 8,6 — ma la stella più debole che questo catalogo conosce è la 7,0, e
// stelle fra la settima e l'ottava e sei non ne esistono qui. Chiederle non
// ne faceva comparire nessuna: faceva solo credere al disegno di avere tre
// magnitudini di margine (e quindi di disegnare stelle "molto sopra la
// soglia", cioè piccole e anonime) mentre lo schermo si svuotava per
// geometria — sotto i due gradi di campo un ritaglio di cielo contiene in
// media mezza stella più luminosa della settima, e quasi sempre nessuna.
//
// Tosarlo qui non fa comparire le stelle che non abbiamo — quelle nessuno
// può inventarle — ma rimette d'accordo il disegno con i dati: da lì in poi
// `catOltreIlCatalogo()` dice di quanto si è andati oltre, e chi disegna se
// ne serve per **ingrandire quello che resta** invece di rimpicciolirlo.
function catMagnitudineLimite() {
  const voluta = catMagnitudineVoluta();
  if (voluta < -50) return voluta;                 // giorno pieno: niente stelle
  return Math.min(voluta, catProfonditaCatalogo());
}

// Di quante magnitudini lo zoom ha superato il catalogo. Zero a campo largo,
// dove le stelle da mostrare ci sono ancora tutte; cresce da lì in poi, ed è
// la misura di quanto l'oculare sta ingrandendo un cielo che non ha più
// niente di nuovo da tirare fuori.
function catOltreIlCatalogo() {
  const voluta = catMagnitudineVoluta();
  if (voluta < -50) return 0;
  return Math.max(0, voluta - catProfonditaCatalogo());
}

// Per gli oggetti estesi il limite è più basso: la magnitudine totale di
// una galassia larga mezzo grado non dice quasi niente di quanto sia
// facile vederla, e disegnarne cento invisibili non aiuta nessuno.
//
// Qui si parte dalla magnitudine **voluta** e non da quella tosata: la
// settima magnitudine è dove finisce il catalogo delle *stelle*, e il cielo
// profondo è un altro catalogo, con un altro fondo. Legandolo a quello
// tosato, ingrandendo al massimo sparivano gli oggetti fra la 10,5 e la 11 —
// cioè si sarebbe curato «ingrandisco e spariscono le stelle» facendo
// sparire le nebuline, che è lo stesso difetto spostato di là.
function catLimiteProfondo() {
  const voluta = catMagnitudineVoluta();
  if (voluta < -50) return voluta;
  return Math.min(11, voluta + 3.5);
}

// Con che strumento si vede questo oggetto, da QUESTO cielo.
//
// Il conto è di contrasto, non di luminosità: un oggetto esteso si vede
// se la sua brillanza superficiale non è troppo più debole di quella del
// fondo cielo. Un binocolo non rende più brillante niente — la
// brillanza superficiale non si può aumentare, è una legge dell'ottica —
// ma ingrandisce, e un oggetto che occupa più retina si stacca meglio dal
// rumore: valgono grosso modo due magnitudini e mezzo di guadagno
// apparente. Un telescopio raccoglie più luce e ne vale cinque.
function profondoStrumento(o, bortle) {
  const cielo = CAT_CIELI[bortle || cieloDiCasa()] || CAT_CIELI[CAT_CIELO_PREDEFINITO];
  const brillanza = typeof o.brillanza === 'number' ? o.brillanza : o.mag + 5;
  const largo = o.assePrimi || 5;

  // Piccolo e debole nel binocolo c'è, ma resta un puntino uguale alle
  // stelle intorno: non lo si riconosce. M57 è il caso da manuale —
  // brillante quanto si vuole, ma largo un primo.
  const nonSiRiconosce = largo < 3 && o.mag > 8;

  const staccaDi = cielo.fondo - brillanza;      // positivo = più brillante del cielo

  if (o.mag <= cielo.magLimite && staccaDi > -1.0 && !nonSiRiconosce) return 'occhio';
  if (o.mag <= cielo.magLimite + 4 && staccaDi > -2.5 && !nonSiRiconosce) return 'binocolo';
  return 'telescopio';
}


// =====================================================================
// 6. DISEGNO DELLE STELLE
//
//     Cinquemila arc() con altrettanti fill() sono cinquemila cambi di
//     stato del contesto, e il ciclo del planetario non ce la fa. Il
//     trucco è che a occhio le stelle deboli sono tutte uguali: si
//     raccolgono in poche famiglie di colore, si accumulano in un
//     tracciato solo e si riempiono in un colpo. Le luminose — sono
//     meno di cento — se le meritano, il trattamento singolo.
// =====================================================================

// Sette famiglie di colore. Più di così l'occhio non le distingue, e ogni
// famiglia in più è un fill() in più per fotogramma.
const CAT_FAMIGLIE_COLORE = [
  'rgb(170,190,255)', 'rgb(205,218,255)', 'rgb(235,240,255)',
  'rgb(255,250,245)', 'rgb(255,235,205)', 'rgb(255,205,155)',
  'rgb(255,175,120)'
];

function catFamigliaDi(bv) {
  const k = Math.round((bv + 0.4) / 2.4 * (CAT_FAMIGLIE_COLORE.length - 1));
  return Math.max(0, Math.min(CAT_FAMIGLIE_COLORE.length - 1, k));
}

// Quanto grande si disegna una stella di magnitudine m. Non è la sua
// dimensione vera (una stella è sempre un punto, anche nel più grande
// telescopio del mondo): è quanta luce arriva, che l'occhio legge come
// un disco più grosso. La radice tiene le più luminose dal diventare
// palle da biliardo.
//
// `oltre` è di quanto lo zoom ha superato il catalogo (`catOltreIlCatalogo`)
// e serve a una cosa sola, ma è la cosa che l'utente ha segnalato: quando il
// campo si stringe oltre la settima magnitudine non compaiono stelle nuove,
// e quelle che restano devono diventare più grosse — che è quello che fa un
// oculare, e l'unico modo onesto di dire «ti sei avvicinato» a un cielo che
// non ha più niente da tirare fuori. Senza di lui, tosare il limite alla
// profondità vera del catalogo avrebbe *rimpicciolito* le poche superstiti
// proprio nel momento in cui restano sole — la cura avrebbe peggiorato
// esattamente il sintomo che doveva curare. Sommato così, `limite + oltre` è
// di nuovo la magnitudine che lo zoom aveva chiesto: le stelle restano
// grosse come prima, e a cambiare è solo quante se ne cercano.
//
// L'avanzo va sommato **prima** del confronto con lo zero, e non è un
// dettaglio: le magnitudini del catalogo sono arrotondate al decimo, quindi
// di stelle esattamente alla 7,00 — cioè esattamente sul limite tosato — ce
// ne sono a centinaia. Contandolo dopo, quelle avrebbero raggio zero e
// sparirebbero: la tosatura si sarebbe mangiata proprio l'ultima riga del
// catalogo, che è la più affollata di tutte.
function catRaggioStella(m, limite, oltre = 0) {
  const sopra = limite - m + oltre;               // quanto è sopra la soglia
  if (sopra <= 0) return 0;
  return Math.min(4.2, 0.55 + Math.sqrt(sopra) * 0.62);
}

// Un cielo che si svuota ingrandendo sembra un guasto, e per chi l'ha
// segnalato lo era. Non lo è: è dove finisce il catalogo. Lo si dice una
// volta per sessione, come per il tremolio della mano — è il tipo di cosa
// che va spiegata al momento in cui capita, non nascosta in una scheda.
let catDettoDelCatalogo = false;

function catDilloCheIlCatalogoFinisce() {
  if (catDettoDelCatalogo || typeof skyAvviso !== 'function') return;
  catDettoDelCatalogo = true;
  skyAvviso('catalogo-finito',
    `A questo ingrandimento il cielo si dirada davvero: il catalogo arriva alla ` +
    `magnitudine ${catProfonditaCatalogo().toFixed(1).replace('.', ',')}, cioè le stelle che si ` +
    `vedono a occhio nudo da un cielo buio. Quelle più deboli le mostra un telescopio vero, ` +
    `non questa mappa.`, 9000);
}

function catDisegnaStelle(ctx, base, focale) {
  if (!catPronto() || !sky.mostraStelle) return;

  const velo = typeof skyVelo === 'function' ? skyVelo() : 1;
  if (velo < 0.02) return;

  const limite = catMagnitudineLimite();
  if (limite < -50) return;

  // Se il limite è sceso sotto il primo livello, è il momento di chiedere
  // le stelle deboli. Non blocca niente: arrivano quando arrivano.
  catServeSecondoLivello();

  // Di quanto l'ingrandimento ha superato la profondità del catalogo, e
  // quindi da che punto in poi il cielo si dirada per forza. Da qui escono
  // le due risposte a «ingrandisco e spariscono tutte le stelle»: quelle
  // che restano si disegnano più grosse, e sotto al campo di un oculare si
  // disegnano tutte a una a una, con l'alone e il nome.
  const oltre = catOltreIlCatalogo();
  const oculare = sky.fov <= CAT_FOV_OCULARE;
  const magSingole = oculare ? limite : CAT_MAG_LUMINOSE;
  if (oltre > 0 && oculare) catDilloCheIlCatalogoFinisce();

  const n = cat.quante;
  const ora = cat.versoriOra;
  const mag = cat.magnitudini;
  const fam = cat.famiglie;
  const L = sky.larghezza, A = sky.altezza;
  const cx = L / 2, cy = A / 2;

  // Un tracciato per famiglia di colore, riempito una volta sola alla fine
  const tracciati = CAT_FAMIGLIE_COLORE.map(() => new Path2D());
  const usato = new Array(CAT_FAMIGLIE_COLORE.length).fill(false);
  const luminose = [];

  const fr = base.f, br = base.r, bu = base.u;

  for (let k = 0; k < n; k++) {
    const m = mag[k];
    if (m > limite) continue;                     // include il 99 delle saltate

    const x = ora[k * 3], y = ora[k * 3 + 1], z = ora[k * 3 + 2];

    // Sotto l'orizzonte non si disegna, e non è una scelta di gusto: è
    // dove sta la terra. Il terreno viene dipinto subito dopo e le
    // coprirebbe comunque, quindi proiettarle sarebbe lavoro buttato —
    // metà catalogo, a ogni fotogramma. Con la fotocamera accesa il
    // terreno non c'è, ma dietro c'è quello vero: peggio ancora.
    //
    // Il tasto «Sotto l'orizzonte» non vale qui: quello serve agli astri
    // che hanno un nome — uno vuole sapere dov'è Saturno anche mentre è
    // tramontato — e continua a funzionare per loro, che si disegnano
    // dopo il terreno. Duemila stelle anonime sepolte nella collina non
    // dicono niente a nessuno.
    if (z < 0) continue;

    // La proiezione, srotolata: skyProietta() farebbe la stessa cosa ma
    // costruendo un oggetto per stella — cinquemila oggetti per
    // fotogramma che il raccoglitore di memoria deve poi buttare via.
    // Srotolata sì, ma **la stessa**: è stereografica come quella di
    // app.js, cioè si divide per `(1+d)/2` e non per `d`. Se le due
    // formule divergono le stelle si staccano dalle figure e dai pianeti,
    // e il cielo non torna più.
    const d = x * fr[0] + y * fr[1] + z * fr[2];
    if (d <= SKY_D_MIN) continue;
    const den = (1 + d) * 0.5;
    const px = cx + focale * ((x * br[0] + y * br[1] + z * br[2]) / den);
    if (px < -4 || px > L + 4) continue;
    const py = cy - focale * ((x * bu[0] + y * bu[1] + z * bu[2]) / den);
    if (py < -4 || py > A + 4) continue;

    const r = catRaggioStella(m, limite, oltre);
    if (r <= 0) continue;

    if (m <= magSingole) { luminose.push(k, px, py, r, z); continue; }

    const f = fam[k];
    const t = tracciati[f];
    // Sotto il pixel, un rettangolo costa la metà di un cerchio e sullo
    // schermo è la stessa identica cosa.
    if (r < 0.9) t.rect(px - r, py - r, r * 2, r * 2);
    else { t.moveTo(px + r, py); t.arc(px, py, r, 0, Math.PI * 2); }
    usato[f] = true;
  }

  ctx.save();
  for (let f = 0; f < tracciati.length; f++) {
    if (!usato[f]) continue;
    ctx.globalAlpha = velo * 0.92;
    ctx.fillStyle = CAT_FAMIGLIE_COLORE[f];
    ctx.fill(tracciati[f]);
  }

  // Le luminose, una per una: alone morbido e nome accanto. Sono poche
  // decine, e sono quelle che uno cerca davvero.
  for (let i = 0; i < luminose.length; i += 5) {
    const k = luminose[i], px = luminose[i + 1], py = luminose[i + 2];
    const r = luminose[i + 3], z = luminose[i + 4];

    // Qui sotto l'orizzonte non ci arriva niente: il ciclo di sopra le ha
    // già scartate. Resta solo lo smorzamento dell'aria bassa, che è
    // vero — una stella a due gradi sull'orizzonte attraversa quaranta
    // volte più atmosfera di una allo zenit, e si vede.
    const alt = Math.asin(Math.max(-1, Math.min(1, z))) * 180 / Math.PI;
    const opacita = (typeof skyEstinzione === 'function' ? skyEstinzione(alt) : 1) * velo;
    if (opacita < 0.03) continue;

    const colore = cat.colori.get(k) || CAT_FAMIGLIE_COLORE[cat.famiglie[k]];
    ctx.globalAlpha = opacita * 0.28;
    ctx.fillStyle = colore;
    ctx.beginPath();
    ctx.arc(px, py, r * 3.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = opacita;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();

    // A campo largo si nominano solo le primissime: ottantotto figure di
    // stelle con l'etichetta attaccata sarebbero un elenco, non un cielo.
    // Dentro all'oculare invece di stelle sullo schermo ce ne sono cinque, e
    // sapere come si chiama quella che si sta guardando è **il** motivo per
    // cui uno ci si è avvicinato.
    const nome = cat.nomiPerIndice.get(k);
    if (sky.mostraNomi && nome && (oculare || cat.magnitudini[k] <= 1.9)) {
      ctx.globalAlpha = opacita * 0.8;
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(nome, px + r + 6, py);
    }
  }
  ctx.restore();
}


// =====================================================================
// 7. DISEGNO DELLE FIGURE
//
//     Un filo sottile, non un disegno tecnico. Le linee che passano sotto
//     l'orizzonte restano un'ombra: la figura si intuisce, ma non sembra
//     disegnata sul prato davanti a casa. È la stessa regola che aveva
//     app.js con le sue ventitré figure — funzionava, e resta.
// =====================================================================

function catDisegnaFigure(ctx, base, focale) {
  if (!catPronto() || !sky.mostraCostellazioni) return;

  const velo = typeof skyVelo === 'function' ? skyVelo() : 1;
  if (velo < 0.06) return;                        // in pieno giorno, niente figure

  // A campo largo si vede tutto il cielo e ottantotto figure diventano una
  // ragnatela. Ingrandendo si entra nel dettaglio e allora ha senso
  // mostrare anche le minori: il rango 1 sono le venti che tutti sanno
  // additare, il 3 quelle che non addita nessuno.
  const rangoMax = sky.fov > 90 ? 1 : sky.fov > 45 ? 2 : 3;

  const L = sky.larghezza, A = sky.altezza;
  const cx = L / 2, cy = A / 2;
  const fr = base.f, br = base.r, bu = base.u;

  // Un tracciato solo: quello che sta sotto l'orizzonte non si disegna
  // affatto. Prima le linee interrate si tiravano come un'ombra, perché
  // «la figura si intuisce» — ma quella era una scelta di quando le
  // figure portavano con sé le proprie stelle, e le stelle facevano la
  // stessa fine. Adesso le stelle vengono dal catalogo e sotto
  // l'orizzonte non ci vanno: lasciare le linee vorrebbe dire disegnare
  // il Grande Carro sul prato senza nessuna stella dentro.
  const sopra = new Path2D();
  let cSopra = false;
  const etichette = [];

  cat.figure.forEach(fig => {
    if (fig.rango > rangoMax) return;

    fig.spezzate.forEach(s => {
      let precedente = null;
      for (let k = 0; k < s.quanti; k++) {
        const x = s.ora[k * 3], y = s.ora[k * 3 + 1], z = s.ora[k * 3 + 2];
        const d = x * fr[0] + y * fr[1] + z * fr[2];
        // Un punto sotto l'orizzonte interrompe la spezzata: il tratto
        // che ci arriva e quello che ne riparte non si disegnano, e la
        // figura esce da terra dove esce davvero.
        const den = (1 + d) * 0.5;
        const punto = (d > SKY_D_MIN && z >= 0)
          ? { px: cx + focale * ((x * br[0] + y * br[1] + z * br[2]) / den),
              py: cy - focale * ((x * bu[0] + y * bu[1] + z * bu[2]) / den) }
          : null;

        if (precedente && punto) {
          // Un segmento che scavalca il bordo dello schermo in
          // proiezione prospettica può schizzare a coordinate assurde:
          // se è più lungo di due schermi, non è una linea, è un errore.
          const dx = punto.px - precedente.px, dy = punto.py - precedente.py;
          if (dx * dx + dy * dy < (L + A) * (L + A)) {
            sopra.moveTo(precedente.px, precedente.py);
            sopra.lineTo(punto.px, punto.py);
            cSopra = true;
          }
        }
        precedente = punto;
      }
    });

    if (!sky.mostraNomi) return;
    const x = fig.centroOra[0], y = fig.centroOra[1], z = fig.centroOra[2];
    const d = x * fr[0] + y * fr[1] + z * fr[2];
    // Il nome sta nel baricentro della figura: se quello è sotto
    // l'orizzonte, la figura è per la gran parte tramontata e il nome
    // finirebbe sul terreno da solo.
    if (d <= SKY_D_MIN || z < 0) return;
    const den = (1 + d) * 0.5;
    const px = cx + focale * ((x * br[0] + y * br[1] + z * br[2]) / den);
    const py = cy - focale * ((x * bu[0] + y * bu[1] + z * bu[2]) / den);
    if (px < 0 || px > L || py < 0 || py > A) return;
    etichette.push({ nome: fig.nome, px, py });
  });

  ctx.save();
  ctx.lineWidth = 1.1;
  if (cSopra) {
    ctx.strokeStyle = `rgba(120, 178, 255, ${0.4 * velo})`;
    ctx.stroke(sopra);
  }

  if (etichette.length) {
    ctx.globalAlpha = 0.5 * velo;
    ctx.fillStyle = '#93c5fd';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    etichette.forEach(e => ctx.fillText(e.nome, e.px, e.py));
  }
  ctx.restore();
}


// =====================================================================
// 8. TROVARE UNA STELLA O UN OGGETTO PROFONDO
//     L'elenco degli astri del pannello, la ricerca per nome e il tocco
//     sulla mappa passano tutti di qui.
// =====================================================================

// Le voci da aggiungere all'elenco degli astri di app.js: i
// centoquarantadue oggetti profondi e le stelle che hanno un nome
// proprio. Le ottocento con la sola lettera di Bayer no: «ζ Lyr»
// nell'elenco non aiuta nessuno, e allungherebbe la lista di dieci volte.
function catVociElenco() {
  if (!catPronto()) return [];

  const voci = cat.profondo.map(o => ({
    id: 'dso:' + o.nome,
    nome: o.nome,
    disegno: 'nebulosa',
    colore: (typeof SKY_COLORI_PROFONDO !== 'undefined' && SKY_COLORI_PROFONDO[o.tipo]) || '#c4b5fd',
    tipo: 'profondo',
    tipoProfondo: o.tipo
  }));

  cat.nomiPerIndice.forEach((nome, indice) => {
    if (cat.magnitudini[indice] > 3.2) return;    // solo quelle che si additano
    voci.push({
      id: 'cat:' + indice,
      nome,
      disegno: 'stella',
      colore: cat.colori.get(indice) || '#e2e8f0',
      tipo: 'stella',
      mag: cat.magnitudini[indice],
      ra: CATALOGO_STELLE[indice * 4],
      dec: CATALOGO_STELLE[indice * 4 + 1],
      indiceCatalogo: indice
    });
  });

  return voci;
}

// L'oggetto profondo che si chiama così (l'identificativo è il nome per
// esteso, che nel catalogo è unico)
function catProfondoDiNome(nome) {
  if (!catPronto()) return null;
  return cat.profondo.find(o => o.nome === nome) || null;
}

// Azimut e altezza di una stella del catalogo, per la freccia guida e per
// l'inseguimento
function catPosizioneStella(indice) {
  if (!catPronto() || indice < 0 || indice >= cat.quante) return null;
  const v = cat.versoriOra;
  const est = v[indice * 3], nord = v[indice * 3 + 1], alto = v[indice * 3 + 2];
  if (!est && !nord && !alto) return null;         // posizioni non ancora calcolate
  return {
    alt: Math.asin(Math.max(-1, Math.min(1, alto))) * 180 / Math.PI,
    az: (Math.atan2(est, nord) * 180 / Math.PI + 360) % 360
  };
}

// =====================================================================
// 8-bis. TOCCARE UNA STELLA
//
//     Cinquemila puntini che non si possono toccare sono uno sfondo, non
//     un cielo. Il punto di un planetario è poter chiedere «questa qui,
//     cos'è?» — ed è la domanda che uno si fa proprio davanti a quelle
//     che non conosce, non davanti a Vega.
//
//     Del resto delle otto stelle di riferimento l'app sapeva già dire
//     tutto (spettro, raggio, distanza), perché quelle otto erano scritte
//     a mano. Per le altre cinquemila i dati sono due: la magnitudine e
//     l'indice di colore. Sembra poco, e invece da lì si tira fuori la
//     cosa più interessante che una stella abbia — quanto è calda.
// =====================================================================

// Quale stella del catalogo sta sotto quel punto dello schermo.
//
// Si guardano solo quelle davvero disegnate: sopra l'orizzonte e dentro
// la magnitudine limite di questo cielo. Toccare un puntino che non si
// vede sarebbe peggio che non toccare niente.
function catStellaNelPunto(px, py, base, focale) {
  if (!catPronto() || !sky.mostraStelle) return null;

  const limite = catMagnitudineLimite();
  if (limite < -50) return null;

  const ora = cat.versoriOra, mag = cat.magnitudini;
  const L = sky.larghezza, A = sky.altezza;
  const cx = L / 2, cy = A / 2;
  const fr = base.f, br = base.r, bu = base.u;

  let migliore = null;
  for (let k = 0; k < cat.quante; k++) {
    const m = mag[k];
    if (m > limite) continue;

    const x = ora[k * 3], y = ora[k * 3 + 1], z = ora[k * 3 + 2];
    if (z < 0) continue;

    const d = x * fr[0] + y * fr[1] + z * fr[2];
    if (d <= SKY_D_MIN) continue;
    const den = (1 + d) * 0.5;
    const sx = cx + focale * ((x * br[0] + y * br[1] + z * br[2]) / den);
    const sy = cy - focale * ((x * bu[0] + y * bu[1] + z * bu[2]) / den);

    // Il bersaglio è largo quanto la stella è disegnata, più un margine
    // per il dito: una di prima grandezza si prende facile, una al limite
    // della vista bisogna centrarla. È lo stesso criterio con cui l'occhio
    // decide di averla "colpita".
    const soglia = Math.max(10, catRaggioStella(m, limite, catOltreIlCatalogo()) * 2 + 9);
    const dist = Math.hypot(sx - px, sy - py);
    if (dist > soglia) continue;

    // A parità di vicinanza vince la più luminosa: è quella che uno
    // stava guardando.
    const punteggio = dist - (limite - m) * 1.5;
    if (!migliore || punteggio < migliore.punteggio) {
      migliore = { indice: k, punteggio, dist };
    }
  }

  return migliore ? catSchedaStella(migliore.indice) : null;
}

// --- Il colore, e cosa vuol dire ---
//
// L'indice B−V è la differenza fra quanto una stella è luminosa nel blu e
// quanto lo è nel giallo-verde. Non è un dato di gusto: è una misura, e
// da quella misura si ricava la temperatura della superficie, perché un
// corpo caldo emette più nel blu e uno freddo più nel rosso — la stessa
// cosa che fa un ferro nella forgia, che passa dal rosso all'azzurro man
// mano che scalda.
//
// La formula è quella di Ballesteros (2012), che approssima la relazione
// vera entro un centinaio di gradi nell'intervallo che ci interessa. Si
// controlla facilmente: col B−V del Sole (0,65) dà 5.778 K, e il Sole ne
// ha 5.772.
function catTemperaturaDaBV(bv) {
  return 4600 * (1 / (0.92 * bv + 1.70) + 1 / (0.92 * bv + 0.62));
}

// La classe spettrale, dedotta dal colore.
//
// È una stima, e la scheda lo dice: la classe vera si legge nelle righe
// dello spettro, non nel colore, e le due cose combaciano bene per le
// stelle di sequenza principale ma meno per le giganti. Enif, per dirne
// una, ha un B−V da classe M ed è una K2 supergigante: a parità di
// colore una gigante è più fredda di quanto la scala delle nane dica.
//
// Il colore e la temperatura restano comunque veri — quelli si misurano.
// È l'etichetta che è approssimata, ed è per questo che nella scheda
// viene dopo, e con un "circa" attaccato.
const CAT_CLASSI = [
  { fino: -0.30, classe: 'O', colore: 'azzurra' },
  { fino: -0.02, classe: 'B', colore: 'azzurra' },
  { fino:  0.30, classe: 'A', colore: 'bianco-azzurra' },
  { fino:  0.58, classe: 'F', colore: 'bianca' },
  { fino:  0.81, classe: 'G', colore: 'gialla' },
  { fino:  1.40, classe: 'K', colore: 'arancione' },
  { fino:  99,   classe: 'M', colore: 'rossa' }
];

function catClasseDaBV(bv) {
  return CAT_CLASSI.find(c => bv <= c.fino) || CAT_CLASSI[CAT_CLASSI.length - 1];
}

// La scheda di una stella del catalogo, nella forma che skyRigheScheda()
// sa già leggere.
function catSchedaStella(indice) {
  if (!catPronto() || indice < 0 || indice >= cat.quante) return null;

  // Le otto stelle di riferimento sono state messe a magnitudine 99 da
  // catIndiciDaSaltare(): di quelle app.js ha una scheda molto più ricca
  // (spettro vero, raggio, distanza), ed è quella che si deve aprire.
  // Qui uscirebbe una "Stella di magnitudine 0,0" senza nome — che per
  // Vega sarebbe ridicolo. Non ci si arriva toccando la mappa, perché il
  // filtro sulla magnitudine le esclude comunque; ma chi chiamasse questa
  // funzione a mano si troverebbe con quella scheda in mano, e meglio un
  // niente esplicito di una risposta sbagliata.
  if (cat.magnitudini[indice] > 90) return null;

  // I dati grezzi stanno nel livello giusto: sotto CATALOGO_STELLE_QUANTE
  // nel primo file, sopra nel secondo.
  const primo = indice < CATALOGO_STELLE_QUANTE;
  const dentro = primo ? CATALOGO_STELLE : CATALOGO_STELLE_DEBOLI;
  const k = (primo ? indice : indice - CATALOGO_STELLE_QUANTE) * 4;

  const ra = dentro[k], dec = dentro[k + 1];
  const magnitudine = dentro[k + 2], bv = dentro[k + 3];

  const c = catClasseDaBV(bv);
  const T = catTemperaturaDaBV(bv);
  const nome = cat.nomiPerIndice.get(indice);
  // Questo e' l'identificativo stabile usato dal planetario (`cat:<indice>`),
  // scritto in una forma leggibile anche nella scheda. Non pretende di essere
  // una sigla Hipparcos: serve a riconoscere e ritrovare senza ambiguita' una
  // delle migliaia di stelle che non hanno un nome proprio o una lettera di
  // Bayer nel catalogo compatto dell'app.
  const codiceCatalogo = `CAT ${indice}`;

  // Senza nome si conserva la descrizione utile (luminosita' e
  // costellazione), ma le si affianca il codice: due stelle della stessa
  // magnitudine nella stessa figura non devono piu' sembrare la stessa.
  const costellazione = catCostellazioneDi(ra, dec);
  const comeSiChiama = nome ||
    `Stella ${codiceCatalogo} di magnitudine ${magnitudine.toFixed(1).replace('.', ',')}` +
    (costellazione ? ` — ${costellazione}` : '');

  return {
    nome: comeSiChiama,
    disegno: 'stella',
    tipo: 'stella',
    senzaNome: !nome,
    codiceCatalogo,
    ra, dec, mag: magnitudine, bv,
    indiceCatalogo: indice,
    colore: cat.colori.get(indice) || CAT_FAMIGLIE_COLORE[cat.famiglie[indice]],
    // Prima il colore, che è misurato; poi la classe, che è dedotta
    classe: astroI18n.t('stella.classe', { colore: astroI18n.t('stella.colore.' + c.classe) }) +
      ` <span class="text-slate-500">(${astroI18n.t('stella.classeDedotta', { classe: c.classe })})</span>`,
    temperatura: T,
    nota: catNotaStella(c, T, magnitudine)
  };
}

// Una riga che spieghi cosa si sta guardando. Il paragone è sempre col
// Sole, perché è l'unica stella di cui tutti hanno un'idea.
function catNotaStella(c, T, mag) {
  const gradi = Math.round(T / 100) * 100;
  const controIlSole = astroI18n.t(T > 6400 ? 'stella.piuCalda'
    : T < 5300 ? 'stella.piuFredda' : 'stella.quasiComeIlSole');

  // `toLocaleString('it')` era il separatore dei migliaia inchiodato
  // all'italiano: 5.800 gradi qui e 5,800 in inglese.
  let testo = astroI18n.t('stella.notaColore', {
    colore: astroI18n.t('stella.colore.' + c.classe),
    gradi: astroI18n.numero(gradi),
    confronto: controIlSole
  });

  // Le rosse molto fredde sono quasi sempre giganti: una nana rossa a
  // quella temperatura sarebbe troppo debole per vedersi a occhio nudo.
  if (c.classe === 'M' && mag < 6) testo += ' ' + astroI18n.t('stella.notaGigante');
  else if ((c.classe === 'O' || c.classe === 'B') && mag < 4) testo += ' ' + astroI18n.t('stella.notaAzzurra');
  return testo;
}

// In che costellazione cade un punto del cielo. Astronomy Engine conosce i
// confini ufficiali del 1875, quelli veri: la nostra tabella ha solo le
// figure, che sono un'altra cosa.
function catCostellazioneDi(raOre, dec) {
  try {
    const c = Astronomy.Constellation(raOre, dec);
    const nostra = catPronto() && cat.figure.find(f => f.sigla === c.symbol);
    return nostra ? nostra.nome : c.name;
  } catch (e) {
    return null;
  }
}
