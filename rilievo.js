// =====================================================================
// IL RILIEVO — la forma del terreno, non la sua sagoma
//
// `terreno.js` risponde a «quanto è alto l'orizzonte da quella parte», e
// la risposta è una **cresta**: il massimo lungo una direzione, accumulato
// andando avanti. Da quel numero il planetario ricava la veduta a piani —
// le dorsali una dietro l'altra, come una carta panoramica disegnata a
// mano — ed è una buona risposta a una buona domanda.
//
// Ma un massimo accumulato non può scendere. È monotono per costruzione, e
// quella proprietà è insieme il suo pregio e il suo limite: regala
// l'occlusione (la collina davanti copre sempre la catena dietro) e in
// cambio cancella tutto ciò che sta **sotto** al bordo. La conca che si
// apre davanti, il fianco della valle che scende, il taglio del fiume in
// fondo: in quel numero non esistono più: se li è mangiati il massimo del
// bordo. Da lì la cosa che si vede sullo schermo — dei ritagli di carta
// impilati — e la domanda a cui quel disegno non sa rispondere: «che forma
// ha davvero il terreno qui attorno».
//
// Qui la risposta è un'altra: una **superficie**. Una maglia polare
// centrata sull'occhio — settecentoventi direzioni per novantasei anelli di
// distanza — di cui si conosce la quota in ogni nodo, e che si disegna come
// si disegna una superficie: nodo per nodo, con l'ombreggiatura che viene
// dalla sua pendenza. Le valli scendono perché nella maglia scendono
// davvero.
//
// Due cose la rendono possibile, e sono tutt'e due sorprendenti.
//
// **L'occlusione è gratis.** In una maglia parametrizzata per (azimut,
// distanza) *a partire dall'occhio*, lungo un raggio i nodi si incontrano
// in ordine di distanza. Disegnando dagli anelli lontani verso i vicini,
// quello che sta davanti si dipinge sopra a quello che sta dietro — e
// l'ordine di profondità è esatto, non approssimato. Nessuno z-buffer,
// nessun ordinamento: è il pittore, ed è il motivo per cui questa scena
// costa quanto una campitura.
//
// **Le quote non si chiedono più a punti.** Ventiquattro richieste da cento
// coordinate fanno duemila e quattrocento quote, e non bastano nemmeno per
// il prato qui davanti: per vedere un fiume ne servono decine di migliaia,
// che a cento per volta sono centinaia di richieste — cioè il 429 di §4
// moltiplicato per dieci. Le quote però si vendono anche in un'altra forma,
// ed è quella giusta: una **tessera raster**, un PNG in cui ogni pixel è una
// quota. Una sola richiesta ne porta 65.536. Le tessere di AWS Terrain Tiles
// (le vecchie Mapzen) non vogliono nessuna chiave, hanno il CORS aperto —
// quindi si possono leggere dentro a un canvas — e a zoom 12 danno
// ventisette metri di passo alle nostre latitudini. Quattro o nove tessere,
// e il terreno per sei chilometri attorno è tutto lì.
//
// Cosa **non** fa, ed è giusto saperlo prima di cercarlo:
//
//   - oltre il raggio delle tessere (sei chilometri) la maglia continua, ma
//     le quote le legge dalla griglia grossa di `terreno.js` — tre gradi di
//     passo. Lo sfondo resta quindi più liscio del primo piano. È una scelta
//     di peso: le tessere per sessanta chilometri sarebbero due megabyte, e
//     a quella distanza la foschia ha già impastato tutto quello che i tre
//     gradi non risolvono.
//   - non conosce i palazzi né gli alberi, come tutto il resto di questo
//     modulo: il DEM è il suolo.
//   - non inventa niente. Il rilievo finto di `app.js` (`SKY_RILIEVO`)
//     serviva a dare una dentellatura a un profilo che non ce l'aveva, e
//     dove la maglia disegna non si applica: la roccia adesso è misurata.
//
// La cresta che ne esce è **la stessa** che decide se un astro è sorto:
// `terrenoAltezza` la preferisce al profilo grosso quando c'è
// (`rilAltezza`), e `rilFronteA` prende il posto di `terrenoFronteA` per
// l'occlusione dei laghi e delle vette. Due creste calcolate due volte
// divergerebbero proprio sui denti, cioè dove si appendono i nomi delle
// montagne — è la stessa ragione per cui `terrenoMonta` ricava le creste
// dall'ultima colonna delle creste parziali invece di rifarle.
//
// Ordine di caricamento: **dopo `terreno.js`** (ne usa le costanti, la
// geometria e la griglia grossa) e dopo `app.js` (`skyProietta`,
// `skyMescolaColore`, `sky`). Se questo file non c'è, l'app è esattamente
// quella di prima: tutti gli agganci sono guardati da un `typeof`.
// =====================================================================


// =====================================================================
// 1. LE MISURE
// =====================================================================

// Lo zoom delle tessere. Dodici, e non è una scelta di gusto: a queste
// latitudini fa ventisette metri per pixel, che è il passo nativo del
// modello del suolo sotto (SRTM a un arcosecondo). Tredici darebbe tessere
// quattro volte più pesanti per ingrandire gli stessi dati.
const RIL_ZOOM = 12;

// Fin dove arrivano le tessere fini. Sei chilometri sono il primo piano —
// dove la conformazione si legge e dove sta la valle che si ha davanti — e
// il disco che ne esce costa da quattro a nove tessere. Dodici chilometri
// costerebbero il quadruplo.
const RIL_RAGGIO_KM = 6;

// Il tetto delle tessere, che è un tetto di **peso**: in montagna una
// tessera pesa centoventi kilobyte, e nove sono poco più di un megabyte
// scaricato una volta sola per luogo e poi tenuto dal service worker. Oltre
// quel numero il raggio si stringe invece di scaricare di più.
const RIL_TESSERE_MAX = 9;

// Dove le due fonti si danno il cambio. La griglia grossa e le tessere
// vengono da due modelli del suolo diversi e sullo stesso punto non danno
// lo stesso metro: passando di netto si vedrebbe un gradino ad anello tutto
// attorno. Nell'ultimo chilometro si mescolano.
const RIL_SFUMA_KM = 1.2;

// Di quanto al massimo si sposta il riferimento delle tessere per metterlo
// d'accordo con quello della griglia grossa (vedi `rilCostruisciMaglia`).
// Cento metri sono molto più di qualunque disaccordo vero fra due modelli
// del suolo: oltre, non è un disaccordo, è una delle due che parla di
// un'altra collina — e allora è meglio non spostare niente.
const RIL_SCARTO_MAX = 100;

// La maglia. Mezzo grado di passo in azimut: a due chilometri sono diciassette
// metri di terreno, cioè più fine dei ventisette che le tessere sanno dire —
// che è la condizione perché a limitare il disegno sia il dato e non la
// griglia.
const RIL_AZIMUT = 720;
const RIL_PASSO_AZ = 360 / RIL_AZIMUT;

// Gli anelli sono spaziati **in proporzione** e non in metri, e la ragione è
// che l'occhio li vede così: su terreno piatto la depressione di un anello a
// distanza s vale circa h/s, quindi una progressione geometrica in distanza è
// una progressione geometrica in angolo — passi angolari sempre della stessa
// taglia relativa, dai venticinque metri sotto i piedi ai sessanta
// chilometri dell'ultima catena. Con passi costanti in metri, novantasei
// anelli finirebbero tutti dentro al primo grado sotto l'orizzonte e sotto i
// piedi non ci sarebbe niente.
const RIL_ANELLI_LONTANI = 96;
const RIL_VICINO_M = 25;
const RIL_LONTANO_M = 60000;

// E poi il **grembiule**: dieci anelli sotto ai venticinque metri, fino a
// quindici centimetri dalle scarpe.
//
// Non è pignoleria, è un buco che si vede. La maglia disegnata a partire dai
// venticinque metri si ferma a dodici gradi sotto l'orizzonte — più giù non
// c'è niente, e sotto ci resta il gradiente del suolo, che è di un altro
// colore. Su un panorama di valle quel confine cade in mezzo allo schermo:
// misurato a Como con un campo di quarantacinque gradi, era un cuneo pallido
// grande un quarto dell'immagine, con lo spigolo netto. E guardando in giù
// diventa quasi tutto lo schermo.
//
// Il terreno lì sotto non lo dice nessun modello — venticinque metri sono
// meno di una cella — ma una cosa la si sa: sotto i piedi il suolo è al
// livello dei propri piedi. Il grembiule dice quello, e basta a chiudere il
// disegno fino al nadir.
const RIL_PIEDI_M = 0.15;
const RIL_ANELLI_PIEDI = 10;
const RIL_ANELLI = RIL_ANELLI_PIEDI + RIL_ANELLI_LONTANI;

// Le distanze degli anelli, in metri. Si calcolano una volta sola.
//
// Geometriche in tutt'e due i tratti, con la stessa ragione: su terreno
// piatto la depressione di un anello vale circa h/s, quindi una progressione
// geometrica in distanza è una progressione geometrica in **angolo** — passi
// sempre della stessa taglia relativa, che è come li vede l'occhio.
const RIL_DIST = (() => {
  const a = new Float64Array(RIL_ANELLI);
  const rp = Math.pow(RIL_VICINO_M / RIL_PIEDI_M, 1 / RIL_ANELLI_PIEDI);
  for (let k = 0; k < RIL_ANELLI_PIEDI; k++) a[k] = RIL_PIEDI_M * Math.pow(rp, k);
  const r = Math.pow(RIL_LONTANO_M / RIL_VICINO_M, 1 / (RIL_ANELLI_LONTANI - 1));
  for (let k = 0; k < RIL_ANELLI_LONTANI; k++) {
    a[RIL_ANELLI_PIEDI + k] = RIL_VICINO_M * Math.pow(r, k);
  }
  return a;
})();

// Il nadir esatto, in stereografica, è l'antipodo del centro della vista: il
// punto che la proiezione manda all'infinito. Ottantacinque gradi sono la
// stessa tosatura di `ACQUE_DEP_MAX_GRADI` (§12 di `terreno.js`), e per la
// stessa ragione.
const RIL_DEP_MAX = 85;

// Sotto che angolo si vede un punto del terreno.
//
// È la stessa identica formula di `terrenoAngolo` (§3 di `terreno.js`) —
// curvatura e rifrazione comprese — con una differenza sola, e sta nel
// limite vicino. Quella tosa la **distanza** a cinquanta metri, perché sotto
// quella misura il modello del suolo non ha nessun dato da difendere e una
// `atan2` a distanza zero risponde novanta gradi anche per un dosso di due
// metri. Qui si tosa l'**angolo**: il grembiule sta a quindici centimetri
// dai piedi di proposito, e tosandone la distanza a cinquanta metri il suolo
// sotto le scarpe finirebbe disegnato a due gradi sotto l'orizzonte, con
// sotto di lui il vuoto. È lo stesso ragionamento — e la stessa scelta — di
// `acqueDepressione`, che l'acqua ce l'ha davvero sotto i piedi.
//
// Sopra ai centocinquanta metri, cioè per ogni anello che porta un'informazione
// vera del modello, le due funzioni danno lo stesso numero cifra per cifra:
// è la condizione perché la cresta di questa maglia e quella del profilo
// grosso raccontino lo stesso orizzonte.
function rilAngolo(quota, occhio, metri) {
  const s = Math.max(0.05, metri);
  const abbassa = (1 - TERRENO_RIFRAZIONE) * s * s / (2 * TERRENO_RAGGIO_KM * 1000);
  const a = Math.atan2(quota - occhio - abbassa, s) * 180 / Math.PI;
  // In basso si tosa, in alto **no**. Il tetto di `TERRENO_ALT_MAX` è una
  // regola della *cresta* — «oltre sessanta gradi non è più un orizzonte, è
  // una parete, e quasi sempre è un dato sbagliato» — e sta dov'è sempre
  // stata, in `rilAltezza`. Applicarla qui vorrebbe dire spianare la parete
  // di roccia che uno ha davvero davanti, e soprattutto far divergere questa
  // funzione da `terrenoAngolo` proprio sui dislivelli grossi: dove il
  // terreno è ripido, cioè dove sbagliare si vede.
  return Math.max(-RIL_DEP_MAX, a);
}

// Il mare, nelle tessere, è **batimetria**: il fondale vero, fino a meno
// ottomila. Disegnarlo vorrebbe dire un cratere al posto del golfo. Le altre
// fonti di quote (Copernicus, SRTM così come lo servono Open-Meteo e gli
// altri) sull'acqua rispondono zero, quindi tosare a zero non è solo giusto
// da vedere: è quello che tiene d'accordo le due fonti nella fascia in cui
// si mescolano. Il prezzo sono i pochi metri sotto il livello del mare dei
// polder e delle depressioni continentali, che a un orizzonte non cambiano
// niente.
const RIL_QUOTA_MIN = 0;

// Quanti nodi si possono proiettare in un fotogramma. È il bilancio di
// questa vista: il catalogo delle stelle ne proietta cinquemila ed è la voce
// più cara del ciclo, quindi la maglia non può permettersene molti di più.
// Sopra questo numero si dirada — prima gli anelli, che sono quelli che si
// vedono meno.
const RIL_NODI_MAX = 15000;

// Quanto largo dev'essere un quadretto sullo schermo perché valga la pena
// disegnarlo. Sotto ai due pixel non è più una faccia del terreno: è rumore
// che costa quanto una faccia.
const RIL_PX_MIN = 2;

// I livelli di chiaroscuro. Le facce contigue con lo stesso livello si
// disegnano in un poligono solo — è la stessa economia dei ventiquattro
// gradini del mare: senza, ogni quadretto sarebbe un `fill()` e sarebbero
// migliaia.
//
// Erano dodici, e si vedevano: su un fianco di collina, dove la pendenza
// cambia poco e lentamente, dodici livelli non fanno una rampa — fanno una
// dozzina di terrazze larghe mezzo schermo, con lo spigolo netto in mezzo.
// La banda si vede quando il gradino fra due livelli supera i due o tre
// livelli su 255, e con il chiaroscuro di qui (`RIL_OMBRA` più
// `RIL_SCHIARITA`, cioè poco più di metà scala) trentadue sono il numero
// che ci sta sotto. Il conto lo pagano i riempimenti, che crescono meno di
// quanto sembri: le facce si accorpano lo stesso, solo in gruppi più corti.
const RIL_LIVELLI = 24;

// L'ombreggiatura: quanto si vede una faccia che non prende luce, e quanto
// la luce la scolpisce. La somma sta sotto a uno e mezzo di proposito — il
// terreno non deve mai diventare più chiaro del cielo dietro di lui, se no
// il profilo smette di leggersi.
const RIL_AMBIENTE = 0.62;
const RIL_MODELLATO = 0.5;

// Di notte una luce non c'è. Un panorama vero, senza Luna, è una silhouette
// nera — ed è giusto così in cielo, ma qui la maglia esiste per far
// riconoscere *dove si sta puntando*, e una silhouette nera non lo fa. Resta
// allora una luce di servizio, appesa alla telecamera e inclinata in alto a
// sinistra: non racconta nessun sole (non ne indica la direzione, perché si
// muove con chi guarda) e basta a far leggere la forma. La stessa scelta
// delle carte panoramiche stampate, che un sole non ce l'hanno.
//
// Quanto scava di notte non lo decide lei ma `RIL_SCHIARITA_NOTTE`: la
// direzione è una cosa, la forza è un'altra, e tenerle separate è ciò che
// permette al chiaroscuro di usare la tavolozza intera anche col Sole sotto
// l'orizzonte.


// =====================================================================
// 2. LO STATO
// =====================================================================

const rilievo = {
  // Acceso lo decide `raggi.rilievo` (§9-bis di `terreno.js`), che è dove
  // stanno già gli altri interruttori del paesaggio e che finisce nel
  // backup. Qui si tiene solo la copia di lavoro.
  acceso: (typeof raggi !== 'undefined' && typeof raggi.rilievo === 'boolean')
    ? raggi.rilievo : true,

  // La maglia, quando c'è.
  quota: null,        // Float32Array(720×96): metri sul livello del mare
  alt: null,          // Float32Array(720×96): sotto che angolo si vede quel nodo
  cresta: null,       // Float32Array(720): il massimo lungo ogni raggio
  fronti: null,       // Float32Array(720×18): il massimo entro TERRENO_DISTANZE[k]
  minAlt: null,       // Float32Array(96): il nodo più basso di ogni anello
  maxAlt: null,       // Float32Array(96): e il più alto — servono a scartare
                      // in blocco gli anelli fuori dal riquadro

  // Per quale posto vale, e con che occhio. La chiave dice tutto quello che
  // la maglia contiene: cambiandone anche un pezzo va rifatta.
  chiave: null,
  lat: null,
  lon: null,
  occhio: 0,
  fini: 0,            // quante direzioni hanno davvero letto una tessera
  scarto: 0,          // di quanto si sono spostate le tessere per accordarsi
                      // alla griglia grossa, in metri

  stato: 'spento',    // 'spento' | 'in-corso' | 'pronto' | 'guaio'
  motivo: '',
  avanzamento: 0,
  tessereChieste: 0,
  tessereAvute: 0,
  inCostruzione: false,
  daRifare: false,

  // Ha disegnato lui questo fotogramma? Lo chiedono i laghi e i nomi delle
  // montagne, che devono sapere **dove il terreno è dipinto** e non dove il
  // modello dice che sta. Con la maglia le due cose coincidono — non c'è
  // nessun rilievo finto che morde la cresta — ma chi chiama non lo sa, e la
  // domanda resta la stessa di prima.
  hoDisegnato: false,

  // Il conto dell'ultimo fotogramma: quante colonne, quanti anelli tenuti,
  // quanti riempimenti e quanti millisecondi. Non è una curiosità — è il
  // bilancio di questa vista, e senza di lui accorgersi che la maglia è
  // diventata cara vuol dire aspettare che qualcuno segnali «va a scatti».
  ultimo: { colonne: 0, anelli: 0, riempimenti: 0, ms: 0 }
};

// Le tessere già decodificate, per questo luogo. Chiave `x/y`, valore una
// `Float32Array(256×256)` di metri, oppure `null` se quella tessera non è
// arrivata — che è un'informazione anche quella: dice di non richiederla e
// di ripiegare sulla griglia grossa.
let rilTessere = new Map();


// =====================================================================
// 3. IL MERCATORE
//     Le tessere stanno sulla proiezione di Mercatore sferica, che è quella
//     di tutte le mappe a tessere del mondo. Servono tre conti e nient'altro.
// =====================================================================

// Dove cade un punto nel piano dei pixel del mondo, a un dato zoom.
function rilPixelMondo(lat, lon, z) {
  const n = 256 * Math.pow(2, z);
  const la = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
  return {
    px: (lon + 180) / 360 * n,
    py: (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * n
  };
}

// Quanti metri di terreno vale un pixel, a quella latitudine.
function rilMetriPerPixel(lat, z) {
  return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z);
}

// Le tessere che coprono il disco di raggio `km` attorno al punto, dalla più
// vicina alla più lontana.
//
// Il disco e non un blocco quadrato: gli angoli di un 3×3 stanno per metà
// fuori dal raggio, e sono tessere intere scaricate per niente. E in ordine
// di distanza perché la prima che arriva è quella sotto i piedi, che è
// quella che cambia di più il disegno.
//
// Il conto degli offset è in pixel e non in gradi. Alle nostre latitudini,
// su sei chilometri, la differenza fra il Mercatore e il terreno vero è di
// pochi metri (la scala della proiezione cambia come 1/cos φ, cioè di tre
// decimillesimi in sei chilometri): meno di un decimo di pixel di tessera.
function rilTessereAttorno(lat, lon, km) {
  const mpp = rilMetriPerPixel(lat, RIL_ZOOM);
  const raggioPx = km * 1000 / mpp;
  const o = rilPixelMondo(lat, lon, RIL_ZOOM);
  const n = Math.pow(2, RIL_ZOOM);
  const x0 = Math.floor((o.px - raggioPx) / 256);
  const x1 = Math.floor((o.px + raggioPx) / 256);
  const y0 = Math.floor((o.py - raggioPx) / 256);
  const y1 = Math.floor((o.py + raggioPx) / 256);
  const fuori = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue;
      // Quanto dista il punto dal rettangolo della tessera: zero se ci sta
      // dentro. Se è più del raggio, quella tessera il disco non lo tocca.
      const dx = Math.max(x * 256 - o.px, 0, o.px - (x + 1) * 256);
      const dy = Math.max(y * 256 - o.py, 0, o.py - (y + 1) * 256);
      const d = Math.hypot(dx, dy);
      if (d > raggioPx) continue;
      fuori.push({ x: ((x % n) + n) % n, y, d });
    }
  }
  fuori.sort((a, b) => a.d - b.d);
  return fuori;
}


// =====================================================================
// 4. PRENDERE UNA TESSERA
//
//     AWS Terrain Tiles, formato «terrarium»: un PNG in cui ogni pixel è
//     una quota, scritta sui tre canali come
//     `(R·256 + G + B/256) − 32768` — cioè un fisso a sedici bit più otto
//     bit di frazione, con lo zero spostato a metà scala perché le quote
//     negative esistono.
//
//     Niente chiave, niente account, `Access-Control-Allow-Origin: *` — ed
//     è quest'ultima la cosa che rende tutto possibile: senza il CORS
//     aperto, un'immagine disegnata su un canvas lo **contamina** e
//     `getImageData` smette di funzionare, cioè i pixel non si potrebbero
//     leggere. È il motivo per cui non si può fare la stessa cosa con una
//     tessera qualunque presa da una mappa qualunque.
//
//     Il service worker le tiene, con la stessa regola delle quote a punti:
//     una collina è dove era.
// =====================================================================

const RIL_TESSERA_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const RIL_TESSERA_TIMEOUT_MS = 20000;

// Quante se ne chiedono insieme. Un browser ne apre comunque sei per host, e
// chiederne nove in un colpo vuol dire solo tenere tre richieste in attesa
// nella coda del browser invece che nella nostra — dove almeno si può
// decidere l'ordine, e l'ordine qui conta (le vicine prima).
const RIL_INSIEME = 4;

function rilCanaleQuota(r, g, b) {
  return Math.max(RIL_QUOTA_MIN, (r * 256 + g + b / 256) - 32768);
}

// Il canvas di servizio è uno solo e si riusa: crearne uno per tessera vuol
// dire nove tele da 256×256 da far raccogliere al garbage collector, e su un
// telefono si sente.
let rilTela = null;

function rilDecodifica(img) {
  const lato = img.naturalWidth || 256;
  if (!rilTela) rilTela = document.createElement('canvas');
  if (rilTela.width !== lato) { rilTela.width = lato; rilTela.height = lato; }
  const ctx = rilTela.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, lato, lato);
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, lato, lato).data;
  const q = new Float32Array(lato * lato);
  for (let i = 0, j = 0; i < q.length; i++, j += 4) {
    q[i] = rilCanaleQuota(d[j], d[j + 1], d[j + 2]);
  }
  return { lato, q };
}

function rilChiediTessera(x, y) {
  return new Promise((risolvi, rifiuta) => {
    const img = new Image();
    // Senza questo il canvas si contamina e `getImageData` solleva
    // un'eccezione di sicurezza: è la riga da cui dipende tutto il file.
    img.crossOrigin = 'anonymous';
    const sveglia = setTimeout(() => {
      img.src = '';
      rifiuta(new Error('tessera lenta'));
    }, RIL_TESSERA_TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(sveglia);
      try { risolvi(rilDecodifica(img)); } catch (e) { rifiuta(e); }
    };
    img.onerror = () => {
      clearTimeout(sveglia);
      rifiuta(new Error('tessera non arrivata'));
    };
    img.src = `${RIL_TESSERA_URL}/${RIL_ZOOM}/${x}/${y}.png`;
  });
}

// Tutte quelle che servono, a scaglioni di `RIL_INSIEME`. Una che non arriva
// non fa cadere le altre: resta un buco, e lì la maglia legge la griglia
// grossa — che è esattamente il terreno che c'era prima di questo file.
async function rilPrendiTessere(elenco) {
  rilievo.tessereChieste = elenco.length;
  rilievo.tessereAvute = 0;
  rilievo.avanzamento = 0;
  let lato = 256;
  for (let i = 0; i < elenco.length; i += RIL_INSIEME) {
    const gruppo = elenco.slice(i, i + RIL_INSIEME);
    await Promise.all(gruppo.map(t => rilChiediTessera(t.x, t.y).then(
      d => { rilTessere.set(`${t.x}/${t.y}`, d.q); lato = d.lato; },
      () => { rilTessere.set(`${t.x}/${t.y}`, null); }
    ).then(() => {
      rilievo.tessereAvute++;
      rilievo.avanzamento = rilievo.tessereAvute / Math.max(1, rilievo.tessereChieste);
      if (typeof terrenoAggiornaPannello === 'function') terrenoAggiornaPannello();
    })));
  }
  return lato;
}


// =====================================================================
// 5. LA QUOTA DI UN PUNTO
// =====================================================================

// Il lato in pixel delle tessere di questo luogo. È 256 per il formato
// terrarium, ma leggerlo dall'immagine invece di darlo per scontato costa
// una riga e salva dal giorno in cui il servizio comincia a servirle a 512.
let rilLatoTessera = 256;

// Quante tessere fa il giro del mondo a questo zoom. Serve per il meridiano
// a 180°, che è l'unico posto in cui la x di una tessera va riportata dentro
// al giro — chi osserva da lì lo fa una volta ogni mai, ma senza questa riga
// vedrebbe metà orizzonte piatto.
const RIL_GIRO_TESSERE = Math.pow(2, RIL_ZOOM);

// La quota di un pixel del mondo, o `null` se la sua tessera non c'è.
function rilPixel(x, y) {
  const L = rilLatoTessera;
  const tx = Math.floor(x / L), ty = Math.floor(y / L);
  const t = rilTessere.get(`${((tx % RIL_GIRO_TESSERE) + RIL_GIRO_TESSERE) % RIL_GIRO_TESSERE}/${ty}`);
  if (!t) return null;
  const ix = x - tx * L, iy = y - ty * L;
  if (ix < 0 || iy < 0 || ix >= L || iy >= L) return null;
  return t[iy * L + ix];
}

// La quota alle coordinate di pixel `(px, py)`, interpolata fra i quattro
// pixel attorno.
//
// Bilineare e non «il pixel più vicino», e non è raffinatezza: gli anelli
// vicini della maglia stanno a nove metri l'uno dall'altro e le tessere
// danno un valore ogni ventisette, quindi tre anelli di fila leggerebbero lo
// stesso identico numero e il terreno sotto i piedi verrebbe a gradoni —
// esattamente l'aliasing da campionamento radiale che `terreno.js` combatte
// con due filtri (§5). Qui non serve nessun filtro, basta non introdurlo.
function rilQuotaTessere(px, py) {
  const x = px - 0.5, y = py - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const a = rilPixel(x0, y0);
  if (a === null) return null;
  const b = rilPixel(x0 + 1, y0);
  const c = rilPixel(x0, y0 + 1);
  const d = rilPixel(x0 + 1, y0 + 1);
  if (b === null || c === null || d === null) return a;
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

// La quota dalla griglia grossa di `terreno.js`: centoventi direzioni per
// diciotto distanze. Serve oltre il raggio delle tessere, e come rete sotto
// a ogni tessera che non è arrivata.
//
// Si interpola in azimut e **in logaritmo di distanza**, perché in logaritmo
// le diciotto distanze sono quasi equispaziate: interpolando in metri, fra i
// trentaquattro e i quarantacinque chilometri il peso resterebbe incollato
// al campione più vicino per tre quarti dell'intervallo.
function rilQuotaGriglia(azGradi, metri) {
  if (typeof terreno === 'undefined' || !terreno.quote) return null;
  const nd = TERRENO_DISTANZE.length;
  const km = metri / 1000;

  // Più vicino del primo campione, la griglia grossa **non sa niente** — e
  // la cosa da non fare è estrapolarla all'indietro. È il difetto che si è
  // visto per primo aprendo il planetario a Como: gli anelli fra i
  // venticinque e i centocinquanta metri leggevano la quota misurata a
  // centocinquanta e la appoggiavano a cinquanta, cioè mettevano il fianco
  // della collina dentro al giardino. L'orizzonte a sud-ovest veniva
  // quarantotto gradi, che è una parete verticale alta come il Cervino a
  // due passi da casa — e nei numeri è una `atan2` perfettamente sensata.
  //
  // Quello che invece si sa per certo è la quota **sotto i piedi**: è
  // `terreno.quota`, la misura del punto in cui si sta. Fra lei e il primo
  // campione si interpola, che è la sola cosa onesta da dire di un terreno
  // che non si è misurato — e appena arriva una tessera, questa riga non
  // conta più niente perché a quelle distanze c'è il dato vero.
  if (km < TERRENO_DISTANZE[0]) {
    const sotto = typeof terreno.quota === 'number' ? terreno.quota : null;
    const primo = rilQuotaGrigliaA(azGradi, 0);
    if (primo === null) return sotto;
    if (sotto === null) return primo;
    const t = Math.max(0, km / TERRENO_DISTANZE[0]);
    return sotto + (primo - sotto) * t;
  }

  let k = 0;
  while (k < nd - 2 && TERRENO_DISTANZE[k + 1] < km) k++;
  const d0 = TERRENO_DISTANZE[k], d1 = TERRENO_DISTANZE[k + 1];
  const v = Math.max(0, Math.min(1,
    Math.log(Math.max(km, d0 * 0.001) / d0) / Math.log(d1 / d0)));

  const dove = (((azGradi % 360) + 360) % 360) / TERRENO_PASSO_AZ;
  const i = Math.floor(dove) % TERRENO_DIREZIONI;
  const j = (i + 1) % TERRENO_DIREZIONI;
  const u = dove - Math.floor(dove);

  const q = terreno.quote;
  const a = q[i * nd + k], b = q[j * nd + k];
  const c = q[i * nd + k + 1], e = q[j * nd + k + 1];
  if (typeof a !== 'number' || typeof b !== 'number' ||
      typeof c !== 'number' || typeof e !== 'number') return null;
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
}


// La quota della griglia grossa a un indice di distanza esatto, interpolata
// nel solo azimut. È il mattone di `rilQuotaGriglia`, tirato fuori perché
// serve anche da solo — al primo campione, dove la distanza non si interpola
// affatto.
function rilQuotaGrigliaA(azGradi, k) {
  const nd = TERRENO_DISTANZE.length;
  const dove = (((azGradi % 360) + 360) % 360) / TERRENO_PASSO_AZ;
  const i = Math.floor(dove) % TERRENO_DIREZIONI;
  const j = (i + 1) % TERRENO_DIREZIONI;
  const u = dove - Math.floor(dove);
  const a = terreno.quote[i * nd + k], b = terreno.quote[j * nd + k];
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  return a * (1 - u) + b * u;
}


// =====================================================================
// 6. LA MAGLIA
// =====================================================================

// Quanto pesa la tessera rispetto alla griglia grossa, a quella distanza.
// Uno fin quasi al raggio, poi giù a zero con una curva a S — un passaggio
// lineare lascia due pieghe visibili (la derivata salta), e su una superficie
// ombreggiata una piega si legge come un crinale che non c'è.
function rilPesoTessere(metri) {
  const fine = RIL_RAGGIO_KM * 1000;
  const inizio = fine - RIL_SFUMA_KM * 1000;
  if (metri <= inizio) return 1;
  if (metri >= fine) return 0;
  const t = 1 - (metri - inizio) / (fine - inizio);
  return t * t * (3 - 2 * t);
}

// La chiave dice tutto ciò da cui la maglia dipende. Cambiandone un pezzo va
// rifatta: il posto (ovvio), la quota dell'occhio — che è il termine
// sottratto a **tutti** gli angoli, quindi venti metri sbagliati storcono
// l'orizzonte intero — e il momento in cui la griglia grossa è cambiata,
// perché è lei a dare lo sfondo.
function rilChiaveDi(lat, lon, occhio) {
  return `${lat.toFixed(4)},${lon.toFixed(4)},${Math.round(occhio * 10)},${terreno.quando || 0}`;
}

// Dalle tessere e dalla griglia alla superficie. È il cuore del file, ed è
// un ciclo doppio senza niente di astuto dentro: settecentoventi direzioni
// per novantasei anelli, e per ognuno una quota e l'angolo sotto cui lo si
// vede.
//
// Gira **a scaglioni**, cedendo il turno al browser ogni pochi millisecondi.
// Non è una richiesta di rete, ma sessantanovemila nodi con un `atan2` per
// nodo sono qualche decina di millisecondi su un computer e qualche centinaio
// su un telefono: tenuti in un colpo solo sarebbero mezzo secondo di schermo
// fermo, e capiterebbe **proprio** nell'istante in cui il terreno sta per
// comparire. È la stessa cura di `acqueTagliaAScaglioni` (§12 di `terreno.js`),
// e per la stessa ragione.
const RIL_SCAGLIONE_MS = 8;

async function rilCostruisciMaglia(lat, lon, occhio) {
  const na = RIL_AZIMUT, nr = RIL_ANELLI;
  const quota = new Float32Array(na * nr);
  const alt = new Float32Array(na * nr);
  const mpp = rilMetriPerPixel(lat, RIL_ZOOM);
  const o = rilPixelMondo(lat, lon, RIL_ZOOM);
  let fini = 0;

  // Mettere d'accordo i due modelli del suolo, ed è la riga senza la quale
  // tutto il resto non serve a niente.
  //
  // Le tessere e la griglia grossa sono **due misure diverse della stessa
  // collina**: SRTM a trenta metri le prime, Copernicus a novanta la
  // seconda, e sullo stesso punto non danno lo stesso metro — dieci o venti
  // di scarto in terreno ripido sono normali. La quota dell'occhio però
  // viene da una sola delle due (`terreno.quota`, che è quella a punti), e
  // l'occhio è il termine che si **sottrae a tutti gli angoli**.
  //
  // Il conto di quanto costa: a venticinque metri di distanza, quindici
  // metri di disaccordo sono trentuno gradi. Non un errore piccolo che si
  // nota guardando bene — una parete verticale attorno a chi guarda, alta
  // come il Cervino a due passi da casa. Misurato aprendo il planetario a
  // Como: l'orizzonte a sud-ovest veniva sessanta gradi, cioè il tetto di
  // `TERRENO_ALT_MAX`. E nei numeri è una `atan2` perfettamente sensata.
  //
  // Si allineano allora i due riferimenti: si guarda quanto le tessere
  // sbagliano **nel punto in cui si sta**, e quello scarto si toglie a
  // tutte le loro letture. Un'unica costante, quindi la forma del terreno
  // non cambia di un centimetro; in compenso l'occhio torna a poggiare
  // sulla superficie che si sta disegnando, e nella fascia in cui le due
  // fonti si mescolano non c'è più nessun gradino ad anello.
  const sottoTessera = rilQuotaTessere(o.px, o.py);
  const sottoGriglia = occhio - TERRENO_ALTEZZA_OCCHIO_M;
  let scarto = 0;
  if (sottoTessera !== null) {
    // Tosato: uno scarto enorme non è un disaccordo fra due modelli, è una
    // delle due misure che parla di un altro posto — e allora è meglio
    // fidarsi delle tessere così come sono che spostarle di duecento metri.
    scarto = Math.max(-RIL_SCARTO_MAX, Math.min(RIL_SCARTO_MAX, sottoGriglia - sottoTessera));
  }

  let inizio = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  for (let i = 0; i < na; i++) {
    const az = i * RIL_PASSO_AZ;
    const rad = az * Math.PI / 180;
    const sinAz = Math.sin(rad), cosAz = Math.cos(rad);
    let toccataUnaTessera = false;
    for (let k = 0; k < nr; k++) {
      const s = RIL_DIST[k];
      let q = null;
      const peso = rilPesoTessere(s);
      if (peso > 0) {
        // Est e Nord in metri, poi in pixel: la y del Mercatore cresce verso
        // sud, quindi il Nord si sottrae.
        const qt = rilQuotaTessere(o.px + s * sinAz / mpp, o.py - s * cosAz / mpp);
        if (qt !== null) { q = qt + scarto; toccataUnaTessera = true; }
      }
      if (peso < 1 || q === null) {
        const qg = rilQuotaGriglia(az, s);
        if (qg !== null) q = (q === null) ? qg : q * peso + qg * (1 - peso);
      }
      // Nessuna delle due fonti sa niente di quel punto: si tiene l'anello
      // di prima, che è la cosa più vicina al vero che si abbia. Al primo
      // anello non c'è nemmeno quello, e allora vale il suolo sotto i piedi.
      if (q === null) q = k > 0 ? quota[i * nr + k - 1] : (terreno.quota || 0);
      quota[i * nr + k] = q;
      alt[i * nr + k] = rilAngolo(q, occhio, s);
    }
    if (toccataUnaTessera) fini++;

    const ora = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (ora - inizio > RIL_SCAGLIONE_MS) {
      await new Promise(f => setTimeout(f, 0));
      inizio = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    }
  }
  return { quota, alt, fini, scarto };
}

// Le creste, quelle parziali e i due estremi di ogni anello.
//
// Tutto in una passata sola, e tutto dalla **stessa** superficie che si
// disegna: è la proprietà che tiene insieme il file. La cresta che decide se
// un astro è sorto, quella che nasconde una vetta, quella che taglia un lago
// e la riga che si vede sullo schermo sono quattro letture dello stesso
// array — non quattro conti che si somigliano.
function rilRicava(alt) {
  const na = RIL_AZIMUT, nr = RIL_ANELLI, nd = TERRENO_DISTANZE.length;
  const cresta = new Float32Array(na);
  const fronti = new Float32Array(na * nd);
  const minAlt = new Float32Array(nr).fill(Infinity);
  const maxAlt = new Float32Array(nr).fill(-Infinity);

  for (let i = 0; i < na; i++) {
    let massimo = -Infinity;
    let k = 0;
    for (let d = 0; d < nd; d++) {
      const limite = TERRENO_DISTANZE[d] * 1000;
      while (k < nr && RIL_DIST[k] <= limite) {
        const v = alt[i * nr + k];
        if (v > massimo) massimo = v;
        if (v < minAlt[k]) minAlt[k] = v;
        if (v > maxAlt[k]) maxAlt[k] = v;
        k++;
      }
      // Nessun anello dentro alla prima fetta: il valore resta quello che
      // c'era, e alla prima fetta è «più basso di tutto» — che è il modo di
      // dire «di qui non copre niente».
      fronti[i * nd + d] = massimo === -Infinity ? TERRENO_ALT_MIN : massimo;
    }
    // Gli anelli oltre l'ultima fetta di `TERRENO_DISTANZE` entrano comunque
    // nella cresta: la maglia arriva a sessanta chilometri esatti e l'ultimo
    // anello ci cade sopra, ma un arrotondamento non deve poter perdere una
    // catena.
    while (k < nr) {
      const v = alt[i * nr + k];
      if (v > massimo) massimo = v;
      if (v < minAlt[k]) minAlt[k] = v;
      if (v > maxAlt[k]) maxAlt[k] = v;
      k++;
    }
    cresta[i] = massimo === -Infinity ? 0 : massimo;
    fronti[i * nd + nd - 1] = Math.max(fronti[i * nd + nd - 1], massimo);
  }
  return { cresta, fronti, minAlt, maxAlt };
}


// =====================================================================
// 7. QUELLO CHE IL RESTO DELL'APP CHIEDE
//
//     Tre funzioni, e sono le stesse tre di `terreno.js` — `terrenoAltezza`,
//     `terrenoFronteA`, `terrenoFrontiA` — con la stessa firma e la stessa
//     semantica. Chi chiama non deve sapere da quale delle due griglie
//     arriva la risposta: a scegliere è `terreno.js`, che le preferisce
//     quando ci sono.
// =====================================================================

function rilPronto() {
  return rilievo.acceso && !!rilievo.cresta && !!rilievo.alt;
}

// L'interpolazione fra due direzioni campionate è la stessa curva a S del
// profilo grosso (`terrenoFronteA`). Deve esserlo: due risposte vicine che
// si interpolano in due modi diversi fanno cambiare stato a una vetta
// passando da un settore all'altro.
function rilInterpola(dato, az, passoCol) {
  const dove = (((az % 360) + 360) % 360) / RIL_PASSO_AZ;
  const i = Math.floor(dove) % RIL_AZIMUT;
  const j = (i + 1) % RIL_AZIMUT;
  const t = dove - Math.floor(dove);
  const s = t * t * (3 - 2 * t);
  return dato[i * passoCol] * (1 - s) + dato[j * passoCol] * s;
}

// La cresta, tosata come la tosa `terrenoMonta`: sotto zero non si scende.
// Da una cima l'orizzonte vero è sotto la linea, ma tutto il resto dell'app
// — dal riempimento del terreno alla curva della notte — dà per scontato
// che la terra cominci a zero gradi, e un'app che si contraddice è peggio di
// un orizzonte piatto. Chi vuole il valore grezzo ha `rilFronteA`.
function rilAltezza(az) {
  if (!rilPronto()) return null;
  const dove = (((az % 360) + 360) % 360) / RIL_PASSO_AZ;
  const i = Math.floor(dove) % RIL_AZIMUT;
  const j = (i + 1) % RIL_AZIMUT;
  const t = dove - Math.floor(dove);
  const s = t * t * (3 - 2 * t);
  const v = rilievo.cresta[i] * (1 - s) + rilievo.cresta[j] * s;
  return Math.max(0, Math.min(TERRENO_ALT_MAX, v));
}

// La cresta parziale entro la fetta `k`, **grezza**: sotto la linea
// dell'orizzonte scende in negativo, ed è quel pezzo che disegna la conca
// davanti a chi guarda da una cima e che permette a un lago — che sta sotto
// la linea per definizione — di non risultare nascosto sempre.
function rilFronteA(az, k) {
  if (!rilPronto() || !rilievo.fronti) return null;
  const nd = TERRENO_DISTANZE.length;
  const dove = (((az % 360) + 360) % 360) / RIL_PASSO_AZ;
  const i = Math.floor(dove) % RIL_AZIMUT;
  const j = (i + 1) % RIL_AZIMUT;
  const t = dove - Math.floor(dove);
  const s = t * t * (3 - 2 * t);
  return rilievo.fronti[i * nd + k] * (1 - s) + rilievo.fronti[j * nd + k] * s;
}

// Tutta la riga in un colpo. Il planetario la chiede per ogni colonna dello
// schermo e per ogni fotogramma: chiamare `rilFronteA` diciotto volte
// vorrebbe dire rifare diciotto volte la stessa interpolazione di azimut.
function rilFrontiA(az, fuori) {
  if (!rilPronto() || !rilievo.fronti) return null;
  const nd = TERRENO_DISTANZE.length;
  const out = (fuori && fuori.length >= nd) ? fuori : new Float32Array(nd);
  const dove = (((az % 360) + 360) % 360) / RIL_PASSO_AZ;
  const i = Math.floor(dove) % RIL_AZIMUT;
  const j = (i + 1) % RIL_AZIMUT;
  const t = dove - Math.floor(dove);
  const s = t * t * (3 - 2 * t);
  const a = i * nd, b = j * nd;
  for (let k = 0; k < nd; k++) {
    out[k] = rilievo.fronti[a + k] * (1 - s) + rilievo.fronti[b + k] * s;
  }
  return out;
}

// Il massimo entro una distanza qualunque, in metri: serve al disegno
// dell'acqua, che ragiona in metri e non in fette.
function rilCrestaEntroM(az, metri) {
  if (!rilPronto()) return null;
  const nd = TERRENO_DISTANZE.length;
  let k = -1;
  for (let j = 0; j < nd; j++) if (TERRENO_DISTANZE[j] * 1000 <= metri) k = j;
  return k < 0 ? TERRENO_ALT_MIN : rilFronteA(az, k);
}


// =====================================================================
// 8. L'INNESCO
// =====================================================================

// Il posto da cui si guarda è lo stesso di `terreno.js`: il luogo di sola
// visita del planetario se c'è, se no la posizione dell'app.
function rilLuogo() {
  return typeof terrenoLuogo === 'function' ? terrenoLuogo() : null;
}

function rilScorda() {
  rilievo.quota = null;
  rilievo.alt = null;
  rilievo.cresta = null;
  rilievo.fronti = null;
  rilievo.minAlt = null;
  rilievo.maxAlt = null;
  rilievo.chiave = null;
  rilievo.fini = 0;
  rilTessere = new Map();
}

// Costruire la maglia. Non si chiama a mano: la chiama `rilControlla`,
// quando si accorge che quella che c'è non parla più di questo posto.
//
// Mentre lavora, la maglia vecchia **resta**. È la regola che `terreno.js` ha
// imparato a caro prezzo (§ «l'orizzonte a singhiozzo»): buttare quello che
// si ha in mano per il tempo di rifarlo vuol dire che a ogni affinamento
// l'orizzonte torna quello finto per qualche secondo. A buttarla è solo un
// cambio di luogo.
async function rilCarica() {
  if (rilievo.inCostruzione) { rilievo.daRifare = true; return false; }
  const luogo = rilLuogo();
  if (!luogo || !rilievo.acceso) return false;
  if (typeof terrenoDisponibile !== 'function' || !terrenoDisponibile()) return false;

  const lat = luogo.lat, lon = luogo.lon;
  const occhio = (typeof terreno.quota === 'number' ? terreno.quota : 0) +
    TERRENO_ALTEZZA_OCCHIO_M;
  const chiave = rilChiaveDi(lat, lon, occhio);
  if (chiave === rilievo.chiave) return true;

  rilievo.inCostruzione = true;
  rilievo.daRifare = false;
  rilievo.stato = 'in-corso';
  rilievo.motivo = '';
  if (typeof terrenoAggiornaPannello === 'function') terrenoAggiornaPannello();

  try {
    // Le tessere si riscaricano solo se il posto è cambiato davvero: un
    // affinamento della griglia grossa, o la quota dell'occhio che si
    // assesta quando si scopre di essere sull'acqua, non spostano di un
    // metro le colline — e riscaricare un megabyte per rifare lo stesso
    // conto sarebbe il modo più caro di non cambiare niente.
    const lontano = rilievo.lat === null ||
      (typeof terrenoDistanzaKm === 'function' &&
        terrenoDistanzaKm(lat, lon, rilievo.lat, rilievo.lon) > 0.2);
    if (lontano || !rilTessere.size) {
      rilTessere = new Map();
      let elenco = rilTessereAttorno(lat, lon, RIL_RAGGIO_KM);
      // Più di quante se ne possono permettere: si tengono le più vicine,
      // che è come dire che il raggio si stringe. Meglio un primo piano
      // fine e uno sfondo grosso che il contrario.
      if (elenco.length > RIL_TESSERE_MAX) elenco = elenco.slice(0, RIL_TESSERE_MAX);
      rilLatoTessera = await rilPrendiTessere(elenco);
    }

    const maglia = await rilCostruisciMaglia(lat, lon, occhio);
    const derivate = rilRicava(maglia.alt);
    rilievo.quota = maglia.quota;
    rilievo.alt = maglia.alt;
    rilievo.fini = maglia.fini;
    rilievo.scarto = maglia.scarto;
    rilievo.cresta = derivate.cresta;
    rilievo.fronti = derivate.fronti;
    rilievo.minAlt = derivate.minAlt;
    rilievo.maxAlt = derivate.maxAlt;
    rilievo.lat = lat;
    rilievo.lon = lon;
    rilievo.occhio = occhio;
    rilievo.chiave = chiave;
    rilievo.stato = 'pronto';
    // Quante tessere hanno risposto davvero: se nessuna, la maglia c'è
    // comunque (legge la griglia grossa) ma non è il rilievo fine, e la riga
    // di stato lo deve poter dire invece di far credere a un dettaglio che
    // non c'è.
    const vive = [...rilTessere.values()].filter(Boolean).length;
    if (!vive) {
      rilievo.stato = 'guaio';
      rilievo.motivo = 'le tessere del rilievo non sono arrivate';
    }
  } catch (e) {
    rilievo.stato = 'guaio';
    rilievo.motivo = (e && e.message) || 'il rilievo non è arrivato';
  } finally {
    rilievo.inCostruzione = false;
    if (typeof terrenoAggiornaPannello === 'function') terrenoAggiornaPannello();
    if (typeof skyChiediRidisegno === 'function') skyChiediRidisegno();
    if (rilievo.daRifare) { rilievo.daRifare = false; rilCarica(); }
  }
  return rilPronto();
}

// A ogni fotogramma, e costa un confronto fra due stringhe: la maglia che
// c'è parla ancora di questo posto e di questo occhio? Se no, se ne chiede
// una nuova e intanto si continua a disegnare quella vecchia.
//
// Un controllo a fotogramma invece di un aggancio in ognuno dei punti da cui
// il terreno può cambiare — l'affinamento, il completamento del salvataggio,
// il cambio di città, la quota rifatta perché si è scoperto di stare
// sull'acqua — perché quei punti sono cinque oggi e sei domani, e quello che
// si dimentica non fallisce: disegna il posto di prima, che è il guasto
// peggiore perché sembra vero.
function rilControlla() {
  if (!rilievo.acceso || rilievo.inCostruzione) return;
  if (typeof terrenoDisponibile !== 'function' || !terrenoDisponibile()) return;
  const luogo = rilLuogo();
  if (!luogo) return;
  const occhio = (typeof terreno.quota === 'number' ? terreno.quota : 0) +
    TERRENO_ALTEZZA_OCCHIO_M;
  if (rilChiaveDi(luogo.lat, luogo.lon, occhio) === rilievo.chiave) return;
  // Un luogo del tutto diverso: la maglia vecchia non parla più di qui, e le
  // colline di Genova disegnate a Bolzano sono peggio di nessuna collina
  // perché sembrano vere.
  if (rilievo.lat !== null && typeof terrenoDistanzaKm === 'function' &&
      terrenoDistanzaKm(luogo.lat, luogo.lon, rilievo.lat, rilievo.lon) > RIL_RAGGIO_KM) {
    rilScorda();
  }
  rilCarica();
}

function rilAlterna() {
  rilievo.acceso = !rilievo.acceso;
  if (typeof raggi !== 'undefined') {
    raggi.rilievo = rilievo.acceso;
    if (typeof raggiSalva === 'function') raggiSalva();
  }
  if (rilievo.acceso) rilCarica();
  if (typeof terrenoAggiornaPannello === 'function') terrenoAggiornaPannello();
  if (typeof skyChiediRidisegno === 'function') skyChiediRidisegno();
}

function rilAggiornaTasto() {
  const tasto = document.getElementById('skymap-btn-rilievo');
  if (!tasto) return;
  tasto.classList.toggle('attiva', rilievo.acceso);
  tasto.setAttribute('aria-pressed', rilievo.acceso ? 'true' : 'false');
  tasto.textContent = rilievo.stato === 'in-corso' ? 'Rilievo 3D…' : 'Rilievo 3D';
}

function rilTesto() {
  if (!rilievo.acceso) return '';
  if (rilievo.stato === 'in-corso') {
    return rilievo.tessereChieste
      ? `Rilievo: ${rilievo.tessereAvute}/${rilievo.tessereChieste} tessere.`
      : 'Rilievo: sto misurando la forma del terreno.';
  }
  if (rilievo.stato === 'guaio') return `Rilievo: ${rilievo.motivo}.`;
  if (rilievo.stato === 'pronto' && rilPronto()) {
    const vive = [...rilTessere.values()].filter(Boolean).length;
    if (!vive) return 'Rilievo: dalla griglia grossa, senza le tessere fini.';
    const passo = Math.round(rilMetriPerPixel(rilievo.lat || 45, RIL_ZOOM));
    return `Rilievo: ${passo} m di passo entro ${RIL_RAGGIO_KM} km (${vive} tessere).`;
  }
  return '';
}


// =====================================================================
// 9. IL DISEGNO
//
//     Il pittore, e nient'altro. Si dipinge dagli anelli lontani verso i
//     vicini, e quello che sta davanti copre quello che sta dietro perché è
//     stato dipinto dopo. Non c'è nessun z-buffer e nessun ordinamento: in
//     una maglia parametrizzata per (azimut, distanza) **a partire
//     dall'occhio**, l'ordine degli anelli è già l'ordine di profondità.
//     È una proprietà della parametrizzazione, non un'approssimazione.
// =====================================================================

// I due magazzini di lavoro. Migliaia di nodi per fotogramma allocati ogni
// volta sarebbero decine di megabyte al secondo da far raccogliere, ed è il
// genere di spazzatura che si misura solo quando il telefono scalda.
let rilPuntiBuf = null;    // px, py per nodo
let rilPosBuf = null;      // x, y, z in metri, per la normale
let rilAltBuf = null;      // l'elevazione del nodo, in gradi
let rilOkBuf = null;       // il nodo è davanti all'occhio?
let rilMareBuf = null;     // quanto mare c'è in quella colonna

function rilBuffer(nodi, colonne) {
  if (!rilPuntiBuf || rilPuntiBuf.length < nodi * 2) {
    const n = Math.max(nodi, 4096);
    rilPuntiBuf = new Float32Array(n * 2);
    rilPosBuf = new Float32Array(n * 3);
    rilAltBuf = new Float32Array(n);
    rilOkBuf = new Uint8Array(n);
  }
  if (!rilMareBuf || rilMareBuf.length < colonne) {
    rilMareBuf = new Float32Array(Math.max(colonne, 1024));
  }
}

// Quanto in alto si mette la sorgente, per quanto basso sia l'astro vero.
// Trentacinque gradi è l'inclinazione classica dell'ombreggiatura delle carte
// panoramiche: abbastanza alta da non spegnere i pendii, abbastanza bassa da
// scolpirli.
const RIL_LUCE_ALT_MIN = 35;

// Da dove viene la luce, e quanto è forte.
//
// Due sorgenti, e la seconda esiste per una ragione che vale la pena
// scrivere. Di notte una luce vera non c'è: un panorama senza Luna è una
// silhouette nera, ed è giusto che in cielo sia così. Ma questa superficie
// serve a **riconoscere dove si sta puntando**, e una silhouette nera non lo
// fa. Resta allora una luce di servizio appesa alla telecamera, da sopra e
// da sinistra: non indica nessun sole — si sposta con chi guarda, quindi
// nessuno la può scambiare per una direzione del cielo — e basta a far
// leggere la forma. È la stessa scelta delle tavole panoramiche stampate,
// che un sole non ce l'hanno mai avuto.
function rilLuce(base) {
  const l = (typeof skyLucePaesaggio === 'function') ? skyLucePaesaggio() : null;
  let vera = null, forza = 0;
  if (l && sky.oggetti) {
    const sole = sky.oggetti.find(o => o.id === 'Sun');
    const luna = sky.oggetti.find(o => o.id === 'Moon');
    const corpo = (sole && sole.az === l.az) ? sole : luna;
    if (corpo) {
      // L'**azimut** è quello vero, l'**altezza** no: mai sotto i
      // trentacinque gradi. È la regola delle carte panoramiche, e vale la
      // pena scrivere perché.
      //
      // Con l'altezza vera, un Sole radente illumina il terreno di striscio:
      // il coseno con la normale di un pendio è quasi zero dappertutto, tutte
      // le facce cadono nello stesso livello e il panorama diventa una
      // campitura. Misurato al tramonto sopra Como, col Sole a due decimi di
      // grado sotto l'orizzonte: dai milleduecento riempimenti di mezzogiorno
      // si scendeva a centottantacinque, cioè il rilievo spariva **proprio
      // nell'ora in cui fuori dalla finestra si vede meglio di sempre**.
      //
      // E sarebbe pure sbagliato: al tramonto una montagna non è nera, è
      // illuminata dalla volta del cielo, che sta in alto e che questo conto
      // non ha. Alzare la sorgente è il modo più corto di rimetterla dentro.
      // Da che parte venga la luce resta vero — l'azimut è quello del Sole —
      // e di che colore, pure: lo portano `tonoLuce` e `tonoOmbra` qui sotto.
      vera = skyVettore(corpo.az, Math.max(RIL_LUCE_ALT_MIN, corpo.alt));
      forza = Math.max(0, Math.min(1, l.forza));
    }
  }
  // Le due tinte sono quelle di `skyLucePaesaggio`, e non a caso: sono le
  // stesse che il velo del paesaggio stendeva prima che questa superficie
  // ne prendesse il posto. Il tramonto deve restare arancione da questa
  // parte e azzurro dall'altra — quello che cambia è che adesso a portarlo
  // è la pendenza del terreno e non una vernice stesa per azimut.
  const calda = (l && l.calda) ? l.calda : [255, 255, 255];
  const fredda = (l && l.fredda) ? l.fredda : [0, 0, 0];
  // La luce di servizio: dietro, sopra e a sinistra di chi guarda.
  const f = base.f, r = base.r, u = base.u;
  const sx = f[0] * 0.62 + u[0] * 0.62 - r[0] * 0.48;
  const sy = f[1] * 0.62 + u[1] * 0.62 - r[1] * 0.48;
  const sz = f[2] * 0.62 + u[2] * 0.62 - r[2] * 0.48;
  const m = Math.hypot(sx, sy, sz) || 1;
  return {
    vera, forza, servizio: [sx / m, sy / m, sz / m],
    // Dove va a finire una faccia in piena luce, e dove una in ombra.
    tonoLuce: skyMescolaColore([255, 255, 255], calda, 0.75 * forza),
    tonoOmbra: skyMescolaColore([0, 0, 0], fredda, 0.4 * forza)
  };
}

// Il colore di un anello: **esattamente** quello che `skyDisegnaProfiloOrizzonte`
// darebbe alla sua fetta di distanza. Non è pigrizia, è un vincolo: il §23 di
// `verifica.html` controlla che il velo di un nome di paese e quello della
// fetta di terreno alla sua distanza siano la stessa riga, cifra per cifra.
// Cambiare qui la legge della foschia vorrebbe dire nomi nitidi appoggiati a
// montagne sbiadite.
function rilColoreAnello(km, suolo, pieno) {
  const t = (1 - Math.exp(-km / SKY_FOSCHIA_KM)) / pieno;
  const tinta = Math.pow(1 - t, 0.9);
  const buio = 0.3 * (1 - t);
  return skyMescolaColore(skyMescolaColore(suolo.lontano, suolo.vicino, tinta),
    [0, 0, 0], buio);
}

// Quanto la luce scava, e quanto schiarisce.
//
// Due leggi diverse e non una sola, ed è la riga da cui dipende che il
// rilievo si veda anche di notte. Con una moltiplicazione sola — il modo
// ovvio — su un terreno che di notte vale dodici livelli su 255 la faccia in
// luce ne varrebbe quindici: cioè niente. La schiaritura va invece verso il
// bianco *in proporzione a quanto manca*, che è il modo in cui si comporta
// una luce vera su una superficie scura. L'ombra resta moltiplicativa,
// perché un'ombra è mancanza e non aggiunta.
const RIL_SCHIARITA_NOTTE = 0.17;
const RIL_SCHIARITA_GIORNO = 0.24;
const RIL_OMBRA = 0.55;

// La finestra di coseni su cui si stira la tavolozza. Un terreno guardato da
// dentro non manda quasi mai una faccia più girata di così — quelle più
// girate stanno dietro a qualcosa e non si vedono — e stirare il pezzo utile
// invece dell'intervallo teorico è la differenza fra un panorama e una
// campitura. I due numeri sono misurati sul terreno vero di una valle
// prealpina, non scelti a occhio.
const RIL_COSENO_MIN = 0.28;
const RIL_COSENO_MAX = 0.96;

function rilTavolozza(colore, luce) {
  const schiara = RIL_SCHIARITA_NOTTE +
    (RIL_SCHIARITA_GIORNO - RIL_SCHIARITA_NOTTE) * Math.max(0, Math.min(1, sky.luceCielo));
  const L = luce.tonoLuce, O = luce.tonoOmbra;
  const fuori = new Array(RIL_LIVELLI);
  for (let b = 0; b < RIL_LIVELLI; b++) {
    const k = b / (RIL_LIVELLI - 1);
    const giu = RIL_OMBRA * (1 - k);
    const su = schiara * k;
    let r = colore[0] + (O[0] - colore[0]) * giu;
    let g = colore[1] + (O[1] - colore[1]) * giu;
    let a = colore[2] + (O[2] - colore[2]) * giu;
    r += (L[0] - r) * su; g += (L[1] - g) * su; a += (L[2] - a) * su;
    fuori[b] = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(a)})`;
  }
  return fuori;
}

function rilDisegna(ctx, base, focale, suolo, aria) {
  rilievo.hoDisegnato = false;
  rilControlla();
  if (!rilPronto()) return false;
  if (typeof skyArcoAcquaInVista !== 'function') return false;
  const arco = skyArcoAcquaInVista(base, focale);
  if (!arco) return false;

  const na = RIL_AZIMUT, nr = RIL_ANELLI;
  const pxGrado = Math.max(1e-6, focale * SKY_D2R);

  // --- Quanto fitto disegnare -----------------------------------------
  // Le colonne: un quadretto più stretto di due pixel non è una faccia del
  // terreno, è rumore che costa quanto una faccia.
  const passoCol = Math.max(1, Math.ceil(RIL_PX_MIN / (RIL_PASSO_AZ * pxGrado)));
  const nCol = Math.min(Math.ceil(na / passoCol) + 1,
    Math.floor(2 * arco.mezzo / (RIL_PASSO_AZ * passoCol)) + 2);
  if (nCol < 2) return false;
  const i0 = Math.floor((arco.centro - arco.mezzo) / RIL_PASSO_AZ);

  // Gli anelli: si tiene quello che sposta l'orizzonte di almeno due pixel
  // rispetto all'ultimo tenuto. Il criterio guarda i due estremi dell'anello
  // su **tutto** il giro e non l'azimut al centro della vista: un anello
  // insignificante davanti può essere il crinale di lato, e la scelta va
  // fatta una volta sola per tutte le colonne.
  const scegli = (sogliaPx) => {
    const fuori = [];
    let ultimo = 0;
    for (let k = 0; k < nr; k++) {
      if (k === 0 || k === nr - 1) { fuori.push(k); ultimo = k; continue; }
      const d = Math.max(Math.abs(rilievo.maxAlt[k] - rilievo.maxAlt[ultimo]),
        Math.abs(rilievo.minAlt[k] - rilievo.minAlt[ultimo]));
      if (d * pxGrado >= sogliaPx) { fuori.push(k); ultimo = k; }
    }
    return fuori;
  };
  // Il tetto dei nodi si rispetta **alzando la soglia**, non buttando via un
  // anello sì e uno no.
  //
  // Sembra la stessa cosa e non lo è: diradare a numero pari tiene gli
  // anelli in ordine di indice, cioè a caso rispetto a quello che si vede, e
  // il primo a cadere è tanto la catena che spunta quanto il chilometro di
  // pianura che non dice niente. Alzando la soglia cadono per primi quelli
  // che sullo schermo non spostano niente — che è la definizione di quello
  // che si può perdere. Misurato a Como con un campo di quarantacinque
  // gradi: col dimezzamento restavano ventitré anelli su novantasei e il
  // fianco della valle veniva a scaloni; con la soglia ne restano tutti,
  // perché in quella vista servono davvero.
  let soglia = RIL_PX_MIN;
  let anelli = scegli(soglia);
  while (nCol * anelli.length > RIL_NODI_MAX && soglia < 400 && anelli.length > 6) {
    soglia *= 1.7;
    anelli = scegli(soglia);
  }
  const nAn = anelli.length;
  if (nAn < 2) return false;
  const cronometro = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let riempimenti = 0;

  // --- Un giro solo di proiezioni --------------------------------------
  rilBuffer(nCol * nAn, nCol);
  const occhio = rilievo.occhio;
  const fx = base.f[0], fy = base.f[1], fz = base.f[2];
  const rx = base.r[0], ry = base.r[1], rz = base.r[2];
  const ux = base.u[0], uy = base.u[1], uz = base.u[2];
  const mezzaL = sky.larghezza / 2, mezzaH = sky.altezza / 2;
  // Il margine con cui si scarta un quadretto fuori dal riquadro. Pochi
  // pixel e non una schermata intera, ed è quello che rende gratis il
  // grembiule: guardando l'orizzonte, i dieci anelli sotto i piedi cadono a
  // cinquanta gradi di depressione, cioè fuori da qualunque schermo, e
  // scartandoli davvero non costano niente. Il margine serve solo perché in
  // stereografica il lato di un quadretto è un arco e non un segmento: pochi
  // pixel di sicurezza, e nessun quadretto che tocca il bordo se ne va.
  const margine = 6;

  for (let c = 0; c < nCol; c++) {
    const idx = (((i0 + c * passoCol) % na) + na) % na;
    const azRad = idx * RIL_PASSO_AZ * Math.PI / 180;
    const sinAz = Math.sin(azRad), cosAz = Math.cos(azRad);
    // Quanto mare c'è da questa parte. Serve più sotto, per non stendere il
    // colore della terra sopra all'acqua: vedi il commento della cernita.
    const mix = (typeof terrenoMiscela === 'function')
      ? terrenoMiscela(idx * RIL_PASSO_AZ) : null;
    rilMareBuf[c] = mix ? mix.mare : 0;
    for (let a = 0; a < nAn; a++) {
      const k = anelli[a];
      const gradi = rilievo.alt[idx * nr + k];
      const alt = gradi * Math.PI / 180;
      const ca = Math.cos(alt), sa = Math.sin(alt);
      const vx = sinAz * ca, vy = cosAz * ca, vz = sa;
      const d = vx * fx + vy * fy + vz * fz;
      const p = c * nAn + a;
      if (d <= SKY_D_MIN) { rilOkBuf[p] = 0; continue; }
      const den = (1 + d) * 0.5;
      const X = (vx * rx + vy * ry + vz * rz) / den;
      const Y = (vx * ux + vy * uy + vz * uz) / den;
      rilPuntiBuf[p * 2] = mezzaL + focale * X;
      rilPuntiBuf[p * 2 + 1] = mezzaH - focale * Y;
      rilOkBuf[p] = 1;
      rilAltBuf[p] = gradi;
      const s = RIL_DIST[k];
      rilPosBuf[p * 3] = s * sinAz;
      rilPosBuf[p * 3 + 1] = s * cosAz;
      rilPosBuf[p * 3 + 2] = rilievo.quota[idx * nr + k] - occhio;
    }
  }

  // --- Le facce ---------------------------------------------------------
  const luce = rilLuce(base);
  const pieno = 1 - Math.exp(-TERRENO_DISTANZE[TERRENO_DISTANZE.length - 1] / SKY_FOSCHIA_KM);
  // La cucitura fra due poligoni che condividono un lato.
  //
  // Serve **sempre**, e per un pezzo l'ho creduto un problema della sola
  // trasparenza. Non lo è: due riempimenti che confinano vengono
  // antialiasati ognuno per conto suo, e sul lato in comune restano due
  // mezze coperture che non fanno un pieno — sotto ci sta il gradiente del
  // suolo, che è più chiaro della maglia ombreggiata, e quel mezzo pixel lo
  // lascia passare. Il risultato sono righe chiare a reticolo su tutto il
  // terreno, una per ogni confine fra due facce: si vedono benissimo, e
  // sembrano un disegno tecnico steso sopra al panorama.
  //
  // Ripassare il contorno del poligono col suo stesso colore riempie quei
  // mezzi pixel. Costa una `stroke()` per riempimento — il tracciato è già
  // costruito, quindi è la metà del lavoro di un `fill()` — ed è il prezzo
  // di gran lunga più basso fra quelli provati: allargare i poligoni per
  // farli sovrapporre funziona a opacità piena ma raddoppia la copertura
  // quando il terreno è velato dallo zoom, e lì le righe tornano, solo
  // scure invece che chiare.

  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  for (let a = nAn - 2; a >= 0; a--) {
    const kVicino = anelli[a], kLontano = anelli[a + 1];
    const kmMedio = (RIL_DIST[kVicino] + RIL_DIST[kLontano]) / 2000;
    const tav = rilTavolozza(rilColoreAnello(kmMedio, suolo, pieno), luce);

    let inizio = -1, livello = -1;
    const chiudi = (fine) => {
      if (inizio < 0 || fine < inizio) { inizio = -1; return; }
      ctx.beginPath();
      for (let c = inizio; c <= fine + 1; c++) {
        const p = (c * nAn + a + 1) * 2;
        if (c === inizio) ctx.moveTo(rilPuntiBuf[p], rilPuntiBuf[p + 1]);
        else ctx.lineTo(rilPuntiBuf[p], rilPuntiBuf[p + 1]);
      }
      for (let c = fine + 1; c >= inizio; c--) {
        const p = (c * nAn + a) * 2;
        ctx.lineTo(rilPuntiBuf[p], rilPuntiBuf[p + 1]);
      }
      ctx.closePath();
      ctx.fillStyle = tav[livello];
      ctx.strokeStyle = tav[livello];
      ctx.fill();
      ctx.stroke();
      riempimenti++;
      inizio = -1;
    };

    for (let c = 0; c < nCol - 1; c++) {
      const p00 = c * nAn + a, p01 = c * nAn + a + 1;
      const p10 = (c + 1) * nAn + a, p11 = (c + 1) * nAn + a + 1;
      if (!(rilOkBuf[p00] && rilOkBuf[p01] && rilOkBuf[p10] && rilOkBuf[p11])) {
        chiudi(c - 1); continue;
      }
      // Il mare non è terra, e qui si dipinge terra.
      //
      // Nelle tessere l'acqua vale zero (§ `RIL_QUOTA_MIN`), quindi la maglia
      // sopra al mare è un piano perfettamente orizzontale a filo
      // d'orizzonte: la geometria giusta, dipinta del colore sbagliato — e
      // per giunta stesa sopra a `skyDisegnaMare`, che di quello stesso
      // piano fa una prospettiva vera con Fresnel, le onde e la strada di
      // luce. Si salta, e a dipingerlo resta lui. Solo però quello che sta
      // **sotto** la linea: un promontorio in una direzione per metà marina
      // è terra, e sparirebbe.
      const mare = Math.max(rilMareBuf[c], rilMareBuf[c + 1]);
      if (mare > 0.5 && rilAltBuf[p00] <= 0 && rilAltBuf[p01] <= 0 &&
          rilAltBuf[p10] <= 0 && rilAltBuf[p11] <= 0) {
        chiudi(c - 1); continue;
      }
      // Fuori dal riquadro: non si disegna, e soprattutto non si paga la
      // normale. Con la vista stretta su un astro è quasi tutta la maglia.
      // Tutti e quattro gli angoli dalla stessa parte di un bordo: il
      // quadretto il riquadro non lo può toccare. Con due soli angoli — com'era
      // — la prova passava anche a un quadretto lontanissimo, e il grembiule
      // sotto i piedi si pagava per intero a ogni fotogramma.
      // Srotolato, e non è pignoleria: un `for…of` su un array letterale
      // qui vuol dire quindicimila array nuovi al fotogramma, cioè quasi un
      // megabyte al secondo di spazzatura per un conto di dodici confronti.
      const sx0 = rilPuntiBuf[p00 * 2], sy0 = rilPuntiBuf[p00 * 2 + 1];
      const sx1 = rilPuntiBuf[p01 * 2], sy1 = rilPuntiBuf[p01 * 2 + 1];
      const sx2 = rilPuntiBuf[p10 * 2], sy2 = rilPuntiBuf[p10 * 2 + 1];
      const sx3 = rilPuntiBuf[p11 * 2], sy3 = rilPuntiBuf[p11 * 2 + 1];
      const minX = Math.min(sx0, sx1, sx2, sx3), maxX = Math.max(sx0, sx1, sx2, sx3);
      const minY = Math.min(sy0, sy1, sy2, sy3), maxY = Math.max(sy0, sy1, sy2, sy3);
      if (maxX < -margine || minX > sky.larghezza + margine ||
          maxY < -margine || minY > sky.altezza + margine) {
        chiudi(c - 1); continue;
      }

      // La normale della faccia, dai suoi stessi quattro angoli: così
      // l'ombreggiatura racconta esattamente il poligono che si vede e non
      // una superficie ideale che gli somiglia. Il prodotto vettoriale del
      // lato lungo l'azimut per quello lungo la distanza punta in su per
      // costruzione (su terreno piatto vale `s`, che è positivo).
      const ax = rilPosBuf[p10 * 3] - rilPosBuf[p00 * 3];
      const ay = rilPosBuf[p10 * 3 + 1] - rilPosBuf[p00 * 3 + 1];
      const az2 = rilPosBuf[p10 * 3 + 2] - rilPosBuf[p00 * 3 + 2];
      const bx = rilPosBuf[p01 * 3] - rilPosBuf[p00 * 3];
      const by = rilPosBuf[p01 * 3 + 1] - rilPosBuf[p00 * 3 + 1];
      const bz = rilPosBuf[p01 * 3 + 2] - rilPosBuf[p00 * 3 + 2];
      let nx = ay * bz - az2 * by;
      let ny = az2 * bx - ax * bz;
      let nz = ax * by - ay * bx;
      const nm = Math.hypot(nx, ny, nz) || 1;
      nx /= nm; ny /= nm; nz /= nm;

      // Quanto questa faccia è girata verso la luce, da zero a uno.
      //
      // Le due sorgenti si pesano fra loro e **non si sommano scalate**: era
      // il difetto che rendeva piatto tutto il panorama. Moltiplicando il
      // coseno per la forza della luce di servizio (0,55), un terreno che di
      // coseni ne produce da 0,3 a 0,95 finiva compresso fra 0,17 e 0,52 —
      // cioè in metà tavolozza — e lì dentro il fianco ripido e il fondo
      // valle cadevano a due gradini di distanza. Un pesato invece usa la
      // scala intera comunque, e a decidere quanto scava il chiaroscuro
      // restano `RIL_OMBRA` e `RIL_SCHIARITA`, che è il posto giusto.
      const ds = Math.max(0, nx * luce.servizio[0] + ny * luce.servizio[1] +
        nz * luce.servizio[2]);
      let k = ds;
      if (luce.vera && luce.forza > 0) {
        const dv = Math.max(0, nx * luce.vera[0] + ny * luce.vera[1] + nz * luce.vera[2]);
        k = dv * luce.forza + ds * (1 - luce.forza);
      }
      // La finestra utile. Un terreno vero non produce quasi mai un coseno
      // sotto `RIL_COSENO_MIN` (vorrebbe dire una faccia girata dall'altra
      // parte, e quella è nascosta) né sopra `RIL_COSENO_MAX`: stirare quel
      // pezzo su tutta la tavolozza è ciò che fa vedere la differenza fra un
      // pendio e quello accanto.
      const b = Math.max(0, Math.min(RIL_LIVELLI - 1, Math.round(
        (k - RIL_COSENO_MIN) / (RIL_COSENO_MAX - RIL_COSENO_MIN) * (RIL_LIVELLI - 1))));

      if (inizio < 0) { inizio = c; livello = b; }
      else if (b !== livello) { chiudi(c - 1); inizio = c; livello = b; }
    }
    chiudi(nCol - 2);
  }

  // --- Il filo del crinale ---------------------------------------------
  // La riga contro il cielo, e non ce n'è nessun'altra: dentro alla maglia i
  // piani li separa l'ombreggiatura, che è quello che li separa davvero.
  // Contorni disegnati sulle dorsali interne farebbero una carta a curve di
  // livello — è la stessa lezione del filo di luce di `app.js`.
  rilFiloCrinale(ctx, base, focale, aria, i0, passoCol, nCol);

  rilievo.ultimo = {
    colonne: nCol, anelli: nAn, riempimenti,
    ms: Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - cronometro) * 100) / 100
  };
  rilievo.hoDisegnato = true;
  return true;
}

function rilFiloCrinale(ctx, base, focale, aria, i0, passoCol, nCol) {
  const na = RIL_AZIMUT;
  const foschia = aria ? aria.foschia : [80, 90, 105];
  ctx.beginPath();
  let dentro = false;
  for (let c = 0; c < nCol; c++) {
    const idx = (((i0 + c * passoCol) % na) + na) % na;
    const az = idx * RIL_PASSO_AZ;
    const p = skyProietta(skyVettore(az, rilievo.cresta[idx]), base, focale);
    if (!p.davanti) { dentro = false; continue; }
    if (dentro) ctx.lineTo(p.px, p.py);
    else { ctx.moveTo(p.px, p.py); dentro = true; }
  }
  ctx.strokeStyle = skyRgba(skyMescolaColore(foschia, [255, 255, 255], 0.55),
    0.3 + 0.3 * Math.max(0, Math.min(1, sky.luceCielo)));
  ctx.lineWidth = 1.1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}
