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
// passo), lo stesso servizio del meteo: niente chiave, niente account.
// Dietro di lui ce ne sono altri due — OpenTopoData e Open-Elevation —
// che danno le stesse quote da modelli diversi e stanno su host diversi:
// servono per quando il primo è carico, che è il guasto più comune di
// questo modulo (§4).
//
// Le quote sono l'unica cosa di Open-Meteo che il service worker **tiene**
// in cache: una collina è dove era, e riprovare deve costare solo il pezzo
// che manca.
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

// La distanza più piccola con cui si può fare un angolo di elevazione.
//
// `terrenoAngolo` è una `atan2(dislivello, distanza)`, e a distanza zero
// quella funzione non si arrende: risponde novanta gradi. È l'asintoto che
// fa comparire gli spilli — chiesta a distanza «quasi zero» dà una parete
// verticale anche per un dosso di due metri, e il chiamante non ha modo di
// accorgersene perché il numero che riceve è un numero perfettamente
// plausibile. Cinquanta metri sono la metà di una cella del modello del
// suolo: sotto quella misura non c'è nessuna informazione da difendere, e
// tosare lì è gratis per tutti i campioni della griglia (il primo sta a
// centocinquanta metri) e salva chi chiede l'angolo di un punto che ha sotto
// i piedi — cioè l'acqua in cui si sta.
const TERRENO_DISTANZA_MIN_M = 50;

// Di quanto una direzione può stare sopra a tutt'e due le sue vicine.
//
// La griglia è centoventi direzioni, una ogni tre gradi, e ognuna è una
// colonna di campioni indipendente: un solo campione sbagliato — un tetto,
// un pilone, un buco nel modello — alza la cresta di quella direzione e
// basta. Poi `terrenoInterpola` la stira su tre gradi, e quello che si vede
// sullo schermo è una stalagmite: alta, sottilissima, e attaccata a un
// orizzonte per il resto giusto.
//
// Il rimedio non è una media — una media abbasserebbe le vette vere, che
// sono proprio le uniche cose che uno guarda — ma un **tetto**: una
// direzione non può superare di più di tanto la più alta delle sue due
// vicine. Una cresta vera ce le ha alte anche loro e non viene toccata; uno
// spillo, per definizione, non ce le ha. Un grado e due decimi è largo: a
// tre gradi di passo, un pendio che sale davvero cambia molto meno di così
// da una direzione all'altra.
//
// Da sola questa tosatura non basta, e la ragione è nella riga qui sotto:
// vicino, due direzioni confinanti leggono la **stessa** cella del modello,
// quindi portano lo stesso errore e si fanno da garanti a vicenda.
const TERRENO_SPILLO_GRADI = 1.2;

// Quanto è larga una cella del modello del suolo. Copernicus DEM sta a un
// arcosecondo, cioè trenta metri all'equatore e novanta nella versione che
// Open-Meteo serve: è la misura sotto la quale il terreno non ha dettaglio,
// e da lei dipende **quanto** di quello che c'è nella griglia sia
// informazione e quanto sia rumore ricopiato.
const TERRENO_CELLA_M = 90;

// I due filtri sugli anelli vicini, e perché ce ne vogliono due.
//
// La griglia è polare: centoventi direzioni per diciotto distanze. A sessanta
// chilometri due direzioni vicine distano tre chilometri sul terreno e sono
// campioni indipendenti; **a centocinquanta metri distano sette metri e
// ottanta**, cioè un dodicesimo di cella. Là fuori, dodici direzioni di fila
// leggono lo stesso numero.
//
// Da qui vengono le due cose che si vedono sullo schermo e che nei numeri
// non saltavano fuori:
//
//   - la **scaletta**. Le quote arrivano a gruppi di uguali e poi saltano di
//     colpo alla cella dopo: sull'orizzonte disegnato erano gradini di tre
//     gradi, misurati, con un profilo di costa pulito. È aliasing da
//     campionamento radiale, e la cura è un passa-basso.
//   - lo **spillo correlato**. `TERRENO_SPILLO_GRADI` confronta una
//     direzione con le due accanto, e vicino quelle due sono copie: un
//     capannone, un pilone, un buco nel modello alza sei direzioni insieme e
//     il tetto non se ne accorge — provato, un dente da otto gradi passava
//     intero. Serve un tetto che guardi **fuori** dalla cella.
//
// La larghezza dei due filtri non è un numero scelto a mano: è l'angolo che
// una cella occupa a quella distanza (`terrenoPassiDiCella`). A
// centocinquanta metri sono trentaquattro gradi, a un chilometro e due
// quattro, a quattro chilometri meno di un passo della griglia — e da lì in
// poi i filtri **non toccano niente**. È la proprietà che conta: le vette
// lontane, che sono le sole cose che uno guarda e a cui si appendono i nomi,
// escono da qui identiche a come sono entrate.
//
// Le due larghezze non sono la stessa, e la differenza è tutta nel mestiere
// che fanno.
//
// Il passa-basso lavora su **una** impronta di cella: deve sciogliere il
// gradino fra una cella e la successiva, e per farlo gli basta arrivare a
// toccarla. Il tetto a mediana ne vuole **due**, ed è una necessità
// aritmetica, non una taratura: la mediana dice la verità solo se il dente
// occupa meno di metà finestra, e un dente largo una cella dentro a una
// finestra larga una cella *è* la maggioranza. Con una sola impronta un
// guasto da sessanta gradi in mezzo alle Alpi passava intero; con due scende a
// quattro e mezzo. Da tre in su non cambia più niente, e si tiene la più
// stretta che funziona.
//
// I due tetti in gradi limitano quelle larghezze, se no a centocinquanta
// metri — dove una cella copre trentun gradi — si medierebbe su mezzo
// orizzonte. Misurati contro un orizzonte vero calcolato senza griglia, su un
// paesaggio di costa e su uno alpino: con le celle sbagliate l'eccesso passa
// da 16,6° a 1,9° sulla costa e da 60° a 4,6° in montagna, e sul terreno
// pulito lo scarto quadratico medio **scende** (2,57° → 1,28° in montagna:
// era la griglia a sbagliare, non i filtri a impastare).
const TERRENO_TETTO_LARGO_GRADI = 18;
const TERRENO_TETTO_LARGO_CELLE = 2;
const TERRENO_LISCIA_GRADI = 4.5;

// Di quanto un campione può stare sopra alla mediana della sua finestra.
//
// È lo stesso budget della tosatura vicina — un grado e due decimi — e non è
// un caso: la domanda è la stessa, «di quanto il terreno può cambiare da una
// direzione all'altra», solo chiesta a un vicinato più largo. La mediana e
// non il massimo, perché quello che si vuole sapere è a che quota sta il
// paesaggio lì attorno, e il massimo di una finestra che contiene lo spillo
// **è** lo spillo.
const TERRENO_SPILLO_LARGO_GRADI = 1.2;

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
  // Le quote grezze, così come sono arrivate: 120×18 metri sul livello del
  // mare. `fronti` ne è il massimo accumulato, che è quello che serve al
  // disegno dell'orizzonte — ma per sapere **a che quota sta un lago** ci
  // vuole il numero non accumulato, e ricavarlo da `fronti` non si può.
  quote: null,            // Array(120×18)
  avute: [],              // quali direzioni sono misurate davvero (non stimate)
  quotaStimata: false,    // la quota di casa non è arrivata: viene dai campioni vicini
  quando: 0,
  motivo: '',             // perché non c'è, quando non c'è
  avanzamento: 0,         // 0…1 mentre le quote stanno arrivando
  misurate: 0,            // quante delle 120 direzioni sono misurate davvero
  tentativi: 0,           // quante volte si è già riprovato da soli
  sveglia: null,          // il timer del prossimo tentativo
  provatoLat: null,       // per quale posto valgono i tentativi qui sopra
  provatoLon: null,
  completatoPer: null,    // per quale posto si è già tentato di completare un salvataggio parziale
  // Qui abbiamo già provato e non ce l'abbiamo fatta, e in mano non è
  // rimasto niente. Serve a `terrenoInArrivo`: le riprese automatiche
  // (§7, `TERRENO_RIPROVE_MS`) rimettono lo stato a «in-corso», e senza
  // questo campo ogni ripresa era indistinguibile dalla prima attesa —
  // cioè i nomi delle montagne sparivano di nuovo, per mezz'ora, a
  // ondate. Si azzera cambiando posto, o appena un profilo arriva.
  arreso: false,
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
// La distanza si tosa a `TERRENO_DISTANZA_MIN_M` prima di dividerci: è
// l'unico posto in cui l'asintoto della `atan2` può entrare nell'app, e
// fermarlo qui vuol dire fermarlo per tutti — le creste, l'occlusione, i nomi
// delle montagne, l'acqua. L'abbassamento si sottrae alla quota **prima**
// dell'arcotangente, e non è la formula scolastica `s²/2R`: c'è di mezzo la
// rifrazione, che restituisce un settimo di quello che la curvatura si è
// preso, e senza di lei una vetta a sessanta chilometri risulterebbe più
// bassa di trentacinque metri di dov'è.
function terrenoAngolo(quota, occhio, km) {
  const s = Math.max(TERRENO_DISTANZA_MIN_M, km * 1000);
  const abbassa = (1 - TERRENO_RIFRAZIONE) * s * s / (2 * TERRENO_RAGGIO_KM * 1000);
  return Math.atan2(quota - occhio - abbassa, s) * 180 / Math.PI;
}


// =====================================================================
// 4. PRENDERE LE QUOTE
// =====================================================================

// --- Chi le vende, le quote ------------------------------------------
//
// Per anni ce n'era una sola, Open-Meteo, ed è la migliore: stesso servizio
// del meteo, Copernicus DEM a novanta metri, niente chiave. Ma è un servizio
// pubblico e gratuito, e i servizi pubblici e gratuiti ogni tanto sono
// carichi: il **429** — «troppe richieste» — è il guasto più frequente di
// tutto questo modulo, e quando arriva non arriva da solo, perché a essere
// carico è il servizio e non la nostra richiesta. Insistere sullo stesso
// host è allora il modo peggiore di reagire: si continua a bussare a una
// porta che ha appena detto che è piena.
//
// Le altre due danno le stesse quote da modelli diversi (SRTM e i suoi
// derivati), hanno lo stesso identico patto — niente chiave, niente account,
// cento coordinate per richiesta, CORS aperto — e soprattutto stanno su
// **host diversi con quote diverse**: quando la prima è satura le altre non
// lo sono. Si prova in ordine, e quella che risponde diventa quella di
// adesso: non si torna alla prima a ogni richiesta, se no ogni ventiquattro
// richieste se ne buttano ventiquattro sul muro.
//
// Ognuna dichiara anche il proprio ritmo di crociera — quante ne accetta
// insieme e quanto vuole che passi fra l'una e l'altra. OpenTopoData scrive
// nella sua documentazione «una al secondo», e chiederne quattro insieme è
// un 429 garantito che non è colpa di nessuno.
const TERRENO_FONTI = [
  {
    nome: 'Open-Meteo',
    max: 100,
    // Sei insieme e ottanta millesimi di distanza, contro i quattro e
    // centoventi di prima. Il ritmo di crociera si può alzare **da quando il
    // freno funziona per davvero** (vedi `terrenoFrena`: prima un 429 in una
    // raffica di quattro frenava quattro volte, e in tre passate il passo era
    // già al suo tetto). Il conto che si paga qui è tutto di spaziatura: le
    // ventiquattro richieste non possono arrivare prima di
    // 24 × distanza, cioè due secondi e nove decimi col passo vecchio, e
    // quella era la metà del tempo di attesa su una rete che funzionava.
    insieme: 6,
    distanza: 80,
    url: punti => 'https://api.open-meteo.com/v1/elevation?latitude=' +
      punti.map(p => p.lat.toFixed(5)).join(',') + '&longitude=' +
      punti.map(p => p.lon.toFixed(5)).join(','),
    leggi: d => (d && Array.isArray(d.elevation)) ? d.elevation : null
  },
  // Le due di riserva sono in quest'ordine per il **ritmo che dichiarano**, non
  // per preferenza: quando la prima porta è chiusa, le ventiquattro richieste
  // se le prende tutte la riserva, e allora la sua portata è tutto il tempo
  // d'attesa. Open-Elevation dice quattro decimi di secondo fra una richiesta e
  // l'altra, OpenTopoData scrive «una al secondo» nella sua documentazione:
  // ventiquattro richieste sono dieci secondi dalla prima e ventisette dalla
  // seconda. Misurato con Open-Meteo del tutto chiusa, ed è la differenza fra
  // un'attesa e una rinuncia. Quale delle due sia più affidabile non c'entra —
  // a quello risponde la rotazione, che gira di nuovo se anche questa dice no.
  {
    nome: 'Open-Elevation',
    max: 100,
    insieme: 1,
    distanza: 400,
    url: punti => 'https://api.open-elevation.com/api/v1/lookup?locations=' +
      punti.map(p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('|'),
    leggi: d => (d && Array.isArray(d.results))
      ? d.results.map(r => (r && typeof r.elevation === 'number') ? r.elevation : null) : null
  },
  {
    nome: 'OpenTopoData',
    max: 100,
    insieme: 1,
    distanza: 1100,
    url: punti => 'https://api.opentopodata.org/v1/mapzen?locations=' +
      punti.map(p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('|'),
    leggi: d => (d && Array.isArray(d.results))
      ? d.results.map(r => (r && typeof r.elevation === 'number') ? r.elevation : null) : null
  }
];

// Quella con cui si sta parlando adesso. È un indice e non un oggetto perché
// deve poter girare: chi fallisce lo sposta avanti, chi riesce lo pianta lì.
let terrenoFonteOra = 0;

function terrenoFonte() { return TERRENO_FONTI[terrenoFonteOra % TERRENO_FONTI.length]; }

// Una richiesta sola, con la sua sveglia.
//
// Il `timeout` non c'era, e senza di lui una richiesta che non torna più —
// capita, su una rete mobile che passa da una cella all'altra — lasciava il
// terreno «in-corso» per sempre: la riga di stato diceva «sto misurando…» e
// non finiva mai, che è il modo peggiore di fallire, perché non sembra
// nemmeno un errore.
const TERRENO_TIMEOUT_MS = 15000;

async function terrenoQuoteDa(f, punti) {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const sveglia = ac ? setTimeout(() => ac.abort(), TERRENO_TIMEOUT_MS) : null;
  try {
    const risposta = await fetch(f.url(punti), ac ? { signal: ac.signal } : undefined);
    if (!risposta.ok) {
      const e = new Error(`${f.nome} ha risposto ${risposta.status}`);
      e.stato = risposta.status;
      // Quanto aspettare prima di riprovare, se è il servizio stesso a dirlo.
      // Il tetto di prima era un minuto, e serviva a non restare appesi a un
      // header assurdo; adesso il tetto vero è quello del rubinetto, e questo
      // può stare largo — un servizio che dice «fra novanta secondi» sta
      // dicendo una cosa vera, e ignorarla vuol dire prendersi un altro 429.
      const dopo = parseFloat(risposta.headers.get('retry-after'));
      if (dopo > 0 && dopo <= 600) e.attesa = dopo * 1000;
      throw e;
    }
    const dati = await risposta.json();
    const quote = f.leggi(dati);
    if (!Array.isArray(quote)) throw new Error(`${f.nome} ha risposto senza quote`);
    terrenoScorre(f);
    return quote;
  } catch (e) {
    // Un errore di rete o un rifiuto sono due nomi della stessa cosa per chi
    // deve decidere il ritmo: questa fonte adesso non ce la fa, e insistere
    // allo stesso passo è il modo di continuare a non farcela.
    if (terrenoRiprovabile(e)) terrenoFrena(f, e);
    throw e;
  } finally {
    if (sveglia) clearTimeout(sveglia);
  }
}

// --- Il rubinetto -----------------------------------------------------
//
// Ventiquattro richieste partivano quattro alla volta, e le quattro
// partivano **nello stesso istante**. Un servizio pubblico non lo legge come
// un utente che apre il planetario: lo legge come una raffica, e risponde
// 429. Il guaio è che nessuno dei quattro lo diceva agli altri venti: ogni
// richiesta si riprovava per conto suo, tre volte in sette secondi, mentre
// le altre continuavano a bussare. Da lì il messaggio che si vedeva più
// spesso di tutti — «il servizio delle quote è sovraccarico».
//
// Adesso c'è un rubinetto solo e tutte le richieste ci passano dentro: al
// massimo `insieme` in volo, e almeno `distanza` millisecondi fra una partenza
// e l'altra. È un rubinetto che si stringe da sé — a ogni no il passo si
// allarga e una richiesta in volo si toglie — e che si riapre quando le
// risposte tornano a essere dei sì. Così la raffica non parte mai, e un 429
// rallenta **tutti**, che è l'unica reazione che serva a qualcosa.
//
// La coda è **una**, e la fonte si decide al momento di partire e non al
// momento di mettersi in fila. Sembra un dettaglio e non lo è: con una coda
// per fonte, le ventiquattro richieste si mettevano in fila su Open-Meteo
// tutte insieme nel primo istante, e da quel momento erano legate a lei. Se
// Open-Meteo era chiusa, la rotazione della §4 scattava dopo tre no — ma le
// ventuno richieste già in coda continuavano a essere consegnate alla porta
// chiusa, una per una, ognuna prendendosi il suo no prima di potersi
// riproporre altrove. Misurato con un Open-Meteo che rifiutava tutto:
// **ventisette richieste buttate sulla porta chiusa e ventisette secondi** per
// un orizzonte che gli altri due host avrebbero dato in due. Con una coda sola
// il rubinetto rilegge `terrenoFonte()` a ogni partenza, quindi la rotazione
// vale per tutta la coda nell'istante in cui accade.
//
// Il ritmo (`insieme`, `distanza`, `liberoDa`) resta invece **per fonte**: è
// una proprietà di quell'host, e tornandoci si vuole ritrovare quello che si
// era imparato su di lui. Quante ne sono in volo è un conto solo perché con un
// host solo si parla per volta.
// Il tetto del passo, e perché è scritto basso.
//
// Erano sei secondi, e sei secondi sono un tetto che non serve a nessuno: con
// ventiquattro richieste da spaziare fanno **due minuti e mezzo** di sola
// attesa, cioè un orizzonte che non arriva più. Il ragionamento sbagliato era
// «se il servizio è carico si va piano»; quello giusto è che le fonti sono
// tre, e un servizio che non regge più di una richiesta al secondo non è un
// servizio da aspettare — è un servizio da lasciare (`terrenoFrena` gira la
// porta da sé). Il tetto quindi è quello: oltre, si cambia.
//
// Il numero si ricava dal lavoro e non dal gusto: le richieste sono
// ventiquattro, e il tempo che si è disposti a spendere per un orizzonte è
// una ventina di secondi. Ventiquattro per nove decimi di secondo fanno
// ventuno, e il tetto è quello. Un servizio che chiede di andare più piano di
// così ce lo dice col `retry-after`, e quello si rispetta (fino a
// `TERRENO_PAUSA_MAX_MS`); quello che non si fa più è **indovinare** da soli
// una pausa che il servizio non ha chiesto e pagarla ventiquattro volte.
const TERRENO_DISTANZA_MAX_MS = 900;
// Quanto al massimo si sta fermi ad aspettare, anche se il servizio ha
// chiesto di più. Dieci secondi: le fonti sono tre, e restare fermi mezzo
// minuto perché la prima ha scritto «retry-after: 120» vuol dire non usare le
// altre due. Era mezzo minuto, ed era già il ragionamento giusto scritto col
// numero di prima che nessuno aveva più guardato.
const TERRENO_PAUSA_MAX_MS = 10000;
// Come si frena, e come si riparte. **Prima la concorrenza, poi il passo.**
//
// Questa è la lezione che il rubinetto ha imparato per ultima, e l'ha imparata
// da una sonda: con un servizio che rifiutava una richiesta su quattro, il
// rubinetto si assestava a settecento millesimi di distanza con **cinque o sei
// richieste concesse insieme e zero in volo**. Cioè si teneva aperta una
// concorrenza che non usava, e serializzava tutto lo scarico su un buco di
// mezzo secondo: venticinque richieste per settecento millesimi fanno i
// diciotto secondi che si misuravano, e non c'entrava niente né la latenza né
// il numero di riprove.
//
// Il difetto era nel modello. Un 429 dice «troppe **insieme**», e la risposta
// giusta è togliere richieste dal volo; allargare il buco fra una partenza e
// l'altra risponde a una domanda che nessuno ha fatto, e siccome è il buco a
// decidere la portata quando la concorrenza è libera, è l'unica delle due
// manopole che costa tempo. Quindi si fa quello che fa il TCP da quarant'anni
// (e ogni cliente di un servizio a quota da allora): **la concorrenza si
// dimezza a ogni no e cresce di uno a ogni sì**, mentre il passo si allarga
// appena e si ristringe da sé.
//
// L'asimmetria resta (un no pesa più di un sì) perché deve: sbagliare andando
// piano costa dei secondi, sbagliare andando forte costa un altro 429.
const TERRENO_FRENA = 1.25;            // di quanto si allarga il passo a ogni no
const TERRENO_MOLLA = 0.85;            // di quanto si stringe quando le cose vanno
const TERRENO_SI_PER_MOLLARE = 1;      // quanti sì di fila prima di riaprire

// Quanti no di fila prima di cambiare porta.
//
// È la differenza fra «questa richiesta non ce la fa» e «questa **fonte** non
// ce la fa», e per un pezzo l'app sapeva dire solo la prima: la rotazione
// stava in fondo al giro dei tentativi di `terrenoQuoteInsistendo`, quindi
// ogni richiesta doveva prendersi i suoi tre no sullo stesso host prima di
// concedersi il successivo — e le altre ventitré, che erano in coda dietro di
// lei, li prendevano tutte, uno per uno, sulla stessa porta chiusa. Dei no
// **di fila** su una fonte sono invece un'informazione sulla fonte, e vale per
// tutti: `terrenoFrena` sposta il puntatore e la coda che deve ancora partire
// parte già dall'host nuovo.
//
// Cinque e non tre, e il numero è stato misurato: cambiare porta **costa**.
// Open-Meteo accetta sei richieste insieme a ottanta millesimi di distanza, le
// due di riserva dichiarano una al secondo (OpenTopoData lo scrive nella sua
// documentazione), quindi rotolare su una di loro divide la portata per dieci.
// Con tre no di fila si abbandonava anche una fonte che stava soltanto
// lavorando piano: provato con tutti e tre gli host che rifiutavano una
// richiesta su due, il terreno passava da trentun secondi a cinquantotto e
// restava incompleto, perché si finiva a scaricare ventiquattro richieste a una
// al secondo. Cinque no di fila con una risposta su due sono il tre per cento
// dei casi, mentre una porta chiusa li dà subito: la soglia distingue le due
// cose, che è tutto quello che le si chiede.
const TERRENO_NO_PER_CAMBIARE = 5;

function terrenoRitmoDi(f) {
  if (!f.ritmo) {
    f.ritmo = {
      insieme: f.insieme, distanza: f.distanza,
      liberoDa: 0, siDiFila: 0,
      // Fino a quando il freno di questa fonte è già stato tirato. Serve a
      // frenare **una volta per ondata** e non una volta per richiesta: vedi
      // `terrenoFrena`.
      frenatoFino: 0, noDiFila: 0
    };
  }
  return f.ritmo;
}

// La coda unica, e quante richieste sono in volo adesso.
const terrenoCoda = [];
let terrenoInVolo = 0;
let terrenoTimer = null;

// La coda ha due classi di precedenza, e ce ne vogliono due.
//
// Il giro grosso esiste per una ragione sola: mettere in piedi un orizzonte
// vero, anche grosso, il prima possibile (`TERRENO_PASSO_GROSSO`). Ma una
// richiesta che si prende un no si rimette in fila, e mettendosi in fila **in
// fondo** finisce dietro alle ottanta direzioni dell'affinamento: il giro
// grosso non si chiude più finché non è passato tutto il resto, cioè proprio la
// cosa che non doveva aspettare. Misurato con un servizio che rifiutava una
// richiesta su quattro: il primo orizzonte vero passava da tre secondi e mezzo
// a sette e mezzo, mentre il terreno *completo* arrivava molto prima di prima.
// Cioè si era guadagnato sul totale e perso sull'unico numero che l'utente
// guarda.
//
// Con due classi, una riprova del giro grosso rientra davanti all'affinamento e
// dietro alle altre del giro grosso: l'ordine dentro a ogni classe resta quello
// di arrivo, che è quello che rende il fallimento sopportabile.
const TERRENO_PRI_SUBITO = 0;    // la quota di casa e il giro grosso
const TERRENO_PRI_DOPO = 1;      // l'affinamento

// `compito` riceve la fonte con cui parlare: quella di **adesso**, non quella
// che c'era quando si è messo in fila.
function terrenoInFila(compito, pri) {
  const mia = pri === TERRENO_PRI_DOPO ? TERRENO_PRI_DOPO : TERRENO_PRI_SUBITO;
  return new Promise((ok, no) => {
    const voce = { compito, ok, no, pri: mia };
    // Si entra dopo l'ultimo che ha almeno la nostra precedenza. La coda è di
    // qualche decina di voci: cercare il posto costa meno di tenere due array.
    let dove = terrenoCoda.length;
    while (dove > 0 && terrenoCoda[dove - 1].pri > mia) dove--;
    terrenoCoda.splice(dove, 0, voce);
    terrenoRubinetto();
  });
}

function terrenoRubinetto() {
  if (terrenoTimer) return;
  while (terrenoCoda.length) {
    // La fonte si rilegge a ogni giro: se è cambiata mentre questa richiesta
    // era in coda, parte verso quella nuova. Con lei si rileggono anche il suo
    // passo e il suo tetto di richieste insieme.
    const f = terrenoFonte();
    const r = terrenoRitmoDi(f);
    if (terrenoInVolo >= r.insieme) return;
    const aspetta = r.liberoDa - Date.now();
    if (aspetta > 0) {
      // Ci si risveglia e si riguarda: nel frattempo la pausa può essersi
      // allungata (un altro 429) o la fonte può essere cambiata.
      terrenoTimer = setTimeout(() => { terrenoTimer = null; terrenoRubinetto(); },
                                Math.min(aspetta, TERRENO_PAUSA_MAX_MS));
      return;
    }
    const v = terrenoCoda.shift();
    terrenoInVolo++;
    r.liberoDa = Date.now() + r.distanza;
    Promise.resolve().then(() => v.compito(f)).then(v.ok, v.no)
      .then(() => { terrenoInVolo--; terrenoRubinetto(); });
  }
}

// Questa fonte ha detto di no: si rallenta, e si sta fermi il tempo che ha
// chiesto lei (o quello che ci siamo dati noi, se non l'ha detto).
//
// **Una volta per ondata, non una per richiesta.** È il difetto che rendeva
// inutile tutto il resto del rubinetto, ed è aritmetica: se sono in volo sei
// richieste e il servizio è carico, i no arrivano a sei per volta — sono la
// stessa notizia detta sei volte, non sei notizie. Frenando a ogni no il passo
// veniva moltiplicato per 2,2 sei volte di fila, cioè per centoundici, e in
// due ondate era già al tetto: da lì in poi ogni richiesta costava sei secondi
// di sola attesa, ed è il motivo per cui con un servizio che rifiutava una
// richiesta su quattro il terreno **non arrivava mai** (misurato: 28 richieste
// HTTP in novanta secondi, e le ventiquattro non finivano). Adesso il freno si
// tira una volta e poi resta tirato per il tempo che si è appena imposto: i no
// della stessa ondata lo trovano già tirato e non lo stringono di nuovo.
function terrenoFrena(f, e) {
  const r = terrenoRitmoDi(f);
  const ora = Date.now();
  r.siDiFila = 0;
  // Il conto dei no serve alla rotazione, e quello va tenuto sempre: una
  // fonte che dice no sei volte l'ha detto sei volte, anche se il passo si
  // allarga una volta sola.
  r.noDiFila++;
  if (ora >= r.frenatoFino) {
    // La concorrenza si dimezza — è la manopola che risponde alla domanda che
    // il 429 ha fatto — e il passo si allarga appena.
    r.insieme = Math.max(1, Math.floor(r.insieme / 2));
    // Il tetto non può stare **sotto** al ritmo di crociera dichiarato dalla
    // fonte, se no frenare la farebbe andare più veloce di quanto lei stessa
    // ha chiesto: OpenTopoData dichiara una richiesta al secondo, e un tetto
    // di nove decimi la porterebbe a superarla proprio nel momento in cui ha
    // appena detto di no.
    const tetto = Math.max(TERRENO_DISTANZA_MAX_MS, f.distanza);
    r.distanza = Math.min(tetto, Math.round(r.distanza * TERRENO_FRENA));
    const pausa = Math.min(TERRENO_PAUSA_MAX_MS, (e && e.attesa) || r.distanza);
    r.liberoDa = Math.max(r.liberoDa, ora + pausa);
    r.frenatoFino = ora + pausa;
  }
  // Tre no di fila non sono la sfortuna di una richiesta: sono questa fonte.
  // Si cambia porta, e ci si porta dietro la coda che deve ancora partire —
  // che è il punto: prima ognuna delle ventiquattro doveva sbatterci il naso
  // per conto suo.
  if (r.noDiFila >= TERRENO_NO_PER_CAMBIARE) {
    r.noDiFila = 0;
    terrenoCambiaFonte(f);
  }
}

// Gira il puntatore, ma solo se la fonte da abbandonare è ancora quella
// corrente: due richieste che si prendono un no nello stesso istante
// girerebbero il puntatore due volte, e la seconda salterebbe una fonte buona
// senza averla provata.
function terrenoCambiaFonte(f) {
  const i = TERRENO_FONTI.indexOf(f);
  if (i < 0 || (terrenoFonteOra % TERRENO_FONTI.length) !== i) return;
  terrenoFonteOra = (i + 1) % TERRENO_FONTI.length;
}

// Ha detto di sì, e non una volta sola: si può riaprire un po'. Piano, e
// mai oltre il ritmo di crociera dichiarato dalla fonte.
function terrenoScorre(f) {
  const r = terrenoRitmoDi(f);
  // Un sì azzera il conto dei no: quello che conta per cambiare porta sono i
  // no **di fila**, e una fonte che risponde una volta su due è una fonte che
  // funziona piano, non una porta chiusa.
  r.noDiFila = 0;
  if (++r.siDiFila < TERRENO_SI_PER_MOLLARE) return;
  r.siDiFila = 0;
  r.distanza = Math.max(f.distanza, Math.round(r.distanza * TERRENO_MOLLA));
  if (r.insieme < f.insieme) r.insieme++;
}

// Quante volte insistere su una richiesta, in tutto e su tutte le fonti.
//
// Insistere è la parte che una volta mancava del tutto, e va tenuta: le
// richieste sono ventiquattro, e se ognuna ha anche solo il due per cento di
// probabilità di andare storta la probabilità che **almeno una** vada storta è
// quasi il quarantacinque per cento — una sola bastava a buttare via anche le
// altre ventitré.
//
// Ma le attese fra un tentativo e l'altro **non ci sono più**, e la ragione è
// che erano contate due volte. Chi si prendeva un no chiamava `terrenoFrena`,
// che sposta in avanti il `liberoDa` del rubinetto — cioè la pausa era già
// imposta, a tutte le richieste di quella fonte insieme — e poi dormiva
// *anche* per conto suo uno, quattro, undici secondi prima di rimettersi in
// coda. Le due si sommavano in fila indiana, e sedici secondi di sonno per
// richiesta su ventiquattro richieste sono il tempo che questo modulo passava
// a non fare niente. Adesso chi prende un no si rimette in coda **subito**: a
// tenere il passo è il rubinetto, che è l'unico che sa quanto il servizio sta
// reggendo adesso, e che intanto ha già girato la porta se la fonte non
// risponde più (`terrenoCambiaFonte`).
//
// Cinque tentativi in tutto, non cinque per fonte: sono i tre giri di porta
// più due riprove: bastano a coprire il singhiozzo e non fanno di
// ventiquattro richieste duecento.
const TERRENO_TENTATIVI = 5;

// Vale la pena riprovare? Sì per i 429 («sei andato troppo forte»), per i
// guasti del server e per tutto quello che non è nemmeno arrivato a una
// risposta (rete caduta, sveglia scaduta). No per un 400: se la richiesta è
// scritta male, riprovarla identica dà lo stesso errore tre volte.
function terrenoRiprovabile(e) {
  if (!e || typeof e.stato !== 'number') return true;
  return e.stato === 429 || e.stato >= 500;
}

// Insistere, e cambiare porta quando serve.
//
// Un 429 non dice «questo dato non esiste», dice «non da me, non adesso»:
// arrendersi lì vuol dire restare senza orizzonte avendo in tasca altri due
// servizi che quel dato ce l'hanno. Ma **quale** porta provare non è più una
// decisione di questa funzione: la fonte di adesso è `terrenoFonte()`, e a
// girarla è il rubinetto quando una fonte accumula dei no
// (`terrenoCambiaFonte`). Il giro annidato di prima — per ogni fonte, i suoi
// tre tentativi — faceva sì che ognuna delle ventiquattro richieste dovesse
// rifare da sé la scoperta che la prima porta era chiusa. Rileggendo la fonte
// a ogni tentativo, la scoperta la fa la prima e le altre ventitré partono
// già dalla porta giusta.
//
// Un errore che **non** è riprovabile (un 400 perché la richiesta è troppo
// lunga) esce subito: quello lo sa gestire chi chiama, spezzando la richiesta
// in due.
async function terrenoQuoteInsistendo(punti, pri) {
  let ultimo = null;
  for (let t = 0; t < TERRENO_TENTATIVI; t++) {
    try {
      /* eslint-disable no-await-in-loop */
      // Quale fonte, lo decide il rubinetto quando arriva il turno: `f` qui
      // dentro è già quella giusta.
      return await terrenoInFila(f => terrenoQuoteDa(f, punti), pri);
    } catch (e) {
      ultimo = e;
      if (!terrenoRiprovabile(e)) throw e;
      // Niente sonno qui: la pausa l'ha già messa `terrenoFrena` sul
      // rubinetto, e sommarcene una seconda è il difetto che questa riga
      // conteneva.
    }
  }
  throw ultimo;
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

// Le creste parziali, in quattro passaggi.
//
// L'ordine conta, ed è il punto di tutta questa parte. I due filtri vanno
// **prima** dell'accumulo del massimo, sugli angoli campione per campione: un
// dente che arriva dall'anello dei centocinquanta metri, una volta accumulato,
// si ritrova copiato in tutte e diciotto le caselle della sua riga — compresa
// l'ultima, che è la cresta vera — e in fondo alla riga la finestra dei filtri
// è larga zero direzioni, perché a sessanta chilometri la griglia risolve
// l'azimut benissimo. Filtrando dopo, lo spillo non si toglie più: provato,
// il dente da otto gradi restava intero.
//
// Filtrando prima, invece, l'accumulo porta avanti valori già puliti, e in
// regalo dà la **non-decrescenza in distanza** — l'invariante su cui poggia
// tutta l'occlusione del disegno a piani — senza doverla rimettere a posto.
function terrenoFronti(quote, occhio) {
  const a = terrenoAngoliCampione(quote, occhio);
  terrenoTosaSpilliLarghi(a);
  terrenoLisciaAnelli(a);
  return terrenoTosaSpilli(terrenoAccumulaFronti(a));
}

// Quanti passi di azimut copre una cella del modello del suolo a quella
// distanza — o `celle` volte tanto, per chi ha bisogno di guardare oltre.
// Zero vuol dire «la griglia qui risolve meglio del modello»: e allora non
// c'è niente da filtrare.
function terrenoPassiDiCella(km, tettoGradi, celle) {
  const gradi = Math.atan2(TERRENO_CELLA_M, Math.max(1, km * 1000)) * 180 / Math.PI;
  return Math.min(Math.round(tettoGradi / TERRENO_PASSO_AZ),
    Math.round((celle || 1) * gradi / TERRENO_PASSO_AZ));
}

// L'angolo di ogni singolo campione, senza accumulare niente. Un campione che
// non è arrivato resta `-Infinity`: è il modo di dire «di qui non si sa
// nulla» che i filtri e l'accumulo sanno saltare, mentre uno zero o un
// `TERRENO_ALT_MIN` sarebbero due numeri e verrebbero mediati come tali.
function terrenoAngoliCampione(quote, occhio) {
  const n = TERRENO_DISTANZE.length;
  const a = new Float32Array(TERRENO_DIREZIONI * n);
  for (let i = 0; i < TERRENO_DIREZIONI; i++) {
    for (let k = 0; k < n; k++) {
      const q = quote[i * n + k];
      a[i * n + k] = typeof q === 'number'
        ? terrenoAngolo(q, occhio, TERRENO_DISTANZE[k]) : -Infinity;
    }
  }
  return a;
}

// Il tetto a mediana, anello per anello: un campione non può stare più di
// `TERRENO_SPILLO_LARGO_GRADI` sopra alla mediana della sua finestra.
//
// È la tosatura degli spilli chiesta a un vicinato **più largo di una cella**,
// che è l'unico modo di accorgersi di un errore che sei direzioni si sono
// ricopiate a vicenda. La mediana e non il massimo: il massimo di una
// finestra che contiene il dente è il dente stesso, e il tetto diventa una
// promessa che si autofirma.
//
// Cosa lascia in pace, e perché è la metà che conta: una costa, il fianco di
// una valle, un altopiano occupano molto più di una finestra, quindi la loro
// mediana **sono loro** e il tetto non morde. Sparisce solo quello che è più
// stretto di metà finestra, cioè più stretto di quanto il modello sappia
// disegnare.
function terrenoTosaSpilliLarghi(a) {
  const n = TERRENO_DISTANZE.length;
  const colonna = new Float32Array(TERRENO_DIREZIONI);
  const finestra = [];
  for (let k = 0; k < n; k++) {
    const m = terrenoPassiDiCella(TERRENO_DISTANZE[k], TERRENO_TETTO_LARGO_GRADI,
      TERRENO_TETTO_LARGO_CELLE);
    // Con meno di due direzioni per parte il lavoro l'ha già fatto
    // `terrenoTosaSpilli`, che guarda le due vicine e costa niente.
    if (m < 2) continue;
    for (let i = 0; i < TERRENO_DIREZIONI; i++) colonna[i] = a[i * n + k];
    for (let i = 0; i < TERRENO_DIREZIONI; i++) {
      if (!isFinite(colonna[i])) continue;
      finestra.length = 0;
      for (let d = -m; d <= m; d++) {
        const v = colonna[((i + d) % TERRENO_DIREZIONI + TERRENO_DIREZIONI) % TERRENO_DIREZIONI];
        if (isFinite(v)) finestra.push(v);
      }
      if (finestra.length < 3) continue;
      finestra.sort((x, y) => x - y);
      const mediana = finestra[(finestra.length - 1) >> 1];
      const tetto = mediana + TERRENO_SPILLO_LARGO_GRADI;
      if (colonna[i] > tetto) a[i * n + k] = tetto;
    }
  }
  return a;
}

// Il passa-basso vero e proprio: una media mobile pesata a campana (finestra
// di Hann) sui raggi vicini, anello per anello.
//
// Serve alla scaletta, che è una cosa diversa dallo spillo: là c'è un
// campione sbagliato, qui sono tutti giusti e il difetto sta nel modo in cui
// li abbiamo chiesti. Vicino, gruppi di direzioni leggono la stessa cella e
// poi si salta di colpo a quella dopo — misurato su un profilo di costa
// pulito, gradini di tre gradi da una direzione all'altra. Una campana e non
// una finestra secca perché una media a pesi uguali sposta gli spigoli invece
// di scioglierli.
//
// Qui una media è lecita — e altrove no, come dice `terrenoTosaSpilli` — per
// una ragione sola: la finestra è larga quanto la cella, quindi si media su
// un pezzo di cielo in cui il modello del suolo **non ha niente da dire**.
// Dove ha qualcosa da dire (da quattro chilometri in su) la finestra è larga
// zero e questa funzione esce senza toccare un valore.
function terrenoLisciaAnelli(a) {
  const n = TERRENO_DISTANZE.length;
  const colonna = new Float32Array(TERRENO_DIREZIONI);
  for (let k = 0; k < n; k++) {
    const m = terrenoPassiDiCella(TERRENO_DISTANZE[k], TERRENO_LISCIA_GRADI);
    if (m < 1) continue;
    for (let i = 0; i < TERRENO_DIREZIONI; i++) colonna[i] = a[i * n + k];
    const pesi = [];
    for (let d = -m; d <= m; d++) pesi.push(0.5 * (1 + Math.cos(Math.PI * d / (m + 1))));
    for (let i = 0; i < TERRENO_DIREZIONI; i++) {
      if (!isFinite(colonna[i])) continue;
      let somma = 0, peso = 0;
      for (let j = 0, d = -m; d <= m; d++, j++) {
        const v = colonna[((i + d) % TERRENO_DIREZIONI + TERRENO_DIREZIONI) % TERRENO_DIREZIONI];
        // I campioni che non sono arrivati non contano, e non contano nemmeno
        // il loro peso: se no una direzione al bordo di un buco verrebbe
        // tirata verso il basso dal niente che le sta accanto.
        if (!isFinite(v)) continue;
        somma += v * pesi[j];
        peso += pesi[j];
      }
      if (peso > 0) a[i * n + k] = somma / peso;
    }
  }
  return a;
}

// Da un angolo per campione alla cresta parziale: il massimo che si accumula
// andando avanti. È quello che faceva `terrenoFronti` da sé, tirato fuori
// perché adesso in mezzo ci sono i filtri.
function terrenoAccumulaFronti(a) {
  const n = TERRENO_DISTANZE.length;
  const f = new Float32Array(TERRENO_DIREZIONI * n);
  for (let i = 0; i < TERRENO_DIREZIONI; i++) {
    let massimo = TERRENO_ALT_MIN;
    for (let k = 0; k < n; k++) {
      const v = a[i * n + k];
      if (v > massimo) massimo = v;
      f[i * n + k] = Math.max(TERRENO_ALT_MIN, Math.min(TERRENO_ALT_MAX, massimo));
    }
  }
  return f;
}

// Il passa-basso in azimut, che è un tetto e non una media.
//
// Si lavora **una distanza per volta**, sul giro chiuso delle centoventi
// direzioni: per ogni direzione il valore non può superare di più di
// `TERRENO_SPILLO_GRADI` la più alta delle sue due vicine a quella stessa
// distanza. Il confronto è coi valori **di prima** (la colonna si copia)
// perché se no il taglio si propaga: tosata la prima, la seconda si
// ritroverebbe una vicina più bassa e verrebbe tosata anche lei, e in un
// giro l'orizzonte diventerebbe piatto.
//
// Due proprietà, e servono tutt'e due. La riga resta **non decrescente** in
// distanza — che è l'invariante su cui poggia tutta l'occlusione del
// disegno a piani: il tetto di una fetta è al più quello della fetta dopo
// (le vicine non decrescono neanche loro) e il valore tosato è il minimo di
// due quantità che crescono entrambe, quindi cresce. E una cresta larga —
// una catena, un altopiano, il fianco di una valle — non si muove di un
// centesimo, perché le sue vicine sono alte quanto lei.
function terrenoTosaSpilli(f) {
  const n = TERRENO_DISTANZE.length;
  const colonna = new Float32Array(TERRENO_DIREZIONI);
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < TERRENO_DIREZIONI; i++) colonna[i] = f[i * n + k];
    for (let i = 0; i < TERRENO_DIREZIONI; i++) {
      const prima = colonna[(i - 1 + TERRENO_DIREZIONI) % TERRENO_DIREZIONI];
      const dopo = colonna[(i + 1) % TERRENO_DIREZIONI];
      const tetto = Math.max(prima, dopo) + TERRENO_SPILLO_GRADI;
      if (colonna[i] > tetto) f[i * n + k] = tetto;
    }
  }
  return f;
}

// --- Le richieste, e in che ordine si fanno --------------------------
//
// Ogni richiesta porta un numero **intero di direzioni**: cinque, che sono
// novanta punti. Non è un dettaglio di comodo, è quello che rende il
// fallimento sopportabile — una richiesta che va male lascia un buco fatto
// di direzioni intere, e un buco di direzioni si tappa interpolando le
// vicine. Con le richieste tagliate ogni novanta punti a caso, un buco
// cadeva a metà di una direzione e quella direzione era da buttare.
const TERRENO_DIREZIONI_PER_RICHIESTA =
  Math.max(1, Math.floor(TERRENO_PER_RICHIESTA / TERRENO_DISTANZE.length));

// Due giri. Il primo prende una direzione ogni tre — quaranta direzioni,
// otto richieste — e appena arriva **si disegna**: un orizzonte a nove gradi
// di passo è già il posto in cui uno vive, e si vede dopo un paio di secondi
// invece che dopo dieci. Il secondo riempie le altre ottanta e lo affina.
//
// Serve a due cose insieme. La prima è l'attesa: prima il terreno compariva
// tutto in una volta alla fine, e fino a lì c'era l'orizzonte finto — che è
// esattamente il momento in cui uno si convince che «non funziona». La
// seconda è che se il secondo giro non ce la fa, il primo resta: meglio un
// orizzonte vero un po' grosso che nessun orizzonte vero.
const TERRENO_PASSO_GROSSO = 3;

// Quanto si concede alla quota di casa, dopo che tutto il resto è arrivato.
// Un secondo e mezzo: è la coda di una richiesta che era partita per prima e
// che quasi sempre ha già risposto. Oltre, si va avanti con la stima.
const TERRENO_GRAZIA_QUOTA_MS = 1500;

// `sapute` sono le direzioni che si hanno già in mano — da un tentativo di
// prima, magari di ieri, che la rete aveva lasciato a metà. Non si
// richiedono: è quello che rende ogni tentativo più corto del precedente
// invece che identico, e quindi che rende il terreno una cosa che **prima o
// poi arriva** anche quando il servizio dice di no un giorno sì e uno no.
function terrenoRichieste(lat, lon, sapute) {
  const nota = sapute instanceof Set ? sapute : new Set(sapute || []);
  const grosse = [], fini = [];
  for (let i = 0; i < TERRENO_DIREZIONI; i++) {
    if (nota.has(i)) continue;
    (i % TERRENO_PASSO_GROSSO === 0 ? grosse : fini).push(i);
  }
  const richieste = [];
  const impacchetta = (elenco, giro) => {
    for (let i = 0; i < elenco.length; i += TERRENO_DIREZIONI_PER_RICHIESTA) {
      const dirs = elenco.slice(i, i + TERRENO_DIREZIONI_PER_RICHIESTA);
      const punti = [];
      dirs.forEach(d => TERRENO_DISTANZE.forEach(
        km => punti.push(terrenoPuntoA(lat, lon, d * TERRENO_PASSO_AZ, km))));
      richieste.push({ giro, dirs, punti });
    }
  };
  impacchetta(grosse, 0);
  impacchetta(fini, 1);
  return richieste;
}

// Quante direzioni si osa mettere in una richiesta, adesso.
//
// Parte da cinque (novanta punti, che è quanto il servizio dichiara di
// accettare) e **si stringe da sola** se il servizio dice di no. Un 400 o un
// 414 vogliono dire «questa richiesta non mi va bene», e con una richiesta
// fatta di sole coordinate il motivo plausibile è uno solo: sono troppe.
// Riprovarla identica dà lo stesso errore all'infinito — ed è il modo in cui
// una cosa «non funziona mai» invece di funzionare a singhiozzo.
//
// Dimezzando si trova da sé la misura buona, qualunque sia, e da quel
// momento tutte le richieste seguenti nascono già di quella misura: si paga
// il tentativo una volta sola e non ventiquattro.
let terrenoDirezioniPerVolta = TERRENO_DIREZIONI_PER_RICHIESTA;

// E quante ne accetta la fonte con cui si sta parlando adesso: le tre ne
// dichiarano cento a testa, ma sono tre servizi diversi e non c'è nessuna
// ragione perché resti così per sempre. Il limite di chi risponde vince
// sempre su quello che ci siamo dati noi.
function terrenoDirezioniOra() {
  const f = terrenoFonte();
  const suo = Math.max(1, Math.floor((f.max || TERRENO_PER_RICHIESTA) / TERRENO_DISTANZE.length));
  return Math.max(1, Math.min(terrenoDirezioniPerVolta, suo));
}

function terrenoTroppoLunga(e) {
  return !!e && (e.stato === 400 || e.stato === 413 || e.stato === 414);
}

// Una richiesta tagliata in due, sul confine fra due direzioni.
function terrenoSpezza(r, da, a) {
  const nd = TERRENO_DISTANZE.length;
  return { giro: r.giro, dirs: r.dirs.slice(da, a), punti: r.punti.slice(da * nd, a * nd) };
}

// Chiede una richiesta, e se serve la spezza. Torna l'elenco dei pezzi
// riusciti — che può essere anche solo una metà, ed è meglio di niente.
async function terrenoChiedi(r) {
  const nd = TERRENO_DISTANZE.length;
  const quante = terrenoDirezioniOra();
  if (r.dirs.length > quante) {
    return terrenoDueMeta(r, Math.max(1, Math.min(quante, r.dirs.length - 1)));
  }
  try {
    // Il giro grosso passa davanti all'affinamento anche quando si riprova:
    // è tutto il motivo per cui esiste (vedi `terrenoInFila`).
    const q = await terrenoQuoteInsistendo(r.punti,
      r.giro === 0 ? TERRENO_PRI_SUBITO : TERRENO_PRI_DOPO);
    if (!Array.isArray(q) || q.length !== r.dirs.length * nd) {
      throw new Error(`il servizio ha risposto con ${q ? q.length : 0} quote invece di ${r.dirs.length * nd}`);
    }
    return [{ dirs: r.dirs, quote: q }];
  } catch (e) {
    if (!terrenoTroppoLunga(e) || r.dirs.length < 2) throw e;
    terrenoDirezioniPerVolta = Math.max(1, Math.floor(r.dirs.length / 2));
    return terrenoDueMeta(r, terrenoDirezioniPerVolta);
  }
}

async function terrenoDueMeta(r, taglio) {
  const pezzi = await Promise.all([
    terrenoChiedi(terrenoSpezza(r, 0, taglio)).catch(() => null),
    terrenoChiedi(terrenoSpezza(r, taglio, r.dirs.length)).catch(() => null)
  ]);
  const buoni = pezzi.filter(Boolean).reduce((a, p) => a.concat(p), []);
  if (!buoni.length) throw new Error('nessuna delle due metà è arrivata');
  return buoni;
}

// I buchi si tappano interpolando fra le due direzioni misurate che stanno
// prima e dopo, sul giro. Sono quote del suolo: fra un campione e l'altro il
// terreno non fa salti, e a tre gradi di distanza una media pesata è più
// vicina al vero di qualunque altra cosa si possa inventare.
//
// È questo che rende il disegno possibile anche quando manca qualcosa: il
// resto dell'app vuole una griglia piena — centoventi direzioni per diciotto
// distanze — e non le importa da dove arrivano i numeri.
function terrenoRiempiVuoti(quote, avute) {
  const nd = TERRENO_DISTANZE.length;
  const presente = new Uint8Array(TERRENO_DIREZIONI);
  avute.forEach(i => { presente[i] = 1; });
  if (!avute.length) return false;

  for (let i = 0; i < TERRENO_DIREZIONI; i++) {
    if (presente[i]) continue;
    let a = i, b = i, da = 0, db = 0;
    while (!presente[a]) { a = (a - 1 + TERRENO_DIREZIONI) % TERRENO_DIREZIONI; da++; }
    while (!presente[b]) { b = (b + 1) % TERRENO_DIREZIONI; db++; }
    const t = da / (da + db);
    for (let k = 0; k < nd; k++) {
      const qa = quote[a * nd + k], qb = quote[b * nd + k];
      quote[i * nd + k] = (typeof qa === 'number' && typeof qb === 'number')
        ? Math.round(qa + (qb - qa) * t)
        : (typeof qa === 'number' ? qa : (typeof qb === 'number' ? qb : null));
    }
  }
  return true;
}

// La quota di casa, quando la richiesta che la chiedeva non è arrivata.
//
// È un punto solo, ma per un pezzo è stato **il** punto: era la prima
// richiesta e fermava tutto, quindi un 429 preso su di lei buttava via
// l'intero orizzonte prima ancora di cominciare a misurarlo. Eppure la
// risposta ce l'abbiamo già in mano: il primo anello di campioni sta a
// centocinquanta metri da qui, e la mediana di quelle centoventi quote è la
// quota del suolo sotto i piedi a meno di qualche metro — meno dell'errore
// del modello. Si prende la mediana e non la media perché basta un campione
// caduto in un fosso o su un tetto per spostare la media di venti metri.
function terrenoQuotaDaVicino(quote, avute) {
  const nd = TERRENO_DISTANZE.length;
  const vicine = [];
  avute.forEach(i => {
    const q = quote[i * nd];
    if (typeof q === 'number') vicine.push(q);
  });
  if (!vicine.length) return null;
  vicine.sort((a, b) => a - b);
  return vicine[Math.floor(vicine.length / 2)];
}

// Dalle quote grezze al profilo: le creste, i paesaggi, e la griglia piena
// da salvare. Si può chiamare con qualunque sottoinsieme di direzioni in
// mano — è quello che permette di disegnare a metà strada.
function terrenoMonta(grezze, avute, quotaChiesta) {
  const nd = TERRENO_DISTANZE.length;
  const quote = grezze.slice();
  terrenoRiempiVuoti(quote, avute);

  const stimata = typeof quotaChiesta !== 'number';
  const quotaCasa = stimata ? terrenoQuotaDaVicino(quote, avute) : quotaChiesta;
  const occhio = (typeof quotaCasa === 'number' ? quotaCasa : 0) + TERRENO_ALTEZZA_OCCHIO_M;
  // Le creste **sono** l'ultima colonna delle creste parziali, non un secondo
  // massimo calcolato a parte. Erano due conti gemelli, e per un pezzo hanno
  // dato lo stesso numero; da quando `terrenoFronti` tosa gli spilli non lo
  // darebbero più, e le due risposte divergerebbero in silenzio — la sagoma
  // disegnata (che legge `fronti`) racconterebbe un orizzonte e la cresta che
  // decide se un astro è sorto (che legge `profilo`) un altro. Ricavandola da
  // qui l'accordo è per costruzione, ed è la proprietà che il §15 di
  // `verifica.html` controlla azimut per azimut.
  const fronti = terrenoFronti(quote, occhio);
  const creste = new Array(TERRENO_DIREZIONI).fill(0);
  const tipi = new Array(TERRENO_DIREZIONI).fill(TERRENO_PIANURA);
  for (let i = 0; i < TERRENO_DIREZIONI; i++) {
    // Sotto zero non si scende: da una cima l'orizzonte vero è **sotto**
    // la linea, ma tutto il resto dell'app dà per scontato che la terra
    // cominci a zero gradi — dal riempimento del terreno alla curva della
    // notte. Meglio un orizzonte piatto che un'app che si contraddice.
    creste[i] = Math.max(0, Math.min(TERRENO_ALT_MAX, fronti[i * nd + nd - 1]));
    tipi[i] = terrenoTipoDiDirezione(quote, i, quotaCasa, creste[i]);
  }

  // Le quote grezze si portano dietro, arrotondate al metro: sono le
  // stesse che hanno fatto le creste, ma tenerle vuol dire poter
  // rispondere anche alle due domande più fini — «che c'è **davanti** a quel
  // punto lì» (§8, da cui dipende se una vetta si vede) e «che forma ha il
  // terreno fino a lì», che è quella che il planetario disegna. Duemilacento
  // interi: una decina di kilobyte, e non si riscaricano mai più.
  //
  // `avute` si porta dietro **quali** direzioni sono misurate e non soltanto
  // quante: è la lista che permette a un tentativo dopo di chiedere solo il
  // pezzo che manca. Contando i buchi si sa che ce ne sono trenta, ma non
  // dove sono — e quelle interpolate, nella griglia salvata, sono numeri
  // identici a quelli veri.
  // `fronti` viaggia con gli altri ma **non** si salva (vedi `terrenoSalva`,
  // che sceglie i campi a mano): sono duemila e cento float che si rifanno in
  // un millisecondo dalle quote grezze, e scriverli in `localStorage`
  // vorrebbe dire raddoppiare il posto occupato per non guadagnare niente.
  return {
    quota: quotaCasa, quotaStimata: stimata && typeof quotaCasa === 'number',
    creste, tipi, quote, fronti,
    avute: avute.slice().sort((a, b) => a - b), misurate: avute.length
  };
}

// Scarica quello che riesce, e non si arrende per una richiesta andata male.
//
// `mostra` viene chiamata alla fine del giro grosso, con quello che c'è: da
// lì in poi l'orizzonte sullo schermo è quello vero, e il resto lo affina.
//
// `gia` è quello che si sa già — la griglia di un tentativo precedente,
// finito a metà. Le sue direzioni non si richiedono: un tentativo dopo l'altro
// il buco si stringe, e il terreno diventa una cosa che prima o poi arriva
// invece di una lotteria che ogni volta ricomincia da zero.
async function terrenoCostruisci(lat, lon, mostra, gia) {
  const nd = TERRENO_DISTANZE.length;
  const grezze = new Array(TERRENO_DIREZIONI * nd).fill(null);
  const avute = [];

  if (gia && Array.isArray(gia.quote) && Array.isArray(gia.avute)) {
    gia.avute.forEach(d => {
      if (!(d >= 0 && d < TERRENO_DIREZIONI)) return;
      for (let k = 0; k < nd; k++) {
        const v = gia.quote[d * nd + k];
        grezze[d * nd + k] = typeof v === 'number' ? v : null;
      }
      avute.push(d);
    });
  }
  const sapute = new Set(avute);

  // La quota di casa. Senza sapere da che altezza si guarda ogni angolo è
  // sbagliato — è il termine che si sottrae a tutti gli altri — ma **non
  // ferma più tutto**: se non arriva la si ricava dall'anello dei campioni
  // più vicini (`terrenoQuotaDaVicino`), che sono quote dello stesso suolo a
  // centocinquanta metri da qui.
  //
  // «Non ferma più tutto» era vero per il *risultato* e falso per il
  // **tempo**: la sua richiesta stava davanti a tutte le altre con un `await`,
  // quindi ventiquattro richieste aspettavano un punto solo. Su una rete che
  // funziona è mezzo secondo buttato; su un servizio carico sono i suoi
  // tentativi, uno dopo l'altro, prima che l'orizzonte cominci a misurarsi —
  // ed è esattamente il momento in cui chi guarda decide che «non funziona».
  // Adesso parte per prima ma **insieme** alle altre: è una richiesta come
  // loro, passa dallo stesso rubinetto e prende il primo posto in coda.
  let quotaCasa = (gia && typeof gia.quota === 'number' && !gia.quotaStimata) ? gia.quota : null;
  let guaio = null;
  let quotaArrivata = false;
  const quotaInVolo = quotaCasa === null
    ? terrenoQuoteInsistendo([{ lat, lon }], TERRENO_PRI_SUBITO).then(
      ([q]) => { if (typeof q === 'number') { quotaCasa = q; quotaArrivata = true; } },
      e => { if (!guaio) guaio = e; })
    : null;

  const richieste = terrenoRichieste(lat, lon, sapute);
  let fatte = 0;
  terreno.avanzamento = 0;

  const accogli = pezzi => pezzi.forEach(pezzo => {
    pezzo.dirs.forEach((d, j) => {
      for (let k = 0; k < nd; k++) {
        const v = pezzo.quote[j * nd + k];
        grezze[d * nd + k] = typeof v === 'number' ? Math.round(v) : null;
      }
    });
    avute.push(...pezzo.dirs);
  });

  // Il giro grosso e l'affinamento vanno in coda **insieme**, e non uno dopo
  // l'altro con un `await` in mezzo.
  //
  // La barriera fra i due giri sembrava gratis e non lo era: il secondo giro
  // non poteva partire finché *ogni* richiesta del primo non aveva finito, e
  // «finito» comprende i suoi tentativi. Una sola richiesta del giro grosso
  // che si prendeva un no teneva il rubinetto fermo — con niente in volo e
  // sedici richieste pronte a partire — per tutto il tempo delle sue riprove.
  // La barriera non serviva a niente, perché quello che il giro grosso deve
  // garantire è solo di essere **disegnato per primo**, e per quello basta
  // contarne i pezzi: la coda del rubinetto è già in ordine (§4, `terrenoInFila`
  // serve in ordine di arrivo), quindi le quaranta direzioni grosse partono
  // comunque prima delle ottanta fini.
  //
  // Ogni richiesta si porta dietro il proprio errore invece di far fallire il
  // gruppo: è la differenza fra «ne mancano cinque direzioni» e «non c'è
  // niente».
  let restaGrosso = richieste.reduce((n, r) => n + (r.giro === 0 ? 1 : 0), 0);
  const disegnaIlGrosso = () => {
    if (avute.length && typeof mostra === 'function') {
      mostra(terrenoMonta(grezze, avute, quotaCasa));
    }
  };
  // Tutto già saputo da un tentativo di prima: non c'è nessun giro grosso da
  // aspettare, e quello che si ha in mano si disegna subito.
  if (!restaGrosso) disegnaIlGrosso();

  await Promise.all(richieste.map(r => terrenoChiedi(r)
    .then(accogli, e => { guaio = e; })
    .then(() => {
      fatte++;
      terreno.avanzamento = richieste.length ? fatte / richieste.length : 1;
      terrenoAggiornaPannello();
      if (r.giro === 0 && --restaGrosso === 0) disegnaIlGrosso();
    })));

  // Un istante di grazia per la quota di casa, che era partita per prima:
  // arrivata fin qui, quasi sempre ha già risposto da un pezzo. Se non ce l'ha
  // fatta si va avanti con la stima dell'anello — il profilo si segna
  // `quotaStimata` e chi riprova più tardi la completa, che è quello che
  // succedeva anche prima quando quella richiesta falliva. Quello che **non**
  // deve succedere è che sia lei a far aspettare un orizzonte già misurato.
  if (quotaInVolo && !quotaArrivata) {
    await Promise.race([
      quotaInVolo,
      new Promise(f => setTimeout(f, TERRENO_GRAZIA_QUOTA_MS))
    ]);
  }

  // Niente di niente: allora è un guasto vero, e si dice.
  if (!avute.length) throw guaio || new Error('nessuna quota è arrivata');
  return { dati: terrenoMonta(grezze, avute, quotaCasa), guaio };
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
      lat, lon, quota: dati.quota, quotaStimata: !!dati.quotaStimata,
      creste: dati.creste, tipi: dati.tipi,
      // `avute` è la lista delle direzioni misurate davvero. Senza di lei un
      // profilo a metà è indistinguibile da uno intero — nella griglia
      // salvata le direzioni stimate sono numeri come gli altri — e l'unico
      // modo di completarlo sarebbe riscaricarlo tutto.
      quote: dati.quote, avute: dati.avute, misurate: dati.misurate,
      quando: Date.now()
    });
    localStorage.setItem(CHIAVE_TERRENO, JSON.stringify({ posti: posti.slice(0, TERRENO_POSTI_SALVATI) }));
  } catch (e) { /* storage pieno: pazienza, si riscarica */ }
}

// Butta via il **profilo**, non lo stato della richiesta. Sono due cose
// diverse, e per un pezzo non lo sono state: finché «c'è una richiesta in
// volo» voleva dire anche «non c'è nessun terreno», ogni affinamento
// cancellava per qualche secondo l'orizzonte che si stava guardando (vedi
// `terrenoDisponibile`). Questa si chiama quando il profilo che c'è non
// parla più del posto in cui siamo — un trasloco, un backup ripristinato —
// e allora sì che va buttato.
function terrenoScordaProfilo() {
  terreno.arreso = false;
  terreno.profilo = null;
  terreno.tipi = null;
  terreno.miscela = null;
  terreno.fronti = null;
  terreno.quote = null;
  terreno.quota = null;
  terreno.quotaStimata = false;
  terreno.misurate = 0;
  terreno.avute = [];
  terreno.quando = 0;
  terreno.lat = terreno.lon = null;
}

// Butta via quello che c'è in memoria. Serve al ripristino di un backup,
// che scrive direttamente in localStorage.
function terrenoDimentica() {
  terreno.stato = 'niente';
  terrenoScordaProfilo();
}


// =====================================================================
// 7. L'INNESCO
// =====================================================================

function terrenoApplica(lat, lon, dati, sorgente, ancoraInCorso) {
  terreno.lat = lat;
  terreno.lon = lon;
  terreno.quota = dati.quota;
  terreno.quotaStimata = !!dati.quotaStimata;
  terreno.misurate = typeof dati.misurate === 'number' ? dati.misurate : TERRENO_DIREZIONI;
  // Quali direzioni sono misurate davvero, per chi verrà a completarle. I
  // profili salvati prima che questa lista esistesse non ce l'hanno: se sono
  // interi va bene lo stesso, se erano a metà si riparte da zero come prima.
  terreno.avute = Array.isArray(dati.avute) ? dati.avute.slice()
    : (terreno.misurate >= TERRENO_DIREZIONI
      ? Array.from({ length: TERRENO_DIREZIONI }, (_, i) => i) : []);
  terreno.profilo = terrenoInterpola(dati.creste);
  terreno.tipi = terrenoTipiPerGrado(dati.tipi);
  terreno.miscela = terrenoMiscelaPerGrado(terreno.tipi);
  // I profili salvati prima che esistessero le quote grezze non ce le
  // hanno: si resta senza creste parziali, e chi le usa ripiega sul
  // profilo intero come faceva prima. Si rifanno da sé al primo posto
  // nuovo, e sono sei richieste che nessuno rifà apposta.
  const grigliaBuona = Array.isArray(dati.quote) &&
    dati.quote.length === TERRENO_DIREZIONI * TERRENO_DISTANZE.length;
  terreno.quote = grigliaBuona ? dati.quote : null;
  // Chi arriva da `terrenoMonta` le porta già calcolate (e già tosate dagli
  // spilli): rifarle qui vorrebbe dire farle due volte, e con la tosatura in
  // mezzo anche il rischio di farle **diverse** dalle creste. Chi arriva da
  // `localStorage` no — lì si salvano solo le quote grezze — e allora si
  // ricavano adesso.
  terreno.fronti = (grigliaBuona && dati.fronti && dati.fronti.length === dati.quote.length)
    ? dati.fronti
    : (grigliaBuona
      ? terrenoFronti(dati.quote, (typeof dati.quota === 'number' ? dati.quota : 0) + TERRENO_ALTEZZA_OCCHIO_M)
      : null);
  terreno.quotaAcqua = false;
  // Col giro grosso appena arrivato l'orizzonte è già quello vero e si
  // disegna, ma lo scarico non è finito: lo stato resta «in-corso», se no
  // chiunque richiami `terrenoCarica` crederebbe che non ci sia più niente
  // da fare e ne farebbe partire un secondo sopra al primo.
  terreno.stato = ancoraInCorso ? 'in-corso' : 'pronto';
  terreno.motivo = '';
  if (!ancoraInCorso) terreno.avanzamento = 0;
  terreno.quando = Date.now();
  terreno.sorgente = sorgente;
  // Se si sta dentro all'acqua, l'occhio non sta sul suolo: sta sulla
  // superficie. Si chiede qui perché il terreno e le acque arrivano in
  // ordine imprevedibile — il primo da `localStorage` e le seconde dalla
  // rete, o il contrario — e ognuno dei due, arrivando, deve poter rimettere
  // a posto la quota. La funzione non fa niente se non c'è niente da fare.
  acqueAllineaOcchio();
  // Non serve chiedere un ridisegno: il planetario ridisegna a ogni
  // fotogramma, e al primo utile la collina nuova è già lì.
  terrenoAggiornaPannello();
  if (typeof skyAggiornaStato === 'function') skyAggiornaStato();
  if (typeof skyAggiornaLuogoVistaUI === 'function') skyAggiornaLuogoVistaUI();
}

// Espone al planetario soltanto la quota che appartiene davvero al luogo
// mostrato. Il controllo evita che, mentre ci si sposta, accanto alla nuova
// città rimanga per qualche secondo l'altitudine di quella precedente.
function terrenoQuotaDelLuogo(lat, lon) {
  if (typeof terreno.quota !== 'number' || !isFinite(lat) || !isFinite(lon) ||
      !isFinite(terreno.lat) || !isFinite(terreno.lon)) return null;
  const dLat = lat - terreno.lat;
  const dLon = (lon - terreno.lon) * Math.cos(lat * Math.PI / 180);
  return Math.hypot(dLat, dLon) <= (2 / 111) ? terreno.quota : null;
}

// Rifare il profilo con un'altra quota dell'occhio, senza chiedere niente
// alla rete.
//
// La quota di casa non è un dato in più: è il termine che si **sottrae** a
// tutti gli angoli, quindi sbagliarla di venti metri storta l'orizzonte
// intero — le creste, le creste parziali da cui esce l'occlusione, i
// paesaggi. Per questo non basta scrivere il numero nuovo in `terreno.quota`
// e sperare: va rifatto tutto quello che da lei dipende. Il che si può fare
// senza rete, perché le quote grezze ce le abbiamo già in mano.
//
// Serve a un caso solo, ma è un caso che prima non veniva gestito affatto:
// chi guarda **dall'acqua**. Vedi `acqueAllineaOcchio`.
function terrenoRimontaConQuota(quota, perche) {
  if (typeof quota !== 'number' || !isFinite(quota)) return false;
  if (!terreno.quote || !Array.isArray(terreno.avute) || !terreno.avute.length) return false;

  const dati = terrenoMonta(terreno.quote, terreno.avute, quota);
  terreno.quota = dati.quota;
  // Non è più una stima da completare: è una misura, presa dalla superficie
  // dell'acqua. Lasciarla «stimata» vorrebbe dire che `terrenoDaCompletare`
  // continua a mandare una richiesta ogni volta per riscrivere il numero
  // che abbiamo appena corretto.
  terreno.quotaStimata = false;
  terreno.quotaAcqua = perche === 'acqua';
  terreno.profilo = terrenoInterpola(dati.creste);
  terreno.tipi = terrenoTipiPerGrado(dati.tipi);
  terreno.miscela = terrenoMiscelaPerGrado(terreno.tipi);
  terreno.fronti = dati.fronti;
  // `quando` è la chiave con cui vette e acque tengono da parte il loro
  // «da qui cosa si vede»: cambiando l'occhio quelle due risposte non valgono
  // più, e questo è il modo in cui l'app se lo dice già da prima.
  terreno.quando = Date.now();
  cime.vistaChiave = null;
  acque.vista = null;
  acque.vistaChiave = null;
  if (typeof skyAggiornaStato === 'function') skyAggiornaStato();
  if (typeof skyAggiornaLuogoVistaUI === 'function') skyAggiornaLuogoVistaUI();
  return true;
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

// C'è ancora qualcosa da chiedere, per questo profilo? Due cose lo rendono
// incompleto: delle direzioni stimate invece che misurate, e una quota di
// casa ricavata dai vicini perché la sua richiesta non era arrivata.
function terrenoDaCompletare(v) {
  if (!v) return false;
  const misurate = typeof v.misurate === 'number' ? v.misurate : TERRENO_DIREZIONI;
  return misurate < TERRENO_DIREZIONI || !!v.quotaStimata;
}

// Quello che si sa già di questo posto, pronto da passare a
// `terrenoCostruisci` perché non lo richieda. Se il salvataggio è intero non
// serve a niente (non c'è niente da riprendere) e se è di prima della lista
// `avute` non si sa quali direzioni siano vere: in tutt'e due i casi si
// risponde `null` e si riparte come si è sempre fatto.
function terrenoDaRiprendere(v) {
  if (!v || !terrenoDaCompletare(v)) return null;
  if (!Array.isArray(v.avute) || !Array.isArray(v.quote)) return null;
  if (v.quote.length !== TERRENO_DIREZIONI * TERRENO_DISTANZE.length) return null;
  return { quote: v.quote, avute: v.avute, quota: v.quota, quotaStimata: !!v.quotaStimata };
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
      // Un profilo salvato a metà — l'ultima volta la rete non ha retto — si
      // completa in sottofondo, una volta per sessione. Intanto quello che
      // c'è si disegna: nessuno resta a guardare l'orizzonte finto per un
      // pomeriggio andato storto la settimana scorsa.
      const qui = `${lat.toFixed(2)},${lon.toFixed(2)}`;
      if (terrenoDaCompletare(salvato) && terreno.completatoPer !== qui) {
        terreno.completatoPer = qui;
        setTimeout(() => terrenoCarica(true), 4000);
      }
      return Promise.resolve(true);
    }
  }

  // Una sveglia in giro per un tentativo di prima non serve più: o è per
  // questo stesso posto (e stiamo già partendo), o è per un altro (e allora
  // non la vogliamo proprio). E il conto dei tentativi riparte da zero
  // quando cambia il posto: il servizio che ha detto di no per Bolzano non
  // ha detto niente su Genova.
  if (terreno.sveglia) { clearTimeout(terreno.sveglia); terreno.sveglia = null; }
  if (terreno.provatoLat === null || terreno.provatoLat === undefined ||
      terrenoDistanzaKm(lat, lon, terreno.provatoLat, terreno.provatoLon) > TERRENO_RAGGIO_VALIDO_KM) {
    terreno.tentativi = 0;
    // Posto nuovo, domanda nuova: qui non ci si è ancora arresi, e chi
    // aspetta il terreno prima di parlare ha ragione ad aspettare.
    terreno.arreso = false;
  }
  terreno.provatoLat = lat;
  terreno.provatoLon = lon;

  // Il profilo che c'è in mano resta buono finché si sta parlando dello
  // stesso posto: chi affina, chi completa un salvataggio a metà e chi
  // riprova dopo un guaio sta rifacendo *questo* orizzonte, e cancellarlo
  // per il tempo dello scarico vuol dire mostrare l'orizzonte finto in
  // mezzo a quello vero. Da un'altra parte invece va buttato subito: le
  // colline di Genova disegnate a Bolzano sono peggio di nessuna collina,
  // perché sembrano vere.
  if (terreno.profilo && (terreno.lat === null ||
      terrenoDistanzaKm(lat, lon, terreno.lat, terreno.lon) > TERRENO_RAGGIO_VALIDO_KM)) {
    terrenoScordaProfilo();
  }

  terreno.stato = 'in-corso';
  terreno.motivo = '';
  terreno.avanzamento = 0;
  terrenoAggiornaPannello();

  // Quello che di questo posto si sa già, da un tentativo di prima lasciato a
  // metà: non si richiede. E quante direzioni erano, che serve dopo per
  // sapere se questo tentativo ha guadagnato qualcosa o ha girato a vuoto.
  const riprendi = terrenoDaRiprendere(terrenoLeggiSalvato(lat, lon));
  const primaSapeva = riprendi ? riprendi.avute.length : 0;

  terreno.promessa = terrenoCostruisci(lat, lon,
    // Il giro grosso: si disegna subito, **e si salva subito**. Salvare solo
    // alla fine voleva dire che un tentativo interrotto a metà non lasciava
    // niente, e quello dopo ricominciava da zero — cioè che con un servizio
    // che dice di no un giorno sì e uno no il terreno non arrivava mai.
    dati => {
      terrenoSalva(lat, lon, dati);
      terrenoApplica(lat, lon, dati, 'rete', true);
    }, riprendi)
    .then(({ dati, guaio }) => {
      terrenoSalva(lat, lon, dati);
      terrenoApplica(lat, lon, dati, 'rete');
      // Andata a metà: il terreno c'è e si disegna, ma qualche direzione è
      // stimata invece che misurata. Vale la pena riprovare più tardi a
      // completarla — non subito, che il servizio ha appena detto di no.
      if (guaio || terrenoDaCompletare(dati)) {
        if (guaio) console.warn('Terreno: qualche direzione non è arrivata', guaio);
        // Il conto dei tentativi riparte **solo se si è guadagnato terreno**.
        // Azzerarlo comunque, com'era prima, voleva dire riprovare ogni venti
        // secondi per sempre quando le stesse direzioni non arrivavano mai;
        // non azzerarlo mai vorrebbe dire arrendersi a tre direzioni dalla
        // fine. La regola giusta è la terza: chi avanza ha diritto a un'altra
        // occasione, chi gira a vuoto scala la scaletta delle attese.
        if (dati.misurate > primaSapeva) terreno.tentativi = 0;
        terrenoRiprovaPiuTardi();
      } else {
        terreno.tentativi = 0;
      }
      return true;
    })
    .catch(e => {
      // Senza rete resta il profilo inventato, che è esattamente com'era
      // prima: l'app non deve accorgersi di niente. Ma **si dice perché**:
      // «non sono riuscito» e basta non permette a nessuno di capire se
      // aspettare, riprovare o smettere.
      console.warn('Terreno vero non disponibile:', e);
      terreno.stato = 'fallito';
      // Da adesso in poi le riprese automatiche sono un di più, non
      // un'attesa: chi ha bisogno di sapere se aspettare (i nomi delle
      // montagne) ha già la sua risposta, ed è «no».
      terreno.arreso = true;
      terreno.motivo = terrenoMotivoGuaio(e);
      terrenoRiprovaPiuTardi();
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

// Avvia il paesaggio senza mettere quattro scaricamenti sulla strada del
// primo fotogramma. Le copie sul dispositivo vengono applicate subito (è
// lavoro sincrono e costa pochissimo); soltanto ciò che manca viene chiesto
// quando il browser ha avuto modo di disegnare. Chiamarla più volte durante
// l'avvio non crea altre sveglie: l'ultima posizione scelta vince.
//
// **Le quote e OpenStreetMap non si aspettano**, e questa è la riga che vale
// tutta la funzione. Le tre richieste a Overpass — i paesi, le vette, le
// acque — erano appese alla promessa di `terrenoCarica`, cioè partivano solo
// quando *tutte* le ventiquattro richieste delle quote avevano finito, bene o
// male. Con Open-Meteo che risponde 429 quelle ventiquattro diventano fino a
// centoventi tentativi passati per un rubinetto che frena a ogni no: minuti.
// E in quei minuti non compariva **nessun nome** sull'orizzonte, né di paese
// né di montagna — non perché OpenStreetMap avesse qualcosa che non andava,
// ma perché non gli si era ancora chiesto niente. È il difetto peggiore di
// tutti, quello in cui il sintomo (i nomi mancano) e la causa (il servizio
// delle *quote* è carico) non hanno niente a che vedere l'uno con l'altro, e
// dalla console si vedono solo dei 429 che parlano di un altro host.
//
// Sono due servizi diversi, su host diversi, con rubinetti diversi
// (`terrenoInFila` e `overpassInFila`): l'unica ragione per metterli in fila
// indiana sarebbe la banda del primo fotogramma, e a quella basta l'attesa
// del `requestIdleCallback`. Il rilievo invece la griglia grossa la vuole per
// davvero — gli serve per lo sfondo oltre il raggio delle tessere — ma non ha
// bisogno di aspettarla qui: `rilCarica` esce da sé finché
// `terrenoDisponibile()` dice di no, e `rilControlla` lo richiama a ogni
// fotogramma appena il terreno c'è.
let terrenoPaesaggioTurno = 0;
function terrenoCaricaPaesaggio() {
  const turno = ++terrenoPaesaggioTurno;
  const principale = terrenoCarica();

  // Prima la cache locale: tornando in un posto già visto luci, vette e acqua
  // compaiono nello stesso fotogramma, senza aspettare il periodo di riposo.
  if (typeof cittaCarica === 'function') cittaCarica(false, true);
  if (typeof cimeCarica === 'function') cimeCarica(false, true);
  if (typeof acqueCarica === 'function') acqueCarica(false, true);

  const completa = () => {
    if (turno !== terrenoPaesaggioTurno) return;
    if (typeof cittaCarica === 'function') cittaCarica();
    if (typeof cimeCarica === 'function') cimeCarica();
    if (typeof acqueCarica === 'function') acqueCarica();
    if (typeof rilCarica === 'function') rilCarica();
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(completa, { timeout: 1800 });
  } else {
    setTimeout(completa, 250);
  }
  return principale;
}

// Perché non ce l'ha fatta, detto a chi guarda.
//
// Il messaggio di prima era sempre lo stesso — «non sono riuscito a
// scaricare la forma del terreno» — e non distingueva il caso «sei senza
// rete» da «il servizio è sovraccarico, fra un minuto va» da «c'è un errore
// nella richiesta». Sono tre cose che chiedono tre comportamenti diversi, e
// chi legge non poteva sapere quale delle tre stesse capitando.
function terrenoMotivoGuaio(e) {
  // Arrivare qui vuol dire che le fonti sono state provate **tutte**: chi
  // fallisce gira alla successiva (§4). Dirlo cambia la risposta di chi
  // legge — «il servizio è carico» fa pensare di riprovare fra un minuto,
  // «sono carichi tutti e tre» dice che quasi sempre il problema è di qua:
  // la rete del telefono, il wi-fi dell'albergo, il portale che aspetta che
  // si accettino le condizioni.
  const tutte = TERRENO_FONTI.length > 1;
  let che;
  if (e && e.stato === 429) {
    che = tutte
      ? 'i servizi delle quote sono tutti sovraccarichi (429)'
      : 'il servizio delle quote è sovraccarico (429)';
  } else if (e && typeof e.stato === 'number') {
    che = `il servizio delle quote ha risposto ${e.stato}`;
  } else if (e && e.name === 'AbortError') {
    che = 'il servizio delle quote non ha risposto in tempo';
  } else {
    che = 'non c\'è rete, o i servizi delle quote non rispondono';
  }
  // Cosa resta intanto non è sempre la stessa cosa: se in mano c'è già un
  // profilo di questo posto — un giro grosso arrivato, un salvataggio da
  // completare — quello resta al suo posto e l'orizzonte è vero lo stesso.
  // Dire «resta l'orizzonte disegnato» mentre sullo schermo ci sono le
  // colline vere è il genere di riga che fa dubitare di tutto il resto.
  const resta = terreno.profilo
    ? 'intanto resta l\'orizzonte che ho già, un po\' meno fine.'
    : 'intanto resta l\'orizzonte disegnato.';
  return `Non sono riuscito a prendere la forma del terreno: ${che}. ` +
    `Riprovo da solo fra poco; ${resta}`;
}

// Quando riprovare da soli, dopo un buco nell'acqua. Sempre più distanti:
// venti secondi coprono il singhiozzo di rete, un minuto e mezzo il servizio
// momentaneamente carico, cinque minuti il tunnel o l'ascensore, un quarto
// d'ora e mezz'ora la giornata storta di un servizio pubblico. Poi si smette
// — riprovare all'infinito su un servizio che dice di no è il modo di farsi
// bloccare sul serio — e resta il tasto nel pannello.
//
// Erano tre e adesso sono cinque, e non è insistenza in più: adesso ogni
// tentativo chiede **solo quello che manca** e quello che porta a casa resta
// salvato, quindi cinque tentativi sono cinque morsi allo stesso buco e non
// cinque volte la stessa raffica. Un tentativo che guadagna direzioni
// riazzera per giunta il conto (vedi `terrenoCarica`): finché si avanza si
// continua, ed è così che il terreno arriva anche nelle serate in cui il
// servizio risponde una volta su tre.
const TERRENO_RIPROVE_MS = [20000, 90000, 300000, 900000, 1800000];

function terrenoRiprovaPiuTardi() {
  const n = terreno.tentativi || 0;
  if (n >= TERRENO_RIPROVE_MS.length) return;
  terreno.tentativi = n + 1;
  if (terreno.sveglia) clearTimeout(terreno.sveglia);
  terreno.sveglia = setTimeout(() => {
    terreno.sveglia = null;
    terrenoCarica(true);
  }, TERRENO_RIPROVE_MS[n]);
}


// =====================================================================
// 8. QUELLO CHE SERVE AL PLANETARIO
//     Una funzione sola, e la chiama `skyAltezzaOrizzonte`: quanto è alta
//     la cresta in quella direzione, o `null` se il terreno vero non c'è
//     e vale ancora il profilo inventato.
// =====================================================================

function terrenoAltezza(az) {
  if (!terrenoDisponibile()) return null;
  // Il rilievo, quando c'è, è **la stessa superficie che si vede**: mezzo
  // grado di passo invece di tre, e la cresta è il massimo della camminata
  // che l'ha disegnata. Preferirla non è un'ottimizzazione, è un vincolo —
  // se la cresta che decide se un astro è sorto non fosse quella disegnata,
  // le due divergerebbero proprio sui denti, cioè dove si appendono i nomi
  // delle montagne (la stessa lezione di `terrenoMonta`).
  if (typeof rilAltezza === 'function') {
    const v = rilAltezza(az);
    if (v !== null) return v;
  }
  const x = (((az % 360) + 360) % 360);
  const i = Math.floor(x);
  const t = x - i;
  return terreno.profilo[i] + (terreno.profilo[i + 1] - terreno.profilo[i]) * t;
}

// C'è un terreno vero da usare? La domanda è **se il profilo c'è**, non se
// una richiesta sia finita: sono due cose diverse, e confonderle è costato
// il guasto più fastidioso di questo modulo.
//
// Prima qui c'era `stato === 'pronto'`, e il risultato era un orizzonte a
// singhiozzo. Lo stato torna a «in-corso» tre volte nella vita normale di un
// posto — dopo il giro grosso (che il profilo ce l'ha già, ed è il momento
// in cui si dovrebbe cominciare a disegnarlo), quando un salvataggio
// parziale si completa da solo quattro secondi dopo l'apertura, e a ogni
// tentativo automatico dopo un buco nell'acqua — e ogni volta l'app perdeva
// per una decina di secondi un profilo che aveva già in mano: l'orizzonte
// tornava quello finto e i nomi delle montagne, che senza terreno non hanno
// niente che li nasconda, si riaccendevano tutti insieme per poi sparire di
// nuovo alla fine dello scarico. Il profilo vecchio, finché parla del posto
// in cui siamo, è la risposta migliore che abbiamo: si tiene fino a quando
// non arriva quella nuova, e a buttarlo è solo un cambio di luogo
// (`terrenoScordaProfilo`, chiamata da `terrenoCarica`).
function terrenoDisponibile() {
  return terreno.acceso && !!terreno.profilo;
}

// C'è un terreno che sta arrivando e ancora niente da mostrare. Vale solo
// per la primissima attesa di un posto: dopo il giro grosso il profilo c'è
// e `terrenoDisponibile` risponde di sì. Serve a chi, come i nomi delle
// montagne, preferisce aspettare un secondo piuttosto che dare una risposta
// che dovrà rimangiarsi.
//
// **La primissima**, e non ogni tentativo. È la seconda metà del singhiozzo,
// e si vedeva solo quando le quote non arrivavano affatto: il primo
// tentativo fallisce, lo stato passa a «fallito», `cimeVisibili` torna a
// nominare quello che spunta — è la risposta giusta, quella di sempre — e
// venti secondi dopo la ripresa automatica rimette lo stato a «in-corso»
// e i nomi spariscono di nuovo. Poi novanta secondi, poi cinque minuti,
// poi un quarto d'ora: per quasi un'ora i nomi delle montagne comparivano
// e sparivano da soli, che è il modo in cui questo difetto è arrivato
// come «non riesco a visualizzarli». Aspettare in silenzio ha senso finché
// non si sa ancora niente; quando si sa già che qui il terreno non arriva,
// aspettare di nuovo non è prudenza, è cancellare una risposta buona.
function terrenoInArrivo() {
  return terreno.acceso && terreno.stato === 'in-corso' &&
    !terreno.profilo && !terreno.arreso;
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
  if (typeof rilFronteA === 'function') {
    const v = rilFronteA(az, k);
    if (v !== null) return v;
  }
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
  if (typeof rilFrontiA === 'function') {
    const v = rilFrontiA(az, fuori);
    if (v !== null) return v;
  }
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
  // Riaccendendolo si riprova **subito**, e si azzera il conto dei tentativi
  // automatici: quelli sono la cortesia verso un servizio che ha detto di
  // no, ma un tasto premuto è una richiesta esplicita di chi sta lì a
  // guardare — ed è anche il solo modo che ha per riprovare quando i tre
  // tentativi da soli sono finiti. Stessa regola dei nomi delle montagne.
  if (terreno.acceso && terreno.stato !== 'pronto') {
    if (terreno.stato === 'fallito') terreno.tentativi = 0;
    terrenoCarica(terreno.stato === 'fallito');
  }
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
  if (!terreno.acceso) return 'Terreno nascosto.';
  if (terreno.stato === 'in-corso') {
    // Ventiquattro richieste sono qualche secondo, e qualche secondo senza
    // niente da leggere sembrano un guasto. La percentuale non serve a chi
    // sa cosa sta succedendo: serve a chi non lo sa.
    const q = terreno.avanzamento > 0 && terreno.avanzamento < 1
      ? ` (${Math.round(terreno.avanzamento * 100)}%)` : '';
    // Se si sta parlando con la seconda o la terza fonte, va detto: vuol dire
    // che la prima era satura, e la riga di stato è l'unico posto in cui uno
    // può accorgersi che l'app se l'è cavata da sola invece di essere ferma.
    const dove = terrenoFonteOra > 0 ? ` (via ${terrenoFonte().nome})` : '';
    // Dopo il giro grosso l'orizzonte disegnato è già quello vero: va detto,
    // se no chi guarda crede che quello che vede sia ancora la finzione.
    if (terreno.profilo) return `L'orizzonte qui sopra è già quello vero: lo sto affinando${q}${dove}…`;
    return `Sto misurando com'è fatto il terreno attorno a te${q}${dove}…`;
  }
  if (terreno.stato === 'fallito') return terreno.motivo;

  const r = terrenoRiassunto();
  if (!r) return 'Apri il planetario da un posto con la rete e prendo la forma vera del terreno qui attorno.';

  const quota = typeof r.quota === 'number' ? `Sei a ${Math.round(r.quota)} m. ` : '';
  // Quando manca qualche direzione lo si dice, ma in coda e senza allarme:
  // il terreno c'è ed è quello vero, solo un po' meno fine da qualche parte.
  const meta = terreno.misurate && terreno.misurate < TERRENO_DIREZIONI
    ? ` (${TERRENO_DIREZIONI - terreno.misurate} direzioni su ${TERRENO_DIREZIONI} sono stimate: la rete non le ha portate tutte, ` +
      'e le chiedo ancora ogni tanto finché non arrivano)'
    : '';

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
    return quota + paesaggio + 'L\'orizzonte è libero in tutte le direzioni: non c\'è niente che copra.' + meta;
  }
  const cosa = r.tipoPiuAlto && r.tipoPiuAlto !== 'pianura' && r.tipoPiuAlto !== 'mare'
    ? ` (${r.tipoPiuAlto === 'montagna' ? 'la montagna' : 'la collina'})` : '';
  return quota + paesaggio +
    `Il punto più alto è a ${r.alto.toFixed(1)}° verso ${r.direzione}${cosa}. ` +
    (r.basso < 0.35
      ? 'Da qualche parte l\'orizzonte è invece completamente libero.'
      : `Il più basso è a ${r.basso.toFixed(1)}°.`) + meta;
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
    const ril = typeof rilTesto === 'function' ? rilTesto() : '';
    nota.textContent = [terrenoTesto(), ril, cittaTesto(), cimeTesto(), acqueTesto()]
      .map(t => (t || '').trim()).filter(Boolean).join(' ');
  }
  cittaAggiornaTasto();
  cimeAggiornaTasto();
  acqueAggiornaTasto();
  if (typeof rilAggiornaTasto === 'function') rilAggiornaTasto();
  terrenoBarraAggiorna();
}


// =====================================================================
// 9-ter. LA BARRA CHE DICE A CHE PUNTO È
//
//     La riga di stato del pannello (§9) dice tutto, ma sta **dentro a un
//     pannello**, e il pannello all'apertura è chiuso: chi apre il
//     planetario e vede l'orizzonte finto per otto secondi non ha nessun
//     posto in cui guardare per sapere che sta arrivando quello vero. La
//     percentuale c'era già ed era scritta dove non la leggeva nessuno.
//
//     Quindi una barra appoggiata sopra al cielo, che si accende quando lo
//     scarico comincia e si spegne quando è finito — scarico **e**
//     tracciamento dei raggi, che sono due cose diverse e la seconda non è
//     una richiesta di rete.
//
//     Le quattro fasi non pesano uguale, e non è un'opinione: le quote sono
//     ventiquattro richieste a un servizio che ogni tanto dice di no, i tre
//     giri a OpenStreetMap sono uno ciascuno. Dando a tutte lo stesso peso la
//     barra faceva tre quarti di strada nel primo secondo e poi stava ferma,
//     che è il modo in cui una barra di caricamento smette di essere creduta.
// =====================================================================

const TERRENO_FASI = [
  { chiave: 'quote', peso: 0.34, che: 'la forma del terreno',
    stato: () => terreno.stato, quanto: () => terreno.avanzamento },
  { chiave: 'citta', peso: 0.07, che: 'le luci dei paesi',
    stato: () => citta.stato, quanto: () => citta.avanzamento },
  { chiave: 'cime', peso: 0.07, che: 'i nomi delle montagne',
    stato: () => cime.stato, quanto: () => cime.avanzamento },
  { chiave: 'acque', peso: 0.18, che: 'i laghi e i fiumi',
    stato: () => acque.stato, quanto: () => acque.avanzamento },
  // Il rilievo (`rilievo.js`). Pesa quanto le quote a punti, e non è
  // generosità: sono da quattro a sei tessere da un centinaio di kilobyte
  // l'una, cioè il grosso di quello che si scarica per un luogo nuovo. Il
  // `typeof` c'è perché questo file può non esserci — chi lo toglie
  // dall'`index.html` deve ritrovare l'app di prima, barra compresa.
  { chiave: 'rilievo', peso: 0.34, che: 'il rilievo del terreno',
    stato: () => (typeof rilievo === 'undefined' ? 'spento' : rilievo.stato),
    quanto: () => (typeof rilievo === 'undefined' ? 0 : rilievo.avanzamento) }
];

// Quanto resta a schermo dopo il cento per cento. Sparire nell'istante in cui
// finisce vuol dire che chi ha guardato per un attimo non ha visto niente
// arrivare in fondo, e una barra che scompare a metà sembra un errore.
const TERRENO_BARRA_CODA_MS = 700;

const terrenoBarra = {
  // Le fasi che in questa sessione di scarico hanno davvero girato. Serve a
  // non contare quelle che non partiranno affatto: le vette spente, un
  // profilo che era già in `localStorage`, le acque servite dal salvato.
  // Contandole comunque la barra si fermava al quaranta per cento e ci
  // restava, che è peggio di non averla.
  fasi: new Set(),
  spegni: null,
  vista: false
};

// A che punto è tutto quanto, e cosa si sta aspettando adesso.
function terrenoAvanzamentoTotale() {
  let peso = 0, fatto = 0, corre = false;
  const che = [];
  for (const f of TERRENO_FASI) {
    const stato = f.stato();
    if (stato === 'in-corso') terrenoBarra.fasi.add(f.chiave);
    if (!terrenoBarra.fasi.has(f.chiave)) continue;
    peso += f.peso;
    if (stato === 'in-corso') {
      const q = f.quanto();
      fatto += f.peso * Math.max(0, Math.min(1, typeof q === 'number' ? q : 0));
      corre = true;
      che.push(f.che);
    } else {
      // Finita, riuscita o no: quello che c'era da aspettare non c'è più.
      fatto += f.peso;
    }
  }
  return { frazione: peso > 0 ? fatto / peso : 0, corre, che, attiva: peso > 0 };
}

function terrenoBarraAggiorna() {
  const el = document.getElementById('terreno-progress');
  if (!el) return;
  const v = terrenoAvanzamentoTotale();
  if (!v.attiva) return;

  const per = Math.round(v.frazione * 100);
  const barra = el.querySelector('[data-barra-terreno]');
  const testo = el.querySelector('[data-testo-terreno]');
  if (barra) barra.style.width = `${per}%`;
  if (testo) {
    // Cosa si sta aspettando, non «caricamento»: sono quattro cose diverse e
    // sapere quale è in ritardo è metà della risposta quando una non arriva.
    testo.textContent = v.corre
      ? `Sto misurando ${terrenoElencoAParole(v.che)}… ${per}%`
      : 'Il terreno attorno a te è pronto.';
  }
  el.setAttribute('aria-valuenow', String(per));

  if (v.corre) {
    if (terrenoBarra.spegni) { clearTimeout(terrenoBarra.spegni); terrenoBarra.spegni = null; }
    if (!terrenoBarra.vista) {
      terrenoBarra.vista = true;
      el.classList.remove('hidden');
      el.classList.remove('barra-terreno-via');
    }
  } else if (terrenoBarra.vista && !terrenoBarra.spegni) {
    // Il cento per cento si fa vedere, poi la barra se ne va. Le fasi si
    // scordano qui e non prima: se se ne scordasse subito, il primo giro di
    // pannello dopo la fine le riaggiungerebbe e la barra tornerebbe.
    terrenoBarra.spegni = setTimeout(() => {
      terrenoBarra.spegni = null;
      terrenoBarra.vista = false;
      terrenoBarra.fasi.clear();
      el.classList.add('barra-terreno-via');
      el.classList.add('hidden');
    }, TERRENO_BARRA_CODA_MS);
  }
}

// «le quote», «le quote e i laghi», «le quote, i paesi e i laghi».
function terrenoElencoAParole(v) {
  if (!v || !v.length) return 'il terreno';
  if (v.length === 1) return v[0];
  return `${v.slice(0, -1).join(', ')} e ${v[v.length - 1]}`;
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
  citta: { min: 10, max: 150, passo: 5, predefinito: 90 },
  // Gli aerei arrivano da ADS-B e cambiano continuamente: un raggio più
  // largo è utile in pianura, uno stretto evita traffico lontano e richieste
  // inutilmente grandi quando interessa solo ciò che passa sopra casa.
  aerei: { min: 10, max: 250, passo: 5, predefinito: 100 },
  // I laghi e i fiumi si cercano molto più vicino, e non per prudenza: un
  // lago a cinquanta chilometri, visto da uno che sta in pianura, è sotto
  // l'orizzonte — e quando invece si vede (da una cima) è una riga di due
  // pixel. Venticinque chilometri sono il raggio in cui uno specchio
  // d'acqua è ancora una superficie.
  acque: { min: 5, max: 60, passo: 5, predefinito: 25 }
};

function raggiTosa(quale, km) {
  const l = RAGGI_LIMITI[quale];
  const v = Math.round(Number(km) / l.passo) * l.passo;
  return Math.max(l.min, Math.min(l.max, isFinite(v) ? v : l.predefinito));
}

function raggiLeggiSalvati() {
  const v = {
    cime: RAGGI_LIMITI.cime.predefinito,
    citta: RAGGI_LIMITI.citta.predefinito,
    acque: RAGGI_LIMITI.acque.predefinito,
    aerei: RAGGI_LIMITI.aerei.predefinito,
    // I nomi sono parte del panorama, quindi al primo avvio devono essere
    // visibili. Restano comunque indipendenti dalle etichette astronomiche
    // e chi non li desidera può spegnerli dal loro interruttore.
    nomiMonti: true,
    // I laghi e i fiumi nascono **accesi**, al contrario dei nomi dei
    // monti: non aggiungono scritte davanti al cielo, sono paesaggio come
    // le colline — e chi apre il planetario sul lago di Como vuole vedere
    // il lago di Como.
    acqueAccese: true,
    // Il rilievo (`rilievo.js`). Nasce **acceso**: è la forma vera del
    // terreno, cioè quello che questo modulo esiste per raccontare. Si
    // spegne per chi ha la rete a consumo — da quattro a sei tessere, una
    // volta sola per luogo — o per chi vuole l'orizzonte ridotto alla sua
    // sagoma.
    rilievo: true
  };
  try {
    const s = JSON.parse(localStorage.getItem(CHIAVE_RAGGI) || 'null');
    if (s && typeof s === 'object') {
      if (typeof s.cime === 'number') v.cime = raggiTosa('cime', s.cime);
      if (typeof s.citta === 'number') v.citta = raggiTosa('citta', s.citta);
      if (typeof s.acque === 'number') v.acque = raggiTosa('acque', s.acque);
      if (typeof s.aerei === 'number') v.aerei = raggiTosa('aerei', s.aerei);
      if (typeof s.acqueAccese === 'boolean') v.acqueAccese = s.acqueAccese;
      // Una scelta già salvata prevale sul valore iniziale: in questo modo
      // accenderli di default non riaccende le scritte a chi le ha spente
      // esplicitamente.
      if (typeof s.nomiMonti === 'boolean') v.nomiMonti = s.nomiMonti;
      if (typeof s.rilievo === 'boolean') v.rilievo = s.rilievo;
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
function raggioAerei() { return raggi.aerei; }

// Rileggere da capo quello che c'è in `localStorage`. Serve al ripristino
// di un backup, che in localStorage ci scrive direttamente: senza questa,
// l'oggetto in memoria resterebbe quello di prima e le due verità si
// contraddirebbero fino al ricaricamento della pagina.
function raggiRicarica() {
  Object.assign(raggi, raggiLeggiSalvati());
  cime.acceso = raggi.nomiMonti;
  acque.acceso = raggi.acqueAccese;
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
  } else if (quale === 'acque') {
    acqueDimentica();
    if (acque.acceso) acqueCarica(true);
  } else if (quale === 'citta') {
    cittaDimentica();
    if (citta.acceso) cittaCarica(true);
  } else if (typeof aereiRaggioCambiato === 'function') {
    aereiRaggioCambiato();
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
// Fin dove arriva la query di ripiego (`cittaQueryVicina`), quando quella
// larga non passa. Trenta chilometri sono il raggio in cui un paese la sua
// cupola di luce ce l'ha ancora, e una richiesta così corta la serve anche
// un'istanza che sta annaspando.
const CITTA_RAGGIO_RIPIEGO_KM = 30;
const CITTA_MAX = 60;
const CITTA_RAGGIO_VALIDO_KM = 5;
// Più lunga del `timeout` scritto nella query dei paesi (20 s), come per le
// vette e per le acque. Era **quindici** secondi, cioè cinque meno di quelli
// che il server si era preso: la richiesta veniva tagliata mentre Overpass ci
// stava ancora lavorando, e nel pannello finiva scritto che il colpevole era
// lui. Di tutte e tre le famiglie era l'unica a sbagliare il verso della
// disuguaglianza — ed è anche l'unica di cui l'utente si è accorto, perché è
// quella che porta i nomi dei paesi.
const CITTA_ATTESA_MS = 26000;
// Un buco nell'acqua non si ritenta a ogni respiro (stessa ragione delle
// vette): il servizio pubblico che risponde 429 lo fa perché lo stiamo
// chiamando troppo.
const CITTA_RIPROVA_DOPO_MS = 3 * 60 * 1000;

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
  avanzamento: 0,         // 0…1 per la barra della §9-ter
  // Quando e dove è andata male. Le vette ce li avevano da sempre, i paesi
  // no — e senza di loro non c'era modo né di distanziare i tentativi né di
  // riprovarne uno: la supplenza dei capoluoghi diventava definitiva.
  quandoFallito: 0,
  fallitoLat: null, fallitoLon: null,
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

// Il nodo di OpenStreetMap indica il centro dell'abitato, non un punto luce
// lontano. Se chi guarda si trova dentro quel centro, proiettarne il nome
// sull'orizzonte gli assegna una direzione casuale (a coordinate uguali
// `atan2(0, 0)` diventa nord) e racconta che il paese in cui si è è davanti a
// noi. Il raggio è la stessa stima già usata per la larghezza della cupola;
// il minimo copre anche i piccoli paesi, il cui nodo può stare a qualche
// centinaio di metri dalla casa dell'osservatore.
function cittaRaggioAbitatoKm(abitanti) {
  return 0.5 * Math.sqrt(Math.max(200, abitanti) / 10000);
}

// Il geocodificatore inverso sa anche **come si chiama** il punto da cui si
// guarda. È un'informazione più affidabile della distanza dal nodo OSM: quel
// nodo è il centro convenzionale del paese, e in un abitato lungo o sparso può
// stare a diversi chilometri da casa. In quel caso il solo raggio qui sopra
// faceva ricomparire il paese dell'osservatore sull'orizzonte, con un azimut
// privo di significato.
function cittaNomeConfrontabile(nome) {
  return String(nome || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cittaEPostoOsservatore(c, nomeLuogo) {
  const luogo = cittaNomeConfrontabile(nomeLuogo);
  return !!luogo && cittaNomeConfrontabile(c && c.nome) === luogo;
}

function cittaPrepara(grezze, lat, lon, nomeLuogo) {
  return grezze.map(c => {
    const km = terrenoDistanzaKm(lat, lon, c.lat, c.lon);
    if (cittaEPostoOsservatore(c, nomeLuogo) ||
        km <= Math.max(0.8, cittaRaggioAbitatoKm(c.abitanti))) return null;
    const az = cittaAzimut(lat, lon, c.lat, c.lon);
    const forza = cittaForza(c.abitanti, km);
    // Il raggio dell'abitato, in chilometri: una città di un milione di
    // abitanti è larga una decina di chilometri, un paese di duemila
    // qualche centinaio di metri. Da lì quanto la si vede larga.
    const raggioKm = cittaRaggioAbitatoKm(c.abitanti);
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
    .filter(c => c && c.km <= raggioCitta() + 5 && c.forza > 12)
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
//
// Le istanze sono cinque, e non è abbondanza: è la lezione della sera in cui
// dall'orizzonte sono spariti **tutti** i nomi insieme — paesi, vette e laghi
// — con in console due guasti che non si somigliavano per niente.
// `overpass-api.de` non rispondeva affatto (`ERR_CONNECTION_TIMED_OUT`: la
// connessione non si apriva nemmeno, quindi non era il servizio a essere
// carico, era la strada per arrivarci), e `overpass.kumi.systems` rispondeva
// **senza l'intestazione CORS**, che dal browser è un no secco anche quando i
// dati ci sarebbero. Due porte, tutt'e due chiuse, e l'app senza una terza a
// cui bussare.
//
// Con due sole istanze quella sera era un caso peggiore garantito; con cinque
// è un inconveniente. Sono tutte pubbliche, senza chiave, con il planeta
// intero e con `Access-Control-Allow-Origin: *` — che qui è la condizione
// necessaria, perché una pagina statica su GitHub Pages non ha un server
// proprio da mettere in mezzo. L'ordine è quello della probabilità di
// rispondere bene, ma conta poco: `overpassIstanzaOra` lo fa girare a ogni
// richiesta, e l'affiancamento qui sotto le mette in corsa una dopo l'altra
// senza aspettare che la precedente si arrenda.
const OVERPASS_ISTANZE = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter'
];

// Dopo quanto si prova **anche** l'altra istanza, invece di stare a guardare
// la prima.
//
// È la correzione che vale più di tutte, in questo pezzo, e nasce da un conto
// che nessuno aveva fatto: le istanze si provavano in fila indiana, ognuna con
// la sua sveglia da venti o trenta secondi, e in fondo alla fila c'era la
// query di ripiego che rifaceva **la stessa fila**. Le acque, che hanno
// l'attesa più lunga, potevano quindi costare 30 + 30 + 30 + 30 = **due
// minuti** prima di arrendersi — e con le vette in coda davanti a loro (vedi
// `acqueCarica`) si arrivava a tre e mezzo. Un'istanza di Overpass carica non
// risponde «carico»: **tace**, e tacere è il modo in cui consumava tutta la
// sveglia.
//
// Affiancare invece di aspettare cambia la forma del caso peggiore: dopo tre
// secondi e mezzo si prova anche la seconda porta, la prima resta in corsa, e
// quella che risponde per prima vince (l'altra si abortisce, che è il motivo
// per cui questo non è «chiedere due volte»: la seconda richiesta parte solo
// quando la prima ha già sforato di molto il tempo in cui una risposta buona
// arriva).
const OVERPASS_AFFIANCA_MS = 3500;

// Quante richieste a Overpass insieme, e quanto le distanzia.
//
// Le tre richieste (paesi, vette, acque) non vanno in fila indiana — era così,
// e le tre attese si sommavano — ma non vanno nemmeno tutte insieme nello
// stesso istante, che è come sono finite dopo il primo tentativo di
// parallelizzarle: è lo stesso servizio pubblico, e tre colpi contemporanei
// sono il modo più rapido per prendersi un «troppe richieste». Due per volta,
// distanziate di poco più di mezzo secondo: le tre partono dentro il primo
// secondo e mezzo e nessuna aspetta che l'altra finisca.
const OVERPASS_INSIEME = 2;
const OVERPASS_DISTANZA_MS = 600;

// Da quale istanza si comincia. Gira a ogni richiesta, così le due richieste
// che partono insieme non bussano alla stessa porta.
let overpassIstanzaOra = 0;

// Come si racconta un guasto di rete.
//
// «signal is aborted without reason» è il messaggio che il browser dà a una
// `fetch` interrotta da noi, e per un pezzo è finito **dritto nel pannello**
// del planetario: «Non ho i nomi delle montagne: signal is aborted without
// reason». Non è una frase, è un rumore — e per giunta dice la cosa meno
// utile fra quelle che sappiamo, perché l'abort è l'ultimo anello, non la
// causa. Qui si traduce, e la causa la si tiene da parte (`overpassPeso`).
function overpassMotivo(e) {
  if (!e) return 'OpenStreetMap non ha risposto';
  if (e.name === 'AbortError') return 'OpenStreetMap non ha risposto in tempo';
  const m = e.message || '';
  // `TypeError: Failed to fetch` è quello che il browser dice sia quando non
  // c'è rete, sia quando la risposta arriva senza intestazione CORS. Dal
  // codice le due non si distinguono, ma il consiglio è lo stesso.
  if (e.name === 'TypeError' || /failed to fetch|networkerror|load failed/i.test(m)) {
    return 'non riesco a raggiungere OpenStreetMap';
  }
  return m || 'OpenStreetMap non ha risposto';
}

// Quale dei guasti raccontare, quando falliscono tutti.
//
// L'ultimo che arriva non è il più informativo: quasi sempre è l'abort della
// scadenza, cioè la sveglia che abbiamo messo noi. Un «429» o un «504»
// dicono molto di più — quelli il servizio li ha *risposti*, quindi la strada
// c'era — e vanno preferiti.
function overpassPeso(e) {
  if (!e) return 0;
  if (e.name === 'AbortError') return 1;
  if (e.name === 'TypeError') return 2;
  return 3;
}

// Una richiesta, su tutte le istanze, con l'affiancamento.
//
// `attesaMs` è il tempo che ha **tutta** la corsa, non ogni singola porta, ed
// è la differenza che ha reso possibile allungare l'elenco delle istanze.
// Prima ogni tentativo si prendeva la sveglia intera: con due istanze e la
// query di ripiego dietro erano già 4 × 30 s nel caso peggiore, e passando a
// cinque porte sarebbero diventati **cinque minuti** di silenzio prima di
// dire «non ce l'ho fatta». Con una scadenza sola le porte in più non
// costano tempo: costano solo altre possibilità di essere serviti dentro
// quello stesso minuto.
function overpassChiedi(query, attesaMs) {
  const n = OVERPASS_ISTANZE.length;
  const inizio = overpassIstanzaOra;
  overpassIstanzaOra = (overpassIstanzaOra + 1) % n;
  const scadenza = Date.now() + attesaMs;

  return new Promise((ok, no) => {
    const controlli = [];
    let prossima = 0, attive = 0, chiuso = false, ultimo = null, sveglia = null, fine = null;

    const smetti = () => {
      chiuso = true;
      if (sveglia) { clearTimeout(sveglia); sveglia = null; }
      if (fine) { clearTimeout(fine); fine = null; }
      // Chi ha perso la corsa si abortisce: la sua risposta non serve più a
      // nessuno, e lasciarla scorrere vuol dire tenere occupata una macchina
      // pubblica per niente.
      controlli.forEach(c => { try { c.abort(); } catch (e) { /* già chiusa */ } });
    };

    const arrenditi = () => {
      if (chiuso) return;
      smetti();
      // Senza nemmeno un no da riferire, il guasto è il tempo finito: dirlo
      // così è più onesto che inventarsi un errore che nessuno ha dato.
      no(new Error(ultimo ? overpassMotivo(ultimo) : 'OpenStreetMap non ha risposto in tempo'));
    };

    const nonCeLHaFatta = e => {
      if (e && overpassPeso(e) >= overpassPeso(ultimo)) ultimo = e;
      attive--;
      if (chiuso) return;
      // C'è ancora una porta da provare, e c'è ancora tempo: si prova subito,
      // senza aspettare l'affiancamento.
      if (prossima < n && Date.now() < scadenza) { parti(); return; }
      if (attive <= 0) arrenditi();
    };

    const parti = () => {
      if (chiuso || prossima >= n) return;
      const resta = scadenza - Date.now();
      if (resta <= 0) { if (attive <= 0) arrenditi(); return; }
      const istanza = OVERPASS_ISTANZE[(inizio + prossima) % n];
      prossima++;
      attive++;
      const c = typeof AbortController === 'function' ? new AbortController() : null;
      if (c) controlli.push(c);
      // Ogni tentativo muore alla scadenza comune, non dopo un'attesa sua: la
      // regola che conta resta quella di sempre — il client non deve
      // arrendersi prima del `timeout` scritto nella query, se no si taglia la
      // richiesta mentre il server la sta ancora onorando e il colpevole
      // sembra lui — ed è rispettata perché `attesaMs` quel timeout lo supera
      // già per tutt'e tre le famiglie.
      const timer = c ? setTimeout(() => c.abort(), resta) : null;
      // GET è intenzionale. Il POST, pur essendo formalmente una richiesta
      // CORS semplice, viene rifiutato da alcuni proxy davanti alle istanze
      // pubbliche con un 500 privo di header CORS: dal browser sembra quindi
      // un errore CORS e spariscono insieme paesi, cime e acque. Le query qui
      // sono tenute corte e hanno un limite esplicito, perciò entrano senza
      // problemi nell'URL e conservano il percorso che le istanze espongono
      // davvero alle pagine statiche come GitHub Pages.
      fetch(istanza + '?data=' + encodeURIComponent(query), c ? { signal: c.signal } : undefined)
        .then(risposta => {
          if (!risposta.ok) throw new Error('OpenStreetMap non risponde (' + risposta.status + ')');
          return risposta.json();
        })
        .then(dati => {
          if (timer) clearTimeout(timer);
          if (!dati || !Array.isArray(dati.elements)) throw new Error('risposta senza elementi');
          if (chiuso) return;
          attive--;
          smetti();
          ok(dati.elements);
        })
        .catch(e => {
          if (timer) clearTimeout(timer);
          nonCeLHaFatta(e);
        });

      // Se fra un po' questa non ha ancora risposto, si prova anche la
      // prossima invece di stare a guardare.
      if (prossima < n) {
        if (sveglia) clearTimeout(sveglia);
        sveglia = setTimeout(() => { sveglia = null; parti(); }, OVERPASS_AFFIANCA_MS);
      }
    };

    // La rete di sicurezza: senza `AbortController` nessun tentativo si
    // interrompe da sé, e una porta che tace terrebbe la promessa appesa per
    // sempre — cioè lo stato «sto cercando» che non diventa mai «non ci sono
    // riuscito», che è il modo peggiore di fallire perché non sembra un
    // errore.
    fine = setTimeout(() => { fine = null; arrenditi(); }, attesaMs);

    parti();
  });
}

// --- Il rubinetto di Overpass -----------------------------------------
//
// Stessa forma di quello delle quote (§4), e per la stessa ragione: è l'unico
// posto che sa quante richieste stanno andando verso quel servizio adesso.
// Qui però il ritmo è fisso e non impara — Overpass non manda un `retry-after`
// e le richieste sono tre, non ventiquattro: non c'è niente da tarare.
const overpassCoda = [];
let overpassInVolo = 0;
let overpassTimer = null;
let overpassLiberoDa = 0;

function overpassInFila(compito) {
  return new Promise((ok, no) => {
    overpassCoda.push({ compito, ok, no });
    overpassRubinetto();
  });
}

function overpassRubinetto() {
  if (overpassTimer) return;
  while (overpassCoda.length && overpassInVolo < OVERPASS_INSIEME) {
    const aspetta = overpassLiberoDa - Date.now();
    if (aspetta > 0) {
      overpassTimer = setTimeout(() => { overpassTimer = null; overpassRubinetto(); }, aspetta);
      return;
    }
    const v = overpassCoda.shift();
    overpassInVolo++;
    overpassLiberoDa = Date.now() + OVERPASS_DISTANZA_MS;
    Promise.resolve().then(v.compito).then(v.ok, v.no)
      .then(() => { overpassInVolo--; overpassRubinetto(); });
  }
}

// Una richiesta con la sua query di ripiego, letta e consegnata già pronta.
//
// Il `leggi` sta **fuori** dal turno del rubinetto: interpretare la risposta è
// lavoro nostro, non del servizio, e tenere occupato uno dei due posti mentre
// si contano i vertici di un lago vuol dire far aspettare la richiesta dopo per
// niente.
async function overpassConRipiego(query, leggi, ripiego, attesaMs) {
  try {
    return leggi(await overpassInFila(() => overpassChiedi(query, attesaMs)));
  } catch (e) {
    if (!ripiego) throw e;
    console.warn('Overpass: la richiesta larga non è passata, riprovo con quella corta —', e.message);
    const esito = leggi(await overpassInFila(() => overpassChiedi(ripiego, attesaMs)));
    // Chi riceve deve sapere che questa risposta è **più corta** di quella che
    // aveva chiesto, se no la salva col raggio grande e da domani se la tiene
    // per buona: `raggiSalvatoBuono` guarda quel numero, e un elenco preso a
    // trenta chilometri spacciato per novanta è il modo di non riscaricare
    // mai più quello vero.
    if (esito && typeof esito === 'object') esito.daRipiego = true;
    return esito;
  }
}


// --- Riprovare da soli ------------------------------------------------
//
// «Si riprova da sé fra qualche minuto» era scritto nel messaggio delle
// vette, e non era vero. A rimettere in moto le tre richieste era soltanto un
// nuovo giro di `terrenoCaricaPaesaggio`, cioè un cambio di luogo o una
// riapertura della vista: chi apriva il planetario nel minuto sbagliato —
// e il minuto sbagliato capita eccome, perché Overpass è pubblico e la sera
// è quando lo usano tutti — restava senza un nome sull'orizzonte finché non
// ricaricava la pagina a mano. È il difetto che non si vede leggendo il
// codice, perché la frase giusta c'era: mancava solo chi la mantenesse.
//
// La scala dei tentativi è quella delle quote (§7): pochi, sempre più
// distanti, e poi basta. Insistere ogni minuto su un servizio che risponde
// 429 è il modo migliore per continuare a prendere 429.
const OVERPASS_RIPROVE_MS = [45000, 240000, 900000];
const overpassRiprove = {};

function overpassRiprovaPiuTardi(chi, lat, lon, cosa) {
  // I tentativi si contano **per posto**: chi si sposta sta facendo una
  // domanda nuova, e ha diritto alla scala intera anche se qui la aveva già
  // esaurita. È la stessa regola dell'attesa dopo un guasto (`fallitoLat`).
  const dove = lat.toFixed(2) + ',' + lon.toFixed(2);
  let v = overpassRiprove[chi];
  if (!v || v.dove !== dove) {
    if (v && v.sveglia) clearTimeout(v.sveglia);
    v = overpassRiprove[chi] = { n: 0, sveglia: null, dove };
  }
  if (v.sveglia || v.n >= OVERPASS_RIPROVE_MS.length) return;
  const attesa = OVERPASS_RIPROVE_MS[v.n++];
  v.sveglia = setTimeout(() => { v.sveglia = null; cosa(); }, attesa);
}

// Il conto riparte da zero anche quando ce l'abbiamo fatta, o quando il raggio
// cambia: sono due domande nuove come lo è un altro posto.
function overpassRiprovaAzzera(chi) {
  const v = overpassRiprove[chi];
  if (v && v.sveglia) clearTimeout(v.sveglia);
  overpassRiprove[chi] = { n: 0, sveglia: null, dove: '' };
}


function cittaLeggiNodi(elementi) {
  return elementi
    .filter(n => n && n.tags && n.tags.name && typeof n.lat === 'number' && n.tags.place)
    .map(n => {
      // La popolazione, quando c'è, arriva come stringa e ogni tanto con i
      // punti delle migliaia dentro
      const grezza = parseInt(String(n.tags.population || '').replace(/[^\d]/g, ''), 10);
      return {
        nome: n.tags.name,
        lat: n.lat, lon: n.lon,
        abitanti: isFinite(grezza) && grezza > 0 ? grezza : (CITTA_ABITANTI[n.tags.place] || 3000)
      };
    });
}

// Il ripiego: le sole città e i soli paesi, senza frazioni e senza quartieri,
// dentro a un raggio più corto.
//
// È lo stesso mestiere di `cimeQueryVicina`, e per un pezzo qui non c'era: la
// richiesta dei paesi era l'unica delle tre a non averne uno, quindi un 504 —
// che su Overpass vuol dire «adesso non ce la faccio», non «non ho i dati» —
// mandava direttamente all'elenco dei capoluoghi che l'app si porta dietro.
// Che è un ripiego onesto per l'orizzonte di una città grande e non dice
// niente a chi sta in provincia: da Como, con il raggio stretto a venti
// chilometri, dentro `ECL_CITTA` non c'è **nulla** — e l'orizzonte restava
// senza un solo nome. Una query corta, invece, di paesi ne trova sempre:
// sono i vicini, cioè quelli che illuminano davvero.
function cittaQueryVicina(lat, lon) {
  const la = lat.toFixed(4), lo = lon.toFixed(4);
  const km = Math.min(CITTA_RAGGIO_RIPIEGO_KM, raggioCitta());
  return '[out:json][timeout:20];' +
    `node["place"~"^(city|town|village)$"](around:${Math.round(km * 1000)},${la},${lo});` +
    'out body 300;';
}

function cittaDaOverpass(lat, lon) {
  return overpassConRipiego(cittaQueryOverpass(lat, lon), cittaLeggiNodi,
                            cittaQueryVicina(lat, lon), CITTA_ATTESA_MS);
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

function cittaSalva(lat, lon, grezze, fonte, raggio) {
  try {
    const posti = cittaArchivio().filter(v => v && typeof v.lat === 'number' &&
      terrenoDistanzaKm(lat, lon, v.lat, v.lon) > CITTA_RAGGIO_VALIDO_KM);
    posti.unshift({
      lat, lon, fonte, quando: Date.now(), raggio: isFinite(raggio) ? raggio : raggioCitta(),
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
  citta.fonte = '';
  citta.quandoFallito = 0;
  citta.fallitoLat = citta.fallitoLon = null;
  overpassRiprovaAzzera('citta');
}


// --- L'innesco --------------------------------------------------------

function cittaApplica(lat, lon, grezze, fonte) {
  const luogo = terrenoLuogo();
  citta.lat = lat;
  citta.lon = lon;
  citta.elenco = cittaPrepara(grezze, lat, lon, luogo && luogo.nome);
  citta.fonte = fonte;
  citta.stato = 'pronto';
  citta.motivo = '';
  terrenoAggiornaPannello();
}

function cittaCarica(forza, soloCache) {
  const luogo = terrenoLuogo();
  if (!luogo) return Promise.resolve(false);
  const lat = luogo.lat, lon = luogo.lon;

  // Il ripiego interno (i capoluoghi di `ECL_CITTA`) è una **supplenza**, non
  // una risposta: dice «Milano» a chi sta a Como e non dice niente a chi sta
  // in un posto che quell'elenco non conosce. Contarla come «pronto» voleva
  // dire che il primo minuto storto di Overpass decideva l'orizzonte per
  // tutta la sessione — nessuno sarebbe più tornato a chiedere i paesi veri.
  const supplenza = citta.fonte === 'interno';
  if (!forza && citta.stato === 'pronto' && !supplenza && citta.lat !== null &&
      terrenoDistanzaKm(lat, lon, citta.lat, citta.lon) <= CITTA_RAGGIO_VALIDO_KM) {
    return Promise.resolve(true);
  }
  if (citta.stato === 'in-corso') return citta.promessa || Promise.resolve(false);

  // Ha appena fallito *per questo posto*: si aspetta prima di ridare fastidio
  // al servizio. È la stessa guardia delle vette, e serve per la stessa
  // ragione — senza, ogni giro di `skyAggiornaOsservatore` rilanciava la
  // richiesta, e a un'istanza che risponde 429 si finisce per chiedere sempre
  // più spesso proprio quando andrebbe lasciata in pace.
  if (!forza && citta.quandoFallito &&
      Date.now() - citta.quandoFallito < CITTA_RIPROVA_DOPO_MS &&
      citta.fallitoLat !== null &&
      terrenoDistanzaKm(lat, lon, citta.fallitoLat, citta.fallitoLon) <= CITTA_RAGGIO_VALIDO_KM) {
    return Promise.resolve(citta.stato === 'pronto');
  }

  if (!forza) {
    const salvate = cittaLeggiSalvate(lat, lon);
    if (salvate) {
      cittaApplica(salvate.lat, salvate.lon, cittaDalSalvato(salvate), salvate.fonte || 'salvato');
      return Promise.resolve(true);
    }
  }
  if (soloCache) return Promise.resolve(false);

  citta.stato = 'in-corso';
  citta.motivo = '';
  citta.avanzamento = 0;
  terrenoAggiornaPannello();

  citta.promessa = cittaDaOverpass(lat, lon)
    .then(elenco => {
      citta.avanzamento = 0.7;
      terrenoBarraAggiorna();
      if (!elenco.length) throw new Error('nessun luogo abitato qui attorno');
      cittaApplica(lat, lon, elenco, 'osm');
      // Si salva quello che è rimasto dopo la potatura, non i quattrocento
      // nodi grezzi: in una provincia densa Overpass risponde con ogni
      // frazione, e in localStorage ci vanno solo quelle che illuminano.
      if (!citta.elenco.length) throw new Error('nessun luogo abbastanza illuminato');
      cittaSalva(lat, lon, citta.elenco, 'osm',
                elenco.daRipiego ? Math.min(CITTA_RAGGIO_RIPIEGO_KM, raggioCitta()) : raggioCitta());
      citta.quandoFallito = 0;
      overpassRiprovaAzzera('citta');
      return true;
    })
    .catch(e => {
      console.warn('Città da OpenStreetMap non disponibili:', e && e.message ? e.message : e);
      citta.quandoFallito = Date.now();
      citta.fallitoLat = lat;
      citta.fallitoLon = lon;
      // Non è finita qui: fra qualche minuto si riprova da soli, e questa
      // volta per davvero.
      overpassRiprovaPiuTardi('citta', lat, lon, () => cittaCarica(true));
      // Il ripiego non si salva: è una supplenza, e al prossimo tentativo
      // con la rete che risponde vale la pena riavere i paesi veri.
      const interne = cittaDaElencoInterno(lat, lon);
      if (interne.length) {
        cittaApplica(lat, lon, interne, 'interno');
        return true;
      }
      citta.stato = 'fallito';
      citta.motivo = 'Non conosco i paesi qui attorno (' + (e && e.message ? e.message : 'OpenStreetMap non risponde') +
        '): l\'orizzonte resta senza luci. Si riprova da sé fra qualche minuto.';
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
  // Il nome preciso può arrivare dopo le città (il GPS e il geocodificatore
  // lavorano in parallelo). La seconda potatura evita che, per alcuni secondi
  // o fino al prossimo caricamento, resti visibile il nome appena riconosciuto
  // del luogo in cui ci si trova.
  const luogo = terrenoLuogo();
  return citta.elenco.filter(c => !cittaEPostoOsservatore(c, luogo && luogo.nome));
}

function cittaAlterna() {
  citta.acceso = !citta.acceso;
  // La supplenza dei capoluoghi conta come «non pronto»: riaccendere le luci
  // è il gesto di chi le sta cercando, e se OpenStreetMap nel frattempo è
  // tornato vale la pena riprovare. A non farne un martello ci pensa
  // l'attesa dopo un guasto, dentro `cittaCarica`.
  if (citta.acceso && (citta.stato !== 'pronto' || citta.fonte === 'interno')) cittaCarica();
  terrenoAggiornaPannello();
}

function cittaTesto() {
  if (!citta.acceso) return 'Luci delle città spente: orizzonte nero, come da un deserto.';
  if (citta.stato === 'in-corso') return 'Sto cercando i paesi qui attorno…';
  if (citta.stato === 'fallito') return citta.motivo;
  if (citta.stato !== 'pronto' || !citta.elenco.length) return '';

  const prima = citta.elenco[0];
  const dove = typeof skyNomeDirezione === 'function' ? skyNomeDirezione(prima.az) : '';
  // La supplenza va detta: un orizzonte con tre capoluoghi e nessun paese
  // sembra un orizzonte, e chi lo guarda non ha modo di sapere che i nomi
  // veri non sono mai arrivati.
  const nota = citta.fonte === 'interno'
    ? ' Per ora però ci sono solo le città grandi: OpenStreetMap non ha risposto, si riprova da sé fra qualche minuto.'
    : '';
  return `Sull'orizzonte ci sono le luci di ${citta.elenco.length} centri abitati: ` +
    `il chiarore più forte è quello di ${prima.nome}, a ${prima.km.toFixed(0)} km verso ${dove}. ` +
    'È la direzione in cui conviene NON cercare le cose deboli.' + nota;
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
// In viaggio il GPS può consegnare un punto nuovo a ogni curva. Una ricerca
// Overpass per ciascun punto non riuscirebbe comunque a raggiungere il
// telefono e terrebbe occupato il servizio con risposte già vecchie. Le
// copie locali si usano sempre; la rete parte soltanto quando il luogo resta
// fermo per questo intervallo.
const CIME_FERMO_PRIMA_DI_CARICARE_MS = 12000;
const CIME_VELOCITA_VIAGGIO_M_S = 2.5;
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
  avanzamento: 0,         // 0…1 per la barra della §9-ter
  // Accese di partenza, e la scelta si ricorda (§9-bis): il panorama deve
  // presentarsi già riconoscibile senza costringere a scoprire un secondo
  // interruttore oltre a quello generale delle etichette.
  acceso: raggi.nomiMonti,
  quandoFallito: 0,       // per non ritentare a raffica dopo un buco nell'acqua
  fallitoLat: null, fallitoLon: null,   // e dove era andata male: altrove si riprova subito
  // Le altezze apparenti si rifanno solo quando cambia qualcosa: la quota
  // dell'occhio o il profilo del terreno. Fra un fotogramma e l'altro no.
  vistaChiave: null,
  vista: [],
  timerViaggio: null,
  ultimoLuogo: null
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
    .filter(n => n && n.tags && n.tags.name && typeof n.lat === 'number' && n.tags.natural === 'peak')
    .map(n => {
      // La quota arriva come stringa, e ogni tanto con l'unità appiccicata
      // («1850 m») o con la virgola decimale
      const q = parseFloat(String(n.tags.ele).replace(',', '.').replace(/[^\d.\-]/g, ''));
      return { nome: n.tags.name, lat: n.lat, lon: n.lon, quota: q };
    })
    .filter(c => isFinite(c.quota));
}

function cimeDaOverpass(lat, lon) {
  return overpassConRipiego(cimeQueryOverpass(lat, lon), cimeLeggiNodi,
                            cimeQueryVicina(lat, lon), CIME_ATTESA_MS);
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

function cimeSalva(lat, lon, elenco, fonte, raggio) {
  try {
    const posti = cimeArchivio().filter(v => v && typeof v.lat === 'number' &&
      terrenoDistanzaKm(lat, lon, v.lat, v.lon) > CIME_RAGGIO_VALIDO_KM);
    posti.unshift({
      lat, lon, fonte, quando: Date.now(), raggio: isFinite(raggio) ? raggio : raggioCime(),
      elenco: elenco.map(c => ({ n: c.nome, a: +c.lat.toFixed(4), o: +c.lon.toFixed(4), q: Math.round(c.quota) }))
    });
    localStorage.setItem(CHIAVE_CIME, JSON.stringify({ posti: posti.slice(0, TERRENO_POSTI_SALVATI) }));
  } catch (e) { /* storage pieno: pazienza, si riscarica */ }
}

function cimeDalSalvato(v) {
  return v.elenco.map(c => ({ nome: c.n, lat: c.a, lon: c.o, quota: c.q }));
}

function cimeDimentica() {
  if (cime.timerViaggio) clearTimeout(cime.timerViaggio);
  cime.stato = 'niente';
  cime.quandoFallito = 0;
  cime.fallitoLat = cime.fallitoLon = null;
  cime.elenco = [];
  cime.vista = [];
  cime.vistaChiave = null;
  cime.lat = cime.lon = null;
  cime.timerViaggio = null;
  cime.ultimoLuogo = null;
  overpassRiprovaAzzera('cime');
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

// Dice se il punto sta ancora correndo. `coords.speed` non è disponibile su
// tutti i browser, quindi si affianca una misura fra le letture che arrivano
// qui. Il limite temporale evita di scambiare per un viaggio il salto fra la
// posizione salvata ieri e il primo fix di oggi.
function cimeLuogoInViaggio(luogo) {
  const ora = Date.now();
  const prima = cime.ultimoLuogo;
  cime.ultimoLuogo = { lat: luogo.lat, lon: luogo.lon, quando: ora };
  const velocitaGps = typeof sky !== 'undefined' && sky.posizione &&
    isFinite(sky.posizione.velocita) ? sky.posizione.velocita : null;
  if (velocitaGps !== null && velocitaGps >= CIME_VELOCITA_VIAGGIO_M_S) return true;
  if (!prima) return false;
  const secondi = (ora - prima.quando) / 1000;
  if (secondi <= 0 || secondi > 120) return false;
  return terrenoDistanzaKm(prima.lat, prima.lon, luogo.lat, luogo.lon) * 1000 / secondi >=
    CIME_VELOCITA_VIAGGIO_M_S;
}

function cimeRimandaDopoViaggio() {
  if (cime.timerViaggio) clearTimeout(cime.timerViaggio);
  cime.timerViaggio = setTimeout(() => {
    cime.timerViaggio = null;
    cimeCarica();
  }, CIME_FERMO_PRIMA_DI_CARICARE_MS);
}

function cimeCarica(forza, soloCache) {
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

  // Prima di decidere se ritentare la rete, guarda sempre quello che il
  // browser ha già in mano. `forza` significa «non rispettare l'attesa dopo
  // un errore», non «butta via una risposta buona»: prima, spegnendo e
  // riaccendendo dopo un tentativo fallito, si saltava proprio questa copia
  // e si vedeva ripartire Overpass anche se le vette erano già state
  // scaricate in una visita precedente.
  const salvate = cimeLeggiSalvate(lat, lon);
  if (salvate) {
    cimeApplica(salvate.lat, salvate.lon, cimeDalSalvato(salvate), salvate.fonte || 'salvato');
    return Promise.resolve(true);
  }
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

  if (soloCache) return Promise.resolve(false);

  // Durante uno spostamento rapido non accodiamo una richiesta destinata a
  // diventare vecchia prima della risposta. Il timer viene spostato avanti
  // da ogni nuovo fix: appena ci si ferma, una sola ricerca serve il punto
  // effettivo d'arrivo.
  if (!forza && cimeLuogoInViaggio(luogo)) {
    cimeRimandaDopoViaggio();
    return Promise.resolve(false);
  }

  cime.stato = 'in-corso';
  cime.motivo = '';
  cime.avanzamento = 0;
  terrenoAggiornaPannello();

  // Le tre richieste a Overpass — i paesi, le vette, le acque — non si mettono
  // più in fila l'una dietro l'altra: a spaziarle è il rubinetto
  // (`overpassInFila`), che ne fa partire due per volta a mezzo secondo di
  // distanza. Aspettare che la precedente **finisca** era la cura giusta per
  // il problema giusto — tre colpi contemporanei su un servizio pubblico sono
  // un 429 — pagata al prezzo sbagliato: le tre attese si sommavano, e quella
  // delle acque è la più lunga di tutte.
  cime.avanzamento = 0.3;
  terrenoBarraAggiorna();
  cime.promessa = cimeDaOverpass(lat, lon)
    .then(elenco => {
      cime.avanzamento = 0.8;
      cimeApplica(lat, lon, elenco, 'osm');
      if (!cime.elenco.length) {
        // Non è un errore: in mezzo alla pianura o in mezzo al mare le
        // montagne non ci sono, e dirlo è una risposta buona quanto un
        // elenco. Ma non vale la pena salvarla — basta un trasloco.
        cime.stato = 'pronto';
        cime.motivo = 'Qui attorno non ci sono vette con un nome.';
        overpassRiprovaAzzera('cime');
        terrenoAggiornaPannello();
        return true;
      }
      cimeSalva(lat, lon, cime.elenco, 'osm',
               elenco.daRipiego ? Math.min(CIME_RAGGIO_RIPIEGO_KM, raggioCime()) : raggioCime());
      overpassRiprovaAzzera('cime');
      return true;
    })
    .catch(e => {
      console.warn('Vette da OpenStreetMap non disponibili:', e && e.message ? e.message : e);
      // «Si riprova da sé fra qualche minuto» adesso è vero: prima lo diceva
      // il messaggio e non lo faceva nessuno.
      overpassRiprovaPiuTardi('cime', lat, lon, () => cimeCarica(true));
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
  const luogo = terrenoLuogo();
  if (!luogo || cime.lat === null ||
      terrenoDistanzaKm(luogo.lat, luogo.lon, cime.lat, cime.lon) > CIME_RAGGIO_VALIDO_KM) {
    // Mai lasciare sul parabrezza i nomi del tratto precedente mentre la
    // nuova ricerca è rinviata o in volo.
    return [];
  }
  // Tre risposte diverse, e la chiave se ne deve accorgere: il terreno c'è
  // (e allora vale l'istante in cui è arrivato), il terreno sta arrivando,
  // il terreno non c'è e non arriverà.
  const attesa = terrenoInArrivo();
  const chiave = `${luogo.lat.toFixed(4)},${luogo.lon.toFixed(4)}|${cimeQuotaOcchio().toFixed(1)}|` +
    `${terrenoDisponibile() ? terreno.quando : (attesa ? 'attesa' : 0)}`;
  if (cime.vistaChiave === chiave) return cime.vista;

  // Senza terreno non c'è niente che nasconda niente, e l'elenco verrebbe
  // fuori intero: ottanta vette, comprese quelle che stanno dietro alla
  // prima cresta. Se il terreno **sta arrivando** quella non è una risposta,
  // è un'anteprima sbagliata che fra due secondi va rimangiata — ed è
  // esattamente il singhiozzo che si vedeva all'apertura: tutti i nomi
  // addosso all'orizzonte, e poi via la metà. Meglio un secondo di silenzio.
  // Se invece il terreno non c'è e non arriva (spento, o la rete ha detto
  // di no), si nomina quello che spunta: è la risposta migliore possibile
  // con quello che si sa, ed è quella di sempre.
  if (attesa) {
    cime.vista = [];
    cime.vistaChiave = chiave;
    return cime.vista;
  }

  const occhio = cimeQuotaOcchio();
  const spuntano = cime.elenco
    // Entro il raggio di validità l'elenco OSM è ancora buono, ma azimut e
    // distanza cambiano continuamente: rifarli costa poche moltiplicazioni
    // e fa scorrere le etichette insieme al paesaggio, senza scaricare dati.
    .map(c => {
      const km = terrenoDistanzaKm(luogo.lat, luogo.lon, c.lat, c.lon);
      return Object.assign({}, c, {
        km,
        az: cittaAzimut(luogo.lat, luogo.lon, c.lat, c.lon),
        alt: terrenoAngolo(c.quota, occhio, km)
      });
    })
    .filter(c => {
      if (c.alt < CIME_ALT_MIN_GRADI) return false;
      // Se il rilievo fine è pronto, anche l'occlusione deve leggere quella
      // stessa superficie. Usare ancora la griglia grossa (7,5 gradi) poteva
      // attribuire alla direzione della vetta il fianco più alto di una cima
      // vicina e scartare tutti i nomi, benché le punte fossero disegnate.
      // Ci fermiamo prima della vetta come fa `terrenoCrestaDavanti`: la sua
      // cella DEM contiene la vetta stessa e non può essere il suo ostacolo.
      const davantiFine = typeof rilPronto === 'function' && rilPronto() &&
        typeof rilCrestaEntroM === 'function'
        ? rilCrestaEntroM(c.az, c.km * 1000 * TERRENO_FRONTE_MARGINE)
        : null;
      const davanti = davantiFine === null ? terrenoCrestaDavanti(c.az, c.km) : davantiFine;
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
  // Riaccendere non deve equivalere a riscaricare: `cimeCarica` recupera
  // prima la copia locale e conserva anche l'attesa di cortesia dopo un
  // errore. Un nuovo tentativo esplicito resta disponibile nel pannello.
  if (cime.acceso && cime.stato !== 'pronto') cimeCarica(false);
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
  // Tre silenzi diversi, e vale la pena distinguerli: «non ci sono
  // montagne» è un fatto del posto, «ci sono ma non si vedono» è un fatto
  // dell'orizzonte — ed è la risposta a «perché non leggo niente» — mentre
  // «sto ancora aspettando il terreno» non è né l'una né l'altra, e dirla
  // come se lo fosse sarebbe una bugia che dura due secondi.
  if (!viste.length) {
    if (terrenoInArrivo()) {
      return `Ho ${cime.elenco.length} vette qui attorno: aspetto la forma del terreno per sapere quali si vedono.`;
    }
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


// =====================================================================
// 12. LE ACQUE INTERNE — I LAGHI E I FIUMI
//     Il mare, questo file lo sapeva già trovare da sé: una direzione in
//     cui il modello del suolo dà zero per sessanta chilometri è acqua, e
//     non serve chiederlo a nessuno. Un lago no. Il lago di Garda sta a
//     sessantacinque metri sul livello del mare, il Lago Maggiore a
//     centonovantatré, un laghetto alpino a duemila: per il modello del
//     suolo sono terreno pianeggiante come un campo di grano, e non c'è
//     soglia che li distingua senza prendersi mezza Pianura Padana.
//
//     Quindi si chiedono, e si chiedono a OpenStreetMap — che è già la
//     fonte dei paesi e delle vette, e ha il pregio di sapere anche **la
//     forma**: un lago è un poligono, un fiume è una linea.
//
//     Da lì il lavoro vero è uno solo, ed è geometrico: per ogni direzione
//     attorno a chi guarda, **da che distanza a che distanza** c'è acqua.
//     La risposta è quella che il planetario disegna — un lago non è una
//     macchia sull'orizzonte, è una superficie che comincia dietro a una
//     collina e finisce contro la riva di là — e si ottiene tirando un
//     raggio per ogni mezzo grado e vedendo dove taglia i bordi.
//
//     Quello che questo modulo **non** fa è dire a che quota sta l'acqua:
//     quello lo sa già il modello del suolo (§4), e la quota si legge da
//     lì al momento di disegnare. È anche il motivo per cui la
//     rasterizzazione qui è pura geometria e si può salvare così com'è:
//     non dipende da quanto si è alti né da che cosa c'è davanti.
// =====================================================================

const CHIAVE_ACQUE = 'astrocalendario_acque';

// Ogni quanti gradi si tira un raggio. Mezzo grado è più fine di quanto
// serva al colore ma non a un fiume: a due chilometri un corso d'acqua
// largo trenta metri copre meno di un grado, e con un passo di uno
// sparirebbe o raddoppierebbe a seconda di dove cade.
const ACQUE_PASSO_AZ = 0.5;
const ACQUE_DIREZIONI = Math.round(360 / ACQUE_PASSO_AZ);

// Quanto è larga un'acqua corrente quando OpenStreetMap non lo dice. Sono
// medie oneste: un fiume italiano di pianura, un canale di bonifica.
const ACQUE_LARGHEZZA = { river: 45, canal: 14, stream: 4 };

// Un fiume che scorre quasi lungo il raggio verrebbe lungo chilometri: la
// profondità apparente è la larghezza divisa il seno dell'angolo, e a
// zero gradi va all'infinito. Si tosa a otto volte la larghezza.
const ACQUE_FIUME_MAX = 8;

// Sotto questa misura uno specchio d'acqua non vale la richiesta né il
// disegno: è una piscina, una vasca di depurazione, uno stagno da
// giardino. Il conto è sull'area del suo riquadro, in metri quadri.
const ACQUE_AREA_MIN = 4000;

// Quanto in basso può scendere il bordo vicino di uno specchio d'acqua.
//
// Stando **sull'**acqua, la superficie arriva ai piedi: la sua depressione
// tende a novanta gradi, e novanta gradi esatti è il nadir — che in
// stereografica, guardando in su, è l'antipodo del centro della vista, cioè
// il punto che la proiezione manda all'infinito. Ottantacinque gradi
// corrispondono a quattordici centimetri dalla punta delle scarpe: tutta
// l'acqua che c'è da disegnare c'è, e il poligono resta un poligono.
const ACQUE_DEP_MAX_GRADI = 85;

// Di quanto la cresta davanti deve superare l'acqua per nasconderla.
//
// I modelli del suolo spianano gli specchi d'acqua, quindi i campioni dentro
// a un lago **sono** la quota del lago: confrontare l'angolo dell'acqua con
// l'angolo del terreno che le sta davanti mette a paragone due numeri che
// alla riva vicina sono lo stesso numero, e a decidere resta l'ultimo bit
// della doppia precisione. Il risultato era una riva che compariva e
// spariva da un fotogramma all'altro. Un ventesimo di grado di franchigia è
// meno di un pixel a qualunque ingrandimento e toglie di mezzo il
// ballottaggio.
const ACQUE_OCCLUSIONE_MARGINE_GRADI = 0.05;

// In quanti punti si guarda una banda per sapere quali suoi tratti si vedono.
// Erano otto quando il conto cercava un taglio solo; adesso che si tengono
// tutti i tratti scoperti conta anche **dove** cominciano, e dodici passi su
// una banda di un chilometro sono ottanta metri di grana. Gira una volta per
// terreno e per altezza dell'occhio, non a ogni fotogramma.
const ACQUE_OCCLUSIONE_PASSI = 12;

const ACQUE_ATTESA_MS = 30000;
// Fin dove arriva la query corta di ripiego. Era un 12 scritto a mano dentro
// `acqueQueryCorta`, e serve anche fuori: quello che si salva va etichettato
// col raggio con cui è stato **preso**, non con quello che si era chiesto.
const ACQUE_RAGGIO_RIPIEGO_KM = 12;
const ACQUE_RAGGIO_VALIDO_KM = 2;
const ACQUE_RIPROVA_DOPO_MS = 4 * 60 * 1000;

const acque = {
  stato: 'niente',        // niente | in-corso | pronto | fallito
  lat: null,
  lon: null,
  // La rasterizzazione: per ogni mezzo grado, gli intervalli di distanza in
  // cui c'è acqua. `[vicino, lontano, tipo]` in metri, tipo 0 = fermo
  // (lago), 1 = corrente (fiume).
  bande: null,
  // Si sta **dentro** a uno specchio d'acqua: le coordinate cascano dentro a
  // un poligono. È il caso che per un pezzo non esisteva affatto — l'algoritmo
  // dava per scontato che il raggio partisse da terra — e cambia due cose: la
  // prima banda di ogni direzione comincia ai piedi invece che alla riva, e
  // l'occhio sta sulla superficie e non sul suolo (`acqueAllineaOcchio`).
  sommerso: false,
  quotaSommerso: null,    // la quota della superficie su cui si sta, in metri
  avanzamento: 0,         // 0…1 per la barra della §9-ter: richiesta, poi raggi
  quanti: 0,              // quanti specchi d'acqua sono stati trovati
  nomi: [],               // i più grandi, per la riga di stato
  fonte: '',
  motivo: '',
  quandoFallito: 0,
  fallitoLat: null,
  fallitoLon: null,
  promessa: null,
  // Quello che serve al disegno, ricavato al volo dalle bande + il terreno:
  // si rifà solo quando cambia il terreno o l'altezza dell'occhio.
  vista: null,
  vistaChiave: null,
  acceso: raggi.acqueAccese
};

function raggioAcque() { return raggi.acque; }


// --- Chiederle a OpenStreetMap ----------------------------------------

// Laghi (poligoni) e corsi d'acqua (linee). `out geom` è la parte che
// conta: senza, arrivano gli identificativi dei nodi e non le coordinate,
// e servirebbe una seconda richiesta per ognuno.
//
// I laghi grandi in OSM sono **relazioni** (multipoligoni), non vie: il
// Garda, il Trasimeno, il Lago di Como, la laguna di Venezia. Con `out geom`
// una relazione porta la geometria di ogni suo pezzo, e i pezzi vanno
// **ricuciti** in anelli prima di poterli usare (`acqueCuciAnelli`): un arco
// di riva, da solo, non ha un dentro.
function acqueQueryOverpass(lat, lon) {
  const r = terrenoRiquadro(lat, lon, raggioAcque());
  const bb = `(${r.s.toFixed(4)},${r.o.toFixed(4)},${r.n.toFixed(4)},${r.e.toFixed(4)})`;
  return '[out:json][timeout:25];(' +
    `way["natural"="water"]${bb};` +
    `relation["natural"="water"]${bb};` +
    `way["waterway"~"^(river|canal)$"]${bb};` +
    ');out geom 1200;';
}

// Il ripiego, per quando la richiesta larga si prende un 504: solo i laghi,
// solo vicino, niente relazioni. È molto più corta e passa quasi sempre.
function acqueQueryCorta(lat, lon) {
  const r = terrenoRiquadro(lat, lon, Math.min(ACQUE_RAGGIO_RIPIEGO_KM, raggioAcque()));
  const bb = `(${r.s.toFixed(4)},${r.o.toFixed(4)},${r.n.toFixed(4)},${r.e.toFixed(4)})`;
  return '[out:json][timeout:20];(' +
    `way["natural"="water"]${bb};` +
    `way["waterway"="river"]${bb};` +
    ');out geom 500;';
}

// Due punti che sono lo stesso punto. Le vie di una relazione **condividono
// il nodo** agli estremi, quindi le coordinate che arrivano sono identiche
// cifra per cifra: la tolleranza serve solo a non dipendere dal fatto che
// restino identiche anche dopo un arrotondamento di Overpass. Un decimo di
// milionesimo di grado è un centimetro.
function acqueStessoPunto(a, b) {
  return Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lon - b.lon) < 1e-7;
}

// Ricucire i pezzi di una relazione in anelli chiusi.
//
// È la funzione che mancava, ed è mancata in modo particolarmente sgradevole:
// non faceva sbagliare i laghi piccoli — quelli sono una via chiusa e
// funzionavano — ma **tutti quelli grandi**, che in OpenStreetMap sono
// relazioni con l'anello esterno spezzato in una decina di vie. Il Lago di
// Como, il Garda, il Maggiore, il Trasimeno.
//
// Prima ogni pezzo veniva chiuso per conto suo e trattato da poligono, e da lì
// nascevano due guasti che si sommavano:
//
//   - l'arco della riva orientale, chiuso su sé stesso, è una mezzaluna
//     schiacciata che **non contiene il centro del lago**: chi stava in mezzo
//     al Como non risultava dentro a nessun poligono, `sommersi` restava vuoto
//     e l'acqua sotto i piedi non si disegnava.
//   - la parità dei tagli si tiene per poligono (e deve: due laghi in fila
//     sono due parità diverse), quindi l'ingresso trovato sulla riva ovest e
//     l'uscita trovata sulla riva est finivano in due conti separati e non si
//     accoppiavano con nessuno: due mozziconi da duecento metri al posto della
//     traversata. Misurato sul ramo di Como, prima: **630 direzioni su 720
//     senz'acqua**, e nessuna che partisse dai piedi.
//
// L'algoritmo è quello di sempre: si tengono le catene aperte, e ogni arco
// nuovo si attacca a quella che condivide un estremo — dalla testa o dalla
// coda, all'andata o al rovescio. Quando una catena si chiude diventa un
// anello. Le relazioni hanno decine di membri, non migliaia, quindi la
// scansione quadratica sta in un millesimo di secondo e non vale la pena
// indicizzare gli estremi.
function acqueCuciAnelli(archi) {
  const aperti = [];
  const anelli = [];

  for (const arco of archi) {
    if (!Array.isArray(arco) || arco.length < 2) continue;
    let pezzo = arco.slice();
    // Un membro che è già un anello per conto suo (capita: un'isola, o un
    // laghetto tenuto dentro alla stessa relazione) non ha niente da cucire.
    let unito = true;
    while (unito) {
      if (pezzo.length > 3 && acqueStessoPunto(pezzo[0], pezzo[pezzo.length - 1])) break;
      unito = false;
      for (let i = 0; i < aperti.length; i++) {
        const c = aperti[i];
        const cTesta = c[0], cCoda = c[c.length - 1];
        const pTesta = pezzo[0], pCoda = pezzo[pezzo.length - 1];
        if (acqueStessoPunto(cCoda, pTesta)) pezzo = c.concat(pezzo.slice(1));
        else if (acqueStessoPunto(cCoda, pCoda)) pezzo = c.concat(pezzo.slice(0, -1).reverse());
        else if (acqueStessoPunto(cTesta, pCoda)) pezzo = pezzo.concat(c.slice(1));
        else if (acqueStessoPunto(cTesta, pTesta)) pezzo = pezzo.slice(1).reverse().concat(c);
        else continue;
        aperti.splice(i, 1);
        unito = true;
        break;
      }
    }
    if (pezzo.length > 3 && acqueStessoPunto(pezzo[0], pezzo[pezzo.length - 1])) anelli.push(pezzo);
    else aperti.push(pezzo);
  }
  // Quello che non si è chiuso si chiude a forza, come si faceva prima con
  // ogni singolo membro. Capita quando la relazione è incompleta o quando
  // Overpass ne ha tagliato dei pezzi (il limite di `out geom`): un anello
  // approssimato è comunque molto meglio di dieci mezzelune, perché ha un
  // dentro e una parità sola.
  return { anelli, aperti };
}

// Da quello che risponde Overpass alle sole cose che servono: una lista di
// tracciati, ognuno con il suo tipo, se è chiuso, e la sua larghezza se è
// un corso d'acqua.
function acqueLeggiElementi(elementi) {
  const fuori = [];
  const aggiungi = (punti, tags, chiuso, nome) => {
    if (!Array.isArray(punti) || punti.length < 2) return;
    const corrente = tags && tags.waterway && !tags.natural;
    let largo = 0;
    if (corrente) {
      const scritta = parseFloat(String(tags.width || tags['maxwidth'] || '').replace(',', '.'));
      largo = isFinite(scritta) && scritta > 0
        ? scritta : (ACQUE_LARGHEZZA[tags.waterway] || ACQUE_LARGHEZZA.stream);
    }
    fuori.push({ punti, corrente: !!corrente, largo, chiuso, nome: nome || '' });
  };

  for (const e of elementi) {
    if (!e) continue;
    const tags = e.tags || {};
    // I fiumi mappati come area (`natural=water` + `water=river`) sono
    // poligoni e vanno trattati da poligoni, non da linee: il campo
    // `waterway` ce l'hanno lo stesso, e senza questo controllo un'ansa
    // larga duecento metri veniva disegnata come un filo.
    if (e.type === 'way' && Array.isArray(e.geometry)) {
      const p = e.geometry.filter(g => g && typeof g.lat === 'number');
      const chiuso = p.length > 3 &&
        Math.abs(p[0].lat - p[p.length - 1].lat) < 1e-7 &&
        Math.abs(p[0].lon - p[p.length - 1].lon) < 1e-7;
      aggiungi(p, tags, chiuso, tags.name);
    } else if (e.type === 'relation' && Array.isArray(e.members)) {
      // I pezzi dell'anello esterno, ricuciti in anelli veri: un arco di riva
      // non ha un dentro, e trattarlo da poligono è il guasto del Lago di
      // Como (vedi `acqueCuciAnelli`). Le isole (`role: inner`) restano fuori
      // come prima: disegnare l'acqua dove c'è un'isola è un'imprecisione da
      // qualche grado d'orizzonte, mentre non disegnare il lago è il lago che
      // manca.
      const archi = [];
      for (const mem of e.members) {
        if (!mem || !Array.isArray(mem.geometry)) continue;
        if (mem.role && mem.role !== 'outer') continue;
        const p = mem.geometry.filter(g => g && typeof g.lat === 'number');
        if (p.length > 1) archi.push(p);
      }
      const cuciti = acqueCuciAnelli(archi);
      cuciti.anelli.forEach(a => aggiungi(a, tags, true, tags.name));
      cuciti.aperti.forEach(a => aggiungi(a, tags, true, tags.name));
    }
  }
  return fuori;
}

function acqueDaOverpass(lat, lon) {
  return overpassConRipiego(acqueQueryOverpass(lat, lon), acqueLeggiElementi,
                            acqueQueryCorta(lat, lon), ACQUE_ATTESA_MS);
}


// --- Dalla forma alle direzioni ---------------------------------------

// Il tracciato in metri veri attorno a chi guarda: est e nord. Da qui in
// poi è geometria piana, e a queste distanze la Terra è piana abbastanza
// (a venticinque chilometri lo scarto di una proiezione locale è metri).
function acqueInMetri(punti, lat, lon) {
  const D2R = Math.PI / 180;
  const mLat = 111320;
  const mLon = 111320 * Math.cos(lat * D2R);
  const fuori = new Float64Array(punti.length * 2);
  for (let i = 0; i < punti.length; i++) {
    fuori[i * 2] = (punti[i].lon - lon) * mLon;
    fuori[i * 2 + 1] = (punti[i].lat - lat) * mLat;
  }
  return fuori;
}

// Il tracciato in metri **e** il suo riquadro, in un giro solo.
//
// Erano due passate sui vertici: una per convertire e una per il riquadro. Su
// un posto normale sono duemila vertici e non conta niente, ma col tetto di
// `out geom 1200` riempito sono centottantasettemila, e a quel punto una
// passata in meno è una passata in meno. Il riquadro esce dalla conversione
// senza costare nulla: i numeri passano da qui comunque.
function acquePuntiEriquadro(punti, lat, lon) {
  const n = punti.length;
  const mLat = 111320;
  const mLon = 111320 * Math.cos(lat * Math.PI / 180);
  const p = new Float64Array(n * 2);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const q = punti[i];
    const x = (q.lon - lon) * mLon;
    const y = (q.lat - lat) * mLat;
    p[i * 2] = x;
    p[i * 2 + 1] = y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { p, minX, maxX, minY, maxY };
}

// L'indice della direzione in cui cade un punto, come numero con la
// virgola: serve a sapere quali raggi possono tagliare un lato.
function acqueIndiceAz(x, y) {
  return ((Math.atan2(x, y) * 180 / Math.PI + 360) % 360) / ACQUE_PASSO_AZ;
}

// L'origine — cioè chi guarda — sta dentro a questo poligono?
//
// È la domanda che mancava, e mancava in modo insidioso: senza di lei
// l'algoritmo dei tagli assume sempre di partire da terra, quindi conta il
// primo incrocio come un **ingresso** nell'acqua. Chi sta in mezzo a un lago
// (o su un fiume, o in mare aperto dentro a un poligono di OSM) col primo
// incrocio ci sta invece **uscendo**: tutta la parità si sposta di uno, e il
// risultato è che l'acqua sotto i piedi non viene disegnata affatto mentre la
// terra dietro alla riva viene disegnata come acqua. Un errore che si vede
// per quello che è solo se si sa dove guardare, perché il disegno resta
// plausibile — c'è dell'acqua, sta più o meno lì.
//
// Il test è quello di sempre (parità degli incroci di una semiretta), tirato
// verso est perché è l'asse in cui i punti sono già scritti. Costa un giro
// dei vertici e si fa una volta per specchio d'acqua, non una per raggio: chi
// chiama lo fa **dopo** aver visto che il riquadro contiene l'origine, e quel
// controllo scarta tutti i laghi tranne quello in cui si sta.
function acquePuntoDentro(p, n) {
  let dentro = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = p[i * 2 + 1], yj = p[j * 2 + 1];
    // Il lato attraversa il parallelo dell'origine?
    if ((yi > 0) === (yj > 0)) continue;
    const xi = p[i * 2], xj = p[j * 2];
    // Dove lo attraversa: se a est dell'origine, la semiretta lo taglia.
    if (xi + (0 - yi) * (xj - xi) / (yj - yi) > 0) dentro = !dentro;
  }
  return dentro;
}

// Il cuore: si tira un raggio per ogni direzione e si segna dove taglia i
// bordi. Non si prova ogni lato contro ogni raggio — sarebbero milioni di
// prove — ma **solo contro i raggi che quel lato può incontrare**, che
// sono quelli fra l'azimut di un estremo e quello dell'altro. Un lago
// lontano occupa tre direzioni e costa tre prove.
//
// Per un poligono i tagli vengono a coppie (si entra e si esce), e
// ordinandoli si hanno gli intervalli d'acqua. Per una linea — un fiume —
// ogni taglio è un attraversamento, e l'intervallo glielo dà la larghezza:
// tanto più lungo quanto più il fiume corre lungo il raggio, perché
// guardandolo per il verso lungo se ne vede un pezzo intero.
// I seni e i coseni delle settecentoventi direzioni. Sono sempre gli stessi —
// le direzioni non dipendono da dove si è — e si calcolavano da capo a ogni
// chiamata: millequattrocento funzioni trigonometriche per niente.
const ACQUE_SENI = new Float64Array(ACQUE_DIREZIONI);
const ACQUE_COSENI = new Float64Array(ACQUE_DIREZIONI);
for (let b = 0; b < ACQUE_DIREZIONI; b++) {
  const a = b * ACQUE_PASSO_AZ * Math.PI / 180;
  ACQUE_SENI[b] = Math.sin(a);
  ACQUE_COSENI[b] = Math.cos(a);
}

// Il telaio dei tagli, vuoto: settecentoventi direzioni, più le due cose che
// viaggiano appese all'array.
function acqueTagliVuoti(limiteM) {
  const tagli = new Array(ACQUE_DIREZIONI);
  for (let i = 0; i < ACQUE_DIREZIONI; i++) tagli[i] = null;
  // Gli specchi d'acqua che contengono l'origine, e il limite oltre il quale
  // i tagli sono stati buttati. Viaggiano appesi all'array invece che in un
  // secondo valore di ritorno perché `acqueBandeDaTagli(acqueTaglia(…))` è
  // scritto così in tre posti — nell'app e nelle prove — e la parità dei
  // tagli non si può leggere senza sapere da dove parte il raggio.
  tagli.sommersi = new Set();
  // Come si chiama ogni specchio d'acqua, per numero. Il nome sta qui e non
  // dentro a ogni incrocio perché gli incroci sono migliaia e il nome è uno:
  // appenderlo a ognuno vorrebbe dire migliaia di stringhe ripetute, e —
  // peggio — vorrebbe dire ricordarsi di appenderlo in tutti e due i punti
  // in cui un incrocio nasce. È esattamente quello che non era stato fatto:
  // i nomi arrivavano fino a qui e poi sparivano, e sullo schermo i laghi
  // restavano senza etichetta (vedi `acqueBandeDaTagli`).
  tagli.nomi = new Map();
  tagli.limite = limiteM;
  return tagli;
}

// Ci si sta **sopra**, a questo corso d'acqua?
//
// Un fiume è una polilinea, quindi il test di appartenenza dei poligoni non
// gli si può fare: quello che ha è una larghezza, e «starci dentro» vuol dire
// che la distanza dalla sua linea è meno di mezza larghezza. Il caso non è
// esotico — un ponte, una passerella, la riva di un fiume di città largo
// quaranta metri — e prima non veniva disegnato affatto, per due motivi che
// si sommavano: i raggi partono dall'origine e una retta che passa per
// l'origine non la si taglia mai a distanza positiva, e i lati si provano
// solo contro i raggi compresi fra i loro estremi, che stando in mezzo sono
// mezzo giro e non tutto.
//
// Quello che **non** si fa qui è segnarlo fra i `sommersi`: quelli servono
// alla parità dei poligoni e a spostare l'occhio sul pelo dell'acqua
// (`acqueAllineaOcchio`), e nessuna delle due cose vale per un fiume. La
// parità di una polilinea non esiste, e chi sta su un ponte è alto quanto il
// ponte, non quanto il fiume.
//
// Quando ci si sta sopra il conto giusto è un altro, ed è più semplice: a
// trenta metri un fiume è **dritto**, quindi basta il suo asse e la sua
// larghezza. Per ogni direzione l'acqua comincia ai piedi e finisce dove il
// raggio esce dalla striscia, che è una divisione. Guardando lungo il corso
// il raggio non esce mai, e lì vale lo stesso tetto degli attraversamenti di
// sbieco (`ACQUE_FIUME_MAX`): un fiume non si vede fino all'orizzonte.
function acqueFiumeAddosso(p, n, largo, tagli, id) {
  const mezzo = largo / 2;
  let dist2 = Infinity, nx = 0, ny = 0, perp = 0;
  for (let i = 0; i + 1 < n; i++) {
    const ax = p[i * 2], ay = p[i * 2 + 1];
    const ex = p[i * 2 + 2] - ax, ey = p[i * 2 + 3] - ay;
    const L2 = ex * ex + ey * ey;
    if (L2 === 0) continue;
    // Il punto del lato più vicino all'origine: la proiezione, tosata agli
    // estremi (se no un lato che passa lontano ma la cui *retta* passa vicino
    // farebbe risultare bagnati i piedi).
    const u = Math.max(0, Math.min(1, -(ax * ex + ay * ey) / L2));
    const qx = ax + ex * u, qy = ay + ey * u;
    const d2 = qx * qx + qy * qy;
    if (d2 >= dist2) continue;
    dist2 = d2;
    const L = Math.sqrt(L2);
    nx = -ey / L; ny = ex / L;
    perp = -(qx * nx + qy * ny);
  }
  if (!(dist2 < mezzo * mezzo)) return false;

  const tetto = largo * ACQUE_FIUME_MAX;
  for (let b = 0; b < ACQUE_DIREZIONI; b++) {
    const den = ACQUE_SENI[b] * nx + ACQUE_COSENI[b] * ny;
    // Lungo il corso non si esce mai: la striscia è parallela al raggio.
    const t = Math.abs(den) < 1e-6
      ? tetto
      : Math.min(tetto, ((den > 0 ? mezzo : -mezzo) - perp) / den);
    if (!(t > 0.5)) continue;
    if (!tagli[b]) tagli[b] = [];
    // Un attraversamento centrato sui piedi e profondo il doppio dell'uscita:
    // `acqueBandeDaTagli` lo tosa a zero da sé e ne fa la banda [0, t].
    tagli[b].push({ t: 0, fiume: true, prof: 2 * t, id });
  }
  return true;
}

// Un tracciato solo contro tutti i raggi che può incontrare. È il corpo del
// ciclo di `acqueTaglia`, tirato fuori perché lo stesso lavoro si possa fare
// tutto in un colpo (le prove, e i posti normali) o **a scaglioni** senza
// bloccare il disegno (`acqueTagliaAScaglioni`).
function acqueTagliaUno(tr, id, tagli, lat, lon, limiteM) {
  const n = tr.punti.length;
  // Il tracciato in metri e il suo riquadro, in un giro solo.
  const { p, minX, maxX, minY, maxY } = acquePuntiEriquadro(tr.punti, lat, lon);
  // Uno specchio grande come una vasca non è uno specchio…
  if (!tr.corrente && (maxX - minX) * (maxY - minY) < ACQUE_AREA_MIN) return;
  // …e il punto del riquadro più vicino all'origine: se è oltre il limite,
  // tutto lo specchio lo è, e non vale la pena provarne i lati.
  const vx = minX > 0 ? minX : (maxX < 0 ? maxX : 0);
  const vy = minY > 0 ? minY : (maxY < 0 ? maxY : 0);
  if (Math.hypot(vx, vy) > limiteM) return;

  // Ci siamo dentro? Solo se il riquadro contiene l'origine vale la pena
  // chiederlo, e per un posto normale la risposta è no per tutti: due
  // confronti a specchio d'acqua, e il giro dei vertici non si fa affatto.
  // I corsi d'acqua mappati come linea sono esclusi per definizione — una
  // polilinea non ha un dentro — mentre un fiume mappato come area arriva
  // qui da poligono, che è giusto: in un'ansa larga duecento metri ci si
  // sta in mezzo come in un lago.
  if (!tr.corrente && tr.chiuso && minX <= 0 && maxX >= 0 && minY <= 0 && maxY >= 0 &&
      acquePuntoDentro(p, n)) {
    tagli.sommersi.add(id);
  }

  // Il nome si segna qui, una volta per specchio d'acqua: da qui in poi un
  // incrocio è un numero e una distanza, e il numero basta a ritrovarlo.
  if (tr.nome && tagli.nomi && !tagli.nomi.has(id)) tagli.nomi.set(id, tr.nome);

  // Un corso d'acqua che ci passa sotto i piedi: la sua acqua non nasce da
  // nessun attraversamento, e va disegnata a parte (vedi `acqueFiumeAddosso`).
  // Il riquadro deve contenere l'origine allargato di mezza larghezza, se no
  // il giro dei lati non vale la pena di farlo: per un posto normale sono
  // quattro confronti e nient'altro.
  if (tr.corrente) {
    const m = tr.largo / 2;
    if (minX - m <= 0 && maxX + m >= 0 && minY - m <= 0 && maxY + m >= 0) {
      acqueFiumeAddosso(p, n, tr.largo, tagli, id);
    }
  }

  const lati = tr.chiuso ? n : n - 1;
  for (let i = 0; i < lati; i++) {
    const j = (i + 1) % n;
    const ax = p[i * 2], ay = p[i * 2 + 1];
    const bx = p[j * 2], by = p[j * 2 + 1];
    const ex = bx - ax, ey = by - ay;
    if (ex === 0 && ey === 0) continue;

    // Quali raggi può incontrare: quelli fra i due estremi, per la via
    // corta. Un lato visto da fuori non copre mai mezzo giro, quindi la
    // via corta è quella giusta.
    const i0 = acqueIndiceAz(ax, ay);
    const i1 = acqueIndiceAz(bx, by);
    let d = i1 - i0;
    const mezzo = ACQUE_DIREZIONI / 2;
    if (d > mezzo) d -= ACQUE_DIREZIONI;
    if (d < -mezzo) d += ACQUE_DIREZIONI;
    const passi = Math.abs(d);
    // Un lato che si vede quasi in punta non tocca nessun raggio, e
    // saltarlo va bene: ci pensano i suoi vicini.
    if (passi > mezzo) continue;
    const da = Math.ceil(Math.min(i0, i0 + d) - 1e-9);
    const a2 = Math.floor(Math.max(i0, i0 + d) + 1e-9);
    // La lunghezza del lato serve solo ai corsi d'acqua, e serve una volta per
    // lato e non una per raggio: dentro al ciclo era una radice quadrata
    // ricalcolata per ogni direzione attraversata.
    const len = tr.corrente ? Math.hypot(ex, ey) : 0;

    for (let q = da; q <= a2; q++) {
      const b = ((q % ACQUE_DIREZIONI) + ACQUE_DIREZIONI) % ACQUE_DIREZIONI;
      const dx = ACQUE_SENI[b], dy = ACQUE_COSENI[b];
      const det = ex * dy - dx * ey;
      if (Math.abs(det) < 1e-9) continue;
      const t = (ex * ay - ey * ax) / det;
      if (!(t > 0) || t > limiteM) continue;
      const u = (dx * ay - dy * ax) / det;
      if (u < 0 || u >= 1) continue;
      if (!tagli[b]) tagli[b] = [];
      if (tr.corrente) {
        // Quanto è profondo l'attraversamento: la larghezza divisa il
        // seno dell'angolo fra il raggio e la riva.
        const sen = Math.abs(det / len);
        const prof = Math.min(tr.largo * ACQUE_FIUME_MAX,
          tr.largo / Math.max(0.12, sen));
        tagli[b].push({ t, fiume: true, prof, id });
      } else {
        // `id` serve alla parità: gli incroci si accoppiano **per
        // poligono** e non tutti insieme. Con due laghi che si
        // sovrappongono in una direzione — o con uno solo, ma con noi
        // dentro — accoppiarli in blocco scambia l'acqua con la terra.
        tagli[b].push({ t, fiume: false, id });
      }
    }
  }
}

function acqueTaglia(tracciati, lat, lon, limiteM) {
  const tagli = acqueTagliVuoti(limiteM);
  for (let id = 0; id < tracciati.length; id++) {
    acqueTagliaUno(tracciati[id], id, tagli, lat, lon, limiteM);
  }
  return tagli;
}

// Quanto si lavora per volta prima di ridare il turno al browser. Otto
// millesimi sono mezzo fotogramma a sessanta al secondo: quello che resta basta
// a disegnare il cielo.
const ACQUE_SCAGLIONE_MS = 8;

// Lo stesso lavoro, ma **a scaglioni**.
//
// Il tracciamento dei raggi non è una richiesta di rete e per questo era
// rimasto fuori da ogni ragionamento sui tempi, ma è l'unico pezzo di questo
// modulo che gira **sul filo del disegno**: finché non finisce, il planetario
// non disegna un fotogramma. In un posto normale sono quaranta millesimi e non
// se ne accorge nessuno; in una provincia di laghi sono due decimi; con il
// tetto di `out geom 1200` riempito — una laguna, il delta di un fiume —
// arrivano a settecento millesimi su un computer, che su un telefono di qualche
// anno vogliono dire **due o tre secondi di schermo fermo**. E si fermava tutto
// insieme, nell'istante peggiore: quello in cui l'acqua stava per comparire.
//
// Il rimedio non è calcolare meno, è cedere il turno: si lavora per otto
// millesimi, si lascia disegnare un fotogramma, si riprende. Il conto è lo
// stesso — `acqueTagliaUno` è la stessa funzione delle prove — e quello che
// cambia è solo che nessuno resta a guardare uno schermo fermo. Il tempo totale
// cresce di quel poco che costano i turni ceduti, ed è un cambio che si
// **vede** solo nel verso giusto.
function acqueTagliaAScaglioni(tracciati, lat, lon, limiteM, avanti) {
  return new Promise(fine => {
    const tagli = acqueTagliVuoti(limiteM);
    let id = 0;
    const respiro = typeof requestAnimationFrame === 'function'
      ? (f => requestAnimationFrame(() => f()))
      : (f => setTimeout(f, 0));

    const scaglione = () => {
      const finoA = Date.now() + ACQUE_SCAGLIONE_MS;
      while (id < tracciati.length) {
        acqueTagliaUno(tracciati[id], id, tagli, lat, lon, limiteM);
        id++;
        // Il tempo si guarda ogni otto tracciati e non a ogni tracciato: una
        // lettura dell'orologio per un laghetto da sei vertici costa più del
        // laghetto.
        if ((id & 7) === 0 && Date.now() >= finoA) break;
      }
      if (id >= tracciati.length) { fine(tagli); return; }
      if (typeof avanti === 'function') avanti(id / tracciati.length);
      respiro(scaglione);
    };
    scaglione();
  });
}

// Dai tagli agli intervalli: si ordina, si accoppia (per i poligoni) e si
// fondono quelli che si toccano. Il risultato è la risposta alla domanda
// «da che distanza a che distanza c'è acqua da quella parte».
function acqueBandeDaTagli(tagli) {
  const bande = new Array(ACQUE_DIREZIONI);
  // Dove siamo dentro all'acqua, la parità di ogni poligono che ci contiene
  // parte rovesciata: il primo taglio è un'uscita.
  const sommersi = (tagli && tagli.sommersi) || null;
  const dentroQualcosa = !!(sommersi && sommersi.size);
  const limite = (tagli && typeof tagli.limite === 'number') ? tagli.limite : Infinity;
  // Come si chiama lo specchio numero `id`. Il nome viaggia appeso ai tagli
  // (§ `acqueTagliVuoti`) e non a ogni incrocio, e si legge qui: è l'unico
  // punto in cui una banda nasce, quindi è l'unico in cui il nome si può
  // dimenticare una volta sola invece che in quattro.
  const nomi = (tagli && tagli.nomi) || null;
  const nomeDi = id => (nomi && nomi.get(id)) || '';

  for (let b = 0; b < ACQUE_DIREZIONI; b++) {
    const lista = tagli[b];
    if ((!lista || !lista.length) && !dentroQualcosa) { bande[b] = null; continue; }

    const pezzi = [];
    // I tagli dei poligoni si tengono da parte **per poligono**: la parità è
    // una proprietà di ogni bordo chiuso, non della direzione. Messi in un
    // mucchio solo, due laghi che si sovrappongono in una direzione danno
    // acqua dove c'è la lingua di terra fra i due — e il lago in cui si sta
    // non si può leggere affatto.
    const perPoligono = new Map();
    if (lista && lista.length) {
      lista.sort((x, y) => x.t - y.t);
      for (const c of lista) {
        if (c.fiume) {
          pezzi.push([Math.max(0, c.t - c.prof / 2), c.t + c.prof / 2, 1, nomeDi(c.id)]);
          continue;
        }
        let p = perPoligono.get(c.id);
        if (!p) { p = { ts: [] }; perPoligono.set(c.id, p); }
        p.ts.push(c.t);
      }
    }

    perPoligono.forEach((p, id) => {
      const ts = p.ts;
      const nome = nomeDi(id);
      let k = 0;
      // Ci stiamo dentro: il primo taglio è la riva, e l'acqua comincia **ai
      // piedi**. È la banda che prima non veniva generata affatto, e la sua
      // mancanza è tutto il guasto: senza di lei chi sta in mezzo a un lago
      // vede l'acqua cominciare dalla riva opposta.
      if (sommersi && sommersi.has(id)) { pezzi.push([0, ts[0], 0, nome]); k = 1; }
      for (; k + 1 < ts.length; k += 2) pezzi.push([ts[k], ts[k + 1], 0, nome]);
      // Un taglio spaiato in fondo (capita ai bordi del riquadro scaricato,
      // dove il poligono è tagliato a metà) si chiude sul limite invece di
      // buttarlo: un lago che continua oltre i venticinque chilometri è
      // comunque un lago fino a lì.
      if (k < ts.length) pezzi.push([ts[k], ts[k] + 200, 0, nome]);
    });

    // Sommersi in uno specchio che in questa direzione non ha nessun taglio:
    // la riva opposta sta oltre il raggio di ricerca (il Garda visto da una
    // barca in mezzo, il mare aperto) e i suoi incroci sono stati scartati.
    // Allora l'acqua arriva fin dove si guarda, e non sapere dove finisce non
    // è una ragione per non disegnarla.
    if (sommersi) {
      sommersi.forEach(id => {
        if (!perPoligono.has(id)) pezzi.push([0, limite, 0, nomeDi(id)]);
      });
    }
    if (!pezzi.length) { bande[b] = null; continue; }

    pezzi.sort((x, y) => x[0] - y[0]);
    const uniti = [];
    for (const p of pezzi) {
      const ultimo = uniti[uniti.length - 1];
      if (ultimo && p[0] <= ultimo[1] + 3) {
        ultimo[1] = Math.max(ultimo[1], p[1]);
        // Un lago che inghiotte un fiume resta un lago: il tipo lo decide
        // il pezzo più lungo, che è quello che si vede.
        if (p[1] - p[0] > ultimo[1] - ultimo[0]) { ultimo[2] = p[2]; ultimo[3] = p[3]; } else if (!ultimo[3] && p[3]) { ultimo[3] = p[3]; }
      } else {
        uniti.push([Math.round(p[0]), Math.round(p[1]), p[2], p[3]]);
      }
    }
    bande[b] = uniti.length ? uniti : null;
  }
  return bande;
}

// I nomi dei tre specchi più larghi, per la riga di stato: «si vede il
// Lago di Garda» dice molto di più di «tre specchi d'acqua».
function acqueNomiGrandi(tracciati, lat, lon) {
  const per = new Map();
  for (const tr of tracciati) {
    if (!tr.nome || tr.corrente) continue;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const q of tr.punti) {
      const x = (q.lon - lon) * 111320 * Math.cos(lat * Math.PI / 180);
      const y = (q.lat - lat) * 111320;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const area = (maxX - minX) * (maxY - minY);
    if (!(area > ACQUE_AREA_MIN)) continue;
    per.set(tr.nome, Math.max(per.get(tr.nome) || 0, area));
  }
  return Array.from(per.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(v => v[0]);
}


// --- Tenersele --------------------------------------------------------

// Che forma hanno le bande salvate. Serve perché una banda salvata è una
// **tupla** — `[vicino, lontano, tipo, nome]` — e il giorno in cui le si
// aggiunge un posto, quelle già in `localStorage` non ce l'hanno: chi le
// rilegge non se ne accorge, perché una tupla corta si legge benissimo, e
// resta soltanto senza la cosa nuova. È successo esattamente con il nome:
// chi aveva già aperto il planetario in un posto si teneva per sempre dei
// laghi senza etichetta, e non c'era modo di distinguerli da un posto in cui
// i laghi un nome non ce l'hanno davvero.
//
// La 3 è la volta del **fiume sotto i piedi**: chi aveva già delle bande
// salvate in un posto attraversato da un corso d'acqua se le teneva senza la
// banda che comincia dalle scarpe, che è proprio quella che mancava.
const ACQUE_VERSIONE = 3;

function acqueArchivio() {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_ACQUE) || 'null');
    if (v && Array.isArray(v.posti)) return v.posti;
  } catch (e) { /* niente storage, o roba illeggibile */ }
  return [];
}

function acqueSalva(lat, lon, fonte, raggio) {
  try {
    const posti = acqueArchivio().filter(v => v && typeof v.lat === 'number' &&
      terrenoDistanzaKm(lat, lon, v.lat, v.lon) > ACQUE_RAGGIO_VALIDO_KM);
    // Le direzioni vuote non si scrivono: in un posto senza acqua sono
    // settecentoventi `null`, e con quattro posti salvati sono tremila.
    const fitte = {};
    (acque.bande || []).forEach((b, i) => { if (b && b.length) fitte[i] = b; });
    posti.unshift({
      lat, lon, fonte, quando: Date.now(), raggio: isFinite(raggio) ? raggio : raggioAcque(), versione: ACQUE_VERSIONE,
      // `sommerso` va salvato con le bande: è geometria pura come loro, e
      // ricavarlo di nuovo vorrebbe dire tenersi i poligoni. Senza di lui, a
      // ogni riapertura chi sta in mezzo a un lago si ritroverebbe l'occhio
      // sul suolo e l'acqua che comincia dalla riva opposta.
      sommerso: !!acque.sommerso,
      quanti: acque.quanti, nomi: acque.nomi, bande: fitte
    });
    localStorage.setItem(CHIAVE_ACQUE, JSON.stringify({ posti: posti.slice(0, TERRENO_POSTI_SALVATI) }));
  } catch (e) { /* storage pieno: pazienza, si riscarica */ }
}

function acqueLeggiSalvate(lat, lon) {
  return acqueArchivio().find(v => v && typeof v.lat === 'number' &&
    terrenoDistanzaKm(lat, lon, v.lat, v.lon) <= ACQUE_RAGGIO_VALIDO_KM &&
    // Un elenco preso più stretto di quello chiesto non risponde alla
    // domanda: si riscarica. Più largo va benissimo — i raggi si tagliano
    // al momento di disegnare.
    (v.raggio || 0) >= raggioAcque() &&
    // E un elenco di una forma più vecchia si riscarica anche lui: sono tre
    // richieste a Overpass, si pagano una volta.
    (v.versione || 0) >= ACQUE_VERSIONE) || null;
}

function acqueDalSalvato(v) {
  const bande = new Array(ACQUE_DIREZIONI).fill(null);
  Object.keys(v.bande || {}).forEach(k => {
    const i = Number(k);
    if (i >= 0 && i < ACQUE_DIREZIONI) bande[i] = v.bande[k];
  });
  return bande;
}

function acqueDimentica() {
  acque.stato = 'niente';
  acque.bande = null;
  acque.sommerso = false;
  acque.quotaSommerso = null;
  acque.vista = null;
  acque.vistaChiave = null;
  acque.quanti = 0;
  acque.nomi = [];
  acque.quandoFallito = 0;
  acque.fallitoLat = acque.fallitoLon = null;
  acque.lat = acque.lon = null;
  overpassRiprovaAzzera('acque');
}


// --- L'innesco --------------------------------------------------------

// Installare un risultato già calcolato. È sincrona di proposito: «prendi
// questi tagli e diventa lo stato dell'app» non è un'operazione che possa
// aspettare, e chi la chiama vuole poter leggere `acque.bande` nella riga dopo.
// Il tracciamento a scaglioni sta un passo prima
// (`acqueApplicaAScaglioni`), che è il posto giusto: è la **strada** di
// caricamento a dover cedere il turno, non la posa dei risultati.
function acqueMonta(lat, lon, tracciati, fonte, tagli) {
  acque.lat = lat;
  acque.lon = lon;
  acque.sommerso = !!(tagli.sommersi && tagli.sommersi.size);
  acque.bande = acqueBandeDaTagli(tagli);
  acque.quanti = acque.bande.reduce((n, b) => n + (b ? b.length : 0), 0);
  acque.nomi = acqueNomiGrandi(tracciati, lat, lon);
  acque.vista = null;
  acque.vistaChiave = null;
  acque.fonte = fonte;
  acque.stato = 'pronto';
  acque.motivo = '';
  // Stando sull'acqua l'occhio non è sul suolo. Va chiesto **prima** del
  // pannello, che scrive la riga di stato, e prima del primo disegno: la
  // quota dell'occhio è il termine da cui esce ogni angolo, quindi
  // disegnare un fotogramma con quella sbagliata vuol dire disegnare un
  // fotogramma di paesaggio storto.
  acqueAllineaOcchio();
  terrenoAggiornaPannello();
}

// Tracciare e installare, tutto in un colpo. È la strada di sempre — la usano
// le prove del §20 di `verifica.html`, che chiedono e leggono nella stessa riga
// — e resta quella giusta per un mucchio di poligoni piccolo.
function acqueApplica(lat, lon, tracciati, fonte) {
  acqueMonta(lat, lon, tracciati, fonte,
             acqueTaglia(tracciati, lat, lon, raggioAcque() * 1000));
}

// Tracciare **a scaglioni** e poi installare: è la strada del caricamento, e
// l'unica differenza è che fra un pezzo e l'altro il browser riesce a disegnare
// un fotogramma. La barra della §9-ter cammina insieme al lavoro, quindi fra il
// 90 e il 99 per cento adesso dice qualcosa di vero invece di essere un numero
// scritto un istante prima di bloccare tutto.
function acqueApplicaAScaglioni(lat, lon, tracciati, fonte) {
  acque.avanzamento = 0.9;
  terrenoBarraAggiorna();
  return acqueTagliaAScaglioni(tracciati, lat, lon, raggioAcque() * 1000,
    fatto => {
      acque.avanzamento = 0.9 + 0.09 * fatto;
      terrenoBarraAggiorna();
    })
    .then(tagli => acqueMonta(lat, lon, tracciati, fonte, tagli));
}

function acqueCarica(forza, soloCache) {
  if (!acque.acceso) return Promise.resolve(false);

  const luogo = terrenoLuogo();
  if (!luogo) return Promise.resolve(false);
  const lat = luogo.lat, lon = luogo.lon;

  if (!forza && acque.stato === 'pronto' && acque.lat !== null &&
      terrenoDistanzaKm(lat, lon, acque.lat, acque.lon) <= ACQUE_RAGGIO_VALIDO_KM) {
    return Promise.resolve(true);
  }
  if (acque.stato === 'in-corso') return acque.promessa || Promise.resolve(false);
  if (!forza && acque.stato === 'fallito' &&
      Date.now() - (acque.quandoFallito || 0) < ACQUE_RIPROVA_DOPO_MS &&
      acque.fallitoLat !== null &&
      terrenoDistanzaKm(lat, lon, acque.fallitoLat, acque.fallitoLon) <= ACQUE_RAGGIO_VALIDO_KM) {
    return Promise.resolve(false);
  }

  if (!forza) {
    const salvate = acqueLeggiSalvate(lat, lon);
    if (salvate) {
      acque.lat = salvate.lat;
      acque.lon = salvate.lon;
      acque.bande = acqueDalSalvato(salvate);
      acque.sommerso = !!salvate.sommerso;
      acque.quotaSommerso = null;
      acque.quanti = salvate.quanti || 0;
      acque.nomi = Array.isArray(salvate.nomi) ? salvate.nomi : [];
      acque.vista = null;
      acque.vistaChiave = null;
      acque.fonte = salvate.fonte || 'salvato';
      acque.stato = 'pronto';
      acque.motivo = '';
      acqueAllineaOcchio();
      terrenoAggiornaPannello();
      return Promise.resolve(true);
    }
  }
  if (soloCache) return Promise.resolve(false);

  acque.stato = 'in-corso';
  acque.motivo = '';
  acque.avanzamento = 0;
  terrenoAggiornaPannello();

  // Non più «in coda alle altre due»: ci pensa il rubinetto di Overpass a non
  // far partire più di due richieste insieme, e questa era la più penalizzata
  // dall'attesa in fila indiana — è quella con la query più larga e l'attesa
  // più lunga, e si ritrovava dietro a **tutte e due** le altre, ognuna col suo
  // caso peggiore. Il ritardo che si vedeva era sempre suo: l'acqua compariva
  // per ultima, molto dopo il resto del paesaggio.
  acque.avanzamento = 0.2;
  terrenoBarraAggiorna();
  acque.promessa = acqueDaOverpass(lat, lon)
    .then(tracciati => acqueApplicaAScaglioni(lat, lon, tracciati, 'osm')
      .then(() => tracciati && tracciati.daRipiego ? Math.min(ACQUE_RAGGIO_RIPIEGO_KM, raggioAcque()) : raggioAcque()))
    .then(raggioPreso => {
      // Zero specchi d'acqua è una risposta, non un errore — mezza Italia
      // è così. Ma non vale la pena salvarla: basta un trasloco.
      if (acque.quanti) acqueSalva(lat, lon, 'osm', raggioPreso);
      overpassRiprovaAzzera('acque');
      return true;
    })
    .catch(e => {
      console.warn('Laghi e fiumi da OpenStreetMap non disponibili:', e && e.message ? e.message : e);
      overpassRiprovaPiuTardi('acque', lat, lon, () => acqueCarica(true));
      acque.stato = 'fallito';
      acque.motivo = e && e.message ? e.message : 'non sono riuscito a scaricarle';
      acque.quandoFallito = Date.now();
      acque.fallitoLat = lat;
      acque.fallitoLon = lon;
      terrenoAggiornaPannello();
      return false;
    })
    .finally(() => { acque.promessa = null; });

  return acque.promessa;
}


// --- Quello che da qui si vede davvero --------------------------------

// Sotto che angolo si vede la superficie dell'acqua a `m` metri.
//
// È lo stesso conto di `terrenoAngolo` — dislivello, curvatura, rifrazione —
// con una differenza sola, e sta nel limite vicino. Quella funzione tosa la
// distanza a cinquanta metri, che per un campione del modello del suolo è la
// scelta giusta (sotto quella misura non c'è nessun dato) ma per l'acqua è
// una bugia: l'acqua **ce l'hai davvero sotto i piedi**, e tosandola a
// cinquanta metri la riva vicina di un lago in cui si sta finirebbe disegnata
// a due gradi sotto l'orizzonte con sotto di lei del prato. Qui si tosa
// perciò l'**angolo** e non la distanza: la geometria resta esatta fino a
// pochi centimetri e a fermare l'asintoto è `ACQUE_DEP_MAX_GRADI`.
function acqueDepressione(quota, occhio, m) {
  const s = Math.max(0.05, m);
  const abbassa = (1 - TERRENO_RIFRAZIONE) * s * s / (2 * TERRENO_RAGGIO_KM * 1000);
  const a = Math.atan2(quota - occhio - abbassa, s) * 180 / Math.PI;
  return Math.max(-ACQUE_DEP_MAX_GRADI, Math.min(ACQUE_DEP_MAX_GRADI, a));
}

// A che quota sta la superficie su cui si sta, quando ci si sta dentro.
//
// Il modello del suolo spiana gli specchi d'acqua, quindi la risposta è già
// nei campioni: è la **più bassa** delle quote dell'anello più vicino. Il
// minimo e non la mediana, e non è pignoleria — con un laghetto più stretto
// del passo della griglia (centocinquanta metri) mezzo anello pesca già sulla
// riva, e la mediana darebbe la costa invece dell'acqua. La cosa più bassa
// che c'è lì attorno, quella, è l'acqua per definizione.
//
// Se la quota misurata nel punto esatto è più bassa ancora, vince lei: è la
// stessa superficie, misurata meglio.
//
// Ma «il più basso dell'anello» va chiesto ai campioni che stanno **davvero
// sull'acqua in cui si sta**, non a tutti. Su un anello di centocinquanta
// metri ci può cascare un fosso, uno scavo, il fondo di una valletta accanto:
// tutta roba più bassa dell'acqua, e presa per la superficie manda l'occhio
// sotto il livello del lago — che è lo stesso errore di prima col segno
// girato. Quali campioni sono acqua nostra lo dicono le bande: la prima banda
// di una direzione, quando comincia **ai piedi**, è lo specchio in cui si sta,
// e i campioni che ci cadono dentro sono la sua superficie.
//
// Quando nessun campione ci casca — un laghetto o un fiume più stretti del
// primo anello — si torna al minimo dell'anello, che è comunque un limite
// superiore onesto (la riva sta sopra l'acqua, non sotto). Quel caso si
// aggiusta da sé: la quota resta segnata come stimata, `terrenoDaCompletare`
// la richiede, e quando la misura del punto arriva vince lei.
function acqueQuotaSuperficie() {
  const nd = TERRENO_DISTANZE.length;
  let acquaMin = null, anelloMin = null;
  if (terreno.quote) {
    for (let i = 0; i < TERRENO_DIREZIONI; i++) {
      const q0 = terreno.quote[i * nd];
      if (typeof q0 === 'number' && (anelloMin === null || q0 < anelloMin)) anelloMin = q0;
      // Fin dove arriva, in questa direzione, l'acqua che comincia ai piedi.
      const banda = acque.bande
        ? acque.bande[Math.round(i * TERRENO_PASSO_AZ / ACQUE_PASSO_AZ) % ACQUE_DIREZIONI] : null;
      if (!banda || !banda.length || banda[0][0] > 0) continue;
      const fin = banda[0][1];
      for (let k = 0; k < nd; k++) {
        if (TERRENO_DISTANZE[k] * 1000 > fin) break;
        const q = terreno.quote[i * nd + k];
        if (typeof q === 'number' && (acquaMin === null || q < acquaMin)) acquaMin = q;
      }
    }
  }
  let minimo = acquaMin !== null ? acquaMin : anelloMin;
  if (typeof terreno.quota === 'number' && !terreno.quotaStimata) {
    minimo = minimo === null ? terreno.quota : Math.min(minimo, terreno.quota);
  }
  return minimo;
}

// Guardando dall'acqua, l'occhio sta sulla superficie e non sul suolo.
//
// Sembra la stessa cosa e non lo è. La quota di casa arriva da un punto solo,
// e quando quel punto non arriva la si ricava dalla mediana dell'anello a
// centocinquanta metri (`terrenoQuotaDaVicino`): in mezzo a un lago quella
// mediana è la **riva**, cioè decine di metri più in alto dell'acqua su cui
// si sta. Da lì in poi ogni angolo è sbagliato dello stesso termine: l'acqua
// risulta in una fossa, la sua prospettiva si comprime dove non dovrebbe, e
// il terreno attorno sembra un anfiteatro. Forzare la quota alla superficie
// annulla il dislivello finto in un colpo, ed è **la** cosa che si sa per
// certo di chi guarda dall'acqua: che sta esattamente al suo livello.
//
// Non fa niente quando non c'è niente da fare — che è quasi sempre — e non
// fa niente due volte: la seconda chiamata trova lo scarto già a zero.
function acqueAllineaOcchio() {
  if (!acque.sommerso) return false;
  if (!terreno.quote || !terrenoDisponibile()) return false;
  const superficie = acqueQuotaSuperficie();
  if (superficie === null) return false;
  acque.quotaSommerso = superficie;
  if (typeof terreno.quota === 'number' && Math.abs(terreno.quota - superficie) < 0.5) return false;
  return terrenoRimontaConQuota(superficie, 'acqua');
}

// A che quota sta il suolo in quella direzione, a quella distanza. Si legge
// dalla griglia grezza del §4, e per un tratto d'acqua si prende il
// **minimo** dei campioni che ci cascano dentro: l'acqua è la cosa più
// bassa che ci sia lì attorno, e un campione che pesca sulla riva darebbe
// il lago qualche metro più in alto di dov'è — che a due chilometri vuol
// dire un decimo di grado, cioè qualche pixel di troppo.
// Quanto sale il terreno **davanti** a un punto, senza tosare a zero.
//
// `terrenoCrestaDavanti` non va bene qui, e per una ragione che costa mezz'ora
// a capire: quella funzione risponde a «quanto **copre** il terreno», e
// coprire meno di niente non vuol dire niente, quindi tosa a zero. Ma
// l'acqua sta sotto la linea dell'orizzonte, cioè a un angolo negativo:
// confrontata con uno zero risulterebbe nascosta **sempre**, e di laghi non
// se ne vedrebbe mai nessuno. Serve la cresta grezza, quella che scende
// sotto lo zero dove il terreno sta più in basso dell'occhio — la stessa che
// disegna la conca davanti a chi guarda da una cima.
let acqueFrontiScratch = null;

function acqueCrestaGrezza(az, km) {
  const n = TERRENO_DISTANZE.length;
  if (!acqueFrontiScratch) acqueFrontiScratch = new Float32Array(n);
  const v = terrenoFrontiA(az, acqueFrontiScratch);
  if (!v) return null;
  const limite = km * TERRENO_FRONTE_MARGINE;
  let k = -1;
  for (let j = 0; j < n; j++) if (TERRENO_DISTANZE[j] <= limite) k = j;
  // La riga è un massimo accumulato, quindi l'ultimo campione che ci sta
  // dentro **è** il massimo: non serve girarli tutti.
  return k < 0 ? null : v[k];
}

function acqueQuotaDi(az, vicinoM, lontanoM) {
  if (!terreno.quote) return null;
  const nd = TERRENO_DISTANZE.length;
  const dove = (((az % 360) + 360) % 360) / TERRENO_PASSO_AZ;
  const i = Math.floor(dove) % TERRENO_DIREZIONI;
  const j = (i + 1) % TERRENO_DIREZIONI;
  const t = dove - Math.floor(dove);

  let minimo = null;
  // I due campioni che **abbracciano** lo specchio: l'ultimo prima della riva
  // vicina e il primo dopo quella lontana.
  let prima = null, dopo = null;
  for (let k = 0; k < nd; k++) {
    const m = TERRENO_DISTANZE[k] * 1000;
    const qa = terreno.quote[i * nd + k], qb = terreno.quote[j * nd + k];
    if (typeof qa !== 'number' || typeof qb !== 'number') continue;
    const q = qa + (qb - qa) * t;
    if (m >= vicinoM && m <= lontanoM) {
      if (minimo === null || q < minimo) minimo = q;
    } else if (m < vicinoM) {
      prima = q;
    } else if (dopo === null) {
      dopo = q;
    }
  }
  if (minimo !== null) return minimo;

  // Nessun campione dentro allo specchio: capita a tutti i fiumi e a ogni
  // laghetto, che sono più stretti dei centocinquanta metri della griglia — e
  // capita **sempre** allo specchio che si ha davanti alle scarpe, che è
  // tutto dentro al primo anello.
  //
  // Qui prima si prendeva il campione più vicino, ed è la riga per cui un
  // fiume a quaranta metri non si disegnava. Quel campione non è sull'acqua:
  // è la riva di là, il terrapieno, il primo pezzo di collina — e su una riva
  // che sale sta **sopra** l'occhio. Da lì la banda veniva scartata come
  // «acqua più in alto di chi guarda», che è il modo peggiore di sbagliare:
  // il difetto non lascia traccia, semplicemente l'acqua non c'è.
  //
  // Di vero, di uno specchio d'acqua, si sa una cosa sola: che è la cosa più
  // bassa che ci sia lì attorno. Quindi il ripiego è il **minimo** dei due
  // campioni che lo abbracciano — non quello che gli capita più vicino — e,
  // per l'acqua che comincia dentro al primo anello, anche il suolo sotto i
  // piedi: un fiume che si guarda dalla sua sponda non può essere più in alto
  // della sponda, se no ci scorrerebbe addosso.
  let ripiego = null;
  const conta = q => {
    if (typeof q === 'number' && (ripiego === null || q < ripiego)) ripiego = q;
  };
  conta(prima);
  conta(dopo);
  if (vicinoM < TERRENO_DISTANZE[0] * 1000 && typeof terreno.quota === 'number') {
    conta(terreno.quota);
  }
  return ripiego;
}

// Gli specchi d'acqua che da qui si vedono davvero, con l'angolo sotto cui
// si vedono. Tre cernite, e sono tutte necessarie:
//
//   1. **sotto la linea dell'orizzonte**: uno specchio d'acqua più in alto
//      dell'occhio non mostra la sua superficie, mostra la riva di taglio —
//      e disegnarlo vorrebbe dire mettere del blu sopra l'orizzonte;
//   2. **davanti alla cresta**: un lago dietro a una collina non si vede, ed
//      è il caso normale, non l'eccezione. Ma se ne perde solo il pezzo che
//      il terreno copre davvero — guardando oltre un crinale si vede la metà
//      lontana e non la riva di qua, e stando su una riva si vede l'acqua qui
//      davanti e non quella oltre il promontorio: sono lo stesso conto, e per
//      questo si tengono **tutti** i tratti scoperti e non uno;
//   3. **dentro al raggio chiesto**, che può essere sceso nel frattempo.
//
// Il risultato si tiene finché non cambia il terreno o l'altezza da cui si
// guarda: è la stessa memoria di comodo di `cimeVisibili`.
function acqueVisibili() {
  if (!acque.acceso || acque.stato !== 'pronto' || !acque.bande) return null;
  if (!terrenoDisponibile()) return null;

  const occhio = (typeof terreno.quota === 'number' ? terreno.quota : 0) + TERRENO_ALTEZZA_OCCHIO_M;
  const chiave = `${occhio.toFixed(1)}|${terreno.quando}|${raggioAcque()}`;
  if (acque.vista && acque.vistaChiave === chiave) return acque.vista;

  const limite = raggioAcque() * 1000;
  const fuori = new Array(ACQUE_DIREZIONI).fill(null);
  for (let b = 0; b < ACQUE_DIREZIONI; b++) {
    const lista = acque.bande[b];
    if (!lista) continue;
    const az = b * ACQUE_PASSO_AZ;
    const tenute = [];
    for (const [vicino, lontano, tipo, nome] of lista) {
      if (vicino > limite) continue;
      const fine = Math.min(lontano, limite);
      if (!(fine > vicino)) continue;
      // La quota della superficie. Una banda che comincia **ai piedi** non la
      // va a chiedere alla griglia: la si sa già. Se ci si sta dentro è la
      // superficie su cui si galleggia (`acqueAllineaOcchio` l'ha già messa
      // anche in `terreno.quota`); se no — un fiume che passa sotto il ponte,
      // la riva su cui si sta — è il suolo sotto le scarpe.
      //
      // Chiederla comunque alla griglia è il modo di sbagliarla, ed era il
      // guasto: uno specchio d'acqua più stretto del passo della griglia non
      // ha nessun campione dentro di sé, e il ripiego pescava sulla riva. Con
      // una riva che sale quel numero sta **sopra** l'occhio, e l'acqua veniva
      // scartata come «sopra l'orizzonte» — cioè spariva senza lasciare
      // traccia.
      const suPiedi = vicino <= 0.5;
      const quota = suPiedi && typeof terreno.quota === 'number'
        ? terreno.quota : acqueQuotaDi(az, vicino, fine);
      if (quota === null) continue;

      // L'acqua si allontana verso l'orizzonte, quindi l'angolo cresce (si
      // avvicina a zero) con la distanza: la riva vicina è il punto più in
      // basso e quella lontana il più in alto. La cresta che sta davanti,
      // invece, non fa che salire.
      const dep = m => acqueDepressione(quota, occhio, m);
      const altoFine = dep(fine);
      if (!(altoFine < -0.02)) continue;      // sopra l'occhio: non è superficie

      // Dove il terreno davanti la copre, e dove no.
      //
      // Prima si camminava dalla riva lontana verso quella vicina fermandosi
      // al primo punto coperto, e si teneva quello che restava. È il caso
      // normale — il lago in una conca, di cui si vede la metà lontana — ma è
      // **solo** quel caso: se a essere coperta era la riva lontana, il primo
      // passo trovava terreno e la banda intera se ne andava. Sulla carta non
      // capita (la cresta sale, l'acqua sale), nei numeri sì, e proprio da
      // vicino: un promontorio a metà lago, il dosso oltre l'ansa del fiume,
      // e in genere qualunque conca guardata da dentro, dove i primi metri
      // d'acqua stanno sotto di noi di parecchi gradi e la riva di là è a
      // filo d'orizzonte. Il risultato era che l'acqua ai piedi spariva per
      // colpa di qualcosa che le sta **dietro**.
      //
      // Adesso la striscia si campiona e si tengono **tutti** i tratti
      // scoperti, non uno: un lago diviso in due da un promontorio sono due
      // strisce, che è quello che si vede davvero. Il campionamento è più
      // fitto di prima perché adesso conta anche dove i tratti cominciano.
      const passi = ACQUE_OCCLUSIONE_PASSI;
      let daM = null, aM = null;
      const chiudi = () => {
        if (daM === null) return;
        const inizio = daM, finePezzo = aM;
        daM = aM = null;
        // Un metro di striscia non è una striscia. Ma se comincia ai piedi la
        // misura non è più la sua lunghezza: è tutto il pezzo di schermo sotto
        // l'orizzonte, e va disegnato.
        if (!(finePezzo > inizio + 1) && !(inizio <= 0.5 && finePezzo > 0.5)) return;
        tenute.push({
          vicino: inizio, lontano: finePezzo, tipo, nome,
          depVicino: dep(inizio), depLontano: dep(finePezzo), quota,
          // Se la riva vicina è stata **tagliata** dal terreno o è la riva
          // vera. Le due si disegnano diverse, ed è la differenza fra un lago
          // che sta in una conca e un lago incollato sopra al prato: un bordo
          // tagliato va portato giù fino alla cresta *disegnata* (il rilievo
          // fine morde e non aggiunge, quindi la sagoma dipinta sta più in
          // basso del numero del modello), una riva vera è dove è.
          tagliata: inizio > vicino + 1
        });
      };
      for (let p = 0; p <= passi; p++) {
        const m = vicino + (fine - vicino) * (p / passi);
        const davanti = acqueCrestaGrezza(az, m / 1000);
        // Il margine è quello che tiene fermo il bordo: senza, alla riva
        // vicina l'acqua e il terreno che le sta davanti hanno lo stesso
        // angolo (il modello del suolo spiana i laghi) e il confronto lo
        // decide l'arrotondamento.
        const coperta = davanti !== null &&
                        davanti > dep(m) + ACQUE_OCCLUSIONE_MARGINE_GRADI;
        if (coperta) { chiudi(); continue; }
        if (daM === null) daM = m;
        aM = m;
      }
      chiudi();
    }
    if (tenute.length) fuori[b] = tenute;
  }

  acque.vista = fuori;
  acque.vistaChiave = chiave;
  return fuori;
}

// Gli specchi d'acqua da **nominare**, uno per nome, con dove appendere
// l'etichetta.
//
// Il nome di un lago non si appende dove si appende quello di una montagna,
// e non è una scelta di gusto: una vetta è un punto — la punta — mentre un
// lago è una **superficie**, e le carte geografiche il nome di uno specchio
// d'acqua lo scrivono da sempre *dentro* allo specchio, non accanto. Quindi
// qui non serve un punto e basta: serve sapere dove l'acqua è **larga**, per
// poterci scrivere sopra.
//
// Uno stesso lago arriva qui a pezzi: settecentoventi direzioni, ognuna con
// la sua banda, e in mezzo i tagli dell'occlusione. Si rimettono insieme per
// nome, e di ognuno si tiene:
//
//   * `az` — la direzione **centrale**, che si trova con la media circolare
//     (somma dei seni e dei coseni) e non con un minimo e un massimo: un lago
//     a cavallo del nord ha direzioni a 359° e a 1°, e la media aritmetica le
//     mette a sud;
//   * `alt` — l'altezza a cui scrivere, che è **in mezzo** alla banda e non
//     su una riva: scritta sulla riva vicina l'etichetta finisce sul bordo
//     di sotto dello specchio, cioè metà dentro e metà sul prato;
//   * `largo` — quanti gradi d'orizzonte occupa, e `alto` quanti ne occupa la
//     banda al centro: sono le due misure che dicono se un nome ci sta.
//
// Le direzioni si guardano una ogni `ACQUE_ETICHETTA_PASSO`: per una misura
// che poi si arrotonda a un grado, leggerle tutte e settecentoventi è
// lavoro buttato — e questa gira a ogni fotogramma.
const ACQUE_ETICHETTA_PASSO = 3;

// Sotto questa larghezza apparente uno specchio non si nomina: è un
// laghetto di tre direzioni, e il suo nome coprirebbe sé stesso e i vicini.
const ACQUE_ETICHETTA_MIN_GRADI = 0.8;

function acqueDaDisegnare() {
  const viste = acqueVisibili();
  if (!viste) return [];

  const per = new Map();
  for (let b = 0; b < ACQUE_DIREZIONI; b += ACQUE_ETICHETTA_PASSO) {
    const lista = viste[b];
    if (!lista) continue;
    const az = b * ACQUE_PASSO_AZ;
    const a = az * Math.PI / 180;
    const sen = Math.sin(a), cos = Math.cos(a);
    for (const v of lista) {
      if (!v.nome) continue;
      let s = per.get(v.nome);
      if (!s) {
        s = { nome: v.nome, tipo: v.tipo, sen: 0, cos: 0, peso: 0, quante: 0, dir: [] };
        per.set(v.nome, s);
      }
      // La media circolare è pesata sulla **larghezza** della banda: il
      // centro di un lago è dove il lago è largo, non dove la sua punta
      // sfiora un'altra direzione.
      const largo = Math.max(1, v.lontano - v.vicino);
      s.sen += sen * largo;
      s.cos += cos * largo;
      s.peso += largo;
      s.quante++;
      s.dir.push({ az, v });
    }
  }

  const fuori = [];
  per.forEach(s => {
    if (!s.quante) return;
    let az = Math.atan2(s.sen, s.cos) * 180 / Math.PI;
    if (az < 0) az += 360;
    // La banda che si scriverà è quella della direzione **più vicina al
    // centro**, non la più larga di tutte: il nome deve stare dove uno
    // guarda quando guarda quel lago.
    let scelta = null, scartoMin = Infinity;
    for (const d of s.dir) {
      const scarto = Math.abs(((d.az - az) % 360 + 540) % 360 - 180);
      if (scarto < scartoMin) { scartoMin = scarto; scelta = d; }
    }
    if (!scelta) return;
    const largo = s.quante * ACQUE_ETICHETTA_PASSO * ACQUE_PASSO_AZ;
    if (largo < ACQUE_ETICHETTA_MIN_GRADI) return;
    const v = scelta.v;
    fuori.push({
      nome: s.nome,
      tipo: s.tipo,
      az: scelta.az,
      // In mezzo alla banda, non su una riva.
      alt: (v.depVicino + v.depLontano) / 2,
      altoGradi: Math.abs(v.depVicino - v.depLontano),
      largoGradi: largo,
      quota: v.quota,
      km: (v.vicino + v.lontano) / 2000
    });
  });

  // Il più largo per primo: quando il posto è poco, a vincere dev'essere il
  // lago che si sta guardando, non quello che capita prima nell'elenco.
  fuori.sort((a, b) => b.largoGradi - a.largoGradi);
  return fuori;
}

// Che acqua c'è in quella direzione, pronta da disegnare. `null` quando non
// ce n'è: è la domanda che il planetario fa per ogni colonna dello schermo,
// e deve costare quanto una lettura di array.
function acqueA(az) {
  const v = acqueVisibili();
  if (!v) return null;
  const i = Math.round((((az % 360) + 360) % 360) / ACQUE_PASSO_AZ) % ACQUE_DIREZIONI;
  return v[i];
}

// C'è dell'acqua interna, da qualche parte qui attorno?
function acqueCiSono() {
  return !!(acque.acceso && acque.stato === 'pronto' && acque.quanti > 0);
}

function acqueAlterna() {
  acque.acceso = !acque.acceso;
  raggi.acqueAccese = acque.acceso;
  raggiSalva();
  if (acque.acceso && acque.stato !== 'pronto') acqueCarica();
  acqueAggiornaTasto();
  terrenoAggiornaPannello();
}

function acqueTesto() {
  if (!acque.acceso) return 'Laghi e fiumi spenti.';
  if (acque.stato === 'in-corso') return 'Sto cercando laghi e fiumi qui attorno…';
  if (acque.stato === 'fallito') {
    return `Laghi e fiumi: ${acque.motivo}. L'orizzonte resta quello di prima.`;
  }
  if (acque.stato !== 'pronto') return '';
  if (!acque.quanti) return `Nessun lago né fiume entro ${raggioAcque()} km.`;
  const viste = acqueVisibili();
  if (!viste) {
    return terrenoInArrivo()
      ? 'Ho trovato dell\'acqua qui attorno: aspetto la forma del terreno per sapere quale se ne vede.'
      : '';
  }
  let direzioni = 0;
  for (const v of viste) if (v) direzioni++;
  if (!direzioni) {
    return `L'acqua qui attorno c'è, ma resta tutta dietro alle creste: da qui non se ne vede.`;
  }
  const nomi = acque.nomi.length ? ` (${acque.nomi.join(', ')})` : '';
  return `Si vede dell'acqua in ${Math.round(direzioni * ACQUE_PASSO_AZ)}° di orizzonte${nomi}.`;
}

function acqueAggiornaTasto() {
  const tasto = document.getElementById('skymap-btn-acque');
  if (!tasto) return;
  tasto.classList.toggle('attiva', acque.acceso);
  tasto.setAttribute('aria-pressed', acque.acceso ? 'true' : 'false');
  tasto.textContent = acque.stato === 'in-corso' ? 'Laghi e fiumi…' : 'Laghi e fiumi';
}
