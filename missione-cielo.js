// =====================================================================
// MISSIONE CIELO — la serata come percorso, non come elenco
//
// La dashboard sa già dire *cosa* vale la pena guardare stanotte: i
// migliori bersagli, ordinati per merito, ognuno con la sua riga di
// motivi. È la risposta giusta a «cosa c'è», e non è la risposta a
// un'altra domanda che uno si fa in cortile con la giacca addosso:
// **ho venti minuti, da dove comincio?**
//
// Un elenco non risponde perché non ha un ordine di esecuzione. Dice che
// M13 vale 82 e Giove 79, e lascia a chi legge tre lavori: scegliere,
// mettere in fila e trovare. Il primo si fa male al buio, il secondo non
// si fa affatto, il terzo è quello che fa rientrare in casa.
//
// Qui c'è la stessa materia prima — le stesse funzioni di `pianifica.js`,
// gli stessi conti — impaginata come una **sequenza**: tre domande in
// entrata (quanto tempo, con cosa, che serata vuoi), da tre a sei tappe
// in uscita, una per volta, ognuna con l'ora, la direzione, un
// riferimento da cui partire e un aiuto che si allarga se non si trova.
//
// Le tre cose che questo file non fa, e sono scelte:
//
//   NON RICALCOLA NIENTE. Le posizioni, il buio, la Luna, le nuvole e il
//   terreno li sanno già `app.js`, `pianifica.js`, `meteo-astro.js` e
//   `terreno.js`. Qui si sceglie e si ordina, e basta: una seconda
//   effemeride sarebbe una seconda verità da tenere d'accordo con la
//   prima.
//
//   NON PROMETTE QUELLO CHE NON SA. Senza posizione non si genera niente
//   e lo si dice; senza meteo la missione si fa lo stesso e lo dichiara;
//   senza terreno gli ostacoli sono solo quelli dichiarati a mano. Una
//   missione che finge di sapere manda qualcuno a cercare una galassia
//   dietro a un condominio.
//
//   NON COLPEVOLIZZA. «Non lo trovo» non è un errore da segnare: è
//   l'inizio di tre gradini di aiuto, e il terzo rivela e centra il
//   bersaglio. Il diario registra *trovato / saltato / non trovato*, che
//   sono tre fatti, non tre voti.
//
// Ordine di caricamento: dopo app.js, catalogo.js, corpi-minori.js,
// pianifica.js, terreno.js, meteo-astro.js ed eventi-extra.js; prima di
// ui-nuova.js, che ne disegna la scheda dentro a Stasera.
// =====================================================================


// =====================================================================
// 1. LE TRE DOMANDE, E COSA SI RICORDA
//
//     Tre e non sette. Ogni domanda in più è una persona in meno che
//     arriva in fondo, e le altre quattro che verrebbero in mente — il
//     livello, la latitudine, il tipo di oggetti preferiti, la pazienza —
//     si deducono tutte da queste tre o non cambiano il risultato.
//
//     In particolare **non si chiede il livello**: «principiante o
//     esperto» è una domanda a cui nessuno risponde onestamente, e la
//     risposta utile è già dentro a «che esperienza vuoi». Chi sceglie
//     «Fammi una sfida» ha detto di essere esperto senza doverlo
//     dichiarare.
// =====================================================================

const MISS_VERSIONE = 11;
const CHIAVE_MISS_STORIA = 'astrocalendario_missione_storia';

const CHIAVE_MISS_SCELTE = 'astrocalendario_missione_scelte';
const CHIAVE_MISS_ATTIVA = 'astrocalendario_missione_attiva';

// Dodici ore coprono anche la notte astronomica piu' lunga alle latitudini
// per cui il planetario prepara una normale serata. Nell'interfaccia non e'
// presentato come un numero: e' l'opzione «tutta la notte».
const MISS_DURATE = [10, 30, 60, 120, 180, 240, 720];
const MISS_STRUMENTI = ['occhio', 'binocolo', 'telescopio'];
const MISS_BORTLE = [2, 3, 4, 5, 6, 8];

/* I tre gradini della caccia.
 *
 * Non sono tre etichette di comodo: cambiano insieme **cosa** si va a
 * cercare e **quanto** viene detto prima di cercarlo, che sono le due
 * manopole vere di un gioco di ricerca.
 *
 *   bambini  — bersagli che non si possono sbagliare, enigma in rima
 *              semplice e subito dopo il segno da cercare a occhio.
 *   curiosi  — l'enigma e il segno insieme: chi legge sa cosa sta
 *              cercando, e deve solo trovare dove.
 *   sfida    — il solo enigma. Il segno arriva col primo indizio, e
 *              questo è tutto il gioco: chi indovina subito si è
 *              guadagnato una tappa senza aiuti.
 *
 * La differenza fra i tre non sta quindi in un moltiplicatore, ma in
 * quante delle tre cose che si sanno di un bersaglio — cos'è, com'è
 * fatto, dov'è — si consegnano prima della prima occhiata. */
const MISS_ESPERIENZE = ['bambini', 'curiosi', 'sfida'];

// Quanto si racconta prima che si cominci a cercare. `enigma` c'è
// sempre; `segno` è il dettaglio osservabile (il colore, la sagoma, la
// disposizione) e `aiutoSubito` è la direzione data senza chiederla.
const MISS_GENEROSITA = {
  bambini: { segno: true,  aiutoSubito: true },
  curiosi: { segno: true,  aiutoSubito: false },
  sfida:   { segno: false, aiutoSubito: false }
};

const MISS_DIREZIONI = [0, 45, 90, 135, 180, 225, 270, 315];

/* Che roba si va a cercare.
 *
 * È la domanda che mancava, e la sua assenza si vedeva: chi aveva in
 * mano un telescopio e voleva una serata di galassie si ritrovava la
 * Luna, Giove e due costellazioni, perché il punteggio premia
 * giustamente quello che si trova più facilmente. Un punteggio non è un
 * filtro, e le preferenze di chi guarda non sono un pareggio da
 * arbitrare: se uno dice «stasera niente pianeti», i pianeti non ci
 * vanno.
 *
 * I cinque generi sono le cinque cose che una persona nomina guardando
 * in su, e non le famiglie del catalogo: la Luna e le comete stanno coi
 * pianeti perché sono «roba del Sistema Solare», nebulose e ammassi
 * stanno con le galassie perché sono «le macchie deboli», e le stazioni
 * spaziali hanno un genere loro perché sono l'unica cosa lassù che
 * abbiamo costruito noi — ed è esattamente il motivo per cui a un
 * bambino interessano più di una galassia.
 *
 * `tipi` è il ponte col resto del file: i tipi veri dei candidati, che
 * restano quelli di sempre. */
const MISS_GENERI = [
  { valore: 'pianeti',       icona: 'saturno',       tipi: ['luna', 'pianeta', 'corpoMinore'] },
  { valore: 'stelle',        icona: 'stella',        tipi: ['stella'] },
  { valore: 'profondo',      icona: 'nebulosa',      tipi: ['profondo'] },
  { valore: 'costellazioni', icona: 'costellazione', tipi: ['costellazione'] },
  { valore: 'artificiali',   icona: 'satellite',     tipi: ['stazione'] }
];

// Dal tipo di un candidato al genere che lo contiene, una volta sola.
const MISS_GENERE_DI_TIPO = MISS_GENERI.reduce((m, g) => {
  g.tipi.forEach(t => { m[t] = g.valore; });
  return m;
}, {});

const MISS_GENERI_TUTTI = MISS_GENERI.map(g => g.valore);

/* Missione Cielo prepara sempre tutto quello che il cielo consente.
 * `scelte` resta nell'argomento soltanto per compatibilità con le missioni
 * salvate e con il motore esportato: le vecchie preferenze per genere non
 * devono più restringere il catalogo. */
function missGeneriScelti(scelte) {
  return MISS_GENERI_TUTTI.slice();
}

/* Un candidato è di un genere che è stato chiesto?
 *
 * Gli eventi del calendario non hanno un genere proprio — un'occultazione
 * è un pianeta, una congiunzione sono due — e passano sempre: sono
 * appuntamenti, cioè la ragione per cui una missione è una serata invece
 * di una lista, e filtrarli via per tipo vorrebbe dire buttare
 * l'informazione insieme al filtro. */
function missGenereAmmesso(c, scelte) {
  if (!c) return false;
  return true;
}

/* Le voci, scelte qui e non lasciate al ponte: così la stessa missione
 * non cambia narratore secondo il server che la serve.
 *
 * Sono **due per lingua**, e non è un lusso. Le voci Neural di prima —
 * Elsa e Aria — leggono benissimo e leggono e basta: sono tarate per un
 * assistente vocale, cioè per non avere un'opinione. Qui il narratore ha
 * un mestiere diverso, che è raccontare: un enigma va detto piano e con
 * una pausa prima della risposta, una scoperta va detta con l'entusiasmo
 * che uno ha davvero quando trova M13 la prima volta, e a un bambino va
 * detta un'altra cosa ancora.
 *
 * `espressiva` è la voce che accetta gli **stili** (`mstts:express-as`):
 * per l'italiano è Isabella, per l'inglese Jenny, e sono le due voci di
 * Edge che li supportano davvero — chiedere uno stile a una voce che non
 * lo ha non è un errore, è un risultato identico a prima, che è il modo
 * peggiore di non funzionare. `stabile` è il ripiego per un ponte che lo
 * SSML non lo prende: si perde lo stile e resta una lettura buona.
 *
 * `stili` dichiara quali stili quella voce conosce davvero, così
 * `missStileVoce` non ne chiede uno inventato. */
const MISS_VOCI_EDGE = {
  it: {
    espressiva: 'it-IT-IsabellaNeural',
    stabile: 'it-IT-ElsaNeural',
    stili: ['cheerful', 'sad', 'angry', 'chat', 'excited', 'friendly', 'shouting', 'unfriendly', 'whispering', 'terrified']
  },
  en: {
    espressiva: 'en-US-JennyNeural',
    stabile: 'en-US-AriaNeural',
    stili: ['cheerful', 'sad', 'angry', 'assistant', 'chat', 'customerservice', 'excited', 'friendly',
      'hopeful', 'newscast', 'shouting', 'terrified', 'unfriendly', 'whispering']
  }
};

/* Come si dice una cosa, secondo chi ascolta e cosa sta succedendo.
 *
 * Tre righe di tabella, e ognuna risponde a un momento diverso della
 * caccia. **L'enigma** va detto lento: è un indovinello, e chi lo ascolta
 * deve avere il tempo di pensarci — un indovinello letto alla velocità di
 * una previsione del tempo non è un indovinello. **La scoperta** va detta
 * su di giri, ed è l'unico momento in cui il narratore ha diritto di
 * essere contento: è il premio di tutta la tappa, e letto in tono
 * neutrale suona come la lettura di una targa in un museo. **La
 * soluzione** invece va detta piano e senza enfasi: chi ci arriva si è
 * appena arreso, e festeggiare lì è la cosa sbagliata da fare.
 *
 * Coi bambini tutto sale di un gradino — più veloce, più acuto, più
 * entusiasta — perché è così che si racconta a un bambino, e perché a
 * loro l'enigma non è una prova di pazienza ma un gioco. Il tono resta
 * `friendly` e non `excited` sull'enigma: un adulto che urla un
 * indovinello a un bambino gli toglie la voglia di rispondere.
 *
 * Le righe adesso sono **cinque**: la quinta è il **premio** di fine
 * serata (§7-bis), ed è `cheerful` e non `excited` di proposito — la
 * scoperta è un colpo di scena e si grida, una coppa è una cosa che si
 * consegna, e consegnarla urlando la fa sembrare una presa in giro.
 *
 * E la scoperta è salita parecchio (1,35 → 1,7, e 2 coi bambini), perché
 * misurata sul ponte vero a un grado e mezzo `excited` suona come un
 * «ottimo» cortese. Lo styledegree di Azure arriva a 2: quando l'unica
 * cosa da dire è «l'hai trovato», tenersi a metà scala è sprecare la sola
 * riga della serata che possa permettersi di esagerare. */
const MISS_TONI_VOCE = {
  curiosi: {
    enigma:    { stile: 'friendly', grado: '1',    ritmo: '-9%',  tono: '-2Hz' },
    indizio:   { stile: 'friendly', grado: '1',    ritmo: '-5%',  tono: '+0Hz' },
    soluzione: { stile: 'chat',     grado: '0.8',  ritmo: '-7%',  tono: '-3Hz' },
    scoperta:  { stile: 'excited',  grado: '1.7',  ritmo: '+7%',  tono: '+11Hz' },
    premio:    { stile: 'cheerful', grado: '1.6',  ritmo: '+4%',  tono: '+9Hz' }
  },
  bambini: {
    enigma:    { stile: 'friendly', grado: '1.4',  ritmo: '-2%',  tono: '+9Hz' },
    indizio:   { stile: 'cheerful', grado: '1.3',  ritmo: '+2%',  tono: '+10Hz' },
    soluzione: { stile: 'friendly', grado: '1.1',  ritmo: '-2%',  tono: '+6Hz' },
    scoperta:  { stile: 'excited',  grado: '2',    ritmo: '+12%', tono: '+18Hz' },
    premio:    { stile: 'cheerful', grado: '1.9',  ritmo: '+9%',  tono: '+16Hz' }
  },
  sfida: {
    enigma:    { stile: 'chat',     grado: '0.9',  ritmo: '-11%', tono: '-4Hz' },
    indizio:   { stile: 'chat',     grado: '0.9',  ritmo: '-7%',  tono: '-2Hz' },
    soluzione: { stile: 'chat',     grado: '0.8',  ritmo: '-9%',  tono: '-4Hz' },
    scoperta:  { stile: 'excited',  grado: '1.5',  ritmo: '+5%',  tono: '+8Hz' },
    premio:    { stile: 'cheerful', grado: '1.3',  ritmo: '+2%',  tono: '+5Hz' }
  }
};

// Il livello di ogni strumento: un bersaglio si propone solo se il suo
// minimo sta dentro a quello che si ha in mano.
const MISS_LIVELLO_STRUMENTO = { occhio: 0, binocolo: 1, telescopio: 2 };

// Quante tappe stanno in una serata. Sono due numeri e non uno: il primo
// è quello sotto cui la missione non è più un percorso, il secondo quello
// oltre cui diventa una lista della spesa. Il conto è grossolano di
// proposito — cinque minuti a tappa per i primi bersagli, di più per il
// cielo profondo — perché il tempo vero se lo prende chi guarda.
const MISS_TAPPE_PER_DURATA = {
  10:  { min: 2, max: 3 },
  30:  { min: 3, max: 4 },
  60:  { min: 4, max: 5 },
  120: { min: 5, max: 6 },
  180: { min: 6, max: 7 },
  240: { min: 7, max: 8 },
  720: { min: 8, max: 10 }
};

// Quanto in alto deve stare un bersaglio perché valga la pena mandarci
// qualcuno. Non è l'orizzonte matematico: sotto i dieci gradi c'è sempre
// qualcosa — foschia, un tetto, un albero — e chi non trova per colpa
// dell'aria crede di non saper cercare.
const MISS_ALTEZZA_MINIMA = {
  bambini: 20, curiosi: 15, sfida: 10
};

/* Fin dove si spinge ogni gradino.
 *
 * Il tetto è una promessa sul tipo di serata, non una misura di bravura:
 * coi bambini si va solo su cose che non si possono sbagliare, ai curiosi
 * si chiede di cercare, agli esperti si concede anche la nebulosa che
 * bisogna saper guardare di lato. Il cinque esiste perché il gradino più
 * alto altrimenti non avrebbe niente da dare che il secondo non desse
 * già: era il difetto di quando i gradini erano due. */
const MISS_DIFFICOLTA_MASSIMA = { bambini: 2, curiosi: 3, sfida: 5 };

/* …e da dove comincia.
 *
 * Un pavimento e non un filtro: cinque bersagli che si trovano da soli
 * sono una serata onesta per chi comincia e una delusione per chi ha
 * chiesto una sfida, ma escluderli del tutto vorrebbe dire restituire una
 * missione vuota dal balcone di città. Si penalizzano nel punteggio (§2,
 * `missPunteggio`) e basta: se non c'è altro, ci sono ancora. */
const MISS_DIFFICOLTA_GRADITA = { bambini: 1, curiosi: 1, sfida: 2 };

// Ricordiamo piu' di una sola missione: con un cielo ricco la nuova caccia
// cambia davvero cast, invece di oscillare fra gli stessi due gruppi.
const MISS_MISSIONI_DA_RICORDARE = 3;

/* Quanti indizi prima della soluzione.
 *
 * Tre, e sono tre *indizi*: la soluzione non è il quarto gradino della
 * stessa scala, è un'altra cosa — si chiede a parte, con un tasto che
 * dice cosa fa, e chi non lo preme resta a cercare. Vedi
 * `missMostraSoluzione` (§6). */
// L'introduzione e' gia' l'indizio 1. Seguono due aiuti: arrivati
// all'indizio 3 compare il comando separato «Mostra la soluzione».
const MISS_INDIZI = 2;

// La finestra di sorveglianza di un evento a orario preciso: quanto
// tempo prima lo si annuncia. Meno di così non si fa in tempo a uscire e
// a girarsi dalla parte giusta.
const MISS_PREAVVISO_MIN = 2;

// Una missione salvata scade: riprendere alle sette di sera quella di
// ieri notte vuol dire riprendere un cielo che non c'è più.
const MISS_SCADENZA_MS = 16 * 3600 * 1000;

// Quanto lontano possono stare due tappe consecutive senza che sembri di
// star girando su sé stessi. Oltre, si paga una penale di continuità.
const MISS_SALTO_COMODO_GRADI = 70;

// Le misure a braccio teso, che è l'unico goniometro che tutti hanno
// addosso. Dal più fine al più grosso: sotto il primo non si dice niente
// («è lì accanto»), sopra l'ultimo si torna ai punti cardinali.
const MISS_MISURE_A_MANO = [
  { gradi: 2,  chiave: 'missione.mano.dito' },
  { gradi: 5,  chiave: 'missione.mano.treDita' },
  { gradi: 10, chiave: 'missione.mano.pugno' },
  { gradi: 20, chiave: 'missione.mano.manoAperta' },
  { gradi: 40, chiave: 'missione.mano.duePugni' }
];

// Lo stato del modulo. Vive quanto l'app; quello che deve sopravvivere a
// una ricarica sta in `attiva` e si salva (§7).
const miss = {
  // Le tre scelte, ricordate fra una sera e l'altra
  scelte: { durata: 30, strumento: 'occhio', esperienza: 'curiosi', bortle: 2, cielo: 'tutto', cieloDa: 135, cieloA: 180,
    momento: 'consigliato', momentoPersonalizzato: null, voce: false },
  // La missione appena generata e non ancora avviata
  anteprima: null,
  /* Le anteprime già viste in questa sessione di configurazione, la più
   * recente per prima, al massimo `MISS_MISSIONI_DA_RICORDARE`.
   *
   * «Un'altra missione» evitava **la sola anteprima precedente**, e con
   * un cielo stretto quello non è un ricambio ma un'altalena: A, poi B
   * che evita A, poi di nuovo A perché B è l'unica cosa che si evita.
   * Premendo tre volte si vedevano due missioni. Ricordandone tre, il
   * terzo tentativo deve andare a cercare altrove per davvero; oltre le
   * tre la penale tornerebbe a pesare su tutti, cioè su nessuno (§2,
   * `missPescaPesato`: una penale uguale per tutti è una costante che
   * sparisce nell'esponenziale). Non si salva: è la memoria di questa
   * finestra aperta, e chi torna domani vuole ricominciare da capo — a
   * ricordarsi delle sere scorse c'è già `CHIAVE_MISS_STORIA`. */
  anteprimeViste: [],
  // Chi ha chiesto di vedere i nomi dei bersagli prima di cominciare:
  // vale per l'anteprima che si sta guardando e non si salva, perché
  // sbirciare è una decisione di stasera e non una preferenza.
  sbircia: false,
  // Quella in corso o conclusa e non ancora archiviata
  attiva: null,
  // Il pannello: quale dei sei stati è a schermo
  vista: 'configurazione',
  // Da dove si è aperta la bacheca, per rimetterci chi la chiude. Non si
  // salva: una bacheca aperta non è uno stato della serata.
  tornaDa: null,
  aperto: false,
  // Il messaggio in cima al pannello: {chiave, dati, tono}
  avviso: null,
  // Chi aveva il fuoco quando il pannello si è aperto, per restituirglielo
  fuocoPrima: null,
  // Il pannello richiudibile dei dettagli: aperto una volta, resta aperto
  // finché la finestra è aperta. Non si salva — è una posa di questa
  // sessione, non una preferenza.
  dettagliAperti: true,
  // Il primo estremo acquisito con la bussola, finche' si prende il secondo.
  rilievoSettore: null,
  // La guida può sparire dal cielo mentre la narrazione continua.
  strisciaNascosta: false,
  // Posizione scelta trascinando la guida, relativa al planetario.
  // Non si salva: a ogni nuova apertura il riquadro riparte in un punto
  // prevedibile, ma non salta indietro mentre cambiano indizio o tappa.
  posizioneStriscia: null,
  // Le funzioni da staccare alla chiusura (tastiera, cambio lingua)
  staccare: []
};

// Audio remoto e sintesi locale condividono un solo comando di arresto. La
// sequenza impedisce a una risposta lenta della API di parlare sopra la tappa
// successiva quando chi osserva preme rapidamente «Trovato».
const missVoce = { audio: null, urlOggetto: '', sequenza: 0 };


// =====================================================================
// 1-bis. IL REPERTORIO — chi, di tutto quello che c'è in cielo, ha una
//        storia da raccontare
//
//     Un bersaglio non vale l'altro, e la differenza non si misura in
//     magnitudini. Saturno e la galassia NGC 4526 sono tutti e due
//     «cielo profondo o pianeti visibili stanotte»: il primo lascia un
//     ricordo per vent'anni, la seconda è una macchiolina di cui non si
//     saprebbe che dire. Una missione che li tratta uguale è un elenco
//     con l'ordine mescolato.
//
//     Qui sta la tabella di chi ha un nome proprio, un enigma scritto
//     apposta e un aneddoto che dopo averlo trovato vale la pena
//     leggere. Da lei escono tre cose, in tre posti diversi:
//
//       lo **slug**   — la chiave con cui il dizionario tiene enigma,
//                       segno osservabile e aneddoti di quell'oggetto;
//       il **fascino**— quanto merita di stare in una serata, che entra
//                       nel punteggio (§2) accanto ad altezza e
//                       difficoltà;
//       la **catena di ripiego** — chi un nome proprio non ce l'ha non
//                       cade nel generico: cade nella sua *categoria*
//                       (ammasso globulare, nebulosa planetaria,
//                       galassia a spirale…), che di cose da dire ne ha
//                       parecchie e sono tutte vere.
//
//     Le tre risposte sono sempre nello stesso ordine — nome proprio,
//     categoria, famiglia — e non si salta nessun gradino: è la ragione
//     per cui centoquarantadue oggetti di catalogo hanno tutti qualcosa
//     di sensato da dire con sessanta voci scritte a mano.
// =====================================================================

/* Le voci del repertorio.
 *
 *   slug    la chiave nel dizionario (`missione.curiosita.<slug>.<n>`,
 *           `missione.gioco.enigma.oggetto.<slug>`, `…segno.<slug>`);
 *   fascino da 0 a 1: quanto quel bersaglio ripaga la fatica di
 *           cercarlo. Saturno vale uno, una galassia ellittica di ottava
 *           mezzo punto, e non è una classifica di bellezza — è la
 *           risposta a «se ne racconta ancora qualcosa domani?»;
 *   tipi    a quali famiglie di candidati la voce si applica. Serve
 *           perché «Andromeda» è due cose diverse: la figura e la
 *           galassia che ci sta dentro, e hanno due storie;
 *   sigle   per il cielo profondo è la chiave vera: il catalogo scrive
 *           «M31 — Galassia di Andromeda», e la sigla è l'unico pezzo di
 *           quel nome che non cambi con la lingua;
 *   prova   il riconoscimento per nome, che deve reggere l'italiano,
 *           l'inglese e la sigla IAU di una figura.
 */
const MISS_REPERTORIO = [
  // --- il Sistema Solare -------------------------------------------
  { slug: 'luna',      fascino: 0.95, tipi: ['luna'],    prova: /\b(luna|moon)\b/ },
  { slug: 'mercurio',  fascino: 0.66, tipi: ['pianeta'], prova: /\b(mercurio|mercury)\b/ },
  { slug: 'venere',    fascino: 0.82, tipi: ['pianeta'], prova: /\b(venere|venus)\b/ },
  { slug: 'marte',     fascino: 0.86, tipi: ['pianeta'], prova: /\b(marte|mars)\b/ },
  { slug: 'giove',     fascino: 0.96, tipi: ['pianeta'], prova: /\b(giove|jupiter)\b/ },
  { slug: 'saturno',   fascino: 1,    tipi: ['pianeta'], prova: /\b(saturno|saturn)\b/ },
  { slug: 'urano',     fascino: 0.58, tipi: ['pianeta'], prova: /\b(urano|uranus)\b/ },
  { slug: 'nettuno',   fascino: 0.56, tipi: ['pianeta'], prova: /\b(nettuno|neptune)\b/ },

  // --- le otto stelle che il planetario tiene per nome ---------------
  { slug: 'polare',     fascino: 0.88, tipi: ['stella'], prova: /\b(polare|polaris)\b/ },
  { slug: 'sirio',      fascino: 0.84, tipi: ['stella'], prova: /\b(sirio|sirius)\b/ },
  { slug: 'vega',       fascino: 0.78, tipi: ['stella'], prova: /\bvega\b/ },
  { slug: 'capella',    fascino: 0.62, tipi: ['stella'], prova: /\bcapella\b/ },
  { slug: 'arturo',     fascino: 0.72, tipi: ['stella'], prova: /\b(arturo|arcturus)\b/ },
  { slug: 'rigel',      fascino: 0.74, tipi: ['stella'], prova: /\brigel\b/ },
  { slug: 'betelgeuse', fascino: 0.88, tipi: ['stella'], prova: /\bbetelgeuse\b/ },
  { slug: 'altair',     fascino: 0.64, tipi: ['stella'], prova: /\baltair\b/ },

  // --- le figure che il planetario disegna ---------------------------
  { slug: 'orione',        fascino: 0.96, tipi: ['costellazione'], prova: /\b(orione|orion|ori)\b/ },
  { slug: 'orsa',          fascino: 0.92, tipi: ['costellazione'], prova: /(orsa maggiore|ursa major|great bear|\buma\b)/ },
  { slug: 'orsaMinore',    fascino: 0.7,  tipi: ['costellazione'], prova: /(orsa minore|ursa minor|little bear|\bumi\b)/ },
  { slug: 'cassiopea',     fascino: 0.82, tipi: ['costellazione'], prova: /\b(cassiopea|cassiopeia|cas)\b/ },
  { slug: 'cigno',         fascino: 0.84, tipi: ['costellazione'], prova: /\b(cigno|cygnus|cyg)\b/ },
  { slug: 'lira',          fascino: 0.7,  tipi: ['costellazione'], prova: /\b(lira|lyra|lyr)\b/ },
  { slug: 'aquilaFigura',  fascino: 0.62, tipi: ['costellazione'], prova: /\b(aquila|aql)\b/ },
  { slug: 'scorpione',     fascino: 0.86, tipi: ['costellazione'], prova: /\b(scorpione|scorpius|sco)\b/ },
  { slug: 'leone',         fascino: 0.74, tipi: ['costellazione'], prova: /\b(leone|leo)\b/ },
  { slug: 'toro',          fascino: 0.78, tipi: ['costellazione'], prova: /\b(toro|taurus|tau)\b/ },
  { slug: 'gemelli',       fascino: 0.68, tipi: ['costellazione'], prova: /\b(gemelli|gemini|gem)\b/ },
  { slug: 'caneMaggiore',  fascino: 0.66, tipi: ['costellazione'], prova: /(cane maggiore|canis major|\bcma\b)/ },
  { slug: 'auriga',        fascino: 0.6,  tipi: ['costellazione'], prova: /\b(auriga|aur)\b/ },
  { slug: 'perseo',        fascino: 0.72, tipi: ['costellazione'], prova: /\b(perseo|perseus|per)\b/ },
  { slug: 'andromedaFigura', fascino: 0.66, tipi: ['costellazione'], prova: /\b(andromeda|and)\b/ },
  { slug: 'pegaso',        fascino: 0.64, tipi: ['costellazione'], prova: /\b(pegaso|pegasus|peg)\b/ },
  { slug: 'boote',         fascino: 0.6,  tipi: ['costellazione'], prova: /\b(boote|bootes|boo)\b/ },
  { slug: 'coronaBoreale', fascino: 0.66, tipi: ['costellazione'], prova: /(corona boreale|corona borealis|\bcrb\b)/ },
  { slug: 'vergine',       fascino: 0.54, tipi: ['costellazione'], prova: /\b(vergine|virgo|vir)\b/ },
  { slug: 'sagittario',    fascino: 0.8,  tipi: ['costellazione'], prova: /\b(sagittario|sagittarius|sgr)\b/ },
  { slug: 'ariete',        fascino: 0.48, tipi: ['costellazione'], prova: /\b(ariete|aries|ari)\b/ },
  { slug: 'croceDelSud',   fascino: 0.9,  tipi: ['costellazione'], prova: /(croce del sud|southern cross|\bcrux\b|\bcru\b)/ },
  { slug: 'centauro',      fascino: 0.74, tipi: ['costellazione'], prova: /\b(centauro|centaurus|cen)\b/ },

  // --- il cielo profondo, per sigla di catalogo ----------------------
  { slug: 'pleiadi',         fascino: 1,    sigle: ['M45'] },
  { slug: 'iadi',            fascino: 0.72, sigle: ['Mel 25'] },
  { slug: 'presepe',         fascino: 0.74, sigle: ['M44'] },
  { slug: 'chioma',          fascino: 0.56, sigle: ['Mel 111'] },
  { slug: 'attaccapanni',    fascino: 0.66, sigle: ['Cr 399'] },
  { slug: 'andromeda',       fascino: 0.98, sigle: ['M31'] },
  { slug: 'compagneAndromeda', fascino: 0.4, sigle: ['M32', 'M110'] },
  { slug: 'triangolo',       fascino: 0.6,  sigle: ['M33'] },
  { slug: 'nebulosaOrione',  fascino: 1,    sigle: ['M42', 'M43'] },
  { slug: 'laguna',          fascino: 0.78, sigle: ['M8'] },
  { slug: 'trifida',         fascino: 0.64, sigle: ['M20'] },
  { slug: 'nebulosaAquila',  fascino: 0.72, sigle: ['M16'] },
  { slug: 'omega',           fascino: 0.68, sigle: ['M17'] },
  { slug: 'ercole',          fascino: 0.9,  sigle: ['M13'] },
  { slug: 'm92',             fascino: 0.56, sigle: ['M92'] },
  { slug: 'm22',             fascino: 0.7,  sigle: ['M22'] },
  { slug: 'm5',              fascino: 0.64, sigle: ['M5'] },
  { slug: 'm3',              fascino: 0.64, sigle: ['M3'] },
  { slug: 'm15',             fascino: 0.62, sigle: ['M15'] },
  { slug: 'm4',              fascino: 0.6,  sigle: ['M4'] },
  { slug: 'anatraSelvatica', fascino: 0.68, sigle: ['M11'] },
  { slug: 'm35',             fascino: 0.58, sigle: ['M35'] },
  { slug: 'm6',              fascino: 0.62, sigle: ['M6'] },
  { slug: 'm7',              fascino: 0.68, sigle: ['M7'] },
  { slug: 'doppioAmmasso',   fascino: 0.84, sigle: ['h Per', 'χ Per', 'NGC 869', 'NGC 884'] },
  { slug: 'bode',            fascino: 0.64, sigle: ['M81'] },
  { slug: 'sigaro',          fascino: 0.6,  sigle: ['M82'] },
  { slug: 'vortice',         fascino: 0.74, sigle: ['M51'] },
  { slug: 'girandola',       fascino: 0.5,  sigle: ['M101'] },
  { slug: 'sombrero',        fascino: 0.64, sigle: ['M104'] },
  { slug: 'anello',          fascino: 0.82, sigle: ['M57'] },
  { slug: 'manubrio',        fascino: 0.76, sigle: ['M27'] },
  { slug: 'granchio',        fascino: 0.66, sigle: ['M1'] },
  { slug: 'omegaCentauri',   fascino: 0.88, sigle: ['ω Cen'] },
  { slug: 'tucana47',        fascino: 0.8,  sigle: ['47 Tuc'] },
  { slug: 'grandeNube',      fascino: 0.92, sigle: ['LMC'] },
  { slug: 'piccolaNube',     fascino: 0.84, sigle: ['SMC'] },
  { slug: 'etaCarinae',      fascino: 0.82, sigle: ['η Car'] },
  { slug: 'nordAmerica',     fascino: 0.62, sigle: ['NGC 7000'] },
  { slug: 'centroGalattico', fascino: 0.7,  sigle: ['GalCtr'] },

  // --- e chi non è un oggetto di catalogo ----------------------------
  { slug: 'iss',       fascino: 1,    tipi: ['stazione'], prova: /\b(iss|international space station|stazione spaziale internazionale)\b/i },
  { slug: 'tiangong',  fascino: 0.92, tipi: ['stazione'], prova: /\b(tiangong|chinese space station|stazione spaziale cinese)\b/i },
  { slug: 'stazione',  fascino: 0.9,  tipi: ['stazione'], prova: /./ }
];

/* Le sigle, in una tabella sola. Il catalogo scrive «M 7» e «M7» nella
 * stessa colonna — sono due righe diverse dello stesso ammasso — quindi
 * lo spazio si toglie prima di confrontare. */
let missPerSigla = null;
function missTabellaSigle() {
  if (missPerSigla) return missPerSigla;
  missPerSigla = new Map();
  for (const voce of MISS_REPERTORIO) {
    for (const sigla of voce.sigle || []) {
      missPerSigla.set(String(sigla).replace(/\s+/g, '').toLowerCase(), voce);
    }
  }
  return missPerSigla;
}

// Il nome ridotto all'osso: niente accenti, niente maiuscole, niente
// spazi doppi. È la forma su cui lavorano le `prova` del repertorio.
function missNomeNudo(s) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

/* La sigla di catalogo dentro al nome di un oggetto profondo.
 *
 * «M31 — Galassia di Andromeda» è il nome che il catalogo compone in
 * `catPreparaProfondo`, e la sigla è tutto quello che sta prima del
 * trattino lungo. È l'unico pezzo che non cambia con la lingua, ed è per
 * questo che il riconoscimento del cielo profondo passa di lì e non dal
 * nome proprio. */
function missSiglaCatalogo(t) {
  if (!t) return '';
  if (t.sigla && t.tipo === 'profondo') return String(t.sigla).replace(/\s+/g, '').toLowerCase();
  const nome = String(t.nome || '');
  const taglio = nome.split(/\s+[—–-]\s+/)[0];
  return taglio.replace(/\s+/g, '').toLowerCase();
}

// La voce del repertorio che parla di questo bersaglio, o `null`.
function missVoceRepertorio(t) {
  if (!t) return null;
  if (t.tipo === 'profondo') return missTabellaSigle().get(missSiglaCatalogo(t)) || null;
  const nudo = missNomeNudo((t.sigla ? t.sigla + ' ' : '') + (t.nome || ''));
  for (const voce of MISS_REPERTORIO) {
    if (voce.tipi && !voce.tipi.includes(t.tipo)) continue;
    if (voce.prova && voce.prova.test(nudo)) return voce;
  }
  return null;
}

function missSlugTappa(t) {
  const voce = missVoceRepertorio(t);
  return voce ? voce.slug : null;
}

/* La categoria del cielo profondo: il gradino di mezzo del ripiego.
 *
 * Il catalogo tiene un `tipo` grezzo (`ammasso`, `globulare`,
 * `nebulosa`, `planetaria`, `galassia`) e un `tipoTesto` per esteso. Il
 * primo basta, e ha il pregio di essere un elenco chiuso di cinque
 * parole: cinque enigmi e cinque aneddoti coprono tutti i
 * centoquarantadue oggetti che un nome proprio non ce l'hanno. */
const MISS_CATEGORIE_PROFONDO = new Set(['ammasso', 'globulare', 'nebulosa', 'planetaria', 'galassia']);

function missCategoriaTappa(t) {
  if (!t || t.tipo !== 'profondo') return null;
  return MISS_CATEGORIE_PROFONDO.has(t.categoria) ? t.categoria : null;
}

/* Quanto un bersaglio ripaga la fatica di cercarlo, da 0 a 1.
 *
 * Nome proprio se ce l'ha, categoria se no, famiglia in ultima istanza.
 * Non è la magnitudine travestita: M57 è tenue e vale più di mezza
 * dozzina di ammassi aperti più luminosi di lui, perché quando lo si
 * trova si è visto un anello di fumo lasciato da una stella morta. */
const MISS_FASCINO_CATEGORIA = {
  nebulosa: 0.62, globulare: 0.58, planetaria: 0.54, galassia: 0.5, ammasso: 0.44
};
const MISS_FASCINO_FAMIGLIA = {
  luna: 0.9, pianeta: 0.62, stella: 0.46, costellazione: 0.52,
  profondo: 0.48, stazione: 0.88, evento: 0.8
};

function missFascinoDi(t) {
  const voce = missVoceRepertorio(t);
  if (voce && typeof voce.fascino === 'number') return voce.fascino;
  const categoria = missCategoriaTappa(t);
  if (categoria && MISS_FASCINO_CATEGORIA[categoria] !== undefined) return MISS_FASCINO_CATEGORIA[categoria];
  return MISS_FASCINO_FAMIGLIA[t && t.tipo] !== undefined ? MISS_FASCINO_FAMIGLIA[t.tipo] : 0.4;
}


// =====================================================================
// 2. IL MOTORE, IN FUNZIONI PURE
//
//     Tutto quello che decide *quali* tappe e *in che ordine* sta qui, e
//     non tocca né il documento né l'orologio né la rete: riceve uno
//     «scenario» — l'istante, la finestra di buio, i candidati già
//     misurati, le tre scelte, le condizioni — e restituisce una
//     missione. È la parte che si può provare senza browser, ed è la
//     ragione per cui è separata: il difetto tipico di questo genere di
//     codice non è un pixel storto, è una tappa impossibile che sullo
//     schermo sembra ragionevole.
// =====================================================================

// La distanza angolare fra due direzioni sull'orizzonte, sul giro: fra
// nord-ovest e nord-est ci sono novanta gradi, non duecentosettanta.
function missScartoAzimut(a, b) {
  // La differenza riportata dentro a [-180, +180] e poi presa in valore
  // assoluto: e' il conto di sempre, e va scritto in questo ordine. Con il
  // valore assoluto fatto prima, la meta' del giro che passa per il nord
  // viene misurata dalla parte lunga — fra 350 e 10 gradi risponderebbe
  // centosessanta invece di venti, e ogni riferimento a nord verrebbe
  // scartato per «troppo lontano».
  return Math.abs(((a - b) % 360 + 540) % 360 - 180);
}

// Una terrazza raramente vede tutto il giro. I due estremi delimitano
// sempre l'arco piu' corto: «S–SE» e «SE–S» descrivono quindi la stessa
// finestra e non, per errore, gli altri 315 gradi di cielo.
function missAzimutNelSettore(azimut, da, a) {
  if (![azimut, da, a].every(Number.isFinite)) return true;
  const ampiezza = missScartoAzimut(da, a);
  return missScartoAzimut(azimut, da) + missScartoAzimut(azimut, a) <= ampiezza + 1e-7;
}

// Un bersaglio si può guardare con quello che ho in mano?
function missStrumentoBasta(minimo, scelto) {
  const m = MISS_LIVELLO_STRUMENTO[minimo] ?? 0;
  const s = MISS_LIVELLO_STRUMENTO[scelto] ?? 0;
  return m <= s;
}

// La fascia di cielo in cui sta, detta come la direbbe una persona.
function missFasciaAltezza(alt) {
  if (alt < 20) return 'basso';
  if (alt < 55) return 'mezzo';
  return 'alto';
}

// La misura a braccio teso più vicina a un certo angolo.
function missMisuraAMano(gradi) {
  const g = Math.abs(gradi);
  let scelta = MISS_MISURE_A_MANO[0];
  for (const m of MISS_MISURE_A_MANO) {
    if (Math.abs(m.gradi - g) < Math.abs(scelta.gradi - g)) scelta = m;
  }
  return scelta;
}

/* Il caso, ma sempre lo stesso caso.
 *
 * Serve un generatore **seminato** e non `Math.random`, e la ragione non
 * è la riproducibilità delle prove: è che la stessa missione viene
 * ridisegnata decine di volte — si apre il pannello, si chiude, si va
 * nel planetario, si torna, si cambia lingua — e con `Math.random` in
 * mezzo ogni ridisegno sarebbe una missione diversa. Il seme sta nella
 * missione, quindi il caso si tira una volta sola e poi resta.
 *
 * È uno xorshift a 32 bit: quattro righe, nessuna dipendenza, e una
 * qualità largamente sufficiente per scegliere cinque bersagli fra
 * centocinquanta. */
function missCaso(seme) {
  let x = missHashTesto(String(seme)) || 0x9e3779b9;
  return function () {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;  x >>>= 0;
    return x / 4294967296;
  };
}

/* Quanto pesa la differenza di un punto, quando si sorteggia.
 *
 * È la manopola che decide se la missione è sempre la stessa o è una
 * lotteria. Con una temperatura bassa vince quasi sempre il primo della
 * classifica — che è il comportamento di prima, cioè cinque serate
 * uguali di fila; con una alta entra anche la nebulosa da undicesima
 * magnitudine, che è un modo elegante di far fallire la serata.
 *
 * Nove punti è il numero misurato sulla scala di `missPunteggio`, dove
 * l'altezza vale fino a trenta punti e il fascino fino a trentaquattro:
 * un candidato nove punti sotto il migliore pesa poco più di un terzo di
 * lui, uno venti punti sotto un decimo. Cioè il migliore vince spesso e
 * non vince sempre — che è esattamente la differenza fra una classifica
 * e una caccia.
 *
 * Coi bambini si stringe: lì un bersaglio mancato non è una variante, è
 * la fine della serata. */
const MISS_TEMPERATURA = { bambini: 5, curiosi: 9, sfida: 12 };

/* Le due penali, e perché sono due.
 *
 * Sono due frasi diverse dette dalla stessa persona. **«L'ho visto ieri
 * sera»** è un piuttosto-no: con un cielo povero rivedere M13 è molto
 * meglio che una missione di due tappe, e trenta punti — più di quanto
 * valga qualunque singola grandezza tranne l'altezza — bastano a
 * mandarlo in fondo senza escluderlo. **«Ho appena premuto un'altra
 * missione»** è un no: quello che si sta chiedendo è *un'altra cosa*, e
 * lì trenta punti non bastano — non contro un bersaglio che il punteggio
 * mette trenta punti sopra a tutti, che è il caso normale quando in
 * cielo c'è un pianeta solo. Misurato: con la penale sola dei recenti,
 * Saturno restava in tutte e cinque le anteprime di fila mentre le altre
 * quattro tappe cambiavano — quattro nomi nuovi e uno che non si muove,
 * che è esattamente la faccia di «mostra sempre gli stessi elementi».
 *
 * Settanta punti sulla scala di `missPunteggio`, con la temperatura dei
 * curiosi, valgono un peso quattromila volte più piccolo: fuori, in
 * pratica. Ma **non escluso**, e la differenza conta il giorno in cui
 * quel bersaglio è l'unica cosa rimasta — se sono penalizzati tutti, la
 * penale è una costante e sparisce dentro l'esponenziale, cioè la
 * missione si ripete invece di restituire il vuoto. */
const MISS_PENALE_RECENTE = 30;
const MISS_PENALE_RIFIUTATO = 70;

/* Il sorteggio pesato: la roulette di sempre.
 *
 * Ogni candidato prende una fetta larga `exp((punti - migliore) / T)`, e
 * si tira una pallina. Si sottrae il punteggio migliore prima
 * dell'esponenziale perché `Math.exp(90)` è infinito e `Infinity /
 * Infinity` è `NaN`: sottraendo, l'argomento più grande è sempre zero e
 * il più grande dei pesi è sempre uno. */
function missPescaPesato(pool, rnd, temperatura) {
  if (!pool.length) return -1;
  if (pool.length === 1) return 0;
  const t = Math.max(1, temperatura || 9);
  const cima = pool.reduce((m, c) => Math.max(m, c.punti), -Infinity);
  const pesi = pool.map(c => Math.exp((c.punti - cima) / t));
  const totale = pesi.reduce((a, b) => a + b, 0);
  if (!(totale > 0)) return 0;
  let tiro = rnd() * totale;
  for (let i = 0; i < pesi.length; i++) {
    tiro -= pesi[i];
    if (tiro <= 0) return i;
  }
  return pesi.length - 1;
}

/* Il punteggio di un candidato per *questa* serata.
 *
 * Non è un voto di bellezza — quello lo dà già `migliorDiStanotte` — ma
 * la risposta a «quanto è adatto a chi ha chiesto questa cosa qui». Le
 * due esperienze pesano le stesse grandezze in modo diverso. La modalità adulti premia la
 * difficoltà, mentre quella bambini la penalizza con decisione: una tappa
 * troppo ardua, lì, rischia di chiudere la serata. */
function missPunteggio(c, scelte, condizioni) {
  const esperienza = scelte.esperienza;
  let punti = c.puntiBase !== undefined ? c.puntiBase : 50;

  // --- quanto sale ---
  // Un oggetto alto si vede attraverso meno aria e non sta dietro a
  // niente: vale in tutte e quattro le esperienze.
  punti += Math.min(30, Math.max(0, (c.altezza - 10)) * 0.45);

  // --- la difficoltà, pesata dal gradino scelto ---
  const pesoDifficolta = { bambini: -14, curiosi: -7, sfida: +5 }[esperienza] || -8;
  punti += pesoDifficolta * (c.difficolta - 1);

  /* --- e il pavimento della difficoltà ---
   * Solo verso il basso, e solo dove è stato chiesto: chi ha scelto
   * «esperti» e si ritrova cinque bersagli che si trovano da soli non ha
   * avuto una serata facile, ha avuto la serata di qualcun altro. È una
   * penale e non un filtro, perché da un balcone di città quei cinque
   * bersagli possono essere tutto quello che c'è. */
  const gradita = MISS_DIFFICOLTA_GRADITA[esperienza] || 1;
  if (c.difficolta < gradita) punti -= 11 * (gradita - c.difficolta);

  // --- la luminosità apparente ---
  // `evidenza` è da 0 a 1: quanto un oggetto salta all'occhio a chi non
  // sa dove guardare. La Luna vale uno, una galassia di undicesima zero.
  const pesoEvidenza = { bambini: 30, curiosi: 18, sfida: 4 }[esperienza] || 20;
  punti += pesoEvidenza * c.evidenza;

  // --- il valore didattico ---
  const pesoDidattica = { bambini: 10, curiosi: 16, sfida: 8 }[esperienza] || 6;
  punti += pesoDidattica * (c.didattica || 0);

  /* --- il fascino: quello che resta dopo averlo trovato ---
   *
   * È la grandezza che mancava, e la sua assenza si vedeva: a parità di
   * altezza e magnitudine, l'ammasso NGC 6633 batteva Saturno perché era
   * più alto di sei gradi. Ma di Saturno si racconta ancora agli amici il
   * giorno dopo, e di NGC 6633 no — e una missione non è una classifica
   * di visibilità, è una serata da ricordare. Il numero viene dal
   * repertorio (§1-bis) e conta di più proprio dove la ricompensa è
   * l'unica cosa che tenga in piedi la caccia: coi bambini. */
  const pesoFascino = { bambini: 34, curiosi: 28, sfida: 16 }[esperienza] || 24;
  punti += pesoFascino * (typeof c.fascino === 'number' ? c.fascino : missFascinoDi(c));

  /* --- e chi ha un nome proprio, un enigma e un aneddoto suoi ---
   * Un bonus piccolo, perché il fascino ha già detto quasi tutto; ma a
   * pari punteggio è giusto che vinca il bersaglio che alla fine della
   * tappa ha qualcosa da raccontare invece della frase di ripiego della
   * sua categoria. */
  if (c.slug || missSlugTappa(c)) punti += 6;

  // --- per quanto resta guardabile dentro alla missione ---
  // Un bersaglio che tramonta a metà serata non è sbagliato: è una tappa
  // da mettere per prima, e chi la mette per ultima la perde.
  if (c.minutiUtili < 10) punti -= 22;
  else if (c.minutiUtili < 25) punti -= 8;

  // --- la Luna, che non disturba tutti allo stesso modo ---
  // Su un pianeta non conta niente; su una nebulosa debole conta più di
  // ogni altra cosa. È la stessa regola di `migliorDiStanotte`, applicata
  // qui perché il candidato può venire da altre famiglie.
  if (condizioni && condizioni.luna > 0.1 && c.soffreLaLuna) {
    punti -= Math.round(condizioni.luna * (c.difficolta >= 4 ? 42 : 22));
  }

  // --- un evento a orario preciso vale di più: non si ripete ---
  if (c.aOrarioPreciso) punti += 14;

  return Math.round(punti);
}

/* Quante tappe stanno in questa serata.
 *
 * Il numero dichiarato è un tetto, non una promessa: «è meglio proporre
 * due tappe realistiche che cinque tappe impossibili» è la regola, e per
 * rispettarla il conto guarda anche **quanti candidati buoni ci sono**.
 * Un cielo coperto a metà, o un balcone che guarda un muro, danno tre
 * bersagli in croce: allungare la missione con il quarto e il quinto
 * peggiori vorrebbe dire mandare qualcuno a cercare, al buio, roba che
 * non si vede. */
function missQuanteTappe(durata, candidatiBuoni) {
  const q = MISS_TAPPE_PER_DURATA[durata] || MISS_TAPPE_PER_DURATA[30];
  return Math.max(1, Math.min(q.max, candidatiBuoni));
}

/* La cernita: chi può stare in una missione, e chi no.
 *
 * È il primo dei due filtri, ed è quello secco — qui non si pesa niente,
 * si esclude. Un bersaglio non entra se sta sotto l'orizzonte, dietro a
 * qualcosa di dichiarato, richiede uno strumento che non c'è, è troppo
 * difficile per il percorso scelto oppure manca nella finestra della
 * missione. */
/* La magnitudine limite non vale uguale in tutto il cielo. Vicino
 * all'orizzonte la luce attraversa piu' atmosfera: le stelle perdono
 * contrasto e il fondo, soprattutto in citta', diventa piu' chiaro.
 * Questa stima resta volutamente prudente; serve a non trasformare una
 * missione in una lista di oggetti presenti sulla carta ma invisibili dal
 * posto e nella direzione in cui si trovano. */
function missLimiteStellareLocale(magZenit, altezza) {
  if (!Number.isFinite(magZenit) || !Number.isFinite(altezza) || altezza <= 0) return -99;
  const seno = Math.sin(Math.max(5, altezza) * Math.PI / 180);
  const massaAria = Math.min(6, 1 / Math.max(0.08, seno));
  return magZenit - 0.28 * (massaAria - 1);
}

// Il valore esplicito della pianificazione vince; in sua assenza si usa
// quello condiviso da Impostazioni e profilo del telescopio. Tenere qui
// il ripiego fa sì che anche il motore e i vecchi salvataggi usino sempre
// una tacca valida della stessa scala di Bortle dell'app.
function missBortleScelto() { return 2; }

function missVisibileNelCieloLocale(c, scelte) {
  if (!c || !Number.isFinite(c.magLimiteZenit)) return true;
  const limite = missLimiteStellareLocale(c.magLimiteZenit, c.altezza);
  const guadagno = { occhio: 0, binocolo: 2.5, telescopio: 5 }[scelte.strumento] || 0;

  if ((c.tipo === 'stella' || c.tipo === 'costellazione') && Number.isFinite(c.mag)) {
    // Una costellazione si riconosce a campo largo: il telescopio scelto
    // per le altre tappe non rende visibile la sua figura intera.
    return c.mag <= limite + (c.tipo === 'costellazione' ? 0 : guadagno);
  }
  if (c.tipo !== 'profondo') return true;

  // Bortle 8: il fondo e' tanto luminoso che una chiazza diffusa non e'
  // un bersaglio onesto per una caccia guidata, neppure se il catalogo le
  // assegna una magnitudine totale bassa. Luna, pianeti e stelle restano.
  if (Number.isFinite(c.fondoCielo) && c.fondoCielo <= 10) return false;
  if (!Number.isFinite(c.brillanza)) return Number.isFinite(c.mag) && c.mag <= limite + guadagno;

  const perdita = Math.max(0, c.magLimiteZenit - limite);
  const fondoLocale = c.fondoCielo - perdita * 1.4;
  const contrasto = fondoLocale - (c.brillanza + perdita);
  const contrastoMinimo = { occhio: -1, binocolo: -2.5, telescopio: -3.5 }[scelte.strumento] ?? -1;
  return c.mag <= limite + guadagno && contrasto > contrastoMinimo;
}

function missAmmissibile(c, scelte) {
  if (!c || !c.nome || c.idCielo === 'Sun') return false;
  // Il genere prima di tutto: è una scelta di chi guarda, non una misura
  // del cielo, e non ha senso pesarla contro l'altezza o la magnitudine.
  if (!missGenereAmmesso(c, scelte)) return false;
  if (!missStrumentoBasta(c.strumentoMinimo, scelte.strumento)) return false;
  // Anche se nel pannello e' rimasto un telescopio, una missione per
  // bambini non propone oggetti che senza tubo sono invisibili. Ammassi e
  // galassie appartengono invece esplicitamente al percorso Esperti.
  if (scelte.esperienza === 'bambini' && c.strumentoMinimo === 'telescopio') return false;
  if (c.tipo === 'profondo' && ['ammasso', 'globulare', 'galassia'].includes(c.categoria) &&
      scelte.esperienza !== 'sfida') return false;
  const difficoltaMassima = MISS_DIFFICOLTA_MASSIMA[scelte.esperienza] ?? 3;
  if ((c.difficolta || 1) > difficoltaMassima) return false;
  if (scelte.cielo === 'settore' && !missAzimutNelSettore(c.azimut, Number(scelte.cieloDa), Number(scelte.cieloA))) return false;
  // L'altezza è quella del momento consigliato, che è già il migliore
  // dentro alla finestra: se non basta lì, non basta mai.
  const minima = MISS_ALTEZZA_MINIMA[scelte.esperienza] ?? 15;
  if (!(c.altezza > minima)) return false;
  // Sopra l'ostacolo dichiarato o misurato: `sopraOstacoli` è già la
  // differenza, quindi zero vuol dire «esattamente sul crinale», che a
  // occhio vuol dire non visibile.
  if (typeof c.sopraOstacoli === 'number' && c.sopraOstacoli <= 1) return false;
  if (!missVisibileNelCieloLocale(c, scelte)) return false;
  // Un evento a orario preciso già passato non è una tappa: è una cosa
  // che è successa.
  if (c.aOrarioPreciso && c.quando == null) return false;
  return true;
}

/* La varietà: non tutta la missione della stessa famiglia.
 *
 * Cinque galassie sono una missione onesta e una serata noiosa, e
 * soprattutto sono una serata che non insegna niente — il cielo non è
 * fatto di una cosa sola. Il tetto è per **famiglia** (`gruppo`) e non
 * per tipo: la Luna e i pianeti sono due tipi ma una sola famiglia agli
 * occhi di chi guarda, cioè «le cose luminose del Sistema Solare». */
const MISS_TETTO_FAMIGLIA = 2;

/* Due tappe che sono la stessa cosa detta in due modi.
 *
 * «Trova Vega» e «trova la Lira» in una missione da cinque sono due tappe
 * su cinque per lo stesso pezzo di cielo — Vega *è* la stella più
 * luminosa della Lira, quindi trovata la prima la seconda è già lì. Non
 * lo prende nessuna delle altre regole: sono due famiglie diverse per il
 * tetto della varietà (una figura e una stella), stanno a pochi gradi
 * quindi la continuità le premia, e i punteggi sono alti tutti e due. È
 * il caso in cui il selettore, lasciato a sé, sceglie due volte la stessa
 * cosa perché le somiglianze le misura in gradi e non in significato. */
/* La separazione fra due bersagli, in gradi, letta dalle coordinate di
 * catalogo. È il coseno dell'angolo fra due direzioni: si scrive in una
 * riga e non ha bisogno di sapere che ora è. */
function missSeparazioneCatalogo(a, b) {
  if (!a || !b || !a.mira || !b.mira) return null;
  const r = Math.PI / 180;
  const ra1 = a.mira.ra * 15 * r, ra2 = b.mira.ra * 15 * r;
  const d1 = a.mira.dec * r, d2 = b.mira.dec * r;
  const cos = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(ra1 - ra2);
  return Math.acos(Math.max(-1, Math.min(1, cos))) / r;
}

/* Due oggetti profondi che stanno nello stesso campo dell'oculare sono
 * una tappa sola. M31 e la sua compagna M32 distano venti primi: chi
 * trova la prima ha già la seconda dentro all'inquadratura, e mandarcelo
 * di nuovo è chiedergli di cercare quello che sta già guardando. Stessa
 * cosa per M42 e M43, che sono due righe di catalogo della stessa
 * nebulosa. */
const MISS_STESSO_CAMPO_GRADI = 1.5;

function missDoppione(c, scelti) {
  return scelti.some(g => {
    if (c.tipo === 'costellazione' && g.tipo === 'stella') return c.capofila === g.nome;
    if (g.tipo === 'costellazione' && c.tipo === 'stella') return g.capofila === c.nome;
    // Lo stesso slug del repertorio vuol dire lo stesso enigma e lo
    // stesso aneddoto: due tappe che raccontano la stessa storia.
    const slugC = c.slug || missSlugTappa(c), slugG = g.slug || missSlugTappa(g);
    if (slugC && slugC === slugG) return true;
    if (c.tipo === 'profondo' && g.tipo === 'profondo') {
      const gradi = missSeparazioneCatalogo(c, g);
      if (gradi !== null && gradi < MISS_STESSO_CAMPO_GRADI) return true;
    }
    return false;
  });
}

function missFamigliaDi(c) {
  if (c.tipo === 'luna' || c.tipo === 'pianeta') return 'sistemaSolare';
  if (c.tipo === 'stella' || c.tipo === 'costellazione') return 'figure';
  if (c.tipo === 'profondo') return 'profondo';
  if (c.tipo === 'stazione' || c.tipo === 'evento') return 'appuntamenti';
  return 'altro';
}

/* La progressione: il primo successo dev'essere facile.
 *
 * È la regola che vale più di tutte le altre messe insieme, e viene da
 * come funziona una serata vera: chi trova la prima cosa in venti secondi
 * cerca la seconda con pazienza; chi non trova la prima, in venti secondi
 * ha già deciso che l'app non funziona. Quindi la prima tappa non è la
 * migliore: è **la più facile fra le buone**. */
function missOrdinaPerProgressione(scelti, scelte) {
  const liberi = scelti.filter(c => !c.aOrarioPreciso);
  const fissi = scelti.filter(c => c.aOrarioPreciso);

  // La prima è la più facile, e a pari difficoltà la più evidente.
  liberi.sort((a, b) => a.difficolta - b.difficolta || b.punti - a.punti || b.evidenza - a.evidenza);
  const fila = [];
  if (liberi.length) fila.push(liberi.shift());

  // Da lì in poi si cammina: fra i rimasti si prende quello che costa
  // meno da raggiungere — poca difficoltà in più e poco cielo da
  // attraversare. La continuità non è un vezzo: girarsi di
  // centottanta gradi al buio vuol dire perdere l'adattamento e il
  // riferimento da cui si era partiti.
  while (liberi.length) {
    const ultimo = fila[fila.length - 1];
    let migliore = 0, costoMigliore = Infinity;
    liberi.forEach((c, i) => {
      const salto = missScartoAzimut(c.azimut, ultimo.azimut);
      const costo = (c.difficolta - ultimo.difficolta) * 12
                  + Math.max(0, salto - MISS_SALTO_COMODO_GRADI) * 0.22
                  - c.punti * 0.10;
      if (costo < costoMigliore) { costoMigliore = costo; migliore = i; }
    });
    fila.push(liberi.splice(migliore, 1)[0]);
  }

  // «Fammi una sfida» vuole il pezzo grosso in fondo, e la fila costruita
  // per continuità non lo garantisce: si porta in coda il più difficile,
  // che è la chiusura che quella scelta promette.
  if (scelte.esperienza === 'sfida' && fila.length > 2) {
    let piuDuro = 0;
    fila.forEach((c, i) => { if (c.difficolta > fila[piuDuro].difficolta) piuDuro = i; });
    if (piuDuro !== fila.length - 1) fila.push(fila.splice(piuDuro, 1)[0]);
  }

  return { fila, fissi };
}

/* Gli orari: chi si guarda quando.
 *
 * Due nature diverse nella stessa sequenza. Un pianeta è disponibile per
 * un **intervallo** e lo si guarda quando fa comodo; un passaggio della
 * ISS avviene a un **istante** e non aspetta nessuno. Il secondo si
 * incastra nella fila al suo posto nel tempo, e gli altri gli si aprono
 * attorno.
 *
 * La riga che conta è l'ultima: un evento che cade prima del preavviso
 * minimo non si mette affatto. Annunciare un passaggio fra quaranta
 * secondi, a chi sta ancora leggendo la prima tappa, è peggio che non
 * annunciarlo — è una cosa persa mentre la si leggeva. */
function missMettiInOrario(fila, fissi, partenzaMs, durataMin, scelte) {
  const perTappaMs = (durataMin * 60000) / Math.max(1, fila.length + fissi.length);
  // Coi bambini le tappe sono più corte: l'attenzione dura quello che
  // dura, e una tappa lunga si trasforma in «quando andiamo dentro?».
  const passo = scelte.esperienza === 'bambini'
    ? Math.min(perTappaMs, 5 * 60000) : perTappaMs;

  const conOrario = fila.map((c, i) => Object.assign({}, c, {
    quando: partenzaMs + Math.round(i * passo)
  }));

  const fineMissione = partenzaMs + durataMin * 60000;
  fissi
    .filter(f => f.quando >= partenzaMs + MISS_PREAVVISO_MIN * 60000 && f.quando <= fineMissione)
    .forEach(f => {
      let dove = conOrario.findIndex(t => t.quando > f.quando);
      if (dove < 0) dove = conOrario.length;
      conOrario.splice(dove, 0, Object.assign({}, f));
    });

  return conOrario;
}

/* Il riferimento da cui partire.
 *
 * «Cerca M31» è un'istruzione che presuppone di sapere già dov'è. Quello
 * che serve è un punto di partenza che si veda a occhio da qualunque
 * cortile, e un verso: la tappa di prima se è abbastanza vicina e
 * abbastanza luminosa, se no il candidato più evidente entro un braccio
 * teso. Se non c'è nessuno dei due, il riferimento è la direzione
 * cardinale, che c'è sempre. */
function missAttaccaRiferimenti(tappe, candidati) {
  return tappe.map((t, i) => {
    const precedente = i > 0 ? tappe[i - 1] : null;
    let rif = null;

    if (precedente && precedente.evidenza >= 0.5 &&
        !missDoppione(t, [precedente]) &&
        missScartoAzimut(precedente.azimut, t.azimut) < 45) {
      rif = precedente;
    } else {
      let migliore = null;
      for (const c of candidati) {
        if (c.id === t.id || c.evidenza < 0.6) continue;
        if (missDoppione(t, [c])) continue;
        const salto = missScartoAzimut(c.azimut, t.azimut);
        if (salto > 40) continue;
        if (!migliore || c.evidenza > migliore.evidenza) migliore = c;
      }
      rif = migliore;
    }

    return Object.assign({}, t, {
      riferimento: rif ? {
        nome: rif.nome,
        tipo: rif.tipo,
        sigla: rif.sigla || null,
        gradi: Math.round(missScartoAzimut(rif.azimut, t.azimut)),
        // Da che parte: in cielo, guardando verso l'orizzonte, gli
        // azimut crescono verso destra.
        verso: (((t.azimut - rif.azimut) % 360) + 360) % 360 < 180 ? 'destra' : 'sinistra',
        piuAlto: t.altezza > rif.altezza
      } : null
    });
  });
}

/* Il motore, tutto insieme.
 *
 * `scenario` è quello che il mondo esterno ha già misurato:
 *   { adesso, partenza, candidati, scelte, condizioni }
 * e non contiene niente che questa funzione debba andare a chiedere a
 * qualcuno. In uscita c'è la missione, o `null` con il motivo scritto. */
function missGeneraMissione(scenario) {
  const scelte = Object.assign({ durata: 30, strumento: 'occhio', esperienza: 'curiosi', bortle: 2, cielo: 'tutto', cieloDa: 135, cieloA: 180,
    voce: false },
    scenario && scenario.scelte);
  const condizioni = (scenario && scenario.condizioni) || {};
  const adesso = (scenario && scenario.adesso) || Date.now();
  const partenza = (scenario && scenario.partenza) || adesso;
  const tutti = (scenario && scenario.candidati) || [];
  const evitare = new Set((scenario && scenario.evitare) || []);
  // Quelli che si è appena detto di non volere: vedi `MISS_PENALE_RIFIUTATO`.
  const rifiutati = new Set((scenario && scenario.rifiutati) || []);

  const seme = scenario.seme || Math.random().toString(36).slice(2);
  const storia = scenario.storia || {};
  const ammessi = tutti.filter(c => missAmmissibile(c, scelte));
  if (!ammessi.length) {
    return { vuota: true, motivo: 'nienteInVista', scelte, condizioni, tappe: [] };
  }

  /* Il punteggio, e poi il caso.
   *
   * La penale è **dentro** al punteggio e non un riordinamento dopo: un
   * ordinamento per «da evitare» è un sì o un no, e quello che serve qui
   * è un «piuttosto no» — con un cielo povero, ripetere un bersaglio di
   * ieri è molto meglio che restituire una missione di due tappe. */
  const rnd = missCaso(seme);
  const votati = ammessi
    .map(c => Object.assign({}, c, {
      punti: missPunteggio(c, scelte, condizioni)
        - (rifiutati.has(c.id) ? MISS_PENALE_RIFIUTATO : evitare.has(c.id) ? MISS_PENALE_RECENTE : 0)
    }))
    .sort((a, b) => b.punti - a.punti);

  const quante = missQuanteTappe(scelte.durata, votati.length);
  const temperatura = MISS_TEMPERATURA[scelte.esperienza] || MISS_TEMPERATURA.curiosi;
  const perFamiglia = {};
  const scelti = [];
  const presi = new Set();

  /* Il sorteggio, tappa per tappa.
   *
   * Non si prende più il primo della classifica: si guarda **chi è
   * ancora ammesso adesso** — cioè dopo aver tolto i doppioni di quello
   * che si è già scelto e le famiglie che hanno finito il loro tetto — e
   * fra quelli si tira la pallina di `missPescaPesato`. È il cambiamento
   * che risponde a «non fare sempre le solite liste»: con la classifica,
   * dallo stesso balcone alla stessa ora la missione era identica ogni
   * sera, perché identiche erano le posizioni; adesso il migliore vince
   * spesso e non vince sempre, e la seconda serata è un'altra serata.
   *
   * `filtro` esiste perché il pool va ricalcolato a ogni giro: un
   * doppione lo è rispetto a quello che si è pescato, non rispetto alla
   * classifica di partenza. */
  const pescabili = filtro => votati.filter(c =>
    !presi.has(c.id) && !missDoppione(c, scelti) && (!filtro || filtro(c)));

  const prendi = c => {
    scelti.push(c);
    presi.add(c.id);
    perFamiglia[missFamigliaDi(c)] = (perFamiglia[missFamigliaDi(c)] || 0) + 1;
  };

  /* Il posto riservato a un pianeta, e i due casi in cui non si riserva.
   *
   * La ragione della riserva resta quella di sempre: i pianeti sono i
   * bersagli che chiunque trova, e una costellazione con tre punti in più
   * poteva espellerli del tutto dalle missioni corte. Ma è anche la sola
   * regola di questo file che dica «questo c'è sempre», cioè la cosa che
   * più di ogni altra faceva sembrare uguali due serate — quindi adesso
   * *quale* pianeta si sorteggia come tutto il resto, e la riserva salta
   * del tutto per chi ha chiesto una sfida: a quel gradino un pianeta
   * facile non è un ancoraggio, è una tappa buttata. La Luna non conta:
   * si riserva il posto a un pianeta vero e la varietà la fa il
   * selettore normale. */
  if (quante > 0 && scelte.esperienza !== 'sfida') {
    const pianeti = pescabili(c => c.tipo === 'pianeta');
    /* …e il terzo caso, che è quello che si vedeva: **un pianeta appena
     * visto non è un ancoraggio**. Con un solo pianeta sopra l'orizzonte
     * — che è la sera normale, non il caso limite — la riserva lo
     * rimetteva dentro a ogni tentativo, e premendo «un'altra missione»
     * quella era l'unica tappa che non cambiava mai: quattro nomi nuovi e
     * Saturno, cinque volte di fila. La riserva resta una preferenza e
     * non un obbligo — insiste su un pianeta già scartato solo se il
     * resto del cielo non ha di che riempire la missione da solo. */
    const freschi = pianeti.filter(c => !evitare.has(c.id) && !rifiutati.has(c.id));
    const riserva = freschi.length ? freschi
      : (pescabili(c => c.tipo !== 'pianeta').length >= quante ? [] : pianeti);
    const i = missPescaPesato(riserva, rnd, temperatura);
    if (i >= 0) prendi(riserva[i]);
  }

  while (scelti.length < quante) {
    let pool = pescabili(c => (perFamiglia[missFamigliaDi(c)] || 0) < MISS_TETTO_FAMIGLIA);
    /* Il tetto della varietà non deve diventare la ragione per cui torna
     * sempre lo stesso bersaglio.
     *
     * Sono due preferenze, e qui litigano: non tutta la missione della
     * stessa famiglia, e non di nuovo quello di poco fa. Le famiglie
     * sono quattro e la sera normale ne parlano tre, quindi una missione
     * da cinque tappe vuole 2 + 2 + 1 — e se la terza famiglia è il
     * Sistema Solare con un pianeta solo sopra l'orizzonte, quell'uno è
     * **obbligato**: la penale dei recenti non può niente contro un
     * pool che ha un elemento. Misurato, era esattamente il motivo per
     * cui a un'ora di missione Saturno restava in tutte e cinque le
     * anteprime di fila mentre le altre quattro tappe cambiavano.
     *
     * Quando sotto al tetto resta solo roba appena vista, e fuori c'è
     * ancora qualcosa di nuovo, vince la novità: una famiglia
     * rappresentata tre volte si nota molto meno di una tappa che non
     * cambia mai. */
    const giaVisto = c => evitare.has(c.id) || rifiutati.has(c.id);
    if (pool.length && pool.every(giaVisto)) {
      const nuovi = pescabili(c => !giaVisto(c));
      if (nuovi.length) pool = nuovi;
    }
    const i = missPescaPesato(pool, rnd, temperatura);
    if (i < 0) break;
    prendi(pool[i]);
  }
  /* Se il tetto per famiglia ha lasciato la missione più corta del
   * dovuto, si riempie: la varietà è una preferenza, avere delle tappe è
   * un requisito. Qui il tetto cade ma il sorteggio resta — riempire
   * dalla cima della classifica rimetterebbe in fondo a ogni missione
   * sempre gli stessi due bersagli di ripiego. */
  while (scelti.length < quante) {
    const pool = pescabili(null);
    const i = missPescaPesato(pool, rnd, temperatura);
    if (i < 0) break;
    prendi(pool[i]);
  }

  const { fila, fissi } = missOrdinaPerProgressione(scelti, scelte);
  if (scenario.posizioneA) {
    const primoOra = fila.findIndex(t => missAmmissibile(Object.assign({}, t, scenario.posizioneA(t, partenza)), scelte));
    if (primoOra > 0) fila.unshift(fila.splice(primoOra, 1)[0]);
  }
  const inOrario = missMettiInOrario(fila, fissi, partenza, scelte.durata, scelte);
  // Il racconto resta uguale mentre si apre, si chiude o si riprende la
  // missione, ma cambia davvero quando se ne genera un'altra. Affidarsi a
  // Math.random durante il rendering farebbe invece cambiare storia a ogni
  // clic su «non lo trovo».
  const idMissione = 'miss-' + partenza + '-' + seme;
  let misurate = inOrario.map(t => scenario.posizioneA ?
    Object.assign({}, t, scenario.posizioneA(t, t.quando)) : t)
    .filter(t => missAmmissibile(t, scelte));
  // Un oggetto che sorge o tramonta può essere valido solo verso la fine
  // della finestra. Gli orari regolari assegnati sopra non devono quindi
  // trasformare un cielo realmente popolato in una missione vuota: in quel
  // caso conserviamo gli istanti migliori già misurati dal raccoglitore.
  if (!misurate.length && scenario.posizioneA) {
    misurate = fila.map(t => Object.assign({}, t, scenario.posizioneA(t, t.quando)))
      .filter(t => missAmmissibile(t, scelte))
      .sort((a, b) => a.quando - b.quando);
  }
  const variantiDomandaUsate = {};
  const variantiIndizioUsate = {};
  const tappe = missAttaccaRiferimenti(misurate, votati).map((t, i) => {
    const famiglia = missFamigliaContenuto(t);
    const precedente = scenario.domande && scenario.domande[t.id];
    let domandaVariante = precedente != null ? (precedente + 1) % 3 :
      missHashTesto(idMissione + ':domanda:' + t.id) % 3;
    // Due pianeti (o due stelle) nella stessa missione non pongono la stessa
    // domanda quando le altre varianti sono disponibili.
    const usate = variantiDomandaUsate[famiglia] || (variantiDomandaUsate[famiglia] = new Set());
    for (let n = 0; n < 3 && usate.has(domandaVariante); n++) domandaVariante = (domandaVariante + 1) % 3;
    usate.add(domandaVariante);
    /* …e lo stesso per la variante dell'indovinello, che da quando i tre
     * indizi sono tre strofe della stessa voce pesa molto di più di
     * prima: la seconda e la terza scendono alla famiglia per quasi
     * tutti i bersagli, quindi due figure con la stessa variante nella
     * stessa serata ricevono due righe **identiche** parola per parola.
     * Misurato sul cielo di Como: il Cigno e Cassiopea, due tappe su
     * quattro, dicevano tutt'e due «fra diecimila anni sarò storta» — e
     * a occhio non si legge come una coincidenza, si legge come un
     * copia-incolla. Il tetto della varietà lascia passare due bersagli
     * per famiglia, quindi il caso capitava una volta su tre. */
    let indizioVariante = storia[t.id] == null
      ? missHashTesto(idMissione + ':indizio:' + t.id) % 3 : (storia[t.id] + 1) % 3;
    const viste = variantiIndizioUsate[famiglia] || (variantiIndizioUsate[famiglia] = new Set());
    for (let n = 0; n < 3 && viste.has(indizioVariante); n++) indizioVariante = (indizioVariante + 1) % 3;
    viste.add(indizioVariante);
    return Object.assign({}, t, {
    indice: i,
    esito: null,
    aiuto: 0,
    fase: 'ricerca',
    raccontoVariante: storia[t.id] == null ? missHashTesto(idMissione + ':' + t.id) % 3 : (storia[t.id] + 1) % 3,
    domandaVariante,
    indizioVariante
    });
  });

  if (!tappe.length) return { vuota: true, motivo: 'nienteInVista', scelte, condizioni, tappe: [] };
  return {
    id: idMissione,
    versione: MISS_VERSIONE,
    creata: adesso,
    partenza,
    scelte,
    condizioni,
    tappe,
    scartati: votati.filter(c => !scelti.includes(c)).map(c => c.id),
    // Quanto dura davvero: l'ultima tappa più il tempo per guardarla.
    durataStimataMin: scelte.durata
  };
}


// =====================================================================
// 3. I CANDIDATI — da dove vengono, e come si misurano
//
//     Qui si esce dalla parte pura e si va a chiedere al resto dell'app.
//     Niente di quello che c'è qui sotto calcola una posizione da sé:
//     `altAzCorpo`, `altAzCoordinate`, `finestraBuio`, `orizzonteAltezza`
//     e `terrenoAltezza` esistono già, e una seconda effemeride sarebbe
//     una seconda verità da tenere d'accordo con la prima.
//
//     La sola cosa che si fa in proprio è **campionare la finestra della
//     missione** invece della notte intera. `pianCurvaNotturna` prende
//     novantasei campioni dal tramonto all'alba, che è la domanda giusta
//     per la dashboard («stanotte quando è più alto?») e quella sbagliata
//     per qui («nella mezz'ora che ho, si vede?»). Con centocinquanta
//     candidati la differenza è fra quattordicimila conti e mille.
// =====================================================================

// Quanti campioni dentro alla finestra: uno ogni otto minuti circa, e mai
// meno di tre. Un oggetto non cambia altezza abbastanza in otto minuti da
// far cambiare idea a nessuno — tranne le stazioni spaziali, che infatti
// non passano di qui (§3-ter).
function missCampioni(partenzaMs, durataMin) {
  const passo = Math.max(3 * 60000, Math.round(durataMin * 60000 / 12));
  const campioni = [];
  for (let ms = partenzaMs; ms <= partenzaMs + durataMin * 60000; ms += passo) {
    campioni.push(ms);
  }
  if (campioni.length < 3) {
    campioni.length = 0;
    for (let k = 0; k <= 2; k++) campioni.push(partenzaMs + k * durataMin * 30000);
  }
  return campioni;
}

/* L'ostacolo in una direzione: il terreno vero se c'è, se no quello che
 * è stato dichiarato a mano.
 *
 * Non si passa da `skyAltezzaOrizzonte`, ed è una scelta: quella, senza
 * terreno, ci mette sopra il profilo *inventato* di `SKY_PROFILO` — che
 * per disegnare un cielo credibile va benissimo e per decidere se
 * mandare qualcuno a cercare una nebulosa no. Qui una collina che non è
 * stata misurata non esiste. */
function missOstacolo(az) {
  let vero = null;
  if (typeof terrenoDisponibile === 'function' && terrenoDisponibile() &&
      typeof terrenoAltezza === 'function') {
    try { vero = terrenoAltezza(az); } catch (e) { vero = null; }
  }
  const dichiarato = typeof orizzonteAltezza === 'function' ? orizzonteAltezza(az) : 0;
  return Math.max(typeof vero === 'number' ? vero : 0, dichiarato);
}

/* Dove sta un bersaglio dentro alla finestra della missione.
 *
 * Restituisce il momento migliore — il più alto *e* sopra l'ostacolo — e
 * per quanti minuti resta guardabile. Chi non è mai guardabile risponde
 * `null`, e non entra nemmeno in classifica. */
function missVisibilitaNellaFinestra(bersaglio, obs, campioni) {
  let migliore = null;
  let buoni = 0;
  for (const ms of campioni) {
    const data = new Date(ms);
    let p;
    try {
      p = bersaglio.ra !== undefined
        ? altAzCoordinate(bersaglio.ra, bersaglio.dec, data, obs)
        : altAzCorpo(bersaglio.id, data, obs);
    } catch (e) { continue; }
    if (!p || typeof p.alt !== 'number') continue;
    const sopra = p.alt - missOstacolo(p.az);
    if (sopra > 1) buoni++;
    if (sopra > 1 && (!migliore || p.alt > migliore.alt)) {
      migliore = { ms, alt: p.alt, az: p.az, sopraOstacoli: sopra };
    }
  }
  if (!migliore) return null;
  const passo = campioni.length > 1 ? (campioni[1] - campioni[0]) / 60000 : 5;
  return { migliore, minutiUtili: Math.round(buoni * passo) };
}

/* Dalla figura del planetario alla sua sigla IAU.
 *
 * Il confronto è sul nome italiano perché è quello che le due tabelle
 * hanno in comune: `SKY_COSTELLAZIONI` (app.js) e `COSTELLAZIONI_IAU`
 * (dati-costellazioni.js) vengono dalla stessa fonte e lo scrivono
 * uguale. Senza catalogo si risponde `null`, e chi chiede il nome si
 * tiene l'italiano — che è come si comportava tutta l'app prima che le
 * figure entrassero nel dizionario.
 *
 * La tabella si costruisce una volta sola e si butta quando il catalogo
 * cambia: sono ottantotto voci, e rifarla a ogni candidato vorrebbe dire
 * ottantotto scansioni per ognuna delle ventitré figure del planetario. */
let missSigleCostellazioni = null;

function missSiglaCostellazione(nomeItaliano) {
  if (typeof COSTELLAZIONI_IAU === 'undefined') return null;
  if (!missSigleCostellazioni || missSigleCostellazioni.size === 0) {
    missSigleCostellazioni = new Map();
    COSTELLAZIONI_IAU.forEach(c => {
      if (!missSigleCostellazioni.has(c.nome)) missSigleCostellazioni.set(c.nome, c.sigla);
    });
  }
  return missSigleCostellazioni.get(nomeItaliano) || null;
}

// Il nome di una tappa nella lingua di adesso. Per tutto tranne le
// costellazioni è quello che c'è scritto: i pianeti e le stelle il loro
// nome ce l'hanno già tradotto da `nomeCorpo`, e «M31 — Galassia di
// Andromeda» è anche l'identificativo con cui l'app lo ritrova (vedi il
// residuo dichiarato in `scripts/i18n-tetto.json`).
function missNomeTappa(t) {
  if (!t) return '';
  if (['luna', 'pianeta'].includes(t.tipo) && t.idCielo && typeof pianNomePianeta === 'function') return pianNomePianeta(t.idCielo);
  if (t.tipo === 'costellazione' && t.sigla && typeof costNomeFigura === 'function') {
    return costNomeFigura(t.sigla, t.nome);
  }
  return t.nome;
}

// Quanto un oggetto salta all'occhio a chi non sa dove guardare. Zero è
// «bisogna sapere dov'è», uno è «lo vedi uscendo di casa». Si ricava
// dalla magnitudine, che è l'unica misura che tutti questi oggetti hanno
// in comune, con la Luna fuori scala per conto suo.
function missEvidenzaDaMagnitudine(mag) {
  if (typeof mag !== 'number' || !isFinite(mag)) return 0.2;
  if (mag <= -3) return 1;
  if (mag >= 9) return 0;
  return Math.max(0, Math.min(1, (5.5 - mag) / 8));
}

// Quanto è difficile trovarlo, da 1 (impossibile sbagliare) a 5 (serve
// saper cercare). La magnitudine da sola non basta: M57 è brillante e
// largo un primo, cioè indistinguibile da una stella per chi non sa già
// dov'è — la misura apparente conta quanto la luce.
function missDifficolta(mag, strumento, assePrimi) {
  let d = 1;
  if (typeof mag === 'number') {
    if (mag > 8) d = 4;
    else if (mag > 5.5) d = 3;
    else if (mag > 2.5) d = 2;
  }
  if (strumento === 'binocolo') d = Math.max(d, 2);
  if (strumento === 'telescopio') d = Math.max(d, 3);
  if (typeof assePrimi === 'number' && assePrimi > 0 && assePrimi < 3) d += 1;
  return Math.max(1, Math.min(5, d));
}

/* I candidati del Sistema Solare, delle stelle e del cielo profondo.
 *
 * La materia prima è `pianBersagli()` — la stessa di `migliorDiStanotte`,
 * di proposito: due elenchi di bersagli diventerebbero due cataloghi da
 * tenere d'accordo. Qui si aggiungono le due famiglie che alla dashboard
 * non servono e a una missione sì: le **stelle luminose**, che sono i
 * riferimenti da cui parte ogni istruzione, e le **costellazioni**, che
 * sono la cosa che si impara. */
/* Il timbro del repertorio su un candidato appena costruito.
 *
 * `slug` e `fascino` si scrivono qui, una volta sola per candidato, e da
 * lì viaggiano dentro alla missione salvata: il punteggio li legge senza
 * rifare il riconoscimento, e la tappa ripresa dopo una ricarica sa
 * ancora quale storia raccontare. */
function missDecoraCandidato(c) {
  const voce = missVoceRepertorio(c);
  c.slug = voce ? voce.slug : null;
  c.fascino = voce && typeof voce.fascino === 'number' ? voce.fascino : missFascinoDi(c);
  return c;
}

function missCandidatiDelCielo(obs, campioni, scelte) {
  const fuori = [];
  // La missione può simulare un luogo diverso da quello abituale: una
  // trasferta in montagna non deve ereditare il fondo luminoso di casa.
  // Se la scelta manca (salvataggi precedenti), si parte dal valore già
  // indicato nelle Impostazioni senza modificarlo.
  const bortle = missBortleScelto(scelte);
  const cieloLocale = typeof CAT_CIELI !== 'undefined' && CAT_CIELI[bortle]
    ? CAT_CIELI[bortle] : { magLimite: 5.6, fondo: 11.6 };

  const base = typeof pianBersagli === 'function' ? pianBersagli() : [];
  for (const b of base) {
    const v = missVisibilitaNellaFinestra(
      b.ra !== undefined ? { ra: b.ra, dec: b.dec } : { id: b.id }, obs, campioni);
    if (!v) continue;

    let strumentoMinimo = 'occhio';
    let mag = typeof b.mag === 'number' ? b.mag : null;
    let assePrimi = null;
    let didattica = 0;
    let soffreLaLuna = false;
    let brillanza = null;
    // Il gradino di mezzo del ripiego (§1-bis) e le due misure vere che
    // servono al cartellino della scoperta: la larghezza apparente e il
    // nome della specie.
    let categoria = null;
    let sigla = null;
    let assePrimiVeri = null;
    let tipoTesto = null;

    if (b.tipo === 'profondo' && b.dato) {
      mag = b.dato.mag;
      assePrimi = b.dato.assePrimi;
      brillanza = typeof b.dato.brillanza === 'number' ? b.dato.brillanza : mag + 5;
      categoria = b.dato.tipo || null;
      sigla = b.dato.sigla || null;
      assePrimiVeri = typeof b.dato.assePrimi === 'number' ? b.dato.assePrimi : null;
      tipoTesto = b.dato.tipoTesto || null;
      soffreLaLuna = true;
      didattica = 0.6;
      strumentoMinimo = typeof profondoStrumento === 'function'
        ? profondoStrumento(b.dato, bortle) : 'binocolo';
    } else if (b.tipo === 'corpoMinore') {
      soffreLaLuna = true;
      didattica = 0.5;
      strumentoMinimo = mag <= 6 ? 'occhio' : mag <= 9 ? 'binocolo' : 'telescopio';
    } else if (b.tipo === 'luna') {
      mag = -12;
      didattica = 0.8;
    } else if (b.tipo === 'pianeta') {
      // La magnitudine vera di un pianeta cambia molto: la si chiede alla
      // libreria, che la sa, invece di inventarne una media.
      try {
        mag = Astronomy.Illumination(b.id, Astronomy.MakeTime(new Date(v.migliore.ms))).mag;
      } catch (e) { mag = 1; }
      didattica = 0.5;
      // Urano e Nettuno restano puntini: senza almeno un binocolo non si
      // distinguono da una stellina qualunque, e proporli a occhio nudo
      // vuol dire mandare qualcuno a guardare il nulla.
      if (b.id === 'Uranus' || b.id === 'Neptune') strumentoMinimo = 'telescopio';
      else if (mag > 3) strumentoMinimo = 'binocolo';
    }

    fuori.push(missDecoraCandidato({
      id: b.tipo + ':' + (b.id || b.nome),
      nome: b.nome,
      mira: b.ra !== undefined ? { ra: b.ra, dec: b.dec } : null,
      corpo: b.ra === undefined ? b.id : null,
      tipo: b.tipo,
      categoria,
      sigla,
      assePrimi: assePrimiVeri,
      tipoTesto,
      idCielo: typeof pianIdCielo === 'function' ? pianIdCielo(b) : (b.id || null),
      quando: v.migliore.ms,
      altezza: v.migliore.alt,
      azimut: v.migliore.az,
      sopraOstacoli: v.migliore.sopraOstacoli,
      minutiUtili: v.minutiUtili,
      strumentoMinimo,
      mag,
      magLimiteZenit: cieloLocale.magLimite,
      fondoCielo: cieloLocale.fondo,
      brillanza,
      difficolta: b.tipo === 'luna' ? 1 : missDifficolta(mag, strumentoMinimo, assePrimi),
      evidenza: b.tipo === 'luna' ? 1 : missEvidenzaDaMagnitudine(mag),
      didattica,
      soffreLaLuna,
      aOrarioPreciso: false,
      puntiBase: 50
    }));
  }

  /* Le stelle con un nome.
   *
   * Erano otto — gli slot che il planetario tiene per nome
   * (`Star1…Star8`) — e otto è il numero per cui «stasera voglio stelle»
   * dava la stessa identica missione ogni sera: tolte quelle sotto
   * l'orizzonte ne restano tre o quattro, cioè meno delle tappe da
   * riempire, e il sorteggio non ha niente da sorteggiare.
   *
   * Le altre stanno già in casa, e la sorgente giusta è **una sola**:
   * `catVociElenco()`, cioè le stelle che il planetario tiene per nome
   * nel suo elenco degli astri (le 701 nominate del catalogo, tosate a
   * magnitudine 3,2 — «solo quelle che si additano», che è la stessa
   * domanda che fa una caccia). Prenderle da lì non è una comodità: è la
   * condizione perché la tappa si possa **chiudere**.
   *
   * Il primo tentativo pescava i vertici nominati delle figure di
   * `SKY_COSTELLAZIONI`, che il nome e la magnitudine ce l'hanno.
   * Misurato nel browser: di cinquantanove bersagli così, **venti non si
   * potevano trovare** — toccandoli sulla mappa `catStellaNelPunto` non
   * riconosceva niente (quelle coordinate non sono le stesse del
   * catalogo) e la risposta cadeva sulla figura, cioè «no, non è
   * questo». Una tappa che non si può chiudere è peggio di una tappa che
   * non c'è: chi cerca dà la colpa a sé. Con l'indice del catalogo
   * (`cat:<indice>`) il tocco torna per costruzione, perché è lo stesso
   * dato che il planetario disegna e interroga. */
  const stellePronte = new Set();
  const aggiungiStella = (s, idCielo, puntiBase) => {
    const chiave = s.nome.toLowerCase();
    if (stellePronte.has(chiave)) return;
    stellePronte.add(chiave);
    const v = missVisibilitaNellaFinestra({ ra: s.ra, dec: s.dec }, obs, campioni);
    if (!v) return;
    fuori.push(missDecoraCandidato({
      id: 'stella:' + (idCielo || s.nome),
      nome: s.nome,
      mira: { ra: s.ra, dec: s.dec },
      tipo: 'stella',
      idCielo: idCielo || null,
      quando: v.migliore.ms,
      altezza: v.migliore.alt,
      azimut: v.migliore.az,
      sopraOstacoli: v.migliore.sopraOstacoli,
      minutiUtili: v.minutiUtili,
      strumentoMinimo: 'occhio',
      mag: s.mag,
      // La distanza sta nel catalogo del planetario, e serve al
      // cartellino della scoperta: «la luce che stai guardando è partita
      // nel 1477» è un numero vero, non un modo di dire. Le stelle delle
      // figure non ce l'hanno, e il cartellino ripiega sulla specie.
      anniLuce: typeof s.ly === 'number' ? s.ly : null,
      magLimiteZenit: cieloLocale.magLimite,
      fondoCielo: cieloLocale.fondo,
      difficolta: s.mag < 1 ? 1 : s.mag < 2.2 ? 2 : 3,
      evidenza: missEvidenzaDaMagnitudine(s.mag),
      didattica: 0.7,
      soffreLaLuna: false,
      aOrarioPreciso: false,
      puntiBase
    }));
  };

  // Le otto per prime: portano la **distanza**, che il cartellino della
  // scoperta trasforma in «la luce che stai guardando è partita nel
  // 1477», e un identificativo che il planetario conosce anche prima che
  // il catalogo grande sia arrivato.
  if (typeof SKY_STELLE !== 'undefined') {
    SKY_STELLE.forEach((s, i) => aggiungiStella(s, 'Star' + (i + 1), 46));
  }
  if (typeof catVociElenco === 'function') {
    for (const v of catVociElenco()) {
      if (v.tipo !== 'stella' || !Number.isFinite(v.ra)) continue;
      aggiungiStella({ nome: v.nome, ra: v.ra, dec: v.dec, mag: v.mag }, v.id, 42);
    }
  }

  // Le costellazioni: il bersaglio è il baricentro delle loro stelle, e
  // la stella più luminosa fa da maniglia. Non hanno un identificativo
  // per il planetario — non sono un oggetto — ma hanno un **punto**, e
  // il ponte del §10 sa centrarci la vista.
  for (const cost of missFigureDelCielo()) {
    const v = missVisibilitaNellaFinestra({ ra: cost.ra, dec: cost.dec }, obs, campioni);
    if (!v) continue;
    fuori.push(missDecoraCandidato({
      id: 'costellazione:' + cost.nome,
      nome: cost.nome,
      sigla: cost.sigla,
      tipo: 'costellazione',
      idCielo: null,
      mira: { ra: cost.ra, dec: cost.dec },
      capofila: cost.capofila,
      antica: cost.antica,
      quando: v.migliore.ms,
      altezza: v.migliore.alt,
      azimut: v.migliore.az,
      sopraOstacoli: v.migliore.sopraOstacoli,
      minutiUtili: v.minutiUtili,
      strumentoMinimo: 'occhio',
      mag: cost.mag,
      magLimiteZenit: cieloLocale.magLimite,
      fondoCielo: cieloLocale.fondo,
      difficolta: cost.difficolta,
      evidenza: missEvidenzaDaMagnitudine(cost.mag) * 0.9,
      didattica: 1,
      soffreLaLuna: false,
      aOrarioPreciso: false,
      puntiBase: 44
    }));
  }

  return fuori;
}

/* Le ottantotto figure, e non le ventitré disegnate.
 *
 * `SKY_COSTELLAZIONI` sono le figure che il planetario **disegna**, e
 * ventitré è il numero giusto per un disegno: le altre sessantacinque
 * sono ghirigori che sullo schermo non aggiungono niente. Ma una caccia
 * non le disegna, le fa cercare, e per lei quel taglio era il motivo per
 * cui «stasera voglio costellazioni» dava sempre il Cigno e la Lira —
 * tolte quelle sotto l'orizzonte restavano otto figure per quattro
 * tappe. Il catalogo completo è già in casa (`COSTELLAZIONI_IAU`,
 * `dati-costellazioni.js`), con la sigla IAU e il **rango**, cioè quanto
 * quella figura è nota.
 *
 * Le due tabelle si sommano invece di sostituirsi, e in quest'ordine:
 * dove il planetario ha la figura si tengono i suoi dati, che sono
 * migliori — porta le stelle **col nome e la magnitudine**, quindi la
 * difficoltà è misurata e non stimata, e la maniglia (`capofila`) è
 * quella vera, che è la riga da cui `missDoppione` capisce che Vega e la
 * Lira sono la stessa tappa. Per le altre la magnitudine si stima dal
 * rango: non è una misura e non finge di esserlo — serve solo a
 * `missVisibileNelCieloLocale` per non proporre l'Indiano da un balcone
 * di città. */
const MISS_FIGURA_DA_RANGO = {
  1: { mag: 2.0, difficolta: 2 },
  2: { mag: 2.9, difficolta: 3 },
  3: { mag: 3.7, difficolta: 4 }
};

/* Questa figura è antica?
 *
 * Serve a una riga sola e sarebbe un dettaglio, se non fosse che quella
 * riga afferma un fatto: il terzo enigma generico delle figure dice «sono
 * più antica di ogni libro, sono servita a sapere quando seminare e da
 * che parte andava la nave». È vero per le quarantotto di Tolomeo e per i
 * pezzi della Nave Argo, ed è **falso** per la Macchina Pneumatica e per
 * il Bulino dello Incisore, che Lacaille ha messo in cielo nel
 * Settecento. Finché in una missione entravano solo le ventitré figure
 * disegnate la domanda non si poneva — sono tutte antiche; da quando ci
 * sono tutte e ottantotto, non chiederselo vorrebbe dire raccontare una
 * cosa non vera con la faccia di un indovinello.
 *
 * Il gruppo lo sa già `costellazioni.js` (`costGruppoDi`), che è dove
 * stanno la storia e i nomi delle altre culture: qui si legge e basta. */
function missFiguraAntica(sigla) {
  if (!sigla || typeof costGruppoDi !== 'function') return true;
  return ['tolomeo', 'argo'].includes(costGruppoDi(sigla));
}

function missFigureDelCielo() {
  const perNome = new Map();

  // Media circolare: 23h e 1h stanno vicino a 0h, non a 12h.
  const baricentro = punti => {
    const x = punti.reduce((s, p) => s + Math.cos(p[0] * Math.PI / 12), 0);
    const y = punti.reduce((s, p) => s + Math.sin(p[0] * Math.PI / 12), 0);
    return {
      ra: (Math.atan2(y, x) * 12 / Math.PI + 24) % 24,
      dec: punti.reduce((s, p) => s + p[1], 0) / punti.length
    };
  };

  if (typeof SKY_COSTELLAZIONI !== 'undefined') {
    for (const cost of SKY_COSTELLAZIONI) {
      if (!cost.stelle || !cost.stelle.length) continue;
      const capofila = cost.stelle.reduce((a, b) => (b[2] < a[2] ? b : a));
      const mag = capofila[2];
      // La sigla IAU, quando il catalogo è arrivato: è l'unico modo di
      // scrivere «Boötes» a chi legge in inglese. `SKY_COSTELLAZIONI`
      // porta il nome italiano e nient'altro, e il dizionario le figure
      // le tiene per sigla (`cost.nome.Boo`).
      const sigla = missSiglaCostellazione(cost.nome);
      perNome.set(cost.nome, Object.assign({
        nome: cost.nome,
        sigla,
        capofila: capofila[3],
        antica: missFiguraAntica(sigla),
        mag,
        difficolta: mag < 1.6 ? 1 : mag < 2.5 ? 2 : 3
      }, baricentro(cost.stelle)));
    }
  }

  if (typeof COSTELLAZIONI_IAU !== 'undefined') {
    for (const c of COSTELLAZIONI_IAU) {
      if (perNome.has(c.nome)) continue;
      const punti = [];
      (c.spezzate || []).forEach(sp => sp.forEach(p => punti.push(p)));
      if (!punti.length) continue;
      const stima = MISS_FIGURA_DA_RANGO[c.rango] || MISS_FIGURA_DA_RANGO[3];
      perNome.set(c.nome, Object.assign({
        nome: c.nome,
        sigla: c.sigla || null,
        // Nessuna stella nominata in questo catalogo: niente maniglia, e
        // `missDoppione` per queste figure si regge sullo slug.
        capofila: null,
        antica: missFiguraAntica(c.sigla),
        mag: stima.mag,
        difficolta: stima.difficolta
      }, baricentro(punti)));
    }
  }

  return [...perNome.values()];
}

/* I candidati che non aspettano: i passaggi delle stazioni spaziali e gli
 * eventi del calendario che cadono dentro alla finestra.
 *
 * Sono l'unica famiglia con un `quando` che non si può spostare, ed è
 * quella che rende una missione una serata invece di una lista. La
 * geometria non la calcola questo file: i passaggi li ha già calcolati
 * `app.js` (SGP4), e gli eventi sono `eventiCalcolati`. */
function missCandidatiAOrarioPreciso(partenzaMs, durataMin) {
  const fuori = [];
  const fine = partenzaMs + durataMin * 60000;

  if (typeof passaggiVisibiliOrdinati === 'function') {
    try {
      for (const p of passaggiVisibiliOrdinati()) {
        // Il culmine e non l'inizio: un passaggio comincia sull'orizzonte,
        // dove non lo vede nessuno, e il punto piu' alto e' quello a cui
        // vale la pena arrivare in tempo.
        const culmine = p.culmine instanceof Date ? p.culmine.getTime() : Number(p.culmine);
        if (!isFinite(culmine) || culmine < partenzaMs || culmine > fine) continue;
        const alt = typeof p.elevazioneMax === 'number' ? p.elevazioneMax : 40;
        const az = typeof p.azCulmine === 'number' ? p.azCulmine : 180;
        if (alt - missOstacolo(az) <= 1) continue;
        const sat = typeof satelliteDaId === 'function' ? satelliteDaId(p.satId) : null;
        fuori.push(missDecoraCandidato({
          id: 'stazione:' + p.satId + ':' + culmine,
          nome: sat ? sat.nome : p.satId,
          tipo: 'stazione',
          satId: p.satId,
          idCielo: 'sat-' + p.satId,
          quando: culmine,
          altezza: alt,
          azimut: az,
          sopraOstacoli: alt - missOstacolo(az),
          minutiUtili: Math.max(2, p.durataMin || 4),
          strumentoMinimo: 'occhio',
          mag: sat ? sat.magTipica : -2,
          difficolta: 1,
          evidenza: 0.95,
          didattica: 0.8,
          soffreLaLuna: false,
          aOrarioPreciso: true,
          puntiBase: 58
        }));
      }
    } catch (e) { /* dati orbitali non ancora arrivati */ }
  }

  if (typeof eventiCalcolati !== 'undefined' && Array.isArray(eventiCalcolati)) {
    for (const ev of eventiCalcolati) {
      if (!ev || !ev.dataObj) continue;
      const ms = ev.dataObj.getTime();
      if (ms < partenzaMs || ms > fine) continue;
      // Un equinozio o una fase lunare non sono cose «da guardare a
      // quell'ora»: cadono a un istante che non ha niente di speciale in
      // cielo. Entrano solo gli eventi con un protagonista da puntare.
      if (!ev.corpoCielo) continue;
      let pos = null;
      try {
        const obs = osservatoreCorrente();
        pos = obs && typeof altAzCorpoQualunque === 'function'
          ? altAzCorpoQualunque(ev.corpoCielo, ev.dataObj, obs) : null;
      } catch (e) { pos = null; }
      if (!pos || typeof pos.alt !== 'number') continue;
      const sopra = pos.alt - missOstacolo(pos.az);
      if (sopra <= 1) continue;
      fuori.push(missDecoraCandidato({
        id: 'evento:' + ev.id,
        nome: ev.titolo,
        tipo: 'evento',
        eventoId: ev.id,
        idCielo: ev.corpoCielo,
        quando: ms,
        altezza: pos.alt,
        azimut: pos.az,
        sopraOstacoli: sopra,
        minutiUtili: 10,
        strumentoMinimo: typeof strumentoEvento === 'function' ? strumentoEvento(ev) : 'occhio',
        mag: null,
        difficolta: 2,
        evidenza: 0.8,
        didattica: 0.9,
        soffreLaLuna: false,
        aOrarioPreciso: true,
        puntiBase: 60
      }));
    }
  }

  return fuori;
}

/* Lo scenario completo: quello che il motore puro riceve in pasto.
 *
 * Qui si raccoglie tutto e si dichiara **cosa manca**. Le tre assenze
 * possibili non sono uguali fra loro: senza posizione non si fa niente
 * (e si dice), senza meteo si fa tutto tranne il giudizio sulle nuvole,
 * senza terreno gli ostacoli sono solo quelli dichiarati a mano. Una
 * missione che non distingue i tre casi finisce col promettere quello
 * che non sa. */
function missScenario(scelte, partenzaMs) {
  const obs = typeof osservatoreCorrente === 'function' ? osservatoreCorrente() : null;
  if (!obs) return { errore: 'senzaPosizione' };
  if (typeof Astronomy === 'undefined') return { errore: 'senzaLibreria' };

  const adesso = Date.now();
  const partenza = partenzaMs || adesso;
  const buio = typeof finestraBuio === 'function' ? finestraBuio(new Date(partenza)) : null;
  const campioni = missCampioni(partenza, scelte.durata);

  const luna = typeof pianDisturboLunare === 'function'
    ? pianDisturboLunare(new Date(partenza)) : { fattore: 0 };
  const nuvole = (typeof pianNuvoleStanotte === 'function' && buio)
    ? pianNuvoleStanotte(buio) : null;
  const bortle = missBortleScelto(scelte);

  /* Solo oggetti identificabili con un tocco sulla mappa: una tappa che
   * non si può confermare non è una tappa, è una domanda senza risposta.
   * Le tre strade del riconoscimento sono quelle di `missSelezioneCorretta`
   * — un `idCielo` che il planetario conosce, la sigla di una figura, o
   * le **coordinate** (le stelle delle figure e del catalogo, che un
   * identificativo non ce l'hanno e non ne hanno bisogno).
   *
   * Qui dentro entrano anche i passaggi delle stazioni e gli eventi del
   * calendario (`missCandidatiAOrarioPreciso`), e vale la pena scrivere
   * perché: quella funzione c'era da sempre, era giusta, e **non la
   * chiamava nessuno**. Il risultato era che il genere «stazioni» non
   * poteva produrre niente — si accendeva la casella, si generava, e
   * usciva la missione di qualcun altro o il vuoto. È il guasto peggiore
   * che questo pannello possa avere, perché una casella che non fa niente
   * è indistinguibile da un cielo che non offre niente. */
  const candidati = missCandidatiDelCielo(obs, campioni, scelte)
    .concat(missCandidatiAOrarioPreciso(partenza, scelte.durata))
    .filter(t => t.idCielo || (t.tipo === 'costellazione' && t.sigla) ||
      (t.tipo === 'stella' && t.mira));

  const storia = missLeggiSalvato(CHIAVE_MISS_STORIA) || {};
  const recenti = (storia.missioniRecenti || [storia.recenti || []]).flat();
  return {
    adesso, partenza, scelte, candidati,
    evitare: recenti, storia: storia.varianti || {}, domande: storia.domande || {},
    posizioneA: (t, ms) => missMisuraTappa(t, new Date(ms), obs),
    condizioni: {
      luna: luna ? luna.fattore : 0,
      nuvole,
      bortle,
      // Le tre dichiarazioni di ignoranza, esplicite: le legge il
      // pannello e ne fa una riga di avviso, invece di tacere.
      meteoAssente: nuvole === null,
      terrenoAssente: !(typeof terrenoDisponibile === 'function' && terrenoDisponibile()),
      buio: buio ? {
        tramonto: buio.tramonto ? buio.tramonto.getTime() : null,
        buioInizio: buio.buioInizio ? buio.buioInizio.getTime() : null,
        buioFine: buio.buioFine ? buio.buioFine.getTime() : null,
        alba: buio.alba ? buio.alba.getTime() : null
      } : null
    }
  };
}

/* L'ora consigliata per cominciare.
 *
 * Se il Sole è ancora alto, una missione «adesso» è una missione a vuoto:
 * si propone allora il momento in cui il cielo comincia davvero a essere
 * cielo — la fine del crepuscolo civile, che è quando le prime stelle
 * compaiono — e chi ha fretta può cominciare lo stesso. */
function missOraConsigliata() {
  const buio = typeof finestraBuio === 'function' ? finestraBuio(new Date()) : null;
  if (!buio || !buio.tramonto) return null;
  const inizio = (buio.nautico || buio.buioInizio || buio.tramonto).getTime();
  return inizio > Date.now() + 5 * 60000 ? inizio : null;
}


// =====================================================================
// 4. LA PERSISTENZA — riprendere quello che si stava facendo
//
//     Una missione si interrompe sempre: si rientra a prendere la
//     giacca, il telefono si blocca, la pagina si ricarica. Quello che
//     non deve succedere è ritrovarsi davanti alla configurazione con
//     tre tappe già trovate buttate via.
//
//     Il salvataggio è **numerato** (`versione`), e chi legge un formato
//     che non conosce non prova a indovinarlo: lo scarta e ricomincia.
//     Una migrazione inventata su un formato futuro è il modo in cui si
//     rompono le app che si aggiornano da sole.
// =====================================================================

/* Tre risposte e non due, ed è la differenza che conta: `undefined` vuol
 * dire «non c'è niente salvato», `null` vuol dire «c'è qualcosa e non si
 * legge». La seconda va **buttata**, se no resta lì a farsi rileggere e
 * riscartare a ogni apertura per sempre; la prima non c'è niente da
 * buttare. Con una risposta sola per tutti e due i casi un salvataggio
 * rotto diventa immortale. */
function missLeggiSalvato(chiave) {
  let grezzo = null;
  try {
    grezzo = localStorage.getItem(chiave);
  } catch (e) {
    return undefined;                      // storage negato: non c'è niente
  }
  if (grezzo === null || grezzo === '') return undefined;
  try {
    const dato = JSON.parse(grezzo);
    return (dato && typeof dato === 'object') ? dato : null;
  } catch (e) {
    return null;                            // c'è, ed è illeggibile
  }
}

function missScrivi(chiave, valore) {
  try {
    if (valore === null) localStorage.removeItem(chiave);
    else localStorage.setItem(chiave, JSON.stringify(valore));
    return true;
  } catch (e) {
    return false;
  }
}

function missCaricaScelte() {
  const s = missLeggiSalvato(CHIAVE_MISS_SCELTE);
  if (!s || typeof s !== 'object') return;
  if (MISS_DURATE.includes(s.durata)) miss.scelte.durata = s.durata;
  if (MISS_STRUMENTI.includes(s.strumento)) miss.scelte.strumento = s.strumento;
  // La missione usa sempre il cielo piu' stellato (Bortle 2): non eredita
  // ne' ripropone piu' l'inquinamento luminoso salvato in passato.
  miss.scelte.bortle = 2;
  /* I gradini erano due e adesso sono tre. Una preferenza salvata non può
   * far ricomparire una modalità che non esiste più: «stupore» e
   * «imparare», che erano i due percorsi morbidi, diventano il gradino di
   * mezzo — quello che a suo tempo li aveva sostituiti tutti e due era il
   * gradino difficile, e a chi voleva essere accompagnato non si può
   * continuare a dare un esame. */
  miss.scelte.esperienza = MISS_ESPERIENZE.includes(s.esperienza) ? s.esperienza : 'curiosi';
  if (s.cielo === 'tutto' || s.cielo === 'settore') miss.scelte.cielo = s.cielo;
  if (MISS_DIREZIONI.includes(Number(s.cieloDa))) miss.scelte.cieloDa = Number(s.cieloDa);
  if (MISS_DIREZIONI.includes(Number(s.cieloA))) miss.scelte.cieloA = Number(s.cieloA);
  if (typeof s.voce === 'boolean') miss.scelte.voce = s.voce;
  // Le vecchie preferenze `generi` vengono intenzionalmente ignorate:
  // ogni nuova missione torna a considerare tutti gli oggetti possibili.
  if (['adesso', 'consigliato', 'personalizzato'].includes(s.momento)) miss.scelte.momento = s.momento;
  if (typeof s.momentoPersonalizzato === 'number' && Number.isFinite(s.momentoPersonalizzato)) {
    miss.scelte.momentoPersonalizzato = s.momentoPersonalizzato;
  }
}

function missSalvaScelte() {
  missScrivi(CHIAVE_MISS_SCELTE, miss.scelte);
}

// Una missione salvata è buona se è del formato che conosciamo, ha delle
// tappe, e non è di ieri notte.
function missSalvataggioBuono(m) {
  if (!m || typeof m !== 'object') return false;
  if (m.versione !== MISS_VERSIONE) return false;
  if (!Array.isArray(m.tappe) || !m.tappe.length) return false;
  if (!m.tappe.every(t => t && typeof t.nome === 'string')) return false;
  const quando = Number(m.avviata || m.partenza || m.creata);
  if (!isFinite(quando)) return false;
  return Date.now() - quando < MISS_SCADENZA_MS;
}

function missCaricaAttiva() {
  const m = missLeggiSalvato(CHIAVE_MISS_ATTIVA);
  miss.attiva = missSalvataggioBuono(m) ? m : null;
  // Quello che c'era e non serve più — illeggibile, di un formato che non
  // conosciamo, o di ieri notte — si butta subito: tenerlo vuol dire
  // rileggerlo e riscartarlo a ogni apertura, per sempre.
  if (m !== undefined && !miss.attiva) missScrivi(CHIAVE_MISS_ATTIVA, null);
  return miss.attiva;
}

function missSalvaAttiva() {
  if (!miss.attiva) { missScrivi(CHIAVE_MISS_ATTIVA, null); return; }
  missScrivi(CHIAVE_MISS_ATTIVA, miss.attiva);
}

// Il cielo di una missione ripresa può non essere più quello: se gli
// eventi a orario preciso sono passati, o se è passata più di mezz'ora,
// conviene rigenerarla invece di riprenderla com'è.
function missDaAggiornare(m) {
  if (!m) return false;
  const adesso = Date.now();
  const scadute = m.tappe.some(t => t.aOrarioPreciso && !t.esito && t.quando < adesso);
  const finita = m.avviata && adesso - m.avviata > (m.scelte.durata + 45) * 60000;
  return scadute || finita;
}


// =====================================================================
// 5. IL PONTE COL PLANETARIO
//
//     «Guidami» non apre una seconda mappa del cielo: apre **quella**,
//     con l'orologio sull'istante della tappa e la vista sul bersaglio.
//     Tutto quello che serve esiste già (`mostraVista`, `skyImpostaTarget`,
//     `skyImpostaOffsetTempo`, `skyCentraSu`), e la sola cosa che questo
//     file aggiunge è la **striscia della missione**: chi arriva nel
//     planetario da qui deve sapere perché ci è arrivato e come tornare
//     indietro, se no il cielo è bellissimo e la missione è persa.
// =====================================================================

// Una tappa si può puntare nel planetario? Le costellazioni non hanno un
// identificativo — non sono un oggetto — ma hanno un punto, e quello
// basta a centrare la vista. Chi non ha né l'uno né l'altro non deve
// mostrare un tasto che non può funzionare.
function missTappaPuntabile(t) {
  return !!(t && (t.idCielo || (t.mira && typeof t.mira.ra === 'number')));
}

// La scelta fatta nella configurazione governa anche l'orologio del cielo.
// Una missione «adesso» deve restare agganciata al tempo reale; una serata
// preparata per più tardi, invece, va mostrata all'istante della tappa. Senza
// questo passaggio il planetario tornava sempre a ora e faceva vedere il cielo
// diurno proprio mentre la missione descriveva quello della sera.
function missImpostaTempoPlanetario(m, t) {
  if (!m || !m.simulazione) {
    skyImpostaOffsetTempo(0, { reale: true });
    return;
  }
  const previsto = t && typeof t.quando === 'number' ? t.quando : NaN;
  const partenza = typeof m.partenza === 'number' ? m.partenza : NaN;
  const istante = Number.isFinite(previsto) ? previsto : partenza;
  if (Number.isFinite(istante)) skyImpostaOffsetTempo((istante - Date.now()) / 1000);
  else skyImpostaOffsetTempo(0, { reale: true });
}

// Aprire la mappa e chiedere un indizio sono azioni distinte.
function missGuidami(indice) {
  const m = miss.attiva, t = m && m.tappe[indice];
  if (!t || !missTappaPuntabile(t)) return;
  m.corrente = indice;
  // Entrare nel cielo mostra l'indizio principale. Gli aiuti restano una
  // scelta esplicita e non si sommano ogni volta al testo della tappa.
  t.mostraAiuto = false;
  m.nelPlanetario = true;
  missSalvaAttiva();
  missChiudiPannello({ tieniMissione: true });
  if (typeof mostraVista === 'function') mostraVista('cielo');
  skyMostraGruppo('');
  skyTornaAlLuogoDiCasa();
  skyFermaPlayback();
  missImpostaTempoPlanetario(m, t);
  skyChiudiDettaglio();
  sky.target = null;
  sky.centraQuandoPronto = null;
  skySpegniInseguimento();
  skyFermaMovimenti();
  sky.mostraCostellazioni = true;
  if (String(t.idCielo).startsWith('dso:')) sky.mostraProfondo = true;
  if (String(t.idCielo).startsWith('min:')) { sky.mostraCorpiMinori = true; corpiMinoriCarica(); }
  skyAggiornaOggetti(true);
  const o = t.idCielo && skyVoceDiId(t.idCielo);
  if (o) skyAssicuraVisibile(o);
  missAttivaTelefono();
  skyAggiornaTastiFiltri();
  missMostraStrisciaCielo();
  missRaccontaTappa(t);
}

function missRicercaAttiva() {
  const m = miss.attiva, t = m && m.tappe[m.corrente];
  return !!(m && m.stato === 'inCorso' && m.nelPlanetario && t && !t.esito && t.fase !== 'scoperta');
}

function missTitoloTappa(t) {
  // Durante il gioco il bersaglio resta un mistero: il nome compare soltanto
  // dopo la scoperta (o quando la tappa ha gia' un esito). L'anteprima usa
  // invece direttamente `missNomeTappa`, cosi' chi prepara la serata conosce
  // in anticipo tutti gli oggetti senza rovinare la caccia una volta avviata.
  return t.fase === 'scoperta' || t.esito ? missNomeTappa(t) : missT('gioco.mistero');
}

function missMisuraTappa(t, data, obs) {
  /* Un passaggio di stazione non si rimisura, e sono due ragioni diverse.
   *
   * La prima è che non si **può**: «sat-iss» non è un corpo della
   * libreria, quindi `altAzCorpo` solleva, e sollevare qui vuol dire
   * altezza −90 — cioè una tappa che sparisce senza dire perché. È il
   * secondo motivo per cui il genere «stazioni» restava vuoto anche col
   * passaggio in cielo: il raccoglitore lo trovava, e il primo
   * riallineamento degli orari lo buttava via.
   *
   * La seconda è che non **serve**: la posizione di un passaggio l'ha già
   * calcolata `app.js` con SGP4, ed è quella del culmine — l'unico
   * istante di quei cinque minuti a cui valga la pena arrivare. E il
   * crepuscolo qui non si applica: una stazione si vede proprio col Sole
   * appena sotto l'orizzonte, perché lassù è ancora illuminata. */
  if (t.tipo === 'stazione') {
    return {
      altezza: t.altezza, azimut: t.azimut,
      sopraOstacoli: typeof t.sopraOstacoli === 'number'
        ? t.sopraOstacoli : t.altezza - missOstacolo(t.azimut)
    };
  }
  try {
    // `altAzCorpoQualunque` sa leggere anche `dso:` e `min:`, che è quello
    // che porta l'`idCielo` di un evento del calendario con una cometa o
    // una nebulosa per protagonista.
    const p = t.mira ? altAzCoordinate(t.mira.ra, t.mira.dec, data, obs) :
      (typeof altAzCorpoQualunque === 'function'
        ? altAzCorpoQualunque(t.corpo || t.idCielo, data, obs)
        : altAzCorpo(t.corpo || t.idCielo, data, obs));
    if (!p) return { altezza: -90, sopraOstacoli: -90 };
    const sole = altAzCorpo('Sun', data, obs);
    return { altezza: sole.alt > -6 && t.tipo !== 'luna' ? -90 : p.alt,
      azimut: p.az, sopraOstacoli: p.alt - missOstacolo(p.az) };
  } catch (e) { return { altezza: -90, sopraOstacoli: -90 }; }
}

function missTappaAdesso(t) {
  const obs = typeof osservatoreCorrente === 'function' && osservatoreCorrente();
  if (!obs) return Object.assign({}, t, { altezza: -90 });
  return Object.assign({}, t, missMisuraTappa(t, new Date(), obs));
}

// Nella missione avviata all'ora consigliata il planetario e' una
// simulazione: indizi e tocchi vanno verificati sull'ora mostrata, non
// sull'orologio reale. La missione iniziata con «Inizia adesso» continua
// invece a usare il cielo vero di questo istante.
function missTappaNelPlanetario(t) {
  const obs = typeof osservatoreCorrente === 'function' && osservatoreCorrente();
  if (!obs) return Object.assign({}, t, { altezza: -90 });
  const data = miss.attiva && miss.attiva.simulazione && typeof skyAdesso === 'function'
    ? skyAdesso() : new Date();
  return Object.assign({}, t, missMisuraTappa(t, data, obs));
}

/* Il primo istante in cui la tappa torna davvero cercabile.
 *
 * Prima la guida si limitava a dire di abbandonare la missione se il cielo
 * era chiaro o l'astro era tramontato. L'orario, pero', il motore sa
 * calcolarlo: si prova prima quello gia' pianificato e poi, per gli astri
 * ordinari, si percorrono le prossime trentasei ore a passi di cinque minuti.
 * Gli eventi a orario preciso non vengono inventati il giorno seguente. */
function missProssimoIstanteCercabile(t) {
  if (!t || !miss.attiva || typeof osservatoreCorrente !== 'function') return null;
  const obs = osservatoreCorrente();
  if (!obs) return null;
  const adesso = Date.now();
  const ammissibileA = ms => missAmmissibile(
    Object.assign({}, t, missMisuraTappa(t, new Date(ms), obs)), miss.attiva.scelte);
  if (Number.isFinite(t.quando) && t.quando > adesso && ammissibileA(t.quando)) return t.quando;
  if (t.aOrarioPreciso) return null;
  const passo = 5 * 60000;
  const fine = adesso + 36 * 3600000;
  for (let ms = adesso + passo; ms <= fine; ms += passo) {
    if (ammissibileA(ms)) return ms;
  }
  return null;
}

function missSelezioneCorretta(t, sel) {
  if (!t || !sel) return false;
  if (sel.categoria === 'astro') return !!t.idCielo && sel.id === t.idCielo;
  if (t.tipo === 'costellazione') return sel.categoria === 'costellazione' && sel.sigla === t.sigla;
  const d = sel.dati || {};
  if (sel.categoria === 'profondo') return t.idCielo === 'dso:' + d.nome;
  if (sel.categoria === 'corpoMinore') return t.idCielo === 'min:' + d.nome;
  /* Le stelle luminose possono comparire anche nel catalogo e nelle figure.
   *
   * L'**indice del catalogo** viene prima delle coordinate, e non è una
   * scorciatoia: fra le due c'è la precessione. Le stelle del catalogo
   * sono in J2000, il planetario le disegna dov'erano portate all'equatore
   * di oggi (`catMatriceCielo`), e la missione le misura con
   * `altAzCoordinate` — che quelle coordinate le prende per buone così
   * come sono. Fra i due punti ballano **0,4 gradi**: invisibili a chi
   * guarda in su, tredici pixel sullo schermo, cioè più della finestra
   * con cui `catStellaNelPunto` decide di aver colpito una stella.
   * Misurato nel browser su Mirfak: toccandola non si riconosceva niente
   * e la risposta cadeva sulla figura di Perseo, cioè «no, non è questo»
   * — venti bersagli su sessantuno che non si potevano chiudere. Con
   * l'indice il confronto è fra due numeri interi e la precessione non
   * c'entra più.
   *
   * Le coordinate restano per i bersagli che un indice non ce l'hanno:
   * le otto stelle di `SKY_STELLE` e i vertici delle figure. */
  if (t.tipo !== 'stella' || !['figura', 'stellaCatalogo'].includes(sel.categoria)) return false;
  const indice = /^cat:(\d+)$/.exec(String(t.idCielo || ''));
  if (indice) return Number(indice[1]) === d.indiceCatalogo;
  return Number.isFinite(d.ra) && Number.isFinite(d.dec) && t.mira &&
    Math.abs(d.ra - t.mira.ra) < 0.002 && Math.abs(d.dec - t.mira.dec) < 0.02;
}

// Ricava la posizione della scelta senza mostrarne il nome. Serve soltanto a
// distinguere un tentativo lontano da uno vicino al bersaglio.
function missPosizioneSelezione(sel) {
  if (!sel || typeof sky !== 'object') return null;
  let o = null;
  if (sel.categoria === 'astro' && Array.isArray(sky.oggetti))
    o = sky.oggetti.find(x => x.id === sel.id);
  else if (sel.categoria === 'profondo' && Array.isArray(sky.profondo)) {
    const nome = sel.dati && sel.dati.nome;
    o = sky.profondo.find(x => x.nome === nome);
  } else if (sel.dati) o = sel.dati;
  if (!o) return null;
  const azimut = Number.isFinite(o.az) ? o.az : o.azimut;
  const altezza = Number.isFinite(o.alt) ? o.alt : o.altezza;
  if (!Number.isFinite(azimut) || !Number.isFinite(altezza)) return null;
  return { azimut, altezza };
}

function missFeedbackTocco(chiave) {
  // Il riscontro e' un messaggio breve sopra la carta, non una nuova riga
  // nella guida: l'indizio principale resta fermo e leggibile.
  if (typeof skyAvviso === 'function') skyAvviso('missione-tocco', missT(chiave), 2200);
}

// Chiamata soltanto dall'hit test del canvas, prima di aprire schede o atlante.
function missSelezionaCielo(sel) {
  if (!missRicercaAttiva()) return false;
  const m = miss.attiva, t = m.tappe[m.corrente];
  const obs = osservatoreCorrente();
  const stessoLuogo = obs && sky.observer &&
    Math.abs(obs.latitude - sky.observer.latitude) < 0.01 &&
    Math.abs(obs.longitude - sky.observer.longitude) < 0.01;
  const tempoGiusto = m.simulazione || Math.abs(skyAdesso().getTime() - Date.now()) <= 120000;
  if (!stessoLuogo || !tempoGiusto || !missAmmissibile(missTappaNelPlanetario(t), m.scelte)) {
    // `missIndizio` mostra gia' l'avviso: non copiarlo una seconda volta
    // nella riga di feedback a ogni tocco.
    t.feedback = null;
  } else if (missSelezioneCorretta(t, sel)) {
    t.fase = 'scoperta';
    t.esito = 'trovato';
    t.quandoEsito = Date.now();
    t.feedback = null;
    missFeedbackTocco('gioco.feedbackGiusto');
    missFuochiArtificio();
    missFermaVoce();
    missRaccontaTappa(t);
  } else {
    t.tentativi = (t.tentativi || 0) + 1;
    t.feedback = null;
    const scelta = missPosizioneSelezione(sel);
    const bersaglio = missTappaNelPlanetario(t);
    const soglia = m.scelte.esperienza === 'bambini' ? 18 : 10;
    const vicino = scelta && missDistanzaSferica(scelta, bersaglio) <= soglia;
    missFeedbackTocco(vicino ? 'gioco.feedbackVicino' : 'gioco.feedbackSbagliato');
  }
  missSalvaAttiva();
  missMostraStrisciaCielo();
  return true;
}

/* Il premio esplode nel cielo, non nel pannello. Le scintille hanno scia,
 * resistenza dell'aria e gravita' proprie; il canvas non prende i tocchi e
 * si elimina da solo, lasciando vivere il planetario sottostante. */
function missFuochiArtificio() {
  if (typeof document === 'undefined') return;
  const cielo = document.getElementById('skymap-contenitore');
  if (!cielo) return;
  cielo.querySelector('.missione-fuochi')?.remove();
  const tela = document.createElement('canvas');
  tela.className = 'missione-fuochi';
  tela.setAttribute('aria-hidden', 'true');
  cielo.appendChild(tela);
  const rett = cielo.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  tela.width = Math.max(1, Math.round(rett.width * dpr));
  tela.height = Math.max(1, Math.round(rett.height * dpr));
  const ctx = tela.getContext('2d');
  if (!ctx) { tela.remove(); return; }
  ctx.scale(dpr, dpr);
  const ridotto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colori = [18, 36, 48, 120, 195, 214, 285, 330];
  const particelle = [];
  const razzi = [];
  const durata = ridotto ? 900 : 15500;
  // Fuochi ancorati alla sfera celeste, non ai pixel. Cosi' un cambio di
  // zoom ingrandisce o rimpicciolisce davvero razzi, scie e corone insieme
  // alle stelle, invece di lasciare una decorazione incollata allo schermo.
  const proietta = p => (typeof skyProietta === 'function' && sky.ultimaBase && sky.ultimaFocale)
    ? skyProietta(skyVettore(p.az, p.alt), sky.ultimaBase, sky.ultimaFocale) : null;
  const orizzonte = az => Math.max(0,
    typeof terrenoAltezza === 'function' ? (terrenoAltezza(az) || 0) : 0,
    typeof orizzonteAltezza === 'function' ? (orizzonteAltezza(az) || 0) : 0);
  const esplodi = (az, alt, tinta, n) => {
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 2 * i / n + (Math.random() - .5) * .08;
      const v = .12 + Math.random() * .3;
      particelle.push({ az, alt, paz:az, palt:alt, vaz:Math.cos(a)*v, valt:Math.sin(a)*v,
        vita:1, calo:.006+Math.random()*.007, tinta, luce:62+Math.random()*20,
        scintilla: Math.random() > .35 });
    }
  };
  const lancia = () => {
    const az = ((sky.manuale.az + (Math.random() - .5) * Math.min(70, sky.fov * .8)) % 360 + 360) % 360;
    const base = orizzonte(az) + .5;
    razzi.push({ az, alt:base, paz:az, palt:base, vaz:(Math.random()-.5)*.025,
      valt:.32+Math.random()*.14, bersaglio:base+12+Math.random()*18,
      tinta: colori[Math.floor(Math.random() * colori.length)] });
  };
  if (ridotto) esplodi(sky.manuale.az, Math.max(orizzonte(sky.manuale.az) + 8, sky.manuale.alt), 46, 24);
  else {
    // Gli scoppi arrivano in piccole salve per tutta la celebrazione: prima
    // si vede salire il razzo, poi la corona e infine le scintille che cadono.
    [0, 500, 1450, 2200, 3400, 4300, 5600, 6500, 7900, 9000, 10300, 11600, 13000, 14000]
      .forEach(attesa => setTimeout(lancia, attesa));
  }
  const inizio = performance.now();
  function fotogramma(ora) {
    // Si scolora il canvas stesso, senza stendere un velo nero sopra stelle
    // e pianeti: lo spettacolo resta davvero dentro al planetario.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, .16)';
    ctx.fillRect(0, 0, rett.width, rett.height);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = razzi.length - 1; i >= 0; i--) {
      const r = razzi[i]; r.paz=r.az; r.palt=r.alt; r.az+=r.vaz; r.alt+=r.valt; r.valt-=.0012;
      const a=proietta({az:r.paz,alt:r.palt}), b=proietta(r);
      if (a && b && a.davanti && b.davanti) { ctx.beginPath(); ctx.moveTo(a.px,a.py); ctx.lineTo(b.px,b.py);
        ctx.strokeStyle=`hsla(${r.tinta},100%,82%,.9)`; ctx.lineWidth=1.7; ctx.stroke(); }
      if (r.alt >= r.bersaglio || r.valt <= .08) {
        esplodi(r.az, r.alt, r.tinta, 68 + Math.floor(Math.random() * 34));
        razzi.splice(i, 1);
      }
    }
    for (let i = particelle.length-1; i >= 0; i--) {
      const p=particelle[i]; p.paz=p.az; p.palt=p.alt; p.az+=p.vaz; p.alt+=p.valt;
      p.vaz*=.988; p.valt=p.valt*.988-.0025; p.vita-=p.calo;
      // Una scintilla viene eliminata appena incontra il profilo: nessuna
      // coda puo' trapassare una collina o continuare sotto il terreno.
      if (p.vita<=0 || p.alt<=orizzonte(p.az)) { particelle.splice(i,1); continue; }
      const a=proietta({az:p.paz,alt:p.palt}), b=proietta(p);
      if (!a || !b || !a.davanti || !b.davanti) continue;
      ctx.beginPath(); ctx.moveTo(a.px,a.py); ctx.lineTo(b.px,b.py);
      const tremolio = p.scintilla && Math.random() > .72 ? .25 : 1;
      ctx.strokeStyle=`hsla(${p.tinta},100%,${p.luce}%,${Math.max(0,p.vita) * tremolio})`;
      ctx.lineWidth=.6+1.8*p.vita; ctx.stroke();
    }
    if (ora-inizio < durata || particelle.length || razzi.length) requestAnimationFrame(fotogramma);
    else tela.remove();
  }
  requestAnimationFrame(fotogramma);
}

function missAttivaTelefono() {
  if (!missRicercaAttiva() || sky.sensoriNegati || miss.telefonoProvato) return;
  // Un cielo futuro si esplora come una carta: il telefono non deve
  // riportare la simulazione nella direzione in cui e' puntato adesso.
  if (miss.attiva && miss.attiva.simulazione) {
    miss.telefonoProvato = true;
    if (sky.seguiTelefono) skyAlternaSeguiTelefono();
    return;
  }
  if (sky.sensori && sky.assoluto && skyAssettoDisponibile()) {
    miss.telefonoProvato = true;
    if (!sky.seguiTelefono) skyAlternaSeguiTelefono();
    return;
  }
  // iOS richiede il gesto: resta il comando di permesso già presente nell'app.
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission !== 'function') skyAvviaSensori();
}

// Il comando nella striscia nasce da un gesto esplicito, quindi puo' anche
// aprire la richiesta di permesso di iOS attraverso il ponte gia' usato dal
// planetario. In una simulazione futura la direzione fisica del telefono non
// corrisponde al cielo mostrato e il comando viene lasciato disabilitato.
function missSeguiTelefono() {
  if (!missRicercaAttiva() || (miss.attiva && miss.attiva.simulazione)) return;
  miss.telefonoProvato = true;
  if (!sky.seguiTelefono) skyAlternaSeguiTelefono();
  missMostraStrisciaCielo();
}

function missGuidaMirino(base, t) {
  const v = skyVettore(t.azimut, t.altezza);
  const dot = a => a.reduce((somma, n, i) => somma + n * v[i], 0);
  const distanza = Math.acos(Math.max(-1, Math.min(1, dot(base.f)))) * 180 / Math.PI;
  if (distanza < 3) return missT('gioco.quasi');
  const x = dot(base.r), y = dot(base.u);
  return missT('gioco.mirino', { direzione: missT('verso.' +
    (Math.abs(x) > Math.abs(y) ? (x > 0 ? 'destra' : 'sinistra') :
      (y > 0 ? 'piuInAlto' : 'piuInBasso'))), gradi: Math.round(distanza) });
}

// Usa il ciclo esistente del planetario; niente timer o sensori duplicati.
function missAggiornaMirino(base) {
  if (!missRicercaAttiva() || Date.now() - (miss.ultimoMirino || 0) < 700) return;
  miss.ultimoMirino = Date.now();
  missAttivaTelefono();
  const t = missTappaNelPlanetario(miss.attiva.tappe[miss.attiva.corrente]);
  document.body.classList.toggle('missione-senza-sensori',
    !(sky.sensori && sky.assoluto && skyAssettoDisponibile()) &&
    (sky.sensoriNegati || !skyEUnTelefonoConSensoriProtetti()));
  const el = document.getElementById('missione-mirino');
  if (el) el.textContent = !missAmmissibile(t, miss.attiva.scelte) || !skyUsaSensori()
    ? '' : missGuidaMirino(base, t);
}

/* La schermata della scoperta: il premio.
 *
 * È il mezzo minuto per cui esiste tutto il resto, e va costruito come si
 * costruisce un premio — prima la conferma, poi il nome, poi qualcosa che
 * non si sapeva. Le quattro righe sono in quest'ordine di proposito:
 *
 *   il **nome** e la sua specie, perché la prima cosa che si vuole sapere
 *   è che cosa si è trovato, detto con la parola giusta;
 *   il **cartellino**, un numero vero e immaginabile (§`missCartellino`);
 *   l'**aneddoto**, che è il mito, la scoperta o la stranezza — e se ce
 *   n'è più di uno si può chiederne un altro senza perdere la tappa. */
function missHtmlScoperta(t) {
  const cartellino = missCartellino(t);
  const altre = missQuanteVarianti('curiosita.' + missBaseRacconto(t)) > 1;
  return `<div class="missione-scoperta">
    ${missManigliaStriscia()}
    <button type="button" class="missione-striscia-chiudi" data-miss-azione="termina"
      aria-label="${missT('terminaPlanetario')}">×</button>
    <h3>${missT('gioco.scoperta', { nome: missTesto(missNomeTappa(t)) })}</h3>
    <p class="missione-specie">${missTesto(missSpecieTappa(t))}${
      cartellino ? ' · <span class="missione-cartellino">' + missTesto(cartellino) + '</span>' : ''}</p>
    <p class="missione-aneddoto">${missTesto(missCuriositaTesto(t))}</p>
    <div class="missione-scoperta-azioni">
      ${altre ? `<button type="button" class="missione-tasto missione-tasto-lieve"
        data-miss-azione="altraStoria">${missT('gioco.altraStoria')}</button>` : ''}
      <button type="button" class="missione-tasto missione-tasto-si" data-miss-azione="continua">${missT('gioco.continua')}</button>
    </div>
  </div>`;
}

function missManigliaStriscia() {
  return `<button type="button" class="missione-trascina"
    aria-label="${missT('spostaRiquadro')}" title="${missT('spostaRiquadro')}">⠿</button>`;
}

function missIndiceIndizio(t) {
  if (Number.isInteger(t && t.indizioMostrato)) return Math.max(0, Math.min(t.aiuto || 0, t.indizioMostrato));
  return t && t.mostraAiuto ? (t.aiuto || 0) : 0;
}

function missTestoIndizio(t) {
  const indice = missIndiceIndizio(t);
  // Rivelata, il testo è la risposta: il nome, e basta. Continuare a
  // mostrare il terzo indizio dopo che si è chiesta la soluzione vuol
  // dire far leggere un enigma di cui si conosce già la risposta.
  if (t && t.rivelata && indice >= MISS_INDIZI) {
    return missT('gioco.soluzioneE', { nome: missNomeTappa(t), dove: missDoveOra(t) });
  }
  return indice ? missIndizio(Object.assign({}, t, { aiuto: indice })) : missIntroduzione(t);
}

/* La navigazione: zero è il primo indizio, uno e due sono gli aiuti.
 *
 * La freccia in avanti si ferma al terzo, e non prosegue nella
 * soluzione: quella è un tasto suo, e continuare a premere «avanti»
 * finché il bersaglio si rivela è il modo in cui prima la caccia finiva
 * senza che nessuno l'avesse deciso. */
function missNavigazioneIndizi(t) {
  const indice = missIndiceIndizio(t);
  const rivelata = !!(t && t.rivelata);
  /* La domanda iniziale e' «Indizio 1»: la parola tecnica usata dal
   * motore non deve comparire nel gioco. I due aiuti diventano quindi gli
   * indizi 2 e 3, prima della soluzione separata. */
  const etichetta = rivelata && indice >= MISS_INDIZI ? missT('soluzione')
    : missT('numeroIndizio', { n: indice + 1, tot: MISS_INDIZI + 1 });
  return `<div class="missione-navigazione-indizi" aria-label="${missT('navigaIndizi')}">
    <button type="button" class="missione-freccia" data-miss-azione="indizio-precedente"
      aria-label="${missT('indizioPrecedente')}" ${indice === 0 ? 'disabled' : ''}>←</button>
    <span class="missione-numero-indizio">${etichetta}</span>
    <button type="button" class="missione-freccia" data-miss-azione="indizio-successivo"
      aria-label="${missT('indizioSuccessivo')}" ${indice >= MISS_INDIZI ? 'disabled' : ''}>→</button>
  </div>`;
}

/* Il tasto della soluzione, che compare solo quando è il momento.
 *
 * Prima dei tre indizi non c'è: offrire la risposta a chi ha appena letto
 * l'enigma è togliergli la caccia di mano. Dopo che è stata data, sparisce
 * — un tasto che non fa più niente è un tasto rotto. */
function missTastoSoluzione(t) {
  if (!t || t.fase === 'scoperta' || t.rivelata) return '';
  if ((t.aiuto || 0) < MISS_INDIZI) return '';
  return `<button type="button" class="missione-tasto missione-tasto-soluzione"
    data-miss-azione="soluzione">${missIcona('bersaglio', 16)} ${missT('mostraSoluzione')}</button>`;
}

function missMostraStrisciaCielo() {
  const el = document.getElementById('missione-striscia');
  const m = miss.attiva, t = m && m.tappe[m.corrente];
  const visibile = !!(m && m.nelPlanetario && m.stato === 'inCorso' && t);
  document.body.classList.toggle('missione-ricerca', visibile && missRicercaAttiva());
  if (!el) return;
  el.classList.toggle('hidden', !visibile);
  el.classList.toggle('visibile', visibile);
  el.classList.toggle('solo-voce', visibile && miss.strisciaNascosta);
  if (visibile && miss.posizioneStriscia) missPosizionaStriscia(el,
    miss.posizioneStriscia.left, miss.posizioneStriscia.top);
  if (!visibile) { document.body.classList.remove('missione-senza-sensori'); return; }
  if (miss.strisciaNascosta) {
    el.innerHTML = `${missManigliaStriscia()}<button type="button" class="missione-striscia-chiudi" data-miss-azione="termina"
        aria-label="${missT('terminaPlanetario')}">×</button>
      <button type="button" class="missione-tasto missione-ripristina" data-miss-azione="mostra-guida">
        ${missT('mostraGuida')}</button>`;
    el.querySelectorAll('[data-miss-azione]').forEach(b =>
      b.addEventListener('click', () => missAzione(b.dataset.missAzione, el)));
    return;
  }
  const istanteCercabile = t.fase === 'scoperta' ||
    missAmmissibile(missTappaNelPlanetario(t), m.scelte) ? null : missProssimoIstanteCercabile(t);
  el.innerHTML = t.fase === 'scoperta' ? missHtmlScoperta(t) : `
    ${missManigliaStriscia()}
    <button type="button" class="missione-striscia-chiudi" data-miss-azione="termina"
      aria-label="${missT('terminaPlanetario')}">×</button>
    <div class="missione-striscia-testo">
      <span class="missione-striscia-titolo">${missT('tappaDi', { n: m.corrente + 1, tot: m.tappe.length })} · ${missTesto(missTitoloTappa(t))}</span>
      <p class="missione-striscia-indizio">${missTesto(missTestoIndizio(t))}</p>
      ${Number.isFinite(istanteCercabile) ? `<button type="button" class="missione-tasto missione-tasto-si"
        data-miss-azione="vai-al-momento">${missT('vaiAlMomento', { ora: missOra(istanteCercabile) })}</button>` : ''}
      <span id="missione-mirino" aria-live="off"></span>
    </div>
    <div class="missione-striscia-tasti">
      <button class="missione-tasto missione-tasto-lieve" data-miss-azione="solo-voce">${missT('soloVoce')}</button>
      <button class="missione-tasto${sky.seguiTelefono ? ' attiva' : ''}" data-miss-azione="segui-telefono"
        ${m.simulazione ? 'disabled' : ''}>${missT('seguiTelefono')}</button>
      ${missNavigazioneIndizi(t)}
      ${missTastoSoluzione(t)}
      <button class="missione-tasto missione-tasto-lieve" data-miss-azione="salta">${missT('salta')}</button>
    </div>`;
  el.querySelectorAll('[data-miss-azione]').forEach(b => b.addEventListener('click', () => missAzione(b.dataset.missAzione, el)));
}

// Si torna alla missione senza perdere niente: la missione è nello stato,
// non nel documento, e il pannello la ridisegna da lei.
function missPausaCielo() {
  if (!miss.attiva || !miss.attiva.nelPlanetario) return;
  miss.attiva.nelPlanetario = false;
  miss.posizioneStriscia = null;
  const striscia = document.getElementById('missione-striscia');
  if (striscia) striscia.removeAttribute('style');
  missFermaVoce();
  missSalvaAttiva();
  missMostraStrisciaCielo();
}

function missTornaDalPlanetario() {
  if (miss.attiva) { miss.attiva.nelPlanetario = false; missSalvaAttiva(); }
  missMostraStrisciaCielo();
  if (typeof mostraVista === 'function') mostraVista('stasera');
  missApriPannello();
}


// =====================================================================
// 6. LA MISSIONE IN CORSO — avanzare, aiutare, sostituire, concludere
//
//     Tre esiti e non due: **trovato**, **saltato**, **non trovato**.
//     Sono tre fatti diversi e vanno tenuti distinti fino al diario:
//     saltare è una scelta (era nuvoloso, era dietro al tetto), non
//     trovare è un tentativo andato male, e chi li mette nello stesso
//     mucchio scrive un diario che non racconta niente.
// =====================================================================

/* Quanto ci si può allontanare dall'ora per cui la missione è stata
 * pensata prima che le sue tappe smettano di parlare del cielo giusto.
 * Venti minuti di cielo sono cinque gradi di rotazione, che non spostano
 * niente; sei ore sono un'altra notte. */
const MISS_SCARTO_RIGENERA_MS = 20 * 60000;

function missAvvia(missione, quando) {
  if (!missione) return;
  const partenza = quando || Date.now();
  const simulazione = Number.isFinite(quando) && Math.abs(quando - Date.now()) > 120000;
  miss.telefonoProvato = false;

  /* Chi prepara la missione alle due del pomeriggio e la avvia subito.
   *
   * L'anteprima si costruisce per l'ora consigliata — il crepuscolo — e
   * «Inizia adesso» vuol dire adesso: fra le due può esserci mezza
   * giornata. Spostare gli orari e basta darebbe una missione che parla
   * di un cielo che non c'è, con Vega a ottantatré gradi in pieno
   * pomeriggio. Le tappe si scelgono allora da capo per l'istante vero
   * di partenza, che è la sola domanda onesta: «adesso, cosa si vede?». */
  if (Math.abs(partenza - missione.partenza) > MISS_SCARTO_RIGENERA_MS) {
    const scenario = missScenario(missione.scelte, partenza);
    if (!scenario.errore) {
      const rifatta = missGeneraMissione(scenario);
      if (!rifatta.vuota && rifatta.tappe.length) {
        missione = rifatta;
        missAvvisa('riprogrammata', {}, 'informa');
      } else { missMostraVista('vuoto'); return; }
    } else { missAvvisa(scenario.errore, {}, 'informa'); missMostraVista('vuoto'); return; }
  }

  miss.attiva = Object.assign({}, missione, {
    stato: 'inCorso',
    avviata: partenza,
    corrente: 0,
    nelPlanetario: false,
    simulazione
  });
  // Chi comincia dopo l'ora consigliata trova gli orari già rifatti: è la
  // stessa riga di `missRiprogramma`, chiamata qui invece che aspettare
  // il primo «non lo trovo».
  missRiprogramma(partenza);
  miss.anteprima = null;
  const storia = missLeggiSalvato(CHIAVE_MISS_STORIA) || {};
  const varianti = storia.varianti || {}, domande = storia.domande || {};
  miss.attiva.tappe.forEach(t => { varianti[t.id] = t.raccontoVariante; domande[t.id] = t.domandaVariante; });
  const recenti = miss.attiva.tappe.map(t => t.id);
  const missioniRecenti = [recenti, ...(storia.missioniRecenti || [])]
    .slice(0, MISS_MISSIONI_DA_RICORDARE);
  missScrivi(CHIAVE_MISS_STORIA, { recenti, missioniRecenti, varianti, domande });
  missSalvaAttiva();
  missMostraVista('inCorso');
  // Appena comincia la tappa, il pannello lascia libero il cielo: cercare
  // il bersaglio nel planetario e muovere la vista e' il cuore del gioco.
  if (missTappaPuntabile(miss.attiva.tappe[0])) missGuidami(0);
  else missRaccontaTappa(miss.attiva.tappe[0]);
}

/* Gli orari rifatti sul cielo di adesso.
 *
 * Chi genera una missione alle nove e la avvia alle dieci e mezza non ha
 * sbagliato niente: è andato a cena. Le tappe libere si ridistribuiscono
 * dall'istante vero di partenza, quelle a orario preciso già passate si
 * tolgono — e la sola cosa che non si fa è dirglielo come se fosse colpa
 * sua. */
function missRiprogramma(partenzaMs) {
  const m = miss.attiva;
  if (!m) return;
  const adesso = partenzaMs || Date.now();

  const restano = m.tappe.filter(t =>
    t.esito || !t.aOrarioPreciso || t.quando >= adesso + MISS_PREAVVISO_MIN * 60000);
  const perse = m.tappe.length - restano.length;
  m.tappe = restano.map((t, i) => Object.assign({}, t, { indice: i }));

  const daFare = m.tappe.filter(t => !t.esito && !t.aOrarioPreciso);
  const restaMs = Math.max(5 * 60000, m.scelte.durata * 60000 - (adesso - (m.avviata || adesso)));
  const passo = restaMs / Math.max(1, daFare.length);
  daFare.forEach((t, i) => { t.quando = adesso + Math.round(i * passo); });

  if (m.corrente >= m.tappe.length) m.corrente = Math.max(0, m.tappe.length - 1);
  if (perse > 0) missAvvisa('riprogrammata', {}, 'informa');
  missSalvaAttiva();
}

function missSegnaEsito(indice, esito) {
  const m = miss.attiva;
  if (!m || !m.tappe[indice] || esito === 'trovato') return;
  m.tappe[indice].esito = esito;
  m.tappe[indice].quandoEsito = Date.now();
  missAvanza();
}

function missAvanza() {
  missFermaVoce();
  const m = miss.attiva;
  if (!m) return;
  const eraNelPlanetario = !!m.nelPlanetario;
  const prossima = m.tappe.findIndex(t => !t.esito);
  if (prossima < 0) { missConcludi(); return; }
  m.corrente = prossima;
  m.tappe[prossima].aiuto = m.tappe[prossima].aiuto || 0;
  missSalvaAttiva();
  missMostraVista('inCorso');
  // Nel percorso interattivo anche la tappa successiva nasce direttamente
  // nel planetario, senza il lampeggio della finestra fra una domanda e l'altra.
  if (eraNelPlanetario && missTappaPuntabile(m.tappe[prossima])) missGuidami(prossima);
  else if (eraNelPlanetario) missTornaDalPlanetario();
  else missRaccontaTappa(m.tappe[prossima]);
}

/* L'aiuto progressivo.
 *
 * «Non lo trovo» non segna niente: fa un gradino. Il primo ripete la
 * direzione con parole più semplici e nomina un riferimento; il secondo
 * dà il percorso dal riferimento al bersaglio, misurato in dita e pugni
 * a braccio teso, che è il solo goniometro che tutti hanno addosso; il
 * terzo rivela il bersaglio e lo porta al centro del planetario. Dopo il
 * terzo il tasto sparisce: ripeterlo non può produrre un quarto indizio
 * identico e far credere che la progressione continui.
 *
 * Il terzo gradino è quello che conta: dopo due tentativi il problema di
 * solito non è la mira, è il palazzo di fronte. */
function missChiediAiuto() {
  const m = miss.attiva;
  if (!m) return;
  const t = m.tappe[m.corrente];
  if (!t || t.fase === 'scoperta') return;
  if ((t.aiuto || 0) >= MISS_INDIZI) return;
  t.aiuto = (t.aiuto || 0) + 1;
  t.mostraAiuto = true;
  t.indizioMostrato = t.aiuto;
  missSalvaAttiva();
  missMostraVista('inCorso');
  missMostraStrisciaCielo();
  missRaccontaTappa(t);
}

/* La soluzione, e perché è un tasto e non il terzo indizio.
 *
 * Prima il terzo aiuto rivelava: si chiedeva un indizio e ci si ritrovava
 * la risposta, cioè la caccia finiva senza che nessuno l'avesse decisa —
 * e con lei finiva la sola cosa che una caccia abbia da dare, che è la
 * possibilità di arrivarci da soli. Adesso i tre indizi sono tre indizi,
 * e sotto al terzo compare un tasto separato con scritto quello che fa.
 * Chi lo preme ha *scelto* di arrendersi, e chi non lo preme può restare
 * lì a guardare quanto vuole.
 *
 * Le due cose che il tasto fa sono la stessa promessa detta due volte —
 * il nome scritto e il bersaglio al centro della mappa — e la seconda
 * chiede di sganciare la vista dai sensori: col telefono in mano è la
 * bussola a decidere dove si guarda, e senza sganciare il centraggio
 * sarebbe un fotogramma che sparisce col movimento del polso. */
function missMostraSoluzione() {
  const m = miss.attiva;
  if (!m) return false;
  const t = m.tappe[m.corrente];
  if (!t || t.fase === 'scoperta' || t.rivelata) return false;
  t.rivelata = true;
  t.aiuto = MISS_INDIZI;
  t.mostraAiuto = true;
  t.indizioMostrato = MISS_INDIZI;
  if (m.nelPlanetario) {
    if (typeof skyUsaSensori === 'function' && skyUsaSensori() &&
        typeof skyAlternaSeguiTelefono === 'function') skyAlternaSeguiTelefono();
    const ora = missTappaNelPlanetario(t);
    const oggetto = t.idCielo && typeof skyVoceDiId === 'function' && skyVoceDiId(t.idCielo);
    if (typeof skyCentraSu === 'function') skyCentraSu(oggetto || {
      nome: missNomeTappa(t), az: ora.azimut, alt: ora.altezza
    });
  }
  missSalvaAttiva();
  missMostraVista('inCorso');
  missMostraStrisciaCielo();
  missRaccontaTappa(t);
  return true;
}

/* Sostituire una tappa.
 *
 * Si prende il migliore fra gli scartati che sia compatibile con lo
 * strumento e ancora in cielo, e gli si dà **l'orario della tappa che
 * sostituisce**: la durata complessiva della serata non cambia, che è
 * la promessa. Se un'alternativa non c'è, il tasto non compare affatto —
 * offrire una sostituzione che non si può fare è peggio di non offrirla.
 */
function missAlternativePerTappa() {
  const m = miss.attiva;
  if (!m) return [];
  const scenario = missScenario(m.scelte, Date.now());
  if (scenario.errore) return [];
  const gia = new Set(m.tappe.map(t => t.id));
  return scenario.candidati
    .map(c => missTappaAdesso(c))
    .filter(c => !gia.has(c.id) && missAmmissibile(c, m.scelte) && !c.aOrarioPreciso)
    .map(c => Object.assign({}, c, { punti: missPunteggio(c, m.scelte, scenario.condizioni) }))
    .sort((a, b) => b.punti - a.punti);
}

function missSostituisci(indice) {
  const m = miss.attiva;
  if (!m || !m.tappe[indice]) return false;
  const alternative = missAlternativePerTappa();
  if (!alternative.length) {
    m.tappe[indice].feedback = 'nienteDaSostituire';
    missSalvaAttiva(); missMostraStrisciaCielo();
    missAvvisa('nienteDaSostituire', {}, 'informa'); missMostraVista('inCorso'); return false;
  }
  const vecchia = m.tappe[indice];
  const nuova = missAttaccaRiferimenti(
    [Object.assign({}, alternative[0], {
      quando: Date.now(), indice, esito: null, aiuto: 0, fase: 'ricerca',
      raccontoVariante: missHashTesto(m.id + alternative[0].id) % 3,
      domandaVariante: missHashTesto(m.id + ':domanda:' + alternative[0].id) % 3
    })], alternative)[0];
  m.tappe[indice] = nuova;
  m.sostituzioni = (m.sostituzioni || []).concat([{ da: vecchia.id, a: nuova.id }]);
  missSalvaAttiva();
  missAvvisa('gioco.sostituita', {}, 'bene');
  missMostraVista('inCorso');
  if (m.nelPlanetario) missGuidami(indice);
  return true;
}

function missConcludi() {
  missFermaVoce();
  const m = miss.attiva;
  if (!m) return;
  const eraNelPlanetario = !!m.nelPlanetario;
  m.stato = 'conclusa';
  m.conclusa = Date.now();
  m.durataRealeMin = Math.max(1, Math.round((m.conclusa - (m.avviata || m.conclusa)) / 60000));
  m.nelPlanetario = false;
  // Chi conclude a metà lascia delle tappe senza esito: non sono «non
  // trovate», sono tappe a cui non si è arrivati, e il diario le conta
  // come saltate — che è quello che è successo.
  m.tappe.forEach(t => { if (!t.esito) t.esito = 'saltato'; });
  // La coppa si assegna **prima** di disegnare: il pannello della fine la
  // legge da `m.premio`, e disegnandolo su una missione non ancora
  // premiata mostrerebbe una serata senza risultato per un fotogramma.
  const verbale = missPremiaMissione(m);
  missSalvaAttiva();
  missMostraStrisciaCielo();
  missMostraVista('conclusa');
  missRaccontaPremio(verbale);
  // Solo dopo l'ultima risposta serve di nuovo la finestra, questa volta
  // per mostrare il risultato e permettere il salvataggio nel Diario.
  if (eraNelPlanetario) {
    if (typeof mostraVista === 'function') mostraVista('stasera');
    missApriPannello();
  }
}

function missAbbandona() {
  missFermaVoce();
  miss.attiva = null;
  miss.anteprima = null;
  missSalvaAttiva();
  missMostraStrisciaCielo();
  missMostraVista('configurazione');
  missAggiornaScheda();
}

function missConto(m) {
  const conto = { trovato: 0, saltato: 0, nonTrovato: 0 };
  (m ? m.tappe : []).forEach(t => {
    if (t.esito === 'trovato') conto.trovato++;
    else if (t.esito === 'nonTrovato') conto.nonTrovato++;
    else conto.saltato++;
  });
  return conto;
}


// =====================================================================
// 7. IL DIARIO — una sessione, non cinque osservazioni scollegate
//
//     Il diario esiste già ed è un oggetto `{ id: voce }` in
//     `localStorage`. Una missione ci entra come **una voce sola**, con
//     dentro le sue tappe: cinque voci separate direbbero di aver visto
//     cinque cose in una notte senza dire che erano un percorso, e
//     soprattutto riempirebbero il diario di righe che nessuno ha
//     scritto.
//
//     La retrocompatibilità è in una riga: la voce nuova porta i campi
//     che il diario già legge (`titolo`, `dataEvento`, `nota`, `stelle`,
//     `strumento`, `categoria`) e in più un campo `missione` che le
//     vecchie non hanno. Chi disegna il diario guarda quel campo per
//     decidere se mostrare le tappe, e chi non ce l'ha si disegna come
//     sempre.
// =====================================================================

function missSalvaNelDiario(dettagli) {
  const m = miss.attiva;
  if (!m || typeof diario !== 'object' || typeof salvaDiario !== 'function') return null;

  const conto = missConto(m);
  const id = 'missione-' + m.id;
  diario[id] = {
    // I campi che il diario legge da sempre
    titolo: astroI18n.t('missione.diarioTitolo', { n: conto.trovato }),
    chiave: 'missione.diarioTitolo',
    dataEvento: new Date(m.avviata || m.creata).toISOString(),
    quando: new Date().toISOString(),
    // «Personali» e non «Pianeti»: una missione e' una serata di chi la
    // fa, non un evento del calendario, e infilarla in una categoria
    // astronomica gonfierebbe il traguardo «Collezionista» con una
    // categoria che nessuno ha davvero osservato.
    categoria: 'personali',
    nota: (dettagli && dettagli.nota) || '',
    stelle: (dettagli && dettagli.stelle) || 0,
    strumento: m.scelte.strumento,
    // …e il campo che le voci vecchie non hanno: la sessione.
    missione: {
      versione: MISS_VERSIONE,
      id: m.id,
      avviata: m.avviata || m.creata,
      conclusa: m.conclusa || Date.now(),
      durataPrevistaMin: m.scelte.durata,
      durataRealeMin: m.durataRealeMin || m.scelte.durata,
      strumento: m.scelte.strumento,
      esperienza: m.scelte.esperienza,
      luogo: typeof etichettaLuogo === 'function' ? (etichettaLuogo() || null) : null,
      lat: typeof luogoCorrente === 'function' && luogoCorrente() ? luogoCorrente().lat : null,
      lon: typeof luogoCorrente === 'function' && luogoCorrente() ? luogoCorrente().lon : null,
      condizioni: {
        luna: m.condizioni ? m.condizioni.luna : null,
        nuvole: m.condizioni ? m.condizioni.nuvole : null,
        bortle: m.condizioni ? m.condizioni.bortle : null
      },
      preferita: (dettagli && dettagli.preferita) || null,
      // La `sigla` viaggia col nome, e non e' un di piu': senza, la
      // figura salvata in una serata italiana resta «Boote» per sempre
      // anche a chi apre il diario in inglese.
      tappe: m.tappe.map(t => ({
        id: t.id, nome: t.nome, tipo: t.tipo, sigla: t.sigla || null,
        quando: t.quando, esito: t.esito || 'saltato',
        osservazione: t.osservazione || '', aiuti: t.aiuto || 0, rivelata: !!t.rivelata
      }))
    }
  };
  salvaDiario();
  if (typeof costruisciDiario === 'function' &&
      typeof vistaAttuale !== 'undefined' && vistaAttuale === 'diario') costruisciDiario();
  return id;
}


/* Come una missione si legge nel Diario.
 *
 * Il diario disegna le sue voci in `costruisciDiario` (app.js §15), e
 * una voce di missione ha bisogno di due cose che le altre non hanno: un
 * titolo che segua la lingua di adesso — quello congelato nel
 * salvataggio resta nella lingua di quella sera — e le sue tappe, che
 * sono la sessione. Non si tocca nient'altro: le voci senza il campo
 * `missione` passano di qui e ne escono identiche a prima. */
function missVoceDiario(v) {
  if (!v || !v.missione || typeof v.missione !== 'object') return null;
  const s = v.missione;
  const tappe = Array.isArray(s.tappe) ? s.tappe : [];
  const trovate = tappe.filter(t => t.esito === 'trovato').length;

  const righe = tappe.map(t => `<li data-esito="${missTesto(t.esito || 'saltato')}">
      <span class="missione-esito-segno" aria-hidden="true">${
        t.esito === 'trovato' ? '\u2713' : t.esito === 'nonTrovato' ? '\u2013' : '\u00b7'}</span>
      ${missTesto(missNomeTappa(t))}
      ${t.osservazione ? `<p>${missTesto(t.osservazione)}</p>` : ''}
      <span class="missione-esito-che">${missT('esito.' + (t.esito || 'saltato'))}</span>
    </li>`).join('');

  return {
    titolo: missT('diarioTitolo', { n: trovate }),
    sommario: missT('diarioSommario', {
      n: tappe.length,
      minuti: s.durataRealeMin || s.durataPrevistaMin || 0,
      luogo: missTesto(s.luogo || missT('luogoIgnoto'))
    }),
    html: `<details class="missione-diario-tappe">
        <summary>${missT('diarioVediTappe', { n: tappe.length })}</summary>
        <ul class="missione-diario-elenco">${righe}</ul>
      </details>`
  };
}


// =====================================================================
// 7-bis. L'ALBO — le coppe e i premi
//
//     Una caccia senza niente da portare a casa è una caccia che si fa
//     una volta. Fino a ieri la missione finiva con un elenco di esiti e
//     un tasto per il Diario: un resoconto onesto, e nient'altro — la
//     serata dopo ricominciava da zero, senza che nulla dicesse che la
//     prima c'era stata.
//
//     Qui si tiene il conto, e si tiene in due grandezze diverse, perché
//     sono due cose diverse:
//
//     LA COPPA è **della serata**. Si vince alla fine di una missione e
//     dice com'è andata quella: oro a chi ha trovato tutto quasi da solo,
//     argento a chi ha trovato tutto o quasi con qualche indizio, bronzo
//     a chi ha trovato qualcosa. Non esiste la coppa «niente»: chi non
//     trova nulla non ha perso una gara, ha avuto una serata storta — e
//     una coppa di latta consegnata per consolazione è peggio di nessuna
//     coppa.
//
//     IL PREMIO è **di sempre**. Non si vince e non si perde: si sblocca,
//     e da lì in poi resta. Sono traguardi che parlano di cosa si è
//     visto, non di quanto si è stati bravi — cinque pianeti diversi,
//     dieci oggetti del cielo profondo, tre sere — ed è di proposito:
//     misurare la bravura di chi comincia vuol dire dirgli che è scarso.
//
//     Il conto è **cumulativo e non ricostruibile**: si tiene in
//     `localStorage` e non si ricava dal Diario, perché una missione si
//     può concludere senza salvarla e il premio è già stato dato. Il
//     formato è numerato come tutto il resto (§4): un salvataggio che non
//     si conosce si butta invece di indovinarlo, e l'albo riparte — sono
//     coppe, non osservazioni, e perderle non perde nessun dato vero.
// =====================================================================

const CHIAVE_MISS_ALBO = 'astrocalendario_missione_albo';
const MISS_ALBO_VERSIONE = 1;

/* Quanto vale una tappa trovata.
 *
 * Tre addendi e non uno, perché tre cose diverse rendono una tappa degna
 * di essere contata: **che sia stata trovata** (la base, uguale per
 * tutti: la prima cosa che conta è essere usciti), **quanto era
 * difficile** (la scala di `missDifficolta`, da 1 a 5) e **quanto
 * valeva** (il fascino del repertorio, §1-bis — Saturno e una galassia
 * anonima con gli stessi numeri non sono la stessa serata).
 *
 * `senzaAiuti` è il solo premio alla bravura, ed è piccolo di proposito:
 * chiedere un indizio non è barare, è il modo in cui questo pezzo è fatto
 * per essere usato. Chi arriva in fondo senza chiederne nessuno prende
 * qualcosa in più, chi ne chiede tre non perde niente. */
const MISS_PUNTI = {
  tappa: 10,
  perDifficolta: 6,
  perFascino: 8,
  senzaAiuti: 8,
  nottePiena: 25
};

/* Le soglie della coppa, in aiuti **medi** per tappa trovata.
 *
 * Media e non totale: una missione di otto tappe e una di tre non si
 * possono giudicare con lo stesso numero di indizi, se no la serata
 * lunga è per forza peggiore di quella corta. Una tappa a cui è stata
 * chiesta la soluzione conta come se avesse speso tutti gli indizi e uno
 * in più: non è una punizione — è la resa, e la resa non è un'impresa da
 * oro. */
const MISS_COPPE = ['oro', 'argento', 'bronzo'];
const MISS_COPPA_ORO_AIUTI = 0.5;
const MISS_COPPA_ARGENTO_AIUTI = 1.5;
const MISS_COPPA_ARGENTO_QUOTA = 2 / 3;

// Quante tappe fanno una maratona: il premio della serata lunga portata
// fino in fondo, che è un'altra cosa dal trovare tanto.
const MISS_MARATONA_TAPPE = 8;

/* I premi, in ordine di quanto sono lontani.
 *
 * Ognuno guarda l'albo **dopo** che la missione ci è entrata, quindi una
 * regola è sempre una sola riga di lettura e mai un conto sulle tappe: se
 * per rispondere servisse rileggere la serata, il premio non sarebbe di
 * sempre, sarebbe della serata — e quella ha già la sua coppa.
 *
 * `icona` viene da `DISEGNI` (app.js §0): nessuna emoji, come ovunque. */
const MISS_PREMI = [
  { id: 'primaLuce',     icona: 'stella',        ok: a => a.trovati >= 1 },
  { id: 'senzaAiuti',    icona: 'occhio',        ok: a => a.senzaAiuti >= 1 },
  { id: 'nottePiena',    icona: 'coppa',         ok: a => a.perfette >= 1 },
  { id: 'treSere',       icona: 'calendario',    ok: a => (a.notti || []).length >= 3 },
  { id: 'dieciLuci',     icona: 'binocolo',      ok: a => a.trovati >= 10 },
  { id: 'giroPianeti',   icona: 'saturno',       ok: a => missAlboDistinti(a, 'pianeta') >= 5 },
  { id: 'stazione',      icona: 'satellite',     ok: a => missAlboDistinti(a, 'stazione') >= 1 },
  { id: 'figurante',     icona: 'costellazione', ok: a => missAlboDistinti(a, 'costellazione') >= 10 },
  { id: 'profondista',   icona: 'nebulosa',      ok: a => missAlboDistinti(a, 'profondo') >= 10 },
  { id: 'maratona',      icona: 'bersaglio',     ok: a => (a.maratone || 0) >= 1 },
  { id: 'stellario',     icona: 'telescopio',    ok: a => missAlboDistinti(a, 'stella') >= 15 },
  { id: 'treCoppeOro',   icona: 'coppa',         ok: a => (a.coppe && a.coppe.oro) >= 3 },
  { id: 'dieciSere',     icona: 'lunapiena',     ok: a => (a.notti || []).length >= 10 },
  { id: 'cinquantaLuci', icona: 'medaglia',      ok: a => a.trovati >= 50 }
];

// L'albo vuoto, che è anche la forma di riferimento: chi legge un
// salvataggio più povero (un formato vecchio, un campo perso) ci cade
// sopra e non trova mai un `undefined` da sommare.
function missAlboVuoto() {
  return {
    versione: MISS_ALBO_VERSIONE,
    punti: 0, missioni: 0, trovati: 0,
    perfette: 0, senzaAiuti: 0, maratone: 0,
    coppe: { oro: 0, argento: 0, bronzo: 0 },
    bersagli: {}, notti: [], premi: {}
  };
}

/* La notte di un istante, e non il suo giorno.
 *
 * Una serata comincia alle dieci e finisce alle due, e sono la stessa
 * serata: contandole per data di calendario, chi resta fuori oltre la
 * mezzanotte si ritroverebbe due sere dove ne ha fatta una. Si toglie
 * mezza giornata e si legge la data locale — la stessa regola con cui
 * chiunque, raccontandolo, direbbe «ieri sera». */
function missNotteDi(ms) {
  const d = new Date((Number.isFinite(ms) ? ms : Date.now()) - 12 * 3600 * 1000);
  const due = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

// Quanti bersagli **diversi** di un genere sono stati trovati almeno una
// volta. Le ripetizioni non contano: rivedere Giove dieci volte è una
// bella abitudine, non un giro dei pianeti.
function missAlboDistinti(albo, genere) {
  const b = (albo && albo.bersagli) || {};
  return Object.keys(b).filter(k => b[k] === genere).length;
}

function missLeggiAlbo() {
  const salvato = missLeggiSalvato(CHIAVE_MISS_ALBO);
  if (!salvato || typeof salvato !== 'object' || salvato.versione !== MISS_ALBO_VERSIONE) {
    return missAlboVuoto();
  }
  return Object.assign(missAlboVuoto(), salvato, {
    coppe: Object.assign({ oro: 0, argento: 0, bronzo: 0 }, salvato.coppe || {}),
    bersagli: Object.assign({}, salvato.bersagli || {}),
    premi: Object.assign({}, salvato.premi || {}),
    notti: Array.isArray(salvato.notti) ? salvato.notti : []
  });
}

/* Quanti indizi è costata una tappa trovata.
 *
 * `rivelata` non è un quarto indizio: è la resa, e vale un gradino oltre
 * l'ultimo. Chi si arrende e poi tocca comunque il bersaglio lo ha
 * trovato — l'esito resta «trovato», che è giusto — ma non ha fatto la
 * serata di chi ci è arrivato dal terzo indizio. */
function missCostoAiuti(t) {
  return t && t.rivelata ? MISS_INDIZI + 1 : Math.min(MISS_INDIZI, (t && t.aiuto) || 0);
}

/* I punti di una missione, contati sulle sole tappe trovate.
 *
 * Le saltate e le non trovate non tolgono niente, ed è la scelta di fondo
 * di tutto il file: «non trovato» è un fatto, non un voto (§6). Una
 * serata storta vale zero punti, che è già abbastanza. */
function missPuntiMissione(m) {
  const tappe = (m && m.tappe) || [];
  const trovate = tappe.filter(t => t.esito === 'trovato');
  let punti = 0;
  for (const t of trovate) {
    punti += MISS_PUNTI.tappa;
    punti += MISS_PUNTI.perDifficolta * Math.max(0, (t.difficolta || 1) - 1);
    punti += Math.round(MISS_PUNTI.perFascino * (Number.isFinite(t.fascino) ? t.fascino : 0.4));
    if (missCostoAiuti(t) === 0) punti += MISS_PUNTI.senzaAiuti;
  }
  if (tappe.length && trovate.length === tappe.length) punti += MISS_PUNTI.nottePiena;
  return punti;
}

/* La coppa della serata.
 *
 * `null` quando non si è trovato niente, ed è voluto: vedi il commento in
 * testa alla sezione. */
function missCoppaDiMissione(m) {
  const tappe = (m && m.tappe) || [];
  const trovate = tappe.filter(t => t.esito === 'trovato');
  if (!tappe.length || !trovate.length) return null;
  const quota = trovate.length / tappe.length;
  const aiutiMedi = trovate.reduce((somma, t) => somma + missCostoAiuti(t), 0) / trovate.length;
  if (quota >= 1 && aiutiMedi <= MISS_COPPA_ORO_AIUTI) return 'oro';
  if (quota >= 1 || (quota >= MISS_COPPA_ARGENTO_QUOTA && aiutiMedi <= MISS_COPPA_ARGENTO_AIUTI)) return 'argento';
  return 'bronzo';
}

/* La missione entra nell'albo, e ne esce quello che si è vinto.
 *
 * È una funzione pura sull'albo — prende quello di prima e restituisce
 * quello di dopo, più il verbale della serata — così si può provare senza
 * un browser e senza `localStorage`. A scrivere è `missPremiaMissione`,
 * che è l'unica che tocchi il disco.
 *
 * I premi si confrontano **prima e dopo**: quelli che prima non c'erano e
 * adesso ci sono sono i nuovi, e sono i soli che si annunciano. Un premio
 * già preso che si riconferma non è una notizia, e ripeterlo a ogni
 * serata svuoterebbe di significato anche quelli veri. */
function missAlboConMissione(alboPrima, m) {
  const albo = Object.assign(missAlboVuoto(), alboPrima, {
    coppe: Object.assign({ oro: 0, argento: 0, bronzo: 0 }, (alboPrima || {}).coppe),
    bersagli: Object.assign({}, (alboPrima || {}).bersagli),
    premi: Object.assign({}, (alboPrima || {}).premi),
    notti: [...((alboPrima || {}).notti || [])]
  });
  const tappe = (m && m.tappe) || [];
  const trovate = tappe.filter(t => t.esito === 'trovato');
  const coppa = missCoppaDiMissione(m);
  const punti = missPuntiMissione(m);
  const avuti = new Set(Object.keys(albo.premi));

  albo.punti += punti;
  albo.missioni += 1;
  albo.trovati += trovate.length;
  if (coppa) albo.coppe[coppa] += 1;
  if (tappe.length && trovate.length === tappe.length) albo.perfette += 1;
  if (trovate.length && trovate.every(t => missCostoAiuti(t) === 0)) albo.senzaAiuti += 1;
  if (tappe.length >= MISS_MARATONA_TAPPE && trovate.length === tappe.length) albo.maratone += 1;
  for (const t of trovate) {
    if (t.id) albo.bersagli[t.id] = missGenereTappa(t);
  }
  const notte = missNotteDi(m && (m.avviata || m.creata));
  if (trovate.length && !albo.notti.includes(notte)) albo.notti.push(notte);

  const quando = Date.now();
  const nuovi = [];
  for (const premio of MISS_PREMI) {
    if (avuti.has(premio.id)) continue;
    let preso = false;
    try { preso = !!premio.ok(albo); } catch (e) { preso = false; }
    if (!preso) continue;
    albo.premi[premio.id] = quando;
    nuovi.push(premio.id);
  }
  return { albo, verbale: { coppa, punti, nuovi, trovate: trovate.length, tappe: tappe.length } };
}

/* Il premio si consegna una volta sola.
 *
 * `missConcludi` può girare due volte — si conclude a mano e l'ultima
 * tappa chiude da sé, si riapre una missione conclusa da un salvataggio —
 * e una coppa consegnata due volte è una coppa che non vale niente. Il
 * verbale resta appeso alla missione (`m.premio`): da lì lo rilegge il
 * disegno, che di volte gira a decine. */
function missPremiaMissione(m) {
  if (!m) return null;
  if (m.premio) return m.premio;
  const { albo, verbale } = missAlboConMissione(missLeggiAlbo(), m);
  missScrivi(CHIAVE_MISS_ALBO, albo);
  m.premio = verbale;
  return verbale;
}

function missPremioDiId(id) {
  return MISS_PREMI.find(p => p.id === id) || null;
}


// =====================================================================
// 8. IL PANNELLO — cinque stati in una finestra sola
//
//     configurazione → anteprima → in corso → conclusa, più lo stato
//     vuoto per quando manca qualcosa. Sono cinque *stati* e non cinque
//     finestre: la testata resta ferma, cambia il corpo, e chiudere non
//     butta via niente — la missione vive nello stato del modulo, non
//     nel documento.
//
//     Il markup di partenza sta in `index.html` ed è un guscio: il corpo
//     lo scrive qui, perché dipende da quello che c'è in cielo stanotte.
// =====================================================================

// Le due scorciatoie di servizio. `missTesto` esiste perché in una tappa
// finisce anche il nome di una cometa scritto dall'utente: un `<` in
// mezzo a un `innerHTML` è un tag, e va tolto sempre, non quando ci si
// ricorda.
function missTesto(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function missIcona(nome, misura) {
  return typeof icona === 'function' ? icona(nome, misura || 16) : '';
}

// Quando si scelgono i bambini non basta cambiare i bersagli: cambia la
// persona che parla. Le chiavi elencate qui hanno una versione breve,
// energica e giocosa nei dizionari; tutto il resto continua a usare il testo
// normale, senza produrre chiavi mancanti in console.
const MISS_CHIAVI_BAMBINI = new Set([
  // il percorso: l'anteprima, la tappa, la fine
  'titoloAnteprima', 'titoloAnteprimaNotte', 'sommarioAnteprima', 'iniziaAdesso', 'iniziaAlle',
  'avanzamento', 'tappaDi', 'trova', 'trovato', 'nonLoTrovo',
  'salta', 'concludi', 'poi', 'curiositaTitolo', 'ascolta',
  'guidaSemplice', 'guidaConRiferimento', 'aiuto1', 'aiuto2',
  'aiuto2senzaRiferimento', 'aiuto3', 'sostituisci', 'segnaNonTrovato',
  /* Il gioco vero e proprio, che prima restava nel registro degli
   * adulti: un bambino leggeva «Indizio 2 di 3» e «Hai trovato M13»
   * dentro a una finestra che per il resto gli parlava di decolli e di
   * agenti spaziali. Il registro non è una decorazione della cornice —
   * se cambia solo la cornice, quello che resta dentro suona ancora più
   * serio di prima per contrasto. */
  'etichettaEnigma', 'numeroIndizio', 'soluzione', 'mostraSoluzione',
  // L'esclamazione della scoperta: coi bambini sale di un gradino, che è
  // l'unico posto di questo file in cui esagerare è la cosa giusta.
  'gioco.evviva.1', 'gioco.evviva.2', 'gioco.evviva.3',
  'gioco.scoperta', 'gioco.continua', 'gioco.apriCielo', 'gioco.altraStoria',
  'gioco.quasi', 'gioco.mistero', 'gioco.soluzioneE',
  // la scheda in Stasera e la configurazione
  'invito', 'preparami', 'unaltra', 'cambiaScelte', 'riprendi', 'vediRisultato',
  'sbirciaBersagli', 'nascondiBersagli', 'inCorsoSintesi', 'conclusaSintesi',
  'cosaCercare',
  // le due famiglie a più valori: la difficoltà e il titolo finale
  'difficolta.1', 'difficolta.2', 'difficolta.3', 'difficolta.4', 'difficolta.5',
  'conclusaTitolo.niente', 'conclusaTitolo.parziale', 'conclusaTitolo.tutto'
]);

function missChiaveRegistro(chiave, esperienza) {
  return esperienza === 'bambini' && MISS_CHIAVI_BAMBINI.has(chiave)
    ? 'bambini.' + chiave : chiave;
}

function missT(chiave, dati) {
  const registrata = missChiaveRegistro(chiave, missModoAttuale());
  return typeof astroI18n === 'object' ? astroI18n.t('missione.' + registrata, dati) : registrata;
}

function missOra(ms) {
  return typeof oraBreve === 'function' ? oraBreve(new Date(ms)) : '';
}

function missAvvisa(chiave, dati, tono) {
  miss.avviso = { chiave, dati: dati || {}, tono: tono || 'informa' };
}

function missMostraVista(vista) {
  miss.vista = vista;
  if (miss.aperto) missDisegnaPannello();
  missAggiornaScheda();
}

// --- la scheda dentro a Stasera -------------------------------------
//
// Compatta quando non succede niente: un titolo, una riga e un tasto.
// Il riquadro sta fra «Stanotte» e il meteo perché è lì che nasce la
// domanda — si è appena letto a che ora fa buio e quanta Luna c'è.

function missAggiornaScheda() {
  const box = document.getElementById('missione-scheda');
  if (!box) return;

  const senzaPosizione = typeof osservatoreCorrente === 'function' && !osservatoreCorrente();
  if (senzaPosizione) {
    box.innerHTML =
      `<p class="missione-scheda-testo">${missT('servePosizione')}</p>` +
      `<button type="button" class="missione-tasto missione-tasto-si" onclick="apriPosizione(true)">` +
      `${missT('dimmiDoveSono')}</button>`;
    return;
  }

  const m = miss.attiva;
  if (m && m.stato === 'inCorso') {
    const fatte = m.tappe.filter(t => t.esito).length;
    const t = m.tappe[m.corrente];
    box.innerHTML =
      `<p class="missione-scheda-testo">${missT('inCorsoSintesi', {
        fatte, tot: m.tappe.length, nome: missTesto(t ? missTitoloTappa(t) : '') })}</p>` +
      `<button type="button" class="missione-tasto missione-tasto-si" data-missione="riprendi">` +
      `${missT('riprendi')}</button>`;
  } else if (m && m.stato === 'conclusa') {
    const conto = missConto(m);
    box.innerHTML =
      `<p class="missione-scheda-testo">${missT('conclusaSintesi', { n: conto.trovato })}</p>` +
      `<button type="button" class="missione-tasto missione-tasto-si" data-missione="riprendi">` +
      `${missT('vediRisultato')}</button>`;
  } else {
    box.innerHTML =
      `<p class="missione-scheda-testo">${missT('invito')}</p>` +
      `<button type="button" class="missione-tasto missione-tasto-si" data-missione="apri">` +
      `${missIcona('bersaglio', 16)} ${missT('preparami')}</button>`;
  }

  box.querySelectorAll('[data-missione]').forEach(b =>
    b.addEventListener('click', () => missApriPannello()));
}

// --- l'apertura e la chiusura ---------------------------------------

function missApriPannello() {
  const modale = document.getElementById('modale-missione');
  if (!modale) return;

  miss.fuocoPrima = document.activeElement;
  miss.aperto = true;

  /* I cataloghi, se non li ha ancora chiesti nessuno.
   *
   * Senza `catPronto()` il cielo di una caccia è quello che sta scritto
   * in `app.js`: sette pianeti, otto stelle e ventitré figure — niente
   * cielo profondo, perché i centoquarantadue oggetti arrivano di lì.
   * Chi apre Missione Cielo dalla dashboard senza essere mai passato dal
   * planetario accendeva quindi la casella «galassie» e riceveva il
   * vuoto, che è la stessa segnalazione dei generi con un'altra faccia.
   * A caricarli finora era solo `apriSkymap()`, e qui basta chiederlo:
   * `catCarica` è idempotente e restituisce la promessa che ha già, e il
   * tempo di rispondere alle domande è molto più di quello che ci mette
   * a scaricare. Se non arriva, la missione si fa lo stesso col cielo di
   * prima — è la regola di ogni servizio di questa applicazione. */
  if (typeof catCarica === 'function' && typeof catPronto === 'function' && !catPronto()) {
    try { catCarica(); } catch (e) { /* i cataloghi sono un di più */ }
  }

  // Dove si riapre: chi ha una missione in corso la ritrova al punto in
  // cui era, chi ne ha una conclusa vede il risultato, gli altri le tre
  // domande. Riportare tutti alla configurazione vorrebbe dire chiedere
  // di ricominciare a chi voleva soltanto rileggere la tappa.
  if (miss.attiva && miss.attiva.stato === 'inCorso') {
    if (missDaAggiornare(miss.attiva)) missAvvisa('daAggiornare', {}, 'informa');
    miss.vista = 'inCorso';
  } else if (miss.attiva && miss.attiva.stato === 'conclusa') {
    miss.vista = 'conclusa';
  } else if (miss.anteprima) {
    miss.vista = 'anteprima';
  } else {
    miss.vista = 'configurazione';
  }

  modale.classList.remove('hidden');
  missDisegnaPannello();
  missAggancia();
  // Il fuoco al primo comando: chi naviga da tastiera deve trovarsi
  // dentro alla finestra, non dietro di lei.
  const primo = modale.querySelector('.missione-corpo button, .missione-corpo input, .tasto-chiudi');
  if (primo) primo.focus();
}

function missChiudiPannello(opzioni) {
  const modale = document.getElementById('modale-missione');
  if (modale) modale.classList.add('hidden');
  miss.aperto = false;
  miss.avviso = null;
  missFermaVoce();
  missStacca();
  if (!(opzioni && opzioni.tieniMissione) && miss.fuocoPrima && miss.fuocoPrima.focus) {
    try { miss.fuocoPrima.focus(); } catch (e) { /* nodo sparito nel frattempo */ }
  }
  miss.fuocoPrima = null;
  missAggiornaScheda();
}

/* Il fuoco intrappolato, e l'Escape.
 *
 * Non si delega a `inizializzaChiusuraSchedeConEsc`: quella chiude
 * l'ultima finestra aperta, e va benissimo, ma qui il primo Escape deve
 * poter chiudere *un foglio interno* (la sostituzione di una tappa)
 * lasciando aperta la finestra. La trappola del fuoco invece non esiste
 * altrove nell'app e serve: una finestra modale da cui il tabulatore
 * esce non è una finestra modale. */
function missAggancia() {
  const modale = document.getElementById('modale-missione');
  if (!modale) return;

  const tastiera = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      missChiudiPannello();
      return;
    }
    if (e.key !== 'Tab') return;
    const fuocabili = Array.from(modale.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(n => n.offsetParent !== null);
    if (!fuocabili.length) return;
    const primo = fuocabili[0], ultimo = fuocabili[fuocabili.length - 1];
    if (e.shiftKey && document.activeElement === primo) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primo.focus(); }
  };
  modale.addEventListener('keydown', tastiera, true);
  miss.staccare.push(() => modale.removeEventListener('keydown', tastiera, true));

  // Il cambio lingua: il pannello si compone tutto in JavaScript, quindi
  // non ha nessuna chiave nel documento da riscrivere — si ridisegna.
  if (typeof astroI18n === 'object' && astroI18n.alCambio) {
    const stacca = astroI18n.alCambio(() => { if (miss.aperto) missDisegnaPannello(); });
    if (typeof stacca === 'function') miss.staccare.push(stacca);
  }
}

function missStacca() {
  miss.staccare.forEach(f => { try { f(); } catch (e) { /* già staccato */ } });
  miss.staccare = [];
}

// --- il disegno -----------------------------------------------------

function missDisegnaPannello() {
  const corpo = document.getElementById('missione-corpo');
  if (!corpo) return;

  let html = '';
  if (miss.avviso) {
    html += `<p class="missione-avviso" data-tono="${miss.avviso.tono}" role="status">` +
      missT(miss.avviso.chiave, miss.avviso.dati) + '</p>';
  }

  if (miss.vista === 'albo') html += missHtmlAlbo();
  else if (miss.vista === 'anteprima' && miss.anteprima) html += missHtmlAnteprima(miss.anteprima);
  else if (miss.vista === 'inCorso' && miss.attiva) html += missHtmlInCorso(miss.attiva);
  else if (miss.vista === 'conclusa' && miss.attiva) html += missHtmlConclusa(miss.attiva);
  else if (miss.vista === 'vuoto') html += missHtmlVuoto();
  else html += missHtmlConfigurazione();

  corpo.innerHTML = html;
  missCollegaPannello(corpo);
}

/* Un gruppo di pillole alternative, e la nota di quella scelta.
 *
 * La `nota` serve dove l'etichetta da sola non dice cosa cambia:
 * «Esperti» non è una promessa finché non si legge che vuol dire il solo
 * enigma e nessun aiuto regalato. Prima ogni pillola se la portava
 * addosso, e tre cartoline da due righe su un telefono da 360 sono
 * **duecentocinquanta pixel** per rispondere a una domanda sola —
 * misurati: un quarto del pannello per un terzo di una domanda.
 *
 * Adesso la nota è una sola, sotto alla riga, ed è quella della scelta
 * fatta: la spiegazione che conta davvero è quella dell'opzione che si
 * sta per portare a casa, e le altre due restano a un tocco (e nel
 * `title`, per chi passa col mouse). Novantasei pixel invece di
 * duecentocinquanta, e nessuna informazione persa. */
function missGruppoScelte(nome, voci, attuale, etichetta) {
  const pillole = voci.map(v => {
    const scelto = v.valore === attuale;
    return `<button type="button" class="missione-scelta${scelto ? ' attiva' : ''}"
      role="radio" aria-checked="${scelto}" data-miss-scelta="${nome}" data-miss-valore="${v.valore}"
      ${v.nota ? `title="${missTesto(v.nota)}"` : ''}>
      ${v.icona ? missIcona(v.icona, 18) : ''}<span>${v.nome}</span></button>`;
  }).join('');
  const scelta = voci.find(v => v.valore === attuale);
  const nota = scelta && scelta.nota
    ? `<p class="missione-scelta-nota" role="status">${scelta.nota}</p>` : '';
  return `<fieldset class="missione-gruppo">
    <legend class="missione-domanda">${etichetta}</legend>
    <div class="missione-scelte" role="radiogroup" aria-label="${etichetta}">${pillole}</div>
    ${nota}
  </fieldset>`;
}

function missValoreDataOra(ms) {
  const d = new Date(ms);
  const due = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}T${due(d.getHours())}:${due(d.getMinutes())}`;
}

function missPartenzaScelta() {
  if (miss.scelte.momento === 'adesso') return Date.now();
  if (miss.scelte.momento === 'personalizzato') {
    const scelto = Number(miss.scelte.momentoPersonalizzato);
    if (Number.isFinite(scelto) && scelto > Date.now() - 5 * 60000) return scelto;
  }
  return Math.max(Date.now(), missOraConsigliata() || 0);
}

/* Le domande della configurazione, in tre blocchi invece che in fila.
 *
 * Erano sei gruppi impilati, ognuno col suo titolo in grassetto e le
 * sue pillole: misurato su un telefono da 360×640, il pannello era
 * lungo **milleotto pixel** — una schermata e mezza da scorrere per
 * rispondere a domande che stanno in una riga a testa. E la lunghezza
 * non era il difetto peggiore: sei titoli dello stesso peso non dicono
 * quali siano le domande importanti.
 *
 * Senza una domanda sugli oggetti, che vengono sempre considerati tutti,
 * i pixel guadagnati sono quelli delle note
 * (una sola, sotto alla scelta fatta, invece di tre cartoline — vedi
 * `missGruppoScelte`), delle etichette accorciate e dei dettagli
 * richiusi.
 *
 * Adesso i blocchi sono tre e hanno tre nature diverse. **La serata**
 * (quanto tempo, quando, con cosa) è quello che si tocca sempre.
 * **La caccia** (che difficoltà) è quello che decide la
 * missione, ed è il blocco nuovo. **I dettagli** stanno dentro a un
 * `<details>` chiuso — cielo di casa, settore, voce — perché sono le
 * risposte che uno dà una volta e poi si tiene: tenerle aperte vuol
 * dire farle scorrere via a tutti per sempre.
 *
 * La riga di sintesi in fondo al riepilogo dei dettagli non è
 * decorazione: chiuso un pannello, quello che c'è dentro smette di
 * esistere per chi guarda, e un Bortle 8 lasciato lì per sbaglio
 * spiegherebbe da solo una missione di tre pianeti. */
function missHtmlConfigurazione() {
  const durate = MISS_DURATE.map(d => ({ valore: d, nome: missT('durata.' + d) }));
  const strumenti = MISS_STRUMENTI.map(s => ({
    valore: s, icona: (typeof STRUMENTI !== 'undefined' && STRUMENTI[s]) ? STRUMENTI[s].disegno : null,
    nome: (typeof STRUMENTI !== 'undefined' && STRUMENTI[s]) ? STRUMENTI[s].nome : s
  }));
  const esperienze = MISS_ESPERIENZE.map(e => ({
    valore: e, nome: missT('esperienza.' + e), nota: missT('esperienzaNota.' + e) }));
  const direzione = gradi => typeof astroI18n === 'object' && astroI18n.nomePunto
    ? astroI18n.nomePunto(gradi) : String(gradi) + '°';
  const opzioniDirezione = selezionata => ([...MISS_DIREZIONI,
    ...(MISS_DIREZIONI.includes(selezionata) ? [] : [selezionata])].sort((a, b) => a - b)).map(g =>
    `<option value="${g}"${g === selezionata ? ' selected' : ''}>${missTesto(direzione(g))} · ${g}°</option>`).join('');
  return `<div class="missione-configurazione">
    <section class="missione-blocco">
      <h3 class="missione-blocco-titolo">${missT('bloccoSerata')}</h3>
      ${missGruppoScelte('durata', durate, miss.scelte.durata, missT('quantoTempo'))}
      ${missGruppoScelte('momento', [
        { valore: 'adesso', nome: missT('momentoAdesso') },
        { valore: 'consigliato', nome: missT('momentoConsigliato') },
        { valore: 'personalizzato', nome: missT('momentoScegli') }
      ], miss.scelte.momento, missT('quandoMissione'))}
      ${miss.scelte.momento === 'personalizzato' ? `<label class="missione-campo missione-momento">
        <span>${missT('dataOraMissione')}</span>
        <input class="missione-select" type="datetime-local" data-miss-momento
          min="${missValoreDataOra(Date.now())}" value="${missValoreDataOra(missPartenzaScelta())}">
      </label>` : ''}
      <p class="missione-momento-spiega">${missT('momentoSpiega')}</p>
      ${missGruppoScelte('strumento', strumenti, miss.scelte.strumento, missT('conCosa'))}
    </section>

    <section class="missione-blocco">
      <h3 class="missione-blocco-titolo">${missT('bloccoCaccia')}</h3>
      ${missGruppoScelte('esperienza', esperienze, miss.scelte.esperienza, missT('cheEsperienza'))}
    </section>

    <section class="missione-dettagli missione-dettagli-aperti" data-miss-dettagli>
      <h3 class="missione-blocco-titolo">${missT('bloccoDettagli')}</h3>
      <div class="missione-dettagli-corpo">
        ${missGruppoScelte('cielo', [
          { valore: 'tutto', nome: missT('cieloTutto') }, { valore: 'settore', nome: missT('cieloSettore') }
        ], miss.scelte.cielo, missT('qualeCielo'))}
        ${miss.scelte.cielo === 'settore' ? `<div class="missione-settore">
          <label class="missione-campo"><span>${missT('daDirezione')}</span><select class="missione-select" data-miss-limite="cieloDa">${opzioniDirezione(miss.scelte.cieloDa)}</select></label>
          <label class="missione-campo"><span>${missT('aDirezione')}</span><select class="missione-select" data-miss-limite="cieloA">${opzioniDirezione(miss.scelte.cieloA)}</select></label>
          <div class="missione-rilievo">
            <button type="button" class="missione-tasto" data-miss-rileva>
              ${missIcona('bussola', 16)} ${missT(miss.rilievoSettore ? 'settoreRilevaSecondo' : 'settoreRilevaPrimo')}
            </button>
            <span class="missione-rilievo-stato" role="status">${miss.rilievoSettore
              ? missT('settorePrimoPreso', { gradi: miss.rilievoSettore.primo }) : missT('settoreRilevaIstruzioni')}</span>
          </div>
          <p>${missT('settoreSpiega')}</p></div>` : ''}
        ${missGruppoScelte('voce', [
          { valore: 'si', nome: missT('voceSi') }, { valore: 'no', nome: missT('voceNo') }
        ], miss.scelte.voce ? 'si' : 'no', missT('vuoiVoce'))}
      </div>
    </section>

    <div class="missione-azioni">
      <button type="button" class="missione-tasto missione-tasto-si" data-miss-azione="genera">
        ${missIcona('bersaglio', 16)} ${missT('preparami')}</button>
      ${missStrisciaAlbo()}
    </div>
  </div>`;
}

/* Cosa c'è dentro al pannello chiuso, in una riga.
 *
 * Tre numeri e non una frase: il cielo di casa, il pezzo di orizzonte e
 * se la voce parla. Sono le tre cose che, lasciate al valore sbagliato,
 * spiegano da sole una missione che non convince — e che chiuse dentro a
 * un `<details>` nessuno andrebbe a ricontrollare. */
function missSintesiDettagli(bortle) {
  const pezzi = ['Bortle ' + bortle];
  if (miss.scelte.cielo === 'settore') {
    const nome = g => typeof astroI18n === 'object' && astroI18n.nomePunto ? astroI18n.nomePunto(g) : g + '°';
    pezzi.push(nome(miss.scelte.cieloDa) + '–' + nome(miss.scelte.cieloA));
  } else pezzi.push(missT('cieloTutto'));
  if (miss.scelte.voce) pezzi.push(missT('vociAttiva'));
  return pezzi.join(' · ');
}

function missHtmlVuoto() {
  return `<div class="missione-vuoto">
    <p class="missione-scheda-testo">${missT('nienteInVista')}</p>
    <div class="missione-azioni">
      <button type="button" class="missione-tasto" data-miss-azione="configura">${missT('cambiaScelte')}</button>
    </div>
  </div>`;
}

// Le condizioni della notte in una riga, e le assenze dichiarate.
/* Com'è la notte, in una frase che si regge da sola.
 *
 * Le due metà non sono intercambiabili, ed è la ragione per cui la Luna
 * ha due versioni. Attaccata alle nuvole è una subordinata («Il cielo
 * sarà sereno, e non c'è Luna a dare fastidio»); da sola, quando il meteo
 * non è arrivato, quella stessa subordinata comincia con una «e» dopo un
 * punto — che è esattamente com'era, e si legge come una frase tagliata a
 * metà. */
function missRigaCondizioni(c) {
  const nuvole = (c.nuvole !== null && c.nuvole !== undefined)
    ? missT(c.nuvole <= 20 ? 'cielo.sereno' : c.nuvole <= 50 ? 'cielo.aTratti'
      : c.nuvole <= 80 ? 'cielo.nuvoloso' : 'cielo.coperto')
    : null;
  const conNuvole = !!nuvole;
  let luna = null;
  if (c.luna > 0.35) luna = missT(conNuvole ? 'cielo.conLuna' : 'cielo.conLunaSola');
  else if (c.luna < 0.1) luna = missT(conNuvole ? 'cielo.senzaLuna' : 'cielo.senzaLunaSola');
  if (nuvole && luna) return nuvole + ', ' + luna;
  return nuvole || luna || '';
}

function missHtmlAnteprima(m) {
  const c = m.condizioni || {};
  const avvisi = [];
  if (c.meteoAssente) avvisi.push(missT('senzaMeteo'));
  if (c.terrenoAssente) avvisi.push(missT('senzaTerreno'));

  /* L'anteprima non fa spoiler.
   *
   * Prima elencava i nomi dei bersagli, e la ragione era buona — chi
   * prepara la serata vuole sapere cosa lo aspetta. Ma da quando la
   * missione è una caccia, leggere «Saturno, M13, Vega» prima di
   * cominciare è aprire il regalo per controllare che sia un regalo:
   * l'enigma della prima tappa arriva quando la risposta è già scritta
   * tre righe più su. Quello che serve davvero per decidere se la serata
   * va bene — quante tappe, a che ora, di che genere, quanto difficili —
   * c'è tutto; e chi i nomi li vuole lo stesso ha il tasto per sbirciare,
   * che è una scelta invece di un incidente. */
  const righe = m.tappe.map((t) => `<li class="missione-anteprima-riga">
      <span class="missione-anteprima-ora">${missOra(t.quando)}</span>
      <span class="missione-anteprima-nome">${missTesto(miss.sbircia
        ? missNomeTappa(t) : missT('anteprimaMistero.' + missGenereTappa(t)))}</span>
      <span class="missione-anteprima-che">${missT('difficolta.' + t.difficolta)}</span>
    </li>`).join('');
  const inizioOsservazione = m.tappe.length ? Math.min(...m.tappe.map(t => t.quando)) : m.partenza;
  const futura = inizioOsservazione > Date.now() + MISS_SCARTO_RIGENERA_MS;

  return `<div class="missione-anteprima">
    <h3 class="missione-titolone">${missT(m.scelte.durata === 720
      ? 'titoloAnteprimaNotte' : 'titoloAnteprima', {
      n: m.tappe.length, minuti: m.scelte.durata })}</h3>
    <p class="missione-sommario">${missT('sommarioAnteprima', {
      ora: missOra(inizioOsservazione),
      condizioni: missRigaCondizioni(c) || missT('cielo.nonSoDire')
    })}</p>
    ${avvisi.length ? `<p class="missione-avviso" data-tono="informa">${avvisi.join(' ')}</p>` : ''}
    <ul class="missione-anteprima-elenco">${righe}</ul>
    <button type="button" class="missione-tasto missione-tasto-lieve" data-miss-azione="sbircia">
      ${missT(miss.sbircia ? 'nascondiBersagli' : 'sbirciaBersagli')}</button>
    <div class="missione-azioni">
      <button type="button" class="missione-tasto missione-tasto-si" data-miss-azione="${futura ? 'avviaDopo' : 'avvia'}">
        ${futura ? missT('iniziaAlle', { ora: missOra(inizioOsservazione) }) : missT('iniziaAdesso')}</button>
      ${futura ? `<button type="button" class="missione-tasto" data-miss-azione="avvia">${missT('iniziaAdesso')}</button>` : ''}

      <button type="button" class="missione-tasto" data-miss-azione="rigenera">${missT('unaltra')}</button>
      <button type="button" class="missione-tasto" data-miss-azione="configura">${missT('cambiaScelte')}</button>
    </div>
  </div>`;
}

/* La tappa in corso: una alla volta, e detta come la direbbe una persona.
 *
 * Ascensione retta e declinazione qui non compaiono affatto, e non è
 * pigrizia: sono le coordinate giuste per una montatura e quelle
 * sbagliate per un paio d'occhi. Quello che serve è la direzione
 * cardinale, la fascia di cielo («basso», «a metà cielo», «molto in
 * alto») e un riferimento luminoso da cui partire. I gradi restano, ma
 * come informazione di seconda riga. */
function missHtmlInCorso(m) {
  const t = m.tappe[m.corrente];
  if (!t) return missHtmlConclusa(m);
  if (t.fase === 'scoperta') return missHtmlScoperta(t);
  return `<div class="missione-corso">
    <p>${missT('tappaDi', { n: m.corrente + 1, tot: m.tappe.length })}</p>
    <h3>${missTesto(missTitoloTappa(t))}</h3>
    <p>${missTesto(missTestoIndizio(t))}</p>
    <div class="missione-azioni">
      <button class="missione-tasto missione-tasto-si" data-miss-azione="guidami">${missT('gioco.apriCielo')}</button>
      ${missNavigazioneIndizi(t)}
      ${missTastoSoluzione(t)}
      <button class="missione-tasto" data-miss-azione="salta">${missT('salta')}</button>
      <button class="missione-tasto" data-miss-azione="concludi">${missT('concludi')}</button>
    </div></div>`;
}

/* Il testo guida: dove guardare, detto a partire da qualcosa che si vede.
 *
 * Senza riferimento resta la direzione, che è già una risposta; con il
 * riferimento diventa un percorso, che è la risposta vera. La misura è
 * in dita e pugni a braccio teso perché un grado non lo sa stimare
 * nessuno e un pugno sì — e perché è così che si insegna a cercare in
 * cielo da prima che esistessero le app. */
function missGuidaTesto(t) {
  const dove = typeof astroI18n === 'object' && astroI18n.nomePunto
    ? astroI18n.nomePunto(t.azimut) : '';
  if (!t.riferimento) {
    return missT('guidaSemplice', {
      dove: missTesto(dove), altezza: missT('altezza.' + missFasciaAltezza(t.altezza))
    });
  }
  const misura = missMisuraAMano(t.riferimento.gradi);
  return missT('guidaConRiferimento', {
    da: missTesto(missNomeTappa(t.riferimento)),
    verso: missT('verso.' + t.riferimento.verso),
    misura: missT(misura.chiave.replace('missione.', ''))
  });
}

function missHashTesto(testo) {
  let h = 2166136261;
  for (const c of String(testo || '')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

// Il gradino scelto, letto dove si trova: la missione in corso, l'anteprima
// che si sta guardando, o la configurazione.
function missModoAttuale() {
  return (miss.attiva && miss.attiva.scelte && miss.attiva.scelte.esperienza) ||
    (miss.anteprima && miss.anteprima.scelte && miss.anteprima.scelte.esperienza) ||
    miss.scelte.esperienza || 'curiosi';
}

/* La prima delle chiavi proposte che il dizionario conosce davvero.
 *
 * È il meccanismo su cui poggia tutta la catena di ripiego del §1-bis:
 * si prova il nome proprio, poi la categoria, poi la famiglia, e l'ultima
 * della fila è quella che esiste sempre — quindi una chiave si
 * restituisce comunque, anche fuori da un browser dove `astroI18n` non
 * c'è. Senza questa riga un oggetto senza aneddoto proprio non
 * mostrerebbe un ripiego: mostrerebbe la chiave. */
function missPrimaChiaveNota(chiavi) {
  if (typeof astroI18n === 'object' && typeof astroI18n.esiste === 'function') {
    for (const c of chiavi) if (astroI18n.esiste('missione.' + c)) return c;
  }
  return chiavi[chiavi.length - 1];
}

/* Quante varianti di un racconto esistono per davvero.
 *
 * Gli aneddoti non sono tre per tutti, ed è una scelta: di Saturno si
 * possono raccontare tre cose che valgono la pena, di un ammasso aperto
 * senza nome una sola — e tre righe scritte per riempire una tabella si
 * riconoscono subito. Il numero si **misura** invece di dichiararlo, così
 * chi aggiunge una quarta storia non deve toccare nessun contatore. Fuori
 * da un browser, dove il dizionario non c'è, si risponde tre: è il numero
 * che le prove del motore si aspettano. */
function missQuanteVarianti(prefisso, massimo) {
  const tetto = massimo || 3;
  if (typeof astroI18n !== 'object' || typeof astroI18n.esiste !== 'function') return tetto;
  let n = 0;
  while (n < tetto && astroI18n.esiste('missione.' + prefisso + '.' + (n + 1))) n++;
  return Math.max(1, n);
}

function missFamigliaContenuto(t) {
  return ['luna', 'pianeta', 'stella', 'costellazione', 'profondo'].includes(t.tipo) ? t.tipo : 'profondo';
}

/* Di che genere è una tappa, per dirlo senza dirne il nome.
 *
 * Non è `missFamigliaContenuto`: quella butta le stazioni e gli eventi
 * nel cielo profondo, che va benissimo per scegliere una domanda
 * («riesci a separare dei puntini?») e malissimo per l'anteprima, dove
 * un passaggio della ISS finirebbe annunciato come «una luce del cielo
 * profondo». */
function missGenereTappa(t) {
  return (t && (t.tipo === 'stazione' || t.tipo === 'evento')) ? t.tipo : missFamigliaContenuto(t);
}

/* La base del racconto: nome proprio, categoria, famiglia.
 *
 * Sono i tre gradini del §1-bis nell'ordine in cui vanno provati, ed è lo
 * stesso ordine per gli aneddoti, gli enigmi e i segni osservabili — se
 * divergessero, un oggetto potrebbe ricevere l'enigma di una galassia e
 * l'aneddoto di un ammasso, che è il modo più veloce di far sembrare
 * finto tutto il pezzo. */
function missBaseRacconto(t) {
  if (!t) return 'generica';
  const slug = t.slug || missSlugTappa(t);
  if (slug) return slug;
  const categoria = missCategoriaTappa(t);
  if (categoria) return categoria;
  return ['profondo', 'costellazione', 'stella', 'pianeta', 'luna', 'stazione'].includes(t.tipo)
    ? t.tipo : 'generica';
}

/* L'aneddoto che si legge dopo aver trovato il bersaglio.
 *
 * È il premio, e per questo non è una frase intercambiabile: di ogni
 * oggetto con un nome proprio ci sono da uno a tre racconti — cosa si sta
 * guardando davvero, chi gli ha dato quel nome e cosa ci ha visto dentro,
 * e la cosa che nessuno si aspetta. Si alternano fra una missione e
 * l'altra ma **non** dentro alla stessa: chi ricarica la pagina a metà
 * serata deve ritrovare la storia che stava leggendo. */
function missCuriositaChiave(tappa) {
  const base = missBaseRacconto(tappa);
  const quante = missQuanteVarianti('curiosita.' + base);
  const variante = Number.isInteger(tappa && tappa.raccontoVariante)
    ? tappa.raccontoVariante
    : missHashTesto(missNomeNudo(tappa && tappa.nome));
  return `curiosita.${base}.${variante % quante + 1}`;
}

// Un dettaglio osservabile del bersaglio, non una descrizione da
// fotografia: il colore, la sagoma, la disposizione. Nome proprio,
// categoria, famiglia — la catena di sempre.
function missSegnoTappa(t) {
  const chiavi = [];
  const slug = t.slug || missSlugTappa(t);
  if (slug) chiavi.push('gioco.segno.' + slug);
  const categoria = missCategoriaTappa(t);
  if (categoria) chiavi.push('gioco.segno.' + categoria);
  chiavi.push('gioco.osserva.' + missFamigliaContenuto(t));
  return missT(missPrimaChiaveNota(chiavi));
}

/* L'enigma.
 *
 * È la prima cosa che si legge di una tappa, ed è quella che decide se la
 * serata è un gioco o un elenco di compiti. Un enigma scritto per
 * l'oggetto — «Ho mari senza una goccia d'acqua» — vale dieci volte uno
 * scritto per la sua famiglia, e per questo il repertorio ne tiene uno
 * per ogni bersaglio che abbia un nome proprio. Chi non ce l'ha scende di
 * un gradino e riceve quello della sua specie, che parla comunque di
 * qualcosa di vero: un ammasso globulare e una nebulosa planetaria hanno
 * due indovinelli diversi perché sono due cose diverse.
 *
 * Ai bambini si dà la versione breve e in rima quando c'è, perché un
 * enigma che non si capisce non è una sfida: è un muro. */
function missEnigma(t) {
  const modo = missModoAttuale();
  const slug = t.slug || missSlugTappa(t);
  const categoria = missCategoriaTappa(t);
  const famiglia = missFamigliaContenuto(t);
  /* Tre varianti generiche per famiglia, tranne una eccezione che afferma
   * un fatto: la terza delle figure comincia con «sono più antica di ogni
   * libro». Alla Macchina Pneumatica e al Bulino dello Incisore, che
   * stanno in cielo dal Settecento, quell'enigma farebbe raccontare una
   * bugia — quindi loro ne pescano due. Vedi `missFiguraAntica` (§3). */
  const n = missVarianteEnigma(t);
  const chiavi = [];
  if (modo === 'bambini') {
    if (slug) chiavi.push('gioco.enigmaBimbi.' + slug);
    if (categoria) chiavi.push('gioco.enigmaBimbi.' + categoria);
    chiavi.push('gioco.enigmaBimbi.' + famiglia);
  }
  // I bersagli più riconoscibili possono avere più indovinelli propri: la
  // variante della missione ne sceglie uno, conservando come ripiego la
  // vecchia chiave senza numero. Le costellazioni usano questa strada per
  // non riproporre sempre la stessa figura a chi prepara più serate.
  if (slug) chiavi.push('gioco.enigma.oggetto.' + slug + '.' + n);
  if (slug) chiavi.push('gioco.enigma.oggetto.' + slug);
  if (categoria) chiavi.push('gioco.enigma.specie.' + categoria);
  chiavi.push('gioco.enigma.' + famiglia + '.' + n);
  return missT(missPrimaChiaveNota(chiavi));
}

// Il punto cardinale in cui sta adesso il bersaglio, con l'azimut della
// tappa come ripiego: serve alle introduzioni, che si scrivono anche
// fuori dal planetario.
function missDoveOra(t) {
  let az = t.azimut;
  if (miss.attiva && typeof osservatoreCorrente === 'function' && osservatoreCorrente()) {
    const ora = missTappaNelPlanetario(t);
    if (Number.isFinite(ora.azimut)) az = ora.azimut;
  }
  return (typeof astroI18n === 'object' && astroI18n.nomePunto && Number.isFinite(az))
    ? astroI18n.nomePunto(az) : '';
}

/* Quello che si consegna prima della prima occhiata.
 *
 * Le tre righe che seguono sono i tre gradini di `MISS_GENEROSITA`, e
 * sono tutta la differenza fra i tre livelli: agli esperti va il solo
 * enigma, ai curiosi l'enigma e il segno da cercare, ai bambini anche la
 * direzione — che a quel punto non è più una caccia difficile, ed è
 * giusto così: la loro caccia è riconoscere, non trovare. */
function missIntroduzione(t) {
  const modo = missModoAttuale();
  const g = MISS_GENEROSITA[modo] || MISS_GENEROSITA.curiosi;
  // La stessa variante delle altre due strofe: le tre righe di una tappa
  // sono un indovinello solo detto in tre volte, non tre indovinelli.
  const n = missVarianteEnigma(t);
  const pezzi = [];
  if (modo === 'bambini') pezzi.push(missT('gioco.intro.bambini.' + n));
  pezzi.push(missEnigma(t));
  if (g.segno) pezzi.push(missSegnoTappa(t));
  if (g.aiutoSubito) {
    const dove = missDoveOra(t);
    if (dove) pezzi.push(missT('gioco.direzione.' + n, { dove }));
  }
  return pezzi.filter(Boolean).join(' ');
}

/* I tre indizi sono tre strofe dello stesso indovinello.
 *
 * Il primo funzionava e gli altri due no, ed è stato detto con una frase
 * che vale la pena tenere: «il secondo e il terzo non sono indovinelli».
 * Non lo erano davvero. Dopo un enigma in prima persona — «Ho mari in cui
 * non è mai caduta una goccia» — arrivava «Sempre verso nord-ovest: cerca
 * a metà cielo. L'altezza si misura a partire dall'orizzonte», cioè la
 * voce di un'altra persona: il narratore spariva e restava un navigatore
 * satellitare. Il gioco finiva lì, alla seconda riga, e non perché
 * l'informazione fosse sbagliata — era giusta — ma perché **cambiava
 * registro**, e un indovinello che a metà diventa un'istruzione ha già
 * detto a chi ascolta che il gioco era finto.
 *
 * Adesso le tre righe sono tre strofe della stessa voce, e sono legate in
 * due modi diversi che si sommano:
 *
 *   DALLA CATENA. La seconda e la terza strofa si pescano con la stessa
 *   catena di ripiego dell'enigma — nome proprio, specie di catalogo,
 *   famiglia (§1-bis) — quindi chi ha ricevuto l'enigma proprio riceve
 *   anche il seguito proprio, e chi è sceso di un gradino ci resta per
 *   tutte e tre. Non può succedere che la prima strofa parli dei mari
 *   della Luna e la seconda di una macchia del cielo profondo.
 *
 *   DALLA VARIANTE. La strofa si sceglie con lo **stesso** indice della
 *   prima (`missVarianteEnigma`), non con uno nuovo: la variante 2 della
 *   Luna comincia dai mari e la variante 2 del seguito continua da lì.
 *   Con due indici scorrelati le tre righe sarebbero tre indovinelli
 *   diversi sullo stesso oggetto, che è quasi peggio di tre istruzioni.
 *
 * Quello che **non** cambia è che un indizio deve aiutare: dentro a ogni
 * strofa c'è ancora tutto il dato di prima — la direzione, la fascia di
 * altezza, la stella di riferimento con la distanza in dita e pugni — solo
 * che adesso è detto da chi si sta nascondendo invece che da chi legge una
 * mappa. La geometria è la stessa, cambia la bocca che la dice. */

// La variante dell'indovinello di questa tappa, che è **una sola** per
// tutte e tre le strofe. L'eccezione delle figure moderne (§`missEnigma`:
// due varianti invece di tre, perché la terza afferma un'antichità che
// la Macchina Pneumatica non ha) va tenuta qui dentro, se no la prima
// strofa e le altre due si sfaserebbero proprio per loro.
function missVarianteEnigma(t) {
  const quante = (missFamigliaContenuto(t) === 'costellazione' && t && t.antica === false) ? 2 : 3;
  return ((t && t.indizioVariante) || 0) % quante + 1;
}

/* Il seguito dell'enigma: la seconda o la terza strofa.
 *
 * Stessa catena dell'enigma, stessa variante, un gruppo di chiavi diverso.
 * Ai bambini si scende alla versione di famiglia, che è scritta con le
 * loro parole: un seguito per ogni slug, in due lingue e in due registri,
 * sarebbe una tabella che nessuno riesce a tenere vera. */
function missEnigmaSeguito(t, stanza) {
  const gruppo = stanza === 2 ? 'enigmaDue' : 'enigmaTre';
  const modo = missModoAttuale();
  const slug = t.slug || missSlugTappa(t);
  const categoria = missCategoriaTappa(t);
  const famiglia = missFamigliaContenuto(t);
  const n = missVarianteEnigma(t);
  const chiavi = [];
  // Ai bambini le varianti servono più che agli adulti, non meno: il
  // tetto della varietà cede quando il cielo è povero, e tre figure in
  // una serata con la stessa strofa si leggono come un copia-incolla
  // anche a otto anni. La chiave senza numero resta come ultima rete.
  if (modo === 'bambini') {
    chiavi.push('gioco.' + gruppo + 'Bimbi.' + famiglia + '.' + n);
    chiavi.push('gioco.' + gruppo + 'Bimbi.' + famiglia);
  }
  if (slug) chiavi.push('gioco.' + gruppo + '.oggetto.' + slug + '.' + n);
  if (slug) chiavi.push('gioco.' + gruppo + '.oggetto.' + slug);
  if (categoria) chiavi.push('gioco.' + gruppo + '.specie.' + categoria);
  chiavi.push('gioco.' + gruppo + '.' + famiglia + '.' + n);
  return missT(missPrimaChiaveNota(chiavi));
}

/* Seconda strofa: dove mi nascondo.
 *
 * Porta la direzione e la fascia di altezza, cioè esattamente quello che
 * portava prima, e in più il punto cardinale **opposto** — «dai le spalle
 * a sud-est» —, che non è un ornamento: al buio, in un cortile, girarsi
 * partendo da quello che si ha davanti è più facile che cercare un nord
 * che non si vede. Il segno osservabile si aggiunge qui solo a chi non
 * l'ha già avuto con l'enigma, cioè agli esperti (§`MISS_GENEROSITA`);
 * ripeterlo agli altri vorrebbe dire spendere una strofa per non dire
 * niente di nuovo. */
function missIndizioDue(t) {
  const ora = missTappaNelPlanetario(t);
  // Se non e' cercabile non mostriamo piu' il vecchio invito ad
  // abbandonare la serata: la striscia offre direttamente «Vai alle…».
  if (!missAmmissibile(ora, miss.attiva.scelte)) return '';
  const pezzi = [missEnigmaSeguito(t, 2), missT(
    'gioco.dove.' + missFasciaAltezza(ora.altezza) + '.' + missVarianteEnigma(t), {
      dove: astroI18n.nomePunto(ora.azimut),
      spalle: astroI18n.nomePunto((ora.azimut + 180) % 360)
    })];
  const g = MISS_GENEROSITA[missModoAttuale()] || MISS_GENEROSITA.curiosi;
  if (!g.segno) pezzi.push(missSegnoTappa(t));
  return pezzi.filter(Boolean).join(' ');
}

/* Terza strofa: chi mi fa compagnia.
 *
 * Il riferimento è misurato ORA, in tutt'e due le coordinate, e dev'essere
 * visibile a occhio: nessuna stella «a destra» inventata. La distanza si
 * dice in dita e pugni a braccio teso e non in gradi, che è il solo
 * goniometro che tutti hanno addosso — i gradi restano in coda, per chi li
 * vuole. Quando lì attorno non c'è niente di luminoso la strofa cambia
 * argomento invece di inventarsi un vicino: parla della solitudine di quel
 * pezzo di cielo, che è vera e che è già un indizio. */
function missIndizioTre(t) {
  const ora = missTappaNelPlanetario(t);
  if (!missAmmissibile(ora, miss.attiva.scelte)) return '';
  const n = missVarianteEnigma(t);
  const vicino = missVicino(t);
  const seconda = vicino
    ? missT('gioco.compagnia.' + n, {
      nome: vicino.nome,
      verso: missT('verso.' + vicino.verso),
      su: missT('verso.' + vicino.su),
      misura: missT(missMisuraAMano(vicino.gradi).chiave.replace('missione.', '')),
      gradi: Math.round(vicino.gradi)
    })
    : missT('gioco.solitudine.' + n, {
      luce: missT('gioco.' + (t.mag < 1 ? 'brillante' : 'tenue')),
      dove: astroI18n.nomePunto(ora.azimut),
      altezza: missT('altezza.' + missFasciaAltezza(ora.altezza))
    });
  return [missEnigmaSeguito(t, 3), seconda].filter(Boolean).join(' ');
}

// Il ripartitore. Lo zero non passa di qui — l'enigma lo scrive
// `missIntroduzione` — ma resta servito lo stesso: `missIndizio` è
// chiamata anche col livello grezzo di una tappa ripresa da un
// salvataggio, e una direzione è sempre meglio di una riga vuota.
function missIndizio(t) {
  const livello = t.aiuto || 0;
  if (livello === 1) return missIndizioDue(t);
  if (livello >= 2) return missIndizioTre(t);
  const ora = missTappaNelPlanetario(t);
  if (!missAmmissibile(ora, miss.attiva.scelte)) return '';
  return missT('gioco.direzione.' + missVarianteEnigma(t), { dove: astroI18n.nomePunto(ora.azimut) });
}

function missVicino(t) {
  const ora = missTappaAdesso(t);
  if (typeof SKY_STELLE === 'undefined') return null;
  const candidati = SKY_STELLE.map((s, i) => ({ nome: s.nome, tipo: 'stella',
    idCielo: 'Star' + (i + 1), mira: { ra: s.ra, dec: s.dec }, mag: s.mag }));
  for (const c of candidati.sort((a, b) => a.mag - b.mag)) {
    if (c.idCielo === t.idCielo || c.nome === t.capofila) continue;
    const p = missTappaAdesso(c);
    if (p.altezza < 15 || p.sopraOstacoli <= 1 || c.mag > 2) continue;
    const gradi = missDistanzaSferica(ora, p);
    if (gradi < 3 || gradi > 35) continue;
    const delta = ((ora.azimut - p.azimut + 540) % 360) - 180;
    return { nome: c.nome, gradi, verso: delta > 0 ? 'destra' : 'sinistra',
      su: ora.altezza > p.altezza ? 'piuInAlto' : 'piuInBasso' };
  }
  return null;
}

function missDistanzaSferica(a, b) {
  const r = Math.PI / 180;
  const cos = Math.sin(a.altezza*r)*Math.sin(b.altezza*r) +
    Math.cos(a.altezza*r)*Math.cos(b.altezza*r)*Math.cos((a.azimut-b.azimut)*r);
  return Math.acos(Math.max(-1, Math.min(1, cos))) / r;
}

function missDomanda(t) {
  const modo = missModoAttuale();
  const vicino = missVicino(t);
  if (vicino && t.domandaVariante === 2 && modo !== 'bambini')
    return missT('gioco.confronta', { nome: vicino.nome });
  return missT('gioco.domanda.' + (modo === 'bambini' ? 'bambini.' : '') +
    missFamigliaContenuto(t) + '.' + ((t.domandaVariante || 0) % 3 + 1));
}

/* Il cartellino: un numero vero, appeso alla scoperta.
 *
 * L'aneddoto racconta, questo **misura**, e le due cose insieme fanno la
 * differenza fra una curiosità e un ricordo. Non c'è niente di inventato
 * qui dentro: gli anni luce di una stella stanno in `SKY_STELLE`, la
 * larghezza apparente di un oggetto profondo in `dati-profondo.js`, la
 * distanza di un pianeta la sa Astronomy Engine in questo istante.
 *
 * Le tre misure sono scelte perché si possono *immaginare*: l'anno in cui
 * è partita la luce che si sta guardando, quante Lune piene ci starebbero
 * dentro alla nebulosa, quanti minuti ci mette la luce ad arrivare da
 * Saturno. Nessuna delle tre è un numero da scheda tecnica, e nessuna
 * delle tre si può leggere senza fermarsi un attimo. */
function missCartellino(t) {
  if (!t) return '';
  try {
    if (t.tipo === 'stella' && Number.isFinite(t.anniLuce) && t.anniLuce > 0) {
      const anni = Math.round(t.anniLuce);
      const anno = new Date().getFullYear() - anni;
      return anni < 12
        ? missT('gioco.cartellino.stellaVicina', { anni })
        : missT('gioco.cartellino.stella', { anni, anno });
    }
    if (t.tipo === 'profondo' && Number.isFinite(t.assePrimi) && t.assePrimi > 0) {
      const lune = t.assePrimi / 30;
      if (lune >= 0.85) return missT('gioco.cartellino.grande', { lune: Math.round(lune * 10) / 10 });
      return missT('gioco.cartellino.piccolo', { frazione: Math.round(1 / lune) });
    }
    if ((t.tipo === 'pianeta' || t.tipo === 'luna') && typeof Astronomy !== 'undefined') {
      const v = Astronomy.GeoVector(t.corpo || t.idCielo, new Date(), true);
      // Un'unità astronomica sono 499,005 secondi luce: il conto è tutto lì.
      const secondi = v.Length() * 499.005;
      if (secondi < 90) return missT('gioco.cartellino.secondiLuce', { n: Math.round(secondi) });
      if (secondi < 5400) return missT('gioco.cartellino.minutiLuce', { n: Math.round(secondi / 60) });
      return missT('gioco.cartellino.oreLuce', { n: Math.round(secondi / 360) / 10 });
    }
    if (t.tipo === 'costellazione' && t.mira && Number.isFinite(t.mira.ra)) {
      const mese = missMeseDiCulmine(t.mira.ra);
      if (mese) return missT('gioco.cartellino.costellazione', { mese });
    }
  } catch (e) { /* le effemeridi non sono pronte: il cartellino è un di più */ }
  return '';
}

/* In che mese una figura passa alta a mezzanotte.
 *
 * `costMeseMigliore` fa lo stesso conto ma risponde con un nome di mese
 * italiano scritto a mano (`COST_MESI`), e qui quel nome finirebbe dentro
 * a una frase inglese. Il conto è cinque righe e la data la sa formattare
 * il gestore delle lingue, che è l'unico che conosca il mese di chi
 * legge. */
function missMeseDiCulmine(raOre) {
  if (typeof raOre !== 'number') return '';
  const raSole = ((raOre - 12) % 24 + 24) % 24;
  const d = new Date(Date.UTC(2001, 2, 21));
  d.setUTCDate(d.getUTCDate() + Math.round(raSole / 24 * 365.25));
  return (typeof astroI18n === 'object' && astroI18n.data)
    ? astroI18n.data(d, { month: 'long' }) : '';
}

// Che cosa si è trovato, detto con la parola giusta: la specie di
// catalogo se c'è («ammasso globulare», «nebulosa planetaria»), se no la
// famiglia. È la riga che dà un nome alla cosa, prima che l'aneddoto
// racconti la sua storia.
function missSpecieTappa(t) {
  if (t && t.tipo === 'profondo') {
    const categoria = missCategoriaTappa(t);
    if (categoria) return missT('specie.' + categoria);
    if (t.tipoTesto) return t.tipoTesto;
  }
  return missT('specie.' + missFamigliaContenuto(t));
}

function missCuriositaTesto(tappa) {
  const modo = missModoAttuale();
  const famiglia = missFamigliaContenuto(tappa);
  const racconto = missT(missCuriositaChiave(tappa));
  if (modo === 'bambini') {
    /* Ai bambini l'aneddoto arriva preceduto dal «cos'è» della sua
     * famiglia, che è la cornice senza la quale la storia non si appoggia
     * a niente. Poi la catena di sempre, con un gradino in più: la storia
     * scritta per loro se c'è, se no una delle cose da sapere della sua
     * famiglia — e **non** l'aneddoto lungo, che è scritto per un adulto
     * e a un bambino di otto anni non dice niente. */
    const base = missBaseRacconto(tappa);
    const variante = Math.max(0, tappa.raccontoVariante || 0) % 3;
    // La prima pressione conserva la storia specifica dell'oggetto; le
    // successive mostrano davvero racconti diversi, invece di risolvere
    // sempre sulla stessa chiave specifica e dare l'impressione di un tasto rotto.
    const dopo = variante === 0
      ? missPrimaChiaveNota(['gioco.storia.' + base, 'gioco.piccoli.' + famiglia + '.1'])
      : missPrimaChiaveNota(['gioco.piccoli.' + famiglia + '.' + (variante + 1),
        'gioco.storia.' + base]);
    return missT('gioco.bambini.' + famiglia) + ' ' + missT(dopo);
  }
  return racconto;
}

function missFermaVoce() {
  missVoce.sequenza += 1;
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  if (missVoce.audio) {
    missVoce.audio.pause();
    missVoce.audio.removeAttribute('src');
    missVoce.audio = null;
  }
  if (missVoce.urlOggetto && typeof URL !== 'undefined') URL.revokeObjectURL(missVoce.urlOggetto);
  missVoce.urlOggetto = '';
  return missVoce.sequenza;
}

/* In che momento della caccia siamo, per la voce.
 *
 * Sono quattro e non due, perché sono quattro cose diverse da dire:
 * l'enigma (che va lasciato respirare), un indizio (che è
 * un'indicazione), la soluzione (che è una resa, e non si festeggia) e
 * la scoperta (che è il premio). */
function missMomentoVoce(tappa) {
  if (!tappa) return 'indizio';
  if (tappa.fase === 'scoperta') return 'scoperta';
  if (tappa.rivelata && missIndiceIndizio(tappa) >= MISS_INDIZI) return 'soluzione';
  return missIndiceIndizio(tappa) === 0 ? 'enigma' : 'indizio';
}

function missTonoVoce(momento) {
  const perModo = MISS_TONI_VOCE[missModoAttuale()] || MISS_TONI_VOCE.curiosi;
  return perModo[momento] || perModo.indizio;
}

function missSsmlTesto(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Le pause, che sono metà di quello che rende una voce naturale.
 *
 * Una sintesi legge i punti come virgole appena più lunghe, e su un testo
 * fatto di frasi brevi il risultato è un elenco letto tutto d'un fiato —
 * che è esattamente il suono che si riconosce come «voce del computer».
 * Le due righe qui sotto aggiungono mezzo secondo dopo i punti e un
 * quarto dopo le virgole, e sono la differenza fra un testo letto e un
 * testo raccontato.
 *
 * I due punti prendono la pausa più lunga di tutte, e non per simmetria:
 * in questo file introducono quasi sempre la parte che conta — «Indizio
 * 2: trova Vega» — e quella pausa è il momento in cui chi ascolta alza
 * gli occhi. */
function missSsmlPause(testo) {
  return missSsmlTesto(testo)
    .replace(/([:;])\s+/g, '$1<break time="620ms"/>')
    .replace(/([.!?])\s+/g, '$1<break time="480ms"/>')
    .replace(/,\s+/g, ',<break time="220ms"/>');
}

/* Il nome, detto come si dice un nome.
 *
 * Una sintesi legge «Hai trovato M tredici» con lo stesso tono con cui
 * legge «verso nord-ovest», e su una frase che esiste per essere il
 * premio di mezz'ora di ricerca quella piattezza si sente tutta. Le due
 * cose che un narratore vero fa lì sono una pausa brevissima prima del
 * nome — il tempo di prendere fiato, che è anche il tempo in cui chi
 * ascolta capisce che sta per arrivare la risposta — e l'accento sul
 * nome stesso.
 *
 * Si cerca il testo **dopo** che le pause sono state inserite, e se non
 * lo si trova non si fa niente: un nome che contenga un punto sarebbe
 * stato spezzato da un `<break>` e il confronto fallirebbe, il che è un
 * problema di zero conseguenze — si perde l'accento, non la frase. */
function missSsmlRisalta(corpo, enfasi) {
  const bersaglio = missSsmlTesto(enfasi == null ? '' : enfasi).trim();
  if (!bersaglio || bersaglio.length < 2) return corpo;
  const i = corpo.indexOf(bersaglio);
  if (i < 0) return corpo;
  return corpo.slice(0, i) + '<break time="260ms"/><emphasis level="strong">' +
    bersaglio + '</emphasis>' + corpo.slice(i + bersaglio.length);
}

/* Lo SSML, costruito qui e non lasciato al ponte.
 *
 * `mstts:express-as` è quello che porta l'emozione, e vuole due cose che
 * si dimenticano tutte e due: il namespace `xmlns:mstts` sul tag `speak`
 * (senza, l'intero blocco viene ignorato **in silenzio** — il servizio
 * risponde un audio perfetto, letto in tono neutro, e non c'è niente da
 * cui accorgersene) e uno stile che quella voce conosca davvero.
 *
 * `prosody` sta **dentro** allo stile e non fuori: fuori vale come
 * impostazione di partenza e lo stile poi la riscrive, dentro le due
 * cose si sommano. */
function missSsml(testo, lingua, tono, opz) {
  const voci = MISS_VOCI_EDGE[lingua] || MISS_VOCI_EDGE.it;
  const locale = lingua === 'en' ? 'en-US' : 'it-IT';
  const conStile = tono && voci.stili.includes(tono.stile);
  const detto = missSsmlRisalta(missSsmlPause(testo), opz && opz.enfasi);
  const corpo = `<prosody rate="${tono.ritmo}" pitch="${tono.tono}">${detto}</prosody>`;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
    `xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${locale}">` +
    `<voice name="${conStile ? voci.espressiva : voci.stabile}">` +
    (conStile
      ? `<mstts:express-as style="${tono.stile}" styledegree="${tono.grado}">${corpo}</mstts:express-as>`
      : corpo) +
    `</voice></speak>`;
}

/* Il ponte Edge-TTS è deliberatamente configurabile: la PWA resta statica e
 * non può custodire credenziali. Il contratto è piccolo e compatibile sia con
 * un Worker proprio sia con i comuni gateway Edge-TTS: POST JSON in ingresso,
 * audio binario oppure `{ url }` / `{ audio }` in uscita.
 *
 * Si manda **sia** lo SSML sia il testo nudo, ed è la riga che tiene in
 * piedi tutto il pezzo: i gateway Edge-TTS in giro non sono uno solo e
 * non concordano sul nome del campo — chi legge `ssml` lo usa, chi legge
 * solo `text` legge il testo e ottiene quello che otteneva prima. Nessuno
 * dei due riceve una richiesta che non sa interpretare, e chi non fa lo
 * SSML degrada in una lettura buona invece che in un errore. */
async function missRaccontaConEdge(testo, lingua, sequenza, tono, opz) {
  const endpoint = typeof window !== 'undefined' ? String(window.EDGE_TTS_API_URL || '').trim() : '';
  if (!endpoint || typeof fetch !== 'function' || typeof Audio === 'undefined') return false;

  const voci = MISS_VOCI_EDGE[lingua] || MISS_VOCI_EDGE.it;
  const conStile = !!(tono && voci.stili.includes(tono.stile));
  const risposta = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'audio/mpeg, audio/*, application/json' },
    body: JSON.stringify({
      text: testo,
      ssml: missSsml(testo, lingua, tono, opz),
      voice: conStile ? voci.espressiva : voci.stabile,
      style: conStile ? tono.stile : undefined,
      styledegree: conStile ? tono.grado : undefined,
      locale: lingua === 'en' ? 'en-US' : 'it-IT',
      rate: tono.ritmo, pitch: tono.tono,
      format: 'audio-24khz-48kbitrate-mono-mp3'
    })
  });
  if (!risposta.ok) throw new Error(`Edge-TTS HTTP ${risposta.status}`);
  if (sequenza !== missVoce.sequenza) return true;

  const tipo = risposta.headers.get('content-type') || '';
  let sorgente = '';
  if (tipo.includes('application/json')) {
    const dato = await risposta.json();
    if (dato && dato.url) sorgente = String(dato.url);
    else if (dato && dato.audio) sorgente = `data:${dato.mime || 'audio/mpeg'};base64,${dato.audio}`;
  } else {
    const blob = await risposta.blob();
    if (blob.size) {
      sorgente = URL.createObjectURL(blob);
      missVoce.urlOggetto = sorgente;
    }
  }
  if (!sorgente || sequenza !== missVoce.sequenza) return false;

  const audio = new Audio(sorgente);
  missVoce.audio = audio;
  audio.onended = () => { if (missVoce.audio === audio) missVoce.audio = null; };
  await audio.play();
  return true;
}

/* La voce del dispositivo, che è il ripiego e non il ripiego cattivo.
 *
 * Su un telefono di oggi le voci di sistema migliori sono ottime, e la
 * scelta di prima le scartava tutte: preferiva `localService`, che vuol
 * dire «installata sul dispositivo» — cioè, quasi sempre, la vecchia voce
 * concatenativa del sistema — mentre le voci Neural moderne arrivano dalla
 * rete e hanno `localService: false`. Cercando il locale si sceglieva
 * sistematicamente la peggiore delle due.
 *
 * L'ordine giusto lo dà il **nome**, che è l'unica cosa che le API
 * espongano: i produttori marchiano le voci buone («Natural», «Neural»,
 * «Enhanced», «Premium», e su iOS «Siri»), e chi non ha niente di tutto
 * questo si prende quella di sistema come prima. */
const MISS_VOCI_BUONE = /natural|neural|enhanced|premium|siri|wavenet|studio/i;

function missScegliVoceLocale(lingua) {
  const voci = speechSynthesis.getVoices().filter(v =>
    String(v.lang || '').toLowerCase().startsWith(lingua));
  if (!voci.length) return null;
  const punti = v => (MISS_VOCI_BUONE.test(v.name || '') ? 4 : 0) +
    (v.default ? 1 : 0) + (v.localService ? 0 : 1);
  return voci.slice().sort((a, b) => punti(b) - punti(a))[0];
}

/* La sintesi locale non ha gli stili, ma ha ritmo e tono — e su quei due
 * si può ancora dire una cosa in tre modi diversi. Le percentuali del
 * ponte si convertono nelle sue unità: il ritmo è un moltiplicatore
 * attorno a uno, il tono un moltiplicatore attorno a uno dove ottanta
 * hertz sono, all'incirca, tutta la scala di una voce parlata. */
function missRaccontaLocale(testo, lingua, tono) {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return false;
  speechSynthesis.cancel();
  const frase = new SpeechSynthesisUtterance(testo);
  frase.lang = lingua === 'en' ? 'en-US' : 'it-IT';
  frase.voice = missScegliVoceLocale(lingua);
  const perc = parseFloat(tono && tono.ritmo) || 0;
  const hz = parseFloat(tono && tono.tono) || 0;
  frase.rate = Math.max(0.5, Math.min(1.6, 1 + perc / 100));
  frase.pitch = Math.max(0.4, Math.min(1.8, 1 + hz / 80));
  speechSynthesis.speak(frase);
  return true;
}

/* Quello che si sente quando si trova.
 *
 * Era «M tredici. La sua luce è partita…», cioè un cartellino da museo
 * letto ad alta voce: la notizia più bella della serata consegnata con la
 * stessa faccia di un orario ferroviario. La segnalazione lo diceva in
 * chiaro — «quando vince deve leggere evviva, hai trovato, bravo» — e ha
 * ragione, perché è quello che fa **una persona**: prima esulta, poi dice
 * cosa hai trovato, poi racconta.
 *
 * Quindi tre pezzi e in quest'ordine. L'**esclamazione**, che è la sola
 * riga di tutto il file scritta per essere sentita e non letta (sullo
 * schermo il titolo della scoperta la dice già a modo suo). Il **nome**,
 * che la voce accentua e fa precedere da una pausa (§`missSsmlRisalta`).
 * L'**aneddoto** e la domanda, come prima.
 *
 * L'esclamazione segue la variante dell'indovinello e non il caso: la
 * stessa tappa, riletta col tasto «ascolta», deve dire la stessa cosa. */
function missTestoVoceTappa(tappa) {
  if (!tappa) return '';
  if (tappa.fase !== 'scoperta') return missTestoIndizio(tappa);
  return [
    missT('gioco.evviva.' + missVarianteEnigma(tappa)),
    missT('raccontoVoce', { nome: missNomeTappa(tappa), curiosita: missCuriositaTesto(tappa) }),
    missDomanda(tappa)
  ].filter(Boolean).join(' ');
}

/* Il narratore, una volta sola.
 *
 * Tutto quello che questo modulo dice ad alta voce passa di qui: la
 * tappa, e adesso anche il premio di fine serata. Erano due strade
 * separate per un giorno solo, e già in quel giorno avevano due modi
 * diversi di fermare la voce di prima — che è il difetto per cui due
 * frasi si accavallano. */
async function missRacconta(testo, tono, opz) {
  if (!testo) return false;
  const lingua = typeof astroI18n === 'object' && astroI18n.lingua ? astroI18n.lingua : 'it';
  const sequenza = missFermaVoce();
  try {
    if (await missRaccontaConEdge(testo, lingua, sequenza, tono, opz)) return true;
  } catch (errore) {
    console.warn('Missione Cielo: Edge-TTS non disponibile, uso la voce del dispositivo.', errore);
  }
  return sequenza === missVoce.sequenza && missRaccontaLocale(testo, lingua, tono);
}

function missRaccontaTappa(tappa, forza) {
  if (!tappa || (!forza && !(miss.attiva && miss.attiva.scelte.voce))) return Promise.resolve(false);
  // La voce deve seguire esattamente l'indizio selezionato con le frecce,
  // non l'ultimo aiuto sbloccato. `indizioMostrato` può infatti essere
  // precedente ad `aiuto` quando si torna indietro nella sequenza.
  const testo = missTestoVoceTappa(tappa);
  // Il tono si sceglie **dal momento della caccia** e non dal testo: la
  // stessa frase, letta dopo un enigma o dopo una scoperta, sono due cose
  // diverse da dire.
  const tono = missTonoVoce(missMomentoVoce(tappa));
  // Il nome si accentua solo quando è la notizia: dentro a un indizio
  // sarebbe la soluzione detta a voce alta.
  const enfasi = tappa.fase === 'scoperta' ? missNomeTappa(tappa) : '';
  return missRacconta(testo, tono, { enfasi });
}

/* La coppa, detta a voce.
 *
 * Solo se la voce è accesa e solo se una coppa c'è: annunciare «nessuna
 * coppa» a fine serata è la cosa più scoraggiante che questo pezzo
 * potrebbe fare, ed è esattamente per quello che `missCoppaDiMissione`
 * risponde `null` invece di inventarsi un quarto gradino. I premi nuovi
 * si nominano uno per uno: sono rari, e detti in fila valgono meno. */
function missRaccontaPremio(verbale) {
  if (!verbale || !verbale.coppa) return Promise.resolve(false);
  if (!(miss.attiva && miss.attiva.scelte && miss.attiva.scelte.voce)) return Promise.resolve(false);
  const coppa = missT('albo.coppa.' + verbale.coppa);
  const pezzi = [missT('albo.voceCoppa', { coppa, n: verbale.trovate, tot: verbale.tappe })];
  for (const id of verbale.nuovi || []) {
    pezzi.push(missT('albo.vocePremio', { premio: missT('albo.premio.' + id + '.nome') }));
  }
  return missRacconta(pezzi.join(' '), missTonoVoce('premio'), { enfasi: coppa });
}

/* Il richiamo della bacheca, in fondo alla configurazione.
 *
 * Un tasto e non una vetrina: la configurazione è già lunga (§`missHtml\
 * Configurazione`), e le coppe messe lì in grande sarebbero la prima cosa
 * che si vede aprendo il pannello — cioè il punteggio prima del cielo.
 * Chi non ha ancora concluso niente non lo vede affatto: una bacheca
 * vuota, la prima sera, dice soltanto che si è in ritardo su qualcosa. */
function missStrisciaAlbo() {
  const albo = missLeggiAlbo();
  if (!albo.missioni) return '';
  const totale = MISS_COPPE.reduce((n, c) => n + ((albo.coppe && albo.coppe[c]) || 0), 0);
  return `<button type="button" class="missione-tasto missione-tasto-lieve" data-miss-azione="albo">
    ${missIcona('coppa', 16)} ${missT('albo.conCoppe', { n: totale, punti: albo.punti })}</button>`;
}

/* Il riquadro del premio, in testa alla schermata di fine.
 *
 * In testa e non in fondo: è la prima cosa che si vuole sapere alzandosi
 * dalla sedia sdraio, e l'elenco degli esiti — che prima stava da solo —
 * è il **dettaglio** di una risposta che adesso viene data in una riga.
 *
 * Quando la coppa non c'è il riquadro resta, e dice un'altra cosa: chi
 * non ha trovato niente ha comunque passato mezz'ora sotto al cielo, e
 * una schermata che gli risponde col silenzio è peggio di una che gli
 * risponde con poco. */
function missHtmlPremio(m) {
  const p = m && m.premio;
  if (!p) return '';
  const nuovi = (p.nuovi || []).map(id => {
    const premio = missPremioDiId(id);
    return `<li class="missione-premio-nuovo">${missIcona(premio ? premio.icona : 'medaglia', 18)}
      <span><strong>${missT('albo.premio.' + id + '.nome')}</strong>
      <em>${missT('albo.premio.' + id + '.desc')}</em></span></li>`;
  }).join('');

  return `<div class="missione-premio" data-coppa="${p.coppa || 'niente'}">
    <div class="missione-premio-testa">
      <span class="missione-coppa" aria-hidden="true">${missIcona(p.coppa ? 'coppa' : 'bersaglio', 34)}</span>
      <span class="missione-premio-righe">
        <strong class="missione-coppa-nome">${p.coppa
          ? missT('albo.coppaVinta', { coppa: missT('albo.coppa.' + p.coppa) })
          : missT('albo.nessunaCoppa')}</strong>
        <span class="missione-punti">${missT('albo.puntiFatti', { n: p.punti })}</span>
      </span>
    </div>
    ${nuovi ? `<p class="missione-premi-titolo">${missT('albo.premiNuovi', { n: p.nuovi.length })}</p>
      <ul class="missione-premi-elenco">${nuovi}</ul>` : ''}
  </div>`;
}

/* La bacheca: tutto quello che si è messo da parte.
 *
 * I premi non presi si mostrano lo stesso, spenti e con la loro
 * descrizione, ed è la scelta che fa la differenza fra una bacheca e un
 * elenco di cose fatte: un traguardo che non si sa che esiste non fa
 * venire voglia di niente. Quello che **non** si mostra è quanto manca —
 * «sette pianeti su dieci» trasformerebbe una serata sotto le stelle in
 * una barra di avanzamento. */
function missHtmlAlbo() {
  const albo = missLeggiAlbo();
  const coppe = MISS_COPPE.map(c => `<li class="missione-coppa-conto" data-coppa="${c}">
      ${missIcona('coppa', 22)}<strong>${(albo.coppe && albo.coppe[c]) || 0}</strong>
      <span>${missT('albo.coppa.' + c)}</span></li>`).join('');

  const premi = MISS_PREMI.map(p => {
    const preso = !!albo.premi[p.id];
    return `<li class="missione-premio-voce" data-preso="${preso ? 'si' : 'no'}">
      ${missIcona(p.icona, 20)}
      <span><strong>${missT('albo.premio.' + p.id + '.nome')}</strong>
      <em>${missT('albo.premio.' + p.id + '.desc')}</em></span></li>`;
  }).join('');

  return `<div class="missione-albo">
    <h3 class="missione-titolone">${missT('albo.titolo')}</h3>
    <ul class="missione-albo-numeri">
      <li><strong>${albo.punti}</strong><span>${missT('albo.punti')}</span></li>
      <li><strong>${albo.trovati}</strong><span>${missT('albo.trovati')}</span></li>
      <li><strong>${(albo.notti || []).length}</strong><span>${missT('albo.notti')}</span></li>
      <li><strong>${albo.missioni}</strong><span>${missT('albo.missioni')}</span></li>
    </ul>
    <ul class="missione-coppe">${coppe}</ul>
    <h4 class="missione-albo-sezione">${missT('albo.premi')}</h4>
    <ul class="missione-premi-bacheca">${premi}</ul>
    <p class="missione-albo-nota">${missT('albo.spiega')}</p>
    <div class="missione-azioni">
      <button type="button" class="missione-tasto missione-tasto-si" data-miss-azione="chiudiAlbo">${missT('albo.indietro')}</button>
    </div>
  </div>`;
}

function missHtmlConclusa(m) {
  const conto = missConto(m);
  const trovate = m.tappe.filter(t => t.esito === 'trovato');
  const righe = m.tappe.map(t => `<li class="missione-esito-riga" data-esito="${t.esito || 'saltato'}">
      <span class="missione-esito-segno" aria-hidden="true">${
        t.esito === 'trovato' ? '✓' : t.esito === 'nonTrovato' ? '–' : '·'}</span>
      <span class="missione-anteprima-nome">${missTesto(missNomeTappa(t))}</span>
      <span class="missione-esito-che">${missT('esito.' + (t.esito || 'saltato'))}</span>
    </li>`).join('');

  const preferite = trovate.map(t =>
    `<option value="${missTesto(t.id)}">${missTesto(missNomeTappa(t))}</option>`).join('');

  return `<div class="missione-conclusa">
    ${missHtmlPremio(m)}
    <h3 class="missione-titolone">${missT('conclusaTitolo.' + (
      conto.trovato === 0 ? 'niente' : conto.trovato < m.tappe.length ? 'parziale' : 'tutto'),
      { n: conto.trovato, tot: m.tappe.length })}</h3>
    <p class="missione-sommario">${missT('conclusaSommario', {
      n: m.durataRealeMin || m.scelte.durata,
      luogo: missTesto((typeof etichettaLuogo === 'function' && etichettaLuogo()) || missT('luogoIgnoto')),
      // Non `STRUMENTI[…].nome`: quello è un'etichetta da tasto («A occhio
      // nudo», «With the naked eye») e dentro a una frase ci finisce con la
      // maiuscola in mezzo. Qui serve la forma da frase, che è un'altra
      // voce del dizionario.
      strumento: missT('strumento.' + m.scelte.strumento)
    })}</p>
    <ul class="missione-esiti">${righe}</ul>

    <div class="missione-modulo">
      ${trovate.length ? `<label class="missione-campo">
        <span>${missT('preferito')}</span>
        <select id="missione-preferita" class="missione-select">
          <option value="">${missT('nessunPreferito')}</option>${preferite}
        </select></label>` : ''}
      <label class="missione-campo">
        <span>${missT('votoSerata')}</span>
        <div id="missione-stelle" class="missione-stelle" role="radiogroup" aria-label="${missT('votoSerata')}">
          ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="missione-stella"
             role="radio" aria-checked="false" data-miss-stelle="${n}"
             aria-label="${missT('stelleSu5', { n })}">★</button>`).join('')}
        </div></label>
      <label class="missione-campo">
        <span>${missT('nota')}</span>
        <textarea id="missione-nota" class="missione-nota" rows="2"
          placeholder="${missT('notaSegnaposto')}"></textarea></label>
    </div>

    <div class="missione-azioni">
      <button type="button" class="missione-tasto missione-tasto-si" data-miss-azione="salvaDiario">
        ${missIcona('quaderno', 16)} ${missT('salvaNelDiario')}</button>
      <button type="button" class="missione-tasto" data-miss-azione="configura">${missT('unaltraMissione')}</button>
      <button type="button" class="missione-tasto" data-miss-azione="albo">${missIcona('coppa', 16)} ${missT('albo.vedi')}</button>
      <button type="button" class="missione-tasto missione-tasto-lieve" data-miss-azione="butta">${missT('butta')}</button>
    </div>
  </div>`;
}

// --- i comandi ------------------------------------------------------

function missCollegaPannello(corpo) {
  corpo.querySelectorAll('[data-miss-scelta]').forEach(b => {
    b.addEventListener('click', () => {
      const nome = b.dataset.missScelta;
      let valore = nome === 'durata' ? Number(b.dataset.missValore) : b.dataset.missValore;
      if (nome === 'voce') valore = valore === 'si';
      miss.scelte[nome] = valore;
      if (nome === 'cielo') miss.rilievoSettore = null;
      // Cambiata una scelta, il cielo da cui si pesca è un altro: la
      // memoria delle anteprime scartate parlava di un pool che non
      // esiste più, e tenerla vorrebbe dire penalizzare i bersagli
      // appena ammessi.
      miss.anteprimeViste = [];
      missSalvaScelte();
      missDisegnaPannello();
    });
  });
  // Il pannello dei dettagli si ricorda di essere stato aperto: toccare
  // «Settore» ridisegna il corpo, ma non deve richiuderlo.
  const dettagli = corpo.querySelector('[data-miss-dettagli]');
  if (dettagli) dettagli.addEventListener('toggle', () => { miss.dettagliAperti = dettagli.open; });

  corpo.querySelectorAll('[data-miss-limite]').forEach(s => s.addEventListener('change', () => {
    miss.scelte[s.dataset.missLimite] = Number(s.value);
    miss.rilievoSettore = null;
    missSalvaScelte();
  }));
  const momento = corpo.querySelector('[data-miss-momento]');
  if (momento) momento.addEventListener('change', () => {
    const ms = new Date(momento.value).getTime();
    miss.scelte.momentoPersonalizzato = Number.isFinite(ms) ? ms : null;
    missSalvaScelte();
  });
  const rileva = corpo.querySelector('[data-miss-rileva]');
  if (rileva) rileva.addEventListener('click', () => missRilevaEstremo(rileva));

  // Le cinque stelle: si accendono fino a quella toccata, come ovunque.
  let stelle = 0;
  corpo.querySelectorAll('[data-miss-stelle]').forEach(b => {
    b.addEventListener('click', () => {
      stelle = Number(b.dataset.missStelle);
      corpo.querySelectorAll('[data-miss-stelle]').forEach(x => {
        const acceso = Number(x.dataset.missStelle) <= stelle;
        x.classList.toggle('accesa', acceso);
        x.setAttribute('aria-checked', String(Number(x.dataset.missStelle) === stelle));
      });
      corpo.dataset.stelle = String(stelle);
    });
  });

  corpo.querySelectorAll('[data-miss-azione]').forEach(b => {
    b.addEventListener('click', () => missAzione(b.dataset.missAzione, corpo));
  });
}

async function missRilevaEstremo(tasto) {
  tasto.disabled = true;
  const stato = tasto.parentElement.querySelector('.missione-rilievo-stato');
  if (stato) stato.textContent = missT('settoreRilevaAttesa');

  const avviato = typeof skyRichiediSensori === 'function' && await skyRichiediSensori();
  let azimut = null;
  if (avviato && typeof skyLeggiAzimutBussola === 'function') {
    // La prima lettura puo' arrivare qualche istante dopo il consenso del
    // sistema. Si aspetta qui, senza costringere a premere una seconda volta.
    const scadenza = Date.now() + 2500;
    while (azimut === null && Date.now() < scadenza) {
      azimut = skyLeggiAzimutBussola();
      if (azimut === null) await new Promise(resolve => setTimeout(resolve, 80));
    }
  }
  if (azimut === null) {
    if (stato) stato.textContent = missT('settoreRilevaNonDisponibile');
    tasto.disabled = false;
    return;
  }

  const gradi = Math.round(azimut) % 360;
  if (!miss.rilievoSettore) {
    miss.scelte.cieloDa = gradi;
    miss.rilievoSettore = { primo: gradi };
  } else {
    miss.scelte.cieloA = gradi;
    miss.rilievoSettore = null;
  }
  missSalvaScelte();
  missDisegnaPannello();
}

function missAzione(azione, corpo) {
  miss.avviso = null;
  switch (azione) {
    case 'solo-voce': {
      miss.strisciaNascosta = true;
      const tappa = miss.attiva && miss.attiva.tappe[miss.attiva.corrente];
      missMostraStrisciaCielo();
      if (tappa) missRaccontaTappa(tappa, true);
      break;
    }
    case 'mostra-guida':
      miss.strisciaNascosta = false;
      missMostraStrisciaCielo();
      break;
    case 'altraStoria': {
      // Un'altra storia sullo stesso oggetto, non un'altra tappa: si
      // gira la variante e si ridisegna senza cambiare tappa.
      const t = miss.attiva && miss.attiva.tappe[miss.attiva.corrente];
      if (!t) break;
      const quante = missQuanteVarianti('curiosita.' + missBaseRacconto(t));
      // Se una vecchia tappa non ha ancora una variante salvata, il testo
      // mostrato nasce dall'hash del nome: si deve avanzare da quella
      // variante effettiva, non ripartire arbitrariamente da zero.
      const corrente = Number.isInteger(t.raccontoVariante)
        ? t.raccontoVariante : missHashTesto(missNomeNudo(t.nome));
      t.raccontoVariante = (corrente + 1) % Math.max(1, quante);
      missSalvaAttiva();
      missMostraStrisciaCielo();
      missMostraVista('inCorso');
      missRaccontaTappa(t);
      break;
    }
    case 'segui-telefono':
      missSeguiTelefono();
      break;
    case 'termina':
      // La X chiude definitivamente il percorso ma lascia aperto il
      // planetario, che torna subito al suo uso normale.
      missAbbandona();
      break;
    case 'genera':
    case 'rigenera': {
      // «Genera» è una serata nuova e riparte con la memoria pulita;
      // «un'altra» è un ricambio, e deve ricordarsi di tutte quelle che
      // ha già fatto vedere — non solo dell'ultima.
      if (azione === 'genera') miss.anteprimeViste = [];
      missPreparaAnteprima();
      break;
    }
    case 'albo':
      // La bacheca si apre da sola e si chiude da dove si era: `tornaDa`
      // è l'unica cosa che si ricorda, e non si salva — una bacheca
      // aperta non è uno stato della serata.
      miss.tornaDa = miss.vista;
      missMostraVista('albo');
      break;
    case 'chiudiAlbo':
      missMostraVista(miss.tornaDa || 'configurazione');
      miss.tornaDa = null;
      break;
    case 'sbircia':
      miss.sbircia = !miss.sbircia;
      missMostraVista('anteprima');
      break;
    case 'configura':
      miss.anteprima = null;
      miss.anteprimeViste = [];
      miss.sbircia = false;
      // Una missione conclusa e non salvata si archivia qui: chi chiede
      // un'altra missione ha finito con quella, e tenersela in giro
      // farebbe riaprire il pannello sul risultato di ieri.
      if (miss.attiva && miss.attiva.stato === 'conclusa') { miss.attiva = null; missSalvaAttiva(); }
      missMostraVista('configurazione');
      break;
    case 'avvia':
      missAvvia(miss.anteprima);
      break;
    case 'avviaDopo': {
      const quando = miss.anteprima && miss.anteprima.tappe.length
        ? Math.min(...miss.anteprima.tappe.map(t => t.quando)) : null;
      missAvvia(miss.anteprima, quando || Date.now());
      break;
    }
    case 'vai-al-momento': {
      const m = miss.attiva, t = m && m.tappe[m.corrente];
      const istante = missProssimoIstanteCercabile(t);
      if (!Number.isFinite(istante)) break;
      m.simulazione = true;
      t.quando = istante;
      skyFermaPlayback();
      skyImpostaOffsetTempo((istante - Date.now()) / 1000);
      skyAggiornaOggetti(true);
      const o = t.idCielo && skyVoceDiId(t.idCielo);
      if (o) skyAssicuraVisibile(o);
      missSalvaAttiva();
      missMostraStrisciaCielo();
      missRaccontaTappa(t);
      break;
    }
    case 'guidami':
      missGuidami(miss.attiva ? miss.attiva.corrente : 0);
      break;
    case 'ascolta':
      if (miss.attiva) missRaccontaTappa(miss.attiva.tappe[miss.attiva.corrente], true);
      break;
    case 'continua': {
      const t = miss.attiva && miss.attiva.tappe[miss.attiva.corrente];
      if (!t || t.fase !== 'scoperta') break;
      t.fase = 'conclusa';
      missFermaVoce();
      missAvanza();
      break;
    }
    case 'torna':
      missTornaDalPlanetario();
      break;
    case 'nonTrovato':
      missSegnaEsito(miss.attiva.corrente, 'nonTrovato');
      break;
    case 'salta':
      missSegnaEsito(miss.attiva.corrente, 'saltato');
      break;
    case 'aiuto':
      missChiediAiuto();
      break;
    case 'soluzione':
      missMostraSoluzione();
      break;
    case 'indizio-precedente': {
      const t = miss.attiva && miss.attiva.tappe[miss.attiva.corrente];
      if (t) {
        t.indizioMostrato = Math.max(0, missIndiceIndizio(t) - 1);
        t.mostraAiuto = t.indizioMostrato > 0;
        missSalvaAttiva(); missMostraVista('inCorso'); missMostraStrisciaCielo();
        missRaccontaTappa(t);
      }
      break;
    }
    case 'indizio-successivo': {
      const t = miss.attiva && miss.attiva.tappe[miss.attiva.corrente];
      if (!t) break;
      if (missIndiceIndizio(t) < (t.aiuto || 0)) {
        t.indizioMostrato = missIndiceIndizio(t) + 1;
        t.mostraAiuto = true;
        missSalvaAttiva(); missMostraVista('inCorso'); missMostraStrisciaCielo();
        missRaccontaTappa(t);
      } else missChiediAiuto();   // e si ferma al terzo: la soluzione ha il suo tasto
      break;
    }
    case 'sostituisci':
      missSostituisci(miss.attiva.corrente);
      break;
    case 'concludi':
      missConcludi();
      break;
    case 'salvaDiario': {
      const nota = corpo.querySelector('#missione-nota');
      const preferita = corpo.querySelector('#missione-preferita');
      const salvato = missSalvaNelDiario({
        nota: nota ? nota.value.trim() : '',
        stelle: Number(corpo.dataset.stelle || 0),
        preferita: preferita ? (preferita.value || null) : null
      });
      miss.attiva = null;
      missSalvaAttiva();
      missAvvisa(salvato ? 'salvataNelDiario' : 'diarioNonDisponibile', {}, salvato ? 'bene' : 'informa');
      missMostraVista('configurazione');
      break;
    }
    case 'butta':
      missAbbandona();
      break;
  }
}

/* Preparare l'anteprima, e dire perché quando non si può.
 *
 * I tre esiti sono tre, non due: la missione c'è, la missione non c'è
 * perché manca qualcosa (posizione, libreria), oppure la missione non c'è
 * perché **il cielo non offre niente** — che è un'informazione vera e non
 * un guasto, e va detta con altre parole. */
function missPreparaAnteprima(evitare) {
  // Una missione nuova è una caccia nuova: chi aveva sbirciato quella di
  // prima non si ritrova i nomi già scoperti su questa.
  miss.sbircia = false;
  const partenza = missPartenzaScelta();
  const scenario = missScenario(miss.scelte, partenza);
  if (scenario.errore) {
    missAvvisa(scenario.errore, {}, 'informa');
    missMostraVista('vuoto');
    return null;
  }
  const storia = missLeggiSalvato(CHIAVE_MISS_STORIA) || {};
  const recenti = (storia.missioniRecenti || [storia.recenti || []]).flat();
  scenario.evitare = [...(evitare || []), ...recenti];
  // Le anteprime che si è appena scartate premendo «un'altra missione»
  // sono un no, non un piuttosto-no: hanno la loro penale (§2).
  scenario.rifiutati = miss.anteprimeViste.flat();
  scenario.storia = storia.varianti || {};
  scenario.domande = storia.domande || {};
  const generata = missGeneraMissione(scenario);
  if (generata.vuota) {
    missMostraVista('vuoto');
    return null;
  }
  miss.anteprimeViste = [generata.tappe.map(t => t.id), ...miss.anteprimeViste]
    .slice(0, MISS_MISSIONI_DA_RICORDARE);
  if (generata.tappe.length < (MISS_TAPPE_PER_DURATA[miss.scelte.durata] || {}).min) {
    missAvvisa('missioneCorta', {}, 'informa');
  }
  miss.anteprima = generata;
  missMostraVista('anteprima');
  return generata;
}


// =====================================================================
// 9. L'AVVIO E I GANCI
//
//     Tutto quello che questo file mette nel mondo di fuori sta qui, ed
//     è poco di proposito: la scheda di Stasera la disegna
//     `missAggiornaScheda` (che chiama `ui-nuova.js`), la finestra si
//     apre da `missApriPannello`, e la striscia sul cielo si accende da
//     sé quando serve. Niente timer permanenti: a pannello chiuso questo
//     modulo non gira.
// =====================================================================

function missInizializza() {
  missCaricaScelte();
  missCaricaAttiva();

  const chiudi = document.getElementById('btn-chiudi-missione');
  if (chiudi) chiudi.addEventListener('click', () => missChiudiPannello());

  const modale = document.getElementById('modale-missione');
  if (modale) {
    modale.addEventListener('click', e => { if (e.target === modale) missChiudiPannello(); });
  }

  const striscia = document.getElementById('missione-striscia');
  if (striscia) missRendiStrisciaSpostabile(striscia);

  missAggiornaScheda();
  // Chi ricarica la pagina mentre era nel planetario ritrova la striscia:
  // la missione non è finita solo perché la pagina si è riaperta.
  missMostraStrisciaCielo();
}

function missRendiStrisciaSpostabile(el) {
  let trascinamento = null;
  el.addEventListener('pointerdown', e => {
    if (!e.target.closest('.missione-trascina')) return;
    const r = el.getBoundingClientRect();
    const contenitore = el.offsetParent && el.offsetParent.getBoundingClientRect
      ? el.offsetParent.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    trascinamento = { x: e.clientX, y: e.clientY, left: r.left - contenitore.left,
      top: r.top - contenitore.top };
    el.classList.add('in-trascinamento');
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  el.addEventListener('pointermove', e => {
    if (!trascinamento || !el.hasPointerCapture(e.pointerId)) return;
    missPosizionaStriscia(el, trascinamento.left + e.clientX - trascinamento.x,
      trascinamento.top + e.clientY - trascinamento.y);
  });
  const termina = () => {
    if (trascinamento) miss.posizioneStriscia = { left: parseFloat(el.style.left) || 0,
      top: parseFloat(el.style.top) || 0 };
    trascinamento = null; el.classList.remove('in-trascinamento');
  };
  el.addEventListener('pointerup', termina);
  el.addEventListener('pointercancel', termina);
  el.addEventListener('keydown', e => {
    if (!e.target.closest('.missione-trascina') || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'Home') { miss.posizioneStriscia = null; el.removeAttribute('style'); return; }
    const r = el.getBoundingClientRect(), contenitore = el.offsetParent.getBoundingClientRect();
    const passo = e.shiftKey ? 40 : 10;
    missPosizionaStriscia(el, r.left - contenitore.left + (e.key === 'ArrowLeft' ? -passo : e.key === 'ArrowRight' ? passo : 0),
      r.top - contenitore.top + (e.key === 'ArrowUp' ? -passo : e.key === 'ArrowDown' ? passo : 0));
    miss.posizioneStriscia = { left: parseFloat(el.style.left), top: parseFloat(el.style.top) };
  });
  addEventListener('resize', () => { if (miss.posizioneStriscia && !el.classList.contains('hidden'))
    missPosizionaStriscia(el, miss.posizioneStriscia.left, miss.posizioneStriscia.top); });
}

function missPosizionaStriscia(el, left, top) {
  const contenitore = el.offsetParent && el.offsetParent.getBoundingClientRect
    ? el.offsetParent.getBoundingClientRect() : { width: innerWidth, height: innerHeight };
  const maxLeft = Math.max(0, contenitore.width - el.offsetWidth);
  const maxTop = Math.max(0, contenitore.height - el.offsetHeight);
  el.style.left = Math.max(0, Math.min(maxLeft, left)) + 'px';
  el.style.top = Math.max(0, Math.min(maxTop, top)) + 'px';
  el.style.right = 'auto';
  el.style.margin = '0';
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', missInizializza, { once: true });
  } else {
    missInizializza();
  }
}

// Le sole funzioni che il resto dell'app chiama per nome.
if (typeof window !== 'undefined') {
  window.missApriPannello = missApriPannello;
  window.missAggiornaScheda = missAggiornaScheda;
  window.missTornaDalPlanetario = missTornaDalPlanetario;
  window.missMostraStrisciaCielo = missMostraStrisciaCielo;
  window.missVoceDiario = missVoceDiario;
}


// =====================================================================
// 10. LE PROVE
//
//     Il motore è fatto di funzioni pure apposta perché si possa
//     provare senza aprire un browser: `scripts/prova-missione.js` legge
//     questo file, gli dà uno scenario finto e guarda che missione ne
//     esce. Si espone un oggetto solo — è la stessa forma che usa
//     `didattica.js` con `window.didProve` — invece di rendere globale
//     mezza dozzina di nomi.
// =====================================================================

const missProve = {
  genera: missGeneraMissione,
  selezioneCorretta: missSelezioneCorretta,
  distanzaSferica: missDistanzaSferica,
  punteggio: missPunteggio,
  ammissibile: missAmmissibile,
  quanteTappe: missQuanteTappe,
  famiglia: missFamigliaDi,
  ordina: missOrdinaPerProgressione,
  inOrario: missMettiInOrario,
  riferimenti: missAttaccaRiferimenti,
  scartoAzimut: missScartoAzimut,
  azimutNelSettore: missAzimutNelSettore,
  strumentoBasta: missStrumentoBasta,
  fasciaAltezza: missFasciaAltezza,
  misuraAMano: missMisuraAMano,
  curiositaChiave: missCuriositaChiave,
  baseRacconto: missBaseRacconto,
  slugTappa: missSlugTappa,
  fascinoDi: missFascinoDi,
  voceRepertorio: missVoceRepertorio,
  siglaCatalogo: missSiglaCatalogo,
  separazioneCatalogo: missSeparazioneCatalogo,
  doppione: missDoppione,
  chiaveRegistro: missChiaveRegistro,
  evidenza: missEvidenzaDaMagnitudine,
  limiteStellareLocale: missLimiteStellareLocale,
  bortleScelto: missBortleScelto,
  visibileNelCieloLocale: missVisibileNelCieloLocale,
  difficolta: missDifficolta,
  salvataggioBuono: missSalvataggioBuono,
  daAggiornare: missDaAggiornare,
  conto: missConto,
  campioni: missCampioni,
  ssml: missSsml,
  tonoVoce: missTonoVoce,
  momentoVoce: missMomentoVoce,
  generiScelti: missGeneriScelti,
  genereAmmesso: missGenereAmmesso,
  figureDelCielo: missFigureDelCielo,
  figuraAntica: missFiguraAntica,
  enigma: missEnigma,
  misuraTappa: missMisuraTappa,
  candidatiAOrarioPreciso: missCandidatiAOrarioPreciso,
  caso: missCaso,
  pescaPesato: missPescaPesato,
  varianteEnigma: missVarianteEnigma,
  enigmaSeguito: missEnigmaSeguito,
  notteDi: missNotteDi,
  alboVuoto: missAlboVuoto,
  alboDistinti: missAlboDistinti,
  costoAiuti: missCostoAiuti,
  puntiMissione: missPuntiMissione,
  coppaDiMissione: missCoppaDiMissione,
  alboConMissione: missAlboConMissione,
  ssmlRisalta: missSsmlRisalta,
  testoVoceTappa: missTestoVoceTappa,
  costanti: {
    MISS_VERSIONE, MISS_DURATE, MISS_STRUMENTI, MISS_ESPERIENZE, MISS_DIREZIONI, MISS_BORTLE,
    MISS_TAPPE_PER_DURATA, MISS_ALTEZZA_MINIMA, MISS_DIFFICOLTA_MASSIMA,
    MISS_DIFFICOLTA_GRADITA, MISS_GENEROSITA, MISS_REPERTORIO,
    MISS_STESSO_CAMPO_GRADI, MISS_PREAVVISO_MIN,
    MISS_SCADENZA_MS, MISS_TETTO_FAMIGLIA, MISS_LIVELLO_STRUMENTO,
    MISS_GENERI, MISS_GENERI_TUTTI, MISS_GENERE_DI_TIPO, MISS_TEMPERATURA,
    MISS_PENALE_RECENTE, MISS_PENALE_RIFIUTATO, MISS_MISSIONI_DA_RICORDARE,
    MISS_INDIZI, MISS_VOCI_EDGE, MISS_TONI_VOCE, MISS_CHIAVI_BAMBINI,
    MISS_PREMI, MISS_PUNTI, MISS_COPPE, MISS_ALBO_VERSIONE,
    MISS_COPPA_ORO_AIUTI, MISS_COPPA_ARGENTO_AIUTI, MISS_COPPA_ARGENTO_QUOTA,
    MISS_MARATONA_TAPPE,
    CHIAVE_MISS_SCELTE, CHIAVE_MISS_ATTIVA, CHIAVE_MISS_ALBO
  }
};
if (typeof window !== 'undefined') window.missProve = missProve;
if (typeof module !== 'undefined' && module.exports) module.exports = missProve;
