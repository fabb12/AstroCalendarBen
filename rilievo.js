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

// Rifare la maglia e riscaricare le tessere sono **due cose diverse**, e per
// un pezzo sono state la stessa: si ricostruiva solo quando conveniva
// ripagare il megabyte, cioè ogni quattrocentocinquanta metri a piedi e ogni
// chilometro e mezzo in macchina. In mezzo la maglia veniva traslata a ogni
// fotogramma (`rilCampioneInMovimento`) — il che teneva il disegno vivo, ma
// lasciava scoperta la metà che non si disegna: `rilievo.cresta` e
// `rilievo.fronte` continuavano a raccontare il posto di partenza. Sono loro
// a dire se un astro è sorto, quale vetta si vede e dove finisce un lago:
// per un chilometro e mezzo l'orizzonte disegnato e quello calcolato
// parlavano di due punti diversi, e i nomi delle montagne finivano appesi a
// creste che sullo schermo non c'erano più.
//
// Rifare la maglia però **non costa rete**: le tessere sono già decodificate
// in memoria e coprono sei chilometri, quindi ricostruire è aritmetica —
// settantaseimila `atan2` a scaglioni di otto millesimi, cioè qualche
// fotogramma di lavoro spalmato, mentre quella vecchia resta disegnata. Si
// rifà allora spesso (sotto, `RIL_RICENTRA_M`) e si scarica solo quando le
// tessere che servono non ci sono più.
const RIL_RICENTRA_M = 60;
const RIL_RICENTRA_MIN_MS = 3000;
// Fra due giri di tessere: sotto questo tempo si ricostruisce con quello che
// c'è, che è sempre meglio di una maglia ferma.
const RIL_TESSERE_MIN_MS = 8000;
// Quante tessere decodificate si tengono in memoria. Nove coprono il disco;
// le altre sono quelle che ci si lascia dietro viaggiando, e tenerne un po'
// vuol dire che tornare indietro (o girare attorno a un isolato) non ricompra
// niente. Ognuna è un quarto di megabyte.
const RIL_TESSERE_TENUTE = 18;

// Sotto questo scostamento la maglia si legge così com'è: mezzo metro non
// sposta nessun nodo di un pixel, e pagare una bilineare per nodo per non
// spostare niente sarebbe il modo più caro di non cambiare il disegno.
const RIL_TRASLA_MIN_M = 0.5;

// Quanto in fretta la quota dell'occhio insegue il terreno sotto i piedi.
// Non ci si arriva di colpo, e non è morbidezza gratuita: il modello del
// suolo dice un valore ogni ventisette metri, e due fix vicini possono
// pescare due celle diverse che differiscono di qualche metro. Cinque metri
// a venticinque di distanza sono undici gradi — cioè tutto l'orizzonte
// vicino che sobbalza. Un secondo e mezzo di costante di tempo li spalma,
// e a passo d'uomo o in macchina la salita vera si segue lo stesso.
const RIL_OCCHIO_TAU_MS = 1500;
// Un dato che arriva dalla rete può correggere la quota anche di centinaia
// di metri. La sola esponenziale è continua, ma all'inizio percorre una
// frazione dello scarto: con 300 m di correzione sono ancora più di 180 m/s,
// percepiti come un colpo di camera. Questo tetto trasforma la correzione in
// una salita regolare. Quattro metri al secondo lasciano seguire anche una
// strada di montagna, senza permettere al caricamento di sollevare il punto
// di vista in un paio di fotogrammi.
const RIL_OCCHIO_V_MAX_M_S = 4;
// Finché l'occhio sta ancora recuperando una correzione altimetrica, il
// primissimo lembo della maglia non deve poterlo avvolgere. Non si alza la
// camera per evitarlo (sarebbe proprio il salto che vogliamo eliminare): si
// raccorda invece soltanto il terreno sotto i piedi alla quota corrente e si
// esaurisce il raccordo prima che il dettaglio diventi visibile.
const RIL_SPAZIO_CAMERA_M = 70;
// Fin dove attorno al centro della griglia grossa comanda la quota misurata
// da `terreno.js` invece di quella letta dalle tessere. Il passaggio è
// continuo per costruzione: lo scarto fra i due modelli è tarato proprio
// perché nel centro diano lo stesso numero.
const RIL_OCCHIO_GRIGLIA_KM = 0.3;
// Sotto questo scarto fra la camera di adesso e quella con cui la maglia è
// stata costruita si legge la maglia così com'è. Cinque centimetri: meno
// di così non sposta un pixel nemmeno sotto i piedi.
const RIL_OCCHIO_RIFAI_M = 0.05;

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
//
// Le due ragioni stanno a parte perché servono anche fuori di qui: sono
// quello che permette di trovare **l'anello di una distanza qualunque con
// un logaritmo** invece che cercandolo (`rilAnelloDi`), e quel conto sta
// dentro al ciclo di disegno.
const RIL_RAGIONE_PIEDI = Math.pow(RIL_VICINO_M / RIL_PIEDI_M, 1 / RIL_ANELLI_PIEDI);
const RIL_RAGIONE_LONTANI = Math.pow(RIL_LONTANO_M / RIL_VICINO_M, 1 / (RIL_ANELLI_LONTANI - 1));

const RIL_DIST = (() => {
  const a = new Float64Array(RIL_ANELLI);
  const rp = RIL_RAGIONE_PIEDI;
  for (let k = 0; k < RIL_ANELLI_PIEDI; k++) a[k] = RIL_PIEDI_M * Math.pow(rp, k);
  const r = RIL_RAGIONE_LONTANI;
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

// --- Quanto costa un fotogramma ---------------------------------------

// Quanto larga dev'essere una colonna sullo schermo perché valga la pena
// disegnarla. Sotto ai due pixel il tratto non racconta più il terreno: è
// rumore che costa quanto un tratto vero.
const RIL_PX_MIN = 2;

// Il passo delle colonne si aggancia alle **potenze di due**, e questa è la
// riga che toglie di mezzo lo sfarfallio.
//
// Un passo che cambia con continuità mentre si pizzica vuol dire che a ogni
// fotogramma si disegnano colonne diverse, e il tratteggio balla. Con le
// potenze di due i cambi sono rari; con l'isteresi — si sale a un passo più
// largo solo quando si è ben oltre la soglia, e si torna indietro solo
// quando si è ben sotto — non capita mai di ballare avanti e indietro
// attorno al punto di scambio, che è il modo in cui uno scalino diventa uno
// sfarfallio.
const RIL_ISTERESI = 1.35;

// I livelli di chiaroscuro. Le strisce dello stesso livello si mettono in
// **un solo tracciato** e si disegnano con un `fill()` solo: è tutta
// l'economia di questa vista — migliaia di strisce in quaranta chiamate.
//
// Quaranta e non ventiquattro: su un fianco liscio il coseno cambia piano, e
// con pochi livelli le strisce contigue cadono tutte nello stesso e il
// terreno viene a **mosaico**, con blocchi larghi qualche colonna. Il numero
// giusto non lo si indovina — si guarda dove il gradino fra due livelli
// scende sotto ai due o tre livelli su 255, che è la soglia sotto cui una
// banda non si vede più.
const RIL_LIVELLI = 40;

// La finestra di coseni su cui si stira il chiaroscuro. Un terreno guardato
// da dentro non manda quasi mai una faccia più girata di così — quelle più
// girate stanno dietro a qualcosa e non si vedono — e stirare il pezzo utile
// invece dell'intervallo teorico è la differenza fra un panorama e una
// campitura.
const RIL_COSENO_MIN = 0.28;
const RIL_COSENO_MAX = 0.96;

// Quanto in alto si mette la sorgente della luce, per quanto basso sia
// l'astro vero. Trentacinque gradi è l'inclinazione classica
// dell'ombreggiatura delle carte panoramiche: abbastanza alta da non
// spegnere i pendii, abbastanza bassa da scolpirli. Con l'altezza vera un
// Sole radente illumina di striscio, tutte le facce cadono nello stesso
// livello e il rilievo sparisce **proprio nell'ora in cui fuori si vede
// meglio di sempre**. Da che parte venga la luce resta vero — l'azimut è
// quello del Sole — e di che colore, pure.
const RIL_LUCE_ALT_MIN = 35;

// Di notte una luce non c'è. Un panorama vero, senza Luna, è una silhouette
// nera — ed è giusto così in cielo, ma qui il rilievo esiste per far
// riconoscere *dove si sta puntando*, e una silhouette nera non lo fa.
// Resta allora una luce di servizio appesa alla telecamera, da sopra e da
// sinistra: non indica nessuna direzione del cielo (si sposta con chi
// guarda) e basta a far leggere la forma.

// Quanto marcato è il tratteggio, di notte e di giorno. Sono due numeri e
// non uno perché di notte il terreno vale una dozzina di livelli su 255: un
// tratto che ne aggiunge tre non esiste, e uno che ne aggiunge sessanta
// diventa più chiaro del cielo.
const RIL_TRATTO_NOTTE = 0.24;
const RIL_TRATTO_GIORNO = 0.38;

// Il fondo resta un poco più chiaro del colore base del suolo. Il rilievo
// prima era corretto nei rapporti fra i piani, ma nelle ore diurne le mezze
// tinte si chiudevano troppo presto e i valloni finivano in una sola massa
// scura. Questa è luce diffusa del cielo, non luce diretta: perciò cresce col
// giorno, resta appena presente di notte e, soprattutto, non cancella le
// ombre direzionali che vengono applicate dopo.
const RIL_DIFFUSA_NOTTE = 0.025;
const RIL_DIFFUSA_GIORNO = 0.12;

// Anche il primo piano riceve almeno metà della luce diffusa dall'aria.
// Senza questo pavimento le fette vicine restavano quasi del colore grezzo
// del suolo, mentre oltre `RIL_FOV_FONDI_SEPARATI_MAX` la campitura unica
// usa per forza una fetta media e diventava di colpo molto più chiara. La
// luminosità del terreno non deve dipendere dallo zoom: la distanza continua
// a schiarire ulteriormente i piani lontani, ma nessun piano torna alla
// vecchia massa scura.
const RIL_LONTANANZA_MINIMA = 0.5;

// Da quanta **piega** in su il tratto si vede pieno.
//
// È la riga che distingue una pettinatura da un pettine, e ci sono voluti due
// tentativi per arrivarci. Un tratto per colonna, disegnato sempre, dà righe
// regolari ed equidistanti: sul fondovalle è il codice a barre che `app.js`
// si porta scritto come errore da non rifare, e su un fianco è peggio, perché
// sembra un tessuto. Legarlo alla sola pendenza non basta — un pendio è
// ripido dappertutto, quindi le righe restano tutte.
//
// Quello che si vede in una fotografia di montagna non sono righe
// equidistanti: sono i **valloni**, cioè i posti dove la superficie si piega
// di traverso. Si misura con la derivata seconda in azimut — tre direzioni
// della maglia, mezzo grado l'una dall'altra — rapportata alla larghezza che
// quel mezzo grado ha a quella distanza. Dove la piega non c'è, il tratto non
// si disegna: il fianco liscio resta liscio, e le righe compaiono solo dove
// il terreno ha davvero una forma da raccontare. Costa una lettura in più
// per nodo e **toglie** segmenti invece di aggiungerne.
//
// Il segno conta: una piega convessa è un costolone e prende luce, una
// concava è un impluvio e sta in ombra. È così che si legge un vallone.
const RIL_PIEGA_PIENA = 0.16;

// E su quanti **metri di terreno** si misura la piega.
//
// Non su due direzioni contigue della maglia, ed è l'errore che ha fatto
// sparire tutto il dettaglio al primo tentativo: mezzo grado a trecento metri
// sono due metri e sessanta, cioè un decimo di cella del modello del suolo.
// Fra due colonne così vicine la quota è interpolata linearmente e la
// derivata seconda vale **zero per costruzione** — il fianco veniva liscio
// come una lastra, che è l'opposto del difetto di prima ma è altrettanto
// falso. Sessanta metri sono un paio di celle: la misura più fine che il dato
// sappia davvero sostenere, e a quel passo un vallone si vede.
const RIL_PIEGA_M = 60;

// Di quanti livelli la piega sposta il chiaroscuro, a saturazione. Sei su
// ventiquattro: un quarto della scala, che basta a far leggere un vallone
// senza che il fianco diventi un tessuto a righe.
const RIL_PIEGA_LIVELLI = 6;

// Sotto quanti metri l'ombreggiatura si spegne.
//
// Non è una scelta di gusto, è quello che il dato sa dire. Una cella del
// modello del suolo è ventisette metri: il terreno a cinquanta metri dai
// piedi sta dentro a **due celle**, e qualunque chiaroscuro gli si dipinga
// sopra è inventato. Sullo schermo si vedeva per quello che era — un mosaico
// di rettangoli in primo piano, con il rumore del modello scambiato per
// forma del terreno. Sopra ai duecentocinquanta metri invece le celle sono
// una decina e la forma c'è davvero.
const RIL_VICINO_PIENO_M = 250;
const RIL_VICINO_NIENTE_M = 70;

// Un tentativo che non è servito, e vale la pena scriverlo perché è quello
// che viene in mente per primo: legare il tratto alla **pendenza** invece che
// alla piega. Non basta — un pendio è ripido dappertutto, quindi le righe
// restano tutte e il fianco torna a essere un tessuto. Quello che si vede in
// una fotografia non è la pendenza, sono i **valloni**: la piega di traverso.

// La riga del crinale contro il cielo, e quelle interne dove un piano si
// stacca da quello dietro. Il filo resta bianco (invece di prendere il colore
// della foschia): sottile ma riconoscibile, mette in evidenza tanto le cime
// quanto le colline dei piani davanti senza appiattire il chiaroscuro 3D.
const RIL_FILO_CIELO = 0.68;
const RIL_FILO_DENTRO = 0.30;

// Di quanti anelli possono differire due punti di rottura di colonne vicine
// perché si considerino lo stesso crinale. Tre: più stretto e i contorni si
// spezzettano su ogni dente, più largo e si cuciono creste che non hanno
// niente a che vedere fra loro.
const RIL_CONTORNO_SALTO = 3;

// --- Il fondo del terreno, fetta di distanza per fetta di distanza -----
//
// È la correzione al difetto che si vede **solo dall'alto**, e che dall'alto
// si vede subito: da una cima il panorama era una campitura verde scuro
// tagliata in due da una riga netta, e la riga si spostava con il pitch.
//
// La causa non era il rilievo, era quello che gli stava sotto. Per un pezzo
// questo modulo ha dipinto un fondo opaco **solo dove il terreno spunta
// sopra la riga dell'orizzonte** (la vecchia `chiudi()`, dalla cresta giù
// fino al piede), lasciando tutto il resto al gradiente del suolo di
// `skyGradienteTerreno`. A livello del mare quel patto funziona: sotto la
// riga c'è il prato davanti a casa, e il gradiente lo dipinge bene, perché è
// scritto sulla legge «un grado sotto l'orizzonte è a novanta metri» — vera
// con l'occhio a un metro e sessanta da terra.
//
// Da duemilaseicento metri quella legge è falsa di tre ordini di grandezza:
// tre gradi sotto l'orizzonte non sono quindici metri, sono venti chilometri
// di valle. Il gradiente dipingeva quindi **tutto il panorama** — creste
// comprese, fino a sessanta chilometri — col colore del terreno che si ha
// sotto le scarpe: scuro, senza un filo di foschia, senza profondità. E
// siccome le sue fermate sono orizzontali sullo schermo mentre l'orizzonte
// stereografico è un arco, il passaggio fra il colore lontano e quello
// vicino cadeva su una riga dritta che non seguiva niente di quello che si
// vedeva: l'artefatto che scorreva sul paesaggio muovendo la camera.
//
// La cura è togliere il patto: il rilievo si dipinge il **suo** fondo, sopra
// e sotto la riga, a fette di distanza. Sono le stesse fette del profilo a
// bande di `app.js` (`skyPianiOrizzonte`) e la stessa idea: la cresta
// parziale `fronte` — quanto sale il terreno **entro** una distanza — è non
// decrescente per costruzione, quindi le fette non si scavalcano mai e si
// possono dipingere come strisce che si toccano senza sovrapporsi. Lo
// schermo si paga una volta sola, come prima.
//
// Le distanze non sono scelte a occhio: sono quelle che dividono in parti
// uguali la **foschia**, cioè `rilLontananza`. Dividere i chilometri
// darebbe fette tutte uguali di colore in fondo e un salto secco davanti;
// dividere la foschia dà passi di colore della stessa taglia, che è quello
// che l'occhio misura. Quattordici bastano: fra una fetta e l'altra restano
// due livelli su 255, sotto la soglia in cui una banda si legge come tale.
const RIL_FONDI = 14;

// A campo molto largo le curve delle fette non sono piu' figure annidate sul
// piano dello schermo. La stereografica conserva gli angoli, non l'ordine
// planare: vicino ai bordi due creste che sul terreno sono una davanti
// all'altra possono incrociarsi, e i quattordici poligoni finiscono per
// sovrapporsi in grandi tasselli. Oltre questa apertura la profondita' delle
// singole fette e' comunque compressa in pochi pixel: si dipinge percio' un
// solo fondo, ritagliato con la sagoma esatta, e si lascia che pettinatura e
// contorni raccontino ancora la forma 3D. Sotto la soglia non cambia nulla.
const RIL_FOV_FONDI_SEPARATI_MAX = 125;

function rilFondiSeparati() {
  return !Number.isFinite(sky.fov) || sky.fov <= RIL_FOV_FONDI_SEPARATI_MAX;
}

// Quando le curve del terreno **si chiudono attorno al cielo**.
//
// Alzando la camera a campo larghissimo l'orizzonte non attraversa più lo
// schermo: ci sta tutto dentro, e con lui ogni curva del terreno diventa un
// anello. Lì «sotto la curva» non vuol più dire «giù fino al fondo del
// riquadro» — vuol dire **dall'altra parte** della curva, e chiudere un
// anello che gira attorno al centro dello schermo tirandogli una riga fino
// al bordo di sotto fa un poligono che si attraversa da solo: con la regola
// `nonzero` una parte si riempie e una no, e sul cielo compaiono strisce
// verticali di terreno coi bordi netti. È il difetto che si vedeva puntando
// in alto a 180°.
//
// Da che parte stia la terra lo dice il cerchio dell'orizzonte, che è lo
// stesso di `skyTracciaSuolo`: guardando **in su** la terra è fuori
// dall'anello, guardando **in giù** ci sta dentro — lì al centro dello
// schermo c'è il nadir, e le curve gli stanno attorno in ordine di
// depressione.
//
// La soglia è sull'arco disegnato, che è la stessa cosa del giro che le
// curve fanno attorno al centro del cerchio: gli azimut ci girano intorno in
// ordine. Duecentosettanta gradi e non trecentotrenta perché a quel punto le
// due chiusure devono già dare lo stesso disegno — e infatti nella fascia di
// mezzo lo danno, perché i due capi dell'arco cascano fuori dal riquadro ai
// lati. Sopra i sessanta gradi di elevazione, invece, l'anello circonda lo
// schermo per davvero, e lì solo questa chiusura è giusta.
const RIL_ANELLO_GRADI = 270;

// Gli anelli su cui cadono quelle fette. `fronte[k]` è il massimo fino
// all'anello k **compreso**, quindi la fetta b è il terreno che sta fra
// l'anello della fetta b−1 e il suo: l'ultima è la sagoma intera.
//
// Si calcolano alla prima passata di disegno e non al caricamento del file:
// la legge della foschia sta in `app.js` (`SKY_FOSCHIA_KM`, letta da
// `rilLontananza`) e questo modulo lo carica anche `verifica.html`, che
// `app.js` non lo carica affatto. Un conto fatto in cima al file lì
// solleverebbe un ReferenceError, e in uno `<script>` unico un errore porta
// via tutto quello che viene dopo.
let rilFondoK = null;

function rilFondoAnelli() {
  if (rilFondoK) return rilFondoK;
  rilFondoK = new Int32Array(RIL_FONDI);
  for (let b = 0; b < RIL_FONDI; b++) {
    if (b === RIL_FONDI - 1) { rilFondoK[b] = RIL_ANELLI - 1; break; }
    // La fetta b è quella che si prende `(b+1)/RIL_FONDI` della foschia
    // totale: si cerca l'anello che ci arriva, e la ricerca è una scansione
    // perché gli anelli sono centosei e questo si fa una volta sola.
    const voluto = (b + 1) / RIL_FONDI;
    let k = 0;
    while (k + 1 < RIL_ANELLI && rilLontananza(RIL_DIST[k + 1] / 1000) <= voluto) k++;
    rilFondoK[b] = Math.max(b, k);
  }
  return rilFondoK;
}


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
  fronte: null,       // Float32Array(720×106): il massimo lungo il raggio fino
                      // all'anello k compreso — è insieme la cresta parziale
                      // e la rimozione dei punti nascosti (§6)
  minAlt: null,       // Float32Array(96): il nodo più basso di ogni anello
  maxAlt: null,       // Float32Array(96): e il più alto — servono a scartare
                      // in blocco gli anelli fuori dal riquadro

  // Per quale posto vale, e con che occhio. La chiave dice tutto quello che
  // la maglia contiene: cambiandone anche un pezzo va rifatta.
  chiave: null,
  lat: null,
  lon: null,
  occhio: 0,
  // La camera di adesso, che fra una ricostruzione e l'altra insegue il
  // suolo sotto i piedi (§8-bis). `null` finché non c'è una maglia.
  occhioOra: null,
  occhioQuando: 0,
  ultimeTessere: 0,   // quando si è chiesto l'ultimo giro di tessere
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
  ultimoCaricamento: 0,

  // Ha disegnato lui questo fotogramma? Lo chiedono i laghi e i nomi delle
  // montagne, che devono sapere **dove il terreno è dipinto** e non dove il
  // modello dice che sta. Con la maglia le due cose coincidono — non c'è
  // nessun rilievo finto che morde la cresta — ma chi chiama non lo sa, e la
  // domanda resta la stessa di prima.
  hoDisegnato: false,

  // Il passo delle colonne dell'ultimo fotogramma, che si tiene per
  // l'isteresi: senza memoria non c'è isteresi, e senza isteresi il passo
  // balla attorno al punto di scambio (§9).
  passo: 1,

  // Il conto dell'ultimo fotogramma: colonne, strisce, chiamate di disegno e
  // millisecondi. Non è una curiosità — è il bilancio di questa vista, e
  // senza di lui accorgersi che è diventata cara vuol dire aspettare che
  // qualcuno segnali «va a scatti».
  ultimo: { colonne: 0, strisce: 0, chiamate: 0, ms: 0 }
};

// Le tessere già decodificate, per questo luogo. Chiave `x/y`, valore una
// `Float32Array(256×256)` di metri, oppure `null` se quella tessera non è
// arrivata — che è un'informazione anche quella: dice di non richiederla e
// di ripiegare sulla griglia grossa.
let rilTessere = new Map();

function rilDistanzaDalCentro(luogo) {
  if (!luogo || rilievo.lat === null || typeof terrenoDistanzaKm !== 'function') return Infinity;
  return terrenoDistanzaKm(luogo.lat, luogo.lon, rilievo.lat, rilievo.lon) * 1000;
}

// Lo scostamento fra il centro della maglia e il punto in cui si è adesso,
// in metri di Est e di Nord. Si calcola una volta per fotogramma e non una
// per nodo: sono settecentoventi colonne per un centinaio di anelli, e due
// seni per nodo si sentono.
function rilScostamento(luogo) {
  if (!luogo || rilievo.lat === null || rilievo.lon === null) return null;
  const latMedia = (luogo.lat + rilievo.lat) * Math.PI / 360;
  const nord = (luogo.lat - rilievo.lat) * 111195;
  const est = (luogo.lon - rilievo.lon) * 111195 * Math.cos(latMedia);
  if (Math.abs(est) < RIL_TRASLA_MIN_M && Math.abs(nord) < RIL_TRASLA_MIN_M) return null;
  return { est, nord };
}

// L'anello di una distanza, come numero **con la virgola**: la parte intera
// è l'indice, la frazione dice quanto si sta fra lui e il successivo.
//
// Con un logaritmo e non cercandolo, e non è micro-ottimizzazione: questa
// riga sta dentro al ciclo di disegno, cioè gira ventimila volte per
// fotogramma, e una ricerca lineare su centosei anelli lì dentro si sente.
// Si può fare perché le distanze sono due progressioni geometriche di
// ragione nota (`RIL_RAGIONE_*`), che è il motivo per cui sono state
// scelte così.
function rilAnelloDi(metri) {
  const m = Math.max(1e-3, metri);
  if (m <= RIL_VICINO_M) {
    return Math.log(m / RIL_PIEDI_M) / Math.log(RIL_RAGIONE_PIEDI);
  }
  return RIL_ANELLI_PIEDI +
    Math.log(m / RIL_VICINO_M) / Math.log(RIL_RAGIONE_LONTANI);
}

// La quota della maglia in un punto qualunque del suo disco, dato in
// coordinate polari **della maglia**. Bilineare nelle due direzioni: in
// azimut fra due colonne, in distanza fra due anelli.
//
// Bilineare e non «il nodo più vicino», ed è la differenza fra una
// traslazione e uno scivolamento a scatti. Gli anelli stanno fra loro
// all'otto per cento e le colonne a mezzo grado: prendendo il nodo più
// vicino, muovendosi il terreno si ricampiona a quantoni — un pendio
// continuo diventa una scaletta che salta di un gradino a ogni fix, ed è
// esattamente il tremolio che si vede dal finestrino. È la stessa lezione
// di `rilQuotaTessere`, che per la stessa ragione non prende il pixel più
// vicino.
function rilQuotaMaglia(azGradi, metri) {
  const nr = RIL_ANELLI;
  const dove = (((azGradi % 360) + 360) % 360) / RIL_PASSO_AZ;
  const i = Math.floor(dove) % RIL_AZIMUT;
  const j = (i + 1) % RIL_AZIMUT;
  const u = dove - Math.floor(dove);

  const anello = Math.max(0, Math.min(nr - 1.0001, rilAnelloDi(metri)));
  const k = Math.floor(anello);
  const v = anello - k;

  const q = rilievo.quota;
  const a = q[i * nr + k],     b = q[j * nr + k];
  const c = q[i * nr + k + 1], e = q[j * nr + k + 1];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
}

// Riporta un nodo della maglia centrata sul vecchio fix nel sistema polare
// del fix corrente. Non interpola il paesaggio fra due fotografie: sposta i
// punti del terreno nello spazio, perciò il primo piano scorre più del fondo
// (la parallasse che si vede davvero dal finestrino).
//
// L'angolo si rifà con la distanza **nuova** e con l'occhio **di adesso**
// (`rilievo.occhioOra`, §8-bis): è quello che fa salire e scendere la
// camera insieme al terreno che si sta percorrendo — in salita si comincia
// a vedere oltre la cresta, scendendo in una conca l'orizzonte si alza.
// Con la quota dell'occhio ferma al punto di partenza, invece, il paesaggio
// scorreva ma il punto di vista restava sospeso a mezz'aria.
function rilCampioneInMovimento(sinAz, cosAz, k, scostamento, occhio) {
  const s = RIL_DIST[k];
  const eVecchio = scostamento.est + sinAz * s;
  const nVecchio = scostamento.nord + cosAz * s;
  const distanza = Math.sqrt(eVecchio * eVecchio + nVecchio * nVecchio);
  // Il punto è finito **dietro** al centro della maglia, più vicino del
  // primo anello: lì non c'è niente da leggere e l'unica cosa onesta è il
  // suolo sotto i piedi.
  if (distanza < RIL_DIST[0]) return rilAngolo(occhio - TERRENO_ALTEZZA_OCCHIO_M, occhio, s);
  const azVecchio = Math.atan2(eVecchio, nVecchio) * 180 / Math.PI;
  const quota = rilLasciaSpazioCamera(rilQuotaMaglia(azVecchio, distanza), occhio, s);
  return rilAngolo(quota, occhio, s);
}


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


// Di quanto il centro di questa maglia è spostato rispetto a quello della
// griglia grossa, in metri di Est e di Nord. `null` quando coincidono, che
// è il caso di sempre da fermo — e allora non si paga niente.
function rilScostoGriglia(lat, lon) {
  if (typeof terreno === 'undefined' || terreno.lat === null || terreno.lon === null) return null;
  const nord = (lat - terreno.lat) * 111195;
  const est = (lon - terreno.lon) * 111195 * Math.cos((lat + terreno.lat) * Math.PI / 360);
  if (Math.abs(est) < RIL_TRASLA_MIN_M && Math.abs(nord) < RIL_TRASLA_MIN_M) return null;
  return { est, nord };
}

// La quota della griglia grossa nel punto che sta a `(az, s)` da **qui**,
// tenendo conto che lei parla da un centro diverso.
function rilQuotaGrigliaDa(scosto, sinAz, cosAz, az, s) {
  if (!scosto) return rilQuotaGriglia(az, s);
  const e = scosto.est + sinAz * s;
  const n = scosto.nord + cosAz * s;
  return rilQuotaGriglia(Math.atan2(e, n) * 180 / Math.PI, Math.hypot(e, n));
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

  // La griglia grossa è centrata dove `terreno.js` l'ha chiesta, che dal
  // giorno in cui il profilo si tiene anche muovendosi (§6-bis di
  // `terreno.js`) non è più per forza qui. Lo sfondo oltre il raggio delle
  // tessere va allora chiesto **nel riferimento di lei**: senza, guidando
  // per dieci chilometri le montagne lontane restavano ferme agli azimut
  // della partenza mentre il primo piano scorreva — cioè il paesaggio si
  // strappava in due a metà distanza.
  const scostoGriglia = rilScostoGriglia(lat, lon);
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
        const qg = rilQuotaGrigliaDa(scostoGriglia, sinAz, cosAz, az, s);
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

// Le creste parziali, in una passata sola.
//
// `fronte[i][k]` è il massimo dell'angolo lungo il raggio `i` **fino
// all'anello `k` compreso**: un massimo che si accumula andando avanti,
// quindi ogni riga è non decrescente per costruzione. Da lì escono tutte e
// quattro le risposte che questo file deve dare — la cresta che decide se un
// astro è sorto, quella che nasconde una vetta, quella che taglia un lago e
// la riga che si vede sullo schermo — e sono **quattro letture dello stesso
// array**, non quattro conti che si somigliano.
//
// È anche, esattamente, il conto della rimozione dei punti nascosti: un
// campione si vede se supera il massimo di tutti quelli più vicini, cioè se
// `alt[k] > fronte[k-1]`. Il disegno (§9) rifà quella camminata invece di
// leggere qui, perché gli serve sapere *dove* si rompe e non solo il
// massimo; ma è la stessa camminata, e il §24 di `verifica.html` controlla
// che le due diano lo stesso orizzonte.
function rilRicava(alt) {
  const na = RIL_AZIMUT, nr = RIL_ANELLI;
  const cresta = new Float32Array(na);
  const fronte = new Float32Array(na * nr);
  const minAlt = new Float32Array(nr).fill(Infinity);
  const maxAlt = new Float32Array(nr).fill(-Infinity);

  for (let i = 0; i < na; i++) {
    let massimo = -Infinity;
    for (let k = 0; k < nr; k++) {
      const v = alt[i * nr + k];
      if (v > massimo) massimo = v;
      fronte[i * nr + k] = massimo;
      if (v < minAlt[k]) minAlt[k] = v;
      if (v > maxAlt[k]) maxAlt[k] = v;
    }
    cresta[i] = massimo === -Infinity ? 0 : massimo;
  }
  return { cresta, fronte, minAlt, maxAlt };
}


// =====================================================================
// 7. QUELLO CHE IL RESTO DELL'APP CHIEDE
//
//     Tre funzioni con la stessa firma e la stessa semantica di
//     `terrenoAltezza`, `terrenoFronteA` e `terrenoFrontiA`: chi chiama non
//     deve sapere da quale griglia arriva la risposta. A scegliere è
//     `terreno.js`, che le preferisce quando ci sono.
//
//     E tutte e tre leggono **lo stesso array** che disegna la superficie.
//     Non è comodità: due creste calcolate due volte divergono proprio sui
//     denti, cioè dove si appendono i nomi delle montagne.
// =====================================================================

function rilPronto() {
  return rilievo.acceso && !!rilievo.cresta && !!rilievo.alt && !!rilievo.fronte;
}

// La cresta, tosata come la tosa `terrenoMonta`: sotto zero non si scende.
// Da una cima l'orizzonte vero è **sotto** la linea, ma tutto il resto
// dell'app dà per scontato che la terra cominci a zero gradi — dal
// riempimento del terreno alla curva della notte — e un'app che si
// contraddice è peggio di un orizzonte piatto. Chi vuole il valore grezzo ha
// `rilCrestaEntroM`.
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

// Il massimo lungo il raggio **entro** una distanza qualunque, in metri, e
// **grezzo**: sotto la linea dell'orizzonte scende in negativo, ed è quel
// pezzo che disegna la conca davanti a chi guarda da una cima e che permette
// a un lago — che sta sotto la linea per definizione — di non risultare
// nascosto sempre.
//
// L'anello si sceglie prendendo **tutti quelli fino a lì compreso**, che è
// la domanda che fanno sia i laghi («cosa mi copre la riva») sia i nomi
// delle vette («a che altezza è disegnata la punta»). Sembra ovvio e non lo
// è: la versione di prima cercava l'ultima fetta di `TERRENO_DISTANZE`
// *entro* la distanza, cioè si fermava a quella **prima** della vetta, e
// l'aggancio del nome cadeva sistematicamente troppo in basso — superava
// `SKY_CIME_AGGANCIO_MAX` e l'etichetta veniva scartata in silenzio. Qui
// l'anello è quello della maglia, non una fetta grossa, e il confronto è
// `<=`: la punta ci sta dentro.
function rilCrestaEntroM(az, metri) {
  if (!rilPronto()) return null;
  const nr = RIL_ANELLI;
  let k = -1;
  for (let j = 0; j < nr; j++) { if (RIL_DIST[j] <= metri) k = j; else break; }
  if (k < 0) k = 0;
  const dove = (((az % 360) + 360) % 360) / RIL_PASSO_AZ;
  const i = Math.floor(dove) % RIL_AZIMUT;
  const j2 = (i + 1) % RIL_AZIMUT;
  const t = dove - Math.floor(dove);
  const s = t * t * (3 - 2 * t);
  return rilievo.fronte[i * nr + k] * (1 - s) + rilievo.fronte[j2 * nr + k] * s;
}

// Le stesse creste parziali, ma alle diciotto distanze di `TERRENO_DISTANZE`:
// è la forma che `terreno.js` espone da sempre, e chi la legge non deve
// accorgersi di niente.
function rilFronteA(az, k) {
  if (!rilPronto()) return null;
  const d = TERRENO_DISTANZE[k];
  if (!(d > 0)) return null;
  return rilCrestaEntroM(az, d * 1000);
}

// Il punto del rilievo che sta sotto un tocco del planetario. Non basta
// restituire la cresta: nella veduta 3D si possono indicare anche un fianco o
// il fondo della valle. Percorriamo lo stesso raggio usato dal disegno e
// teniamo soltanto i campioni realmente visibili (ogni campione deve superare
// il massimo incontrato prima). Fra questi scegliamo quello più vicino
// all'altezza indicata dal dito.
function rilPuntoVisibileA(az, alt) {
  if (!rilPronto() || !isFinite(az) || !isFinite(alt)) return null;
  const nr = RIL_ANELLI;
  const dove = (((az % 360) + 360) % 360) / RIL_PASSO_AZ;
  const i = Math.floor(dove) % RIL_AZIMUT;
  const j = (i + 1) % RIL_AZIMUT;
  const t = dove - Math.floor(dove);
  const s = t * t * (3 - 2 * t);
  const a = i * nr, b = j * nr;
  let fronte = -90, migliore = -1, altezzaMigliore = null, scarto = Infinity;
  for (let k = 0; k < nr; k++) {
    const altezza = rilievo.alt[a + k] * (1 - s) + rilievo.alt[b + k] * s;
    if (altezza + 1e-4 < fronte) continue;
    fronte = Math.max(fronte, altezza);
    const d = Math.abs(altezza - alt);
    if (d < scarto) { scarto = d; migliore = k; altezzaMigliore = altezza; }
  }
  if (migliore < 0) return null;
  return { km: RIL_DIST[migliore] / 1000, alt: altezzaMigliore, scarto };
}

// A che quota sta il suolo lungo un raggio, fra due distanze: il **minimo**
// dei nodi della maglia che ci cascano dentro, `null` se non ce n'è nessuno.
//
// Serve alla quota degli specchi d'acqua, e serve per una ragione che non è
// la finezza — anche se centosei anelli al posto di diciotto fette non
// guastano, e sono la differenza fra avere un campione dentro a un fiume e
// non averne nessuno.
//
// La ragione è che **le due misure devono venire dallo stesso modello**. Il
// piano del lago si ricavava dalla griglia grossa (Copernicus a novanta
// metri, dal servizio delle quote) mentre il terreno che lo copre lo disegna
// questa maglia (SRTM a trenta, dalle tessere): sono due misure diverse
// della stessa collina, e in terreno ripido non danno lo stesso metro — dieci
// o venti di scarto sono normali, ed è la ragione per cui `rilievo.scarto`
// esiste. Confrontarle vuol dire chiedere se la riva sta sopra il lago
// sapendo le due quote da due fonti che litigano: la riva risulta più alta
// dell'acqua di quanto litigano, e il lago viene tagliato per un dislivello
// che nessuno dei due modelli afferma. Lo scarto è tolto **nel punto in cui
// si sta**, non ovunque, quindi il litigio resta tutto intero là fuori.
//
// Letta di qui, invece, la quota dell'acqua e quella del terreno davanti sono
// lo stesso array: il confronto torna a essere una domanda di geometria.
//
// L'azimut non si interpola, e non è una scorciatoia: la maglia ha
// settecentoventi raggi e le bande dell'acqua pure, con lo stesso passo di
// mezzo grado. È lo stesso raggio.
function rilQuoteDentro(az, daM, aM) {
  if (!rilPronto() || !rilievo.quota) return null;
  const nr = RIL_ANELLI;
  const i = ((Math.round(((az % 360) + 360) % 360 / RIL_PASSO_AZ) % RIL_AZIMUT) + RIL_AZIMUT) % RIL_AZIMUT;
  const a = i * nr;
  let minimo = null;
  for (let k = 0; k < nr; k++) {
    const d = RIL_DIST[k];
    if (d < daM) continue;
    if (d > aM) break;
    const q = rilievo.quota[a + k];
    if (minimo === null || q < minimo) minimo = q;
  }
  return minimo;
}

// I due nodi che **abbracciano** un tratto: l'ultimo prima e il primo dopo.
// È il ripiego di qui sopra per gli specchi troppo stretti perché un anello
// ci caschi dentro — un fiume, una pozza — e di uno specchio d'acqua dice la
// sola cosa che si sa comunque: che è più basso di quello che ha attorno.
function rilQuoteAttorno(az, daM, aM) {
  if (!rilPronto() || !rilievo.quota) return null;
  const nr = RIL_ANELLI;
  const i = ((Math.round(((az % 360) + 360) % 360 / RIL_PASSO_AZ) % RIL_AZIMUT) + RIL_AZIMUT) % RIL_AZIMUT;
  const a = i * nr;
  let prima = null, dopo = null;
  for (let k = 0; k < nr; k++) {
    const d = RIL_DIST[k];
    if (d < daM) prima = rilievo.quota[a + k];
    else if (d > aM) { dopo = rilievo.quota[a + k]; break; }
  }
  if (prima === null) return dopo;
  if (dopo === null) return prima;
  return Math.min(prima, dopo);
}

// La cresta che serve all'**acqua**, che è una domanda diversa da tutte le
// altre di questo file — e per una ragione geometrica che vale la pena
// scrivere, perché è quella che ha tenuto i laghi fuori dallo schermo.
//
// Un lago è un **piano**. Guardandolo dall'alto, ogni suo punto sta sotto la
// linea dell'orizzonte, e la riva vicina è il punto più basso di tutti: la
// sua depressione è la più grande. Ma la riva è anche il posto dove il
// terreno **finisce a quel livello** — cioè, per un pendio che scende al
// lago, il suolo davanti alla riva ha quasi esattamente la stessa
// depressione dell'acqua che le sta dietro. Chiedere «la cresta davanti è
// più alta dell'acqua?» con un margine di un ventesimo di grado vuol dire
// giocarsi la riva a testa o croce: misurato sul banco, con un modello del
// suolo che sbaglia di otto metri — cioè un tetto, un albero, la normale
// differenza fra due modelli — la riva arretra di settanta metri in media e
// di un chilometro e mezzo al peggio, e in una direzione su venti il lago
// sparisce del tutto.
//
// La cura viene dalla stessa geometria. Un campione che sta **al livello
// dell'acqua o sotto** non può nascondere quell'acqua, mai: se è più vicino,
// la sua depressione è più grande (stesso dislivello diviso una distanza
// minore), quindi sta sotto la linea di vista. Quelli che tagliano la riva
// sono perciò solo quelli che stanno **qualche metro sopra** il piano del
// lago — e «qualche metro» è esattamente la misura dell'errore di un modello
// di superficie. Quindi il margine si scrive in **metri di quota** e non in
// gradi: ogni campione si abbassa di `abbassaM` metri prima di chiedergli se
// copre. A trecento metri sono più di un grado, a cinque chilometri sette
// centesimi — cioè tanto dove il rumore fa danno e niente dove non ne fa.
//
// Il risultato è in **tangente** e non in gradi, perché il confronto con la
// linea di vista di un punto è un confronto fra pendenze: `tan = (quota −
// occhio − curvatura) / distanza`, la stessa quantità che `rilAngolo`
// arcotangenta. E si accumula il massimo, come `fronte`: ogni voce è
// «la pendenza più alta incontrata fino a qui».
// La pendenza si ricava dalle **quote** e non dagli angoli già pronti, e non
// è pignoleria: sono settantaseimila anelli a giro (settecentoventi raggi per
// centosei), e altrettante tangenti da calcolare costavano più di tutto il
// resto della funzione. Da `rilievo.quota` la stessa quantità esce con una
// sottrazione e una divisione — ed esce anche più esatta, perché non passa
// per la tosatura a ottantacinque gradi che `rilAngolo` mette al nadir.
let rilFrontiAcquaBuf = null;

function rilFrontiAcqua(az, abbassaM, tettoGradi, finoA) {
  if (!rilPronto() || !rilievo.quota) return null;
  const nr = RIL_ANELLI;
  // Più in là dell'acqua più lontana di questa direzione non serve camminare:
  // la cresta oltre la banda non copre niente che si stia guardando. Su un
  // posto con un lago vicino sono venti anelli invece di centosei, e questa
  // funzione gira settecentoventi volte a ogni ricostruzione della maglia.
  // (Il passo di riga resta `nr`: sono due numeri diversi, e confonderli vuol
  // dire leggere le quote di un altro raggio.)
  const quanti = (typeof finoA === 'number' && isFinite(finoA) && finoA > 0)
    ? Math.min(nr, Math.ceil(rilAnelloDi(finoA)) + 2)
    : nr;
  if (!rilFrontiAcquaBuf) rilFrontiAcquaBuf = new Float32Array(nr);
  const fuori = rilFrontiAcquaBuf;
  const dove = (((az % 360) + 360) % 360) / RIL_PASSO_AZ;
  const i = Math.floor(dove) % RIL_AZIMUT;
  const j = (i + 1) % RIL_AZIMUT;
  const t = dove - Math.floor(dove);
  const s = t * t * (3 - 2 * t);
  const a = i * nr, b = j * nr;
  // L'abbassamento non può superare qualche grado, ed è il freno che tiene in
  // piedi il primo piano: a tre metri dai piedi sei metri di quota sono
  // sessantatré gradi, cioè «niente qui davanti copre niente» — e chi guarda
  // l'acqua dall'orlo di una scogliera ha proprio l'orlo a nasconderla.
  const tetto = Math.tan((tettoGradi || 3) * Math.PI / 180);
  // La camera con cui la maglia è stata costruita: è l'occhio a cui gli
  // angoli di `rilievo.alt` sono riferiti, e dev'essere lo stesso qui.
  const occhio = typeof rilievo.occhio === 'number'
    ? rilievo.occhio
    : ((typeof terreno !== 'undefined' && typeof terreno.quota === 'number' ? terreno.quota : 0)
       + TERRENO_ALTEZZA_OCCHIO_M);
  const curva = (1 - TERRENO_RIFRAZIONE) / (2 * TERRENO_RAGGIO_KM * 1000);
  let massimo = -Infinity;
  for (let k = 0; k < quanti; k++) {
    const d = RIL_DIST[k];
    // Il **grembiule** non risponde a questa domanda, e lasciarglielo fare è
    // il modo in cui l'acqua spariva tutta insieme.
    //
    // I dieci anelli sotto i venticinque metri stanno lì per **disegnare** il
    // suolo sotto le scarpe, e la loro quota è la lettura bilineare della
    // cella di raster su cui si sta: ventisette metri di lato, cioè lo stesso
    // numero che c'è sotto i piedi. Non portano nessuna informazione propria
    // — non possono, il modello lì dentro non ha niente da dire — ma a
    // quindici centimetri dall'occhio un metro di quota vale ottantun gradi.
    // Basta perciò che la camera e la maglia non siano d'accordo di due metri
    // (una quota che arriva dalla rete, l'occhio portato al pelo dell'acqua,
    // un fix del GPS a metà strada) perché il primo anello dichiari una
    // parete verticale — e siccome `fronte` è un massimo che si accumula,
    // quella parete si ricopia in **tutti** gli anelli di quel raggio: da lì
    // in poi qualunque cosa risulta coperta, a qualunque distanza. Misurato
    // sul banco con due metri di disaccordo: ottantanove gradi di cresta in
    // tutte e settecentoventi le direzioni, e zero acqua disegnata su
    // trecentotrentacinque direzioni che ne avevano.
    //
    // Il suolo sotto le scarpe non nasconde niente. La camminata comincia
    // dove il modello ricomincia a parlare.
    if (d < RIL_VICINO_M) { fuori[k] = -Infinity; continue; }
    const q = rilievo.quota[a + k] * (1 - s) + rilievo.quota[b + k] * s;
    const v = (q - occhio) / d - curva * d - Math.min(tetto, abbassaM / d);
    if (v > massimo) massimo = v;
    fuori[k] = massimo;
  }
  // `n` è fin dove il buffer è stato riempito in questo giro: oltre ci sono i
  // resti del giro di prima, e chi legge non deve guardarli.
  return { tan: fuori, dist: RIL_DIST, n: quanti };
}

function rilFrontiA(az, fuori) {
  if (!rilPronto()) return null;
  const nd = TERRENO_DISTANZE.length;
  const out = (fuori && fuori.length >= nd) ? fuori : new Float32Array(nd);
  const nr = RIL_ANELLI;
  const dove = (((az % 360) + 360) % 360) / RIL_PASSO_AZ;
  const i = Math.floor(dove) % RIL_AZIMUT;
  const j = (i + 1) % RIL_AZIMUT;
  const t = dove - Math.floor(dove);
  const s = t * t * (3 - 2 * t);
  const a = i * nr, b = j * nr;
  let k = 0;
  for (let d = 0; d < nd; d++) {
    const limite = TERRENO_DISTANZE[d] * 1000;
    while (k + 1 < nr && RIL_DIST[k + 1] <= limite) k++;
    out[d] = rilievo.fronte[a + k] * (1 - s) + rilievo.fronte[b + k] * s;
  }
  return out;
}


// =====================================================================
// 8. L'INNESCO
// =====================================================================

// Il posto da cui si guarda è lo stesso di `terreno.js`: il luogo di sola
// visita del planetario se c'è, se no la posizione dell'app — e in
// movimento il **punto vivo**, cioè l'ultimo fix grezzo portato avanti
// dalla corsa (§6-bis di `terreno.js`). La differenza si vede tutta: la
// posizione dell'app avanza a scatti di centocinquanta metri, che è la
// soglia sotto la quale un fix è respiro del sensore, e il paesaggio
// disegnato con quella saltava da un fermo all'altro.
function rilLuogo() {
  if (typeof terrenoPuntoDaDisegnare === 'function') return terrenoPuntoDaDisegnare();
  return typeof terrenoLuogo === 'function' ? terrenoLuogo() : null;
}

function rilScorda() {
  rilievo.quota = null;
  rilievo.alt = null;
  rilievo.cresta = null;
  rilievo.fronte = null;
  rilievo.minAlt = null;
  rilievo.maxAlt = null;
  rilievo.chiave = null;
  rilievo.fini = 0;
  rilievo.occhioOra = null;
  rilTessere = new Map();
}


// --- 8-bis. La camera che cammina dentro al paesaggio -----------------
//
// La quota dell'occhio è il termine che si **sottrae a tutti gli angoli**:
// alzarla di dieci metri abbassa di dieci metri tutto l'orizzonte, vicino e
// lontano. Da fermo la si prende una volta e lì resta. Muovendosi no — ed è
// la differenza fra una fotografia che scorre e una camera che percorre il
// terreno: passando un valico si comincia a vedere oltre la cresta *perché
// si è saliti*, e scendendo in una conca l'orizzonte si chiude addosso.
// Prima quel numero restava quello del punto di partenza, e il paesaggio
// scorreva sotto un punto di vista appeso a mezz'aria.
//
// Il suolo lo dicono le tessere, che sono già in memoria: una lettura
// bilineare per fotogramma, e nient'altro. Lo `scarto` è lo stesso che
// `rilCostruisciMaglia` ha misurato per mettere d'accordo tessere e griglia
// grossa — senza di lui l'occhio si troverebbe su un'altra superficie da
// quella disegnata, che è il difetto che quello scarto esiste per curare.

// Le tessere che servono a questo punto ci sono già tutte? È la domanda che
// separa il calcolo dalla rete.
function rilTessereBastano(lat, lon) {
  if (!rilTessere.size) return false;
  let elenco = rilTessereAttorno(lat, lon, RIL_RAGGIO_KM);
  if (elenco.length > RIL_TESSERE_MAX) elenco = elenco.slice(0, RIL_TESSERE_MAX);
  return elenco.every(t => rilTessere.has(`${t.x}/${t.y}`));
}

// Quelle che ci si è lasciati dietro. Non si buttano subito — tornare sui
// propri passi è la cosa più normale del mondo — ma nemmeno si tengono
// tutte: viaggiando, un quarto di megabyte a tessera diventa presto un
// conto vero.
function rilPotaTessere(lat, lon) {
  if (rilTessere.size <= RIL_TESSERE_TENUTE) return;
  const o = rilPixelMondo(lat, lon, RIL_ZOOM);
  const L = rilLatoTessera;
  const ordinate = [...rilTessere.keys()].map(chiave => {
    const [x, y] = chiave.split('/').map(Number);
    const dx = (x + 0.5) * L - o.px, dy = (y + 0.5) * L - o.py;
    return { chiave, d: dx * dx + dy * dy };
  }).sort((a, b) => a.d - b.d);
  for (let i = RIL_TESSERE_TENUTE; i < ordinate.length; i++) rilTessere.delete(ordinate[i].chiave);
}

// La quota del suolo sotto un punto, nel riferimento della griglia grossa
// (cioè lo stesso in cui è scritta `terreno.quota`). `null` se lì le
// tessere non ci sono.
function rilQuotaSuolo(lat, lon) {
  if (!rilTessere.size) return null;
  const o = rilPixelMondo(lat, lon, RIL_ZOOM);
  const q = rilQuotaTessere(o.px, o.py);
  return q === null ? null : q + (rilievo.scarto || 0);
}

// Dove dovrebbe stare la camera in un punto: il suolo che c'è lì sotto più
// l'altezza di una persona. Quando le tessere non sanno rispondere resta la
// quota misurata a punti, che è quella di sempre.
function rilOcchioMeta(lat, lon) {
  const misurata = typeof terreno !== 'undefined' && typeof terreno.quota === 'number';
  const fermo = (misurata ? terreno.quota : 0) + TERRENO_ALTEZZA_OCCHIO_M;
  // Stando sull'acqua la quota non è quella del suolo ma quella della
  // superficie, e a stabilirlo è `acqueAllineaOcchio` in `terreno.js`: lì
  // comanda lei, e le tessere — che il pelo dell'acqua non lo conoscono —
  // non devono rimetterci mano.
  if (typeof terreno !== 'undefined' && terreno.quotaAcqua) return fermo;
  // Vicino al centro della griglia comanda la misura di lì. È il punto di
  // cui `terreno.js` ha chiesto la quota per davvero, ed è quel numero il
  // riferimento di tutta l'app — le creste, l'acqua, le vette. Usarlo qui
  // è anche il modo in cui `rilCostruisciMaglia` torna a **misurare** lo
  // scarto fra i due modelli del suolo invece di riportarselo dietro: le
  // due cose combaciano di sicuro, perché quello scarto è definito
  // esattamente come «quanto le tessere sbagliano in questo punto».
  if (misurata && typeof terrenoDistanzaKm === 'function' &&
      terreno.lat !== null && terreno.lon !== null &&
      terrenoDistanzaKm(lat, lon, terreno.lat, terreno.lon) <= RIL_OCCHIO_GRIGLIA_KM) {
    return fermo;
  }
  const suolo = rilQuotaSuolo(lat, lon);
  return suolo === null ? fermo : suolo + TERRENO_ALTEZZA_OCCHIO_M;
}

// Un nuovo dato altimetrico non deve mai diventare un teletrasporto della
// camera. In viaggio può arrivare dopo il fix che l'ha richiesto e correggere
// anche di centinaia di metri la stima precedente: proprio nell'istante in
// cui finiscono di caricarsi le tessere, saltare direttamente alla nuova
// quota produce il colpo verso l'alto che si vede dal finestrino. I cambi di
// luogo veri passano invece da `rilScorda`, che azzera `occhioOra`, quindi non
// c'è bisogno di dedurli (male) dalla sola differenza di quota.
function rilSmussaOcchio(attuale, meta, dt) {
  const tempo = Math.max(0, Math.min(1000, dt));
  const a = 1 - Math.exp(-tempo / RIL_OCCHIO_TAU_MS);
  const passoMorbido = (meta - attuale) * a;
  const passoMassimo = RIL_OCCHIO_V_MAX_M_S * tempo / 1000;
  const passo = Math.max(-passoMassimo, Math.min(passoMassimo, passoMorbido));
  return attuale + passo;
}

// Garantisce lo spazio fisico attorno alla camera mentre una quota arrivata
// dalla rete viene assorbita. Il limite vale solo nel grembiule invisibile
// sotto i piedi: oltre `RIL_SPAZIO_CAMERA_M` la montagna resta esattamente
// quella misurata, anche quando sale davvero davanti all'osservatore.
function rilLasciaSpazioCamera(quota, occhio, metri) {
  if (metri >= RIL_SPAZIO_CAMERA_M) return quota;
  const suoloCamera = occhio - TERRENO_ALTEZZA_OCCHIO_M;
  if (quota <= suoloCamera) return quota;
  const t = Math.max(0, metri / RIL_SPAZIO_CAMERA_M);
  // Smoothstep: nessuna piega né sotto i piedi né al termine del raccordo.
  const peso = t * t * (3 - 2 * t);
  return suoloCamera + (quota - suoloCamera) * peso;
}

// La quota dell'occhio adesso, inseguita con dolcezza. Da usare nel disegno
// e nella ricostruzione della maglia: sono la stessa camera.
function rilOcchioOra() {
  const luogo = rilLuogo();
  if (!rilPronto() || !luogo) {
    rilievo.occhioOra = null;
    return luogo ? rilOcchioMeta(luogo.lat, luogo.lon) : TERRENO_ALTEZZA_OCCHIO_M;
  }
  const meta = rilOcchioMeta(luogo.lat, luogo.lon);

  const ora = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (rilievo.occhioOra === null || !isFinite(rilievo.occhioOra)) {
    rilievo.occhioOra = meta;
    rilievo.occhioQuando = ora;
    return meta;
  }
  // Smorzamento esponenziale col `dt` del fotogramma, come tutti i
  // movimenti morbidi dell'app: a trenta o a centoventi fotogrammi al
  // secondo la salita dura lo stesso.
  const dt = ora - (rilievo.occhioQuando || ora);
  rilievo.occhioQuando = ora;
  rilievo.occhioOra = rilSmussaOcchio(rilievo.occhioOra, meta, dt);
  return rilievo.occhioOra;
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
  // L'occhio della maglia nuova è quello **di adesso**, cioè il suolo sotto
  // i piedi in questo punto (§8-bis) e non la quota del centro precedente:
  // ricostruire la superficie con la camera di dieci chilometri fa vorrebbe
  // dire raddrizzare a mano tutto quello che si era appena inclinato.
  const occhio = rilOcchioMeta(lat, lon);
  const chiave = rilChiaveDi(lat, lon, occhio);
  if (chiave === rilievo.chiave) return true;

  rilievo.inCostruzione = true;
  rilievo.daRifare = false;
  rilievo.stato = 'in-corso';
  rilievo.motivo = '';
  if (typeof terrenoAggiornaPannello === 'function') terrenoAggiornaPannello();

  try {
    // Le tessere si riscaricano solo se quelle che servono non ci sono più.
    // È la separazione che rende possibile tutto il resto: **ricostruire la
    // maglia non costa rete**, quindi la si può rifare ogni sessanta metri
    // (`rilControlla`) senza che nessuno paghi niente, mentre il megabyte di
    // tessere si ricompra solo attraversando il bordo del disco coperto —
    // che a questo zoom è un affare di chilometri. Prima le due cose erano
    // legate da una soglia sola, e la soglia era per forza quella cara.
    if (!rilTessereBastano(lat, lon) &&
        Date.now() - (rilievo.ultimeTessere || 0) >= RIL_TESSERE_MIN_MS) {
      let elenco = rilTessereAttorno(lat, lon, RIL_RAGGIO_KM);
      // Più di quante se ne possono permettere: si tengono le più vicine,
      // che è come dire che il raggio si stringe. Meglio un primo piano
      // fine e uno sfondo grosso che il contrario.
      if (elenco.length > RIL_TESSERE_MAX) elenco = elenco.slice(0, RIL_TESSERE_MAX);
      // Solo quelle che mancano: quelle che si hanno già sono le stesse
      // colline, e ricomprarle attraversando un confine di tessera sarebbe
      // un megabyte per non cambiare niente.
      const mancanti = elenco.filter(t => !rilTessere.has(`${t.x}/${t.y}`));
      if (mancanti.length) {
        rilievo.ultimeTessere = Date.now();
        rilLatoTessera = await rilPrendiTessere(mancanti);
        rilPotaTessere(lat, lon);
      }
    }

    const maglia = await rilCostruisciMaglia(lat, lon, occhio);
    const derivate = rilRicava(maglia.alt);
    rilievo.quota = maglia.quota;
    rilievo.alt = maglia.alt;
    rilievo.fini = maglia.fini;
    rilievo.scarto = maglia.scarto;
    rilievo.cresta = derivate.cresta;
    rilievo.fronte = derivate.fronte;
    rilievo.minAlt = derivate.minAlt;
    rilievo.maxAlt = derivate.maxAlt;
    rilievo.lat = lat;
    rilievo.lon = lon;
    rilievo.occhio = occhio;
    rilievo.chiave = chiave;
    rilievo.ultimoCaricamento = Date.now();
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
  if (rilChiaveDi(luogo.lat, luogo.lon, rilOcchioMeta(luogo.lat, luogo.lon)) === rilievo.chiave) return;
  // Il centro nuovo si prepara presto e spesso: sessanta metri, non
  // quattrocentocinquanta. Ricostruire è aritmetica a scaglioni, e mentre
  // gira resta disegnata quella vecchia — già traslata verso il punto nuovo,
  // quindi non si vede nessun salto. Quello che si guadagna è che
  // `rilievo.cresta` e `rilievo.fronte` — cioè le risposte a «quell'astro è
  // sorto?», «quella vetta si vede?», «dove finisce quel lago?» — restano
  // agganciate al terreno che si sta davvero disegnando.
  if (rilievo.cresta) {
    if (rilDistanzaDalCentro(luogo) < RIL_RICENTRA_M) return;
    if (Date.now() - rilievo.ultimoCaricamento < RIL_RICENTRA_MIN_MS) return;
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

// =====================================================================
// 9. IL DISEGNO
//
//     Non una superficie ombreggiata a poligoni, ma **disegno a tratti**: un
//     fondo, una pettinatura di righe sottili lungo la linea di massima
//     pendenza, e le righe chiare dove un piano si stacca da quello dietro.
//     È come sono fatte le tavole panoramiche, ed è anche — non per caso —
//     il modo più economico di disegnarlo su una tela 2D.
//
//     Il conto: un poligono pieno per faccia vuol dire migliaia di `fill()`,
//     e le chiamate costano più dei pixel. I tratti invece si **raggruppano
//     per livello di chiaroscuro**: ventiquattro tracciati con dentro
//     migliaia di segmenti, ventiquattro `stroke()`. Misurato nel browser su
//     un caso della stessa taglia: 2.800 chiamate e 9,9 ms contro 13 chiamate
//     e 3,2 ms.
//
//     Tutto esce da **una camminata sola** per ogni raggio. Andando dai piedi
//     verso l'orizzonte e tenendo il massimo dell'angolo visto finora, un
//     campione si vede se supera quel massimo: è la rimozione dei punti
//     nascosti di un campo di quote, ed è esatta, non approssimata. La stessa
//     camminata dà quattro cose:
//
//       - i tratti dove il terreno si vede            → la pettinatura
//       - il punto più alto                            → la sagoma
//       - il punto in cui si rompe                     → i contorni interni
//       - il massimo corrente                          → `fronte` (§6)
//
//     Da qui vengono, per costruzione, le due cose che nella versione a
//     poligoni non tornavano: la riga bianca **non può** staccarsi dal
//     crinale (è lo stesso array), e non c'è nessun livello di dettaglio
//     sugli anelli da far ballare fra un fotogramma e l'altro — il raggio si
//     percorre sempre tutto, perché una polilinea costa uguale.
// =====================================================================

// I magazzini di lavoro. Migliaia di segmenti per fotogramma allocati ogni
// volta sarebbero decine di megabyte al secondo da far raccogliere.
let rilTratti = null;      // un array di coordinate per livello di chiaroscuro
let rilCrestaX = null;     // la sagoma disegnata, in pixel
let rilCrestaY = null;
let rilCrestaA = null;     // e in gradi, per chi la chiede dopo
let rilCrestaK = null;     // a che anello sta il massimo (serve alla foschia)
let rilFondoX = null;      // le creste parziali delle fette di fondo
let rilFondoY = null;      // (RIL_FONDI curve, una sopra l'altra)
let rilColonneUltime = 0;  // quante colonne vale la sagoma appena disegnata
let rilAnelloUltimo = null;    // e da che parte sta la terra: 'fuori', 'dentro' o niente
let rilRottX = null;       // i punti di rottura: fino a RIL_ROTTURE per colonna
let rilRottY = null;
let rilRottK = null;
let rilRottN = null;

const RIL_ROTTURE = 6;

function rilMagazzino(nCol) {
  if (!rilTratti) {
    rilTratti = [];
    for (let i = 0; i < RIL_LIVELLI; i++) rilTratti.push({ v: new Float32Array(8192), n: 0 });
  }
  if (!rilCrestaX || rilCrestaX.length < nCol) {
    const n = Math.max(nCol, 1024);
    rilCrestaX = new Float32Array(n);
    rilCrestaY = new Float32Array(n);
    rilCrestaA = new Float32Array(n);
    rilCrestaK = new Int32Array(n);
    rilFondoX = new Float32Array(n * RIL_FONDI);
    rilFondoY = new Float32Array(n * RIL_FONDI);
    rilRottX = new Float32Array(n * RIL_ROTTURE);
    rilRottY = new Float32Array(n * RIL_ROTTURE);
    rilRottK = new Int32Array(n * RIL_ROTTURE);
    rilRottN = new Int32Array(n);
  }
}

// Una striscia di ombreggiatura: un segmento largo una colonna. Non e' un
// quadrilatero per ogni faccia (quello costava 43 ms): tutte le strisce dello
// stesso livello restano in un solo tracciato e richiedono una sola stroke.
// I due estremi, pero', sono quelli proiettati davvero. A campo largo una
// colonna di azimut costante e' obliqua ai lati dello schermo; forzarla dentro
// un rettangolo verticale produceva proprio i tasselli che comparivano nel
// cielo e sul terreno durante lo zoom.
function rilMettiStriscia(liv, x0, y0, x1, y1) {
  const t = rilTratti[liv];
  if (t.n + 4 > t.v.length) {
    const piu = new Float32Array(t.v.length * 2);
    piu.set(t.v);
    t.v = piu;
  }
  t.v[t.n++] = x0; t.v[t.n++] = y0; t.v[t.n++] = x1; t.v[t.n++] = y1;
}

// Il segmento sborda di un pixel e mezzo ai due capi: le corse consecutive
// si sovrappongono appena e non lasciano la cucitura dell'antialiasing.
const RIL_STRISCIA_SBORDO = 1.5;

function rilChiudiRun(liv, x0, y0, x1, y1) {
  // A campo largo un meridiano non e' verticale: nella stereografica e' un
  // arco, e ai lati del riquadro puo' correre parecchi pixel anche in x.
  // Conservare solo min/max y e dipingere un rettangolo verticale trasformava
  // quel tratto obliquo in una colonna sospesa, visibile alternativamente nel
  // cielo o nel primo piano mentre cambiava il FOV. La striscia segue invece
  // i due estremi proiettati; il piccolo prolungamento copre ancora le
  // cuciture fra due corse consecutive.
  let dx = x1 - x0, dy = y1 - y0;
  const m = Math.hypot(dx, dy);
  if (m < 0.01) { dy = 1; dx = 0; }
  else { dx /= m; dy /= m; }
  rilMettiStriscia(liv,
    x0 - dx * RIL_STRISCIA_SBORDO, y0 - dy * RIL_STRISCIA_SBORDO,
    x1 + dx * RIL_STRISCIA_SBORDO, y1 + dy * RIL_STRISCIA_SBORDO);
  return 1;
}

// La sagoma del terreno disegnato: il crinale, chiuso giù fino a fuori dal
// riquadro. Serve al ritaglio dell'ombreggiatura e — fuori di qui — a chi
// deve appoggiare qualcosa **sul terreno e non sotto la riga
// dell'orizzonte**: la grana di `skyDisegnaGranaTerreno`, che senza questa
// si fermava a zero gradi e da una cima lasciava una cucitura di trama in
// mezzo al panorama.
// Torna la regola di riempimento da usare (`'nonzero'` o `'evenodd'`), oppure
// `null` se non c'è niente da ritagliare — come fa `skyTracciaSuolo` in
// `app.js`, e per la stessa ragione: la forma della terra sullo schermo non è
// sempre la stessa, e chi la usa deve saperlo.
function rilTracciaSagoma(ctx) {
  const nCol = rilColonneUltime;
  ctx.beginPath();
  if (nCol < 2 || !rilCrestaX) return null;
  let dentro = false, primo = -1, ultimo = -1;
  for (let c = 0; c < nCol; c++) {
    if (Number.isNaN(rilCrestaX[c])) continue;
    if (dentro) ctx.lineTo(rilCrestaX[c], rilCrestaY[c]);
    else { ctx.moveTo(rilCrestaX[c], rilCrestaY[c]); dentro = true; primo = c; }
    ultimo = c;
  }
  if (!dentro) return null;
  if (rilAnelloUltimo) {
    // Il crinale gira attorno al cielo (vedi `RIL_ANELLO_GRADI`). Guardando
    // in su la terra è tutto quello che gli sta **fuori** — il riquadro meno
    // l'anello, con la regola pari-dispari, la stessa cosa che
    // `skyTracciaSuolo` fa col cerchio dell'orizzonte; guardando in giù ci
    // sta **dentro**, e allora l'anello basta da solo.
    ctx.closePath();
    if (rilAnelloUltimo === 'dentro') return 'nonzero';
    ctx.rect(0, 0, sky.larghezza, sky.altezza);
    return 'evenodd';
  }
  // Giù fino a fuori dal riquadro, da tutt'e due i lati: il terreno arriva
  // ai piedi, e il ritaglio deve arrivarci con lui.
  const giu = sky.altezza + Math.max(sky.larghezza, sky.altezza);
  ctx.lineTo(rilCrestaX[ultimo] + sky.larghezza, giu);
  ctx.lineTo(rilCrestaX[primo] - sky.larghezza, giu);
  ctx.closePath();
  return 'nonzero';
}

// Il passo delle colonne, con l'isteresi.
//
// Si sceglie fra le potenze di due, e si cambia solo quando si è **ben**
// oltre il punto di scambio: un passo che segue con continuità la focale
// vuol dire disegnare colonne diverse a ogni fotogramma mentre si pizzica, e
// il tratteggio balla. È il difetto per cui la versione a poligoni
// sfarfallava, tolto alla radice invece che ammorbidito.
function rilPassoColonne(pxGrado) {
  const voluto = RIL_PX_MIN / Math.max(1e-6, RIL_PASSO_AZ * pxGrado);
  let p = rilievo.passo || 1;
  // Le due soglie non sono simmetriche, ed è tutto il punto: si sale a `2p`
  // solo quando il passo di adesso è **chiaramente** troppo fitto, e si
  // scende a `p/2` solo quando è chiaramente troppo rado. Fra le due c'è una
  // fascia morta in cui non succede niente, ed è lei che tiene fermo il
  // disegno mentre il dito pizzica.
  //
  // Scritto al contrario — la soglia per scendere più alta di quella per
  // salire — non c'è nessuna fascia morta, anzi: le due si scavalcano e il
  // passo balla a ogni fotogramma. Misurato: ventisei cambi in
  // duecentoquaranta fotogrammi di pizzicata, cioè uno sfarfallio.
  while (p < 32 && voluto > p * RIL_ISTERESI) p *= 2;
  while (p > 1 && voluto < (p / 2) / RIL_ISTERESI) p /= 2;
  rilievo.passo = p;
  return p;
}

// Da dove viene la luce, e di che colore. L'azimut è quello vero dell'astro,
// l'altezza no (vedi `RIL_LUCE_ALT_MIN`).
function rilLuce(base) {
  const l = (typeof skyLucePaesaggio === 'function') ? skyLucePaesaggio() : null;
  let vera = null, forza = 0;
  if (l && sky.oggetti) {
    const sole = sky.oggetti.find(o => o.id === 'Sun');
    const luna = sky.oggetti.find(o => o.id === 'Moon');
    const corpo = (sole && sole.az === l.az) ? sole : luna;
    if (corpo) {
      vera = skyVettore(corpo.az, Math.max(RIL_LUCE_ALT_MIN, corpo.alt));
      forza = Math.max(0, Math.min(1, l.forza));
    }
  }
  // La luce di servizio: dietro, sopra e a sinistra di chi guarda.
  const f = base.f, r = base.r, u = base.u;
  const sx = f[0] * 0.62 + u[0] * 0.62 - r[0] * 0.48;
  const sy = f[1] * 0.62 + u[1] * 0.62 - r[1] * 0.48;
  const sz = f[2] * 0.62 + u[2] * 0.62 - r[2] * 0.48;
  const m = Math.hypot(sx, sy, sz) || 1;
  return {
    vera, forza, servizio: [sx / m, sy / m, sz / m],
    calda: (l && l.calda) ? l.calda : [255, 255, 255],
    fredda: (l && l.fredda) ? l.fredda : [120, 140, 170]
  };
}

// La foschia di una distanza: **esattamente** la stessa riga di
// `skyPianiOrizzonte`, `SKY_FOSCHIA_KM` compreso. Non è pigrizia, è un
// vincolo — il §23 di `verifica.html` controlla che il velo di un nome di
// paese e quello del terreno alla sua distanza siano la stessa cifra, e
// cambiare qui la legge vorrebbe dire nomi nitidi su montagne sbiadite.
function rilLontananza(km) {
  const pieno = 1 - Math.exp(-TERRENO_DISTANZE[TERRENO_DISTANZE.length - 1] / SKY_FOSCHIA_KM);
  return (1 - Math.exp(-km / SKY_FOSCHIA_KM)) / pieno;
}

// Il colore di una fetta di distanza: la prospettiva aerea e nient'altro.
//
// C'era anche un annerimento delle fette vicine (`0,3 · (1 − t)`), e non è
// stato tolto per gusto: da quando questo colore vale **anche sotto la riga
// dell'orizzonte** (§ `RIL_FONDI`) si sommava al velo dell'occlusione
// d'ambiente di `app.js`, e il terreno ai piedi usciva un terzo più scuro di
// prima. Sono due nomi della stessa cosa contati due volte — quel `0,3`
// faceva le veci del velo, che allora sopra la riga non c'era — e la
// divisione giusta è quella: la **distanza** la racconta la foschia, l'**angolo
// con cui si guarda il suolo** lo racconta il velo. Il contrasto fra un
// crinale davanti e uno in fondo resta tutto, ed è quello fra `vicino` e
// `lontano`: un fattore due.
function rilColoreDiFetta(t, suolo) {
  t = Math.max(RIL_LONTANANZA_MINIMA, Math.min(1, t));
  const tinta = Math.pow(1 - t, 0.9);
  const base = skyMescolaColore(suolo.lontano, suolo.vicino, tinta);
  const giorno = Math.max(0, Math.min(1, sky.luceCielo));
  const diffusa = RIL_DIFFUSA_NOTTE + (RIL_DIFFUSA_GIORNO - RIL_DIFFUSA_NOTTE) * giorno;
  // Una diffusa appena calda mantiene il terreno naturale senza lavarlo di
  // bianco; la foschia continua a stabilire da sola il colore dei piani
  // lontani.
  return skyMescolaColore(base, [238, 231, 205], diffusa);
}

// La tavolozza del tratteggio: un colore per livello di chiaroscuro.
//
// Il tratto **si somma** al fondo, non lo sostituisce: è una riga di luce
// sulla pendenza, e su un terreno che di notte vale una dozzina di livelli
// su 255 una moltiplicazione non si vedrebbe. Va verso il bianco (o verso il
// colore della luce, quando una luce c'è) in proporzione a quanto manca, che
// è come si comporta una luce vera su una superficie scura.
function rilTavolozzaTratti(luce) {
  const giorno = Math.max(0, Math.min(1, sky.luceCielo));
  const forte = RIL_TRATTO_NOTTE + (RIL_TRATTO_GIORNO - RIL_TRATTO_NOTTE) * giorno;
  const L = skyMescolaColore([255, 255, 255], luce.calda, 0.7 * luce.forza);
  const O = skyMescolaColore([0, 0, 0], luce.fredda, 0.45 * luce.forza);
  const fuori = new Array(RIL_LIVELLI);
  for (let b = 0; b < RIL_LIVELLI; b++) {
    // Sotto la metà si scava (verso l'ombra), sopra si schiarisce: così una
    // faccia girata dall'altra parte non si limita a non brillare, si scurisce
    // — ed è quello che dà volume a un pendio invece di una velatura.
    const k = b / (RIL_LIVELLI - 1);
    const q = (k - 0.45) / 0.55;
    const c = q >= 0 ? L : O;
    // Le ombre hanno quasi la stessa forza delle luci. Erano ridotte a tre
    // quarti e sui versanti opposti al Sole restava soltanto una velatura;
    // il tono freddo e la maggiore profondità fanno ora leggere davvero la
    // direzione della luce, senza annerire il colore di fondo più chiaro.
    const a = forte * Math.abs(q) * (q >= 0 ? 1 : 0.92);
    fuori[b] = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
  }
  return fuori;
}

// Il rilievo segue i meridiani che incontrano l'orizzonte visibile, non
// l'intero cono che puo' incontrare il suolo. La distinzione conta al FOV
// massimo: gli angoli inferiori del riquadro vedono quasi fino al nadir e
// `skyArcoAcquaInVista` restituisce percio' tutti i 360 gradi. Fra quelle
// colonne c'e' anche il meridiano opposto allo sguardo, vicino al polo della
// stereografica: le sue coordinate diventano enormi e il tracciato del
// crinale si richiude attraversando il riquadro. Il risultato era la grande
// montagna bianca e, quando quel tracciato veniva usato come clip, il cielo
// tinto col colore verde del terreno appena si cambiava il pitch.
//
// Se l'orizzonte e' davvero fuori vista (inquadratura stretta verso i piedi)
// resta invece giusto usare l'arco del suolo: li' il rilievo deve continuare
// a dare forma al primo piano, proprio come fanno mare e laghi.
function rilArcoInVista(base, focale) {
  const orizzonte = typeof skyArcoOrizzonteInVista === 'function'
    ? skyArcoOrizzonteInVista(base, focale)
    : null;
  if (!orizzonte) return skyArcoAcquaInVista(base, focale);
  if (orizzonte.mezzo < 175) return orizzonte;

  // Il cerchio che `skyArcoOrizzonteInVista` usa per circoscrivere il
  // riquadro e' intenzionalmente prudente. A 180°, pero', il cerchio passa
  // ben oltre gli angoli del canvas: alzando la camera sopra una quarantina
  // di gradi finisce per comprendere anche il meridiano opposto, sebbene il
  // suo punto d'orizzonte sia migliaia di pixel fuori dallo schermo. Quella
  // sola colonna sta accanto alla prima per il giro modulare della maglia e
  // chiude il tracciato attraversando il canvas: il terreno copre il cielo.
  //
  // Per il rilievo possiamo stringere la stima guardando il rettangolo vero.
  // Campioniamo soltanto la riga dell'orizzonte (le montagne hanno poi il
  // consueto margine di sei gradi) e teniamo lo scarto piu' lontano che cade
  // nel canvas. Non cerchiamo un unico intervallo: con la riga curva il
  // centro puo' stare sotto il bordo mentre i due lati sono ancora visibili.
  const centro = orizzonte.centro;
  const margine = Math.max(12, focale * Math.tan(6 * Math.PI / 180));
  let ultimo = 0;
  for (let delta = 0; delta < 180; delta += 0.5) {
    for (const segno of [-1, 1]) {
      const p = skyProietta(skyVettore(centro + segno * delta, 0), base, focale);
      if (p.davanti && p.px >= -margine && p.px <= sky.larghezza + margine &&
          p.py >= -margine && p.py <= sky.altezza + margine) ultimo = delta;
    }
  }
  return { centro, mezzo: Math.min(orizzonte.mezzo, ultimo + 6, 174) };
}

function rilDisegna(ctx, base, focale, suolo, aria) {
  rilievo.hoDisegnato = false;
  rilColonneUltime = 0;
  rilControlla();
  if (!rilPronto()) return false;
  if (typeof skyArcoAcquaInVista !== 'function') return false;
  const arco = rilArcoInVista(base, focale);
  if (!arco) return false;

  const na = RIL_AZIMUT, nr = RIL_ANELLI;
  const pxGrado = Math.max(1e-6, focale * SKY_D2R);
  const passo = rilPassoColonne(pxGrado);
  const nCol = Math.min(Math.ceil(na / passo) + 1,
    Math.floor(2 * arco.mezzo / (RIL_PASSO_AZ * passo)) + 2);
  if (nCol < 2) return false;
  const i0 = Math.floor((arco.centro - arco.mezzo) / RIL_PASSO_AZ);

  const cronometro = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  rilMagazzino(nCol);
  for (let i = 0; i < RIL_LIVELLI; i++) rilTratti[i].n = 0;

  const luce = rilLuce(base);
  const luogo = rilLuogo();
  const tav = rilTavolozzaTratti(luce);
  const fondoK = rilFondoAnelli();
  // Di quanto la maglia è decentrata rispetto a dove si è adesso, e a che
  // quota è l'occhio in questo momento. Due numeri per fotogramma, non due
  // per nodo: sotto la soglia di traslazione il primo è `null` e la
  // camminata legge `rilievo.alt` così com'è, senza pagare niente.
  const scostamento = rilScostamento(luogo);
  const occhio = rilOcchioOra();
  // Gli angoli si rifanno anche quando a muoversi è **solo la camera**: la
  // maglia è stata costruita con l'occhio che c'era allora, e quello di
  // adesso lo insegue con qualche decimo di secondo di ritardo (§8-bis).
  // Senza questa riga il ritardo si scaricherebbe tutto insieme sulla
  // ricostruzione successiva — cioè uno scatto ogni tre secondi, che è
  // proprio quello che si sta togliendo di mezzo.
  const scostoFermo = { est: 0, nord: 0 };
  const rifaiAngoli = !!scostamento ||
    Math.abs(occhio - rilievo.occhio) > RIL_OCCHIO_RIFAI_M;
  const scosto = scostamento || scostoFermo;
  const fx = base.f[0], fy = base.f[1], fz = base.f[2];
  const rx = base.r[0], ry = base.r[1], rz = base.r[2];
  const ux = base.u[0], uy = base.u[1], uz = base.u[2];
  const mezzaL = sky.larghezza / 2, mezzaH = sky.altezza / 2;
  const W = sky.larghezza, H = sky.altezza, M = 8;
  const D2R = Math.PI / 180;
  const scalaLiv = (RIL_LIVELLI - 1) / (RIL_COSENO_MAX - RIL_COSENO_MIN);
  // Quanto è larga una colonna sullo schermo, più un pelo: le strisce si
  // devono sovrapporre appena, se no fra due colonne resta la riga chiara
  // dell'antialiasing — che su un terreno pettinato di righe è il difetto che
  // si nota per primo.
  const larghezzaColonna = RIL_PASSO_AZ * passo * pxGrado + 1;
  let strisce = 0;

  // Il tratto si spegne con la distanza insieme al terreno che pettina: una
  // catena a quaranta chilometri, dietro alla foschia, non ha nessun
  // dettaglio da mostrare, e disegnarcelo la fa sembrare vicina.
  const veloDi = km => 1 - 0.72 * rilLontananza(km);
  // E si spegne anche **da vicino**, dove il modello del suolo non ha più
  // niente da dire: vedi `RIL_VICINO_PIENO_M`.
  const vicinoDi = m => m >= RIL_VICINO_PIENO_M ? 1
    : (m <= RIL_VICINO_NIENTE_M ? 0
      : (m - RIL_VICINO_NIENTE_M) / (RIL_VICINO_PIENO_M - RIL_VICINO_NIENTE_M));

  for (let c = 0; c < nCol; c++) {
    const idx = (((i0 + c * passo) % na) + na) % na;
    const azRad = idx * RIL_PASSO_AZ * D2R;
    const sinAz = Math.sin(azRad), cosAz = Math.cos(azRad);
    const baseQ = idx * nr;

    let massimo = -Infinity, kMax = 0;
    let px = 0, py = 0, ok = false;      // il nodo visibile precedente
    let haVisto = false;                 // px/py dicono qualcosa
    let fetta = 0;                       // la prossima curva di fondo da chiudere
    let nRott = 0;
    // La corsa di livelli uguali in questa colonna, e la striscia che ne esce.
    let runN = -1, runLiv = -1, runX0 = 0, runY0 = 0, runX1 = 0, runY1 = 0;
    for (let k = 0; k < nr; k++) {
      // Le fette di fondo che questo anello si è appena lasciato indietro:
      // la loro cresta parziale è l'ultimo nodo **visto**, che è per
      // definizione il massimo fino a lì. Non costa una proiezione — il
      // punto è già calcolato.
      while (fetta < RIL_FONDI - 1 && k > fondoK[fetta]) {
        const o = fetta * nCol + c;
        rilFondoX[o] = haVisto ? px : NaN;
        rilFondoY[o] = haVisto ? py : NaN;
        fetta++;
      }
      // In movimento l'angolo si rifà dal punto in cui si è adesso e con
      // l'occhio di adesso; da fermo si legge quello che la maglia ha già
      // calcolato. La **pendenza** invece si prende sempre nel riferimento
      // della maglia (`baseQ`), ed è una scelta: ricampionare anche le due
      // vicine costerebbe tre bilineari per nodo, e da quando il centro si
      // rifà ogni sessanta metri lo scostamento è una correzione piccola —
      // sul chiaroscuro, che è una derivata locale, non si vede.
      const a = rifaiAngoli ? rilCampioneInMovimento(sinAz, cosAz, k, scosto, occhio)
                            : rilievo.alt[baseQ + k];
      if (!(a > massimo)) {
        // Nascosto: se veniamo da un tratto visibile, qui il terreno
        // **sparisce dietro** a quello che abbiamo davanti — ed è un contorno.
        if (ok && nRott < RIL_ROTTURE) {
          const o = c * RIL_ROTTURE + nRott;
          rilRottX[o] = px; rilRottY[o] = py; rilRottK[o] = k - 1;
          nRott++;
        }
        ok = false;
        continue;
      }
      massimo = a; kMax = k;

      const rad = a * D2R;
      const ca = Math.cos(rad), sa = Math.sin(rad);
      const vx = sinAz * ca, vy = cosAz * ca, vz = sa;
      const d = vx * fx + vy * fy + vz * fz;
      if (d <= SKY_D_MIN) { ok = false; continue; }
      const den = (1 + d) * 0.5;
      const nx2 = mezzaL + focale * (vx * rx + vy * ry + vz * rz) / den;
      const ny2 = mezzaH - focale * (vx * ux + vy * uy + vz * uz) / den;

      if (ok) {
        // Fuori dal riquadro solo se **tutti e due** i capi stanno oltre lo
        // stesso bordo: così non si perde mai una faccia che lo attraversa, e
        // il grembiule sotto i piedi — che a cinquanta gradi di depressione
        // è fuori da qualunque schermo — non costa niente.
        const fuori = (px < -M && nx2 < -M) || (px > W + M && nx2 > W + M) ||
                      (py < -M && ny2 < -M) || (py > H + M && ny2 > H + M);
        if (fuori) {
          if (runN >= 0) { strisce += rilChiudiRun(runLiv, runX0, runY0, runX1, runY1); runN = -1; }
        } else {
          // La normale della faccia: la tangente lungo l'azimut per quella
          // lungo la distanza.
          //
          // L'azimut non è quello della colonna accanto ma quello a
          // `RIL_PIEGA_M` metri di distanza sul terreno. È la stessa cosa che
          // ha fatto sparire il dettaglio al primo tentativo: mezzo grado a
          // trecento metri sono due metri e sessanta, un decimo di cella del
          // modello, e fra due punti così vicini la quota è interpolata
          // linearmente — la normale viene identica per tutta la colonna e il
          // fianco esce come una lastra. E siccome il passo è in metri e non
          // in colonne, il chiaroscuro **non cambia** quando cambia il passo
          // di disegno: è l'altra metà del rimedio allo sfarfallio.
          const s = RIL_DIST[k], sPrec = RIL_DIST[k - 1];
          const q = rilievo.quota[baseQ + k];
          const salto = Math.max(1, Math.min(48,
            Math.round(RIL_PIEGA_M / Math.max(0.01, s * RIL_PASSO_AZ * D2R))));
          const iPiu = (idx + salto) % na, iMeno = (idx - salto + na * 2) % na;
          const qPiu = rilievo.quota[iPiu * nr + k], qMeno = rilievo.quota[iMeno * nr + k];
          const dAz = salto * RIL_PASSO_AZ * D2R;
          const ex = s * (Math.sin(azRad + dAz) - sinAz), ey = s * (Math.cos(azRad + dAz) - cosAz);
          const ez = qPiu - q;
          // La tangente lungo la distanza si misura sugli stessi
          // `RIL_PIEGA_M` metri della tangente in azimut, e non fra due
          // anelli contigui.
          //
          // È lo stesso difetto dell'azimut, dall'altra parte: gli anelli
          // stanno all'otto e mezzo per cento l'uno dall'altro, quindi a
          // cinquecento metri due anelli contigui distano quaranta metri —
          // una cella e mezza del modello. La normale viene fuori dal rumore
          // del dato invece che dalla forma del terreno, e sullo schermo si
          // legge come un mosaico di rettangoli, uno per cella della maglia.
          // Con lo stesso passo nelle due direzioni la normale è quella di un
          // fazzoletto di terreno vero.
          const saltoK = Math.min(k, Math.max(1,
            Math.round(RIL_PIEGA_M / Math.max(1, s - sPrec))));
          const sIndietro = RIL_DIST[Math.max(0, k - saltoK)];
          const tx = (s - sIndietro) * sinAz, ty = (s - sIndietro) * cosAz;
          const tz = q - rilievo.quota[baseQ + k - saltoK];
          let ax = ey * tz - ez * ty;
          let ay = ez * tx - ex * tz;
          let az2 = ex * ty - ey * tx;
          const m = Math.hypot(ax, ay, az2) || 1;
          ax /= m; ay /= m; az2 /= m;
          if (az2 < 0) { ax = -ax; ay = -ay; az2 = -az2; }

          const ds = Math.max(0, ax * luce.servizio[0] + ay * luce.servizio[1] + az2 * luce.servizio[2]);
          let kk = ds;
          if (luce.vera && luce.forza > 0) {
            const dv = Math.max(0, ax * luce.vera[0] + ay * luce.vera[1] + az2 * luce.vera[2]);
            kk = dv * luce.forza + ds * (1 - luce.forza);
          }
          let livF = (kk - RIL_COSENO_MIN) * scalaLiv;
          // La **piega** di traverso, cioè la derivata seconda in azimut sulla
          // stessa scala di metri: è quella che fa comparire i valloni. Il
          // segno conta — convessa è un costolone e prende luce, concava è un
          // impluvio e sta in ombra.
          const largo = s * dAz;
          const piega = largo > 0.01 ? (qMeno - 2 * q + qPiu) / largo : 0;
          const forza = Math.min(1, Math.abs(piega) / RIL_PIEGA_PIENA);
          livF += piega > 0 ? -RIL_PIEGA_LIVELLI * forza : RIL_PIEGA_LIVELLI * forza;
          // La foschia toglie **dettaglio**, non colore: una faccia lontana si
          // avvicina al livello di mezzo invece di sparire, se no la catena in
          // fondo resta senza forma.
          const v = veloDi(s / 1000) * vicinoDi(s);
          if (v < 0.999) {
            const mezzo = (RIL_LIVELLI - 1) * 0.5;
            livF = mezzo + (livF - mezzo) * v;
          }
          // Un disturbo di mezzo livello, **agganciato al terreno** e non al
          // fotogramma: due punti della maglia hanno sempre lo stesso, quindi
          // non tremola: serve solo a rompere i confini fra una banda e
          // l'altra, che è quello che si legge come mosaico. È la stessa idea
          // del dithering, e costa uno xor.
          const rumore = ((idx * 73856093) ^ (k * 19349663)) >>> 0;
          let liv = Math.round(livF + ((rumore % 997) / 997 - 0.5) * 0.7);
          if (liv < 0) liv = 0; else if (liv >= RIL_LIVELLI) liv = RIL_LIVELLI - 1;

          // Le facce contigue con lo stesso livello diventano **una striscia
          // sola**: il chiaroscuro lungo un raggio cambia piano, quindi le
          // strisce sono lunghe e sono poche.
          if (runN >= 0 && liv === runLiv) {
            runX1 = nx2; runY1 = ny2;
          } else {
            if (runN >= 0) strisce += rilChiudiRun(runLiv, runX0, runY0, runX1, runY1);
            runLiv = liv; runN = k;
            runX0 = px; runY0 = py; runX1 = nx2; runY1 = ny2;
          }
        }
      }
      px = nx2; py = ny2; ok = true; haVisto = true;
    }
    if (runN >= 0) { strisce += rilChiudiRun(runLiv, runX0, runY0, runX1, runY1); runN = -1; }
    // Le fette che restano — e la più esterna, che è la sagoma intera.
    while (fetta < RIL_FONDI - 1) {
      const o = fetta * nCol + c;
      rilFondoX[o] = haVisto ? px : NaN;
      rilFondoY[o] = haVisto ? py : NaN;
      fetta++;
    }

    rilCrestaA[c] = massimo === -Infinity ? 0 : massimo;
    rilCrestaK[c] = kMax;
    rilRottN[c] = nRott;
    // La punta della sagoma, proiettata: è **lo stesso massimo** che ha
    // guidato la camminata, quindi la riga bianca non si può staccare dal
    // crinale che ha appena disegnato.
    {
      const a = rilCrestaA[c] * D2R;
      const ca = Math.cos(a), sa = Math.sin(a);
      const vx = sinAz * ca, vy = cosAz * ca, vz = sa;
      const d = vx * fx + vy * fy + vz * fz;
      if (d > SKY_D_MIN) {
        const den = (1 + d) * 0.5;
        rilCrestaX[c] = mezzaL + focale * (vx * rx + vy * ry + vz * rz) / den;
        rilCrestaY[c] = mezzaH - focale * (vx * ux + vy * uy + vz * uz) / den;
      } else { rilCrestaX[c] = NaN; rilCrestaY[c] = NaN; }
    }
    // La fetta più esterna **è** la sagoma: la stessa riga, non una copia
    // ricalcolata — se le due divergessero il fondo si staccherebbe dal
    // crinale proprio contro il cielo.
    const oUltima = (RIL_FONDI - 1) * nCol + c;
    rilFondoX[oUltima] = rilCrestaX[c];
    rilFondoY[oUltima] = rilCrestaY[c];
  }

  // La sagoma è pronta: da qui in poi `rilTracciaSagoma` sa cosa disegnare —
  // e sa anche **che forma ha**, che è la cosa che cambia tutto (vedi
  // `RIL_ANELLO_GRADI`).
  rilColonneUltime = nCol;
  rilAnelloUltimo = null;
  if (2 * arco.mezzo >= RIL_ANELLO_GRADI && typeof skyCerchioOrizzonte === 'function') {
    const o = skyCerchioOrizzonte(base, focale);
    // Con l'orizzonte dritto non c'è nessun anello, per largo che sia l'arco:
    // quella è la vista di chi guarda davanti a sé, e la chiusura in giù è la
    // sua.
    if (!o.retta) rilAnelloUltimo = o.fuori ? 'fuori' : 'dentro';
  }

  // --- Il corpo della montagna, a fette di distanza ---------------------
  //
  // Non è più «quello che spunta sopra la riga» (vedi `RIL_FONDI`): è tutto
  // il terreno, dalla sagoma fino ai piedi, dipinto a strisce che stanno una
  // sopra l'altra. Ogni striscia va dalla cresta parziale della sua fetta
  // giù fino a quella della fetta davanti — e la prima arriva fuori dal
  // riquadro, perché sotto di lei non c'è più niente da raccontare.
  //
  // Le creste parziali sono massimi accumulati, quindi non si scavalcano
  // mai: le strisce si toccano senza sovrapporsi e lo schermo si dipinge una
  // volta sola comunque siano tante. È la stessa geometria del profilo a
  // bande di `app.js`, e per la stessa ragione.
  let chiamate = 0;
  {
    // Al FOV estremo un'unica campitura evita alla radice le intersezioni
    // fra i poligoni delle distanze. La sagoma conosce gia' i casi difficili
    // (terra dentro/fuori da un anello), quindi non puo' richiudersi nel
    // cielo; l'ombreggiatura dettagliata viene aggiunta subito dopo.
    if (!rilFondiSeparati()) {
      const kMedio = fondoK[Math.floor(RIL_FONDI * 0.45)];
      const col = rilColoreDiFetta(rilLontananza(RIL_DIST[kMedio] / 1000), suolo);
      ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      const regola = rilTracciaSagoma(ctx);
      if (regola) {
        ctx.fill(regola);
        chiamate++;
      }
    } else {
      const giu = H + Math.max(W, H);
      for (let b = RIL_FONDI - 1; b >= 0; b--) {
        const col = rilColoreDiFetta(rilLontananza(RIL_DIST[fondoK[b]] / 1000), suolo);
        const sopra = b * nCol, sotto = (b - 1) * nCol;
        ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1;

        // La fetta più vicina, quando le curve si chiudono attorno al cielo.
        //
        // Le altre sono anelli fra due curve e si disegnano come tali; questa
        // no, perché al di là di lei non c'è un'altra curva — c'è **tutto il
        // resto**. Chiuderla al fondo del riquadro, come si fa quando
        // l'orizzonte attraversa lo schermo da parte a parte, vuol dire
        // prendere un anello che gira attorno al centro e tirargli una riga
        // fino al bordo di sotto: il poligono si attraversa da solo e metà
        // della volta celeste si dipinge di terra (vedi `RIL_ANELLO_GRADI`).
        if (b === 0 && rilAnelloUltimo) {
          ctx.beginPath();
          let dentro = false;
          for (let c = 0; c < nCol; c++) {
            if (Number.isNaN(rilFondoX[sopra + c])) continue;
            if (dentro) ctx.lineTo(rilFondoX[sopra + c], rilFondoY[sopra + c]);
            else { ctx.moveTo(rilFondoX[sopra + c], rilFondoY[sopra + c]); dentro = true; }
          }
          if (!dentro) continue;
          ctx.closePath();
          // Il filo va sulla sola curva: aggiungendo il riquadro al tracciato
          // e stampandolo si disegnerebbe una cornice attorno allo schermo.
          ctx.stroke();
          if (rilAnelloUltimo === 'dentro') {
            ctx.fill();
          } else {
            ctx.rect(0, 0, W, H);
            ctx.fill('evenodd');
          }
          chiamate += 2;
          continue;
        }

        ctx.beginPath();
        let inizio = -1;
        const chiudi = (fine) => {
          if (inizio < 0 || fine < inizio) { inizio = -1; return; }
          for (let c = inizio; c <= fine; c++) ctx.lineTo(rilFondoX[sopra + c], rilFondoY[sopra + c]);
          // Il bordo di sotto, all'indietro: la fetta davanti, o il fondo del
          // riquadro per la prima. Se la fetta davanti non si proietta (capita
          // solo ai capi, dove il punto finisce dietro all'occhio) si scende
          // comunque fuori dal riquadro: meglio un pelo di terreno in più che
          // un buco da cui si vede il cielo.
          for (let c = fine; c >= inizio; c--) {
            const x = b > 0 ? rilFondoX[sotto + c] : rilFondoX[sopra + c];
            const y = b > 0 ? rilFondoY[sotto + c] : giu;
            if (Number.isNaN(x) || Number.isNaN(y)) ctx.lineTo(rilFondoX[sopra + c], giu);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          inizio = -1;
        };
        for (let c = 0; c < nCol; c++) {
          if (Number.isNaN(rilFondoX[sopra + c])) { chiudi(c - 1); continue; }
          if (inizio < 0) { inizio = c; ctx.moveTo(rilFondoX[sopra + c], rilFondoY[sopra + c]); }
        }
        chiudi(nCol - 1);
        ctx.fill();
        // Il contorno col proprio colore chiude la cucitura fra due strisce
        // che condividono un lato: due riempimenti antialiasati per conto loro
        // lasciano lì due mezze coperture che non fanno un pieno.
        ctx.stroke();
        chiamate += 2;
      }
    }
  }

  // --- L'ombreggiatura --------------------------------------------------
  //
  // Un tracciato per livello, una `stroke()` per tracciato: migliaia di
  // strisce in quaranta chiamate. E tutto **ritagliato alla sagoma del
  // terreno**, così la lieve larghezza extra che chiude le cuciture non può
  // sporcare il cielo lungo il crinale.
  ctx.save();
  ctx.clip(rilTracciaSagoma(ctx) || 'nonzero');
  for (let l = 0; l < RIL_LIVELLI; l++) {
    const t = rilTratti[l];
    if (!t.n) continue;
    ctx.beginPath();
    for (let i = 0; i < t.n; i += 4) {
      ctx.moveTo(t.v[i], t.v[i + 1]);
      ctx.lineTo(t.v[i + 2], t.v[i + 3]);
    }
    ctx.strokeStyle = tav[l];
    ctx.lineWidth = larghezzaColonna;
    ctx.lineCap = 'butt';
    ctx.stroke();
    chiamate++;
  }
  ctx.restore();

  // --- I contorni interni -----------------------------------------------
  //
  // Dove la camminata si rompe, il terreno sparisce dietro a quello che ha
  // davanti: è un salto di profondità, ed è la riga che nelle tavole
  // panoramiche separa un piano dall'altro. Si cuciono fra colonne vicine
  // solo se il punto di rottura sta più o meno allo stesso anello — se no si
  // legherebbero creste che non hanno niente a che vedere fra loro.
  const biancoProfilo = [255, 255, 255];
  {
    ctx.beginPath();
    let segmenti = 0;
    for (let c = 0; c + 1 < nCol; c++) {
      const n0 = rilRottN[c], n1 = rilRottN[c + 1];
      for (let a = 0; a < n0; a++) {
        const oa = c * RIL_ROTTURE + a;
        let meglio = -1, scarto = RIL_CONTORNO_SALTO + 1;
        for (let b = 0; b < n1; b++) {
          const ob = (c + 1) * RIL_ROTTURE + b;
          const dk = Math.abs(rilRottK[ob] - rilRottK[oa]);
          if (dk < scarto) { scarto = dk; meglio = ob; }
        }
        if (meglio < 0) continue;
        ctx.moveTo(rilRottX[oa], rilRottY[oa]);
        ctx.lineTo(rilRottX[meglio], rilRottY[meglio]);
        segmenti++;
      }
    }
    if (segmenti) {
      ctx.strokeStyle = skyRgba(biancoProfilo,
        RIL_FILO_DENTRO * (0.55 + 0.45 * sky.luceCielo));
      ctx.lineWidth = 1;
      ctx.stroke();
      chiamate++;
    }
  }

  // --- La riga del crinale contro il cielo ------------------------------
  ctx.beginPath();
  {
    let dentro = false;
    for (let c = 0; c < nCol; c++) {
      if (Number.isNaN(rilCrestaX[c])) { dentro = false; continue; }
      if (dentro) ctx.lineTo(rilCrestaX[c], rilCrestaY[c]);
      else { ctx.moveTo(rilCrestaX[c], rilCrestaY[c]); dentro = true; }
    }
  }
  ctx.strokeStyle = skyRgba(biancoProfilo,
    RIL_FILO_CIELO * (0.5 + 0.5 * Math.max(0, Math.min(1, sky.luceCielo))));
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  chiamate++;

  // Chi disegna subito dopo — i nomi delle montagne, i laghi — non ha bisogno
  // che gli si lasci qui la sagoma: la cresta disegnata **è** quella misurata,
  // perché su questa superficie non c'è nessun rilievo finto che la morda, e
  // gliela dà `rilCrestaEntroM` leggendo lo stesso `fronte`. È la differenza
  // con il profilo a bande, che invece la sagoma se la deve ricordare
  // (`skyCresteUltime` in `app.js`).
  rilievo.ultimo = {
    colonne: nCol, strisce, chiamate,
    ms: Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - cronometro) * 100) / 100
  };
  rilievo.hoDisegnato = true;
  return true;
}
