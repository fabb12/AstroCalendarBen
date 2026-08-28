// Aerei nel Planetario — dati ADS-B in tempo reale.
//
// I provider e tutto il trasporto stanno qui: GitHub Pages non puo fare da
// proxy. Alcuni feed ADS-B autorizzano le richieste del browser solo in modo
// intermittente o differente secondo la rete: si provano prima i feed diretti
// e poi, se il CORS li blocca, i ponti indipendenti.
//
// LA LEZIONE DI QUESTO FILE, in una riga: **una porta ADS-B carica non
// risponde «carico», tace** — e tacere consuma tutta la sveglia. Provandole in
// fila indiana con dodici secondi a testa, sette porte fanno un minuto e
// mezzo di silenzio, e nel frattempo chi guarda il cielo conclude che gli
// aerei «a volte ci sono e a volte no». Da qui le tre scelte che tengono in
// piedi il modulo:
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
//
// E c'è una quarta cosa, che le tre di sopra non possono dare: **una porta
// propria** (§2-bis). Tutto quello che sta nell'elenco è un prestito — reti
// pubbliche che possono smettere di autorizzare i browser, ponti gratuiti che
// smettono a turno — e il giorno in cui cadono tutti insieme non c'è
// affiancamento né pagella che tenga: dal sito pubblicato su GitHub Pages
// nove porte hanno risposto «no» per tre motivi diversi nella stessa serata.
// Il Worker del progetto (`worker-adsb.js`) risolve la cosa alla radice,
// perché il CORS lo aggiunge lui; e adesso lo si può indicare **dal
// pannello**, senza ripubblicare il sito, perché chi resta senza aerei vuole
// rimediare stasera.
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
  // La sveglia di una singola porta è più lunga di prima (erano nove
  // secondi) perché adesso in fondo alla scala ci sono i **ponti**, che fanno
  // due viaggi invece di uno: il nostro fino a loro, e il loro fino al feed.
  // Nove secondi tagliavano la corda mentre il ponte stava ancora lavorando —
  // e un ponte abortito a metà si segna un no in pagella, cioè viene messo in
  // castigo per una colpa che non ha.
  const PROVIDER_ATTESA_MS = 12000;
  const CORSA_ATTESA_MS = 26000;
  const AFFIANCA_MS = 2400;
  // Le riprove dopo un guasto. La prima è corta di proposito: il caso più
  // comune non è «il servizio è giù», è «questa richiesta è andata storta».
  // Aspettare un minuto pieno, come si faceva prima, trasformava un singolo
  // pacchetto perso in un minuto di cielo senza aerei.
  const RIPROVE_MS = [3000, 9000, 25000, 60000, 150000, 300000];
  const PREVISIONE_MINUTI = 5;
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

  function urlAttraverso(ponte, destinazione) {
    // Il browser deve parlare con il ponte, non con `destinazione`: aggiungere
    // soltanto un'intestazione alla fetch non può correggere il CORS del server
    // remoto. encodeURIComponent impedisce inoltre che i parametri del feed
    // vengano interpretati come parametri del ponte.
    return ponte + encodeURIComponent(destinazione);
  }

  // --- I ponti CORS ---------------------------------------------------
  // Un ponte è un server che rifà la richiesta al posto nostro e rimanda la
  // risposta con l'intestazione che manca. Sono servizi gratuiti di terzi:
  // nessuno di loro promette niente, e smettono di funzionare a turno. Il
  // giorno in cui questa riga è stata scritta, dal sito pubblicato su GitHub
  // Pages **tutte** le porte di prima erano chiuse insieme, e per tre motivi
  // diversi — che è la ragione per cui il mazzo qui sotto è fatto così:
  //
  //   · le quattro reti dirette rispondevano **senza `Access-Control-Allow-Origin`**
  //     (in console: «has been blocked by CORS policy»);
  //   · `corsproxy.io` rispondeva **401** a tutti: ha cominciato a pretendere
  //     una chiave e un'origine registrata, quindi da qui non funzionerà mai
  //     più e non sta più nell'elenco — una porta che non può aprirsi non è
  //     una riserva, è un tentativo buttato a ogni giro;
  //   · `allorigins` rispondeva **408**, cioè era in piedi ma sotto carico.
  //
  // Da lì le due regole di questo elenco. La prima: **infrastrutture
  // diverse**, perché due ponti sulla stessa macchina cadono insieme. La
  // seconda: di ogni ponte vanno dichiarate le due cose che si sbagliano —
  // come vuole l'indirizzo (codificato dentro a un parametro, oppure in
  // chiaro appeso al percorso: codificarlo a chi lo vuole in chiaro dà un 404,
  // ed è l'errore che fa sembrare rotto un ponte che funziona) e se la
  // risposta arriva **dentro a una busta** invece che nuda.
  //
  // E resta il fatto che nessuno di questi è garantito. La sola porta che si
  // possa garantire è quella propria: §2-bis.
  const PONTI = [
    // Passa la risposta così com'è, senza chiave, con CORS aperto: è il più
    // solido del mazzo, ed è per questo che sta davanti.
    { nome: 'CodeTabs', url: d => urlAttraverso('https://api.codetabs.com/v1/proxy?quest=', d) },
    { nome: 'AllOrigins', url: d => urlAttraverso('https://api.allorigins.win/raw?url=', d) },
    { nome: 'Cors.lol', url: d => urlAttraverso('https://api.cors.lol/?url=', d) },
    // Stesso host di AllOrigins, altra porta. Non è un doppione: `/raw` fa da
    // tramite in diretta e va in 408 quando il feed è lento, mentre `/get`
    // serve dalla sua cache e in quel caso risponde lo stesso. La risposta
    // però arriva imbustata in un JSON che parla di sé, e la busta va tolta
    // prima di darla all'interprete.
    { nome: 'AllOrigins (busta)',
      url: d => urlAttraverso('https://api.allorigins.win/get?url=', d),
      sbusta: busta => {
        if (!busta || typeof busta.contents !== 'string') throw schemaSconosciuto('busta AllOrigins');
        return JSON.parse(busta.contents);
      } },
    // Questi due vogliono l'indirizzo **in chiaro**, appeso al loro percorso.
    { nome: 'Worker CORS', url: d => 'https://test.cors.workers.dev/?' + d },
    { nome: 'ThingProxy', url: d => 'https://thingproxy.freeboard.io/fetch/' + d }
  ];

  function providerConPonte(rete, ponte, urlFeed, interpreta = interpretaAdsbExchange) {
    return {
      nome: `${rete} via ${ponte.nome}`,
      rete,
      ponte: ponte.nome,
      url(posizione, raggioKm) { return ponte.url(urlFeed(posizione, raggioKm)); },
      sbusta: ponte.sbusta,
      interpreta
    };
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

  // La scala delle porte, dalla più diretta alla più mediata.
  //
  // Prima le quattro reti dirette: quando il browser le lascia passare sono
  // la strada più breve e più fresca, e costano niente quando non passano —
  // un CORS rifiutato fallisce nell'istante, quindi la corsa scende subito.
  //
  // Poi **OpenSky**, che è la sola porta diretta di un'altra famiglia: non è
  // un mirror readsb come le altre quattro, sta su un'altra infrastruttura e
  // manda il CORS aperto. Ha un contingente giornaliero stretto per chi non
  // si autentica — e quindi risponde 429 volentieri — ma è l'unica riserva
  // che non dipenda dal buon cuore di un ponte pubblico, e il giorno in cui
  // i quattro mirror sono chiusi insieme è quella che salva il cielo. Il suo
  // interprete c'era da sempre in §1 e non era agganciato a nessuna porta:
  // codice scritto, provato, e mai chiamato.
  //
  // Infine i ponti, **ognuno con un feed diverso**: appaiare tutti i ponti
  // allo stesso feed vorrebbe dire che il giorno in cui quel feed è in
  // manutenzione cadono anche loro, cioè rinunciare alla metà della
  // ridondanza che si è appena pagata.
  const providersPredefiniti = [
    providerDiretto('ADSB.fi', urlAdsbFi),
    providerDiretto('adsb.lol', feedAdsbLol),
    providerDiretto('Airplanes.live', feedAirplanesLive),
    providerDiretto('adsb.one', feedAdsbOne),
    providerDiretto('OpenSky', urlOpenSky, interpretaOpenSky),
    providerConPonte('adsb.lol', PONTI[0], feedAdsbLol),
    providerConPonte('ADSB.fi', PONTI[1], urlAdsbFi),
    providerConPonte('Airplanes.live', PONTI[2], feedAirplanesLive),
    providerConPonte('adsb.lol', PONTI[3], feedAdsbLol),
    providerConPonte('adsb.one', PONTI[4], feedAdsbOne),
    providerConPonte('ADSB.fi', PONTI[5], urlAdsbFi),
    providerConPonte('adsb.one', PONTI[0], feedAdsbOne),
    providerConPonte('Airplanes.live', PONTI[1], feedAirplanesLive)
  ];

  // =====================================================================
  // 2-bis. IL PROXY PROPRIO — la sola porta che si possa garantire
  //    Tutto quello che sta sopra è un prestito: gratuito, senza contratto,
  //    e ognuno smette a turno. Un proxy proprio invece risponde sempre,
  //    perché è nostro — è un server che rifà la richiesta e aggiunge
  //    l'intestazione che a GitHub Pages, che serve solo file, non si può
  //    chiedere. Il progetto ne porta uno pronto: `worker-adsb.js`, una
  //    cinquantina di righe di Cloudflare Worker, gratuito fino a centomila
  //    richieste al giorno (vedi ADSB-PROXY.md).
  //
  //    Si può indicare in tre modi, e che siano tre è voluto: `config.js`
  //    (lo scrive il deploy), `window.ADSB_PROXY_URL` (una riga in console) e
  //    il campo del pannello, che scrive in `localStorage` e vale **subito**,
  //    senza ripubblicare il sito. L'ultimo è quello che conta di più: chi si
  //    ritrova il cielo senza aerei vuole rimediare stasera, non al prossimo
  //    rilascio.
  //
  //    Sono ammesse due forme, e si riconoscono da sole: l'indirizzo del
  //    Worker del progetto, e qualunque altro ponte CORS scritto come modello
  //    con `{url}` dentro (`https://mio-ponte.example/?target={url}`).
  // =====================================================================

  const CHIAVE_PROXY = 'astrocalendario_adsb_proxy';

  function proxyProprio() {
    let salvato = '';
    try { salvato = String(localStorage.getItem(CHIAVE_PROXY) || '').trim(); }
    catch (e) { /* niente storage: resta quello scritto dal deploy */ }
    return salvato || String(window.ADSB_PROXY_URL || '').trim();
  }

  function providerDalProxy(indirizzo = proxyProprio()) {
    if (!indirizzo || !/^https:\/\//i.test(indirizzo)) return [];
    // Forma «ponte»: un modello con {url} dentro. Vale per qualunque proxy
    // CORS, compresi quelli che uno si tiene su un dominio suo. Anche qui due
    // feed e non uno: un proxy che funziona non rende buono il feed che c'è
    // dall'altra parte.
    if (indirizzo.indexOf('{url}') !== -1) {
      const ponte = { nome: 'proxy del sito',
        url: d => indirizzo.replace('{url}', encodeURIComponent(d)) };
      return [providerConPonte('adsb.lol', ponte, feedAdsbLol),
              providerConPonte('ADSB.fi', ponte, urlAdsbFi)];
    }
    // Forma «Worker del progetto»: parla la lingua di worker-adsb.js. Il
    // percorso si aggiunge solo se non c'è già — chi incolla l'indirizzo
    // completo non deve ritrovarsi due volte `/api/adsb`, che è un 404 e
    // sembra un Worker rotto.
    const base = indirizzo.replace(/\/+$/, '');
    const conRotta = /\/api\/adsb$/.test(base) ? base : base + '/api/adsb';
    return [{
      nome: 'proxy ADS-B del sito', rete: 'proxy del sito',
      url(posizione, raggioKm) {
        const q = new URLSearchParams({ lat: posizione.lat.toFixed(4), lon: posizione.lon.toFixed(4),
          dist: String(Math.max(1, Math.min(250, Math.ceil(raggioKm / 1.852)))) });
        return `${conRotta}?${q}`;
      },
      interpreta: interpretaAdsbExchange
    }];
  }

  function providersDisponibili() {
    return providerDalProxy().concat(providersPredefiniti);
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
  //    nove porte vorrebbe dire passare da mezzo minuto a due di silenzio.
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

  // Quando cadono **tutte**, il guasto più informativo non è quello di una
  // porta: è la loro forma d'insieme. Nove rifiuti di CORS di fila non sono
  // nove guasti, sono un fatto solo — «da questa rete, verso questi server,
  // il browser non ci lascia passare» — e la cura è un'altra (§2-bis), non
  // riprovare fra tre secondi. Il conto viaggia appeso all'errore perché §6
  // possa dirlo a parole invece di scrivere «Failed to fetch», che è la
  // stessa frase con cui il browser racconta un cavo staccato.
  function riassumi(errore, errori) {
    if (!errore) return errore;
    const bloccate = errori.filter(e => e.cors || e.stato === 401 || e.stato === 403).length;
    errore.provate = errori.length;
    errore.bloccate = bloccate;
    errore.tutteBloccate = errori.length >= 2 && bloccate === errori.length;
    return errore;
  }

  async function scarica(provider, obs, raggio, signal) {
    let risposta;
    try {
      risposta = await fetch(provider.url(obs, raggio), { signal, cache: 'no-store' });
    } catch (e) {
      // Il browser non racconta mai un CORS a chi lo subisce: la fetch
      // fallisce con un `TypeError: Failed to fetch` **identico** a quello di
      // un cavo staccato, e il motivo vero resta soltanto in console, dove
      // nessuno guarda. Da qui non si può sapere quale dei due sia, ma si può
      // dire l'unica cosa che conta e che è vera in tutt'e due i casi: quella
      // porta non ha nemmeno risposto. È il segno che `riassumi` conta.
      if (e && (e.name === 'AbortError' || e.schema)) throw e;
      const guaio = new Error(`${provider.nome}: nessuna risposta (CORS o rete)`);
      guaio.cors = true;
      throw guaio;
    }
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
    // Alcuni ponti non consegnano la risposta nuda: la imbustano in un JSON
    // che parla di sé (`{contents: "…"}`). La busta va tolta **qui** e non
    // nell'interprete, che è quello del feed e non deve sapere niente della
    // strada che la risposta ha fatto per arrivare.
    if (typeof provider.sbusta === 'function') {
      try { dati = provider.sbusta(dati); }
      catch (e) { throw e && e.schema ? e : schemaSconosciuto(provider.ponte || provider.nome); }
    }
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
        else rifiuta(riassumi(errore || peggiore(errori), errori));
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
        const scadenzaSua = setTimeout(propaga, attesaMs);
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
  //    Adesso i dati partono da soli aprendo il planetario e il disegno nasce
  //    spento: quando lo si accende, gli aerei ci sono già.
  // =====================================================================

  const stato = {
    aerei: [], timer: null, richiesta: null, controller: null, ultimoCentro: null,
    dati: true, visibile: false, auto: true,
    ultimoSuccesso: 0, ultimoTentativo: 0, prossimoAggiornamento: 0, prossimoTentativo: 0,
    tentativiFalliti: 0, errore: '', errNome: '', ultimaFonte: '', avviato: false,
    ricaricaDopo: false, ultimoRenderSecondo: null, feedbackRichiesto: false, feedbackTimer: null,
    ultimaFase: '', tutteBloccate: false
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

  function chiaveCentro(p) {
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lon)
      ? `${p.lat.toFixed(4)},${p.lon.toFixed(4)}` : null;
  }

  function datiDelCentroCorrente(obs = osservatore()) {
    return !!(stato.ultimoCentro && chiaveCentro(stato.ultimoCentro) === chiaveCentro(obs));
  }

  // Il cambio del punto di vista e' sincrono, mentre il feed e' asincrono.
  // Svuotare subito evita anche un solo fotogramma con gli aerei del luogo
  // precedente; la risposta vecchia viene abortita e non puo' ripopolare il
  // cielo nuovo.
  function aereiPosizioneCambiata() {
    const obs = osservatore();
    if (datiDelCentroCorrente(obs)) return;
    stato.aerei = [];
    stato.ultimoCentro = null;
    stato.ultimoSuccesso = 0;
    stato.prossimoTentativo = 0;
    stato.prossimoAggiornamento = 0;
    stato.tentativiFalliti = 0;
    stato.errore = '';
    stato.ultimoRenderSecondo = null;
    if (stato.controller) {
      stato.ricaricaDopo = stato.dati;
      stato.controller.abort();
    } else if (stato.dati && tempoReale()) {
      carica(true);
    }
    render();
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
    const obs = osservatore();
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
    passato: { spia: 'vecchio', nota: 'Posizioni stimate: il cielo mostrato non è adesso' }
  };

  function fase() {
    if (!osservatore()) return 'senzaPosizione';
    if (!stato.dati) return 'spento';
    if (stato.richiesta) return 'carico';
    if (!tempoReale()) return 'passato';
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'senzaRete';
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
    // Il caso che va nominato per primo, perché è l'unico che non si cura da
    // solo aspettando: se **nessuna** porta ha risposto, non è una giornata
    // storta di un servizio pubblico — è questa rete, o questo browser, che
    // verso quei server non ci lascia passare. Riprovare non serve, e dirlo
    // «Failed to fetch» manda a cercare nel posto sbagliato.
    if (stato.tutteBloccate) return 'nessuna porta ADS-B raggiungibile da qui (CORS o rete)';
    if (stato.errNome === 'TimeoutError') return 'nessuna rete ADS-B ha risposto in tempo';
    if (stato.errNome === 'AbortError') return 'richiesta interrotta';
    return stato.errore || 'guasto sconosciuto';
  }

  // Il consiglio che chiude il discorso, e solo quando è vero: se le porte
  // sono chiuse tutte e un proxy proprio non c'è, quella è la cura — e sta
  // due dita più in basso, nello stesso pannello che si sta leggendo.
  function consiglioProxy() {
    return stato.tutteBloccate && !proxyProprio()
      ? ' Un proxy proprio è la sola porta che non dipenda da servizi altrui: apri «Proxy ADS-B» qui sotto.'
      : '';
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
        ? `Aggiornamento non riuscito (${guaioLeggibile()}): resta l'ultima lettura di ${eta} (${quanti}).${riprova}${consiglioProxy()}`
        : `Dati ADS-B non disponibili (${guaioLeggibile()}).${riprova}${consiglioProxy()}`;
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
      riga.dataset.errore = (f === 'errore' || f === 'senzaRete' || f === 'senzaPosizione') ? 'true' : 'false';
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
    aggiornaProxyUI();
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
        // Nel frattempo il planetario potrebbe essersi spostato. Una risposta
        // valida per il vecchio centro non deve mai apparire nel nuovo cielo.
        if (chiaveCentro(obs) !== chiaveCentro(osservatore())) return;
        registraTracce(risultato.aerei);
        stato.aerei = arricchisci(risultato.aerei, obs);
        stato.ultimoCentro = obs;
        stato.ultimoSuccesso = Date.now();
        stato.ultimaFonte = risultato.provider.nome;
        stato.errore = ''; stato.errNome = ''; stato.tutteBloccate = false;
        pianificaProssimo(true);
        render();
        concludiFeedback(`Dati ADS-B aggiornati: ${stato.aerei.length} ` +
          `${stato.aerei.length === 1 ? 'aereo trovato' : 'aerei trovati'}.`, false);
      }).catch(e => {
        if (e.name === 'AbortError' && (!stato.dati || stato.ricaricaDopo)) return;
        stato.errore = e.message || 'guasto';
        stato.errNome = e.name || '';
        stato.tutteBloccate = !!e.tutteBloccate;
        stato.tentativiFalliti++;
        // Se sono cadute **tutte** e nessuna ha nemmeno risposto, riprovare
        // fra tre secondi non è insistenza: è bussare tredici volte a tredici
        // porte chiuse ogni tre secondi. La prima riprova corta esiste per il
        // caso comune — *questa* richiesta andata storta — e qui quel caso è
        // escluso per costruzione. Si salta quindi avanti nella scala, senza
        // arrendersi: un filtro anti-tracciamento si spegne, una rete si
        // cambia, e il tasto «Aggiorna adesso» azzera comunque il conto.
        if (e.tutteBloccate) stato.tentativiFalliti = Math.max(stato.tentativiFalliti, 4);
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

  // --- Il proxy proprio, dal pannello ---------------------------------
  // Perché si possa scrivere qui e non solo nel deploy: chi si ritrova il
  // cielo senza aerei vuole rimediare stasera. E perché scriverlo azzera la
  // pagella: le penali di prima parlano delle porte di prima, e tenerle
  // vorrebbe dire far cominciare la porta nuova dal fondo della fila che ha
  // appena reso inutile.
  function aereiImpostaProxy(indirizzo) {
    const pulito = String(indirizzo || '').trim();
    try {
      if (pulito) localStorage.setItem(CHIAVE_PROXY, pulito);
      else localStorage.removeItem(CHIAVE_PROXY);
    } catch (e) { /* niente storage: la scelta vale per questa sessione */ }
    salute.clear(); saluteSalva();
    stato.tentativiFalliti = 0;
    stato.errore = ''; stato.errNome = ''; stato.tutteBloccate = false;
    stato.prossimoAggiornamento = 0; stato.prossimoTentativo = 0;
    aggiornaProxyUI();
    if (stato.dati) carica(true, true); else aggiornaUI();
    return proxyProprio();
  }

  function proxyRacconto() {
    const indirizzo = proxyProprio();
    if (!indirizzo) {
      return 'Nessun proxy: si usano le reti dirette e i ponti pubblici, che nessuno garantisce.';
    }
    if (!/^https:\/\//i.test(indirizzo)) {
      return 'Indirizzo ignorato: deve cominciare con https:// — un proxy in chiaro non lo carica una pagina sicura.';
    }
    return indirizzo.indexOf('{url}') !== -1
      ? 'Ponte proprio in uso (modello con {url}): viene provato per primo, davanti a tutte le altre porte.'
      : 'Worker proprio in uso: viene provato per primo, davanti a tutte le altre porte.';
  }

  function aggiornaProxyUI() {
    const campo = document.getElementById('aerei-proxy-url');
    // Non si riscrive il campo mentre ci si sta scrivendo dentro: il pannello
    // si aggiorna a ogni battito, e un `value` riscritto sotto le dita
    // riporterebbe il cursore in fondo a ogni cinque secondi.
    if (campo && document.activeElement !== campo) {
      let salvato = '';
      try { salvato = localStorage.getItem(CHIAVE_PROXY) || ''; } catch (e) { /* niente storage */ }
      const mostrato = salvato || String(window.ADSB_PROXY_URL || '');
      if (campo.value !== mostrato) campo.value = mostrato;
    }
    scriviTesto('aerei-proxy-stato', proxyRacconto());
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
    if (!datiDelCentroCorrente()) { aereiPosizioneCambiata(); return; }
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
      const punti = a.traiettoria.map(t => skyProietta(skyVettore(t.az, t.alt), base, focale)).filter(p => p.davanti);
      if (!punti.length) return;
      const fascia = fasciaDi(a.distanzaKm);
      ctx.strokeStyle = fascia.colore; ctx.globalAlpha = (fresco ? 0.85 : 0.55);
      ctx.setLineDash([4, 5]); ctx.lineWidth = 1.4;
      ctx.beginPath(); punti.forEach((p, i) => i ? ctx.lineTo(p.px, p.py) : ctx.moveTo(p.px, p.py)); ctx.stroke();
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

  function aereiSchedaHtml(a) {
    const dato = (nome, valore) => valore ? `<li><span class="voce-dato">${nome}:</span> ${sicuro(valore)}</li>` : '';
    const quota = Number.isFinite(a.quotaM) ? `${Math.round(a.quotaM).toLocaleString('it-IT')} m` : 'non comunicata';
    const velocita = Number.isFinite(a.velocitaMs) ? `${Math.round(a.velocitaMs * 3.6)} km/h` : 'non comunicata';
    const fascia = fasciaDi(a.distanzaKm);
    return `<div class="scheda-testata"><h3>✈ ${sicuro(a.callsign || a.id)}</h3></div>` +
      `<p class="aereo-fascia" style="--fascia:${fascia.colore}">` +
      `<span class="aereo-pallino" aria-hidden="true"></span>${sicuro(fascia.nome)}</p>` +
      `<div id="aereo-foto-${sicuro(a.id)}"></div><ul>` +
      dato('Volo', a.callsign) + dato('Registrazione', a.registrazione) + dato('Aeromobile', a.descrizione || a.tipoIcao) +
      dato('Operatore', a.operatore) + dato('Quota', quota) + dato('Velocità', velocita) +
      dato('Rotta', Number.isFinite(a.direzione) ? `${Math.round(a.direzione)}°` : '') +
      dato('Distanza', Number.isFinite(a.distanzaKm) ? `${a.distanzaKm.toFixed(1)} km` : '') +
      `<li id="aereo-rotta-${sicuro(a.id)}"><span class="voce-dato">Itinerario:</span> ricerca in corso…</li>` +
      dato('Codice ICAO', String(a.id || '').toUpperCase()) + dato('Squawk', a.squawk) + '</ul>' +
      `<div class="aereo-azioni"><button type="button" class="tasto-cielo aereo-mappa" data-aereo-id="${sicuro(a.id)}">Rotta sulla mappa</button></div>` +
      `<p class="nota-dettaglio">${a.stimato ? 'Posizione stimata dalla rotta, velocità e salita dell’ultima lettura ADS-B.' :
        'Posizione allineata al feed ADS-B in tempo reale.'}</p>`;
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
    if (titolo) titolo.textContent = `Rotta di ${a.callsign || String(a.id).toUpperCase()}`;
    modale.classList.add('visibile'); modale.setAttribute('aria-hidden', 'false');
    if (!mappaRotta) {
      mappaRotta = L.map(carta, { zoomControl: true, maxZoom: 16 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 16, attribution: '&copy; OpenStreetMap'
      }).addTo(mappaRotta);
    }
    stratiRotta.forEach(s => mappaRotta.removeLayer(s)); stratiRotta = [];
    const chiaveRotta = String(a.callsign || '').trim().replace(/\s+/g, '');
    const rotta = rottaCache.get(chiaveRotta);
    if (rotta && rotta.promessa && !rotta.valore) await rotta.promessa;
    const dettagli = rotta && rotta.valore;
    const osservati = (tracce.get(String(a.id).toLowerCase()) || []).map(p => [p.lat, p.lon]);
    if (!osservati.length) osservati.push([a.lat, a.lon]);
    const previsti = [a, ...[1, 2, 3, 4, 5].map(m => posizioneFutura(a, m * 60))].map(p => [p.lat, p.lon]);
    stratiRotta.push(L.polyline(osservati, { color: '#22d3ee', weight: 4 }).addTo(mappaRotta));
    stratiRotta.push(L.polyline(previsti, { color: '#fb923c', weight: 3, dashArray: '7 7' }).addTo(mappaRotta));
    stratiRotta.push(L.circleMarker([a.lat, a.lon], { radius: 8, color: '#fff', weight: 2,
      fillColor: fasciaDi(a.distanzaKm).colore, fillOpacity: 1 }).bindTooltip('Posizione attuale').addTo(mappaRotta));
    const itinerario = dettagli && dettagli.coordinatePartenza && dettagli.coordinateArrivo
      ? [dettagli.coordinatePartenza, dettagli.coordinateArrivo] : [];
    if (itinerario.length) {
      stratiRotta.push(L.polyline(itinerario, { color: '#2563eb', weight: 4, opacity: .8 }).addTo(mappaRotta));
      stratiRotta.push(L.circleMarker(itinerario[0], { radius: 6, color: '#166534', fillColor: '#22c55e', fillOpacity: 1 })
        .bindTooltip(`Partenza: ${dettagli.partenza}`).addTo(mappaRotta));
      stratiRotta.push(L.circleMarker(itinerario[1], { radius: 6, color: '#991b1b', fillColor: '#ef4444', fillOpacity: 1 })
        .bindTooltip(`Arrivo: ${dettagli.arrivo}`).addTo(mappaRotta));
    }
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
    if (!rotta || (!rotta.partenza && !rotta.arrivo)) {
      box.innerHTML = '<span class="voce-dato">Itinerario:</span> non disponibile'; return;
    }
    const riga = (nome, luogo, ora) => luogo
      ? `<div><span class="voce-dato">${nome}:</span> ${sicuro(luogo)}${ora ? ` · ${sicuro(ora)}` : ''}</div>` : '';
    box.innerHTML = riga('Partenza', rotta.partenza, rotta.oraPartenza) +
      riga('Arrivo', rotta.arrivo, rotta.oraArrivo);
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
    box.innerHTML = `<img class="aereo-foto" src="${sicuro(img.src)}" alt="Foto dell'aereo ${sicuro(a.callsign || id)}">` +
      (foto.photographer ? `<p class="aereo-foto-credito">Foto: ${sicuro(foto.photographer)}</p>` : '');
  }

  // Il raggio delle Impostazioni cambia sia il rettangolo chiesto al provider
  // sia il filtro finale. La vecchia risposta non è quindi riutilizzabile.
  function aereiRaggioCambiato() {
    if (stato.controller) { stato.ricaricaDopo = stato.dati; stato.controller.abort(); }
    stato.aerei = [];
    stato.ultimoSuccesso = 0;
    stato.prossimoAggiornamento = 0;
    stato.prossimoTentativo = 0;
    stato.tentativiFalliti = 0;
    render();
    aggiornaUI();
    if (stato.dati && !stato.richiesta) carica(true);
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
    collega('aerei-proxy-salva', () => {
      const campo = document.getElementById('aerei-proxy-url');
      aereiImpostaProxy(campo ? campo.value : '');
    });
    collega('aerei-proxy-pulisci', () => {
      const campo = document.getElementById('aerei-proxy-url');
      if (campo) campo.value = '';
      aereiImpostaProxy('');
    });
    const campoProxy = document.getElementById('aerei-proxy-url');
    if (campoProxy) campoProxy.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); aereiImpostaProxy(campoProxy.value); }
    });
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
  window.aereiCaricaFoto = aereiCaricaFoto;
  window.aereiRaggioCambiato = aereiRaggioCambiato;
  window.aereiAggiornaAdesso = aereiAggiornaAdesso;
  window.aereiImpostaProxy = aereiImpostaProxy;
  window.aereiPosizioneCambiata = aereiPosizioneCambiata;
  window.aereiTrova = aereiTrova;
  window.AereiADS_B = { distanzaDirezione, posizioneFutura, coordinateCielo, separazione, arricchisci,
    interpretaAdsbExchange, interpretaOpenSky, urlAdsbExchange, urlAdsbFi, urlOpenSky, urlAttraverso,
    scaricaConRipiego, corsaProvider, providersPredefiniti, aereoAdesso, istanteMostratoMs, tempoReale,
    interpretaRotta, aeroportoTesto, aeroportoCoordinate, registraTracce, tracce, stato, providersDisponibili,
    FASCE_DISTANZA, fasciaDi, ordinaPerSalute, salute, segnaEsito, peggiore, fase, testoDiStato,
    intervalloAggiornamento, pianificaProssimo, RIPROVE_MS, DATI_VECCHI_MS, DATI_SCADUTI_MS,
    AGGIORNA_VISIBILE_MS, AGGIORNA_SFONDO_MS, PONTI, providerDalProxy, proxyProprio, riassumi,
    scarica, CHIAVE_PROXY };
}());
