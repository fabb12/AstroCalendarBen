// Aerei nel Planetario — dati ADS-B in tempo reale.
//
// I provider e tutto il trasporto stanno qui: GitHub Pages non puo fare da
// proxy. Alcuni feed ADS-B autorizzano le richieste del browser solo in modo
// intermittente o differente secondo la rete: si provano prima i feed diretti
// e poi, se il CORS li blocca, due ponti indipendenti.
(function () {
  'use strict';

  // I ponti CORS sono servizi condivisi: cinque minuti fra le letture evitano
  // di consumarne la quota in poche ore. Nel frattempo la traiettoria viene
  // proiettata localmente qui sotto.
  const CACHE_MS = 290000;
  const INTERVALLO_MS = 300000;
  const ERRORE_ATTESA_MS = 60000;
  const PROVIDER_ATTESA_MS = 12000;
  const PREVISIONE_MINUTI = 5;
  const SOGLIA_TEMPO_REALE_MS = 30000;
  const SOGLIA_ALLINEAMENTO = 1;
  const TERRA_KM = 6371;
  const TRACCIA_MASSIMO_PUNTI = 120;
  const TRACCIA_DURATA_MS = 2 * 60 * 60 * 1000;
  const hitEtichette = [];

  function numero(valore) {
    const n = Number(valore);
    return Number.isFinite(n) ? n : null;
  }

  function interpretaAdsbExchange(risposta) {
    // I mirror readsb usano normalmente `ac`; alcuni rilasciano lo stesso
    // elenco come `aircraft`. Accettare entrambi evita falsi "zero aerei".
    return (risposta.ac || risposta.aircraft || []).map(a => {
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
    return (risposta.states || []).map(a => ({
      id: a[0], callsign: String(a[1] || '').trim() || String(a[0] || '').toUpperCase(),
      registrazione: '', tipoIcao: '', descrizione: '', operatore: '', squawk: String(a[14] || ''),
      lon: numero(a[5]), lat: numero(a[6]), quotaM: numero(a[13]) ?? numero(a[7]),
      aTerra: !!a[8], velocitaMs: numero(a[9]) || 0, direzione: numero(a[10]),
      salitaMs: numero(a[11]) || 0, ultimaLettura: numero(a[4]) || numero(a[3])
    })).filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lon));
  }

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

  function providerConPonte(nome, ponte, urlFeed, interpreta = interpretaAdsbExchange) {
    return {
      nome: `${nome} via ${ponte.indexOf('allorigins') !== -1 ? 'AllOrigins' : 'CorsProxy.io'}`,
      url(posizione, raggioKm) {
        return urlAttraverso(ponte, urlFeed(posizione, raggioKm));
      },
      interpreta
    };
  }

  function providerDiretto(nome, urlFeed, interpreta = interpretaAdsbExchange) {
    return { nome, url: urlFeed, interpreta };
  }

  const feedAirplanesLive = (posizione, raggioKm) =>
    urlAdsbExchange('api.airplanes.live', posizione, raggioKm);
  const feedAdsbLol = (posizione, raggioKm) =>
    urlAdsbExchange('api.adsb.lol', posizione, raggioKm);

  // Non affidare il percorso normale soltanto a un proxy CORS pubblico. I
  // filtri anti-tracciamento usati soprattutto sui browser desktop possono
  // bloccare AllOrigins o CorsProxy.io anche quando il feed ADS-B è
  // raggiungibile. I feed diretti vengono quindi tentati per primi: se il
  // browser ne rifiuta il CORS, fetch fallisce e scaricaConRipiego passa subito
  // ai ponti. ADSB.fi aggiunge anche una terza rete indipendente. Un eventuale
  // proxy proprio può sempre essere fornito con window.AEREI_PROVIDER.
  const providersPredefiniti = [
    providerDiretto('ADSB.fi', urlAdsbFi),
    providerDiretto('adsb.lol', feedAdsbLol),
    providerDiretto('Airplanes.live', feedAirplanesLive),
    providerConPonte('adsb.lol', 'https://api.allorigins.win/raw?url=', feedAdsbLol),
    providerConPonte('Airplanes.live', 'https://api.allorigins.win/raw?url=', feedAirplanesLive),
    providerConPonte('adsb.lol', 'https://corsproxy.io/?url=', feedAdsbLol),
    providerConPonte('Airplanes.live', 'https://corsproxy.io/?url=', feedAirplanesLive)
  ];

  function providersDisponibili() {
    const proxy = String(window.ADSB_PROXY_URL || '').trim().replace(/\/$/, '');
    const propri = proxy ? [{
      nome: 'proxy ADS-B del sito',
      url(posizione, raggioKm) {
        const q = new URLSearchParams({ lat: posizione.lat.toFixed(4), lon: posizione.lon.toFixed(4),
          dist: String(Math.max(1, Math.ceil(raggioKm / 1.852))) });
        return `${proxy}/api/adsb?${q}`;
      },
      interpreta: interpretaAdsbExchange
    }] : [];
    return propri.concat(providersPredefiniti);
  }

  async function scarica(provider, obs, raggio, signal) {
    const risposta = await fetch(provider.url(obs, raggio), { signal, cache: 'no-store' });
    if (risposta.status === 429) {
      const errore = new Error('limite di richieste raggiunto'); errore.rateLimit = true; throw errore;
    }
    if (!risposta.ok) throw new Error(`risposta ${risposta.status}`);
    return provider.interpreta(await risposta.json());
  }

  async function scaricaConRipiego(providers, obs, raggio, signal, attesaMs = PROVIDER_ATTESA_MS) {
    if (!providers.length) return Promise.reject(new Error('nessun servizio disponibile'));
    const errori = [];

    // Ogni tentativo ha una propria scadenza: così un ponte fermo non blocca
    // il successivo, ma non bombardiamo più entrambi i ponti e tutti i feed
    // nello stesso istante. Un 429 passa immediatamente al provider seguente.
    for (const provider of providers) {
      if (signal && signal.aborted) {
        const e = new Error('richiesta annullata'); e.name = 'AbortError'; throw e;
      }
      const controller = new AbortController();
      const annulla = () => controller.abort();
      if (signal) signal.addEventListener('abort', annulla, { once: true });
      const sveglia = setTimeout(annulla, attesaMs);
      try {
        const aerei = await scarica(provider, obs, raggio, controller.signal);
        return { provider, aerei };
      } catch (errore) {
        if (signal && signal.aborted) {
          const e = new Error('richiesta annullata'); e.name = 'AbortError'; throw e;
        }
        if (errore.name === 'AbortError') {
          const e = new Error(`tempo scaduto per ${provider.nome}`); e.name = 'TimeoutError';
          errori.push(e);
        } else errori.push(errore);
      } finally {
        clearTimeout(sveglia);
        if (signal) signal.removeEventListener('abort', annulla);
      }
    }

    // Non attribuire l'intero guasto al primo 429 se un altro servizio ha
    // risposto con un errore differente. Il messaggio resta così attendibile.
    throw errori.find(e => !e.rateLimit && e.name !== 'TimeoutError') ||
      errori.find(e => e.name === 'TimeoutError') || errori[0] ||
      new Error('nessun servizio disponibile');
  }

  const stato = { aerei: [], timer: null, richiesta: null, controller: null, ultimoCentro: null,
    acceso: false,
    ultimoSuccesso: 0, prossimoTentativo: 0, errore: '', avviato: false, ricaricaDopo: false,
    ultimoRenderSecondo: null, feedbackRichiesto: false, feedbackTimer: null };
  // Le risposte dei provider sono fotografie, non una rotta. Conservare i
  // punti successivi per ICAO permette di ricostruire il tratto realmente
  // osservato senza confonderlo con la previsione tratteggiata dei 5 minuti.
  const tracce = new Map();
  let mappaRotta = null;
  let stratiRotta = [];

  function raggioKm() {
    return typeof raggioAerei === 'function' ? raggioAerei() : 10;
  }

  function radianti(g) { return g * Math.PI / 180; }
  function gradi(r) { return r * 180 / Math.PI; }
  function limita180(g) { return ((g + 540) % 360) - 180; }

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
    stato.ultimoRenderSecondo = null;
    if (stato.controller) {
      stato.ricaricaDopo = stato.acceso;
      stato.controller.abort();
    } else if (stato.acceso && tempoReale()) {
      carica(true);
    }
    testoStato(obs ? 'Nuova posizione: caricamento dati ADS-B…' :
      'Serve una posizione per cercare gli aerei.', !obs);
    render();
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
    if (!stato.acceso) return [];
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

  function testoStato(testo, errore) {
    const el = document.getElementById('aerei-stato');
    if (el) { el.textContent = testo; el.dataset.errore = errore ? 'true' : 'false'; }
  }

  // Il tasto rapido resta visibile anche quando il pannello ADS-B e' chiuso:
  // stato, esito e problemi devono quindi comparire anche sul cielo, non solo
  // nella riga aerei-stato nascosta dentro al pannello.
  function feedbackAggiornamento(testo, concluso, errore) {
    const normale = document.getElementById('aerei-aggiorna');
    const rapido = document.getElementById('aerei-aggiorna-rapido');
    clearTimeout(stato.feedbackTimer);
    [normale, rapido].forEach(b => {
      if (!b) return;
      b.disabled = !concluso;
      b.setAttribute('aria-busy', concluso ? 'false' : 'true');
      b.dataset.esito = concluso ? (errore ? 'errore' : 'successo') : 'caricamento';
    });
    if (normale) normale.textContent = concluso ? (errore ? 'Non riuscito' : 'Aggiornato ✓') : 'Aggiornamento…';
    if (rapido) {
      rapido.textContent = concluso ? (errore ? '!' : '✓') : '…';
      rapido.setAttribute('aria-label', testo);
    }
    if (typeof skyAvviso === 'function') skyAvviso('adsb', testo, concluso ? 6000 : undefined);
    if (concluso) {
      stato.feedbackTimer = setTimeout(() => {
        if (normale) { normale.textContent = 'Aggiorna'; delete normale.dataset.esito; }
        if (rapido) {
          rapido.textContent = '↻'; delete rapido.dataset.esito;
          rapido.setAttribute('aria-label', 'Aggiorna adesso i dati ADS-B');
        }
      }, 2500);
    }
  }

  function render() {
    aggiornaAllineamenti();
    const box = document.getElementById('aerei-elenco');
    if (!box) return;
    if (!stato.aerei.length) { box.innerHTML = '<p class="etichetta-comando">Nessun aereo ADS-B rilevato nel raggio scelto.</p>'; return; }
    const inDiretta = tempoReale();
    box.innerHTML = stato.aerei.map(a => {
      const all = a.allineamenti[0];
      return `<article class="aereo-riga"><strong>${sicuro(a.callsign)}</strong>` +
        `<p class="aereo-dati">${Math.round(a.quotaM || 0).toLocaleString('it-IT')} m · ` +
        `${Math.round((a.velocitaMs || 0) * 3.6)} km/h · ${Math.round(a.direzione || 0)}° · ` +
        `${a.distanzaKm.toFixed(1)} km · ${inDiretta ? 'posizione in tempo reale' : 'posizione stimata'}</p>` +
        (all ? `<p class="aereo-allineamento">Possibile allineamento con ${sicuro(all.nome)} ` +
          `${all.minuti ? `fra ${all.minuti} min` : 'adesso'} (${all.scarto.toFixed(1)}°)</p>` : '') + '</article>';
    }).join('');
  }

  function sicuro(s) { const e = document.createElement('span'); e.textContent = String(s); return e.innerHTML; }

  async function carica(forza, mostraFeedback) {
    if (mostraFeedback) {
      stato.feedbackRichiesto = true;
      feedbackAggiornamento('Aggiornamento dei dati ADS-B in corso…', false);
    }
    const obs = osservatore();
    if (!obs) {
      testoStato('Serve una posizione per cercare gli aerei.', true);
      if (stato.feedbackRichiesto) {
        stato.feedbackRichiesto = false;
        feedbackAggiornamento('Aggiornamento ADS-B non riuscito: serve una posizione.', true, true);
      }
      return;
    }
    const ora = Date.now();
    // I provider descrivono soltanto il presente. Lontano dall'ora reale si
    // conserva l'ultima fotografia e la si propaga, senza spacciare per dato
    // storico una nuova lettura appena ricevuta.
    if (!tempoReale()) {
      testoStato('Macchina del tempo: posizioni stimate dall’ultima lettura ADS-B. Torna ad Adesso per i dati in tempo reale.');
      if (stato.feedbackRichiesto) {
        stato.feedbackRichiesto = false;
        feedbackAggiornamento('Dati ADS-B non aggiornati: torna ad Adesso per caricare le posizioni in tempo reale.', true, true);
      }
      aggiornaPosizioni(); render(); return;
    }
    if (!forza && (ora < stato.prossimoTentativo || ora - stato.ultimoSuccesso < CACHE_MS)) return;
    if (stato.richiesta) return stato.richiesta;
    testoStato('Aggiornamento ADS-B…');
    const providers = window.AEREI_PROVIDER ? [window.AEREI_PROVIDER] : providersDisponibili();
    const controller = new AbortController();
    stato.controller = controller;
    stato.richiesta = scaricaConRipiego(providers, obs, raggioKm(), controller.signal)
      .then(risultato => {
        if (!stato.acceso) return;
        // Nel frattempo il planetario potrebbe essersi spostato. Una risposta
        // valida per il vecchio centro non deve mai apparire nel nuovo cielo.
        if (chiaveCentro(obs) !== chiaveCentro(osservatore())) return;
        registraTracce(risultato.aerei);
        stato.aerei = arricchisci(risultato.aerei, obs);
        stato.ultimoCentro = obs; stato.ultimoSuccesso = Date.now(); stato.prossimoTentativo = 0; stato.errore = '';
        testoStato(`${stato.aerei.length} aerei · ${risultato.provider.nome} · aggiornato adesso`); render();
        if (stato.feedbackRichiesto) {
          stato.feedbackRichiesto = false;
          feedbackAggiornamento(`Dati ADS-B aggiornati: ${stato.aerei.length} ${stato.aerei.length === 1 ? 'aereo trovato' : 'aerei trovati'}.`, true, false);
        }
      }).catch(e => {
        if (e.name === 'AbortError' && (!stato.acceso || stato.ricaricaDopo)) return;
        stato.errore = e.message; stato.prossimoTentativo = Date.now() + ERRORE_ATTESA_MS;
        testoStato(`Dati ADS-B non disponibili (${e.name === 'TimeoutError' ? 'tempo scaduto' : e.message}). Riprovo fra un minuto.`, true);
        if (stato.feedbackRichiesto) {
          stato.feedbackRichiesto = false;
          feedbackAggiornamento(`Aggiornamento ADS-B non riuscito: ${e.name === 'TimeoutError' ? 'tempo scaduto' : e.message}.`, true, true);
        }
      }).finally(() => {
        stato.richiesta = null; stato.controller = null;
        if (stato.ricaricaDopo) { stato.ricaricaDopo = false; carica(true); }
      });
    return stato.richiesta;
  }

  function aereiDisegna(ctx, base, focale) {
    hitEtichette.length = 0;
    if (!stato.acceso || !stato.aerei.length || typeof skyProietta !== 'function') return;
    if (!datiDelCentroCorrente()) { aereiPosizioneCambiata(); return; }
    aggiornaPosizioni();
    aggiornaAllineamenti();
    const secondo = Math.floor(istanteMostratoMs() / 1000);
    if (secondo !== stato.ultimoRenderSecondo) {
      stato.ultimoRenderSecondo = secondo;
      render();
    }
    ctx.save();
    stato.aerei.forEach(a => {
      const punti = a.traiettoria.map(t => skyProietta(skyVettore(t.az, t.alt), base, focale)).filter(p => p.davanti);
      if (!punti.length) return;
      // Arancio e blu notte restano distinguibili sia sul cielo azzurro del
      // giorno sia sul fondo scuro notturno. La distanza sta accanto al volo:
      // non serve aprire la scheda e l'etichetta rimane su una sola riga.
      ctx.strokeStyle = 'rgba(251,146,60,.88)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.4;
      ctx.beginPath(); punti.forEach((p, i) => i ? ctx.lineTo(p.px, p.py) : ctx.moveTo(p.px, p.py)); ctx.stroke();
      const p = punti[0]; ctx.setLineDash([]); ctx.fillStyle = a.allineamenti.length ? '#facc15' : '#fb923c';
      // Il muso segue la rotta proiettata sullo schermo. Il triangolo di base
      // guarda verso l'alto, quindi l'angolo della prima porzione visibile
      // della previsione va aumentato di 90 gradi. Usare la traiettoria, e non
      // direttamente l'heading in gradi, tiene conto anche della prospettiva
      // del planetario e dell'inclinazione del telefono.
      const avanti = punti.slice(1).find(q => Math.hypot(q.px - p.px, q.py - p.py) > .5);
      const angolo = avanti ? Math.atan2(avanti.py - p.py, avanti.px - p.px) + Math.PI / 2 : 0;
      ctx.save();
      ctx.translate(p.px, p.py); ctx.rotate(angolo);
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 5); ctx.lineTo(0, 2); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
      const etichetta = `${a.callsign} · ${a.distanzaKm.toFixed(1)} km`;
      ctx.font = '700 11px system-ui';
      const x = p.px + 9, y = p.py - 7, larghezza = ctx.measureText(etichetta).width + 10;
      ctx.fillStyle = 'rgba(8,25,45,.90)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, larghezza, 18, 5);
      else ctx.rect(x, y, larghezza, 18);
      ctx.fill();
      ctx.fillStyle = '#fff7ed'; ctx.fillText(etichetta, x + 5, y + 12.5);
      hitEtichette.push({ x, y, larghezza, altezza: 18, aereo: a });
    });
    ctx.restore();
  }

  function aereiAvvia() {
    if (!stato.acceso || stato.avviato) return;
    stato.avviato = true; carica(false);
    stato.timer = setInterval(() => { if (typeof sky !== 'undefined' && sky.aperto) carica(false); }, INTERVALLO_MS);
  }
  function aereiFerma() { clearInterval(stato.timer); stato.timer = null; stato.avviato = false; }

  function aereiImpostaAccesi(accesi) {
    stato.acceso = !!accesi;
    // Il colore del tasto descrive il feed, non soltanto il pannello aperto:
    // una scheda puo chiudere il pannello mentre gli aerei restano accesi.
    if (typeof skyTasto === 'function') skyTasto('skymap-btn-aerei', stato.acceso);
    if (stato.acceso) {
      // Se il feed e' stato riacceso mentre la richiesta dello spegnimento
      // sta terminando, riparti appena il suo finally ha liberato il posto.
      if (stato.richiesta && stato.controller && stato.controller.signal.aborted) stato.ricaricaDopo = true;
      aereiAvvia(); render();
    } else {
      aereiFerma();
      // Una risposta gia in volo non deve ripopolare la mappa dopo lo
      // spegnimento. Svuotare anche la fotografia rende immediato il nuovo
      // fotogramma senza aerei e impedisce che dati ADS-B spenti riappaiano.
      stato.ricaricaDopo = false;
      if (stato.controller) stato.controller.abort();
      stato.aerei = [];
      // La fotografia e il suo timestamp sono una cosa sola. Lasciare valido
      // il timestamp dopo avere vuotato la fotografia faceva saltare la
      // richiesta alla riaccensione e mostrava, per quasi cinque minuti,
      // un falso "nessun aereo".
      stato.ultimoSuccesso = 0;
      stato.prossimoTentativo = 0;
      stato.ultimoRenderSecondo = null;
      render();
      if (typeof skyChiudiDettaglio === 'function' && typeof sky !== 'undefined' &&
        sky.selezione && sky.selezione.categoria === 'aereo') skyChiudiDettaglio();
    }
  }

  function aereoNelPunto(px, py, base, focale) {
    if (!stato.acceso || typeof skyProietta !== 'function') return null;
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
    return `<div class="scheda-testata"><h3>✈ ${sicuro(a.callsign || a.id)}</h3></div>` +
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
      fillColor: '#fb923c', fillOpacity: 1 }).bindTooltip('Posizione attuale').addTo(mappaRotta));
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
    if (stato.controller) { stato.ricaricaDopo = stato.avviato; stato.controller.abort(); }
    stato.aerei = [];
    stato.ultimoSuccesso = 0;
    stato.prossimoTentativo = 0;
    render();
    if (stato.avviato && !stato.richiesta) carica(true);
  }

  function aereiAggiornaAdesso() {
    stato.feedbackRichiesto = true;
    feedbackAggiornamento('Aggiornamento dei dati ADS-B in corso…', false);
    if (!stato.acceso) aereiImpostaAccesi(true);
    // Un secondo tocco durante una richiesta non deve andare perso: annulla
    // la fotografia in corso e ne programma subito una nuova.
    if (stato.richiesta && stato.controller) {
      stato.ricaricaDopo = true;
      stato.controller.abort();
      return stato.richiesta;
    }
    return carica(true, true);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const aggiorna = document.getElementById('aerei-aggiorna');
    const aggiornaRapido = document.getElementById('aerei-aggiorna-rapido');
    const chiudiPannello = document.getElementById('aerei-pannello-chiudi');
    if (aggiorna) aggiorna.addEventListener('click', aereiAggiornaAdesso);
    if (aggiornaRapido) aggiornaRapido.addEventListener('click', e => {
      e.stopPropagation();
      aereiAggiornaAdesso();
    });
    if (chiudiPannello) chiudiPannello.addEventListener('click', () => {
      if (typeof skyMostraGruppo === 'function') skyMostraGruppo('');
    });
    document.addEventListener('click', e => {
      const tracking = e.target.closest && e.target.closest('.aereo-tracking');
      const mappa = e.target.closest && e.target.closest('.aereo-mappa');
      if (tracking) aereiAlternaTracking(tracking.dataset.aereoId);
      if (mappa) aereiMostraMappa(mappa.dataset.aereoId);
      if (e.target.closest && e.target.closest('[data-chiudi-rotta-aereo]')) chiudiMappaRotta();
    });
  });

  window.aereiAvvia = aereiAvvia;
  window.aereiFerma = aereiFerma;
  window.aereiDisegna = aereiDisegna;
  window.aereiImpostaAccesi = aereiImpostaAccesi;
  window.aereoNelPunto = aereoNelPunto;
  window.aereiSchedaHtml = aereiSchedaHtml;
  window.aereiCaricaFoto = aereiCaricaFoto;
  window.aereiRaggioCambiato = aereiRaggioCambiato;
  window.aereiAggiornaAdesso = aereiAggiornaAdesso;
  window.aereiPosizioneCambiata = aereiPosizioneCambiata;
  window.aereiTrova = aereiTrova;
  window.AereiADS_B = { distanzaDirezione, posizioneFutura, coordinateCielo, separazione, arricchisci,
    interpretaAdsbExchange, interpretaOpenSky, urlAdsbExchange, urlAdsbFi, urlOpenSky, urlAttraverso,
    scaricaConRipiego, providersPredefiniti, aereoAdesso, istanteMostratoMs, tempoReale,
    interpretaRotta, aeroportoTesto, aeroportoCoordinate, registraTracce, tracce, stato, providersDisponibili };
}());
