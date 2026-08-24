// Aerei nel Planetario — dati ADS-B in tempo reale.
//
// I provider e tutto il trasporto stanno qui: GitHub Pages non puo fare da
// proxy e OpenSky non autorizza le richieste CORS provenienti dal sito. Usiamo
// quindi un ponte CORS pubblico davanti ai feed ADS-B, con ripiego automatico.
(function () {
  'use strict';

  const CACHE_MS = 10000;
  const INTERVALLO_MS = 15000;
  const ERRORE_ATTESA_MS = 60000;
  const PROVIDER_ATTESA_MS = 12000;
  const PREVISIONE_MINUTI = 5;
  const SOGLIA_ALLINEAMENTO = 1;
  const TERRA_KM = 6371;

  function numero(valore) {
    const n = Number(valore);
    return Number.isFinite(n) ? n : null;
  }

  function interpretaAdsbExchange(risposta) {
    return (risposta.ac || []).map(a => {
      const quotaPiedi = numero(a.alt_baro) ?? numero(a.alt_geom);
      const vistoSecondiFa = numero(a.seen);
      return {
        id: a.hex, callsign: (a.flight || '').trim() || String(a.hex || '').toUpperCase(),
        lon: numero(a.lon), lat: numero(a.lat),
        quotaM: quotaPiedi === null ? null : quotaPiedi * 0.3048,
        aTerra: a.alt_baro === 'ground', velocitaMs: (numero(a.gs) || 0) * 0.514444,
        direzione: numero(a.track), salitaMs: (numero(a.baro_rate) || 0) * 0.00508,
        ultimaLettura: Math.floor(Date.now() / 1000 - (vistoSecondiFa || 0))
      };
    }).filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lon));
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

  function providerConPonte(nome, ponte, urlFeed) {
    return {
      nome: `${nome} via ${ponte.indexOf('allorigins') !== -1 ? 'AllOrigins' : 'CorsProxy.io'}`,
      url(posizione, raggioKm) {
        return urlAttraverso(ponte, urlFeed(posizione, raggioKm));
      },
      interpreta: interpretaAdsbExchange
    };
  }

  const feedAirplanesLive = (posizione, raggioKm) =>
    urlAdsbExchange('api.airplanes.live', posizione, raggioKm);
  const feedAdsbLol = (posizione, raggioKm) =>
    urlAdsbExchange('api.adsb.lol', posizione, raggioKm);

  // I feed non inviano Access-Control-Allow-Origin a GitHub Pages. Interrogarli
  // direttamente produce esattamente l'errore CORS visto in console e nessun
  // ripiego JavaScript può leggere quella risposta. Due ponti indipendenti
  // evitano sia quel blocco sia un singolo punto di guasto; ciascuno prova due
  // reti ADS-B indipendenti.
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

  function scaricaConRipiego(providers, obs, raggio, signal, attesaMs = PROVIDER_ATTESA_MS) {
    if (!providers.length) return Promise.reject(new Error('nessun servizio disponibile'));

    // Non mettere i provider in fila dietro a un'unica sveglia: se il primo
    // accetta la connessione ma non manda mai una risposta, consumerebbe tutta
    // l'attesa e il ripiego non verrebbe neppure interrogato. Le due richieste
    // indipendenti partono insieme; la prima risposta valida vince e spegne le
    // altre. Ogni host ha comunque il proprio limite, così nessuna fetch resta
    // appesa dopo la chiusura del planetario.
    return new Promise((risolvi, rifiuta) => {
      const controllori = providers.map(() => new AbortController());
      const errori = [];
      let rimasti = providers.length;
      let conclusa = false;

      function annullaTutti() { controllori.forEach(c => c.abort()); }
      function annullataDaFuori() {
        if (conclusa) return;
        conclusa = true; annullaTutti();
        const e = new Error('richiesta annullata'); e.name = 'AbortError'; rifiuta(e);
      }
      if (signal && signal.aborted) { annullataDaFuori(); return; }
      if (signal) signal.addEventListener('abort', annullataDaFuori, { once: true });

      providers.forEach((provider, indice) => {
        const controller = controllori[indice];
        const sveglia = setTimeout(() => controller.abort(), attesaMs);
        scarica(provider, obs, raggio, controller.signal).then(aerei => {
          if (conclusa) return;
          conclusa = true;
          clearTimeout(sveglia); annullaTutti();
          risolvi({ provider, aerei });
        }).catch(errore => {
          clearTimeout(sveglia);
          if (conclusa) return;
          errori[indice] = errore;
          rimasti--;
          if (!rimasti) {
            conclusa = true;
            const utile = errori.find(e => e && e.name !== 'AbortError');
            const e = utile || new Error('tempo scaduto');
            if (!utile) e.name = 'TimeoutError';
            rifiuta(e);
          }
        });
      });
    });
  }

  const stato = { aerei: [], timer: null, richiesta: null, controller: null, ultimoCentro: null,
    ultimoSuccesso: 0, prossimoTentativo: 0, errore: '', avviato: false, ricaricaDopo: false };

  function raggioKm() {
    return typeof raggioAerei === 'function' ? raggioAerei() : 100;
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
      return { ...a, ...cielo, traiettoria, allineamenti: [] };
    }).filter(a => a.distanzaKm <= raggioKm()).sort((a, b) => a.distanzaKm - b.distanzaKm);
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
    box.innerHTML = stato.aerei.map(a => {
      const all = a.allineamenti[0];
      return `<article class="aereo-riga"><strong>${sicuro(a.callsign)}</strong>` +
        `<p class="aereo-dati">${Math.round(a.quotaM || 0).toLocaleString('it-IT')} m · ` +
        `${Math.round((a.velocitaMs || 0) * 3.6)} km/h · ${Math.round(a.direzione || 0)}° · ` +
        `${a.distanzaKm.toFixed(1)} km</p>` +
        (all ? `<p class="aereo-allineamento">Possibile allineamento con ${sicuro(all.nome)} ` +
          `${all.minuti ? `fra ${all.minuti} min` : 'adesso'} (${all.scarto.toFixed(1)}°)</p>` : '') + '</article>';
    }).join('');
  }

  function sicuro(s) { const e = document.createElement('span'); e.textContent = String(s); return e.innerHTML; }

  async function carica(forza) {
    const obs = osservatore();
    if (!obs) { testoStato('Serve una posizione per cercare gli aerei.', true); return; }
    const ora = Date.now();
    if (!forza && (ora < stato.prossimoTentativo || ora - stato.ultimoSuccesso < CACHE_MS)) return;
    if (stato.richiesta) return stato.richiesta;
    testoStato('Aggiornamento ADS-B…');
    const providers = window.AEREI_PROVIDER ? [window.AEREI_PROVIDER] : providersPredefiniti;
    const controller = new AbortController();
    stato.controller = controller;
    stato.richiesta = scaricaConRipiego(providers, obs, raggioKm(), controller.signal)
      .then(risultato => {
        stato.aerei = arricchisci(risultato.aerei, obs);
        stato.ultimoCentro = obs; stato.ultimoSuccesso = Date.now(); stato.prossimoTentativo = 0; stato.errore = '';
        testoStato(`${stato.aerei.length} aerei · ${risultato.provider.nome} · aggiornato adesso`); render();
      }).catch(e => {
        if (e.name === 'AbortError' && stato.ricaricaDopo) return;
        stato.errore = e.message; stato.prossimoTentativo = Date.now() + ERRORE_ATTESA_MS;
        testoStato(`Dati ADS-B non disponibili (${e.name === 'TimeoutError' ? 'tempo scaduto' : e.message}). Riprovo fra un minuto.`, true);
      }).finally(() => {
        stato.richiesta = null; stato.controller = null;
        if (stato.ricaricaDopo) { stato.ricaricaDopo = false; carica(true); }
      });
    return stato.richiesta;
  }

  function aereiDisegna(ctx, base, focale) {
    if (!stato.aerei.length || typeof skyProietta !== 'function') return;
    aggiornaAllineamenti();
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
    if (stato.avviato) return;
    stato.avviato = true; carica(false);
    stato.timer = setInterval(() => { if (typeof sky !== 'undefined' && sky.aperto) carica(false); }, INTERVALLO_MS);
  }
  function aereiFerma() { clearInterval(stato.timer); stato.timer = null; stato.avviato = false; }

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
    const linguetta = document.querySelector('[data-vai-gruppo="aerei"]');
    if (linguetta) linguetta.addEventListener('click', () => { aereiAvvia(); render(); });
  });

  window.aereiAvvia = aereiAvvia;
  window.aereiFerma = aereiFerma;
  window.aereiDisegna = aereiDisegna;
  window.aereiRaggioCambiato = aereiRaggioCambiato;
  window.AereiADS_B = { distanzaDirezione, posizioneFutura, coordinateCielo, separazione, arricchisci,
    interpretaAdsbExchange, urlAdsbExchange, urlAdsbFi, urlAttraverso,
    scaricaConRipiego, providersPredefiniti, stato };
}());
