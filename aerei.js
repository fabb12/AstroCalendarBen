// Aerei nel Planetario — dati ADS-B in tempo reale.
//
// I provider e tutto il trasporto stanno qui: GitHub Pages non puo fare da
// proxy. I proxy CORS pubblici non sono provider ADS-B: applicano limiti e
// autenticazione propri (401/408) e percio' non fanno parte della corsa.
//
// L'ordine e' **Worker del progetto prima, reti dirette in coda**, ed e' una
// lezione pagata due volte. Le quattro reti di comunita' non mandano il CORS,
// quindi da un browser non funzionano mai; dal Worker il CORS non c'entra ma
// rifiutano l'IP condiviso di Cloudflare. La via d'uscita e' una fonte con
// credenziali, che solo il Worker puo' tenere. Vedi il commento esteso in
// `providersDisponibili()` e l'intestazione di `worker-adsb.js`.
//
// LA LEZIONE DI QUESTO FILE, in una riga: **una porta ADS-B carica non
// risponde «carico», tace** — e tacere consuma tutta la sveglia. Provandole in
// fila indiana con dodici secondi a testa, sette porte fanno un minuto e
// mezzo di silenzio, e nel frattempo chi guarda il cielo conclude che gli
// aerei «a volte ci sono e a volte no». Da qui le quattro scelte che tengono
// in piedi il modulo:
//
//   1. **La corsa** (§3). Le porte non si provano una per volta: si lancia la
//      prima, e dopo `AFFIANCA_MS` parte anche la seconda. Vince chi risponde
//      per prima, le altre si abortiscono. Una porta *caduta* lascia subito il
//      posto alla prossima; l'affiancamento serve solo a chi tace.
//   2. **La memoria** (§2). Quale porta funziona qui e adesso non si indovina:
//      si misura. Ogni esito aggiorna una pagella salvata in `localStorage`, e
//      il giro dopo si comincia da chi ha risposto per ultimo — non dal primo
//      dell'elenco, che potrebbe essere chiuso da ieri.
//   3. **Il sospetto** (§1). Una risposta che arriva non è una risposta buona:
//      un ponte CORS in difficoltà restituisce 200 con dentro una pagina di
//      errore, e `(risposta.ac || [])` la trasforma in un allegro «zero aerei
//      trovati». Ogni interprete pretende quindi di riconoscere lo schema, e
//      se non lo riconosce **solleva**, così la corsa passa alla porta dopo.
//   4. **La tolleranza** (§4-bis). Muoversi non è cambiare cielo: le posizioni
//      degli aerei sono latitudini e longitudini, e da dove le si guarda si
//      rifà a ogni fotogramma. Col GPS acceso l'osservatore si sposta ogni
//      centocinquanta metri, e prima ognuno di quei passi buttava la
//      fotografia e **interrompeva la richiesta in volo**: in macchina
//      nessuna risposta faceva in tempo ad arrivare. Adesso si riscarica per
//      lo spostamento solo oltre una tolleranza, mai prima di
//      `AEREI_MOTO_MIN_MS`, e ogni lettura si **somma** alla precedente
//      invece di sostituirla — se i dati arrivano di rado, quando arrivano
//      vanno sfruttati fino in fondo.
//
//   5. **Il ciclo** (§6). Il primo scarico non prova niente: parte da
//      `aereiAvvia`, cioè fuori dal battito. Tutti quelli dopo dipendono da
//      due cose che nessuno guarda — che il battito arrivi in fondo alla sua
//      funzione, e che `stato.richiesta` torni a essere nulla — e basta che
//      una delle due si inceppi una volta perché il feed resti fermo per
//      sempre, con la spia verde e un cielo di cinque minuti fa. Da qui la
//      rete attorno a quello che tocca il documento (`guardato`), i due
//      guardiani (`sorvegliaRichiesta`, `sorvegliaBattito`) e la regola che
//      nessuna uscita da `carica` lascia il ritmo senza riprogrammare: la
//      riprova mancata non è un ciclo morto, è una raffica a tutte le porte
//      ogni cinque secondi — cioè il modo più rapido di prendersi un 429 da
//      tutte insieme e restare davvero senza aerei.
//
//   6. **L'aggregatore** (§3-bis … §3-quinquies). Il motore non conosce le
//      porte: chiede alla facciata `FontiAerei.acquisisci` e riceve record
//      normalizzati (una forma, un'unità di misura, un identificativo) e già
//      **fusi** — lo stesso aereo visto da due fonti è un'icona sola, con la
//      lettura più recente. Ogni porta ha il suo circuito (chiuso, aperto,
//      semiaperto), la sua memoria delle risposte e le sue richieste gemelle
//      condivise; uno zero dove poco prima c'era traffico non chiude la
//      corsa, lascia parlare la porta dopo. E ogni aereo ha un'**età**: vivo,
//      interpolato, stantio, e oltre `etaMassimaMs()` non c'è più — perché
//      propagare la rotta serve a far scorrere il disegno, non a inventare.
//      Le fonti con credenziali (OpenSky con un account, ADS-B Exchange in
//      abbonamento) stanno solo nel Worker: vedi `worker-adsb.js`.
//
// I dati si scaricano da soli all'apertura del planetario; il **disegno** è
// un'altra cosa e nasce spento (§5). Sono due interruttori perché sono due
// domande diverse: «voglio sapere cosa c'è in cielo» e «voglio vederlo
// disegnato sopra le stelle».
(function () {
  'use strict';

  // --- Il ritmo -------------------------------------------------------
  // Un aereo di linea fa duecentocinquanta metri al secondo: dopo cinque
  // minuti la fotografia è vecchia di settantacinque chilometri, cioè più del
  // raggio di ricerca. Con il disegno acceso si aggiorna quindi ogni
  // quarantacinque secondi; a disegno spento — dati sì, ma nessuno li guarda
  // — basta tenerli tiepidi. Fra le due c'è un fattore quattro, ed è quello
  // che permette di tenere il feed sempre acceso senza consumare la quota dei
  // servizi pubblici.
  // Venticinque e non più quarantacinque: da quando ogni aereo porta la sua
  // età (§3-quinquies) e oltre un minuto si dichiara stantio, un ritmo da
  // quarantacinque secondi faceva passare metà del traffico per «dato
  // vecchio» fra un giro e l'altro. Un aereo di linea in venticinque secondi
  // fa sei chilometri: meno di una tacca della previsione.
  const AGGIORNA_VISIBILE_MS = 25000;
  const AGGIORNA_SFONDO_MS = 180000;
  // Dopo un 429 (o un 503) il ritmo si raddoppia per dieci minuti anche
  // quando le richieste tornano a riuscire. La scala delle riprove frena il
  // guasto; questo frena la **causa**, che è bussare troppo spesso.
  const FRENO_LIMITE_MS = 600000;
  // Tornando su una scheda rimasta in secondo piano si riscarica subito se la
  // fotografia ha più di dieci secondi: è il momento in cui uno guarda.
  const RIENTRO_MS = 10000;
  // Oltre questa età la fotografia si dichiara vecchia: le posizioni restano
  // disegnate (sono propagate, non congelate) ma la spia passa all'ambra e la
  // riga di stato lo dice, invece di lasciar credere che siano di adesso.
  const DATI_VECCHI_MS = 150000;
  // Oltre questa, propagare non ha più senso: mezz'ora di rotta stimata è un
  // aereo inventato. Si continua a riprovare e la mappa si svuota.
  const DATI_SCADUTI_MS = 1800000;
  // Il battito che controlla se è ora di aggiornare. È corto e costa niente
  // (un confronto fra due numeri): un `setInterval` lungo, su un telefono che
  // mette l'app in secondo piano, viene strozzato o saltato del tutto, e al
  // ritorno il prossimo aggiornamento sarebbe fra cinque minuti.
  const BATTITO_MS = 5000;
  // La sveglia di una singola porta, quella di tutta la corsa, e il ritardo
  // con cui si affianca la porta successiva. `AFFIANCA_MS` è la manopola che
  // conta: troppo corto e si bussa a tutte le porte insieme (che è come si
  // consuma una quota), troppo lungo e si torna alla fila indiana.
  const PROVIDER_ATTESA_MS = 9000;
  const CORSA_ATTESA_MS = 22000;
  const AFFIANCA_MS = 2600;
  // Le riprove dopo un guasto. La prima è corta di proposito: il caso più
  // comune non è «il servizio è giù», è «questa richiesta è andata storta».
  // Aspettare un minuto pieno, come si faceva prima, trasformava un singolo
  // pacchetto perso in un minuto di cielo senza aerei.
  const RIPROVE_MS = [3000, 9000, 25000, 60000, 150000, 300000];
  // Un 429 — e un 503, che è lo stesso discorso detto dal server invece che
  // dal suo portiere — non è un guasto come gli altri, ed è la ragione per
  // cui ha una riga sua. Tutti gli altri dicono «questa richiesta è andata
  // storta», e lì la cura è riprovare presto; questi due dicono **stai
  // bussando troppo**, e riprovare fra tre secondi è esattamente la mossa che
  // li ha causati — con l'aggravante che ogni rifiuto in più conferma al
  // servizio che il torto è nostro. Si parte quindi da un gradino più su
  // della scala invece che dal primo, cioè si salta la riprova corta che per
  // tutti gli altri guasti è la cosa giusta da fare.
  const RIPROVA_LIMITE_DA = 3;
  // E se il servizio dice **fra quanto** tornare (`Retry-After`, in secondi o
  // come data HTTP), quella è l'unica risposta che non stiamo indovinando:
  // vale più di qualunque scala scritta qui. Il tetto serve a non restare
  // fermi mezza giornata per un'intestazione scritta male.
  const RETRY_AFTER_MAX_MS = 1800000;
  // Fin dove può arrivare la penale di una porta (§2). La scala che raddoppia
  // si ferma a dieci minuti; un `Retry-After` esplicito può chiedere di più,
  // perché non è una nostra stima ma un'istruzione di chi risponde.
  const PENALE_MAX_MS = 600000;
  // --- I due guardiani del ciclo --------------------------------------
  // Non sono paranoia: sono la risposta al difetto per cui il primo scarico
  // riusciva sempre e i successivi non arrivavano quasi mai. Il primo scarico
  // parte da `aereiAvvia`, cioè **fuori** dal battito; tutti gli altri
  // dipendono dal battito che arriva in fondo alla sua funzione e da
  // `stato.richiesta` che torna a essere nulla. Basta che una di quelle due
  // cose si inceppi una volta — un'eccezione mentre si ridisegna il pannello,
  // una promessa che non si chiude — perché il feed resti fermo per sempre
  // senza che niente lo dica: il `setInterval` continua a battere, la spia
  // resta verde, e il cielo è quello di cinque minuti fa.
  //
  // `BATTITO_FERMO_MS` è da quanto un battito dev'essere vecchio perché il
  // ciclo si consideri morto (quattro giri: un browser che strozza i timer in
  // secondo piano non deve far scattare niente). `RICHIESTA_APPESA_MS` è da
  // quanto una richiesta può restare in volo prima di essere dichiarata persa
  // — il doppio della corsa intera, più un margine: oltre quel punto non sta
  // arrivando nulla, sta solo tenendo chiusa la porta a tutte le altre.
  const BATTITO_FERMO_MS = BATTITO_MS * 4;
  const RICHIESTA_APPESA_MS = CORSA_ATTESA_MS * 2 + 10000;
  const PREVISIONE_MINUTI = 5;
  // --- L'arco di transito ---------------------------------------------
  // Cinque minuti erano la previsione **disegnata**, e sono diventati anche
  // il limite di quella **calcolata** senza che nessuno lo decidesse. Ma un
  // aereo in crociera a undici chilometri sta sopra l'orizzonte geometrico
  // fino a trecentosettanta chilometri di distanza: a duecentocinquanta
  // metri al secondo il suo arco in cielo dura **venticinque minuti**, non
  // cinque, e chi vuole sapere se passerà davanti alla Luna ha bisogno di
  // tutto l'arco (il conto vero lo fa `transiti.js`, che da qui prende solo
  // la rotta).
  //
  // Il tetto però c'è, e non è una comodità: è il punto oltre il quale la
  // riga smette di essere una previsione. Un grado di scarto di rotta — una
  // virata appena accennata, cioè il minimo che un aereo faccia — su
  // venticinque minuti sposta la posizione di **sei chilometri e mezzo**.
  // Disegnare l'arco fin lì è onesto solo perché la riga si assottiglia e
  // sbiadisce mano a mano (§7): quello che si vede è la fiducia che cala,
  // non una rotta che si conosce.
  const AEREI_ARCO_MAX_MIN = 25;
  // Il primo minuto si campiona ogni dieci secondi. Non è un vezzo: un aereo
  // che passa sopra la testa a due chilometri attraversa il cielo a tre gradi
  // al secondo, cioè quasi duecento gradi in un minuto — e una riga tirata
  // fra il campione di adesso e quello di fra un minuto sarebbe una corda
  // che taglia il cielo da parte a parte, invece dell'arco che l'aereo
  // percorre davvero.
  const AEREI_ARCO_PASSO_FINE_S = 10;
  const AEREI_ARCO_FINE_S = 60;
  // L'apertura alare che si dà a un aereo di cui non si sa il modello:
  // l'ADS-B porta una posizione, non una fusoliera. Quaranta metri sono un
  // corto-medio raggio, ed è lo stesso numero che usa `transiti.js` — il
  // valore non entra nell'istante di un transito, entra solo in quanto
  // grande lo si disegna quando è vicino.
  const AEREI_APERTURA_M = 40;

  // --- Muoversi non è cambiare cielo ----------------------------------
  // Le tre misure che rendono questo modulo sopportabile in macchina. Il
  // discorso per esteso sta in §6-bis; qui bastano i numeri.
  //
  // La **tolleranza** è quanto ci si può allontanare dal punto in cui la
  // fotografia è stata chiesta prima che il suo riquadro conti come rimasto
  // indietro. È una frazione del raggio di ricerca perché è di quello che si
  // sta parlando: un chilometro dentro a cinquanta non sposta niente, lo
  // stesso chilometro dentro a dieci è un decimo della scena.
  const AEREI_CENTRO_QUOTA = 0.2;
  const AEREI_CENTRO_MIN_KM = 1.5;
  const AEREI_CENTRO_MAX_KM = 12;
  // Il **salto**: oltre questo, non ci si è spostati, si è altrove — un'altra
  // città scelta nel pannello Tempo e luogo. Lì la fotografia va buttata
  // davvero, perché parla di un cielo che non è più quello.
  const AEREI_SALTO_MIN_KM = 25;
  // Il **passo minimo** fra due scarichi chiesti dallo spostamento. In
  // macchina «adesso» vuol dire ogni pochi secondi, ed è la raffica che i
  // servizi pubblici rifiutano con un 429: si aspetta, e intanto si disegna
  // quello che si ha.
  const AEREI_MOTO_MIN_MS = 30000;
  // Quanto si tiene un aereo che il feed non ha riconfermato. Le reti ADS-B
  // sono fatte di riceventi volontari: una fotografia può avere un buco che
  // la successiva non ha, e buttare a ogni giro quello che non è stato
  // ripetuto vuol dire vedere gli aerei lampeggiare. Due minuti sono molto
  // meno dei trenta che questo modulo già propaga quando una richiesta
  // fallisce del tutto.
  const AEREI_MEMORIA_MS = 120000;
  // --- L'età di ogni aereo (§3-quinquies) ------------------------------
  // Tre gradini, misurati dall'istante della **lettura** e non da quello
  // della richiesta: una rete può consegnare adesso una posizione di venti
  // secondi fa. Fino a `AEREI_VIVO_MS` è un dato vivo; fino a
  // `AEREI_INTERPOLATO_MS` è ancora buono, portato avanti dalla rotta; oltre
  // è stantio e si disegna velato, finché `etaMassimaMs()` non lo toglie.
  // L'interpolazione serve a far scorrere il disegno, non a inventare: un
  // aereo che nessuna fonte riconferma da due minuti non si propaga più.
  const AEREI_VIVO_MS = 20000;
  const AEREI_INTERPOLATO_MS = 60000;
  // --- La fusione e il sospetto (§3-ter e §3-quater) -------------------
  // Quanto aspettare, dopo la prima porta che ha risposto, le altre già in
  // volo: le loro letture si **fondono** con la prima invece di buttarle. Non
  // se ne lancia nessuna in più per questo — si raccoglie solo quello che era
  // già stato chiesto.
  const FUSIONE_ATTESA_MS = 1500;
  // Uno zero è sospetto quando poco prima, nello stesso posto, di aerei ce
  // n'erano almeno tanti: in quel caso non chiude la corsa, e la porta dopo
  // ha la sua occasione di smentirlo.
  const VUOTO_SOSPETTO_MIN = 3;
  const VUOTO_SOSPETTO_FINESTRA_MS = 300000;
  // La memoria delle risposte, per porta e per riquadro: due domande uguali a
  // pochi secondi di distanza — un raggio ritoccato, un tasto premuto due
  // volte — ricevono la stessa fotografia senza bussare di nuovo.
  const CACHE_RISPOSTA_MS = 6000;
  // Una porta **diretta** (senza ponte) che il browser rifiuta non è in
  // difficoltà: è senza CORS, e lo sarà anche fra dieci minuti. La si prova
  // di rado, e la riga rossa in console compare al più due volte al giorno.
  const PENALE_BLOCCATA_MS = 12 * 3600000;
  // OpenSky anonimo concede quattrocento richieste al giorno per indirizzo:
  // è una riserva, non un feed da interrogare a ogni giro.
  const OPENSKY_INTERVALLO_MIN_MS = 90000;
  // Fin dove il punto vivo di `terreno.js` può scostarsi dalla posizione
  // dell'app prima di non parlare più dello stesso posto.
  const AEREI_VIVO_MAX_KM = 3;
  // Quanto deve essere lunga la traiettoria **sullo schermo** perche' le tacche
  // dei minuti si distinguano. A campo largo un aereo lontano percorre pochi
  // pixel in cinque minuti, e sei pallini appiccicati non sono una previsione:
  // sono un tratto piu' spesso, cioe' un dettaglio che sporca senza dire
  // niente. La soglia del numero e' piu' alta perche' una scritta occupa molto
  // piu' spazio di un pallino.
  const AEREI_TACCHE_PX_MIN = 34;
  const AEREI_ETICHETTA_PX_MIN = 70;
  const SOGLIA_TEMPO_REALE_MS = 30000;
  const SOGLIA_ALLINEAMENTO = 1;
  const TERRA_KM = 6371;
  const TRACCIA_MASSIMO_PUNTI = 120;
  const TRACCIA_DURATA_MS = 2 * 60 * 60 * 1000;
  const CHIAVE_AEREI = 'astrocalendario_aerei';
  const CHIAVE_SALUTE = 'astrocalendario_adsb_salute';
  const hitEtichette = [];

  // --- Le fasce di distanza -------------------------------------------
  // Un cielo pieno di triangoli arancioni tutti uguali risponde a «ci sono
  // degli aerei» e non a **quale mi passa sopra la testa**, che è la sola
  // domanda che uno si fa guardando in su. La distanza però è già scritta
  // nell'etichetta, e un numero da leggere non è un colpo d'occhio: qui
  // diventa colore, con la scala che tutti sanno leggere senza legenda —
  // rosso addosso, poi arancio, giallo, e azzurro per quello che è lontano.
  // Le soglie sono in chilometri **al suolo**, la stessa `distanzaKm` che
  // filtra il raggio di ricerca.
  const FASCE_DISTANZA = [
    { max: 10, nome: 'entro 10 km', colore: '#f87171', forte: '#ef4444', scuro: '#450a0a' },
    { max: 20, nome: '10–20 km', colore: '#fb923c', forte: '#f97316', scuro: '#431407' },
    { max: 50, nome: '20–50 km', colore: '#facc15', forte: '#eab308', scuro: '#422006' },
    { max: Infinity, nome: 'oltre 50 km', colore: '#7dd3fc', forte: '#38bdf8', scuro: '#082f49' }
  ];

  function fasciaDi(km) {
    const d = Number.isFinite(km) ? km : Infinity;
    return FASCE_DISTANZA.find(f => d <= f.max) || FASCE_DISTANZA[FASCE_DISTANZA.length - 1];
  }

  function numero(valore) {
    // `null` e la stringa vuota vanno respinti **prima** di `Number()`, che
    // per tutti e due risponde **zero**: un valore finito, che passa il
    // controllo e si porta via il ripiego di chi scrive
    // `numero(a.alt_baro) ?? numero(a.alt_geom)`. Un feed che scrive
    // `alt_baro: null` invece di ometterlo metterebbe cosi' ogni aereo a
    // quota zero — cioe' sull'orizzonte, disegnati fra le case.
    if (valore === null || valore === undefined || valore === '') return null;
    const n = Number(valore);
    return Number.isFinite(n) ? n : null;
  }

  // =====================================================================
  // 1. GLI INTERPRETI — e il sospetto che li tiene onesti
  //    Un ponte CORS in difficoltà non risponde con un errore: risponde 200
  //    con dentro una pagina HTML, o un JSON che parla di sé stesso. Il
  //    vecchio `(risposta.ac || [])` lo leggeva come «zero aerei», e zero
  //    aerei è una risposta *plausibile*: nessuno se ne accorgeva, la corsa
  //    si fermava lì e il cielo restava vuoto con la spia verde. È
  //    esattamente il difetto per cui i dati «a volte si caricano e a volte
  //    no». Adesso ogni interprete pretende di riconoscere lo schema, e se
  //    non lo riconosce solleva: la corsa passa alla porta successiva.
  // =====================================================================

  function schemaSconosciuto(nome) {
    const e = new Error(`risposta non riconosciuta (${nome})`);
    e.schema = true;
    return e;
  }

  function interpretaAdsbExchange(risposta) {
    // I mirror readsb usano normalmente `ac`; alcuni rilasciano lo stesso
    // elenco come `aircraft`. Accettare entrambi evita falsi "zero aerei" —
    // ma pretendere che almeno uno dei due sia un array evita il falso
    // opposto, che è molto peggio: una pagina di errore letta come cielo
    // sgombro.
    const elenco = Array.isArray(risposta && risposta.ac) ? risposta.ac
      : Array.isArray(risposta && risposta.aircraft) ? risposta.aircraft : null;
    if (!elenco) throw schemaSconosciuto('ADS-B');
    return elenco.map(a => {
      const quotaPiedi = numero(a.alt_baro) ?? numero(a.alt_geom);
      // `seen_pos` è l'età della **posizione**, `seen` quella dell'ultimo
      // messaggio qualunque (può essere uno squawk arrivato un attimo fa su
      // una posizione di trenta secondi prima). Per disegnare conta la prima.
      const vistoSecondiFa = numero(a.seen_pos) ?? numero(a.seen);
      return {
        id: a.hex, callsign: (a.flight || '').trim() || String(a.hex || '').toUpperCase(),
        registrazione: a.r || '', tipoIcao: a.t || '', descrizione: a.desc || '',
        operatore: a.ownOp || '', squawk: a.squawk || '',
        lon: numero(a.lon), lat: numero(a.lat),
        quotaM: quotaPiedi === null ? null : quotaPiedi * 0.3048,
        aTerra: a.alt_baro === 'ground',
        velocitaMs: numero(a.gs) === null ? null : numero(a.gs) * 0.514444,
        direzione: numero(a.track), salitaMs: (numero(a.baro_rate) || 0) * 0.00508,
        ultimaLettura: Math.floor(Date.now() / 1000 - (vistoSecondiFa || 0))
      };
    }).filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lon));
  }

  function interpretaOpenSky(risposta) {
    // https://openskynetwork.github.io/opensky-api/rest.html#response
    // Lo schema è un array posizionale; `geo_altitude` (13) è preferibile a
    // `baro_altitude` (7) per disegnare l'altezza geometrica nel cielo.
    // `states` vale legittimamente `null` quando non c'è nessuno in volo nel
    // riquadro, quindi qui il segno di riconoscimento è la **chiave**, non il
    // suo contenuto.
    if (!risposta || typeof risposta !== 'object' || !('states' in risposta)) {
      throw schemaSconosciuto('OpenSky');
    }
    return (risposta.states || []).map(a => ({
      id: a[0], callsign: String(a[1] || '').trim() || String(a[0] || '').toUpperCase(),
      registrazione: '', tipoIcao: '', descrizione: '', operatore: '', squawk: String(a[14] || ''),
      lon: numero(a[5]), lat: numero(a[6]), quotaM: numero(a[13]) ?? numero(a[7]),
      aTerra: !!a[8], velocitaMs: numero(a[9]), direzione: numero(a[10]),
      salitaMs: numero(a[11]), ultimaLettura: numero(a[4]) ?? numero(a[3])
    })).filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lon));
  }

  // --- Il record normalizzato -------------------------------------------
  // Qualunque sia la porta, al resto dell'app arriva **una forma sola**, in
  // unità sole: metri, metri al secondo, gradi, secondi Unix. È il contratto
  // che rende invisibile il cambio di fonte — il planetario non sa, e non
  // deve sapere, se un aereo viene da OpenSky o da un ponte. I nomi sono
  // quelli che il resto dell'app legge da sempre (e in italiano, come tutto
  // il codice); la corrispondenza col record «da manuale» è questa:
  //
  //   icao24 → id            callsign → callsign     registration → registrazione
  //   lat/lon → lat/lon      altitude → quotaM        groundSpeed  → velocitaMs
  //   verticalRate → salitaMs track → direzione      squawk → squawk
  //   onGround → aTerra      timestamp → ultimaLettura (s)
  //   source → fonte         sources → fonti          quality → qualita/etaMs
  //
  // Qui si fa anche la pulizia che un interprete da solo non può fare:
  // coordinate fuori scala, istanti nel futuro (un orologio di server avanti
  // di un minuto farebbe «tornare indietro» l'aereo a ogni propagazione) e
  // identificativi scritti in maiuscolo da una porta e in minuscolo
  // dall'altra, che senza questa riga diventerebbero due icone per un aereo.
  function normalizzaLettura(r, fonte, oraMs = Date.now()) {
    if (!r || !Number.isFinite(r.lat) || !Number.isFinite(r.lon)) return null;
    if (Math.abs(r.lat) > 90 || Math.abs(r.lon) > 180) return null;
    const id = String(r.id || '').trim().toLowerCase();
    const callsign = String(r.callsign || '').trim();
    const registrazione = String(r.registrazione || '').trim().toUpperCase();
    // Senza nessun identificativo un punto non si può né seguire né fondere:
    // due letture dello stesso aereo diventerebbero due aerei.
    if (!id && !registrazione && !callsign) return null;
    const oraS = oraMs / 1000;
    let letto = Number.isFinite(r.ultimaLettura) ? r.ultimaLettura : oraS;
    if (letto > oraS) letto = oraS;
    const finito = v => Number.isFinite(v) ? v : null;
    return {
      ...r,
      id: id || (registrazione ? 'reg:' + registrazione.toLowerCase() : 'vol:' + callsign.toLowerCase()),
      callsign: callsign || (id ? id.toUpperCase() : registrazione),
      registrazione,
      quotaM: finito(r.quotaM), velocitaMs: finito(r.velocitaMs),
      direzione: Number.isFinite(r.direzione) ? ((r.direzione % 360) + 360) % 360 : null,
      salitaMs: finito(r.salitaMs) ?? 0,
      aTerra: !!r.aTerra, squawk: String(r.squawk || ''),
      ultimaLettura: letto, fonte, fonti: [fonte]
    };
  }

  function radianti(g) { return g * Math.PI / 180; }
  function gradi(r) { return r * 180 / Math.PI; }
  function limita180(g) { return ((g + 540) % 360) - 180; }

  function urlOpenSky(posizione, raggioKm) {
    // Il riquadro circoscritto evita la costosissima richiesta mondiale. La
    // correzione del coseno mantiene il raggio giusto anche alle alte latitudini;
    // il filtro circolare esatto resta comunque in arricchisci().
    const dLat = raggioKm / 111.32;
    const dLon = raggioKm / (111.32 * Math.max(.08, Math.cos(radianti(posizione.lat))));
    const q = new URLSearchParams({
      lamin: (posizione.lat - dLat).toFixed(4), lamax: (posizione.lat + dLat).toFixed(4),
      lomin: (posizione.lon - dLon).toFixed(4), lomax: (posizione.lon + dLon).toFixed(4)
    });
    return `https://opensky-network.org/api/states/all?${q}`;
  }

  function urlAdsbExchange(host, posizione, raggioKm) {
    // Questi endpoint esprimono il raggio in miglia nautiche. Arrotondare in
    // alto evita di perdere gli aerei sul bordo; arricchisci() applica poi il
    // raggio esatto in chilometri.
    const migliaNautiche = Math.max(1, Math.min(250, Math.ceil(raggioKm / 1.852)));
    return `https://${host}/v2/point/${posizione.lat.toFixed(4)}/${posizione.lon.toFixed(4)}/${migliaNautiche}`;
  }

  function urlAdsbFi(posizione, raggioKm) {
    const migliaNautiche = Math.max(1, Math.min(250, Math.ceil(raggioKm / 1.852)));
    return `https://opendata.adsb.fi/api/v2/lat/${posizione.lat.toFixed(4)}` +
      `/lon/${posizione.lon.toFixed(4)}/dist/${migliaNautiche}`;
  }

  function providerDiretto(nome, urlFeed, interpreta = interpretaAdsbExchange) {
    return { nome, rete: nome, url: urlFeed, interpreta };
  }

  const feedAirplanesLive = (posizione, raggioKm) =>
    urlAdsbExchange('api.airplanes.live', posizione, raggioKm);
  const feedAdsbLol = (posizione, raggioKm) =>
    urlAdsbExchange('api.adsb.lol', posizione, raggioKm);
  const feedAdsbOne = (posizione, raggioKm) =>
    urlAdsbExchange('api.adsb.one', posizione, raggioKm);

  // Non affidare il percorso normale a un proxy CORS pubblico: quei servizi
  // oggi chiedono autenticazione o scadono con 401/408. Le reti dirette sono
  // **quattro** e non una, e non è ridondanza
  // decorativa: la sera in cui adsb.fi era in manutenzione, con una porta
  // sola il modulo non aveva niente da dire. Un eventuale proxy proprio può
  // sempre essere fornito con window.AEREI_PROVIDER o con ADSB_PROXY_URL.
  const providersPredefiniti = [
    providerDiretto('ADSB.fi', urlAdsbFi),
    providerDiretto('adsb.lol', feedAdsbLol),
    providerDiretto('Airplanes.live', feedAirplanesLive),
    providerDiretto('adsb.one', feedAdsbOne)
  ];

  // OpenSky Network, **dal browser e senza credenziali**. È l'unica rete con
  // un'API ufficiale pensata per essere chiamata da fuori, e per questo può
  // stare qui senza ponte. Tre regole ne fanno una riserva e non un feed:
  //
  //   - è **in coda** (`riserva`): entra nella corsa dopo il proxy e i ponti,
  //     cioè quando hanno già taciuto o detto di no;
  //   - ha un **passo minimo** (`intervalloMinMs`): l'accesso anonimo vale
  //     quattrocento richieste al giorno per indirizzo, e chiamarla a ogni
  //     giro le consumerebbe in tre ore;
  //   - è **diretta**: se il browser la rifiuta (niente CORS da questa
  //     origine, un filtro anti-tracciamento) il rifiuto non passa col tempo,
  //     e la pagella la mette da parte per mezza giornata invece di
  //     riprovarla a ogni penale (`PENALE_BLOCCATA_MS`).
  //
  // Con le credenziali, OpenSky sta invece dentro al Worker del sito
  // (`worker-adsb.js`): una credenziale non va mai nel browser di chi apre il
  // sito.
  function providerOpenSky() {
    return {
      nome: 'OpenSky', rete: 'OpenSky Network', url: urlOpenSky, interpreta: interpretaOpenSky,
      riserva: true, diretto: true, intervalloMinMs: OPENSKY_INTERVALLO_MIN_MS, attesaMs: 10000
    };
  }

  function urlProxy() {
    return String((typeof window !== 'undefined' && window.ADSB_PROXY_URL) || '').trim().replace(/\/$/, '');
  }

  // =====================================================================
  //  I PONTI CORS PUBBLICI — la strada che non chiede di installare niente
  //
  //  Il fatto da cui parte tutto, misurato dall'origine del sito pubblicato:
  //  **nessuna delle quattro reti manda `Access-Control-Allow-Origin`**. Gli
  //  endpoint sono vivi (aperti in una scheda restituiscono i dati) ma il
  //  browser rifiuta la risposta prima di consegnarla al codice. Non e' un
  //  guasto e non e' intermittente: da un browser quelle reti non si leggono
  //  mai, e nessun trucco lato client lo aggira — e' il browser che decide.
  //
  //  Restano due strade, e non si escludono. Un **proxy proprio** (vedi
  //  `ADSB-PROXY.md`) e' la piu' solida: risponde sempre, con i limiti che
  //  decidi tu. Ma va distribuito, e chi vuole solo aprire il sito non ha
  //  voglia di distribuire niente. Per lui ci sono questi **ponti pubblici**:
  //  servizi che qualcun altro tiene su, che prendono un indirizzo, lo vanno
  //  a leggere dal loro server e rimandano indietro la risposta col CORS
  //  aperto. Zero configurazione.
  //
  //  Il prezzo, ed e' giusto saperlo: sono di terzi, hanno limiti loro e
  //  possono sparire senza avvisare — e sparire e' proprio quello che hanno
  //  fatto tutti insieme, il giorno in cui `corsproxy.io` ha cominciato a
  //  chiedere una chiave (401) e gli altri due rispondevano senza
  //  intestazione CORS. Per questo sono **piu' di uno**, per questo nessuna
  //  rete dipende da un ponte solo, e per questo stanno dietro al proxy
  //  proprio quando c'e'. La pagella (§2) fa il resto: misura quale
  //  combinazione funziona da qui e il giro dopo comincia da quella.
  //
  //  E per questo, soprattutto, un sito che vuole gli aerei **sempre**
  //  configura `ADSB_PROXY_URL`: questi ponti sono il modo di funzionare
  //  senza aver distribuito niente, non una garanzia.
  //
  //  Perche' proprio ADSB.fi e adsb.lol: sono le due che, interrogate **da un
  //  server**, hanno risposto 200 con i dati (22 e 21 aerei). Airplanes.live e
  //  adsb.one rispondono 403 anche da li' — servirebbe il loro permesso, che
  //  si chiede scrivendo a contact@airplanes.live.
  // =====================================================================

  // `corsproxy.io` **e' uscito da questo elenco**, e vale la pena scrivere
  // perche': non taceva e non sbagliava ogni tanto, rispondeva **401** a ogni
  // richiesta. Da quando chiede una chiave e un'origine registrata, per un
  // sito che non ne ha e' un no definitivo — non un guasto che passa. La
  // pagella (§2) lo mandava dovutamente in fondo alla corsa, ma un posto in
  // corsa lo occupava lo stesso, e un ripiego che non puo' riuscire mai non
  // e' un ripiego: e' un ritardo. Le due porte rimaste bastano a tenere in
  // piedi la regola che conta, cioe' che nessuna rete dipenda da un ponte
  // solo.
  const PONTI_CORS = [
    { nome: 'allorigins', avvolgi: u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
    { nome: 'codetabs', avvolgi: u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` }
  ];

  // Ogni rete passa da tutt'e due i ponti, e i primi due tentativi usano
  // ponti diversi: se un ponte cade, non porta giu' con se' anche l'unica
  // rete che stava servendo.
  const ABBINAMENTI = [
    { ponte: PONTI_CORS[0], rete: 'ADSB.fi', feed: urlAdsbFi },
    { ponte: PONTI_CORS[1], rete: 'adsb.lol', feed: feedAdsbLol },
    { ponte: PONTI_CORS[1], rete: 'ADSB.fi', feed: urlAdsbFi },
    { ponte: PONTI_CORS[0], rete: 'adsb.lol', feed: feedAdsbLol }
  ];

  function providersPonte() {
    return ABBINAMENTI.map(a => ({
      nome: `${a.rete} via ${a.ponte.nome}`,
      rete: `${a.rete} (ponte ${a.ponte.nome})`,
      fonte: a.rete,
      // L'anti-cache va messo **dentro**, sul feed, prima di avvolgerlo: un
      // ponte tiene la sua copia con la chiave dell'indirizzo che gli si
      // chiede di andare a leggere, quindi variare solo l'involucro lo
      // lascerebbe servire la stessa fotografia di prima. Quello fuori ce lo
      // mette `scarica`, e i due non si pestano i piedi: il primo finisce
      // percent-codificato dentro al valore di `url=`, il secondo è un
      // parametro dell'involucro.
      url: (posizione, raggioKm) => a.ponte.avvolgi(conAntiCache(a.feed(posizione, raggioKm))),
      // L'interprete e' quello di sempre, e la sua severita' e' quello che
      // rende sicuri i ponti: un servizio in difficolta' risponde 200 con
      // dentro una pagina d'errore, e `interpretaAdsbExchange` **solleva**
      // invece di leggerla come «zero aerei». Senza quella severita' un ponte
      // rotto sarebbe indistinguibile da un cielo sgombro.
      interpreta: interpretaAdsbExchange,
      // Un ponte fa due salti invece di uno: chiede tempo.
      attesaMs: 12000
    }));
  }

  // Detto una volta sola, e detto forte. Le quattro reti dirette producono
  // quattro rifiuti CORS di fila, che nella console sembrano un guasto
  // dell'app e non lo sono. Il muro di righe rosse ha gia' fatto perdere un
  // pomeriggio a chi credeva di avere un problema di codice.
  let dettoDelProxy = false;
  function avvisaSeManca() {
    if (dettoDelProxy || urlProxy()) return;
    dettoDelProxy = true;
    console.info('[aerei] Uso i ponti CORS di riserva. Per configurare un proxy proprio: ADSB-PROXY.md.');
  }

  function providerProxy(proxy) {
    return {
      nome: 'proxy ADS-B del sito',
      rete: 'proxy del sito',
      // Piu' lunga della sveglia di una rete diretta, e piu' lunga di quella
      // che il Worker si da' per la sua corsa interna: chi aspetta deve
      // aspettare piu' di chi lavora, se no si perde la risposta proprio
      // quando stava per arrivare.
      attesaMs: 14000,
      url(posizione, raggioKm) {
        const q = new URLSearchParams({ lat: posizione.lat.toFixed(4), lon: posizione.lon.toFixed(4),
          dist: String(Math.max(1, Math.ceil(raggioKm / 1.852))) });
        return `${proxy}/api/adsb?${q}`;
      },
      interpreta: interpretaAdsbExchange
    };
  }

  function providersDisponibili(opzioni = {}) {
    avvisaSeManca();
    const proxy = urlProxy();
    const propri = proxy ? [providerProxy(proxy)] : [];
    const ponti = opzioni.senzaPonti ? [] : providersPonte();
    // I feed senza CORS si possono interrogare dal proxy, non dal browser.
    // Restano disponibili solo per prove esplicitamente abilitate.
    const diretti = window.ADSB_PROVA_DIRETTI === true ? providersPredefiniti : [];
    // OpenSky diretto si può spegnere (`ADSB_OPENSKY_DIRETTO = false`, per
    // esempio su un sito che lo interroga già dal proprio proxy con le
    // credenziali: due strade verso la stessa rete sono una quota spesa due
    // volte).
    const riserve = opzioni.senzaRiserve || window.ADSB_OPENSKY_DIRETTO === false ? [] : [providerOpenSky()];
    return propri.concat(ponti, diretti, riserve);
  }

  // Un aggiornamento chiesto esplicitamente non deve restare prigioniero
  // della pagella: se tutte le porte sono in penale, il vecchio codice dava
  // subito "servizi ADS-B in pausa" senza fare una sola richiesta. Il tap
  // dell'utente e' invece un segnale forte: si prova il proxy configurato
  // anche se era in cooldown, e solo in sua assenza si riapre la corsa
  // completa come ultimo tentativo. Il ciclo automatico continua invece a
  // rispettare le penali, cosi' non si trasforma un 429 in una raffica.
  //
  // Due regole in più rispetto alla pagella. Le **riserve** stanno sempre in
  // coda, anche quando hanno risposto per ultime: una porta con una quota
  // stretta che diventa la prima della corsa si consuma in un pomeriggio. E
  // una porta col suo **passo minimo** non ancora trascorso resta fuori dal
  // giro automatico — ma non da quello chiesto a mano, se non c'è altro.
  function providersPerRichiesta(forza, ora = Date.now()) {
    const tutti = providersDisponibili();
    const presto = p => Number.isFinite(p.intervalloMinMs) &&
      ora - (salute.get(p.nome)?.ultimaProva || 0) < p.intervalloMinMs;
    const ordinati = ordinaPerSalute(tutti, ora);
    const sani = ordinati.filter(p => !p.riserva && !presto(p))
      .concat(ordinati.filter(p => p.riserva && !presto(p)));
    if (sani.length) return sani;
    if (!forza) return ordinati.filter(p => !presto(p));
    if (ordinati.length) return ordinati;
    const proxy = urlProxy();
    if (proxy) return [providerProxy(proxy)];
    return tutti;
  }

  // =====================================================================
  // 2. LA PAGELLA DELLE PORTE
  //    Quale feed funziona *qui* non lo sa nessuno prima di provarlo: dipende
  //    dal paese, dal fornitore di rete, dai filtri anti-tracciamento del
  //    browser. Ricominciando ogni volta dal primo dell'elenco si ripaga ogni
  //    volta lo stesso scotto — la porta chiusa da ieri sta ancora in cima.
  //    Qui ogni esito lascia un segno, il segno sopravvive alla sessione, e
  //    l'ordine del giro dopo esce da lì. Una porta che sbaglia viene
  //    saltata fino alla scadenza della penale; poi torna disponibile da sola.
  // =====================================================================

  const salute = new Map();

  function saluteDi(nome) {
    let v = salute.get(nome);
    if (!v) {
      v = { ok: 0, no: 0, noDiFila: 0, ultimoOk: 0, penaleFino: 0, ultimoGuaio: '',
        vuotiDiFila: 0, ultimaProva: 0, bloccata: false, ultimoMs: 0 };
      salute.set(nome, v);
    }
    return v;
  }

  // Il **circuito** di una porta, in tre stati — la forma classica del
  // circuit breaker, scritta con i numeri che la pagella tiene già:
  //   · `chiuso`: risponde, la si usa;
  //   · `aperto`: è in penale, non la si chiama affatto;
  //   · `semiaperto`: la penale è scaduta ma l'ultimo esito era un no — la si
  //     riprova, **in coda** alle sane, e il primo esito decide: un sì la
  //     richiude, un no la riapre con la penale raddoppiata.
  function statoCircuito(nome, ora = Date.now()) {
    const v = salute.get(nome);
    if (!v) return 'nuovo';
    if (v.penaleFino > ora) return v.bloccata ? 'bloccato' : 'aperto';
    return v.noDiFila > 0 || v.vuotiDiFila > 1 ? 'semiaperto' : 'chiuso';
  }

  function saluteCarica() {
    try {
      const grezzo = JSON.parse(localStorage.getItem(CHIAVE_SALUTE) || '{}');
      Object.keys(grezzo).forEach(nome => {
        const v = grezzo[nome];
        if (!v || typeof v !== 'object') return;
        salute.set(nome, {
          ok: Number(v.ok) || 0, no: Number(v.no) || 0, noDiFila: Number(v.noDiFila) || 0,
          ultimoOk: Number(v.ultimoOk) || 0, penaleFino: Number(v.penaleFino) || 0,
          ultimoGuaio: String(v.ultimoGuaio || ''),
          vuotiDiFila: Number(v.vuotiDiFila) || 0, ultimaProva: Number(v.ultimaProva) || 0,
          bloccata: v.bloccata === true, ultimoMs: Number(v.ultimoMs) || 0
        });
      });
    } catch (e) { /* senza memoria si riparte dall'ordine scritto */ }
  }

  function saluteSalva() {
    try {
      const grezzo = {};
      salute.forEach((v, nome) => { grezzo[nome] = v; });
      localStorage.setItem(CHIAVE_SALUTE, JSON.stringify(grezzo));
    } catch (e) { /* niente storage: la pagella vale per questa sessione */ }
  }

  // `riuscito` con `durataMs` accanto: quanto ci ha messo è la sola misura di
  // «lenta» che si possa mostrare senza inventarla.
  function segnaEsito(provider, riuscito, errore, durataMs) {
    const v = saluteDi(provider.nome);
    const ora = Date.now();
    if (riuscito) {
      v.ok++; v.noDiFila = 0; v.ultimoOk = ora; v.penaleFino = 0; v.ultimoGuaio = '';
      v.bloccata = false; v.vuotiDiFila = 0;
      if (Number.isFinite(durataMs)) v.ultimoMs = Math.round(durataMs);
    } else {
      v.no++; v.noDiFila++; v.ultimoGuaio = (errore && errore.message) || 'guasto';
      // Una porta diretta che il browser rifiuta senza nemmeno una risposta
      // (il `TypeError: Failed to fetch` di un CORS mancante) non migliora
      // aspettando dieci minuti: la si rimette in gioco fra mezza giornata.
      // Con la rete giù il guasto non arriva qui (`carica` non bussa affatto
      // quando il browser dice di essere offline).
      if (provider.diretto && errore && errore.name === 'TypeError') {
        v.bloccata = true;
        v.penaleFino = ora + PENALE_BLOCCATA_MS;
        saluteSalva();
        return;
      }
      // La penale raddoppia a ogni no di fila e si ferma a dieci minuti: una
      // porta rotta smette in fretta di costare tempo, ma torna in gioco da
      // sola senza che nessuno debba ricordarsi di riabilitarla.
      let penale = Math.min(PENALE_MAX_MS, 20000 * Math.pow(2, Math.min(5, v.noDiFila - 1)));
      // Con una sola eccezione, ed è l'unica volta in cui questa pagella non
      // sta stimando: quando la porta ha detto lei **fra quanto** tornare. Lì
      // il tetto dei dieci minuti non si applica — non è una nostra
      // precauzione da limitare, è un'istruzione di chi risponde, e bussare
      // prima vuol dire prendersi lo stesso no e raddoppiare di nuovo. Il
      // massimo fra i due, perché un `Retry-After` di due secondi non deve
      // accorciare una penale che la porta si era già guadagnata sbagliando
      // cinque volte di fila.
      if (errore && Number.isFinite(errore.riprovaFraMs)) {
        penale = Math.max(penale, Math.min(RETRY_AFTER_MAX_MS, errore.riprovaFraMs));
      }
      v.penaleFino = ora + penale;
    }
    saluteSalva();
  }

  // Uno zero sospetto (§3-ter). Non è un guasto, e il primo non costa
  // niente: può essere un cielo davvero sgombro, o un buco della rete di
  // riceventi. Il secondo **di fila**, mentre un'altra porta nello stesso
  // posto vedeva aerei, è la firma di una porta che risponde senza guardare
  // — e allora le si dà una penale corta, che raddoppia come le altre.
  function segnaVuoto(provider) {
    const v = saluteDi(provider.nome);
    v.vuotiDiFila++;
    if (v.vuotiDiFila >= 2) {
      v.penaleFino = Date.now() + Math.min(PENALE_MAX_MS, 60000 * Math.pow(2, Math.min(4, v.vuotiDiFila - 2)));
      v.ultimoGuaio = 'risposte vuote ripetute';
    }
    saluteSalva();
  }

  // Prima chi ha risposto più di recente; nessuna richiesta alle porte
  // ancora in pausa. Alla scadenza tornano automaticamente nell'elenco, ma
  // **in coda** a quelle sane finché non hanno risposto di nuovo: è la metà
  // «semiaperta» del circuito, che la riprova senza rimetterle davanti.
  function ordinaPerSalute(providers, ora = Date.now()) {
    return providers.filter(p => !(salute.get(p.nome)?.penaleFino > ora))
      .map((p, indice) => {
        const v = salute.get(p.nome);
        return { p, indice, ultimoOk: v?.ultimoOk || 0,
          dubbia: v ? (v.noDiFila > 0 || v.vuotiDiFila > 1) : false };
      })
      .sort((a, b) => (a.dubbia - b.dubbia) || b.ultimoOk - a.ultimoOk || a.indice - b.indice)
      .map(v => v.p);
  }

  // =====================================================================
  // 3. IL TRASPORTO
  //    Una richiesta a una porta: l'indirizzo senza cache, il codice HTTP
  //    letto per quello che dice (429 e 503 sono «rallenta», non «guasto»),
  //    il JSON letto a mano, l'interprete severo e — per ultima — la
  //    normalizzazione. Sopra a lei stanno la memoria delle risposte
  //    (§3-bis), la fusione (§3-ter) e la corsa (§3-quater).
  // =====================================================================

  function errNome(nome, messaggio) {
    const e = new Error(messaggio); e.name = nome; return e;
  }

  function annullata() { return errNome('AbortError', 'richiesta annullata'); }

  // Quale guasto raccontare quando falliscono tutti: l'ultimo arrivato non è
  // il più informativo — quasi sempre è la nostra stessa sveglia — mentre un
  // 429 o un 503 il servizio l'ha risposto davvero, quindi la strada c'era.
  function peggiore(errori) {
    if (!errori.length) return new Error('nessun servizio disponibile');
    const peso = e => e.schema ? 4 : e.stato ? 3 : e.rateLimit ? 3 :
      (e.name === 'TimeoutError' || e.name === 'AbortError') ? 1 : 2;
    return errori.slice().sort((a, b) => peso(b) - peso(a))[0];
  }

  // Il parametro che tiene la fotografia fuori da tutte le cache — e perché
  // è un parametro e **non** un'intestazione.
  //
  // `cache: 'no-store'` sulla fetch, qui sotto, copre la cache del browser ed
  // è la strada giusta per quella. Quello che non copre è tutto il resto
  // della catena: il Worker del sito, che la sua fotografia la dichiara
  // riusabile per venti secondi (`Cache-Control: public, max-age=20` in
  // `worker-adsb.js`), la rete di distribuzione che gli sta davanti, e
  // soprattutto i **ponti CORS pubblici**, che di mestiere fanno proprio i
  // grossisti di risposte altrui e tengono la loro copia con regole che non
  // sono nostre. Una fotografia servita da lì è un cielo che non si aggiorna
  // più — il primo scarico arriva, i successivi sono la sua fotocopia, e
  // sullo schermo non si distingue da un traffico fermo.
  //
  // E si fa così, non con un `Cache-Control: no-cache` fra gli header della
  // richiesta. Vale la pena scriverlo perché è la correzione «ovvia», quella
  // che prima o poi qualcuno proverà a fare: quell'intestazione, su una
  // richiesta cross-origin, non è fra le poche semplici che passano lisce —
  // obbliga il browser al preflight, cioè a una `OPTIONS` che **nessuna** di
  // queste porte risponde, né le quattro reti di comunità né i due ponti. Il
  // risultato non sarebbe una cache aggirata: sarebbe ogni richiesta
  // rifiutata prima ancora di partire, cioè il difetto di adesso peggiorato
  // fino a diventare totale.
  function conAntiCache(url, token = Date.now()) {
    const u = String(url);
    // Il frammento, se c'è, resta in coda: `?_=` infilato dopo il `#` non è
    // una query, è testo dentro all'ancora, e non lo legge nessuno.
    const taglio = u.indexOf('#');
    const corpo = taglio === -1 ? u : u.slice(0, taglio);
    const frammento = taglio === -1 ? '' : u.slice(taglio);
    return corpo + (corpo.indexOf('?') === -1 ? '?' : '&') + '_=' + token + frammento;
  }

  // `Retry-After` arriva in due forme, e la seconda è una data HTTP: leggerla
  // con `Number()` dà `NaN`, cioè «nessuna indicazione» proprio quando
  // un'indicazione c'era. Da sapere, ed è un limite onesto e non un difetto:
  // su una risposta cross-origin questa intestazione si legge solo se il
  // server la dichiara in `Access-Control-Expose-Headers`. Il Worker del
  // progetto lo fa; i ponti pubblici no, e lì si torna alla scala delle
  // riprove — che è il motivo per cui la scala resta e il `Retry-After` la
  // corregge invece di sostituirla.
  function attesaRichiesta(risposta) {
    let grezzo = '';
    // OpenSky dice la stessa cosa con un nome suo, sempre in secondi.
    try {
      grezzo = (risposta.headers && (risposta.headers.get('Retry-After') ||
        risposta.headers.get('X-Rate-Limit-Retry-After-Seconds'))) || '';
    }
    catch (e) { return null; }
    if (!grezzo) return null;
    const secondi = Number(String(grezzo).trim());
    const ms = Number.isFinite(secondi) ? secondi * 1000 : Date.parse(grezzo) - Date.now();
    if (!Number.isFinite(ms)) return null;
    // Un `Retry-After` già scaduto — o una data nel passato — non deve
    // diventare un numero negativo che scavalca la scala delle riprove
    // facendo ripartire *prima* del dovuto.
    return Math.max(0, Math.min(RETRY_AFTER_MAX_MS, ms));
  }

  // =====================================================================
  // 3-bis. LA MEMORIA DELLE RISPOSTE E LE RICHIESTE GEMELLE
  //    Due domande uguali — stessa porta, stesso riquadro — a pochi secondi
  //    di distanza non bussano due volte: la seconda riceve la fotografia
  //    della prima (`CACHE_RISPOSTA_MS`). E due domande uguali **nello stesso
  //    istante** diventano una richiesta sola con due attese sopra: chi
  //    rinuncia (il suo segnale si abortisce) se ne va, e la richiesta vera
  //    si interrompe solo quando non l'aspetta più nessuno. È quello che
  //    tiene lontane le raffiche quando più parti dell'app — il battito, il
  //    raggio ritoccato, il tasto «Aggiorna adesso», il ritorno da un'altra
  //    app — chiedono la stessa cosa nello stesso giro.
  // =====================================================================

  const cacheRisposte = new Map();
  const inVoloRisposte = new Map();
  // Cosa ha detto il proxy del sito su **quale** fonte gli ha risposto
  // (`X-ADSB-Fonte`): è il solo modo, da qui, di sapere se dietro a
  // quell'indirizzo ha parlato OpenSky o una rete di comunità.
  const dettagliFonte = new Map();

  function chiaveRichiesta(provider, obs, raggio) {
    return `${provider.nome}|${obs.lat.toFixed(3)}|${obs.lon.toFixed(3)}|${Math.round(raggio)}`;
  }

  function potaCacheRisposte(ora = Date.now()) {
    cacheRisposte.forEach((v, k) => { if (ora - v.quando > CACHE_RISPOSTA_MS * 4) cacheRisposte.delete(k); });
    while (cacheRisposte.size > 40) cacheRisposte.delete(cacheRisposte.keys().next().value);
  }

  function scarica(provider, obs, raggio, signal, opz = {}) {
    const chiave = chiaveRichiesta(provider, obs, raggio);
    const ora = Date.now();
    // La memoria la chiede chi la vuole (il ciclo di `carica`): una prova, o
    // un gesto esplicito dell'utente, deve bussare per davvero.
    if (opz.cache) {
      const c = cacheRisposte.get(chiave);
      if (c && ora - c.quando <= CACHE_RISPOSTA_MS) {
        if (signal && signal.aborted) return Promise.reject(annullata());
        return Promise.resolve(c.aerei.slice());
      }
    }
    let volo = inVoloRisposte.get(chiave);
    if (!volo) {
      const controller = new AbortController();
      volo = { controller, attesi: 0, promessa: null };
      volo.promessa = scaricaDavvero(provider, obs, raggio, controller.signal).then(aerei => {
        cacheRisposte.set(chiave, { quando: Date.now(), aerei });
        potaCacheRisposte();
        return aerei;
      });
      const questo = volo;
      volo.promessa.catch(() => {}).then(() => {
        if (inVoloRisposte.get(chiave) === questo) inVoloRisposte.delete(chiave);
      });
      inVoloRisposte.set(chiave, volo);
    }
    const suo = volo;
    suo.attesi++;
    return new Promise((risolvi, rifiuta) => {
      let fatto = false;
      const esci = () => {
        if (fatto) return false;
        fatto = true; suo.attesi--;
        if (signal) signal.removeEventListener('abort', lascia);
        return true;
      };
      function lascia() {
        if (!esci()) return;
        if (suo.attesi <= 0) suo.controller.abort();
        rifiuta(annullata());
      }
      if (signal) {
        if (signal.aborted) { lascia(); return; }
        signal.addEventListener('abort', lascia, { once: true });
      }
      suo.promessa.then(v => { if (esci()) risolvi(v.slice()); }, e => { if (esci()) rifiuta(e); });
    });
  }

  async function scaricaDavvero(provider, obs, raggio, signal) {
    const risposta = await fetch(conAntiCache(provider.url(obs, raggio)),
      { signal, cache: 'no-store' });
    // 429 e 503 sono la stessa notizia detta da due piani diversi del
    // servizio, e chiedono la stessa cura: rallentare. Trattare il 503 come
    // un guasto qualunque voleva dire rispondere a «sono sovraccarico» con
    // una riprova fra tre secondi, cioè aggiungere carico a chi ne ha già
    // troppo — e prendersi, di lì a poco, anche il 429.
    if (risposta.status === 429 || risposta.status === 503) {
      // Il codice resta dentro al messaggio, ed e' il motivo per cui il
      // pannello serve a qualcosa: «429» e «503» dicono a chi guarda che il
      // servizio ha **risposto** — la strada c'era, e fra un po' ci sara'
      // ancora — mentre una sveglia scaduta dice solo che ci siamo arresi noi.
      const errore = new Error(risposta.status === 429
        ? 'limite di richieste raggiunto (429)' : 'servizio sovraccarico (503)');
      errore.rateLimit = true; errore.stato = risposta.status;
      const fra = attesaRichiesta(risposta);
      if (fra !== null) errore.riprovaFraMs = fra;
      throw errore;
    }
    if (!risposta.ok) {
      const errore = new Error(`risposta ${risposta.status}`);
      errore.stato = risposta.status; throw errore;
    }
    // Il JSON si legge a mano invece che con `risposta.json()`: un ponte che
    // restituisce una pagina d'errore in HTML deve dare un guasto che si
    // possa raccontare, non un `SyntaxError` con dentro un pezzo di markup.
    const testo = await risposta.text();
    let dati;
    try { dati = JSON.parse(testo); } catch (e) { throw schemaSconosciuto(provider.rete || provider.nome); }
    let dettaglio = '';
    try { dettaglio = (risposta.headers && risposta.headers.get('X-ADSB-Fonte')) || ''; } catch (e) { /* niente */ }
    if (dettaglio) dettagliFonte.set(provider.nome, dettaglio);
    const fonte = dettaglio || provider.fonte || provider.rete || provider.nome;
    const ora = Date.now();
    return provider.interpreta(dati).map(r => normalizzaLettura(r, fonte, ora)).filter(Boolean);
  }

  // =====================================================================
  // 3-ter. LA FUSIONE — un aereo, un'icona, qualunque sia la porta
  //    Lo stesso aereo arriva da più strade: due ponti sulla stessa rete, il
  //    proxy e OpenSky, la lettura di adesso e quella di venti secondi fa.
  //    Qui diventano **un record solo**, riconosciuto in quest'ordine:
  //      1. il codice ICAO a 24 bit (il transponder), che è l'unico
  //         identificativo che non cambia mai;
  //      2. la registrazione, quando una lettura non porta il codice;
  //      3. l'indicativo di volo, solo per le letture che non hanno né
  //         l'uno né l'altra.
  //    Fra due letture dello stesso aereo vince la **più recente**; a pari
  //    istante (entro mezzo secondo) quella della porta che viene prima
  //    nell'elenco, cioè quella che ha vinto la corsa. I campi descrittivi
  //    (modello, operatore, registrazione) si prendono da chi li ha, perché
  //    una porta che non li manda non vuol dire che non esistano.
  // =====================================================================

  function eIcao(id) { return !!id && !/^(reg|vol):/.test(id); }
  function voloNorm(cs) { return String(cs || '').trim().replace(/\s+/g, '').toUpperCase(); }

  function fondiDue(prima, poi) {
    const dt = (poi.ultimaLettura || 0) - (prima.ultimaLettura || 0);
    const nuovo = dt > 0.5 ? poi : prima;
    const altro = nuovo === prima ? poi : prima;
    const riempi = k => nuovo[k] || altro[k] || '';
    const fonti = Array.from(new Set([].concat(prima.fonti || [prima.fonte], poi.fonti || [poi.fonte]).filter(Boolean)));
    return {
      ...nuovo,
      id: eIcao(prima.id) ? prima.id : poi.id,
      registrazione: riempi('registrazione'), tipoIcao: riempi('tipoIcao'),
      descrizione: riempi('descrizione'), operatore: riempi('operatore'), squawk: riempi('squawk'),
      fonti
    };
  }

  // `liste` è un elenco di elenchi, dal più autorevole al meno: la prima è
  // la porta che ha vinto la corsa, l'ultima di solito la memoria.
  function fondiLetture(liste) {
    const tutti = [];
    liste.forEach((lista, rango) => (lista || []).forEach(r => {
      if (!r || !Number.isFinite(r.lat) || !Number.isFinite(r.lon)) return;
      const id = String(r.id || '').trim().toLowerCase();
      tutti.push({ r: { ...r, id, fonti: r.fonti || (r.fonte ? [r.fonte] : []) }, rango });
    }));
    // Prima chi porta il codice ICAO: sono loro a fissare le chiavi a cui si
    // appendono le letture che ce l'hanno solo per registrazione o volo.
    tutti.sort((a, b) => (eIcao(b.r.id) - eIcao(a.r.id)) || a.rango - b.rango);
    const perChiave = new Map(), perReg = new Map(), perVolo = new Map();
    tutti.forEach(({ r }) => {
      let chiave = r.id;
      if (!eIcao(chiave)) {
        chiave = (r.registrazione && perReg.get(r.registrazione.toUpperCase())) ||
          (voloNorm(r.callsign) && perVolo.get(voloNorm(r.callsign))) || chiave;
      }
      if (!chiave) return;
      const c = perChiave.get(chiave);
      const fuso = c ? fondiDue(c, r) : r;
      fuso.id = chiave;
      perChiave.set(chiave, fuso);
      if (fuso.registrazione) perReg.set(fuso.registrazione.toUpperCase(), chiave);
      // L'indicativo si usa come ponte solo verso un codice ICAO, e solo se
      // è un nome e non il codice stesso ripetuto (le reti scrivono l'ICAO
      // al posto del volo quando il volo manca).
      const volo = voloNorm(fuso.callsign);
      if (volo && volo.toLowerCase() !== chiave) perVolo.set(volo, chiave);
    });
    return Array.from(perChiave.values());
  }

  // =====================================================================
  // 3-quater. LA CORSA
  //    Non una fila indiana: si lancia la prima porta e, dopo AFFIANCA_MS,
  //    anche la seconda. Vince chi risponde per prima; le perdenti si
  //    abortiscono. Una porta caduta lascia subito il posto alla prossima —
  //    l'affiancamento serve a chi tace, non a chi ha già detto di no — e la
  //    sveglia grossa è di **tutta la corsa**.
  //
  //    Con due cose in più, che sono quelle che fanno di una corsa un
  //    aggregatore. La **raccolta**: vinta la corsa, le porte già in volo
  //    hanno ancora `fondiMs` per rispondere, e quello che portano si fonde
  //    (§3-ter) invece di buttarlo — non se ne lancia nessuna nuova per
  //    questo. E il **sospetto sugli zeri**: se poco prima qui c'erano
  //    aerei (`opz.attesi`), una risposta vuota non chiude la corsa, lascia
  //    parlare la porta dopo. Se nessuna la smentisce, lo zero si accetta —
  //    ma si dice quante porte l'hanno confermato, perché «nessun aereo» e
  //    «una sola rete dice nessun aereo» non sono la stessa frase.
  // =====================================================================

  function corsaProvider(providers, obs, raggio, signalEsterno, opz = {}) {
    if (!providers.length) return Promise.reject(new Error('servizi ADS-B in pausa; riprovo più tardi'));
    const affiancaMs = Number.isFinite(opz.affiancaMs) ? opz.affiancaMs : AFFIANCA_MS;
    const attesaMs = Number.isFinite(opz.attesaMs) ? opz.attesaMs : PROVIDER_ATTESA_MS;
    const corsaMs = Number.isFinite(opz.corsaMs) ? opz.corsaMs : CORSA_ATTESA_MS;
    const fondiMs = Number.isFinite(opz.fondiMs) ? opz.fondiMs : 0;
    const sospettaZeri = Number.isFinite(opz.attesi) && opz.attesi >= VUOTO_SOSPETTO_MIN;
    return new Promise((risolvi, rifiuta) => {
      if (signalEsterno && signalEsterno.aborted) { rifiuta(annullata()); return; }
      const errori = [];
      const provate = [];
      const letture = [];   // { provider, aerei } delle porte che hanno risposto con dati
      const vuoti = [];     // le porte che hanno risposto zero
      const regia = new AbortController();
      let prossimo = 0, inVolo = 0, chiuso = false, timerAffianco = null, raccolta = null;

      const sveglia = setTimeout(() => {
        if (letture.length || vuoti.length) chiudiConLetture();
        else concludi(null, errNome('TimeoutError', 'nessuna rete ADS-B ha risposto in tempo'));
      }, corsaMs);
      const annullaEsterno = () => concludi(null, annullata());
      if (signalEsterno) signalEsterno.addEventListener('abort', annullaEsterno, { once: true });

      function concludi(vincitore, errore) {
        if (chiuso) return;
        chiuso = true;
        clearTimeout(sveglia); clearTimeout(timerAffianco); clearTimeout(raccolta);
        if (signalEsterno) signalEsterno.removeEventListener('abort', annullaEsterno);
        regia.abort();
        if (vincitore) risolvi(vincitore);
        else rifiuta(errore || peggiore(errori));
      }

      function chiudiConLetture() {
        if (chiuso) return;
        if (letture.length) {
          // Qualcuno ha visto aerei: chi aveva risposto zero è smentito.
          vuoti.forEach(v => segnaVuoto(v.provider));
          concludi({ provider: letture[0].provider, aerei: fondiLetture(letture.map(l => l.aerei)),
            provate: provate.slice(), fonti: letture.map(l => l.provider.nome),
            vuoto: false, vuotoConfermatoDa: 0 });
          return;
        }
        // Solo zeri. Non smentiti da nessuno, quindi si accettano — e le
        // porte che li hanno detti non hanno sbagliato niente.
        vuoti.forEach(v => segnaEsito(v.provider, true, null, v.durata));
        concludi({ provider: vuoti[0].provider, aerei: [], provate: provate.slice(),
          fonti: vuoti.map(v => v.provider.nome), vuoto: true, vuotoConfermatoDa: vuoti.length,
          // Incerto: c'era traffico poco fa, e a dire «zero» è stata una
          // porta sola. Il pannello lo dice invece di mostrare un cielo
          // sgombro come se fosse un fatto.
          vuotoIncerto: sospettaZeri && vuoti.length < 2 });
      }

      function pianifica(ritardo) {
        if (chiuso || raccolta || prossimo >= providers.length) return;
        clearTimeout(timerAffianco);
        timerAffianco = setTimeout(lancia, ritardo);
      }

      function forseFinito() {
        if (chiuso || inVolo > 0) return;
        if (raccolta || prossimo >= providers.length) {
          if (letture.length || vuoti.length) chiudiConLetture();
          else concludi(null, peggiore(errori));
        }
      }

      function lancia() {
        if (chiuso || raccolta || prossimo >= providers.length) return;
        const provider = providers[prossimo++];
        provate.push(provider.nome);
        saluteDi(provider.nome).ultimaProva = Date.now();
        inVolo++;
        const partito = Date.now();
        const suo = new AbortController();
        const propaga = () => suo.abort();
        regia.signal.addEventListener('abort', propaga, { once: true });
        // Una porta puo' chiedere piu' tempo delle altre, e il proxy del sito
        // lo fa: dietro a quell'unico indirizzo c'e' una corsa fra piu' fonti
        // fatta dal server. Dandogli la stessa sveglia di una rete diretta lo
        // si interrompe **mentre sta ancora correndo**, e al posto del suo
        // racconto — quale fonte ha detto cosa — arriva un abort nostro, che
        // non spiega niente.
        const scadenzaSua = setTimeout(propaga,
          Number.isFinite(provider.attesaMs) ? provider.attesaMs : attesaMs);
        scarica(provider, obs, raggio, suo.signal, { cache: !!opz.cache }).then(aerei => {
          if (chiuso) return;
          const durata = Date.now() - partito;
          if (!aerei.length && sospettaZeri && !raccolta) {
            // Uno zero dove poco fa c'era traffico: non chiude niente, e la
            // porta dopo parte **subito** invece di aspettare l'affiancamento.
            vuoti.push({ provider, durata });
            pianifica(0);
            return;
          }
          if (!aerei.length) {
            // Uno zero non sospetto è una risposta legittima e chiude la
            // corsa come qualunque altra; arrivato durante la raccolta non
            // aggiunge niente, ma la porta ha risposto e conta come tale.
            if (!letture.length && !raccolta) { vuoti.push({ provider, durata }); chiudiConLetture(); }
            else segnaEsito(provider, true, null, durata);
            return;
          }
          segnaEsito(provider, true, null, durata);
          letture.push({ provider, aerei });
          if (raccolta) return;
          // Vinta la corsa. Se altre porte sono ancora per aria le si
          // aspetta un poco, e intanto non se ne lancia nessuna.
          if (fondiMs > 0 && inVolo > 1) {
            clearTimeout(timerAffianco);
            raccolta = setTimeout(chiudiConLetture, fondiMs);
          } else {
            chiudiConLetture();
          }
        }).catch(e => {
          if (chiuso) return;
          // Una porta abortita perché ha vinto un'altra non ha sbagliato
          // niente: segnarle un no la manderebbe in penale per aver perso
          // una corsa, che è il modo più veloce di svuotare la pagella.
          if (regia.signal.aborted) return;
          const guaio = e.name === 'AbortError'
            ? errNome('TimeoutError', `${provider.nome}: tempo scaduto`) : e;
          segnaEsito(provider, false, guaio);
          errori.push(guaio);
          // Chi cade lascia **subito** il posto: l'affiancamento serve a chi
          // tace, e aspettarlo qui vorrebbe dire pagare due volte lo stesso
          // guasto.
          pianifica(0);
        }).finally(() => {
          clearTimeout(scadenzaSua);
          regia.signal.removeEventListener('abort', propaga);
          inVolo--;
          forseFinito();
        });
        if (prossimo < providers.length) pianifica(affiancaMs);
      }

      lancia();
    });
  }

  // Il nome storico resta esportato: `verifica.html` e chi ha scritto un
  // provider proprio lo conoscono, e la corsa è la stessa funzione con una
  // strategia diversa dentro.
  function scaricaConRipiego(providers, obs, raggio, signal, attesaMs) {
    return corsaProvider(providers, obs, raggio, signal,
      Number.isFinite(attesaMs) ? { attesaMs } : {});
  }

  // =====================================================================
  // 3-quinquies. LA FACCIATA — `FontiAerei`, l'unica porta verso le fonti
  //    È il livello che il resto del modulo vede, e il solo: il motore (§6)
  //    chiede «gli aerei attorno a questo punto, entro questo raggio» e
  //    riceve un elenco di record normalizzati e già fusi, senza sapere
  //    quali porte sono state provate, in che ordine, quali erano in penale
  //    e quali hanno risposto. Da qui passano **tutte** le richieste ADS-B
  //    dell'app — il battito, il tasto, il raggio che cambia, il ritorno da
  //    un'altra scheda — ed è per questo che la memoria delle risposte e le
  //    richieste gemelle (§3-bis) servono a qualcosa.
  //
  //    Accanto, l'**età** di ogni aereo: tre gradini misurati dall'istante
  //    della lettura, che il disegno usa per velare e il ciclo per potare.
  // =====================================================================

  function qualitaDi(etaMs) {
    if (!(etaMs > AEREI_VIVO_MS)) return 'vivo';
    return etaMs <= AEREI_INTERPOLATO_MS ? 'interpolato' : 'stantio';
  }

  // Oltre quest'età un aereo esce dal cielo. Mai sotto i due minuti, e mai
  // sotto il ritmo di adesso più un minuto: a disegno spento si scarica ogni
  // tre minuti, e togliere gli aerei a metà del giro vorrebbe dire lasciare
  // la realtà aumentata e i transiti senza niente da guardare fra un
  // aggiornamento e l'altro.
  function etaMassimaMs() {
    return Math.max(AEREI_MEMORIA_MS, intervalloAggiornamento() + 60000);
  }

  function etaLettura(a, oraMs = Date.now()) {
    const origine = (a && a.posizioneFeed) || a;
    // Senza istante vale «adesso», come in `aereoAdesso`: un record scritto a
    // mano (un provider proprio, una prova) non va potato per una data che
    // non ha.
    return origine && Number.isFinite(origine.ultimaLettura)
      ? Math.max(0, oraMs - origine.ultimaLettura * 1000) : 0;
  }

  // Quanti aerei c'erano qui poco fa: è il metro con cui una risposta vuota
  // diventa sospetta. «Qui» vuol dire dentro alla tolleranza del centro, e
  // «poco fa» dentro a `VUOTO_SOSPETTO_FINESTRA_MS`: uno zero dopo un cambio
  // di città non ha niente da smentire.
  function attesiQui(obs, ora = Date.now()) {
    if (!obs || !stato.ultimoCentro || !stato.ultimoPieno) return 0;
    if (ora - stato.ultimoPieno.quando > VUOTO_SOSPETTO_FINESTRA_MS) return 0;
    if (distanzaDirezione(stato.ultimoCentro, obs).km > tolleranzaCentroKm()) return 0;
    return stato.ultimoPieno.quanti;
  }

  function providersCorrenti(forza) {
    if (Array.isArray(window.AEREI_PROVIDERS) && window.AEREI_PROVIDERS.length) return window.AEREI_PROVIDERS;
    if (window.AEREI_PROVIDER) return [window.AEREI_PROVIDER];
    return providersPerRichiesta(!!forza);
  }

  function acquisisci(obs, raggio, signal, opz = {}) {
    return corsaProvider(providersCorrenti(opz.forza), obs, raggio, signal, {
      fondiMs: FUSIONE_ATTESA_MS,
      attesi: attesiQui(obs),
      // Un gesto esplicito bussa per davvero; il ciclo si accontenta di una
      // fotografia di pochi secondi fa, se c'è.
      cache: !opz.forza
    });
  }

  // --- Lo stato delle fonti, per il pannello ----------------------------
  // Parole e non codici: «disponibile», «in pausa», «non raggiungibile dal
  // browser». I dettagli tecnici (l'ultimo guasto, quanto ci ha messo) vanno
  // nel `title` della riga, per chi li cerca.
  //
  // Accanto alle porte vere ci sono le **fonti che richiedono il proxy**:
  // ADS-B Exchange (un servizio in abbonamento) e le credenziali di OpenSky
  // non possono stare nel codice di una pagina che chiunque legge, quindi da
  // qui si può solo dire se il proxy del sito le ha — lo dice lui, da
  // `/api/fonti` — oppure che mancano.
  const fontiProxy = { stato: 'ignoto', elenco: [], quando: 0, promessa: null };

  function caricaFontiProxy() {
    const proxy = urlProxy();
    if (!proxy || fontiProxy.promessa || Date.now() - fontiProxy.quando < 600000) return;
    const controller = new AbortController();
    const sveglia = setTimeout(() => controller.abort(), 8000);
    fontiProxy.promessa = fetch(`${proxy}/api/fonti`, { signal: controller.signal, cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        fontiProxy.elenco = d && Array.isArray(d.fonti) ? d.fonti : [];
        fontiProxy.stato = d ? 'noto' : 'ignoto';
      })
      .catch(() => { fontiProxy.stato = 'ignoto'; })
      .finally(() => {
        clearTimeout(sveglia);
        fontiProxy.quando = Date.now(); fontiProxy.promessa = null;
        guardato('fonti', aggiornaUI);
      });
  }

  function diagnosticaFonti(ora = Date.now()) {
    const righe = providersDisponibili().map(p => {
      const v = salute.get(p.nome);
      const circuito = statoCircuito(p.nome, ora);
      let stato;
      if (circuito === 'bloccato') stato = 'bloccata';
      else if (circuito === 'aperto') stato = 'pausa';
      else if (circuito === 'semiaperto') stato = 'incerta';
      else if (circuito === 'nuovo' || !v || !v.ok) stato = 'daProvare';
      else stato = v.ultimoMs > 6000 ? 'lenta' : 'disponibile';
      return { nome: p.nome, stato, riserva: !!p.riserva, guaio: v ? v.ultimoGuaio : '',
        ms: v ? v.ultimoMs : 0, fino: v ? v.penaleFino : 0, dettaglio: dettagliFonte.get(p.nome) || '' };
    });
    const conProxy = !!urlProxy();
    const haDalProxy = nome => fontiProxy.elenco.some(f => String(f.nome || f).toLowerCase().includes(nome));
    const premium = [
      { nome: 'ADS-B Exchange', stato: !conProxy ? 'serveProxy' : haDalProxy('exchange') ? 'viaProxy'
        : fontiProxy.stato === 'noto' ? 'nonConfigurata' : 'sconosciuta' },
      { nome: 'OpenSky (account)', stato: !conProxy ? 'serveProxy' : haDalProxy('opensky') ? 'viaProxy'
        : fontiProxy.stato === 'noto' ? 'nonConfigurata' : 'sconosciuta' },
      { nome: 'Airplanes.live', stato: !conProxy ? 'serveProxy' : haDalProxy('airplanes') ? 'viaProxy'
        : fontiProxy.stato === 'noto' ? 'nonConfigurata' : 'sconosciuta' }
    ];
    const memoria = stato.aerei.filter(a => stato.ultimiVisti && !stato.ultimiVisti.has(String(a.id))).length;
    return { righe, premium, memoria };
  }

  const FontiAerei = {
    acquisisci, fondiLetture, normalizzaLettura, statoCircuito, diagnostica: diagnosticaFonti,
    fonti: () => providersDisponibili(), qualitaDi, etaMassimaMs
  };

  // =====================================================================
  // 4. LO STATO
  //    Due interruttori, non uno. `dati` dice se il feed deve restare vivo,
  //    `visibile` se i triangoli vanno disegnati sopra le stelle: sono due
  //    domande diverse, e tenerle nella stessa variabile costringeva ad
  //    accendere il disegno per sapere che c'è in cielo — e ad aspettare il
  //    primo scarico proprio nell'istante in cui uno voleva vedere qualcosa.
  //    Adesso dati e disegno partono da soli aprendo il planetario, così gli
  //    aerei sono subito visibili; i due interruttori restano indipendenti per
  //    chi preferisce tenere il feed in memoria senza mostrarlo.
  // =====================================================================

  const stato = {
    aerei: [], timer: null, richiesta: null, controller: null, ultimoCentro: null,
    // `richiestaDa` e `ultimoBattito` sono i due orologi che i guardiani del
    // ciclo leggono: da quando una richiesta è in volo, e quando il battito
    // ha battuto l'ultima volta. Non si salvano e non si mostrano — servono
    // solo a distinguere «sta lavorando» da «è morto e non lo sa».
    richiestaDa: 0, ultimoBattito: 0,
    dati: true, visibile: true, auto: true,
    ultimoSuccesso: 0, ultimoTentativo: 0, prossimoAggiornamento: 0, prossimoTentativo: 0,
    tentativiFalliti: 0, errore: '', errNome: '', ultimaFonte: '', avviato: false,
    ricaricaDopo: false, ultimoRenderSecondo: null, feedbackRichiesto: false, feedbackTimer: null,
    ultimaFase: '',
    // L'ultima fotografia **con dentro qualcosa** (quanti, quando): è il
    // termine di paragone del sospetto sugli zeri (§3-ter). `vuotoIncerto`
    // dice che l'ultima risposta è stata uno zero detto da una porta sola
    // dove poco prima c'era traffico; `ultimiVisti` sono gli aerei che
    // l'ultima lettura ha confermato, e per differenza quelli che il cielo
    // mostra solo perché la memoria li tiene ancora. `ultimoLimite` è
    // quando una porta ci ha chiesto di rallentare, e da lì il freno del
    // ritmo (`FRENO_LIMITE_MS`); `ultimeFonti` chi ha contribuito alla
    // fotografia di adesso.
    ultimoPieno: null, vuotoIncerto: false, ultimiVisti: null, ultimoLimite: 0, ultimeFonti: []
  };

  function preferenzeCarica() {
    try {
      const v = JSON.parse(localStorage.getItem(CHIAVE_AEREI) || '{}');
      if (typeof v.dati === 'boolean') stato.dati = v.dati;
      if (typeof v.visibile === 'boolean') stato.visibile = v.visibile;
      if (typeof v.auto === 'boolean') stato.auto = v.auto;
    } catch (e) { /* senza memoria valgono i valori di serie */ }
  }

  function preferenzeSalva() {
    try {
      localStorage.setItem(CHIAVE_AEREI,
        JSON.stringify({ dati: stato.dati, visibile: stato.visibile, auto: stato.auto }));
    } catch (e) { /* niente storage: la scelta vale per questa sessione */ }
  }

  saluteCarica();
  preferenzeCarica();

  // Le risposte dei provider sono fotografie, non una rotta. Conservare i
  // punti successivi per ICAO permette di ricostruire il tratto realmente
  // osservato senza confonderlo con la previsione tratteggiata dei 5 minuti.
  const tracce = new Map();
  let mappaRotta = null;
  let stratiRotta = [];

  function raggioKm() {
    return typeof raggioAerei === 'function' ? raggioAerei() : 10;
  }

  function distanzaDirezione(a, b) {
    const p1 = radianti(a.lat), p2 = radianti(b.lat);
    const dl = radianti(b.lon - a.lon);
    const x = Math.sin(dl) * Math.cos(p2);
    const y = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    const angolo = Math.atan2(Math.sqrt(x * x + y * y),
      Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl));
    return { km: TERRA_KM * angolo, az: (gradi(Math.atan2(x, y)) + 360) % 360 };
  }

  function posizioneFutura(aereo, secondi) {
    const distanza = Math.max(0, aereo.velocitaMs || 0) * secondi / 1000 / TERRA_KM;
    const rotta = radianti(Number.isFinite(aereo.direzione) ? aereo.direzione : 0);
    const lat1 = radianti(aereo.lat), lon1 = radianti(aereo.lon);
    const lat = Math.asin(Math.sin(lat1) * Math.cos(distanza) +
      Math.cos(lat1) * Math.sin(distanza) * Math.cos(rotta));
    const lon = lon1 + Math.atan2(Math.sin(rotta) * Math.sin(distanza) * Math.cos(lat1),
      Math.cos(distanza) - Math.sin(lat1) * Math.sin(lat));
    const quotaM = Number.isFinite(aereo.quotaM)
      ? Math.max(0, aereo.quotaM + (Number.isFinite(aereo.salitaMs) ? aereo.salitaMs : 0) * secondi)
      : null;
    return { ...aereo, lat: gradi(lat), lon: limita180(gradi(lon)), quotaM };
  }

  function coordinateCielo(aereo, osservatore) {
    const d = distanzaDirezione(osservatore, aereo);
    // Non confondere la distanza sulla carta con quella che separa davvero
    // l'occhio dall'aereo. Il triangolo va risolto sui due raggi terrestri:
    // così curvatura, quota dell'osservatore e quota dell'aereo entrano nello
    // stesso conto, invece di correggere a posteriori una Terra piatta.
    const quotaOsservatoreKm = Number.isFinite(osservatore.quotaM) ? osservatore.quotaM / 1000 : 0;
    const quotaAereoKm = Number.isFinite(aereo.quotaM) ? aereo.quotaM / 1000 : 0;
    const rOsservatore = TERRA_KM + quotaOsservatoreKm;
    const rAereo = TERRA_KM + quotaAereoKm;
    const angolo = d.km / TERRA_KM;
    const avanti = rAereo * Math.sin(angolo);
    const alto = rAereo * Math.cos(angolo) - rOsservatore;
    const distanzaKm = Math.hypot(avanti, alto);
    const alt = gradi(Math.atan2(alto, Math.max(.00002, avanti)));
    return { az: d.az, alt, distanzaKm, distanzaSuoloKm: d.km };
  }

  // L'orizzonte vero in quella direzione, colline comprese: è la stessa
  // cascata con cui il planetario decide se un astro è sorto. Senza il
  // modulo del terreno resta lo zero geometrico, e l'arco finisce dove
  // finisce la Terra tonda invece che dietro alla montagna.
  function orizzonteIn(az) {
    if (typeof skyAltezzaOrizzonte === 'function') {
      try { const h = skyAltezzaOrizzonte(az); if (Number.isFinite(h)) return h; }
      catch (e) { /* niente terreno: vale lo zero */ }
    }
    return 0;
  }

  // Le tre cose che dell'arco si vogliono sapere senza rileggerlo tutto:
  // quanto in alto arriva, per quanto ancora si vede, e se quel «per quanto»
  // è una misura o il tetto della fiducia. La differenza conta: «sparisce
  // dietro le colline fra 6 minuti» è una previsione, «lo seguo per 25
  // minuti» è il punto in cui abbiamo smesso di guardare.
  function arcoRiassunto(punti) {
    if (!punti || !punti.length) return null;
    const ultimo = punti[punti.length - 1];
    let culmine = punti[0];
    punti.forEach(p => { if (p.alt > culmine.alt) culmine = p; });
    return {
      minutiResidui: ultimo.minuti,
      tramonta: !!ultimo.tramonto,
      altMax: culmine.alt,
      azCulmine: culmine.az,
      minutiCulmine: culmine.minuti,
      troncato: !ultimo.tramonto && ultimo.minuti >= AEREI_ARCO_MAX_MIN
    };
  }

  // L'arco di transito: dove passa l'aereo da adesso fino a quando sparisce
  // dietro l'orizzonte, o fino al tetto della fiducia (`AEREI_ARCO_MAX_MIN`).
  //
  // Due cose da sapere prima di metterci mano. La prima è il **passo
  // variabile**: fitto nel primo minuto, dove l'aereo vicino corre in cielo,
  // e da lì in poi al minuto, dove ormai striscia. La seconda è che l'arco
  // **si ferma davvero** quando l'aereo tramonta: continuare a propagarlo
  // sotto la cresta vorrebbe dire disegnare una riga dentro alla montagna,
  // che è il modo in cui una previsione smette di somigliare a una
  // previsione.
  function arcoDiTransito(origine, obs) {
    const punti = [];
    const massimo = AEREI_ARCO_MAX_MIN * 60;
    let sotto = false;
    for (let s = 0; s <= massimo; s += (s < AEREI_ARCO_FINE_S ? AEREI_ARCO_PASSO_FINE_S : 60)) {
      const futuro = posizioneFutura(origine, s);
      const cielo = coordinateCielo(futuro, obs);
      const minuti = s / 60;
      punti.push({
        secondi: s, minuti, ...cielo,
        // Le tacche restano al minuto tondo dentro alla previsione corta di
        // sempre, e passano ai cinque minuti nel tratto lungo: sei pallini
        // fitti sono una previsione, venticinque sono una collana.
        tacca: Number.isInteger(minuti) &&
          (minuti <= PREVISIONE_MINUTI ? minuti > 0 : minuti % 5 === 0),
        oltreLaFiducia: minuti > PREVISIONE_MINUTI
      });
      if (cielo.alt < orizzonteIn(cielo.az)) { sotto = true; break; }
    }
    // Il tramonto dell'aereo, cercato per bisezione fra l'ultimo campione
    // alto e il primo basso: è quello che dice per quanto tempo ancora si
    // può guardare, ed è il numero che la scheda scrive.
    if (sotto && punti.length > 1) {
      let a = punti[punti.length - 2].secondi, b = punti[punti.length - 1].secondi;
      for (let k = 0; k < 20 && b - a > 0.5; k++) {
        const m = (a + b) / 2;
        const c = coordinateCielo(posizioneFutura(origine, m), obs);
        if (c.alt >= orizzonteIn(c.az)) a = m; else b = m;
      }
      punti[punti.length - 1] = {
        secondi: a, minuti: a / 60, ...coordinateCielo(posizioneFutura(origine, a), obs),
        tacca: false, oltreLaFiducia: a / 60 > PREVISIONE_MINUTI, tramonto: true
      };
    }
    return punti;
  }

  function separazione(a, b) {
    const aa = radianti(a.alt), ab = radianti(b.alt);
    const cos = Math.sin(aa) * Math.sin(ab) + Math.cos(aa) * Math.cos(ab) *
      Math.cos(radianti(a.az - b.az));
    return gradi(Math.acos(Math.max(-1, Math.min(1, cos))));
  }

  function osservatore() {
    // Gli aerei appartengono al cielo che si sta guardando, non sempre alla
    // posizione principale dell'app: durante una visita il centro e'
    // `sky.luogoVista` (esposto da skyLuogoDelCielo()).
    const p = typeof skyLuogoDelCielo === 'function'
      ? skyLuogoDelCielo()
      : (typeof sky !== 'undefined' && (sky.luogoVista || sky.posizione));
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
    return { lat: p.lat, lon: p.lon, quotaM: p.altitudine || p.quota || 0 };
  }

  // Da dove **disegnare**. La posizione dell'app avanza a gradini di
  // centocinquanta metri, ed è la stessa ragione per cui il paesaggio ha il
  // suo punto vivo (`terreno.js` §6-bis): centocinquanta metri non spostano
  // una stella, ma un aereo a due chilometri sì — sono quattro gradi, cioè
  // uno scatto visibile a ogni fix. Chi **scarica** continua a usare
  // `osservatore()`: una richiesta di rete non si fa partire da un punto
  // estrapolato.
  function osservatoreDisegno() {
    const base = osservatore();
    if (!base || typeof terrenoPuntoDaDisegnare !== 'function') return base;
    let vivo = null;
    try { vivo = terrenoPuntoDaDisegnare(); } catch (e) { return base; }
    if (!vivo || vivo.proprio || !Number.isFinite(vivo.lat) || !Number.isFinite(vivo.lon)) return base;
    // Il punto vivo parla della posizione dell'app; col planetario spostato a
    // guardare il cielo di un'altra città non c'entra niente, e la distanza
    // lo dice senza doverlo chiedere.
    return distanzaDirezione(base, vivo).km <= AEREI_VIVO_MAX_KM
      ? { lat: vivo.lat, lon: vivo.lon, quotaM: base.quotaM } : base;
  }

  // =====================================================================
  // 4-bis. MUOVERSI NON È CAMBIARE CIELO
  //
  //   Il centro di questo modulo è l'osservatore del planetario, e col GPS
  //   acceso quell'osservatore si sposta ogni centocinquanta metri (è il
  //   filtro di `skyLetturaAttendibile`, e per il cielo è la soglia giusta:
  //   centocinquanta metri non spostano una stella di un pixel). Prima ogni
  //   passo di quel filtro faceva quattro cose insieme: buttava la
  //   fotografia, azzerava il suo orologio, **abortiva la richiesta in volo**
  //   e ne faceva partire subito un'altra. In macchina, a novanta all'ora,
  //   quel passo cade ogni sei secondi — meno del tempo che una porta ADS-B
  //   ci mette a rispondere. Il risultato non era un cielo con gli aerei un
  //   po' spostati: era un cielo **senza aerei per tutto il viaggio**, con
  //   una richiesta interrotta ogni sei secondi e il conto delle riprove
  //   azzerato ogni volta, cioè senza nemmeno il freno che dovrebbe
  //   proteggere dai 429.
  //
  //   Eppure spostandosi la fotografia resta buona quasi tutta, e per una
  //   ragione di fondo: le posizioni degli aerei sono **latitudini e
  //   longitudini**, non angoli visti da qui. Azimut, altezza e distanza si
  //   rifanno da capo a ogni fotogramma dal punto in cui si è adesso
  //   (`aggiornaPosizioni`), quindi muovendosi non diventano sbagliate: si
  //   aggiornano. L'unica cosa legata al centro è **quali** aerei sono stati
  //   chiesti, cioè il riquadro della richiesta — e un chilometro dentro a un
  //   raggio di cinquanta cambia il bordo di un cinquantesimo.
  //
  //   Da qui le tre soglie, ed è tutta la differenza fra «riscaricare» e
  //   «riscaricare quando serve»:
  //     · sotto la **tolleranza** non succede niente di niente;
  //     · sopra, il prossimo scarico si anticipa — non si fa: si anticipa, e
  //       mai prima di `AEREI_MOTO_MIN_MS` dall'ultimo riuscito;
  //     · sopra il **salto** si è altrove, e allora sì, si butta tutto.
  //
  //   Misurato col modulo vero, una porta che risponde in otto secondi e un
  //   fix ogni centocinquanta metri (novanta all'ora): dieci chilometri di
  //   strada costavano **67 richieste, 67 abortite, zero risposte e zero
  //   aerei**; adesso sono 4 richieste — una corsa sola — una risposta e
  //   quattro aerei in cielo per tutto il viaggio.
  // =====================================================================

  function scartoDalCentroKm(obs = osservatore()) {
    if (!obs || !stato.ultimoCentro) return Infinity;
    return distanzaDirezione(stato.ultimoCentro, obs).km;
  }

  function tolleranzaCentroKm() {
    return Math.max(AEREI_CENTRO_MIN_KM,
      Math.min(AEREI_CENTRO_MAX_KM, raggioKm() * AEREI_CENTRO_QUOTA));
  }

  // Il salto non scende mai sotto i venticinque chilometri nemmeno con un
  // raggio stretto: con dieci chilometri di ricerca, buttare tutto ogni dieci
  // di strada vorrebbe dire rifare in autostrada il difetto di prima, solo
  // più di rado.
  function saltoCentroKm() { return Math.max(AEREI_SALTO_MIN_KM, raggioKm()); }

  function centroAltrove(obs = osservatore()) {
    return scartoDalCentroKm(obs) > saltoCentroKm();
  }

  // Il riquadro della richiesta è rimasto indietro. Si anticipa il prossimo
  // scarico e non si tocca **nient'altro**: niente abort, niente
  // svuotamento, niente conto delle riprove azzerato. E mai prima di quello
  // che il freno degli errori aveva già deciso, se no un guasto sommato a un
  // viaggio diventa una raffica.
  function ricentraPresto() {
    const prima = Math.max(Date.now(), (stato.ultimoSuccesso || 0) + AEREI_MOTO_MIN_MS,
      stato.prossimoTentativo || 0);
    if (!stato.prossimoAggiornamento || prima < stato.prossimoAggiornamento) {
      stato.prossimoAggiornamento = prima;
    }
  }

  function butta() {
    stato.aerei = [];
    stato.ultimoCentro = null;
    stato.ultimoSuccesso = 0;
    stato.prossimoTentativo = 0;
    stato.prossimoAggiornamento = 0;
    stato.tentativiFalliti = 0;
    stato.errore = '';
    stato.ultimoRenderSecondo = null;
    // Il termine di paragone degli zeri era di un altro cielo.
    stato.ultimoPieno = null;
    stato.vuotoIncerto = false;
    stato.ultimiVisti = null;
  }

  function aereiPosizioneCambiata() {
    const obs = osservatore();
    if (!obs) { aggiornaUI(); return; }
    const scarto = scartoDalCentroKm(obs);
    // Niente in mano: non c'è nulla da conservare e nulla da buttare. Si
    // chiede senza forzare, cioè rispettando il ritmo — se una richiesta è
    // già in volo questa non fa niente, ed è quello che serve.
    if (!Number.isFinite(scarto)) {
      if (stato.dati && !stato.richiesta && tempoReale()) carica(false);
      aggiornaUI();
      return;
    }
    if (scarto > saltoCentroKm()) {
      // Un altro posto davvero. Qui il cambio del punto di vista è sincrono
      // mentre il feed è asincrono: svuotare subito evita anche un solo
      // fotogramma con gli aerei del luogo precedente, e la risposta vecchia
      // viene abortita perché non ripopoli il cielo nuovo.
      butta();
      if (stato.controller) {
        stato.ricaricaDopo = stato.dati;
        stato.controller.abort();
      } else if (stato.dati && tempoReale()) {
        carica(true);
      }
      render();
      aggiornaUI();
      return;
    }
    if (scarto > tolleranzaCentroKm()) ricentraPresto();
    aggiornaUI();
  }

  function arricchisci(aerei, obs) {
    const unici = new Map();
    aerei.forEach(a => {
      const id = String(a.id || '').toLowerCase();
      if (!id || !Number.isFinite(a.lat) || !Number.isFinite(a.lon)) return;
      const prima = unici.get(id);
      if (!prima || (a.ultimaLettura || 0) > (prima.ultimaLettura || 0)) unici.set(id, { ...a, id });
    });
    return Array.from(unici.values()).map(a => {
      const cielo = coordinateCielo(a, obs);
      const traiettoria = arcoDiTransito(a, obs);
      return { ...a, ...cielo, traiettoria, arco: arcoRiassunto(traiettoria),
        allineamenti: [], posizioneFeed: { ...a } };
    }).filter(a => a.distanzaSuoloKm <= raggioKm()).sort((a, b) => a.distanzaKm - b.distanzaKm);
  }

  // Quello che il feed non ha riconfermato non è per forza sparito dal cielo.
  // Una rete ADS-B è fatta di riceventi volontari: due letture di fila della
  // stessa porta possono avere buchi diversi, e un aereo sul bordo del
  // riquadro entra ed esce dall'elenco a ogni giro. Sostituendo la
  // fotografia in blocco — com'era — quei buchi diventano triangoli che
  // lampeggiano, e un giro andato male a metà **cancella** dati buoni appena
  // ricevuti. Adesso ogni lettura si somma a quella di prima: chi è stato
  // visto da poco resta e continua a essere propagato dalla sua rotta, e a
  // toglierlo è solo il tempo. È la stessa idea del terreno, che i tentativi
  // li somma invece di ripeterli — e vale doppio qui, dove i dati arrivano
  // di rado e quando arrivano vanno sfruttati fino in fondo.
  //
  // La somma passa dalla fusione (§3-ter), e non è un dettaglio: la memoria
  // può avere dello stesso aereo una lettura **più recente** di quella appena
  // arrivata — una porta in ritardo di venti secondi, dopo che un'altra ne
  // aveva dato uno di adesso — e sostituirla in blocco voleva dire farlo
  // tornare indietro di un chilometro e mezzo sullo schermo.
  function unisciConLaMemoria(nuovi, ora = Date.now()) {
    const elenco = Array.isArray(nuovi) ? nuovi.filter(Boolean) : [];
    const memoria = [];
    stato.aerei.forEach(a => {
      // La lettura grezza, non quella propagata: propagare una propagazione
      // vorrebbe dire ricalcolare l'errore sopra all'errore, e in mezz'ora
      // farebbe un aereo inventato.
      const origine = a.posizioneFeed || a;
      const letto = Number.isFinite(origine.ultimaLettura) ? origine.ultimaLettura * 1000 : 0;
      if (!letto || ora - letto > AEREI_MEMORIA_MS) return;
      memoria.push(origine);
    });
    return memoria.length ? fondiLetture([elenco, memoria]) : elenco;
  }

  function registraTracce(aerei, ora = Date.now()) {
    aerei.forEach(a => {
      const id = String(a.id || '').toLowerCase();
      if (!id) return;
      const punti = tracce.get(id) || [];
      const tempo = Number.isFinite(a.ultimaLettura) ? a.ultimaLettura * 1000 : ora;
      const ultimo = punti[punti.length - 1];
      // Più provider possono restituire la stessa fotografia: un punto con
      // lo stesso istante e quasi le stesse coordinate non va duplicato.
      if (!ultimo || Math.abs(ultimo.tempo - tempo) > 1000 ||
        Math.abs(ultimo.lat - a.lat) + Math.abs(ultimo.lon - a.lon) > 0.0001) {
        punti.push({ lat: a.lat, lon: a.lon, quotaM: a.quotaM, tempo });
      }
      const limite = ora - TRACCIA_DURATA_MS;
      while (punti.length > TRACCIA_MASSIMO_PUNTI || (punti[0] && punti[0].tempo < limite)) punti.shift();
      tracce.set(id, punti);
    });
  }

  function istanteMostratoMs() {
    if (typeof skyAdesso === 'function') return skyAdesso().getTime();
    const scarto = typeof sky !== 'undefined' ? (sky.offsetTempoSec || 0) : 0;
    return Date.now() + scarto * 1000;
  }

  function tempoReale(istanteMs = istanteMostratoMs(), oraMs = Date.now()) {
    return Math.abs(istanteMs - oraMs) <= SOGLIA_TEMPO_REALE_MS;
  }

  // Il feed è una fotografia di alcuni secondi fa. A ogni fotogramma si
  // riparte da quell'istante e si propaga velocità, rotta e salita fino ad
  // adesso: il simbolo e la linea non restano congelati per cinque minuti.
  // L'ancora della realtà aumentata: dove `visione.js` ha visto **davvero**
  // questo aereo nel fotogramma della fotocamera, meno dove lo dicevamo noi.
  //
  // È una correzione che vale la pena spiegare, perché somiglia a un imbroglio
  // e non lo è. La posizione di un aereo non arriva da un conto ma da una
  // lettura ADS-B vecchia di qualche secondo, propagata dalla rotta: a
  // duecentocinquanta metri al secondo, tre secondi sono ottocento metri, e a
  // cinque chilometri di distanza sono **nove gradi** di cielo. Quell'errore
  // è di questo aereo e di nessun altro — non è la bussola, che sbaglia per
  // tutti allo stesso modo — quindi non si può togliere raddrizzando la
  // vista: si toglie solo qui, aereo per aereo. Quando l'immagine dice dov'è
  // la sagoma, quella è la risposta migliore che abbiamo, e l'etichetta ci si
  // incolla sopra.
  //
  // Senza `visione.js`, o con la fotocamera spenta, questa riga non fa niente.
  function ancoraVista(id, cielo) {
    if (typeof visAncoraAereo !== 'function' || !cielo) return cielo;
    const anc = visAncoraAereo(id);
    if (!anc) return cielo;
    return Object.assign({}, cielo, {
      az: ((cielo.az + anc.dAz) % 360 + 360) % 360,
      alt: Math.max(-90, Math.min(90, cielo.alt + anc.dAlt)),
      agganciato: true
    });
  }

  function aereoAdesso(a, obs, oraMs = istanteMostratoMs()) {
    const origine = a.posizioneFeed || a;
    // Lo scarto e' volutamente firmato: nella macchina del tempo una lettura
    // ADS-B diventa il punto noto dal quale ricostruire sia il passato sia il
    // futuro. Limitare a zero, come prima, congelava l'aereo tornando indietro.
    const secondi = oraMs / 1000 - (origine.ultimaLettura || Date.now() / 1000);
    const corrente = posizioneFutura(origine, secondi);
    const cielo = ancoraVista(a.id, coordinateCielo(corrente, obs));
    // La traiettoria si sposta con lui: è la stessa correzione, e una riga
    // tratteggiata che parte due gradi accanto al suo aereo si legge come un
    // difetto del disegno — l'occhio la usa proprio per capire quale sagoma
    // sia quale.
    const traiettoria = arcoDiTransito(corrente, obs).map(p => ancoraVista(a.id, p));
    // L'età si misura sull'orologio vero, non su quello del planetario: dice
    // quanto è vecchio il **dato**, e nella macchina del tempo il dato è
    // quello che è, qualunque istante si stia guardando.
    const etaMs = etaLettura(origine);
    return { ...a, ...corrente, ...cielo, traiettoria, arco: arcoRiassunto(traiettoria),
      allineamenti: a.allineamenti || [],
      posizioneFeed: origine, stimato: !tempoReale(oraMs), istanteMostrato: oraMs,
      etaMs, qualita: qualitaDi(etaMs) };
  }

  // Dov'è un aereo in cielo **adesso**, senza la traiettoria. È la metà
  // leggera di `aereoAdesso`: la realtà aumentata (§12 e §13 di `visione.js`)
  // deve nominare e far calibrare gli aerei anche quando lo strato dei
  // triangoli è spento, e in quel caso le coordinate salvate in `stato.aerei`
  // sono quelle dell'ultimo disegno — cioè ferme. Rifare l'arco di transito
  // per ogni aereo e ogni fotogramma solo per sapere dove sta sarebbe il
  // conto sbagliato: la traiettoria cerca l'orizzonte vero per bisezione.
  function aereoCieloOra(a, obs = osservatoreDisegno(), oraMs = istanteMostratoMs()) {
    if (!a || !obs) return null;
    const origine = a.posizioneFeed || a;
    const secondi = oraMs / 1000 - (origine.ultimaLettura || Date.now() / 1000);
    return ancoraVista(a.id, coordinateCielo(posizioneFutura(origine, secondi), obs));
  }

  // Ogni fotogramma rifà le coordinate e, in tempo reale, **pota**: un aereo
  // che nessuna fonte riconferma da più di `etaMassimaMs()` esce dal cielo
  // da solo, senza aspettare la prossima risposta — che potrebbe non
  // arrivare mai, ed è proprio il caso in cui tenerlo vorrebbe dire
  // inventarlo. Nella macchina del tempo la potatura non si fa: lì le
  // posizioni sono stime dichiarate, e le regola `DATI_SCADUTI_MS`.
  function potaStantii(elenco, ora = Date.now()) {
    const limite = etaMassimaMs();
    return elenco.filter(a => etaLettura(a, ora) <= limite);
  }

  function aggiornaPosizioni() {
    const obs = osservatoreDisegno();
    if (!obs) return [];
    const base = tempoReale() ? potaStantii(stato.aerei) : stato.aerei;
    stato.aerei = base.map(a => aereoAdesso(a, obs));
    return stato.aerei;
  }

  // Gli allineamenti — e perché questa funzione, da sola, non poteva
  // funzionare.
  //
  // Cercare l'allineamento **sui campioni della traiettoria** è un errore
  // che si vede solo facendo i conti, e per questo è rimasto in piedi a
  // lungo: il codice è giusto, la geometria è giusta, e il risultato è
  // quasi sempre «niente». Il disco del Sole è largo mezzo grado; un aereo
  // vicino ne attraversa il cielo a gradi al secondo, quindi ci sta dentro
  // per una frazione di secondo. Chiedere a sei campioni distanti un minuto
  // di cascare proprio lì è chiedere una coincidenza da uno su centinaia —
  // e il sintomo è un'assenza, cioè la cosa che in questo cielo non lascia
  // mai traccia.
  //
  // Il conto vero lo fa `transiti.js`, che il minimo lo **raffina** invece
  // di sperare di campionarlo. Qui resta il campionamento come ripiego: se
  // quel modulo non c'è, gli aerei si comportano esattamente come prima.
  function aggiornaAllineamenti() {
    if (typeof sky === 'undefined') return;
    if (typeof tranEventi === 'function') {
      const per = new Map();
      tranEventi().forEach(e => {
        if (e.genere !== 'aereo') return;
        const chi = String(e.oggettoId);
        if (!per.has(chi)) per.set(chi, []);
        per.get(chi).push({
          nome: e.astroNome,
          minuti: Math.max(0, Math.round((e.quando - Date.now()) / 60000)),
          scarto: e.separazione,
          transito: e.transito
        });
      });
      stato.aerei.forEach(a => { a.allineamenti = per.get(String(a.id)) || []; });
      return;
    }
    const astri = (sky.oggetti || []).filter(o =>
      ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'].includes(o.id));
    stato.aerei.forEach(a => {
      a.allineamenti = [];
      a.traiettoria.forEach(p => astri.forEach(astro => {
        const scarto = separazione(p, astro);
        if (scarto <= SOGLIA_ALLINEAMENTO) a.allineamenti.push({ nome: astro.nome || astro.id, minuti: p.minuti, scarto });
      }));
    });
  }

  // =====================================================================
  // 5. LO STATO RACCONTATO
  //    Il difetto più fastidioso di questo modulo non era che i dati non
  //    arrivassero: era che quando non arrivavano **non lo diceva nessuno**.
  //    Il cielo restava senza triangoli, che è esattamente l'aspetto di un
  //    cielo senza aerei, e la sola riga di stato stava dentro a un pannello
  //    chiuso. Adesso lo stato è in tre forme, dalla più corta alla più
  //    lunga: una **spia** colorata sempre in vista accanto al tasto Aerei,
  //    una **riga parlante** nel pannello, e — solo per i gesti espliciti e
  //    per i guasti che durano — l'avviso sopra al cielo.
  // =====================================================================

  const FASI = {
    spento: { spia: 'spento', nota: 'Dati ADS-B in pausa' },
    attesa: { spia: 'attesa', nota: 'In attesa dei dati ADS-B' },
    carico: { spia: 'carico', nota: 'Scarico dei dati ADS-B in corso' },
    ok: { spia: 'ok', nota: 'Dati ADS-B aggiornati' },
    vecchio: { spia: 'vecchio', nota: 'Dati ADS-B da aggiornare' },
    errore: { spia: 'errore', nota: 'Dati ADS-B non disponibili' },
    senzaRete: { spia: 'errore', nota: 'Senza rete: dati ADS-B fermi' },
    senzaPosizione: { spia: 'errore', nota: 'Serve una posizione' },
    proxyMancante: { spia: 'errore', nota: 'Nessuna fonte ADS-B raggiungibile' },
    passato: { spia: 'vecchio', nota: 'Posizioni stimate: il cielo mostrato non è adesso' }
  };

  function fase() {
    if (!osservatore()) return 'senzaPosizione';
    if (!stato.dati) return 'spento';
    if (stato.richiesta) return 'carico';
    if (!tempoReale()) return 'passato';
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'senzaRete';
    // Prima di «errore»: senza proxy non e' andata storta una richiesta, manca
    // una configurazione — e sono due cose che chiedono due gesti diversi.
    // Chiamarlo «errore» mandava a cercare un guasto che non c'e', e a
    // aspettare una riprova che non potra' mai riuscire.
    if ((stato.errore || !stato.ultimoSuccesso) && !urlProxy()) return 'proxyMancante';
    if (stato.errore) return 'errore';
    if (!stato.ultimoSuccesso) return 'attesa';
    return Date.now() - stato.ultimoSuccesso > DATI_VECCHI_MS ? 'vecchio' : 'ok';
  }

  function quantoFa(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 5) return 'adesso';
    if (s < 60) return `${s} s fa`;
    const m = Math.round(s / 60);
    return m < 60 ? `${m} min fa` : `${Math.round(m / 60)} h fa`;
  }

  function fraQuanto(ms) {
    // La riga di stato del pannello è una riga sola e ci stanno già quattro
    // notizie: qui il tempo si dice corto.
    return astroI18n.quantoManca(ms, { breve: true });
  }


  function guaioLeggibile() {
    if (stato.errNome === 'TimeoutError') return 'nessuna rete ADS-B ha risposto in tempo';
    if (stato.errNome === 'AbortError') return 'richiesta interrotta';
    return stato.errore || 'guasto sconosciuto';
  }

  // La riga del pannello: **cosa c'è**, poi **quanto è fresco**, poi — solo
  // se serve — **cosa non va e quando riprovo**. In quest'ordine, perché è
  // l'ordine in cui uno se le chiede.
  function testoDiStato() {
    const T = (k, v) => astroI18n.t('aereiStato.' + k, v);
    const f = fase();
    const quanti = T('quanti', { n: stato.aerei.length });
    const eta = stato.ultimoSuccesso ? quantoFa(Date.now() - stato.ultimoSuccesso) : '';
    const prossimo = stato.dati && stato.auto && stato.prossimoAggiornamento
      ? T('nuovoScarico', { quando: fraQuanto(stato.prossimoAggiornamento - Date.now()) }) : '';
    if (f === 'senzaPosizione') return T('senzaPosizione');
    if (f === 'proxyMancante') return T('proxyMancante');
    if (f === 'spento') {
      return stato.ultimoSuccesso ? T('spentoConDati', { eta, quanti }) : T('spento');
    }
    if (f === 'carico') {
      return stato.ultimoSuccesso ? T('caricoConDati', { quanti, eta }) : T('carico');
    }
    if (f === 'passato') return T('passato', { quanti });
    if (f === 'senzaRete') {
      return stato.ultimoSuccesso ? T('senzaReteConDati', { eta, quanti }) : T('senzaRete');
    }
    if (f === 'errore') {
      const riprova = stato.prossimoTentativo
        ? T('riprovo', { quando: fraQuanto(stato.prossimoTentativo - Date.now()) }) : '';
      return stato.ultimoSuccesso
        ? T('erroreConDati', { guaio: guaioLeggibile(), eta, quanti, riprova })
        : T('errore', { guaio: guaioLeggibile(), riprova });
    }
    if (f === 'vecchio') return T('vecchio', { quanti, eta, prossimo });
    if (!stato.ultimoSuccesso) return T('primoScarico');
    // Uno zero non è sempre un cielo sgombro, e le due frasi devono essere
    // diverse: «nessun aereo» detto da due fonti è un fatto, detto da una
    // sola dove un minuto fa ce n'erano venti è un dubbio.
    if (!stato.aerei.length) {
      return T(stato.vuotoIncerto ? 'vuotoIncerto' : 'cieloSgombro',
        { fonte: stato.ultimaFonte || 'ADS-B', eta, prossimo });
    }
    return T('normale', { quanti, fonte: stato.ultimaFonte || 'ADS-B', eta, prossimo });
  }

  // La sezione «Fonti dei dati» del pannello: una riga per porta, in parole.
  // Si riscrive solo se è aperta e solo se è cambiata — sta nel battito, e un
  // `innerHTML` identico ogni cinque secondi farebbe perdere il fuoco a chi
  // ci sta navigando con la tastiera.
  let fontiScritte = '';
  function aereiScriviFonti() {
    const box = document.getElementById('aerei-fonti');
    const lista = document.getElementById('aerei-fonti-elenco');
    if (!box || !lista || !box.open) return;
    caricaFontiProxy();
    const T = (k, v) => astroI18n.t('aereiFonti.' + k, v);
    const d = diagnosticaFonti();
    const riga = (nome, chiave, titolo) =>
      `<li class="aerei-fonte" data-stato="${chiave}"${titolo ? ` title="${sicuro(titolo)}"` : ''}>` +
      `<span class="aerei-fonte-nome">${sicuro(nome)}</span>` +
      `<span class="aerei-fonte-stato">${sicuro(T('stato.' + chiave))}</span></li>`;
    const html = d.righe.map(r => {
      const dettagli = [r.riserva ? T('riserva') : '', r.dettaglio,
        r.ms ? T('tempo', { ms: r.ms }) : '', r.guaio].filter(Boolean).join(' · ');
      return riga(r.nome, r.stato, dettagli);
    }).join('') +
      `<li class="aerei-fonte-titolo">${sicuro(T('premium'))}</li>` +
      d.premium.map(r => riga(r.nome, r.stato, '')).join('') +
      `<li class="aerei-fonte" data-stato="memoria"><span class="aerei-fonte-nome">${sicuro(T('memoria'))}</span>` +
      `<span class="aerei-fonte-stato">${sicuro(T('memoriaQuanti', { n: d.memoria }))}</span></li>`;
    if (html === fontiScritte && lista.innerHTML) return;
    fontiScritte = html;
    lista.innerHTML = html;
  }


  function scriviTesto(id, testo) {
    const el = document.getElementById(id);
    if (el && el.textContent !== testo) el.textContent = testo;
  }

  function accendiTasto(id, acceso, testo) {
    const b = document.getElementById(id);
    if (!b) return;
    b.classList.toggle('attiva', !!acceso);
    b.setAttribute('aria-pressed', acceso ? 'true' : 'false');
    if (testo) b.textContent = testo;
  }

  // Chiamata a ogni battito e a ogni cambio di stato. È volutamente idempotente
  // e senza effetti: chi la chiama non deve chiedersi se «tocca a lui».
  function aggiornaUI() {
    const f = fase();
    const info = FASI[f] || FASI.attesa;
    const testo = testoDiStato();
    const riga = document.getElementById('aerei-stato');
    if (riga) {
      riga.textContent = testo;
      riga.dataset.fase = f;
      // La riga resta anche il posto dove uno screen reader legge il guasto:
      // `data-errore` la teneva rossa, e serve ancora al foglio di stile.
      riga.dataset.errore = (f === 'errore' || f === 'senzaRete' || f === 'senzaPosizione' ||
        f === 'proxyMancante') ? 'true' : 'false';
    }
    const spia = document.getElementById('aerei-spia');
    if (spia) {
      spia.dataset.fase = info.spia;
      const padre = spia.closest('button');
      if (padre) {
        const spiega = astroI18n.t('aereo.apriPannello', { nota: info.nota });
        padre.title = spiega;
        padre.setAttribute('aria-label', spiega);
      }
    }
    scriviTesto('aerei-conteggio', stato.aerei.length ? String(stato.aerei.length) : '—');
    guardato('fonti', aereiScriviFonti);
    accendiTasto('aerei-btn-mostra', stato.visibile);
    accendiTasto('aerei-btn-dati', stato.dati);
    accendiTasto('aerei-btn-auto', stato.auto);
    accendiTasto('skymap-btn-aerei', stato.visibile);
    const aggiorna = document.getElementById('aerei-aggiorna');
    if (aggiorna) {
      aggiorna.setAttribute('aria-busy', stato.richiesta ? 'true' : 'false');
      aggiorna.disabled = !!stato.richiesta;
      if (!stato.feedbackTimer) {
        aggiorna.textContent = stato.richiesta ? 'Aggiornamento…' : 'Aggiorna adesso';
      }
    }
    // L'avviso sopra al cielo non deve diventare un tormentone: parla solo
    // quando i triangoli sono accesi (cioè quando la loro assenza è un
    // difetto visibile) e solo se qualcosa non va davvero.
    if (typeof skyAvviso === 'function' && !stato.feedbackRichiesto) {
      const grave = stato.visibile && (f === 'errore' || f === 'senzaRete') && !stato.ultimoSuccesso;
      if (grave) skyAvviso('adsb', `Aerei: ${testo}`);
      else if (stato.ultimaFase === 'errore' || stato.ultimaFase === 'senzaRete') skyAvviso('adsb', '');
    }
    stato.ultimaFase = f;
  }

  // Il ritorno visivo del gesto esplicito: chi tocca «Aggiorna adesso» deve
  // vedere che è successo qualcosa entro il fotogramma, e leggere l'esito
  // anche se il pannello nel frattempo si è chiuso.
  function feedbackAggiornamento(testo, concluso, errore) {
    const b = document.getElementById('aerei-aggiorna');
    clearTimeout(stato.feedbackTimer);
    stato.feedbackTimer = null;
    if (b) {
      b.disabled = !concluso;
      b.setAttribute('aria-busy', concluso ? 'false' : 'true');
      b.dataset.esito = concluso ? (errore ? 'errore' : 'successo') : 'caricamento';
      b.textContent = astroI18n.t(concluso
        ? (errore ? 'aereo.nonRiuscito' : 'aereo.aggiornato') : 'aereo.aggiornamento');
    }
    if (typeof skyAvviso === 'function') skyAvviso('adsb', testo, concluso ? 6000 : undefined);
    if (concluso) {
      stato.feedbackTimer = setTimeout(() => {
        stato.feedbackTimer = null;
        if (b) { b.textContent = 'Aggiorna adesso'; delete b.dataset.esito; }
        aggiornaUI();
      }, 2600);
    }
  }

  function sicuro(s) { const e = document.createElement('span'); e.textContent = String(s); return e.innerHTML; }

  function testoRicercaAereo(a) {
    return [a.callsign, a.registrazione, a.descrizione, a.tipoIcao, a.operatore, a.id]
      .filter(Boolean).join(' ').toLocaleLowerCase('it');
  }

  function render() {
    aggiornaAllineamenti();
    const box = document.getElementById('aerei-elenco');
    if (!box) return;
    if (!stato.aerei.length) {
      // Quattro assenze diverse, quattro frasi diverse: un cielo sgombro,
      // uno zero di cui non ci si fida, fonti che non rispondono, e il primo
      // scarico che non è ancora arrivato. Scriverle tutte uguali era il
      // difetto che rendeva questo pannello inutile proprio quando serviva.
      const f = fase();
      const chiave = !stato.ultimoSuccesso
        ? ((f === 'errore' || f === 'proxyMancante' || f === 'senzaRete') ? 'nonDisponibili' : 'attesa')
        : (f === 'errore' || f === 'senzaRete') ? 'nonAggiornati'
        : stato.vuotoIncerto ? 'vuotoIncerto' : 'nessuno';
      box.innerHTML = '<p class="etichetta-comando">' + sicuro(astroI18n.t('aereiElenco.' + chiave)) + '</p>';
      return;
    }
    const ricerca = String((document.getElementById('aerei-cerca-input') || {}).value || '')
      .trim().toLocaleLowerCase('it');
    const mostrati = ricerca ? stato.aerei.filter(a => testoRicercaAereo(a).includes(ricerca)) : stato.aerei;
    if (!mostrati.length) {
      box.innerHTML = '<p class="etichetta-comando">' + sicuro(astroI18n.t('aereiElenco.ricerca')) + '</p>';
      return;
    }
    const inDiretta = tempoReale();
    box.innerHTML = mostrati.map(a => {
      const all = a.allineamenti[0];
      const f = fasciaDi(a.distanzaKm);
      const nome = a.callsign || a.registrazione || String(a.id || '').toUpperCase();
      return `<button type="button" class="aereo-riga" data-aereo-punta="${sicuro(a.id)}" ` +
        `aria-label="Punta il planetario su ${sicuro(nome)}" ` +
        `style="--fascia:${f.colore};--fascia-forte:${f.forte}">` +
        `<div class="aereo-riga-testa"><span class="aereo-pallino" aria-hidden="true"></span>` +
        `<strong>${sicuro(nome)}</strong>` +
        `<span class="aereo-distanza">${a.distanzaKm.toFixed(1)} km</span></div>` +
        `<p class="aereo-dati">${Math.round(a.quotaM || 0).toLocaleString('it-IT')} m · ` +
        `${Math.round((a.velocitaMs || 0) * 3.6)} km/h · ${Math.round(a.direzione || 0)}° · ` +
        `${inDiretta ? 'in tempo reale' : 'posizione stimata'}</p>` +
        (all ? `<p class="aereo-allineamento">${all.transito ? 'Passa davanti a' : 'Passa vicino a'} ` +
          `${sicuro(all.nome)} ${all.minuti ? `fra ${all.minuti} min` : 'adesso'} ` +
          `(${all.scarto < 1 ? all.scarto.toFixed(2) : all.scarto.toFixed(1)}°)</p>` : '') + '</button>';
    }).join('');
  }

  function puntaAereoDalPannello(id) {
    const a = aereiTrova(id);
    if (!a) return;
    aereiImpostaVisibili(true);
    if (typeof skyMostraGruppo === 'function') skyMostraGruppo('');
    if (typeof skyCentraSu === 'function') skyCentraSu({ ...a, nome: a.callsign || a.registrazione || 'L’aereo' });
    const canvas = document.getElementById('skymap-canvas');
    if (canvas && typeof canvas.focus === 'function') canvas.focus({ preventScroll: true });
  }

  // =====================================================================
  // 6. IL MOTORE: scaricare, riprovare, tenere il ritmo
  // =====================================================================

  // Il ritmo si adatta a chi guarda, e a chi risponde:
  //   · triangoli accesi e planetario aperto → `AGGIORNA_VISIBILE_MS`;
  //   · dati in memoria senza disegno → `AGGIORNA_SFONDO_MS`;
  //   · scheda in secondo piano → niente (il battito esce, §6);
  //   · dati spenti → niente;
  //   · una porta ci ha chiesto di rallentare da poco → il doppio, finché
  //     `FRENO_LIMITE_MS` non è passato.
  function intervalloAggiornamento() {
    const inVista = stato.visibile && typeof sky !== 'undefined' && sky.aperto;
    const base = inVista ? AGGIORNA_VISIBILE_MS : AGGIORNA_SFONDO_MS;
    const frenato = stato.ultimoLimite && Date.now() - stato.ultimoLimite < FRENO_LIMITE_MS;
    return frenato ? base * 2 : base;
  }

  function pianificaProssimo(riuscito, guaio) {
    const ora = Date.now();
    if (riuscito) {
      stato.tentativiFalliti = 0;
      stato.prossimoTentativo = 0;
      stato.prossimoAggiornamento = ora + intervalloAggiornamento();
      return;
    }
    // Da che gradino della scala si riparte. Per un guasto qualunque dal
    // primo, salendo di uno a ogni no; per un 429 o un 503 da
    // `RIPROVA_LIMITE_DA`, perché lì la riprova corta non è una cura — è la
    // causa, ripetuta. Il `max` e non un'assegnazione secca: chi ha già
    // sbagliato sei volte non deve **scendere** di gradino solo perché
    // l'ultimo no era un 429.
    const daCapo = guaio && guaio.rateLimit ? RIPROVA_LIMITE_DA : 0;
    const i = Math.min(Math.max(daCapo, stato.tentativiFalliti), RIPROVE_MS.length - 1);
    // Un pizzico di casualità: più schede aperte sullo stesso computer, o più
    // telefoni sulla stessa rete, non devono ripartire tutti nello stesso
    // istante dopo un guasto comune — sarebbe la raffica che ha causato il
    // 429 di prima, ripetuta.
    let attesa = RIPROVE_MS[i] * (0.85 + Math.random() * 0.3);
    // E se il servizio ha detto fra quanto tornare, quella parola vale più
    // della nostra scala. È un massimo fra i due e non una sostituzione: non
    // si riprova mai prima di quando ce l'hanno chiesto, ma un `Retry-After`
    // di un secondo non può accorciare un rinvio che ci eravamo dati per
    // altre ragioni.
    if (guaio && Number.isFinite(guaio.riprovaFraMs)) {
      attesa = Math.max(attesa, guaio.riprovaFraMs);
    }
    stato.prossimoTentativo = ora + attesa;
    stato.prossimoAggiornamento = stato.prossimoTentativo;
  }

  // La risposta è arrivata ma non parla più di questo cielo: il punto di
  // vista è cambiato sotto mentre lei era per aria. Si butta lei, **non il
  // ritmo** — ed è la riga che mancava, con un sintomo che è l'opposto di
  // quello che sembra. Uscendo di lì senza riprogrammare,
  // `prossimoAggiornamento` resta quello di prima, cioè nel passato: è
  // proprio scaduto per far partire questa richiesta. Il battito allora
  // rilancia la corsa fra cinque secondi, e fra altri cinque, finché il punto
  // non si ferma. Non è un ciclo morto: è una **raffica a tutte le porte ogni
  // cinque secondi**, che è il modo più rapido di prendersi un 429 da tutte
  // insieme, mandarle tutte in penale e restare davvero senza aerei.
  //
  // La porta però ha risposto, e bene: il conto dei guasti si azzera come per
  // un successo. Quello che manca sono i dati di **qui**, quindi si richiede
  // presto, col pavimento di `AEREI_MOTO_MIN_MS` — la stessa regola con cui
  // `ricentraPresto` rende sopportabile il viaggio in macchina.
  function pianificaDopoScarto() {
    stato.tentativiFalliti = 0;
    stato.prossimoTentativo = 0;
    stato.prossimoAggiornamento = Date.now() + AEREI_MOTO_MIN_MS;
  }

  async function carica(forza, mostraFeedback) {
    if (mostraFeedback) {
      stato.feedbackRichiesto = true;
      feedbackAggiornamento(astroI18n.t('aerei.aggiornamentoInCorso'), false);
    }
    const concludiFeedback = (testo, errore) => {
      if (!stato.feedbackRichiesto) return;
      stato.feedbackRichiesto = false;
      feedbackAggiornamento(testo, true, errore);
    };
    if (!stato.dati && !forza) { aggiornaUI(); return; }
    const obs = osservatore();
    if (!obs) {
      concludiFeedback('Aggiornamento ADS-B non riuscito: serve una posizione.', true);
      aggiornaUI();
      return;
    }
    // I provider descrivono soltanto il presente. Lontano dall'ora reale si
    // conserva l'ultima fotografia e la si propaga, senza spacciare per dato
    // storico una nuova lettura appena ricevuta.
    if (!tempoReale()) {
      concludiFeedback('Dati ADS-B non aggiornati: torna ad Adesso per le posizioni in tempo reale.', true);
      aggiornaPosizioni(); render(); aggiornaUI(); return;
    }
    const ora = Date.now();
    if (!forza && ora < stato.prossimoAggiornamento) { aggiornaUI(); return; }
    if (stato.richiesta) return stato.richiesta;
    // Senza rete non si bussa: il browser risponderebbe con un guasto generico
    // e la pagella delle porte si riempirebbe di no che non parlano di loro.
    // L'evento `online` fa ripartire tutto (vedi in fondo al file).
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      stato.errore = 'senza rete'; stato.errNome = '';
      stato.tentativiFalliti++;
      pianificaProssimo(false, errNome('OfflineError', 'senza rete'));
      concludiFeedback('Aggiornamento ADS-B non riuscito: manca la connessione.', true);
      aggiornaUI();
      return;
    }
    stato.ultimoTentativo = ora;
    const controller = new AbortController();
    stato.controller = controller;
    // Da quando è in volo. Non è un dato di comodo: `stato.richiesta` non
    // nulla ferma sia `carica` sia il battito, quindi è l'unico stato di
    // questo modulo che, restando, lo spegne del tutto. Senza un'ora accanto,
    // una richiesta che non si chiude non si distingue da una appena partita.
    stato.richiestaDa = Date.now();
    aggiornaUI();
    // Da qui in giù il motore non sa quali porte esistono: chiede alla
    // facciata (§3-quinquies) e riceve record già normalizzati e fusi.
    stato.richiesta = acquisisci(obs, raggioKm(), controller.signal, { forza: !!forza })
      .then(risultato => {
        // Nel frattempo il planetario potrebbe essersi spostato. Solo un
        // **salto** però rende inutile la risposta: prima bastava un cambio
        // qualunque, e in macchina quel cambio arriva ogni sei secondi — cioè
        // ogni risposta che riusciva ad arrivare veniva buttata sul traguardo,
        // dopo aver pagato per intero il tempo di scaricarla. Muovendosi la
        // risposta si tiene: le coordinate si rifanno dal punto di adesso.
        const adesso = osservatore();
        if (!adesso || distanzaDirezione(obs, adesso).km > saltoCentroKm()) {
          pianificaDopoScarto();
          return;
        }
        registraTracce(risultato.aerei);
        stato.aerei = arricchisci(unisciConLaMemoria(risultato.aerei), obs);
        stato.ultimiVisti = new Set(risultato.aerei.map(a => String(a.id)));
        stato.ultimoCentro = obs;
        stato.ultimoSuccesso = Date.now();
        stato.ultimaFonte = dettagliFonte.get(risultato.provider.nome)
          ? `${risultato.provider.nome} · ${dettagliFonte.get(risultato.provider.nome)}` : risultato.provider.nome;
        stato.ultimeFonti = risultato.fonti || [risultato.provider.nome];
        stato.vuotoIncerto = !!risultato.vuotoIncerto;
        if (risultato.aerei.length) stato.ultimoPieno = { quanti: risultato.aerei.length, quando: Date.now() };
        stato.errore = ''; stato.errNome = '';
        pianificaProssimo(true);
        render();
        // I transiti si rifanno **adesso**, non al prossimo giro del loro
        // orologio: la fotografia appena arrivata è quella che dice se
        // qualcuno sta per passare davanti al Sole, e aspettare i quattro
        // secondi del ritmo di serie vorrebbe dire buttarne quattro su un
        // preavviso che ne dura sessanta.
        if (typeof tranAggiorna === 'function') tranAggiorna(true);
        concludiFeedback(`Dati ADS-B aggiornati: ${stato.aerei.length} ` +
          `${stato.aerei.length === 1 ? 'aereo trovato' : 'aerei trovati'}.`, false);
      }).catch(e => {
        // Un abort voluto non è un guasto e non deve entrare nel conto delle
        // riprove: il feed spento, il ricentraggio che ne farà partire
        // un'altra subito, e — da quando `aereiFerma` chiude anche la
        // richiesta in volo — la vista chiusa. Senza quest'ultima, uscire dal
        // planetario mentre una corsa era per aria si scriveva in pagella
        // come una porta che non risponde, e al rientro si ripartiva da un
        // rinvio che nessuno si era guadagnato.
        if (e.name === 'AbortError' &&
            (!stato.dati || stato.ricaricaDopo || !stato.avviato)) return;
        // E una richiesta che il guardiano ha gia' dichiarato persa ha gia'
        // pagato il suo conto: segnarla di nuovo vorrebbe dire due gradini
        // di penale per un guasto solo, cioe' un feed che si allontana dalla
        // rete al doppio della velocita' prevista.
        if (stato.controller !== controller) return;
        stato.errore = e.message || 'guasto';
        stato.errNome = e.name || '';
        stato.tentativiFalliti++;
        if (e.rateLimit) stato.ultimoLimite = Date.now();
        pianificaProssimo(false, e);
        concludiFeedback(`Aggiornamento ADS-B non riuscito: ${guaioLeggibile()}.`, true);
      }).finally(() => {
        // Solo se la richiesta in corso siamo ancora **noi**. Il guardiano
        // della richiesta appesa puo' averci dichiarati persi e averne fatta
        // partire un'altra: azzerare qui alla cieca vorrebbe dire cancellare
        // il segno di quella, e far credere al battito che il campo sia
        // libero mentre una corsa e' per aria — cioe' due corse insieme, che
        // e' esattamente la raffica che tutto questo file esiste per evitare.
        if (stato.controller !== controller) return;
        stato.richiesta = null; stato.controller = null; stato.richiestaDa = 0;
        if (stato.ricaricaDopo) { stato.ricaricaDopo = false; carica(true); }
        else aggiornaUI();
      });
    return stato.richiesta;
  }

  // Un guasto dentro al battito si scrive **una volta sola per posto**. Il
  // ciclo gira dodici volte al minuto: la stessa riga rossa ripetuta
  // all'infinito seppellisce proprio quella che spiegava com'era cominciata.
  // È la regola che `skyGuastoFotogramma` applica già al ciclo di disegno del
  // planetario, per la stessa ragione.
  const guastiDetti = new Set();
  function dilloUnaVolta(dove, e) {
    if (guastiDetti.has(dove)) return;
    guastiDetti.add(dove);
    console.error(`[aerei] guasto nel battito (${dove}) — il ciclo prosegue`, e);
  }
  function guardato(dove, fn) {
    try { return fn(); } catch (e) { dilloUnaVolta(dove, e); return undefined; }
  }

  // La fotografia troppo vecchia non si propaga più: mezz'ora di rotta
  // stimata non è un aereo, è un disegno.
  function scartaFotografiaScaduta() {
    if (!stato.ultimoSuccesso) return;
    if (Date.now() - stato.ultimoSuccesso <= DATI_SCADUTI_MS || !stato.aerei.length) return;
    stato.aerei = [];
    render();
  }

  // Il primo guardiano: la **richiesta appesa**. La corsa ha una sveglia sua
  // (`CORSA_ATTESA_MS`) e in condizioni normali basta e avanza. Ma un
  // provider fornito da fuori (`window.AEREI_PROVIDER`) non è tenuto ad
  // averla, e una promessa che per qualunque ragione non si chiude lascia
  // `stato.richiesta` piena per sempre — e con lei piena `carica` esce
  // subito, il battito esce subito, e il feed è fermo senza un errore da
  // nessuna parte: la spia resta sull'azzurro di «sto scaricando» e il cielo
  // su quello di cinque minuti fa. Qui non si crede alle promesse, si
  // guarda l'orologio: oltre il doppio della corsa non sta arrivando niente,
  // sta solo tenendo chiusa la porta a tutte le richieste successive.
  function sorvegliaRichiesta() {
    if (!stato.richiesta || !stato.richiestaDa) return;
    if (Date.now() - stato.richiestaDa < RICHIESTA_APPESA_MS) return;
    try { if (stato.controller) stato.controller.abort(); } catch (e) { /* già chiusa */ }
    stato.richiesta = null; stato.controller = null; stato.richiestaDa = 0;
    stato.errore = 'richiesta senza risposta'; stato.errNome = 'TimeoutError';
    stato.tentativiFalliti++;
    pianificaProssimo(false);
  }

  // Il battito: un confronto fra due numeri ogni cinque secondi. Costa meno
  // di niente e sopravvive a quello che un `setInterval` da cinque minuti non
  // sopravvive — un telefono che manda l'app in secondo piano strozza o salta
  // i timer lunghi, e al ritorno il prossimo scarico sarebbe fra un'era.
  //
  // L'ordine delle righe qui dentro **non è un dettaglio di stile**, ed è la
  // correzione che spiega la segnalazione «il primo caricamento va, i
  // successivi no». Il primo scarico parte da `aereiAvvia`, fuori di qui;
  // tutti gli altri dipendono dall'ultima riga di questa funzione. E le prime
  // righe erano proprio le uniche che toccano il documento — il pannello, la
  // riga di stato, il disegno —, cioè le uniche che possano sollevare per un
  // nodo che non c'è, una chiave di dizionario mancante o una scheda a metà.
  // Una di quelle eccezioni non saltava un giro: li saltava **tutti**, per
  // sempre, perché il `setInterval` continuava a battere e nessun battito
  // arrivava più in fondo. Nessun errore visibile, nessuna spia rossa: solo
  // un cielo che non si aggiornava.
  //
  // La cura non è «non sollevare»: è che quello che solleva non possa
  // portarsi via il resto. Le tre righe del documento stanno dentro a una
  // rete, e la decisione di riscaricare — che è la ragione per cui questa
  // funzione esiste — viene dopo e non dipende da loro.
  function battito() {
    stato.ultimoBattito = Date.now();
    guardato('pannello', aggiornaUI);
    guardato('scadute', scartaFotografiaScaduta);
    guardato('appesa', sorvegliaRichiesta);
    if (!stato.dati || !stato.auto) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (stato.richiesta || !tempoReale()) return;
    if (Date.now() < stato.prossimoAggiornamento) return;
    // `carica` si tiene i suoi guasti in un `catch` suo; ma se un giorno uno
    // le sfuggisse diventerebbe una promessa rifiutata che non ascolta
    // nessuno — rumore in console e, peggio, un guasto che non entra nel
    // conto delle riprove. Il cerchio si chiude qui.
    const avvio = guardato('scarico', () => carica(false));
    if (avvio && typeof avvio.catch === 'function') {
      avvio.catch(e => dilloUnaVolta('scarico rifiutato', e));
    }
  }

  // Il secondo guardiano: il **ciclo che non batte più**. Un `setInterval`
  // non è una promessa. Un browser da telefono che congela la pagina — o che
  // la mette da parte per il tasto «indietro» — può non farlo ripartire al
  // ritorno, e allora `stato.timer` tiene un numero che non chiama più
  // nessuno: un ciclo morto che si dichiara vivo, che è il modo peggiore di
  // fermarsi perché nessuno lo va a riaccendere. È la stessa lezione di
  // `skyVigilaCicli` in `app.js` (§7.4-quinquies) e la cura è la stessa: non
  // si aspettano avvisi — su iOS il `visibilitychange` del ritorno spesso non
  // arriva affatto — si guardano i fatti, cioè l'ora dell'ultimo battito.
  function sorvegliaBattito() {
    if (!stato.avviato) return;
    if (stato.ultimoBattito && Date.now() - stato.ultimoBattito < BATTITO_FERMO_MS) return;
    clearInterval(stato.timer);
    stato.timer = setInterval(battito, BATTITO_MS);
    battito();
  }

  // Il ritorno in primo piano. È il momento in cui uno guarda, quindi non si
  // aspetta il giro del battito: una fotografia più vecchia di `RIENTRO_MS`
  // si rifà subito. Subito ma non a forza — il freno degli errori resta: se
  // una porta ci ha chiesto di aspettare, tornare su una scheda non è una
  // ragione per bussare prima del tempo.
  function aereiRientro() {
    guardato('rientro', aggiornaUI);
    if (!stato.avviato || !stato.dati || !stato.auto || !tempoReale()) return;
    if (stato.richiesta) return;
    if (Date.now() - stato.ultimoSuccesso <= RIENTRO_MS) return;
    stato.prossimoAggiornamento = Math.max(Date.now(), stato.prossimoTentativo || 0);
    if (Date.now() >= stato.prossimoAggiornamento) carica(false);
  }

  function aereiAvvia() {
    stato.avviato = true;
    stato.ultimoBattito = Date.now();
    if (!stato.timer) stato.timer = setInterval(battito, BATTITO_MS);
    if (stato.dati) carica(false);
    render();
    aggiornaUI();
  }

  function aereiFerma() {
    clearInterval(stato.timer);
    stato.timer = null;
    stato.avviato = false;
    // La richiesta in volo si abortisce invece di lasciarla correre: chiudere
    // il planetario vuol dire che quella risposta non la guarderà nessuno, e
    // lasciarla aperta significa tenere occupata una porta pubblica — e
    // ritrovarsi, riaprendo, un `stato.richiesta` pieno di una corsa
    // cominciata in un'altra vita della vista.
    if (stato.controller) {
      try { stato.controller.abort(); } catch (e) { /* già chiusa */ }
    }
  }

  // --- I due interruttori ---------------------------------------------
  // «Mostra in cielo» è disegno puro: non tocca il feed, quindi accendendolo
  // gli aerei ci sono già. «Dati ADS-B» è il feed: spegnerlo ferma le
  // richieste e — solo allora — svuota la fotografia, perché una fotografia
  // senza il suo orologio è la trappola che faceva credere per cinque minuti
  // che il cielo fosse sgombro.
  function aereiImpostaVisibili(visibili) {
    stato.visibile = !!visibili;
    preferenzeSalva();
    if (stato.visibile && stato.dati) {
      // Accendendo il disegno il ritmo si stringe: la fotografia buona per lo
      // sfondo non lo è più per qualcosa che si sta guardando.
      const limite = stato.ultimoSuccesso + AGGIORNA_VISIBILE_MS;
      if (stato.prossimoAggiornamento > limite) stato.prossimoAggiornamento = limite;
      if (!stato.ultimoSuccesso || Date.now() > limite) carica(false);
    }
    if (!stato.visibile && typeof skyChiudiDettaglio === 'function' && typeof sky !== 'undefined' &&
      sky.selezione && sky.selezione.categoria === 'aereo') skyChiudiDettaglio();
    render();
    aggiornaUI();
  }

  function aereiAlternaVisibili() { aereiImpostaVisibili(!stato.visibile); }

  function aereiImpostaDati(attivi) {
    stato.dati = !!attivi;
    preferenzeSalva();
    if (stato.dati) {
      stato.tentativiFalliti = 0;
      stato.prossimoAggiornamento = 0;
      stato.prossimoTentativo = 0;
      stato.errore = '';
      if (stato.richiesta && stato.controller && stato.controller.signal.aborted) stato.ricaricaDopo = true;
      else carica(true);
    } else {
      stato.ricaricaDopo = false;
      if (stato.controller) stato.controller.abort();
      stato.aerei = [];
      // La fotografia e il suo orologio sono una cosa sola: lasciare valido il
      // secondo dopo aver vuotato la prima faceva saltare la richiesta alla
      // riaccensione e mostrava, per minuti, un falso «nessun aereo».
      stato.ultimoSuccesso = 0;
      stato.ultimoRenderSecondo = null;
      if (typeof skyChiudiDettaglio === 'function' && typeof sky !== 'undefined' &&
        sky.selezione && sky.selezione.categoria === 'aereo') skyChiudiDettaglio();
    }
    render();
    aggiornaUI();
  }

  function aereiAlternaDati() { aereiImpostaDati(!stato.dati); }

  function aereiImpostaAuto(attivo) {
    stato.auto = !!attivo;
    preferenzeSalva();
    if (stato.auto && stato.dati) stato.prossimoAggiornamento = Math.min(
      stato.prossimoAggiornamento, stato.ultimoSuccesso + intervalloAggiornamento());
    aggiornaUI();
  }

  function aereiAlternaAuto() { aereiImpostaAuto(!stato.auto); }

  // Il nome storico: prima accendeva feed e disegno insieme. Adesso è il solo
  // disegno, ma accende anche i dati se qualcuno li aveva messi in pausa —
  // chiedere di vedere gli aerei e ottenere un cielo vuoto sarebbe la
  // risposta sbagliata alla domanda giusta.
  function aereiImpostaAccesi(accesi) {
    if (accesi && !stato.dati) aereiImpostaDati(true);
    aereiImpostaVisibili(accesi);
  }

  function aereiAggiornaAdesso() {
    if (!stato.dati) aereiImpostaDati(true);
    stato.tentativiFalliti = 0;
    // Un secondo tocco durante una richiesta non deve andare perso: annulla
    // la fotografia in corso e ne programma subito una nuova.
    if (stato.richiesta && stato.controller) {
      stato.feedbackRichiesto = true;
      feedbackAggiornamento(astroI18n.t('aerei.aggiornamentoInCorso'), false);
      stato.ricaricaDopo = true;
      stato.controller.abort();
      return stato.richiesta;
    }
    return carica(true, true);
  }

  // =====================================================================
  // 7. IL DISEGNO
  //    Il colore non è decorazione: è la risposta a «quale mi passa sopra la
  //    testa». Prima erano tutti arancioni, e per sapere quale fosse vicino
  //    bisognava leggere i chilometri di ogni etichetta uno per uno — cioè
  //    fare a mente il lavoro che un colore fa da solo. Le fasce stanno in
  //    FASCE_DISTANZA e valgono dappertutto: simbolo, traiettoria, etichetta
  //    ed elenco del pannello, così quello che si tocca in cielo si ritrova
  //    nella lista senza doverlo cercare per nome.
  //    L'allineamento con un astro resta un segnale a parte — un anello
  //    bianco attorno al simbolo — proprio perché il colore ha già un
  //    mestiere: tingerlo di giallo, come si faceva, voleva dire dichiarare
  //    che quell'aereo è a venti chilometri quando magari è a due.
  // =====================================================================

  // --- In controluce ---------------------------------------------------
  //
  // Il nero della silhouette. Non è `#000` per capriccio tipografico: un
  // aereo davanti al Sole è illuminato **da dietro**, e quello che ne arriva
  // qui è solo il poco di cielo diffuso attorno al suo bordo. Sulle
  // fotografie vere è nero pieno, e mettere un grigio «per non essere
  // troppo duri» toglierebbe l'unica cosa che rende riconoscibile un
  // transito: che il contorno è **netto**.
  const COLORE_SILHOUETTE = '#04070d';

  // Quanto ci si crede, minuto per minuto. Piena dentro alla previsione
  // corta di sempre, poi cala fino a un quarto al capolinea dell'arco. La
  // curva è quella dell'errore: lo scarto di traverso cresce **linearmente**
  // col tempo (rotta sbagliata × tempo), quindi la fiducia va come il suo
  // reciproco, e non a gradini — un gradino direbbe che al minuto sei si sa
  // qualcosa che al minuto cinque e mezzo non si sapeva.
  function fiduciaArco(minuti) {
    if (!(minuti > PREVISIONE_MINUTI)) return 1;
    const oltre = (minuti - PREVISIONE_MINUTI) / (AEREI_ARCO_MAX_MIN - PREVISIONE_MINUTI);
    return Math.max(0.22, 1 / (1 + 3.2 * Math.max(0, Math.min(1, oltre))));
  }

  // C'è un disco luminoso sotto a questo punto dello schermo? La risposta la
  // sa `app.js`, che ha appena disegnato Sole e Luna e sa dove sono finiti e
  // quanto sono grandi. Qui si chiede e basta, con la solita guardia: senza
  // quella funzione gli aerei si disegnano come prima.
  function discoSotto(px, py) {
    return typeof skyDiscoDavanti === 'function' ? skyDiscoDavanti(px, py) : null;
  }

  // Di quanto va ingrandito il simbolo perché sia grande quanto l'aereo è
  // davvero. Uno vuol dire «l'icona di sempre»: è il caso normale, e a campo
  // largo resta uno per qualunque aereo. Il tetto serve solo a non far
  // esplodere il disegno quando un aereo passa a duecento metri sopra la
  // testa con il campo a un quarto di grado.
  function misuraAereo(a, p, focale) {
    if (typeof skyRaggioAngolare !== 'function' || !focale) return 1;
    const km = Math.max(0.05, a.distanzaKm || 10);
    const mezzaApertura = Math.atan2(AEREI_APERTURA_M / 2000, km) * 180 / Math.PI;
    const scala = typeof skyScalaLocale === 'function' ? skyScalaLocale(p.d) : 1;
    const raggioPx = skyRaggioAngolare(mezzaApertura, focale) * scala;
    // Sette pixel è la mezza altezza del triangolo di base: è quella la
    // misura da confrontare, se no il simbolo cambierebbe taglia dove non
    // deve.
    return Math.max(1, Math.min(40, raggioPx / 7));
  }

  function aereiDisegna(ctx, base, focale) {
    hitEtichette.length = 0;
    if (!stato.visibile || !stato.aerei.length || typeof skyProietta !== 'function') return;
    // Muovendosi non si smette di disegnare: le coordinate si rifanno da capo
    // dal punto in cui si è adesso, e sono quelle giuste. Solo un salto vero
    // — un'altra città scelta nel pannello Tempo e luogo — butta la
    // fotografia, e allora per un fotogramma non c'è niente da disegnare.
    if (centroAltrove()) { aereiPosizioneCambiata(); return; }
    aggiornaPosizioni();
    aggiornaAllineamenti();
    const secondo = Math.floor(istanteMostratoMs() / 1000);
    if (secondo !== stato.ultimoRenderSecondo) {
      stato.ultimoRenderSecondo = secondo;
      render();
    }
    // Una fotografia vecchia continua a essere propagata, ma il disegno lo
    // deve dire: mezzo velo su tutto lo strato è il modo in cui una carta
    // distingue un dato misurato da uno stimato, senza scrivere una parola.
    const eta = stato.ultimoSuccesso ? Date.now() - stato.ultimoSuccesso : 0;
    const fresco = !stato.ultimoSuccesso || eta <= DATI_VECCHI_MS;
    ctx.save();
    if (!fresco) ctx.globalAlpha = 0.62;
    stato.aerei.forEach(a => {
      // Il minuto viaggia col punto e non con l'indice: i punti dietro
      // all'osservatore vengono scartati, quindi dopo il filtro la posizione
      // nell'array non dice piu' a che minuto corrisponde. Una tacca appesa
      // all'indice sbagliato e' peggio di nessuna tacca — dice un'ora falsa
      // con la stessa faccia con cui direbbe quella giusta.
      const punti = a.traiettoria.map(t => ({
        ...skyProietta(skyVettore(t.az, t.alt), base, focale),
        minuti: t.minuti, tacca: t.tacca, lungo: t.oltreLaFiducia, tramonto: t.tramonto
      })).filter(p => p.davanti);
      if (!punti.length) return;
      const fascia = fasciaDi(a.distanzaKm);
      // Il velo della sua età (§3-quinquies): un dato vivo pieno, uno
      // interpolato appena smorzato, uno stantio a metà — lo stesso
      // linguaggio con cui lo strato intero dice «fotografia vecchia», ma
      // aereo per aereo: dopo una fusione, nella stessa fotografia convivono
      // letture di adesso e letture di un minuto fa.
      const velo = a.qualita === 'stantio' ? 0.5 : a.qualita === 'interpolato' ? 0.85 : 1;

      // La riga della previsione, segmento per segmento. Due cose la
      // distinguono da quella di prima, e sono le due cose che l'arco lungo
      // ha portato con sé.
      //
      // La **fiducia che cala**: oltre i cinque minuti il tratto si
      // assottiglia e sbiadisce (`fiduciaArco`). Non è una sfumatura
      // decorativa: è l'unica cosa onesta da fare con una riga che al minuto
      // venti può essere sei chilometri più in là. Disegnare l'arco intero
      // con lo stesso tratto dei primi trenta secondi vorrebbe dire
      // promettere venticinque minuti di rotta a un aereo che ne ha
      // dichiarata una sola, adesso.
      //
      // E la **silhouette**: dove il tratto passa sopra al disco del Sole o
      // della Luna diventa scuro. Un tratteggio arancione sopra la
      // fotosfera è la stessa bruttura di un nome di paese dipinto sopra
      // alla collina — e soprattutto è falso: lì davanti, in controluce, non
      // c'è niente di arancione.
      ctx.setLineDash([4, 5]);
      for (let i = 1; i < punti.length; i++) {
        const q0 = punti[i - 1], q1 = punti[i];
        const sopraDisco = discoSotto((q0.px + q1.px) / 2, (q0.py + q1.py) / 2);
        const f = fiduciaArco(q1.minuti);
        ctx.globalAlpha = (fresco ? 0.85 : 0.55) * f * velo;
        ctx.strokeStyle = sopraDisco ? COLORE_SILHOUETTE : fascia.colore;
        ctx.lineWidth = 1.4 * (0.55 + 0.45 * f);
        ctx.beginPath(); ctx.moveTo(q0.px, q0.py); ctx.lineTo(q1.px, q1.py); ctx.stroke();
      }

      // Le tacche dei minuti. Un tratteggio uniforme dice «va di la'», e basta:
      // per leggerlo come una **previsione** serve sapere dove sara' fra
      // quanto, ed e' la stessa scelta che la traccia degli astri fa gia'
      // segnando le ore (SKY_TRACCIA_ORE in app.js). Da qui si vede a colpo
      // d'occhio anche la velocita': tacche fitte, aereo lento; tacche larghe,
      // aereo veloce — senza leggere nessun numero.
      //
      // Si disegnano solo se la corsa sullo schermo e' abbastanza lunga da
      // separarle: sotto quella soglia sei pallini a un pixel l'uno dall'altro
      // non sono cinque minuti, sono un tratto piu' spesso.
      const testa = punti[0], coda = punti[punti.length - 1];
      const corsaPx = Math.hypot(coda.px - testa.px, coda.py - testa.py);
      if (corsaPx >= AEREI_TACCHE_PX_MIN) {
        ctx.setLineDash([]);
        punti.forEach(p => {
          if (!p.tacca) return;                        // lo zero ce l'ha gia' il simbolo
          const capolinea = p.minuti === PREVISIONE_MINUTI;
          ctx.beginPath();
          ctx.arc(p.px, p.py, capolinea ? 2.6 : 1.6, 0, Math.PI * 2);
          ctx.fillStyle = discoSotto(p.px, p.py) ? COLORE_SILHOUETTE : fascia.colore;
          ctx.globalAlpha = (fresco ? 0.9 : 0.5) * (capolinea ? 1 : 0.75) * fiduciaArco(p.minuti) * velo;
          ctx.fill();
        });
        // I numeri: il capolinea della previsione corta, che è il riferimento
        // a cui appendere le tacche in mezzo, e la **fine dell'arco**, che è
        // la notizia nuova — «da qui in poi non lo vedi più», oppure «da qui
        // in poi non lo so più». Due etichette e non venticinque: una per
        // ogni tacca sarebbe un elenco da leggere, non un colpo d'occhio.
        if (corsaPx >= AEREI_ETICHETTA_PX_MIN) {
          ctx.font = '600 9px system-ui';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
          ctx.strokeStyle = 'rgba(2,6,23,.85)';
          const cinque = punti.find(p => p.minuti === PREVISIONE_MINUTI);
          if (cinque) {
            ctx.globalAlpha = (fresco ? 0.85 : 0.5) * velo;
            ctx.fillStyle = '#fff7ed';
            ctx.strokeText(`+${PREVISIONE_MINUTI}′`, cinque.px, cinque.py - 8);
            ctx.fillText(`+${PREVISIONE_MINUTI}′`, cinque.px, cinque.py - 8);
          }
          if (coda !== cinque && coda.minuti > PREVISIONE_MINUTI + 1 &&
              Math.hypot(coda.px - (cinque ? cinque.px : testa.px),
                         coda.py - (cinque ? cinque.py : testa.py)) >= AEREI_ETICHETTA_PX_MIN) {
            const testo = coda.tramonto ? `tramonta +${Math.round(coda.minuti)}′`
                                        : `+${Math.round(coda.minuti)}′`;
            ctx.globalAlpha = (fresco ? 0.8 : 0.5) * fiduciaArco(coda.minuti) * velo;
            ctx.fillStyle = '#fff7ed';
            ctx.strokeText(testo, coda.px, coda.py - 8);
            ctx.fillText(testo, coda.px, coda.py - 8);
          }
          ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        }
      }
      ctx.globalAlpha = (fresco ? 1 : 0.62) * velo;
      const p = punti[0]; ctx.setLineDash([]);
      // Il muso segue la rotta proiettata sullo schermo. Il triangolo di base
      // guarda verso l'alto, quindi l'angolo della prima porzione visibile
      // della previsione va aumentato di 90 gradi. Usare la traiettoria, e non
      // direttamente l'heading in gradi, tiene conto anche della prospettiva
      // del planetario e dell'inclinazione del telefono.
      const avanti = punti.slice(1).find(q => Math.hypot(q.px - p.px, q.py - p.py) > .5);
      const angolo = avanti ? Math.atan2(avanti.py - p.py, avanti.px - p.px) + Math.PI / 2 : 0;

      // Quanto è grande davvero. A dieci chilometri un'apertura alare di
      // quaranta metri è un decimo di grado, cioè un pixel: vince l'icona, e
      // a campo largo non cambia niente rispetto a prima. Ma a due
      // chilometri sono più di un grado — **il doppio del Sole** — e
      // ingrandendo sul disco quello che si deve vedere è una sagoma che lo
      // copre, non un triangolino di sette pixel appoggiato sopra. È la
      // stessa regola dei pianeti (`skyRaggio`: il massimo fra l'icona e il
      // disco vero), applicata all'unico oggetto del cielo che di solito è
      // più vicino di tutti.
      const misura = misuraAereo(a, p, focale);
      const disco = discoSotto(p.px, p.py);
      ctx.save();
      ctx.translate(p.px, p.py); ctx.rotate(angolo);
      ctx.scale(misura, misura);
      if (disco) {
        // In controluce non c'è colore e non c'è contorno: c'è un buco nella
        // luce. Il contorno scuro che serve sul cielo — dove un triangolo
        // rosso su un tramonto rosso sparisce — qui sarebbe un alone attorno
        // a una cosa già nera, cioè l'unico modo di rendere sfocata la sola
        // silhouette netta che questo cielo abbia.
        ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 5); ctx.lineTo(0, 2); ctx.lineTo(-6, 5); ctx.closePath();
        ctx.fillStyle = COLORE_SILHOUETTE; ctx.fill();
      } else {
        // Il contorno scuro sotto al simbolo è la stessa ricetta dei nomi delle
        // montagne: un triangolo rosso su un tramonto rosso non si vede, e sul
        // cielo di mezzogiorno nemmeno un azzurro.
        ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 5); ctx.lineTo(0, 2); ctx.lineTo(-6, 5); ctx.closePath();
        ctx.strokeStyle = 'rgba(2,6,23,.85)'; ctx.lineWidth = 2.6 / misura; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.fillStyle = fascia.colore; ctx.fill();
      }
      ctx.restore();
      if (a.allineamenti.length) {
        // L'anello resta fuori dalla scala del simbolo: dice «guarda qui», e
        // un segno che dice «guarda qui» non deve diventare grande insieme
        // alla cosa che indica, se no smette di indicarla.
        ctx.save();
        ctx.translate(p.px, p.py);
        ctx.beginPath(); ctx.arc(0, 0, Math.max(11, 8 * misura), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      }
      const etichetta = `${a.callsign} · ${a.distanzaKm.toFixed(1)} km`;
      ctx.font = '700 11px system-ui';
      const x = p.px + 9, y = p.py - 7, larghezza = ctx.measureText(etichetta).width + 10;
      ctx.fillStyle = 'rgba(8,25,45,.90)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, larghezza, 18, 5);
      else ctx.rect(x, y, larghezza, 18);
      ctx.fill();
      // Il filo di colore lungo il bordo sinistro: l'etichetta resta leggibile
      // (fondo scuro, testo chiaro) e porta comunque con sé la fascia, che è
      // quello che si guarda quando i triangoli sono tanti e piccoli.
      ctx.fillStyle = fascia.colore;
      ctx.fillRect(x, y + 2, 2.5, 14);
      ctx.fillStyle = '#fff7ed'; ctx.fillText(etichetta, x + 7, y + 12.5);
      hitEtichette.push({ x, y, larghezza, altezza: 18, aereo: a });
    });
    ctx.restore();
  }

  function aereoNelPunto(px, py, base, focale) {
    if (!stato.visibile || typeof skyProietta !== 'function') return null;
    aggiornaPosizioni();
    const etichetta = hitEtichette.slice().reverse().find(h =>
      px >= h.x - 4 && px <= h.x + h.larghezza + 4 && py >= h.y - 5 && py <= h.y + h.altezza + 5);
    if (etichetta) return etichetta.aereo;
    let migliore = null;
    stato.aerei.forEach(a => {
      const p = skyProietta(skyVettore(a.az, a.alt), base, focale);
      if (!p.davanti) return;
      const distanza = Math.hypot(p.px - px, p.py - py);
      if (distanza <= 24 && (!migliore || distanza < migliore.distanza)) migliore = { distanza, aereo: a };
    });
    return migliore && migliore.aereo;
  }

  // Le voci della scheda, in ordine, ognuna con la sua **chiave**: è quella
  // che permette di ritrovarle nel documento e riscriverne il solo valore.
  // L'itinerario non ha un valore qui perché non viene dal feed: arriva dalla
  // rete e se lo scrive da sé (`aereiCaricaRotta`), quindi qui è solo il posto
  // che gli si tiene, con dentro la scritta d'attesa.
  function aereiVociScheda(a) {
    // `toLocaleString('it-IT')` era il separatore dei migliaia inchiodato
    // all'italiano: undicimila metri si scrivono «11.000» qui e «11,000» in
    // inglese, ed è il genere di dettaglio per cui una traduzione si vede.
    const quota = Number.isFinite(a.quotaM)
      ? `${astroI18n.numero(Math.round(a.quotaM))} m` : astroI18n.t('aereo.nonComunicata');
    const velocita = Number.isFinite(a.velocitaMs)
      ? `${astroI18n.numero(Math.round(a.velocitaMs * 3.6))} km/h` : astroI18n.t('aereo.nonComunicata');
    // `chiave` è l'identificativo della riga (lo legge `data-vivo`, e non deve
    // cambiare mai); `nome` è la sua etichetta, e quella viene dal dizionario.
    // Tenerle separate è la ragione per cui la scorciatoia che riscrive i soli
    // valori continua a funzionare in tutte le lingue.
    const E = (k) => astroI18n.t('aereo.' + k);
    return [
      { chiave: 'volo', nome: E('volo'), valore: a.callsign },
      { chiave: 'registrazione', nome: E('registrazione'), valore: a.registrazione },
      { chiave: 'aeromobile', nome: E('aeromobile'), valore: a.descrizione || a.tipoIcao },
      { chiave: 'operatore', nome: E('operatore'), valore: a.operatore },
      { chiave: 'quota', nome: E('quota'), valore: quota },
      { chiave: 'velocita', nome: E('velocita'), valore: velocita },
      { chiave: 'direzione', nome: E('rotta'), valore: Number.isFinite(a.direzione) ? `${Math.round(a.direzione)}°` : '' },
      { chiave: 'distanza', nome: E('distanza'), valore: Number.isFinite(a.distanzaKm) ? `${astroI18n.numero(a.distanzaKm, 1)} km` : '' },
      // Per quanto ancora si vede. È la domanda che uno si fa davvero
      // guardando un aereo — «faccio in tempo a prendere il binocolo?» — e
      // fino a quando l'arco si fermava a cinque minuti non c'era nessuna
      // riga che potesse rispondere. La differenza fra le due risposte non è
      // una sfumatura: «tramonta fra 6 minuti» è una previsione, «lo seguo
      // per 25 minuti» è il punto in cui abbiamo smesso di guardare.
      { chiave: 'arco', nome: E('inVista'), valore: aereiTestoArco(a.arco) },
      { chiave: 'itinerario', nome: E('itinerario'), dallaRete: true },
      { chiave: 'icao', nome: E('icao'), valore: String(a.id || '').toUpperCase() },
      { chiave: 'squawk', nome: E('squawk'), valore: a.squawk }
    ].filter(v => v.dallaRete || v.valore);
  }

  function aereiTestoArco(arco) {
    if (!arco || !Number.isFinite(arco.minutiResidui)) return '';
    const m = arco.minutiResidui;
    const quanto = m < 1
      ? astroI18n.t('tempo.unitaSecondi', { n: Math.round(m * 60) })
      : astroI18n.t('tempo.unitaMinuti', { n: Math.round(m) });
    const alto = Number.isFinite(arco.altMax)
      ? astroI18n.t('aereo.finoAAltezza', { gradi: Math.round(arco.altMax) }) : '';
    return astroI18n.t(arco.tramonta ? 'aereo.ancoraPoiTramonta' : 'aereo.almeno',
      { quanto, alto });
  }

  function aereiNotaScheda(a) {
    return astroI18n.t(a.stimato ? 'aereo.posizioneStimata' : 'aereo.posizioneAllineata');
  }

  function aereiSchedaHtml(a) {
    const fascia = fasciaDi(a.distanzaKm);
    return `<div class="scheda-testata"><h3>✈ ${sicuro(a.callsign || a.id)}</h3></div>` +
      `<p class="aereo-fascia" style="--fascia:${fascia.colore}">` +
      `<span class="aereo-pallino" aria-hidden="true"></span>` +
      `<span data-vivo="fascia">${sicuro(fascia.nome)}</span></p>` +
      `<div id="aereo-foto-${sicuro(a.id)}"></div><ul>` +
      aereiVociScheda(a).map(v => v.dallaRete
        ? `<li id="aereo-rotta-${sicuro(a.id)}"><span class="voce-dato">${v.nome}:</span> ${astroI18n.t('aereo.ricercaInCorso')}</li>`
        : `<li><span class="voce-dato">${v.nome}:</span> <span data-vivo="${v.chiave}">${sicuro(v.valore)}</span></li>`).join('') +
      '</ul>' +
      `<div class="aereo-azioni"><button type="button" class="tasto-cielo aereo-mappa" data-aereo-id="${sicuro(a.id)}">${astroI18n.t('aereo.tracciaSullaMappa')}</button></div>` +
      `<p class="nota-dettaglio" data-vivo="nota">${aereiNotaScheda(a)}</p>`;
  }

  // Riscrive i **soli valori** della scheda già a schermo, senza toccarne la
  // struttura. Risponde `false` quando non se ne può occupare — la scheda che
  // c'è è di un altro aereo, o ha cambiato forma perché una voce è comparsa o
  // sparita — e allora tocca a chi chiama rifarla da capo.
  //
  // È la cura del difetto che si vedeva così: aperta la scheda di un aereo,
  // lo scorrimento saltellava una volta al secondo. La scheda si riscriveva
  // tutta a ogni aggiornamento, e nel rifarla si buttavano via anche le due
  // cose che arrivano dalla rete — la foto e l'itinerario — che tornavano
  // solo un istante dopo: ogni secondo la scheda si accorciava di duecento
  // pixel e si riallungava. Nel momento in cui era corta lo scorrimento
  // veniva **tosato** dall'altezza, quindi nessun ripristino poteva più
  // rimetterlo dov'era: chi stava leggendo in fondo si vedeva la scheda
  // scivolare verso l'alto a ogni battito. La cura non è ripristinare meglio,
  // è non buttare via niente: cinque numeri che cambiano non sono una scheda
  // nuova.
  function aereiAggiornaSchedaViva(a) {
    if (!a) return false;
    const corpo = document.getElementById('skymap-dettaglio-corpo');
    if (!corpo) return false;
    // Una scheda scritta in un'altra lingua non è la stessa scheda: le chiavi
    // di `data-vivo` sono identificatori, quindi la forma combacerebbe e si
    // riscriverebbero i soli numeri, lasciando le etichette come stavano.
    if (corpo.dataset.lingua && corpo.dataset.lingua !== astroI18n.getLanguage()) return false;
    // L'aereo si riconosce dal riquadro della foto, che c'è sempre e porta il
    // suo identificativo: nessun marchio da tenere allineato a parte.
    const foto = corpo.querySelector('[id^="aereo-foto-"]');
    if (!foto || foto.id !== `aereo-foto-${a.id}`) return false;

    const voci = aereiVociScheda(a).filter(v => !v.dallaRete);
    const presenti = Array.from(corpo.querySelectorAll('[data-vivo]')).map(n => n.dataset.vivo);
    const attese = ['fascia', ...voci.map(v => v.chiave), 'nota'];
    if (presenti.join(',') !== attese.join(',')) return false;

    const scrivi = (chiave, testo) => {
      const nodo = corpo.querySelector(`[data-vivo="${chiave}"]`);
      if (nodo && nodo.textContent !== testo) nodo.textContent = testo;
    };
    const fascia = fasciaDi(a.distanzaKm);
    const riga = corpo.querySelector('.aereo-fascia');
    if (riga) riga.style.setProperty('--fascia', fascia.colore);
    scrivi('fascia', fascia.nome);
    voci.forEach(v => scrivi(v.chiave, String(v.valore)));
    scrivi('nota', aereiNotaScheda(a));
    return true;
  }

  function aereiTrova(id) {
    return stato.aerei.find(a => String(a.id) === String(id)) || null;
  }

  function aereiAlternaTracking(id) {
    const aereo = aereiTrova(id);
    if (!aereo || typeof sky === 'undefined') return;
    // La selezione deve puntare alla fotografia più recente, non all'oggetto
    // del tocco iniziale: così l'inseguimento generico del planetario legge
    // azimut e altezza aggiornati a ogni fotogramma.
    sky.selezione = { categoria: 'aereo', dati: aereo };
    if (sky.sensori && sky.seguiTelefono) sky.seguiTelefono = false;
    if (typeof skyAlternaInseguimento === 'function') skyAlternaInseguimento();
    if (typeof skyAggiornaScheda === 'function') skyAggiornaScheda();
  }

  function chiudiMappaRotta() {
    const modale = document.getElementById('aereo-rotta-modale');
    if (modale) { modale.classList.remove('visibile'); modale.setAttribute('aria-hidden', 'true'); }
  }

  // Leaflet unisce due coordinate con un segmento diritto sulla proiezione
  // della carta. Per un volo lungo quello non e' il cammino piu' breve sulla
  // Terra: l'ortodromia e' un arco di cerchio massimo e, soprattutto alle
  // alte latitudini, deve incurvarsi visibilmente. La interpoliamo sulla sfera
  // in vettori cartesiani e la spezziamo all'antimeridiano, altrimenti Leaflet
  // disegnerebbe una falsa linea che attraversa tutta la carta.
  function puntiOrtodromia(partenza, arrivo) {
    if (!partenza || !arrivo) return [];
    const vettore = punto => {
      const lat = radianti(punto[0]), lon = radianti(punto[1]);
      return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
    };
    const a = vettore(partenza), b = vettore(arrivo);
    const prodotto = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const angolo = Math.acos(prodotto);
    const passi = Math.max(16, Math.ceil(angolo / radianti(2)));
    const seno = Math.sin(angolo);
    const segmenti = [[]];
    for (let i = 0; i <= passi; i++) {
      const t = i / passi;
      const p = seno > 1e-8
        ? a.map((v, j) => (Math.sin((1 - t) * angolo) * v + Math.sin(t * angolo) * b[j]) / seno)
        : a.map((v, j) => v * (1 - t) + b[j] * t);
      const punto = [gradi(Math.atan2(p[2], Math.hypot(p[0], p[1]))), limita180(gradi(Math.atan2(p[1], p[0])))];
      const segmento = segmenti[segmenti.length - 1];
      if (segmento.length && Math.abs(punto[1] - segmento[segmento.length - 1][1]) > 180) segmenti.push([]);
      segmenti[segmenti.length - 1].push(punto);
    }
    return segmenti.filter(segmento => segmento.length > 1);
  }

  async function aereiMostraMappa(id) {
    const a = aereiTrova(id);
    const modale = document.getElementById('aereo-rotta-modale');
    const carta = document.getElementById('aereo-rotta-mappa');
    const titolo = document.getElementById('aereo-rotta-titolo');
    if (!a || !modale || !carta) return;
    if (typeof L === 'undefined') { if (typeof skyAvviso === 'function') skyAvviso('aereo-mappa', astroI18n.t('aereo.cartaServeRete'), 6000); return; }
    if (titolo) titolo.textContent = astroI18n.t('aereo.tracciaAdsbDi',
      { volo: a.callsign || String(a.id).toUpperCase() });
    modale.classList.add('visibile'); modale.setAttribute('aria-hidden', 'false');
    if (!mappaRotta) {
      mappaRotta = L.map(carta, { zoomControl: true, maxZoom: 16 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 16, attribution: '&copy; OpenStreetMap'
      }).addTo(mappaRotta);
      if (typeof aggiungiControlloTemaMappa === 'function') {
        aggiungiControlloTemaMappa(mappaRotta, carta);
      }
    }
    stratiRotta.forEach(s => mappaRotta.removeLayer(s)); stratiRotta = [];
    const chiaveRotta = String(a.callsign || '').trim().replace(/\s+/g, '');
    const rotta = rottaCache.get(chiaveRotta);
    if (rotta && rotta.promessa && !rotta.valore) await rotta.promessa;
    const dettagli = rotta && rotta.valore;
    // La traccia ciano racconta dove l'aereo e' passato davvero; la linea blu
    // e' l'ortodromia, cioe' il percorso piu' corto sulla superficie terrestre
    // fra i due aeroporti, anche quando la sessione e' appena iniziata.
    const osservati = (tracce.get(String(a.id).toLowerCase()) || []).map(p => [p.lat, p.lon]);
    if (!osservati.length) osservati.push([a.lat, a.lon]);
    const previsti = [a, ...[1, 2, 3, 4, 5].map(m => posizioneFutura(a, m * 60))].map(p => [p.lat, p.lon]);
    if (osservati.length > 1) {
      stratiRotta.push(L.polyline(osservati, { color: '#22d3ee', weight: 4 }).addTo(mappaRotta));
    }
    stratiRotta.push(L.polyline(previsti, { color: '#fb923c', weight: 3, dashArray: '7 7' }).addTo(mappaRotta));
    stratiRotta.push(L.circleMarker([a.lat, a.lon], { radius: 8, color: '#fff', weight: 2,
      fillColor: fasciaDi(a.distanzaKm).colore, fillOpacity: 1 }).bindTooltip('Posizione attuale').addTo(mappaRotta));
    // I marcatori fissano gli estremi certi; la geometria che li unisce viene
    // calcolata sotto come ortodromia, non come segmento sulla carta.
    const itinerario = [];
    if (dettagli && dettagli.coordinatePartenza) {
      itinerario.push(dettagli.coordinatePartenza);
      stratiRotta.push(L.circleMarker(dettagli.coordinatePartenza,
        { radius: 6, color: '#166534', fillColor: '#22c55e', fillOpacity: 1 })
        .bindTooltip(`Partenza: ${dettagli.partenza}`).addTo(mappaRotta));
    }
    if (dettagli && dettagli.coordinateArrivo) {
      itinerario.push(dettagli.coordinateArrivo);
      stratiRotta.push(L.circleMarker(dettagli.coordinateArrivo,
        { radius: 6, color: '#991b1b', fillColor: '#ef4444', fillOpacity: 1 })
        .bindTooltip(`Arrivo: ${dettagli.arrivo}`).addTo(mappaRotta));
    }
    if (itinerario.length === 2) {
      stratiRotta.unshift(L.polyline(puntiOrtodromia(itinerario[0], itinerario[1]), {
        color: '#60a5fa', weight: 4, opacity: .9
      }).bindTooltip(astroI18n.t('aereo.rottaOrtodromica')).addTo(mappaRotta));
    }
    const nota = document.getElementById('aereo-rotta-nota');
    if (nota) nota.textContent = osservati.length > 1
      ? astroI18n.t('aereo.notaOsservate', { n: osservati.length })
      : astroI18n.t(itinerario.length === 2 ? 'aereo.notaOrtodromica' : 'aereo.notaNessuna');
    const tutti = itinerario.concat(osservati, previsti);
    requestAnimationFrame(() => { mappaRotta.invalidateSize(); mappaRotta.fitBounds(L.latLngBounds(tutti).pad(.25), { maxZoom: 13 }); });
  }

  const rottaCache = new Map();

  function aeroportoTesto(aeroporto) {
    if (!aeroporto) return '';
    const codice = aeroporto.iata_code || aeroporto.iata || aeroporto.icao_code || aeroporto.icao || '';
    const luogo = aeroporto.municipality || aeroporto.city || aeroporto.name || '';
    return [luogo, codice && `(${codice})`].filter(Boolean).join(' ');
  }

  function aeroportoCoordinate(aeroporto) {
    if (!aeroporto) return null;
    const lat = numero(aeroporto.latitude ?? aeroporto.lat);
    const lon = numero(aeroporto.longitude ?? aeroporto.lon ?? aeroporto.lng);
    return lat === null || lon === null ? null : [lat, lon];
  }

  function orarioRotta(rotta, prefisso) {
    const aeroporto = prefisso === 'departure' ? rotta.origin : rotta.destination;
    const valore = rotta[`${prefisso}_time`] || rotta[`scheduled_${prefisso}`] ||
      rotta[`${prefisso}_scheduled`] || rotta[prefisso] &&
      (rotta[prefisso].scheduled_time || rotta[prefisso].time || rotta[prefisso].scheduled) ||
      aeroporto && (aeroporto.scheduled_time || aeroporto.time || aeroporto.scheduled);
    if (!valore) return '';
    const data = new Date(valore);
    return isNaN(data.getTime()) ? String(valore) : data.toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

  function interpretaRotta(risposta) {
    const rotta = risposta && risposta.response && risposta.response.flightroute;
    if (!rotta) return null;
    return {
      partenza: aeroportoTesto(rotta.origin), arrivo: aeroportoTesto(rotta.destination),
      coordinatePartenza: aeroportoCoordinate(rotta.origin), coordinateArrivo: aeroportoCoordinate(rotta.destination),
      oraPartenza: orarioRotta(rotta, 'departure'), oraArrivo: orarioRotta(rotta, 'arrival')
    };
  }

  // La richiesta dell'itinerario, una sola per indicativo di volo. Stava
  // dentro a `aereiCaricaRotta`, che scrive dentro a un riquadro della scheda;
  // il fumetto un riquadro non ce l'ha — e la rotta la vuole **subito**, per
  // decidere se quella riga esiste — quindi la partenza della richiesta e la
  // scrittura del risultato sono adesso due cose separate.
  function chiediRotta(callsign) {
    if (rottaCache.has(callsign)) return rottaCache.get(callsign);
    const voce = { valore: null, pronta: false, promessa: null };
    voce.promessa = fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`,
      { cache: 'force-cache' }).then(r => r.ok ? r.json() : null).then(interpretaRotta).catch(() => null)
      .then(rotta => { voce.valore = rotta; voce.pronta = true; return rotta; });
    rottaCache.set(callsign, voce);
    return voce;
  }

  // Quello che si sa dell'itinerario **in questo istante**: chi legge non
  // aspetta, e alla lettura successiva (il fumetto si rinfresca due volte al
  // secondo) lo trova pronto. `pronta` distingue «non è ancora arrivato» da
  // «questo volo un itinerario pubblico non ce l'ha», che sono due frasi
  // diverse da dire a chi guarda.
  function aereiRottaOra(a) {
    const callsign = String(a && a.callsign || '').trim().replace(/\s+/g, '');
    if (!callsign) return { pronta: true, valore: null };
    const voce = chiediRotta(callsign);
    return { pronta: voce.pronta, valore: voce.valore };
  }

  const fotoFumettoCache = new Map();

  // La fotografia parte insieme al fumetto e non lo blocca. La cache conserva
  // anche l'esito negativo: mentre il fumetto si aggiorna due volte al secondo
  // non deve lanciare due richieste al secondo a Planespotters.
  function fotoFumettoOra(a) {
    const id = String(a && a.id || '').toLowerCase();
    if (!id) return null;
    if (!fotoFumettoCache.has(id)) {
      const voce = { pronta: false, valore: null };
      fotoFumettoCache.set(id, voce);
      fetch(`https://api.planespotters.net/pub/photos/hex/${encodeURIComponent(id)}`,
        { cache: 'force-cache' }).then(r => r.ok ? r.json() : null)
        .then(d => d && d.photos && d.photos[0]).catch(() => null).then(foto => {
          const img = foto && (foto.thumbnail_large || foto.thumbnail);
          voce.valore = img && img.src ? {
            src: img.src,
            credito: foto.photographer || '',
            alt: `Foto dell’aereo ${a.callsign || id}`
          } : null;
          voce.pronta = true;
        });
    }
    return fotoFumettoCache.get(id).valore;
  }

  // Nel fumetto l'aereo non e' una sigla seguita da numeri anonimi: ogni
  // dato ha il suo nome, l'aeromobile resta scritto per intero e partenza e
  // destinazione hanno due righe distinte.
  function aereiFumettoDati(a) {
    const righe = [];
    const metti = (chiave, etichetta, valore) => {
      if (valore) righe.push({ chiave, etichetta, valore });
    };

    const T = (k, v) => astroI18n.t('aereo.' + k, v);
    const ignoto = T('nonComunicata');
    const rotta = aereiRottaOra(a);
    if (rotta.valore && (rotta.valore.partenza || rotta.valore.arrivo)) {
      metti('partenza', T('partenza'), rotta.valore.partenza || ignoto);
      metti('destinazione', T('destinazione'), rotta.valore.arrivo || ignoto);
    } else if (!rotta.pronta) {
      metti('partenza', T('itinerario'), T('ricercaInCorso'));
    }

    metti('tipo', T('aereo'), a.descrizione || a.tipoIcao || ignoto);
    metti('quota', T('quota'), Number.isFinite(a.quotaM)
      ? T('metriSlm', { n: astroI18n.numero(Math.round(a.quotaM)) }) : ignoto);
    metti('velocita', T('velocita'), Number.isFinite(a.velocitaMs)
      ? `${astroI18n.numero(Math.round(a.velocitaMs * 3.6))} km/h` : ignoto);

    // Il `≈` dice in un carattere quello che la scheda completa dice in una
    // riga: questa posizione non è l'ultima lettura ADS-B, è quella lettura
    // portata avanti dalla rotta.
    if (Number.isFinite(a.distanzaKm)) {
      const dove = typeof skyNomeDirezione === 'function' && Number.isFinite(a.az)
        ? ` · ${skyNomeDirezione(a.az)}` : '';
      metti('distanza', T('distanzaReale'),
        `${a.stimato ? '≈ ' : ''}${astroI18n.numero(a.distanzaKm, 1)} km${dove}`);
    }

    return {
      chiave: `aereo:${a.id}`,
      segno: 'aereo',
      titolo: a.callsign || String(a.id || '').toUpperCase(),
      colore: fasciaDi(a.distanzaKm).colore,
      classe: 'fumetto-aereo',
      foto: fotoFumettoOra(a),
      righe
    };
  }

  async function aereiCaricaRotta(a) {
    const callsign = String(a.callsign || '').trim().replace(/\s+/g, '');
    const box = document.getElementById(`aereo-rotta-${a.id}`);
    if (!box || !callsign) return;
    const rotta = await chiediRotta(callsign).promessa;
    if (!box.isConnected) return;
    const pannello = box.closest('.pannello-dettaglio');
    const scorrimento = pannello && pannello.scrollTop;
    if (!rotta || (!rotta.partenza && !rotta.arrivo)) {
      box.innerHTML = `<span class="voce-dato">${astroI18n.t('aereo.itinerario')}:</span> ` +
        astroI18n.t('aereo.nonDisponibile');
      if (pannello) pannello.scrollTop = scorrimento;
      return;
    }
    const riga = (nome, valore) => valore
      ? `<div><span class="voce-dato">${nome}:</span> ${sicuro(valore)}</div>` : '';
    box.innerHTML = riga('Partenza', rotta.partenza) +
      riga('Orario di partenza', rotta.oraPartenza || 'non comunicato') +
      riga('Arrivo', rotta.arrivo) +
      riga('Orario di arrivo', rotta.oraArrivo || 'non comunicato');
    if (pannello) pannello.scrollTop = scorrimento;
  }

  const fotoCache = new Map();

  async function aereiCaricaFoto(a) {
    aereiCaricaRotta(a);
    const id = String(a.id || '').toLowerCase();
    const box = document.getElementById(`aereo-foto-${id}`) || document.getElementById(`aereo-foto-${a.id}`);
    if (!box || !id) return;
    if (!fotoCache.has(id)) {
      fotoCache.set(id, fetch(`https://api.planespotters.net/pub/photos/hex/${encodeURIComponent(id)}`, { cache: 'force-cache' })
        .then(r => r.ok ? r.json() : null).then(d => d && d.photos && d.photos[0]).catch(() => null));
    }
    const foto = await fotoCache.get(id);
    if (!foto || !box.isConnected) return;
    const img = foto.thumbnail_large || foto.thumbnail;
    if (!img || !img.src) return;
    const pannello = box.closest('.pannello-dettaglio');
    const scorrimento = pannello && pannello.scrollTop;
    const immagineHtml = `<img class="aereo-foto" src="${sicuro(img.src)}" alt="Foto dell'aereo ${sicuro(a.callsign || id)}">`;
    box.innerHTML = immagineHtml +
      (foto.photographer ? `<p class="aereo-foto-credito">Foto: ${sicuro(foto.photographer)}</p>` : '');
    if (pannello) {
      pannello.scrollTop = scorrimento;
      // L'immagine acquista la sua altezza solo dopo il caricamento. Disabilitare
      // l'ancoraggio automatico e ripristinare la posizione dopo quel layout
      // evita il salto, particolarmente evidente su Safari mobile.
      const immagine = box.querySelector('img');
      if (immagine) immagine.addEventListener('load', () => {
        if (pannello.isConnected && pannello.scrollTop < scorrimento) pannello.scrollTop = scorrimento;
      }, { once: true });
    }
  }

  // Il raggio delle Impostazioni cambia sia il rettangolo chiesto al provider
  // sia il filtro finale, quindi è un gesto che merita una richiesta subito.
  // Quello che si ha in mano però non è da buttare: stringendo il raggio la
  // risposta di prima **contiene** quella nuova e basta tagliarla, allargando
  // ne è un pezzo giusto in attesa del resto. Svuotare qui voleva dire un
  // cielo vuoto e la riga «ancora nessuna lettura» per tutto il tempo dello
  // scarico, con i dati buoni gettati un istante prima.
  function aereiRaggioCambiato() {
    stato.aerei = stato.aerei.filter(a =>
      (Number.isFinite(a.distanzaSuoloKm) ? a.distanzaSuoloKm : a.distanzaKm) <= raggioKm());
    stato.prossimoAggiornamento = 0;
    stato.prossimoTentativo = 0;
    stato.tentativiFalliti = 0;
    render();
    aggiornaUI();
    // Una richiesta in volo non si abortisce: è già a metà strada, e la sua
    // risposta — presa con il raggio di prima — resta comunque roba buona da
    // cui ripartire. Se ne fa partire un'altra appena quella finisce.
    if (!stato.dati) return;
    if (stato.richiesta) stato.ricaricaDopo = true;
    else carica(true);
  }

  // La leggenda delle fasce: si scrive da JavaScript perché le soglie e i
  // colori stanno in FASCE_DISTANZA, e una copia scritta a mano in index.html
  // divergerebbe al primo ritocco senza che niente lo dica.
  function aereiScriviLeggenda() {
    const box = document.getElementById('aerei-leggenda');
    if (!box) return;
    box.innerHTML = FASCE_DISTANZA.map(f =>
      `<li class="aerei-fascia" style="--fascia:${f.colore}">` +
      `<span class="aereo-pallino" aria-hidden="true"></span>${sicuro(f.nome)}</li>`).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    aereiScriviLeggenda();
    const collega = (id, azione) => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', azione);
    };
    collega('aerei-aggiorna', () => aereiAggiornaAdesso());
    collega('aerei-btn-mostra', () => aereiAlternaVisibili());
    collega('aerei-btn-dati', () => aereiAlternaDati());
    collega('aerei-btn-auto', () => aereiAlternaAuto());
    const cerca = document.getElementById('aerei-cerca-input');
    if (cerca) cerca.addEventListener('input', render);
    const fonti = document.getElementById('aerei-fonti');
    if (fonti) fonti.addEventListener('toggle', () => { fontiScritte = ''; guardato('fonti', aereiScriviFonti); });
    collega('aerei-pannello-chiudi', () => {
      if (typeof skyMostraGruppo === 'function') skyMostraGruppo('');
    });
    document.addEventListener('click', e => {
      const tracking = e.target.closest && e.target.closest('.aereo-tracking');
      const mappa = e.target.closest && e.target.closest('.aereo-mappa');
      const punta = e.target.closest && e.target.closest('[data-aereo-punta]');
      if (tracking) aereiAlternaTracking(tracking.dataset.aereoId);
      if (mappa) aereiMostraMappa(mappa.dataset.aereoId);
      if (punta) puntaAereoDalPannello(punta.dataset.aereoPunta);
      if (e.target.closest && e.target.closest('[data-chiudi-rotta-aereo]')) chiudiMappaRotta();
    });
    // Tornando su una scheda lasciata in secondo piano la fotografia è quasi
    // sempre vecchia: si riparte subito invece di aspettare il battito, che
    // sul telefono può essere stato congelato per un'ora.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || !stato.avviato) return;
      // Prima di tutto: il ciclo batte ancora? Tornare su una scheda e
      // trovare il feed fermo non vuol dire che la fotografia sia vecchia,
      // può voler dire che a battere non c'è rimasto nessuno.
      sorvegliaBattito();
      aereiRientro();
    });
    // `pageshow` è il ritorno dalla cache di navigazione (il tasto
    // «indietro»), dove la pagina riprende esattamente com'era — timer
    // congelati compresi — e `visibilitychange` non passa affatto; `focus` è
    // la rete di sicurezza per tutti i casi che non abbiamo previsto. Tutt'e
    // due costano due confronti fra numeri quando non c'è niente da fare.
    window.addEventListener('pageshow', sorvegliaBattito);
    window.addEventListener('focus', sorvegliaBattito);
    // La rete che torna è la notizia migliore che questo modulo possa
    // ricevere: il conto delle riprove riparte da zero, se no si resterebbe
    // fermi fino allo scadere dell'ultimo rinvio.
    window.addEventListener('online', () => {
      if (!stato.avviato || !stato.dati) return;
      sorvegliaBattito();
      stato.tentativiFalliti = 0;
      stato.errore = '';
      stato.prossimoAggiornamento = 0;
      if (tempoReale()) carica(true);
      else aggiornaUI();
    });
    window.addEventListener('offline', aggiornaUI);
    aggiornaUI();
  });

  // I ponti CORS non servono soltanto a questo modulo. Li chiede anche la
  // registrazione di un momento (§7.6 di `app.js`): la fotografia dell'aereo
  // vive su un CDN che al browser non dà i pixel, e per finire dentro a un
  // filmato deve passare da qualcuno che ci aggiunga l'intestazione. Si
  // esportano invece di ricopiarli là, che è la copia peggiore possibile —
  // il giorno che un ponte cade se ne toglie uno e l'altro elenco resta
  // indietro senza che niente lo dica.
  window.aereiPontiCors = PONTI_CORS;

  window.aereiAvvia = aereiAvvia;
  window.aereiFerma = aereiFerma;
  window.aereiDisegna = aereiDisegna;
  window.aereiImpostaAccesi = aereiImpostaAccesi;
  window.aereiAlternaVisibili = aereiAlternaVisibili;
  window.aereiImpostaVisibili = aereiImpostaVisibili;
  window.aereiAlternaDati = aereiAlternaDati;
  window.aereiAlternaAuto = aereiAlternaAuto;
  window.aereiAggiornaUI = aggiornaUI;
  window.aereoNelPunto = aereoNelPunto;
  window.aereiSchedaHtml = aereiSchedaHtml;
  window.aereiFumettoDati = aereiFumettoDati;
  window.aereiAggiornaSchedaViva = aereiAggiornaSchedaViva;
  window.aereiCaricaFoto = aereiCaricaFoto;
  window.aereiRaggioCambiato = aereiRaggioCambiato;
  window.aereiAggiornaAdesso = aereiAggiornaAdesso;
  window.aereiPosizioneCambiata = aereiPosizioneCambiata;
  window.aereiTrova = aereiTrova;
  window.AereiADS_B = { distanzaDirezione, posizioneFutura, coordinateCielo, separazione, arricchisci,
    interpretaAdsbExchange, interpretaOpenSky, urlAdsbExchange, urlAdsbFi, urlOpenSky,
    scaricaConRipiego, corsaProvider, providersPredefiniti, aereoAdesso, aereoCieloOra, istanteMostratoMs, tempoReale,
    interpretaRotta, aeroportoTesto, aeroportoCoordinate, orarioRotta, puntiOrtodromia,
    // Il ritmo e i suoi guardiani (§6): il banco di prova li interroga uno per
    // uno, perché il difetto che curano non lascia traccia sullo schermo —
    // un feed fermo e un cielo sgombro sono la stessa immagine.
    conAntiCache, attesaRichiesta, battito, sorvegliaBattito, sorvegliaRichiesta,
    guardato, pianificaDopoScarto,
    RIPROVA_LIMITE_DA, RETRY_AFTER_MAX_MS, PENALE_MAX_MS,
    BATTITO_MS, BATTITO_FERMO_MS, RICHIESTA_APPESA_MS,
    registraTracce, tracce, stato, providersDisponibili, providersPerRichiesta,
    FASCE_DISTANZA, fasciaDi, ordinaPerSalute, salute, segnaEsito, peggiore, fase, testoDiStato,
    intervalloAggiornamento, pianificaProssimo, RIPROVE_MS, DATI_VECCHI_MS, DATI_SCADUTI_MS,
    AGGIORNA_VISIBILE_MS, AGGIORNA_SFONDO_MS,
    // Muoversi (§4-bis)
    scartoDalCentroKm, tolleranzaCentroKm, saltoCentroKm, centroAltrove, ricentraPresto,
    unisciConLaMemoria, osservatoreDisegno, osservatore,
    // L'arco di transito (§ «L'arco di transito» in cima al file)
    arcoDiTransito, arcoRiassunto, aereiTestoArco, fiduciaArco, misuraAereo, orizzonteIn,
    AEREI_ARCO_MAX_MIN, AEREI_ARCO_PASSO_FINE_S, AEREI_ARCO_FINE_S,
    AEREI_APERTURA_M, PREVISIONE_MINUTI, COLORE_SILHOUETTE,
    AEREI_CENTRO_QUOTA, AEREI_CENTRO_MIN_KM, AEREI_CENTRO_MAX_KM, AEREI_SALTO_MIN_KM,
    AEREI_MOTO_MIN_MS, AEREI_MEMORIA_MS, AEREI_VIVO_MAX_KM,
    // L'aggregatore (§3-bis … §3-quinquies)
    FontiAerei, fondiLetture, normalizzaLettura, statoCircuito, segnaVuoto, scarica, acquisisci,
    qualitaDi, etaMassimaMs, etaLettura, potaStantii, attesiQui, diagnosticaFonti, aereiRientro,
    providerOpenSky, cacheRisposte, inVoloRisposte, aggiornaPosizioni, carica,
    AEREI_VIVO_MS, AEREI_INTERPOLATO_MS, FUSIONE_ATTESA_MS, VUOTO_SOSPETTO_MIN,
    CACHE_RISPOSTA_MS, PENALE_BLOCCATA_MS, OPENSKY_INTERVALLO_MIN_MS, FRENO_LIMITE_MS, RIENTRO_MS };
  // La facciata, col suo nome: chi vuole gli aerei senza passare dal
  // planetario (una prova, un modulo futuro) chiede a lei e non alle porte.
  window.FontiAerei = FontiAerei;
}());
