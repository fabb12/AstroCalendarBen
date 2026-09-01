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
  const AGGIORNA_VISIBILE_MS = 45000;
  const AGGIORNA_SFONDO_MS = 180000;
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
  const PREVISIONE_MINUTI = 5;

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
      const vistoSecondiFa = numero(a.seen);
      return {
        id: a.hex, callsign: (a.flight || '').trim() || String(a.hex || '').toUpperCase(),
        registrazione: a.r || '', tipoIcao: a.t || '', descrizione: a.desc || '',
        operatore: a.ownOp || '', squawk: a.squawk || '',
        lon: numero(a.lon), lat: numero(a.lat),
        quotaM: quotaPiedi === null ? null : quotaPiedi * 0.3048,
        aTerra: a.alt_baro === 'ground', velocitaMs: (numero(a.gs) || 0) * 0.514444,
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
      aTerra: !!a[8], velocitaMs: numero(a[9]) || 0, direzione: numero(a[10]),
      salitaMs: numero(a[11]) || 0, ultimaLettura: numero(a[4]) || numero(a[3])
    })).filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lon));
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
  //  possono sparire senza avvisare. Per questo sono **tre e non uno**, per
  //  questo ognuno e' abbinato a una rete diversa, e per questo stanno dietro
  //  al proxy proprio quando c'e'. La pagella (§2) fa il resto: misura quale
  //  combinazione funziona da qui e il giro dopo comincia da quella.
  //
  //  Perche' proprio ADSB.fi e adsb.lol: sono le due che, interrogate **da un
  //  server**, hanno risposto 200 con i dati (22 e 21 aerei). Airplanes.live e
  //  adsb.one rispondono 403 anche da li' — servirebbe il loro permesso, che
  //  si chiede scrivendo a contact@airplanes.live.
  // =====================================================================

  const PONTI_CORS = [
    { nome: 'allorigins', avvolgi: u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
    { nome: 'codetabs', avvolgi: u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` },
    { nome: 'corsproxy.io', avvolgi: u => `https://corsproxy.io/?url=${encodeURIComponent(u)}` }
  ];

  // Ogni ponte con una rete diversa: se un ponte cade, non porta giu' con se'
  // anche l'unica rete che stava servendo.
  const ABBINAMENTI = [
    { ponte: PONTI_CORS[0], rete: 'ADSB.fi', feed: urlAdsbFi },
    { ponte: PONTI_CORS[1], rete: 'adsb.lol', feed: feedAdsbLol },
    { ponte: PONTI_CORS[2], rete: 'ADSB.fi', feed: urlAdsbFi },
    { ponte: PONTI_CORS[0], rete: 'adsb.lol', feed: feedAdsbLol }
  ];

  function providersPonte() {
    return ABBINAMENTI.map(a => ({
      nome: `${a.rete} via ${a.ponte.nome}`,
      rete: `${a.rete} (ponte ${a.ponte.nome})`,
      url: (posizione, raggioKm) => a.ponte.avvolgi(a.feed(posizione, raggioKm)),
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
    console.info('[aerei] Nessun proxy proprio configurato (ADSB_PROXY_URL). ' +
      'Le richieste dirette qui sotto falliranno tutte per CORS — quelle reti non ' +
      'mandano Access-Control-Allow-Origin e da un browser non si leggono mai: ' +
      'le righe rosse che seguono sono attese, non un difetto. Si passa poi ai ' +
      'ponti CORS pubblici. Per la strada solida vedi ADSB-PROXY.md.');
  }

  function providersDisponibili() {
    avvisaSeManca();
    const proxy = urlProxy();
    const propri = proxy ? [{
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
    }] : [];
    // L'ordine: **il Worker davanti, le reti dirette dietro** — e stavolta
    // il numero c'e'. Le quattro reti di comunita' non possono servire un
    // browser, e non «a volte»: misurato dall'origine del sito pubblicato,
    // tutte e quattro rispondono senza `Access-Control-Allow-Origin`, quindi
    // il browser le rifiuta prima ancora di guardarne il contenuto. Aperte in
    // una scheda i dati ci sono — ed e' quello che ha tenuto in piedi per
    // mesi la convinzione che fossero «una via di emergenza»: una scheda non
    // e' una richiesta cross-site, e non prova niente sul CORS.
    //
    // Dal Worker invece il CORS non c'entra, ma quelle stesse reti rispondono
    // 403, 429, 403, 403: un Worker non ha un IP proprio e ne divide un pugno
    // con migliaia di altri. La via d'uscita e' una fonte con **credenziali**
    // (OpenSky), che il Worker puo' tenere e il browser no — vedi
    // `worker-adsb.js`.
    //
    // Le quattro restano in coda, e non e' sentimentalismo: costano una
    // trentina di millisecondi a testa (un rifiuto CORS e' immediato), e il
    // giorno che una cambia politica la pagella (§2) la promuove da se' senza
    // che nessuno debba accorgersene.
    // L'ordine: il proxy proprio se c'e' (risponde sempre), poi le reti
    // dirette (falliscono per CORS, ma costano trenta millisecondi e un
    // giorno potrebbero cambiare politica), poi i ponti pubblici, che sono
    // l'unica strada che funziona senza aver distribuito niente.
    return propri.concat(providersPredefiniti, providersPonte());
  }

  // =====================================================================
  // 2. LA PAGELLA DELLE PORTE
  //    Quale feed funziona *qui* non lo sa nessuno prima di provarlo: dipende
  //    dal paese, dal fornitore di rete, dai filtri anti-tracciamento del
  //    browser. Ricominciando ogni volta dal primo dell'elenco si ripaga ogni
  //    volta lo stesso scotto — la porta chiusa da ieri sta ancora in cima.
  //    Qui ogni esito lascia un segno, il segno sopravvive alla sessione, e
  //    l'ordine del giro dopo esce da lì. Una porta che sbaglia non viene
  //    esclusa: viene **rimandata in fondo** per un po', perché un guasto è
  //    quasi sempre temporaneo e chi si esclude da solo non torna mai.
  // =====================================================================

  const salute = new Map();

  function saluteDi(nome) {
    let v = salute.get(nome);
    if (!v) { v = { ok: 0, no: 0, noDiFila: 0, ultimoOk: 0, penaleFino: 0, ultimoGuaio: '' }; salute.set(nome, v); }
    return v;
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
          ultimoGuaio: String(v.ultimoGuaio || '')
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

  function segnaEsito(provider, riuscito, errore) {
    const v = saluteDi(provider.nome);
    const ora = Date.now();
    if (riuscito) {
      v.ok++; v.noDiFila = 0; v.ultimoOk = ora; v.penaleFino = 0; v.ultimoGuaio = '';
    } else {
      v.no++; v.noDiFila++; v.ultimoGuaio = (errore && errore.message) || 'guasto';
      // La penale raddoppia a ogni no di fila e si ferma a dieci minuti: una
      // porta rotta smette in fretta di costare tempo, ma torna in gioco da
      // sola senza che nessuno debba ricordarsi di riabilitarla.
      v.penaleFino = ora + Math.min(600000, 20000 * Math.pow(2, Math.min(5, v.noDiFila - 1)));
    }
    saluteSalva();
  }

  // L'ordine di partenza: chi ha risposto più di recente per primo, chi è in
  // penale per ultimo. `indice` tiene l'ordine scritto come spareggio, così
  // alla prima apertura — quando nessuno ha ancora una storia — si parte
  // esattamente dall'elenco di sopra.
  function ordinaPerSalute(providers, ora = Date.now()) {
    return providers.map((p, indice) => {
      const v = salute.get(p.nome) || null;
      return {
        p, indice,
        inPenale: !!(v && v.penaleFino > ora),
        ultimoOk: v ? v.ultimoOk : 0
      };
    }).sort((a, b) =>
      (a.inPenale ? 1 : 0) - (b.inPenale ? 1 : 0) ||
      b.ultimoOk - a.ultimoOk ||
      a.indice - b.indice
    ).map(v => v.p);
  }

  // =====================================================================
  // 3. LA CORSA
  //    Non una fila indiana: si lancia la prima porta e, dopo AFFIANCA_MS,
  //    anche la seconda. Vince chi risponde per prima; le perdenti si
  //    abortiscono. Una porta caduta lascia subito il posto alla prossima —
  //    l'affiancamento serve a chi tace, non a chi ha già detto di no — e la
  //    sveglia grossa è di **tutta la corsa**: è quello che rende gratis le
  //    porte in più, perché con una sveglia per tentativo passare da tre a
  //    molte porte vorrebbe dire passare da mezzo minuto a due di silenzio.
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

  async function scarica(provider, obs, raggio, signal) {
    const risposta = await fetch(provider.url(obs, raggio), { signal, cache: 'no-store' });
    if (risposta.status === 429) {
      const errore = new Error('limite di richieste raggiunto');
      errore.rateLimit = true; errore.stato = 429; throw errore;
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
    return provider.interpreta(dati);
  }

  function corsaProvider(providers, obs, raggio, signalEsterno, opz = {}) {
    const affiancaMs = Number.isFinite(opz.affiancaMs) ? opz.affiancaMs : AFFIANCA_MS;
    const attesaMs = Number.isFinite(opz.attesaMs) ? opz.attesaMs : PROVIDER_ATTESA_MS;
    const corsaMs = Number.isFinite(opz.corsaMs) ? opz.corsaMs : CORSA_ATTESA_MS;
    return new Promise((risolvi, rifiuta) => {
      if (!providers.length) { rifiuta(new Error('nessun servizio disponibile')); return; }
      if (signalEsterno && signalEsterno.aborted) { rifiuta(annullata()); return; }
      const errori = [];
      const provate = [];
      const regia = new AbortController();
      let prossimo = 0, inVolo = 0, chiuso = false, timerAffianco = null;

      const sveglia = setTimeout(() =>
        concludi(null, errNome('TimeoutError', 'nessuna rete ADS-B ha risposto in tempo')), corsaMs);
      const annullaEsterno = () => concludi(null, annullata());
      if (signalEsterno) signalEsterno.addEventListener('abort', annullaEsterno, { once: true });

      function concludi(vincitore, errore) {
        if (chiuso) return;
        chiuso = true;
        clearTimeout(sveglia); clearTimeout(timerAffianco);
        if (signalEsterno) signalEsterno.removeEventListener('abort', annullaEsterno);
        regia.abort();
        if (vincitore) risolvi(vincitore);
        else rifiuta(errore || peggiore(errori));
      }

      function pianifica(ritardo) {
        if (chiuso || prossimo >= providers.length) return;
        clearTimeout(timerAffianco);
        timerAffianco = setTimeout(lancia, ritardo);
      }

      function lancia() {
        if (chiuso || prossimo >= providers.length) return;
        const provider = providers[prossimo++];
        provate.push(provider.nome);
        inVolo++;
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
        scarica(provider, obs, raggio, suo.signal).then(aerei => {
          if (chiuso) return;
          segnaEsito(provider, true);
          concludi({ provider, aerei, provate: provate.slice() });
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
          if (!chiuso && inVolo === 0 && prossimo >= providers.length) concludi(null, peggiore(errori));
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
    dati: true, visibile: true, auto: true,
    ultimoSuccesso: 0, ultimoTentativo: 0, prossimoAggiornamento: 0, prossimoTentativo: 0,
    tentativiFalliti: 0, errore: '', errNome: '', ultimaFonte: '', avviato: false,
    ricaricaDopo: false, ultimoRenderSecondo: null, feedbackRichiesto: false, feedbackTimer: null,
    ultimaFase: ''
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
    return { ...aereo, lat: gradi(lat), lon: limita180(gradi(lon)),
      quotaM: Math.max(0, (aereo.quotaM || 0) + (aereo.salitaMs || 0) * secondi) };
  }

  function coordinateCielo(aereo, osservatore) {
    const d = distanzaDirezione(osservatore, aereo);
    const quotaOsservatore = osservatore.quotaM || 0;
    const alt = gradi(Math.atan2((aereo.quotaM || 0) - quotaOsservatore,
      Math.max(.02, d.km * 1000))) - gradi(d.km / (2 * TERRA_KM));
    return { az: d.az, alt, distanzaKm: d.km };
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
      const traiettoria = [];
      for (let minuti = 0; minuti <= PREVISIONE_MINUTI; minuti++) {
        const futuro = posizioneFutura(a, minuti * 60);
        traiettoria.push({ minuti, ...coordinateCielo(futuro, obs) });
      }
      return { ...a, ...cielo, traiettoria, allineamenti: [],
        posizioneFeed: { ...a } };
    }).filter(a => a.distanzaKm <= raggioKm()).sort((a, b) => a.distanzaKm - b.distanzaKm);
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
  function unisciConLaMemoria(nuovi, ora = Date.now()) {
    const elenco = Array.isArray(nuovi) ? nuovi.slice() : [];
    const visti = new Set(elenco.map(a => String(a && a.id || '').toLowerCase()));
    stato.aerei.forEach(a => {
      const id = String(a.id || '').toLowerCase();
      if (!id || visti.has(id)) return;
      // La lettura grezza, non quella propagata: propagare una propagazione
      // vorrebbe dire ricalcolare l'errore sopra all'errore, e in mezz'ora
      // farebbe un aereo inventato.
      const origine = a.posizioneFeed || a;
      const letto = Number.isFinite(origine.ultimaLettura) ? origine.ultimaLettura * 1000 : 0;
      if (!letto || ora - letto > AEREI_MEMORIA_MS) return;
      elenco.push(origine);
    });
    return elenco;
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
  function aereoAdesso(a, obs, oraMs = istanteMostratoMs()) {
    const origine = a.posizioneFeed || a;
    // Lo scarto e' volutamente firmato: nella macchina del tempo una lettura
    // ADS-B diventa il punto noto dal quale ricostruire sia il passato sia il
    // futuro. Limitare a zero, come prima, congelava l'aereo tornando indietro.
    const secondi = oraMs / 1000 - (origine.ultimaLettura || Date.now() / 1000);
    const corrente = posizioneFutura(origine, secondi);
    const cielo = coordinateCielo(corrente, obs);
    const traiettoria = [];
    for (let minuti = 0; minuti <= PREVISIONE_MINUTI; minuti++) {
      const futuro = posizioneFutura(corrente, minuti * 60);
      traiettoria.push({ minuti, ...coordinateCielo(futuro, obs) });
    }
    return { ...a, ...corrente, ...cielo, traiettoria, allineamenti: a.allineamenti || [],
      posizioneFeed: origine, stimato: !tempoReale(oraMs), istanteMostrato: oraMs };
  }

  function aggiornaPosizioni() {
    const obs = osservatoreDisegno();
    if (!obs) return [];
    stato.aerei = stato.aerei.map(a => aereoAdesso(a, obs));
    return stato.aerei;
  }

  function aggiornaAllineamenti() {
    if (typeof sky === 'undefined') return;
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
    const s = Math.max(0, Math.round(ms / 1000));
    if (s <= 1) return 'a momenti';
    if (s < 60) return `fra ${s} s`;
    const m = Math.round(s / 60);
    return m < 60 ? `fra ${m} min` : `fra ${Math.round(m / 60)} h`;
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
    const f = fase();
    const conteggio = stato.aerei.length;
    const quanti = conteggio === 1 ? '1 aereo' : `${conteggio} aerei`;
    const eta = stato.ultimoSuccesso ? quantoFa(Date.now() - stato.ultimoSuccesso) : '';
    const prossimo = stato.dati && stato.auto && stato.prossimoAggiornamento
      ? ` · nuovo scarico ${fraQuanto(stato.prossimoAggiornamento - Date.now())}` : '';
    if (f === 'senzaPosizione') return 'Serve una posizione per cercare gli aerei.';
    if (f === 'proxyMancante') {
      return 'Nessun dato: le reti ADS-B non autorizzano le richieste dei browser e in ' +
        'questo momento non risponde nemmeno un ponte CORS pubblico. Per una strada ' +
        'che non dipende da servizi di terzi si configura un proxy proprio ' +
        '(ADSB_PROXY_URL, vedi ADSB-PROXY.md).';
    }
    if (f === 'spento') {
      return stato.ultimoSuccesso
        ? `Dati in pausa · ultima lettura ${eta} (${quanti}).`
        : 'Dati in pausa: accendi «Dati ADS-B» per scaricare il traffico vicino.';
    }
    if (f === 'carico') {
      return stato.ultimoSuccesso
        ? `Aggiornamento in corso… · intanto ${quanti} dall'ultima lettura ${eta}.`
        : 'Primo scarico dei dati ADS-B in corso…';
    }
    if (f === 'passato') {
      return `Macchina del tempo: ${quanti} in posizione stimata dall'ultima lettura ADS-B. ` +
        'Torna ad Adesso per i dati in tempo reale.';
    }
    if (f === 'senzaRete') {
      return stato.ultimoSuccesso
        ? `Senza rete · resta l'ultima lettura di ${eta} (${quanti}).`
        : 'Senza rete: i dati ADS-B arriveranno appena torna la connessione.';
    }
    if (f === 'errore') {
      const riprova = stato.prossimoTentativo
        ? ` Riprovo ${fraQuanto(stato.prossimoTentativo - Date.now())}.` : '';
      return stato.ultimoSuccesso
        ? `Aggiornamento non riuscito (${guaioLeggibile()}): resta l'ultima lettura di ${eta} (${quanti}).${riprova}`
        : `Dati ADS-B non disponibili (${guaioLeggibile()}).${riprova}`;
    }
    if (f === 'vecchio') {
      return `${quanti} · ultima lettura ${eta}: posizioni propagate dalla rotta.${prossimo}`;
    }
    if (!stato.ultimoSuccesso) return 'In attesa del primo scarico ADS-B…';
    return `${quanti} · ${stato.ultimaFonte || 'ADS-B'} · aggiornato ${eta}${prossimo}`;
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
        padre.title = `${info.nota}. Apri il pannello degli aerei ADS-B`;
        padre.setAttribute('aria-label', `${info.nota}. Apri il pannello degli aerei ADS-B`);
      }
    }
    scriviTesto('aerei-conteggio', stato.aerei.length ? String(stato.aerei.length) : '—');
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
      b.textContent = concluso ? (errore ? 'Non riuscito' : 'Aggiornato ✓') : 'Aggiornamento…';
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

  function render() {
    aggiornaAllineamenti();
    const box = document.getElementById('aerei-elenco');
    if (!box) return;
    if (!stato.aerei.length) {
      box.innerHTML = '<p class="etichetta-comando">' + (stato.ultimoSuccesso
        ? 'Nessun aereo ADS-B nel raggio scelto in questo momento.'
        : 'Ancora nessuna lettura: appena arriva, gli aerei compaiono qui.') + '</p>';
      return;
    }
    const inDiretta = tempoReale();
    box.innerHTML = stato.aerei.map(a => {
      const all = a.allineamenti[0];
      const f = fasciaDi(a.distanzaKm);
      return `<article class="aereo-riga" style="--fascia:${f.colore};--fascia-forte:${f.forte}">` +
        `<div class="aereo-riga-testa"><span class="aereo-pallino" aria-hidden="true"></span>` +
        `<strong>${sicuro(a.callsign)}</strong>` +
        `<span class="aereo-distanza">${a.distanzaKm.toFixed(1)} km</span></div>` +
        `<p class="aereo-dati">${Math.round(a.quotaM || 0).toLocaleString('it-IT')} m · ` +
        `${Math.round((a.velocitaMs || 0) * 3.6)} km/h · ${Math.round(a.direzione || 0)}° · ` +
        `${inDiretta ? 'in tempo reale' : 'posizione stimata'}</p>` +
        (all ? `<p class="aereo-allineamento">Possibile allineamento con ${sicuro(all.nome)} ` +
          `${all.minuti ? `fra ${all.minuti} min` : 'adesso'} (${all.scarto.toFixed(1)}°)</p>` : '') + '</article>';
    }).join('');
  }

  // =====================================================================
  // 6. IL MOTORE: scaricare, riprovare, tenere il ritmo
  // =====================================================================

  function intervalloAggiornamento() {
    const inVista = stato.visibile && typeof sky !== 'undefined' && sky.aperto;
    return inVista ? AGGIORNA_VISIBILE_MS : AGGIORNA_SFONDO_MS;
  }

  function pianificaProssimo(riuscito) {
    const ora = Date.now();
    if (riuscito) {
      stato.tentativiFalliti = 0;
      stato.prossimoTentativo = 0;
      stato.prossimoAggiornamento = ora + intervalloAggiornamento();
      return;
    }
    const i = Math.min(stato.tentativiFalliti, RIPROVE_MS.length - 1);
    // Un pizzico di casualità: più schede aperte sullo stesso computer, o più
    // telefoni sulla stessa rete, non devono ripartire tutti nello stesso
    // istante dopo un guasto comune — sarebbe la raffica che ha causato il
    // 429 di prima, ripetuta.
    stato.prossimoTentativo = ora + RIPROVE_MS[i] * (0.85 + Math.random() * 0.3);
    stato.prossimoAggiornamento = stato.prossimoTentativo;
  }

  async function carica(forza, mostraFeedback) {
    if (mostraFeedback) {
      stato.feedbackRichiesto = true;
      feedbackAggiornamento('Aggiornamento dei dati ADS-B in corso…', false);
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
      pianificaProssimo(false);
      concludiFeedback('Aggiornamento ADS-B non riuscito: manca la connessione.', true);
      aggiornaUI();
      return;
    }
    stato.ultimoTentativo = ora;
    const providers = window.AEREI_PROVIDER ? [window.AEREI_PROVIDER]
      : ordinaPerSalute(providersDisponibili());
    const controller = new AbortController();
    stato.controller = controller;
    aggiornaUI();
    stato.richiesta = corsaProvider(providers, obs, raggioKm(), controller.signal)
      .then(risultato => {
        // Nel frattempo il planetario potrebbe essersi spostato. Solo un
        // **salto** però rende inutile la risposta: prima bastava un cambio
        // qualunque, e in macchina quel cambio arriva ogni sei secondi — cioè
        // ogni risposta che riusciva ad arrivare veniva buttata sul traguardo,
        // dopo aver pagato per intero il tempo di scaricarla. Muovendosi la
        // risposta si tiene: le coordinate si rifanno dal punto di adesso.
        const adesso = osservatore();
        if (!adesso || distanzaDirezione(obs, adesso).km > saltoCentroKm()) return;
        registraTracce(risultato.aerei);
        stato.aerei = arricchisci(unisciConLaMemoria(risultato.aerei), obs);
        stato.ultimoCentro = obs;
        stato.ultimoSuccesso = Date.now();
        stato.ultimaFonte = risultato.provider.nome;
        stato.errore = ''; stato.errNome = '';
        pianificaProssimo(true);
        render();
        concludiFeedback(`Dati ADS-B aggiornati: ${stato.aerei.length} ` +
          `${stato.aerei.length === 1 ? 'aereo trovato' : 'aerei trovati'}.`, false);
      }).catch(e => {
        if (e.name === 'AbortError' && (!stato.dati || stato.ricaricaDopo)) return;
        stato.errore = e.message || 'guasto';
        stato.errNome = e.name || '';
        stato.tentativiFalliti++;
        pianificaProssimo(false);
        concludiFeedback(`Aggiornamento ADS-B non riuscito: ${guaioLeggibile()}.`, true);
      }).finally(() => {
        stato.richiesta = null; stato.controller = null;
        if (stato.ricaricaDopo) { stato.ricaricaDopo = false; carica(true); }
        else aggiornaUI();
      });
    return stato.richiesta;
  }

  // Il battito: un confronto fra due numeri ogni cinque secondi. Costa meno
  // di niente e sopravvive a quello che un `setInterval` da cinque minuti non
  // sopravvive — un telefono che manda l'app in secondo piano strozza o salta
  // i timer lunghi, e al ritorno il prossimo scarico sarebbe fra un'era.
  function battito() {
    aggiornaUI();
    // La fotografia troppo vecchia non si propaga più: mezz'ora di rotta
    // stimata non è un aereo, è un disegno.
    if (stato.ultimoSuccesso && Date.now() - stato.ultimoSuccesso > DATI_SCADUTI_MS && stato.aerei.length) {
      stato.aerei = [];
      render();
    }
    if (!stato.dati || !stato.auto) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (stato.richiesta || !tempoReale()) return;
    if (Date.now() < stato.prossimoAggiornamento) return;
    carica(false);
  }

  function aereiAvvia() {
    if (stato.timer) return;
    stato.avviato = true;
    stato.timer = setInterval(battito, BATTITO_MS);
    if (stato.dati) carica(false);
    render();
    aggiornaUI();
  }

  function aereiFerma() {
    clearInterval(stato.timer);
    stato.timer = null;
    stato.avviato = false;
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
      feedbackAggiornamento('Aggiornamento dei dati ADS-B in corso…', false);
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
        ...skyProietta(skyVettore(t.az, t.alt), base, focale), minuti: t.minuti
      })).filter(p => p.davanti);
      if (!punti.length) return;
      const fascia = fasciaDi(a.distanzaKm);
      ctx.strokeStyle = fascia.colore; ctx.globalAlpha = (fresco ? 0.85 : 0.55);
      ctx.setLineDash([4, 5]); ctx.lineWidth = 1.4;
      ctx.beginPath(); punti.forEach((p, i) => i ? ctx.lineTo(p.px, p.py) : ctx.moveTo(p.px, p.py)); ctx.stroke();

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
          if (!p.minuti) return;                       // lo zero ce l'ha gia' il simbolo
          const ultimo = p.minuti === PREVISIONE_MINUTI;
          ctx.beginPath();
          ctx.arc(p.px, p.py, ultimo ? 2.6 : 1.6, 0, Math.PI * 2);
          ctx.fillStyle = fascia.colore;
          ctx.globalAlpha = (fresco ? 0.9 : 0.5) * (ultimo ? 1 : 0.75);
          ctx.fill();
        });
        // Il numero solo in coda, e solo quando c'e' spazio davvero: cinque
        // etichette su una traiettoria sono cinque cose da leggere, e quello
        // che serve e' un capolinea a cui riferire le tacche in mezzo.
        if (corsaPx >= AEREI_ETICHETTA_PX_MIN && coda.minuti === PREVISIONE_MINUTI) {
          ctx.globalAlpha = fresco ? 0.85 : 0.5;
          ctx.font = '600 9px system-ui';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
          ctx.strokeStyle = 'rgba(2,6,23,.85)';
          ctx.strokeText(`+${PREVISIONE_MINUTI}′`, coda.px, coda.py - 8);
          ctx.fillText(`+${PREVISIONE_MINUTI}′`, coda.px, coda.py - 8);
          ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        }
      }
      ctx.globalAlpha = fresco ? 1 : 0.62;
      const p = punti[0]; ctx.setLineDash([]);
      // Il muso segue la rotta proiettata sullo schermo. Il triangolo di base
      // guarda verso l'alto, quindi l'angolo della prima porzione visibile
      // della previsione va aumentato di 90 gradi. Usare la traiettoria, e non
      // direttamente l'heading in gradi, tiene conto anche della prospettiva
      // del planetario e dell'inclinazione del telefono.
      const avanti = punti.slice(1).find(q => Math.hypot(q.px - p.px, q.py - p.py) > .5);
      const angolo = avanti ? Math.atan2(avanti.py - p.py, avanti.px - p.px) + Math.PI / 2 : 0;
      ctx.save();
      ctx.translate(p.px, p.py); ctx.rotate(angolo);
      // Il contorno scuro sotto al simbolo è la stessa ricetta dei nomi delle
      // montagne: un triangolo rosso su un tramonto rosso non si vede, e sul
      // cielo di mezzogiorno nemmeno un azzurro.
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 5); ctx.lineTo(0, 2); ctx.lineTo(-6, 5); ctx.closePath();
      ctx.strokeStyle = 'rgba(2,6,23,.85)'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.fillStyle = fascia.colore; ctx.fill();
      if (a.allineamenti.length) {
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.restore();
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
    const quota = Number.isFinite(a.quotaM) ? `${Math.round(a.quotaM).toLocaleString('it-IT')} m` : 'non comunicata';
    const velocita = Number.isFinite(a.velocitaMs) ? `${Math.round(a.velocitaMs * 3.6)} km/h` : 'non comunicata';
    return [
      { chiave: 'volo', nome: 'Volo', valore: a.callsign },
      { chiave: 'registrazione', nome: 'Registrazione', valore: a.registrazione },
      { chiave: 'aeromobile', nome: 'Aeromobile', valore: a.descrizione || a.tipoIcao },
      { chiave: 'operatore', nome: 'Operatore', valore: a.operatore },
      { chiave: 'quota', nome: 'Quota', valore: quota },
      { chiave: 'velocita', nome: 'Velocità', valore: velocita },
      { chiave: 'direzione', nome: 'Rotta', valore: Number.isFinite(a.direzione) ? `${Math.round(a.direzione)}°` : '' },
      { chiave: 'distanza', nome: 'Distanza', valore: Number.isFinite(a.distanzaKm) ? `${a.distanzaKm.toFixed(1)} km` : '' },
      { chiave: 'itinerario', nome: 'Itinerario', dallaRete: true },
      { chiave: 'icao', nome: 'Codice ICAO', valore: String(a.id || '').toUpperCase() },
      { chiave: 'squawk', nome: 'Squawk', valore: a.squawk }
    ].filter(v => v.dallaRete || v.valore);
  }

  function aereiNotaScheda(a) {
    return a.stimato
      ? 'Posizione stimata dalla rotta, velocità e salita dell’ultima lettura ADS-B.'
      : 'Posizione allineata al feed ADS-B in tempo reale.';
  }

  function aereiSchedaHtml(a) {
    const fascia = fasciaDi(a.distanzaKm);
    return `<div class="scheda-testata"><h3>✈ ${sicuro(a.callsign || a.id)}</h3></div>` +
      `<p class="aereo-fascia" style="--fascia:${fascia.colore}">` +
      `<span class="aereo-pallino" aria-hidden="true"></span>` +
      `<span data-vivo="fascia">${sicuro(fascia.nome)}</span></p>` +
      `<div id="aereo-foto-${sicuro(a.id)}"></div><ul>` +
      aereiVociScheda(a).map(v => v.dallaRete
        ? `<li id="aereo-rotta-${sicuro(a.id)}"><span class="voce-dato">${v.nome}:</span> ricerca in corso…</li>`
        : `<li><span class="voce-dato">${v.nome}:</span> <span data-vivo="${v.chiave}">${sicuro(v.valore)}</span></li>`).join('') +
      '</ul>' +
      `<div class="aereo-azioni"><button type="button" class="tasto-cielo aereo-mappa" data-aereo-id="${sicuro(a.id)}">Traccia reale sulla mappa</button></div>` +
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

  async function aereiMostraMappa(id) {
    const a = aereiTrova(id);
    const modale = document.getElementById('aereo-rotta-modale');
    const carta = document.getElementById('aereo-rotta-mappa');
    const titolo = document.getElementById('aereo-rotta-titolo');
    if (!a || !modale || !carta) return;
    if (typeof L === 'undefined') { if (typeof skyAvviso === 'function') skyAvviso('aereo-mappa', 'La carta geografica richiede la rete al primo utilizzo.', 6000); return; }
    if (titolo) titolo.textContent = `Traccia ADS-B di ${a.callsign || String(a.id).toUpperCase()}`;
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
    // Questa e' la sola linea continua della carta: collega esclusivamente
    // posizioni realmente ricevute dai feed ADS-B. Congiungere partenza e
    // arrivo disegnava invece una scorciatoia rettilinea che un aereo non ha
    // mai percorso (ignorava aerovie, deviazioni e attese).
    const osservati = (tracce.get(String(a.id).toLowerCase()) || []).map(p => [p.lat, p.lon]);
    if (!osservati.length) osservati.push([a.lat, a.lon]);
    const previsti = [a, ...[1, 2, 3, 4, 5].map(m => posizioneFutura(a, m * 60))].map(p => [p.lat, p.lon]);
    if (osservati.length > 1) {
      stratiRotta.push(L.polyline(osservati, { color: '#22d3ee', weight: 4 }).addTo(mappaRotta));
    }
    stratiRotta.push(L.polyline(previsti, { color: '#fb923c', weight: 3, dashArray: '7 7' }).addTo(mappaRotta));
    stratiRotta.push(L.circleMarker([a.lat, a.lon], { radius: 8, color: '#fff', weight: 2,
      fillColor: fasciaDi(a.distanzaKm).colore, fillOpacity: 1 }).bindTooltip('Posizione attuale').addTo(mappaRotta));
    // Gli aeroporti sono informazioni certe dell'itinerario, ma non sono la
    // geometria del volo: restano quindi due marcatori, mai una linea.
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
    const nota = document.getElementById('aereo-rotta-nota');
    if (nota) nota.textContent = osservati.length > 1
      ? `${osservati.length} posizioni reali ADS-B rilevate durante questa sessione; la linea arancione è solo la previsione dei prossimi 5 minuti.`
      : 'La traccia reale inizierà a formarsi con le prossime letture ADS-B; non viene inventata una linea retta fra gli aeroporti.';
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
    const valore = rotta[`${prefisso}_time`] || rotta[`scheduled_${prefisso}`] ||
      rotta[`${prefisso}_scheduled`] || rotta[prefisso] && rotta[prefisso].scheduled_time;
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

  async function aereiCaricaRotta(a) {
    const callsign = String(a.callsign || '').trim().replace(/\s+/g, '');
    const box = document.getElementById(`aereo-rotta-${a.id}`);
    if (!box || !callsign) return;
    if (!rottaCache.has(callsign)) {
      const voce = { valore: null, promessa: null };
      voce.promessa = fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`,
        { cache: 'force-cache' }).then(r => r.ok ? r.json() : null).then(interpretaRotta).catch(() => null)
        .then(rotta => (voce.valore = rotta));
      rottaCache.set(callsign, voce);
    }
    const rotta = await rottaCache.get(callsign).promessa;
    if (!box.isConnected) return;
    const pannello = box.closest('.pannello-dettaglio');
    const scorrimento = pannello && pannello.scrollTop;
    if (!rotta || (!rotta.partenza && !rotta.arrivo)) {
      box.innerHTML = '<span class="voce-dato">Itinerario:</span> non disponibile';
      if (pannello) pannello.scrollTop = scorrimento;
      return;
    }
    const riga = (nome, luogo, ora) => luogo
      ? `<div><span class="voce-dato">${nome}:</span> ${sicuro(luogo)}${ora ? ` · ${sicuro(ora)}` : ''}</div>` : '';
    box.innerHTML = riga('Partenza', rotta.partenza, rotta.oraPartenza) +
      riga('Arrivo', rotta.arrivo, rotta.oraArrivo);
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
    box.innerHTML = `<img class="aereo-foto" src="${sicuro(img.src)}" alt="Foto dell'aereo ${sicuro(a.callsign || id)}">` +
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
    stato.aerei = stato.aerei.filter(a => a.distanzaKm <= raggioKm());
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
    collega('aerei-pannello-chiudi', () => {
      if (typeof skyMostraGruppo === 'function') skyMostraGruppo('');
    });
    document.addEventListener('click', e => {
      const tracking = e.target.closest && e.target.closest('.aereo-tracking');
      const mappa = e.target.closest && e.target.closest('.aereo-mappa');
      if (tracking) aereiAlternaTracking(tracking.dataset.aereoId);
      if (mappa) aereiMostraMappa(mappa.dataset.aereoId);
      if (e.target.closest && e.target.closest('[data-chiudi-rotta-aereo]')) chiudiMappaRotta();
    });
    // Tornando su una scheda lasciata in secondo piano la fotografia è quasi
    // sempre vecchia: si riparte subito invece di aspettare il battito, che
    // sul telefono può essere stato congelato per un'ora.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || !stato.avviato) return;
      aggiornaUI();
      if (stato.dati && stato.auto && tempoReale() &&
        Date.now() - stato.ultimoSuccesso > DATI_VECCHI_MS) carica(false);
    });
    // La rete che torna è la notizia migliore che questo modulo possa
    // ricevere: il conto delle riprove riparte da zero, se no si resterebbe
    // fermi fino allo scadere dell'ultimo rinvio.
    window.addEventListener('online', () => {
      if (!stato.avviato || !stato.dati) return;
      stato.tentativiFalliti = 0;
      stato.errore = '';
      stato.prossimoAggiornamento = 0;
      if (tempoReale()) carica(true);
      else aggiornaUI();
    });
    window.addEventListener('offline', aggiornaUI);
    aggiornaUI();
  });

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
  window.aereiAggiornaSchedaViva = aereiAggiornaSchedaViva;
  window.aereiCaricaFoto = aereiCaricaFoto;
  window.aereiRaggioCambiato = aereiRaggioCambiato;
  window.aereiAggiornaAdesso = aereiAggiornaAdesso;
  window.aereiPosizioneCambiata = aereiPosizioneCambiata;
  window.aereiTrova = aereiTrova;
  window.AereiADS_B = { distanzaDirezione, posizioneFutura, coordinateCielo, separazione, arricchisci,
    interpretaAdsbExchange, interpretaOpenSky, urlAdsbExchange, urlAdsbFi, urlOpenSky,
    scaricaConRipiego, corsaProvider, providersPredefiniti, aereoAdesso, istanteMostratoMs, tempoReale,
    interpretaRotta, aeroportoTesto, aeroportoCoordinate, registraTracce, tracce, stato, providersDisponibili,
    FASCE_DISTANZA, fasciaDi, ordinaPerSalute, salute, segnaEsito, peggiore, fase, testoDiStato,
    intervalloAggiornamento, pianificaProssimo, RIPROVE_MS, DATI_VECCHI_MS, DATI_SCADUTI_MS,
    AGGIORNA_VISIBILE_MS, AGGIORNA_SFONDO_MS,
    // Muoversi (§4-bis)
    scartoDalCentroKm, tolleranzaCentroKm, saltoCentroKm, centroAltrove, ricentraPresto,
    unisciConLaMemoria, osservatoreDisegno, osservatore,
    AEREI_CENTRO_QUOTA, AEREI_CENTRO_MIN_KM, AEREI_CENTRO_MAX_KM, AEREI_SALTO_MIN_KM,
    AEREI_MOTO_MIN_MS, AEREI_MEMORIA_MS, AEREI_VIVO_MAX_KM };
}());
