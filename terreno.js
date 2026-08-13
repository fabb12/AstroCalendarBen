// =====================================================================
// IL TERRENO VERO
//
// L'orizzonte del planetario era inventato. Un profilo bello — onde
// lunghe per le colline, macchie strette per gli alberi — ma sempre lo
// stesso: identico a Milano, a Bolzano e in mezzo al mare. E l'orizzonte
// è esattamente la cosa che *non* è uguale dappertutto: è la prima cosa
// che uno riconosce guardando fuori, ed è quella che decide davvero se
// stanotte quel pianeta basso lo vedrai o no.
//
// Qui il profilo si prende dalla terra vera. Attorno all'osservatore si
// campiona la quota del suolo lungo centoventi direzioni e diciotto
// distanze, dai centocinquanta metri ai sessanta chilometri, e per ogni
// campione si calcola sotto che angolo lo si vede. Il massimo lungo una
// direzione è l'orizzonte in quella direzione: la cresta che nasconde
// tutto quello che le sta dietro.
//
// Ma il massimo **fino a una certa distanza** dice di più: dice quante
// dorsali ci sono, e quale sta davanti a quale. Diciotto distanze sono
// diciotto sagome incastrate una nell'altra, ed è da lì che il planetario
// disegna la conformazione del terreno invece della sua sola sagoma — la
// veduta a piani delle carte panoramiche, quella di PeakFinder.
//
// I dati sono quelli di Open-Meteo (Copernicus DEM, novanta metri di
// passo), lo stesso servizio del meteo: niente chiave, niente account,
// e già escluso dalla cache del service worker.
//
// Tre cose che non fa, e che è giusto sapere:
//
//   - non conosce i palazzi. Il DEM è il **suolo**: la collina c'è, il
//     condominio di fronte no. Per quello resta il profilo a sedici
//     settori di `pianifica.js`, che l'utente riempie a mano, e i due si
//     sommano prendendo il più alto dei due.
//   - non conosce gli alberi. La fila di pioppi in fondo al campo la
//     mette ancora la finzione di `app.js`, come dettaglio sopra alla
//     forma vera del terreno.
//   - novanta metri di passo e centoventi direzioni non fanno un
//     panorama fotografico. Fanno la **conformazione**: dove il terreno
//     sale, dove sprofonda la valle, da che parte c'è la montagna. Che è
//     poi la domanda a cui serve rispondere.
//
// Ordine di caricamento: dopo app.js (usa `luogoCorrente`, `sky`,
// `skyChiediRidisegno`), prima o dopo pianifica.js indifferentemente.
// =====================================================================


// =====================================================================
// 1. DOVE SI GUARDA E QUANTO LONTANO
// =====================================================================

const CHIAVE_TERRENO = 'astrocalendario_terreno';

// Centoventi direzioni: una ogni 3°.
//
// Erano quarantotto, cioè una ogni 7°30′, e per rispondere «quanto è alto
// l'orizzonte da quella parte» bastavano: la cresta è un numero solo, e fra
// un settore e l'altro si interpola. Ma da quando il planetario disegna la
// **forma** del terreno e non più la sua sola sagoma (§ «I gradini della
// distanza» in `app.js`), quei settori si vedono per quello che sono: con un
// campo di sessanta gradi ne finivano otto sullo schermo, e otto punti non
// fanno un panorama, fanno una spezzata. A tre gradi ne finiscono venti, e a
// quel punto il crinale è una linea.
const TERRENO_DIREZIONI = 120;
const TERRENO_PASSO_AZ = 360 / TERRENO_DIREZIONI;

// Le distanze, in chilometri. Fitte da vicino e rade da lontano, perché
// da vicino un metro di dislivello conta gradi e a cinquanta chilometri
// non conta più niente. Oltre i sessanta chilometri la curvatura ha già
// nascosto tutto quello che non è una montagna vera — e le montagne vere
// a quella distanza le prende il campione dei sessanta.
//
// Diciotto passi invece di dodici, e non per precisione: sono i **piani**
// della veduta. Ogni distanza è una dorsale che può spuntare da dietro a
// quella prima di lei, e il numero di dorsali che si contano guardando fuori
// è tutta la profondità che un panorama possiede. Con dodici passi le Prealpi
// venivano fuori in tre gradini; con diciotto se ne contano sei o sette, che
// è quello che si vede davvero.
//
// I due valori 4 e 16 ci sono di proposito: sono i tagli di `SKY_STRATI_KM`
// (app.js), che separano il primo piano dal piano intermedio e dallo sfondo
// per le **etichette** delle vette. Cadendo su due campioni della griglia,
// quelle due risposte sono quote misurate e non interpolazioni.
const TERRENO_DISTANZE = [
  0.15, 0.3, 0.5, 0.8, 1.2, 1.8, 2.6, 4, 5.5, 7.5, 10, 13, 16, 20, 26, 34, 45, 60
];

// Open-Meteo accetta cento coordinate per richiesta. Novanta sono cinque
// direzioni intere per volta, il che rende le richieste tutte uguali.
const TERRENO_PER_RICHIESTA = 90;

// Quante richieste per volta. Ventiquattro in fila indiana sono venti
// secondi di attesa con lo schermo che dice «sto misurando»; tutte insieme
// sono il modo più veloce di farsi rispondere «troppe richieste». Quattro
// alla volta è la via di mezzo che si è dimostrata stabile: sei giri, e il
// terreno c'è prima che uno abbia finito di guardarsi attorno.
const TERRENO_RICHIESTE_INSIEME = 4;

// Raggio terrestre e coefficiente di rifrazione standard. La luce che
// rade il terreno si incurva verso il basso seguendo l'aria che si dirada
// con la quota, e questo fa vedere **più lontano** di quanto la geometria
// pura permetterebbe: il trucco di sempre è far finta che la Terra sia
// più grande di quello che è, di circa un settimo.
const TERRENO_RAGGIO_KM = 6371;
const TERRENO_RIFRAZIONE = 0.13;

// L'occhio non sta per terra.
const TERRENO_ALTEZZA_OCCHIO_M = 1.6;

// Oltre questo, non è più un orizzonte: è una parete, e quasi sempre è un
// dato sbagliato.
const TERRENO_ALT_MAX = 60;

// Quanto ci si può spostare prima che il profilo non valga più. Due
// chilometri: dentro un paese l'orizzonte lontano è lo stesso, e non ha
// senso riscaricarlo perché ci si è spostati di un isolato.
const TERRENO_RAGGIO_VALIDO_KM = 2;

// Quanti posti si tengono da parte. Uno solo non basta più da quando il
// planetario può andare a guardare il cielo di un'altra città: si va a
// vedere Bolzano, si torna a casa, e casa andrebbe riscaricata da capo —
// sei richieste per delle colline che non si sono mosse. Quattro coprono
// casa, il posto delle osservazioni e le due città guardate per curiosità.
const TERRENO_POSTI_SALVATI = 4;

// Quanto sotto si scende prima di dire «qui è acqua». I modelli del suolo
// non dicono dov'è il mare: ci mettono uno zero e via. Ma uno zero ripetuto
// per dieci campioni in fila, a dieci, venti, quaranta chilometri, non è una
// pianura: le pianure vere non sono piatte al centimetro. Mezzo metro di
// tolleranza copre le maree e gli errori del modello senza prendersi la
// pianura padana per l'Adriatico.
const TERRENO_MARE_QUOTA = 0.5;
const TERRENO_MARE_FRAZIONE = 0.75;   // quanta parte dei campioni lontani
const TERRENO_MARE_DA_KM = 1.5;       // sotto questa distanza non conta

// Le soglie fra un paesaggio e l'altro. Sono due misure diverse e servono
// tutt'e due: l'angolo dice quanto quella cosa **copre** (è la domanda
// dell'astronomo), il dislivello dice che cos'**è** (è la domanda di chi
// guarda fuori dalla finestra). Una montagna a cinquanta chilometri copre
// due gradi scarsi ma resta una montagna, e va detto.
const TERRENO_SOGLIA_MONTAGNA_GRADI = 2.0;
const TERRENO_SOGLIA_MONTAGNA_M = 600;
const TERRENO_SOGLIA_COLLINA_GRADI = 0.5;
const TERRENO_SOGLIA_COLLINA_M = 120;

// I quattro paesaggi. L'ordine è quello dei codici salvati: non
// riordinarli, o un profilo salvato ieri racconta un posto diverso.
const TERRENO_TIPI = ['mare', 'pianura', 'collina', 'montagna'];

// Di quanti gradi si sfuma il passaggio da un paesaggio all'altro.
//
// I settori campionati sono larghi 7°30′, e presi così come sono danno
// confini netti: il mare finisce e comincia la montagna dentro un grado,
// con uno spigolo che si vede da lontano ed è l'unica cosa che l'occhio
// guarda. Ma un confine netto sull'orizzonte non esiste — nemmeno la costa
// è netta, perché la costa è dove finisce l'acqua, non dove finisce il
// colore. Nove gradi di sfumatura (poco più di un settore) bastano a far
// sparire lo spigolo senza impastare tutto — e la larghezza conta anche
// per un'altra ragione: la velatura del disegno cambia di un pezzo a ogni
// grado, e il pezzo è tanto più piccolo quanto la campana è larga. A nove
// gradi il salto era del dieci per cento per grado, abbastanza da vedersi
// come una scaletta di bande verticali; a dodici scende sotto l'otto, e a
// quel punto la scaletta sparisce sotto al rumore del gradiente.
const TERRENO_SFUMA_GRADI = 12;
const TERRENO_MARE = 0, TERRENO_PIANURA = 1, TERRENO_COLLINA = 2, TERRENO_MONTAGNA = 3;


// =====================================================================
// 2. LO STATO
// =====================================================================

const terreno = {
  stato: 'niente',        // niente | in-corso | pronto | fallito | spento
  lat: null,
  lon: null,
  quota: null,            // quota del suolo sotto l'osservatore, in metri
  profilo: null,          // Float32Array(361): l'altezza dell'orizzonte, grado per grado
  tipi: null,             // Uint8Array(361): che paesaggio c'è in quella direzione
  miscela: null,          // Float32Array(361×4): gli stessi tipi, ma sfumati fra loro
  // La cresta parziale: per ogni direzione campionata e per ogni distanza,
  // quanto è alto il terreno **fino a lì**. È la stessa cosa del profilo,
  // ma fermata a metà strada — e serve a sapere che cosa nasconde che cosa
  // (§8, `terrenoCrestaDavanti`). Manca ai profili salvati vecchi, e chi la
  // usa deve sapersene fare una ragione.
  fronti: null,           // Float32Array(120×18)
  quando: 0,
  motivo: '',             // perché non c'è, quando non c'è
  avanzamento: 0,         // 0…1 mentre le quote stanno arrivando
  acceso: true
};


// =====================================================================
// 3. GEOMETRIA
// =====================================================================

// Il punto che sta a `km` chilometri in direzione `az` dall'osservatore.
// Formula del cammino diretto sulla sfera: a queste distanze la differenza
// con un ellissoide vero è di qualche metro, cioè niente.
function terrenoPuntoA(lat, lon, az, km) {
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const d = km / TERRENO_RAGGIO_KM;
  const la = lat * D2R, a = az * D2R;
  const sinLa = Math.sin(la), cosLa = Math.cos(la);
  const sinD = Math.sin(d), cosD = Math.cos(d);
  const la2 = Math.asin(sinLa * cosD + cosLa * sinD * Math.cos(a));
  const lo2 = lon * D2R + Math.atan2(Math.sin(a) * sinD * cosLa, cosD - sinLa * Math.sin(la2));
  // La longitudine va riportata fra −180 e 180, se no oltre l'antimeridiano
  // il servizio rifiuta la richiesta
  return { lat: la2 * R2D, lon: (((lo2 * R2D + 540) % 360) - 180) };
}

// Sotto che angolo si vede un punto alto `quota` metri a `km` di distanza,
// stando a `occhio` metri di quota.
//
// Due termini. Il dislivello diviso la distanza — la pendenza, che è
// l'unica cosa che conterebbe su una Terra piatta. E l'abbassamento per
// curvatura, che a dieci chilometri vale già sette metri e a sessanta
// duecentocinquanta: è il motivo per cui il mare finisce, e per cui una
// collina lontana si vede più bassa di quanto sarebbe se il mondo fosse
// un tavolo.
function terrenoAngolo(quota, occhio, km) {
  const s = km * 1000;
  const abbassa = (1 - TERRENO_RIFRAZIONE) * s * s / (2 * TERRENO_RAGGIO_KM * 1000);
  return Math.atan2(quota - occhio - abbassa, s) * 180 / Math.PI;
}


// =====================================================================
// 4. PRENDERE LE QUOTE
// =====================================================================

function terrenoUrl(punti) {
  const lat = punti.map(p => p.lat.toFixed(5)).join(',');
  const lon = punti.map(p => p.lon.toFixed(5)).join(',');
  return `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;
}

async function terrenoQuote(punti) {
  const risposta = await fetch(terrenoUrl(punti));
  if (!risposta.ok) throw new Error('quote non disponibili (' + risposta.status + ')');
  const dati = await risposta.json();
  if (!dati || !Array.isArray(dati.elevation)) throw new Error('risposta senza quote');
  return dati.elevation;
}


// =====================================================================
// 5. COSTRUIRE IL PROFILO
// =====================================================================

// Da quarantotto creste a trecentosessantuno gradi. Si interpola in modo
// circolare — il settore fra l'ultimo e il primo esiste come tutti gli
// altri — e non a spezzata ma con una media pesata sui due vicini, che
// non fa gli spigoli.
function terrenoInterpola(creste) {
  const p = new Float32Array(361);
  const n = creste.length;
  for (let g = 0; g <= 360; g++) {
    const dove = (g % 360) / TERRENO_PASSO_AZ;
    const i = Math.floor(dove) % n;
    const j = (i + 1) % n;
    const t = dove - Math.floor(dove);
    // Interpolazione con la curva a S invece che dritta: le creste sono
    // punti di massimo, e unirle con dei segmenti fa un profilo a
    // capanna che si vede subito per finto
    const s = t * t * (3 - 2 * t);
    p[g] = creste[i] * (1 - s) + creste[j] * s;
  }
  return p;
}

// Che paesaggio c'è in quella direzione. Non è un dato che si scarica: si
// legge nei campioni che abbiamo già in mano, ed è la differenza fra un
// orizzonte «alto 3,4°» e un orizzonte che uno riconosce — la montagna a
// nord, il mare a ponente, la pianura per il resto.
//
// L'ordine dei controlli conta: il mare per primo, perché il mare è
// perfettamente piatto e senza questo controllo finirebbe classificato
// pianura — e la pianura si disegna col prato e con gli alberi.
function terrenoTipoDiDirezione(quote, i, quotaCasa, cresta) {
  const n = TERRENO_DISTANZE.length;
  let qmax = -Infinity, lontani = 0, piatti = 0;
  for (let k = 0; k < n; k++) {
    const q = quote[i * n + k];
    if (typeof q !== 'number') continue;
    if (q > qmax) qmax = q;
    if (TERRENO_DISTANZE[k] >= TERRENO_MARE_DA_KM) {
      lontani++;
      if (q <= TERRENO_MARE_QUOTA) piatti++;
    }
  }
  if (lontani && piatti / lontani >= TERRENO_MARE_FRAZIONE) return TERRENO_MARE;
  if (qmax === -Infinity) return TERRENO_PIANURA;

  const dislivello = qmax - (typeof quotaCasa === 'number' ? quotaCasa : 0);
  if (cresta >= TERRENO_SOGLIA_MONTAGNA_GRADI || dislivello >= TERRENO_SOGLIA_MONTAGNA_M) return TERRENO_MONTAGNA;
  if (cresta >= TERRENO_SOGLIA_COLLINA_GRADI || dislivello >= TERRENO_SOGLIA_COLLINA_M) return TERRENO_COLLINA;
  return TERRENO_PIANURA;
}

// I tipi non si interpolano: fra il mare e la montagna non c'è una via di
// mezzo, c'è la costa. Si prende il settore più vicino, e il confine cade
// a metà strada fra due direzioni campionate. Questa è la risposta secca —
// «lì c'è il mare» — e serve a chi deve decidere qualcosa: per esempio che
// sull'acqua non si disegnano alberi.
function terrenoTipiPerGrado(tipi) {
  const p = new Uint8Array(361);
  const n = tipi.length;
  for (let g = 0; g <= 360; g++) {
    p[g] = tipi[Math.round((g % 360) / TERRENO_PASSO_AZ) % n];
  }
  return p;
}

// La stessa cosa, ma sfumata: per ogni grado, quanta parte di mare, di
// pianura, di collina e di montagna c'è lì attorno. Serve al disegno, che
// una risposta secca non la può usare — dipingere un settore di un colore
// e quello accanto di un altro fa comparire dei bordi netti che non sono
// nel paesaggio, sono nel modo in cui l'abbiamo campionato.
//
// È una media pesata con una campana (finestra di Hann) larga
// TERRENO_SFUMA_GRADI da una parte e dall'altra. I pesi si sommano a uno,
// quindi le quattro frazioni si sommano a uno: il colore che ne esce è una
// media vera, non una sovrapposizione.
function terrenoMiscelaPerGrado(tipiPerGrado) {
  const n = TERRENO_TIPI.length;
  const W = TERRENO_SFUMA_GRADI;
  const m = new Float32Array(361 * n);
  const pesi = [];
  let somma = 0;
  for (let d = -W; d <= W; d++) {
    const w = 0.5 * (1 + Math.cos(Math.PI * d / (W + 1)));
    pesi.push(w);
    somma += w;
  }
  for (let g = 0; g < 360; g++) {
    for (let k = 0, d = -W; d <= W; d++, k++) {
      const gg = (((g + d) % 360) + 360) % 360;
      m[g * n + tipiPerGrado[gg]] += pesi[k] / somma;
    }
  }
  // Il 360 è il 359+1, cioè lo 0: il giro si chiude
  for (let t = 0; t < n; t++) m[360 * n + t] = m[t];
  return m;
}

// La cresta parziale, direzione per direzione: quanto sale il terreno da
// qui fino al campione k-esimo. È un massimo che si accumula andando
// avanti, quindi la riga è per forza non decrescente — e l'ultima casella
// di ogni riga è la cresta intera, quella di `creste`.
//
// Serve a una domanda sola, ma è la domanda giusta: una vetta a otto
// chilometri non la nasconde la montagna a trenta che le sta dietro, la
// nasconde solo quello che le sta **davanti**. Confrontando col profilo
// intero — com'era prima — bastava una vetta più alta e più lontana nella
// stessa direzione per cancellare tutte le punte davanti a lei, che è il
// contrario di quello che succede fuori dalla finestra.
// Il massimo parte da sotto lo zero e non da zero.
//
// Per anni è partito da zero, perché la domanda era una sola — «quanto copre
// quella cresta» — e una cresta che copre meno di niente non esiste. Ma da
// quando il planetario disegna la forma del terreno, il pezzo sotto la linea
// dell'orizzonte è **la metà interessante**: stando su una cima, il prato a
// centocinquanta metri sta a venti gradi sotto i piedi, e il fatto che ci
// stia è tutto quello che distingue una vetta da un balcone in pianura. Chi
// vuole la vecchia risposta la trova in `terrenoCrestaEntro`, che tosa a zero
// in lettura: le due domande sono diverse e adesso hanno due risposte.
const TERRENO_ALT_MIN = -89;

function terrenoFronti(quote, occhio) {
  const n = TERRENO_DISTANZE.length;
  const f = new Float32Array(TERRENO_DIREZIONI * n);
  for (let i = 0; i < TERRENO_DIREZIONI; i++) {
    let massimo = TERRENO_ALT_MIN;
    for (let k = 0; k < n; k++) {
      const q = quote[i * n + k];
      if (typeof q === 'number') {
        const a = terrenoAngolo(q, occhio, TERRENO_DISTANZE[k]);
        if (a > massimo) massimo = a;
      }
      f[i * n + k] = Math.max(TERRENO_ALT_MIN, Math.min(TERRENO_ALT_MAX, massimo));
    }
  }
  return f;
}

async function terrenoCostruisci(lat, lon) {
  // Prima la quota di casa: senza sapere da che altezza si guarda, ogni
  // angolo è sbagliato — e sbagliato tanto, perché è il termine che si
  // sottrae a tutti gli altri.
  const [quotaCasa] = await terrenoQuote([{ lat, lon }]);
  const occhio = (typeof quotaCasa === 'number' ? quotaCasa : 0) + TERRENO_ALTEZZA_OCCHIO_M;

  // Tutti i campioni in fila, poi tagliati in richieste da novantasei.
  const punti = [];
  for (let i = 0; i < TERRENO_DIREZIONI; i++) {
    const az = i * TERRENO_PASSO_AZ;
    TERRENO_DISTANZE.forEach(km => punti.push(terrenoPuntoA(lat, lon, az, km)));
  }

  // Le richieste, tagliate a novanta punti l'una: con centoventi direzioni e
  // diciotto distanze sono ventiquattro.
  const pezzi = [];
  for (let i = 0; i < punti.length; i += TERRENO_PER_RICHIESTA) {
    pezzi.push(punti.slice(i, i + TERRENO_PER_RICHIESTA));
  }

  // A gruppi di quattro. In fila indiana ci vorrebbero venti secondi — e in
  // venti secondi chi ha aperto il planetario si è già fatto l'idea che
  // l'orizzonte sia quello disegnato; tutte insieme, il servizio risponde 429
  // e non se ne fa niente.
  const risposte = new Array(pezzi.length);
  terreno.avanzamento = 0;
  for (let i = 0; i < pezzi.length; i += TERRENO_RICHIESTE_INSIEME) {
    const giro = pezzi.slice(i, i + TERRENO_RICHIESTE_INSIEME);
    /* eslint-disable no-await-in-loop */
    const fatte = await Promise.all(giro.map(p => terrenoQuote(p)));
    fatte.forEach((q, j) => { risposte[i + j] = q; });
    terreno.avanzamento = Math.min(1, (i + giro.length) / pezzi.length);
    terrenoAggiornaPannello();
  }

  const quote = [];
  risposte.forEach(q => quote.push(...q));
  if (quote.length !== punti.length) throw new Error('quote incomplete');

  const creste = new Array(TERRENO_DIREZIONI).fill(0);
  const tipi = new Array(TERRENO_DIREZIONI).fill(TERRENO_PIANURA);
  for (let i = 0; i < TERRENO_DIREZIONI; i++) {
    let massimo = 0;
    for (let k = 0; k < TERRENO_DISTANZE.length; k++) {
      const q = quote[i * TERRENO_DISTANZE.length + k];
      if (typeof q !== 'number') continue;
      const a = terrenoAngolo(q, occhio, TERRENO_DISTANZE[k]);
      if (a > massimo) massimo = a;
    }
    // Sotto zero non si scende: da una cima l'orizzonte vero è **sotto**
    // la linea, ma tutto il resto dell'app dà per scontato che la terra
    // cominci a zero gradi — dal riempimento del terreno alla curva della
    // notte. Meglio un orizzonte piatto che un'app che si contraddice.
    creste[i] = Math.max(0, Math.min(TERRENO_ALT_MAX, massimo));
    tipi[i] = terrenoTipoDiDirezione(quote, i, quotaCasa, creste[i]);
  }

  // Le quote grezze si portano dietro, arrotondate al metro: sono le
  // stesse che hanno fatto le creste, ma tenerle vuol dire poter
  // rispondere anche alle due domande più fini — «che c'è **davanti** a quel
  // punto lì» (§8, da cui dipende se una vetta si vede) e «che forma ha il
  // terreno fino a lì», che è quella che il planetario disegna. Duemilacento
  // interi: una decina di kilobyte, e non si riscaricano mai più.
  return {
    quota: quotaCasa, creste, tipi,
    quote: quote.map(q => (typeof q === 'number' ? Math.round(q) : null))
  };
}


// =====================================================================
// 6. TENERSELO
//     Ventiquattro richieste per un profilo che non cambia mai — le colline
//     non si spostano — sono ventiquattro richieste da fare una volta sola
//     nella vita di quel posto. Il salvato vale finché non ci si allontana
//     di due chilometri.
// =====================================================================

function terrenoDistanzaKm(la1, lo1, la2, lo2) {
  const D2R = Math.PI / 180;
  const dLa = (la2 - la1) * D2R;
  const dLo = (lo2 - lo1) * D2R * Math.cos((la1 + la2) / 2 * D2R);
  return Math.hypot(dLa, dLo) * TERRENO_RAGGIO_KM;
}

function terrenoArchivio() {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_TERRENO) || 'null');
    // I salvataggi vecchi tenevano un posto solo, scritto in piano, e non
    // avevano i paesaggi: si buttano e si riscaricano. Sono sei richieste,
    // e senza i tipi il mare si disegnerebbe col prato.
    if (v && Array.isArray(v.posti)) return v.posti;
  } catch (e) { /* niente storage, o roba illeggibile */ }
  return [];
}

function terrenoPostoValido(v) {
  return !!v && typeof v.lat === 'number' &&
    Array.isArray(v.creste) && v.creste.length === TERRENO_DIREZIONI &&
    Array.isArray(v.tipi) && v.tipi.length === TERRENO_DIREZIONI;
}

function terrenoLeggiSalvato(lat, lon) {
  return terrenoArchivio().find(v => terrenoPostoValido(v) &&
    terrenoDistanzaKm(lat, lon, v.lat, v.lon) <= TERRENO_RAGGIO_VALIDO_KM) || null;
}

function terrenoSalva(lat, lon, dati) {
  try {
    // Il posto nuovo va in cima, e quello che occupava lo stesso pezzo di
    // mondo se ne va: se no dopo dieci aperture l'archivio è pieno di copie
    // della stessa collina.
    const posti = terrenoArchivio().filter(v => terrenoPostoValido(v) &&
      terrenoDistanzaKm(lat, lon, v.lat, v.lon) > TERRENO_RAGGIO_VALIDO_KM);
    posti.unshift({
      lat, lon, quota: dati.quota, creste: dati.creste, tipi: dati.tipi,
      quote: dati.quote, quando: Date.now()
    });
    localStorage.setItem(CHIAVE_TERRENO, JSON.stringify({ posti: posti.slice(0, TERRENO_POSTI_SALVATI) }));
  } catch (e) { /* storage pieno: pazienza, si riscarica */ }
}

// Butta via quello che c'è in memoria. Serve al ripristino di un backup,
// che scrive direttamente in localStorage.
function terrenoDimentica() {
  terreno.stato = 'niente';
  terreno.profilo = null;
  terreno.tipi = null;
  terreno.miscela = null;
  terreno.fronti = null;
  terreno.lat = terreno.lon = null;
}


// =====================================================================
// 7. L'INNESCO
// =====================================================================

function terrenoApplica(lat, lon, dati, sorgente) {
  terreno.lat = lat;
  terreno.lon = lon;
  terreno.quota = dati.quota;
  terreno.profilo = terrenoInterpola(dati.creste);
  terreno.tipi = terrenoTipiPerGrado(dati.tipi);
  terreno.miscela = terrenoMiscelaPerGrado(terreno.tipi);
  // I profili salvati prima che esistessero le quote grezze non ce le
  // hanno: si resta senza creste parziali, e chi le usa ripiega sul
  // profilo intero come faceva prima. Si rifanno da sé al primo posto
  // nuovo, e sono sei richieste che nessuno rifà apposta.
  terreno.fronti = Array.isArray(dati.quote) && dati.quote.length === TERRENO_DIREZIONI * TERRENO_DISTANZE.length
    ? terrenoFronti(dati.quote, (typeof dati.quota === 'number' ? dati.quota : 0) + TERRENO_ALTEZZA_OCCHIO_M)
    : null;
  terreno.stato = 'pronto';
  terreno.motivo = '';
  terreno.avanzamento = 0;
  terreno.quando = Date.now();
  terreno.sorgente = sorgente;
  // Non serve chiedere un ridisegno: il planetario ridisegna a ogni
  // fotogramma, e al primo utile la collina nuova è già lì.
  terrenoAggiornaPannello();
}

// Da che punto si sta guardando il cielo, che non è sempre casa: nel
// pannello «Tempo e luogo» del planetario si può andare a vedere il cielo
// di un'altra città, e da lì in poi il terreno è il suo. Prima non lo era,
// e si finiva a guardare il cielo di Bolzano con davanti le colline di
// Genova — che è peggio che non averne nessuna, perché sembra vero.
function terrenoLuogo() {
  const vista = typeof skyLuogoDelCielo === 'function' ? skyLuogoDelCielo() : null;
  if (vista && typeof vista.lat === 'number' && typeof vista.lon === 'number') return vista;
  const casa = typeof luogoCorrente === 'function' ? luogoCorrente() : null;
  return (casa && typeof casa.lat === 'number' && typeof casa.lon === 'number') ? casa : null;
}

// Si chiama ogni volta che il luogo può essere cambiato: all'apertura del
// planetario, dopo `skyImpostaPosizione` e a ogni cambio del luogo di
// visita. Se il profilo che c'è vale ancora per dove siamo, non fa niente.
function terrenoCarica(forza) {
  if (!terreno.acceso) return Promise.resolve(false);

  const luogo = terrenoLuogo();
  if (!luogo) return Promise.resolve(false);
  const lat = luogo.lat, lon = luogo.lon;

  if (!forza && terreno.stato === 'pronto' && terreno.lat !== null &&
      terrenoDistanzaKm(lat, lon, terreno.lat, terreno.lon) <= TERRENO_RAGGIO_VALIDO_KM) {
    return Promise.resolve(true);
  }
  // C'è già una richiesta in volo. Se è per questo stesso posto, si aspetta
  // quella; se nel frattempo il luogo è cambiato di nuovo (due città scelte
  // in fretta), la si lascia finire e si riparte dopo — nel `finally`.
  if (terreno.stato === 'in-corso') return terreno.promessa || Promise.resolve(false);

  if (!forza) {
    const salvato = terrenoLeggiSalvato(lat, lon);
    if (salvato) {
      terrenoApplica(salvato.lat, salvato.lon, salvato, 'salvato');
      return Promise.resolve(true);
    }
  }

  terreno.stato = 'in-corso';
  terreno.motivo = '';
  terreno.avanzamento = 0;
  terrenoAggiornaPannello();

  terreno.promessa = terrenoCostruisci(lat, lon)
    .then(dati => {
      terrenoSalva(lat, lon, dati);
      terrenoApplica(lat, lon, dati, 'rete');
      return true;
    })
    .catch(e => {
      // Senza rete resta il profilo inventato, che è esattamente com'era
      // prima: l'app non deve accorgersi di niente.
      console.warn('Terreno vero non disponibile:', e);
      terreno.stato = 'fallito';
      terreno.motivo = 'Non sono riuscito a scaricare la forma del terreno: resta l\'orizzonte disegnato.';
      terrenoAggiornaPannello();
      return false;
    })
    .finally(() => {
      terreno.promessa = null;
      // Il luogo è cambiato mentre scaricavamo? Allora quello che è appena
      // arrivato è il terreno di un posto che non si sta più guardando.
      const ora = terrenoLuogo();
      if (ora && terrenoDistanzaKm(ora.lat, ora.lon, lat, lon) > TERRENO_RAGGIO_VALIDO_KM) {
        terrenoCarica();
      }
    });

  return terreno.promessa;
}


// =====================================================================
// 8. QUELLO CHE SERVE AL PLANETARIO
//     Una funzione sola, e la chiama `skyAltezzaOrizzonte`: quanto è alta
//     la cresta in quella direzione, o `null` se il terreno vero non c'è
//     e vale ancora il profilo inventato.
// =====================================================================

function terrenoAltezza(az) {
  if (!terreno.acceso || terreno.stato !== 'pronto' || !terreno.profilo) return null;
  const x = (((az % 360) + 360) % 360);
  const i = Math.floor(x);
  const t = x - i;
  return terreno.profilo[i] + (terreno.profilo[i + 1] - terreno.profilo[i]) * t;
}

function terrenoDisponibile() {
  return terreno.acceso && terreno.stato === 'pronto' && !!terreno.profilo;
}

// Quanto si può stare vicini a un punto lontano `km` e contare ancora come
// «davanti a lui». Il campione a nove chilometri di una montagna che
// culmina a dieci è il suo stesso fianco: preso come ostacolo, ogni vetta
// nasconderebbe sé stessa. Il quindici per cento di margine è più o meno
// mezzo campione della griglia, che è la finezza con cui questo terreno sa
// rispondere.
const TERRENO_FRONTE_MARGINE = 0.85;

// Quanto sale il terreno in direzione `az` **entro** `km`: la cresta di
// quella fetta di paesaggio, senza niente di quello che le sta dietro.
// `null` quando non lo si può sapere — niente terreno, o un profilo
// salvato di quelli vecchi senza quote grezze — e allora chi chiama torni
// pure al profilo intero.
//
// È la domanda che serve a due cose diverse. La prima è sapere cosa
// nasconde una vetta (`terrenoCrestaDavanti`, qui sotto). La seconda è
// disegnare l'orizzonte **a strati**: il primo piano è la cresta entro
// pochi chilometri, il piano intermedio quella entro qualche decina, lo
// sfondo è tutto. Essendo un massimo che si accumula, le tre risposte sono
// per costruzione una sopra l'altra — ed è quello che fa sì che il primo
// piano copra lo sfondo invece di intrecciarcisi.
//
// Fra due direzioni campionate si interpola con la stessa curva a S del
// profilo: le due risposte devono essere parenti, se no una vetta cambia
// stato passando da un settore all'altro.
function terrenoCrestaEntro(az, km) {
  if (!terrenoDisponibile() || !terreno.fronti) return null;
  const n = TERRENO_DISTANZE.length;
  // L'ultimo campione che ci sta dentro. Nessuno: niente terreno in quella
  // fetta, e la risposta è zero — non `null`, che vuol dire un'altra cosa.
  let k = -1;
  for (let j = 0; j < n; j++) if (TERRENO_DISTANZE[j] <= km) k = j;
  if (k < 0) return 0;

  // Tosata a zero: questa è la domanda «quanto **copre** il terreno entro
  // tot chilometri», e coprire meno di niente non vuol dire niente. La
  // risposta grezza, che sotto la linea dell'orizzonte scende in negativo,
  // la dà `terrenoFrontiA` — ed è quella che serve a disegnare.
  return Math.max(0, terrenoFronteA(az, k));
}

// La cresta parziale interpolata in azimut, per un indice di distanza.
// È il cuore di `terrenoCrestaEntro`, tirato fuori perché serve anche grezzo.
function terrenoFronteA(az, k) {
  const n = TERRENO_DISTANZE.length;
  const dove = (((az % 360) + 360) % 360) / TERRENO_PASSO_AZ;
  const i = Math.floor(dove) % TERRENO_DIREZIONI;
  const j = (i + 1) % TERRENO_DIREZIONI;
  const t = dove - Math.floor(dove);
  const s = t * t * (3 - 2 * t);
  return terreno.fronti[i * n + k] * (1 - s) + terreno.fronti[j * n + k] * s;
}

// Tutte le creste parziali di una direzione in un colpo solo: per ogni fetta
// di distanza, quanto sale il terreno fino a lì. È la riga di `terreno.fronti`
// che passa per quell'azimut, interpolata fra le due direzioni campionate.
//
// Esiste per una ragione di conto e una di forma. Il conto: il planetario
// chiede questa riga per ogni colonna dello schermo e per ogni fotogramma —
// duecentocinquanta volte — e chiamare `terrenoCrestaEntro` diciotto volte
// vorrebbe dire rifare diciotto volte la stessa interpolazione di azimut. La
// forma: qui i valori sono **grezzi**, cioè scendono sotto lo zero dove il
// terreno sta più in basso dell'occhio, ed è esattamente quel pezzo che
// disegna la conca davanti a chi guarda da una cima.
//
// `fuori` è un buffer da riusare: chi disegna ne tiene uno solo e lo passa
// ogni volta, se no sono duecentocinquanta array nuovi per fotogramma.
function terrenoFrontiA(az, fuori) {
  if (!terrenoDisponibile() || !terreno.fronti) return null;
  const n = TERRENO_DISTANZE.length;
  const out = (fuori && fuori.length >= n) ? fuori : new Float32Array(n);
  const dove = (((az % 360) + 360) % 360) / TERRENO_PASSO_AZ;
  const i = Math.floor(dove) % TERRENO_DIREZIONI;
  const j = (i + 1) % TERRENO_DIREZIONI;
  const t = dove - Math.floor(dove);
  const s = t * t * (3 - 2 * t);
  const a = i * n, b = j * n;
  for (let k = 0; k < n; k++) {
    out[k] = terreno.fronti[a + k] * (1 - s) + terreno.fronti[b + k] * s;
  }
  return out;
}

// Quanto è alta la cresta che sta **davanti** a un punto in direzione `az`
// e distante `km`: la stessa cosa di qui sopra, ma fermandosi un po' prima
// di lui — vedi `TERRENO_FRONTE_MARGINE`.
function terrenoCrestaDavanti(az, km) {
  return terrenoCrestaEntro(az, km * TERRENO_FRONTE_MARGINE);
}

// Che paesaggio c'è guardando da quella parte: 'mare', 'pianura',
// 'collina', 'montagna' — oppure `null` se il terreno vero non c'è, e
// allora nessuno può dirlo.
function terrenoTipo(az) {
  if (!terrenoDisponibile() || !terreno.tipi) return null;
  const x = (((az % 360) + 360) % 360);
  return TERRENO_TIPI[terreno.tipi[Math.round(x) % 360]] || null;
}

// Quanta parte di ogni paesaggio c'è guardando da quella parte: quattro
// frazioni che si sommano a uno. È la versione da disegno di `terrenoTipo`,
// e le due rispondono a domande diverse — questa dice «tre quarti mare e un
// quarto collina», che è quello che serve per scegliere un colore che non
// faccia lo scalino con quello del grado accanto.
function terrenoMiscela(az) {
  if (!terrenoDisponibile() || !terreno.miscela) return null;
  const n = TERRENO_TIPI.length;
  const i = (Math.round((((az % 360) + 360) % 360)) % 360) * n;
  return {
    mare: terreno.miscela[i], pianura: terreno.miscela[i + 1],
    collina: terreno.miscela[i + 2], montagna: terreno.miscela[i + 3]
  };
}

// Il punto più alto e quello più basso del giro, e quanta parte
// dell'orizzonte occupa ciascun paesaggio: è il modo più corto di dire
// com'è fatto il posto in cui sei.
function terrenoRiassunto() {
  if (!terrenoDisponibile()) return null;
  let alto = -1, altoAz = 0, basso = 999;
  const gradi = [0, 0, 0, 0];
  // La direzione centrale di ogni paesaggio: si somma il versore di ogni
  // grado e si guarda dove punta la somma. Sommare gli azimut e dividerli
  // no: fra 350° e 10° la media aritmetica dà sud.
  const sx = [0, 0, 0, 0], sy = [0, 0, 0, 0];
  for (let g = 0; g < 360; g++) {
    if (terreno.profilo[g] > alto) { alto = terreno.profilo[g]; altoAz = g; }
    if (terreno.profilo[g] < basso) basso = terreno.profilo[g];
    const t = terreno.tipi ? terreno.tipi[g] : TERRENO_PIANURA;
    gradi[t]++;
    sx[t] += Math.sin(g * Math.PI / 180);
    sy[t] += Math.cos(g * Math.PI / 180);
  }
  const verso = t => (Math.atan2(sx[t], sy[t]) * 180 / Math.PI + 360) % 360;
  const nome = a => (typeof skyNomeDirezione === 'function' ? skyNomeDirezione(a) : '');

  const paesaggi = TERRENO_TIPI
    .map((n, t) => ({ tipo: n, gradi: gradi[t], quota: gradi[t] / 360, direzione: nome(verso(t)) }))
    .filter(p => p.gradi > 0)
    .sort((a, b) => b.gradi - a.gradi);

  return {
    alto, altoAz, basso,
    quota: terreno.quota,
    tipoPiuAlto: terrenoTipo(altoAz),
    paesaggi,
    direzione: nome(altoAz)
  };
}

function terrenoAlterna() {
  terreno.acceso = !terreno.acceso;
  if (terreno.acceso && terreno.stato !== 'pronto') terrenoCarica();
  // Non serve chiedere un ridisegno: il planetario ridisegna a ogni
  // fotogramma, e al primo utile la collina nuova è già lì.
  terrenoAggiornaPannello();
}


// =====================================================================
// 9. IL TASTO E LA RIGA CHE DICE COM'È ANDATA
//
//     Sta nel pannello Visualizzazione del planetario, accanto a
//     «Atmosfera»: sono la stessa cosa — quanto il disegno somiglia a
//     quello che si vede fuori dalla finestra.
// =====================================================================

function terrenoTesto() {
  if (!terreno.acceso) return 'Orizzonte disegnato: colline finte, uguali dappertutto.';
  if (terreno.stato === 'in-corso') {
    // Ventiquattro richieste sono qualche secondo, e qualche secondo senza
    // niente da leggere sembrano un guasto. La percentuale non serve a chi
    // sa cosa sta succedendo: serve a chi non lo sa.
    const q = terreno.avanzamento > 0 && terreno.avanzamento < 1
      ? ` (${Math.round(terreno.avanzamento * 100)}%)` : '';
    return `Sto misurando com'è fatto il terreno attorno a te${q}…`;
  }
  if (terreno.stato === 'fallito') return terreno.motivo;

  const r = terrenoRiassunto();
  if (!r) return 'Apri il planetario da un posto con la rete e prendo la forma vera del terreno qui attorno.';

  const quota = typeof r.quota === 'number' ? `Sei a ${Math.round(r.quota)} m. ` : '';

  // Com'è fatto il giro. Non «l'orizzonte è alto 3,4°» — che è vero e non
  // dice niente — ma le parole con cui uno descriverebbe il posto in cui
  // vive: il mare da una parte, la montagna dall'altra, la pianura in mezzo.
  const parole = {
    mare: 'il mare', pianura: 'pianura', collina: 'colline', montagna: 'montagne'
  };
  const pezzi = r.paesaggi
    .filter(p => p.quota >= 0.08)
    .map(p => {
      const q = p.quota >= 0.75 ? 'quasi tutt\'intorno'
        : p.quota >= 0.45 ? 'per metà orizzonte'
        : p.quota >= 0.22 ? `verso ${p.direzione}`
        : `un tratto verso ${p.direzione}`;
      return `${parole[p.tipo] || p.tipo} ${q}`;
    });
  const paesaggio = pezzi.length ? `Attorno a te: ${pezzi.join(', ')}. ` : '';

  if (r.alto < 0.35) {
    return quota + paesaggio + 'L\'orizzonte è libero in tutte le direzioni: non c\'è niente che copra.';
  }
  const cosa = r.tipoPiuAlto && r.tipoPiuAlto !== 'pianura' && r.tipoPiuAlto !== 'mare'
    ? ` (${r.tipoPiuAlto === 'montagna' ? 'la montagna' : 'la collina'})` : '';
  return quota + paesaggio +
    `Il punto più alto è a ${r.alto.toFixed(1)}° verso ${r.direzione}${cosa}. ` +
    (r.basso < 0.35
      ? 'Da qualche parte l\'orizzonte è invece completamente libero.'
      : `Il più basso è a ${r.basso.toFixed(1)}°.`);
}

function terrenoAggiornaPannello() {
  const tasto = document.getElementById('skymap-btn-terreno');
  if (tasto) {
    const acceso = terreno.acceso;
    tasto.classList.toggle('attiva', acceso);
    tasto.setAttribute('aria-pressed', acceso ? 'true' : 'false');
    tasto.textContent = terreno.stato === 'in-corso' ? 'Terreno vero…' : 'Terreno vero';
  }
  const nota = document.getElementById('skymap-terreno-nota');
  if (nota) {
    nota.textContent = [terrenoTesto(), cittaTesto(), cimeTesto()]
      .map(t => (t || '').trim()).filter(Boolean).join(' ');
  }
  cittaAggiornaTasto();
  cimeAggiornaTasto();
}


// =====================================================================
// 9-bis. FIN DOVE SI GUARDA
//
//     Due misure sole, e non c'è un valore giusto: dipende da dove sei.
//     Dalla pianura padana le Alpi stanno a centoventi chilometri e nelle
//     giornate terse si contano una per una, quindi il raggio va largo; in
//     mezzo all'Appennino a centoventi chilometri non si vede niente, e
//     tenerlo largo vuol dire solo riempire l'orizzonte di nomi di
//     montagne che stanno dietro ad altre montagne. La stessa cosa vale
//     per le luci dei paesi.
//
//     Fin qui erano due costanti scritte nel codice. Adesso stanno nelle
//     Impostazioni, perché sono l'unica cosa di questo file che dipende da
//     chi guarda e non dal terreno.
//
//     Il raggio entra anche nel salvataggio: un elenco preso a quaranta
//     chilometri non risponde alla domanda di chi ne ha chiesti cento, e
//     riusarlo vorrebbe dire dare per buona una risposta che non è stata
//     fatta. Al contrario un elenco più largo di quello chiesto va
//     benissimo — basta tagliarlo, e le richieste di rete si risparmiano.
// =====================================================================

const CHIAVE_RAGGI = 'astrocalendario_raggi_orizzonte';

// Il passo non è un vezzo: la slitta deve dare numeri tondi, e un raggio
// di 87 km non vuol dire niente di diverso da uno di 85.
const RAGGI_LIMITI = {
  cime: { min: 15, max: 200, passo: 5, predefinito: 80 },
  citta: { min: 10, max: 150, passo: 5, predefinito: 90 }
};

function raggiTosa(quale, km) {
  const l = RAGGI_LIMITI[quale];
  const v = Math.round(Number(km) / l.passo) * l.passo;
  return Math.max(l.min, Math.min(l.max, isFinite(v) ? v : l.predefinito));
}

function raggiLeggiSalvati() {
  const v = { cime: RAGGI_LIMITI.cime.predefinito, citta: RAGGI_LIMITI.citta.predefinito, nomiMonti: false };
  try {
    const s = JSON.parse(localStorage.getItem(CHIAVE_RAGGI) || 'null');
    if (s && typeof s === 'object') {
      if (typeof s.cime === 'number') v.cime = raggiTosa('cime', s.cime);
      if (typeof s.citta === 'number') v.citta = raggiTosa('citta', s.citta);
      // I nomi dei monti nascono spenti, e restano spenti finché qualcuno
      // non li accende: sono l'unico strato di questo file che aggiunge
      // scritte sopra al cielo, e chi apre il planetario per la prima
      // volta vuole vedere il cielo.
      if (typeof s.nomiMonti === 'boolean') v.nomiMonti = s.nomiMonti;
    }
  } catch (e) { /* niente storage, o roba illeggibile */ }
  return v;
}

const raggi = raggiLeggiSalvati();

function raggiSalva() {
  try { localStorage.setItem(CHIAVE_RAGGI, JSON.stringify(raggi)); } catch (e) { /* pieno */ }
}

function raggioCime() { return raggi.cime; }
function raggioCitta() { return raggi.citta; }

// Rileggere da capo quello che c'è in `localStorage`. Serve al ripristino
// di un backup, che in localStorage ci scrive direttamente: senza questa,
// l'oggetto in memoria resterebbe quello di prima e le due verità si
// contraddirebbero fino al ricaricamento della pagina.
function raggiRicarica() {
  Object.assign(raggi, raggiLeggiSalvati());
  cime.acceso = raggi.nomiMonti;
  if (typeof costruisciRaggiOrizzonte === 'function') costruisciRaggiOrizzonte();
}

// Cambia un raggio e rimette in moto quello che dipende da lui. Torna
// `true` se è cambiato davvero: chi chiama non deve ricaricare mezzo mondo
// perché la slitta si è mossa e poi è tornata dov'era.
function raggiImposta(quale, km) {
  const valore = raggiTosa(quale, km);
  if (raggi[quale] === valore) return false;
  raggi[quale] = valore;
  raggiSalva();
  if (quale === 'cime') {
    cimeDimentica();
    if (cime.acceso) cimeCarica(true);
  } else {
    cittaDimentica();
    if (citta.acceso) cittaCarica(true);
  }
  terrenoAggiornaPannello();
  return true;
}

// Il salvato serve solo se è stato preso guardando **almeno** fin dove si
// sta guardando adesso. I salvataggi vecchi non dicono con che raggio sono
// stati fatti: valgono per quello che era il raggio fisso di allora.
function raggiSalvatoBuono(v, quale, vecchio) {
  const preso = (v && typeof v.raggio === 'number') ? v.raggio : vecchio;
  return preso >= raggi[quale] - 0.5;
}


// =====================================================================
// 10. LE CITTÀ VERE
//
//     Un orizzonte notturno non è nero. Da qualunque posto abitato, sopra
//     il crinale ci sono delle cupole di luce: arancioni quelle vecchie al
//     sodio, bianche quelle nuove a LED. E non sono un disturbo da
//     nascondere — sono l'informazione più utile che ci sia sull'orizzonte
//     di casa, perché dicono da che parte NON puntare il telescopio.
//
//     Fin qui il planetario faceva l'opposto: cielo uniformemente scuro
//     fino a terra, come se ogni posto fosse un deserto. Uno guardava la
//     mappa, sceglieva una galassia bassa a sud, usciva — e a sud c'era il
//     capoluogo.
//
//     I paesi e le città vengono da OpenStreetMap (Overpass, senza chiave e
//     senza account). Se non risponde restano le città dell'elenco interno,
//     quello delle eclissi: sono i capoluoghi, cioè proprio quelli che si
//     vedono da lontano. Se non c'è né l'uno né l'altro, l'orizzonte torna
//     nero com'era e non se ne parla più.
// =====================================================================

const CHIAVE_CITTA = 'astrocalendario_citta';

// Novanta chilometri: oltre, l'alone di una città grande c'è ancora, ma è
// più basso della foschia e non vale la richiesta. Da quando il raggio si
// sceglie nelle Impostazioni (§9-bis) questo è solo il valore di partenza,
// e resta come metro per i salvataggi vecchi, che il raggio non lo dicono.
const CITTA_RAGGIO_KM = 90;
// I paesi piccoli si prendono solo da vicino: a venti chilometri un paese
// di duemila anime non illumina niente, e ce ne sono a centinaia.
const CITTA_RAGGIO_PAESI_KM = 20;
const CITTA_MAX = 60;
const CITTA_RAGGIO_VALIDO_KM = 5;
const CITTA_ATTESA_MS = 15000;

// Quando OpenStreetMap non dice quanti abitanti ha, si va per categoria.
// Sono numeri all'ingrosso, e vanno benissimo: la differenza fra una città
// e un paese si vede, quella fra 40.000 e 55.000 abitanti no.
const CITTA_ABITANTI = { city: 150000, town: 18000, village: 2200, suburb: 25000, borough: 60000 };

const citta = {
  stato: 'niente',        // niente | in-corso | pronto | fallito
  lat: null, lon: null,
  elenco: [],             // { nome, az, km, abitanti, forza, alto, mezzo, alfa }
  fonte: '',
  motivo: '',
  acceso: true
};


// --- Dove sta, e quanto è lontana ------------------------------------

function cittaAzimut(la1, lo1, la2, lo2) {
  const D2R = Math.PI / 180;
  const f1 = la1 * D2R, f2 = la2 * D2R, dl = (lo2 - lo1) * D2R;
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Quanto illumina il cielo. La legge di Walker dice che il chiarore sopra
// una città cala come la distanza alla due e mezzo, ed è quella che usano
// gli atlanti dell'inquinamento luminoso. Qui basta la forma: gli abitanti
// contano più che linearmente (una città grande è anche più illuminata
// per abitante) e la distanza li smorza in fretta.
//
// I due numeri che ne escono sono quelli del disegno: quanto sale la
// cupola e quanto è larga. Vengono da come si vedono davvero — Milano da
// trenta chilometri occupa un quarto dell'orizzonte e arriva a venti gradi
// d'altezza, un paese a tre chilometri fa una gobba bassa e stretta.
function cittaForza(abitanti, km) {
  const d = Math.max(1.2, km);
  return Math.pow(Math.max(200, abitanti), 1.2) / (d * d + 4);
}

function cittaPrepara(grezze, lat, lon) {
  return grezze.map(c => {
    const km = terrenoDistanzaKm(lat, lon, c.lat, c.lon);
    const az = cittaAzimut(lat, lon, c.lat, c.lon);
    const forza = cittaForza(c.abitanti, km);
    // Il raggio dell'abitato, in chilometri: una città di un milione di
    // abitanti è larga una decina di chilometri, un paese di duemila
    // qualche centinaio di metri. Da lì quanto la si vede larga.
    const raggioKm = 0.5 * Math.sqrt(Math.max(200, c.abitanti) / 10000);
    const largoVero = Math.atan2(raggioKm, Math.max(0.4, km)) * 180 / Math.PI;
    const alto = Math.max(0.5, Math.min(22, 0.9 * Math.pow(forza, 0.30)));
    return {
      nome: c.nome,
      abitanti: c.abitanti,
      lat: c.lat, lon: c.lon,
      az, km, forza, alto,
      // L'alone è sempre più largo dell'abitato: la luce si sparge nell'aria
      mezzo: Math.max(4, Math.min(55, largoVero + 3.5 + alto * 0.6)),
      alfa: Math.max(0.03, Math.min(0.30, 0.03 * Math.pow(forza, 0.22)))
    };
  })
    .filter(c => c.km <= raggioCitta() + 5 && c.forza > 12)
    .sort((a, b) => b.forza - a.forza)
    .slice(0, CITTA_MAX);
}


// --- Prenderle da OpenStreetMap --------------------------------------

function cittaQueryOverpass(lat, lon) {
  const la = lat.toFixed(4), lo = lon.toFixed(4);
  const largo = raggioCitta();
  // I paesini seguono il raggio grande finché è piccolo: con venti
  // chilometri di ricerca chiedere le città a venti e i paesi a venti è la
  // stessa richiesta, e chiederli a venti quando il raggio è dieci vuol
  // dire prendersi paesi che non si è chiesto di vedere.
  const vicino = Math.min(CITTA_RAGGIO_PAESI_KM, largo);
  return '[out:json][timeout:20];(' +
    `node["place"~"^(city|town)$"](around:${Math.round(largo * 1000)},${la},${lo});` +
    `node["place"~"^(village|suburb|borough)$"](around:${Math.round(vicino * 1000)},${la},${lo});` +
    ');out body 400;';
}

// --- Chiedere a Overpass ----------------------------------------------
//
// Il servizio pubblico è gratuito e senza chiave, e si comporta di
// conseguenza: quando è carico risponde 429 («troppe richieste») o 504, e
// ogni tanto una macchina è giù del tutto. Chiedendo a una sola e
// arrendendosi al primo intoppo, metà delle volte l'orizzonte restava
// senza nomi — non perché i dati non ci fossero, ma perché era martedì
// sera. Le richieste vanno quindi provate su più istanze, e l'errore va
// detto com'è: «429» e «non c'è rete» sono due guai diversi.
const OVERPASS_ISTANZE = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

async function overpassChiedi(query, attesaMs) {
  let ultimo = null;
  for (const istanza of OVERPASS_ISTANZE) {
    const controllo = typeof AbortController === 'function' ? new AbortController() : null;
    // L'attesa del client deve essere più lunga di quella scritta nella
    // query, se no si taglia la richiesta proprio mentre il server la sta
    // ancora onorando — e il colpevole sembra il server.
    const timer = controllo ? setTimeout(() => controllo.abort(), attesaMs) : null;
    try {
      const risposta = await fetch(istanza + '?data=' + encodeURIComponent(query),
        controllo ? { signal: controllo.signal } : undefined);
      if (!risposta.ok) throw new Error('OpenStreetMap non risponde (' + risposta.status + ')');
      const dati = await risposta.json();
      if (!dati || !Array.isArray(dati.elements)) throw new Error('risposta senza elementi');
      return dati.elements;
    } catch (e) {
      ultimo = e;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw ultimo || new Error('nessuna istanza di OpenStreetMap ha risposto');
}

async function cittaDaOverpass(lat, lon) {
  const elementi = await overpassChiedi(cittaQueryOverpass(lat, lon), CITTA_ATTESA_MS);
  return elementi
    .filter(n => n && n.tags && n.tags.name && typeof n.lat === 'number')
    .map(n => {
      // La popolazione, quando c'è, arriva come stringa e ogni tanto con
      // i punti delle migliaia dentro
      const grezza = parseInt(String(n.tags.population || '').replace(/[^\d]/g, ''), 10);
      return {
        nome: n.tags.name,
        lat: n.lat, lon: n.lon,
        abitanti: isFinite(grezza) && grezza > 0 ? grezza : (CITTA_ABITANTI[n.tags.place] || 3000)
      };
    });
}

// Il ripiego: l'elenco dei capoluoghi che l'app si porta dietro per le
// eclissi. Non ha i paesi, ma le città che si vedono da lontano ci sono
// tutte — ed è quello che serve a un orizzonte.
function cittaDaElencoInterno(lat, lon) {
  if (typeof ECL_CITTA === 'undefined') return [];
  return ECL_CITTA
    .map(([nome, paese, cLat, cLon]) => ({ nome, lat: cLat, lon: cLon, abitanti: 250000 }))
    .filter(c => terrenoDistanzaKm(lat, lon, c.lat, c.lon) <= raggioCitta());
}


// --- Tenersele --------------------------------------------------------

function cittaArchivio() {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_CITTA) || 'null');
    if (v && Array.isArray(v.posti)) return v.posti;
  } catch (e) { /* niente storage, o roba illeggibile */ }
  return [];
}

function cittaLeggiSalvate(lat, lon) {
  return cittaArchivio().find(v => v && Array.isArray(v.elenco) && typeof v.lat === 'number' &&
    raggiSalvatoBuono(v, 'citta', CITTA_RAGGIO_KM) &&
    terrenoDistanzaKm(lat, lon, v.lat, v.lon) <= CITTA_RAGGIO_VALIDO_KM) || null;
}

function cittaSalva(lat, lon, grezze, fonte) {
  try {
    const posti = cittaArchivio().filter(v => v && typeof v.lat === 'number' &&
      terrenoDistanzaKm(lat, lon, v.lat, v.lon) > CITTA_RAGGIO_VALIDO_KM);
    posti.unshift({
      lat, lon, fonte, quando: Date.now(), raggio: raggioCitta(),
      // Nomi corti e coordinate a quattro decimali: un centinaio di paesi
      // stanno in una decina di kilobyte
      elenco: grezze.map(c => ({ n: c.nome, a: +c.lat.toFixed(4), o: +c.lon.toFixed(4), p: c.abitanti }))
    });
    localStorage.setItem(CHIAVE_CITTA, JSON.stringify({ posti: posti.slice(0, TERRENO_POSTI_SALVATI) }));
  } catch (e) { /* storage pieno: pazienza, si riscarica */ }
}

function cittaDalSalvato(v) {
  return v.elenco.map(c => ({ nome: c.n, lat: c.a, lon: c.o, abitanti: c.p }));
}

function cittaDimentica() {
  citta.stato = 'niente';
  citta.elenco = [];
  citta.lat = citta.lon = null;
}


// --- L'innesco --------------------------------------------------------

function cittaApplica(lat, lon, grezze, fonte) {
  citta.lat = lat;
  citta.lon = lon;
  citta.elenco = cittaPrepara(grezze, lat, lon);
  citta.fonte = fonte;
  citta.stato = 'pronto';
  citta.motivo = '';
  terrenoAggiornaPannello();
}

function cittaCarica(forza) {
  const luogo = terrenoLuogo();
  if (!luogo) return Promise.resolve(false);
  const lat = luogo.lat, lon = luogo.lon;

  if (!forza && citta.stato === 'pronto' && citta.lat !== null &&
      terrenoDistanzaKm(lat, lon, citta.lat, citta.lon) <= CITTA_RAGGIO_VALIDO_KM) {
    return Promise.resolve(true);
  }
  if (citta.stato === 'in-corso') return citta.promessa || Promise.resolve(false);

  if (!forza) {
    const salvate = cittaLeggiSalvate(lat, lon);
    if (salvate) {
      cittaApplica(salvate.lat, salvate.lon, cittaDalSalvato(salvate), salvate.fonte || 'salvato');
      return Promise.resolve(true);
    }
  }

  citta.stato = 'in-corso';
  citta.motivo = '';
  terrenoAggiornaPannello();

  citta.promessa = cittaDaOverpass(lat, lon)
    .then(elenco => {
      if (!elenco.length) throw new Error('nessun luogo abitato qui attorno');
      cittaApplica(lat, lon, elenco, 'osm');
      // Si salva quello che è rimasto dopo la potatura, non i quattrocento
      // nodi grezzi: in una provincia densa Overpass risponde con ogni
      // frazione, e in localStorage ci vanno solo quelle che illuminano.
      if (!citta.elenco.length) throw new Error('nessun luogo abbastanza illuminato');
      cittaSalva(lat, lon, citta.elenco, 'osm');
      return true;
    })
    .catch(e => {
      console.warn('Città da OpenStreetMap non disponibili:', e);
      // Il ripiego non si salva: è una supplenza, e alla prossima apertura
      // con la rete vera vale la pena riprovare con i paesi veri.
      const interne = cittaDaElencoInterno(lat, lon);
      if (interne.length) {
        cittaApplica(lat, lon, interne, 'interno');
        return true;
      }
      citta.stato = 'fallito';
      citta.motivo = 'Non conosco i paesi qui attorno: l\'orizzonte resta senza luci.';
      terrenoAggiornaPannello();
      return false;
    })
    .finally(() => {
      citta.promessa = null;
      const ora = terrenoLuogo();
      if (ora && terrenoDistanzaKm(ora.lat, ora.lon, lat, lon) > CITTA_RAGGIO_VALIDO_KM) {
        cittaCarica();
      }
    });

  return citta.promessa;
}


// --- Quello che serve al planetario -----------------------------------

// Le città che vale la pena disegnare, dalla più luminosa in giù. Il
// planetario le proietta da sé: qui si sa dove stanno e quanto illuminano,
// non come finiscono sullo schermo.
function cittaVicine() {
  if (!citta.acceso || citta.stato !== 'pronto') return [];
  return citta.elenco;
}

function cittaAlterna() {
  citta.acceso = !citta.acceso;
  if (citta.acceso && citta.stato !== 'pronto') cittaCarica();
  terrenoAggiornaPannello();
}

function cittaTesto() {
  if (!citta.acceso) return 'Luci delle città spente: orizzonte nero, come da un deserto.';
  if (citta.stato === 'in-corso') return 'Sto cercando i paesi qui attorno…';
  if (citta.stato === 'fallito') return citta.motivo;
  if (citta.stato !== 'pronto' || !citta.elenco.length) return '';

  const prima = citta.elenco[0];
  const dove = typeof skyNomeDirezione === 'function' ? skyNomeDirezione(prima.az) : '';
  return `Sull'orizzonte ci sono le luci di ${citta.elenco.length} centri abitati: ` +
    `il chiarore più forte è quello di ${prima.nome}, a ${prima.km.toFixed(0)} km verso ${dove}. ` +
    'È la direzione in cui conviene NON cercare le cose deboli.';
}

function cittaAggiornaTasto() {
  const tasto = document.getElementById('skymap-btn-citta');
  if (!tasto) return;
  tasto.classList.toggle('attiva', citta.acceso);
  tasto.setAttribute('aria-pressed', citta.acceso ? 'true' : 'false');
  tasto.textContent = citta.stato === 'in-corso' ? 'Luci delle città…' : 'Luci delle città';
}


// =====================================================================
// 11. LE MONTAGNE, COL LORO NOME
//
//     Il terreno della sezione 4 sa che forma ha l'orizzonte, ma non sa
//     come si chiama: disegna una cresta a 3,4 gradi verso nord-ovest e
//     tace. Chi osserva sempre dallo stesso posto quella cresta però ce
//     l'ha in testa con un nome — «dietro al Cimone», «finché non passa
//     il Resegone» — ed è così che si ragiona davvero la sera: non per
//     gradi di altezza, ma per montagne.
//
//     Le vette vengono da OpenStreetMap (`natural=peak`), che le tiene
//     con nome e quota. Da nome, quota e distanza esce l'unica cosa che
//     serve al planetario: sotto che angolo si vede la punta — con la
//     curvatura e la rifrazione dentro, come per il terreno, che a cento
//     chilometri valgono sei gradi buoni di abbassamento.
//
//     Due filtri, e sono quelli che distinguono un elenco da un disegno
//     leggibile. Una vetta si nomina solo se **spunta davvero**: se sta
//     sotto la cresta del terreno in quella direzione, da qui non la si
//     vede — c'è una collina davanti — e scriverne il nome sarebbe una
//     bugia. E si nominano le più alte *viste da qui*, non le più alte in
//     assoluto: il Monte Bianco a duecento chilometri è un dente
//     all'orizzonte, la collina dietro casa copre mezzo cielo.
//
//     Senza rete non c'è ripiego, e non poteva essercene uno: un elenco
//     di vette da portarsi dietro sarebbe stato o inutile (le dieci più
//     famose d'Italia) o enorme. Senza Overpass l'orizzonte resta la
//     forma senza nomi che era prima.
// =====================================================================

const CHIAVE_CIME = 'astrocalendario_cime';

// Le montagne grandi si vedono da lontanissimo: dalla pianura padana le
// Alpi stanno a centoventi chilometri e nelle giornate terse si contano
// una per una. Oltre i centotrenta ci pensa la foschia. Da quando il
// raggio si sceglie nelle Impostazioni (§9-bis) questo numero non comanda
// più la ricerca: resta il metro con cui si giudicano i salvataggi vecchi,
// che il raggio con cui sono stati presi non lo dicono.
const CIME_RAGGIO_KM = 130;
// Sotto questa quota una vetta si prende solo da vicino: a cento
// chilometri una cima di ottocento metri è sotto l'orizzonte comunque.
const CIME_QUOTA_LONTANE_M = 1500;
const CIME_RAGGIO_VICINE_KM = 25;
// Quando la richiesta larga non passa si ripiega su questo raggio: sono le
// montagne di casa, quelle che uno riconosce a occhio e chiama per nome.
const CIME_RAGGIO_RIPIEGO_KM = 35;
// Quante se ne tengono in mano. Sono più di quelle che si scrivono
// (`SKY_CIME_MAX_NOMI` in app.js), e devono esserlo: girandosi cambia il
// pezzo di orizzonte in vista, e chi si nomina lì lo si sceglie fra quelle
// che stanno lì, non fra le sei più grosse del giro intero.
const CIME_MAX = 80;
const CIME_RAGGIO_VALIDO_KM = 5;
// Più lunga del `timeout` scritto nella query (25 s): il client non deve
// mai essere lui ad arrendersi per primo.
const CIME_ATTESA_MS = 32000;
// Dopo un buco nell'acqua non si ritenta a ogni respiro: il servizio
// pubblico che risponde 429 lo fa perché lo stiamo chiamando troppo, e
// insistere è il modo migliore per continuare a prendere 429.
const CIME_RIPROVA_DOPO_MS = 5 * 60 * 1000;

// Quanto può stare sotto la cresta del terreno una vetta e valere ancora
// come visibile. Non è tolleranza di comodo: è il fatto che la cresta è
// campionata ogni 7,5 gradi e interpolata, quindi la punta vera cade
// quasi sempre poco sopra o poco sotto la curva che la descrive.
const CIME_SOTTO_CRESTA_GRADI = 0.25;
// Una punta che si affaccia per un decimo di grado non è una montagna che
// si riconosce: è una riga di orizzonte con sopra un nome.
const CIME_ALT_MIN_GRADI = 0.15;

// Due nomi diversi per la stessa punta: OpenStreetMap ha «Monte Alben» e
// «Cima Alben Ovest» a trecento metri uno dall'altra, e da trenta
// chilometri sono lo stesso dente sull'orizzonte. Quando due vette cadono
// dentro a questo fazzoletto di cielo se ne nomina una sola, la più alta —
// se no si scrivono due etichette sopra allo stesso punto, che è il modo
// più veloce di far sembrare sbagliate anche quelle giuste.
const CIME_VICINE_AZ_GRADI = 0.45;
const CIME_VICINE_ALT_GRADI = 0.30;

const cime = {
  stato: 'niente',        // niente | in-corso | pronto | fallito
  lat: null, lon: null,
  elenco: [],             // { nome, lat, lon, quota, az, km }
  fonte: '',
  motivo: '',
  // Spente di partenza, e la scelta si ricorda (§9-bis): i nomi delle
  // montagne sono l'unica cosa di questo file che scrive sopra al cielo, e
  // chi apre il planetario la prima volta è venuto a vedere le stelle.
  acceso: raggi.nomiMonti,
  quandoFallito: 0,       // per non ritentare a raffica dopo un buco nell'acqua
  fallitoLat: null, fallitoLon: null,   // e dove era andata male: altrove si riprova subito
  // Le altezze apparenti si rifanno solo quando cambia qualcosa: la quota
  // dell'occhio o il profilo del terreno. Fra un fotogramma e l'altro no.
  vistaChiave: null,
  vista: []
};


// --- Da OpenStreetMap -------------------------------------------------

// Il rettangolo che contiene il cerchio di raggio `km`. Overpass gira una
// selezione per riquadro molto più in fretta di un `around` largo — che a
// centotrenta chilometri è la differenza fra una risposta e un 504 — e
// quello che avanza agli angoli lo taglia `cimePrepara`, che le distanze
// vere le misura comunque.
function terrenoRiquadro(lat, lon, km) {
  const dLat = km / 111.32;
  const dLon = km / (111.32 * Math.max(0.15, Math.cos(lat * Math.PI / 180)));
  return {
    s: Math.max(-90, lat - dLat), n: Math.min(90, lat + dLat),
    o: lon - dLon, e: lon + dLon
  };
}

// Due anelli, come per le città: le vette alte da lontano, tutte quelle
// che hanno un nome da vicino. Il filtro sulla quota si fa sul server —
// nelle Alpi un riquadro da centotrenta chilometri senza filtro risponde
// con qualche migliaio di punte, e la maggior parte sono spuntoni di
// cresta che nessuno guarda.
//
// Il `timeout` scritto qui dentro è quello che il server si dà; il nostro
// (`CIME_ATTESA_MS`) deve essere più lungo, se no tagliamo la corda
// mentre lui sta ancora lavorando.
function cimeQueryOverpass(lat, lon) {
  const la = lat.toFixed(4), lo = lon.toFixed(4);
  const largo = raggioCime();
  const r = terrenoRiquadro(lat, lon, largo);
  // L'anello vicino non può essere più largo della ricerca: chiedendo
  // venticinque chilometri di tutto dentro a un raggio di quindici si
  // prendono vette che poi `cimePrepara` butta via, e intanto la richiesta
  // è stata fatta.
  const vicino = Math.round(Math.min(CIME_RAGGIO_VICINE_KM, largo) * 1000);
  // A cavallo dell'antimeridiano il riquadro si spezza in due e Overpass
  // lo rifiuta: là si torna all'anello, che è lento ma sempre giusto.
  const lontane = (r.o < -180 || r.e > 180)
    ? `(around:${Math.round(largo * 1000)},${la},${lo})`
    : `(${r.s.toFixed(4)},${r.o.toFixed(4)},${r.n.toFixed(4)},${r.e.toFixed(4)})`;
  // Il filtro sulla quota vale solo per l'anello di fuori, e si abbassa
  // insieme al raggio: con quaranta chilometri di ricerca pretendere
  // millecinquecento metri vuol dire non trovare niente in Appennino.
  const quota = Math.round(Math.min(CIME_QUOTA_LONTANE_M, largo * 12));
  return '[out:json][timeout:25];(' +
    `node["natural"="peak"]["name"]["ele"](if:number(t["ele"]) > ${quota})${lontane};` +
    `node["natural"="peak"]["name"]["ele"](around:${vicino},${la},${lo});` +
    ');out body 900;';
}

// Il ripiego: le vette vicine e basta, senza filtri sulla quota. È corta,
// non usa `(if:)` e non chiede un riquadro grande, quindi passa anche
// quando la prima si è presa un 504 o un 429 — e le montagne di casa,
// che sono quelle che uno riconosce, ci sono comunque.
function cimeQueryVicina(lat, lon) {
  const la = lat.toFixed(4), lo = lon.toFixed(4);
  const km = Math.min(CIME_RAGGIO_RIPIEGO_KM, raggioCime());
  return '[out:json][timeout:20];' +
    `node["natural"="peak"]["name"]["ele"](around:${Math.round(km * 1000)},${la},${lo});` +
    'out body 300;';
}

function cimeLeggiNodi(elementi) {
  return elementi
    .filter(n => n && n.tags && n.tags.name && typeof n.lat === 'number')
    .map(n => {
      // La quota arriva come stringa, e ogni tanto con l'unità appiccicata
      // («1850 m») o con la virgola decimale
      const q = parseFloat(String(n.tags.ele).replace(',', '.').replace(/[^\d.\-]/g, ''));
      return { nome: n.tags.name, lat: n.lat, lon: n.lon, quota: q };
    })
    .filter(c => isFinite(c.quota));
}

async function cimeDaOverpass(lat, lon) {
  try {
    return cimeLeggiNodi(await overpassChiedi(cimeQueryOverpass(lat, lon), CIME_ATTESA_MS));
  } catch (e) {
    console.warn('Vette: la richiesta larga non è passata, riprovo con quelle vicine —', e.message);
    return cimeLeggiNodi(await overpassChiedi(cimeQueryVicina(lat, lon), CIME_ATTESA_MS));
  }
}

// Dove sta ognuna. L'altezza apparente qui non si calcola: dipende da dove
// si hanno i piedi e da che cresta c'è davanti, cioè da cose che possono
// arrivare dopo (il terreno è un'altra richiesta). Si fa in `cimeVisibili`.
function cimePrepara(grezze, lat, lon) {
  const viste = new Map();
  const limite = raggioCime();
  for (const c of grezze) {
    const km = terrenoDistanzaKm(lat, lon, c.lat, c.lon);
    if (km > limite || km < 0.05) continue;
    // Lo stesso monte compare più volte in OSM (la punta, la croce, la
    // cima secondaria): a parità di nome si tiene la più alta.
    const gia = viste.get(c.nome);
    if (gia && gia.quota >= c.quota) continue;
    viste.set(c.nome, {
      nome: c.nome, lat: c.lat, lon: c.lon, quota: c.quota,
      km, az: cittaAzimut(lat, lon, c.lat, c.lon)
    });
  }
  // Si tengono le più imponenti *da qui*: la quota sopra i piedi divisa
  // per la distanza è già l'angolo, a meno della curvatura, e ordinare per
  // quello vuol dire ordinare per quanto sono grosse all'orizzonte.
  return Array.from(viste.values())
    .sort((a, b) => (b.quota / (b.km + 4)) - (a.quota / (a.km + 4)))
    .slice(0, CIME_MAX);
}


// --- Tenersele --------------------------------------------------------

function cimeArchivio() {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_CIME) || 'null');
    if (v && Array.isArray(v.posti)) return v.posti;
  } catch (e) { /* niente storage, o roba illeggibile */ }
  return [];
}

function cimeLeggiSalvate(lat, lon) {
  return cimeArchivio().find(v => v && Array.isArray(v.elenco) && typeof v.lat === 'number' &&
    raggiSalvatoBuono(v, 'cime', CIME_RAGGIO_KM) &&
    terrenoDistanzaKm(lat, lon, v.lat, v.lon) <= CIME_RAGGIO_VALIDO_KM) || null;
}

function cimeSalva(lat, lon, elenco, fonte) {
  try {
    const posti = cimeArchivio().filter(v => v && typeof v.lat === 'number' &&
      terrenoDistanzaKm(lat, lon, v.lat, v.lon) > CIME_RAGGIO_VALIDO_KM);
    posti.unshift({
      lat, lon, fonte, quando: Date.now(), raggio: raggioCime(),
      elenco: elenco.map(c => ({ n: c.nome, a: +c.lat.toFixed(4), o: +c.lon.toFixed(4), q: Math.round(c.quota) }))
    });
    localStorage.setItem(CHIAVE_CIME, JSON.stringify({ posti: posti.slice(0, TERRENO_POSTI_SALVATI) }));
  } catch (e) { /* storage pieno: pazienza, si riscarica */ }
}

function cimeDalSalvato(v) {
  return v.elenco.map(c => ({ nome: c.n, lat: c.a, lon: c.o, quota: c.q }));
}

function cimeDimentica() {
  cime.stato = 'niente';
  cime.quandoFallito = 0;
  cime.fallitoLat = cime.fallitoLon = null;
  cime.elenco = [];
  cime.vista = [];
  cime.vistaChiave = null;
  cime.lat = cime.lon = null;
}


// --- L'innesco --------------------------------------------------------

function cimeApplica(lat, lon, grezze, fonte) {
  cime.lat = lat;
  cime.lon = lon;
  cime.elenco = cimePrepara(grezze, lat, lon);
  cime.vista = [];
  cime.vistaChiave = null;
  cime.fonte = fonte;
  cime.stato = 'pronto';
  cime.motivo = '';
  terrenoAggiornaPannello();
}

function cimeCarica(forza) {
  // Spente vuol dire spente anche in rete: la richiesta a Overpass è la
  // parte cara di questo modulo, e chi non ha chiesto i nomi delle
  // montagne non deve pagarla. Ad accenderle si riparte da qui.
  if (!cime.acceso) return Promise.resolve(false);

  const luogo = terrenoLuogo();
  if (!luogo) return Promise.resolve(false);
  const lat = luogo.lat, lon = luogo.lon;

  if (!forza && cime.stato === 'pronto' && cime.lat !== null &&
      terrenoDistanzaKm(lat, lon, cime.lat, cime.lon) <= CIME_RAGGIO_VALIDO_KM) {
    return Promise.resolve(true);
  }
  if (cime.stato === 'in-corso') return cime.promessa || Promise.resolve(false);
  // Ha appena fallito *per questo posto*: si aspetta prima di ridare
  // fastidio al servizio. Senza, ogni giro di `skyAggiornaOsservatore` (e
  // ce n'è più d'uno all'avvio) rilanciava la richiesta, e a un'istanza che
  // risponde 429 si finisce per chiedere sempre più spesso proprio quando
  // andrebbe lasciata in pace. L'attesa vale però solo dove era andata
  // male: chi sposta il cielo su un'altra città sta facendo una domanda
  // nuova, e ha diritto a un tentativo nuovo.
  if (!forza && cime.stato === 'fallito' &&
      Date.now() - (cime.quandoFallito || 0) < CIME_RIPROVA_DOPO_MS &&
      cime.fallitoLat !== null &&
      terrenoDistanzaKm(lat, lon, cime.fallitoLat, cime.fallitoLon) <= CIME_RAGGIO_VALIDO_KM) {
    return Promise.resolve(false);
  }

  if (!forza) {
    const salvate = cimeLeggiSalvate(lat, lon);
    if (salvate) {
      cimeApplica(salvate.lat, salvate.lon, cimeDalSalvato(salvate), salvate.fonte || 'salvato');
      return Promise.resolve(true);
    }
  }

  cime.stato = 'in-corso';
  cime.motivo = '';
  terrenoAggiornaPannello();

  // Le due richieste a Overpass — i paesi e le vette — non partono
  // insieme: è lo stesso servizio pubblico, e due colpi nello stesso
  // istante sono il modo più rapido per prendersi un «troppe richieste».
  cime.promessa = Promise.resolve(citta.promessa).catch(() => {})
    .then(() => cimeDaOverpass(lat, lon))
    .then(elenco => {
      cimeApplica(lat, lon, elenco, 'osm');
      if (!cime.elenco.length) {
        // Non è un errore: in mezzo alla pianura o in mezzo al mare le
        // montagne non ci sono, e dirlo è una risposta buona quanto un
        // elenco. Ma non vale la pena salvarla — basta un trasloco.
        cime.stato = 'pronto';
        cime.motivo = 'Qui attorno non ci sono vette con un nome.';
        terrenoAggiornaPannello();
        return true;
      }
      cimeSalva(lat, lon, cime.elenco, 'osm');
      return true;
    })
    .catch(e => {
      console.warn('Vette da OpenStreetMap non disponibili:', e);
      cime.stato = 'fallito';
      cime.quandoFallito = Date.now();
      cime.fallitoLat = lat;
      cime.fallitoLon = lon;
      // Il perché va detto: «serve la rete» a chi la rete ce l'ha è una
      // risposta che non aiuta, e la differenza fra un servizio occupato
      // (si riprova fra poco) e un guasto vero la si legge solo qui.
      cime.motivo = 'Non ho i nomi delle montagne: ' + (e && e.message ? e.message : 'OpenStreetMap non risponde') +
        '. Si riprova da sé fra qualche minuto.';
      terrenoAggiornaPannello();
      return false;
    })
    .finally(() => {
      cime.promessa = null;
      const ora = terrenoLuogo();
      if (ora && terrenoDistanzaKm(ora.lat, ora.lon, lat, lon) > CIME_RAGGIO_VALIDO_KM) {
        cimeCarica();
      }
    });

  return cime.promessa;
}


// --- Quello che serve al planetario -----------------------------------

// A che quota sta l'occhio: il suolo sotto i piedi, se il terreno vero
// c'è, più l'altezza di una persona. Senza terreno resta il livello del
// mare, che per chi sta in pianura è quasi giusto e per chi sta in
// montagna sbaglia dalla parte prudente (le vette sembrano più alte).
function cimeQuotaOcchio() {
  const suolo = typeof terreno.quota === 'number' ? terreno.quota : 0;
  return suolo + TERRENO_ALTEZZA_OCCHIO_M;
}

// Le vette che da qui si vedono davvero, con la loro altezza apparente.
// Il conto è lo stesso del terreno — `terrenoAngolo` — perché è la stessa
// domanda: sotto che angolo si vede un punto alto tot a tot chilometri.
//
// La cernita vera è la seconda riga: se la punta sta sotto la cresta del
// terreno in quella direzione, davanti c'è qualcosa che la nasconde. È il
// motivo per cui questo elenco è corto e quello di OpenStreetMap è lungo.
// Quella davanti nasconde quella dietro. La cernita è in due tempi: prima
// si tiene chi spunta sopra al terreno **che gli sta davanti**, poi si
// buttano i doppioni — due nomi per lo stesso dente d'orizzonte.
//
// Il primo passo è il cuore, ed è quello che è cambiato: prima si
// confrontava la punta con la cresta intera di quella direzione, cioè col
// massimo su tutte le distanze. Ma quel massimo comprende anche le
// montagne che stanno **dietro** alla vetta in esame, e una montagna dietro
// non nasconde niente — anzi, è proprio lo sfondo su cui la si vede.
// Guardando le Prealpi dalla pianura, ogni collina davanti finiva
// cancellata dalla cresta più alta che le stava alle spalle: sparivano
// esattamente le vette vicine, quelle che uno riconosce.
function cimeVisibili() {
  if (!cime.acceso || cime.stato !== 'pronto' || !cime.elenco.length) return [];
  const chiave = `${cimeQuotaOcchio().toFixed(1)}|${terrenoDisponibile() ? terreno.quando : 0}`;
  if (cime.vistaChiave === chiave) return cime.vista;

  const occhio = cimeQuotaOcchio();
  const spuntano = cime.elenco
    .map(c => Object.assign({}, c, { alt: terrenoAngolo(c.quota, occhio, c.km) }))
    .filter(c => {
      if (c.alt < CIME_ALT_MIN_GRADI) return false;
      const davanti = terrenoCrestaDavanti(c.az, c.km);
      // Senza le quote grezze non si sa cosa c'è davanti: si torna al
      // confronto con la cresta intera, che è severo ma non inventa niente.
      const cresta = davanti === null ? terrenoAltezza(c.az) : davanti;
      return cresta === null || c.alt >= cresta - CIME_SOTTO_CRESTA_GRADI;
    })
    .sort((a, b) => b.alt - a.alt);

  // Dalla più imponente in giù: chi arriva dopo e cade dentro al fazzoletto
  // di una già tenuta è la stessa punta con un altro nome.
  const tenute = [];
  for (const c of spuntano) {
    const doppione = tenute.some(t => {
      const dAz = Math.abs(((c.az - t.az + 540) % 360) - 180);
      return dAz < CIME_VICINE_AZ_GRADI && Math.abs(c.alt - t.alt) < CIME_VICINE_ALT_GRADI;
    });
    if (!doppione) tenute.push(c);
  }

  cime.vista = tenute;
  cime.vistaChiave = chiave;
  return cime.vista;
}

function cimeAlterna() {
  cime.acceso = !cime.acceso;
  // La scelta si ricorda: chi le accende non vuole riaccenderle domani, e
  // chi le lascia spente non vuole ritrovarsele.
  raggi.nomiMonti = cime.acceso;
  raggiSalva();
  if (typeof costruisciRaggiOrizzonte === 'function') costruisciRaggiOrizzonte();
  // Accendendolo a mano si riprova subito, anche se la volta prima era
  // andata male: un tasto premuto è una richiesta esplicita, e l'attesa di
  // cortesia verso il servizio vale per i tentativi automatici, non per
  // quello di chi sta lì a guardare.
  if (cime.acceso && cime.stato !== 'pronto') cimeCarica(cime.stato === 'fallito');
  terrenoAggiornaPannello();
}

function cimeTesto() {
  if (!cime.acceso) return 'Nomi delle montagne spenti.';
  if (cime.stato === 'niente') return `Accesi: cerco le vette entro ${raggioCime()} km…`;
  if (cime.stato === 'in-corso') return 'Sto cercando le montagne qui attorno…';
  if (cime.stato === 'fallito') return cime.motivo;
  if (cime.stato !== 'pronto') return '';
  if (cime.motivo) return cime.motivo;

  const viste = cimeVisibili();
  // Due silenzi diversi, e vale la pena distinguerli: «non ci sono
  // montagne» è un fatto del posto, «ci sono ma non si vedono» è un fatto
  // dell'orizzonte — e la seconda è la risposta a «perché non leggo niente».
  if (!viste.length) {
    return cime.elenco.length
      ? `Le ${cime.elenco.length} vette entro ${raggioCime()} km restano tutte dietro alla prima cresta: da qui non se ne vede nessuna.`
      : `Nessuna vetta con un nome entro ${raggioCime()} km: nelle Impostazioni puoi allargare la ricerca.`;
  }
  const prima = viste[0];
  const dove = typeof skyNomeDirezione === 'function' ? skyNomeDirezione(prima.az) : '';
  return `Sopra l'orizzonte si riconoscono ${viste.length} vette entro ${raggioCime()} km: la più imponente è ${prima.nome} ` +
    `(${Math.round(prima.quota)} m), a ${prima.km.toFixed(0)} km verso ${dove}, alta ${prima.alt.toFixed(1)}°.`;
}

function cimeAggiornaTasto() {
  const tasto = document.getElementById('skymap-btn-cime');
  if (!tasto) return;
  tasto.classList.toggle('attiva', cime.acceso);
  tasto.setAttribute('aria-pressed', cime.acceso ? 'true' : 'false');
  tasto.textContent = cime.stato === 'in-corso' ? 'Nomi dei monti…' : 'Nomi dei monti';
}
