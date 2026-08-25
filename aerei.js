// Aerei nel Planetario — dati ADS-B in tempo reale.
//
// I provider e tutto il trasporto stanno qui: GitHub Pages non puo fare da
// proxy. I feed ADS-B non autorizzano l'origine della PWA, quindi le richieste
// predefinite passano da ponti CORS e provano automaticamente piu strade.
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

  const feedAirplanesLive = (posizione, raggioKm) =>
    urlAdsbExchange('api.airplanes.live', posizione, raggioKm);
  const feedAdsbLol = (posizione, raggioKm) =>
    urlAdsbExchange('api.adsb.lol', posizione, raggioKm);

  // OpenSky restituisce Access-Control-Allow-Origin per il proprio sito, non
  // per GitHub Pages: una fetch diretta viene quindi bloccata dal browser prima
  // che il codice possa leggerne la risposta. Anche i feed readsb non offrono
  // CORS in modo uniforme. Due ponti e due reti ADS-B indipendenti evitano il
  // blocco e non lasciano un singolo punto di guasto. Un eventuale proxy proprio
  // puo sempre essere fornito con window.AEREI_PROVIDER.
  const providersPredefiniti = [
    providerConPonte('adsb.lol', 'https://api.allorigins.win/raw?url=', feedAdsbLol),
    providerConPonte('Airplanes.live', 'https://api.allorigins.win/raw?url=', feedAirplanesLive),
    providerConPonte('adsb.lol', 'https://corsproxy.io/?url=', feedAdsbLol),
    providerConPonte('Airplanes.live', 'https://corsproxy.io/?url=', feedAirplanesLive)
  ];

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
    ultimoRenderSecondo: null };

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
    const p = typeof sky !== 'undefined' && sky.posizione;
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
    return { lat: p.lat, lon: p.lon, quotaM: p.altitudine || p.quota || 0 };
  }

  function arricchisci(aerei, obs) {
    return aerei.map(a => {
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

  async function carica(forza) {
    const obs = osservatore();
    if (!obs) { testoStato('Serve una posizione per cercare gli aerei.', true); return; }
    const ora = Date.now();
    // I provider descrivono soltanto il presente. Lontano dall'ora reale si
    // conserva l'ultima fotografia e la si propaga, senza spacciare per dato
    // storico una nuova lettura appena ricevuta.
    if (!tempoReale()) {
      testoStato('Macchina del tempo: posizioni stimate dall’ultima lettura ADS-B. Torna ad Adesso per i dati in tempo reale.');
      aggiornaPosizioni(); render(); return;
    }
    if (!forza && (ora < stato.prossimoTentativo || ora - stato.ultimoSuccesso < CACHE_MS)) return;
    if (stato.richiesta) return stato.richiesta;
    testoStato('Aggiornamento ADS-B…');
    const providers = window.AEREI_PROVIDER ? [window.AEREI_PROVIDER] : providersPredefiniti;
    const controller = new AbortController();
    stato.controller = controller;
    stato.richiesta = scaricaConRipiego(providers, obs, raggioKm(), controller.signal)
      .then(risultato => {
        if (!stato.acceso) return;
        stato.aerei = arricchisci(risultato.aerei, obs);
        stato.ultimoCentro = obs; stato.ultimoSuccesso = Date.now(); stato.prossimoTentativo = 0; stato.errore = '';
        testoStato(`${stato.aerei.length} aerei · ${risultato.provider.nome} · aggiornato adesso`); render();
      }).catch(e => {
        if (e.name === 'AbortError' && (!stato.acceso || stato.ricaricaDopo)) return;
        stato.errore = e.message; stato.prossimoTentativo = Date.now() + ERRORE_ATTESA_MS;
        testoStato(`Dati ADS-B non disponibili (${e.name === 'TimeoutError' ? 'tempo scaduto' : e.message}). Riprovo fra un minuto.`, true);
      }).finally(() => {
        stato.richiesta = null; stato.controller = null;
        if (stato.ricaricaDopo) { stato.ricaricaDopo = false; carica(true); }
      });
    return stato.richiesta;
  }

  function aereiDisegna(ctx, base, focale) {
    if (!stato.acceso || !stato.aerei.length || typeof skyProietta !== 'function') return;
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
      ctx.strokeStyle = 'rgba(125,211,252,.72)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.2;
      ctx.beginPath(); punti.forEach((p, i) => i ? ctx.lineTo(p.px, p.py) : ctx.moveTo(p.px, p.py)); ctx.stroke();
      const p = punti[0]; ctx.setLineDash([]); ctx.fillStyle = a.allineamenti.length ? '#fbbf24' : '#7dd3fc';
      ctx.beginPath(); ctx.moveTo(p.px, p.py - 7); ctx.lineTo(p.px + 6, p.py + 5); ctx.lineTo(p.px, p.py + 2); ctx.lineTo(p.px - 6, p.py + 5); ctx.closePath(); ctx.fill();
      ctx.font = '600 11px system-ui'; ctx.fillText(a.callsign, p.px + 9, p.py + 4);
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
      stato.ultimoRenderSecondo = null;
      render();
      if (typeof skyChiudiDettaglio === 'function' && typeof sky !== 'undefined' &&
        sky.selezione && sky.selezione.categoria === 'aereo') skyChiudiDettaglio();
    }
  }

  function aereoNelPunto(px, py, base, focale) {
    if (!stato.acceso || typeof skyProietta !== 'function') return null;
    aggiornaPosizioni();
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
      `<p class="nota-dettaglio">${a.stimato ? 'Posizione stimata dalla rotta, velocità e salita dell’ultima lettura ADS-B.' :
        'Posizione allineata al feed ADS-B in tempo reale.'}</p>`;
  }

  const rottaCache = new Map();

  function aeroportoTesto(aeroporto) {
    if (!aeroporto) return '';
    const codice = aeroporto.iata_code || aeroporto.iata || aeroporto.icao_code || aeroporto.icao || '';
    const luogo = aeroporto.municipality || aeroporto.city || aeroporto.name || '';
    return [luogo, codice && `(${codice})`].filter(Boolean).join(' ');
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
      oraPartenza: orarioRotta(rotta, 'departure'), oraArrivo: orarioRotta(rotta, 'arrival')
    };
  }

  async function aereiCaricaRotta(a) {
    const callsign = String(a.callsign || '').trim().replace(/\s+/g, '');
    const box = document.getElementById(`aereo-rotta-${a.id}`);
    if (!box || !callsign) return;
    if (!rottaCache.has(callsign)) {
      rottaCache.set(callsign, fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`,
        { cache: 'force-cache' }).then(r => r.ok ? r.json() : null).then(interpretaRotta).catch(() => null));
    }
    const rotta = await rottaCache.get(callsign);
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

  document.addEventListener('DOMContentLoaded', () => {
    const aggiorna = document.getElementById('aerei-aggiorna');
    if (aggiorna) aggiorna.addEventListener('click', () => carica(true));
  });

  window.aereiAvvia = aereiAvvia;
  window.aereiFerma = aereiFerma;
  window.aereiDisegna = aereiDisegna;
  window.aereiImpostaAccesi = aereiImpostaAccesi;
  window.aereoNelPunto = aereoNelPunto;
  window.aereiSchedaHtml = aereiSchedaHtml;
  window.aereiCaricaFoto = aereiCaricaFoto;
  window.aereiRaggioCambiato = aereiRaggioCambiato;
  window.AereiADS_B = { distanzaDirezione, posizioneFutura, coordinateCielo, separazione, arricchisci,
    interpretaAdsbExchange, interpretaOpenSky, urlAdsbExchange, urlAdsbFi, urlOpenSky, urlAttraverso,
    scaricaConRipiego, providersPredefiniti, aereoAdesso, istanteMostratoMs, tempoReale,
    interpretaRotta, aeroportoTesto, stato };
}());
